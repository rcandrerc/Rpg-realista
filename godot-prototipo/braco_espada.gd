extends SkeletonModifier3D
# Modo espada andando ou correndo: o braço direito segura a espada baixa, com a lâmina para trás e para fora
# (uns 30° do corpo), em vez de balançar com a lâmina atravessando a coxa e a saia. Só o braço esquerdo balança.
# Roda depois da animação (SkeletonModifier3D); peso 0 = animação pura, 1 = pose da espada baixa.

var peso := 0.0
var _u := -1
var _l := -1
var _m := -1
var _lamina := Vector3.UP # direção da lâmina no espaço do osso da mão
var _cima := Vector3.UP
var _dir := Vector3.RIGHT # direita da personagem
var _frente := Vector3.BACK

# lamina_base: orientação da espada presa na mão (armas.json); a lâmina é o +Y da espada
func preparar(esq: Skeleton3D, lamina_base: Basis) -> void:
	_u = esq.find_bone("J_Bip_R_UpperArm")
	_l = esq.find_bone("J_Bip_R_LowerArm")
	_m = esq.find_bone("J_Bip_R_Hand")
	_lamina = (lamina_base * Vector3.UP).normalized()
	var p := func(n: String) -> Vector3: return esq.get_bone_global_rest(esq.find_bone(n)).origin
	_cima = (p.call("J_Bip_C_Head") - p.call("J_Bip_C_Hips")).normalized()
	_dir = (p.call("J_Bip_R_UpperArm") - p.call("J_Bip_L_UpperArm")).normalized()
	_frente = _cima.cross(_dir).normalized()
	if (p.call("J_Bip_R_ToeBase") - p.call("J_Bip_R_Foot")).dot(_frente) < 0.0: # confere com o pé
		_frente = -_frente

# gira o osso para o seu eixo (do osso até o filho) apontar para "alvo", misturado pelo peso; devolve a pose global nova
func _apontar(s: Skeleton3D, osso: int, pai_global: Transform3D, filho_origem: Vector3, alvo: Vector3, eixo_local := Vector3.ZERO) -> Transform3D:
	var pose := s.get_bone_pose(osso)
	var g := pai_global * pose
	var eixo: Vector3 = (g.basis * (eixo_local if eixo_local != Vector3.ZERO else filho_origem)).normalized()
	var giro := Quaternion(eixo, alvo.normalized())
	var alvo_local := (pai_global.basis.inverse() * (Basis(giro) * g.basis)).get_rotation_quaternion()
	var q := pose.basis.get_rotation_quaternion().slerp(alvo_local, peso)
	s.set_bone_pose_rotation(osso, q)
	return pai_global * Transform3D(Basis(q).scaled(pose.basis.get_scale()), pose.origin)

func _process_modification() -> void:
	var s := get_skeleton()
	if s == null or peso <= 0.001 or _u < 0 or _l < 0 or _m < 0:
		return
	var gp := s.get_bone_global_pose(s.get_bone_parent(_u))
	# braço quase reto para baixo, aberto para fora e um pouco para trás; antebraço com leve dobra para a frente
	var gu := _apontar(s, _u, gp, s.get_bone_pose(_l).origin, -_cima + _dir * 0.36 - _frente * 0.12)
	var gl := _apontar(s, _l, gu, s.get_bone_pose(_m).origin, -_cima + _dir * 0.3 + _frente * 0.22)
	# mão: a lâmina aponta para trás, para fora (~30°) e um pouco para baixo
	_apontar(s, _m, gl, Vector3.ZERO, -_frente + _dir * 0.58 - _cima * 0.45, _lamina)

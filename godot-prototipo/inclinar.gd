extends SkeletonModifier3D
# Peso do corpo: inclina o tronco para dentro da curva quando o herói vira correndo e afunda o quadril no pouso.
# Roda depois da animação (como o braco_espada.gd). inclinacao em radianos (+ = para a direita), afunda em metros.

var inclinacao := 0.0
var afunda := 0.0
var _coluna := -1
var _quadril := -1
var _frente := Vector3.BACK # frente do corpo no espaço do esqueleto
var _cima := Vector3.UP

func preparar(esq: Skeleton3D) -> void:
	_coluna = esq.find_bone("J_Bip_C_Spine")
	_quadril = esq.find_bone("J_Bip_C_Hips")
	if _coluna < 0 or _quadril < 0:
		return
	var p := func(n: String) -> Vector3: return esq.get_bone_global_rest(esq.find_bone(n)).origin
	_cima = (p.call("J_Bip_C_Head") - p.call("J_Bip_C_Hips")).normalized()
	var dir: Vector3 = (p.call("J_Bip_R_UpperArm") - p.call("J_Bip_L_UpperArm")).normalized()
	_frente = _cima.cross(dir).normalized()
	if (p.call("J_Bip_R_ToeBase") - p.call("J_Bip_R_Foot")).dot(_frente) < 0.0:
		_frente = -_frente

func _process_modification() -> void:
	var s := get_skeleton()
	if s == null or _coluna < 0:
		return
	if abs(inclinacao) > 0.002:
		# gira a coluna em volta da frente do corpo (eixo convertido para o espaço do osso)
		var pai := s.get_bone_global_pose(s.get_bone_parent(_coluna))
		var eixo := (pai.basis.inverse() * _frente).normalized()
		var pose := s.get_bone_pose_rotation(_coluna)
		s.set_bone_pose_rotation(_coluna, Quaternion(eixo, inclinacao) * pose)
	if afunda > 0.001:
		var pq := s.get_bone_parent(_quadril)
		var b := s.get_bone_global_pose(pq).basis if pq >= 0 else Basis()
		s.set_bone_pose_position(_quadril, s.get_bone_pose_position(_quadril) - (b.inverse() * _cima) * afunda)

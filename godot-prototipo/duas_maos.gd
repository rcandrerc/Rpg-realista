extends SkeletonModifier3D
# Picareta e machado com as DUAS mãos (pedido do André, 2026-11-02): roda depois da animação e leva cada mão
# até o seu lugar no cabo (IK de dois ossos: braço e antebraço), com o cotovelo para baixo e para fora.
# Também curva um pouco o tronco no golpe. Quem diz onde está o cabo é o trabalho.gd (mao_d, mao_e, cabo), em
# coordenadas do mundo; aqui só se dobra o corpo para chegar lá. peso 0 = animação pura.

var peso := 0.0
var curva := 0.0 # 0 = em pé, 1 = tronco curvado para a frente no golpe
var mao_d := Vector3.ZERO # onde a mão direita segura o cabo (mundo)
var mao_e := Vector3.ZERO # onde a mão esquerda segura (mundo)
var cabo := Vector3.UP # direção do cabo, da mão para a cabeça da ferramenta (mundo)
# corpo inteiro no golpe (pedido do André, 2026-11-03: "corpo duro, pés juntos, parece um robô"). Por baixo toca a
# pose "parada", de pés juntos; aqui as pernas abrem numa base de trabalho (pé esquerdo à frente, direito atrás,
# pontas para fora), o quadril desce e vai para a frente e para trás com o peso, e o tronco gira no golpe de lado.
var agacha := 0.0 # m que o quadril desce (os joelhos dobram, os pés ficam no chão)
var avanco := 0.0 # m que o quadril vai para a frente (+) ou para trás (-): o peso passando de um pé para o outro
var torcao := 0.0 # rad que o peito gira para a direita (+) ou para a esquerda (-), em volta do eixo do corpo
const BASE_ABRE := 0.1 # m que cada pé vai para fora
const BASE_FRENTE := 0.15 # m do pé esquerdo para a frente
const BASE_TRAS := 0.1 # m do pé direito para trás
const BASE_PONTA := 0.3 # rad das pontas dos pés para fora
const QUADRIL_GIRO := 0.35 # parte da torção que o quadril leva (o resto vai na coluna e no peito)

var _b := {} # ossos: "R_UpperArm" -> índice
var _cima := Vector3.UP # espaço do esqueleto, pose de descanso
var _dir := Vector3.RIGHT
var _frente := Vector3.BACK

func preparar(esq: Skeleton3D) -> void:
	for n in ["R_UpperArm", "R_LowerArm", "R_Hand", "L_UpperArm", "L_LowerArm", "L_Hand", "C_Spine", "C_Chest", "C_Hips", "C_Head",
			"R_UpperLeg", "R_LowerLeg", "R_Foot", "L_UpperLeg", "L_LowerLeg", "L_Foot", "C_Neck"]:
		_b[n] = esq.find_bone("J_Bip_" + n)
	var p := func(n: String) -> Vector3: return esq.get_bone_global_rest(_b[n]).origin
	_cima = (p.call("C_Head") - p.call("C_Hips")).normalized()
	_dir = (p.call("R_UpperArm") - p.call("L_UpperArm")).normalized()
	_frente = _cima.cross(_dir).normalized()
	var pe_d := esq.find_bone("J_Bip_R_Foot")
	var dedo := esq.find_bone("J_Bip_R_ToeBase")
	if pe_d >= 0 and dedo >= 0 and (esq.get_bone_global_rest(dedo).origin - esq.get_bone_global_rest(pe_d).origin).dot(_frente) < 0.0:
		_frente = -_frente

func pronto() -> bool:
	for k in _b:
		if int(_b[k]) < 0:
			return false
	return not _b.is_empty()

# gira o osso para o eixo (do osso até o filho) apontar para "alvo"; devolve a pose global nova
func _apontar(s: Skeleton3D, osso: int, pai_global: Transform3D, eixo_local: Vector3, alvo: Vector3, w: float) -> Transform3D:
	var pose := s.get_bone_pose(osso)
	var g := pai_global * pose
	var eixo: Vector3 = (g.basis * eixo_local).normalized()
	if alvo.length() < 1e-5 or eixo.length() < 1e-5:
		return g
	var giro := Quaternion(eixo, alvo.normalized())
	var alvo_local := (pai_global.basis.inverse() * (Basis(giro) * g.basis)).get_rotation_quaternion()
	var q := pose.basis.get_rotation_quaternion().slerp(alvo_local, w)
	s.set_bone_pose_rotation(osso, q)
	return pai_global * Transform3D(Basis(q).scaled(pose.basis.get_scale()), pose.origin)

# braço inteiro: ombro -> cotovelo -> mão no alvo (espaço do esqueleto); lado = +1 direito, -1 esquerdo
func _braco(s: Skeleton3D, u: int, l: int, h: int, alvo: Vector3, eixo_cabo: Vector3, lado: float) -> void:
	var gp := s.get_bone_global_pose(s.get_bone_parent(u))
	var gu := gp * s.get_bone_pose(u)
	var gl := gu * s.get_bone_pose(l)
	var gh := gl * s.get_bone_pose(h)
	var S: Vector3 = gu.origin
	var a: float = gu.origin.distance_to(gl.origin)
	var b: float = gl.origin.distance_to(gh.origin)
	var st: Vector3 = alvo - S
	var d: float = clamp(st.length(), 0.05, (a + b) * 0.995)
	var n: Vector3 = st.normalized()
	# cotovelo: para baixo, para fora do corpo e um pouco para trás. Com a mão acima do ombro (picareta erguida),
	# o cotovelo vai para fora e para a frente, como num braço de verdade, e nunca para trás da cabeça
	var polo_baixo: Vector3 = -_cima * 0.7 + _dir * lado * 0.6 - _frente * 0.2
	var polo_alto: Vector3 = _dir * lado * 0.75 + _frente * 0.45 - _cima * 0.1
	var polo: Vector3 = polo_baixo.lerp(polo_alto, smoothstep(-0.1, 0.6, n.dot(_cima)))
	polo = (polo - n * polo.dot(n)).normalized()
	var ao_longo: float = (a * a + d * d - b * b) / (2.0 * d)
	var alto: float = sqrt(max(0.0, a * a - ao_longo * ao_longo))
	var E: Vector3 = S + n * ao_longo + polo * alto
	var T: Vector3 = S + n * d
	var gu2 := _apontar(s, u, gp, s.get_bone_pose(l).origin, E - S, peso)
	var gl2 := _apontar(s, l, gu2, s.get_bone_pose(h).origin, T - E, peso)
	# mão: os dedos fecham em volta do cabo, atravessando para o outro lado do corpo
	var dedos: Vector3 = -_dir * lado
	dedos = (dedos - eixo_cabo * dedos.dot(eixo_cabo))
	if dedos.length() > 0.01:
		_apontar(s, h, gl2, _eixo_mao(s, h), dedos, peso)

var _eixo_cache := {}
# eixo do osso da mão até o dedo médio (no espaço do osso)
func _eixo_mao(s: Skeleton3D, h: int) -> Vector3:
	if _eixo_cache.has(h):
		return _eixo_cache[h]
	var e := Vector3(0, 1, 0)
	for f in range(s.get_bone_count()):
		if s.get_bone_parent(f) == h and "Middle" in s.get_bone_name(f):
			e = s.get_bone_rest(f).origin
	_eixo_cache[h] = e
	return e

func _process_modification() -> void:
	var s := get_skeleton()
	if s == null or peso <= 0.001 or not pronto():
		return
	var inv := s.global_transform.affine_inverse()
	# onde a animação pôs os pés (no chão): a base de trabalho parte daí
	var pe_d0 := s.get_bone_global_pose(_b.R_Foot)
	var pe_e0 := s.get_bone_global_pose(_b.L_Foot)
	# quadril: desce, vai com o peso e gira um pouco junto com o peito
	var q_o: int = _b.C_Hips
	var q_pose := s.get_bone_pose(q_o)
	var q_pai := s.get_bone_global_pose(s.get_bone_parent(q_o)) if s.get_bone_parent(q_o) >= 0 else Transform3D()
	var desloca: Vector3 = (-_cima * agacha + _frente * avanco) * peso
	s.set_bone_pose_position(q_o, q_pose.origin + q_pai.basis.inverse() * desloca)
	_girar(s, q_o, _cima, -torcao * QUADRIL_GIRO * peso)
	# pernas: cada pé no seu lugar da base aberta, joelhos dobrando para a frente e um pouco para fora
	_perna(s, _b.R_UpperLeg, _b.R_LowerLeg, _b.R_Foot, pe_d0, 1.0)
	_perna(s, _b.L_UpperLeg, _b.L_LowerLeg, _b.L_Foot, pe_e0, -1.0)
	# coluna e peito: o resto da torção (o quadril já levou uma parte)
	if abs(torcao) > 0.001:
		for k in ["C_Spine", "C_Chest"]:
			_girar(s, _b[k], _cima, -torcao * (1.0 - QUADRIL_GIRO) * 0.5 * peso)
		# a cabeça volta um pouco para continuar olhando a pedra ou o tronco
		_girar(s, _b.C_Neck, _cima, torcao * 0.55 * peso)
	# tronco: curva para a frente no golpe (gira a coluna e o peito em volta do eixo direito); negativo arqueia
	# para trás quando ergue a ferramenta
	if abs(curva) > 0.001:
		for k in ["C_Spine", "C_Chest"]:
			var o: int = _b[k]
			var pose := s.get_bone_pose(o)
			var pg := s.get_bone_global_pose(s.get_bone_parent(o))
			var eixo_local: Vector3 = (pg.basis * pose.basis).inverse() * _dir
			var q: Quaternion = pose.basis.get_rotation_quaternion() * Quaternion(eixo_local.normalized(), -0.3 * curva * peso)
			s.set_bone_pose_rotation(o, q)
	var ec: Vector3 = (inv.basis * cabo).normalized()
	_braco(s, _b.R_UpperArm, _b.R_LowerArm, _b.R_Hand, inv * mao_d, ec, 1.0)
	_braco(s, _b.L_UpperArm, _b.L_LowerArm, _b.L_Hand, inv * mao_e, ec, -1.0)

# gira o osso em volta de um eixo do espaço do esqueleto (rad), por cima da pose de agora
func _girar(s: Skeleton3D, o: int, eixo: Vector3, a: float) -> void:
	if abs(a) < 1e-5:
		return
	var pose := s.get_bone_pose(o)
	var pai := s.get_bone_parent(o)
	var pg := s.get_bone_global_pose(pai) if pai >= 0 else Transform3D()
	var eixo_local: Vector3 = ((pg.basis * pose.basis).inverse() * eixo).normalized()
	s.set_bone_pose_rotation(o, pose.basis.get_rotation_quaternion() * Quaternion(eixo_local, a))

# perna inteira: coxa -> joelho -> pé no alvo da base aberta (espaço do esqueleto); lado = +1 direito, -1 esquerdo.
# O pé fica na altura em que a animação pôs (no chão) e com a sola do mesmo jeito, só com a ponta para fora.
func _perna(s: Skeleton3D, u: int, l: int, h: int, pe0: Transform3D, lado: float) -> void:
	var passo: float = -BASE_TRAS if lado > 0.0 else BASE_FRENTE
	var alvo: Vector3 = pe0.origin + (_dir * lado * BASE_ABRE + _frente * passo) * peso
	var gp := s.get_bone_global_pose(s.get_bone_parent(u))
	var gu := gp * s.get_bone_pose(u)
	var gl := gu * s.get_bone_pose(l)
	var gh := gl * s.get_bone_pose(h)
	var S: Vector3 = gu.origin
	var a: float = gu.origin.distance_to(gl.origin)
	var b: float = gl.origin.distance_to(gh.origin)
	var st: Vector3 = alvo - S
	var d: float = clamp(st.length(), 0.05, (a + b) * 0.999)
	var n: Vector3 = st.normalized()
	var polo: Vector3 = _frente + _dir * lado * 0.3
	polo = (polo - n * polo.dot(n)).normalized()
	var ao_longo: float = (a * a + d * d - b * b) / (2.0 * d)
	var alto: float = sqrt(max(0.0, a * a - ao_longo * ao_longo))
	var J: Vector3 = S + n * ao_longo + polo * alto
	var T: Vector3 = S + n * d
	var gu2 := _apontar(s, u, gp, s.get_bone_pose(l).origin, J - S, 1.0)
	var gl2 := _apontar(s, l, gu2, s.get_bone_pose(h).origin, T - J, 1.0)
	# pé: a mesma sola da animação, girada para a ponta ir para fora
	var giro := Basis(_cima, -lado * BASE_PONTA * peso)
	var quer: Basis = giro * pe0.basis.orthonormalized()
	var local: Quaternion = (gl2.basis.orthonormalized().inverse() * quer).get_rotation_quaternion()
	s.set_bone_pose_rotation(h, local)

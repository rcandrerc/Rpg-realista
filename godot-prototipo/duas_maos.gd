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
# m que o pulso fica antes do cabo (André 2026-11-16, dedos fechados): o cabo passa por dentro do punho, não pelo
# pulso. 0 = o pulso vai em cima do cabo (como era)
var punho := 0.0
# corpo inteiro no golpe (pedido do André, 2026-11-03: "corpo duro, pés juntos, parece um robô"). Por baixo toca a
# pose "parada", de pés juntos; aqui as pernas abrem numa base de trabalho (pé esquerdo à frente, direito atrás,
# pontas para fora), o quadril desce e vai para a frente e para trás com o peso, e o tronco gira no golpe de lado.
var agacha := 0.0 # m que o quadril desce (os joelhos dobram, os pés ficam no chão)
var avanco := 0.0 # m que o quadril vai para a frente (+) ou para trás (-): o peso passando de um pé para o outro
var torcao := 0.0 # rad que o peito gira para a direita (+) ou para a esquerda (-), em volta do eixo do corpo
# André 2026-11-15 ("pés muito juntos, parece que vai cair; precisa de base para fazer força", como no ArcheAge):
# base bem mais larga. Antes: abre 0.1, frente 0.15, trás 0.1.
const BASE_ABRE := 0.2 # m que cada pé vai para fora
const BASE_FRENTE := 0.26 # m do pé esquerdo para a frente
const BASE_TRAS := 0.2 # m do pé direito para trás
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
	if pronto():
		_preparar_maos(esq)

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
	# pegada fechada (André 2026-11-16: "as mãos estão tortas, não pegam direito"): a mão continua o antebraço, os
	# nós dos dedos atravessam o cabo e o indicador fica do lado da cabeça da ferramenta. O pulso recua para o punho
	# fechado (não o pulso) ficar em volta do cabo.
	var F := Vector3.ZERO
	var quer := Basis()
	var tem_mao: bool = punho > 0.0 and _mao_local.has(h)
	var grip: Vector3 = alvo
	if punho > 0.0 and not tem_mao: # (sem os ossos dos dedos) só recua o pulso
		var ante: Vector3 = alvo - S
		F = ante - eixo_cabo * ante.dot(eixo_cabo)
		if F.length() > 0.01:
			alvo -= (F.normalized() * punho + _palma_mundo(F.normalized(), eixo_cabo, lado) * PUNHO_PALMA) * peso
		F = Vector3.ZERO
	var ET: Array = _resolver(S, a, b, alvo, lado)
	if tem_mao:
		# duas voltas: a mão segue o antebraço, e o pulso vai para onde o furo do punho fechado cai em cima do cabo
		for volta in 2:
			var antebraco: Vector3 = ((ET[1] as Vector3) - (ET[0] as Vector3)).normalized() if volta > 0 else (grip - S).normalized()
			var Fm: Vector3 = antebraco - eixo_cabo * antebraco.dot(eixo_cabo)
			if Fm.length() < 0.05:
				break
			F = Fm.normalized()
			var ml: Array = _mao_local[h]
			quer = _base(F, -eixo_cabo) * _base(ml[0], ml[1]).inverse() # global da mão
			var furo: Vector3 = furo_local.get(h, ml[0].normalized() * punho)
			alvo = grip - (quer * furo) * peso
			ET = _resolver(S, a, b, alvo, lado)
	var E: Vector3 = ET[0]
	var T: Vector3 = ET[1]
	var gu2 := _apontar(s, u, gp, s.get_bone_pose(l).origin, E - S, peso)
	var gl2 := _apontar(s, l, gu2, s.get_bone_pose(h).origin, T - E, peso)
	if F != Vector3.ZERO:
		# mão inteira: dedos ao longo do antebraço (só o que fica de lado do cabo) e o indicador para a cabeça
		var loc: Quaternion = (gl2.basis.orthonormalized().inverse() * quer).get_rotation_quaternion()
		s.set_bone_pose_rotation(h, s.get_bone_pose_rotation(h).slerp(loc, peso))
		return
	# mão: os dedos fecham em volta do cabo, atravessando para o outro lado do corpo
	var dedos: Vector3 = -_dir * lado
	dedos = (dedos - eixo_cabo * dedos.dot(eixo_cabo))
	if dedos.length() > 0.01:
		_apontar(s, h, gl2, _eixo_mao(s, h), dedos, peso)

# ombro S, braço a e antebraço b: devolve [cotovelo, pulso] para o pulso chegar em "alvo"
func _resolver(S: Vector3, a: float, b: float, alvo: Vector3, lado: float) -> Array:
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
	return [S + n * ao_longo + polo * alto, S + n * d]

var furo_local := {} # osso da mão -> onde o cabo passa dentro do punho fechado (espaço do osso), de mao_fechada.gd
const PUNHO_PALMA := 0.02 # m que o cabo fica para dentro da palma (a palma encosta nele)
var _mao_local := {} # osso da mão -> [dedos, lado do indicador para o mindinho] no espaço do osso (descanso)

# base ortonormal com x = dedos e y = lado (o z sai do produto)
static func _base(dedos: Vector3, lado_v: Vector3) -> Basis:
	var x: Vector3 = dedos.normalized()
	var y: Vector3 = (lado_v - x * lado_v.dot(x)).normalized()
	return Basis(x, y, x.cross(y))

# para onde a palma olha (espaço do esqueleto) com os dedos em F e o indicador para a cabeça da ferramenta
func _palma_mundo(F: Vector3, eixo_cabo: Vector3, lado: float) -> Vector3:
	var p: Vector3 = F.cross(-eixo_cabo).normalized()
	var ref: int = _b.R_Hand if lado > 0.0 else _b.L_Hand
	if _palma_sinal.has(ref):
		p *= float(_palma_sinal[ref])
	return p
var _palma_sinal := {} # osso da mão -> +1/-1: a palma é dedos x lado ou o contrário

func _preparar_maos(esq: Skeleton3D) -> void:
	for k in ["R_Hand", "L_Hand"]:
		var h: int = int(_b[k])
		var g: Basis = esq.get_bone_global_rest(h).basis.orthonormalized()
		var o := func(n: String) -> Vector3: return esq.get_bone_global_rest(esq.find_bone(n)).origin
		var pre: String = "J_Bip_" + String(k).substr(0, 1) + "_"
		if esq.find_bone(pre + "Index1") < 0 or esq.find_bone(pre + "Little1") < 0 or esq.find_bone(pre + "Middle1") < 0:
			continue
		var punho0: Vector3 = esq.get_bone_global_rest(h).origin
		var dedos_w: Vector3 = (o.call(pre + "Middle1") as Vector3) - punho0
		var lado_w: Vector3 = (o.call(pre + "Little1") as Vector3) - (o.call(pre + "Index1") as Vector3)
		_mao_local[h] = [g.inverse() * dedos_w, g.inverse() * lado_w]
		# palma: na pose T a palma olha para baixo (para longe da cabeça)
		var x: Vector3 = dedos_w.normalized()
		var p: Vector3 = x.cross((lado_w - x * lado_w.dot(x)).normalized())
		_palma_sinal[h] = 1.0 if p.dot(_cima) < 0.0 else -1.0

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
	var md: Vector3 = inv * mao_d
	if punho > 0.0: # mão de cima longe demais (ferramenta erguida): escorrega pelo cabo até o braço alcançar
		md = _alcancavel(s, md, inv * mao_e)
	_braco(s, _b.R_UpperArm, _b.R_LowerArm, _b.R_Hand, md, ec, 1.0)
	_braco(s, _b.L_UpperArm, _b.L_LowerArm, _b.L_Hand, inv * mao_e, ec, -1.0)

# ponto mais alto do cabo, entre a mão de cima (md) e a de baixo (me), que o braço direito alcança com folga
func _alcancavel(s: Skeleton3D, md: Vector3, me: Vector3) -> Vector3:
	var u: int = _b.R_UpperArm
	var gu := s.get_bone_global_pose(s.get_bone_parent(u)) * s.get_bone_pose(u)
	var gl := gu * s.get_bone_pose(_b.R_LowerArm)
	var gh := gl * s.get_bone_pose(_b.R_Hand)
	var alcance: float = (gu.origin.distance_to(gl.origin) + gl.origin.distance_to(gh.origin) + punho) * 0.96
	if gu.origin.distance_to(md) <= alcance:
		return md
	var a := 0.0 # 0 = md, 1 = me
	var b := 1.0
	if gu.origin.distance_to(me) > alcance:
		return md.lerp(me, 0.6)
	for i in 12:
		var c := (a + b) * 0.5
		if gu.origin.distance_to(md.lerp(me, c)) > alcance:
			a = c
		else:
			b = c
	return md.lerp(me, b)

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

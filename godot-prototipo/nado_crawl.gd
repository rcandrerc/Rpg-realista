extends SkeletonModifier3D
# Nado crawl (André 2026-11-15, no jeito do nado do ArcheAge): por cima do nado do Mixamo (que é peito, "de sapo")
# os braços giram alternados como um moinho (um puxa por baixo da água enquanto o outro volta por cima, cotovelo
# alto), o tronco rola para o lado do braço que puxa e as pernas ficam esticadas batendo de leve (batida de pernas).
# Roda depois da animação (é o último filho do esqueleto). peso 0 = animação pura; main.gd dá peso, fase e frente.

var peso := 0.0
var fase := 0.0 # ciclos de braço (1 ciclo = uma braçada de cada braço)
var frente := Vector3.FORWARD # para onde o herói nada (mundo, na horizontal)

const ALCANCE := 0.5 # m que a mão vai à frente e atrás do ombro
const FUNDO := 0.34 # m que a mão desce por baixo do corpo puxando
const ALTO := 0.45 # m que a mão sobe por cima da água voltando (o ombro fica uns 10 cm dentro da água)
const PUXA := 0.56 # parte do ciclo com a mão dentro da água
const ROLA := 0.38 # rad que o tronco rola para o lado do braço que puxa
const BATIDAS := 3.0 # batidas de cada perna por ciclo de braço (crawl de 6 batidas)
const PERNA_BATE := 0.11 # m que o pé sobe e desce
const PERNA_ABRE := 0.07 # m de cada pé para fora

var _b := {}

func preparar(esq: Skeleton3D) -> void:
	for n in ["R_UpperArm", "R_LowerArm", "R_Hand", "L_UpperArm", "L_LowerArm", "L_Hand", "C_Spine", "C_Chest", "C_Hips",
			"R_UpperLeg", "R_LowerLeg", "R_Foot", "L_UpperLeg", "L_LowerLeg", "L_Foot", "R_ToeBase", "L_ToeBase", "C_Neck"]:
		_b[n] = esq.find_bone("J_Bip_" + n)

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

func _girar(s: Skeleton3D, o: int, eixo: Vector3, a: float) -> void:
	if abs(a) < 1e-5:
		return
	var pose := s.get_bone_pose(o)
	var pai := s.get_bone_parent(o)
	var pg := s.get_bone_global_pose(pai) if pai >= 0 else Transform3D()
	var eixo_local: Vector3 = ((pg.basis * pose.basis).inverse() * eixo).normalized()
	s.set_bone_pose_rotation(o, pose.basis.get_rotation_quaternion() * Quaternion(eixo_local, a))

# dois ossos (braço ou perna) até o alvo, com a dobra (cotovelo ou joelho) para o lado do polo; tudo no espaço
# do esqueleto. Devolve a pose global do segundo osso e onde fica a ponta.
func _ik(s: Skeleton3D, u: int, l: int, h: int, alvo: Vector3, polo: Vector3) -> Array:
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
	var p: Vector3 = (polo - n * polo.dot(n)).normalized()
	var ao_longo: float = (a * a + d * d - b * b) / (2.0 * d)
	var alto: float = sqrt(max(0.0, a * a - ao_longo * ao_longo))
	var E: Vector3 = S + n * ao_longo + p * alto
	var T: Vector3 = S + n * d
	var gu2 := _apontar(s, u, gp, s.get_bone_pose(l).origin, E - S, peso)
	var gl2 := _apontar(s, l, gu2, s.get_bone_pose(h).origin, T - E, peso)
	return [gl2, T, E]

var _dedos := {}
# eixo do osso da mão até o dedo médio (no espaço do osso), guardado
func _dedo(s: Skeleton3D, h: int) -> Vector3:
	if not _dedos.has(h):
		var e := Vector3(0, 1, 0)
		for f in range(s.get_bone_count()):
			if s.get_bone_parent(f) == h and "Middle" in s.get_bone_name(f):
				e = s.get_bone_rest(f).origin
		_dedos[h] = e
	return _dedos[h]

func _process_modification() -> void:
	var s := get_skeleton()
	if s == null or peso <= 0.001 or not pronto():
		return
	var inv := s.global_transform.affine_inverse()
	# direções do mundo no espaço do esqueleto: frente (para onde nada), cima (fora da água) e direita
	var fr: Vector3 = (inv.basis * frente).normalized()
	var ci: Vector3 = (inv.basis * Vector3.UP).normalized()
	var di: Vector3 = fr.cross(ci).normalized()
	var ciclo: float = fposmod(fase, 1.0)
	# o tronco rola: para a direita quando o braço direito puxa (ombro direito afunda)
	var rola: float = -sin(ciclo * TAU) * ROLA
	for k in ["C_Spine", "C_Chest"]:
		_girar(s, _b[k], fr, rola * 0.5 * peso)
	_girar(s, _b.C_Neck, fr, -rola * 0.6 * peso) # a cabeça fica mais parada que o peito
	# braços: o direito no começo do ciclo, o esquerdo meio ciclo depois
	for lado in [1.0, -1.0]:
		var c: float = fposmod(ciclo + (0.0 if lado > 0.0 else 0.5), 1.0)
		var u: int = _b.R_UpperArm if lado > 0.0 else _b.L_UpperArm
		var l: int = _b.R_LowerArm if lado > 0.0 else _b.L_LowerArm
		var h: int = _b.R_Hand if lado > 0.0 else _b.L_Hand
		var ombro: Vector3 = s.get_bone_global_pose(u).origin
		var ida: float
		var cima_m: float
		var fora: float
		if c < PUXA: # dentro da água: da frente, por baixo do corpo, até a coxa
			var t: float = c / PUXA
			var a: float = t * PI
			ida = cos(a) * ALCANCE + 0.05
			cima_m = -sin(a) * FUNDO - 0.04
			fora = 0.06 - sin(a) * 0.1 # a mão passa por baixo do peito
		else: # por cima da água: sai na coxa e volta para a frente com o cotovelo alto
			var t2: float = (c - PUXA) / (1.0 - PUXA)
			var a2: float = PI + t2 * PI
			ida = cos(a2) * ALCANCE + 0.05
			cima_m = -sin(a2) * ALTO - 0.04
			fora = 0.06 + sin(t2 * PI) * 0.12
		var alvo: Vector3 = ombro + fr * ida + ci * cima_m + di * lado * fora
		var polo: Vector3 = ci * 0.8 + di * lado * 0.6 # cotovelo para cima e para fora
		var r: Array = _ik(s, u, l, h, alvo, polo)
		# mão: reta com o antebraço (a palma empurra a água)
		_apontar(s, h, r[0], _dedo(s, h), (r[1] as Vector3) - (r[2] as Vector3), peso)
	# pernas: esticadas para trás, juntas, batendo alternadas de leve; os pés apontados (ponta para trás)
	for lado in [1.0, -1.0]:
		var u: int = _b.R_UpperLeg if lado > 0.0 else _b.L_UpperLeg
		var l: int = _b.R_LowerLeg if lado > 0.0 else _b.L_LowerLeg
		var h: int = _b.R_Foot if lado > 0.0 else _b.L_Foot
		var dedo_o: int = _b.R_ToeBase if lado > 0.0 else _b.L_ToeBase
		var gu := s.get_bone_global_pose(u)
		var comp: float = gu.origin.distance_to(s.get_bone_global_pose(l).origin) + s.get_bone_global_pose(l).origin.distance_to(s.get_bone_global_pose(h).origin)
		var bate: float = sin((ciclo * BATIDAS + (0.0 if lado > 0.0 else 0.5)) * TAU)
		var alvo: Vector3 = gu.origin - fr * comp * 0.97 + ci * (bate * PERNA_BATE - 0.05) + di * lado * PERNA_ABRE
		var r: Array = _ik(s, u, l, h, alvo, -ci + fr * 0.2) # o joelho dobra um pouco para baixo
		var gl2: Transform3D = r[0]
		_apontar(s, h, gl2, s.get_bone_pose(dedo_o).origin, -fr - ci * 0.25, peso)

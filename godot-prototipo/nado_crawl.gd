extends SkeletonModifier3D
# Nado crawl (André 2026-11-15, no jeito do nado do ArcheAge): por cima do nado do Mixamo (que é peito, "de sapo")
# os braços giram alternados como um moinho (um puxa por baixo da água enquanto o outro volta por cima, cotovelo
# alto), o tronco rola para o lado do braço que puxa e as pernas ficam esticadas batendo de leve (batida de pernas).
# Debaixo d'água (sapo = 1) vira nado de peito natural: braços e pernas pela tabela *_SAPO.
# Roda depois da animação (é o último filho do esqueleto). peso 0 = animação pura; main.gd dá peso, fase e frente.

var peso := 0.0
var fase := 0.0 # ciclos de braço (1 ciclo = uma braçada de cada braço)
var frente := Vector3.FORWARD # para onde o herói nada (mundo, na horizontal)
var sapo := 0.0 # 0 = crawl (na superfície), 1 = nado de peito (debaixo d'água)
var fase_sapo := 0.0 # ciclos do nado de peito
var boia := 0.0 # 1 = parado na água (boiando em pé), 0 = nadando
var fase_boia := 0.0 # ciclos do boiar

const ROLA := 0.38 # rad que o tronco rola para o lado do braço que puxa
const BATIDAS := 2.0 # batidas de cada perna por ciclo de braço (André: "pernas rápidas demais, sem fluidez")
const PERNA_BATE := 0.22 # m que o pé sobe e desce (André: "mais forte", depois "movimentos curtos")
const PESO_AGUA := 0.4 # quanto a puxada demora a mais que a volta (0 = ritmo igual)
const PERNA_ABRE := 0.07 # m de cada pé para fora
# parado na água (André 2026-11-15, pela gravação do ArcheAge): em pé, braços abertos para os lados na linha da
# água, as mãos varrendo para a frente e para trás devagar (cotovelo meio dobrado) e as pernas pedalando embaixo
const BOIA_ABRE := 0.42 # m da mão para fora do ombro
const BOIA_VARRE := 0.24 # m que a mão vai para a frente e para trás
const BOIA_PEDALA := 0.12 # m do círculo de cada pé

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

# caminho da mão em volta do ombro (André 2026-11-15: "os braços giram 360 retos, sem articulação"): em vez de um
# círculo de braço esticado, a mão entra esticada lá na frente, dobra o cotovelo puxando por baixo do peito, empurra
# até a coxa e volta por cima rente ao corpo com o cotovelo alto (antebraço pendurado). [ciclo, frente, cima, fora]
const BRACO := [
	[0.0, 0.5, -0.06, 0.1],
	[0.14, 0.4, -0.22, 0.1],
	[0.28, 0.08, -0.3, 0.02],
	[0.44, -0.3, -0.2, 0.08],
	[0.54, -0.4, -0.02, 0.13],
	[0.64, -0.22, 0.17, 0.18],
	[0.76, 0.05, 0.24, 0.2],
	[0.88, 0.32, 0.16, 0.16],
]

const BRACO_REDONDO := true # false volta para o caminho da tabela BRACO
const BRACO_CENTRO := 0.06 # m do centro da elipse à frente do ombro
const BRACO_RAIO_FRENTE := 0.5 # m
const BRACO_RAIO_CIMA := 0.36 # m

# [frente, cima, fora, 0..1 o quanto está na volta por cima]
func _chave_braco(c: float) -> Array:
	if not BRACO_REDONDO:
		var r0: Array = _curva(BRACO, c)
		r0.append(smoothstep(0.5, 0.62, c) * (1.0 - smoothstep(0.9, 1.0, c)))
		return r0
	# André 2026-11-15: "movimentos curtos; mais circulares, arredondados, contínuos e pesados". A mão faz uma elipse
	# grande em volta do ombro: entra lá na frente, desce fundo, empurra até a coxa e volta alta por cima. O
	# cotovelo dobra sozinho onde a elipse passa perto do ombro (embaixo do peito e em cima).
	var t: float = c * TAU
	var fr: float = BRACO_CENTRO + BRACO_RAIO_FRENTE * cos(t)
	var ci: float = -BRACO_RAIO_CIMA * sin(t) - 0.03
	var fora: float = 0.1 + 0.1 * max(0.0, -sin(t)) # na volta por cima a mão abre para o lado
	return [fr, ci, fora, clamp(-sin(t) * 1.6, 0.0, 1.0)]

# nado de peito debaixo d'água (André 2026-11-15: "o nosso sapinho está feio, o do ArcheAge é bem mais natural"): os
# dois braços juntos deslizam esticados, abrem, puxam para dentro com o cotovelo alto até as mãos se juntarem
# embaixo do queixo e disparam para a frente; as pernas ficam retas, dobram trazendo os calcanhares, abrem e
# chicoteiam juntas, e o corpo desliza. [ciclo, frente, cima, fora]
# Tempos tirados da gravação do ArcheAge que o André mandou (vista de trás, ~1,1 s por braçada): pernas juntas e
# retas, os joelhos abrem trazendo os calcanhares, chutam bem abertas e fecham juntas; depois das pernas fechadas os
# braços abrem para os lados, puxam e voltam por baixo do peito para a frente.
const BRACO_SAPO := [
	[0.0, 0.2, -0.12, 0.0],
	[0.15, 0.5, -0.03, 0.05],
	[0.4, 0.52, -0.02, 0.06],
	[0.65, 0.52, -0.02, 0.06],
	[0.78, 0.35, -0.1, 0.52],
	[0.88, 0.1, -0.22, 0.34],
	[0.95, 0.12, -0.14, 0.0],
]
# pés: [ciclo, quanto da perna vai para trás (fração), cima, fora]
const PERNA_SAPO := [
	[0.0, 0.97, -0.02, 0.04],
	[0.25, 0.96, 0.0, 0.04],
	[0.42, 0.5, 0.18, 0.12],
	[0.58, 0.78, 0.0, 0.58],
	[0.7, 0.88, -0.02, 0.5],
	[0.85, 0.97, -0.02, 0.05],
]

# Catmull-Rom fechado numa tabela [ciclo, a, b, c]: devolve [a, b, c]
func _curva(tab: Array, c: float) -> Array:
	var n: int = tab.size()
	var i := n - 1
	for j in n:
		if float(tab[j][0]) > c:
			i = j - 1
			break
	var c0: float = float(tab[i][0])
	var c1: float = float(tab[(i + 1) % n][0]) + (1.0 if i + 1 >= n else 0.0)
	var t: float = (c - c0) / max(0.001, c1 - c0)
	var r := []
	for e in [1, 2, 3]:
		var p0: float = float(tab[(i - 1 + n) % n][e])
		var p1: float = float(tab[i][e])
		var p2: float = float(tab[(i + 1) % n][e])
		var p3: float = float(tab[(i + 2) % n][e])
		r.append(0.5 * ((2.0 * p1) + (-p0 + p2) * t + (2.0 * p0 - 5.0 * p1 + 4.0 * p2 - p3) * t * t + (-p0 + 3.0 * p1 - 3.0 * p2 + p3) * t * t * t))
	return r

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

var _lados := {}
# eixo do dedo mínimo até o indicador (no espaço do osso da mão): diz para onde a palma vira
func _lado_mao(s: Skeleton3D, h: int) -> Vector3:
	if not _lados.has(h):
		var ind := Vector3.ZERO
		var mini := Vector3.ZERO
		for f in range(s.get_bone_count()):
			if s.get_bone_parent(f) == h:
				if "Index" in s.get_bone_name(f):
					ind = s.get_bone_rest(f).origin
				elif "Little" in s.get_bone_name(f):
					mini = s.get_bone_rest(f).origin
		_lados[h] = ind - mini
	return _lados[h]

func _base(a: Vector3, b: Vector3) -> Basis:
	var x := a.normalized()
	var y := (b - x * b.dot(x)).normalized()
	return Basis(x, y, x.cross(y))

# mão inteira orientada (André: "a mão parece bugada"): os dedos para "dedos" e o indicador para o lado "indicador",
# assim a palma não fica torta nem gira sozinha
func _mao(s: Skeleton3D, h: int, pai_global: Transform3D, dedos: Vector3, indicador: Vector3, w: float) -> void:
	var lado: Vector3 = _lado_mao(s, h)
	var fl: Vector3 = _dedo(s, h)
	if lado.length() < 1e-4 or dedos.length() < 1e-5 or abs(dedos.normalized().dot(indicador.normalized())) > 0.97:
		_apontar(s, h, pai_global, fl, dedos, w)
		return
	var pose := s.get_bone_pose(h)
	var g: Basis = _base(dedos, indicador) * _base(fl, lado).inverse()
	var alvo_local := (pai_global.basis.orthonormalized().inverse() * g).get_rotation_quaternion()
	s.set_bone_pose_rotation(h, pose.basis.get_rotation_quaternion().slerp(alvo_local, w))

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
	var cs: float = fposmod(fase_sapo, 1.0)
	var rola: float = -sin(ciclo * TAU) * ROLA * (1.0 - sapo) * (1.0 - boia)
	var cb: float = fposmod(fase_boia, 1.0)
	for k in ["C_Spine", "C_Chest"]:
		_girar(s, _b[k], fr, rola * 0.5 * peso)
	_girar(s, _b.C_Neck, fr, -rola * 0.6 * peso) # a cabeça fica mais parada que o peito
	# braços: o direito no começo do ciclo, o esquerdo meio ciclo depois
	for lado in [1.0, -1.0]:
		var c: float = fposmod(ciclo + (0.0 if lado > 0.0 else 0.5), 1.0)
		# peso da água (André: "não é câmera lenta, é pesado, uma força contrária"): a puxada (meio do ciclo) anda
		# devagar, com esforço, e a volta por cima do ar é mais rápida
		c = fposmod(c + PESO_AGUA / TAU * sin(TAU * (c + 0.25)), 1.0)
		var u: int = _b.R_UpperArm if lado > 0.0 else _b.L_UpperArm
		var l: int = _b.R_LowerArm if lado > 0.0 else _b.L_LowerArm
		var h: int = _b.R_Hand if lado > 0.0 else _b.L_Hand
		var ombro: Vector3 = s.get_bone_global_pose(u).origin
		var k: Array = _chave_braco(c)
		if sapo > 0.001: # de peito: os dois braços juntos
			var ks: Array = _curva(BRACO_SAPO, cs)
			for e in 3:
				k[e] = lerp(float(k[e]), float(ks[e]), sapo)
			k[3] = float(k[3]) * (1.0 - sapo)
		var alvo: Vector3 = ombro + fr * float(k[0]) + ci * float(k[1]) + di * lado * float(k[2])
		# cotovelo: puxando, para fora e um pouco para cima (o braço dobra e "abraça" a água); voltando, bem alto
		var na_volta: float = float(k[3])
		var polo: Vector3 = (ci * 0.5 + di * lado * 0.9).lerp(ci * 1.0 + di * lado * 0.35 - fr * 0.25, na_volta)
		polo = polo.lerp(ci * 0.4 + di * lado * 1.0, sapo) # de peito: cotovelos para fora
		if boia > 0.001:
			var vb: float = sin(cb * TAU)
			var alvo_b: Vector3 = ombro + di * lado * (BOIA_ABRE - 0.06 * vb) + fr * (BOIA_VARRE * vb + 0.08) + ci * (0.03 - 0.03 * cos(cb * TAU))
			alvo = alvo.lerp(alvo_b, boia)
			polo = polo.lerp(-ci * 0.6 - fr * 0.5 + di * lado * 0.3, boia) # cotovelo para baixo e para trás
		var r: Array = _ik(s, u, l, h, alvo, polo)
		# mão: reta com o antebraço, palma virada para trás/baixo (empurra a água), o polegar para dentro; boiando, a
		# palma fica para baixo com o indicador para a frente
		var ante: Vector3 = (r[1] as Vector3) - (r[2] as Vector3)
		var ind: Vector3 = (-di * lado + ci * 0.2).lerp(fr, boia)
		_mao(s, h, r[0], ante, ind, peso)
	# pernas: esticadas para trás, juntas, batendo alternadas de leve; os pés apontados (ponta para trás)
	for lado in [1.0, -1.0]:
		var u: int = _b.R_UpperLeg if lado > 0.0 else _b.L_UpperLeg
		var l: int = _b.R_LowerLeg if lado > 0.0 else _b.L_LowerLeg
		var h: int = _b.R_Foot if lado > 0.0 else _b.L_Foot
		var dedo_o: int = _b.R_ToeBase if lado > 0.0 else _b.L_ToeBase
		var gu := s.get_bone_global_pose(u)
		var comp: float = gu.origin.distance_to(s.get_bone_global_pose(l).origin) + s.get_bone_global_pose(l).origin.distance_to(s.get_bone_global_pose(h).origin)
		var bate: float = sin((ciclo * BATIDAS + (0.0 if lado > 0.0 else 0.5)) * TAU)
		# o joelho dobra na subida e estica no chute para baixo, como chicote
		var dobra: float = 0.07 * (0.5 + 0.5 * cos((ciclo * BATIDAS + (0.0 if lado > 0.0 else 0.5)) * TAU))
		var alvo: Vector3 = gu.origin - fr * comp * (0.97 - dobra) + ci * (bate * PERNA_BATE - 0.05) + di * lado * PERNA_ABRE
		var polo_j: Vector3 = -ci + fr * 0.2 # o joelho dobra um pouco para baixo
		if sapo > 0.001: # de peito: calcanhares para o bumbum, abre e chicoteia junto
			var kp: Array = _curva(PERNA_SAPO, cs)
			var alvo_s: Vector3 = gu.origin - fr * comp * float(kp[0]) + ci * float(kp[1]) + di * lado * float(kp[2])
			alvo = alvo.lerp(alvo_s, sapo)
			polo_j = polo_j.lerp(-ci * 0.3 + di * lado * 1.0 + fr * 0.2, sapo) # joelhos bem para fora (sapinho)
		if boia > 0.001: # pedalando em pé, cada pé num círculo, um ao contrário do outro
			var pb: float = (cb * 1.5 + (0.0 if lado > 0.0 else 0.5)) * TAU
			var alvo_b: Vector3 = gu.origin - ci * comp * 0.86 + fr * (BOIA_PEDALA * sin(pb) + 0.05) + di * lado * (0.1 + BOIA_PEDALA * 0.5 * cos(pb))
			alvo = alvo.lerp(alvo_b, boia)
			polo_j = polo_j.lerp(fr + di * lado * 0.3, boia) # joelho para a frente
		var r: Array = _ik(s, u, l, h, alvo, polo_j)
		var gl2: Transform3D = r[0]
		_apontar(s, h, gl2, s.get_bone_pose(dedo_o).origin, (-fr - ci * 0.25).lerp(fr * 0.6 - ci, boia), peso)

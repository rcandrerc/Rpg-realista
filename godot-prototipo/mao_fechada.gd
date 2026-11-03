extends SkeletonModifier3D
# Mão fechada em volta do cajado (pedido do André, 2026-11-03: "fechar a mão em volta do cajado"). As animações
# de magia vêm com a mão aberta, e o cajado ficava encostado na palma com os dedos esticados. Roda depois da
# animação e dobra os dedos da mão do cajado: os quatro dedos em volta do cabo e o polegar por cima deles.
# Serve para VRoid (J_Bip_R_Index1...) e para o soldado do Mixamo (RightHandIndex1...). peso 0 = animação pura.

var peso := 0.0
var _ossos := [] # [{"i": osso, "q": rotação da mão fechada (local)}]
var _mao := -1
var _lado_local := Vector3.ZERO # do indicador ao mindinho, no espaço do osso da mão
var _cima := Vector3.UP # quadril -> cabeça, espaço do esqueleto
var _polegar := [-1, -1, -1] # Thumb1, Thumb2 e o osso do indicador onde a ponta do polegar encosta
var _meio := [] # dedo do meio (1, 2, 3): o furo do punho fica no meio deles
const GIRO_MAO := 1.0 # quanto o pulso gira para o furo do punho ficar em pé (o cajado passa por dentro)

# quanto cada falange dobra (rad): 1ª, 2ª e 3ª. O mindinho fecha um pouco mais (a mão afunila no cabo).
const DOBRA := {"Index": [1.2, 1.35, 1.11], "Middle": [1.25, 1.4, 1.11], "Ring": [1.32, 1.42, 1.13], "Little": [1.38, 1.47, 1.16]} # mindinho ~10° a mais que o indicador; pontas escondidas atrás do cabo
const POLEGAR_GIRO := 0.0 # (o 1º osso do polegar é apontado a cada quadro, ver _polegar)
const POLEGAR_DOBRA := [0.0, 0.5, 0.55] # 2ª e 3ª juntas do polegar dobram por cima dos dedos (~30°)

# osso de um dedo da mesma mão (VRoid J_Bip_R_Hand -> J_Bip_R_Index1; Mixamo RightHand -> RightHandIndex1)
static func osso_dedo(esq: Skeleton3D, mao: int, dedo: String) -> int:
	var n := esq.get_bone_name(mao)
	var nomes := [dedo]
	if dedo.begins_with("Little"):
		nomes.append(dedo.replace("Little", "Pinky"))
	for d in nomes:
		for c in [n.replace("Hand", d), n + d, n.replace("_Hand", "_" + d)]:
			var i := esq.find_bone(c)
			if i >= 0 and i != mao:
				return i
	return -1

static func _osso_com(esq: Skeleton3D, parte: String) -> int:
	for i in esq.get_bone_count():
		if esq.get_bone_name(i).ends_with(parte):
			return i
	return -1

func preparar(esq: Skeleton3D, mao: int) -> void:
	_ossos.clear()
	if esq == null or mao < 0:
		return
	var o := func(i: int) -> Vector3: return esq.get_bone_global_rest(i).origin
	var i1 := osso_dedo(esq, mao, "Index1")
	var m1 := osso_dedo(esq, mao, "Middle1")
	var m2 := osso_dedo(esq, mao, "Middle2")
	var l1 := osso_dedo(esq, mao, "Little1")
	if l1 < 0:
		l1 = osso_dedo(esq, mao, "Ring1")
	if i1 < 0 or m1 < 0 or m2 < 0 or l1 < 0:
		return
	_mao = mao
	_meio = [m1, m2, osso_dedo(esq, mao, "Middle3")]
	_polegar = [osso_dedo(esq, mao, "Thumb1"), osso_dedo(esq, mao, "Thumb2"), osso_dedo(esq, mao, "Index2")]
	_lado_local = (esq.get_bone_global_rest(mao).basis.orthonormalized().inverse() * (o.call(l1) - o.call(i1))).normalized()
	# na pose de descanso (T) a palma fica para baixo: a normal da palma é a que aponta para longe da cabeça
	var cima := Vector3.UP
	var q := _osso_com(esq, "Hips")
	var c := _osso_com(esq, "Head")
	if q >= 0 and c >= 0:
		cima = (o.call(c) - o.call(q)).normalized()
	_cima = cima
	var dedos: Vector3 = (o.call(m2) - o.call(m1)).normalized()
	var palma: Vector3 = dedos.cross(o.call(l1) - o.call(i1)).normalized()
	if palma.dot(cima) > 0.0:
		palma = -palma
	for f in DOBRA:
		var ant := dedos
		for k in 3:
			var b := osso_dedo(esq, mao, "%s%d" % [f, k + 1])
			if b < 0:
				break
			var prox := osso_dedo(esq, mao, "%s%d" % [f, k + 2])
			var d: Vector3 = (o.call(prox) - o.call(b)).normalized() if prox >= 0 else ant
			ant = d
			_dobrar(esq, b, d.cross(palma), DOBRA[f][k])
	# polegar: vira por cima da palma e dobra na direção dos dedos
	var t1 := osso_dedo(esq, mao, "Thumb1")
	var t2 := osso_dedo(esq, mao, "Thumb2")
	if t1 >= 0 and t2 >= 0:
		var t: Vector3 = o.call(t2) - o.call(t1)
		var eixo := dedos
		if (t.rotated(eixo, absf(POLEGAR_GIRO)) - t).dot(palma) < 0.0:
			eixo = -eixo
		var rq := Quaternion(eixo, POLEGAR_GIRO)
		var ant: Vector3 = t.normalized()
		for k in 3:
			var b := osso_dedo(esq, mao, "Thumb%d" % (k + 1))
			if b < 0:
				break
			var prox := osso_dedo(esq, mao, "Thumb%d" % (k + 2))
			var d: Vector3 = (o.call(prox) - o.call(b)).normalized() if prox >= 0 else ant
			ant = d
			# a dobra é a mesma de um dedo (em volta de d x palma); no 1º osso vem depois do giro do polegar
			_dobrar(esq, b, d.cross(palma), POLEGAR_DOBRA[k], rq if k == 0 else Quaternion())

# guarda a rotação local do osso com a dobra em volta de "eixo" (espaço do esqueleto, pose de descanso)
func _dobrar(esq: Skeleton3D, b: int, eixo: Vector3, ang: float, antes := Quaternion()) -> void:
	if eixo.length() < 1e-5:
		return
	var g: Basis = esq.get_bone_global_rest(b).basis.orthonormalized()
	var rot := antes * Quaternion(eixo.normalized(), ang) # giro no espaço do esqueleto
	var local := g.inverse() * Basis(rot) * g # o mesmo giro visto de dentro do osso
	var r: Quaternion = esq.get_bone_rest(b).basis.get_rotation_quaternion() * local.get_rotation_quaternion()
	_ossos.append({"i": b, "q": r.normalized()})

func _process_modification() -> void:
	var s := get_skeleton()
	if s == null or _mao < 0:
		return
	if peso <= 0.001:
		s.set_meta("furo_mao_%d" % _mao, [Vector3.ZERO, 0.0])
		return
	# pulso: o furo do punho (do indicador ao mindinho) fica em pé, com o indicador em cima, como quem segura um
	# cajado com o braço solto: os dedos apontam para a frente e o cajado passa de cima a baixo por dentro da mão
	var pai := s.get_bone_parent(_mao)
	var gp: Transform3D = s.get_bone_global_pose(pai) if pai >= 0 else Transform3D()
	var gm: Basis = (gp * s.get_bone_pose(_mao)).basis
	var lado: Vector3 = (gm.orthonormalized() * _lado_local).normalized()
	var giro := Quaternion(lado, -_cima).slerp(Quaternion(), 1.0 - peso * GIRO_MAO) if lado.dot(-_cima) > -0.99 else Quaternion()
	var nova: Basis = Basis(giro) * gm.orthonormalized()
	s.set_bone_pose_rotation(_mao, (gp.basis.orthonormalized().inverse() * nova).get_rotation_quaternion())
	for b in _ossos:
		s.set_bone_pose_rotation(b.i, s.get_bone_pose_rotation(b.i).slerp(b.q, peso))
	# polegar (direção de arte): fecha por cima do cabo, apontando para a 2ª falange do indicador, nunca "joinha"
	if _polegar[0] >= 0 and _polegar[1] >= 0 and _polegar[2] >= 0:
		var t1: int = _polegar[0]
		var pt := s.get_bone_parent(t1)
		var gpt: Transform3D = s.get_bone_global_pose(pt) if pt >= 0 else Transform3D()
		var pose := s.get_bone_pose(t1)
		var g1 := gpt * pose
		var eixo: Vector3 = (g1.basis * s.get_bone_pose(_polegar[1]).origin).normalized()
		var i2: Vector3 = s.get_bone_global_pose(_polegar[2]).origin
		var i1: Vector3 = s.get_bone_global_pose(s.get_bone_parent(_polegar[2])).origin
		var alvo: Vector3 = (i1.lerp(i2, 0.6) - g1.origin).normalized() # ponta encosta no cabo, sem sair do outro lado
		if eixo.length() > 0.5 and alvo.length() > 0.5 and eixo.dot(alvo) > -0.99:
			var q := Quaternion(eixo, alvo).slerp(Quaternion(), 1.0 - peso)
			var nova1: Basis = Basis(q) * g1.basis.orthonormalized()
			s.set_bone_pose_rotation(t1, (gpt.basis.orthonormalized().inverse() * nova1).get_rotation_quaternion())
	# onde fica o furo do punho (espaço do esqueleto): Armas.palma põe o meio do cajado aqui
	if _meio[2] >= 0:
		var a: Vector3 = s.get_bone_global_pose(_meio[0]).origin
		var b2: Vector3 = s.get_bone_global_pose(_meio[1]).origin
		var c3: Vector3 = s.get_bone_global_pose(_meio[2]).origin
		var furo := (a + b2 + c3 + c3 + (c3 - b2) * 0.8) / 4.0
		s.set_meta("furo_mao_%d" % _mao, [furo, peso])

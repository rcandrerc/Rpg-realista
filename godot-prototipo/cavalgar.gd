extends SkeletonModifier3D
# Montado no lobo (montaria.gd), por cima da animação parada do herói. Roda depois do inclinar.gd e do braço da espada
# e antes das molas do cabelo (o cabelo atrasa sozinho quando a cabeça balança).
# - tronco agachado e deitado para a frente, pescoço levantando o rosto para olhar o caminho;
# - quadril na sela (entre o lombo e a cernelha do lobo), subindo e descendo no galope;
# - mãos fechadas na juba logo atrás das orelhas, cotovelos para fora e para baixo;
# - coxas abraçando as costelas, joelhos para a frente e pés para trás colados no flanco.
# Os alvos chegam em coordenadas do mundo (montaria.gd lê os ossos do lobo); aqui tudo vira espaço do esqueleto.
# Mesma pose do jogo HTML aprovada pela direção de arte (PR #41, client/src/personagens.js sentar/segurar/agarrar).

var sela := Vector3.ZERO # onde o quadril senta (mundo)
var pegada := [Vector3.ZERO, Vector3.ZERO] # [lado +x do lobo, lado -x]: ponto da juba de cada mão (mundo)
var pe := [Vector3.ZERO, Vector3.ZERO] # [lado +x do lobo, lado -x]: onde o pé fica no flanco (mundo)
var frente_lobo := Vector3.FORWARD # frente do lobo (mundo)
var lado_lobo := Vector3.RIGHT # +x do lobo (mundo)
var cima_lobo := Vector3.UP
# balanço do galope (montaria.gd calcula a fase): metros que o quadril sobe e radianos a mais no tronco e no pescoço
var pulo := 0.0
var tronco := 0.0
var pescoco := 0.0
var lombo := 0.0 # quanto o lombo do lobo está inclinado agora (rad): o quadril acompanha
var pronto := false

var _o := {} # nome curto -> índice do osso
var _cima := Vector3.UP
var _frente := Vector3.BACK
var _lado := Vector3.RIGHT # girar em volta dele com ângulo negativo leva o tronco para a frente (como no inclinar.gd)
var _dir := Vector3.RIGHT # direita da personagem
var _dedos := {} # osso da falange -> [eixo no espaço do pai (descanso), ângulo]
var _mao_a := [Vector3.ZERO, Vector3.ZERO] # direção dos dedos no espaço do osso da mão (descanso)
var _mao_b := [Vector3.ZERO, Vector3.ZERO] # direção da palma no espaço do osso da mão (descanso)

# radianos para a frente na coluna, no peito e no peito alto (o tronco fica ~60° deitado, como um jóquei) e para
# trás no pescoço e na cabeça (o rosto olha o caminho)
const DEITA := [0.85, 0.6, 0.25]
const LEVANTA := [0.85, 0.75]
const NOMES := {"quadril": "J_Bip_C_Hips", "coluna": "J_Bip_C_Spine", "peito": "J_Bip_C_Chest", "peito_alto": "J_Bip_C_UpperChest",
	"pescoco": "J_Bip_C_Neck", "cabeca": "J_Bip_C_Head"}

func preparar(esq: Skeleton3D) -> void:
	for k in NOMES:
		_o[k] = esq.find_bone(NOMES[k])
	for l in ["L", "R"]:
		for p in ["Shoulder", "UpperArm", "LowerArm", "Hand", "UpperLeg", "LowerLeg", "Foot", "ToeBase", "Middle1"]:
			_o[l + p] = esq.find_bone("J_Bip_%s_%s" % [l, p])
	if _o.quadril < 0 or _o.LUpperArm < 0 or _o.LUpperLeg < 0:
		return
	var p := func(i: int) -> Vector3: return esq.get_bone_global_rest(i).origin
	_cima = (p.call(_o.cabeca) - p.call(_o.quadril)).normalized()
	_dir = (p.call(_o.RUpperArm) - p.call(_o.LUpperArm)).normalized()
	_frente = _cima.cross(_dir).normalized()
	if (p.call(_o.RToeBase) - p.call(_o.RFoot)).dot(_frente) < 0.0:
		_frente = -_frente
	_lado = _frente.cross(_cima).normalized()
	# mão: dedos e palma no espaço do osso (na pose de descanso a palma olha para baixo)
	for i in 2:
		var l: String = ["L", "R"][i]
		var mao: int = _o[l + "Hand"]
		var rb: Basis = esq.get_bone_global_rest(mao).basis.orthonormalized()
		var a: Vector3 = (p.call(_o[l + "Middle1"]) - p.call(mao)).normalized()
		var b: Vector3 = (-_cima - a * (-_cima).dot(a)).normalized()
		_mao_a[i] = rb.inverse() * a
		_mao_b[i] = rb.inverse() * b
		# falanges fecham para a palma (cada uma ~70°); o polegar fecha por cima
		var dobra := a.cross(b).normalized()
		for dedo in ["Index", "Middle", "Ring", "Little"]:
			var g := [1.2, 1.25, 1.0]
			for n in 3:
				_dedo(esq, "J_Bip_%s_%s%d" % [l, dedo, n + 1], dobra, g[n])
		var polegar := -_dir # no descanso o polegar aponta para a frente: girar em volta da esquerda leva para a palma
		var gp := [0.55, 0.75, 0.7]
		for n in 3:
			_dedo(esq, "J_Bip_%s_Thumb%d" % [l, n + 1], polegar, gp[n])
	pronto = true

func _dedo(esq: Skeleton3D, nome: String, eixo_esq: Vector3, ang: float) -> void:
	var i := esq.find_bone(nome)
	if i < 0:
		return
	var pai := esq.get_bone_parent(i)
	var eixo: Vector3 = (esq.get_bone_global_rest(pai).basis.orthonormalized().inverse() * eixo_esq).normalized()
	_dedos[i] = [eixo, ang]

func _girar(s: Skeleton3D, osso: int, eixo_esq: Vector3, ang: float) -> void:
	if osso < 0 or abs(ang) < 0.0005:
		return
	var pai := s.get_bone_global_pose(s.get_bone_parent(osso))
	var eixo := (pai.basis.orthonormalized().inverse() * eixo_esq).normalized()
	s.set_bone_pose_rotation(osso, Quaternion(eixo, ang) * s.get_bone_pose_rotation(osso))

# gira o osso (em volta da sua origem) para "de" virar "para" (os dois no espaço do esqueleto)
func _arco(s: Skeleton3D, osso: int, de: Vector3, para: Vector3) -> void:
	if de.length() < 1e-5 or para.length() < 1e-5:
		return
	var pai := s.get_bone_global_pose(s.get_bone_parent(osso)).basis.orthonormalized()
	var g := pai * Basis(s.get_bone_pose_rotation(osso))
	var nova := Basis(Quaternion(de.normalized(), para.normalized())) * g
	s.set_bone_pose_rotation(osso, (pai.inverse() * nova).get_rotation_quaternion())

# dois ossos (ombro-cotovelo-mão ou coxa-joelho-pé) até o alvo, com o meio apontando para o lado do polo
func _alcancar(s: Skeleton3D, sup: int, inf: int, fim: int, alvo: Vector3, polo: Vector3) -> void:
	var gs := s.get_bone_global_pose(sup)
	var gi := s.get_bone_global_pose(inf)
	var gf := s.get_bone_global_pose(fim)
	var S := gs.origin
	var L1 := gs.origin.distance_to(gi.origin)
	var L2 := gi.origin.distance_to(gf.origin)
	var D := alvo - S
	var d: float = clamp(D.length(), 1e-4, (L1 + L2) * 0.995)
	D = D.normalized()
	var a: float = (L1 * L1 - L2 * L2 + d * d) / (2.0 * d)
	var hh: float = sqrt(max(0.0, L1 * L1 - a * a))
	var P := (polo - D * polo.dot(D)).normalized()
	var E := S + D * a + P * hh # cotovelo / joelho
	_arco(s, sup, gi.origin - S, E - S)
	gi = s.get_bone_global_pose(inf)
	gf = s.get_bone_global_pose(fim)
	_arco(s, inf, gf.origin - gi.origin, (S + D * d) - gi.origin)

# mão fechada na juba: dedos para a frente e para baixo, palma virada para o pescoço do lobo
func _agarrar(s: Skeleton3D, i: int, fr: Vector3, lat: Vector3, cm: Vector3, dentro: float) -> void:
	var mao: int = _o[["L", "R"][i] + "Hand"]
	var F := (lat * dentro * 0.3 - cm * 0.6 + fr * 0.7).normalized()
	var Pn := (lat * dentro - cm * 0.2 + fr * 0.5)
	Pn = (Pn - F * Pn.dot(F)).normalized()
	var a: Vector3 = _mao_a[i]
	var b: Vector3 = _mao_b[i]
	var M := Basis(a, b, a.cross(b))
	var M2 := Basis(F, Pn, F.cross(Pn))
	var quer := M2 * M.inverse() # base do osso da mão no espaço do esqueleto
	var pai := s.get_bone_global_pose(s.get_bone_parent(mao)).basis.orthonormalized()
	s.set_bone_pose_rotation(mao, (pai.inverse() * quer).get_rotation_quaternion())

func _process_modification() -> void:
	var s := get_skeleton()
	if s == null or not pronto:
		return
	var inv := s.global_transform.affine_inverse()
	var ib := inv.basis
	var fr: Vector3 = (ib * frente_lobo).normalized()
	var lat: Vector3 = (ib * lado_lobo).normalized()
	var cm: Vector3 = (ib * cima_lobo).normalized()
	# tronco agachado para a frente (a coluna e o peito curvam; o pescoço e a cabeça levantam o rosto)
	_girar(s, _o.coluna, _lado, -(DEITA[0] + tronco * 0.6))
	_girar(s, _o.peito, _lado, -(DEITA[1] + tronco * 0.4))
	_girar(s, _o.peito_alto, _lado, -DEITA[2])
	_girar(s, _o.pescoco, _lado, LEVANTA[0] + pescoco * 0.6)
	_girar(s, _o.cabeca, _lado, LEVANTA[1] + pescoco * 0.4)
	# ombros puxados para a frente (os braços esticam até o pescoço do lobo)
	_girar(s, _o.LShoulder, _cima, 0.3)
	_girar(s, _o.RShoulder, _cima, -0.3)
	# quadril: acompanha a inclinação do lombo e vai para a sela (o corpo todo vem junto)
	_girar(s, _o.quadril, _lado, lombo)
	var q: int = _o.quadril
	var pq := s.get_bone_parent(q)
	var gpai := s.get_bone_global_pose(pq) if pq >= 0 else Transform3D()
	var quer: Vector3 = inv * sela + _cima * pulo
	var agora := s.get_bone_global_pose(q).origin
	s.set_bone_pose_position(q, s.get_bone_pose_position(q) + gpai.basis.inverse() * (quer - agora))
	# pernas: coxas abraçando as costelas, joelho para a frente e para baixo, pé para trás no flanco
	for i in 2:
		var l: String = ["L", "R"][i]
		var sup: int = _o[l + "UpperLeg"]
		var ls: float = signf((s.get_bone_global_pose(sup).origin - inv * sela).dot(lat))
		if ls == 0.0:
			ls = 1.0 if i == 0 else -1.0
		var polo: Vector3 = fr - cm * 0.5 + lat * ls * 0.3
		_alcancar(s, sup, _o[l + "LowerLeg"], _o[l + "Foot"], inv * pe[0 if ls > 0.0 else 1], polo)
		# pé esticado para trás, na linha da barriga
		var gf := s.get_bone_global_pose(_o[l + "Foot"])
		var gt := s.get_bone_global_pose(_o[l + "ToeBase"])
		_arco(s, _o[l + "Foot"], gt.origin - gf.origin, -fr * 0.9 - cm * 0.35 + lat * ls * 0.1)
	# braços: mãos na juba, cotovelos para fora e para baixo (nunca para dentro do tronco)
	var peito := s.get_bone_global_pose(_o.peito_alto if _o.peito_alto >= 0 else _o.peito).origin
	for i in 2:
		var l: String = ["L", "R"][i]
		var sup: int = _o[l + "UpperArm"]
		var S := s.get_bone_global_pose(sup).origin
		var ls: float = signf((S - peito).dot(lat))
		if ls == 0.0:
			ls = 1.0 if i == 0 else -1.0
		var polo: Vector3 = (S - peito).normalized() - cm * 0.7
		_alcancar(s, sup, _o[l + "LowerArm"], _o[l + "Hand"], inv * pegada[0 if ls > 0.0 else 1], polo)
		_agarrar(s, i, fr, lat, cm, -ls)
	for osso in _dedos:
		var d: Array = _dedos[osso]
		s.set_bone_pose_rotation(osso, Quaternion(d[0], d[1]) * s.get_bone_rest(osso).basis.get_rotation_quaternion())

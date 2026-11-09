extends "res://cavalgar.gd"
# Sentado no carrinho e no barquinho (transporte.gd), por cima da animação parada (André 2026-11-09: "o personagem
# fica sentado pilotando", "sentado segurando um remo", nada de andar em pé em cima do veículo).
# Usa as contas do cavalgar.gd (dois ossos até o alvo, mão fechada, dedos): aqui o tronco fica quase de pé,
# o quadril no banco, as coxas para a frente com o joelho para cima e os pés no assoalho; as mãos vão no volante do
# carrinho ou no cabo do remo. Os alvos chegam em coordenadas do mundo (transporte.gd lê do modelo do veículo):
# sela = banco, pe = assoalho, pegada = mãos; frente_lobo/lado_lobo/cima_lobo = frente, lado e cima do veículo.

var deita := 0.06 # tronco para a frente (rad); remando vai e volta
var torce := 0.0 # tronco girando em volta da coluna (rad); remando acompanha o lado do remo

func _process_modification() -> void:
	var s := get_skeleton()
	if s == null or not pronto:
		return
	var inv := s.global_transform.affine_inverse()
	var ib := inv.basis
	var fr: Vector3 = (ib * frente_lobo).normalized()
	var lat: Vector3 = (ib * lado_lobo).normalized()
	var cm: Vector3 = (ib * cima_lobo).normalized()
	# tronco quase de pé (um pouco para a frente) e o rosto olhando o caminho
	_girar(s, _o.coluna, _lado, -deita * 0.6)
	_girar(s, _o.peito, _lado, -deita * 0.4)
	_girar(s, _o.pescoco, _lado, deita * 0.5)
	_girar(s, _o.coluna, _cima, torce * 0.55)
	_girar(s, _o.peito, _cima, torce * 0.45)
	_girar(s, _o.cabeca, _cima, -torce * 0.7) # a cabeça continua olhando para a frente
	# quadril no banco (o corpo todo vem junto)
	var q: int = _o.quadril
	var pq := s.get_bone_parent(q)
	var gpai := s.get_bone_global_pose(pq) if pq >= 0 else Transform3D()
	var agora := s.get_bone_global_pose(q).origin
	s.set_bone_pose_position(q, s.get_bone_pose_position(q) + gpai.basis.inverse() * (inv * sela - agora))
	# pernas: coxa para a frente, joelho para cima, pé no assoalho com a ponta para a frente
	for i in 2:
		var l: String = ["L", "R"][i]
		var sup: int = _o[l + "UpperLeg"]
		var ls: float = signf((s.get_bone_global_pose(sup).origin - inv * sela).dot(lat))
		if ls == 0.0:
			ls = 1.0 if i == 0 else -1.0
		var polo: Vector3 = fr + cm * 0.7 + lat * ls * 0.15
		_alcancar(s, sup, _o[l + "LowerLeg"], _o[l + "Foot"], inv * pe[0 if ls > 0.0 else 1], polo)
		var gf := s.get_bone_global_pose(_o[l + "Foot"])
		var gt := s.get_bone_global_pose(_o[l + "ToeBase"])
		_arco(s, _o[l + "Foot"], gt.origin - gf.origin, fr * 0.95 - cm * 0.25)
	# braços: mãos no volante ou no remo, cotovelos para baixo e um pouco para fora
	var peito := s.get_bone_global_pose(_o.peito_alto if _o.peito_alto >= 0 else _o.peito).origin
	for i in 2:
		var l: String = ["L", "R"][i]
		var sup: int = _o[l + "UpperArm"]
		var S := s.get_bone_global_pose(sup).origin
		var ls: float = signf((S - peito).dot(lat))
		if ls == 0.0:
			ls = 1.0 if i == 0 else -1.0
		var polo: Vector3 = (S - peito).normalized() * 0.5 - cm
		_alcancar(s, sup, _o[l + "LowerArm"], _o[l + "Hand"], inv * pegada[0 if ls > 0.0 else 1], polo)
		_agarrar(s, i, fr, lat, cm, -ls)
	for osso in _dedos:
		var d: Array = _dedos[osso]
		s.set_bone_pose_rotation(osso, Quaternion(d[0], d[1]) * s.get_bone_rest(osso).basis.get_rotation_quaternion())

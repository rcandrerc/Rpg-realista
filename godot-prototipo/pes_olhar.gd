extends "res://cavalgar.gd"
# Plano de animações, passo 4 (André 2026-11-25, "seguir"): pés no chão e olhar, nos corpos de outros (NPCs, bots,
# recrutas e outros jogadores) que estão entre os mais perto da câmera (online.gd _aplicar_detalhe, nível cheio).
# - Pés: a animação foi feita em chão reto. Em ladeira, degrau, beira de lago ou escada, um pé ficava enterrado e o
#   outro no ar. Aqui cada pé sobe ou desce o tanto que o chão embaixo dele difere do chão embaixo do corpo
#   (terreno.gd altura, a mesma conta do servidor), o quadril desce o do pé mais baixo e as pernas dobram até lá
#   (duas juntas, joelho para a frente). O pé mantém o giro da animação. Em chão reto não faz nada.
# - Olhar: perto do herói (OLHAR_PERTO m) e com o herói na frente, a cabeça vira para ele (40% pescoço, 60% cabeça),
#   entrando e saindo devagar. Quem está de costas não torce o pescoço.
# Roda depois do inclinar/braço e antes das molas do cabelo (o cabelo acompanha a cabeça). Desligado sentado,
# montado, nadando ou caído (online.gd decide).

const PE_MAX := 0.35 # m: degrau maior que isso é escada/pulo, não ajusta
const PE_MIN := 0.012 # m: diferença menor que isso é chão reto (nada a fazer)
const OLHAR_PERTO := 5.0
const OLHAR_MAX := 1.05 # rad: o máximo que pescoço + cabeça viram
const OLHAR_DE_COSTAS := 1.75 # rad: herói mais atrás que isso, não olha

var T # terreno.gd
var alvo_olhar = null # Vector3 no mundo (a cabeça do herói) ou null
var olhar_ligado := true
var pes_ligado := true
var _olhar_k := 0.0 # 0..1, entra e sai devagar
var _olhar_a := 0.0 # ângulo atual (suavizado)
var _ult_us := 0

func _process_modification() -> void:
	var s := get_skeleton()
	if s == null or not pronto or T == null:
		return
	var agora := Time.get_ticks_usec()
	var dt: float = clampf((agora - _ult_us) / 1000000.0, 0.0, 0.1) if _ult_us > 0 else 0.016
	_ult_us = agora
	var G := s.global_transform
	var inv := G.affine_inverse()
	if pes_ligado:
		_pes(s, G, inv)
	_olhar(s, G, inv, dt)

func _pes(s: Skeleton3D, G: Transform3D, inv: Transform3D) -> void:
	var base: Vector3 = G.origin
	var h0: float = T.altura(base.x, base.z, base.y + 0.6)
	var d := [0.0, 0.0]
	var pw := [Vector3.ZERO, Vector3.ZERO]
	var algum := false
	for i in 2:
		var l: String = ["L", "R"][i]
		pw[i] = G * s.get_bone_global_pose(_o[l + "Foot"]).origin
		var h: float = T.altura(pw[i].x, pw[i].z, pw[i].y + 0.6)
		var di: float = h - h0
		if absf(di) > PE_MAX:
			di = 0.0
		d[i] = di
		if absf(di) > PE_MIN:
			algum = true
	if not algum:
		return
	var ib := inv.basis
	var cima_s: Vector3 = (ib * Vector3.UP).normalized()
	# quadril desce o tanto do pé mais baixo (senão a perna não alcança o chão que desceu)
	var desce: float = minf(minf(d[0], d[1]), 0.0)
	if desce < 0.0:
		var q: int = _o.quadril
		var pq := s.get_bone_parent(q)
		var gpai := s.get_bone_global_pose(pq) if pq >= 0 else Transform3D()
		s.set_bone_pose_position(q, s.get_bone_pose_position(q) + gpai.basis.inverse() * (cima_s * desce * ib.get_scale().y))
	for i in 2:
		var l: String = ["L", "R"][i]
		var pe_i: int = _o[l + "Foot"]
		var giro_pe: Basis = s.get_bone_global_pose(pe_i).basis.orthonormalized()
		var alvo: Vector3 = inv * (pw[i] + Vector3.UP * d[i])
		var polo: Vector3 = _frente + _cima * 0.1
		_alcancar(s, _o[l + "UpperLeg"], _o[l + "LowerLeg"], pe_i, alvo, polo)
		# o pé fica com o giro que a animação deu (a perna dobrou, o pé não vira junto)
		var pai: Basis = s.get_bone_global_pose(s.get_bone_parent(pe_i)).basis.orthonormalized()
		s.set_bone_pose_rotation(pe_i, (pai.inverse() * giro_pe).get_rotation_quaternion())

func _olhar(s: Skeleton3D, G: Transform3D, inv: Transform3D, dt: float) -> void:
	var quer := 0.0
	var k_alvo := 0.0
	if olhar_ligado and alvo_olhar is Vector3:
		var cab: Vector3 = G * s.get_bone_global_pose(_o.cabeca).origin
		var para: Vector3 = alvo_olhar - cab
		if para.length() < OLHAR_PERTO:
			var p_s: Vector3 = inv.basis * para
			p_s -= _cima * p_s.dot(_cima)
			if p_s.length() > 0.05:
				# frente do corpo agora (depois da animação: o quadril pode estar virado)
				var fr: Vector3 = s.get_bone_global_pose(_o.peito).basis.orthonormalized() * (s.get_bone_global_rest(_o.peito).basis.orthonormalized().inverse() * _frente)
				fr -= _cima * fr.dot(_cima)
				var ang: float = fr.normalized().signed_angle_to(p_s.normalized(), _cima)
				if absf(ang) < OLHAR_DE_COSTAS:
					quer = clampf(ang, -OLHAR_MAX, OLHAR_MAX)
					k_alvo = 1.0
	_olhar_k = move_toward(_olhar_k, k_alvo, dt * 1.6)
	_olhar_a = lerpf(_olhar_a, quer, clampf(dt * 5.0, 0.0, 1.0))
	if _olhar_k <= 0.001:
		return
	var a: float = _olhar_a * _olhar_k
	_girar(s, _o.pescoco, _cima, a * 0.4)
	_girar(s, _o.cabeca, _cima, a * 0.6)

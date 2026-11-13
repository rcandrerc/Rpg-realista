extends Node
# Travada na primeira skill (André 2026-11-12: "quando eu chego num spot de mobs e dou a primeira skill, geralmente dá
# uma travada. Depois ele vai se acomodando"). Cada efeito (shader próprio, partículas, número de dano) e cada tipo de
# monstro (shader do monstro, contorno, nome) é montado na placa de vídeo na primeira vez que aparece na tela. Medido
# no Godot 4.5 (Vulkan, renderizador mobile): 0,2 a 1,1 s no primeiro uso de cada skill, uns 20 ms do segundo em diante.
# Aqui tudo isso aparece uma vez, na frente da câmera, enquanto a capa ("Conectando…") ainda cobre a tela; depois some.
# A capa espera acabar (online.gd aplicar_foto) e o tempo de espera do servidor não conta enquanto isso.

const ESPERA_INICIO := 0.3 # s depois de abrir: o jogo termina de montar a vila
const QUADROS_NA_TELA := 3 # quadros desenhados com tudo junto (o primeiro já compila; os outros garantem)
const SUMIDO := 2.0 # s com os efeitos escondidos até acabarem sozinhos (a capa já pode sair)

var m # main.gd
var rodando := false
var cobre := false # a capa espera (online.gd): só enquanto os efeitos estão na tela
var feito := false
var _fase := 0
var _t := 0.0
var _quadros := 0
var _corpo: Node3D
var _mobs: Array = []
var _volume := 0.0

func _init(principal) -> void:
	m = principal

func comecar() -> void:
	if feito or rodando:
		return
	rodando = true
	cobre = true
	_fase = 0
	_t = 0.0

func _process(dt: float) -> void:
	if not rodando:
		return
	_t += dt
	match _fase:
		0:
			if _t >= ESPERA_INICIO:
				_mostrar_tudo()
				_fase = 1
				_quadros = 0
		1:
			_quadros += 1
			if _quadros >= QUADROS_NA_TELA:
				m.fx.visible = false # o que ainda está terminando não aparece quando a capa sair
				for no in _mobs:
					if is_instance_valid(no):
						no.queue_free()
				_mobs.clear()
				m.combate.aviso_area_fim()
				_t = 0.0
				_fase = 2
				cobre = false
		2:
			if _t >= SUMIDO:
				m.fx.visible = true
				if is_instance_valid(_corpo):
					_corpo.queue_free()
				if m.sons:
					m.sons.volume_geral = _volume
				rodando = false
				feito = true

func _mostrar_tudo() -> void:
	var cam := m.get_viewport().get_camera_3d() as Camera3D
	if cam == null or m.fx == null:
		rodando = false
		cobre = false
		feito = true
		return
	if m.sons: # sem som: ninguém ouve as skills atrás da capa
		_volume = m.sons.volume_geral
		m.sons.volume_geral = -80.0
	var fx = m.fx
	var frente := -cam.global_basis.z
	frente.y = 0.0
	frente = frente.normalized() if frente.length() > 0.01 else Vector3(0, 0, -1)
	var p: Vector3 = cam.global_position + frente * 7.0
	p.y = cam.global_position.y - 1.6
	var x := p.x
	var z := p.z
	var y := p.y
	_corpo = Node3D.new()
	m.add_child(_corpo)
	_corpo.global_position = p
	var maos := func(): return [p + Vector3(0, 1.2, 0)]
	# skills de espada e de cajado (o círculo/carga e a explosão de cada uma), golpe comum e números de dano
	for k in ["relampago", "giro", "salto", "esmagar", "pisao", "investida", "bola", "explosao", "meteoros", "cura", "raio", "magia", "gelo", "escudo", "vortice"]:
		fx.conjura(_corpo, k, 0.4, maos)
		fx.explosao_hab(k, x, z, 3.0, y, 0.3)
	fx.impacto(x, z, 0.3, "investida", y)
	fx.impacto(x, z, 0.3, "golpe", y)
	fx.marca_corte(p + Vector3(0, 1.0, 0), 0.3, false)
	fx.marca_corte(p + Vector3(0, 1.0, 0), 0.3, true)
	if fx.gp:
		fx.gp.acerto(p + Vector3(0, 1.0, 0), 0.3, false)
		fx.gp.acerto(p + Vector3(0, 1.0, 0), 0.3, true)
	fx.raio(x, z, y)
	fx.vortice(x, z, 3.0, y)
	fx.meteoro(x, z, 3.0, 0.3, y, func(_p): pass)
	fx.cadeia(p + Vector3(-1, 1, 0), p + Vector3(1, 1, 0))
	fx.cura(_corpo)
	fx.escudo(_corpo, 0.4)
	fx.status(_corpo, "congela", 0.4)
	fx.status(_corpo, "atordoa", 0.4)
	fx.dash(_corpo, 0.3, true)
	fx.fumaca_chao(x, z, 2.0, 6)
	fx.poeira(x, z, 1.0, 6, "b8ab95", "7a6f60")
	fx.numero(p, 123, Color(1, 0.95, 0.6), false)
	fx.numero(p, 456, Color(1, 0.72, 0.25), true)
	fx.texto(p, "Esquiva!", Color(0.7, 0.95, 1.0))
	# um monstro de cada tipo, com o preparo do golpe (brilho e arco no chão), o "Firme!" e o aviso de área do chefe
	var tipos := {}
	for t in m.MODELO_TIPO.values():
		tipos[t] = true
	var i := 0
	for t in tipos:
		var e: Dictionary = m.criar_inimigo(t, p + frente.cross(Vector3.UP) * (float(i) - tipos.size() * 0.5) * 1.5, "Nv 1")
		m.inimigos.erase(e) # não entra na lista (o v de cada monstro é o do servidor)
		_mobs.append(e.no)
		if i == 0:
			m.combate.preparo(e.no, 0.4)
			m.combate.firme(e.no, 0.4)
			m.combate.reacao(e.no, p)
			m.combate.aviso_area(e.no, 3.0, 0.4, Color(1, 0.3, 0.2))
		i += 1
	# gente das mini vilas (corrida de lobo, André 2026-11-13: "a primeira vez travou, depois não travou mais"). O NPC
	# de vila só nasce de perto (npcs_das_vilas), e o primeiro de cada corpo e roupa montava tudo na hora: carregar o
	# modelo (~0,6 s no PC), a pele, as peças da armadura e a roupa de ofício (até ~0,7 s). Aqui, atrás da capa, nasce e
	# some um de cada tipo: o que é montado fica guardado e, na corrida, o NPC sai pronto. Medido na corrida simulada:
	# pior tranco 690 -> 72 ms no PC; a capa fica ~1,7 s mais (35 tipos).
	var vistos := {}
	var t0 := Time.get_ticks_usec()
	for info in m.npcs_vila:
		var id := str(m.MODELO_NPC.get(str(info.get("id", "")), str(info.get("visual", "vivi"))))
		var k := id
		for c in ["roupa", "veste", "friso", "anciao", "oficio", "limpar_rosto", "arma"]: # o que muda o que é montado
			k += "|" + JSON.stringify(info.get(c, ""))
		if vistos.has(k):
			continue
		vistos[k] = true
		var antes: int = m.npcs.size()
		m.criar_npc(id, Vector3(float(info.x), 0, float(info.z)), "", info)
		if m.npcs.size() > antes:
			var n: Dictionary = m.npcs.pop_back()
			n.no.visible = false
			n.no.queue_free()
	print_verbose("aquecer: %d tipos de NPC em %d ms" % [vistos.size(), (Time.get_ticks_usec() - t0) / 1000])

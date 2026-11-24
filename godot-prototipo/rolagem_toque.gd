extends Node
# Rolar qualquer lista arrastando o dedo, estilo Instagram (André 2026-11-24: leilão, chat e o resto só rolavam
# acertando a barrinha). Vale para todo ScrollContainer do jogo: o dedo encosta em qualquer lugar da lista (linha,
# botão, texto), arrasta e a lista segue; ao soltar ela continua deslizando e freia sozinha (inércia).
# Toque curto continua sendo toque: só vira arrasto depois de ZONA_MORTA px. Quando vira, o botão embaixo do dedo
# não dispara (o soltar é levado para fora da tela, o botão solta sem valer).
# A barra continua lá para o PC (e a roda do mouse). Encostar na barra usa a barra, como antes.
# Listas que já têm arrasto próprio (menu.gd, criador.gd, baú do construcao.gd) levam a meta "arrasto_proprio":
# este nó não mexe nelas, só dá a inércia quando elas chamam inercia().

const ZONA_MORTA := 10.0 # px até virar arrasto
const FREIO := 3.2 # quanto maior, mais rápido a lista para depois de soltar
const VEL_MAX := 5000.0 # px/s
const VEL_MIN := 25.0
const FORA := Vector2(-100000, -100000)

var _sc: ScrollContainer = null # lista sob o dedo
var _vertical := true
var _dedo := -1
var _soma := 0.0
var _arrastando := false
var _cancelar_mouse := false # o soltar do mouse (que o Android cria do toque) ainda vai chegar
var _cancelar_toque := false
var _saida: InputEventMouseMotion = null
var _soltando_botao := false
var _amostras: Array = [] # [ms, deslocamento] dos últimos movimentos, para a velocidade ao soltar
var _pos := 0.0 # posição em float (scroll_vertical é inteiro)
# inércia: lista -> [velocidade px/s, vertical?, posição float]
var _deslizando := {}

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	Engine.set_meta("rolagem_toque", self) # menu.gd, criador.gd e construcao.gd pedem a inércia por aqui
	get_tree().node_added.connect(_novo_no)
	for n in get_tree().root.find_children("*", "ScrollContainer", true, false):
		_novo_no(n)

func _novo_no(n: Node) -> void:
	if n is ScrollContainer:
		n.add_to_group("rolagem_toque")
		# o arrasto nativo do Godot só pega no fundo vazio e somaria com o daqui: fica com este
		(func(): if is_instance_valid(n) and not n.has_meta("arrasto_proprio"): n.scroll_deadzone = 1000000).call_deferred()

# lista que pode rolar sob o ponto: a de cima na tela (camada maior; empate, a que vem depois na árvore = desenhada por cima / mais por dentro)
func _lista_em(p: Vector2) -> ScrollContainer:
	var melhor: ScrollContainer = null
	var melhor_camada := -999999
	for n in get_tree().get_nodes_in_group("rolagem_toque"):
		var sc := n as ScrollContainer
		if sc == null or not sc.is_visible_in_tree():
			continue
		if not sc.get_global_rect().has_point(p) or not _pode_rolar(sc):
			continue
		var camada := _camada(sc)
		if melhor == null or camada > melhor_camada or (camada == melhor_camada and sc.is_greater_than(melhor)):
			melhor = sc
			melhor_camada = camada
	if melhor != null and melhor.has_meta("arrasto_proprio"):
		return null # a de cima já rola sozinha (menu.gd etc.): não mexe na de baixo
	return melhor

static func _camada(n: Node) -> int:
	var p := n.get_parent()
	while p != null:
		if p is CanvasLayer:
			return (p as CanvasLayer).layer
		p = p.get_parent()
	return 0

static func _pode_rolar(sc: ScrollContainer) -> bool:
	return _sobra(sc, true) > 0.5 or _sobra(sc, false) > 0.5

static func _sobra(sc: ScrollContainer, vertical: bool) -> float:
	if vertical:
		if sc.vertical_scroll_mode == ScrollContainer.SCROLL_MODE_DISABLED:
			return 0.0
		var vb := sc.get_v_scroll_bar()
		return vb.max_value - vb.page
	if sc.horizontal_scroll_mode == ScrollContainer.SCROLL_MODE_DISABLED:
		return 0.0
	var hb := sc.get_h_scroll_bar()
	return hb.max_value - hb.page

func _input(ev: InputEvent) -> void:
	# soltar do mouse depois de um arrasto: leva para fora, o botão solta sem disparar
	if ev is InputEventMouseButton and ev.button_index == MOUSE_BUTTON_LEFT:
		if not ev.pressed and (_cancelar_mouse or _arrastando):
			_cancelar_mouse = false
			ev.position = FORA
			ev.global_position = FORA
		return
	if ev is InputEventMouseMotion and _arrastando:
		if _soltando_botao:
			return # o "dedo saiu do botão" que este nó mandou: passa para o botão soltar sem valer
		get_viewport().set_input_as_handled() # nada embaixo do dedo reage enquanto a lista anda
		return
	if ev is InputEventScreenTouch:
		if ev.pressed:
			if _dedo != -1 and ev.index != _dedo: # segundo dedo: larga a lista (pinça/zoom ficam com quem já tem)
				_largar(false)
				return
			_deslizando.clear() # encostou: a lista que deslizava para na hora (como no Instagram)
			_cancelar_mouse = false
			_cancelar_toque = false
			_sc = _lista_em(ev.position)
			if _sc == null:
				return
			var barra: ScrollBar = _sc.get_v_scroll_bar()
			if barra.visible and barra.get_global_rect().has_point(ev.position):
				_sc = null # dedo na barra: a barra rola, como antes
				return
			_dedo = ev.index
			_soma = 0.0
			_arrastando = false
			_amostras.clear()
			_vertical = _sobra(_sc, true) > 0.5
			_pos = float(_sc.scroll_vertical if _vertical else _sc.scroll_horizontal)
		elif ev.index == _dedo or _cancelar_toque:
			if _arrastando or _cancelar_toque:
				_cancelar_toque = false
				ev.position = FORA
			_largar(true)
		return
	if ev is InputEventScreenDrag and ev.index == _dedo and is_instance_valid(_sc):
		var d: float = ev.relative.y if _vertical else ev.relative.x
		if not _arrastando:
			_soma += absf(d)
			if _soma < ZONA_MORTA:
				return
			# o dedo caiu numa janela por cima da lista (caixa de confirmar etc.)? então não é dela
			var sob := get_viewport().gui_get_hovered_control()
			if sob != null and sob != _sc and not _sc.is_ancestor_of(sob):
				_largar(false)
				return
			_arrastando = true
			_cancelar_mouse = true
			_cancelar_toque = true
			# o botão só dispara se o dedo solta "dentro" dele: avisa que o dedo saiu (ele volta ao normal na hora)
			_saida = InputEventMouseMotion.new()
			_saida.position = FORA
			_saida.global_position = FORA
			_saida.button_mask = MOUSE_BUTTON_MASK_LEFT
			var vp := get_viewport()
			var saida := _saida
			(func():
				if is_instance_valid(vp):
					_soltando_botao = true
					vp.push_input(saida)
					_soltando_botao = false).call_deferred()
		_mover(_sc, d)
		_amostras.append([Time.get_ticks_msec(), d])
		while _amostras.size() > 0 and Time.get_ticks_msec() - int(_amostras[0][0]) > 100:
			_amostras.pop_front()
		get_viewport().set_input_as_handled()

func _mover(sc: ScrollContainer, d: float) -> void:
	_pos = clampf(_pos - d, 0.0, maxf(0.0, _sobra(sc, _vertical)))
	if _vertical:
		sc.scroll_vertical = int(round(_pos))
	else:
		sc.scroll_horizontal = int(round(_pos))

func _largar(com_inercia: bool) -> void:
	if com_inercia and _arrastando and is_instance_valid(_sc) and _amostras.size() > 0 \
			and Time.get_ticks_msec() - int(_amostras[-1][0]) < 80:
		var soma := 0.0
		for a in _amostras:
			soma += float(a[1])
		var dt := maxf(0.016, float(Time.get_ticks_msec() - int(_amostras[0][0])) / 1000.0)
		_deslizar(_sc, soma / dt, _vertical, _pos)
	_sc = null
	_dedo = -1
	_arrastando = false
	_amostras.clear()

func _deslizar(sc: ScrollContainer, vel: float, vertical: bool, pos: float) -> void:
	vel = clampf(vel, -VEL_MAX, VEL_MAX)
	if absf(vel) > VEL_MIN:
		_deslizando[sc] = [vel, vertical, pos]

# para as listas com arrasto próprio: anotar() a cada movimento do dedo, inercia() ao soltar
var _proprio_amostras: Array = []
func anotar(d: float) -> void:
	_deslizando.clear()
	_proprio_amostras.append([Time.get_ticks_msec(), d])
	while _proprio_amostras.size() > 0 and Time.get_ticks_msec() - int(_proprio_amostras[0][0]) > 100:
		_proprio_amostras.pop_front()

func inercia(sc: ScrollContainer) -> void:
	var a := _proprio_amostras
	_proprio_amostras = []
	if sc == null or a.is_empty() or Time.get_ticks_msec() - int(a[-1][0]) >= 80:
		return
	var soma := 0.0
	for x in a:
		soma += float(x[1])
	var dt := maxf(0.016, float(Time.get_ticks_msec() - int(a[0][0])) / 1000.0)
	_deslizar(sc, soma / dt, true, float(sc.scroll_vertical))

func esquecer() -> void: # encostou de novo numa lista com arrasto próprio
	_proprio_amostras.clear()
	_deslizando.clear()

func _process(dt: float) -> void:
	if _deslizando.is_empty():
		return
	for sc in _deslizando.keys():
		var e: Array = _deslizando[sc]
		if not is_instance_valid(sc) or not sc.is_visible_in_tree():
			_deslizando.erase(sc)
			continue
		var vel: float = e[0]
		var vertical: bool = e[1]
		var limite := maxf(0.0, _sobra(sc, vertical))
		var pos := clampf(float(e[2]) - vel * dt, 0.0, limite)
		if vertical:
			sc.scroll_vertical = int(round(pos))
		else:
			sc.scroll_horizontal = int(round(pos))
		vel *= exp(-FREIO * dt)
		if absf(vel) < VEL_MIN or pos <= 0.0 or pos >= limite:
			_deslizando.erase(sc)
		else:
			_deslizando[sc] = [vel, vertical, pos]

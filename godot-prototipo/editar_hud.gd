extends CanvasLayer
# Modo de editar a interface (André 2026-11-06, ideia do Quimera, mas tudo individual e sem janela de ajustes):
# segurar o painel de vida e mana abre o modo. Nele:
#  - tocar num elemento (barra de vida, skill, ataque, joystick, chat, minimapa...) escolhe ele; tocar em outro junta os dois
#  - arrastar qualquer escolhido move todos os escolhidos juntos
#  - puxar a alça redonda do canto (ou pinçar com dois dedos) muda o tamanho de todos os escolhidos
#  - tocar de novo num escolhido tira ele da escolha; tocar no vazio limpa a escolha
#  - Pronto guarda no aparelho (user://config.cfg, seção "hud"); Cancelar volta como estava; Padrão volta ao original
# Cada sistema guarda a própria posição (hud.gd, chat.gd, minimapa.gd, menu_topo.gd, amigos.gd); aqui só se escolhe e arrasta.

const Menu = preload("res://menu.gd")
const ARQUIVO := "user://config.cfg"
const S_MIN := 0.5
const S_MAX := 2.2
const ALCA := 18.0 # raio da alça de tamanho
const COR_LINHA := Color("c9a24a", 0.55) # dourado com sombra escura por baixo: aparece na grama e no céu
const MARGEM_TELA := 12.0
const COR_SEL := Color(1.0, 0.84, 0.4)
const NOMES := {"painel": "Vida e mana", "joy": "Joystick", "chat": "Mensagens do chat", "mapa": "Minimapa",
	"topo": "Menu do topo", "time": "Barras do time", "bt:troca": "Trocar arma", "bt:basico": "Ataque", "bt:cura": "Cura",
	"bt:pular": "Pular", "bt:afundar": "Afundar", "bt:subir": "Subir", "bt:dash": "Dash", "bt:rolar": "Rolar", "bt:coletar": "Coletar", "bt:falar": "Falar",
	"bt:disparada": "Disparada", "bt:montar": "Lobo", "bt:construir": "Construir", "bt:lote": "Comprar terreno",
	"bt:bancada": "Estação de trabalho", "bt:bau": "Baú", "bt:correio": "Correio", "bt:estacoes": "Recolher estações"}

var m # main.gd
var layout := {} # id -> [dx, dy, escala]; sem a chave = lugar e tamanho de sempre
var _antes := {} # layout de quando o modo abriu (Cancelar)
var sel: Array = [] # ids escolhidos
var aberto := false
var tela: Control
var barra: PanelContainer
var bt_padrao: Button
var _dedos := {} # índice -> posição
var _gesto := "" # "mover" | "alca" | "pinca" | "vazio"
var _ini_pos := Vector2.ZERO
var _ini_t := 0
var _andou := false
var _tocado := "" # elemento embaixo do dedo quando o gesto começou
var _ja_escolhido := false # ele já estava escolhido antes deste toque (toque curto tira da escolha)
var _base := {} # id -> [dx, dy, s] no começo do gesto (alça e pinça)
var _pivo := Vector2.ZERO
var _dist0 := 1.0

func _init(principal) -> void:
	m = principal
	layer = 30 # acima de toda a HUD, do minimapa e do menu do topo

func _ready() -> void:
	tela = Control.new()
	tela.set_anchors_preset(Control.PRESET_FULL_RECT)
	tela.mouse_filter = Control.MOUSE_FILTER_STOP # nada embaixo recebe toque enquanto edita
	tela.draw.connect(_desenhar)
	tela.visible = false
	add_child(tela)
	barra = PanelContainer.new()
	barra.add_theme_stylebox_override("panel", Menu.caixa(Color(0.075, 0.065, 0.055, 0.94), Menu.OURO, 1, 10, 10))
	barra.anchor_left = 0.5
	barra.anchor_right = 0.5
	barra.offset_top = 150 # no meio de cima da tela: não cobre o menu do topo, o painel nem a fileira de baixo
	tela.add_child(barra)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 4)
	barra.add_child(col)
	var tit := Menu.rotulo("Editar interface", 17, Menu.OURO_CLARO)
	tit.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(tit)
	var dica := Menu.rotulo("Toque para escolher (vários de uma vez), arraste para mover,\npuxe a alça ou pince com dois dedos para mudar o tamanho", 12, Menu.APAGADO)
	dica.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(dica)
	var fila := HBoxContainer.new()
	fila.alignment = BoxContainer.ALIGNMENT_CENTER
	fila.add_theme_constant_override("separation", 8)
	col.add_child(fila)
	bt_padrao = _bt("Padrão", _padrao, false)
	fila.add_child(bt_padrao)
	fila.add_child(_bt("Cancelar", _cancelar, false))
	fila.add_child(_bt("Pronto", fechar, true))
	barra.resized.connect(func():
		barra.offset_left = -barra.size.x * 0.5
		barra.offset_right = barra.size.x * 0.5)
	carregar()

func _bt(t: String, fn: Callable, ativo: bool) -> Button:
	var b := Button.new()
	b.text = t
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(104, 38)
	b.add_theme_font_size_override("font_size", 15)
	Menu.estilo_botao(b, ativo)
	b.pressed.connect(fn)
	return b

# ---------- elementos ----------
func ids() -> Array:
	var l := ["painel", "joy", "chat", "mapa", "topo", "time"]
	for b in m.hud.botoes:
		l.append("bt:" + str(b.acao))
	return l

func nome(id: String) -> String:
	if NOMES.has(id):
		return NOMES[id]
	if id.begins_with("bt:hab"):
		var i := int(id.substr(6))
		var barra: Array = m.barra_atual() if m.has_method("barra_atual") else []
		var k = barra[i] if i < barra.size() else null
		if k != null and m.P.habs.has(k) and m.P.habs[k].has("nome"):
			return str(m.P.habs[k].nome)
		return "Habilidade %d" % (i + 1)
	return id

func _valor(id: String) -> Array:
	return layout.get(id, [0.0, 0.0, 1.0])

func _so_tamanho(id: String) -> bool:
	return id == "joy" # o joystick nasce onde o dedo toca: só o tamanho muda

func _centro_joy() -> Vector2:
	return Vector2(250, tela.size.y - 265) # acima da caixa do chat (embaixo à esquerda)

func rect(id: String) -> Rect2:
	var h = m.hud
	match id:
		"painel":
			return h.painel_rect()
		"joy":
			var r: float = 96.0 * h.joy_s
			return Rect2(_centro_joy() - Vector2(r, r), Vector2(r, r) * 2.0)
		"chat":
			return m.chat.area() if m.chat else Rect2()
		"mapa":
			return m.minimapa.mini.get_global_rect() if m.minimapa else Rect2()
		"topo":
			return m.menu_topo.area() if m.menu_topo else Rect2()
		"time":
			if not m.amigos:
				return Rect2()
			return Rect2(m.amigos.BARRAS + m.amigos.barras_d, Vector2(196, 76) * m.amigos.barras_s)
	if id.begins_with("bt:"):
		var b: Dictionary = h.botao(id.substr(3))
		if b.is_empty():
			return Rect2()
		var c: Vector2 = h._centro(b)
		var r: float = b.raio
		return Rect2(c - Vector2(r, r), Vector2(r, r) * 2.0)
	return Rect2()

# passa o lugar e o tamanho guardados para quem desenha o elemento
func aplicar(id: String) -> void:
	var v := _valor(id)
	var d := Vector2(v[0], v[1])
	var s: float = v[2]
	var h = m.hud
	match id:
		"painel":
			h.painel_d = d
			h.painel_s = s
		"joy":
			h.joy_s = s
		"chat":
			if m.chat:
				m.chat.posicionar(d, s)
		"mapa":
			if m.minimapa:
				m.minimapa.posicionar(d, s)
		"topo":
			if m.menu_topo:
				m.menu_topo.posicionar(d, s)
		"time":
			if m.amigos:
				m.amigos.barras_d = d
				m.amigos.barras_s = s
		_:
			if id.begins_with("bt:"):
				h.ajustar_botao(id.substr(3), d, s)

func aplicar_tudo() -> void:
	for id in ids():
		aplicar(id)

# o elemento embaixo do dedo (o menor que contém o ponto: um botão em cima do painel ganha do painel)
func _achar(p: Vector2) -> String:
	var melhor := ""
	var area := INF
	for id in ids():
		var r := rect(id)
		if r.size == Vector2.ZERO:
			continue
		var dentro: bool
		if id.begins_with("bt:") or id == "joy" or id == "mapa":
			dentro = p.distance_to(r.get_center()) <= r.size.x * 0.5 + 8.0
		else:
			dentro = r.grow(6).has_point(p)
		if dentro and r.get_area() < area:
			area = r.get_area()
			melhor = id
	return melhor

func _caixa_sel() -> Rect2:
	var r := Rect2()
	var primeiro := true
	for id in sel:
		var q := rect(id)
		r = q if primeiro else r.merge(q)
		primeiro = false
	return r

# alça no canto de baixo à direita da escolha; se não cabe na tela, vai para o canto de cima à esquerda
func _alca_embaixo() -> bool:
	var p := _caixa_sel().end + Vector2(6, 6)
	var lim := tela.size - Vector2.ONE * (ALCA + MARGEM_TELA)
	return p.x <= lim.x and p.y <= lim.y

func _alca() -> Vector2:
	var cx := _caixa_sel()
	var p := cx.end + Vector2(6, 6) if _alca_embaixo() else cx.position - Vector2(ALCA + 8, 0) # à esquerda, longe do nome
	var m0 := Vector2.ONE * (ALCA + MARGEM_TELA)
	return p.clamp(m0, tela.size - m0)

# ---------- abrir e fechar ----------
func abrir() -> void:
	if aberto:
		return
	aberto = true
	_antes = layout.duplicate(true)
	sel.clear()
	_dedos.clear()
	_gesto = ""
	m.hud.editando = true
	tela.visible = true
	_atualizar_padrao()
	if m.has_method("vibrar"):
		m.vibrar(30)
	if m.sons:
		m.sons.tocar("pano", -12.0)

func fechar() -> void:
	if not aberto:
		return
	aberto = false
	m.hud.editando = false
	tela.visible = false
	sel.clear()
	salvar()

func _cancelar() -> void:
	layout = _antes.duplicate(true)
	aplicar_tudo()
	aberto = false
	m.hud.editando = false
	tela.visible = false
	sel.clear()

# Padrão: com algo escolhido volta só ele; sem nada, volta tudo
func _padrao() -> void:
	var lista: Array = sel.duplicate() if not sel.is_empty() else ids()
	for id in lista:
		layout.erase(id)
		aplicar(id)

func _atualizar_padrao() -> void:
	bt_padrao.text = "Padrão (escolhidos)" if not sel.is_empty() else "Padrão (tudo)"

# ---------- toque ----------
func _input(ev: InputEvent) -> void:
	if not aberto:
		return
	if ev is InputEventScreenTouch:
		if ev.pressed:
			if _dedos.is_empty() and barra.get_global_rect().grow(4).has_point(ev.position):
				return # botões Padrão, Cancelar e Pronto
			_dedos[ev.index] = ev.position
			if _dedos.size() == 1:
				_comecar(ev.position)
			elif _dedos.size() == 2 and not sel.is_empty():
				_gesto = "pinca"
				_guardar_base()
				var v: Array = _dedos.values()
				_dist0 = max(10.0, (v[0] as Vector2).distance_to(v[1]))
				_pivo = Vector2.ZERO
			get_viewport().set_input_as_handled()
		elif _dedos.has(ev.index):
			_dedos.erase(ev.index)
			if _dedos.is_empty():
				_terminar(ev.position)
			elif _gesto == "pinca":
				_gesto = "" # tirou um dos dois dedos: para até soltar o outro
			get_viewport().set_input_as_handled()
	elif ev is InputEventScreenDrag and _dedos.has(ev.index):
		_dedos[ev.index] = ev.position
		if ev.position.distance_to(_ini_pos) > 10.0:
			_andou = true
		match _gesto:
			"mover":
				if _andou:
					_mover(ev.relative)
			"alca":
				var f: float = ev.position.distance_to(_pivo) / _dist0
				_escalar(f)
			"pinca":
				if _dedos.size() >= 2:
					var v: Array = _dedos.values()
					_escalar((v[0] as Vector2).distance_to(v[1]) / _dist0)
		get_viewport().set_input_as_handled()

func _comecar(p: Vector2) -> void:
	_ini_pos = p
	_ini_t = Time.get_ticks_msec()
	_andou = false
	if not sel.is_empty() and p.distance_to(_alca()) <= ALCA + 10.0:
		_gesto = "alca"
		_guardar_base()
		# cresce para o lado da alça, como puxar o canto de uma janela
		_pivo = _caixa_sel().position if _alca_embaixo() else _caixa_sel().end
		_dist0 = max(10.0, p.distance_to(_pivo))
		return
	_tocado = _achar(p)
	if _tocado == "":
		_gesto = "vazio"
		return
	_ja_escolhido = _tocado in sel
	if not _ja_escolhido:
		sel.append(_tocado) # tocar em outro junta na escolha (vários ao mesmo tempo)
		_atualizar_padrao()
	_gesto = "mover"

func _terminar(p: Vector2) -> void:
	var curto := not _andou and Time.get_ticks_msec() - _ini_t < 450
	if curto:
		if _gesto == "vazio":
			sel.clear()
		elif _gesto == "mover" and _ja_escolhido:
			sel.erase(_tocado)
	if _gesto in ["mover", "alca", "pinca"]:
		for id in sel:
			_prender(id)
	_gesto = ""
	_atualizar_padrao()

func _guardar_base() -> void:
	_base.clear()
	for id in sel:
		_base[id] = _valor(id).duplicate()

# move todos os escolhidos juntos, sem deixar o grupo sair da tela
func _mover(delta: Vector2) -> void:
	var caixa := Rect2()
	var tem := false
	for id in sel:
		if _so_tamanho(id):
			continue
		var r := rect(id)
		caixa = r if not tem else caixa.merge(r)
		tem = true
	if not tem:
		return
	var t := tela.size
	delta.x = clamp(delta.x, -caixa.position.x, t.x - caixa.end.x)
	delta.y = clamp(delta.y, -caixa.position.y, t.y - caixa.end.y)
	for id in sel:
		if _so_tamanho(id):
			continue
		var v := _valor(id)
		layout[id] = [v[0] + delta.x, v[1] + delta.y, v[2]]
		aplicar(id)

func _escalar(f: float) -> void:
	for id in sel:
		var b: Array = _base.get(id, _valor(id))
		var v := _valor(id)
		layout[id] = [v[0], v[1], clamp(float(b[2]) * f, S_MIN, S_MAX)]
		aplicar(id)

# depois de crescer, o elemento volta para dentro da tela se passou da borda
func _prender(id: String) -> void:
	if _so_tamanho(id):
		return
	var r := rect(id)
	var t := tela.size
	var dx: float = clamp(0.0, -r.position.x, t.x - r.end.x) if r.size.x <= t.x else -r.position.x
	var dy: float = clamp(0.0, -r.position.y, t.y - r.end.y) if r.size.y <= t.y else -r.position.y
	if dx != 0.0 or dy != 0.0:
		var v := _valor(id)
		layout[id] = [v[0] + dx, v[1] + dy, v[2]]
		aplicar(id)

# ---------- desenho ----------
func _process(_dt: float) -> void:
	if aberto:
		tela.queue_redraw()

func _desenhar() -> void:
	var f: Font = m.hud.fonte if m.hud.fonte else ThemeDB.fallback_font
	tela.draw_rect(Rect2(Vector2.ZERO, tela.size), Color(0, 0, 0, 0.3)) # véu: o jogo está parado para editar
	# fantasmas do que não aparece agora (joystick, chat sem mensagem, time vazio)
	m.hud.desenhar_joystick(tela, _centro_joy(), Vector2(0.35, -0.35))
	if m.chat and not m.chat.caixa.visible:
		var rc := rect("chat")
		var sc: float = m.chat.caixa_s
		tela.draw_rect(rc, Color(0.04, 0.035, 0.03, 0.22))
		for i in 3:
			var tx: String = ["Ruiva: oi, pessoal!", "Tomás: alguém vai caçar lobos?", "(as mensagens do chat aparecem aqui)"][i]
			tela.draw_string_outline(f, rc.position + Vector2(4, rc.size.y - (54 - i * 18) * sc), tx, HORIZONTAL_ALIGNMENT_LEFT, -1, int(14 * sc), 4, Color(0, 0, 0, 0.8))
			tela.draw_string(f, rc.position + Vector2(4, rc.size.y - (54 - i * 18) * sc), tx, HORIZONTAL_ALIGNMENT_LEFT, -1, int(14 * sc), Color(1, 1, 1, 0.6))
	if m.amigos and m.amigos.time.is_empty():
		var rt := rect("time")
		var k: float = m.amigos.barras_s
		for i in 2:
			var q := Rect2(rt.position + Vector2(0, i * 40 * k), Vector2(196, 36) * k)
			tela.draw_rect(q, Color(0.08, 0.07, 0.06, 0.6))
			tela.draw_rect(Rect2(q.position + Vector2(8, 17) * k, Vector2(180, 10) * k), Color(0.8, 0.22, 0.2, 0.6))
			tela.draw_rect(Rect2(q.position + Vector2(8, 29) * k, Vector2(180, 4) * k), Color(0.22, 0.45, 0.85, 0.6))
	# contorno de cada elemento: tracejado; escolhido: dourado cheio com o nome
	for id in ids():
		var r := rect(id)
		if r.size == Vector2.ZERO:
			continue
		var escolhido: bool = id in sel
		var redondo: bool = id.begins_with("bt:") or id == "joy" or id == "mapa"
		if redondo:
			var c := r.get_center()
			var rr: float = r.size.x * 0.5 + 5.0
			if escolhido:
				tela.draw_circle(c, rr, Color(1.0, 0.84, 0.4, 0.16))
				tela.draw_circle(c, rr, COR_SEL, false, 2.5)
			else:
				_circulo_tracejado(c, rr)
		else:
			var q := r.grow(1) # folga pequena: a caixa do painel não encosta nas barras do time logo embaixo
			if escolhido:
				tela.draw_rect(q, Color(1.0, 0.84, 0.4, 0.12))
				tela.draw_rect(q, COR_SEL, false, 2.5)
			else:
				_ret_tracejado(q)
		if escolhido:
			var tn := nome(id)
			var w := f.get_string_size(tn, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
			var pt := Vector2(r.get_center().x - w * 0.5, r.position.y - 9)
			if pt.y < 14:
				pt.y = r.end.y + 20
			pt.x = clamp(pt.x, MARGEM_TELA, tela.size.x - MARGEM_TELA - w)
			tela.draw_rect(Rect2(pt + Vector2(-5, -13), Vector2(w + 10, 18)), Color(0.04, 0.035, 0.03, 0.7)) # fundo: lê em cima de qualquer texto
			tela.draw_string_outline(f, pt, tn, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, 4, Color(0, 0, 0, 0.9))
			tela.draw_string(f, pt, tn, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, COR_SEL)
	# alça de tamanho no canto de baixo à direita da escolha
	if not sel.is_empty():
		var cx := _caixa_sel().grow(1)
		_ret_tracejado(cx, Color(1.0, 0.84, 0.4, 0.5))
		var a := _alca()
		tela.draw_circle(a + Vector2(0, 2), ALCA, Color(0, 0, 0, 0.4))
		tela.draw_circle(a, ALCA, Color(0.17, 0.148, 0.12, 0.95))
		tela.draw_circle(a, ALCA, COR_SEL, false, 2.5)
		var u := Vector2(1, 1).normalized() * (ALCA * 0.5)
		tela.draw_line(a - u, a + u, COR_SEL, 2.5)
		for p in [a + u, a - u]: # setinhas nas duas pontas
			var s: float = 1.0 if p == a + u else -1.0
			tela.draw_line(p, p - Vector2(6, 0) * s, COR_SEL, 2.5)
			tela.draw_line(p, p - Vector2(0, 6) * s, COR_SEL, 2.5)
		var pc := int(round(_valor(sel[0])[2] * 100.0))
		var txt := "%d%%" % pc
		var wt := f.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
		var pp := a + Vector2(ALCA + 6, 5)
		if not _alca_embaixo() or pp.x + wt > tela.size.x - MARGEM_TELA: # não cabe à direita: o número vai embaixo da alça
			pp = a + Vector2(-wt * 0.5, ALCA + 16)
		tela.draw_string_outline(f, pp, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, 4, Color(0, 0, 0, 0.9))
		tela.draw_string(f, pp, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, COR_SEL)

func _ret_tracejado(r: Rect2, cor := COR_LINHA) -> void:
	var p := [r.position, Vector2(r.end.x, r.position.y), r.end, Vector2(r.position.x, r.end.y)]
	for i in 4: # sombra escura de 1 px por baixo, depois o dourado de 2 px
		tela.draw_dashed_line(p[i] + Vector2(1, 1), p[(i + 1) % 4] + Vector2(1, 1), Color(0, 0, 0, 0.5), 2.0, 7.0)
	for i in 4:
		tela.draw_dashed_line(p[i], p[(i + 1) % 4], cor, 2.0, 7.0)

func _circulo_tracejado(c: Vector2, r: float) -> void:
	var n := int(clamp(r * 0.5, 10, 40))
	for i in n:
		if i % 2 == 1:
			continue
		var a0 := TAU * i / n
		var a1 := TAU * (i + 1) / n
		tela.draw_arc(c + Vector2(1, 1), r, a0, a1, 4, Color(0, 0, 0, 0.5), 2.0)
		tela.draw_arc(c, r, a0, a1, 4, COR_LINHA, 2.0)

# ---------- guardar no aparelho ----------
func carregar() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(ARQUIVO) == OK:
		var l = cfg.get_value("hud", "layout", {})
		if l is Dictionary:
			for k in l:
				var v = l[k]
				if v is Array and v.size() == 3:
					layout[str(k)] = [float(v[0]), float(v[1]), clamp(float(v[2]), S_MIN, S_MAX)]
	aplicar_tudo.call_deferred() # depois que chat, minimapa e menu do topo montaram as peças

func salvar() -> void:
	var cfg := ConfigFile.new()
	cfg.load(ARQUIVO)
	cfg.set_value("hud", "layout", layout)
	cfg.save(ARQUIVO)

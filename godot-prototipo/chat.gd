extends CanvasLayer
# Chat (André 2026-11-06: "cria um chat geral e um de amigos"; "o chat geral ter opção de mutar").
# Dois canais: Geral (todo mundo que está online, em qualquer mundo) e Amigos (você e os seus amigos online).
# Quem decide é o servidor (shared/simulacao.js chat): ele limpa o texto, corta no tamanho e segura quem manda rápido demais.
# O ícone de balão no menu do topo (menu_topo.gd) abre a janela, que fica no alto da tela para o teclado do celular
# não cobrir a linha de escrever. As últimas mensagens aparecem por alguns segundos no lado esquerdo da tela, sem pegar toque.
# Silenciar o geral é escolha de cada um e fica salvo no celular: o geral some da tela, da janela e do contador.

const Menu = preload("res://menu.gd")
const ARQUIVO := "user://config.cfg" # o mesmo do menu do topo (seção "chat")
const MAX := 120 # letras por mensagem (igual a CHAT.max em shared/dados.js)
const GUARDA := 80 # mensagens guardadas por canal no celular
const COR_AMIGO := Color("7ee08a") # verde dos amigos (o mesmo do time)
const VIVA := 9.0 # segundos que a mensagem fica no canto da tela
const LINHAS_CANTO := 4

var m # main.gd
var msgs := {"geral": [], "amigos": []}
var nao_lidas := {"geral": 0, "amigos": 0}
var aba := "geral"
var geral_mudo := false
var raiz: Control
var janela: Control
var caixa: PanelContainer
var lista: VBoxContainer
var rolar: ScrollContainer
var campo: LineEdit
var enviar_b: Button
var aviso_l: Label
var abas_b := {}
var mudo_b: CheckButton
var canto: VBoxContainer # últimas mensagens no lado esquerdo da tela
var _canto: Array = [] # [{no, t}]
var _selo: Label # número de não lidas em cima do ícone do topo

func _init(principal) -> void:
	m = principal
	layer = 4 # junto do menu do topo; a janela fica por cima da HUD

func _ready() -> void:
	carregar()
	raiz = Control.new()
	raiz.set_anchors_preset(Control.PRESET_FULL_RECT)
	raiz.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(raiz)
	canto = VBoxContainer.new()
	canto.mouse_filter = Control.MOUSE_FILTER_IGNORE
	canto.add_theme_constant_override("separation", 2)
	canto.anchor_top = 0.5
	canto.anchor_bottom = 0.5
	canto.offset_left = 18
	canto.offset_right = 18 + 420
	canto.offset_top = 10
	canto.offset_bottom = 110
	canto.alignment = BoxContainer.ALIGNMENT_END
	raiz.add_child(canto)
	_montar_janela()

# ---------- ícone do topo (menu_topo.gd chama ao criar o botão) ----------
func ligar_icone(b: Button) -> void:
	_selo = Label.new()
	_selo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_selo.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_selo.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_selo.add_theme_font_size_override("font_size", 11)
	_selo.add_theme_color_override("font_color", Color(0.165, 0.114, 0.016))
	var fundo := Menu.caixa(Color(0.88, 0.71, 0.35), Color(0.165, 0.114, 0.016, 0.8), 1, 9)
	fundo.content_margin_left = 4
	fundo.content_margin_right = 4
	fundo.content_margin_top = 0
	fundo.content_margin_bottom = 0
	_selo.add_theme_stylebox_override("normal", fundo)
	_selo.position = Vector2(32, -5)
	_selo.size = Vector2(22, 18)
	_selo.visible = false
	b.add_child(_selo)

func _atualizar_selo() -> void:
	if _selo == null:
		return
	var n: int = nao_lidas.amigos + (0 if geral_mudo else nao_lidas.geral)
	_selo.visible = n > 0
	_selo.text = "99+" if n > 99 else str(n)
	_selo.size = Vector2(28 if n > 9 else 20, 18)

# ---------- janela ----------
func _montar_janela() -> void:
	janela = Control.new()
	janela.set_anchors_preset(Control.PRESET_FULL_RECT)
	janela.visible = false
	raiz.add_child(janela)
	var escuro := ColorRect.new()
	escuro.color = Color(0.04, 0.035, 0.03, 0.45)
	escuro.set_anchors_preset(Control.PRESET_FULL_RECT)
	escuro.gui_input.connect(func(ev):
		if ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT:
			fechar())
	janela.add_child(escuro)
	caixa = PanelContainer.new()
	var estilo := Menu.caixa(Color(0.086, 0.07, 0.055, 0.95), Color(0.925, 0.81, 0.55, 0.45), 1, 16, 16)
	estilo.content_margin_left = 18
	estilo.content_margin_right = 18
	estilo.content_margin_top = 14
	estilo.content_margin_bottom = 14
	caixa.add_theme_stylebox_override("panel", estilo)
	# no alto e no meio: o teclado do celular sobe por baixo e não cobre a linha de escrever
	caixa.anchor_left = 0.5
	caixa.anchor_right = 0.5
	caixa.offset_left = -330
	caixa.offset_right = 330
	caixa.offset_top = 12
	caixa.offset_bottom = 12 + 330
	janela.add_child(caixa)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 8)
	caixa.add_child(col)
	# cabeça: ícone, abas, silenciar e voltar
	var cab := HBoxContainer.new()
	cab.add_theme_constant_override("separation", 8)
	var ico := TextureRect.new()
	ico.texture = Menu.icone_tex("topo_chat")
	ico.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ico.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ico.custom_minimum_size = Vector2(28, 28)
	ico.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	cab.add_child(ico)
	for k in ["geral", "amigos"]:
		var b := Button.new()
		b.focus_mode = Control.FOCUS_NONE
		b.custom_minimum_size = Vector2(118, 40)
		b.add_theme_font_size_override("font_size", 16)
		var kk: String = k
		b.pressed.connect(func(): trocar_aba(kk))
		abas_b[k] = b
		cab.add_child(b)
	var vao := Control.new()
	vao.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cab.add_child(vao)
	mudo_b = CheckButton.new()
	mudo_b.text = "Silenciar geral"
	mudo_b.focus_mode = Control.FOCUS_NONE
	mudo_b.add_theme_font_size_override("font_size", 15)
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color"]:
		mudo_b.add_theme_color_override(c, Menu.TEXTO)
	mudo_b.toggled.connect(func(v): silenciar_geral(v))
	cab.add_child(mudo_b)
	var x := Button.new()
	x.text = "Voltar ao jogo"
	x.focus_mode = Control.FOCUS_NONE
	x.custom_minimum_size = Vector2(130, 40)
	x.add_theme_font_size_override("font_size", 15)
	Menu.estilo_botao(x, false)
	x.pressed.connect(fechar)
	cab.add_child(x)
	col.add_child(cab)
	var ouro := ColorRect.new()
	ouro.color = Color(Menu.OURO, 0.45)
	ouro.custom_minimum_size = Vector2(0, 1)
	col.add_child(ouro)
	# linha de escrever (em cima das mensagens, longe do teclado)
	var esc := HBoxContainer.new()
	esc.add_theme_constant_override("separation", 8)
	campo = LineEdit.new()
	campo.max_length = MAX
	campo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	campo.custom_minimum_size = Vector2(0, 42)
	campo.add_theme_font_size_override("font_size", 16)
	campo.add_theme_color_override("font_color", Menu.TEXTO)
	campo.add_theme_color_override("font_placeholder_color", Menu.APAGADO)
	campo.add_theme_color_override("caret_color", Menu.OURO_CLARO)
	var cn := Menu.caixa(Color(0.04, 0.035, 0.03, 0.85), Menu.BORDA, 1, 8)
	var cf := Menu.caixa(Color(0.04, 0.035, 0.03, 0.9), Menu.OURO, 1, 8)
	campo.add_theme_stylebox_override("normal", cn)
	campo.add_theme_stylebox_override("focus", cf)
	campo.add_theme_stylebox_override("read_only", cn)
	campo.text_submitted.connect(func(_t): enviar())
	esc.add_child(campo)
	enviar_b = Button.new()
	enviar_b.text = "Enviar"
	enviar_b.focus_mode = Control.FOCUS_NONE
	enviar_b.custom_minimum_size = Vector2(96, 42)
	enviar_b.add_theme_font_size_override("font_size", 16)
	for e in ["normal", "hover", "pressed", "disabled"]:
		var s := Menu.caixa(Color(0.88, 0.71, 0.35) if e == "normal" or e == "hover" else Color(0.73, 0.54, 0.21) if e == "pressed" else Color(0.3, 0.26, 0.2), Color(0, 0, 0, 0), 0, 10)
		enviar_b.add_theme_stylebox_override(e, s)
	for c in ["font_color", "font_hover_color", "font_pressed_color"]:
		enviar_b.add_theme_color_override(c, Color(0.165, 0.114, 0.016))
	enviar_b.add_theme_color_override("font_disabled_color", Color(0.55, 0.5, 0.42))
	enviar_b.pressed.connect(enviar)
	esc.add_child(enviar_b)
	col.add_child(esc)
	aviso_l = Menu.rotulo("", 14, Menu.APAGADO)
	aviso_l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	aviso_l.visible = false
	col.add_child(aviso_l)
	# mensagens (rola; a mais nova embaixo)
	rolar = ScrollContainer.new()
	rolar.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	rolar.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var fundo := PanelContainer.new()
	fundo.add_theme_stylebox_override("panel", Menu.caixa(Color(0, 0, 0, 0.22), Color(0, 0, 0, 0), 0, 8))
	fundo.size_flags_vertical = Control.SIZE_EXPAND_FILL
	fundo.add_child(rolar)
	lista = VBoxContainer.new()
	lista.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lista.add_theme_constant_override("separation", 3)
	var margem := MarginContainer.new()
	margem.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	margem.add_theme_constant_override("margin_right", 12)
	margem.add_child(lista)
	rolar.add_child(margem)
	col.add_child(fundo)

func abrir(qual := "") -> void:
	if janela.visible:
		fechar()
		return
	if m.menu_topo and m.menu_topo.aberto():
		m.menu_topo.fechar()
	if qual != "":
		aba = qual
	elif geral_mudo and nao_lidas.amigos > 0 or nao_lidas.amigos > 0 and nao_lidas.geral == 0:
		aba = "amigos"
	janela.visible = true
	m.hud.bloqueado = true
	montar()

func fechar() -> void:
	if not janela.visible:
		return
	janela.visible = false
	campo.release_focus()
	DisplayServer.virtual_keyboard_hide()
	if not (m.menu and m.menu.aberto()) and not (m.menu_topo and m.menu_topo.aberto()):
		m.hud.bloqueado = false

func aberto() -> bool:
	return janela != null and janela.visible

func trocar_aba(k: String) -> void:
	aba = k
	montar()

func silenciar_geral(v: bool) -> void:
	if geral_mudo == v:
		return
	geral_mudo = v
	nao_lidas.geral = 0
	if v: # some também do canto da tela
		for c in _canto.duplicate():
			if c.canal == "geral":
				c.no.queue_free()
				_canto.erase(c)
	salvar()
	_atualizar_selo()
	if aberto():
		montar()

func montar() -> void:
	for k in abas_b:
		var b: Button = abas_b[k]
		var n: int = nao_lidas[k]
		var nome := "Geral" if k == "geral" else "Amigos"
		if k == "geral" and geral_mudo:
			nome = "Geral (mudo)"
		b.text = nome if n == 0 or (k == "geral" and geral_mudo) else "%s (%d)" % [nome, n]
		Menu.estilo_botao(b, k == aba)
		if k == "amigos":
			b.add_theme_color_override("font_color", COR_AMIGO if k == aba else Color(COR_AMIGO, 0.75))
	mudo_b.set_pressed_no_signal(geral_mudo)
	nao_lidas[aba] = 0
	_atualizar_selo()
	var on: bool = m.on()
	var sem_amigos: bool = aba == "amigos" and m.amigos != null and m.amigos.lista.is_empty()
	var mudo: bool = aba == "geral" and geral_mudo
	var dica := ""
	if not on:
		dica = "O chat é só online. Entre com a sua conta Google pelo menu Multijogador."
	elif mudo:
		dica = "Chat geral silenciado: as mensagens do geral não aparecem para você. Desligue \"Silenciar geral\" para ver de novo."
	elif sem_amigos:
		dica = "Você ainda não tem amigos. Toque num jogador aqui no mundo e escolha \"Adicionar amigo\"."
	aviso_l.text = dica
	aviso_l.visible = dica != ""
	var pode: bool = on and not mudo and not sem_amigos
	campo.editable = pode
	enviar_b.disabled = not pode
	campo.placeholder_text = "Escreva para todo mundo…" if aba == "geral" else "Escreva para os seus amigos…"
	for c in lista.get_children():
		lista.remove_child(c)
		c.queue_free()
	if mudo:
		return
	var l: Array = msgs[aba]
	if l.is_empty() and on and not sem_amigos:
		lista.add_child(Menu.rotulo("Nenhuma mensagem ainda. Diga oi!", 14, Menu.APAGADO))
	for x in l:
		lista.add_child(_linha(x, 15, true))
	_descer()

func _descer() -> void:
	await get_tree().process_frame
	if is_instance_valid(rolar):
		rolar.scroll_vertical = int(rolar.get_v_scroll_bar().max_value)

func enviar() -> void:
	var t := campo.text.strip_edges()
	if t == "" or not m.on() or (aba == "geral" and geral_mudo):
		return
	m.rede("chat", {"canal": aba, "texto": t.left(MAX)})
	campo.text = ""
	campo.grab_focus.call_deferred() # o teclado continua aberto para a próxima

# ---------- linha de mensagem: hora, nome e texto (texto do jogador não vira BBCode) ----------
static func _seguro(t: String) -> String:
	return t.replace("[", "[lb]")

func _linha(x: Dictionary, tam: int, com_hora: bool) -> RichTextLabel:
	var r := RichTextLabel.new()
	r.bbcode_enabled = true
	r.fit_content = true
	r.scroll_active = false
	r.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	r.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	r.add_theme_font_size_override("normal_font_size", tam)
	r.add_theme_font_size_override("bold_font_size", tam)
	r.add_theme_color_override("default_color", Menu.TEXTO)
	var amigo: bool = str(x.get("canal", "")) == "amigos"
	var cor_nome: Color = Menu.OURO_CLARO if x.get("meu", false) == true else (COR_AMIGO if amigo else Color(0.86, 0.72, 0.5))
	var s := ""
	if com_hora:
		s += "[color=#%s]%s[/color]  " % [Menu.APAGADO.to_html(false), _hora(float(x.get("hora", 0)))]
	elif amigo:
		s += "[color=#%s][Amigos][/color] " % COR_AMIGO.to_html(false)
	s += "[b][color=#%s]%s:[/color][/b] %s" % [cor_nome.to_html(false), _seguro(str(x.get("nome", "?"))), _seguro(str(x.get("texto", "")))]
	r.text = s
	return r

static func _hora(ms: float) -> String:
	if ms <= 0.0:
		return ""
	var bias: int = int(Time.get_time_zone_from_system().get("bias", 0)) # minutos do fuso do celular
	var d := Time.get_datetime_dict_from_unix_time(int(ms / 1000.0) + bias * 60)
	return "%02d:%02d" % [int(d.hour), int(d.minute)]

# ---------- o que vem do servidor (online.gd) ----------
func do_servidor(ev: Dictionary) -> void:
	match str(ev.get("t", "")):
		"chatHist": # acabou de entrar: as últimas do servidor (troca o que tinha)
			msgs = {"geral": [], "amigos": []}
			for x in ev.get("lista", []):
				if x is Dictionary and msgs.has(str(x.get("canal", ""))):
					msgs[str(x.canal)].append(x)
			if aberto():
				montar()
		"chat":
			var k := str(ev.get("canal", ""))
			if not msgs.has(k):
				return
			msgs[k].append(ev)
			if msgs[k].size() > GUARDA:
				msgs[k].pop_front()
			if k == "geral" and geral_mudo:
				return
			var meu: bool = ev.get("meu", false) == true
			if aberto() and aba == k:
				lista.add_child(_linha(ev, 15, true))
				for c in lista.get_children(): # "Nenhuma mensagem ainda" sai
					if c is Label:
						c.queue_free()
				while lista.get_child_count() > GUARDA:
					var v := lista.get_child(0)
					lista.remove_child(v)
					v.queue_free()
				_descer()
			else:
				if not meu:
					nao_lidas[k] += 1
				_atualizar_selo()
				if aberto():
					montar()
			if not aberto():
				_no_canto(ev)
			if not meu and k == "amigos" and m.sons:
				m.sons.tocar("pano", -16.0)

# a mensagem aparece um pouco no lado esquerdo da tela e some sozinha (não pega toque: o joystick continua livre)
func _no_canto(x: Dictionary) -> void:
	var r := _linha(x, 14, false)
	r.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	r.add_theme_constant_override("outline_size", 4)
	canto.add_child(r)
	_canto.append({"no": r, "t": VIVA, "canal": str(x.get("canal", ""))})
	while _canto.size() > LINHAS_CANTO:
		_canto.pop_front().no.queue_free()

func _process(dt: float) -> void:
	canto.visible = not aberto() and not (m.hud and m.hud.esconder_combate) and not (m.menu and m.menu.aberto())
	for c in _canto.duplicate():
		c.t -= dt
		if c.t <= 0.0:
			c.no.queue_free()
			_canto.erase(c)
		elif c.t < 1.0:
			c.no.modulate.a = c.t

# PC: Enter abre o chat (no celular não existe Enter fora do campo de texto)
func _unhandled_key_input(ev: InputEvent) -> void:
	if ev is InputEventKey and ev.pressed and not ev.echo:
		if (ev.keycode == KEY_ENTER or ev.keycode == KEY_KP_ENTER) and not aberto() and m.on() and not (m.menu and m.menu.aberto()):
			abrir()
			campo.grab_focus.call_deferred()
			get_viewport().set_input_as_handled()
		elif ev.keycode == KEY_ESCAPE and aberto():
			fechar()
			get_viewport().set_input_as_handled()

# caiu a conexão: o que já chegou fica; ao voltar o servidor manda o histórico de novo
func desligou() -> void:
	nao_lidas = {"geral": 0, "amigos": 0}
	_atualizar_selo()
	if aberto():
		montar()

# modo de editar a interface (editar_hud.gd): as mensagens do canto mudam de lugar e de tamanho
func posicionar(d: Vector2, s: float) -> void:
	canto.offset_left = 18 + d.x
	canto.offset_right = 18 + 420 + d.x
	canto.offset_top = 10 + d.y
	canto.offset_bottom = 110 + d.y
	canto.scale = Vector2(s, s)

# ---------- guardar no aparelho ----------
func carregar() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(ARQUIVO) != OK:
		return
	geral_mudo = bool(cfg.get_value("chat", "geral_mudo", false))

func salvar() -> void:
	var cfg := ConfigFile.new()
	cfg.load(ARQUIVO)
	cfg.set_value("chat", "geral_mudo", geral_mudo)
	cfg.save(ARQUIVO)

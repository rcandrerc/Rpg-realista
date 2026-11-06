extends CanvasLayer
# Chat (André 2026-11-06: "cria um chat geral e um de amigos"; "o chat geral ter opção de mutar").
# Dois canais: Geral (todo mundo que está online, em qualquer mundo) e Amigos (você e os seus amigos online).
# Quem decide é o servidor (shared/simulacao.js chat): ele limpa o texto, corta no tamanho e segura quem manda rápido demais.
#
# No jeito dos jogos de celular (André 2026-11-06, depois de testar):
# - Lendo: as últimas mensagens ficam embaixo, à esquerda, numa caixa quase transparente que não pega toque
#   (o joystick e a câmera continuam funcionando por cima dela). Os dois canais juntos, o de amigos em verde.
# - Escrevendo (balão do menu do topo, ou Enter no PC): a barra de escrever fica embaixo e sobe junto com o teclado do
#   celular, com as mensagens da aba logo acima, para ver o que está escrevendo. Fechou o teclado, volta a ser só a caixa.
# - Botãozinho do balão na ponta de cima da caixa (André 2026-11-06): SEGURAR meio segundo abre o chat completo para ler
#   as conversas anteriores (o teclado só sobe tocando na barra). Toque rápido não abre, para não abrir no meio da luta.
# Silenciar o geral é escolha de cada um e fica salvo no celular: o geral some da caixa, da janela e do contador.

const Menu = preload("res://menu.gd")
const ARQUIVO := "user://config.cfg" # o mesmo do menu do topo (seção "chat")
const MAX := 120 # letras por mensagem (igual a CHAT.max em shared/dados.js)
const GUARDA := 80 # mensagens guardadas por canal no celular
const COR_AMIGO := Color("7ee08a") # verde dos amigos (o mesmo do time)
const LINHAS_CAIXA := 5 # mensagens na caixa de leitura
const MARGEM := 12.0
const LARGURA_CAIXA := 440.0
const LARGURA_ESCREVER := 640.0
const ALTURA_BARRA := 46.0
const ALTURA_LISTA := 210.0

var m # main.gd
var msgs := {"geral": [], "amigos": []}
var todas: Array = [] # os dois canais em ordem de chegada (a caixa de leitura)
var nao_lidas := {"geral": 0, "amigos": 0}
var aba := "geral"
var geral_mudo := false
var raiz: Control
# leitura (embaixo, sem toque)
var caixa: PanelContainer
var caixa_lista: VBoxContainer
# escrevendo
var escrever: Control # tela inteira: toque fora do painel fecha
var painel: PanelContainer # abas e mensagens
var barra: PanelContainer # linha de escrever
var lista: VBoxContainer
var rolar: ScrollContainer
var campo: LineEdit
var enviar_b: Button
var aviso_l: Label
var abas_b := {}
var mudo_b: CheckButton
var _selo: Label # número de não lidas em cima do ícone do topo
var _teclado := 0.0 # altura do teclado do celular, em pixels da tela do jogo
var _teclado_visto := false # o teclado já abriu nesta escrita (no PC nunca abre)
var _teclado_zero_t := 0.0
var _historico := false # aberto pelo botãozinho (ler as conversas): fechar o teclado não fecha o chat
# botãozinho de abrir o chat completo (André 2026-11-06): fica na ponta de cima da caixa e só abre segurando,
# para não abrir sem querer no meio da luta
const BOTAO := 30.0
const SEGURAR := 0.5 # segundos segurando para abrir
var botao: Control
var _segura_dedo := -1
var _segura_t := 0.0
var _dica_t := 0.0

func _init(principal) -> void:
	m = principal
	layer = 4 # junto do menu do topo; por cima da HUD

func _ready() -> void:
	carregar()
	raiz = Control.new()
	raiz.set_anchors_preset(Control.PRESET_FULL_RECT)
	raiz.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(raiz)
	_montar_caixa()
	_montar_escrever()
	_montar_botao()

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

# ---------- caixa de leitura (embaixo à esquerda, quase transparente, não pega toque) ----------
func _montar_caixa() -> void:
	caixa = PanelContainer.new()
	caixa.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var e := Menu.caixa(Color(0.04, 0.035, 0.03, 0.22), Color(0, 0, 0, 0), 0, 10)
	e.content_margin_left = 10
	e.content_margin_right = 10
	e.content_margin_top = 6
	e.content_margin_bottom = 6
	caixa.add_theme_stylebox_override("panel", e)
	caixa.anchor_top = 1.0
	caixa.anchor_bottom = 1.0
	caixa.offset_left = MARGEM
	caixa.offset_right = MARGEM + LARGURA_CAIXA
	caixa.offset_bottom = -MARGEM
	caixa.offset_top = -MARGEM - 10 # cresce para cima com as linhas
	caixa.grow_vertical = Control.GROW_DIRECTION_BEGIN
	caixa.visible = false
	raiz.add_child(caixa)
	caixa_lista = VBoxContainer.new()
	caixa_lista.mouse_filter = Control.MOUSE_FILTER_IGNORE
	caixa_lista.add_theme_constant_override("separation", 1)
	caixa.add_child(caixa_lista)

func _refazer_caixa() -> void:
	for c in caixa_lista.get_children():
		caixa_lista.remove_child(c)
		c.queue_free()
	var vis: Array = []
	for i in range(todas.size() - 1, -1, -1):
		var x: Dictionary = todas[i]
		if geral_mudo and str(x.get("canal", "")) == "geral":
			continue
		vis.push_front(x)
		if vis.size() >= LINHAS_CAIXA:
			break
	for x in vis:
		var r := _linha(x, 14, false)
		r.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
		r.add_theme_constant_override("outline_size", 4)
		caixa_lista.add_child(r)

# ---------- botãozinho: segurar meio segundo abre o chat completo com as conversas anteriores ----------
class BotaoChat extends Control:
	var k := 0.0 # 0..1 do quanto já segurou
	var dica := 0.0 # "Segure para abrir" depois de um toque rápido
	var ico: Texture2D
	func _draw() -> void:
		var c := size * 0.5
		var r := size.x * 0.5
		draw_circle(c, r, Color(0.04, 0.035, 0.03, 0.42))
		draw_arc(c, r - 0.5, 0, TAU, 32, Color(0.925, 0.81, 0.55, 0.35), 1.0, true)
		if ico:
			draw_texture_rect(ico, Rect2(c - Vector2(9, 9), Vector2(18, 18)), false, Color(1, 1, 1, 0.75 + 0.25 * k))
		if k > 0.0:
			draw_arc(c, r - 2.0, -PI * 0.5, -PI * 0.5 + TAU * k, 32, Color(0.95, 0.82, 0.55), 3.0, true)
		if dica > 0.0:
			var f := ThemeDB.fallback_font
			var t := "Segure para abrir o chat"
			var p := Vector2(size.x + 6, c.y + 5)
			draw_string_outline(f, p, t, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, 4, Color(0, 0, 0, 0.8 * min(1.0, dica)))
			draw_string(f, p, t, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(1, 0.92, 0.75, min(1.0, dica)))

func _montar_botao() -> void:
	botao = BotaoChat.new()
	botao.ico = Menu.icone_tex("topo_chat")
	botao.mouse_filter = Control.MOUSE_FILTER_IGNORE # o toque é tratado em _input (a HUD pergunta antes por cobre)
	botao.size = Vector2(BOTAO, BOTAO)
	botao.visible = false
	raiz.add_child(botao)

# onde o botão fica: na ponta de cima à direita da caixa de leitura (ou do lugar dela, quando ainda não tem mensagem)
func _lugar_botao() -> void:
	var r := caixa.get_global_rect()
	if not caixa.visible:
		r = Rect2(Vector2(caixa.offset_left, raiz.size.y + caixa.offset_bottom - 10.0), Vector2(LARGURA_CAIXA * caixa.scale.x, 10.0))
	botao.position = Vector2(r.end.x - BOTAO, r.position.y - BOTAO - 4.0)

# a HUD (pelo menu_topo.cobre) pergunta: este toque é do botãozinho? (aí não vira joystick nem câmera)
func cobre_botao(p: Vector2) -> bool:
	return botao != null and botao.visible and botao.get_global_rect().grow(6).has_point(p)

func _input(ev: InputEvent) -> void:
	if ev is InputEventScreenDrag and ev.index == _segura_dedo and not cobre_botao(ev.position):
		_segura_dedo = -1 # o dedo saiu do botão: não abre
		_segura_t = 0.0
		return
	if not (ev is InputEventScreenTouch) or botao == null or not botao.visible:
		return
	if ev.pressed and _segura_dedo < 0 and cobre_botao(ev.position):
		_segura_dedo = ev.index
		_segura_t = 0.0
	elif not ev.pressed and ev.index == _segura_dedo:
		_segura_dedo = -1
		if _segura_t < SEGURAR: # toque rápido: não abre, só lembra que é para segurar
			_dica_t = 1.6
		_segura_t = 0.0

func _atualizar_botao(dt: float) -> void:
	botao.visible = m.on() and not aberto() and not ((m.menu and m.menu.aberto()) or (m.menu_topo and m.menu_topo.aberto())) and m.hud != null and not m.hud.esconder_combate and not m.hud.modo_construcao
	if not botao.visible:
		_segura_dedo = -1
		_segura_t = 0.0
		return
	_lugar_botao()
	if _segura_dedo >= 0:
		_segura_t += dt
		if _segura_t >= SEGURAR:
			_segura_dedo = -1
			_segura_t = 0.0
			m.vibrar(25)
			abrir("", true)
			return
	_dica_t = max(0.0, _dica_t - dt)
	botao.k = clamp(_segura_t / SEGURAR, 0.0, 1.0)
	botao.dica = _dica_t
	botao.queue_redraw()

# ---------- escrevendo: barra embaixo (sobe com o teclado) e as mensagens da aba logo acima ----------
func _montar_escrever() -> void:
	escrever = Control.new()
	escrever.set_anchors_preset(Control.PRESET_FULL_RECT)
	escrever.visible = false
	raiz.add_child(escrever)
	var fora := Control.new() # toque fora do chat fecha (e o jogo não recebe esse toque)
	fora.set_anchors_preset(Control.PRESET_FULL_RECT)
	fora.mouse_filter = Control.MOUSE_FILTER_STOP
	fora.gui_input.connect(func(ev):
		if (ev is InputEventMouseButton and ev.pressed) or (ev is InputEventScreenTouch and ev.pressed):
			fechar())
	escrever.add_child(fora)
	# painel das mensagens
	painel = PanelContainer.new()
	var estilo := Menu.caixa(Color(0.06, 0.05, 0.04, 0.82), Color(0.925, 0.81, 0.55, 0.35), 1, 12, 8)
	estilo.content_margin_left = 12
	estilo.content_margin_right = 12
	estilo.content_margin_top = 8
	estilo.content_margin_bottom = 8
	painel.add_theme_stylebox_override("panel", estilo)
	escrever.add_child(painel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 6)
	painel.add_child(col)
	var cab := HBoxContainer.new()
	cab.add_theme_constant_override("separation", 6)
	for k in ["geral", "amigos"]:
		var b := Button.new()
		b.focus_mode = Control.FOCUS_NONE
		b.custom_minimum_size = Vector2(112, 34)
		b.add_theme_font_size_override("font_size", 15)
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
	mudo_b.add_theme_font_size_override("font_size", 14)
	for c in ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color"]:
		mudo_b.add_theme_color_override(c, Menu.TEXTO)
	mudo_b.toggled.connect(func(v): silenciar_geral(v))
	cab.add_child(mudo_b)
	var x := Button.new()
	x.text = "Fechar"
	x.focus_mode = Control.FOCUS_NONE
	x.custom_minimum_size = Vector2(84, 34)
	x.add_theme_font_size_override("font_size", 16)
	Menu.estilo_botao(x, false)
	x.pressed.connect(fechar)
	cab.add_child(x)
	col.add_child(cab)
	aviso_l = Menu.rotulo("", 13, Menu.APAGADO)
	aviso_l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	aviso_l.visible = false
	col.add_child(aviso_l)
	rolar = ScrollContainer.new()
	rolar.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	rolar.size_flags_vertical = Control.SIZE_EXPAND_FILL
	lista = VBoxContainer.new()
	lista.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lista.add_theme_constant_override("separation", 3)
	var margem := MarginContainer.new()
	margem.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	margem.add_theme_constant_override("margin_right", 12)
	margem.add_child(lista)
	rolar.add_child(margem)
	col.add_child(rolar)
	# barra de escrever
	barra = PanelContainer.new()
	var eb := Menu.caixa(Color(0.06, 0.05, 0.04, 0.9), Color(0.925, 0.81, 0.55, 0.45), 1, 12, 8)
	eb.content_margin_left = 6
	eb.content_margin_right = 6
	eb.content_margin_top = 4
	eb.content_margin_bottom = 4
	barra.add_theme_stylebox_override("panel", eb)
	escrever.add_child(barra)
	var esc := HBoxContainer.new()
	esc.add_theme_constant_override("separation", 6)
	barra.add_child(esc)
	campo = LineEdit.new()
	campo.max_length = MAX
	campo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	campo.custom_minimum_size = Vector2(0, ALTURA_BARRA - 8)
	campo.add_theme_font_size_override("font_size", 16)
	campo.add_theme_color_override("font_color", Menu.TEXTO)
	campo.add_theme_color_override("font_placeholder_color", Menu.APAGADO)
	campo.add_theme_color_override("caret_color", Menu.OURO_CLARO)
	var cn := Menu.caixa(Color(0.02, 0.018, 0.015, 0.7), Color(0, 0, 0, 0), 0, 8)
	campo.add_theme_stylebox_override("normal", cn)
	campo.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	campo.add_theme_stylebox_override("read_only", cn)
	if "keep_editing_on_text_submit" in campo: # Godot 4.4+: o teclado continua aberto depois de mandar
		campo.set("keep_editing_on_text_submit", true)
	campo.text_submitted.connect(func(_t): enviar())
	esc.add_child(campo)
	enviar_b = Button.new()
	enviar_b.text = "Enviar"
	enviar_b.focus_mode = Control.FOCUS_NONE
	enviar_b.custom_minimum_size = Vector2(90, ALTURA_BARRA - 8)
	enviar_b.add_theme_font_size_override("font_size", 16)
	for e in ["normal", "hover", "pressed", "disabled"]:
		var s := Menu.caixa(Color(0.88, 0.71, 0.35) if e == "normal" or e == "hover" else Color(0.73, 0.54, 0.21) if e == "pressed" else Color(0.3, 0.26, 0.2), Color(0, 0, 0, 0), 0, 8)
		enviar_b.add_theme_stylebox_override(e, s)
	for c in ["font_color", "font_hover_color", "font_pressed_color"]:
		enviar_b.add_theme_color_override(c, Color(0.165, 0.114, 0.016))
	enviar_b.add_theme_color_override("font_disabled_color", Color(0.55, 0.5, 0.42))
	enviar_b.pressed.connect(enviar)
	esc.add_child(enviar_b)
	_posicionar()

# barra colada embaixo (ou em cima do teclado) e a lista logo acima, encolhendo se o teclado ocupar a tela
func _posicionar() -> void:
	var tela := raiz.get_viewport_rect().size if raiz.is_inside_tree() else Vector2(1280, 576)
	var larg: float = min(LARGURA_ESCREVER, tela.x - MARGEM * 2.0)
	var baixo: float = tela.y - MARGEM - _teclado
	barra.position = Vector2(MARGEM, baixo - ALTURA_BARRA)
	barra.size = Vector2(larg, ALTURA_BARRA)
	var alt: float = clamp(baixo - ALTURA_BARRA - 6.0 - MARGEM, 70.0, ALTURA_LISTA)
	painel.position = Vector2(MARGEM, barra.position.y - 6.0 - alt)
	painel.size = Vector2(larg, alt)

func _altura_teclado() -> float:
	var h := float(DisplayServer.virtual_keyboard_get_height()) # pixels de verdade da tela
	if h <= 0.0:
		return 0.0
	var janela := Vector2(DisplayServer.window_get_size())
	var tela := raiz.get_viewport_rect().size
	return h * (tela.y / max(1.0, janela.y))

func abrir(qual := "", historico := false) -> void:
	if escrever.visible:
		fechar()
		return
	if m.menu_topo and m.menu_topo.aberto():
		m.menu_topo.fechar()
	if qual != "":
		aba = qual
	elif nao_lidas.amigos > 0 and (geral_mudo or nao_lidas.geral == 0):
		aba = "amigos"
	escrever.visible = true
	_historico = historico
	_teclado_visto = false
	_teclado_zero_t = 0.0
	m.hud.bloqueado = true
	montar()
	if not historico: # pelo botãozinho abre para ler: o teclado só sobe tocando na barra de escrever
		_editar.call_deferred()

func _editar() -> void:
	if not escrever.visible or not campo.editable:
		return
	campo.grab_focus()
	if campo.has_method("edit"): # Godot 4.4+: começar a escrever abre o teclado do celular
		campo.call("edit")
	else:
		DisplayServer.virtual_keyboard_show(campo.text)

func fechar() -> void:
	if not escrever.visible:
		return
	escrever.visible = false
	if campo.has_method("unedit"):
		campo.call("unedit")
	campo.release_focus()
	DisplayServer.virtual_keyboard_hide()
	_teclado = 0.0
	_posicionar()
	if not (m.menu and m.menu.aberto()) and not (m.menu_topo and m.menu_topo.aberto()):
		m.hud.bloqueado = false

func aberto() -> bool:
	return escrever != null and escrever.visible

func trocar_aba(k: String) -> void:
	aba = k
	montar()
	_editar()

func silenciar_geral(v: bool) -> void:
	if geral_mudo == v:
		return
	geral_mudo = v
	nao_lidas.geral = 0
	salvar()
	_atualizar_selo()
	_refazer_caixa()
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
	_editar.call_deferred() # o teclado continua aberto para a próxima

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
		s += "[color=#%s][lb]Amigos][/color] " % COR_AMIGO.to_html(false)
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
			todas = []
			for x in ev.get("lista", []):
				if x is Dictionary and msgs.has(str(x.get("canal", ""))):
					msgs[str(x.canal)].append(x)
					todas.append(x)
			_refazer_caixa()
			if aberto():
				montar()
		"chat":
			var k := str(ev.get("canal", ""))
			if not msgs.has(k):
				return
			msgs[k].append(ev)
			if msgs[k].size() > GUARDA:
				msgs[k].pop_front()
			todas.append(ev)
			if todas.size() > GUARDA:
				todas.pop_front()
			if k == "geral" and geral_mudo:
				return
			_refazer_caixa()
			var meu: bool = ev.get("meu", false) == true
			if aberto() and aba == k:
				for c in lista.get_children(): # "Nenhuma mensagem ainda" sai
					if c is Label:
						c.queue_free()
				lista.add_child(_linha(ev, 15, true))
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
			if not meu and k == "amigos" and m.sons:
				m.sons.tocar("pano", -16.0)

func _process(dt: float) -> void:
	# a caixa de leitura some escrevendo (a janela mostra tudo), com menu aberto, na conversa com NPC e no modo construção
	var menu_aberto: bool = (m.menu and m.menu.aberto()) or (m.menu_topo and m.menu_topo.aberto())
	var hud_livre: bool = m.hud != null and not m.hud.esconder_combate and not m.hud.modo_construcao
	caixa.visible = caixa_lista.get_child_count() > 0 and not aberto() and not menu_aberto and hud_livre
	_atualizar_botao(dt)
	if not aberto():
		return
	# o teclado do celular sobe: a barra sobe junto. Fechou o teclado (botão voltar do Android): o chat volta a ser só a caixa
	var t := _altura_teclado()
	if t > 0.0:
		_teclado_visto = true
		_teclado_zero_t = 0.0
	elif _teclado_visto:
		_teclado_zero_t += dt
		if _teclado_zero_t > 0.25 and not _historico:
			fechar()
			return
	if absf(t - _teclado) > 0.5:
		_teclado = t
		_posicionar()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_SIZE_CHANGED and painel != null:
		_posicionar()

# PC: Enter abre o chat (no celular não existe Enter fora do campo de texto)
func _unhandled_key_input(ev: InputEvent) -> void:
	if ev is InputEventKey and ev.pressed and not ev.echo:
		if (ev.keycode == KEY_ENTER or ev.keycode == KEY_KP_ENTER) and not aberto() and m.on() and not (m.menu and m.menu.aberto()):
			abrir()
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

extends CanvasLayer
const Idioma = preload("res://idioma.gd") # inglês (idioma.gd): texto montado também sai traduzido
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
var msgs := {"geral": [], "amigos": [], "time": []}
var todas: Array = [] # os dois canais em ordem de chegada (a caixa de leitura)
var nao_lidas := {"geral": 0, "amigos": 0, "time": 0}
var aba := "geral"
# aba: "geral" ou "pm:<conta>". Mensagem privada (André 2026-11-06: "tipo um pm, private msg pra cada amigo"; "na janela não é
# pra aparecer amigos [...] aparece só o nome da pessoa que você abriu o privado na aba"): cada privada é uma aba com o nome
# do amigo. Abre pelo "Msg" da lista de amigos (ou quando ele te manda uma) e fica salva no celular até fechar no "x".
var abas_pm: Array = [] # [{c, nome}]
var abas_box: HBoxContainer
const COR_PM := Color("e6a8ff") # lilás das mensagens privadas
# aba Time (André 2026-11-11: "quando eu tiver em time com 2, 3 jogadores [...] eu falo com eles todos"): fala com todo o time
# de uma vez, NPCs inclusive (Cecília, Dario e os aventureiros ouvem dicas e comandos como no privado e respondem no time)
const COR_TIME := Color("7ee08a")
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

# o número da aba Amigos: todos os amigos juntos + as conversas privadas
func _nao_lidas_amigos() -> int:
	var n := 0
	for k in nao_lidas:
		if k != "geral":
			n += int(nao_lidas[k])
	return n

func _nao_lidas_pm() -> int:
	var n := 0
	for k in nao_lidas:
		if str(k).begins_with("pm:"):
			n += int(nao_lidas[k])
	return n

# de que conversa é a mensagem: o geral, todos os amigos ou "pm:<conta do outro>"
static func chave_de(x: Dictionary) -> String:
	var k := str(x.get("canal", ""))
	if k == "pm":
		return "pm:" + str(x.get("alvo", "") if x.get("meu", false) == true else x.get("c", ""))
	return k

# o nome de quem está do outro lado da conversa privada
static func outro_nome(x: Dictionary) -> String:
	return str(x.get("alvoNome", "") if x.get("meu", false) == true else x.get("nome", ""))

func _chave_atual() -> String:
	return aba

# abrir direto a conversa privada com um amigo (botão "Msg" na lista de amigos do Multijogador)
func abrir_pm(conta: String, nome := "") -> void:
	if aberto():
		fechar()
	_abrir_aba_pm(conta, nome)
	abrir("pm:" + conta)

# põe a aba da conversa privada (se ainda não tem) e guarda no celular
func _abrir_aba_pm(conta: String, nome := "") -> bool:
	for t in abas_pm:
		if str(t.c) == conta:
			if nome != "" and str(t.nome) != nome:
				t.nome = nome
				salvar()
			return false
	abas_pm.append({"c": conta, "nome": nome if nome != "" else _nome_pm("pm:" + conta)})
	salvar()
	return true

# "x" da aba: fecha a conversa (as mensagens continuam guardadas; abre de novo pelo Msg)
func fechar_aba_pm(conta: String) -> void:
	for t in abas_pm.duplicate():
		if str(t.c) == conta:
			abas_pm.erase(t)
	nao_lidas.erase("pm:" + conta)
	if aba == "pm:" + conta:
		aba = "geral"
	salvar()
	_atualizar_selo()
	montar()

func _atualizar_selo() -> void:
	if _selo == null:
		return
	var n: int = _nao_lidas_pm() + int(nao_lidas.get("time", 0)) + (0 if geral_mudo else int(nao_lidas.get("geral", 0)))
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
	# abas: Geral e uma para cada conversa privada aberta (rola para o lado quando são muitas)
	var rolar_abas := ScrollContainer.new()
	rolar_abas.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	rolar_abas.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	rolar_abas.custom_minimum_size = Vector2(0, 36)
	abas_box = HBoxContainer.new()
	abas_box.add_theme_constant_override("separation", 4)
	rolar_abas.add_child(abas_box)
	cab.add_child(rolar_abas)
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
	elif int(nao_lidas.get("time", 0)) > 0 and int(nao_lidas.get(aba, 0)) == 0:
		aba = "time" # o time falou: abre no time
	elif _nao_lidas_pm() > 0 and int(nao_lidas.get(aba, 0)) == 0 and (geral_mudo or int(nao_lidas.get("geral", 0)) == 0):
		for t in abas_pm: # abre na privada que tem mensagem nova
			if int(nao_lidas.get("pm:" + str(t.c), 0)) > 0:
				aba = "pm:" + str(t.c)
				break
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
	nao_lidas["geral"] = 0
	salvar()
	_atualizar_selo()
	_refazer_caixa()
	if aberto():
		montar()

func _refazer_abas() -> void:
	if aba.begins_with("pm:"):
		var tem := false
		for t in abas_pm:
			if "pm:" + str(t.c) == aba:
				tem = true
		if not tem:
			aba = "geral"
	for c in abas_box.get_children():
		abas_box.remove_child(c)
		c.queue_free()
	if aba == "time" and not _tem_aba_time():
		aba = "geral"
	var lista_abas: Array = [["geral", "Geral (mudo)" if geral_mudo else "Geral", ""]]
	if _tem_aba_time():
		lista_abas.append(["time", "Time", ""])
	for t in abas_pm:
		lista_abas.append(["pm:" + str(t.c), str(t.nome), str(t.c)])
	for it in lista_abas:
		var k: String = it[0]
		var n := int(nao_lidas.get(k, 0))
		var b := Button.new()
		b.focus_mode = Control.FOCUS_NONE
		b.custom_minimum_size = Vector2(96 if k == "geral" else 80, 34)
		b.add_theme_font_size_override("font_size", 15)
		b.set_meta("pt", it[1] if n == 0 or (k == "geral" and geral_mudo) else "%s (%d)" % [it[1], n]) # o guia das missões acha o botão pelo texto em português
		b.text = Idioma.frase(str(b.get_meta("pt")))
		Menu.estilo_botao(b, k == aba)
		if k != "geral":
			var cor: Color = COR_TIME if k == "time" else COR_PM
			b.add_theme_color_override("font_color", cor if k == aba else Color(cor, 0.75))
		b.pressed.connect(func(): trocar_aba(k))
		abas_box.add_child(b)
		if k.begins_with("pm:"): # "x" para fechar a conversa
			var c: String = it[2]
			var x := Button.new()
			x.text = "x"
			x.focus_mode = Control.FOCUS_NONE
			x.custom_minimum_size = Vector2(26, 34)
			x.add_theme_font_size_override("font_size", 13)
			Menu.estilo_botao(x, false)
			x.add_theme_color_override("font_color", Menu.APAGADO)
			x.pressed.connect(func(): fechar_aba_pm(c))
			abas_box.add_child(x)

func montar() -> void:
	_refazer_abas()
	mudo_b.set_pressed_no_signal(geral_mudo)
	var chave := _chave_atual()
	nao_lidas[chave] = 0
	_atualizar_selo()
	var on: bool = m.on()
	var mudo: bool = aba == "geral" and geral_mudo
	var dica := ""
	if not on:
		dica = "O chat é só online. Entre com a sua conta Google pelo menu Multijogador."
	elif aba == "time" and not em_time():
		dica = "Você saiu do time. Entre num time pelo menu Multijogador para falar com ele."
	elif mudo:
		dica = "Chat geral silenciado: as mensagens do geral não aparecem para você. Desligue \"Silenciar geral\" para ver de novo."
	aviso_l.text = Idioma.frase(dica)
	aviso_l.visible = dica != ""
	var pode: bool = on and not mudo and (aba != "time" or em_time())
	campo.editable = pode
	enviar_b.disabled = not pode
	if aba == "geral":
		campo.placeholder_text = "Escreva para todo mundo…"
	elif aba == "time":
		campo.placeholder_text = "Escreva para todo o time…"
	else:
		campo.placeholder_text = "Mensagem privada para %s…" % _nome_pm(chave)
	for c in lista.get_children():
		lista.remove_child(c)
		c.queue_free()
	if mudo:
		return
	var l: Array = msgs.get(chave, [])
	if l.is_empty() and on:
		lista.add_child(Menu.rotulo("Nenhuma mensagem ainda. O que você escrever aqui chega a todos do time, NPCs também." if aba == "time" else "Nenhuma mensagem ainda. Diga oi!", 14, Menu.APAGADO))
	for x in l:
		lista.add_child(_linha(x, 15, true))
	_descer()

# no time agora (amigos.gd recebe o time do servidor)
func em_time() -> bool:
	return m.amigos != null and m.amigos.em_time()

# a aba Time aparece no time (e continua enquanto tiver conversa dele guardada)
func _tem_aba_time() -> bool:
	return em_time() or not msgs.get("time", []).is_empty()

# abrir direto no time (botão "Falar com o time" do Multijogador)
func abrir_time() -> void:
	if aberto():
		fechar()
	abrir("time")

func _nome_pm(chave: String) -> String:
	var c := chave.substr(3)
	if m.amigos:
		for a in m.amigos.lista:
			if str(a.get("c", "")) == c:
				return str(a.get("nome", ""))
	for x in msgs.get(chave, []):
		return outro_nome(x)
	return "amigo"

func _descer() -> void:
	await get_tree().process_frame
	if is_instance_valid(rolar):
		rolar.scroll_vertical = int(rolar.get_v_scroll_bar().max_value)

func enviar() -> void:
	var t := campo.text.strip_edges()
	var chave := _chave_atual()
	if t == "" or not m.on() or (aba == "geral" and geral_mudo) or (aba == "time" and not em_time()):
		return
	if chave.begins_with("pm:"):
		m.rede("chat", {"canal": "pm", "para": chave.substr(3), "texto": t.left(MAX)})
	else:
		m.rede("chat", {"canal": chave, "texto": t.left(MAX)})
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
	var pm: bool = str(x.get("canal", "")) == "pm"
	var do_time: bool = str(x.get("canal", "")) == "time"
	var cor_nome: Color = Menu.OURO_CLARO if x.get("meu", false) == true else (COR_AMIGO if amigo else COR_PM if pm else COR_TIME if do_time else Color(0.86, 0.72, 0.5))
	var s := ""
	if com_hora:
		s += "[color=#%s]%s[/color]  " % [Menu.APAGADO.to_html(false), _hora(float(x.get("hora", 0)))]
	elif amigo:
		s += "[color=#%s][lb]Amigos][/color] " % COR_AMIGO.to_html(false)
	elif do_time:
		s += "[color=#%s][lb]Time][/color] " % COR_TIME.to_html(false)
	elif pm: # na caixa de baixo: de quem veio ou para quem foi
		s += "[color=#%s][lb]%s %s][/color] " % [COR_PM.to_html(false), "Para" if x.get("meu", false) == true else "De", _seguro(outro_nome(x))]
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
			msgs = {"geral": [], "amigos": [], "time": []}
			todas = []
			for x in ev.get("lista", []):
				if x is Dictionary and str(x.get("canal", "")) in ["geral", "pm", "time"]: # "todos os amigos" saiu da janela (André)
					var kk := chave_de(x)
					if not msgs.has(kk):
						msgs[kk] = []
					msgs[kk].append(x)
					todas.append(x)
			_refazer_caixa()
			if aberto():
				montar()
		"chat":
			if not (str(ev.get("canal", "")) in ["geral", "pm", "time"]):
				return
			var k := chave_de(ev)
			if k.begins_with("pm:") and ev.get("meu", false) != true and _abrir_aba_pm(k.substr(3), outro_nome(ev)) and aberto():
				_refazer_abas() # amigo mandou privada: a aba com o nome dele aparece
			elif k == "time" and msgs.get("time", []).is_empty() and aberto():
				_refazer_abas.call_deferred() # primeira do time: a aba aparece
			if not msgs.has(k):
				msgs[k] = []
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
			if aberto() and _chave_atual() == k:
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
					nao_lidas[k] = int(nao_lidas.get(k, 0)) + 1
				_atualizar_selo()
				if aberto():
					montar()
			if not meu and k != "geral" and m.sons:
				m.sons.tocar("pano", -16.0)

func _process(dt: float) -> void:
	var t0_parte := Time.get_ticks_usec()
	_process_parte(dt)
	if Time.get_ticks_usec() - t0_parte >= 1000 and Engine.has_meta("lentidao"): # quadro lento (lentidao.gd)
		Engine.get_meta("lentidao").ev("chat", t0_parte)

func _process_parte(dt: float) -> void:
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
	nao_lidas = {"geral": 0, "amigos": 0, "time": 0}
	_atualizar_selo()
	if aberto():
		montar()

# modo de editar a interface (editar_hud.gd): a caixa de leitura muda de lugar e de tamanho
# (cresce em volta do canto de baixo à esquerda, que é de onde ela sobe com as linhas)
const ALTURA_EDITAR := 110.0 # área que o modo de edição mostra para a caixa (cabe as 5 linhas)
var caixa_d := Vector2.ZERO
var caixa_s := 1.0
func posicionar(d: Vector2, s: float) -> void:
	caixa_d = d
	caixa_s = s
	caixa.offset_left = MARGEM + d.x
	caixa.offset_right = MARGEM + LARGURA_CAIXA + d.x
	caixa.offset_bottom = -MARGEM + d.y
	caixa.offset_top = -MARGEM - 10 + d.y
	caixa.scale = Vector2(s, s)
	caixa.pivot_offset = Vector2(0, caixa.size.y)
	if not caixa.resized.is_connected(_caixa_pivo):
		caixa.resized.connect(_caixa_pivo)

func _caixa_pivo() -> void:
	caixa.pivot_offset = Vector2(0, caixa.size.y)

func area() -> Rect2:
	var t := raiz.size
	var h := ALTURA_EDITAR * caixa_s
	return Rect2(Vector2(MARGEM + caixa_d.x, t.y - MARGEM + caixa_d.y - h), Vector2(LARGURA_CAIXA * caixa_s, h))

# ---------- guardar no aparelho ----------
func carregar() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(ARQUIVO) != OK:
		return
	geral_mudo = bool(cfg.get_value("chat", "geral_mudo", false))
	var ab = cfg.get_value("chat", "abas_pm", [])
	if ab is Array:
		for t in ab:
			if t is Dictionary and t.has("c"):
				abas_pm.append({"c": str(t.c), "nome": str(t.get("nome", ""))})

func salvar() -> void:
	var cfg := ConfigFile.new()
	cfg.load(ARQUIVO)
	cfg.set_value("chat", "geral_mudo", geral_mudo)
	cfg.set_value("chat", "abas_pm", abas_pm)
	cfg.save(ARQUIVO)

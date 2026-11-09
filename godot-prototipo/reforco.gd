extends CanvasLayer
# Janelinha do reforço de equipamento (igual ao Quimera, André 2026-11-07; regras em REFORCO de shared/dados.js).
# Sem o atributo a peça reforçada não equipa e, vestida, não dá bônus (progresso reforco_ok, igual ao Quimera).
# Na mochila: toque na peça e em "Reforçar 1 vez" ou "Até o máximo" (André 2026-11-09: era "Até cancelar"). A janela mostra a peça, "+e → +e+1 · chance X%",
# uma barrinha dourada que enche em 1,6 s ("Reforçando…") e depois SUCESSO! (verde) ou FALHOU… (vermelho, com "Voltou pra +N"
# ou "Continua +N"). Toque para continuar (ou fecha sozinha em 1,8 s). No automático tenta de novo até chegar no máximo,
# acabar o ouro ou tocar em Cancelar ("Vai parar depois deste"); embaixo fica a fila de +N que deram certo e errado.
# Online quem cobra e sorteia é o servidor (item: { acao: 'reforcar' }, resposta no evento 'reforco'); sem internet, aqui.

const Menu = preload("res://menu.gd")
const VERDE := Color("8dff7a")
const VERMELHO := Color("ff7a5a")

var m # main.gd
var veu: ColorRect
var caixa: PanelContainer
var estilo: StyleBoxFlat
var icone: TextureRect
var nome_ui: Label
var info_ui: Label
var auto_ui: Label
var barra_fundo: Panel
var barra: ColorRect
var resultado_ui: Label
var resultado2_ui: Label
var toque_ui: Label
var cancelar_ui: Button
var fila_ui: HFlowContainer

var onde := {} # {"i": lugar da mochila} ou {"lugar": lugar do corpo}
var fase := "" # "" fechada · "barra" enchendo · "resultado" mostrando
var t := 0.0
var resp = null # o que voltou (servidor ou sem internet)
var auto := false
var parar := false
var tentativas := 0
var ouro0 := 0
var e0 := 0
var espera := 0.0 # automático: espera o progresso do servidor chegar antes da próxima

func _init(principal) -> void:
	m = principal
	layer = 22 # acima do menu do personagem (20)

func _ready() -> void:
	veu = ColorRect.new()
	veu.color = Color(0, 0, 0, 0.55)
	veu.set_anchors_preset(Control.PRESET_FULL_RECT)
	veu.mouse_filter = Control.MOUSE_FILTER_STOP
	veu.gui_input.connect(_tocou)
	veu.visible = false
	add_child(veu)
	var centro := CenterContainer.new()
	centro.set_anchors_preset(Control.PRESET_FULL_RECT)
	centro.mouse_filter = Control.MOUSE_FILTER_IGNORE
	veu.add_child(centro)
	caixa = PanelContainer.new()
	estilo = Menu.caixa(Color(0.118, 0.094, 0.07, 0.98), Color(0.925, 0.808, 0.55, 0.45), 1, 16, 0)
	estilo.content_margin_left = 18
	estilo.content_margin_right = 18
	estilo.content_margin_top = 16
	estilo.content_margin_bottom = 16
	caixa.add_theme_stylebox_override("panel", estilo)
	caixa.custom_minimum_size = Vector2(340, 0)
	caixa.mouse_filter = Control.MOUSE_FILTER_IGNORE
	centro.add_child(caixa)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	caixa.add_child(v)
	var cab := HBoxContainer.new()
	cab.add_theme_constant_override("separation", 10)
	cab.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(cab)
	var fi := PanelContainer.new()
	fi.add_theme_stylebox_override("panel", Menu.caixa(Color(0, 0, 0, 0.3), Color(0, 0, 0, 0), 0, 9))
	fi.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cab.add_child(fi)
	icone = TextureRect.new()
	icone.custom_minimum_size = Vector2(46, 46)
	icone.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	icone.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	icone.mouse_filter = Control.MOUSE_FILTER_IGNORE
	fi.add_child(icone)
	var tx := VBoxContainer.new()
	tx.add_theme_constant_override("separation", 1)
	tx.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tx.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cab.add_child(tx)
	nome_ui = _rot("", 16, Menu.TEXTO)
	tx.add_child(nome_ui)
	info_ui = _rot("", 13, Color("cbbfa8"))
	tx.add_child(info_ui)
	auto_ui = _rot("", 13, Color("cbbfa8"))
	tx.add_child(auto_ui)
	barra_fundo = Panel.new()
	barra_fundo.custom_minimum_size = Vector2(0, 14)
	barra_fundo.add_theme_stylebox_override("panel", Menu.caixa(Color(0, 0, 0, 0.45), Color(0.925, 0.808, 0.55, 0.35), 1, 7))
	barra_fundo.clip_contents = true
	barra_fundo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(barra_fundo)
	barra = ColorRect.new()
	barra.mouse_filter = Control.MOUSE_FILTER_IGNORE
	barra.position = Vector2(1, 1)
	barra_fundo.add_child(barra)
	var res := VBoxContainer.new()
	res.custom_minimum_size = Vector2(0, 48)
	res.alignment = BoxContainer.ALIGNMENT_CENTER
	res.add_theme_constant_override("separation", 0)
	res.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(res)
	resultado_ui = _rot("Reforçando…", 16, Color("e8dcc0"), true)
	res.add_child(resultado_ui)
	resultado2_ui = _rot("", 13, Color("cbbfa8"), true)
	res.add_child(resultado2_ui)
	toque_ui = _rot("toque pra continuar", 12, Color(0.8, 0.75, 0.66, 0.7), true)
	res.add_child(toque_ui)
	fila_ui = HFlowContainer.new()
	fila_ui.alignment = FlowContainer.ALIGNMENT_CENTER
	fila_ui.add_theme_constant_override("h_separation", 4)
	fila_ui.add_theme_constant_override("v_separation", 4)
	fila_ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(fila_ui)
	cancelar_ui = Button.new()
	cancelar_ui.text = "⏹ Cancelar"
	cancelar_ui.focus_mode = Control.FOCUS_NONE
	cancelar_ui.add_theme_font_size_override("font_size", 14)
	cancelar_ui.custom_minimum_size = Vector2(0, 38)
	Menu.estilo_botao(cancelar_ui, false)
	cancelar_ui.pressed.connect(func():
		parar = true
		cancelar_ui.text = "Vai parar depois deste"
		cancelar_ui.disabled = true)
	v.add_child(cancelar_ui)

func _rot(s: String, tam: int, cor: Color, centro := false) -> Label:
	var l := Menu.rotulo(s, tam, cor)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if centro:
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	return l

func aberta() -> bool:
	return fase != ""

# a peça de agora (online o progresso troca de objeto quando o servidor manda o novo)
func peca():
	var P = m.P
	if onde.has("i"):
		var i: int = int(onde.i)
		return P.prog.mochila[i] if i >= 0 and i < P.prog.mochila.size() else null
	return P.prog.equip.get(str(onde.get("lugar", "")))

# começa: uma vez (automatico = false) ou até cancelar
func comecar(lugar_onde: Dictionary, automatico: bool) -> void:
	if aberta():
		return
	onde = lugar_onde
	auto = automatico
	parar = false
	tentativas = 0
	ouro0 = int(m.P.prog.ouro)
	var it = peca()
	if it == null:
		return
	e0 = int(it.get("e", 0))
	for c in fila_ui.get_children():
		c.queue_free()
	fila_ui.visible = auto
	cancelar_ui.visible = auto
	cancelar_ui.disabled = false
	cancelar_ui.text = "⏹ Cancelar"
	_tentar()

func _tentar() -> void:
	var P = m.P
	var it = peca()
	if it == null:
		_fechar()
		return
	var erro: String = P.reforco_erro(it)
	if erro != "":
		# o automático para sozinho no limite da peça, no limite do atributo ou quando o ouro acaba
		m.hud.aviso(_resumo(erro) if auto and tentativas > 0 else erro)
		if m.sons:
			m.sons.tocar("pano", -8.0)
		_fechar()
		return
	var e := int(it.get("e", 0))
	var cor: Color = P.cor_item(it)
	icone.texture = Menu.icone_tex(P.icone_item(it))
	nome_ui.text = P.nome_item(it)
	nome_ui.add_theme_color_override("font_color", cor)
	info_ui.text = "+%d → +%d · chance %d%% · %d de ouro" % [e, e + 1, P.chance_reforco(e), P.custo_reforco(it)]
	tentativas += 1
	auto_ui.visible = auto
	auto_ui.text = "Automático: tentativa %d · %d de ouro" % [tentativas, ouro0 - int(P.prog.ouro) + P.custo_reforco(it)]
	resultado_ui.text = "Reforçando…"
	resultado_ui.add_theme_color_override("font_color", Color("e8dcc0"))
	resultado_ui.add_theme_font_size_override("font_size", 16)
	resultado2_ui.text = ""
	toque_ui.visible = false
	_pintar("")
	barra.color = Color("ffd76a")
	barra.size = Vector2(0, 12)
	resp = null
	fase = "barra"
	t = 0.0
	veu.visible = true
	if m.sons:
		m.sons.tocar("forja", -6.0, 0.06)
	if m.on():
		var msg := {"acao": "reforcar"}
		msg.merge(onde)
		m.rede("item", msg)
	else:
		resp = P.reforcar(it)

# o servidor respondeu (evento 'reforco' em online.gd)
func do_servidor(ev: Dictionary) -> void:
	if fase == "barra":
		resp = ev

func _pintar(como: String) -> void:
	var b := Color(0.925, 0.808, 0.55, 0.45)
	estilo.shadow_size = 0
	if como == "win":
		b = VERDE
		estilo.shadow_color = Color(0.47, 1, 0.43, 0.35)
		estilo.shadow_size = 18
	elif como == "lose":
		b = VERMELHO
		estilo.shadow_color = Color(1, 0.35, 0.27, 0.3)
		estilo.shadow_size = 18
	estilo.border_color = b
	caixa.scale = Vector2(1.04, 1.04) if como == "win" else Vector2.ONE
	caixa.pivot_offset = caixa.size * 0.5

func _process(dt: float) -> void:
	if fase == "barra":
		t += dt
		var dur: float = float(m.P.reforco_dados().get("tempo", 1.6))
		barra.size = Vector2((barra_fundo.size.x - 2) * min(1.0, t / dur), 12)
		if t >= dur and resp != null:
			_mostrar()
		elif t > 7.0: # o servidor não respondeu
			m.hud.aviso("O servidor não respondeu. Tente de novo")
			_fechar()
	elif fase == "resultado":
		t += dt
		if t >= 1.8:
			_continuar()
	elif fase == "esperar":
		espera -= dt
		var it = peca()
		if espera <= 0.0 or (it != null and resp != null and int(it.get("e", 0)) == int(resp.get("e", -1))):
			_tentar()

func _mostrar() -> void:
	var P = m.P
	if resp.has("erro"):
		m.hud.aviso(str(resp.erro))
		_fechar()
		return
	var ok: bool = resp.get("ok", false) == true
	var de := int(resp.get("de", 0))
	var e := int(resp.get("e", 0))
	fase = "resultado"
	t = 0.0
	barra.size = Vector2(barra_fundo.size.x - 2, 12)
	barra.color = Color("6ee06a") if ok else Color("c0503a")
	_pintar("win" if ok else "lose")
	resultado_ui.add_theme_font_size_override("font_size", 26)
	if ok:
		resultado_ui.text = "SUCESSO!"
		resultado_ui.add_theme_color_override("font_color", VERDE)
		resultado2_ui.text = str(resp.get("nome", ""))
		if m.sons:
			m.sons.tocar("nivel", -4.0)
	else:
		resultado_ui.text = "FALHOU…"
		resultado_ui.add_theme_color_override("font_color", Color("ff8a7a"))
		resultado2_ui.text = ("Voltou pra +%d" % e) if e < de else ("Continua +%d" % e)
		if m.sons:
			m.sons.tocar("pano", -4.0)
	toque_ui.visible = true
	if auto:
		var chip := PanelContainer.new()
		chip.add_theme_stylebox_override("panel", Menu.caixa(Color(0.5, 0.86, 0.41, 0.25) if ok else Color(1, 0.43, 0.35, 0.2), Color(0, 0, 0, 0), 0, 6))
		chip.mouse_filter = Control.MOUSE_FILTER_IGNORE
		chip.add_child(_rot("+%d" % (de + 1), 11, Color("b8ffa8") if ok else Color("ffb3a3")))
		fila_ui.add_child(chip)
	if m.menu:
		m.menu.atualizar()

func _tocou(ev: InputEvent) -> void:
	if fase == "resultado" and ((ev is InputEventMouseButton and ev.pressed) or (ev is InputEventScreenTouch and ev.pressed)):
		_continuar()

func _continuar() -> void:
	var it = peca()
	if auto and not parar and it != null and int(resp.get("e", 0)) < m.P.reforco_max(it):
		fase = "esperar" # online: espera o progresso novo chegar (até 1,5 s) para cobrar e mostrar certo
		espera = 1.5 if m.on() else 0.0
		return
	if auto and tentativas > 0:
		m.hud.aviso(_resumo("cancelado" if parar else "a peça chegou no máximo"))
	_fechar()

# "Reforço automático (chegou no máximo da peça): +0 → +5 · 9 tentativas · 230 de ouro"
func _resumo(por: String) -> String:
	var it = peca()
	var e := int(it.get("e", 0)) if it != null else e0
	return "Reforço automático parou (%s): +%d → +%d · %d %s · %d de ouro" % [por, e0, e, tentativas, "tentativa" if tentativas == 1 else "tentativas", ouro0 - int(m.P.prog.ouro)]

func _fechar() -> void:
	fase = ""
	veu.visible = false
	_pintar("")
	if m.menu:
		m.menu.atualizar()

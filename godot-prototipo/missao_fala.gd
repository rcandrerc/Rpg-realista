extends CanvasLayer
# Fala da missão numa janela só dela (André 2026-11-18: "os chats das missões devem aparecer em outra aba... ficou muita
# informação nessa aba"). A janela do NPC fica só com as opções; o que o NPC conta da missão (o pedido, o lembrete com o
# porquê e o que falta, a entrega) aparece aqui, com o rosto e o nome dele e o nome da missão. Não trava o jogo: fecha no
# Ok, quando chega a próxima fala ou quando o herói se afasta do NPC. O texto vem do servidor (shared/dados.js HISTORIA:
# pedido, lembra, pronto; a linha de baixo é o que falta, separada da história).
# Depois (André 2026-11-18, foto da janela do Tomás: "só a primeira que tá dentro do menu ainda"): a fala de todo NPC
# sai da janela de opções e aparece aqui também, em cima dela (fala_npc), sem o Ok; some quando a janela do NPC fecha.
const Menu = preload("res://menu.gd")
const Idioma = preload("res://idioma.gd")
const LONGE := 9.0 # m do NPC: andou para longe, a janela some
var m
var raiz: Control
var retrato_ui: TextureRect
var nome_ui: Label
var missao_ui: Label
var fala_ui: Label
var falta_ui: Label
var _npc = null
var caixa: PanelContainer
var ok_btn: Button
var _da_janela := false # true: fala comum do NPC, em cima da janela de opções (conversa.gd)

func _init(principal) -> void:
	m = principal
	layer = 16 # acima da janela do NPC (15), abaixo do menu do personagem (20)

func _ready() -> void:
	raiz = Control.new()
	raiz.set_anchors_preset(Control.PRESET_FULL_RECT)
	raiz.mouse_filter = Control.MOUSE_FILTER_IGNORE
	raiz.visible = false
	add_child(raiz)
	caixa = PanelContainer.new()
	caixa.add_theme_stylebox_override("panel", Menu.caixa(Menu.FUNDO, Menu.LILAS.darkened(0.2), 2, 10, 14))
	caixa.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	caixa.grow_horizontal = Control.GROW_DIRECTION_BOTH
	caixa.grow_vertical = Control.GROW_DIRECTION_BEGIN
	caixa.offset_left = -420 # puxada para a esquerda: à direita ficam os botões de luta e de skill
	caixa.offset_right = 290
	caixa.offset_bottom = -18
	raiz.add_child(caixa)
	var lado := HBoxContainer.new()
	lado.add_theme_constant_override("separation", 14)
	caixa.add_child(lado)
	var moldura := Control.new()
	moldura.custom_minimum_size = Vector2(84, 84)
	moldura.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	lado.add_child(moldura)
	retrato_ui = TextureRect.new()
	retrato_ui.set_anchors_preset(Control.PRESET_FULL_RECT)
	retrato_ui.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	retrato_ui.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	var sh := Shader.new()
	sh.code = "shader_type canvas_item;\nvoid fragment(){ vec4 c = texture(TEXTURE, UV); float r = length(UV - vec2(0.5)); COLOR = vec4(c.rgb, c.a * (1.0 - smoothstep(0.47, 0.49, r))); }"
	var mat := ShaderMaterial.new()
	mat.shader = sh
	retrato_ui.material = mat
	moldura.add_child(retrato_ui)
	var aro := Panel.new()
	aro.set_anchors_preset(Control.PRESET_FULL_RECT)
	aro.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sa := StyleBoxFlat.new()
	sa.bg_color = Color(0, 0, 0, 0)
	sa.border_color = Menu.LILAS
	sa.set_border_width_all(3)
	sa.set_corner_radius_all(42)
	sa.anti_aliasing = true
	aro.add_theme_stylebox_override("panel", sa)
	moldura.add_child(aro)
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.add_theme_constant_override("separation", 3)
	lado.add_child(col)
	var topo := HBoxContainer.new()
	topo.add_theme_constant_override("separation", 10)
	col.add_child(topo)
	nome_ui = Menu.rotulo("", 20, Menu.OURO_CLARO)
	topo.add_child(nome_ui)
	missao_ui = Menu.rotulo("", 13, Menu.LILAS)
	missao_ui.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	missao_ui.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	missao_ui.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	topo.add_child(missao_ui)
	var linha := ColorRect.new()
	linha.color = Menu.BORDA
	linha.custom_minimum_size = Vector2(0, 1)
	col.add_child(linha)
	fala_ui = Menu.rotulo("", 15, Menu.TEXTO)
	fala_ui.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	fala_ui.custom_minimum_size = Vector2(380, 0)
	col.add_child(fala_ui)
	var baixo := HBoxContainer.new()
	baixo.add_theme_constant_override("separation", 10)
	col.add_child(baixo)
	falta_ui = Menu.rotulo("", 13, Menu.OURO_CLARO)
	falta_ui.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	falta_ui.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	falta_ui.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	baixo.add_child(falta_ui)
	ok_btn = Button.new()
	ok_btn.set_meta("pt", "Ok")
	ok_btn.text = Idioma.frase("Ok")
	ok_btn.focus_mode = Control.FOCUS_NONE
	ok_btn.custom_minimum_size = Vector2(96, 34)
	ok_btn.add_theme_font_size_override("font_size", 15)
	Menu.estilo_botao(ok_btn, true)
	ok_btn.pressed.connect(fechar)
	baixo.add_child(ok_btn)

func aberto() -> bool:
	return raiz != null and raiz.visible

# npc_id: quem fala; texto: a fala (a linha depois do primeiro \n é o que falta); missao: id da missão (HISTORIA)
func mostrar(npc_id: String, texto: String, missao: String) -> void:
	_npc = null
	_por_baixo(true)
	for n in m.npcs:
		if str(n.id) == npc_id:
			_npc = n
	var partes := texto.split("\n", true, 1)
	fala_ui.text = Idioma.frase(partes[0])
	falta_ui.text = ("▸ " + Idioma.frase(partes[1])) if partes.size() > 1 else ""
	nome_ui.text = Idioma.frase(str(_npc.get("nome", "")).get_slice(",", 0)) if _npc != null else ""
	var nome_m := ""
	for M in m.nevoa.H.get("missoes", []) if m.nevoa and m.nevoa.get("H") is Dictionary else []:
		if str(M.get("id", "")) == missao:
			nome_m = str(M.get("nome", ""))
	missao_ui.text = Idioma.frase("Missão: %s" % nome_m) if nome_m != "" else Idioma.frase("Missão")
	retrato_ui.texture = m.conversa.retrato_de(_npc) if _npc != null else null
	raiz.visible = true

# fala comum do NPC (o que a janela de opções dizia): aqui, em cima da janela dele, sem Ok nem nome de missão
func fala_npc(n: Dictionary, texto: String, alto_janela: float) -> void:
	if texto == "" or texto == "...":
		fechar_npc()
		return
	_npc = n
	_por_baixo(false, alto_janela)
	fala_ui.text = texto
	falta_ui.text = ""
	nome_ui.text = Idioma.frase(str(n.get("nome", "")).get_slice(",", 0))
	missao_ui.text = ""
	retrato_ui.texture = m.conversa.retrato_de(n)
	raiz.visible = true

func fechar_npc() -> void:
	if _da_janela:
		fechar()

# a fala da missão fica embaixo, com Ok; a fala comum fica em cima da janela de opções (alto = altura dela)
func _por_baixo(missao: bool, alto := 0.0) -> void:
	_da_janela = not missao
	ok_btn.visible = missao
	falta_ui.get_parent().visible = missao
	caixa.offset_bottom = -18.0 if missao else -(18.0 + alto + 8.0)
	caixa.offset_top = caixa.offset_bottom # cresce para cima a partir daqui (grow_vertical BEGIN)

func fechar() -> void:
	if raiz != null:
		raiz.visible = false
	_npc = null
	_da_janela = false

func _process(_dt: float) -> void:
	if not aberto() or _npc == null or m.heroi == null or not is_instance_valid(_npc.get("no")):
		return
	var p: Vector3 = _npc.no.position
	if Vector2(p.x - m.heroi.position.x, p.z - m.heroi.position.z).length() > LONGE or m.h.morto > 0.0:
		fechar()

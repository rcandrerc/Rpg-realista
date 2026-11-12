extends CanvasLayer
# Menu do personagem (ideia do Quimera, com cara mais adulta): abre tocando no painel de vida.
# Esquerda: o herói em 3D (arrasta para girar) com os 6 lugares de equipamento (Camisa, Calça, Botas | Arma, Acessório, Capa).
# Direita: abas Status (nível, XP, pontos de atributo e os números do herói) e Habilidades (Espada, Cajado e Gerais,
# com nível de cada skill, o que melhora no próximo e em qual botão de cada barra ela fica). Passivas no fim.
# Duas barras como no Quimera: a da espada e a do cajado (Trocar mostra a outra); toque em dois botões da barra para
# trocar de lugar. Quem decide é o servidor (online manda "atributo" e "barra"); sem internet muda só neste celular.
# Mochila (páginas de 10 x 4, até 4 páginas) e Loja da Rosa (Parte 2 do Quimera): toque num item para ver, equipar, usar ou vender; toque num lugar
# de equipamento para ver a peça e tirar. Online quem decide é o servidor (manda "item"); sem internet muda só aqui.
# Profissões (Parte 3 do Quimera): vigor, ouro e o nível de cada profissão; Ferreiro e Alfaiate com as receitas
# (Criar só perto da forja do Tomás ou da banca da Rosa; online quem confere e dá a peça é o servidor, mensagem "criar").
# André 2026-11-04: o menu ficou em dois. Tocar na barra de vida abre o do personagem (Status, Habilidades, Profissões
# e Aparência); o botão da mochila no menu do topo abre o da bolsa (Mochila e Criar, e a Loja perto de quem vende).
# Criar mostra tudo o que se cria no jogo, em submenus (Materiais, Armas, Armaduras, Estações, Casa, Móveis,
# Ferramentas): o que precisa de bigorna, fornalha ou bancada diz onde, e dá para ver mas só criar lá.
# A lista rola arrastando o dedo (feito aqui em _input: as linhas e os botões não deixavam o ScrollContainer rolar).

const Armadura = preload("res://armadura.gd")
const Titulos = preload("res://titulos.gd") # cores e enfeites dos títulos (aba Títulos)
const OURO := Color(0.80, 0.64, 0.36)
const OURO_CLARO := Color(0.95, 0.82, 0.55)
const TEXTO := Color(0.93, 0.89, 0.80)
const APAGADO := Color(0.72, 0.68, 0.60) # #b8ae9a
const FUNDO := Color(0.075, 0.065, 0.055, 0.97)
const FUNDO2 := Color(0.12, 0.105, 0.088, 1.0)
const FUNDO3 := Color(0.17, 0.148, 0.12, 1.0)
const BORDA := Color(0.42, 0.33, 0.20, 1.0)
const VERDE := Color(0.45, 0.78, 0.45)

const ARVORES := {"espada": "Espada", "cajado": "Cajado", "geral": "Gerais"}
const ARVORE_TXT := {
	"espada": "Com a espada na mão. Escala com Força. Cada skill sobe de nível usando.",
	"cajado": "Com o cajado na mão. Escala com Inteligência. Cada skill sobe de nível usando.",
	"geral": "Servem com a espada e com o cajado. Cada skill sobe de nível usando.",
}
const PLURAL := ["Comuns", "Raras", "Épicas", "Lendárias", "Míticas"] # "3 peças Raras (ou melhores)"
# Lugares do corpo (pedido do André, diferente do Quimera): cada um é um medalhão redondo em volta do boneco, na
# altura da parte do corpo, ligado a ela por um fio dourado. [id, nome, x, y (fração do palco), osso, lado do texto]
const SLOTS := [
	["cabeca", "Capacete", 0.17, 0.1, "J_Bip_C_Head", -1], ["corpo", "Camisa", 0.1, 0.34, "J_Bip_C_UpperChest", -1],
	["pernas", "Calça ou Short", 0.1, 0.58, "J_Bip_R_UpperLeg", -1], ["pes", "Botas", 0.17, 0.82, "J_Bip_R_Foot", -1],
	["capa", "Capa", 0.83, 0.16, "J_Bip_L_Shoulder", 1], ["acessorio", "Acessório", 0.9, 0.4, "J_Bip_C_Neck", 1],
	["arma", "Arma", 0.85, 0.64, "J_Bip_L_Hand", 1]]
const MEDALHAO := 52.0
# abas de cada menu (André 2026-11-04): barra de vida = personagem; botão da mochila no topo = bolsa
# André 2026-11-12: aba Títulos (títulos com bônus; um em uso por vez)
const ABAS_PERSONAGEM := ["status", "habilidades", "profissoes", "titulos", "aparencia"]
# André 2026-11-11: Missões saiu do menu do personagem e ganhou ícone no menu do topo (abre só ela)
const ABAS_MISSOES := ["missoes"]
const ABAS_BOLSA := ["mochila", "criar", "loja"]
# submenus da aba Criar
# "aqui" (André 2026-11-05: "unificar os menus"): o botão de ação da mesa abre esta mesma aba Criar no submenu do que
# a estação perto faz (Alfaiate e móveis na bancada, Ferreiro na bigorna, barras na fornalha); só aparece perto de uma.
const CATS_CRIAR := [["aqui", "Aqui"], ["materiais", "Materiais"], ["armas", "Armas"], ["armaduras", "Armaduras"], ["comida", "Comida"], ["estacoes", "Estações"],
	["casa", "Casa"], ["moveis", "Móveis"], ["ferramentas", "Ferramentas"]]
const NOME_ESTACAO := {"fornalha": "Fornalha", "bigorna": "Bigorna", "bancada": "Bancada de trabalho", "fogao": "Fogão a lenha"}

var m # main.gd
var raiz: Control
var aba := "status"
var arvore := "espada"
var conteudo: VBoxContainer
var rolagem: ScrollContainer
var botoes_aba := {}
var botoes_arvore := {}
var linha_arvores: HBoxContainer
var linha_prof: HBoxContainer
var botoes_prof := {}
var sub_prof := "lista" # aba Profissões: "lista", "fer" (Ferreiro) ou "alf" (Alfaiate)
const SUB_PROF := {"lista": "Profissões", "fer": "Ferreiro", "alf": "Alfaiate"}
var cat_criar := "materiais" # submenu aberto na aba Criar
var rar_criar := {} # receita -> raridade escolhida nas abas Armas e Armaduras (André 2026-11-09)
# Criar igual ao Quimera (André 2026-11-09, com print do Quimera: "eu quero exatamente assim"): Buscar, as estações
# perto em cima para alternar (Ver tudo = todas), e grupos sanfona (ARMADURAS, ARMAS...) com "dá para criar/total".
# André 2026-11-09: sem grupo Melhorar; evoluir/reforçar fica dentro de Armaduras (bancada) e de Armas (bigorna)
const GRUPOS_CRIAR := [["armaduras", "Armaduras"], ["armas", "Armas"], ["ferramentas", "Ferramentas"],
	["materiais", "Materiais"], ["comida", "Comida"], ["estacoes", "Estações"], ["casa", "Casa"], ["moveis", "Móveis"]]
var est_criar := "" # estação escolhida em cima ("" = Ver tudo)
var busca_criar := ""
var grupos_abertos := {} # grupo -> aberto
var lista_criar: VBoxContainer # só a lista se refaz ao digitar na busca (a caixa não perde o foco)
var linha_criar: HBoxContainer
var botoes_criar := {}
var titulo_nivel: Label
var vp: SubViewport
var boneco: Node3D
var boneco_anim: AnimationPlayer
var boneco_modo := ""
var esp: Node3D
var caj: Node3D
var giro := 0.4
var arrastando := false
var slot_arma: Dictionary = {}
var slots_ui := {} # lugar -> {icone, painel, no}
var fios: Control # fios dourados dos medalhões até o corpo
var cam_palco: Camera3D
var sel_mochila := -1 # item escolhido na mochila
var pag_mochila := 0 # página da mochila aberta (0..3; André 2026-11-03: 4 páginas de 10 x 4, compradas com ouro)
var sel_equip := "" # peça escolhida no corpo (lugar)
# André 2026-11-04: perto de quem compra (Rosa, Tomás) dá para marcar vários itens, ou Selecionar tudo, e vender de uma vez
var vendendo := false # modo de marcar itens para vender
var marcados := {} # lugar da mochila -> true
# André 2026-11-07: filtro de coleta (botão Filtro da mochila). O que está desmarcado não entra na mochila (o servidor decide)
var filtro_aberto := false
var filtro_lista := false # lista de todos os recursos aberta
var _confirma: Control # janelinha "tem certeza?" (apagar item, vender vários)
# André 2026-11-03: tocar num lugar do corpo abre a janela da peça: Tirar (vai para a mochila; dá para ficar só com a
# roupa de baixo) e a lista das peças da mochila que servem ali, comparadas com a vestida (melhor ou pior), com Trocar
var janela: Control # véu escuro + painel da peça (por cima do menu)
var janela_lugar := "" # lugar aberto ("" = fechada)
var janela_nome := ""
var janela_rolagem: ScrollContainer
var quadradinhos: Array = [] # "Mostrar capacete" (André 2026-11-03: quadradinho marcado = capacete aparece; desmarcado = rosto à mostra, a peça continua vestida)
var _sel = null # botão da barra escolhido para trocar de lugar: [barra, i]
var _arrastou := false # o dedo arrastou a lista: o botão embaixo dele não vale
var _arrasto_dentro := false
var _arrasto_soma := 0.0

func _init(principal) -> void:
	m = principal
	layer = 20 # acima da tela de login e do status online

func _ready() -> void:
	raiz = Control.new()
	raiz.set_anchors_preset(Control.PRESET_FULL_RECT)
	raiz.visible = false
	add_child(raiz)
	var escuro := ColorRect.new()
	escuro.color = Color(0, 0, 0, 0.55)
	escuro.set_anchors_preset(Control.PRESET_FULL_RECT)
	raiz.add_child(escuro)
	# moldura principal
	var moldura := Panel.new()
	moldura.set_anchors_preset(Control.PRESET_FULL_RECT)
	moldura.offset_left = 22
	moldura.offset_top = 14
	moldura.offset_right = -22
	moldura.offset_bottom = -14
	moldura.add_theme_stylebox_override("panel", caixa(FUNDO, OURO.darkened(0.25), 2, 10, 14))
	raiz.add_child(moldura)
	var tudo := HBoxContainer.new()
	tudo.set_anchors_preset(Control.PRESET_FULL_RECT)
	tudo.offset_left = 18
	tudo.offset_top = 14
	tudo.offset_right = -18
	tudo.offset_bottom = -14
	tudo.add_theme_constant_override("separation", 18)
	moldura.add_child(tudo)
	tudo.add_child(montar_esquerda())
	tudo.add_child(montar_direita())
	# fechar (canto de cima à direita)
	var x := Fechar.new()
	x.position = Vector2(-50, 8)
	x.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	x.offset_left = -52
	x.offset_top = 8
	x.offset_right = -12
	x.offset_bottom = 48
	x.gui_input.connect(func(ev): if (ev is InputEventMouseButton and ev.pressed) or (ev is InputEventScreenTouch and ev.pressed): fechar())
	moldura.add_child(x)

# ---------- peças de estilo ----------
# barra de rolar larga, fácil de pegar com o dedo (André 2026-11-07: na mochila cheia o toque caía nos itens)
static func barra_larga(sc: ScrollContainer, largura := 22) -> void:
	var vb := sc.get_v_scroll_bar()
	vb.custom_minimum_size.x = largura
	var trilho := StyleBoxFlat.new()
	trilho.bg_color = Color(0.03, 0.026, 0.022, 0.9)
	trilho.set_corner_radius_all(int(largura / 2.0))
	trilho.content_margin_left = largura / 2.0
	trilho.content_margin_right = largura / 2.0
	vb.add_theme_stylebox_override("scroll", trilho)
	vb.add_theme_stylebox_override("scroll_focus", trilho)
	for e in [["grabber", 0.55], ["grabber_highlight", 0.75], ["grabber_pressed", 0.95]]:
		var g := StyleBoxFlat.new()
		g.bg_color = Color(OURO, e[1])
		g.set_corner_radius_all(int(largura / 2.0))
		g.border_color = Color(0.03, 0.026, 0.022, 0.9)
		g.set_border_width_all(3) # um respiro dentro do trilho
		vb.add_theme_stylebox_override(e[0], g)

const RAIO_JANELA := 16 # cantos das janelas pop-up (André 2026-11-11)

static func caixa(cor: Color, borda: Color, b := 1, raio := 6, sombra := 0) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = cor
	s.border_color = borda
	s.set_border_width_all(b)
	# André 2026-11-11: "qualquer janela pop-up ... com as pontinhas mais arredondadas". Toda caixa com sombra é
	# janela flutuante (pop-up, painel da bancada, baú, troca, conversa, menu): raio mínimo 16. Cor e o resto iguais.
	if sombra > 0:
		raio = max(raio, RAIO_JANELA)
	s.set_corner_radius_all(raio)
	if sombra > 0:
		s.shadow_color = Color(0, 0, 0, 0.55)
		s.shadow_size = sombra
	s.content_margin_left = 10
	s.content_margin_right = 10
	s.content_margin_top = 6
	s.content_margin_bottom = 6
	return s

# André 2026-11-09: "clicou ali aquela barra, já aparece barra de ferro". Balãozinho com o nome do item em cima do
# ícone tocado, dentro do próprio menu (o aviso da HUD fica atrás do menu aberto e ninguém via). Só o nome, nada de
# "onde conseguir" (para não poluir). Some sozinho em 2,5 s ou no próximo toque em outro ícone.
static func balao_nome(alvo: Control, texto: String, cor := OURO_CLARO) -> void:
	var camada: Node = alvo
	while camada != null and not (camada is CanvasLayer):
		camada = camada.get_parent()
	if camada == null:
		return
	var velho = camada.get_meta("balao_nome") if camada.has_meta("balao_nome") else null
	if velho != null and is_instance_valid(velho):
		velho.queue_free()
	var bx := PanelContainer.new()
	bx.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bx.add_theme_stylebox_override("panel", caixa(Color(0.06, 0.052, 0.042, 0.96), Color(cor, 0.9), 2, 8, 6))
	var l := rotulo(texto, 20, cor)
	l.add_theme_constant_override("outline_size", 4)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.7))
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bx.add_child(l)
	bx.modulate.a = 0.0
	camada.add_child(bx)
	camada.set_meta("balao_nome", bx)
	await bx.get_tree().process_frame # tamanho certo só depois de entrar na árvore
	if not is_instance_valid(bx) or not is_instance_valid(alvo):
		if is_instance_valid(bx):
			bx.queue_free()
		return
	var r := alvo.get_global_rect()
	var tela := bx.get_viewport().get_visible_rect().size
	var pos := Vector2(r.get_center().x - bx.size.x * 0.5, r.position.y - bx.size.y - 6)
	if pos.y < 4: # sem espaço em cima: vai para baixo do ícone
		pos.y = r.end.y + 6
	pos.x = clampf(pos.x, 4, tela.x - bx.size.x - 4)
	bx.position = pos
	var tw := bx.create_tween()
	tw.tween_property(bx, "modulate:a", 1.0, 0.1)
	tw.tween_interval(2.4)
	tw.tween_property(bx, "modulate:a", 0.0, 0.25)
	tw.tween_callback(bx.queue_free)

static func rotulo(t: String, tam := 15, cor := TEXTO) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", tam)
	l.add_theme_color_override("font_color", cor)
	return l

func botao(t: String, fn: Callable, tam := 15, ativo := false) -> Button:
	var b := Button.new()
	b.text = t
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", tam)
	estilo_botao(b, ativo)
	b.pressed.connect(func():
		if not _arrastou:
			fn.call())
	return b

# André 2026-11-07: botão travado (apagado/vermelho) não fica mudo. Tocar nele chama fn, que mostra o motivo
# (sem vigor, mochila cheia, falta material, nível, ouro...). O Godot não solta "pressed" com o botão travado,
# mas o toque ainda chega no gui_input.
static func ao_tocar_travado(b: BaseButton, fn: Callable) -> void:
	b.gui_input.connect(func(e: InputEvent): _toque_travado(b, e, fn))

static func _toque_travado(b: BaseButton, e: InputEvent, fn: Callable) -> void:
	if b.disabled and e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT and not e.pressed:
		fn.call()

static func estilo_botao(b: Button, ativo: bool) -> void:
	var n := caixa(FUNDO3 if ativo else FUNDO2, OURO if ativo else BORDA, 1, 6)
	var p := caixa(FUNDO3.lightened(0.08), OURO_CLARO, 1, 6)
	var d := caixa(Color(0.1, 0.09, 0.08, 0.9), Color(0.25, 0.21, 0.16), 1, 6)
	b.add_theme_stylebox_override("normal", n)
	b.add_theme_stylebox_override("hover", n)
	b.add_theme_stylebox_override("pressed", p)
	b.add_theme_stylebox_override("disabled", d)
	b.add_theme_color_override("font_color", OURO_CLARO if ativo else TEXTO)
	b.add_theme_color_override("font_hover_color", OURO_CLARO if ativo else TEXTO)
	b.add_theme_color_override("font_pressed_color", OURO_CLARO)
	b.add_theme_color_override("font_disabled_color", Color(0.4, 0.37, 0.32))

static func icone_tex(nome: String) -> Texture2D:
	if nome.begins_with("it_") and ResourceLoader.exists("res://icones/itens/%s.png" % nome.substr(3)):
		return load("res://icones/itens/%s.png" % nome.substr(3)) # item pintado (godot-prototipo/icones/itens)
	if nome != "" and ResourceLoader.exists("res://icones/pintados/%s.png" % nome):
		return load("res://icones/pintados/%s.png" % nome) # construção, profissões e ferramentas pintados (2026-11-06); o .svg de traço fica de reserva
	if nome.begins_with("it_semente_") and not ResourceLoader.exists("res://icones/%s.svg" % nome):
		return icone_tex("it_semente")
	return load("res://icones/%s.svg" % nome) if nome != "" else null

# cor para o modulate de um ícone: o desenho de traço (.svg, branco) toma a cor pedida; o pintado guarda as cores
# dele e só escurece (apagado) ou fica transparente junto
static func tinta(tex: Texture2D, cor: Color) -> Color:
	if tex == null or tex.resource_path.ends_with(".svg"):
		return cor
	var v: float = clamp(cor.v * 1.15, 0.0, 1.0) if cor.s < 0.25 else 1.0
	return Color(v, v, v, cor.a)

# ---------- moldura dos itens: fundo com o brilho da cor da raridade, aro na cor e faixa embaixo (como no Quimera) ----------
static var _fundos := {}
static func fundo_raridade(cor: Color) -> GradientTexture2D:
	var k := cor.to_html()
	if not _fundos.has(k):
		var g := Gradient.new()
		g.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
		g.colors = PackedColorArray([Color(cor, 0.62).lerp(Color.WHITE, 0.08), Color(cor.darkened(0.45), 0.55), Color(0.035, 0.03, 0.028, 1)])
		var t := GradientTexture2D.new()
		t.gradient = g
		t.fill = GradientTexture2D.FILL_RADIAL
		t.fill_from = Vector2(0.5, 0.58)
		t.fill_to = Vector2(1.08, 1.12)
		t.width = 64
		t.height = 64
		_fundos[k] = t
	return _fundos[k]

# põe (ou troca) a moldura num quadrado de item; cor = raridade; destaque = escolhido
func moldurar(q: Control, cor: Color, destaque: bool, com_item: bool, raio := 8, forte := false) -> void:
	q.clip_children = CanvasItem.CLIP_CHILDREN_AND_DRAW
	for n in ["_fundo", "_brilho", "_faixa", "_aro"]:
		var v := q.get_node_or_null(n)
		if v:
			q.remove_child(v)
			v.queue_free()
	if com_item:
		var f := TextureRect.new()
		f.name = "_fundo"
		f.texture = fundo_raridade(cor)
		f.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		f.stretch_mode = TextureRect.STRETCH_SCALE
		f.set_anchors_preset(Control.PRESET_FULL_RECT)
		f.mouse_filter = Control.MOUSE_FILTER_IGNORE
		q.add_child(f)
		q.move_child(f, 0)
		# reflexo de vidro na metade de cima
		var b := ColorRect.new()
		b.name = "_brilho"
		b.color = Color(1, 1, 1, 0.05)
		b.set_anchors_preset(Control.PRESET_TOP_WIDE)
		b.anchor_bottom = 0.42
		b.mouse_filter = Control.MOUSE_FILTER_IGNORE
		q.add_child(b)
		q.move_child(b, 1)
		var fx := ColorRect.new()
		fx.name = "_faixa"
		fx.color = cor
		fx.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
		fx.offset_top = -3
		fx.mouse_filter = Control.MOUSE_FILTER_IGNORE
		q.add_child(fx)
	var aro := Panel.new()
	aro.name = "_aro"
	aro.mouse_filter = Control.MOUSE_FILTER_IGNORE
	aro.set_anchors_preset(Control.PRESET_FULL_RECT)
	var st := StyleBoxFlat.new()
	st.draw_center = false
	st.set_corner_radius_all(raio)
	if destaque:
		st.border_color = OURO_CLARO
		st.set_border_width_all(5 if forte else 3) # forte: medalhão com a janela da peça aberta
	elif com_item:
		st.border_color = cor.lightened(0.1)
		st.set_border_width_all(2)
	else:
		st.border_color = Color(0.22, 0.18, 0.13)
		st.set_border_width_all(1)
	aro.add_theme_stylebox_override("panel", st)
	q.add_child(aro)

# ---------- esquerda: herói 3D e equipamentos ----------
func montar_esquerda() -> Control:
	var col := VBoxContainer.new()
	col.custom_minimum_size = Vector2(430, 0)
	col.add_theme_constant_override("separation", 6)
	var cab := HBoxContainer.new()
	cab.add_child(rotulo("PERSONAGEM", 13, OURO))
	col.add_child(cab)
	titulo_nivel = rotulo("", 20, TEXTO)
	col.add_child(titulo_nivel)
	# manequim: o boneco no meio de tudo e os medalhões soltos em volta, cada um ligado à parte do corpo
	var meio := Control.new()
	meio.size_flags_vertical = Control.SIZE_EXPAND_FILL
	meio.clip_contents = true
	col.add_child(meio)
	var palco := SubViewportContainer.new()
	palco.stretch = true
	palco.set_anchors_preset(Control.PRESET_FULL_RECT)
	palco.mouse_filter = Control.MOUSE_FILTER_STOP
	palco.gui_input.connect(_girar)
	vp = SubViewport.new()
	vp.own_world_3d = true
	vp.transparent_bg = true
	vp.msaa_3d = Viewport.MSAA_2X
	vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	vp.process_mode = Node.PROCESS_MODE_DISABLED # FPS 2026-11-12: o boneco do menu fechado não anima à toa
	palco.add_child(vp)
	meio.add_child(palco)
	fios = Control.new()
	fios.set_anchors_preset(Control.PRESET_FULL_RECT)
	fios.mouse_filter = Control.MOUSE_FILTER_IGNORE
	fios.draw.connect(_desenhar_fios)
	meio.add_child(fios)
	get_tree().process_frame.connect(fios.queue_redraw)
	for d in SLOTS:
		var s := slot(d[0], d[1], d[5])
		s.anchor_left = d[2]
		s.anchor_right = d[2]
		s.anchor_top = d[3]
		s.anchor_bottom = d[3]
		s.offset_left = -MEDALHAO * 0.5
		s.offset_right = MEDALHAO * 0.5
		s.offset_top = -MEDALHAO * 0.5 - 6
		s.offset_bottom = MEDALHAO * 0.5 - 6
		meio.add_child(s)
		if d[0] == "cabeca":
			var q := linha_mostrar_capacete(12)
			q.anchor_left = d[2]
			q.anchor_right = d[2]
			q.anchor_top = d[3]
			q.anchor_bottom = d[3]
			q.offset_left = -50
			q.offset_right = 70
			q.offset_top = MEDALHAO * 0.5 + 16
			q.offset_bottom = MEDALHAO * 0.5 + 40
			meio.add_child(q)
	var pe := HBoxContainer.new()
	pe.add_theme_constant_override("separation", 10)
	var dica := rotulo("Arraste o personagem para girar", 12, APAGADO)
	dica.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dica.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	dica.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	pe.add_child(dica)
	# o botão Aparência (criador sem o nome: cores, altura e rosto) virou aba do menu do personagem (André 2026-11-04)
	col.add_child(pe)
	montar_palco()
	return col

# lugar de equipamento: moldura escura com o nome; a arma mostra a que está na mão (o resto vem com a mochila)
func slot(id: String, nome: String, lado := 1) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(MEDALHAO, MEDALHAO)
	c.size = Vector2(MEDALHAO, MEDALHAO)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var p := Panel.new()
	p.set_anchors_preset(Control.PRESET_FULL_RECT)
	p.add_theme_stylebox_override("panel", caixa(Color(0.05, 0.045, 0.04, 1), BORDA, 1, int(MEDALHAO * 0.5)))
	var ic := TextureRect.new()
	ic.set_anchors_preset(Control.PRESET_FULL_RECT)
	ic.offset_left = 8
	ic.offset_top = 8
	ic.offset_right = -8
	ic.offset_bottom = -8
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.modulate = Color(1, 1, 1, 0.9)
	p.add_child(ic)
	c.add_child(p)
	# nome do lado de fora (do lado oposto ao boneco), em cima de uma linha fina
	var l := rotulo(nome, 12, APAGADO)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	l.offset_left = -60
	l.offset_right = 60
	l.offset_top = 2
	l.offset_bottom = 18
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.add_child(l)
	# reforço da peça vestida (André 2026-11-09: "+N" para saber qual é qual)
	var rf := rotulo("", 13, OURO_CLARO)
	rf.add_theme_constant_override("outline_size", 5)
	rf.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	rf.position = Vector2(MEDALHAO * 0.62, -4)
	rf.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.add_child(rf)
	slots_ui[id] = {"icone": ic, "painel": p, "no": c, "reforco": rf}
	if id == "arma":
		slot_arma = slots_ui[id]
	p.mouse_filter = Control.MOUSE_FILTER_STOP
	ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
	p.gui_input.connect(func(ev):
		if toque(ev):
			tocar_slot(id))
	return c

# um toque no celular chega duas vezes (o toque e o clique de mouse que o Godot imita a partir dele, e no PC o contrário).
# Sem filtrar, o segundo caía no véu da janela recém-aberta e fechava (só a Camisa e vizinhos escapavam, porque a janela
# nascia por cima deles antes de ir para o lugar) e o quadradinho do capacete marcava e desmarcava no mesmo toque.
var _toque_ms := -1000
func toque(ev: InputEvent) -> bool:
	if not ((ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT) or (ev is InputEventScreenTouch and ev.pressed)):
		return false
	var agora := Time.get_ticks_msec()
	if agora - _toque_ms < 250:
		return false
	_toque_ms = agora
	return true

func lugar_de(id: String) -> String:
	return ("espada" if boneco_modo == "Espada" else "cajado") if id == "arma" else id

# peças do corpo: ícone com a cor da raridade; vazio = silhueta apagada
func atualizar_slots() -> void:
	quadradinhos = quadradinhos.filter(func(q): return is_instance_valid(q))
	for q in quadradinhos:
		q.marcado = not m.P.prog.get("semCapacete", false)
		q.queue_redraw()
	if boneco:
		Armadura.vestir(boneco, m.P.equip_visivel()) # o boneco veste o mesmo que o herói (capacete escondido também)
	for id in slots_ui:
		var u: Dictionary = slots_ui[id]
		var it = m.P.prog.equip.get(lugar_de(id))
		var escolhido: bool = (sel_equip != "" and sel_equip == lugar_de(id)) or (janela_lugar != "" and janela_lugar == lugar_de(id))
		if u.has("reforco"):
			u.reforco.text = "+%d" % int(it.get("e", 0)) if it != null and int(it.get("e", 0)) > 0 else ""
		if it != null:
			var c: Color = m.P.cor_item(it)
			u.icone.texture = icone_tex(m.P.icone_item(it))
			u.icone.modulate = c if u.icone.texture and u.icone.texture.resource_path.ends_with(".svg") else Color.WHITE
			u.painel.add_theme_stylebox_override("panel", caixa(Color(0.05, 0.045, 0.04, 1), Color(0, 0, 0, 0), 0, int(MEDALHAO * 0.5)))
			moldurar(u.painel, c, escolhido, true, int(MEDALHAO * 0.5), janela_lugar == lugar_de(id))
		else:
			u.icone.texture = icone_tex("basico" if id == "arma" and boneco_modo == "Espada" else "magia" if id == "arma" else "eq_" + id)
			u.icone.modulate = Color(0.85, 0.75, 0.55, 0.45 if id == "arma" else 0.25)
			u.painel.add_theme_stylebox_override("panel", caixa(Color(0.05, 0.045, 0.04, 1), Color(0, 0, 0, 0), 0, int(MEDALHAO * 0.5)))
			moldurar(u.painel, BORDA, escolhido, false, int(MEDALHAO * 0.5), janela_lugar == lugar_de(id))

func tocar_slot(id: String) -> void:
	var l := lugar_de(id)
	sel_mochila = -1
	sel_equip = l
	if aba != "mochila" and aba in ABAS_BOLSA: # no menu do personagem a janela da peça abre por cima, sem trocar de menu
		aba = "mochila"
	janela_lugar = l
	for d in SLOTS:
		if d[0] == id:
			janela_nome = d[1] if id != "arma" else ("Arma · espada" if l == "espada" else "Arma · cajado")
	atualizar()

# fio dourado de cada medalhão até a parte do corpo (segue o boneco quando ele gira)
func _desenhar_fios() -> void:
	if boneco == null or cam_palco == null or not is_instance_valid(boneco):
		return
	var esq: Skeleton3D = Armadura._esqueleto(boneco)
	if esq == null:
		return
	for d in SLOTS:
		var u: Dictionary = slots_ui.get(d[0], {})
		if u.is_empty():
			continue
		var b := esq.find_bone(d[4])
		if b < 0:
			continue
		var g: Vector3 = esq.global_transform * esq.get_bone_global_pose(b).origin
		if d[0] == "cabeca":
			g.y += 0.1
		var alvo := cam_palco.unproject_position(g)
		var no: Control = u.no
		var centro := no.position + no.size * 0.5
		var dir := (alvo - centro).normalized()
		var ini := centro + dir * MEDALHAO * 0.5
		var tem: bool = m.P.prog.equip.get(lugar_de(d[0])) != null
		var cor := Color(OURO.r, OURO.g, OURO.b, 0.55 if tem else 0.22)
		# fio com um cotovelo: sai reto para o lado e desce/sobe até a parte do corpo
		var cot := Vector2(lerpf(ini.x, alvo.x, 0.45), alvo.y)
		fios.draw_polyline(PackedVector2Array([ini, cot, alvo]), cor, 1.2, true)
		fios.draw_circle(alvo, 2.6, cor)

func montar_palco() -> void:
	var cam := Camera3D.new()
	cam_palco = cam
	cam.fov = 30
	cam.position = Vector3(0, 1.05, 4.6)
	cam.look_at_from_position(cam.position, Vector3(0, 0.88, 0))
	vp.add_child(cam)
	var amb := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_CLEAR_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.45, 0.42, 0.4)
	env.ambient_light_energy = 0.5
	env.tonemap_exposure = 0.85
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	amb.environment = env
	vp.add_child(amb)
	var chave := DirectionalLight3D.new() # luz principal quente e um contraluz frio, como estúdio
	chave.light_color = Color(1.0, 0.92, 0.8)
	chave.light_energy = 0.8
	chave.rotation = Vector3(deg_to_rad(-25), deg_to_rad(45), 0) # luz-chave lateral a 45°: aparece o degrau de sombra do anime
	vp.add_child(chave)
	var contra := DirectionalLight3D.new()
	contra.light_color = Color(0.6, 0.72, 1.0)
	contra.light_energy = 0.9
	contra.rotation = Vector3(deg_to_rad(-20), deg_to_rad(170), 0) # recorte atrás
	vp.add_child(contra)
	# chão: disco escuro com brilho dourado
	var disco := MeshInstance3D.new()
	var cil := CylinderMesh.new()
	cil.top_radius = 0.75
	cil.bottom_radius = 0.8
	cil.height = 0.04
	disco.mesh = cil
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.045, 0.04, 0.035) # disco escuro e fosco (o metálico refletia a luz e estourava em branco)
	mat.roughness = 1.0
	mat.metallic_specular = 0.05
	disco.material_override = mat
	disco.position.y = -0.02
	vp.add_child(disco)
	var aro := MeshInstance3D.new() # brilho fraco só na borda
	var tor := TorusMesh.new()
	tor.inner_radius = 0.785
	tor.outer_radius = 0.8
	aro.mesh = tor
	var ma := StandardMaterial3D.new()
	ma.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ma.albedo_color = Color(0.38, 0.29, 0.16)
	aro.material_override = ma
	aro.scale.y = 0.3
	aro.position.y = 0.0
	vp.add_child(aro)
	boneco = m.modelo(m.visual)
	boneco.get_parent().remove_child(boneco)
	vp.add_child(boneco)
	boneco.position = Vector3.ZERO
	boneco_anim = boneco.find_child("AnimationPlayer", true, false)
	esp = m.nova_arma("espada")
	caj = m.nova_arma("cajado")

# o herói trocou de corpo no criador: o boneco do menu troca junto (mesmo lugar, mesma roupa e pintura)
func trocar_boneco() -> void:
	if boneco == null or not is_instance_valid(boneco):
		return
	var pai := boneco.get_parent()
	var ry := boneco.rotation.y
	for a in [esp, caj]: # as armas saem do corpo velho antes de ele sumir
		if a.get_parent():
			a.get_parent().remove_child(a)
	boneco.queue_free()
	boneco = m.modelo(m.visual)
	boneco.get_parent().remove_child(boneco)
	pai.add_child(boneco)
	boneco.position = Vector3.ZERO
	boneco.rotation.y = ry
	boneco_anim = boneco.find_child("AnimationPlayer", true, false)
	boneco_modo = ""
	m.Aparencia.aplicar(boneco, m.aparencia)
	armar_boneco()

func armar_boneco() -> void:
	if boneco_modo == m.h.modo:
		return
	boneco_modo = m.h.modo
	var esq: Skeleton3D = m.esqueleto(boneco)
	var L: Dictionary = m.lugar_armas()
	m.prender(esq, esp, L.espadaMao if boneco_modo == "Espada" else L.espadaCostas)
	m.prender(esq, caj, L.cajadoCostas if boneco_modo == "Espada" else L.get("cajadoMao", L.cajadoCostas))
	boneco_anim.play("espada_parada" if boneco_modo == "Espada" else ("cajado_parada" if boneco_anim.has_animation("cajado_parada") else "parada"), 0.2)
	atualizar_slots()

func _girar(ev: InputEvent) -> void:
	if ev is InputEventScreenDrag:
		giro += ev.relative.x * 0.012
	elif ev is InputEventMouseMotion and (ev.button_mask & MOUSE_BUTTON_MASK_LEFT):
		giro += ev.relative.x * 0.012

# ---------- direita: abas ----------
func montar_direita() -> Control:
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.add_theme_constant_override("separation", 8)
	var abas := HBoxContainer.new()
	abas.add_theme_constant_override("separation", 6)
	for a in [["status", "Status"], ["habilidades", "Habilidades"], ["profissoes", "Profissões"], ["titulos", "Títulos"], ["missoes", "Missões"], ["aparencia", "Aparência"],
			["mochila", "Mochila"], ["criar", "Criar"], ["loja", "Loja"]]:
		var b := botao(a[1], func(): trocar_aba(a[0]), 16)
		b.custom_minimum_size = Vector2(126, 40)
		botoes_aba[a[0]] = b
		abas.add_child(b)
	col.add_child(abas)
	linha_arvores = HBoxContainer.new()
	linha_arvores.add_theme_constant_override("separation", 6)
	for k in ARVORES:
		var b := botao(ARVORES[k], func(): trocar_arvore(k), 14)
		b.custom_minimum_size = Vector2(110, 34)
		botoes_arvore[k] = b
		linha_arvores.add_child(b)
	col.add_child(linha_arvores)
	linha_prof = HBoxContainer.new()
	linha_prof.add_theme_constant_override("separation", 6)
	for k in SUB_PROF:
		var b := botao(SUB_PROF[k], func(): trocar_sub_prof(k), 14)
		b.custom_minimum_size = Vector2(110, 34)
		botoes_prof[k] = b
		linha_prof.add_child(b)
	col.add_child(linha_prof)
	linha_criar = HBoxContainer.new()
	linha_criar.add_theme_constant_override("separation", 5)
	for c in CATS_CRIAR:
		var b := botao(c[1], func(): trocar_cat_criar(c[0]), 13)
		b.custom_minimum_size = Vector2(0, 34)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		botoes_criar[c[0]] = b
		linha_criar.add_child(b)
	col.add_child(linha_criar)
	var fundo := PanelContainer.new()
	fundo.size_flags_vertical = Control.SIZE_EXPAND_FILL
	fundo.add_theme_stylebox_override("panel", caixa(Color(0.055, 0.048, 0.04, 1), Color(0.24, 0.2, 0.14), 1, 8))
	rolagem = ScrollContainer.new()
	rolagem.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	rolagem.size_flags_vertical = Control.SIZE_EXPAND_FILL
	fundo.add_child(rolagem)
	barra_larga(rolagem)
	conteudo = VBoxContainer.new()
	conteudo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	conteudo.add_theme_constant_override("separation", 8)
	rolagem.add_child(conteudo)
	col.add_child(fundo)
	return col

func trocar_aba(a: String) -> void:
	if a == "aparencia": # abre o criador de personagem (sem o nome), como o botão de antes
		fechar()
		m.abrir_aparencia()
		return
	aba = a
	atualizar()
	rolagem.scroll_vertical = 0

func trocar_sub_prof(k: String) -> void:
	sub_prof = k
	atualizar()
	rolagem.scroll_vertical = 0

func trocar_cat_criar(k: String) -> void:
	cat_criar = k
	atualizar()
	rolagem.scroll_vertical = 0

func trocar_arvore(k: String) -> void:
	arvore = k
	atualizar()
	rolagem.scroll_vertical = 0

func abrir(qual := "", sub := "") -> void:
	if m.h.modo == "Magia":
		arvore = "cajado"
	if sub != "":
		sub_prof = sub
	if qual != "":
		aba = qual
	elif aba in ABAS_BOLSA or aba in ABAS_MISSOES: # barra de vida: só o menu do personagem
		aba = "status"
	sel_mochila = -1
	sel_equip = ""
	janela_lugar = ""
	vendendo = false
	marcados = {}
	filtro_aberto = false
	raiz.visible = true
	m.hud.bloqueado = true
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp.process_mode = Node.PROCESS_MODE_INHERIT
	boneco_modo = ""
	atualizar()

# botão de ação perto da bancada, bigorna ou fornalha: a aba Criar inteira, aberta no que esta estação faz
func abrir_estacao() -> void:
	cat_criar = "aqui"
	var ests := estacoes_perto()
	est_criar = ests[0] if not ests.is_empty() else ""
	abrir("criar")
	rolagem.scroll_vertical = 0

# estações perto do herói (construídas no terreno, ou a oficina do Tomás / banca da Rosa), na ordem de NOME_ESTACAO
func estacoes_perto() -> Array:
	var l := []
	var cons = m.construcao
	for est in NOME_ESTACAO:
		var prof := "alf" if est == "bancada" else "coz" if est == "fogao" else "fer"
		if (cons != null and cons.estacao_perto([est])) or (m.trabalho != null and m.trabalho.perto_oficina(prof)):
			l.append(est)
	return l

# botão da mochila no menu do topo: volta na aba da bolsa que estava (Mochila ou Criar)
func abrir_bolsa() -> void:
	abrir(aba if aba in ["mochila", "criar"] else "mochila")

func fechar() -> void:
	_pend.clear() # fechou sem confirmar: nada foi gasto
	fechar_confirma()
	fechar_janela(false)
	raiz.visible = false
	m.hud.bloqueado = false
	vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	vp.process_mode = Node.PROCESS_MODE_DISABLED # fechado: o boneco para de animar (custava um herói inteiro por quadro)

func aberto() -> bool:
	return raiz != null and raiz.visible

# rolar a lista arrastando o dedo (em cima de qualquer coisa: linha, botão, texto)
func _input(ev: InputEvent) -> void:
	if not aberto() or rolagem == null:
		return
	var rol: ScrollContainer = janela_rolagem if janela_aberta() and janela_rolagem != null else rolagem
	if ev is InputEventScreenTouch:
		if ev.pressed:
			_arrasto_dentro = rol.get_global_rect().has_point(ev.position)
			var vb := rol.get_v_scroll_bar()
			if vb.visible and vb.get_global_rect().has_point(ev.position):
				_arrasto_dentro = false # dedo na barra: a própria barra rola, no sentido dela
			_arrasto_soma = 0.0
			_arrastou = false
		else:
			_arrasto_dentro = false
			if _arrastou: # deixa o soltar passar, mas o botão não dispara (o pressed vem antes de zerar)
				(func(): _arrastou = false).call_deferred()
	elif ev is InputEventScreenDrag and _arrasto_dentro:
		_arrasto_soma += abs(ev.relative.y)
		if _arrasto_soma > 12.0:
			_arrastou = true
		rol.scroll_vertical -= int(round(ev.relative.y))
		get_viewport().set_input_as_handled()

func _process(dt: float) -> void:
	if not aberto():
		return
	if boneco:
		boneco.rotation.y = lerp_angle(boneco.rotation.y, giro, min(1.0, dt * 10.0))
	armar_boneco()

# ---------- conteúdo ----------
func atualizar() -> void:
	if not aberto():
		return
	var P = m.P
	titulo_nivel.text = "%s  ·  Nível %d" % [m.hud.nome, P.prog.nivel]
	if aba == "loja" and not m.perto_da_loja():
		aba = "mochila"
	var grupo: Array = ABAS_BOLSA if aba in ABAS_BOLSA else (ABAS_MISSOES if aba in ABAS_MISSOES else ABAS_PERSONAGEM)
	for k in botoes_aba:
		estilo_botao(botoes_aba[k], k == aba)
		botoes_aba[k].visible = k in grupo
	botoes_aba.loja.visible = aba in ABAS_BOLSA and m.perto_da_loja()
	linha_criar.visible = false # a fileira de submenus deu lugar às estações e aos grupos sanfona (André 2026-11-09)
	var est_aqui := estacoes_perto()
	if cat_criar == "aqui" and est_aqui.is_empty():
		cat_criar = "materiais"
	botoes_criar.aqui.visible = not est_aqui.is_empty()
	botoes_criar.aqui.text = str(NOME_ESTACAO[est_aqui[0]]).split(" ")[0] if est_aqui.size() == 1 else "Aqui"
	for k in botoes_criar:
		estilo_botao(botoes_criar[k], k == cat_criar)
	atualizar_slots()
	linha_arvores.visible = aba == "habilidades"
	for k in botoes_arvore:
		estilo_botao(botoes_arvore[k], k == arvore)
	linha_prof.visible = aba == "profissoes"
	for k in botoes_prof:
		estilo_botao(botoes_prof[k], k == sub_prof)
	var y := rolagem.scroll_vertical
	for c in conteudo.get_children():
		conteudo.remove_child(c)
		c.queue_free()
	if aba == "status":
		montar_status()
	elif aba == "mochila":
		montar_mochila()
	elif aba == "loja":
		montar_loja()
	elif aba == "criar":
		montar_criar()
	elif aba == "missoes":
		montar_missoes()
	elif aba == "titulos":
		montar_titulos()
	elif aba == "profissoes":
		if sub_prof == "lista":
			montar_profissoes()
		else:
			montar_receitas(sub_prof)
	else:
		montar_habilidades()
	montar_janela()
	await get_tree().process_frame
	rolagem.scroll_vertical = y

func separador(t: String) -> void:
	var l := rotulo(t.to_upper(), 12, OURO)
	conteudo.add_child(l)
	var linha := ColorRect.new()
	linha.color = Color(0.42, 0.33, 0.2, 0.6)
	linha.custom_minimum_size = Vector2(0, 1)
	conteudo.add_child(linha)

func barra_prog(frac: float, cor: Color, alto := 8.0) -> Control:
	var fundo := Panel.new()
	fundo.custom_minimum_size = Vector2(0, alto)
	fundo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	fundo.add_theme_stylebox_override("panel", caixa(Color(0.03, 0.03, 0.03), Color(0.25, 0.2, 0.14), 1, 3))
	var cheio := Panel.new()
	cheio.anchor_right = clamp(frac, 0.0, 1.0)
	cheio.anchor_bottom = 1.0
	cheio.add_theme_stylebox_override("panel", caixa(cor, cor.lightened(0.2), 0, 3))
	fundo.add_child(cheio)
	return fundo

func montar_status() -> void:
	var P = m.P
	var p: Dictionary = P.prog
	separador("Nível")
	var lv := HBoxContainer.new()
	lv.add_child(rotulo("Nível %d" % p.nivel, 20, OURO_CLARO))
	var xp_txt := rotulo("  XP %d / %d" % [p.xp, P.xp_prox] if p.nivel < int(P.dados.nivelMax) else "  Nível máximo", 14, APAGADO)
	lv.add_child(xp_txt)
	conteudo.add_child(lv)
	conteudo.add_child(barra_prog(float(p.xp) / max(1, P.xp_prox), Color(0.85, 0.66, 0.3)))
	if P.teste: # só na conta de teste do André: mudar o nível na hora para testar os campos de caça
		var tl := HBoxContainer.new()
		tl.add_theme_constant_override("separation", 8)
		tl.add_child(rotulo("Teste de nível:", 14, APAGADO))
		for d in [-10, -1, 1, 10]:
			tl.add_child(botao(("%+d" % d), func(): m.rede("nivelTeste", {"nv": int(p.nivel) + d}), 14))
		tl.add_child(botao("Zerar pontos", func(): m.rede("nivelTeste", {"nv": int(p.nivel), "zerar": true}), 14))
		conteudo.add_child(tl)
	separador("Atributos")
	# André 2026-11-06: + e − só mexem nos pontos pendentes; nada muda até apertar Confirmar (Desfazer zera).
	# O − nunca tira ponto já confirmado.
	var pend := _pend_validos()
	var n_pend := _soma_pend()
	var sobram: int = int(p.pontos) - n_pend
	var topo := HBoxContainer.new()
	topo.add_theme_constant_override("separation", 14)
	topo.add_child(rotulo("Pontos sobrando: %d" % sobram, 16, VERDE if sobram > 0 else APAGADO))
	if n_pend > 0:
		topo.add_child(rotulo("(%d para confirmar)" % n_pend, 14, OURO_CLARO))
	conteudo.add_child(topo)
	for k in ["for", "des", "int", "vit"]:
		var a: Dictionary = P.dados.atributos[k]
		var linha := HBoxContainer.new()
		linha.add_theme_constant_override("separation", 8)
		var txt := VBoxContainer.new()
		txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		txt.add_theme_constant_override("separation", 0)
		txt.add_child(rotulo(a.nome, 16, TEXTO))
		var d := rotulo(a.desc, 12, APAGADO)
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		txt.add_child(d)
		linha.add_child(txt)
		var extra: int = int(pend.get(k, 0))
		var menos := botao("−", func(): mudar_pend(k, -1), 20, extra > 0)
		menos.custom_minimum_size = Vector2(44, 40)
		menos.disabled = extra <= 0
		linha.add_child(menos)
		var v := rotulo(str(int(p.atr[k]) + extra), 20, VERDE if extra > 0 else OURO_CLARO)
		v.custom_minimum_size = Vector2(44, 0)
		v.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		if extra > 0:
			v.tooltip_text = "%d + %d" % [p.atr[k], extra]
		linha.add_child(v)
		var mais := botao("+", func(): mudar_pend(k, 1), 20, sobram > 0)
		mais.custom_minimum_size = Vector2(44, 40)
		mais.disabled = sobram <= 0
		linha.add_child(mais)
		var mostra := rotulo("+%d" % extra if extra > 0 else "", 14, VERDE)
		mostra.custom_minimum_size = Vector2(34, 0)
		linha.add_child(mostra)
		conteudo.add_child(linha)
	if n_pend > 0:
		var acoes := HBoxContainer.new()
		acoes.alignment = BoxContainer.ALIGNMENT_END
		acoes.add_theme_constant_override("separation", 10)
		var desfazer := botao("Desfazer", func(): _pend.clear(); atualizar(), 15)
		desfazer.custom_minimum_size = Vector2(120, 42)
		acoes.add_child(desfazer)
		var ok := botao("Confirmar (%d)" % n_pend, confirmar_pontos, 15, true)
		ok.custom_minimum_size = Vector2(160, 42)
		acoes.add_child(ok)
		conteudo.add_child(acoes)
	separador("Herói")
	var st: Dictionary = P.st
	var g := GridContainer.new()
	g.columns = 2
	g.add_theme_constant_override("h_separation", 28)
	g.add_theme_constant_override("v_separation", 4)
	var itens := [
		["Vida", "%d / %d" % [ceil(m.h.vida), st.vidaMax]], ["Mana", "%d / %d" % [floor(m.h.mana), st.manaMax]],
		["Defesa", "%d (-%s%% de dano)" % [st.defesa, P.num(st.reducao * 100, 0)]], ["Crítico", "%s%%" % P.num(st.critico * 100, 1)],
		["Dano físico", P.num(st.danoFisico, 1)], ["Dano mágico", P.num(st.danoMagico, 1)],
		["Recarga", "-%s%%" % P.num(st.recarga * 100, 0)], ["Regeneração", "%s vida/s · %s mana/s (fora de luta)" % [P.num(st.regenVida, 1), P.num(st.regenMana, 1)]],
		["Estamina", "%d / %d" % [floor(m.trabalho.sta), m.trabalho.sta_max()]], ["Vigor", "%d / %d" % [floor(P.vigor()), int(P.dados.vigor.max)]],
		["Ouro", str(int(p.ouro))],
	]
	# com pontos pendentes, mostra como os números ficam depois de confirmar (em verde)
	var depois := {}
	if n_pend > 0:
		var antes: Dictionary = p.atr.duplicate()
		for k in pend:
			p.atr[k] = int(p.atr[k]) + int(pend[k])
		var st2: Dictionary = P.calcular_status()
		p.atr = antes
		depois = {
			"Vida": "%d" % st2.vidaMax, "Mana": "%d" % st2.manaMax, "Defesa": "%d" % st2.defesa,
			"Crítico": "%s%%" % P.num(st2.critico * 100, 1), "Dano físico": P.num(st2.danoFisico, 1),
			"Dano mágico": P.num(st2.danoMagico, 1), "Recarga": "-%s%%" % P.num(st2.recarga * 100, 0),
		}
		var ref := {
			"Vida": "%d" % st.vidaMax, "Mana": "%d" % st.manaMax, "Defesa": "%d" % st.defesa,
			"Crítico": "%s%%" % P.num(st.critico * 100, 1), "Dano físico": P.num(st.danoFisico, 1),
			"Dano mágico": P.num(st.danoMagico, 1), "Recarga": "-%s%%" % P.num(st.recarga * 100, 0),
		}
		for nome in ref:
			if ref[nome] == depois[nome]:
				depois.erase(nome)
	for it in itens:
		var c := HBoxContainer.new()
		c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var n := rotulo(it[0], 14, APAGADO)
		n.custom_minimum_size = Vector2(110, 0)
		c.add_child(n)
		c.add_child(rotulo(it[1], 14, TEXTO))
		if depois.has(it[0]):
			c.add_child(rotulo("  → %s" % depois[it[0]], 14, VERDE))
		g.add_child(c)
	conteudo.add_child(g)

# Mestre Ivo (NPC de resetar a build): janela pequena para confirmar. Online quem confere e cobra é o servidor.
var _reset: Control
func perguntar_reset(custo: int) -> void:
	if _reset:
		_reset.queue_free()
	var gastos: int = m.P.pontos_gastos()
	_reset = Control.new()
	_reset.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_reset)
	var escuro := ColorRect.new()
	escuro.color = Color(0, 0, 0, 0.45)
	escuro.set_anchors_preset(Control.PRESET_FULL_RECT)
	_reset.add_child(escuro)
	var caixa_r := PanelContainer.new()
	caixa_r.add_theme_stylebox_override("panel", caixa(FUNDO, OURO.darkened(0.25), 2, 10, 14))
	caixa_r.set_anchors_preset(Control.PRESET_CENTER)
	caixa_r.custom_minimum_size = Vector2(430, 0)
	caixa_r.position = Vector2(-215, -95)
	_reset.add_child(caixa_r)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	caixa_r.add_child(col)
	var t := Label.new()
	t.text = "Mestre Ivo · Resetar build"
	t.add_theme_font_size_override("font_size", 20)
	t.add_theme_color_override("font_color", OURO_CLARO)
	col.add_child(t)
	var d := Label.new()
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	d.text = ("Seus atributos voltam pro começo e os %d pontos voltam pra você distribuir de novo. As skills não mudam.\nCusta %d de ouro (você tem %d)." % [gastos, custo, int(m.P.prog.get("ouro", 0))]) if gastos > 0 else "Você ainda não gastou nenhum ponto."
	d.add_theme_font_size_override("font_size", 15)
	d.add_theme_color_override("font_color", TEXTO)
	col.add_child(d)
	var linha := HBoxContainer.new()
	linha.alignment = BoxContainer.ALIGNMENT_END
	linha.add_theme_constant_override("separation", 10)
	col.add_child(linha)
	var fechar_r := func():
		if _reset:
			_reset.queue_free()
			_reset = null
	linha.add_child(botao("Agora não", fechar_r))
	if gastos > 0:
		linha.add_child(botao("Resetar (%d de ouro)" % custo, func():
			fechar_r.call()
			if m.on():
				m.rede("resetar") # o servidor confere a distância e o ouro e manda o progresso novo
			else:
				m.hud.aviso(m.P.resetar(custo))
				atualizar(), 15, true))

# Pontos ainda não confirmados, por atributo ({"for": 2}). Some ao confirmar, desfazer ou fechar o menu.
var _pend := {}

# Se os pontos livres mudaram por fora (reset no Mestre Ivo, outro aparelho) e não cabem mais, zera o pendente.
func _pend_validos() -> Dictionary:
	if _soma_pend() > int(m.P.prog.pontos):
		_pend.clear()
	return _pend

func _soma_pend() -> int:
	var t := 0
	for k in _pend:
		t += int(_pend[k])
	return t

func mudar_pend(k: String, d: int) -> void:
	var atual: int = int(_pend.get(k, 0))
	if d > 0 and _soma_pend() >= int(m.P.prog.pontos):
		return
	if d < 0 and atual <= 0:
		return # o − só tira o que ainda não foi confirmado
	atual += d
	if atual <= 0:
		_pend.erase(k)
	else:
		_pend[k] = atual
	atualizar()

func confirmar_pontos() -> void:
	var envio := _pend_validos().duplicate()
	_pend.clear()
	if envio.is_empty():
		atualizar()
		return
	if m.on():
		m.rede("atributos", envio) # o servidor confere tudo de uma vez e devolve o progresso novo
		atualizar()
	else:
		for k in envio:
			for i in int(envio[k]):
				m.P.distribuir(k)
		atualizar()

func distribuir(k: String) -> void:
	if m.on():
		m.rede("atributo", k) # o servidor confere e devolve o progresso novo
	elif m.P.distribuir(k):
		atualizar()

func montar_habilidades() -> void:
	var P = m.P
	for b in (["espada", "cajado"] if arvore == "geral" else [arvore]):
		separador("Barra da espada" if b == "espada" else "Barra do cajado")
		conteudo.add_child(linha_barra(b))
	var dica := rotulo("Trocar mostra a outra barra. Toque em dois botões para trocar de lugar; em cada skill, escolha o número do botão (tocar de novo tira).", 12, APAGADO)
	dica.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	conteudo.add_child(dica)
	var info := rotulo(ARVORE_TXT[arvore], 13, APAGADO)
	info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	conteudo.add_child(info)
	separador("Skills")
	var ids := []
	for id in P.habs:
		var h: Dictionary = P.habs[id]
		if h.arvore == arvore:
			ids.append(id)
	var ordem := func(id): return int(P.habs[id].libera) * 2 + (0 if P.habs[id].get("basico", false) else 1)
	ids.sort_custom(func(a, b): return ordem.call(a) < ordem.call(b))
	for id in ids:
		conteudo.add_child(linha_skill(id))
	separador("Passivas")
	for k in P.dados.passivas:
		var pv: Dictionary = P.dados.passivas[k]
		var ok: bool = P.passiva(k)
		var l := HBoxContainer.new()
		l.add_theme_constant_override("separation", 10)
		var marca := Panel.new()
		marca.custom_minimum_size = Vector2(12, 12)
		marca.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		marca.add_theme_stylebox_override("panel", caixa(VERDE if ok else Color(0.2, 0.18, 0.15), BORDA, 1, 6))
		l.add_child(marca)
		l.add_child(rotulo(pv.nome, 15, TEXTO if ok else APAGADO))
		l.add_child(rotulo(pv.desc if ok else "Libera no nível %d. %s" % [int(pv.libera), pv.desc], 13, APAGADO))
		conteudo.add_child(l)

func linha_skill(id: String) -> Control:
	var P = m.P
	var base: Dictionary = P.habs[id]
	var livre: bool = P.liberada(id)
	var nv: int = P.nivel_de(id)
	var h: Dictionary = P.hab_pronta(id)
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1) if livre else Color(0.07, 0.063, 0.055, 1), Color(0.3, 0.24, 0.16), 1, 8))
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 12)
	cx.add_child(l)
	var moldura := Panel.new()
	moldura.custom_minimum_size = Vector2(52, 52)
	moldura.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	moldura.add_theme_stylebox_override("panel", caixa(Color(0.05, 0.045, 0.04, 1), OURO.darkened(0.2) if livre else BORDA, 1, 26))
	var ic := TextureRect.new()
	ic.texture = icone_tex(P.ICONE.get(id, ""))
	ic.set_anchors_preset(Control.PRESET_FULL_RECT)
	ic.offset_left = 9
	ic.offset_top = 9
	ic.offset_right = -9
	ic.offset_bottom = -9
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.modulate = Color(1, 1, 1) if livre else Color(0.45, 0.45, 0.45)
	moldura.add_child(ic)
	l.add_child(moldura)
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.add_theme_constant_override("separation", 2)
	var cab := HBoxContainer.new()
	cab.add_child(rotulo(base.nome, 16, TEXTO if livre else APAGADO))
	if livre:
		cab.add_child(rotulo("   Nv %d/%d" % [nv, P.maximo(id)], 13, OURO))
	txt.add_child(cab)
	var d := rotulo(base.desc if livre else "Libera no nível %d. %s" % [int(base.libera), base.desc], 12, APAGADO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	txt.add_child(d)
	var nums := rotulo(P.linha(h), 13, Color(0.85, 0.8, 0.7) if livre else APAGADO)
	nums.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	txt.add_child(nums)
	if livre: # ataque básico também mostra a barra de usos (sobe até o 5 sem livro)
		if nv < P.maximo(id):
			var uso := HBoxContainer.new()
			uso.add_theme_constant_override("separation", 8)
			var b := barra_prog(float(P.uso_de(id)) / P.usos_para_subir(nv), Color(0.55, 0.42, 0.2), 6)
			b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			uso.add_child(b)
			uso.add_child(rotulo("%d/%d usos" % [P.uso_de(id), P.usos_para_subir(nv)], 12, APAGADO))
			txt.add_child(uso)
		var ti: int = P.tomo_para(id)
		if ti == -2:
			txt.add_child(rotulo(P.proximo(id), 12, Color(0.6, 0.75, 0.55)))
		else: # barra cheia do Nv 5 em diante: sobe com o Tomo
			var lt := HBoxContainer.new()
			lt.add_theme_constant_override("separation", 8)
			var nome_t: String = "%s %s" % [base.tomo, P.dados.romano[nv + 1]]
			lt.add_child(rotulo(("Pronta para o %s" if ti >= 0 else "Precisa do %s (cai dos monstros)") % nome_t, 12, Color("d9b4ff")))
			if ti >= 0:
				var bt := botao("Usar Tomo", func(): acao_item({"acao": "usar", "i": ti}), 13, true)
				bt.custom_minimum_size = Vector2(110, 32)
				lt.add_child(bt)
			txt.add_child(lt)
	if not base.get("basico", false):
		# em qual botão de cada barra ela fica (as gerais servem nas duas)
		for barra in ["espada", "cajado"]:
			if not P.cabe(id, barra):
				continue
			var bs := HBoxContainer.new()
			bs.add_theme_constant_override("separation", 5)
			bs.add_child(rotulo("Espada:" if barra == "espada" else "Cajado:", 13, APAGADO))
			var lista: Array = P.prog.barras[barra]
			for i in lista.size():
				var nb := botao(str(i + 1), func(): por_no_botao(id, barra, i), 14, lista[i] == id)
				nb.custom_minimum_size = Vector2(40, 34)
				bs.add_child(nb)
			txt.add_child(bs)
	elif base.get("basico", false):
		txt.add_child(rotulo("Golpe da arma na mão (botão grande)", 12, Color(0.6, 0.75, 0.55)))
	l.add_child(txt)
	return cx

# ---------- profissões (Parte 3 do Quimera) ----------
const ICONE_PROF := {"min": "pf_min", "len": "pf_len", "fer": "pf_fer", "alf": "pf_alf", "mer": "pf_mer", "faz": "pf_faz", "coz": "pf_coz"}
const COR_VIGOR := Color(0.55, 0.8, 0.42)

func icone_redondo(nome: String, tam: float, cor := Color.WHITE, borda := OURO) -> Control:
	var moldura := Panel.new()
	moldura.custom_minimum_size = Vector2(tam, tam)
	moldura.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	moldura.add_theme_stylebox_override("panel", caixa(Color(0.05, 0.045, 0.04, 1), borda.darkened(0.2), 1, int(tam / 2)))
	var ic := TextureRect.new()
	ic.texture = icone_tex(nome)
	ic.set_anchors_preset(Control.PRESET_FULL_RECT)
	var f := tam * 0.2
	ic.offset_left = f
	ic.offset_top = f
	ic.offset_right = -f
	ic.offset_bottom = -f
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.modulate = tinta(ic.texture, cor)
	ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
	moldura.add_child(ic)
	return moldura

static func tempo_txt(s: float) -> String:
	var mi := int(ceil(s / 60.0))
	if mi < 60:
		return "%d min" % mi
	return "%d h %02d min" % [mi / 60, mi % 60]

# vigor (energia para trabalhar) e ouro, em cima das profissões e das receitas
func linha_vigor() -> Control:
	var P = m.P
	var v: float = P.vigor()
	var mx := float(P.dados.vigor.max)
	var cx := VBoxContainer.new()
	cx.add_theme_constant_override("separation", 3)
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 8)
	var ic := TextureRect.new()
	ic.texture = icone_tex("vigor")
	ic.custom_minimum_size = Vector2(20, 20)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.modulate = COR_VIGOR
	ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(ic)
	l.add_child(rotulo("Vigor %d / %d" % [floor(v), int(mx)], 16, COR_VIGOR))
	l.add_child(rotulo("   cheio" if v >= mx - 0.01 else "   cheio em %s" % tempo_txt(P.vigor_cheio_em()), 13, APAGADO))
	var esp_ := Control.new()
	esp_.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	l.add_child(esp_)
	l.add_child(linha_ouro())
	cx.add_child(l)
	cx.add_child(barra_prog(v / mx, COR_VIGOR.darkened(0.15), 7))
	var d := rotulo("Coletar e criar gastam vigor. Ele volta sozinho: +%d a cada %d h, mesmo com o jogo fechado." % [int(mx), int(P.dados.vigor.enche) / 3600], 12, APAGADO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	cx.add_child(d)
	return cx

func montar_profissoes() -> void:
	var P = m.P
	conteudo.add_child(linha_vigor())
	var grupo := ""
	for k in P.dados.profissoes:
		var pf: Dictionary = P.dados.profissoes[k]
		if pf.grupo != grupo:
			grupo = pf.grupo
			separador(grupo)
		conteudo.add_child(linha_prof_card(k))
	separador("Ranks")
	var ranks: Array = P.dados.ranks
	var t := "Sobe sozinha trabalhando. Cada rank (a cada 2 níveis; o 19 e o 20 têm rank próprio): -4% de vigor, +3,5% de rapidez e +2% de chance de +1 na coleta. Criar: mais chance de a peça sair Rara ou Épica."
	var d := rotulo(t, 12, APAGADO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	conteudo.add_child(d)
	var g := GridContainer.new()
	g.columns = 4
	g.add_theme_constant_override("h_separation", 18)
	g.add_theme_constant_override("v_separation", 2)
	for r in ranks.size():
		var nv := "20" if r == 10 else "19" if r == 9 else "%d-%d" % [2 * r + 1, 2 * r + 2]
		g.add_child(rotulo("%s  ·  Nv %s" % [ranks[r], nv], 12, OURO_CLARO if r == 0 else TEXTO))
	conteudo.add_child(g)

# ---------- Títulos (André 2026-11-12) ----------
# Todos os títulos, os ganhos primeiro em cada grupo. Cada um: nome na cor do brilho, como ganhou e o bônus
# ("Venceu o Uivo-Rei · +5% crítico"). Tocar em Usar põe o título em cima da cabeça e liga o bônus (o servidor confere);
# Tirar deixa sem título. Os que faltam ficam apagados, com o feito que falta.
const GRUPOS_TITULO := [["caca", "Caça"], ["boss", "Bosses de mundo"], ["historia", "História"], ["prof", "Profissões"]]
func grupo_titulo(T: Dictionary) -> String:
	var c: Dictionary = T.get("cond", {})
	if c.has("boss"):
		return "boss"
	if c.has("prof"):
		return "prof"
	if c.has("abates"):
		return "caca"
	return "historia"

func montar_titulos() -> void:
	var P = m.P
	var todos: Dictionary = Titulos.dados_de(P)
	var tit = P.prog.get("tit")
	var tem: Array = tit.get("tem", []) if tit is Dictionary else []
	var uso: String = str(tit.get("uso", "")) if tit is Dictionary else ""
	var d := rotulo("Um título em uso por vez: ele aparece em cima da sua cabeça e o bônus só vale enquanto está em uso. Troque quando quiser. Quanto mais difícil, mais brilhante.", 12, APAGADO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	conteudo.add_child(d)
	separador("Em uso")
	if uso != "" and todos.has(uso):
		conteudo.add_child(card_titulo(uso, todos[uso], true, true))
	else:
		conteudo.add_child(rotulo("Nenhum. Toque em Usar num título ganho.", 13, APAGADO))
	var n := 0
	for id in todos:
		if id in tem:
			n += 1
	for g in GRUPOS_TITULO:
		var ids: Array = todos.keys().filter(func(id): return grupo_titulo(todos[id]) == g[0])
		if ids.is_empty():
			continue
		ids.sort_custom(func(a, b):
			var ta: bool = a in tem
			var tb: bool = b in tem
			if ta != tb:
				return ta
			return int(todos[a].get("r", 0)) < int(todos[b].get("r", 0)))
		var ganhos: int = ids.filter(func(id): return id in tem).size()
		separador("%s  ·  %d de %d" % [g[1], ganhos, ids.size()])
		for id in ids:
			conteudo.add_child(card_titulo(id, todos[id], id in tem, id == uso))

func card_titulo(id: String, T: Dictionary, ganho: bool, em_uso: bool) -> Control:
	var r: int = clampi(int(T.get("r", 0)), 0, 4)
	var cor: Color = Titulos.COR[r] if ganho else Color(0.45, 0.42, 0.38)
	var cx := PanelContainer.new()
	var fundo := Color(0.1, 0.088, 0.072, 1) if ganho else Color(0.07, 0.064, 0.056, 1)
	cx.add_theme_stylebox_override("panel", caixa(fundo, cor.darkened(0.35) if ganho and r >= 2 else Color(0.3, 0.24, 0.16) if ganho else Color(0.18, 0.16, 0.13), 2 if em_uso else 1, 8))
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 10)
	cx.add_child(l)
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.add_theme_constant_override("separation", 1)
	var nome := rotulo(Titulos.enfeite(str(T.nome), r) if ganho else str(T.nome), 16, cor)
	if ganho and r >= 3:
		nome.add_theme_color_override("font_outline_color", Titulos.CONTORNO[r])
		nome.add_theme_constant_override("outline_size", 4)
	txt.add_child(nome)
	var raridade: String = str(m.P.dados.raridades[r].nome) if r < m.P.dados.raridades.size() else ""
	var dsc := rotulo("%s · %s" % [str(T.como), str(T.txt)], 12, TEXTO if ganho else APAGADO)
	dsc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	txt.add_child(dsc)
	if raridade != "":
		txt.add_child(rotulo(raridade, 11, Titulos.COR[r].darkened(0.15) if ganho else APAGADO.darkened(0.3)))
	l.add_child(txt)
	var b: Button
	if not ganho:
		b = botao("Falta", func(): m.hud.aviso("Para ganhar: %s" % str(T.como)), 13)
		b.modulate = Color(1, 1, 1, 0.6)
	elif em_uso:
		b = botao("Tirar", func(): acao_item({"acao": "titulo", "id": ""}), 13, true)
	else:
		b = botao("Usar", func(): acao_item({"acao": "titulo", "id": id}), 13)
	b.custom_minimum_size = Vector2(86, 38)
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(b)
	return cx

# ---------- Missões (progressão até o Nv 100, André 2026-11-11: "um menu de missões") ----------
# História v2 (André 2026-11-11, "Aethra: a Crônica da Névoa"): a aba vira o livro da história. Capítulos em ordem,
# agrupados por ato. Capítulo feito: a página do Diário (o que aconteceu) e os rumores ouvidos. Capítulo da vez: as
# missões dele, e na missão da vez cada etapa (feita, a da vez com o andamento, as próximas) e o "Ir para". Capítulo
# que ainda não chegou: só o número e o nível (o nome aparece quando o herói chega no nível dele).
const LILAS := Color(0.72, 0.62, 0.95)
func montar_missoes() -> void:
	var nv = m.nevoa
	if nv == null or nv.H.is_empty():
		conteudo.add_child(rotulo("Sem missões por enquanto.", 14, APAGADO))
		return
	var ms: Array = nv.H.get("missoes", [])
	var caps: Array = nv.H.get("capitulos", [])
	var feitas: int = nv.feitas()
	var h: Dictionary = nv.hist()
	var titulo := str(m.P.hist_info.get("titulo", "")) if m.P.hist_info.get("titulo") != null else ""
	if titulo != "": # título do ato (Ato II: Sentinela da Ordem), vem do servidor (histInfo)
		conteudo.add_child(rotulo("Título: %s" % titulo, 15, Color("f3d27a")))
	var d := rotulo("A história principal abre o mapa: cada capítulo tira a névoa de uma região ou abre um recurso. O nível sobe caçando; a história chama quando você chega no nível do próximo capítulo.", 12, APAGADO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	conteudo.add_child(d)
	if caps.is_empty(): # dados antigos: lista simples
		for i in ms.size():
			conteudo.add_child(_card_missao(ms[i], i, feitas, h))
		return
	var ato := ""
	for C in caps:
		var idx: Array = [] # índices das missões do capítulo
		for i in ms.size():
			if int(ms[i].get("cap", 0)) == int(C.n):
				idx.append(i)
		if idx.is_empty():
			continue
		if str(C.get("ato", "")) != ato:
			ato = str(C.get("ato", ""))
			separador(ato)
		var feito: bool = feitas > int(idx[-1])
		var atual: bool = not feito and feitas >= int(idx[0])
		conteudo.add_child(_card_capitulo(C, idx, ms, feitas, h, feito, atual))

func _card_capitulo(C: Dictionary, idx: Array, ms: Array, feitas: int, h: Dictionary, feito: bool, atual: bool) -> Control:
	var nivel := int(m.P.prog.nivel)
	var cedo: bool = nivel < int(C.nv) and not feito and not atual
	var pc := PanelContainer.new()
	var borda := Color(0.45, 0.75, 0.4) if feito else (LILAS if atual else Color(0.3, 0.26, 0.2))
	pc.add_theme_stylebox_override("panel", caixa(Color(0.12, 0.1, 0.16, 1) if atual else Color(0.09, 0.075, 0.06, 1), borda, 2 if atual else 1, RAIO_JANELA))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 4)
	pc.add_child(v)
	var nome := "???" if cedo else str(C.nome)
	var topo := rotulo("%sCapítulo %d · %s   ·   Nv %d" % ["✓ " if feito else "", int(C.n), nome, int(C.nv)], 16, Color(0.6, 0.9, 0.55) if feito else (Color("e6dcff") if atual else APAGADO))
	topo.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(topo)
	if cedo:
		v.add_child(rotulo("Chega no nível %d para a história continuar." % int(C.nv), 12, APAGADO))
		return pc
	if atual and str(C.get("frase", "")) != "":
		v.add_child(rotulo(str(C.frase), 12, Color(0.8, 0.76, 0.95)))
	if feito: # a página do Diário e os rumores que já chegaram
		if str(C.get("diario", "")) != "":
			var dd := rotulo(str(C.diario), 12, TEXTO)
			dd.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			v.add_child(dd)
		for R in C.get("rumores", []):
			if int(R.nv) <= nivel:
				var r := rotulo("Rumor (Nv %d) · %s: \"%s\"" % [int(R.nv), str(R.quem), str(R.texto)], 11, APAGADO)
				r.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
				v.add_child(r)
		return pc
	for i in idx:
		v.add_child(_card_missao(ms[i], i, feitas, h))
	return pc

func _card_missao(M: Dictionary, i: int, feitas: int, h: Dictionary) -> Control:
	var feita := i < feitas
	var atual := i == feitas
	var cedo: bool = int(m.P.prog.nivel) < int(M.nv)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)
	var topo := rotulo("%s%s   ·   Nv %d" % ["✓ " if feita else ("▸ " if atual else "○ "), M.nome, int(M.nv)], 14, Color(0.6, 0.9, 0.55) if feita else (Color("e6dcff") if atual else (APAGADO if cedo else TEXTO)))
	v.add_child(topo)
	if not atual:
		return v
	var quem: String = str(M.get("npcNome", M.npc))
	var abre: Array = []
	for k in M.get("libera", []):
		var Z: Dictionary = m.nevoa.zona(str(k))
		abre.append(Z.nome if not Z.is_empty() else str(m.nevoa.H.get("recursos", {}).get(k, k)))
	var linha := "Com %s" % quem + ("  ·  abre: %s" % ", ".join(abre) if not abre.is_empty() else "")
	if cedo:
		linha += "\nLibera no nível %d" % int(M.nv)
	elif not h.get("ac", false):
		linha += "\nFale com %s para começar" % quem
	var l := rotulo(linha, 12, TEXTO)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(l)
	if h.get("ac", false): # as etapas: feitas, a da vez (com o texto do servidor) e as próximas
		var e := int(h.get("e", 0))
		var hi: Dictionary = m.P.hist_info
		var etapas: Array = M.get("etapas", [])
		for k in etapas.size():
			var txt: String = str(etapas[k])
			if k == e and str(hi.get("id", "")) == str(M.id):
				txt = str(hi.get("txt", txt))
			var et := rotulo("%s %s" % ["✓" if k < e else ("▸" if k == e else "·"), txt], 12, Color(0.6, 0.9, 0.55) if k < e else (Color(1, 0.95, 0.85) if k == e else APAGADO))
			et.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			v.add_child(et)
		if etapas.size() > 1:
			v.add_child(barra_prog(float(e) / float(etapas.size()), LILAS))
	if not cedo and m.missao_ativa != null: # André 2026-11-11: "Ir para" leva sozinho até o NPC ou o lugar
		var ir := botao("Ir para", _ir_missao, 14, true)
		ir.custom_minimum_size = Vector2(130, 34)
		ir.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		v.add_child(ir)
	return v

func _ir_missao() -> void:
	fechar()
	m.missao_ativa.ir()

func linha_prof_card(k: String) -> Control:
	var P = m.P
	var pf: Dictionary = P.dados.profissoes[k]
	var nv: int = P.prof_nivel(k)
	var pts: float = float(P.prog.prof.get(k, 0.0))
	var b: Dictionary = P.prof_bonus(k)
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1), Color(0.3, 0.24, 0.16), 1, 8))
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 12)
	cx.add_child(l)
	l.add_child(icone_redondo(ICONE_PROF[k], 48))
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.add_theme_constant_override("separation", 2)
	var cab := HBoxContainer.new()
	cab.add_theme_constant_override("separation", 10)
	cab.add_child(rotulo(pf.nome, 16, TEXTO))
	cab.add_child(rotulo(str(P.dados.ranks[b.rank]), 14, OURO_CLARO))
	cab.add_child(rotulo("Nv %d" % nv, 13, APAGADO))
	var esp_ := Control.new()
	esp_.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cab.add_child(esp_)
	var maxn := int(P.dados.profMax)
	cab.add_child(rotulo("Nível máximo" if nv >= maxn else "%d / %d pontos" % [floor(pts), int(P.prof_pontos(nv + 1))], 12, OURO_CLARO if nv >= maxn else APAGADO))
	txt.add_child(cab)
	var d := rotulo(pf.desc, 12, APAGADO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	txt.add_child(d)
	var a: float = P.prof_pontos(nv)
	var z: float = P.prof_pontos(nv + 1)
	txt.add_child(barra_prog(1.0 if nv >= maxn else (pts - a) / max(1.0, z - a), Color(0.85, 0.66, 0.3), 6))
	var bon := []
	if k == "mer":
		var mc: Dictionary = P.mercador()
		bon.append("Rosa paga +%s%% e cobra -%s%%" % [P.num(mc.venda * 100, 0), P.num(mc.compra * 100, 0)])
		bon.append("1 ponto a cada %d de ouro negociado" % int(P.dados.mercador.pontoOuro))
	else:
		if b.menosVigor > 0:
			bon.append("-%d%% vigor" % round(b.menosVigor * 100))
		if k in ["min", "len"]:
			if b.rapidez > 1.0:
				bon.append("+%s%% mais rápido" % P.num((b.rapidez - 1.0) * 100, 1))
			if b.extra > 0:
				bon.append("+%d%% de chance de +1" % round(b.extra * 100))
		else:
			bon.append("%s%% de chance de subir a raridade" % P.num(P.chance_raridade(k) * 100, 1))
	if bon.is_empty():
		bon.append("Trabalhe para subir de rank")
	txt.add_child(rotulo(" · ".join(bon), 12, Color(0.6, 0.75, 0.55)))
	l.add_child(txt)
	return cx

# receitas do Ferreiro (forja do Tomás) ou do Alfaiate (banca da Rosa)
func montar_receitas(prof: String) -> void:
	var P = m.P
	conteudo.add_child(linha_vigor())
	var of: Dictionary = P.dados.oficina[prof]
	var aqui: bool = m.trabalho.perto_oficina(prof)
	# Vila dos Lotes: perto de uma bigorna, fornalha ou bancada construída também dá (cada uma serve para umas receitas)
	var estacoes := ["bigorna", "fornalha"] if prof == "fer" else ["fogao"] if prof == "coz" else ["bancada"]
	var na_estacao: bool = not aqui and m.construcao != null and m.construcao.estacao_perto(estacoes)
	var st := rotulo(("Você está %s: dá para criar." % of.onde) if aqui else ("Você está perto da sua estação: dá para criar o que ela faz.") if na_estacao else ("Para criar, vá %s ou a uma %s construída na Vila dos Lotes." % [str(of.onde).replace("na ", "até a "), " ou ".join(estacoes)]), 13, VERDE if aqui or na_estacao else APAGADO)
	st.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	conteudo.add_child(st)
	separador("Receitas · %s Nv %d" % [P.dados.profissoes[prof].nome, P.prof_nivel(prof)])
	for r in P.dados.receitas:
		var R: Dictionary = P.dados.receitas[r]
		if R.prof == prof:
			conteudo.add_child(linha_receita(r, R, aqui or (na_estacao and m.construcao.estacao_perto([m.construcao.estacao_da_receita(R)]))))

func linha_receita(r: String, R: Dictionary, aqui: bool) -> Control:
	var P = m.P
	var faz := {"k": str(R.faz), "r": 0} if P.dados.itens[str(R.faz)].has("lugar") else {"k": str(R.faz), "n": 1}
	var nv_ok: bool = P.prof_nivel(R.prof) >= int(R.nivel)
	var custo: float = P.custo_vigor(R.prof, float(R.vigor))
	var tem := true
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1) if nv_ok else Color(0.07, 0.063, 0.055, 1), Color(0.3, 0.24, 0.16), 1, 8))
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 12)
	cx.add_child(l)
	var c := celula(faz, false, func(): pass, 52)
	c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(c)
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.add_theme_constant_override("separation", 2)
	var nome: String = P.dados.itens[str(R.faz)].nome
	var cab := HBoxContainer.new()
	cab.add_theme_constant_override("separation", 10)
	cab.add_child(rotulo(nome, 15, TEXTO if nv_ok else APAGADO))
	if not nv_ok:
		cab.add_child(rotulo("precisa de Nv %d" % int(R.nivel), 12, Color("e0806a")))
	txt.add_child(cab)
	if P.eh_equip(faz):
		var t := rotulo("Sai Comum, com %s%% de chance de subir de raridade · %s" % [P.num(P.chance_raridade(R.prof) * 100, 0), P.texto_item(faz)], 12, APAGADO)
		t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		txt.add_child(t)
	# materiais: verde se tem, vermelho se falta
	var mats := HFlowContainer.new()
	mats.add_theme_constant_override("h_separation", 12)
	for k in R.usa:
		var n := int(R.usa[k])
		var t2: int = P.contar(k)
		if t2 < n:
			tem = false
		var ml := HBoxContainer.new()
		ml.add_theme_constant_override("separation", 4)
		var ic := TextureRect.new()
		ic.texture = icone_tex(P.icone_item({"k": k}))
		ic.custom_minimum_size = Vector2(18, 18)
		ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ic.modulate = tinta(ic.texture, P.cor_item({"k": k}))
		ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		ml.add_child(ic)
		ml.add_child(rotulo("%s %d/%d" % [P.dados.itens[k].nome, t2, n], 12, VERDE if t2 >= n else Color("e0806a")))
		mats.add_child(ml)
	var vg := rotulo("Vigor %s" % P.num(custo, 1), 12, COR_VIGOR if P.vigor() >= custo else Color("e0806a"))
	mats.add_child(vg)
	txt.add_child(mats)
	l.add_child(txt)
	var pode: bool = aqui and nv_ok and tem and P.vigor() >= custo
	var b := botao("Criar", func(): criar(r), 14, pode)
	b.custom_minimum_size = Vector2(96, 40)
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	b.disabled = not pode
	avisar_travado(b, func(): return motivo_receita(aqui, "a oficina ou a estação certa", nv_ok, "%s Nv %d" % [P.dados.profissoes[R.prof].nome, int(R.nivel)], R.usa, custo))
	l.add_child(b)
	return cx

# mostra o motivo de um botão travado no meio da tela, com o som de "não dá"
func avisar_travado(b: BaseButton, motivo: Callable) -> void:
	ao_tocar_travado(b, func(): _avisar_motivo(str(motivo.call())))

func _avisar_motivo(t: String) -> void:
	if t != "":
		m.hud.aviso(t)
		m.sons.tocar("dash", -12.0)

# primeiro motivo que impede criar ("" = dá)
func motivo_receita(aqui: bool, onde: String, nv_ok: bool, nv_txt: String, usa: Dictionary, custo: float) -> String:
	var P = m.P
	if not nv_ok:
		return "Nível baixo: precisa de %s" % nv_txt
	if not aqui:
		return "Vá até %s para criar" % onde
	for k in usa:
		if P.contar(k) < int(usa[k]):
			return "Falta %s (%d/%d)" % [str(P.dados.itens[k].nome).to_lower(), P.contar(k), int(usa[k])]
	if P.vigor() < custo:
		return "Sem vigor: ele volta sozinho com o tempo (cheio a cada 6 h)"
	return ""

func criar(r: String, rar := 0) -> void:
	if not m.on():
		m.hud.aviso("Criar só funciona online (a peça fica na sua conta)")
		return
	if rar > 0: # Raro em diante: evolui a peça da raridade de baixo (a janelinha de sempre pergunta e mostra a chance)
		var i: int = m.P.peca_para_evoluir(str(m.P.dados.receitas[r].faz), rar)
		if i < 0:
			_avisar_motivo("Precisa de %s na mochila" % m.P.nome_item({"k": str(m.P.dados.receitas[r].faz), "r": rar - 1}))
			return
		perguntar_evoluir(i)
		return
	if m.construcao: # janelinha de quantas + barrinha (André 2026-11-05)
		m.construcao.pedir_criar("receita", r)
		return
	m.rede("criar", {"r": r})

# ---------- aba Criar (André 2026-11-04): tudo o que se cria, em submenus ----------
# receitas das profissões (Ferreiro, Alfaiate) e peças da construção / ferramentas da fazenda, cada uma com onde se cria
func itens_criar(cat: String) -> Array:
	var P = m.P
	var D: Dictionary = P.dados
	var lista := []
	for r in D.receitas:
		var R: Dictionary = D.receitas[r]
		# André 2026-11-09: barras e carvão saem da janela da fornalha (combustível + minério), não da aba Criar
		# (criar por aqui desconectava). A receita na hora continua no Tomás (Profissões > Ferreiro).
		if eh_da_fornalha(R):
			continue
		var lugar := str(D.itens[str(R.faz)].get("lugar", ""))
		var c := "comida" if str(R.prof) == "coz" else "materiais" if lugar == "" else "armas" if lugar in ["espada", "cajado", "acessorio"] else "armaduras"
		if c == cat:
			lista.append({"tipo": "receita", "k": r, "nome": str(D.itens[str(R.faz)].nome), "nivel": int(R.nivel)})
	for k in D.get("construcoes", {}):
		var C: Dictionary = D.construcoes[k]
		var c := "estacoes" if C.has("estacao") else "casa" if str(C.get("aba", "")) == "casa" else "moveis"
		if c == cat:
			lista.append({"tipo": "obra", "k": k, "nome": str(C.nome), "nivel": 0})
	if cat == "ferramentas":
		for k in D.get("ferramentas", {}):
			lista.append({"tipo": "obra", "k": k, "nome": str(D.itens[k].nome), "nivel": 0})
	lista.sort_custom(func(a, b): return a.nivel < b.nivel or (a.nivel == b.nivel and a.nome.naturalnocasecmp_to(b.nome) < 0))
	return lista

# receita que é da fornalha (mesma conta de shared/dados.js RECEITA_ESTACAO)
static func eh_da_fornalha(R: Dictionary) -> bool:
	var faz := str(R.faz)
	return faz.begins_with("barra_") or faz == "carvao"

# aviso com botão: barras e carvão ficam na fornalha (perto do herói abre a janela; longe, leva até ela)
func linha_fornalha() -> Control:
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1), Color(0.3, 0.24, 0.16), 1, 8))
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 12)
	cx.add_child(l)
	var ic := TextureRect.new()
	ic.texture = icone_tex("cs_fornalha")
	ic.custom_minimum_size = Vector2(40, 40)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(ic)
	var t := rotulo("Barras e carvão saem da Fornalha: ponha lenha ou carvão e o minério, ela funde sozinha.", 13, OURO_CLARO)
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	l.add_child(t)
	var cons = m.construcao
	var b := botao("Fornalha", ir_fornalha, 14, cons != null)
	b.custom_minimum_size = Vector2(96, 40)
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(b)
	return cx

func ir_fornalha() -> void:
	var cons = m.construcao
	if cons == null:
		return
	if cons._alvos_estacao("fornalha").is_empty():
		_avisar_motivo("Construa uma fornalha no seu terreno (ou crie as barras no Tomás)")
		return
	fechar()
	cons.tocar_estacao("fornalha")

func montar_criar() -> void:
	conteudo.add_child(linha_vigor())
	montar_criar_quimera()
	return
	# (antes: submenus Aqui, Materiais, Armas...; ficou de reserva)
	if cat_criar == "aqui":
		montar_criar_aqui()
		return
	if cat_criar == "materiais":
		conteudo.add_child(linha_fornalha())
	var lista := itens_criar(cat_criar)
	if lista.is_empty():
		conteudo.add_child(rotulo("Nada para criar aqui ainda.", 13, APAGADO))
	for e in lista:
		conteudo.add_child(linha_do_criar(e))

# submenu "Aqui": tudo o que pede a estação perto, separado pelos outros submenus (Materiais, Armas, Armaduras...)
func montar_criar_aqui() -> void:
	var ests := estacoes_perto()
	var nomes := []
	for est in ests:
		nomes.append("da " + NOME_ESTACAO[est])
	var st := rotulo("Você está perto %s: aqui fica tudo o que %s. Os outros submenus mostram o resto." % [" e ".join(nomes), "ela faz" if nomes.size() == 1 else "elas fazem"], 13, VERDE)
	st.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	conteudo.add_child(st)
	var algum := false
	if "fornalha" in ests and m.construcao != null and m.construcao.minha_fornalha_perto() != "":
		conteudo.add_child(linha_fornalha())
		algum = true
	for c in CATS_CRIAR:
		if c[0] == "aqui":
			continue
		var lista := []
		for e in itens_criar(c[0]):
			var est := estacao_do_item(e)
			# móveis e peças da casa pedem a bancada construída (a banca da Rosa só faz as receitas do Alfaiate)
			if est in ests and (e.tipo == "receita" or (m.construcao != null and m.construcao.estacao_perto([est]))):
				lista.append(e)
		if lista.is_empty():
			continue
		algum = true
		separador(c[1])
		for e in lista:
			conteudo.add_child(linha_do_criar(e))
	algum = montar_melhorar_aqui(ests) or algum
	if not algum:
		conteudo.add_child(rotulo("Nada para criar aqui ainda.", 13, APAGADO))

# "Melhorar equipamento" no submenu da estação (André 2026-11-07: "pegar um épico, transformar em lendário" na bancada):
# as peças da mochila e as vestidas que esta estação melhora (bigorna/forja do Tomás: armas; bancada/banca da Rosa:
# armaduras e colar). Evoluir e Reforçar são os mesmos do cartão da peça na mochila (que continua igual); o servidor confere.
func montar_melhorar_aqui(ests: Array, so_tipo := "", so_reforco := false) -> bool:
	var P = m.P
	var D: Dictionary = P.dados
	if not D.has("catalisador"):
		return false
	var pecas := [] # [peça, i da mochila (-1 = vestida), lugar vestido]
	for lg in P.prog.equip:
		var v = P.prog.equip[lg]
		if v != null and P.eh_equip(v):
			pecas.append([v, -1, str(lg)])
	for i in P.prog.mochila.size():
		var it = P.prog.mochila[i]
		if it != null and P.eh_equip(it):
			pecas.append([it, i, ""])
	var achou := false
	for p in pecas:
		var it = p[0]
		var tipo := tipo_catalisador(it.k)
		if so_tipo != "" and tipo != so_tipo:
			continue
		var prof: String = str(D.receitas[it.k].prof) if D.receitas.has(it.k) else ("fer" if tipo == "arma" else "alf")
		if not (("bigorna" if prof == "fer" else "bancada") in ests):
			continue
		var pode_evoluir: bool = not so_reforco and p[1] >= 0 and int(it.r) < D.raridades.size() - 1
		var pode_reforcar: bool = int(it.get("e", 0)) < P.reforco_max(it)
		if not pode_evoluir and not pode_reforcar:
			continue
		if not achou:
			separador("Melhorar equipamento")
			var ex := rotulo("Evoluir sobe a raridade (Épica vira Lendária, Lendária vira Mítica) com catalisador e material. Reforçar dá +1.", 12, APAGADO)
			ex.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			conteudo.add_child(ex)
			achou = true
		var cx := PanelContainer.new()
		cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1), P.cor_item(it).darkened(0.3), 1, 8))
		var l := HBoxContainer.new()
		l.add_theme_constant_override("separation", 12)
		cx.add_child(l)
		var c := celula(it, false, func(): pass, 52)
		c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		l.add_child(c)
		var txt := VBoxContainer.new()
		txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		txt.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		txt.add_theme_constant_override("separation", 2)
		txt.add_child(rotulo(P.nome_item(it), 15, P.cor_item(it)))
		if pode_evoluir:
			var r := int(it.r) + 1
			var usa := {D.catalisador[tipo][r - 1]: 1}
			usa.merge(D.catalisador.usa[tipo][r - 1])
			var partes := []
			var tem_tudo := true
			for k in usa:
				var tem: int = P.contar(k)
				tem_tudo = tem_tudo and tem >= int(usa[k])
				partes.append("%s %d/%d" % [D.itens[k].nome, tem, int(usa[k])])
			txt.add_child(rotulo("Evoluir para %s:" % D.raridades[r].nome, 12, VERDE if tem_tudo else Color("e0806a")))
			var ics := HFlowContainer.new() # André 2026-11-09: materiais em ícone, nada de lista
			ics.add_theme_constant_override("h_separation", 8)
			for k in usa:
				ics.add_child(icone_material(str(k), P.contar(k), int(usa[k])))
			txt.add_child(ics)
		elif p[1] < 0 and not so_reforco:
			txt.add_child(rotulo("Vestida · para evoluir, tire e guarde na mochila", 12, APAGADO))
		l.add_child(txt)
		var bs := VBoxContainer.new()
		bs.add_theme_constant_override("separation", 4)
		bs.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		if pode_evoluir:
			var i: int = p[1]
			var be := botao("Evoluir", func(): perguntar_evoluir(i), 14, true)
			be.custom_minimum_size = Vector2(120, 36)
			bs.add_child(be)
		if pode_reforcar:
			var onde := {"i": p[1]} if p[1] >= 0 else {"lugar": p[2]}
			var rf := botao("Reforçar", func(): m.reforco.comecar(onde, false), 14, not pode_evoluir)
			rf.custom_minimum_size = Vector2(120, 36)
			bs.add_child(rf)
		l.add_child(bs)
		conteudo.add_child(cx)
	return achou

# estação que o item pede ("" = cria em qualquer lugar). A mesma conta de linha_criavel.
func estacao_do_item(e: Dictionary) -> String:
	var D: Dictionary = m.P.dados
	if e.tipo == "receita":
		var R: Dictionary = D.receitas[e.k]
		var faz_s := str(R.faz)
		return "fornalha" if faz_s.begins_with("barra_") or faz_s == "carvao" else "bigorna" if str(R.prof) == "fer" else "fogao" if str(R.prof) == "coz" else "bancada"
	var cons = m.construcao
	var C: Dictionary = cons.dados_criar(e.k) if cons != null else D.get("construcoes", {}).get(e.k, D.get("ferramentas", {}).get(e.k, {}))
	return "bancada" if C.get("bancada", false) else ""

# ---------- Criar igual ao Quimera ----------
func montar_criar_quimera() -> void:
	var busca := LineEdit.new()
	busca.placeholder_text = "Buscar"
	busca.text = busca_criar
	busca.right_icon = icone_tex("lupa") if ResourceLoader.exists("res://icones/lupa.svg") else null
	busca.add_theme_font_size_override("font_size", 16)
	busca.custom_minimum_size = Vector2(0, 42)
	busca.add_theme_stylebox_override("normal", caixa(Color(0.035, 0.03, 0.026, 1), Color(0.36, 0.29, 0.19), 1, 10))
	busca.add_theme_stylebox_override("focus", caixa(Color(0.035, 0.03, 0.026, 1), OURO, 1, 10))
	busca.clear_button_enabled = true
	busca.text_changed.connect(func(t: String):
		busca_criar = t
		preencher_lista_criar())
	conteudo.add_child(busca)
	# estações perto, para alternar entre uma e outra (Fornalha e Baú abrem a janela deles)
	var ests := estacoes_perto()
	var cons = m.construcao
	var tem_bau: bool = cons != null and cons.estacao_perto(["bau"])
	if est_criar != "" and not (est_criar in ests):
		est_criar = ""
	var chips := HFlowContainer.new()
	chips.add_theme_constant_override("h_separation", 8)
	chips.add_theme_constant_override("v_separation", 6)
	for est in ["bancada", "bigorna", "fornalha", "fogao"]: # mesma ordem do Quimera (Bancada, Bigorna, Forno, Baú)
		if est in ests:
			chips.add_child(chip_estacao(est, str(NOME_ESTACAO[est]).split(" ")[0], est == est_criar))
	if tem_bau:
		chips.add_child(chip_estacao("bau", "Baú", false))
	var vt := botao("Ver tudo", func():
		est_criar = ""
		atualizar(), 15, est_criar == "")
	vt.custom_minimum_size = Vector2(0, 40)
	chips.add_child(vt)
	conteudo.add_child(chips)
	lista_criar = VBoxContainer.new()
	lista_criar.add_theme_constant_override("separation", 8)
	conteudo.add_child(lista_criar)
	preencher_lista_criar()

func chip_estacao(est: String, nome: String, ativo: bool) -> Button:
	var b := botao(nome, func(): tocar_chip_estacao(est), 15, ativo)
	b.custom_minimum_size = Vector2(0, 40)
	b.icon = icone_tex("cs_" + est)
	b.expand_icon = false
	b.add_theme_constant_override("icon_max_width", 26)
	return b

func tocar_chip_estacao(est: String) -> void:
	var cons = m.construcao
	if est == "fornalha" and cons != null and cons.minha_fornalha_perto() != "":
		fechar()
		cons.abrir_forno(cons.minha_fornalha_perto())
		return
	if est == "bau" and cons != null:
		fechar()
		cons.tocar_estacao("bau")
		return
	est_criar = est
	grupos_abertos = {}
	atualizar()
	rolagem.scroll_vertical = 0

# o que entra num grupo: [{e, rar}] (arma e armadura: uma linha por raridade), já filtrado pela estação e pela busca
func entradas_grupo(g: String) -> Array:
	var D: Dictionary = m.P.dados
	var out := []
	var q := busca_criar.strip_edges().to_lower()
	for e in itens_criar(g):
		if est_criar != "" and estacao_do_item(e) != est_criar:
			continue
		var equip: bool = e.tipo == "receita" and D.has("catalisador") and D.itens[str(D.receitas[e.k].faz)].has("lugar")
		for r in (D.raridades.size() if equip else 1):
			var nome: String = m.P.nome_item({"k": str(D.receitas[e.k].faz), "r": r}) if equip else str(e.nome)
			if q != "" and not (q in nome.to_lower()) and not (q in str(e.nome).to_lower()):
				continue
			out.append({"e": e, "rar": r if equip else -1})
	return out

# dá para criar agora? (a mesma conta do botão Criar da linha)
func pode_criar_ja(x: Dictionary) -> bool:
	var P = m.P
	var D: Dictionary = P.dados
	var e: Dictionary = x.e
	var cons = m.construcao
	if e.tipo == "receita":
		var R: Dictionary = P.receita_na_raridade(e.k, maxi(0, int(x.rar)))
		var est := estacao_do_item(e)
		if not (m.trabalho.perto_oficina(str(R.prof)) or (cons != null and cons.estacao_perto([est]))):
			return false
		if P.prof_nivel(str(R.prof)) < int(R.nivel) or P.vigor() < P.custo_vigor(str(R.prof), float(R.vigor)):
			return false
		for k in R.usa:
			if P.contar(k) < int(R.usa[k]):
				return false
		return int(x.rar) <= 0 or P.peca_para_evoluir(str(R.faz), int(x.rar)) >= 0
	if cons == null or cons.motivo_criar(e.k) != "":
		return false
	var C: Dictionary = cons.dados_criar(e.k)
	if C.get("bancada", false) and not cons.estacao_perto(["bancada"]):
		return false
	for k in C.get("custo", {}):
		if P.contar(k) < int(C.custo[k]):
			return false
	return true

func preencher_lista_criar() -> void:
	if lista_criar == null or not is_instance_valid(lista_criar):
		return
	for c in lista_criar.get_children():
		lista_criar.remove_child(c)
		c.queue_free()
	var buscando := busca_criar.strip_edges() != ""
	var algum := false
	for g in GRUPOS_CRIAR:
		var k: String = g[0]
		if k == "melhorar":
			if busca_criar.strip_edges() != "":
				continue
			var ests: Array = [est_criar] if est_criar != "" else estacoes_perto()
			if not ("bigorna" in ests or "bancada" in ests):
				continue
			var antes = conteudo # montar_melhorar_aqui escreve em "conteudo": aponta para a sanfona
			var corpo := VBoxContainer.new()
			corpo.add_theme_constant_override("separation", 6)
			conteudo = corpo
			var tem := montar_melhorar_aqui(ests)
			conteudo = antes
			if not tem:
				corpo.queue_free()
				continue
			algum = true
			for i in 2: # sem o separador "MELHORAR EQUIPAMENTO": o cabeçalho da sanfona já diz
				var sp := corpo.get_child(0)
				corpo.remove_child(sp)
				sp.queue_free()
			lista_criar.add_child(cabeca_grupo(k, str(g[1]), -1, corpo.get_child_count() - 1))
			if grupos_abertos.get(k, false):
				lista_criar.add_child(corpo)
			else:
				corpo.queue_free()
			continue
		var itens := entradas_grupo(k)
		if itens.is_empty():
			continue
		algum = true
		var prontas := 0
		for x in itens:
			if pode_criar_ja(x):
				prontas += 1
		lista_criar.add_child(cabeca_grupo(k, str(g[1]), prontas, itens.size()))
		if not (grupos_abertos.get(k, false) or buscando):
			continue
		var corpo := VBoxContainer.new()
		corpo.add_theme_constant_override("separation", 6)
		if k == "materiais" and est_criar in ["", "fornalha"] and not buscando:
			corpo.add_child(linha_fornalha())
		for x in itens:
			corpo.add_child(linha_criavel_rar(x.e, int(x.rar)) if int(x.rar) >= 0 else linha_criavel(x.e))
		if k in ["armaduras", "armas"] and not buscando: # as suas peças para evoluir e reforçar, no mesmo grupo
			linhas_melhorar(corpo, "armadura" if k == "armaduras" else "arma")
		lista_criar.add_child(corpo)
	if not algum:
		lista_criar.add_child(rotulo("Nada encontrado." if buscando else "Nada para criar aqui.", 14, APAGADO))

# evoluir/reforçar as peças da mochila e vestidas, dentro do grupo (sem o título "Melhorar equipamento")
func linhas_melhorar(corpo: Control, tipo: String) -> void:
	var ests: Array = [est_criar] if est_criar != "" else estacoes_perto()
	var antes = conteudo # montar_melhorar_aqui escreve em "conteudo"
	var tmp := VBoxContainer.new()
	conteudo = tmp
	var tem := montar_melhorar_aqui(ests, tipo, true) # evoluir já é a linha da raridade (precisa da peça de baixo)
	conteudo = antes
	if tem:
		for i in 3: # separador (2) e a explicação: o grupo já diz o que é
			var sp := tmp.get_child(0)
			tmp.remove_child(sp)
			sp.queue_free()
		for c in tmp.get_children():
			tmp.remove_child(c)
			corpo.add_child(c)
	tmp.queue_free()

# cabeçalho da sanfona: ▸ ARMADURAS ........ 2/25 (verde = dá para criar agora)
func cabeca_grupo(k: String, nome: String, prontas: int, total: int) -> Control:
	var aberto: bool = grupos_abertos.get(k, false) or busca_criar.strip_edges() != ""
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(0, 54)
	var st := caixa(Color(0.16, 0.135, 0.11, 1) if aberto else Color(0.12, 0.103, 0.085, 1), Color(0.34, 0.28, 0.2), 1, 12)
	for e in ["normal", "hover", "pressed"]:
		b.add_theme_stylebox_override(e, st)
	b.pressed.connect(func():
		if _arrastou:
			return
		grupos_abertos[k] = not grupos_abertos.get(k, false)
		preencher_lista_criar())
	var h := HBoxContainer.new()
	h.set_anchors_preset(Control.PRESET_FULL_RECT)
	h.offset_left = 16
	h.offset_right = -18
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var t := rotulo(("▾  " if aberto else "▸  ") + nome.to_upper(), 18, TEXTO)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	t.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	t.size_flags_vertical = Control.SIZE_FILL
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(t)
	var n := RichTextLabel.new()
	n.bbcode_enabled = true
	n.fit_content = true
	n.scroll_active = false
	n.autowrap_mode = TextServer.AUTOWRAP_OFF
	n.custom_minimum_size = Vector2(90, 0)
	n.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	n.mouse_filter = Control.MOUSE_FILTER_IGNORE
	n.add_theme_font_size_override("normal_font_size", 17)
	n.add_theme_font_size_override("bold_font_size", 17)
	n.text = "[right]%s[/right]" % (str(total) if prontas < 0 else ("[b][color=#7fd46a]%d[/color][/b]/%d" % [prontas, total] if prontas > 0 else "%d" % total))
	h.add_child(n)
	b.add_child(h)
	return b

# arma e armadura: linha com as 5 raridades; o resto, a linha de sempre
func linha_do_criar(e: Dictionary) -> Control:
	var D: Dictionary = m.P.dados
	if e.tipo == "receita" and D.has("catalisador") and D.itens[str(D.receitas[e.k].faz)].has("lugar"):
		return linha_criavel_rar(e)
	return linha_criavel(e)

# André 2026-11-09: "comum, raro, épico, lendário e mítico para craftar, mostrando os itens que precisa com um
# símbolozinho, nada de lista". Toque na raridade; embaixo os materiais em ícones com tem/precisa (toque no ícone
# diz o nome). Comum é a receita de sempre (com a sorte de sair melhor); as outras saem certinho nela e pedem o
# Selo/Runa da raridade e o material de evoluir (shared/simulacao.js receitaNaRaridade).
func linha_criavel_rar(e: Dictionary, fixa := -1) -> Control:
	var P = m.P
	var D: Dictionary = P.dados
	var cons = m.construcao
	var R0: Dictionary = D.receitas[e.k]
	var rar: int = clampi(fixa if fixa >= 0 else int(rar_criar.get(e.k, 0)), 0, D.raridades.size() - 1)
	var R: Dictionary = P.receita_na_raridade(e.k, rar)
	var faz_s := str(R0.faz)
	var est := "bigorna" if str(R0.prof) == "fer" else "bancada"
	var of: Dictionary = D.oficina[str(R0.prof)]
	var onde: String = NOME_ESTACAO[est] if str(of.npc) == "" else "%s ou %s" % [NOME_ESTACAO[est], str(of.onde).replace("na ", "a ")]
	var aqui: bool = m.trabalho.perto_oficina(str(R0.prof)) or (cons != null and cons.estacao_perto([est]))
	var nv_ok: bool = P.prof_nivel(str(R0.prof)) >= int(R.nivel)
	var custo: float = P.custo_vigor(str(R0.prof), float(R.vigor))
	var it := {"k": faz_s, "r": rar}
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1) if aqui and nv_ok else Color(0.07, 0.063, 0.055, 1), P.cor_item(it).darkened(0.35), 1, 8))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	cx.add_child(v)
	# cabeçalho: peça na raridade escolhida, nome e nível
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 10)
	var c := celula(it, false, func(): pass, 52)
	c.pressed.connect(func(): # tocar na peça também diz o nome
		if not _arrastou:
			balao_nome(c, P.nome_item(it), P.cor_item(it)))
	c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(c)
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.add_theme_constant_override("separation", 2)
	txt.add_child(rotulo(P.nome_item(it), 15, P.cor_item(it) if nv_ok else APAGADO))
	txt.add_child(rotulo("%s Nv %d" % [D.profissoes[str(R0.prof)].nome, int(R0.nivel)], 12, OURO_CLARO if nv_ok else Color("e0806a")))
	var o := rotulo(("%s · você está aqui" % onde) if aqui else onde, 12, VERDE if aqui else OURO)
	o.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	if fixa < 0 or not aqui: # na linha compacta (sanfona) a estação já está escolhida em cima
		txt.add_child(o)
	if fixa >= 0:
		txt.size_flags_horizontal = Control.SIZE_FILL
		txt.custom_minimum_size = Vector2(190, 0)
		txt.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(txt)
	v.add_child(l)
	# as 5 raridades (na tela do Quimera cada raridade já é uma linha: sem seletor)
	var rs := HBoxContainer.new()
	rs.visible = fixa < 0
	rs.add_theme_constant_override("separation", 4)
	for r in D.raridades.size():
		var nome_r := str(D.raridades[r].nome)
		var br := botao(nome_r, func():
			rar_criar[e.k] = r
			atualizar(), 12, r == rar)
		br.custom_minimum_size = Vector2(0, 30)
		br.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		br.add_theme_color_override("font_color", Color(D.raridades[r].cor) if r != rar else Color(D.raridades[r].cor).lightened(0.35))
		rs.add_child(br)
	if fixa < 0:
		v.add_child(rs)
	else:
		rs.queue_free()
	# materiais em ícones + botão Criar
	var baixo := HBoxContainer.new()
	baixo.add_theme_constant_override("separation", 8)
	var mats := HFlowContainer.new()
	mats.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mats.add_theme_constant_override("h_separation", 8)
	mats.add_theme_constant_override("v_separation", 4)
	var tem := true
	if rar > 0: # evoluir: primeiro a peça da raridade de baixo
		var baixa := {"k": faz_s, "r": rar - 1}
		var qt := 0
		for ob in P.prog.mochila:
			if ob != null and str(ob.k) == faz_s and int(ob.get("r", 0)) == rar - 1 and not ob.has("n"):
				qt += 1
		tem = qt >= 1
		mats.add_child(icone_material(faz_s, qt, 1, baixa))
	for k in R.usa:
		var n := int(R.usa[k])
		var t2: int = P.contar(k)
		tem = tem and t2 >= n
		mats.add_child(icone_material(str(k), t2, n))
	if custo > 0.0:
		var vg := rotulo("Vigor %s" % P.num(custo, 1), 12, COR_VIGOR if P.vigor() >= custo else Color("e0806a"))
		vg.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		mats.add_child(vg)
	baixo.add_child(mats)
	var pode: bool = aqui and nv_ok and tem and P.vigor() >= custo
	var b := botao("Criar", func(): # Raro em diante gasta a peça da raridade de baixo (André: "é uma aba só")
		if not _arrastou:
			criar(e.k, rar), 14, pode)
	b.custom_minimum_size = Vector2(96, 40)
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	b.disabled = not pode
	avisar_travado(b, func():
		if rar > 0 and P.peca_para_evoluir(faz_s, rar) < 0:
			return "Precisa de %s na mochila (evolui a de baixo)" % P.nome_item({"k": faz_s, "r": rar - 1})
		return motivo_receita(aqui, onde, nv_ok, "%s Nv %d" % [D.profissoes[str(R0.prof)].nome, int(R.nivel)], R.usa, custo))
	baixo.add_child(b)
	if fixa >= 0: # uma linha só: peça · nome · materiais · Criar (como no Quimera)
		baixo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		mats.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		l.add_child(baixo)
	else:
		v.add_child(baixo)
	return cx

# material como símbolo: ícone com "tem/precisa" embaixo (verde ou vermelho); tocar diz o nome
func icone_material(k: String, tem: int, precisa: int, peca := {}) -> Control:
	var P = m.P
	var alvo: Dictionary = peca if not peca.is_empty() else {"k": k}
	var bx := VBoxContainer.new()
	bx.add_theme_constant_override("separation", 0)
	bx.custom_minimum_size = Vector2(44, 0)
	var q := Button.new()
	q.focus_mode = Control.FOCUS_NONE
	q.custom_minimum_size = Vector2(40, 40)
	q.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var st := caixa(Color(0.045, 0.04, 0.036, 1), Color(0.45, 0.78, 0.45, 0.8) if tem >= precisa else Color(0.88, 0.5, 0.42, 0.8), 1, 6)
	for e in ["normal", "hover", "pressed"]:
		q.add_theme_stylebox_override(e, st)
	var ic := TextureRect.new()
	ic.texture = icone_tex(P.icone_item(alvo))
	ic.set_anchors_preset(Control.PRESET_FULL_RECT)
	ic.offset_left = 4
	ic.offset_top = 4
	ic.offset_right = -4
	ic.offset_bottom = -4
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.modulate = tinta(ic.texture, P.cor_item(alvo))
	ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
	q.add_child(ic)
	var nome: String = str(P.nome_item(alvo)) if not peca.is_empty() else str(P.dados.itens[k].nome)
	q.pressed.connect(func():
		if not _arrastou:
			balao_nome(q, nome, P.cor_item(alvo)))
	bx.add_child(q)
	var n := rotulo("%d/%d" % [tem, precisa], 11, VERDE if tem >= precisa else Color("e0806a"))
	n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bx.add_child(n)
	return bx

# uma linha da aba Criar: ícone, nome, onde se cria (verde se você está lá), materiais e o botão Criar.
# Longe da estação certa o botão vira uma plaquinha com o nome dela: dá para ver a receita, mas não criar.
func linha_criavel(e: Dictionary) -> Control:
	var P = m.P
	var D: Dictionary = P.dados
	var cons = m.construcao
	var usa: Dictionary
	var faz: Dictionary
	var onde := ""
	var est := ""
	var aqui := true
	var nv_ok := true
	var custo := 0.0
	var motivo := ""
	if e.tipo == "receita":
		var R: Dictionary = D.receitas[e.k]
		usa = R.usa
		faz = {"k": str(R.faz), "r": 0} if D.itens[str(R.faz)].has("lugar") else {"k": str(R.faz), "n": 1}
		var faz_s := str(R.faz)
		est = "fornalha" if faz_s.begins_with("barra_") or faz_s == "carvao" else "bigorna" if str(R.prof) == "fer" else "fogao" if str(R.prof) == "coz" else "bancada"
		var of: Dictionary = D.oficina[str(R.prof)]
		onde = NOME_ESTACAO[est] if str(of.npc) == "" else "%s ou %s" % [NOME_ESTACAO[est], str(of.onde).replace("na ", "a ")]
		aqui = m.trabalho.perto_oficina(str(R.prof)) or (cons != null and cons.estacao_perto([est]))
		nv_ok = P.prof_nivel(str(R.prof)) >= int(R.nivel)
		custo = P.custo_vigor(str(R.prof), float(R.vigor))
	else:
		var C: Dictionary = cons.dados_criar(e.k) if cons != null else D.get("construcoes", {}).get(e.k, D.get("ferramentas", {}).get(e.k, {}))
		usa = C.get("custo", {})
		faz = {"k": ("obra_" + e.k) if D.get("construcoes", {}).has(e.k) else e.k, "n": 1}
		if C.get("bancada", false):
			est = "bancada"
			onde = NOME_ESTACAO.bancada
			aqui = cons != null and cons.estacao_perto(["bancada"])
		else:
			onde = "Em qualquer lugar"
		if cons != null:
			motivo = cons.motivo_criar(e.k)
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1) if aqui and nv_ok else Color(0.07, 0.063, 0.055, 1), Color(0.3, 0.24, 0.16), 1, 8))
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 12)
	cx.add_child(l)
	var c := celula(faz, false, func(): pass, 52)
	c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(c)
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.add_theme_constant_override("separation", 2)
	var cab := HBoxContainer.new()
	cab.add_theme_constant_override("separation", 10)
	cab.add_child(rotulo(str(e.nome), 15, TEXTO if nv_ok else APAGADO))
	if e.tipo == "receita":
		var R: Dictionary = D.receitas[e.k]
		cab.add_child(rotulo("%s Nv %d" % [D.profissoes[str(R.prof)].nome, int(R.nivel)], 12, OURO_CLARO if nv_ok else Color("e0806a")))
	txt.add_child(cab)
	var o := rotulo(("%s · você está aqui" % onde) if est != "" and aqui else onde, 12, VERDE if aqui else OURO)
	o.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	txt.add_child(o)
	var tem := true
	var mats := HFlowContainer.new()
	mats.add_theme_constant_override("h_separation", 12)
	for k in usa:
		var n := int(usa[k])
		var t2: int = P.contar(k)
		if t2 < n:
			tem = false
		mats.add_child(icone_material(str(k), t2, n)) # André 2026-11-09: material em ícone, nada de lista
	if custo > 0.0:
		mats.add_child(rotulo("Vigor %s" % P.num(custo, 1), 12, COR_VIGOR if P.vigor() >= custo else Color("e0806a")))
	txt.add_child(mats)
	l.add_child(txt)
	if not aqui: # plaquinha da estação no lugar do botão
		var pl := PanelContainer.new()
		pl.add_theme_stylebox_override("panel", caixa(Color(0.06, 0.052, 0.045, 1), Color(0.36, 0.29, 0.19), 1, 8))
		pl.custom_minimum_size = Vector2(96, 40)
		pl.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		var pv := VBoxContainer.new()
		pv.add_theme_constant_override("separation", 0)
		pv.alignment = BoxContainer.ALIGNMENT_CENTER
		var ic2 := TextureRect.new()
		ic2.texture = icone_tex("cs_" + est)
		ic2.custom_minimum_size = Vector2(22, 22)
		ic2.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ic2.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ic2.modulate = tinta(ic2.texture, APAGADO)
		pv.add_child(ic2)
		var nl := rotulo(str(NOME_ESTACAO[est]).split(" ")[0], 12, APAGADO) # "Bigorna", "Fornalha", "Bancada"
		nl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		pv.add_child(nl)
		pl.add_child(pv)
		l.add_child(pl)
		return cx
	var pode: bool = nv_ok and tem and P.vigor() >= custo and motivo == ""
	var b := botao("Criar", func(): criar_item(e), 14, pode)
	b.custom_minimum_size = Vector2(96, 40)
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	b.disabled = not pode
	avisar_travado(b, func():
		var nv_txt := "%s Nv %d" % [D.profissoes[str(D.receitas[e.k].prof)].nome, int(e.nivel)] if e.tipo == "receita" else ""
		var mt := motivo_receita(aqui, onde, nv_ok, nv_txt, usa, custo)
		return mt if mt != "" else motivo)
	l.add_child(b)
	if e.tipo == "obra" and motivo.begins_with("Você já tem"):
		o.text = motivo
	return cx

func criar_item(e: Dictionary) -> void:
	if _arrastou:
		return
	if e.tipo == "receita":
		criar(e.k)
		return
	if not m.on():
		m.hud.aviso("Criar só funciona online (a peça fica na sua conta)")
		return
	if m.construcao: # janelinha de quantas + barrinha (André 2026-11-05)
		m.construcao.pedir_criar("obra", e.k)
		return
	m.rede("fabricar", {"k": e.k})

# ---------- mochila e loja ----------
func linha_ouro() -> Control:
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 6)
	var ic := TextureRect.new()
	ic.texture = icone_tex("it_ouro")
	ic.custom_minimum_size = Vector2(22, 22)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(ic)
	l.add_child(rotulo("%d de ouro" % int(m.P.prog.ouro), 16, Color("ffd36a")))
	return l

# quadradinho de item: moldura e ícone na cor da raridade, quantidade no canto
func celula(it, escolhido: bool, fn: Callable, tam := 56, marcado := false) -> Button:
	var P = m.P
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(tam, tam)
	var cor: Color = P.cor_item(it) if it != null else BORDA
	var est := caixa(Color(0.045, 0.04, 0.036, 1), Color(0, 0, 0, 0), 0, 8)
	for e in ["normal", "hover", "pressed"]:
		b.add_theme_stylebox_override(e, est)
	if it != null:
		var ic := TextureRect.new()
		ic.texture = icone_tex(P.icone_item(it))
		ic.set_anchors_preset(Control.PRESET_FULL_RECT)
		ic.offset_left = tam * 0.08
		ic.offset_top = tam * 0.08
		ic.offset_right = -tam * 0.08
		ic.offset_bottom = -tam * 0.1
		ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
		if ic.texture and ic.texture.resource_path.ends_with(".svg"):
			ic.modulate = cor # desenho de linha (sem pintura ainda): toma a cor do item
		b.add_child(ic)
		if it.k == "tomo":
			var r := rotulo(P.dados.romano[int(it.nv)], 11, Color("fff6c8"))
			r.position = Vector2(4, 1)
			r.mouse_filter = Control.MOUSE_FILTER_IGNORE
			b.add_child(r)
		if int(it.get("n", 1)) > 1:
			var n := rotulo(str(int(it.n)), 12, TEXTO)
			n.add_theme_constant_override("outline_size", 4)
			n.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
			n.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
			n.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
			n.offset_left = -30
			n.offset_top = -19
			n.offset_right = -4
			n.offset_bottom = -1
			n.mouse_filter = Control.MOUSE_FILTER_IGNORE
			b.add_child(n)
	if it != null and P.eh_equip(it) and P.durab(it) < int(P.morte_dados().durMax):
		_marca_durabilidade(b, it, tam)
	moldurar(b, cor, escolhido, it != null)
	if it != null and it.get("cad", false): # cadeado (André 2026-11-07): cadeadinho dourado no canto de baixo
		var cd := TextureRect.new()
		cd.texture = icone_tex("cadeado")
		cd.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		cd.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		cd.position = Vector2(3, tam - tam * 0.36 - 3)
		cd.size = Vector2(tam * 0.34, tam * 0.36)
		cd.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(cd)
	if it != null and P.eh_equip(it) and int(it.get("e", 0)) > 0: # reforço "+N" no canto de cima (André 2026-11-09)
		var rf := rotulo("+%d" % int(it.e), 11 if tam < 56 else 12, OURO_CLARO)
		rf.add_theme_constant_override("outline_size", 4)
		rf.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
		rf.position = Vector2(4, 1)
		rf.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(rf)
	if it != null and marcado:
		var vel := ColorRect.new() # escurece um pouco e põe o sinal dourado no canto
		vel.color = Color(0.95, 0.75, 0.3, 0.16)
		vel.set_anchors_preset(Control.PRESET_FULL_RECT)
		vel.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(vel)
		var ok := TextureRect.new()
		ok.texture = icone_tex("marcado")
		ok.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ok.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ok.position = Vector2(tam - tam * 0.42, 2)
		ok.size = Vector2(tam * 0.38, tam * 0.38)
		ok.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(ok)
	b.pressed.connect(func():
		if not _arrastou:
			fn.call())
	return b

func montar_mochila() -> void:
	var P = m.P
	var topo := HBoxContainer.new()
	topo.add_child(linha_ouro())
	var esp_ := Control.new()
	esp_.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	topo.add_child(esp_)
	var cheios: int = P.prog.mochila.filter(func(x): return x != null).size()
	topo.add_child(rotulo("%d / %d" % [cheios, P.prog.mochila.size()], 13, APAGADO))
	# André 2026-11-07: botão Organizar (junta as pilhas e põe em ordem de tipo, raridade e nome; quem decide é o servidor)
	var org := botao("Organizar", func(): acao_item({"acao": "organizar"}), 14, true)
	org.custom_minimum_size = Vector2(130, 36)
	org.disabled = cheios == 0 or vendendo
	topo.add_child(org)
	# André 2026-11-07: filtro de coleta (fica dourado quando tem algo desmarcado)
	var f_atual := filtro_atual()
	var fil := botao("Voltar" if filtro_aberto else "Filtro", func():
		filtro_aberto = not filtro_aberto
		vendendo = false
		marcados = {}
		atualizar(), 14, filtro_aberto or f_atual.r.size() > 0 or f_atual.k.size() > 0)
	fil.custom_minimum_size = Vector2(110, 36)
	if not filtro_aberto and (f_atual.r.size() > 0 or f_atual.k.size() > 0):
		fil.add_theme_color_override("font_color", OURO_CLARO)
	topo.add_child(fil)
	conteudo.add_child(topo)
	if filtro_aberto:
		montar_filtro()
		return
	# páginas: abas 1 a 4; a que ainda não foi comprada mostra o preço e abre o cadeado
	var por_pag: int = int(P.dados.mochila)
	var total_pag: int = int(P.dados.get("mochilaPaginas", 1))
	var tem: int = int(P.prog.get("paginas", 1))
	pag_mochila = clampi(pag_mochila, 0, total_pag - 1)
	var abas_pag := HBoxContainer.new()
	abas_pag.add_theme_constant_override("separation", 6)
	for n in total_pag:
		var t := "Página %d" % (n + 1) if n < tem else "Página %d · %d" % [n + 1, int(P.dados.paginaPreco[n])]
		var b := botao(t, func(): trocar_pagina(n), 14, n == pag_mochila)
		b.custom_minimum_size = Vector2(0, 34)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		if n >= tem:
			b.add_theme_color_override("font_color", APAGADO)
			b.icon = icone_tex("it_ouro")
			b.expand_icon = false
			b.add_theme_constant_override("icon_max_width", 18)
		abas_pag.add_child(b)
	conteudo.add_child(abas_pag)
	if m.perto_de_quem_compra():
		conteudo.add_child(barra_venda())
	else:
		vendendo = false
		marcados = {}
	if pag_mochila >= tem:
		conteudo.add_child(pagina_trancada(pag_mochila, tem))
	else:
		var g := GridContainer.new()
		g.columns = 10
		g.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		g.add_theme_constant_override("h_separation", 5)
		g.add_theme_constant_override("v_separation", 5)
		for i in range(pag_mochila * por_pag, min(P.prog.mochila.size(), (pag_mochila + 1) * por_pag)):
			g.add_child(celula(P.prog.mochila[i], i == sel_mochila or marcados.has(i), func(): tocar_mochila(i), 60, marcados.has(i)))
		conteudo.add_child(g)
		# lugar a mais (só se uma mochila antiga trouxe mais itens do que cabem): aparece no fim da última página
		if pag_mochila == tem - 1 and P.prog.mochila.size() > tem * por_pag:
			var g2 := GridContainer.new()
			g2.columns = 10
			g2.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
			for i in range(tem * por_pag, P.prog.mochila.size()):
				g2.add_child(celula(P.prog.mochila[i], i == sel_mochila or marcados.has(i), func(): tocar_mochila(i), 60, marcados.has(i)))
			conteudo.add_child(g2)
	if vendendo:
		var d := rotulo("Toque nos itens para marcar ou desmarcar. Itens em pilha vendem a pilha inteira.", 12, APAGADO)
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		conteudo.add_child(d)
	elif sel_mochila >= 0 and P.prog.mochila[sel_mochila] != null:
		conteudo.add_child(detalhe(P.prog.mochila[sel_mochila], sel_mochila, ""))
	elif sel_equip != "" and janela_lugar == "" and P.prog.equip.get(sel_equip) != null: # com a janela aberta, o cartão não repete o Tirar (direção de arte)
		conteudo.add_child(detalhe(P.prog.equip[sel_equip], -1, sel_equip))
	elif janela_lugar == "":
		var d := rotulo("Toque num item para ver o que ele faz. Toque num lugar do corpo (à esquerda) para ver a peça e tirar.", 12, APAGADO)
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		conteudo.add_child(d)
	montar_conjunto()

# ---------- filtro de coleta (André 2026-11-07: "a bag enche muito rápido") ----------
# prog.filtro = { r: [raridades desmarcadas], k: [recursos desmarcados] }; sem o campo = pega tudo.
# Online quem decide é o servidor (filtrado() em shared/progresso.js): o desmarcado que cai do monstro fica no chão.
func filtro_atual() -> Dictionary:
	var f = m.P.prog.get("filtro")
	var r: Array = []
	var k: Array = []
	if f is Dictionary:
		for v in f.get("r", []):
			r.append(int(v))
		for v in f.get("k", []):
			k.append(str(v))
	return {"r": r, "k": k}

func mandar_filtro(r: Array, k: Array) -> void:
	acao_item({"acao": "filtro", "r": r, "k": k})

func recursos_do_jogo() -> Array:
	var itens: Dictionary = m.P.dados.itens
	var l: Array = itens.keys().filter(func(k): return itens[k].get("mat", false))
	l.sort_custom(func(a, b):
		var sa: bool = str(a).begins_with("semente_")
		var sb: bool = str(b).begins_with("semente_")
		if sa != sb:
			return sb # sementes no fim
		return str(itens[a].nome).naturalnocasecmp_to(str(itens[b].nome)) < 0)
	return l

# um quadradinho de marcar: toca em qualquer parte (é um botão: arrastar a lista não marca sem querer)
func marca_filtro(texto: String, cor: Color, marcado: bool, fn: Callable, icone := "", ao_nome := Callable()) -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(0, 44)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	estilo_botao(b, marcado)
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 8)
	l.set_anchors_preset(Control.PRESET_FULL_RECT)
	l.offset_left = 8
	l.offset_right = -6
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var q := Quadradinho.new()
	q.lado = 20
	q.marcado = marcado
	q.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(q)
	if icone != "":
		var ic := TextureRect.new()
		ic.texture = icone_tex(icone)
		ic.custom_minimum_size = Vector2(30, 30)
		ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
		if ic.texture and ic.texture.resource_path.ends_with(".svg"):
			ic.modulate = cor
		if not marcado:
			ic.modulate.a = 0.45
		l.add_child(ic)
	var t := rotulo(texto, 14, cor if marcado else APAGADO)
	t.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	t.clip_text = true
	t.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if ao_nome.is_valid():
		# André 2026-11-07: o quadradinho marca/desmarca tudo; tocar no nome abre a lista um por um
		var nb := Button.new()
		nb.flat = true
		nb.focus_mode = Control.FOCUS_NONE
		nb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		nb.mouse_filter = Control.MOUSE_FILTER_STOP
		nb.add_child(t)
		t.set_anchors_preset(Control.PRESET_FULL_RECT)
		nb.pressed.connect(func():
			if not _arrastou:
				ao_nome.call())
		l.add_child(nb)
	else:
		l.add_child(t)
	b.add_child(l)
	b.pressed.connect(func():
		if not _arrastou:
			fn.call())
	return b

func montar_filtro() -> void:
	var P = m.P
	var f := filtro_atual()
	separador("Filtro de coleta")
	var d := rotulo("O que estiver desmarcado não entra na mochila: fica no chão. Ouro, poções e Tomos sempre entram, e o recurso do veio ou da árvore que você está coletando também.", 12, APAGADO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	conteudo.add_child(d)
	separador("Equipamentos por raridade")
	var g := GridContainer.new()
	g.columns = 5
	g.add_theme_constant_override("h_separation", 6)
	for r in P.dados.raridades.size():
		var marcado: bool = not f.r.has(r)
		g.add_child(marca_filtro(str(P.dados.raridades[r].nome), Color(P.dados.raridades[r].cor), marcado, func():
			var nr: Array = f.r.duplicate()
			if nr.has(r):
				nr.erase(r)
			else:
				nr.append(r)
			mandar_filtro(nr, f.k)))
	conteudo.add_child(g)
	separador("Recursos")
	var todos: Array = recursos_do_jogo()
	var fora: int = todos.filter(func(k): return f.k.has(k)).size()
	var linha := HBoxContainer.new()
	linha.add_theme_constant_override("separation", 8)
	var txt := "Todos os recursos" if fora == 0 else ("Nenhum recurso" if fora == todos.size() else "Recursos: %d de %d" % [todos.size() - fora, todos.size()])
	txt += "  ▴" if filtro_lista else "  ▾"
	# André 2026-11-07: sem botão "Escolher um por um": o quadradinho marca tudo, o nome abre a lista
	linha.add_child(marca_filtro(txt, TEXTO, fora < todos.size(), func():
		mandar_filtro(f.r, [] if fora > 0 else todos), P.icone_item({"k": "couro", "n": 1}) if P.dados.itens.has("couro") else "", func():
		filtro_lista = not filtro_lista
		atualizar()))
	conteudo.add_child(linha)
	if filtro_lista:
		var g2 := GridContainer.new()
		g2.columns = 3
		g2.add_theme_constant_override("h_separation", 6)
		g2.add_theme_constant_override("v_separation", 6)
		for k in todos:
			var it := {"k": k, "n": 1}
			g2.add_child(marca_filtro(str(P.dados.itens[k].nome), P.cor_item(it), not f.k.has(k), func():
				var nk: Array = f.k.duplicate()
				if nk.has(k):
					nk.erase(k)
				else:
					nk.append(k)
				mandar_filtro(f.r, nk), P.icone_item(it)))
		conteudo.add_child(g2)

# bônus de conjunto: peças da mesma raridade (ou melhor), como o Set de Bruxa do Quimera
func montar_conjunto() -> void:
	var P = m.P
	separador("Conjunto")
	var n: Array = P.pecas_conjunto()
	var ativo: Dictionary = P.conjunto_ativo()
	var algum := false
	for t in ["2", "3", "6"]:
		var r: int = ativo[t]
		if r > 0:
			algum = true
			var l := HBoxContainer.new()
			l.add_theme_constant_override("separation", 8)
			l.add_child(rotulo("%s peças %s" % [t, PLURAL[r]], 13, Color(P.dados.raridades[r].cor)))
			l.add_child(rotulo(P.texto_bonus(r, t), 13, TEXTO))
			conteudo.add_child(l)
	var prox := ""
	for r in range(1, P.dados.raridades.size()):
		for t in ["2", "3", "6"]:
			if prox == "" and n[r] < int(t) and ativo[t] < r:
				prox = "Próximo: %s peças %s (tem %d): %s" % [t, PLURAL[r], n[r], P.texto_bonus(r, t)]
	if not algum:
		conteudo.add_child(rotulo("Use 2, 3 ou 6 peças Raras (ou melhores) para ganhar bônus.", 12, APAGADO))
	if prox != "":
		var d := rotulo(prox, 12, APAGADO)
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		conteudo.add_child(d)

func trocar_pagina(n: int) -> void:
	pag_mochila = n
	sel_mochila = -1
	atualizar()

# página ainda não comprada: cadeado, preço e o botão de comprar (só a próxima da fila)
func pagina_trancada(n: int, tem: int) -> Control:
	var P = m.P
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(Color(0.08, 0.07, 0.058, 1), Color(0.3, 0.25, 0.17), 1, 8))
	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 10)
	v.custom_minimum_size = Vector2(0, 4 * 60 + 3 * 5 - 18)
	cx.add_child(v)
	var preco: int = int(P.dados.paginaPreco[n])
	var t := rotulo("Página %d trancada" % (n + 1), 18, OURO_CLARO)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(t)
	var proxima: bool = n == tem
	var txt := "Mais %d lugares na mochila por %d de ouro." % [int(P.dados.mochila), preco] if proxima else "Compre a página %d primeiro (as páginas abrem uma de cada vez)." % (tem + 1)
	var d := rotulo(txt, 13, APAGADO)
	d.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(d)
	if proxima:
		var pode: bool = int(P.prog.ouro) >= preco
		var b := botao("Comprar · %d" % preco, func(): acao_item({"acao": "pagina"}), 15, pode)
		b.icon = icone_tex("it_ouro")
		b.add_theme_constant_override("icon_max_width", 20)
		b.custom_minimum_size = Vector2(200, 42)
		b.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		b.disabled = not pode
		avisar_travado(b, func(): return "Faltam %d de ouro" % (preco - int(P.prog.ouro)))
		v.add_child(b)
		if not pode:
			var f := rotulo("Faltam %d de ouro" % (preco - int(P.prog.ouro)), 12, APAGADO)
			f.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			v.add_child(f)
	return cx

func tocar_mochila(i: int) -> void:
	if vendendo:
		if marcados.has(i):
			marcados.erase(i)
		elif m.P.prog.mochila[i] != null and m.P.prog.mochila[i].get("cad", false):
			m.hud.aviso("Item com cadeado: não vende. Abra o cadeado para vender")
		elif m.P.prog.mochila[i] != null:
			marcados[i] = true
		atualizar()
		return
	sel_equip = ""
	sel_mochila = -1 if sel_mochila == i or m.P.prog.mochila[i] == null else i
	atualizar()

# cartão do item escolhido: nome na cor da raridade, o que faz, comparação com a peça do corpo e os botões
# peça gasta: filete de durabilidade no pé da célula (âmbar; vermelho quando está no fim). Quebrada: véu vermelho
func _marca_durabilidade(b: Control, it, tam: int) -> void:
	var P = m.P
	var k: float = clamp(float(P.durab(it)) / float(P.morte_dados().durMax), 0.0, 1.0)
	if k <= 0.0:
		var veu := ColorRect.new()
		veu.color = Color(0.55, 0.05, 0.03, 0.38)
		veu.set_anchors_preset(Control.PRESET_FULL_RECT)
		veu.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(veu)
		var x := rotulo("QUEBRADA", 9 if tam < 70 else 12, Color("ffd2c8"))
		x.add_theme_constant_override("outline_size", 4)
		x.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
		x.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		x.set_anchors_preset(Control.PRESET_CENTER)
		x.position = Vector2(0, tam * 0.5 - 8)
		x.size = Vector2(tam, 16)
		x.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(x)
		return
	var fundo := ColorRect.new()
	fundo.color = Color(0, 0, 0, 0.6)
	fundo.position = Vector2(tam * 0.14, tam - 7)
	fundo.size = Vector2(tam * 0.72, 3)
	fundo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(fundo)
	var barra := ColorRect.new()
	barra.color = Color("e0452e") if k <= 0.3 else Color("e8b14a")
	barra.position = fundo.position
	barra.size = Vector2(tam * 0.72 * k, 3)
	barra.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(barra)

func detalhe(it, i: int, lugar: String) -> Control:
	var P = m.P
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1), P.cor_item(it).darkened(0.3), 1, 8))
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 12)
	cx.add_child(l)
	var c := celula(it, false, func(): pass, 84)
	c.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	l.add_child(c)
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.add_theme_constant_override("separation", 2)
	txt.add_child(rotulo(P.nome_item(it), 17, P.cor_item(it)))
	var tipo := ""
	if P.eh_equip(it):
		var lg: String = P.dados.itens[it.k].lugar
		tipo = {"corpo": "Camisa", "pernas": "Calça", "capa": "Capa", "pes": "Botas", "acessorio": "Acessório", "espada": "Arma · espada", "cajado": "Arma · cajado"}[lg]
		tipo += " · No corpo" if lugar != "" else ""
	elif it.k == "tomo":
		tipo = "Tomo de %s" % P.habs[it.h].nome
	elif P.eh_mat(it):
		tipo = "Material · %d" % int(it.n)
	else:
		tipo = "Consumível · %d" % int(it.n)
	txt.add_child(rotulo(tipo, 12, APAGADO))
	if P.eh_equip(it): # durabilidade (André 2026-11-05): cada morte desgasta; quebrada não dá bônus até o Tomás consertar
		var dmax: int = int(P.morte_dados().durMax)
		var du: int = P.durab(it)
		if du <= 0:
			txt.add_child(rotulo("QUEBRADA · sem bônus até o Tomás consertar (%d ouro)" % P.custo_conserto(it), 12, PIOR))
		else:
			txt.add_child(rotulo("Durabilidade %d/%d" % [du, dmax] + (" · conserto %d ouro" % P.custo_conserto(it) if du < dmax else ""), 12, PIOR if du <= dmax * 0.3 else APAGADO))
	var d := rotulo(P.texto_item(it), 14, TEXTO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	txt.add_child(d)
	if P.eh_equip(it): # reforço (igual ao Quimera, André 2026-11-07): +N de +máx, próxima chance, custo e se falhar
		txt.add_child(linha_reforco(it))
	if P.eh_equip(it) and lugar == "":
		var atual = P.prog.equip.get(P.dados.itens[it.k].lugar)
		txt.add_child(rotulo(("No corpo: %s (%s)" % [P.nome_item(atual), P.texto_item(atual)]) if atual != null else "Lugar vazio no corpo", 12, APAGADO))
	var bs := HBoxContainer.new()
	bs.add_theme_constant_override("separation", 8)
	if lugar != "":
		bs.add_child(botao_acao("Tirar", {"acao": "tirar", "lugar": lugar}))
	elif P.eh_equip(it):
		bs.add_child(botao_acao("Equipar", {"acao": "equipar", "i": i}))
	elif P.dados.itens.has(it.k) and P.dados.itens[it.k].has("obra"):
		# peça de construção ou estação (André 2026-11-07): "Colocar" abre o modo construção já com ela escolhida
		var ob: String = str(P.dados.itens[it.k].obra)
		var por := func():
			fechar()
			m.construcao.abrir_com(ob)
		var bc := botao("Colocar", por, 14, true)
		bc.custom_minimum_size = Vector2(120, 36)
		bs.add_child(bc)
	elif it.k == "carrinho" and lugar == "": # Quimera: coloca no chão; no mundo, o mesmo botão traz de volta de onde estiver
		bs.add_child(botao_acao("Guardar carrinho" if P.carrinho_no_mundo() else "Colocar no chão", {"acao": "usar", "i": i}))
	elif not P.eh_mat(it) and (it.k == "tomo" or (P.dados.itens.has(it.k) and P.dados.itens[it.k].has("usar"))):
		bs.add_child(botao_acao("Usar", {"acao": "usar", "i": i}))
	if P.eh_equip(it) and int(it.get("e", 0)) < P.reforco_max(it):
		var onde := {"i": i} if lugar == "" else {"lugar": lugar}
		# André 2026-11-09: "até cancelar" confundia. Agora: uma tentativa, ou repetir sozinho até o máximo da peça
		var r1 := botao("Reforçar 1 vez", func(): m.reforco.comecar(onde, false), 14, true)
		r1.custom_minimum_size = Vector2(140, 36)
		bs.add_child(r1)
		var r2 := botao("Até o máximo", func(): m.reforco.comecar(onde, true), 14)
		r2.custom_minimum_size = Vector2(140, 36)
		r2.tooltip_text = texto_ate_maximo(it)
		bs.add_child(r2)
		bs.add_child(dica_ate_maximo(it))
	var trancado: bool = bool(it.get("cad", false))
	if it.k == "carrinho" and P.carrinho_no_mundo():
		txt.add_child(rotulo("No mundo: travado na mochila. Toque em Guardar pra ele voltar de qualquer distância.", 12, APAGADO))
	# cadeado (André 2026-11-07): trancado não vende (nem no Vender vários), não vai para o lixo nem para a troca
	var cad := botao("Destrancar" if trancado else "Trancar", func(): acao_item({"acao": "cadeado", "i": i} if lugar == "" else {"acao": "cadeado", "lugar": lugar}), 14, false)
	cad.icon = icone_tex("cadeado")
	cad.expand_icon = false
	cad.add_theme_constant_override("icon_max_width", 18)
	cad.custom_minimum_size = Vector2(130, 36)
	bs.add_child(cad)
	if it.k == "carrinho" and P.carrinho_no_mundo():
		trancado = true # no mundo: não vende nem joga fora (o servidor também recusa)
	if i >= 0 and not trancado and m.perto_de_quem_compra():
		bs.add_child(botao_acao("Vender · %d" % P.preco_venda(it), {"acao": "vender", "i": i}, false))
	if i >= 0 and not trancado: # André 2026-11-04: jogar fora (pergunta antes; não dá ouro)
		var ap := botao("Apagar", func(): perguntar_apagar(i), 14)
		ap.custom_minimum_size = Vector2(110, 36)
		ap.add_theme_color_override("font_color", PIOR)
		ap.add_theme_color_override("font_hover_color", PIOR)
		bs.add_child(ap)
	txt.add_child(bs)
	# catalisador (André 2026-11-07): Evoluir sobe a raridade com catalisador; Destruir dá catalisador (só da mochila)
	if i >= 0 and P.eh_equip(it) and P.dados.has("catalisador"):
		var bs2 := HBoxContainer.new()
		bs2.add_theme_constant_override("separation", 8)
		if int(it.r) < P.dados.raridades.size() - 1:
			var be := botao("Evoluir", func(): perguntar_evoluir(i), 14, true)
			be.custom_minimum_size = Vector2(120, 36)
			bs2.add_child(be)
		if not trancado:
			var bd := botao("Destruir", func(): perguntar_destruir(i), 14)
			bd.custom_minimum_size = Vector2(120, 36)
			bd.add_theme_color_override("font_color", PIOR)
			bd.add_theme_color_override("font_hover_color", PIOR)
			bs2.add_child(bd)
		txt.add_child(bs2)
	if trancado:
		txt.add_child(rotulo("Com cadeado: não vende, não vai para o lixo nem para a troca", 12, OURO))
	l.add_child(txt)
	return cx

# ---------- vender vários (André 2026-11-04) ----------
# fora do modo: botão "Vender vários". No modo: Selecionar tudo / Desmarcar, Vender N · ouro e Pronto.
# O preço é o mesmo do Vender de um em um (cada pilha vende inteira); online o servidor confere tudo (vender_varios).
func preco_marcados() -> Array: # [itens, ouro, raros (Épico ou melhor)]
	var P = m.P
	var n := 0
	var ouro := 0
	var raros := 0
	for i in marcados.keys():
		var it = P.prog.mochila[i] if i < P.prog.mochila.size() else null
		if it == null or it.get("cad", false):
			marcados.erase(i)
			continue
		var q: int = 1 if P.eh_equip(it) else max(1, int(it.get("n", 1)))
		n += q
		ouro += P.preco_venda(it) * q
		if P.eh_equip(it) and int(it.r) >= 2:
			raros += 1
	return [n, ouro, raros]

func barra_venda() -> Control:
	var P = m.P
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 8)
	if not vendendo:
		var t := rotulo("Quer vender várias coisas de uma vez?", 13, APAGADO)
		t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		t.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		l.add_child(t)
		var b := botao("Vender vários", func(): modo_vender(true), 14, true)
		b.custom_minimum_size = Vector2(150, 40)
		l.add_child(b)
		return l
	var cheios: Array = []
	for i in P.prog.mochila.size():
		if P.prog.mochila[i] != null and not P.prog.mochila[i].get("cad", false): # com cadeado fica de fora do Selecionar tudo
			cheios.append(i)
	var todos: bool = cheios.size() > 0 and marcados.size() >= cheios.size()
	var sel := botao("Desmarcar tudo" if todos else "Selecionar tudo", func():
		marcados = {}
		if not todos:
			for i in cheios:
				marcados[i] = true
		atualizar(), 14)
	sel.custom_minimum_size = Vector2(150, 40)
	l.add_child(sel)
	var r: Array = preco_marcados()
	var vb := botao("Vender %d · %d de ouro" % [r[0], r[1]] if r[0] > 0 else "Marque os itens", func(): perguntar_vender_varios(), 14, r[0] > 0)
	vb.custom_minimum_size = Vector2(0, 40)
	vb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vb.disabled = r[0] == 0
	avisar_travado(vb, func(): return "Marque primeiro os itens que quer vender")
	l.add_child(vb)
	var pr := botao("Pronto", func(): modo_vender(false), 14)
	pr.custom_minimum_size = Vector2(100, 40)
	l.add_child(pr)
	return l

func modo_vender(ligar: bool) -> void:
	vendendo = ligar
	marcados = {}
	sel_mochila = -1
	sel_equip = ""
	if aba != "mochila":
		aba = "mochila"
	atualizar()

func perguntar_vender_varios() -> void:
	var r: Array = preco_marcados()
	if r[0] == 0:
		return
	var txt := "Vender %d %s por %d de ouro?" % [r[0], "item" if r[0] == 1 else "itens", r[1]]
	if r[2] > 0:
		txt += "\nAtenção: %d %s Épica%s ou melhor." % [r[2], "peça é" if r[2] == 1 else "peças são", "" if r[2] == 1 else "s"]
	var lista: Array = marcados.keys()
	lista.sort()
	confirmar("Vender de uma vez", txt, "Vender", func(): acao_item({"acao": "vender_varios", "lista": lista}))

# ---------- catalisador (André 2026-11-07, como no Quimera; números em CATALISADOR, shared/dados.js) ----------
# Runa = catalisador de arma (espada, cajado); Selo = de armadura (o resto). O servidor sorteia e confere tudo.
const RAR_F := ["Comum", "Rara", "Épica", "Lendária", "Mítica"] # "peça Rara"
const RAR_FP := ["Comuns", "Raras", "Épicas", "Lendárias", "Míticas"]
func tipo_catalisador(k: String) -> String:
	return "arma" if str(m.P.dados.itens[k].lugar) in ["espada", "cajado"] else "armadura"

# o que destruir a peça pode dar, em texto ("1 Selo Raro (às vezes 0, 2 ou 3) · 25% de 1 Selo Épico")
func texto_destruir(it) -> String:
	var C: Dictionary = m.P.dados.catalisador
	var r := int(it.r)
	if r < 1:
		return "1 %s (às vezes nada, 2 ou 3)" % m.P.dados.itens[C.comum].nome
	var lista: Array = C[tipo_catalisador(it.k)]
	var t := "1 %s (às vezes nada, 2 ou 3)" % m.P.dados.itens[lista[maxi(1, r - 1) - 1]].nome
	if r > 1 and float(C.extra[r]) > 0:
		t += "\n%d%% de chance de mais 1 %s" % [roundi(float(C.extra[r]) * 100), m.P.dados.itens[lista[r - 1]].nome]
	return t

func perguntar_destruir(i: int) -> void:
	var P = m.P
	var it = P.prog.mochila[i]
	if it == null or not P.eh_equip(it):
		return
	var txt := "Destruir %s?\nA peça some e vira catalisador:\n%s" % [P.nome_item(it), texto_destruir(it)]
	if int(it.get("e", 0)) > 0:
		txt += "\nAtenção: perde o reforço +%d." % int(it.e)
	# André 2026-11-07: sem linha "Destruir todas" na mochila; a escolha aparece aqui (só esta ou todas da raridade)
	var r := int(it.r)
	var n := 0
	if not it.get("cad", false):
		for o in P.prog.mochila:
			if o != null and P.eh_equip(o) and int(o.r) == r and not o.get("cad", false):
				n += 1
	var todas := Callable()
	var todas_txt := ""
	if n > 1:
		todas_txt = "Todas %s · %d" % [RAR_FP[r].to_lower(), n]
		todas = func(): perguntar_destruir_todas(r)
		txt += "\nOu destrua de uma vez todas as %d %s da mochila (sem cadeado)." % [n, RAR_FP[r].to_lower()]
	confirmar("Destruir peça", txt, "Só esta", func(): acao_item({"acao": "destruir", "i": i}), true, todas_txt, todas)

func perguntar_destruir_todas(r: int) -> void:
	var P = m.P
	var n := 0
	var reforcadas := 0
	for o in P.prog.mochila:
		if o != null and P.eh_equip(o) and int(o.r) == r and not o.get("cad", false):
			n += 1
			if int(o.get("e", 0)) > 0:
				reforcadas += 1
	if n == 0:
		return
	var seg: float = float(P.dados.catalisador.tempoDestruir) * n
	var da: String = texto_destruir({"k": "peitoral", "r": r})
	if r >= 1:
		var C: Dictionary = P.dados.catalisador
		da = "1 catalisador %s (às vezes nada, 2 ou 3): Runa nas armas, Selo nas armaduras" % P.dados.raridades[maxi(1, r - 1)].nome
		if r > 1 and float(C.extra[r]) > 0:
			da += "\n%d%% de chance de mais 1 catalisador %s" % [roundi(float(C.extra[r]) * 100), P.dados.raridades[r].nome]
	var txt := "Destruir %d %s %s da mochila?\nCada uma faz a própria barrinha, uma depois da outra (uns %d s no total).\nCada peça dá: %s\nPeças com cadeado e as do corpo ficam." % [n, "peça" if n == 1 else "peças", RAR_F[r] if n == 1 else RAR_FP[r], ceili(seg), da]
	if reforcadas > 0:
		txt += "\nAtenção: %d %s reforço e %s." % [reforcadas, "tem" if reforcadas == 1 else "têm", "perde" if reforcadas == 1 else "perdem"]
	confirmar("Destruir todas", txt, "Destruir %d" % n, func(): acao_item({"acao": "destruir", "raridade": r}), true)

func perguntar_evoluir(i: int) -> void:
	var P = m.P
	var it = P.prog.mochila[i]
	if it == null or not P.eh_equip(it):
		return
	var C: Dictionary = P.dados.catalisador
	var r := int(it.r) + 1
	if r >= P.dados.raridades.size():
		return
	var tipo := tipo_catalisador(it.k)
	var usa := {C[tipo][r - 1]: 1}
	usa.merge(C.usa[tipo][r - 1])
	var falta := false
	var linhas: Array = []
	for k in usa:
		var tem: int = P.contar(k)
		falta = falta or tem < int(usa[k])
		linhas.append("%d %s (tem %d)" % [int(usa[k]), P.dados.itens[k].nome, tem])
	var prof: String = str(P.dados.receitas[it.k].prof) if P.dados.receitas.has(it.k) else ("fer" if tipo == "arma" else "alf")
	var t: float = float(P.prof_nivel(prof) - 1) / float(int(P.dados.profMax) - 1)
	var falha: float = float(C.falha[r]) * (1.0 - 0.5 * t)
	var sorte: float = (float(C.sorte[0]) + (float(C.sorte[1]) - float(C.sorte[0])) * t) if r < P.dados.raridades.size() - 1 else 0.0
	var onde: String = "%s ou perto de uma %s" % [P.dados.oficina[prof].onde, "bigorna" if prof == "fer" else "bancada de trabalho"]
	var txt := "Evoluir %s para %s?\nUsa: %s.\nFalha %s%% (perde o catalisador e o material, a peça fica)%s.\nA peça nova sai +0. Faça %s." % [P.nome_item(it), P.dados.raridades[r].nome, ", ".join(linhas), P.num(falha * 100, 1), (" · sorte %s%% (pula uma raridade)" % P.num(sorte * 100, 1)) if sorte > 0 else "", onde]
	if int(it.get("e", 0)) > 0:
		txt += "\nAtenção: perde o reforço +%d." % int(it.e)
	if falta:
		txt += "\nFalta material: destrua peças para juntar catalisador."
	# André 2026-11-10: "tá uma lista de obrigações", quer entender de relance. Mesma informação em desenho: peça de
	# agora -> peça nova, materiais em ícone com tem/precisa, chances numa barra colorida e avisos em faixinha.
	# O texto acima fica guardado como dica (tooltip) da janela, nada some.
	var corpo := corpo_evoluir(it, r, usa, falha, sorte, onde)
	corpo.tooltip_text = txt
	confirmar("Evoluir peça", "", "Evoluir", func(): acao_item({"acao": "evoluir", "i": i}), false, "", Callable(), corpo)

# conteúdo desenhado da janelinha de evoluir
func corpo_evoluir(it, r: int, usa: Dictionary, falha: float, sorte: float, onde: String) -> Control:
	var P = m.P
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	# 1) peça de agora -> peça nova
	var topo := HBoxContainer.new()
	topo.alignment = BoxContainer.ALIGNMENT_CENTER
	topo.add_theme_constant_override("separation", 14)
	col.add_child(topo)
	var novo := {"k": it.k, "r": r}
	topo.add_child(peca_com_nome(it))
	var seta := VBoxContainer.new()
	seta.alignment = BoxContainer.ALIGNMENT_CENTER
	var st := rotulo("➜", 34, Color(P.dados.raridades[r].cor))
	st.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	seta.add_child(st)
	var sub := rotulo("evoluir", 12, APAGADO)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	seta.add_child(sub)
	topo.add_child(seta)
	topo.add_child(peca_com_nome(novo))
	# 2) materiais (ícones com tem/precisa; tocar diz o nome)
	var mats := HBoxContainer.new()
	mats.alignment = BoxContainer.ALIGNMENT_CENTER
	mats.add_theme_constant_override("separation", 10)
	for k in usa:
		mats.add_child(icone_material(k, P.contar(k), int(usa[k])))
	col.add_child(faixa_titulo("Usa", mats))
	# 3) chances numa barra só: verde = evolui, dourado = sorte (pula uma raridade), vermelho = falha
	var ok: float = maxf(0.0, 1.0 - falha - sorte)
	var bar := HBoxContainer.new()
	bar.add_theme_constant_override("separation", 0)
	bar.custom_minimum_size = Vector2(0, 14)
	for par in [[ok, VERDE], [sorte, OURO_CLARO], [falha, PIOR]]:
		if float(par[0]) <= 0.0:
			continue
		var pd := Panel.new()
		pd.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		pd.size_flags_stretch_ratio = maxf(float(par[0]), 0.02)
		pd.add_theme_stylebox_override("panel", caixa(Color(par[1]).darkened(0.15), Color(par[1]).lightened(0.15), 0, 3))
		bar.add_child(pd)
	var chances := VBoxContainer.new()
	chances.add_theme_constant_override("separation", 6)
	chances.add_child(bar)
	var leg := HBoxContainer.new()
	leg.alignment = BoxContainer.ALIGNMENT_CENTER
	leg.add_theme_constant_override("separation", 8)
	leg.add_child(selo_chance("Evolui", ok, VERDE, ""))
	if sorte > 0:
		leg.add_child(selo_chance("Sorte", sorte, OURO_CLARO, "pula 1 raridade"))
	leg.add_child(selo_chance("Falha", falha, PIOR, "perde catalisador e material, a peça fica"))
	chances.add_child(leg)
	col.add_child(faixa_titulo("Chance", chances))
	# 4) onde fazer e +0, linha pequena
	var info := rotulo("A peça nova sai +0 · Faça %s" % onde, 12, APAGADO)
	info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(info)
	# 5) avisos em faixinha colorida
	if int(it.get("e", 0)) > 0:
		col.add_child(faixa_aviso("⚠ Perde o reforço +%d" % int(it.e), Color("e8a24a")))
	for k in usa:
		if P.contar(k) < int(usa[k]):
			col.add_child(faixa_aviso("✖ Falta material: destrua peças para juntar catalisador", PIOR))
			break
	return col

# quadrado do item (moldura da raridade, +N no canto) com o nome embaixo na cor da raridade
func peca_com_nome(it) -> Control:
	var P = m.P
	var bx := VBoxContainer.new()
	bx.add_theme_constant_override("separation", 4)
	bx.custom_minimum_size = Vector2(120, 0)
	var c := celula(it, false, func(): balao_nome(bx, P.nome_item(it), P.cor_item(it)), 76)
	c.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	bx.add_child(c)
	var n := rotulo(P.nome_item(it), 14, P.cor_item(it))
	n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bx.add_child(n)
	return bx

# bloquinho com título pequeno à esquerda ("Usa", "Chance") e o conteúdo ao lado
func faixa_titulo(t: String, conteudo: Control) -> Control:
	var pc := PanelContainer.new()
	pc.add_theme_stylebox_override("panel", caixa(Color(0.11, 0.095, 0.08, 1), Color(0.3, 0.24, 0.16), 1, 8))
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 12)
	pc.add_child(h)
	var l := rotulo(t, 13, OURO)
	l.custom_minimum_size = Vector2(56, 0)
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	h.add_child(l)
	conteudo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(conteudo)
	return pc

# "● Falha 14,6%" com a explicação curtinha embaixo
func selo_chance(nome: String, v: float, cor: Color, explica: String) -> Control:
	var P = m.P
	var bx := VBoxContainer.new()
	bx.add_theme_constant_override("separation", 0)
	bx.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var l := rotulo("● %s %s%%" % [nome, P.num(v * 100, 1)], 14, cor)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bx.add_child(l)
	if explica != "":
		var e := rotulo(explica, 12, APAGADO)
		e.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		e.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		e.custom_minimum_size = Vector2(110, 0)
		bx.add_child(e)
	return bx

# aviso curto em faixa colorida (perde reforço, falta material)
func faixa_aviso(t: String, cor: Color) -> Control:
	var pc := PanelContainer.new()
	pc.add_theme_stylebox_override("panel", caixa(Color(cor, 0.14), Color(cor, 0.6), 1, 6))
	var l := rotulo(t, 13, cor)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	pc.add_child(l)
	return pc

func perguntar_apagar(i: int) -> void:
	var P = m.P
	var it = P.prog.mochila[i]
	if it == null:
		return
	var nome: String = P.nome_item(it)
	if not P.eh_equip(it) and int(it.get("n", 1)) > 1:
		nome += " (%d)" % int(it.n)
	confirmar("Apagar item", "Jogar fora %s?\nO item some para sempre e não dá ouro." % nome, "Apagar", func(): acao_item({"acao": "apagar", "i": i}), true)

# janelinha de confirmação no meio da tela (como a do Mestre Ivo)
func fechar_confirma() -> void:
	if _confirma:
		_confirma.queue_free()
		_confirma = null

func confirmar(titulo: String, texto: String, sim: String, fn: Callable, perigo := false, extra := "", fn_extra := Callable(), conteudo: Control = null) -> void:
	fechar_confirma()
	_confirma = Control.new()
	_confirma.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_confirma)
	var escuro := ColorRect.new()
	escuro.color = Color(0, 0, 0, 0.5)
	escuro.set_anchors_preset(Control.PRESET_FULL_RECT)
	_confirma.add_child(escuro)
	# André 2026-11-10: a de Destruir (com 2 botões) abria cortada no canto esquerdo: o position.x = -280 era aplicado
	# já dentro da árvore, onde vira posição absoluta. Agora um CenterContainer centraliza qualquer tamanho.
	var meio := CenterContainer.new()
	meio.set_anchors_preset(Control.PRESET_FULL_RECT)
	_confirma.add_child(meio)
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(FUNDO, (PIOR if perigo else OURO).darkened(0.25), 2, 10, 14))
	cx.custom_minimum_size = Vector2(430 if conteudo == null else 520, 0)
	meio.add_child(cx)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	cx.add_child(col)
	col.add_child(rotulo(titulo, 20, OURO_CLARO))
	if texto != "":
		var d := rotulo(texto, 15, TEXTO)
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		col.add_child(d)
	if conteudo != null:
		col.add_child(conteudo)
	var linha := HBoxContainer.new()
	linha.alignment = BoxContainer.ALIGNMENT_END
	linha.add_theme_constant_override("separation", 10)
	col.add_child(linha)
	var nao := botao("Cancelar", fechar_confirma, 15)
	nao.custom_minimum_size = Vector2(120, 44)
	linha.add_child(nao)
	var ok := botao(sim, func():
		fechar_confirma()
		fn.call(), 15, true)
	ok.custom_minimum_size = Vector2(140, 44)
	if perigo:
		ok.add_theme_color_override("font_color", PIOR)
		ok.add_theme_color_override("font_hover_color", PIOR)
	linha.add_child(ok)
	if extra != "" and fn_extra.is_valid(): # segunda escolha (ex.: destruir todas da raridade)
		cx.custom_minimum_size.x = maxf(cx.custom_minimum_size.x, 560)
		var b2 := botao(extra, func():
			fechar_confirma()
			fn_extra.call(), 15, true)
		b2.custom_minimum_size = Vector2(170, 44)
		if perigo:
			b2.add_theme_color_override("font_color", PIOR)
			b2.add_theme_color_override("font_hover_color", PIOR)
		linha.add_child(b2)

# André 2026-11-07: no card da peça só os números (o +N já vem no nome). Chance, custo e falta de atributo aparecem
# na janelinha de reforçar e nos avisos. Aqui só um aviso curto quando a peça reforçada não pode ser usada (Quimera).
# explica o botão "Até o máximo" (antes "Até cancelar"): tenta de novo sozinho, cada tentativa cobra o ouro
func texto_ate_maximo(it) -> String:
	return "Tenta de novo sozinho até +%d, até o ouro acabar ou até você tocar em Cancelar" % int(m.P.reforco_max(it))

func dica_ate_maximo(it) -> Control:
	var d := rotulo(texto_ate_maximo(it), 11, APAGADO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	d.custom_minimum_size = Vector2(140, 0)
	return d

func linha_reforco(it) -> Control:
	var P = m.P
	var l := rotulo("", 12, PIOR)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.visible = false
	if not P.reforco_ok(it):
		l.text = "⛔ " + ("Sem bônus: falta atributo" if it in P.prog.equip.values() else "Falta atributo para usar")
		l.visible = true
	return l

func botao_acao(t: String, msg: Dictionary, ativo := true) -> Button:
	var b := botao(t, func(): acao_item(msg), 14, ativo)
	b.custom_minimum_size = Vector2(120, 36)
	return b

# ---------- janela da peça do corpo (André 2026-11-03) ----------
# Tirar manda a peça para a mochila (qualquer lugar pode ficar vazio: sem nada, aparece a roupa de baixo: biquíni ou samba-canção).
# Embaixo, as peças da mochila que servem nesse lugar, com o que cada uma ganha ou perde em relação à vestida
# (verde = melhor, vermelho = pior), as melhores primeiro; Trocar veste e a vestida vai para o lugar dela na mochila
# (por isso trocar funciona mesmo com a mochila cheia). Online quem decide é o servidor (mensagem "item").
const MELHOR := Color(0.5, 0.86, 0.45)
const PIOR := Color(0.92, 0.42, 0.36)
# peso de cada número só para pôr a lista em ordem (melhor primeiro); o que aparece na tela são os números de verdade
const PESO_ST := {"vida": 1.0 / 20.0, "mana": 1.0 / 20.0, "defesa": 1.0 / 5.0, "danoFisico": 1.0 / 5.0, "danoMagico": 1.0 / 5.0,
	"critico": 1.0 / 0.01, "danoK": 1.0 / 0.05, "areaK": 1.0 / 0.05, "regenManaK": 1.0 / 0.05}

# quadradinho "Mostrar capacete": toca em qualquer parte da linha para marcar ou desmarcar (o bônus da peça continua)
func linha_mostrar_capacete(tam := 13) -> Control:
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 6)
	l.mouse_filter = Control.MOUSE_FILTER_STOP
	var q := Quadradinho.new()
	q.lado = tam + 6
	q.marcado = not m.P.prog.get("semCapacete", false)
	q.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(q)
	quadradinhos.append(q)
	var t := rotulo("Mostrar capacete", tam, TEXTO)
	t.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.add_child(t)
	l.gui_input.connect(func(ev):
		if toque(ev):
			acao_item({"acao": "capacete", "mostrar": m.P.prog.get("semCapacete", false)}))
	return l

func janela_aberta() -> bool:
	return janela_lugar != "" and janela != null and is_instance_valid(janela) and janela.visible

func fechar_janela(refazer := true) -> void:
	janela_lugar = ""
	sel_equip = ""
	if janela and is_instance_valid(janela):
		janela.queue_free()
	janela = null
	janela_rolagem = null
	if refazer:
		atualizar()

# números da peça: {"defesa": 4.0, ...}; null = nada
func st_item(it) -> Dictionary:
	var r := {}
	if m.P.eh_equip(it):
		var st: Dictionary = m.P.dados.itens[it.k].st
		for c in st:
			r[c] = float(st[c][int(it.r)]) * m.P.reforco_k(it, c) # com o reforço (+N)
	return r

# diferença da peça nova para a vestida: {"defesa": +2, "mana": -3}
func diferenca(novo, atual) -> Dictionary:
	var a := st_item(atual)
	var n := st_item(novo)
	var d := {}
	for c in n.keys() + a.keys():
		var v: float = n.get(c, 0.0) - a.get(c, 0.0)
		if abs(v) > 0.00001:
			d[c] = v
	return d

func nota(d: Dictionary) -> float:
	var s := 0.0
	for c in d:
		s += d[c] * PESO_ST.get(c, 1.0)
	return s

# "Melhor", "Pior" ou "Melhor em parte"; e a cor
func veredito(d: Dictionary) -> Array:
	var ganha := d.values().any(func(v): return v > 0)
	var perde := d.values().any(func(v): return v < 0)
	if ganha and not perde:
		return ["Melhor", MELHOR]
	if perde and not ganha:
		return ["Pior", PIOR]
	if ganha and perde:
		return ["Melhor em parte" if nota(d) >= 0 else "Pior em parte", OURO_CLARO]
	return ["Igual", APAGADO]

# "▲ +2 Defesa   ▼ -3 Mana" com as cores
func texto_diferenca(d: Dictionary) -> RichTextLabel:
	var t := RichTextLabel.new()
	t.bbcode_enabled = true
	t.fit_content = true
	t.scroll_active = false
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	t.add_theme_font_size_override("normal_font_size", 12)
	var p := []
	var chaves: Array = d.keys()
	chaves.sort_custom(func(a, b): return (d[a] > 0) and not (d[b] > 0))
	for c in chaves:
		var v: float = d[c]
		var txt: String = m.P.texto_st(c, abs(v)).substr(1) # tira o "+" (o sinal vem abaixo)
		p.append("[color=#%s]%s %s%s[/color]" % [(MELHOR if v > 0 else PIOR).to_html(false), "▲" if v > 0 else "▼", "+" if v > 0 else "−", txt])
	t.text = "  ".join(p) if not p.is_empty() else "[color=#%s]Mesmos números[/color]" % APAGADO.to_html(false)
	return t

# janela pequena colada no medalhão (André: "o mais enxuta possível, estamos no celular"): a peça vestida em uma linha,
# Tirar, um aviso curto (é a sua melhor peça / tem peça melhor na mochila) e, se houver, as peças da mochila que servem
func montar_janela() -> void:
	if janela and is_instance_valid(janela):
		janela.queue_free()
		janela = null
		janela_rolagem = null
	if janela_lugar == "" or not aberto():
		return
	var P = m.P
	var l := janela_lugar
	var atual = P.prog.equip.get(l)
	janela = Control.new()
	janela.set_anchors_preset(Control.PRESET_FULL_RECT)
	raiz.add_child(janela)
	# véu leve: tocar fora fecha
	var veu := ColorRect.new()
	veu.color = Color(0, 0, 0, 0.3)
	veu.set_anchors_preset(Control.PRESET_FULL_RECT)
	veu.mouse_filter = Control.MOUSE_FILTER_STOP
	veu.gui_input.connect(func(ev):
		if toque(ev):
			fechar_janela())
	janela.add_child(veu)
	var cx := PanelContainer.new()
	cx.custom_minimum_size = Vector2(430, 0)
	var est := caixa(FUNDO, OURO.darkened(0.15), 1, 10, 16)
	est.content_margin_left = 12
	est.content_margin_right = 12
	est.content_margin_top = 10
	est.content_margin_bottom = 10
	cx.add_theme_stylebox_override("panel", est)
	janela.add_child(cx)
	cx.modulate.a = 0.0 # aparece só depois de ir para o lado do medalhão (_posicionar_janela)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	cx.add_child(v)
	# peças da mochila que servem aqui, comparadas com a vestida (melhores primeiro)
	var opcoes := []
	for i in P.prog.mochila.size():
		var it = P.prog.mochila[i]
		if P.eh_equip(it) and str(P.dados.itens[it.k].lugar) == l:
			var d := diferenca(it, atual)
			opcoes.append({"i": i, "it": it, "d": d, "nota": nota(d)})
	opcoes.sort_custom(func(a, b): return a.nota > b.nota if a.nota != b.nota else int(a.it.r) > int(b.it.r))
	var melhores: int = opcoes.filter(func(o): return o.nota > 0.0001).size()
	# linha 1: a peça vestida (ícone, nome, números) e Tirar
	var linha := HBoxContainer.new()
	linha.add_theme_constant_override("separation", 10)
	var c := celula(atual, false, func(): pass, 52)
	c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	if atual == null: # lugar vazio: o desenho do lugar, apagado
		var ic := TextureRect.new()
		ic.texture = icone_tex("eq_" + l if l in ["cabeca", "corpo", "pernas", "pes", "capa", "acessorio"] else ("basico" if l == "espada" else "magia"))
		ic.set_anchors_preset(Control.PRESET_FULL_RECT)
		ic.offset_left = 10
		ic.offset_top = 10
		ic.offset_right = -10
		ic.offset_bottom = -10
		ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ic.modulate = Color(0.85, 0.75, 0.55, 0.3)
		ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
		c.add_child(ic)
	linha.add_child(c)
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	txt.add_theme_constant_override("separation", 0)
	txt.add_child(rotulo(janela_nome.to_upper(), 11, OURO))
	if atual != null:
		txt.add_child(rotulo(P.nome_item(atual), 16, P.cor_item(atual)))
		var d := rotulo(P.texto_item(atual), 12, APAGADO)
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		txt.add_child(d)
		txt.add_child(linha_reforco(atual))
	else:
		txt.add_child(rotulo("Nada vestido", 16, APAGADO))
		if l in ["corpo", "pernas"]:
			txt.add_child(rotulo("Aparece a roupa de baixo", 12, APAGADO))
	linha.add_child(txt)
	var cheia: bool = P.prog.mochila.find(null) < 0
	if atual != null and int(atual.get("e", 0)) < P.reforco_max(atual): # reforçar a peça vestida (igual ao Quimera)
		var rv := VBoxContainer.new() # uma vez ou até cancelar (para sozinho no limite da peça, do atributo ou do ouro)
		rv.add_theme_constant_override("separation", 4)
		rv.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		var rf := botao("Reforçar 1 vez", func(): m.reforco.comecar({"lugar": l}, false), 14, true)
		rf.custom_minimum_size = Vector2(140, 38)
		rv.add_child(rf)
		var ra := botao("Até o máximo", func(): m.reforco.comecar({"lugar": l}, true), 14)
		ra.custom_minimum_size = Vector2(140, 38)
		rv.add_child(ra)
		rv.add_child(dica_ate_maximo(atual))
		linha.add_child(rv)
	if atual != null:
		var b := botao("Tirar", func(): acao_item({"acao": "tirar", "lugar": l}), 15, not cheia)
		b.custom_minimum_size = Vector2(96, 44)
		b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		b.disabled = cheia
		avisar_travado(b, func(): return "Mochila cheia: libere um espaço para tirar a peça")
		linha.add_child(b)
	v.add_child(linha)
	# linha 2: o aviso curto
	var aviso := ""
	var cor_aviso := OURO_CLARO
	if atual != null and cheia:
		aviso = "Mochila cheia: libere um lugar para tirar" + (" (trocar funciona)." if not opcoes.is_empty() else ".")
		cor_aviso = PIOR
	elif atual == null:
		aviso = ("Tem %d peça%s na mochila para este lugar" % [opcoes.size(), "" if opcoes.size() == 1 else "s"]) if not opcoes.is_empty() else "Nenhuma peça na mochila para este lugar"
		cor_aviso = MELHOR if not opcoes.is_empty() else APAGADO
	elif melhores > 0:
		aviso = "▲ Tem peça melhor na mochila" if melhores == 1 else "▲ Tem %d peças melhores na mochila" % melhores
		cor_aviso = MELHOR
	else:
		aviso = "✓ É a sua melhor peça para este lugar"
	var a := rotulo(aviso, 13, cor_aviso)
	a.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(a)
	if l == "cabeca":
		v.add_child(linha_mostrar_capacete(14))
	# linhas 3+: as peças da mochila (até 3 à vista; mais que isso rola)
	if not opcoes.is_empty():
		var fio := ColorRect.new()
		fio.color = Color(OURO, 0.18)
		fio.custom_minimum_size = Vector2(0, 1)
		v.add_child(fio)
		janela_rolagem = ScrollContainer.new()
		janela_rolagem.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		janela_rolagem.custom_minimum_size = Vector2(0, min(opcoes.size(), 3) * 56 - 6)
		v.add_child(janela_rolagem)
		var lista := VBoxContainer.new()
		lista.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		lista.add_theme_constant_override("separation", 6)
		janela_rolagem.add_child(lista)
		for o in opcoes:
			lista.add_child(linha_opcao(o, atual != null))
	# ao lado do medalhão tocado, sem sair da tela
	_posicionar_janela.call_deferred(cx)

func _posicionar_janela(cx: Control) -> void:
	if not is_instance_valid(cx):
		return
	var tela := raiz.get_viewport_rect().size
	var alvo := Vector2(tela.x * 0.5, tela.y * 0.5)
	for id in slots_ui:
		if lugar_de(id) == janela_lugar:
			var r: Rect2 = slots_ui[id].no.get_global_rect()
			alvo = Vector2(r.end.x + 14, r.get_center().y - 40)
	cx.reset_size()
	var s := cx.get_combined_minimum_size()
	cx.position = Vector2(clampf(alvo.x, 12, tela.x - s.x - 12), clampf(alvo.y, 12, tela.y - s.y - 12))
	cx.modulate.a = 1.0

# uma peça da mochila numa linha: ícone, nome + Melhor/Pior, o que ganha e perde, e Trocar (ou Vestir)
func linha_opcao(o: Dictionary, tem_atual: bool) -> Control:
	var P = m.P
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 10)
	var c := celula(o.it, false, func(): pass, 48)
	c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(c)
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	txt.add_theme_constant_override("separation", 0)
	var topo := HBoxContainer.new()
	topo.add_theme_constant_override("separation", 8)
	topo.add_child(rotulo(P.nome_item(o.it), 14, P.cor_item(o.it)))
	if tem_atual:
		var ver: Array = veredito(o.d)
		var tag := rotulo(ver[0], 11, ver[1])
		tag.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		topo.add_child(tag)
	txt.add_child(topo)
	if tem_atual:
		txt.add_child(texto_diferenca(o.d))
	else:
		txt.add_child(rotulo(P.texto_item(o.it), 12, MELHOR))
	l.add_child(txt)
	var b := botao("Trocar" if tem_atual else "Vestir", func(): acao_item({"acao": "equipar", "i": int(o.i)}), 14, true)
	b.custom_minimum_size = Vector2(88, 44)
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(b)
	return l

func montar_loja() -> void:
	var P = m.P
	var topo := HBoxContainer.new()
	topo.add_child(linha_ouro())
	conteudo.add_child(topo)
	var merc: Dictionary = P.mercador()
	var txt_merc := "" if merc.venda <= 0.0 else " Mercador Nv %d: ela paga +%s%% e cobra -%s%%." % [P.prof_nivel("mer"), P.num(merc.venda * 100, 0), P.num(merc.compra * 100, 0)]
	var d := rotulo("Rosa compra o que você tiver: na Mochila, toque no item e em Vender." + txt_merc + " A banca dela também é a do Alfaiate (Profissões → Alfaiate).", 12, APAGADO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	conteudo.add_child(d)
	separador("À venda")
	for i in P.dados.loja.size():
		var o: Dictionary = P.dados.loja[i]
		var it := {"k": str(o.k), "n": 1} if not P.dados.itens[str(o.k)].has("lugar") else {"k": str(o.k), "r": int(o.r)}
		var l := HBoxContainer.new()
		l.add_theme_constant_override("separation", 12)
		l.add_child(celula(it, false, func(): pass, 48))
		var txt := VBoxContainer.new()
		txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		txt.add_theme_constant_override("separation", 0)
		txt.add_child(rotulo(P.nome_item(it), 15, P.cor_item(it)))
		var t := rotulo(P.texto_item(it), 12, APAGADO)
		t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		txt.add_child(t)
		l.add_child(txt)
		var preco: int = P.preco_compra(o)
		var pode: bool = int(P.prog.ouro) >= preco
		var b := botao("Comprar · %d" % preco, func(): escolher_quantidade(i), 14, pode) # André 2026-11-07: escolhe quantos
		b.custom_minimum_size = Vector2(140, 40)
		b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		b.disabled = not pode
		avisar_travado(b, func(): return "Faltam %d de ouro" % (preco - int(P.prog.ouro)))
		l.add_child(b)
		conteudo.add_child(l)

# ---------- comprar várias de uma vez (André 2026-11-07) ----------
# Tocar em Comprar abre a janelinha da quantidade: − e + (segurar repete e acelera), Máx (o que o ouro e a mochila deixam),
# o total em ouro e Comprar, que manda tudo de uma vez ({ acao: 'comprar', i, n }; o servidor confere ouro e espaço).
# Quando o servidor confirma (evento 'compra'), toca o som de moedas e sobe o "+20 Semente de cenoura" (comprou()).
var _qtd := 1
var _qtd_max := 1
var _qtd_repete: Timer
var _qtd_passo := 1 # quanto o − / + segurado anda (acelera)
var _qtd_vezes := 0

# quantos desse item ainda cabem na mochila (igual ao servidor: pilhas iguais com espaço + lugares vazios)
func cabe_na_mochila(o: Dictionary) -> int:
	var P = m.P
	var equip: bool = P.dados.itens[str(o.k)].has("lugar")
	var pilha: int = 1 if equip else int(P.dados.itens[str(o.k)].get("pilha", 1))
	var n := 0
	for x in P.prog.mochila:
		if x == null:
			n += pilha
		elif not equip and str(x.k) == str(o.k) and not x.has("h") and not x.has("nv") and int(x.n) < pilha:
			n += pilha - int(x.n)
	return n

func escolher_quantidade(i: int) -> void:
	var P = m.P
	var o: Dictionary = P.dados.loja[i]
	var equip: bool = P.dados.itens[str(o.k)].has("lugar")
	var it := {"k": str(o.k), "r": int(o.r)} if equip else {"k": str(o.k), "n": 1}
	var preco: int = P.preco_compra(o)
	var cabe := cabe_na_mochila(o)
	_qtd_max = mini(int(P.dados.get("lojaMax", 999)), mini(int(P.prog.ouro) / maxi(1, preco), cabe))
	if _qtd_max <= 0:
		m.hud.aviso("Mochila cheia" if cabe <= 0 else "Ouro insuficiente")
		return
	_qtd = 1
	fechar_confirma()
	_confirma = Control.new()
	_confirma.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_confirma)
	var escuro := ColorRect.new()
	escuro.color = Color(0, 0, 0, 0.5)
	escuro.set_anchors_preset(Control.PRESET_FULL_RECT)
	_confirma.add_child(escuro)
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(FUNDO, OURO.darkened(0.25), 2, 10, 16))
	cx.set_anchors_preset(Control.PRESET_CENTER)
	cx.custom_minimum_size = Vector2(460, 0)
	cx.position = Vector2(-230, -150)
	_confirma.add_child(cx)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	cx.add_child(col)
	# o item: ícone, nome e preço de cada um
	var topo := HBoxContainer.new()
	topo.add_theme_constant_override("separation", 12)
	topo.add_child(celula(it, false, func(): pass, 56))
	var nomes := VBoxContainer.new()
	nomes.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	nomes.alignment = BoxContainer.ALIGNMENT_CENTER
	nomes.add_child(rotulo(P.nome_item(it), 18, P.cor_item(it)))
	nomes.add_child(rotulo("%d de ouro cada · você tem %d" % [preco, int(P.prog.ouro)], 13, APAGADO))
	topo.add_child(nomes)
	col.add_child(topo)
	# − quantidade + e Máx
	var linha_q := HBoxContainer.new()
	linha_q.alignment = BoxContainer.ALIGNMENT_CENTER
	linha_q.add_theme_constant_override("separation", 10)
	col.add_child(linha_q)
	var menos := botao_repete("−", -1)
	linha_q.add_child(menos)
	var caixa_n := PanelContainer.new()
	caixa_n.add_theme_stylebox_override("panel", caixa(Color(0.04, 0.035, 0.03, 1), OURO, 1, 8, 6))
	caixa_n.custom_minimum_size = Vector2(110, 56)
	var num := rotulo("1", 28, OURO_CLARO)
	num.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	num.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	caixa_n.add_child(num)
	linha_q.add_child(caixa_n)
	var mais := botao_repete("+", 1)
	linha_q.add_child(mais)
	var maximo := botao("Máx", func(): mudar_qtd(_qtd_max - _qtd), 16)
	maximo.custom_minimum_size = Vector2(72, 56)
	linha_q.add_child(maximo)
	var limite := rotulo("", 12, APAGADO)
	limite.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	limite.text = "Até %d (%s)" % [_qtd_max, "o que cabe na mochila" if _qtd_max >= cabe else "o que o ouro paga" if _qtd_max < int(P.dados.get("lojaMax", 999)) else "por vez"]
	col.add_child(limite)
	# total e botões
	var linha := HBoxContainer.new()
	linha.add_theme_constant_override("separation", 10)
	col.add_child(linha)
	var total := HBoxContainer.new()
	total.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	total.add_theme_constant_override("separation", 6)
	var ic := TextureRect.new()
	ic.texture = icone_tex("it_ouro")
	ic.custom_minimum_size = Vector2(24, 24)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	total.add_child(ic)
	var t_total := rotulo("", 18, Color("ffd36a"))
	t_total.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	total.add_child(t_total)
	linha.add_child(total)
	var nao := botao("Cancelar", fechar_confirma, 15)
	nao.custom_minimum_size = Vector2(110, 48)
	linha.add_child(nao)
	var ok := botao("Comprar", func():
		var n := _qtd
		fechar_confirma()
		acao_item({"acao": "comprar", "i": i, "n": n}), 16, true)
	ok.custom_minimum_size = Vector2(130, 48)
	linha.add_child(ok)
	var mostrar := func():
		num.text = str(_qtd)
		t_total.text = "Total: %d de ouro" % (_qtd * preco)
		ok.text = "Comprar %d" % _qtd
		menos.disabled = _qtd <= 1
		mais.disabled = _qtd >= _qtd_max
		maximo.disabled = _qtd >= _qtd_max
	_confirma.set_meta("mostrar", mostrar)
	mostrar.call()

func mudar_qtd(d: int) -> void:
	_qtd = clampi(_qtd + d, 1, maxi(1, _qtd_max))
	if _confirma and _confirma.has_meta("mostrar"):
		(_confirma.get_meta("mostrar") as Callable).call()

# − / + que repetem enquanto o dedo segura (começa de 1 em 1, depois de 5 em 5 e de 10 em 10)
func botao_repete(t: String, sinal: int) -> Button:
	var b := Button.new()
	b.text = t
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 28)
	b.custom_minimum_size = Vector2(64, 56)
	estilo_botao(b, true)
	b.button_down.connect(func():
		mudar_qtd(sinal)
		_qtd_vezes = 0
		_qtd_passo = sinal
		if _qtd_repete == null:
			_qtd_repete = Timer.new()
			add_child(_qtd_repete)
			_qtd_repete.timeout.connect(func():
				if _confirma == null or not _confirma.has_meta("mostrar"):
					_qtd_repete.stop()
					return
				_qtd_vezes += 1
				_qtd_repete.wait_time = 0.09
				var passo := 1 if _qtd_vezes < 12 else 5 if _qtd_vezes < 30 else 10
				mudar_qtd(passo * signi(_qtd_passo)))
		_qtd_repete.wait_time = 0.4
		_qtd_repete.start())
	b.button_up.connect(func():
		if _qtd_repete:
			_qtd_repete.stop())
	return b

# o servidor confirmou a compra (evento 'compra' em online.gd): som de moedas e o "+n Item" subindo, com o ouro gasto
func comprou(ev: Dictionary) -> void:
	var P = m.P
	if m.sons:
		m.sons.tocar("moedas", -2.0, 0.05)
	var it := {"k": str(ev.k), "r": int(ev.r)} if int(ev.get("r", -1)) >= 0 else {"k": str(ev.k), "n": int(ev.n)}
	var caixa_f := PanelContainer.new()
	caixa_f.add_theme_stylebox_override("panel", caixa(Color(0.07, 0.06, 0.045, 0.94), OURO_CLARO, 2, 12, 12))
	caixa_f.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 10)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	caixa_f.add_child(l)
	var ic := TextureRect.new()
	ic.texture = icone_tex(P.icone_item(it))
	ic.custom_minimum_size = Vector2(52, 52)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.add_child(ic)
	var txt := VBoxContainer.new()
	txt.add_theme_constant_override("separation", 0)
	txt.mouse_filter = Control.MOUSE_FILTER_IGNORE
	txt.add_child(rotulo("+%d %s" % [int(ev.n), P.nome_item(it)], 24, MELHOR))
	txt.add_child(rotulo("−%d de ouro" % int(ev.ouro), 17, Color("ffd36a")))
	l.add_child(txt)
	add_child(caixa_f)
	await get_tree().process_frame
	if not is_instance_valid(caixa_f):
		return
	var tela := get_viewport().get_visible_rect().size
	caixa_f.position = Vector2((tela.x - caixa_f.size.x) * 0.5, tela.y * 0.42)
	caixa_f.pivot_offset = caixa_f.size * 0.5
	caixa_f.scale = Vector2(0.6, 0.6)
	var tw := caixa_f.create_tween()
	tw.tween_property(caixa_f, "scale", Vector2.ONE, 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(caixa_f, "position:y", tela.y * 0.42 - 70.0, 1.5).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(caixa_f, "modulate:a", 0.0, 0.5).set_delay(1.1)
	tw.tween_callback(caixa_f.queue_free)

# aprendeu com o Tomo (André 2026-11-07): faixa pequena e dourada, "Parabéns! Você liberou X Nv N", some sozinha
func aprendeu(id: String, nv: int) -> void:
	var P = m.P
	if not P.habs.has(id):
		return
	if m.sons:
		m.sons.tocar("nivel", -4.0, 0.0)
	var caixa_f := PanelContainer.new()
	caixa_f.add_theme_stylebox_override("panel", caixa(Color(0.07, 0.06, 0.045, 0.95), OURO_CLARO, 2, 12, 14))
	caixa_f.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 12)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	caixa_f.add_child(l)
	var ic := TextureRect.new()
	ic.texture = icone_tex(P.ICONE.get(id, ""))
	ic.custom_minimum_size = Vector2(52, 52)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.add_child(ic)
	var txt := VBoxContainer.new()
	txt.add_theme_constant_override("separation", 0)
	txt.mouse_filter = Control.MOUSE_FILTER_IGNORE
	txt.add_child(rotulo("Parabéns!", 24, Color("ffd36a")))
	txt.add_child(rotulo("Você liberou %s Nv %d" % [P.habs[id].nome, nv], 17, TEXTO))
	l.add_child(txt)
	add_child(caixa_f)
	await get_tree().process_frame
	if not is_instance_valid(caixa_f):
		return
	var tela := get_viewport().get_visible_rect().size
	caixa_f.position = Vector2((tela.x - caixa_f.size.x) * 0.5, tela.y * 0.16)
	caixa_f.pivot_offset = caixa_f.size * 0.5
	caixa_f.scale = Vector2(0.6, 0.6)
	var tw := caixa_f.create_tween()
	tw.tween_property(caixa_f, "scale", Vector2(1.08, 1.08), 0.2).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(caixa_f, "scale", Vector2.ONE, 0.15)
	tw.tween_property(caixa_f, "modulate:a", 0.0, 0.5).set_delay(2.0)
	tw.tween_callback(caixa_f.queue_free)

# online o servidor confere e devolve a mochila nova; sem internet muda só neste celular (a loja só funciona online)
func acao_item(msg: Dictionary) -> void:
	var P = m.P
	var i: int = msg.get("i", -1)
	if msg.acao == "usar" and i >= 0 and P.prog.mochila[i] != null and P.prog.mochila[i].k != "tomo":
		if not m.usar_pocao(P.prog.mochila[i]): # vida/mana cheia: nem gasta
			return
	if msg.acao in ["equipar", "tirar", "vender", "apagar", "vender_varios", "organizar"]:
		sel_mochila = -1
		sel_equip = ""
	if msg.acao == "vender_varios":
		vendendo = false
		marcados = {}
	if msg.acao in ["destruir", "evoluir"] and not m.on():
		m.hud.aviso("Destruir e evoluir peça só funcionam online")
		return
	if msg.acao == "filtro": # o quadradinho responde na hora; online o servidor devolve o mesmo
		if msg.r.is_empty() and msg.k.is_empty():
			P.prog.erase("filtro")
		else:
			P.prog.filtro = {"r": msg.r.duplicate(), "k": msg.k.duplicate()}
		P.mudou = true
	if m.on():
		m.rede("item", msg)
		if msg.acao == "filtro":
			atualizar()
		return
	match msg.acao:
		"titulo": # sozinho (sem servidor): só usa o que a conta já ganhou
			var tt = P.prog.get("tit")
			if tt is Dictionary and (msg.id == "" or msg.id in tt.get("tem", [])):
				tt.uso = msg.id
		"capacete":
			P.prog.semCapacete = msg.mostrar == false
		"equipar":
			if i >= 0 and P.eh_equip(P.prog.mochila[i]) and not P.reforco_ok(P.prog.mochila[i]):
				m.hud.aviso(P.texto_reforco_precisa(P.prog.mochila[i]))
			P.equipar(i)
		"tirar":
			var r: String = P.tirar(msg.lugar)
			if r != "":
				m.hud.aviso(r)
		"usar":
			var it = P.prog.mochila[i]
			if it.k == "tomo":
				var h := str(it.h)
				var r: String = P.usar_tomo(i)
				m.hud.aviso(r)
				if r.ends_with("!"): # subiu
					aprendeu(h, P.nivel_de(h))
			else:
				P.gastar(i)
			if P.prog.mochila[i] == null:
				sel_mochila = -1
		"cadeado":
			var it = P.prog.mochila[i] if i >= 0 and i < P.prog.mochila.size() else P.prog.equip.get(msg.get("lugar", ""))
			if it != null:
				if it.get("cad", false):
					it.erase("cad")
				else:
					it.cad = 1
				P.mudou = true
				m.hud.aviso(("%s trancado: não dá para vender nem jogar fora" if it.has("cad") else "%s destrancado") % P.nome_item(it))
		"apagar":
			var it = P.prog.mochila[i] if i >= 0 and i < P.prog.mochila.size() else null
			if it != null and it.get("cad", false):
				m.hud.aviso("Item trancado. Abra o cadeado para jogar fora")
			elif it != null:
				P.prog.mochila[i] = null
				P.mudou = true
				m.hud.aviso("Jogou fora %s" % P.nome_item(it))
		"consertar":
			m.hud.aviso(P.consertar_tudo())
		"vender", "comprar", "vender_varios":
			m.hud.aviso("A loja só funciona online (o ouro fica na sua conta)")
		"pagina":
			m.hud.aviso("Páginas da mochila só se compram online (o ouro fica na sua conta)")
		"organizar":
			P.prog.mochila = P.organizar(P.prog.mochila)
			P.mudou = true
	m.h.vida = min(m.h.vida, P.st.vidaMax)
	m.h.mana = min(m.h.mana, P.st.manaMax)
	atualizar()

# a barra (6 botões): toque em um e depois em outro para trocar de lugar; Padrão volta ao começo
func linha_barra(barra: String) -> Control:
	var P = m.P
	var bt := HBoxContainer.new()
	bt.add_theme_constant_override("separation", 8)
	var lista: Array = P.prog.barras[barra]
	for i in lista.size():
		var k = lista[i]
		var escolhido: bool = _sel != null and _sel[0] == barra and _sel[1] == i
		var s := Button.new()
		s.focus_mode = Control.FOCUS_NONE
		s.custom_minimum_size = Vector2(56, 56)
		var est := caixa(Color(0.16, 0.13, 0.08, 1) if escolhido else Color(0.05, 0.045, 0.04, 1), OURO_CLARO if escolhido else OURO if k != null else BORDA, 2 if escolhido else 1, 28)
		for e in ["normal", "hover", "pressed"]:
			s.add_theme_stylebox_override(e, est)
		s.pressed.connect(func():
			if not _arrastou:
				tocar_barra(barra, i))
		var n := rotulo(str(i + 1), 12, OURO)
		n.position = Vector2(5, 1)
		if k != null and P.habs.has(k):
			var ic := TextureRect.new()
			ic.texture = icone_tex(P.ICONE.get(k, ""))
			ic.set_anchors_preset(Control.PRESET_FULL_RECT)
			ic.offset_left = 10
			ic.offset_top = 10
			ic.offset_right = -10
			ic.offset_bottom = -10
			ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
			if not P.liberada(k):
				ic.modulate = Color(0.4, 0.4, 0.4)
				var nv := rotulo("Nv %d" % int(P.habs[k].libera), 11, APAGADO)
				nv.position = Vector2(14, 38)
				s.add_child(ic)
				s.add_child(nv)
			else:
				s.add_child(ic)
		n.mouse_filter = Control.MOUSE_FILTER_IGNORE
		s.add_child(n)
		bt.add_child(s)
	var pd := botao("Padrão", func(): barra_padrao(barra), 13)
	pd.custom_minimum_size = Vector2(76, 40)
	pd.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	bt.add_child(pd)
	return bt

func tocar_barra(barra: String, i: int) -> void:
	if _sel == null or _sel[0] != barra:
		_sel = [barra, i]
	elif _sel[1] == i:
		_sel = null
	else:
		var b: Array = m.P.prog.barras[barra]
		var t = b[i]
		b[i] = b[_sel[1]]
		b[_sel[1]] = t
		_sel = null
		mandar_barra(barra)
	atualizar()

func barra_padrao(barra: String) -> void:
	m.P.prog.barras[barra] = m.P.dados.botoesPadrao[barra].duplicate()
	_sel = null
	mandar_barra(barra)
	atualizar()

func por_no_botao(id: String, barra: String, i: int) -> void:
	var b: Array = m.P.prog.barras[barra]
	m.P.por_no_botao("" if b[i] == id else id, barra, i)
	_sel = null
	mandar_barra(barra)
	atualizar()

func mandar_barra(barra: String) -> void:
	m.P.mudou = true
	m.rede("barra", {"barra": barra, "lista": m.P.prog.barras[barra]})

# X de fechar desenhado (sem depender de símbolo na fonte)
class Quadradinho extends Control:
	var marcado := true
	var lado := 18.0
	func _ready() -> void:
		custom_minimum_size = Vector2(lado, lado)
		mouse_filter = Control.MOUSE_FILTER_IGNORE
	func _draw() -> void:
		var r := Rect2(Vector2(1, 1), Vector2(lado - 2, lado - 2))
		draw_rect(r, Color(0.05, 0.045, 0.04) if not marcado else Color(0.17, 0.148, 0.12))
		draw_rect(r, Color(0.95, 0.82, 0.55) if marcado else Color(0.42, 0.33, 0.20), false, 1.5)
		if marcado:
			var k := lado / 18.0
			draw_polyline(PackedVector2Array([Vector2(4.5, 9.5) * k, Vector2(7.8, 13) * k, Vector2(13.8, 5) * k]), Color(0.95, 0.82, 0.55), 2.4 * k, true)

class Fechar extends Control:
	func _ready() -> void:
		custom_minimum_size = Vector2(40, 40)
		mouse_filter = Control.MOUSE_FILTER_STOP
	func _draw() -> void:
		var c := size * 0.5
		draw_circle(c, 19, Color(0.12, 0.105, 0.088))
		draw_arc(c, 19, 0, TAU, 32, Color(0.8, 0.64, 0.36), 1.5, true)
		var r := 7.0
		draw_line(c + Vector2(-r, -r), c + Vector2(r, r), Color(0.95, 0.82, 0.55), 2.5, true)
		draw_line(c + Vector2(-r, r), c + Vector2(r, -r), Color(0.95, 0.82, 0.55), 2.5, true)

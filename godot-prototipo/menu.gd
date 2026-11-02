extends CanvasLayer
# Menu do personagem (ideia do Quimera, com cara mais adulta): abre tocando no painel de vida.
# Esquerda: o herói em 3D (arrasta para girar) com os 6 lugares de equipamento (Cabeça, Corpo, Pés | Arma, Acessório, Capa).
# Direita: abas Status (nível, XP, pontos de atributo e os números do herói) e Habilidades (Espada, Cajado e Gerais,
# com nível de cada skill, o que melhora no próximo e em qual botão de cada barra ela fica). Passivas no fim.
# Duas barras como no Quimera: a da espada e a do cajado (Trocar mostra a outra); toque em dois botões da barra para
# trocar de lugar. Quem decide é o servidor (online manda "atributo" e "barra"); sem internet muda só neste celular.
# Mochila (8 x 4) e Loja da Rosa (Parte 2 do Quimera): toque num item para ver, equipar, usar ou vender; toque num lugar
# de equipamento para ver a peça e tirar. Online quem decide é o servidor (manda "item"); sem internet muda só aqui.
# Profissões (Parte 3 do Quimera): vigor, ouro e o nível de cada profissão; Ferreiro e Alfaiate com as receitas
# (Criar só perto da forja do Tomás ou da banca da Rosa; online quem confere e dá a peça é o servidor, mensagem "criar").
# A lista rola arrastando o dedo (feito aqui em _input: as linhas e os botões não deixavam o ScrollContainer rolar).

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
const SLOTS := [["cabeca", "Cabeça"], ["corpo", "Corpo"], ["pes", "Pés"], ["arma", "Arma"], ["acessorio", "Acessório"], ["capa", "Capa"]]

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
var slots_ui := {} # lugar -> {icone, painel}
var sel_mochila := -1 # item escolhido na mochila
var sel_equip := "" # peça escolhida no corpo (lugar)
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
static func caixa(cor: Color, borda: Color, b := 1, raio := 6, sombra := 0) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = cor
	s.border_color = borda
	s.set_border_width_all(b)
	s.set_corner_radius_all(raio)
	if sombra > 0:
		s.shadow_color = Color(0, 0, 0, 0.55)
		s.shadow_size = sombra
	s.content_margin_left = 10
	s.content_margin_right = 10
	s.content_margin_top = 6
	s.content_margin_bottom = 6
	return s

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
	return load("res://icones/%s.svg" % nome) if nome != "" else null

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
	var meio := HBoxContainer.new()
	meio.size_flags_vertical = Control.SIZE_EXPAND_FILL
	meio.add_theme_constant_override("separation", 8)
	col.add_child(meio)
	var esq := VBoxContainer.new()
	esq.alignment = BoxContainer.ALIGNMENT_CENTER
	esq.add_theme_constant_override("separation", 14)
	var dir := VBoxContainer.new()
	dir.alignment = BoxContainer.ALIGNMENT_CENTER
	dir.add_theme_constant_override("separation", 14)
	for i in 6:
		var s := slot(SLOTS[i][0], SLOTS[i][1])
		(esq if i < 3 else dir).add_child(s)
	meio.add_child(esq)
	# palco do herói
	var palco := SubViewportContainer.new()
	palco.stretch = true
	palco.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	palco.size_flags_vertical = Control.SIZE_EXPAND_FILL
	palco.mouse_filter = Control.MOUSE_FILTER_STOP
	palco.gui_input.connect(_girar)
	vp = SubViewport.new()
	vp.own_world_3d = true
	vp.transparent_bg = true
	vp.msaa_3d = Viewport.MSAA_2X
	vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	palco.add_child(vp)
	meio.add_child(palco)
	meio.add_child(dir)
	var dica := rotulo("Arraste o personagem para girar", 12, APAGADO)
	dica.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(dica)
	montar_palco()
	return col

# lugar de equipamento: moldura escura com o nome; a arma mostra a que está na mão (o resto vem com a mochila)
func slot(id: String, nome: String) -> Control:
	var c := VBoxContainer.new()
	c.add_theme_constant_override("separation", 2)
	var p := Panel.new()
	p.custom_minimum_size = Vector2(66, 66)
	p.add_theme_stylebox_override("panel", caixa(Color(0.05, 0.045, 0.04, 1), BORDA, 1, 8))
	var ic := TextureRect.new()
	ic.set_anchors_preset(Control.PRESET_FULL_RECT)
	ic.offset_left = 12
	ic.offset_top = 12
	ic.offset_right = -12
	ic.offset_bottom = -12
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.modulate = Color(1, 1, 1, 0.9)
	p.add_child(ic)
	c.add_child(p)
	var l := rotulo(nome, 12, APAGADO)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	c.add_child(l)
	slots_ui[id] = {"icone": ic, "painel": p}
	if id == "arma":
		slot_arma = slots_ui[id]
	p.mouse_filter = Control.MOUSE_FILTER_STOP
	ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
	p.gui_input.connect(func(ev):
		if (ev is InputEventMouseButton and ev.pressed) or (ev is InputEventScreenTouch and ev.pressed):
			tocar_slot(id))
	return c

func lugar_de(id: String) -> String:
	return ("espada" if boneco_modo == "Espada" else "cajado") if id == "arma" else id

# peças do corpo: ícone com a cor da raridade; vazio = silhueta apagada
func atualizar_slots() -> void:
	for id in slots_ui:
		var u: Dictionary = slots_ui[id]
		var it = m.P.prog.equip.get(lugar_de(id))
		var escolhido: bool = sel_equip != "" and sel_equip == lugar_de(id)
		if it != null:
			var c: Color = m.P.cor_item(it)
			u.icone.texture = icone_tex(m.P.icone_item(it))
			u.icone.modulate = c
			u.painel.add_theme_stylebox_override("panel", caixa(Color(0.09, 0.075, 0.055, 1), OURO_CLARO if escolhido else c.darkened(0.15), 2 if escolhido else 1, 8))
		else:
			u.icone.texture = icone_tex("basico" if id == "arma" and boneco_modo == "Espada" else "magia" if id == "arma" else "eq_" + id)
			u.icone.modulate = Color(0.85, 0.75, 0.55, 0.45 if id == "arma" else 0.25)
			u.painel.add_theme_stylebox_override("panel", caixa(Color(0.05, 0.045, 0.04, 1), OURO_CLARO if escolhido else BORDA, 2 if escolhido else 1, 8))

func tocar_slot(id: String) -> void:
	var l := lugar_de(id)
	sel_mochila = -1
	sel_equip = "" if sel_equip == l else l
	if aba != "mochila":
		aba = "mochila"
	atualizar()

func montar_palco() -> void:
	var cam := Camera3D.new()
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
	boneco = m.modelo("ruiva")
	boneco.get_parent().remove_child(boneco)
	vp.add_child(boneco)
	boneco.position = Vector3.ZERO
	boneco_anim = boneco.find_child("AnimationPlayer", true, false)
	esp = m.nova_arma("espada")
	caj = m.nova_arma("cajado")

func armar_boneco() -> void:
	if boneco_modo == m.h.modo:
		return
	boneco_modo = m.h.modo
	var esq: Skeleton3D = m.esqueleto(boneco)
	var L: Dictionary = m.armas_lugar.ruiva
	m.prender(esq, esp, L.espadaMao if boneco_modo == "Espada" else L.espadaCostas)
	m.prender(esq, caj, L.cajadoCostas if boneco_modo == "Espada" else L.get("cajadoMao", L.cajadoCostas))
	boneco_anim.play("espada_parada" if boneco_modo == "Espada" else "parada", 0.2)
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
	for a in [["status", "Status"], ["habilidades", "Habilidades"], ["mochila", "Mochila"], ["profissoes", "Profissões"], ["loja", "Loja"]]:
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
	var fundo := PanelContainer.new()
	fundo.size_flags_vertical = Control.SIZE_EXPAND_FILL
	fundo.add_theme_stylebox_override("panel", caixa(Color(0.055, 0.048, 0.04, 1), Color(0.24, 0.2, 0.14), 1, 8))
	rolagem = ScrollContainer.new()
	rolagem.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	rolagem.size_flags_vertical = Control.SIZE_EXPAND_FILL
	fundo.add_child(rolagem)
	conteudo = VBoxContainer.new()
	conteudo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	conteudo.add_theme_constant_override("separation", 8)
	rolagem.add_child(conteudo)
	col.add_child(fundo)
	return col

func trocar_aba(a: String) -> void:
	aba = a
	atualizar()
	rolagem.scroll_vertical = 0

func trocar_sub_prof(k: String) -> void:
	sub_prof = k
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
	elif aba == "loja":
		aba = "status"
	sel_mochila = -1
	sel_equip = ""
	raiz.visible = true
	m.hud.bloqueado = true
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	boneco_modo = ""
	atualizar()

func fechar() -> void:
	raiz.visible = false
	m.hud.bloqueado = false
	vp.render_target_update_mode = SubViewport.UPDATE_DISABLED

func aberto() -> bool:
	return raiz != null and raiz.visible

# rolar a lista arrastando o dedo (em cima de qualquer coisa: linha, botão, texto)
func _input(ev: InputEvent) -> void:
	if not aberto() or rolagem == null:
		return
	if ev is InputEventScreenTouch:
		if ev.pressed:
			_arrasto_dentro = rolagem.get_global_rect().has_point(ev.position)
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
		rolagem.scroll_vertical -= int(round(ev.relative.y))
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
	for k in botoes_aba:
		estilo_botao(botoes_aba[k], k == aba)
	botoes_aba.loja.visible = m.perto_da_loja()
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
	elif aba == "profissoes":
		if sub_prof == "lista":
			montar_profissoes()
		else:
			montar_receitas(sub_prof)
	else:
		montar_habilidades()
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
	separador("Atributos")
	conteudo.add_child(rotulo("Pontos livres: %d" % p.pontos, 15, VERDE if p.pontos > 0 else APAGADO))
	for k in ["for", "des", "int", "vit"]:
		var a: Dictionary = P.dados.atributos[k]
		var linha := HBoxContainer.new()
		linha.add_theme_constant_override("separation", 10)
		var txt := VBoxContainer.new()
		txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		txt.add_theme_constant_override("separation", 0)
		txt.add_child(rotulo(a.nome, 16, TEXTO))
		var d := rotulo(a.desc, 12, APAGADO)
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		txt.add_child(d)
		linha.add_child(txt)
		var v := rotulo(str(p.atr[k]), 20, OURO_CLARO)
		v.custom_minimum_size = Vector2(36, 0)
		v.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
		linha.add_child(v)
		var mais := botao("+", func(): distribuir(k), 20, p.pontos > 0)
		mais.custom_minimum_size = Vector2(44, 40)
		mais.disabled = p.pontos <= 0
		linha.add_child(mais)
		conteudo.add_child(linha)
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
		["Recarga", "-%s%%" % P.num(st.recarga * 100, 0)], ["Regeneração", "%s vida/s · %s mana/s" % [P.num(st.regenVida, 1), P.num(st.regenMana, 1)]],
		["Estamina", "%d / %d" % [floor(m.trabalho.sta), m.trabalho.sta_max()]], ["Vigor", "%d / %d" % [floor(P.vigor()), int(P.dados.vigor.max)]],
		["Ouro", str(int(p.ouro))],
	]
	for it in itens:
		var c := HBoxContainer.new()
		c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var n := rotulo(it[0], 14, APAGADO)
		n.custom_minimum_size = Vector2(110, 0)
		c.add_child(n)
		c.add_child(rotulo(it[1], 14, TEXTO))
		g.add_child(c)
	conteudo.add_child(g)

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
	if livre and not base.get("basico", false):
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
const ICONE_PROF := {"min": "pf_min", "len": "pf_len", "fer": "pf_fer", "alf": "pf_alf", "mer": "pf_mer"}
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
	ic.modulate = cor
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
	var st := rotulo(("Você está %s: dá para criar." % of.onde) if aqui else ("Para criar, vá %s." % str(of.onde).replace("na ", "até a ")), 13, VERDE if aqui else APAGADO)
	st.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	conteudo.add_child(st)
	separador("Receitas · %s Nv %d" % [P.dados.profissoes[prof].nome, P.prof_nivel(prof)])
	for r in P.dados.receitas:
		var R: Dictionary = P.dados.receitas[r]
		if R.prof == prof:
			conteudo.add_child(linha_receita(r, R, aqui))

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
		ic.modulate = P.cor_item({"k": k})
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
	l.add_child(b)
	return cx

func criar(r: String) -> void:
	if not m.on():
		m.hud.aviso("Criar só funciona online (a peça fica na sua conta)")
		return
	m.rede("criar", {"r": r})

# ---------- mochila e loja ----------
func linha_ouro() -> Control:
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 6)
	var ic := TextureRect.new()
	ic.texture = icone_tex("it_ouro")
	ic.custom_minimum_size = Vector2(22, 22)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.modulate = Color("ffd36a")
	ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(ic)
	l.add_child(rotulo("%d de ouro" % int(m.P.prog.ouro), 16, Color("ffd36a")))
	return l

# quadradinho de item: moldura e ícone na cor da raridade, quantidade no canto
func celula(it, escolhido: bool, fn: Callable, tam := 56) -> Button:
	var P = m.P
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(tam, tam)
	var cor: Color = P.cor_item(it) if it != null else BORDA
	var est := caixa(Color(0.15, 0.12, 0.08, 1) if escolhido else Color(0.05, 0.045, 0.04, 1), OURO_CLARO if escolhido else (cor.darkened(0.25) if it != null else Color(0.22, 0.18, 0.13)), 2 if escolhido else 1, 7)
	for e in ["normal", "hover", "pressed"]:
		b.add_theme_stylebox_override(e, est)
	if it != null:
		var ic := TextureRect.new()
		ic.texture = icone_tex(P.icone_item(it))
		ic.set_anchors_preset(Control.PRESET_FULL_RECT)
		ic.offset_left = tam * 0.17
		ic.offset_top = tam * 0.17
		ic.offset_right = -tam * 0.17
		ic.offset_bottom = -tam * 0.17
		ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ic.modulate = cor
		ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
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
	conteudo.add_child(topo)
	var g := GridContainer.new()
	g.columns = 8
	g.add_theme_constant_override("h_separation", 6)
	g.add_theme_constant_override("v_separation", 6)
	for i in P.prog.mochila.size():
		g.add_child(celula(P.prog.mochila[i], i == sel_mochila, func(): tocar_mochila(i)))
	conteudo.add_child(g)
	if sel_mochila >= 0 and P.prog.mochila[sel_mochila] != null:
		conteudo.add_child(detalhe(P.prog.mochila[sel_mochila], sel_mochila, ""))
	elif sel_equip != "" and P.prog.equip.get(sel_equip) != null:
		conteudo.add_child(detalhe(P.prog.equip[sel_equip], -1, sel_equip))
	else:
		var d := rotulo("Toque num item para ver o que ele faz. Toque num lugar do corpo (à esquerda) para ver a peça e tirar.", 12, APAGADO)
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		conteudo.add_child(d)
	montar_conjunto()

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

func tocar_mochila(i: int) -> void:
	sel_equip = ""
	sel_mochila = -1 if sel_mochila == i or m.P.prog.mochila[i] == null else i
	atualizar()

# cartão do item escolhido: nome na cor da raridade, o que faz, comparação com a peça do corpo e os botões
func detalhe(it, i: int, lugar: String) -> Control:
	var P = m.P
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1), P.cor_item(it).darkened(0.3), 1, 8))
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 12)
	cx.add_child(l)
	var c := celula(it, false, func(): pass, 60)
	c.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	l.add_child(c)
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.add_theme_constant_override("separation", 2)
	txt.add_child(rotulo(P.nome_item(it), 17, P.cor_item(it)))
	var tipo := ""
	if P.eh_equip(it):
		var lg: String = P.dados.itens[it.k].lugar
		tipo = {"cabeca": "Cabeça", "corpo": "Corpo", "capa": "Capa", "pes": "Pés", "acessorio": "Acessório", "espada": "Arma · espada", "cajado": "Arma · cajado"}[lg]
		tipo += " · No corpo" if lugar != "" else ""
	elif it.k == "tomo":
		tipo = "Tomo de %s" % P.habs[it.h].nome
	elif P.eh_mat(it):
		tipo = "Material · %d" % int(it.n)
	else:
		tipo = "Consumível · %d" % int(it.n)
	txt.add_child(rotulo(tipo, 12, APAGADO))
	var d := rotulo(P.texto_item(it), 14, TEXTO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	txt.add_child(d)
	if P.eh_equip(it) and lugar == "":
		var atual = P.prog.equip.get(P.dados.itens[it.k].lugar)
		txt.add_child(rotulo(("No corpo: %s (%s)" % [P.nome_item(atual), P.texto_item(atual)]) if atual != null else "Lugar vazio no corpo", 12, APAGADO))
	var bs := HBoxContainer.new()
	bs.add_theme_constant_override("separation", 8)
	if lugar != "":
		bs.add_child(botao_acao("Tirar", {"acao": "tirar", "lugar": lugar}))
	elif P.eh_equip(it):
		bs.add_child(botao_acao("Equipar", {"acao": "equipar", "i": i}))
	elif not P.eh_mat(it):
		bs.add_child(botao_acao("Usar", {"acao": "usar", "i": i}))
	if i >= 0 and m.perto_da_loja():
		bs.add_child(botao_acao("Vender · %d" % P.preco_venda(it), {"acao": "vender", "i": i}, false))
	txt.add_child(bs)
	l.add_child(txt)
	return cx

func botao_acao(t: String, msg: Dictionary, ativo := true) -> Button:
	var b := botao(t, func(): acao_item(msg), 14, ativo)
	b.custom_minimum_size = Vector2(120, 36)
	return b

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
		var b := botao("Comprar · %d" % preco, func(): acao_item({"acao": "comprar", "i": i}), 14, pode)
		b.custom_minimum_size = Vector2(140, 40)
		b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		b.disabled = not pode
		l.add_child(b)
		conteudo.add_child(l)

# online o servidor confere e devolve a mochila nova; sem internet muda só neste celular (a loja só funciona online)
func acao_item(msg: Dictionary) -> void:
	var P = m.P
	var i: int = msg.get("i", -1)
	if msg.acao == "usar" and i >= 0 and P.prog.mochila[i] != null and P.prog.mochila[i].k != "tomo":
		if not m.usar_pocao(P.prog.mochila[i]): # vida/mana cheia: nem gasta
			return
	if msg.acao in ["equipar", "tirar", "vender"]:
		sel_mochila = -1
		sel_equip = ""
	if m.on():
		m.rede("item", msg)
		return
	match msg.acao:
		"equipar":
			P.equipar(i)
		"tirar":
			var r: String = P.tirar(msg.lugar)
			if r != "":
				m.hud.aviso(r)
		"usar":
			var it = P.prog.mochila[i]
			if it.k == "tomo":
				m.hud.aviso(P.usar_tomo(i))
			else:
				P.gastar(i)
			if P.prog.mochila[i] == null:
				sel_mochila = -1
		"vender", "comprar":
			m.hud.aviso("A loja só funciona online (o ouro fica na sua conta)")
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

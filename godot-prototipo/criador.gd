extends CanvasLayer
# Criador de personagem (igual ao do site: client/src/criador.js e palco.js). A base é sempre a Ruiva (pedido do André:
# "mantém a ruiva"); muda a cor do cabelo, dos olhos, da pele, da roupa e da calça, a altura e o tamanho dos olhos,
# do nariz e da boca. O herói fica num palco só dele (mundo 3D próprio, fora do mapa): tablado de pedra com círculo
# mágico aceso, céu de fim de tarde, pontinhos de luz subindo. Faz poses de vez em quando e gira com o dedo.
# Mexendo no rosto a câmera chega perto da cabeça.
# Dois jeitos de abrir: conta nova (com nome; "Pronto" grava de vez) e o botão Aparência do menu do personagem
# (sem nome; "Salvar" muda só a aparência).
# Corpo (pedido do André, 2026-11-03): no alto do painel, os rostos dos outros corpos do jogo para escolher, sem nome,
# incluindo os masculinos (lista CRIADOR.corpos em shared/dados.js; a Ruiva continua o padrão). O servidor grava o corpo.

const Aparencia = preload("res://aparencia.gd")
const Armadura = preload("res://armadura.gd")
const Menu = preload("res://menu.gd")

const OURO := Color(0.80, 0.64, 0.36)
const OURO_CLARO := Color(0.95, 0.82, 0.55)
const TEXTO := Color(0.93, 0.89, 0.80)
const APAGADO := Color(0.72, 0.68, 0.60)
const FUNDO := Color(0.075, 0.065, 0.055, 0.94)
const PAINEL_L := 400.0 # largura do painel da direita (o herói fica no meio do que sobra)
const NOMES := {"cabelo": "Cabelo", "olhos": "Olhos", "pele": "Pele", "roupa": "Roupa", "calca": "Calça e saia"}
const ROSTO_NOMES := {"olhosT": "Olhos", "narizT": "Nariz", "bocaT": "Boca"}
# poses entre um descanso e outro (arma na mão para mostrar o conjunto), como no palco do site
const POSES := [{"anim": "espada_parada", "modo": "Espada", "dur": 2.6}, {"anim": "cura", "modo": "Magia"}, {"anim": "bloqueio", "modo": "Espada"},
	{"anim": "raio", "modo": "Magia"}, {"anim": "onda", "modo": "Magia"}]
const DESCANSO := 4.5

const SH_CEU := """
shader_type sky;
float h(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void sky() {
	vec3 d = EYEDIR;
	float y = d.y;
	vec3 alto = vec3(.05, .08, .22), meio = vec3(.22, .22, .5), baixo = vec3(.98, .62, .42);
	vec3 c = mix(meio, alto, smoothstep(.05, .75, y));
	c = mix(baixo, c, smoothstep(-.12, .3, y));
	vec2 g = floor(vec2(atan(d.z, d.x) * 90., y * 90.));
	c += step(.9965, h(g)) * smoothstep(.25, .7, y) * .8;
	COLOR = pow(c, vec3(2.2));
}
"""
const SH_NEVOA := """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;
void fragment() {
	float r = length(UV - 0.5) * 60.0;
	float a = smoothstep(2.6, 4.5, r) * (1. - smoothstep(14., 30., r));
	ALBEDO = pow(mix(vec3(.62, .58, .85), vec3(.98, .78, .6), smoothstep(6., 22., r)), vec3(2.2));
	ALPHA = a * .85;
}
"""

var m # main.gd
var criador: Dictionary # faixas e cores (dados/habilidades.json "criador")
var raiz: Control
var vp: SubViewport
var cam: Camera3D
var boneco: Node3D
var anim: AnimationPlayer
var esq: Skeleton3D
var esp: Node3D
var caj: Node3D
var circulo: Node3D
var cabeca := -1
var ap := {}
var nome_edit: LineEdit
var erro: Label
var titulo: Label
var sub: Label
var b_pronto: Button
var b_cancelar: Button
var linha_nome: Control
var cores_ui := {} # parte -> [[botão, cor]]
var originais := {} # parte -> botão Original
var faixas := {} # chave -> HSlider
var rolagem: ScrollContainer
var _ao_concluir: Callable
var _ao_mudar: Callable
var _criacao := false
var _marcando := false
var giro := 0.0
var rosto := false # câmera perto do rosto
var _rosto_t := 0.0
var t := 0.0
var proxima := 2.5
var pose = null
var i_pose := 0
var alvo := Vector3(0, 1.0, 0)
var dist := 4.1
var alt := 0.4
var _arrastou := false
var _arrasto_dentro := false
var _arrasto_soma := 0.0
var corpo := "ruiva" # corpo escolhido (CRIADOR.corpos)
var corpos_ui := {} # corpo -> botão com o rosto
var _boneco_de := "" # corpo que está no palco agora
static var _rostos := {} # corpo -> ImageTexture do rosto (feito uma vez por partida)

func _init(principal) -> void:
	m = principal
	layer = 22
	criador = m.P.dados.criador

func _ready() -> void:
	raiz = Control.new()
	raiz.set_anchors_preset(Control.PRESET_FULL_RECT)
	raiz.visible = false
	add_child(raiz)
	var palco := SubViewportContainer.new()
	palco.stretch = true
	palco.set_anchors_preset(Control.PRESET_FULL_RECT)
	palco.mouse_filter = Control.MOUSE_FILTER_STOP
	palco.gui_input.connect(_girar)
	vp = SubViewport.new()
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_2X
	vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	palco.add_child(vp)
	raiz.add_child(palco)
	montar_palco()
	raiz.add_child(montar_painel())

# ---------- palco ----------
func montar_palco() -> void:
	cam = Camera3D.new()
	cam.fov = 36
	cam.near = 0.05
	cam.far = 120
	vp.add_child(cam)
	var amb := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	var ceu := Sky.new()
	var mc := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = SH_CEU
	mc.shader = sh
	ceu.sky_material = mc
	env.sky = ceu
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.5, 0.47, 0.56)
	env.ambient_light_energy = 0.6
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 0.85
	env.fog_enabled = true
	env.fog_light_color = Color(0.29, 0.31, 0.53)
	env.fog_density = 0.01
	env.fog_sky_affect = 0.0
	amb.environment = env
	vp.add_child(amb)
	# luz principal quente de frente, uns 40° de lado (o rosto ganha um lado de meia-sombra) e contraluz azul recortando
	var sol := DirectionalLight3D.new()
	sol.light_color = Color(1.0, 0.93, 0.82)
	sol.light_energy = 0.75
	sol.shadow_enabled = true
	sol.directional_shadow_max_distance = 12.0
	sol.look_at_from_position(Vector3(3.6, 5, 4.3), Vector3.ZERO)
	vp.add_child(sol)
	var contra := DirectionalLight3D.new()
	contra.light_color = Color(0.56, 0.7, 1.0)
	contra.light_energy = 0.6
	contra.look_at_from_position(Vector3(-3, 3, -4), Vector3.ZERO)
	vp.add_child(contra)
	# tablado redondo de pedra (textura pintada da praça) com degrau e aro dourado
	var pedra := StandardMaterial3D.new()
	pedra.albedo_texture = load("res://modelos/cobblestone_floor_01.jpg")
	pedra.albedo_color = Color(0.5, 0.47, 0.56)
	pedra.uv1_triplanar = true
	pedra.uv1_scale = Vector3(0.7, 0.7, 0.7)
	pedra.roughness = 0.95
	pedra.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	pedra.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	var lado := pedra.duplicate()
	lado.albedo_texture = load("res://modelos/stony_dirt_path.jpg")
	lado.albedo_color = Color(0.42, 0.4, 0.48)
	for d in [[2.2, 2.35, 0.35, -0.175, pedra], [2.75, 2.9, 0.18, -0.44, lado]]:
		var mi := MeshInstance3D.new()
		var c := CylinderMesh.new()
		c.top_radius = d[0]
		c.bottom_radius = d[1]
		c.height = d[2]
		c.radial_segments = 64
		mi.mesh = c
		mi.material_override = d[4]
		mi.position.y = d[3]
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		vp.add_child(mi)
	var aro := MeshInstance3D.new()
	var tor := TorusMesh.new()
	tor.inner_radius = 2.205
	tor.outer_radius = 2.275
	tor.rings = 96
	aro.mesh = tor
	var ouro := StandardMaterial3D.new()
	ouro.albedo_color = Color(0.85, 0.7, 0.35)
	ouro.metallic = 0.8
	ouro.roughness = 0.35
	ouro.emission_enabled = true
	ouro.emission = Color(0.23, 0.16, 0.03)
	aro.material_override = ouro
	aro.scale.y = 0.5
	vp.add_child(aro)
	# círculo mágico aceso no chão, girando devagar (o mesmo das magias)
	circulo = m.fx.circulo_malha(true)
	circulo.get_parent().remove_child(circulo)
	vp.add_child(circulo)
	circulo.scale = Vector3.ONE * 1.8
	circulo.position.y = 0.012
	m.fx.circulo_definir(circulo, "8cc4ff", 0.5)
	# névoa baixa em volta (o palco "flutua")
	var nevoa := MeshInstance3D.new()
	var pl := PlaneMesh.new()
	pl.size = Vector2(60, 60)
	nevoa.mesh = pl
	var mn := ShaderMaterial.new()
	var shn := Shader.new()
	shn.code = SH_NEVOA
	mn.shader = shn
	nevoa.material_override = mn
	nevoa.position.y = -0.7
	nevoa.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	vp.add_child(nevoa)
	# pontinhos de luz subindo devagar em volta
	var luzes := CPUParticles3D.new()
	luzes.amount = 70
	luzes.lifetime = 14.0
	luzes.preprocess = 14.0
	luzes.emission_shape = CPUParticles3D.EMISSION_SHAPE_RING
	luzes.emission_ring_axis = Vector3.UP
	luzes.emission_ring_radius = 3.0
	luzes.emission_ring_inner_radius = 1.4
	luzes.emission_ring_height = 0.2
	luzes.direction = Vector3.UP
	luzes.spread = 12.0
	luzes.gravity = Vector3.ZERO
	luzes.initial_velocity_min = 0.14
	luzes.initial_velocity_max = 0.24
	var q := QuadMesh.new()
	q.size = Vector2(0.07, 0.07)
	var mq := StandardMaterial3D.new()
	mq.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mq.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mq.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mq.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	mq.no_depth_test = false
	mq.albedo_color = Color(1.0, 0.89, 0.66)
	var gt := GradientTexture2D.new()
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(1.0, 0.5)
	var gr := Gradient.new()
	gr.set_color(0, Color(1, 1, 1, 1))
	gr.set_color(1, Color(1, 1, 1, 0))
	gr.add_point(0.4, Color(1, 0.94, 0.78, 0.5))
	gt.gradient = gr
	mq.albedo_texture = gt
	q.material = mq
	luzes.mesh = q
	luzes.position.y = 0.1
	vp.add_child(luzes)
	# a Ruiva (ou o corpo escolhido) no meio do tablado
	esp = m.nova_arma("espada")
	caj = m.nova_arma("cajado")
	montar_boneco("ruiva")

# põe no tablado o corpo escolhido (troca o que estava lá), com a espada e o cajado presos na mão dele
func montar_boneco(id: String) -> void:
	if id == _boneco_de and boneco != null:
		return
	var ry := 0.0
	if boneco != null:
		ry = boneco.rotation.y
		for a in [esp, caj]:
			if a.get_parent():
				a.get_parent().remove_child(a)
		boneco.queue_free()
	_boneco_de = id
	boneco = m.modelo(id)
	boneco.get_parent().remove_child(boneco)
	vp.add_child(boneco)
	boneco.rotation.y = ry
	anim = boneco.find_child("AnimationPlayer", true, false)
	esq = m.esqueleto(boneco)
	# André 2026-11-03: a prévia usa o mesmo corpo do jogo (cintura fina e roupa de baixo branca), sem armadura
	Armadura.vestir(boneco, {})
	cabeca = -1
	for i in esq.get_bone_count():
		var n := esq.get_bone_name(i)
		if n.ends_with("_Head") or n == "Head" or n == "head":
			cabeca = i
	var L: Dictionary = m.lugar_armas(id)
	m.prender(esq, esp, L.espadaMao)
	m.prender(esq, caj, L.get("cajadoMao", L.cajadoCostas))
	mostrar_armas("")
	pose = null
	proxima = 1.5
	anim.play("parada")

func mostrar_armas(modo: String) -> void:
	esp.visible = modo == "Espada"
	caj.visible = modo == "Magia"

# ---------- painel da direita ----------
func montar_painel() -> Control:
	var p := Panel.new()
	p.anchor_left = 1.0
	p.anchor_right = 1.0
	p.anchor_bottom = 1.0
	p.offset_left = -PAINEL_L - 12
	p.offset_right = -12
	p.offset_top = 12
	p.offset_bottom = -12
	p.add_theme_stylebox_override("panel", Menu.caixa(FUNDO, OURO.darkened(0.25), 2, 10, 14))
	var col := VBoxContainer.new()
	col.set_anchors_preset(Control.PRESET_FULL_RECT)
	col.offset_left = 16
	col.offset_right = -16
	col.offset_top = 12
	col.offset_bottom = -12
	col.add_theme_constant_override("separation", 6)
	p.add_child(col)
	titulo = Menu.rotulo("CRIAR PERSONAGEM", 13, OURO)
	col.add_child(titulo)
	sub = Menu.rotulo("", 13, APAGADO)
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(sub)
	rolagem = ScrollContainer.new()
	rolagem.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	rolagem.size_flags_vertical = Control.SIZE_EXPAND_FILL
	col.add_child(rolagem)
	var lista := VBoxContainer.new()
	lista.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lista.add_theme_constant_override("separation", 6)
	rolagem.add_child(lista)
	# nome (só na conta nova)
	var ln := VBoxContainer.new()
	ln.add_theme_constant_override("separation", 4)
	ln.add_child(Menu.rotulo("Nome", 15, OURO_CLARO))
	nome_edit = LineEdit.new()
	nome_edit.max_length = int(m.P.dados.nome.max)
	nome_edit.placeholder_text = "Nome do personagem"
	nome_edit.add_theme_font_size_override("font_size", 17)
	nome_edit.add_theme_stylebox_override("normal", Menu.caixa(Color(0.05, 0.045, 0.04), Color(0.42, 0.33, 0.2), 1, 6))
	nome_edit.add_theme_stylebox_override("focus", Menu.caixa(Color(0.05, 0.045, 0.04), OURO, 1, 6))
	nome_edit.add_theme_color_override("font_color", TEXTO)
	nome_edit.custom_minimum_size.y = 40
	nome_edit.text_changed.connect(func(_t): erro.text = "")
	ln.add_child(nome_edit)
	linha_nome = ln
	lista.add_child(ln)
	# corpo: rostos redondos, sem nome (a Ruiva primeiro, depois os masculinos e os outros)
	lista.add_child(Menu.rotulo("Corpo", 15, OURO_CLARO))
	var fc := HFlowContainer.new()
	fc.add_theme_constant_override("h_separation", 8)
	fc.add_theme_constant_override("v_separation", 8)
	for id in criador.get("corpos", ["ruiva"]):
		if not ResourceLoader.exists("res://modelos/%s.glb" % id):
			continue
		fc.add_child(botao_corpo(str(id)))
	lista.add_child(fc)
	for k in Aparencia.CORES:
		var cab := HBoxContainer.new()
		var rt := Menu.rotulo(NOMES[k], 15, OURO_CLARO)
		rt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		cab.add_child(rt)
		# volta para a cor da Ruiva (fica aceso quando é a original)
		var orig := Button.new()
		orig.text = "Original"
		orig.icon = load("res://icones/desfazer.svg")
		orig.expand_icon = false
		orig.add_theme_constant_override("icon_max_width", 16)
		orig.focus_mode = Control.FOCUS_NONE
		orig.add_theme_font_size_override("font_size", 13)
		orig.custom_minimum_size = Vector2(104, 30)
		orig.pressed.connect(func():
			if _arrastou:
				return
			ap[k] = null
			rosto = false
			mudou())
		cab.add_child(orig)
		lista.add_child(cab)
		originais[k] = orig
		var fl := HFlowContainer.new()
		fl.add_theme_constant_override("h_separation", 6)
		fl.add_theme_constant_override("v_separation", 6)
		cores_ui[k] = []
		for c in criador[k]:
			if c == null:
				continue # a original fica no botão Original
			var b := Button.new()
			b.focus_mode = Control.FOCUS_NONE
			b.custom_minimum_size = Vector2(34, 34)
			var cor = int(c)
			b.pressed.connect(func():
				if _arrastou:
					return
				ap[k] = cor
				rosto = false
				mudou())
			cores_ui[k].append([b, cor])
			fl.add_child(b)
		lista.add_child(fl)
	lista.add_child(Menu.rotulo("Altura", 15, OURO_CLARO))
	lista.add_child(faixa("altura", float(criador.altura[0]), float(criador.altura[1]), "Baixa", "Alta"))
	lista.add_child(Menu.rotulo("Rosto", 15, OURO_CLARO))
	for k in Aparencia.ROSTO:
		var r: Array = criador.rosto[k]
		var h := HBoxContainer.new()
		var l := Menu.rotulo(ROSTO_NOMES[k], 14, TEXTO)
		l.custom_minimum_size.x = 60
		h.add_child(l)
		var f := faixa(k, float(r[0]), float(r[1]), "", "")
		f.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		h.add_child(f)
		lista.add_child(h)
	erro = Menu.rotulo("", 13, Color(1.0, 0.55, 0.45))
	erro.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(erro)
	var baixo := HBoxContainer.new()
	baixo.add_theme_constant_override("separation", 8)
	var sorte := botao("Sortear", false, sortear)
	sorte.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	baixo.add_child(sorte)
	b_cancelar = botao("Cancelar", false, cancelar)
	b_cancelar.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	baixo.add_child(b_cancelar)
	b_pronto = botao("Pronto", true, pronto)
	b_pronto.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	baixo.add_child(b_pronto)
	col.add_child(baixo)
	return p

# botão redondo com o rosto do corpo (sem nome); aceso com aro dourado quando é o escolhido
func botao_corpo(id: String) -> Control:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(66, 66)
	b.flat = true
	var vazio := StyleBoxEmpty.new()
	for st in ["normal", "hover", "pressed", "focus"]:
		b.add_theme_stylebox_override(st, vazio)
	var foto := TextureRect.new()
	foto.set_anchors_preset(Control.PRESET_FULL_RECT)
	foto.offset_left = 3
	foto.offset_top = 3
	foto.offset_right = -3
	foto.offset_bottom = -3
	foto.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	foto.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	foto.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sh := Shader.new()
	sh.code = "shader_type canvas_item;\nvoid fragment(){ vec4 c = texture(TEXTURE, UV); float r = length(UV - vec2(0.5)); COLOR = vec4(c.rgb, c.a * (1.0 - smoothstep(0.47, 0.49, r))); }"
	var mat := ShaderMaterial.new()
	mat.shader = sh
	foto.material = mat
	b.add_child(foto)
	var aro := Panel.new()
	aro.set_anchors_preset(Control.PRESET_FULL_RECT)
	aro.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(aro)
	b.pressed.connect(func():
		if _arrastou:
			return
		corpo = id
		rosto = false
		montar_boneco(id)
		mudou())
	corpos_ui[id] = {"botao": b, "foto": foto, "aro": aro}
	return b

# rostos dos corpos para os botões: cada um num palco pequeno, desenhado uma vez e guardado como imagem
func fazer_rostos() -> void:
	for id in corpos_ui:
		if _rostos.has(id):
			corpos_ui[id].foto.texture = _rostos[id]
	for id in corpos_ui:
		if _rostos.has(id):
			continue
		var vp2 := SubViewport.new()
		vp2.size = Vector2i(128, 128)
		vp2.own_world_3d = true
		vp2.msaa_3d = Viewport.MSAA_4X
		vp2.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		add_child(vp2)
		var amb := WorldEnvironment.new()
		var env := Environment.new()
		env.background_mode = Environment.BG_COLOR
		env.background_color = Color(0.16, 0.13, 0.1)
		env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
		env.ambient_light_color = Color(0.85, 0.8, 0.72)
		env.ambient_light_energy = 0.7
		env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
		amb.environment = env
		vp2.add_child(amb)
		var luz := DirectionalLight3D.new()
		luz.light_energy = 1.1
		luz.rotation = Vector3(-0.5, 0.5, 0)
		vp2.add_child(luz)
		var c: Node3D = m.modelo(id)
		c.get_parent().remove_child(c)
		vp2.add_child(c)
		var cab := Vector3(0, 1.45, 0)
		var sk: Skeleton3D = m.esqueleto(c)
		if sk:
			for i in sk.get_bone_count():
				var nb := sk.get_bone_name(i).to_lower()
				if nb.ends_with("head"):
					cab = sk.get_bone_global_rest(i).origin
					break
		var cm := Camera3D.new()
		cm.fov = 30.0
		vp2.add_child(cm)
		cm.look_at_from_position(cab + Vector3(0.12, 0.03, 0.75), cab + Vector3(0, -0.01, 0))
		await RenderingServer.frame_post_draw
		await RenderingServer.frame_post_draw
		if not is_instance_valid(vp2):
			return
		var img := vp2.get_texture().get_image()
		vp2.queue_free()
		if img == null:
			continue
		_rostos[id] = ImageTexture.create_from_image(img)
		if corpos_ui.has(id):
			corpos_ui[id].foto.texture = _rostos[id]

func botao(t: String, ativo: bool, fn: Callable) -> Button:
	var b := Button.new()
	b.text = t
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size.y = 44
	b.add_theme_font_size_override("font_size", 16)
	Menu.estilo_botao(b, ativo)
	b.pressed.connect(func():
		if not _arrastou:
			fn.call())
	return b

# faixa (altura e rosto): mexendo no rosto a câmera chega perto da cabeça
func faixa(k: String, lo: float, hi: float, _a: String, _b: String) -> Control:
	var s := HSlider.new()
	s.min_value = lo
	s.max_value = hi
	s.step = 0.01
	s.value = 1.0
	s.focus_mode = Control.FOCUS_NONE
	s.custom_minimum_size = Vector2(0, 34)
	var trilho := StyleBoxFlat.new()
	trilho.bg_color = Color(0.17, 0.148, 0.12)
	trilho.set_corner_radius_all(3)
	trilho.content_margin_top = 3
	trilho.content_margin_bottom = 3
	var cheio := trilho.duplicate()
	cheio.bg_color = OURO.darkened(0.2)
	s.add_theme_stylebox_override("slider", trilho)
	s.add_theme_stylebox_override("grabber_area", cheio)
	s.add_theme_stylebox_override("grabber_area_highlight", cheio)
	var g := GradientTexture2D.new()
	g.width = 22
	g.height = 22
	g.fill = GradientTexture2D.FILL_RADIAL
	g.fill_from = Vector2(0.5, 0.5)
	g.fill_to = Vector2(1.0, 0.5)
	var gr := Gradient.new()
	gr.offsets = PackedFloat32Array([0.0, 0.62, 0.72, 0.8])
	gr.colors = PackedColorArray([OURO_CLARO, OURO_CLARO, OURO.darkened(0.3), Color(0, 0, 0, 0)])
	g.gradient = gr
	s.add_theme_icon_override("grabber", g)
	s.add_theme_icon_override("grabber_highlight", g)
	s.value_changed.connect(func(v):
		if _marcando:
			return
		ap[k] = snappedf(v, 0.01)
		rosto = k != "altura"
		_rosto_t = 2.5
		mudou())
	faixas[k] = s
	return s

# ---------- abrir e fechar ----------
# conta nova: nome + aparência; ao_concluir(nome, aparencia). ao_mudar(aparencia) a cada toque (os outros veem na hora)
# (ao_concluir(nome, aparencia, corpo) e ao_mudar(aparencia, corpo): o corpo vai junto)
func abrir_criacao(nome: String, inicial, ao_concluir: Callable, ao_mudar := Callable(), corpo_inicial := "ruiva") -> void:
	_criacao = true
	nome_edit.text = nome
	corpo = corpo_inicial
	_abrir(inicial, ao_concluir, ao_mudar)

# botão Aparência do menu do personagem: aparência e corpo; ao_concluir(aparencia, corpo)
func abrir_edicao(inicial, ao_concluir: Callable, corpo_inicial := "ruiva") -> void:
	_criacao = false
	corpo = corpo_inicial
	_abrir(inicial, ao_concluir, Callable())

func _abrir(inicial, ao_concluir: Callable, ao_mudar: Callable) -> void:
	_ao_concluir = ao_concluir
	_ao_mudar = ao_mudar
	ap = Aparencia.valida(inicial, criador)
	linha_nome.visible = _criacao
	b_cancelar.visible = not _criacao
	b_pronto.text = "Pronto" if _criacao else "Salvar"
	titulo.text = "CRIAR PERSONAGEM" if _criacao else "APARÊNCIA"
	sub.text = "Escolha o corpo, as cores, a altura e o rosto. Dá para mudar depois no menu do personagem." if _criacao \
		else "Mude o corpo, as cores, a altura e o rosto. O nome continua o mesmo."
	erro.text = ""
	giro = 0.0
	rosto = false
	pose = null
	proxima = 2.5
	t = 0.0
	anim.play("parada")
	mostrar_armas("")
	raiz.visible = true
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	m.hud.bloqueado = true
	m.get_viewport().disable_3d = true # a vila fica escondida atrás do palco: não desenha (mais leve no celular)
	rolagem.scroll_vertical = 0
	if not corpos_ui.has(corpo):
		corpo = "ruiva"
	montar_boneco(corpo)
	anim.play("parada")
	marcar()
	Aparencia.aplicar(boneco, ap)
	_colocar_camera(1.0)
	fazer_rostos()

func fechar() -> void:
	raiz.visible = false
	vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	m.hud.bloqueado = false
	m.get_viewport().disable_3d = false
	nome_edit.release_focus()

func aberto() -> bool:
	return raiz != null and raiz.visible

func cancelar() -> void:
	fechar()

func pronto() -> void:
	if _criacao:
		var nome := valido(nome_edit.text)
		if nome == "":
			erro.text = "Dê um nome ao personagem: de %d a %d letras ou números." % [int(m.P.dados.nome.min), int(m.P.dados.nome.max)]
			nome_edit.grab_focus()
			return
		fechar()
		_ao_concluir.call(nome, ap.duplicate(), corpo)
	else:
		fechar()
		_ao_concluir.call(ap.duplicate(), corpo)

# igual a nomeValido (shared/dados.js): 3 a 16 letras, números ou espaços
func valido(n: String) -> String:
	var re := RegEx.create_from_string("\\s+")
	var s := re.sub(n, " ", true).strip_edges()
	var ok := RegEx.create_from_string("^[\\p{L}\\p{N} ]+$")
	if s.length() < int(m.P.dados.nome.min) or s.length() > int(m.P.dados.nome.max) or ok.search(s) == null:
		return ""
	return s

func sortear() -> void:
	for k in Aparencia.CORES:
		var l: Array = criador[k]
		ap[k] = int(l[1 + randi() % (l.size() - 1)]) # nunca a "original"
	var a: Array = criador.altura
	ap.altura = snappedf(randf_range(float(a[0]), float(a[1])), 0.01)
	for k in Aparencia.ROSTO:
		var r: Array = criador.rosto[k]
		ap[k] = snappedf(1.0 + (randf() - 0.5) * 0.6 * (float(r[1]) - float(r[0])), 0.01) # sem os extremos
	rosto = false
	mudou()

func mudou() -> void:
	ap = Aparencia.valida(ap, criador)
	marcar()
	Aparencia.aplicar(boneco, ap)
	if _ao_mudar.is_valid():
		_ao_mudar.call(ap.duplicate(), corpo)

func marcar() -> void:
	_marcando = true
	for k in cores_ui:
		for par in cores_ui[k]:
			var b: Button = par[0]
			var c = par[1]
			var on: bool = c == ap.get(k)
			var fundo := Aparencia._cor(c)
			var n := Menu.caixa(fundo, OURO_CLARO if on else Color(0.3, 0.25, 0.18), 3 if on else 1, 17)
			n.content_margin_left = 2
			n.content_margin_right = 2
			for s in ["normal", "hover", "pressed"]:
				b.add_theme_stylebox_override(s, n)
	for k in originais:
		Menu.estilo_botao(originais[k], ap.get(k) == null)
		originais[k].add_theme_color_override("icon_normal_color", OURO_CLARO if ap.get(k) == null else APAGADO)
	for k in faixas:
		faixas[k].value = float(ap.get(k, 1.0))
	for id in corpos_ui: # corpo escolhido: aro dourado grosso; os outros, aro fino apagado
		var on: bool = id == corpo
		var sa := StyleBoxFlat.new()
		sa.bg_color = Color(0, 0, 0, 0)
		sa.border_color = OURO_CLARO if on else Color(0.42, 0.33, 0.2)
		sa.set_border_width_all(3 if on else 1)
		sa.set_corner_radius_all(33)
		sa.anti_aliasing = true
		corpos_ui[id].aro.add_theme_stylebox_override("panel", sa)
		corpos_ui[id].foto.modulate = Color.WHITE if on else Color(0.82, 0.8, 0.76)
	_marcando = false

# ---------- quadro a quadro ----------
func _girar(ev: InputEvent) -> void:
	if ev is InputEventScreenDrag:
		giro += ev.relative.x * 0.012
	elif ev is InputEventMouseMotion and (ev.button_mask & MOUSE_BUTTON_MASK_LEFT):
		giro += ev.relative.x * 0.012

# rolar o painel arrastando o dedo (em cima de qualquer coisa), como no menu do personagem
func _input(ev: InputEvent) -> void:
	if not aberto():
		return
	if ev is InputEventScreenTouch:
		if ev.pressed:
			_arrasto_dentro = rolagem.get_global_rect().has_point(ev.position)
			_arrasto_soma = 0.0
			_arrastou = false
		else:
			_arrasto_dentro = false
			if _arrastou:
				(func(): _arrastou = false).call_deferred()
	elif ev is InputEventScreenDrag and _arrasto_dentro:
		if abs(ev.relative.y) < abs(ev.relative.x) and _arrasto_soma < 12.0:
			return # arrasto de lado: é a faixa (altura, rosto)
		_arrasto_soma += abs(ev.relative.y)
		if _arrasto_soma > 12.0:
			_arrastou = true
		rolagem.scroll_vertical -= int(round(ev.relative.y))
		get_viewport().set_input_as_handled()

func _process(dt: float) -> void:
	if not aberto():
		return
	t += dt
	if _rosto_t > 0.0:
		_rosto_t -= dt
		if _rosto_t <= 0.0:
			rosto = false
	# descansa, faz uma pose, volta a descansar; mexendo no rosto fica parada olhando para a câmera
	proxima -= dt
	if rosto and pose != null:
		descansar()
	elif not rosto and proxima <= 0.0:
		if pose != null:
			descansar()
		else:
			pose = POSES[i_pose % POSES.size()]
			i_pose += 1
			var a: String = pose.anim
			if anim.has_animation(a):
				anim.play(a, 0.12)
				proxima = float(pose.get("dur", anim.get_animation(a).length)) - 0.1
				mostrar_armas(pose.modo)
			else:
				proxima = 0.5
	boneco.rotation.y = lerp_angle(boneco.rotation.y, giro, min(1.0, dt * 10.0))
	circulo.rotation.y = t * 0.08
	m.fx.circulo_definir(circulo, "8cc4ff", 0.45 + sin(t * 1.6) * 0.08)
	_colocar_camera(min(1.0, dt * 5.0))

func descansar() -> void:
	pose = null
	proxima = DESCANSO
	anim.play("parada", 0.2)
	mostrar_armas("")

# câmera de frente; no rosto, chega perto da cabeça. O herói fica no meio do pedaço de tela que o painel não cobre
func _colocar_camera(k: float) -> void:
	var escala := boneco.scale.y
	var quer := Vector3(0, 0.85 * escala, 0)
	if rosto and cabeca >= 0:
		quer = (esq.global_transform * esq.get_bone_global_pose(cabeca)).origin + Vector3(0, 0.09, 0)
	alvo = alvo.lerp(quer, k)
	dist += ((0.95 if rosto else 3.8) - dist) * k
	alt += ((0.0 if rosto else 0.4) - alt) * k
	cam.position = Vector3(alvo.x, alvo.y + alt, alvo.z + dist)
	cam.look_at(alvo)
	var tela := raiz.get_viewport_rect().size
	var meia_altura := dist * tan(deg_to_rad(cam.fov * 0.5))
	cam.h_offset = (PAINEL_L + 12.0) / max(tela.x, 1.0) * meia_altura * tela.x / max(tela.y, 1.0)

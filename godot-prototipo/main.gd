extends Node3D
# Protótipo para comparar FPS com o jogo em HTML: mesma vila, mesmos 10 personagens anime (herói, bando e NPCs),
# grama balançando, sombra do sol e cabelo/roupa com mola. Toque em "Teste" para medir como no ?diag=1 do site.

const RAIO := 34.0
const RESOLUCAO_PADRAO := 0.6 # mesma nitidez do site (1.75x numa tela de ~904 pontos de largura)

# hero + bando + NPCs, nas mesmas posições do mapa do jogo (shared/dados.js)
const PERSONAGENS := [
	{"id": "ruiva", "x": 0.0, "z": 1.0, "papel": "heroi"},
	{"id": "cabelo_m", "x": 16.0, "z": 6.0, "papel": "bando"},
	{"id": "fumiriya", "x": 20.0, "z": -2.0, "papel": "bando"},
	{"id": "cabelo_m", "x": 14.0, "z": 0.0, "papel": "bando"},
	{"id": "fumiriya", "x": 22.0, "z": 3.0, "papel": "bando"},
	{"id": "fumiriya", "x": -6.0, "z": -18.6, "papel": "npc"},
	{"id": "shino", "x": -12.0, "z": -8.0, "papel": "npc"},
	{"id": "vivi", "x": 8.0, "z": -12.0, "papel": "npc"},
	{"id": "vita", "x": -4.0, "z": 9.0, "papel": "npc"},
	{"id": "victoria", "x": 6.0, "z": 6.0, "papel": "npc"},
]
const EXTRAS := ["shibu", "shibu_sombrio", "cabelo_m", "fumiriya", "shino", "vivi", "vita", "victoria", "cabelo_m", "fumiriya"]

var sol: DirectionalLight3D
var camera: Camera3D
var grama: MultiMeshInstance3D
var heroi: Node3D
var heroi_anim: AnimationPlayer
var corpos: Array = [] # {no, anim, papel, centro, ang, raio, vel}
var extras: Array = []
var yaw := 0.6
var pitch := 0.35
var dist := 5.0
var mover := Vector2.ZERO
var toque_mover := -1
var toque_cam := -1
var ini_mover := Vector2.ZERO
var rotulo: Label
var botao: Button
var cache := {}

# teste de desempenho
var etapas := []
var etapa := -1
var t_etapa := 0.0
var quadros := 0
var soma_proc := 0.0
var resultados := []
const ESPERA := 2.5
const MEDE := 5.0

func _ready() -> void:
	get_viewport().scaling_3d_scale = RESOLUCAO_PADRAO
	montar_ambiente()
	add_child(load("res://modelos/vila.glb").instantiate())
	montar_grama()
	for p in PERSONAGENS:
		criar_personagem(p.id, Vector3(p.x, 0, p.z), p.papel)
	camera = Camera3D.new()
	camera.fov = 52
	camera.far = 400
	add_child(camera)
	montar_hud()
	etapas = [
		{"nome": "Normal (0.6x, como o site)", "f": func(): pass},
		{"nome": "Resolução cheia 1.0x", "f": func(): get_viewport().scaling_3d_scale = 1.0},
		{"nome": "Resolução 0.3x", "f": func(): get_viewport().scaling_3d_scale = 0.3},
		{"nome": "Sem sombra", "f": func(): sol.shadow_enabled = false},
		{"nome": "Sem grama", "f": func(): grama.visible = false},
		{"nome": "Sem personagens", "f": func(): mostrar_personagens(false)},
		{"nome": "20 personagens (o dobro)", "f": func(): mostrar_extras(true)},
	]

func montar_ambiente() -> void:
	var ceu := PanoramaSkyMaterial.new()
	ceu.panorama = load("res://modelos/ceu.hdr")
	var sky := Sky.new()
	sky.sky_material = ceu
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 0.75
	env.fog_enabled = true
	env.fog_light_color = Color(0.77, 0.80, 0.82)
	env.fog_density = 0.0075
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.22 # cores mais vivas, como o passe de cor do site
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	sol = DirectionalLight3D.new()
	sol.light_color = Color(1.0, 0.94, 0.84)
	sol.light_energy = 1.7
	sol.shadow_enabled = true
	sol.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sol.directional_shadow_max_distance = 30.0
	sol.rotation = Vector3(deg_to_rad(-52), deg_to_rad(60), 0)
	add_child(sol)

func montar_grama() -> void:
	var m := PlaneMesh.new()
	m.size = Vector2(0.06, 0.3)
	m.orientation = PlaneMesh.FACE_Z
	m.subdivide_depth = 2
	m.center_offset = Vector3(0, 0.15, 0)
	var mat := ShaderMaterial.new()
	mat.shader = load("res://grama.gdshader")
	m.material = mat
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = m
	mm.instance_count = 22000 # mesma quantidade do celular no site
	var rng := RandomNumberGenerator.new()
	for i in mm.instance_count:
		var a := rng.randf() * TAU
		var r := sqrt(rng.randf()) * RAIO * 1.15
		var s := rng.randf_range(0.7, 1.3)
		var b := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s, s * rng.randf_range(0.6, 1.4), s))
		mm.set_instance_transform(i, Transform3D(b, Vector3(cos(a) * r, 0, sin(a) * r)))
		mm.set_instance_color(i, Color.from_hsv(rng.randf_range(0.22, 0.28), rng.randf_range(0.5, 0.7), rng.randf_range(0.8, 1.0)))
	grama = MultiMeshInstance3D.new()
	grama.multimesh = mm
	grama.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(grama)

func criar_personagem(id: String, pos: Vector3, papel: String) -> Dictionary:
	if not cache.has(id):
		cache[id] = load("res://modelos/%s.glb" % id)
	var no: Node3D = cache[id].instantiate()
	add_child(no)
	no.position = pos
	var anim: AnimationPlayer = no.find_child("AnimationPlayer", true, false)
	for nome in anim.get_animation_list():
		anim.get_animation(nome).loop_mode = Animation.LOOP_LINEAR
	anim.play("parada")
	molas(no)
	var c := {"no": no, "anim": anim, "papel": papel, "centro": pos, "ang": randf() * TAU, "raio": randf_range(2.0, 4.0), "vel": randf_range(0.8, 1.6)}
	if papel == "heroi":
		heroi = no
		heroi_anim = anim
	else:
		corpos.append(c)
	return c

# cabelo, saia e acessórios do VRoid (ossos J_Sec_...) balançam com mola, como as spring bones do site
func molas(no: Node) -> void:
	var esq: Skeleton3D = null
	for s in no.find_children("*", "Skeleton3D", true, false):
		esq = s
	if esq == null:
		return
	var cadeias := []
	for i in esq.get_bone_count():
		var nome := esq.get_bone_name(i)
		var pai := esq.get_bone_parent(i)
		if nome.begins_with("J_Sec_") and (pai < 0 or not esq.get_bone_name(pai).begins_with("J_Sec_")):
			var fim := i
			while true:
				var filhos := esq.get_bone_children(fim)
				if filhos.is_empty():
					break
				fim = filhos[0]
			if fim != i:
				cadeias.append([i, fim])
	if cadeias.is_empty():
		return
	var sim := SpringBoneSimulator3D.new()
	esq.add_child(sim)
	sim.setting_count = cadeias.size()
	for k in cadeias.size():
		sim.set_root_bone(k, cadeias[k][0])
		sim.set_end_bone(k, cadeias[k][1])
		sim.set_stiffness(k, 1.0)
		sim.set_drag(k, 0.4)
		sim.set_gravity(k, 0.0)

func mostrar_personagens(v: bool) -> void:
	heroi.visible = v
	for c in corpos:
		c.no.visible = v
		c.no.process_mode = Node.PROCESS_MODE_INHERIT if v else Node.PROCESS_MODE_DISABLED

func mostrar_extras(v: bool) -> void:
	if v and extras.is_empty():
		for i in EXTRAS.size():
			var a := TAU * i / EXTRAS.size()
			extras.append(criar_personagem(EXTRAS[i], Vector3(cos(a) * 10.0, 0, sin(a) * 10.0), "bando"))
	for c in extras:
		c.no.visible = v
		c.no.process_mode = Node.PROCESS_MODE_INHERIT if v else Node.PROCESS_MODE_DISABLED

func montar_hud() -> void:
	var tela := CanvasLayer.new()
	add_child(tela)
	var fundo := PanelContainer.new()
	fundo.position = Vector2(12, 12)
	var estilo := StyleBoxFlat.new()
	estilo.bg_color = Color(0.04, 0.06, 0.08, 0.85)
	estilo.set_corner_radius_all(8)
	estilo.set_content_margin_all(10)
	fundo.add_theme_stylebox_override("panel", estilo)
	tela.add_child(fundo)
	rotulo = Label.new()
	rotulo.add_theme_font_size_override("font_size", 18)
	fundo.add_child(rotulo)
	botao = Button.new()
	botao.text = "Teste"
	botao.add_theme_font_size_override("font_size", 26)
	botao.anchor_left = 1.0
	botao.anchor_right = 1.0
	botao.offset_left = -170
	botao.offset_right = -20
	botao.offset_top = 20
	botao.offset_bottom = 90
	botao.pressed.connect(comecar_teste)
	tela.add_child(botao)

func restaurar() -> void:
	get_viewport().scaling_3d_scale = RESOLUCAO_PADRAO
	sol.shadow_enabled = true
	grama.visible = true
	mostrar_personagens(true)
	mostrar_extras(false)

func comecar_teste() -> void:
	resultados.clear()
	botao.visible = false
	etapa = -1
	proxima_etapa()

func proxima_etapa() -> void:
	restaurar()
	etapa += 1
	if etapa >= etapas.size():
		etapa = -1
		botao.visible = true
		return
	etapas[etapa].f.call()
	t_etapa = 0.0
	quadros = 0
	soma_proc = 0.0

func _input(ev: InputEvent) -> void:
	var meio := get_viewport().get_visible_rect().size.x * 0.5
	if ev is InputEventScreenTouch:
		if ev.pressed:
			if ev.position.x < meio and toque_mover < 0:
				toque_mover = ev.index
				ini_mover = ev.position
			elif toque_cam < 0:
				toque_cam = ev.index
		else:
			if ev.index == toque_mover:
				toque_mover = -1
				mover = Vector2.ZERO
			if ev.index == toque_cam:
				toque_cam = -1
	elif ev is InputEventScreenDrag:
		if ev.index == toque_mover:
			mover = ((ev.position - ini_mover) / 80.0).limit_length(1.0)
		elif ev.index == toque_cam:
			yaw -= ev.relative.x * 0.006
			pitch = clamp(pitch + ev.relative.y * 0.004, -0.3, 1.1)

func _process(dt: float) -> void:
	# herói: joystick na metade esquerda da tela
	if mover.length() > 0.15:
		var dir := Vector3(mover.x, 0, mover.y).rotated(Vector3.UP, yaw)
		heroi.position += dir * 5.5 * mover.length() * dt
		heroi.rotation.y = atan2(dir.x, dir.z)
		if heroi_anim.current_animation != "corrida":
			heroi_anim.play("corrida", 0.2)
	elif heroi_anim.current_animation != "parada":
		heroi_anim.play("parada", 0.2)
	# bando anda em volta; NPCs ficam parados respirando
	for c in corpos + extras:
		if c.papel == "bando" and c.no.visible:
			c.ang += c.vel / c.raio * dt
			var p: Vector3 = c.centro + Vector3(cos(c.ang), 0, sin(c.ang)) * c.raio
			c.no.rotation.y = atan2(p.x - c.no.position.x, p.z - c.no.position.z)
			c.no.position = p
			if c.anim.current_animation != "andar":
				c.anim.play("andar")
	var alvo := heroi.position + Vector3(0, 1.35, 0)
	camera.position = alvo + Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * dist
	camera.look_at(alvo)
	sol.position = heroi.position

	var fps := Engine.get_frames_per_second()
	var proc := Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0
	var txt := "Godot · %d FPS · lógica %.1f ms" % [fps, proc]
	if etapa >= 0:
		t_etapa += dt
		if t_etapa > ESPERA:
			quadros += 1
			soma_proc += proc
		txt += "\nTestando %d/%d: %s…" % [etapa + 1, etapas.size(), etapas[etapa].nome]
		if t_etapa >= ESPERA + MEDE:
			resultados.append("%s: %.1f FPS · lógica %.1f ms" % [etapas[etapa].nome, quadros / MEDE, soma_proc / max(1, quadros)])
			proxima_etapa()
	if not resultados.is_empty():
		txt += "\n" + "\n".join(resultados)
		if etapa < 0:
			txt += "\nPronto! Tire um print e mande."
	rotulo.text = txt

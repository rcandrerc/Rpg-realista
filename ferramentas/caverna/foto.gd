extends SceneTree
# Fotos da Caverna da Montanha (caverna.gd) sem precisar dos modelos do jogo: só a montanha, a caverna e um boneco.
# Uso (PC sem placa: xvfb + lavapipe): FOTO_SAIDA=/pasta xvfb-run godot --path godot-prototipo -s ../ferramentas/caverna/foto.gd
const Terreno = preload("res://terreno.gd")
const Relevo = preload("res://relevo.gd")
const Caverna = preload("res://caverna.gd")
var saida := OS.get_environment("FOTO_SAIDA")

class Falso extends Node3D: # o pouco de main.gd que a caverna usa
	var heroi: Node3D
	var mov := {"selo_aberto": false}
	var hud := Hud.new()
	var sol: DirectionalLight3D
	var _a_criar: Array = []
	var h := {"morto": 0.0}
	func on() -> bool:
		return false
	func pintar(_raiz: Node, _p: bool) -> void:
		pass
	class Hud:
		func mostrar_botao(_a: String, _v: bool) -> void:
			pass

func esperar(n: int) -> void:
	for i in n:
		await process_frame

var cam: Camera3D
func foto(nome: String, de: Vector3, para: Vector3) -> void:
	cam.global_position = de
	cam.look_at(para)
	await esperar(8)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
	print("foto ", nome)

func _initialize() -> void:
	root.size = Vector2i(1280, 720)
	var mundo: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://dados/mundo.json"))
	var T = Terreno.new(mundo)
	var m := Falso.new()
	root.add_child(m)
	var env := Environment.new()
	var ceu := ProceduralSkyMaterial.new()
	var sky := Sky.new()
	sky.sky_material = ceu
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("cfe2ff")
	env.ambient_light_energy = 0.4
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 0.68
	env.fog_enabled = true
	env.fog_light_color = Color("a9c8e6")
	env.fog_density = 0.0075
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.22
	var we := WorldEnvironment.new()
	we.environment = env
	m.add_child(we)
	m.sol = DirectionalLight3D.new()
	m.sol.light_color = Color("fff1d6")
	m.sol.light_energy = 0.9
	m.sol.shadow_enabled = true
	m.sol.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	m.sol.directional_shadow_max_distance = 30.0
	m.sol.rotation = Vector3(deg_to_rad(-52), deg_to_rad(60), 0)
	m.add_child(m.sol)
	var chao := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(800, 800)
	chao.mesh = pm
	var cm := StandardMaterial3D.new()
	cm.albedo_color = Color(0.36, 0.48, 0.24)
	chao.material_override = cm
	chao.position = Vector3(150, 0, -40)
	m.add_child(chao)
	var cav = Caverna.new(m, T)
	var rel = Relevo.new(T, null, load("res://relevo/brown_mud_leaves_01.jpg"), cav.buraco_na_montanha)
	m.add_child(rel)
	m.add_child(cav)
	m.heroi = MeshInstance3D.new()
	var cap := CapsuleMesh.new()
	cap.height = 1.7
	cap.radius = 0.28
	m.heroi.mesh = cap
	m.add_child(m.heroi)
	cam = Camera3D.new()
	cam.far = 600
	cam.fov = 62
	m.add_child(cam)
	var p0: Vector3 = Vector3(146, 0, -25)
	m.heroi.position = p0
	await esperar(3)
	cav.montar()
	while not cav._fila.is_empty():
		(cav._fila.pop_front() as Callable).call()
	for l in cav._luzes:
		l.no.visible = true
	var A: Array = T.tunel
	var em := func(s: float, lado := 0.0, alto := 0.0) -> Vector3:
		var q: Dictionary = cav._ponto_s(s, lado)
		return q.p + Vector3(0, alto, 0)
	var heroi_em := func(s: float, lado := 0.0) -> void:
		var q: Vector3 = em.call(s, lado)
		m.heroi.position = q + Vector3(0, 0.85, 0)
	var so := OS.get_environment("FOTO_SO")
	# 1) chegando pela trilha: a boca no pé do paredão e o Gaspar (o boneco faz o tamanho)
	if so == "" or so == "1":
		heroi_em.call(-2.0, 0.0)
		var a0: Dictionary = A[0]
		var de := Vector3(float(a0.x), 0, float(a0.z)) - Vector3(float(a0.dx), 0, float(a0.dz)) * 9.0 + Vector3(-float(a0.dz), 0, float(a0.dx)) * 2.0
		de.y = T.altura(de.x, de.z) + 2.6
		m.heroi.position = Vector3(float(a0.x), 0, float(a0.z)) - Vector3(float(a0.dx), 0, float(a0.dz)) * 3.0
		m.heroi.position.y = T.altura(m.heroi.position.x, m.heroi.position.z) + 0.85
		await foto("1-chegando", de, em.call(2.0, 0.0, 2.2))
	# 2) de longe, do campo: a boca na encosta da montanha
	if so == "" or so == "2":
		await foto("2-de-longe", Vector3(120, 9, -5), em.call(8.0, 0.0, 3.0))
	# 3) o selo fechado, de quem chega
	if so == "" or so == "3":
		heroi_em.call(3.6)
		await foto("3-selo", em.call(0.2, 0.6, 2.3), em.call(7.0, 0.0, 1.8))
	# entra: escuro de dentro
	cav.escuro = 1.0
	env.ambient_light_energy = 0.1
	m.sol.light_energy = 0.12
	env.fog_light_color = Color(0.05, 0.05, 0.07)
	m.mov.selo_aberto = true
	if cav.selo_mat:
		cav.selo_mat.set_shader_parameter("aberto", 1.0)
	# 4) corredor com tocha
	if so == "" or so == "4":
		heroi_em.call(12.0)
		await foto("4-corredor", em.call(8.5, 0.4, 2.3), em.call(16.0, 0.0, 1.6))
	# 5) primeira sala
	if so == "" or so == "5":
		heroi_em.call(21.5)
		await foto("5-sala1", em.call(16.0, -0.5, 3.0), em.call(27.5, 0.0, 1.5))
	# 6) segunda sala
	if so == "" or so == "6":
		heroi_em.call(42.5)
		await foto("6-sala2", em.call(37.5, 0.5, 3.0), em.call(48.5, 0.0, 1.5))
	# 7) sala do chefe
	if so == "" or so == "7":
		heroi_em.call(63.5)
		await foto("7-sala-chefe", em.call(58.5, 0.0, 3.4), em.call(70.5, 0.0, 1.8))
	# 8) olhando para fora, da porta
	if so == "" or so == "8":
		cav.escuro = 0.3
		env.ambient_light_energy = 0.3
		m.sol.light_energy = 0.65
		heroi_em.call(4.0)
		await foto("8-saida", em.call(11.0, 0.3, 2.3), em.call(-2.0, 0.0, 1.8))
	quit()

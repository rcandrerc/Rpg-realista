extends SceneTree
# Fotos da boca de uma caverna do mundo grande (shared/mundo.js CAVERNAS_MUNDO) sem os modelos do jogo: o chão do mundo
# (mundo_terreno.gd), a caverna (caverna.gd) e um boneco do tamanho do herói. Feito para o morro em volta da boca
# (André 2026-11-17, Cap. 10 "A gruta que canta": "pode fazer uma montanha, mas suavizando, para eu conseguir subir").
# Sem a pasta modelos/ (o APK é que gera), as texturas de grama e terra caem nas do relevo/.
# Uso: FOTO_SAIDA=/pasta FOTO_CAVERNA=cav_serra_norte xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/caverna/foto-mundo.gd
const Terreno = preload("res://terreno.gd")
const MundoTerreno = preload("res://mundo_terreno.gd")
const Caverna = preload("res://caverna.gd")
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
var qual := OS.get_environment("FOTO_CAVERNA") if OS.get_environment("FOTO_CAVERNA") != "" else "cav_serra_norte"

class Falso extends Node3D: # o pouco de main.gd que a caverna usa
	var heroi: Node3D
	var mov := {"selo_aberto": true}
	var hud := Hud.new()
	var sol: DirectionalLight3D
	var _a_criar: Array = []
	var h := {"morto": 0.0}
	var lentidao = null
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
	await esperar(6)
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
	env.ambient_light_energy = 0.45
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 0.72
	env.fog_enabled = true
	env.fog_light_color = Color("a9c8e6")
	env.fog_density = 0.004
	var we := WorldEnvironment.new()
	we.environment = env
	m.add_child(we)
	m.sol = DirectionalLight3D.new()
	m.sol.light_color = Color("fff1d6")
	m.sol.light_energy = 1.0
	m.sol.shadow_enabled = true
	m.sol.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	m.sol.directional_shadow_max_distance = 80.0
	m.sol.rotation = Vector3(deg_to_rad(-48), deg_to_rad(-35), 0)
	m.add_child(m.sol)
	var chao = MundoTerreno.new(T)
	m.add_child(chao)
	var cm: Dictionary = {}
	for t in T.tuneis_mundo:
		if str(t.id) == qual:
			cm = t
	if cm.is_empty():
		print("caverna não achada: ", qual)
		quit(1)
		return
	var cav = Caverna.new(m, T, cm)
	m.add_child(cav)
	m.heroi = MeshInstance3D.new()
	var cap := CapsuleMesh.new()
	cap.height = 1.7
	cap.radius = 0.28
	m.heroi.mesh = cap
	var hm := StandardMaterial3D.new()
	hm.albedo_color = Color(0.85, 0.3, 0.2)
	m.heroi.material_override = hm
	m.add_child(m.heroi)
	cam = Camera3D.new()
	cam.far = 900
	cam.fov = 60
	m.add_child(cam)
	var A: Array = cm.A
	var a0: Dictionary = A[0]
	var O := Vector3(float(a0.x), float(a0.y), float(a0.z))
	var d := Vector3(float(a0.dx), 0, float(a0.dz)).normalized()
	var esq := Vector3(-d.z, 0, d.x) # + à esquerda (como terreno.gd no_tunel)
	m.heroi.position = O - d * 6.0 + Vector3(0, 0.85, 0)
	await esperar(3)
	cav.montar()
	while not cav._fila.is_empty():
		(cav._fila.pop_front() as Callable).call()
	for l in cav._luzes:
		l.no.visible = true
	var chao_em := func(p: Vector3) -> Vector3:
		return Vector3(p.x, T.altura(p.x, p.z), p.z)
	# 1) chegando de frente, câmera de jogo (alta, atrás do herói)
	m.heroi.position = chao_em.call(O - d * 6.0) + Vector3(0, 0.85, 0)
	await foto("1-de-frente", O - d * 20.0 + esq * 3.0 + Vector3(0, 9.0, 0), O + d * 2.0 + Vector3(0, 3.0, 0))
	# 2) de lado e de longe: o morro inteiro (dá para ver se a encosta é suave)
	await foto("2-de-lado", O - d * 14.0 + esq * 30.0 + Vector3(0, 12.0, 0), O + d * 6.0 + Vector3(0, 4.0, 0))
	await foto("3-outro-lado", O - d * 14.0 - esq * 30.0 + Vector3(0, 12.0, 0), O + d * 6.0 + Vector3(0, 4.0, 0))
	# 4) o herói no meio da subida, do lado da boca (caminho para cima do morro)
	var sobe: Vector3 = chao_em.call(O + d * 4.0 + esq * 12.0)
	m.heroi.position = sobe + Vector3(0, 0.85, 0)
	await foto("4-subindo", sobe - d * 12.0 + esq * 8.0 + Vector3(0, 7.0, 0), sobe + Vector3(0, 1.0, 0))
	# 5) em cima da boca
	var topo: Vector3 = chao_em.call(O + d * 8.0)
	m.heroi.position = topo + Vector3(0, 0.85, 0)
	await foto("5-em-cima", topo - d * 14.0 + esq * 6.0 + Vector3(0, 8.0, 0), topo + Vector3(0, 1.0, 0))
	# 6) de cima, olhando para baixo (como o "Do alto")
	m.heroi.position = chao_em.call(O - d * 3.0) + Vector3(0, 0.85, 0)
	await foto("6-do-alto", O - d * 18.0 + Vector3(0, 30.0, 0), O + d * 4.0)
	# perfil do chão no meio da boca e 4 m para cada lado (para conferir com shared/mundo.js)
	for lado in [-8.0, -4.0, 0.0, 4.0, 8.0]:
		var linha := "perfil lado %+.0f:" % lado
		for s in range(-6, 16, 2):
			var p: Vector3 = O + d * float(s) + esq * lado
			linha += " %.1f" % T.altura(p.x, p.z)
		print(linha)
	quit()

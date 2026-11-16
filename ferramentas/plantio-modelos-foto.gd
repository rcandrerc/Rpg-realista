extends SceneTree
# Foto dos 6 tipos de árvore plantada (plantio.gd com os arv_<tipo>.glb), sem o jogo inteiro: um main de mentira.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/plantio-modelos-foto.gd
class Falso:
	extends Node
	var tempo := 0.0
	var P = {"dados": {"arvoresPlantio": {}}}
	var terreno = self
	var trabalho = self
	var queda = self
	var _malhas_mata := {}
	func altura(_x, _z): return 0.0
	func registrar(_o): pass
	func registrar_partes(_x, _z, _p): pass
	func caida(_id): return false
	func esquecer(_o): pass

func _initialize() -> void:
	root.size = Vector2i(1600, 640)
	await process_frame
	var f := Falso.new()
	for k in ["betula", "carvalho", "pinheiro", "macieira", "cerejeira", "antiga"]:
		f.P.dados.arvoresPlantio[k] = {"h": 4}
	root.add_child(f)
	var pl = load("res://plantio.gd").new(f)
	root.add_child(pl)
	var env := WorldEnvironment.new(); var e := Environment.new()
	var sky := Sky.new(); var sm := ProceduralSkyMaterial.new(); sky.sky_material = sm; e.sky = sky
	e.background_mode = Environment.BG_SKY; e.ambient_light_source = Environment.AMBIENT_SOURCE_SKY; e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.environment = e; root.add_child(env)
	var sol := DirectionalLight3D.new(); sol.rotation_degrees = Vector3(-48, 35, 0); sol.shadow_enabled = true; root.add_child(sol)
	var chao := MeshInstance3D.new(); var pm := PlaneMesh.new(); pm.size = Vector2(500, 500); chao.mesh = pm
	var cm := StandardMaterial3D.new(); cm.albedo_color = Color("3a5a24"); chao.material_override = cm; root.add_child(chao)
	var lista := []
	var xs := [-24.0, -14.0, -4.0, 6.0, 15.0, 27.0]
	var i := 0
	for k in ["betula", "carvalho", "pinheiro", "macieira", "cerejeira", "antiga"]:
		lista.append([k, k, xs[i], 0.0, 0.3 * i, 1.0, 0.0]); i += 1
	lista.append(["muda", "macieira", -6.0, 9.0, 0.0, 1.0, 999.0])
	pl.atualizar(lista)
	var cam := Camera3D.new(); root.add_child(cam); cam.fov = 40
	cam.look_at_from_position(Vector3(0, 9, 52), Vector3(0, 5, 0))
	for k in 20: await process_frame
	await RenderingServer.frame_post_draw
	var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
	root.get_texture().get_image().save_png(saida + "/plantio-modelos.png")
	print("foto ok")
	quit()

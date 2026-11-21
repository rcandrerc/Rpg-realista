extends SceneTree
# Fotos do navio mercante novo (André 2026-11-21, transporte.gd modelo_navio): o navio sozinho no mar, de vários lados,
# com e sem packs no convés. Sem servidor e sem o jogo todo (só o transporte.gd para montar o modelo).
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/navio-foto.gd
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
func _initialize() -> void:
	root.size = Vector2i(1280, 720)
	var mundo := Node3D.new()
	root.add_child(mundo)
	var amb := WorldEnvironment.new()
	var env := Environment.new()
	var ceu := Sky.new()
	var ps := ProceduralSkyMaterial.new()
	ps.sky_top_color = Color(0.32, 0.52, 0.8)
	ps.sky_horizon_color = Color(0.78, 0.84, 0.9)
	ps.ground_horizon_color = Color(0.5, 0.6, 0.68)
	ps.ground_bottom_color = Color(0.1, 0.2, 0.3)
	ceu.sky_material = ps
	env.background_mode = Environment.BG_SKY
	env.sky = ceu
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.ssao_enabled = true
	mundo.add_child(amb)
	amb.environment = env
	var sol := DirectionalLight3D.new()
	sol.shadow_enabled = true
	sol.rotation = Vector3(-0.75, 0.9, 0)
	sol.light_energy = 1.25
	sol.directional_shadow_max_distance = 60.0
	mundo.add_child(sol)
	var agua := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(400, 400)
	agua.mesh = pm
	var ma := StandardMaterial3D.new()
	ma.albedo_color = Color(0.1, 0.28, 0.38, 0.9)
	ma.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	ma.roughness = 0.08
	ma.metallic = 0.3
	agua.material_override = ma
	mundo.add_child(agua)
	var t = load("res://transporte.gd").new(null)
	t.PK = {"perola": {"cor": "#6fb7c9", "nome": "Pack de Pérolas"}, "obsid": {"cor": "#5a4a7a", "nome": "Pack de Obsidiana"}, "ervas": {"cor": "#6a9a4a", "nome": "Pack de Ervas"}, "brasa": {"cor": "#c0602a", "nome": "Pack de Brasa"}}
	t._materiais()
	var nav: Node3D = t.modelo_navio()
	nav.position.y = -0.25
	mundo.add_child(nav)
	var cam := Camera3D.new()
	cam.fov = 50
	mundo.add_child(cam)
	var vistas := [
		["navio-1-lado-proa", Vector3(17, 6, 12), Vector3(0, 4.0, 0.5)],
		["navio-2-lado", Vector3(22, 4.5, -1.5), Vector3(0, 4.5, 0)],
		["navio-3-popa", Vector3(-9, 5.5, -15), Vector3(0, 3.5, 0)],
		["navio-4-de-cima", Vector3(9, 13, -9), Vector3(0, 1.2, 0)],
		["navio-5-proa-perto", Vector3(5, 3.0, 11), Vector3(0, 1.6, 5.5)],
		["navio-6-porao", Vector3(3.6, 4.2, -2.2), Vector3(0, 0.9, 0.9)],
		["navio-7-popa-escada", Vector3(-3.2, 2.2, -11.5), Vector3(0, 1.0, -6.4)],
	]
	await esperar(10)
	t._por_packs(nav, [], 4, Vector2(0.62, 0.55), 0.0)
	for i in vistas.size():
		if i == 5:
			t._por_packs(nav, ["perola", "obsid", "ervas", "brasa", "perola", "ervas"], 4, Vector2(0.62, 0.55), 0.0)
		if i == 3:
			t._por_packs(nav, ["perola", "perola", "obsid", "ervas", "brasa", "perola", "ervas", "obsid", "perola", "brasa", "ervas", "obsid"], 4, Vector2(0.62, 0.55), 0.0)
		cam.position = vistas[i][1]
		cam.look_at(vistas[i][2])
		await esperar(8)
		await foto(vistas[i][0])
	quit()

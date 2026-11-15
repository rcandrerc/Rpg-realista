extends SceneTree
# Fotos da visão do alto (André 2026-11-15, Travar câmera estilo Albion): câmera normal, travada do alto, do alto no
# mais longe da pinça, e a tela das Configurações. Também imprime objetos, desenhos e triângulos de cada vista.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/camera-alto-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func numeros(nome: String) -> void:
	var o := RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_OBJECTS_IN_FRAME)
	var d := RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME)
	var t := RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME)
	var vp := root.get_viewport()
	var tv := vp.get_render_info(Viewport.RENDER_INFO_TYPE_VISIBLE, Viewport.RENDER_INFO_PRIMITIVES_IN_FRAME)
	var ts := vp.get_render_info(Viewport.RENDER_INFO_TYPE_SHADOW, Viewport.RENDER_INFO_PRIMITIVES_IN_FRAME)
	var dv := vp.get_render_info(Viewport.RENDER_INFO_TYPE_VISIBLE, Viewport.RENDER_INFO_DRAW_CALLS_IN_FRAME)
	var ds := vp.get_render_info(Viewport.RENDER_INFO_TYPE_SHADOW, Viewport.RENDER_INFO_DRAW_CALLS_IN_FRAME)
	print("NUMEROS ", nome, " objetos ", o, " desenhos ", d, " (tela ", dv, " sombra ", ds, ") triangulos ", t, " (tela ", tv, " sombra ", ts, ") alcance sombra ", m.sol.directional_shadow_max_distance if m.sol else -1.0)
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	numeros(nome)
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	if OS.get_environment("FOTO_SEM_LOD") != "":
		load("res://lod_malha.gd")._tarefa = 1 << 40
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	if OS.get_environment("FOTO_X") != "":
		m.heroi.position = Vector3(float(OS.get_environment("FOTO_X")), m.heroi.position.y, float(OS.get_environment("FOTO_Z")))
		m.heroi.position.y = m.terreno.altura(m.heroi.position.x, m.heroi.position.z, 99.0)
		m.cam.colocar(m.heroi.position)
	m.cam.yaw = 0.6
	await esperar(80)
	await foto("1-normal-livre")
	m.menu_topo.camera_travada = true
	m.menu_topo.camera_tipo = "iso"
	await esperar(80)
	await foto("2-travada-do-alto")
	m.cam.zoom_maximo()
	await esperar(80)
	await foto("3-do-alto-mais-longe")
	m.cam.zoom_maximo()
	await esperar(40)
	m.menu_topo.abrir("config")
	await esperar(20)
	await foto("4-configuracoes")
	quit()

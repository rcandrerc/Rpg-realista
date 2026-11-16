extends SceneTree
# Fotos da Vila do Rio Claro (pedido do André 2026-11-16: Casa do Comércio grande de entrar, com o Otávio no balcão,
# a Mestra Iara e a Mirela nos corredores; sobrados, bancas, vendedores e carroças com cavalo). Sem servidor.
# Também imprime objetos, desenhos e triângulos de cada vista (desempenho no celular).
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/rio-claro-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func numeros(nome: String) -> void:
	var vp := root.get_viewport()
	var tv := vp.get_render_info(Viewport.RENDER_INFO_TYPE_VISIBLE, Viewport.RENDER_INFO_PRIMITIVES_IN_FRAME)
	var ts := vp.get_render_info(Viewport.RENDER_INFO_TYPE_SHADOW, Viewport.RENDER_INFO_PRIMITIVES_IN_FRAME)
	var dv := vp.get_render_info(Viewport.RENDER_INFO_TYPE_VISIBLE, Viewport.RENDER_INFO_DRAW_CALLS_IN_FRAME)
	var ds := vp.get_render_info(Viewport.RENDER_INFO_TYPE_SHADOW, Viewport.RENDER_INFO_DRAW_CALLS_IN_FRAME)
	print("NUMEROS ", nome, " desenhos tela ", dv, " sombra ", ds, " triangulos tela ", tv, " sombra ", ts)
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	numeros(nome)
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
# põe o herói no ponto (y = chão do terreno, ou o dado) e espera a vila nascer
func ir(x: float, z: float, y := -999.0) -> void:
	m.mov.por_em(Vector3(x, y, z), y > -999.0)
	m.heroi.position = m.mov.posicao()
	m.cam.colocar(m.heroi.position)
func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	var yaw := float(OS.get_environment("FOTO_YAW")) if OS.get_environment("FOTO_YAW") != "" else 0.0
	# 1: a rua das bancas, olhando para a Casa do Comércio
	ir(-196.0, 85.0)
	m.cam.yaw = yaw + 1.2
	m.cam.pitch = 0.32
	m.cam.dist = 12.0
	await esperar(240)
	await foto("1-rua")
	# 2: a frente da Casa do Comércio
	ir(-226.0, 90.0)
	m.cam.yaw = yaw + PI
	m.cam.pitch = 0.18
	m.cam.dist = 12.0
	await esperar(90)
	await foto("2-frente")
	# 3: lá dentro, câmera normal (o Otávio no balcão)
	ir(-226.0, 107.0, 16.25)
	m.cam.yaw = yaw + PI
	m.cam.pitch = 0.2
	m.cam.dist = 5.2
	await esperar(90)
	await foto("3-dentro")
	# 4: lá dentro, visão do alto (o telhado some)
	m.menu_topo.camera_travada = true
	m.menu_topo.camera_tipo = "iso"
	await esperar(90)
	await foto("4-dentro-do-alto")
	m.menu_topo.camera_travada = false
	# 5: carroças com cavalo
	ir(-177.0, 73.0)
	m.cam.yaw = yaw + 1.3
	m.cam.pitch = 0.3
	m.cam.dist = 8.0
	await esperar(90)
	await foto("5-carrocas")
	# 6: a vila de cima
	ir(-205.0, 85.0)
	m.menu_topo.camera_travada = true
	m.menu_topo.camera_tipo = "iso"
	await esperar(90)
	await foto("6-vila-do-alto")
	quit()

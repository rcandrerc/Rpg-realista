extends SceneTree
# Fotos das lojas das vilas (André 2026-11-27: "as lojas das cidades n serem mais barraquinhas"): a loja da comerciante
# de cada vila e as bancas dos mercadores da Rua do Mercado (Rio Claro). Sem servidor.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/lojas-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
var pre := OS.get_environment("FOTO_PRE")
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func numeros(nome: String) -> void:
	var vp := root.get_viewport()
	var tv := vp.get_render_info(Viewport.RENDER_INFO_TYPE_VISIBLE, Viewport.RENDER_INFO_PRIMITIVES_IN_FRAME)
	var dv := vp.get_render_info(Viewport.RENDER_INFO_TYPE_VISIBLE, Viewport.RENDER_INFO_DRAW_CALLS_IN_FRAME)
	var ds := vp.get_render_info(Viewport.RENDER_INFO_TYPE_SHADOW, Viewport.RENDER_INFO_DRAW_CALLS_IN_FRAME)
	print("NUMEROS ", nome, " desenhos tela ", dv, " sombra ", ds, " triangulos ", tv)
func foto(nome: String) -> void:
	if OS.get_environment("FOTO_LIMPA") != "": # sem os botões e sem o herói: só a vila
		for c in root.find_children("*", "CanvasLayer", true, false):
			c.visible = false
		m.heroi.visible = false
	await RenderingServer.frame_post_draw
	numeros(nome)
	root.get_texture().get_image().save_png(saida + "/" + pre + nome + ".png")
func ir(x: float, z: float) -> void:
	m.mov.por_em(Vector3(x, -999.0, z), false)
	m.heroi.position = m.mov.posicao()
	m.cam.colocar(m.heroi.position)
# herói d metros na frente da peça (x, z, ry), câmera atrás dele olhando a peça
func diante(nome: String, x: float, z: float, ry: float, d: float, dist: float, pitch: float, lado := 0.0, k := 150) -> void:
	var fx := sin(ry + lado)
	var fz := cos(ry + lado)
	ir(x + fx * d, z + fz * d)
	m.heroi.rotation.y = ry + lado + PI
	m.cam.yaw = ry + lado
	m.cam.pitch = pitch
	m.cam.dist = dist
	await esperar(k)
	await foto(nome)
func _initialize() -> void:
	root.size = Vector2i(1280, 720)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	# toldo e estandartes sem tapar o vendedor (André 2026-11-27): de frente, câmera de jogo atrás do herói
	await diante("1-juncal-frente", 546.0, 50.0, PI, 2.6, 3.8, 0.22, 0.0, 240)
	await diante("2-pouso-frente", 10.06, -267.5, -2.0944, 2.6, 3.8, 0.22, -0.2, 240)
	await diante("3-rio-dalia-frente", -225.0, 78.0, 2.513, 2.6, 3.8, 0.22, 0.1, 240)
	await diante("4-mercado-frente", -200.0, 80.5, 0.0, 2.6, 3.8, 0.22, 0.0, 200)
	await diante("5-mercado-frutas", -214.0, 80.5, 0.0, 2.6, 3.8, 0.22, -0.2, 200)
	quit()

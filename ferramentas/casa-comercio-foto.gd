extends SceneTree
# Fotos de dentro da Casa do Comércio (Iara, Mirela, Guilda). Sem servidor.
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
func ir(x: float, z: float, y := -999.0) -> void:
	m.mov.por_em(Vector3(x, y, z), y > -999.0)
	m.heroi.position = m.mov.posicao()
	m.cam.colocar(m.heroi.position)
func vista(nome: String, x: float, z: float, yaw: float, pitch: float, dist: float, k := 60) -> void:
	ir(x, z, 16.25)
	m.cam.yaw = yaw
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
	ir(-226.0, 104.0, 16.25)
	await esperar(240)
	await vista("a-salao", -226.0, 105.5, PI, 0.2, 4.2)
	await vista("b-iara", -225.5, 113.0, -PI / 2, 0.22, 3.4)
	await vista("c-mirela", -226.5, 113.0, PI / 2, 0.22, 3.4)
	await vista("d-guilda", -225.5, 105.0, -PI / 2, 0.22, 3.4)
	await vista("g-guilda-perto", -223.6, 103.2, -2.11, 0.12, 3.0)
	await vista("h-mural", -222.6, 104.2, -PI / 2 - 0.25, -0.05, 2.4)
	await vista("e-entrando-esq", -225.0, 99.0, PI - 0.35, 0.18, 4.0)
	ir(-226.0, 109.0, 16.25)
	m.menu_topo.camera_travada = true
	m.menu_topo.camera_tipo = "iso"
	await esperar(90)
	await foto("f-do-alto")
	quit()

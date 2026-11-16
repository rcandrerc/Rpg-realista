extends SceneTree
# Foto das árvores plantadas (entrega 3 do plantio, 2026-11-16), sem servidor: os 6 tipos adultos lado a lado,
# mais uma muda e uma jovem de bétula na frente.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/plantio-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(n: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + n + ".png")
	print("foto ", n)
func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	var hp: Vector3 = m.heroi.position
	var tipos := ["betula", "carvalho", "pinheiro", "macieira", "cerejeira", "antiga"]
	var lista := []
	for i in tipos.size():
		lista.append(["t%d" % i, tipos[i], hp.x - 15.0 + i * 6.0, hp.z - 14.0, i * 1.1, 1.0, 0.0])
	lista.append(["muda", "betula", hp.x - 3.0, hp.z - 6.0, 0.0, 1.0, 4 * 3600.0 - 60.0])
	lista.append(["jovem", "betula", hp.x + 0.0, hp.z - 6.0, 0.0, 1.0, 3600.0])
	m.plantio.atualizar(lista)
	m.cam.yaw = 0.0
	m.cam.pitch = 0.25
	m.cam.dist = 9.0
	await esperar(120)
	await foto("plantio")
	m.cam.pitch = 0.5
	m.cam.dist = 16.0
	await esperar(30)
	await foto("plantio-alto")
	quit()

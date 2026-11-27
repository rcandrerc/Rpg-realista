extends SceneTree
# Fotos do palete de madeira velha no jogo (André 2026-11-27). Sem servidor: abre o main.tscn de verdade (terreno,
# céu, sol e sombra do jogo), põe 3 paletes encostados e 1 sozinho do lado do herói (construcao.gd _modelo_palete,
# o mesmo que o lote usa) e tira de longe, de perto e de cima.
# Uso: FOTO_SAIDA=/pasta FOTO_NOME=depois xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/palete/palete-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
var nome := OS.get_environment("FOTO_NOME") if OS.get_environment("FOTO_NOME") != "" else "palete"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(arq: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + "-" + arq + ".png")
func vista(arq: String, yaw: float, pitch: float, dist: float) -> void:
	m.cam.yaw = yaw
	m.cam.pitch = pitch
	m.cam.dist = dist
	await esperar(40)
	await foto(arq)
func _initialize() -> void:
	root.size = Vector2i(1280, 720)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	await esperar(200)
	var h: Vector3 = m.heroi.position
	m.cam.yaw = 0.0
	m.cam.pitch = 0.42
	m.cam.dist = 6.5
	await esperar(30)
	var cam3 := root.get_viewport().get_camera_3d()
	var fr: Vector3 = -cam3.global_transform.basis.z
	fr.y = 0
	fr = fr.normalized()
	var pai := Node3D.new()
	m.add_child(pai)
	pai.position = h + fr * 0.9 + fr.cross(Vector3.UP) * 2.4
	pai.rotation.y = atan2(fr.x, fr.z)
	for n in m.get_children(): # sem os botões na frente (só a tela 3D)
		if n is CanvasLayer:
			n.visible = false
	for n in root.get_children():
		if n is CanvasLayer:
			n.visible = false
	for x in [-1.6, 0.0, 1.6]: # 3 encostados
		var p: Node3D = m.construcao._modelo_palete()
		p.position = Vector3(x, 0, 0)
		pai.add_child(p)
	var s: Node3D = m.construcao._modelo_palete() # 1 sozinho, virado
	s.position = Vector3(-2.6, 0, 0.4)
	s.rotation_degrees = Vector3(0, 28, 0)
	pai.add_child(s)
	await vista("1-geral", 0.0, 0.42, 6.5)
	await vista("2-perto", 0.3, 0.45, 3.6)
	await vista("3-de-cima", 0.0, 1.1, 3.6)
	m.heroi.position += fr.cross(Vector3.UP) * 1.4
	await vista("4-bem-perto", 0.0, 0.75, 2.0)
	quit()

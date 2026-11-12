extends SceneTree
# Foto do atalho do zoom (André 2026-11-12) no jogo de verdade, sem servidor: a HUD com o botãozinho colado no
# minimapa, antes (câmera normal) e depois de um toque (câmera no mais longe), e o close do canto.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/zoom-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
func tocar(p: Vector2, solta: bool) -> void:
	var ev := InputEventScreenTouch.new()
	ev.index = 0
	ev.position = p
	ev.pressed = not solta
	Input.parse_input_event(ev)
func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	# na nuvem (render por software) o LOD em linha de fundo derruba o Godot: a foto passa sem ele
	if OS.get_environment("FOTO_SEM_LOD") != "":
		load("res://lod_malha.gd")._tarefa = 1 << 40
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	if OS.get_environment("FOTO_YAW") != "":
		m.cam.yaw = float(OS.get_environment("FOTO_YAW"))
	await esperar(60)
	await foto("1-antes")
	var b: Dictionary = m.hud.botao("zoom")
	var c: Vector2 = m.hud._centro(b)
	print("zoom em ", c, " dist ", m.cam.dist)
	tocar(c, false)
	await esperar(2)
	tocar(c, true)
	await esperar(20)
	print("depois de 20 quadros: dist ", m.cam.dist, " cam ", m.cam.dist_cam, " longe ", m.cam.longe(), " mapa aberto ", m.minimapa.aberto)
	await esperar(40)
	await foto("2-depois-um-toque")
	tocar(c, false)
	await esperar(2)
	tocar(c, true)
	await esperar(60)
	print("segundo toque: dist ", m.cam.dist, " longe ", m.cam.longe())
	await foto("3-segundo-toque-volta")
	quit()

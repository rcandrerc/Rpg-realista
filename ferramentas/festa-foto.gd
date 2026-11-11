extends SceneTree
# Clipe da comemoração (festa.gd) no jogo de verdade, sem servidor: antes (aviso dourado de uma linha) e depois.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 --fixed-fps 30 -s ../ferramentas/festa-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
var n := 0
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func gravar(k: int) -> void:
	for i in k:
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_jpg(saida + "/f%05d.jpg" % n, 0.88)
		n += 1
func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	ProjectSettings.load_resource_pack(OS.get_environment("FESTA_PCK"), false) # modelos do pacote completo; scripts daqui
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	await esperar(120)
	var modo := OS.get_environment("FESTA_MODO")
	if modo == "antes":
		m.hud.festa = null
		m.fx.subir_nivel(m.heroi)
		m.hud.aviso("Nível 12! +3 pontos de atributo")
		await gravar(110)
		quit()
		return
	await gravar(10)
	m.fx.subir_nivel(m.heroi)
	m.hud.aviso("Nível 12! +3 pontos de atributo")
	m.hud.aviso("Liberado: Barra de aço, evoluir para Épico")
	await gravar(200)
	m.hud.aviso("Missão cumprida: Os lobos da estrada (+600 de ouro)")
	await gravar(110)
	m.festa.evoluiu("Peitoral de Couro Épico", Color("b26bff"), false)
	await gravar(100)
	m.festa.reforco(true, 3, "Espada +3")
	await gravar(50)
	m.festa.reforco(false, 3)
	await gravar(30)
	m.festa.reforco(true, 5, "Espada +5")
	await gravar(90)
	m.hud.aviso("Golpe Giratório subiu para Nv 4")
	await gravar(75)
	quit()

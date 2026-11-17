extends SceneTree
# Foto do botão "Tirar névoa" / "Pôr névoa" do mapa (André 2026-11-17): o mapa aberto com a névoa, depois de um toque
# no botão (mapa todo à vista) e de outro toque (a névoa volta). Jogo de verdade, sem servidor.
# Uso: FOTO_SAIDA=/pasta FOTO_SEM_LOD=1 xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/mapa/nevoa-botao-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
func tocar(p: Vector2) -> void:
	for solta in [false, true]:
		var ev := InputEventScreenTouch.new()
		ev.index = 0
		ev.position = p
		ev.pressed = not solta
		Input.parse_input_event(ev)
		await esperar(2)
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
	await esperar(30)
	m.minimapa.abrir()
	var m3 = m.minimapa.mapa3d
	for i in 600:
		await esperar(1)
		if m3.pronto:
			break
	m3.lista_aberta = false
	m3.dist_alvo = float(OS.get_environment("FOTO_DIST")) if OS.get_environment("FOTO_DIST") != "" else m3.dist_alvo * 2.2
	await esperar(90)
	m3.marcas.queue_redraw()
	await esperar(5)
	await foto("1-com-nevoa")
	var c: Vector2 = m3.get_global_rect().position + m3.b_nevoa.get_center()
	print("botão névoa em ", c, " ligado ", m3.nevoa_no_mapa)
	await tocar(c)
	m3.marcas.queue_redraw()
	await esperar(10)
	print("depois do toque: ", m3.nevoa_no_mapa)
	await foto("2-sem-nevoa")
	await tocar(c)
	m3.marcas.queue_redraw()
	await esperar(10)
	print("segundo toque: ", m3.nevoa_no_mapa)
	await foto("3-nevoa-de-volta")
	quit()

extends SceneTree
# Fotos do céu (lua, estrelas e nuvens, ceu.gdshader): câmera virada para a lua, normal e olhando um pouco para cima.
# Uso: FOTO_SAIDA=/pasta xvfb-run godot --path godot-prototipo -s ../ferramentas/dia-noite/ceu.gd
var m
var saida := OS.get_environment("FOTO_SAIDA")

func esperar(n: int) -> void:
	for i in n:
		await process_frame

func foto(nome: String) -> void:
	await esperar(10)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
	print("foto ", nome)

func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(60)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	await esperar(20)
	var l: Vector3 = m.dia.ceu.get_shader_parameter("lua_dir")
	var yaw := atan2(-l.x, -l.z) # a câmera fica do lado oposto da lua e olha para ela
	# campo aberto na beira do Lago Grande, de frente para a lua (sem árvore na frente)
	var lugar := Vector3(-3, 0, 196) - Vector3(l.x, 0, l.z).normalized() * 36.0
	if OS.get_environment("FOTO_VILA") == "":
		m.mov.por_em(Vector3(lugar.x, m.terreno.altura(lugar.x, lugar.z), lugar.z))
		m.heroi.position = m.mov.posicao()
		m.cam.colocar(m.heroi.position)
		await esperar(30)
	for v in [["1-dia", 13.0], ["2-por", 19.3], ["3-noite", 23.0], ["4-madrugada", 3.0]]:
		m.dia.ajustar(v[1])
		for p in [["normal", 0.35], ["para-cima", -0.25], ["agua", 0.15]]:
			m.cam.yaw = yaw + 0.4 # a lua um pouco de lado, sem o herói na frente
			m.cam.pitch = p[1]
			await foto(v[0] + "-" + p[0])
	quit()

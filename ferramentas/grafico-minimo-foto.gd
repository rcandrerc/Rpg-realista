extends SceneTree
# Fotos dos degraus do Auto na gráfico Baixa (André 2026-11-25: "um modo muito mais baixo para celular fraco, mesmo
# perdendo qualidade dos personagens"). Mesma vista em cada degrau, com os números de desenho (desempenho no celular).
# O degrau 2 é o fundo de antes (onde o Note 10 Lite estava); 3 e 4 são os mínimos novos. Sem servidor.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/grafico-minimo-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func numeros(nome: String) -> void:
	var vp := root.get_viewport()
	var tv := vp.get_render_info(Viewport.RENDER_INFO_TYPE_VISIBLE, Viewport.RENDER_INFO_PRIMITIVES_IN_FRAME)
	var dv := vp.get_render_info(Viewport.RENDER_INFO_TYPE_VISIBLE, Viewport.RENDER_INFO_DRAW_CALLS_IN_FRAME)
	var ob := vp.get_render_info(Viewport.RENDER_INFO_TYPE_VISIBLE, Viewport.RENDER_INFO_OBJECTS_IN_FRAME)
	print("NUMEROS ", nome, " desenhos ", dv, " objetos ", ob, " triangulos ", tv)
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	numeros(nome)
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
func ir(x: float, z: float) -> void:
	m.mov.por_em(Vector3(x, -999.0, z), false)
	m.heroi.position = m.mov.posicao()
	m.cam.colocar(m.heroi.position)
func degrau(d: int) -> void:
	var g = m.grafico
	g.auto = true
	g._sem_40 = true
	g.hz = 60
	g._mudar(d)
	g._ajustar_pendentes()
func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	m.grafico.trocar(m.grafico.BAIXA)
	print("DEGRAUS da Baixa: ", m.grafico.degraus() + 1)
	var vistas := [["vila", -196.0, 85.0, 1.2, 0.32, 12.0], ["longe", -205.0, 70.0, 2.4, 0.22, 14.0]]
	for v in vistas:
		ir(v[1], v[2])
		m.cam.yaw = v[3]
		m.cam.pitch = v[4]
		m.cam.dist = v[5]
		for d in [2, 3, 4]:
			degrau(d)
			await esperar(150)
			await foto("%s-degrau%d" % [v[0], d])
	quit()

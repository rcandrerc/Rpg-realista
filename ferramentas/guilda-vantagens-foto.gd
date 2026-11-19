extends SceneTree
# Fotos das vantagens por rank da Guilda (Presidente 2026-11-19): a aba Guilda no Rank A (vantagens, Voltar à Guilda,
# contrato extra e Trocar) e a marca SS em cima do nome. Resumo de exemplo, sem servidor.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/guilda-vantagens-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	m.mov.por_em(Vector3(-221.6, 16.25, 104.4), true)
	m.heroi.position = m.mov.posicao()
	m.cam.colocar(m.heroi.position)
	m.cam.yaw = -PI / 2 - 0.2
	m.cam.pitch = 0.1
	m.cam.dist = 3.2
	await esperar(200)
	m.P.guilda = {"rank": "A", "r": 5, "pg": 64, "pgMax": 120, "prox": {"rank": "S", "nv": 85, "v": {"pack": 0.05}}, "prova": false, "pv": false, "perto": false, "ativos": 4,
		"v": {"extra": 1, "conserto": 0.1, "ativos": 4, "voltar": 0, "troca": 1, "pack": 0, "marca": 0},
		"fim": 5 * 3600000 + 20 * 60000, "ouro": 1650, "xp": 52000, "pgGanha": 20, "cat": true, "l": [
		{"id": "c0", "txt": "Derrube 35 monstros Nv 69+", "n": 21, "t": 35, "e": "ativo"},
		{"id": "c1", "txt": "Vença 2 elite da Guilda", "n": 2, "t": 2, "e": "feito"},
		{"id": "c2", "txt": "Pesque 12 peixes", "n": 0, "t": 12, "e": "livre"},
		{"id": "c3", "txt": "Entregue 1 pack", "n": 1, "t": 1, "e": "recebido"},
		{"id": "c4", "txt": "Corte ou minere 22 vezes", "n": 0, "t": 22, "e": "livre"},
		{"id": "c5", "txt": "Derrube 35 monstros Nv 69+", "n": 0, "t": 35, "e": "livre", "x": 1}]}
	m.P.guilda_t = Time.get_ticks_msec()
	m.menu.abrir("guilda")
	await esperar(30)
	await foto("1-rank-a-vantagens")
	m.menu.rolagem.scroll_vertical = 520
	await esperar(10)
	await foto("2-rank-a-contratos")
	m.menu.fechar()
	# Rank SS: a marca em cima do nome
	m.P.guilda.rank = "SS"
	m.P.guilda.r = 7
	m.P.guilda.v = {"extra": 1, "conserto": 0.1, "ativos": 4, "voltar": 0, "troca": 1, "pack": 0.05, "marca": 1}
	m.cam.yaw = PI * 0.15
	m.cam.pitch = 0.05
	m.cam.dist = 3.0
	await esperar(40)
	await foto("3-marca-ss")
	m.menu.abrir("guilda")
	await esperar(30)
	await foto("4-rank-ss")
	quit()

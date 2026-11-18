extends SceneTree
# Fotos da Guilda dos Aventureiros (André 2026-11-18): o botão de ação perto do mural e a aba Guilda com um resumo de
# exemplo (sem servidor). Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/guilda-foto.gd
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
	# no salão, na frente do vão da Guilda: o botão de ação do mural aparece
	m.mov.por_em(Vector3(-221.6, 16.25, 104.4), true)
	m.heroi.position = m.mov.posicao()
	m.cam.colocar(m.heroi.position)
	m.cam.yaw = -PI / 2 - 0.2
	m.cam.pitch = 0.1
	m.cam.dist = 3.2
	await esperar(300)
	var n = m.conversa.npc_perto()
	print("PERTO ", n.get("nome", "") if n != null else "ninguém")
	await foto("1-perto-do-mural")
	m.P.guilda = {"rank": "F", "r": 0, "pg": 40, "pgMax": 60, "prox": {"rank": "E", "nv": 36}, "prova": false, "pv": false, "perto": true, "ativos": 3,
		"fim": 5 * 3600000 + 20 * 60000, "ouro": 186, "xp": 4200, "pgGanha": 10, "cat": false, "l": [
		{"id": "c0", "txt": "Derrube 15 monstros Nv 25+", "n": 9, "t": 15, "e": "ativo"},
		{"id": "c1", "txt": "Derrube 15 monstros Nv 25+", "n": 15, "t": 15, "e": "feito"},
		{"id": "c2", "txt": "Pesque 5 peixes", "n": 0, "t": 5, "e": "livre"},
		{"id": "c3", "txt": "Corte ou minere 10 vezes", "n": 10, "t": 10, "e": "recebido"},
		{"id": "c4", "txt": "Corte ou minere 10 vezes", "n": 0, "t": 10, "e": "livre"}]}
	m.P.guilda_t = Time.get_ticks_msec()
	m.menu.abrir("guilda")
	await esperar(30)
	await foto("2-aba-guilda")
	m.menu.rolagem.scroll_vertical = 400
	await esperar(10)
	await foto("3-aba-guilda-embaixo")
	m.menu.fechar()
	m.P.guilda.rank = "C"
	m.P.guilda.prova = true
	m.P.guilda.pg = 96
	m.P.guilda.pgMax = 96
	m.P.guilda.prox = {"rank": "B", "nv": 60}
	m.P.guilda.cat = true
	m.menu.abrir("guilda")
	await esperar(30)
	await foto("4-aba-guilda-prova")
	quit()

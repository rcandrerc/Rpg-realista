extends SceneTree
# Fotos da Arena PvP 3x3 (André 2026-11-21, arena_pvp.gd): a arena com o placar, a janela do botão PvP e a janela do fim,
# com eventos de exemplo (sem servidor). Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/arena-pvp-foto.gd
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
		m.dia.ajustar(15.5)
	var A := {"x": 800.0, "z": -420.0, "r": 20.0}
	var base := Vector3(785.0, 0, -420.0)
	m.mov.por_em(Vector3(base.x + 3.0, m.chao_em(base.x + 3.0, base.z), base.z), true)
	m.heroi.position = m.mov.posicao()
	m.cam.colocar(m.heroi.position)
	m.cam.yaw = -PI / 2
	m.cam.pitch = 0.55
	m.cam.dist = 16.0
	var ar = m.arena_pvp
	ar.do_servidor({"fase": "inicio", "time": "chama", "arena": A, "conta": 5, "dur": 300,
		"bases": {"chama": {"x": 785.0, "z": -420.0}, "geada": {"x": 815.0, "z": -420.0}},
		"jogadores": [{"id": "eu", "nome": "Ruiva", "time": "chama"}, {"id": "k", "nome": "Kira", "time": "geada"}]})
	await esperar(240)
	await foto("arena-1-contagem")
	ar.do_servidor({"fase": "luta", "fimEm": 187})
	ar.do_servidor({"fase": "abate", "de": "eu", "alvo": "k", "deNome": "Ruiva", "alvoNome": "Kira", "placar": {"chama": 7, "geada": 5}, "volta": 5})
	await esperar(80)
	await foto("arena-2-luta")
	ar.info = {"pts": 135, "v": 4, "d": 2, "e": 1, "k": 31, "moeda": "Insígnias da Arena", "loja": [
		{"id": "pocao5", "nome": "5x Poção de vida", "txt": "Recupera 35% da vida.", "preco": 15},
		{"id": "mana5", "nome": "5x Poção de mana", "txt": "Recupera 40% da mana.", "preco": 15},
		{"id": "tit_lamina", "nome": "Título: Lâmina da Arena", "txt": "+3% dano", "preco": 150},
		{"id": "tit_muralha", "nome": "Título: Muralha da Arena", "txt": "+3% defesa", "preco": 150, "tem": true},
		{"id": "tit_lenda", "nome": "Título: Lenda da Arena", "txt": "+3% dano, +3% crítico", "preco": 600}]}
	var fase_antes = ar.fase
	ar.fase = ""
	m.menu_topo.abrir("pvp")
	await esperar(20)
	await foto("arena-3-janela-pvp")
	m.menu_topo.fechar()
	ar.fase = fase_antes
	ar.do_servidor({"fase": "fim", "vencedor": "chama", "time": "chama", "resultado": "v", "placar": {"chama": 14, "geada": 11}, "ganhou": 50, "pts": 185, "moeda": "Insígnias da Arena",
		"stats": [{"id": "eu", "nome": "Ruiva", "time": "chama", "k": 7, "m": 3}, {"id": "c", "nome": "Cecília", "time": "chama", "k": 4, "m": 4}, {"id": "d", "nome": "Dario", "time": "chama", "k": 3, "m": 5},
			{"id": "k", "nome": "Kira", "time": "geada", "k": 6, "m": 4}, {"id": "r", "nome": "Rufo", "time": "geada", "k": 3, "m": 5}, {"id": "l", "nome": "Lis", "time": "geada", "k": 2, "m": 5}]})
	await esperar(20)
	await foto("arena-4-fim")
	quit()

extends SceneTree
# Foto do botão Padrão do Editar interface (André 2026-11-14: "cliquei em default, juntou barra de time, barra de missão,
# barra de pack, tudo junto"): no jogo de verdade, sem servidor, com time de 2, missão ativa e pack nas costas.
# Uso: FOTO_SAIDA=/pasta FOTO_W=1280 FOTO_H=576 xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/hud-padrao-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
var pre := OS.get_environment("FOTO_NOME")
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + pre + nome + ".png")
func _initialize() -> void:
	var w := int(OS.get_environment("FOTO_W")) if OS.get_environment("FOTO_W") != "" else 1280
	var h := int(OS.get_environment("FOTO_H")) if OS.get_environment("FOTO_H") != "" else 576
	root.size = Vector2i(w, h)
	if OS.get_environment("FOTO_SEM_LOD") != "":
		load("res://lod_malha.gd")._tarefa = 1 << 40
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	# missão ativa (como se viesse do servidor) e time de 2
	m.online.ligado = true
	m.P.prog["hist"] = {"p": 5, "ac": true, "e": 0, "n": 0}
	var M: Dictionary = m.nevoa.missao_atual()
	m.P.hist_info = {"id": str(M.get("id", "")), "cap": int(M.get("cap", 0)), "nome": str(M.get("nome", "")), "txt": "Confira sua barra de habilidades (Menu > Habilidades)", "e": 0, "ev": "barra"}
	m.amigos.time = [{"id": "c1", "nome": "Cecília", "nivel": 12, "vida": 80, "vidaMax": 100, "mana": 40, "manaMax": 60},
		{"id": "d1", "nome": "Dario", "nivel": 11, "vida": 55, "vidaMax": 100, "mana": 60, "manaMax": 60}]
	m.amigos.lider = "c1"
	var pk: Dictionary = m.transporte.PK
	if not pk.is_empty():
		m.P.prog["pack"] = {"k": pk.keys()[0], "ox": 0.0, "oz": 0.0}
	await esperar(40)
	await foto("1-jogo")
	print("FOTO1 ok")
	m.editar_hud.abrir()
	print("abriu")
	await esperar(10)
	print("10 quadros")
	m.editar_hud._padrao()
	await esperar(20)
	await foto("2-editar-padrao")
	m.editar_hud.fechar()
	# sem time: a missão sobe para logo embaixo do painel
	m.amigos.time = []
	await esperar(20)
	await foto("3-jogo-sem-time")
	quit()

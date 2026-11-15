extends SceneTree
# Foto da janela Multijogador de quem não tem a chave de IA (André 2026-11-15: "não aparece a opção para mandar
# mensagem, só ativar IA"). O "online" é de mentira: só a lista que o servidor mandaria, sem conexão.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/amiga/foto-multi-sem-chave.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
	print("foto ", nome)
func online_de_mentira() -> void:
	var o = m.online
	o.ligado = true
	o.jogadores = 2
	o.rede.ping_ms = 42
	o.rede.ult_pacote_ms = Time.get_ticks_msec()
func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	await esperar(30)
	online_de_mentira()
	var a = m.amigos
	a.lista = []
	a.virtuais = [
		{"c": "a:cecilia", "nome": "Cecília", "id": "amiga", "nivel": 4, "on": 1, "time": false, "amizade": 2, "ia": false},
		{"c": "a:dario", "nome": "Dario", "id": "dario", "nivel": 3, "on": 1, "time": false, "amizade": 1, "ia": false},
	]
	a.set("_lista_t", 9999.0)
	m.menu_topo.abrir("multi")
	await esperar(20)
	online_de_mentira()
	a.set("_lista_t", 9999.0)
	m.menu_topo.montar()
	await esperar(10)
	await foto(OS.get_environment("FOTO_NOME") if OS.get_environment("FOTO_NOME") != "" else "multi-sem-chave")
	quit()

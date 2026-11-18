extends SceneTree
# Fotos do PR do repertório único (André 2026-11-18): a lista de amigos sem "Ativar conversa com IA" (a IA desligada:
# o servidor manda ia: true) e a conversa privada com a Cecília e com o Dario, com as falas que o jogo de verdade gerou
# (FOTO_CONVERSA: JSON de ferramentas/amiga/conversa-repertorio.mjs). O "online" é de mentira, sem conexão.
# Uso: FOTO_SAIDA=/pasta FOTO_CONVERSA=conv.json xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 \
#   --render-thread safe -s ../ferramentas/amiga/foto-repertorio.gd
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
	load("res://idioma.gd").trocar("pt")
	await esperar(5)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	await esperar(30)
	online_de_mentira()
	# 1) lista de amigos: com a IA desligada o servidor manda ia: true, e o botão de chave não aparece
	var a = m.amigos
	a.lista = []
	a.virtuais = [
		{"c": "a:cecilia", "nome": "Cecília", "id": "amiga", "nivel": 4, "on": 1, "time": false, "amizade": 2, "ia": true},
		{"c": "a:dario", "nome": "Dario", "id": "dario", "nivel": 3, "on": 1, "time": false, "amizade": 1, "ia": true},
	]
	a.set("_lista_t", 9999.0)
	m.menu_topo.abrir("multi")
	await esperar(20)
	online_de_mentira()
	a.set("_lista_t", 9999.0)
	m.menu_topo.montar()
	await esperar(10)
	await foto("1-lista-sem-botao-de-chave")
	m.menu_topo.fechar()
	await esperar(10)
	# 2) conversas
	var conv: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(OS.get_environment("FOTO_CONVERSA")))
	var lista := []
	for k in ["cecilia", "dario"]:
		lista.append_array(conv[k].msgs)
	m.chat.do_servidor({"t": "chatHist", "lista": lista})
	var n := 2
	for k in ["cecilia", "dario"]:
		m.chat.abrir_pm(str(conv[k].c), str(conv[k].nome))
		await esperar(20)
		m.chat._descer()
		await esperar(10)
		await foto("%d-conversa-%s" % [n, k])
		n += 1
	quit()

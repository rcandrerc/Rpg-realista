extends SceneTree
# Foto da busca de amigo pelo nome (André 2026-11-15: "adicionar amigo a distância por pesquisa"): a aba Amigos com o
# botão Adicionar e um pedido que chegou, e a busca com o resultado. O "online" é de mentira (sem conexão).
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/amigo/foto-busca.gd
# FOTO_EN=1: em inglês
const Idioma = preload("res://idioma.gd")
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
	o.jogadores = 3
	o.rede.ping_ms = 42
	o.rede.ult_pacote_ms = Time.get_ticks_msec()
func _initialize() -> void:
	root.size = Vector2i(1366, 768)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	await esperar(30)
	var en := OS.get_environment("FOTO_EN") == "1"
	Idioma.trocar("en" if en else "pt")
	online_de_mentira()
	var a = m.amigos
	a.lista = [{"c": "c7", "nome": "Lia", "id": null, "nivel": null, "on": 2, "time": false}]
	a.pedidos = [{"c": "c9", "nome": "Rafa", "on": 0}]
	a.virtuais = []
	a.set("_lista_t", 9999.0)
	m.menu_topo.abrir("multi")
	await esperar(20)
	online_de_mentira()
	a.set("_lista_t", 9999.0)
	m.menu_topo.montar()
	await esperar(10)
	var suf := "-en" if en else ""
	await foto("1-amigos-com-adicionar" + suf)
	a.buscando = true
	a.busca_txt = "andre"
	a.busca_feita = true
	a.busca_res = [
		{"c": "c2", "nome": "André", "on": 1, "amigo": false, "env": false, "rec": false},
		{"c": "c3", "nome": "Andreia Luz", "on": 2, "amigo": false, "env": true, "rec": false},
		{"c": "c4", "nome": "Andrezinho", "on": 0, "amigo": true, "env": false, "rec": false},
	]
	m.menu_topo.montar()
	await esperar(10)
	await foto("2-busca-pelo-nome" + suf)
	quit()

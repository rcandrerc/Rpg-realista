extends SceneTree
# fotos de antes e depois (inglês): barrinha de criar, time, monstro, ferraria
const Idioma = preload("res://idioma.gd")
var m
var saida := OS.get_environment("FOTO_SAIDA")
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
func _initialize() -> void:
	DisplayServer.window_set_size(Vector2i(1280, 576))
	root.size = Vector2i(1280, 576)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	Idioma.trocar("en")
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	m.amigos.time = [{"id": "c1", "nome": "Cecília", "nivel": 12, "vida": 0, "vidaMax": 100, "mana": 40, "manaMax": 60, "morto": true},
		{"id": "d1", "nome": "Dario", "nivel": 11, "vida": 55, "vidaMax": 100, "mana": 60, "manaMax": 60}]
	m.amigos.lider = "c1"
	var k: String = m.P.dados.itens.keys()[0]
	m.construcao.fabricando({"k": k, "nome": "Barra de ferro", "v": "Criando", "n": 3, "feito": 1, "dur": 60.0})
	await esperar(30)
	await foto("1-criando")
	# monstro perto: anda o herói até a primeira clareira de caça
	m.construcao.fabricando({"k": k, "nome": "Barra de ferro", "fim": true, "feito": 3})
	var fr: Vector3 = m.heroi.position + m.heroi.global_transform.basis.z * -1.0
	m.criar_inimigo("puglin", m.heroi.position + Vector3(0, 0, 3.5), "Golem de Magma  Nv 28")
	await esperar(200)
	await foto("2-monstro")
	m.menu.abrir("profissoes", "fer")
	await esperar(20)
	await foto("3-ferraria")
	quit()

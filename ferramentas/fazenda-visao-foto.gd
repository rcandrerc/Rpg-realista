extends SceneTree
# Fotos das opções da visão ao plantar (André 2026-11-18: "a barra é gigantesca e o campo de plantação fica curto"),
# sem servidor: um terreno de mentira com canteiros, modo construção na aba Fazenda (Regar), um quadrado marcado.
# Uso: FOTO_SAIDA=/pasta FOTO_NOME=depois xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/fazenda-visao-foto.gd
var m
var c
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
var opcao := OS.get_environment("FOTO_NOME") if OS.get_environment("FOTO_NOME") != "" else "fazenda-visao"
const Menu = preload("res://menu.gd")
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(n: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + n + ".png")
	print("foto ", n)
func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	c = m.construcao
	load("res://idioma.gd").trocar("pt")
	for it in [{"k": "regador", "n": 1}, {"k": "semente_milho", "n": 20}, {"k": "semente_batata", "n": 9}, {"k": "semente_abobora", "n": 4}]:
		m.P.prog.mochila.append(it)
	m.mov.por_em(Vector3(-12.5, 0, 63.0))
	m.heroi.position = m.mov.posicao()
	await esperar(200)
	var agora := Time.get_unix_time_from_system() * 1000.0
	var h := []
	var plantas := ["batata", "abobora", "milho", "batata", "abobora", "milho"]
	for j in range(66, 72):
		for i in range(-12, -5):
			var k: int = (i + j) % 6
			if j <= 67:
				h.append(["%d,%d" % [i, j], plantas[abs(k)], 0, null, agora - 60000.0]) # planta, precisa regar
			elif j <= 69:
				h.append(["%d,%d" % [i, j], "", 0, agora - 60000.0, agora - 60000.0]) # arada e regada
			else:
				h.append(["%d,%d" % [i, j], "", 0, null, agora - 60000.0]) # arada seca
	c.meu = "t1"
	c.do_servidor_lote({"lote": "t1", "ret": [-15, 63, -3, 75], "dono": "Teste", "pecas": [], "horta": h, "agora": agora})
	await esperar(60)
	m.online.ligado = true
	c.abrir()
	m.online.ligado = false
	c.trocar_aba("fazenda")
	c.sel = "regar"
	c._montar_itens()
	m.cam.yaw = PI
	c.mira = Vector3(-9.0, 0, 68.5)
	m.cam.dist = 10.5
	await esperar(90)
	# toca num canteiro longe do meio da tela: marca (Salvar (1)); antes a câmera corria para lá
	var alvo: Vector2 = m.cam.cam.unproject_position(Vector3(-7.5, 0, 70.5))
	print("toque em ", alvo)
	c.tocou_tela(alvo)
	await esperar(120)
	m.hud.set("_aviso_t", 0.0)
	await esperar(5)
	await foto(opcao)
	if OS.get_environment("FOTO_SETA") != "": # segura a seta da esquerda por 0,6 s: só a câmera anda
		c._seta = Vector2(-1, 0)
		await esperar(18)
		c._seta = Vector2.ZERO
		await esperar(60)
		await foto(opcao + "-seta")
	quit()


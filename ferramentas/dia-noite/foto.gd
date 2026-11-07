extends SceneTree
# Fotos do dia e noite (dia_noite.gd) na cena de verdade, com a HUD: meio-dia, pôr do sol, noite, madrugada e o sono.
# Uso: FOTO_SAIDA=/pasta xvfb-run godot --path godot-prototipo -s ../ferramentas/dia-noite/foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA")

func esperar(n: int) -> void:
	for i in n:
		await process_frame

func foto(nome: String) -> void:
	await esperar(8)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
	print("foto ", nome)

func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(60)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	await esperar(20)
	m.P.prog.xp = int(m.P.xp_prox * 0.4237)
	m.P.prog.vigor = {"v": 63.0, "t": m.P.agora_ms()}
	for v in [["1-meio-dia", 13.0], ["2-por-do-sol", 19.3], ["3-noite", 23.0], ["4-amanhecer", 5.6]]:
		m.dia.ajustar(v[1])
		await foto(v[0])
	m.dia.ajustar(-1.0)
	m.P.prog["dia"] = {"h": 22.0, "t": m.P.agora_ms()}
	await esperar(5)
	m.dia.dormiu({"vigor": 40, "espera": 0})
	m.P.prog["dia"] = {"h": 6.5, "t": m.P.agora_ms()} # o que o servidor manda logo depois
	await esperar(70)
	await foto("5-dormindo")
	await esperar(160)
	await foto("6-bom-dia")
	quit()

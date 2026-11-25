extends SceneTree
# Fotos das abas Set e Capa da Aparência (André 2026-11-25: cada set tem só a cor principal e a borda; a capa idem),
# nos 4 trajes, na raridade Épico (a borda aparece do Raro em diante). Uso: FOTO_SAIDA=/pasta xvfb-run -a godot
#   --path godot-prototipo --rendering-driver opengl3 --render-thread safe -s ../ferramentas/trajes-justos/abas-set-capa-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
	print("foto ", nome)
func _initialize() -> void:
	DisplayServer.window_set_size(Vector2i(1280, 576))
	root.size = Vector2i(1280, 576)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	m.P.prog["equip"] = {"corpo": {"k": "peitoral", "r": 2}, "pernas": {"k": "calca", "r": 2}, "pes": {"k": "botas", "r": 2},
		"chapeu": {"k": "chapeu", "r": 2}, "capa": {"k": "capa", "r": 2}}
	m.vestir_heroi()
	await esperar(10)
	m.abrir_aparencia()
	await esperar(60)
	var c = m.criador
	if c.get("linha_equip") != null:
		c.linha_equip.emit_signal("pressed")
		await esperar(30)
	c.ap.raridade = 2
	var cores := OS.get_environment("CORES") != "0"
	if cores:
		c.ap.roupa = 0x6e1e2a # vinho
		c.ap.calca = 0x6e1e2a
		c.ap.borda = 0xd8a848 # ouro
		c.ap.capa = 0x222226 # preto
		c.ap.capa_borda = 0xd8a848 # ouro
	c.mudou()
	var pre := "cor" if cores else "orig"
	for i in c.trajes_fl.get_child_count():
		c.trajes_fl.get_child(i).emit_signal("pressed")
		await esperar(40)
		var abas: Control = c.abas_cor_ui["set"].get_parent()
		c.rolagem.scroll_vertical = int(abas.position.y) - 40
		c.mostrar_aba_cor("set")
		await esperar(10)
		await foto("%s-traje%d-aba-set" % [pre, i])
		c.mostrar_aba_cor("capa")
		c.giro = PI * 0.8 # a capa aparece de costas
		await esperar(40)
		await foto("%s-traje%d-aba-capa" % [pre, i])
		c.giro = 0.0
		await esperar(30)
	quit()

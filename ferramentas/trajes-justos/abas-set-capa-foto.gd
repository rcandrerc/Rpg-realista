extends SceneTree
# Fotos da Cor do set e da Borda do set na Aparência (André 2026-11-26: a cor do set pinta a capa junto e a borda do
# set pinta a borda da capa),
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
	c.mudou()
	var pre := "cor" if cores else "orig"
	for i in c.trajes_fl.get_child_count():
		c.trajes_fl.get_child(i).emit_signal("pressed")
		await esperar(40)
		var fl: Control = c.cores_ui["roupa"][0][0].get_parent()
		c.rolagem.scroll_vertical = int(fl.position.y) - 70
		await esperar(10)
		await foto("%s-traje%d-frente" % [pre, i])
		c.giro = PI * 0.8 # a capa aparece de costas
		await esperar(40)
		await foto("%s-traje%d-costas" % [pre, i])
		c.giro = 0.0
		await esperar(30)
	quit()

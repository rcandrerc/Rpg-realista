extends SceneTree
# Fotos das abas de cor da Aparência (André 2026-11-24: "editar as duas cores, só que em abas separadas", nos 4
# trajes). Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 \
#   --render-thread safe -s ../ferramentas/trajes-justos/abas-cor-foto.gd
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
		"chapeu": {"k": "chapeu", "r": 2}}
	m.vestir_heroi()
	await esperar(10)
	m.abrir_aparencia()
	await esperar(60)
	var c = m.criador
	if c.get("linha_equip") != null:
		c.linha_equip.emit_signal("pressed")
		await esperar(30)
	var roupa: Array = c.criador.get("roupa", [])
	var calca: Array = c.criador.get("calca", [])
	c.ap.roupa = roupa[min(4, roupa.size() - 1)]
	c.ap.calca = calca[min(2, calca.size() - 1)]
	c.mudou()
	for i in c.trajes_fl.get_child_count():
		c.trajes_fl.get_child(i).emit_signal("pressed")
		await esperar(40)
		var abas: Control = c.abas_cor_ui["roupa"].get_parent()
		c.rolagem.scroll_vertical = int(abas.position.y) - 40
		c.mostrar_aba_cor("roupa")
		await esperar(10)
		await foto("traje%d-aba-roupa" % i)
		c.mostrar_aba_cor("calca")
		await esperar(10)
		await foto("traje%d-aba-calca" % i)
	quit()

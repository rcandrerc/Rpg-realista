extends SceneTree
# Foto do quadradinho "Ver equipado" na Aparência (André 2026-11-16: "uma caixinha pra marcar e desmarcar ele pra ver
# equipado e sem equipamento"): no jogo de verdade, sem servidor, com peitoral, calça, botas e capa vestidos.
# Uso: FOTO_SAIDA=/pasta FOTO_W=1280 FOTO_H=576 xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 \
#   --render-thread safe -s ../ferramentas/aparencia-equip-foto.gd
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
	DisplayServer.window_set_size(Vector2i(w, h))
	root.size = Vector2i(w, h)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	m.P.prog["equip"] = {"corpo": {"k": "peitoral", "r": 3}, "pernas": {"k": "calca", "r": 3}, "pes": {"k": "botas", "r": 3},
		"capa": {"k": "capa", "r": 3}}
	m.vestir_heroi()
	await esperar(10)
	m.abrir_aparencia()
	await esperar(60)
	await foto("1-sem-equipamento")
	var c = m.criador
	if c.get("linha_equip") != null:
		c.linha_equip.emit_signal("pressed")
		await esperar(40)
		await foto("2-equipado")
		c.linha_equip.emit_signal("pressed")
		await esperar(30)
		await foto("3-desmarcado-de-novo")
	# André 2026-11-23: quadradinhos do traje (Patrulheira / Roupão) na moça
	if c.get("trajes_fl") != null:
		c.rolagem.scroll_vertical = int(c.trajes_fl.position.y) - 120
		await esperar(5)
		c.trajes_fl.get_child(1).emit_signal("pressed")
		await esperar(40)
		await foto("4-roupao")
		c.trajes_fl.get_child(0).emit_signal("pressed")
		await esperar(40)
		await foto("5-patrulheira")
	quit()

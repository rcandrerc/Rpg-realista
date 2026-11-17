extends SceneTree
# Foto da ficha deitada da mochila (André 2026-11-17: "é muito botão numa janela só"): antes/depois e o "Mais" aberto.
# Uso: FOTO_SAIDA=/pasta FOTO_NOME=depois- xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 \
#   --render-thread safe -s ../ferramentas/cartao-botoes-foto.gd
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
var pre := OS.get_environment("FOTO_NOME")
func _initialize() -> void:
	var w := 1280
	var h := 520
	DisplayServer.window_set_size(Vector2i(w, h))
	root.size = Vector2i(w, h)
	var fundo := ColorRect.new()
	fundo.color = Color(0.09, 0.08, 0.07)
	fundo.size = Vector2(w, h)
	root.add_child(fundo)
	var sc := GDScript.new()
	sc.source_code = "extends Node\nvar P\nvar reforco\nfunc perto_de_quem_compra(): return false\n"
	sc.reload()
	var falso := Node.new()
	falso.set_script(sc)
	falso.P = load("res://progresso.gd").new()
	root.add_child(falso)
	var M = load("res://menu.gd").new(falso)
	M.m = falso
	M.boneco_modo = "Espada"
	var P = falso.P
	P.prog["equip"] = {"corpo": {"k": "peitoral", "r": 2}, "pernas": {"k": "calca", "r": 2}}
	P.prog.mochila = [{"k": "peitoral", "r": 2, "e": 7, "d": 100}]
	var tela := Control.new()
	tela.size = Vector2(w, h)
	root.add_child(tela)
	var r1 = M.rotulo("Ficha da peça na mochila (deitada, embaixo da grade)", 16, Color(0.95, 0.82, 0.55))
	r1.position = Vector2(20, 220)
	tela.add_child(r1)
	var det: Control = M.detalhe(P.prog.mochila[0], 0, "", true)
	det.position = Vector2(20, 250)
	det.custom_minimum_size = Vector2(1100, 0)
	tela.add_child(det)
	for i in 10:
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + pre + "cartao.png")
	# abre o "Mais" (se existir)
	var achou: Button = null
	var pilha: Array = [det]
	while not pilha.is_empty():
		var n: Node = pilha.pop_back()
		if n is Button and str(n.get_meta("pt", "")) == "Mais ▾":
			achou = n
		pilha.append_array(n.get_children())
	if achou:
		achou.pressed.emit()
		for i in 10:
			await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(saida + "/" + pre + "mais.png")
	quit()

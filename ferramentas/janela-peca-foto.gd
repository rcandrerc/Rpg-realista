extends SceneTree
# Foto da janela que abre ao tocar no medalhão vestido (André 2026-11-17: "2492 equipamento sem mudança").
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func _initialize() -> void:
	var w := 1280
	var h := 720
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
	P.prog["equip"] = {"cabeca": {"k": "chapeu", "r": 3}, "corpo": {"k": "peitoral", "r": 3, "e": 7, "d": 55}, "pernas": {"k": "calca", "r": 3},
		"pes": {"k": "botas", "r": 3}, "capa": {"k": "capa", "r": 2}, "acessorio": {"k": "colar", "r": 3}, "espada": {"k": "espada", "r": 3}}
	var tela := Control.new()
	tela.size = Vector2(w, h)
	root.add_child(tela)
	M.raiz = tela
	M.janela_lugar = "corpo"
	M.janela_nome = "Corpo"
	M.montar_janela()
	for i in 20:
		await process_frame
	for c in M.janela.get_children():
		if c is PanelContainer:
			c.modulate.a = 1.0
			c.position = Vector2(400, 60)
	await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/janela.png")
	quit()

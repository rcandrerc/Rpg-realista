extends SceneTree
# Foto do aviso por cima da mochila aberta (André 2026-11-21: o aviso ficava atrás do menu e só aparecia ao fechar).
# Uma camada 20 opaca faz o papel do menu; o HUD de verdade (hud.gd) manda o aviso.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 \
#   --render-thread safe -s ../ferramentas/aviso-na-frente-foto.gd
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func _initialize() -> void:
	var w := 1280
	var h := 600
	DisplayServer.window_set_size(Vector2i(w, h))
	root.size = Vector2i(w, h)
	var hud = load("res://hud.gd").new()
	root.add_child(hud)
	var menu := CanvasLayer.new()
	menu.layer = 20 # a mesma camada do menu.gd
	root.add_child(menu)
	var fundo := ColorRect.new()
	fundo.color = Color(0.11, 0.095, 0.08)
	fundo.set_anchors_preset(Control.PRESET_FULL_RECT)
	menu.add_child(fundo)
	var t := Label.new()
	t.text = "Mochila aberta (camada 20, como o menu)"
	t.position = Vector2(40, 40)
	menu.add_child(t)
	for i in 5:
		await process_frame
	hud.aviso("Vá até uma bigorna para evoluir: a da ferraria da vila ou uma construída num terreno")
	for i in 10:
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/aviso-na-frente.png")
	print("FOTO ok")
	quit()

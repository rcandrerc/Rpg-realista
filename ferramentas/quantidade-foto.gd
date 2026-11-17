extends SceneTree
# Foto da janelinha "quantos passam" (André 2026-11-17: "escolher tudo ou a quantidade específica") por cima da troca.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 \
#   --render-thread safe -s ../ferramentas/quantidade-foto.gd
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func _initialize() -> void:
	var w := 1280
	var h := 600
	DisplayServer.window_set_size(Vector2i(w, h))
	root.size = Vector2i(w, h)
	var fundo := ColorRect.new()
	fundo.color = Color(0.20, 0.26, 0.18)
	fundo.size = Vector2(w, h)
	root.add_child(fundo)
	var sc := GDScript.new()
	sc.source_code = "extends Node\nvar P\nvar menu\nvar sons\nvar hud = self\nvar tempo := 0.0\nvar online\nfunc on(): return true\nfunc aviso(t): print('aviso: ', t)\nfunc rede(t, msg): print('rede: ', t, ' ', msg)\n"
	sc.reload()
	var falso := Node.new()
	falso.set_script(sc)
	falso.P = load("res://progresso.gd").new()
	root.add_child(falso)
	var M = load("res://menu.gd").new(falso)
	M.m = falso
	falso.menu = M
	var P = falso.P
	P.prog.mochila = [{"k": "lenha", "n": 37}, {"k": "minerio_cobre", "n": 24}, {"k": "barra_ferro", "n": 8}, {"k": "peitoral", "r": 2, "e": 3, "d": 100}, {"k": "tecido", "n": 50}]
	P.prog.ouro = 1250
	# a troca atrás
	var T = load("res://troca.gd").new(falso)
	root.add_child(T)
	await process_frame
	T.estado = {"nome": "Cecília", "eu": {"itens": [], "ouro": 0}, "ele": {"itens": [], "ouro": 0}}
	T.raiz.visible = true
	T.montar()
	# a janelinha por cima (camada do menu, 20)
	var camada := CanvasLayer.new()
	camada.layer = 20
	root.add_child(camada)
	M.pedir_qtd(P.prog.mochila[0], 37, "Pôr", func(n): print("escolheu ", n))
	var c: Control = M._confirma
	M.remove_child(c)
	camada.add_child(c)
	M._qtd = 15
	(c.get_meta("mostrar") as Callable).call()
	for i in 12:
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/quantidade-troca.png")
	quit()

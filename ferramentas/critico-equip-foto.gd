extends SceneTree
# Foto do atributo extra das peças e do conjunto de crítico (André 2026-11-17): cartões do capacete, das botas, da
# espada Míticas, com o conjunto no cartão. Usa o código do menu sem abrir o jogo inteiro.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 --render-thread safe \
#   -s ../ferramentas/critico-equip-foto.gd
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
	var sc := GDScript.new() # no lugar do main.gd: só o que o menu usa para desenhar
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
	P.prog.atr = {"for": 400, "des": 3, "int": 400, "vit": 3} # para o reforço valer
	P.prog["equip"] = {"cabeca": {"k": "chapeu", "r": 4, "e": 10}, "corpo": {"k": "peitoral", "r": 4}, "pernas": {"k": "calca", "r": 4},
		"pes": {"k": "botas", "r": 4}, "capa": {"k": "capa", "r": 3}, "acessorio": {"k": "colar", "r": 3}, "espada": {"k": "espada", "r": 4, "e": 10}}
	var tela := Control.new()
	tela.size = Vector2(w, h)
	root.add_child(tela)
	var cartoes := HBoxContainer.new()
	cartoes.add_theme_constant_override("separation", 10)
	cartoes.position = Vector2(10, 10)
	tela.add_child(cartoes)
	for l in ["cabeca", "pes", "espada"]:
		var pn := PanelContainer.new()
		pn.add_theme_stylebox_override("panel", M.caixa(Color(0.05, 0.045, 0.04, 0.97), Color(0.35, 0.3, 0.22), 1, 8))
		pn.custom_minimum_size = Vector2(410, 560)
		pn.clip_contents = true
		var det: Control = M.detalhe(P.prog.equip[l], -1, l, false)
		det.custom_minimum_size.x = 395
		pn.add_child(det)
		cartoes.add_child(pn)
	P.st = P.calcular_status()
	var st = P.st
	var r = M.rotulo("Status: Crítico %s%% · Dano crítico +%d" % [P.num(st.critico * 100, 1), int(st.danoCritico)], 20, Color(0.95, 0.82, 0.55))
	r.position = Vector2(20, 590)
	tela.add_child(r)
	for i in 20:
		await process_frame
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/critico-equip.png")
	quit()

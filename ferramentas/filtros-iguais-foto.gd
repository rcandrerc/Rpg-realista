extends SceneTree
# Fotos da venda, do Baú e da troca com os mesmos botões de tipo e a mesma janelinha da quantidade (André 2026-11-25:
# "todos usando o mesmo esquema"; número maior que a pilha puxa das pilhas iguais). Usa o código de verdade (menu.gd,
# construcao.gd e troca.gd), só a parte de UI.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 \
#   --render-thread safe -s ../ferramentas/filtros-iguais-foto.gd
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
var W := 1280
var H := 600
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func _initialize() -> void:
	DisplayServer.window_set_size(Vector2i(W, H))
	root.gui_embed_subwindows = true # o menuzinho (PopupMenu) sai na foto
	root.size = Vector2i(W, H)
	var sc := GDScript.new()
	sc.source_code = "extends Node\nvar P\nvar menu\nvar sons\nvar hud = self\nvar base_cla = null\nvar lentidao = null\nvar tempo := 0.0\nvar online\nfunc on(): return true\nfunc aviso(t): print('aviso: ', t)\nfunc rede(t, msg): print('rede: ', t, ' ', msg)\nfunc perto_de_quem_compra(): return true\nfunc perto_de_quem_conserta(): return false\n"
	sc.reload()
	var falso := Node.new()
	falso.set_script(sc)
	falso.P = load("res://progresso.gd").new()
	root.add_child(falso)
	var M = load("res://menu.gd").new(falso)
	M.m = falso
	falso.menu = M
	var P = falso.P
	var moch: Array = []
	moch.resize(30)
	var por := [[0, {"k": "carne", "n": 50}], [1, {"k": "carne", "n": 50}], [2, {"k": "lenha", "n": 37}], [3, {"k": "carne", "n": 50}],
		[4, {"k": "espada", "r": 0}], [5, {"k": "peitoral", "r": 1, "e": 2}], [6, {"k": "minerio_cobre", "n": 24}], [7, {"k": "carne", "n": 23}],
		[8, {"k": "pocao", "n": 6}], [9, {"k": "botas", "r": 2}], [10, {"k": "couro", "n": 18}], [11, {"k": "calca", "r": 0}],
		[12, {"k": "barra_ferro", "n": 8}], [13, {"k": "peixe", "n": 12}]]
	for p in por:
		if P.dados.itens.has(p[1].k):
			moch[p[0]] = p[1]
		else:
			print("sem item ", p[1].k)
	P.prog.mochila = moch
	P.prog.ouro = 1250
	# 1) mochila na frente da Rosa: os 2 botões, a lista por nome aberta ali mesmo e só o que aparece
	for caso in [["rec", {"barra_ferro": true, "minerio_cobre": true, "pocao": true}, {}, "1-mochila-recursos.png"],
			["eq", {}, {1: true, 2: true, 3: true, 4: true}, "2-mochila-equipamento.png"]]:
		var fundo := ColorRect.new()
		fundo.color = Color(0.09, 0.08, 0.07)
		fundo.size = Vector2(W, H)
		root.add_child(fundo)
		M.ver_fora = {"k": caso[1], "r": caso[2]}
		var tela := VBoxContainer.new()
		tela.position = Vector2(40, 20)
		tela.custom_minimum_size = Vector2(700, 0)
		tela.add_theme_constant_override("separation", 10)
		root.add_child(tela)
		var topo := HBoxContainer.new()
		topo.add_theme_constant_override("separation", 6)
		topo.add_child(M.rotulo("Mochila", 20, M.OURO))
		var esp := Control.new()
		esp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		topo.add_child(esp)
		for t in ["Organizar", "Filtro"]:
			topo.add_child(M.botao(t, func(): pass, 15, t != "Organizar"))
		tela.add_child(topo)
		var linha := HBoxContainer.new()
		var bv: HBoxContainer = M.botoes_ver(moch, func(): pass)
		linha.add_child(bv)
		tela.add_child(linha)
		var g := GridContainer.new()
		g.columns = 10
		g.add_theme_constant_override("h_separation", 6)
		g.add_theme_constant_override("v_separation", 6)
		for i in M.ids_visiveis(moch, true):
			g.add_child(M.celula_mochila(i, true))
		tela.add_child(g)
		await esperar(4)
		M.abrir_menu_ver(bv.get_child(0 if caso[0] == "eq" else 1), moch, caso[0] == "eq", func(): pass)
		if M._menu_ver.get_parent() == M: # o menu da foto não está na árvore: o menuzinho vai para a raiz
			M.remove_child(M._menu_ver)
			root.add_child(M._menu_ver)
			M.abrir_menu_ver(bv.get_child(0 if caso[0] == "eq" else 1), moch, caso[0] == "eq", func(): pass)
		await esperar(12)
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(saida + "/" + caso[3])
		M._menu_ver.hide()
		tela.queue_free()
		fundo.queue_free()
		await esperar(3)
	M.ver_fora = {"k": {"barra_ferro": true, "minerio_cobre": true}, "r": {}}
	# 2) Baú do Clã: os dois lados com os botões de tipo + a janelinha "Guardar"
	var C = load("res://construcao.gd").new(falso)
	C.tela = CanvasLayer.new()
	root.add_child(C.tela)
	C._montar_tela_bau()
	C.bau_cla = true
	C.bau_slots = 70
	var bau: Array = []
	bau.resize(70)
	bau[0] = {"k": "carne", "n": 50}
	bau[1] = {"k": "carne", "n": 50}
	bau[2] = {"k": "lenha", "n": 50}
	bau[3] = {"k": "carne", "n": 50}
	bau[4] = {"k": "espada", "r": 1}
	bau[5] = {"k": "minerio_cobre", "n": 40}
	bau[6] = {"k": "carne", "n": 31}
	C.bau_itens = bau
	C.bau_prox = null
	C.painel_bau.visible = true
	C._montar_bau()
	await esperar(5)
	await esperar(10)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/3-bau-do-cla.png")
	C.tela.queue_free()
	await esperar(3)
	# 3) troca: botões de tipo em cima da mochila + a janelinha "Pôr"
	var T = load("res://troca.gd").new(falso)
	root.add_child(T)
	await process_frame
	M.ver_fora = {"k": {}, "r": {2: true, 3: true, 4: true}}
	T.estado = {"nome": "Dário", "eu": {"itens": [{"i": 2, "n": 37, "it": moch[2]}], "ouro": 0}, "ele": {"itens": [], "ouro": 0}}
	T.raiz.visible = true
	T.montar()
	await esperar(10)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/4-troca.png")
	quit()

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
	# 1) venda (Vender vários): botões de tipo + mochila + a janelinha "Vender"
	var fundo := ColorRect.new()
	fundo.color = Color(0.09, 0.08, 0.07)
	fundo.size = Vector2(W, H)
	root.add_child(fundo)
	var tela := VBoxContainer.new()
	tela.position = Vector2(40, 20)
	tela.add_theme_constant_override("separation", 10)
	root.add_child(tela)
	tela.add_child(M.rotulo("Mochila · Vender vários", 20, M.OURO))
	M.vendendo = true
	M.marcados = {4: true, 11: true}
	var linha := HBoxContainer.new()
	linha.add_theme_constant_override("separation", 6)
	linha.custom_minimum_size = Vector2(700, 0)
	M.barra_venda(linha)
	tela.add_child(linha)
	tela.add_child(M.chips_venda())
	var g := GridContainer.new()
	g.columns = 10
	g.add_theme_constant_override("h_separation", 6)
	g.add_theme_constant_override("v_separation", 6)
	for i in 30:
		g.add_child(M.celula_mochila(i, true))
	tela.add_child(g)
	var camada := CanvasLayer.new()
	camada.layer = 20
	root.add_child(camada)
	M.vender_qtd(1)
	var c: Control = M._confirma
	M.remove_child(c)
	camada.add_child(c)
	M._qtd = 120
	(c.get_meta("mostrar") as Callable).call()
	await esperar(15)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/1-venda.png")
	M.fechar_confirma()
	camada.queue_free()
	tela.queue_free()
	await esperar(3)
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
	var camada2 := CanvasLayer.new()
	camada2.layer = 20
	root.add_child(camada2)
	M.pedir_qtd(moch[0], M.total_igual(moch, 0), "Guardar", func(n): print("guardar ", n))
	var c2: Control = M._confirma
	M.remove_child(c2)
	camada2.add_child(c2)
	M._qtd = 173
	(c2.get_meta("mostrar") as Callable).call()
	await esperar(15)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/2-bau-do-cla.png")
	M.fechar_confirma()
	camada2.queue_free()
	await esperar(3)
	root.get_texture().get_image().save_png(saida + "/2b-bau-sem-janela.png")
	C.tela.queue_free()
	await esperar(3)
	# 3) troca: botões de tipo em cima da mochila + a janelinha "Pôr"
	var T = load("res://troca.gd").new(falso)
	root.add_child(T)
	await process_frame
	T.estado = {"nome": "Dário", "eu": {"itens": [{"i": 2, "n": 37, "it": moch[2]}], "ouro": 0}, "ele": {"itens": [], "ouro": 0}}
	T.raiz.visible = true
	T.montar()
	var camada3 := CanvasLayer.new()
	camada3.layer = 20
	root.add_child(camada3)
	M.pedir_qtd(moch[0], M.total_igual(moch, 0), "Pôr", func(n): print("pôr ", n))
	var c3: Control = M._confirma
	M.remove_child(c3)
	camada3.add_child(c3)
	M._qtd = 80
	(c3.get_meta("mostrar") as Callable).call()
	await esperar(15)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/3-troca.png")
	quit()

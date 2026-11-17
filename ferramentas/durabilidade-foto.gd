extends SceneTree
# Foto da durabilidade e do reforço nos equipamentos (André 2026-11-17: "barra de durabilidade discreta... quando ficar
# quebrada mesmo vestida ela fique vermelha", "o número do reforço tá muito pequeno" e "Def x / Vida x / Durabilidade
# x/x" um por linha). Usa o código de verdade do menu (medalhões, quadradinhos da mochila e cartão da peça) sem abrir o
# jogo inteiro (não precisa dos modelos): só a parte de UI, num fundo escuro.
# Uso: FOTO_SAIDA=/pasta FOTO_NOME=depois- xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 \
#   --render-thread safe -s ../ferramentas/durabilidade-foto.gd
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
var pre := OS.get_environment("FOTO_NOME")
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func _initialize() -> void:
	var w := 1280
	var h := 576
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
	M.boneco_modo = "Espada" # a Arma mostra a espada vestida
	var P = falso.P
	P.prog["equip"] = {"corpo": {"k": "peitoral", "r": 3, "d": 0, "e": 2}, "pernas": {"k": "calca", "r": 2, "d": 60, "e": 1},
		"pes": {"k": "botas", "r": 3, "d": 20}, "capa": {"k": "capa", "r": 3, "e": 3}, "espada": {"k": "espada", "r": 2, "d": 90, "e": 4},
		"cabeca": {"k": "chapeu", "r": 1}, "acessorio": {"k": "colar", "r": 2, "d": 40, "e": 10}}
	var tela := Control.new()
	tela.size = Vector2(w, h)
	root.add_child(tela)
	var t1 = M.rotulo("Vestidas (medalhões do personagem)", 16, Color(0.95, 0.82, 0.55))
	t1.position = Vector2(30, 14)
	tela.add_child(t1)
	var x := 40.0
	for d in M.SLOTS:
		var s: Control = M.slot(d[0], d[1])
		s.position = Vector2(x, 52)
		tela.add_child(s)
		x += 92
	M.atualizar_slots()
	var t2 = M.rotulo("Na mochila", 16, Color(0.95, 0.82, 0.55))
	t2.position = Vector2(30, 150)
	tela.add_child(t2)
	var bag := [{"k": "peitoral", "r": 1, "d": 0}, {"k": "calca", "r": 2, "d": 70, "e": 2}, {"k": "botas", "r": 1, "d": 20},
		{"k": "capa", "r": 0}, {"k": "espada", "r": 3, "e": 5}, {"k": "colar", "r": 4, "d": 50, "e": 12}]
	var linha := HBoxContainer.new()
	linha.add_theme_constant_override("separation", 10)
	linha.position = Vector2(40, 186)
	tela.add_child(linha)
	for it in bag:
		linha.add_child(M.celula(it, false, func(): pass, 64))
	# cartões: a peça quebrada vestida, uma gasta da mochila e o colar vestido
	var cartoes := HBoxContainer.new()
	cartoes.add_theme_constant_override("separation", 12)
	cartoes.position = Vector2(20, 272)
	tela.add_child(cartoes)
	for par in [[P.prog.equip.corpo, -1, "corpo"], [bag[1], 1, ""], [P.prog.equip.acessorio, -1, "acessorio"]]:
		var pn := PanelContainer.new()
		pn.add_theme_stylebox_override("panel", M.caixa(Color(0.05, 0.045, 0.04, 0.97), Color(0.35, 0.3, 0.22), 1, 8))
		pn.custom_minimum_size = Vector2(405, 290)
		pn.clip_contents = true
		var det: Control = M.detalhe(par[0], par[1], par[2], false)
		det.custom_minimum_size.x = 390
		pn.add_child(det)
		cartoes.add_child(pn)
	await esperar(20)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + pre + "equip.png")
	quit()

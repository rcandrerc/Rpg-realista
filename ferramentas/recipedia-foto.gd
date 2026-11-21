extends SceneTree
# Fotos da Recipedia e do Criar da bolsa (André 2026-11-21: "separar completamente" e "um Recipedia... incluindo os packs").
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 \
#   --render-thread safe -s ../ferramentas/recipedia-foto.gd
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
var w := 1280
var h := 720

func _initialize() -> void:
	DisplayServer.window_set_size(Vector2i(w, h))
	root.size = Vector2i(w, h)
	var sc := GDScript.new()
	sc.source_code = "extends Node\nvar P\nvar menu\nvar sons\nvar hud = self\nvar npcs = []\nvar transporte\nvar construcao\nvar trabalho\nvar tempo := 0.0\nfunc on(): return true\nfunc aviso(t): print('aviso: ', t)\nfunc rede(t, msg = {}): print('rede: ', t, ' ', msg)\n"
	sc.reload()
	var falso := Node.new()
	falso.set_script(sc)
	falso.P = load("res://progresso.gd").new()
	root.add_child(falso)
	var W = JSON.parse_string(FileAccess.get_file_as_string("res://dados/mundo.json"))
	for n in W.get("npcs", []):
		if str(n.get("funcao", "")) == "pack":
			falso.npcs.append({"nome": n.nome, "funcao": "pack", "info": n})
	var P = falso.P
	P.prog.mochila = [{"k": "lenha", "n": 37}, {"k": "pedra", "n": 12}, {"k": "barra_ferro", "n": 8}, {"k": "couro", "n": 5}, {"k": "tecido", "n": 6},
		{"k": "minerio_ferro", "n": 9}, {"k": "barra_cobre", "n": 2}, {"k": "carne", "n": 3}]
	for qual in ["recipedia", "recipedia-packs", "criar-bolsa"]:
		var M = load("res://menu.gd").new(falso)
		M.m = falso
		falso.menu = M
		var tela := _moldura(M, "criar" if qual == "criar-bolsa" else "recipedia")
		root.add_child(tela)
		if qual == "recipedia":
			M.grupos_rec = {"armaduras": true}
			M.rar_rec = {"peitoral": 0}
			M.montar_recipedia()
		elif qual == "recipedia-packs":
			M.est_rec = "pack"
			for mk in M.mercadores_pack():
				M.grupos_rec["pack:" + mk[0]] = true
			M.montar_recipedia()
		else:
			M.est_criar = ""
			M.grupos_abertos = {"ferramentas": true}
			M.montar_criar_quimera()
		for i in 12:
			await process_frame
		await RenderingServer.frame_post_draw
		root.get_texture().get_image().save_png(saida + "/%s.png" % qual)
		tela.queue_free()
		await process_frame
	quit()

# a moldura do menu com as abas da bolsa em cima e a lista embaixo (o boneco da esquerda fica de fora da foto)
func _moldura(M, ativa: String) -> Control:
	var tela := Control.new()
	tela.size = Vector2(w, h)
	var fundo := ColorRect.new()
	fundo.color = Color(0.09, 0.08, 0.07)
	fundo.size = Vector2(w, h)
	tela.add_child(fundo)
	var col := VBoxContainer.new()
	col.position = Vector2(30, 20)
	col.size = Vector2(w - 60, h - 40)
	col.add_theme_constant_override("separation", 8)
	tela.add_child(col)
	var abas := HBoxContainer.new()
	abas.add_theme_constant_override("separation", 6)
	for a in [["mochila", "Mochila"], ["criar", "Criar"], ["recipedia", "Recipedia"]]:
		var b = M.botao(a[1], func(): pass, 16, a[0] == ativa)
		b.custom_minimum_size = Vector2(104, 40)
		abas.add_child(b)
	col.add_child(abas)
	var rol := ScrollContainer.new()
	rol.size_flags_vertical = Control.SIZE_EXPAND_FILL
	rol.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	col.add_child(rol)
	var cont := VBoxContainer.new()
	cont.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cont.add_theme_constant_override("separation", 8)
	rol.add_child(cont)
	M.conteudo = cont
	M.rolagem = rol
	return tela

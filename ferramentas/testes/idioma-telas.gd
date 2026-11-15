extends SceneTree
# Varredura das janelas do jogo em inglês (André 2026-11-15: "joguei em inglês e várias janelas ainda vinham em
# português, por exemplo a barrinha de criar dizia Criando"). Abre o jogo de verdade, troca para English, abre cada
# janela (menus, abas, Criar, construção, carrinho, chat, mapa, configurações, a barrinha de criar...) e lista todo
# texto visível que ainda parece português. Depois faz o contrário: em Português, lista o que parece inglês.
# Uso: xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/testes/idioma-telas.gd
#  FOTO_SAIDA=/pasta tira foto de cada janela; SAIDA=arquivo.json grava a lista.
const Idioma = preload("res://idioma.gd")
var m
var fotos := OS.get_environment("FOTO_SAIDA")
var achados := {} # texto -> [idioma, janela, caminho]
var PT := RegEx.create_from_string("(?i)[ãõçáéíóúâêôà]|\\b(de|da|dos|das|para|com|não|você|seu|sua|uma|um|que|ao|na|em|pra|sem|seus|suas|mais|aqui|toque|fale)\\b")
var EN := RegEx.create_from_string("\\b(the|you|your|to|of|and|with|tap|for|is|are|this|here|from|not)\\b")
# nomes próprios com acento (ficam iguais em inglês)
const NOMES := ["Age of Embers", "Cecília", "Lúcia", "Tomás", "Dário", "José", "Mônica", "Português", "Aethra", "André Coutinho"]

var ingles := {} # frases e linhas que já são o inglês do dicionário (nomes com acento: Sálvia, Maíra...)
var licenca := false

func esperar(k: int) -> void:
	for i in k:
		await process_frame

func foto(nome: String) -> void:
	if fotos == "":
		return
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(fotos + "/" + nome + ".png")

func _visivel(c: CanvasItem) -> bool:
	return c.is_visible_in_tree()

func _mostrado(n: Node) -> Array:
	var r := []
	if n is Label3D:
		var t3 := (n as Label3D).text
		r.append(n.atr(t3) if n.can_auto_translate() else t3)
	if n is Label or n is Button or n is RichTextLabel or n is LineEdit:
		var t := ""
		if n is RichTextLabel:
			t = (n as RichTextLabel).get_parsed_text()
		elif n is LineEdit:
			t = (n as LineEdit).text if (n as LineEdit).text != "" else (n as LineEdit).placeholder_text
			t = n.atr(t) if n.can_auto_translate() else t
		else:
			t = n.text
			t = n.atr(t) if n.can_auto_translate() else t
		if t.strip_edges() != "":
			r.append(t)
	if n is Control and (n as Control).tooltip_text != "":
		r.append(n.atr((n as Control).tooltip_text))
	return r

func varrer(janela: String) -> void:
	await esperar(6)
	_andar(root, janela)
	await foto(Idioma.atual + "-" + janela)

func _andar(n: Node, janela: String) -> void:
	if n is CanvasItem and not _visivel(n):
		return
	if n is Node3D and not (n as Node3D).is_visible_in_tree():
		return
	if n is CanvasLayer and not (n as CanvasLayer).visible:
		return
	for t in _mostrado(n):
		for linha in str(t).split("\n"):
			var l := linha.strip_edges()
			if l.length() < 3 or achados.has(l):
				continue
			var limpo := l
			for nome in NOMES:
				limpo = limpo.replace(nome, "")
			if Idioma.atual == "en" and ingles.has(l):
				continue
			if janela == "topo-creditos" and Idioma.atual == "pt" and l.length() > 40: # licença MIT do Godot: vai em inglês mesmo
				continue
			var parece := PT.search(limpo) != null if Idioma.atual == "en" else EN.search(limpo) != null
			if parece:
				achados[l] = [Idioma.atual, janela, str(n.get_path()).get_slice("/", -1)]
	for f in n.get_children():
		_andar(f, janela)

func _tentar(alvo, metodo: String, args := []) -> void:
	if alvo != null and is_instance_valid(alvo) and alvo.has_method(metodo):
		alvo.callv(metodo, args)

func rodada() -> void:
	await varrer("jogo")
	# menu do personagem e da bolsa, aba por aba
	for aba in ["status", "habilidades", "profissoes", "titulos", "aparencia", "missoes", "mochila", "criar", "loja"]:
		_tentar(m.menu, "abrir", [aba])
		await varrer("menu-" + aba)
	if m.menu:
		for c in m.menu.CATS_CRIAR:
			m.menu.abrir("criar")
			m.menu.trocar_cat_criar(c[0])
			await varrer("criar-" + c[0])
		for sub in m.menu.SUB_PROF:
			m.menu.abrir("profissoes", sub)
			await varrer("prof-" + sub)
		_tentar(m.menu, "fechar")
	for q in ["conta", "multi", "config", "creditos"]:
		_tentar(m.menu_topo, "abrir", [q])
		await varrer("topo-" + q)
		_tentar(m.menu_topo, "fechar")
	# barrinha de criar (a do "Criando" que o André viu)
	if m.construcao:
		var k: String = m.P.dados.itens.keys()[0]
		m.construcao.fabricando({"k": k, "nome": "Barra de ferro", "v": "Criando", "n": 3, "feito": 1, "dur": 30.0})
		await esperar(4)
		await varrer("barrinha-criar")
		m.construcao.fabricando({"k": k, "nome": "Espada", "v": "Destruindo", "n": 2, "feito": 0, "dur": 30.0})
		await varrer("barrinha-destruir")
		m.construcao.fabricando({"k": k, "nome": "Barra de ferro", "fim": true, "feito": 3})
		await varrer("barrinha-pronto")
		for f in ["abrir", "abrir_correio", "abrir_bau", "abrir_forno"]:
			_tentar(m.construcao, f)
			await varrer("obra-" + f)
			_tentar(m.construcao, "fechar")
	for par in [["chat", "abrir"], ["minimapa", "abrir"], ["leilao_ui", "abrir"], ["editar_hud", "abrir"], ["amigos", "abrir"],
			["transporte", "abrir_carrinho"], ["transporte", "abrir_navio"], ["main", "abrir_aparencia"]]:
		var alvo = m if par[0] == "main" else m.get(par[0])
		_tentar(alvo, par[1])
		await varrer(par[0] + "-" + par[1])
		_tentar(alvo, "fechar")
	# mochila cheia de itens de todo tipo: abre a janela de cada um (nome, descrição, botões)
	if m.menu and m.P:
		var mo: Array = m.P.prog.mochila
		var ks: Array = m.P.dados.itens.keys()
		var passo := maxi(1, ks.size() / 40)
		var i := 0
		for j in range(0, ks.size(), passo):
			if i >= mo.size():
				break
			mo[i] = {"k": ks[j], "n": 2, "r": j % 3}
			i += 1
		m.P.mudou = true
		m.menu.abrir("mochila")
		await varrer("mochila-cheia")
		for n in mini(i, 40):
			if not m.menu.aberto():
				m.menu.abrir("mochila")
			_tentar(m.menu, "tocar_mochila", [n])
			await varrer("item-" + str(ks[n * passo]))
			_tentar(m.menu, "fechar_item")
		for aba in ["criar", "loja", "status"]:
			m.menu.abrir(aba)
			await varrer("cheia-" + aba)
		_tentar(m.menu, "fechar")
	# conversa com cada NPC
	if m.conversa:
		for n in m.npcs.slice(0, 40):
			if not (n is Dictionary) or str(n.get("funcao", "")) == "totem":
				continue
			_tentar(m.conversa, "abrir", [n])
			await varrer("npc-" + str(n.get("id", "")))
			_tentar(m.conversa, "fechar")
	# missão ativa no canto (cartão da missão) e time de 2 (como o servidor manda)
	if m.nevoa and m.P:
		m.P.prog["hist"] = {"p": 5, "ac": true, "e": 0, "n": 0}
		var M: Dictionary = m.nevoa.missao_atual()
		m.P.hist_info = {"id": str(M.get("id", "")), "cap": int(M.get("cap", 0)), "nome": str(M.get("nome", "")), "txt": "Confira sua barra de habilidades (Menu > Habilidades)", "e": 0, "ev": "barra"}
	if m.amigos:
		m.amigos.time = [{"id": "c1", "nome": "Cecília", "nivel": 12, "vida": 80, "vidaMax": 100, "mana": 40, "manaMax": 60, "morto": true}]
		m.amigos.lider = "c1"
	await varrer("jogo-missao")
	# janelinha de quantos criar
	if m.construcao:
		for k in m.P.dados.itens.keys().slice(0, 3):
			_tentar(m.construcao, "pedir_criar", ["item", k])
			await varrer("quantos-" + str(k))
	# caído
	if m.morte:
		_tentar(m.morte, "_caiu")
		await varrer("caido")
		_tentar(m.morte, "_levantou")
	_tentar(m.online, "mostrar_login")
	await varrer("login")
	_tentar(m.online, "esconder_login")

func _initialize() -> void:
	DisplayServer.window_set_size(Vector2i(1280, 576))
	root.size = Vector2i(1280, 576)
	var d = JSON.parse_string(FileAccess.get_file_as_string("res://dados/idioma_en.json"))
	for k in d:
		for linha in str(d[k]).split("\n"):
			ingles[linha.strip_edges()] = true
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	_tentar(m.online, "esconder_login")
	for lingua in (["en", "pt"] if OS.get_environment("ORDEM") == "en" else ["pt", "en"]):
		Idioma.trocar(lingua)
		await esperar(10)
		await rodada()
	var lista := []
	for t in achados:
		lista.append({"texto": t, "idioma": achados[t][0], "janela": achados[t][1], "no": achados[t][2]})
		print("ACHOU [%s] %s | %s" % [achados[t][0], achados[t][1], t])
	print("idioma-telas: %d textos fora do idioma" % lista.size())
	if OS.get_environment("SAIDA") != "":
		var f := FileAccess.open(OS.get_environment("SAIDA"), FileAccess.WRITE)
		f.store_string(JSON.stringify(lista, "\t"))
	quit()

extends SceneTree
# Teste do guia das missões (godot-prototipo/guia.gd) sem o jogo inteiro: um "main" de mentira com a mochila, o menu,
# o menu do topo e a HUD só com o que o guia lê. Confere, passo a passo, qual botão pisca.
# Rodar (Godot 4.5): godot --headless --path godot-prototipo --script ../ferramentas/testes/guia-godot.gd

const Guia = preload("res://guia.gd")

class FakeP:
	var hist_info := {}
	var prog := {"mochila": [], "barras": {}}
	var dados := {"mochila": 40, "raridades": [{}, {}, {}, {}, {}], "itens": {"peitoral": {"lugar": "corpo"}, "lenha": {}, "espada": {"lugar": "espada"}},
		"fornalha": {"combustivel": {"lenha": 12, "carvao": 30}, "receitas": {"minerio_cobre": {"faz": "barra_cobre"}, "lenha": {"faz": "carvao"}}},
		"receitas": {}, "construcoes": {"bancada": {"aba": "moveis"}}}
	func eh_equip(it) -> bool:
		return it is Dictionary and dados.itens.get(str(it.k), {}).has("lugar")
	func reforco_max(_it) -> int:
		return 10
	func contar(k: String) -> int:
		var n := 0
		for it in prog.mochila:
			if it != null and str(it.k) == k:
				n += int(it.get("n", 1))
		return n
	func carrinho_no_mundo() -> bool:
		return false

class FakeNevoa:
	var id := "a15"
	func missao_atual() -> Dictionary:
		return {"id": id}

class FakeHud:
	var bloqueado := false
	var editando := false
	var em_combate := false
	var modo_construcao := false
	var esconder_combate := false
	var caido := false
	var botoes := [{"acao": "falar", "c": Vector2(500, 300), "raio": 30.0, "oculto": true, "icone": "falar", "travado": false},
		{"acao": "forno", "c": Vector2(400, 300), "raio": 30.0, "oculto": true, "icone": "f", "travado": false}]
	func botao(acao: String) -> Dictionary:
		for b in botoes:
			if b.acao == acao:
				return b
		return {}
	func _centro(b: Dictionary) -> Vector2:
		return b.c
	func painel_rect() -> Rect2:
		return Rect2(10, 10, 200, 80)

class FakeMenu:
	var raiz: Control
	var aba := "mochila"
	var botoes_aba := {}
	var est_criar := ""
	var grupos_abertos := {}
	var marcados := {}
	var sel_mochila := -1
	var vendendo := false
	var _confirma: Control = null
	var _reset: Control = null
	var janela: Control = null
	func aberto() -> bool:
		return raiz.visible
	func janela_aberta() -> bool:
		return false
	func itens_criar(g: String) -> Array:
		return [{"k": "machado"}] if g == "ferramentas" else []

class FakeTopo:
	var raiz: Control
	var janela: Control
	var recolhido := false

class FakeMissao:
	var cartao: Control
	var ir_btn: Button
	var PERTO_NPC := 4.0
	var destino := {}
	func alvo() -> Dictionary:
		return destino

class FakeCons:
	var painel_qtd: Control
	var painel_forno: Control
	var painel_bau: Control
	var tela: CanvasLayer
	var forno := {}
	var forno_tipo := "fornalha"
	var forno_alvo := "ent"
	var ativo := false
	var comprando := false

class FakeConversa:
	var raiz: Control
	func aberto() -> bool:
		return raiz.visible

class FakeMain extends Node:
	var P
	var nevoa
	var hud
	var menu
	var menu_topo
	var missao_ativa
	var construcao
	var conversa
	var leilao = null
	var troca = null
	var transporte = null
	var minimapa = null
	var chat = null
	var criador = null
	var reforco = null
	var cinematica = null
	var rota = null
	var montaria = null
	var heroi: Node3D
	var h := {"morto": 0.0}

var falhas := 0
var oks := 0

func confere(cond: bool, txt: String) -> void:
	if cond:
		oks += 1
	else:
		falhas += 1
		print("FALHOU: ", txt)

func botao(pai: Node, texto: String, meta := "") -> Button:
	var b := Button.new()
	b.text = texto
	b.size = Vector2(80, 30)
	if meta != "":
		b.set_meta("guia", meta)
	pai.add_child(b)
	return b

func _initialize() -> void:
	var raiz := Control.new()
	root.add_child(raiz)
	var m := FakeMain.new()
	m.P = FakeP.new()
	m.nevoa = FakeNevoa.new()
	m.hud = FakeHud.new()
	m.heroi = Node3D.new()
	m.add_child(m.heroi)
	# menu do topo
	var topo := FakeTopo.new()
	topo.raiz = Control.new()
	raiz.add_child(topo.raiz)
	var b_moch := botao(topo.raiz, "", "topo:mochila")
	var b_seta := botao(topo.raiz, "", "topo:seta")
	topo.janela = Control.new()
	topo.janela.visible = false
	raiz.add_child(topo.janela)
	m.menu_topo = topo
	# barrinha da missão
	var ma := FakeMissao.new()
	ma.cartao = Control.new()
	raiz.add_child(ma.cartao)
	ma.ir_btn = botao(ma.cartao, "Ir")
	m.missao_ativa = ma
	# menu do personagem
	var mn := FakeMenu.new()
	mn.raiz = Control.new()
	mn.raiz.visible = false
	raiz.add_child(mn.raiz)
	var x := botao(mn.raiz, "", "fechar")
	for a in ["status", "mochila", "criar"]:
		mn.botoes_aba[a] = botao(mn.raiz, a.capitalize(), "")
	var grade := Control.new()
	mn.raiz.add_child(grade)
	m.menu = mn
	# construção / conversa (fechadas)
	var cons := FakeCons.new()
	cons.painel_qtd = Control.new()
	cons.painel_qtd.visible = false
	raiz.add_child(cons.painel_qtd)
	cons.painel_forno = Control.new()
	cons.painel_forno.visible = false
	raiz.add_child(cons.painel_forno)
	cons.painel_bau = Control.new()
	cons.painel_bau.visible = false
	raiz.add_child(cons.painel_bau)
	m.construcao = cons
	var cv := FakeConversa.new()
	cv.raiz = Control.new()
	cv.raiz.visible = false
	raiz.add_child(cv.raiz)
	m.conversa = cv
	root.add_child(m)
	var g := Guia.new(m)
	root.add_child(g)
	await process_frame

	# ---------- destruir: mochila > peça > Destruir > Só esta ----------
	m.P.prog.mochila = [{"k": "lenha", "n": 3}, {"k": "peitoral", "r": 0}, null]
	m.P.hist_info = {"id": "a15", "ev": "destruir", "npc": ""}
	confere(g.passos(m.P.hist_info)[0] == "topo:mochila", "destruir começa na mochila")
	g._procurar()
	confere(g._alvo == b_moch, "1. pisca o ícone da mochila")
	topo.recolhido = true
	g._procurar()
	confere(g._alvo == b_seta, "menu do topo recolhido: pisca a seta")
	topo.recolhido = false
	# abriu o menu na aba Status (grupo do personagem): a aba Mochila não aparece -> pisca o X
	mn.raiz.visible = true
	mn.aba = "status"
	mn.botoes_aba.mochila.visible = false
	g._procurar()
	confere(g._alvo == x, "menu no grupo errado: pisca o X")
	mn.botoes_aba.mochila.visible = true
	g._procurar()
	confere(g._alvo == mn.botoes_aba.mochila, "aba Mochila pisca")
	mn.aba = "mochila"
	var celulas := []
	for i in 3:
		var c := botao(grade, "", "")
		c.set_meta("guia_i", i)
		celulas.append(c)
	g._procurar()
	confere(g._alvo == celulas[1], "2. pisca a primeira peça de equipamento (não a lenha)")
	mn.sel_mochila = 1
	var b_dest := botao(mn.raiz, "Destruir")
	g._procurar()
	confere(g._alvo == b_dest, "3. pisca Destruir")
	var conf := Control.new()
	raiz.add_child(conf)
	var b_so := botao(conf, "Só esta")
	botao(conf, "Cancelar")
	mn._confirma = conf
	g._procurar()
	confere(g._alvo == b_so, "4. na confirmação pisca Só esta")
	mn._confirma = null
	conf.queue_free()
	b_dest.queue_free()
	await process_frame
	# fechou tudo no meio: volta para a mochila
	mn.raiz.visible = false
	mn.sel_mochila = -1
	g._procurar()
	confere(g._alvo == b_moch, "fechou o menu no meio: a mochila pisca de novo")

	# ---------- falar: Ir longe, Falar perto, Missão na conversa ----------
	m.P.hist_info = {"id": "a15", "npc": "ferreiro", "ev": "falar"}
	ma.destino = {"pos": Vector2(50, 0), "npc": "ferreiro"}
	g._procurar()
	confere(g._alvo == ma.ir_btn, "longe do NPC: pisca o Ir")
	m.hud.em_combate = true
	g._procurar()
	confere(not g._tem(), "brigando: o Ir não pisca")
	m.hud.em_combate = false
	m.heroi.position = Vector3(48, 0, 0)
	m.hud.botoes[0].oculto = false
	g._procurar()
	confere(g._circ.z > 0.0 and Vector2(g._circ.x, g._circ.y) == Vector2(500, 300), "perto: pisca o botão Falar da HUD")
	cv.raiz.visible = true
	var b_outro := botao(cv.raiz, "Conversar")
	var b_missao := botao(cv.raiz, "Missão: Lâmina e Reforço")
	g._procurar()
	confere(g._alvo == b_missao, "na conversa: pisca Missão")
	cv.raiz.visible = false
	m.hud.botoes[0].oculto = true

	# ---------- criar machado: mochila > Criar > Ferramentas > Criar > Criar 1 ----------
	m.P.hist_info = {"id": "a2", "ev": "criar", "k": "machado", "npc": ""}
	m.nevoa.id = "a2"
	ma.destino = {}
	g._procurar()
	confere(g._alvo == b_moch, "criar: mochila primeiro")
	mn.raiz.visible = true
	mn.aba = "mochila"
	g._procurar()
	confere(g._alvo == mn.botoes_aba.criar, "criar: aba Criar")
	mn.aba = "criar"
	var cab := botao(mn.raiz, "", "grupo:ferramentas")
	g._procurar()
	confere(g._alvo == cab, "criar: abre o grupo Ferramentas")
	mn.grupos_abertos["ferramentas"] = true
	var b_criar := botao(mn.raiz, "Criar", "criar:machado")
	b_criar.disabled = true # falta material: pisca igual (o toque diz o que falta)
	g._procurar()
	confere(g._alvo == b_criar, "criar: o Criar do machado")
	mn.raiz.visible = false
	cons.painel_qtd.visible = true
	var b_q := botao(cons.painel_qtd, "Criar 1")
	g._procurar()
	confere(g._alvo == b_q, "criar: Criar 1 na janelinha")
	cons.painel_qtd.visible = false

	# ---------- fornalha: barra de cobre ----------
	m.P.hist_info = {"id": "a4", "ev": "criar", "k": "barra_cobre", "npc": ""}
	m.nevoa.id = "a4"
	m.P.prog.mochila = [{"k": "lenha", "n": 5}, {"k": "minerio_cobre", "n": 6}]
	m.hud.botoes[1].oculto = false
	g._procurar()
	confere(g._circ.z > 0.0 and Vector2(g._circ.x, g._circ.y) == Vector2(400, 300), "fornalha: pisca o botão da fornalha")
	cons.painel_forno.visible = true
	var l_comb := botao(cons.painel_forno, "", "forno:lugar:comb")
	var l_ent := botao(cons.painel_forno, "", "forno:lugar:ent")
	var l_sai := botao(cons.painel_forno, "", "forno:lugar:sai")
	var c_lenha := botao(cons.painel_forno, "")
	c_lenha.set_meta("guia_i", 0)
	var c_min := botao(cons.painel_forno, "")
	c_min.set_meta("guia_i", 1)
	g._procurar()
	confere(g._alvo == c_min, "fornalha: o minério no material")
	cons.forno = {"ent": {"k": "minerio_cobre", "n": 6}}
	g._procurar()
	confere(g._alvo == l_comb, "fornalha: lenha iria virar carvão -> toca no combustível antes")
	cons.forno_alvo = "comb"
	g._procurar()
	confere(g._alvo == c_lenha, "fornalha: a lenha no combustível")
	cons.forno = {"ent": {"k": "minerio_cobre", "n": 3}, "comb": {"k": "lenha", "n": 2}, "sai": {"k": "barra_cobre", "n": 1}}
	g._procurar()
	confere(g._alvo == l_sai, "fornalha: pega a barra pronta")
	cons.painel_forno.visible = false

	# ---------- sem missão: nada pisca ----------
	m.P.hist_info = {}
	g._procurar()
	confere(not g._tem(), "sem etapa: nada pisca")

	print("guia: %d ok, %d falhas" % [oks, falhas])
	quit(1 if falhas > 0 else 0)

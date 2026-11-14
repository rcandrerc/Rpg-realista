extends CanvasLayer
const Lentidao = preload("res://lentidao.gd") # quadro lento: Lentidao.parte
# A Casa do Comércio (história v2, Entrega 3; plano aprovado pelo André 2026-11-11): a janela do leilão do Otávio, no
# Rio Claro. Só online: quem decide é o servidor (shared/simulacao.js leilaoMsg, shared/leilao.js). Abre quando se fala
# com o Otávio (a fala dele chega com abrir: "leilao") e cada toque manda um pedido; a resposta (evento "leilao") traz a
# busca, os anúncios da pessoa e o que está guardado com ele.
# Abas: Comprar (busca por tipo e raridade, do mais barato ao mais caro), Vender (um item da mochila, preço e prazo de
# 24 ou 48 horas), Meus anúncios (até 10, cancelar) e Retirar (ouro das vendas e itens vencidos).

const Menu = preload("res://menu.gd")
const CEL := 46
const TIPOS := [["", "Tudo"], ["equip", "Peças"], ["mat", "Materiais"], ["comida", "Comida e poção"], ["tomo", "Tomos"], ["outro", "Outros"]]
const ORDENS := [["barato", "Mais barato"], ["caro", "Mais caro"], ["novo", "Mais novo"]]

var m # main.gd
var raiz: Control
var corpo: VBoxContainer
var abas_ui: HBoxContainer
var ouro_ui: HBoxContainer
var estado := {} # o último evento "leilao" do servidor
var aba := "comprar"
var busca := {"tipo": "", "r": -1, "ordem": "barato"}
var sel := -1 # lugar da mochila escolhido para vender
var pag := 0
var horas := 24
var preco_ui: LineEdit
var _recebido_ms := 0

func _init(principal) -> void:
	m = principal
	layer = 18 # como a troca: acima da HUD e da conversa, abaixo do menu do personagem

func _ready() -> void:
	raiz = Control.new()
	raiz.set_anchors_preset(Control.PRESET_FULL_RECT)
	raiz.visible = false
	add_child(raiz)
	var escuro := ColorRect.new()
	escuro.color = Color(0, 0, 0, 0.55)
	escuro.set_anchors_preset(Control.PRESET_FULL_RECT)
	raiz.add_child(escuro)
	var moldura := Panel.new()
	moldura.set_anchors_preset(Control.PRESET_FULL_RECT)
	moldura.offset_left = 22
	moldura.offset_top = 14
	moldura.offset_right = -22
	moldura.offset_bottom = -14
	moldura.add_theme_stylebox_override("panel", Menu.caixa(Menu.FUNDO, Menu.OURO.darkened(0.25), 2, Menu.RAIO_JANELA, 14))
	raiz.add_child(moldura)
	var tudo := VBoxContainer.new()
	tudo.set_anchors_preset(Control.PRESET_FULL_RECT)
	tudo.offset_left = 20
	tudo.offset_top = 12
	tudo.offset_right = -20
	tudo.offset_bottom = -12
	tudo.add_theme_constant_override("separation", 8)
	moldura.add_child(tudo)
	var topo := HBoxContainer.new()
	topo.add_theme_constant_override("separation", 12)
	tudo.add_child(topo)
	var ic := TextureRect.new()
	ic.texture = Menu.icone_tex("negociar")
	ic.custom_minimum_size = Vector2(30, 30)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.modulate = Menu.OURO_CLARO
	topo.add_child(ic)
	topo.add_child(Menu.rotulo("Casa do Comércio", 22, Menu.OURO_CLARO))
	abas_ui = HBoxContainer.new()
	abas_ui.add_theme_constant_override("separation", 6)
	abas_ui.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	abas_ui.alignment = BoxContainer.ALIGNMENT_CENTER
	topo.add_child(abas_ui)
	ouro_ui = HBoxContainer.new()
	topo.add_child(ouro_ui)
	var x := Menu.Fechar.new()
	x.gui_input.connect(func(ev): if (ev is InputEventMouseButton and ev.pressed) or (ev is InputEventScreenTouch and ev.pressed): fechar())
	topo.add_child(x)
	var linha := ColorRect.new()
	linha.color = Menu.BORDA
	linha.custom_minimum_size = Vector2(0, 1)
	tudo.add_child(linha)
	corpo = VBoxContainer.new()
	corpo.size_flags_vertical = Control.SIZE_EXPAND_FILL
	corpo.add_theme_constant_override("separation", 8)
	tudo.add_child(corpo)

func aberto() -> bool:
	return raiz != null and raiz.visible

func abrir() -> void:
	if not m.on():
		m.hud.aviso("O leilão só funciona conectado ao servidor")
		return
	if m.conversa.aberto():
		m.conversa.fechar()
	if m.menu.aberto():
		m.menu.fechar()
	sel = -1
	raiz.visible = true
	m.hud.bloqueado = true
	m.hud.esconder_combate = true
	m.sons.tocar("pano", -10.0)
	montar()

func fechar() -> void:
	if not aberto():
		return
	raiz.visible = false
	m.hud.esconder_combate = false
	if not m.menu.aberto() and not m.conversa.aberto():
		m.hud.bloqueado = false

# o servidor respondeu (evento "leilao"): abre a janela se a fala do Otávio pediu, e mostra o que veio
func do_servidor(ev: Dictionary) -> void:
	estado = ev
	_recebido_ms = Time.get_ticks_msec()
	if not aberto():
		abrir()
	else:
		montar()

func progresso_mudou() -> void:
	if aberto():
		montar()

func _process(_dt: float) -> void:
	var t0_parte := Time.get_ticks_usec()
	_process_parte(_dt)
	Lentidao.parte("leilao_ui", t0_parte) # quadro lento: quanto deste script (lentidao.gd)

func _process_parte(_dt: float) -> void:
	# andou para longe do Otávio (ou caiu): fecha
	if aberto() and (m.h.morto > 0.0 or not m.perto_do_npc("leilao", 6.0)):
		fechar()

func pedir(msg: Dictionary) -> void:
	var b := {"tipo": busca.tipo, "ordem": busca.ordem}
	if int(busca.r) >= 0:
		b.r = int(busca.r)
	msg.busca = b
	m.rede("leilao", msg)

# ---------- janela ----------
func montar() -> void:
	for c in abas_ui.get_children():
		abas_ui.remove_child(c)
		c.queue_free()
	var meus: Array = estado.get("meus", [])
	var cx: Dictionary = estado.get("caixa", {})
	var guardado: bool = int(cx.get("ouro", 0)) > 0 or not cx.get("itens", []).is_empty()
	for a in [["comprar", "Comprar"], ["vender", "Vender"], ["meus", "Meus anúncios (%d/%d)" % [meus.size(), int(estado.get("max", 10))]], ["retirar", "Retirar" + (" •" if guardado else "")]]:
		var b: Button = m.menu.botao(a[1], _aba.bind(a[0]), 14, aba == a[0])
		b.set_meta("guia", "leilao:aba:" + str(a[0])) # guia das missões (guia.gd)
		b.custom_minimum_size = Vector2(0, 34)
		abas_ui.add_child(b)
	for c in ouro_ui.get_children():
		ouro_ui.remove_child(c)
		c.queue_free()
	ouro_ui.add_child(m.menu.linha_ouro())
	for c in corpo.get_children():
		corpo.remove_child(c)
		c.queue_free()
	match aba:
		"comprar":
			_comprar()
		"vender":
			_vender()
		"meus":
			_meus()
		"retirar":
			_retirar()

func _aba(a: String) -> void:
	aba = a
	sel = -1
	if a == "comprar" or a == "meus" or a == "retirar":
		pedir({"acao": "ver"})
	montar()

func _rolagem() -> VBoxContainer:
	var sc := ScrollContainer.new()
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	corpo.add_child(sc)
	var v := VBoxContainer.new()
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.add_theme_constant_override("separation", 6)
	sc.add_child(v)
	return v

# quanto falta para vencer, em horas e minutos
func _resta(a: Dictionary) -> String:
	if a.get("casa", false):
		return "sempre à venda"
	var agora: float = float(estado.get("agora", 0)) + float(Time.get_ticks_msec() - _recebido_ms)
	var s := int(maxf(0.0, (float(a.get("ate", 0)) - agora) / 1000.0))
	return "vence em %d h %02d min" % [s / 3600, (s % 3600) / 60] if s > 0 else "vencido"

# uma linha: item, nome, quem vende, prazo, preço e o botão
func _linha(a: Dictionary, botao: String, fn: Callable) -> Control:
	var P = m.P
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", Menu.caixa(Menu.FUNDO2, Menu.BORDA, 1, 8))
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 10)
	p.add_child(h)
	var it: Dictionary = a.item
	h.add_child(m.menu.celula(it, false, m.hud.aviso.bind(P.nome_item(it)), CEL))
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.add_child(Menu.rotulo(P.nome_item(it) + ((" ×%d" % int(it.n)) if int(it.get("n", 1)) > 1 else ""), 15, P.cor_item(it)))
	col.add_child(Menu.rotulo("%s · %s" % [str(a.get("vendedor", "")), _resta(a)], 12, Menu.APAGADO))
	h.add_child(col)
	var pr := Menu.rotulo("%d de ouro" % int(a.preco), 15, Color("ffd36a"))
	pr.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	h.add_child(pr)
	var b: Button = m.menu.botao(botao, fn, 14, true)
	b.set_meta("guia", "leilao:" + botao.to_lower()) # guia.gd: "leilao:comprar"
	b.custom_minimum_size = Vector2(110, 36)
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	h.add_child(b)
	return p

func _comprar() -> void:
	var f := HBoxContainer.new()
	f.add_theme_constant_override("separation", 5)
	for t in TIPOS:
		var b: Button = m.menu.botao(t[1], _tipo.bind(t[0]), 13, busca.tipo == t[0])
		b.custom_minimum_size = Vector2(0, 30)
		f.add_child(b)
	var esp := Control.new()
	esp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	f.add_child(esp)
	for o in ORDENS:
		var b: Button = m.menu.botao(o[1], _ordem.bind(o[0]), 13, busca.ordem == o[0])
		b.custom_minimum_size = Vector2(0, 30)
		f.add_child(b)
	corpo.add_child(f)
	if busca.tipo == "equip": # raridade das peças
		var rr := HBoxContainer.new()
		rr.add_theme_constant_override("separation", 5)
		var bt: Button = m.menu.botao("Todas", _rar.bind(-1), 13, int(busca.r) < 0)
		bt.custom_minimum_size = Vector2(0, 28)
		rr.add_child(bt)
		var rars: Array = m.P.dados.get("raridades", [])
		for i in rars.size():
			var b: Button = m.menu.botao(str(rars[i].nome), _rar.bind(i), 13, int(busca.r) == i)
			b.custom_minimum_size = Vector2(0, 28)
			b.add_theme_color_override("font_color", Color(str(rars[i].cor)) if str(rars[i].cor).begins_with("#") else Menu.TEXTO)
			rr.add_child(b)
		corpo.add_child(rr)
	var v := _rolagem()
	var lista: Array = estado.get("lista", [])
	if lista.is_empty():
		v.add_child(Menu.rotulo("Nada à venda com esse filtro.", 14, Menu.APAGADO))
	for a in lista:
		v.add_child(_linha(a, "Comprar", _comprar_um.bind(a)))

func _tipo(t: String) -> void:
	busca.tipo = t
	busca.r = -1
	pedir({"acao": "ver"})

func _ordem(o: String) -> void:
	busca.ordem = o
	pedir({"acao": "ver"})

func _rar(r: int) -> void:
	busca.r = r
	pedir({"acao": "ver"})

func _comprar_um(a: Dictionary) -> void:
	if int(m.P.prog.ouro) < int(a.preco):
		m.hud.aviso("Faltam %d de ouro" % (int(a.preco) - int(m.P.prog.ouro)))
		return
	m.sons.tocar("moedas", -8.0)
	pedir({"acao": "comprar", "id": str(a.id)})

# ---------- vender ----------
func _vender() -> void:
	var P = m.P
	var h := HBoxContainer.new()
	h.size_flags_vertical = Control.SIZE_EXPAND_FILL
	h.add_theme_constant_override("separation", 18)
	corpo.add_child(h)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	h.add_child(v)
	v.add_child(Menu.rotulo("Toque no item que vai à venda", 15, Menu.OURO_CLARO))
	var por_pag: int = int(P.dados.mochila)
	var tem: int = int(P.prog.get("paginas", 1))
	pag = clampi(pag, 0, tem - 1)
	if tem > 1:
		var abas := HBoxContainer.new()
		abas.add_theme_constant_override("separation", 5)
		for n in tem:
			var b: Button = m.menu.botao("Página %d" % (n + 1), _pagina.bind(n), 13, n == pag)
			b.custom_minimum_size = Vector2(0, 28)
			b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			abas.add_child(b)
		v.add_child(abas)
	var g := GridContainer.new()
	g.columns = 10
	g.add_theme_constant_override("h_separation", 4)
	g.add_theme_constant_override("v_separation", 4)
	var fim: int = P.prog.mochila.size() if pag == tem - 1 else (pag + 1) * por_pag
	for i in range(pag * por_pag, min(P.prog.mochila.size(), fim)):
		var it = P.prog.mochila[i]
		var c: Button = m.menu.celula(it, i == sel, _escolher.bind(i), CEL)
		c.set_meta("guia_i", i) # guia.gd: o item para anunciar
		if it != null and it.get("cad", false):
			c.modulate = Color(1, 1, 1, 0.35) # cadeado: não vai à venda
		g.add_child(c)
	v.add_child(g)
	# o lado direito: o item escolhido, o preço e o prazo
	var d := VBoxContainer.new()
	d.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	d.add_theme_constant_override("separation", 8)
	h.add_child(d)
	var it = P.prog.mochila[sel] if sel >= 0 and sel < P.prog.mochila.size() else null
	if it == null:
		d.add_child(Menu.rotulo("Escolha um item da mochila. Pilha vai inteira.", 14, Menu.APAGADO))
	else:
		var l := HBoxContainer.new()
		l.add_theme_constant_override("separation", 10)
		l.add_child(m.menu.celula(it, true, func(): pass, 56))
		var nome := Menu.rotulo(P.nome_item(it) + ((" ×%d" % int(it.n)) if int(it.get("n", 1)) > 1 else ""), 16, P.cor_item(it))
		nome.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		l.add_child(nome)
		d.add_child(l)
		var loja: int = P.preco_venda(it) * maxi(1, int(it.get("n", 1)))
		d.add_child(Menu.rotulo("A loja paga %d de ouro por isso." % loja, 13, Menu.APAGADO))
		var pl := HBoxContainer.new()
		pl.add_theme_constant_override("separation", 8)
		pl.add_child(Menu.rotulo("Preço:", 15))
		preco_ui = LineEdit.new()
		preco_ui.virtual_keyboard_type = LineEdit.KEYBOARD_TYPE_NUMBER
		preco_ui.custom_minimum_size = Vector2(150, 36)
		preco_ui.text = str(maxi(1, loja * 2))
		preco_ui.add_theme_font_size_override("font_size", 16)
		pl.add_child(preco_ui)
		pl.add_child(Menu.rotulo("de ouro", 15))
		d.add_child(pl)
		var hl := HBoxContainer.new()
		hl.add_theme_constant_override("separation", 6)
		hl.add_child(Menu.rotulo("Prazo:", 15))
		for hh in estado.get("horas", [24, 48]):
			var b: Button = m.menu.botao("%d horas" % int(hh), _horas.bind(int(hh)), 14, horas == int(hh))
			b.custom_minimum_size = Vector2(100, 34)
			hl.add_child(b)
		d.add_child(hl)
		var sem := int(estado.get("semTaxa", 0))
		var taxa := int(round(float(estado.get("taxa", 0.05)) * 100.0))
		d.add_child(Menu.rotulo(("Sem taxa nas próximas %d vendas." % sem) if sem > 0 else ("Na venda sai uma taxa de %d%%." % taxa), 13, Menu.VERDE if sem > 0 else Menu.APAGADO))
		var an: Button = m.menu.botao("Anunciar", _anunciar, 16, true)
		an.custom_minimum_size = Vector2(180, 42)
		d.add_child(an)
	d.add_child(Menu.rotulo("O ouro da venda e o que vencer ficam com o Otávio: pegue na aba Retirar.", 12, Menu.APAGADO))

func _pagina(n: int) -> void:
	pag = n
	sel = -1
	montar()

func _escolher(i: int) -> void:
	var it = m.P.prog.mochila[i]
	if it == null:
		return
	if it.get("cad", false):
		m.hud.aviso("Item com cadeado não vai à venda. Abra o cadeado na mochila")
		return
	sel = -1 if sel == i else i
	montar()

func _horas(hh: int) -> void:
	horas = hh
	var t := preco_ui.text if preco_ui else ""
	montar()
	if preco_ui and t != "":
		preco_ui.text = t

func _anunciar() -> void:
	var p := int(preco_ui.text.strip_edges()) if preco_ui and preco_ui.text.strip_edges().is_valid_int() else 0
	if p < 1:
		m.hud.aviso("Escreva o preço em ouro")
		return
	m.sons.tocar("moedas", -8.0)
	pedir({"acao": "anunciar", "i": sel, "preco": p, "horas": horas})
	sel = -1

# ---------- meus anúncios e retirar ----------
func _meus() -> void:
	var v := _rolagem()
	var meus: Array = estado.get("meus", [])
	if meus.is_empty():
		v.add_child(Menu.rotulo("Nenhum anúncio seu agora. Ponha um item à venda na aba Vender.", 14, Menu.APAGADO))
	for a in meus:
		v.add_child(_linha(a, "Cancelar", func(): pedir({"acao": "cancelar", "id": str(a.id)})))

func _retirar() -> void:
	var cx: Dictionary = estado.get("caixa", {})
	var ouro := int(cx.get("ouro", 0))
	var itens: Array = cx.get("itens", [])
	corpo.add_child(Menu.rotulo("Guardado com o Otávio", 16, Menu.OURO_CLARO))
	corpo.add_child(Menu.rotulo("%d de ouro das vendas" % ouro, 15, Color("ffd36a")))
	if not itens.is_empty():
		corpo.add_child(Menu.rotulo("Itens que venceram ou foram cancelados:", 13, Menu.APAGADO))
		var g := GridContainer.new()
		g.columns = 10
		g.add_theme_constant_override("h_separation", 4)
		g.add_theme_constant_override("v_separation", 4)
		for it in itens:
			g.add_child(m.menu.celula(it, false, m.hud.aviso.bind(m.P.nome_item(it)), CEL))
		corpo.add_child(g)
	var b: Button = m.menu.botao("Retirar tudo", func(): pedir({"acao": "retirar"}), 16, ouro > 0 or not itens.is_empty())
	b.custom_minimum_size = Vector2(180, 42)
	corpo.add_child(b)

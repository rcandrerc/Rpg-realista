extends CanvasLayer
# Troca entre jogadores com cadeado (como no Quimera, André 2026-11-04). Só online: quem decide é o servidor
# (shared/simulacao.js troca). Tocar noutro jogador perto pergunta se quer pedir a troca; quem recebe vê o pedido com
# Aceitar e Recusar. Na janela cada um põe itens da mochila e ouro. "Trancar oferta" (cadeado) quer dizer "aceito o que
# está na mesa"; qualquer mudança, de um ou do outro, abre os dois cadeados. Com os dois trancados, os dois confirmam e
# o servidor confere tudo de novo antes de passar os itens (nada se duplica e nada some).

const Menu = preload("res://menu.gd")
const CEL := 46 # quadradinho dos itens na janela

var m # main.gd
var raiz: Control # janela da troca
var corpo_ui: HBoxContainer
var titulo_ui: Label
var cartao: PanelContainer # pergunta ("Trocar itens com X?") ou pedido que chegou ("X quer trocar")
var cartao_txt: Label
var cartao_botoes: HBoxContainer
var cartao_ate := 0.0
var estado := {} # o que o servidor mandou ("estado"): com, nome, eu, ele
var sel := -1 # lugar da mochila escolhido (pilha: escolhe quantos)
var pag := 0
var ouro_ui: LineEdit

func _init(principal) -> void:
	m = principal
	layer = 18 # acima da HUD e da janela do NPC, abaixo do menu do personagem (20)

func _ready() -> void:
	# cartão pequeno no alto da tela (pedido ou pergunta)
	cartao = PanelContainer.new()
	cartao.add_theme_stylebox_override("panel", Menu.caixa(Menu.FUNDO, Menu.OURO.darkened(0.25), 2, 10, 12))
	cartao.set_anchors_preset(Control.PRESET_CENTER_TOP)
	cartao.grow_horizontal = Control.GROW_DIRECTION_BOTH
	cartao.offset_left = -260
	cartao.offset_right = 260
	cartao.offset_top = 64
	cartao.visible = false
	add_child(cartao)
	var cv := HBoxContainer.new()
	cv.add_theme_constant_override("separation", 14)
	cartao.add_child(cv)
	var ic := TextureRect.new()
	ic.texture = Menu.icone_tex("negociar")
	ic.custom_minimum_size = Vector2(40, 40)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.modulate = Menu.OURO_CLARO
	ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	cv.add_child(ic)
	cartao_txt = Menu.rotulo("", 16, Menu.TEXTO)
	cartao_txt.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	cartao_txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cartao_txt.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	cv.add_child(cartao_txt)
	cartao_botoes = HBoxContainer.new()
	cartao_botoes.add_theme_constant_override("separation", 8)
	cartao_botoes.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	cv.add_child(cartao_botoes)
	# janela da troca
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
	moldura.add_theme_stylebox_override("panel", Menu.caixa(Menu.FUNDO, Menu.OURO.darkened(0.25), 2, 10, 14))
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
	var it := TextureRect.new()
	it.texture = Menu.icone_tex("negociar")
	it.custom_minimum_size = Vector2(30, 30)
	it.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	it.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	it.modulate = Menu.OURO_CLARO
	topo.add_child(it)
	titulo_ui = Menu.rotulo("Troca", 22, Menu.OURO_CLARO)
	topo.add_child(titulo_ui)
	var ajuda := Menu.rotulo("1) Escolha os itens e o ouro.  2) Tranque o cadeado.  3) Com os dois trancados, confirmem. Se alguém mudar algo, os cadeados abrem.", 13, Menu.APAGADO)
	ajuda.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	ajuda.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ajuda.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	topo.add_child(ajuda)
	var x := Menu.Fechar.new()
	x.gui_input.connect(func(ev): if (ev is InputEventMouseButton and ev.pressed) or (ev is InputEventScreenTouch and ev.pressed): cancelar())
	topo.add_child(x)
	var linha := ColorRect.new()
	linha.color = Menu.BORDA
	linha.custom_minimum_size = Vector2(0, 1)
	tudo.add_child(linha)
	corpo_ui = HBoxContainer.new()
	corpo_ui.size_flags_vertical = Control.SIZE_EXPAND_FILL
	corpo_ui.add_theme_constant_override("separation", 18)
	tudo.add_child(corpo_ui)

func aberto() -> bool:
	return raiz != null and raiz.visible

# ---------- tocar noutro jogador ----------
# toque rápido na tela: se foi noutro jogador, pergunta se quer trocar (perto) ou avisa para chegar perto
func tocou_tela(pos: Vector2) -> void:
	if not m.on() or aberto() or m.menu.aberto() or m.conversa.aberto() or m.h.morto > 0.0 or m.camera == null:
		return
	var achou := ""
	var md := 1e9
	var outros: Dictionary = m.online.outros
	for id in outros:
		var no: Node3D = outros[id].no
		if outros[id].get("bot", false): # a Cecília (shared/amiga.js): o dono conversa com ela pela conversa.gd; os outros, nada
			continue
		if not no.visible or no.position.distance_to(m.heroi.position) > 30.0:
			continue
		var pe: Vector3 = no.position
		var cabeca: Vector3 = pe + Vector3.UP * 1.7 * max(0.6, no.scale.y)
		if m.camera.is_position_behind(pe) or m.camera.is_position_behind(cabeca):
			continue
		var a: Vector2 = m.camera.unproject_position(pe)
		var b: Vector2 = m.camera.unproject_position(cabeca)
		var largura: float = max(34.0, (a.y - b.y) * 0.3)
		if pos.y < b.y - 14.0 or pos.y > a.y + 14.0 or abs(pos.x - lerp(a.x, b.x, 0.5)) > largura:
			continue
		var d: float = pos.distance_to(a.lerp(b, 0.5))
		if d < md:
			md = d
			achou = str(id)
	if achou == "":
		return
	var nome := nome_de(achou)
	var dist: float = Vector2(outros[achou].no.position.x - m.heroi.position.x, outros[achou].no.position.z - m.heroi.position.z).length()
	var extras: Array = m.amigos.botoes_para(achou) if m.amigos else [] # amigos.gd: adicionar amigo ou chamar pro time
	if dist > perto():
		if extras.is_empty():
			m.hud.aviso("Chegue mais perto de %s para trocar" % nome)
			return
		mostrar_cartao(nome, extras + [["Agora não", esconder_cartao]], 8.0)
		return
	mostrar_cartao(("Trocar itens com %s?" % nome) if extras.is_empty() else nome, [["Pedir troca", _responder.bind("pedir", achou)]] + extras + [["Agora não", esconder_cartao]], 8.0)

# botão do cartão: pedir, aceitar ou recusar a troca
func _responder(acao: String, com: String) -> void:
	esconder_cartao()
	m.rede("troca", {"acao": acao, "com": com})

func perto() -> float:
	return float(m.P.dados.get("troca", {}).get("perto", 6))

func nome_de(id: String) -> String:
	var o = m.online.outros.get(id)
	return str(o.get("nome", "")) if o != null and str(o.get("nome", "")) != "" else "o outro jogador"

func mostrar_cartao(texto: String, botoes: Array, dur: float) -> void:
	cartao_txt.text = texto
	for c in cartao_botoes.get_children():
		cartao_botoes.remove_child(c)
		c.queue_free()
	for b in botoes:
		var bt: Button = m.menu.botao(b[0], b[1], 15, cartao_botoes.get_child_count() == 0)
		bt.custom_minimum_size = Vector2(116, 38)
		cartao_botoes.add_child(bt)
	# com mais botões (amigo, time) o cartão fica mais largo
	var meia: float = 260.0 + 70.0 * maxi(0, botoes.size() - 2)
	cartao.offset_left = -meia
	cartao.offset_right = meia
	cartao.visible = true
	cartao_ate = m.tempo + dur

# o dedo caiu no cartão (a HUD não usa esse toque)
func cobre(p: Vector2) -> bool:
	return cartao != null and cartao.visible and cartao.get_global_rect().grow(6).has_point(p)

func esconder_cartao() -> void:
	cartao.visible = false

func _process(_dt: float) -> void:
	if cartao.visible and m.tempo > cartao_ate:
		cartao.visible = false

# ---------- o que vem do servidor (online.gd, evento "troca") ----------
func do_servidor(ev: Dictionary) -> void:
	match str(ev.get("fase", "")):
		"pedido":
			var de := str(ev.de)
			mostrar_cartao("%s quer trocar itens com você" % str(ev.get("nome", "Alguém")), [["Aceitar", _responder.bind("aceitar", de)], ["Recusar", _responder.bind("recusar", de)]], float(ev.get("dur", 30)))
			m.sons.tocar("pano", -8.0)
		"estado":
			var novo := not aberto()
			estado = ev
			if novo:
				abrir()
			else:
				montar()
		"fim":
			if str(ev.get("motivo", "")) != "":
				m.hud.aviso(str(ev.motivo))
			fechar()

func abrir() -> void:
	esconder_cartao()
	sel = -1
	pag = 0
	if m.trabalho.coletando != null:
		m.trabalho.parar(true)
	if m.conversa.aberto():
		m.conversa.fechar()
	if m.menu.aberto():
		m.menu.fechar()
	raiz.visible = true
	m.hud.bloqueado = true
	m.hud.esconder_combate = true
	m.sons.tocar("pano", -10.0)
	montar()

func fechar() -> void:
	estado = {}
	if raiz == null or not raiz.visible:
		return
	raiz.visible = false
	m.hud.esconder_combate = false
	if not m.menu.aberto() and not m.conversa.aberto():
		m.hud.bloqueado = false

func cancelar() -> void:
	m.rede("troca", {"acao": "cancelar"})
	fechar()

# o progresso mudou (mochila ou ouro): a janela mostra o que sobrou
func progresso_mudou() -> void:
	if aberto():
		montar()

func mandar(msg: Dictionary) -> void:
	m.rede("troca", msg)

# ---------- janela ----------
func montar() -> void:
	for c in corpo_ui.get_children():
		corpo_ui.remove_child(c)
		c.queue_free()
	if estado.is_empty():
		return
	var outro := str(estado.get("nome", "Outro jogador"))
	titulo_ui.text = "Troca com %s" % outro
	corpo_ui.add_child(coluna_mochila())
	var dir := VBoxContainer.new()
	dir.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dir.add_theme_constant_override("separation", 8)
	corpo_ui.add_child(dir)
	var eu: Dictionary = estado.get("eu", {})
	var ele: Dictionary = estado.get("ele", {})
	dir.add_child(painel_oferta("Você oferece", eu, true))
	dir.add_child(painel_oferta("%s oferece" % outro, ele, false))
	dir.add_child(linha_botoes(eu, ele, outro))

# quanto deste lugar da mochila já está na oferta
func posto(i: int) -> int:
	for e in estado.get("eu", {}).get("itens", []):
		if int(e.get("i", -1)) == i:
			return int(e.n)
	return 0

func coluna_mochila() -> Control:
	var P = m.P
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	var cab := HBoxContainer.new()
	cab.add_child(Menu.rotulo("Sua mochila", 16, Menu.OURO_CLARO))
	var e := Control.new()
	e.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cab.add_child(e)
	cab.add_child(m.menu.linha_ouro())
	v.add_child(cab)
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
		var resta = null
		if it != null:
			var n := int(it.get("n", 1)) - posto(i)
			if n > 0:
				resta = it.duplicate()
				if it.has("n"):
					resta.n = n
		var c: Button = m.menu.celula(resta, i == sel, func(): tocar_item(i), CEL)
		if it != null and (resta == null or it.get("cad", false)):
			c.modulate = Color(1, 1, 1, 0.35) # tudo dele já está na oferta, ou tem cadeado (não vai para troca)
		g.add_child(c)
	v.add_child(g)
	# escolher quantos de uma pilha
	if sel >= 0 and sel < P.prog.mochila.size() and P.prog.mochila[sel] != null:
		var it = P.prog.mochila[sel]
		var resta := int(it.get("n", 1)) - posto(sel)
		var l := HBoxContainer.new()
		l.add_theme_constant_override("separation", 6)
		var nome := Menu.rotulo("%s · %d" % [P.nome_item(it), resta], 13, P.cor_item(it))
		nome.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		l.add_child(nome)
		for q in [1, 10]:
			if resta > q:
				l.add_child(_mini("Pôr %d" % q, {"acao": "por", "i": sel, "n": q}))
		if resta > 0:
			l.add_child(_mini("Pôr tudo (%d)" % resta, {"acao": "por", "i": sel, "n": resta}))
		v.add_child(l)
	else:
		v.add_child(Menu.rotulo("Toque num item seu para pôr na troca.", 12, Menu.APAGADO))
	return v

func _pagina(n: int) -> void:
	pag = n
	sel = -1
	montar()

func _por(msg: Dictionary) -> void:
	sel = -1
	mandar(msg)

func _mini(t: String, msg: Dictionary) -> Button:
	var b: Button = m.menu.botao(t, _por.bind(msg), 13)
	b.custom_minimum_size = Vector2(0, 30)
	return b

func tocar_item(i: int) -> void:
	var it = m.P.prog.mochila[i]
	if it == null:
		return
	if it.get("cad", false): # cadeado da mochila (André 2026-11-07)
		m.hud.aviso("Item com cadeado. Abra o cadeado na mochila para trocar")
		return
	if eu_tranquei():
		m.hud.aviso("Sua oferta está trancada. Destranque para mudar")
		return
	var resta := int(it.get("n", 1)) - posto(i)
	if resta <= 0:
		m.hud.aviso("Você já pôs tudo desse item")
		return
	if resta == 1: # peça ou um só: vai direto
		sel = -1
		mandar({"acao": "por", "i": i, "n": 1})
		return
	sel = -1 if sel == i else i
	montar()

func eu_tranquei() -> bool:
	return bool(estado.get("eu", {}).get("tranca", false))

func painel_oferta(titulo: String, of: Dictionary, meu: bool) -> Control:
	var p := PanelContainer.new()
	var trancou := bool(of.get("tranca", false))
	p.add_theme_stylebox_override("panel", Menu.caixa(Menu.FUNDO2, Menu.VERDE.darkened(0.2) if trancou else Menu.BORDA, 2 if trancou else 1, 8))
	p.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	p.add_child(v)
	var cab := HBoxContainer.new()
	cab.add_theme_constant_override("separation", 8)
	cab.add_child(Menu.rotulo(titulo, 15, Menu.OURO_CLARO))
	var esp := Control.new()
	esp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cab.add_child(esp)
	var cad := Cadeado.new()
	cad.fechado = trancou
	cad.lado = 20.0
	cab.add_child(cad)
	var st := "Trancou" if trancou else "Ainda não trancou"
	if bool(of.get("ok", false)):
		st = "Trancou e confirmou"
	cab.add_child(Menu.rotulo(st, 13, Menu.VERDE if trancou else Menu.APAGADO))
	v.add_child(cab)
	var g := GridContainer.new()
	g.columns = 12
	g.add_theme_constant_override("h_separation", 4)
	g.add_theme_constant_override("v_separation", 4)
	var itens: Array = of.get("itens", [])
	for k in itens.size():
		var e: Dictionary = itens[k]
		var it: Dictionary = (e.get("it", {}) as Dictionary).duplicate()
		if it.has("n"):
			it.n = int(e.n)
		var c: Button = m.menu.celula(it, false, tirar_da_oferta.bind(k) if meu else m.hud.aviso.bind(m.P.nome_item(it)), CEL)
		g.add_child(c)
	if itens.is_empty():
		var nada := Menu.rotulo("Nenhum item" + (": toque num item da mochila" if meu else ""), 13, Menu.APAGADO)
		nada.custom_minimum_size = Vector2(0, CEL)
		nada.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		v.add_child(nada)
	else:
		v.add_child(g)
	# ouro
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 6)
	var ic := TextureRect.new()
	ic.texture = Menu.icone_tex("it_ouro")
	ic.custom_minimum_size = Vector2(20, 20)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(ic)
	l.add_child(Menu.rotulo("%d de ouro" % int(of.get("ouro", 0)), 15, Color("ffd36a")))
	if meu:
		var esp2 := Control.new()
		esp2.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		l.add_child(esp2)
		ouro_ui = LineEdit.new()
		ouro_ui.placeholder_text = "quanto"
		ouro_ui.virtual_keyboard_type = LineEdit.KEYBOARD_TYPE_NUMBER
		ouro_ui.custom_minimum_size = Vector2(110, 30)
		ouro_ui.add_theme_font_size_override("font_size", 14)
		ouro_ui.add_theme_stylebox_override("normal", Menu.caixa(Color(0.045, 0.04, 0.036), Menu.BORDA, 1, 6))
		ouro_ui.add_theme_stylebox_override("focus", Menu.caixa(Color(0.045, 0.04, 0.036), Menu.OURO, 1, 6))
		ouro_ui.text_submitted.connect(func(_t): por_ouro())
		l.add_child(ouro_ui)
		var b: Button = m.menu.botao("Pôr ouro", por_ouro, 13)
		b.custom_minimum_size = Vector2(0, 30)
		l.add_child(b)
		if int(of.get("ouro", 0)) > 0:
			var z: Button = m.menu.botao("Tirar ouro", _tirar_ouro, 13)
			z.custom_minimum_size = Vector2(0, 30)
			l.add_child(z)
	v.add_child(l)
	return p

func _trancado_aviso() -> bool:
	if eu_tranquei():
		m.hud.aviso("Sua oferta está trancada. Destranque para mudar")
		return true
	return false

func _tirar_ouro() -> void:
	if not _trancado_aviso():
		mandar({"acao": "ouro", "n": 0})

func tirar_da_oferta(k: int) -> void:
	if _trancado_aviso():
		return
	mandar({"acao": "tirar", "o": k})

func por_ouro() -> void:
	if ouro_ui == null or _trancado_aviso():
		return
	var t := ouro_ui.text.strip_edges()
	if not t.is_valid_int():
		m.hud.aviso("Escreva quanto ouro (só números)")
		return
	var n := int(t)
	if n < 0 or n > int(m.P.prog.ouro):
		m.hud.aviso("Você não tem esse ouro todo")
		return
	mandar({"acao": "ouro", "n": n})

func linha_botoes(eu: Dictionary, ele: Dictionary, outro: String) -> Control:
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 10)
	var tranca := bool(eu.get("tranca", false))
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.text = "Trancada · toque para abrir" if tranca else "Trancar oferta"
	b.add_theme_font_size_override("font_size", 15)
	b.custom_minimum_size = Vector2(0, 44)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	Menu.estilo_botao(b, tranca)
	for e in ["normal", "hover", "pressed"]: # lugar para o cadeado à esquerda do texto
		var sb: StyleBox = b.get_theme_stylebox(e).duplicate()
		sb.content_margin_left = 44
		b.add_theme_stylebox_override(e, sb)
	var cad := Cadeado.new()
	cad.fechado = tranca
	cad.lado = 22.0
	cad.position = Vector2(14, 11)
	b.add_child(cad)
	b.pressed.connect(mandar.bind({"acao": "trancar", "v": not tranca}))
	l.add_child(b)
	var os_dois := tranca and bool(ele.get("tranca", false))
	var ok := bool(eu.get("ok", false))
	var c := Button.new()
	c.focus_mode = Control.FOCUS_NONE
	c.add_theme_font_size_override("font_size", 15)
	c.custom_minimum_size = Vector2(0, 44)
	c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	if ok:
		c.text = "Confirmado · esperando %s" % outro
	elif os_dois:
		c.text = "Confirmar troca"
	else:
		c.text = "Confirmar (os dois trancam antes)"
	Menu.estilo_botao(c, os_dois and not ok)
	if not os_dois or ok:
		c.add_theme_color_override("font_color", Menu.APAGADO)
	if os_dois and not ok:
		c.add_theme_color_override("font_color", Menu.VERDE)
	c.pressed.connect(_confirmar.bind(os_dois, ok))
	l.add_child(c)
	var x: Button = m.menu.botao("Cancelar troca", cancelar, 15)
	x.custom_minimum_size = Vector2(170, 44)
	l.add_child(x)
	return l

func _confirmar(os_dois: bool, ok: bool) -> void:
	if not os_dois:
		m.hud.aviso("Os dois precisam trancar a oferta antes de confirmar")
	elif not ok:
		mandar({"acao": "confirmar"})

# cadeado desenhado (fechado dourado/verde, aberto com a alça levantada)
class Cadeado extends Control:
	var fechado := false
	var lado := 20.0
	func _ready() -> void:
		custom_minimum_size = Vector2(lado, lado)
		size = custom_minimum_size
		mouse_filter = Control.MOUSE_FILTER_IGNORE
	func _draw() -> void:
		var k := lado / 20.0
		var cor := Color(0.45, 0.78, 0.45) if fechado else Color(0.95, 0.82, 0.55)
		var corpo := Rect2(Vector2(3, 9) * k, Vector2(14, 10) * k)
		draw_rect(corpo, cor)
		draw_circle(Vector2(10, 13.5) * k, 1.6 * k, Color(0.08, 0.07, 0.06))
		draw_line(Vector2(10, 13.5) * k, Vector2(10, 16.5) * k, Color(0.08, 0.07, 0.06), 1.4 * k)
		var sobe := 0.0 if fechado else 3.5
		var c := Vector2(10, 9 - sobe) * k
		draw_arc(c, 4.6 * k, PI, TAU, 16, cor, 2.2 * k, true)
		draw_line(Vector2(5.4, 9 - sobe) * k, Vector2(5.4, 9) * k if fechado else Vector2(5.4, 9 - sobe + 1.5) * k, cor, 2.2 * k)
		draw_line(Vector2(14.6, 9 - sobe) * k, Vector2(14.6, 9) * k, cor, 2.2 * k)

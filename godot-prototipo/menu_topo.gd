extends CanvasLayer
# Menu do topo (no jeito do Quimera): em cima à direita, logo à esquerda do minimapa, ficam os ícones Conta, Multijogador e Configurações
# e, na ponta, uma seta. A seta recolhe os ícones (eles deslizam para dentro da seta e somem) e traz de volta;
# a seta gira junto. Aberto ou fechado fica guardado no aparelho. Cada ícone abre a sua janela no meio da tela.
# Regra do André: no topo só entram conta, multijogador e configurações (e, pedido dele em 2026-11-04, a mochila, primeiro da fila). Pedido dele (2026-11-03): a casinha do Voltar
# para a vila também fica aqui, na ponta perto da seta; ela não abre janela, começa a canalização (volta_vila.gd) e mostra
# a recarga de 10 min (varredura escura e o tempo embaixo).

const Menu = preload("res://menu.gd")
const ARQUIVO := "user://config.cfg" # escolhas do jogador (menu recolhido, som, vibração, FPS)
const TAM := 50.0 # tamanho de cada ícone (igual à barra do jogo HTML)
const ESPACO := 6.0
const MARGEM := Vector2(176, 70) # distância do canto de cima à direita: o menu fica à esquerda do minimapa, na altura do centro dele
# (André 2026-11-03: menu puxado para a esquerda e o minimapa sobe para o canto, para não cobrir as skills)
# André 2026-11-06: o martelo da construção sai de baixo (confundia com as skills) e vem para cá, do lado da mochila:
# aceso no meu terreno, escuro fora dele
# André 2026-11-11: "o menu de missões vai para aquela action bar" (antes era uma aba do menu do personagem)
const ITENS := [["mochila", "Mochila", "topo_mochila"], ["construir", "Construir", "construir"], ["missoes", "Missões", "topo_missoes"], ["conta", "Conta", "topo_conta"], ["multi", "Multijogador", "topo_multi"], ["chat", "Chat", "topo_chat"], ["config", "Configurações", "topo_config"], ["vila", "Voltar para a vila", "topo_vila"]]
const TEMPO := 0.28 # segundos da animação de abrir e recolher (igual ao Quimera)

var m # main.gd
var raiz: Control
var lugar: Control # onde os ícones ficam (não se mexe)
var itens: Control # os ícones (o que desliza, encolhe e some)
var vila_sombra # Varredura: casinha em recarga, a parte escura é o que falta
var vila_txt: Label # minutos e segundos que faltam (embaixo do botão)
var _vila_t := 0.0
var seta: Button
var seta_ico: TextureRect
var recolhido := false
var _anim: Tween
# janela de cada ícone
var janela: Control
var caixa: PanelContainer
var conteudo: VBoxContainer
var aberta := "" # "conta", "multi" ou "config" ("" = fechada)
var _atualizar_t := 0.0
var _confirmar_apagar := false # Conta > Apagar personagem: segunda tela pedindo confirmação
var _apagando := false
# configurações
var volume := 100.0 # 0..100 (volume geral do jogo)
var volume_musica := 45.0 # 0..100 (só a música de fundo, musica.gd)
var vibracao := true
var mostrar_fps := true

func _init(principal) -> void:
	m = principal
	layer = 4 # acima da HUD e do Teste; abaixo da tela de login (5) e do menu do personagem (20)

func _ready() -> void:
	raiz = Control.new()
	raiz.set_anchors_preset(Control.PRESET_FULL_RECT)
	raiz.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(raiz)
	var n := ITENS.size()
	lugar = Control.new()
	lugar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	lugar.anchor_left = 1.0
	lugar.anchor_right = 1.0
	lugar.offset_right = -(MARGEM.x + TAM + ESPACO)
	lugar.offset_left = lugar.offset_right - (TAM * n + ESPACO * (n - 1))
	lugar.offset_top = MARGEM.y
	lugar.offset_bottom = MARGEM.y + TAM
	raiz.add_child(lugar)
	itens = Control.new()
	itens.mouse_filter = Control.MOUSE_FILTER_IGNORE
	itens.size = Vector2(TAM * n + ESPACO * (n - 1), TAM)
	itens.pivot_offset = Vector2(itens.size.x, TAM * 0.5) # encolhe para o lado da seta
	lugar.add_child(itens)
	for i in n:
		var b := _icone(ITENS[i][2], ITENS[i][1])
		b.position = Vector2(i * (TAM + ESPACO), 0)
		var k: String = ITENS[i][0]
		b.set_meta("guia", "topo:" + k) # guia das missões (guia.gd): este ícone pisca quando é o próximo toque
		if k == "vila":
			b.pressed.connect(func(): m.volta.pedir())
			_recarga_vila(b)
		elif k == "chat": # André 2026-11-06: chat geral e de amigos (chat.gd); o número mostra as mensagens não lidas
			b.pressed.connect(func(): m.chat.abrir())
			if m.chat:
				m.chat.ligar_icone(b)
		elif k == "construir":
			b.pressed.connect(_construir)
			construir_ico = b.get_child(0)
			construir_btn = b
		elif k == "missoes": # a lista das missões (menu.gd montar_missoes), sozinha, sem as abas do personagem
			b.pressed.connect(func(): m.menu.abrir("missoes"))
		elif k == "mochila": # André 2026-11-04: a bolsa (Mochila e Criar) sai do menu da barra de vida e ganha botão aqui
			b.pressed.connect(func(): m.menu.abrir_bolsa())
		else:
			b.pressed.connect(func(): abrir(k))
		itens.add_child(b)
	seta = _icone("topo_seta", "Recolher menu")
	seta.set_meta("guia", "topo:seta") # menu recolhido: o guia pisca a seta para abrir
	seta.anchor_left = 1.0
	seta.anchor_right = 1.0
	seta.offset_left = -(MARGEM.x + TAM)
	seta.offset_right = -MARGEM.x
	seta.offset_top = MARGEM.y
	seta.offset_bottom = MARGEM.y + TAM
	seta_ico = seta.get_child(0)
	seta.pressed.connect(func(): recolher(not recolhido))
	raiz.add_child(seta)
	montar_janela()
	carregar()
	recolher(recolhido, false)
	aplicar_config()

# ícone quadrado de cantos redondos (couro escuro com borda dourada, como os botões da HUD)
func _icone(ico: String, dica: String) -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.tooltip_text = dica
	b.size = Vector2(TAM, TAM)
	b.custom_minimum_size = Vector2(TAM, TAM)
	var normal := Menu.caixa(Color(0.086, 0.07, 0.055, 0.78), Color(0.925, 0.81, 0.55, 0.4), 1, 15, 6)
	var apertado := Menu.caixa(Color(0.16, 0.13, 0.1, 0.9), Color(0.95, 0.82, 0.55, 0.85), 1, 15, 6)
	b.add_theme_stylebox_override("normal", normal)
	b.add_theme_stylebox_override("hover", normal)
	b.add_theme_stylebox_override("pressed", apertado)
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	b.button_down.connect(func(): b.scale = Vector2(0.94, 0.94))
	b.button_up.connect(func(): b.scale = Vector2.ONE)
	b.pivot_offset = Vector2(TAM, TAM) * 0.5
	var t := TextureRect.new()
	t.texture = Menu.icone_tex(ico)
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	t.size = Vector2(30, 30)
	t.position = Vector2(TAM - 30, TAM - 30) * 0.5
	t.pivot_offset = Vector2(15, 15)
	b.add_child(t)
	return b

# recarga da casinha (direção de arte): a casinha fica a 40% de brilho, uma varredura escura em sentido horário mostra o
# tempo que falta e o tempo aparece pequeno embaixo do botão
class Varredura extends Control:
	var k := 0.0 # 0..1 que falta
	func _draw() -> void:
		if k <= 0.0:
			return
		var c := size * 0.5
		var r := size.x * 0.5 - 2.0
		var pts := PackedVector2Array([c])
		var n := maxi(3, int(48 * k))
		for i in n + 1: # do meio-dia, girando no sentido horário pelo que ainda falta
			var a := -PI * 0.5 + TAU * (1.0 - k) + TAU * k * float(i) / n
			pts.append(c + Vector2(cos(a), sin(a)) * r)
		draw_colored_polygon(pts, Color(0.02, 0.015, 0.01, 0.55))

var vila_ico: TextureRect
var construir_ico: TextureRect
var construir_btn: Button

# martelo do topo: no meu terreno abre (ou fecha) o modo construção; fora dele só avisa
func _construir() -> void:
	var c = m.construcao
	if c == null:
		return
	if c.ativo or c.pode_construir_aqui():
		c.tocar_botao_construir()
	elif c.meu == "":
		m.hud.aviso("Compre um terreno nas Terras da Estrada para construir")
	else:
		m.hud.aviso("Chegue no seu terreno para construir")

func _atualizar_construir() -> void:
	if construir_ico == null or m.construcao == null:
		return
	var aceso: bool = m.construcao.ativo or m.construcao.pode_construir_aqui()
	construir_ico.modulate = Color.WHITE if aceso else Color(1, 1, 1, 0.3)
	construir_btn.tooltip_text = "Construir" if aceso else "Construir (só no seu terreno)"

func _recarga_vila(b: Button) -> void:
	vila_ico = b.get_child(0)
	var v := Varredura.new()
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.size = Vector2(TAM, TAM)
	v.visible = false
	b.add_child(v)
	vila_sombra = v
	vila_txt = Label.new()
	vila_txt.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vila_txt.position = Vector2(-6, TAM + 1)
	vila_txt.size = Vector2(TAM + 12, 14)
	vila_txt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vila_txt.add_theme_font_size_override("font_size", 12)
	vila_txt.add_theme_color_override("font_color", Color(1, 0.9, 0.68))
	vila_txt.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	vila_txt.add_theme_constant_override("outline_size", 4)
	vila_txt.visible = false
	b.add_child(vila_txt)

func _atualizar_vila(dt: float) -> void:
	_vila_t -= dt
	if vila_sombra == null or m.volta == null or _vila_t > 0.0:
		return
	_vila_t = 0.25
	var f: float = m.volta.falta()
	var em_recarga := f > 0.0
	vila_sombra.visible = em_recarga
	vila_txt.visible = em_recarga
	vila_ico.modulate = Color(1, 1, 1, 0.4) if em_recarga else Color.WHITE
	if em_recarga:
		vila_sombra.k = clamp(f / float(m.volta.V.cd), 0.0, 1.0)
		vila_sombra.queue_redraw()
		var txt: String = m.volta.tempo_txt(f)
		if vila_txt.text != txt:
			vila_txt.text = txt

# ---------- abrir e recolher (seta) ----------
func recolher(sim: bool, animar := true) -> void:
	recolhido = sim
	seta.tooltip_text = "Abrir menu" if sim else "Recolher menu"
	if _anim:
		_anim.kill()
	var x_fim := 40.0 if sim else 0.0
	var esc_fim := Vector2(0.7, 0.7) if sim else Vector2.ONE
	var a_fim := 0.0 if sim else 1.0
	var giro_fim := PI if sim else 0.0
	if sim:
		_mexer_itens(false) # recolhendo: os ícones já não aceitam toque
	else:
		itens.visible = true
	if not animar:
		itens.position.x = x_fim
		itens.scale = esc_fim
		itens.modulate.a = a_fim
		seta_ico.rotation = giro_fim
		itens.visible = not sim
		_mexer_itens(not sim)
		salvar()
		return
	_anim = create_tween().set_parallel(true)
	var curva := Tween.EASE_IN if sim else Tween.EASE_OUT
	_anim.tween_property(itens, "position:x", x_fim, TEMPO).set_trans(Tween.TRANS_CUBIC).set_ease(curva)
	_anim.tween_property(itens, "scale", esc_fim, TEMPO).set_trans(Tween.TRANS_CUBIC).set_ease(curva)
	_anim.tween_property(itens, "modulate:a", a_fim, 0.2)
	_anim.tween_property(seta_ico, "rotation", giro_fim, TEMPO).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN_OUT)
	_anim.chain().tween_callback(func():
		itens.visible = not recolhido
		_mexer_itens(not recolhido))
	salvar()

func _mexer_itens(v: bool) -> void:
	for b in itens.get_children():
		b.mouse_filter = Control.MOUSE_FILTER_STOP if v else Control.MOUSE_FILTER_IGNORE

# a HUD pergunta: este toque é do menu do topo? (aí não vira joystick nem câmera)
# modo de editar a interface (editar_hud.gd): a barra de ícones muda de lugar e de tamanho junto com a seta
func posicionar(d: Vector2, s: float) -> void:
	var n := ITENS.size()
	lugar.offset_right = -(MARGEM.x + TAM + ESPACO) + d.x
	lugar.offset_left = lugar.offset_right - (TAM * n + ESPACO * (n - 1))
	lugar.offset_top = MARGEM.y + d.y
	lugar.offset_bottom = MARGEM.y + TAM + d.y
	seta.offset_left = -(MARGEM.x + TAM) + d.x
	seta.offset_right = -MARGEM.x + d.x
	seta.offset_top = MARGEM.y + d.y
	seta.offset_bottom = MARGEM.y + TAM + d.y
	# as duas crescem em volta da ponta direita da seta (o canto que fica junto do minimapa)
	lugar.pivot_offset = Vector2(TAM * n + ESPACO * (n - 1) + ESPACO + TAM, TAM * 0.5)
	seta.pivot_offset = Vector2(TAM, TAM * 0.5)
	lugar.scale = Vector2(s, s)
	seta.scale = Vector2(s, s)

func area() -> Rect2:
	var r := seta.get_global_rect()
	if not recolhido:
		r = r.merge(lugar.get_global_rect())
	return r

func cobre(p: Vector2) -> bool:
	if janela.visible or (m.chat and (m.chat.aberto() or m.chat.cobre_botao(p))):
		return true
	if seta.get_global_rect().grow(6).has_point(p):
		return true
	if recolhido:
		return false
	for b in itens.get_children():
		if b.get_global_rect().grow(4).has_point(p):
			return true
	return false

# ---------- janelas ----------
func montar_janela() -> void:
	janela = Control.new()
	janela.set_anchors_preset(Control.PRESET_FULL_RECT)
	janela.visible = false
	raiz.add_child(janela)
	var escuro := ColorRect.new()
	escuro.color = Color(0.04, 0.035, 0.03, 0.6)
	escuro.set_anchors_preset(Control.PRESET_FULL_RECT)
	escuro.gui_input.connect(func(ev): # toque fora da caixa fecha
		if (ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT):
			fechar())
	janela.add_child(escuro)
	var centro := CenterContainer.new()
	centro.set_anchors_preset(Control.PRESET_FULL_RECT)
	centro.mouse_filter = Control.MOUSE_FILTER_IGNORE
	janela.add_child(centro)
	caixa = PanelContainer.new()
	var estilo := Menu.caixa(Color(0.086, 0.07, 0.055, 0.95), Color(0.925, 0.81, 0.55, 0.45), 1, 16, 16)
	estilo.content_margin_left = 22
	estilo.content_margin_right = 22
	estilo.content_margin_top = 16
	estilo.content_margin_bottom = 18
	caixa.add_theme_stylebox_override("panel", estilo)
	caixa.custom_minimum_size = Vector2(460, 0)
	centro.add_child(caixa)
	conteudo = VBoxContainer.new()
	conteudo.add_theme_constant_override("separation", 10)
	caixa.add_child(conteudo)

func abrir(qual: String) -> void:
	if janela.visible and aberta == qual:
		fechar()
		return
	aberta = qual
	_confirmar_apagar = false
	if m.chat:
		m.chat.fechar()
	janela.visible = true
	m.hud.bloqueado = true
	montar()

func fechar() -> void:
	janela.visible = false
	aberta = ""
	_confirmar_apagar = false # "Voltar ao jogo" na confirmação vale como "Não, manter"
	if not (m.menu and m.menu.aberto()) and not (m.chat and m.chat.aberto()):
		m.hud.bloqueado = false

func aberto() -> bool:
	return janela != null and janela.visible

func _process(dt: float) -> void:
	_atualizar_vila(dt)
	_atualizar_construir()
	if aberta == "multi" or aberta == "conta": # online, jogadores e ping mudam sozinhos
		_atualizar_t -= dt
		if _atualizar_t <= 0.0:
			_atualizar_t = 1.0
			montar()

func _limpar() -> void:
	for c in conteudo.get_children():
		conteudo.remove_child(c)
		c.queue_free()

func _cabeca(ico: String, t: String) -> void:
	var linha := HBoxContainer.new()
	linha.add_theme_constant_override("separation", 10)
	var i := TextureRect.new()
	i.texture = Menu.icone_tex(ico)
	i.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	i.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	i.custom_minimum_size = Vector2(30, 30)
	linha.add_child(i)
	var l := Menu.rotulo(t, 22, Menu.OURO_CLARO)
	l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	linha.add_child(l)
	var x := _botao("Voltar ao jogo", fechar, false)
	x.custom_minimum_size = Vector2(150, 40)
	linha.add_child(x)
	conteudo.add_child(linha)
	var ouro := ColorRect.new()
	ouro.color = Color(Menu.OURO, 0.45)
	ouro.custom_minimum_size = Vector2(0, 1)
	conteudo.add_child(ouro)

func _texto(t: String, cor := Menu.TEXTO, tam := 16) -> Label:
	var l := Menu.rotulo(t, tam, cor)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(416, 0)
	conteudo.add_child(l)
	return l

func _botao(t: String, fn: Callable, principal := true, perigo := false) -> Button:
	var b := Button.new()
	b.text = t
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(0, 46)
	b.add_theme_font_size_override("font_size", 17)
	if principal:
		for e in ["normal", "hover", "pressed"]:
			var s := Menu.caixa(Color(0.88, 0.71, 0.35) if e != "pressed" else Color(0.73, 0.54, 0.21), Color(0, 0, 0, 0), 0, 12)
			b.add_theme_stylebox_override(e, s)
		for c in ["font_color", "font_hover_color", "font_pressed_color"]:
			b.add_theme_color_override(c, Color(0.165, 0.114, 0.016))
	else:
		Menu.estilo_botao(b, false)
		if perigo:
			for c in ["font_color", "font_hover_color", "font_pressed_color"]:
				b.add_theme_color_override(c, Color(0.9, 0.63, 0.54))
	b.pressed.connect(fn)
	return b

func _add(b: Button) -> void:
	conteudo.add_child(b)

func montar() -> void:
	_limpar()
	match aberta:
		"conta":
			montar_conta()
		"multi":
			montar_multi()
		"config":
			montar_config()
	_caber()

func _online():
	return m.online if m.online and m.online.rede else null

func montar_conta() -> void:
	_cabeca("topo_conta", "Conta")
	var o = _online()
	if _confirmar_apagar and o != null and o.rede.sessao != "":
		montar_apagar(o)
		return
	var tem_conta: bool = o != null and o.rede.sessao != ""
	if tem_conta:
		_texto("Conta Google: %s" % str(o.rede.conta.get("nome", "sem nome")))
		_texto("Seu progresso (nível, itens, ouro) fica salvo no servidor.", Menu.APAGADO, 14)
		_add(_botao("Trocar de conta", func():
			fechar()
			o.desligar()
			o.rede.trocar_conta(), false))
		# André (2026-11-03): sair da conta sai do jogo online de verdade e volta para a tela de login
		# (lá continua o "Jogar sozinho"). O jogo é recarregado para não sobrar nada da conta que saiu.
		_add(_botao("Sair da conta", func(): _sair(o), false)) # sair não destrói nada: cor neutra (direção de arte)
		var vao := Control.new() # espaço a mais: o Apagar fica longe dos outros para não ser tocado por engano
		vao.custom_minimum_size = Vector2(0, 16)
		conteudo.add_child(vao)
		_add(_botao("Apagar personagem", func():
			_confirmar_apagar = true
			montar(), false, true))
	else:
		_texto("Sem conta: jogando sozinho.")
		_texto("Entre com a sua conta Google para salvar o progresso e jogar online.", Menu.APAGADO, 14)
		if o:
			_add(_botao("Entrar com Google", func():
				fechar()
				o.mostrar_login()))

# Confirmação de apagar o personagem (para ninguém apagar sem querer): explica o que some e pede um toque a mais
func montar_apagar(o) -> void:
	var nome := str(m.hud.nome) if m.hud.nome != "" else str(o.rede.conta.get("nome", "seu personagem"))
	_texto("Apagar %s?" % nome, Menu.OURO_CLARO, 19)
	_texto("O personagem é apagado de vez no servidor: nome, aparência, nível, habilidades, itens e ouro. Não dá para desfazer.", Menu.TEXTO, 15)
	_texto("Depois é só entrar de novo com a conta Google para criar um personagem novo.", Menu.APAGADO, 14)
	if _apagando:
		_texto("Apagando…", Menu.APAGADO, 15)
		return
	_add(_botao("Sim, apagar %s" % nome, func(): _apagar(o), false, true))
	_add(_botao("Não, manter", func():
		_confirmar_apagar = false
		montar()))

func _apagar(o) -> void:
	if _apagando:
		return
	_apagando = true
	montar()
	o.desligar()
	var ok: bool = await o.rede.apagar_personagem()
	_apagando = false
	if not ok:
		_confirmar_apagar = false
		montar()
		m.hud.aviso("Não deu para apagar agora. Confira a internet e tente de novo.")
		o.rede.continuar() # volta para o mundo com o mesmo personagem
		return
	fechar()
	_recarregar(o, "Personagem apagado")

func _sair(o) -> void:
	fechar()
	o.desligar()
	o.cobrir("Saindo da conta…")
	await o.rede.sair_de_vez()
	_recarregar(o, "Você saiu da conta.")

# volta para a tela de login (Entrar com Google ou Jogar sozinho). Sem recarregar a cena: o reload_current_scene
# fechava o app no celular depois de apagar o personagem (André 2026-11-11); online.gd limpa a conta antiga.
func _recarregar(o, texto: String) -> void:
	o.voltar_ao_login(texto)

func montar_multi() -> void:
	_cabeca("topo_multi", "Multijogador")
	var o = _online()
	if o and o.ligado:
		var ping := "" if o.rede.ping_ms < 0 else " · %d ms" % o.rede.ping_ms
		_texto("Online · %d %s%s" % [o.jogadores, "jogador" if o.jogadores == 1 else "jogadores", ping], Menu.VERDE, 18)
		_texto("Você está no mundo com os outros jogadores. Quem decide golpes, dano e itens é o servidor.", Menu.APAGADO, 14)
		if m.amigos: # amigos (até 20) e time (amigos.gd)
			m.amigos.montar_janela(self)
		_add(_botao("Jogar sozinho", func():
			fechar()
			o.desligar()
			o.rede.fechar()
			m.hud.aviso("Jogando sozinho"), false))
	else:
		_texto("Sozinho (sem internet o progresso não vai para a conta).", Menu.TEXTO, 17)
		if o and o.rede.sessao != "":
			_add(_botao("Jogar online", func():
				fechar()
				o.rede.continuar()))
		elif o:
			_add(_botao("Entrar com Google para jogar online", func():
				fechar()
				o.mostrar_login()))

# André 2026-11-13: a janela passava da altura da tela e o Paralelo/Sombras ficavam cortados embaixo. Agora são duas
# colunas (som e conta à esquerda, gráficos à direita) e, se ainda não couber, a caixa encolhe até caber (_caber).
func montar_config() -> void:
	_cabeca("topo_config", "Configurações")
	var principal := conteudo
	var colunas := HBoxContainer.new()
	colunas.add_theme_constant_override("separation", 28)
	principal.add_child(colunas)
	var esq := VBoxContainer.new()
	var dir := VBoxContainer.new()
	for c in [esq, dir]:
		c.add_theme_constant_override("separation", 10)
		c.custom_minimum_size = Vector2(416, 0)
		colunas.add_child(c)
	conteudo = esq # as funções abaixo põem as linhas em "conteudo": cada coluna na sua vez
	_barra("Som", volume, func(v):
		volume = v
		aplicar_config())
	_barra("Música", volume_musica, func(v):
		volume_musica = v
		aplicar_config())
	_chave("Vibração", vibracao, func(v):
		vibracao = v
		aplicar_config()
		salvar()
		if v:
			m.vibrar(40))
	_chave("Mostrar FPS", mostrar_fps, func(v):
		mostrar_fps = v
		aplicar_config()
		salvar())
	_texto("Fica salvo neste celular.", Menu.APAGADO, 13)
	_chave_ia()
	conteudo = dir
	_qualidade_grafica()
	conteudo = principal

# a caixa nunca passa da tela: se o conteúdo for mais alto, ela encolhe por igual (o toque continua certo)
func _caber() -> void:
	await get_tree().process_frame
	if not janela.visible:
		return
	var alto := raiz.get_viewport_rect().size.y - 16.0
	var k := minf(1.0, alto / maxf(1.0, caixa.size.y))
	caixa.pivot_offset = caixa.size * 0.5
	caixa.scale = Vector2(k, k)

# Chave IA dos NPCs (André 2026-11-12): ativar a conversa com a Cecília e o Dario também aqui, sem precisar achar eles.
# É o mesmo "Ativar conversa com IA" de Multijogador > Amigos virtuais (que continua lá): cria a chave grátis no Groq
# e cola uma vez só; o servidor testa e guarda na conta (server/index.js 'chaveIa').
func _chave_ia() -> void:
	var a = m.amigos
	if a == null or not m.on() or a.virtuais.is_empty():
		return
	var ativa := false
	var nomes: Array = []
	for v in a.virtuais:
		nomes.append(str(v.get("nome", "")))
		if v.get("ia", false):
			ativa = true
	_texto("Chave IA dos NPCs", Menu.TEXTO, 17)
	if ativa:
		_texto("Ativada. Você conversa com %s." % " e ".join(nomes), Menu.APAGADO, 13)
		return
	_texto("Para conversar com %s:\n1. Crie a chave grátis (conta Google, Create API Key) e copie.\n2. Toque em Colar a chave." % " e ".join(nomes), Menu.APAGADO, 13)
	var linha := HBoxContainer.new()
	linha.add_theme_constant_override("separation", 8)
	var b1 := _botao("1. Criar chave", func(): OS.shell_open("https://console.groq.com/keys"), false)
	var b2 := _botao("2. Colar a chave", func():
		var chave := DisplayServer.clipboard_get().strip_edges()
		if not chave.begins_with("gsk_"):
			m.hud.aviso("Copie a chave no site primeiro (começa com gsk_)")
			return
		m.rede("chaveIa", {"chave": chave})
		m.hud.aviso("Testando a chave..."))
	for b in [b1, b2]:
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.custom_minimum_size = Vector2(0, 40)
		linha.add_child(b)
	conteudo.add_child(linha)

# Qualidade gráfica (André 2026-11-09, celular da filha): Baixa, Média e Alta (grafico.gd). O escolhido fica dourado.
func _qualidade_grafica() -> void:
	var G = m.grafico
	if G == null:
		return
	var linha := HBoxContainer.new()
	linha.add_theme_constant_override("separation", 8)
	var l := Menu.rotulo("Gráficos", 17)
	l.custom_minimum_size = Vector2(120, 0)
	linha.add_child(l)
	for i in G.NOMES.size():
		var b := _botao(G.NOMES[i], func():
			if G.nivel != i:
				G.trocar(i)
				montar(), G.nivel == i)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.custom_minimum_size = Vector2(0, 40)
		linha.add_child(b)
	conteudo.add_child(linha)
	var dica := "Baixa: mais leve. Alta: mais bonito."
	if G.placa != "":
		dica += " Sugerido (%s): %s." % [G.placa, G.NOMES[G.sugerido]]
	_texto(dica, Menu.APAGADO, 13)
	_limite_fps()
	_paralelo()
	_visual_leve()

# Desenho em paralelo (APK 2026-11-12, grafico.gd): só aparece no APK que tem a opção; vale ao abrir o jogo de novo
func _paralelo() -> void:
	var G = m.grafico
	if not G.paralelo_disponivel():
		return
	var quer: bool = G.paralelo_quer() and not G.paralelo_caiu()
	var linha := HBoxContainer.new()
	linha.add_theme_constant_override("separation", 8)
	var l := Menu.rotulo("Paralelo", 17)
	l.custom_minimum_size = Vector2(120, 0)
	linha.add_child(l)
	for i in 2:
		var b := _botao(["Ligado", "Desligado"][i], func():
			if quer != (i == 0):
				G.trocar_paralelo(i == 0)
				m.hud.aviso("Vale quando abrir o jogo de novo")
				montar(), quer == (i == 0))
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.custom_minimum_size = Vector2(0, 40)
		linha.add_child(b)
	conteudo.add_child(linha)
	var t := "Desenha a tela em outra linha (mais FPS)."
	if G.paralelo_caiu():
		t = "Desligou sozinho: o jogo fechou 2 vezes. Toque em Ligado para tentar de novo."
	elif G.paralelo_agora() != quer:
		# a escolha (dourada) só vale ao abrir de novo: diz claro o que está valendo agora
		t = "Agora está %s. Fica %s quando abrir o jogo de novo." % ["ligado" if G.paralelo_agora() else "desligado", "ligado" if quer else "desligado"]
	_texto(t, Menu.APAGADO, 13)

# Limite de FPS (varredura de FPS 2026-11-10): 30, 60 ou sem limite (grafico.gd). Sem escolha, vale o do nível.
func _limite_fps() -> void:
	var G = m.grafico
	var linha := HBoxContainer.new()
	linha.add_theme_constant_override("separation", 8)
	var l := Menu.rotulo("Limite FPS", 17)
	l.custom_minimum_size = Vector2(120, 0)
	linha.add_child(l)
	var atual: int = G.fps_alvo()
	for v in G.LIMITES:
		var b := _botao(str(v) if v > 0 else "Sem limite", func():
			if G.fps_alvo() != v or G.limite != v:
				G.trocar_limite(v)
				montar(), atual == v)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.custom_minimum_size = Vector2(0, 40)
		linha.add_child(b)
	conteudo.add_child(linha)
	_texto("30 ou 60: ritmo igual e esquenta menos.", Menu.APAGADO, 13)
	_teste_fps()

# botão Teste e linha do FPS e ping (conselho 2026-11-13): à vista ou escondidos (grafico.gd teste)
func _teste_fps() -> void:
	var G = m.grafico
	var linha := HBoxContainer.new()
	linha.add_theme_constant_override("separation", 8)
	var l := Menu.rotulo("Teste e FPS", 17)
	l.custom_minimum_size = Vector2(120, 0)
	linha.add_child(l)
	for i in 2:
		var b := _botao(["Mostrar", "Esconder"][i], func():
			if G.teste != (i == 0):
				G.trocar_teste(i == 0)
				if m._tela_teste:
					m._tela_teste.visible = i == 0
				montar(), G.teste == (i == 0))
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.custom_minimum_size = Vector2(0, 40)
		linha.add_child(b)
	conteudo.add_child(linha)

# Visual leve (visual_leve.gd, André 2026-11-10): sombra de verdade só nos personagens e casas + cor da grama
func _visual_leve() -> void:
	var V = m.leve
	if V == null:
		return
	for o in [["Sombras", ["Completas", "Leves"], V.sombra_leve, V.trocar_sombra],
			["Cor da grama", ["Atual", "Natural"], V.grama_natural, V.trocar_grama]]:
		var linha := HBoxContainer.new()
		linha.add_theme_constant_override("separation", 8)
		var l := Menu.rotulo(o[0], 17)
		l.custom_minimum_size = Vector2(120, 0)
		linha.add_child(l)
		for i in 2:
			var fn: Callable = o[3]
			var b := _botao(o[1][i], func():
				fn.call(i == 1)
				montar(), bool(o[2]) == (i == 1))
			b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			b.custom_minimum_size = Vector2(0, 40)
			linha.add_child(b)
		conteudo.add_child(linha)
	_texto("Leves: sombra real só em pessoas e monstros.", Menu.APAGADO, 13)

# barra de 0 a 100% (Som, Música)
func _barra(t: String, valor: float, fn: Callable) -> void:
	var linha := HBoxContainer.new()
	linha.add_theme_constant_override("separation", 12)
	var l := Menu.rotulo(t, 17)
	l.custom_minimum_size = Vector2(120, 0)
	linha.add_child(l)
	var s := HSlider.new()
	s.min_value = 0
	s.max_value = 100
	s.step = 5
	s.value = valor
	s.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	s.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	s.custom_minimum_size = Vector2(0, 32)
	s.focus_mode = Control.FOCUS_NONE
	var trilho := StyleBoxFlat.new()
	trilho.bg_color = Color(0, 0, 0, 0.5)
	trilho.set_corner_radius_all(4)
	trilho.content_margin_top = 4
	trilho.content_margin_bottom = 4
	s.add_theme_stylebox_override("slider", trilho)
	var cheio := StyleBoxFlat.new()
	cheio.bg_color = Menu.OURO
	cheio.set_corner_radius_all(4)
	s.add_theme_stylebox_override("grabber_area", cheio)
	s.add_theme_stylebox_override("grabber_area_highlight", cheio)
	var num := Menu.rotulo("%d%%" % int(valor), 16, Menu.APAGADO)
	num.custom_minimum_size = Vector2(52, 0)
	num.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	s.value_changed.connect(func(v):
		num.text = "%d%%" % int(v)
		fn.call(v)
		salvar())
	linha.add_child(s)
	linha.add_child(num)
	conteudo.add_child(linha)

func _chave(t: String, ligado: bool, fn: Callable) -> void:
	var c := CheckButton.new()
	c.text = t
	c.button_pressed = ligado
	c.focus_mode = Control.FOCUS_NONE
	c.custom_minimum_size = Vector2(0, 42)
	c.add_theme_font_size_override("font_size", 17)
	for k in ["font_color", "font_hover_color", "font_pressed_color", "font_hover_pressed_color"]:
		c.add_theme_color_override(k, Menu.TEXTO)
	c.toggled.connect(fn)
	conteudo.add_child(c)

# ---------- guardar no aparelho ----------
func aplicar_config() -> void:
	var bus := AudioServer.get_bus_index("Master")
	AudioServer.set_bus_mute(bus, volume <= 0.0)
	AudioServer.set_bus_volume_db(bus, linear_to_db(max(volume, 1.0) / 100.0))
	m.vibracao = vibracao
	if m.musica:
		m.musica.definir_volume(volume_musica)
	if m.rotulo:
		m.rotulo.visible = mostrar_fps

func carregar() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(ARQUIVO) != OK:
		return
	recolhido = bool(cfg.get_value("menu", "recolhido", false))
	volume = float(cfg.get_value("config", "volume", 100.0))
	volume_musica = float(cfg.get_value("config", "musica", 45.0))
	vibracao = bool(cfg.get_value("config", "vibracao", true))
	mostrar_fps = bool(cfg.get_value("config", "fps", true))

func salvar() -> void:
	var cfg := ConfigFile.new()
	cfg.load(ARQUIVO)
	cfg.set_value("menu", "recolhido", recolhido)
	cfg.set_value("config", "volume", volume)
	cfg.set_value("config", "musica", volume_musica)
	cfg.set_value("config", "vibracao", vibracao)
	cfg.set_value("config", "fps", mostrar_fps)
	cfg.save(ARQUIVO)

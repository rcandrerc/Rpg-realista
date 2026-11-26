extends CanvasLayer
const Idioma = preload("res://idioma.gd") # inglês (idioma.gd): texto montado também sai traduzido
# Amigos e time (André 2026-11-05: "lista de amigos até 20 e poder dar time pro amigo"; "aparecer barrinha de vida e mana
# do amigo quando estiver em time"). Só online: quem decide é o servidor (shared/simulacao.js amigo/time); a lista fica
# gravada na conta. Tocar noutro jogador (troca.gd) oferece "Adicionar amigo" e "Chamar pro time"; a lista e o time ficam
# na janela Multijogador do menu do topo (menu_topo.gd). Com time, as barras de vida e mana dos amigos aparecem embaixo do
# painel do herói e eles aparecem em verde no minimapa.

const Menu = preload("res://menu.gd")
const COR_TIME := Color("7ee08a") # verde do time (minimapa e barras)

var m # main.gd
var lista: Array = [] # do servidor: [{c, nome, id, nivel, on (0 off, 1 aqui, 2 outro mundo), time}]
var recrutas: Array = [] # os recrutas do jogador (André 2026-11-23): fora da lista de amigos; Msg e Time pelo painel do clã e pelo toque no mundo
var virtuais: Array = [] # amigos virtuais (André 2026-11-09, como no Quimera): a Cecília, só para o dono [{c, nome, id, nivel, time, amizade}]
var maximo := 20
var time: Array = [] # do servidor: [{id, nome, nivel, vida, vidaMax, mana, manaMax, x, z, morto}]
var lider := ""
var _barras: Control
var barras_d := Vector2.ZERO # modo de editar a interface (editar_hud.gd): lugar e tamanho das barras do time
var barras_s := 1.0
const BARRAS := Vector2(18, 122)
var _remover := "" # conta do amigo esperando o segundo toque em "Remover"
var _lista_t := 0.0
var _ativar_ia := false # mostrando os 2 passos de "Ativar conversa com IA" (André 2026-11-10)
var _rolar_y := 0 # a janela Multijogador refaz a cada 1 s: a lista não volta para o topo
# adicionar amigo a distância (André 2026-11-15: "adicionar amigo a distância por pesquisa"): Multijogador > Amigos >
# Adicionar abre a busca pelo nome; "Pedir" manda o pedido, que fica guardado até a pessoa responder (shared/simulacao.js
# amigoBuscar/amigoPedirConta). Tocar no jogador no mundo continua valendo.
var pedidos: Array = [] # do servidor: pedidos que chegaram [{c, nome, on}]
var buscando := false # a janela mostra a busca (o menu do topo não refaz a cada 1 s, senão o teclado fecha)
var busca_txt := ""
var busca_res: Array = [] # do servidor: [{c, nome, on, amigo, env, rec}]
var busca_feita := false
var _res_box: VBoxContainer
var _mt # menu_topo.gd (para refazer a janela)
var esquecido_ate := 0.0 # história v2 (luta da Vesper, fase 2): a Névoa faz o time esquecer de você e os nomes somem

func _init(principal) -> void:
	m = principal
	layer = 3 # junto da HUD (as barras ficam embaixo do painel do herói), abaixo do menu do topo (4)

# Comandos rápidos do time (André 2026-11-19: "no combate vai ser praticamente impossível chegar perto ... eu clico ali no
# time rapidinho e aperto o botão"): tocar na barra de alguém do time (jogador ou NPC) abre 4 botões ao lado. O pedido vai
# ao servidor (simulacao.js comandoTime): aparece no chat do time; jogador recebe o aviso na tela; Cecília e Dario obedecem.
const COMANDOS := [["espera", "Espera aqui", "barreira"], ["segue", "Me segue", "disparada"], ["ataca", "Ataca meu alvo", "it_espada"], ["recua", "Recua", "desfazer"]]
var _toques: Array = [] # [Button] na mesma ordem das barras
var _cmd: PanelContainer = null
var _cmd_id := ""
var _cmd_ate := 0.0
func _ids_barras() -> Array:
	var eu := str(m.online.meu_id) if m.online else ""
	var ids: Array = []
	for t in time:
		if str(t.id) != eu:
			ids.append(t)
	return ids

func _toque_barra(i: int) -> void:
	var lista := _ids_barras()
	if i >= lista.size():
		return
	var t: Dictionary = lista[i]
	if _cmd != null and _cmd_id == str(t.id):
		_fechar_comandos()
		return
	_abrir_comandos(str(t.id), str(t.get("nome", "")), i)

# Pack pela barra do time (André 2026-11-23): dois toques, De e Pra. O bot anda cada trecho (shared/amiga.js
# passoOrdemPackAmiga); "Time todo" (id "*") manda pra todos os bots do time de uma vez.
const PACK_DE := [["palete", "Palete/chão", "it_pack"], ["carrinho", "Carrinho", "it_carrinho"], ["mercante", "Mercante", "it_navio"]]
const PACK_PRA := [["carrinho", "Carrinho", "it_carrinho"], ["mercante", "Mercante", "it_navio"], ["palete", "Palete/chão", "it_pack"], ["mercador", "Mercador (ouro pro clã)", "it_ouro"]]
const TOPO_TODO := 30.0 # altura do botão "Time todo" em cima das barras
var _todo: Button = null

func _abrir_comandos(id: String, nome: String, i: int, modo := "", de := "") -> void:
	_fechar_comandos()
	_cmd_id = id
	_cmd_ate = m.tempo + (12.0 if modo != "" else 5.0)
	_cmd = PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.08, 0.07, 0.06, 0.86)
	sb.border_color = Color(COR_TIME, 0.6)
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(10)
	sb.set_content_margin_all(6)
	_cmd.add_theme_stylebox_override("panel", sb)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 4)
	_cmd.add_child(v)
	var cab := Label.new()
	var quem: String = Idioma.t("Time todo") if id == "*" else nome.split(",")[0]
	cab.text = quem if modo == "" else "%s · %s" % [quem, Idioma.t("Pack: de onde?") if modo == "de" else Idioma.t("Pack: pra onde?")]
	cab.add_theme_font_size_override("font_size", 13)
	cab.add_theme_color_override("font_color", COR_TIME)
	v.add_child(cab)
	if modo == "":
		for c in COMANDOS:
			v.add_child(_botao_cmd(str(c[1]), str(c[2]), _mandar_comando.bind(id, str(c[0]))))
		if id == "*" or _eh_bot(id):
			var bp := _botao_cmd("Pack ›", "it_pack", _abrir_comandos.bind(id, nome, i, "de", ""))
			bp.add_theme_color_override("font_color", Color("ffd98a"))
			v.add_child(bp)
	elif modo == "de":
		for c in PACK_DE:
			v.add_child(_botao_cmd(str(c[1]), str(c[2]), _abrir_comandos.bind(id, nome, i, "pra", str(c[0]))))
		v.add_child(_botao_cmd("Parar", "barreira", _mandar_pack.bind(id, "parar", "")))
	else:
		for c in PACK_PRA:
			if str(c[0]) != de:
				v.add_child(_botao_cmd(str(c[1]), str(c[2]), _mandar_pack.bind(id, de, str(c[0]))))
		v.add_child(_botao_cmd("Voltar", "desfazer", _abrir_comandos.bind(id, nome, i, "de", "")))
	_cmd.scale = Vector2(barras_s, barras_s)
	_cmd.position = BARRAS + barras_d + Vector2(204, (0.0 if id == "*" else _topo() + i * 40.0)) * barras_s
	add_child(_cmd)

func _botao_cmd(texto: String, icone: String, acao: Callable) -> Button:
	var b := Button.new()
	b.text = Idioma.frase(texto)
	b.focus_mode = Control.FOCUS_NONE
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.custom_minimum_size = Vector2(190, 34)
	b.add_theme_font_size_override("font_size", 14)
	b.add_theme_constant_override("icon_max_width", 20)
	b.add_theme_constant_override("h_separation", 8)
	b.icon = Menu.icone_tex(icone)
	Menu.estilo_botao(b, false)
	b.pressed.connect(acao)
	return b

func _eh_bot(id: String) -> bool:
	for t in time:
		if str(t.id) == id:
			return t.get("bot", 0) == 1 or t.get("bot", false) == true
	return false

func _tem_bot() -> bool:
	for t in _ids_barras():
		if t.get("bot", 0) == 1 or t.get("bot", false) == true:
			return true
	return false

# o botão "Time todo" ocupa TOPO_TODO em cima das barras quando há bot no time
func _topo() -> float:
	return TOPO_TODO if _tem_bot() and not m.hud.esconder_combate else 0.0

func _mandar_pack(id: String, de: String, pra: String) -> void:
	m.rede("packTime", {"de": de, "pra": pra, "para": id})
	m.sons.tocar("q_anel_1", -18.0)
	_fechar_comandos()

func _mandar_comando(id: String, c: String) -> void:
	m.rede("comando", {"c": c, "para": id})
	m.sons.tocar("q_anel_1", -18.0)
	_fechar_comandos()

func _fechar_comandos() -> void:
	if _cmd != null:
		_cmd.queue_free()
	_cmd = null
	_cmd_id = ""

func _arrumar_toques() -> void:
	var ids: Array = []
	for t in _ids_barras():
		ids.append(str(t.id))
	var mostra: bool = not m.hud.esconder_combate
	if _cmd != null and (m.tempo > _cmd_ate or not mostra or not (_cmd_id in ids or (_cmd_id == "*" and _tem_bot()))):
		_fechar_comandos()
	while _toques.size() < ids.size():
		var b := Button.new()
		b.flat = true
		b.focus_mode = Control.FOCUS_NONE
		b.mouse_filter = Control.MOUSE_FILTER_STOP
		var vazio := StyleBoxEmpty.new()
		for st in ["normal", "hover", "pressed", "focus", "disabled"]:
			b.add_theme_stylebox_override(st, vazio)
		b.pressed.connect(_toque_barra.bind(_toques.size()))
		add_child(b)
		_toques.append(b)
	var topo := _topo()
	for i in _toques.size():
		var b: Button = _toques[i]
		b.visible = mostra and i < ids.size()
		if b.visible:
			b.position = BARRAS + barras_d + Vector2(0, topo + i * 40.0) * barras_s
			b.size = Vector2(196, 36) * barras_s
	if _todo == null and topo > 0.0:
		_todo = Button.new()
		_todo.text = Idioma.frase("Time todo")
		_todo.focus_mode = Control.FOCUS_NONE
		_todo.add_theme_font_size_override("font_size", 13)
		Menu.estilo_botao(_todo, false)
		_todo.add_theme_color_override("font_color", COR_TIME)
		_todo.pressed.connect(func():
			if _cmd != null and _cmd_id == "*":
				_fechar_comandos()
			else:
				_abrir_comandos("*", "", 0))
		add_child(_todo)
	if _todo != null:
		_todo.visible = topo > 0.0
		_todo.position = BARRAS + barras_d
		_todo.size = Vector2(196, TOPO_TODO - 4.0)
		_todo.scale = Vector2(barras_s, barras_s)

func _ready() -> void:
	_barras = Control.new()
	_barras.set_anchors_preset(Control.PRESET_FULL_RECT)
	_barras.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_barras.draw.connect(_desenhar_barras)
	add_child(_barras)

func em_time() -> bool:
	return not time.is_empty()

func eh_amigo_id(id: String) -> bool:
	for a in lista:
		if str(a.get("id", "")) == id:
			return true
	return false

# a conta de um amigo da lista que está nesta sala (para a Mensagem do cartão, troca.gd)
func conta_amigo(id: String) -> String:
	for a in lista:
		if str(a.get("id", "")) == id:
			return str(a.get("c", ""))
	return ""

func no_meu_time(id: String) -> bool:
	for t in time:
		if str(t.id) == id:
			return true
	return false

func sou_lider() -> bool:
	return lider != "" and m.online != null and lider == str(m.online.meu_id)

# botões extras do cartão de tocar noutro jogador (troca.gd): adicionar amigo ou chamar pro time
func botoes_para(id: String) -> Array:
	if not m.on():
		return []
	if not eh_amigo_id(id):
		return [["Adicionar amigo", func(): _enviar("amigo", {"acao": "pedir", "com": id})]]
	if not no_meu_time(id):
		return [["Chamar pro time", func(): _enviar("time", {"acao": "convidar", "com": id})]]
	return []

func _enviar(tipo: String, msg: Dictionary) -> void:
	m.troca.esconder_cartao()
	m.rede(tipo, msg)

# pede a lista de novo (abrir a janela Multijogador: quem entrou em outro mundo)
func pedir_lista() -> void:
	m.rede("amigo", {"acao": "lista"})

func _process(dt: float) -> void:
	var t0_parte := Time.get_ticks_usec()
	_process_parte(dt)
	if Time.get_ticks_usec() - t0_parte >= 1000 and Engine.has_meta("lentidao"): # quadro lento (lentidao.gd)
		Engine.get_meta("lentidao").ev("amigos", t0_parte)

func _process_parte(dt: float) -> void:
	if m.menu_topo and m.menu_topo.aberta == "multi":
		_lista_t -= dt
		if _lista_t <= 0.0:
			_lista_t = 5.0
			pedir_lista()
	else:
		_lista_t = 0.0
		_remover = ""
		buscando = false
	if em_time() and Engine.get_process_frames() % 3 == 0: # FPS (auditoria 2026-11-11): barras do time 20 vezes por segundo
		_barras.queue_redraw()
	if (em_time() or not _toques.is_empty()) and Engine.get_process_frames() % 15 == 0:
		_arrumar_toques()

# ---------- o que vem do servidor (online.gd) ----------
func do_servidor(ev: Dictionary) -> void:
	match str(ev.get("t", "")):
		"amigos":
			lista = ev.get("lista", [])
			maximo = int(ev.get("max", 20))
			virtuais = ev.get("virtuais", [])
			recrutas = ev.get("recrutas", [])
			pedidos = ev.get("pedidos", [])
		"amigoBusca": # resultado da busca pelo nome
			busca_res = ev.get("lista", [])
			busca_feita = true
			_preencher_busca()
		"amigo": # pedido de amizade
			if str(ev.get("fase", "")) == "pedidoC": # pedido a distância (busca): também fica na lista em "Pedidos"
				var c := str(ev.get("c", ""))
				m.troca.mostrar_cartao("%s quer ser seu amigo" % str(ev.get("nome", "Alguém")), [["Aceitar", func(): _enviar("amigo", {"acao": "aceitarC", "c": c})], ["Recusar", func(): _enviar("amigo", {"acao": "recusarC", "c": c})]], float(ev.get("dur", 30)))
				m.sons.tocar("pano", -8.0)
				return
			var de := str(ev.de)
			m.troca.mostrar_cartao("%s quer ser seu amigo" % str(ev.get("nome", "Alguém")), [["Aceitar", func(): _enviar("amigo", {"acao": "aceitar", "com": de})], ["Recusar", func(): _enviar("amigo", {"acao": "recusar", "com": de})]], float(ev.get("dur", 30)))
			m.sons.tocar("pano", -8.0)
		"time":
			match str(ev.get("fase", "")):
				"convite":
					var de := str(ev.de)
					m.troca.mostrar_cartao("%s chamou você para o time" % str(ev.get("nome", "Alguém")), [["Entrar", func(): _enviar("time", {"acao": "aceitar", "com": de})], ["Recusar", func(): _enviar("time", {"acao": "recusar", "com": de})]], float(ev.get("dur", 30)))
					m.sons.tocar("pano", -8.0)
				"estado":
					time = ev.get("membros", [])
					lider = str(ev.get("lider", ""))
				"fim":
					limpar_time()

func limpar_time() -> void:
	time = []
	lider = ""
	_barras.queue_redraw()

# caiu a conexão ou saiu da sala: o servidor desfaz o time
func desligou() -> void:
	limpar_time()
	lista = []

# altura que as barras do time ocupam na tela (missao_ativa.gd põe a missão logo embaixo). No modo de editar com o
# time vazio aparecem duas barras de modelo (editar_hud.gd), e a missão desce para não ficar presa atrás delas.
func linhas_barras(editando := false) -> int:
	var eu := str(m.online.meu_id) if m.online else ""
	var n := 0
	for t in time:
		if str(t.id) != eu:
			n += 1
	if n == 0 and editando:
		return 2
	return 0 if m.hud.esconder_combate else n

func altura_barras(editando := false) -> float:
	return (linhas_barras(editando) * 40.0 + (_topo() if not editando else 0.0)) * barras_s

# ---------- barras do time (embaixo do painel do herói) ----------
func _desenhar_barras() -> void:
	if time.is_empty() or m.hud.esconder_combate:
		return
	var f := ThemeDB.fallback_font
	var eu := str(m.online.meu_id) if m.online else ""
	_barras.draw_set_transform(BARRAS + barras_d, 0.0, Vector2(barras_s, barras_s))
	if m.buffs:
		m.buffs.limpar_prefixo("time:")
	var y := _topo()
	for t in time:
		if str(t.id) == eu:
			continue
		var p := Vector2(0, y)
		var tam := Vector2(196, 36)
		var morto: bool = t.get("morto", false) == true
		# André 2026-11-11: cartão do time com as pontas mais arredondadas (cor igual)
		_caixa(Rect2(p, tam), 10, Color(0.08, 0.07, 0.06, 0.72))
		_caixa(Rect2(p, tam), 10, Color(COR_TIME, 0.5) if not morto else Color(0.5, 0.3, 0.3, 0.6), 1)
		var nome := str(t.get("nome", ""))
		if m.tempo < esquecido_ate:
			nome = "· · ·"
		var cab := ("%s%s  " + Idioma.t("Nv %d")) % ["★ " if str(t.id) == lider else "", nome, int(t.get("nivel", 1))]
		_barras.draw_string_outline(f, p + Vector2(8, 13), cab, HORIZONTAL_ALIGNMENT_LEFT, tam.x - 14, 13, 3, Color(0, 0, 0, 0.7))
		_barras.draw_string(f, p + Vector2(8, 13), cab, HORIZONTAL_ALIGNMENT_LEFT, tam.x - 14, 13, COR_TIME if not morto else Color(0.75, 0.6, 0.6))
		var fv: float = float(t.get("vida", 0)) / max(1.0, float(t.get("vidaMax", 1)))
		var fm: float = float(t.get("mana", 0)) / max(1.0, float(t.get("manaMax", 1)))
		_barra(p + Vector2(8, 17), Vector2(tam.x - 16, 10), fv, Color(0.8, 0.22, 0.2), Idioma.t("CAÍDO") if morto else "%d/%d" % [int(t.get("vida", 0)), int(t.get("vidaMax", 0))])
		_barra(p + Vector2(8, 29), Vector2(tam.x - 16, 4), fm, Color(0.22, 0.45, 0.85), "")
		if m.buffs and not morto: # buffs e debuffs dele (buffs.gd): ícones pequenos do lado direito do cartão
			var bl: Array = m.buffs.do_id(str(t.id))
			if not bl.is_empty():
				var bp := p + Vector2(tam.x + 4.0, 9.0)
				m.buffs.desenhar(_barras, "time:" + str(t.id), bl, bp, 18.0, BARRAS + barras_d + bp * barras_s, barras_s, 4)
		y += tam.y + 4.0
	_barras.draw_set_transform(Vector2.ZERO)

var _sb: StyleBoxFlat
func _caixa(r: Rect2, raio: int, cor: Color, borda := 0) -> void:
	if r.size.x <= 0.5 or r.size.y <= 0.5:
		return
	if _sb == null:
		_sb = StyleBoxFlat.new()
		_sb.anti_aliasing = true
	_sb.set_corner_radius_all(int(min(float(raio), r.size.y * 0.5, r.size.x * 0.5)))
	_sb.draw_center = borda == 0
	_sb.set_border_width_all(borda)
	_sb.bg_color = cor
	_sb.border_color = cor
	_sb.draw(_barras.get_canvas_item(), r)

func _barra(pos: Vector2, tam: Vector2, frac: float, cor: Color, texto: String) -> void:
	_caixa(Rect2(pos, tam), 3, Color(0, 0, 0, 0.5))
	_caixa(Rect2(pos, Vector2(tam.x * clamp(frac, 0.0, 1.0), tam.y)), 3, cor)
	if texto != "":
		var f := ThemeDB.fallback_font
		var w := f.get_string_size(texto, HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x
		_barras.draw_string_outline(f, pos + Vector2((tam.x - w) * 0.5, tam.y - 2), texto, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, 3, Color(0, 0, 0, 0.7))
		_barras.draw_string(f, pos + Vector2((tam.x - w) * 0.5, tam.y - 2), texto, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color.WHITE)

# onde está cada um do time (minimapa.gd pinta de verde)
func pontos_time() -> Array:
	var r: Array = []
	var eu := str(m.online.meu_id) if m.online else ""
	for t in time:
		if str(t.id) == eu:
			continue
		var x := float(t.get("x", 0))
		var z := float(t.get("z", 0))
		var o = m.online.outros.get(str(t.id)) if m.online else null
		if o is Dictionary and o.has("no") and is_instance_valid(o.no): # perto: a posição suave da tela
			x = o.no.position.x
			z = o.no.position.z
		r.append({"x": x, "z": z, "nome": str(t.get("nome", ""))})
	return r

# ---------- janela Multijogador (menu_topo.gd) ----------
# time e amigos numa área que rola (a janela não passa da altura da tela; refaz a cada 1 s sem voltar para o topo)
func montar_janela(mt) -> void:
	_mt = mt
	if buscando:
		_montar_busca(mt)
		return
	var rolar := ScrollContainer.new()
	rolar.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.add_theme_constant_override("separation", 6)
	var margem := MarginContainer.new() # espaço para a barra de rolar não cobrir os botões
	margem.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	margem.add_theme_constant_override("margin_right", 14)
	margem.add_child(col)
	rolar.add_child(margem)
	var linhas := 0
	# time
	if em_time():
		col.add_child(Menu.rotulo("Time (%d/%d)%s" % [time.size(), int(m.P.dados.get("time", {}).get("max", 5)), " · você é o líder" if sou_lider() else ""], 18, COR_TIME))
		for t in time:
			if str(t.id) == str(m.online.meu_id):
				continue
			var linha := HBoxContainer.new()
			linha.add_theme_constant_override("separation", 8)
			var l := Menu.rotulo("%s%s · Nv %d" % ["★ " if str(t.id) == lider else "", str(t.nome), int(t.get("nivel", 1))], 15, Menu.TEXTO)
			l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			linha.add_child(l)
			if sou_lider():
				var id := str(t.id)
				linha.add_child(_pequeno(mt._botao("Tirar do time", func(): m.rede("time", {"acao": "expulsar", "com": id}), false), 130))
			col.add_child(linha)
			linhas += 1
		if m.chat: # chat de time (André 2026-11-11): falar com todos de uma vez
			var bc: Button = mt._botao("Falar com o time", func(): m.chat.abrir_time(), false)
			bc.custom_minimum_size = Vector2(0, 38)
			bc.add_theme_color_override("font_color", COR_TIME)
			col.add_child(bc)
			linhas += 1
		var bs: Button = mt._botao("Sair do time", func(): m.rede("time", {"acao": "sair"}), false)
		bs.custom_minimum_size = Vector2(0, 38)
		col.add_child(bs)
		linhas += 2
	# amigos (o botão "Adicionar" abre a busca pelo nome)
	var cab := HBoxContainer.new()
	cab.add_theme_constant_override("separation", 8)
	var titulo := Menu.rotulo("Amigos (%d/%d)" % [lista.size(), maximo], 18, Menu.OURO_CLARO)
	titulo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cab.add_child(titulo)
	cab.add_child(_pequeno(mt._botao("Adicionar", func():
		buscando = true
		mt.montar()), 120))
	col.add_child(cab)
	# pedidos que chegaram (pela busca): aceitar ou recusar daqui mesmo
	if not pedidos.is_empty():
		col.add_child(Menu.rotulo("Pedidos (%d)" % pedidos.size(), 15, Menu.OURO_CLARO))
		linhas += 1
		for pd in pedidos:
			var pc := str(pd.c)
			var lp := HBoxContainer.new()
			lp.add_theme_constant_override("separation", 8)
			var ln := Menu.rotulo(str(pd.nome), 15, Menu.TEXTO)
			ln.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			ln.clip_text = true
			lp.add_child(ln)
			lp.add_child(_pequeno(mt._botao("Aceitar", func():
				m.rede("amigo", {"acao": "aceitarC", "c": pc})
				_lista_t = 0.6), 96))
			lp.add_child(_pequeno(mt._botao("Recusar", func():
				m.rede("amigo", {"acao": "recusarC", "c": pc})
				_lista_t = 0.6, false), 96))
			col.add_child(lp)
			linhas += 1
	if lista.is_empty():
		var dica := Menu.rotulo("Toque no jogador no mundo ou use \"Adicionar\".", 14, Menu.APAGADO)
		dica.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		dica.custom_minimum_size = Vector2(400, 0)
		col.add_child(dica)
		linhas += 1
	for a in lista:
		var c := str(a.c)
		var on := int(a.get("on", 0))
		var linha := HBoxContainer.new()
		linha.add_theme_constant_override("separation", 8)
		var ponto := ColorRect.new()
		ponto.custom_minimum_size = Vector2(8, 8)
		ponto.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		ponto.color = Menu.VERDE if on == 1 else Color(0.85, 0.7, 0.35) if on == 2 else Color(0.4, 0.38, 0.35)
		linha.add_child(ponto)
		var est := "aqui" if on == 1 else "em outro mundo" if on == 2 else "offline"
		if on == 1 and a.get("nivel") != null:
			est = "Nv %d · aqui" % int(a.nivel)
		# André 2026-11-16: nome em cima e o resto embaixo (os botões cobriam o fim da linha), igual à Cecília e ao Dario
		linha.add_child(_nome_e_info(str(a.nome), est, Menu.TEXTO if on > 0 else Menu.APAGADO))
		if on == 1 and not a.get("time", false):
			linha.add_child(_pequeno(mt._botao("Time", func(): m.rede("time", {"acao": "convidar", "com": c})), 70))
		if m.chat: # mensagem privada (chat.gd, aba Amigos)
			linha.add_child(_pequeno(mt._botao("Msg", func():
				mt.fechar()
				m.chat.abrir_pm(c, str(a.nome)), false), 64))
		var confirmar := _remover == c
		linha.add_child(_pequeno(mt._botao("Certeza?" if confirmar else "Remover", func():
			if _remover == c:
				_remover = ""
				m.rede("amigo", {"acao": "remover", "c": c})
			else:
				_remover = c
			mt.montar(), false, confirmar), 92))
		col.add_child(linha)
		linhas += 1
	# amigos virtuais: a Cecília e o Dario (shared/amiga.js). "Msg" abre a conversa privada. André 2026-11-13 ("como se
	# fosse um jogador real"): "Time" e "Sair do time" só fazem a ação, sem frase no chat por ele; o resto ele fala no chat
	var sem_ia := false # sem a chave Groq: o "Ativar conversa com IA" aparece uma vez, embaixo deles (a chave vale para todos)
	if not virtuais.is_empty():
		col.add_child(Menu.rotulo("Amigos virtuais", 18, Color("ff8fc8")))
		linhas += 1
		for v in virtuais:
			var c := str(v.c)
			var nome := str(v.nome)
			var linha := HBoxContainer.new()
			linha.add_theme_constant_override("separation", 8)
			var coracao := Menu.rotulo("♥", 15, Color("ff8fc8"))
			linha.add_child(coracao)
			# André 2026-11-16: só aparece quem ele adicionou e o NPC aceitou; o selo "NPC" mostra que não é gente
			# André 2026-11-16: o botão "Msg" cobria a amizade; agora nome em cima, nível e amizade embaixo
			linha.add_child(_nome_e_info("%s  [NPC]" % nome, "Nv %d · ♥ %d" % [int(v.get("nivel", 1)), int(v.get("amizade", 0))], Menu.TEXTO))
			# André 2026-11-15: todo mundo manda mensagem e chama pro time (sem chave, as respostas são as prontas);
			# a chave Groq só troca as respostas pela IA. "Msg" e "Time" sempre; "Ativar conversa com IA" vem embaixo
			if m.chat:
				linha.add_child(_pequeno(mt._botao("Msg", func():
					mt.fechar()
					m.chat.abrir_pm(c, nome), false), 64))
			var vid := str(v.get("id", "")) if v.get("id") != null else ""
			if v.get("time", false):
				linha.add_child(_pequeno(mt._botao("Sair do time", func(): _time_virtual(mt, "expulsar", vid, c), false), 120))
			elif int(v.get("on", 1)) == 1 and not v.get("semTime", false): # líder de clã bot: sem convite (André 2026-11-25)
				linha.add_child(_pequeno(mt._botao("Time", func(): _time_virtual(mt, "convidar", vid, c)), 70))
			var conf_v := _remover == c # desfazer a amizade com o NPC: dois toques, como com gente
			linha.add_child(_pequeno(mt._botao("Certeza?" if conf_v else "Remover", func():
				if _remover == c:
					_remover = ""
					m.rede("amigo", {"acao": "remover", "c": c})
				else:
					_remover = c
				mt.montar(), false, conf_v), 92))
			col.add_child(linha)
			linhas += 1
			if not v.get("ia", true):
				sem_ia = true
		if sem_ia:
			# sem a chave Groq dele: cria a chave grátis no site e cola aqui uma vez só (o servidor testa e guarda na conta)
			var lia := HBoxContainer.new()
			lia.add_theme_constant_override("separation", 8)
			var dica := Menu.rotulo("Respostas com IA (opcional)", 13, Menu.APAGADO)
			dica.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			lia.add_child(dica)
			lia.add_child(_pequeno(mt._botao("Ativar conversa com IA", func():
				_ativar_ia = not _ativar_ia
				mt.montar(), _ativar_ia), 200))
			col.add_child(lia)
			linhas += 1
			if _ativar_ia:
				col.add_child(Menu.rotulo("1. Entre com sua conta Google no site e toque em Create API Key. Copie a chave.\n2. Volte aqui e toque em Colar a chave.", 14, Menu.APAGADO))
				var passos := HBoxContainer.new()
				passos.add_theme_constant_override("separation", 8)
				passos.add_child(_pequeno(mt._botao("1. Criar chave grátis", func(): OS.shell_open("https://console.groq.com/keys"), false), 190))
				passos.add_child(_pequeno(mt._botao("2. Colar a chave", func():
					var chave := DisplayServer.clipboard_get().strip_edges()
					if not chave.begins_with("gsk_"):
						m.troca.mostrar_cartao("Copie a chave no site do Groq primeiro (começa com gsk_)", [["Ok", func(): pass]], 6.0)
						return
					m.rede("chaveIa", {"chave": chave})
					_ativar_ia = false
					mt.montar(), false), 170))
				col.add_child(passos)
				linhas += 3
	rolar.custom_minimum_size = Vector2(416, min(230.0, 26.0 + 40.0 * linhas))
	mt.conteudo.add_child(rolar)
	rolar.get_v_scroll_bar().value_changed.connect(func(v): _rolar_y = int(v))
	rolar.set_deferred("scroll_vertical", _rolar_y)

# ---------- busca pelo nome (adicionar amigo a distância) ----------
func _montar_busca(mt) -> void:
	var cab := HBoxContainer.new()
	cab.add_theme_constant_override("separation", 8)
	var t := Menu.rotulo("Adicionar amigo", 18, Menu.OURO_CLARO)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cab.add_child(t)
	cab.add_child(_pequeno(mt._botao("Voltar", func():
		buscando = false
		mt.montar(), false), 100))
	mt.conteudo.add_child(cab)
	var linha := HBoxContainer.new()
	linha.add_theme_constant_override("separation", 8)
	var campo := LineEdit.new()
	campo.placeholder_text = "Nome do jogador"
	campo.text = busca_txt
	campo.max_length = 20
	campo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	campo.custom_minimum_size = Vector2(0, 42)
	campo.add_theme_font_size_override("font_size", 16)
	campo.add_theme_stylebox_override("normal", Menu.caixa(Color(0.035, 0.03, 0.026, 1), Color(0.36, 0.29, 0.19), 1, 10))
	campo.add_theme_stylebox_override("focus", Menu.caixa(Color(0.035, 0.03, 0.026, 1), Menu.OURO, 1, 10))
	campo.clear_button_enabled = true
	campo.text_changed.connect(func(tx: String): busca_txt = tx)
	campo.text_submitted.connect(func(_tx: String): _buscar(campo))
	linha.add_child(campo)
	var b: Button = mt._botao("Buscar", func(): _buscar(campo))
	b.custom_minimum_size = Vector2(110, 42)
	linha.add_child(b)
	mt.conteudo.add_child(linha)
	var rolar := ScrollContainer.new()
	rolar.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	rolar.custom_minimum_size = Vector2(416, 200)
	var margem := MarginContainer.new()
	margem.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	margem.add_theme_constant_override("margin_right", 14)
	_res_box = VBoxContainer.new()
	_res_box.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_res_box.add_theme_constant_override("separation", 6)
	margem.add_child(_res_box)
	rolar.add_child(margem)
	mt.conteudo.add_child(rolar)
	_preencher_busca()
	if busca_res.is_empty():
		campo.call_deferred("grab_focus") # abre o teclado do celular

func _buscar(campo: LineEdit) -> void:
	busca_txt = campo.text.strip_edges()
	if busca_txt.length() < 2:
		m.hud.aviso("Digite ao menos 2 letras")
		return
	campo.release_focus() # fecha o teclado para ver o resultado
	m.rede("amigo", {"acao": "buscar", "nome": busca_txt})

# o resultado entra na caixa sem refazer a janela (o campo continua com o texto)
func _preencher_busca() -> void:
	if _res_box == null or not is_instance_valid(_res_box) or _mt == null:
		return
	for c in _res_box.get_children():
		_res_box.remove_child(c)
		c.queue_free()
	if not busca_feita:
		var d := Menu.rotulo("Busque pelo nome do personagem.", 14, Menu.APAGADO)
		_res_box.add_child(d)
		return
	if busca_res.is_empty():
		_res_box.add_child(Menu.rotulo("Ninguém com esse nome", 14, Menu.APAGADO))
		return
	for r in busca_res:
		var c := str(r.c)
		var on := int(r.get("on", 0))
		var linha := HBoxContainer.new()
		linha.add_theme_constant_override("separation", 8)
		var ponto := ColorRect.new()
		ponto.custom_minimum_size = Vector2(8, 8)
		ponto.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		ponto.color = Menu.VERDE if on == 1 else Color(0.85, 0.7, 0.35) if on == 2 else Color(0.4, 0.38, 0.35)
		linha.add_child(ponto)
		var est := "aqui" if on == 1 else "em outro mundo" if on == 2 else "offline"
		var npc := bool(r.get("npc", false)) # Cecília/Dario (André 2026-11-16): pedem-se pela busca também e respondem na hora
		var l := Menu.rotulo(("%s  [NPC]" % str(r.nome)) if npc else ("%s  (%s)" % [str(r.nome), Idioma.frase(est)]), 15, Menu.TEXTO if on > 0 else Menu.APAGADO)
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		l.clip_text = true
		linha.add_child(l)
		if npc and not r.get("amigo", false):
			linha.add_child(_pequeno(_mt._botao("Pedir", func():
				m.rede("amigo", {"acao": "pedirC", "c": c})
				_lista_t = 0.6), 100))
		elif r.get("amigo", false):
			linha.add_child(Menu.rotulo("Amigo", 14, Menu.VERDE))
		elif r.get("env", false):
			var be: Button = _pequeno(_mt._botao("Enviado", func(): pass, false), 100)
			be.disabled = true
			linha.add_child(be)
		else:
			var rr: Dictionary = r
			linha.add_child(_pequeno(_mt._botao("Aceitar" if r.get("rec", false) else "Pedir", func():
				m.rede("amigo", {"acao": "pedirC", "c": c})
				if rr.get("rec", false):
					rr["amigo"] = true
				else:
					rr["env"] = true
				_preencher_busca()), 100))
		_res_box.add_child(linha)

# botão de time do amigo virtual: só a ação, como com um jogador (o servidor decide se ele/ela entra)
func _time_virtual(mt, acao: String, id: String, c: String) -> void:
	m.rede("time", {"acao": acao, "com": id if id != "" else c})
	_lista_t = 0.6 # a lista volta já com o time novo
	mt.montar()

# a conta (para a mensagem privada) do amigo virtual com este id na sala, ou ""
func conta_virtual(id: String) -> String:
	for v in virtuais + recrutas:
		if v is Dictionary and str(v.get("id", "")) == id:
			return str(v.get("c", ""))
	return ""

func _pequeno(b: Button, largura: float) -> Button:
	b.custom_minimum_size = Vector2(largura, 34)
	b.add_theme_font_size_override("font_size", 14)
	return b

# nome em cima e a informação (nível, amizade, onde está) embaixo, menor: cabe ao lado dos botões sem ser cortado
func _nome_e_info(nome: String, info: String, cor: Color) -> Control:
	var caixa := VBoxContainer.new()
	caixa.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	caixa.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	caixa.add_theme_constant_override("separation", 0)
	var l := Menu.rotulo(nome, 15, cor)
	l.clip_text = true
	l.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	caixa.add_child(l)
	var i := Menu.rotulo(info, 13, Menu.APAGADO if cor == Menu.APAGADO else Color("ffc8e4"))
	i.clip_text = true
	caixa.add_child(i)
	return caixa

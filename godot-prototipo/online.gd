extends Node
# Modo online: o herói anda no celular e o servidor confere (igual ao site depois do PR #42).
# Vão para o servidor: posição 20x por segundo, botões (golpe, habilidades, pulo, dash, rolar, troca).
# Vêm do servidor: vida e mana, inimigos (posição, animação, vida), outros jogadores e o dano de verdade.
# Golpes e magias aparecem na hora no celular (animação e efeitos); quem acerta e quanto tira é o servidor que diz.

const Rede = preload("res://rede.gd")
const D = preload("res://dados.gd")
const Aparencia = preload("res://aparencia.gd")

var m # main.gd
var rede
var ligado := false # dentro da sala
var meu_id := ""
var outros := {} # id -> {no, anim, alvo, ry, seq, barra, modo, uma_vez}
var corpos := {} # id do servidor -> Node3D (para números de dano e efeitos)
var de_servidor := {} # nome da animação no servidor -> nome no Godot
var para_servidor := {} # o contrário
var _pos_t := 0.0
var _ent_t := 0.0
var _ultima_entrada := {}
var _tentar_de_novo := -1.0
var _build_ok := false
var _pronto := false
var _ap_mandar = null # aparência do criador esperando para ir ao servidor (no máximo 4 por segundo)
var _ap_t := 0.0
var _ap_txt := "" # última aparência do meu herói que veio do servidor
var _visual_txt := "" # último corpo do meu herói que veio do servidor
var _visual_mandado := "" # corpo do criador que já foi para o servidor (conta nova, ao vivo)
var _status_t := 0.0
var jogadores := 0
# tela de login
var tela: CanvasLayer
var painel: Control
var aviso_login: Label
var status: Button
var titulo: Label
var sub: Label
var b_continuar: Button
var b_trocar: Button
var b_google: Button
var capa: TextureRect # arte do Aethra atrás da tela de login (pedido do André: login com arte, não com o jogo já aparecendo)

func _init(principal) -> void:
	m = principal

func _ready() -> void:
	para_servidor = m.mundo.anims
	for k in para_servidor:
		de_servidor[para_servidor[k]] = k
	de_servidor.merge({"Walk": "andar", "Run": "corrida", "Idle": "parada", "dash": "corrida", "puloCorrendo": "pulo"}, true)
	rede = Rede.new()
	add_child(rede)
	rede.estado.connect(func(t):
		aviso_login.text = t
		atualizar_status(t))
	rede.precisa_login.connect(mostrar_login)
	rede.escolher_conta.connect(mostrar_escolha)
	rede.entrou.connect(ao_entrar)
	rede.mensagem.connect(ao_receber)
	rede.caiu.connect(ao_cair)
	montar_tela()
	rede.iniciar(true)

# ---------- tela de login ----------
func montar_tela() -> void:
	tela = CanvasLayer.new()
	tela.layer = 5
	add_child(tela)
	capa = TextureRect.new()
	capa.texture = load("res://ui/capa_aethra.jpg")
	capa.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	capa.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	capa.set_anchors_preset(Control.PRESET_FULL_RECT)
	capa.mouse_filter = Control.MOUSE_FILTER_STOP # os toques não passam para o jogo
	capa.visible = false
	tela.add_child(capa)
	status = Button.new()
	status.flat = true
	status.add_theme_font_size_override("font_size", 14)
	status.add_theme_color_override("font_color", Color(1, 0.95, 0.85))
	status.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	status.add_theme_constant_override("outline_size", 4)
	status.anchor_left = 0.5
	status.anchor_right = 0.5
	status.offset_left = -170
	status.offset_right = 170
	status.offset_top = 6
	status.offset_bottom = 34
	status.text = "Sozinho · tocar para jogar online"
	status.pressed.connect(func(): if not ligado: mostrar_login())
	tela.add_child(status)

	painel = PanelContainer.new()
	var caixa := StyleBoxFlat.new()
	caixa.bg_color = Color(0.07, 0.06, 0.09, 0.8)
	caixa.border_color = Color(0.95, 0.75, 0.42, 0.75)
	caixa.set_border_width_all(2)
	caixa.set_corner_radius_all(18)
	caixa.content_margin_left = 34
	caixa.content_margin_right = 34
	caixa.content_margin_top = 24
	caixa.content_margin_bottom = 24
	caixa.shadow_color = Color(0, 0, 0, 0.5)
	caixa.shadow_size = 16
	painel.add_theme_stylebox_override("panel", caixa)
	painel.anchor_left = 0.78 # à direita: a heroína da arte fica à esquerda
	painel.anchor_right = 0.78
	painel.anchor_top = 0.63 # abaixo do título "Aethra" da arte
	painel.anchor_bottom = 0.63
	painel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	painel.grow_vertical = Control.GROW_DIRECTION_BOTH
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 14)
	col.alignment = BoxContainer.ALIGNMENT_CENTER
	painel.add_child(col)
	titulo = Label.new()
	titulo.text = "Jogar online"
	titulo.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	titulo.add_theme_font_size_override("font_size", 30)
	titulo.add_theme_color_override("font_color", Color(1, 0.86, 0.6))
	col.add_child(titulo)
	sub = Label.new()
	sub.text = "Entre com a mesma conta Google do site.\nO login abre no navegador e depois volta para cá."
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.add_theme_font_size_override("font_size", 16)
	sub.add_theme_color_override("font_color", Color(0.9, 0.87, 0.82))
	col.add_child(sub)
	b_continuar = _botao("Entrar", Color(0.93, 0.62, 0.25), func():
		esconder_login()
		rede.continuar())
	col.add_child(b_continuar)
	b_trocar = _botao("Trocar de conta", Color(0.42, 0.36, 0.5), func(): rede.trocar_conta())
	col.add_child(b_trocar)
	b_google = _botao("Entrar com Google", Color(0.93, 0.62, 0.25), func(): rede.entrar_com_google())
	col.add_child(b_google)
	col.add_child(_botao("Jogar sozinho", Color(0.3, 0.3, 0.36), func(): esconder_login()))
	aviso_login = Label.new()
	aviso_login.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	aviso_login.add_theme_font_size_override("font_size", 15)
	aviso_login.add_theme_color_override("font_color", Color(1, 0.8, 0.55))
	col.add_child(aviso_login)
	painel.visible = false
	tela.add_child(painel)

func _botao(texto: String, cor: Color, fn: Callable) -> Button:
	var b := Button.new()
	b.text = texto
	b.custom_minimum_size = Vector2(300, 54)
	b.add_theme_font_size_override("font_size", 20)
	for estado in ["normal", "hover", "pressed", "focus"]:
		var s := StyleBoxFlat.new()
		s.bg_color = cor.darkened(0.15) if estado == "pressed" else cor
		s.set_corner_radius_all(27)
		b.add_theme_stylebox_override(estado, s)
	b.pressed.connect(fn)
	return b

func mostrar_login() -> void:
	titulo.text = "Jogar online"
	sub.text = "Entre com a sua conta Google.\nA janela do Google abre aqui mesmo no jogo."
	b_continuar.visible = false
	b_trocar.visible = false
	b_google.visible = true
	painel.visible = true
	capa.visible = true
	status.visible = false # o aviso do topo ficaria em cima do cabelo e do círculo da arte
	m.hud.set_process_input(false) # os toques não mexem no joystick por trás
	atualizar_status("")

# abriu o jogo com conta salva: entra com ela ou troca de conta (pedido do André: perguntar toda vez)
func mostrar_escolha(conta: Dictionary) -> void:
	titulo.text = "Bem-vindo de volta"
	sub.text = "Conta salva: %s\nQuer entrar com ela ou usar outra conta Google?" % str(conta.get("nome", "sem nome"))
	b_continuar.text = "Entrar como %s" % str(conta.get("nome", "esta conta"))
	b_continuar.visible = true
	b_trocar.visible = true
	b_google.visible = false
	painel.visible = true
	capa.visible = true
	status.visible = false # o aviso do topo ficaria em cima do cabelo e do círculo da arte
	m.hud.set_process_input(false)
	atualizar_status("")

func esconder_login() -> void:
	painel.visible = false
	capa.visible = false
	status.visible = true
	m.hud.set_process_input(true)

func atualizar_status(_t := "") -> void:
	if ligado:
		var p := "" if rede.ping_ms < 0 else " · %d ms" % rede.ping_ms
		var txt := "Online · %d %s%s" % [jogadores, "jogador" if jogadores == 1 else "jogadores", p]
		if status.text != txt: # trocar o texto refaz o layout: só quando muda
			status.text = txt
	elif _t != "" and _t != "Online":
		status.text = _t
	else:
		status.text = "Sozinho · tocar para jogar online"

# ---------- sala ----------
func ao_entrar(id: String, conta: Dictionary) -> void:
	ligado = true
	meu_id = id
	_build_ok = false
	esconder_login()
	m.hud.nome = str(conta.get("nome", m.hud.nome))
	m.hud.aviso("Online!")
	rede.enviar("modo", m.h.modo)
	for e in m.inimigos:
		e.estado = "vivo"
		e.seq = -1
		e.uma_vez = 0.0
		e.alvo = e.no.position

func ao_cair(motivo: String) -> void:
	var estava := ligado
	ligado = false
	for id in outros:
		outros[id].no.queue_free()
	outros.clear()
	for e in m.inimigos: # inimigos voltam para a cabeça do celular
		if e.estado != "morto":
			e.estado = "vagar"
	if estava:
		m.hud.aviso("Caiu a conexão. Tentando de novo…")
		_tentar_de_novo = 4.0
	elif motivo == "fora" or motivo == "sala" or motivo.begins_with("fechou"):
		_tentar_de_novo = 15.0 if rede.sessao != "" else -1.0
	atualizar_status("Sem conexão" if rede.sessao != "" else "")

# o jogador escolheu sair da sala (menu do topo: Jogar sozinho, Trocar ou Sair da conta): limpa sem tentar voltar
func desligar() -> void:
	_tentar_de_novo = -1.0
	if ligado:
		ligado = false
		for id in outros:
			outros[id].no.queue_free()
		outros.clear()
		for e in m.inimigos: # inimigos voltam para a cabeça do celular
			if e.estado != "morto":
				e.estado = "vagar"
	atualizar_status("")

func enviar(tipo: String, dados = null) -> void:
	if ligado:
		rede.enviar(tipo, dados)

func ao_receber(tipo, dados) -> void:
	if str(tipo) != "mundo" or not (dados is Dictionary):
		return
	if dados.has("foto"):
		aplicar_foto(dados.foto)
	for ev in dados.get("eventos", []):
		evento(ev)

func aplicar_foto(f: Dictionary) -> void:
	corpos.clear()
	corpos[meu_id] = m.heroi
	var vistos := {}
	jogadores = 0
	for j in f.get("jogadores", []):
		if j.get("criando", false):
			if str(j.id) == meu_id and not _pronto: # conta nova: abre o criador (a base é a Ruiva)
				_pronto = true
				var nome := str(rede.conta.get("nome", "")).strip_edges().left(16)
				m.criador.abrir_criacao(nome, m.aparencia, func(n, a, corpo):
					rede.enviar("pronto", {"nome": n, "visual": corpo, "aparencia": a})
					m.trocar_corpo(corpo, false)
					m.definir_aparencia(a)
					m.hud.nome = n,
					func(a, corpo):
						_ap_mandar = a # os outros jogadores veem mudando na hora
						if corpo != _visual_mandado:
							_visual_mandado = corpo
							rede.enviar("visual", corpo), m.visual)
			continue
		jogadores += 1
		if str(j.id) == meu_id:
			meu(j)
		else:
			vistos[str(j.id)] = true
			outro(j)
	for id in outros.keys():
		if not vistos.has(id):
			outros[id].no.queue_free()
			outros.erase(id)
	var com_corpo := {}
	for e in f.get("inimigos", []):
		inimigo(e)
		com_corpo[int(e.get("v", -1))] = true
	# vaga vazia do campo de caça (o corpo já sumiu no servidor): aqui também some, até o servidor fazer nascer de novo
	for v in m.inimigos.size():
		var e: Dictionary = m.inimigos[v]
		if not com_corpo.has(v) and e.estado != "morto":
			e.estado = "morto"
			e.no.visible = false
			_barra_visivel(e, false)
	# veios das zonas de mineração (o minério é de todos): quem já foi batido e quanto falta para voltar
	m.trabalho.veios_comuns(f.get("veios", []))

func meu(j: Dictionary) -> void:
	var h: Dictionary = m.h
	var ap_txt := JSON.stringify(j.get("aparencia"))
	var vis := str(j.get("visual", ""))
	if vis != "" and vis != _visual_txt: # corpo gravado na conta (vale o do servidor)
		_visual_txt = vis
		m.trocar_corpo(vis)
	if ap_txt != _ap_txt: # aparência gravada na conta (vale a do servidor)
		_ap_txt = ap_txt
		if j.get("aparencia") is Dictionary:
			m.definir_aparencia(j.aparencia)
	h.mana = float(j.mana)
	if j.has("sta"):
		m.trabalho.do_servidor(float(j.sta))
	if j.morto:
		if h.morto <= 0.0:
			h.vida = 0.0
			h.morto = 999.0 # espera o servidor levantar
			m.acao = {}
			m.heroi_anim.play("morrer", 0.1)
			m.hud.aviso("Você caiu!")
	elif h.morto > 0.0:
		h.morto = 0.0
		m.mov.por_em(Vector3(float(j.x), float(j.y), float(j.z)))
		m.heroi.position = m.mov.posicao()
		m.heroi_anim.play("parada", 0.2)
	h.vida = float(j.vida)
	# Escudo Arcano (o que sobra dele vem do servidor)
	var esc := float(j.get("escudo", 0))
	if esc <= 0.0 and h.escudo > 0.0:
		m.fx.escudo_fim(m.heroi)
	h.escudo = esc
	h.escudo_ate = m.tempo + 1.0 if esc > 0.0 else 0.0
	# recargas: vale a maior (o servidor pode ter começado um pouco depois)
	var cds: Dictionary = j.get("cds", {})
	for k in cds:
		var v := float(cds[k])
		if k in ["basico", "magia"]:
			continue
		if v > m.recargas.get(k, 0.0) + 0.25:
			m.recargas[k] = v

func animacao(nome: String) -> String:
	return de_servidor.get(nome, nome)

func tocar(no_anim: AnimationPlayer, nome: String, vel := 1.0, fade := 0.15) -> void:
	var a := animacao(nome)
	if no_anim.has_animation(a) and no_anim.current_animation != a:
		no_anim.play(a, fade, vel)

func outro(j: Dictionary) -> void:
	var id := str(j.id)
	var o = outros.get(id)
	var vis: String = m.corpo_valido(j.get("visual", "ruiva")) # corpo que o jogador escolheu no criador
	if o != null and o.get("visual", "ruiva") != vis: # trocou de corpo: monta de novo
		o.no.queue_free()
		outros.erase(id)
		o = null
	if o == null:
		var no: Node3D = m.modelo(vis) # todo corpo do criador tem as animações do herói (exportar.js)
		var esq: Skeleton3D = m.esqueleto(no)
		var esp: Node3D = m.nova_arma("espada")
		var caj: Node3D = m.nova_arma("cajado")
		o = {"no": no, "visual": vis, "anim": no.find_child("AnimationPlayer", true, false), "esq": esq, "espada": esp, "cajado": caj,
			"alvo": Vector3(float(j.x), float(j.y), float(j.z)), "ry": float(j.ry), "seq": -1, "modo": "", "uma_vez": 0.0}
		no.position = o.alvo
		o.barra = m.barra_vida(no, str(j.get("nome", "")), Color(0.35, 0.85, 0.4))
		o.ap = ""
		outros[id] = o
	var antes: Vector3 = o.alvo
	var ap_txt := JSON.stringify(j.get("aparencia"))
	if ap_txt != o.ap: # cores, altura e rosto que o jogador escolheu no criador
		o.ap = ap_txt
		Aparencia.aplicar(o.no, Aparencia.valida(j.get("aparencia"), m.P.dados.criador))
	o.alvo = Vector3(float(j.x), float(j.y), float(j.z))
	o.ry = float(j.ry)
	# roupa que aparece no corpo (armadura.gd) e a capa abrindo com a velocidade (a foto vem 20 vezes por segundo)
	var roupa := str(j.get("roupa", ""))
	if j.get("semCapacete", false) == true: # o dono escondeu o capacete
		roupa = ",".join(PackedStringArray(Array(roupa.split(",", false)).filter(func(p): return not str(p).begins_with("chapeu"))))
	if roupa != o.get("roupa", "-"):
		o.roupa = roupa
		m.Armadura.vestir(o.no, m.Armadura.de_texto(roupa))
	if roupa.contains("capa"):
		m.Armadura.vento(o.no, Vector2(o.alvo.x - antes.x, o.alvo.z - antes.z).length() * 20.0, 0.05)
	_amostra(o, o.alvo, o.ry)
	corpos[id] = o.no
	if o.barra:
		o.barra.scale.x = max(0.001, float(j.vida) / max(1.0, float(j.vidaMax)))
	var modo := str(j.get("modo", "Espada"))
	if modo != o.modo:
		o.modo = modo
		var L: Dictionary = m.lugar_armas(o.visual)
		if modo == "Espada":
			m.prender(o.esq, o.espada, L.espadaMao)
			m.prender(o.esq, o.cajado, L.cajadoCostas)
		else:
			m.prender(o.esq, o.espada, L.espadaCostas)
			m.prender(o.esq, o.cajado, L.cajadoMao)
	animar(o, j)

# animação de quem vem do servidor: ação de uma vez (golpe, magia, apanhar) ou o laço do movimento
func animar(o: Dictionary, c: Dictionary) -> void:
	var an: AnimationPlayer = o.anim
	var acao = c.get("acao")
	if acao is Dictionary and int(c.get("acaoSeq", 0)) != o.seq:
		o.seq = int(c.get("acaoSeq", 0))
		var a := animacao(str(acao.get("nome", "")))
		if an.has_animation(a):
			var vel := float(acao.get("ts", 1.0))
			an.play(a, 0.08, vel)
			an.seek(0.0, true)
			o.uma_vez = an.get_animation(a).length / max(0.1, vel)
			o.prep_fim = -1.0
			if acao.has("preparo"): # golpe de monstro: começa devagar (preparo) e depois sai rápido (ts2)
				var pr := float(acao.preparo)
				var v2 := float(acao.get("ts2", 1.0))
				o.prep_fim = m.tempo + pr
				o.prep_v2 = v2
				o.uma_vez = pr + max(0.1, an.get_animation(a).length - pr * vel) / max(0.1, v2)
			return
	if acao is Dictionary and o.uma_vez > 0.0:
		return
	if c.get("morto", false):
		return
	o.uma_vez = 0.0
	var nome := str(c.get("anim", "Idle"))
	tocar(an, nome, m.ritmo(animacao(nome)) if o.has("esq") else 1.0) # outros jogadores: passo no ritmo da corrida

func inimigo(c: Dictionary) -> void:
	var v := int(c.get("v", -1))
	if v < 0 or v >= m.inimigos.size():
		return
	var e: Dictionary = m.inimigos[v]
	corpos[str(c.id)] = e.no
	e.alvo = Vector3(float(c.x), float(c.y), float(c.z))
	e.ry = float(c.ry)
	_amostra(e, e.alvo, e.ry)
	if float(c.vida) < float(e.get("vida", c.vida)):
		e.combate = m.tempo + 5.0 # levou dano: nome aparece por 5 s
	e.vida = float(c.vida)
	if e.barra:
		e.barra.scale.x = max(0.001, float(c.vida) / max(1.0, float(c.vidaMax)))
	if not e.has("seq"):
		e.seq = -1
		e.uma_vez = 0.0
	if c.morto and e.estado != "morto":
		e.estado = "morto"
		e.anim.play("morrer", 0.1)
		e.prep_fim = -1.0
		m.combate.morreu(e.no)
		m.sons.tocar("morte", -2.0, 0.1, e.no.position)
		_barra_visivel(e, false)
	elif not c.morto and e.estado == "morto":
		e.estado = "vivo"
		e.no.position = e.alvo
		e.buf = []
		_barra_visivel(e, true)
		e.anim.play("espada_parada", 0.2)
		m.combate.voltou(e.no)
	# atordoado / congelado (vem do servidor): estrelas ou gelo, e o congelado para a animação
	var ef := str(c.get("ef", "")) if c.get("ef") != null else ""
	if ef != e.get("ef", ""):
		e.ef = ef
		e.anim.speed_scale = 0.0 if ef == "congelado" else 1.0
		if ef == "congelado" or ef == "atordoado":
			m.fx.status(e.no, "congela" if ef == "congelado" else "atordoa", 3.0)
		else:
			m.fx.status_fim(e.no)
	if ef == "congelado" or ef == "atordoado":
		return
	if not c.morto:
		animar(e, c)

func _barra_visivel(e: Dictionary, v: bool) -> void:
	if e.barra:
		e.barra.visible = v
		e.barra.get_parent().get_child(e.barra.get_index() - 1).visible = v

func cor(n) -> Color:
	return Color.hex((int(n) << 8) | 0xff) if n != null else Color(1, 1, 1)

func evento(ev: Dictionary) -> void:
	var t := str(ev.get("t", ""))
	var meu := str(ev.get("de", "")) == meu_id
	var fx = m.fx
	match t:
		"prog": # nível, XP, atributos e skills da conta (o menu do personagem mostra)
			m.P.do_servidor(ev)
			return
		"nivel":
			var no = corpos.get(str(ev.id))
			if no:
				fx.subir_nivel(no)
			return
		"escudo":
			var no = corpos.get(str(ev.id))
			if no:
				if float(ev.n) > 0.0:
					if not meu:
						fx.escudo(no, float(ev.dur))
				else:
					fx.escudo_fim(no)
			return
		"dano":
			var quem = corpos.get(str(ev.get("de", ""))) # monstro que bateu: em combate por 5 s
			if quem:
				for e in m.inimigos:
					if e.no == quem:
						e.combate = m.tempo + 5.0
			var no = corpos.get(str(ev.alvo))
			if no:
				var eu: bool = str(ev.alvo) == meu_id
				if eu or meu:
					m.trabalho.combate()
				var crit: bool = ev.get("crit", false) == true
				fx.numero(no.position, ev.n, Color(1, 0.45, 0.4) if eu else Color(1, 0.72, 0.25) if crit else Color(1, 0.95, 0.6), crit)
				if eu:
					m.apanhou()
				if eu and m.acao.is_empty() and m.mov.esc == null:
					m.heroi_anim.play("apanhar", 0.05, 1.4)
				if not eu and float(ev.n) > 0.0 and not m.combate.reagiu_agora(no): # golpe de outro jogador (o meu já reagiu na hora)
					var quem_bateu = corpos.get(str(ev.get("de", "")))
					m.combate.reacao(no, quem_bateu.position if quem_bateu else m.heroi.position, false)
				if meu and not eu and float(ev.n) > 0.0:
					m.piscar(no)
					# o golpe de espada já deu o tranco na hora; skills e tiros dão aqui, quando o servidor confirma
					if m.tempo - m._impacto_t > 0.2:
						m.impacto_golpe(no.position, true, crit, false)
			return
		"cura":
			if str(ev.alvo) != meu_id and corpos.has(str(ev.alvo)):
				fx.cura(corpos[str(ev.alvo)])
				fx.numero(corpos[str(ev.alvo)].position, ev.n, Color("7dffa0"))
			return
		"aviso":
			m.hud.aviso(str(ev.texto))
			return
		# profissões (Parte 3): batida de coleta, o que saiu, fim da coleta e peça criada
		"coleta":
			if str(ev.id) == meu_id:
				m.trabalho.comecou(str(ev.no), float(ev.dur), str(ev.get("prof", "min")))
			return
		"coletou":
			m.trabalho.coletou(ev)
			return
		"coletaFim":
			if str(ev.id) == meu_id:
				m.trabalho.parar(false)
			return
		"criou":
			m.trabalho.criou(ev)
			return
		"profNivel":
			m.sons.tocar("nivel", -6.0)
			return
		"fala":
			if not (m.conversa and m.conversa.fala(str(ev.get("npc", "")), str(ev.texto))): # janela do NPC aberta: a fala aparece nela
				m.hud.aviso(str(ev.texto))
			if str(ev.get("abrir", "")) == "resetar":
				m.menu.perguntar_reset(int(ev.get("custo", 0)))
			return
		"veio": # alguém bateu num veio de zona de mineração: a pedra some para todo mundo quando esgota
			m.trabalho.veio_comum(str(ev.no), int(ev.cargas), float(ev.volta))
			return
		"drop": # ouro e itens do monstro que eu ajudei a derrubar (já estão na mochila)
			var x := float(ev.x)
			var z := float(ev.z)
			m.mostrar_drop(Vector3(x, m.terreno.altura(x, z), z), int(ev.get("ouro", 0)), ev.get("itens", []))
			return
		"corrigir": # o servidor não aceitou a posição: volta para onde ele sabe
			m.mov.por_em(Vector3(float(ev.x), float(ev.y), float(ev.z)))
			m.mov.ry = float(ev.ry)
			m.heroi.position = m.mov.posicao()
			return
	if meu: # o que eu fiz já apareceu na hora, aqui no celular
		return
	match t:
		"proj":
			var info := {"vel": float(ev.vel), "cor": cor(ev.get("cor")), "tam": float(ev.get("tam", 0.24)), "estilo": str(ev.get("estilo", "arcano"))}
			if ev.get("explosao"):
				info.explosao = float(ev.explosao)
			fx.projetil(Vector3(float(ev.x), float(ev.y), float(ev.z)), Vector3(float(ev.dx), float(ev.dy), float(ev.dz)).normalized(), info, 0, 22.0)
		"raio":
			fx.raio(float(ev.x), float(ev.z), m.terreno.altura(float(ev.x), float(ev.z)))
		"explosao":
			var x := float(ev.x)
			var z := float(ev.z)
			var k := str(ev.get("fx", "explosao"))
			fx.explosao_hab(m.P.FX.get(k, k), x, z, float(ev.r), m.terreno.altura(x, z))
		"chuva":
			fx.chuva(float(ev.x), float(ev.z), float(ev.r), int(ev.ondas), func(_p): pass)
		"meteoro":
			var x := float(ev.x)
			var z := float(ev.z)
			fx.meteoro(x, z, float(ev.r), float(ev.queda), m.terreno.altura(x, z), func(_p): pass)
		"cadeia":
			var x := float(ev.x)
			var z := float(ev.z)
			fx.cadeia(Vector3(float(ev.x0), float(ev.y0), float(ev.z0)), Vector3(x, m.terreno.altura(x, z) + 1.0, z))
		"teleporte":
			var x0 := float(ev.x0)
			var z0 := float(ev.z0)
			var x := float(ev.x)
			var z := float(ev.z)
			fx.teleporte(Vector3(x0, m.terreno.altura(x0, z0), z0), Vector3(x, m.terreno.altura(x, z), z))
			var no = corpos.get(str(ev.id))
			if no and no != m.heroi and outros.has(str(ev.id)): # aparece direto lá (sem deslizar)
				outros[str(ev.id)].alvo = Vector3(x, m.terreno.altura(x, z), z)
				outros[str(ev.id)].buf = []
				no.position = outros[str(ev.id)].alvo
		"preparo": # o monstro vai bater: brilho vermelho crescendo
			var no = corpos.get(str(ev.id))
			if no:
				m.combate.preparo(no, float(ev.dur))
			return
		"firme": # o monstro aguentou muitos golpes: fica firme e revida
			var no = corpos.get(str(ev.id))
			if no:
				m.combate.firme(no, float(ev.dur))
			return
		"esquiva": # rolou ou deu dash na hora do golpe: o próximo golpe vale mais
			if str(ev.id) == meu_id:
				m.combate.esquiva(m.heroi)
			return
		"impacto":
			var x := float(ev.x)
			var z := float(ev.z)
			var k := str(ev.get("fx", "investida"))
			fx.impacto(x, z, float(ev.ry), m.P.FX.get(k, k), m.terreno.altura(x, z))
		"vortice":
			var x := float(ev.x)
			var z := float(ev.z)
			fx.vortice(x, z, float(ev.r), m.terreno.altura(x, z))
		"anel":
			var x := float(ev.x)
			var z := float(ev.z)
			fx.anel(x, z, float(ev.r), cor(ev.get("cor")), float(ev.get("dur", 0.8)), m.terreno.altura(x, z))
		"conjura":
			var no = corpos.get(str(ev.id))
			if no and no != m.heroi:
				fx.conjura(no, m.P.FX.get(str(ev.hab), str(ev.hab)), float(ev.dur), func(): return [no.position + Vector3(0, 1.2, 0)])
		"dash":
			var no = corpos.get(str(ev.id))
			if no and no != m.heroi:
				fx.dash(no, float(ev.get("dur", 0.28)), ev.get("forte", 0) == 1)

# ---------- interpolação de quem vem do servidor ----------
const ATRASO := 0.1 # s atrás do servidor: sempre tem duas fotos para andar entre elas

func _agora() -> float:
	return Time.get_ticks_usec() / 1000000.0

func _amostra(o: Dictionary, p: Vector3, ry: float) -> void:
	if not o.has("buf"):
		o.buf = []
	o.buf.append([_agora(), p, ry])
	while o.buf.size() > 8:
		o.buf.pop_front()

func _interpolar(o: Dictionary, no: Node3D, dt: float) -> void:
	var buf: Array = o.get("buf", [])
	var t := _agora() - ATRASO
	if buf.size() < 2 or t >= buf[buf.size() - 1][0] or t < buf[0][0]:
		# sem duas fotos em volta (começo, ou o servidor atrasou): desliza até a última
		var k: float = min(1.0, dt * 10.0)
		no.position = no.position.lerp(o.alvo, k)
		no.rotation.y = lerp_angle(no.rotation.y, o.get("ry", no.rotation.y), k)
		return
	var i := buf.size() - 2
	while i > 0 and buf[i][0] > t:
		i -= 1
	var a: Array = buf[i]
	var b: Array = buf[i + 1]
	var u: float = clamp((t - a[0]) / max(0.001, b[0] - a[0]), 0.0, 1.0)
	var p: Vector3 = (a[1] as Vector3).lerp(b[1], u)
	if p.distance_to(no.position) > 6.0: # teleporte ou renascer: vai direto
		no.position = p
	else:
		no.position = no.position.lerp(p, min(1.0, dt * 25.0))
	no.rotation.y = lerp_angle(no.rotation.y, lerp_angle(a[2], b[2], u), min(1.0, dt * 15.0))

# ---------- quadro a quadro ----------
var ms := 0.0 # tempo gasto aqui por quadro (média), aparece no Teste
func _process(dt: float) -> void:
	var t0 := Time.get_ticks_usec()
	_passo(dt)
	ms = lerp(ms, (Time.get_ticks_usec() - t0) / 1000.0, 0.05)

func _passo(dt: float) -> void:
	if _tentar_de_novo > 0.0:
		_tentar_de_novo -= dt
		if _tentar_de_novo <= 0.0 and not ligado and rede.sessao != "":
			rede.iniciar()
	if not ligado:
		return
	_ap_t -= dt
	if _ap_mandar != null and _ap_t <= 0.0:
		rede.enviar("aparencia", _ap_mandar)
		_ap_mandar = null
		_ap_t = 0.25
	# outros jogadores e inimigos: o servidor manda a posição 20 vezes por segundo; aqui eles andam entre as duas
	# últimas fotos com 0,1 s de atraso (velocidade constante, sem os tranquinhos de antes)
	for id in outros:
		var o: Dictionary = outros[id]
		_interpolar(o, o.no, dt)
		o.uma_vez = max(0.0, o.uma_vez - dt)
	for e in m.inimigos:
		if e.has("alvo"): # morto também: o golpe final joga o corpo para trás (o servidor manda onde ele cai)
			_interpolar(e, e.no, dt)
			e.uma_vez = max(0.0, e.get("uma_vez", 0.0) - dt)
			if e.get("prep_fim", -1.0) > 0.0 and m.tempo >= e.prep_fim: # fim do preparo: o golpe sai rápido
				e.prep_fim = -1.0
				var pos_a: float = e.anim.current_animation_position
				e.anim.play(e.anim.current_animation, 0.0, e.prep_v2)
				e.anim.seek(pos_a, true)
	# minha posição (o servidor confere velocidade e altura)
	_pos_t -= dt
	if _pos_t <= 0.0 and m.h.morto <= 0.0:
		_pos_t = 0.05
		var p: Vector3 = m.heroi.position
		var a: String = para_servidor.get(m.heroi_anim.current_animation, {"freada": "Walk", "meia_volta": "Run"}.get(m.heroi_anim.current_animation, "Idle"))
		# e: 1 = este app conhece a estamina (o servidor só deixa correr com fôlego)
		rede.enviar("pos", {"x": snappedf(p.x, 0.001), "y": snappedf(p.y, 0.001), "z": snappedf(p.z, 0.001), "ry": snappedf(m.mov.ry, 0.001), "anim": a, "e": 1})
	# para onde o joystick aponta (o servidor usa no rolamento e no dash)
	_ent_t -= dt
	if _ent_t <= 0.0:
		_ent_t = 0.1
		var d: Vector3 = m.direcao_joystick()
		var ent := {"mx": snappedf(d.x, 0.01), "mz": snappedf(d.z, 0.01), "correr": m.hud.mover.length() >= 0.55}
		if ent != _ultima_entrada:
			_ultima_entrada = ent
			rede.enviar("entrada", ent)
	_status_t -= dt
	if _status_t <= 0.0:
		_status_t = 0.5
		atualizar_status()

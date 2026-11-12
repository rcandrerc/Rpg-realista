extends Node
# Modo online: o herói anda no celular e o servidor confere (igual ao site depois do PR #42).
# Vão para o servidor: posição 20x por segundo, botões (golpe, habilidades, pulo, dash, rolar, troca).
# Vêm do servidor: vida e mana, inimigos (posição, animação, vida), outros jogadores e o dano de verdade.
# Golpes e magias aparecem na hora no celular (animação e efeitos); quem acerta e quanto tira é o servidor que diz.

const Rede = preload("res://rede.gd")
const D = preload("res://dados.gd")
const Aparencia = preload("res://aparencia.gd")
const Montaria = preload("res://montaria.gd")

var m # main.gd
var rede
var ligado := false # dentro da sala
var meu_id := ""
var amiga_id := "" # a Cecília (shared/amiga.js): o servidor só manda para o dono dela, que pode conversar
var amiga_ids: Array = [] # todos os amigos virtuais com quem posso conversar: Cecília e Dario (André 2026-11-11)
var amiga_papeis := {} # id -> "a guerreira" / "o guerreiro" (o título na janela de conversa)
var outros := {} # id -> {no, anim, alvo, ry, seq, barra, modo, uma_vez}
var corpos := {} # id do servidor -> Node3D (para números de dano e efeitos)
var de_servidor := {} # nome da animação no servidor -> nome no Godot
var para_servidor := {} # o contrário
var _pos_t := 0.0
# André 2026-11-12 (rollback): número do último "corrigir" aplicado. Vai em cada posição; o servidor ignora as que saíram
# antes da correção mais nova (sem cascata) e aqui só vale correção mais nova que esta
var corr_seq := 0
const DESLIZA_MAX := 3.0 # m: correção menor que isso desliza na tela em vez de pular (main.gd desliza)
var _ent_t := 0.0
var _ultima_entrada := {}
var _tentar_de_novo := -1.0
# André (2026-11-07): caiu a conexão no meio do jogo, o jogo segue por até QUEDA_MAX s tentando voltar (e volta para o
# que o servidor guardou). Passou disso: "Você foi desconectado" e o jogo volta para a tela inicial (entrar de novo).
# André 2026-11-12: ligação no celular derruba a internet móvel por 8 a 20 s e os 5 s de antes jogavam ele na tela inicial
const QUEDA_MAX := 30.0
const QUEDA_REINICIO := 60.0 # o servidor avisou que ia reiniciar (reinicio.gd): espera ele ligar de novo (~15 s na Oracle)
var _queda_t := -1.0
static var _foi_desconectado := false # sobrevive ao recarregar a cena: a tela inicial mostra o aviso
static var _conta_antes := {} # nome da conta para o botão "Entrar como…" mesmo com o servidor fora
var _build_ok := false
var _pronto := false
var _nome_recusado := "" # nome que o servidor recusou no criador (já é de outra conta)
var _erro_nome := ""
var _ap_mandar = null # aparência do criador esperando para ir ao servidor (no máximo 4 por segundo)
var _ap_t := 0.0
var _ap_txt := "" # última aparência do meu herói que veio do servidor
var _visual_txt := "" # último corpo do meu herói que veio do servidor
var _visual_mandado := "" # corpo do criador que já foi para o servidor (conta nova, ao vivo)
var _status_t := 0.0
var _lugar_pendente := false # entrou agora: a primeira foto traz o herói para onde a conta guardou (onde ele saiu)
var jogadores := 0
# Área de interesse (server/visao.js): o servidor manda só o que está perto, e de cada corpo só o que mudou.
var _srv := {} # id -> tudo o que já chegou daquele corpo (a foto nova completa o que faltou)
var no_mapa: Array = [] # [[id, x, z], ...] de todos os jogadores da sala (a cada 0,5 s): mapa e minimapa
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
var carregando: Label # "Conectando…" em cima da capa enquanto ainda não dá para mostrar o jogo
# André (2026-11-03): ao abrir, o jogo não pode aparecer antes da tela de login / troca de conta / criador.
# A capa já abre cobrindo tudo e só sai quando o jogador escolhe (login, jogar sozinho) ou quando a primeira foto
# do servidor chega (aí o criador da conta nova já abriu por cima).
var _cobrindo := false # capa na tela sem o painel: esperando o servidor
var _cobrir_t := 0.0 # segurança: sem resposta em alguns segundos, libera o jogo
const COBRIR_MAX := 12.0

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
		if _cobrindo and t != "":
			carregando.text = t
		atualizar_status(t))
	rede.precisa_login.connect(mostrar_login)
	rede.escolher_conta.connect(mostrar_escolha)
	rede.entrou.connect(ao_entrar)
	rede.mensagem.connect(ao_receber)
	rede.caiu.connect(ao_cair)
	montar_tela()
	cobrir("Conectando…")
	if _foi_desconectado and not _conta_antes.is_empty():
		rede.conta = _conta_antes.duplicate()
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
	carregando = Label.new()
	carregando.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	carregando.add_theme_font_size_override("font_size", 20)
	carregando.add_theme_color_override("font_color", Color(1, 0.95, 0.85))
	carregando.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	carregando.add_theme_constant_override("outline_size", 5)
	carregando.anchor_left = 0.56
	carregando.anchor_right = 1.0
	carregando.anchor_top = 0.82
	carregando.anchor_bottom = 0.92
	carregando.visible = false
	tela.add_child(carregando)
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
		cobrir("Entrando…") # o jogo só aparece quando o servidor mandar o mundo (ou o criador abrir)
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
	_cobrindo = false
	carregando.visible = false
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
	_cobrindo = false
	carregando.visible = false
	titulo.text = "Bem-vindo de volta"
	sub.text = "Conta salva: %s\nQuer entrar com ela ou usar outra conta Google?" % str(conta.get("nome", "sem nome"))
	if _foi_desconectado:
		titulo.text = "Você foi desconectado"
		sub.text = "A conexão com o servidor caiu.\nEntre de novo para continuar de onde o servidor salvou."
	b_continuar.text = "Entrar como %s" % str(conta.get("nome", "esta conta"))
	b_continuar.visible = true
	b_trocar.visible = true
	b_google.visible = false
	painel.visible = true
	capa.visible = true
	status.visible = false # o aviso do topo ficaria em cima do cabelo e do círculo da arte
	m.hud.set_process_input(false)
	atualizar_status("")

# só a capa, sem o painel: o jogo ainda não aparece (abrindo o app, entrando na sala)
func cobrir(texto: String) -> void:
	_cobrindo = true
	_cobrir_t = COBRIR_MAX
	painel.visible = false
	capa.visible = true
	carregando.text = texto
	carregando.visible = true
	status.visible = false
	m.hud.set_process_input(false)

func esconder_login() -> void:
	_cobrindo = false
	carregando.visible = false
	painel.visible = false
	capa.visible = false
	status.visible = true
	m.hud.set_process_input(true)

func atualizar_status(_t := "") -> void:
	if ligado:
		# André 2026-11-03: o ping do servidor sempre na tela, com a palavra "Ping" e cor (verde bom, amarelo médio,
		# vermelho ruim) para saber na hora se o tranco é da internet/servidor ou do celular
		var p := " · Ping …" if rede.ping_ms < 0 else " · Ping %d ms" % rede.ping_ms
		var txt := "Online · %d %s%s" % [jogadores, "jogador" if jogadores == 1 else "jogadores", p]
		# André 2026-11-12: de quem é a culpa. Nada chega do servidor há 1,5 s: a internet travou (o servidor responde em
		# ms; o ping velho ficava na tela até o pong atrasado chegar com 20000). Servidor com passo lento: "Servidor lento"
		var calado: float = (Time.get_ticks_msec() - rede.ult_pacote_ms) / 1000.0 if rede.ult_pacote_ms > 0 else 0.0
		var aviso := ""
		if calado >= 1.5:
			aviso = "Internet travada · %d s sem resposta" % int(calado)
		elif rede.servidor_pico > 150.0:
			aviso = "Servidor lento%s" % p
		if aviso != "":
			txt = aviso
		if status.text != txt: # trocar o texto refaz o layout: só quando muda
			status.text = txt
			var cor := Color(1, 0.95, 0.85)
			if aviso != "":
				cor = Color(1.0, 0.5, 0.45) if calado >= 1.5 else Color(1.0, 0.7, 0.35)
			elif rede.ping_ms >= 0:
				cor = Color(0.6, 1.0, 0.6) if rede.ping_ms < 100 else (Color(1.0, 0.9, 0.4) if rede.ping_ms < 200 else Color(1.0, 0.5, 0.45))
			status.add_theme_color_override("font_color", cor)
	elif _t != "" and _t != "Online":
		status.add_theme_color_override("font_color", Color(1, 0.95, 0.85))
		status.text = _t
	else:
		status.add_theme_color_override("font_color", Color(1, 0.95, 0.85))
		status.text = "Sozinho · tocar para jogar online"

# ---------- sala ----------
func ao_entrar(id: String, conta: Dictionary) -> void:
	ligado = true
	_desvio_srv = INF # sala nova ou servidor reiniciado: o relógio do servidor recomeça
	if id != meu_id:
		corr_seq = 0 # herói novo no servidor (entrou de novo): a conta das correções recomeça lá também
	meu_id = id
	_queda_t = -1.0
	_foi_desconectado = false
	if m.reinicio:
		m.reinicio.voltou() # servidor de volta: some a faixa do reinício
	_conta_antes = conta.duplicate()
	_build_ok = false
	# entrou agora (vindo da capa): o herói vai para onde a conta guardou. Reconexão (já jogando): fica onde está, o caminho
	# andado sem internet vale (o servidor confere: Simulacao.folgaDaQueda; André 2026-11-12)
	_lugar_pendente = capa.visible
	m.volta.cancelar("") # a volta para a vila começada sem internet não vale aqui
	if capa.visible: # vindo da capa ou da tela de login: a capa sai quando a primeira foto do mundo chegar (aplicar_foto)
		cobrir("Entrando…")
	else: # já estava jogando (reconexão): nada de capa
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
	if _cobrindo:
		if rede.sessao != "": # tem conta (André 2026-11-07): sem servidor não entra no jogo, fica na tela inicial
			_tentar_de_novo = -1.0
			_voltar_a_tela_inicial()
			return
		esconder_login() # sem conta: joga sozinho em vez de ficar parado na capa
	ligado = false
	if m.troca:
		m.troca.fechar() # caiu a conexão: o servidor desfaz a troca
	if m.amigos:
		m.amigos.desligou() # o servidor desfaz o time
	if m.chat:
		m.chat.desligou()
	for id in outros:
		outros[id].no.queue_free()
	outros.clear()
	for e in m.inimigos: # inimigos voltam para a cabeça do celular
		if e.estado != "morto":
			e.estado = "vagar"
	if estava and m.reinicio and m.reinicio.esperado(): # reinício avisado: a faixa já diz "Voltando…"
		_tentar_de_novo = 1.0
		_queda_t = QUEDA_REINICIO
	elif estava:
		m.hud.aviso("Caiu a conexão. Tentando voltar…")
		_tentar_de_novo = 1.0
		_queda_t = QUEDA_MAX
	elif _queda_t > 0.0: # ainda dentro dos QUEDA_MAX s: tenta de novo logo
		_tentar_de_novo = 1.0
	elif motivo == "fora" or motivo == "sala" or motivo.begins_with("fechou"):
		_tentar_de_novo = 15.0 if rede.sessao != "" else -1.0
	atualizar_status("Sem conexão" if rede.sessao != "" else "")

# o jogador escolheu sair da sala (menu do topo: Jogar sozinho, Trocar ou Sair da conta): limpa sem tentar voltar
func desligar() -> void:
	_tentar_de_novo = -1.0
	_queda_t = -1.0
	if ligado:
		ligado = false
		if m.troca:
			m.troca.fechar() # saiu da sala: o servidor desfaz a troca
		if m.amigos:
			m.amigos.desligou()
		for id in outros:
			outros[id].no.queue_free()
		outros.clear()
		for e in m.inimigos: # inimigos voltam para a cabeça do celular
			if e.estado != "morto":
				e.estado = "vagar"
	atualizar_status("")

# passou dos QUEDA_MAX s sem conexão: avisa e mostra a tela inicial (nada do que foi feito sem servidor fica: ao entrar de novo
# o servidor manda o progresso e o lugar dele). Sem recarregar a cena: o recarregar sem internet fechava o app (André 2026-11-07).
func _desconectado() -> void:
	_foi_desconectado = true
	if m.reinicio:
		m.reinicio.voltou() # não voltou a tempo: a tela inicial assume
	desligar()
	rede.fechar()
	_voltar_a_tela_inicial()
	aviso_login.text = "Sem conexão com o servidor."

# Apagou o personagem ou saiu da conta (menu do topo): volta para a tela de login sem recarregar a cena.
# André 2026-11-11: recarregar a cena (reload_current_scene) fechava o app no celular ao apagar o personagem, e só
# dava para criar outro reabrindo o jogo (o mesmo tranco da queda de conexão, #262). Agora limpa o que era da conta
# antiga e mostra "Entrar com Google"; entrando, a conta nova abre o criador normalmente.
func voltar_ao_login(texto := "") -> void:
	desligar()
	rede.fechar()
	meu_id = ""
	_pronto = false # conta nova: a primeira foto (ainda criando) abre o criador de novo
	_nome_recusado = ""
	_erro_nome = ""
	_ap_mandar = null
	_ap_txt = ""
	_visual_txt = ""
	_visual_mandado = ""
	_build_ok = false
	_lugar_pendente = false
	_srv.clear()
	corpos.clear()
	no_mapa = []
	amiga_id = ""
	amiga_ids.clear()
	amiga_papeis.clear()
	_foi_desconectado = false
	_conta_antes = {}
	if m.criador and m.criador.aberto():
		m.criador.fechar()
	mostrar_login()
	aviso_login.text = texto

# tela inicial com a conta salva (Entrar como… / Trocar de conta / Jogar sozinho) e o motivo embaixo
func _voltar_a_tela_inicial() -> void:
	var conta: Dictionary = rede.conta if rede.conta is Dictionary and not rede.conta.is_empty() else _conta_antes
	mostrar_escolha(conta)
	if aviso_login.text == "" or aviso_login.text.ends_with("…"):
		aviso_login.text = "O servidor não respondeu. Tente de novo."

func enviar(tipo: String, dados = null) -> void:
	if ligado:
		rede.enviar(tipo, dados)

func ao_receber(tipo, dados) -> void:
	if str(tipo) == "mundo_meio" and dados is Dictionary: # foto atrasada que chegou junto com outras (rede.gd): a mais nova vem depois
		if dados.has("foto"):
			_foto_meio(dados.foto)
		for ev in dados.get("eventos", []):
			evento(ev)
		return
	if str(tipo) != "mundo" or not (dados is Dictionary):
		return
	if dados.has("foto"):
		aplicar_foto(dados.foto)
	for ev in dados.get("eventos", []):
		evento(ev)

# corpo que veio pela metade (área de interesse): junta com o que já se sabia dele. "_mexeu" = trouxe posição nova
func _juntar(c: Dictionary, agora: Dictionary) -> Dictionary:
	var id := str(c.get("id", ""))
	var tudo: Dictionary = _srv.get(id, {})
	tudo.merge(c, true)
	tudo["_mexeu"] = c.has("x") or tudo.get("_mexeu_meio", false) # andou numa foto do meio: a posição dela vale
	tudo.erase("_mexeu_meio")
	_srv[id] = tudo
	agora[id] = true
	return tudo

# foto do meio (várias chegaram juntas depois de um engasgo): só completa o que se sabe de cada corpo, porque a área de
# interesse manda cada mudança uma vez só; a foto mais nova, que vem em seguida, é que mexe na tela
func _foto_meio(f: Dictionary) -> void:
	if not f.has("aoi"): # foto inteira (sem área de interesse): a mais nova já traz tudo
		return
	if f.has("mapa"):
		no_mapa = f.mapa
	for lista in [f.get("jogadores", []), f.get("inimigos", [])]:
		for c in lista:
			var id := str(c.get("id", ""))
			if id == meu_id or id == "":
				continue
			var tudo: Dictionary = _srv.get(id, {})
			tudo.merge(c, true)
			if c.has("x"):
				tudo["_mexeu_meio"] = true
			_srv[id] = tudo

func aplicar_foto(f: Dictionary) -> void:
	_medir_chegada()
	_marcar_tempo(f)
	corpos.clear()
	corpos[meu_id] = m.heroi
	var vistos := {}
	jogadores = 0
	var aoi := f.has("aoi")
	var agora := {} # ids que vieram nesta foto (área de interesse)
	if f.has("mapa"):
		no_mapa = f.mapa
	for j0 in f.get("jogadores", []):
		var j: Dictionary = _juntar(j0, agora) if aoi and str(j0.get("id", "")) != meu_id else j0
		if j.get("criando", false):
			if str(j.id) == meu_id and not _pronto: # conta nova: abre o criador (a base é a Ruiva)
				_pronto = true
				# André 2026-11-10: o jogador escolhe o nome (antes vinha o nome da conta Google); se o servidor
				# recusou (nome de outra conta), volta com o nome recusado e o aviso
				var nome := _nome_recusado
				m.criador.abrir_criacao(nome, m.aparencia, func(n, a, corpo):
					rede.enviar("pronto", {"nome": n, "visual": corpo, "aparencia": a})
					var hn = m.P.prog.get("hist")
					if m.cinematica and (not (hn is Dictionary) or (int(hn.get("p", 0)) == 0 and not hn.get("ac", false))): # herói novo: a abertura vem já
						m.cinematica.escurecer()
					m.trocar_corpo(corpo, false)
					m.definir_aparencia(a)
					m.hud.nome = n,
					func(a, corpo):
						_ap_mandar = a # os outros jogadores veem mudando na hora
						if corpo != _visual_mandado:
							_visual_mandado = corpo
							rede.enviar("visual", corpo), m.visual)
				if _erro_nome != "":
					m.criador.erro.text = _erro_nome
					_erro_nome = ""
			continue
		jogadores += 1
		if str(j.id) == meu_id:
			meu(j)
		else:
			vistos[str(j.id)] = true
			outro(j)
	if aoi: # quem está na sala inteira (a foto só traz os de perto)
		jogadores = int(f.get("total", jogadores))
	for id in outros.keys():
		if not vistos.has(id):
			_soltar_corpo(outros[id])
			outros.erase(id)
	var com_corpo := {}
	for e0 in f.get("inimigos", []):
		var e: Dictionary = _juntar(e0, agora) if aoi else e0
		inimigo(e)
		com_corpo[int(e.get("v", -1))] = true
	if aoi: # quem saiu de perto (ou sumiu do servidor): esquece; se voltar, o servidor manda inteiro de novo
		for id in _srv.keys():
			if not agora.has(id):
				_srv.erase(id)
	# vaga vazia do campo de caça (o corpo já sumiu no servidor): aqui também some, até o servidor fazer nascer de novo
	for v in m.inimigos.size():
		var e: Dictionary = m.inimigos[v]
		if not com_corpo.has(v) and e.estado != "morto":
			e.estado = "morto"
			e.no.visible = false
			_barra_visivel(e, false)
	# veios das zonas de mineração (o minério é de todos): quem já foi batido e quanto falta para voltar
	m.trabalho.veios_comuns(f.get("veios", []))
	if m.pesca: # spots de pesca na água (pesca.gd): bolhas de perto, no mapa com o Radar
		m.pesca.atualizar_spots(f.get("spots", []))
	if m.transporte and f.has("carga"): # FASE 1: packs no chão, carrinhos, barquinhos e navios
		m.transporte.atualizar(f.carga)
	if _cobrindo: # primeira foto depois de entrar: o mundo (ou o criador da conta nova) já está pronto
		esconder_login()

var _montado_dif := 0.0 # segundos (contados pelas fotos) com o app e o servidor discordando da montaria
func meu(j: Dictionary) -> void:
	var h: Dictionary = m.h
	if j.has("caverna"): # Caverna da Montanha: o selo deixa passar quem usou o passe (o servidor é quem sabe)
		m.mov.selo_aberto = j.caverna == true
	var ap_txt := JSON.stringify(j.get("aparencia"))
	var vis := str(j.get("visual", ""))
	if vis != "" and vis != _visual_txt: # corpo gravado na conta (vale o do servidor)
		_visual_txt = vis
		m.trocar_corpo(vis)
	if ap_txt != _ap_txt: # aparência gravada na conta (vale a do servidor)
		_ap_txt = ap_txt
		if j.get("aparencia") is Dictionary:
			m.definir_aparencia(j.aparencia)
	if _lugar_pendente and not j.get("criando", false) and not j.morto:
		_lugar_pendente = false
		m.volta.colocar(Vector3(float(j.x), float(j.y), float(j.z)), float(j.ry))
	# montaria: o servidor decide (se ele desceu o herói, ou não deixou subir, o app segue depois de um instante)
	var sm: bool = j.get("montado") != null
	if sm != (m.montaria != null) and h.morto <= 0.0:
		_montado_dif += 0.05
		if _montado_dif > 0.8:
			m.montar_lobo(sm, false)
			if not sm and m.rota and m.rota.ativo: # o servidor não deixou montar: o "Ir para" segue a pé (nada de chamar e soltar o lobo sem parar)
				m.rota.a_pe = true
	else:
		_montado_dif = 0.0
	h.mana = float(j.mana)
	if j.has("sta"):
		m.trabalho.do_servidor(float(j.sta))
	if j.morto:
		m.volta.cancelar("")
		if h.morto <= 0.0:
			h.vida = 0.0
			h.morto = 999.0 # espera o servidor levantar
			m.acao = {}
			m.montar_lobo(false, false) # o servidor também desce
			m.heroi_anim.play("morrer", 0.1)
	elif h.morto > 0.0:
		h.morto = 0.0
		m.mov.por_em(Vector3(float(j.x), float(j.y), float(j.z)))
		m.heroi.position = m.mov.posicao()
		m.cam.colocar(m.heroi.position) # pode ter renascido longe (totem de teleporte, cama)
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
		# NPC que já passou por aqui (André 2026-11-11, os 20 aventureiros): reaproveita o corpo guardado em vez de montar
		# um VRoid novo (montar dava um tranco de quase 1 s no celular toda vez que um NPC entrava na visão)
		var g = _tirar_guardado(vis) if j.has("bot") else null
		if g != null:
			o = {"no": g.no, "visual": vis, "anim": g.anim, "esq": g.esq, "espada": g.espada, "cajado": g.cajado,
				"alvo": Vector3(float(j.x), float(j.y), float(j.z)), "ry": float(j.ry), "seq": -1, "modo": "", "uma_vez": 0.0,
				"barra": g.barra, "placa": g.placa, "placa_txt": "", "lod": -1, "sumiu": false, "molas": g.get("molas", []), "fase": g.get("fase", 0),
				# o corpo guardado já está com a cor e a roupa de antes: só pinta e veste de novo se mudou (André 2026-11-11:
				# "passa alguma coisa, vai pra 22": pintar de novo o corpo e o penteado custava ~120 ms a cada NPC que voltava)
				"ap": g.get("ap", ""), "roupa": g.get("roupa", "-")}
			g.no.position = o.alvo
			g.no.visible = true
			g.no.process_mode = Node.PROCESS_MODE_INHERIT
			outros[id] = o
			_detalhe_t = 0.0 # acerta o detalhe dele já no próximo quadro
		else:
			var no: Node3D = m.modelo(vis) # todo corpo do criador tem as animações do herói (exportar.js)
			no.set_meta("pano_outro", true) # capa de outro: pano de verdade só nas mais perto da câmera (pano_capa.gd)
			var esq: Skeleton3D = m.esqueleto(no)
			var esp: Node3D = m.nova_arma("espada")
			var caj: Node3D = m.nova_arma("cajado")
			o = {"no": no, "visual": vis, "anim": no.find_child("AnimationPlayer", true, false), "esq": esq, "espada": esp, "cajado": caj,
				"alvo": Vector3(float(j.x), float(j.y), float(j.z)), "ry": float(j.ry), "seq": -1, "modo": "", "uma_vez": 0.0}
			no.position = o.alvo
			o.barra = m.barra_vida(no, str(j.get("nome", "")), Color(0.35, 0.85, 0.4))
			o.placa = null
			for f in no.get_children(): # o nome em cima da cabeça (barra_vida põe o Label3D primeiro)
				if f is Label3D:
					o.placa = f
					break
			o.placa_txt = ""
			o.ap = ""
			o.lod = -1
			o.molas = _molas_de(esq)
			o.fase = randi() % 6
			outros[id] = o
	var antes: Vector3 = o.alvo
	var ap_txt := JSON.stringify(j.get("aparencia"))
	if ap_txt != o.ap: # cores, altura e rosto que o jogador escolheu no criador
		o.ap = ap_txt
		Aparencia.aplicar(o.no, Aparencia.valida(j.get("aparencia"), m.P.dados.criador))
	if str(j.get("nome", "")) != "":
		o.nome = str(j.nome) # troca.gd mostra o nome de quem tocou
	# André 2026-11-10: os outros jogadores veem o nome e o nível em cima da cabeça (só mexe no texto quando muda)
	var placa: String = "%s · Nv %d" % [str(j.get("nome", "")), int(j.get("nivel", 1))] if j.has("nivel") else str(j.get("nome", ""))
	if placa != o.placa_txt and o.placa != null:
		o.placa_txt = placa
		o.placa.text = placa
	if j.has("bot"):
		o.bot = true # a Cecília: não pede troca nem amizade (troca.gd)
	o.alvo = Vector3(float(j.x), float(j.y), float(j.z))
	o.ry = float(j.ry)
	# roupa que aparece no corpo (armadura.gd) e a capa abrindo com a velocidade (a foto vem 20 vezes por segundo)
	var roupa := str(j.get("roupa", ""))
	if j.get("semCapacete", false) == true: # o dono escondeu o capacete
		roupa = ",".join(PackedStringArray(Array(roupa.split(",", false)).filter(func(p): return not str(p).begins_with("chapeu"))))
	if roupa != o.get("roupa", "-"):
		o.roupa = roupa
		m.Armadura.vestir(o.no, m.Armadura.de_texto(roupa))
		o.lod = -1 # peça nova vem com sombra e contorno: o detalhe por distância confere de novo
	var mexeu: bool = j.get("_mexeu", true) # área de interesse: sem posição nova, nada de amostra (senão ele tranca)
	if roupa.contains("capa") and mexeu:
		m.Armadura.vento(o.no, Vector2(o.alvo.x - antes.x, o.alvo.z - antes.z).length() * 20.0, 0.05)
	if mexeu:
		_amostra(o, o.alvo, o.ry, j.has("_mexeu"))
	corpos[id] = o.no
	if o.barra:
		o.barra.scale.x = max(0.001, float(j.vida) / max(1.0, float(j.vidaMax)))
	o.pack_k = j.get("pack") # pack nas costas (transporte.gd desenha)
	# montado no lobo (Simulacao.montar): o lobo embaixo, o corpo agachado na sela e as armas nas costas
	var montado: bool = j.get("montado") != null and not j.get("morto", false)
	if montado != (o.get("montaria") != null):
		if montado:
			o.montaria = Montaria.new(m, str(j.montado) if Montaria.DADOS.has(str(j.montado)) else "lobo", o.no, o.esq)
			o.vel_m = 0.0
		else:
			o.montaria.remover()
			o.montaria = null
		o.modo = "" # arruma as armas de novo
	var modo := str(j.get("modo", "Espada"))
	if modo != o.modo:
		o.modo = modo
		var L: Dictionary = m.lugar_armas(o.visual)
		if o.get("montaria") != null:
			m.prender(o.esq, o.espada, L.espadaCostas)
			m.prender(o.esq, o.cajado, L.cajadoCostas)
			m.armas_montado(o.esq, o.espada, o.cajado)
		elif modo == "Espada":
			m.colisor_espada(o.esq, null)
			m.prender(o.esq, o.espada, L.espadaMao)
			m.prender(o.esq, o.cajado, L.cajadoCostas)
		else:
			m.colisor_espada(o.esq, null)
			m.prender(o.esq, o.espada, L.espadaCostas)
			m.prender(o.esq, o.cajado, L.cajadoMao)
	if o.get("montaria") != null and not (j.get("acao") is Dictionary):
		tocar(o.anim, "Idle") # quem anda é o lobo
		return
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
	# outro jogador parado com o cajado na mão: a mesma guarda de mago do herói (o servidor manda só "parada")
	if o.get("modo", "") == "Magia" and animacao(nome) == "parada" and an.has_animation("cajado_parada"):
		nome = "cajado_parada"
	# outro jogador no lago fundo: nada andando e boia parado, como o herói (o servidor manda andar/parada)
	if o.has("esq") and an.has_animation("nadar") and m.terreno != null:
		var p: Vector3 = o.no.position
		if m.terreno.agua_no_corpo(p.x, p.z, p.y) >= float(m.terreno.agua.peito) - 0.12:
			var anda: bool = animacao(nome) in ["andar", "trote", "corrida"]
			nome = "nadar" if anda else "boiar"
			o.sobe_alvo = m.SOBE_NADANDO if anda else m.SOBE_BOIANDO
		else:
			o.sobe_alvo = 0.0
	tocar(an, nome, 1.2 if nome == "nadar" else (m.ritmo(animacao(nome)) if o.has("esq") else 1.0)) # outros jogadores: passo no ritmo da corrida

func inimigo(c: Dictionary) -> void:
	var v := int(c.get("v", -1))
	if v < 0 or v >= m.inimigos.size():
		return
	var e: Dictionary = m.inimigos[v]
	if e.get("vazio", false): # campo do mundo grande ainda sem modelo (main.gd criar_vaga): monta agora
		m.materializar(e)
		m.entrou_online(e)
	corpos[str(c.id)] = e.no
	_chefe_historia(e, c)
	e.alvo = Vector3(float(c.x), float(c.y), float(c.z))
	e.ry = float(c.ry)
	if c.get("_mexeu", true): # área de interesse: monstro parado vem só com o id
		_amostra(e, e.alvo, e.ry, c.has("_mexeu"))
	if float(c.vida) < float(e.get("vida", c.vida)):
		e.combate = m.tempo + 5.0 # levou dano: nome aparece por 5 s
	e.vida = float(c.vida)
	if e.has("boss") and c.has("vidaMax"): # boss de mundo: a vida inteira vem do servidor (barra do topo, boss_mundo.gd)
		e.vida_max = float(c.vidaMax)
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
		if m.SOM_MORTE_MOB: # teste do André 2026-11-08 (main.gd)
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
	if t in ["bossSkill", "bossGolpe", "bosses", "furia", "efeito"]: # bosses de mundo (boss_mundo.gd)
		m.boss_mundo.evento(ev, corpos, meu_id)
		return
	match t:
		"prog": # nível, XP, atributos e skills da conta (o menu do personagem mostra)
			m.P.do_servidor(ev)
			if m.troca:
				m.troca.progresso_mudou() # a mochila da janela de troca mostra o que sobrou
			if m.leilao:
				m.leilao.progresso_mudou() # o ouro e a mochila da janela do leilão
			if m.construcao:
				m.construcao.progresso_mudou() # custos e sementes da barra do modo construção
			if m.transporte:
				m.transporte.prog_chegou() # combustível do carrinho de verdade
			return
		# Vila dos Lotes (construcao.gd): todos os lotes ao entrar, um lote que mudou, o lote que comprei
		"amiga": # sou o dono da Cecília: tocar nela abre a conversa (conversa.gd)
			var aid := str(ev.get("id", ""))
			if amiga_id == "":
				amiga_id = aid
			if aid != "" and not aid in amiga_ids:
				amiga_ids.append(aid)
			amiga_papeis[aid] = str(ev.get("papel", "a guerreira"))
			return
		"lotes":
			if m.construcao:
				m.construcao.do_servidor_lotes(ev)
			return
		"lote":
			if m.construcao:
				m.construcao.do_servidor_lote(ev)
			return
		"meuLote":
			if m.construcao:
				m.construcao.meu_lote(str(ev.lote))
			return
		"construiu":
			if m.construcao:
				m.construcao.construiu(ev)
			return
		"radar": # Radar de pesca: os spots aparecem no mapa e no minimapa por um tempo
			if m.pesca:
				m.pesca.radar(ev)
			return
		"veiculo": # FASE 1 (transporte.gd): subiu, desceu, quebrou, apanhou dentro do carrinho
			if m.transporte:
				m.transporte.evento(ev)
		"pesca": # pescaria (pesca.gd): lançou, boia na água, "!", briga, pegou, fim
			if m.pesca:
				m.pesca.evento(ev)
			return
		"regador": # encheu o regador (botão Encher ou mergulho)
			if m.construcao:
				m.construcao.encheu(ev)
			return
		"colheu":
			if m.construcao:
				m.construcao.colheu(ev)
			return
		"fabricando": # barrinha de criar: começou uma ou acabou a fila (construcao.gd)
			if m.construcao:
				m.construcao.fabricando(ev)
			return
		"fabricou": # criou peça da casa ou ferramenta da fazenda (construcao.gd)
			if m.construcao:
				m.construcao.fabricou(ev)
			return
		"destruiu", "evoluiu": # catalisador (André 2026-11-07): destruiu uma peça (o que ganhou) ou evoluiu (construcao.gd)
			if m.construcao:
				m.construcao.call(ev.t, ev)
			return
		"bau": # o baú do meu terreno (construcao.gd)
			if m.construcao:
				m.construcao.do_bau(ev)
			return
		"dormiu": # dormiu na cama (shared/simulacao.js dormir): a tela escurece, a hora pula para 6h30 e clareia
			if m.dia:
				m.dia.dormiu(ev)
			return
		"forno": # a fornalha do meu terreno (construcao.gd)
			if m.construcao:
				m.construcao.do_forno(ev)
			return
		"totem": # totem de teleporte descoberto ou marcado para renascer (o aviso vem junto): o totem acende
			if m.totem:
				m.totem.brilhar(str(ev.get("id", "")), ev.get("novo", false) == true)
			return
		"vila": # Voltar para a vila (casinha do menu do topo): começou, desistiu ou chegou na praça
			var id := str(ev.id)
			var fase := str(ev.get("fase", ""))
			if id == meu_id:
				if fase == "cancela":
					m.volta.cancelar("") # o aviso do porquê vem do servidor
				elif fase == "chegou":
					m.volta.chegar(Vector3(float(ev.x), float(ev.y), float(ev.z)), str(ev.get("totem", ""))) # totem: chegou num totem de teleporte
				return # "comeca": aqui no celular já começou na hora do toque
			var no = corpos.get(id)
			if no == null:
				return
			if fase == "comeca":
				fx.volta_vila(no, float(ev.get("dur", 8.0)))
			elif fase == "cancela":
				fx.volta_vila_fim(no, false)
			elif fase == "chegou":
				var x0 := float(ev.x0)
				var z0 := float(ev.z0)
				var para := Vector3(float(ev.x), float(ev.y), float(ev.z))
				if outros.has(id): # aparece direto na praça (sem deslizar o mapa todo)
					outros[id].alvo = para
					outros[id].buf = []
					no.position = para
				fx.volta_vila_fim(no, true, Vector3(x0, m.chao_em(x0, z0), z0))
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
				if ev.has("dot"): # sangramento, veneno ou queimadura de skill de boss: só o número, na cor do efeito
					fx.numero(no.position, ev.n, m.boss_mundo.cor_dot(str(ev.dot)), false)
					return
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
					if m.tempo - m._impacto_t > 0.2 and m.tempo - m._faisca_t > 0.8: # Faísca: o acerto já soou na hora
						m.impacto_golpe(no.position, true, crit, false)
			return
		"cura":
			if str(ev.alvo) != meu_id and corpos.has(str(ev.alvo)):
				fx.cura(corpos[str(ev.alvo)])
				fx.numero(corpos[str(ev.alvo)].position, ev.n, Color("7dffa0"))
			return
		"capitulo": # história v2 (André 2026-11-11): cartão de abertura e de fim de capítulo na janela do sistema
			if m.festa:
				m.festa.capitulo(str(ev.get("fase", "")), int(ev.get("n", 0)), str(ev.get("nome", "")), str(ev.get("frase", "")), ev.get("prox"))
			return
		"rumor": # recado curto de um personagem ao subir de nível, entre um capítulo e outro
			m.hud.aviso("%s: \"%s\"" % [str(ev.get("quem", "")), str(ev.get("texto", ""))])
			if m.sons:
				m.sons.tocar("pano", -6.0)
			return
		"esquecer": # luta da Vesper (história v2, final): a Névoa faz o time esquecer de você por uns segundos
			if m.amigos:
				m.amigos.esquecido_ate = m.tempo + float(ev.get("dur", 8))
				m.amigos._barras.queue_redraw()
			return
		"cena": # cena da história (cinematica.gd): o herói já está no lugar ("corrigir" vem antes)
			if m.cinematica:
				m.cinematica.tocar(str(ev.get("id", "")))
			return
		"nevoa_some": # chefe da história que para a luta e some (Kael): névoa no lugar e o corpo some na hora
			var p := Vector3(float(ev.get("x", 0)), float(ev.get("y", 0)), float(ev.get("z", 0)))
			if m.fx:
				m.fx.fumaca_chao(p.x, p.z, 1.6, 26, "b8bccc", 1.4)
			for e in m.inimigos:
				if str(e.get("hc", "")) != "" and e.no.visible and e.no.position.distance_to(p) < 3.0:
					e.no.visible = false
			if m.sons:
				m.sons.tocar("pano", -4.0)
			return
		"etapa": # próxima etapa da missão: aviso curto e o som da janela
			m.hud.aviso("Próximo passo: %s" % str(ev.get("txt", "")))
			if m.sons:
				m.sons.tocar("q_anel_1", -16.0)
			return
		"aviso":
			m.hud.aviso(str(ev.texto))
			if m.criador and m.criador.aberto():
				m.criador.aviso_servidor(str(ev.texto))
			return
		"nomeUsado": # criador: o nome já é de outra conta; a próxima foto (ainda criando) abre o criador de novo
			_nome_recusado = str(ev.get("nome", ""))
			_erro_nome = str(ev.get("texto", ""))
			_pronto = false
			return
		"nome": # troquei o nome pagando (botão no Aparência)
			m.hud.nome = str(ev.get("nome", m.hud.nome))
			if m.criador and m.criador.aberto():
				m.criador.nome_trocado(m.hud.nome)
			return
		"tomo": # aprendeu com o Tomo (André 2026-11-07): faixa de "Parabéns!" por cima da janela
			if m.menu:
				m.menu.aprendeu(str(ev.h), int(ev.nv))
			return
		"compra": # comprou na loja (André 2026-11-07): som de moedas e o "+n Item" subindo (menu.gd comprou)
			if m.menu: # o servidor só manda para quem comprou
				m.menu.comprou(ev)
			return
		"reforco": # reforço de equipamento: o servidor sorteou (reforco.gd mostra na janelinha)
			if m.reforco:
				m.reforco.do_servidor(ev)
			return
		"equipVer": # o equipamento de outro jogador ou da Cecília (troca.gd, André 2026-11-10)
			if m.troca:
				m.troca.mostrar_equip(ev)
			return
		"troca": # troca entre jogadores (troca.gd): pedido que chegou, como está a mesa, fim
			if m.troca:
				m.troca.do_servidor(ev)
			return
		"reinicio": # o servidor vai reiniciar (merge ou reinício programado): faixa no alto e contagem (reinicio.gd)
			if m.reinicio:
				m.reinicio.do_servidor(int(ev.get("s", 0)))
			return
		"anuncio": # boss de mundo apareceu, caiu ou soltou Mítico: faixa na tela que some (festa.gd), fora do chat
			if m.hud.festa:
				m.hud.festa.anuncio(str(ev.get("cab", "")), str(ev.get("titulo", "")), str(ev.get("cor", "boss")))
			else:
				m.hud.aviso(str(ev.get("titulo", "")))
			return
		"chat", "chatHist": # chat geral e de amigos (chat.gd)
			if m.chat:
				m.chat.do_servidor(ev)
			return
		"amigos", "amigo", "time": # lista de amigos, pedido de amizade e time (amigos.gd)
			if m.amigos:
				m.amigos.do_servidor(ev)
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
		"caverna": # o selo da Caverna da Montanha abriu (usei o passe) ou fechou (saí, morri)
			if str(ev.get("id", "")) == meu_id:
				m.mov.selo_aberto = ev.get("aberta", false) == true
				if m.mov.selo_aberto:
					m.sons.tocar("magia", -6.0)
			return
		"leilao": # Casa do Comércio (leilao_ui.gd): a busca, os meus anúncios e o que está guardado com o Otávio
			if m.leilao:
				m.leilao.do_servidor(ev)
			return
		"fala":
			if not (m.conversa and m.conversa.fala(str(ev.get("npc", "")), str(ev.texto), ev)): # janela do NPC aberta: a fala aparece nela
				m.hud.aviso(str(ev.texto))
			if str(ev.get("abrir", "")) == "resetar":
				m.menu.perguntar_reset(int(ev.get("custo", 0)))
			return
		"veio": # alguém bateu num veio de zona de mineração ou numa árvore: a pedra some e a árvore cai para todo mundo quando esgota
			m.trabalho.veio_comum(str(ev.no), int(ev.cargas), float(ev.volta), ev.get("dir"))
			return
		"drop": # ouro e itens do monstro que eu ajudei a derrubar (já estão na mochila)
			var x := float(ev.x)
			var z := float(ev.z)
			m.mostrar_drop(Vector3(x, m.chao_em(x, z), z), int(ev.get("ouro", 0)), ev.get("itens", []))
			return
		"corrigir": # o servidor não aceitou a posição: volta para onde ele sabe
			if ev.has("c"): # numerado: correção velha (chegou depois de uma mais nova) não puxa de novo
				if int(ev.c) <= corr_seq:
					return
				corr_seq = int(ev.c)
			var antes: Vector3 = m.heroi.position - m.desliza
			# com a altura que ele mandou: sem ela, dentro da caverna o chão virava o topo da montanha por cima do túnel
			m.mov.por_em(Vector3(float(ev.x), float(ev.y), float(ev.z)), true)
			m.mov.ry = float(ev.ry)
			var novo: Vector3 = m.mov.posicao()
			var dif: Vector3 = antes - novo
			# correção pequena: o corpo desliza até o lugar certo (a câmera vai junto); grande: pula como antes
			m.desliza = dif if Vector2(dif.x, dif.z).length() < DESLIZA_MAX and absf(dif.y) < 1.0 else Vector3.ZERO
			m.heroi.position = novo + m.desliza
			return
	if meu: # o que eu fiz já apareceu na hora, aqui no celular
		return
	# magia dos outros longe (André 2026-11-11: os NPCs caçando juntos travavam o spot): a mais de FX_LONGE m nem desenha
	if t in ["proj", "raio", "explosao", "chuva", "meteoro", "cadeia"] and ev.has("x") and ev.has("z") and m.heroi != null:
		if Vector2(float(ev.x) - m.heroi.position.x, float(ev.z) - m.heroi.position.z).length() > FX_LONGE:
			return
	match t:
		"proj":
			var info := {"vel": float(ev.vel), "cor": cor(ev.get("cor")), "tam": float(ev.get("tam", 0.24)), "estilo": str(ev.get("estilo", "arcano"))}
			if ev.get("explosao"):
				info.explosao = float(ev.explosao)
			fx.projetil(Vector3(float(ev.x), float(ev.y), float(ev.z)), Vector3(float(ev.dx), float(ev.dy), float(ev.dz)).normalized(), info, 0, 22.0)
		"raio":
			fx.raio(float(ev.x), float(ev.z), m.chao_em(float(ev.x), float(ev.z)))
		"explosao":
			var x := float(ev.x)
			var z := float(ev.z)
			var k := str(ev.get("fx", "explosao"))
			fx.explosao_hab(m.P.FX.get(k, k), x, z, float(ev.r), m.chao_em(x, z), float(ev.get("ry", -999.0))) # ry: Corte Duplo e Esmagador
		"chuva":
			fx.chuva(float(ev.x), float(ev.z), float(ev.r), int(ev.ondas), func(_p): pass)
		"meteoro":
			var x := float(ev.x)
			var z := float(ev.z)
			fx.meteoro(x, z, float(ev.r), float(ev.queda), m.chao_em(x, z), func(_p): pass)
		"cadeia":
			var x := float(ev.x)
			var z := float(ev.z)
			fx.cadeia(Vector3(float(ev.x0), float(ev.y0), float(ev.z0)), Vector3(x, m.chao_em(x, z) + 1.0, z))
		"teleporte":
			var x0 := float(ev.x0)
			var z0 := float(ev.z0)
			var x := float(ev.x)
			var z := float(ev.z)
			fx.teleporte(Vector3(x0, m.chao_em(x0, z0), z0), Vector3(x, m.chao_em(x, z), z))
			var no = corpos.get(str(ev.id))
			if no and no != m.heroi and outros.has(str(ev.id)): # aparece direto lá (sem deslizar)
				outros[str(ev.id)].alvo = Vector3(x, m.chao_em(x, z), z)
				outros[str(ev.id)].buf = []
				no.position = outros[str(ev.id)].alvo
		"preparo": # o monstro vai bater: brilho vermelho crescendo
			var no = corpos.get(str(ev.id))
			if no:
				m.combate.preparo(no, float(ev.dur))
				for e in m.inimigos: # vai bater: ainda está na luta (a música de combate não corta, main.luta_perto)
					if e.no == no:
						e.luta = m.tempo + 5.0
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
			fx.impacto(x, z, float(ev.ry), m.P.FX.get(k, k), m.chao_em(x, z))
		"vortice":
			var x := float(ev.x)
			var z := float(ev.z)
			fx.vortice(x, z, float(ev.r), m.chao_em(x, z))
		"anel":
			var x := float(ev.x)
			var z := float(ev.z)
			fx.anel(x, z, float(ev.r), cor(ev.get("cor")), float(ev.get("dur", 0.8)), m.chao_em(x, z))
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
const SEGUE_MAX := 0.3 # s que um corpo segue andando sozinho quando a próxima foto atrasa (_interpolar)

func _agora() -> float:
	return Time.get_ticks_usec() / 1000000.0

# Atraso que se ajusta à internet (2026-11-03): no 4G as fotos às vezes chegam com 100-300 ms de folga e depois várias
# juntas; com atraso fixo de 0,1 s faltava foto, o monstro parava e depois dava um salto. Mede a folga entre as fotos
# (sobe na hora, desce devagar) e anda até 0,25 s atrás do servidor só quando a internet está assim. No Wi-Fi bom fica 0,1 s.
const ATRASO_MAX := 0.25
var _atraso := ATRASO
var _folga := 0.0
var _ult_chegada := -1.0
func _medir_chegada() -> void:
	var agora := _agora()
	if _ult_chegada > 0.0:
		var desvio: float = absf((agora - _ult_chegada) - 0.05)
		_folga = maxf(desvio, _folga * 0.985)
		_atraso = clampf(ATRASO + _folga * 1.2, ATRASO, ATRASO_MAX)
	_ult_chegada = agora

# André 2026-11-12 ("os mobs começam a pipocar"): cada amostra leva a hora do SERVIDOR (foto.tempo) passada para o relógio
# daqui pelo menor atraso já visto. Antes valia a hora em que a foto chegou: fotos que chegavam juntas ficavam com a mesma
# hora e o monstro andava aos saltos; e a velocidade para seguir andando entre fotos (_interpolar) saía errada.
var _ts_foto := -1.0
var _desvio_srv := INF # relógio daqui menos o do servidor, no melhor caso (a foto que chegou mais rápido)
func _marcar_tempo(f: Dictionary) -> void:
	var ag := _agora()
	if not f.has("tempo"):
		_ts_foto = ag
		return
	var d: float = ag - float(f.tempo)
	if d < _desvio_srv or absf(d - _desvio_srv) > 30.0: # mais rápido que o melhor caso (ou servidor reiniciou): vale este
		_desvio_srv = d
	else: # sobe devagar (o relógio do celular e o do servidor andam um pouco diferente)
		_desvio_srv += (d - _desvio_srv) * 0.002
	_ts_foto = float(f.tempo) + _desvio_srv

func _amostra(o: Dictionary, p: Vector3, ry: float, aoi := false) -> void:
	if not o.has("buf"):
		o.buf = []
	var ag := _ts_foto if _ts_foto > 0.0 else _agora()
	# área de interesse: parado não manda posição; quando volta a andar, segura onde estava até um instante antes
	# (senão ele pularia direto para o meio do caminho)
	if aoi and not o.buf.is_empty() and ag - o.buf[o.buf.size() - 1][0] > 0.15:
		var u: Array = o.buf[o.buf.size() - 1]
		o.buf.append([ag - 0.05, u[1], u[2]])
	o.buf.append([ag, p, ry])
	while o.buf.size() > 8:
		o.buf.pop_front()

func _interpolar(o: Dictionary, no: Node3D, dt: float) -> void:
	var buf: Array = o.get("buf", [])
	var t := _agora() - _atraso
	if buf.size() >= 2 and t >= buf[buf.size() - 1][0] and t - buf[buf.size() - 1][0] < SEGUE_MAX:
		# a próxima foto atrasou um pouco: segue andando na mesma velocidade por até SEGUE_MAX s (antes parava e depois
		# pulava; André 2026-11-12 "os mobs começam a pipocar")
		var a0: Array = buf[buf.size() - 2]
		var b0: Array = buf[buf.size() - 1]
		var dtb: float = b0[0] - a0[0]
		if dtb > 0.02 and dtb < 0.5:
			var vel: Vector3 = ((b0[1] as Vector3) - (a0[1] as Vector3)) / dtb
			if vel.length() < 15.0:
				var pe: Vector3 = (b0[1] as Vector3) + vel * (t - b0[0])
				no.position = no.position.lerp(pe, min(1.0, dt * 20.0))
				no.rotation.y = lerp_angle(no.rotation.y, b0[2], min(1.0, dt * 15.0))
				return
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

# ---------- muitos personagens na tela (André 2026-11-11: os 20 aventureiros travavam a vila) ----------
# Cada corpo VRoid perto custava sombra, contorno, cabelo com mola e animação cheia, e era montado do zero toda vez que
# entrava na visão. Agora: só os DETALHE_MAX mais perto (até DETALHE_PERTO m) ficam com tudo; os outros ficam sem
# sombra, sem contorno e sem mola (como os NPCs da vila de longe), e a animação deles anda a cada 2 quadros (até
# ANIM_LONGE m) ou 3 quadros (mais longe). O corpo do NPC que sai da visão fica guardado para voltar sem tranco.
# André 2026-11-11 ("reduzir qualidade dos npcs e personagens", liso em celular mediano): 2 com tudo (até 10 m),
# corpos somem a 45 m (era 75) e no máximo 10 na tela (era 24); LOD mais forte em quem não está entre os mais perto.
const DETALHE_MAX := 2
const SOME_LONGE := 45.0 # m: mais longe que isso o corpo de outro jogador ou NPC some (fica o ponto no minimapa)
const VISIVEIS_MAX := 10 # no máximo 10 corpos de outros na tela (os mais perto)
const FX_LONGE := 45.0 # m: magia dos outros mais longe que isso não é desenhada (o servidor já corta a 100 m)
const DETALHE_PERTO := 10.0
const ANIM_LONGE := 25.0
const GUARDADOS_MAX := 10 # corpos de NPC guardados escondidos (por corpo do criador)
var _guardados := {} # visual -> [o]
var _detalhe_t := 0.0
var _quadro := 0

func _molas_de(esq: Skeleton3D) -> Array:
	var l := []
	if esq != null:
		for c in esq.get_children():
			if c is SpringBoneSimulator3D:
				l.append(c)
	return l

func _detalhe_outros(dt: float) -> void:
	_quadro += 1
	_detalhe_t -= dt
	if _detalhe_t > 0.0 or m.heroi == null:
		return
	_detalhe_t = 0.25
	var hp: Vector3 = m.heroi.position
	var lista := []
	for id in outros:
		lista.append([outros[id].no.position.distance_squared_to(hp), id])
	lista.sort_custom(func(a, b): return a[0] < b[0])
	for k in lista.size():
		var o: Dictionary = outros[lista[k][1]]
		var d2: float = lista[k][0]
		var perto: float = DETALHE_PERTO + (2.0 if int(o.get("lod", -1)) == 2 else 0.0) # não pisca no limite
		var anim_l: float = ANIM_LONGE + (3.0 if int(o.get("lod", -1)) >= 1 else 0.0)
		var nivel := 2 if k < DETALHE_MAX and d2 < perto * perto else (1 if d2 < anim_l * anim_l else 0)
		if nivel != int(o.get("lod", -1)):
			_aplicar_detalhe(o, nivel)
		# muito longe (ou além dos VISIVEIS_MAX mais perto): o corpo some e para de animar; o ponto continua no minimapa
		var some_l: float = SOME_LONGE - (5.0 if o.get("sumiu", false) else 0.0)
		var sumiu: bool = d2 > some_l * some_l or k >= VISIVEIS_MAX
		if sumiu != o.get("sumiu", false):
			o.sumiu = sumiu
			o.no.visible = not sumiu
			if o.get("montaria") != null and is_instance_valid(o.montaria.no):
				o.montaria.no.visible = not sumiu

func _aplicar_detalhe(o: Dictionary, nivel: int) -> void:
	var antes := int(o.get("lod", -1))
	o.lod = nivel
	var cheio := nivel == 2
	if antes == -1 or (antes == 2) != cheio:
		m.npc_simples(o.no, not cheio)
		for mo in o.get("molas", []):
			if is_instance_valid(mo):
				mo.active = cheio
	o.anim_passo = [3, 2, 1][nivel]
	# malha mais simples mais cedo (o LOD automático do Godot) para quem não está entre os mais perto
	if antes == -1 or not o.has("malhas"):
		o.malhas = o.no.find_children("*", "MeshInstance3D", true, false)
		m.LodMalha.pedir(o.no) # roupa, cabelo e corpo montados no jogo ganham LOD (lod_malha.gd)
		m.pecinhas_de_perto(o.no) # olhos, cílios, fivelas: só desenhados de perto
	for mi in o.malhas:
		if is_instance_valid(mi):
			mi.lod_bias = [0.2, 0.4, 0.8][nivel]
	m.anim_espacada(o.anim, o.esq, not cheio)
	o.anim_acc = 0.0

# saiu da visão: o corpo de NPC fica escondido e parado para ser reaproveitado; o de jogador vai embora como antes
func _soltar_corpo(o: Dictionary) -> void:
	if o.get("montaria") != null:
		o.montaria.remover()
		o.montaria = null
	var l: Array = _guardados.get(o.visual, [])
	if not o.get("bot", false) or l.size() >= GUARDADOS_MAX or not is_instance_valid(o.no):
		if is_instance_valid(o.no):
			o.no.queue_free()
		return
	if o.has("esq_y0") and o.esq:
		o.esq.position.y = float(o.esq_y0)
	o.no.visible = false
	o.no.process_mode = Node.PROCESS_MODE_DISABLED
	l.append(o)
	_guardados[o.visual] = l

func _tirar_guardado(vis: String):
	var l: Array = _guardados.get(vis, [])
	while not l.is_empty():
		var g = l.pop_back()
		if is_instance_valid(g.no):
			return g
	return null

# ---------- quadro a quadro ----------
var ms := 0.0 # tempo gasto aqui por quadro (média), aparece no Teste
func _process(dt: float) -> void:
	var t0 := Time.get_ticks_usec()
	_passo(dt)
	ms = lerp(ms, (Time.get_ticks_usec() - t0) / 1000.0, 0.05)

func _passo(dt: float) -> void:
	if _cobrindo:
		_cobrir_t -= dt
		if _cobrir_t <= 0.0: # o servidor não respondeu
			if rede.sessao != "": # com conta: volta para a tela inicial (André 2026-11-07)
				_voltar_a_tela_inicial()
			else: # sem conta: libera o jogo sozinho
				esconder_login()
	if _queda_t > 0.0:
		_queda_t -= dt
		if _queda_t <= 0.0 and not ligado:
			_desconectado()
			return
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
	# 2026-11-03: a posição anda no tempo de verdade (a câmera lenta da morte e a congelada do golpe só deixam a
	# animação mais lenta). Antes eles ficavam para trás durante a câmera lenta e davam um salto quando ela acabava,
	# porque o servidor não para.
	var dt_pos: float = dt / max(Engine.time_scale, 0.001)
	_detalhe_outros(dt)
	for id in outros:
		var o: Dictionary = outros[id]
		var antes: Vector3 = o.no.position
		_interpolar(o, o.no, dt_pos)
		var passo: int = o.get("anim_passo", 1)
		if passo > 1 and o.no.visible: # longe ou fora dos mais perto: a animação anda a cada 2 ou 3 quadros (o mesmo tempo total)
			o.anim_acc = float(o.get("anim_acc", 0.0)) + dt
			if (_quadro + int(o.get("fase", 0))) % passo == 0:
				if o.anim:
					o.anim.advance(o.anim_acc)
				if o.esq:
					o.esq.advance(o.anim_acc) # os ajustes de osso (molas, mão, ombro) andam junto com a animação
				o.anim_acc = 0.0
		if o.has("sobe_alvo") and o.esq: # nadando: o corpo sobe como o do herói (main.gd SOBE_*)
			o.sobe = move_toward(float(o.get("sobe", 0.0)), float(o.sobe_alvo), dt_pos * 0.6)
			if not o.has("esq_y0"):
				o.esq_y0 = o.esq.position.y
			o.esq.position.y = float(o.esq_y0) + o.sobe
		o.uma_vez = max(0.0, o.uma_vez - dt)
		if o.get("montaria") != null: # o lobo anda no ritmo do que o corpo andou de verdade neste quadro
			var v: float = Vector2(o.no.position.x - antes.x, o.no.position.z - antes.z).length() / max(dt_pos, 0.001)
			o.vel_m = lerp(float(o.get("vel_m", 0.0)), min(v, 12.0), min(1.0, dt_pos * 6.0))
			o.montaria.passo(dt, o.vel_m)
	for e in m.inimigos:
		if e.estado == "morto" and not e.no.visible: # escondido (longe ou vaga vazia): nada para mexer
			continue
		if e.has("alvo"): # morto também: o golpe final joga o corpo para trás (o servidor manda onde ele cai)
			_interpolar(e, e.no, dt_pos)
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
		var p: Vector3 = m.heroi.position - m.desliza # o lugar de verdade (sem o deslize da correção na tela)
		var a: String = para_servidor.get(m.heroi_anim.current_animation, {"freada": "Walk", "meia_volta": "Run"}.get(m.heroi_anim.current_animation, "Idle"))
		if m.montaria != null: # montado: vai o passo do lobo (o site e os outros apps põem o lobo andando ou galopando)
			a = "Run" if m.mov.velocidade() > 4.4 else ("Walk" if m.mov.velocidade() > 0.35 else "Idle")
		# e: 1 = este app conhece a estamina (o servidor só deixa correr com fôlego)
		rede.enviar("pos", {"x": snappedf(p.x, 0.001), "y": snappedf(p.y, 0.001), "z": snappedf(p.z, 0.001), "ry": snappedf(m.mov.ry, 0.001), "anim": a, "e": 1, "c": corr_seq})
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

# Chefe com nome da história (André 2026-11-11, CHEFES_HISTORIA): o servidor transforma um monstro do campo no chefe
# (hc). Aqui o mesmo modelo cresce (esc), o nome vira o dele em dourado e a barra fica da cor do brilho; quando o corpo
# volta a ser um monstro comum (outro id, sem hc), desfaz.
func _chefe_historia(e: Dictionary, c: Dictionary) -> void:
	var hc := str(c.get("hc", "")) if c.get("hc") != null else ""
	if hc == str(e.get("hc", "")):
		# o mesmo chefe mudou de tamanho (a Vesper se funde ao Coração na fase 3): só cresce, sem refazer o corpo
		if hc != "" and e.has("escala0") and is_instance_valid(e.get("no")) and absf(float(c.get("esc", 1.5)) - float(e.get("hc_esc", 0.0))) > 0.01:
			e.hc_esc = float(c.get("esc", 1.5))
			e.no.scale = e.escala0 * e.hc_esc
		return
	_corpo_humano(e, hc)
	corpos[str(c.id)] = e.no
	if not e.has("escala0"):
		e.escala0 = e.no.scale
	var nome_l: Label3D = null
	for l in e.no.get_children():
		if l is Label3D:
			nome_l = l
			break
	if nome_l != null and not e.has("nome0"):
		e.nome0 = nome_l.text
		e.cor_nome0 = nome_l.modulate
	if hc != "":
		e.hc_esc = float(c.get("esc", 1.5))
		e.no.scale = e.escala0 * e.hc_esc
		if nome_l != null:
			nome_l.text = str(c.get("nome", nome_l.text))
			nome_l.modulate = Color("ffd76a")
		e.combate = m.tempo + 8.0 # o nome aparece logo
	else:
		e.no.scale = e.escala0
		if nome_l != null:
			nome_l.text = str(e.get("nome0", nome_l.text))
			nome_l.modulate = e.get("cor_nome0", Color.WHITE)
	e.hc = hc

# chefe humano da história (Velados, Kael; CHEFES_HISTORIA.humano em shared/dados.js): o servidor segue usando o monstro
# da vaga, mas na tela ele vira o corpo do herói (modelo de NPC) com a roupa da armadura e espada (CLAUDE.md: humanos
# usam o corpo do herói). Quando o chefe sai (vencido, fugiu ou expirou), o monstro da vaga volta.
const CAMPOS_CORPO := ["no", "anim", "barra", "alto", "escala0", "nome0", "cor_nome0"]
func _corpo_humano(e: Dictionary, hc: String) -> void:
	var H = null
	if hc != "":
		H = m.P.dados.get("historia", {}).get("chefes", {}).get(hc, {}).get("humano")
	if e.has("monstro"): # volta o monstro
		var no_h: Node3D = e.no
		var mo: Dictionary = e.monstro
		for k in CAMPOS_CORPO:
			e.erase(k)
			if mo.has(k):
				e[k] = mo[k]
		e.erase("monstro")
		e.no.position = no_h.position
		e.no.rotation = no_h.rotation
		e.no.visible = true
		no_h.queue_free()
	if not (H is Dictionary) or not ResourceLoader.exists("res://modelos/%s.glb" % str(H.get("modelo", ""))):
		return
	var guarda := {}
	for k in CAMPOS_CORPO:
		if e.has(k):
			guarda[k] = e[k]
	var h: Dictionary = m.criar_inimigo(str(H.modelo), e.no.position, "Inimigo")
	m.inimigos.pop_back() # o corpo novo fica no lugar do da vaga, não vira outro inimigo
	h.no.rotation = e.no.rotation
	m.Armadura.vestir(h.no, m.Armadura.de_texto(str(H.get("roupa", ""))))
	e.no.visible = false
	for k in CAMPOS_CORPO:
		e.erase(k)
	e.no = h.no
	e.anim = h.anim
	e.barra = h.barra
	e.monstro = guarda

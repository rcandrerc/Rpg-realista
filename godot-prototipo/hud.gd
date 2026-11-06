extends CanvasLayer
# HUD do celular, no mesmo arranjo do jogo HTML: joystick que aparece onde o dedo toca (esquerda),
# golpe grande embaixo à direita, as 4 habilidades do modo em coluna ao lado, Trocar em cima, Cura embaixo
# e Rolar, Dash e Pular na fileira de baixo. Painel do herói em cima à esquerda. Os botões só mostram símbolos.
# Todo toque passa por aqui (vários dedos ao mesmo tempo): botão, joystick ou câmera.

signal apertou(acao: String) # "basico", "hab0".."hab5", "cura", "troca", "pular", "dash", "rolar", "disparada", "coletar", "falar", "menu" (toque no painel do herói)
signal soltou(acao: String)
signal tocou(pos: Vector2) # toque rápido na tela, sem arrastar (fora dos botões): tocar num NPC vai até ele

const COR_FUNDO := Color(0.1, 0.088, 0.072, 0.9)
const COR_BORDA := Color(0.72, 0.57, 0.32, 0.9) # dourado discreto, igual ao menu do personagem
const COR_GOLPE := Color(0.33, 0.16, 0.12, 0.95)
const COR_TROCA := Color(0.33, 0.24, 0.12, 0.95)
const COR_CURA := Color(0.12, 0.3, 0.2, 0.95)

var mover := Vector2.ZERO # joystick (-1..1)
const JOY_RAIO := 90.0 # px do centro até a borda: andar até a metade, correr no fim (era 60, curto demais)
var giro_cam := Vector2.ZERO # quanto o dedo da câmera andou neste quadro
# zoom da câmera (André 2026-11-03: o jogo HTML tinha e sumiu no Godot): dois dedos do lado da câmera
# afastando aproximam, juntando afastam; a roda do mouse também (teste no PC). Vem como fator (1 = nada)
var zoom_cam := 1.0
var _cam_dedos := {} # índice do dedo da câmera -> posição (para medir a pinça)
var _pinca := 0.0 # distância entre os dois dedos da câmera no quadro anterior (0 = sem pinça)
var botoes: Array = [] # {acao, centro (a partir do canto de baixo à direita), raio, icone, cor, cd, cd_max}
var _toques := {} # índice do dedo -> "joy" | "cam" | "morto" (zona morta) | acao
var _inicio := {} # índice do dedo -> [posição, hora] (joystick e câmera): toque rápido sem arrastar vira "tocou"
var _joy_centro := Vector2.ZERO
var _joy_dedo := Vector2.ZERO
var _tela: Control
var _painel: Control
var vida := 1.0
var mana := 1.0
var estamina := 1.0 # barra amarela (Parte 3 do Quimera): correr, dash, rolar e mortal gastam
var sem_folego := false
var texto_vida := ""
var texto_mana := ""
var nome := "Ruiva"
var nivel := 1
var xp := 0.0 # 0..1 até o próximo nível
var escudo := false
var canal := -1.0 # magia concentrada: 0..1 (barra no meio da tela); -1 = nenhuma
var canal_vila := false # a barra é a do Voltar para a vila (dourada, com o nome em cima, mais alta na tela)
var bloqueado := false # menu do personagem aberto: a tela de jogo não recebe toque
var menu_topo # menu_topo.gd: toque nos ícones do canto de cima não vira joystick nem câmera
var minimapa # minimapa.gd: toque no minimapa abre o mapa completo (não vira câmera)
var construcao # construcao.gd: toque na barra do modo construção (e na janela de compra) não vira joystick nem câmera
var troca # troca.gd: o cartão do pedido de troca não vira joystick nem câmera
const PAINEL := Rect2(18, 14, 330, 100) # tocar aqui abre o menu do personagem; segurar abre o modo de editar a interface
# modo de editar a interface (André 2026-11-06, editar_hud.gd): cada elemento ganha um deslocamento (d, px) e uma escala (s)
var painel_d := Vector2.ZERO
var painel_s := 1.0
var joy_s := 1.0 # tamanho do joystick (ele continua nascendo onde o dedo toca)
var editando := false # modo de edição aberto: a HUD não anda, não ataca e não abre menu
var editor # editar_hud.gd
const SEGURAR := 0.55 # segundos segurando o painel para abrir o modo de edição
var _painel_dedo := -1
var _painel_t := 0.0
var _painel_ini := Vector2.ZERO
var retrato: Texture2D # rosto do herói (main.gd monta o palco); sem ele fica a letra
var fonte: Font
var relogio_teste := -1.0 # só para gravar o clipe do medalhão (>= 0 troca o relógio do brilho)
var modo := "Espada"
var _icones := {}
var aviso_txt := ""
var _aviso_t := 0.0
var destaque_txt := "" # subiu de nível: grande e dourado, separado dos outros avisos
var _destaque_t := 0.0
var _dano_t := 0.0 # levou golpe: borda vermelha rápida (e fraca, contínua, com a vida baixa)

# modo construção / compra de terreno (construcao.gd, como no Quimera): os botões de combate somem, o joystick fica
# (ele move a mira da câmera flutuante). arrastar = true: o dedo do lado direito marca o terreno em vez de girar a câmera
var modo_construcao := false
var arrastar_terreno := false
var esconder_combate := false # janela de um NPC aberta: skills, golpe, joystick e cura somem (fica o painel de vida)
var caido := false # herói caído (morte.gd): os botões de luta somem até ele levantar
var _combate: Control # joystick e botões, desenhados por cima de _tela (some com fade)

func levou_dano() -> void:
	_dano_t = 0.35

func _ready() -> void:
	fonte = load("res://fontes/AlegreyaSans-Bold.ttf")
	_tela = Control.new()
	_tela.set_anchors_preset(Control.PRESET_FULL_RECT)
	_tela.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_tela.draw.connect(_desenhar)
	add_child(_tela)
	_combate = Control.new()
	_combate.set_anchors_preset(Control.PRESET_FULL_RECT)
	_combate.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_combate.draw.connect(_desenhar_combate)
	_tela.add_child(_combate)
	# posições pensadas numa tela de 1280x576 (deitada); contadas a partir do canto de baixo à direita
	_botao("troca", Vector2(46, 250), 28, "troca", COR_TROCA)
	# as 6 skills escolhidas no menu do personagem, num arco em volta do golpe
	for i in 6:
		var ang := deg_to_rad(80.0 - 25.0 * i)
		_botao("hab%d" % i, Vector2(80, 158) + Vector2(cos(ang), sin(ang)) * 172.0, 33, "", COR_FUNDO)
	_botao("basico", Vector2(80, 158), 56, "basico", COR_GOLPE)
	_botao("cura", Vector2(80, 58), 31, "cura", COR_CURA)
	_botao("pular", Vector2(333, 64), 34, "pular", COR_FUNDO)
	_botao("dash", Vector2(421, 61), 31, "dash", COR_FUNDO)
	_botao("rolar", Vector2(503, 61), 31, "rolar", COR_FUNDO)
	_botao("coletar", Vector2(421, 160), 30, "pf_min", COR_TROCA) # perto de veio ou árvore: minerar ou cortar lenha
	botoes[-1].oculto = true
	# loja, forja e Mestre Ivo não têm mais botão próprio (André aprovou tirar, 2026-11-03): tudo pelo "Falar"
	_botao("falar", Vector2(509, 160), 30, "falar", COR_TROCA) # perto de qualquer NPC: abre a janela dele (conversa.gd)
	botoes[-1].oculto = true
	# disparada (André 2026-11-03): liga e desliga a corrida que gasta estamina; o joystick sozinho só anda e trota.
	# Fica no fim da lista (os índices de cima são usados em mostrar_build) e na ponta da fileira de baixo.
	_botao("disparada", Vector2(585, 61), 31, "disparada", COR_FUNDO)
	# lobo (montaria): sobe e desce; aceso enquanto montado. Também no fim da lista, ao lado da disparada
	_botao("montar", Vector2(667, 61), 31, "lobo", COR_FUNDO)

func _botao(acao: String, canto: Vector2, raio: float, icone: String, cor: Color) -> void:
	botoes.append({"acao": acao, "canto": canto, "raio": raio, "raio0": raio, "d": Vector2.ZERO, "s": 1.0, "icone": icone, "cor": cor, "cd": 0.0, "cd_max": 1.0, "apertado": false, "travado": false, "oculto": false,
		"pronto_t": 0.0, "nega_t": 0.0, "sem_mana": false, "borda": null})

# apertou e não pôde (sem mana, recarga): o botão treme um instante
func negar(acao: String) -> void:
	for b in botoes:
		if b.acao == acao:
			b.nega_t = 0.25

# sem mana para a skill: o botão fica apagado com um véu azul
func sem_mana(acao: String, v: bool) -> void:
	for b in botoes:
		if b.acao == acao:
			b.sem_mana = v

# borda do botão na cor do elemento da skill (fogo, gelo, arcano, lâmina); null = a dourada de sempre
func borda(acao: String, cor) -> void:
	for b in botoes:
		if b.acao == acao:
			b.borda = cor

# botão que liga e desliga (disparada): aceso enquanto ligado
func ligar_botao(acao: String, v: bool) -> void:
	for b in botoes:
		if b.acao == acao:
			b.ligado = v

func mostrar_botao(acao: String, v: bool) -> void:
	for b in botoes:
		if b.acao == acao:
			b.oculto = not v

func icone(nome_ico: String) -> Texture2D:
	if nome_ico == "":
		return null
	if not _icones.has(nome_ico):
		_icones[nome_ico] = load("res://icones/%s.svg" % nome_ico)
	return _icones[nome_ico]

func icone_botao(acao: String, ic: String) -> void:
	for b in botoes:
		if b.acao == acao:
			b.icone = ic

func mostrar_build(icones_modo: Array, modo_atual: String, travados: Array = []) -> void:
	modo = modo_atual
	for i in 6:
		botoes[1 + i].icone = icones_modo[i]
		botoes[1 + i].travado = travados[i] if i < travados.size() else false
	botoes[7].icone = "basico" if modo == "Espada" else "magia"

func recarga(acao: String, falta: float, total: float) -> void:
	for b in botoes:
		if b.acao == acao:
			if b.cd > 0.0 and falta <= 0.0 and total > 1.5: # voltou a ficar pronta: brilho que abre
				b.pronto_t = 0.45
			b.cd = falta
			b.cd_max = max(total, 0.01)

func aviso(t: String) -> void:
	if t.begins_with("Nível "):
		destaque_txt = t
		_destaque_t = 3.2
		return
	aviso_txt = t
	_aviso_t = 2.2

func _centro(b: Dictionary) -> Vector2:
	return _tela.size - b.canto + b.d

# onde o painel do herói está agora (o modo de edição pode ter mudado lugar e tamanho)
func painel_rect() -> Rect2:
	return Rect2(PAINEL.position + painel_d, PAINEL.size * painel_s)

func botao(acao: String) -> Dictionary:
	for b in botoes:
		if b.acao == acao:
			return b
	return {}

# muda lugar e tamanho de um botão (modo de edição)
func ajustar_botao(acao: String, d: Vector2, s: float) -> void:
	var b := botao(acao)
	if b.is_empty():
		return
	b.d = d
	b.s = s
	b.raio = float(b.raio0) * s

# o arco das skills ainda está no lugar de sempre? (a zona morta do arco só vale assim)
func _arco_padrao() -> bool:
	for i in 6:
		var b: Dictionary = botoes[1 + i]
		if b.d != Vector2.ZERO or b.s != 1.0:
			return false
	var g: Dictionary = botoes[7]
	return g.d == Vector2.ZERO and g.s == 1.0

func _input(ev: InputEvent) -> void:
	if editando: # o editor (editar_hud.gd) cuida do toque
		return
	if ev is InputEventScreenTouch and ev.index == _painel_dedo and not ev.pressed:
		_painel_dedo = -1 # soltou antes de abrir o modo de edição: toque curto abre o menu do personagem
		if not bloqueado:
			apertou.emit("menu")
		return
	if ev is InputEventScreenDrag and ev.index == _painel_dedo:
		if ev.position.distance_to(_painel_ini) > 30.0:
			_painel_dedo = -1 # arrastou para fora: não é toque nem segurar
		return
	if bloqueado:
		if not _toques.is_empty():
			soltar_tudo()
		return
	if ev is InputEventScreenTouch:
		if ev.pressed and menu_topo and menu_topo.cobre(ev.position):
			return
		if ev.pressed and minimapa and minimapa.cobre(ev.position): # tocar no minimapa abre o mapa (minimapa.gd)
			return
		if ev.pressed and construcao and construcao.cobre(ev.position): # barra do modo construção (construcao.gd)
			return
		if ev.pressed and troca and troca.cobre(ev.position): # cartão do pedido de troca (troca.gd)
			return
		if ev.pressed and painel_rect().has_point(ev.position):
			# toque curto abre o menu do personagem (ao soltar); segurar abre o modo de editar a interface
			_painel_dedo = ev.index
			_painel_t = 0.0
			_painel_ini = ev.position
			return
		if ev.pressed and modo_construcao and arrastar_terreno and construcao and ev.position.x >= _tela.size.x * 0.42 and not ("sel" in _toques.values()):
			_toques[ev.index] = "sel" # compra de terreno: este dedo marca o canto e arrasta até o outro
			construcao.arrasto(ev.position, 0)
			return
		if ev.pressed:
			for b in botoes:
				if not modo_construcao and not b.oculto and ev.position.distance_to(_centro(b)) <= b.raio * 1.15:
					_toques[ev.index] = b.acao
					b.apertado = true
					apertou.emit(b.acao)
					return
			# zona morta (André 2026-11-03): dedo perto das skills sem acertar o botão não vira câmera nem pinça
			if zona_morta(ev.position):
				_toques[ev.index] = "morto"
				return
			_inicio[ev.index] = [ev.position, Time.get_ticks_msec()]
			# lado esquerdo é sempre do joystick: a pinça do zoom só começa com os dois dedos no meio livre da tela
			# (antes um dedo na câmera fazia o toque no joystick virar pinça e o herói não andava)
			if ev.position.x < _tela.size.x * 0.42:
				_toques[ev.index] = "joy"
				_joy_centro = ev.position
				_joy_dedo = ev.position
			else:
				_toques[ev.index] = "cam"
				_cam_dedos[ev.index] = ev.position
				_pinca = _dist_pinca()
		else:
			if _cam_dedos.has(ev.index):
				_cam_dedos.erase(ev.index)
				_pinca = _dist_pinca()
			var o = _toques.get(ev.index)
			_toques.erase(ev.index)
			if o == "sel":
				if construcao:
					construcao.arrasto(ev.position, 2)
				return
			var ini = _inicio.get(ev.index)
			_inicio.erase(ev.index)
			if ini != null and (o == "joy" or o == "cam") and Time.get_ticks_msec() - int(ini[1]) < 350 and ev.position.distance_to(ini[0]) < 22.0:
				tocou.emit(ev.position)
			if o == "joy":
				mover = Vector2.ZERO
			elif o != null and o != "cam" and o != "morto" and not segurando(o): # outro dedo ainda no mesmo botão: continua apertado
				for b in botoes:
					if b.acao == o:
						b.apertado = false
				soltou.emit(o)
	elif ev is InputEventScreenDrag:
		var o = _toques.get(ev.index)
		if o == "sel":
			if construcao:
				construcao.arrasto(ev.position, 1)
		elif o == "joy":
			_joy_dedo = ev.position
			var d: Vector2 = (_joy_dedo - _joy_centro) / (JOY_RAIO * joy_s)
			mover = d.limit_length(1.0)
			if d.length() > 1.4: # o joystick vem atrás do dedo
				_joy_centro = _joy_dedo - d.normalized() * JOY_RAIO * joy_s * 1.4
		elif o == "cam":
			_cam_dedos[ev.index] = ev.position
			# pinça: zoom, sem girar. Com o joystick em uso nunca tem pinça: andar + dedo na câmera é sempre girar
			if _cam_dedos.size() >= 2 and not ("joy" in _toques.values()):
				var d := _dist_pinca()
				if _pinca > 0.0 and d > 0.0:
					zoom_cam *= _pinca / d
				_pinca = d
			else:
				giro_cam += ev.relative
				_pinca = _dist_pinca() # sem salto de zoom quando o joystick solta com dois dedos na câmera
	elif ev is InputEventMouseButton and ev.pressed:
		if ev.button_index == MOUSE_BUTTON_WHEEL_UP:
			zoom_cam *= 0.9
		elif ev.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			zoom_cam *= 1.0 / 0.9
	elif ev is InputEventMagnifyGesture: # touchpad do PC
		if ev.factor > 0.0:
			zoom_cam /= ev.factor

# zona morta em volta da HUD de combate: o arco das skills em volta do golpe e uma folga em volta de cada botão.
# Toque ali sem acertar o botão é ignorado (não gira a câmera, não entra na pinça, não rouba o joystick)
const FOLGA_BOTAO := 40.0 # px além do alvo do botão
const FOLGA_ARCO := 45.0 # px além da borda de fora do arco das skills
func zona_morta(p: Vector2) -> bool:
	if esconder_combate or modo_construcao:
		return false
	for b in botoes:
		if b.oculto:
			continue
		var c := _centro(b)
		if p.distance_to(c) <= b.raio * 1.15 + FOLGA_BOTAO:
			return true
		if b.acao == "basico" and _arco_padrao(): # o arco inteiro das skills (inclui os vãos entre elas)
			var v := p - c
			if v.length() <= 172.0 + 33.0 * 1.15 + FOLGA_ARCO and v.x <= 0.0 + b.raio and v.y <= b.raio:
				return true
	return false

# distância entre os dois primeiros dedos da câmera (0 se não tem dois)
func _dist_pinca() -> float:
	if _cam_dedos.size() < 2:
		return 0.0
	var v: Array = _cam_dedos.values()
	return (v[0] as Vector2).distance_to(v[1])

# o botão continua apertado só enquanto algum dedo está nele (o ataque básico repete só assim)
func segurando(acao: String) -> bool:
	for o in _toques.values():
		if o == acao:
			return true
	return false

# solta todos os dedos de uma vez, avisando cada botão (menu abriu, app saiu da tela, toque perdido)
func soltar_tudo() -> void:
	var tinha: Array = _toques.values()
	_painel_dedo = -1
	_toques.clear()
	_inicio.clear()
	_cam_dedos.clear()
	_pinca = 0.0
	mover = Vector2.ZERO
	for b in botoes:
		b.apertado = false
	for o in tinha:
		if o != "joy" and o != "cam" and o != "morto":
			soltou.emit(o)

# o Android às vezes não manda o "soltou" (notificação puxada, app minimizado, tela bloqueada): solta tudo
func _notification(what: int) -> void:
	if what in [NOTIFICATION_APPLICATION_FOCUS_OUT, NOTIFICATION_APPLICATION_PAUSED, NOTIFICATION_WM_WINDOW_FOCUS_OUT]:
		if not _toques.is_empty():
			soltar_tudo()

func _process(dt: float) -> void:
	if _painel_dedo >= 0:
		_painel_t += dt
		if _painel_t >= SEGURAR:
			_painel_dedo = -1
			if editor and not bloqueado:
				soltar_tudo()
				editor.abrir()
	if _aviso_t > 0:
		_aviso_t -= dt
	if _destaque_t > 0:
		_destaque_t -= dt
	if _dano_t > 0:
		_dano_t -= dt
	for b in botoes:
		if b.pronto_t > 0.0:
			b.pronto_t -= dt
		if b.nega_t > 0.0:
			b.nega_t -= dt
	# fade de 0,15 s da HUD de combate (janela do NPC)
	_combate.modulate.a = move_toward(_combate.modulate.a, 0.0 if (esconder_combate or caido) and not editando else 1.0, dt / (0.6 if caido else 0.15))
	_combate.visible = _combate.modulate.a > 0.0
	_tela.queue_redraw()
	_combate.queue_redraw()

# joystick e botões (num Control próprio, para sumir com fade quando a janela de um NPC abre)
func _desenhar_combate() -> void:
	var f := ThemeDB.fallback_font
	# joystick
	if _toques.values().has("joy"):
		desenhar_joystick(_combate, _joy_centro, mover)
	# botões
	for b in botoes:
		if (b.oculto or modo_construcao) and not editando: # no modo de edição aparecem todos (Coletar e Falar também)
			continue
		var c := _centro(b)
		if b.nega_t > 0.0: # tremidinha de "não deu"
			c.x += sin(b.nega_t * 90.0) * 5.0 * (b.nega_t / 0.25)
		var r: float = b.raio * (0.94 if b.apertado else 1.0)
		_combate.draw_circle(c + Vector2(0, 3), r, Color(0, 0, 0, 0.35))
		_combate.draw_circle(c, r, b.cor)
		var cor_borda: Color = COR_BORDA if b.cor == COR_FUNDO else b.cor.lightened(0.35)
		if b.borda != null:
			cor_borda = b.borda
		_combate.draw_circle(c, r, cor_borda, false, 2.5)
		var ligado: bool = b.get("ligado", false)
		if ligado: # disparada ligada (direção de arte): âmbar da estamina, pulso discreto de ~1,2 s (escala 1,00-1,04, anel 0,5-0,9)
			var pulso: float = 0.5 + 0.5 * sin(Time.get_ticks_msec() / 1000.0 * TAU / 1.2)
			r *= 1.0 + 0.04 * pulso
			_combate.draw_circle(c, r - 2.0, Color(0.93, 0.82, 0.32, 0.92))
			_combate.draw_circle(c, r - 1.0, Color("8a6a2a"), false, 2.5) # borda escura: o círculo não some no âmbar
			_combate.draw_circle(c, r + 3.0, Color(0.93, 0.82, 0.32, 0.5 + 0.4 * pulso), false, 2.0)
		var t := icone(b.icone)
		if t:
			var s := r * 1.15
			# ligado: ícone no marrom escuro do fundo, para não perder contraste no âmbar
			var cor_ico: Color = Color(0.1, 0.088, 0.072) if ligado else (Color(1, 1, 1, 0.3) if b.travado else Color.WHITE)
			_combate.draw_texture_rect(t, Rect2(c - Vector2(s, s) * 0.5, Vector2(s, s)), false, cor_ico)
		if b.travado: # ainda não liberada no nível do herói
			_combate.draw_circle(c, r, Color(0, 0, 0, 0.35))
		elif b.sem_mana and b.cd <= 0.0: # sem mana: apagado com véu azul
			_combate.draw_circle(c, r, Color(0.05, 0.1, 0.3, 0.55))
		if b.pronto_t > 0.0: # voltou a ficar pronta: anel que abre e some
			var k: float = 1.0 - b.pronto_t / 0.45
			_combate.draw_circle(c, r * (1.0 + 0.35 * k), Color(cor_borda.lightened(0.4), 0.85 * (1.0 - k)), false, 3.0)
		if b.cd > 0.0:
			var frac: float = b.cd / b.cd_max
			_combate.draw_arc(c, r * 0.5, -PI / 2, -PI / 2 + TAU * frac, 24, Color(0, 0, 0, 0.55), r, true)
			var txt := str(int(ceil(b.cd)))
			var w := f.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 20).x
			_combate.draw_string(f, c + Vector2(-w * 0.5, 7), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color.WHITE)

func desenhar_joystick(c: CanvasItem, centro: Vector2, dir: Vector2) -> void:
	c.draw_circle(centro, 96 * joy_s, Color(1, 1, 1, 0.12))
	c.draw_circle(centro, 96 * joy_s, Color(1, 1, 1, 0.25), false, 2.0)
	c.draw_circle(centro + dir * JOY_RAIO * joy_s, 40 * joy_s, Color(1, 1, 1, 0.55))

func _barra(pos: Vector2, tam: Vector2, frac: float, cor: Color, texto: String) -> void:
	_tela.draw_rect(Rect2(pos, tam), Color(0, 0, 0, 0.45))
	_tela.draw_rect(Rect2(pos, Vector2(tam.x * clamp(frac, 0.0, 1.0), tam.y)), cor)
	var f := ThemeDB.fallback_font
	var w := f.get_string_size(texto, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
	_tela.draw_string_outline(f, pos + Vector2((tam.x - w) * 0.5, tam.y - 4), texto, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, 3, Color(0, 0, 0, 0.7))
	_tela.draw_string(f, pos + Vector2((tam.x - w) * 0.5, tam.y - 4), texto, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color.WHITE)

# borda vermelha da tela: golpe recebido (forte e rápida) ou vida abaixo de 30% (fraca, pulsando)
func _borda_dano() -> void:
	var a: float = clamp(_dano_t / 0.35, 0.0, 1.0) * 0.45
	if vida < 0.3 and vida > 0.0:
		a = max(a, (0.3 - vida) / 0.3 * (0.16 + 0.08 * sin(Time.get_ticks_msec() / 1000.0 * 5.0)))
	if a <= 0.01:
		return
	var t := _tela.size
	var faixas := 10
	var larg: float = min(t.x, t.y) * 0.11
	for i in faixas:
		var k: float = 1.0 - float(i) / faixas
		var w: float = larg / faixas
		var c := Color(0.75, 0.02, 0.02, a * k * k)
		var o: float = w * i
		_tela.draw_rect(Rect2(o, o, t.x - o * 2.0, w), c)
		_tela.draw_rect(Rect2(o, t.y - o - w, t.x - o * 2.0, w), c)
		_tela.draw_rect(Rect2(o, o + w, w, t.y - (o + w) * 2.0), c)
		_tela.draw_rect(Rect2(t.x - o - w, o + w, w, t.y - (o + w) * 2.0), c)

func _desenhar() -> void:
	_borda_dano()
	var f := ThemeDB.fallback_font
	# painel do herói (lugar e tamanho do modo de edição: desenha em coordenadas próprias com escala)
	_tela.draw_set_transform(PAINEL.position + painel_d, 0.0, Vector2(painel_s, painel_s))
	var p0 := Vector2.ZERO
	_tela.draw_rect(Rect2(p0, PAINEL.size), Color(0.08, 0.07, 0.06, 0.74))
	_tela.draw_rect(Rect2(p0, PAINEL.size), Color(0.62, 0.48, 0.26, 0.55), false, 1.5)
	_retrato_heroi(p0 + Vector2(42, 42), 32.0)
	_selo_nivel(p0 + Vector2(68, 70))
	_tela.draw_string(f, p0 + Vector2(92, 24), nome.to_upper() + "   " + ("ESPADA MÁGICA" if modo == "Espada" else "MODO MAGIA"), HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(0.95, 0.75, 0.4))
	_barra(p0 + Vector2(92, 34), Vector2(225, 18), vida, Color(0.8, 0.22, 0.2), texto_vida)
	if escudo: # Escudo Arcano ligado: moldura dourada na vida
		_tela.draw_rect(Rect2(p0 + Vector2(90, 32), Vector2(229, 22)), Color(1, 0.8, 0.35, 0.9), false, 2.0)
	_barra(p0 + Vector2(92, 58), Vector2(225, 18), mana, Color(0.22, 0.45, 0.85), texto_mana)
	# estamina (amarela; sem fôlego fica ocre até voltar) e XP até o próximo nível (fina, embaixo)
	_tela.draw_rect(Rect2(p0 + Vector2(92, 80), Vector2(225, 7)), Color(0, 0, 0, 0.5))
	_tela.draw_rect(Rect2(p0 + Vector2(92, 80), Vector2(225 * clamp(estamina, 0.0, 1.0), 7)), Color(0.62, 0.48, 0.18) if sem_folego else Color(0.93, 0.82, 0.32))
	_tela.draw_rect(Rect2(p0 + Vector2(92, 90), Vector2(225, 4)), Color(0, 0, 0, 0.5))
	_tela.draw_rect(Rect2(p0 + Vector2(92, 90), Vector2(225 * clamp(xp, 0.0, 1.0), 4)), Color(0.85, 0.62, 0.95))
	_tela.draw_set_transform(Vector2.ZERO)
	if canal >= 0.0 and canal_vila: # Voltar para a vila: barra própria no meio da tela, acima dos botões (direção de arte)
		var tam := Vector2(280, 10)
		var pc := Vector2((_tela.size.x - tam.x) * 0.5, _tela.size.y * 0.3) # acima da cabeça (nos pés ela some no brilho do círculo)
		_tela.draw_rect(Rect2(pc - Vector2(4, 24), tam + Vector2(8, 28)), Color(0.03, 0.025, 0.02, 0.6)) # fundo escuro: lê contra qualquer luz
		_tela.draw_rect(Rect2(pc, tam), Color(0.05, 0.04, 0.03, 0.7))
		_tela.draw_rect(Rect2(pc, Vector2(tam.x * clamp(canal, 0.0, 1.0), tam.y)), Color(1.0, 0.78, 0.38))
		_tela.draw_rect(Rect2(pc - Vector2(1, 1), tam + Vector2(2, 2)), Color(0.925, 0.81, 0.55, 0.9), false, 1.0)
		var tv := "Voltando para a vila"
		var wv := f.get_string_size(tv, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
		_tela.draw_string_outline(f, Vector2((_tela.size.x - wv) * 0.5, pc.y - 6), tv, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, 4, Color(0, 0, 0, 0.6))
		_tela.draw_string(f, Vector2((_tela.size.x - wv) * 0.5, pc.y - 6), tv, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(1, 0.9, 0.68))
	elif canal >= 0.0: # concentrando a magia
		var tam := Vector2(240, 10)
		var pc := Vector2((_tela.size.x - tam.x) * 0.5, _tela.size.y - 150)
		_tela.draw_rect(Rect2(pc - Vector2(2, 2), tam + Vector2(4, 4)), Color(0, 0, 0, 0.55))
		_tela.draw_rect(Rect2(pc, Vector2(tam.x * clamp(canal, 0.0, 1.0), tam.y)), Color(0.75, 0.55, 1.0))
		_tela.draw_rect(Rect2(pc - Vector2(2, 2), tam + Vector2(4, 4)), COR_BORDA, false, 1.5)
	if _aviso_t > 0:
		var w := f.get_string_size(aviso_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 22).x
		var a: float = clamp(_aviso_t, 0.0, 1.0)
		_tela.draw_string_outline(f, Vector2((_tela.size.x - w) * 0.5, 150), aviso_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, 5, Color(0, 0, 0, 0.6 * a))
		_tela.draw_string(f, Vector2((_tela.size.x - w) * 0.5, 150), aviso_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color(1, 0.92, 0.7, a))
	if _destaque_t > 0:
		var tam := 40
		var wd := f.get_string_size(destaque_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, tam).x
		var ad: float = clamp(_destaque_t / 0.6, 0.0, 1.0) * clamp((3.2 - _destaque_t) / 0.15, 0.0, 1.0)
		var pd := Vector2((_tela.size.x - wd) * 0.5, _tela.size.y * 0.36)
		_tela.draw_string_outline(f, pd, destaque_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, 10, Color(0.16, 0.08, 0.0, 0.85 * ad))
		_tela.draw_string(f, pd, destaque_txt, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, Color(1.0, 0.8, 0.3, ad))

# rosto do herói no círculo do painel (André 2026-11-06: "a foto do meu avatar, e não essa letra"); sem palco, a letra
func _retrato_heroi(c: Vector2, r: float) -> void:
	_tela.draw_circle(c, r + 1.0, Color(0.16, 0.13, 0.1))
	if retrato:
		var pts := PackedVector2Array()
		var uvs := PackedVector2Array()
		for i in 40:
			var a := TAU * i / 40.0
			var v := Vector2(cos(a), sin(a))
			pts.append(c + v * r)
			uvs.append(Vector2(0.5, 0.5) + v * 0.5)
		_tela.draw_colored_polygon(pts, Color.WHITE, uvs, retrato)
		_tela.draw_circle(c, r - 1.0, Color(0, 0, 0, 0.35), false, 3.0) # sombra por dentro da moldura
	else:
		_tela.draw_circle(c, r, Color(0.85, 0.42, 0.3))
		var f := ThemeDB.fallback_font
		_tela.draw_string(f, c + Vector2(-14, 10), nome.substr(0, 1), HORIZONTAL_ALIGNMENT_LEFT, -1, 30, Color.WHITE)
	_tela.draw_circle(c, r, Color(0.9, 0.75, 0.4), false, 3.0)
	_tela.draw_circle(c, r + 2.5, Color(0.35, 0.24, 0.1, 0.8), false, 1.5)

# selo do nível: medalhão dourado com brilho que respira, número grande (antes era uma bolinha quase escondida)
func _selo_nivel(c: Vector2) -> void:
	var t: float = relogio_teste if relogio_teste >= 0.0 else Time.get_ticks_msec() / 1000.0
	var pulso: float = 0.5 + 0.5 * sin(t * TAU / 2.7) # um ciclo de 2,7 s, suave, sem piscar (direção de arte)
	for i in 5: # halo dourado macio
		var k := float(i) / 5.0
		_tela.draw_circle(c, 17.0 + 9.0 * (1.0 - k), Color(1.0, 0.78, 0.3, (0.05 + 0.05 * pulso) * (k + 0.2)))
	_tela.draw_circle(c + Vector2(0, 2), 16.0, Color(0, 0, 0, 0.45))
	_tela.draw_circle(c, 16.0, Color(0.42, 0.2, 0.08)) # fundo cobre escuro
	_tela.draw_circle(c, 13.0, Color(0.62, 0.32, 0.1))
	_tela.draw_circle(c + Vector2(-3, -4), 7.0, Color(1.0, 0.75, 0.4, 0.22)) # reflexo em cima
	_tela.draw_circle(c, 16.0, Color(1.0, 0.84, 0.45), false, 2.5)
	_tela.draw_circle(c, 12.5, Color(0.98, 0.78, 0.38, 0.55), false, 1.0)
	var tn := str(nivel)
	var tam := 19 if tn.length() < 3 else 15
	var fn: Font = fonte if fonte else ThemeDB.fallback_font
	var sz := fn.get_string_size(tn, HORIZONTAL_ALIGNMENT_LEFT, -1, tam)
	var pos := c + Vector2(-sz.x * 0.5, sz.y * 0.32)
	_tela.draw_string_outline(fn, pos, tn, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, 4, Color(0.2, 0.08, 0.0, 0.9))
	_tela.draw_string(fn, pos, tn, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, Color(1.0, 0.95, 0.75).lerp(Color(1.0, 1.0, 0.9), pulso * 0.5))

extends CanvasLayer
# HUD do celular, no mesmo arranjo do jogo HTML: joystick que aparece onde o dedo toca (esquerda),
# golpe grande embaixo à direita, as 4 habilidades do modo em coluna ao lado, Trocar em cima, Cura embaixo
# e Rolar, Dash e Pular na fileira de baixo. Painel do herói em cima à esquerda. Os botões só mostram símbolos.
# Todo toque passa por aqui (vários dedos ao mesmo tempo): botão, joystick ou câmera.

signal apertou(acao: String) # "basico", "hab0".."hab5", "cura", "troca", "pular", "dash", "rolar", "loja", "menu" (toque no painel do herói)
signal soltou(acao: String)

const COR_FUNDO := Color(0.1, 0.088, 0.072, 0.9)
const COR_BORDA := Color(0.72, 0.57, 0.32, 0.9) # dourado discreto, igual ao menu do personagem
const COR_GOLPE := Color(0.33, 0.16, 0.12, 0.95)
const COR_TROCA := Color(0.33, 0.24, 0.12, 0.95)
const COR_CURA := Color(0.12, 0.3, 0.2, 0.95)

var mover := Vector2.ZERO # joystick (-1..1)
const JOY_RAIO := 90.0 # px do centro até a borda: andar até a metade, correr no fim (era 60, curto demais)
var giro_cam := Vector2.ZERO # quanto o dedo da câmera andou neste quadro
var botoes: Array = [] # {acao, centro (a partir do canto de baixo à direita), raio, icone, cor, cd, cd_max}
var _toques := {} # índice do dedo -> "joy" | "cam" | acao
var _joy_centro := Vector2.ZERO
var _joy_dedo := Vector2.ZERO
var _tela: Control
var _painel: Control
var vida := 1.0
var mana := 1.0
var texto_vida := ""
var texto_mana := ""
var nome := "Ruiva"
var nivel := 1
var xp := 0.0 # 0..1 até o próximo nível
var escudo := false
var canal := -1.0 # magia concentrada: 0..1 (barra no meio da tela); -1 = nenhuma
var bloqueado := false # menu do personagem aberto: a tela de jogo não recebe toque
const PAINEL := Rect2(18, 14, 330, 92) # tocar aqui abre o menu do personagem
var modo := "Espada"
var _icones := {}
var aviso_txt := ""
var _aviso_t := 0.0

func _ready() -> void:
	_tela = Control.new()
	_tela.set_anchors_preset(Control.PRESET_FULL_RECT)
	_tela.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_tela.draw.connect(_desenhar)
	add_child(_tela)
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
	_botao("loja", Vector2(333, 160), 30, "loja", COR_TROCA) # só aparece perto da Rosa (a comerciante)
	botoes[-1].oculto = true

func _botao(acao: String, canto: Vector2, raio: float, icone: String, cor: Color) -> void:
	botoes.append({"acao": acao, "canto": canto, "raio": raio, "icone": icone, "cor": cor, "cd": 0.0, "cd_max": 1.0, "apertado": false, "travado": false, "oculto": false})

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

func mostrar_build(icones_modo: Array, modo_atual: String, travados: Array = []) -> void:
	modo = modo_atual
	for i in 6:
		botoes[1 + i].icone = icones_modo[i]
		botoes[1 + i].travado = travados[i] if i < travados.size() else false
	botoes[7].icone = "basico" if modo == "Espada" else "magia"

func recarga(acao: String, falta: float, total: float) -> void:
	for b in botoes:
		if b.acao == acao:
			b.cd = falta
			b.cd_max = max(total, 0.01)

func aviso(t: String) -> void:
	aviso_txt = t
	_aviso_t = 2.2

func _centro(b: Dictionary) -> Vector2:
	return _tela.size - b.canto

func _input(ev: InputEvent) -> void:
	if bloqueado:
		if not _toques.is_empty():
			_toques.clear()
			mover = Vector2.ZERO
			for b in botoes:
				b.apertado = false
		return
	if ev is InputEventScreenTouch:
		if ev.pressed and PAINEL.has_point(ev.position):
			apertou.emit("menu")
			return
		if ev.pressed:
			for b in botoes:
				if not b.oculto and ev.position.distance_to(_centro(b)) <= b.raio * 1.15:
					_toques[ev.index] = b.acao
					b.apertado = true
					apertou.emit(b.acao)
					return
			if ev.position.x < _tela.size.x * 0.42:
				_toques[ev.index] = "joy"
				_joy_centro = ev.position
				_joy_dedo = ev.position
			else:
				_toques[ev.index] = "cam"
		else:
			var o = _toques.get(ev.index)
			_toques.erase(ev.index)
			if o == "joy":
				mover = Vector2.ZERO
			elif o != null and o != "cam":
				for b in botoes:
					if b.acao == o:
						b.apertado = false
				soltou.emit(o)
	elif ev is InputEventScreenDrag:
		var o = _toques.get(ev.index)
		if o == "joy":
			_joy_dedo = ev.position
			var d: Vector2 = (_joy_dedo - _joy_centro) / JOY_RAIO
			mover = d.limit_length(1.0)
			if d.length() > 1.4: # o joystick vem atrás do dedo
				_joy_centro = _joy_dedo - d.normalized() * JOY_RAIO * 1.4
		elif o == "cam":
			giro_cam += ev.relative

func _process(dt: float) -> void:
	if _aviso_t > 0:
		_aviso_t -= dt
	_tela.queue_redraw()

func _barra(pos: Vector2, tam: Vector2, frac: float, cor: Color, texto: String) -> void:
	_tela.draw_rect(Rect2(pos, tam), Color(0, 0, 0, 0.45))
	_tela.draw_rect(Rect2(pos, Vector2(tam.x * clamp(frac, 0.0, 1.0), tam.y)), cor)
	var f := ThemeDB.fallback_font
	var w := f.get_string_size(texto, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
	_tela.draw_string_outline(f, pos + Vector2((tam.x - w) * 0.5, tam.y - 4), texto, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, 3, Color(0, 0, 0, 0.7))
	_tela.draw_string(f, pos + Vector2((tam.x - w) * 0.5, tam.y - 4), texto, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color.WHITE)

func _desenhar() -> void:
	var f := ThemeDB.fallback_font
	# painel do herói
	var p0 := Vector2(18, 14)
	_tela.draw_rect(Rect2(p0, PAINEL.size), Color(0.08, 0.07, 0.06, 0.74))
	_tela.draw_rect(Rect2(p0, PAINEL.size), Color(0.62, 0.48, 0.26, 0.55), false, 1.5)
	_tela.draw_circle(p0 + Vector2(42, 42), 32, Color(0.85, 0.42, 0.3))
	_tela.draw_circle(p0 + Vector2(42, 42), 32, Color(0.9, 0.75, 0.4), false, 3.0)
	_tela.draw_string(f, p0 + Vector2(28, 52), nome.substr(0, 1), HORIZONTAL_ALIGNMENT_LEFT, -1, 30, Color.WHITE)
	_tela.draw_circle(p0 + Vector2(66, 66), 12, Color(0.85, 0.6, 0.2))
	var tn := str(nivel)
	var wn := f.get_string_size(tn, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
	_tela.draw_string(f, p0 + Vector2(66 - wn * 0.5, 71), tn, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(0.15, 0.1, 0.05))
	_tela.draw_string(f, p0 + Vector2(92, 24), nome.to_upper() + "   " + ("ESPADA MÁGICA" if modo == "Espada" else "MODO MAGIA"), HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color(0.95, 0.75, 0.4))
	_barra(p0 + Vector2(92, 34), Vector2(225, 18), vida, Color(0.8, 0.22, 0.2), texto_vida)
	if escudo: # Escudo Arcano ligado: moldura dourada na vida
		_tela.draw_rect(Rect2(p0 + Vector2(90, 32), Vector2(229, 22)), Color(1, 0.8, 0.35, 0.9), false, 2.0)
	_barra(p0 + Vector2(92, 58), Vector2(225, 18), mana, Color(0.22, 0.45, 0.85), texto_mana)
	# XP até o próximo nível (fina, embaixo)
	_tela.draw_rect(Rect2(p0 + Vector2(92, 82), Vector2(225, 5)), Color(0, 0, 0, 0.5))
	_tela.draw_rect(Rect2(p0 + Vector2(92, 82), Vector2(225 * clamp(xp, 0.0, 1.0), 5)), Color(0.95, 0.75, 0.35))
	# joystick
	if _toques.values().has("joy"):
		_tela.draw_circle(_joy_centro, 96, Color(1, 1, 1, 0.12))
		_tela.draw_circle(_joy_centro, 96, Color(1, 1, 1, 0.25), false, 2.0)
		_tela.draw_circle(_joy_centro + mover * JOY_RAIO, 40, Color(1, 1, 1, 0.55))
	# botões
	for b in botoes:
		if b.oculto:
			continue
		var c := _centro(b)
		var r: float = b.raio * (0.94 if b.apertado else 1.0)
		_tela.draw_circle(c + Vector2(0, 3), r, Color(0, 0, 0, 0.35))
		_tela.draw_circle(c, r, b.cor)
		_tela.draw_circle(c, r, COR_BORDA if b.cor == COR_FUNDO else b.cor.lightened(0.35), false, 2.5)
		var t := icone(b.icone)
		if t:
			var s := r * 1.15
			_tela.draw_texture_rect(t, Rect2(c - Vector2(s, s) * 0.5, Vector2(s, s)), false, Color(1, 1, 1, 0.3) if b.travado else Color.WHITE)
		if b.travado: # ainda não liberada no nível do herói
			_tela.draw_circle(c, r, Color(0, 0, 0, 0.35))
		if b.cd > 0.0:
			var frac: float = b.cd / b.cd_max
			_tela.draw_arc(c, r * 0.5, -PI / 2, -PI / 2 + TAU * frac, 24, Color(0, 0, 0, 0.55), r, true)
			var txt := str(int(ceil(b.cd)))
			var w := f.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 20).x
			_tela.draw_string(f, c + Vector2(-w * 0.5, 7), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color.WHITE)
	if canal >= 0.0: # concentrando a magia
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

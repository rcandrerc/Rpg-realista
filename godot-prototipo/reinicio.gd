extends CanvasLayer
# Aviso de reinício do servidor (André 2026-11-12: "um aviso na tela, em cima, meio grande. Toda vez que fosse entrar um
# merge... aparecer uma contagem, servidor está reiniciando em 10, 9, 8"; e depois: "primeiro o servidor reiniciará em um
# minuto, e depois uma contagem de 10 segundos", para ninguém entrar numa dungeon e levar a contagem de surpresa).
# O servidor (server/index.js, reiniciarComAviso) manda {t:'reinicio', s: segundos} a cada 10 s e no começo da contagem;
# aqui o celular conta sozinho entre um e outro. Duas fases, as duas no alto da tela:
#  - faltando mais que CONTAGEM: faixa "o servidor vai reiniciar em 1 minuto" que fica uns segundos e some (volta a cada 30 s);
#  - faltando CONTAGEM ou menos: faixa maior com o número grande pulsando a cada segundo; no 0 vira "Reiniciando…" e fica
#    até a conexão voltar (online.gd espera mais que os 5 s normais quando sabe que é reinício).
# Desempenho (Poco X7): um Control só desenhado por _draw, redesenhado só enquanto tem faixa na tela; sem reinício
# marcado não tem _process.

const CONTAGEM := 10 # REINICIO.contagem (shared/dados.js)
const AVISO_DUR := 6.0 # segundos que a faixa de 1 minuto fica na tela
const AVISO_DE_NOVO := 30.0 # mostra de novo se ainda faltar bastante (quem não viu a primeira)
const ESPERA_MAX := 90.0 # depois do 0, desiste da faixa "Reiniciando…" se a conexão não voltar
const FUNDO := Color(0.03, 0.05, 0.10)
const ALERTA := Color("ffb04a") # laranja de aviso (não é festa)
const CLARO := Color("fff1d6")
const TOPO := 10.0

var m # main.gd
var fonte: Font
var fonte_m: Font
var _tela: Control
var _sb: StyleBoxFlat
var _falta := -1.0 # segundos até o reinício (-1 = nada)
var _aviso_t := -1.0 # tempo de tela da faixa de 1 minuto (-1 = escondida)
var _ultimo_aviso := -999.0 # _falta quando a faixa de 1 minuto apareceu
var _num := -1 # número mostrado na contagem (para o pulso)
var _pulso := 0.0
var _entra := 0.0 # 0..1 animação de entrada da faixa grande
var _depois := 0.0 # segundos desde o 0
var _desenhado := false

func _init(principal) -> void:
	m = principal
	layer = 24 # acima da festa (23) e do menu (20): aparece até com o menu aberto

func _ready() -> void:
	fonte = load("res://fontes/AlegreyaSans-Bold.ttf")
	fonte_m = load("res://fontes/AlegreyaSans-Medium.ttf")
	_sb = StyleBoxFlat.new()
	_sb.set_corner_radius_all(16)
	_sb.anti_aliasing = true
	_tela = Control.new()
	_tela.set_anchors_preset(Control.PRESET_FULL_RECT)
	_tela.mouse_filter = Control.MOUSE_FILTER_IGNORE # nunca rouba toque
	_tela.draw.connect(_desenhar)
	add_child(_tela)
	set_process(false)

# online.gd: chegou {t:'reinicio', s}
func do_servidor(s: int) -> void:
	var antes := _falta
	_falta = float(max(s, 0))
	_depois = 0.0
	if _falta > CONTAGEM:
		if antes < 0.0 or _ultimo_aviso - _falta >= AVISO_DE_NOVO or antes <= 0.0:
			_aviso_t = 0.0
			_ultimo_aviso = _falta
	elif antes < 0.0 or antes > CONTAGEM:
		_comeca_contagem()
	set_process(true)
	_tela.queue_redraw()

# online.gd: a conexão caiu ou voltou
func esperado() -> bool: # sabe que o servidor está reiniciando (a queda espera mais)
	return _falta >= 0.0 and _falta <= CONTAGEM + 2.0

func voltou() -> void: # entrou de novo no servidor: some tudo
	_falta = -1.0
	_aviso_t = -1.0
	_ultimo_aviso = -999.0
	_num = -1
	set_process(false)
	_tela.queue_redraw()

func _comeca_contagem() -> void:
	_aviso_t = -1.0
	_entra = 0.0
	_num = -1
	if m.has_method("vibrar"):
		m.vibrar(60)

func _process(dt: float) -> void:
	if _falta < 0.0:
		set_process(false)
		return
	var antes := _falta
	_falta = max(_falta - dt, 0.0)
	if antes > CONTAGEM and _falta <= CONTAGEM:
		_comeca_contagem()
	if _aviso_t >= 0.0:
		_aviso_t += dt
		if _aviso_t > AVISO_DUR:
			_aviso_t = -1.0
	if _falta <= CONTAGEM:
		_entra = min(_entra + dt * 4.0, 1.0)
		var n := int(ceil(_falta))
		if n != _num:
			_num = n
			_pulso = 1.0
		_pulso = max(_pulso - dt * 3.0, 0.0)
		if _falta <= 0.0:
			_depois += dt
			if _depois > ESPERA_MAX:
				voltou()
				return
	elif _aviso_t < 0.0:
		if _desenhado:
			_desenhado = false
			_tela.queue_redraw() # some a faixa; até a contagem só conta o tempo (sem redesenhar)
		return
	_desenhado = true
	_tela.queue_redraw()

func _painel(r: Rect2, a: float) -> void:
	_sb.bg_color = Color(FUNDO, 0.9 * a)
	_sb.border_color = Color(ALERTA, 0.95 * a)
	_sb.set_border_width_all(2)
	_sb.shadow_color = Color(ALERTA, 0.22 * a)
	_sb.shadow_size = 10
	_tela.draw_style_box(_sb, r)

func _texto(s: String, centro_x: float, base_y: float, tam: int, cor: Color, f: Font = null) -> void:
	var fo: Font = f if f else fonte
	var w := fo.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, tam).x
	var p := Vector2(centro_x - w * 0.5, base_y)
	_tela.draw_string_outline(fo, p, s, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, 4, Color(0.0, 0.02, 0.06, 0.85 * cor.a))
	_tela.draw_string(fo, p, s, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, cor)

func _desenhar() -> void:
	if _falta < 0.0:
		return
	var tam := _tela.size
	var cx := tam.x * 0.5
	if _falta > CONTAGEM:
		if _aviso_t < 0.0:
			return
		# faixa de 1 minuto: desce, fica, sobe
		var a: float = clamp(min(_aviso_t / 0.3, (AVISO_DUR - _aviso_t) / 0.4), 0.0, 1.0)
		var w: float = min(460.0, tam.x - 32.0)
		var y := TOPO - (1.0 - a) * 20.0
		var r := Rect2(cx - w * 0.5, y, w, 62.0)
		_painel(r, a)
		var seg := int(ceil(_falta))
		var quando := "em 1 minuto" if seg >= 50 else "em %d segundos" % seg
		_texto("AVISO DO SERVIDOR", cx, y + 22.0, 15, Color(ALERTA, a))
		_texto("O servidor vai reiniciar %s" % quando, cx, y + 48.0, 22, Color(CLARO, a))
		return
	# contagem grande
	var e := _entra
	var w2: float = min(520.0, tam.x - 32.0)
	var h := 112.0
	var y2 := TOPO - (1.0 - e) * 30.0
	var r2 := Rect2(cx - w2 * 0.5, y2, w2, h)
	_painel(r2, e)
	if _falta > 0.0:
		_texto("SERVIDOR REINICIANDO EM", cx, y2 + 26.0, 18, Color(ALERTA, e))
		var esc := 1.0 + 0.35 * _pulso * _pulso
		var t_num := int(54.0 * esc)
		_texto(str(_num), cx, y2 + 70.0 + (t_num - 54) * 0.35, t_num, Color(CLARO, e))
		_texto("Seu progresso fica salvo. O jogo volta sozinho.", cx, y2 + 100.0, 16, Color(CLARO, 0.8 * e), fonte_m)
	else:
		var pontos := ".".repeat(1 + int(_depois * 2.0) % 3)
		_texto("SERVIDOR REINICIANDO", cx, y2 + 26.0, 18, Color(ALERTA, e))
		_texto("Voltando" + pontos, cx, y2 + 70.0, 34, Color(CLARO, e))
		_texto("Seu progresso fica salvo. Não precisa sair do jogo.", cx, y2 + 100.0, 16, Color(CLARO, 0.8 * e), fonte_m)

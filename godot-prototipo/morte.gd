extends CanvasLayer
const Idioma = preload("res://idioma.gd") # inglês (idioma.gd): texto montado também sai traduzido
# Sensação de estar morrendo e de morrer (pedido do André, 2026-11-05: "morro do nada e simplesmente volto na vila").
# Tudo é só visual e som no aparelho: quem decide a vida e a hora de levantar continua sendo main.gd (offline) e o
# servidor (online). Este arquivo só olha h.vida e h.morto a cada quadro.
#
# Vida baixa (abaixo de 35%), cada vez mais forte quanto menos vida sobra:
# - bordas da tela vermelhas que pulsam junto com o coração (por cima da borda vermelha que a HUD já tinha);
# - batida do coração ("tum-tum") cada vez mais rápida, com uma vibração leve quando está bem no fim;
# - o mundo vai perdendo a cor e o som fica abafado, como quem está quase apagando.
# Morreu:
# - câmera lenta curtinha, tranco na câmera, vibração forte e um baque grave;
# - a cor some de vez, o vermelho fecha as bordas e o coração dá as duas últimas batidas, devagar;
# - o corpo cai no chão (main.gd corpo_caido) e tudo escurece aos poucos até o preto;
#   o texto "VOCÊ CAIU" ficou desligado (MOSTRAR_TEXTO): o André não gostou (2026-11-05), quer só cair e escurecer;
# - os botões de luta somem enquanto está caído;
# - ao levantar na vila, a tela clareia devagar, a cor e o som voltam e sai um brilho de cura em volta do herói.

const LIMIAR := 0.35 # fração da vida em que começa
const MOSTRAR_TEXTO := false # "VOCÊ CAIU" / "Voltando para a vila..." no meio da tela
const TITULO_EM := 0.9 # s depois de cair: o "VOCÊ CAIU" começa a aparecer
const PRETO_DE := 2.2 # s: começa a escurecer (dá tempo de ver o corpo chegar no chão)...
const PRETO_ATE := 3.4 # ...e está tudo preto (o herói levanta em 3,5 s de jogo)
const VOLTA_DUR := 1.2 # s para clarear depois de levantar
const SAT_MORTO := 0.0 # sem cor nenhuma
const CORTE_ABERTO := 20500.0 # Hz: filtro desligado
const CORTE_BAIXA := 2200.0 # vida no fim: som abafado
const CORTE_MORTO := 380.0 # caído: quase só o grave

var m # main.gd
var _env: Environment
var _sat_base := 1.0
var _veu: ColorRect # bordas vermelhas e o escuro (shader)
var _mat: ShaderMaterial
var _preto: ColorRect
var _titulo: Label
var _sub: Label
var _filtro: AudioEffectLowPassFilter
var _filtro_i := -1
var _corte := CORTE_ABERTO

var _baixa := 0.0 # 0..1, suavizado: quanto a vida está baixa
var _morto_t := -1.0 # s de verdade desde que caiu (-1 = vivo)
var _volta_t := -1.0 # s desde que levantou (-1 = nada para clarear)
var _bate_em := 0.0 # s até a próxima batida do coração
var _batidas_finais := 0 # depois de cair o coração ainda bate duas vezes, devagar
var _pulso := 0.0 # 1 na batida, cai rápido
var _flash := 0.0 # clarão vermelho do golpe que matou
var _sat := 1.0
var _sat_caiu := 1.0 # a cor que tinha quando caiu (some a partir dela, sem voltar a ficar viva antes)
var _escuro := 0.0 # quanto o véu fecha para o preto nas bordas

const SHADER := """
shader_type canvas_item;
uniform float vermelho = 0.0; // 0..1 bordas vermelhas
uniform float escuro = 0.0; // 0..1 as bordas fecham para o preto
uniform float pulso = 0.0; // batida do coração: o vermelho avança um pouco
uniform float flash = 0.0; // clarão vermelho na tela toda
void fragment() {
	vec2 p = UV - 0.5; // elipse do tamanho da tela: meio = 0, borda do meio = 0,5, canto = 0,7
	float d = length(p);
	float dentro = mix(0.52, 0.27, vermelho) - escuro * 0.2 - pulso * 0.045; // onde o vermelho começa
	float borda = smoothstep(dentro, dentro + 0.34, d);
	vec3 cor = mix(vec3(0.5, 0.0, 0.03), vec3(0.03, 0.0, 0.0), escuro);
	float a = borda * clamp(vermelho * (0.78 + pulso * 0.22) + escuro, 0.0, 1.0);
	a = max(a, flash * 0.3);
	cor = mix(cor, vec3(0.62, 0.02, 0.02), flash * (1.0 - borda));
	COLOR = vec4(cor, clamp(a, 0.0, 0.97));
}
"""

func _init(principal) -> void:
	m = principal
	layer = 4 # acima da HUD (1), do minimapa (3) e junto do menu do topo; abaixo da tela de login (5)

func _achar_ambiente() -> void:
	for c in m.get_children():
		if c is WorldEnvironment and c.environment:
			_env = c.environment
			_sat_base = _env.adjustment_saturation
			_sat = _sat_base

func _ready() -> void:
	_achar_ambiente()
	var raiz := Control.new()
	raiz.set_anchors_preset(Control.PRESET_FULL_RECT)
	raiz.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(raiz)
	var sh := Shader.new()
	sh.code = SHADER
	_mat = ShaderMaterial.new()
	_mat.shader = sh
	_veu = ColorRect.new()
	_veu.material = _mat
	_veu.set_anchors_preset(Control.PRESET_FULL_RECT)
	_veu.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_veu.visible = false
	raiz.add_child(_veu)
	_preto = ColorRect.new()
	_preto.color = Color(0, 0, 0, 0)
	_preto.set_anchors_preset(Control.PRESET_FULL_RECT)
	_preto.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_preto.visible = false
	raiz.add_child(_preto)
	var fonte := FontVariation.new()
	fonte.base_font = load("res://fontes/AlegreyaSans-Bold.ttf")
	fonte.spacing_glyph = 7 # letras espaçadas, como nos jogos de ação
	_titulo = _texto(raiz, "VOCÊ CAIU", fonte, 70, Color(0.78, 0.12, 0.08), -24.0)
	_sub = _texto(raiz, "Voltando para a vila...", load("res://fontes/AlegreyaSans-Bold.ttf"), 24, Color(0.86, 0.8, 0.7), 46.0)
	# som abafado: filtro no barramento principal (fica desligado enquanto a vida está boa)
	_filtro = AudioEffectLowPassFilter.new()
	_filtro.cutoff_hz = CORTE_ABERTO
	_filtro_i = AudioServer.get_bus_effect_count(0)
	AudioServer.add_bus_effect(0, _filtro, _filtro_i)
	AudioServer.set_bus_effect_enabled(0, _filtro_i, false)

func _texto(pai: Control, t: String, fonte: Font, tam: int, cor: Color, y: float) -> Label:
	var l := Label.new()
	l.text = Idioma.frase(t)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.set_anchors_preset(Control.PRESET_FULL_RECT)
	l.offset_top = y
	l.offset_bottom = y
	l.add_theme_font_override("font", fonte)
	l.add_theme_font_size_override("font_size", tam)
	l.add_theme_color_override("font_color", cor)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	l.add_theme_constant_override("outline_size", max(4, tam / 9))
	l.add_theme_color_override("font_shadow_color", Color(0.3, 0, 0, 0.6))
	l.add_theme_constant_override("shadow_offset_y", 3)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.modulate.a = 0.0
	l.visible = false
	pai.add_child(l)
	return l

func caido() -> bool:
	return _morto_t >= 0.0

func _process(dt: float) -> void:
	var t0_parte := Time.get_ticks_usec()
	_process_parte(dt)
	if Time.get_ticks_usec() - t0_parte >= 1000 and Engine.has_meta("lentidao"): # quadro lento (lentidao.gd)
		Engine.get_meta("lentidao").ev("morte", t0_parte)

func _process_parte(dt: float) -> void:
	if m.P == null or m.P.st == null:
		return
	if _env == null:
		_achar_ambiente()
	var dr: float = min(0.1, dt / max(Engine.time_scale, 0.001)) # tempo de verdade (a câmera lenta não segura isto)
	var morto: bool = m.h.morto > 0.0
	if morto and _morto_t < 0.0:
		_caiu()
	elif not morto and _morto_t >= 0.0:
		_levantou()
	var vmax: float = max(1.0, float(m.P.st.vidaMax))
	var frac: float = clamp(float(m.h.vida) / vmax, 0.0, 1.0)
	var quer: float = 0.0 if morto else clamp((LIMIAR - frac) / (LIMIAR - 0.05), 0.0, 1.0)
	if frac >= LIMIAR:
		quer = 0.0
	_baixa = move_toward(_baixa, quer, dr * (1.5 if quer > _baixa else 0.8))
	_pulso = move_toward(_pulso, 0.0, dr * 3.2)
	_flash = move_toward(_flash, 0.0, dr * 3.0)
	_coracao(dr, morto)
	var vermelho: float = _baixa * 0.85
	var escuro := 0.0
	var sat_alvo: float = lerp(_sat_base, 0.3, _baixa * 0.75)
	var corte: float = CORTE_ABERTO if _baixa <= 0.01 else lerp(9000.0, CORTE_BAIXA, _baixa)
	var preto := 0.0
	var tit := 0.0
	var sub := 0.0
	if _morto_t >= 0.0:
		_morto_t += dr
		var k: float = smoothstep(0.0, 0.7, _morto_t)
		vermelho = max(vermelho, k)
		escuro = smoothstep(0.6, PRETO_DE + 0.6, _morto_t) * 0.8
		sat_alvo = lerp(_sat_caiu, SAT_MORTO, smoothstep(0.0, 1.4, _morto_t))
		corte = lerp(2600.0, CORTE_MORTO, smoothstep(0.0, 1.2, _morto_t))
		preto = smoothstep(PRETO_DE, PRETO_ATE, _morto_t)
		tit = smoothstep(TITULO_EM, TITULO_EM + 0.8, _morto_t)
		sub = smoothstep(TITULO_EM + 0.6, TITULO_EM + 1.3, _morto_t)
		_titulo.scale = Vector2.ONE * lerp(0.92, 1.0, tit)
		_sat = sat_alvo
	elif _volta_t >= 0.0:
		_volta_t += dr
		var v: float = clamp(_volta_t / VOLTA_DUR, 0.0, 1.0)
		var sai: float = 1.0 - smoothstep(0.0, 1.0, v)
		preto = sai
		escuro = sai * 0.8
		vermelho = max(vermelho, sai)
		tit = 1.0 - smoothstep(0.0, 0.45, _volta_t)
		sub = tit
		corte = lerp(CORTE_MORTO, corte, smoothstep(0.0, 1.0, v))
		_sat = lerp(SAT_MORTO, sat_alvo, smoothstep(0.1, 1.0, v))
		if _volta_t >= VOLTA_DUR:
			_volta_t = -1.0
	else:
		_sat = move_toward(_sat, sat_alvo, dr * 0.9)
	if _env:
		_env.adjustment_saturation = _sat
	_mat.set_shader_parameter("vermelho", vermelho)
	_mat.set_shader_parameter("escuro", escuro)
	_mat.set_shader_parameter("pulso", _pulso * (1.0 if _morto_t < 0.0 else 0.5))
	_mat.set_shader_parameter("flash", _flash)
	_veu.visible = vermelho > 0.005 or escuro > 0.005 or _flash > 0.005
	_preto.color.a = preto
	_preto.visible = preto > 0.003
	if not MOSTRAR_TEXTO:
		tit = 0.0
		sub = 0.0
	_titulo.modulate.a = tit
	_titulo.visible = tit > 0.003
	_sub.modulate.a = sub * 0.9
	_sub.visible = sub > 0.003
	_abafar(corte, dr)

func _caiu() -> void:
	_morto_t = 0.0
	_sat_caiu = _sat
	_volta_t = -1.0
	_flash = 1.0
	_pulso = 1.0
	_batidas_finais = 2
	_bate_em = 0.55
	m.lenta(0.9, 0.3) # o corpo cai em câmera lenta
	if m.cam:
		m.cam.tremer(0.7)
		m.cam.afundar(0.5)
	m.vibrar(260)
	if m.sons:
		m.sons.tocar("queda_heroi", 0.0, 0.0)
	if m.hud:
		m.hud.caido = true

func _levantou() -> void:
	_morto_t = -1.0
	_volta_t = 0.0
	_baixa = 0.0
	if m.hud:
		m.hud.caido = false
	if m.fx and m.heroi:
		m.fx.cura(m.heroi) # brilho de cura em volta: levantou de novo
	if m.sons:
		m.sons.tocar("cura", -8.0, 0.0)

# batida do coração: com a vida baixa, cada vez mais rápida; caído, as duas últimas bem devagar
func _coracao(dr: float, morto: bool) -> void:
	if not m.sons:
		return
	if morto:
		if _batidas_finais <= 0:
			return
		_bate_em -= dr
		if _bate_em <= 0.0:
			_batidas_finais -= 1
			_pulso = 1.0
			m.sons.tocar("coracao", -4.0 - (2 - _batidas_finais) * 5.0, 0.0, null, 0.85)
			_bate_em = 1.15
		return
	if _baixa <= 0.05:
		_bate_em = 0.0 # vida boa: a primeira batida sai logo que ela cair de novo
		return
	_bate_em -= dr
	if _bate_em <= 0.0:
		_pulso = 1.0
		m.sons.tocar("coracao", lerp(-15.0, -3.0, _baixa), 0.0, null, lerp(0.95, 1.08, _baixa))
		if _baixa > 0.55:
			m.vibrar(22)
		_bate_em = lerp(1.0, 0.5, _baixa) # ~60 batidas por minuto até ~120 no fim

# som abafado (passa-baixa no barramento principal); desligado quando não precisa
func _abafar(corte: float, dr: float) -> void:
	if _filtro_i < 0 or _filtro_i >= AudioServer.get_bus_effect_count(0):
		return
	# muda em escala de oitavas para soar natural
	var a: float = log(_corte) / log(2.0)
	var b: float = log(max(corte, 20.0)) / log(2.0)
	a = move_toward(a, b, dr * 6.0)
	_corte = pow(2.0, a)
	var ligado: bool = _corte < CORTE_ABERTO - 500.0
	AudioServer.set_bus_effect_enabled(0, _filtro_i, ligado)
	if ligado:
		_filtro.cutoff_hz = _corte

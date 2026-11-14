extends CanvasLayer
# Cenas da história (André 2026-11-11: "acrescenta cinemáticas em algumas missões"). Não é vídeo gravado: roda dentro do
# jogo, com a câmera andando em volta do herói de verdade, então ele aparece sempre com a cara, a roupa e a arma de agora.
# O servidor manda { t: 'cena', id } (shared/simulacao.js cena) e os dados vêm de CENAS (shared/dados.js, exportado em
# habilidades.json, chave "historia" > "cenas"). O que a cena faz:
# - faixas pretas de cinema em cima e embaixo, a HUD some e o toque na tela não move o herói;
# - a câmera vai de um ponto a outro em cada tomada (suave no começo e no fim), com o campo de visão mais fechado;
# - legenda embaixo: quem fala em dourado e a fala aparecendo aos poucos (narração sem nome, em itálico);
# - o herói pode começar caído e levantar (senta tonto no chão, apoia as mãos e fica de pé) e os NPCs da cena viram para ele;
# - botão "Pular" no canto: acaba na hora; no fim a câmera volta para as costas do herói.

const FAIXA := 0.115 # fração da altura da tela de cada faixa preta
const ENTRA := 0.6 # s das faixas entrando e saindo
const FOV := 42.0 # graus: mais fechado que o do jogo (52), cara de filme
const DOURADO := Color("f3d27a")
const Idioma = preload("res://idioma.gd") # falas em inglês quando o jogador escolhe English

var m # main.gd
var ativa := false
var _cena: Dictionary = {}
var _tomadas: Array = []
var _i := 0
var _t := 0.0 # s dentro da tomada
var _k := 0.0 # faixas: 0 fora, 1 dentro
var _saindo := false
var _escondidos: Array = []
var _deitado := false
var _levantando := -1.0
var _novo_levantar := false
var _fx_tomada := -1
var _branco_antes := false
const SENTA_FADE := 1.1 # s da passagem de deitada para sentada
const SENTA_ATE := 2.0 # s sentada tonta antes de apoiar as mãos
const LEVANTA_RITMO := 0.6 # velocidade da animação de levantar (mais lenta, ainda zonza)
var _fonte: Font
var _cima: ColorRect
var _baixo: ColorRect
var _preto: ColorRect
var _quem: Label
var _fala: Label
var _pular: Button
var _fala_t := 0.0
var _ultima := {} # último lugar da câmera (segura enquanto as faixas saem)

func _init(principal) -> void:
	m = principal
	layer = 45
	visible = false

func _ready() -> void:
	_fonte = load("res://fontes/AlegreyaSans-Bold.ttf")
	_preto = ColorRect.new()
	_preto.color = Color(0, 0, 0, 0)
	_preto.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_preto.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_preto)
	_cima = _faixa()
	_baixo = _faixa()
	_quem = _texto(22, DOURADO)
	_fala = _texto(27, Color(1, 0.97, 0.92))
	_pular = Button.new()
	_pular.text = "Pular  ›"
	_pular.focus_mode = Control.FOCUS_NONE
	_pular.add_theme_font_override("font", _fonte)
	_pular.add_theme_font_size_override("font_size", 20)
	for estado in ["normal", "hover", "pressed"]:
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(1, 1, 1, 0.08 if estado == "normal" else 0.18)
		sb.set_corner_radius_all(16)
		sb.content_margin_left = 18
		sb.content_margin_right = 18
		sb.content_margin_top = 4
		sb.content_margin_bottom = 4
		_pular.add_theme_stylebox_override(estado, sb)
	_pular.add_theme_color_override("font_color", Color(1, 1, 1, 0.8))
	_pular.pressed.connect(pular)
	add_child(_pular)

func _faixa() -> ColorRect:
	var c := ColorRect.new()
	c.color = Color.BLACK
	c.mouse_filter = Control.MOUSE_FILTER_STOP # o toque na faixa não passa para o jogo
	add_child(c)
	return c

func _texto(tam: int, cor: Color) -> Label:
	var l := Label.new()
	l.add_theme_font_override("font", _fonte)
	l.add_theme_font_size_override("font_size", tam)
	l.add_theme_color_override("font_color", cor)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	l.add_theme_constant_override("outline_size", 6)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(l)
	return l

func _arrumar() -> void:
	var tam: Vector2 = get_viewport().get_visible_rect().size
	var h: float = tam.y * FAIXA * smoothstep(0.0, 1.0, _k)
	_cima.position = Vector2(0, 0)
	_cima.size = Vector2(tam.x, h)
	_baixo.position = Vector2(0, tam.y - h)
	_baixo.size = Vector2(tam.x, h)
	_preto.size = tam
	var larg: float = min(tam.x * 0.78, 980.0)
	_fala.size = Vector2(larg, 0)
	_fala.position = Vector2((tam.x - larg) / 2.0, tam.y - tam.y * FAIXA - 70.0)
	_quem.size = Vector2(larg, 0)
	_quem.position = Vector2((tam.x - larg) / 2.0, _fala.position.y - 30.0)
	_pular.position = Vector2(tam.x - _pular.size.x - 22.0, max(8.0, h - _pular.size.y - 10.0))
	_pular.modulate.a = _k

# herói novo apertou "Pronto" no criador: a tela já fica preta até a abertura chegar do servidor (André 2026-11-11: não
# pode aparecer de pé antes de aparecer deitada). Se a cena não vier em seg s, o preto some sozinho.
var _espera := 0.0
func escurecer(seg := 2.0) -> void:
	if ativa:
		return
	_espera = seg
	visible = true
	_k = 0.0
	_quem.text = ""
	_fala.text = ""
	_arrumar()
	_preto.color = Color(0, 0, 0, 1)

func _process(dt: float) -> void:
	var t0_parte := Time.get_ticks_usec()
	_process_parte(dt)
	if Time.get_ticks_usec() - t0_parte >= 1000 and Engine.has_meta("lentidao"): # quadro lento (lentidao.gd)
		Engine.get_meta("lentidao").ev("cinematica", t0_parte)

func _process_parte(dt: float) -> void:
	if _espera <= 0.0 or ativa:
		return
	_espera -= dt
	_preto.color.a = clamp(_espera / 0.5, 0.0, 1.0)
	if _espera <= 0.0:
		visible = false

# começa a cena id (vinda do servidor). Sem os dados (app velho), não faz nada.
func tocar(id: String) -> void:
	var todas = m.P.dados.get("historia", {}).get("cenas", {})
	if not (todas is Dictionary) or not todas.has(id):
		return
	_cena = todas[id]
	_tomadas = _cena.get("tomadas", [])
	if _tomadas.is_empty():
		return
	if ativa:
		_restaurar()
	ativa = true
	visible = true
	_espera = 0.0
	_saindo = false
	_i = 0
	_t = 0.0
	_fx_tomada = -1
	_branco_antes = true # a primeira tomada põe as cores da legenda no lugar (se a última cena foi pulada no branco)
	_k = 0.0
	_ultima = {}
	_fala_t = 0.0
	_levantando = -1.0
	# a HUD e as janelas somem; o toque não mexe no herói
	_escondidos.clear()
	for no in m.find_children("*", "CanvasLayer", true, false): # HUD, mapa, missão, menus, avisos de teste
		if no != self and no.visible and no.layer < 50:
			no.visible = false
			_escondidos.append(no)
	var corpos: Array = [m.heroi]
	for n in m.npcs:
		corpos.append(n.no)
	for c in corpos: # nomes em cima das cabeças somem (cara de filme)
		for l in c.find_children("*", "Label3D", true, false):
			if l.visible:
				l.visible = false
				_escondidos.append(l)
	m.hud.bloqueado = true
	if m.hud.has_method("soltar_tudo"):
		m.hud.soltar_tudo()
	if m.conversa:
		m.conversa.fechar()
	var hz: Dictionary = _cena.get("heroi", {})
	_deitado = bool(hz.get("deitado", false))
	if hz.has("ry"):
		m.mov.ry = float(hz.ry)
		m.mov.ry_mira = null
		m.heroi.rotation.y = m.mov.ry
	if _deitado and m.heroi_anim.has_animation("morrer"):
		# deitado: o último quadro da queda, parado (no fim exato a árvore de animação larga a ação e ele fica de pé)
		m.heroi_anim.play("morrer", 0.0, 0.0)
		m.heroi_anim.seek(m.heroi_anim.get_animation("morrer").length * 0.97)
	if m.sons:
		m.sons.tocar("pano", -8.0)
	_mostrar_fala(_tomadas[0])

func pular() -> void:
	if ativa and not _saindo:
		_saindo = true

# o herói fica parado enquanto a cena roda (main.gd atualizar_heroi chama isto no lugar do movimento)
func heroi(dt: float) -> void:
	m.mov.vx = 0.0
	m.mov.vz = 0.0
	m.mov.passo_vertical(dt)
	m.heroi.position = m.mov.posicao()
	m.heroi.rotation.y = m.mov.ry
	if _levantando >= 0.0:
		var antes := _levantando
		_levantando += dt
		if _novo_levantar: # sentada tonta no chão, depois apoia as mãos e fica de pé
			var dl: float = m.heroi_anim.get_animation("levantar").length / LEVANTA_RITMO
			if antes < SENTA_ATE and _levantando >= SENTA_ATE:
				m.heroi_anim.play("levantar", 0.35, LEVANTA_RITMO)
			elif antes < SENTA_ATE + dl * 0.9 and _levantando >= SENTA_ATE + dl * 0.9:
				_levantando = -1.0
				m.heroi_anim.play("parada", 0.4)
		elif _levantando > float(_tomadas[_i].get("d", 3.0)) * 0.75:
			_levantando = -1.0
			m.heroi_anim.play("parada", 0.35)
	m.heroi_anim.atualizar(dt, 0.0)
	for id in _cena.get("npcs", []):
		for n in m.npcs:
			if n.id == str(id):
				var alvo: float = atan2(m.heroi.position.x - n.no.position.x, m.heroi.position.z - n.no.position.z)
				if not n.has("ry0"):
					n.ry0 = n.no.rotation.y
				n.no.rotation.y = lerp_angle(n.no.rotation.y, alvo, min(1.0, dt * 3.0))

# rel false: ponto do mundo (só a altura segue o herói); true: perto do herói; "heroi": perto do herói e girado com ele
# (z para a frente dele), para a cena que toca onde o herói estiver olhando para qualquer lado
func _ponto(v, rel) -> Vector3:
	var b: Vector3 = m.heroi.position
	var p := Vector3(float(v[0]), float(v[1]), float(v[2]))
	if rel is String:
		p = p.rotated(Vector3.UP, m.mov.ry)
	var perto: bool = rel is String or rel == true
	return Vector3((b.x if perto else 0.0) + p.x, b.y + p.y, (b.z if perto else 0.0) + p.z)

func _mostrar_fala(tm: Dictionary) -> void:
	var f = tm.get("fala")
	_fala_t = 0.0
	if not (f is Array) or f.size() < 2:
		_quem.text = ""
		_fala.text = ""
		return
	var nome: String = str(m.hud.nome)
	var quem := str(f[0]).replace("{nome}", nome)
	_quem.text = Idioma.frase(quem)
	_fala.text = Idioma.frase(str(f[1])).replace("{nome}", nome) # inglês (idioma.gd): a fala chega em português
	_fala.visible_ratio = 0.0
	# narração (sem quem fala) num tom mais claro, como pensamento
	_fala.add_theme_color_override("font_color", Color(0.86, 0.84, 1.0) if quem == "" else Color(1, 0.97, 0.92))

# a cada quadro, depois da câmera do jogo (main.gd): a câmera da cena manda por cima
func camera(dt: float) -> void:
	if not ativa:
		return
	_k = move_toward(_k, 0.0 if _saindo else 1.0, dt / ENTRA)
	_arrumar()
	if _saindo: # a câmera fica no último quadro enquanto as faixas saem; a legenda some na hora
		_quem.text = ""
		_fala.text = ""
		_preto.color.a = move_toward(_preto.color.a, 0.0, dt * 2.0)
		if _ultima.has("p"):
			m.camera.position = _ultima.p
			m.camera.look_at(_ultima.o)
			m.camera.fov = FOV
		if _k <= 0.0:
			_acabar()
		return
	var tm: Dictionary = _tomadas[_i]
	var d: float = max(0.1, float(tm.get("d", 3.0)))
	_t += dt
	_fala_t += dt
	if _fala.text != "":
		_fala.visible_ratio = clamp(_fala_t / max(0.35, _fala.text.length() * 0.028), 0.0, 1.0)
	# saindo do preto no começo da tomada
	var preto: float = float(tm.get("preto", 0.0))
	var branco: float = float(tm.get("branco", 0.0)) # memória: a tela some no branco e a legenda conta
	if branco > 0.0:
		# entre duas tomadas brancas a tela segue branca (sem piscar)
		var antes_b: bool = _i > 0 and float(_tomadas[_i - 1].get("branco", 0.0)) > 0.0
		var depois_b: bool = _i + 1 < _tomadas.size() and float(_tomadas[_i + 1].get("branco", 0.0)) > 0.0
		var k_b: float = min(1.0 if antes_b else _t / branco, 1.0 if depois_b else (d - _t) / branco)
		_preto.color = Color(0.97, 0.96, 1.0, clamp(k_b, 0.0, 1.0))
		# no branco a legenda clara some: escurece junto com o branco
		var esc: float = _preto.color.a
		_fala.add_theme_color_override("font_color", Color(0.86, 0.84, 1.0).lerp(Color(0.22, 0.2, 0.32), esc))
		_quem.add_theme_color_override("font_color", DOURADO.lerp(Color(0.5, 0.38, 0.12), esc))
		for l in [_fala, _quem]:
			l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9).lerp(Color(1, 1, 1, 0.6), esc))
	else:
		_preto.color = Color(0, 0, 0, 1.0 - clamp(_t / preto, 0.0, 1.0) if preto > 0.0 else 0.0)
		if _branco_antes: # saiu da memória: legenda volta às cores de sempre
			_quem.add_theme_color_override("font_color", DOURADO)
			for l in [_fala, _quem]:
				l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	_branco_antes = branco > 0.0
	if tm.has("fx") and _fx_tomada != _i: # brilho na mão do herói (fragmento, selo, chave)
		_fx_tomada = _i
		if m.fx:
			var h: Vector3 = m.heroi.position
			m.fx.surto(h.x, h.y + 0.9, h.z, 22, "e8d8ff", "b48cff", 2.2, 0.1)
		if m.sons:
			m.sons.tocar("q_anel_1", -10.0)
	if str(tm.get("acao", "")) == "levantar" and _deitado and _levantando < 0.0 and _t < 0.5:
		_deitado = false
		_levantando = 0.0
		# senta no chão meio tonta, fica um pouco, apoia as mãos e levanta (KayKit Character Animations, CC0)
		_novo_levantar = m.heroi_anim.has_animation("sentado_chao") and m.heroi_anim.has_animation("levantar")
		if _novo_levantar:
			m.heroi_anim.play("sentado_chao", SENTA_FADE)
		elif m.heroi_anim.has_animation("morrer"):
			var dur: float = m.heroi_anim.get_animation("morrer").length
			m.heroi_anim.play("morrer", 0.0, -dur / (d * 0.85)) # a queda ao contrário: levanta (troca para a parada antes do começo)
			m.heroi_anim.seek(dur * 0.97)
	var rel = tm.get("rel", false)
	var s: float = smoothstep(0.0, 1.0, clamp(_t / d, 0.0, 1.0))
	var de: Dictionary = tm.get("de", {})
	var para: Dictionary = tm.get("para", de)
	var pos: Vector3 = _ponto(de.p, rel).lerp(_ponto(para.p, rel), s)
	var olha: Vector3 = _ponto(de.o, rel).lerp(_ponto(para.o, rel), s)
	m.camera.position = pos
	m.camera.look_at(olha)
	m.camera.fov = FOV
	_ultima = {"p": pos, "o": olha}
	if _t >= d:
		_t = 0.0
		_i += 1
		if _i >= _tomadas.size():
			_i = _tomadas.size() - 1
			_saindo = true
		else:
			_mostrar_fala(_tomadas[_i])

func _acabar() -> void:
	_restaurar()
	# a câmera do jogo volta para as costas do herói
	m.cam.yaw = m.mov.ry + PI
	m.cam.pitch = 0.35
	m.cam.colocar(m.heroi.position)

func _restaurar() -> void:
	ativa = false
	visible = false
	_quem.text = ""
	_fala.text = ""
	_preto.color.a = 0.0
	for no in _escondidos:
		if is_instance_valid(no):
			no.visible = true
	_escondidos.clear()
	m.hud.bloqueado = false
	if _deitado or _levantando >= 0.0:
		m.heroi_anim.play("parada", 0.3)
	_deitado = false
	_levantando = -1.0

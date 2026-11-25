extends Node
const Idioma = preload("res://idioma.gd") # inglês (idioma.gd)
const Menu = preload("res://menu.gd")
const Progresso = preload("res://progresso.gd")
# Buffs e debuffs perto da barra de vida (André 2026-11-25: "aparecesse ali próximo da barra de HP o buff do clã ... quando
# a gente desse um toque em cima, a gente conseguisse ver o que o buff dava ... o boss me stunou, aparecesse o debuff ...
# o mesmo padrão pro monstro e pros players e pros geadas").
# Quem decide é o servidor: cada corpo da foto traz bf = [[código, fim, valor, extra], ...] (shared/simulacao.js
# bfJogador/bfInimigo). O fim é absoluto (relógio da Simulacao; a comida em ms do relógio do servidor), então a lista só
# chega de novo quando um efeito entra ou sai. Aqui só desenha: herói (hud.gd), alvo (alvo_quadro.gd) e time (amigos.gd).
# Ícone redondo e pequeno, sem texto: borda verde/dourada = buff, vermelha = debuff; a borda clara vai encolhendo com o
# tempo que falta. Tocar no ícone abre a dica curta (o que dá e quanto falta), que some sozinha.

const COR_BOM := Color(0.55, 0.86, 0.42)
const COR_CLA := Color(0.98, 0.76, 0.32)
const COR_RUIM := Color(0.96, 0.32, 0.24)
const FUNDO := Color(0.07, 0.06, 0.05, 0.88)
const DICA_DUR := 3.5 # s que a dica fica aberta

var m # main.gd
var _total := {} # "fim|código" -> segundos que faltavam na primeira vez que apareceu (para a borda encolher)
var _zonas := {} # dono -> [[Rect2 na tela, item], ...] (onde tocar; refeito a cada desenho do dono)
var _camada: CanvasLayer
var _dica: Control
var _dica_item := {}
var _dica_dono := ""
var _dica_t := 0.0
var _dica_pos := Vector2.ZERO
var _dica_txt: Array = [] # [título, linha, cor]
var _dica_seg := -1

func _init(principal) -> void:
	m = principal

func _ready() -> void:
	_camada = CanvasLayer.new()
	_camada.layer = 60 # acima da HUD e dos quadros
	add_child(_camada)
	_dica = Control.new()
	_dica.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dica.visible = false
	_dica.draw.connect(_desenhar_dica)
	_camada.add_child(_dica)

# ---------- de onde vem a lista ----------
func _srv_agora() -> float: # relógio da Simulacao, aqui no celular
	var o = m.online
	if o == null or not is_finite(o._desvio_srv):
		return -1.0
	return o._agora() - o._desvio_srv

# itens prontos para desenhar: [{k, v, x, falta (-1 = enquanto durar), frac (0..1), bom}]
func itens(bf) -> Array:
	var r: Array = []
	if not (bf is Array) or bf.is_empty():
		return r
	var ts := _srv_agora()
	var ms: float = m.P.agora_ms() if m.P else Time.get_unix_time_from_system() * 1000.0
	for b in bf:
		if not (b is Array) or b.size() < 2:
			continue
		var k := str(b[0])
		var fim := float(b[1])
		var falta := -1.0
		if fim > 0.0:
			if k == "co":
				falta = (fim - ms) / 1000.0
			elif ts >= 0.0:
				falta = fim - ts
			else:
				continue
			if falta <= 0.0:
				continue
		var chave := "%s|%s" % [k, b[1]]
		if falta > 0.0 and not _total.has(chave):
			_total[chave] = falta
			if _total.size() > 300:
				_total.clear()
				_total[chave] = falta
		var tot: float = float(_total.get(chave, falta))
		var v = b[2] if b.size() > 2 else 0
		r.append({"k": k, "v": v, "x": b[3] if b.size() > 3 else null, "falta": falta,
			"frac": clamp(falta / max(0.1, tot), 0.0, 1.0) if falta > 0.0 else 1.0, "bom": _bom(k, v)})
	return r

func _bom(k: String, v) -> bool:
	if k in ["cla", "co", "escudo"]:
		return true
	if k == "mesa":
		return float(v) > 0.0
	return false

# o herói (a foto traz o meu inteiro: online.gd guarda em bf_meu)
func do_heroi() -> Array:
	return itens(m.online.bf_meu) if m.online != null else [] # offline fica vazia (só a foto do servidor enche)

# o alvo do quadro (alvo_quadro.gd): monstro (e.bf, online.gd inimigo) ou jogador da Geada/duelo (outros[id].bf)
func do_alvo(e) -> Array:
	if not (e is Dictionary):
		return []
	if e.get("duelo", false):
		var o = m.online.outros.get(str(e.get("id", ""))) if m.online else null
		return itens(o.get("bf", [])) if o is Dictionary else []
	return itens(e.get("bf", []))

# alguém do time (amigos.gd): o corpo dele, se está perto
func do_id(id: String) -> Array:
	var o = m.online.outros.get(id) if m.online else null
	return itens(o.get("bf", [])) if o is Dictionary else []

# o que muda o desenho: os ícones e, com tempo correndo, 4 vezes por segundo (a borda encolhe)
func assinatura(lista: Array) -> String:
	if lista.is_empty():
		return ""
	var s := ""
	var corre := false
	for it in lista:
		s += "%s%s;" % [it.k, it.v]
		if it.falta > 0.0:
			corre = true
	if corre:
		s += str(int(Time.get_ticks_msec() / 250))
	return s

# ---------- desenho ----------
# ci: onde desenhar (com a transformação do dono já ligada); p: canto de cima à esquerda (local); tam: lado do ícone;
# tela_p/tela_s: o mesmo canto na tela e a escala (para o toque). Devolve a largura usada.
func desenhar(ci: CanvasItem, dono: String, lista: Array, p: Vector2, tam: float, tela_p: Vector2, tela_s: float, max_n := 6) -> float:
	var zonas: Array = []
	var x := 0.0
	var n := 0
	for it in lista:
		if n >= max_n:
			break
		var c := p + Vector2(x + tam * 0.5, tam * 0.5)
		_icone(ci, c, tam * 0.5, it)
		zonas.append([Rect2(tela_p + Vector2(x - 2.0, -3.0) * tela_s, Vector2(tam + 4.0, tam + 6.0) * tela_s), it])
		x += tam + 3.0
		n += 1
	_zonas[dono] = zonas
	if _dica.visible and _dica_dono == dono: # a dica aberta acompanha o item (tempo que falta) ou fecha se ele acabou
		var achou := false
		for z in zonas:
			if z[1].k == _dica_item.get("k", ""):
				_dica_item = z[1]
				achou = true
		if not achou:
			_fechar_dica()
	return max(0.0, x - 3.0)

func limpar_prefixo(pre: String) -> void:
	for dono in _zonas.keys():
		if str(dono).begins_with(pre):
			limpar(dono)

func limpar(dono: String) -> void:
	if _zonas.has(dono):
		_zonas.erase(dono)
		if _dica_dono == dono:
			_fechar_dica()

# hud.gd chama no toque: true = era um ícone (abre/fecha a dica e o toque para aqui)
func tocar(pos: Vector2) -> bool:
	for dono in _zonas:
		for z in _zonas[dono]:
			if z[0].has_point(pos):
				if _dica.visible and _dica_dono == dono and _dica_item.get("k", "") == z[1].k:
					_fechar_dica()
				else:
					_abrir_dica(dono, z[1], z[0])
				return true
	return false

func _icone(ci: CanvasItem, c: Vector2, r: float, it: Dictionary) -> void:
	var k: String = it.k
	var cor_borda: Color = COR_CLA if k == "cla" else (COR_BOM if it.bom else COR_RUIM)
	ci.draw_circle(c, r + 1.2, Color(0, 0, 0, 0.55))
	ci.draw_circle(c, r, FUNDO)
	var ri := r * 0.62 # o desenho de dentro
	match k:
		"cla":
			_escudo(ci, c, ri * 1.1, Color(0.36, 0.2, 0.08), Color(0.95, 0.74, 0.3)) # escudo do clã (o mesmo da base no mapa)
			_chama(ci, c + Vector2(0, ri * 0.05), ri * 0.68, Color(1.0, 0.5, 0.12), Color(1.0, 0.88, 0.4))
		"co":
			var tex: Texture2D = Menu.icone_tex(Progresso.icone_item({"k": str(it.v)}))
			if tex:
				var lado := r * 1.5
				ci.draw_texture_rect(tex, Rect2(c - Vector2(lado, lado) * 0.5, Vector2(lado, lado)), false)
			else:
				_tigela(ci, c, ri)
		"mesa":
			_tigela(ci, c, ri)
		"escudo":
			_escudo(ci, c, ri, Color(0.45, 0.72, 1.0), Color(0.12, 0.25, 0.5))
		"atordoa":
			for i in 3:
				var a := TAU * i / 3.0 - PI * 0.5
				_estrela(ci, c + Vector2(cos(a), sin(a)) * ri * 0.55, ri * 0.42, Color(1.0, 0.86, 0.3))
		"congela":
			_floco(ci, c, ri, Color(0.7, 0.92, 1.0))
		"derruba":
			for i in 2:
				var y := c.y - ri * 0.55 + i * ri * 0.6
				ci.draw_polyline(PackedVector2Array([Vector2(c.x - ri * 0.7, y), Vector2(c.x, y + ri * 0.55), Vector2(c.x + ri * 0.7, y)]), Color(1.0, 0.6, 0.3), max(1.6, r * 0.2), true)
		"lento":
			_ampulheta(ci, c, ri, Color(0.62, 0.72, 1.0))
		"vuln":
			_escudo(ci, c, ri, Color(0.55, 0.52, 0.5), Color(0.25, 0.23, 0.22))
			ci.draw_polyline(PackedVector2Array([c + Vector2(-ri * 0.1, -ri * 0.85), c + Vector2(ri * 0.2, -ri * 0.3), c + Vector2(-ri * 0.2, ri * 0.1), c + Vector2(ri * 0.15, ri * 0.7)]), COR_RUIM, max(1.5, r * 0.18), true)
		"sangra":
			_gota(ci, c, ri, Color(0.85, 0.12, 0.12))
		"veneno":
			_gota(ci, c, ri, Color(0.45, 0.85, 0.25))
		"queima":
			_chama(ci, c, ri * 0.9, Color(1.0, 0.45, 0.1), Color(1.0, 0.85, 0.35))
		_:
			_estrela(ci, c, ri * 0.7, cor_borda)
	# borda: o tempo que falta (cheia = acabou de pegar; encolhe até sumir). Sem tempo = cheia.
	var lw: float = max(1.6, r * 0.2)
	ci.draw_arc(c, r - lw * 0.5, 0.0, TAU, 24, Color(cor_borda, 0.3), lw, true)
	ci.draw_arc(c, r - lw * 0.5, -PI * 0.5, -PI * 0.5 + TAU * float(it.frac), 24, cor_borda, lw, true)
	if k in ["sangra", "veneno", "queima"] and int(it.v) > 1: # pilhas do sangramento/veneno: pontinho por pilha
		for i in min(3, int(it.v)):
			ci.draw_circle(c + Vector2(r * 0.55 - i * r * 0.32, r * 0.72), r * 0.13, Color(1, 1, 1, 0.9))

func _escudo(ci: CanvasItem, c: Vector2, r: float, cor: Color, escura: Color) -> void:
	var pts := PackedVector2Array([c + Vector2(-r * 0.8, -r * 0.85), c + Vector2(r * 0.8, -r * 0.85), c + Vector2(r * 0.8, -r * 0.1),
		c + Vector2(r * 0.45, r * 0.6), c + Vector2(0, r), c + Vector2(-r * 0.45, r * 0.6), c + Vector2(-r * 0.8, -r * 0.1)])
	ci.draw_colored_polygon(pts, cor)
	var borda := pts.duplicate()
	borda.append(pts[0])
	ci.draw_polyline(borda, escura, max(1.0, r * 0.14), true)

func _chama(ci: CanvasItem, c: Vector2, r: float, cor: Color, miolo: Color) -> void:
	# gota de fogo com a ponta para cima (lado esquerdo e direito em curva) e o miolo claro embaixo
	var pts := PackedVector2Array([c + Vector2(0, -r)])
	for i in 13:
		var a := -0.15 * PI + 1.3 * PI * i / 12.0
		pts.append(c + Vector2(0, r * 0.32) + Vector2(cos(a), sin(a)) * r * 0.62)
	ci.draw_colored_polygon(pts, cor)
	var mio := PackedVector2Array([c + Vector2(0, -r * 0.25)])
	for i in 9:
		var a := -0.1 * PI + 1.2 * PI * i / 8.0
		mio.append(c + Vector2(0, r * 0.5) + Vector2(cos(a), sin(a)) * r * 0.32)
	ci.draw_colored_polygon(mio, miolo)

func _estrela(ci: CanvasItem, c: Vector2, r: float, cor: Color) -> void:
	var pts := PackedVector2Array()
	for i in 8:
		var a := -PI * 0.5 + TAU * i / 8.0
		pts.append(c + Vector2(cos(a), sin(a)) * (r if i % 2 == 0 else r * 0.38))
	ci.draw_colored_polygon(pts, cor)

func _floco(ci: CanvasItem, c: Vector2, r: float, cor: Color) -> void:
	var lw: float = max(1.3, r * 0.17)
	for i in 3:
		var a := PI * i / 3.0 + PI * 0.5
		var d := Vector2(cos(a), sin(a)) * r
		ci.draw_line(c - d, c + d, cor, lw, true)
		for s in [-1.0, 1.0]: # galhinhos nas pontas
			var p0: Vector2 = c + d * s * 0.62
			var q: Vector2 = d.normalized() * s * r * 0.3
			ci.draw_line(p0, p0 + q.rotated(0.8), cor, lw * 0.8, true)
			ci.draw_line(p0, p0 + q.rotated(-0.8), cor, lw * 0.8, true)

func _ampulheta(ci: CanvasItem, c: Vector2, r: float, cor: Color) -> void:
	ci.draw_colored_polygon(PackedVector2Array([c + Vector2(-r * 0.6, -r * 0.85), c + Vector2(r * 0.6, -r * 0.85), c]), cor)
	ci.draw_colored_polygon(PackedVector2Array([c, c + Vector2(r * 0.6, r * 0.85), c + Vector2(-r * 0.6, r * 0.85)]), Color(cor, 0.55))
	ci.draw_line(c + Vector2(-r * 0.75, -r * 0.9), c + Vector2(r * 0.75, -r * 0.9), Color(0.85, 0.7, 0.45), max(1.2, r * 0.15), true)
	ci.draw_line(c + Vector2(-r * 0.75, r * 0.9), c + Vector2(r * 0.75, r * 0.9), Color(0.85, 0.7, 0.45), max(1.2, r * 0.15), true)

func _gota(ci: CanvasItem, c: Vector2, r: float, cor: Color) -> void:
	var pts := PackedVector2Array([c + Vector2(0, -r)])
	for i in 11:
		var a := -0.25 * PI + 1.5 * PI * i / 10.0 # meia-lua de baixo
		pts.append(c + Vector2(0, r * 0.3) + Vector2(cos(a + PI * 0.0), sin(a)) * r * 0.62)
	ci.draw_colored_polygon(pts, cor)
	ci.draw_circle(c + Vector2(-r * 0.2, r * 0.2), r * 0.14, Color(1, 1, 1, 0.55))

func _tigela(ci: CanvasItem, c: Vector2, r: float) -> void:
	var pts := PackedVector2Array()
	for i in 9:
		var a := PI * i / 8.0
		pts.append(c + Vector2(cos(a) * r * 0.85, sin(a) * r * 0.65 + r * 0.05))
	ci.draw_colored_polygon(pts, Color(0.72, 0.48, 0.26))
	ci.draw_line(c + Vector2(-r * 0.9, r * 0.05), c + Vector2(r * 0.9, r * 0.05), Color(0.9, 0.7, 0.45), max(1.2, r * 0.15), true)
	for i in 2: # fumacinha
		var x := c.x - r * 0.25 + i * r * 0.5
		ci.draw_polyline(PackedVector2Array([Vector2(x, c.y - r * 0.1), Vector2(x - r * 0.15, c.y - r * 0.45), Vector2(x, c.y - r * 0.8)]), Color(1, 1, 1, 0.7), max(1.0, r * 0.1), true)

# ---------- dica (o que dá e quanto falta) ----------
func _abrir_dica(dono: String, it: Dictionary, r: Rect2) -> void:
	_dica_dono = dono
	_dica_item = it
	_dica_t = DICA_DUR
	_dica_pos = r.position + Vector2(0, r.size.y + 4.0)
	_dica_seg = -2 # outro item: refaz o texto
	_dica_txt = []
	_dica.visible = true
	_atualizar_dica()

func _fechar_dica() -> void:
	_dica.visible = false
	_dica_dono = ""
	_dica_item = {}

func _process(dt: float) -> void:
	if not _dica.visible:
		return
	_dica_t -= dt
	if _dica_t <= 0.0:
		_fechar_dica()
		return
	_atualizar_dica()

func _atualizar_dica() -> void:
	var it := _dica_item
	var falta := float(it.get("falta", -1.0))
	if falta > 0.0:
		falta -= DICA_DUR - _dica_t # a lista do dono pode não ser redesenhada (quadro sem mudança): desconta aqui
	var seg := int(ceil(falta)) if falta > 0.0 else -1
	if seg == _dica_seg and not _dica_txt.is_empty():
		return
	_dica_seg = seg
	_dica_txt = texto(it)
	if seg > 0:
		_dica_txt[1] = _dica_txt[1] + "  ·  " + _tempo(float(seg))
	_dica.queue_redraw()

static func _tempo(s: float) -> String:
	if s >= 60.0:
		return "%d:%02d" % [int(s) / 60, int(s) % 60]
	return "%d s" % int(ceil(s))

static func _pct(x) -> String:
	return "%d%%" % int(round(absf(float(x)) * 100.0))

# [título, o que faz]
func texto(it: Dictionary) -> Array:
	var v = it.get("v", 0)
	match str(it.k):
		"cla":
			return [Idioma.frase("Clã Nv %d") % int(v), Idioma.frase("+%s de XP e ouro dos monstros") % _pct(it.get("x", 0))]
		"mesa":
			if float(v) > 0.0:
				return [Idioma.frase("Bem alimentado"), Idioma.frase("+%s de dano e XP") % _pct(v)]
			return [Idioma.frase("Com fome") if float(v) > -0.2 else Idioma.frase("Faminto"), Idioma.frase("-%s de dano e XP") % _pct(v)]
		"co":
			var I = m.P.dados.itens.get(str(v), {}) if m.P else {}
			var partes: Array = []
			var B: Dictionary = I.get("buff", {}).get("b", {}) if I is Dictionary else {}
			for k in B:
				var nome: String = {"dano": "dano", "defesa": "defesa", "critico": "crítico", "regenMana": "volta da mana"}.get(k, k)
				partes.append("+%s %s" % [_pct(B[k]), Idioma.frase(nome)])
			return [Idioma.t(str(I.get("nome", "Comida"))) if I is Dictionary else Idioma.frase("Comida"), ", ".join(partes)]
		"escudo":
			return [Idioma.frase("Escudo"), Idioma.frase("Absorve %d de dano") % int(v)]
		"atordoa":
			return [Idioma.frase("Atordoado"), Idioma.frase("Não anda nem ataca")]
		"congela":
			return [Idioma.frase("Congelado"), Idioma.frase("Não anda nem ataca")]
		"derruba":
			return [Idioma.frase("Derrubado"), Idioma.frase("No chão: não anda nem ataca")]
		"lento":
			return [Idioma.frase("Lento"), Idioma.frase("-%s de velocidade") % _pct(v)]
		"vuln":
			return [Idioma.frase("Quebrado"), Idioma.frase("Leva +%s de dano") % _pct(v)]
		"sangra":
			return [Idioma.frase("Sangrando"), Idioma.frase("Perde vida a cada segundo") + (" (x%d)" % int(v) if int(v) > 1 else "")]
		"veneno":
			return [Idioma.frase("Envenenado"), Idioma.frase("Perde vida a cada segundo") + (" (x%d)" % int(v) if int(v) > 1 else "")]
		"queima":
			return [Idioma.frase("Queimando"), Idioma.frase("Perde vida a cada segundo") + (" (x%d)" % int(v) if int(v) > 1 else "")]
	return [str(it.k), ""]

func _desenhar_dica() -> void:
	if _dica_txt.is_empty():
		return
	var f := ThemeDB.fallback_font
	var tela: Vector2 = _dica.get_viewport_rect().size
	var w1 := f.get_string_size(_dica_txt[0], HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x
	var w2 := f.get_string_size(_dica_txt[1], HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
	var tam := Vector2(max(w1, w2) + 54.0, 46.0)
	var p := _dica_pos
	p.x = clamp(p.x, 6.0, tela.x - tam.x - 6.0)
	if p.y + tam.y > tela.y - 6.0:
		p.y = tela.y - tam.y - 6.0
	var bom: bool = _dica_item.get("bom", false)
	var cor: Color = COR_CLA if _dica_item.get("k", "") == "cla" else (COR_BOM if bom else COR_RUIM)
	var sb := StyleBoxFlat.new()
	sb.anti_aliasing = true
	sb.set_corner_radius_all(9)
	sb.bg_color = Color(0.07, 0.06, 0.05, 0.94)
	sb.border_color = Color(cor, 0.85)
	sb.set_border_width_all(2)
	sb.draw(_dica.get_canvas_item(), Rect2(p, tam))
	_icone(_dica, p + Vector2(24, tam.y * 0.5), 15.0, _dica_item)
	_dica.draw_string(f, p + Vector2(46, 19), _dica_txt[0], HORIZONTAL_ALIGNMENT_LEFT, -1, 15, cor)
	_dica.draw_string(f, p + Vector2(46, 37), _dica_txt[1], HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.95, 0.92, 0.86))

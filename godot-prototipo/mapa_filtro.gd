extends RefCounted
# Filtro do mapa (André 2026-11-16 14:04): "selecionar, fazer um filtro do que aparece no mapa... marcar e desmarcar os
# NPCs, a área de plantio, vila... se a pessoa quiser procurar só os boss, ela desmarca tudo e deixa só os boss".
# Nada sai do mapa: cada camada só pode ser escondida. Abre com tudo marcado, como antes, e a escolha fica gravada
# (user://mapa.cfg). Vale no mapa 3D e no 2D (e na lista de lugares do 2D). Desenhado à mão, como os outros botões do
# mapa: botão "Filtro" no canto de cima à esquerda e a caixinha com as camadas embaixo dele.
const Idioma = preload("res://idioma.gd")
const CAMADAS := [["vilas", "Vilas e cidades"], ["totens", "Totens"], ["caca", "Caçada"], ["boss", "Bosses"],
	["dungeon", "Dungeons"], ["recursos", "Recursos"], ["oficinas", "Oficinas"], ["npcs", "NPCs"],
	["mercadores", "Mercadores"], ["plantio", "Áreas de plantio"]]
const CFG := "user://mapa.cfg"
const OURO := Color("c9a35a")

var mostra := {} # camada -> false quando escondida (o que não está aqui aparece)
var aberto := false
var botao := Rect2()
var caixa := Rect2()
var _linhas := [] # [Rect2, camada]
var _tudo := Rect2()
var _nada := Rect2()
var _pontos_plantio := {} # lado da célula (m) -> [Vector2]: onde vai um símbolo de pinheirinhos (feito uma vez por lado)
const VERDE_PL := Color(0.55, 0.85, 0.45)

func _init() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(CFG) == OK:
		var d = cfg.get_value("mapa", "filtro", {})
		if d is Dictionary:
			mostra = d

func ok(camada: String) -> bool:
	return bool(mostra.get(camada, true))

func _gravar() -> void:
	var cfg := ConfigFile.new()
	cfg.load(CFG)
	cfg.set_value("mapa", "filtro", mostra)
	cfg.save(CFG)

# desenha o botão (canto = em cima à esquerda) e, aberto, a caixa com as camadas embaixo dele
func desenhar(c: Control, canto: Vector2, fonte: Font) -> void:
	var ligadas := 0
	for cm in CAMADAS:
		if ok(cm[0]):
			ligadas += 1
	var t := Idioma.frase("Filtro") + ("" if ligadas == CAMADAS.size() else " (%d)" % ligadas)
	var w: float = fonte.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, 17).x + 34.0
	botao = Rect2(canto, Vector2(w, 36))
	_caixa_estilo(c, botao, 18, aberto)
	# funil
	var f := botao.position + Vector2(15, 18)
	c.draw_colored_polygon(PackedVector2Array([f + Vector2(-7, -7), f + Vector2(7, -7), f + Vector2(1.5, 0), f + Vector2(1.5, 7), f + Vector2(-1.5, 5), f + Vector2(-1.5, 0)]), Color(1, 0.9, 0.7))
	c.draw_string(fonte, botao.position + Vector2(26, 24), t, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color(1, 0.95, 0.85))
	_linhas = []
	if not aberto:
		caixa = Rect2()
		return
	var lw := 250.0
	caixa = Rect2(botao.position + Vector2(0, 44), Vector2(lw, 42.0 + CAMADAS.size() * 34.0 + 50.0))
	_caixa_estilo(c, caixa, 12, false, 0.94)
	c.draw_string(fonte, caixa.position + Vector2(14, 28), Idioma.frase("Mostrar no mapa"), HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color("ffdc8c"))
	var y := caixa.position.y + 42.0
	for cm in CAMADAS:
		var r := Rect2(Vector2(caixa.position.x + 6, y), Vector2(lw - 12, 32))
		_linhas.append([r, cm[0]])
		var on := ok(cm[0])
		var q := Rect2(r.position + Vector2(8, 5), Vector2(22, 22))
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color8(80, 140, 60) if on else Color(0.2, 0.17, 0.13)
		sb.border_color = Color(0.86, 0.82, 0.74)
		sb.set_border_width_all(2)
		sb.set_corner_radius_all(5)
		sb.draw(c.get_canvas_item(), q)
		if on:
			c.draw_polyline(PackedVector2Array([q.position + Vector2(4, 11), q.position + Vector2(9, 16), q.position + Vector2(18, 5)]), Color.WHITE, 3.0, true)
		var cor := VERDE_PL if cm[0] == "plantio" else Color(0.95, 0.91, 0.84)
		c.draw_string(fonte, r.position + Vector2(40, 22), Idioma.frase(cm[1]), HORIZONTAL_ALIGNMENT_LEFT, -1, 17, cor)
		y += 34.0
	_tudo = Rect2(Vector2(caixa.position.x + 12, y + 8), Vector2((lw - 36) * 0.5, 34))
	_nada = Rect2(Vector2(_tudo.end.x + 12, y + 8), _tudo.size)
	for par in [[_tudo, "Tudo"], [_nada, "Nada"]]:
		_caixa_estilo(c, par[0], 8, false, 0.9, Color(0.28, 0.26, 0.24))
		c.draw_string(fonte, Vector2(par[0].position.x, par[0].position.y + 23), Idioma.frase(par[1]), HORIZONTAL_ALIGNMENT_CENTER, par[0].size.x, 16, Color.WHITE)

func _caixa_estilo(c: Control, r: Rect2, raio: int, aceso: bool, alfa := 0.88, fundo := Color(0.08, 0.06, 0.04)) -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(fundo.lightened(0.12) if aceso else fundo, alfa)
	sb.border_color = OURO
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(raio)
	sb.draw(c.get_canvas_item(), r)

# toque (local, como o desenho): true quando o filtro usou o toque
func toque(lp: Vector2) -> bool:
	if botao.grow(6).has_point(lp):
		aberto = not aberto
		return true
	if not aberto:
		return false
	if _tudo.has_point(lp) or _nada.has_point(lp):
		var v := _tudo.has_point(lp)
		for cm in CAMADAS:
			mostra[cm[0]] = v
		_gravar()
		return true
	for l in _linhas:
		if l[0].has_point(lp):
			mostra[l[1]] = not ok(l[1])
			_gravar()
			return true
	if caixa.has_point(lp):
		return true
	aberto = false # tocou fora da caixa: fecha (e o toque segue para o mapa)
	return false

# cobre o ponto (local)? (o dedo em cima do filtro não arrasta o mapa)
func cobre(lp: Vector2) -> bool:
	return botao.grow(6).has_point(lp) or (aberto and caixa.has_point(lp))

# André 2026-11-16: no lugar da mancha amarela, pinheirinhos ("bate o olho e já sabe: ali é área de plantar árvore").
# Um símbolo por célula de `lado` metros que tem pelo menos 1/6 dela em área de plantio, no meio dos quadrados dela.
func pontos_plantio(quads: Dictionary, lado: int) -> Array:
	if _pontos_plantio.has(lado):
		return _pontos_plantio[lado]
	var cel := {} # Vector2i -> [soma x, soma z, n]
	var por := float(lado) / 4.0
	var da_area := {} # id da área -> {célula: quadrados dela ali}
	for q in quads:
		var c := Vector2i(floori(q.x / por), floori(q.y / por))
		var v: Array = cel.get(c, [0.0, 0.0, 0])
		v[0] += (q.x + 0.5) * 4.0
		v[1] += (q.y + 0.5) * 4.0
		v[2] += 1
		cel[c] = v
		var A: Dictionary = da_area.get(quads[q], {})
		A[c] = int(A.get(c, 0)) + 1
		da_area[quads[q]] = A
	# André 2026-11-17 ("o mapa mostre todas as áreas novas"): as faixas da beira da estrada são finas (2 a 5
	# quadrados), então a célula conta pelo comprido da faixa (por * 1,2) e não pela área; e toda área ganha ao menos
	# o símbolo da célula onde ela tem mais quadrados, em qualquer zoom.
	var minimo := maxi(3, int(minf(por * por / 12.0, por * 1.2)))
	var sempre := {}
	for id in da_area:
		var melhor := Vector2i.ZERO
		var n := -1
		for c in da_area[id]:
			if int(da_area[id][c]) > n:
				n = int(da_area[id][c])
				melhor = c
		sempre[melhor] = true
	var r := []
	for c in cel:
		var v: Array = cel[c]
		if v[2] >= minimo or sempre.has(c):
			r.append(Vector2(v[0] / v[2], v[1] / v[2]))
	_pontos_plantio[lado] = r
	return r

# um pinheirinho: tronco e três andares de folhas (s = altura em pixels)
static func pinho(c: CanvasItem, p: Vector2, s: float, cor: Color) -> void:
	var escuro := Color(0.08, 0.2, 0.09)
	c.draw_rect(Rect2(p + Vector2(-s * 0.12, -s * 0.05), Vector2(s * 0.24, s * 0.33)), Color(0.43, 0.29, 0.16))
	for a in [[0.55, 0.08, -0.42], [0.45, -0.22, -0.72], [0.33, -0.5, -1.0]]:
		var t := PackedVector2Array([p + Vector2(-a[0] * s, a[1] * s), p + Vector2(a[0] * s, a[1] * s), p + Vector2(0, a[2] * s)])
		c.draw_colored_polygon(t, cor)
		t.append(t[0])
		c.draw_polyline(t, escuro, 1.0, true)

# o símbolo das áreas de plantio no mapa 2D: três pinheirinhos juntos (o do meio maior)
static func simbolo_plantio(c: CanvasItem, p: Vector2, s: float) -> void:
	pinho(c, p + Vector2(-s * 0.62, s * 0.1), s * 0.8, Color(0.29, 0.6, 0.25))
	pinho(c, p + Vector2(s * 0.62, s * 0.1), s * 0.8, Color(0.29, 0.6, 0.25))
	pinho(c, p + Vector2(0, -s * 0.05), s, Color(0.18, 0.5, 0.21))

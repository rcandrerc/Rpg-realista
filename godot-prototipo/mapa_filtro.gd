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
const AMARELO := Color(1.0, 0.77, 0.08)

var mostra := {} # camada -> false quando escondida (o que não está aqui aparece)
var aberto := false
var botao := Rect2()
var caixa := Rect2()
var _linhas := [] # [Rect2, camada]
var _tudo := Rect2()
var _nada := Rect2()
var _tex_plantio: ImageTexture
var _ret_plantio := Rect2() # metros (x, z) que a textura das áreas cobre

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
		var cor := AMARELO if cm[0] == "plantio" else Color(0.95, 0.91, 0.84)
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

# camada das áreas de plantio no mapa 2D: uma textura com um ponto por quadrado de 4 m (feita uma vez)
func textura_plantio(quads: Dictionary) -> ImageTexture:
	if _tex_plantio != null or quads.is_empty():
		return _tex_plantio
	var i0 := 1 << 30
	var k0 := 1 << 30
	var i1 := -(1 << 30)
	var k1 := -(1 << 30)
	for q in quads:
		i0 = mini(i0, q.x)
		k0 = mini(k0, q.y)
		i1 = maxi(i1, q.x)
		k1 = maxi(k1, q.y)
	var img := Image.create(i1 - i0 + 1, k1 - k0 + 1, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	for q in quads:
		img.set_pixel(q.x - i0, q.y - k0, Color(AMARELO, 0.8))
	_tex_plantio = ImageTexture.create_from_image(img)
	_ret_plantio = Rect2(i0 * 4.0, k0 * 4.0, (i1 - i0 + 1) * 4.0, (k1 - k0 + 1) * 4.0)
	return _tex_plantio

func ret_plantio() -> Rect2:
	return _ret_plantio

extends RefCounted
# Símbolo de cada NPC no mapa e no minimapa e a legenda do mapa (André 2026-11-12): "cada NPC com um títulozinho da
# função e um símbolo diferente no mapa para identificar de longe; e uma legenda num canto do mapa". O título e o tipo de
# símbolo vêm do servidor (shared/dados.js cargoNpc e iconeNpc -> dados/mundo.json "cargo" e "icone"); aqui só o desenho.
# Cada símbolo é uma moeda escura com o anel na cor da função e o desenho branco no meio (bigorna, saco de moedas, frasco,
# martelinho do leilão, caixote, cruz, chave, livro, coroa, balão de fala). Tudo com draw_* (nada de textura nova: leve).
# minimapa.gd chama desenhar_mini / desenhar_mapa / legenda / toque; a lista dos NPCs visíveis sai a cada 1 s (cache).

const COR := {
	"ferreiro": Color("e0782a"), "loja": Color("d6a42e"), "alquimia": Color("9a5ad8"), "leilao": Color("2fa38a"),
	"pack": Color("a8703c"), "cura": Color("3fae5a"), "passe": Color("5f86b0"), "instrutor": Color("3f6fd6"),
	"chefe": Color("c8392f"), "conversa": Color("8c8a86"),
}
const NOME := {
	"ferreiro": "Ferreiro", "loja": "Comerciante", "alquimia": "Alquimista", "leilao": "Leiloeiro", "pack": "Mercador de pack",
	"cura": "Curandeira", "passe": "Guardião", "instrutor": "Instrutor (atributos)", "chefe": "Chefe da vila", "conversa": "Morador",
}
const ORDEM := ["chefe", "ferreiro", "loja", "alquimia", "leilao", "pack", "cura", "instrutor", "passe", "conversa"]
const ESCURO := Color(0.05, 0.04, 0.03, 0.9)
const BRANCO := Color(1, 0.97, 0.9)
const OURO := Color("c9a35a")

var m # main.gd
var _lista: Array = [] # [{x, z, icone, cargo, nome}] dos NPCs que aparecem agora
var _lista_t := -10.0
var legenda_aberta := true
var botao_legenda := Rect2() # na janela do mapa (local): tocar abre e fecha a legenda

func _init(principal) -> void:
	m = principal

# NPCs que aparecem no mapa: sem os que ainda não chegaram (depois) ou já saíram (ate) e sem os que estão na névoa
func lista() -> Array:
	var t: float = Time.get_ticks_msec() / 1000.0
	if t - _lista_t < 1.0:
		return _lista
	_lista_t = t
	_lista = []
	var nv = m.get("nevoa")
	for n in m.mundo.get("npcs", []):
		if not n.has("x"):
			continue
		if nv != null and n.get("depois") != null and not nv.npc_apareceu(str(n.depois)):
			continue
		if nv != null and n.get("ate") != null and nv.npc_apareceu(str(n.ate)):
			continue
		var x := float(n.x)
		var z := float(n.z)
		if nv != null and nv.fechado(x, z):
			continue
		var ic := str(n.get("icone", "conversa"))
		_lista.append({"x": x, "z": z, "icone": ic if COR.has(ic) else "conversa", "cargo": str(n.get("cargo", "")),
			"nome": str(n.get("nome", "")).get_slice(",", 0)})
	# quem só conversa vai primeiro: os de função são desenhados por cima e têm a preferência quando encostam
	_lista.sort_custom(func(a, b): return ORDEM.find(a.icone) > ORDEM.find(b.icone))
	return _lista

# o símbolo: r = raio da moeda em px
func desenhar(c: CanvasItem, q: Vector2, icone: String, r: float) -> void:
	var cor: Color = COR.get(icone, COR.conversa)
	c.draw_circle(q, r + 1.6, ESCURO)
	c.draw_circle(q, r, cor)
	c.draw_circle(q, r * 0.82, cor.darkened(0.35))
	var s := r * 0.78 # o desenho cabe num quadrado de 2s
	var w: float = maxf(1.2, r * 0.16)
	match icone:
		"ferreiro": # bigorna com o chifre à esquerda
			c.draw_colored_polygon(_p(q, s, [[-0.95, -0.35], [0.7, -0.35], [0.75, -0.05], [0.25, 0.02], [0.18, 0.32], [0.55, 0.62],
				[-0.55, 0.62], [-0.18, 0.32], [-0.25, 0.02], [-0.45, -0.05]]), BRANCO)
		"loja": # saco de moedas amarrado
			c.draw_circle(q + Vector2(0, 0.22) * s, 0.55 * s, BRANCO)
			c.draw_colored_polygon(_p(q, s, [[-0.42, -0.72], [0.42, -0.72], [0.18, -0.3], [-0.18, -0.3]]), BRANCO)
			c.draw_line(q + Vector2(-0.28, -0.3) * s, q + Vector2(0.28, -0.3) * s, cor.darkened(0.5), w)
			c.draw_circle(q + Vector2(0, 0.25) * s, 0.2 * s, cor)
		"alquimia": # frasco redondo com gargalo e rolha
			c.draw_rect(Rect2(q + Vector2(-0.16, -0.62) * s, Vector2(0.32, 0.5) * s), BRANCO)
			c.draw_rect(Rect2(q + Vector2(-0.24, -0.82) * s, Vector2(0.48, 0.2) * s), BRANCO)
			c.draw_circle(q + Vector2(0, 0.28) * s, 0.55 * s, BRANCO)
			c.draw_circle(q + Vector2(0, 0.4) * s, 0.36 * s, Color("c9a2ff"))
		"leilao": # martelinho do leiloeiro em cima do bloco
			c.draw_colored_polygon(_r(q, s, Vector2(-0.12, -0.28), Vector2(0.95, 0.36), -0.65), BRANCO)
			c.draw_line(q + Vector2(-0.05, -0.2) * s, q + Vector2(0.5, 0.38) * s, BRANCO, w * 1.3)
			c.draw_rect(Rect2(q + Vector2(-0.8, 0.5) * s, Vector2(0.9, 0.28) * s), BRANCO)
		"pack": # caixote de madeira
			c.draw_rect(Rect2(q + Vector2(-0.7, -0.62) * s, Vector2(1.4, 1.24) * s), BRANCO)
			c.draw_rect(Rect2(q + Vector2(-0.5, -0.42) * s, Vector2(1.0, 0.84) * s), cor.darkened(0.1))
			c.draw_line(q + Vector2(-0.5, -0.42) * s, q + Vector2(0.5, 0.42) * s, BRANCO, w)
			c.draw_line(q + Vector2(-0.5, 0.42) * s, q + Vector2(0.5, -0.42) * s, BRANCO, w)
		"cura": # cruz
			c.draw_rect(Rect2(q + Vector2(-0.22, -0.72) * s, Vector2(0.44, 1.44) * s), BRANCO)
			c.draw_rect(Rect2(q + Vector2(-0.72, -0.22) * s, Vector2(1.44, 0.44) * s), BRANCO)
		"passe": # chave
			c.draw_arc(q + Vector2(-0.42, 0) * s, 0.3 * s, 0, TAU, 16, BRANCO, w * 1.4, true)
			c.draw_line(q + Vector2(-0.12, 0) * s, q + Vector2(0.8, 0) * s, BRANCO, w * 1.4)
			c.draw_line(q + Vector2(0.55, 0) * s, q + Vector2(0.55, 0.32) * s, BRANCO, w * 1.3)
			c.draw_line(q + Vector2(0.78, 0) * s, q + Vector2(0.78, 0.3) * s, BRANCO, w * 1.3)
		"instrutor": # livro aberto
			c.draw_colored_polygon(_p(q, s, [[-0.85, -0.5], [-0.06, -0.38], [-0.06, 0.62], [-0.85, 0.5]]), BRANCO)
			c.draw_colored_polygon(_p(q, s, [[0.85, -0.5], [0.06, -0.38], [0.06, 0.62], [0.85, 0.5]]), BRANCO)
		"chefe": # coroa
			c.draw_colored_polygon(_p(q, s, [[-0.8, 0.5], [-0.8, -0.5], [-0.4, -0.05], [0, -0.65], [0.4, -0.05], [0.8, -0.5], [0.8, 0.5]]), BRANCO)
			c.draw_circle(q + Vector2(0, 0.22) * s, 0.13 * s, cor)
		_: # balão de fala (morador que conversa e dá dica)
			c.draw_circle(q + Vector2(0, -0.1) * s, 0.6 * s, BRANCO)
			c.draw_colored_polygon(_p(q, s, [[-0.35, 0.25], [-0.05, 0.35], [-0.55, 0.8]]), BRANCO)
			for i in 3:
				c.draw_circle(q + Vector2(-0.28 + i * 0.28, -0.1) * s, 0.08 * s, cor.darkened(0.35))

func _p(q: Vector2, s: float, pts: Array) -> PackedVector2Array:
	var r := PackedVector2Array()
	for v in pts:
		r.append(q + Vector2(v[0], v[1]) * s)
	return r

func _r(q: Vector2, s: float, meio: Vector2, tam: Vector2, ang: float) -> PackedVector2Array:
	var r := PackedVector2Array()
	for v in [Vector2(-0.5, -0.5), Vector2(0.5, -0.5), Vector2(0.5, 0.5), Vector2(-0.5, 0.5)]:
		r.append(q + (meio + (v * tam).rotated(ang)) * s)
	return r

# minimapa redondo: os NPCs dentro do círculo (meio, p = herói, k = px por metro, raio em px)
func desenhar_mini(c: CanvasItem, meio: Vector2, p: Vector3, k: float, raio: float) -> void:
	var feitos: Array = []
	for n in lista():
		var q: Vector2 = meio + Vector2(n.x - p.x, n.z - p.z) * k
		if q.distance_to(meio) > raio - 9.0:
			continue
		var r := 5.5 if n.icone != "conversa" else 4.2
		if _encosta(q, feitos, r * 1.5):
			continue
		feitos.append(q)
		desenhar(c, q, n.icone, r)

# mapa completo: o símbolo e, de perto, o nome e o título embaixo. longe = afastado (as vilas viram um ponto só)
func desenhar_mapa(c: CanvasItem, em: Callable, k: float, longe: bool, fonte: Font, tam_janela: Vector2) -> void:
	if longe:
		return
	var feitos: Array = []
	var textos: Array = [] # Rect2 dos nomes já escritos (na vila os NPCs ficam juntos: nome que encosta não sai)
	var r: float = clampf(k * 2.4, 6.0, 11.0)
	var com_texto: bool = k >= 3.5 # perto o bastante para os nomes não se embolarem na vila
	for n in lista():
		var q: Vector2 = em.call(n.x, n.z)
		if q.x < -20.0 or q.y < -20.0 or q.x > tam_janela.x + 20.0 or q.y > tam_janela.y + 20.0:
			continue
		var rr: float = r if n.icone != "conversa" else r * 0.8
		if _encosta(q, feitos, rr * 1.6):
			continue
		feitos.append(q)
		desenhar(c, q, n.icone, rr)
		if com_texto and fonte:
			var w: float = maxf(fonte.get_string_size(n.nome, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x, fonte.get_string_size(n.cargo, HORIZONTAL_ALIGNMENT_LEFT, -1, 11).x)
			var caixa := Rect2(q + Vector2(-w * 0.5 - 3.0, rr + 2.0), Vector2(w + 6.0, 26.0))
			var bate := false
			for o in textos:
				if caixa.intersects(o):
					bate = true
					break
			if bate:
				continue
			textos.append(caixa)
			_texto(c, fonte, q + Vector2(0, rr + 10.0), n.nome, 12, BRANCO)
			if n.cargo != "":
				_texto(c, fonte, q + Vector2(0, rr + 22.0), n.cargo, 11, COR[n.icone].lightened(0.45))

func _encosta(q: Vector2, feitos: Array, d: float) -> bool:
	for f in feitos:
		if q.distance_squared_to(f) < d * d:
			return true
	return false

func _texto(c: CanvasItem, fonte: Font, pos: Vector2, t: String, tam: int, cor: Color) -> void:
	var w: float = fonte.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, tam).x
	var p := pos - Vector2(w * 0.5, -tam * 0.35)
	c.draw_string_outline(fonte, p, t, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, 4, ESCURO)
	c.draw_string(fonte, p, t, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, cor)

# legenda no canto de baixo à esquerda do mapa: os símbolos dos NPCs e os do mapa (totem, casa, caça, chefe, veio).
# mm = minimapa.gd (desenha os símbolos do mapa do mesmo jeito que no mapa). Fechada vira só o botão "Legenda".
func legenda(c: CanvasItem, mm, fonte: Font, tam_janela: Vector2) -> void:
	var linha := 19.0
	var mapa := [["totem", "Totem de teleporte"], ["casa", "Sua casa"], ["caca", "Caça (nível)"], ["boss", "Chefe do mundo"], ["veio", "Veio de minério"]]
	var col_w := 150.0
	var n_npc := ORDEM.size()
	var linhas: int = maxi(n_npc, mapa.size())
	var alto: float = 30.0 + linhas * linha + 8.0 if legenda_aberta else 30.0
	var largo: float = col_w * 2.0 + 16.0 if legenda_aberta else 104.0
	if legenda_aberta and tam_janela.y - 90.0 < alto: # tela baixa: uma coluna menor, só os NPCs
		linha = maxf(14.0, (tam_janela.y - 130.0) / float(n_npc))
		alto = 30.0 + n_npc * linha + 8.0
		largo = col_w + 12.0
		mapa = []
	var pos := Vector2(12.0, tam_janela.y - alto - 12.0)
	var caixa := Rect2(pos, Vector2(largo, alto))
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.08, 0.06, 0.04, 0.86)
	sb.border_color = OURO
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(12)
	sb.shadow_color = Color(0, 0, 0, 0.4)
	sb.shadow_size = 5
	sb.draw(c.get_canvas_item(), caixa)
	botao_legenda = Rect2(pos, Vector2(largo, 30.0))
	c.draw_string(fonte, pos + Vector2(12, 21), "Legenda", HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color("f4e6c4"))
	# setinha: aberta aponta para baixo, fechada para cima
	var sx := pos + Vector2(largo - 16.0, 15.0)
	var seta := [Vector2(-5, -3), Vector2(5, -3), Vector2(0, 3)] if legenda_aberta else [Vector2(-5, 3), Vector2(5, 3), Vector2(0, -3)]
	c.draw_colored_polygon(PackedVector2Array([sx + seta[0], sx + seta[1], sx + seta[2]]), OURO)
	if not legenda_aberta:
		return
	for i in n_npc:
		var ic: String = ORDEM[i]
		var q := pos + Vector2(20.0, 38.0 + i * linha)
		desenhar(c, q, ic, minf(7.0, linha * 0.38))
		c.draw_string(fonte, q + Vector2(14, 5), NOME[ic], HORIZONTAL_ALIGNMENT_LEFT, col_w - 30.0, 13, BRANCO)
	for i in mapa.size():
		var q := pos + Vector2(col_w + 20.0, 38.0 + i * linha)
		match mapa[i][0]:
			"totem": mm._marca_totem(c, q, 7.0, true)
			"casa": mm._marca_casa(c, q + Vector2(0, 1), 5.5)
			"caca": mm._marca_clareira(c, q, {"bicho": "lobo", "nivel": 5}, 6.5, true)
			"boss": _escudo(c, q, 6.5)
			"veio": c.draw_colored_polygon(PackedVector2Array([q + Vector2(0, -7), q + Vector2(6, 0), q + Vector2(0, 7), q + Vector2(-6, 0)]), Color("d9822b"))
		c.draw_string(fonte, q + Vector2(14, 5), mapa[i][1], HORIZONTAL_ALIGNMENT_LEFT, col_w - 30.0, 13, BRANCO)

# o escudo vermelho do chefe do mundo (o mesmo de minimapa.gd _marca_boss, sempre "vivo")
func _escudo(c: CanvasItem, q: Vector2, r: float) -> void:
	var e := PackedVector2Array([q + Vector2(-r, -r * 0.85), q + Vector2(r, -r * 0.85), q + Vector2(r * 0.9, r * 0.2), q + Vector2(0, r * 1.15), q + Vector2(-r * 0.9, r * 0.2)])
	var b := PackedVector2Array()
	for v in e:
		b.append(q + (v - q) * 1.22)
	c.draw_colored_polygon(b, Color("e9c46a"))
	c.draw_colored_polygon(e, Color("b4141e"))
	var a := r * 0.62
	for sg in [-1.0, 1.0]:
		c.draw_line(q + Vector2(-a * sg, -a * 0.8), q + Vector2(a * sg, a * 0.75), BRANCO, 1.5)

# toque na janela do mapa (lp local): true se foi no botão da legenda
func toque(lp: Vector2) -> bool:
	if botao_legenda.has_point(lp):
		legenda_aberta = not legenda_aberta
		return true
	return false

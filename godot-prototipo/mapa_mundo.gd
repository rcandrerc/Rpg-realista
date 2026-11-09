extends RefCounted
# FASE 3 (2026-11-09): o desenho de cima do mundo inteiro (Vael, o mar do meio, a ilha e Aurora) para o minimapa e o
# mapa completo. Feito aqui no app a partir da grade do mundo (dados/mundo_grade.json, a mesma do servidor), sem arquivo
# novo para baixar: relevo com sombra de encosta (luz do noroeste), pedra nas encostas fortes, areia na praia, o mar
# mais escuro onde é fundo, as estradas de terra e as copas da mata nova. O mapa de hoje (modelos/minimapa.png) fica por
# cima, nítido, no quadrado dele (minimapa.gd).

const PX := 3 # px por ponto da grade (a grade tem 4 m: 1,33 m por px, uns 1083 x 558 px, 2,4 MB)

static func imagem(g: Dictionary, mata: Array) -> Image:
	var nx: int = g.nx
	var nz: int = g.nz
	var passo: float = g.passo
	var h: PackedFloat32Array = g.h
	var terra: String = g.terra
	var base := Image.create(nx, nz, false, Image.FORMAT_RGB8)
	for j in nz:
		for i in nx:
			var k := j * nx + i
			var v: float = h[k]
			var cor: Color
			if v < 0.0 or terra[k] == "0" and v < 0.3:
				var t: float = clampf(-v / 6.0, 0.0, 1.0) # mar: raso claro, fundo escuro
				cor = Color8(92, 172, 190).lerp(Color8(26, 62, 102), t)
			else:
				var gx: float = (h[k + 1 if i < nx - 1 else k] - h[k - 1 if i > 0 else k]) / (2.0 * passo)
				var gz: float = (h[k + nx if j < nz - 1 else k] - h[k - nx if j > 0 else k]) / (2.0 * passo)
				var incl: float = sqrt(gx * gx + gz * gz)
				var luz: float = clampf(0.92 - (gx + gz) * 0.55, 0.55, 1.25)
				var alto: float = clampf(v / 60.0, 0.0, 1.0)
				cor = Color8(96, 138, 72).lerp(Color8(150, 156, 108), alto)
				if incl > 0.45:
					cor = cor.lerp(Color8(128, 120, 106), clampf((incl - 0.45) * 3.0, 0.0, 1.0))
				if v < 1.2 and _perto_do_mar(h, nx, nz, i, j):
					cor = Color8(212, 194, 148).lerp(cor, clampf(v / 1.2, 0.0, 1.0) * 0.4)
				cor = Color(cor.r * luz, cor.g * luz, cor.b * luz)
			base.set_pixel(i, j, cor)
	base.resize(nx * PX, nz * PX, Image.INTERPOLATE_CUBIC)
	var x0: float = g.x0
	var z0: float = g.z0
	var k_px: float = PX / passo
	# copas da mata nova (as de hoje já estão no desenho de hoje)
	for a in mata:
		if not a.get("mundo", false):
			continue
		var c := Vector2i(int((float(a.x) - x0) * k_px), int((float(a.z) - z0) * k_px))
		_bola(base, c, 2, Color8(34, 66, 38))
		_bola(base, c - Vector2i(1, 1), 0, Color8(70, 112, 60))
	# estradas: borda escura e o chão de terra por cima
	for e in g.get("estradas", []):
		var trilha := str(e.get("id", "")).begins_with("t_") # trilha (2026-11-09): mais fina que a estrada principal
		for camada in 2:
			for p in e.get("curva", []):
				var c := Vector2i(int((float(p[0]) - x0) * k_px), int((float(p[1]) - z0) * k_px))
				var r := (2 if camada == 0 else 1) if trilha else (3 if camada == 0 else 2)
				_bola(base, c, r, Color8(92, 70, 42) if camada == 0 else Color8(214, 184, 126))
	# lugares (vila, porto, posto e clareiras): chão batido mais claro
	for l in g.get("lugares", []):
		var tipo := str(l.get("tipo", ""))
		if tipo == "vila" or tipo == "porto" or tipo == "posto":
			var c := Vector2i(int((float(l.x) - x0) * k_px), int((float(l.z) - z0) * k_px))
			_bola(base, c, int(float(l.r) * k_px * 0.8), Color8(176, 160, 118), 0.55)
	return base

# praia só na beira do mar (o chão plano do mapa de hoje também tem altura 0)
static func _perto_do_mar(h: PackedFloat32Array, nx: int, nz: int, i: int, j: int) -> bool:
	for b in range(maxi(0, j - 3), mini(nz, j + 4)):
		for a in range(maxi(0, i - 3), mini(nx, i + 4)):
			if h[b * nx + a] < 0.0:
				return true
	return false

static func _bola(img: Image, c: Vector2i, r: int, cor: Color, a := 1.0) -> void:
	var w := img.get_width()
	var hh := img.get_height()
	for y in range(c.y - r, c.y + r + 1):
		if y < 0 or y >= hh:
			continue
		for x in range(c.x - r, c.x + r + 1):
			if x < 0 or x >= w or (x - c.x) * (x - c.x) + (y - c.y) * (y - c.y) > r * r + r:
				continue
			img.set_pixel(x, y, cor if a >= 1.0 else img.get_pixel(x, y).lerp(cor, a))

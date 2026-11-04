extends RefCounted
# Chão com pedras e casas: a mesma conta do servidor (shared/terreno.js), com os dados de dados/mundo.json
# (gerado por client/exportar-godot/mundo.mjs). Pedra baixa se sobe andando, alta se escala; telhado dá para andar em cima.

const ACIMA := 0.5 # peça suspensa vira chão quando a base dela está até isso acima dos pés

var m: Dictionary # mundo.json inteiro
var solidos: Array = []
var casas: Array = [] # só as peças de casa (para o teto)
var grades: Array = []

func _init(mundo: Dictionary) -> void:
	m = mundo
	for g in m.grades:
		grades.append({"x0": float(g.x0), "z0": float(g.z0), "passo": float(g.passo), "nx": int(g.nx), "nz": int(g.nz), "h": PackedFloat32Array(g.h)})
	for s in m.solidos:
		var r: Dictionary = s.duplicate()
		for k in r.keys():
			if typeof(r[k]) == TYPE_FLOAT or typeof(r[k]) == TYPE_INT:
				r[k] = float(r[k])
		if not r.casa:
			r.g = grades[int(r.grade)]
		solidos.append(r)
		if r.casa:
			casas.append(r)

func altura_casa(c: Dictionary, x: float, z: float) -> float:
	if c.has("cel"):
		return altura_telhado(c, x, z)
	var dx: float = x - c.x
	var dz: float = z - c.z
	if dx * dx + dz * dz > c.R * c.R:
		return -1.0
	var lx: float = dx * c.cos - dz * c.sen
	var lz: float = dx * c.sen + dz * c.cos
	if abs(lx) > c.hw or abs(lz) > c.hd:
		return -1.0
	return c.y1 + c.sobe * (1.0 - abs(lz) / c.hd)

# telhado das casas que o jogador constrói (construcao.gd _refazer_pisos): a mesma conta do servidor
# (shared/terreno.js alturaTelhado). Sobe com a distância até a borda de fora, com beiral.
static func altura_telhado(c: Dictionary, x: float, z: float) -> float:
	if x < c.x0 or x > c.x1 or z < c.z0 or z > c.z1:
		return -1.0
	var d := INF
	for s in c.seg:
		var vx: float = s[2] - s[0]
		var vz: float = s[3] - s[1]
		var t := clampf(((x - s[0]) * vx + (z - s[1]) * vz) / (vx * vx + vz * vz), 0.0, 1.0)
		d = minf(d, Vector2(x - s[0] - vx * t, z - s[1] - vz * t).length())
	var dentro := false
	for q in c.cel:
		if absf(x - q[0]) <= c.g + 0.001 and absf(z - q[1]) <= c.g + 0.001:
			dentro = true
			break
	if not dentro:
		if d > c.beiral:
			return -1.0
		d = -d
	return c.base + 0.2 + c.inclina * minf(d, c.max / c.inclina)

# para onde olhar ao agarrar a parede de uma casa (de frente para a parede mais perto)
func de_frente_para(c: Dictionary, x: float, z: float) -> float:
	var dx: float = x - c.x
	var dz: float = z - c.z
	var lx: float = dx * c.cos - dz * c.sen
	var lz: float = dx * c.sen + dz * c.cos
	var nx := 0.0
	var nz := 0.0
	if abs(lx) / c.hw > abs(lz) / c.hd:
		nx = -sign(lx)
	else:
		nz = -sign(lz)
	return atan2(nx * c.cos + nz * c.sen, -nx * c.sen + nz * c.cos)

# altura de uma pedra (ou peça de casa) num ponto; -1 fora dela. y = altura dos pés de quem pergunta
func altura_na(r: Dictionary, x: float, z: float, y := INF) -> float:
	if r.base > y + ACIMA:
		return -1.0
	if r.casa:
		return altura_casa(r, x, z)
	var dx: float = x - r.x
	var dz: float = z - r.z
	if dx * dx + dz * dz > r.R * r.R:
		return -1.0
	var g: Dictionary = r.g
	var lx: float = (dx * r.cos - dz * r.sen) / r.s
	var lz: float = (dx * r.sen + dz * r.cos) / r.s
	var fx: float = (lx - g.x0) / g.passo
	var fz: float = (lz - g.z0) / g.passo
	if fx < 0 or fz < 0 or fx > g.nx - 1 or fz > g.nz - 1:
		return -1.0
	var ix: int = min(g.nx - 2, int(floor(fx)))
	var iz: int = min(g.nz - 2, int(floor(fz)))
	var ax: float = fx - ix
	var az: float = fz - iz
	var hh: PackedFloat32Array = g.h
	var n: int = g.nx
	var v: float = (hh[iz * n + ix] * (1 - ax) + hh[iz * n + ix + 1] * ax) * (1 - az) + (hh[(iz + 1) * n + ix] * (1 - ax) + hh[(iz + 1) * n + ix + 1] * ax) * az
	return v / 100.0 * r.s + r.y0

func altura(x: float, z: float, y := INF) -> float:
	var h := 0.0
	for r in solidos:
		var a := altura_na(r, x, z, y)
		if a > h:
			h = a
	return h

# a parte de baixo da peça suspensa mais baixa acima de quem está ali (INF se céu aberto)
func teto(x: float, z: float, y: float) -> float:
	var t := INF
	for r in casas:
		if r.base > y + ACIMA and r.base < t and altura_casa(r, x, z) >= 0.0:
			t = r.base
	return t

func rocha_em(x: float, z: float, y: float):
	var melhor = null
	var h := 0.05
	for r in solidos:
		var a := altura_na(r, x, z, y)
		if a > h:
			h = a
			melhor = r
	return melhor

# maior altura à frente até "ate" metros e a distância até passar de "acima"
func frente(x: float, z: float, ry: float, ate: float, acima, y: float) -> Dictionary:
	var fx := sin(ry)
	var fz := cos(ry)
	var topo := 0.0
	var dist := -1.0
	var d := 0.1
	while d <= ate + 0.0001:
		var h := altura(x + fx * d, z + fz * d, y)
		if h > topo:
			topo = h
		if dist < 0 and acima != null and h > acima:
			dist = d
		d += 0.1
	return {"topo": topo, "dist": dist}

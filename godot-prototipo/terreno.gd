extends RefCounted
# Chão com pedras e casas: a mesma conta do servidor (shared/terreno.js), com os dados de dados/mundo.json
# (gerado por client/exportar-godot/mundo.mjs). Pedra baixa se sobe andando, alta se escala; telhado dá para andar em cima.

const ACIMA := 0.5 # peça suspensa vira chão quando a base dela está até isso acima dos pés

var m: Dictionary # mundo.json inteiro
var solidos: Array = []
var casas: Array = [] # só as peças de casa (para o teto)
var grades: Array = []
# relevo (lagos e montanha, 2026-11-05): a mesma conta de shared/relevo.js, com os dados do mundo.json
var lagos: Array = []
var agua := {"nivel": -0.05, "peito": 1.2, "lento": 0.62, "raso": 0.82}
var monte := {} # grade da montanha: x0, z0, passo, n, h (PackedFloat32Array)

func _init(mundo: Dictionary) -> void:
	m = mundo
	for l in m.get("lagos", []):
		lagos.append({"x": float(l.x), "z": float(l.z), "rx": float(l.rx), "rz": float(l.rz), "giro": float(l.giro), "fundo": float(l.fundo),
			"lobos": l.lobos, "R": maxf(float(l.rx), float(l.rz)) * 1.25, "c": cos(float(l.giro)), "s": sin(float(l.giro)), "nome": str(l.get("nome", ""))})
	if m.has("agua"):
		agua = m.agua
	var gm = m.get("montanha_grade")
	if gm != null:
		monte = {"x0": float(gm.x0), "z0": float(gm.z0), "passo": float(gm.passo), "n": int(gm.n), "h": PackedFloat32Array(gm.h)}
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

# ---------- relevo: lagos e montanha (shared/relevo.js) ----------
# 1 = na margem do lago; menos que 1 = dentro
static func margem_lago(L: Dictionary, x: float, z: float) -> float:
	var dx: float = x - L.x
	var dz: float = z - L.z
	var u: float = dx * L.c + dz * L.s
	var v: float = -dx * L.s + dz * L.c
	var ang := atan2(v / L.rz, u / L.rx)
	var k := 1.0
	for l in L.lobos:
		k *= 1.0 + float(l[1]) * sin(float(l[0]) * ang + float(l[2]))
	return Vector2(u / L.rx, v / L.rz).length() / k

static func _suave(a: float, b: float, t: float) -> float:
	var u := clampf((t - a) / (b - a), 0.0, 1.0)
	return u * u * (3.0 - 2.0 * u)

# {lago, fundo, d} ou vazio fora da água
func no_lago(x: float, z: float) -> Dictionary:
	for L in lagos:
		if absf(x - L.x) > L.R or absf(z - L.z) > L.R:
			continue
		var d := margem_lago(L, x, z)
		if d >= 1.0:
			continue
		var f: float = L.fundo
		var p: float = f * (0.12 * _suave(1.0, 0.85, d) + 0.88 * _suave(0.85, 0.35, d)) if f > 1.5 else f * _suave(1.0, 0.55, d) * (0.55 + 0.45 * _suave(0.55, 0.1, d))
		return {"lago": L, "fundo": p, "d": d}
	return {}

func altura_montanha(x: float, z: float) -> float:
	if monte.is_empty():
		return 0.0
	var fx: float = (x - monte.x0) / monte.passo
	var fz: float = (z - monte.z0) / monte.passo
	var n: int = monte.n
	if fx < 0.0 or fz < 0.0 or fx >= n - 1 or fz >= n - 1:
		return 0.0
	var ix := int(fx)
	var iz := int(fz)
	var ax := fx - ix
	var az := fz - iz
	var k := iz * n + ix
	var h: PackedFloat32Array = monte.h
	return (h[k] * (1.0 - ax) + h[k + 1] * ax) * (1.0 - az) + (h[k + n] * (1.0 - ax) + h[k + n + 1] * ax) * az

# altura de verdade do chão (desenho): montanha em cima, leito do lago embaixo
func relevo(x: float, z: float) -> float:
	var L := no_lago(x, z)
	return altura_montanha(x, z) - (float(L.fundo) if not L.is_empty() else 0.0)

# onde os pés ficam: igual ao relevo, menos na água funda (boia com a água no peito)
func chao_relevo(x: float, z: float) -> float:
	var mt := altura_montanha(x, z)
	var L := no_lago(x, z)
	if L.is_empty():
		return mt
	return maxf(mt - float(L.fundo), minf(mt, float(agua.nivel)) - float(agua.peito))

# quanto da água cobre quem está em (x, y, z) (0 = seco)
func agua_no_corpo(x: float, z: float, y: float) -> float:
	if lagos.is_empty() or no_lago(x, z).is_empty():
		return 0.0
	return maxf(0.0, float(agua.nivel) - y)

func altura(x: float, z: float, y := INF) -> float:
	var h := chao_relevo(x, z) if (not lagos.is_empty() or not monte.is_empty()) else 0.0
	for r in solidos:
		var a := altura_na(r, x, z, y)
		if a > h and a >= 0.0: # -1 = fora da peça (no lago o chão fica abaixo de -1)
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

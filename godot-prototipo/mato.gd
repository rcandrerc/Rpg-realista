extends Node3D
# Mato alto de verdade (André 2026-11-10: "os matos crescendo assim, mais mato mesmo, em vez de ser um chão pintado de
# verde", foto de referência com capim alto, samambaia e moita). A cor continua a do jogo (pintadinha); o que muda é
# que o chão ganha volume: touceiras de capim com folhas de verdade, umas mais altas, e samambaias soltas.
#
# Desempenho primeiro (Poco X7 e celulares mais fracos, como o Note 10 Lite):
# - só existe mato PERTO do herói: o chão em volta é picado em quadrados de CEL m e só os que ficam a menos de "raio"
#   metros ganham mato; andando, os de trás voltam para a fila e os da frente nascem (no máximo ORCAMENTO_US de conta
#   por quadro, nada de engasgo);
# - cada quadrado é um MultiMesh (a placa de vídeo desenha todas as touceiras de uma vez) e a câmera só desenha os
#   quadrados que vê; o capim são 3 cartas cruzadas com folhinhas desenhadas (12 triângulos por touceira); sem sombra;
# - longe a touceira encolhe até sumir (mato.gdshader), então não aparece a borda do círculo;
# - Qualidade gráfica (grafico.gd): Alta = mais denso e mais longe; Média menos; Baixa só um pouco em volta do herói,
#   sem samambaia.
# Onde nasce: no chão de grama. Não nasce em estrada e trilha, na água (lago, mar, rio e a beirada de terra deles), na
# areia da praia, em encosta de pedra, embaixo de casa, pedra, móvel (o chão ali é mais alto que o terreno) nem dentro
# dos lotes com construção ou horta. O sorteio de cada quadrado é sempre o mesmo (semente pelo quadrado).

const CEL := 16.0
const ORCAMENTO_US := 1000 # conta de mato por quadro (µs); o resto fica para o próximo quadro
const CACHE_MAX := 600 # quadrados já sorteados guardados (voltar por onde passou não refaz a conta)
# por nível de qualidade (grafico.gd BAIXA, MEDIA, ALTA): raio em m, touceiras por m² e samambaias por m²
const NIVEIS := [
	{"raio": 14.0, "dens": 0.55, "sam": 0.0},
	{"raio": 22.0, "dens": 0.95, "sam": 0.02},
	{"raio": 30.0, "dens": 1.4, "sam": 0.035},
]

var m # main.gd
var T # terreno.gd
var _mat: ShaderMaterial
var _malha_capim: ArrayMesh
var _mat_sam: ShaderMaterial # a samambaia é de malha (sem a textura do capim)
var _malha_samambaia: ArrayMesh
var _mascara: Image # relevo/mundo_mascara.png: R estradas, B chão do mapa de hoje
var _masc_area := Vector4()
var _nivel := -1
var P: Dictionary = NIVEIS[2]
var _vivos := {} # Vector2i -> [MultiMeshInstance3D capim, MultiMeshInstance3D samambaia ou null]
var _cache := {} # Vector2i -> [buffer capim, buffer samambaia]
var _fila: Array = [] # quadrados a montar, do mais perto para o mais longe
var _fazendo := {} # quadrado sendo sorteado aos poucos: {k, i, capim, sam, rng}
var _centro := Vector2i(999999, 999999)
var _sinal_obst := -1 # soma de peças e hortas de todos os lotes: igual = nada mudou, nem olha lote por lote
var _sinais := {} # lote -> sinal (peças e horta); mudou: só os quadrados daquele lote são sorteados de novo
var _refazer := {} # quadrados na tela que estão sendo sorteados de novo (o mato velho fica até o novo ficar pronto)
var _t_sinal := 0.0
var _matas: Array = [] # áreas de mata do mapa de hoje (chão de floresta: mato mais ralo)
var _livres: Array = [] # MultiMeshInstance3D sem uso (reaproveitados)

func _init(jogo) -> void:
	m = jogo
	T = jogo.terreno
	name = "Mato"

func _ready() -> void:
	_mat = ShaderMaterial.new()
	_mat.shader = load("res://mato.gdshader")
	_mat.set_shader_parameter("grama_tex", load("res://modelos/forrest_ground_01.jpg"))
	_mat_sam = _mat.duplicate()
	_mat.set_shader_parameter("capim_tex", load("res://mato_capim.png"))
	_mat.set_shader_parameter("com_textura", true)
	_malha_capim = _touceira_capim()
	_malha_samambaia = _touceira_samambaia()
	if not T.mundo_g.is_empty() and ResourceLoader.exists("res://relevo/mundo_mascara.png"):
		_mascara = load("res://relevo/mundo_mascara.png").get_image()
		if _mascara.is_compressed():
			_mascara.decompress()
		_masc_area = Vector4(float(T.mundo_g.x0) - 0.5, float(T.mundo_g.z0) - 0.5,
			(int(T.mundo_g.nx) - 1) * float(T.mundo_g.passo) + 1.0, (int(T.mundo_g.nz) - 1) * float(T.mundo_g.passo) + 1.0)
	for o in m.mundo.get("areas", []):
		if o.get("mata", false):
			_matas.append(o)

# ---------- malhas (uma touceira de cada, feita aqui: nada de arquivo de modelo) ----------

# Capim (2026-11-10, André: "parecendo uns fiapos de plástico, eu queria mais uns bush fininhos, igual a da foto"):
# em vez de folhas de malha, 3 cartas cruzadas com a textura mato_capim.png (centenas de folhinhas finas desenhadas,
# ferramentas/mato/textura_mato.py), recortadas no shader. Cada carta tem 2 gomos na altura para o vento dobrar.
# 12 triângulos por touceira (a de malha tinha 70): bem mais leve para a placa de vídeo.
# 1 m de largura e 1 m de altura (a escala de cada touceira ajusta). UV.x 0-1 na carta (o shader escolhe a metade
# da textura pela touceira), UV.y = altura (0 no pé, 1 em cima).
func _touceira_capim() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for q in 3:
		var ang := PI * q / 3.0 + 0.2
		var lado := Vector3(cos(ang), 0.0, sin(ang)) * 0.5
		var nrm := Vector3(-lado.z, 0.0, lado.x).normalized()
		for g in 2:
			var t0 := g / 2.0
			var t1 := (g + 1) / 2.0
			var a := -lado + Vector3(0, t0, 0)
			var b := lado + Vector3(0, t0, 0)
			var c := lado + Vector3(0, t1, 0)
			var e := -lado + Vector3(0, t1, 0)
			for v in [[a, 0.0, t0], [b, 1.0, t0], [c, 1.0, t1], [a, 0.0, t0], [c, 1.0, t1], [e, 0.0, t1]]:
				st.set_normal(nrm)
				st.set_uv(Vector2(v[1], v[2]))
				st.add_vertex(v[0])
	st.index()
	var mesh := st.commit()
	mesh.surface_set_material(0, _mat)
	return mesh

# Samambaia: 6 frondes em arco saindo do pé, cada uma com a haste e os folíolos (pares de triângulos) diminuindo até a
# ponta. Mais larga que alta (0,6 m de raio a escala 1).
func _touceira_samambaia() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rng := RandomNumberGenerator.new()
	rng.seed = 2220
	var n := 6
	for f in n:
		var ang := TAU * f / n + rng.randf_range(-0.3, 0.3)
		var dir := Vector3(cos(ang), 0.0, sin(ang))
		var lado := Vector3(-dir.z, 0.0, dir.x)
		var comp := rng.randf_range(0.45, 0.6)
		var sobe := rng.randf_range(0.32, 0.45)
		var pts: Array = []
		var segs := 7
		for s in segs + 1:
			var t := float(s) / segs
			# arco: sobe e depois cai, como a fronde da samambaia
			pts.append(dir * comp * t + Vector3(0.0, sobe * sin(t * PI * 0.8) * (1.0 - 0.25 * t), 0.0))
		var nrm := (Vector3.UP * 1.0 + dir * 0.3).normalized()
		for s in segs:
			var t := float(s) / segs
			var a: Vector3 = pts[s]
			var b: Vector3 = pts[s + 1]
			var hw := 0.012 * (1.0 - t)
			# haste
			_tri(st, a - lado * hw, a + lado * hw, b, t * 0.7 + 0.3, t * 0.7 + 0.3, (t + 1.0 / segs) * 0.7 + 0.3, nrm)
			if s == 0:
				continue
			# folíolos dos dois lados, para fora e um pouco para a frente, caindo
			var fol := 0.13 * sin(PI * (0.15 + 0.85 * t)) + 0.02
			for sg: float in [-1.0, 1.0]:
				var base := a.lerp(b, 0.15)
				var p := base + lado * sg * fol + dir * fol * 0.35 + Vector3(0.0, -fol * 0.25, 0.0)
				var q := a.lerp(b, 0.85)
				var h := 0.55 + 0.45 * t
				_tri(st, base, p, q, h, 1.0, h, nrm)
	st.index()
	var mesh := st.commit()
	mesh.surface_set_material(0, _mat_sam)
	return mesh

func _tri(st: SurfaceTool, a: Vector3, b: Vector3, c: Vector3, ha: float, hb: float, hc: float, nrm: Vector3) -> void:
	for v in [[a, ha], [b, hb], [c, hc]]:
		st.set_normal(nrm)
		st.set_uv(Vector2(0.0, v[1]))
		st.add_vertex(v[0])

# ---------- todo quadro: quais quadrados em volta do herói têm mato ----------

func _process(dt: float) -> void:
	if m.heroi == null:
		return
	var nv: int = m.grafico.nivel if m.grafico else 2
	if nv != _nivel:
		_nivel = nv
		P = NIVEIS[nv]
		for mt in [_mat, _mat_sam]:
			mt.set_shader_parameter("encolhe_de", P.raio * 0.7)
			mt.set_shader_parameter("encolhe_ate", P.raio)
		_limpar(false) # a densidade mudou: sorteia de novo
	var hp: Vector3 = m.heroi.global_position
	_mat.set_shader_parameter("pisa", Vector4(hp.x, hp.y, hp.z, 0.9))
	_mat_sam.set_shader_parameter("pisa", Vector4(hp.x, hp.y, hp.z, 0.9))
	_t_sinal -= dt
	if _t_sinal <= 0.0:
		_t_sinal = 2.0
		var sn := _sinal_obstaculos()
		if sn != _sinal_obst:
			_sinal_obst = sn
			_conferir_lotes()
	var c := Vector2i(floori(hp.x / CEL), floori(hp.z / CEL))
	if c != _centro:
		_centro = c
		_refazer_fila(hp)
	_trabalhar()

func _refazer_fila(hp: Vector3) -> void:
	var r: float = P.raio + 4.0 # o quadrado nasce um pouco antes de a touceira começar a aparecer
	var n := int(ceil(r / CEL))
	var quer := {}
	for j in range(-n, n + 1):
		for i in range(-n, n + 1):
			var k := _centro + Vector2i(i, j)
			var mx := (k.x + 0.5) * CEL
			var mz := (k.y + 0.5) * CEL
			# distância do herói ao ponto mais perto do quadrado
			var dx := maxf(0.0, absf(hp.x - mx) - CEL * 0.5)
			var dz := maxf(0.0, absf(hp.z - mz) - CEL * 0.5)
			if dx * dx + dz * dz <= r * r:
				quer[k] = dx * dx + dz * dz
	for k in _vivos.keys():
		if not quer.has(k):
			_soltar(k)
	_fila = quer.keys().filter(func(k): return not _vivos.has(k) or _refazer.has(k))
	_fila.sort_custom(func(a, b): return quer[a] < quer[b])
	if not _fazendo.is_empty() and not quer.has(_fazendo.k):
		_fazendo = {}

func _trabalhar() -> void:
	var t0 := Time.get_ticks_usec()
	while Time.get_ticks_usec() - t0 < ORCAMENTO_US:
		if _fazendo.is_empty():
			if _fila.is_empty():
				return
			var k: Vector2i = _fila.pop_front()
			if _vivos.has(k) and not _refazer.has(k):
				continue
			if _cache.has(k):
				_mostrar(k, _cache[k][0], _cache[k][1])
				continue
			var rng := RandomNumberGenerator.new()
			rng.seed = hash(Vector3i(k.x, k.y, 20261110))
			_fazendo = {"k": k, "i": 0, "n": int(CEL * CEL * NIVEIS[2].dens), "capim": PackedFloat32Array(),
				"sam": PackedFloat32Array(), "rng": rng}
		_sortear_um_pouco(t0)

# sorteia touceiras do quadrado em andamento até acabar o tempo do quadro. O sorteio é sempre o da Alta (mesma
# semente); a Média e a Baixa ficam com a fração do começo da lista (o mesmo mato, só mais ralo).
func _sortear_um_pouco(t0: int) -> void:
	var f: Dictionary = _fazendo
	var k: Vector2i = f.k
	var rng: RandomNumberGenerator = f.rng
	var frac: float = P.dens / NIVEIS[2].dens
	var frac_sam: float = P.sam / NIVEIS[2].sam
	while f.i < f.n:
		if Time.get_ticks_usec() - t0 >= ORCAMENTO_US:
			return
		f.i += 1
		var x := (k.x + rng.randf()) * CEL
		var z := (k.y + rng.randf()) * CEL
		var sorte := rng.randf()
		var giro := rng.randf() * TAU
		var esc := rng.randf()
		var esc_y := rng.randf()
		var tom := rng.randf()
		var tipo := rng.randf()
		var y := _chao_de_grama(x, z, sorte)
		if is_nan(y):
			continue
		if tipo < NIVEIS[2].sam / NIVEIS[2].dens:
			if sorte < frac_sam:
				var s := lerpf(0.75, 1.25, esc)
				var b := Basis(Vector3.UP, giro).scaled(Vector3(s, s * lerpf(0.85, 1.15, esc_y), s))
				_por(f.sam, b, Vector3(x, y - 0.02, z), _cor_samambaia(tom))
			continue
		if sorte >= frac:
			continue
		# capim: a maioria até o joelho, algumas touceiras mais altas (como na foto); 1 em 4 é o capim de beira
		# (folhas largas e pendões, a metade direita da textura: alfa da cor = 1)
		var s := lerpf(1.0, 1.5, esc)
		var alto := lerpf(0.4, 0.68, esc_y)
		if esc_y > 0.8:
			alto = lerpf(0.8, 1.05, (esc_y - 0.8) / 0.2)
		var b := Basis(Vector3.UP, giro).scaled(Vector3(s, alto, s))
		var cor := _cor_capim(tom, x, z)
		cor.a = 1.0 if tipo > 0.75 else 0.0
		_por(f.capim, b, Vector3(x, y - 0.04, z), cor)
	_cache[k] = [f.capim, f.sam]
	if _cache.size() > CACHE_MAX:
		_cache.erase(_cache.keys()[0])
	_fazendo = {}
	_mostrar(k, f.capim, f.sam)

# PALETA da grama do jogo (main.gd montar_grama: hsl 0,22-0,27 / 0,45-0,62 / 0,3-0,46), em manchas: umas touceiras
# mais secas, amareladas, como na foto
func _cor_capim(t: float, x: float, z: float) -> Color:
	var mancha := sin(x * 0.07 + sin(z * 0.05) * 2.0) * 0.5 + 0.5
	var h := lerpf(0.27, 0.2, mancha * 0.6 + t * 0.4)
	var c: Color = m.hsl(h, lerpf(0.45, 0.6, t), lerpf(0.3, 0.44, t))
	if t > 0.9:
		c = m.hsl(0.15, 0.42, 0.48) # palha seca solta
	return c

func _cor_samambaia(t: float) -> Color:
	return m.hsl(lerpf(0.25, 0.3, t), lerpf(0.42, 0.55, t), lerpf(0.28, 0.38, t))

func _por(buf: PackedFloat32Array, b: Basis, o: Vector3, c: Color) -> void:
	buf.append_array(PackedFloat32Array([b.x.x, b.y.x, b.z.x, o.x, b.x.y, b.y.y, b.z.y, o.y, b.x.z, b.y.z, b.z.z, o.z, c.r, c.g, c.b, c.a]))

# altura do chão em (x, z) se ali é chão de grama aberto; NAN onde o mato não nasce
func _chao_de_grama(x: float, z: float, sorte: float) -> float:
	var mapa_hoje := true
	if _mascara:
		var i := int((x - _masc_area.x) / _masc_area.z * _mascara.get_width())
		var j := int((z - _masc_area.y) / _masc_area.w * _mascara.get_height())
		if i >= 0 and j >= 0 and i < _mascara.get_width() and j < _mascara.get_height():
			var c := _mascara.get_pixel(i, j)
			if c.r > 0.12 + sorte * 0.25: # estrada (a borda fica rala, não reta)
				return NAN
			mapa_hoje = c.b > 0.5
	if mapa_hoje:
		if m.peso_vila(x, z) > 0.2 or m.fora_do_plano(x, z):
			return NAN
		# chão de floresta: bem mais ralo que o campo
		for o in _matas:
			var dx: float = x - float(o.x)
			var dz: float = z - float(o.z)
			if dx * dx + dz * dz < float(o.rx) * float(o.rx) and sorte > 0.3:
				return NAN
	else:
		var hm: float = T.altura_mundo(x, z)
		if hm < 1.7: # areia da praia e beira do mar (terreno_mundo.gdshader praia)
			return NAN
		# encosta de pedra: o chão do mundo vira cascalho e rocha (terreno_mundo.gdshader pr)
		var gx: float = T.altura_mundo(x + 1.5, z) - T.altura_mundo(x - 1.5, z)
		var gz: float = T.altura_mundo(x, z + 1.5) - T.altura_mundo(x, z - 1.5)
		if gx * gx + gz * gz > 1.1 * 1.1:
			return NAN
		if T.mundo_g.get("rio", "") != "":
			var gi := int(round((x - float(T.mundo_g.x0)) / float(T.mundo_g.passo)))
			var gj := int(round((z - float(T.mundo_g.z0)) / float(T.mundo_g.passo)))
			if gi >= 0 and gj >= 0 and gi < int(T.mundo_g.nx) and gj < int(T.mundo_g.nz) and str(T.mundo_g.rio).unicode_at(gj * int(T.mundo_g.nx) + gi) > 48:
				return NAN # rio e barranco
	if not T.no_lago(x, z).is_empty():
		return NAN
	var base: float = T.chao_relevo(x, z)
	var h: float = T.altura(x, z)
	if h > base + 0.05: # casa, pedra, móvel, cais...
		return NAN
	if _encosta_em_solido(x, z, base): # 2026-11-11 (André: "as gramas novas se sobressaindo no chão das casas")
		return NAN
	if _no_lote(x, z) or m.no_totem(x, z): # terreno com obra e pedra do totem de teleporte
		return NAN
	return h

# a touceira tem ~0,5 m de raio: com o pé fora da casa (ou pedra, móvel, piso) as folhas entravam pelo chão de dentro.
# Agora o mato só nasce a mais de FOLGA_SOLIDO de qualquer peça que vira chão (olha em 8 pontos em volta).
const FOLGA_SOLIDO := 0.75
const _VOLTA := [Vector2(1, 0), Vector2(-1, 0), Vector2(0, 1), Vector2(0, -1), Vector2(0.71, 0.71), Vector2(-0.71, 0.71), Vector2(0.71, -0.71), Vector2(-0.71, -0.71)]
func _encosta_em_solido(x: float, z: float, base: float) -> bool:
	# casa (vila e vilas do mundo): a planta inteira mais a folga, mesmo onde o chão de dentro é na altura do terreno
	for c in T.casas_em(x, z):
		if c.has("cel") or not c.has("hw"):
			continue
		var dx: float = x - float(c.x)
		var dz: float = z - float(c.z)
		if absf(dx * c.cos - dz * c.sen) < float(c.hw) + FOLGA_SOLIDO and absf(dx * c.sen + dz * c.cos) < float(c.hd) + FOLGA_SOLIDO:
			return true
	for v in _VOLTA:
		var px: float = x + v.x * FOLGA_SOLIDO
		var pz: float = z + v.y * FOLGA_SOLIDO
		for r in T.solidos_em(px, pz):
			if T.altura_na(r, px, pz) > base + 0.05:
				return true
	return false

# lote com construção ou horta (construcao.gd lotes): ali dentro o mato não nasce
func _no_lote(x: float, z: float) -> bool:
	var cons = m.get("construcao")
	if cons == null:
		return false
	for id in cons.lotes:
		var L: Dictionary = cons.lotes[id]
		if L.pecas.is_empty() and L.horta.is_empty():
			continue
		var d: Dictionary = L.def
		if x >= float(d.x0) - 1.0 and x <= float(d.x1) + 1.0 and z >= float(d.z0) - 1.0 and z <= float(d.z1) + 1.0: # 1 m: a touceira não entra no lote
			return true
	return false

# 2026-11-10 (André: "perda de performance entrando na cidade"): antes qualquer peça ou planta nova em qualquer lote
# (a cidade tem muitos, e a horta muda sozinha) apagava TODO o mato e sorteava tudo de novo, sem parar. Agora só os
# quadrados que encostam no lote que mudou são refeitos, e o mato velho continua na tela até o novo ficar pronto.
func _conferir_lotes() -> void:
	var cons = m.get("construcao")
	if cons == null:
		return
	for id in cons.lotes:
		var L: Dictionary = cons.lotes[id]
		var s: int = L.pecas.size() * 31 + L.horta.size()
		var antes: int = _sinais.get(id, -1)
		_sinais[id] = s
		if antes == -1 or antes == s:
			continue
		var d: Dictionary = L.def
		for j in range(floori((float(d.z0) - 1.0) / CEL), floori((float(d.z1) + 1.0) / CEL) + 1):
			for i in range(floori((float(d.x0) - 1.0) / CEL), floori((float(d.x1) + 1.0) / CEL) + 1):
				var k := Vector2i(i, j)
				_cache.erase(k)
				if _vivos.has(k) and not _refazer.has(k):
					_refazer[k] = true
					_fila.push_front(k)

func _sinal_obstaculos() -> int:
	var s: int = T.solidos.size() * 7919
	var cons = m.get("construcao")
	if cons != null:
		for id in cons.lotes:
			s += cons.lotes[id].pecas.size() * 31 + cons.lotes[id].horta.size()
	return s

# ---------- montar e soltar os quadrados ----------

func _mostrar(k: Vector2i, capim: PackedFloat32Array, sam: PackedFloat32Array) -> void:
	if _vivos.has(k): # refeito (lote mudou): troca o velho pelo novo
		_soltar(k)
	_refazer.erase(k)
	_vivos[k] = [_instancia(_malha_capim, capim), _instancia(_malha_samambaia, sam) if P.sam > 0.0 else null]

func _instancia(malha: Mesh, buf: PackedFloat32Array) -> MultiMeshInstance3D:
	if buf.is_empty():
		return null
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = malha
	mm.instance_count = buf.size() / 16
	mm.buffer = buf
	var g: MultiMeshInstance3D = _livres.pop_back() if not _livres.is_empty() else null
	if g == null:
		g = MultiMeshInstance3D.new()
		g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(g)
	g.multimesh = mm
	g.visible = true
	return g

func _soltar(k: Vector2i) -> void:
	for g in _vivos[k]:
		if g != null:
			g.visible = false
			g.multimesh = null
			_livres.append(g)
	_vivos.erase(k)
	_refazer.erase(k)

# troca de qualidade ou obstáculo novo: sorteia tudo de novo
func _limpar(_x := false) -> void:
	for k in _vivos.keys():
		_soltar(k)
	_cache.clear()
	_refazer.clear()
	_fazendo = {}
	_centro = Vector2i(999999, 999999)

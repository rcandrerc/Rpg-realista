extends Node3D
# Chão do mundo grande (FASE 3, André 2026-11-08): Vael, a Ilha do Meio e Aurora em volta do mapa de hoje, e o mar.
# Alturas da grade do terreno.gd (dados/mundo_grade.json, a mesma conta do servidor: shared/mundo.js). O mapa de hoje
# (onde a grade vale 0) continua com o chão plano do main.gd; aqui sai só o resto, em pedaços de PEDACO x PEDACO
# quadrados da grade (cada pedaço é uma malha: a câmera só desenha os que vê, e os longe somem com a névoa).
# O mar é uma água por pedaço, só onde o fundo fica abaixo da linha d'água (não passa por cima da terra nem dos lagos).

const PEDACO := 32 # quadrados da grade por pedaço (32 x 4 m = 128 m)
const LONGE := 1100.0 # m: além disso o pedaço some (a névoa já apagou)
# 2026-11-09 (mundo 2x maior, celular): perto o pedaço tem a grade inteira (4 m); passando de PERTO m da câmera ele
# troca por uma malha de 16 m (1/16 dos triângulos, sem sombra) com uma saia em volta para não abrir fresta na emenda
const PERTO := 300.0
const PASSO_LONGE := 4

var T # terreno.gd
var _mat_chao: ShaderMaterial
var _mat_mar: ShaderMaterial

func _init(terreno) -> void:
	T = terreno
	name = "MundoGrande"

func _ready() -> void:
	if T.mundo_g.is_empty():
		return
	_mat_chao = ShaderMaterial.new()
	_mat_chao.shader = load("res://terreno_mundo.gdshader")
	_mat_chao.set_shader_parameter("grama_tex", load("res://modelos/forrest_ground_01.jpg"))
	_mat_chao.set_shader_parameter("pedra_tex", load("res://relevo/rocky_terrain_02.jpg"))
	_mat_chao.set_shader_parameter("areia_tex", load("res://modelos/stony_dirt_path.jpg"))
	_mat_chao.set_shader_parameter("terra_tex", load("res://modelos/stony_dirt_path.jpg")) # estradas (a mesma terra das trilhas de hoje)
	T.ligar_mascara(_mat_chao) # estradas com a borda macia dos dois lados (máscara de 1 m)
	_mat_mar = ShaderMaterial.new()
	_mat_mar.shader = load("res://agua.gdshader")
	_mat_mar.set_shader_parameter("fundo_lago", 6.0)
	var g: Dictionary = T.mundo_g
	for pj in range(0, int(g.nz) - 1, PEDACO):
		for pi in range(0, int(g.nx) - 1, PEDACO):
			_pedaco(pi, pj)
	_mar_aberto()
	_cais()
	_rios()
	_pontes()

# FASE 3, Parte 7b: os cais de madeira dos portos (mundo.cais, o mesmo tablado onde o servidor deixa andar): tábuas de
# madeira de verdade (construcao3d/medieval_wood), vigas dos lados e os esteios entrando no mar. 2 malhas por cais.
func _cais() -> void:
	var lista: Array = T.m.get("cais", [])
	if lista.is_empty():
		return
	var mat := _madeira()
	var esteio := CylinderMesh.new()
	esteio.top_radius = 0.13
	esteio.bottom_radius = 0.15
	esteio.height = 5.0
	esteio.radial_segments = 8
	esteio.material = mat
	for c in lista:
		var no := Node3D.new()
		no.name = str(c.id)
		no.position = Vector3(float(c.x), 0.0, float(c.z))
		no.rotation.y = float(c.ry)
		add_child(no)
		var w: float = c.w
		var d: float = c.d
		var y1: float = c.y1
		var tab := MeshInstance3D.new() # tablado e as duas vigas da beira numa malha só
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		for caixa in [[0.0, y1 - 0.09, w, 0.18], [-w / 2.0 + 0.1, y1 - 0.3, 0.2, 0.3], [w / 2.0 - 0.1, y1 - 0.3, 0.2, 0.3]]:
			var bm := BoxMesh.new()
			bm.size = Vector3(caixa[2], caixa[3], d)
			st.append_from(bm, 0, Transform3D(Basis(), Vector3(caixa[0], caixa[1], 0.0)))
		st.set_material(mat)
		tab.mesh = st.commit()
		tab.visibility_range_end = 260.0
		no.add_child(tab)
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = esteio
		var n := int(d / 3.0) + 1
		mm.instance_count = n * 2
		for i in n:
			for lado in 2:
				var z: float = -d / 2.0 + 0.4 + i * (d - 0.8) / maxf(1.0, n - 1)
				mm.set_instance_transform(i * 2 + lado, Transform3D(Basis(), Vector3((lado * 2 - 1) * (w / 2.0 - 0.1), y1 - 2.6, z)))
		var mi := MultiMeshInstance3D.new()
		mi.multimesh = mm
		mi.visibility_range_end = 260.0
		no.add_child(mi)

# depois da grade é mar até o horizonte: uma moldura de 4 quadrados em volta dela, no nível da água
func _mar_aberto() -> void:
	var g: Dictionary = T.mundo_g
	var x0: float = g.x0
	var z0: float = g.z0
	var x1: float = x0 + (int(g.nx) - 1) * float(g.passo)
	var z1: float = z0 + (int(g.nz) - 1) * float(g.passo)
	var L := 5000.0
	var y: float = T.agua.nivel
	var vs := PackedVector3Array()
	var idx := PackedInt32Array()
	for q in [[x0 - L, z0 - L, x1 + L, z0], [x0 - L, z1, x1 + L, z1 + L], [x0 - L, z0, x0, z1], [x1, z0, x1 + L, z1]]:
		var k := vs.size()
		vs.append_array([Vector3(q[0], y, q[1]), Vector3(q[2], y, q[1]), Vector3(q[0], y, q[3]), Vector3(q[2], y, q[3])])
		idx.append_array([k, k + 1, k + 3, k, k + 3, k + 2])
	var ns := PackedVector3Array()
	for v in vs:
		ns.append(Vector3.UP)
	var mi := _malha("MarAberto", vs, ns, idx, _mat_mar, false)
	mi.visibility_range_end = 0.0
	add_child(mi)

func _pedaco(i0: int, j0: int) -> void:
	var g: Dictionary = T.mundo_g
	var nx: int = g.nx
	var h: PackedFloat32Array = g.h
	var passo: float = g.passo
	var i1 := mini(i0 + PEDACO, nx - 1)
	var j1 := mini(j0 + PEDACO, int(g.nz) - 1)
	var w := i1 - i0 + 1
	var vs := PackedVector3Array()
	var ns := PackedVector3Array()
	var cs := PackedColorArray() # r = estrada de terra (shared/mundo.js abrirEstradas)
	var idx := PackedInt32Array()
	var agua := PackedInt32Array()
	var est: String = g.estrada
	var rio: String = g.get("rio", "")
	var praia: String = g.get("praia", "") # 0-9: areia da praia só perto do mar (sem a grade velha: em todo chão baixo)
	for j in range(j0, j1 + 1):
		for i in range(i0, i1 + 1):
			var y: float = h[j * nx + i]
			# perto de 0 (a emenda com o mapa de hoje) fica um tiquinho embaixo do chão plano: sem briga de desenho
			vs.append(Vector3(float(g.x0) + i * passo, y if absf(y) > 0.08 else y - 0.06, float(g.z0) + j * passo))
			var hx: float = h[j * nx + mini(nx - 1, i + 1)] - h[j * nx + maxi(0, i - 1)]
			var hz: float = h[mini(int(g.nz) - 1, j + 1) * nx + i] - h[maxi(0, j - 1) * nx + i]
			ns.append(Vector3(-hx, 2.0 * passo, -hz).normalized())
			cs.append(Color(float(est.unicode_at(j * nx + i) - 48) / 9.0 if est.length() > j * nx + i else 0.0,
				float(rio.unicode_at(j * nx + i) - 48) / 9.0 if rio.length() > j * nx + i else 0.0,
				float(praia.unicode_at(j * nx + i) - 48) / 9.0 if praia.length() > j * nx + i else 1.0)) # g = leito do rio, b = beira do mar
	for j in range(j1 - j0):
		for i in range(w - 1):
			var a := j * w + i
			var b := a + 1
			var c := a + w
			var d := c + 1
			var ha: float = h[(j + j0) * nx + i + i0]
			var hb: float = h[(j + j0) * nx + i + i0 + 1]
			var hc: float = h[(j + j0 + 1) * nx + i + i0]
			var hd: float = h[(j + j0 + 1) * nx + i + i0 + 1]
			if ha == 0.0 and hb == 0.0 and hc == 0.0 and hd == 0.0:
				continue # o mapa de hoje: o chão plano já desenha
			if absf(vs[a].y - vs[d].y) < absf(vs[b].y - vs[c].y):
				idx.append_array([a, b, d, a, d, c])
			else:
				idx.append_array([a, b, c, b, d, c])
			if minf(minf(ha, hb), minf(hc, hd)) < 0.0:
				agua.append_array([a, b, d, a, d, c])
	if idx.is_empty():
		return
	var perto := _malha("Chao_%d_%d" % [i0, j0], vs, ns, idx, _mat_chao, true, cs)
	perto.visibility_range_end = PERTO
	perto.visibility_range_end_margin = 20.0
	add_child(perto)
	_pedaco_longe(i0, j0, i1, j1)
	if not agua.is_empty(): # água plana na linha d'água, só nos quadrados que têm fundo de mar (em quadrados de 16 m)
		_agua_longe(i0, j0, i1, j1)

# os índices da grade de PASSO_LONGE em PASSO_LONGE de a até b (o último é sempre b)
func _passos(a: int, b: int) -> Array:
	var r := []
	for i in range(a, b, PASSO_LONGE):
		r.append(i)
	r.append(b)
	return r

# o mesmo pedaço visto de longe: grade de 16 m e uma saia de 4 m para baixo na borda
func _pedaco_longe(i0: int, j0: int, i1: int, j1: int) -> void:
	var g: Dictionary = T.mundo_g
	var nx: int = g.nx
	var nz: int = g.nz
	var h: PackedFloat32Array = g.h
	var passo: float = g.passo
	var rio: String = g.get("rio", "")
	var praia: String = g.get("praia", "")
	var xs := _passos(i0, i1)
	var zs := _passos(j0, j1)
	var w := xs.size()
	var vs := PackedVector3Array()
	var ns := PackedVector3Array()
	var cs := PackedColorArray()
	var idx := PackedInt32Array()
	for j in zs:
		for i in xs:
			var k: int = j * nx + i
			var y: float = h[k]
			vs.append(Vector3(float(g.x0) + i * passo, y if absf(y) > 0.08 else y - 0.06, float(g.z0) + j * passo))
			var hx: float = h[j * nx + mini(nx - 1, i + PASSO_LONGE)] - h[j * nx + maxi(0, i - PASSO_LONGE)]
			var hz: float = h[mini(nz - 1, j + PASSO_LONGE) * nx + i] - h[maxi(0, j - PASSO_LONGE) * nx + i]
			ns.append(Vector3(-hx, 2.0 * passo * PASSO_LONGE, -hz).normalized())
			cs.append(Color(0, float(rio.unicode_at(k) - 48) / 9.0 if rio.length() > k else 0.0,
				float(praia.unicode_at(k) - 48) / 9.0 if praia.length() > k else 1.0))
	for b in zs.size() - 1:
		for a in w - 1:
			# o mapa de hoje (tudo 0 no quadrado inteiro): o chão plano já desenha
			var zero := true
			for jj in range(zs[b], zs[b + 1] + 1):
				for ii in range(xs[a], xs[a + 1] + 1):
					if h[jj * nx + ii] != 0.0:
						zero = false
						break
				if not zero:
					break
			if zero:
				continue
			var q := b * w + a
			idx.append_array([q, q + 1, q + w + 1, q, q + w + 1, q + w])
	if idx.is_empty():
		return
	# saia: cada vértice da borda ganha um par 4 m abaixo, e a parede fecha a fresta com o pedaço vizinho
	var borda := []
	for a in w:
		borda.append(a)
	for b in range(1, zs.size()):
		borda.append(b * w + w - 1)
	for a in range(w - 2, -1, -1):
		borda.append((zs.size() - 1) * w + a)
	for b in range(zs.size() - 2, 0, -1):
		borda.append(b * w)
	borda.append(0)
	var base := vs.size()
	for n in borda.size():
		var v: Vector3 = vs[borda[n]]
		vs.append(v - Vector3(0, 4.0, 0))
		ns.append(ns[borda[n]])
		cs.append(cs[borda[n]])
	for n in borda.size() - 1:
		var a2: int = borda[n]
		var b2: int = borda[n + 1]
		idx.append_array([a2, b2, base + n + 1, a2, base + n + 1, base + n, a2, base + n + 1, b2, a2, base + n, base + n + 1])
	var longe := _malha("ChaoLonge_%d_%d" % [i0, j0], vs, ns, idx, _mat_chao, false, cs)
	longe.visibility_range_begin = PERTO
	longe.visibility_range_begin_margin = 20.0
	add_child(longe)

func _agua_longe(i0: int, j0: int, i1: int, j1: int) -> void:
	var g: Dictionary = T.mundo_g
	var nx: int = g.nx
	var h: PackedFloat32Array = g.h
	var passo: float = g.passo
	var y: float = T.agua.nivel
	var xs := _passos(i0, i1)
	var zs := _passos(j0, j1)
	var vs := PackedVector3Array()
	var ns := PackedVector3Array()
	var idx := PackedInt32Array()
	for b in zs.size() - 1:
		for a in xs.size() - 1:
			var molhado := false
			for jj in range(zs[b], zs[b + 1] + 1):
				for ii in range(xs[a], xs[a + 1] + 1):
					if h[jj * nx + ii] < 0.0:
						molhado = true
						break
				if molhado:
					break
			if not molhado:
				continue
			var k := vs.size()
			var xa: float = float(g.x0) + xs[a] * passo
			var xb: float = float(g.x0) + xs[a + 1] * passo
			var za: float = float(g.z0) + zs[b] * passo
			var zb: float = float(g.z0) + zs[b + 1] * passo
			vs.append_array([Vector3(xa, y, za), Vector3(xb, y, za), Vector3(xa, y, zb), Vector3(xb, y, zb)])
			for n in 4:
				ns.append(Vector3.UP)
			idx.append_array([k, k + 1, k + 3, k, k + 3, k + 2])
	if not idx.is_empty():
		add_child(_malha("Mar_%d_%d" % [i0, j0], vs, ns, idx, _mat_mar, false))

func _malha(nome: String, vs: PackedVector3Array, ns: PackedVector3Array, idx: PackedInt32Array, mat: Material, sombra: bool, cs := PackedColorArray()) -> MeshInstance3D:
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = vs
	arr[Mesh.ARRAY_NORMAL] = ns
	if not cs.is_empty():
		arr[Mesh.ARRAY_COLOR] = cs
	arr[Mesh.ARRAY_INDEX] = idx
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var mi := MeshInstance3D.new()
	mi.name = nome
	mi.mesh = mesh
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if sombra else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.visibility_range_end = LONGE
	return mi

var _mat_madeira: StandardMaterial3D
func _madeira() -> StandardMaterial3D:
	if _mat_madeira == null:
		_mat_madeira = StandardMaterial3D.new()
		_mat_madeira.albedo_texture = load("res://construcao3d/medieval_wood_diff_1k.jpg")
		_mat_madeira.normal_enabled = true
		_mat_madeira.normal_texture = load("res://construcao3d/medieval_wood_nor_gl_1k.jpg")
		_mat_madeira.roughness = 0.85
		_mat_madeira.uv1_triplanar = true
		_mat_madeira.uv1_scale = Vector3(0.45, 0.45, 0.45)
	return _mat_madeira

# FASE 3, Parte 4b: a água de cada rio (uma fita no nível da água, rio abaixo) e a cachoeira (o trecho em que o nível
# despenca vira uma cortina de água caindo). O leito já vem aberto na grade (shared/mundo.js abrirRios).
const LARG_AGUA := 8.0
func _rios() -> void:
	var mat_rio := ShaderMaterial.new()
	mat_rio.shader = load("res://rio.gdshader")
	var mat_cai := ShaderMaterial.new()
	mat_cai.shader = load("res://cachoeira.gdshader")
	for R in T.mundo_g.get("rios", []):
		var C: Array = R.curva
		var cai = R.get("cachoeira")
		var ic: int = int(cai.i) if cai != null else -1
		var trechos := [[0, ic - 1], [ic, C.size() - 1]] if ic > 0 else [[0, C.size() - 1]]
		for tr in trechos:
			var mi := _fita(C, int(tr[0]), int(tr[1]), LARG_AGUA, 0.0)
			if mi != null:
				mi.material_override = mat_rio
				add_child(mi)
		if ic > 0: # a cortina: do último ponto de cima ao primeiro de baixo, um pouco mais larga e para fora do barranco
			var mc := _fita(C, ic - 1, ic, LARG_AGUA + 1.0, 0.04, true)
			if mc != null:
				mc.material_override = mat_cai
				add_child(mc)

# fita de água pelos pontos [a..b] da curva (x, z, nível); UV.y = metros / 4 (a cachoeira: 0 em cima, 1 embaixo)
func _fita(C: Array, a: int, b: int, larg: float, sobe: float, cortina := false) -> MeshInstance3D:
	if b - a < 1:
		return null
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var s := 0.0
	var pts := []
	for k in range(a, b + 1):
		var p := Vector3(float(C[k][0]), float(C[k][2]) + sobe, float(C[k][1]))
		var q := Vector3(float(C[mini(k + 1, C.size() - 1)][0]), 0, float(C[mini(k + 1, C.size() - 1)][1]))
		var o := Vector3(float(C[maxi(k - 1, 0)][0]), 0, float(C[maxi(k - 1, 0)][1]))
		var dir := Vector3(q.x - o.x, 0, q.z - o.z).normalized()
		var lado := Vector3(-dir.z, 0, dir.x) * larg * 0.5
		if k > a:
			s += Vector2(p.x - pts[-1][0].x, p.z - pts[-1][0].z).length()
		var queda := 0.0
		if k < C.size() - 1:
			queda = clampf((float(C[k][2]) - float(C[k + 1][2])) / 0.6, 0.0, 1.0)
		pts.append([p, lado, s, queda])
	for k in pts.size() - 1:
		var p0: Array = pts[k]
		var p1: Array = pts[k + 1]
		var v0 := 0.0 if cortina else float(p0[2]) / 4.0
		var v1 := 1.0 if cortina else float(p1[2]) / 4.0
		var quad := [[p0[0] - p0[1], 0.0, v0, p0[3]], [p0[0] + p0[1], 1.0, v0, p0[3]], [p1[0] + p1[1], 1.0, v1, p1[3]], [p1[0] - p1[1], 0.0, v1, p1[3]]]
		for ix in [0, 1, 2, 0, 2, 3]:
			st.set_color(Color(quad[ix][3], 0, 0))
			st.set_uv(Vector2(quad[ix][1], quad[ix][2]))
			st.set_normal(Vector3.UP)
			st.add_vertex(quad[ix][0])
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.visibility_range_end = 320.0
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi

# Parte 4b: as pontes de madeira onde o rio cruza a estrada (o chão delas vem em mundo.json como peças sólidas):
# tablado na rampa da estrada (ya numa ponta, yb na outra), corrimão dos dois lados e esteios descendo até o leito
func _pontes() -> void:
	var mat := _madeira()
	for c in T.mundo_g.get("pontes", []):
		var no := Node3D.new()
		no.name = str(c.id)
		no.position = Vector3(float(c.x), (float(c.ya) + float(c.yb)) / 2.0, float(c.z))
		no.rotation.y = float(c.ry)
		add_child(no)
		var w: float = c.w
		var d: float = c.d
		var inc := atan2(float(c.yb) - float(c.ya), d) # sobe de -z para +z (local)
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		var tomba := Basis(Vector3.RIGHT, -inc)
		var pecas := [[0.0, -0.1, w, 0.2], [-w / 2.0 + 0.1, -0.35, 0.22, 0.3], [w / 2.0 - 0.1, -0.35, 0.22, 0.3], # tablado e vigas
			[-w / 2.0 + 0.08, 0.95, 0.12, 0.12], [w / 2.0 - 0.08, 0.95, 0.12, 0.12]] # corrimão
		for pc in pecas:
			var bm := BoxMesh.new()
			bm.size = Vector3(pc[2], pc[3], d)
			st.append_from(bm, 0, Transform3D(tomba, tomba * Vector3(pc[0], pc[1], 0.0)))
		var n := int(d / 2.5) + 1
		for i in n: # balaústres do corrimão
			for lado in [-1.0, 1.0]:
				var z: float = -d / 2.0 + 0.3 + i * (d - 0.6) / maxf(1.0, n - 1)
				var bm := BoxMesh.new()
				bm.size = Vector3(0.12, 1.0, 0.12)
				st.append_from(bm, 0, Transform3D(Basis(), tomba * Vector3(lado * (w / 2.0 - 0.08), 0.45, z)))
		st.set_material(mat)
		var mi := MeshInstance3D.new()
		mi.mesh = st.commit()
		mi.visibility_range_end = 300.0
		no.add_child(mi)
		# esteios: do tablado até abaixo do leito, a cada 4 m
		var es := CylinderMesh.new()
		es.top_radius = 0.16
		es.bottom_radius = 0.19
		es.height = 1.0
		es.radial_segments = 8
		es.material = mat
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = es
		var ne := int(d / 4.0) + 1
		mm.instance_count = ne * 2
		var fundo: float = float(c.get("nivel", 0.0)) - 1.6 - no.position.y
		for i in ne:
			for k in 2:
				var z: float = -d / 2.0 + 0.5 + i * (d - 1.0) / maxf(1.0, ne - 1)
				var topo: float = (tomba * Vector3(0, -0.3, z)).y
				var alt := maxf(0.5, topo - fundo)
				mm.set_instance_transform(i * 2 + k, Transform3D(Basis().scaled(Vector3(1, alt, 1)), Vector3((k * 2 - 1) * (w / 2.0 - 0.1), topo - alt / 2.0, (tomba * Vector3(0, 0, z)).z)))
		var mx := MultiMeshInstance3D.new()
		mx.multimesh = mm
		mx.visibility_range_end = 300.0
		no.add_child(mx)

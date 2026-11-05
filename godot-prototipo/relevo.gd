extends Node3D
# Relevo do mapa (pedido do André 2026-11-05: "o negócio está muito reto"): a montanha e os lagos.
# As alturas vêm do terreno.gd (a mesma conta do servidor, shared/relevo.js); aqui só se desenha:
# - montanha: malha da grade de alturas, grama nas partes deitadas e pedra (projeção nos 3 eixos) nas encostas;
# - lago: leito de lama que desce até o fundo e a água por cima (montanha.gdshader, leito.gdshader, agua.gdshader).
# O chão plano (main.gd montar_chao) abre um buraco onde tem lago (chao.gdshader, uniforms lago_*).

var T # terreno.gd
var env: Environment # névoa: fica mais fina quando a câmera sobe (vista do alto da montanha)
const NEVOA := 0.0075

func _init(terreno, chao_mat: ShaderMaterial, grama_tex: Texture2D) -> void:
	T = terreno
	name = "Relevo"
	if not T.monte.is_empty():
		_montanha(grama_tex)
	for L in T.lagos:
		_lago(L)
	_juncos(terreno.m.get("juncos", []))
	_buracos_no_chao(chao_mat)
	_copas_ao_longe(chao_mat)

func _ready() -> void:
	for we in get_parent().find_children("*", "WorldEnvironment", false, false):
		env = we.environment

# Vista do alto (direção de arte): quem sobe a montanha ganha a vista. Acima de ~15 m a névoa cai ~63%, a câmera
# enxerga até 1200 m (o chão vai até 1500 m do centro, com a mata continuando) e a névoa apaga o longe aos poucos:
# a 1200 m sobra uns 3% do chão, então não tem corte para o vazio. As copas simples (copas_simples) só ligam no alto.
const LONGE_CAMERA := 1200.0
func _process(_dt: float) -> void:
	var cam := get_viewport().get_camera_3d()
	if env == null or cam == null:
		return
	var k := clampf((cam.global_position.y - 8.0) / 22.0, 0.0, 1.0)
	k = k * k * (3.0 - 2.0 * k)
	env.fog_density = NEVOA * (1.0 - 0.63 * k)
	cam.far = lerpf(400.0, LONGE_CAMERA, k)
	for c in _copas:
		c.visible = cam.global_position.y > 7.0

# Chão visto de longe (direção de arte 2026-11-05: nada de desenho do minimapa colado no chão). Passando de ~75 m da
# câmera, o chão continua sendo a mesma grama de perto; a máscara relevo/longe.png (client/exportar-godot/longe.mjs)
# diz onde tem mata (a copa vista de cima, pintada com a textura da folha das árvores) e onde tem trilha (terra a
# 50%). Fora do quadrado da máscara é tudo mata, até o horizonte.
var _chao_mat: ShaderMaterial
func _copas_ao_longe(mat: ShaderMaterial) -> void:
	_chao_mat = mat
	var lg: Dictionary = T.m.get("longe", {})
	if mat == null or lg.is_empty() or not ResourceLoader.exists("res://relevo/longe.png"):
		return
	mat.set_shader_parameter("longe_tex", load("res://relevo/longe.png"))
	mat.set_shader_parameter("longe_area", Vector3(float(lg.x0), float(lg.z0), float(lg.tam)))
	mat.set_shader_parameter("longe_ligado", 1.0)

# Copas simples ao longe: as árvores de verdade somem a 80 m (desempenho). Do alto, cada árvore da mata ganha uma copa
# de ~70 triângulos no mesmo lugar, tamanho e tom (copa_longe.gdshader encolhe as que estão a menos de 76 m, onde a
# árvore de verdade ainda aparece). Só ligam com a câmera no alto (_process).
var _copas: Array = []
func copas_simples(arvores: Dictionary, malhas: Dictionary) -> void:
	var por_tipo := {}
	for pos in arvores:
		var a: Dictionary = arvores[pos]
		if not a.has("copa"):
			continue
		var v: int = a.v
		if not por_tipo.has(v):
			por_tipo[v] = []
		por_tipo[v].append(a)
	var sh := load("res://copa_longe.gdshader")
	# a mata de fora do mapa andável (mundo.copas_fora): copas sem árvore de verdade, então não encolhem perto
	var cores := []
	for pos in arvores:
		if arvores[pos].has("copa") and cores.size() < 64:
			cores.append(arvores[pos].copa[2])
	var fora := {}
	var rng := RandomNumberGenerator.new()
	for c in T.m.get("copas_fora", []):
		var v := int(c[3])
		rng.seed = hash(Vector2(c[0], c[1]))
		var sc := float(c[2])
		var b := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(sc * rng.randf_range(0.9, 1.1), sc * rng.randf_range(0.88, 1.15), sc * rng.randf_range(0.9, 1.1)))
		var x := float(c[0])
		var z := float(c[1])
		if not fora.has(v):
			fora[v] = []
		fora[v].append({"t": Transform3D(b, Vector3(x, T.altura_montanha(x, z), z)), "copa": [null, 0, cores[rng.randi() % cores.size()] if cores.size() > 0 else Color(0.6, 0.7, 0.45)]})
	for grupo in [por_tipo, fora]:
		for v in grupo:
			_grupo_de_copas(grupo[v], malhas.get("copa_%d" % v), sh, grupo == fora, v)
	if _folha and _chao_mat:
		_chao_mat.set_shader_parameter("folha_tex", _folha)

var _folha: Texture2D
func _grupo_de_copas(lista: Array, malha: Mesh, sh: Shader, sem_arvore: bool, v: int) -> void:
	if malha == null or lista.is_empty():
		return
	var m0 = malha.surface_get_material(0)
	if _folha == null and m0 is BaseMaterial3D:
		_folha = m0.albedo_texture
	var mat := ShaderMaterial.new()
	mat.shader = sh
	if _folha:
		mat.set_shader_parameter("folha_tex", _folha)
	if sem_arvore:
		mat.set_shader_parameter("perto", -10.0)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = _malha_copa(malha.get_aabb(), v)
	mm.instance_count = lista.size()
	for i in lista.size():
		mm.set_instance_transform(i, lista[i].t)
		mm.set_instance_color(i, lista[i].copa[2])
	var g := MultiMeshInstance3D.new()
	g.multimesh = mm
	g.material_override = mat
	g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	g.visible = false
	add_child(g)
	_copas.append(g)

# copa de longe: uma bola amassada de 9 fatias x 5 andares dentro da caixa da copa de verdade, com o raio variando
# (nada de bola perfeita) e o fundo achatado; UV.y = 0 embaixo e 1 em cima (a sombra de dentro da copa)
func _malha_copa(bb: AABB, v: int) -> ArrayMesh:
	var rng := RandomNumberGenerator.new()
	rng.seed = 77 + v
	var c := bb.get_center()
	var r := bb.size * 0.5 * 0.92
	var fatias := 9
	var andares := 5
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pts := []
	for j in andares + 1:
		var fi := PI * float(j) / andares
		var linha := []
		for i in fatias:
			var th := TAU * float(i) / fatias
			var q := 1.0 if j == 0 or j == andares else rng.randf_range(0.82, 1.12)
			var y := cos(fi)
			if y < -0.35:
				y = -0.35 - (y + 0.35) * 0.25 # fundo achatado
			linha.append([Vector3(sin(fi) * cos(th) * q, y, sin(fi) * sin(th) * q), 1.0 - float(j) / andares])
		pts.append(linha)
	for j in andares:
		for i in fatias:
			var quad := [pts[j][i], pts[j + 1][i], pts[j + 1][(i + 1) % fatias], pts[j][(i + 1) % fatias]]
			for t in [[0, 1, 2], [0, 2, 3]]:
				for k in t:
					var p: Vector3 = quad[k][0]
					st.set_normal(p.normalized())
					st.set_uv(Vector2(0.0, quad[k][1]))
					st.add_vertex(c + p * r)
	return st.commit()

# ---------- montanha ----------
func _montanha(grama_tex: Texture2D) -> void:
	var g: Dictionary = T.monte
	var n: int = g.n
	var passo: float = g.passo
	var h: PackedFloat32Array = g.h
	# só o quadrado que tem montanha (com uma volta de folga): o resto da grade é chão plano
	var i0 := n
	var i1 := 0
	var j0 := n
	var j1 := 0
	for j in n:
		for i in n:
			if h[j * n + i] > 0.0:
				i0 = mini(i0, i)
				i1 = maxi(i1, i)
				j0 = mini(j0, j)
				j1 = maxi(j1, j)
	if i1 < i0:
		return
	i0 = maxi(0, i0 - 2)
	j0 = maxi(0, j0 - 2)
	i1 = mini(n - 1, i1 + 2)
	j1 = mini(n - 1, j1 + 2)
	var w := i1 - i0 + 1
	var vs := PackedVector3Array()
	var ns := PackedVector3Array()
	var idx := PackedInt32Array()
	var alto := 0.0
	for j in range(j0, j1 + 1):
		for i in range(i0, i1 + 1):
			var y: float = h[j * n + i]
			alto = maxf(alto, y)
			# o pé (altura zero) fica um tiquinho embaixo do chão plano: sem briga de desenho na emenda
			vs.append(Vector3(g.x0 + i * passo, y if y > 0.0 else -0.06, g.z0 + j * passo))
			var hx: float = h[j * n + mini(n - 1, i + 1)] - h[j * n + maxi(0, i - 1)]
			var hz: float = h[mini(n - 1, j + 1) * n + i] - h[maxi(0, j - 1) * n + i]
			ns.append(Vector3(-hx, 2.0 * passo, -hz).normalized())
	for j in range(j1 - j0):
		for i in range(w - 1):
			var a := j * w + i
			var b := a + 1
			var c := a + w
			var d := c + 1
			if h[(j + j0) * n + i + i0] <= 0.0 and h[(j + j0) * n + i + i0 + 1] <= 0.0 and h[(j + j0 + 1) * n + i + i0] <= 0.0 and h[(j + j0 + 1) * n + i + i0 + 1] <= 0.0:
				continue # quadrado todo no chão: o chão plano já desenha
			# diagonal pelo lado mais curto (crista e vale ficam retos, sem dente)
			if absf(vs[a].y - vs[d].y) < absf(vs[b].y - vs[c].y):
				idx.append_array([a, b, d, a, d, c])
			else:
				idx.append_array([a, b, c, b, d, c])
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = vs
	arr[Mesh.ARRAY_NORMAL] = ns
	arr[Mesh.ARRAY_INDEX] = idx
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var mat := ShaderMaterial.new()
	mat.shader = load("res://montanha.gdshader")
	mat.set_shader_parameter("grama_tex", grama_tex)
	mat.set_shader_parameter("pedra_tex", load("res://relevo/rocky_terrain_02.jpg"))
	mat.set_shader_parameter("alto", alto)
	var mi := MeshInstance3D.new()
	mi.name = "Montanha"
	mi.mesh = mesh
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	add_child(mi)

# ---------- lagos ----------
const ANEIS := 16
const FATIAS := 72
# ponto do lago na direção ang (espaço do lago) a "d" vezes a margem (1 = margem): a conta inversa de margem_lago
func _ponto(L: Dictionary, ang: float, d: float) -> Vector2:
	var k := 1.0
	for l in L.lobos:
		k *= 1.0 + float(l[1]) * sin(float(l[0]) * ang + float(l[2]))
	var u: float = float(L.rx) * cos(ang) * d * k
	var v: float = float(L.rz) * sin(ang) * d * k
	return Vector2(L.x + u * L.c - v * L.s, L.z + u * L.s + v * L.c)

func _malha_polar(L: Dictionary, dmax: float, altura: Callable, fundura := false) -> ArrayMesh:
	var vs := PackedVector3Array()
	var idx := PackedInt32Array()
	vs.append(Vector3(L.x, altura.call(L.x, L.z, 0.0), L.z))
	for r in range(1, ANEIS + 1):
		var t := float(r) / ANEIS
		var d := dmax * (1.0 - (1.0 - t) * (1.0 - t)) # anéis mais juntos na margem (onde o leito desce)
		for f in FATIAS:
			var p := _ponto(L, TAU * f / FATIAS, d)
			vs.append(Vector3(p.x, altura.call(p.x, p.y, d), p.y))
	for f in FATIAS:
		idx.append_array([0, 1 + (f + 1) % FATIAS, 1 + f])
	for r in range(ANEIS - 1):
		var a0 := 1 + r * FATIAS
		var b0 := a0 + FATIAS
		for f in FATIAS:
			var f2 := (f + 1) % FATIAS
			idx.append_array([a0 + f, a0 + f2, b0 + f, a0 + f2, b0 + f2, b0 + f])
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in idx:
		if fundura: # água: a fundura embaixo de cada ponto vai na cor (o shader pinta raso -> fundo sem ler a tela)
			st.set_color(Color(clampf((float(T.agua.nivel) - T.relevo(vs[i].x, vs[i].z)) / 5.0, 0.0, 1.0), 0, 0))
		st.add_vertex(vs[i])
	st.index()
	st.generate_normals()
	return st.commit()

func _lago(L: Dictionary) -> void:
	# leito: a altura de verdade (relevo); depois da margem desce um tiquinho para ficar embaixo do chão plano
	var leito := MeshInstance3D.new()
	leito.name = "Leito_" + str(L.nome)
	leito.mesh = _malha_polar(L, 1.08, func(x, z, d): return T.relevo(x, z) - (0.03 if d >= 1.0 else 0.0))
	var ml := ShaderMaterial.new()
	ml.shader = load("res://leito.gdshader")
	ml.set_shader_parameter("lama_tex", load("res://relevo/brown_mud_leaves_01.jpg"))
	ml.set_shader_parameter("grama_tex", load("res://modelos/forrest_ground_01.jpg"))
	ml.set_shader_parameter("nivel", float(T.agua.nivel))
	leito.material_override = ml
	leito.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(leito)
	# água: plana no nível, até a margem (onde o leito sobe acima dela, some sozinha embaixo da terra)
	var agua := MeshInstance3D.new()
	agua.name = "Agua_" + str(L.nome)
	agua.mesh = _malha_polar(L, 1.0, func(_x, _z, _d): return float(T.agua.nivel), true)
	var ma := ShaderMaterial.new()
	ma.shader = load("res://agua.gdshader")
	ma.set_shader_parameter("fundo_lago", float(L.fundo))
	agua.material_override = ma
	agua.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(agua)

# o chão plano some dentro de cada lago (o leito aparece no lugar)
func _buracos_no_chao(mat: ShaderMaterial) -> void:
	if mat == null:
		return
	var a := []
	var b := []
	var c := []
	for i in 6:
		if i < T.lagos.size():
			var L: Dictionary = T.lagos[i]
			var l1: Array = L.lobos[0] if L.lobos.size() > 0 else [0, 0, 0]
			var l2: Array = L.lobos[1] if L.lobos.size() > 1 else [0, 0, 0]
			a.append(Vector4(L.x, L.z, L.rx, L.rz))
			b.append(Vector4(L.giro, float(l1[0]), float(l1[1]), float(l1[2])))
			c.append(Vector4(float(l2[0]), float(l2[1]), float(l2[2]), 1.0))
		else:
			a.append(Vector4(0, 0, 1, 1))
			b.append(Vector4.ZERO)
			c.append(Vector4.ZERO) # w = 0: lago vazio
	mat.set_shader_parameter("lago_a", a)
	mat.set_shader_parameter("lago_b", b)
	mat.set_shader_parameter("lago_c", c)

# ---------- juncos e taboas da beira (shared/relevo.js beiraDosLagos) ----------
# Um tufo: 7 folhas finas e compridas que abrem para fora (e, na taboa, 2 hastes com a espiga marrom). Cor no vértice
# (verde da folha, marrom da espiga); junco.gdshader balança com o vento como a grama.
func _malha_tufo(taboa: bool) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rng := RandomNumberGenerator.new()
	rng.seed = 77 if taboa else 41
	for f in 7:
		var ang := TAU * f / 7.0 + rng.randf_range(-0.3, 0.3)
		var alto := rng.randf_range(0.75, 1.25)
		var abre := rng.randf_range(0.15, 0.4)
		var dir := Vector3(cos(ang), 0, sin(ang))
		var lado := Vector3(-dir.z, 0, dir.x) * 0.022
		var cor := Color.from_hsv(rng.randf_range(0.2, 0.26), 0.55, rng.randf_range(0.42, 0.6))
		var pts: Array = []
		for k in 5: # folha curvando para fora
			var t := k / 4.0
			pts.append(dir * (abre * t * t) + Vector3(0, alto * t, 0))
		for k in 4:
			var w0 := 1.0 - k / 4.0
			var w1 := 1.0 - (k + 1) / 4.0
			var a: Vector3 = pts[k] - lado * w0
			var b: Vector3 = pts[k] + lado * w0
			var c: Vector3 = pts[k + 1] - lado * w1
			var d: Vector3 = pts[k + 1] + lado * w1
			var c0 := cor.darkened(0.25 * (1.0 - k / 4.0))
			var c1 := cor.darkened(0.25 * (1.0 - (k + 1) / 4.0))
			for v in [[a, c0], [b, c0], [d, c1], [a, c0], [d, c1], [c, c1]]:
				st.set_color(v[1])
				st.set_normal(Vector3.UP)
				st.add_vertex(v[0])
	if taboa:
		for hh in 2:
			var px := Vector3(rng.randf_range(-0.06, 0.06), 0, rng.randf_range(-0.06, 0.06))
			var alto2 := rng.randf_range(1.15, 1.45)
			var haste := Color(0.42, 0.5, 0.25)
			var espiga := Color(0.36, 0.22, 0.12)
			for i in 6: # haste fina e espiga (prisma de 6 lados)
				var a1 := TAU * i / 6.0
				var a2 := TAU * (i + 1) / 6.0
				for seg in [[0.0, alto2 - 0.22, 0.008, haste], [alto2 - 0.22, alto2, 0.028, espiga], [alto2, alto2 + 0.08, 0.006, haste]]:
					var r: float = seg[2]
					var p1 := px + Vector3(cos(a1) * r, seg[0], sin(a1) * r)
					var p2 := px + Vector3(cos(a2) * r, seg[0], sin(a2) * r)
					var p3 := px + Vector3(cos(a1) * r, seg[1], sin(a1) * r)
					var p4 := px + Vector3(cos(a2) * r, seg[1], sin(a2) * r)
					for v in [p1, p2, p4, p1, p4, p3]:
						st.set_color(seg[3])
						st.set_normal(Vector3(cos(a1), 0.3, sin(a1)).normalized())
						st.add_vertex(v)
	return st.commit()

func _juncos(lista: Array) -> void:
	if lista.is_empty():
		return
	var mat := ShaderMaterial.new()
	mat.shader = load("res://junco.gdshader")
	for taboa in [false, true]:
		var itens := lista.filter(func(b): return (str(b.tipo) == "taboa") == taboa)
		if itens.is_empty():
			continue
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = _malha_tufo(taboa)
		mm.instance_count = itens.size()
		for i in itens.size():
			var b: Dictionary = itens[i]
			var x := float(b.x)
			var z := float(b.z)
			var sc := float(b.s)
			mm.set_instance_transform(i, Transform3D(Basis(Vector3.UP, float(b.ry)).scaled(Vector3(sc, sc, sc)), Vector3(x, minf(0.0, T.relevo(x, z)) - 0.02, z)))
		var g := MultiMeshInstance3D.new()
		g.name = "Taboas" if taboa else "Juncos"
		g.multimesh = mm
		g.material_override = mat
		g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		g.visibility_range_end = 70.0
		add_child(g)

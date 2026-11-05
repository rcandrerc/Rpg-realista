extends Node3D
# Relevo do mapa (pedido do André 2026-11-05: "o negócio está muito reto"): a montanha e os lagos.
# As alturas vêm do terreno.gd (a mesma conta do servidor, shared/relevo.js); aqui só se desenha:
# - montanha: malha da grade de alturas, grama nas partes deitadas e pedra (projeção nos 3 eixos) nas encostas;
# - lago: leito de lama que desce até o fundo e a água por cima (montanha.gdshader, leito.gdshader, agua.gdshader).
# O chão plano (main.gd montar_chao) abre um buraco onde tem lago (chao.gdshader, uniforms lago_*).

var T # terreno.gd

func _init(terreno, chao_mat: ShaderMaterial, grama_tex: Texture2D) -> void:
	T = terreno
	name = "Relevo"
	if not T.monte.is_empty():
		_montanha(grama_tex)
	for L in T.lagos:
		_lago(L)
	_buracos_no_chao(chao_mat)

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

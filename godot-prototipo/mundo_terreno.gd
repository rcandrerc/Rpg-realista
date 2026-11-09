extends Node3D
# Chão do mundo grande (FASE 3, André 2026-11-08): Vael, a Ilha do Meio e Aurora em volta do mapa de hoje, e o mar.
# Alturas da grade do terreno.gd (dados/mundo_grade.json, a mesma conta do servidor: shared/mundo.js). O mapa de hoje
# (onde a grade vale 0) continua com o chão plano do main.gd; aqui sai só o resto, em pedaços de PEDACO x PEDACO
# quadrados da grade (cada pedaço é uma malha: a câmera só desenha os que vê, e os longe somem com a névoa).
# O mar é uma água por pedaço, só onde o fundo fica abaixo da linha d'água (não passa por cima da terra nem dos lagos).

const PEDACO := 16 # quadrados da grade por pedaço (16 x 4 m = 64 m)
const LONGE := 1100.0 # m: além disso o pedaço some (a névoa já apagou)

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
	_mat_mar = ShaderMaterial.new()
	_mat_mar.shader = load("res://agua.gdshader")
	_mat_mar.set_shader_parameter("fundo_lago", 6.0)
	var g: Dictionary = T.mundo_g
	for pj in range(0, int(g.nz) - 1, PEDACO):
		for pi in range(0, int(g.nx) - 1, PEDACO):
			_pedaco(pi, pj)
	_mar_aberto()

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
	var idx := PackedInt32Array()
	var agua := PackedInt32Array()
	for j in range(j0, j1 + 1):
		for i in range(i0, i1 + 1):
			var y: float = h[j * nx + i]
			# perto de 0 (a emenda com o mapa de hoje) fica um tiquinho embaixo do chão plano: sem briga de desenho
			vs.append(Vector3(float(g.x0) + i * passo, y if absf(y) > 0.08 else y - 0.06, float(g.z0) + j * passo))
			var hx: float = h[j * nx + mini(nx - 1, i + 1)] - h[j * nx + maxi(0, i - 1)]
			var hz: float = h[mini(int(g.nz) - 1, j + 1) * nx + i] - h[maxi(0, j - 1) * nx + i]
			ns.append(Vector3(-hx, 2.0 * passo, -hz).normalized())
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
	var meio := Vector3(float(g.x0) + (i0 + i1) * 0.5 * passo, 0, float(g.z0) + (j0 + j1) * 0.5 * passo)
	add_child(_malha("Chao_%d_%d" % [i0, j0], vs, ns, idx, _mat_chao, true))
	if not agua.is_empty(): # água plana na linha d'água, só nos quadrados que têm fundo de mar
		var va := PackedVector3Array()
		var na := PackedVector3Array()
		for v in vs:
			va.append(Vector3(v.x, float(T.agua.nivel), v.z))
			na.append(Vector3.UP)
		add_child(_malha("Mar_%d_%d" % [i0, j0], va, na, agua, _mat_mar, false))

func _malha(nome: String, vs: PackedVector3Array, ns: PackedVector3Array, idx: PackedInt32Array, mat: Material, sombra: bool) -> MeshInstance3D:
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = vs
	arr[Mesh.ARRAY_NORMAL] = ns
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

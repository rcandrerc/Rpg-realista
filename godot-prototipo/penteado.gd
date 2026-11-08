# Penteado (André 2026-11-07): o cabelo de outro modelo VRoid do jogo na cabeça do herói, escolhido no criador.
# O cabelo do outro modelo vem preso na cabeça dele (os "baked" não têm ossos de mola). Encaixe (2026-11-08, André: "deformou
# os cabelos todos"): o cabelo inteiro vai da cabeça do doador para a do herói por uma só escala por eixo (largura, altura e
# profundidade do crânio de um e de outro), então o penteado mantém a forma original. Depois, só o que ficou por dentro do
# couro cabeludo do herói é empurrado para fora, e esse empurrão some aos poucos longe da cabeça (nada de volume a mais).
# Quem chama: Aparencia.aplicar ("penteado").
extends RefCounted

const GRADE_T := 18 # faixas de altura do mapa de raios (de cima para baixo)
const GRADE_F := 36 # faixas em volta da cabeça
const FOLGA := 0.003 # cabelo pelo menos 3 mm acima do couro cabeludo do herói
const EMPURRAO := 0.006 # no máximo 6 mm para fora: o penteado não ganha volume (antes chegava a 40%)

static var _cenas := {} # id do modelo -> PackedScene
static var _feitos := {} # "doador|malha do rosto do alvo" -> [[ArrayMesh, Material], ...]
static var _materiais := {} # material do doador -> material pintado como o resto do personagem (main.pintar)

# id = modelo doador ("" ou null = o cabelo do próprio corpo)
static func aplicar(no: Node3D, id) -> void:
	var esq := _esqueleto(no)
	if esq == null:
		return
	var doador := str(id) if id != null else ""
	if doador == "" or not ResourceLoader.exists("res://modelos/%s.glb" % doador):
		doador = ""
	if str(esq.get_meta("penteado", "")) == doador:
		return
	for filho in esq.get_children():
		if str(filho.name).begins_with("Penteado"):
			esq.remove_child(filho)
			filho.queue_free()
	for mi in _cabelos_proprios(no):
		mi.visible = doador == ""
	esq.set_meta("penteado", doador)
	if doador == "":
		return
	var rosto := _rosto(no)
	if rosto == null:
		return
	var chave := "%s|%d" % [doador, rosto.mesh.get_instance_id()]
	if not _feitos.has(chave):
		_feitos[chave] = _montar(doador, esq, rosto)
	if _feitos[chave].is_empty(): # outro sexo ou modelo sem cabelo: fica o cabelo do próprio corpo
		for mi in _cabelos_proprios(no):
			mi.visible = true
		return
	var cabeca := esq.find_bone("J_Bip_C_Head")
	var skin := Skin.new()
	skin.add_named_bind("J_Bip_C_Head", esq.get_bone_global_rest(cabeca).affine_inverse())
	var k := 0
	for par in _feitos[chave]:
		var mi := MeshInstance3D.new()
		mi.name = "Penteado%d" % k
		mi.mesh = par[0]
		mi.skin = skin
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		esq.add_child(mi)
		mi.skeleton = mi.get_path_to(esq)
		k += 1

# malhas de cabelo do próprio corpo (escondidas enquanto houver penteado de outro modelo)
static func _cabelos_proprios(no: Node3D) -> Array:
	var r := []
	for mi in no.find_children("*", "MeshInstance3D", true, false):
		if str(mi.name).begins_with("Penteado") or str(mi.name).begins_with("Armadura") or mi.mesh == null:
			continue
		var todos: bool = mi.mesh.get_surface_count() > 0
		for s in mi.mesh.get_surface_count():
			if not "HAIR" in mi.mesh.surface_get_name(s):
				todos = false
		if todos:
			r.append(mi)
	return r

static func _esqueleto(no: Node) -> Skeleton3D:
	var l := no.find_children("*", "Skeleton3D", true, false)
	return l[0] if l.size() > 0 else null

static func _rosto(no: Node) -> MeshInstance3D:
	for mi in no.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh != null and mi.mesh.get_surface_count() > 0 and "Face_00_SKIN" in mi.mesh.surface_get_name(0):
			return mi
	return null

static func _vira(esq: Skeleton3D) -> bool: # como armadura.gd (_orientar): o dedo do pé atrás do pé = virado
	var pe := esq.find_bone("J_Bip_L_Foot")
	var dedo := esq.find_bone("J_Bip_L_ToeBase")
	return pe >= 0 and dedo >= 0 and esq.get_bone_global_rest(dedo).origin.z < esq.get_bone_global_rest(pe).origin.z

static func _F(p: Vector3, vira: bool) -> Vector3:
	return Vector3(-p.x, p.y, -p.z) if vira else p

# posição de cada vértice na pose de descanso, no espaço do esqueleto, já virada para a frente (+z)
static func _descanso(mi: MeshInstance3D, esq: Skeleton3D, sfc: int, vira: bool, pose := false) -> PackedVector3Array:
	var a: Array = mi.mesh.surface_get_arrays(sfc)
	var V: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
	var out := PackedVector3Array()
	out.resize(V.size())
	if mi.skin == null or a[Mesh.ARRAY_BONES] == null:
		var t := esq.global_transform.affine_inverse() * mi.global_transform if mi.is_inside_tree() else Transform3D.IDENTITY
		for i in V.size():
			out[i] = _F(t * V[i], vira)
		return out
	var B: PackedInt32Array = a[Mesh.ARRAY_BONES]
	var W: PackedFloat32Array = a[Mesh.ARRAY_WEIGHTS]
	var k := B.size() / maxi(V.size(), 1)
	var mats := []
	for j in mi.skin.get_bind_count():
		var n := mi.skin.get_bind_name(j)
		var b := esq.find_bone(n) if n != "" else mi.skin.get_bind_bone(j)
		var g := (esq.get_bone_global_pose(b) if pose else esq.get_bone_global_rest(b)) if b >= 0 else Transform3D.IDENTITY
		mats.append(g * mi.skin.get_bind_pose(j) if b >= 0 else Transform3D.IDENTITY)
	for i in V.size():
		var p := Vector3.ZERO
		var s := 0.0
		for j in k:
			var w := W[i * k + j]
			if w > 0.0:
				p += (mats[B[i * k + j]] as Transform3D) * V[i] * w
				s += w
		out[i] = _F(p / maxf(s, 1e-6), vira)
	return out

# centro da cabeça e raio do couro cabeludo por direção (pele do rosto e da cabeça, acima do osso Head)
static func _mapa(rosto: MeshInstance3D, esq: Skeleton3D, vira: bool, pose := false) -> Array:
	var P := _descanso(rosto, esq, 0, vira, pose)
	var cab := esq.find_bone("J_Bip_C_Head")
	var y_cab := _F((esq.get_bone_global_pose(cab) if pose else esq.get_bone_global_rest(cab)).origin, vira).y
	var cx := AABB()
	var primeiro := true
	for p in P:
		if p.y < y_cab:
			continue
		if primeiro:
			cx = AABB(p, Vector3.ZERO)
			primeiro = false
		else:
			cx = cx.expand(p)
	var c := cx.get_center()
	var R := PackedFloat32Array()
	R.resize(GRADE_T * GRADE_F)
	for p in P:
		var d := p - c
		var ij := _celula(d)
		R[ij] = maxf(R[ij], d.length())
	var real := PackedFloat32Array()
	real.resize(R.size())
	for i in R.size():
		real[i] = 1.0 if R[i] > 0.0 else 0.0
	# células vazias (embaixo do queixo, nuca): média das vizinhas, várias passadas; o que sobrar vira a média geral
	for passada in 8:
		var R2 := PackedFloat32Array(R)
		for t in GRADE_T:
			for f in GRADE_F:
				if R[t * GRADE_F + f] > 0.0:
					continue
				var s := 0.0
				var n := 0
				for v in [[t - 1, f], [t + 1, f], [t, f - 1], [t, f + 1]]:
					if v[0] < 0 or v[0] >= GRADE_T:
						continue
					var r := R[v[0] * GRADE_F + posmod(v[1], GRADE_F)]
					if r > 0.0:
						s += r
						n += 1
				if n > 0:
					R2[t * GRADE_F + f] = s / n
		R = R2
	var media := 0.0
	var nm := 0
	for r in R:
		if r > 0.0:
			media += r
			nm += 1
	media /= maxf(nm, 1)
	for i in R.size():
		if R[i] <= 0.0:
			R[i] = media
	return [c, R, cx, real]

static func _celula(d: Vector3) -> int:
	var l := maxf(d.length(), 1e-6)
	var t := clampi(int(acos(clampf(d.y / l, -1.0, 1.0)) / PI * GRADE_T), 0, GRADE_T - 1)
	var f := posmod(int((atan2(d.x, d.z) + PI) / TAU * GRADE_F), GRADE_F)
	return t * GRADE_F + f

# raio do couro cabeludo na direção d, interpolado entre as células vizinhas
static func _raio(R: PackedFloat32Array, d: Vector3) -> float:
	var l := maxf(d.length(), 1e-6)
	var tt := acos(clampf(d.y / l, -1.0, 1.0)) / PI * GRADE_T - 0.5
	var ff := (atan2(d.x, d.z) + PI) / TAU * GRADE_F - 0.5
	var t0 := floori(tt)
	var f0 := floori(ff)
	var at := tt - t0
	var af := ff - f0
	var v := func(t: int, f: int) -> float:
		return R[clampi(t, 0, GRADE_T - 1) * GRADE_F + posmod(f, GRADE_F)]
	return lerpf(lerpf(v.call(t0, f0), v.call(t0, f0 + 1), af), lerpf(v.call(t0 + 1, f0), v.call(t0 + 1, f0 + 1), af), at)

static func _montar(doador: String, esq_a: Skeleton3D, rosto_a: MeshInstance3D) -> Array:
	if not _cenas.has(doador):
		_cenas[doador] = load("res://modelos/%s.glb" % doador)
	var no_d: Node3D = _cenas[doador].instantiate()
	var esq_d := _esqueleto(no_d)
	var rosto_d := _rosto(no_d)
	var saida := []
	# cabelo de moça só na moça e de rapaz só no rapaz (osso de busto = corpo feminino)
	if esq_d == null or rosto_d == null or (esq_d.find_bone("J_Sec_L_Bust1") >= 0) != (esq_a.find_bone("J_Sec_L_Bust1") >= 0):
		no_d.free()
		return saida
	var vd := _vira(esq_d)
	var va := _vira(esq_a)
	var md := _mapa(rosto_d, esq_d, vd, true)
	var ma := _mapa(rosto_a, esq_a, va)
	# uma escala só para o penteado inteiro (altura do crânio), quase sempre perto de 1: a forma do doador fica igual
	var ed: Vector3 = (md[2] as AABB).size
	var ea: Vector3 = (ma[2] as AABB).size
	var esc := clampf(ea.y / maxf(ed.y, 0.01), 0.9, 1.1)
	var malhas := []
	var rmin := PackedFloat32Array() # camada de dentro do cabelo em cada direção
	rmin.resize(GRADE_T * GRADE_F)
	rmin.fill(1e9)
	for mi in _cabelos_proprios(no_d):
		for sfc in mi.mesh.get_surface_count():
			var P := _descanso(mi, esq_d, sfc, vd, true)
			for i in P.size():
				P[i] = (P[i] - md[0]) * esc
				var ij := _celula(P[i])
				rmin[ij] = minf(rmin[ij], P[i].length())
			malhas.append([mi, sfc, P])
	# quanto falta para a camada de dentro ficar fora do couro cabeludo do herói, só onde há crânio de verdade (não no
	# pescoço); depois alisado, para o empurrão não fazer degrau entre uma direção e outra
	var emp := PackedFloat32Array()
	emp.resize(GRADE_T * GRADE_F)
	for i in emp.size():
		if (ma[3] as PackedFloat32Array)[i] > 0.0 and rmin[i] < 1e8:
			emp[i] = clampf((ma[1] as PackedFloat32Array)[i] + FOLGA - rmin[i], 0.0, EMPURRAO)
	for passada in 3:
		var e2 := PackedFloat32Array(emp)
		for t in GRADE_T:
			for f in GRADE_F:
				var v := emp[t * GRADE_F + f]
				for n in [[t - 1, f], [t + 1, f], [t, f - 1], [t, f + 1]]:
					if n[0] >= 0 and n[0] < GRADE_T:
						v = maxf(v, emp[n[0] * GRADE_F + posmod(n[1], GRADE_F)] * 0.6)
				e2[t * GRADE_F + f] = v
		emp = e2
	for item in malhas:
		var mi: MeshInstance3D = item[0]
		var sfc: int = item[1]
		var P: PackedVector3Array = item[2]
		var a: Array = mi.mesh.surface_get_arrays(sfc)
		var N: PackedVector3Array = a[Mesh.ARRAY_NORMAL]
		var V2 := PackedVector3Array()
		var N2 := PackedVector3Array()
		V2.resize(P.size())
		N2.resize(P.size())
		for i in P.size():
			var d: Vector3 = P[i]
			var r := d.length()
			if r > 1e-4:
				# a camada inteira sai junto (mechas de fora não achatam); some devagar longe do crânio
				var e := _raio(emp, d)
				var perto := 1.0 - smoothstep(0.03, 0.09, r - _raio(ma[1], d))
				d *= (r + e * perto) / r
			V2[i] = _F(ma[0] + d, va)
			N2[i] = _F(_F(N[i], vd), va) if N != null and N.size() == P.size() else Vector3.UP
		var arr := []
		arr.resize(Mesh.ARRAY_MAX)
		arr[Mesh.ARRAY_VERTEX] = V2
		arr[Mesh.ARRAY_NORMAL] = N2
		arr[Mesh.ARRAY_TEX_UV] = a[Mesh.ARRAY_TEX_UV]
		arr[Mesh.ARRAY_INDEX] = a[Mesh.ARRAY_INDEX]
		var B := PackedInt32Array()
		var W := PackedFloat32Array()
		B.resize(P.size() * 4)
		W.resize(P.size() * 4)
		for i in P.size():
			W[i * 4] = 1.0
		arr[Mesh.ARRAY_BONES] = B
		arr[Mesh.ARRAY_WEIGHTS] = W
		var am := ArrayMesh.new()
		am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		am.surface_set_name(0, mi.mesh.surface_get_name(sfc))
		am.surface_set_material(0, _material(mi.mesh.surface_get_material(sfc)))
		saida.append([am])
	no_d.free()
	return saida

# o mesmo acabamento que main.pintar dá ao cabelo dos personagens (toon, sem brilho próprio, contorno de luz)
static func _material(m: Material) -> Material:
	if not (m is StandardMaterial3D):
		return m
	if not _materiais.has(m):
		var n: StandardMaterial3D = m.duplicate()
		n.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
		n.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
		n.metallic = 0.0
		n.roughness = 1.0
		n.normal_enabled = false
		n.emission_enabled = false
		n.rim_enabled = true
		n.rim = 0.25
		n.rim_tint = 0.6
		var c := StandardMaterial3D.new() # contorno escuro de desenho, como o resto do personagem
		c.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		c.cull_mode = BaseMaterial3D.CULL_FRONT
		c.grow = true
		c.grow_amount = 0.004
		c.albedo_color = Color(0.12, 0.08, 0.08)
		n.next_pass = c
		_materiais[m] = n
	return _materiais[m]

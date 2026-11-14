extends RefCounted
# Juntar malhas sem esperar o desenho (2026-11-14, registros do celular: a horta, os veios e a caverna levavam ~30 ms por
# quadro no Poco X7 mesmo com a fila de 3 ms).
# Com o desenho em paralelo (APK 2026-11-12), ler os vértices de uma malha (SurfaceTool.append_from/create_from,
# surface_get_arrays, PrimitiveMesh.get_mesh_arrays) faz a linha do jogo parar até a linha do desenho terminar o quadro
# dela. Medido no PC com a linha do desenho carregada: a primeira leitura do quadro esperou 550 a 640 ms; montar a mesma
# malha a partir de listas prontas, 0,05 ms. No celular cada quadro com uma leitura dessas ganhava o desenho inteiro de
# um quadro (15 a 30 ms).
# Aqui os vértices de cada formato de malha são lidos uma vez só por abertura do jogo e guardados (a caixa: uma só, de
# tamanho 1, esticada pela posição). Junta faz o mesmo que SurfaceTool begin + append_from + commit nos juntar_malhas:
# mesmos vértices, normais, tangentes, cores e UVs, sem perguntar nada à placa de vídeo depois da primeira vez.

class Junta:
	static var _cache := {} # chave do formato (malhas prontas do Godot) -> listas da superfície
	static var _cache_am := {} # instance id da ArrayMesh -> [WeakRef, Array de listas por superfície]
	static var _novas := 0
	static var _novas_v := 0
	static var diretas := 0 # leituras de malha feita no jogo (arrays: não guarda), para o registro e testes
	static var _cache_v := {} # instance id -> [WeakRef, {superfície: [assinatura, vértices]}] (malhas feitas no jogo)
	static var guardadas := 0 # arrays que achou guardado (não esperou o desenho)
	static var leituras := 0 # quantas vezes ainda precisou ler da placa (registro e testes)

	var v := PackedVector3Array()
	var n := PackedVector3Array()
	var tg := PackedFloat32Array()
	var c := PackedColorArray()
	var uv := PackedVector2Array()
	var uv2 := PackedVector2Array()
	var idx := PackedInt32Array()
	var tem_n := false
	var tem_tg := false
	var tem_c := false
	var tem_uv := false
	var tem_uv2 := false
	var _st: SurfaceTool = null # o que tiver listas que a Junta não junta (ossos, extras): vai pelo caminho antigo

	# listas da superfície i e a transformação extra que ela precisa (a caixa guardada tem tamanho 1)
	static func listas(m: Mesh, i: int) -> Array:
		if m is BoxMesh:
			var b := m as BoxMesh
			if b.subdivide_width == 0 and b.subdivide_height == 0 and b.subdivide_depth == 0 and not b.flip_faces and not b.add_uv2:
				if not _cache.has("caixa1"):
					_cache["caixa1"] = BoxMesh.new().get_mesh_arrays()
					leituras += 1
				return [_cache["caixa1"], Transform3D(Basis.from_scale(b.size), Vector3.ZERO)]
		if m is PrimitiveMesh:
			var k := _chave_primitiva(m)
			if not _cache.has(k):
				_cache[k] = (m as PrimitiveMesh).get_mesh_arrays()
				leituras += 1
			return [_cache[k], Transform3D.IDENTITY]
		return [_da_malha(m, i), Transform3D.IDENTITY]

	# listas da superfície i de uma ArrayMesh, lidas da placa só na primeira vez. A assinatura (formato e tamanhos,
	# que a ArrayMesh guarda do lado do processador) muda se alguém refizer a malha: aí lê de novo.
	static func _da_malha(m: Mesh, i: int) -> Array:
		var id := m.get_instance_id()
		var e = _cache_am.get(id)
		if e == null or (e[0] as WeakRef).get_ref() != m:
			e = [weakref(m), [], []]
			_cache_am[id] = e
			_novas += 1
			if _novas >= 64: # malhas que já saíram do jogo (roupa de NPC que foi embora): solta as listas delas
				_novas = 0
				for k in _cache_am.keys():
					if (_cache_am[k][0] as WeakRef).get_ref() == null:
						_cache_am.erase(k)
		var por: Array = e[1]
		var sig: Array = e[2]
		var n := m.get_surface_count()
		if por.size() < n:
			por.resize(n)
			sig.resize(n)
		var am := m as ArrayMesh
		var s := [am.surface_get_format(i), am.surface_get_array_len(i), am.surface_get_array_index_len(i)] if am else []
		if not (por[i] is Array) or sig[i] != s:
			por[i] = m.surface_get_arrays(i)
			sig[i] = s
			leituras += 1
		return por[i]


	static func _chave_primitiva(m: Mesh) -> String:
		var k := m.get_class()
		for p in m.get_property_list():
			if p.usage & PROPERTY_USAGE_STORAGE and p.name not in ["resource_local_to_scene", "resource_name", "material", "script", "custom_aabb"]:
				k += "|" + str(m.get(p.name))
		return k

	func begin(_p := Mesh.PRIMITIVE_TRIANGLES) -> void:
		pass

	func append_from(m: Mesh, i: int, t: Transform3D) -> void:
		var r := listas(m, i)
		var a: Array = r[0]
		if a.size() < Mesh.ARRAY_MAX or a[Mesh.ARRAY_VERTEX] == null:
			return
		for k in [Mesh.ARRAY_BONES, Mesh.ARRAY_WEIGHTS, Mesh.ARRAY_CUSTOM0, Mesh.ARRAY_CUSTOM1, Mesh.ARRAY_CUSTOM2, Mesh.ARRAY_CUSTOM3]:
			if a[k] != null:
				if _st == null:
					_st = SurfaceTool.new()
					_st.begin(Mesh.PRIMITIVE_TRIANGLES)
				_st.append_from(m, i, t)
				return
		var tt: Transform3D = t * (r[1] as Transform3D)
		var base := v.size()
		var pv: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
		var q := pv.size()
		v.append_array(tt * pv)
		# normais (como o SurfaceTool: inversa transposta; o Godot guarda só a direção)
		var pn = a[Mesh.ARRAY_NORMAL]
		if pn != null and not tem_n:
			tem_n = true
			_encher_n(base)
		if tem_n:
			if pn != null:
				n.append_array(Transform3D(tt.basis.inverse().transposed(), Vector3.ZERO) * (pn as PackedVector3Array))
			else:
				_encher_n(q)
		# tangentes (x, y, z, w)
		var pt = a[Mesh.ARRAY_TANGENT]
		if pt != null and not tem_tg:
			tem_tg = true
			_encher_tg(base)
		if tem_tg:
			if pt != null:
				var f: PackedFloat32Array = pt
				var j0 := tg.size()
				tg.resize(j0 + q * 4)
				var bb := tt.basis
				for j in q:
					var d := bb * Vector3(f[j * 4], f[j * 4 + 1], f[j * 4 + 2])
					tg[j0 + j * 4] = d.x
					tg[j0 + j * 4 + 1] = d.y
					tg[j0 + j * 4 + 2] = d.z
					tg[j0 + j * 4 + 3] = f[j * 4 + 3]
			else:
				_encher_tg(q)
		var pc = a[Mesh.ARRAY_COLOR]
		if pc != null and not tem_c:
			tem_c = true
			_encher_cor(base)
		if tem_c:
			if pc != null:
				c.append_array(pc)
			else:
				_encher_cor(q)
		var pu = a[Mesh.ARRAY_TEX_UV]
		if pu != null and not tem_uv:
			tem_uv = true
			uv.resize(uv.size() + base)
		if tem_uv:
			if pu != null:
				uv.append_array(pu)
			else:
				uv.resize(uv.size() + q)
		var pu2 = a[Mesh.ARRAY_TEX_UV2]
		if pu2 != null and not tem_uv2:
			tem_uv2 = true
			uv2.resize(uv2.size() + base)
		if tem_uv2:
			if pu2 != null:
				uv2.append_array(pu2)
			else:
				uv2.resize(uv2.size() + q)
		var pi = a[Mesh.ARRAY_INDEX]
		var j0 := idx.size()
		if pi != null and (pi as PackedInt32Array).size() > 0:
			var ii: PackedInt32Array = pi
			idx.resize(j0 + ii.size())
			for j in ii.size():
				idx[j0 + j] = base + ii[j]
		else:
			idx.resize(j0 + q)
			for j in q:
				idx[j0 + j] = base + j

	func _encher_n(q: int) -> void:
		var j0 := n.size()
		n.resize(j0 + q)
		for j in q:
			n[j0 + j] = Vector3.UP

	func _encher_cor(q: int) -> void:
		var j0 := c.size()
		c.resize(j0 + q)
		for j in q:
			c[j0 + j] = Color.BLACK # como o SurfaceTool: parte sem cor entra preta

	func _encher_tg(q: int) -> void:
		var j0 := tg.size()
		tg.resize(j0 + q * 4)
		for j in q:
			tg[j0 + j * 4] = 1.0
			tg[j0 + j * 4 + 3] = 1.0

	func commit(am: ArrayMesh = null) -> ArrayMesh:
		if am == null:
			am = ArrayMesh.new()
		if not v.is_empty():
			var arr := []
			arr.resize(Mesh.ARRAY_MAX)
			arr[Mesh.ARRAY_VERTEX] = v
			if tem_n:
				arr[Mesh.ARRAY_NORMAL] = n
			if tem_tg:
				arr[Mesh.ARRAY_TANGENT] = tg
			if tem_c:
				arr[Mesh.ARRAY_COLOR] = c
			if tem_uv:
				arr[Mesh.ARRAY_TEX_UV] = uv
			if tem_uv2:
				arr[Mesh.ARRAY_TEX_UV2] = uv2
			arr[Mesh.ARRAY_INDEX] = idx
			am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		if _st != null:
			_st.commit(am)
		return am

# Igual a m.surface_get_arrays(i), mas sem fazer o jogo esperar o desenho depois da primeira leitura de cada malha
# (veja o começo do arquivo). Volta uma cópia inteira (as listas PackedArray do Godot 4 são compartilhadas: sem a
# cópia, quem mexesse nos vértices estragaria o guardado); copiar leva microssegundos. Guarda só as malhas que vêm de
# arquivo (corpo, cabelo, roupa do modelo), que são as mesmas para todo NPC e jogador.
static func arrays(m: Mesh, i: int) -> Array:
	if m is PrimitiveMesh:
		var k := Junta._chave_primitiva(m)
		if not Junta._cache.has(k):
			Junta._cache[k] = (m as PrimitiveMesh).get_mesh_arrays()
			Junta.leituras += 1
		else:
			Junta.guardadas += 1
		return (Junta._cache[k] as Array).duplicate(true)
	if m.resource_path == "": # malha feita no jogo (roupa de um NPC só): lê direto, para não guardar uma cópia de cada
		Junta.diretas += 1
		return m.surface_get_arrays(i)
	var l0 := Junta.leituras
	var r := Junta._da_malha(m, i).duplicate(true)
	if Junta.leituras == l0:
		Junta.guardadas += 1
	return r

# Só os vértices da superfície i (= surface_get_arrays(i)[Mesh.ARRAY_VERTEX]), lidos da placa uma vez por malha. Vale
# também para as malhas feitas no jogo (as peças de armadura ficam em cache em armadura.gd e são as mesmas para todo
# NPC): só os vértices, 12 bytes cada, então guardar não pesa.
static func vertices(m: Mesh, i: int) -> PackedVector3Array:
	if m is PrimitiveMesh:
		return arrays(m, i)[Mesh.ARRAY_VERTEX]
	if m.resource_path != "": # de arquivo: as listas inteiras já ficam guardadas (arrays)
		var l0 := Junta.leituras
		var pv: PackedVector3Array = Junta._da_malha(m, i)[Mesh.ARRAY_VERTEX]
		if Junta.leituras == l0:
			Junta.guardadas += 1
		return pv.duplicate()
	var id := m.get_instance_id()
	var e = Junta._cache_v.get(id)
	if e == null or (e[0] as WeakRef).get_ref() != m:
		e = [weakref(m), {}]
		Junta._cache_v[id] = e
		Junta._novas_v += 1
		if Junta._novas_v >= 64: # malhas que já saíram do jogo: solta os vértices delas
			Junta._novas_v = 0
			for k in Junta._cache_v.keys():
				if (Junta._cache_v[k][0] as WeakRef).get_ref() == null:
					Junta._cache_v.erase(k)
	var am := m as ArrayMesh
	var sig := [am.surface_get_format(i), am.surface_get_array_len(i)] if am else []
	var c = e[1].get(i)
	if c == null or c[0] != sig:
		Junta.diretas += 1
		c = [sig, m.surface_get_arrays(i)[Mesh.ARRAY_VERTEX]]
		e[1][i] = c
	else:
		Junta.guardadas += 1
	return (c[1] as PackedVector3Array).duplicate()

# = m.surface_get_blend_shape_arrays(i), que também lê da placa (espera o desenho) mesmo quando a malha não tem
# formas (blend shapes): sem formas, volta a lista vazia sem perguntar nada.
static func formas(m: Mesh, i: int) -> Array[Array]:
	var am := m as ArrayMesh
	if am and am.get_blend_shape_count() == 0:
		var vazia: Array[Array] = []
		return vazia
	return am.surface_get_blend_shape_arrays(i) if am else ([] as Array[Array])

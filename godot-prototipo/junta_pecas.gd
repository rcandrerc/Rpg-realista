extends RefCounted
# NPC mais leve, passo 1 (conselho de auditoria 2026-11-13, pacote 3): as peças da armadura de quem não é o herói
# (NPC da vila, outro jogador, bot, bandido) viram uma malha só por material. Antes cada placa (peitoral, saiote,
# canela, bota, fivela...) era um objeto separado, e cada um custava 3 chamadas de desenho (peça, contorno e sombra):
# o corpo da Cecília tinha 45 objetos. O desenho fica idêntico: os mesmos vértices, ossos, pesos e o mesmo material
# (com o mesmo contorno); só muda que a placa de vídeo recebe tudo de uma vez.
# - Peças com osso (as que dobram com o corpo): juntadas dentro de cada lugar (Armadura_corpo, _pernas, _pes...).
#   Se o lugar troca de peça, armadura.gd apaga o lugar inteiro e monta de novo, e a junta é refeita.
# - Peças presas num osso (ombreira, fivela, rebite): juntadas dentro do mesmo osso.
# - A capa fica de fora (o pano é simulado à parte, pano_capa.gd). O herói fica de fora (é visto de perto o tempo todo).
# Cache pela combinação de malhas e material: NPCs com a mesma roupa e o mesmo corpo usam a mesma malha juntada.

const NOME := "PecasJuntas"
static var ligado := true
const CACHE_MAX := 96 # combinações guardadas (roupa x corpo); passou disso, começa de novo
static var _cache := {} # chave -> [ArrayMesh, Skin ou null] (o aquecer.gd monta as das roupas comuns atrás da capa)

static func juntar(raiz: Node3D) -> void:
	if not ligado or raiz == null:
		return
	var esq: Skeleton3D = null
	for s in raiz.find_children("*", "Skeleton3D", true, false):
		esq = s
		break
	if esq == null:
		return
	for no in esq.get_children():
		if not (no is Node3D) or not str(no.name).begins_with("Armadura_") or str(no.name) == "Armadura_capa":
			continue
		if no.has_meta("junta_ok"):
			continue
		no.set_meta("junta_ok", true)
		_juntar_com_osso(no, esq)
		for ba in no.find_children("*", "BoneAttachment3D", true, false):
			_juntar_presas(ba)

# peças que dobram com o corpo (skin): filhas diretas do lugar, sem transformação própria
static func _juntar_com_osso(no: Node3D, esq: Skeleton3D) -> void:
	var grupos := {}
	for mi in no.get_children():
		if not _serve(mi) or mi.skin == null or not mi.transform.is_equal_approx(Transform3D.IDENTITY):
			continue
		var k := "%d:%d:%d" % [mi.material_override.get_instance_id(), mi.mesh.surface_get_format(0), mi.cast_shadow]
		if not grupos.has(k):
			grupos[k] = []
		grupos[k].append(mi)
	for k in grupos:
		var lista: Array = grupos[k]
		if lista.size() < 2:
			continue
		var par = _malha(lista, true)
		if par == null:
			continue
		var nova := MeshInstance3D.new()
		nova.name = NOME
		nova.mesh = par[0]
		nova.skin = par[1]
		nova.material_override = lista[0].material_override
		nova.cast_shadow = lista[0].cast_shadow
		nova.layers = lista[0].layers
		no.add_child(nova)
		nova.skeleton = nova.get_path_to(esq)
		for mi in lista:
			no.remove_child(mi)
			mi.queue_free()

# peças presas num osso (sem skin): filhas da mesma BoneAttachment3D, cada uma com a sua posição
static func _juntar_presas(ba: Node) -> void:
	var grupos := {}
	for mi in ba.get_children():
		if not _serve(mi) or mi.skin != null or mi.get_child_count() > 0:
			continue
		var k := "%d:%d:%d" % [mi.material_override.get_instance_id(), mi.mesh.surface_get_format(0), mi.cast_shadow]
		if not grupos.has(k):
			grupos[k] = []
		grupos[k].append(mi)
	for k in grupos:
		var lista: Array = grupos[k]
		if lista.size() < 2:
			continue
		var par = _malha(lista, false)
		if par == null:
			continue
		var nova := MeshInstance3D.new()
		nova.name = NOME
		nova.mesh = par[0]
		nova.material_override = lista[0].material_override
		nova.cast_shadow = lista[0].cast_shadow
		nova.layers = lista[0].layers
		ba.add_child(nova)
		for mi in lista:
			ba.remove_child(mi)
			mi.queue_free()

static func _serve(mi) -> bool:
	if not (mi is MeshInstance3D) or not mi.visible or mi.material_override == null or not (mi.mesh is ArrayMesh):
		return false
	var am: ArrayMesh = mi.mesh
	if am.get_surface_count() != 1 or am.get_blend_shape_count() > 0 or am.surface_get_primitive_type(0) != Mesh.PRIMITIVE_TRIANGLES:
		return false
	if mi.get_surface_override_material(0) != null or mi.visibility_range_end > 0.0 or mi.visibility_range_begin > 0.0:
		return false
	return true

# junta as malhas da lista numa malha de uma superfície (com osso: ossos remapeados para uma skin única)
static func _malha(lista: Array, com_osso: bool):
	var chave := ""
	for mi in lista:
		chave += "%d/%d/%s;" % [mi.mesh.get_instance_id(), mi.skin.get_instance_id() if mi.skin else 0, var_to_str(mi.transform) if not com_osso else ""]
	if _cache.has(chave):
		return _cache[chave]
	var fmt: int = lista[0].mesh.surface_get_format(0)
	var tem := []
	var base: Array = lista[0].mesh.surface_get_arrays(0)
	for i in Mesh.ARRAY_MAX:
		tem.append(base[i] != null)
	if tem[Mesh.ARRAY_CUSTOM0] or tem[Mesh.ARRAY_CUSTOM1] or tem[Mesh.ARRAY_CUSTOM2] or tem[Mesh.ARRAY_CUSTOM3]:
		return null
	var por_vertice := 8 if (fmt & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS) else 4
	# skin única: as binds de cada skin diferente entram uma vez, e os ossos de cada malha andam o tanto delas antes
	var skin: Skin = null
	var desloc := {} # skin id -> deslocamento dos ossos
	if com_osso:
		var skins := []
		for mi in lista:
			if not desloc.has(mi.skin.get_instance_id()):
				desloc[mi.skin.get_instance_id()] = 0
				skins.append(mi.skin)
		if skins.size() == 1:
			skin = skins[0]
		else:
			skin = Skin.new()
			for s: Skin in skins:
				desloc[s.get_instance_id()] = skin.get_bind_count()
				for b in s.get_bind_count():
					var nome := s.get_bind_name(b)
					if nome != &"":
						skin.add_named_bind(nome, s.get_bind_pose(b))
					else:
						skin.add_bind(s.get_bind_bone(b), s.get_bind_pose(b))
	var V := PackedVector3Array()
	var N := PackedVector3Array()
	var T := PackedFloat32Array()
	var C := PackedColorArray()
	var U := PackedVector2Array()
	var U2 := PackedVector2Array()
	var B := PackedInt32Array()
	var W := PackedFloat32Array()
	var I := PackedInt32Array()
	for mi in lista:
		var a: Array = mi.mesh.surface_get_arrays(0)
		for i in Mesh.ARRAY_MAX:
			if i != Mesh.ARRAY_INDEX and (a[i] != null) != tem[i]:
				return null # formato diferente: não junta
		var v0 := V.size()
		var pos: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
		var xf: Transform3D = mi.transform
		var bn := xf.basis.inverse().transposed()
		if com_osso:
			V.append_array(pos)
		else:
			for p in pos:
				V.append(xf * p)
		if tem[Mesh.ARRAY_NORMAL]:
			if com_osso:
				N.append_array(a[Mesh.ARRAY_NORMAL])
			else:
				for n: Vector3 in a[Mesh.ARRAY_NORMAL]:
					N.append((bn * n).normalized())
		if tem[Mesh.ARRAY_TANGENT]:
			var ta: PackedFloat32Array = a[Mesh.ARRAY_TANGENT]
			if com_osso:
				T.append_array(ta)
			else:
				for j in range(0, ta.size(), 4):
					var t3 := (xf.basis * Vector3(ta[j], ta[j + 1], ta[j + 2])).normalized()
					T.append_array([t3.x, t3.y, t3.z, ta[j + 3]])
		if tem[Mesh.ARRAY_COLOR]:
			C.append_array(a[Mesh.ARRAY_COLOR])
		if tem[Mesh.ARRAY_TEX_UV]:
			U.append_array(a[Mesh.ARRAY_TEX_UV])
		if tem[Mesh.ARRAY_TEX_UV2]:
			U2.append_array(a[Mesh.ARRAY_TEX_UV2])
		if tem[Mesh.ARRAY_BONES]:
			var d: int = desloc.get(mi.skin.get_instance_id(), 0) if com_osso and mi.skin else 0
			var bo = a[Mesh.ARRAY_BONES]
			if d == 0:
				B.append_array(bo)
			else:
				for b in bo:
					B.append(b + d)
		if tem[Mesh.ARRAY_WEIGHTS]:
			W.append_array(a[Mesh.ARRAY_WEIGHTS])
		var ind = a[Mesh.ARRAY_INDEX]
		if ind == null:
			for j in pos.size():
				I.append(v0 + j)
		elif v0 == 0:
			I.append_array(ind)
		else:
			for j in ind:
				I.append(v0 + j)
	if tem[Mesh.ARRAY_BONES] and B.size() != V.size() * por_vertice:
		return null
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = V
	if tem[Mesh.ARRAY_NORMAL]: arr[Mesh.ARRAY_NORMAL] = N
	if tem[Mesh.ARRAY_TANGENT]: arr[Mesh.ARRAY_TANGENT] = T
	if tem[Mesh.ARRAY_COLOR]: arr[Mesh.ARRAY_COLOR] = C
	if tem[Mesh.ARRAY_TEX_UV]: arr[Mesh.ARRAY_TEX_UV] = U
	if tem[Mesh.ARRAY_TEX_UV2]: arr[Mesh.ARRAY_TEX_UV2] = U2
	if tem[Mesh.ARRAY_BONES]: arr[Mesh.ARRAY_BONES] = B
	if tem[Mesh.ARRAY_WEIGHTS]: arr[Mesh.ARRAY_WEIGHTS] = W
	arr[Mesh.ARRAY_INDEX] = I
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr, [], {}, fmt & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS)
	var mat = lista[0].mesh.surface_get_material(0)
	if mat:
		am.surface_set_material(0, mat)
	if _cache.size() >= CACHE_MAX:
		_cache.clear()
	_cache[chave] = [am, skin]
	return [am, skin]

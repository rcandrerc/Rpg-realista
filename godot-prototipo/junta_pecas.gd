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
	_juntar_aco(esq)

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
	_lidas[am.get_instance_id()] = arr # o passo 2 lê daqui, sem pedir de volta à placa de vídeo
	return [am, skin]

# ---------- passo 2 (André 2026-11-13: "Seguir" no corpo leve): a armadura inteira num desenho só ----------
# Todas as peças de aço e couro (armadura_real.gdshader) de todos os lugares, com osso ou presas num osso, viram UMA
# malha com UM material. Cada vértice leva o número do material de origem (UV.x), e o material juntado guarda as
# cores e o acabamento de cada um numa lista (o shader é o mesmo armadura_real, gerado aqui com as entradas em lista,
# então qualquer mudança nele vale para os dois). O contorno é o mesmo de todas as peças. Cecília: ~16 objetos da
# armadura (peça, contorno e sombra de cada um) viram 1.
# - Peça presa num osso entra como peça com osso: peso 1 naquele osso, posição já no lugar dela.
# - O lugar escondido (roupa de ofício esconde as placas) fica de fora, como está.
# - As peças soltas ficam escondidas (não apagadas); se um lugar troca de peça (armadura.gd apaga e monta de novo),
#   elas voltam a aparecer até a malha nova ficar pronta (montada fora do quadro, _montar_depois).
const NOME_ACO := "ArmaduraJunta"
const ACO_MAX := 12 # materiais diferentes numa malha juntada (sobra: a peça fica como está)
static var _shader_aco: Shader
static var _uniformes := [] # [[tipo, nome, cor?, padrão], ...] do armadura_real.gdshader
static var _cache_aco := {}
static var _mats_aco := {}

static func _metal() -> Shader:
	return preload("res://armadura.gd").SHADER_METAL

# o armadura_real.gdshader com cada "uniform" virando lista e o número do material vindo do UV.x
static func shader_aco() -> Shader:
	if _shader_aco != null:
		return _shader_aco
	var fonte: String = _metal().code
	var re := RegEx.new()
	re.compile("^uniform\\s+(\\w+)\\s+(\\w+)\\s*(:\\s*([^=;]+))?(=\\s*([^;]+))?;")
	var linhas := fonte.split("\n")
	var saida := PackedStringArray()
	_uniformes.clear()
	var locais := ""
	var pos_varying := false
	for l in linhas:
		var r := re.search(l.strip_edges())
		if r:
			var tipo := r.get_string(1)
			var nome := r.get_string(2)
			var dica := r.get_string(4).strip_edges()
			var cor := "source_color" in dica
			_uniformes.append([tipo, nome, cor, _valor_glsl(tipo, r.get_string(6).strip_edges())])
			saida.append("uniform %s %s_m[%d]%s;" % [tipo, nome, ACO_MAX, " : source_color" if cor else ""])
			locais += "\t%s %s = %s_m[_mi];\n" % [tipo, nome, nome]
			continue
		if not pos_varying and l.begins_with("varying"):
			saida.append("varying flat float v_id;")
			pos_varying = true
		if l.begins_with("void vertex() {"):
			saida.append(l)
			saida.append("\tv_id = UV.x;")
			continue
		if l.begins_with("void fragment() {") or l.begins_with("void light() {"):
			saida.append(l)
			saida.append("\tint _mi = clamp(int(v_id + 0.5), 0, %d);" % (ACO_MAX - 1))
			saida.append(locais)
			continue
		saida.append(l)
	_shader_aco = Shader.new()
	_shader_aco.code = "\n".join(saida)
	return _shader_aco

static var _lidas := {} # malha id -> arrays dela (ler da placa de vídeo uma vez só; as do passo 1 já entram aqui)
const LIDAS_MAX := 256
static var _pendentes := {} # chave -> [tarefa, [weakref dos esqueletos esperando], materiais]

static func _arrays(mesh: ArrayMesh) -> Array:
	var id := mesh.get_instance_id()
	var a = _lidas.get(id)
	if a == null:
		a = mesh.surface_get_arrays(0)
		if _lidas.size() >= LIDAS_MAX:
			_lidas.clear()
		_lidas[id] = a
	return a

# "aco_junta": peça que este arquivo escondeu porque já está dentro da malha juntada (continua contando)
static func _eh_aco(mi) -> bool:
	if not (mi is MeshInstance3D) or not (mi.visible or mi.has_meta("aco_junta")) or not (mi.material_override is ShaderMaterial):
		return false
	if mi.material_override.shader != _metal() or not (mi.mesh is ArrayMesh) or mi.get_child_count() > 0:
		return false
	var am: ArrayMesh = mi.mesh
	if am.get_surface_count() != 1 or am.get_blend_shape_count() > 0 or am.surface_get_primitive_type(0) != Mesh.PRIMITIVE_TRIANGLES:
		return false
	if mi.get_surface_override_material(0) != null or (am.surface_get_format(0) & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS):
		return false
	return true

static func _juntar_aco(esq: Skeleton3D) -> void:
	var pecas := [] # [MeshInstance3D, osso ("" = peça com osso)]
	for no in esq.get_children():
		if not (no is Node3D) or not str(no.name).begins_with("Armadura_") or str(no.name) == "Armadura_capa":
			continue
		if not no.visible:
			continue
		for mi in no.get_children():
			if _eh_aco(mi) and mi.skin != null and mi.transform.is_equal_approx(Transform3D.IDENTITY):
				pecas.append([mi, ""])
		for ba in no.find_children("*", "BoneAttachment3D", true, false):
			if not ba.visible or ba.bone_name == "":
				continue
			for mi in ba.get_children():
				if _eh_aco(mi) and mi.skin == null:
					pecas.append([mi, str(ba.bone_name)])
	var chave := ""
	for p in pecas:
		var mi: MeshInstance3D = p[0]
		chave += "%d/%d/%d/%s/%s;" % [mi.mesh.get_instance_id(), mi.skin.get_instance_id() if mi.skin else 0, mi.material_override.get_instance_id(), p[1], var_to_str(mi.transform) if p[1] != "" else ""]
	var velho := esq.get_node_or_null(NOME_ACO)
	if velho and velho.get_meta("chave", "") == chave:
		return
	if velho:
		esq.remove_child(velho)
		velho.queue_free()
	var par = _cache_aco.get(chave)
	if par == null or par.is_empty():
		# sem malha pronta: as peças aparecem soltas, como antes (nunca some nada); a malha é montada fora do quadro
		for p in pecas:
			p[0].visible = true
			p[0].remove_meta("aco_junta")
		if par == null and not pecas.is_empty():
			_montar_depois(chave, pecas, esq)
		return
	for p in pecas:
		p[0].visible = false
		p[0].set_meta("aco_junta", true)
	var mi := MeshInstance3D.new()
	mi.name = NOME_ACO
	mi.set_meta("chave", chave)
	mi.mesh = par[0]
	mi.skin = par[1]
	mi.material_override = par[2]
	# sombra e LOD como as peças estavam (NPC longe já está sem sombra: main.npc_simples guarda "sombra_perto")
	var p0: MeshInstance3D = pecas[0][0]
	mi.cast_shadow = p0.cast_shadow
	mi.lod_bias = p0.lod_bias
	if p0.has_meta("sombra_perto"):
		mi.set_meta("sombra_perto", p0.get_meta("sombra_perto"))
	esq.add_child(mi)
	mi.skeleton = NodePath("..")

# Monta a malha juntada numa linha do WorkerThreadPool (André odeia travadinha: no PC eram ~12 ms no quadro em que o
# corpo nascia, no celular seria 3 a 4 vezes isso). Aqui, no quadro, só copia os dados das peças; quando a malha fica
# pronta, todo corpo que esperava por ela troca as peças soltas por ela. A mesma roupa depois sai na hora (cache).
static func _montar_depois(chave: String, pecas: Array, esq: Skeleton3D) -> void:
	if _pendentes.has(chave):
		_pendentes[chave][1].append(weakref(esq))
		return
	var mats := []
	for p in pecas:
		if not mats.has(p[0].material_override):
			mats.append(p[0].material_override)
	if mats.size() > ACO_MAX:
		mats.resize(ACO_MAX) # nunca acontece com as roupas de hoje (7 no máximo); a sobra usa o último
	var dados := []
	for p in pecas:
		var mi: MeshInstance3D = p[0]
		var a := _arrays(mi.mesh)
		if a.size() < Mesh.ARRAY_MAX or a[Mesh.ARRAY_VERTEX] == null:
			_cache_aco[chave] = [] # malha sem dados legíveis: essa roupa fica com as peças soltas
			return
		if p[1] == "" and (a[Mesh.ARRAY_BONES] == null or a[Mesh.ARRAY_WEIGHTS] == null):
			_cache_aco[chave] = []
			return
		var binds := []
		if mi.skin:
			var s: Skin = mi.skin
			for b in s.get_bind_count():
				binds.append([s.get_bind_name(b), s.get_bind_bone(b), s.get_bind_pose(b)])
		dados.append({"a": a, "skin": mi.skin.get_instance_id() if mi.skin else 0, "binds": binds, "osso": p[1],
			"xf": mi.transform, "id": float(mini(mats.find(mi.material_override), ACO_MAX - 1)) if mats.has(mi.material_override) else float(ACO_MAX - 1)})
	var t := WorkerThreadPool.add_task(_montar_aco.bind(chave, dados), true, "Armadura juntada") # alta: tarefa curta, não espera a fila de shaders
	_pendentes[chave] = [t, [weakref(esq)], mats]

# (fora do quadro) as arrays da malha juntada e as binds da skin única; nada de nó nem de recurso da cena aqui
static func _montar_aco(chave: String, dados: Array) -> void:
	var binds := [] # [nome, osso, pose]
	var desloc := {}
	var osso_bind := {}
	for d in dados:
		if d.osso == "" and not desloc.has(d.skin):
			desloc[d.skin] = binds.size()
			binds.append_array(d.binds)
		elif d.osso != "" and not osso_bind.has(d.osso):
			osso_bind[d.osso] = binds.size()
			binds.append([StringName(d.osso), -1, Transform3D.IDENTITY])
	var V := PackedVector3Array()
	var N := PackedVector3Array()
	var U := PackedVector2Array()
	var U2 := PackedVector2Array()
	var B := PackedInt32Array()
	var W := PackedFloat32Array()
	var I := PackedInt32Array()
	for d in dados:
		var a: Array = d.a
		var pos: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
		var nv := pos.size()
		var v0 := V.size()
		var nor = a[Mesh.ARRAY_NORMAL]
		if d.osso == "":
			V.append_array(pos)
			if nor != null:
				N.append_array(nor)
			var dl: int = desloc[d.skin]
			if dl == 0:
				B.append_array(a[Mesh.ARRAY_BONES])
			else:
				for b in a[Mesh.ARRAY_BONES]:
					B.append(b + dl)
			W.append_array(a[Mesh.ARRAY_WEIGHTS])
		else:
			var xf: Transform3D = d.xf
			V.append_array(xf * pos)
			if nor != null:
				var bn := xf.basis.inverse().transposed()
				for n: Vector3 in nor:
					N.append((bn * n).normalized())
			var ob: int = osso_bind[d.osso]
			for j in nv:
				B.append_array([ob, 0, 0, 0])
				W.append_array([1.0, 0.0, 0.0, 0.0])
		if nor == null:
			for j in nv:
				N.append(Vector3.UP)
		var u2 = a[Mesh.ARRAY_TEX_UV2]
		if u2 != null:
			U2.append_array(u2)
		else:
			var z := PackedVector2Array()
			z.resize(nv)
			U2.append_array(z)
		var u := PackedVector2Array()
		u.resize(nv)
		u.fill(Vector2(d.id, 0.0))
		U.append_array(u)
		var ind = a[Mesh.ARRAY_INDEX]
		if ind == null: # peça feita em código sem índice: os vértices já vêm de três em três
			for j in nv:
				I.append(v0 + j)
		else:
			for j in ind:
				I.append(v0 + j)
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = V
	arr[Mesh.ARRAY_NORMAL] = N
	arr[Mesh.ARRAY_TEX_UV] = U
	arr[Mesh.ARRAY_TEX_UV2] = U2
	arr[Mesh.ARRAY_BONES] = B
	arr[Mesh.ARRAY_WEIGHTS] = W
	arr[Mesh.ARRAY_INDEX] = I
	_pronto.call_deferred(chave, arr, binds)

# (de volta no quadro) cria a malha, a skin e o material, guarda no cache e troca as peças soltas dos corpos que esperavam
static func _pronto(chave: String, arr: Array, binds: Array) -> void:
	var pend = _pendentes.get(chave)
	if pend == null:
		return
	_pendentes.erase(chave)
	WorkerThreadPool.wait_for_task_completion(pend[0])
	var skin := Skin.new()
	for b in binds:
		if b[0] != &"":
			skin.add_named_bind(b[0], b[2])
		else:
			skin.add_bind(b[1], b[2])
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	if _cache_aco.size() >= CACHE_MAX:
		_cache_aco.clear()
	_cache_aco[chave] = [am, skin, _material_aco(pend[2])]
	for w in pend[1]:
		var esq = w.get_ref()
		if esq != null and is_instance_valid(esq):
			_juntar_aco(esq)

# "vec4(0.78, 0.8, 0.83, 1.0)" -> Color; "vec2(..)" -> Vector2; "0.045" -> float; sem valor -> zero do tipo
static func _valor_glsl(tipo: String, txt: String) -> Variant:
	var n := PackedFloat32Array()
	var dentro := txt
	if "(" in txt:
		dentro = txt.get_slice("(", 1).get_slice(")", 0)
	for p in dentro.split(",", false):
		if p.strip_edges().is_valid_float():
			n.append(p.strip_edges().to_float())
	match tipo:
		"vec4":
			while n.size() < 4:
				n.append(1.0 if n.size() == 3 else 0.0)
			return Color(n[0], n[1], n[2], n[3])
		"vec2":
			while n.size() < 2:
				n.append(0.0)
			return Vector2(n[0], n[1])
		"int":
			return int(n[0]) if n.size() > 0 else 0
		_:
			return n[0] if n.size() > 0 else 0.0

# o material juntado: cada entrada do armadura_real vira uma lista, na ordem dos materiais
static func _material_aco(mats: Array) -> ShaderMaterial:
	var chave := ""
	for m in mats:
		chave += "%d;" % m.get_instance_id()
	if _mats_aco.has(chave):
		return _mats_aco[chave]
	var sh := shader_aco()
	var sm := ShaderMaterial.new()
	sm.shader = sh
	for u in _uniformes:
		var tipo: String = u[0]
		var nome: String = u[1]
		var padrao = RenderingServer.shader_get_parameter_default(_metal().get_rid(), nome)
		if padrao == null:
			padrao = u[3] # sem placa de vídeo (teste sem tela) o padrão não vem: usa o valor escrito no .gdshader
		var lista := []
		for i in ACO_MAX:
			var m: ShaderMaterial = mats[min(i, mats.size() - 1)]
			var v = m.get_shader_parameter(nome)
			lista.append(v if v != null else padrao)
		match tipo:
			"float":
				var f := PackedFloat32Array()
				for v in lista: f.append(float(v))
				sm.set_shader_parameter(nome + "_m", f)
			"vec2":
				var f := PackedVector2Array()
				for v in lista: f.append(v)
				sm.set_shader_parameter(nome + "_m", f)
			"vec4":
				var f := PackedColorArray()
				for v in lista: f.append(v if v is Color else Color(v.x, v.y, v.z, v.w))
				sm.set_shader_parameter(nome + "_m", f)
			_:
				sm.set_shader_parameter(nome + "_m", lista)
	sm.next_pass = mats[0].next_pass # contorno: o mesmo em todas as peças (armadura.gd _material)
	if _mats_aco.size() >= CACHE_MAX:
		_mats_aco.clear()
	_mats_aco[chave] = sm
	return sm

# atrás da capa de carregamento (aquecer.gd): um triângulo com o material juntado, no mesmo formato da malha juntada,
# aparece na frente da câmera para a placa de vídeo montar o shader (peça, contorno e sombra) antes do jogo começar.
# Sem isso o primeiro NPC de armadura na tela travava montando o shader novo.
static func aquecer_em(pai: Node3D, esq: Skeleton3D = null) -> void:
	var A = preload("res://armadura.gd")
	var mt := _material_aco([A._material("metal", 1), A._material("couro", 0)])
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = PackedVector3Array([Vector3(0, 1, 0), Vector3(0.3, 1, 0), Vector3(0, 1.3, 0)])
	arr[Mesh.ARRAY_NORMAL] = PackedVector3Array([Vector3.BACK, Vector3.BACK, Vector3.BACK])
	arr[Mesh.ARRAY_TEX_UV] = PackedVector2Array([Vector2.ZERO, Vector2.ZERO, Vector2.ZERO])
	arr[Mesh.ARRAY_TEX_UV2] = PackedVector2Array([Vector2.ZERO, Vector2.ZERO, Vector2.ZERO])
	arr[Mesh.ARRAY_BONES] = PackedInt32Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
	arr[Mesh.ARRAY_WEIGHTS] = PackedFloat32Array([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0])
	arr[Mesh.ARRAY_INDEX] = PackedInt32Array([0, 1, 2])
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	# sem osso e com osso (a malha juntada é de pele com osso: na placa de vídeo o formato muda)
	for com_osso in [false, true]:
		if com_osso and esq == null:
			continue
		var mi := MeshInstance3D.new()
		mi.mesh = am
		mi.material_override = mt
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		pai.add_child(mi)
		if com_osso:
			var sk := Skin.new()
			sk.add_bind(0, Transform3D.IDENTITY)
			mi.skin = sk
			mi.skeleton = mi.get_path_to(esq)

extends RefCounted
# LOD (malha mais simples de longe) para as malhas que o jogo monta sozinho (André 2026-11-11: "FPS péssimo").
# Os corpos VRoid vêm do .glb com LOD, mas o corpo pintado, o penteado, a roupa de baixo e as peças de armadura são
# montados no jogo (armadura.gd, penteado.gd...) com ArrayMesh.new() e nascem SEM LOD: cada NPC em volta desenhava
# ~100 mil triângulos (70 mil sem LOD), de perto ou a 40 m, e ainda de novo na sombra. Aqui cada malha dessas ganha
# os níveis de LOD do Godot (ImporterMesh.generate_lods, o mesmo do importador de .glb): de perto é a mesma malha; de
# longe a placa de vídeo desenha a versão simplificada. Só índices novos: vértices, ossos, pesos, formas do rosto e
# materiais continuam os mesmos.
# Uma malha por quadro (fila) e com cache pelo formato da malha (peças iguais em NPCs diferentes geram uma vez só).

const MIN_TRIS := 600 # malha pequena não compensa
const POR_QUADRO_MS := 4.0 # tempo máximo por quadro gerando LOD (o resto fica para os próximos quadros)
static var _cache := {} # chave da malha -> Array de lods por superfície (Array de PackedInt32Array)
static var _fila: Array = [] # MeshInstance3D esperando
static var _quadro := -1
static var _gasto := 0.0
static var ligado := true

# põe as malhas sem LOD deste corpo na fila (chamado quando o corpo de NPC ou de outro jogador aparece ou troca de roupa)
static func pedir(raiz: Node) -> void:
	if not ligado or raiz == null:
		return
	for mi: MeshInstance3D in raiz.find_children("*", "MeshInstance3D", true, false):
		if not (mi.mesh is ArrayMesh) or mi.get_meta("lod_ok", 0) == mi.mesh.get_instance_id():
			continue
		mi.set_meta("lod_ok", mi.mesh.get_instance_id()) # malha trocada (roupa nova) entra de novo
		if _precisa(mi.mesh):
			# a chave sai aqui, junto com a conferência acima: com o desenho em paralelo (APK 2026-11-12) cada leitura da
			# malha no RenderingServer espera a outra linha terminar; tudo no mesmo quadro = uma espera só
			mi.set_meta("lod_chave", _chave(mi.mesh))
			_fila.append(mi)

static func _precisa(am: ArrayMesh) -> bool:
	var tris := 0
	for i in am.get_surface_count():
		if am.surface_get_primitive_type(i) != Mesh.PRIMITIVE_TRIANGLES:
			return false
		if am.surface_get_format(i) & (Mesh.ARRAY_FORMAT_CUSTOM0 | Mesh.ARRAY_FORMAT_CUSTOM1 | Mesh.ARRAY_FORMAT_CUSTOM2 | Mesh.ARRAY_FORMAT_CUSTOM3):
			return false # dados extras para shader (capa, pano): fica como está
		var sd := RenderingServer.mesh_get_surface(am.get_rid(), i)
		if not (sd.get("lods", []) as Array).is_empty():
			return false # já tem LOD (veio do .glb)
		tris += int(sd.get("index_count", 0)) / 3
	return tris >= MIN_TRIS

# chamado todo quadro (main.gd): aplica o LOD já pronto e manda gerar o que falta numa linha de fundo (o cálculo
# pesado não trava o quadro); no quadro, no máximo POR_QUADRO_MS
static var _tarefa := -1 # WorkerThreadPool
static var _gerando: ImporterMesh = null
static var _gerando_k := ""
static var _esperando: Array = [] # [MeshInstance3D, chave, ImporterMesh] do formato que está sendo gerado

static func passo() -> void:
	var fr := Engine.get_process_frames()
	if fr != _quadro:
		_quadro = fr
		_gasto = 0.0
	if _tarefa >= 0 and WorkerThreadPool.is_task_completed(_tarefa):
		WorkerThreadPool.wait_for_task_completion(_tarefa)
		_tarefa = -1
		var lods: Array = []
		for i in _gerando.get_surface_count():
			var d := {}
			for l in _gerando.get_surface_lod_count(i):
				d[_gerando.get_surface_lod_size(i, l)] = _gerando.get_surface_lod_indices(i, l)
			lods.append(d)
		_cache[_gerando_k] = lods
		_gerando = null
		_fila = _esperando + _fila # quem esperava por este formato vai primeiro (agora sai do cache)
		_esperando.clear()
	var adiadas: Array = []
	while not _fila.is_empty() and _gasto < POR_QUADRO_MS:
		var mi = _fila.pop_front()
		if not is_instance_valid(mi) or not (mi.mesh is ArrayMesh):
			continue
		var t0 := Time.get_ticks_usec()
		var velha: ArrayMesh = mi.mesh
		var k: String = mi.get_meta("lod_chave", "") if mi.get_meta("lod_ok", 0) == velha.get_instance_id() else ""
		if k == "":
			k = _chave(velha)
		if _cache.has(k):
			var nova := _montar(velha, _cache[k])
			if nova != null:
				nova.custom_aabb = velha.custom_aabb
				mi.mesh = nova
				mi.set_meta("lod_ok", nova.get_instance_id())
		elif _tarefa < 0: # gera este formato na linha de fundo
			_gerando = _montar_importer(velha, [])
			_gerando_k = k
			_esperando.append(mi)
			_tarefa = WorkerThreadPool.add_task(_gerar.bind(_gerando), false, "LOD das malhas")
		elif k == _gerando_k:
			_esperando.append(mi)
		else:
			adiadas.append(mi) # outro formato: espera a linha de fundo terminar
		_gasto += (Time.get_ticks_usec() - t0) / 1000.0
	_fila = adiadas + _fila

static func _gerar(im: ImporterMesh) -> void:
	im.generate_lods(25.0, 60.0, [])

static func _chave(am: ArrayMesh) -> String:
	var k := ""
	for i in am.get_surface_count():
		var sd := RenderingServer.mesh_get_surface(am.get_rid(), i)
		k += "%d/%d/%d/%d|" % [int(sd.get("vertex_count", 0)), int(sd.get("index_count", 0)), hash(sd.get("index_data", PackedByteArray())), hash(sd.get("vertex_data", PackedByteArray()))]
	return k

static func _montar_importer(am: ArrayMesh, lods: Array) -> ImporterMesh:
	var im := ImporterMesh.new()
	for b in am.get_blend_shape_count():
		im.add_blend_shape(am.get_blend_shape_name(b))
	im.set_blend_shape_mode(am.blend_shape_mode)
	for i in am.get_surface_count():
		im.add_surface(am.surface_get_primitive_type(i), am.surface_get_arrays(i), am.surface_get_blend_shape_arrays(i),
			lods[i] if i < lods.size() else {}, am.surface_get_material(i), am.surface_get_name(i),
			am.surface_get_format(i) & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS)
	return im

# a mesma malha com os índices de LOD guardados (null = este formato não ganhou LOD)
static func _montar(am: ArrayMesh, lods: Array) -> ArrayMesh:
	if lods.all(func(d): return (d as Dictionary).is_empty()):
		return null
	return _montar_importer(am, lods).get_mesh()

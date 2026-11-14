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
# malha original -> malha com LOD já montada (2026-11-13): antes cada corpo novo ganhava uma cópia própria da mesma malha
# (outra cópia na placa de vídeo e mais trabalho no quadro); agora todos os corpos com a mesma malha usam a mesma.
# Referências fracas: a malha some quando nenhum corpo usa mais.
static var _prontas := {} # instance id da original -> [WeakRef original, WeakRef com LOD]

# põe as malhas sem LOD deste corpo na fila (chamado quando o corpo de NPC ou de outro jogador aparece ou troca de roupa)
# 2026-11-14 (registros do celular: "lod" 30 a 60 ms por quadro nos primeiros minutos, e o pedido no meio do quadro dos
# NPCs que aparecem): toda leitura da malha na placa de vídeo (conferir se precisa, a chave, as listas para montar) faz
# a linha do jogo esperar a linha do desenho terminar o quadro (malhas.gd). Agora o pedido só põe na fila, e conferir,
# gerar e montar vão todos para a linha de fundo; no quadro só troca a malha pronta.
static func pedir(raiz: Node) -> void:
	if not ligado or raiz == null:
		return
	for mi: MeshInstance3D in raiz.find_children("*", "MeshInstance3D", true, false):
		pedir_malha(mi)

# uma malha só (a armadura juntada de junta_pecas.gd nasce depois do pedir do corpo)
static func pedir_malha(mi: MeshInstance3D) -> void:
	if not ligado or mi == null or not (mi.mesh is ArrayMesh) or mi.get_meta("lod_ok", 0) == mi.mesh.get_instance_id():
		return
	mi.set_meta("lod_ok", mi.mesh.get_instance_id()) # malha trocada (roupa nova) entra de novo
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

# chamado todo quadro (main.gd): troca o que a linha de fundo já montou e manda a próxima leva (até POR_LEVA malhas
# diferentes) para lá. Na linha de fundo: confere, gera os níveis (com cache pelo formato) e monta a malha com LOD.
const POR_LEVA := 8
static var _tarefa := -1 # WorkerThreadPool
static var _leva: Array = [] # [{velha, mis: [MeshInstance3D]}] da tarefa em andamento
static var _na_leva := {} # instance id da malha original -> item da _leva
static var _res: Array = [] # o que a linha de fundo montou, na ordem da _leva (null = não ganha LOD)
static var _sem_lod := {} # instance id -> WeakRef das malhas que não ganham LOD (pequena, já tem, dado extra)

static func passo() -> void:
	var fr := Engine.get_process_frames()
	if fr != _quadro:
		_quadro = fr
		_gasto = 0.0
	if _tarefa >= 0:
		if not WorkerThreadPool.is_task_completed(_tarefa):
			_juntar_a_leva() # quem chegou com a mesma malha espera junto
			return
		WorkerThreadPool.wait_for_task_completion(_tarefa)
		_tarefa = -1
		for li in _leva.size():
			var it: Dictionary = _leva[li]
			var velha: ArrayMesh = it.velha
			var nova: ArrayMesh = _res[li]
			if nova == null:
				_sem_lod[velha.get_instance_id()] = weakref(velha)
				continue
			nova.custom_aabb = velha.custom_aabb
			nova.set_meta("lod_de", weakref(velha)) # o cabelo debaixo do capacete (armadura.gd) parte da original
			_prontas[velha.get_instance_id()] = [weakref(velha), weakref(nova)]
			for mi in it.mis:
				if is_instance_valid(mi) and mi.mesh == velha:
					mi.mesh = nova
					mi.set_meta("lod_ok", nova.get_instance_id())
		_leva = []
		_na_leva.clear()
	# a fila: o que já tem pronta troca aqui mesmo; o resto vira a próxima leva
	var t0 := Time.get_ticks_usec()
	while not _fila.is_empty() and _leva.size() < POR_LEVA and Time.get_ticks_usec() - t0 < int(POR_QUADRO_MS * 1000.0):
		var mi = _fila.pop_front()
		if not is_instance_valid(mi) or not (mi.mesh is ArrayMesh):
			continue
		var velha: ArrayMesh = mi.mesh
		var nova := _pronta(velha)
		if nova != null:
			mi.mesh = nova
			mi.set_meta("lod_ok", nova.get_instance_id())
			continue
		var id := velha.get_instance_id()
		var sl = _sem_lod.get(id)
		if sl != null:
			if (sl as WeakRef).get_ref() == velha:
				continue
			_sem_lod.erase(id)
		if _na_leva.has(id):
			_na_leva[id].mis.append(mi)
			continue
		var it := {"velha": velha, "mis": [mi]}
		_leva.append(it)
		_na_leva[id] = it
	if not _leva.is_empty():
		var velhas: Array = []
		for it in _leva:
			velhas.append(it.velha)
		_res = []
		_res.resize(velhas.size())
		_tarefa = WorkerThreadPool.add_task(_trabalhar.bind(velhas, _res), false, "LOD das malhas")

# enquanto a leva roda: quem chegou com uma malha que já está nela só espera junto (sai da fila)
static func _juntar_a_leva() -> void:
	if _fila.is_empty() or _na_leva.is_empty():
		return
	var resto: Array = []
	for mi in _fila:
		if is_instance_valid(mi) and mi.mesh is ArrayMesh and _na_leva.has(mi.mesh.get_instance_id()):
			_na_leva[mi.mesh.get_instance_id()].mis.append(mi)
		else:
			resto.append(mi)
	_fila = resto

# linha de fundo: tudo que lê a malha da placa fica aqui (a espera pelo desenho é desta linha, não do jogo)
static func _trabalhar(velhas: Array, res: Array) -> void:
	for vi in velhas.size():
		var velha: ArrayMesh = velhas[vi]
		var k := _chave_se_precisa(velha)
		if k == "":
			continue
		if not _cache.has(k):
			var im := _montar_importer(velha, [])
			_gerar(im)
			var lods: Array = []
			for i in im.get_surface_count():
				var d := {}
				for l in im.get_surface_lod_count(i):
					d[im.get_surface_lod_size(i, l)] = im.get_surface_lod_indices(i, l)
				lods.append(d)
			_cache[k] = lods
		res[vi] = _montar(velha, _cache[k])

static func _pronta(velha: ArrayMesh) -> ArrayMesh:
	var p = _prontas.get(velha.get_instance_id())
	if p == null:
		return null
	if (p[0] as WeakRef).get_ref() != velha or (p[1] as WeakRef).get_ref() == null:
		_prontas.erase(velha.get_instance_id())
		return null
	return (p[1] as WeakRef).get_ref()

# a malha original de uma malha com LOD montada aqui (ou ela mesma)
static func original(am: Mesh) -> Mesh:
	var w = am.get_meta("lod_de", null) if am else null
	var o = (w as WeakRef).get_ref() if w is WeakRef else null
	return o if o is Mesh else am

# _precisa e _chave numa leitura só de cada superfície (na linha de fundo cada leitura espera um quadro do desenho)
static func _chave_se_precisa(am: ArrayMesh) -> String:
	var tris := 0
	var k := ""
	for i in am.get_surface_count():
		if am.surface_get_primitive_type(i) != Mesh.PRIMITIVE_TRIANGLES:
			return ""
		if am.surface_get_format(i) & (Mesh.ARRAY_FORMAT_CUSTOM0 | Mesh.ARRAY_FORMAT_CUSTOM1 | Mesh.ARRAY_FORMAT_CUSTOM2 | Mesh.ARRAY_FORMAT_CUSTOM3):
			return ""
		var sd := RenderingServer.mesh_get_surface(am.get_rid(), i)
		if not (sd.get("lods", []) as Array).is_empty():
			return ""
		tris += int(sd.get("index_count", 0)) / 3
		k += "%d/%d/%d/%d|" % [int(sd.get("vertex_count", 0)), int(sd.get("index_count", 0)), hash(sd.get("index_data", PackedByteArray())), hash(sd.get("vertex_data", PackedByteArray()))]
	return k if tris >= MIN_TRIS else ""

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

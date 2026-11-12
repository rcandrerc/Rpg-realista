extends Node3D
# As mini vilas do mundo grande (história v2, Entrega 3; André 2026-11-11, esboço aprovado com o totem no meio de cada
# vila). Onde fica cada casa, a banca e os enfeites vem de mundo.json "vilasMundo" (shared/vilas.js arrumarVila, a mesma
# conta do servidor, que também faz as paredes e o telhado sólidos). Modelos em res://vilas3d/vilas.glb (CC0, Quaternius
# Medieval Village MegaKit e Fantasy Props MegaKit, montados por ferramentas/vilas/montar.mjs); a fogueira é a do
# cenário (res://cenario3d/fogueira.glb).
# Leve no celular (André: desempenho acima de tudo): nada é carregado enquanto o herói está longe de todas as vilas.
# Chegando a uns 260 m de uma, o modelo carrega em segundo plano e a vila nasce como MultiMesh (um por peça de modelo);
# passando de 330 m ela sai da cena. As casas aparecem até 170 m e os enfeites até 60 m.

var m # main.gd
const PERTO := 260.0 # monta a vila
const LONGE := 330.0 # tira a vila
const VE_CASA := 170.0
const VE_ENFEITE := 60.0
const ARQUIVO := "res://vilas3d/vilas.glb"
var vilas: Array = []
var montadas := {} # id da vila -> Node3D
var malhas := {} # nome do modelo -> [[Mesh, Transform3D], ...]
var _pedido := false
var _espera := 0.0

func _init(principal) -> void:
	m = principal

func _ready() -> void:
	vilas = m.mundo.get("vilasMundo", [])

func _process(dt: float) -> void:
	_espera -= dt
	if _espera > 0.0 or vilas.is_empty() or m.heroi == null:
		return
	_espera = 1.0
	var h: Vector3 = m.heroi.position
	var precisa := false
	for V in vilas:
		var d := Vector2(float(V.x) - h.x, float(V.z) - h.z).length()
		var id := str(V.id)
		if d < PERTO and not montadas.has(id):
			precisa = true
			if _carregado():
				_montar(V)
				return # uma vila por segundo: nada de travada
		elif d > LONGE and montadas.has(id):
			montadas[id].queue_free()
			montadas.erase(id)
	if precisa and not _pedido:
		_pedido = true
		ResourceLoader.load_threaded_request(ARQUIVO)

# o modelo das vilas já está na memória (pede em segundo plano e confere a cada segundo)
func _carregado() -> bool:
	if not malhas.is_empty():
		return true
	if not _pedido:
		return false
	var st := ResourceLoader.load_threaded_get_status(ARQUIVO)
	if st == ResourceLoader.THREAD_LOAD_IN_PROGRESS:
		return false
	if st != ResourceLoader.THREAD_LOAD_LOADED:
		push_warning("vilas: não carregou " + ARQUIVO)
		vilas = []
		return false
	var cena: PackedScene = ResourceLoader.load_threaded_get(ARQUIVO)
	var raiz: Node3D = cena.instantiate()
	add_child(raiz) # pintar precisa dele na cena
	m.pintar(raiz, false)
	for modelo in raiz.get_children():
		var l: Array = []
		for mi in modelo.find_children("*", "MeshInstance3D", true, false):
			if mi.mesh != null:
				l.append([mi.mesh, modelo.global_transform.affine_inverse() * mi.global_transform])
		malhas[str(modelo.name)] = l
	raiz.queue_free()
	var fog = load("res://cenario3d/fogueira.glb")
	if fog is PackedScene:
		var r2: Node3D = fog.instantiate()
		add_child(r2)
		m.pintar(r2, false)
		var l2: Array = []
		for mi in r2.find_children("*", "MeshInstance3D", true, false):
			if mi.mesh != null:
				l2.append([mi.mesh, r2.global_transform.affine_inverse() * mi.global_transform])
		malhas["fogueira"] = l2
		r2.queue_free()
	return true

func _montar(V: Dictionary) -> void:
	var no := Node3D.new()
	no.name = "Vila_" + str(V.id)
	add_child(no)
	montadas[str(V.id)] = no
	var grupos := {} # modelo -> [Transform3D]
	var casa := {}
	for c in V.get("casas", []):
		_por(grupos, str(c.m), c)
		casa[str(c.m)] = true
	if V.get("banca") is Dictionary:
		_por(grupos, "banca", V.banca)
		casa["banca"] = true
	for e in V.get("enfeites", []):
		_por(grupos, str(e.m), e)
	for nome in grupos:
		var ts: Array = grupos[nome]
		for par in malhas.get(nome, []):
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.mesh = par[0]
			mm.instance_count = ts.size()
			for j in ts.size():
				mm.set_instance_transform(j, ts[j] * par[1])
			var g := MultiMeshInstance3D.new()
			g.multimesh = mm
			var grande: bool = casa.has(nome)
			# só as casas fazem sombra (cada sombra é mais um desenho no celular)
			g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if grande else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			g.visibility_range_end = VE_CASA if grande else VE_ENFEITE
			g.visibility_range_end_margin = 8.0
			g.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
			no.add_child(g)

func _por(grupos: Dictionary, nome: String, p: Dictionary) -> void:
	if not grupos.has(nome):
		grupos[nome] = []
	grupos[nome].append(Transform3D(Basis(Vector3.UP, float(p.ry)), Vector3(float(p.x), float(p.y), float(p.z))))

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
# Aurora viva (André 2026-11-12, esboço aprovado): a cidade de pedra branca. As torres e os prédios grandes aparecem de
# mais longe; o vidro das janelas e lanternas, os cristais e a água da fonte acendem depois da Vesper (mundo.json
# vilasMundo[].cidade.acende, a mesma conta do servidor para a gente nova: nevoa.npc_apareceu). Praça e ruas de calçada
# branca são uma malha só, feita aqui com o material do calçamento (modelo aurora_chao).
const VE_LONGE := 320.0
const MODELOS_LONGE := ["aurora_torre", "aurora_paco", "aurora_templo", "aurora_pousada", "aurora_portao"]
var mats_aurora := {} # nome do material (Vidro_Aurora, Cristal_Aurora, Agua_Aurora) -> [StandardMaterial3D]
var aceso := -1 # -1 ainda não olhou, 0 apagada, 1 acesa
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
	var t0_parte := Time.get_ticks_usec()
	_process_parte(dt)
	if Time.get_ticks_usec() - t0_parte >= 1000 and Engine.has_meta("lentidao"): # quadro lento (lentidao.gd)
		Engine.get_meta("lentidao").ev("vilas_mundo", t0_parte)

func _process_parte(dt: float) -> void:
	_espera -= dt
	if _espera > 0.0 or vilas.is_empty() or m.heroi == null:
		return
	# atrás da capa da entrada (online.gd), confere a cada 0,1 s: a vila perto já nasce antes de o jogo aparecer
	_espera = 0.1 if m.online and m.online._cobrindo else 1.0
	_acender()
	var h: Vector3 = m.heroi.position
	var precisa := false
	for V in vilas:
		var d := Vector2(float(V.x) - h.x, float(V.z) - h.z).length()
		var id := str(V.id)
		if d < PERTO and not montadas.has(id):
			precisa = true
			var t0 := Time.get_ticks_usec()
			if _carregado():
				_montar(V)
				if m.lentidao:
					m.lentidao.ev("vila", t0)
				return # uma vila por segundo: nada de travada
		elif d > LONGE and montadas.has(id):
			montadas[id].queue_free()
			montadas.erase(id)
	if precisa and not _pedido:
		_pedido = true
		ResourceLoader.load_threaded_request(ARQUIVO)

# tem vila perto do herói que ainda não nasceu (a capa da entrada espera: main.gd montando)
func pendente() -> bool:
	if vilas.is_empty() or m.heroi == null:
		return false
	var h: Vector3 = m.heroi.position
	for V in vilas:
		if Vector2(float(V.x) - h.x, float(V.z) - h.z).length() < PERTO and not montadas.has(str(V.id)):
			return true
	return false

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
		for par in l: # os materiais que acendem (os mesmos em todas as peças da cidade)
			for i in par[0].get_surface_count():
				var mt = par[0].surface_get_material(i)
				if mt is StandardMaterial3D and mt.resource_name in ["Vidro_Aurora", "Cristal_Aurora", "Agua_Aurora"]:
					if not mats_aurora.has(mt.resource_name):
						mats_aurora[mt.resource_name] = []
					if not mats_aurora[mt.resource_name].has(mt):
						mats_aurora[mt.resource_name].append(mt)
	raiz.queue_free()
	aceso = -1 # pinta os materiais da cidade no estado certo já na primeira vez
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
			g.visibility_range_end = VE_LONGE if nome in MODELOS_LONGE else (VE_CASA if grande else VE_ENFEITE)
			g.visibility_range_end_margin = 8.0
			g.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
			no.add_child(g)
	if V.get("cidade") is Dictionary:
		_calcada(no, V.cidade)

# Praça das Luzes (disco) e ruas de pedra branca (faixas que seguem as estradas), um pouco acima do chão (o mesmo
# CALCADA de shared/vilas.js: o servidor tem o piso de andar na mesma altura). Textura no mundo: 2 m por ladrilho.
func _calcada(no: Node3D, C: Dictionary) -> void:
	var mat: Material = null
	for par in malhas.get("aurora_chao", []):
		mat = par[0].surface_get_material(0)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pt := func(p: Vector3) -> void:
		st.set_normal(Vector3.UP)
		st.set_uv(Vector2(p.x * 0.5, p.z * 0.5))
		st.add_vertex(p)
	var P: Dictionary = C.praca
	var c := Vector3(float(P.x), float(P.y) + float(C.sobePraca), float(P.z))
	var r := float(P.r)
	var n := 40
	for i in n:
		var a0 := TAU * i / n
		var a1 := TAU * (i + 1) / n
		pt.call(c)
		pt.call(c + Vector3(sin(a1), 0, cos(a1)) * r)
		pt.call(c + Vector3(sin(a0), 0, cos(a0)) * r)
	var meia := float(C.largura) / 2.0
	for L in C.ruas:
		var k: int = L.size()
		var esq: Array = []
		var dir: Array = []
		for i in k:
			var a: Array = L[maxi(i - 1, 0)]
			var b: Array = L[mini(i + 1, k - 1)]
			var t := Vector2(float(b[0]) - float(a[0]), float(b[1]) - float(a[1])).normalized() # direção da rua (dx, dz); cada ponto é [x, z, y]
			var q := Vector3(float(L[i][0]), float(L[i][2]) + float(C.sobe), float(L[i][1]))
			esq.append(q + Vector3(-t.y, 0, t.x) * meia)
			dir.append(q + Vector3(t.y, 0, -t.x) * meia)
		for i in k - 1:
			pt.call(esq[i]); pt.call(dir[i]); pt.call(dir[i + 1])
			pt.call(esq[i]); pt.call(dir[i + 1]); pt.call(esq[i + 1])
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	if mat != null:
		mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.visibility_range_end = VE_CASA
	no.add_child(mi)

# depois da Vesper (a missão "acende" da cidade): janelas, lanternas, cristais e a água da fonte com luz própria
func _acender() -> void:
	if mats_aurora.is_empty() or m.nevoa == null:
		return
	var acende := ""
	for V in vilas:
		if V.get("cidade") is Dictionary:
			acende = str(V.cidade.acende)
	var agora := 1 if acende != "" and m.nevoa.tem_conta() and not m.nevoa.H.is_empty() and m.nevoa.npc_apareceu(acende) else 0
	if agora == aceso:
		return
	aceso = agora
	var luz := agora == 1
	for mt in mats_aurora.get("Vidro_Aurora", []):
		mt.albedo_color = Color(1.0, 0.86, 0.58) if luz else Color(0.13, 0.15, 0.22)
		mt.emission_enabled = luz
		mt.emission = Color(1.0, 0.76, 0.4)
		mt.emission_energy_multiplier = 1.5
	for mt in mats_aurora.get("Cristal_Aurora", []):
		mt.albedo_color = Color(0.75, 0.95, 1.0) if luz else Color(0.5, 0.55, 0.68)
		mt.emission_enabled = luz
		mt.emission = Color(0.45, 0.85, 1.0)
		mt.emission_energy_multiplier = 2.0
	for mt in mats_aurora.get("Agua_Aurora", []):
		mt.albedo_color = Color(0.35, 0.66, 0.86) if luz else Color(0.2, 0.32, 0.42)
		mt.emission_enabled = luz
		mt.emission = Color(0.2, 0.5, 0.72)
		mt.emission_energy_multiplier = 0.6

func _por(grupos: Dictionary, nome: String, p: Dictionary) -> void:
	if not grupos.has(nome):
		grupos[nome] = []
	grupos[nome].append(Transform3D(Basis(Vector3.UP, float(p.ry)), Vector3(float(p.x), float(p.y), float(p.z))))

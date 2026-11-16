extends Node3D
# Árvores plantadas pelos jogadores (André 2026-11-16, entrega 3 do plantio; regras em shared/plantio.js). O servidor
# manda cada árvore uma vez, quando chego perto: [id, tipo, x, z, giro, escala, s até ficar adulta]; a que foi cortada
# inteira vem como [id]. Ela cresce aqui sozinha pelo relógio (muda, jovem, adulta). Muda e jovem não mostram o botão
# de cortar; a adulta entra na coleta como as outras árvores e cai do mesmo jeito (queda_arvore.gd).
# Modelos (André 2026-11-16 escolheu na foto lado a lado): Stylized Nature (Quaternius) em cenario3d/arv_<tipo>.glb, com a
# casca e a folha já pintadas (ferramentas/cenario/preparar.mjs). Sem o .glb, cai nas árvores da mata com a cor do tipo.

var m # main.gd
var arvores := {} # id -> {o (coletável do trabalho.gd), no: Node3D, partes: [MeshInstance3D], sc, ate (m.tempo), total, fase}
var _mats := {} # "copa_tipo" / "tronco_tipo" -> material
var _t := 0.0
const ESCALA_FASE := [0.2, 0.55, 1.0] # muda, jovem, adulta
const LONGE := 80.0 # m: como a mata
const TOCO_FICA := 9.0 # s do corte até o toco sumir (a queda leva ~5 s)
const ALTURA := {"betula": 7.5, "carvalho": 7.0, "pinheiro": 9.0, "macieira": 5.5, "cerejeira": 6.0, "antiga": 12.0} # m adulta
var _modelos := {} # tipo -> [{mesh, t}] (arv_<tipo>.glb, já na altura certa e com o pé no chão)
var _maca_mesh: Mesh
var _maca_mat: Material

func _init(principal) -> void:
	m = principal

# a foto do servidor (online.gd)
func atualizar(lista: Array) -> void:
	for v in lista:
		if not (v is Array) or v.is_empty():
			continue
		var id := str(v[0])
		if v.size() == 1:
			tirar(id)
		elif v.size() >= 7 and not arvores.has(id):
			botar(id, str(v[1]), float(v[2]), float(v[3]), float(v[4]), float(v[5]), float(v[6]))

func tipos() -> Dictionary:
	return m.P.dados.get("arvoresPlantio", {})

func botar(id: String, s: String, x: float, z: float, ry: float, sc: float, falta: float) -> void:
	var T: Dictionary = tipos().get(s, {})
	var v := int(T.get("v", 0))
	var y: float = m.terreno.altura(x, z)
	var no := Node3D.new()
	no.position = Vector3(x, y, z)
	no.rotation.y = ry
	add_child(no)
	var partes: Array = []
	var modelo := _modelo(s)
	for p in modelo:
		var mi := MeshInstance3D.new()
		mi.mesh = p.mesh
		mi.transform = Transform3D(Basis().scaled(Vector3.ONE * sc), Vector3.ZERO) * p.t
		mi.visibility_range_end = LONGE
		mi.visibility_range_end_margin = 6.0
		no.add_child(mi)
		partes.append(mi)
	if modelo.is_empty():
		for parte in ["tronco", "copa"]:
			var mesh: Mesh = m._malhas_mata.get("%s_%d" % [parte, v])
			if mesh == null:
				continue
			var mi := MeshInstance3D.new()
			mi.mesh = mesh
			mi.material_override = _material(parte, s, T, mesh)
			mi.visibility_range_end = LONGE
			mi.visibility_range_end_margin = 6.0
			mi.scale = Vector3.ONE * sc
			no.add_child(mi)
			partes.append(mi)
	var macas: Array = []
	if s == "macieira" and not modelo.is_empty():
		macas = _macas(no, id, sc)
		partes.append_array(macas)
	var o := {"id": id, "tipo": "arvore", "pos": Vector3(x, y, z), "r": 0.32 * sc, "cargas": -1, "volta_ate": -1.0, "plantada": true}
	var a := {"o": o, "no": no, "partes": partes, "sc": sc, "ate": m.tempo + falta, "total": max(1.0, float(T.get("h", 1)) * 3600.0), "fase": -1, "macas": macas}
	arvores[id] = a
	m.trabalho.registrar(o)
	m.trabalho.queda.registrar_partes(x, z, partes)
	_fase(a)

# muda e jovem: o botão de cortar não aparece (o coletável fica "esgotado" até a hora de ficar adulta)
func _fase(a: Dictionary) -> void:
	var falta: float = a.ate - m.tempo
	var f: float = 1.0 - falta / a.total
	var fase := 2 if falta <= 0.0 else (0 if f < 0.4 else 1)
	if fase == a.fase:
		return
	a.fase = fase
	a.no.scale = Vector3.ONE * ESCALA_FASE[fase]
	if not m.trabalho.queda.caida(a.o.id):
		for mc in a.get("macas", []):
			mc.visible = fase == 2 # maçã só na adulta
	if fase < 2:
		a.o.cargas = 0
		a.o.volta_ate = a.ate
	elif not m.trabalho.queda.caida(a.o.id):
		a.o.cargas = -1
		a.o.volta_ate = -1.0

# arv_<tipo>.glb: as malhas com a posição de cada uma, na altura de ALTURA e com o pé no chão (uma vez por tipo)
func _modelo(s: String) -> Array:
	if _modelos.has(s):
		return _modelos[s]
	var l: Array = []
	var arq := "res://cenario3d/arv_%s.glb" % s
	if ResourceLoader.exists(arq):
		var cena: Node3D = (load(arq) as PackedScene).instantiate()
		var caixa := AABB()
		var primeiro := true
		for mi in cena.find_children("*", "MeshInstance3D", true, false):
			var t := Transform3D()
			var q: Node = mi
			while q != cena and q != null:
				t = (q as Node3D).transform * t
				q = q.get_parent()
			var b: AABB = t * (mi as MeshInstance3D).get_aabb()
			caixa = b if primeiro else caixa.merge(b)
			primeiro = false
			l.append({"mesh": (mi as MeshInstance3D).mesh, "t": t})
		cena.free()
		if not l.is_empty() and caixa.size.y > 0.01:
			var k: float = float(ALTURA.get(s, 7.0)) / caixa.size.y
			var ajuste := Transform3D(Basis().scaled(Vector3.ONE * k), Vector3(0, -caixa.position.y * k, 0))
			for p in l:
				p.t = ajuste * p.t
			_modelos[s + "_caixa"] = Vector3(max(caixa.size.x, caixa.size.z) * k, caixa.size.y * k, 0)
	_modelos[s] = l
	return l

# maçãs vermelhas na copa da macieira (o sorteio sai do id: todo mundo vê igual)
func _macas(no: Node3D, id: String, sc: float) -> Array:
	if _maca_mesh == null:
		var esf := SphereMesh.new()
		esf.radius = 0.14
		esf.height = 0.28
		esf.radial_segments = 8
		esf.rings = 4
		_maca_mesh = esf
		var mt := StandardMaterial3D.new()
		mt.albedo_color = Color("c8261e")
		mt.roughness = 0.45
		mt.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
		_maca_mat = mt
	var cx: Vector3 = _modelos.get("macieira_caixa", Vector3(4, 5.5, 0))
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(id)
	var l: Array = []
	for i in 14:
		var ang := rng.randf() * TAU
		var y := cx.y * rng.randf_range(0.5, 0.85) * sc
		var r := cx.x * 0.36 * rng.randf_range(0.75, 1.0) * sc
		var mi := MeshInstance3D.new()
		mi.mesh = _maca_mesh
		mi.material_override = _maca_mat
		mi.position = Vector3(cos(ang) * r, y, sin(ang) * r)
		mi.visibility_range_end = 60.0
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		no.add_child(mi)
		l.append(mi)
	return l

func _material(parte: String, s: String, T: Dictionary, mesh: Mesh) -> Material:
	var k := parte + "_" + s
	if not _mats.has(k):
		var base = mesh.surface_get_material(0)
		var chave := "copa" if parte == "copa" else "tronco"
		var cor: Color = Color(str(T[chave])) if T.has(chave) else Color.WHITE
		if base is BaseMaterial3D:
			var mt: BaseMaterial3D = base.duplicate()
			mt.vertex_color_use_as_albedo = false
			mt.albedo_color = mt.albedo_color * cor
			_mats[k] = mt
		else:
			_mats[k] = base
	return _mats[k]

# cortada (o servidor manda [id]): cai como as outras, o toco fica uns segundos e some (André 2026-11-16: "não é
# simplesmente sumir"). Se o [id] chegou antes do evento da queda, ela cai aqui mesmo.
func tirar(id: String) -> void:
	var a = arvores.get(id)
	if a == null:
		return
	arvores.erase(id)
	var q = m.trabalho.queda
	if not q.caida(id):
		q.derrubar(a.o, null, true)
	a.o.cargas = 0 # sem botão de cortar enquanto o toco está lá
	a.o.volta_ate = m.tempo + 1e9
	get_tree().create_timer(TOCO_FICA).timeout.connect(_sumir.bind(a))

func _sumir(a: Dictionary) -> void:
	m.trabalho.esquecer(a.o)
	m.trabalho.queda.tirar(a.o.id, a.o.pos.x, a.o.pos.z, a.partes)
	a.no.queue_free()

# muda vira jovem e jovem vira adulta: confere de 2 em 2 s
func _process(dt: float) -> void:
	_t -= dt
	if _t > 0.0:
		return
	_t = 2.0
	for a in arvores.values():
		if a.fase < 2:
			_fase(a)

# plantou (evento do servidor): terra mexida e o som da mão na terra
func plantou(ev: Dictionary) -> void:
	var x := float(ev.get("x", 0.0))
	var z := float(ev.get("z", 0.0))
	m.fx.poeira(x, z, 0.6, 6, "7a5c3e", "a88a62")
	m.sons.tocar("pano", -6.0, 0.05, Vector3(x, m.terreno.altura(x, z), z))

# botão Plantar da mochila (semente de árvore): planta no quadrado livre mais perto do herói (o servidor escolhe)
func plantar(s: String) -> void:
	if not m.on():
		m.hud.aviso("Plantar árvore só funciona online")
		return
	if m.heroi == null:
		return
	m.rede("plantarArvore", {"s": s, "x": m.heroi.position.x, "z": m.heroi.position.z})

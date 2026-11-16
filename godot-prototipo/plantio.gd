extends Node3D
# Árvores plantadas pelos jogadores (André 2026-11-16, entrega 3 do plantio; regras em shared/plantio.js). O servidor
# manda cada árvore uma vez, quando chego perto: [id, tipo, x, z, giro, escala, s até ficar adulta]; a que foi cortada
# inteira vem como [id]. Ela cresce aqui sozinha pelo relógio (muda, jovem, adulta). Muda e jovem não mostram o botão
# de cortar; a adulta entra na coleta como as outras árvores e cai do mesmo jeito (queda_arvore.gd).
# Modelo provisório: as 3 árvores da mata, com a cor de copa de cada tipo, até o André escolher os novos na foto.

var m # main.gd
var arvores := {} # id -> {o (coletável do trabalho.gd), no: Node3D, partes: [MeshInstance3D], sc, ate (m.tempo), total, fase}
var _mats := {} # "copa_tipo" / "tronco_tipo" -> material
var _t := 0.0
const ESCALA_FASE := [0.2, 0.55, 1.0] # muda, jovem, adulta
const LONGE := 80.0 # m: como a mata

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
	var o := {"id": id, "tipo": "arvore", "pos": Vector3(x, y, z), "r": 0.32 * sc, "cargas": -1, "volta_ate": -1.0, "plantada": true}
	var a := {"o": o, "no": no, "partes": partes, "sc": sc, "ate": m.tempo + falta, "total": max(1.0, float(T.get("h", 1)) * 3600.0), "fase": -1}
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
	if fase < 2:
		a.o.cargas = 0
		a.o.volta_ate = a.ate
	elif not m.trabalho.queda.caida(a.o.id):
		a.o.cargas = -1
		a.o.volta_ate = -1.0

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

func tirar(id: String) -> void:
	var a = arvores.get(id)
	if a == null:
		return
	arvores.erase(id)
	m.trabalho.esquecer(a.o)
	m.trabalho.queda.tirar(id, a.o.pos.x, a.o.pos.z)
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

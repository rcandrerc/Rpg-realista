extends Node3D
# Árvore cortada (André 2026-11-04): na última machadada ela estala, tomba de repente para longe de quem cortou,
# bate no chão (poeira, folhas e tranco), fica um instante deitada e some. No lugar fica o toco (o tronco continua
# ocupando o chão, como no servidor). Quando o tempo de voltar acaba (COLETA.arvore.volta), o toco some e a árvore
# cresce de novo. É de todos: o servidor manda o evento "veio" com cargas 0 e a direção da queda (shared/simulacao.js).
# Serve para as árvores da mata (m0..., MultiMesh do main.gd) e para as da vila e do campo de fora (a0..., malhas soltas
# do vila.glb, uma cópia por árvore).

var m # main.gd
var _vila := {} # Vector2i(x*10, z*10) -> [MeshInstance3D] (tronco e copa de cada árvore a0... do vila.glb)
var _caidas := {} # id -> {toco: Node3D, queda: Node3D ou null, partes_vila: [[mi, escala]]}
var _mat_toco: StandardMaterial3D
var _mat_corte: StandardMaterial3D

const LONGE := 70.0 # m: mais longe que isso da câmera ela some sem a animação (ninguém vê)
const TOMBA := 0.85 # s caindo (acelera, como uma árvore de verdade)
const DEITADA := 1.4 # s no chão antes de sumir
const SOME := 0.7 # s apagando

func _init(principal) -> void:
	m = principal

func _ready() -> void:
	if m.vila_no == null:
		return
	var quer := {}
	for c in m.mundo.get("coletaveis", []):
		if str(c.tipo) == "arvore" and str(c.id).begins_with("a"):
			quer[_chave(float(c.x), float(c.z))] = true
	for mi in m.vila_no.find_children("*", "MeshInstance3D", true, false):
		var o: Vector3 = mi.global_transform.origin
		if abs(o.y) > 0.05:
			continue
		var k := _chave(o.x, o.z)
		if quer.has(k):
			if not _vila.has(k):
				_vila[k] = []
			_vila[k].append(mi)

func _chave(x: float, z: float) -> Vector2i:
	return Vector2i(roundi(x * 10.0), roundi(z * 10.0))

func caida(id: String) -> bool:
	return _caidas.has(id)

# o: coletável (trabalho.gd). dir: ângulo para onde tomba (null: sorteia). animar: false = já estava no chão (quem entrou depois)
func derrubar(o: Dictionary, dir, animar: bool) -> void:
	if _caidas.has(o.id):
		return
	var pos: Vector3 = o.pos
	var partes := _partes(o)
	var info := {"toco": _toco(o), "queda": null, "partes_vila": []}
	_caidas[o.id] = info
	if partes.is_empty():
		return
	# esconde a árvore de verdade (a cópia que cai é solta)
	if str(o.id).begins_with("m"):
		var p2 := Vector2(pos.x, pos.z)
		var c: Dictionary = m.arvores_mata[p2]
		c.caida = true
		if m._sumindo.has(p2): # estava apagada porque tapava a câmera: a cópia apagando sai
			m._sumindo[p2].no.queue_free()
			m._sumindo.erase(p2)
		for parte in ["tronco", "copa"]:
			if c.has(parte):
				c[parte][0].set_instance_transform(c[parte][1], Transform3D(Basis().scaled(Vector3.ZERO), c.t.origin))
	else:
		for mi in _vila.get(_chave(pos.x, pos.z), []):
			info.partes_vila.append([mi, mi.scale])
			mi.visible = false
	if not animar or m.camera == null or m.camera.global_position.distance_to(pos) > LONGE:
		return
	var ang: float = float(dir) if dir != null else float(hash(o.id) % 628) / 100.0
	var d := Vector3(sin(ang), 0, cos(ang))
	var eixo := Vector3.UP.cross(d).normalized() # girar em volta dele leva o topo da árvore para d
	var piv := Node3D.new()
	piv.position = Vector3(pos.x, 0, pos.z) # na mesma altura da árvore de verdade (o vila.glb e a mata ficam no 0)
	add_child(piv)
	info.queda = piv
	var mats: Array = []
	for p in partes:
		var mi := MeshInstance3D.new()
		mi.mesh = p.mesh
		mi.transform = p.t
		var mt: BaseMaterial3D = (p.mat as BaseMaterial3D).duplicate() if p.mat is BaseMaterial3D else null
		if mt != null:
			mt.distance_fade_mode = BaseMaterial3D.DISTANCE_FADE_DISABLED
			if p.has("cor"):
				mt.albedo_color = mt.albedo_color * p.cor
			mt.set_meta("alfa", mt.albedo_color.a)
			mi.material_override = mt
			mats.append(mt)
		elif p.mat != null:
			mi.material_override = p.mat
		piv.add_child(mi)
	var alto: float = 7.0 * float(o.r) / 0.32 # ~7 m de árvore por escala 1 (raio do tronco 0,32)
	m.sons.tocar("lenha", -1.0, 0.05, pos, 0.6) # o estalo grave do tronco quebrando
	var tw := create_tween()
	var gira := _girar.bind(piv, eixo)
	# estala e balança um pouco para trás, depois tomba acelerando
	tw.tween_method(gira, 0.0, deg_to_rad(-3.0), 0.12).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tw.tween_method(gira, deg_to_rad(-3.0), deg_to_rad(88.0), TOMBA).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_IN)
	tw.tween_callback(_bateu.bind(pos, d, alto))
	# quica de leve e assenta
	tw.tween_method(gira, deg_to_rad(88.0), deg_to_rad(81.0), 0.12).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_method(gira, deg_to_rad(81.0), deg_to_rad(89.0), 0.16).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tw.tween_interval(DEITADA)
	tw.tween_callback(_transparente.bind(mats))
	tw.tween_method(_apagar.bind(piv, mats), 0.0, 1.0, SOME)
	tw.tween_callback(_sumiu.bind(info, piv))

func _girar(a: float, piv: Node3D, eixo: Vector3) -> void:
	piv.basis = Basis(eixo, a)

func _transparente(mats: Array) -> void:
	for mt in mats:
		mt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_DEPTH_PRE_PASS

func _apagar(k: float, piv: Node3D, mats: Array) -> void:
	for mt in mats:
		mt.albedo_color.a = (1.0 - k) * float(mt.get_meta("alfa", 1.0))
	piv.position.y = -k * 0.3 # afunda um pouco enquanto some

func _sumiu(info: Dictionary, piv: Node3D) -> void:
	piv.queue_free()
	if info.queda == piv:
		info.queda = null

# a copa bateu no chão: poeira ao longo do tronco, folhas voando, baque e tranco (mais forte perto)
func _bateu(pos: Vector3, d: Vector3, alto: float) -> void:
	var fim := pos + d * alto * 0.75
	m.sons.tocar("pouso_forte", -2.0, 0.05, fim, 0.55)
	m.sons.tocar("lenha", -5.0, 0.1, fim, 0.75)
	for i in 4:
		var p := pos + d * alto * (0.2 + 0.22 * i)
		m.fx.poeira(p.x, p.z, 0.9, 7, "8a7a60", "c8b48e")
	m.fx.surto(fim.x, m.terreno.altura(fim.x, fim.z) + 0.8, fim.z, 22, "9ec46a", "4f7a2c", 4.0, 0.08) # folhas
	if m.heroi != null:
		var dist: float = m.heroi.position.distance_to(fim)
		if dist < 14.0:
			m.cam.tremer(0.22 * (1.0 - dist / 14.0))

# acabou o tempo: o toco some e a árvore cresce de novo
func levantar(o: Dictionary) -> void:
	var info = _caidas.get(o.id)
	if info == null:
		return
	_caidas.erase(o.id)
	if info.queda != null and is_instance_valid(info.queda):
		info.queda.queue_free()
	var toco: Node3D = info.toco
	var tt := create_tween()
	tt.tween_property(toco, "scale", Vector3(1, 0.05, 1), 0.35).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tt.tween_callback(toco.queue_free)
	var pos: Vector3 = o.pos
	if str(o.id).begins_with("m"):
		var c: Dictionary = m.arvores_mata[Vector2(pos.x, pos.z)]
		var tw := create_tween()
		tw.tween_method(_crescer_mata.bind(c), 0.05, 1.0, 0.9).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		tw.tween_callback(_cresceu_mata.bind(c))
	else:
		for par in info.partes_vila:
			var mi: MeshInstance3D = par[0]
			if not is_instance_valid(mi):
				continue
			mi.visible = true
			mi.scale = par[1] * 0.05
			mi.create_tween().tween_property(mi, "scale", par[1], 0.9).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if m.camera != null and m.camera.global_position.distance_to(pos) < LONGE:
		m.fx.surto(pos.x, pos.y + 1.2, pos.z, 14, "b8e07a", "5e8f34", 2.5, 0.07)

func _crescer_mata(k: float, c: Dictionary) -> void:
	for parte in ["tronco", "copa"]:
		if c.has(parte):
			c[parte][0].set_instance_transform(c[parte][1], Transform3D(c.t.basis.scaled(Vector3.ONE * k), c.t.origin))

func _cresceu_mata(c: Dictionary) -> void:
	_crescer_mata(1.0, c)
	c.caida = false # o apagar quando tapa a câmera volta a valer

# o que desenha a árvore (malha, lugar em relação à base, material): a cópia que cai
func _partes(o: Dictionary) -> Array:
	var l: Array = []
	var pos: Vector3 = o.pos
	if str(o.id).begins_with("m"):
		var c = m.arvores_mata.get(Vector2(pos.x, pos.z))
		if c == null:
			return l
		var t := Transform3D(c.t.basis, Vector3.ZERO)
		for parte in ["tronco", "copa"]:
			if not c.has(parte):
				continue
			var mesh: Mesh = m._malhas_mata.get("%s_%d" % [parte, c.v])
			if mesh == null:
				continue
			var p := {"mesh": mesh, "t": t, "mat": mesh.surface_get_material(0)}
			if parte == "copa":
				p.cor = c.copa[2]
			l.append(p)
	else:
		var base := Vector3(pos.x, 0, pos.z)
		for mi in _vila.get(_chave(pos.x, pos.z), []):
			var gt: Transform3D = mi.global_transform
			gt.origin -= base
			var mat = mi.material_override if mi.material_override != null else mi.mesh.surface_get_material(0)
			l.append({"mesh": mi.mesh, "t": gt, "mat": mat})
	return l

# toco: casca por fora, madeira clara no corte (o tronco continua ocupando o chão)
func _toco(o: Dictionary) -> Node3D:
	if _mat_toco == null:
		_mat_toco = StandardMaterial3D.new()
		_mat_toco.albedo_color = Color("6b4e36")
		_mat_toco.roughness = 0.95
		_mat_toco.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
		_mat_corte = StandardMaterial3D.new()
		_mat_corte.albedo_color = Color("d9b98a")
		_mat_corte.roughness = 0.9
		_mat_corte.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	var s: float = float(o.r) / 0.32
	var pos: Vector3 = o.pos
	var raiz := Node3D.new()
	raiz.position = Vector3(pos.x, m.terreno.altura(pos.x, pos.z), pos.z)
	raiz.rotation.y = float(hash(o.id) % 628) / 100.0
	add_child(raiz)
	var alto := 0.42 * s
	var casca := CylinderMesh.new()
	casca.top_radius = 0.24 * s
	casca.bottom_radius = 0.33 * s
	casca.height = alto
	casca.radial_segments = 10
	casca.rings = 1
	casca.cap_top = false
	var mc := MeshInstance3D.new()
	mc.mesh = casca
	mc.material_override = _mat_toco
	mc.position.y = alto * 0.5 - 0.05
	raiz.add_child(mc)
	# o corte, um pouco inclinado (machadada de lado)
	var corte := CylinderMesh.new()
	corte.top_radius = 0.235 * s
	corte.bottom_radius = 0.235 * s
	corte.height = 0.03
	corte.radial_segments = 10
	corte.rings = 1
	var mt := MeshInstance3D.new()
	mt.mesh = corte
	mt.material_override = _mat_corte
	mt.position.y = alto - 0.05
	mt.rotation.x = deg_to_rad(6.0)
	raiz.add_child(mt)
	# três raízes saindo do pé
	for i in 3:
		var r := CylinderMesh.new()
		r.top_radius = 0.03 * s
		r.bottom_radius = 0.09 * s
		r.height = 0.45 * s
		r.radial_segments = 6
		r.rings = 1
		var mr := MeshInstance3D.new()
		mr.mesh = r
		mr.material_override = _mat_toco
		var a := i * TAU / 3.0 + 0.4
		mr.position = Vector3(cos(a) * 0.3 * s, 0.03, sin(a) * 0.3 * s)
		mr.rotation = Vector3(0, -a, deg_to_rad(-110.0)) # grossa no pé do toco, fina entrando no chão
		raiz.add_child(mr)
	return raiz

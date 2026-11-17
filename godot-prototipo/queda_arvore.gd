extends Node3D
# Árvore cortada (André 2026-11-04): na última machadada ela estala, tomba de repente para longe de quem cortou,
# bate no chão (poeira, folhas e tranco), fica um instante deitada e some. No lugar fica o toco (o tronco continua
# ocupando o chão, como no servidor). Quando o tempo de voltar acaba (COLETA.arvore.volta), o toco some e a árvore
# cresce de novo. É de todos: o servidor manda o evento "veio" com cargas 0 e a direção da queda (shared/simulacao.js).
# Serve para as árvores da mata (m0..., MultiMesh do main.gd) e para as da vila e do campo de fora (a0..., malhas soltas
# do vila.glb, uma cópia por árvore).

var m # main.gd
var _vila := {} # Vector2i(x*100, z*100) -> [MeshInstance3D] (tronco e copa de cada árvore a0... do vila.glb)
var _caidas := {} # id -> {toco: Node3D, queda: Node3D ou null, partes_vila: [[mi, escala]]}
var _mat_toco: StandardMaterial3D
var _mat_corte: StandardMaterial3D

const LONGE := 70.0 # m: mais longe que isso da câmera ela some sem a animação (ninguém vê)
const CEDE := 0.7 # s rangendo e começando a inclinar, antes de desabar (André 2026-11-05: caía rápido, "parecia um galinho")
const TOMBA := 2.0 # s desabando: começa devagar e vai acelerando até bater no chão (como uma árvore de verdade)
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

# árvore plantada (plantio.gd, André 2026-11-16): as malhas dela caem como as da vila (a cópia tomba, o toco fica)
func registrar_partes(x: float, z: float, partes: Array) -> void:
	_vila[_chave(x, z)] = partes

# a árvore plantada saiu do servidor (cortada inteira): o toco afunda e some, e o lugar fica livre
func tirar(id: String, x: float, z: float, partes = null) -> void:
	var k := _chave(x, z)
	var atual = _vila.get(k)
	if partes == null or (atual is Array and atual == partes): # outra já plantada no mesmo lugar fica
		_vila.erase(k)
	var info = _caidas.get(id)
	if info == null:
		return
	_caidas.erase(id)
	var toco: Node3D = info.toco
	if is_instance_valid(toco):
		var tt := create_tween()
		tt.tween_property(toco, "scale", Vector3(1, 0.05, 1), 0.6).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
		tt.tween_callback(toco.queue_free)

# em centímetros. André 2026-11-16 ("fica o toquinho e o resto dela em cima"): em décimos, 7 das 87 árvores da vila
# (a4, a18, a25, a27, a61, a65, a79) caíam bem na metade (ex.: x,x5) e o arredondamento do vila.glb (float32) ia para um
# lado e o do mundo.json para o outro: a árvore não era achada, o toco nascia e ela ficava em pé por cima.
func _chave(x: float, z: float) -> Vector2i:
	return Vector2i(roundi(x * 100.0), roundi(z * 100.0))

func caida(id: String) -> bool:
	return _caidas.has(id)

# o: coletável (trabalho.gd). dir: ângulo para onde tomba (null: sorteia). animar: false = já estava no chão (quem entrou depois)
func derrubar(o: Dictionary, dir, animar: bool) -> void:
	if _caidas.has(o.id):
		return
	var pos: Vector3 = o.pos
	var partes := _partes(o)
	var info := {"toco": _toco(o, partes), "queda": null, "partes_vila": []}
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
		for parte in ["tronco", "copa", "longe"]: # "longe": a copa simples de quem olha de longe ou do alto (relevo.gd)
			if c.has(parte):
				c[parte][0].set_instance_transform(c[parte][1], Transform3D(Basis().scaled(Vector3.ZERO), c.t.origin))
		if m.leve: # a sombra pintada (Sombras "Leves") some junto
			m.leve.crescer(c, 0.0)
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
	# na mesma altura da árvore de verdade. André 2026-11-16 ("a animação da árvore caindo sumiu"): a mata agora fica
	# no relevo (y do mundo.json), e a cópia que cai nascia no 0, enterrada morro abaixo; ninguém via a queda.
	var chao_y := 0.0
	if str(o.id).begins_with("m"):
		chao_y = (m.arvores_mata[Vector2(pos.x, pos.z)].t as Transform3D).origin.y
	# André 2026-11-17 ("cai a árvore inteira, a raiz inteira, e fica o toco por cima"): cai só o que está acima do
	# corte, e gira em volta do corte (em cima do toco), não do pé da árvore
	var corte := _altura_corte(partes)
	piv.position = Vector3(pos.x, chao_y + corte, pos.z)
	piv.set_meta("y0", piv.position.y)
	add_child(piv)
	info.queda = piv
	var mats: Array = []
	_mats_toco()
	for p in partes:
		var f := _fatia(p, true)
		if f.mesh == null:
			continue
		var mi := MeshInstance3D.new()
		mi.mesh = f.mesh
		mi.transform = Transform3D(Basis(), Vector3(0, -corte, 0)) * p.t
		# um material por superfície (modelo com casca e folha separadas: árvores plantadas); -1 = o corte (madeira)
		for j in f.mapa.size():
			var orig: int = f.mapa[j]
			var base = _mat_corte if orig < 0 else (p.mats[orig] if p.has("mats") else p.mat)
			var ms = _mat_queda(base, null if orig < 0 else p.get("cor"), mats)
			if ms != null:
				mi.set_surface_override_material(j, ms)
		piv.add_child(mi)
	var alto: float = 7.0 * float(o.r) / 0.32 # ~7 m de árvore por escala 1 (raio do tronco 0,32)
	# som (Pixabay, André 2026-11-07): um só, já com o rangido, o estalo grande (~0,5 s), os galhos quebrando na queda
	# e o baque (~2,7 s, quando a copa bate no chão). Os estalos Kenney de antes ficam guardados (arvore_estalo).
	m.sons.tocar("arvore_range", 0.0, 0.02, pos)
	var tw := create_tween()
	var gira := _girar.bind(piv, eixo)
	# cede: inclina devagar uns 5 graus, tremendo um pouco (o tronco ainda segura)
	tw.tween_method(_ceder.bind(piv, eixo), 0.0, 1.0, CEDE)
	# desaba: o ângulo cresce com o cubo do tempo (quase parada no começo, rápida no fim)
	tw.tween_method(_desabar.bind(piv, eixo), 0.0, 1.0, TOMBA)
	tw.tween_callback(_bateu.bind(pos, d, alto))
	# quica com o peso e assenta
	tw.tween_method(gira, deg_to_rad(88.0), deg_to_rad(83.0), 0.18).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_OUT)
	tw.tween_method(gira, deg_to_rad(83.0), deg_to_rad(89.0), 0.24).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	tw.tween_interval(DEITADA)
	tw.tween_callback(_transparente.bind(mats))
	tw.tween_method(_apagar.bind(piv, mats), 0.0, 1.0, SOME)
	tw.tween_callback(_sumiu.bind(info, piv))

# cópia do material para a árvore que cai (apaga no fim): sem sumir pela distância, com a cor da copa
func _mat_queda(mat, cor, mats: Array):
	if not (mat is BaseMaterial3D):
		return mat
	var mt: BaseMaterial3D = (mat as BaseMaterial3D).duplicate()
	mt.distance_fade_mode = BaseMaterial3D.DISTANCE_FADE_DISABLED
	if cor != null:
		mt.albedo_color = mt.albedo_color * cor
	mt.set_meta("alfa", mt.albedo_color.a)
	mats.append(mt)
	return mt

func _girar(a: float, piv: Node3D, eixo: Vector3) -> void:
	piv.basis = Basis(eixo, a)

const CEDE_ANG := 5.0 # graus inclinados antes de desabar
func _ceder(k: float, piv: Node3D, eixo: Vector3) -> void:
	var a := CEDE_ANG * (1.0 - cos(k * PI)) * 0.5 + sin(k * 40.0) * 0.35 * (1.0 - k) # treme e vai inclinando
	piv.basis = Basis(eixo, deg_to_rad(a))

func _desabar(k: float, piv: Node3D, eixo: Vector3) -> void:
	piv.basis = Basis(eixo, deg_to_rad(CEDE_ANG + (88.0 - CEDE_ANG) * k * k * k))

func _transparente(mats: Array) -> void:
	for mt in mats:
		mt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_DEPTH_PRE_PASS

func _apagar(k: float, piv: Node3D, mats: Array) -> void:
	for mt in mats:
		mt.albedo_color.a = (1.0 - k) * float(mt.get_meta("alfa", 1.0))
	piv.position.y = float(piv.get_meta("y0", 0.0)) - k * 0.3 # afunda um pouco enquanto some (do lugar dela: no relevo)

func _sumiu(info: Dictionary, piv: Node3D) -> void:
	piv.queue_free()
	if info.queda == piv:
		info.queda = null

# a copa bateu no chão: poeira ao longo do tronco, folhas voando, baque e tranco (mais forte perto)
func _bateu(pos: Vector3, d: Vector3, alto: float) -> void:
	var fim := pos + d * alto * 0.75
	m.sons.tocar("arvore_queda", -5.0, 0.05, fim) # mais baixo: o som da queda já traz o baque, este só dá peso
	m.sons.tocar("pouso_forte", -4.0, 0.05, fim, 0.5)
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
			if not is_instance_valid(par[0]): # (Godot 4.7) olhar antes de pôr na variável com tipo
				continue
			var mi: MeshInstance3D = par[0]
			mi.visible = true
			mi.scale = par[1] * 0.05
			mi.create_tween().tween_property(mi, "scale", par[1], 0.9).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	if m.camera != null and m.camera.global_position.distance_to(pos) < LONGE:
		m.fx.surto(pos.x, pos.y + 1.2, pos.z, 14, "b8e07a", "5e8f34", 2.5, 0.07)

func _crescer_mata(k: float, c: Dictionary) -> void:
	for parte in ["tronco", "copa", "longe"]:
		if c.has(parte):
			c[parte][0].set_instance_transform(c[parte][1], Transform3D(c.t.basis.scaled(Vector3.ONE * k), c.t.origin))
	if m.leve:
		m.leve.crescer(c, k)

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
			if mi.material_override == null and mi.mesh.get_surface_count() > 1:
				var ms: Array = []
				for i in mi.mesh.get_surface_count():
					ms.append(mi.get_active_material(i))
				l.append({"mesh": mi.mesh, "t": gt, "mats": ms})
				continue
			var mat = mi.material_override if mi.material_override != null else mi.mesh.surface_get_material(0)
			l.append({"mesh": mi.mesh, "t": gt, "mat": mat})
	return l

# Tocos (André 2026-11-16, árvores que voltam em 24 h): agora ficam muitos no mundo ao mesmo tempo. As malhas são
# feitas uma vez por tamanho e repartidas por todos os tocos (antes cada toco fazia as suas 5), e o toco longe não é
# desenhado (TOCO_LONGE).
const TOCO_LONGE := 60.0 # m
var _malhas_tocos := {} # tamanho (x10) -> [casca, corte, raiz]
func _malhas_do_toco(s: float) -> Array:
	var k := roundi(s * 10.0)
	if _malhas_tocos.has(k):
		return _malhas_tocos[k]
	s = k / 10.0
	var casca := CylinderMesh.new()
	casca.top_radius = 0.24 * s
	casca.bottom_radius = 0.33 * s
	casca.height = 0.42 * s
	casca.radial_segments = 10
	casca.rings = 1
	casca.cap_top = false
	var corte := CylinderMesh.new()
	corte.top_radius = 0.235 * s
	corte.bottom_radius = 0.235 * s
	corte.height = 0.03
	corte.radial_segments = 10
	corte.rings = 1
	var r := CylinderMesh.new()
	r.top_radius = 0.03 * s
	r.bottom_radius = 0.09 * s
	r.height = 0.45 * s
	r.radial_segments = 6
	r.rings = 1
	_malhas_tocos[k] = [casca, corte, r]
	return _malhas_tocos[k]

func _peca_toco(mesh: Mesh, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.visibility_range_end = TOCO_LONGE
	mi.visibility_range_end_margin = 4.0
	return mi

# Toco feito do próprio tronco (André 2026-11-17: "corto uma árvore branca e nasce um toco marrom"): o pé da malha
# da árvore, cortado na altura CORTE_Y, com a mesma casca e cor, e o corte em madeira clara por cima. A parte de cima
# (a que cai) é o resto da mesma malha (_fatia). As duas metades são feitas uma vez por malha e repartidas.
func _toco(o: Dictionary, partes: Array = []) -> Node3D:
	_mats_toco()
	var pos: Vector3 = o.pos
	var raiz: Node3D = null
	for p in partes:
		var f := _fatia(p, false)
		if f.mesh == null:
			continue
		if raiz == null:
			raiz = Node3D.new()
			var chao_y := 0.0
			if str(o.id).begins_with("m"):
				chao_y = (m.arvores_mata[Vector2(pos.x, pos.z)].t as Transform3D).origin.y
			raiz.position = Vector3(pos.x, chao_y, pos.z)
			add_child(raiz)
		var mi := MeshInstance3D.new()
		mi.mesh = f.mesh
		mi.transform = p.t
		mi.visibility_range_end = TOCO_LONGE
		mi.visibility_range_end_margin = 4.0
		for j in f.mapa.size():
			var orig: int = f.mapa[j]
			if orig >= 0:
				var mt = p.mats[orig] if p.has("mats") else p.mat
				if mt != null:
					mi.set_surface_override_material(j, mt)
		raiz.add_child(mi)
	if raiz != null:
		return raiz
	return _toco_simples(o)

func _mats_toco() -> void:
	if _mat_toco == null:
		_mat_toco = StandardMaterial3D.new()
		_mat_toco.albedo_color = Color("6b4e36")
		_mat_toco.roughness = 0.95
		_mat_toco.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
		_mat_corte = StandardMaterial3D.new()
		_mat_corte.albedo_color = Color("d9b98a")
		_mat_corte.roughness = 0.9
		_mat_corte.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
		_mat_corte.cull_mode = BaseMaterial3D.CULL_DISABLED

# o toco de antes (cilindro marrom com raízes): só quando a árvore não tem malha para cortar
func _toco_simples(o: Dictionary) -> Node3D:
	_mats_toco()
	var s: float = float(o.r) / 0.32
	var pos: Vector3 = o.pos
	var raiz := Node3D.new()
	raiz.position = Vector3(pos.x, m.terreno.altura(pos.x, pos.z), pos.z)
	raiz.rotation.y = float(hash(o.id) % 628) / 100.0
	add_child(raiz)
	var alto := 0.42 * s
	var ms: Array = _malhas_do_toco(s)
	var mc := _peca_toco(ms[0], _mat_toco)
	mc.position.y = alto * 0.5 - 0.05
	raiz.add_child(mc)
	# o corte, um pouco inclinado (machadada de lado)
	var mt := _peca_toco(ms[1], _mat_corte)
	mt.position.y = alto - 0.05
	mt.rotation.x = deg_to_rad(6.0)
	raiz.add_child(mt)
	# três raízes saindo do pé
	for i in 3:
		var mr := _peca_toco(ms[2], _mat_toco)
		var a := i * TAU / 3.0 + 0.4
		mr.position = Vector3(cos(a) * 0.3 * s, 0.03, sin(a) * 0.3 * s)
		mr.rotation = Vector3(0, -a, deg_to_rad(-110.0)) # grossa no pé do toco, fina entrando no chão
		raiz.add_child(mr)
	return raiz

# ---------- corte da malha (toco embaixo, o resto cai) ----------
const CORTE_Y := 0.42 # altura do corte no espaço da malha (o toco de antes tinha 0,42 por escala 1)
var _fatias_cima := {} # Mesh -> {mesh, mapa}
var _fatias_baixo := {}

# as partes que nascem no chão (tronco); a copa e as maçãs ficam inteiras na parte que cai
func _no_chao(p: Dictionary) -> bool:
	var ab: AABB = (p.mesh as Mesh).get_aabb()
	return ab.position.y < CORTE_Y and ab.end.y > CORTE_Y

# altura do corte (no espaço da base da árvore) da primeira parte cortada; 0 se nenhuma
func _altura_corte(partes: Array) -> float:
	for p in partes:
		if _no_chao(p):
			return (p.t * Vector3(0, CORTE_Y, 0)).y
	return 0.0

# p: parte (_partes). cima: a metade acima do corte (a que cai) ou a de baixo (o toco). mapa[j] = superfície da malha
# original da superfície j (-1 = o corte, madeira clara)
func _fatia(p: Dictionary, cima: bool) -> Dictionary:
	var mesh: Mesh = p.mesh
	if not _no_chao(p):
		var tudo := []
		for i in mesh.get_surface_count():
			tudo.append(i)
		return {"mesh": mesh if cima else null, "mapa": tudo}
	var cache: Dictionary = _fatias_cima if cima else _fatias_baixo
	if cache.has(mesh):
		return cache[mesh]
	var t0 := Time.get_ticks_usec()
	var r := _cortar(mesh, cima)
	cache[mesh] = r
	if m.get("lentidao"):
		m.lentidao.ev("toco_malha", t0)
	return r

func _cortar(mesh: Mesh, cima: bool) -> Dictionary:
	var am := ArrayMesh.new()
	var mapa := []
	var bordas := PackedVector3Array() # pares de pontos no plano do corte
	var sinal := 1.0 if cima else -1.0
	for s in mesh.get_surface_count():
		if mesh.surface_get_primitive_type(s) != Mesh.PRIMITIVE_TRIANGLES:
			continue
		var a := mesh.surface_get_arrays(s)
		var vs: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
		var ns = a[Mesh.ARRAY_NORMAL]
		var tg = a[Mesh.ARRAY_TANGENT]
		var cs = a[Mesh.ARRAY_COLOR]
		var uv = a[Mesh.ARRAY_TEX_UV]
		var uv2 = a[Mesh.ARRAY_TEX_UV2]
		var idx = a[Mesh.ARRAY_INDEX]
		# superfície toda de um lado (a folhagem, quase sempre): vai inteira ou fica de fora, sem passar triângulo por
		# triângulo (a bétula plantada: de 16 para 8 ms no PC, uma vez por espécie)
		var lados := 0
		for v in vs:
			lados |= 1 if (v.y - CORTE_Y) * sinal >= 0.0 else 2
			if lados == 3:
				break
		if lados == 2:
			continue
		if lados == 1:
			var inteira := []
			inteira.resize(Mesh.ARRAY_MAX)
			for q in [Mesh.ARRAY_VERTEX, Mesh.ARRAY_NORMAL, Mesh.ARRAY_TANGENT, Mesh.ARRAY_COLOR, Mesh.ARRAY_TEX_UV, Mesh.ARRAY_TEX_UV2, Mesh.ARRAY_INDEX]:
				inteira[q] = a[q]
			am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, inteira)
			am.surface_set_material(am.get_surface_count() - 1, mesh.surface_get_material(s))
			mapa.append(s)
			continue
		var ov := PackedVector3Array()
		var on := PackedVector3Array()
		var otg := PackedFloat32Array()
		var ocs := PackedColorArray()
		var ouv := PackedVector2Array()
		var ouv2 := PackedVector2Array()
		var n_tri: int = (idx.size() if idx != null else vs.size()) / 3
		var tri := [0, 0, 0]
		var d := [0.0, 0.0, 0.0]
		for k in n_tri:
			var dentro := 0
			for q in 3:
				tri[q] = idx[k * 3 + q] if idx != null else k * 3 + q
				d[q] = (vs[tri[q]].y - CORTE_Y) * sinal
				if d[q] >= 0.0:
					dentro += 1
			if dentro == 0:
				continue
			var poli := [] # [i, j, t]: o ponto entre os vértices i e j
			if dentro == 3:
				poli = [[tri[0], tri[0], 0.0], [tri[1], tri[1], 0.0], [tri[2], tri[2], 0.0]]
			else:
				for q in 3:
					var i0: int = tri[q]
					var i1: int = tri[(q + 1) % 3]
					var d0: float = d[q]
					var d1: float = d[(q + 1) % 3]
					if d0 >= 0.0:
						poli.append([i0, i0, 0.0])
					if (d0 >= 0.0) != (d1 >= 0.0):
						var tt := d0 / (d0 - d1)
						poli.append([i0, i1, tt])
						bordas.append(vs[i0].lerp(vs[i1], tt))
			for q in range(1, poli.size() - 1):
				for e in [poli[0], poli[q], poli[q + 1]]:
					var i: int = e[0]
					var j: int = e[1]
					var w: float = e[2]
					ov.append(vs[i].lerp(vs[j], w))
					if ns != null:
						on.append((ns[i] as Vector3).lerp(ns[j], w).normalized())
					if tg != null:
						for c in 4:
							otg.append(lerpf(tg[i * 4 + c], tg[j * 4 + c], w))
					if cs != null:
						ocs.append((cs[i] as Color).lerp(cs[j], w))
					if uv != null:
						ouv.append((uv[i] as Vector2).lerp(uv[j], w))
					if uv2 != null:
						ouv2.append((uv2[i] as Vector2).lerp(uv2[j], w))
		if ov.is_empty():
			continue
		var arr := []
		arr.resize(Mesh.ARRAY_MAX)
		arr[Mesh.ARRAY_VERTEX] = ov
		if ns != null:
			arr[Mesh.ARRAY_NORMAL] = on
		if tg != null:
			arr[Mesh.ARRAY_TANGENT] = otg
		if cs != null:
			arr[Mesh.ARRAY_COLOR] = ocs
		if uv != null:
			arr[Mesh.ARRAY_TEX_UV] = ouv
		if uv2 != null:
			arr[Mesh.ARRAY_TEX_UV2] = ouv2
		am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		am.surface_set_material(am.get_surface_count() - 1, mesh.surface_get_material(s))
		mapa.append(s)
	# o corte: um leque do meio do tronco até cada pedaço da borda (para cima no toco, para baixo no que cai)
	if bordas.size() >= 6:
		var centro := Vector3.ZERO
		for b in bordas:
			centro += b
		centro /= float(bordas.size())
		var nrm := Vector3.DOWN if cima else Vector3.UP
		var tv := PackedVector3Array()
		var tn := PackedVector3Array()
		for i in range(0, bordas.size() - 1, 2):
			var b0 := bordas[i]
			var b1 := bordas[i + 1]
			if (b0 - centro).cross(b1 - centro).dot(nrm) > 0.0: # Godot: a frente é no sentido horário
				var x := b0
				b0 = b1
				b1 = x
			tv.append(centro)
			tv.append(b0)
			tv.append(b1)
			for q in 3:
				tn.append(nrm)
		var ta := []
		ta.resize(Mesh.ARRAY_MAX)
		ta[Mesh.ARRAY_VERTEX] = tv
		ta[Mesh.ARRAY_NORMAL] = tn
		am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, ta)
		am.surface_set_material(am.get_surface_count() - 1, _mat_corte)
		mapa.append(-1)
	if am.get_surface_count() == 0:
		return {"mesh": null, "mapa": []}
	return {"mesh": am, "mapa": mapa}

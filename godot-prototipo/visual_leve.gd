extends Node
# Visual leve (André 2026-11-10, olhando o Evil Lands: "gráficos simples mas bonitos e o jogo muito leve").
# Duas escolhas em Configurações (o padrão é o jogo de hoje; nada some, só liga quando o jogador escolhe):
# - Sombras "Leves": a sombra de verdade (a que a placa desenha de novo todo quadro) só nos personagens (herói, NPCs,
#   monstros, montaria) e nas casas; árvores, mato, pedras e chão param de entrar no mapa de sombra. Embaixo de cada
#   árvore fica uma sombra pintada (mancha macia no chão, igual nos jogos leves de celular), que fica bem fraca à noite.
#   Na medição (placa de vídeo por software, 2400x1080) a sombra era 1/3 a 1/2 do desenho; assim cai ~15-20%.
# - Cor da grama "Natural": verde-oliva mais natural (como o capim do Evil Lands), ainda pintado: o chão, o capim alto
#   e as folhinhas de grama ganham o mesmo tom.
# Personagem = malha presa num esqueleto (Skeleton3D); casa = o que construcao.gd monta e as casas do vila.glb.

const ARQUIVO := "user://config.cfg"
const CAMADA := 2 # bit das layers: quem projeta sombra no modo leve
const TOM_NATURAL := Color(0.93, 0.86, 0.72) # chão (multiplica a foto da grama, que é verde forte)
const PONTA_NATURAL := Color(1.0, 0.9, 0.76) # capim e folhinhas (mais amarelado, menos neon)
const PEDACO := 32.0

var m # main.gd
var sombra_leve := false
var grama_natural := false
var casas := true # casas continuam com sombra de verdade no modo leve
var _mat_mancha: ShaderMaterial
var _manchas: Array = [] # MultiMeshInstance3D das sombras pintadas
var _feito := false
var _t := 0.0
var _forca := -1.0
var _mats := {} # ShaderMaterial -> [parâmetro, valor original]

func _init(jogo) -> void:
	m = jogo
	name = "VisualLeve"
	var cfg := ConfigFile.new()
	cfg.load(ARQUIVO)
	sombra_leve = bool(cfg.get_value("config", "sombra_leve", false))
	grama_natural = bool(cfg.get_value("config", "grama_natural", false))
	_mat_mancha = ShaderMaterial.new()
	_mat_mancha.shader = load("res://sombra_pintada.gdshader")

func _enter_tree() -> void:
	get_tree().node_added.connect(_entrou)

func _ready() -> void:
	for g in m.find_children("*", "GeometryInstance3D", true, false):
		_marcar(g)
	aplicar()

func _salvar(chave: String, v) -> void:
	var cfg := ConfigFile.new()
	cfg.load(ARQUIVO)
	cfg.set_value("config", chave, v)
	cfg.save(ARQUIVO)

func trocar_sombra(v: bool) -> void:
	sombra_leve = v
	_salvar("sombra_leve", v)
	aplicar()

func trocar_grama(v: bool) -> void:
	grama_natural = v
	_salvar("grama_natural", v)
	aplicar()

func aplicar() -> void:
	if m.sol:
		m.sol.shadow_caster_mask = CAMADA if sombra_leve else 0xFFFFFFFF
	if sombra_leve and not _feito:
		_montar_manchas()
	for g in _manchas:
		g.visible = sombra_leve
	for mat in _mats:
		_tom(mat)

# ---------- quem projeta sombra no modo leve ----------
func _entrou(no: Node) -> void:
	if no is GeometryInstance3D:
		_marcar.call_deferred(no)

func _marcar(g) -> void:
	if not is_instance_valid(g) or not g.is_inside_tree():
		return
	if g is MeshInstance3D or g is MultiMeshInstance3D:
		for mat in _materiais(g):
			if not _mats.has(mat):
				var p := _param(mat)
				if p != "":
					_mats[mat] = {p: _valor(mat, p)}
					if p == "tom_ponta" and mat.shader.resource_path.ends_with("/mato.gdshader"): # o pé do capim acompanha o chão
						_mats[mat]["tom_grama"] = _valor(mat, "tom_grama")
					_tom(mat)
	if g.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_OFF:
		return
	if _projeta(g):
		g.layers |= CAMADA

func _projeta(g: Node) -> bool:
	var a: Node = g.get_parent()
	var n := 0
	while a != null and a != m and n < 10:
		if a is Skeleton3D:
			return true
		if a == m.vila_no:
			if not casas:
				return false
			# casas do vila.glb: as grandes que não são árvore (as árvores ganham sombra pintada)
			return g is MeshInstance3D and g.get_aabb().size.y * g.global_transform.basis.get_scale().y > 3.0 and not _eh_arvore_vila(g)
		if a == m.construcao: # Vila dos Lotes: casas e peças construídas
			return casas
		a = a.get_parent()
		n += 1
	return false

func _queda():
	return m.trabalho.queda if m.trabalho and "queda" in m.trabalho else null

func _eh_arvore_vila(g: Node3D) -> bool:
	var q = _queda()
	if q == null:
		return false
	for l in q._vila.values():
		if g in l:
			return true
	return false

# ---------- sombra pintada embaixo das árvores ----------
func _montar_manchas() -> void:
	_feito = true
	var plano := PlaneMesh.new()
	plano.size = Vector2(2, 2)
	var pedacos := {}
	for pos in m.arvores_mata:
		var c: Dictionary = m.arvores_mata[pos]
		var k := Vector2i(floori(pos.x / PEDACO), floori(pos.y / PEDACO))
		if not pedacos.has(k):
			pedacos[k] = []
		pedacos[k].append(c)
	var raios := {}
	for k in pedacos:
		var lista: Array = pedacos[k]
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = plano
		mm.instance_count = lista.size()
		for i in lista.size():
			var c: Dictionary = lista[i]
			if not raios.has(c.v):
				var malha: Mesh = m._malhas_mata.get("copa_%d" % c.v)
				var bb := malha.get_aabb() if malha else AABB(Vector3(-2, 0, -2), Vector3(4, 6, 4))
				raios[c.v] = maxf(bb.size.x, bb.size.z) * 0.5
			var t := _no_chao(c.t.origin, float(raios[c.v]) * c.t.basis.get_scale().x)
			c.sombra = [mm, i, t]
			mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3.ZERO), t.origin) if c.get("caida", false) else t)
		_manchas.append(_instancia(mm))
	# árvores da vila (vila.glb): uma mancha por árvore; some quando a árvore é cortada
	var q = _queda()
	if q != null and not q._vila.is_empty():
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = plano
		mm.instance_count = q._vila.size()
		var i := 0
		for k in q._vila:
			var l: Array = q._vila[k]
			var r := 1.5
			for mi in l:
				var bb: AABB = mi.get_aabb()
				var sc: Vector3 = mi.global_transform.basis.get_scale()
				r = maxf(r, maxf(bb.size.x * sc.x, bb.size.z * sc.z) * 0.5)
			var o := Vector3(k.x / 10.0, 0, k.y / 10.0)
			var t := _no_chao(o, r * 1.1)
			var idx := i
			mm.set_instance_transform(idx, t)
			if not l.is_empty():
				var mi0: Node3D = l[0]
				mi0.visibility_changed.connect(func():
					mm.set_instance_transform(idx, t if mi0.visible else Transform3D(Basis().scaled(Vector3.ZERO), t.origin)))
			i += 1
		_manchas.append(_instancia(mm))

func _instancia(mm: MultiMesh) -> MultiMeshInstance3D:
	var g := MultiMeshInstance3D.new()
	g.multimesh = mm
	g.material_override = _mat_mancha
	g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	g.visibility_range_end = 80.0
	g.visibility_range_end_margin = 6.0
	g.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
	g.visible = sombra_leve
	add_child(g)
	return g

# mancha deitada no chão, inclinada como o chão em volta (encosta), um pouco acima para não piscar
func _no_chao(o: Vector3, r: float) -> Transform3D:
	var T = m.terreno
	var y := o.y
	var n := Vector3.UP
	if T != null:
		var d := maxf(r * 0.6, 0.8)
		var hx: float = T.altura(o.x + d, o.z) - T.altura(o.x - d, o.z)
		var hz: float = T.altura(o.x, o.z + d) - T.altura(o.x, o.z - d)
		n = Vector3(-hx, 2.0 * d, -hz).normalized()
		y = T.altura(o.x, o.z)
	var b := Basis(Quaternion(Vector3.UP, n)).scaled(Vector3(r, 1.0, r))
	return Transform3D(b, Vector3(o.x, y + 0.07, o.z))

# chamado por queda_arvore.gd quando a árvore da mata cai (k = 0) ou volta a crescer (k de 0 a 1)
func crescer(c: Dictionary, k: float) -> void:
	if not c.has("sombra"):
		return
	var t: Transform3D = c.sombra[2]
	c.sombra[0].set_instance_transform(c.sombra[1], Transform3D(t.basis.scaled(Vector3.ONE * maxf(k, 0.0)), t.origin))

func _process(dt: float) -> void:
	_t += dt
	if _t < 0.5 or not sombra_leve:
		return
	_t = 0.0
	# de noite a mancha fica bem fraca (a lua ainda faz um pouco de sombra); no pôr e no nascer do sol, no meio
	var noite: float = m.dia.noite if m.dia else 0.0
	var f := lerpf(1.0, 0.3, noite)
	if absf(f - _forca) > 0.01:
		_forca = f
		_mat_mancha.set_shader_parameter("forca", f)

# ---------- cor da grama ----------
func _param(mat: ShaderMaterial) -> String:
	var c: String = mat.shader.resource_path if mat.shader else ""
	if c.ends_with("/chao.gdshader") or c.ends_with("/terreno_mundo.gdshader"):
		return "tom_grama"
	if c.ends_with("/grama.gdshader") or c.ends_with("/mato.gdshader"):
		return "tom_ponta"
	return ""

func _tom(mat: ShaderMaterial) -> void:
	var b: Dictionary = _mats[mat]
	for p in b:
		var v = b[p]
		if grama_natural:
			v = PONTA_NATURAL if p == "tom_ponta" else TOM_NATURAL
		mat.set_shader_parameter(p, v)

func _valor(mat: ShaderMaterial, p: String):
	var v = mat.get_shader_parameter(p)
	if v == null:
		v = RenderingServer.shader_get_parameter_default(mat.shader.get_rid(), p)
	if v is Vector3:
		v = Color(v.x, v.y, v.z)
	return v

func _materiais(g: GeometryInstance3D) -> Array:
	var l: Array = []
	if g.material_override is ShaderMaterial:
		l.append(g.material_override)
	var mesh: Mesh = null
	if g is MeshInstance3D:
		mesh = g.mesh
	elif g is MultiMeshInstance3D and g.multimesh:
		mesh = g.multimesh.mesh
	if mesh:
		for i in mesh.get_surface_count():
			var mt = mesh.surface_get_material(i)
			if mt is ShaderMaterial:
				l.append(mt)
	return l

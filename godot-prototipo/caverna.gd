extends Node3D
# Caverna da Montanha, a primeira dungeon (pedido do André 2026-11-06: "eu queria que a dungeon não fosse uma
# recarrega... que a passagem fosse suave, como se ela fosse uma extensão do mapa").
#
# Sem tela de carregamento: a caverna é um túnel no mesmo mundo, por baixo da montanha. O chão e as paredes são a
# mesma conta do servidor (shared/caverna.js; terreno.gd no_tunel e altura). Aqui só se desenha, e aos poucos:
# - de longe não existe nada (zero custo). Quando o herói chega a PERTO_MONTA m do túnel, a malha nasce em pedaços de
#   PEDACO m, um pedaço por quadro (cada um leva ~1 ms), começando pela boca;
# - tochas, braseiros e cristais acendem a luz só a menos de LUZ_LONGE m do herói (celular: poucas luzes por vez);
# - os monstros das salas ganham corpo no app só quando a malha está pronta (e o servidor só faz nascer quando alguém
#   com passe está lá dentro: Simulacao.passoCaverna);
# - entrando, a luz de fora vai sumindo (o sol e o céu ficam na boca) e as tochas tomam conta.
# O selo (portão de luz) fica na porta: sem passe usado, o herói não passa (andar.gd selo_aberto; o servidor confere).

const PEDACO := 8 # amostras (metros de túnel) por pedaço de malha
const PERTO_MONTA := 120.0 # metros do herói até o túnel para começar a montar
const LONGE_SOME := 220.0 # longe assim, a caverna inteira some (volta a montar ao chegar perto)
const LUZ_LONGE := 34.0
const ANEL := 18 # pontos do arco (parede e teto) por anel
const CHAO_N := 7 # pontos do chão por anel

var m # main.gd
var T # terreno.gd
var A: Array = [] # T.tunel
var folga := 0.35
const BURACO_ATE := 5.0 # metros do túnel (a partir da boca) em que a montanha pode abrir buraco para o arco aparecer
var montada := false
var _fila: Array = [] # Callables: um pedaço por quadro
var _pedacos: Array = [] # MeshInstance3D
var _luzes: Array = [] # {no: OmniLight3D, p: Vector3}
var _ruido := FastNoiseLite.new()
var mat: ShaderMaterial
var selo: MeshInstance3D
var selo_mat: ShaderMaterial
var _monstros_feitos := false
var _env: Environment
var _amb0 := -1.0
var _sol0 := -1.0
var _nevoa0 := Color()
var escuro := 0.0 # 0 fora, 1 no fundo da caverna

func _init(main, terreno) -> void:
	m = main
	T = terreno
	A = T.tunel
	name = "Caverna"
	folga = float(T.m.get("caverna", {}).get("folga", 0.35))
	_ruido.seed = 4417
	_ruido.frequency = 0.32
	_ruido.fractal_octaves = 3

# A montanha (relevo.gd) não desenha os quadrados do paredão que ficam na frente do túnel, logo atrás da boca (a rocha
# por cima da boca é BOCA_CAVERNA em shared/relevo.js): ali quem aparece é o arco da caverna e a moldura de pedra.
# h = o ponto mais baixo do quadrado.
func buraco_na_montanha(x: float, z: float, h: float) -> bool:
	if A.is_empty():
		return false
	var c: Dictionary = T.no_tunel(x, z, folga + 0.8)
	return not c.is_empty() and float(c.s) >= 0.5 and float(c.s) <= BURACO_ATE and h < float(c.y) + float(c.teto) + 0.6

func _ready() -> void:
	for we in get_parent().find_children("*", "WorldEnvironment", false, false):
		_env = we.environment
	mat = ShaderMaterial.new()
	mat.shader = load("res://caverna.gdshader")
	mat.set_shader_parameter("pedra_tex", load("res://relevo/rocky_terrain_02.jpg"))
	mat.set_shader_parameter("chao_tex", load("res://relevo/brown_mud_leaves_01.jpg"))

var _t := 0.0
func _process(dt: float) -> void:
	if A.is_empty() or m.heroi == null:
		return
	if not _fila.is_empty(): # um pedaço por quadro
		var t0 := Time.get_ticks_usec()
		while not _fila.is_empty() and Time.get_ticks_usec() - t0 < 3000:
			(_fila.pop_front() as Callable).call()
	var hp: Vector3 = m.heroi.position
	_t -= dt
	if _t <= 0.0:
		_t = 0.25
		var d := _distancia(hp)
		if not montada and d < PERTO_MONTA:
			montar()
		elif montada and d > LONGE_SOME and _fila.is_empty():
			desmontar()
		if montada:
			for l in _luzes:
				l.no.visible = l.p.distance_to(hp) < LUZ_LONGE
		_criar_monstros()
	_luz_de_dentro(hp, dt)
	_botao_do_selo(hp)
	if selo_mat:
		selo_mat.set_shader_parameter("aberto", move_toward(float(selo_mat.get_shader_parameter("aberto")), 1.0 if m.mov.selo_aberto else 0.0, dt * 1.5))

func _distancia(p: Vector3) -> float:
	var r: Rect2 = T.tunel_caixa
	var dx := maxf(0.0, maxf(r.position.x - p.x, p.x - r.end.x))
	var dz := maxf(0.0, maxf(r.position.y - p.z, p.z - r.end.y))
	return Vector2(dx, dz).length()

# ---------- montar e desmontar (aos poucos) ----------
func montar() -> void:
	montada = true
	var k0 := 0
	while k0 < A.size() - 1:
		var k1 := mini(k0 + PEDACO, A.size() - 1)
		_fila.append(_pedaco.bind(k0, k1))
		k0 = k1
	_fila.append(_moldura)
	_fila.append(_fundo)
	_fila.append(_selo)
	_fila.append(_enfeites)

func desmontar() -> void:
	montada = false
	_fila.clear()
	for c in get_children():
		c.queue_free()
	_pedacos.clear()
	_luzes.clear()
	selo = null
	selo_mat = null

# perfil de um anel: lista de [u (lado, m), v (altura acima do chão), é chão (0/1)], da esquerda para a direita pelo
# chão e voltando pelo arco (parede direita, teto, parede esquerda)
func _perfil(a: Dictionary) -> Array:
	var W: float = float(a.l) + folga
	var H: float = float(a.teto)
	var l := []
	for i in CHAO_N:
		var u := lerpf(-W, W, float(i) / (CHAO_N - 1))
		l.append([u, 0.0, 1.0])
	for i in range(1, ANEL):
		var th := PI * float(i) / ANEL # 0 = parede direita (u = +W), PI = esquerda
		var c := cos(th)
		var sn := sin(th)
		l.append([W * c * (1.0 + 0.06 * sn), H * pow(sn, 0.72), 0.0])
	return l

# ponto do anel no mundo, com a rocha irregular (ruído empurra para fora; no teto um pouco para dentro também)
func _ponto(a: Dictionary, q: Array, casca := 0.0) -> Vector3:
	var nx: float = -float(a.dz) # esquerda do túnel = +lado
	var nz: float = float(a.dx)
	var u: float = q[0]
	var v: float = q[1]
	var base := Vector3(float(a.x) - nx * u, float(a.y) + v, float(a.z) - nz * u) # u > 0 = direita
	base.y += float(a.get("incl", 0.0)) * -u # na boca o chão pende de lado como a encosta (terreno.gd no_tunel)
	if q[2] > 0.5: # chão: só uma ondulação de 3 cm (os pés não somem nem flutuam)
		var e := 1.0 - pow(absf(u) / (float(a.l) + folga), 6.0)
		base.y += _ruido.get_noise_3d(base.x * 2.0, 0.0, base.z * 2.0) * 0.03 * e
		return base
	var meio := Vector3(float(a.x), float(a.y) + float(a.teto) * 0.35, float(a.z))
	var rad := (base - meio)
	rad.y *= 0.6
	rad = rad.normalized()
	var r := _ruido.get_noise_3d(base.x, base.y * 1.3, base.z)
	var baixo := clampf(v / 1.8, 0.0, 1.0)
	var empurra := absf(r) * 0.55 * (1.0 - baixo) + r * 0.5 * baixo # embaixo só para fora (não invade o chão de andar)
	if v > float(a.teto) * 0.7:
		empurra = maxf(empurra, -0.35)
	empurra += _ruido.get_noise_3d(base.x * 0.35 + 50.0, base.y * 0.35, base.z * 0.35) * 0.6 * baixo # bojos grandes
	if casca > 0.0:
		return base + rad * (absf(empurra) * 0.5 + casca)
	return base + rad * empurra

# um pedaço do túnel: anéis de k0 até k1 ligados por quadrados
func _pedaco(k0: int, k1: int) -> void:
	var vs := PackedVector3Array()
	var cs := PackedColorArray()
	var idx := PackedInt32Array()
	var n := 0
	var aneis := []
	for k in range(k0, k1 + 1):
		var a: Dictionary = A[k]
		var pf := _perfil(a)
		n = pf.size()
		aneis.append(vs.size())
		for q in pf:
			vs.append(_ponto(a, q))
			cs.append(Color(q[2], 0, 0))
	for r in aneis.size() - 1:
		var b0: int = aneis[r]
		var b1: int = aneis[r + 1]
		for i in n:
			var i2 := (i + 1) % n
			_quad(vs, idx, b0 + i, b0 + i2, b1 + i, b1 + i2, A[k0 + r])
	_malha(vs, cs, idx, "Tunel%d" % k0)

# dois triângulos virados para dentro do túnel (o lado da frente aponta para o meio dele)
func _quad(vs: PackedVector3Array, idx: PackedInt32Array, a: int, b: int, c: int, d: int, am: Dictionary) -> void:
	var meio := Vector3(float(am.x), float(am.y) + float(am.teto) * 0.4, float(am.z))
	_tri(vs, idx, a, b, d, meio)
	_tri(vs, idx, a, d, c, meio)

func _tri(vs: PackedVector3Array, idx: PackedInt32Array, a: int, b: int, c: int, dentro: Vector3, fora := false) -> void:
	var n := (vs[b] - vs[a]).cross(vs[c] - vs[a])
	var centro := (vs[a] + vs[b] + vs[c]) / 3.0
	var para := (dentro - centro) * (-1.0 if fora else 1.0)
	# Godot: a frente é o lado de onde os vértices aparecem em sentido horário (normal = (c - a) x (b - a))
	if n.dot(para) > 0.0:
		idx.append_array([a, c, b])
	else:
		idx.append_array([a, b, c])

func _malha(vs: PackedVector3Array, cs: PackedColorArray, idx: PackedInt32Array, nome: String) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = vs
	arr[Mesh.ARRAY_COLOR] = cs
	arr[Mesh.ARRAY_INDEX] = idx
	st.create_from_arrays(arr)
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.name = nome
	mi.mesh = st.commit()
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	add_child(mi)
	_pedacos.append(mi)
	return mi

# A moldura da boca: um anel de pedra em pé na entrada, do arco de dentro até ~2,4 m para fora, encostado no paredão
# (BOCA_CAVERNA). Tapa a emenda entre o arco e o buraco que a montanha abre (buraco_na_montanha) e o pé afunda no chão.
func _moldura() -> void:
	var a: Dictionary = A[0]
	var pf := _perfil(a)
	var arco: Array = pf.slice(CHAO_N - 1) + [pf[0]] # parede direita, teto, parede esquerda
	var vs := PackedVector3Array()
	var cs := PackedColorArray()
	var idx := PackedInt32Array()
	var fora_d := Vector3(float(a.x), float(a.y) + 1.5, float(a.z)) - Vector3(float(a.dx), 0, float(a.dz)) * 6.0
	var tras := Vector3(float(a.dx), 0, float(a.dz))
	var aneis := []
	# 3 voltas: o arco de dentro, uma do meio (o lábio, um pouco para fora) e a de fora (encostada no paredão)
	for volta in 3:
		aneis.append(vs.size())
		var k: float = [0.0, 1.1, 2.6][volta]
		var recua: float = [0.0, -0.35, 0.9][volta]
		var lista := []
		lista.append([arco[0][0], -1.2 * minf(1.0, float(volta)), 0.0])
		lista.append_array(arco)
		lista.append([arco[arco.size() - 1][0], -1.2 * minf(1.0, float(volta)), 0.0])
		for q in lista:
			var p := _ponto(a, q, k) if volta > 0 else _ponto(a, q)
			if volta > 0:
				p += tras * (recua + _ruido.get_noise_3d(p.x * 0.7, p.y * 0.7, p.z * 0.7) * 0.5)
			vs.append(p)
			cs.append(Color(0, 0, 0))
	var n: int = arco.size() + 2
	for r in 2:
		for i in n - 1:
			var a0: int = aneis[r] + i
			var b0: int = aneis[r + 1] + i
			_tri(vs, idx, a0, a0 + 1, b0 + 1, fora_d, false)
			_tri(vs, idx, a0, b0 + 1, b0, fora_d, false)
	_malha(vs, cs, idx, "Boca")

# o fundo do túnel: parede fechando o último anel
func _fundo() -> void:
	var a: Dictionary = A[A.size() - 1]
	var vs := PackedVector3Array()
	var cs := PackedColorArray()
	var idx := PackedInt32Array()
	var meio := Vector3(float(a.x), float(a.y) + float(a.teto) * 0.4, float(a.z)) + Vector3(float(a.dx), 0, float(a.dz)) * 1.2
	vs.append(meio)
	cs.append(Color(0, 0, 0))
	var pf := _perfil(a)
	for q in pf:
		vs.append(_ponto(a, q))
		cs.append(Color(q[2], 0, 0))
	var dentro := Vector3(float(a.x), float(a.y) + 1.5, float(a.z)) - Vector3(float(a.dx), 0, float(a.dz)) * 3.0
	for i in pf.size():
		_tri(vs, idx, 0, 1 + i, 1 + (i + 1) % pf.size(), dentro)
	_malha(vs, cs, idx, "Fundo")

# ---------- selo, tochas, braseiros, cristais e pedras ----------
func _ponto_s(s: float, lado := 0.0) -> Dictionary:
	var k := clampi(int(s), 0, A.size() - 2)
	var a: Dictionary = A[k]
	var b: Dictionary = A[k + 1]
	var t := clampf(s - float(a.s), 0.0, 1.0)
	var dx: float = lerpf(a.dx, b.dx, t)
	var dz: float = lerpf(a.dz, b.dz, t)
	var x: float = lerpf(a.x, b.x, t) - dz * lado
	var z: float = lerpf(a.z, b.z, t) + dx * lado
	return {"p": Vector3(x, lerpf(a.y, b.y, t), z), "dx": dx, "dz": dz, "l": lerpf(a.l, b.l, t), "teto": lerpf(a.teto, b.teto, t)}

func _selo() -> void:
	var q := _ponto_s(T.porta)
	var W: float = float(q.l) + folga + 0.3
	var H: float = float(q.teto) + 0.2
	var pm := PlaneMesh.new()
	pm.size = Vector2(W * 2.0, H)
	pm.orientation = PlaneMesh.FACE_Z
	selo_mat = ShaderMaterial.new()
	selo_mat.shader = load("res://selo.gdshader")
	selo_mat.set_shader_parameter("aspecto", W / H)
	selo_mat.set_shader_parameter("aberto", 1.0 if m.mov.selo_aberto else 0.0)
	selo = MeshInstance3D.new()
	selo.name = "Selo"
	selo.mesh = pm
	selo.material_override = selo_mat
	selo.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(selo)
	selo.position = q.p + Vector3(0, H / 2.0 - 0.05, 0)
	selo.rotation.y = atan2(float(q.dx), float(q.dz))
	# dois pilares de pedra lavrada segurando o selo e uma luz dourada fraca
	for lado in [-1.0, 1.0]:
		var pq := _ponto_s(T.porta, lado * (float(q.l) + folga - 0.15))
		_modelo("pilar", pq.p, atan2(float(q.dx), float(q.dz)), Vector3(0.75, H / 3.6, 0.75))
	_luz(q.p + Vector3(0, 2.2, 0) - Vector3(float(q.dx), 0, float(q.dz)) * 1.0, Color(1.0, 0.78, 0.45), 7.0, 1.1)

func _enfeites() -> void:
	var dados: Dictionary = T.m.get("caverna", {})
	# tochas nas paredes, alternando os lados, do selo até o fundo
	var s: float = T.porta + 4.0
	var lado := 1.0
	while s < A[A.size() - 1].s - 2.0:
		var q := _ponto_s(s)
		var dentro_sala := false
		for S in dados.get("salas", []):
			if absf(s - float(S.s)) < float(S.r) + 2.0:
				dentro_sala = true
		if not dentro_sala:
			_tocha(s, lado)
			lado = -lado
		s += 9.0
	# salas: dois braseiros, cristais e pedras soltas encostadas nas paredes
	var i := 0
	for S in dados.get("salas", []):
		var c := _ponto_s(float(S.s))
		for ld in [-1.0, 1.0]:
			var b := _ponto_s(float(S.s) + ld * 3.0, ld * (float(c.l) - 1.4))
			_braseiro(b.p)
		for k in 5:
			var sk: float = float(S.s) + (k - 2) * float(S.r) * 0.42
			var ld2 := 1.0 if (k + i) % 2 == 0 else -1.0
			var cq := _ponto_s(sk, ld2 * (float(_ponto_s(sk).l) + folga - 0.1))
			_cristais(cq.p, 3 + (k % 3), i * 10 + k)
		for k in 4:
			var sk: float = float(S.s) + (k - 1.5) * float(S.r) * 0.55
			var ld3 := -1.0 if (k + i) % 2 == 0 else 1.0
			var rq := _ponto_s(sk, ld3 * (float(_ponto_s(sk).l) - 0.2))
			_modelo("rocha%d" % (1 + (k + i) % 3), rq.p + Vector3(0, -0.15, 0), float(k) * 1.7, Vector3.ONE * (0.9 + 0.25 * (k % 2)))
		i += 1
	# cogumelos que brilham perto das paredes do corredor
	var sc: float = T.porta + 6.0
	var n := 0
	while sc < A[A.size() - 1].s - 2.0:
		var ld4 := 1.0 if n % 2 == 0 else -1.0
		var mq := _ponto_s(sc, ld4 * (float(_ponto_s(sc).l) + folga - 0.25))
		var cog := _modelo("cogumelo", mq.p, float(n) * 2.3, Vector3.ONE * 0.8)
		if cog:
			for mi in cog.find_children("*", "MeshInstance3D", true, false):
				mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		sc += 5.5 + float(n % 3) * 1.7
		n += 1

func _modelo(nome: String, p: Vector3, ry: float, esc: Vector3) -> Node3D:
	var cena = load("res://cenario3d/%s.glb" % nome)
	if cena == null:
		return null
	var no: Node3D = cena.instantiate()
	add_child(no)
	m.pintar(no, false)
	no.position = p
	no.rotation.y = ry
	no.scale = esc
	return no

func _luz(p: Vector3, cor: Color, alcance: float, forca: float) -> OmniLight3D:
	var l := OmniLight3D.new()
	l.light_color = cor
	l.omni_range = alcance
	l.light_energy = forca
	l.omni_attenuation = 1.3
	l.shadow_enabled = false
	l.position = p
	add_child(l)
	_luzes.append({"no": l, "p": p})
	return l

var _mat_chama: ShaderMaterial
func _chama(p: Vector3, tam: float, fase: float) -> void:
	if _mat_chama == null:
		_mat_chama = ShaderMaterial.new()
		_mat_chama.shader = load("res://chama.gdshader")
	var q := QuadMesh.new()
	q.size = Vector2(tam * 0.7, tam)
	var mi := MeshInstance3D.new()
	mi.mesh = q
	mi.material_override = _mat_chama
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.set_instance_shader_parameter("fase", fase)
	mi.position = p
	add_child(mi)

var _mat_madeira: StandardMaterial3D
func _tocha(s: float, lado: float) -> void:
	var q := _ponto_s(s)
	var W: float = float(q.l) + folga
	var parede := _ponto_s(s, lado * (W - 0.05))
	var p: Vector3 = parede.p + Vector3(0, 2.1, 0)
	var para_dentro: Vector3 = q.p - parede.p
	para_dentro.y = 0
	para_dentro = para_dentro.normalized()
	if _mat_madeira == null:
		_mat_madeira = StandardMaterial3D.new()
		_mat_madeira.albedo_color = Color(0.32, 0.22, 0.14)
		_mat_madeira.roughness = 0.9
	var cab := CylinderMesh.new()
	cab.top_radius = 0.05
	cab.bottom_radius = 0.035
	cab.height = 0.6
	cab.radial_segments = 6
	var mi := MeshInstance3D.new()
	mi.mesh = cab
	mi.material_override = _mat_madeira
	add_child(mi)
	mi.position = p + para_dentro * 0.18
	mi.look_at_from_position(mi.position, mi.position + Vector3.UP + para_dentro * 0.55, para_dentro)
	mi.rotate_object_local(Vector3.RIGHT, PI / 2.0)
	var topo: Vector3 = p + para_dentro * 0.34 + Vector3(0, 0.3, 0)
	_chama(topo + Vector3(0, 0.12, 0), 0.42, s)
	_luz(topo + para_dentro * 0.25, Color(1.0, 0.6, 0.28), 9.0, 1.6)

func _braseiro(p: Vector3) -> void:
	var no := _modelo("fogueira", p, randf() * TAU, Vector3.ONE * 0.9)
	_chama(p + Vector3(0, 0.55, 0), 0.9, p.x)
	_chama(p + Vector3(0.12, 0.45, 0.08), 0.6, p.z)
	_luz(p + Vector3(0, 1.3, 0), Color(1.0, 0.55, 0.25), 12.0, 2.0)
	if no == null:
		return

var _mat_cristal: StandardMaterial3D
func _cristais(p: Vector3, n: int, semente: int) -> void:
	if _mat_cristal == null:
		_mat_cristal = StandardMaterial3D.new()
		_mat_cristal.albedo_color = Color(0.35, 0.75, 0.9)
		_mat_cristal.emission_enabled = true
		_mat_cristal.emission = Color(0.25, 0.75, 1.0)
		_mat_cristal.emission_energy_multiplier = 1.6
		_mat_cristal.roughness = 0.2
		_mat_cristal.metallic_specular = 0.8
	var rng := RandomNumberGenerator.new()
	rng.seed = 900 + semente
	for i in n:
		var c := CylinderMesh.new()
		c.top_radius = 0.0
		c.bottom_radius = rng.randf_range(0.07, 0.14)
		c.height = rng.randf_range(0.35, 0.95)
		c.radial_segments = 6
		c.rings = 1
		var mi := MeshInstance3D.new()
		mi.mesh = c
		mi.material_override = _mat_cristal
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)
		mi.position = p + Vector3(rng.randf_range(-0.35, 0.35), c.height * 0.4, rng.randf_range(-0.35, 0.35))
		mi.rotation = Vector3(rng.randf_range(-0.5, 0.5), rng.randf() * TAU, rng.randf_range(-0.5, 0.5))
	if semente % 2 == 0: # meia dúzia de luzes azuis por sala (celular: poucas)
		_luz(p + Vector3(0, 0.8, 0), Color(0.4, 0.8, 1.0), 4.5, 0.9)

# ---------- monstros das salas (corpo no app) ----------
# O v de cada monstro vem depois do espantalho (a mesma conta do servidor). Só cria depois que os monstros dos campos
# e o espantalho já entraram na lista (main.gd criar_aos_poucos) e se o jogo está online (sem servidor a caverna
# fica vazia: o selo não abre).
func _criar_monstros() -> void:
	if _monstros_feitos or not montada or not m.on() or not m._a_criar.is_empty():
		return
	var dg = T.m.get("dungeon")
	if dg == null:
		_monstros_feitos = true
		return
	var lista := []
	for S in dg.salas:
		for q in S.monstros:
			lista.append([S, q])
	lista.sort_custom(func(a, b): return int(a[1].v) < int(b[1].v))
	if lista.is_empty() or m.inimigos.size() != int(lista[0][1].v):
		push_warning("caverna: monstros fora do lugar na lista (%d)" % m.inimigos.size())
		_monstros_feitos = true
		return
	_monstros_feitos = true
	for par in lista:
		var S: Dictionary = par[0]
		var q: Dictionary = par[1]
		var tipo := str(q.tipo)
		var nv := int(S.nivel)
		var nome: String = m.NOME_TIPO.get(tipo, "Inimigo") + "  Nv %d" % nv
		var e: Dictionary = m.criar_inimigo(m.MODELO_TIPO.get(tipo, "puglin"), Vector3(float(q.x), float(q.y), float(q.z)), nome, 1.0)
		e.tipo = tipo
		e.nivel = nv
		for l in e.no.get_children():
			if l is Label3D:
				l.modulate = m.cor_nivel(nv)
				break
		var st: Dictionary = q.get("status", {})
		e.vida_max = float(st.get("vida", 200))
		e.dano = float(st.get("dano", 15))
		e.vida = e.vida_max
		e.centro = e.no.position
		e.caverna = true
		e.estado = "morto" # escondido até o servidor fazer nascer (com alguém lá dentro)
		e.no.visible = false
		m.online._barra_visivel(e, false)
		e.seq = -1
		e.uma_vez = 0.0
		e.alvo = e.no.position

# ---------- luz de dentro e o botão do selo ----------
func _luz_de_dentro(hp: Vector3, dt: float) -> void:
	if _env == null:
		for we in get_parent().find_children("*", "WorldEnvironment", false, false):
			_env = we.environment
	if _env == null or m.sol == null:
		return
	var c: Dictionary = T.dentro_caverna(hp.x, hp.z, hp.y + 0.3)
	var alvo := 0.0
	if not c.is_empty():
		alvo = smoothstep(1.0, T.porta + 8.0, float(c.s))
	if alvo == 0.0 and escuro == 0.0:
		return
	if _amb0 < 0.0:
		_amb0 = _env.ambient_light_energy
		_sol0 = m.sol.light_energy
		_nevoa0 = _env.fog_light_color
	escuro = move_toward(escuro, alvo, dt * 0.6) # os olhos se acostumam
	_env.ambient_light_energy = lerpf(_amb0, 0.1, escuro)
	m.sol.light_energy = lerpf(_sol0, 0.12, escuro)
	_env.fog_light_color = _nevoa0.lerp(Color(0.05, 0.05, 0.07), escuro)
	if escuro == 0.0:
		_amb0 = -1.0

func _botao_do_selo(hp: Vector3) -> void:
	var dg = T.m.get("dungeon")
	var perto := false
	if dg != null and not m.mov.selo_aberto and m.h.morto <= 0.0:
		var c: Dictionary = T.dentro_caverna(hp.x, hp.z, hp.y + 0.3)
		perto = not c.is_empty() and float(c.s) <= T.porta + 0.3 and float(c.s) >= T.porta - float(dg.get("portaPerto", 4.0))
	m.hud.mostrar_botao("selo", perto)

# botão do selo: gasta um passe (o servidor confere e abre)
func usar_passe() -> void:
	if not m.on():
		m.hud.aviso("O selo só abre com o jogo ligado ao servidor")
		return
	var tem := 0
	for it in m.P.prog.mochila:
		if it is Dictionary and str(it.get("k", "")) == "passe_caverna":
			tem += int(it.get("n", 1))
	if tem <= 0:
		m.hud.aviso("Precisa de um Passe da Caverna. O Gaspar, aqui fora, faz um com material dos monstros")
		return
	m.rede("item", {"acao": "usar_passe"})

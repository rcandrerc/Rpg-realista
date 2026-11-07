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
const ANEL := 24 # pontos do arco (parede e teto) por anel
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
var mat_pedra: ShaderMaterial # rochas soltas, pilares e lintel: a mesma pedra, sem chão, com contorno
const CONTORNO := 0.02 # contorno escuro de desenho (m), o mesmo dos monstros do Mixamo
var selo: MeshInstance3D
var selo_mat: ShaderMaterial
var _monstros_feitos := false
var _env: Environment
var _amb0 := -1.0
var _sol0 := -1.0
var _nevoa0 := Color()
var _amb_cor0 := Color()
var _amb_ceu0 := 1.0
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
	# 2026-11-06 (André: "cheio de buraco por cima"): a montanha não perde mais nenhum quadrado. O vão do arco é
	# cortado ponto a ponto no montanha.gdshader (boca_*) e o paredão (_paredao) cobre a frente. Fica a assinatura.
	return false

func _ready() -> void:
	for we in get_parent().find_children("*", "WorldEnvironment", false, false):
		_env = we.environment
	mat = ShaderMaterial.new()
	mat.shader = load("res://caverna.gdshader")
	mat.set_shader_parameter("pedra_tex", load("res://relevo/rocky_terrain_02.jpg"))
	mat.set_shader_parameter("chao_tex", load("res://relevo/brown_mud_leaves_01.jpg"))
	mat_pedra = mat.duplicate()
	mat_pedra.set_shader_parameter("so_rocha", true)
	mat_pedra.next_pass = _contorno_mat(CONTORNO)

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
				l.no.visible = l.p.distance_to(hp) < float(l.get("longe", LUZ_LONGE))
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
	_fila.append(_paredao)
	_fila.append(_corte_na_montanha.bind(true))
	_fila.append(_portal_da_boca)
	_fila.append(_fundo)
	_fila.append(_selo)
	_fila.append(_enfeites)

func desmontar() -> void:
	montada = false
	_corte_na_montanha(false)
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
		base.y -= 0.04 * (1.0 - smoothstep(0.0, 1.5, float(a.s))) # na soleira o chão de fora cobre a emenda
		return base
	var meio := Vector3(float(a.x), float(a.y) + float(a.teto) * 0.35, float(a.z))
	var rad := (base - meio)
	rad.y *= 0.6
	rad = rad.normalized()
	var r := _ruido.get_noise_3d(base.x, base.y * 1.3, base.z)
	# v2 (direção de arte): a parede não pode parecer um tubo liso. Lajes e bojos de 30 a 60 cm (ruído grande) mais o
	# miúdo; embaixo (até 1,8 m) só para fora, para não invadir o chão de andar
	var g := _ruido.get_noise_3d(base.x * 0.45 + 50.0, base.y * 0.55, base.z * 0.45)
	var laje := absf(_ruido.get_noise_3d(base.x * 0.9 - 20.0, base.y * 2.6, base.z * 0.9)) # faixas de rocha em camadas
	var baixo := clampf(v / 1.8, 0.0, 1.0)
	var empurra := (absf(r) * 0.4 + absf(g) * 0.55 + laje * 0.2) * (1.0 - baixo) + (r * 0.35 + g * 0.6 + laje * 0.25) * baixo
	if v > float(a.teto) * 0.7:
		empurra = maxf(empurra, -0.35)
	empurra *= smoothstep(0.5, 4.5, float(a.s)) # na boca a parede é o arco exato: encosta no paredão sem fresta
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

# O paredão da boca (pedido do André 2026-11-06: "parecer uma rocha só, bem feita"): uma peça de rocha inteira em pé
# na entrada, com o furo do arco exatamente igual ao primeiro anel do túnel (sem fresta). A borda de fora vai para
# trás e para baixo, enterrada na montanha (BOCA_CAVERNA), e usa o mesmo material da montanha (a mesma pedra). A
# montanha não perde nenhum quadrado: só não desenha o que fica dentro do vão do arco (montanha.gdshader, boca_*).
func _paredao() -> void:
	var a: Dictionary = A[0]
	var O := Vector3(float(a.x), float(a.y), float(a.z))
	var d := Vector3(float(a.dx), 0, float(a.dz))
	var dir := Vector3(float(a.dz), 0, -float(a.dx)) # direita (u > 0), como em _ponto
	var W: float = float(a.l) + folga
	var H: float = float(a.teto)
	var cy := H * 0.35
	var Wf := W + 3.8
	var topo := maxf(T.altura(O.x + d.x * 3.0, O.z + d.z * 3.0), O.y + H + 2.2) + 0.6 # um pouco acima da rocha de trás
	var Hf := topo - O.y - cy
	var pf := _perfil(a)
	var arco: Array = [[W, -1.2, 0.0]] + pf.slice(CHAO_N - 1) + [pf[0], [-W, -1.2, 0.0]]
	var n := arco.size()
	var vs := PackedVector3Array()
	var cs := PackedColorArray()
	var idx := PackedInt32Array()
	# anéis: k = 0 é o próprio arco do túnel (s = 0); depois a cara do paredão até a borda; depois a volta que entra
	# na montanha. [k na cara (0 a 1), recuo para trás (m), afunda (m)]
	# (mais voltas perto da borda de cima: sem facetas grandes vistas de cima)
	var voltas := [[0.0, 0.0, 0.0], [0.12, -0.1, 0.0], [0.26, -0.22, 0.0], [0.42, -0.3, 0.0], [0.58, -0.34, 0.0], [0.72, -0.3, 0.0], [0.84, -0.18, 0.0], [0.93, 0.05, 0.05], [1.0, 0.45, 0.2], [1.05, 1.3, 0.5], [1.1, 2.6, 0.9], [1.18, 6.0, 2.2]]
	for vi in voltas.size():
		var V: Array = voltas[vi]
		var k: float = V[0]
		for i in n:
			var q: Array = arco[i]
			var p: Vector3
			if vi == 0:
				p = _ponto(a, q) if q[1] > -0.5 else O + dir * float(q[0]) + Vector3(0, float(q[1]) + float(a.get("incl", 0.0)) * -float(q[0]), 0)
			else:
				var u: float = q[0]
				var v: float = q[1]
				var rd := Vector2(u, v - cy)
				var fora: Vector2
				if v < -0.5: # os pés: descem e abrem para o lado, enterrados
					fora = Vector2(signf(u) * Wf, -2.2 - 6.0 * maxf(0.0, k - 1.0)) # bem enterrados na encosta
				else:
					rd = rd.normalized()
					var e := 1.0 / sqrt(pow(rd.x / Wf, 2.0) + pow(rd.y / Hf, 2.0)) # até a elipse de fora
					# borda irregular (sem cara de domo): lóbulos grandes e dentes de rocha
					var ang := atan2(rd.y, rd.x)
					e *= 1.0 + 0.22 * _ruido.get_noise_2d(ang * 2.2, 3.0) + 0.1 * _ruido.get_noise_2d(ang * 7.0, 11.0)
					fora = Vector2(rd.x, rd.y) * e + Vector2(0, cy)
				var dentro := Vector2(u, v)
				var kk := minf(k, 1.0)
				var pt := dentro.lerp(fora, kk) * (1.0 + 0.1 * maxf(0.0, k - 1.0))
				p = O + dir * pt.x + Vector3(0, pt.y - float(V[2]), 0) + d * float(V[1])
				p.y += float(a.get("incl", 0.0)) * -u * (1.0 - kk)
				# rocha irregular: bojos e lajes, mais fortes no meio da cara, nada no arco (o anel do túnel encosta)
				var r := _ruido.get_noise_3d(p.x * 0.5, p.y * 0.5, p.z * 0.5)
				var r2 := _ruido.get_noise_3d(p.x * 1.4 + 9.0, p.y * 1.4, p.z * 1.4)
				var forca := sin(PI * minf(kk, 1.0)) * 1.3 + (0.8 if k > 1.0 else 0.0)
				var laje := absf(_ruido.get_noise_3d(p.x * 0.8 - 20.0, p.y * 2.2, p.z * 0.8)) # camadas de rocha
				p -= d * (r * 0.7 + r2 * 0.3 + laje * 0.35) * forca
				p.y += r2 * 0.35 * forca
				p += dir * _ruido.get_noise_3d(p.x * 0.7 + 3.0, p.y * 0.7, p.z * 0.7) * 0.4 * forca
			vs.append(p)
			cs.append(Color(0, 0, 0))
	var frente := O - d * 25.0 + Vector3(0, 4, 0)
	for vi in voltas.size() - 1:
		for i in n - 1:
			var a0 := vi * n + i
			var b0 := (vi + 1) * n + i
			_tri(vs, idx, a0, a0 + 1, b0 + 1, frente)
			_tri(vs, idx, a0, b0 + 1, b0, frente)
	var mi := _malha(vs, cs, idx, "Paredao")
	if _mat_paredao == null:
		_mat_paredao = ShaderMaterial.new()
		_mat_paredao.shader = load("res://montanha.gdshader")
		_mat_paredao.set_shader_parameter("pedra_tex", load("res://relevo/rocky_terrain_02.jpg"))
		_mat_paredao.set_shader_parameter("grama_tex", load("res://relevo/brown_mud_leaves_01.jpg"))
		_mat_paredao.set_shader_parameter("alto", 4.0) # só rocha (sem a faixa de grama da montanha)
		_mat_paredao.set_shader_parameter("nitidez", 8.0)
	mi.material_override = _mat_paredao

var _mat_paredao: ShaderMaterial
# a montanha (relevo.gd, nó "Montanha") deixa de desenhar o que fica dentro do vão do arco, só enquanto a caverna está
# montada (de longe a boca fica tapada pela rocha e nada aparece furado)
func _corte_na_montanha(ligado: bool) -> void:
	var mt := get_tree().root.find_child("Montanha", true, false) if is_inside_tree() else null
	if mt == null or not (mt is MeshInstance3D) or not (mt.material_override is ShaderMaterial):
		return
	var mm: ShaderMaterial = mt.material_override
	var a: Dictionary = A[0]
	mm.set_shader_parameter("boca_on", 1.0 if ligado else 0.0)
	mm.set_shader_parameter("boca_o", Vector3(float(a.x), float(a.y), float(a.z)))
	mm.set_shader_parameter("boca_d", Vector2(float(a.dx), float(a.dz)))
	mm.set_shader_parameter("boca_w", Vector2(float(a.l) + folga, float(A[4].l) + folga))
	mm.set_shader_parameter("boca_h", Vector2(float(a.teto), float(A[4].teto)))
	mm.set_shader_parameter("boca_incl", float(a.get("incl", 0.0)))
	mm.set_shader_parameter("boca_fora", float(a.l) + folga + 3.8) # meia largura do paredão: faixa de cascalho no pé


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
	_pilares(T.porta, H - 0.4, 0.15, false)
	_luz(q.p + Vector3(0, 2.2, 0) - Vector3(float(q.dx), 0, float(q.dz)) * 1.0, Color(1.0, 0.62, 0.25), 7.0, 1.0)

func _enfeites() -> void:
	var dados: Dictionary = T.m.get("caverna", {})
	# tochas nas paredes, alternando os lados, do selo até o fundo
	var s: float = T.porta + 4.0
	var lado := 1.0
	while s < A[A.size() - 1].s - 2.0:
		var q := _ponto_s(s)
		_tocha(s, lado) # v2: a cada 9 m, nas salas também (no celular as laterais viravam preto puro)
		lado = -lado
		s += 9.0
	# salas: dois braseiros, cristais e pedras soltas encostadas nas paredes
	var i := 0
	for S in dados.get("salas", []):
		var c := _ponto_s(float(S.s))
		for ld in [-1.0, 1.0]:
			var b := _ponto_s(float(S.s) + ld * 3.0, ld * (float(c.l) - 1.4))
			_braseiro(b.p)
		for k in 4:
			var sk: float = float(S.s) + (k - 1.5) * float(S.r) * 0.5
			var ld2 := 1.0 if (k + i) % 2 == 0 else -1.0
			var cq := _ponto_s(sk, ld2 * (float(_ponto_s(sk).l) + folga - 0.2))
			_cristais(cq.p, 3 + (k % 3), i * 10 + k)
		if i == dados.get("salas", []).size() - 1: # sala do chefe: 2 cachos grandes (1,2 a 1,5 m), a peça de destaque
			for ld5 in [-1.0, 1.0]:
				var gq := _ponto_s(float(S.s) + 2.5 * ld5, ld5 * (float(_ponto_s(float(S.s)).l) + folga - 0.4))
				_cristais(gq.p, 5, 77 + int(ld5), 1.9)
		for k in 4:
			var sk: float = float(S.s) + (k - 1.5) * float(S.r) * 0.55
			var ld3 := -1.0 if (k + i) % 2 == 0 else 1.0
			var rq := _ponto_s(sk, ld3 * (float(_ponto_s(sk).l) - 0.2))
			_rocha(1 + (k + i) % 3, rq.p + Vector3(0, -0.15, 0), float(k) * 1.7, 0.9 + 0.25 * (k % 2))
		i += 1
	_cascalho()
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
	# v2: a luz fica 1 m para dentro da parede e mais fraca (estourava o laranja na rocha do lado)
	_luz(topo + para_dentro * 1.0, Color(1.0, 0.6, 0.28), 9.0, 1.1)

var _mat_ferro: StandardMaterial3D
var _mat_brasa: StandardMaterial3D
# braseiro (v2, direção de arte): bacia de ferro em cima de um tripé, com a boca a 1 m do chão e brasas dentro
func _braseiro(p: Vector3) -> void:
	if _mat_ferro == null:
		_mat_ferro = StandardMaterial3D.new()
		_mat_ferro.albedo_color = Color(0.2, 0.18, 0.17)
		_mat_ferro.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
		_mat_ferro.metallic = 0.6
		_mat_ferro.roughness = 0.55
		_mat_ferro.next_pass = _contorno_mat(CONTORNO)
		_mat_brasa = StandardMaterial3D.new()
		_mat_brasa.albedo_color = Color(0.25, 0.06, 0.02)
		_mat_brasa.emission_enabled = true
		_mat_brasa.emission = Color(1.0, 0.35, 0.08)
		_mat_brasa.emission_energy_multiplier = 2.2
	var no := Node3D.new()
	no.name = "Braseiro"
	add_child(no)
	no.position = p
	for k in 3: # pernas abertas, do chão até embaixo da bacia
		var an := TAU * float(k) / 3.0 + p.x
		var pe := Vector3(cos(an), 0, sin(an)) * 0.38
		var cima := Vector3(cos(an), 0, sin(an)) * 0.14 + Vector3(0, 0.84, 0)
		var perna := CylinderMesh.new()
		perna.top_radius = 0.03
		perna.bottom_radius = 0.04
		perna.height = pe.distance_to(cima)
		perna.radial_segments = 6
		perna.rings = 1
		var pm := MeshInstance3D.new()
		pm.mesh = perna
		pm.material_override = _mat_ferro
		no.add_child(pm)
		var eixo := (cima - pe).normalized()
		var lado := eixo.cross(Vector3.FORWARD if absf(eixo.z) < 0.9 else Vector3.RIGHT).normalized()
		pm.transform = Transform3D(Basis(lado, eixo, lado.cross(eixo)), (pe + cima) / 2.0)
	var anel := TorusMesh.new() # aro que amarra as pernas
	anel.inner_radius = 0.24
	anel.outer_radius = 0.28
	anel.rings = 12
	anel.ring_segments = 4
	var am := MeshInstance3D.new()
	am.mesh = anel
	am.material_override = _mat_ferro
	am.position = Vector3(0, 0.42, 0)
	no.add_child(am)
	var bacia := SphereMesh.new() # meia esfera de boca para cima
	bacia.radius = 0.42
	bacia.height = 0.42
	bacia.is_hemisphere = true
	bacia.radial_segments = 12
	bacia.rings = 4
	var bm := MeshInstance3D.new()
	bm.mesh = bacia
	bm.material_override = _mat_ferro
	bm.rotation.x = PI
	bm.position = Vector3(0, 1.0, 0)
	no.add_child(bm)
	var borda := TorusMesh.new()
	borda.inner_radius = 0.39
	borda.outer_radius = 0.46
	borda.rings = 16
	borda.ring_segments = 4
	var rm := MeshInstance3D.new()
	rm.mesh = borda
	rm.material_override = _mat_ferro
	rm.position = Vector3(0, 1.0, 0)
	no.add_child(rm)
	var brasa := CylinderMesh.new()
	brasa.top_radius = 0.37
	brasa.bottom_radius = 0.3
	brasa.height = 0.08
	brasa.radial_segments = 10
	var br := MeshInstance3D.new()
	br.mesh = brasa
	br.material_override = _mat_brasa
	br.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	br.position = Vector3(0, 0.95, 0)
	no.add_child(br)
	_chama(p + Vector3(0, 1.38, 0), 0.85, p.x)
	_chama(p + Vector3(0.12, 1.3, 0.08), 0.55, p.z)
	_luz(p + Vector3(0, 1.9, 0), Color(1.0, 0.55, 0.25), 12.0, 1.8)

var _mat_cristal: StandardMaterial3D
# cachos de cristal (v2): 3 a 5 pontas de 30 a 80 cm, ciano 5ee6ff aceso (energia 2,5), contorno e uma luz fraca de
# 3 m por cacho (só acende de perto)
func _cristais(p: Vector3, n: int, semente: int, tam := 1.0) -> void:
	if _mat_cristal == null:
		_mat_cristal = StandardMaterial3D.new()
		_mat_cristal.albedo_color = Color(0.1, 0.45, 0.6)
		_mat_cristal.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
		_mat_cristal.emission_enabled = true
		_mat_cristal.emission = Color("5ee6ff")
		_mat_cristal.emission_energy_multiplier = 2.0
		_mat_cristal.roughness = 0.25
		_mat_cristal.next_pass = _contorno_mat(CONTORNO)
	var rng := RandomNumberGenerator.new()
	rng.seed = 900 + semente
	for i in n:
		var c := CylinderMesh.new()
		c.top_radius = 0.0
		c.height = rng.randf_range(1.2, 1.5) if (tam > 1.0 and i < 2) else rng.randf_range(0.3, 0.8)
		c.bottom_radius = c.height * rng.randf_range(0.16, 0.22)
		c.radial_segments = 6
		c.rings = 1
		var mi := MeshInstance3D.new()
		mi.mesh = c
		mi.material_override = _mat_cristal
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)
		var an := TAU * float(i) / float(n) + rng.randf() * 0.6
		var ab := 0.0 if i == 0 else rng.randf_range(0.35, 0.6) # a do meio em pé, as outras abertas em leque
		mi.position = p + Vector3(cos(an), 0, sin(an)) * (0.0 if i == 0 else 0.12 * tam) + Vector3(0, c.height * 0.42, 0)
		mi.rotation = Vector3(0, -an, 0)
		mi.rotate_object_local(Vector3.FORWARD, -ab)
	_luz(p + Vector3(0, 0.7 * tam, 0), Color("5ee6ff"), 3.0 * sqrt(tam), 0.6 * tam)
	_luzes[_luzes.size() - 1].longe = 18.0

# ---------- v2 da direção de arte: contorno, pilares, rochas e cascalho ----------
var _contornos := {}
func _contorno_mat(metros: float) -> StandardMaterial3D:
	var k := snappedf(metros, 0.0001)
	if not _contornos.has(k):
		var c := StandardMaterial3D.new()
		c.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		c.cull_mode = BaseMaterial3D.CULL_FRONT
		c.grow = true
		c.grow_amount = k
		c.albedo_color = Color(0.1, 0.07, 0.06)
		_contornos[k] = c
	return _contornos[k]

func _bloco(pai: Node3D, mesh: Mesh, pos: Vector3, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat_pedra
	mi.position = pos
	mi.rotation = rot
	pai.add_child(mi)
	return mi

# dois pilares grossos de pedra lavrada (base, fuste de 45 cm de raio, capitel) em s, encostados nas paredes, e um
# lintel por cima quando com_lintel. alto = altura do fuste.
func _pilares(s: float, alto: float, recuo: float, com_lintel: bool) -> void:
	var q := _ponto_s(maxf(s, 0.0))
	var W: float = float(q.l) + folga + recuo
	var no := Node3D.new()
	no.name = "Pilares%d" % int(s)
	add_child(no)
	no.position = q.p + Vector3(float(q.dx), 0, float(q.dz)) * minf(s, 0.0) # s < 0: na frente da boca
	no.rotation.y = atan2(float(q.dx), float(q.dz))
	var fuste := CylinderMesh.new()
	fuste.top_radius = 0.42
	fuste.bottom_radius = 0.48
	fuste.height = alto
	fuste.radial_segments = 8
	fuste.rings = 2
	var base := BoxMesh.new()
	base.size = Vector3(1.15, 0.45, 1.15)
	var capitel := BoxMesh.new()
	capitel.size = Vector3(1.1, 0.35, 1.1)
	for lado in [-1.0, 1.0]:
		var x: float = lado * W
		var pe: Vector3 = no.position + Basis(Vector3.UP, no.rotation.y) * Vector3(x, 0, 0)
		var chao: float = (T.altura(pe.x, pe.z, q.p.y + 0.5) if s < 0.0 else float(_ponto_s(s, -x).p.y)) - float(q.p.y)
		_bloco(no, base, Vector3(x, chao + 0.1, 0), Vector3(0, 0.1 * lado, 0))
		_bloco(no, fuste, Vector3(x, chao + 0.3 + alto / 2.0, 0), Vector3(0, PI / 8.0, 0))
		_bloco(no, capitel, Vector3(x, chao + 0.3 + alto + 0.12, 0), Vector3(0, -0.08 * lado, 0))
	if com_lintel:
		var lin := BoxMesh.new()
		lin.size = Vector3(W * 2.0 + 1.6, 0.7, 1.0)
		_bloco(no, lin, Vector3(0, 0.3 + alto + 0.62, 0), Vector3(0, 0, 0.03))

# a boca (v2): 2 pilares com lintel logo na entrada (leitura de dungeon de longe) e 6 rochas grandes e irregulares
# em volta do arco tapando a emenda com o paredão
func _portal_da_boca() -> void:
	var a: Dictionary = A[0]
	_pilares(-0.5, float(a.teto) - 0.7, 0.15, true)
	var q := _ponto_s(0.4)
	var W: float = float(q.l) + folga
	var H: float = float(a.teto)
	# rochas grandes em cima da borda do paredão (quebram o contorno e casam com a montanha)
	var O := Vector3(float(A[0].x), float(A[0].y), float(A[0].z))
	var dd := Vector3(float(A[0].dx), 0, float(A[0].dz))
	var dr := Vector3(float(A[0].dz), 0, -float(A[0].dx))
	var lugares := [[0.15, 1.5, 0.0], [0.55, 1.25, 1.3], [1.0, 1.45, 2.1], [1.6, 1.3, 3.4], [2.05, 1.55, 4.2], [2.6, 1.2, 5.0], [2.95, 1.4, 0.7]]
	for L in lugares:
		var an: float = L[0]
		var p := O + dr * cos(an) * (W + 3.6) + Vector3(0, (H * 0.35 + 5.6) * sin(an) - 0.4, 0) + dd * 0.6
		var ro := _rocha(1 + int(an * 3.0) % 3, p, float(L[2]), float(L[1]) * 0.8)
		if ro and _mat_paredao: # a mesma pedra do paredão e da montanha: uma rocha só
			ro.material_override = _mat_paredao
	var pq := _ponto_s(0.0, -(W + 0.9))
	pq.p -= dd * 1.6
	_rocha(2, Vector3(pq.p.x, T.altura(pq.p.x, pq.p.z) - 0.2, pq.p.z), 5.0, 0.6)
	# pé do paredão: pedras pequenas (20 a 50 cm) fazendo a passagem para a encosta (a faixa de cascalho é do
	# montanha.gdshader, boca_fora)
	var rng := RandomNumberGenerator.new()
	rng.seed = 5150
	for i in 9:
		var lado := -1.0 if i % 2 == 0 else 1.0
		var u := lado * rng.randf_range(W + 0.9, W + 4.2)
		var w := rng.randf_range(-1.4, 0.2)
		var pp := O + dr * u + dd * w
		var e := rng.randf_range(0.2, 0.5)
		var ro := _rocha(1 + i % 3, Vector3(pp.x, T.altura(pp.x, pp.z) - e * 0.25, pp.z), rng.randf() * TAU, e)
		if ro and _mat_paredao:
			ro.material_override = _mat_paredao

var _rochas := {}
func _malha_rocha(n: int) -> Mesh:
	if not _rochas.has(n):
		var cena = load("res://cenario3d/rocha%d.glb" % n)
		var mesh: Mesh = null
		if cena:
			var no: Node = cena.instantiate()
			var mis := no.find_children("*", "MeshInstance3D", true, false)
			if not mis.is_empty():
				mesh = (mis[0] as MeshInstance3D).mesh
			no.free()
		_rochas[n] = mesh
	return _rochas[n]

# rocha solta com a pedra da caverna (toon, textura nos 3 eixos e contorno), em vez do bloco liso do modelo
func _rocha(n: int, p: Vector3, ry: float, esc: float) -> MeshInstance3D:
	var mesh := _malha_rocha(n)
	if mesh == null:
		return null
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat_pedra
	add_child(mi)
	mi.position = p
	mi.rotation = Vector3(0.15 * sin(ry * 3.0), ry, 0.12 * cos(ry * 2.0))
	mi.scale = Vector3(1.0, 0.8 + 0.25 * absf(sin(ry * 5.0)), 1.0) * esc
	return mi

# cascalho e pedras nas paredes (v2): seixos soltos pelo chão perto das paredes e pedras maiores encostadas, tudo em
# 2 MultiMesh (2 chamadas de desenho para o túnel todo)
func _cascalho() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 2611
	var fim: float = float(A[A.size() - 1].s) - 1.0
	for tipo in 2:
		var mesh := _malha_rocha(1 + tipo)
		if mesh == null:
			continue
		var tr := []
		var s: float = 1.0 if tipo == 0 else T.porta + 2.0
		while s < fim:
			var lado := 1.0 if rng.randf() < 0.5 else -1.0
			var q := _ponto_s(s)
			var u: float = lado * (float(q.l) + folga - (rng.randf_range(0.1, 0.6) if tipo == 0 else 0.05))
			var pq := _ponto_s(s, u)
			var e: float = rng.randf_range(0.12, 0.28) if tipo == 0 else rng.randf_range(0.5, 0.85)
			var b := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(e, e * rng.randf_range(0.6, 1.0), e))
			tr.append(Transform3D(b, pq.p + Vector3(0, -0.04 if tipo == 0 else -0.2, 0)))
			s += rng.randf_range(0.6, 1.4) if tipo == 0 else rng.randf_range(3.0, 5.5)
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = mesh
		mm.instance_count = tr.size()
		for i in tr.size():
			mm.set_instance_transform(i, tr[i])
		var mmi := MultiMeshInstance3D.new()
		mmi.name = "Cascalho%d" % tipo
		mmi.multimesh = mm
		mmi.material_override = mat_pedra
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF if tipo == 0 else GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		add_child(mmi)

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
		_amb_cor0 = _env.ambient_light_color
		_amb_ceu0 = _env.ambient_light_sky_contribution
		_sol0 = m.sol.light_energy
		_nevoa0 = _env.fog_light_color
	escuro = move_toward(escuro, alvo, dt * 0.6) # os olhos se acostumam
	var fora: Dictionary = m.dia.base() if m.get("dia") != null else {}
	if not fora.is_empty(): # dia e noite (dia_noite.gd): a luz de fora muda com a hora, então lê ela agora
		_amb0 = fora.amb_e
		_amb_cor0 = fora.amb
		_sol0 = fora.sol_e
		_nevoa0 = fora.nevoa
	# v2 (direção de arte): lá dentro a luz de fundo é azul-escura 1a2030 (brilho mínimo ~0,08), para as laterais não
	# virarem preto puro no celular
	_env.ambient_light_color = _amb_cor0.lerp(Color("1a2030"), escuro)
	_env.ambient_light_sky_contribution = lerpf(_amb_ceu0, 0.0, escuro)
	_env.ambient_light_energy = lerpf(_amb0, 1.6, escuro)
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

extends Control
# Mapa-múndi 3D (André 2026-11-15, inspirado no mapa do Albion): o mundo inteiro como uma maquete low poly que a
# câmera sobrevoa. Arrastar anda, pinça (ou roda do mouse) aproxima, tocar no chão marca o lugar e mostra o "Ir para".
# No canto, o mapinha do mundo inteiro com o quadrado vermelho do que a câmera mostra. O mapa 2D de hoje continua: o
# botão "Mapa 2D" troca (minimapa.gd guarda a escolha).
# Peso: a maquete é montada uma vez (numa linha de fundo, ~0,6 s no PC) e fica num mundo 3D só dela (SubViewport).
# Com o mapa aberto, o mundo do jogo para de ser desenhado (root.disable_3d), então só a maquete custa.

const PASSO := 2 # pontos da grade de 4 m por faceta (8 m)
const EXAG := 1.6 # relevo um pouco exagerado para aparecer de longe
const UMA_ARVORE_EM := 9 # do mata do mundo, 1 a cada 9 vira árvore grande (o Albion usa poucas e grandes)
const DIST_MIN := 120.0
const DIST_MAX := 2100.0
const DIST_ABRIR := 330.0
const INCL := 48.0 # graus da câmera acima do chão
const COR_OURO := Color("c9a35a")

var mm # minimapa.gd
var m # main.gd
var fonte: Font
var sv: SubViewport
var mundo3d: Node3D
var cam: Camera3D
var mini_sv: SubViewport
var mini_tex: TextureRect
var marcas: Control
var pronto := false
var _tarefa := -1
var _dados: Dictionary = {}
var _t_abriu := 0

var foco := Vector3.ZERO
var foco_alvo := Vector3.ZERO
var dist := DIST_ABRIR
var dist_alvo := DIST_ABRIR
var toques := {}
var arrastou := false
var pinca := {}

var g: Dictionary # terreno.mundo_g
var nx := 0
var nz := 0
var hh: PackedFloat32Array
var X0 := 0.0
var Z0 := 0.0
var ATE := Vector2.ZERO # fim do mundo em metros (x, z)

var b_x := Rect2()
var b_2d := Rect2()
var b_mais := Rect2()
var b_menos := Rect2()
var b_eu := Rect2()
var b_ir := Rect2()

func _init(minimapa) -> void:
	mm = minimapa
	m = minimapa.m
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	visible = false

func _ready() -> void:
	fonte = load("res://fontes/AlegreyaSans-Bold.ttf")
	var fundo := ColorRect.new()
	fundo.color = Color8(24, 46, 66)
	fundo.set_anchors_preset(Control.PRESET_FULL_RECT)
	fundo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(fundo)
	var cont := SubViewportContainer.new()
	cont.set_anchors_preset(Control.PRESET_FULL_RECT)
	cont.stretch = true
	cont.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(cont)
	sv = SubViewport.new()
	sv.own_world_3d = true
	sv.transparent_bg = false
	sv.render_target_update_mode = SubViewport.UPDATE_DISABLED
	cont.add_child(sv)
	marcas = Control.new()
	marcas.set_anchors_preset(Control.PRESET_FULL_RECT)
	marcas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	marcas.draw.connect(_desenhar)
	add_child(marcas)
	g = m.terreno.mundo_g if m.terreno != null else {}

# ---------- abrir e fechar ----------

func disponivel() -> bool:
	return not g.is_empty()

func abrir() -> void:
	_t_abriu = Time.get_ticks_usec()
	visible = true
	toques = {}
	pinca = {}
	var hp: Vector3 = m.heroi.position if m.heroi != null else Vector3.ZERO
	foco_alvo = Vector3(hp.x, 0, hp.z)
	foco = foco_alvo
	dist = DIST_ABRIR
	dist_alvo = DIST_ABRIR
	get_viewport().disable_3d = true # o mundo do jogo não é desenhado atrás do mapa
	if pronto:
		_ligar()
	elif _tarefa < 0:
		_tarefa = WorkerThreadPool.add_task(_montar_dados, false, "mapa3d")
	marcas.queue_redraw()

func fechar() -> void:
	if not visible:
		return
	visible = false
	get_viewport().disable_3d = false
	if sv != null:
		sv.render_target_update_mode = SubViewport.UPDATE_DISABLED

func _ligar() -> void:
	sv.render_target_update_mode = SubViewport.UPDATE_WHEN_VISIBLE
	_camera()
	if m.lentidao and _t_abriu > 0: # quanto o mapa 3D levou para abrir (lentidao.gd, tipo "menu")
		m.lentidao.menu_aberto("mapa3d", _t_abriu, 0)
		_t_abriu = 0

func _process(dt: float) -> void:
	if not visible:
		return
	if not pronto:
		if _tarefa >= 0 and WorkerThreadPool.is_task_completed(_tarefa):
			WorkerThreadPool.wait_for_task_completion(_tarefa)
			_tarefa = -1
			_montar_cena()
			pronto = true
			_ligar()
		marcas.queue_redraw()
		return
	var a: float = 1.0 - exp(-12.0 * dt)
	dist = lerpf(dist, dist_alvo, a)
	foco = foco.lerp(foco_alvo, a)
	_camera()
	marcas.queue_redraw()

func _camera() -> void:
	if cam == null:
		return
	foco.x = clampf(foco.x, X0, ATE.x)
	foco.z = clampf(foco.z, Z0, ATE.y)
	var f := Vector3(foco.x, alt(foco.x, foco.z) * 0.5, foco.z)
	var p := deg_to_rad(INCL + (dist - DIST_MIN) / (DIST_MAX - DIST_MIN) * 10.0) # de longe, um pouco mais de cima
	cam.look_at_from_position(f + Vector3(0, sin(p), cos(p)) * dist, f, Vector3.UP)

# ---------- montagem (linha de fundo: só contas; a cena é criada na linha principal) ----------

func alt(x: float, z: float) -> float:
	if nx == 0:
		return 0.0
	var fi := clampf((x - X0) / 4.0, 0.0, nx - 1.001)
	var fj := clampf((z - Z0) / 4.0, 0.0, nz - 1.001)
	var i := int(fi)
	var j := int(fj)
	var a := fi - i
	var b := fj - j
	var v := lerpf(lerpf(hh[j * nx + i], hh[j * nx + i + 1], a), lerpf(hh[(j + 1) * nx + i], hh[(j + 1) * nx + i + 1], a), b)
	return _y(v)

static func _y(v: float) -> float:
	if v < 0.0:
		return v * 0.6 - 1.0
	return 0.8 + (v if v < 25.0 else 25.0 + (v - 25.0) * 0.45) * EXAG

func _montar_dados() -> void:
	nx = int(g.nx)
	nz = int(g.nz)
	X0 = float(g.x0)
	Z0 = float(g.z0)
	ATE = Vector2(X0 + (nx - 1) * 4.0, Z0 + (nz - 1) * 4.0)
	hh = (g.h as PackedFloat32Array).duplicate()
	# a montanha do mapa de hoje (grade própria, mais fina)
	var gm = m.mundo.get("montanha_grade")
	if gm != null:
		var n := int(gm.n)
		var ps := float(gm.passo)
		for b in n:
			for a in n:
				var i := int(round((float(gm.x0) + a * ps - X0) / 4.0))
				var j := int(round((float(gm.z0) + b * ps - Z0) / 4.0))
				if i >= 0 and j >= 0 and i < nx and j < nz:
					hh[j * nx + i] = maxf(hh[j * nx + i], float(gm.h[b * n + a]))
	# praia: só a areia perto do mar (o chão plano do mapa de hoje também é baixo)
	var praia := PackedByteArray()
	praia.resize(nx * nz)
	for j in nz:
		for i in nx:
			if hh[j * nx + i] < 0.0:
				for b in range(maxi(0, j - 2), mini(nz, j + 3)):
					for a in range(maxi(0, i - 2), mini(nx, i + 3)):
						praia[b * nx + a] = 1
	# densidade da mata em quadrados de 8 m (chão mais escuro embaixo da mata)
	var w := nx / PASSO + 1
	var hq := nz / PASSO + 1
	var dens := PackedFloat32Array()
	dens.resize(w * hq)
	var arvores := []
	var k := 0
	for a in m.mundo.get("mata", []):
		var i := int((float(a.x) - X0) / (4.0 * PASSO))
		var j := int((float(a.z) - Z0) / (4.0 * PASSO))
		for dj in range(-1, 2):
			for di in range(-1, 2):
				var ii := i + di
				var jj := j + dj
				if ii >= 0 and jj >= 0 and ii < w and jj < hq:
					dens[jj * w + ii] += 0.35 if (di == 0 and dj == 0) else 0.12
		k += 1
		if k % UMA_ARVORE_EM == 0:
			arvores.append(Vector2(float(a.x), float(a.z)))
	# terreno: facetas planas (low poly), cor por vértice
	var V := PackedVector3Array()
	var N := PackedVector3Array()
	var C := PackedColorArray()
	for j in range(0, nz - PASSO, PASSO):
		for i in range(0, nx - PASSO, PASSO):
			var P: Array[Vector3] = [_ponto(i, j), _ponto(i + PASSO, j), _ponto(i + PASSO, j + PASSO), _ponto(i, j + PASSO)]
			var tris: Array = [[0, 1, 2], [0, 2, 3]] if (i / PASSO + j / PASSO) % 2 == 0 else [[0, 1, 3], [1, 2, 3]]
			for t in tris:
				var a3: Vector3 = P[t[0]]
				var b3: Vector3 = P[t[1]]
				var c3: Vector3 = P[t[2]]
				var nn := (c3 - a3).cross(b3 - a3).normalized()
				var cx := (a3 + b3 + c3) / 3.0
				var ci := clampi(int((cx.x - X0) / 4.0), 0, nx - 1)
				var cj := clampi(int((cx.z - Z0) / 4.0), 0, nz - 1)
				var v0: float = hh[cj * nx + ci]
				var incl := sqrt(maxf(0.0, 1.0 - nn.y * nn.y)) / maxf(nn.y, 0.05)
				var cor := _cor(v0, incl, dens[mini(cj / PASSO, hq - 1) * w + mini(ci / PASSO, w - 1)], praia[cj * nx + ci] == 1)
				for v in [a3, b3, c3]:
					V.append(v)
					N.append(nn)
					C.append(cor)
	_dados = {"V": V, "N": N, "C": C, "arvores": arvores}

func _ponto(i: int, j: int) -> Vector3:
	return Vector3(X0 + i * 4.0, _y(hh[j * nx + i]), Z0 + j * 4.0)

static func _cor(v: float, incl: float, mata: float, praia: bool) -> Color:
	if v < 0.0:
		return Color8(196, 186, 140).lerp(Color8(40, 70, 90), clampf(-v / 6.0, 0.0, 1.0))
	var c := Color8(112, 118, 52) # grama oliva
	c = c.lerp(Color8(78, 98, 44), clampf(mata, 0.0, 1.0) * 0.85)
	c = c.lerp(Color8(134, 126, 80), clampf((v - 30.0) / 40.0, 0.0, 1.0) * 0.5)
	if v < 1.4 and praia:
		c = c.lerp(Color8(190, 172, 122), clampf(1.0 - v / 1.4, 0.0, 1.0))
	c = c.lerp(Color8(112, 104, 94), clampf((incl - 0.55) * 2.5, 0.0, 1.0)) # pedra nas encostas
	c = c.lerp(Color8(220, 224, 232), clampf((v - 95.0) / 20.0, 0.0, 1.0)) # neve nos picos
	return c

func _mat(srgb := true) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.vertex_color_is_srgb = srgb
	mat.roughness = 1.0
	return mat

func _montar_cena() -> void:
	mundo3d = Node3D.new()
	sv.add_child(mundo3d)
	var baixa: bool = m.grafico != null and int(m.grafico.nivel) == 0
	var sol := DirectionalLight3D.new()
	sol.rotation_degrees = Vector3(-48, -140, 0)
	sol.light_color = Color(1.0, 0.95, 0.85)
	sol.light_energy = 0.9
	sol.shadow_enabled = not baixa
	sol.directional_shadow_max_distance = 900
	mundo3d.add_child(sol)
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color8(24, 46, 66)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color8(150, 165, 190)
	env.ambient_light_energy = 0.5
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	we.environment = env
	mundo3d.add_child(we)
	cam = Camera3D.new()
	cam.fov = 42
	cam.near = 4.0
	cam.far = 4500.0
	mundo3d.add_child(cam)
	cam.current = true
	# terreno
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = _dados.V
	arr[Mesh.ARRAY_NORMAL] = _dados.N
	arr[Mesh.ARRAY_COLOR] = _dados.C
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	var ter := MeshInstance3D.new()
	ter.mesh = am
	ter.material_override = _mat()
	mundo3d.add_child(ter)
	# mar
	var pm := PlaneMesh.new()
	pm.size = Vector2(7000, 7000)
	var mar := MeshInstance3D.new()
	mar.mesh = pm
	mar.position = Vector3((X0 + ATE.x) * 0.5, -0.3, (Z0 + ATE.y) * 0.5)
	var mt := StandardMaterial3D.new()
	mt.albedo_color = Color(0.10, 0.30, 0.45, 0.80)
	mt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mt.roughness = 0.7
	mt.metallic_specular = 0.2
	mar.material_override = mt
	mar.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mundo3d.add_child(mar)
	# rios e estradas (fitas por cima do chão, todas numa malha só)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for r in g.get("rios", []):
		_fita(st, r.curva, 14.0, Color8(36, 70, 90), 5.0)
		_fita(st, r.curva, 9.0, Color8(54, 104, 130), 5.3)
	for e in g.get("estradas", []):
		_fita(st, e.curva, 3.5 if str(e.id).begins_with("t_") else 5.5, Color8(128, 96, 62), 2.2)
	var fitas := MeshInstance3D.new()
	fitas.mesh = st.commit()
	var mf := _mat()
	mf.cull_mode = BaseMaterial3D.CULL_DISABLED
	fitas.material_override = mf
	fitas.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mundo3d.add_child(fitas)
	_mata(_dados.arvores)
	_vilas()
	_dados = {}
	# mapinha do mundo inteiro: câmera de cima, desenhado uma vez só
	mini_sv = SubViewport.new()
	mini_sv.world_3d = sv.find_world_3d()
	mini_sv.size = Vector2i(240, int(240.0 * (ATE.y - Z0) / (ATE.x - X0)))
	mini_sv.render_target_update_mode = SubViewport.UPDATE_ONCE
	add_child(mini_sv)
	var mc := Camera3D.new()
	mc.projection = Camera3D.PROJECTION_ORTHOGONAL
	mc.size = ATE.y - Z0
	mc.far = 3000
	mc.position = Vector3((X0 + ATE.x) * 0.5, 1200, (Z0 + ATE.y) * 0.5)
	mc.rotation_degrees = Vector3(-90, 0, 0)
	mini_sv.add_child(mc)
	mc.current = true
	cam.make_current()

func _fita(st: SurfaceTool, curva: Array, largura: float, cor: Color, sobe: float) -> void:
	var pts: Array[Vector3] = []
	for p in curva:
		var x := float(p[0])
		var z := float(p[1])
		pts.append(Vector3(x, alt(x, z) + sobe, z))
	for k in range(pts.size() - 1):
		var d := pts[k + 1] - pts[k]
		d.y = 0.0
		if d.length() < 0.01:
			continue
		var s := Vector3(-d.z, 0.0, d.x).normalized() * largura * 0.5
		st.set_color(cor)
		st.set_normal(Vector3.UP)
		for v in [pts[k] - s, pts[k] + s, pts[k + 1] + s, pts[k] - s, pts[k + 1] + s, pts[k + 1] - s]:
			st.add_vertex(v)

func _mata(lista: Array) -> void:
	var pinheiro := CylinderMesh.new()
	pinheiro.top_radius = 0.0
	pinheiro.bottom_radius = 3.2
	pinheiro.height = 11.0
	pinheiro.radial_segments = 6
	pinheiro.rings = 1
	var copa := SphereMesh.new()
	copa.radius = 4.2
	copa.height = 7.0
	copa.radial_segments = 7
	copa.rings = 4
	var tronco := CylinderMesh.new()
	tronco.top_radius = 0.5
	tronco.bottom_radius = 0.7
	tronco.height = 4.0
	tronco.radial_segments = 5
	tronco.rings = 1
	var redondas := []
	var pontudas := []
	for p in lista:
		(redondas if int(absf(p.x * 13.0 + p.y * 7.0)) % 3 == 0 else pontudas).append(p)
	_multi(pinheiro, pontudas, 7.5, Color8(40, 72, 42))
	_multi(copa, redondas, 6.0, Color8(92, 116, 44))
	_multi(tronco, lista, 2.0, Color8(80, 56, 36))

func _multi(mesh: Mesh, lista: Array, sobe: float, cor: Color) -> void:
	var mmu := MultiMesh.new()
	mmu.transform_format = MultiMesh.TRANSFORM_3D
	mmu.use_colors = true
	mmu.mesh = mesh
	mmu.instance_count = lista.size()
	for n in lista.size():
		var p: Vector2 = lista[n]
		var s := 0.8 + fmod(absf(p.x * 7.3 + p.y * 3.1), 0.6)
		mmu.set_instance_transform(n, Transform3D(Basis().scaled(Vector3(s, s, s)), Vector3(p.x, alt(p.x, p.y) + sobe * s, p.y)))
		mmu.set_instance_color(n, cor.lightened(fmod(absf(p.x + p.y), 1.0) * 0.12))
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mmu
	mi.material_override = _mat()
	mundo3d.add_child(mi)

func _vilas() -> void:
	var casas := [] # [x, z, ry, cor do telhado]
	for v in m.mundo.get("vilasMundo", []):
		for c in v.get("casas", []):
			casas.append([float(c.x), float(c.z), float(c.get("ry", 0.0)), Color8(170, 66, 50)])
	# as vilas do mapa de hoje: algumas casinhas de telhado azul onde elas ficam
	var nasc: Dictionary = m.mundo.get("nascimento", {"x": 0.0, "z": 1.0})
	var vl: Dictionary = m.mundo.get("vilaLotes", {})
	for centro in [Vector2(float(nasc.get("x", 0.0)), float(nasc.get("z", 1.0))), Vector2(float(vl.get("x", -13.5)), float(vl.get("z", 88.0)))]:
		for a in [[0, -10, 0.3], [10, 4, -0.5], [-9, 8, 1.2], [3, 14, 0.1]]:
			casas.append([centro.x + a[0], centro.y + a[1], a[2], Color8(70, 90, 150)])
	var parede := BoxMesh.new()
	parede.size = Vector3(6, 4, 8) * 1.3
	var telhado := PrismMesh.new()
	telhado.size = Vector3(7.2, 3.5, 8.8) * 1.3
	for parte in 2:
		var mmu := MultiMesh.new()
		mmu.transform_format = MultiMesh.TRANSFORM_3D
		mmu.use_colors = true
		mmu.mesh = parede if parte == 0 else telhado
		mmu.instance_count = casas.size()
		for n in casas.size():
			var c: Array = casas[n]
			var y := alt(c[0], c[1]) + (2.6 if parte == 0 else 7.4)
			mmu.set_instance_transform(n, Transform3D(Basis(Vector3.UP, c[2]), Vector3(c[0], y, c[1])))
			mmu.set_instance_color(n, Color8(222, 206, 170) if parte == 0 else c[3])
		var mi := MultiMeshInstance3D.new()
		mi.multimesh = mmu
		mi.material_override = _mat()
		mundo3d.add_child(mi)

# ---------- toque ----------

func entrada(ev: InputEvent) -> void:
	if ev is InputEventMouseButton and ev.pressed and (ev.button_index == MOUSE_BUTTON_WHEEL_UP or ev.button_index == MOUSE_BUTTON_WHEEL_DOWN):
		dist_alvo = clampf(dist_alvo * (1.0 / 1.15 if ev.button_index == MOUSE_BUTTON_WHEEL_UP else 1.15), DIST_MIN, DIST_MAX)
		return
	if ev is InputEventScreenTouch:
		if ev.pressed:
			if toques.is_empty():
				arrastou = false
			toques[ev.index] = {"p": ev.position, "ini": ev.position}
			if toques.size() == 2:
				var ks: Array = toques.keys()
				pinca = {"d": (toques[ks[0]].p as Vector2).distance_to(toques[ks[1]].p), "dist": dist}
			return
		var t = toques.get(ev.index)
		toques.erase(ev.index)
		if mm.ignorar.has(ev.index): # o toque que abriu o mapa
			mm.ignorar.erase(ev.index)
			return
		if toques.size() < 2:
			pinca = {}
		if t != null and not arrastou and toques.is_empty():
			_toque(ev.position)
		return
	if ev is InputEventScreenDrag:
		if not toques.has(ev.index) or mm.ignorar.has(ev.index):
			return
		var td: Dictionary = toques[ev.index]
		td.p = ev.position
		if toques.size() >= 2 and not pinca.is_empty():
			var ks: Array = toques.keys()
			var d := (toques[ks[0]].p as Vector2).distance_to(toques[ks[1]].p)
			dist = clampf(float(pinca.dist) * float(pinca.d) / maxf(d, 1.0), DIST_MIN, DIST_MAX)
			dist_alvo = dist
			arrastou = true
			return
		if not arrastou and ev.position.distance_to(td.ini) > 12.0:
			arrastou = true
		if arrastou and cam != null:
			# metros por px no meio da tela, mais ou menos: anda o mapa junto com o dedo
			var k: float = dist * tan(deg_to_rad(cam.fov * 0.5)) * 2.0 / maxf(size.y, 1.0)
			foco_alvo -= Vector3(ev.relative.x * k, 0.0, ev.relative.y * k / sin(deg_to_rad(INCL)))
			foco_alvo.x = clampf(foco_alvo.x, X0, ATE.x)
			foco_alvo.z = clampf(foco_alvo.z, Z0, ATE.y)
			foco = foco_alvo

func _toque(pos: Vector2) -> void:
	var lp := pos - get_global_rect().position
	if b_x.has_point(lp):
		mm.fechar()
		return
	if b_2d.has_point(lp):
		mm.trocar_modo(false)
		return
	if mm.marcado != null and b_ir.has_point(lp):
		mm._ir()
		return
	if b_mais.has_point(lp) or b_menos.has_point(lp):
		dist_alvo = clampf(dist_alvo * (1.0 / 1.45 if b_mais.has_point(lp) else 1.45), DIST_MIN, DIST_MAX)
		if m.sons:
			m.sons.tocar("pano", -16.0)
		return
	if b_eu.has_point(lp) and m.heroi != null:
		foco_alvo = Vector3(m.heroi.position.x, 0, m.heroi.position.z)
		dist_alvo = DIST_ABRIR
		return
	if not pronto or m.rota == null:
		return
	var w = _no_chao(lp)
	if w != null:
		mm._marcar(w)
		mm.selecionado = ""

# ponto do chão embaixo do dedo: anda pelo raio da câmera até passar do relevo
func _no_chao(lp: Vector2):
	var o := cam.project_ray_origin(lp)
	var d := cam.project_ray_normal(lp)
	if d.y >= -0.01:
		return null
	var t := 0.0
	var passo := 6.0
	while t < 6000.0:
		var p := o + d * t
		if p.y <= alt(p.x, p.z):
			if p.x < X0 or p.x > ATE.x or p.z < Z0 or p.z > ATE.y:
				return null
			return Vector2(p.x, p.z)
		t += passo
	return null

# ---------- desenho por cima (nomes, herói, pino, botões, mapinha) ----------

func _na_tela(x: float, z: float, sobe := 0.0):
	var p := Vector3(x, alt(x, z) + sobe, z)
	if cam.is_position_behind(p):
		return null
	return cam.unproject_position(p)

func _desenhar() -> void:
	var c := marcas
	var tam := size
	if not pronto:
		c.draw_string(fonte, tam * 0.5 + Vector2(-120, 0), "Montando o mapa…", HORIZONTAL_ALIGNMENT_CENTER, 240, 22, Color8(250, 232, 190))
		_botoes(c, tam)
		return
	var perto := dist < 900.0
	# rota planejada e pino
	if mm.marcado != null and mm.previa.size() > 1:
		var ant = null
		for q in mm.previa:
			var s = _na_tela(q.x, q.y, 3.0)
			if s != null and ant != null:
				c.draw_line(ant, s, Color(0.05, 0.04, 0.03, 0.6), 5.0, true)
				c.draw_line(ant, s, Color("ffd27a"), 3.0, true)
			ant = s
	for l in mm._lugares():
		var tipo := str(l.get("tipo", ""))
		if tipo != "vila" and tipo != "casa" and tipo != "caverna" and tipo != "totem":
			continue
		var s = _na_tela(float(l.x), float(l.z), 8.0)
		if s == null or s.x < -60 or s.y < -30 or s.x > tam.x + 60 or s.y > tam.y + 30:
			continue
		if tipo == "caverna":
			c.draw_colored_polygon(PackedVector2Array([s + Vector2(-9, 7), s + Vector2(0, -10), s + Vector2(9, 7)]), Color8(240, 120, 90))
		elif tipo == "totem":
			c.draw_circle(s, 6.0, Color8(120, 200, 255))
			c.draw_arc(s, 6.0, 0, TAU, 16, Color(0, 0, 0, 0.7), 1.5, true)
		else:
			_fita2d(c, s - Vector2(0, 20), str(l.get("curto", l.get("nome", ""))), 17 if perto else 13, l)
	for v in m.mundo.get("vilasMundo", []): # as vilas do mundo grande (com o nível)
		var s = _na_tela(float(v.x), float(v.z), 8.0)
		if s == null or s.x < -60 or s.y < -30 or s.x > tam.x + 60 or s.y > tam.y + 30:
			continue
		_fita2d(c, s - Vector2(0, 20), str(v.nome), 17 if perto else 13, {"nivel": int(v.get("nivel", 0))})
	if mm.marcado != null:
		var sm = _na_tela(mm.marcado.x, mm.marcado.y, 2.0)
		if sm != null:
			mm._pino(c, sm, 1.15)
	# herói
	if m.heroi != null:
		var hp: Vector3 = m.heroi.position
		var sh = _na_tela(hp.x, hp.z, 3.0)
		if sh != null:
			c.draw_circle(sh, 13.0, Color(1, 0.85, 0.4, 0.22))
			mm._seta(c, sh, mm._frente_heroi() * Vector2(1, sin(deg_to_rad(INCL))), 11.0, COR_OURO)
	_mapinha(c, tam)
	_botoes(c, tam)

func _fita2d(c: Control, centro: Vector2, txt: String, tam: int, l: Dictionary) -> void:
	var nv := int(l.get("nivel", 0))
	var rom := _romano(nv) if nv > 0 else ""
	var w := fonte.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, tam).x + 18.0
	if rom != "":
		w += fonte.get_string_size(rom, HORIZONTAL_ALIGNMENT_LEFT, -1, tam).x + 18.0
	var r := Rect2(centro - Vector2(w * 0.5, tam * 0.75), Vector2(w, tam * 1.5))
	c.draw_rect(r, Color8(236, 200, 172))
	c.draw_rect(r, Color8(150, 96, 70), false, 2.0)
	var x := r.position.x + 9.0
	if rom != "":
		c.draw_string(fonte, Vector2(x, centro.y + tam * 0.35), rom, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, Color8(60, 30, 20))
		x += fonte.get_string_size(rom, HORIZONTAL_ALIGNMENT_LEFT, -1, tam).x + 4.0
		c.draw_circle(Vector2(x + 5.0, centro.y), 5.0, _cor_nivel(nv))
		x += 14.0
	c.draw_string(fonte, Vector2(x, centro.y + tam * 0.35), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, Color8(50, 28, 18))

static func _romano(n: int) -> String:
	return ["I", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"][clampi(int(ceil(n / 12.5)), 0, 8)]

static func _cor_nivel(nv: int) -> Color:
	if nv < 20:
		return Color8(90, 200, 255)
	if nv < 45:
		return Color8(255, 220, 60)
	if nv < 70:
		return Color8(255, 140, 40)
	return Color8(230, 50, 60)

func _mapinha(c: Control, tam: Vector2) -> void:
	if mini_sv == null:
		return
	var ms := Vector2(mini_sv.size) * minf(1.0, tam.y * 0.42 / float(mini_sv.size.y))
	var r := Rect2(Vector2(tam.x - ms.x - 18.0, tam.y - ms.y - 18.0), ms)
	c.draw_rect(r.grow(4.0), Color8(20, 32, 44))
	c.draw_texture_rect(mini_sv.get_texture(), r, false)
	c.draw_rect(r.grow(4.0), COR_OURO, false, 2.0)
	# o que a câmera mostra: o chão nos quatro cantos da tela
	var cantos := PackedVector2Array()
	for q in [Vector2(0, tam.y * 0.08), Vector2(tam.x, tam.y * 0.08), Vector2(tam.x, tam.y), Vector2(0, tam.y)]:
		var o := cam.project_ray_origin(q)
		var d := cam.project_ray_normal(q)
		var t := (0.0 - o.y) / minf(d.y, -0.05)
		var p := o + d * minf(t, 4000.0)
		cantos.append(r.position + Vector2((p.x - X0) / (ATE.x - X0), (p.z - Z0) / (ATE.y - Z0)) * r.size)
	cantos.append(cantos[0])
	for i in cantos.size():
		cantos[i] = cantos[i].clamp(r.position, r.end)
	c.draw_polyline(cantos, Color8(230, 40, 40), 2.0, true)
	if m.heroi != null:
		var hp: Vector3 = m.heroi.position
		c.draw_circle(r.position + Vector2((hp.x - X0) / (ATE.x - X0), (hp.z - Z0) / (ATE.y - Z0)) * r.size, 3.0, Color.WHITE)

func _botao(c: Control, r: Rect2, txt: String, tam := 17) -> void:
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.08, 0.06, 0.04, 0.88)
	sb.border_color = COR_OURO
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(int(r.size.y * 0.5))
	sb.draw(c.get_canvas_item(), r)
	c.draw_string(fonte, Vector2(r.position.x, r.position.y + r.size.y * 0.5 + tam * 0.35), txt, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, tam, Color(1, 0.95, 0.85))

func _botoes(c: Control, tam: Vector2) -> void:
	c.draw_rect(Rect2(0, 0, tam.x, 48), Color(0.08, 0.06, 0.04, 0.78))
	c.draw_string(fonte, Vector2(18, 32), "Mundo de Aethra", HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color8(250, 232, 190))
	var cx := Vector2(tam.x - 28.0, 24.0)
	b_x = Rect2(cx - Vector2(22, 22), Vector2(44, 44))
	c.draw_circle(cx, 15.0, Color(0.05, 0.04, 0.03, 0.85))
	c.draw_arc(cx, 15.0, 0, TAU, 32, COR_OURO, 1.5, true)
	c.draw_line(cx + Vector2(-6, -6), cx + Vector2(6, 6), Color(1, 0.95, 0.85), 2.5, true)
	c.draw_line(cx + Vector2(6, -6), cx + Vector2(-6, 6), Color(1, 0.95, 0.85), 2.5, true)
	b_2d = Rect2(Vector2(tam.x - 170.0, 6.0), Vector2(110, 36))
	_botao(c, b_2d, "Mapa 2D")
	b_eu = Rect2(Vector2(tam.x - 300.0, 6.0), Vector2(118, 36))
	_botao(c, b_eu, "Onde estou")
	var cz := Vector2(tam.x * 0.5, tam.y - 34.0)
	b_menos = Rect2(cz - Vector2(62, 22), Vector2(58, 44))
	b_mais = Rect2(cz + Vector2(4, -22), Vector2(58, 44))
	_botao(c, b_menos, "−", 26)
	_botao(c, b_mais, "+", 26)
	b_ir = Rect2()
	if mm.marcado != null and m.rota:
		var metros: float = m.rota.comprimento(mm.previa)
		var t := "Ir para  (%d m)" % int(round(metros))
		var w := fonte.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, 20).x + 40.0
		b_ir = Rect2(Vector2(cz.x - w * 0.5, cz.y - 84.0), Vector2(w, 44))
		_botao(c, b_ir, t, 20)
		b_ir = b_ir.grow(8.0)

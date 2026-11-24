extends SceneTree
const Armadura := preload("res://armadura.gd")
# Banco de provas das animações (plano de animações, Dia 1): grava o herói minerando, cortando lenha, pescando em pé
# na beira e pescando no barquinho, com eventos falsos do servidor (o jogo de verdade, sem conectar).
# Uso (da raiz do repositório):
#   CENA=minerar xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 --render-thread safe \
#     --write-movie /tmp/minerar.avi --fixed-fps 30 -s ../ferramentas/animacoes/video-trabalho.gd
# CENA = minerar | lenha | pesca | pesca_barco. SEG = segundos gravados (padrão 9). YAW = giro da câmera (rad).
var m
var cena := ""

func esperar(n: int) -> void:
	for i in n:
		await process_frame

func _initialize() -> void:
	root.size = Vector2i(1280, 720)
	cena = OS.get_environment("CENA")
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online:
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	if OS.get_environment("HUD") != "1": # sem a interface: só o corpo
		for c in m.find_children("*", "CanvasLayer", true, false):
			c.visible = false
	if OS.get_environment("ROUPA") != "": # ex.: peitoral1,calca1,botas1 (sem conta logada o corpo vem sem roupa)
		Armadura.vestir(m.heroi, Armadura.de_texto(OS.get_environment("ROUPA")))
		await esperar(5)
	if OS.get_environment("ANTES") == "1": # o jeito de antes (golpe por código e pesca de pose parada)
		m.pesca.PESCA_KK = false
	var seg := float(OS.get_environment("SEG")) if OS.get_environment("SEG") != "" else 9.0
	match cena:
		"minerar", "lenha":
			await _coleta(cena == "lenha", seg)
		"pesca":
			await _pesca(false, seg)
		"pesca_barco":
			await _pesca(true, seg)
		"pegada":
			await _pegada()
		"ver": # ANIM=nome1,nome2: toca cada animação do corpo (sem ferramenta), uma depois da outra
			await _ver(OS.get_environment("ANIM").split(","))
	quit()

func _por_em(x: float, z: float, ry: float) -> void:
	m.mov.x = x
	m.mov.z = z
	m.mov.ry = ry
	m.mov.por_em(Vector3(x, m.terreno.altura(x, z), z))
	m.heroi.rotation.y = ry

func _camera(ry_heroi: float) -> void:
	# câmera de lado (3/4) para ver o corpo inteiro no golpe
	var yaw := float(OS.get_environment("YAW")) if OS.get_environment("YAW") != "" else ry_heroi + PI * 0.62
	if "yaw" in m.cam:
		m.cam.yaw = yaw
	if "dist" in m.cam:
		m.cam.dist = 4.2

func _coleta(arvore: bool, seg: float) -> void:
	var T = m.trabalho
	var melhor = null
	var ref := Vector2(m.mov.x, m.mov.z)
	for o in T.coletaveis:
		if OS.get_environment("ALVO") != "" and str(o.id) != OS.get_environment("ALVO"):
			continue
		if o.get("solto", false) or (o.tipo == "arvore") != arvore:
			continue
		if o.pos.y < m.terreno.altura(o.pos.x, o.pos.z) - 1.0: # caverna
			continue
		if melhor == null or Vector2(o.pos.x, o.pos.z).distance_to(ref) < Vector2(melhor.pos.x, melhor.pos.z).distance_to(ref):
			melhor = o
	if melhor == null:
		print("sem coletável")
		return
	if OS.get_environment("CAM") == "multi": # as outras pedras de perto saem da frente da câmera
		for o in T.veios:
			if o != melhor and o.get("no") is Node3D and Vector2(o.pos.x, o.pos.z).distance_to(Vector2(melhor.pos.x, melhor.pos.z)) < 12.0:
				o.no.visible = false
	var enc: float = T.ENCOSTO_VEIO if not arvore else float(melhor.r) + 0.5
	var p: Vector3 = melhor.pos + Vector3(enc, 0, 0)
	var ry := atan2(melhor.pos.x - p.x, melhor.pos.z - p.z)
	_por_em(p.x, p.z, ry)
	await esperar(30)
	var falta: float = T._falta(melhor) # o mesmo encosto do jogo (trabalho.gd _falta)
	p += Vector3(-falta, 0, 0)
	_por_em(p.x, p.z, ry)
	print("falta ", falta)
	await esperar(30)
	_camera(ry)
	if OS.get_environment("CAM") == "lado":
		_camera_teste(float(OS.get_environment("LADO")) if OS.get_environment("LADO") != "" else 1.57)
	await esperar(30)
	var dur := 2.2
	var t := 0.0
	var prox := 0.0
	if OS.get_environment("CAM") == "multi": # vários ângulos, dois golpes em cada
		seg = ANGULOS.size() * dur * 2.0
	while t < seg:
		_rig(int(t / (dur * 2.0)))
		if t >= prox:
			T.comecou(str(melhor.id), dur, "len" if arvore else "min")
			prox += dur
		await process_frame
		t += 1.0 / 30.0
	print(cena, " ok em ", melhor.id)

func _pesca(barco: bool, seg: float) -> void:
	var P = m.pesca
	var x := -27.0
	var z := 198.0
	var ry := PI * 0.5
	if barco:
		_por_em(x, z, ry)
		m.transporte.atualizar({"packs": [], "veic": [["b", str(m.online.meu_id) if m.online else "", x, z, ry, 1, [], 0, 1]]})
		m.transporte.evento({"acao": "subiu", "k": "barquinho", "x": x, "z": z, "ry": ry})
	else:
		# anda para oeste até sair da água: a beira do mesmo lago
		var bx := x
		while bx > x - 80.0 and m.terreno.agua_no_corpo(bx, z, m.terreno.altura(bx, z)) > 0.0:
			bx -= 0.5
		x = bx - 0.8
		_por_em(x, z, ry)
	await esperar(60)
	_camera(ry)
	if OS.get_environment("CAM") == "lado":
		_camera_teste(float(OS.get_environment("LADO")) if OS.get_environment("LADO") != "" else 1.57)
	await esperar(20)
	var bx2 := x + 7.0
	var roteiro := [[0.0, {"st": "lancando", "x": bx2, "z": z}], [0.8, {"st": "espera"}], [3.5, {"st": "fisgou"}],
		[4.3, {"st": "briga", "prog": 0.3, "tap": 0.1, "dec": 0.05, "max": 6.0}], [6.8, {"st": "pegou", "peixe": "lambari", "nome": "Lambari", "peso": "0,4 kg"}],
		[8.3, {"st": "fim"}]]
	var voltas := ANGULOS.size() if OS.get_environment("CAM") == "multi" else 1 # a pescaria inteira em cada ângulo
	for v in voltas:
		var t := 0.0
		var i := 0
		_rig(v)
		while t < seg:
			while i < roteiro.size() and t >= float(roteiro[i][0]):
				P.evento(roteiro[i][1])
				i += 1
			await process_frame
			t += 1.0 / 30.0
		await esperar(10)
	print(cena, " ok")

func _ver(nomes: Array) -> void:
	var v = null # em terra: ao lado do veio mais perto
	for o in m.trabalho.veios:
		if v == null or Vector2(o.pos.x, o.pos.z).distance_to(Vector2(m.mov.x, m.mov.z)) < Vector2(v.pos.x, v.pos.z).distance_to(Vector2(m.mov.x, m.mov.z)):
			v = o
	if v != null:
		_por_em(v.pos.x + 4.0, v.pos.z, 0.0)
	await esperar(40)
	m.armar("Coleta") # armas nas costas
	# câmera só do teste, de lado e na altura do peito (a do jogo fica como está)
	var c := Camera3D.new()
	c.fov = 40
	m.add_child(c)
	var h: Vector3 = m.heroi.global_position
	var lado := float(OS.get_environment("LADO")) if OS.get_environment("LADO") != "" else 1.2
	c.global_position = h + Vector3(sin(m.mov.ry + lado), 0, cos(m.mov.ry + lado)) * 3.4 + Vector3(0, 1.1, 0)
	c.look_at(h + Vector3(0, 0.9, 0))
	c.current = true
	await esperar(20)
	for n in nomes:
		if not m.heroi_anim.has_animation(n):
			print("falta ", n)
			continue
		var dur: float = m.heroi_anim.get_animation(n).length
		for r in 2:
			m.acao = {"nome": "coleta", "t": 0.0, "dur": 1e9, "hits": [], "feitos": 0, "fn": func(_i): pass}
			m.heroi_anim.play(n, 0.15)
			var t := 0.0
			while t < dur:
				await process_frame
				t += 1.0 / 30.0
		print("tocou ", n)

# câmera só do teste, de lado e na altura do peito (a do jogo fica como está)
func _camera_teste(lado: float) -> void:
	var c := Camera3D.new()
	c.fov = 42
	m.add_child(c)
	var h: Vector3 = m.heroi.global_position
	c.global_position = h + Vector3(sin(m.mov.ry + lado), 0, cos(m.mov.ry + lado)) * 3.6 + Vector3(0, 1.2, 0)
	c.look_at(h + Vector3(0, 0.9, 0) + Vector3(sin(m.mov.ry), 0, cos(m.mov.ry)) * 0.8)
	c.current = true

# mede a rotação da ferramenta na mão (bone-local) para bater com o handslot do KayKit:
# [animação, tempo, eixo Y do cabo e eixo Z do handslot no corpo do KayKit (frente = +Z)]
func _pegada() -> void:
	var casos := [["kk_picareta", 0.0, Vector3(0.03, 0.13, 0.99), Vector3(-1, -0.01, 0.03)], ["kk_picareta", 0.28, Vector3(0.03, 0.13, 0.99), Vector3(-1, -0.01, 0.03)],
		["kk_picareta", 1.8, Vector3(-0.12, 0.52, -0.85), Vector3(-0.99, 0, 0.14)],
		["kk_machado", 0.4, Vector3(0.02, 0.43, 0.9), Vector3(-1, 0, 0.02)],
		["kk_machado", 0.9, Vector3(-0.02, 0.96, 0.27), Vector3(-1, -0.01, -0.02)],
		["kk_pesca_espera", 0.5, Vector3(0.08, 0.96, 0.27), Vector3(-1, 0.09, 0)]]
	var esq: Skeleton3D = m.heroi_esq
	var osso := esq.find_bone(m.lugar_armas().espadaMao.osso)
	var O0 = null
	for c in casos:
		m.acao = {"nome": "coleta", "t": 0.0, "dur": 1e9, "hits": [], "feitos": 0, "fn": func(_i): pass}
		m.heroi_anim.play(c[0], 0.0, 0.0)
		m.heroi_anim.seek(c[1], true)
		await esperar(8)
		var H: Basis = (m.heroi.global_transform.affine_inverse() * esq.global_transform * esq.get_bone_global_pose(osso)).basis.orthonormalized()
		var y: Vector3 = c[2].normalized()
		var z: Vector3 = c[3].normalized()
		var x: Vector3 = y.cross(z).normalized()
		z = x.cross(y).normalized()
		var T := Basis(x, y, z)
		var O: Basis = H.inverse() * T
		if O0 == null:
			O0 = O
		var prev: Vector3 = H * O0 * Vector3.UP
		var P: Vector3 = (m.heroi.global_transform.affine_inverse() * esq.global_transform * esq.get_bone_global_pose(osso)).origin
		print("  mão ", P, " cabo ", H * Basis(Quaternion(0.0, 0.7071, 0.7071, 0.0)) * Vector3.UP)
		print(c[0], " t=", c[1], " O=", O.get_rotation_quaternion(), " com O da 1a: cabo ", prev, " quer ", y)

# vídeo para o André aprovar (2026-11-24: "em mais de um ângulo, com visão boa"): câmera do teste em ângulos fixos,
# o nome do ângulo no canto. [graus a partir da frente do herói (+ = esquerda dele), distância, altura da câmera,
# altura do alvo, nome]. 0° fica do lado da pedra / da água, por isso a frente é de 3/4.
const ANGULOS := [[90.0, 3.4, 1.25, 0.95, "Lateral"], [140.0, 3.2, 1.6, 0.95, "3/4 de trás"],
	[-72.0, 3.6, 1.35, 0.95, "3/4 de frente"], [115.0, 1.7, 1.45, 1.15, "Perto: mãos e ferramenta"]]
var _cam_rig: Camera3D
var _rotulo: Label
var _rig_i := -1
func _rig(i: int) -> void:
	if OS.get_environment("CAM") != "multi" or i == _rig_i or i >= ANGULOS.size():
		return
	_rig_i = i
	if _cam_rig == null:
		_cam_rig = Camera3D.new()
		_cam_rig.fov = 45
		m.add_child(_cam_rig)
		var cl := CanvasLayer.new()
		cl.layer = 50
		m.add_child(cl)
		_rotulo = Label.new()
		_rotulo.position = Vector2(28, 20)
		_rotulo.add_theme_font_size_override("font_size", 30)
		_rotulo.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
		_rotulo.add_theme_constant_override("outline_size", 8)
		cl.add_child(_rotulo)
	var a: Array = ANGULOS[i]
	var ry: float = m.heroi.global_rotation.y + deg_to_rad(float(a[0]))
	var h: Vector3 = m.heroi.global_position
	_cam_rig.global_position = h + Vector3(sin(ry), 0, cos(ry)) * float(a[1]) + Vector3(0, float(a[2]), 0)
	_cam_rig.look_at(h + Vector3(0, float(a[3]), 0))
	_cam_rig.current = true
	_rotulo.text = "%s  ·  %s" % [TITULOS.get(cena, cena), a[4]]
const TITULOS := {"minerar": "Minerar", "lenha": "Cortar lenha", "pesca": "Pescar na beira", "pesca_barco": "Pescar no barquinho"}

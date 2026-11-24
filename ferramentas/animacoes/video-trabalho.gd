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
	# André 2026-11-24 ("todos os vídeos ficam com umas explosões"): o aquecer.gd põe todos os efeitos (skills,
	# meteoro, números) na frente da câmera para montar na placa atrás da capa; o banco esconde a capa, então eles
	# apareciam no vídeo. Espera o aquecimento acabar (e os efeitos sumirem) antes de gravar qualquer coisa.
	var espera := 0
	while m.get("aquecer") != null and m.aquecer != null and not m.aquecer.feito and espera < 30 * 20:
		await process_frame
		espera += 1
		if OS.get_environment("HUD") != "1": # a interface que aparece no meio da espera também fica escondida
			for c in m.find_children("*", "CanvasLayer", true, false):
				c.visible = false
	await esperar(75)
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
		"passos": # plano, passo 3: um NPC e um monstro andando e correndo em várias velocidades (o pé desliza?)
			await _passos()
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
			_cam_mao()
			t += 1.0 / 30.0
		await esperar(10)
	print(cena, " ok")

# CAM=mao: câmera colada na mão direita (a de verdade, depois dos modificadores), girando em volta dela pelo ANG
# (graus a partir do lado de fora do braço); para calibrar a vara no punho
var _cam_m: Camera3D
func _cam_mao() -> void:
	if OS.get_environment("CAM") != "mao" or m.pesca._kk_mao == null:
		return
	if _cam_m == null:
		_cam_m = Camera3D.new()
		_cam_m.fov = 40
		_cam_m.near = 0.02
		m.add_child(_cam_m)
	var p: Vector3 = m.pesca._kk_mao.get_parent().global_position
	var c: Vector3 = m.heroi.global_position + Vector3(0, p.y - m.heroi.global_position.y, 0)
	var fora: Vector3 = (p - c)
	fora.y = 0.0
	fora = fora.normalized() if fora.length() > 0.01 else Vector3.RIGHT
	var ang := deg_to_rad(float(OS.get_environment("ANG")) if OS.get_environment("ANG") != "" else 0.0)
	if OS.get_environment("ANG") == "gira": # dá a volta inteira na mão em 8 s
		ang = Time.get_ticks_msec() * 0.0 + float(Engine.get_process_frames() % 240) / 240.0 * TAU
	var d: Vector3 = fora.rotated(Vector3.UP, ang)
	_cam_m.global_position = p + d * 0.5 + Vector3(0, 0.12, 0)
	_cam_m.look_at(p)
	_cam_m.current = true

# CENA=passos: o mesmo que online.gd faz com quem vem do servidor (anda entre as fotos e toca andar/corrida), aqui
# com a velocidade escolhida. ANTES=1: o ritmo fixo de antes (speed_scale 1); senão online._passo_no_ritmo.
# VISUAL=cabelo_m|ruiva (o NPC), MONSTRO=lobo|puglin|... (o monstro mais perto desse tipo)
const PASSOS_H := [["andar", 1.0, "NPC andando devagar (1,0 m/s)"], ["andar", 1.8, "NPC andando (1,8 m/s)"],
	["corrida", 4.4, "NPC correndo leve (4,4 m/s)"], ["corrida", 5.4, "NPC correndo (5,4 m/s)"]]
const PASSOS_M := [["andar", 1.6, "Monstro rodeando (1,6 m/s)"], ["andar", 2.2, "Monstro chegando (2,2 m/s)"],
	["corrida", 3.6, "Monstro perseguindo (3,6 m/s)"], ["corrida", 1.8, "Monstro lento, gelo (1,8 m/s)"]]
func _passos() -> void:
	var antes := OS.get_environment("ANTES") == "1"
	var x0 := -36.0
	var z0 := 190.0
	_por_em(x0, z0 + 16.0, 0.0) # atrás da câmera: o capim alto (mato.gd) nasce em volta do herói e escondia os pés
	m.heroi.visible = false
	var vis := OS.get_environment("VISUAL") if OS.get_environment("VISUAL") != "" else "cabelo_m"
	var o: Dictionary = m.online._montar_corpo(vis, Vector3(x0, m.terreno.altura(x0, z0), z0), PI * 0.5, "Aldeão")
	if OS.get_environment("ROUPA") != "":
		Armadura.vestir(o.no, Armadura.de_texto(OS.get_environment("ROUPA")))
	# o monstro: o mais perto do tipo pedido, parado pela IA (parado = para sempre) e trazido para cá
	var tipo := OS.get_environment("MONSTRO") if OS.get_environment("MONSTRO") != "" else "lobo"
	var e = null
	for c in m.inimigos:
		if str(c.get("tipo", "")) == tipo and not c.get("vazio", false):
			e = c
			break
	if e == null and m.inimigos.size() > 0:
		e = m.inimigos[0]
	if e != null and e.get("vazio", false):
		m.materializar(e)
	await esperar(30)
	var cam := Camera3D.new()
	cam.fov = 40
	m.add_child(cam)
	var cl := CanvasLayer.new()
	cl.layer = 50
	m.add_child(cl)
	var rot := Label.new()
	rot.position = Vector2(28, 20)
	rot.add_theme_font_size_override("font_size", 30)
	rot.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	rot.add_theme_constant_override("outline_size", 8)
	cl.add_child(rot)
	for quem in [0, 1]:
		var lista: Array = PASSOS_H if quem == 0 else PASSOS_M
		var no: Node3D = o.no if quem == 0 else e.no
		var an: AnimationPlayer = o.anim if quem == 0 else e.anim
		if quem == 1:
			e.parado = 1e12
			e.estado = "andando"
			o.no.visible = false
			no.visible = true
		var x := x0 - 6.0
		# medida do deslize: pés (ossos com foot/Foot/paw no nome, sem "toe"), velocidade no chão enquanto apoiado
		var esq: Skeleton3D = m.esqueleto(no)
		var pes: Array = []
		for b in esq.get_bone_count():
			var bn := esq.get_bone_name(b).to_lower()
			if (bn.contains("foot") or bn.contains("paw") or bn.contains("ankle") or bn.contains("toe") or bn.begins_with("pata")) and not bn.contains("end"):
				pes.append(b)
		if OS.get_environment("OSSOS") == "1":
			var nomes := []
			for b in esq.get_bone_count():
				nomes.append(esq.get_bone_name(b))
			print("OSSOS ", nomes)
		if OS.get_environment("CALIBRA") != "": # varre velocidades com o laço a 1x: a de menor deslize é a do laço
			lista = []
			for nm in ["andar", "corrida"]:
				for i in range(4, 72, 4):
					lista.append([nm, i / 10.0, "%s %.1f" % [nm, i / 10.0]])
		for passo in lista:
			var nome: String = passo[0]
			var v: float = passo[1]
			rot.text = "%s  ·  %s" % [passo[2], "ANTES" if antes else "DEPOIS"]
			x = x0 - 6.0
			no.rotation.y = PI * 0.5
			var t := 0.0
			var vm := v
			an.play(nome, 0.15, m.ritmo(nome) if quem == 0 else 1.0)
			var ant := {}
			var soma := 0.0
			var nq := 0
			var miny := {}
			while t < (1.6 if OS.get_environment("CALIBRA") != "" else 3.0):
				if t > 0.6: # já no laço: pés no chão (perto do ponto mais baixo deles) e quanto andaram no mundo
					for b in pes:
						var pw: Vector3 = esq.global_transform * esq.get_bone_global_pose(b).origin
						if ant.has(b): # velocidade do osso no mundo; o apoio é o trecho mais lento (20% menor) de cada pé
							if not miny.has(b):
								miny[b] = []
							miny[b].append(Vector2(pw.x - ant[b].x, pw.z - ant[b].z).length() * 30.0)
						ant[b] = pw
				x += v / 30.0
				no.position = Vector3(x, m.terreno.altura(x, z0), z0)
				if not antes:
					if quem == 0:
						m.online._passo_no_ritmo(an, vm, m.online.PASSO_HUMANO[0], m.online.PASSO_HUMANO[1])
					else:
						var ref: Array = m.online.PASSO_MONSTRO.get(str(e.get("tipo", "")), [2.2, 3.6])
						m.online._passo_no_ritmo(an, vm, ref[0], ref[1])
				else:
					an.speed_scale = 1.0
				# câmera de lado, um pouco baixa, seguindo devagar: o pé no chão aparece bem
				cam.global_position = Vector3(x, no.position.y + 2.2, z0 + 3.6) # de cima: o capim não esconde o pé
				cam.look_at(Vector3(x, no.position.y + 0.3, z0))
				cam.current = true
				await process_frame
				t += 1.0 / 30.0
			for b in miny:
				var l: Array = miny[b]
				l.sort()
				soma += float(l[int(l.size() * 0.2)])
				nq += 1
			print("DESLIZE %s %s v=%.1f pe_apoiado_escorrega=%.2f m/s (%d pés)" % ["antes" if antes else "depois", passo[2], v, soma / max(1, nq), nq])

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

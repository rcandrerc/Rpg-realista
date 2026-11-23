extends SceneTree
# Fotos da proposta de equipamentos por raridade (setor de arte, 2026-11-23): o herói no jogo de verdade, sem
# servidor, com o peitoral e a espada de cada raridade. MODO=antes usa a armadura de hoje; MODO=depois veste os
# modelos novos de ferramentas/equip-raridade/ (pecas.glb), sem mexer em nada do jogo.
# Uso: FOTO_SAIDA=/pasta MODO=antes xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 \
#   --render-thread safe -s ../ferramentas/equip-raridade/foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
var modo := OS.get_environment("MODO") if OS.get_environment("MODO") != "" else "antes"
var cam: Camera3D
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
func _initialize() -> void:
	var w := 720
	var h := 960
	DisplayServer.window_set_size(Vector2i(w, h))
	root.size = Vector2i(w, h)

	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	await esperar(60)
	await foto("jogo-" + modo)
	if OS.get_environment("CORPO") != "":
		m.trocar_corpo(OS.get_environment("CORPO"), false) # corpo masculino do criador (cabelo_m)
		await esperar(30)
	m.armar("Espada")
	await esperar(5)
	# um lugar aberto, sem a árvore atrás (só para a foto)
	var dx := float(OS.get_environment("FOTO_DX")) if OS.get_environment("FOTO_DX") != "" else -4.0
	var dz := float(OS.get_environment("FOTO_DZ")) if OS.get_environment("FOTO_DZ") != "" else 3.0
	for i in 20:
		m.mov.mover(dx / 20.0, dz / 20.0)
	m.mov.ry = float(OS.get_environment("FOTO_RY")) if OS.get_environment("FOTO_RY") != "" else m.mov.ry
	m.heroi.position = m.mov.posicao()
	m.heroi.rotation.y = m.mov.ry
	await esperar(60)
	# congela só com os dois braços caídos (a parada às vezes cruza a espada no peito)
	var esq: Skeleton3D = m.heroi_esq
	for i in 900:
		var q: float = esq.get_bone_global_pose(esq.find_bone("J_Bip_C_Hips")).origin.y
		var me: float = esq.get_bone_global_pose(esq.find_bone("J_Bip_L_Hand")).origin.y
		var md: float = esq.get_bone_global_pose(esq.find_bone("J_Bip_R_Hand")).origin.y
		var cab: float = esq.get_bone_global_pose(esq.find_bone("J_Bip_C_Head")).origin.z - esq.get_bone_global_pose(esq.find_bone("J_Bip_C_Neck")).origin.z
		var dh: Vector3 = esq.get_bone_global_pose(esq.find_bone("J_Bip_C_Head")).origin - esq.get_bone_global_pose(esq.find_bone("J_Bip_C_Neck")).origin
		var reta: bool = dh.y > 0.97 * dh.length() or i > 700 # cabeça erguida (não olhando o chão)
		if me < q + 0.05 and md < q + 0.05 and reta and i > 30:
			break
		await process_frame
	for a in m.heroi.find_children("*", "AnimationMixer", true, false):
		a.active = false # mesma pose nas 5 fotos
	var novo = null
	if modo == "depois":
		novo = load((get_script() as Script).resource_path.get_base_dir() + "/vestir_novo.gd").new()
	var lista := Array(OS.get_environment("FOTO_R").split(",")) if OS.get_environment("FOTO_R") != "" else ["0", "1", "2", "3", "4"]
	for rs in (lista if OS.get_environment("SO_FILA") == "" else []):
		var r := int(rs)
		if modo == "antes":
			m.P.prog["equip"] = {"corpo": {"k": "peitoral", "r": r}, "pernas": {"k": "calca", "r": r}, "pes": {"k": "botas", "r": r}}
			m.vestir_heroi()
		else:
			m.P.prog["equip"] = {} if OS.get_environment("VERSAO") in ["3", "ia", "robe"] else {"pernas": {"k": "calca", "r": 0}, "pes": {"k": "botas", "r": 0}}
			m.vestir_heroi()
			novo.vestir(m.heroi, m.heroi_esq, m.espada, r)
		await esperar(20)
		if OS.get_environment("ANGULOS") != "":
			# corpo inteiro: frente, lado e costas (pedido do André)
			_sem_hud(root)
			for k in ["frente", "lado", "costas"]:
				_cam_ang(k)
				await esperar(30 if k == "frente" else 4)
				await foto("%d-%s" % [r, k])
			continue
		_camera()
		_sem_hud(root)
		await esperar(40)
		await foto("%s-%d" % [modo, r])
		_camera(true)
		await esperar(3)
		await foto("%s-perto-%d" % [modo, r])
		_camera(false, true)
		await esperar(3)
		await foto("%s-costas-%d" % [modo, r])
		if OS.get_environment("FOTO_PERNAS") != "":
			_camera(false, true, true)
			await esperar(3)
			await foto("%s-pernas-%d" % [modo, r])
	if modo == "depois" and OS.get_environment("SEM_FILA") == "":
		await _fila_espadas(novo)
		await _fila_espadas(novo, "cajado")
	quit()
# as 5 espadas em pé, lado a lado, no cenário do jogo (mesma luz)
var _filas := []
func _fila_espadas(novo, qual := "espada") -> void:
	for f in _filas:
		f.queue_free()
	_filas.clear()
	DisplayServer.window_set_size(Vector2i(1280, 720))
	root.size = Vector2i(1280, 720)
	_camera()
	m.heroi.visible = false
	_sem_hud(root)
	for sk in root.find_children("*", "Skeleton3D", true, false):
		(sk.get_parent() as Node3D).visible = false # sem gente passando na frente
	var b: Basis = cam.global_transform.basis
	cam.global_position += b.x * 0.9
	var centro: Vector3 = cam.global_position - b.z * 2.15 + b.y * 0.04
	var lista := Array(OS.get_environment("FOTO_R").split(",")) if OS.get_environment("FOTO_R") != "" else ["0", "1", "2", "3", "4"]
	for rs in lista:
		var r := int(rs)
		var e: MeshInstance3D = novo.espada_sozinha(r, qual)
		if e == null:
			continue
		m.add_child(e)
		_filas.append(e)
		var x := (r - 2) * (0.25 if qual == "espada" else 0.36)
		var desce := 0.42 if qual == "espada" else 0.62
		e.global_transform = Transform3D(Basis(b.y, 0.0) * Basis(Vector3.UP, 0.0), centro + b.x * x - b.y * desce)
		e.global_basis = b * Basis(Vector3.UP, deg_to_rad(-8.0)) * Basis(Vector3.FORWARD, deg_to_rad(4.0 * (r - 2)))
	if qual == "cajado":
		cam.global_position += b.z * 1.7
	await esperar(30)
	await foto(qual + "s")
	if qual == "cajado":
		cam.global_position -= b.z * 1.7
		# de perto: só as cabeças
		cam.global_position += b.y * 0.62 + b.z * 0.2
		await esperar(10)
		await foto("cajados-perto")
		cam.global_position -= b.y * 0.62 + b.z * 0.2
func _arvore(n: Node, pre: String) -> void:
	print(pre, n.name, " ", n.get_class(), " ", (n as Node3D).transform if n is Node3D else "")
	for c in n.get_children():
		_arvore(c, pre + "  ")
func _sem_hud(n: Node) -> void:
	for c in n.get_children():
		if c is Label3D:
			c.visible = false
		if c is CanvasLayer:
			c.visible = false
		elif c is Control and not (c.get_parent() is CanvasLayer):
			c.visible = false
		_sem_hud(c)
func _camera(perto := false, costas := false, pernas := false) -> void:
	if cam == null:
		cam = Camera3D.new()
		m.add_child(cam)
		var falsa := Camera3D.new() # a câmera do jogo passa a mexer nesta, que não aparece
		m.add_child(falsa)
		m.cam.cam = falsa
	var hb: Basis = m.heroi.global_transform.basis.orthonormalized()
	var fr: Vector3 = hb.z
	var dir: Vector3 = hb.x
	var alvo: Vector3 = m.heroi.global_position + Vector3(0, 1.05, 0)
	cam.fov = 32.0
	cam.global_position = alvo + fr * 2.2 + dir * 1.25 + Vector3(0, 0.2, 0)
	if costas:
		cam.global_position = alvo - fr * 2.0 + dir * 1.1 + Vector3(0, 0.3, 0)
	if perto:
		alvo += Vector3(0, 0.1, 0)
		cam.global_position = alvo + fr * 1.45 + dir * 0.75 + Vector3(0, 0.1, 0)
	if pernas:
		alvo += Vector3(0, -0.5, 0)
		cam.global_position = alvo - fr * 1.2 + dir * 0.4 + Vector3(0, 0.1, 0)
	cam.look_at(alvo, Vector3.UP)
	cam.make_current()

func _cam_ang(k: String) -> void:
	_camera()
	var hb: Basis = m.heroi.global_transform.basis.orthonormalized()
	var alvo: Vector3 = m.heroi.global_position + Vector3(0, 0.86, 0)
	var d: Vector3 = hb.z if k == "frente" else (hb.x if k == "lado" else -hb.z)
	cam.fov = 32.0
	cam.global_position = alvo + d * 3.7 + Vector3(0, 0.12, 0)
	cam.look_at(alvo, Vector3.UP)
	# nada entre a câmera e a heroína: some com outras pessoas e com o que tapa a vista (pedra, parede)
	for sk in root.find_children("*", "Skeleton3D", true, false):
		if not m.heroi.is_ancestor_of(sk):
			(sk.get_parent() as Node3D).visible = false
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		if m.heroi.is_ancestor_of(mi) or not mi.is_visible_in_tree():
			continue
		var bb: AABB = mi.global_transform * mi.get_aabb()
		if bb.size.length() > 60.0:
			continue # chão e terreno
		for h in [0.2, 0.9, 1.5]:
			var p0: Vector3 = m.heroi.global_position + Vector3(0, h, 0)
			if bb.intersects_segment(cam.global_position, p0 + (cam.global_position - p0).normalized() * 0.45):
				mi.visible = false
				break

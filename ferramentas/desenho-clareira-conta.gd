extends SceneTree
# Conta o que é desenhado na Vila da Clareira no último degrau do Auto da Baixa (celular fraco), agrupado por pai/script,
# e tira uma foto de cada lado (Luísa, Note 10 Lite, 2026-11-27). Sem servidor. Vulkan por software estoura a memória: use opengl3.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/desenho-clareira-conta.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func numeros(nome: String) -> void:
	var vp := root.get_viewport()
	var dv := vp.get_render_info(Viewport.RENDER_INFO_TYPE_VISIBLE, Viewport.RENDER_INFO_DRAW_CALLS_IN_FRAME)
	var ob := vp.get_render_info(Viewport.RENDER_INFO_TYPE_VISIBLE, Viewport.RENDER_INFO_OBJECTS_IN_FRAME)
	var tv := vp.get_render_info(Viewport.RENDER_INFO_TYPE_VISIBLE, Viewport.RENDER_INFO_PRIMITIVES_IN_FRAME)
	var sd := vp.get_render_info(Viewport.RENDER_INFO_TYPE_SHADOW, Viewport.RENDER_INFO_DRAW_CALLS_IN_FRAME)
	print("NUMEROS ", nome, " desenhos ", dv, " objetos ", ob, " triangulos ", tv, " sombra ", sd)
func grupo(g: Node) -> String:
	var n: Node = g
	var cam := []
	while n and n != m and n.get_parent() != m:
		n = n.get_parent()
	var top: String = (str(n.name) if n else "?")
	# nome do script mais perto
	var s: Node = g
	var sc := ""
	while s and s != m:
		if s.get_script():
			sc = str(s.get_script().resource_path.get_file())
			break
		s = s.get_parent()
	var nm := str(g.name).rstrip("0123456789_@")
	return "%s | %s | %s" % [top, sc, nm.substr(0, 24)]
func listar(nome: String) -> void:
	var cam: Camera3D = root.get_viewport().get_camera_3d()
	var planos := cam.get_frustum()
	var cp := cam.global_position
	var tot := {}
	var semfim := 0
	for g in root.find_children("*", "GeometryInstance3D", true, false):
		if not g.is_visible_in_tree():
			continue
		var gi: GeometryInstance3D = g
		var ab: AABB = gi.global_transform * gi.get_aabb()
		var dentro := true
		for p in planos:
			var c := ab.get_center()
			var e := ab.size * 0.5
			var r := absf(p.normal.x) * e.x + absf(p.normal.y) * e.y + absf(p.normal.z) * e.z
			if p.distance_to(c) > r:
				dentro = false
				break
		if not dentro:
			continue
		var d := cp.distance_to(ab.get_center())
		if gi.visibility_range_end > 0.0 and d > gi.visibility_range_end + gi.visibility_range_end_margin:
			continue
		if gi.visibility_range_begin > 0.0 and d < gi.visibility_range_begin:
			continue
		var sup := 1
		var inst := 1
		if gi is MeshInstance3D and gi.mesh:
			sup = gi.mesh.get_surface_count()
		elif gi is MultiMeshInstance3D and gi.multimesh and gi.multimesh.mesh:
			sup = gi.multimesh.mesh.get_surface_count()
			inst = gi.multimesh.visible_instance_count if gi.multimesh.visible_instance_count >= 0 else gi.multimesh.instance_count
			if inst == 0:
				continue
		var k := grupo(g) + (" | SEMFIM" if gi.visibility_range_end <= 0.0 else "")
		if gi.visibility_range_end <= 0.0:
			semfim += sup
		if not tot.has(k):
			tot[k] = [0, 0, 0.0]
		tot[k][0] += 1
		tot[k][1] += sup
		tot[k][2] = maxf(tot[k][2], d)
	var ks := tot.keys()
	ks.sort_custom(func(a, b): return tot[a][1] > tot[b][1])
	var soma := 0
	for k in ks:
		soma += tot[k][1]
	print("LISTA ", nome, " superficies ", soma, " semfim ", semfim)
	for k in ks.slice(0, 45):
		print("  ", tot[k][1], " sup  ", tot[k][0], " obj  ate ", int(tot[k][2]), " m  ", k)
func ir(x: float, z: float) -> void:
	m.mov.por_em(Vector3(x, -999.0, z), false)
	m.heroi.position = m.mov.posicao()
	m.cam.colocar(m.heroi.position)
func degrau(d: int) -> void:
	var g = m.grafico
	g.auto = true
	g._sem_40 = true
	g.hz = 60
	g._mudar(d)
	g._ajustar_pendentes()
func _initialize() -> void:
	root.size = Vector2i(1356, 610)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(120)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	m.grafico.trocar(m.grafico.BAIXA)
	var nd: int = m.grafico.degraus()
	var vx := float(OS.get_environment("VX")) if OS.get_environment("VX") != "" else 0.0
	var vz := float(OS.get_environment("VZ")) if OS.get_environment("VZ") != "" else 1.0
	for yaw in [0.0, 1.6, 3.2, 4.7]:
		ir(vx, vz)
		m.cam.yaw = yaw
		m.cam.pitch = 0.3
		m.cam.dist = 9.0
		degrau(nd)
		await esperar(200)
		await RenderingServer.frame_post_draw
		numeros("yaw%.1f" % yaw)
		listar("yaw%.1f" % yaw)
		root.get_texture().get_image().save_png(saida + "/clareira-%d.png" % int(yaw * 10))
	quit()

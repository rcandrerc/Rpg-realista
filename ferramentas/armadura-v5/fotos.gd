extends SceneTree
# Fotos da armadura v5 (André 2026-11-23): cada raridade, feminino (ruiva) e masculino (cabelo_m), de todos os
# ângulos. Uso: FOTO_SAIDA=/pasta [FOTO_R=0,1,2] [FOTO_CORPO=ruiva] xvfb-run -a godot --path godot-prototipo \
#   --rendering-driver opengl3 --render-thread safe -s ../ferramentas/armadura-v5/fotos.gd
const Armadura := preload("res://armadura.gd")
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
var cam: Camera3D
var vp: SubViewport
func esperar(n: int) -> void:
	for i in n:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	vp.get_texture().get_image().save_png(saida + "/" + nome + ".png")
	print("foto ", nome)
func _initialize() -> void:
	root.size = Vector2i(560, 900)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(60)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	await esperar(10)
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	vp = SubViewport.new()
	vp.size = Vector2i(600, 1000)
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp.msaa_3d = Viewport.MSAA_4X
	root.add_child(vp)
	cam = Camera3D.new()
	cam.fov = 26
	vp.add_child(cam)
	cam.current = true
	var h: Vector3 = m.heroi.position
	m.heroi.visible = false
	for cl in m.find_children("*", "CanvasLayer", true, false):
		cl.visible = false
	# estúdio: só a luz e o céu do jogo; o resto do mundo some e entra um chão e um fundo neutros
	for no in m.get_children():
		if no is Node3D and not (no is Light3D) and not (no is WorldEnvironment):
			no.visible = false
	var base := Vector3(0, 300, 0)
	var chao := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(40, 40)
	chao.mesh = pm
	var mc := StandardMaterial3D.new()
	mc.albedo_color = Color("6b6258")
	mc.roughness = 1.0
	chao.material_override = mc
	chao.position = base
	m.add_child(chao)
	var fundo := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(60, 30)
	fundo.mesh = qm
	var mf := StandardMaterial3D.new()
	mf.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mf.albedo_color = Color("3c4656")
	fundo.material_override = mf
	m.add_child(fundo)
	var rs := []
	for t in (OS.get_environment("FOTO_R") if OS.get_environment("FOTO_R") != "" else "0,1,2,3,4").split(","):
		rs.append(int(t))
	var corpos := (OS.get_environment("FOTO_CORPO") if OS.get_environment("FOTO_CORPO") != "" else "ruiva,cabelo_m").split(",")
	var extra := OS.get_environment("FOTO_EXTRA") # "sem" = também sem capuz e sem capa
	for corpo in corpos:
		var no: Node3D = m.modelo(corpo)
		no.position = base
		var c := no.position + Vector3(0, 0.88, 0)
		for r in rs:
			var variantes := [["", "chapeu%d,peitoral%d,calca%d,botas%d,capa%d" % [r, r, r, r, r]]]
			if extra == "sem":
				variantes.append(["-sem", "peitoral%d,calca%d,botas%d" % [r, r, r]])
			for v in variantes:
				Armadura.vestir(no, Armadura.de_texto(v[1]))
				await esperar(8)
				for ang in [[0.0, "1frente"], [-PI / 4, "2tres4"], [-PI / 2, "3lado"], [PI, "4costas"]]:
					if v[0] == "-sem" and ang[1] != "1frente" and ang[1] != "4costas":
						continue
					no.rotation.y = ang[0]
					await esperar(4)
					cam.global_position = c + Vector3(0, 0.1, 5.0)
					cam.look_at(c)
					fundo.global_position = c + Vector3(0, 0, -12)
					await esperar(2)
					await foto("%s-r%d%s-%s" % [corpo, r, v[0], ang[1]])
		no.queue_free()
		await esperar(3)
	quit()

extends SceneTree
# Fotos dos 4 trajes (v5 do irmão e Patrulheiro 2 / Roupão 2) de frente, lado, 3/4 e costas, para comparar o caimento
# no corpo (André 2026-11-24). FOTO_SAIDA, FOTO_R, FOTO_TRAJES, FOTO_CORPOS
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
	for t in (OS.get_environment("FOTO_R") if OS.get_environment("FOTO_R") != "" else "2").split(","):
		rs.append(int(t))
	var trajes := (OS.get_environment("FOTO_TRAJES") if OS.get_environment("FOTO_TRAJES") != "" else "patrulha,patrulheiro2,roupao,roupao2").split(",")
	var corpos := (OS.get_environment("FOTO_CORPOS") if OS.get_environment("FOTO_CORPOS") != "" else "ruiva,cabelo_m").split(",")
	for traje in trajes:
		for corpo in corpos:
			var no: Node3D = m.modelo(corpo)
			no.set_meta("traje", traje)
			no.position = base
			var c := no.position + Vector3(0, 0.95, 0)
			for r in rs:
				Armadura.vestir(no, Armadura.de_texto("chapeu%d,peitoral%d,calca%d,botas%d" % [r, r, r, r]))
				await esperar(10)
				for e in OS.get_environment("FOTO_ESCONDER").split(",", false): # depuração: some com a peça pelo nome
					for mi in no.find_children("*", "MeshInstance3D", true, false):
						if String(mi.get_meta("equip2_nome", "")).contains(e):
							mi.visible = false
				for ang in [["frente", 0.0], ["lado", -PI / 2], ["tres", -PI / 4], ["costas", PI]]:
					no.rotation.y = ang[1]
					await esperar(4)
					cam.global_position = c + Vector3(0, 0.1, 5.0)
					cam.look_at(c)
					fundo.global_position = c + Vector3(0, 0, -12)
					await esperar(2)
					await foto("%s-%s-r%d-%s" % [traje, corpo, r, ang[0]])
			no.queue_free()
			await esperar(3)
	quit()

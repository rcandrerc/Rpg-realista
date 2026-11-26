extends SceneTree
# VÍDEO: Roupão 2 / Patrulheiro 2 correndo (quadros seguidos, 30 por segundo, com o tronco para a frente do inclinar.gd)
# Roupão 2 / Patrulheiro 2 correndo, com a cor da Aparência aplicada DEPOIS de vestir (a ordem do jogo) (André 2026-11-26:
# "muda no visual, mas no jogo continua verde" e "quando eu corro, o peitoral aparece"). Quadros da corrida de frente e
# de lado. Uso: FOTO_SAIDA=/pasta [FOTO_R=1] [FOTO_TRAJES=roupao2] [FOTO_CORPOS=ruiva,cabelo_m] xvfb-run -a godot \
#   --path godot-prototipo --rendering-driver opengl3 --render-thread safe -s ../ferramentas/trajes-justos/correndo-foto.gd
const Aparencia := preload("res://aparencia.gd")
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
	var trajes := (OS.get_environment("FOTO_TRAJES") if OS.get_environment("FOTO_TRAJES") != "" else "roupao2").split(",")
	var corpos := (OS.get_environment("FOTO_CORPOS") if OS.get_environment("FOTO_CORPOS") != "" else "cabelo_m").split(",")
	var r := int(OS.get_environment("FOTO_R")) if OS.get_environment("FOTO_R") != "" else 1
	var ap := {"roupa": 0x6e1e2a, "calca": 0x6e1e2a, "borda": 0xd8a848}
	for traje in trajes:
		for corpo in corpos:
			var no: Node3D = m.modelo(corpo)
			no.set_meta("traje", traje)
			no.position = base
			var c := no.position + Vector3(0, 1.15, 0)
			var anim: AnimationPlayer = no.find_child("AnimationPlayer", true, false)
			Armadura.vestir(no, Armadura.de_texto("chapeu%d,peitoral%d,calca%d,botas%d" % [r, r, r, r]))
			await esperar(5)
			var a := ap.duplicate()
			a.traje = traje
			Aparencia.aplicar(no, a)
			await esperar(10)
			var esq: Skeleton3D = no.find_children("*", "Skeleton3D", true, false)[0]
			var inc = preload("res://inclinar.gd").new()
			esq.add_child(inc)
			inc.preparar(esq)
			inc.frente = 0.2
			inc.porte = 0.0 if esq.find_bone("J_Sec_L_Bust1") >= 0 else 1.0
			anim.play("corrida")
			var n := 0
			for ang in [["frente", -PI / 4], ["perto", 0.0]]:
				no.rotation.y = ang[1]
				var dist := 1.6 if ang[0] == "perto" else 2.6
				cam.global_position = c + Vector3(0, 0.05, dist)
				cam.look_at(c + Vector3(0, 0.05 if ang[0] == "perto" else -0.15, 0))
				fundo.global_position = c + Vector3(0, 0, -12)
				var L := anim.current_animation_length
				for q in 60:
					anim.seek(fmod(q / 30.0, L), true)
					anim.pause()
					await esperar(2)
					await foto("%s-%s-%04d" % [traje, corpo, n])
					n += 1
			no.queue_free()
			await esperar(3)
	quit()

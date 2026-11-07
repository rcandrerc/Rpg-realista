extends SceneTree
# Fotos do herói agarrado em várias pedras, antes (sem encostar.gd) e depois, vistas de lado.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --path godot-prototipo --rendering-driver vulkan -s ../ferramentas/escalada/foto-encostar.gd
var m
var saida := OS.get_environment("FOTO_SAIDA")
var cam: Camera3D

func esperar(n: int) -> void:
	for i in n:
		await process_frame

func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_jpg(saida + "/" + nome + ".jpg", 0.9)
	print("foto ", nome)

func agarrar_em(r: Dictionary, ang: float, alt: float) -> void:
	var mov = m.mov
	var dx := sin(ang)
	var dz := cos(ang)
	mov.esc = null
	mov.x = r.x - dx * (r.R + 0.5)
	mov.z = r.z - dz * (r.R + 0.5)
	mov.y = 0.0
	mov.ry = ang
	# chega andando até bater na pedra
	var d: float = r.R + 0.5
	while d > 0.0 and m.terreno.altura(r.x - dx * d, r.z - dz * d, 0.0) < 0.9:
		d -= 0.05
	mov.x = r.x - dx * (d + 0.3)
	mov.z = r.z - dz * (d + 0.3)
	mov.y = alt
	mov.agarrar()

func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(60)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	await esperar(10)
	cam = Camera3D.new()
	cam.fov = 50
	m.add_child(cam)
	var enc = m.encostar
	if m.get("dia") != null:
		m.dia.ajustar(13.0)
	# só as pedras 0 e 1 da vila passam da mini escalada (as outras o herói sobe direto)
	var casos := [[0, 0.6, 0.5], [0, 2.0, 1.2], [0, -1.0, 0.8], [0, -2.6, 0.4], [1, 1.6, 2.0], [1, 3.0, 1.0], [1, -1.5, 0.5]]
	var i := 0
	for c in casos:
		i += 1
		var r: Dictionary = m.terreno.solidos[c[0]]
		for fase in ["antes", "depois"]:
			if fase == "antes":
				enc.peso = 0.0
				m._encosta = 0.0
				m._encosta_giro = 0.0
				m.encostar = null
			else:
				m.encostar = enc
			agarrar_em(r, c[1], c[2])
			await esperar(50)
			if fase == "antes":
				enc.peso = 0.0
			var p: Vector3 = m.heroi.position
			var ry: float = m.mov.ry
			var lado := Vector3(cos(ry), 0, -sin(ry))
			var fr := Vector3(sin(ry), 0, cos(ry))
			cam.current = true
			cam.global_position = p + lado * 3.0 - fr * 0.6 + Vector3(0, 1.0, 0)
			cam.look_at(p + Vector3(0, 0.9, 0) + fr * 0.2)
			await esperar(3)
			enc.escolher_perto(p)
			var esq: Skeleton3D = m.heroi_esq
			var vao := []
			for o in ["J_Bip_R_Hand", "J_Bip_L_Hand", "J_Bip_R_ToeBase", "J_Bip_L_ToeBase", "J_Bip_C_Chest"]:
				var q: Vector3 = esq.global_transform * esq.get_bone_global_pose(esq.find_bone(o)).origin
				var hh: Dictionary = enc.raio(q - fr * 0.5, fr, 2.0)
				vao.append("%.2f" % (hh.t - 0.5) if not hh.is_empty() else "-")
			print("pedra ", c[0], " ang ", c[1], " ", fase, " encosta=%.2f giro=%.2f" % [m._encosta, m._encosta_giro], " mão D/E, pé D/E, peito até a pedra: ", vao)
			await foto("%d-pedra%d-%s" % [i, c[0], fase])
	quit()

extends SceneTree
# Acha onde a pele do peito/barriga fura o Roupão 2 / Patrulheiro 2 correndo (André 2026-11-26: "a camisa do roupão 2
# quando corre o peito ainda aparece"). Pinta sem luz: pele do tronco = magenta, robe = verde, manto = azul, resto cinza.
# Percorre a corrida inteira (FOTO_Q quadros) em 8 ângulos e conta pixels magenta; grava o pior quadro de cada caso.
# Uso: FOTO_SAIDA=/pasta [FOTO_R=0,1,2,3,4] [FOTO_TRAJES=roupao2] [FOTO_CORPOS=ruiva,cabelo_m] [FOTO_Q=24] xvfb-run -a godot \
#   --path godot-prototipo --rendering-driver opengl3 --render-thread safe -s ../ferramentas/trajes-justos/furo-detector.gd
const Aparencia := preload("res://aparencia.gd")
const Armadura := preload("res://armadura.gd")
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
var cam: Camera3D
var vp: SubViewport
func esperar(n: int) -> void:
	for i in n:
		await process_frame
func env(k: String, padrao: String) -> String:
	return OS.get_environment(k) if OS.get_environment(k) != "" else padrao
func unshaded(c: Color, vc := false) -> StandardMaterial3D:
	var s := StandardMaterial3D.new()
	s.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	s.albedo_color = c
	s.vertex_color_use_as_albedo = vc
	s.cull_mode = BaseMaterial3D.CULL_DISABLED if not vc else BaseMaterial3D.CULL_BACK # o pano do equip2 é cull_disabled
	return s
# copia a malha do corpo com cor de vértice: tronco (entre quadril e pescoço, sem braços) magenta, o resto cinza claro
func pintar_corpo(mi: MeshInstance3D, esq: Skeleton3D, dentro := Color(1, 0, 1), fora := Color(0.8, 0.8, 0.8)) -> int:
	var yq := esq.get_bone_global_rest(esq.find_bone("J_Bip_C_Hips")).origin.y
	var yp := esq.get_bone_global_rest(esq.find_bone("J_Bip_C_Neck")).origin.y
	var xo := absf(esq.get_bone_global_rest(esq.find_bone("J_Bip_L_UpperArm")).origin.x)
	var nova := ArrayMesh.new()
	nova.blend_shape_mode = mi.mesh.blend_shape_mode
	for i in mi.mesh.get_blend_shape_count():
		nova.add_blend_shape(mi.mesh.get_blend_shape_name(i))
	var pesos := []
	for i in mi.mesh.get_blend_shape_count():
		pesos.append(mi.get_blend_shape_value(i))
	var n := 0
	for s in mi.mesh.get_surface_count():
		var a: Array = mi.mesh.surface_get_arrays(s)
		var vs: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
		var cs := PackedColorArray()
		cs.resize(vs.size())
		for i in vs.size():
			var v := vs[i]
			var t := v.y > yq + 0.02 and v.y < yp - 0.01 and absf(v.x) < xo * 0.85
			cs[i] = dentro if t else fora
			n += 1 if t else 0
		a[Mesh.ARRAY_COLOR] = cs
		var nb: int = (a[Mesh.ARRAY_BONES] as PackedInt32Array).size() / maxi(1, vs.size())
		var bs: Array = mi.mesh.surface_get_blend_shape_arrays(s)
		for b in bs:
			b[Mesh.ARRAY_COLOR] = cs
		nova.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, a, bs, {}, Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS if nb == 8 else 0)
	mi.mesh = nova
	for i in pesos.size():
		mi.set_blend_shape_value(i, pesos[i])
	print("formas ", mi.name, " ", pesos.filter(func(x): return x != 0.0).size(), "/", pesos.size())
	mi.material_override = unshaded(Color.WHITE, true)
	mi.material_override.cull_mode = BaseMaterial3D.CULL_DISABLED if dentro.g > 0.5 else BaseMaterial3D.CULL_BACK
	return n
func _initialize() -> void:
	root.size = Vector2i(400, 600)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(60)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	await esperar(10)
	vp = SubViewport.new()
	vp.size = Vector2i(300, 400)
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(vp)
	cam = Camera3D.new()
	cam.fov = 30
	vp.add_child(cam)
	cam.current = true
	m.heroi.visible = false
	for cl in m.find_children("*", "CanvasLayer", true, false):
		cl.visible = false
	for no in m.get_children():
		if no is Node3D and not (no is WorldEnvironment):
			no.visible = false
	var base := Vector3(0, 300, 0)
	var rs := []
	for t in env("FOTO_R", "0,1,2,3,4").split(","):
		rs.append(int(t))
	var nq := int(env("FOTO_Q", "24"))
	var anim_nome := env("FOTO_ANIM", "corrida")
	for traje in env("FOTO_TRAJES", "roupao2").split(","):
		for corpo in env("FOTO_CORPOS", "ruiva,cabelo_m").split(","):
			for r in rs:
				var no: Node3D = m.modelo(corpo)
				no.set_meta("traje", traje)
				no.position = base
				var esq: Skeleton3D = no.find_child("*", true, false) if false else null
				for e in no.find_children("*", "Skeleton3D", true, false):
					esq = e
					break
				Armadura.vestir(no, Armadura.de_texto("chapeu%d,peitoral%d,calca%d,botas%d" % [r, r, r, r]))
				await esperar(5)
				Aparencia.aplicar(no, {"traje": traje, "roupa": 0x6e1e2a, "calca": 0x6e1e2a, "borda": 0xd8a848})
				await esperar(5)
				var vis := []
				var robe: MeshInstance3D = null
				for mi in no.find_children("*", "MeshInstance3D", true, false):
					if not mi.is_visible_in_tree() or env("FOTO_REAL", "") != "":
						continue
					var nome := String(mi.get_meta("equip2_nome", ""))
					if env("FOTO_SO_PELE", "") != "" and not (nome == "" and (String(mi.name).contains("Body") or mi.name == "Tronco")):
						continue
					if nome.begins_with("peito_robe"):
						pintar_corpo(mi, esq, Color(0, 1, 0), Color(1, 1, 0))
						robe = mi
					elif nome.begins_with("peito_manto"):
						mi.material_override = unshaded(Color(0, 0, 0.9))
					elif nome != "":
						mi.material_override = unshaded(Color(0.4, 0.4, 0.4))
					elif String(mi.name).contains("Body") or mi.name == "Tronco":
						for si in mi.mesh.get_surface_count():
							var mt = mi.get_active_material(si)
							print("  mat ", mi.name, " ", si, " ", mi.mesh.surface_get_name(si), " ", mt.get_class() if mt else "-", " transp=", mt.transparency if mt is BaseMaterial3D else "-", " shader=", (mt.shader.resource_path if mt is ShaderMaterial and mt.shader else ""))
						vis.append("%s:%d %s" % [mi.name, pintar_corpo(mi, esq), mi.mesh.get_aabb()])
					else:
						vis.append(String(mi.name))
						mi.material_override = unshaded(Color(0.3, 0.25, 0.2))
				print("visiveis ", corpo, " r", r, ": ", vis)
				var anim: AnimationPlayer = no.find_child("AnimationPlayer", true, false)
				# o peso do corpo do herói no jogo (inclinar.gd): tronco para a frente na arrancada e deitado na curva
				var inc = preload("res://inclinar.gd").new()
				esq.add_child(inc)
				inc.preparar(esq)
				inc.frente = float(env("FOTO_FRENTE", "0"))
				inc.inclinacao = float(env("FOTO_INCL", "0"))
				inc.porte = 0.0 if esq.find_bone("J_Sec_L_Bust1") >= 0 else 1.0
				if r == rs[0]:
					print("anims ", anim.get_animation_list())
				anim.play(anim_nome)
				var c := base + Vector3(0, 1.2 if corpo == "ruiva" else 1.3, 0)
				var pior := 0
				var soma := 0
				var pior_nome := ""
				for ang in 8:
					var pior_a := 0
					no.rotation.y = ang * PI / 4
					cam.global_position = c + (Vector3(0, 1.4, 2.4) if env("FOTO_ALTO", "") != "" else Vector3(0, 0.1, 2.0))
					cam.look_at(c)
					for q in nq:
						anim.seek(anim.current_animation_length * q / float(nq), true)
						anim.pause()
						await esperar(2)
						await RenderingServer.frame_post_draw
						var img := vp.get_texture().get_image()
						var sem: Image = null
						if robe and env("FOTO_REAL", "") == "":
							robe.visible = false
							await esperar(1)
							await RenderingServer.frame_post_draw
							sem = vp.get_texture().get_image()
							robe.visible = true
						var k := 0
						for y in range(0, img.get_height(), 2):
							for x in range(0, img.get_width(), 2):
								var p := img.get_pixel(x, y)
								if p.r > 0.8 and p.b > 0.8 and p.g < 0.3: # pele do tronco à mostra
									k += 1
								elif sem and p.g > 0.8 and p.r < 0.3 and p.b < 0.3: # robe do tronco na frente do manto
									var b := sem.get_pixel(x, y)
									if b.b > 0.8 and b.r < 0.2 and b.g < 0.2:
										k += 1
										img.set_pixel(x, y, Color(1, 0, 0))
						soma += k
						if (k > pior_a and k > 20 or env("FOTO_REAL", "") != "" and q == 0) and env("FOTO_ANGULOS", "") != "":
							pior_a = k
							img.save_png(saida + "/a-%s-%s-r%d-a%d.png" % [traje, corpo, r, ang])
						if k > pior:
							pior = k
							pior_nome = "%s-%s-r%d-a%d-q%d" % [traje, corpo, r, ang, q]
							img.save_png(saida + "/pior-%s-%s-r%d.png" % [traje, corpo, r])
				print("RESULTADO ", traje, " ", corpo, " r", r, " pior=", pior, " soma=", soma, " em ", pior_nome)
				no.queue_free()
				await esperar(3)
	quit()

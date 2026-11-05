extends SceneTree
# Fotos do relevo (montanha e lagos) na cena de verdade (renderer Mobile; no PC sem placa: xvfb + lavapipe).
# Uso: FOTO_SAIDA=/pasta godot --path godot-prototipo -s ../ferramentas/relevo/foto.gd   (FOTO_SO=3 tira só a foto 3)
var m
var saida := OS.get_environment("FOTO_SAIDA")

func esperar(n: int) -> void:
	for i in n:
		await process_frame

func foto(nome: String) -> void:
	await esperar(6)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
	print("foto ", nome)

func heroi_em(x: float, z: float, ry := 0.0) -> Vector3:
	var p := Vector3(x, m.terreno.altura(x, z), z)
	m.heroi.global_position = p
	m.heroi.rotation.y = ry
	return p

func olhar(de: Vector3, para: Vector3) -> void:
	m.camera.global_position = de
	m.camera.look_at(para)

func _initialize() -> void:
	root.size = Vector2i(1600, 900)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(5)
	for c in root.get_children():
		if c != m:
			c.queue_free()
	await esperar(60)
	for c in m.find_children("*", "CanvasLayer", true, false):
		c.visible = false
	m.set_process(false)
	m.set_physics_process(false)
	var ha: AnimationPlayer = m.heroi.find_child("AnimationPlayer", true, false)
	ha.play("parada")
	var so := OS.get_environment("FOTO_SO")
	var vistas := [
		["1-montanha-do-campo", Vector2(112, -18), Vector3(104, 12.0, -6), Vector3(176, 20, -54)],
		["2-montanha-pe-lago", Vector2(116, -27), Vector3(108, 7, -20), Vector3(170, 18, -54)],
		["3-lago-fundo", Vector2(90, 75), Vector3(85, 3.2, 72), Vector3(104, -1, 80)],
		["4-lago-raso-andando", Vector2(12, 45), Vector3(5, 2.6, 38), Vector3(12, 0.6, 45)],
		["5-lago-fundo-boiando", Vector2(100, 78), Vector3(94, 2.2, 72), Vector3(100, 0.2, 78)],
		["6-lago-oeste", Vector2(-38, -6), Vector3(-34, 3.5, -2), Vector3(-46, -0.5, -12)],
		["7-subindo-a-montanha", Vector2(140, -46), Vector3(133, 14, -40), Vector3(176, 30, -56)],
		["8-vista-do-alto", Vector2(160, -52), Vector3(166, 0, -56), Vector3(60, 0, 20)],
		["9-montanha-de-longe", Vector2(66, -3), Vector3(58, 14, 4), Vector3(176, 22, -54)],
	]
	for v in vistas:
		if so != "" and not v[0].begins_with(so):
			continue
		var p := heroi_em(v[1].x, v[1].y, atan2(v[3].x - v[1].x, v[3].z - v[1].y))
		var de: Vector3 = v[2]
		if v[0].begins_with("8"):
			var melhor := Vector2(176, -54)
			for i in 80:
				for j in 80:
					var q := Vector2(150 + i * 0.7, -80 + j * 0.7)
					if m.terreno.altura(q.x, q.y) > m.terreno.altura(melhor.x, melhor.y):
						melhor = q
			p = heroi_em(melhor.x - 1.5, melhor.y + 1.5, -2.3)
			de = p + Vector3(6, 7, -5)
			olhar(de, Vector3(40, 0, 30))
		else:
			de.y += m.terreno.altura(de.x, de.z) if de.y < 3.0 else 0.0
			olhar(de, v[3])
		await foto(v[0])
	print("alturas: pe ", m.terreno.altura(130, -40), " lago fundo ", m.terreno.altura(100, 78), " raso ", m.terreno.altura(12, 45))
	quit()

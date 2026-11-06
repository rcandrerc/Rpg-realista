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
		["1-montanha-longe-campo", Vector2(100, -12), Vector3(90, 9, -2), Vector3(188, 18, -62)],
		["2-montanha-longe-sul", Vector2(140, 30), Vector3(128, 11, 44), Vector3(188, 16, -62)],
		["3-lago-fundo-perto", Vector2(91, 74), Vector3(85, 2.6, 69), Vector3(101, -1, 80)],
		["4-lago-raso-perto", Vector2(11, 44), Vector3(4, 2.4, 38), Vector3(13, 0, 46)],
		["5-lago-oeste-beira", Vector2(-39, -8), Vector3(-34, 2.2, -2), Vector3(-46, -0.3, -12)],
		["6-lago-montanha", Vector2(112, -10), Vector3(106, 3.5, -4), Vector3(124, 0, -15)],
		["7-subindo-a-montanha", Vector2(150, -44), Vector3(141, 12, -36), Vector3(188, 26, -64)],
		["8-vista-do-alto", Vector2(188, -62), Vector3(0, 0, 0), Vector3(40, 0, 30)],
		# 2026-11-06: beira natural (grama clara + terra) e o Lago Grande ao sul das Terras da Estrada
		["9-lago-grande-chegada", Vector2(-6.4, 173), Vector3(-9.5, 2.6, 166.5), Vector3(-1, -0.6, 190)],
		["10-lago-grande-de-cima", Vector2(-6.4, 173), Vector3(-40, 24, 158), Vector3(-2, -1, 198)],
		["11-lago-grande-beira", Vector2(9, 181), Vector3(5, 2.2, 174.5), Vector3(22, -0.3, 192)],
		["12-lago-grande-outro-lado", Vector2(-30, 207.5), Vector3(-36, 2.4, 214), Vector3(-10, -0.5, 192)],
	]
	for v in vistas:
		if so != "" and not v[0].begins_with(so):
			continue
		var p := heroi_em(v[1].x, v[1].y, atan2(v[3].x - v[1].x, v[3].z - v[1].y))
		var de: Vector3 = v[2]
		if v[0].begins_with("8"):
			var melhor := Vector2(188, -62)
			for i in 80:
				for j in 80:
					var q := Vector2(165 + i * 0.6, -86 + j * 0.6)
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

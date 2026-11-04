extends SceneTree
# Fotos do monstro novo ao lado da Ruiva, na cena pintada de verdade (main.tscn), renderer Mobile (Vulkan/lavapipe).
var m
var saida := OS.get_environment("FOTO_SAIDA")
var tipo := OS.get_environment("FOTO_TIPO")

func esperar(n: int) -> void:
	for i in n:
		await process_frame

func foto(nome: String) -> void:
	await esperar(4)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
	print("foto ", nome)

func _initialize() -> void:
	root.size = Vector2i(1600, 900)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(5)
	for c in root.get_children():
		if c != m:
			c.queue_free()
	await esperar(90)
	for c in m.find_children("*", "CanvasLayer", true, false):
		c.visible = false
	m.set_process(false)
	m.set_physics_process(false)
	var base := Vector3(77.0, 0.0, -8.0) # centro da clareira 1
	base.y = m.terreno.altura(base.x, base.z)
	m.heroi.global_position = base + Vector3(-1.6, 0, 0)
	m.heroi.rotation.y = PI * 0.5
	var e = m.criar_inimigo(tipo, base + Vector3(1.4, 0, 0), "Warrok")
	e.no.global_position.y = m.terreno.altura(base.x + 1.4, base.z)
	m.empilhar_nomes()
	for x in m.inimigos:
		if x != e and x.no.global_position.distance_to(base) < 25.0:
			x.no.visible = false
	var no: Node3D = e.no
	var an: AnimationPlayer = e.anim
	var ha: AnimationPlayer = m.heroi.find_child("AnimationPlayer", true, false)
	ha.play("parada")
	var alvo := base + Vector3(0, 1.1, 0)
	var vistas := {"1-frente": [0.0, Vector3(0, 0, 1)], "2-lado": [-PI * 0.5, Vector3(0, 0, 1)], "3-costas": [PI, Vector3(0, 0, 1)]}
	for nome in vistas:
		no.rotation.y = vistas[nome][0]
		an.play("parada")
		m.camera.global_position = alvo + vistas[nome][1] * 5.0 + Vector3(0, 0.5, 0)
		m.camera.look_at(alvo)
		await foto(nome)
	no.rotation.y = -PI * 0.5
	m.camera.global_position = alvo + Vector3(0.8, 0.4, 4.6)
	m.camera.look_at(alvo)
	for k in [["4-golpe", "golpe1", 0.45], ["5-golpe2", "golpe2", 0.4], ["6-correndo", "corrida", 0.3], ["7-apanhando", "apanhar", 0.3], ["8-morte", "morrer", 0.95]]:
		an.play(k[1])
		an.seek(an.current_animation_length * k[2], true)
		an.pause()
		await foto(k[0])
	quit()

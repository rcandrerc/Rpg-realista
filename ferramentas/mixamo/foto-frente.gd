extends SceneTree
# v3: frente, lado e close do rosto; e a 10 m (olhos têm que aparecer)
var m
var saida := OS.get_environment("FOTO_SAIDA")
var tipos := OS.get_environment("FOTO_TIPO").split(",")
func esperar(n: int) -> void:
	for i in n:
		await process_frame
func foto(nome: String) -> void:
	await esperar(4)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
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
	var base := Vector3(77.0, 0.0, -8.0)
	base.y = m.terreno.altura(base.x, base.z)
	for x in m.inimigos:
		if x.no.global_position.distance_to(base) < 30.0:
			x.no.visible = false
	var grade: bool = tipos.size() > 1
	m.heroi.global_position = base + Vector3(-1.6 if not grade else -1.0 - 1.5 * tipos.size() * 0.5, 0, 0)
	m.heroi.rotation.y = 0.0
	var ns := []
	for i in tipos.size():
		var px := 1.4 if not grade else (i - (tipos.size() - 1) * 0.5) * 1.9 + 0.8
		var e = m.criar_inimigo(tipos[i], base + Vector3(px, 0, 0), tipos[i].capitalize())
		e.no.global_position.y = m.terreno.altura(base.x + px, base.z)
		ns.append(e)
	m.empilhar_nomes()
	var alvo := base + Vector3(0.0 if not grade else 0.8, 1.1, 0)
	if grade:
		m.camera.global_position = alvo + Vector3(0, 0.6, 9.5)
		m.camera.look_at(alvo)
		await foto("grade-frente")
		quit()
		return
	var no: Node3D = ns[0].no
	no.rotation.y = 0.0
	m.camera.global_position = alvo + Vector3(0, 0.5, 5.0)
	m.camera.look_at(alvo)
	await foto("1-frente")
	no.rotation.y = -PI * 0.5
	await foto("2-lado")
	no.rotation.y = 0.0
	var cab := base + Vector3(1.4, 1.95, 0)
	m.camera.global_position = cab + Vector3(0, 0.1, 1.6)
	m.camera.look_at(cab)
	await foto("3-rosto")
	m.camera.global_position = alvo + Vector3(0, 1.0, 10.5)
	m.camera.look_at(alvo)
	await foto("4-a-10m")
	quit()

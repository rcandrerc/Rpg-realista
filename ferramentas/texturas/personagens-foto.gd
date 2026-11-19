extends SceneTree
# Fotos de antes e depois das texturas dos PERSONAGENS no celular (parte 2 do ferramentas/texturas/celular.mjs, André
# 2026-11-19: "principalmente a de personagem, que é o que pesa mais"): a Ruiva de perto (rosto e corpo), a vila com
# os NPCs de vários corpos e cada NPC de perto. Imprime a memória de texturas da placa e de onde veio cada leitura de
# imagem pelo processador (imagem_cpu.gd: "gpu" > 0 seria leitura da placa, a que deixa a pele rosa no Mali-G72).
# Sem servidor.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 \
#   -s ../ferramentas/texturas/personagens-foto.gd
var m
var cam: Camera3D
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func memoria(nome: String) -> void:
	print("MEMORIA ", nome, " texturas ", roundi(Performance.get_monitor(Performance.RENDER_TEXTURE_MEM_USED) / 1048576.0),
		" MB, video ", roundi(Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED) / 1048576.0), " MB, leituras ",
		load("res://imagem_cpu.gd").origem)
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	memoria(nome)
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
func olhar(no: Node3D, dist: float, altura: float, alvo_y: float, lado := 0.0) -> void:
	var p: Vector3 = no.global_position
	var fr := Vector3(sin(no.global_rotation.y), 0, cos(no.global_rotation.y))
	var dir := fr.rotated(Vector3.UP, lado)
	cam.global_position = p + dir * dist + Vector3(0, altura, 0)
	cam.look_at(p + Vector3(0, alvo_y, 0))
func _initialize() -> void:
	root.size = Vector2i(1280, 720)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	# os NPCs da vila nascem um por vez (fila_npcs): espera todos
	for i in 1200:
		await process_frame
		if m.get("fila_npcs") is Array and m.fila_npcs.is_empty() and i > 300:
			break
	await esperar(60)
	cam = Camera3D.new()
	cam.fov = 40
	m.add_child(cam)
	cam.current = true
	var h: Node3D = m.heroi
	olhar(h, 1.0, 1.45, 1.42)
	await esperar(20)
	await foto("1-ruiva-rosto")
	olhar(h, 2.6, 1.1, 0.9, 0.5)
	await esperar(10)
	await foto("2-ruiva-corpo")
	cam.fov = 50
	var c: Vector3 = h.global_position
	cam.global_position = c + Vector3(4, 4, 9)
	cam.look_at(c + Vector3(0, 1, 0))
	await esperar(10)
	await foto("3-vila-de-cima")
	# um NPC de cada corpo, de perto
	var vistos := {}
	var k := 4
	for n in m.npcs:
		var mod := str(n.get("modelo", ""))
		if mod == "" or vistos.has(mod) or not (n.no is Node3D):
			continue
		vistos[mod] = true
		cam.fov = 40
		olhar(n.no, 1.9, 1.3, 1.1, 0.35)
		await esperar(8)
		await foto("%d-npc-%s-%s" % [k, mod, str(n.get("id", ""))])
		k += 1
		if k > 12:
			break
	quit()

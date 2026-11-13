extends SceneTree
# Foto da horta (André 2026-11-13: grama alta furando a terra arada e juntas da terra seca com falha), sem servidor:
# um terreno de mentira com canteiros arados um de cada vez (seco) e uma fileira regada, como no jogo.
# Uso: FOTO_SAIDA=/pasta FOTO_NOME=depois xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/horta-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
var ox := float(OS.get_environment("FOTO_DX")) if OS.get_environment("FOTO_DX") != "" else 0.0 # muda o terreno de lugar
var oz := float(OS.get_environment("FOTO_DZ")) if OS.get_environment("FOTO_DZ") != "" else 0.0
var nome := OS.get_environment("FOTO_NOME") if OS.get_environment("FOTO_NOME") != "" else "horta"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(n: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + n + ".png")
	print("foto ", n)
func lote(canteiros: Array, agora: float) -> void:
	var h := []
	for c in canteiros:
		h.append(["%d,%d" % [c[0] + int(ox), c[1] + int(oz)], "", 0, agora - 60000.0 if c[2] else null, agora - 60000.0])
	m.construcao.do_servidor_lote({"lote": "t1", "ret": [-14 + ox, 64 + oz, -4 + ox, 74 + oz], "dono": "Teste", "pecas": [], "horta": h, "agora": agora})
func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	if OS.get_environment("FOTO_SEM_LOD") != "":
		load("res://lod_malha.gd")._tarefa = 1 << 40
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	m.mov.por_em(Vector3(-11.0 + ox, 0, 66.5 + oz))
	m.heroi.position = m.mov.posicao()
	m.cam.yaw = float(OS.get_environment("FOTO_YAW")) if OS.get_environment("FOTO_YAW") != "" else 2.6
	m.cam.pitch = 0.75
	m.cam.dist = 7.5
	await esperar(int(OS.get_environment("FOTO_ESPERA")) if OS.get_environment("FOTO_ESPERA") != "" else 240) # o mato em volta nasce antes de o terreno chegar (como entrando no jogo)
	if OS.get_environment("FOTO_AUTO") != "": # a horta vai para o pedaço com mais mato perto do herói
		var hp: Vector3 = m.heroi.position
		var melhor := -1
		var bx := 0
		var bz := 0
		for di in range(-8, 5):
			for dj in range(-8, 5):
				var x0 := floori(hp.x) + di
				var z0 := floori(hp.z) + dj
				var n := 0
				for k in m.mato._vivos:
					for g in m.mato._vivos[k]:
						if g == null:
							continue
						var b2: PackedFloat32Array = g.multimesh.buffer
						for q in g.multimesh.instance_count:
							if b2[q * 16 + 3] > x0 and b2[q * 16 + 3] < x0 + 4 and b2[q * 16 + 11] > z0 and b2[q * 16 + 11] < z0 + 4:
								n += 1
				if n > melhor:
					melhor = n
					bx = x0
					bz = z0
		ox = bx + 11
		oz = bz - 67
		m.mov.por_em(Vector3(-11.0 + ox, 0, 66.5 + oz))
		m.heroi.position = m.mov.posicao()
		await esperar(5)
		print("horta no mato: ", bx, ",", bz, " touceiras ", melhor)
	var agora := Time.get_unix_time_from_system() * 1000.0
	# arando um por um, como o herói faz: cada aviso traz um canteiro a mais
	var cs := []
	for j in range(67, 71):
		for i in range(-11, -7):
			cs.append([i, j, false])
			lote(cs, agora)
			await esperar(3)
	for c in cs: # depois de arar tudo, rega a última fileira
		c[2] = c[1] == 70
	lote(cs, agora)
	await esperar(int(OS.get_environment("FOTO_DEPOIS")) if OS.get_environment("FOTO_DEPOIS") != "" else 300) # o mato confere os terrenos a cada 2 s
	await foto(nome)
	# conta o mato (capim e samambaia) dentro do terreno e em cima da terra arada
	var no_lote := 0
	var na_terra := 0
	for k in m.mato._vivos:
		for g in m.mato._vivos[k]:
			if g == null:
				continue
			var mm: MultiMesh = g.multimesh
			var b := mm.buffer
			for i in mm.instance_count:
				var x: float = b[i * 16 + 3]
				var z: float = b[i * 16 + 11]
				if b[i * 16 + 5] == 0.0:
					continue
				if x > -14 + ox and x < -4 + ox and z > 64 + oz and z < 74 + oz:
					no_lote += 1
				if x > -11.75 + ox and x < -6.75 + ox and z > 66.75 + oz and z < 71.25 + oz:
					na_terra += 1
	print("mato no terreno: ", no_lote, " em cima da terra arada: ", na_terra)
	m.cam.dist = 3.5
	await esperar(40)
	await foto(nome + "-perto")
	quit()

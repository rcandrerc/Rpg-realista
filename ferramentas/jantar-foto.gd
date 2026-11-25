extends SceneTree
const Idioma = preload("res://idioma.gd")
# Fotos do jantar do clã (André 2026-11-25): a Mesa do Clã de 8 lugares na base, os recrutas sentados comendo, o herói na
# cabeceira, os balões da conversa, a janela do jantar e o cartão na aba Clã.
# Os dados vêm do servidor de verdade (sem rede): node ferramentas/jantar-dados.mjs /tmp/jantar.json.
# Uso: JANTAR_JSON=/x/jantar.json FOTO_SAIDA=/pasta xvfb-run -a godot --fixed-fps 30 --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/jantar-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
var D: Dictionary
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
	print("FOTO ", nome)
func camera(alvo: Vector3, yaw: float, pitch: float, dist: float) -> void:
	m.cam.colocar(alvo)
	m.cam.yaw = yaw
	m.cam.pitch = pitch
	m.cam.dist = dist
	await esperar(12)
func recrutas() -> void:
	for i in 10: # um corpo novo por foto do servidor; o seguinte veste e pinta
		for r in D.rec:
			var j: Dictionary = {"id": r.id, "x": r.x, "y": r.y, "z": r.z, "ry": r.ry, "vida": 200, "vidaMax": 200, "morto": false, "anim": r.anim,
				"nome": r.nome, "nivel": 12, "visual": r.get("visual", "ruiva"), "aparencia": r.get("aparencia", {}), "roupa": "peitoral1,calca1,botas1", "modo": "Espada"}
			m.online._novos_foto = 0
			m.online._pesados_foto = 0
			m.online.outro(j)
		await esperar(30)
	print("OUTROS ", m.online.outros.keys())
	for r in D.rec:
		var o = m.online.outros.get(str(r.id))
		if o != null:
			o.no.global_position = Vector3(float(r.x), m.base_cla._chao(float(r.x), float(r.z)), float(r.z))
			o.no.rotation.y = float(r.ry)
# onde ficam o quadril e os pés na pose (para acertar o assento): no espaço do corpo (z = para a frente)
func _medir(no: Node3D, nome: String) -> void:
	var sk: Skeleton3D = no.find_child("*", true, false) as Skeleton3D
	for c in no.find_children("*", "Skeleton3D", true, false):
		sk = c
		break
	if sk == null:
		print("MEDIR ", nome, " sem esqueleto")
		return
	var inv := no.global_transform.affine_inverse()
	var out := []
	for b in sk.get_bone_count():
		var bn := sk.get_bone_name(b).to_lower()
		if bn.contains("hips") or bn.contains("foot") or bn.contains("upperleg") or bn.contains("thigh"):
			var g: Vector3 = inv * (sk.global_transform * sk.get_bone_global_pose(b).origin)
			out.append("%s=(%.2f,%.2f,%.2f)" % [sk.get_bone_name(b), g.x, g.y, g.z])
	print("MEDIR ", nome, " anim ", " ".join(out))
func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	D = JSON.parse_string(FileAccess.get_file_as_string(OS.get_environment("JANTAR_JSON")))
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	for i in 90:
		await process_frame
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(float(OS.get_environment("FOTO_HORA")) if OS.get_environment("FOTO_HORA") != "" else 17.5)
	Idioma.trocar("pt")
	m.online.meu_id = "A"
	m.online.ligado = true
	m.base_cla.do_servidor(D.bases)
	var M: Dictionary = D.M
	var mx := float(M.x)
	var mz := float(M.z)
	m.mov.por_em(Vector3(mx + 3.4, 0, mz + 1.5))
	m.heroi.position = m.mov.posicao()
	for k in 150:
		await process_frame
	var y: float = m.base_cla._chao(mx, mz)
	print("MESA ", M, " chao ", y, " minha_mesa ", m.base_cla.minha_mesa())
	# 1: a mesa sozinha na base, com o botão do jantar (herói perto)
	await camera(Vector3(mx, y + 0.6, mz), 0.75, 0.42, 7.5)
	await esperar(20)
	await foto("1-mesa-do-cla-na-base")
	# 2: a janela do jantar chamando (recrutas indo, comida na mesa)
	m.P.prog.mochila = [{"k": "pao_milho", "n": 4}, {"k": "torta_abobora", "n": 1}, {"k": "peixe", "n": 6}, null, {"k": "pedra", "n": 9}]
	m.jantar.do_servidor(D.mesaAntes)
	m.jantar.abrir()
	m.jantar.do_servidor(D.infoAntes)
	await esperar(20)
	await foto("2-janela-do-jantar")
	m.jantar.fechar()
	# 3: servido: todos sentados, pratos, o herói na cabeceira
	m.jantar.do_servidor(D.mesa)
	await recrutas()
	m.jantar.do_servidor(D.sentar)
	await esperar(40)
	await camera(Vector3(mx, y + 0.7, mz), 0.62, 0.38, 6.2)
	await esperar(20)
	await foto("3-jantar-servido")
	# 4: a conversa em balões
	var n := 0
	for f in D.falas:
		if n >= 3:
			break
		if not m.online.outros.has(str(f.id)):
			continue
		print("BALAO ", f.id, " ", f.texto)
		m.online._balao(str(f.id), str(f.texto), true, false)
		n += 1
		await esperar(25)
	await camera(Vector3(mx, y + 1.0, mz), -0.9, 0.3, 6.0)
	await esperar(30)
	await foto("4-conversa-na-mesa")
	# 5: de perto, de lado: a altura do assento
	await camera(Vector3(mx - 0.6, y + 0.6, mz), 0.0, 0.12, 3.6)
	await esperar(10)
	await foto("5-de-perto")
	_medir(m.heroi, "heroi")
	for id in m.online.outros:
		_medir(m.online.outros[id].no, str(id))
	await camera(Vector3(mx + 2.0, y + 0.6, mz), 1.57, 0.15, 3.2)
	await esperar(10)
	await foto("6-cabeceira-do-lider")
	# vídeo (FOTO_VIDEO=1): 10 s comendo, de perto (v0000.png...; o ffmpeg junta)
	if OS.get_environment("FOTO_VIDEO") == "1":
		await camera(Vector3(mx - 0.3, y + 0.7, mz), -0.5, 0.2, 3.8)
		for q in 300:
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(saida + "/v%04d.png" % q)
			await process_frame
	quit()

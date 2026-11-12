extends SceneTree
# Foto dos títulos (André 2026-11-12) no jogo de verdade, sem servidor: o herói com nome, nível e título em uso e
# quatro corpos com os outros brilhos; depois a aba Títulos do menu.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/titulos-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	m.hud.nome = "Aethra"
	m.P.prog.nivel = 47
	m.P.prog.tit = {"tem": ["cacador_novato", "cacador", "rei_matilha", "quebra_golem", "mata_dragao", "sentinela_ordem", "voz_estradas", "min10", "mer10", "fer20"], "uso": "mata_dragao"}
	m.P.prog.abates = 1200
	await esperar(60)
	# quatro "outros jogadores" lado a lado, como online.gd monta (barra_vida + titulos.por), de frente para a câmera
	var desl := Vector3(float(OS.get_environment("FOTO_DX")), 0, float(OS.get_environment("FOTO_DZ")))
	m.mov.por_em(m.heroi.position + desl)
	await esperar(10)
	var yaw := float(OS.get_environment("FOTO_YAW"))
	var base: Vector3 = m.heroi.position
	var dir := Vector3(cos(yaw), 0, -sin(yaw)) # de lado em relação à câmera
	var lados := [-3.2, -1.6, 1.6, 3.2]
	var fila := [["Bia", 12, "cacador_novato", "ruiva"], ["Caio", 23, "sentinela_ordem", "cabelo_m"], ["Lia", 31, "rei_matilha", "ruiva"], ["Davi", 40, "flagelo", "cabelo_m"]]
	for i in fila.size():
		var f = fila[i]
		var no: Node3D = m.modelo(f[3])
		m.add_child(no)
		no.position = base + dir * float(lados[i]) - Vector3(sin(yaw), 0, cos(yaw)) * 0.8
		no.position.y = m.terreno.altura_mundo(no.position.x, no.position.z) if m.get("terreno") != null and m.terreno.has_method("altura_mundo") else base.y
		no.rotation.y = yaw
		m.barra_vida(no, "%s · Nv %d" % [f[0], f[1]], Color(0.35, 0.85, 0.4))
		m.nome_legivel(no)
		var placa: Label3D = null
		for c in no.get_children():
			if c is Label3D:
				placa = c
				break
		m.titulos.por(no, placa, f[2])
		var ap = no.find_child("AnimationPlayer", true, false)
		var an: String = m.online.animacao("parada") if m.online else "parada"
		if ap and ap.has_animation(an):
			ap.play(an)
	m.heroi.rotation.y = yaw
	if m.get("h") != null and m.h.get("ry") != null:
		m.h.ry = yaw
	m.cam.yaw = yaw
	m.cam.pitch = 0.1
	m.cam.dist = 7.5
	await esperar(60)
	await foto("1-cabeca-frente")
	for k in 25: # o Mítico corre a cor
		await esperar(4)
	await foto("2-cabeca-brilho")
	m.cam.dist = 3.4
	m.cam.pitch = 0.18
	await esperar(60)
	await foto("3-heroi-perto")
	m.menu.abrir("titulos")
	await esperar(30)
	await foto("4-aba-titulos")
	m.menu.rolagem.scroll_vertical = 520
	await esperar(10)
	await foto("5-aba-titulos-rolada")
	quit()

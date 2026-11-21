extends SceneTree
# Fotos do navio mercante novo dentro do jogo (André 2026-11-21): no Cais de Vael, ancorado e com o herói no leme.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/navio-jogo-foto.gd
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
		m.dia.ajustar(15.0)
	# água funda mais perto do Cais de Vael
	var x := 101.3
	var z := 454.0
	var achou := false
	for r in range(12, 80, 2):
		for i in 24:
			var a := float(i) / 24.0 * TAU
			var L: Dictionary = m.terreno.no_lago(x + sin(a) * r, z + cos(a) * r)
			if not L.is_empty() and float(L.fundo) >= 3.0 and not m.terreno.no_lago(x + sin(a) * r * 1.4, z + cos(a) * r * 1.4).is_empty():
				x += sin(a) * r
				z += cos(a) * r
				achou = true
				break
		if achou:
			break
	print("navio em ", x, " ", z, " achou=", achou)
	var ry := 0.6
	var eu: String = str(m.online.meu_id) if m.online and "meu_id" in m.online else ""
	m.mov.por_em(Vector3(x + 8.0, m.chao_em(x + 8.0, z + 8.0), z + 8.0), true)
	m.heroi.position = m.mov.posicao()
	m.transporte.atualizar({"packs": [], "veic": [["n", eu, x, z, ry, 1, ["perola", "perola", "ervas", "obsid", "brasa", "perola", "ervas", "brasa", "obsid", "perola"], 0, 0]]})
	m.cam.colocar(Vector3(x, 1, z))
	m.cam.yaw = 2.2
	m.cam.pitch = 0.32
	m.cam.dist = 24.0
	await esperar(120)
	await foto("navio-jogo-1-ancorado")
	m.cam.yaw = -0.6
	m.cam.pitch = 0.45
	m.cam.dist = 18.0
	await esperar(60)
	await foto("navio-jogo-2-ancorado-outro-lado")
	# em pé no convés (passageiro), perto do mastro grande
	var fr := Vector3(sin(ry), 0, cos(ry))
	var ld := Vector3(cos(ry), 0, -sin(ry))
	var no_conves := Vector3(x, 0, z) + fr * -2.6 + ld * 0.6
	m.mov.por_em(Vector3(no_conves.x, 5.0, no_conves.z), true)
	m.heroi.position = m.mov.posicao()
	await esperar(20)
	print("no convés: y=", m.mov.y, " água=", m.terreno.agua.nivel)
	m.cam.yaw = ry + PI * 0.5 + 0.5
	m.cam.pitch = 0.4
	m.cam.dist = 9.0
	await esperar(60)
	print("no convés depois: y=", m.mov.y)
	await foto("navio-jogo-3-passageiro")
	# subir pela escada de corda: nadando do lado de fora, empurrando para o navio
	var esc: float = float(m.transporte.V.navio.solido.escada)
	var fora := Vector3(x, 0, z) + fr * esc + ld * 3.0
	m.mov.por_em(Vector3(fora.x, -2.0, fora.z), true)
	m.heroi.position = m.mov.posicao()
	await esperar(30)
	print("nadando: y=", m.mov.y)
	var t := 0
	while t < 150 and m.mov.y < float(m.terreno.agua.nivel) + 0.5:
		var cy: float = m.cam.yaw if "yaw" in m.cam else 0.0
		var r := (-ld).rotated(Vector3.UP, -cy)
		m.hud.mover = Vector2(r.x, r.z)
		await esperar(1)
		t += 1
	m.hud.mover = Vector2.ZERO
	await esperar(20)
	print("depois da escada: y=", m.mov.y, " (convés ", float(m.terreno.agua.nivel) + float(m.transporte.V.navio.solido.conves), ") lado=", (Vector3(m.mov.x, 0, m.mov.z) - Vector3(x, 0, z)).dot(ld))
	await foto("navio-jogo-4-escada")
	# no leme
	m.transporte.atualizar({"packs": [], "veic": [["n", eu, x, z, ry, 1, ["perola", "perola", "ervas", "obsid", "brasa", "perola", "ervas", "brasa", "obsid", "perola"], 0, 1]]})
	m.transporte.evento({"acao": "subiu", "k": "navio", "x": x, "z": z, "ry": ry})
	await esperar(30)
	m.cam.dist = 14.0
	m.cam.pitch = 0.35
	m.cam.yaw = ry + PI + 0.5
	await esperar(90)
	await foto("navio-jogo-5-no-leme")
	var pks := []
	for k in ["perola", "perola", "ervas", "obsid", "brasa", "perola", "ervas", "brasa", "obsid", "perola"]:
		pks.append({"k": k, "ox": 0, "oz": 0})
	m.P.prog.navio = {"porao": pks, "chao": null}
	m.transporte.abrir_navio()
	await esperar(20)
	await foto("navio-jogo-6-janela")
	quit()

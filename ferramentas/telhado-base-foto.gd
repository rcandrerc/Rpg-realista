extends SceneTree
# Foto das casas dos recrutas na base do clã (André 2026-11-26: "as casas ainda estão sem telhado até hoje").
# Mesma ordem do jogo: chegam os terrenos (lotes) e depois as bases, que nivelam o chão (base_cla.gd chao_mudou).
# Dados: node ferramentas/telhado-base-dados.mjs /tmp/telhado.json
# Uso: TELHADO_JSON=/tmp/telhado.json FOTO_SAIDA=/pasta FOTO_NOME=depois xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/telhado-base-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
var nome := OS.get_environment("FOTO_NOME") if OS.get_environment("FOTO_NOME") != "" else "telhado"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(n: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + n + ".png")
	print("FOTO ", n)
func _initialize() -> void:
	root.size = Vector2i(1280, 720)
	var D: Dictionary = JSON.parse_string(FileAccess.get_file_as_string(OS.get_environment("TELHADO_JSON")))
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(11.0)
	m.online.meu_id = "A"
	m.online.ligado = true
	var c: Dictionary = D.centro
	m.mov.por_em(Vector3(float(c.x), 0, float(c.z)))
	m.heroi.position = m.mov.posicao()
	m.construcao.do_servidor_lotes({"meu": "", "lista": D.lotes})
	await esperar(20)
	m.base_cla.do_servidor(D.bases)
	await esperar(200)
	var cs: Dictionary = D.casa
	var y: float = m.base_cla._chao(float(cs.x), float(cs.z))
	m.mov.por_em(Vector3(float(cs.x), 0, float(cs.z) + 9.0))
	m.heroi.position = m.mov.posicao()
	await esperar(30)
	for v in [[0.0, 0.62, 22.0, "-casa"], [PI * 0.25, 0.35, 16.0, "-lado"]]:
		m.cam.colocar(Vector3(float(cs.x), y + 2.0, float(cs.z)))
		m.cam.yaw = v[0]
		m.cam.pitch = v[1]
		m.cam.dist = v[2]
		await esperar(60)
		await foto(nome + v[3])
	for id in m.construcao.lotes:
		var L: Dictionary = m.construcao.lotes[id]
		var t = L.get("telhado")
		print("LOTE ", id, " pecas ", L.pecas.size(), " telhado_base ", L.get("telhado_base"), " chao ", m.base_cla._chao(float(L.def.x0 + L.def.x1) / 2.0, float(L.def.z0 + L.def.z1) / 2.0))
	quit()

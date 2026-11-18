extends SceneTree
# Fotos de antes e depois das texturas do celular (ferramentas/texturas/celular.mjs, conselho 18/11/2026): a vila de
# perto, o campo com árvores, a Vila do Rio Claro e o horizonte de longe (onde o mipmap muda alguma coisa). Imprime a
# memória de texturas da placa em cada vista. Sem servidor.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/texturas/texturas-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	print("MEMORIA ", nome, " texturas ", roundi(Performance.get_monitor(Performance.RENDER_TEXTURE_MEM_USED) / 1048576.0),
		" MB, video ", roundi(Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED) / 1048576.0), " MB")
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
func ir(x: float, z: float) -> void:
	m.mov.por_em(Vector3(x, -999.0, z), false)
	m.heroi.position = m.mov.posicao()
	m.cam.colocar(m.heroi.position)
func vista(nome: String, x: float, z: float, yaw: float, pitch: float, dist: float, k := 150) -> void:
	ir(x, z)
	m.cam.yaw = yaw
	m.cam.pitch = pitch
	m.cam.dist = dist
	await esperar(k)
	await foto(nome)
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
	await vista("1-vila", 0.0, 2.0, 0.6, 0.3, 9.0, 240)
	await vista("2-vila-chao-longe", 0.0, 2.0, 2.4, 0.12, 6.0)
	await vista("3-campo-arvores", 77.0, -8.0, 0.8, 0.22, 10.0)
	await vista("4-rio-claro", -196.0, 85.0, 1.2, 0.32, 12.0)
	await vista("5-horizonte", 40.0, 30.0, 0.0, 0.5, 40.0)
	await vista("6-arvore-perto", 77.0, -8.0, 2.6, 0.1, 4.0)
	quit()

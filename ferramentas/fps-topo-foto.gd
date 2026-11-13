extends SceneTree
# Foto do FPS no topo (André 2026-11-13, "jogar com a tela mais limpa"): o FPS sobe para junto do ping e os números do
# teste somem do meio da tela; um toque no topo mostra/esconde. Jogo de verdade, sem servidor (o "online" é de mentira,
# só para a linha do topo).
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/fps-topo-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
func topo_online() -> void:
	var o = m.online
	o.ligado = true
	o.jogadores = 3
	o.rede.ping_ms = 15
	o.rede.ult_pacote_ms = Time.get_ticks_msec()
	o.atualizar_status()
	o.ligado = false
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
	m.menu_topo.mostrar_fps = true
	var novo: bool = "detalhes_fps" in m.menu_topo # na main antiga (foto do antes) a chave não existe
	if novo:
		m.menu_topo.detalhes_fps = false
	m.menu_topo.aplicar_config()
	m.botao_teste.visible = true
	await esperar(60)
	await foto("0-sozinho")
	topo_online()
	await esperar(5)
	await foto("1-limpa")
	if not novo:
		quit()
		return
	m.menu_topo.trocar_detalhes()
	await esperar(30)
	topo_online()
	await foto("2-com-numeros")
	quit()

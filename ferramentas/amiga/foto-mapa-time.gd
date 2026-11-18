extends SceneTree
# Fotos do mapa com a Cecília e o Dario (André 2026-11-18: "só deve aparecer eles no mapa se eu der time"):
# fora do time (sem coração) e no time (coração com o nome), no minimapa e no mapa grande. O "online" é de mentira.
# Uso: FOTO_SAIDA=/pasta FOTO_SEM_LOD=1 xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/amiga/foto-mapa-time.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
	print("foto ", nome)
func online_de_mentira(no_time: bool) -> void:
	var o = m.online
	o.ligado = true
	o.jogadores = 3
	o.rede.ping_ms = 42
	o.rede.ult_pacote_ms = Time.get_ticks_msec()
	var h: Vector3 = m.heroi.position
	o.amiga_ids = ["npc_cecilia", "npc_dario"]
	o.no_mapa = [["npc_cecilia", h.x + 9.0, h.z - 6.0], ["npc_dario", h.x - 8.0, h.z + 7.0]]
	m.amigos.time = [] if not no_time else [
		{"id": str(o.meu_id), "nome": "André", "nivel": 1, "vida": 120, "vidaMax": 120, "mana": 100, "manaMax": 100, "x": h.x, "z": h.z},
		{"id": "npc_cecilia", "nome": "Cecília", "nivel": 4, "vida": 90, "vidaMax": 90, "mana": 60, "manaMax": 60, "x": h.x + 9.0, "z": h.z - 6.0},
		{"id": "npc_dario", "nome": "Dario", "nivel": 3, "vida": 80, "vidaMax": 80, "mana": 50, "manaMax": 50, "x": h.x - 8.0, "z": h.z + 7.0},
	]
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
	load("res://idioma.gd").trocar("pt")
	for k in 2:
		var tem := k == 1
		var nome := "com-time" if tem else "sem-time"
		online_de_mentira(tem)
		await esperar(20)
		online_de_mentira(tem)
		await foto("%d-minimapa-%s" % [k * 2 + 1, nome])
		m.minimapa.abrir()
		var m3 = m.minimapa.mapa3d
		for i in 600:
			await esperar(1)
			online_de_mentira(tem)
			if m3.pronto:
				break
		m3.lista_aberta = false
		for i in 60:
			online_de_mentira(tem)
			await esperar(1)
		await foto("%d-mapa-%s" % [k * 2 + 2, nome])
		m.minimapa.fechar()
		await esperar(20)
	quit()

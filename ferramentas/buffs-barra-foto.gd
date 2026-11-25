extends SceneTree
# Fotos dos buffs e debuffs perto da barra de vida (André 2026-11-25): herói (clã, comida, atordoado, lento), alvo
# (monstro atordoado, lento e Quebrado), time (recruta com fome, outro bem alimentado) e a dica ao tocar num ícone.
# No jogo de verdade, sem servidor: a lista bf é a mesma que a foto do servidor traria (shared/simulacao.js bfJogador).
# Uso: FOTO_SAIDA=/pasta FOTO_W=1280 FOTO_H=576 xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/buffs-barra-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
func _initialize() -> void:
	var w := int(OS.get_environment("FOTO_W")) if OS.get_environment("FOTO_W") != "" else 1280
	var h := int(OS.get_environment("FOTO_H")) if OS.get_environment("FOTO_H") != "" else 576
	DisplayServer.window_set_size(Vector2i(w, h))
	root.size = Vector2i(w, h)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	load("res://idioma.gd")._aplicar("pt") # o jogo do André é em português
	var o = m.online
	# alvo: a vaga de monstro mais perto; o herói vai para o lado dela e o jogo marca (alvo_quadro.gd)
	var melhor = null
	var md := INF
	for e in m.inimigos:
		if e.get("no") and is_instance_valid(e.no) and not e.get("vazio", false) and e.get("estado", "") != "morto" and not e.get("missao_vaga", false):
			var d: float = e.no.position.distance_to(m.heroi.position)
			if d < md:
				md = d
				melhor = e
	print("vagas: ", m.inimigos.size(), " mais perto: ", md)
	if melhor:
		var p: Vector3 = melhor.no.position + Vector3(4.0, 0.0, 4.0)
		m.mov.por_em(Vector3(p.x, m.chao_em(p.x, p.z), p.z), true)
		m.heroi.position = m.mov.posicao()
		m.cam.colocar(m.heroi.position)
	await esperar(150)
	# time: um recruta com fome (e envenenado), outro bem alimentado com o clã
	m.amigos.time = [{"id": "c1", "nome": "Flora Brasa", "nivel": 22, "vida": 80, "vidaMax": 100, "mana": 40, "manaMax": 60},
		{"id": "d1", "nome": "Bento Fogo", "nivel": 21, "vida": 55, "vidaMax": 100, "mana": 60, "manaMax": 60}]
	m.amigos.lider = "c1"
	o._desvio_srv = o._agora() - 1000.0 # relógio do servidor = 1000 s (as fotos levam alguns segundos)
	var ms: float = m.P.agora_ms()
	o.bf_meu = [["cla", 0, 4, 0.06], ["co", ms + 754000.0, "torta_abobora"], ["atordoa", 1040.0, 0], ["lento", 1060.0, 0.4]]
	o.outros["c1"] = {"no": Node3D.new(), "bf": [["cla", 0, 4, 0.06], ["mesa", 0, -0.1], ["veneno", 1050.0, 2]]}
	o.outros["d1"] = {"no": Node3D.new(), "bf": [["cla", 0, 4, 0.06], ["mesa", 0, 0.05], ["co", ms + 300000.0, "carne_assada"]]}
	for e in m.inimigos: # atordoado, lento e Quebrado
		if e.get("no") and is_instance_valid(e.no) and e.no.position.distance_to(m.heroi.position) < 30.0:
			e.bf = [["atordoa", 1030.0, 0], ["lento", 1070.0, 0.3], ["vuln", 1070.0, 0.2]]
	await esperar(12)
	print("alvo: ", m.alvo_atual != null)
	await foto("1-buffs-tela")
	# toca no 2º ícone do herói (a comida): dica
	var z: Array = m.buffs._zonas.get("heroi", [])
	if z.size() > 1:
		m.buffs.tocar(z[1][0].get_center())
	await esperar(6)
	await foto("2-dica-comida")
	if z.size() > 0:
		m.buffs.tocar(z[0][0].get_center())
	await esperar(6)
	await foto("3-dica-cla")
	var za: Array = m.buffs._zonas.get("alvo", [])
	if za.size() > 0:
		m.buffs.tocar(za[0][0].get_center())
	await esperar(6)
	await foto("4-dica-monstro-atordoado")
	quit()

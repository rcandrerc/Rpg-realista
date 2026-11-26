extends SceneTree
const Idioma = preload("res://idioma.gd")
const Patente = preload("res://patente.gd")
# Fotos da Patente de Guerra (André 2026-11-26): escudo com anel no quadro do herói, escudo em cima da cabeça (herói
# Sargento, Kira Capitão, Rufo Cabo), a dica ao tocar no escudo e a parte "Guerra do mês" na aba do clã.
# Sem servidor: os corpos e o resumo do clã são de exemplo, montados como o servidor manda (shared/patente.js).
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/patente-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
const KIRA := {"id": "kira", "ry": 3.14, "vida": 406, "vidaMax": 406, "morto": false, "anim": "Idle", "nome": "Kira", "nivel": 45, "roupa": "peitoral3,calca3,botas3,capa3",
	"visual": "ruiva", "aparencia": {"cabelo": 15328472, "olhos": 12593706, "roupa": 8038096, "calca": 2767450, "altura": 1.04, "olhosT": 1, "narizT": 1, "bocaT": 1, "penteado": "shibu_sombrio"},
	"modo": "Espada", "bot": 1, "raca": "geada", "pt": 5}
const RUFO := {"id": "rufo", "ry": 3.14, "vida": 388, "vidaMax": 388, "morto": false, "anim": "Idle", "nome": "Rufo", "nivel": 42, "roupa": "peitoral2,calca2,botas2,capa2",
	"visual": "cabelo_m", "aparencia": {"cabelo": 11026460, "olhos": 14725168, "roupa": 2372700, "calca": 3947090, "altura": 1.0, "olhosT": 1, "narizT": 1, "bocaT": 1, "penteado": "fumiriya"},
	"modo": "Espada", "bot": 1, "raca": "geada", "pt": 2}
func por(j: Dictionary, p: Vector3, ry: float) -> void:
	var x := j.duplicate(true)
	x.x = p.x
	x.y = p.y
	x.z = p.z
	x.ry = ry
	m.online.outro(x)
func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	for i in 90:
		await process_frame
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	m.online.meu_id = "eu"
	Idioma.trocar("pt")
	m.hud.nome = "André"
	m.P.prog["nivel"] = 42
	# 41 abates no mês: Sargento, 55% para Tenente
	m.P.prog["gu"] = {"m": Patente.mes(m.P.agora_ms()), "a": 41, "x": 3, "l": 0, "u": {}}
	var px := float(OS.get_environment("FOTO_X")) if OS.get_environment("FOTO_X") != "" else 530.0
	var pz := float(OS.get_environment("FOTO_Z")) if OS.get_environment("FOTO_Z") != "" else 52.0
	m.mov.por_em(Vector3(px, m.chao_em(px, pz), pz), true)
	m.heroi.position = m.mov.posicao()
	for k in 200:
		await process_frame
	var h: Vector3 = m.heroi.position
	m.cam.colocar(h)
	m.cam.yaw = float(OS.get_environment("FOTO_YAW")) if OS.get_environment("FOTO_YAW") != "" else 2.4
	m.cam.pitch = float(OS.get_environment("FOTO_PITCH")) if OS.get_environment("FOTO_PITCH") != "" else 0.12
	m.cam.dist = 5.2
	for k in 10:
		await process_frame
	var cb: Basis = root.get_viewport().get_camera_3d().global_transform.basis
	var fr := Vector3(-cb.z.x, 0, -cb.z.z).normalized()
	var lado := Vector3(cb.x.x, 0, cb.x.z).normalized()
	var pk := h + fr * 3.2 - lado * 1.6
	var pr := h + fr * 4.0 + lado * 1.8
	pk.y = m.chao_em(pk.x, pk.z)
	pr.y = m.chao_em(pr.x, pr.z)
	var olha := atan2(-fr.x, -fr.z)
	for i in 4:
		por(KIRA, pk, olha + 0.25)
		por(RUFO, pr, olha - 0.2)
		for k in 30:
			await process_frame
	m.heroi.rotation.y = atan2(fr.x, fr.z) + PI * 0.15
	m.online.outros.kira.no.rotation.y = olha + 0.25
	m.online.outros.rufo.no.rotation.y = olha - 0.2
	await esperar(30)
	await foto("1-tela-e-cabecas")
	# tocar no escudo do quadro: a dica
	var r: Rect2 = m.hud._patente_rect
	var ev := InputEventScreenTouch.new()
	ev.pressed = true
	ev.position = r.get_center()
	m.hud._input(ev)
	await esperar(8)
	await foto("2-dica-escudo")
	# aba do clã: Guerra do mês
	var st := {"hp": 380, "hpM": 400, "mp": 100, "mpM": 120, "vg": 80, "vgM": 140, "morto": 0}
	var rec := func(id, nome, nv): return {"id": id, "nome": nome, "tier": "Soldado", "nv": nv, "sem": 120, "on": 1, "fn": {"k": "livre"}, "c": "r:" + id} .merged(st)
	m.P.cla = {"n": "Brasa Viva", "cofre": 2400, "semana": 600, "prox": 3600000, "max": 6, "nv": 3, "eu": {"nome": "André", "nv": 42}.merged(st),
		"m": [rec.call("a1", "Flora", 30), rec.call("a2", "Bento", 28), rec.call("a3", "Lia", 33), rec.call("a4", "Caio", 26)], "funcoes": [], "recursos": [], "tiers": [], "log": [], "dep": [100, 1000],
		"gu": {"mes": "2026-11", "r": {"chama": 137, "geada": 118}, "cla": 74, "eu": {"i": 3, "pct": 0.55, "a": 41, "x": 3, "l": 0},
			"m": [{"nome": "Flora", "i": 2, "pct": 0.9, "a": 14}, {"nome": "Bento", "i": 1, "pct": 0.3, "a": 8}, {"nome": "Lia", "i": 1, "pct": 0.7, "a": 12}, {"nome": "Caio", "i": 0, "pct": 0.4, "a": 2}]}}
	m.P.cla_t = Time.get_ticks_msec()
	m.menu._aquecendo = true # sem servidor: o menu do clã monta do resumo de exemplo
	m.menu.abrir("cla")
	await esperar(20)
	# rola até a Guerra do mês
	var alvo: Control = null
	for n in m.menu.conteudo.get_children():
		if n is PanelContainer and alvo == null:
			for l in n.find_children("*", "Label", true, false):
				if l.text.begins_with("Guerra do m") or l.text.begins_with("War"):
					alvo = n
	if alvo:
		var sc = m.menu.conteudo.get_parent()
		while sc and not (sc is ScrollContainer):
			sc = sc.get_parent()
		if sc:
			sc.scroll_vertical = int(alvo.position.y) - 10
	print("guerra achada: ", alvo != null)
	await esperar(12)
	await foto("3-aba-cla-guerra")
	quit()

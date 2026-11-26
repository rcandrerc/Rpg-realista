extends SceneTree
const Idioma = preload("res://idioma.gd")
const Patente = preload("res://patente.gd")
# Fotos do nome em cima da cabeça (André 2026-11-26): nome do clã antes do nome e cor pela facção de quem olha (a sua =
# azul, a inimiga = vermelho). Herói e Dário (Chama) azuis, Kira e Rufo (Geada) vermelhos.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/nomes-cla-foto.gd
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
	"modo": "Espada", "bot": 1, "raca": "geada", "pt": 5, "cn": "Lobos da Geada"}
const RUFO := {"id": "rufo", "ry": 3.14, "vida": 388, "vidaMax": 388, "morto": false, "anim": "Idle", "nome": "Rufo", "nivel": 42, "roupa": "peitoral2,calca2,botas2,capa2",
	"visual": "cabelo_m", "aparencia": {"cabelo": 11026460, "olhos": 14725168, "roupa": 2372700, "calca": 3947090, "altura": 1.0, "olhosT": 1, "narizT": 1, "bocaT": 1, "penteado": "fumiriya"},
	"modo": "Espada", "bot": 1, "raca": "geada", "pt": 2, "cn": "Lâminas Cinzentas"}
const DARIO := {"id": "dario", "ry": 3.14, "vida": 420, "vidaMax": 420, "morto": false, "anim": "Idle", "nome": "Dário", "nivel": 44, "roupa": "peitoral3,calca3,botas3,capa3",
	"visual": "cabelo_m", "aparencia": {"cabelo": 3355443, "olhos": 6710886, "roupa": 9055202, "calca": 3947090, "altura": 1.05, "olhosT": 1, "narizT": 1, "bocaT": 1, "penteado": "fumiriya"},
	"modo": "Espada", "bot": 1, "pt": 3, "cn": "Guarda da Chama"}
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
	m.P.prog["cla"] = {"n": "Brasa Viva", "m": []}
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
	var pd := h + fr * 2.2 + lado * 2.6
	pd.y = m.chao_em(pd.x, pd.z)
	pk.y = m.chao_em(pk.x, pk.z)
	pr.y = m.chao_em(pr.x, pr.z)
	var olha := atan2(-fr.x, -fr.z)
	for i in 4:
		por(KIRA, pk, olha + 0.25)
		por(RUFO, pr, olha - 0.2)
		por(DARIO, pd, olha - 0.5)
		for k in 30:
			await process_frame
	m.heroi.rotation.y = atan2(fr.x, fr.z) + PI * 0.15
	m.online.outros.kira.no.rotation.y = olha + 0.25
	m.online.outros.rufo.no.rotation.y = olha - 0.2
	await esperar(30)
	await foto("1-nomes-cla-cores")
	m.cam.dist = 3.6
	await esperar(20)
	await foto("2-nomes-perto")
	quit()

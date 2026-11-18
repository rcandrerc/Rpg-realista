extends SceneTree
const Idioma = preload("res://idioma.gd")
# Fotos do chat Local (André 2026-11-18): Kira e Rufo (Geada) perto do herói, balões em cima da cabeça e a aba Local.
# Sem servidor: os corpos e as mensagens são de exemplo, montados como o servidor manda.
# Uso: FOTO_SAIDA=/pasta [FOTO_VIDEO=1] xvfb-run -a godot --fixed-fps 30 --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/chat-local-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
var video := OS.get_environment("FOTO_VIDEO") == "1"
var quadro := 0
func esperar(k: int) -> void:
	for i in k:
		await process_frame
		if video: # com --fixed-fps 30 cada quadro é 1/30 s do jogo
			await RenderingServer.frame_post_draw
			root.get_texture().get_image().save_png(saida + "/v%04d.png" % quadro)
			quadro += 1
func foto(nome: String) -> void:
	if video:
		return
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
const KIRA := {"id": "kira", "ry": 3.14, "vida": 406, "vidaMax": 406, "morto": false, "anim": "Idle", "nome": "Kira", "nivel": 45, "roupa": "peitoral3,calca3,botas3,capa3",
	"visual": "ruiva", "aparencia": {"cabelo": 15328472, "olhos": 12593706, "roupa": 8038096, "calca": 2767450, "altura": 1.04, "olhosT": 1, "narizT": 1, "bocaT": 1, "penteado": "shibu_sombrio"},
	"modo": "Espada", "bot": 1, "raca": "geada"}
const RUFO := {"id": "rufo", "ry": 3.14, "vida": 388, "vidaMax": 388, "morto": false, "anim": "Idle", "nome": "Rufo", "nivel": 42, "roupa": "peitoral2,calca2,botas2,capa2",
	"visual": "cabelo_m", "aparencia": {"cabelo": 11026460, "olhos": 14725168, "roupa": 2372700, "calca": 3947090, "altura": 1.0, "olhosT": 1, "narizT": 1, "bocaT": 1, "penteado": "fumiriya"},
	"modo": "Espada", "bot": 1, "raca": "geada"}
func por(j: Dictionary, p: Vector3, ry: float) -> void:
	var x := j.duplicate(true)
	x.x = p.x
	x.y = p.y
	x.z = p.z
	x.ry = ry
	m.online.outro(x)
# a Geada fala na língua dela: o herói (Chama) lê embaralhado (o texto vem do servidor, linguaDe em shared/guerra.js)
func local(id: String, nome: String, texto: String, meu := false, lingua := "") -> void:
	var ev := {"t": "chat", "canal": "local", "c": "c1" if meu else "a:" + id, "nome": nome, "texto": texto, "hora": Time.get_unix_time_from_system() * 1000.0, "meu": meu}
	if lingua != "":
		ev.lingua = lingua
	m.chat.do_servidor(ev)
	m.online._balao("eu" if meu else id, texto, not meu, lingua != "")
func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await process_frame
	await process_frame
	for i in 88:
		await process_frame
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	m.online.meu_id = "eu"
	Idioma.trocar("pt")
	# no Juncal, a casa da Geada (RACAS.geada.casa)
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
	m.cam.dist = 4.4
	for k in 10:
		await process_frame
	var cb: Basis = root.get_viewport().get_camera_3d().global_transform.basis
	var fr := Vector3(-cb.z.x, 0, -cb.z.z).normalized()
	var lado := Vector3(cb.x.x, 0, cb.x.z).normalized()
	var pk := h + fr * 3.0 - lado * 1.3
	var pr := h + fr * 3.8 - lado * 3.4
	pk.y = m.chao_em(pk.x, pk.z)
	pr.y = m.chao_em(pr.x, pr.z)
	var olha := atan2(-fr.x, -fr.z) # virados para o herói
	for i in 4: # 1º quadro monta o corpo, o seguinte veste e pinta
		por(KIRA, pk, olha + 0.25)
		por(RUFO, pr, olha - 0.2)
		for k in 30:
			await process_frame
	m.heroi.rotation.y = atan2(fr.x, fr.z)
	m.online.outros.kira.no.rotation.y = olha + 0.25 # sem servidor ninguém gira o corpo
	m.online.outros.rufo.no.rotation.y = olha - 0.2
	for id in m.online.outros:
		var o = m.online.outros[id]
		print("OUTRO ", id, " ", o.no.global_position, " vis ", o.no.visible, " heroi ", h)
	await esperar(45)
	local("", "André", "Kira, cadê o Kael? Fugiu de novo?", true)
	await esperar(60)
	await foto("1-balao-andre")
	local("kira", "Kira", "Ul ostdra ul nöeld kja helrün.", false, "geada") # "Não entendo essa língua de brasa."
	await esperar(75)
	await foto("2-balao-kira")
	local("rufo", "Rufo", "Vyr? Ith ulkja, sarkar kja ys!", false, "geada") # "Hã? Fala direito, cabeça de fogo!"
	await esperar(90)
	await foto("3-balao-rufo")
	local("kira", "Kira", "Rün, eldskä. Vyrul kar vihel rünsar.", false, "geada") # "Rufo, quieto. Deixa ele falar sozinho."
	await esperar(60)
	m.chat.abrir("local")
	await esperar(40)
	await foto("4-aba-local")
	await esperar(60)
	quit()

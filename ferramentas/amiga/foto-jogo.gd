extends SceneTree
# Fotos da Cecília no jogo, ligado num servidor de teste (fase 1): a casa e a horta, ela de perto, a conversa e o minimapa.
# Uso: RPG_SERVIDOR=http://localhost:2567 RPG_SESSAO=<sessão da conta de teste> FOTO_SAIDA=/pasta \
#   xvfb-run -a godot --path godot-prototipo --rendering-driver vulkan -s ../ferramentas/amiga/foto-jogo.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
var cam: Camera3D
func esperar(n: int) -> void:
	for i in n:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_jpg(saida + "/" + nome + ".jpg", 0.9)
	print("foto ", nome)
func cecilia():
	var id: String = m.online.amiga_id
	return m.online.outros.get(id) if id != "" else null
func _initialize() -> void:
	root.size = Vector2i(1280, 720)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(60)
	m.online.rede.conta = {"nome": "Andre"}
	m.online.rede.entrar_na_sala()
	for i in 600:
		await esperar(1)
		if cecilia() != null:
			break
	m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	await esperar(90)
	var o = cecilia()
	print("cecilia: ", o != null, " amiga_id=", m.online.amiga_id)
	if o == null:
		await foto("0-sem-cecilia")
		quit()
		return
	# 1) a casa e a horta, de cima e de frente
	cam = Camera3D.new()
	cam.fov = 50
	m.add_child(cam)
	var c: Vector3 = Vector3(-9, 0, 54)
	c.y = m.terreno.altura(c.x, c.z)
	cam.current = true
	cam.global_position = c + Vector3(3, 7, 13)
	cam.look_at(c + Vector3(0, 1, 0))
	await esperar(10)
	var no: Node3D = o.no
	print("cecilia em ", no.position)
	await foto("1-casa-e-horta")
	# 2) ela de perto, onde estiver
	for k in 3:
		var p: Vector3 = no.position
		var fr := Vector3(sin(no.rotation.y), 0, cos(no.rotation.y))
		cam.global_position = p + fr * 3.2 + Vector3(0.6, 1.6, 0)
		cam.look_at(p + Vector3(0, 1.0, 0))
		await esperar(4)
		await foto("2-ela-%d" % k)
		await esperar(140)
	# 3) o herói vai até ela andando sozinho (toque no corpo dela) e abre a conversa
	cam.current = false
	m.camera.current = true
	m.conversa.indo = {"npc": m.conversa._amiga_npc(), "ate": m.tempo + 60.0, "d": 999.0, "t": m.tempo}
	for i in 1500:
		await esperar(1)
		if m.conversa.aberto():
			break
	print("conversa aberta: ", m.conversa.aberto(), " heroi ", m.heroi.position)
	await esperar(8)
	await foto("3-conversa")
	# fase 2: chama para o time (tenta até 3 vezes) e anda até a Rosa; ela vem atrás
	for k in 3:
		m.rede("amiga", {"acao": "time"})
		await esperar(40)
		if m.amigos and m.amigos.em_time():
			break
	await foto("4-time")
	m.conversa.fechar()
	var rosa = null
	for n in m.npcs:
		if str(n.get("id", "")) == "comerciante":
			rosa = n
	m.conversa.indo = {"npc": rosa, "ate": m.tempo + 60.0, "d": 999.0, "t": m.tempo}
	for i in 600:
		await esperar(1)
		if m.conversa.aberto():
			break
	m.conversa.fechar()
	await esperar(60)
	await foto("5-seguindo")
	cam.current = true
	var hp: Vector3 = m.heroi.position
	cam.global_position = hp + Vector3(4, 2.2, 4)
	cam.look_at(hp + Vector3(0, 1, 0))
	await esperar(5)
	await foto("6-seguindo-de-lado")
	quit()

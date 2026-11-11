extends SceneTree
# Fotos das 3 opções de visual do Dario, o amigo guerreiro (corpo cabelo_m), André 2026-11-11.
# As cores são da lista do criador (CRIADOR em shared/dados.js): o servidor só aceita essas.
# Uso: xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/amigo/foto-opcoes.gd
const Aparencia := preload("res://aparencia.gd")
const Armadura := preload("res://armadura.gd")
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
var cam: Camera3D
func esperar(n: int) -> void:
	for i in n:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_jpg(saida + "/" + nome + ".jpg", 0.92)
	print("foto ", nome)
const VAR := [
	{"nome": "A", "cabelo": 0xd9b36c, "olhos": 0x3a6fd0, "roupa": 0x4a5a32, "calca": 0x5a4632, "altura": 1.04, "eq": "peitoral1,calca1,botas1,capa1"},
	{"nome": "B", "cabelo": 0x1c1a1f, "olhos": 0xe0b030, "roupa": 0x24345c, "calca": 0x222226, "altura": 1.06, "penteado": "fumiriya", "eq": "peitoral2,calca2,botas2,capa2"},
	{"nome": "C", "cabelo": 0xa8401c, "olhos": 0x3d8a4a, "roupa": 0x6b4a2e, "calca": 0x222226, "altura": 1.08, "eq": "peitoral0,calca0,botas0"},
]
func boneca(v: Dictionary, pos: Vector3, ry: float) -> Node3D:
	var no: Node3D = m.modelo("cabelo_m")
	no.position = pos
	no.position.y = m.terreno.altura(pos.x, pos.z)
	no.rotation.y = ry
	Aparencia.aplicar(no, {"cabelo": v.cabelo, "olhos": v.olhos, "roupa": v.roupa, "calca": v.calca, "altura": v.altura, "penteado": v.get("penteado")})
	Armadura.vestir(no, Armadura.de_texto(v.eq))
	var esq: Skeleton3D = m.esqueleto(no)
	var lugar = m.lugar_armas("cabelo_m").get("espadaCostas")
	if esq and lugar is Dictionary:
		m.prender(esq, m.nova_arma("espada", false), lugar)
	return no
func _initialize() -> void:
	root.size = Vector2i(1280, 720)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(60)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	await esperar(10)
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	cam = Camera3D.new()
	cam.fov = 40
	m.add_child(cam)
	cam.current = true
	var h: Vector3 = m.heroi.position
	m.heroi.visible = false
	for cl in m.find_children("*", "CanvasLayer", true, false):
		cl.visible = false
	for no in m.get_children():
		if no is Node3D and no != m.heroi and no.find_child("AnimationPlayer", true, false) and no.position.distance_to(h + Vector3(-2, 0, -4)) < 6.0:
			no.visible = false
	var base := h + Vector3(-2, 0, -4)
	var bonecas := []
	for i in VAR.size():
		bonecas.append(boneca(VAR[i], base + Vector3((i - 1) * 1.5, 0, 0), 0.0))
	await esperar(30)
	# as três de frente
	var c := base + Vector3(0, m.terreno.altura(base.x, base.z) + 0.95, 0)
	for ang in [[0.0, "1-frente"], [PI / 2, "2-lado"], [PI, "3-costas"]]:
		for b in bonecas:
			b.rotation.y = ang[0]
		await esperar(5)
		cam.global_position = c + Vector3(0, 0.15, 5.2)
		cam.look_at(c)
		await esperar(3)
		await foto(ang[1])
	# rosto de cada uma
	for i in bonecas.size():
		bonecas[i].rotation.y = 0.0
		var p: Vector3 = bonecas[i].position + Vector3(0, 1.55, 0)
		cam.global_position = p + Vector3(0, 0.02, 1.0)
		cam.look_at(p)
		await esperar(3)
		await foto("4-rosto-" + VAR[i].nome)
	# na cidadezinha, de longe
	for b in bonecas:
		b.rotation.y = 0.5
	cam.fov = 55
	cam.global_position = c + Vector3(-3, 2.5, 9)
	cam.look_at(c + Vector3(0, -0.3, 0))
	await esperar(5)
	await foto("5-cidadezinha")
	quit()

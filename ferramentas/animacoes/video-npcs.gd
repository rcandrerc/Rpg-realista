extends SceneTree
# Vídeo dos NPCs vivos (André 2026-11-27, vida_npc.gd): os NPCs dando voltinhas (ferreiros também), com a câmera
# parada olhando. No fim (CHEGA=1) o herói chega perto e o NPC volta para o lugar dele (onde se fala e se compra).
# Uso (da raiz do repositório):
#   CENA=ferraria xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 --render-thread safe \
#     --write-movie /tmp/ferraria.avi --fixed-fps 30 -s ../ferramentas/animacoes/video-npcs.gd
# CENA = ferraria (Tomás) | praca (Aldo, Irmã Lúcia, Mirela) | vila (NPC de uma mini vila: NPC=v_galdino).
# SEG = segundos gravados (padrão 30).
var m

func esperar(n: int) -> void:
	for i in n:
		await process_frame

func _initialize() -> void:
	root.size = Vector2i(1280, 720)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online:
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	var espera := 0
	while m.get("aquecer") != null and m.aquecer != null and not m.aquecer.feito and espera < 30 * 30:
		await process_frame
		espera += 1
		_sem_hud()
	_sem_hud()
	var seg := float(OS.get_environment("SEG")) if OS.get_environment("SEG") != "" else 30.0
	var cena := OS.get_environment("CENA") if OS.get_environment("CENA") != "" else "ferraria"
	var alvo := Vector3.ZERO
	var cam_de := Vector3.ZERO
	var heroi_em := Vector2.ZERO
	match cena:
		"ferraria":
			var b: Dictionary = _estacao("pub_bigorna")
			alvo = Vector3((1.5 + float(b.x)) / 2.0, 0, (-4.2 + float(b.z)) / 2.0)
			var fr := float(b.get("ry", -1.25)) # a frente aberta da ferraria
			alvo = Vector3(float(b.x) - sin(fr) * -1.0, 0, float(b.z) - cos(fr) * -1.0) # onde o ferreiro bate
			cam_de = alvo + Vector3(sin(fr) * 3.2 + cos(fr) * 1.8, 1.0, cos(fr) * 3.2 - sin(fr) * 1.8)
			heroi_em = Vector2(alvo.x + sin(fr) * 11.0, alvo.z + cos(fr) * 11.0)
		"praca":
			alvo = Vector3(-1.0, 0, -15.5)
			cam_de = alvo + Vector3(-7.5, 4.2, 5.5)
			heroi_em = Vector2(alvo.x - 12.0, alvo.z + 9.0)
		"vila":
			var id := OS.get_environment("NPC") if OS.get_environment("NPC") != "" else "v_galdino"
			var n: Dictionary = {}
			for o in m.mundo.get("npcs", []):
				if str(o.id) == id:
					n = o
			alvo = Vector3(float(n.x), 0, float(n.z))
			var ry := float(n.ry)
			cam_de = alvo + Vector3(sin(ry) * 6.0 + cos(ry) * 1.5, 2.0, cos(ry) * 6.0 - sin(ry) * 1.5)
			heroi_em = Vector2(alvo.x + sin(ry) * 11.0, alvo.z + cos(ry) * 11.0)
	_por_em(heroi_em.x, heroi_em.y)
	m.heroi.visible = false
	await esperar(200) # os NPCs perto aparecem (um por quadro) e os corpos montam
	alvo.y = m.terreno.altura(alvo.x, alvo.z, 0.5) + 0.9
	cam_de.y += m.terreno.altura(cam_de.x, cam_de.z)
	var cam := Camera3D.new()
	cam.fov = 50
	m.add_child(cam)
	cam.global_position = cam_de
	cam.look_at(alvo)
	cam.current = true
	m.camera = cam # fora_da_tela (main.gd) olha esta câmera: senão o NPC longe para de animar no vídeo
	_sem_hud()
	var q := int(seg * 30.0)
	var chega := OS.get_environment("CHEGA") == "1"
	for i in q:
		if chega and i == int(q * 0.7): # o herói chega perto: o NPC volta para o lugar dele
			_por_em(alvo.x - 2.0, alvo.z + 1.5)
		if i % 60 == 0:
			for n in m.npcs:
				if n.has("vv") and n.vv.tipo != "nada" and n.no.position.distance_to(alvo) < 12.0:
					print("NPC ", i, " ", n.id, " ", n.vv.est, " ", n.vv.an.current_animation, " ", n.vv.an.current_animation_position, " ", n.vv.an.callback_mode_process)
		await process_frame
	quit()

func _sem_hud() -> void:
	for c in m.find_children("*", "CanvasLayer", true, false):
		c.visible = false

func _estacao(id: String) -> Dictionary:
	for e in m.mundo.get("estacoes", []):
		if str(e.id) == id:
			return e
	return {"x": 4.4, "z": -4.4}

func _por_em(x: float, z: float) -> void:
	m.mov.por_em(Vector3(x, m.terreno.altura(x, z), z))
	m.heroi.position = m.mov.posicao()
	if m.cam:
		m.cam.colocar(m.heroi.position)

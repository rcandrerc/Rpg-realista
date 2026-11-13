extends SceneTree
# vídeo do barquinho: rema reto até a velocidade final e faz curva fechada; a câmera do jogo atrás e um pouco de cima.
# Uso: xvfb-run -a godot --path godot-prototipo --rendering-driver vulkan --write-movie /tmp/barco.avi --fixed-fps 30 -s ../ferramentas/barco/video.gd
# VEL/GIRO no ambiente sobrescrevem dados (para o "antes").
var m
func esperar(n: int) -> void:
	for i in n:
		await process_frame
func _initialize() -> void:
	root.size = Vector2i(1280, 720)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(60)
	if m.online:
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	var B: Dictionary = m.transporte.V.barquinho
	if OS.get_environment("VEL") != "":
		B.vel = float(OS.get_environment("VEL"))
		B.giro = float(OS.get_environment("GIRO"))
	print("barquinho vel=", B.vel, " giro=", B.giro)
	var x := -27.0
	var z := 198.0
	m.mov.x = x
	m.mov.z = z
	m.mov.ry = PI * 0.5
	m.transporte.atualizar({"packs": [], "veic": [["b", str(m.online.meu_id) if m.online else "", x, z, PI * 0.5, 1, [], 0, 1]]})
	m.transporte.evento({"acao": "subiu", "k": "barquinho", "x": x, "z": z, "ry": PI * 0.5})
	await esperar(30)
	var t := 0
	while t < 30 * 22:
		var s: float = float(t) / 30.0
		var cy: float = m.cam.yaw if "yaw" in m.cam else 0.0
		var d := Vector3(1, 0, 0) # leste, pelo comprido do lago
		if s > 11.0:
			d = Vector3(-0.3, 0, -1).normalized() # curva fechada
		var r := d.rotated(Vector3.UP, -cy)
		m.hud.mover = Vector2(r.x, r.z)
		if t % 30 == 0:
			print("t=", s, " v=", m.mov.veiculo.get("v", 0.0), " pos=", m.mov.x, ",", m.mov.z)
		await process_frame
		t += 1
	quit()

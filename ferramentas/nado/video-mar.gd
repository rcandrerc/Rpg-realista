extends SceneTree
# vídeo do nado no mar (André 2026-11-18): sai da praia, nada para o mar aberto, mergulha e volta à superfície.
# Imprime a estamina a cada segundo (o nado gasta; submerso gasta mais).
# Uso: xvfb-run -a godot --path godot-prototipo --rendering-driver vulkan --write-movie /tmp/mar.avi --fixed-fps 30 -s ../ferramentas/nado/video-mar.gd
var m
func esperar(n: int) -> void:
	for i in n:
		await process_frame
func _initialize() -> void:
	root.size = Vector2i(720, 1280) if OS.get_environment("VERTICAL") != "" else Vector2i(1280, 720)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(60)
	if m.online:
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	m.mov.nevoa = null # a zona da praia pode estar fechada na conta nova do teste
	# praia a sudoeste (shared/relevo.js marNadavel: mar fundo logo ao norte daqui)
	m.mov.x = -196.0
	m.mov.z = 390.0
	m.mov.y = m.mov.T.altura(-196.0, 390.0, 50.0)
	m.mov.ry = 0.0
	await esperar(45)
	var t := 0
	var dur := 30 * 24
	while t < dur:
		var s: float = float(t) / 30.0
		var cy: float = m.cam.yaw if "yaw" in m.cam else 0.0
		var d := Vector3(0, 0, 1)
		if s > 15.0:
			d = Vector3(0.6, 0, 1).normalized()
		var r := d.rotated(Vector3.UP, -cy)
		m.hud.mover = Vector2(r.x, r.z)
		var bt_a: Dictionary = m.hud.botao("afundar")
		var bt_s: Dictionary = m.hud.botao("subir")
		if bt_a is Dictionary:
			bt_a["apertado"] = s > 12.0 and s < 14.5
		if bt_s is Dictionary:
			bt_s["apertado"] = s > 19.0
		if t % 30 == 0:
			print("t=%d pos=%.1f,%.1f y=%.2f nada=%s merg=%.2f vel=%.2f sta=%.1f" % [int(s), m.mov.x, m.mov.z, m.mov.y, m.mov.nadando(), m.mov.mergulho, m.mov.velocidade(), m.trabalho.sta])
		await process_frame
		t += 1
	quit()

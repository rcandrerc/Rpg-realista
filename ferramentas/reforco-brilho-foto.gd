extends SceneTree
# Foto do brilho do reforço nas armas (André 2026-11-24): espada e cajado em +0, +9, +10, +20, +30 e +40.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/reforco-brilho-foto.gd
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
const NIVEIS := [0, 9, 10, 20, 30, 40]
var quadros := 0
var armas := []
var mg = null

func _initialize() -> void:
	DisplayServer.window_set_size(Vector2i(1280, 720))
	root.size = Vector2i(1280, 720)
	var Armas = load("res://armas.gd")
	var cena := Node3D.new()
	root.add_child(cena)
	var amb := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.02, 0.02, 0.03)
	env.ambient_light_color = Color(0.5, 0.5, 0.55)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.glow_enabled = true
	amb.environment = env
	cena.add_child(amb)
	var sol := DirectionalLight3D.new()
	sol.rotation = Vector3(-0.7, 0.6, 0)
	cena.add_child(sol)
	var cam := Camera3D.new()
	cam.position = Vector3(0, 0.42, 2.45)
	cam.fov = 40
	cena.add_child(cam)
	for j in NIVEIS.size():
		for t in ["espada", "cajado"]:
			var a: Node3D = load("res://armas3d/%s.glb" % t).instantiate()
			Armas.preparar(a)
			cena.add_child(a)
			var x := (j - (NIVEIS.size() - 1) / 2.0) * 0.36 + (-0.08 if t == "espada" else 0.08)
			a.position = Vector3(x, -0.05 if t == "espada" else -0.2, 0)
			a.scale *= 0.85 if t == "cajado" else 1.0
			Armas.brilho_reforco(a, NIVEIS[j], t)
			armas.append(a)
		var l := Label3D.new()
		l.text = "+%d" % NIVEIS[j]
		l.font_size = 48
		l.position = Vector3((j - (NIVEIS.size() - 1) / 2.0) * 0.36, -0.35, 0)
		l.pixel_size = 0.002
		cena.add_child(l)

func _process(_dt: float) -> bool:
	quadros += 1
	if quadros == 40:
		var img := root.get_texture().get_image()
		img.save_png(saida + "/reforco-brilho.png")
		print("foto: ", saida, "/reforco-brilho.png")
		return true
	return false

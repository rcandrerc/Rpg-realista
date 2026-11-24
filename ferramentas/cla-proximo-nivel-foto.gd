extends SceneTree
# Fotos do "Próximo nível" do clã no menu (André 2026-11-24: igual ao painel.html, ícones tenho/preciso, e o
# Fragmento de Alma como fumaça espiritual). Sem servidor: clã de exemplo.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/cla-proximo-nivel-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
const FALSO := """extends Node
var P
var menu
var hud
var tempo := 0.0
var teste := false
var online = null
var heroi = null
func on(): return true
func rede(_a, _b = null): pass
func aviso(_t = ""): pass
"""
func _initialize() -> void:
	root.size = Vector2i(720, 1000)
	var fundo := ColorRect.new()
	fundo.color = Color(0.12, 0.13, 0.11)
	fundo.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(fundo)
	var sc := GDScript.new()
	sc.source_code = FALSO
	sc.reload()
	m = Node.new()
	m.set_script(sc)
	root.add_child(m)
	m.hud = m
	m.P = load("res://progresso.gd").new()
	m.menu = load("res://menu.gd").new(m)
	m.add_child(m.menu)
	await esperar(10)
	m.P.prog["nivel"] = 52
	m.P.cla = {"n": "Brasa Viva", "nv": 4, "max": 4, "cofre": 6200, "semana": 900, "prox": 3600000, "base": {"nv": 2, "x": 40, "z": 30, "tem": "Paliçada", "centro": 12, "raio": 30},
		"m": [], "eu": {"nome": "André", "nv": 52},
		"sobe": {"nv": 5, "lider": 50, "ouro": 10000, "itens": [
			{"k": "barra_aco", "nome": "Barra de Aço", "n": 40, "tem": 40},
			{"k": "cristal", "nome": "Cristal", "n": 20, "tem": 7},
			{"k": "alma_geada", "nome": "Fragmento de Alma Geada", "n": 80, "tem": 35}]}}
	var jan := PanelContainer.new()
	jan.add_theme_stylebox_override("panel", load("res://menu.gd").caixa(Color(0.075, 0.065, 0.055, 0.97), Color(0.6, 0.48, 0.27), 2, 10, 14))
	jan.position = Vector2(20, 20)
	jan.custom_minimum_size = Vector2(680, 0)
	var cv := CanvasLayer.new()
	cv.layer = 30
	root.add_child(cv)
	cv.add_child(jan)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 6)
	jan.add_child(vb)
	m.menu.conteudo = vb
	m.menu.montar_cla()
	await esperar(15)
	await foto("cla-proximo-nivel")
	quit()

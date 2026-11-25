extends SceneTree
# Fotos da moral dos recrutas (André 2026-11-25, MORAL): os cartões do menu do clã com a produção ~N/h, a seta e o %
# que rende, e o Elogiar. Sem servidor: dados de exemplo.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/moral-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
# Sem os modelos (pasta modelos/ fora do git), o main.tscn não sobe: um "main" de mentira só com o que a ficha usa.
const FALSO := """extends Node
var P
var menu
var troca
var hud
var visual := "cabelo_m"
var tempo := 0.0
var teste := false
var online = null
var chat = null
var h := {"modo": "Espada", "vida": 100.0, "mana": 50.0}
func rede(_a, _b = null): pass
var bloqueado := false
func on(): return true
func aviso(_t = ""): pass
func nova_arma(_k): return Node3D.new()
func modelo(_v):
	var pai := Node3D.new()
	var n := Node3D.new()
	pai.add_child(n)
	return n
"""
func _initialize() -> void:
	root.size = Vector2i(720, 1280)
	var fundo := ColorRect.new()
	fundo.color = Color(0.22, 0.3, 0.2)
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
	var C := {"funcoes": [{"id": "livre", "nome": "Livre"}, {"id": "seguir", "nome": "Me seguir"}, {"id": "grind", "nome": "Grind"}, {"id": "recurso", "nome": "Farmar recurso"}, {"id": "proteger", "nome": "Proteger"}, {"id": "fazenda", "nome": "Fazenda"}],
		"recursos": [{"k": "ferro", "nome": "minério de ferro"}, {"k": "lenha", "nome": "lenha"}, {"k": "peixe", "nome": "peixe"}], "plantas": [], "veic": {}}
	var base := {"hp": 820, "hpM": 900, "mp": 120, "mpM": 150, "vg": 64, "vgM": 130, "on": 1, "x": 10, "z": 10, "c": "r:x", "tier": "Soldado", "sem": 120}
	var l := [
		{"id": "rc0001", "nome": "Kira", "nv": 34, "fn": {"k": "grind"}, "fz": "Caçando lobos", "ml": 94, "re": 110, "seta": "cima", "cor": "#3fbf3f", "ph": {"i": "espada", "n": 22}, "el": 1},
		{"id": "rc0002", "nome": "Flora Brasa", "nv": 29, "fn": {"k": "recurso", "r": "lenha"}, "fz": "Coletando", "ml": 78, "re": 100, "seta": "cima", "cor": "#9ad86a", "ph": {"i": "lenha", "n": 20}},
		{"id": "rc0003", "nome": "Rufo", "nv": 31, "fn": {"k": "recurso", "r": "ferro"}, "fz": "Coletando", "ml": 52, "re": 90, "seta": "lado", "cor": "#e8c95a", "ph": {"i": "minerio_ferro", "n": 14}},
		{"id": "rc0004", "nome": "Lia", "nv": 19, "fn": {"k": "grind"}, "fz": "Caçando puglins", "ml": 18, "re": 60, "seta": "baixo", "cor": "#e5574a", "ph": {"i": "espada", "n": 9}},
	]
	for f in root.get_children():
		if f is CanvasLayer:
			f.queue_free()
	var jan := PanelContainer.new()
	jan.add_theme_stylebox_override("panel", load("res://menu.gd").caixa(Color(0.075, 0.065, 0.055, 0.97), Color(0.6, 0.48, 0.27), 2, 10, 14))
	jan.position = Vector2(20, 10)
	jan.custom_minimum_size = Vector2(680, 0)
	var cv := CanvasLayer.new()
	cv.layer = 30
	root.add_child(cv)
	cv.add_child(jan)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 8)
	jan.add_child(vb)
	m.menu.conteudo = vb
	m.P.cla = C
	for r in l:
		var d: Dictionary = base.duplicate()
		d.merge(r, true)
		vb.add_child(m.menu._cartao_cla(d, "%s Nv %d · %d/semana" % [str(d.tier), int(d.nv), int(d.sem)], d, l, C))
	await esperar(12)
	await foto("1-menu-cla-moral")
	quit()

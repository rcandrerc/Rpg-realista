extends SceneTree
# Fotos do selo da mochila dos recrutas + botão Esvaziar de cada um (André 2026-11-27), menu do clã. Sem servidor: dados de exemplo.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/mochila-recruta-foto.gd
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
func cartoes(ms: Array, C: Dictionary) -> void:
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
	vb.add_child(m.menu.rotulo("Membros", 17, m.menu.OURO_CLARO))
	for r in ms:
		vb.add_child(m.menu._cartao_cla(r, "%s Nv %d · %d/semana" % [str(r.tier), int(r.nv), int(r.sem)], r, ms, C))
	m.menu._quebrar_linhas(vb) # igual ao menu de verdade (quebra os textos compridos)
	await esperar(10)

func _initialize() -> void:
	root.size = Vector2i(720, 1000)
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
	var base := {"tier": "Recruta", "sem": 40, "on": 1, "hp": 1109, "hpM": 1109, "mp": 200, "mpM": 200, "vg": 82, "vgM": 161, "fn": {"k": "livre"}, "fz": "Parado", "fzT": 0}
	var ms := [
		base.merged({"id": "a1", "nome": "Bento Lobo", "nv": 62, "cheia": 1, "mo": [160, 160]}, true),
		base.merged({"id": "a2", "nome": "Enzo Serra", "nv": 67, "mo": [150, 160], "vg": 66, "vgM": 166}, true),
		base.merged({"id": "a3", "nome": "Ivo Escudo", "nv": 69, "mo": [127, 160]}, true),
		base.merged({"id": "a4", "nome": "Rui Brasa", "nv": 40, "on": 0}, true),
	]
	var C := {"m": ms, "funcoes": [{"id": "livre", "nome": "Livre"}, {"id": "grind", "nome": "Grind"}, {"id": "recurso", "nome": "Farmar recurso"}], "recursos": []}
	await cartoes(ms.slice(0, 2), C)
	await foto("1-cheia-e-quase")
	for f in root.get_children():
		if f is CanvasLayer:
			f.queue_free()
	await esperar(2)
	await cartoes(ms.slice(2, 4), C)
	await foto("2-com-espaco-e-fora-do-mundo")
	quit()

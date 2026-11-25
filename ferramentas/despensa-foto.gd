extends SceneTree
# Fotos da Despensa do clã (André 2026-11-24, DESPENSA): o painel do clã com a Despensa em símbolos (tenho/preciso),
# bem alimentados e com fome + base sem lenha. Sem servidor: dados de exemplo.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/despensa-foto.gd
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
func painel(C: Dictionary, nome: String) -> void:
	for f in root.get_children():
		if f is CanvasLayer:
			f.queue_free()
	await esperar(2)
	var jan := PanelContainer.new()
	jan.add_theme_stylebox_override("panel", load("res://menu.gd").caixa(Color(0.075, 0.065, 0.055, 0.97), Color(0.6, 0.48, 0.27), 2, 10, 14))
	jan.position = Vector2(40, 10)
	jan.custom_minimum_size = Vector2(620, 0)
	var cv := CanvasLayer.new()
	cv.layer = 30
	root.add_child(cv)
	cv.add_child(jan)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 6)
	jan.add_child(vb)
	m.menu.conteudo = vb
	m.P.cla = C
	m.menu.call(nome, C)
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
	var rac := {"lambari": 1, "sardinha": 1, "tilapia": 1, "traira": 2, "robalo": 2, "garoupa": 3, "atum": 4, "carne": 1, "rabanete": 1, "cenoura": 1, "batata": 1, "tomate": 1, "milho": 1, "abobora": 2, "carne_assada": 3, "peixe_assado": 3, "sopa_legumes": 3, "pao_milho": 3, "ensopado": 5, "torta_abobora": 5}
	var bem := {"bau": 1, "n": 7, "dia": 27, "bem": 54, "tem": 118, "tipos": 4, "tiposBem": 3, "k": {"tilapia": 34, "peixe_assado": 12, "ensopado": 6, "abobora": 9}, "racao": rac, "estado": "Bem alimentados", "mult": 0.05, "bemOk": 1,
		"lenha": {"semana": 70, "tem": 140, "deve": 0, "frio": 0}}
	var fome := {"bau": 1, "n": 7, "dia": 27, "bem": 54, "tem": 0, "tipos": 0, "tiposBem": 3, "k": {}, "racao": rac, "estado": "Famintos", "mult": -0.25, "fome": 1,
		"lenha": {"semana": 70, "tem": 12, "deve": 70, "frio": 1}}
	await painel({"dsp": bem}, "_despensa_cla")
	await foto("1-despensa-bem-alimentados")
	await painel({"dsp": fome}, "_despensa_cla")
	await foto("2-despensa-com-fome-sem-lenha")
	quit()

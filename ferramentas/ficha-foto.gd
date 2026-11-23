extends SceneTree
# Fotos da ficha (André 2026-11-23): o perfil na janela de equipamento (recruta e jogador), os 3 candidatos do
# Recrutador e a "Minha ficha" do jogador (aba Status). Sem servidor: eventos de exemplo.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/ficha-foto.gd
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
func aviso(_t = ""): pass
func nova_arma(_k): return Node3D.new()
func modelo(_v):
	var pai := Node3D.new()
	var n := Node3D.new()
	pai.add_child(n)
	return n
"""
func _initialize() -> void:
	root.size = Vector2i(1280, 576)
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
	m.troca = load("res://troca.gd").new(m)
	m.add_child(m.troca)
	await esperar(10)
	var ficha := {"jeito": "Brincalhona", "txt": "brincalhão, conta piada até no meio da luta", "estilo": "Magia", "co": 0.74, "cu": 0.41, "ca": 0.86, "gosto": "Pescar", "pts": {"for": 7, "int": 44, "vit": 49}}
	m.troca.mostrar_equip({"nome": "Rita Corvo", "nivel": 24, "equip": {"cajado": {"k": "cajado", "r": 2}, "corpo": {"k": "peitoral", "r": 1}},
		"perfil": {"raca": "Chama", "cla": "Lobos do Norte", "recruta": 1, "atr": {"for": 5, "int": 31, "vit": 30, "des": 3}, "ficha": ficha}})
	await esperar(20)
	await foto("1-perfil-recruta")
	m.troca.equip_jan.visible = false
	m.troca.mostrar_equip({"nome": "André", "nivel": 62, "equip": {"espada": {"k": "espada", "r": 3}}, "duelos": {"v": 12, "d": 4},
		"perfil": {"raca": "Chama", "cla": "Lobos do Norte", "lider": 1, "estilo": "Espada", "atr": {"for": 120, "int": 20, "vit": 80, "des": 3}, "ficha": {"jeito": "Competitivo", "estilo": "Espada", "gosto": "Caçar", "jogador": 1}}})
	await esperar(20)
	await foto("2-perfil-jogador")
	m.troca.equip_jan.visible = false
	m.P.prog["ouro"] = 5000
	m.troca.mostrar_candidatos({"tier": "recruta", "nome": "Recruta", "l": [
		{"nome": "Artur Lobo", "g": "m", "nv": 1, "preco": 150, "sem": 25, "ap": {"cabelo": 0x6b4429}, "ficha": {"jeito": "Medroso", "txt": "medroso mas esforçado, treina escondido", "estilo": "Magia", "co": 0.27, "cu": 0.64, "ca": 0.82, "gosto": "Minerar", "pts": {"for": 9, "int": 43, "vit": 48}}},
		{"nome": "Bento Neve", "g": "m", "nv": 1, "preco": 150, "sem": 25, "ap": {"cabelo": 0xd9b36c}, "ficha": {"jeito": "Ambicioso", "txt": "ambicioso, quer subir de posto no clã", "estilo": "Espada", "co": 0.86, "cu": 0.24, "ca": 0.14, "gosto": "Caçar", "pts": {"for": 45, "int": 8, "vit": 47}}},
		{"nome": "Clara Brasa", "g": "f", "nv": 1, "preco": 150, "sem": 25, "ap": {"cabelo": 0xa8401c}, "ficha": {"jeito": "Gentil", "txt": "calmo e gentil, cuida dos feridos", "estilo": "Meio a meio", "co": 0.38, "cu": 0.93, "ca": 0.52, "gosto": "Pescar", "pts": {"for": 23, "int": 26, "vit": 51}}}]})
	await esperar(20)
	await foto("3-candidatos")
	m.troca.cand_jan.visible = false
	m.P.prog["fic"] = {"j": 8, "e": "espada", "g": "cacar"}
	# só a parte nova da aba Status (o menu inteiro precisa do herói 3D)
	var jan := PanelContainer.new()
	jan.add_theme_stylebox_override("panel", load("res://menu.gd").caixa(Color(0.075, 0.065, 0.055, 0.97), Color(0.6, 0.48, 0.27), 2, 10, 14))
	jan.position = Vector2(390, 150)
	jan.custom_minimum_size = Vector2(500, 0)
	var cv := CanvasLayer.new()
	cv.layer = 30
	root.add_child(cv)
	cv.add_child(jan)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 6)
	jan.add_child(vb)
	m.menu.conteudo = vb
	m.menu._minha_ficha()
	await esperar(10)
	await foto("4-minha-ficha")
	quit()

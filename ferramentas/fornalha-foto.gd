extends SceneTree
# Fotos da fornalha com 2 espaços (André 2026-11-26): Material 2 para o aço (2 carvões) e carvão obrigatório do ferro em
# diante. Sem servidor: o evento "forno" é montado à mão e a janela é a de verdade (construcao.gd _montar_forno).
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/fornalha-foto.gd
var m
var c
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

func janela(ev: Dictionary, nome: String) -> void:
	c.forno = ev
	c.forno_tipo = "fornalha"
	c.painel_forno.visible = true
	c._montar_forno()
	await esperar(10)
	await foto(nome)

func _initialize() -> void:
	root.size = Vector2i(720, 760)
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
	m.P.prog["mochila"] = [{"k": "carvao", "n": 12}, {"k": "lenha", "n": 30}, {"k": "minerio_ferro", "n": 9}, {"k": "barra_ferro", "n": 6}, {"k": "minerio_cobre", "n": 6}, null, null, null, null, null, null, null, null, null]
	c = load("res://construcao.gd").new(m)
	c.tela = CanvasLayer.new()
	root.add_child(c.tela)
	c.forno_id = "p1"
	c._montar_tela_forno()
	var base := {"p": "p1", "tipo": "fornalha", "abrir": false, "fogo": 0.0, "fogoK": "", "fogoMax": 0, "prog": 0.0, "dur": 0, "faz": "", "anda": false, "precisa": "", "pede2": null, "sai": null}
	# 1: aço andando (1 barra de ferro, 2 carvões no Material 2, carvão no combustível)
	var a := base.duplicate()
	a.merge({"comb": {"k": "carvao", "n": 5}, "ent": {"k": "barra_ferro", "n": 3}, "ent2": {"k": "carvao", "n": 6}, "fogo": 21.0, "fogoK": "carvao", "fogoMax": 30, "prog": 9.0, "dur": 30, "faz": "barra_aco", "anda": true}, true)
	await janela(a, "1-aco-andando")
	# 2: ferro com lenha no combustível: só sai com carvão
	var b := base.duplicate()
	b.merge({"comb": {"k": "lenha", "n": 8}, "ent": {"k": "minerio_ferro", "n": 9}, "ent2": null, "dur": 12, "faz": "barra_ferro", "precisa": "carvao"}, true)
	await janela(b, "2-ferro-so-com-carvao")
	# 3: aço sem carvão no Material 2: pede mais 2 carvões
	var d := base.duplicate()
	d.merge({"comb": {"k": "carvao", "n": 5}, "ent": {"k": "barra_ferro", "n": 3}, "ent2": null, "dur": 30, "faz": "barra_aco", "pede2": {"k": "carvao", "n": 2}}, true)
	await janela(d, "3-aco-pede-2-carvoes")
	# 4: tudo vazio (o texto de ajuda)
	var e := base.duplicate()
	e.merge({"comb": null, "ent": null, "ent2": null}, true)
	await janela(e, "4-vazia")
	quit()

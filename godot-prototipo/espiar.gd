extends CanvasLayer
const Idioma = preload("res://idioma.gd")
# "Ver" o recruta no painel do clã (André 2026-11-23: "não vou controlar eles, mas eu consigo ver... só para eu saber
# onde ele tá"). A câmera vai até o recruta e segue ele (camera_heroi.gd espiar); o servidor manda o que está em volta
# dele (shared/cla.js espiar, server/visao.js). O herói fica parado onde está. Mexer o joystick ou "Voltar" volta.

const Menu = preload("res://menu.gd")
var m # main.gd
var id := ""
var nome := ""
var faixa: PanelContainer
var txt: Label
var _t := 0.0

func _init(principal) -> void:
	m = principal
	layer = 6

func _ready() -> void:
	faixa = PanelContainer.new()
	faixa.add_theme_stylebox_override("panel", Menu.caixa(Color(0.06, 0.05, 0.04, 0.85), Color(0.95, 0.82, 0.55, 0.9), 2, Menu.RAIO_JANELA))
	faixa.set_anchors_preset(Control.PRESET_CENTER_TOP)
	faixa.grow_horizontal = Control.GROW_DIRECTION_BOTH
	faixa.offset_top = 132
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 14)
	faixa.add_child(h)
	txt = Label.new()
	txt.add_theme_font_size_override("font_size", 19)
	txt.add_theme_color_override("font_color", Color(0.95, 0.82, 0.55))
	txt.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	h.add_child(txt)
	# André 2026-11-24: "além de ver onde ele está, ter acesso a toda sua interface": o menu dele, só olhando (menu.gd)
	var bm := Button.new()
	bm.text = Idioma.frase("Menu dele")
	bm.add_theme_font_size_override("font_size", 18)
	bm.custom_minimum_size = Vector2(120, 44)
	bm.pressed.connect(func(): if id != "" and m.menu: m.menu.pedir_recruta(id, nome, "espiar"))
	h.add_child(bm)
	var bt := Button.new()
	bt.text = Idioma.frase("Voltar")
	bt.add_theme_font_size_override("font_size", 18)
	bt.custom_minimum_size = Vector2(96, 44)
	bt.pressed.connect(parar)
	h.add_child(bt)
	faixa.visible = false
	add_child(faixa)

func ativo() -> bool:
	return id != ""

func comecar(rid: String, rnome: String) -> void:
	id = rid
	nome = rnome
	_t = 0.0
	m.rede("cla", {"acao": "espiar", "id": rid})
	txt.text = Idioma.frase("Procurando %s…" % nome)
	faixa.visible = true

func parar() -> void:
	if id == "":
		return
	id = ""
	if m.cam:
		m.cam.espiar = null
	m.rede("cla", {"acao": "espiar", "id": ""})
	faixa.visible = false

func _process(dt: float) -> void:
	if id == "":
		return
	if m.hud and m.hud.mover.length() > 0.3: # mexeu o herói: volta para ele
		parar()
		return
	_t += dt
	var o = m.online.outros.get(id) if m.online else null
	var no = o.get("no") if o is Dictionary else null
	if no is Node3D and is_instance_valid(no):
		m.cam.espiar = no
		txt.text = Idioma.frase("Vendo %s" % nome)
	else:
		m.cam.espiar = null
		if _t > 8.0:
			m.hud.aviso("%s está fora do mundo agora" % nome)
			parar()

extends Node
const Idioma = preload("res://idioma.gd") # inglês (idioma.gd)
const Menu = preload("res://menu.gd")
# Duelo (André 2026-11-17: "opção pra chamar duelo tanto contra Dario e Cecília qt contra jogadores"). Quem decide tudo
# é o servidor (shared/duelo.js): aqui só o botão do cartão (troca.gd), o pedido com Aceitar/Recusar, o círculo no chão,
# a contagem, o nome e a barra do outro em vermelho e o resultado no fim.

var m # main.gd
var com := "" # id do outro no duelo ("" = sem duelo)
var nome := ""
var centro := Vector3.ZERO
var raio := 20.0
var luta_em := 0.0 # m.tempo em que a luta começa (fim da contagem)
var anel: MeshInstance3D
var _mat: StandardMaterial3D
var rotulo: Label # contagem (3, 2, 1) e depois "Duelo" (sem limite de tempo: sair do círculo encerra)
var _cor := {} # cor de antes da barra e do nome do outro
var _aviso_t := 0.0

func _init(principal) -> void:
	m = principal

func ativo() -> bool:
	return com != ""

# botão "Duelo" do cartão (troca.gd)
func pedir(id: String) -> void:
	m.troca.esconder_cartao()
	m.rede("duelo", {"acao": "pedir", "com": id})

func _responder(acao: String, de: String) -> void:
	m.troca.esconder_cartao()
	m.rede("duelo", {"acao": acao, "com": de})

func do_servidor(ev: Dictionary) -> void:
	match str(ev.get("fase", "")):
		"pedido":
			var de := str(ev.get("de", ""))
			m.troca.mostrar_cartao("%s chamou você pra um duelo" % str(ev.get("nome", "Alguém")), [["Aceitar", _responder.bind("aceitar", de)], ["Recusar", _responder.bind("recusar", de)]], float(ev.get("dur", 15)))
			m.sons.tocar("pano", -8.0)
		"inicio":
			_inicio(ev)
		"luta":
			luta_em = m.tempo
			m.sons.tocar("festa_libera", -6.0)
		"fim":
			_fim(ev)

func _inicio(ev: Dictionary) -> void:
	_limpar()
	com = str(ev.get("com", ""))
	nome = str(ev.get("nome", ""))
	raio = float(ev.get("r", 20))
	var x := float(ev.get("x", m.heroi.position.x))
	var z := float(ev.get("z", m.heroi.position.z))
	centro = Vector3(x, m.chao_em(x, z), z)
	luta_em = m.tempo + float(ev.get("conta", 3))
	_montar_anel()
	_pintar_outro(true)
	if m.hud.festa:
		m.hud.festa.anuncio("Duelo", "Contra %s" % nome, "boss") # festa.gd traduz
	if m.troca.equip_jan != null:
		m.troca.equip_jan.visible = false

func _fim(ev: Dictionary) -> void:
	var g = ev.get("ganhou")
	var pl: Dictionary = ev.get("placar", {}) if ev.get("placar") is Dictionary else {}
	var texto := "Duelo empatado" # em português: festa.gd e hud.aviso traduzem
	if g == true:
		texto = "Você venceu o duelo!"
	elif g == false:
		texto = "Você saiu do círculo e perdeu" if str(ev.get("motivo", "")) == "fora" else "Você perdeu o duelo"
	var placar := "%d vitórias e %d derrotas" % [int(pl.get("v", 0)), int(pl.get("d", 0))]
	if m.hud.festa:
		m.hud.festa.anuncio(texto, placar, "mitico" if g == true else "caiu")
	else:
		m.hud.aviso(texto)
	_limpar()

func _limpar() -> void:
	_pintar_outro(false)
	com = ""
	if anel != null:
		anel.queue_free()
		anel = null
	if rotulo != null:
		rotulo.visible = false

# o nome e a barra de vida do outro ficam vermelhos (só para os dois duelistas)
func _pintar_outro(liga: bool) -> void:
	var o = m.online.outros.get(com) if com != "" and m.online else null
	if o == null:
		_cor = {}
		return
	var barra: MeshInstance3D = o.get("barra")
	var placa: Label3D = o.get("placa")
	if liga:
		_cor = {"no": o.no}
		if barra and barra.material_override:
			_cor.barra = barra.material_override.albedo_color
			barra.material_override.albedo_color = Color(0.92, 0.2, 0.16)
		if placa:
			_cor.placa = placa.modulate
			placa.modulate = Color(1.0, 0.42, 0.36)
	elif _cor.get("no") == o.no: # o corpo ainda é o mesmo (corpo que sai da visão volta para a reserva)
		if barra and barra.material_override and _cor.has("barra"):
			barra.material_override.albedo_color = _cor.barra
		if placa and _cor.has("placa"):
			placa.modulate = _cor.placa
		_cor = {}

# círculo no chão que segue o relevo: uma fita fina, brilhando em laranja
func _montar_anel() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLE_STRIP)
	var n := 96
	var larg := 0.22
	for i in range(n + 1):
		var a := TAU * float(i) / float(n)
		var d := Vector3(sin(a), 0.0, cos(a))
		for r in [raio - larg, raio + larg]:
			var p: Vector3 = Vector3(centro.x, 0.0, centro.z) + d * r
			p.y = m.chao_em(p.x, p.z) + 0.07
			st.add_vertex(p)
	anel = MeshInstance3D.new()
	anel.mesh = st.commit()
	_mat = StandardMaterial3D.new()
	_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	_mat.albedo_color = Color(1.0, 0.55, 0.15, 0.9)
	anel.material_override = _mat
	anel.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	m.add_child(anel)

func _rotulo() -> Label:
	if rotulo == null:
		rotulo = Label.new()
		rotulo.set_anchors_preset(Control.PRESET_CENTER_TOP)
		rotulo.grow_horizontal = Control.GROW_DIRECTION_BOTH
		rotulo.offset_left = -160
		rotulo.offset_right = 160
		rotulo.offset_top = 120
		rotulo.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		rotulo.add_theme_color_override("font_color", Menu.OURO_CLARO)
		rotulo.add_theme_color_override("font_outline_color", Color(0.25, 0.05, 0.0))
		rotulo.add_theme_constant_override("outline_size", 10)
		rotulo.mouse_filter = Control.MOUSE_FILTER_IGNORE
		m.hud.add_child(rotulo)
	return rotulo

func _process(_dt: float) -> void:
	if com == "":
		return
	var r := _rotulo()
	r.visible = true
	var falta: float = luta_em - m.tempo
	if falta > 0.0:
		r.add_theme_font_size_override("font_size", 72)
		r.text = str(int(ceil(falta)))
	elif falta > -0.8:
		r.add_theme_font_size_override("font_size", 56)
		r.text = Idioma.frase("Lutem!")
	else:
		r.add_theme_font_size_override("font_size", 22)
		r.text = Idioma.frase("Duelo: saia do círculo para encerrar")
	if _mat != null: # o círculo pulsa de leve
		_mat.albedo_color.a = 0.65 + 0.25 * sin(m.tempo * 4.0)
	# perto da borda: avisa uma vez a cada 2 s (sair = perde)
	var d := Vector2(m.heroi.position.x - centro.x, m.heroi.position.z - centro.z).length()
	if d > raio - 2.5 and m.tempo - _aviso_t > 2.0:
		_aviso_t = m.tempo
		m.hud.aviso("Volte pro círculo ou perde o duelo!")

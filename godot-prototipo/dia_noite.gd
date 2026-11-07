extends Node
# Dia e noite (igual ao Quimera, André 2026-11-07). 1 hora do jogo = 30 s (o dia inteiro em 12 min); o relógio é da conta
# (progresso.gd hora_do_jogo, regra em shared/progresso.js). Escurece das 18h30 às 20h30 e clareia das 4h30 às 6h30, com o
# tom alaranjado do pôr e do nascer do sol. De noite: céu azul-escuro com estrelas e lua, luz da lua azulada (com sombra),
# névoa escura e uma luz quente e fraca em volta do herói (como a lanterna do Quimera), para nunca ficar preto no celular.
# O sol não anda (igual ao Quimera): só a cor e a força mudam, então as sombras não pesam mais no celular.
# A caverna (caverna.gd) escurece por cima: ela lê daqui a luz "de fora" (base()) em vez de guardar a do começo.
# Dormir (construcao.gd botão da cama, servidor em shared/simulacao.js dormir): a tela escurece, a hora pula para 6h30
# só depois do escuro (segurar()) e clareia com "Bom dia!".

var m # main.gd
var env: Environment
var ceu: ShaderMaterial
var lanterna: OmniLight3D
var noite := 0.0 # 0 = dia, 1 = noite fechada
var hora := 8.0
var _passo := 0.0
var _segura := -1.0 # >= 0: hora parada nesse valor (dormindo, até a tela escurecer)
var _ajuste := -1.0 # >= 0: força a hora (fotos de teste)
var _cortina: ColorRect
var _cortina_txt: Label
var _sono := {} # {"t", "ev"} enquanto a tela escurece e clareia
# luz do dia (a de main.gd montar_ambiente) e a da noite (cores do Quimera: céu 0b1128, luz 8fa6ff, ambiente 5a6aa8)
var _dia := {}
const NOITE := {"amb": Color("4a5a98"), "amb_e": 0.62, "sol": Color("8fa6ff"), "sol_e": 0.34, "nevoa": Color("141c38"), "exp": 0.74}
const POR := Color("ff9a5a") # sol do fim de tarde
const POR_CEU := Color("f0a878")

func _init(main) -> void:
	m = main
	name = "DiaNoite"

func _ready() -> void:
	for we in m.find_children("*", "WorldEnvironment", false, false):
		env = we.environment
	if env == null:
		return
	_dia = {"amb": env.ambient_light_color, "amb_e": env.ambient_light_energy, "sol": m.sol.light_color, "sol_e": m.sol.light_energy,
		"nevoa": env.fog_light_color, "exp": env.tonemap_exposure}
	# o mesmo céu pintado (modelos/ceu.hdr) num shader que também sabe fazer a noite
	var velho = env.sky.sky_material
	ceu = ShaderMaterial.new()
	ceu.shader = load("res://ceu.gdshader")
	if velho is PanoramaSkyMaterial:
		ceu.set_shader_parameter("panorama", velho.panorama)
	ceu.set_shader_parameter("lua_dir", (-m.sol.global_transform.basis.z * Vector3(-1, 1, -1)).normalized() + Vector3(0, 0.35, 0))
	env.sky.sky_material = ceu
	env.sky.radiance_size = Sky.RADIANCE_SIZE_32 # o céu não ilumina nada (luz ambiente é cor): radiância mínima
	env.sky.process_mode = Sky.PROCESS_MODE_INCREMENTAL
	lanterna = OmniLight3D.new()
	lanterna.light_color = Color("ffd9a0")
	lanterna.light_energy = 0.0
	lanterna.omni_range = 9.0
	lanterna.omni_attenuation = 1.6
	lanterna.shadow_enabled = false
	lanterna.visible = false
	m.add_child(lanterna)
	# cortina do sono
	var cl := CanvasLayer.new()
	cl.layer = 40
	add_child(cl)
	_cortina = ColorRect.new()
	_cortina.color = Color(0.01, 0.015, 0.04, 0.0)
	_cortina.set_anchors_preset(Control.PRESET_FULL_RECT)
	_cortina.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_cortina.visible = false
	cl.add_child(_cortina)
	_cortina_txt = Label.new()
	_cortina_txt.text = "Dormindo..."
	_cortina_txt.set_anchors_preset(Control.PRESET_FULL_RECT)
	_cortina_txt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_cortina_txt.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	_cortina_txt.add_theme_font_size_override("font_size", 26)
	_cortina_txt.add_theme_color_override("font_color", Color(0.85, 0.88, 1.0))
	_cortina.add_child(_cortina_txt)
	atualizar(true)

# hora mostrada agora (relógio da conta; parada enquanto dorme)
func hora_agora() -> float:
	if _ajuste >= 0.0:
		return _ajuste
	if _segura >= 0.0:
		return _segura
	return m.P.hora_do_jogo()

func eh_noite() -> bool:
	return m.P.eh_noite_h(hora_agora(), m.P.dados.get("dia", {}))

# "☀ 08:30" do Quimera (de 10 em 10 min); o minimapa desenha o sol ou a lua
func texto_hora() -> String:
	var h := int(floor(hora)) % 24
	var mi := int(floor((hora - floor(hora)) * 6.0)) * 10
	return "%02d:%02d" % [h, mi]

# só para fotos de teste: força a hora (-1 volta ao relógio)
func ajustar(h: float) -> void:
	_ajuste = h
	atualizar(true)

# 0 de dia, 1 de noite, rampa no pôr e no nascer do sol (Ms do Quimera)
static func fator_noite(h: float, D: Dictionary) -> float:
	var e: Array = D.get("escurece", [18.5, 20.5])
	var c: Array = D.get("clareia", [4.5, 6.5])
	if h >= float(e[1]) or h < float(c[0]):
		return 1.0
	if h >= float(e[0]):
		return (h - float(e[0])) / (float(e[1]) - float(e[0]))
	if h < float(c[1]):
		return 1.0 - (h - float(c[0])) / (float(c[1]) - float(c[0]))
	return 0.0

# luz de fora agora (a caverna escurece a partir dela)
func base() -> Dictionary:
	if _dia.is_empty():
		return {}
	var n := noite
	var k := sin(n * PI) * (1.0 if hora > 12.0 else 0.7) # tom laranja só no meio da passagem
	var sol: Color = (_dia.sol as Color).lerp(NOITE.sol, n).lerp(POR, k * 0.55)
	var nev: Color = (_dia.nevoa as Color).lerp(NOITE.nevoa, n).lerp(POR_CEU, k * 0.35)
	return {"amb": (_dia.amb as Color).lerp(NOITE.amb, n), "amb_e": lerpf(_dia.amb_e, NOITE.amb_e, n),
		"sol": sol, "sol_e": lerpf(_dia.sol_e, NOITE.sol_e, n), "nevoa": nev, "exp": lerpf(_dia.exp, NOITE.exp, n), "por": k}

func _process(dt: float) -> void:
	_passo_sono(dt)
	if lanterna and lanterna.visible and m.heroi:
		# do lado da câmera, acima da cabeça (Us do Quimera): o rosto e a frente do herói ficam visíveis à noite
		var cam: Camera3D = m.get_viewport().get_camera_3d()
		var hp: Vector3 = m.heroi.position
		var d := Vector3.ZERO
		if cam:
			d = Vector3(cam.global_position.x - hp.x, 0, cam.global_position.z - hp.z).normalized()
		lanterna.position = hp + d * 1.6 + Vector3(0, 1.9, 0)
	_passo -= dt
	if _passo > 0.0:
		return
	_passo = 0.12
	atualizar(false)

func atualizar(_forcar: bool) -> void:
	if env == null or m.P == null:
		return
	hora = hora_agora()
	noite = fator_noite(hora, m.P.dados.get("dia", {}))
	var b := base()
	var dentro: bool = m.caverna != null and float(m.caverna.escuro) > 0.0
	if not dentro: # na caverna quem manda na luz é caverna.gd (ela usa base())
		env.ambient_light_color = b.amb
		env.ambient_light_energy = b.amb_e
		m.sol.light_color = b.sol
		m.sol.light_energy = b.sol_e
		env.fog_light_color = b.nevoa
	else:
		m.sol.light_color = b.sol
	env.tonemap_exposure = b.exp
	ceu.set_shader_parameter("noite", noite)
	ceu.set_shader_parameter("por", b.por)
	lanterna.light_energy = 0.9 * noite
	lanterna.visible = noite > 0.02

# ---------- dormir ----------
# o servidor deixou dormir (ev: vigor ganho, espera até a cama dar vigor de novo): escurece, pula a hora e clareia
func dormiu(ev: Dictionary) -> void:
	_segura = hora_agora() # a conta nova (6h30) chega logo depois; só vale quando a tela estiver escura
	_sono = {"t": 0.0, "ev": ev}
	_cortina.visible = true

func _passo_sono(dt: float) -> void:
	if _sono.is_empty():
		return
	_sono.t += dt
	var t: float = _sono.t
	const ESCURECE := 0.9
	const PARADO := 1.4
	const CLAREIA := 1.1
	var a := 0.0
	if t < ESCURECE:
		a = t / ESCURECE
	elif t < ESCURECE + PARADO:
		a = 1.0
		if _segura >= 0.0:
			_segura = -1.0 # já está escuro: agora vale a hora nova
			atualizar(true)
	elif t < ESCURECE + PARADO + CLAREIA:
		a = 1.0 - (t - ESCURECE - PARADO) / CLAREIA
	else:
		_cortina.visible = false
		var ev: Dictionary = _sono.ev
		_sono = {}
		m.hud.aviso("Bom dia! Você dormiu até amanhecer.")
		var vg := int(ev.get("vigor", 0))
		var esp := float(ev.get("espera", 0))
		var t2 := "Vigor +%d (dormiu bem)" % vg if vg > 0 else ("Vigor da cama: de novo em %s" % _tempo(esp) if esp > 0.0 else "")
		if t2 != "": # depois do bom dia, como no Quimera
			get_tree().create_timer(1.8).timeout.connect(func(): m.hud.aviso(t2))
		return
	_cortina.color.a = a
	_cortina_txt.modulate.a = clampf(a * 1.4 - 0.4, 0.0, 1.0)

static func _tempo(s: float) -> String:
	var mi := int(ceil(s / 60.0))
	if mi >= 60:
		return "%dh%s" % [mi / 60, ("%02d" % (mi % 60)) if mi % 60 else ""]
	return "%d min" % mi

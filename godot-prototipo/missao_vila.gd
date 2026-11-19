extends CanvasLayer
const Idioma = preload("res://idioma.gd") # inglês (idioma.gd): texto montado também sai traduzido
# Missão de vila na tela (lote 1 das vilas, plano v3 do Presidente, 19/11/2026): cartão âmbar logo embaixo do cartão da
# história (missao_ativa.gd), do mesmo jeito dele: o nome, a etapa da vez com o andamento e o "Ir". Uma missão de vila
# por vez; o resumo vem do servidor a cada progresso (progresso.gd vila_info = shared/missoes-vila.js vilaInfo).
# Tocar no cartão abre a aba Vilas (menu.gd). "Ir": quando o servidor já mandou o lugar (NPC, pista, campo do chefe,
# totem...) vai direto pelo autopath (rota.gd, no lobo, como o da história) e abre a conversa ao chegar no NPC; spot de
# pesca e recurso o servidor procura na hora (rede "missao_vila" acao "ir", resposta "vila_ir" em online.gd).
# Lugar: na coluna da esquerda, embaixo do cartão da história (missao_ativa.gd _coluna chama na_coluna todo quadro); se
# o jogador mudou a missão da história de lugar (editar_hud.gd), este vai junto, logo embaixo dela.

const Menu = preload("res://menu.gd")
const MissaoAtiva = preload("res://missao_ativa.gd")
const LARGURA := 240.0
const BOTAO := 52.0 # largura do botão "Ir"
const COR := Color(0.96, 0.7, 0.32) # âmbar das vilas (o lilás é da história)
const ESPERA_IR := 4.0 # s: a resposta do "Ir" que o servidor procura (vila_ir) só vale até aqui
const MARCA_LONGE := 140.0 # m: a coluna de luz da pista aparece a menos disso (como a da história)

var m # main.gd
var cartao: PanelContainer
var l1: Label
var l2: Label
var ir_btn: Button
var _t := 0.0
var _visto = null # o vila_info que o cartão já mostra (progresso.gd troca o dicionário a cada pacote)
var _ir_ate := -1.0 # m.tempo até quando o "vila_ir" pedido vale

func _init(principal) -> void:
	m = principal
	layer = 3 # o mesmo do cartão da história: abaixo do menu do topo (4) e dos menus

func _ready() -> void:
	cartao = PanelContainer.new()
	cartao.add_theme_stylebox_override("panel", Menu.caixa(Color(0.06, 0.05, 0.04, 0.8), Color(COR, 0.9), 1, Menu.RAIO_JANELA))
	cartao.custom_minimum_size = Vector2(LARGURA, 0)
	cartao.size = Vector2(LARGURA, 0)
	cartao.mouse_filter = Control.MOUSE_FILTER_STOP
	cartao.gui_input.connect(_toque_cartao) # tocar no cartão (fora do "Ir") abre a aba Vilas
	add_child(cartao)
	var linha := HBoxContainer.new()
	linha.add_theme_constant_override("separation", 8)
	linha.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cartao.add_child(linha)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 1)
	v.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	linha.add_child(v)
	l1 = _linha(13, Color("ffdfae"))
	v.add_child(l1)
	l2 = _linha(12, Color(0.85, 0.82, 0.78))
	v.add_child(l2)
	ir_btn = _botao("Ir", ir)
	ir_btn.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	linha.add_child(ir_btn)
	cartao.visible = false

func _linha(tam: int, cor: Color) -> Label:
	var l := Menu.rotulo("", tam, cor)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(LARGURA - 20 - BOTAO - 8, 0)
	l.add_theme_constant_override("outline_size", 3)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.7))
	return l

func _botao(t: String, fn: Callable) -> Button:
	var b := Button.new()
	b.set_meta("pt", t)
	b.text = Idioma.frase(t)
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 15)
	b.custom_minimum_size = Vector2(BOTAO, 34)
	Menu.estilo_botao(b, true)
	for k in ["normal", "hover", "pressed", "disabled"]: # arredondado como o cartão
		var sb = b.get_theme_stylebox(k)
		if sb is StyleBoxFlat:
			sb.set_corner_radius_all(10)
	b.pressed.connect(fn)
	return b

# tocar no cartão abre a aba Vilas (ao soltar o dedo, e só se ele não saiu do cartão), como o da história abre a História
func _toque_cartao(ev: InputEvent) -> void:
	if not (ev is InputEventMouseButton) or ev.button_index != MOUSE_BUTTON_LEFT or ev.pressed:
		return
	if not Rect2(Vector2.ZERO, cartao.size).grow(6).has_point(ev.position) or m.menu == null:
		return
	cartao.accept_event()
	m.menu.abrir("vilas")
	if m.sons:
		m.sons.tocar("pano", -10.0)

# pegou a missão ou cumpriu uma etapa no NPC (conversa.gd): o cartão pisca duas vezes, para mostrar onde está o "Ir"
var _pisca: Tween
func destacar() -> void:
	if cartao == null:
		return
	if _pisca != null and _pisca.is_valid():
		_pisca.kill()
	cartao.modulate = Color.WHITE
	_pisca = create_tween()
	for i in 2:
		_pisca.tween_property(cartao, "modulate", Color(1.7, 1.5, 1.2), 0.18)
		_pisca.tween_property(cartao, "modulate", Color.WHITE, 0.3)

# missao_ativa.gd (_coluna, todo quadro): o cartão vai logo abaixo de y (em x), no tamanho s do cartão da história;
# devolve onde a coluna continua (o pack, transporte.gd, vem embaixo). Escondido, a coluna continua de y.
func na_coluna(x: float, y: float, s: float) -> float:
	if cartao == null or not cartao.visible:
		return y
	var p := Vector2(x, y + 2.0)
	if cartao.scale.x != s:
		cartao.scale = Vector2(s, s)
	if cartao.position != p:
		cartao.position = p
	return p.y + cartao.size.y * s + 2.0

# hud.gd (por missao_ativa.gd cobre): toque aqui não vira joystick nem câmera
func cobre(p: Vector2) -> bool:
	return cartao != null and cartao.visible and cartao.get_global_rect().grow(6).has_point(p)

# ---------- o que mostrar ----------
# a missão de vila aceita (vilaInfo.a: id, nome, txt, e, total, npc, alvo, marca) ou {} sem nenhuma
func atual() -> Dictionary:
	var a = m.P.vila_info.get("a")
	return a if a is Dictionary else {}

# [linha de cima, linha de baixo]: o servidor já manda o texto da etapa com o andamento ("Pesque 3 peixes (1/3)")
func textos(a: Dictionary) -> Array:
	var tot := int(a.get("total", 1))
	var e := int(a.get("e", 0))
	return ["Vila: %s" % str(a.get("nome", "")), ("Parte %d/%d · " % [e + 1, tot] if tot > 1 else "") + str(a.get("txt", ""))]

func _process(dt: float) -> void:
	var t0_parte := Time.get_ticks_usec()
	_process_parte(dt)
	if Time.get_ticks_usec() - t0_parte >= 1000 and Engine.has_meta("lentidao"): # quadro lento (lentidao.gd)
		Engine.get_meta("lentidao").ev("missao_vila", t0_parte)

func _process_parte(dt: float) -> void:
	if cartao == null or m.hud == null:
		return
	var a := atual()
	var mostrar: bool = not a.is_empty() and not m.hud.esconder_combate and not m.hud.modo_construcao and m.heroi != null
	if cartao.visible != mostrar:
		cartao.visible = mostrar
	if not mostrar:
		if _marca != null and _marca.visible:
			_marca.visible = false
		return
	_t -= dt
	if _t > 0.0 and is_same(m.P.vila_info, _visto):
		return
	_t = 0.25
	_visto = m.P.vila_info
	var tx := textos(a)
	if l1.text != Idioma.frase(tx[0]):
		l1.text = Idioma.frase(tx[0])
	if l2.text != Idioma.frase(tx[1]):
		l2.text = Idioma.frase(tx[1])
		# etapa de falar com alguém (entregar, voltar ao NPC): o texto clareia, como o "Volte e fale" da história
		l2.add_theme_color_override("font_color", Color(1, 0.95, 0.85) if str(a.get("npc", "")) != "" else Color(0.85, 0.82, 0.78))
	cartao.size = Vector2(LARGURA, 0) # encolhe de novo quando o texto fica menor
	_marca_atualizar(a)

# ---------- "Ir" ----------
func ir() -> void:
	var a := atual()
	if a.is_empty() or m.rota == null or m.heroi == null:
		return
	if a.get("alvo") is Dictionary:
		ir_para(a.alvo)
	elif m.on(): # spot de pesca aceso, recurso: o servidor procura o mais perto agora (responde "vila_ir" ou "Dá para fazer aqui mesmo")
		_ir_ate = m.tempo + ESPERA_IR
		m.rede("missao_vila", {"acao": "ir"})
	if m.sons:
		m.sons.tocar("pano", -10.0)

# "vila_ir" (online.gd): o lugar que o servidor achou para o "Ir" pedido há pouco
func do_servidor_ir(ev: Dictionary) -> void:
	if m.tempo > _ir_ate:
		return
	_ir_ate = -1.0
	ir_para(ev.get("alvo"))

# vai até A = {x, z, nome, npc} pelo autopath; no NPC para um pouco antes e a conversa abre ao chegar (o mesmo do Ir
# da história, missao_ativa.gd). A aba Vilas também usa (Ir até quem dá a missão).
func ir_para(A) -> void:
	if not (A is Dictionary) or not A.has("x") or not A.has("z") or m.rota == null or m.heroi == null:
		return
	var p := Vector2(float(A.x), float(A.z))
	var npc := str(A.get("npc", ""))
	var hp := Vector2(m.heroi.position.x, m.heroi.position.z)
	if m.menu and m.menu.aberto():
		m.menu.fechar()
	if npc != "" and hp.distance_to(p) <= MissaoAtiva.PERTO_NPC: # já está do lado: só conversa
		_abrir_npc(npc)
		return
	var r: PackedVector2Array = m.rota.planejar(p)
	if r.is_empty():
		return
	if npc != "": # para um pouco antes do NPC, vindo do lado de onde chega
		var antes: Vector2 = r[r.size() - 2] if r.size() >= 2 else hp
		if antes.distance_to(p) > MissaoAtiva.PARA_ANTES:
			r[r.size() - 1] = p + (antes - p).normalized() * MissaoAtiva.PARA_ANTES
	m.rota.ir(r, "Indo até %s" % str(A.get("nome", "")), m.rota.OLHA, true) # viagem: vai no lobo, como o "Ir para" do mapa
	if npc != "" and m.rota.ativo and m.missao_ativa:
		m.missao_ativa._npc_alvo = npc # ao chegar, a conversa abre (missao_ativa.gd _chegou_npc, o mesmo do mapa)

func _abrir_npc(id: String) -> void:
	if m.conversa == null:
		return
	for n in m.npcs:
		if str(n.get("id", "")) == id:
			m.conversa.abrir(n, false) # abriu sozinha (Ir): o primeiro toque no botão já vale
			return

# ---------- marca no chão: coluna de luz âmbar na pista ou no lugar da etapa (o desenho é o da história) ----------
var _marca: MeshInstance3D

func _marca_atualizar(a: Dictionary) -> void:
	var mostrar: bool = a.get("marca", false) == true and a.get("alvo") is Dictionary and m.heroi != null
	var p := Vector3.ZERO
	if mostrar:
		p = Vector3(float(a.alvo.x), 0.0, float(a.alvo.z))
		mostrar = Vector2(p.x, p.z).distance_to(Vector2(m.heroi.position.x, m.heroi.position.z)) < MARCA_LONGE
	if mostrar:
		if _marca == null:
			_marca = MeshInstance3D.new()
			var c := CylinderMesh.new()
			c.top_radius = 0.9
			c.bottom_radius = 1.2
			c.height = 9.0
			c.radial_segments = 16
			c.rings = 1
			c.cap_top = false
			c.cap_bottom = false
			_marca.mesh = c
			_marca.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			var mat := ShaderMaterial.new()
			var sh := Shader.new()
			sh.code = MissaoAtiva.SH_MARCA
			mat.shader = sh
			mat.set_shader_parameter("cor", COR)
			_marca.material_override = mat
			m.add_child(_marca)
		p.y = m.chao_em(p.x, p.z) + 4.5
		if _marca.position != p:
			_marca.position = p
	if _marca != null and _marca.visible != mostrar:
		_marca.visible = mostrar

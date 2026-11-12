extends CanvasLayer
# Missão ativa na tela (André 2026-11-11: "a missão ativa tem que ficar aparecendo ali do lado esquerdo embaixo, onde fica
# o negócio de time"; "eu clicando, quero um botão Ir para... ele faz o autopath até a região"). Fica à esquerda, logo
# embaixo do painel do herói e das barras do time (amigos.gd). Do lado da descrição fica o botão "Ir" (André
# 2026-11-11: um toque e vai; a lista toda mora no menu do topo, menu_topo.gd). "Ir" usa o mesmo autopath do mapa (rota.gd, pela estrada, montado
# no lobo): até o NPC da missão (e já abre a conversa ao chegar), até o campo de caça dos monstros pedidos ou até o veio
# do minério que falta entregar. O herói só anda: não ataca nem procura briga (se apanhar no caminho, apanha). O caminho
# desvia das regiões ainda na névoa (rota.gd).

const Menu = preload("res://menu.gd")
const LARGURA := 240.0
const BOTAO := 52.0 # largura do botão "Ir"
const COR := Color(0.72, 0.62, 0.95) # lilás das missões (o mesmo da aba Missões e da névoa)
const PERTO_NPC := 4.0 # m: já está do lado do NPC, abre a conversa sem andar (conversa.gd fecha a 4,5 m)
const PARA_ANTES := 1.8 # m: para um pouco antes do NPC (não esbarra nele)

var m # main.gd
var cartao: PanelContainer
var l1: Label
var l2: Label
var ir_btn: Button
var _t := 0.0
var _npc_alvo := "" # id do NPC para onde o "Ir para" levou: ao chegar, abre a conversa

func _init(principal) -> void:
	m = principal
	layer = 3 # junto da HUD e das barras do time, abaixo do menu do topo (4) e dos menus

func _ready() -> void:
	cartao = PanelContainer.new()
	cartao.add_theme_stylebox_override("panel", Menu.caixa(Color(0.06, 0.05, 0.04, 0.8), Color(COR, 0.9), 1, Menu.RAIO_JANELA)) # André 2026-11-11: bordas mais arredondadas
	cartao.custom_minimum_size = Vector2(LARGURA, 0)
	cartao.size = Vector2(LARGURA, 0)
	cartao.mouse_filter = Control.MOUSE_FILTER_STOP
	cartao.gui_input.connect(_toque_cartao) # André 2026-11-12: tocar na barra (fora do "Ir") abre o menu de todas as missões
	add_child(cartao)
	# André 2026-11-11: sem tocar para abrir botões e sem o "Missões" aqui: o "Ir" fica sempre do lado da descrição
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
	l1 = _linha(13, Color("e6dcff"))
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
	b.text = t
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

# André 2026-11-12: "se você clicar na barra em si, você já abre o menu de todas as missões" (como no Quimera e na
# maioria dos jogos). O "Ir" é um botão por cima e fica com o toque dele; o resto da barra abre a aba Missões (a mesma do
# menu do topo, menu_topo.gd). Abre ao soltar o dedo, e só se ele não saiu da barra.
func _toque_cartao(ev: InputEvent) -> void:
	if not (ev is InputEventMouseButton) or ev.button_index != MOUSE_BUTTON_LEFT or ev.pressed:
		return
	if not Rect2(Vector2.ZERO, cartao.size).grow(6).has_point(ev.position) or m.menu == null:
		return
	cartao.accept_event()
	m.menu.abrir("missoes")
	if m.sons:
		m.sons.tocar("pano", -10.0)

# a missão acabou de começar no NPC (conversa.gd): a barrinha pisca duas vezes, clareando e voltando. Só um tween curto.
var _pisca: Tween
func destacar() -> void:
	if cartao == null:
		return
	if _pisca != null and _pisca.is_valid():
		_pisca.kill()
	cartao.modulate = Color.WHITE
	_pisca = create_tween()
	for i in 2:
		_pisca.tween_property(cartao, "modulate", Color(1.6, 1.5, 1.9), 0.18)
		_pisca.tween_property(cartao, "modulate", Color.WHITE, 0.3)

# hud.gd: toque aqui não vira joystick nem câmera
func cobre(p: Vector2) -> bool:
	return cartao != null and cartao.visible and cartao.get_global_rect().grow(6).has_point(p)

# ---------- o que mostrar ----------
func _missao() -> Dictionary:
	return m.nevoa.missao_atual() if m.nevoa != null else {}

func _nome_npc(id: String) -> String:
	for n in m.mundo.get("npcs", []):
		if str(n.get("id", "")) == id:
			return str(n.get("nome", id)).split(",")[0]
	return id

# a etapa da vez que o servidor mandou (história v2, André 2026-11-11: missão com etapas), se é desta missão
func _info(M: Dictionary) -> Dictionary:
	var hi: Dictionary = m.P.hist_info
	return hi if not hi.is_empty() and str(hi.get("id", "")) == str(M.get("id", "")) else {}

# [linha de cima, linha de baixo] (o que antes ficava embaixo do relógio do minimapa)
func textos(M: Dictionary) -> Array:
	var hi := _info(M)
	if not hi.is_empty(): # o servidor já manda o texto da etapa com o andamento ("Derrube Puglins 3/6")
		var tot: int = int(M.get("total", 1))
		var e: int = int(hi.get("e", -1))
		var cab := "Cap. %d · %s" % [int(M.get("cap", 0)), M.nome] if int(M.get("cap", 0)) > 0 else "Missão: %s" % M.nome
		return [cab, ("%d/%d · " % [e + 1, tot] if e >= 0 and tot > 1 else "") + str(hi.get("txt", ""))]
	var h: Dictionary = m.nevoa.hist()
	var quem: String = _nome_npc(str(M.npc))
	var l: String
	if int(m.P.prog.nivel) < int(M.nv):
		l = "Libera no Nv %d (%s)" % [int(M.nv), quem]
	elif not h.get("ac", false):
		l = "Fale com %s" % quem
	elif int(h.get("n", 0)) >= int(M.total):
		l = "Pronto! Volte e fale com %s" % quem
	else:
		l = "%d/%d · %s" % [int(h.get("n", 0)), int(M.total), quem]
	return ["Missão: %s" % M.nome, l]

func _process(dt: float) -> void:
	if cartao == null or m.hud == null:
		return
	var M := _missao()
	var mostrar: bool = not M.is_empty() and not m.hud.esconder_combate and not m.hud.modo_construcao and m.heroi != null
	if cartao.visible != mostrar:
		cartao.visible = mostrar
	_chegou_npc()
	if not mostrar:
		return
	# logo embaixo das barras do time (ou do painel do herói, sem time); acompanha o lugar que o jogador deu a elas
	var a = m.amigos
	var y := 122.0
	var x := 18.0
	if a != null:
		var outros := 0
		var eu := str(m.online.meu_id) if m.online else ""
		for t in a.time:
			if str(t.id) != eu:
				outros += 1
		x = a.BARRAS.x + a.barras_d.x
		y = a.BARRAS.y + a.barras_d.y + outros * 40.0 * a.barras_s
	cartao.position = Vector2(x, y + 2.0)
	_t -= dt
	if _t > 0.0:
		return
	_t = 0.25
	var tx := textos(M)
	if l1.text != tx[0]:
		l1.text = tx[0]
	if l2.text != tx[1]:
		l2.text = tx[1]
		l2.add_theme_color_override("font_color", Color(1, 0.95, 0.85) if tx[1].begins_with("Pronto") or tx[1].contains("Volte") else Color(0.85, 0.82, 0.78))
	ir_btn.disabled = int(m.P.prog.nivel) < int(M.nv)
	cartao.size = Vector2(LARGURA, 0) # encolhe de novo quando o texto fica menor
	_marca_atualizar(M)

# ---------- "Ir para" ----------
# {pos: Vector2, nome, npc: id ou ""} do próximo passo da missão: falar com o NPC, ir caçar ou ir minerar
func alvo() -> Dictionary:
	var M := _missao()
	if M.is_empty():
		return {}
	var hi := _info(M)
	if hi.get("alvo") is Dictionary: # história v2: o servidor diz para onde vai a etapa da vez (NPC, campo, veio, pista...)
		var a: Dictionary = hi.alvo
		return {"pos": Vector2(float(a.x), float(a.z)), "nome": str(a.get("nome", "a missão")), "npc": str(a.get("npc", ""))}
	var h: Dictionary = m.nevoa.hist()
	var npc := _npc(str(M.npc))
	var hp := Vector2(m.heroi.position.x, m.heroi.position.z)
	if h.get("ac", false) and int(h.get("n", 0)) < int(M.total):
		if M.get("matar") is Dictionary: # o campo de caça pedido mais perto (fora da névoa)
			var melhor := {}
			var md := INF
			for cid in M.matar.get("campos", []):
				for cc in m.mundo.get("caca", []):
					if str(cc.get("id", "")) != str(cid):
						continue
					var p := Vector2(float(cc.x), float(cc.z))
					var d := hp.distance_to(p) + (100000.0 if m.nevoa.fechado(p.x, p.y) else 0.0)
					if d < md:
						md = d
						melhor = {"pos": p, "nome": str(cc.get("nome", "o campo de caça")), "npc": ""}
			if not melhor.is_empty():
				return melhor
		elif M.get("entregar") is Dictionary: # o veio do minério que ainda falta na mochila (o mais perto)
			for k in M.entregar:
				if m.P.contar(str(k)) >= int(M.entregar[k]):
					continue
				var tipo := str(k).trim_prefix("minerio_")
				var melhor := {}
				var md := INF
				for mn in m.mundo.get("mina", []):
					if str(mn.get("tipo", "")) != tipo:
						continue
					var p := Vector2(float(mn.x), float(mn.z))
					var d := hp.distance_to(p) + (100000.0 if m.nevoa.fechado(p.x, p.y) else 0.0)
					if d < md:
						md = d
						melhor = {"pos": p, "nome": str(mn.get("nome", "o veio")), "npc": ""}
				if not melhor.is_empty():
					return melhor
	if npc.is_empty():
		return {}
	return {"pos": Vector2(float(npc.x), float(npc.z)), "nome": str(npc.get("nome", M.npc)).split(",")[0], "npc": str(M.npc)}

func _npc(id: String) -> Dictionary:
	for n in m.mundo.get("npcs", []):
		if str(n.get("id", "")) == id:
			return n
	return {}

func ir() -> void:
	if m.rota == null or m.heroi == null:
		return
	var A := alvo()
	if A.is_empty():
		m.hud.aviso("Nenhum lugar para ir nesta missão")
		return
	var hp := Vector2(m.heroi.position.x, m.heroi.position.z)
	var p: Vector2 = A.pos
	if A.npc != "" and hp.distance_to(p) <= PERTO_NPC: # já está do lado: só conversa
		_abrir_npc(str(A.npc))
		return
	var r: PackedVector2Array = m.rota.planejar(p)
	if r.is_empty():
		return
	if A.npc != "": # para um pouco antes do NPC, vindo do lado de onde chega
		var antes: Vector2 = r[r.size() - 2] if r.size() >= 2 else hp
		if antes.distance_to(p) > PARA_ANTES:
			r[r.size() - 1] = p + (antes - p).normalized() * PARA_ANTES
	m.rota.ir(r, "Indo até %s" % A.nome, m.rota.OLHA, true) # viagem: vai no lobo, como o "Ir para" do mapa
	_npc_alvo = str(A.npc) if m.rota.ativo else ""
	if m.sons:
		m.sons.tocar("pano", -10.0)

# o "Ir para" do NPC terminou: perto dele, abre a conversa (pegar ou entregar a missão)
func _chegou_npc() -> void:
	if _npc_alvo == "" or m.rota == null or m.rota.ativo:
		return
	var id := _npc_alvo
	_npc_alvo = ""
	var n := _npc(id)
	if n.is_empty() or m.heroi == null or m.h.morto > 0.0:
		return
	if Vector2(m.heroi.position.x, m.heroi.position.z).distance_to(Vector2(float(n.x), float(n.z))) <= PERTO_NPC:
		_abrir_npc(id)

func _abrir_npc(id: String) -> void:
	if m.conversa == null:
		return
	for n in m.npcs:
		if str(n.get("id", "")) == id:
			m.conversa.abrir(n, false) # abriu sozinha (Ir): o primeiro toque em Missão já vale
			return

# ---------- marca no chão (história v2): coluna de luz lilás na pista, no fragmento ou no meio do lago ----------
# Uma só, sem luz e sem sombra (André: FPS antes de enfeite); aparece a menos de MARCA_LONGE m.
const MARCA_LONGE := 140.0
const SH_MARCA := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
uniform vec4 cor = vec4(0.72, 0.62, 0.95, 1.0);
void fragment() {
	float h = 1.0 - UV.y;
	float borda = pow(abs(dot(NORMAL, VIEW)), 1.4);
	float pulso = 0.75 + 0.25 * sin(TIME * 2.4);
	float risco = smoothstep(0.0, 0.25, fract(h * 3.0 - TIME * 0.6));
	ALBEDO = mix(cor.rgb, vec3(1.0), (1.0 - h) * 0.5);
	ALPHA = clamp(borda * (1.0 - h) * pulso * (0.35 + 0.35 * risco), 0.0, 1.0);
}
"""
var _marca: MeshInstance3D

func _marca_atualizar(M: Dictionary) -> void:
	var hi := _info(M)
	var mostrar: bool = hi.get("marca", false) == true and hi.get("alvo") is Dictionary and m.heroi != null
	if mostrar:
		var a: Dictionary = hi.alvo
		var p := Vector3(float(a.x), 0.0, float(a.z))
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
				sh.code = SH_MARCA
				mat.shader = sh
				_marca.material_override = mat
				m.add_child(_marca)
			p.y = m.chao_em(p.x, p.z) + 4.5
			_marca.position = p
	if _marca != null and _marca.visible != mostrar:
		_marca.visible = mostrar

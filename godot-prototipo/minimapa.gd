extends CanvasLayer
# Minimapa (pedido do André 2026-11-03): redondo no canto de cima à direita, com o menu do topo à esquerda dele, com o norte
# para cima. Mostra a mata, a estrada, as clareiras de caça (bolinha na cor do bicho com o nível), o veio de cobre,
# os outros jogadores e o herói (seta) com o lado para onde a câmera olha. Tocar nele abre o mapa completo, com o nome
# e o nível de cada clareira; tocar de novo (ou no X) fecha.
# O desenho de cima vem pronto (modelos/minimapa.png, feito por client/src/minimapa.js com os dados do servidor);
# os nomes, o herói e os jogadores são desenhados aqui por cima, nítidos.
# "Ir para" (André 2026-11-03): no mapa completo, tocar num lugar marca o lugar e mostra a rota pela estrada com o botão
# "Ir para"; tocar no botão fecha o mapa e o herói vai sozinho (rota.gd). Tocar fora do mapa (ou no X) fecha.

const RAIO := 74.0 # px do minimapa na tela (1280 x 576)
const MARGEM := Vector2(16, 21) # do canto de cima à direita, com 12 px de folga contando o "N" e a moldura; o menu do topo fica à esquerda dele (André 2026-11-03:
# o minimapa subiu para não encostar nas skills)
const ALCANCE := 46.0 # metros do centro até a borda do minimapa
const COR_BICHO := {"puglin": Color("b98cff"), "imp": Color("ff8f45"), "lobo": Color("a9d6ff"), "chefe": Color("ff4a4a"), "golem": Color("ff7a1a"), "maw": Color("9cff5a"), "warrok": Color("ffcc40")}
const NOME_BICHO := {"puglin": "Puglins", "imp": "Imps", "lobo": "Lobos", "golem": "Golens", "maw": "Maws"}
const COR_OURO := Color("e9c46a")
const COR_MINA := {"cobre": Color("d9822b"), "pedra": Color("a39d92"), "ferro": Color("8fa3bd")} # losango de cada zona de mineração
const COR_FUNDO := Color(0.06, 0.07, 0.05, 0.85)

var m # main.gd
var info: Dictionary # mundo.minimapa: x0, z0, tam (metros) e px
var textura: Texture2D
var mini: Control
var mapa_mini: TextureRect
var marcas: Control
var grande: Control
var mapa_grande: TextureRect
var marcas_grande: Control
var aberto := false
var fonte: Font
var marcado = null # Vector2 (metros) do lugar tocado no mapa completo, ou null
var previa := PackedVector2Array() # rota pela estrada até o lugar marcado (rota.planejar)
var botao_ir := Rect2() # onde está o botão "Ir para" na tela (para o toque)
var botao_x := Rect2() # X de fechar o mapa
const COR_ROTA := Color("ffd27a")
const COR_PINO := Color("ff6a4a")

func _init(principal) -> void:
	m = principal
	layer = 3 # acima da HUD (os botões não passam por cima); o menu do topo (4) e as janelas ficam acima

func _ready() -> void:
	info = m.mundo.get("minimapa", {"x0": -50.0, "z0": -60.0, "tam": 300.0, "px": 1024})
	fonte = load("res://fontes/AlegreyaSans-Bold.ttf")
	if ResourceLoader.exists("res://modelos/minimapa.png"):
		textura = load("res://modelos/minimapa.png")
	# minimapa redondo
	mini = Control.new()
	mini.anchor_left = 1.0
	mini.anchor_right = 1.0
	mini.offset_right = -MARGEM.x
	mini.offset_left = -MARGEM.x - RAIO * 2.0
	mini.offset_top = MARGEM.y
	mini.offset_bottom = MARGEM.y + RAIO * 2.0
	mini.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(mini)
	mapa_mini = TextureRect.new()
	mapa_mini.texture = textura
	mapa_mini.set_anchors_preset(Control.PRESET_FULL_RECT)
	mapa_mini.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	mapa_mini.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sm := ShaderMaterial.new()
	sm.shader = Shader.new()
	sm.shader.code = """shader_type canvas_item;
uniform vec2 centro = vec2(0.5);
uniform float alcance = 0.3;
void fragment() {
	vec2 d = UV - 0.5;
	float r = length(d);
	vec4 c = texture(TEXTURE, centro + d * alcance);
	c.rgb *= 1.0 - smoothstep(0.36, 0.5, r) * 0.35; // escurece perto da moldura
	COLOR = vec4(c.rgb, 1.0 - smoothstep(0.485, 0.5, r));
}"""
	mapa_mini.material = sm
	mini.add_child(mapa_mini)
	marcas = Control.new()
	marcas.set_anchors_preset(Control.PRESET_FULL_RECT)
	marcas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	marcas.draw.connect(_desenhar_mini)
	mini.add_child(marcas)
	# mapa completo (tela inteira)
	grande = Control.new()
	grande.set_anchors_preset(Control.PRESET_FULL_RECT)
	grande.mouse_filter = Control.MOUSE_FILTER_IGNORE
	grande.visible = false
	add_child(grande)
	var escuro := ColorRect.new()
	escuro.color = Color(0.02, 0.03, 0.02, 0.82)
	escuro.set_anchors_preset(Control.PRESET_FULL_RECT)
	escuro.mouse_filter = Control.MOUSE_FILTER_IGNORE
	grande.add_child(escuro)
	mapa_grande = TextureRect.new()
	mapa_grande.texture = textura
	mapa_grande.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	mapa_grande.stretch_mode = TextureRect.STRETCH_SCALE
	mapa_grande.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sg := ShaderMaterial.new()
	sg.shader = Shader.new()
	sg.shader.code = """shader_type canvas_item;
void fragment() {
	vec2 d = abs(UV - 0.5) * 2.0;
	float borda = max(d.x, d.y);
	vec4 c = texture(TEXTURE, UV);
	c.rgb *= 1.0 - smoothstep(0.86, 1.0, borda) * 0.45;
	COLOR = c;
}"""
	mapa_grande.material = sg
	grande.add_child(mapa_grande)
	marcas_grande = Control.new()
	marcas_grande.set_anchors_preset(Control.PRESET_FULL_RECT)
	marcas_grande.mouse_filter = Control.MOUSE_FILTER_IGNORE
	marcas_grande.draw.connect(_desenhar_grande)
	grande.add_child(marcas_grande)

# metros -> fração da textura (0..1)
func _uv(x: float, z: float) -> Vector2:
	return Vector2((x - float(info.x0)) / float(info.tam), (z - float(info.z0)) / float(info.tam))

# o toque é do minimapa? (a HUD não usa esse toque para o joystick nem para a câmera)
func cobre(p: Vector2) -> bool:
	if aberto:
		return true
	if not mini.visible:
		return false
	var c: Vector2 = mini.get_global_rect().get_center()
	return p.distance_to(c) <= RAIO + 6.0

func _input(ev: InputEvent) -> void:
	if not (ev is InputEventScreenTouch) or not ev.pressed:
		return
	if aberto:
		_toque_no_mapa(ev.position)
		get_viewport().set_input_as_handled()
	elif mini.visible and cobre(ev.position) and not m.hud.bloqueado:
		abrir()
		get_viewport().set_input_as_handled()

# mapa completo aberto: botão "Ir para", lugar no mapa (marca), X ou fora do mapa (fecha)
func _toque_no_mapa(pos: Vector2) -> void:
	var lp: Vector2 = pos - grande.get_global_rect().position
	if marcado != null and botao_ir.has_point(lp):
		var r: PackedVector2Array = previa
		fechar()
		if m.rota:
			m.rota.ir(r)
		if m.sons:
			m.sons.tocar("pano", -10.0)
		return
	if botao_x.has_point(lp):
		fechar()
		return
	var mapa := Rect2(mapa_grande.position, mapa_grande.size)
	if mapa.has_point(lp) and m.rota:
		var k: float = float(info.tam) / mapa_grande.size.x # metros por px
		var w: Vector2 = (lp - mapa.position) * k + Vector2(float(info.x0), float(info.z0))
		previa = m.rota.planejar(w)
		marcado = previa[previa.size() - 1] if previa.size() > 0 else w
		marcas_grande.queue_redraw()
		return
	fechar()

func abrir() -> void:
	aberto = true
	marcado = null
	previa = PackedVector2Array()
	layer = 14 # o mapa aberto cobre a HUD e o menu do topo (abaixo da conversa com NPC e do menu do personagem)
	grande.visible = true
	m.hud.bloqueado = true
	m.hud.soltar_tudo()
	_arrumar_grande()
	if m.sons:
		m.sons.tocar("pano", -8.0) # papel do mapa abrindo

func fechar() -> void:
	aberto = false
	layer = 3
	grande.visible = false
	m.hud.bloqueado = false

func _arrumar_grande() -> void:
	var tela: Vector2 = grande.size
	var lado: float = min(tela.y - 40.0, tela.x - 340.0)
	mapa_grande.size = Vector2(lado, lado)
	mapa_grande.position = Vector2((tela.x - 300.0 - lado) * 0.5, (tela.y - lado) * 0.5)

func _process(_dt: float) -> void:
	if m.heroi == null:
		return
	# some junto com a HUD (menu do personagem, criador, conversa com NPC)
	mini.visible = m.hud.visible and not m.hud.bloqueado or aberto
	if mini.visible:
		var p: Vector3 = m.heroi.position
		(mapa_mini.material as ShaderMaterial).set_shader_parameter("centro", _uv(p.x, p.z))
		(mapa_mini.material as ShaderMaterial).set_shader_parameter("alcance", ALCANCE * 2.0 / float(info.tam))
		marcas.queue_redraw()
	if aberto:
		_arrumar_grande()
		marcas_grande.queue_redraw()

# para onde o herói e a câmera olham (no plano: x para a direita, z para baixo)
func _frente_heroi() -> Vector2:
	var ry: float = m.heroi.rotation.y
	return Vector2(sin(ry), cos(ry))

func _frente_camera() -> Vector2:
	if m.camera == null:
		return Vector2(0, -1)
	var f: Vector3 = -m.camera.global_transform.basis.z
	var v := Vector2(f.x, f.z)
	return v.normalized() if v.length() > 0.01 else Vector2(0, -1)

func _seta(c: Control, pos: Vector2, dir: Vector2, tam: float, cor: Color) -> void:
	var lado := Vector2(-dir.y, dir.x)
	var pts := PackedVector2Array([pos + dir * tam, pos - dir * tam * 0.6 + lado * tam * 0.62, pos - dir * tam * 0.25, pos - dir * tam * 0.6 - lado * tam * 0.62])
	c.draw_colored_polygon(pts, Color(0, 0, 0, 0.55), PackedVector2Array(), null)
	var pts2 := PackedVector2Array()
	for q in pts:
		pts2.append(pos + (q - pos) * 0.78)
	c.draw_colored_polygon(pts2, cor)

func _texto(c: Control, pos: Vector2, t: String, tam: int, cor: Color, centro := true, contorno := 5) -> void:
	var w: float = fonte.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, tam).x
	var p := pos - Vector2(w * 0.5 if centro else 0.0, -tam * 0.35)
	if contorno > 0:
		c.draw_string_outline(fonte, p, t, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, contorno, Color(0.05, 0.04, 0.03, 0.9))
	c.draw_string(fonte, p, t, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, cor)

func _marca_clareira(c: Control, pos: Vector2, cc: Dictionary, r: float, com_nivel: bool) -> void:
	var cor: Color = COR_BICHO.get(str(cc.get("bicho", "")), Color.WHITE)
	c.draw_circle(pos, r + 2.0, Color(0.05, 0.04, 0.03, 0.85))
	c.draw_circle(pos, r, cor)
	c.draw_circle(pos + Vector2(-r, -r) * 0.32, r * 0.28, Color(1, 1, 1, 0.3))
	if com_nivel:
		_texto(c, pos + Vector2(0, 0), str(int(cc.get("nivel", 1))), int(r * 1.3), Color(0.1, 0.07, 0.04), true, 0)

func _desenhar_mini() -> void:
	var c := marcas
	var tam: Vector2 = c.size
	var meio := tam * 0.5
	var p: Vector3 = m.heroi.position
	var k: float = RAIO / ALCANCE # px por metro
	# clareiras, veio de cobre e outros jogadores que estão dentro do círculo
	for cc in m.mundo.get("caca", []):
		var q: Vector2 = meio + Vector2(float(cc.x) - p.x, float(cc.z) - p.z) * k
		if q.distance_to(meio) < RAIO - 10.0:
			_marca_clareira(c, q, cc, 8.0, true)
	for mn in m.mundo.get("mina", []):
		var q: Vector2 = meio + Vector2(float(mn.x) - p.x, float(mn.z) - p.z) * k
		if q.distance_to(meio) < RAIO - 8.0:
			c.draw_colored_polygon(PackedVector2Array([q + Vector2(0, -6), q + Vector2(5, 0), q + Vector2(0, 6), q + Vector2(-5, 0)]), COR_MINA.get(str(mn.get("tipo", "")), Color("d9822b")))
	for o in _outros():
		var q: Vector2 = meio + Vector2(o.x - p.x, o.z - p.z) * k
		if q.distance_to(meio) < RAIO - 4.0:
			c.draw_circle(q, 4.0, Color(0.05, 0.05, 0.1, 0.8))
			c.draw_circle(q, 3.0, Color("6fb6ff"))
	for o in _time(): # amigos do time (amigos.gd): verde, na beirada quando estão longe
		var dq: Vector2 = Vector2(o.x - p.x, o.z - p.z) * k
		if dq.length() > RAIO - 6.0:
			dq = dq.normalized() * (RAIO - 6.0)
		c.draw_circle(meio + dq, 5.0, Color(0.03, 0.08, 0.03, 0.9))
		c.draw_circle(meio + dq, 4.0, m.amigos.COR_TIME)
	# "Ir para" em andamento: o resto da rota e o lugar marcado (na beirada, se estiver longe)
	if m.rota and m.rota.ativo:
		var cam: PackedVector2Array = m.rota.caminho
		var ant: Vector2 = meio
		for j in range(m.rota.i, cam.size()):
			var q: Vector2 = meio + Vector2(cam[j].x - p.x, cam[j].y - p.z) * k
			if q.distance_to(meio) > RAIO - 4.0 or ant.distance_to(meio) > RAIO - 4.0:
				break
			c.draw_line(ant, q, Color(0.05, 0.04, 0.03, 0.75), 5.0, true)
			c.draw_line(ant, q, COR_ROTA, 3.0, true)
			ant = q
		var dq: Vector2 = Vector2(cam[cam.size() - 1].x - p.x, cam[cam.size() - 1].y - p.z) * k
		if dq.length() > RAIO - 10.0:
			dq = dq.normalized() * (RAIO - 10.0)
		_pino(c, meio + dq, 0.8)
	# lado para onde a câmera olha (leque claro) e o herói (seta dourada)
	var fc := _frente_camera()
	var leque := PackedVector2Array([meio])
	for i in 9:
		leque.append(meio + fc.rotated(lerp(-0.55, 0.55, i / 8.0)) * 34.0)
	c.draw_colored_polygon(leque, Color(1, 0.95, 0.75, 0.16))
	_seta(c, meio, _frente_heroi(), 9.0, COR_OURO)
	# moldura e o norte
	c.draw_arc(meio, RAIO + 1.0, 0, TAU, 72, Color(0.05, 0.04, 0.03, 0.9), 5.0, true)
	c.draw_arc(meio, RAIO - 1.0, 0, TAU, 72, Color("c9a35a"), 2.0, true)
	var n := meio + Vector2(0, -RAIO)
	c.draw_circle(n, 9.0, Color(0.05, 0.04, 0.03, 0.9))
	_texto(c, n + Vector2(0, -1), "N", 13, COR_OURO)

# amigos do time (amigos.gd)
func _time() -> Array:
	return m.amigos.pontos_time() if m.amigos and m.amigos.em_time() else []

# jogadores online perto (posições do online.gd)
func _outros() -> Array:
	var l: Array = []
	if m.online and m.online.get("ligado") and m.online.get("outros") is Dictionary:
		for id in m.online.outros:
			var o = m.online.outros[id]
			if o is Dictionary and o.has("no") and is_instance_valid(o.no):
				l.append(Vector2(o.no.position.x, o.no.position.z))
		# área de interesse: quem está longe não vem na foto, mas vem na lista leve do mapa (a cada 0,5 s)
		var meu: String = str(m.online.get("meu_id"))
		var lista = m.online.get("no_mapa")
		if lista is Array:
			for p in lista:
				if p is Array and p.size() >= 3 and str(p[0]) != meu and not m.online.outros.has(str(p[0])):
					l.append(Vector2(float(p[1]), float(p[2])))
	var r: Array = []
	for v in l:
		r.append({"x": v.x, "z": v.y})
	return r

func _desenhar_grande() -> void:
	var c := marcas_grande
	var o: Vector2 = mapa_grande.position
	var lado: float = mapa_grande.size.x
	var k: float = lado / float(info.tam)
	var em := func(x: float, z: float) -> Vector2: return o + Vector2(x - float(info.x0), z - float(info.z0)) * k
	c.draw_rect(Rect2(o - Vector2(3, 3), Vector2(lado, lado) + Vector2(6, 6)), Color("c9a35a"), false, 2.0)
	# lugares
	_texto(c, em.call(-6.0, -30.0), "Vila da Clareira", 17, Color(1, 0.95, 0.85))
	var vl: Dictionary = m.mundo.get("vilaLotes", {})
	if not vl.is_empty(): # Vila dos Lotes (construção e fazenda)
		_texto(c, em.call(float(vl.x), float(vl.z) - 20.0), str(vl.nome), 15, Color(1, 0.95, 0.85))
	for mn in m.mundo.get("mina", []):
		var q: Vector2 = em.call(float(mn.x), float(mn.z))
		var cm: Color = COR_MINA.get(str(mn.get("tipo", "")), Color("d9822b"))
		c.draw_colored_polygon(PackedVector2Array([q + Vector2(0, -7), q + Vector2(6, 0), q + Vector2(0, 7), q + Vector2(-6, 0)]), cm)
		_texto(c, q + Vector2(0, -16), str(mn.get("nome", "Veio")), 13, Color("f2b56b") if str(mn.get("tipo", "cobre")) == "cobre" else cm.lightened(0.35))
	for cc in m.mundo.get("caca", []):
		var q: Vector2 = em.call(float(cc.x), float(cc.z))
		_marca_clareira(c, q, cc, 10.0, true)
		_texto(c, q + Vector2(0, 22), "%s  Nv %d" % [NOME_BICHO.get(str(cc.get("bicho", "")), "Monstros"), int(cc.get("nivel", 1))], 14, Color(1, 0.96, 0.88))
	for p in _outros():
		var q: Vector2 = em.call(p.x, p.z)
		c.draw_circle(q, 5.0, Color(0.05, 0.05, 0.1, 0.8))
		c.draw_circle(q, 4.0, Color("6fb6ff"))
	for p in _time():
		var q: Vector2 = em.call(p.x, p.z)
		c.draw_circle(q, 6.0, Color(0.03, 0.08, 0.03, 0.9))
		c.draw_circle(q, 5.0, m.amigos.COR_TIME)
		_texto(c, q + Vector2(0, -12), p.nome, 13, m.amigos.COR_TIME.lightened(0.3))
	# rota pela estrada: a que está sendo andada e a do lugar marcado agora
	if m.rota and m.rota.ativo and marcado == null:
		_rota_grande(c, m.rota.caminho, m.rota.i, em)
	if marcado != null:
		_rota_grande(c, previa, 0, em)
	var hp: Vector3 = m.heroi.position
	var qh: Vector2 = em.call(hp.x, hp.z)
	c.draw_circle(qh, 13.0, Color(1, 0.85, 0.4, 0.18))
	_seta(c, qh, _frente_heroi(), 11.0, COR_OURO)
	# legenda: as clareiras por nível
	var x0: float = o.x + lado + 26.0
	var y: float = o.y + 14.0
	_texto(c, Vector2(x0, y + 4.0), "Mapa", 24, COR_OURO, false)
	y += 34.0
	var lista: Array = m.mundo.get("caca", []).duplicate()
	lista.sort_custom(func(a, b): return int(a.get("nivel", 1)) < int(b.get("nivel", 1)))
	for cc in lista:
		_marca_clareira(c, Vector2(x0 + 9.0, y), cc, 8.0, false)
		_texto(c, Vector2(x0 + 24.0, y), "Nv %d  %s" % [int(cc.get("nivel", 1)), str(cc.get("nome", ""))], 15, Color(1, 0.96, 0.88), false)
		y += 25.0
	y += 8.0
	c.draw_circle(Vector2(x0 + 9.0, y), 6.0, COR_BICHO.chefe)
	_texto(c, Vector2(x0 + 24.0, y), "1 Imp Chefe em cada clareira", 14, Color(1, 0.8, 0.75), false)
	y += 24.0
	_seta(c, Vector2(x0 + 9.0, y), Vector2(0, -1), 8.0, COR_OURO)
	_texto(c, Vector2(x0 + 24.0, y), "Você", 14, Color(1, 0.96, 0.88), false)
	_texto(c, Vector2(x0, o.y + lado - 26.0), "Toque num lugar para marcar", 14, Color(1, 1, 1, 0.6), false)
	_texto(c, Vector2(x0, o.y + lado - 6.0), "Toque fora do mapa para fechar", 14, Color(1, 1, 1, 0.6), false)
	# X de fechar no canto do mapa
	var cx := Vector2(o.x + lado - 18.0, o.y + 18.0)
	botao_x = Rect2(cx - Vector2(22, 22), Vector2(44, 44))
	c.draw_circle(cx, 15.0, Color(0.05, 0.04, 0.03, 0.85))
	c.draw_arc(cx, 15.0, 0, TAU, 32, Color("c9a35a"), 1.5, true)
	c.draw_line(cx + Vector2(-6, -6), cx + Vector2(6, 6), Color(1, 0.95, 0.85), 2.5, true)
	c.draw_line(cx + Vector2(6, -6), cx + Vector2(-6, 6), Color(1, 0.95, 0.85), 2.5, true)
	# lugar marcado: pino e o botão "Ir para" a ~70 px dele, do lado com mais espaço livre (direção de arte: o botão
	# nunca cobre o pino, a rota nem o nome de uma clareira), ligado ao pino por uma linha fina dourada
	botao_ir = Rect2()
	if marcado != null:
		var qm: Vector2 = em.call(marcado.x, marcado.y)
		_pino(c, qm, 1.15)
		var metros: float = m.rota.comprimento(previa) if m.rota else 0.0
		var lugar := _clareira_em(marcado)
		var t1 := "Ir para %s" % lugar if lugar != "" else "Ir para"
		var t2 := "%d m pela estrada" % int(round(metros))
		var w: float = max(fonte.get_string_size(t1, HORIZONTAL_ALIGNMENT_LEFT, -1, 20).x, fonte.get_string_size(t2, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x) + 36.0
		var bt := _lugar_do_botao(qm, Vector2(w, 54.0), em, Rect2(o, Vector2(lado, lado)))
		botao_ir = bt.grow(8.0) # dedo: área de toque um pouco maior que o desenho
		var borda: Vector2 = Vector2(clamp(qm.x, bt.position.x, bt.end.x), clamp(qm.y, bt.position.y, bt.end.y))
		c.draw_line(qm + (borda - qm).normalized() * 6.0, borda, Color(0.05, 0.04, 0.03, 0.6), 3.0, true)
		c.draw_line(qm + (borda - qm).normalized() * 6.0, borda, COR_OURO, 1.2, true)
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(0.12, 0.09, 0.05, 0.94)
		sb.border_color = COR_OURO
		sb.set_border_width_all(2)
		sb.set_corner_radius_all(12)
		sb.shadow_color = Color(0, 0, 0, 0.45)
		sb.shadow_size = 6
		sb.draw(c.get_canvas_item(), bt)
		_texto(c, bt.position + Vector2(w * 0.5, 19.0), t1, 20, COR_OURO, true, 4)
		_texto(c, bt.position + Vector2(w * 0.5, 39.0), t2, 13, Color(1, 0.96, 0.88, 0.85), true, 3)

# nome da clareira onde caiu o toque ("Puglins Nv 15"), ou ""
func _clareira_em(p: Vector2) -> String:
	for cc in m.mundo.get("caca", []):
		if p.distance_to(Vector2(float(cc.x), float(cc.z))) <= float(cc.get("r", 12.0)) + 2.0:
			return "%s Nv %d" % [NOME_BICHO.get(str(cc.get("bicho", "")), "Monstros"), int(cc.get("nivel", 1))]
	return ""

# onde o botão "Ir para" fica: abaixo, à direita, à esquerda ou acima do pino (~70 px), o lugar que cobre menos coisa
# (pino, rota, marcas e nomes das clareiras) e cabe no mapa
func _lugar_do_botao(qm: Vector2, tam: Vector2, em: Callable, mapa: Rect2) -> Rect2:
	var ocupado: Array = [Rect2(qm - Vector2(14, 34), Vector2(28, 40))] # o pino
	for cc in m.mundo.get("caca", []):
		var q: Vector2 = em.call(float(cc.x), float(cc.z))
		var nome := "%s  Nv %d" % [NOME_BICHO.get(str(cc.get("bicho", "")), "Monstros"), int(cc.get("nivel", 1))]
		var nw: float = fonte.get_string_size(nome, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
		ocupado.append(Rect2(q - Vector2(13, 13), Vector2(26, 26)))
		ocupado.append(Rect2(q + Vector2(-nw * 0.5 - 3.0, 12.0), Vector2(nw + 6.0, 20.0)))
	var rota_px: Array = []
	for pt in previa:
		rota_px.append(em.call(pt.x, pt.y))
	var hp: Vector3 = m.heroi.position
	rota_px.push_front(em.call(hp.x, hp.z))
	var melhor := Rect2()
	var menor := INF
	var dirs := [Vector2(0, 1), Vector2(1, 0), Vector2(-1, 0), Vector2(0, -1), Vector2(1, 1), Vector2(-1, 1), Vector2(1, -1), Vector2(-1, -1)]
	for dist in [70.0, 100.0, 135.0]:
		for d in dirs:
			var u: Vector2 = d.normalized()
			var centro: Vector2 = qm + Vector2(0, -12) + u * (dist + (tam.x * 0.5 * abs(u.x) + tam.y * 0.5 * abs(u.y)) * 0.6)
			var r := Rect2(centro - tam * 0.5, tam)
			r.position.x = clamp(r.position.x, mapa.position.x + 4.0, mapa.end.x - tam.x - 4.0)
			r.position.y = clamp(r.position.y, mapa.position.y + 4.0, mapa.end.y - tam.y - 4.0)
			var custo: float = dist # mais perto é melhor, se não cobrir nada
			var rg := r.grow(4.0)
			for o in ocupado:
				if rg.intersects(o):
					custo += 5000.0 + rg.intersection(o).get_area()
			for k in range(1, rota_px.size()):
				if _corta(rg, rota_px[k - 1], rota_px[k]):
					custo += 3000.0
			if custo < menor - 0.5:
				menor = custo
				melhor = r
	return melhor

# o segmento a-b passa pelo retângulo?
func _corta(r: Rect2, a: Vector2, b: Vector2) -> bool:
	var n: int = max(1, int(a.distance_to(b) / 4.0))
	for k in n + 1:
		if r.has_point(a.lerp(b, float(k) / n)):
			return true
	return false

# rota no mapa completo: linha tracejada dourada do herói até o lugar; durante a viagem o trecho já andado fica
# apagado (35%), para mostrar o progresso
func _rota_grande(c: Control, r: PackedVector2Array, de: int, em: Callable) -> void:
	if r.is_empty():
		return
	if de > 0:
		var ja: Vector2 = em.call(r[0].x, r[0].y)
		for j in range(1, min(de, r.size() - 1) + 1):
			var q0: Vector2 = em.call(r[j].x, r[j].y)
			c.draw_dashed_line(ja, q0, Color(COR_ROTA, 0.35), 2.5, 5.0, true)
			ja = q0
	var hp: Vector3 = m.heroi.position
	var ant: Vector2 = em.call(hp.x, hp.z)
	for j in range(de, r.size()):
		var q: Vector2 = em.call(r[j].x, r[j].y)
		c.draw_line(ant, q, Color(0.05, 0.04, 0.03, 0.75), 5.0, true)
		c.draw_dashed_line(ant, q, COR_ROTA, 2.5, 5.0, true)
		ant = q
	_pino(c, em.call(r[r.size() - 1].x, r[r.size() - 1].y), 1.0)

# pino do lugar marcado (gota vermelha com a ponta no lugar)
func _pino(c: Control, pos: Vector2, s: float) -> void:
	var topo: Vector2 = pos + Vector2(0, -14.0 * s)
	var r: float = 7.0 * s
	c.draw_colored_polygon(PackedVector2Array([pos, topo + Vector2(-r * 0.85, r * 0.5), topo + Vector2(r * 0.85, r * 0.5)]), Color(0.05, 0.04, 0.03, 0.85))
	c.draw_circle(topo, r + 1.5, Color(0.05, 0.04, 0.03, 0.85))
	c.draw_colored_polygon(PackedVector2Array([pos + Vector2(0, -1.5), topo + Vector2(-r * 0.75, r * 0.45), topo + Vector2(r * 0.75, r * 0.45)]), COR_PINO)
	c.draw_circle(topo, r, COR_PINO)
	c.draw_circle(topo, r * 0.38, Color(1, 0.95, 0.85))

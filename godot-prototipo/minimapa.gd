extends CanvasLayer
# Minimapa (pedido do André 2026-11-03): redondo no canto de cima à direita, com o menu do topo à esquerda dele, com o norte
# para cima. Mostra a mata, a estrada, as clareiras de caça (bolinha na cor do bicho com o nível), o veio de cobre,
# os outros jogadores e o herói (seta) com o lado para onde a câmera olha. Tocar nele abre o mapa completo, com o nome
# e o nível de cada clareira; tocar de novo (ou no X) fecha.
# O desenho de cima vem pronto (modelos/minimapa.png, feito por client/src/minimapa.js com os dados do servidor);
# os nomes, o herói e os jogadores são desenhados aqui por cima, nítidos.

const RAIO := 74.0 # px do minimapa na tela (1280 x 576)
const MARGEM := Vector2(14, 10) # do canto de cima à direita; o menu do topo fica à esquerda dele (André 2026-11-03:
# o minimapa subiu para não encostar nas skills)
const ALCANCE := 46.0 # metros do centro até a borda do minimapa
const COR_BICHO := {"puglin": Color("b98cff"), "imp": Color("ff8f45"), "lobo": Color("a9d6ff"), "chefe": Color("ff4a4a")}
const NOME_BICHO := {"puglin": "Puglins", "imp": "Imps", "lobo": "Lobos"}
const COR_OURO := Color("e9c46a")
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
		fechar()
		get_viewport().set_input_as_handled()
	elif mini.visible and cobre(ev.position) and not m.hud.bloqueado:
		abrir()
		get_viewport().set_input_as_handled()

func abrir() -> void:
	aberto = true
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
			c.draw_colored_polygon(PackedVector2Array([q + Vector2(0, -6), q + Vector2(5, 0), q + Vector2(0, 6), q + Vector2(-5, 0)]), Color("d9822b"))
	for o in _outros():
		var q: Vector2 = meio + Vector2(o.x - p.x, o.z - p.z) * k
		if q.distance_to(meio) < RAIO - 4.0:
			c.draw_circle(q, 4.0, Color(0.05, 0.05, 0.1, 0.8))
			c.draw_circle(q, 3.0, Color("6fb6ff"))
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

# jogadores online perto (posições do online.gd)
func _outros() -> Array:
	var l: Array = []
	if m.online and m.online.get("ligado") and m.online.get("outros") is Dictionary:
		for id in m.online.outros:
			var o = m.online.outros[id]
			if o is Dictionary and o.has("no") and is_instance_valid(o.no):
				l.append(Vector2(o.no.position.x, o.no.position.z))
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
	for mn in m.mundo.get("mina", []):
		var q: Vector2 = em.call(float(mn.x), float(mn.z))
		c.draw_colored_polygon(PackedVector2Array([q + Vector2(0, -7), q + Vector2(6, 0), q + Vector2(0, 7), q + Vector2(-6, 0)]), Color("d9822b"))
		_texto(c, q + Vector2(0, -16), str(mn.get("nome", "Veio")), 13, Color("f2b56b"))
	for cc in m.mundo.get("caca", []):
		var q: Vector2 = em.call(float(cc.x), float(cc.z))
		_marca_clareira(c, q, cc, 10.0, true)
		_texto(c, q + Vector2(0, 22), "%s  Nv %d" % [NOME_BICHO.get(str(cc.get("bicho", "")), "Monstros"), int(cc.get("nivel", 1))], 14, Color(1, 0.96, 0.88))
	for p in _outros():
		var q: Vector2 = em.call(p.x, p.z)
		c.draw_circle(q, 5.0, Color(0.05, 0.05, 0.1, 0.8))
		c.draw_circle(q, 4.0, Color("6fb6ff"))
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
	_texto(c, Vector2(x0, o.y + lado - 6.0), "Toque para fechar", 14, Color(1, 1, 1, 0.6), false)

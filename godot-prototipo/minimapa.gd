extends CanvasLayer
# Minimapa (pedido do André 2026-11-03): redondo no canto de cima à direita, com o menu do topo à esquerda dele, com o norte
# para cima. Mostra a mata, a estrada, as clareiras de caça (bolinha na cor do bicho com o nível), o veio de cobre,
# os outros jogadores e o herói (seta) com o lado para onde a câmera olha. Tocar nele abre o mapa completo, com o nome
# e o nível de cada clareira; tocar de novo (ou no X) fecha.
# O desenho de cima vem pronto (modelos/minimapa.png, feito por client/src/minimapa.js com os dados do servidor);
# os nomes, o herói e os jogadores são desenhados aqui por cima, nítidos.
# "Ir para" (André 2026-11-03): no mapa completo, tocar num lugar marca o lugar e mostra a rota pela estrada com o botão
# "Ir para"; tocar no botão fecha o mapa e o herói vai sozinho (rota.gd). Tocar fora do mapa (ou no X) fecha.
# Janela do mapa (André 2026-11-05): o mapa ocupa a tela toda à esquerda da lista e já abre com zoom, centrado no herói.
# Zoom com a pinça ou com os botões − e + embaixo; arrastar com um dedo anda pelo mapa. A lista da direita (Lugares)
# funciona: tocar num nome marca o lugar, leva o mapa até ele e mostra o "Ir para"; tocar de novo no mesmo nome já vai.

const MapaMundo = preload("res://mapa_mundo.gd")
const IconesNpc = preload("res://icones_npc.gd") # símbolo de cada NPC e a legenda do mapa (André 2026-11-12)
const RAIO := 74.0 # px do minimapa na tela (1280 x 576)
const MARGEM := Vector2(16, 21) # do canto de cima à direita, com 12 px de folga contando o "N" e a moldura; o menu do topo fica à esquerda dele (André 2026-11-03:
# o minimapa subiu para não encostar nas skills)
const ALCANCE := 46.0 # metros do centro até a borda do minimapa
const COR_BICHO := {"puglin": Color("b98cff"), "imp": Color("ff8f45"), "lobo": Color("a9d6ff"), "chefe": Color("ff4a4a"), "golem": Color("ff7a1a"), "maw": Color("9cff5a"), "warrok": Color("ffcc40")}
const NOME_BICHO := {"puglin": "Puglins", "imp": "Imps", "lobo": "Lobos", "golem": "Golens", "maw": "Maws"}
const COR_OURO := Color("e9c46a")
const COR_MINA := {"cobre": Color("d9822b"), "pedra": Color("a39d92"), "ferro": Color("8fa3bd"), "cristal": Color("9a7cff")} # losango de cada zona de mineração
const COR_FUNDO := Color(0.06, 0.07, 0.05, 0.85)

var m # main.gd
var icones # icones_npc.gd
var info: Dictionary # mundo.minimapa: x0, z0, tam (metros) e px
var textura: Texture2D
# FASE 3 (2026-11-09): o mundo inteiro (mapa_mundo.gd) embaixo e o desenho de hoje (minimapa.png) por cima, nítido
var mundo_r := Rect2() # metros: x0, z0, largura e altura do mundo (sem a grade, o quadrado de hoje)
var textura_mundo: Texture2D
var mapa_hoje: TextureRect # o desenho de hoje no mapa completo, no quadrado dele
var mini: Control
var mapa_mini: TextureRect
var marcas: Control
var grande: Control
var mapa_grande: TextureRect
var marcas_grande: Control # lista da direita (Lugares) e a legenda
var janela: Control # recorte do mapa completo (o que passa da borda não aparece)
var marcas_mapa: Control # nomes, rota, pino e botões desenhados por cima do mapa completo
var zoom := Z_ABRIR # 1 = o mapa inteiro na altura da janela
var zoom_alvo := Z_ABRIR
var foco := Vector2.ZERO # metros do mundo no meio da janela
var foco_alvo := Vector2.ZERO
var toques := {} # dedos na tela com o mapa aberto: índice -> {"p": posição, "ini": onde começou, "onde": "mapa"/"lista"/"fora"}
var ignorar := {} # o toque que abriu o mapa (soltar ele não marca nada)
var arrastou := false # o gesto andou o mapa ou fez pinça: soltar não conta como toque
var pinca := {} # começo da pinça: d (distância dos dedos), z (zoom) e w (ponto do mundo entre os dedos)
var rolar := 0.0 # rolagem da lista quando ela não cabe na tela
var lista_alt := 0.0 # altura da lista desenhada
var linhas := [] # [Rect2, lugar] de cada nome da lista (para o toque)
var selecionado := "" # id do lugar escolhido na lista
# Lista em sanfona (André 2026-11-12: "separe os spots de caçada, um menu de recursos, um menu de NPCs, mercadores para
# fazer entrega e o que mais tiver; todos os menus sanfonados para diminuir a quantidade de informação"). Cada seção
# começa fechada; tocar no título abre ou fecha. O que fica aberto vale até fechar o jogo.
const SECOES := [
	["vilas", "Vilas e cidades"], ["totens", "Totens"], ["caca", "Caçada"], ["boss", "Bosses"], ["dungeon", "Dungeons"],
	["recursos", "Recursos"], ["oficinas", "Oficinas"], ["npcs", "NPCs"], ["mercadores", "Mercadores (entregas)"]]
var abertas := {} # id da seção -> true quando aberta
var _cache_lugares: Array = [] # _lugares() montada (refeita ao abrir o mapa e a cada 2 s com ele aberto)
var _cache_t := -1.0
var botao_mais := Rect2()
var botao_menos := Rect2()
const Z_ABRIR := 1.8 # o mapa já abre maior (André 2026-11-05)
const Z_MIN := 1.0
const Z_MAX := 7.0
const LARGURA_LISTA := 300.0
var aberto := false
var fonte: Font
var marcado = null # Vector2 (metros) do lugar tocado no mapa completo, ou null
var previa := PackedVector2Array() # rota pela estrada até o lugar marcado (rota.planejar)
var botao_ir := Rect2() # onde está o botão "Ir para" na tela (para o toque)
var botao_x := Rect2() # X de fechar o mapa
# Mapa do totem (André 2026-11-11): encostar num totem abre este mapa no lugar da lista de destinos. Os totens ficam
# acesos (os liberados) e tocar num deles mostra "Teleportar" com a taxa; os ainda não visitados aparecem apagados e
# não respondem ao toque. O botão do canto alterna entre o mapa cheio e uma janela menor no meio da tela.
var totem_de := {} # o totem onde o herói está (vazio = mapa normal)
var totem_alvo := "" # id do totem escolhido no mapa
var cheio := true # mapa do totem: tela inteira (true) ou janela menor (false)
var botao_tam := Rect2() # minimizar / maximizar
var botao_tp := Rect2() # "Teleportar"
var escuro: ColorRect
const COR_ROTA := Color("ffd27a")
const COR_PINO := Color("ff6a4a")

func _init(principal) -> void:
	m = principal
	icones = IconesNpc.new(principal)
	layer = 3 # acima da HUD (os botões não passam por cima); o menu do topo (4) e as janelas ficam acima

func _ready() -> void:
	info = m.mundo.get("minimapa", {"x0": -50.0, "z0": -60.0, "tam": 300.0, "px": 1024})
	fonte = load("res://fontes/AlegreyaSans-Bold.ttf")
	if ResourceLoader.exists("res://modelos/minimapa.png"):
		textura = load("res://modelos/minimapa.png")
	mundo_r = Rect2(float(info.x0), float(info.z0), float(info.tam), float(info.tam))
	var g: Dictionary = m.terreno.mundo_g if m.terreno != null else {}
	if not g.is_empty():
		mundo_r = Rect2(float(g.x0), float(g.z0), (int(g.nx) - 1) * float(g.passo), (int(g.nz) - 1) * float(g.passo))
		textura_mundo = ImageTexture.create_from_image(MapaMundo.imagem(g, m.mundo.get("mata", [])))
	var hoje_r := Rect2((Vector2(float(info.x0), float(info.z0)) - mundo_r.position) / mundo_r.size, Vector2.ONE * float(info.tam) / mundo_r.size)
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
	mapa_mini.texture = textura_mundo if textura_mundo != null else textura
	mapa_mini.set_anchors_preset(Control.PRESET_FULL_RECT)
	mapa_mini.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	mapa_mini.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sm := ShaderMaterial.new()
	sm.shader = Shader.new()
	sm.shader.code = """shader_type canvas_item;
uniform vec2 centro = vec2(0.5);
uniform vec2 alcance = vec2(0.3);
uniform sampler2D hoje : filter_linear, repeat_disable;
uniform vec4 hoje_r = vec4(0.0, 0.0, 1.0, 1.0); // onde fica o desenho de hoje dentro do mundo (fração)
uniform float com_hoje = 0.0;
uniform sampler2D mascara_mundo : filter_linear, repeat_disable; // G = mapa andável de hoje (sem o quadrado em volta)
uniform float com_mascara = 0.0;
""" + VINHETA_HOJE + """
void fragment() {
	vec2 d = UV - 0.5;
	float r = length(d);
	vec2 uv = centro + d * alcance;
	vec4 c = texture(TEXTURE, uv);
	if (com_hoje > 0.5) {
		vec2 q = (uv - hoje_r.xy) / hoje_r.zw;
		float b = min(min(q.x, q.y), min(1.0 - q.x, 1.0 - q.y));
		float k = smoothstep(0.0, 0.03, b) * (com_mascara > 0.5 ? texture(mascara_mundo, uv).g : 1.0);
		if (b > 0.0) c.rgb = mix(c.rgb, sem_vinheta(texture(hoje, q).rgb, q), k);
	}
	c.rgb *= 1.0 - smoothstep(0.36, 0.5, r) * 0.35; // escurece perto da moldura
	COLOR = vec4(c.rgb, 1.0 - smoothstep(0.485, 0.5, r));
}"""
	mapa_mini.material = sm
	if textura_mundo != null and textura != null:
		sm.set_shader_parameter("hoje", textura)
		sm.set_shader_parameter("hoje_r", Vector4(hoje_r.position.x, hoje_r.position.y, hoje_r.size.x, hoje_r.size.y))
		sm.set_shader_parameter("com_hoje", 1.0)
		m.terreno.ligar_mascara(sm)
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
	escuro = ColorRect.new()
	escuro.color = Color(0.02, 0.03, 0.02, 0.82)
	escuro.set_anchors_preset(Control.PRESET_FULL_RECT)
	escuro.mouse_filter = Control.MOUSE_FILTER_IGNORE
	grande.add_child(escuro)
	janela = Control.new()
	janela.clip_contents = true
	janela.mouse_filter = Control.MOUSE_FILTER_IGNORE
	grande.add_child(janela)
	var fundo := ColorRect.new() # fora do mundo (zoom pequeno): verde bem escuro, como a mata vista de longe
	fundo.color = Color(0.05, 0.07, 0.045, 1.0) if textura_mundo == null else Color8(22, 54, 92) # com o mundo: mar fundo
	fundo.set_anchors_preset(Control.PRESET_FULL_RECT)
	fundo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	janela.add_child(fundo)
	mapa_grande = TextureRect.new()
	mapa_grande.texture = textura_mundo if textura_mundo != null else textura
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
	janela.add_child(mapa_grande)
	if textura_mundo != null and textura != null: # o desenho de hoje por cima do mundo, sem a vinheta e com a borda macia
		mapa_hoje = TextureRect.new()
		mapa_hoje.texture = textura
		mapa_hoje.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		mapa_hoje.stretch_mode = TextureRect.STRETCH_SCALE
		mapa_hoje.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var sh := ShaderMaterial.new()
		sh.shader = Shader.new()
		sh.shader.code = "shader_type canvas_item;\n" + VINHETA_HOJE + """
uniform sampler2D mascara_mundo : filter_linear, repeat_disable;
uniform float com_mascara = 0.0;
uniform vec4 hoje_r = vec4(0.0, 0.0, 1.0, 1.0);
void fragment() {
	float b = min(min(UV.x, UV.y), min(1.0 - UV.x, 1.0 - UV.y));
	float k = com_mascara > 0.5 ? texture(mascara_mundo, hoje_r.xy + UV * hoje_r.zw).g : 1.0;
	COLOR = vec4(sem_vinheta(texture(TEXTURE, UV).rgb, UV), smoothstep(0.0, 0.03, b) * k);
}"""
		sh.set_shader_parameter("hoje_r", Vector4(hoje_r.position.x, hoje_r.position.y, hoje_r.size.x, hoje_r.size.y))
		m.terreno.ligar_mascara(sh)
		mapa_hoje.material = sh
		janela.add_child(mapa_hoje)
	marcas_mapa = Control.new()
	marcas_mapa.set_anchors_preset(Control.PRESET_FULL_RECT)
	marcas_mapa.mouse_filter = Control.MOUSE_FILTER_IGNORE
	marcas_mapa.draw.connect(_desenhar_mapa)
	janela.add_child(marcas_mapa)
	marcas_grande = Control.new()
	marcas_grande.set_anchors_preset(Control.PRESET_FULL_RECT)
	marcas_grande.mouse_filter = Control.MOUSE_FILTER_IGNORE
	marcas_grande.draw.connect(_desenhar_grande)
	grande.add_child(marcas_grande)

# o minimapa.png (client/src/minimapa.js) escurece as pontas; por cima do mundo a conta volta à cor de antes
const VINHETA_HOJE := """
vec3 sem_vinheta(vec3 c, vec2 q) {
	float t = clamp((length(q - 0.5) - 0.35) / 0.4, 0.0, 1.0);
	return min(c / (1.0 - 0.35 * t), vec3(1.0));
}
"""

# metros -> fração da textura (0..1) do mundo (sem a grade, do quadrado de hoje)
func _uv(x: float, z: float) -> Vector2:
	return (Vector2(x, z) - mundo_r.position) / mundo_r.size

# zoom em que o mundo inteiro cabe na janela (com a grade do mundo dá para afastar além do quadrado de hoje)
func _z_min() -> float:
	if janela == null or janela.size.y <= 0.0:
		return Z_MIN
	return minf(Z_MIN, minf(janela.size.x / mundo_r.size.x, janela.size.y / mundo_r.size.y) * float(info.tam) / janela.size.y)

# o toque é do minimapa? (a HUD não usa esse toque para o joystick nem para a câmera)
func cobre(p: Vector2) -> bool:
	if aberto:
		return true
	if not mini.visible:
		return false
	var c: Vector2 = mini.get_global_rect().get_center()
	return p.distance_to(c) <= RAIO * mini.scale.x + 6.0

# onde fica o botão do atalho do zoom (hud.gd): encostado na borda do minimapa, em cima à esquerda (fora do alvo de
# abrir o mapa), acompanhando o lugar e o tamanho do minimapa
const ZOOM_ANG := -2.36 # rad (em cima à esquerda, com y para baixo): longe do botão Teste, do relógio e do menu do topo
func ponto_zoom(r: float) -> Vector2:
	var c: Vector2 = mini.get_global_rect().get_center()
	return c + Vector2(cos(ZOOM_ANG), sin(ZOOM_ANG)) * (RAIO * mini.scale.x + r * 0.55)

# modo de editar a interface (editar_hud.gd): o minimapa muda de lugar e de tamanho (escala em volta do centro)
func posicionar(d: Vector2, s: float) -> void:
	mini.offset_right = -MARGEM.x + d.x
	mini.offset_left = -MARGEM.x - RAIO * 2.0 + d.x
	mini.offset_top = MARGEM.y + d.y
	mini.offset_bottom = MARGEM.y + RAIO * 2.0 + d.y
	mini.pivot_offset = Vector2(RAIO, RAIO)
	mini.scale = Vector2(s, s)

func _input(ev: InputEvent) -> void:
	if aberto:
		if ev is InputEventScreenTouch or ev is InputEventScreenDrag:
			_gesto(ev)
			get_viewport().set_input_as_handled()
		elif ev is InputEventMouseButton and ev.pressed and (ev.button_index == MOUSE_BUTTON_WHEEL_UP or ev.button_index == MOUSE_BUTTON_WHEEL_DOWN):
			_zoom_em(ev.position - janela.get_global_rect().position, 1.15 if ev.button_index == MOUSE_BUTTON_WHEEL_UP else 1.0 / 1.15)
			get_viewport().set_input_as_handled()
		return
	if not (ev is InputEventScreenTouch) or not ev.pressed or m.hud.editando:
		return
	if mini.visible and cobre(ev.position) and not m.hud.bloqueado:
		abrir()
		ignorar[ev.index] = true
		get_viewport().set_input_as_handled()

# metros por px e o ponto da janela (local) onde fica um lugar do mundo
func _k() -> float:
	return janela.size.y / float(info.tam) * zoom

func _na_janela(x: float, z: float) -> Vector2:
	return janela.size * 0.5 + (Vector2(x, z) - foco) * _k()

func _no_mundo(lp: Vector2) -> Vector2:
	return foco + (lp - janela.size * 0.5) / _k()

# mapa aberto: um dedo arrasta o mapa (ou rola a lista), dois dedos fazem a pinça; tocar e soltar sem arrastar é toque
func _gesto(ev: InputEvent) -> void:
	var jr: Rect2 = janela.get_global_rect()
	if ev is InputEventScreenTouch:
		if ev.pressed:
			var onde := "fora"
			if jr.has_point(ev.position):
				onde = "mapa"
			elif _painel().has_point(ev.position):
				onde = "lista"
			if toques.is_empty():
				arrastou = false
			toques[ev.index] = {"p": ev.position, "ini": ev.position, "onde": onde}
			if toques.size() == 2:
				_comecar_pinca()
			return
		var t = toques.get(ev.index)
		toques.erase(ev.index)
		if ignorar.has(ev.index):
			ignorar.erase(ev.index)
			return
		if toques.size() == 1:
			pinca = {}
		if t != null and not arrastou and toques.is_empty():
			_toque_no_mapa(ev.position)
		return
	# arrastar
	if not toques.has(ev.index):
		return
	var td: Dictionary = toques[ev.index]
	td.p = ev.position
	if toques.size() >= 2 and not pinca.is_empty():
		var ks: Array = toques.keys()
		var a: Vector2 = toques[ks[0]].p
		var b: Vector2 = toques[ks[1]].p
		zoom = clamp(float(pinca.z) * a.distance_to(b) / max(float(pinca.d), 1.0), _z_min(), Z_MAX)
		zoom_alvo = zoom
		var meio: Vector2 = (a + b) * 0.5 - jr.position
		foco = pinca.w - (meio - janela.size * 0.5) / _k()
		foco = _prender(foco, zoom)
		foco_alvo = foco
		arrastou = true
		return
	if ignorar.has(ev.index):
		return
	if not arrastou and ev.position.distance_to(td.ini) > 12.0:
		arrastou = true
	if arrastou:
		if td.onde == "mapa":
			foco = _prender(foco - ev.relative / _k(), zoom)
			foco_alvo = foco
		elif td.onde == "lista":
			rolar = clamp(rolar - ev.relative.y, 0.0, max(0.0, lista_alt - _painel().size.y))

func _comecar_pinca() -> void:
	var ks: Array = toques.keys()
	var a: Vector2 = toques[ks[0]].p
	var b: Vector2 = toques[ks[1]].p
	var meio: Vector2 = (a + b) * 0.5 - janela.get_global_rect().position
	zoom = zoom_alvo # a pinça parte de onde o zoom está agora (sem a animação dos botões)
	pinca = {"d": a.distance_to(b), "z": zoom, "w": _no_mundo(meio)}
	arrastou = true

# zoom em volta de um ponto da janela (roda do mouse); os botões − e + usam o meio
func _zoom_em(lp: Vector2, fator: float) -> void:
	var w: Vector2 = _no_mundo(lp)
	zoom_alvo = clamp(zoom_alvo * fator, _z_min(), Z_MAX)
	zoom = zoom_alvo
	foco = _prender(w - (lp - janela.size * 0.5) / _k(), zoom)
	foco_alvo = foco

# o meio da janela não deixa o mapa sair da tela (com zoom pequeno, o mapa fica no meio)
func _prender(f: Vector2, z: float) -> Vector2:
	var k: float = janela.size.y / float(info.tam) * z
	var meia: Vector2 = janela.size * 0.5 / k
	var t: Vector2 = mundo_r.size
	var x0: float = mundo_r.position.x
	var z0: float = mundo_r.position.y
	f.x = x0 + t.x * 0.5 if meia.x * 2.0 >= t.x else clamp(f.x, x0 + meia.x, x0 + t.x - meia.x)
	f.y = z0 + t.y * 0.5 if meia.y * 2.0 >= t.y else clamp(f.y, z0 + meia.y, z0 + t.y - meia.y)
	return f

# onde fica a lista da direita (tela)
func _painel() -> Rect2:
	if not totem_de.is_empty(): # mapa do totem: sem a lista
		return Rect2()
	var g: Rect2 = grande.get_global_rect()
	return Rect2(g.position + Vector2(g.size.x - LARGURA_LISTA, 0), Vector2(LARGURA_LISTA, g.size.y))

# mapa completo aberto: botão "Ir para", − e +, X, nome da lista, lugar no mapa (marca) ou fora do mapa (fecha)
func _toque_no_mapa(pos: Vector2) -> void:
	var lp: Vector2 = pos - janela.get_global_rect().position
	var dentro: bool = Rect2(Vector2.ZERO, janela.size).has_point(lp)
	if dentro and marcado != null and botao_ir.has_point(lp):
		_ir()
		return
	if dentro and botao_x.has_point(lp):
		fechar()
		return
	if dentro and (botao_mais.has_point(lp) or botao_menos.has_point(lp)):
		zoom_alvo = clamp(zoom_alvo * (1.45 if botao_mais.has_point(lp) else 1.0 / 1.45), _z_min(), Z_MAX)
		if m.sons:
			m.sons.tocar("pano", -16.0)
		return
	if not totem_de.is_empty():
		_toque_totem(lp, dentro)
		return
	if dentro and icones.toque(lp): # abre e fecha a legenda
		return
	var pp: Rect2 = _painel()
	if pp.has_point(pos):
		var lq: Vector2 = pos - pp.position
		for ln in linhas:
			if (ln[0] as Rect2).has_point(lq):
				if ln[1].has("secao"): # título da sanfona: abre ou fecha
					var sid := str(ln[1].secao)
					abertas[sid] = not abertas.get(sid, false)
					if m.sons:
						m.sons.tocar("pano", -16.0)
				else:
					_escolher(ln[1])
				return
		return # espaço vazio da lista: não fecha
	if dentro and m.rota:
		_marcar(_no_mundo(lp))
		selecionado = ""
		return
	fechar()

func _marcar(w: Vector2) -> void:
	previa = m.rota.planejar(w) if m.rota else PackedVector2Array([w])
	marcado = previa[previa.size() - 1] if previa.size() > 0 else w
	marcas_mapa.queue_redraw()

var _npc_ir := "" # NPC escolhido na lista: ao chegar, abre a conversa (como o "Ir" da missão)
func _ir() -> void:
	var r: PackedVector2Array = previa
	var npc := _npc_ir if selecionado != "" else ""
	fechar()
	if m.rota:
		m.rota.ir(r, "Indo pela estrada", m.rota.OLHA, true) # viagem do mapa: vai no lobo; mar no meio não deixa
		if npc != "" and m.rota.ativo and m.missao_ativa:
			m.missao_ativa._npc_alvo = npc
	if m.sons:
		m.sons.tocar("pano", -10.0)

# nome tocado na lista: marca o lugar, leva o mapa até ele e mostra o "Ir para"; o mesmo nome de novo já vai
func _escolher(l: Dictionary) -> void:
	if selecionado == str(l.id) and marcado != null:
		_ir()
		return
	selecionado = str(l.id)
	_marcar(Vector2(float(l.x), float(l.z)))
	if l.has("antes") and previa.size() >= 2: # NPC ou oficina: para um pouco antes, do lado de onde chega
		var p := Vector2(float(l.x), float(l.z))
		var antes: Vector2 = previa[previa.size() - 2]
		if antes.distance_to(p) > float(l.antes):
			previa[previa.size() - 1] = p + (antes - p).normalized() * float(l.antes)
			marcado = previa[previa.size() - 1]
	_npc_ir = str(l.get("npc", ""))
	zoom_alvo = max(zoom_alvo, Z_ABRIR)
	foco_alvo = Vector2(float(l.x), float(l.z))
	if m.sons:
		m.sons.tocar("pano", -14.0)

# a boca da dungeon (mundo.json caverna: a primeira amostra do túnel é a boca), ou {} sem caverna
func _caverna() -> Dictionary:
	var cv: Dictionary = m.mundo.get("caverna", {})
	var am: Array = cv.get("amostras", [])
	if am.is_empty():
		return {}
	return {"nome": str(cv.get("nome", "Caverna")), "x": float(am[0].x), "z": float(am[0].z)}

# spot de pesca (Radar): peixinho claro num círculo da cor do tipo (comum azul-claro, raro azul, épico roxo)
func _marca_spot(c: Control, q: Vector2, t: float, cor: Color) -> void:
	c.draw_circle(q, t + 2.0, Color(0.03, 0.05, 0.08, 0.85))
	c.draw_circle(q, t, cor)
	var f := PackedVector2Array([q + Vector2(-t * 0.6, 0), q + Vector2(-t * 0.1, -t * 0.35), q + Vector2(t * 0.35, 0), q + Vector2(-t * 0.1, t * 0.35)])
	c.draw_colored_polygon(f, Color(1, 1, 1, 0.95))
	c.draw_colored_polygon(PackedVector2Array([q + Vector2(t * 0.3, 0), q + Vector2(t * 0.7, -t * 0.3), q + Vector2(t * 0.7, t * 0.3)]), Color(1, 1, 1, 0.95))

# marca da dungeon: arco de pedra escuro com a luz do selo dentro
func _marca_caverna(c: Control, q: Vector2, t: float) -> void:
	var arco := PackedVector2Array()
	for i in 9:
		var a := PI + PI * float(i) / 8.0
		arco.append(q + Vector2(cos(a) * t, sin(a) * t * 1.1 + t * 0.45))
	arco.append(q + Vector2(t, t * 0.6))
	arco.append(q + Vector2(-t, t * 0.6))
	c.draw_colored_polygon(arco, Color(0.12, 0.1, 0.1))
	c.draw_polyline(arco + PackedVector2Array([arco[0]]), COR_OURO, 1.5)
	c.draw_circle(q + Vector2(0, t * 0.15), t * 0.42, Color("ff9a2e"))

# 2026-11-07 (André: "quando abrir o mapa, aparece um símbolozinho lá onde é a nossa casa"): o meu terreno
# (construcao.meu) vira uma casinha no mapa, no minimapa e o primeiro nome da lista. {} quando não tenho terreno.
const COR_CASA := Color("d8553a") # telhado vermelho-tijolo: não se confunde com a vila (dourada) nem com o pino
func _minha_casa() -> Dictionary:
	var cs = m.get("construcao")
	if cs == null or str(cs.meu) == "" or not cs.lotes.has(cs.meu):
		return {}
	var d: Dictionary = cs.lotes[cs.meu].def
	return {"x": (float(d.x0) + float(d.x1)) * 0.5, "z": (float(d.z0) + float(d.z1)) * 0.5,
		"x0": float(d.x0), "z0": float(d.z0), "x1": float(d.x1), "z1": float(d.z1)}

# casinha: contorno escuro, parede creme, telhado vermelho, porta e chaminé (t = meia largura em px)
func _marca_casa(c: Control, q: Vector2, t: float) -> void:
	var esc := Color(0.05, 0.04, 0.03, 0.9)
	var teto := PackedVector2Array([q + Vector2(-t * 1.15, -t * 0.05), q + Vector2(0, -t * 1.15), q + Vector2(t * 1.15, -t * 0.05)])
	c.draw_circle(q + Vector2(0, -t * 0.1), t * 1.55, Color(0.05, 0.04, 0.03, 0.55))
	c.draw_rect(Rect2(q + Vector2(t * 0.42, -t * 1.0), Vector2(t * 0.3, t * 0.6)), esc) # chaminé
	c.draw_rect(Rect2(q + Vector2(t * 0.48, -t * 0.94), Vector2(t * 0.18, t * 0.5)), Color("8a5a3c"))
	c.draw_rect(Rect2(q + Vector2(-t * 0.85, -t * 0.15), Vector2(t * 1.7, t * 1.05)), esc)
	c.draw_rect(Rect2(q + Vector2(-t * 0.72, -t * 0.1), Vector2(t * 1.44, t * 0.88)), Color("f3e3c2"))
	c.draw_rect(Rect2(q + Vector2(-t * 0.2, t * 0.25), Vector2(t * 0.4, t * 0.53)), Color("7a4a2a")) # porta
	c.draw_colored_polygon(teto, COR_CASA)
	c.draw_polyline(teto, esc, 1.5, true)

# totem de teleporte: losango azul com o miolo claro; ainda não visitado, cinza
func _marca_totem(c: Control, q: Vector2, r: float, aceso: bool) -> void:
	var cor := Color("5ad8ff") if aceso else Color(0.62, 0.66, 0.72)
	var borda := PackedVector2Array([q + Vector2(0, -r - 2), q + Vector2(r * 0.75 + 2, 0), q + Vector2(0, r + 2), q + Vector2(-r * 0.75 - 2, 0)])
	c.draw_colored_polygon(borda, Color(0.04, 0.06, 0.1, 0.9))
	c.draw_colored_polygon(PackedVector2Array([q + Vector2(0, -r), q + Vector2(r * 0.75, 0), q + Vector2(0, r), q + Vector2(-r * 0.75, 0)]), cor)
	c.draw_circle(q, r * 0.22, Color(1, 1, 1, 0.9) if aceso else Color(0.85, 0.87, 0.9))

# os lugares da lista, já com a seção de cada um (montada uma vez e guardada: a lista é desenhada a cada quadro)
func _lugares() -> Array:
	var agora: float = Time.get_ticks_msec() / 1000.0
	if _cache_t < 0.0 or agora - _cache_t > 2.0:
		_cache_lugares = _montar_lugares()
		_cache_t = agora
	return _cache_lugares

const SECAO_DO_TIPO := {"casa": "vilas", "vila": "vilas", "totem": "totens", "caverna": "dungeon", "lago": "recursos", "mina": "recursos",
	"oficina": "oficinas", "npc": "npcs", "mercador": "mercadores"}

func _montar_lugares() -> Array:
	var l := _lugares_base()
	var hp: Vector3 = m.heroi.position if m.heroi != null else Vector3.ZERO
	var dist := func(a: Dictionary) -> float: return Vector2(float(a.x) - hp.x, float(a.z) - hp.z).length()
	# as outras cavernas do mundo grande (mundo_grade lugares "caverna") também são dungeons
	var gm: Dictionary = m.terreno.mundo_g if m.terreno != null else {}
	for lm in gm.get("lugares", []):
		if str(lm.get("tipo", "")) == "caverna":
			l.append({"id": "cav_%s" % lm.id, "tipo": "caverna", "nome": str(lm.get("nome", "Caverna")), "curto": str(lm.get("nome", "Caverna")), "x": float(lm.x), "z": float(lm.z), "r": 6.0})
	# oficinas públicas (bigorna, forninho, bancada) e os NPCs: o "Ir para" para do lado e abre a conversa
	var vila_nome := {}
	for vm in m.mundo.get("vilasMundo", []):
		vila_nome[str(vm.id)] = str(vm.nome)
	var ofs: Array = []
	for e in m.mundo.get("estacoes", []): # a mesma bigorna em cada vila: o nome leva a vila e a distância (mais perto em cima)
		var vn: String = vila_nome.get(str(e.get("vila", "")), "Vila da Clareira")
		ofs.append({"id": "of_%s" % e.id, "tipo": "oficina", "nome": "%s · %s" % [str(e.get("nome", e.id)).split(" da ")[0], vn], "curto": str(e.get("nome", e.id)), "x": float(e.x), "z": float(e.z), "r": 2.0, "antes": 1.4})
	ofs.sort_custom(func(a, b): return dist.call(a) < dist.call(b))
	for it in ofs:
		it.nome = "%s  (%d m)" % [it.nome, int(dist.call(it))]
		l.append(it)
	var npcs: Array = []
	var merc: Array = []
	var k := 0
	for n in m.mundo.get("npcs", []):
		k += 1
		var pack: bool = str(n.get("funcao", "")) == "pack"
		var nm := str(n.get("nome", n.id))
		var it := {"id": "npc_%d_%s" % [k, n.id], "tipo": "mercador" if pack else "npc", "npc": str(n.id), "funcao": str(n.get("funcao", "")),
			"nome": nm, "curto": nm.split(",")[0], "x": float(n.x), "z": float(n.z), "r": 2.0, "antes": 1.8}
		(merc if pack else npcs).append(it)
	npcs.sort_custom(func(a, b): return dist.call(a) < dist.call(b)) # os mais perto em cima
	merc.sort_custom(func(a, b): return dist.call(a) < dist.call(b))
	for it in npcs + merc:
		it.nome = "%s  (%d m)" % [it.nome, int(dist.call(it))]
		l.append(it)
	for it in l:
		if str(it.tipo) == "caca":
			it.sec = "boss" if it.cc.has("boss") else "caca"
		else:
			it.sec = SECAO_DO_TIPO.get(str(it.tipo), "vilas")
	return l

# os lugares de antes: as vilas, as clareiras de caça (por nível) e os veios
func _lugares_base() -> Array:
	var l: Array = []
	var casa := _minha_casa()
	if not casa.is_empty(): # o meu terreno em primeiro: "Ir para" leva para casa
		l.append({"id": "casa", "tipo": "casa", "nome": "Sua casa", "curto": "Sua casa", "x": casa.x, "z": casa.z, "r": 4.0})
	var nasc: Dictionary = m.mundo.get("nascimento", {"x": 0.0, "z": 1.0})
	l.append({"id": "vila", "tipo": "vila", "nome": "Vila da Clareira", "curto": "Vila da Clareira", "x": float(nasc.get("x", 0.0)), "z": float(nasc.get("z", 1.0)), "r": 30.0})
	var vl: Dictionary = m.mundo.get("vilaLotes", {})
	if not vl.is_empty():
		l.append({"id": "terras", "tipo": "vila", "nome": str(vl.nome), "curto": str(vl.nome), "x": float(vl.x), "z": float(vl.z), "r": 20.0})
	var cv := _caverna()
	if not cv.is_empty(): # a dungeon (Caverna da Montanha): a boca, na trilha da montanha
		l.append({"id": "caverna", "tipo": "caverna", "nome": "%s (dungeon)" % cv.nome, "curto": str(cv.nome), "x": cv.x, "z": cv.z, "r": 6.0})
	for lg in m.mundo.get("lagos", []): # lago de pescaria (Lago Grande, 2026-11-06): "Ir para" leva à margem da trilha
		if lg.get("pesca", false):
			var mg: Array = lg.get("chegada", [lg.x, lg.z])
			l.append({"id": str(lg.id), "tipo": "lago", "nome": str(lg.nome), "curto": str(lg.nome), "x": float(mg[0]), "z": float(mg[1]), "r": 4.0})
	var gm: Dictionary = m.terreno.mundo_g if m.terreno != null else {}
	for lm in gm.get("lugares", []): # FASE 3: vilas, cais e postos do mundo grande
		var tl := str(lm.get("tipo", ""))
		if tl == "vila" or tl == "porto" or tl == "posto":
			l.append({"id": str(lm.id), "tipo": "vila", "nome": str(lm.nome), "curto": str(lm.nome), "x": float(lm.x), "z": float(lm.z), "r": float(lm.r)})
	if m.totem: # totens de teleporte (André 2026-11-10): "Ir para" leva até a pedra
		for t in m.totem.T.lista:
			l.append({"id": "totem_%s" % t.id, "tipo": "totem", "nome": "Totem: %s" % t.nome, "curto": "Totem %s" % t.nome, "x": float(t.x), "z": float(t.z), "r": 4.0})
	var cs: Array = m.mundo.get("caca", []).duplicate()
	cs.sort_custom(func(a, b): return int(a.get("nivel", 1)) < int(b.get("nivel", 1)))
	for cc in cs:
		var vt: String = m.boss_mundo.volta_texto(str(cc.boss)) if cc.has("boss") else "" # boss de mundo caído: quando volta
		l.append({"id": str(cc.get("id", cc.nome)), "tipo": "caca", "cc": cc, "nome": ("Boss Nv %d  %s" if cc.has("boss") else "Nv %d  %s") % [int(cc.get("nivel", 1)), str(cc.get("nome", ""))] + ("  (%s)" % vt if vt != "" else ""),
			"curto": "%s Nv %d" % [NOME_BICHO.get(str(cc.get("bicho", "")), "Monstros"), int(cc.get("nivel", 1))], "x": float(cc.x), "z": float(cc.z), "r": float(cc.get("r", 12.0)) + 2.0})
	# FASE 2: os veios pequenos espalhados entram só o mais perto de cada minério (a lista não fica comprida)
	var perto := {}
	var hp: Vector3 = m.heroi.position if m.heroi != null else Vector3.ZERO
	for mn in m.mundo.get("mina", []):
		if not mn.get("pequeno", false) and not mn.get("mundo", false): # os do mundo grande também: só o mais perto
			l.append({"id": str(mn.get("id", mn.nome)), "tipo": "mina", "mn": mn, "nome": str(mn.get("nome", "Veio")), "curto": str(mn.get("nome", "Veio")), "x": float(mn.x), "z": float(mn.z), "r": float(mn.get("r", 4.0)) + 2.0})
			continue
		var t := str(mn.get("tipo", ""))
		var d := Vector2(float(mn.x) - hp.x, float(mn.z) - hp.z).length()
		if not perto.has(t) or d < float(perto[t][0]):
			perto[t] = [d, mn]
	for t in ["pedra", "cobre", "ferro", "cristal"]:
		if perto.has(t):
			var mn: Dictionary = perto[t][1]
			l.append({"id": str(mn.id), "tipo": "mina", "mn": mn, "nome": "%s mais perto (%d m)" % [str(mn.nome), int(perto[t][0])], "curto": str(mn.nome), "x": float(mn.x), "z": float(mn.z), "r": float(mn.r) + 2.0})
	return l

# encostou num totem de teleporte (conversa.gd): o mapa abre mostrando todos os totens
func abrir_totem(de: Dictionary) -> void:
	var t0 := Time.get_ticks_usec()
	abrir()
	totem_de = de
	totem_alvo = ""
	_ver_totens()
	if m.lentidao:
		m.lentidao.menu_aberto("totem", t0, 0)

# zoom e meio que mostram todos os totens na janela
func _ver_totens() -> void:
	_arrumar_grande()
	var r := Rect2()
	var primeiro := true
	for t in m.totem.T.lista:
		var p := Vector2(float(t.x), float(t.z))
		if primeiro:
			r = Rect2(p, Vector2.ZERO)
			primeiro = false
		else:
			r = r.expand(p)
	r = r.grow(90.0)
	var k: float = minf((janela.size.x - 60.0) / r.size.x, (janela.size.y - 150.0) / r.size.y) # folga para o título e o zoom
	zoom = clamp(k * float(info.tam) / janela.size.y, _z_min(), Z_MAX)
	zoom_alvo = zoom
	foco = _prender(r.get_center(), zoom)
	foco_alvo = foco
	_arrumar_grande()

func _toque_totem(lp: Vector2, dentro: bool) -> void:
	if not dentro:
		fechar() # tocou fora da janela (mapa pequeno): volta para o jogo
		return
	if botao_tam.has_point(lp):
		cheio = not cheio
		_ver_totens()
		if m.sons:
			m.sons.tocar("pano", -14.0)
		return
	if totem_alvo != "" and botao_tp.has_point(lp):
		_teleportar()
		return
	# o totem mais perto do toque (até 30 px); só os liberados respondem
	var melhor := ""
	var menor := 30.0
	for t in m.totem.T.lista:
		var d: float = _na_janela(float(t.x), float(t.z)).distance_to(lp)
		if d < menor:
			menor = d
			melhor = str(t.id)
	if melhor == "" or melhor == str(totem_de.id) or not m.totem.descoberto(melhor):
		totem_alvo = "" # vazio, o próprio totem ou um ainda trancado: nada a fazer
		return
	if melhor == totem_alvo:
		_teleportar() # o mesmo totem de novo já viaja
		return
	totem_alvo = melhor
	if m.sons:
		m.sons.tocar("pano", -14.0)

# guia das missões (guia.gd, André 2026-11-12): onde está, na tela, o totem de destino da etapa (k vazio = qualquer
# outro já visitado); se ele já foi escolhido, o botão "Teleportar". Rect2() = não aparece agora.
func guia_totem(k: String) -> Rect2:
	if not aberto or totem_de.is_empty() or janela == null:
		return Rect2()
	var xf: Transform2D = janela.get_global_transform_with_canvas()
	if totem_alvo != "" and (k == "" or totem_alvo == k) and botao_tp.has_area():
		return Rect2(xf * botao_tp.position, botao_tp.size * xf.get_scale())
	for t in m.totem.T.lista:
		var id := str(t.id)
		if id == str(totem_de.id) or not m.totem.descoberto(id) or (k != "" and id != k):
			continue
		var p: Vector2 = _na_janela(float(t.x), float(t.z))
		if not Rect2(Vector2.ZERO, janela.size).has_point(p):
			continue
		return Rect2(xf * (p - Vector2(20, 20)), Vector2(40, 40) * xf.get_scale())
	return Rect2()

func _teleportar() -> void:
	var para: Dictionary = m.totem.dados(totem_alvo)
	if para.is_empty():
		return
	var r: String = m.totem.ir(totem_de, para)
	if r != "":
		m.hud.aviso(r) # sem ouro: o mapa fica aberto
		return
	fechar()

func abrir() -> void:
	var t0 := Time.get_ticks_usec()
	_abrir()
	if m.lentidao: # quanto o mapa levou para abrir (lentidao.gd, tipo "menu")
		m.lentidao.menu_aberto("mapa", t0, 0)

func _abrir() -> void:
	aberto = true
	marcado = null
	selecionado = ""
	_npc_ir = ""
	_cache_t = -1.0 # distâncias e "mais perto" de novo a partir de onde o herói está
	previa = PackedVector2Array()
	toques = {}
	ignorar = {}
	pinca = {}
	layer = 14 # o mapa aberto cobre a HUD e o menu do topo (abaixo da conversa com NPC e do menu do personagem)
	grande.visible = true
	m.hud.bloqueado = true
	m.hud.soltar_tudo()
	_arrumar_grande()
	# já abre maior, com o herói no meio
	zoom = Z_ABRIR
	zoom_alvo = Z_ABRIR
	foco = _prender(Vector2(m.heroi.position.x, m.heroi.position.z), zoom)
	foco_alvo = foco
	if m.sons:
		m.sons.tocar("pano", -8.0) # papel do mapa abrindo

func fechar() -> void:
	aberto = false
	totem_de = {}
	totem_alvo = ""
	escuro.color.a = 0.82
	layer = 3
	grande.visible = false
	m.hud.bloqueado = false
	toques = {}

func _arrumar_grande() -> void:
	var tela: Vector2 = grande.size
	janela.position = Vector2(16, 16)
	janela.size = Vector2(max(200.0, tela.x - LARGURA_LISTA - 24.0), max(200.0, tela.y - 32.0))
	if not totem_de.is_empty(): # mapa do totem: sem a lista; cheio ocupa a tela, pequeno fica no meio e o jogo aparece em volta
		janela.size = Vector2(max(200.0, tela.x - 32.0), max(200.0, tela.y - 32.0)) if cheio else Vector2(max(200.0, tela.x * 0.6), max(200.0, tela.y * 0.72))
		janela.position = (tela - janela.size) * 0.5
		escuro.color.a = 0.82 if cheio else 0.35
	var k: float = _k()
	mapa_grande.position = _na_janela(mundo_r.position.x, mundo_r.position.y)
	mapa_grande.size = mundo_r.size * k
	if mapa_hoje != null:
		mapa_hoje.position = _na_janela(float(info.x0), float(info.z0))
		mapa_hoje.size = Vector2.ONE * float(info.tam) * k

func _process(_dt: float) -> void:
	if m.heroi == null:
		return
	# some junto com a HUD (menu do personagem, criador, conversa com NPC)
	mini.visible = m.hud.visible and not m.hud.bloqueado or aberto
	if mini.visible:
		var p: Vector3 = m.heroi.position
		(mapa_mini.material as ShaderMaterial).set_shader_parameter("centro", _uv(p.x, p.z))
		(mapa_mini.material as ShaderMaterial).set_shader_parameter("alcance", Vector2.ONE * ALCANCE * 2.0 / mundo_r.size)
		if Engine.get_process_frames() % 3 == 0: # FPS (auditoria 2026-11-11): marcas do minimapa 20 vezes por segundo
			marcas.queue_redraw()
	if aberto:
		var dt: float = get_process_delta_time()
		var a: float = 1.0 - exp(-12.0 * dt) # zoom dos botões e ida até o lugar da lista, suave
		if abs(zoom - zoom_alvo) > 0.001:
			zoom = lerp(zoom, zoom_alvo, a)
		foco_alvo = _prender(foco_alvo, zoom_alvo)
		foco = _prender(foco.lerp(foco_alvo, a), zoom)
		_arrumar_grande()
		marcas_mapa.queue_redraw()
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
	if cc.has("boss"): # boss de mundo (André 2026-11-11): escudo vermelho com borda de ouro; caído, cinza com a hora de voltar
		_marca_boss(c, pos, cc, r + 2.0, com_nivel)
		return
	var cor: Color = COR_BICHO.get(str(cc.get("bicho", "")), Color.WHITE)
	c.draw_circle(pos, r + 2.0, Color(0.05, 0.04, 0.03, 0.85))
	c.draw_circle(pos, r, cor)
	c.draw_circle(pos + Vector2(-r, -r) * 0.32, r * 0.28, Color(1, 1, 1, 0.3))
	if com_nivel:
		_texto(c, pos + Vector2(0, 0), str(int(cc.get("nivel", 1))), int(r * 1.3), Color(0.1, 0.07, 0.04), true, 0)

func _marca_boss(c: Control, pos: Vector2, cc: Dictionary, r: float, com_texto: bool) -> void:
	var id := str(cc.boss)
	var vivo: bool = m.boss_mundo.vivo(id)
	var fundo := Color("b4141e") if vivo else Color(0.42, 0.4, 0.4)
	var escudo := PackedVector2Array([pos + Vector2(-r, -r * 0.85), pos + Vector2(r, -r * 0.85), pos + Vector2(r * 0.9, r * 0.2), pos + Vector2(0, r * 1.15), pos + Vector2(-r * 0.9, r * 0.2)])
	var borda := PackedVector2Array()
	for q in escudo:
		borda.append(pos + (q - pos) * 1.22)
	c.draw_colored_polygon(borda, COR_OURO if vivo else Color(0.2, 0.19, 0.18))
	c.draw_colored_polygon(escudo, fundo)
	# duas espadas cruzadas
	var a := r * 0.62
	for sgn in [-1.0, 1.0]:
		c.draw_line(pos + Vector2(-a * sgn, -a * 0.8), pos + Vector2(a * sgn, a * 0.75), Color(1, 0.95, 0.85), max(1.5, r * 0.18))
		c.draw_line(pos + Vector2(a * 0.55 * sgn, a * 0.35), pos + Vector2(a * 0.95 * sgn, a * 0.05), Color(1, 0.95, 0.85), max(1.5, r * 0.16))
	if com_texto and not vivo:
		_texto(c, pos + Vector2(0, r * 1.9), m.boss_mundo.volta_texto(id), int(max(11.0, r * 1.15)), Color(0.92, 0.9, 0.86), true, 2)

func _desenhar_mini() -> void:
	var c := marcas
	var tam: Vector2 = c.size
	var meio := tam * 0.5
	var p: Vector3 = m.heroi.position
	var k: float = RAIO / ALCANCE # px por metro
	_nevoa_mini(c, meio, p, k) # zonas ainda fechadas pela névoa (progressão, André 2026-11-10)
	# clareiras, veio de cobre e outros jogadores que estão dentro do círculo
	for cc in m.mundo.get("caca", []):
		var q: Vector2 = meio + Vector2(float(cc.x) - p.x, float(cc.z) - p.z) * k
		if q.distance_to(meio) < RAIO - 10.0:
			_marca_clareira(c, q, cc, 8.0, true)
	for mn in m.mundo.get("mina", []):
		var q: Vector2 = meio + Vector2(float(mn.x) - p.x, float(mn.z) - p.z) * k
		if q.distance_to(meio) < RAIO - 8.0:
			c.draw_colored_polygon(PackedVector2Array([q + Vector2(0, -6), q + Vector2(5, 0), q + Vector2(0, 6), q + Vector2(-5, 0)]), COR_MINA.get(str(mn.get("tipo", "")), Color("d9822b")))
	if m.totem:
		for t in m.totem.T.lista:
			var q: Vector2 = meio + Vector2(float(t.x) - p.x, float(t.z) - p.z) * k
			if q.distance_to(meio) < RAIO - 8.0:
				_marca_totem(c, q, 6.0, m.totem.descoberto(str(t.id)))
	for o in _outros():
		var q: Vector2 = meio + Vector2(o.x - p.x, o.z - p.z) * k
		if q.distance_to(meio) < RAIO - 4.0:
			c.draw_circle(q, 4.0, Color(0.05, 0.05, 0.1, 0.8))
			c.draw_circle(q, 3.0, Color("6fb6ff"))
	icones.desenhar_mini(c, meio, p, k, RAIO) # NPCs: o símbolo da função (ferreiro, alquimista, mercador de pack...)
	var casa := _minha_casa()
	if not casa.is_empty(): # o meu terreno: a casinha, na beirada quando está longe (aponta o caminho de casa)
		var dc: Vector2 = Vector2(casa.x - p.x, casa.z - p.z) * k
		if dc.length() > RAIO - 11.0:
			dc = dc.normalized() * (RAIO - 11.0)
		_marca_casa(c, meio + dc, 6.0)
	if m.pesca and m.pesca.radar_ligado(): # Radar de pesca (pesca.gd): os spots que cabem no minimapa
		for id in m.pesca.spots:
			var v: Dictionary = m.pesca.spots[id]
			var qs: Vector2 = meio + Vector2(v.x - p.x, v.z - p.z) * k
			if qs.distance_to(meio) < RAIO - 5.0:
				_marca_spot(c, qs, 4.5, m.pesca.cor_spot(v.tipo))
	for o in _time(): # amigos do time (amigos.gd): verde, na beirada quando estão longe
		var dq: Vector2 = Vector2(o.x - p.x, o.z - p.z) * k
		if dq.length() > RAIO - 6.0:
			dq = dq.normalized() * (RAIO - 6.0)
		c.draw_circle(meio + dq, 5.0, Color(0.03, 0.08, 0.03, 0.9))
		c.draw_circle(meio + dq, 4.0, m.amigos.COR_TIME)
	for ce in _amigas(): # Cecília e Dario: coração rosa, na beirada quando está longe (só quem conversa com eles vê)
		var dq: Vector2 = Vector2(ce.x - p.x, ce.z - p.z) * k
		if dq.length() > RAIO - 7.0:
			dq = dq.normalized() * (RAIO - 7.0)
		_coracao(c, meio + dq, 5.5)
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
	_relogio(c, meio + Vector2(0, RAIO + 2.0))
	# a missão da vez saiu daqui (André 2026-11-11): fica à esquerda, embaixo do time, com "Ir para" (missao_ativa.gd)

# ---------- progressão (André 2026-11-10, nevoa.gd) ----------
const COR_NEVOA := Color(0.78, 0.74, 0.92, 0.55)
# a missão principal da vez, embaixo do relógio (alinhada pela direita do minimapa): nome, quanto falta e com quem falar.
# Desde 2026-11-11 não é mais chamada: a missão fica à esquerda, embaixo do time (missao_ativa.gd); fica de reserva.
func _missao(c: Control, dir: Vector2) -> void:
	if m.nevoa == null:
		return
	var M: Dictionary = m.nevoa.missao_atual()
	if M.is_empty():
		return
	var h: Dictionary = m.nevoa.hist()
	var quem: String = _nome_npc(str(M.npc))
	var l1 := "Missão: %s" % M.nome
	var l2: String
	if int(m.P.prog.nivel) < int(M.nv):
		l2 = "Libera no Nv %d (%s)" % [int(M.nv), quem]
	elif not h.get("ac", false):
		l2 = "Fale com %s" % quem
	elif int(h.get("n", 0)) >= int(M.total):
		l2 = "Pronto! Volte e fale com %s" % quem
	else:
		l2 = "%d/%d · %s" % [int(h.get("n", 0)), int(M.total), quem]
	var w: float = maxf(fonte.get_string_size(l1, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x, fonte.get_string_size(l2, HORIZONTAL_ALIGNMENT_LEFT, -1, 12).x) + 18.0
	var r := Rect2(dir - Vector2(w, 0), Vector2(w, 38))
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.05, 0.04, 0.85)
	sb.border_color = Color(0.72, 0.62, 0.95, 0.9)
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(10)
	sb.draw(c.get_canvas_item(), r)
	_texto(c, r.position + Vector2(9, 12), l1, 13, Color("e6dcff"), false, 3)
	_texto(c, r.position + Vector2(9, 28), l2, 12, Color(1, 0.95, 0.85) if l2.begins_with("Pronto") else Color(0.85, 0.82, 0.78), false, 3)

func _nome_npc(id: String) -> String:
	for n in m.mundo.get("npcs", []):
		if str(n.get("id", "")) == id:
			return str(n.get("nome", id)).split(",")[0]
	return id

# a névoa no minimapa: as regiões fechadas (André 2026-11-11), cortadas no círculo do minimapa
func _nevoa_mini(c: Control, meio: Vector2, p: Vector3, k: float) -> void:
	if m.nevoa == null:
		return
	var borda := _circulo(meio, RAIO - 2.0, 48)
	var r_mundo := RAIO / k # o que cabe no minimapa, em metros
	var vista := Rect2(p.x - r_mundo, p.z - r_mundo, r_mundo * 2.0, r_mundo * 2.0)
	var tr := Transform2D(0.0, Vector2(k, k), 0.0, meio - Vector2(p.x, p.z) * k) # mundo -> tela, sem conta ponto a ponto
	for Z in m.nevoa.H.get("zonas", []):
		var id := str(Z.id)
		if Z.get("selo", false) or m.nevoa.liberado(id):
			continue
		var pol: PackedVector2Array = m.nevoa._pol(Z)
		if pol.size() < 3 or not m.nevoa._caixas[id].intersects(vista): # região longe: nem entra na conta (FPS)
			continue
		for pc in Geometry2D.intersect_polygons(tr * pol, borda):
			c.draw_colored_polygon(pc, COR_NEVOA)

func _circulo(q: Vector2, r: float, n: int) -> PackedVector2Array:
	var pol := PackedVector2Array()
	for i in n:
		pol.append(q + Vector2(cos(TAU * i / n), sin(TAU * i / n)) * r)
	return pol

# a borda da região em pixels (em = função (x, z) -> tela)
func _contorno(Z: Dictionary, em: Callable) -> PackedVector2Array:
	var pol := PackedVector2Array()
	for q in Z.get("poligono", []):
		pol.append(em.call(float(q[0]), float(q[1])))
	return pol

# a névoa no mapa aberto: mancha lilás sobre cada região fechada, com o nome e o nível da missão que abre
func _nevoa_mapa(c: Control, em: Callable) -> void:
	if m.nevoa == null:
		return
	var tela := PackedVector2Array([Vector2(-50, -50), Vector2(janela.size.x + 50, -50), janela.size + Vector2(50, 50), Vector2(-50, janela.size.y + 50)])
	for Z in m.nevoa.H.get("zonas", []):
		var id := str(Z.id)
		if Z.get("selo", false) or m.nevoa.liberado(id):
			continue
		var M: Dictionary = m.nevoa.H.missoes[int(m.nevoa.quem_libera[id])]
		var soma := Vector2.ZERO
		var n := 0
		for pc in Geometry2D.intersect_polygons(_contorno(Z, em), tela):
			c.draw_colored_polygon(pc, COR_NEVOA)
			for q in pc:
				soma += q
				n += 1
		if n == 0:
			continue
		var centro := soma / n # o meio do pedaço que aparece na tela
		_texto(c, centro, "Névoa: %s" % Z.nome, 14, Color("e6dcff"))
		_texto(c, centro + Vector2(0, 16), "Missão Nv %d (%s)" % [int(M.nv), str(M.get("npcNome", M.npc))], 12, Color(0.85, 0.82, 0.78))

# hora do jogo (dia e noite do Quimera, André 2026-11-07): plaquinha na borda de baixo do minimapa com o sol ou a lua
func _relogio(c: Control, pos: Vector2) -> void:
	if m.get("dia") == null or m.dia.env == null:
		return
	var t: String = m.dia.texto_hora()
	var noite: bool = m.dia.eh_noite()
	var w: float = fonte.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x + 30.0
	var r := Rect2(pos - Vector2(w * 0.5, 10), Vector2(w, 20))
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.05, 0.04, 0.9)
	sb.border_color = Color("c9a35a")
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(10)
	c.draw_style_box(sb, r)
	var ic := r.position + Vector2(12, 10)
	if noite: # lua crescente: um círculo claro com outro escuro por cima
		c.draw_circle(ic, 5.5, Color("dfe6ff"))
		c.draw_circle(ic + Vector2(2.6, -1.6), 4.6, Color(0.06, 0.05, 0.04))
	else: # sol: miolo e 8 raios
		for i in 8:
			var a := TAU * i / 8.0
			c.draw_line(ic + Vector2(cos(a), sin(a)) * 4.6, ic + Vector2(cos(a), sin(a)) * 6.6, Color("ffc94a"), 1.6, true)
		c.draw_circle(ic, 3.4, Color("ffd76a"))
	_texto(c, Vector2(r.position.x + 22.0, pos.y - 1.0), t, 13, Color(1, 0.94, 0.8) if not noite else Color(0.85, 0.89, 1.0), false, 0)

# os amigos virtuais (shared/amiga.js: Cecília e Dario, André 2026-11-11): onde cada um está ([{x, z, nome}]) para quem conversa com eles
const COR_AMIGA := Color("ff6fae")
func _amigas() -> Array:
	var r := []
	if not (m.online and m.online.get("ligado")):
		return r
	for aid in m.online.get("amiga_ids") if m.online.get("amiga_ids") is Array else []:
		var a := _amiga(str(aid))
		if not a.is_empty():
			r.append(a)
	return r

func _amiga(id: String) -> Dictionary:
	var o = m.online.outros.get(id)
	if o is Dictionary and o.has("no") and is_instance_valid(o.no):
		return {"x": o.no.position.x, "z": o.no.position.z, "nome": str(o.get("nome", id.capitalize()))}
	var lista = m.online.get("no_mapa")
	if lista is Array:
		for q in lista:
			if q is Array and q.size() >= 3 and str(q[0]) == id:
				return {"x": float(q[1]), "z": float(q[2]), "nome": "Cecília" if id == "cecilia" else id.capitalize()}
	return {}

# coraçãozinho rosa com borda escura
func _coracao(c: Control, q: Vector2, r: float) -> void:
	var pts := PackedVector2Array()
	for i in 24:
		var t := TAU * i / 24.0
		pts.append(q + Vector2(16.0 * pow(sin(t), 3), -(13.0 * cos(t) - 5.0 * cos(2.0 * t) - 2.0 * cos(3.0 * t) - cos(4.0 * t))) * (r / 16.0))
	var borda := PackedVector2Array()
	for v in pts:
		borda.append(q + (v - q) * 1.3)
	c.draw_colored_polygon(borda, Color(0.08, 0.02, 0.05, 0.9))
	c.draw_colored_polygon(pts, COR_AMIGA)

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

# mapa completo (dentro da janela recortada): nomes, jogadores, rota, herói, pino, X e os botões − e +
func _desenhar_mapa() -> void:
	var c := marcas_mapa
	var tam: Vector2 = janela.size
	var em := func(x: float, z: float) -> Vector2: return _na_janela(x, z)
	var longe: bool = zoom < 0.95 # FASE 3: afastado além do quadrado de hoje, só as bolinhas (os nomes se embolam)
	var tm: bool = not totem_de.is_empty() # mapa do totem: os nomes que importam são os dos totens (os outros embolam)
	longe = longe or tm
	_nevoa_mapa(c, em) # zonas ainda fechadas pela névoa (progressão, André 2026-11-10)
	# lugares
	if not tm:
		_texto(c, em.call(-6.0, -30.0), "Vila da Clareira", 17, Color(1, 0.95, 0.85))
	var vl: Dictionary = m.mundo.get("vilaLotes", {})
	if not vl.is_empty() and not tm: # Vila dos Lotes (construção e fazenda)
		_texto(c, em.call(float(vl.x), float(vl.z) - 20.0), str(vl.nome), 15, Color(1, 0.95, 0.85))
	# FASE 3: o nome de cada terra (Vael, ilha, Aurora) e as vilas, cais e postos do mundo grande
	var g: Dictionary = m.terreno.mundo_g if m.terreno != null else {}
	for t in (g.get("terras", []) if not tm else []):
		var nv: Array = t.get("niveis", [])
		# os continentes (forma norte/sul, desde 2026-11-09) não têm x e z: o nome vai no meio, perto da costa (sem isto o
		# desenho do mapa parava aqui e o resto, vilas, veios, casa e totens, não aparecia)
		var tx: float = float(t.x) if t.has("x") else float(g.x0) + float(g.nx) * float(g.passo) * 0.5
		var tz: float = float(t.z) - float(t.rz) * 0.97 if t.has("z") else (float(t.costa) - 560.0 if str(t.get("forma", "")) == "norte" else float(t.costa) + 60.0)
		_texto(c, em.call(tx, tz), "%s%s" % [str(t.nome), "  (Nv %d-%d)" % [int(nv[0]), int(nv[1])] if nv.size() == 2 else ""], 18, Color("f4e6c4"))
	for l in g.get("lugares", []):
		var tl := str(l.get("tipo", ""))
		if tl == "vila" or tl == "porto" or tl == "posto":
			var q: Vector2 = em.call(float(l.x), float(l.z))
			c.draw_circle(q, 4.0, Color(0.05, 0.04, 0.03, 0.85))
			c.draw_circle(q, 3.0, COR_OURO if tl == "vila" else Color(1, 0.95, 0.85))
			if (tl == "vila" or not longe) and not tm:
				_texto(c, q + Vector2(0, -12), str(l.get("nome", "")), 15 if tl == "vila" else 12, Color(1, 0.95, 0.85))
	if m.totem and totem_de.is_empty(): # totens de teleporte: losango azul (apagado = ainda não visitado)
		for t in m.totem.T.lista:
			var qt: Vector2 = em.call(float(t.x), float(t.z))
			var dt: bool = m.totem.descoberto(str(t.id))
			_marca_totem(c, qt, 8.0, dt)
			if not longe:
				_texto(c, qt + Vector2(0, 17), "Totem", 12, Color("9fe6ff") if dt else Color(0.75, 0.8, 0.85))
	for mn in m.mundo.get("mina", []):
		if longe and (mn.get("pequeno", false) or mn.get("mundo", false)):
			continue
		var q: Vector2 = em.call(float(mn.x), float(mn.z))
		var cm: Color = COR_MINA.get(str(mn.get("tipo", "")), Color("d9822b"))
		c.draw_colored_polygon(PackedVector2Array([q + Vector2(0, -7), q + Vector2(6, 0), q + Vector2(0, 7), q + Vector2(-6, 0)]), cm)
		if mn.get("pequeno", false) or mn.get("mundo", false) or tm:
			continue # veio pequeno (FASE 2): só o losango, sem nome (são muitos); no mapa do totem, nenhum nome
		_texto(c, q + Vector2(0, -16), str(mn.get("nome", "Veio")), 13, Color("f2b56b") if str(mn.get("tipo", "cobre")) == "cobre" else cm.lightened(0.35))
	var cv := _caverna()
	if not cv.is_empty():
		var qc: Vector2 = em.call(cv.x, cv.z)
		_marca_caverna(c, qc, 10.0)
		if not tm:
			_texto(c, qc + Vector2(0, 22), str(cv.nome), 14, Color("ffc27a"))
	if m.pesca and m.pesca.radar_ligado(): # Radar de pesca: todos os spots com o tipo embaixo
		for id in m.pesca.spots:
			var v: Dictionary = m.pesca.spots[id]
			var qs: Vector2 = em.call(v.x, v.z)
			_marca_spot(c, qs, 7.0, m.pesca.cor_spot(v.tipo))
			_texto(c, qs + Vector2(0, 18), str(m.P.dados.pesca.spots[v.tipo].nome), 12, m.pesca.cor_spot(v.tipo).lightened(0.3))
	var casa := _minha_casa()
	if not casa.is_empty(): # o meu terreno: contorno tracejado dourado e a casinha no meio, com o nome
		var cantos := [em.call(casa.x0, casa.z0), em.call(casa.x1, casa.z0), em.call(casa.x1, casa.z1), em.call(casa.x0, casa.z1)]
		for i in 4:
			c.draw_dashed_line(cantos[i], cantos[(i + 1) % 4], Color(COR_OURO, 0.8), 1.5, 4.0, true)
		var qa: Vector2 = em.call(casa.x, casa.z)
		_marca_casa(c, qa, 11.0)
		var baixo: float = maxf(cantos[2].y, cantos[0].y) # o nome fica embaixo do contorno
		if not tm:
			_texto(c, Vector2(qa.x, maxf(qa.y + 24.0, baixo + 12.0)), "Sua casa", 15, Color("ffb39a"))
	for cc in m.mundo.get("caca", []):
		var q: Vector2 = em.call(float(cc.x), float(cc.z))
		_marca_clareira(c, q, cc, 7.0 if longe else 10.0, true)
		if not longe:
			_texto(c, q + Vector2(0, 22), "%s  Nv %d" % [NOME_BICHO.get(str(cc.get("bicho", "")), "Monstros"), int(cc.get("nivel", 1))], 14, Color(1, 0.96, 0.88))
	if not tm:
		icones.desenhar_mapa(c, em, _k(), longe, fonte, tam) # NPCs: o símbolo da função e, de perto, nome e título
	for p in _outros():
		var q: Vector2 = em.call(p.x, p.z)
		c.draw_circle(q, 5.0, Color(0.05, 0.05, 0.1, 0.8))
		c.draw_circle(q, 4.0, Color("6fb6ff"))
	for p in _time():
		var q: Vector2 = em.call(p.x, p.z)
		c.draw_circle(q, 6.0, Color(0.03, 0.08, 0.03, 0.9))
		c.draw_circle(q, 5.0, m.amigos.COR_TIME)
		_texto(c, q + Vector2(0, -12), p.nome, 13, m.amigos.COR_TIME.lightened(0.3))
	for ce in _amigas():
		var q: Vector2 = em.call(ce.x, ce.z)
		_coracao(c, q, 7.0)
		_texto(c, q + Vector2(0, -14), ce.nome, 13, COR_AMIGA.lightened(0.3))
	# rota pela estrada: a que está sendo andada e a do lugar marcado agora
	if m.rota and m.rota.ativo and marcado == null:
		_rota_grande(c, m.rota.caminho, m.rota.i, em)
	if marcado != null:
		_rota_grande(c, previa, 0, em)
	var hp: Vector3 = m.heroi.position
	var qh: Vector2 = em.call(hp.x, hp.z)
	c.draw_circle(qh, 13.0, Color(1, 0.85, 0.4, 0.18))
	_seta(c, qh, _frente_heroi(), 11.0, COR_OURO)
	if not totem_de.is_empty():
		_desenhar_totens(c, tam, em)
		return
	icones.legenda(c, self, fonte, tam) # legenda dos símbolos no canto de baixo à esquerda (André 2026-11-12)
	# moldura dourada da janela
	c.draw_rect(Rect2(Vector2(1, 1), tam - Vector2(2, 2)), Color(0.05, 0.04, 0.03, 0.9), false, 3.0)
	c.draw_rect(Rect2(Vector2(3, 3), tam - Vector2(6, 6)), Color("c9a35a"), false, 1.5)
	# X de fechar no canto do mapa
	var cx := Vector2(tam.x - 26.0, 26.0)
	botao_x = Rect2(cx - Vector2(22, 22), Vector2(44, 44))
	c.draw_circle(cx, 15.0, Color(0.05, 0.04, 0.03, 0.85))
	c.draw_arc(cx, 15.0, 0, TAU, 32, Color("c9a35a"), 1.5, true)
	c.draw_line(cx + Vector2(-6, -6), cx + Vector2(6, 6), Color(1, 0.95, 0.85), 2.5, true)
	c.draw_line(cx + Vector2(6, -6), cx + Vector2(-6, 6), Color(1, 0.95, 0.85), 2.5, true)
	# zoom: − e + embaixo, no meio da janela (André 2026-11-05); a pinça continua valendo
	var cz := Vector2(tam.x * 0.5, tam.y - 34.0)
	var barra := Rect2(cz - Vector2(62, 22), Vector2(124, 44))
	var sbz := StyleBoxFlat.new()
	sbz.bg_color = Color(0.08, 0.06, 0.04, 0.88)
	sbz.border_color = Color("c9a35a")
	sbz.set_border_width_all(2)
	sbz.set_corner_radius_all(22)
	sbz.shadow_color = Color(0, 0, 0, 0.4)
	sbz.shadow_size = 5
	sbz.draw(c.get_canvas_item(), barra)
	c.draw_line(cz + Vector2(0, -13), cz + Vector2(0, 13), Color("c9a35a", 0.55), 1.5, true)
	var cm := cz + Vector2(-31, 0)
	var cp := cz + Vector2(31, 0)
	botao_menos = Rect2(cm - Vector2(30, 26), Vector2(60, 52))
	botao_mais = Rect2(cp - Vector2(30, 26), Vector2(60, 52))
	var cor_m: Color = Color(1, 0.95, 0.85, 0.35 if zoom_alvo <= _z_min() + 0.01 else 1.0)
	var cor_p: Color = Color(1, 0.95, 0.85, 0.35 if zoom_alvo >= Z_MAX - 0.01 else 1.0)
	c.draw_line(cm + Vector2(-9, 0), cm + Vector2(9, 0), cor_m, 3.0, true)
	c.draw_line(cp + Vector2(-9, 0), cp + Vector2(9, 0), cor_p, 3.0, true)
	c.draw_line(cp + Vector2(0, -9), cp + Vector2(0, 9), cor_p, 3.0, true)
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
		var bt := _lugar_do_botao(qm, Vector2(w, 54.0), em, Rect2(Vector2.ZERO, tam))
		botao_ir = bt.grow(8.0) # dedo: área de toque um pouco maior que o desenho
		var borda: Vector2 = Vector2(clamp(qm.x, bt.position.x, bt.end.x), clamp(qm.y, bt.position.y, bt.end.y))
		c.draw_line(qm + (borda - qm).normalized() * 6.0, borda, Color(0.05, 0.04, 0.03, 0.6), 3.0, true)
		c.draw_line(qm + (borda - qm).normalized() * 6.0, borda, COR_OURO, 1.2, true)
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(0.12, 0.09, 0.05, 0.94)
		sb.border_color = COR_OURO
		sb.set_border_width_all(2)
		sb.set_corner_radius_all(16)
		sb.shadow_color = Color(0, 0, 0, 0.45)
		sb.shadow_size = 6
		sb.draw(c.get_canvas_item(), bt)
		_texto(c, bt.position + Vector2(w * 0.5, 19.0), t1, 20, COR_OURO, true, 4)
		_texto(c, bt.position + Vector2(w * 0.5, 39.0), t2, 13, Color(1, 0.96, 0.88, 0.85), true, 3)

# lista da direita (Lugares): cada nome é um botão; o escolhido fica dourado com "Ir para ›"
func _desenhar_grande() -> void:
	var c := marcas_grande
	if not totem_de.is_empty(): # mapa do totem: sem a lista
		return
	var pp: Rect2 = _painel()
	var base: Vector2 = pp.position - grande.get_global_rect().position
	var x0: float = base.x + 14.0
	var larg: float = LARGURA_LISTA - 26.0
	var sbp := StyleBoxFlat.new() # fundo da lista
	sbp.bg_color = Color(0.07, 0.055, 0.035, 0.9)
	sbp.border_color = Color("c9a35a", 0.7)
	sbp.set_border_width_all(1)
	sbp.set_corner_radius_all(14)
	sbp.draw(c.get_canvas_item(), Rect2(base + Vector2(4, 16), Vector2(LARGURA_LISTA - 16.0, pp.size.y - 32.0)))
	rolar = clamp(rolar, 0.0, max(0.0, lista_alt - pp.size.y)) # fechou uma seção lá embaixo: a lista sobe junto
	var y: float = base.y + 40.0 - rolar
	_texto(c, Vector2(x0, y), "Lugares", 24, COR_OURO, false)
	y += 30.0
	linhas = []
	var fim: float = base.y + pp.size.y - 18.0
	var por_secao := {}
	for l in _lugares():
		var sid := str(l.get("sec", "vilas"))
		if not por_secao.has(sid):
			por_secao[sid] = []
		por_secao[sid].append(l)
	var dentro := func(r: Rect2) -> bool: return r.position.y > base.y + 16.0 and r.end.y < fim # o que passa da caixa (lista rolada) não aparece
	var tira: Vector2 = pp.position - grande.get_global_rect().position # do desenho para o toque (relativo ao painel)
	for sc in SECOES:
		var sid: String = sc[0]
		var itens: Array = por_secao.get(sid, [])
		if itens.is_empty():
			continue
		var aberta: bool = abertas.get(sid, false)
		# título da seção: faixa escura com a setinha (▸ fechada, ▾ aberta), o nome e quantos lugares tem
		var cab := Rect2(Vector2(x0 - 6.0, y - 14.0), Vector2(larg, 29.0))
		if dentro.call(cab):
			var sb := StyleBoxFlat.new()
			sb.bg_color = Color(0.2, 0.15, 0.07, 0.95) if aberta else Color(0.13, 0.1, 0.06, 0.92)
			sb.border_color = Color("c9a35a", 0.75 if aberta else 0.4)
			sb.set_border_width_all(1)
			sb.set_corner_radius_all(9)
			sb.draw(c.get_canvas_item(), cab)
			var q := Vector2(x0 + 7.0, y)
			if aberta:
				c.draw_colored_polygon(PackedVector2Array([q + Vector2(-5, -3), q + Vector2(5, -3), q + Vector2(0, 4)]), COR_OURO)
			else:
				c.draw_colored_polygon(PackedVector2Array([q + Vector2(-3, -5), q + Vector2(4, 0), q + Vector2(-3, 5)]), COR_OURO)
			_texto(c, Vector2(x0 + 20.0, y), str(sc[1]), 17, COR_OURO, false)
			var nt := str(itens.size())
			var lw: float = fonte.get_string_size(nt, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
			var pill := Rect2(Vector2(cab.end.x - lw - 22.0, y - 9.0), Vector2(lw + 14.0, 18.0))
			var sp := StyleBoxFlat.new()
			sp.bg_color = Color(0.0, 0.0, 0.0, 0.35)
			sp.set_corner_radius_all(9)
			sp.draw(c.get_canvas_item(), pill)
			_texto(c, Vector2(pill.position.x + 7.0, y), nt, 13, Color(1, 0.92, 0.75), false, 3)
			linhas.append([Rect2(cab.position - tira + Vector2(0, -1), cab.size + Vector2(0, 2)), {"secao": sid}])
		y += 33.0
		if not aberta:
			continue
		for l in itens:
			_linha_lugar(c, l, x0, y, larg, tira, dentro)
			y += 23.0
		y += 6.0
	y += 6.0
	if y > base.y + 16.0 and y < fim:
		c.draw_circle(Vector2(x0 + 9.0, y), 6.0, COR_BICHO.chefe)
		_texto(c, Vector2(x0 + 24.0, y), "1 Imp Chefe em cada clareira", 14, Color(1, 0.8, 0.75), false)
	y += 22.0
	if y > base.y + 16.0 and y < fim:
		_seta(c, Vector2(x0 + 9.0, y), Vector2(0, -1), 8.0, COR_OURO)
		_texto(c, Vector2(x0 + 24.0, y), "Você", 14, Color(1, 0.96, 0.88), false)
	y += 26.0
	for dica in ["Toque num título para abrir ou fechar", "Toque num nome ou no mapa para marcar", "Pinça ou − e + para o zoom"]:
		if y > base.y + 16.0 and y < fim:
			_texto(c, Vector2(x0, y), dica, 13, Color(1, 1, 1, 0.6), false)
		y += 19.0
	lista_alt = y + rolar - base.y

# uma linha da lista: o símbolo do tipo e o nome; o escolhido fica dourado com "Ir para ›"
func _linha_lugar(c: Control, l: Dictionary, x0: float, y: float, larg: float, tira: Vector2, dentro: Callable) -> void:
	var lin := Rect2(Vector2(x0 - 6.0, y - 11.0), Vector2(larg, 23.0))
	if dentro.call(lin):
		var esc: bool = str(l.id) == selecionado
		if esc:
			var sl := StyleBoxFlat.new()
			sl.bg_color = Color(0.32, 0.23, 0.09, 0.95)
			sl.border_color = COR_OURO
			sl.set_border_width_all(1)
			sl.set_corner_radius_all(7)
			sl.draw(c.get_canvas_item(), lin)
		var qi := Vector2(x0 + 9.0, y)
		match str(l.tipo):
			"caca":
				_marca_clareira(c, qi, l.cc, 8.0, false)
			"caverna":
				_marca_caverna(c, qi, 7.0)
			"mina":
				c.draw_colored_polygon(PackedVector2Array([qi + Vector2(0, -7), qi + Vector2(6, 0), qi + Vector2(0, 7), qi + Vector2(-6, 0)]), COR_MINA.get(str(l.mn.get("tipo", "")), Color("d9822b")))
			"casa": # o meu terreno: casinha de telhado vermelho
				_marca_casa(c, qi + Vector2(0, 1), 6.5)
			"totem":
				_marca_totem(c, qi, 6.0, m.totem.descoberto(str(l.id).trim_prefix("totem_")))
			"lago": # gota d'água azul
				c.draw_circle(qi + Vector2(0, 2), 5.0, Color("4fa3e0"))
				c.draw_colored_polygon(PackedVector2Array([qi + Vector2(-4.4, 0), qi + Vector2(0, -8), qi + Vector2(4.4, 0)]), Color("4fa3e0"))
			"npc": # pessoa: cabeça e ombros claros num círculo azul
				c.draw_circle(qi, 8.0, Color(0.05, 0.07, 0.1, 0.9))
				c.draw_circle(qi, 7.0, Color("4f86c6"))
				c.draw_circle(qi + Vector2(0, -2.2), 2.4, Color(1, 0.95, 0.88))
				c.draw_colored_polygon(PackedVector2Array([qi + Vector2(-4.2, 4.6), qi + Vector2(-3.2, 1.2), qi + Vector2(3.2, 1.2), qi + Vector2(4.2, 4.6)]), Color(1, 0.95, 0.88))
			"mercador": # caixote de madeira (o pack)
				c.draw_rect(Rect2(qi + Vector2(-7, -6), Vector2(14, 12)), Color(0.08, 0.05, 0.03, 0.95))
				c.draw_rect(Rect2(qi + Vector2(-6, -5), Vector2(12, 10)), Color("b07a3f"))
				c.draw_line(qi + Vector2(-6, -5), qi + Vector2(6, 5), Color("6e4520"), 1.5)
				c.draw_line(qi + Vector2(-6, 5), qi + Vector2(6, -5), Color("6e4520"), 1.5)
			"oficina": # bigorna cinza
				c.draw_colored_polygon(PackedVector2Array([qi + Vector2(-8, -4), qi + Vector2(6, -4), qi + Vector2(8, -1), qi + Vector2(3, -1), qi + Vector2(2, 2),
					qi + Vector2(5, 5), qi + Vector2(-5, 5), qi + Vector2(-2, 2), qi + Vector2(-3, -1), qi + Vector2(-6, -1)]), Color("a9b0b8"))
			_: # vila: casinha dourada
				c.draw_colored_polygon(PackedVector2Array([qi + Vector2(-7, -1), qi + Vector2(0, -8), qi + Vector2(7, -1)]), COR_OURO)
				c.draw_rect(Rect2(qi + Vector2(-5, -1), Vector2(10, 7)), COR_OURO)
		var nome: String = str(l.nome)
		if esc:
			_texto(c, Vector2(lin.end.x - 8.0 - fonte.get_string_size("Ir para ›", HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x, y), "Ir para ›", 14, COR_OURO, false, 3)
		var max_w: float = larg - 34.0 - (74.0 if esc else 0.0)
		while nome.length() > 4 and fonte.get_string_size(nome, HORIZONTAL_ALIGNMENT_LEFT, -1, 15).x > max_w:
			nome = nome.substr(0, nome.length() - 2) + "…"
		_texto(c, Vector2(x0 + 24.0, y), nome, 15, COR_OURO if esc else Color(1, 0.96, 0.88), false)
		linhas.append([Rect2(lin.position - tira + Vector2(0, -0.5), lin.size + Vector2(0, 1)), l])

# nome da clareira onde caiu o toque ("Puglins Nv 15"), ou ""
func _clareira_em(p: Vector2) -> String:
	for l in _lugares(): # o nome tocado na lista (vila, clareira ou veio)
		if str(l.id) == selecionado:
			return str(l.curto)
	for cc in m.mundo.get("caca", []):
		if p.distance_to(Vector2(float(cc.x), float(cc.z))) <= float(cc.get("r", 12.0)) + 2.0:
			return "%s Nv %d" % [NOME_BICHO.get(str(cc.get("bicho", "")), "Monstros"), int(cc.get("nivel", 1))]
	return ""

# onde o botão "Ir para" fica: abaixo, à direita, à esquerda ou acima do pino (~70 px), o lugar que cobre menos coisa
# (pino, rota, marcas e nomes das clareiras) e cabe no mapa
func _lugar_do_botao(qm: Vector2, tam: Vector2, em: Callable, mapa: Rect2) -> Rect2:
	var ocupado: Array = [Rect2(qm - Vector2(14, 34), Vector2(28, 40)), botao_mais.merge(botao_menos), botao_x] # o pino, o zoom e o X
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

# mapa do totem: os totens grandes por cima (liberados acesos e pulsando, trancados apagados), o título, o botão de
# minimizar/maximizar, o X, o zoom e o "Teleportar" do totem escolhido
func _desenhar_totens(c: Control, tam: Vector2, em: Callable) -> void:
	var ouro := int(m.P.prog.get("ouro", 0))
	var pulso: float = 0.5 + 0.5 * sin(m.tempo * 3.0)
	for t in m.totem.T.lista:
		var id := str(t.id)
		var q: Vector2 = em.call(float(t.x), float(t.z))
		var aqui: bool = id == str(totem_de.id)
		var ok: bool = m.totem.descoberto(id)
		var esc: bool = id == totem_alvo
		if ok and not aqui: # brilho em volta: os que dá para tocar
			c.draw_circle(q, 20.0 + pulso * 5.0, Color(0.35, 0.85, 1.0, 0.12 + pulso * 0.1))
			c.draw_circle(q, 15.0, Color(0.35, 0.85, 1.0, 0.22))
		if esc:
			c.draw_arc(q, 21.0, 0, TAU, 40, COR_OURO, 2.5, true)
		_marca_totem(c, q, 12.0, ok)
		var nome := str(t.nome)
		var sub := ""
		var cor_sub := Color("9fe6ff")
		if aqui:
			sub = "Você está aqui"
			cor_sub = COR_OURO
			c.draw_arc(q, 19.0, 0, TAU, 40, COR_OURO, 2.0, true)
		elif ok:
			sub = "%d de ouro" % m.totem.taxa(t)
			if m.totem.taxa(t) > ouro:
				cor_sub = Color(1, 0.62, 0.55)
		else:
			sub = "visite a pé"
			cor_sub = Color(0.72, 0.75, 0.8)
		_texto(c, q + Vector2(0, -24), nome, 16, Color(1, 0.96, 0.88) if ok else Color(0.78, 0.8, 0.84))
		_texto(c, q + Vector2(0, 26), sub, 13, cor_sub)
	# moldura dourada
	c.draw_rect(Rect2(Vector2(1, 1), tam - Vector2(2, 2)), Color(0.05, 0.04, 0.03, 0.9), false, 3.0)
	c.draw_rect(Rect2(Vector2(3, 3), tam - Vector2(6, 6)), Color("c9a35a"), false, 1.5)
	# título: o totem daqui e o ouro
	var t1 := "Totem de teleporte · %s" % str(totem_de.get("nome", ""))
	var t2 := "Você tem %d de ouro. Toque num totem aceso para viajar." % ouro
	var wt: float = max(fonte.get_string_size(t1, HORIZONTAL_ALIGNMENT_LEFT, -1, 20).x, fonte.get_string_size(t2, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x) + 40.0
	var rt := Rect2(Vector2(tam.x * 0.5 - wt * 0.5, 12.0), Vector2(wt, 52.0))
	var sbt := StyleBoxFlat.new()
	sbt.bg_color = Color(0.08, 0.06, 0.04, 0.9)
	sbt.border_color = Color("c9a35a")
	sbt.set_border_width_all(2)
	sbt.set_corner_radius_all(16)
	sbt.shadow_color = Color(0, 0, 0, 0.4)
	sbt.shadow_size = 5
	sbt.draw(c.get_canvas_item(), rt)
	_texto(c, rt.position + Vector2(wt * 0.5, 18.0), t1, 20, COR_OURO, true, 4)
	_texto(c, rt.position + Vector2(wt * 0.5, 39.0), t2, 14, Color(1, 0.96, 0.88, 0.9), true, 3)
	# X de fechar e, ao lado, minimizar / maximizar
	var cx := Vector2(tam.x - 26.0, 26.0)
	botao_x = Rect2(cx - Vector2(22, 22), Vector2(44, 44))
	c.draw_circle(cx, 15.0, Color(0.05, 0.04, 0.03, 0.85))
	c.draw_arc(cx, 15.0, 0, TAU, 32, Color("c9a35a"), 1.5, true)
	c.draw_line(cx + Vector2(-6, -6), cx + Vector2(6, 6), Color(1, 0.95, 0.85), 2.5, true)
	c.draw_line(cx + Vector2(6, -6), cx + Vector2(-6, 6), Color(1, 0.95, 0.85), 2.5, true)
	var ct := Vector2(tam.x - 66.0, 26.0)
	botao_tam = Rect2(ct - Vector2(20, 22), Vector2(40, 44))
	c.draw_circle(ct, 15.0, Color(0.05, 0.04, 0.03, 0.85))
	c.draw_arc(ct, 15.0, 0, TAU, 32, Color("c9a35a"), 1.5, true)
	var bc := Color(1, 0.95, 0.85)
	if cheio: # minimizar: um traço embaixo
		c.draw_line(ct + Vector2(-6, 4), ct + Vector2(6, 4), bc, 2.5, true)
	else: # maximizar: um quadradinho
		c.draw_rect(Rect2(ct - Vector2(6, 6), Vector2(12, 12)), bc, false, 2.0)
	# zoom − e + embaixo (o mesmo do mapa normal)
	var cz := Vector2(tam.x * 0.5, tam.y - 34.0)
	var barra := Rect2(cz - Vector2(62, 22), Vector2(124, 44))
	var sbz := StyleBoxFlat.new()
	sbz.bg_color = Color(0.08, 0.06, 0.04, 0.88)
	sbz.border_color = Color("c9a35a")
	sbz.set_border_width_all(2)
	sbz.set_corner_radius_all(22)
	sbz.draw(c.get_canvas_item(), barra)
	c.draw_line(cz + Vector2(0, -13), cz + Vector2(0, 13), Color("c9a35a", 0.55), 1.5, true)
	var cm := cz + Vector2(-31, 0)
	var cp := cz + Vector2(31, 0)
	botao_menos = Rect2(cm - Vector2(30, 26), Vector2(60, 52))
	botao_mais = Rect2(cp - Vector2(30, 26), Vector2(60, 52))
	var cor_m: Color = Color(1, 0.95, 0.85, 0.35 if zoom_alvo <= _z_min() + 0.01 else 1.0)
	var cor_p: Color = Color(1, 0.95, 0.85, 0.35 if zoom_alvo >= Z_MAX - 0.01 else 1.0)
	c.draw_line(cm + Vector2(-9, 0), cm + Vector2(9, 0), cor_m, 3.0, true)
	c.draw_line(cp + Vector2(-9, 0), cp + Vector2(9, 0), cor_p, 3.0, true)
	c.draw_line(cp + Vector2(0, -9), cp + Vector2(0, 9), cor_p, 3.0, true)
	# o escolhido: botão "Teleportar" ao lado, ligado por uma linha dourada
	botao_tp = Rect2()
	if totem_alvo == "":
		return
	var alvo: Dictionary = m.totem.dados(totem_alvo)
	if alvo.is_empty():
		return
	var qa: Vector2 = em.call(float(alvo.x), float(alvo.z))
	var custo: int = m.totem.taxa(alvo)
	var falta: int = custo - ouro
	var b1 := "Teleportar"
	var b2 := "%d de ouro" % custo if falta <= 0 else "Faltam %d de ouro" % falta
	var w: float = max(fonte.get_string_size(b1, HORIZONTAL_ALIGNMENT_LEFT, -1, 20).x, fonte.get_string_size(b2, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x) + 40.0
	var bt := _lugar_do_botao(qa, Vector2(w, 54.0), em, Rect2(Vector2(0, 70), tam - Vector2(0, 70)))
	botao_tp = bt.grow(8.0)
	var borda: Vector2 = Vector2(clamp(qa.x, bt.position.x, bt.end.x), clamp(qa.y, bt.position.y, bt.end.y))
	c.draw_line(qa + (borda - qa).normalized() * 14.0, borda, Color(0.05, 0.04, 0.03, 0.6), 3.0, true)
	c.draw_line(qa + (borda - qa).normalized() * 14.0, borda, COR_OURO, 1.2, true)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.1, 0.14, 0.95) if falta <= 0 else Color(0.14, 0.07, 0.06, 0.95)
	sb.border_color = Color("5ad8ff") if falta <= 0 else Color(1, 0.62, 0.55)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(16)
	sb.shadow_color = Color(0, 0, 0, 0.45)
	sb.shadow_size = 6
	sb.draw(c.get_canvas_item(), bt)
	_texto(c, bt.position + Vector2(w * 0.5, 19.0), b1, 20, Color("9fe6ff") if falta <= 0 else Color(1, 0.8, 0.75), true, 4)
	_texto(c, bt.position + Vector2(w * 0.5, 39.0), b2, 13, Color(1, 0.96, 0.88, 0.85) if falta <= 0 else Color(1, 0.62, 0.55), true, 3)

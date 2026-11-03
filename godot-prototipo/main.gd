extends Node3D
# Vila da Clareira em Godot: mesma vila, mesmos personagens anime e as mesmas habilidades do jogo HTML (que fica de backup).
# Por enquanto tudo roda no aparelho (modo solo); o servidor Colyseus entra depois.

const D = preload("res://dados.gd")
const Hud = preload("res://hud.gd")
const Efeitos = preload("res://efeitos.gd")
const Terreno = preload("res://terreno.gd")
const Andar = preload("res://andar.gd")
const Online = preload("res://online.gd")
const Progresso = preload("res://progresso.gd")
const Menu = preload("res://menu.gd")
const BracoEspada = preload("res://braco_espada.gd")
const AnimHeroi = preload("res://anim_heroi.gd")
const CameraHeroi = preload("res://camera_heroi.gd")
const Sons = preload("res://sons.gd")
const Inclinar = preload("res://inclinar.gd")
const Armadura = preload("res://armadura.gd")
const Aparencia = preload("res://aparencia.gd")
const VisualNpc = preload("res://visual_npc.gd")
const Criador = preload("res://criador.gd")
const Trabalho = preload("res://trabalho.gd")
const MenuTopo = preload("res://menu_topo.gd")
const Combate = preload("res://combate.gd")
const Conversa = preload("res://conversa.gd")

const RAIO := 34.0
const RESOLUCAO_PADRAO := 0.6 # mesma nitidez do site (1.75x numa tela de ~904 pontos de largura)
const LACOS := ["parada", "andar", "corrida", "espada_parada", "queda", "parede_agarrado", "parede_beirada", "parede_balanca"]

# inimigos: monstros do Bestiário (modelos/puglin.glb e imp.glb), nunca dentro da vila. Os do acampamento do leste
# saíram (pedido do André 2026-11-02): agora ficam no campo de caça lá fora (mundo.caca, regra do Quimera, veja passo_cacas)
const BANDO := []
const NOME_TIPO := {"puglin": "Puglin", "imp": "Imp", "chefe": "Imp Chefe"}
const MODELO_TIPO := {"puglin": "puglin", "imp": "imp", "chefe": "imp"}
# NPCs: lugar e função vêm do servidor (dados/mundo.json); aqui só o modelo de cada um
const MODELO_NPC := {"lider": "fumiriya", "curandeira": "shino", "comerciante": "vivi", "andarilho": "vita", "ferreiro": "cabelo_m", "reset": "cabelo_m"}
# NPCs pintados com a "tinta" de shared/dados.js (cabelo, roupa, calça e tamanho). O Tomás virou homem (pedido do André,
# 2026-11-03): base masculina com roupa de couro marrom, mais alto, para não ficar igual ao Mestre Ivo
const TINGIR_NPC := ["ferreiro"]
const VIDA_INIMIGO := {"puglin": 80.0, "imp": 110.0, "chefe": 220.0} # TIPOS_INIMIGO de shared/dados.js
const EXTRAS := ["shibu", "shibu_sombrio", "cabelo_m", "fumiriya", "shino", "vivi", "vita", "victoria", "cabelo_m", "fumiriya"]

var sol: DirectionalLight3D
var camera: Camera3D
var grama: MultiMeshInstance3D
var hud
var fx
var combate # combate.gd: aviso antes do golpe do monstro, tranco, firme, esquiva, morte em fumaça
var _lenta_ate := 0.0 # câmera lenta (só o tempo): esquiva e último inimigo
var _lenta_k := 1.0
var cache := {}
var armas_lugar := {} # por personagem: onde a espada e o cajado ficam presos (cada corpo tem a mão num jeito)
var mundo: Dictionary # dados/mundo.json: pedras, casas e regras de escalada (iguais às do servidor)
var terreno
var mov # andar.gd: como o herói anda, colide e escala
var _clip_visto := -1
var online # online.gd: servidor do Oracle (login, outros jogadores, dano de verdade)
var mascara: Image
var vila_no: Node3D # a vila (vila.glb): de onde sai a pedra dos veios
var trabalho # trabalho.gd: estamina, veios, coleta e criação (Parte 3 do Quimera)

# ---------- herói ----------
var heroi: Node3D
var heroi_anim # anim_heroi.gd: AnimationTree com locomoção misturada e ações por cima (mesma cara do AnimationPlayer)
var heroi_esq: Skeleton3D
var espada: Node3D
var cajado: Node3D
var mao_direita := -1
var h := {"vida": 120.0, "mana": 100.0, "vy": 0.0, "pulos": 0, "morto": 0.0, "modo": "Espada", "combo": 0, "combo_ate": 0.0,
	"dash": 0.0, "dash_dir": Vector3.ZERO, "segurando": false, "ultimo_basico": 0.0, "escudo": 0.0, "escudo_ate": 0.0,
	"combo_fim": -9.0, "mao": 0, "pend": null, "lunge": null, "sem_alvo": -9.0, "vel_k": 1.0, "golpe_forte": false}
var acao := {} # o que o herói está fazendo agora (golpe, habilidade, rolamento...)
var recargas := {} # nome -> segundos que faltam
var P # progresso.gd: nível, atributos, skills e os 6 botões
var menu # menu.gd: menu do personagem (toque na barra de vida)
var conversa # conversa.gd: botão Falar e janela do NPC (tocar no NPC vai até ele)
var menu_topo # menu_topo.gd: Conta, Multijogador e Configurações no canto de cima, recolhe na seta (como o Quimera)
var vibracao := true # Configurações: vibrar no golpe e no dano
var criador # criador.gd: criador de personagem (conta nova e botão Aparência do menu)
var aparencia := {} # cores, altura e rosto do herói (a base é sempre a Ruiva)
var visual := "ruiva" # corpo do herói (criador: a Ruiva, os masculinos e os outros corpos VRoid, CRIADOR.corpos)
const ARQUIVO_APARENCIA := "user://aparencia.cfg" # última aparência (para jogar sem internet)
var tempo := 0.0

# ---------- outros ----------
var inimigos: Array = []
var npcs: Array = []
var extras: Array = []

var cam # camera_heroi.gd: segue com mola, vai para as costas correndo, treme no golpe
var braco # braco_espada.gd: espada baixa e para trás ao andar e correr no modo espada
var inclinar # inclinar.gd: tronco inclina na curva e o quadril afunda no pouso
var sons # sons.gd
# sensação do combate (ajuste aqui testando no celular)
const FILA_TEMPO := 0.3 # s que um botão apertado na hora errada fica guardado esperando poder sair
const FILA_PULO := 0.15 # o pulo apertado pouco antes de pousar sai no pouso
const HITSTOP := 0.05 # s de congelada no golpe que acerta
const HITSTOP_FORTE := 0.085 # 4º golpe do combo, skill e crítico
const TREME := 0.15 # André 2026-11-02: pouca mudança de câmera no combate (era 0,22)
const TREME_FORTE := 0.38
var fila = null # botão guardado: {q, ate}
var _hitstop_ate := 0.0
var _impacto_quadro := -1
var _passo_dist := 0.0 # metros andados desde o último som de passo
var _quadril := 0.0 # afundada do quadril no pouso (m)
# molas do peso do corpo (corpo_vivo): ângulo e velocidade do tronco para a frente e para o lado
const MOLA_K := 110.0 # força da mola (maior = volta mais rápido)
const MOLA_AMORT := 10.0 # amortecimento (menor = balança mais vezes; 10 dá um tranco e meio)
var _frente := 0.0
var _frente_v := 0.0
var _incl := 0.0
var _incl_v := 0.0
var _vel_ant := 0.0
var _dir_joy := Vector2.ZERO # para onde o joystick aponta agora (a cabeça vira antes do corpo)
var _olhar := 0.0
var _forca_joy := 0.0
# arrancada (pernas da animação própria, anim_heroi.gd): ritmo da animação e até onde ela vai antes de virar corrida
const ARR_RITMO := 1.6 # a animação do Mixamo sai devagar (trote); 1,6x acompanha a rampa de ~0,5 s até a corrida
const ARR_FIM := 1.05 # s da animação: depois disso as pernas voltam para a corrida normal
var _cansaco := 0.0 # 0 a 1: sobe correndo, desce parado; parado, o peito respira mais forte e mais rápido
var _respira := 0.0 # fase da respiração
var _resp_peso := 0.0 # respiração só aparece parado (entra e sai aos poucos)
var _acel := 0.0 # aceleração no chão (m/s², suavizada): + arrancando, - freando
var _flash := {} # Node3D do inimigo -> {mat, t}

# teste de desempenho
var etapas := []
var etapa := -1
var t_etapa := 0.0
var quadros := 0
var soma_proc := 0.0
var resultados := []
var rotulo: Label
var botao_teste: Button
const ESPERA := 2.5
const MEDE := 5.0

func _ready() -> void:
	get_viewport().scaling_3d_scale = RESOLUCAO_PADRAO
	P = Progresso.new()
	h.vida = P.st.vidaMax
	h.mana = P.st.manaMax
	armas_lugar = JSON.parse_string(FileAccess.get_file_as_string("res://modelos/armas.json"))
	mundo = JSON.parse_string(FileAccess.get_file_as_string("res://dados/mundo.json"))
	terreno = Terreno.new(mundo)
	mov = Andar.new(terreno, mundo)
	mascara = load("res://modelos/mascara_vila.png").get_image()
	if mascara.is_compressed():
		mascara.decompress()
	montar_ambiente()
	var vila: Node3D = load("res://modelos/vila.glb").instantiate()
	add_child(vila)
	vila_no = vila
	for mi in vila.find_children("*", "MeshInstance3D", true, false):
		if mi.get_aabb().size.x > 200.0: # o chão do site: troco pelo meu, com as trilhas
			mi.visible = false
	pintar(vila, false)
	achar_troncos(vila)
	montar_chao()
	montar_grama()
	# fonte do jogo (Alegreya Sans, OFL) no lugar da letra padrão do Godot: HUD, menus e números de dano
	ThemeDB.fallback_font = load("res://fontes/AlegreyaSans-Bold.ttf")
	fx = Efeitos.new()
	fx.mundo = self
	add_child(fx)
	combate = Combate.new(self)
	criar_heroi()
	for b in BANDO:
		var e := criar_inimigo(b.id, Vector3(b.x, 0, b.z), b.get("nome", "Inimigo"), b.get("escala", 1.0))
		e.tipo = b.tipo
		e.vida_max = VIDA_INIMIGO.get(b.tipo, D.INIMIGO.vida)
		e.vida = e.vida_max
	montar_cacas()
	for n in mundo.get("npcs", []):
		criar_npc(MODELO_NPC.get(n.id, "vivi"), Vector3(float(n.x), 0, float(n.z)), str(n.nome).get_slice(",", 0), n)
	camera = Camera3D.new()
	camera.far = 400
	add_child(camera)
	cam = CameraHeroi.new(self, camera)
	cam.colocar(heroi.position)
	sons = Sons.new()
	add_child(sons)
	sons.ouvinte = heroi
	hud = Hud.new()
	add_child(hud)
	hud.apertou.connect(usar)
	hud.soltou.connect(func(a): if a == "basico": h.segurando = false)
	hud.nome = "Ruiva"
	mostrar_build()
	trabalho = Trabalho.new(self)
	add_child(trabalho)
	menu = Menu.new(self)
	add_child(menu)
	conversa = Conversa.new(self)
	add_child(conversa)
	hud.tocou.connect(conversa.tocou_tela)
	criador = Criador.new(self)
	add_child(criador)
	var cfg := ConfigFile.new()
	var tem_cfg := cfg.load(ARQUIVO_APARENCIA) == OK
	if tem_cfg: # corpo escolhido da última vez (sem internet vale o do celular; online vale o da conta)
		trocar_corpo(str(cfg.get_value("heroi", "visual", "ruiva")), false)
	definir_aparencia(JSON.parse_string(str(cfg.get_value("heroi", "aparencia", "{}"))) if tem_cfg else {}, false)
	montar_teste()
	online = Online.new(self)
	add_child(online)
	menu_topo = MenuTopo.new(self)
	add_child(menu_topo)
	hud.menu_topo = menu_topo

# ---------- cenário ----------
func montar_ambiente() -> void:
	var ceu := PanoramaSkyMaterial.new()
	ceu.panorama = load("res://modelos/ceu.hdr")
	var sky := Sky.new()
	sky.sky_material = ceu
	var env := Environment.new()
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color("cfe2ff")
	env.ambient_light_energy = 0.4
	env.reflected_light_source = Environment.REFLECTION_SOURCE_DISABLED
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 0.68
	env.fog_enabled = true
	env.fog_light_color = Color("a9c8e6")
	env.fog_density = 0.0075
	env.adjustment_enabled = true
	env.adjustment_saturation = 1.22 # cores mais vivas, como o passe de cor do site
	var we := WorldEnvironment.new()
	we.environment = env
	add_child(we)
	sol = DirectionalLight3D.new()
	sol.light_color = Color("fff1d6")
	sol.light_energy = 0.9
	sol.shadow_enabled = true
	sol.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sol.directional_shadow_max_distance = 30.0
	sol.rotation = Vector3(deg_to_rad(-52), deg_to_rad(60), 0)
	add_child(sol)

func montar_chao() -> void:
	var m := ShaderMaterial.new()
	m.shader = load("res://chao.gdshader")
	m.set_shader_parameter("grama_tex", load("res://modelos/forrest_ground_01.jpg"))
	m.set_shader_parameter("terra_tex", load("res://modelos/stony_dirt_path.jpg"))
	m.set_shader_parameter("pedra_tex", load("res://modelos/cobblestone_floor_01.jpg"))
	m.set_shader_parameter("mascara", load("res://modelos/mascara_vila.png"))
	var mk: Dictionary = mundo.get("mascara", {"x0": -30.0, "z0": -34.0, "tam": 56.0})
	m.set_shader_parameter("area", Vector3(float(mk.x0), float(mk.z0), float(mk.tam)))
	m.set_shader_parameter("grama_cru", load("res://modelos/forrest_ground_01.jpg"))
	m.set_shader_parameter("pedra_cru", load("res://modelos/cobblestone_floor_01.jpg"))
	var p := PlaneMesh.new()
	p.size = Vector2(320, 320)
	var chao := MeshInstance3D.new()
	chao.mesh = p
	chao.material_override = m
	chao.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(chao)

func peso_vila(x: float, z: float) -> float:
	var mk: Dictionary = mundo.get("mascara", {"x0": -30.0, "z0": -34.0, "tam": 56.0})
	var i := int((x - float(mk.x0)) / float(mk.tam) * mascara.get_width())
	var j := int((z - float(mk.z0)) / float(mk.tam) * mascara.get_height())
	if i < 0 or j < 0 or i >= mascara.get_width() or j >= mascara.get_height():
		return 0.0
	var c := mascara.get_pixel(i, j)
	return max(c.r, c.g)

# Estilo pintado do site: sombra em degraus (toon), sem brilho de foto, contorno escuro nos personagens
var pintados := {}
var folhas: Array = [] # [MeshInstance3D, AABB no mundo] de copas e samambaias (somem quando tapam o herói)
func pintar(raiz: Node, personagem: bool, ruivo := false) -> void:
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		if not personagem and mi.mesh.get_surface_count() > 0:
			var m0 = mi.mesh.surface_get_material(0)
			if m0 is BaseMaterial3D and m0.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
				folhas.append([mi, null])
		for i in mi.mesh.get_surface_count():
			var m = mi.mesh.surface_get_material(i)
			if not (m is StandardMaterial3D):
				continue
			var nome_mat: String = m.resource_name + " " + mi.mesh.surface_get_name(i)
			var chave = [m, ruivo]
			if not pintados.has(chave):
				var n: StandardMaterial3D = m.duplicate()
				n.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
				n.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
				n.metallic = 0.0
				n.roughness = 1.0
				n.normal_enabled = false
				if personagem:
					n.emission_enabled = false # o brilho próprio do VRoid deixava pele e cabelo lavados
				if n.albedo_texture and not personagem:
					n.albedo_color = n.albedo_color.lerp(Color.WHITE, 0.3)
				if not personagem and n.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
					# folhagem (copas, samambaias): some em degradê perto da câmera, em vez de virar uma folha gigante na tela
					n.distance_fade_mode = BaseMaterial3D.DISTANCE_FADE_PIXEL_DITHER
					# samambaia e arbusto (baixos, ficam entre a câmera e o herói): somem mais cedo que as copas
					var baixo: bool = mi.mesh.get_aabb().size.y < 2.0
					n.distance_fade_min_distance = 1.4 if baixo else 0.6
					n.distance_fade_max_distance = 3.0 if baixo else 1.5
				if personagem and "(Outline)" in nome_mat:
					# contorno escuro de desenho (como o MToon): casca um pouco maior, só o lado de trás
					n.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
					n.cull_mode = BaseMaterial3D.CULL_FRONT
					n.grow = true
					n.grow_amount = 0.006
					n.albedo_color = Color(0.12, 0.08, 0.08)
					n.albedo_texture = null
				elif personagem:
					if "SKIN" in nome_mat:
						n.albedo_color = Color(1.0, 0.9, 0.84) # pele com um pouco de cor (o MToon do site sombreia em rosado)
					n.rim_enabled = true # contorno de luz de desenho
					n.rim = 0.25
					n.rim_tint = 0.6
				if ruivo and "HAIR" in nome_mat:
					n.albedo_color = Color(0.9, 0.5, 0.36)
				pintados[chave] = n
			mi.mesh.surface_set_material(i, pintados[chave])

func hsl(hh: float, s: float, l: float) -> Color:
	var v: float = l + s * min(l, 1.0 - l)
	return Color.from_hsv(hh, 0.0 if v == 0.0 else 2.0 * (1.0 - l / v), v)

func montar_grama() -> void:
	var m := PlaneMesh.new()
	m.size = Vector2(0.06, 0.3)
	m.orientation = PlaneMesh.FACE_Z
	m.subdivide_depth = 2
	m.center_offset = Vector3(0, 0.15, 0)
	var mat := ShaderMaterial.new()
	mat.shader = load("res://grama.gdshader")
	m.material = mat
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = m
	# a vila com a mesma quantidade do celular no site; as áreas de fora (mundo.areas depois da primeira) na mesma densidade
	var n0 := 22000
	var fora: Array = mundo.get("areas", []).slice(1)
	var extras: Array = []
	for o in fora:
		var area: float = float(o.rx) * float(o.rz) if o.has("rx") else float(o.r) * float(o.r)
		extras.append(int(n0 * area / pow(RAIO * 1.15, 2) * 0.8))
	mm.instance_count = n0 + extras.reduce(func(s, n): return s + n, 0)
	var rng := RandomNumberGenerator.new()
	for i in mm.instance_count:
		var cx := 0.0
		var cz := 0.0
		var rr := RAIO * 1.15
		var ini := n0
		for q in fora.size():
			if i >= ini:
				cx = float(fora[q].x)
				cz = float(fora[q].z)
				rr = (max(float(fora[q].rx), float(fora[q].rz)) * 1.27) if fora[q].has("rx") else float(fora[q].r) * 1.1
			ini += extras[q]
		var a := 0.0
		var r := 0.0
		for k in 20: # não nasce nas trilhas, na praça nem colada nas casas
			a = rng.randf() * TAU
			r = sqrt(rng.randf()) * rr
			if peso_vila(cx + cos(a) * r, cz + sin(a) * r) <= 0.2 and (i < n0 or mov.dentro_do_mapa(cx + cos(a) * r, cz + sin(a) * r, -3.0)):
				break
		var s := rng.randf_range(0.7, 1.3)
		var b := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s, s * rng.randf_range(0.6, 1.4), s))
		mm.set_instance_transform(i, Transform3D(b, Vector3(cx + cos(a) * r, 0, cz + sin(a) * r)))
		mm.set_instance_color(i, hsl(rng.randf_range(0.22, 0.27), rng.randf_range(0.45, 0.62), rng.randf_range(0.3, 0.46))) # PALETA.grama do site
	grama = MultiMeshInstance3D.new()
	grama.multimesh = mm
	grama.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(grama)

# ---------- personagens ----------
func modelo(id: String) -> Node3D:
	if not cache.has(id):
		cache[id] = load("res://modelos/%s.glb" % id)
	var no: Node3D = cache[id].instantiate()
	add_child(no)
	var anim: AnimationPlayer = no.find_child("AnimationPlayer", true, false)
	for nome in anim.get_animation_list():
		anim.get_animation(nome).loop_mode = Animation.LOOP_LINEAR if nome in LACOS else Animation.LOOP_NONE
	anim.play("parada")
	pintar(no, true, id == "ruiva")
	molas(no)
	return no

# aparência do herói (criador de personagem): pinta o herói e o boneco do menu e guarda no celular
func definir_aparencia(a, salvar := true) -> void:
	aparencia = Aparencia.valida(a, P.dados.criador)
	Aparencia.aplicar(heroi, aparencia)
	if menu and menu.boneco:
		Aparencia.aplicar(menu.boneco, aparencia)
	if salvar:
		var cfg := ConfigFile.new()
		cfg.set_value("heroi", "aparencia", JSON.stringify(aparencia))
		cfg.set_value("heroi", "visual", visual)
		cfg.save(ARQUIVO_APARENCIA)

# botão Aparência do menu do personagem: abre o criador sem o nome; online quem grava é o servidor ("mudarAparencia"
# e "mudarVisual" para o corpo)
func abrir_aparencia() -> void:
	criador.abrir_edicao(aparencia, func(a, corpo):
		var trocou: bool = corpo != visual
		trocar_corpo(corpo, false)
		definir_aparencia(a)
		if on():
			rede("mudarAparencia", a)
			if trocou:
				rede("mudarVisual", corpo)
		hud.aviso("Aparência salva"), visual)

# corpo que existe no jogo (lista do criador e modelo exportado); senão a Ruiva
func corpo_valido(v) -> String:
	var l: Array = P.dados.criador.get("corpos", ["ruiva"])
	var s := str(v)
	if s in l and ResourceLoader.exists("res://modelos/%s.glb" % s):
		return s
	return "ruiva"

# onde a espada e o cajado ficam presos no corpo do herói (cada corpo tem a mão num jeito)
func lugar_armas(id := "") -> Dictionary:
	var k := id if id != "" else visual
	return armas_lugar.get(k, armas_lugar.ruiva)

# troca o corpo do herói (criador de personagem) no mesmo lugar: refaz o modelo, as armas, a roupa e a pintura
func trocar_corpo(v, salvar := true) -> void:
	var novo := corpo_valido(v)
	if novo == visual and heroi != null:
		return
	visual = novo
	if heroi == null:
		return
	var pos: Vector3 = heroi.position
	var ry: float = heroi.rotation.y
	var modo: String = h.modo
	if trabalho:
		trabalho.parar(true) # a picareta e o machado saem da mão antes (senão iam junto com o corpo velho)
		for k in trabalho.ferramentas:
			var f: Node3D = trabalho.ferramentas[k]
			if f.get_parent() != self:
				f.get_parent().remove_child(f)
				add_child(f)
			f.visible = false
	acao = {}
	heroi.queue_free()
	heroi = null
	criar_heroi(false)
	heroi.position = pos
	heroi.rotation.y = ry
	armar(modo)
	_roupa = "-"
	vestir_heroi()
	Aparencia.aplicar(heroi, aparencia)
	if sons:
		sons.ouvinte = heroi
	if menu:
		menu.trocar_boneco()
	if online and online.get("corpos") is Dictionary:
		online.corpos[online.meu_id] = heroi
	if salvar:
		definir_aparencia(aparencia)

func esqueleto(no: Node) -> Skeleton3D:
	var l := no.find_children("*", "Skeleton3D", true, false)
	return l[0] if l.size() > 0 else null

# arma presa num osso (BoneAttachment), na mesma posição do jogo HTML
func prender(esq: Skeleton3D, arma: Node3D, lugar: Dictionary) -> BoneAttachment3D:
	var ba := BoneAttachment3D.new()
	ba.bone_name = lugar.osso
	esq.add_child(ba)
	var q := Quaternion(lugar.quat[0], lugar.quat[1], lugar.quat[2], lugar.quat[3])
	arma.transform = Transform3D(Basis(q).scaled(Vector3.ONE * lugar.escala), Vector3(lugar.pos[0], lugar.pos[1], lugar.pos[2]))
	if arma.get_parent():
		arma.get_parent().remove_child(arma)
	ba.add_child(arma)
	if lugar.osso == "J_Bip_C_UpperChest": # nas costas: com capa passa por fora do pano
		arma.set_meta("afastada", 0.0)
		Armadura.costas(esq, arma, esq.get_node_or_null("Armadura_capa") != null)
	return ba

func nova_arma(nome: String) -> Node3D:
	var a: Node3D = load("res://modelos/arma_%s.glb" % nome).instantiate()
	for mi in a.find_children("*", "MeshInstance3D", true, false):
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	return a

func criar_heroi(nascer := true) -> void:
	heroi = modelo(visual)
	heroi.position = D.NASCIMENTO
	heroi_anim = AnimHeroi.new(heroi.find_child("AnimationPlayer", true, false))
	heroi_esq = esqueleto(heroi)
	mao_direita = heroi_esq.find_bone(lugar_armas().espadaMao.osso)
	if nascer:
		mov.por_em(D.NASCIMENTO)
	espada = nova_arma("espada")
	cajado = nova_arma("cajado")
	armar("Espada")
	braco = BracoEspada.new()
	heroi_esq.add_child(braco)
	heroi_esq.move_child(braco, 0) # antes das molas do cabelo e da saia
	var L: Dictionary = lugar_armas().espadaMao
	braco.preparar(heroi_esq, Basis(Quaternion(L.quat[0], L.quat[1], L.quat[2], L.quat[3])))
	inclinar = Inclinar.new()
	heroi_esq.add_child(inclinar)
	heroi_esq.move_child(inclinar, 0) # antes do braço da espada (que lê a pose do ombro)
	inclinar.preparar(heroi_esq)
	# altura do quadril do herói (m): a freada e a meia-volta andam pelo caminho do quadril da animação, medido nela
	var iq := heroi_esq.find_bone("J_Bip_C_Hips")
	if iq >= 0 and heroi_esq.is_inside_tree():
		var hq: float = (heroi.global_transform.affine_inverse() * (heroi_esq.global_transform * heroi_esq.get_bone_global_rest(iq).origin)).y
		if hq > 0.4 and hq < 1.6:
			mov.altura_quadril = hq
	print("altura do quadril: ", mov.altura_quadril)

# roupas que aparecem no corpo (armadura.gd): refaz só quando o equipamento muda
var _roupa := "-"
func vestir_heroi() -> void:
	var eq: Dictionary = P.prog.get("equip", {})
	var k := ""
	for l in Armadura.LUGARES:
		var it = eq.get(l)
		k += (str(it.k) + str(int(it.r)) if it is Dictionary else "") + ","
	if k == _roupa:
		return
	_roupa = k
	Armadura.vestir(heroi, eq)

func armar(modo: String) -> void:
	# modo espada: espada na mão e cajado nas costas; modo magia: o contrário
	if modo != "Escalada":
		h.modo = modo
	var L: Dictionary = lugar_armas()
	if modo == "Escalada": # escalando: as duas nas costas, mãos livres
		prender(heroi_esq, espada, L.espadaCostas)
		prender(heroi_esq, cajado, L.cajadoCostas)
	elif modo == "Espada":
		prender(heroi_esq, espada, L.espadaMao)
		prender(heroi_esq, cajado, L.cajadoCostas)
	else:
		prender(heroi_esq, espada, L.espadaCostas)
		if cajado.get_parent():
			cajado.get_parent().remove_child(cajado)
		heroi.add_child(cajado) # na mão: segue a mão mas fica de pé (como no site), ver _process

func criar_inimigo(id: String, pos: Vector3, nome := "Inimigo", escala := 1.0) -> Dictionary:
	var no := modelo(id)
	no.position = pos
	no.scale *= escala
	if armas_lugar.has(id): # humano (VRoid) luta de espada; monstro do Bestiário luta com garra e soco
		prender(esqueleto(no), nova_arma("espada"), armas_lugar[id].espadaMao)
	else:
		contorno(no, 0.012)
	var e := {"no": no, "anim": no.find_child("AnimationPlayer", true, false), "vida": D.INIMIGO.vida, "centro": pos,
		"estado": "vagar", "t": randf() * 3.0, "alvo": pos, "cd": 0.0, "golpe": -1.0, "vida_max": D.INIMIGO.vida, "tipo": id,
		"parado": 0.0, "lento": 0.0, "lento_k": 0.0, "vuln": 0.0, "vuln_k": 0.0, "puxao": Vector3.ZERO, "puxao_t": 0.0}
	e.barra = barra_vida(no, nome, Color(0.85, 0.25, 0.2))
	nome_legivel(no)
	inimigos.append(e)
	return e

# contorno escuro de desenho nos monstros (como o MToon da Ruiva): casca um pouco maior, só o lado de trás
var mat_contorno := {}
func contorno(no: Node3D, metros: float) -> void:
	for mi in no.find_children("*", "MeshInstance3D", true, false):
		var k: float = snappedf(metros / max(0.0001, mi.global_transform.basis.get_scale().x), 0.0001)
		if not mat_contorno.has(k):
			var c := StandardMaterial3D.new()
			c.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			c.cull_mode = BaseMaterial3D.CULL_FRONT
			c.grow = true
			c.grow_amount = k
			c.albedo_color = Color(0.1, 0.07, 0.06)
			mat_contorno[k] = c
		for i in mi.mesh.get_surface_count():
			var m = mi.mesh.surface_get_material(i)
			if m is BaseMaterial3D and m.next_pass == null:
				var n: BaseMaterial3D = m.duplicate()
				n.next_pass = mat_contorno[k]
				mi.set_surface_override_material(i, n)

func criar_npc(id: String, pos: Vector3, nome: String, info := {}) -> void:
	var no := modelo(id)
	no.position = pos
	no.position.y = terreno.altura(pos.x, pos.z) if terreno else 0.0
	no.rotation.y = float(info.get("ry", randf() * TAU))
	barra_vida(no, nome, Color(0, 0, 0, 0))
	# nome do NPC com 14 px na Alegreya (direção de arte: estava pequeno e borrado)
	for l in no.get_children():
		if l is Label3D:
			l.font = load("res://fontes/AlegreyaSans-Bold.ttf")
			l.pixel_size = 0.00034 * 1.5
			l.offset = Vector2(0, 52.0 / 1.5)
	var ap := {}
	if str(info.get("id", "")) in TINGIR_NPC and info.get("tinta") is Dictionary:
		var t: Dictionary = info.tinta
		ap = {"cabelo": t.get("cabelo"), "roupa": t.get("roupa"), "calca": t.get("calca"), "altura": float(info.get("escala", 1.0))}
		Aparencia.aplicar(no, ap)
	VisualNpc.vestir(no, str(info.get("id", ""))) # roupa de ofício (avental e martelo do ferreiro)
	npcs.append({"aparencia": ap, "modelo": id, "no": no, "funcao": str(info.get("funcao", "")), "id": str(info.get("id", id)),
		"nome": str(info.get("nome", nome)), "acoes": info.get("acoes", []), "falas": info.get("falas", []), "missao": str(info.get("missao", ""))})

# perto da Rosa, a comerciante? (o servidor confere a mesma distância para comprar e vender)
func perto_da_loja() -> bool:
	for n in npcs:
		if n.funcao == "loja" and Vector2(n.no.position.x - heroi.position.x, n.no.position.z - heroi.position.z).length() < float(P.dados.lojaDistancia) - 0.3:
			return true
	return false

# perto de quem compra itens (a Rosa ou o Tomás, o ferreiro)? O servidor confere o mesmo (pertoDeQuemCompra)
func perto_de_quem_compra() -> bool:
	if perto_da_loja():
		return true
	for n in npcs:
		if "vender" in n.get("acoes", []) and Vector2(n.no.position.x - heroi.position.x, n.no.position.z - heroi.position.z).length() < float(P.dados.lojaDistancia) - 0.3:
			return true
	return false

func perto_do_npc(funcao: String, metros: float) -> bool:
	for n in npcs:
		if n.funcao == funcao and Vector2(n.no.position.x - heroi.position.x, n.no.position.z - heroi.position.z).length() < metros:
			return true
	return false

# preço do Mestre Ivo (RESET_BUILD de shared/dados.js, o mesmo de Simulacao.custoReset)
func custo_reset() -> int:
	var R: Dictionary = mundo.get("resetBuild", {"minimo": 50, "porNivel": 10})
	return max(int(R.minimo), int(R.porNivel) * int(P.prog.nivel))

# poção da mochila: confere se vale a pena; sem internet já recupera aqui (online quem aplica é o servidor)
func usar_pocao(it: Dictionary) -> bool:
	if h.morto > 0.0:
		return false
	var u: Dictionary = P.dados.itens[it.k].get("usar", {})
	if u.has("vida"):
		if h.vida >= P.st.vidaMax:
			hud.aviso("A vida já está cheia")
			return false
		var n: float = min(P.st.vidaMax - h.vida, round(P.st.vidaMax * float(u.vida)))
		fx.cura(heroi)
		fx.numero(heroi.position, n, Color("7dffa0"))
		if not on():
			h.vida += n
	if u.has("mana"):
		if h.mana >= P.st.manaMax:
			hud.aviso("A mana já está cheia")
			return false
		if not on():
			h.mana = min(P.st.manaMax, h.mana + P.st.manaMax * float(u.mana))
	return true

# ouro e itens que caíram do monstro: sobem do corpo dele (cor da raridade)
func mostrar_drop(pos: Vector3, ouro: int, itens: Array) -> void:
	# uma linha embaixo da outra, saindo com 0,15 s de diferença (direção de arte: sem aviso repetido no topo)
	var linhas := []
	if ouro > 0:
		linhas.append(["+%d ouro" % ouro, Color("ffd36a")])
	for it in itens:
		var r := int(it.get("r", -1))
		linhas.append([str(it.nome), Color(P.dados.raridades[r].cor) if r >= 0 else Color("e8f0ff")])
	for i in linhas.size():
		fx.texto(pos - Vector3(0, 0.36 * i, 0), linhas[i][0], linhas[i][1], 0.15 * i)

# nome do monstro legível no celular (direção de arte): Alegreya 1,5x como os NPCs (~21 px numa tela de 576),
# contorno de ~2 px e letra em MSDF com mipmaps (borda lisa em qualquer tamanho, sem serrilhado)
var _fonte_nome: FontFile
func fonte_nome() -> FontFile:
	if _fonte_nome == null:
		_fonte_nome = (load("res://fontes/AlegreyaSans-Bold.ttf") as FontFile).duplicate()
		_fonte_nome.multichannel_signed_distance_field = true
		_fonte_nome.msdf_pixel_range = 16
		_fonte_nome.msdf_size = 64
		_fonte_nome.generate_mipmaps = true
	return _fonte_nome

func nome_legivel(no: Node3D) -> void:
	for l in no.get_children():
		if l is Label3D:
			l.font = fonte_nome()
			l.pixel_size = 0.00034 * 1.5
			l.offset = Vector2(0, 52.0 / 1.5)
			l.outline_size = 7 # 7 px da letra de 72 = uns 2 px na tela
			l.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS

# nome e barra de vida em cima da cabeça
func barra_vida(no: Node3D, nome: String, cor: Color) -> MeshInstance3D:
	var l := Label3D.new()
	l.text = nome
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	# tamanho fixo na tela (uns 14 px de letra numa tela de 576 de altura), não cresce quando a câmera chega perto
	l.fixed_size = true
	l.font_size = 72 # letra grande em pixel bem pequeno: fica nítida
	l.outline_size = 16
	l.pixel_size = 0.00034
	l.offset = Vector2(0, 52) # em cima da barra
	l.modulate = Color(1, 0.93, 0.8)
	l.position = Vector3(0, 1.95, 0)
	no.add_child(l)
	if cor.a == 0:
		return null
	var fundo := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(0.1, 0.009) # 60 x 5 px na tela (tamanho fixo, como o nome)
	fundo.mesh = q
	var mf := StandardMaterial3D.new()
	mf.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mf.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	mf.billboard_keep_scale = true
	mf.fixed_size = true
	mf.no_depth_test = true
	mf.albedo_color = Color(0, 0, 0, 0.6)
	mf.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	fundo.material_override = mf
	fundo.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	fundo.position = Vector3(0, 1.95, 0)
	no.add_child(fundo)
	var barra := MeshInstance3D.new()
	barra.mesh = q
	var mb: StandardMaterial3D = mf.duplicate()
	mb.albedo_color = cor
	mb.render_priority = 1
	barra.material_override = mb
	barra.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	barra.position = Vector3(0, 1.95, 0)
	no.add_child(barra)
	return barra

# cabelo, saia e acessórios do VRoid (ossos J_Sec_...) balançam com mola, como as spring bones do site
func molas(no: Node) -> void:
	var esq := esqueleto(no)
	if esq == null:
		return
	var cadeias := []
	for i in esq.get_bone_count():
		var nome := esq.get_bone_name(i)
		var pai := esq.get_bone_parent(i)
		if nome.begins_with("J_Sec_") and (pai < 0 or not esq.get_bone_name(pai).begins_with("J_Sec_")):
			var fim := i
			while true:
				var filhos := esq.get_bone_children(fim)
				if filhos.is_empty():
					break
				fim = filhos[0]
			if fim != i:
				cadeias.append([i, fim])
	if cadeias.is_empty():
		return
	var sim := SpringBoneSimulator3D.new()
	esq.add_child(sim)
	sim.setting_count = cadeias.size()
	for k in cadeias.size():
		sim.set_root_bone(k, cadeias[k][0])
		sim.set_end_bone(k, cadeias[k][1])
		sim.set_stiffness(k, 1.0)
		sim.set_drag(k, 0.4)
		sim.set_gravity(k, 0.0)

# ---------- combate ----------
func inimigo_em(pos: Vector3, raio: float):
	for e in inimigos:
		if e.estado != "morto" and Vector2(e.no.position.x - pos.x, e.no.position.z - pos.z).length() < raio + 0.35 and pos.y < e.no.position.y + 2.2:
			return e
	return null

func mais_perto(pos: Vector3, max_d: float):
	var melhor = null
	var md := max_d
	for e in inimigos:
		if e.estado == "morto":
			continue
		var d: float = e.no.position.distance_to(pos)
		if d < md:
			md = d
			melhor = e
	return melhor

# hab: a skill que acertou (crítico pela Destreza e efeitos: atordoa, congela, lento, vulnerável), como Simulacao.ferir
func ferir(e: Dictionary, dmg: float, de: Vector3, hab = null) -> void:
	if e.estado == "morto":
		return
	if on(): # online: quem acerta e quanto tira é o servidor; o tranco, o flash e a congelada saem na hora aqui
		var forte_on: bool = h.golpe_forte or not (hab is Dictionary and hab.has("combo"))
		impacto_golpe(e.no.position, forte_on, false, hab is Dictionary and hab.has("combo") and h.modo == "Espada")
		piscar(e.no)
		combate.reacao(e.no, de, forte_on)
		return
	trabalho.combate()
	dmg *= randf_range(0.85, 1.15) # como no Quimera: ±15% e crítico ×2
	var crit: bool = randf() < P.st.critico
	if crit:
		dmg *= 2.0
	if e.vuln > tempo:
		dmg *= 1.0 + e.vuln_k
	if h.get("contra_ate", 0.0) > tempo: # contra-ataque depois da esquiva (como Simulacao.ferir)
		dmg *= float(D.COMBATE.contraK)
		crit = true
		h.contra_ate = 0.0
	dmg = max(1.0, round(dmg))
	e.vida -= dmg
	e.combate = tempo + 5.0 # nome aparece enquanto está em combate
	fx.numero(e.no.position, dmg, Color(1, 0.72, 0.25) if crit else Color(1, 0.95, 0.6), crit)
	var basico_hab: bool = hab is Dictionary and hab.has("combo")
	impacto_golpe(e.no.position, h.golpe_forte or not basico_hab, crit, basico_hab and h.modo == "Espada")
	piscar(e.no)
	# resistência: muitos golpes seguidos e o monstro fica firme (aguenta e revida), como no servidor
	if tempo - e.get("golpe_t", -9.0) > D.COMBATE.firmeJanela:
		e.golpes = 0
	e.golpe_t = tempo
	e.golpes = e.get("golpes", 0) + 1
	if e.vida > 0.0 and e.golpes >= int(D.COMBATE.firmeGolpes.get(e.tipo, 6)) and e.get("firme", 0.0) <= tempo and e.parado <= tempo:
		e.firme = tempo + D.COMBATE.firmeDur
		e.golpes = 0
		e.cd = min(e.cd, 0.25)
		combate.firme(e.no, D.COMBATE.firmeDur)
	var firme: bool = e.get("firme", 0.0) > tempo
	combate.reacao(e.no, de, h.golpe_forte or not basico_hab)
	e.barra.scale.x = max(0.001, e.vida / e.vida_max)
	var empurra: Vector3 = (e.no.position - de)
	empurra.y = 0
	var metros: float = float(hab.get("empurra", 0.25)) if hab is Dictionary else 0.25
	if empurra.length() > 0.01 and e.tipo != "chefe" and not firme: # o inimigo voa para longe (em 0,22 s)
		e.puxao = empurra.normalized() * metros / 0.22
		e.puxao_t = 0.22
	if e.vida <= 0:
		e.estado = "morto"
		e.t = D.INIMIGO.renascer
		e.morreu = tempo
		e.parado = 0.0
		e.anim.speed_scale = 1.0
		e.anim.play("morrer", 0.1)
		e.golpe = -1.0
		if e.tipo != "chefe" and empurra.length() > 0.01: # o golpe final joga o corpo para trás
			e.puxao = empurra.normalized() * D.COMBATE.voaMorte / 0.35
			e.puxao_t = 0.35
		combate.morreu(e.no)
		sons.tocar("morte", -2.0, 0.1, e.no.position)
		e.barra.get_parent().get_child(e.barra.get_index() - 1).visible = false
		e.barra.visible = false
		var subiu: String = P.ganhar_xp(int(P.dados.xpInimigo.get(e.tipo, 5)))
		if subiu != "":
			h.vida = P.st.vidaMax
			h.mana = P.st.manaMax
			hud.aviso(subiu)
			fx.subir_nivel(heroi)
		return
	if hab is Dictionary:
		var chefe: float = 0.5 if e.tipo == "chefe" else 1.0
		if hab.has("lento"): # no chefe lentidão e Quebrado valem metade
			e.lento = tempo + hab.lento.dur
			e.lento_k = hab.lento.k * chefe
		if hab.has("vulneravel"):
			e.vuln = tempo + hab.vulneravel.dur
			e.vuln_k = hab.vulneravel.k * chefe
		for k in ["atordoa", "congela"]:
			if hab.has(k) and not (k == "atordoa" and hab.get("tipo") == "esmagar" and e.tipo == "chefe"):
				e.parado = max(e.parado, tempo + hab[k] * chefe)
				e.golpe = -1.0
				fx.status(e.no, k, hab[k] * chefe)
				if k == "congela":
					e.anim.speed_scale = 0.0
	if e.parado > tempo or firme: # atordoado, congelado ou firme: não para o que está fazendo
		return
	e.golpe = -1.0 # apanhou no meio do preparo: o golpe dele foi cortado
	e.estado = "apanhar"
	e.t = 0.45
	e.anim.play("apanhar", 0.05, 1.6)

# ---------- peso do golpe: congelada, tremida, flash, som e vibração ----------
# Golpe que acertou (uma vez por quadro, mesmo pegando vários inimigos). forte = último do combo ou skill.
var _impacto_t := -9.0
func impacto_golpe(pos: Vector3, forte: bool, crit: bool, lamina: bool) -> void:
	if _impacto_quadro == Engine.get_process_frames():
		return
	_impacto_quadro = Engine.get_process_frames()
	_impacto_t = tempo
	var pesado := forte or crit
	parar_golpe(HITSTOP_FORTE if pesado else HITSTOP)
	cam.tremer(TREME_FORTE if pesado else TREME)
	sons.tocar("acerto_forte" if pesado else "acerto", -1.0 if pesado else -3.0, 0.1, pos)
	if lamina:
		sons.tocar("corte", -7.0, 0.1, pos)
		# faíscas do corte no ponto do golpe
		var p := pos + Vector3(0, 1.05, 0) - frente() * 0.25
		fx.surto(p.x, p.y, p.z, 14 if pesado else 9, "ffffff", "ffd27a", 6.0 if pesado else 4.5, 0.08)
		fx.marca_corte(p, heroi.rotation.y, pesado)
	vibrar(40 if pesado else 22)

# tudo para por um instante (Engine.time_scale), como nos jogos de ação; volta pelo relógio de verdade
func parar_golpe(seg: float) -> void:
	_hitstop_ate = max(_hitstop_ate, Time.get_ticks_usec() / 1000000.0 + seg)
	Engine.time_scale = 0.05

# folhagem entre a câmera e o peito do herói (cápsula de 0,8 m) fica transparente: alfa 0,25 em 0,15 s,
# volta em 0,4 s. Os troncos são outra malha e continuam sólidos. (direção de arte, pacote A)
const FOLHA_RAIO := 0.8
const FOLHA_ALFA := 0.25
const TRONCO_PERTO := 1.1 # m: tronco a menos disso da câmera (do lado, tapando meia tela) também apaga
# troncos das árvores (opacos, finos e altos, em cima de uma árvore do mapa): entram no mesmo apagar das copas,
# assim a câmera não fica atrás de um tronco sem precisar chegar perto (o André não quer a câmera colando no herói)
var _n_troncos := 0
func achar_troncos(raiz: Node) -> void:
	var arv: Array = []
	for a in mundo.get("coletaveis", []):
		if str(a.tipo) == "arvore":
			arv.append(Vector2(float(a.x), float(a.z)))
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null or mi.mesh.get_surface_count() == 0:
			continue
		var m0 = mi.mesh.surface_get_material(0)
		if not (m0 is BaseMaterial3D) or m0.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
			continue
		var bb: AABB = mi.global_transform * mi.mesh.get_aabb()
		if bb.size.y < 2.0 or bb.size.y > 9.0 or bb.size.x > 6.0 or bb.size.z > 6.0: # tronco com os galhos
			continue
		var c := Vector2(bb.get_center().x, bb.get_center().z)
		for a in arv:
			if c.distance_to(a) < 1.6:
				folhas.append([mi, null, 0.0, true])
				_n_troncos += 1
				break

func folhagem_na_frente(dt: float) -> void:
	if camera == null or heroi == null:
		return
	var a: Vector3 = camera.global_position
	var b: Vector3 = heroi.global_position + Vector3(0, 1.2, 0)
	for f in folhas:
		var mi: MeshInstance3D = f[0]
		if not is_instance_valid(mi):
			continue
		if f[1] == null:
			f[1] = (mi.global_transform * mi.mesh.get_aabb()).grow(FOLHA_RAIO)
		var tapa: bool = f[1].intersects_segment(a, b) != null
		if not tapa and f.size() > 3: # tronco colado na câmera, de lado
			var bb: AABB = f[1]
			var cxz := Vector2(bb.get_center().x, bb.get_center().z)
			tapa = cxz.distance_to(Vector2(a.x, a.z)) < TRONCO_PERTO + FOLHA_RAIO and (Vector3(cxz.x, a.y, cxz.y) - a).dot(b - a) > 0.0
		var quer: float = (1.0 - FOLHA_ALFA) if tapa else 0.0
		var atual: float = f[2] if f.size() > 2 else 0.0
		if atual == quer:
			continue
		atual = move_toward(atual, quer, dt * (1.0 - FOLHA_ALFA) / (0.15 if tapa else 0.4))
		if f.size() < 3:
			f.append(atual)
		f[2] = atual
		# alfa de verdade (sem o pontilhado do dither): cópia do material só enquanto a copa está apagando
		if atual > 0.0:
			if mi.material_override == null:
				var base: BaseMaterial3D = mi.mesh.surface_get_material(0)
				var mt: BaseMaterial3D = base.duplicate()
				mt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_DEPTH_PRE_PASS
				mt.distance_fade_mode = BaseMaterial3D.DISTANCE_FADE_DISABLED
				mi.material_override = mt
			var cor: Color = mi.mesh.surface_get_material(0).albedo_color
			mi.material_override.albedo_color = Color(cor, cor.a * (1.0 - atual))
		else:
			mi.material_override = null

# câmera lenta curtinha (o tempo, não a câmera): k = velocidade (0,3 = 30%) por seg segundos de verdade
func lenta(seg: float, k: float) -> void:
	_lenta_ate = max(_lenta_ate, Time.get_ticks_usec() / 1000000.0 + seg)
	_lenta_k = k
	if Engine.time_scale > k:
		Engine.time_scale = k

func vibrar(ms: int) -> void:
	if OS.has_feature("mobile") and vibracao:
		Input.vibrate_handheld(ms)

# inimigo pisca branco por um instante quando apanha (direção de arte: no máximo 55% para branco, 0,06 s; era 85% e 0,11 s)
const FLASH_DUR := 0.06
const FLASH_MAX := 0.55
func piscar(no: Node3D) -> void:
	if not is_instance_valid(no):
		return
	var f = _flash.get(no)
	if f == null:
		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.albedo_color = Color(1, 1, 1, 0)
		mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		var malhas := []
		for mi in no.find_children("*", "MeshInstance3D", true, false):
			if not (mi.mesh is QuadMesh): # o corpo, não a barra de vida
				malhas.append(mi)
		f = {"mat": mat, "t": 0.0, "malhas": malhas}
		_flash[no] = f
	f.t = FLASH_DUR
	for mi in f.malhas:
		mi.material_overlay = f.mat

func _flash_passo(dt: float) -> void:
	for no in _flash.keys():
		var f: Dictionary = _flash[no]
		if f.t <= 0.0:
			continue
		f.t -= dt
		f.mat.albedo_color.a = clamp(f.t / FLASH_DUR, 0.0, 1.0) * FLASH_MAX
		if f.t <= 0.0:
			for mi in f.malhas:
				if is_instance_valid(mi): # congelado: volta para o gelo, não limpa
					mi.material_overlay = mi.get_meta("overlay_base") if mi.has_meta("overlay_base") else null

func dano_area(pos: Vector3, raio: float, dmg: float, hab = null) -> void:
	for e in inimigos.duplicate():
		if e.estado != "morto" and Vector2(e.no.position.x - pos.x, e.no.position.z - pos.z).length() < raio:
			ferir(e, dmg, pos, hab)

func dano_arco(alcance: float, arco: float, dmg: float, hab = null) -> Array:
	var frente := frente()
	var acertou := []
	for e in inimigos.duplicate():
		if e.estado == "morto":
			continue
		var d: Vector3 = e.no.position - heroi.position
		if abs(d.y) > 1.6: # em cima da pedra o golpe não alcança quem está embaixo
			continue
		d.y = 0
		if d.length() < alcance + 0.4 and (d.length() < 0.6 or frente.angle_to(d) < arco * 0.5):
			acertou.append(e.no.position)
			ferir(e, dmg, heroi.position, hab)
	return acertou

func virar_para_inimigo() -> void:
	var e = mais_perto(heroi.position, 8.0)
	if e:
		var d: Vector3 = e.no.position - heroi.position
		mov.mirar(atan2(d.x, d.z))

# para onde o herói está virado (ou virando: o golpe já mira no alvo enquanto o corpo gira)
func frente() -> Vector3:
	var r: float = mov.direcao()
	return Vector3(sin(r), 0, cos(r))

func ponto_mao() -> Vector3:
	return heroi_esq.global_transform * heroi_esq.get_bone_global_pose(mao_direita).origin

func comecar(nome: String, ts: float, hits: Array, ao_acertar: Callable, extra := {}) -> void:
	var dur: float = heroi_anim.get_animation(nome).length / ts
	heroi_anim.play(nome, extra.get("fade", 0.08), ts)
	acao = {"nome": nome, "t": 0.0, "dur": dur, "hits": hits.duplicate(), "feitos": 0, "fn": ao_acertar}
	acao.merge(extra)

func on() -> bool:
	return online != null and online.ligado

func rede(tipo: String, dados = null) -> void:
	if on():
		online.enviar(tipo, dados)

func pode_agir() -> bool:
	return h.morto <= 0.0 and acao.is_empty() and mov.esc == null

# Botão apertado. Se não dá para fazer agora (golpe ainda no fim, no ar, recarga quase acabando), o botão fica
# guardado um instante (fila) e sai assim que der: o combo e as skills emendam sem perder toque.
func usar(qual: String) -> void:
	if h.morto > 0.0:
		return
	if trabalho.coletando != null and not qual in ["coletar", "menu", "troca", "loja", "forja", "resetar", "falar"]:
		trabalho.parar(true) # qualquer ação para a coleta
	if qual in ["pular", "dash", "rolar"]: # pular, dash e rolar cancelam a magia concentrada e cortam o golpe
		if acao.get("canal", false):
			cancelar_canal()
		elif acao.get("basico", false) or (acao.get("cancela", false) and acao.feitos >= acao.hits.size()):
			acao = {} # golpe que já acertou: esquiva na hora
	if _tentar(qual):
		fila = null
	elif not qual in ["troca", "menu", "loja", "coletar", "forja", "resetar", "falar"]:
		fila = {"q": qual, "ate": tempo + (FILA_PULO if qual == "pular" else FILA_TEMPO)}

# tenta fazer agora. false = ocupado (vale guardar na fila); true = fez, ou não vai dar mesmo (já avisou)
func _tentar(qual: String) -> bool:
	match qual:
		"basico":
			# segura só se o dedo ainda está no botão (um toque que saiu da fila depois de soltar não trava a repetição)
			h.segurando = hud.segurando("basico")
			return basico()
		"troca":
			armar("Magia" if h.modo == "Espada" else "Espada")
			rede("modo", h.modo)
			mostrar_build()
			hud.aviso("Modo espada" if h.modo == "Espada" else "Modo magia")
			sons.tocar("sacar", -4.0)
		"cura":
			if recargas.get("cura", 0.0) > FILA_TEMPO or h.mana < D.CURA.mana:
				return true
			if not pode_agir() or recargas.get("cura", 0.0) > 0.0:
				return false
			h.mana -= D.CURA.mana
			recargas["cura"] = D.CURA.cd
			rede("habilidade", 9)
			fx.conjura(heroi, "cura", heroi_anim.get_animation(D.CURA.anim).length / D.CURA.ts, maos)
			comecar(D.CURA.anim, D.CURA.ts, D.CURA.hits, func(_i):
				h.vida = min(P.st.vidaMax, h.vida + D.CURA.cura)
				fx.cura(heroi)
				fx.numero(heroi.position, D.CURA.cura, Color("7dffa0")))
		"pular":
			if not acao.is_empty() and not acao.get("pulo", false):
				return false
			var folego: bool = trabalho.pode(float(trabalho.E.mortal))
			var p: String = mov.pular(folego)
			if p == "":
				if not folego and not mov.chao and mov.pulos == 1:
					hud.aviso("Sem fôlego!")
				return false # no ar sem pulo sobrando: se pousar logo, pula no pouso
			if p == "mortal":
				trabalho.gastar(float(trabalho.E.mortal))
			rede("pular")
			acao = {}
			heroi_anim.play(p, 0.06, 1.2)
			sons.tocar("pano", -8.0)
			if p == "mortal":
				sons.tocar("golpe", -6.0, 0.05, null, 0.7)
		"dash":
			if recargas.get("dash", 0.0) > FILA_TEMPO:
				return true
			if recargas.get("dash", 0.0) > 0.0 or not acao.is_empty() or mov.esc != null:
				return false
			if not trabalho.pode(float(trabalho.E.dash)):
				hud.aviso("Sem fôlego!")
				return true
			var dir := direcao_joystick()
			var na_parede: bool = mov.dash(dir.x, dir.z)
			if mov.esc == null and mov.arrancada == null:
				return true # não deu (já usou o dash no ar)
			recargas["dash"] = D.MOVIMENTO.dash_cd
			trabalho.gastar(float(trabalho.E.dash))
			rede("dash")
			if not na_parede:
				fx.dash(heroi, D.MOVIMENTO.dash_tempo, false)
			heroi.rotation.y = mov.ry
		"rolar":
			if recargas.get("rolar", 0.0) > FILA_TEMPO:
				return true
			if not pode_agir() or recargas.get("rolar", 0.0) > 0.0 or not mov.chao:
				return false
			if not trabalho.gastar(float(trabalho.E.rolar)):
				return true
			recargas["rolar"] = D.HEROI.rolar_cd
			rede("rolar")
			var dir := direcao_joystick()
			if dir.length() > 0.1:
				mov.ry = atan2(dir.x, dir.z)
				mov.ry_mira = null
				heroi.rotation.y = mov.ry
			comecar("rolar", 1.15, [], func(_i): pass, {"anda": 6.0})
			sons.tocar("pano", -4.0)
			sons.tocar("dash", -10.0, 0.1, null, 0.8)
		"menu":
			menu.abrir()
		"loja":
			rede("falar") # a Rosa responde e o menu abre na Loja
			menu.abrir("loja")
		"falar": # perto de um NPC: abre a janela dele (conversa.gd)
			conversa.tocar_botao()
		"coletar": # veio ou árvore perto: minera ou corta lenha (trabalho.gd)
			trabalho.tocar_botao()
		"forja": # perto do Tomás: menu na aba Profissões, receitas do Ferreiro
			menu.abrir("profissoes", "fer")
		"resetar": # perto do Mestre Ivo: online ele responde com o preço e a janela abre (online.gd "fala")
			if on():
				rede("falar")
			else:
				menu.perguntar_reset(custo_reset())
		_:
			if qual.begins_with("hab"):
				return habilidade(int(qual.substr(3)))
	return true

# ---------- skills do Quimera (progresso.gd / shared/progresso.js; cada tipo = uma função do Quimera) ----------
# a barra da arma na mão (Trocar mostra a outra)
func barra_atual() -> Array:
	return P.prog.barras[P.barra_de(h.modo)]

func vivo(e) -> bool:
	return e is Dictionary and e.estado != "morto"

func virar_para(e) -> void:
	if vivo(e):
		var d: Vector3 = e.no.position - heroi.position
		mov.mirar(atan2(d.x, d.z)) # vira em ~0,1 s (antes estalava na hora)

# toca a animação durando dur segundos; hits em segundos (como as skills do Quimera)
func comecar_q(nome: String, dur: float, hits: Array, ao_acertar: Callable, extra := {}) -> void:
	var fr := []
	for t in hits:
		fr.append(float(t) / dur)
	comecar(nome, heroi_anim.get_animation(nome).length / dur, fr, ao_acertar, extra)

func sem_alvo() -> void:
	if tempo - h.sem_alvo > 1.2:
		h.sem_alvo = tempo
		hud.aviso("Longe demais" if mais_perto(heroi.position, 40.0) else "Nenhum inimigo por perto")

# Golpe básico da arma na mão. Não trava: dá para andar enquanto bate (como no Quimera)
func basico() -> bool:
	if acao.get("basico", false) and acao.t >= acao.fim: # o golpe anterior já acabou (só segura a pose): emenda
		acao = {}
	if h.morto > 0.0 or mov.esc != null or not acao.is_empty() or recargas.get("basico", 0.0) > 0.0:
		return false
	h.ultimo_basico = tempo
	if h.modo == "Espada":
		basico_espada()
	else:
		basico_magia()
	return true

# Espada: combo de 4 cortes (0,48 s cada, volta ao 1º depois de 0,8 s sem bater). Alvo longe (até 12 m): corre até ele
func basico_espada() -> void:
	var hab: Dictionary = P.hab_pronta("espada_basico")
	var alvo = mais_perto(heroi.position, hab.alcance)
	if alvo == null:
		var longe = mais_perto(heroi.position, hab.persegue)
		if longe:
			h.pend = {"e": longe, "t": 3.0}
			recargas["basico"] = 0.15
		else:
			sem_alvo()
			recargas["basico"] = 0.25
		return
	h.pend = null
	virar_para(alvo)
	var i: int = 0 if tempo - h.combo_fim > hab.comboZera else (h.combo + 1) % hab.combo.size()
	passo_golpe(alvo, i == hab.combo.size() - 1)
	h.combo = i
	var g: Dictionary = hab.combo[i]
	var fade: float = 0.14 if i == 0 else 0.05 # 4º -> 1º golpe: a pose muda muito, mistura mais devagar
	h.combo_fim = tempo + g.dur
	recargas["basico"] = max(hab.cd, g.dur) # o 4º golpe é mais longo: o próximo espera ele terminar
	rede("habQ", "espada_basico")
	var ultimo: bool = i == hab.combo.size() - 1
	comecar_q(g.anim, g.dur, [g.hit], func(_k):
		h.golpe_forte = ultimo # o último corte do combo pesa mais (congela e treme mais)
		var acertou := dano_arco(hab.alcance, hab.arco, hab.dmg, hab)
		if acertou.is_empty() and vivo(alvo) and alvo.no.position.distance_to(heroi.position) < 3.6:
			ferir(alvo, hab.dmg, heroi.position, hab)
			if on():
				acertou.append(alvo.no.position)
		h.golpe_forte = false
		if not acertou.is_empty() and on(): # online o dano vem do servidor, mas a sensação do corte é na hora
			impacto_golpe(acertou[0], ultimo, false, true)
		acertou.clear(), {"cancela": true, "lamina": true, "alvo": alvo, "basico": true, "fade": fade})
	# vento da lâmina um pouco antes do corte
	var vento_t: float = max(0.0, g.hit - 0.12)
	fx.agenda.append({"t": vento_t, "fn": func(): sons.tocar("golpe", -3.0 if ultimo else -5.0, 0.08, null, 0.85 if ultimo else 1.0)})
	segurar_pose(0.35)

# Cajado: faísca de fogo que mira sozinha no inimigo mais perto (9 m), alternando as mãos
func basico_magia() -> void:
	var hab: Dictionary = P.hab_pronta("cajado_basico")
	var alvo = mais_perto(heroi.position, hab.alcance + 0.5)
	if alvo == null:
		sem_alvo()
		recargas["basico"] = 0.25
		return
	virar_para(alvo)
	h.mao = 1 - h.mao
	var g: Dictionary = hab.combo[h.mao]
	recargas["basico"] = hab.cd
	rede("habQ", "cajado_basico")
	comecar_q(g.anim, g.dur, [g.hit], func(_k): atirar(hab, alvo, hab.alcance + 3.0), {"livre": true, "alvo": alvo, "basico": true})
	heroi_anim.so_tronco = true # andando, as pernas continuam no passo e só os braços atiram
	segurar_pose(0.35)

# o golpe básico fica parado no último quadro mais um pouco: o próximo golpe do combo emenda direto,
# sem voltar para a corrida no meio (era o "pulo" que aparecia no loop do combo)
func segurar_pose(extra: float) -> void:
	var hit_s: float = acao.hits[0] * acao.dur
	acao.fim = acao.dur
	acao.dur += extra
	acao.hits = [hit_s / acao.dur]

func atirar(hab: Dictionary, alvo, alcance: float) -> void:
	var info: Dictionary = hab.proj.duplicate()
	info.cor = Color(info.cor)
	info.hab = hab
	var de := ponto_mao()
	var dir := frente()
	if vivo(alvo):
		dir = ((alvo.no.position + Vector3(0, 1.0, 0)) - de).normalized()
	fx.projetil(de, dir, info, hab.dmg, alcance)

# o alvo que a skill precisa (igual a Simulacao.alvoHab): sem ninguém no alcance ela nem sai. false = não pode
func alvo_hab(hab: Dictionary):
	var t: String = hab.tipo
	if t == "corte" or t == "esmagar":
		return mais_perto(heroi.position, hab.lunge.r)
	if t in ["bola", "cadeia", "meteoro", "investida"]:
		var e = mais_perto(heroi.position, hab.alcance + 0.5)
		return e if e else false
	if t in ["anel", "gelo", "puxar"]:
		var e = mais_perto(heroi.position, hab.area)
		return e if e else false
	return null

# Botão i da barra da arma na mão
func habilidade(i: int) -> bool:
	var k = barra_atual()[i]
	if k == null or not P.habs.has(k):
		hud.aviso("Escolha uma skill no menu do personagem")
		return true
	if not P.liberada(k):
		hud.aviso("Libera no nível %d" % int(P.habs[k].libera))
		return true
	if recargas.get(k, 0.0) > FILA_TEMPO:
		return true
	if h.morto > 0.0 or mov.esc != null or not mov.chao or not acao.is_empty() or recargas.get(k, 0.0) > 0.0:
		return false # como no Quimera: não corta uma skill no meio (fica na fila e sai quando a outra acabar)
	var hab: Dictionary = P.hab_pronta(k)
	if h.mana < hab.get("mana", 0):
		hud.aviso("Mana insuficiente")
		hud.negar("hab%d" % i)
		return true
	var alvo = alvo_hab(hab)
	if alvo is bool:
		sem_alvo()
		return true
	h.pend = null
	h.mana -= hab.get("mana", 0)
	virar_para(alvo)
	var dir := direcao_joystick()
	rede("habQ", {"id": k, "dx": snappedf(dir.x, 0.01), "dz": snappedf(dir.z, 0.01)} if hab.tipo == "teleporte" else k)
	if hab.has("canal"): # magia concentrada: andar (joystick forte), pular ou dar dash cancela e devolve 70% da mana
		var dur: float = hab.canal / hab.at
		fx.conjura(heroi, P.FX.get(k, "magia"), dur, maos)
		if hab.has("area"): # aviso no chão de onde a magia vai pegar enquanto concentra (Meteoro: em cima do alvo)
			combate.aviso_area(alvo.no if hab.tipo == "meteoro" and vivo(alvo) else heroi, float(hab.area), dur, Color(fx.cor_de(P.FX.get(k, "magia"))[1]))
		comecar_q(hab.anim, dur, [hab.canal], func(_n):
			acao.canal = false
			acao.cancela = true
			recargas[k] = hab.cd
			contar_offline(k)
			soltar(k, hab, alvo if vivo(alvo) else alvo_hab(hab), dir), {"canal": true, "hab": k, "mana": hab.get("mana", 0)})
		return true
	recargas[k] = hab.cd
	contar_offline(k)
	soltar(k, hab, alvo, dir)
	return true

func contar_offline(k: String) -> void:
	if not on():
		var subiu: String = P.contar_uso(k)
		if subiu != "":
			hud.aviso(subiu)

func cancelar_canal(motivo := "Cancelado") -> void:
	if not acao.get("canal", false):
		return
	h.mana = min(P.st.manaMax, h.mana + acao.mana * 0.7)
	acao = {}
	fx.status_fim(heroi)
	fx.cancelar_conjura(heroi)
	combate.aviso_area_fim()
	rede("cancelar")
	hud.aviso(motivo)
	heroi_anim.play("parada" if h.modo == "Magia" else "espada_parada", 0.15)

# cada corte do básico dá meio passo para o alvo (o 4º, um passo inteiro), sem encostar nele
func passo_golpe(alvo, forte: bool) -> void:
	if not vivo(alvo) or h.lunge != null:
		return
	var d: Vector3 = alvo.no.position - heroi.position
	d.y = 0
	var falta: float = d.length() - 1.25
	if falta <= 0.05:
		return
	var t := 0.12
	h.lunge = {"v": d.normalized() * min(falta, 0.8 if forte else 0.4) / t, "t": t, "fantasma": false}

# passo rápido até o inimigo (lunge do Quimera, antes do Corte Duplo e do Golpe Esmagador)
func lunge(alvo, para: float) -> void:
	if not vivo(alvo):
		return
	var d: float = Vector2(alvo.no.position.x - heroi.position.x, alvo.no.position.z - heroi.position.z).length() - para
	if d > 0.3:
		var t: float = min(0.25, 0.05 + d * 0.04)
		h.lunge = {"v": frente() * d / t, "t": t, "fantasma": false}

func soltar(k: String, hab: Dictionary, alvo, dir: Vector3) -> void:
	var p0 := heroi.position
	var fxk: String = P.FX.get(k, "magia")
	match hab.tipo:
		"corte", "esmagar":
			lunge(alvo, hab.lunge.para)
			fx.conjura(heroi, fxk, hab.dur, maos)
			comecar_q(hab.anim, hab.dur, hab.hits, func(_n):
				var p: Vector3 = heroi.position + frente() * hab.ponto
				dano_area(p, hab.area, hab.dmg, hab)
				fx.explosao_hab(fxk, p.x, p.z, hab.area, heroi.position.y), {"cancela": true, "lamina": true})
		"giro", "pisao":
			fx.conjura(heroi, fxk, hab.dur, maos)
			comecar_q(hab.anim, hab.dur, hab.hits, func(_n):
				dano_area(heroi.position, hab.area, hab.dmg, hab)
				fx.explosao_hab(fxk, heroi.position.x, heroi.position.z, hab.area, heroi.position.y), {"cancela": true, "lamina": true})
		"investida": # dash atravessando os inimigos em linha
			var L: float = min(hab.alcance, alvo.no.position.distance_to(p0) + 2.5)
			var f := frente()
			h.lunge = {"v": f * L / hab.dashT, "t": hab.dashT, "fantasma": true}
			fx.dash(heroi, hab.dashT + 0.12, true)
			comecar_q(hab.anim, hab.dur, hab.hits, func(_n):
				var linha := []
				for e in inimigos:
					if e.estado == "morto":
						continue
					var d: Vector3 = e.no.position - p0
					var a: float = d.x * f.x + d.z * f.z
					var lado: float = abs(d.x * f.z - d.z * f.x)
					if a > -0.5 and a < L + 1.0 and lado < hab.largura:
						linha.append([a, e])
				linha.sort_custom(func(x, y): return x[0] < y[0])
				for i in min(linha.size(), int(round(hab.alvos))):
					var e = linha[i][1]
					ferir(e, hab.dmg * pow(hab.cai, i), p0, hab)
					fx.impacto(e.no.position.x, e.no.position.z, heroi.rotation.y, fxk, e.no.position.y), {"lamina": true})
		"bola":
			atirar(hab, alvo, hab.alcance + 6.0)
		"anel":
			mov.vy = 3.2 # pulinho
			mov.chao = false
			dano_area(p0, hab.area, hab.dmg, hab)
			fx.explosao_hab(fxk, p0.x, p0.z, hab.area, p0.y)
		"gelo":
			dano_area(p0, hab.area, hab.dmg, hab)
			fx.explosao_hab(fxk, p0.x, p0.z, hab.area, p0.y)
		"meteoro":
			var c: Vector3 = alvo.no.position if vivo(alvo) else p0 + frente() * 5.0
			fx.meteoro(c.x, c.z, hab.area, hab.queda, terreno.altura(c.x, c.z), func(_p): dano_area(c, hab.area, hab.dmg, hab))
		"cadeia": # da mão no alvo, depois pula para o mais perto dele (5,5 m)
			var feitos := []
			var de := ponto_mao()
			var e = alvo
			for i in int(round(hab.alvos)):
				if not vivo(e):
					break
				feitos.append(e)
				var n: float = hab.dmg * pow(hab.cai, i)
				var a: Vector3 = de
				var alvo_i = e
				fx.agenda.append({"t": i * 0.08, "fn": func():
					if vivo(alvo_i):
						fx.cadeia(a, alvo_i.no.position + Vector3(0, 1.0, 0))
						ferir(alvo_i, n, a, hab)})
				de = e.no.position + Vector3(0, 1.0, 0)
				var prox = null
				var md: float = hab.pula
				for q in inimigos:
					var dq: float = q.no.position.distance_to(e.no.position)
					if q.estado != "morto" and not feitos.has(q) and dq < md:
						md = dq
						prox = q
				e = prox
		"teleporte":
			teleportar(hab, dir)
		"cura":
			var n: float = min(round(P.st.vidaMax * hab.curaPct), P.st.vidaMax - h.vida)
			h.vida += n
			fx.cura(heroi)
			fx.numero(heroi.position, n, Color("7dffa0"))
			fx.anel(p0.x, p0.z, hab.grupo, "9be08f", 0.9, p0.y)
		"escudo":
			comecar_q(hab.anim, hab.dur, [], func(_n): pass, {"cancela": true})
			h.escudo = float(hab.absorve)
			h.escudo_ate = tempo + float(hab.duracao)
			fx.escudo(heroi, float(hab.duracao))
		"puxar": # puxa para perto (não puxa chefe) e segura um instante; não tira vida
			fx.vortice(p0.x, p0.z, hab.area, p0.y)
			for e in inimigos:
				if e.estado == "morto" or e.tipo == "chefe":
					continue
				var d: Vector3 = p0 - e.no.position
				d.y = 0
				if d.length() < hab.area:
					e.puxao = d.normalized() * max(0.0, d.length() - 1.6) / 0.3
					e.puxao_t = 0.3
					e.parado = max(e.parado, tempo + hab.atordoa)

# Salto Arcano: some e aparece até 5,5 m (+0,6 por nível) para onde o joystick aponta, parando antes da parede
func teleportar(hab: Dictionary, dir: Vector3) -> void:
	var f := Vector3(dir.x, 0, dir.z).normalized() if dir.length() > 0.15 else frente()
	mov.ry = atan2(f.x, f.z)
	heroi.rotation.y = mov.ry
	var de := heroi.position
	var outros_antes: Array = mov.outros.duplicate()
	mov.outros.clear() # passa por cima de quem estiver no caminho
	for i in int(round(hab.distancia / 0.25)):
		var x0: float = mov.x
		var z0: float = mov.z
		var y0: float = mov.y
		mov.bloqueado = false
		mov.mover(f.x * 0.25, f.z * 0.25)
		if mov.bloqueado or Vector2(mov.x - x0, mov.z - z0).length() < 0.2:
			mov.x = x0
			mov.z = z0
			mov.y = y0
			break
	mov.outros = outros_antes
	heroi.position = mov.posicao()
	fx.teleporte(de, heroi.position)
	heroi.visible = false
	fx.agenda.append({"t": 0.1, "fn": func(): heroi.visible = true})

func maos() -> Array:
	return [ponto_mao()]

# botões da tela: a barra da arma na mão (skill ainda não liberada aparece apagada)
func mostrar_build() -> void:
	var icones := []
	var travados := []
	for k in barra_atual():
		icones.append(P.ICONE.get(k, "") if k != null else "")
		travados.append(k != null and not P.liberada(k))
	hud.mostrar_build(icones, h.modo, travados)
	# borda de cada botão na cor do elemento da skill
	var barra: Array = barra_atual()
	for i in barra.size():
		var k = barra[i]
		hud.borda("hab%d" % i, Color(fx.cor_de(P.FX.get(k, "magia"))[1]).lightened(0.15) if k != null and P.habs.has(k) else null)

# velocidade da animação de andar/correr para o passo bater com o chão (andar.gd: PASSO_*)
func ritmo(a: String) -> float:
	if a == "corrida":
		return mov.CORRIDA / mov.PASSO_CORRIDA
	if a == "andar":
		return mov.ANDAR / mov.PASSO_ANDAR
	return 1.0

func direcao_joystick() -> Vector3:
	var m: Vector2 = hud.mover
	if m.length() < 0.15:
		if conversa and conversa.indo != null: # tocou num NPC longe: vai até ele
			return conversa.direcao_auto()
		return trabalho.direcao_auto() if trabalho else Vector3.ZERO
	return Vector3(m.x, 0, m.y).rotated(Vector3.UP, cam.yaw)

# ---------- quadro a quadro ----------
func _process(dt: float) -> void:
	# congelada do golpe: dt já vem quase zero; a câmera e a HUD usam o tempo de verdade
	var dt_real: float = dt / max(Engine.time_scale, 0.001)
	var agora_s: float = Time.get_ticks_usec() / 1000000.0
	if Engine.time_scale < 1.0 and agora_s >= _hitstop_ate:
		Engine.time_scale = _lenta_k if agora_s < _lenta_ate else 1.0
	tempo += dt
	for k in recargas.keys():
		recargas[k] = max(0.0, recargas[k] - dt)
	atualizar_heroi(dt)
	if not on():
		atualizar_inimigos(dt)
	barras_perto()
	avisar_zona()
	# andando ou correndo de espada na mão (sem golpe nem parede): braço direito segura a lâmina baixa e para trás
	var andando: bool = heroi_anim.current_animation in ["andar", "corrida"] and mov.velocidade() > 0.3
	var quer: float = 1.0 if h.modo == "Espada" and acao.is_empty() and mov.esc == null and andando and h.morto <= 0.0 else 0.0
	braco.peso = move_toward(braco.peso, quer, dt * 6.0)
	vestir_heroi()
	Armadura.vento(heroi, mov.velocidade() if h.morto <= 0.0 else 0.0, dt)
	_flash_passo(dt_real)
	combate.passo(dt_real)
	# marca no chão de quem o golpe vai pegar (o mais perto, até 12 m)
	var marcado = mais_perto(heroi.position, 12.0) if h.morto <= 0.0 else null
	combate.marcar(marcado.no if marcado else null, dt_real)
	# câmera em volta do herói (arrastar o dedo do lado direito gira): camera_heroi.gd
	var g: Vector2 = hud.giro_cam
	hud.giro_cam = Vector2.ZERO
	cam.zoom(hud.zoom_cam) # dois dedos (pinça) ou roda do mouse
	hud.zoom_cam = 1.0
	cam.atualizar(min(dt_real, 0.1), g)
	folhagem_na_frente(dt_real)
	# HUD
	hud.vida = h.vida / P.st.vidaMax
	hud.mana = h.mana / P.st.manaMax
	hud.estamina = trabalho.sta / max(1.0, trabalho.sta_max())
	hud.sem_folego = trabalho.sem_folego
	hud.texto_vida = "%d/%d" % [ceil(h.vida), P.st.vidaMax]
	hud.texto_mana = "%d/%d" % [floor(h.mana), P.st.manaMax]
	hud.nivel = P.prog.nivel
	hud.xp = float(P.prog.xp) / max(1, P.xp_prox)
	hud.escudo = h.escudo > 0.0 and h.escudo_ate > tempo
	var barra: Array = barra_atual()
	for i in barra.size():
		var k = barra[i]
		hud.recarga("hab%d" % i, recargas.get(k, 0.0) if k != null else 0.0, P.hab_nivel(k).cd * (1 - P.st.recarga) if k != null else 1.0)
		hud.sem_mana("hab%d" % i, k != null and P.habs.has(k) and h.mana < float(P.habs[k].get("mana", 0)))
	hud.canal = acao.t / (acao.dur * acao.hits[0]) if acao.get("canal", false) else -1.0
	hud.mostrar_botao("loja", perto_da_loja() and h.morto <= 0.0)
	hud.mostrar_botao("resetar", perto_do_npc("resetar", 3.0) and h.morto <= 0.0)
	hud.mostrar_botao("falar", conversa != null and conversa.npc_perto() != null and h.morto <= 0.0)
	if P.mudou:
		P.mudou = false
		mostrar_build()
		if menu:
			menu.atualizar()
	hud.recarga("cura", recargas.get("cura", 0.0), D.CURA.cd)
	hud.recarga("dash", recargas.get("dash", 0.0), D.MOVIMENTO.dash_cd)
	hud.recarga("rolar", recargas.get("rolar", 0.0), D.HEROI.rolar_cd)
	atualizar_teste(dt)

func atualizar_heroi(dt: float) -> void:
	if h.morto > 0.0:
		if on():
			return # online: o servidor levanta o herói
		h.morto -= dt
		if h.morto <= 0.0:
			h.vida = P.st.vidaMax
			h.mana = P.st.manaMax
			mov.por_em(D.NASCIMENTO)
			heroi.position = mov.posicao()
			heroi_anim.play("parada", 0.2)
		return
	h.mana = min(P.st.manaMax, h.mana + P.st.regenMana * dt)
	if not on():
		h.vida = min(P.st.vidaMax, h.vida + P.st.regenVida * dt)
	if h.escudo_ate <= tempo:
		h.escudo = 0.0
	# repete o ataque básico só enquanto o dedo está no botão; soltou, para na hora (sem deixar o herói farmando sozinho)
	if h.segurando and not hud.segurando("basico"):
		h.segurando = false
	if h.segurando and tempo - h.ultimo_basico > 0.2:
		basico()
	# botão guardado na fila: sai assim que der
	if fila != null:
		if tempo > fila.ate:
			fila = null
		elif _tentar(fila.q):
			fila = null
	var dir := direcao_joystick()
	var forca: float = hud.mover.length()
	# espada: tocou o golpe com o alvo longe, corre até ele e bate quando chega (o joystick cancela)
	if h.pend != null:
		var pe: Dictionary = h.pend
		pe.t -= dt
		var e = pe.e
		if forca > 0.15 or pe.t <= 0.0 or not vivo(e) or h.modo != "Espada":
			h.pend = null
		else:
			var d: Vector3 = e.no.position - heroi.position
			d.y = 0
			if d.length() < 2.9 + 0.25:
				h.pend = null
				recargas["basico"] = 0.0
				basico()
			else:
				dir = d.normalized()
				forca = 1.0
	# magia concentrada: o herói fica parado; puxar o joystick com força cancela
	if acao.get("canal", false):
		if forca > 0.55:
			cancelar_canal()
		else:
			dir = Vector3.ZERO
			forca = 0.0
	mov.outros.clear()
	var fantasma: bool = h.lunge != null and h.lunge.fantasma
	if not fantasma:
		for e in inimigos:
			if e.estado != "morto":
				mov.outros.append(e.no.position)
		for n in npcs:
			mov.outros.append(n.no.position)
	if h.lunge != null: # passo rápido até o alvo (lunge) ou o dash da Investida
		var lg: Dictionary = h.lunge
		var passo: float = min(dt, lg.t)
		mov.mover(lg.v.x * passo, lg.v.z * passo)
		lg.t -= dt
		if lg.t <= 0.0:
			h.lunge = null
	# ação em andamento: golpes acertam no tempo certo da animação; avanço e rolamento andam pelo terreno
	if not acao.is_empty():
		acao.t += dt
		var frac: float = acao.t / acao.dur
		while acao.feitos < acao.hits.size() and frac >= acao.hits[acao.feitos]:
			acao.fn.call(acao.feitos)
			if acao.is_empty():
				break
			acao.feitos += 1
		if not acao.is_empty():
			var f := frente()
			if acao.has("avanco") and acao.t < acao.dur * acao.avanco_t:
				var v: float = acao.avanco / (acao.dur * acao.avanco_t) * dt
				mov.mover(f.x * v, f.z * v)
			if acao.has("anda"):
				var v2: float = acao.anda * (1.0 - frac) * dt * 1.4
				mov.mover(f.x * v2, f.z * v2)
			if acao.t >= acao.dur:
				acao = {}
	var estava_escalando: bool = mov.esc != null
	var estava_no_chao: bool = mov.chao
	# golpe e skill de espada não travam: anda enquanto bate, virado para o alvo
	# golpe de espada e skills plantam o pé; depois que o golpe acerta, mexer o joystick corta o resto e o herói anda
	# (como nos RPGs de referência: dá para girar em volta do alvo entre um golpe e outro)
	if not acao.is_empty() and acao.get("cancela", false) and forca > 0.15 and acao.feitos >= acao.hits.size():
		acao = {}
	var livre: bool = acao.is_empty() or acao.get("pulo", false) or acao.get("livre", false)
	# o tiro básico do cajado anda junto, mais devagar (P.dados.andarAtirando), mudando aos poucos (sem tranco)
	var k_alvo: float = float(P.dados.andarAtirando) if not acao.is_empty() and acao.get("livre", false) else 1.0
	h.vel_k = move_toward(h.vel_k, k_alvo, dt * 4.0)
	mov.passo(dt, dir.x, dir.z, forca >= 0.85, livre and h.lunge == null, h.vel_k)
	_dir_joy = Vector2(dir.x, dir.z) if forca > 0.15 else Vector2.ZERO
	_forca_joy = forca
	trabalho.passo_estamina(dt)
	if not acao.is_empty() and acao.get("livre", false) and vivo(acao.get("alvo")):
		var da: Vector3 = acao.alvo.no.position - heroi.position
		mov.mirar(atan2(da.x, da.z))
	heroi.position = mov.posicao()
	heroi.rotation.y = mov.ry
	# armas: escalando, as duas nas costas
	if mov.esc != null and not estava_escalando:
		acao = {}
		armar("Escalada")
	elif mov.esc == null and estava_escalando:
		armar(h.modo)
	# animação
	if mov.esc != null:
		if mov.anim != "" and (heroi_anim.current_animation != mov.anim or mov.clip_seq != _clip_visto) and heroi_anim.has_animation(mov.anim):
			_clip_visto = mov.clip_seq
			var clip_esc: bool = mov.anim.begins_with("esc_")
			var vel := 1.0
			if clip_esc:
				vel = heroi_anim.get_animation(mov.anim).length / max(0.05, float(mundo.escalada[mov.anim.substr(4)].dur))
			var mesma: bool = heroi_anim.current_animation == mov.anim
			heroi_anim.play(mov.anim, 0.12, vel)
			if mesma:
				heroi_anim.seek(0.0, true)
	elif acao.is_empty():
		var a := ""
		if mov.manobra != null and heroi_anim.has_animation(mov.manobra.nome):
			a = mov.manobra.nome # freada e meia-volta: o corpo anda pelo caminho do quadril da animação (andar.gd)
		elif mov.arrancada != null:
			a = "corrida"
		elif mov.mortal > 0.0:
			a = "mortal"
		elif not mov.chao:
			a = "pulo" if mov.pulos == 1 and mov.vy > 0 and mov.pulo_t < 0.45 else "queda"
		elif mov.pouso > 0.0 and dir.length() < 0.15:
			a = "pouso"
		elif dir.length() > 0.15 or mov.velocidade() > 0.6:
			# a mistura parada/andar/corrida vem da velocidade de verdade (anim_heroi.gd); o nome é para o servidor
			a = "corrida" if mov.velocidade() > 3.2 else "andar"
		else:
			a = "parada" if h.modo == "Magia" else "espada_parada"
		if heroi_anim.current_animation != a and heroi_anim.has_animation(a):
			# andar e correr no ritmo da velocidade: o pé acompanha o chão (sem parecer que desliza)
			if mov.manobra != null and a == mov.manobra.nome:
				heroi_anim.play(a, 0.1 if a == "meia_volta" else 0.15, mov.ritmo_manobra())
			else:
				# saindo da freada: o corpo se arruma devagar (mistura longa)
				heroi_anim.play(a, 0.35 if heroi_anim.current_animation == "freada" else 0.15, ritmo(a) if mov.arrancada == null else 1.0)
		elif mov.manobra != null and a == mov.manobra.nome:
			heroi_anim.ritmo_acao(mov.ritmo_manobra())
	# cajado na mão (modo magia): segue a mão e fica de pé, um pouco inclinado
	if h.modo == "Magia" and mov.esc == null:
		var mao := ponto_mao()
		cajado.global_transform = Transform3D(heroi.global_transform.basis * Basis.from_euler(Vector3(0.18, 0, -0.08)), mao)
	# rastro da espada durante o golpe e do vento no dash
	var lamina = null
	if not acao.is_empty() and acao.get("lamina", false) and h.modo == "Espada" and mov.esc == null:
		lamina = [espada.global_transform * Vector3(0, 0.2, 0), espada.global_transform * Vector3(0, 0.92, 0)]
	fx.corpo_passo(heroi, dt, mov.arrancada != null, lamina)
	sol.global_position = heroi.position
	corpo_vivo(dt, estava_no_chao)

# o que dá peso ao corpo: mistura da locomoção, inclinar na curva, afundar no pouso e o som dos passos
func corpo_vivo(dt: float, estava_no_chao: bool) -> void:
	var vel: float = mov.velocidade()
	var vel_anim: float = vel
	if mov.arrancada != null:
		vel_anim = mov.CORRIDA * 1.2
	elif not mov.chao or mov.esc != null:
		vel_anim = 0.0
	heroi_anim.atualizar(dt, vel_anim)
	# Peso do corpo: molas que passam do ponto e voltam (o "tranco" da freada e da arrancada).
	# Arrancando, o tronco vai para a frente; freando, vai para trás e o quadril desce; quando para,
	# a mola joga o tronco para a frente e ele volta ao lugar. Na curva deita para dentro e, ao endireitar, volta balançando.
	var vel_antes: float = _vel_ant
	var _a_inst: float = clamp((vel - _vel_ant) / max(dt, 0.0001), -30.0, 30.0) # teleporte e fim do dash não viram tranco gigante
	_vel_ant = vel
	_acel = lerp(_acel, _a_inst, min(1.0, dt * 14.0))
	var livre_corpo: bool = mov.chao and mov.esc == null and mov.arrancada == null and mov.manobra == null and acao.is_empty()
	# arrancada: saindo do parado com o joystick todo, as pernas tocam a animação de sair correndo
	if heroi_anim.arrancando <= 0.0:
		if livre_corpo and vel_antes < 0.4 and _forca_joy > 0.85 and mov.vel_max > 4.0:
			heroi_anim.arrancar(ARR_RITMO)
	elif heroi_anim.arrancando > ARR_FIM or not livre_corpo or _forca_joy < 0.15:
		heroi_anim.soltar_arrancada()
	var alvo_frente := 0.0
	var alvo_incl := 0.0
	if livre_corpo:
		alvo_frente = clamp(_acel * (0.016 if _acel > 0.0 else 0.02), -0.3, 0.2)
		alvo_incl = clamp(-mov.giro * vel * 0.022, -0.26, 0.26)
	_frente_v += ((alvo_frente - _frente) * MOLA_K - _frente_v * MOLA_AMORT) * dt
	_frente += _frente_v * dt
	_incl_v += ((alvo_incl - _incl) * MOLA_K * 0.8 - _incl_v * MOLA_AMORT) * dt
	_incl += _incl_v * dt
	# cansaço e respiração: depois de correr, parado, o peito sobe e desce forte e vai acalmando
	if vel > 3.5 and mov.chao:
		_cansaco = min(1.0, _cansaco + dt / 8.0)
	elif vel < 0.5:
		_cansaco = max(0.0, _cansaco - dt / 10.0)
	_respira += dt * TAU * lerp(0.28, 0.75, _cansaco)
	_resp_peso = move_toward(_resp_peso, 1.0 if livre_corpo and vel < 0.5 else 0.0, dt * 3.0)
	var resp: float = sin(_respira) * lerp(0.01, 0.05, _cansaco) * _resp_peso
	inclinar.frente = clamp(_frente + resp, -0.4, 0.3)
	# cabeça vira antes do corpo para onde o joystick aponta (o corpo vem logo atrás)
	var alvo_olhar := 0.0
	if livre_corpo and _dir_joy.length() > 0.1:
		alvo_olhar = clamp(mov.ad(atan2(_dir_joy.x, _dir_joy.y), mov.ry) * 0.6, -0.7, 0.7)
	_olhar = lerp(_olhar, alvo_olhar, min(1.0, dt * 12.0))
	inclinar.olhar = _olhar
	inclinar.inclinacao = clamp(_incl, -0.32, 0.32)
	var freada: float = clamp(-_acel / mov.FREIA, 0.0, 1.0) if livre_corpo else 0.0
	# pouso: câmera e quadril afundam, poeira e som (mesmo correndo)
	if mov.pousou > 0.0:
		var q: float = mov.pousou
		mov.pousou = 0.0
		cam.afundar(0.05 + q * 0.12)
		_quadril = 0.04 + q * 0.08
		sons.tocar("pouso_forte" if q > 0.6 else "pouso", -6.0 + q * 5.0, 0.08)
		fx.fumaca_chao(heroi.position.x, heroi.position.z, 0.5 + q * 0.5, int(4 + q * 8), "9a948a", 0.6 + q * 0.6)
		if q > 0.6:
			vibrar(25)
	elif mov.chao and not estava_no_chao:
		sons.tocar("pouso", -10.0, 0.08)
	_quadril = move_toward(_quadril, 0.0, dt * 0.5)
	inclinar.afunda = _quadril + freada * 0.035
	# passos: um som a cada passada (mais longa correndo), só no chão
	if mov.chao and mov.esc == null and vel > 0.5:
		_passo_dist += vel * dt
		var passada: float = lerp(0.75, 1.45, clamp((vel - 1.8) / 3.6, 0.0, 1.0))
		if _passo_dist >= passada:
			_passo_dist = 0.0
			sons.tocar("passo", -14.0 + vel * 1.4, 0.12)
	else:
		_passo_dist = 0.6

# monstros não entram uns nos outros: 1,2 m entre os centros (raio de uns 0,6 m cada), como Simulacao.colidir
const SEPARACAO := 1.2
func separar_inimigos() -> void:
	for i in inimigos.size():
		var a: Dictionary = inimigos[i]
		if a.estado == "morto":
			continue
		for j in range(i + 1, inimigos.size()):
			var b: Dictionary = inimigos[j]
			if b.estado == "morto":
				continue
			var d := Vector2(b.no.position.x - a.no.position.x, b.no.position.z - a.no.position.z)
			var l := d.length()
			if l < SEPARACAO:
				var n := d / l if l > 0.001 else Vector2(1, 0)
				var empurra := (SEPARACAO - l) * 0.5
				a.no.position -= Vector3(n.x, 0, n.y) * empurra
				b.no.position += Vector3(n.x, 0, n.y) * empurra

# barra de vida do monstro: some quando ele está com a vida cheia e longe. Nome só do alvo atual (o mais perto, que o
# golpe pega sozinho) e de quem está em combate (levou ou deu dano nos últimos 5 s): três monstros juntos não encavalam
func barras_perto() -> void:
	var alvo = null
	var md := 12.0
	for e in inimigos:
		if e.estado != "morto":
			var d0: float = e.no.position.distance_to(heroi.position)
			if d0 < md:
				md = d0
				alvo = e
	for e in inimigos:
		if e.barra == null or e.estado == "morto":
			continue
		var d: float = e.no.position.distance_to(heroi.position)
		var v: bool = e.barra.scale.x < 0.999 or d < 9.0
		var nome: Node3D = e.barra.get_parent().get_child(e.barra.get_index() - 2)
		nome.visible = e == alvo or float(e.get("combate", 0.0)) > tempo
		if e.barra.visible != v:
			e.barra.visible = v
			e.barra.get_parent().get_child(e.barra.get_index() - 1).visible = v
	empilhar_nomes()

# dois ou mais monstros a menos de 1,5 m: os nomes empilham (18 px entre eles) em vez de se encavalar;
# o "Firme!" fica no lugar do nome enquanto dura (direção de arte)
const NOME_OFFSET := 52.0
const NOME_PASSO := (14.0 + 18.0) * 72.0 / 14.0 # letra de 14 px + 18 px de espaço, em unidades da fonte (72)
const NOME_PASSO_M := 0.42 # m que cada nome empilhado sobe (com a barra junto)
func empilhar_nomes() -> void:
	var lista := []
	for e in inimigos:
		if e.barra != null and e.estado != "morto":
			lista.append(e)
	if camera:
		lista.sort_custom(func(a, b): return a.no.global_position.distance_to(camera.global_position) < b.no.global_position.distance_to(camera.global_position))
	var feitos := []
	for e in lista:
		var nome: Label3D = e.barra.get_parent().get_child(e.barra.get_index() - 2)
		var k := 0
		for o in feitos:
			if Vector2(o.no.position.x - e.no.position.x, o.no.position.z - e.no.position.z).length() < 1.5:
				k += 1
		if nome.visible:
			feitos.append(e)
		# nome, fundo e barra sobem juntos (4 px entre nome e barra continuam iguais)
		var y_pilha: float = 1.95 + k * NOME_PASSO_M
		nome.position.y = y_pilha
		e.barra.position.y = y_pilha
		e.barra.get_parent().get_child(e.barra.get_index() - 1).position.y = y_pilha
		var c = combate._corpos.get(e.no)
		var firme_on: bool = c != null and c.firme_txt != null and is_instance_valid(c.firme_txt) and c.firme_txt.visible
		nome.modulate.a = 0.0 if firme_on else 1.0
		nome.outline_modulate.a = nome.modulate.a
		if firme_on:
			c.firme_txt.offset.y = nome.offset.y * 14.0 / 22.0
			c.firme_txt.position.y = nome.position.y

# Câmera não atravessa casa, telhado, pedra nem tronco: anda do herói até a câmera e para 0,2 m antes do que bater
# (copa de árvore deixa passar). Mesmas formas que o movimento usa (terreno.gd e obstáculos do mundo.json).
# sem_minerio: os veios de minério não puxam a câmera (André 2026-11-02: chegava perto e virava primeira pessoa)
func distancia_livre(de: Vector3, dir: Vector3, ate: float, sem_minerio := false) -> float:
	var t := 0.35
	while t <= ate:
		var p := de + dir * t
		if terreno.altura(p.x, p.z, p.y) > p.y - 0.25:
			return max(0.6, t - 0.2)
		for k in mundo.obstaculos:
			if p.y < float(k.get("alto", 4.0)) and Vector2(p.x - k.x, p.z - k.z).length() < float(k.r) + 0.2:
				return max(0.6, t - 0.2)
		if trabalho and not sem_minerio and trabalho.dentro_de_pedra(p):
			return max(0.6, t - 0.2)
		t += 0.2
	return ate

# inimigos não atravessam casas, pedras, árvores e o poço (como Simulacao.colidir no servidor)
func colidir_inimigo(no: Node3D) -> void:
	var p := no.position
	for lista in [mundo.obstaculos, mundo.rochasInimigo]:
		for k in lista:
			var dx: float = p.x - k.x
			var dz: float = p.z - k.z
			var d := sqrt(dx * dx + dz * dz)
			var mm: float = k.r + 0.35
			if d < mm and d > 0:
				p.x = k.x + dx / d * mm
				p.z = k.z + dz / d * mm
	for k in mundo.casasInimigo:
		var dx: float = p.x - k.x
		var dz: float = p.z - k.z
		var lx: float = dx * k.cos - dz * k.sin
		var lz: float = dx * k.sin + dz * k.cos
		var px: float = k.hw - abs(lx)
		var pz: float = k.hd - abs(lz)
		if px <= 0 or pz <= 0:
			continue
		var nx := lx
		var nz := lz
		if px < pz:
			nx = (1.0 if lx >= 0 else -1.0) * k.hw
		else:
			nz = (1.0 if lz >= 0 else -1.0) * k.hd
		p.x = k.x + nx * k.cos + nz * k.sin
		p.z = k.z - nx * k.sin + nz * k.cos
	var lim: Vector2 = mov.limitar_ao_mapa(p.x, p.z, 2.2) # não passa das pedras que fecham o mapa (como Simulacao.colidir)
	p.x = lim.x
	p.z = lim.y
	no.position = p

# ---------- campo de caça (regra do Quimera, igual a Simulacao.passoCacas do servidor) ----------
# sempre caca.n monstros: a cada caca.passo s, se falta algum (o corpo já sumiu), nasce um ao acaso no campo, longe
# do herói; o próximo vem em caca.rapido s com menos da metade vivos, senão em caca.normal s
var cacas: Array = []
func montar_cacas() -> void:
	for ci in mundo.get("caca", []).size():
		var c: Dictionary = mundo.caca[ci]
		var k := {"def": c, "vagas": [], "nx": 0.0, "t": 0.0}
		for i in c.tipos.size():
			var tipo := str(c.tipos[i])
			var e := criar_inimigo(MODELO_TIPO.get(tipo, "puglin"), ponto_caca(c, true), NOME_TIPO.get(tipo, "Inimigo"), 1.15 if tipo == "chefe" else 1.0)
			e.tipo = tipo
			e.vida_max = VIDA_INIMIGO.get(tipo, D.INIMIGO.vida)
			e.vida = e.vida_max
			e.caca = ci
			e.centro = e.no.position
			k.vagas.append(e)
		cacas.append(k)

# ponto ao acaso no campo (até caca.ate do raio), longe do herói e fora de árvore, pedra e veio
func ponto_caca(c: Dictionary, inicio := false):
	for t in 8:
		var a := randf() * TAU
		var r: float = sqrt(randf()) * float(c.r) * float(c.ate)
		var p := Vector3(float(c.x) + cos(a) * r, 0, float(c.z) + sin(a) * r)
		if not inicio and heroi and Vector2(p.x - heroi.position.x, p.z - heroi.position.z).length() < float(c.longe):
			continue
		var livre := true
		for k in mundo.obstaculos:
			if Vector2(p.x - float(k.x), p.z - float(k.z)).length() < float(k.r) + 0.8:
				livre = false
				break
		if livre:
			return p
	return null if not inicio else Vector3(float(c.x), 0, float(c.z))

func passo_cacas(dt: float) -> void:
	for k in cacas:
		var c: Dictionary = k.def
		k.t -= dt
		if k.t > 0.0:
			continue
		k.t = float(c.passo)
		var vivos := 0
		var vaga = null
		for e in k.vagas:
			if e.estado != "morto":
				vivos += 1
			elif vaga == null and tempo - e.get("morreu", 0.0) >= float(c.corpo):
				vaga = e
		if vaga == null or tempo < k.nx:
			continue
		var p = ponto_caca(c)
		if p == null:
			k.nx = tempo + float(c.rapido)
			continue
		k.nx = tempo + (float(c.rapido) if vivos < int(c.n) / 2.0 else float(c.normal))
		var e: Dictionary = vaga
		e.vida = e.vida_max
		e.estado = "vagar"
		e.no.position = p
		e.centro = p
		e.alvo = p
		e.barra.visible = true
		e.barra.scale.x = 1.0
		e.barra.get_parent().get_child(e.barra.get_index() - 1).visible = true
		e.anim.play("espada_parada", 0.2)
		combate.voltou(e.no)

# entrou no campo de caça ou na zona de mineração: aviso com o nome (como o Quimera: "Zona de caça: ...")
var _zona_atual := ""
func avisar_zona() -> void:
	var z := ""
	for c in mundo.get("caca", []):
		if Vector2(heroi.position.x - float(c.x), heroi.position.z - float(c.z)).length() < float(c.r):
			z = "Zona de caça: " + str(c.nome)
	for c in mundo.get("mina", []):
		if Vector2(heroi.position.x - float(c.x), heroi.position.z - float(c.z)).length() < float(c.r) + 1.0:
			z = "Mineração: " + str(c.nome)
	if z != _zona_atual:
		_zona_atual = z
		if z != "":
			hud.aviso(z)

func atualizar_inimigos(dt: float) -> void:
	passo_cacas(dt)
	for e in inimigos:
		colidir_inimigo(e.no)
	separar_inimigos()
	for e in inimigos:
		e.t -= dt
		e.cd -= dt
		var no: Node3D = e.no
		if e.puxao_t > 0.0: # puxado pelo vórtice
			e.puxao_t -= dt
			no.position += e.puxao * dt
		# atordoado ou congelado: fica parado (congelado até a animação para)
		if e.estado != "morto" and e.parado > tempo:
			continue
		if e.anim.speed_scale != 1.0:
			e.anim.speed_scale = 1.0
		match e.estado:
			"morto":
				if e.has("caca"): # campo de caça: quem volta é passo_cacas (outra vaga, outro lugar)
					continue
				if e.t <= 0.0:
					e.vida = e.vida_max
					e.estado = "vagar"
					no.position = e.centro
					e.barra.visible = true
					e.barra.scale.x = 1.0
					e.barra.get_parent().get_child(e.barra.get_index() - 1).visible = true
					e.anim.play("espada_parada", 0.2)
					combate.voltou(no)
				continue
			"apanhar":
				if e.t <= 0.0:
					e.estado = "perseguir"
				continue
		var ate: Vector3 = heroi.position - no.position
		ate.y = 0
		var d := ate.length()
		var dy: float = abs(heroi.position.y - no.position.y)
		if e.golpe >= 0.0: # corte em andamento: preparo devagar, depois acerta perto da metade (como no servidor)
			e.golpe += dt
			if e.get("preparo", 0.0) > 0.0 and e.golpe >= e.preparo: # fim do preparo: o golpe sai rápido
				e.preparo = 0.0
				var pos_a: float = e.anim.current_animation_position
				e.anim.play(e.anim.current_animation, 0.0, D.COMBATE.golpeTs)
				e.anim.seek(pos_a, true)
			if e.golpe > e.golpe_at and not e.get("acertou", false):
				e.acertou = true
				if h.morto <= 0.0 and mov.esc == null and d < 6.0 and (mov.arrancada != null or acao.get("nome", "") == "rolar"):
					h.contra_ate = tempo + D.COMBATE.contraDur # rolou ou deu dash na hora: esquiva e contra-ataque
					combate.esquiva(heroi)
				elif d < 2.4 and dy < 1.3 and h.morto <= 0.0 and mov.esc == null:
					ferir_heroi(D.INIMIGO.dmg)
					e.combate = tempo + 5.0
			if e.golpe > e.golpe_dur:
				e.golpe = -1.0
			continue
		if e.get("vez", false) and (h.morto > 0.0 or d > 5.0):
			e.vez = false
		# no máximo COMBATE.aoMesmoTempo batem juntos; os outros rodeiam a COMBATE.roda m esperando a vez
		var na_vez := 0
		for o in inimigos:
			if o != e and o.estado != "morto" and o.get("vez", false):
				na_vez += 1
		if h.morto <= 0.0 and not e.get("vez", false) and na_vez >= int(D.COMBATE.aoMesmoTempo) and d < D.COMBATE.roda + 1.2:
			no.rotation.y = lerp_angle(no.rotation.y, atan2(ate.x, ate.z), min(1.0, dt * 8.0))
			var lado_r: float = 1.0 if inimigos.find(e) % 2 == 1 else -1.0
			var lado_v := Vector3(ate.z, 0, -ate.x).normalized() * lado_r * D.COMBATE.rodaVel
			no.position += (lado_v + ate.normalized() * (d - D.COMBATE.roda) * 1.5) * dt
			if e.anim.current_animation != "andar":
				e.anim.play("andar", 0.15)
		elif h.morto <= 0.0 and d < D.INIMIGO.visao:
			no.rotation.y = lerp_angle(no.rotation.y, atan2(ate.x, ate.z), min(1.0, dt * 8.0))
			if d > D.INIMIGO.alcance or dy >= 1.3:
				if d > 1.2:
					var v: float = (D.INIMIGO.vel if d > 5.0 else 1.7) * ((1.0 - e.lento_k) if e.lento > tempo else 1.0)
					no.position += ate.normalized() * v * dt
					var a := "corrida" if d > 5.0 else "andar"
					if e.anim.current_animation != a:
						e.anim.play(a, 0.15)
				elif e.anim.current_animation != "espada_parada":
					e.anim.play("espada_parada", 0.2)
			elif e.cd <= 0.0:
				e.cd = D.INIMIGO.ataque_cd
				e.golpe = 0.0
				e.acertou = false
				e.vez = true
				# preparo: o braço vai para trás bem devagar e o corpo acende vermelho; depois o golpe sai rápido
				var g := "golpe1" if randf() < 0.5 else "golpe2"
				var C: Dictionary = D.COMBATE
				var pr: float = float(C.preparo.get(e.tipo, 0.5))
				var L: float = e.anim.get_animation(g).length
				e.preparo = pr
				e.golpe_at = pr + max(0.05, L * C.acerto - pr * C.preparoTs) / C.golpeTs
				e.golpe_dur = pr + max(0.1, L - pr * C.preparoTs) / C.golpeTs
				e.anim.play(g, 0.08, C.preparoTs)
				combate.preparo(no, pr)
				if randf() < 0.5:
					e.vez = false # passa a vez para quem está rodeando
			elif e.anim.current_animation != "espada_parada":
				e.anim.play("espada_parada", 0.2)
		else:
			# passeia perto de onde nasceu
			if e.t <= 0.0:
				e.t = randf_range(2.0, 5.0)
				e.alvo = e.centro + Vector3(randf_range(-3, 3), 0, randf_range(-3, 3))
			var ir: Vector3 = e.alvo - no.position
			ir.y = 0
			if ir.length() > 0.3:
				no.position += ir.normalized() * 1.2 * dt
				no.rotation.y = lerp_angle(no.rotation.y, atan2(ir.x, ir.z), min(1.0, dt * 6.0))
				if e.anim.current_animation != "andar":
					e.anim.play("andar", 0.2)
			elif e.anim.current_animation != "espada_parada":
				e.anim.play("espada_parada", 0.2)

func ferir_heroi(dmg: float) -> void:
	trabalho.combate()
	if trabalho.coletando != null:
		trabalho.parar(false)
	dmg = max(1.0, round(dmg * (1.0 - P.st.reducao)))
	if h.escudo > 0.0 and h.escudo_ate > tempo: # Escudo Arcano segura primeiro
		var seg: float = min(h.escudo, dmg)
		h.escudo -= seg
		dmg -= seg
		if h.escudo <= 0.0:
			fx.escudo_fim(heroi)
		if dmg <= 0.0:
			fx.numero(heroi.position, 0, Color(1, 0.9, 0.5))
			return
	h.vida -= dmg
	fx.numero(heroi.position, dmg, Color(1, 0.45, 0.4))
	apanhou()
	if acao.is_empty() and mov.esc == null and h.vida > 0.0: # a heroína sente o golpe (online vem do servidor igual)
		heroi_anim.play("apanhar", 0.05, 1.4)
	if h.vida <= 0.0:
		h.vida = 0.0
		h.morto = D.HEROI.renascer
		acao = {}
		heroi_anim.play("morrer", 0.1)
		hud.aviso("Você caiu! Voltando...")

# o herói levou dano: tranco na câmera, som e vibração (offline e online)
func apanhou() -> void:
	cam.tremer(0.45)
	hud.levou_dano()
	sons.tocar("apanhar", -2.0, 0.1)
	vibrar(60)

# ---------- teste de desempenho (botão Teste) ----------
func montar_teste() -> void:
	var tela := CanvasLayer.new()
	tela.layer = 2
	add_child(tela)
	rotulo = Label.new()
	rotulo.add_theme_font_size_override("font_size", 15)
	rotulo.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	rotulo.add_theme_constant_override("outline_size", 4)
	rotulo.anchor_left = 1.0
	rotulo.anchor_right = 1.0
	rotulo.offset_left = -330
	rotulo.offset_right = -14
	rotulo.offset_top = 124 # abaixo do botão Teste (o menu do topo fica no canto)
	rotulo.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	tela.add_child(rotulo)
	botao_teste = Button.new()
	botao_teste.text = "Teste"
	botao_teste.add_theme_font_size_override("font_size", 18)
	botao_teste.anchor_left = 1.0
	botao_teste.anchor_right = 1.0
	botao_teste.offset_left = -110
	botao_teste.offset_right = -14
	botao_teste.offset_top = 72 # abaixo do menu do topo
	botao_teste.offset_bottom = 114
	botao_teste.pressed.connect(comecar_teste)
	tela.add_child(botao_teste)
	etapas = [
		{"nome": "Normal (0.6x)", "f": func(): pass},
		{"nome": "Resolução cheia 1.0x", "f": func(): get_viewport().scaling_3d_scale = 1.0},
		{"nome": "Sem sombra", "f": func(): sol.shadow_enabled = false},
		{"nome": "Sem grama", "f": func(): grama.visible = false},
		{"nome": "20 personagens", "f": func(): mostrar_extras(true)},
	]

func mostrar_extras(v: bool) -> void:
	if v and extras.is_empty():
		for i in EXTRAS.size():
			var a := TAU * i / EXTRAS.size()
			var no := modelo(EXTRAS[i])
			no.position = Vector3(cos(a) * 10.0, 0, sin(a) * 10.0)
			var an: AnimationPlayer = no.find_child("AnimationPlayer", true, false)
			an.play("andar")
			extras.append(no)
	for no in extras:
		no.visible = v
		no.process_mode = Node.PROCESS_MODE_INHERIT if v else Node.PROCESS_MODE_DISABLED

func restaurar() -> void:
	get_viewport().scaling_3d_scale = RESOLUCAO_PADRAO
	sol.shadow_enabled = true
	grama.visible = true
	mostrar_extras(false)

func comecar_teste() -> void:
	resultados.clear()
	botao_teste.visible = false
	etapa = -1
	proxima_etapa()

func proxima_etapa() -> void:
	restaurar()
	etapa += 1
	if etapa >= etapas.size():
		etapa = -1
		botao_teste.visible = true
		return
	etapas[etapa].f.call()
	t_etapa = 0.0
	quadros = 0
	soma_proc = 0.0

func atualizar_teste(dt: float) -> void:
	var fps := Engine.get_frames_per_second()
	var txt := "%d FPS" % fps
	if online:
		txt += "\nefeitos %.1f ms · online %.1f ms · rede %.1f ms" % [fx.ms, online.ms, online.rede.ms]
	if etapa >= 0:
		var proc := Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0
		t_etapa += dt
		if t_etapa > ESPERA:
			quadros += 1
			soma_proc += proc
		txt += "\nTestando %d/%d: %s…" % [etapa + 1, etapas.size(), etapas[etapa].nome]
		if t_etapa >= ESPERA + MEDE:
			resultados.append("%s: %.0f FPS · %.1f ms" % [etapas[etapa].nome, quadros / MEDE, soma_proc / max(1, quadros)])
			proxima_etapa()
	if not resultados.is_empty():
		txt += "\n" + "\n".join(resultados)
	rotulo.text = txt

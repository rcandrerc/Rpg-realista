extends Node3D
# Vila da Clareira em Godot: mesma vila, mesmos personagens anime e as mesmas habilidades do jogo HTML (que fica de backup).
# Por enquanto tudo roda no aparelho (modo solo); o servidor Colyseus entra depois.

const D = preload("res://dados.gd")
const Hud = preload("res://hud.gd")
const Efeitos = preload("res://efeitos.gd")
const Terreno = preload("res://terreno.gd")
const Andar = preload("res://andar.gd")

const RAIO := 34.0
const RESOLUCAO_PADRAO := 0.6 # mesma nitidez do site (1.75x numa tela de ~904 pontos de largura)
const LACOS := ["parada", "andar", "corrida", "espada_parada", "queda", "parede_agarrado", "parede_beirada", "parede_balanca"]

const BANDO := [
	{"id": "cabelo_m", "x": 16.0, "z": 6.0}, {"id": "fumiriya", "x": 20.0, "z": -2.0},
	{"id": "cabelo_m", "x": 14.0, "z": 0.0}, {"id": "fumiriya", "x": 22.0, "z": 3.0},
]
const NPCS := [
	{"id": "fumiriya", "x": -6.0, "z": -18.6, "nome": "Aldo, o líder da vila"},
	{"id": "shino", "x": -12.0, "z": -8.0, "nome": "Lúcia"},
	{"id": "vivi", "x": 8.0, "z": -12.0, "nome": "Rosa"},
	{"id": "vita", "x": -4.0, "z": 9.0, "nome": "Bento"},
	{"id": "victoria", "x": 6.0, "z": 6.0, "nome": "Tomás, o ferreiro"},
]
const EXTRAS := ["shibu", "shibu_sombrio", "cabelo_m", "fumiriya", "shino", "vivi", "vita", "victoria", "cabelo_m", "fumiriya"]

var sol: DirectionalLight3D
var camera: Camera3D
var grama: MultiMeshInstance3D
var hud
var fx
var cache := {}
var armas_lugar := {} # por personagem: onde a espada e o cajado ficam presos (cada corpo tem a mão num jeito)
var mundo: Dictionary # dados/mundo.json: pedras, casas e regras de escalada (iguais às do servidor)
var terreno
var mov # andar.gd: como o herói anda, colide e escala
var _clip_visto := -1
var mascara: Image

# ---------- herói ----------
var heroi: Node3D
var heroi_anim: AnimationPlayer
var heroi_esq: Skeleton3D
var espada: Node3D
var cajado: Node3D
var mao_direita := -1
var h := {"vida": 120.0, "mana": 100.0, "vy": 0.0, "pulos": 0, "morto": 0.0, "modo": "Espada", "combo": 0, "combo_ate": 0.0,
	"dash": 0.0, "dash_dir": Vector3.ZERO, "segurando": false, "ultimo_basico": 0.0}
var acao := {} # o que o herói está fazendo agora (golpe, habilidade, rolamento...)
var recargas := {} # nome -> segundos que faltam
var build: Array = D.BUILD_PADRAO.duplicate()
var tempo := 0.0

# ---------- outros ----------
var inimigos: Array = []
var npcs: Array = []
var extras: Array = []

var yaw := 0.6
var pitch := 0.35
var dist := 5.2
var alvo_cam := Vector3.ZERO

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
	for mi in vila.find_children("*", "MeshInstance3D", true, false):
		if mi.get_aabb().size.x > 200.0: # o chão do site: troco pelo meu, com as trilhas
			mi.visible = false
	pintar(vila, false)
	montar_chao()
	montar_grama()
	fx = Efeitos.new()
	fx.mundo = self
	add_child(fx)
	criar_heroi()
	for b in BANDO:
		criar_inimigo(b.id, Vector3(b.x, 0, b.z))
	for n in NPCS:
		criar_npc(n.id, Vector3(n.x, 0, n.z), n.nome)
	camera = Camera3D.new()
	camera.fov = 52
	camera.far = 400
	add_child(camera)
	alvo_cam = heroi.position + Vector3(0, 1.35, 0)
	hud = Hud.new()
	add_child(hud)
	hud.apertou.connect(usar)
	hud.soltou.connect(func(a): if a == "basico": h.segurando = false)
	hud.nome = "Ruiva"
	mostrar_build()
	montar_teste()

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
	var i := int((x + 30.0) / 56.0 * mascara.get_width())
	var j := int((z + 34.0) / 56.0 * mascara.get_height())
	if i < 0 or j < 0 or i >= mascara.get_width() or j >= mascara.get_height():
		return 0.0
	var c := mascara.get_pixel(i, j)
	return max(c.r, c.g)

# Estilo pintado do site: sombra em degraus (toon), sem brilho de foto, contorno escuro nos personagens
var pintados := {}
func pintar(raiz: Node, personagem: bool, ruivo := false) -> void:
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
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
	mm.instance_count = 22000 # mesma quantidade do celular no site
	var rng := RandomNumberGenerator.new()
	for i in mm.instance_count:
		var a := 0.0
		var r := 0.0
		for k in 20: # não nasce nas trilhas, na praça nem colada nas casas
			a = rng.randf() * TAU
			r = sqrt(rng.randf()) * RAIO * 1.15
			if peso_vila(cos(a) * r, sin(a) * r) <= 0.2:
				break
		var s := rng.randf_range(0.7, 1.3)
		var b := Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s, s * rng.randf_range(0.6, 1.4), s))
		mm.set_instance_transform(i, Transform3D(b, Vector3(cos(a) * r, 0, sin(a) * r)))
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
	return ba

func nova_arma(nome: String) -> Node3D:
	var a: Node3D = load("res://modelos/arma_%s.glb" % nome).instantiate()
	for mi in a.find_children("*", "MeshInstance3D", true, false):
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	return a

func criar_heroi() -> void:
	heroi = modelo("ruiva")
	heroi.position = D.NASCIMENTO
	heroi_anim = heroi.find_child("AnimationPlayer", true, false)
	heroi_esq = esqueleto(heroi)
	mao_direita = heroi_esq.find_bone(armas_lugar.ruiva.espadaMao.osso)
	mov.por_em(D.NASCIMENTO)
	espada = nova_arma("espada")
	cajado = nova_arma("cajado")
	armar("Espada")

func armar(modo: String) -> void:
	# modo espada: espada na mão e cajado nas costas; modo magia: o contrário
	if modo != "Escalada":
		h.modo = modo
	var L: Dictionary = armas_lugar.ruiva
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

func criar_inimigo(id: String, pos: Vector3) -> Dictionary:
	var no := modelo(id)
	no.position = pos
	prender(esqueleto(no), nova_arma("espada"), armas_lugar[id].espadaMao)
	var e := {"no": no, "anim": no.find_child("AnimationPlayer", true, false), "vida": D.INIMIGO.vida, "centro": pos,
		"estado": "vagar", "t": randf() * 3.0, "alvo": pos, "cd": 0.0, "golpe": -1.0}
	e.barra = barra_vida(no, "Sombrio", Color(0.85, 0.25, 0.2))
	inimigos.append(e)
	return e

func criar_npc(id: String, pos: Vector3, nome: String) -> void:
	var no := modelo(id)
	no.position = pos
	no.rotation.y = randf() * TAU
	barra_vida(no, nome, Color(0, 0, 0, 0))
	npcs.append({"no": no})

# nome e barra de vida em cima da cabeça
func barra_vida(no: Node3D, nome: String, cor: Color) -> MeshInstance3D:
	var l := Label3D.new()
	l.text = nome
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.font_size = 44
	l.outline_size = 10
	l.pixel_size = 0.005
	l.modulate = Color(1, 0.93, 0.8)
	l.position = Vector3(0, 2.05, 0)
	no.add_child(l)
	if cor.a == 0:
		return null
	var fundo := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(0.8, 0.07)
	fundo.mesh = q
	var mf := StandardMaterial3D.new()
	mf.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mf.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	mf.billboard_keep_scale = true
	mf.albedo_color = Color(0, 0, 0, 0.6)
	mf.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	fundo.material_override = mf
	fundo.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	fundo.position = Vector3(0, 1.92, 0)
	no.add_child(fundo)
	var barra := MeshInstance3D.new()
	barra.mesh = q
	var mb: StandardMaterial3D = mf.duplicate()
	mb.albedo_color = cor
	mb.render_priority = 1
	barra.material_override = mb
	barra.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	barra.position = Vector3(0, 1.92, 0)
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

func ferir(e: Dictionary, dmg: float, de: Vector3) -> void:
	if e.estado == "morto":
		return
	dmg = round(dmg * randf_range(0.9, 1.1))
	e.vida -= dmg
	fx.numero(e.no.position, dmg, Color(1, 0.95, 0.6))
	e.barra.scale.x = max(0.001, e.vida / D.INIMIGO.vida)
	var empurra: Vector3 = (e.no.position - de)
	empurra.y = 0
	if empurra.length() > 0.01:
		e.no.position += empurra.normalized() * 0.25
	if e.vida <= 0:
		e.estado = "morto"
		e.t = D.INIMIGO.renascer
		e.anim.play("morrer", 0.1)
		e.barra.get_parent().get_child(e.barra.get_index() - 1).visible = false
		e.barra.visible = false
	else:
		e.estado = "apanhar"
		e.t = 0.45
		e.anim.play("apanhar", 0.05, 1.6)

func dano_area(pos: Vector3, raio: float, dmg: float, _quem) -> void:
	for e in inimigos.duplicate():
		if e.estado != "morto" and Vector2(e.no.position.x - pos.x, e.no.position.z - pos.z).length() < raio:
			ferir(e, dmg, pos)

func dano_arco(alcance: float, arco: float, dmg: float) -> void:
	var frente := Vector3(sin(heroi.rotation.y), 0, cos(heroi.rotation.y))
	for e in inimigos.duplicate():
		if e.estado == "morto":
			continue
		var d: Vector3 = e.no.position - heroi.position
		d.y = 0
		if d.length() < alcance + 0.4 and (d.length() < 0.6 or frente.angle_to(d) < arco * 0.5):
			ferir(e, dmg, heroi.position)

func virar_para_inimigo() -> void:
	var e = mais_perto(heroi.position, 8.0)
	if e:
		var d: Vector3 = e.no.position - heroi.position
		mov.ry = atan2(d.x, d.z)
		heroi.rotation.y = mov.ry

func frente() -> Vector3:
	return Vector3(sin(heroi.rotation.y), 0, cos(heroi.rotation.y))

func ponto_mao() -> Vector3:
	return heroi_esq.global_transform * heroi_esq.get_bone_global_pose(mao_direita).origin

func comecar(nome: String, ts: float, hits: Array, ao_acertar: Callable, extra := {}) -> void:
	var dur: float = heroi_anim.get_animation(nome).length / ts
	heroi_anim.play(nome, 0.08, ts)
	acao = {"nome": nome, "t": 0.0, "dur": dur, "hits": hits.duplicate(), "feitos": 0, "fn": ao_acertar}
	acao.merge(extra)

func pode_agir() -> bool:
	return h.morto <= 0.0 and acao.is_empty() and mov.esc == null

func usar(qual: String) -> void:
	if h.morto > 0.0:
		return
	match qual:
		"basico":
			h.segurando = true
			basico()
		"troca":
			armar("Magia" if h.modo == "Espada" else "Espada")
			mostrar_build()
			hud.aviso("Modo espada" if h.modo == "Espada" else "Modo magia")
		"cura":
			if not pode_agir() or recargas.get("cura", 0.0) > 0.0 or h.mana < D.CURA.mana:
				return
			h.mana -= D.CURA.mana
			recargas["cura"] = D.CURA.cd
			fx.circulo(heroi.position, Color("7dffa0"), 1.6)
			comecar(D.CURA.anim, D.CURA.ts, D.CURA.hits, func(_i):
				h.vida = min(D.HEROI.vida, h.vida + D.CURA.cura)
				fx.cura(heroi)
				fx.numero(heroi.position, D.CURA.cura, Color("7dffa0")))
		"pular":
			if not acao.is_empty() and not acao.get("pulo", false):
				return
			var p: String = mov.pular()
			if p != "":
				acao = {}
				heroi_anim.play(p, 0.06, 1.2)
		"dash":
			if recargas.get("dash", 0.0) > 0.0 or not acao.is_empty() or mov.esc != null:
				return
			var dir := direcao_joystick()
			var na_parede: bool = mov.dash(dir.x, dir.z)
			if mov.esc == null and mov.arrancada == null:
				return
			recargas["dash"] = D.MOVIMENTO.dash_cd
			if not na_parede:
				fx._faiscas(heroi.position + Vector3(0, 0.6, 0), Color("bfe6ff"), 12, 2.0, 0.35)
		"rolar":
			if not pode_agir() or recargas.get("rolar", 0.0) > 0.0 or not mov.chao:
				return
			recargas["rolar"] = D.HEROI.rolar_cd
			var dir := direcao_joystick()
			if dir.length() > 0.1:
				mov.ry = atan2(dir.x, dir.z)
			comecar("rolar", 1.15, [], func(_i): pass, {"anda": 6.0})
		_:
			if qual.begins_with("hab"):
				habilidade(int(qual.substr(3)))

func basico() -> void:
	if h.morto > 0.0:
		return
	# emenda o próximo golpe do combo no fim do atual
	if not acao.is_empty():
		if acao.get("basico", false) and acao.t > acao.dur * 0.7:
			acao = {}
		else:
			return
	h.ultimo_basico = tempo
	virar_para_inimigo()
	if h.modo == "Espada":
		var combo: Array = D.BASICO.combo
		var i: int = h.combo if tempo < h.combo_ate else 0
		var g: Dictionary = combo[i]
		h.combo = (i + 1) % combo.size()
		comecar(g.anim, g.ts, [g.at], func(_k):
			dano_arco(D.BASICO.alcance, D.BASICO.arco, g.dmg)
			fx.corte(heroi.position, heroi.rotation.y, Color("8fd8ff"), 1.5), {"basico": true})
		h.combo_ate = tempo + acao.dur + 0.6
	else:
		var combo: Array = D.BASICO_MAGIA.combo
		var i: int = h.combo if tempo < h.combo_ate else 0
		i = i % combo.size()
		var g: Dictionary = combo[i]
		h.combo = (i + 1) % combo.size()
		comecar(g.anim, g.ts, [g.at], func(_k):
			fx.projetil(ponto_mao(), mira(), D.BASICO_MAGIA.proj, g.dmg, 18.0), {"basico": true})
		h.combo_ate = tempo + acao.dur + 0.6

func mira() -> Vector3:
	var e = mais_perto(heroi.position, 18.0)
	if e:
		var d: Vector3 = (e.no.position + Vector3(0, 1.0, 0)) - ponto_mao()
		return d.normalized()
	return frente()

func habilidade(i: int) -> void:
	var k: String = build[i if h.modo == "Espada" else 4 + i]
	var hab: Dictionary = D.HABILIDADES[k]
	if not pode_agir() or recargas.get(k, 0.0) > 0.0 or h.mana < hab.get("mana", 0):
		if recargas.get(k, 0.0) <= 0.0 and h.mana < hab.get("mana", 0):
			hud.aviso("Sem mana")
		return
	h.mana -= hab.get("mana", 0)
	recargas[k] = hab.cd
	virar_para_inimigo()
	var cor_magia := Color("ffb060") if hab.tipo == "Magia" else Color("8fd8ff")
	var extra := {}
	if hab.has("avanco"):
		extra = {"avanco": hab.avanco, "avanco_t": hab.get("avanco_t", 0.5)}
	var dur_aprox: float = heroi_anim.get_animation(hab.anim).length / hab.ts
	fx.circulo(heroi.position, cor_magia, dur_aprox, 3.2 if hab.tipo == "Magia" else 2.6)
	comecar(hab.anim, hab.ts, hab.hits, func(n: int): efeito(k, hab, n), extra)

func efeito(k: String, hab: Dictionary, n: int) -> void:
	match k:
		"investida", "relampago":
			dano_arco(hab.alcance, hab.arco, hab.dmg)
			fx.corte(heroi.position, heroi.rotation.y, Color("bfe9ff") if k == "relampago" else Color("8fd8ff"), 1.7)
			if k == "relampago" and n == hab.hits.size() - 1:
				fx.raio(heroi.position + frente() * 1.6)
		"giro":
			dano_area(heroi.position, hab.area, hab.dmg, heroi)
			fx.anel(heroi.position, Color("8fd8ff"), hab.area, 0.45)
			fx.corte(heroi.position, heroi.rotation.y + n * 1.5, Color("8fd8ff"), 2.4)
		"salto":
			var p := heroi.position + frente() * 0.8
			dano_area(p, hab.area, hab.dmg, heroi)
			fx.explosao(p, Color("ffd27a"), hab.area * 0.7)
		"bola":
			fx.projetil(ponto_mao(), mira(), hab.proj, hab.dmg, 20.0)
		"raio":
			var alvos := []
			for e in inimigos:
				if e.estado != "morto" and e.no.position.distance_to(heroi.position) < hab.alcance:
					alvos.append(e)
			alvos.sort_custom(func(a, b): return a.no.position.distance_to(heroi.position) < b.no.position.distance_to(heroi.position))
			for j in min(hab.raios, alvos.size()):
				fx.raio(alvos[j].no.position)
				ferir(alvos[j], hab.dmg, alvos[j].no.position)
			if alvos.is_empty():
				fx.raio(heroi.position + frente() * 5.0)
		"explosao":
			dano_area(heroi.position, hab.area, hab.dmg, heroi)
			fx.explosao(heroi.position, Color("ff8a3a"), hab.area)
		"meteoros":
			var e = mais_perto(heroi.position, 16.0)
			var centro: Vector3 = e.no.position if e else heroi.position + frente() * 6.0
			for onda in hab.chuva.ondas:
				get_tree().create_timer(onda * 0.3).timeout.connect(func():
					var alvo := centro + Vector3(randf_range(-1.5, 1.5), 0, randf_range(-1.5, 1.5))
					fx.meteoro(alvo, func(p: Vector3): dano_area(p, hab.chuva.r * 0.6, hab.chuva.dmg, heroi)))

func mostrar_build() -> void:
	var ini := 0 if h.modo == "Espada" else 4
	hud.mostrar_build(build.slice(ini, ini + 4), h.modo)

func direcao_joystick() -> Vector3:
	var m: Vector2 = hud.mover
	if m.length() < 0.15:
		return Vector3.ZERO
	return Vector3(m.x, 0, m.y).rotated(Vector3.UP, yaw)

# ---------- quadro a quadro ----------
func _process(dt: float) -> void:
	tempo += dt
	for k in recargas.keys():
		recargas[k] = max(0.0, recargas[k] - dt)
	atualizar_heroi(dt)
	atualizar_inimigos(dt)
	# câmera em volta do herói (arrastar o dedo do lado direito gira)
	var g: Vector2 = hud.giro_cam
	hud.giro_cam = Vector2.ZERO
	yaw -= g.x * 0.006
	pitch = clamp(pitch + g.y * 0.004, -0.3, 1.1)
	var alvo := heroi.position + Vector3(0, 1.35, 0)
	alvo_cam = alvo_cam.lerp(alvo, min(1.0, dt * 7.0))
	camera.position = alvo_cam + Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * dist
	camera.look_at(alvo_cam)
	# HUD
	hud.vida = h.vida / D.HEROI.vida
	hud.mana = h.mana / D.HEROI.mana
	hud.texto_vida = "%d/%d" % [ceil(h.vida), D.HEROI.vida]
	hud.texto_mana = "%d/%d" % [floor(h.mana), D.HEROI.mana]
	var ini := 0 if h.modo == "Espada" else 4
	for i in 4:
		var k: String = build[ini + i]
		hud.recarga("hab%d" % i, recargas.get(k, 0.0), D.HABILIDADES[k].cd)
	hud.recarga("cura", recargas.get("cura", 0.0), D.CURA.cd)
	hud.recarga("dash", recargas.get("dash", 0.0), D.MOVIMENTO.dash_cd)
	hud.recarga("rolar", recargas.get("rolar", 0.0), D.HEROI.rolar_cd)
	atualizar_teste(dt)

func atualizar_heroi(dt: float) -> void:
	if h.morto > 0.0:
		h.morto -= dt
		if h.morto <= 0.0:
			h.vida = D.HEROI.vida
			h.mana = D.HEROI.mana
			mov.por_em(D.NASCIMENTO)
			heroi.position = mov.posicao()
			heroi_anim.play("parada", 0.2)
		return
	h.mana = min(D.HEROI.mana, h.mana + D.HEROI.mana_por_seg * dt)
	if h.segurando and tempo - h.ultimo_basico > 0.2:
		basico()
	var dir := direcao_joystick()
	var forca: float = hud.mover.length()
	mov.outros.clear()
	for e in inimigos:
		if e.estado != "morto":
			mov.outros.append(e.no.position)
	for n in npcs:
		mov.outros.append(n.no.position)
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
	mov.passo(dt, dir.x, dir.z, forca >= 0.55, acao.is_empty() or acao.get("pulo", false))
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
		if mov.arrancada != null:
			a = "corrida"
		elif mov.mortal > 0.0:
			a = "mortal"
		elif not mov.chao:
			a = "pulo" if mov.pulos == 1 and mov.vy > 0 and mov.pulo_t < 0.45 else "queda"
		elif mov.pouso > 0.0 and dir.length() < 0.15:
			a = "pouso"
		elif dir.length() > 0.15:
			a = "corrida" if forca >= 0.55 else "andar"
		else:
			a = "parada" if h.modo == "Magia" else "espada_parada"
		if not estava_no_chao and mov.chao and a != "pouso":
			pass
		if heroi_anim.current_animation != a and heroi_anim.has_animation(a):
			heroi_anim.play(a, 0.15)
	# cajado na mão (modo magia): segue a mão e fica de pé, um pouco inclinado
	if h.modo == "Magia" and mov.esc == null:
		var mao := ponto_mao()
		cajado.global_transform = Transform3D(heroi.global_transform.basis * Basis.from_euler(Vector3(0.18, 0, -0.08)), mao)
	sol.global_position = heroi.position

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
	no.position = p

func atualizar_inimigos(dt: float) -> void:
	for e in inimigos:
		colidir_inimigo(e.no)
	for e in inimigos:
		e.t -= dt
		e.cd -= dt
		var no: Node3D = e.no
		match e.estado:
			"morto":
				if e.t <= 0.0:
					e.vida = D.INIMIGO.vida
					e.estado = "vagar"
					no.position = e.centro
					e.barra.visible = true
					e.barra.scale.x = 1.0
					e.barra.get_parent().get_child(e.barra.get_index() - 1).visible = true
					e.anim.play("espada_parada", 0.2)
				continue
			"apanhar":
				if e.t <= 0.0:
					e.estado = "perseguir"
				continue
		var ate: Vector3 = heroi.position - no.position
		ate.y = 0
		var d := ate.length()
		var dy: float = abs(heroi.position.y - no.position.y)
		if e.golpe >= 0.0: # corte em andamento: acerta perto da metade (como no servidor: 45% da animação)
			e.golpe += dt
			if e.golpe > e.golpe_at and not e.get("acertou", false):
				e.acertou = true
				if d < 2.4 and dy < 1.3 and h.morto <= 0.0 and mov.arrancada == null and mov.esc == null and acao.get("nome", "") != "rolar":
					ferir_heroi(D.INIMIGO.dmg)
			if e.golpe > e.golpe_dur:
				e.golpe = -1.0
			continue
		if h.morto <= 0.0 and d < D.INIMIGO.visao:
			no.rotation.y = lerp_angle(no.rotation.y, atan2(ate.x, ate.z), min(1.0, dt * 8.0))
			if d > D.INIMIGO.alcance or dy >= 1.3:
				if d > 1.2:
					var v: float = D.INIMIGO.vel if d > 5.0 else 1.7
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
				var g := "golpe1" if randf() < 0.5 else "golpe2"
				e.golpe_dur = e.anim.get_animation(g).length / 1.1
				e.golpe_at = e.golpe_dur * 0.45
				e.anim.play(g, 0.08, 1.1)
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
	h.vida -= dmg
	fx.numero(heroi.position, dmg, Color(1, 0.45, 0.4))
	if h.vida <= 0.0:
		h.vida = 0.0
		h.morto = D.HEROI.renascer
		acao = {}
		heroi_anim.play("morrer", 0.1)
		hud.aviso("Você caiu! Voltando...")

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
	rotulo.offset_top = 64
	rotulo.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	tela.add_child(rotulo)
	botao_teste = Button.new()
	botao_teste.text = "Teste"
	botao_teste.add_theme_font_size_override("font_size", 18)
	botao_teste.anchor_left = 1.0
	botao_teste.anchor_right = 1.0
	botao_teste.offset_left = -110
	botao_teste.offset_right = -14
	botao_teste.offset_top = 14
	botao_teste.offset_bottom = 56
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
	if etapa >= 0:
		var proc := Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0
		t_etapa += dt
		if t_etapa > ESPERA:
			quadros += 1
			soma_proc += proc
		txt += "\nTestando %d/%d: %s…" % [etapa + 1, etapas.size(), etapas[etapa].nome]
		if t_etapa >= ESPERA + MEDE:
			resultados.append("%s: %.0f FPS" % [etapas[etapa].nome, quadros / MEDE])
			proxima_etapa()
	if not resultados.is_empty():
		txt += "\n" + "\n".join(resultados)
	rotulo.text = txt

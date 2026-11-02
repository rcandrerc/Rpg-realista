extends Node3D
# Parte 3 do Quimera: estamina (a barra amarela), vigor e profissões (Minerador, Lenhador, Ferreiro, Alfaiate, Mercador).
# Quem decide é o servidor (shared/simulacao.js): a estamina corre aqui junto para o herói responder na hora e acerta
# pelo valor que o servidor manda; os veios são desenhados aqui; o botão Coletar e o menu Criar só mandam o pedido.
# Números e receitas: dados/habilidades.json (shared/dados.js ESTAMINA, VIGOR, PROFISSOES, COLETA, RECEITAS).

var m # main.gd
var E: Dictionary # estamina
var sta := 67.0
var sta_t := 0.0 # s até a estamina voltar a encher
var sem_folego := false
var seguida := {"k": 1.0, "t": -9.0}
var combate_ate := -9.0
var coletaveis: Array = [] # {id, tipo, pos, r, no (veio), minerio (pedaços que somem esgotado), cargas, volta_ate}
var por_id := {}
var coletando = null # {c, dur, t, n (golpes dados), prof}
var ferramentas := {} # "min" -> picareta, "len" -> machado
var perto = null # coletável mais perto (para o botão)
var _veio_malha: Mesh
var _veio_mat: Material

const COR_MINERIO := {"ferro": Color(0.34, 0.38, 0.45), "cobre": Color(0.72, 0.36, 0.16), "cristal": Color(0.32, 0.72, 0.95)}

func _init(principal) -> void:
	m = principal
	E = m.P.dados.estamina

func _ready() -> void:
	sta = sta_max()
	_achar_pedra()
	for c in m.mundo.get("coletaveis", []):
		var o := {"id": str(c.id), "tipo": str(c.tipo), "pos": Vector3(float(c.x), 0, float(c.z)), "r": float(c.r), "cargas": -1, "volta_ate": -1.0}
		o.pos.y = m.terreno.altura(o.pos.x, o.pos.z)
		if o.tipo != "arvore":
			_montar_veio(o, float(c.get("ry", 0.0)))
		coletaveis.append(o)
		por_id[o.id] = o
	ferramentas["min"] = _ferramenta("res://ferramentas3d/Pickaxe_Bronze.gltf")
	ferramentas["len"] = _ferramenta("res://ferramentas3d/Axe_Bronze.gltf")

# ---------- estamina ----------
func sta_max() -> float:
	return float(m.P.st.get("estaminaMax", 67))

func em_combate() -> bool:
	return m.tempo < combate_ate

func combate() -> void:
	combate_ate = m.tempo + float(E.combate)

func _seguida_k() -> float:
	if m.tempo - seguida.t < float(E.seguidaJanela):
		return min(float(E.seguidaMax), seguida.k + float(E.seguidaK))
	return 1.0

func pode(n: float) -> bool:
	return sta >= n * _seguida_k()

# dash, rolamento, mortal: gasto de uma vez, mais caro se seguido (igual ao servidor)
func gastar(n: float) -> bool:
	var k := _seguida_k()
	if sta < n * k:
		m.hud.aviso("Sem fôlego!")
		return false
	seguida = {"k": k, "t": m.tempo}
	sta -= n * k
	sta_t = max(sta_t, float(E.espera))
	return true

func passo_estamina(dt: float) -> void:
	var mx := sta_max()
	sta = min(sta, mx)
	var trote: float = float(m.P.dados.heroiCorrer) * float(E.trote)
	var mov = m.mov
	var correndo: bool = mov.chao and mov.arrancada == null and mov.esc == null and m.h.lunge == null and mov.velocidade() > trote * 1.12
	if correndo:
		var c := em_combate()
		sta = max(0.0, sta - float(E.correr) * (float(E.combateK) if c else 1.0) * dt)
		sta_t = max(sta_t, float(E.esperaCombate) if c else float(E.espera))
		if sta <= 0.0 and not sem_folego:
			sem_folego = true
			m.hud.aviso("Sem fôlego!")
	elif sta_t > 0.0:
		sta_t -= dt
	else:
		sta = min(mx, sta + mx * float(E.volta) * (float(E.voltaCombate) if em_combate() else 1.0) * dt)
	if sem_folego and sta >= mx * float(E.folego):
		sem_folego = false
	mov.vel_max = trote if sem_folego else 99.0

# o servidor manda a estamina dele 20 vezes por segundo: aqui só acerta quando os dois se perdem
func do_servidor(v: float) -> void:
	if abs(v - sta) > 8.0 or (v <= 0.5 and sta > 3.0):
		sta = v

# ---------- veios e árvores ----------
# a pedra dos veios é a mesma das rochas de musgo da vila (Poly Haven), já pintada no estilo do jogo
func _achar_pedra() -> void:
	var no = m.vila_no.find_child("rock_moss_set_01_rock02", true, false) if m.vila_no else null
	if no == null:
		return
	var mi: MeshInstance3D = no if no is MeshInstance3D else no.find_children("*", "MeshInstance3D", true, false)[0]
	_veio_malha = mi.mesh
	_veio_mat = mi.get_active_material(0)

func _montar_veio(o: Dictionary, ry: float) -> void:
	var raiz := Node3D.new()
	raiz.position = o.pos
	raiz.rotation.y = ry
	add_child(raiz)
	o.no = raiz
	var rnd := RandomNumberGenerator.new()
	rnd.seed = hash(o.id)
	var cor: Color = COR_MINERIO.get(o.tipo, Color.GRAY)
	var alto_pedra := 1.0
	if _veio_malha:
		var pedra := MeshInstance3D.new()
		pedra.mesh = _veio_malha
		if _veio_mat:
			var pm: StandardMaterial3D = _veio_mat.duplicate()
			pm.albedo_color = pm.albedo_color * Color(0.78, 0.76, 0.74) # um pouco mais escura que as rochas da vila: o minério aparece
			pedra.material_override = pm
		var aabb: AABB = _veio_malha.get_aabb()
		var k: float = 2.1 / max(0.01, max(aabb.size.x, aabb.size.z)) # uns 2 m de largura
		pedra.scale = Vector3(k, k, k)
		pedra.position = Vector3(-aabb.get_center().x * k, -aabb.position.y * k - 0.15, -aabb.get_center().z * k)
		alto_pedra = aabb.size.y * k - 0.15
		raiz.add_child(pedra)
	# minério cravado na pedra (some quando o veio esgota para você): pepitas de metal ou cristais pontudos
	var mat := StandardMaterial3D.new()
	mat.albedo_color = cor
	mat.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	mat.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	mat.roughness = 1.0
	mat.rim_enabled = true
	mat.rim = 0.6
	mat.rim_tint = 0.2
	mat.emission_enabled = true
	mat.emission = cor
	mat.emission_energy_multiplier = 0.45 if o.tipo == "cristal" else 0.0
	var minerio := Node3D.new()
	raiz.add_child(minerio)
	o.minerio = minerio
	if o.tipo == "cristal":
		for i in 7:
			var p := MeshInstance3D.new()
			var cone := CylinderMesh.new()
			cone.radial_segments = 6
			cone.rings = 1
			cone.height = rnd.randf_range(0.45, 0.85) * (1.25 if i == 0 else 1.0)
			cone.bottom_radius = rnd.randf_range(0.09, 0.14)
			cone.top_radius = 0.0
			p.mesh = cone
			p.material_override = mat
			var a := rnd.randf() * TAU
			var d := 0.0 if i == 0 else rnd.randf_range(0.25, 0.6)
			p.position = Vector3(cos(a) * d, alto_pedra * (0.85 - d * 0.5) + cone.height * 0.3, sin(a) * d)
			# inclinado para fora, como um cacho de cristal saindo da pedra
			p.rotation_order = EULER_ORDER_YXZ
			p.rotation = Vector3(0.0 if i == 0 else rnd.randf_range(0.35, 0.8), -a + PI / 2, 0)
			p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			minerio.add_child(p)
		var luz := OmniLight3D.new()
		luz.light_color = cor
		luz.light_energy = 0.8
		luz.omni_range = 3.5
		luz.position = Vector3(0, alto_pedra + 0.4, 0)
		minerio.add_child(luz)
	elif _veio_malha:
		# uma faixa de pepitas atravessando a pedra (o veio)
		var aabb: AABB = _veio_malha.get_aabb()
		var a0 := rnd.randf() * TAU
		for i in 11:
			var p := MeshInstance3D.new()
			p.mesh = _veio_malha
			p.material_override = mat
			var t: float = (i / 10.0) * 2.0 - 1.0
			var a: float = a0 + t * 1.3 + rnd.randf_range(-0.15, 0.15)
			var d: float = rnd.randf_range(0.55, 0.85)
			var y: float = alto_pedra * (0.35 + 0.45 * (1.0 - abs(t))) + rnd.randf_range(-0.08, 0.08)
			var tam: float = rnd.randf_range(0.2, 0.32) / max(0.01, max(aabb.size.x, aabb.size.z))
			p.scale = Vector3.ONE * tam
			p.position = Vector3(cos(a) * d, y, sin(a) * d)
			p.rotation = Vector3(rnd.randf() * TAU, rnd.randf() * TAU, rnd.randf() * TAU)
			p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			minerio.add_child(p)

func _ferramenta(caminho: String) -> Node3D:
	var cena = load(caminho)
	var raiz := Node3D.new()
	if cena:
		var f: Node3D = cena.instantiate()
		raiz.add_child(f)
		f.position = Vector3(0, 0.36, 0) # o cabo na mão: a ferramenta sai para cima da mão como a espada
		f.scale = Vector3.ONE * 0.8
		for mi in f.find_children("*", "MeshInstance3D", true, false):
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	raiz.visible = false
	m.add_child(raiz)
	return raiz

func esgotado(o: Dictionary) -> bool:
	return o.cargas == 0 and o.volta_ate > m.tempo

# ---------- quadro a quadro ----------
func _process(dt: float) -> void:
	if m.heroi == null:
		return
	# veio que voltou: o minério aparece de novo
	for o in coletaveis:
		if o.has("minerio") and not o.minerio.visible and not esgotado(o):
			o.minerio.visible = true
			o.cargas = -1
	# o mais perto que dá para coletar (o botão aparece)
	perto = null
	if m.h.morto <= 0.0 and m.mov.esc == null:
		var md: float = float(m.P.dados.coletaDistancia) - 0.25
		for o in coletaveis:
			var d: float = Vector2(o.pos.x - m.heroi.position.x, o.pos.z - m.heroi.position.z).length() - o.r
			if d < md and not esgotado(o) and abs(o.pos.y - m.heroi.position.y) < 1.5:
				md = d
				perto = o
	if coletando != null:
		_passo_coleta(dt)
	var ic := "pf_min" if perto != null and perto.tipo != "arvore" else "pf_len"
	if coletando != null:
		ic = "pf_" + coletando.prof
	m.hud.mostrar_botao("coletar", perto != null or coletando != null)
	m.hud.icone_botao("coletar", ic)
	m.hud.mostrar_botao("forja", perto_oficina("fer") and m.h.morto <= 0.0)

# perto da oficina (forja do Tomás ou banca da Rosa)? O servidor confere a mesma distância.
func perto_oficina(prof: String) -> bool:
	var of: Dictionary = m.P.dados.oficina[prof]
	for n in m.npcs:
		if n.id == str(of.npc) and Vector2(n.no.position.x - m.heroi.position.x, n.no.position.z - m.heroi.position.z).length() < float(m.P.dados.oficinaDistancia) - 0.3:
			return true
	return false

# botão Coletar: começa (o servidor confere e manda "coleta") ou para
func tocar_botao() -> void:
	if coletando != null:
		parar(true)
		return
	if perto == null:
		return
	if not m.on():
		m.hud.aviso("A coleta só funciona online (o que você coleta fica na sua conta)")
		return
	if m.P.vigor() < m.P.custo_vigor(str(m.P.dados.coleta[perto.tipo].prof), float(m.P.dados.coleta[perto.tipo].vigor)):
		m.hud.aviso("Sem vigor: ele volta sozinho com o tempo (cheio a cada 6 h)")
		return
	m.rede("coletar", {"no": perto.id})

# o servidor começou uma batida (vem uma por batida; a coleta continua sozinha)
func comecou(no_id: String, dur: float, prof: String) -> void:
	var o = por_id.get(no_id)
	if o == null:
		return
	if coletando == null or coletando.c != o:
		coletando = {"c": o, "dur": dur, "t": 0.0, "n": -1, "prof": prof}
		m.acao = {"nome": "coleta", "t": 0.0, "dur": 1e9, "hits": [], "feitos": 0, "fn": func(_i): pass}
		m.h.pend = null
		_segurar_ferramenta(prof)
	else:
		coletando.dur = dur
		coletando.t = 0.0
		coletando.n = -1
	var d: Vector3 = o.pos - m.heroi.position
	m.mov.ry = atan2(d.x, d.z)
	m.mov.ry_mira = null
	m.heroi.rotation.y = m.mov.ry

func _passo_coleta(dt: float) -> void:
	var o: Dictionary = coletando.c
	# joystick, golpe ou outra ação: para (o servidor também para quando o herói sai do lugar)
	if m.acao.get("nome", "") != "coleta" or m.hud.mover.length() > 0.35 or m.h.morto > 0.0:
		parar(true)
		return
	coletando.t += dt
	# dois golpes por batida: picareta de cima para baixo, machado de lado
	var meio: float = coletando.dur / 2.0
	var n := int(coletando.t / meio)
	if n != coletando.n and n < 2:
		coletando.n = n
		var anim := "descendente" if coletando.prof == "min" else ("golpe1" if m.heroi_anim.has_animation("golpe1") else "cruzado")
		if m.heroi_anim.has_animation(anim):
			var vel: float = m.heroi_anim.get_animation(anim).length / meio
			m.heroi_anim.play(anim, 0.1, vel)
			m.heroi_anim.seek(0.0, true)
		coletando["bateu"] = false
	# o golpe encosta na pedra (ou no tronco) perto da metade do movimento
	var f: float = fmod(coletando.t, meio) / meio
	if not coletando.get("bateu", true) and f >= 0.5:
		coletando.bateu = true
		_impacto(o)

func _impacto(o: Dictionary) -> void:
	var d: Vector3 = (o.pos - m.heroi.position)
	d.y = 0
	var p: Vector3 = m.heroi.position + d.normalized() * max(0.3, d.length() - o.r * 0.8) + Vector3(0, 0.55 if o.tipo != "arvore" else 0.9, 0)
	var fx = m.fx
	if o.tipo == "arvore":
		m.sons.tocar("lenha", -4.0, 0.08, p)
		fx.poeira(p.x, p.z, 0.35, 6, "d8b27a", "8a6a44")
	else:
		m.sons.tocar("minerar", -3.0, 0.08, p)
		var c: Color = COR_MINERIO.get(o.tipo, Color.GRAY)
		fx.surto(p.x, p.y, p.z, 12, "ffe0a0", c.to_html(false), 4.0, 0.06)
		fx.poeira(p.x, p.z, 0.4, 5, "8a8070", "b0a898")
	m.cam.tremer(0.06)

# o servidor mandou o que saiu da batida
func coletou(ev: Dictionary) -> void:
	var o = por_id.get(str(ev.no))
	if o == null:
		return
	o.cargas = int(ev.get("cargas", 0))
	o.volta_ate = m.tempo + float(ev.get("volta", 60))
	if o.cargas == 0 and o.has("minerio"):
		o.minerio.visible = false
	var itens: Array = ev.get("itens", [])
	for i in itens.size():
		var it: Dictionary = itens[i]
		m.fx.texto(m.heroi.position + Vector3(0, 0.35 + 0.34 * i, 0), "+%d %s" % [int(it.n), str(it.nome)], Color("e8d6a8"), 0.1 * i)

# parou (o servidor mandou "coletaFim", ou o joystick aqui): ferramenta volta para a bolsa, arma volta para a mão
func parar(avisar_servidor := false) -> void:
	if coletando == null:
		return
	coletando = null
	if avisar_servidor:
		m.rede("coletar", {"no": "", "parar": true})
	if m.acao.get("nome", "") == "coleta":
		m.acao = {}
	for k in ferramentas:
		ferramentas[k].visible = false
		if ferramentas[k].get_parent() != m:
			ferramentas[k].get_parent().remove_child(ferramentas[k])
			m.add_child(ferramentas[k])
	m.armar(m.h.modo)
	m.espada.visible = true
	m.cajado.visible = true

func _segurar_ferramenta(prof: String) -> void:
	var f: Node3D = ferramentas.get(prof)
	if f == null:
		return
	var L: Dictionary = m.armas_lugar.ruiva
	m.armar("Escalada") # as duas armas nas costas
	m.prender(m.heroi_esq, f, L.espadaMao)
	f.visible = true

# criou uma peça na oficina: faíscas na bigorna (ou linha na banca da Rosa) e o som
func criou(ev: Dictionary) -> void:
	var x := float(ev.get("x", m.heroi.position.x))
	var z := float(ev.get("z", m.heroi.position.z))
	var p := Vector3(x, m.terreno.altura(x, z) + 1.0, z)
	if str(ev.get("prof", "")) == "fer":
		m.sons.tocar("forja", -2.0, 0.06, p)
		m.fx.surto(p.x, p.y, p.z, 16, "fff0b0", "ff8a3a", 5.0, 0.06)
	else:
		m.sons.tocar("pano", -3.0)
		m.fx.surto(p.x, p.y, p.z, 10, "f4e6c8", "c9a6e8", 2.5, 0.08)
	var r := int(ev.get("r", -1))
	var cor: Color = Color(m.P.dados.raridades[r].cor) if r >= 0 else Color("e8d6a8")
	m.fx.texto(m.heroi.position + Vector3(0, 0.45, 0), str(ev.get("nome", "")), cor)

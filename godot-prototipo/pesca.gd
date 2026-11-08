extends Node
# Pescaria igual à do Quimera (André 2026-11-08). Quem decide é o servidor (shared/simulacao.js pescar); aqui ficam o
# botão Pescar, a vara nas duas mãos (duas_maos.gd, o mesmo das ferramentas), a boia, a linha, o peixe saindo da água,
# a barra da briga e os sons. Números em dados/habilidades.json "pesca" (shared/dados.js PESCA).
#
# Spots marcados (André 2026-11-08): o servidor põe spots na água (comum nos lagos; raro e épico no mar, quando tiver).
# De perto a água borbulha; o Radar de pesca mostra todos no mapa por um tempo. Na beira, com a vara na mochila, aparece
# o botão; o toque mira o spot mais perto ao alcance. Toque: a vara vai para trás e lança (0,6 s), a boia cai no spot. Ela dá umas beliscadas falsas (puxar aí perde). Quando afunda
# aparece o "!" e um toque puxa. Peixe pequeno vem direto; Traíra, Garoupa, Atum e Dourado brigam: toques rápidos enchem
# a barra antes que ela esvazie (ou 8 s passem). Andar, montar ou bater recolhe a linha.

const DuasMaos = preload("res://duas_maos.gd")
const VARA_COMP := 1.7 # m (Quimera: 1,7)

var m # main.gd
var D: Dictionary # dados.pesca
var st := "" # "", lancando, espera, fisgou, briga, pegou
var t := 0.0
var boia_x := 0.0
var boia_z := 0.0
var bel_t := 1.0 # próxima beliscada falsa da boia (s)
var mergulho := 0.0 # a boia afunda um pouco numa beliscada
var prog := 0.0 # barra da briga (0 a 1)
var tap := 0.1
var dec := 0.2
var briga_max := 8.0
var peixe := ""
var tier := 0
var peso_k := 0.0 # o "duas" (mãos na vara) entra e sai devagar
var _ponto = null # onde a boia cairia agora (null = longe da água)
var _busca_t := 0.0
var _esperando := 0.0 # tocou em Pescar e o servidor ainda não respondeu
var spots := {} # id -> {tipo, x, z, no (bolhas na água)}
var radar_ate := -1.0 # até quando (m.tempo) os spots aparecem no mapa
const SPOT_VE := 35.0 # m: de mais longe as bolhas nem são desenhadas

var vara: Node3D
var boia: Node3D
var linha: MeshInstance3D
var _im: ImmediateMesh
var peixe_no: Node3D
var _barra: Control
var _barra_fill: ColorRect

func _init(principal) -> void:
	m = principal

func _ready() -> void:
	D = m.P.dados.get("pesca", {})
	# botão no fim da lista do HUD (os índices de cima são usados em mostrar_build), na coluna dos botões de ação
	m.hud._botao("pescar", Vector2(509, 340), 30, "pescar", m.hud.COR_TROCA)
	m.hud.botoes[-1].oculto = true
	_montar_vara()
	_montar_boia()
	_im = ImmediateMesh.new()
	linha = MeshInstance3D.new()
	linha.mesh = _im
	var ml := StandardMaterial3D.new()
	ml.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ml.albedo_color = Color(0.94, 0.94, 0.92, 0.8)
	ml.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	linha.material_override = ml
	linha.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	m.add_child(linha)
	_montar_barra()
	_esconder()

func ativo() -> bool:
	return st != ""

# ---------- modelos (malhas simples com material de verdade: madeira, cortiça, metal; nada de textura chapada) ----------
func _mat(cor: String, rug := 0.7, metal := 0.0) -> StandardMaterial3D:
	var mt := StandardMaterial3D.new()
	mt.albedo_color = Color(cor)
	mt.roughness = rug
	mt.metallic = metal
	return mt

func _cil(r0: float, r1: float, h: float, mt: Material, y: float) -> MeshInstance3D:
	var c := CylinderMesh.new()
	c.top_radius = r1
	c.bottom_radius = r0
	c.height = h
	c.radial_segments = 8
	c.rings = 1
	var mi := MeshInstance3D.new()
	mi.mesh = c
	mi.material_override = mt
	mi.position.y = y
	return mi

# vara: o +Y é o comprimento (pé da vara no 0, ponta em VARA_COMP)
func _montar_vara() -> void:
	vara = Node3D.new()
	var madeira := _mat("6e4a2a", 0.55)
	vara.add_child(_cil(0.017, 0.006, VARA_COMP, madeira, VARA_COMP / 2.0))
	vara.add_child(_cil(0.024, 0.022, 0.34, _mat("a8835a", 0.9), 0.2)) # cabo de cortiça
	var anel_mt := _mat("8c939c", 0.35, 0.8)
	for f in [0.45, 0.75, 1.05, 1.35, 1.62]: # passadores da linha
		var a := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 0.008
		tm.outer_radius = 0.013
		tm.rings = 8
		tm.ring_segments = 4
		a.mesh = tm
		a.material_override = anel_mt
		a.position = Vector3(0, f, 0.018)
		a.rotation.x = PI / 2.0
		vara.add_child(a)
	var mol := _cil(0.042, 0.042, 0.04, _mat("7d848c", 0.35, 0.85), 0.0) # molinete
	mol.rotation.z = PI / 2.0
	mol.position = Vector3(0, 0.42, 0.06)
	vara.add_child(mol)
	var man := _cil(0.006, 0.006, 0.07, _mat("2c2420", 0.6), 0.0) # manivela
	man.rotation.x = PI / 2.0
	man.position = Vector3(0.03, 0.42, 0.1)
	vara.add_child(man)
	for c in vara.get_children():
		c.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF if c != vara.get_child(0) else GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	m.add_child(vara)

# boia: metade de cima vermelha, de baixo branca (igual à do Quimera), com uma anteninha
func _montar_boia() -> void:
	boia = Node3D.new()
	for metade in [0, 1]:
		var s := SphereMesh.new()
		s.radius = 0.055
		s.height = 0.055
		s.is_hemisphere = true
		s.radial_segments = 12
		s.rings = 4
		var mi := MeshInstance3D.new()
		mi.mesh = s
		var mt := _mat("e8463a" if metade == 0 else "f2f1ec", 0.35)
		if metade == 0:
			mt.emission_enabled = true
			mt.emission = Color("401010")
		mi.material_override = mt
		if metade == 1:
			mi.rotation.x = PI
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		boia.add_child(mi)
	var ant := _cil(0.005, 0.004, 0.08, _mat("e8463a", 0.4), 0.09)
	ant.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	boia.add_child(ant)
	m.add_child(boia)

# peixe que sai da água: corpo, costas mais escuras e o rabo (cores do Quimera); maior quanto mais raro
func _montar_peixe(k: String) -> Node3D:
	var cores: Array = D.get("cor", {}).get(k, ["#b8c4cc", "#7a8a96"])
	var g := Node3D.new()
	var corpo := SphereMesh.new()
	corpo.radius = 0.06
	corpo.height = 0.12
	corpo.radial_segments = 12
	corpo.rings = 6
	var c := MeshInstance3D.new()
	c.mesh = corpo
	var mt := _mat(str(cores[0]).trim_prefix("#"), 0.3, 0.25) # escama: brilho de leve
	c.material_override = mt
	c.scale = Vector3(0.55, 1.0, 2.2)
	g.add_child(c)
	var costas := MeshInstance3D.new()
	var cs := SphereMesh.new()
	cs.radius = 0.061
	cs.height = 0.061
	cs.is_hemisphere = true
	cs.radial_segments = 12
	cs.rings = 3
	costas.mesh = cs
	costas.material_override = _mat(str(cores[1]).trim_prefix("#"), 0.4, 0.15)
	costas.scale = Vector3(0.5, 0.8, 2.1)
	costas.position.y = 0.012
	g.add_child(costas)
	var rabo := MeshInstance3D.new()
	var pr := PrismMesh.new()
	pr.size = Vector3(0.12, 0.1, 0.012)
	rabo.mesh = pr
	rabo.material_override = costas.material_override
	rabo.rotation = Vector3(0, PI / 2.0, PI)
	rabo.position.z = -0.15
	g.add_child(rabo)
	var k_t: int = int(D.get("tier", {}).get(k, 0))
	g.scale = Vector3.ONE * [0.8, 1.2, 1.6, 2.6, 2.0][clampi(k_t, 0, 4)]
	return g

func _montar_barra() -> void:
	_barra = Control.new()
	_barra.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	_barra.position = Vector2(-150, -150)
	_barra.size = Vector2(300, 22)
	var fundo := Panel.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.1, 0.088, 0.072, 0.9)
	sb.border_color = Color(0.72, 0.57, 0.32, 0.9)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(6)
	fundo.add_theme_stylebox_override("panel", sb)
	fundo.size = _barra.size
	_barra.add_child(fundo)
	_barra_fill = ColorRect.new()
	_barra_fill.color = Color("5fa8e0")
	_barra_fill.position = Vector2(4, 4)
	_barra_fill.size = Vector2(0, 14)
	_barra.add_child(_barra_fill)
	var l := Label.new()
	l.text = "Toque rápido em Pescar!"
	l.position = Vector2(0, -26)
	l.size = Vector2(300, 22)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_size_override("font_size", 18)
	l.add_theme_color_override("font_outline_color", Color.BLACK)
	l.add_theme_constant_override("outline_size", 6)
	_barra.add_child(l)
	_barra.visible = false
	m.hud.add_child(_barra)

func _esconder() -> void:
	vara.visible = false
	boia.visible = false
	linha.visible = false
	_barra.visible = false
	if peixe_no:
		peixe_no.queue_free()
		peixe_no = null

# ---------- onde a boia cai (Quimera Bz): na frente, de 4 a 2,2 m; senão vira dos lados até achar água ----------
func _agua_em(x: float, z: float) -> bool:
	return float(m.terreno.no_lago(x, z).get("fundo", 0.0)) > 0.15

func spot_ao_alcance():
	var hp: Vector3 = m.heroi.position
	var melhor = null
	var md := 4.4 + float(D.get("raioSpot", 5)) - 0.3 # a boia alcança a borda do spot
	for id in spots:
		var v: Dictionary = spots[id]
		var d := Vector2(v.x - hp.x, v.z - hp.z).length()
		if d < md:
			md = d
			melhor = v
	return melhor

func _achar_ponto():
	var sp = spot_ao_alcance()
	var hp: Vector3 = m.heroi.position
	if sp != null: # a boia cai na direção do centro do spot, de 2,2 a 4,4 m, dentro dele e na água
		var dv := Vector2(sp.x - hp.x, sp.z - hp.z)
		var rs := float(D.get("raioSpot", 5))
		for dist in [clampf(dv.length(), 2.2, 4.4), 4.4, 3.6, 2.8, 2.2]:
			var q: Vector2 = Vector2(hp.x, hp.z) + dv.normalized() * float(dist)
			if q.distance_to(Vector2(sp.x, sp.z)) <= rs - 0.2 and _agua_em(q.x, q.y):
				return q
	var face: float = m.mov.ry
	var tenta := func(a: float, d: float):
		var x: float = hp.x + sin(a) * d
		var z: float = hp.z + cos(a) * d
		return Vector2(x, z) if _agua_em(x, z) else null
	for d in D.get("distancias", [4, 3.4, 2.8, 2.2]):
		var p = tenta.call(face, float(d))
		if p != null:
			return p
	for k in range(1, 13):
		for lado in [1.0, -1.0]:
			for d in [3.6, 2.6, 4.4]:
				var p = tenta.call(face + lado * k * 0.26, d)
				if p != null:
					return p
	return null

func _pode_pescar() -> bool:
	return m.h.morto <= 0.0 and m.mov.esc == null and not m._nadando and m.P.contar("vara") > 0

# ---------- botão ----------
func tocar() -> void:
	if st == "":
		if not m.on():
			m.hud.aviso("Pescar só funciona online")
			return
		if m.P.contar("vara") < 1:
			m.hud.aviso("Você precisa de uma vara de pescar (crie na mochila: Criar > Ferramentas)")
			return
		if m._nadando:
			m.hud.aviso("Saia da água pra pescar")
			return
		if m.montaria != null:
			m.montar_lobo(false)
		var p = _achar_ponto()
		if p == null:
			m.hud.aviso("Chegue mais perto da água")
			return
		if spot_ao_alcance() == null:
			m.hud.aviso("Aqui não tem peixe. Procure um spot de pesca (a água borbulhando) ou use o Radar de pesca")
			return
		if _esperando > 0.0:
			return
		_esperando = 1.0
		m.rede("pescar", {"acao": "lancar", "x": p.x, "z": p.y})
		return
	if st == "pegou" or st == "lancando":
		return
	if st == "briga": # previsão: a barra sobe na hora (o servidor corrige na resposta)
		prog = min(1.0, prog + tap)
		if m.sons:
			m.sons.tocar("pesca_molinete", -6.0, 0.15)
	m.rede("pescar", {"acao": "puxar"})

# recolhe a linha (andou, montou, bateu): avisa o servidor
func recolher() -> void:
	if st == "" or st == "pegou":
		return
	m.rede("pescar", {"acao": "parar"})
	_fim()

func _fim() -> void:
	st = ""
	if m.acao.get("nome", "") == "pesca":
		m.acao = {}
	_esconder()
	m.armar(m.h.modo)

# ---------- o que o servidor manda ----------
func evento(ev: Dictionary) -> void:
	var s := str(ev.get("st", ""))
	match s:
		"lancando":
			_esperando = 0.0
			if m.trabalho.coletando != null:
				m.trabalho.parar(false)
			st = "lancando"
			t = 0.0
			boia_x = float(ev.x)
			boia_z = float(ev.z)
			bel_t = randf_range(0.8, 1.8)
			mergulho = 0.0
			m.acao = {"nome": "pesca", "t": 0.0, "dur": 1e9, "hits": [], "feitos": 0, "fn": func(_i): pass}
			m.h.pend = null
			m.armar("Coleta") # espada e cajado nas costas, mãos livres para a vara
			if m.heroi_anim.has_animation("parada"):
				m.heroi_anim.play("parada", 0.2)
			var d: Vector3 = Vector3(boia_x, 0, boia_z) - m.heroi.position
			m.mov.ry = atan2(d.x, d.z)
			m.mov.ry_mira = null
			m.heroi.rotation.y = m.mov.ry
			m.trabalho._preparar_duas()
			vara.visible = true
			boia.visible = true
			linha.visible = true
			if m.sons:
				m.sons.tocar("pesca_lanca", -4.0)
		"espera":
			if st == "lancando":
				st = "espera"
				t = 0.0
				_respingo(0.7, 5)
				if m.sons:
					m.sons.tocar("pesca_boia", -6.0, 0.1, Vector3(boia_x, m.terreno.agua.nivel, boia_z))
		"fisgou":
			st = "fisgou"
			t = 0.0
			_respingo(1.2, 8)
			m.fx.texto(Vector3(boia_x, m.terreno.agua.nivel + 0.2, boia_z), "!", Color("ffd23f"), 0.0, 0.6, 0.7, 2.4)
			if m.sons:
				m.sons.tocar("pesca_boia", -2.0, 0.05, Vector3(boia_x, m.terreno.agua.nivel, boia_z))
				m.sons.tocar("pesca_splash", -8.0)
			Input.vibrate_handheld(60)
		"briga":
			if st != "briga":
				t = 0.0
				if m.sons:
					m.sons.tocar("pesca_splash", -4.0)
			st = "briga"
			prog = float(ev.get("prog", prog))
			tap = float(ev.get("tap", tap))
			dec = float(ev.get("dec", dec))
			briga_max = float(ev.get("max", briga_max))
			if ev.has("t"):
				t = float(ev.t)
		"pegou":
			st = "pegou"
			t = 0.0
			peixe = str(ev.get("peixe", "lambari"))
			tier = int(ev.get("tier", 0))
			if peixe_no:
				peixe_no.queue_free()
			peixe_no = _montar_peixe(peixe)
			m.add_child(peixe_no)
			_respingo(1.0, 14)
			var cor := Color("ffd23f") if tier >= 3 else Color("bfe8ff")
			m.fx.texto(m.heroi.position, "+%s (%s)" % [str(ev.get("nome", "")), str(ev.get("peso", ""))], cor, 0.0, 1.1, 2.3, 1.2 if tier >= 3 else 1.0)
			if ev.get("dobro", false):
				m.fx.texto(m.heroi.position, "+1 %s (sorte)" % str(ev.get("nome", "")), Color("ffd23f"), 0.3, 1.1, 2.8)
			if m.sons:
				m.sons.tocar("pesca_splash", -2.0)
				m.sons.tocar("nivel" if tier >= 3 else "moedas", -8.0 if tier >= 3 else -10.0)
		"fim":
			_esperando = 0.0
			if st != "":
				_fim()

# ---------- spots (vêm em toda foto do servidor: [id, tipo, x, z]) ----------
func atualizar_spots(lista: Array) -> void:
	var vistos := {}
	for s in lista:
		var id := str(s[0])
		vistos[id] = true
		if spots.has(id) and is_equal_approx(spots[id].x, float(s[2])) and is_equal_approx(spots[id].z, float(s[3])):
			continue
		if spots.has(id):
			spots[id].no.queue_free()
		var v := {"tipo": str(s[1]), "x": float(s[2]), "z": float(s[3])}
		v.no = _bolhas(v)
		spots[id] = v
	for id in spots.keys():
		if not vistos.has(id):
			spots[id].no.queue_free()
			spots.erase(id)

func radar(ev: Dictionary) -> void:
	radar_ate = m.tempo + float(ev.get("mostra", 180))
	if m.sons:
		m.sons.tocar("pesca_boia", -4.0, 0.0, null, 1.6)

func radar_ligado() -> bool:
	return m.tempo < radar_ate

func cor_spot(tipo: String) -> Color:
	return Color(str(D.get("spots", {}).get(tipo, {}).get("cor", "#7fd0ff")))

var _mat_bolha: StandardMaterial3D
var _mat_roda: StandardMaterial3D
# a água borbulhando: um círculo claro de espuma e bolhinhas subindo (sem sombra; some longe, SPOT_VE)
func _bolhas(v: Dictionary) -> Node3D:
	if _mat_bolha == null:
		_mat_bolha = _mat("eaf7ff", 0.1)
		_mat_bolha.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_mat_bolha.albedo_color.a = 0.75
		_mat_roda = StandardMaterial3D.new()
		_mat_roda.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_mat_roda.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_mat_roda.albedo_color = Color(0.92, 0.97, 1.0, 0.35)
	var g := Node3D.new()
	var y: float = float(m.terreno.agua.nivel) + 0.015
	g.position = Vector3(v.x, y, v.z)
	var roda := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = float(D.get("raioSpot", 5)) * 0.82
	tm.outer_radius = float(D.get("raioSpot", 5)) * 0.88
	tm.rings = 32
	tm.ring_segments = 3
	roda.mesh = tm
	roda.scale = Vector3(1, 0.02, 1)
	var mr: StandardMaterial3D = _mat_roda.duplicate()
	mr.albedo_color = cor_spot(v.tipo).lerp(Color.WHITE, 0.6)
	mr.albedo_color.a = 0.32
	roda.material_override = mr
	roda.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	roda.visibility_range_end = SPOT_VE
	g.add_child(roda)
	for i in 12:
		var b := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.035
		sm.height = 0.07
		sm.radial_segments = 6
		sm.rings = 3
		b.mesh = sm
		b.material_override = _mat_bolha
		b.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		b.visibility_range_end = SPOT_VE
		var a := randf() * TAU
		var r := sqrt(randf()) * float(D.get("raioSpot", 5)) * 0.7
		b.position = Vector3(cos(a) * r, 0, sin(a) * r)
		b.set_meta("f", randf())
		g.add_child(b)
	m.add_child(g)
	return g

func _passo_bolhas(dt: float) -> void:
	var hp: Vector3 = m.heroi.position
	for id in spots:
		var v: Dictionary = spots[id]
		if Vector2(v.x - hp.x, v.z - hp.z).length() > SPOT_VE:
			continue
		var g: Node3D = v.no
		g.get_child(0).rotation.y += dt * 0.3
		var s0: float = 1.0 + 0.08 * sin(m.tempo * 2.0 + v.x)
		g.get_child(0).scale = Vector3(s0, 0.02, s0)
		for i in range(1, g.get_child_count()):
			var b: Node3D = g.get_child(i)
			var f: float = fmod(float(b.get_meta("f")) + dt * 0.9, 1.0)
			b.set_meta("f", f)
			b.position.y = -0.04 + 0.08 * sin(f * PI)
			b.scale = Vector3.ONE * (0.4 + f)

func _respingo(r: float, n: int) -> void:
	var y: float = float(m.terreno.agua.nivel) + 0.02
	m.fx.anel(boia_x, boia_z, r * 0.5, "eaf7ff", 0.7, y - 0.08)
	if n > 6:
		m.fx.anel(boia_x, boia_z, r * 0.8, "eaf7ff", 1.0, y - 0.08)

# ---------- quadro a quadro ----------
func _process(dt: float) -> void:
	if m.heroi == null or D.is_empty():
		return
	_esperando = max(0.0, _esperando - dt)
	_passo_bolhas(dt)
	# botão: com a vara, perto da água (procura 4 vezes por segundo, é barato) ou pescando
	_busca_t -= dt
	if _busca_t <= 0.0 and st == "":
		_busca_t = 0.25
		_ponto = _achar_ponto() if _pode_pescar() else null
	m.hud.mostrar_botao("pescar", st != "" or _ponto != null)
	if st == "":
		if peso_k > 0.0:
			peso_k = max(0.0, peso_k - dt * 6.0)
			if m.trabalho.duas != null and is_instance_valid(m.trabalho.duas) and m.trabalho.coletando == null:
				m.trabalho.duas.peso = peso_k
		return
	# andou, morreu, entrou na água, montou ou fez outra coisa: recolhe a linha (o servidor também confere)
	if st != "pegou" and (m.hud.mover.length() > 0.35 or m.h.morto > 0.0 or m._nadando or m.montaria != null or m.acao.get("nome", "") != "pesca"):
		recolher()
		return
	t += dt
	if st == "lancando" and t >= float(D.get("lancar", 0.6)) + 0.3:
		pass # o servidor manda "espera"; segue com a boia na água enquanto isso
	elif st == "espera":
		bel_t -= dt
		if bel_t <= 0.0: # beliscada falsa (Quimera: a boia mexe de 0,7 a 2 s)
			bel_t = randf_range(0.7, 2.0)
			mergulho = 0.5
			m.fx.anel(boia_x, boia_z, 0.18, "ffffff", 0.35, float(m.terreno.agua.nivel) - 0.06)
	elif st == "briga":
		prog = max(0.0, prog - dec * dt)
	elif st == "pegou" and t > 1.6:
		_fim()
		return
	mergulho = max(0.0, mergulho - dt * 2.5)
	_barra.visible = st == "briga"
	if _barra.visible:
		_barra_fill.size.x = 292.0 * prog
		_barra_fill.color = Color("5fa8e0").lerp(Color("e05a4a"), clamp(1.0 - prog * 2.0, 0.0, 1.0))
	_pose(dt)

# elevação da vara (rad acima da horizontal, na direção da boia) e quanto o corpo vai junto (k), igual ao Quimera Lz
func _elevacao() -> Vector2:
	match st:
		"lancando":
			var q: float = clamp(t / float(D.get("lancar", 0.6)), 0.0, 1.0)
			if q < 0.4:
				var s: float = q / 0.4
				return Vector2(0.35 + 1.6 * s * (2.0 - s), s)
			var r: float = (q - 0.4) / 0.6
			return Vector2(1.95 - 1.75 * (1.0 - pow(1.0 - r, 3.0)), 1.0 - r)
		"espera":
			return Vector2(0.2 + sin(m.tempo * 1.3) * 0.03 + mergulho * 0.08, 0.0)
		"fisgou":
			return Vector2(0.12 + sin(m.tempo * 32.0) * 0.05, 0.0)
		"briga":
			return Vector2(0.75 + 0.18 * sin(m.tempo * 7.0), 0.5)
		"pegou":
			var u: float = 1.0 - pow(1.0 - clamp(t / 0.28, 0.0, 1.0), 3.0)
			return Vector2(0.2 + 1.15 * u, u)
	return Vector2(0.3, 0.0)

func _pose(dt: float) -> void:
	var h: Node3D = m.heroi
	var e := _elevacao()
	var el: float = e.x
	var frente := Vector3(sin(h.rotation.y), 0, cos(h.rotation.y))
	var cima := Vector3.UP
	var dir: Vector3 = frente.cross(cima)
	var yk: float = clamp(el / 1.4, 0.0, 1.3) # Quimera: os braços sobem junto com a vara
	var cabo: Vector3 = (frente * cos(el) + cima * sin(el)).normalized()
	var mao: Vector3 = h.global_position + dir * 0.12 + cima * (0.98 + 0.22 * yk) + frente * (0.3 - 0.08 * yk)
	var pe: Vector3 = mao - cabo * 0.2
	# vara: +Y da malha no cabo, molinete para baixo
	var bz: Vector3 = cabo.cross(dir).normalized() # +Z da vara para baixo (molinete embaixo)
	vara.global_transform = Transform3D(Basis(cabo.cross(bz).normalized(), cabo, bz), pe)
	var ponta: Vector3 = pe + cabo * VARA_COMP
	if st == "briga" or st == "fisgou":
		ponta -= cima * 0.12 # a ponta enverga com o peixe
	# mãos na vara: a de cima (direita) no molinete, a esquerda no cabo atrás
	var duas = m.trabalho.duas
	if duas != null and is_instance_valid(duas):
		peso_k = move_toward(peso_k, 1.0, dt * 8.0)
		duas.mao_d = pe + cabo * 0.4
		duas.mao_e = pe + cabo * 0.12
		duas.cabo = cabo
		duas.curva = -0.4 * e.y if st in ["briga", "pegou"] else 0.15 * e.y
		duas.agacha = 0.03
		duas.avanco = 0.0
		duas.torcao = 0.0
		duas.peso = peso_k
	# boia: no ar no lançamento (arco), boiando, afundando no "!", correndo na briga, subindo com o peixe
	var nivel: float = float(m.terreno.agua.nivel)
	var by: float = nivel + 0.02 + sin(m.tempo * 3.0) * 0.012 - mergulho * 0.04
	if st == "fisgou":
		by -= 0.07 + sin(m.tempo * 40.0) * 0.025
	elif st == "briga":
		by -= 0.05
	var bp := Vector3(boia_x, by, boia_z)
	if st == "lancando":
		var g: float = clamp((t - 0.24) / 0.36, 0.0, 1.0)
		if g <= 0.0:
			bp = ponta - cima * 0.3
		else:
			bp = ponta.lerp(Vector3(boia_x, by, boia_z), g) + cima * sin(g * PI) * 1.4
	elif st == "briga":
		bp += Vector3(sin(m.tempo * 13.0), 0, cos(m.tempo * 11.0)) * 0.18
	elif st == "pegou":
		var u: float = clamp(t / 0.55, 0.0, 1.0)
		var s: float = u * u * (3.0 - 2.0 * u)
		var alvo: Vector3 = ponta - cima * 0.75
		bp = Vector3(boia_x, by, boia_z).lerp(alvo, s) + cima * sin(u * PI) * 1.3
		if u >= 1.0:
			bp.x += sin(m.tempo * 5.0) * 0.05
		if peixe_no:
			peixe_no.global_position = bp - cima * 0.22
			var ry: float = atan2(frente.x, frente.z)
			peixe_no.rotation = Vector3(-PI / 2.0 + sin(m.tempo * 18.0) * 0.5 * (1.0 - s * 0.6), ry, sin(m.tempo * 14.0) * 0.35)
	boia.global_position = bp
	# linha da ponta da vara até a boia, com uma barriga quando está frouxa (esperando)
	_im.clear_surfaces()
	_im.surface_begin(Mesh.PRIMITIVE_LINE_STRIP)
	var barriga: float = 0.12 if st == "espera" else 0.0
	var a: Vector3 = ponta
	var b: Vector3 = bp + cima * 0.05
	for i in 9:
		var f: float = i / 8.0
		_im.surface_add_vertex(a.lerp(b, f) - cima * barriga * a.distance_to(b) * 0.25 * sin(f * PI))
	_im.surface_end()

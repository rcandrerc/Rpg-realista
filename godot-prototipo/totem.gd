extends Node
# Totens de teleporte (André 2026-11-10, escolheu "Só os 7 principais"; TOTENS em shared/dados.js, que vem em
# habilidades.json). Cada totem é uma plataforma de pedra octogonal com um obelisco de runas azuis e um cristal que
# flutua em cima. Passar perto a pé descobre o totem (fica na conta, prog.totens) e marca ali o lugar de renascer
# (prog.totem). Perto da pedra aparece o botão Falar (conversa.gd trata o totem como um NPC): a janela lista os outros
# totens com a taxa; tocar num descoberto começa a viagem (canalização da casinha, volta_vila.gd). Em volta é área
# segura (monstro não persegue nem bate) e a vida volta mais rápido. Online quem decide é o servidor (Simulacao.irTotem);
# sem internet esta mesma conta vale aqui.
# Desempenho (André prefere FPS a enfeite): 6 peças por totem, sem sombra no que brilha, some a mais de ALCANCE m e a
# luz só acende perto (LUZ_PERTO m).

const TEX_PEDRA := "res://cenario3d/pilar_T_RockTrim_BaseColor.jpg"
const ALCANCE := 220.0
const LUZ_PERTO := 40.0
const COR := Color(0.35, 0.85, 1.0)

var m # main.gd
var T := {"toque": 8.0, "usar": 4.0, "canal": 5.0, "taxaNivel": 10.0, "taxaMin": 50.0, "seguro": 15.0, "regen": 2.0, "raio": 1.75, "lista": []}
var totens: Array = [] # {t, no, cristal, luz, mats, npc, cristal_y}
var _feito := false
var _t := 0.0

func _init(principal) -> void:
	m = principal
	var d = m.P.dados.get("totens")
	if d is Dictionary:
		for k in d:
			T[k] = d[k]

func dados(id: String) -> Dictionary:
	for t in T.lista:
		if str(t.id) == id:
			return t
	return {}

# ouro para ir até o totem t (o mesmo de taxaTotem no servidor)
func taxa(t: Dictionary) -> int:
	return int(max(float(T.taxaMin), float(T.taxaNivel) * float(t.get("nivel", 1))))

func descobertos() -> Array:
	var l = m.P.prog.get("totens", [])
	return l if l is Array else []

func descoberto(id: String) -> bool:
	return descobertos().has(id)

# o totem a até r m do ponto (só x e z), ou {}
func perto(p: Vector3, r: float) -> Dictionary:
	for t in T.lista:
		if Vector2(float(t.x) - p.x, float(t.z) - p.z).length() < r:
			return t
	return {}

# dentro da área segura de algum totem?
func seguro(p: Vector3) -> bool:
	return not perto(p, float(T.seguro)).is_empty()

# quanto a vida volta mais rápido ali (1 = normal)
func regen_k(p: Vector3) -> float:
	return float(T.regen) if seguro(p) else 1.0

# um lugar do lado da pedra (onde o herói aparece; o servidor sorteia o dele)
func lado(t: Dictionary) -> Vector3:
	var a := randf() * TAU
	var r := float(T.raio) + 1.6 + randf() * 1.2
	var x := float(t.x) + cos(a) * r
	var z := float(t.z) + sin(a) * r
	return Vector3(x, m.terreno.altura(x, z) if m.terreno else 0.0, z)

# sem internet: onde levanta depois de cair (o último totem tocado; o da vila ou nenhum = a praça, como antes)
func onde_renascer(padrao: Vector3) -> Vector3:
	var t := dados(str(m.P.prog.get("totem", "")))
	if t.is_empty() or str(t.id) == "clareira":
		return padrao
	return lado(t)

# os totens vistos como NPCs da janela de conversa (conversa.gd): o botão Falar e o toque na tela
func como_npcs() -> Array:
	var l: Array = []
	for o in totens:
		if o.no.visible:
			l.append(o.npc)
	return l

# ---------- descobrir ----------
# sem internet: passou perto. Online: o servidor descobre e manda o evento "totem" (online.gd) só para o brilho.
func _tocar(t: Dictionary) -> void:
	var id := str(t.id)
	var novo := not descoberto(id)
	if not novo and str(m.P.prog.get("totem", "")) == id:
		return
	if novo:
		var l := descobertos().duplicate()
		l.append(id)
		m.P.prog.totens = l
	m.P.prog.totem = id
	m.P.mudou = true
	m.hud.aviso("Totem descoberto: %s. Se cair, você renasce aqui" % t.nome if novo else "Você renasce aqui agora: %s" % t.nome)
	brilhar(id, novo)

# o totem acende forte por um instante (descobriu ou marcou o renascer)
func brilhar(id: String, novo: bool) -> void:
	for o in totens:
		if str(o.t.id) != id:
			continue
		o.surto = 1.0
		var p: Vector3 = o.no.position + Vector3(0, o.cristal_y, 0)
		if m.fx:
			m.fx.anel(p.x, p.z, 2.4, "5ad8ff", 0.8, o.no.position.y + o.topo)
		if novo:
			m.sons.tocar("nivel", -10.0, 0.0, p)

# ---------- viagem ----------
# tocou num destino na janela do totem (conversa.gd)
func ir(de: Dictionary, para: Dictionary) -> String:
	if m.h.morto > 0.0:
		return ""
	if not descoberto(str(para.id)):
		return "Esse eu ainda não conheço. Vá até lá a pé uma vez e as runas guardam o caminho."
	var c := taxa(para)
	if int(m.P.prog.get("ouro", 0)) < c:
		return "A viagem até %s custa %d de ouro. Você tem %d." % [para.nome, c, int(m.P.prog.get("ouro", 0))]
	m.conversa.fechar()
	m.volta.pedir_totem(para)
	return ""

# ---------- desenho ----------
func _process(dt: float) -> void:
	var t0_parte := Time.get_ticks_usec()
	_process_parte(dt)
	if Time.get_ticks_usec() - t0_parte >= 1000 and Engine.has_meta("lentidao"): # quadro lento (lentidao.gd)
		Engine.get_meta("lentidao").ev("totem", t0_parte)

func _process_parte(dt: float) -> void:
	if m.heroi == null or m.terreno == null:
		return
	if not _feito:
		_feito = true
		for t in T.lista:
			totens.append(_montar(t))
	var hp: Vector3 = m.heroi.position
	for o in totens:
		if not o.no.visible:
			continue
		# o cristal gira e sobe e desce devagar
		o.cristal.rotation.y += dt * 0.8
		o.cristal.position.y = o.cristal_y + sin(m.tempo * 1.3 + o.fase) * 0.08
		if o.surto > 0.0:
			o.surto = max(0.0, o.surto - dt * 0.6)
			_forca(o, o.forca_base + o.surto * 2.0)
	_t -= dt
	if _t > 0.0:
		return
	_t = 0.25
	for o in totens:
		var d := Vector2(float(o.t.x) - hp.x, float(o.t.z) - hp.z).length()
		var ve := d < ALCANCE
		if ve != o.no.visible:
			o.no.visible = ve
		var acesa := d < LUZ_PERTO
		if acesa != o.luz.visible:
			o.luz.visible = acesa
		var f: float = clamp(1.0 - (d - 6.0) / 30.0, 0.0, 1.0) # chegando perto as runas acendem mais
		if abs(f - o.forca_base) > 0.04:
			o.forca_base = f
			if o.surto <= 0.0:
				_forca(o, f)
		if not m.on() and d < float(T.toque) and m.h.morto <= 0.0:
			_tocar(o.t)

func _forca(o: Dictionary, f: float) -> void:
	for mt in o.mats:
		mt.set_shader_parameter("forca", f)
	o.luz.light_energy = 0.8 + 1.4 * f

func _pedra(tex: Texture2D, chao: float, escala: Vector2, faixa: Vector2, runas: bool) -> ShaderMaterial:
	var mt := ShaderMaterial.new()
	mt.shader = load("res://totem.gdshader")
	mt.set_shader_parameter("tex", tex)
	mt.set_shader_parameter("chao", chao)
	mt.set_shader_parameter("escala_uv", escala)
	mt.set_shader_parameter("faixa", faixa)
	mt.set_shader_parameter("runas", 1.0 if runas else 0.0)
	mt.set_shader_parameter("runa_cor", COR)
	return mt

func _peca(pai: Node3D, malha: Mesh, mt: Material, y: float, sombra := true) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = malha
	mi.material_override = mt
	mi.position.y = y
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if sombra else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	pai.add_child(mi)
	return mi

func _cilindro(r0: float, r1: float, h: float, lados: int) -> CylinderMesh:
	var c := CylinderMesh.new()
	c.bottom_radius = r0
	c.top_radius = r1
	c.height = h
	c.radial_segments = lados
	c.rings = 1
	return c

func _montar(t: Dictionary) -> Dictionary:
	var x := float(t.x)
	var z := float(t.z)
	var R := float(T.raio)
	var y0: float = m.terreno.altura(x, z)
	# o chão em volta: a plataforma vai do mais baixo (enterrada 0,4 m) até um palmo acima do mais alto
	var lo := y0
	var hi := y0
	for i in 16:
		var a := TAU * i / 16.0
		for r in [R * 0.6, R]:
			var h: float = m.terreno.altura(x + cos(a) * r, z + sin(a) * r)
			lo = min(lo, h)
			hi = max(hi, h)
	var no := Node3D.new()
	no.name = "totem_%s" % t.id
	no.position = Vector3(x, y0, z)
	m.add_child(no)
	var tex: Texture2D = load(TEX_PEDRA)
	var mats: Array = []
	# plataforma: octógono de tijolos (a faixa de baixo da textura), com o tampo de calçamento
	var topo := hi - y0 + 0.28
	var fundo := lo - y0 - 0.4
	var p1 := _peca(no, _cilindro(R + 0.1, R, topo - fundo, 8), _pedra(tex, y0, Vector2(3.0, 1.0 / max(0.5, topo - fundo) * 0.45), Vector2(0.64, 0.35), false), (topo + fundo) * 0.5)
	p1.rotation.y = PI / 8.0
	# degrau de cima
	var degrau := 0.22
	var p2 := _peca(no, _cilindro(R * 0.72, R * 0.68, degrau, 8), _pedra(tex, y0, Vector2(2.0, 1.0), Vector2(0.64, 0.35), false), topo + degrau * 0.5)
	p2.rotation.y = PI / 8.0
	var base := topo + degrau
	# obelisco: 4 faces lisas (a faixa do meio da textura) com as runas
	var alto := 2.3
	var mo := _pedra(tex, y0, Vector2(1.0, 1.0), Vector2(0.31, 0.26), true)
	mats.append(mo)
	var ob := _peca(no, _cilindro(0.42, 0.27, alto, 4), mo, base + alto * 0.5)
	ob.rotation.y = PI / 4.0
	var ponta := _peca(no, _cilindro(0.3, 0.0, 0.34, 4), _pedra(tex, y0, Vector2(1.0, 1.0), Vector2(0.31, 0.26), false), base + alto + 0.17)
	ponta.rotation.y = PI / 4.0
	# círculo de runas no tampo do degrau
	var ml := ShaderMaterial.new()
	ml.shader = load("res://totem_luz.gdshader")
	ml.set_shader_parameter("tipo", 0.0)
	ml.set_shader_parameter("cor", COR)
	mats.append(ml)
	var pl := PlaneMesh.new()
	pl.size = Vector2(R * 1.36, R * 1.36)
	_peca(no, pl, ml, base + 0.012, false)
	# cristal (octaedro) flutuando em cima
	var mc := ShaderMaterial.new()
	mc.shader = ml.shader
	mc.set_shader_parameter("tipo", 1.0)
	mc.set_shader_parameter("cor", COR)
	mats.append(mc)
	var oct := SphereMesh.new()
	oct.radius = 0.22
	oct.height = 0.78
	oct.radial_segments = 4
	oct.rings = 1
	var cy := base + alto + 0.34 + 0.62
	var cr := _peca(no, oct, mc, cy, false)
	var luz := OmniLight3D.new()
	luz.light_color = COR
	luz.omni_range = 7.5
	luz.light_energy = 1.2
	luz.shadow_enabled = false
	luz.position.y = cy
	luz.visible = false
	no.add_child(luz)
	var npc := {"id": "totem_%s" % t.id, "nome": "%s, totem de teleporte" % t.nome, "funcao": "totem", "no": no, "acoes": [], "falas": [],
		"totem": t, "folga": R}
	return {"t": t, "no": no, "cristal": cr, "cristal_y": cy, "luz": luz, "mats": mats, "npc": npc, "forca_base": -1.0, "surto": 0.0,
		"fase": randf() * TAU, "topo": base}

extends Node3D
# Árvores plantadas pelos jogadores (André 2026-11-16, entrega 3 do plantio; regras em shared/plantio.js). O servidor
# manda cada árvore uma vez, quando chego perto: [id, tipo, x, z, giro, escala, s até ficar adulta]; a que foi cortada
# inteira vem como [id]. Ela cresce aqui sozinha pelo relógio (muda, jovem, adulta). Muda e jovem não mostram o botão
# de cortar; a adulta entra na coleta como as outras árvores e cai do mesmo jeito (queda_arvore.gd).
# Modelos (André 2026-11-16 escolheu na foto lado a lado): Stylized Nature (Quaternius) em cenario3d/arv_<tipo>.glb, com a
# casca e a folha já pintadas (ferramentas/cenario/preparar.mjs). Sem o .glb, cai nas árvores da mata com a cor do tipo.

var m # main.gd
var arvores := {} # id -> {o (coletável do trabalho.gd), no: Node3D, partes: [MeshInstance3D], sc, ate (m.tempo), total, fase}
var _mats := {} # "copa_tipo" / "tronco_tipo" -> material
var _t := 0.0
const ESCALA_FASE := [0.2, 0.55, 1.0] # muda, jovem, adulta
const LONGE := 80.0 # m: como a mata
const TOCO_FICA := 9.0 # s do corte até o toco sumir (a queda leva ~5 s)
const ALTURA := {"betula": 7.5, "carvalho": 7.0, "pinheiro": 9.0, "macieira": 5.5, "cerejeira": 6.0, "antiga": 12.0} # m adulta
var _modelos := {} # tipo -> [{mesh, t}] (arv_<tipo>.glb, já na altura certa e com o pé no chão)
var _maca_mesh: Mesh
var _maca_mat: Material

func _init(principal) -> void:
	m = principal

# a foto do servidor (online.gd)
func atualizar(lista: Array) -> void:
	for v in lista:
		if not (v is Array) or v.is_empty():
			continue
		var id := str(v[0])
		if v.size() == 1:
			tirar(id)
		elif v.size() >= 7 and not arvores.has(id):
			botar(id, str(v[1]), float(v[2]), float(v[3]), float(v[4]), float(v[5]), float(v[6]))

# o chão mudou de altura (base do clã nivelada, base_cla.gd; André 2026-11-23: "as árvores também" voando): as árvores
# plantadas dessa área descem ou sobem junto com o chão
func chao_mudou(area: Rect2) -> void:
	for id in arvores:
		var no = arvores[id].get("no")
		if no is Node3D and is_instance_valid(no) and area.has_point(Vector2(no.position.x, no.position.z)):
			no.position.y = m.terreno.altura(no.position.x, no.position.z)

func tipos() -> Dictionary:
	return m.P.dados.get("arvoresPlantio", {})

func botar(id: String, s: String, x: float, z: float, ry: float, sc: float, falta: float) -> void:
	var T: Dictionary = tipos().get(s, {})
	var v := int(T.get("v", 0))
	var y: float = m.terreno.altura(x, z)
	var no := Node3D.new()
	no.position = Vector3(x, y, z)
	no.rotation.y = ry
	add_child(no)
	var partes: Array = []
	var modelo := _modelo(s)
	for p in modelo:
		var mi := MeshInstance3D.new()
		mi.mesh = p.mesh
		mi.transform = Transform3D(Basis().scaled(Vector3.ONE * sc), Vector3.ZERO) * p.t
		mi.visibility_range_end = LONGE
		mi.visibility_range_end_margin = 6.0
		no.add_child(mi)
		partes.append(mi)
	if modelo.is_empty():
		for parte in ["tronco", "copa"]:
			var mesh: Mesh = m._malhas_mata.get("%s_%d" % [parte, v])
			if mesh == null:
				continue
			var mi := MeshInstance3D.new()
			mi.mesh = mesh
			mi.material_override = _material(parte, s, T, mesh)
			mi.visibility_range_end = LONGE
			mi.visibility_range_end_margin = 6.0
			mi.scale = Vector3.ONE * sc
			no.add_child(mi)
			partes.append(mi)
	var macas: Array = []
	if s == "macieira" and not modelo.is_empty():
		macas = _macas(no, id, sc)
		partes.append_array(macas)
	var o := {"id": id, "tipo": "arvore", "pos": Vector3(x, y, z), "r": 0.32 * sc, "cargas": -1, "volta_ate": -1.0, "plantada": true}
	var a := {"o": o, "no": no, "partes": partes, "sc": sc, "ate": m.tempo + falta, "total": max(1.0, float(T.get("h", 1)) * 3600.0), "fase": -1, "macas": macas, "s": s}
	arvores[id] = a
	m.trabalho.registrar(o)
	m.trabalho.queda.registrar_partes(x, z, partes)
	_fase(a)
	if mostrando:
		_refazer_marcas()

# muda e jovem: o botão de cortar não aparece (o coletável fica "esgotado" até a hora de ficar adulta)
func _fase(a: Dictionary) -> void:
	var falta: float = a.ate - m.tempo
	var f: float = 1.0 - falta / a.total
	var fase := 2 if falta <= 0.0 else (0 if f < 0.4 else 1)
	if fase == a.fase:
		return
	a.fase = fase
	a.no.scale = Vector3.ONE * ESCALA_FASE[fase]
	if not m.trabalho.queda.caida(a.o.id):
		for mc in a.get("macas", []):
			mc.visible = fase == 2 # maçã só na adulta
	if fase < 2:
		a.o.cargas = 0
		a.o.volta_ate = a.ate
	elif not m.trabalho.queda.caida(a.o.id):
		a.o.cargas = -1
		a.o.volta_ate = -1.0

# arv_<tipo>.glb: as malhas com a posição de cada uma, na altura de ALTURA e com o pé no chão (uma vez por tipo)
func _modelo(s: String) -> Array:
	if _modelos.has(s):
		return _modelos[s]
	var l: Array = []
	var arq := "res://cenario3d/arv_%s.glb" % s
	if ResourceLoader.exists(arq):
		var cena: Node3D = (load(arq) as PackedScene).instantiate()
		var caixa := AABB()
		var primeiro := true
		for mi in cena.find_children("*", "MeshInstance3D", true, false):
			var t := Transform3D()
			var q: Node = mi
			while q != cena and q != null:
				t = (q as Node3D).transform * t
				q = q.get_parent()
			var b: AABB = t * (mi as MeshInstance3D).get_aabb()
			caixa = b if primeiro else caixa.merge(b)
			primeiro = false
			l.append({"mesh": (mi as MeshInstance3D).mesh, "t": t})
		cena.free()
		if not l.is_empty() and caixa.size.y > 0.01:
			var k: float = float(ALTURA.get(s, 7.0)) / caixa.size.y
			var ajuste := Transform3D(Basis().scaled(Vector3.ONE * k), Vector3(0, -caixa.position.y * k, 0))
			for p in l:
				p.t = ajuste * p.t
			_modelos[s + "_caixa"] = Vector3(max(caixa.size.x, caixa.size.z) * k, caixa.size.y * k, 0)
	_modelos[s] = l
	return l

# maçãs vermelhas na copa da macieira (o sorteio sai do id: todo mundo vê igual)
func _macas(no: Node3D, id: String, sc: float) -> Array:
	if _maca_mesh == null:
		var esf := SphereMesh.new()
		esf.radius = 0.14
		esf.height = 0.28
		esf.radial_segments = 8
		esf.rings = 4
		_maca_mesh = esf
		var mt := StandardMaterial3D.new()
		mt.albedo_color = Color("c8261e")
		mt.roughness = 0.45
		mt.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
		_maca_mat = mt
	var cx: Vector3 = _modelos.get("macieira_caixa", Vector3(4, 5.5, 0))
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(id)
	var l: Array = []
	for i in 14:
		var ang := rng.randf() * TAU
		var y := cx.y * rng.randf_range(0.5, 0.85) * sc
		var r := cx.x * 0.36 * rng.randf_range(0.75, 1.0) * sc
		var mi := MeshInstance3D.new()
		mi.mesh = _maca_mesh
		mi.material_override = _maca_mat
		mi.position = Vector3(cos(ang) * r, y, sin(ang) * r)
		mi.visibility_range_end = 60.0
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		no.add_child(mi)
		l.append(mi)
	return l

func _material(parte: String, s: String, T: Dictionary, mesh: Mesh) -> Material:
	var k := parte + "_" + s
	if not _mats.has(k):
		var base = mesh.surface_get_material(0)
		var chave := "copa" if parte == "copa" else "tronco"
		var cor: Color = Color(str(T[chave])) if T.has(chave) else Color.WHITE
		if base is BaseMaterial3D:
			var mt: BaseMaterial3D = base.duplicate()
			mt.vertex_color_use_as_albedo = false
			mt.albedo_color = mt.albedo_color * cor
			_mats[k] = mt
		else:
			_mats[k] = base
	return _mats[k]

# cortada (o servidor manda [id]): cai como as outras, o toco fica uns segundos e some (André 2026-11-16: "não é
# simplesmente sumir"). Se o [id] chegou antes do evento da queda, ela cai aqui mesmo.
func tirar(id: String) -> void:
	var a = arvores.get(id)
	if a == null:
		return
	arvores.erase(id)
	if mostrando:
		_refazer_marcas.call_deferred()
	var q = m.trabalho.queda
	if not q.caida(id):
		q.derrubar(a.o, null, true)
	a.o.cargas = 0 # sem botão de cortar enquanto o toco está lá
	a.o.volta_ate = m.tempo + 1e9
	get_tree().create_timer(TOCO_FICA).timeout.connect(_sumir.bind(a))

func _sumir(a: Dictionary) -> void:
	m.trabalho.esquecer(a.o)
	m.trabalho.queda.tirar(a.o.id, a.o.pos.x, a.o.pos.z, a.partes)
	a.no.queue_free()

# muda vira jovem e jovem vira adulta: confere de 2 em 2 s (a ida até a área ou o quadrado, a cada quadro)
func _process(dt: float) -> void:
	if mostrando or indo_area != null or _alvo_terreno != null:
		_modo_passo()
	_t -= dt
	if _t > 0.0:
		return
	_t = 2.0
	var hp: Vector3 = m.heroi.position if m.heroi != null else Vector3.ZERO
	for a in arvores.values():
		if a.fase < 2:
			_fase(a)
		# o chão mudou embaixo dela (base nivelada, estrada...): acompanha (André 2026-11-23: "as árvores também" voando)
		var no = a.get("no")
		if no is Node3D and is_instance_valid(no) and not (m.trabalho and a.get("o") and m.trabalho.queda.caida(a.o.id)) and Vector2(no.position.x - hp.x, no.position.z - hp.z).length_squared() < LONGE * LONGE:
			var y: float = m.terreno.chao_relevo(no.position.x, no.position.z)
			if absf(no.position.y - y) > 0.3 and absf(m.terreno.altura(no.position.x, no.position.z) - y) < 0.05:
				no.position.y = y

# plantou (evento do servidor): terra mexida e o som da mão na terra
func plantou(ev: Dictionary) -> void:
	var x := float(ev.get("x", 0.0))
	var z := float(ev.get("z", 0.0))
	m.fx.poeira(x, z, 0.6, 6, "7a5c3e", "a88a62")
	m.sons.tocar("pano", -6.0, 0.05, Vector3(x, m.terreno.altura(x, z), z))

# ---------- onde plantar (André 2026-11-16) ----------
# Um jeito só de plantar (André 23:54: "o menu de árvore e o menu de plantação fossem iguais"): na área de plantio abre
# o mesmo menu da Fazenda do terreno (construcao.gd, só com as mudas); escolhe a muda, mira o quadrado de 4 m e o
# Plantar leva o herói até ele e planta. O botão Plantar da semente, longe, leva o herói pela estrada até a área mais
# perto (andar cancela, como no "Ir para") e lá abre a Fazenda. No terreno, o botão da semente planta perto do herói.
# Com a Fazenda aberta na área, os quadrados de 4 m aparecem no chão: amarelo livre, vermelho com árvore.
const SHADER_MARCA := preload("res://marca_fazenda.gdshader")
const Q := 4.0 # m do quadrado (PLANTIO.quadrado)
const RAIO_MODO := 16.0 # m em volta do herói com os quadrados desenhados (e até onde a mira vai na área)
const PERTO_AREA := 10.0 # m: com um quadrado livre tão perto, abre a Fazenda sem andar
const COR_Q := {"livre": Color(1.0, 0.86, 0.45), "ocupado": Color(1.0, 0.42, 0.36)}
var _quads := {} # Vector2i(i, k) -> id da área (habilidades.json, plantio.areas: "k:i0~i1,i2;...")
var mostrando := false # quadrados no chão (Fazenda aberta numa área de plantio)
var semente := ""
var indo_area = null # Vector2 (m) do quadrado de destino, andando pela estrada
var _marcas := {} # Vector2i -> MeshInstance3D
var _centro_marcas := Vector2(INF, INF)
var _mats_q := {}

func quadrados() -> Dictionary:
	if _quads.is_empty():
		for A in m.P.dados.get("plantio", {}).get("areas", []):
			for linha in str(A.q).split(";"):
				var pk := linha.split(":")
				if pk.size() < 2:
					continue
				var k := int(pk[0])
				for r in pk[1].split(","):
					var ab := r.split("~")
					var a := int(ab[0])
					var b := int(ab[1]) if ab.size() > 1 else a
					for i in range(a, b + 1):
						_quads[Vector2i(i, k)] = str(A.id)
	return _quads

# quadrados com árvore plantada (as que eu conheço: as de perto)
func _ocupados() -> Dictionary:
	var o := {}
	for a in arvores.values():
		var p: Vector3 = a.o.pos
		if bool(tipos().get(a.get("s", ""), {}).get("grande", false)):
			var i := roundi(p.x / Q) - 1
			var k := roundi(p.z / Q) - 1
			for d in [Vector2i(0, 0), Vector2i(1, 0), Vector2i(0, 1), Vector2i(1, 1)]:
				o[Vector2i(i, k) + d] = true
		else:
			o[Vector2i(floori(p.x / Q), floori(p.z / Q))] = true
	return o

static func _meio(q: Vector2i) -> Vector2:
	return Vector2(q.x * Q + Q * 0.5, q.y * Q + Q * 0.5)

# onde fica o tronco no quadrado q (o mesmo sorteio de shared/plantio.js lugarNoQuadrado)
func lugar(q: Vector2i, grande := false) -> Vector2:
	var h: int = ((q.x * 73856093) ^ (q.y * 19349663)) & 0xFFFFFFFF
	var solto := float(m.P.dados.get("plantio", {}).get("solto", 0.8))
	var base := Q if grande else Q * 0.5
	return Vector2(q.x * Q + base + (float(h & 255) / 255.0 * 2.0 - 1.0) * solto, q.y * Q + base + (float((h >> 8) & 255) / 255.0 * 2.0 - 1.0) * solto)

# árvore nativa ou pedra perto demais do tronco deste quadrado? O servidor recusa ("Perto demais de outra árvore ou pedra"),
# então o quadrado não pode aparecer livre nem ser escolhido (André 2026-11-22)
func perto_de_nativa(q: Vector2i, grande := false) -> bool:
	if m.mov == null:
		return false
	var folga := float(m.P.dados.get("plantio", {}).get("folga", 1.6))
	var l := lugar(q, grande)
	for o in m.mov.perto_na_mata(l.x, l.y):
		if Vector2(float(o.x) - l.x, float(o.z) - l.y).length() < float(o.r) + folga:
			return true
	return false

func _semente_grande() -> bool:
	return bool(tipos().get(semente, {}).get("grande", false))

func _area_mais_perto(hp: Vector2):
	var oc := _ocupados()
	var melhor = null
	var md := INF
	var grande := _semente_grande()
	for q in quadrados():
		if oc.has(q) or perto_de_nativa(q, grande):
			continue
		var d := _meio(q).distance_squared_to(hp)
		if d < md:
			md = d
			melhor = q
	return melhor

func _no_meu_terreno(hp: Vector2) -> bool:
	var c: Dictionary = m.minimapa._minha_casa() if m.minimapa else {}
	return not c.is_empty() and hp.x >= c.x0 and hp.x <= c.x1 and hp.y >= c.z0 and hp.y <= c.z1

# botão Plantar da mochila (semente de árvore)
func plantar(s: String) -> void:
	if not m.on():
		m.hud.aviso("Plantar árvore só funciona online")
		return
	if m.heroi == null:
		return
	semente = s
	var hp := Vector2(m.heroi.position.x, m.heroi.position.z)
	if _no_meu_terreno(hp): # no terreno: planta perto do herói (o servidor escolhe o quadrado)
		m.rede("plantarArvore", {"s": s, "x": hp.x, "z": hp.y})
		return
	var q = _area_mais_perto(hp)
	if q == null:
		m.hud.aviso("Nenhuma área de plantio livre")
		return
	var alvo := _meio(q)
	_alvo_terreno = null
	if alvo.distance_to(hp) <= PERTO_AREA:
		indo_area = null
		m.construcao.abrir_area(s)
		return
	if m.rota:
		m.rota.ir(m.rota.planejar(alvo), "Indo para a área de plantio")
		indo_area = alvo

# tem quadrado de área de plantio perto do ponto? (o martelo do topo abre a Fazenda aqui)
func area_perto(p: Vector2, raio := PERTO_AREA) -> bool:
	var qs := quadrados()
	var n := int(ceil(raio / Q))
	var c0 := Vector2i(floori(p.x / Q), floori(p.y / Q))
	for di in range(-n, n + 1):
		for dk in range(-n, n + 1):
			var q := c0 + Vector2i(di, dk)
			if qs.has(q) and _meio(q).distance_to(p) <= raio:
				return true
	return false

# Fazenda do terreno ou da área (construcao.gd): o herói anda até o quadrado escolhido e planta ali
var _alvo_terreno = null # Vector2i do quadrado (o de cima à esquerda na árvore antiga)
func plantar_no_quadrado(s: String, q: Vector2i) -> void:
	indo_area = null
	semente = s
	_alvo_terreno = q

func _destino() -> Vector2:
	var grande: bool = bool(tipos().get(semente, {}).get("grande", false))
	return Vector2(_alvo_terreno.x + 1, _alvo_terreno.y + 1) * Q if grande else _meio(_alvo_terreno)

func mostrar_quadrados(v: bool) -> void:
	mostrando = v
	_centro_marcas = Vector2(INF, INF)
	_refazer_marcas()

func _modo_passo() -> void:
	if m.heroi == null:
		return
	var hp := Vector2(m.heroi.position.x, m.heroi.position.z)
	if _alvo_terreno != null:
		if m.hud.mover.length() > 0.15: # mexeu no joystick: para de ir
			_alvo_terreno = null
		elif hp.distance_to(_destino()) < 1.4:
			var c := _meio(_alvo_terreno)
			_alvo_terreno = null
			m.rede("plantarArvore", {"s": semente, "x": c.x, "z": c.y, "q": 1})
	if indo_area != null and m.rota and not m.rota.ativo: # a ida pela estrada acabou: chegou (ou o jogador andou)
		var chegou: bool = hp.distance_to(indo_area) < 14.0
		indo_area = null
		if chegou:
			m.construcao.abrir_area(semente)
	if mostrando and hp.distance_to(_centro_marcas) > 3.0:
		_refazer_marcas()

# o herói vai até o quadrado escolhido (main.direcao_joystick)
func andando() -> bool:
	return _alvo_terreno != null

func direcao_auto() -> Vector3:
	var a: Vector2 = _destino() - Vector2(m.heroi.position.x, m.heroi.position.z)
	if a.length() < 0.05:
		return Vector3.ZERO
	return Vector3(a.x, 0, a.y).normalized() * (0.5 if a.length() > 0.8 else 0.3)

func _mat_q(estado: String) -> ShaderMaterial:
	if not _mats_q.has(estado):
		var sm := ShaderMaterial.new()
		sm.shader = SHADER_MARCA
		sm.set_shader_parameter("cor", COR_Q[estado])
		_mats_q[estado] = sm
	return _mats_q[estado]

func _refazer_marcas() -> void:
	for q in _marcas:
		_marcas[q].queue_free()
	_marcas.clear()
	if not mostrando or m.heroi == null:
		return
	var hp := Vector2(m.heroi.position.x, m.heroi.position.z)
	_centro_marcas = hp
	var oc := _ocupados()
	var qs := quadrados()
	var grande := _semente_grande()
	var n := int(ceil(RAIO_MODO / Q))
	var c0 := Vector2i(floori(hp.x / Q), floori(hp.y / Q))
	for di in range(-n, n + 1):
		for dk in range(-n, n + 1):
			var q := c0 + Vector2i(di, dk)
			if not qs.has(q) or _meio(q).distance_to(hp) > RAIO_MODO:
				continue
			var c := _meio(q)
			var mi := MeshInstance3D.new()
			var pm := PlaneMesh.new()
			pm.size = Vector2(Q * 0.94, Q * 0.94)
			mi.mesh = pm
			mi.material_override = _mat_q("ocupado" if oc.has(q) or perto_de_nativa(q, grande) else "livre")
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			mi.position = Vector3(c.x, m.terreno.altura(c.x, c.y) + 0.06, c.y)
			add_child(mi)
			_marcas[q] = mi

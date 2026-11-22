extends Node3D
const Idioma = preload("res://idioma.gd") # inglês (idioma.gd)
# Base do clã (André 2026-11-22; servidor: shared/base.js). O servidor manda todas as bases já desenhadas (evento
# "bases"): as peças (modelos da vila em res://vilas3d/vilas.glb, que vilas_mundo.gd monta como as mini vilas), os
# sólidos (salão, torre, paliçada: os mesmos do servidor), o ponto do Baú do Clã (o baú do clã de construcao.gd, na porta
# do salão) e os lotes abertos (estacas nos cantos e o nome do dono). Cada base é mais uma "vila" no vilas_mundo: só nasce
# perto do herói (leve no celular).

var m # main.gd
var bases: Array = [] # as bases do servidor (dicionários do evento)
var meu := "" # a chave da minha base ("" = não tenho)
var _sol: Array = [] # os sólidos das bases no terreno.gd (para tirar quando mudar)
var _nos: Array = [] # baús, estacas e nomes
const VE_NOME := 60.0

func _init(principal) -> void:
	m = principal

func do_servidor(ev: Dictionary) -> void:
	bases = ev.get("lista", []) if ev.get("lista") is Array else []
	meu = str(ev.get("meu", ""))
	_por_solidos()
	_por_vilas()
	_por_enfeites()
	_por_forja()
	_tirar_arvores()

# as árvores da mata que ficam dentro de uma base saem (o servidor também tira: shared/base.js arvoresDaBase): some o
# desenho, a batida (andar.gd) e o "Cortar" (trabalho.gd). Bases não somem, então não precisa devolver.
var _tiradas := {}
func _tirar_arvores() -> void:
	for B in bases:
		for a in B.get("arvores", []):
			var id := str(a[0])
			if _tiradas.has(id):
				continue
			_tiradas[id] = true
			var p := Vector2(float(a[1]), float(a[2]))
			if m.arvores_mata.has(p):
				var c: Dictionary = m.arvores_mata[p]
				c.caida = true
				if m._sumindo.has(p):
					m._sumindo[p].no.queue_free()
					m._sumindo.erase(p)
				for parte in ["tronco", "copa", "longe"]:
					if c.has(parte):
						c[parte][0].set_instance_transform(c[parte][1], Transform3D(Basis().scaled(Vector3.ZERO), c.t.origin))
				if m.leve:
					m.leve.crescer(c, 0.0)
			if m.mov != null:
				var k := Vector2i(floori(p.x / 6.0), floori(p.y / 6.0))
				var l = m.mov.mata.get(k)
				if l != null:
					m.mov.mata[k] = l.filter(func(o): return not (is_equal_approx(float(o.x), p.x) and is_equal_approx(float(o.z), p.y)))
			var T = m.get("trabalho")
			if T != null and T.por_id.has(id):
				var o = T.por_id[id]
				T.por_id.erase(id)
				T.coletaveis.erase(o)
				for di in range(-1, 2):
					for dj in range(-1, 2):
						var gk := Vector2i(floori(p.x / 6.0) + di, floori(p.y / 6.0) + dj)
						if T.grade.has(gk):
							T.grade[gk].erase(o)

# a forja da minha base (Nv 4+) serve de bigorna, como a da ferraria (o servidor confere: shared/base.js forjaBasePerto)
func _por_forja() -> void:
	var C = m.get("construcao")
	if C == null:
		return
	C.publicas = C.publicas.filter(func(p): return str(p.id) != "base_forja")
	var B := minha()
	if not B.is_empty() and B.get("forja") is Dictionary:
		C.publicas.append({"id": "base_forja", "k": "bigorna", "x": float(B.forja.x), "z": float(B.forja.z), "ry": 0.0, "r": 0,
			"nome": "Forja do clã", "npc": "", "publica": true})

# a base em (x, z): a área dela (o chão de lá é o relevo, como nas vilas do mundo grande)
func base_em(x: float, z: float) -> Dictionary:
	for B in bases:
		var r := float(D_base().pegada) + 2.0
		if absf(float(B.x) - x) < r and absf(float(B.z) - z) < r:
			return B
	return {}

func D_base() -> Dictionary:
	return m.mundo.get("claBase", {"pegada": 44, "bauPerto": 2.6})

func minha() -> Dictionary:
	for B in bases:
		if str(B.k) == meu:
			return B
	return {}

# o herói está perto do Baú do Clã do salão da minha base
func bau_perto() -> bool:
	var B := minha()
	if B.is_empty() or m.heroi == null or not (B.get("bau") is Dictionary):
		return false
	var hp: Vector3 = m.heroi.position
	return Vector2(float(B.bau.x) - hp.x, float(B.bau.z) - hp.z).length() <= float(D_base().get("bauPerto", 2.6)) + 0.3

func dist_bau() -> float:
	var B := minha()
	if B.is_empty() or m.heroi == null or not (B.get("bau") is Dictionary):
		return INF
	return Vector2(float(B.bau.x) - m.heroi.position.x, float(B.bau.z) - m.heroi.position.z).length()

func _por_solidos() -> void:
	var T = m.terreno
	if T == null:
		return
	for r in _sol:
		T.solidos.erase(r)
		T.casas.erase(r)
	_sol.clear()
	for B in bases:
		for s in B.get("sol", []):
			var r := {"casa": true, "x": float(s.x), "z": float(s.z), "cos": float(s.cos), "sen": float(s.sen), "hw": float(s.hw), "hd": float(s.hd),
				"sobe": float(s.get("sobe", 0.0)), "y1": float(s.y1), "base": float(s.get("base", 0.0)), "R": float(s.R)}
			_sol.append(r)
	T.solidos.append_array(_sol)
	T.casas.append_array(_sol)
	T.solidos_mudaram()

# cada base vira uma vila no vilas_mundo.gd (casas = prédios; o resto = enfeites)
func _por_vilas() -> void:
	var V = m.get("vilas_mundo")
	if V == null:
		return
	var lista: Array = []
	for B in bases:
		var casas: Array = []
		var enfeites: Array = []
		for p in B.get("pecas", []):
			if str(p.m) in ["pedra_6x6", "sobrado_6x6", "aurora_pousada", "aurora_paco", "aurora_torre", "forja", "aurora_portao"]:
				casas.append(p)
			else:
				enfeites.append(p)
		lista.append({"id": "base_%s_%d" % [str(B.k), int(B.nv)], "x": float(B.x), "z": float(B.z), "casas": casas, "enfeites": enfeites})
	V.por_bases(lista)

# o Baú do Clã na porta do salão, as estacas nos cantos dos lotes e os nomes (clã em cima do salão, dono em cada lote)
func _por_enfeites() -> void:
	for n in _nos:
		if is_instance_valid(n):
			n.queue_free()
	_nos.clear()
	var C = m.get("construcao")
	for B in bases:
		var raiz := Node3D.new()
		raiz.name = "Base_" + str(B.k)
		add_child(raiz)
		_nos.append(raiz)
		if C != null and B.get("bau") is Dictionary and C._modelos.has("bau_cla"):
			var bau: Node3D = C._modelos["bau_cla"].duplicate()
			bau.position = Vector3(float(B.bau.x), float(B.bau.y), float(B.bau.z))
			raiz.add_child(bau)
		var cor := Color("8fd0ff") if str(B.get("raca", "")) == "geada" else Color("ff9a3c")
		var hz := float(B.z) - float(B.get("centro", 14)) / 2.0 + 4.0
		raiz.add_child(_nome("Clã %s · Nv %d" % [str(B.n), int(B.nv)], Vector3(float(B.x), _chao(float(B.x), hz) + 9.5, hz), cor, 64))
		for l in B.get("lotes", []):
			var x0 := float(l[1])
			var z0 := float(l[2])
			var x1 := float(l[3])
			var z1 := float(l[4])
			for q in [Vector2(x0, z0), Vector2(x1, z0), Vector2(x0, z1), Vector2(x1, z1)]:
				raiz.add_child(_estaca(Vector3(q.x, _chao(q.x, q.y), q.y)))
			var dono := str(l[5]) if l.size() > 5 else ""
			var cx := (x0 + x1) / 2.0
			var cz := (z0 + z1) / 2.0
			raiz.add_child(_nome("Lote %d · %s" % [int(l[0]), dono] if dono != "" else "Lote %d · livre" % int(l[0]), Vector3(cx, _chao(cx, cz) + 2.2, cz), Color("f3e3c2"), 40))

func _chao(x: float, z: float) -> float:
	return maxf(0.0, m.terreno.relevo(x, z)) if m.terreno != null else 0.0

var _mat_estaca: StandardMaterial3D
func _estaca(p: Vector3) -> Node3D:
	if _mat_estaca == null:
		_mat_estaca = StandardMaterial3D.new()
		_mat_estaca.albedo_color = Color(0.45, 0.3, 0.18)
		_mat_estaca.roughness = 0.9
	var mi := MeshInstance3D.new()
	var cil := CylinderMesh.new()
	cil.top_radius = 0.06
	cil.bottom_radius = 0.08
	cil.height = 1.1
	mi.mesh = cil
	mi.material_override = _mat_estaca
	mi.position = p + Vector3(0, 0.5, 0)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.visibility_range_end = VE_NOME
	# o pano vermelho do clã no alto da estaca
	var pano := MeshInstance3D.new()
	var bx := BoxMesh.new()
	bx.size = Vector3(0.02, 0.22, 0.32)
	pano.mesh = bx
	var mt := StandardMaterial3D.new()
	mt.albedo_color = Color(0.62, 0.12, 0.1)
	pano.material_override = mt
	pano.position = Vector3(0, 0.4, 0.16)
	mi.add_child(pano)
	return mi

func _nome(txt: String, p: Vector3, cor: Color, tam: int) -> Label3D:
	var l := Label3D.new()
	l.text = Idioma.frase(txt)
	l.position = p
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.font_size = tam
	l.pixel_size = 0.006
	l.modulate = cor
	l.outline_size = 10
	l.outline_modulate = Color(0.05, 0.04, 0.03, 0.9)
	l.no_depth_test = false
	l.visibility_range_end = VE_NOME if tam < 60 else 160.0
	return l

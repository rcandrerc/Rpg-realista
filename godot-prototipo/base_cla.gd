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
	_chao_das_bases() # antes de tudo: as peças e as estacas ficam no chão novo
	_por_solidos()
	_por_vilas()
	_por_enfeites()
	_por_forja()
	_tirar_arvores()
	# a batida dos móveis dos lotes da base usa o chão da base (construcao.gd _chao: base_em); se os lotes chegaram antes
	# das bases, ela ficou no chão 0 e o herói passava por cima (André 2026-11-23: "os móveis ficaram não sólidos")
	if m.construcao != null and m.construcao.has_method("_refazer_solidos"):
		m.construcao._refazer_solidos()

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
	C.publicas = C.publicas.filter(func(p): return not (str(p.id) in ["base_forja", "base_bau", "base_fornalha"]))
	var B := minha()
	# o Baú do Clã da porta do salão também é estação: o botão do baú vai até ele (até 2026-11-22: "Não achei caminho")
	if not B.is_empty() and B.get("bau") is Dictionary:
		C.publicas.append({"id": "base_bau", "k": "bau_cla", "x": float(B.bau.x), "z": float(B.bau.z), "ry": 0.0, "r": 0,
			"nome": "Baú do Clã", "npc": "", "publica": true})
	if not B.is_empty() and B.get("forja") is Dictionary:
		C.publicas.append({"id": "base_forja", "k": "bigorna", "x": float(B.forja.x), "z": float(B.forja.z), "ry": 0.0, "r": 0,
			"nome": "Forja do clã", "npc": "", "publica": true})
		if B.forja.has("fx"): # a fornalha no fundo do galpão (cada um com a sua carga, como o forninho da ferraria)
			C.publicas.append({"id": "base_fornalha", "k": "fornalha", "x": float(B.forja.fx), "z": float(B.forja.fz), "ry": 0.0, "r": 0,
				"nome": "Fornalha do clã", "npc": "", "publica": true})

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

# cada base vira uma vila no vilas_mundo.gd (casas = prédios; o resto = enfeites). O id leva o lugar: a base que muda de
# lugar (André 2026-11-22: "mudei a base e ela n foi") é outra vila, e a velha sai
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
		lista.append({"id": "base_%s_%d_%d_%d" % [str(B.k), int(B.nv), int(B.x), int(B.z)], "x": float(B.x), "z": float(B.z), "casas": casas, "enfeites": enfeites})
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
			var bau: Node3D = C._copia("bau_cla") # _copia: o modelo guardado é escondido (até 2026-11-22 o baú não aparecia)
			bau.position = Vector3(float(B.bau.x), float(B.bau.y), float(B.bau.z))
			raiz.add_child(bau)
		# a bigorna embaixo do telheiro da forja (Nv 4+): a forja do clã serve de bigorna (André 2026-11-22: "mostra q tenho
		# fornalha mas n aparece")
		if C != null and B.get("forja") is Dictionary and C._modelos.has("bigorna"):
			var bg: Node3D = C._copia("bigorna")
			bg.position = Vector3(float(B.forja.x), _chao(float(B.forja.x), float(B.forja.z)), float(B.forja.z))
			raiz.add_child(bg)
			# a fornalha no fundo do galpão (André 2026-11-23: "o fogão sumiu de novo"); a bigorna fica na frente, do lado de fora
			if B.forja.has("fx") and C._modelos.has("fornalha"):
				var fo: Node3D = C._copia("fornalha")
				var piso := _chao(float(B.forja.fx), float(B.forja.fz))
				for p in B.get("pecas", []):
					if str(p.m) == "forja":
						piso = float(p.y) + 0.03 # o piso de pedra do galpão (shared/base.js montarBase)
				fo.position = Vector3(float(B.forja.fx), piso, float(B.forja.fz)) # a boca da fornalha olha para a frente (+z)
				raiz.add_child(fo)
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

# ---------- escolher o lugar da base (André 2026-11-22: "a gente sai do menu e pode escolher exatamente onde a gente
# quer posicionar") ----------
# "Escolher o lugar da base" no painel do Clã fecha o menu e liga a prévia: o contorno da base no Nv 6 (o centro e os 6
# lotes, o tamanho máximo, que é o que as regras conferem) anda junto com o herói, verde onde pode e vermelho onde não
# pode (o servidor confere com as mesmas regras de fundar: shared/base.js verLugarBase). Embaixo, o motivo e os botões
# "Fundar aqui" e "Cancelar".
var posicionando := false
var _prev: MultiMeshInstance3D
var _prev_mat: StandardMaterial3D
var _ui: CanvasLayer
var _ui_txt: Label
var _ui_ok: Button
var _ver_t := 0.0
var _ver_pos := Vector2(INF, INF)
var _ver_ok := false
var _ver_resp := Vector2(INF, INF)

func comecar_escolha() -> void:
	posicionando = true
	_ver_pos = Vector2(INF, INF)
	_ver_resp = Vector2(INF, INF)
	_ver_ok = false
	if _prev == null:
		_prev = MultiMeshInstance3D.new()
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		var bx := BoxMesh.new()
		bx.size = Vector3(2.05, 0.12, 0.35)
		mm.mesh = bx
		_prev.multimesh = mm
		_prev_mat = StandardMaterial3D.new()
		_prev_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_prev_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_prev.material_override = _prev_mat
		_prev.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(_prev)
	_prev.visible = true
	if _ui == null:
		_ui = CanvasLayer.new()
		_ui.layer = 20
		add_child(_ui)
		var cx := PanelContainer.new()
		cx.anchor_left = 0.5
		cx.anchor_right = 0.5
		cx.offset_left = -330
		cx.offset_right = 330
		cx.offset_top = 70
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(0.08, 0.06, 0.04, 0.85)
		sb.set_corner_radius_all(12)
		sb.set_content_margin_all(10)
		cx.add_theme_stylebox_override("panel", sb)
		_ui.add_child(cx)
		var v := VBoxContainer.new()
		v.add_theme_constant_override("separation", 8)
		cx.add_child(v)
		_ui_txt = Label.new()
		_ui_txt.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_ui_txt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_ui_txt.add_theme_font_size_override("font_size", 18)
		v.add_child(_ui_txt)
		var h := HBoxContainer.new()
		h.alignment = BoxContainer.ALIGNMENT_CENTER
		h.add_theme_constant_override("separation", 14)
		v.add_child(h)
		_ui_ok = _botao("Fundar aqui", func(): m.rede("cla", {"acao": "base"}))
		h.add_child(_ui_ok)
		h.add_child(_botao("Cancelar", parar_escolha))
	_ui.visible = true
	_mostrar("Ande até onde quer a base. O contorno mostra o tamanho máximo (Nv 6).", Color(1, 0.95, 0.8), false)

func _botao(t: String, fn: Callable) -> Button:
	var b := Button.new()
	b.text = Idioma.frase(t)
	b.custom_minimum_size = Vector2(180, 54)
	b.add_theme_font_size_override("font_size", 20)
	b.pressed.connect(fn)
	return b

func parar_escolha() -> void:
	posicionando = false
	if _prev != null:
		_prev.visible = false
	if _ui != null:
		_ui.visible = false

func _mostrar(t: String, cor: Color, pode: bool) -> void:
	_ui_txt.text = Idioma.frase(t)
	_ui_txt.add_theme_color_override("font_color", cor)
	_ui_ok.disabled = not pode

# resposta do servidor (evento "baseVer")
func ver_resposta(ev: Dictionary) -> void:
	if not posicionando:
		return
	_ver_resp = Vector2(float(ev.get("x", 0)), float(ev.get("z", 0)))
	_ver_ok = bool(ev.get("ok", false))
	if _ver_ok:
		_mostrar("Pode fundar aqui!", Color(0.55, 1.0, 0.6), true)
	else:
		_mostrar(str(ev.get("motivo", "Aqui não pode")), Color(1.0, 0.55, 0.45), false)
	_cor_prev()

func _cor_prev() -> void:
	if _prev_mat == null:
		return
	var certo := _ver_resp.distance_to(_ver_pos) < 0.6
	_prev_mat.albedo_color = Color(0.25, 1.0, 0.4, 0.85) if certo and _ver_ok else (Color(1.0, 0.3, 0.25, 0.85) if certo else Color(1.0, 0.9, 0.5, 0.7))

func _process(dt: float) -> void:
	if not posicionando:
		return
	if not meu.is_empty() or m.heroi == null:
		parar_escolha()
		return
	var p := Vector2(roundf(m.heroi.position.x), roundf(m.heroi.position.z))
	if p != _ver_pos:
		_ver_pos = p
		_desenhar_prev(p)
		_cor_prev()
		if _ui_ok:
			_ui_ok.disabled = true
	_ver_t -= dt
	if _ver_t <= 0.0 and _ver_resp.distance_to(_ver_pos) > 0.6:
		_ver_t = 0.5
		m.rede("cla", {"acao": "baseVer"})

# o contorno: o quadrado do centro no Nv 6 e os 6 lotes (as mesmas medidas de shared/base.js retangulosBase), em pedaços
# de 2 m que acompanham o chão
func _desenhar_prev(c: Vector2) -> void:
	var D := m.mundo.get("claBase", {}) as Dictionary
	var hc := float(D.get("centroMax", 34)) / 2.0
	var hl := float(D.get("lote", 10)) / 2.0
	var lugares: Array = D.get("lugares", [[26, 0], [-26, 0], [0, -26], [0, 26], [26, -26], [-26, 26]])
	var rets: Array = [Rect2(c.x - hc, c.y - hc, hc * 2, hc * 2)]
	for l in lugares:
		rets.append(Rect2(c.x + float(l[0]) - hl, c.y + float(l[1]) - hl, hl * 2, hl * 2))
	var ts: Array = []
	for r in rets:
		var cantos := [r.position, Vector2(r.end.x, r.position.y), r.end, Vector2(r.position.x, r.end.y)]
		for i in 4:
			var a: Vector2 = cantos[i]
			var b: Vector2 = cantos[(i + 1) % 4]
			var n := maxi(1, int(ceilf(a.distance_to(b) / 2.0)))
			var ang := atan2(b.y - a.y, b.x - a.x)
			for k in n:
				var q := a.lerp(b, (k + 0.5) / n)
				var t := Transform3D(Basis(Vector3.UP, -ang), Vector3(q.x, _chao(q.x, q.y) + 0.12, q.y))
				ts.append(t)
	var mm := _prev.multimesh
	mm.instance_count = ts.size()
	for i in ts.size():
		mm.set_instance_transform(i, ts[i])

# ---------- chão nivelado e estrada da base (André 2026-11-23; a mesma conta do servidor: shared/terrapleno.js) ----------
# O servidor manda o y do platô, até onde a rampa vai (wmax) e os pontos da estrada [x, z, y, ...]. Aqui a grade do
# mundo (terreno.gd mundo_g.h) muda igual à do servidor: o chão volta ao de antes onde a base saiu, e os pedaços do chão,
# o mato e as árvores em volta são refeitos. A estrada é uma faixa de terra batida em cima do chão.
const TP := {"meio": 33.0, "rampa": 0.25, "wMin": 6.0, "wMax": 90.0, "larg": 5.6, "borda": 11.0} # larg 5,6: os 4 cantos da grade embaixo da estrada ficam no perfil (o chão desenhado não cobre a estrada)
var _chao_sig := ""
var _orig := {} # k da grade -> altura de antes
var _estradas: Array = [] # MeshInstance3D das estradas
var _na_estrada := {} # Vector2i(x / 2, z / 2) -> true (o mato não nasce na estrada)
var _mat_estrada: ShaderMaterial
var _ruas := {} # chave da base -> pontos da estrada (Vector3: x, y, z)

# o "Ir" (rota.gd) entra e sai da base pelo portão: da frente do Baú do Clã, um pouco de lado (a fogueira fica no meio),
# até o portão e daí pela estrada da base
func _rede_rota() -> void:
	var R = m.get("rota")
	if R == null or not R.has_method("por_bases"):
		return
	var linhas := {}
	for B in bases:
		var pts: Array = _ruas.get(str(B.k), [])
		if pts.is_empty() or not (B.get("bau") is Dictionary):
			continue
		var hc := float(B.get("centro", 14)) / 2.0
		var bx := float(B.x)
		var bz := float(B.z)
		var l: Array = [Vector2(float(B.bau.x) + 1.6, float(B.bau.z) + 1.3), Vector2(bx + 1.6, bz + hc - 1.0), Vector2(bx + 1.0, bz + hc + 1.5)]
		for p in pts:
			l.append(Vector2(p.x, p.z))
		linhas[str(B.k)] = l
	R.por_bases(linhas)

static func _sv(t: float) -> float:
	var u := clampf(t, 0.0, 1.0)
	return u * u * (3.0 - 2.0 * u)

static func ruido_chao(x: float, z: float) -> float:
	return 0.6 * sin(x * 0.21 + z * 0.13) + 0.4 * sin(z * 0.29 - x * 0.17)

func _rio_em(g: Dictionary, k: int) -> bool:
	var rio: String = g.get("rio", "")
	return rio.length() > k and rio.unicode_at(k) > 48

func _chao_das_bases() -> void:
	var T = m.terreno
	if T == null or T.mundo_g.is_empty():
		return
	var lista: Array = []
	for B in bases:
		var c = B.get("chao")
		if c is Dictionary and c.get("y") != null:
			lista.append({"k": str(B.k), "x": float(B.x), "z": float(B.z), "y": float(c.y), "wmax": float(c.get("wmax", 0.0)), "e": c.get("estrada", [])})
	lista.sort_custom(func(a, b): return str(a.k) < str(b.k))
	var sig := JSON.stringify(lista)
	if sig == _chao_sig:
		return
	_chao_sig = sig
	var g: Dictionary = T.mundo_g
	var h: PackedFloat32Array = g.h
	var mexidos := {}
	for k in _orig: # o chão de antes volta
		h[k] = _orig[k]
		mexidos[k] = true
	_orig.clear()
	g.h = h
	# as árvores da mata em volta guardam a altura de antes (para subir e descer junto com o chão)
	var ed := {}
	for b in lista:
		_aplainar(g, h, ed, float(b.x), float(b.z), float(b.y), float(b.wmax))
	var centros: Array = lista.map(func(b): return Vector2(float(b.x), float(b.z)))
	var caminhos: Array = []
	_ruas.clear()
	for b in lista:
		var pts: Array = []
		var e: Array = b.e
		for i in range(0, e.size() - 2, 3):
			pts.append(Vector3(float(e[i]), float(e[i + 2]), float(e[i + 1]))) # x, y, z
		caminhos.append(pts)
		_cortar(g, h, ed, pts, centros)
		_ruas[str(b.k)] = pts
	for k in ed:
		_orig[k] = h[k]
		mexidos[k] = true
	var area := Rect2()
	var tem_area := false
	var nx: int = g.nx
	for k in mexidos:
		var p := Vector2(float(g.x0) + (int(k) % nx) * float(g.passo), float(g.z0) + (int(k) / nx) * float(g.passo))
		if not tem_area:
			area = Rect2(p, Vector2.ZERO)
			tem_area = true
		else:
			area = area.expand(p)
	area = area.grow(6.0)
	_guardar_arvores(area)
	for k in ed:
		h[k] = ed[k]
	g.h = h # PackedFloat32Array é valor: volta para o dicionário
	_arrumar_arvores(area)
	var MT = m.get_node_or_null("MundoGrande")
	if MT != null and MT.has_method("refazer"):
		MT.refazer(mexidos)
	if m.mato != null and tem_area:
		m.mato.refazer_area(area.position.x, area.position.y, area.end.x, area.end.y)
	_desenhar_estradas(caminhos)
	_rede_rota()
	var C = m.get("construcao")
	if C != null and tem_area and C.has_method("chao_mudou"):
		C.chao_mudou(area) # terra arada e peças dos lotes descem ou sobem junto com o chão

func _aplainar(g: Dictionary, h: PackedFloat32Array, ed: Dictionary, x: float, z: float, y: float, wmax: float) -> void:
	var R: float = TP.meio + wmax
	var passo: float = g.passo
	var nx: int = g.nx
	var i0 := maxi(0, ceili((x - R - float(g.x0)) / passo))
	var i1 := mini(nx - 1, floori((x + R - float(g.x0)) / passo))
	var j0 := maxi(0, ceili((z - R - float(g.z0)) / passo))
	var j1 := mini(int(g.nz) - 1, floori((z + R - float(g.z0)) / passo))
	for j in range(j0, j1 + 1):
		for i in range(i0, i1 + 1):
			var k := j * nx + i
			var o: float = h[k]
			if o < 0.1 or _rio_em(g, k): # o mar não muda; a areia da beira sobe junto (shared/terrapleno.js AREIA)
				continue
			var px: float = float(g.x0) + i * passo
			var pz: float = float(g.z0) + j * passo
			var dx := absf(px - x)
			var dz := absf(pz - z)
			var d := Vector2(maxf(dx - TP.meio, 0.0), maxf(dz - TP.meio, 0.0)).length()
			var n := ruido_chao(px, pz)
			if d <= 0.0:
				ed[k] = y # plano de verdade dentro (a grama furava a terra arada); a ondinha fica na rampa
				continue
			var cur: float = ed.get(k, o)
			var diff := cur - y
			var W := minf(wmax, maxf(TP.wMin, minf(TP.wMax, absf(diff) / TP.rampa)))
			if d >= W:
				continue
			var s := _sv(d / W)
			ed[k] = y + n * 0.3 * s * (1.0 - s) * 4.0 + diff * s

func _cortar(g: Dictionary, h: PackedFloat32Array, ed: Dictionary, pts: Array, centros: Array) -> void:
	if pts.size() < 2:
		return
	var passo: float = g.passo
	var nx: int = g.nx
	var nz: int = g.nz
	# o segmento mais perto de cada ponto da grade (só olha a caixinha de cada segmento: leve no celular)
	var melhor := {} # k -> [dist, y]
	for s in range(1, pts.size()):
		var a: Vector3 = pts[s - 1]
		var b: Vector3 = pts[s]
		var vx := b.x - a.x
		var vz := b.z - a.z
		var L := vx * vx + vz * vz
		var i0 := maxi(0, ceili((minf(a.x, b.x) - TP.borda - float(g.x0)) / passo))
		var i1 := mini(nx - 1, floori((maxf(a.x, b.x) + TP.borda - float(g.x0)) / passo))
		var j0 := maxi(0, ceili((minf(a.z, b.z) - TP.borda - float(g.z0)) / passo))
		var j1 := mini(nz - 1, floori((maxf(a.z, b.z) + TP.borda - float(g.z0)) / passo))
		for j in range(j0, j1 + 1):
			for i in range(i0, i1 + 1):
				var px: float = float(g.x0) + i * passo
				var pz: float = float(g.z0) + j * passo
				var t := clampf(((px - a.x) * vx + (pz - a.z) * vz) / L, 0.0, 1.0) if L > 0.0 else 0.0
				var dd := Vector2(px - a.x - t * vx, pz - a.z - t * vz).length()
				var k := j * nx + i
				if dd < TP.borda and (not melhor.has(k) or dd < float(melhor[k][0])):
					melhor[k] = [dd, a.y + (b.y - a.y) * t]
	for k in melhor:
		var o: float = h[k]
		if o < 0.1 or _rio_em(g, k):
			continue
		var px: float = float(g.x0) + (int(k) % nx) * passo
		var pz: float = float(g.z0) + (int(k) / nx) * passo
		var dentro := false
		for c in centros:
			if absf(px - c.x) <= TP.meio and absf(pz - c.y) <= TP.meio:
				dentro = true
				break
		if dentro:
			continue
		var best: float = melhor[k][0]
		var by: float = melhor[k][1]
		var w := 1.0 if best <= TP.larg else 1.0 - _sv((best - TP.larg) / (TP.borda - TP.larg))
		var cur: float = ed.get(k, o)
		ed[k] = cur + (by - 0.05 - cur) * w

# árvores da mata na área: a altura delas acompanha o chão (sobe ou desce o mesmo tanto)
func _guardar_arvores(area: Rect2) -> void:
	for p in m.arvores_mata:
		if not area.has_point(p):
			continue
		var c: Dictionary = m.arvores_mata[p]
		if not c.has("h0"):
			c.h0 = m.terreno.altura_montanha(p.x, p.y)
			c.y0 = c.t.origin.y

func _arrumar_arvores(area: Rect2) -> void:
	for p in m.arvores_mata:
		if not area.has_point(p):
			continue
		var c: Dictionary = m.arvores_mata[p]
		if not c.has("h0") or c.get("caida", false):
			continue
		var y: float = float(c.y0) + m.terreno.altura_montanha(p.x, p.y) - float(c.h0)
		if is_equal_approx(y, c.t.origin.y):
			continue
		c.t.origin.y = y
		for parte in ["tronco", "copa", "longe"]:
			if c.has(parte):
				var mm: MultiMesh = c[parte][0]
				var tr: Transform3D = mm.get_instance_transform(c[parte][1])
				tr.origin.y = y
				mm.set_instance_transform(c[parte][1], tr)

# a altura do chão como o mundo_terreno.gd desenha (dois triângulos por quadrado de 4 m, com a diagonal dele): a estrada
# fica sempre em cima do desenho (André 2026-11-23: "não tem estrada": a bilinear ficava embaixo dos triângulos)
static func _altura_tri(g: Dictionary, x: float, z: float) -> float:
	if g.is_empty():
		return 0.0
	var passo: float = g.passo
	var nx: int = g.nx
	var fx: float = (x - float(g.x0)) / passo
	var fz: float = (z - float(g.z0)) / passo
	if fx < 0.0 or fz < 0.0 or fx >= nx - 1 or fz >= int(g.nz) - 1:
		return 0.0
	var i := int(fx)
	var j := int(fz)
	var u := fx - i
	var v := fz - j
	var h: PackedFloat32Array = g.h
	var ya: float = h[j * nx + i]
	var yb: float = h[j * nx + i + 1]
	var yc: float = h[(j + 1) * nx + i]
	var yd: float = h[(j + 1) * nx + i + 1]
	if absf(ya - yd) < absf(yb - yc): # diagonal a-d
		return ya + (yb - ya) * u + (yd - yb) * v if u >= v else ya + (yd - yc) * u + (yc - ya) * v
	# diagonal b-c
	return ya + (yb - ya) * u + (yc - ya) * v if u + v <= 1.0 else yd + (yc - yd) * (1.0 - u) + (yb - yd) * (1.0 - v)

# a estrada é do mato? (pontos a cada 2 m; a borda fica rala, não reta)
func na_estrada(x: float, z: float, sorte := 0.5) -> bool:
	if _na_estrada.is_empty():
		return false
	return _na_estrada.has(Vector2i(floori(x / 2.0), floori(z / 2.0))) and sorte < 0.92

func _desenhar_estradas(caminhos: Array) -> void:
	for n in _estradas:
		if is_instance_valid(n):
			n.queue_free()
	_estradas.clear()
	_na_estrada.clear()
	if _mat_estrada == null:
		_mat_estrada = ShaderMaterial.new()
		_mat_estrada.shader = load("res://estrada_base.gdshader")
		_mat_estrada.set_shader_parameter("terra_tex", load("res://modelos/stony_dirt_path.jpg"))
		_mat_estrada.render_priority = 1
	var T = m.terreno
	for pts in caminhos:
		if pts.size() < 2:
			continue
		var vs := PackedVector3Array()
		var ns := PackedVector3Array()
		var uvs := PackedVector2Array()
		var idx := PackedInt32Array()
		const COL := [-2.7, -1.35, 0.0, 1.35, 2.7]
		var dist := 0.0
		for i in pts.size():
			var a: Vector3 = pts[maxi(0, i - 1)]
			var b: Vector3 = pts[mini(pts.size() - 1, i + 1)]
			var dir := Vector2(b.x - a.x, b.z - a.z)
			dir = dir.normalized() if dir.length() > 0.001 else Vector2(0, 1)
			var lado := Vector2(-dir.y, dir.x)
			if i > 0:
				dist += Vector2(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z).length()
			for c in COL.size():
				var pi3: Vector3 = pts[i]
				var q: Vector2 = Vector2(pi3.x, pi3.z) + lado * float(COL[c])
				var y: float = maxf(T.altura_montanha(q.x, q.y), _altura_tri(T.mundo_g, q.x, q.y))
				vs.append(Vector3(q.x, y + 0.08, q.y))
				var gx: float = T.altura_montanha(q.x + 1.0, q.y) - T.altura_montanha(q.x - 1.0, q.y)
				var gz: float = T.altura_montanha(q.x, q.y + 1.0) - T.altura_montanha(q.x, q.y - 1.0)
				ns.append(Vector3(-gx, 2.0, -gz).normalized())
				uvs.append(Vector2(float(c) / (COL.size() - 1), dist))
			for r in range(-1, 2):
				for s in range(-1, 2):
					_na_estrada[Vector2i(floori(pts[i].x / 2.0) + r, floori(pts[i].z / 2.0) + s)] = true
		var w: int = COL.size()
		for i in pts.size() - 1:
			for c in w - 1:
				var q: int = i * w + c
				idx.append_array([q, q + w, q + 1, q + 1, q + w, q + w + 1])
		var arr := []
		arr.resize(Mesh.ARRAY_MAX)
		arr[Mesh.ARRAY_VERTEX] = vs
		arr[Mesh.ARRAY_NORMAL] = ns
		arr[Mesh.ARRAY_TEX_UV] = uvs
		arr[Mesh.ARRAY_INDEX] = idx
		var mesh := ArrayMesh.new()
		mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		var mi := MeshInstance3D.new()
		mi.name = "EstradaBase"
		mi.mesh = mesh
		mi.material_override = _mat_estrada
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.visibility_range_end = 500.0
		add_child(mi)
		_estradas.append(mi)

extends Node3D
# Vila dos Lotes: construção e fazenda do Quimera (pedido do André 2026-11-03).
# Cada jogador compra UM lote (placa "À venda" na beira da rua) e só constrói e planta dentro dele.
# Modo construção como no Quimera: abas Construir e Fazenda, fantasma verde (pode) ou vermelho (não pode, com o
# motivo), Girar, Colocar, Desmontar e Sair. O fantasma fica na frente do herói; tocar no chão leva a mira para lá.
# Quem decide é o servidor (shared/simulacao.js: comprarLote, construir, desmontar, horta); aqui só se mostra e se
# pede. As contas de "pode ou não pode" são as mesmas do servidor (motivoPeca / motivoHorta), para o fantasma
# já ficar vermelho antes de mandar.
# Números: dados/habilidades.json (lote, construcoes, plantas, horta) · lotes: dados/mundo.json (lotes)
# Modelos: construcao3d/ (Quaternius CC0: Workbench, Anvil_Log, Prop_WoodenFence_Single); a fornalha é de pedra,
# montada aqui com a mesma pedra e brasa da forja da ferraria da vila.

const Menu = preload("res://menu.gd")

var m # main.gd
var D: Dictionary # m.P.dados
var lotes := {} # id -> {def, dono (nome ou null), pecas: [{id, k, x, z, r, no}], horta: {"i,j": {c, g, w, u, no, fase, molhada}}, placa: Label3D, raiz}
var meu := "" # id do meu lote ("" = não tenho)
var relogio := 0.0 # ms do servidor menos ms deste celular (a horta cresce igual nos dois)
var _modelos := {} # k -> Node3D modelo (escondido) para duplicar
var _mats := {}
var _t_horta := 0.0

# modo construção
var ativo := false
var aba := "construir" # "construir" ou "fazenda"
var sel := "bancada" # peça (CONSTRUCOES), "desmontar" ou ação da fazenda ("arar", "plantar", "regar", "colher", "tirar")
var semente := "rabanete"
var giro := 0 # 0..3 (x 90°)
var mira_fixa = null # Vector3: tocou no chão; o joystick solta a mira de volta para a frente do herói
var alvo := {} # o que o botão Colocar vai fazer agora: {ok, motivo, msg (tipo, dados), x, z}
var fantasma: Node3D
var _fantasma_k := ""
var _mat_ok: StandardMaterial3D
var _mat_nao: StandardMaterial3D
var _destaque: MeshInstance3D # peça marcada para desmontar / quadrado da horta
var _borda_lote: MeshInstance3D # contorno do meu lote no chão (só no modo construção)

# tela
var tela: CanvasLayer
var painel: PanelContainer
var linha_abas: HBoxContainer
var linha_itens: HFlowContainer
var b_girar: Button
var b_ok: Button
var b_sair: Button
var txt_motivo: Label
var _botoes_abas := {}
var compra: Control # janela "Comprar o lote?"
var _lote_perto := "" # placa livre perto (botão Comprar)

const FRENTE_PECA := 2.2 # m: onde o fantasma fica na frente do herói
const FRENTE_HORTA := 1.3

func _init(principal) -> void:
	m = principal
	D = m.P.dados

func _ready() -> void:
	_mat_ok = _mat_fantasma(Color(0.43, 1.0, 0.54, 0.45))
	_mat_nao = _mat_fantasma(Color(1.0, 0.35, 0.29, 0.45))
	_carregar_modelos()
	for l in m.mundo.get("lotes", []):
		var L := {"def": l, "dono": null, "pecas": [], "horta": {}, "raiz": Node3D.new()}
		L.raiz.name = "Lote_" + str(l.id)
		add_child(L.raiz)
		lotes[str(l.id)] = L
		_montar_lote(L)
	_montar_tela()
	# botões da HUD: comprar (perto da placa livre), construir (no meu lote) e a bancada (perto dela: Alfaiate)
	m.hud._botao("construir", Vector2(597, 160), 30, "construir", m.hud.COR_TROCA)
	m.hud.botoes[-1].oculto = true
	m.hud._botao("lote", Vector2(597, 160), 30, "lote", m.hud.COR_TROCA)
	m.hud.botoes[-1].oculto = true
	m.hud._botao("bancada", Vector2(333, 160), 30, "pf_alf", m.hud.COR_TROCA)
	m.hud.botoes[-1].oculto = true

# ---------- modelos ----------
func _carregar_modelos() -> void:
	_modelos["bancada"] = _modelo_gltf("res://construcao3d/Workbench.gltf", 1.0)
	_modelos["bigorna"] = _modelo_gltf("res://construcao3d/Anvil_Log.gltf", 1.1)
	_modelos["cerca"] = _modelo_gltf("res://construcao3d/Prop_WoodenFence_Single.gltf", 0.97)
	_modelos["fornalha"] = _modelo_fornalha()
	for k in _modelos:
		_modelos[k].visible = false
		add_child(_modelos[k])

func _modelo_gltf(caminho: String, escala: float) -> Node3D:
	var raiz := Node3D.new()
	var cena = load(caminho)
	if cena:
		var f: Node3D = cena.instantiate()
		f.scale = Vector3.ONE * escala
		raiz.add_child(f)
		m.pintar(raiz, false) # mesmo jeito pintado da vila (toon, sem brilho de plástico)
	return raiz

# material com textura de verdade (mesmas da vila), em coordenadas do mundo para não esticar
func _mat_tex(nome: String, cor: Color, escala := 1.0) -> StandardMaterial3D:
	var k := nome + cor.to_html()
	if _mats.has(k):
		return _mats[k]
	var mt := StandardMaterial3D.new()
	mt.albedo_texture = load("res://construcao3d/%s_diff_1k.jpg" % nome)
	mt.albedo_color = cor
	mt.uv1_triplanar = true
	mt.uv1_world_triplanar = true
	mt.uv1_scale = Vector3.ONE * escala
	mt.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	mt.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	mt.roughness = 1.0
	_mats[k] = mt
	return mt

func _mat_cor(cor: Color, brilho := 0.0) -> StandardMaterial3D:
	var k := cor.to_html() + str(brilho)
	if _mats.has(k):
		return _mats[k]
	var mt := StandardMaterial3D.new()
	mt.albedo_color = cor
	mt.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	mt.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	mt.roughness = 1.0
	if brilho > 0.0:
		mt.emission_enabled = true
		mt.emission = cor
		mt.emission_energy_multiplier = brilho
	_mats[k] = mt
	return mt

func _caixa(pai: Node3D, tam: Vector3, pos: Vector3, mat: Material, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = tam
	mi.mesh = bm
	mi.material_override = mat
	mi.position = pos
	mi.rotation = rot
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	pai.add_child(mi)
	return mi

# Fornalha: bloco de pedra com a boca acesa (brasa), grelha de ferro e chaminé atrás (como a forja do Tomás)
func _modelo_fornalha() -> Node3D:
	var r := Node3D.new()
	var pedra := _mat_tex("stacked_stone_wall", Color("cfc6bc"), 1.4)
	var escuro := _mat_cor(Color(0.09, 0.07, 0.06))
	var brasa := _mat_cor(Color(1.0, 0.42, 0.12), 2.6)
	var ferro := _mat_cor(Color(0.2, 0.2, 0.22))
	_caixa(r, Vector3(1.36, 0.82, 1.1), Vector3(0, 0.41, 0), pedra)
	_caixa(r, Vector3(1.2, 0.2, 0.96), Vector3(0, 0.92, -0.02), pedra)
	_caixa(r, Vector3(1.04, 0.14, 0.8), Vector3(0, 1.09, -0.04), pedra)
	# boca: buraco escuro com a brasa no fundo e a grelha na frente
	_caixa(r, Vector3(0.56, 0.4, 0.05), Vector3(0, 0.46, 0.53), escuro)
	_caixa(r, Vector3(0.46, 0.08, 0.04), Vector3(0, 0.3, 0.55), brasa)
	_caixa(r, Vector3(0.36, 0.12, 0.04), Vector3(0, 0.38, 0.552), _mat_cor(Color(1.0, 0.62, 0.2), 1.8))
	for i in 4:
		_caixa(r, Vector3(0.025, 0.4, 0.025), Vector3(-0.2 + i * 0.133, 0.46, 0.575), ferro)
	_caixa(r, Vector3(0.64, 0.06, 0.08), Vector3(0, 0.69, 0.56), pedra)
	# chaminé
	_caixa(r, Vector3(0.44, 1.25, 0.42), Vector3(0, 1.62, -0.3), pedra)
	_caixa(r, Vector3(0.52, 0.08, 0.5), Vector3(0, 2.27, -0.3), pedra)
	_caixa(r, Vector3(0.22, 0.02, 0.2), Vector3(0, 2.32, -0.3), escuro)
	return r

func _mat_fantasma(cor: Color) -> StandardMaterial3D:
	var mt := StandardMaterial3D.new()
	mt.albedo_color = cor
	mt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mt.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mt.no_depth_test = false
	mt.cull_mode = BaseMaterial3D.CULL_DISABLED
	return mt

func _copia(k: String) -> Node3D:
	var n: Node3D = _modelos[k].duplicate()
	n.visible = true
	return n

# ---------- lotes: estacas, corda e placa ----------
func _montar_lote(L: Dictionary) -> void:
	var l: Dictionary = L.def
	var madeira := _mat_tex("medieval_wood", Color("a08a72"), 1.6)
	var corda := _mat_cor(Color(0.62, 0.52, 0.36))
	var x0 := float(l.x0)
	var x1 := float(l.x1)
	var z0 := float(l.z0)
	var z1 := float(l.z1)
	var cantos := [Vector2(x0, z0), Vector2(x1, z0), Vector2(x1, z1), Vector2(x0, z1)]
	for c in cantos:
		var e := _caixa(L.raiz, Vector3(0.12, 0.9, 0.12), Vector3(c.x, 0.45, c.y), madeira)
		e.position.y = m.terreno.altura(c.x, c.y) + 0.45
	# corda nos três lados de trás (a frente fica aberta para a rua)
	var frente_x := x1 if str(l.frente) == "leste" else x0
	for i in 4:
		var a: Vector2 = cantos[i]
		var b: Vector2 = cantos[(i + 1) % 4]
		if is_equal_approx(a.x, frente_x) and is_equal_approx(b.x, frente_x):
			continue
		var meio := (a + b) / 2.0
		var comp := a.distance_to(b)
		var cx := _caixa(L.raiz, Vector3(comp, 0.025, 0.025), Vector3(meio.x, m.terreno.altura(meio.x, meio.y) + 0.62, meio.y), corda)
		cx.rotation.y = -atan2(b.y - a.y, b.x - a.x)
		cx.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# placa: poste e tábua com o nome do lote (À venda / dono)
	var p: Dictionary = l.placa
	var placa := Node3D.new()
	placa.position = Vector3(float(p.x), m.terreno.altura(float(p.x), float(p.z)), float(p.z))
	placa.rotation.y = float(p.ry)
	L.raiz.add_child(placa)
	_caixa(placa, Vector3(0.12, 1.5, 0.12), Vector3(0, 0.75, 0), madeira)
	_caixa(placa, Vector3(1.3, 0.62, 0.07), Vector3(0, 1.3, 0.02), madeira)
	var txt := Label3D.new()
	txt.font = m.fonte_nome()
	txt.font_size = 64
	txt.pixel_size = 0.0045
	txt.outline_size = 10
	txt.outline_modulate = Color(0.1, 0.07, 0.04)
	txt.width = 260
	txt.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	txt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	txt.position = Vector3(0, 1.3, 0.065)
	txt.double_sided = false
	placa.add_child(txt)
	var verso: Label3D = txt.duplicate()
	verso.position = Vector3(0, 1.3, -0.025)
	verso.rotation.y = PI
	placa.add_child(verso)
	L.placa = [txt, verso]
	_texto_placa(L)

func _texto_placa(L: Dictionary) -> void:
	var t: String
	var cor := Color("fff1c8")
	if L.dono == null:
		t = "%s\nÀ venda · %d de ouro" % [L.def.nome, int(D.lote.preco)]
	elif str(L.def.id) == meu:
		t = "%s\nSeu lote" % L.def.nome
		cor = Color("b8f0a0")
	else:
		t = "%s\n%s" % [L.def.nome, str(L.dono)]
	for x in L.placa:
		x.text = t
		x.modulate = cor

# ---------- o que vem do servidor ----------
func do_servidor_lotes(ev: Dictionary) -> void:
	meu = str(ev.meu) if ev.get("meu") != null else ""
	for d in ev.get("lista", []):
		do_servidor_lote(d)
	for id in lotes:
		_texto_placa(lotes[id])

func meu_lote(id: String) -> void:
	meu = id
	m.sons.tocar("nivel", -6.0)
	for k in lotes:
		_texto_placa(lotes[k])

func do_servidor_lote(ev: Dictionary) -> void:
	var L = lotes.get(str(ev.get("lote", "")))
	if L == null:
		return
	relogio = float(ev.get("agora", 0)) - Time.get_unix_time_from_system() * 1000.0
	L.dono = ev.get("dono")
	# peças: as que sumiram saem, as novas entram (as que ficaram não piscam)
	var novas := {}
	for p in ev.get("pecas", []):
		novas[str(p[0])] = {"id": str(p[0]), "k": str(p[1]), "x": float(p[2]), "z": float(p[3]), "r": int(p[4])}
	var ficam: Array = []
	for p in L.pecas:
		var n = novas.get(p.id)
		if n != null and n.k == p.k and is_equal_approx(n.x, p.x) and is_equal_approx(n.z, p.z) and n.r == p.r:
			ficam.append(p)
			novas.erase(p.id)
		elif p.get("no"):
			p.no.queue_free()
	for id in novas:
		var p: Dictionary = novas[id]
		if _modelos.has(p.k):
			p.no = _copia(p.k)
			p.no.position = Vector3(p.x, m.terreno.altura(p.x, p.z), p.z)
			p.no.rotation.y = p.r * PI / 2.0
			L.raiz.add_child(p.no)
		ficam.append(p)
	L.pecas = ficam
	# horta
	var vistas := {}
	for t in ev.get("horta", []):
		var c := str(t[0])
		vistas[c] = true
		var h: Dictionary = L.horta.get(c, {})
		h.c = str(t[1])
		h.g = float(t[2])
		h.w = float(t[3])
		h.u = float(t[4])
		if not h.has("no"):
			h.no = Node3D.new()
			var ij := c.split(",")
			h.i = int(ij[0])
			h.j = int(ij[1])
			h.no.position = Vector3(h.i + 0.5, m.terreno.altura(h.i + 0.5, h.j + 0.5), h.j + 0.5)
			L.raiz.add_child(h.no)
			h.fase = -9
			h.molhada = null
		L.horta[c] = h
		_desenhar_canteiro(h, true)
	for c in L.horta.keys():
		if not vistas.has(c):
			L.horta[c].no.queue_free()
			L.horta.erase(c)
	_refazer_solidos()
	_texto_placa(L)

func construiu(ev: Dictionary) -> void:
	var p := Vector3(float(ev.px), 0, float(ev.pz))
	p.y = m.terreno.altura(p.x, p.z)
	m.fx.texto(p + Vector3(0, 1.4, 0), str(D.construcoes[str(ev.k)].nome), Color("ffe2a0"), 0.0)
	m.sons.tocar("forja", -6.0, 0.06, p)

func colheu(ev: Dictionary) -> void:
	var ij := str(ev.c).split(",")
	var p := Vector3(float(ij[0]) + 0.5, 0, float(ij[1]) + 0.5)
	p.y = m.terreno.altura(p.x, p.z) + 0.8
	m.fx.texto(p, "+%d %s" % [int(ev.n), str(ev.nome)], Color("b8f0a0"), 0.0)
	m.sons.tocar("moedas", -8.0, 0.05, p)

# os círculos sólidos de cada peça vão para o andar do herói (mesma conta do servidor: solidosPeca)
func _refazer_solidos() -> void:
	var l: Array = []
	for id in lotes:
		for p in lotes[id].pecas:
			var a: float = p.r * PI / 2.0
			var c := roundi(cos(a))
			var s := roundi(sin(a))
			for q in D.construcoes[p.k].circulos:
				l.append({"x": p.x + float(q[0]) * c + float(q[1]) * s, "z": p.z - float(q[0]) * s + float(q[1]) * c, "r": float(q[2])})
	m.mov.extras = l

# ---------- horta: terra arada, molhada e a planta em cada fase ----------
func agora_ms() -> float:
	return Time.get_unix_time_from_system() * 1000.0 + relogio

func _crescida(h: Dictionary) -> float:
	if h.c == "" or not D.plantas.has(h.c):
		return 0.0
	var ag := agora_ms()
	var rega: float = float(D.horta.rega) * 3600000.0
	var g: float = h.g
	var ini: float = max(h.u, h.w)
	var fim: float = min(ag, h.w + rega)
	if fim > ini:
		g += (fim - ini) / 3600000.0
	return g / float(D.plantas[h.c].G)

static func fase(f: float) -> int:
	return 4 if f >= 1.0 else 0 if f < 0.03 else 1 if f < 0.4 else 2 if f < 0.75 else 3

func _molhada(h: Dictionary) -> bool:
	return h.w > 0.0 and agora_ms() < h.w + float(D.horta.rega) * 3600000.0

func _desenhar_canteiro(h: Dictionary, forcar := false) -> void:
	var f := fase(_crescida(h)) if h.c != "" else -1
	var mo := _molhada(h)
	if not forcar and f == h.fase and mo == h.molhada:
		return
	var mudou_terra: bool = forcar or mo != h.molhada
	h.fase = f
	h.molhada = mo
	for n in h.no.get_children():
		if mudou_terra or n.name != "terra":
			n.queue_free()
	if mudou_terra or h.no.get_node_or_null("terra") == null:
		var terra := Node3D.new()
		terra.name = "terra"
		h.no.add_child(terra)
		var cor := Color(0.27, 0.18, 0.11) if mo else Color(0.42, 0.3, 0.19)
		_caixa(terra, Vector3(0.96, 0.06, 0.96), Vector3(0, 0.03, 0), _mat_cor(cor))
		for i in 3: # sulcos
			_caixa(terra, Vector3(0.9, 0.05, 0.12), Vector3(0, 0.075, -0.3 + i * 0.3), _mat_cor(cor.darkened(0.18)))
	if f >= 0:
		_desenhar_planta(h.no, h.c, f)

# planta feita de folhas e fruto nas cores do Quimera (PLANTAS.cor e .folha), maior a cada fase
func _desenhar_planta(pai: Node3D, c: String, f: int) -> void:
	var P: Dictionary = D.plantas[c]
	var folha := _mat_cor(Color(str(P.folha)))
	var fruto := _mat_cor(Color(str(P.cor)))
	var r := Node3D.new()
	r.position.y = 0.08
	r.rotation.y = fmod(abs(pai.position.x * 7.3 + pai.position.z * 13.1), TAU)
	pai.add_child(r)
	if f == 0: # sementes na terra
		for i in 3:
			_caixa(r, Vector3(0.05, 0.03, 0.05), Vector3(-0.15 + i * 0.15, 0.0, 0), _mat_cor(Color(0.23, 0.15, 0.09)))
		return
	var alto: float = [0.0, 0.14, 0.28, 0.42, 0.46][f]
	if c == "milho":
		var h: float = [0.0, 0.3, 0.7, 1.1, 1.3][f]
		_caixa(r, Vector3(0.05, h, 0.05), Vector3(0, h / 2.0, 0), folha)
		for i in 3:
			_caixa(r, Vector3(0.04, 0.02, 0.36), Vector3(0, h * (0.35 + i * 0.22), 0.12), folha, Vector3(-0.5, i * 2.1, 0))
		if f >= 3:
			_caixa(r, Vector3(0.09, 0.24, 0.09), Vector3(0.06, h * 0.6, 0), fruto if f >= 4 else _mat_cor(Color("cfe08a")), Vector3(0, 0, -0.3))
		return
	# folhas em roseta
	var n_folhas := 5
	for i in n_folhas:
		var a := TAU * i / n_folhas
		var fo := _caixa(r, Vector3(0.07, 0.015, alto * 0.75 + 0.05), Vector3(sin(a) * alto * 0.3, alto * 0.45, cos(a) * alto * 0.3), folha)
		fo.rotation = Vector3(-0.9, a, 0)
	if f < 3:
		return
	var k := 1.0 if f >= 4 else 0.6
	match c:
		"abobora":
			var s := SphereMesh.new()
			s.radius = 0.2 * k
			s.height = 0.3 * k
			s.radial_segments = 12
			s.rings = 6
			var mi := MeshInstance3D.new()
			mi.mesh = s
			mi.material_override = fruto if f >= 4 else _mat_cor(Color("9fbf5a"))
			mi.position = Vector3(0.18, 0.13 * k, 0.1)
			r.add_child(mi)
		"tomate":
			for i in 4:
				var s := SphereMesh.new()
				s.radius = 0.05 * k
				s.height = 0.1 * k
				s.radial_segments = 8
				s.rings = 4
				var mi := MeshInstance3D.new()
				mi.mesh = s
				mi.material_override = fruto if f >= 4 else _mat_cor(Color("8fc04a"))
				mi.position = Vector3(sin(i * 1.7) * 0.12, alto * 0.5 + (i % 2) * 0.08, cos(i * 1.7) * 0.12)
				r.add_child(mi)
		_: # rabanete, cenoura, batata: o topo aparece na terra
			var s := SphereMesh.new()
			s.radius = 0.06 * k
			s.height = 0.09 * k
			s.radial_segments = 8
			s.rings = 4
			var mi := MeshInstance3D.new()
			mi.mesh = s
			mi.material_override = fruto
			mi.position = Vector3(0, 0.02, 0)
			r.add_child(mi)

# ---------- conta de "pode ou não pode" (a mesma do servidor: shared/simulacao.js motivoPeca / motivoHorta) ----------
func ret_peca(k: String, x: float, z: float, r: int) -> Rect2:
	var C: Dictionary = D.construcoes[k]
	var w: float = float(C.d) if r % 2 == 1 else float(C.w)
	var d: float = float(C.w) if r % 2 == 1 else float(C.d)
	return Rect2(x - w / 2.0, z - d / 2.0, w, d)

static func _cruza(a: Rect2, b: Rect2) -> bool:
	return a.position.x < b.end.x - 0.01 and b.position.x < a.end.x - 0.01 and a.position.y < b.end.y - 0.01 and b.position.y < a.end.y - 0.01

func _fora_do_lote(R: Rect2, l: Dictionary) -> bool:
	return R.position.x < float(l.x0) - 0.01 or R.end.x > float(l.x1) + 0.01 or R.position.y < float(l.z0) - 0.01 or R.end.y > float(l.z1) + 0.01

func motivo_peca(L: Dictionary, k: String, x: float, z: float, r: int) -> String:
	var R := ret_peca(k, x, z, r)
	if _fora_do_lote(R, L.def):
		return "Só dá para construir dentro do seu lote"
	for o in L.pecas:
		if _cruza(R, ret_peca(o.k, o.x, o.z, o.r)):
			return "Lugar ocupado"
	for c in L.horta:
		if _cruza(R, Rect2(L.horta[c].i, L.horta[c].j, 1, 1)):
			return "Tem horta aí"
	var hp: Vector3 = m.heroi.position
	if hp.x > R.position.x - 0.35 and hp.x < R.end.x + 0.35 and hp.z > R.position.y - 0.35 and hp.z < R.end.y + 0.35:
		return "Saia de cima do lugar"
	return ""

func motivo_horta(L: Dictionary, i: int, j: int) -> String:
	var R := Rect2(i, j, 1, 1)
	if _fora_do_lote(R, L.def):
		return "Só dá para plantar dentro do seu lote"
	for o in L.pecas:
		if _cruza(R, ret_peca(o.k, o.x, o.z, o.r)):
			return "Lugar ocupado"
	return ""

# lote em que o ponto está (ou null)
func lote_em(x: float, z: float):
	for id in lotes:
		var l: Dictionary = lotes[id].def
		if x >= float(l.x0) and x <= float(l.x1) and z >= float(l.z0) and z <= float(l.z1):
			return lotes[id]
	return null

func custo_txt(custo: Dictionary) -> String:
	var l: Array = []
	for k in custo:
		l.append("%d %s" % [int(custo[k]), str(D.itens[k].nome).to_lower()])
	return " · ".join(l)

func tem_custo(custo: Dictionary) -> bool:
	for k in custo:
		if m.P.contar(k) < int(custo[k]):
			return false
	return true

# estação construída perto (bigorna/fornalha: Ferreiro; bancada: Alfaiate), qualquer lote. Mesma distância do servidor.
func estacao_perto(tipos: Array) -> bool:
	if m.heroi == null:
		return false
	var hp: Vector3 = m.heroi.position
	for id in lotes:
		for p in lotes[id].pecas:
			if p.k in tipos and Vector2(p.x - hp.x, p.z - hp.z).length() < float(D.lote.estacaoDist) + 0.3:
				return true
	return false

# a receita dá para criar aqui? (oficina do NPC ou a estação certa: shared/dados.js RECEITA_ESTACAO)
func estacao_da_receita(R: Dictionary) -> String:
	var faz := str(R.faz)
	if faz.begins_with("barra_") or faz == "carvao":
		return "fornalha"
	return "bigorna" if str(R.prof) == "fer" else "bancada"

# ---------- a cada quadro ----------
func _process(dt: float) -> void:
	if m.heroi == null or m.hud == null:
		return
	var hp: Vector3 = m.heroi.position
	var vivo: bool = m.h.morto <= 0.0
	# placa livre perto e eu sem lote: botão Comprar
	_lote_perto = ""
	if meu == "":
		for id in lotes:
			var L: Dictionary = lotes[id]
			if L.dono == null and Vector2(float(L.def.placa.x) - hp.x, float(L.def.placa.z) - hp.z).length() < float(D.lote.placaDist):
				_lote_perto = id
	m.hud.mostrar_botao("lote", _lote_perto != "" and vivo and not ativo)
	var no_meu := meu != "" and lote_em(hp.x, hp.z) == lotes.get(meu) and lotes.has(meu)
	if not no_meu and meu != "" and lotes.has(meu): # na beira (até 3 m fora) ainda mostra
		var l: Dictionary = lotes[meu].def
		no_meu = hp.x > float(l.x0) - 3.0 and hp.x < float(l.x1) + 3.0 and hp.z > float(l.z0) - 3.0 and hp.z < float(l.z1) + 3.0
	m.hud.mostrar_botao("construir", no_meu and vivo and not ativo)
	m.hud.mostrar_botao("bancada", estacao_perto(["bancada"]) and vivo and not ativo)
	if ativo:
		if not no_meu and not _perto_do_meu(hp, 8.0):
			sair()
			m.hud.aviso("Saiu do seu lote")
		else:
			_atualizar_mira()
	# horta cresce sozinha: confere a fase de vez em quando
	_t_horta -= dt
	if _t_horta <= 0.0:
		_t_horta = 2.0
		for id in lotes:
			for c in lotes[id].horta:
				var h: Dictionary = lotes[id].horta[c]
				if h.no.position.distance_squared_to(hp) < 3600.0:
					_desenhar_canteiro(h)

func _perto_do_meu(hp: Vector3, folga: float) -> bool:
	if not lotes.has(meu):
		return false
	var l: Dictionary = lotes[meu].def
	return hp.x > float(l.x0) - folga and hp.x < float(l.x1) + folga and hp.z > float(l.z0) - folga and hp.z < float(l.z1) + folga

# ---------- modo construção ----------
func abrir() -> void:
	if not m.on():
		m.hud.aviso("Construir só funciona online (o lote fica guardado no servidor)")
		return
	if meu == "" or not lotes.has(meu):
		m.hud.aviso("Compre um lote na Vila dos Lotes para construir")
		return
	if m.trabalho.coletando != null:
		m.trabalho.parar(true)
	ativo = true
	mira_fixa = null
	giro = 0
	painel.visible = true
	_montar_itens()
	_mostrar_borda(true)
	m.hud.aviso("Modo construção: ande para mirar ou toque no chão. Girar muda a direção.")

func sair() -> void:
	ativo = false
	painel.visible = false
	if fantasma:
		fantasma.queue_free()
		fantasma = null
		_fantasma_k = ""
	if _destaque:
		_destaque.visible = false
	_mostrar_borda(false)

func _mostrar_borda(v: bool) -> void:
	if _borda_lote == null:
		_borda_lote = MeshInstance3D.new()
		var im := ImmediateMesh.new()
		_borda_lote.mesh = im
		var mt := StandardMaterial3D.new()
		mt.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mt.albedo_color = Color(1.0, 0.9, 0.55, 0.9)
		mt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_borda_lote.material_override = mt
		add_child(_borda_lote)
	_borda_lote.visible = v and lotes.has(meu)
	if not _borda_lote.visible:
		return
	var l: Dictionary = lotes[meu].def
	var im: ImmediateMesh = _borda_lote.mesh
	im.clear_surfaces()
	im.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	var cantos := [Vector2(float(l.x0), float(l.z0)), Vector2(float(l.x1), float(l.z0)), Vector2(float(l.x1), float(l.z1)), Vector2(float(l.x0), float(l.z1))]
	for i in 4: # faixa de 8 cm no chão, por dentro do lote
		var a: Vector2 = cantos[i]
		var b: Vector2 = cantos[(i + 1) % 4]
		var dentro: Vector2 = ((cantos[(i + 2) % 4] + cantos[(i + 3) % 4]) / 2.0 - (a + b) / 2.0).normalized() * 0.08
		var y := 0.04
		var v1 := Vector3(a.x, y, a.y)
		var v2 := Vector3(b.x, y, b.y)
		var v3 := Vector3(b.x + dentro.x, y, b.y + dentro.y)
		var v4 := Vector3(a.x + dentro.x, y, a.y + dentro.y)
		for q in [v1, v2, v3, v1, v3, v4]:
			im.surface_add_vertex(q)
	im.surface_end()

func tocar_botao_construir() -> void:
	if ativo:
		sair()
	else:
		abrir()

# toque rápido no chão com o modo aberto: a mira vai para lá
func tocou_tela(pos: Vector2) -> void:
	if not ativo or m.camera == null or cobre(pos):
		return
	var o: Vector3 = m.camera.project_ray_origin(pos)
	var d: Vector3 = m.camera.project_ray_normal(pos)
	if abs(d.y) < 0.01:
		return
	var t: float = (m.heroi.position.y - o.y) / d.y
	if t <= 0.0:
		return
	var p := o + d * t
	if Vector2(p.x - m.heroi.position.x, p.z - m.heroi.position.z).length() <= float(D.lote.alcance):
		mira_fixa = p

func _atualizar_mira() -> void:
	var hp: Vector3 = m.heroi.position
	if m.hud.mover.length() > 0.2:
		mira_fixa = null # andou: a mira volta para a frente do herói
	var ry: float = m.mov.ry
	var frente := FRENTE_HORTA if aba == "fazenda" else FRENTE_PECA
	var p: Vector3 = mira_fixa if mira_fixa != null else hp + Vector3(sin(ry), 0, cos(ry)) * frente
	var L = lotes.get(meu)
	alvo = {"ok": false, "motivo": ""}
	if aba == "fazenda" or sel == "desmontar":
		_mostrar_fantasma("")
	if aba == "construir" and sel != "desmontar":
		# peça: centro numa grade de 0,5 m
		var x: float = round(p.x * 2.0) / 2.0
		var z: float = round(p.z * 2.0) / 2.0
		var C: Dictionary = D.construcoes[sel]
		var mot := motivo_peca(L, sel, x, z, giro)
		if mot == "" and Vector2(x - hp.x, z - hp.z).length() > float(D.lote.alcance):
			mot = "Longe demais"
		if mot == "" and not tem_custo(C.custo):
			mot = "Falta material: " + custo_txt(C.custo)
		if mot == "" and L.pecas.size() >= int(D.lote.maxPecas):
			mot = "Limite de %d peças no lote" % int(D.lote.maxPecas)
		alvo = {"ok": mot == "", "motivo": mot, "tipo": "construir", "dados": {"k": sel, "x": x, "z": z, "r": giro}}
		_mostrar_fantasma(sel)
		fantasma.position = Vector3(x, m.terreno.altura(x, z) + 0.01, z)
		fantasma.rotation.y = giro * PI / 2.0
		_pintar_fantasma(alvo.ok)
		_destaque_em(null)
	elif sel == "desmontar":
		var achou = null
		var md := 1e9
		for o in L.pecas:
			var R := ret_peca(o.k, o.x, o.z, o.r).grow(0.3)
			var dd := Vector2(o.x - p.x, o.z - p.z).length()
			if R.has_point(Vector2(p.x, p.z)) and dd < md:
				md = dd
				achou = o
		if achou:
			alvo = {"ok": true, "motivo": "Vai desmontar: %s (o material volta)" % D.construcoes[achou.k].nome, "tipo": "desmontar", "dados": {"p": achou.id}}
			var R2 := ret_peca(achou.k, achou.x, achou.z, achou.r)
			_destaque_em(Vector3(R2.get_center().x, m.terreno.altura(achou.x, achou.z), R2.get_center().y), Vector3(R2.size.x + 0.1, 1.2, R2.size.y + 0.1), Color(1, 0.35, 0.29, 0.35))
		else:
			alvo = {"ok": false, "motivo": "Mire numa peça sua para desmontar"}
			_destaque_em(null)
	else:
		# horta: quadrado de 1 m
		var i := floori(p.x)
		var j := floori(p.z)
		var c := "%d,%d" % [i, j]
		var h = L.horta.get(c)
		var mot := ""
		var dados := {"acao": sel, "c": c}
		match sel:
			"arar":
				mot = "Essa terra já está arada" if h != null else motivo_horta(L, i, j)
			"plantar":
				dados.s = semente
				if h == null:
					mot = "Precisa arar a terra primeiro"
				elif h.c != "":
					mot = "Já tem planta aqui"
				elif m.P.contar("semente_" + semente) < 1:
					mot = "Sem semente de %s (a Rosa vende)" % str(D.plantas[semente].nome).to_lower()
			"regar":
				if h == null:
					mot = "Precisa arar a terra primeiro"
				elif _molhada(h):
					mot = "A terra ainda está molhada"
			"colher":
				if h == null or h.c == "":
					mot = "Não tem nada plantado aqui"
				elif fase(_crescida(h)) < 4:
					mot = "%s: %d%% crescida%s" % [D.plantas[h.c].nome, int(_crescida(h) * 100), "" if _molhada(h) else " (precisa de água!)"]
			"tirar":
				if h == null:
					mot = "Aqui não tem terra arada"
				elif h.c != "":
					mot = "Colha a planta antes de desfazer a terra"
		if mot == "" and Vector2(i + 0.5 - hp.x, j + 0.5 - hp.z).length() > float(D.lote.alcance):
			mot = "Longe demais"
		if mot == "" and m.P.vigor() < float(D.horta.vigor) and sel != "tirar":
			mot = "Sem vigor (volta sozinho com o tempo)"
		alvo = {"ok": mot == "", "motivo": mot, "tipo": "horta", "dados": dados}
		_destaque_em(Vector3(i + 0.5, m.terreno.altura(i + 0.5, j + 0.5), j + 0.5), Vector3(1.0, 0.16, 1.0), Color(0.43, 1.0, 0.54, 0.35) if alvo.ok else Color(1, 0.35, 0.29, 0.35))
	txt_motivo.text = alvo.motivo
	txt_motivo.add_theme_color_override("font_color", Color("b8f0a0") if alvo.ok else Color("ffb3a3"))
	b_ok.disabled = not alvo.ok

func _mostrar_fantasma(k: String) -> void:
	if k == _fantasma_k:
		return
	if fantasma:
		fantasma.queue_free()
		fantasma = null
	_fantasma_k = k
	if k == "":
		return
	fantasma = _copia(k)
	add_child(fantasma)
	for mi in fantasma.find_children("*", "MeshInstance3D", true, false):
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func _pintar_fantasma(ok: bool) -> void:
	var mt := _mat_ok if ok else _mat_nao
	for mi in fantasma.find_children("*", "MeshInstance3D", true, false):
		mi.material_override = mt

func _destaque_em(pos, tam := Vector3.ONE, cor := Color.WHITE) -> void:
	if _destaque == null:
		_destaque = MeshInstance3D.new()
		_destaque.mesh = BoxMesh.new()
		_destaque.material_override = _mat_fantasma(cor)
		_destaque.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(_destaque)
	if pos == null:
		_destaque.visible = false
		return
	_destaque.visible = true
	_destaque.position = pos + Vector3(0, tam.y / 2.0, 0)
	(_destaque.mesh as BoxMesh).size = tam
	(_destaque.material_override as StandardMaterial3D).albedo_color = cor

func colocar() -> void:
	if not alvo.get("ok", false):
		m.hud.aviso(str(alvo.get("motivo", "")))
		m.sons.tocar("dash", -12.0)
		return
	m.rede(str(alvo.tipo), alvo.dados)

func girar() -> void:
	giro = (giro + 1) % 4

# ---------- comprar o lote ----------
func perguntar_compra() -> void:
	if _lote_perto == "" or not lotes.has(_lote_perto):
		return
	if not m.on():
		m.hud.aviso("Comprar lote só funciona online")
		return
	var L: Dictionary = lotes[_lote_perto]
	if compra:
		compra.queue_free()
	compra = Control.new()
	compra.set_anchors_preset(Control.PRESET_FULL_RECT)
	tela.add_child(compra)
	var escuro := ColorRect.new()
	escuro.color = Color(0, 0, 0, 0.45)
	escuro.set_anchors_preset(Control.PRESET_FULL_RECT)
	compra.add_child(escuro)
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", Menu.caixa(Menu.FUNDO, Menu.OURO.darkened(0.25), 2, 10, 14))
	cx.set_anchors_preset(Control.PRESET_CENTER)
	cx.custom_minimum_size = Vector2(440, 0)
	cx.position = Vector2(-220, -110)
	compra.add_child(cx)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	cx.add_child(col)
	col.add_child(Menu.rotulo("%s · Vila dos Lotes" % L.def.nome, 20, Menu.OURO_CLARO))
	var ouro := int(m.P.prog.get("ouro", 0))
	var d := Menu.rotulo("Um terreno de 10 x 10 m só seu, para construir bancada, bigorna, fornalha e cerca e para plantar.\nCusta %d de ouro (você tem %d). Cada jogador pode ter um lote." % [int(D.lote.preco), ouro], 15)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	col.add_child(d)
	var lb := HBoxContainer.new()
	lb.add_theme_constant_override("separation", 12)
	lb.alignment = BoxContainer.ALIGNMENT_END
	col.add_child(lb)
	var nao := _botao("Agora não", func(): compra.queue_free(); compra = null)
	lb.add_child(nao)
	var id := _lote_perto
	var sim := _botao("Comprar", func():
		m.rede("lote", {"id": id})
		compra.queue_free()
		compra = null, true)
	sim.disabled = ouro < int(D.lote.preco)
	lb.add_child(sim)

# ---------- tela do modo construção (no alto, no meio: joystick e botões continuam livres) ----------
func cobre(p: Vector2) -> bool:
	if compra != null:
		return true
	return painel != null and painel.visible and painel.get_global_rect().grow(6).has_point(p)

func _botao(t: String, fn: Callable, ativo_ := false, tam := 15) -> Button:
	var b := Button.new()
	b.text = t
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", tam)
	b.custom_minimum_size = Vector2(0, 40)
	Menu.estilo_botao(b, ativo_)
	b.pressed.connect(fn)
	return b

func _montar_tela() -> void:
	tela = CanvasLayer.new()
	tela.layer = 6
	add_child(tela)
	painel = PanelContainer.new()
	painel.add_theme_stylebox_override("panel", Menu.caixa(Color(Menu.FUNDO, 0.93), Menu.OURO.darkened(0.25), 2, 10, 10))
	painel.set_anchors_preset(Control.PRESET_CENTER_TOP)
	painel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	painel.offset_top = 10
	painel.custom_minimum_size = Vector2(560, 0)
	painel.visible = false
	tela.add_child(painel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 6)
	painel.add_child(col)
	linha_abas = HBoxContainer.new()
	linha_abas.add_theme_constant_override("separation", 6)
	col.add_child(linha_abas)
	for k in ["construir", "fazenda"]:
		var b := _botao("Construir" if k == "construir" else "Fazenda", func(): trocar_aba(k), k == aba, 15)
		b.custom_minimum_size = Vector2(120, 36)
		_botoes_abas[k] = b
		linha_abas.add_child(b)
	var esp := Control.new()
	esp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	linha_abas.add_child(esp)
	var pc := Menu.rotulo("", 13, Menu.APAGADO)
	pc.name = "pecas"
	pc.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	linha_abas.add_child(pc)
	linha_itens = HFlowContainer.new()
	linha_itens.add_theme_constant_override("h_separation", 6)
	linha_itens.add_theme_constant_override("v_separation", 6)
	col.add_child(linha_itens)
	var baixo := HBoxContainer.new()
	baixo.add_theme_constant_override("separation", 8)
	col.add_child(baixo)
	b_girar = _botao("Girar", girar)
	b_girar.custom_minimum_size = Vector2(90, 42)
	baixo.add_child(b_girar)
	b_ok = _botao("Colocar", colocar, true, 16)
	b_ok.custom_minimum_size = Vector2(130, 42)
	baixo.add_child(b_ok)
	b_sair = _botao("Sair", sair)
	b_sair.custom_minimum_size = Vector2(80, 42)
	baixo.add_child(b_sair)
	txt_motivo = Menu.rotulo("", 13, Color("ffb3a3"))
	txt_motivo.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	txt_motivo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt_motivo.custom_minimum_size = Vector2(200, 0)
	txt_motivo.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	baixo.add_child(txt_motivo)

func trocar_aba(k: String) -> void:
	aba = k
	sel = "bancada" if k == "construir" else "arar"
	_montar_itens()

func _montar_itens() -> void:
	for b in _botoes_abas:
		Menu.estilo_botao(_botoes_abas[b], b == aba)
	for n in linha_itens.get_children():
		n.queue_free()
	var L = lotes.get(meu)
	var pc: Label = linha_abas.get_node("pecas")
	pc.text = "Peças %d/%d" % [L.pecas.size() if L else 0, int(D.lote.maxPecas)] if aba == "construir" else "Vigor %d" % int(m.P.vigor())
	if aba == "construir":
		for k in D.construcoes:
			var C: Dictionary = D.construcoes[k]
			var b := _botao("%s\n%s" % [C.nome, custo_txt(C.custo)], func(): escolher(k), sel == k, 13)
			b.custom_minimum_size = Vector2(118, 50)
			if not tem_custo(C.custo):
				b.add_theme_color_override("font_color", Color("e0a090"))
			linha_itens.add_child(b)
		linha_itens.add_child(_item_simples("desmontar", "Desmontar\n(o material volta)"))
	else:
		linha_itens.add_child(_item_simples("arar", "Arar"))
		var n_sem: int = m.P.contar("semente_" + semente)
		var bp := _botao("Plantar\n%s (%d)" % [D.plantas[semente].nome, n_sem], func():
			if sel == "plantar":
				_proxima_semente()
			escolher("plantar"), sel == "plantar", 13)
		bp.custom_minimum_size = Vector2(118, 50)
		linha_itens.add_child(bp)
		linha_itens.add_child(_item_simples("regar", "Regar"))
		linha_itens.add_child(_item_simples("colher", "Colher"))
		linha_itens.add_child(_item_simples("tirar", "Desfazer\nterra"))
	b_girar.visible = aba == "construir" and sel != "desmontar"
	b_ok.text = {"desmontar": "Desmontar", "arar": "Arar", "plantar": "Plantar", "regar": "Regar", "colher": "Colher", "tirar": "Desfazer"}.get(sel, "Colocar")
	Menu.estilo_botao(b_ok, true)

func _item_simples(k: String, t: String) -> Button:
	var b := _botao(t, func(): escolher(k), sel == k, 13)
	b.custom_minimum_size = Vector2(96, 50)
	return b

# tocar de novo em Plantar troca a semente (as que tenho primeiro)
func _proxima_semente() -> void:
	var ks: Array = D.plantas.keys()
	var i := ks.find(semente)
	for n in ks.size():
		var k: String = ks[(i + 1 + n) % ks.size()]
		if m.P.contar("semente_" + k) > 0 or n == ks.size() - 1:
			semente = k
			return

func escolher(k: String) -> void:
	sel = k
	_montar_itens()

# mochila mudou (o servidor mandou o progresso): os custos e as sementes da barra se atualizam
func progresso_mudou() -> void:
	if ativo:
		_montar_itens()

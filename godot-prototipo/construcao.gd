extends Node3D
# Terras da Estrada: construção e fazenda do Quimera (pedido do André 2026-11-03, refeito em 2026-11-04).
# Não tem lote pronto: numa área de terra livre com uma estrada central, o jogador marca o terreno que quer comprar
# (toca num canto e arrasta até o outro) e paga por bloco de 1 m². Só constrói e planta dentro do terreno dele.
# Modo construção como no Quimera: a câmera fica flutuando (segue a mira, não o herói), o joystick move a mira e
# tocar no chão leva a mira para lá. Embaixo, a barra de itens com as abas Construir e Fazenda; fantasma verde (pode)
# ou vermelho (não pode, com o motivo), Girar, Colocar e Sair.
# Quem decide é o servidor (shared/simulacao.js: comprarLote, construir, desmontar, horta); aqui só se mostra e se
# pede. As contas de "pode ou não pode" são as mesmas do servidor (motivoTerreno / motivoPeca / motivoHorta), para o
# fantasma e o terreno marcado já ficarem vermelhos antes de mandar.
# Números: dados/habilidades.json (lote, construcoes, plantas, horta) · área e estradas: dados/mundo.json (vilaLotes)
# Modelos: construcao3d/ (Quaternius CC0: Workbench, Anvil_Log, Prop_WoodenFence_Single); a fornalha é de pedra,
# montada aqui com a mesma pedra e brasa da forja da ferraria da vila.
# 2026-11-04 (André, remoção aprovada): saíram os 6 lotes prontos com estaca, corda e placa "À venda".

const Menu = preload("res://menu.gd")
const Andar = preload("res://andar.gd")

var m # main.gd
var D: Dictionary # m.P.dados
var lotes := {} # id -> {def: {id, x0, z0, x1, z1}, dono (nome ou null), pecas: [{id, k, x, z, r, no}], horta: {"i,j": {c, g, w, u, no, fase, molhada}}, raiz}
var meu := "" # id do meu terreno ("" = não tenho)
var relogio := 0.0 # ms do servidor menos ms deste celular (a horta cresce igual nos dois)
var _modelos := {} # k -> Node3D modelo (escondido) para duplicar
var _mats := {}
var _t_horta := 0.0
var terras: Dictionary # mundo.vilaLotes: area (elipse), estradas [{largura, pontos}]

# modo construção
var ativo := false
var aba := "construir" # "construir" ou "fazenda"
var sel := "bancada" # peça (CONSTRUCOES), "desmontar" ou ação da fazenda ("arar", "plantar", "regar", "colher", "tirar")
var semente := "rabanete"
var giro := 0 # 0..3 (x 90°)
var mira := Vector3.ZERO # onde a câmera flutuante olha e onde o fantasma fica
var alvo := {} # o que o botão Colocar vai fazer agora: {ok, motivo, msg (tipo, dados), x, z}
var fantasma: Node3D
var _fantasma_k := ""
var _mat_ok: StandardMaterial3D
var _mat_nao: StandardMaterial3D
var _destaque: MeshInstance3D # peça marcada para desmontar / quadrado da horta
var _borda_lote: MeshInstance3D # contorno do meu terreno no chão (só no modo construção)
var _mira_no: MeshInstance3D # anel no chão onde a mira está (câmera flutuante)

# compra do terreno (toque num canto e arraste)
var comprando := false
var _canto_a = null # Vector2i: primeiro canto (quadrado de 1 m)
var _canto_b = null
var _ret := {} # {x0, z0, x1, z1} marcado agora
var _ret_motivo := ""
var _ret_no: MeshInstance3D # o terreno marcado pintado no chão
var _outros_no: MeshInstance3D # terrenos que já têm dono (vermelho, só na compra)
var _ret_txt: Label3D # "8 x 6 m · 192 de ouro" em cima do terreno marcado

# tela
var tela: CanvasLayer
var painel: PanelContainer # barra de itens embaixo (modo construção)
var linha_abas: VBoxContainer
var linha_itens: HBoxContainer
var b_girar: Button
var b_ok: Button
var b_sair: Button
var txt_motivo: Label
var txt_nome: Label
var _botoes_abas := {}
var painel_compra: PanelContainer
var txt_compra: Label
var txt_compra_info: Label
var b_comprar: Button

const VEL_MIRA := 7.0 # m/s da mira com o joystick (Quimera: 7)
const ESCALA_UI := 1.0

func _init(principal) -> void:
	m = principal
	D = m.P.dados

func _ready() -> void:
	terras = m.mundo.get("vilaLotes", {})
	_mat_ok = _mat_fantasma(Color(0.43, 1.0, 0.54, 0.45))
	_mat_nao = _mat_fantasma(Color(1.0, 0.35, 0.29, 0.45))
	_carregar_modelos()
	_montar_tela()
	# botões da HUD: comprar terreno (nas terras, sem terreno), construir (no meu terreno) e a estação perto (Alfaiate/Ferreiro)
	m.hud._botao("construir", Vector2(597, 160), 30, "construir", m.hud.COR_TROCA)
	m.hud.botoes[-1].oculto = true
	m.hud._botao("lote", Vector2(597, 160), 30, "terreno", m.hud.COR_TROCA)
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

# ---------- terrenos: nascem quando alguém compra (o servidor manda o retângulo) ----------
func _lote_novo(id: String, ret: Array) -> Dictionary:
	var L := {"def": {"id": id, "nome": "Terreno", "x0": float(ret[0]), "z0": float(ret[1]), "x1": float(ret[2]), "z1": float(ret[3])},
		"dono": null, "pecas": [], "horta": {}, "raiz": Node3D.new()}
	L.raiz.name = "Terreno_" + id
	add_child(L.raiz)
	lotes[id] = L
	return L

func _lote_fora(id: String) -> void:
	var L = lotes.get(id)
	if L == null:
		return
	L.raiz.queue_free()
	lotes.erase(id)
	_refazer_solidos()

# ---------- o que vem do servidor ----------
func do_servidor_lotes(ev: Dictionary) -> void:
	meu = str(ev.meu) if ev.get("meu") != null else ""
	for d in ev.get("lista", []):
		do_servidor_lote(d)

func meu_lote(id: String) -> void:
	meu = id
	m.sons.tocar("nivel", -6.0)
	if comprando:
		sair_compra()

func do_servidor_lote(ev: Dictionary) -> void:
	var id := str(ev.get("lote", ""))
	if ev.get("dono") == null: # terreno sem dono (conta apagada): o chão volta a ser livre
		_lote_fora(id)
		return
	var L = lotes.get(id)
	var ret = ev.get("ret")
	if L == null:
		if not (ret is Array) or ret.size() < 4:
			return
		L = _lote_novo(id, ret)
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
	for k in novas:
		var p: Dictionary = novas[k]
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
		h.g = float(t[2]) if t[2] != null else 0.0
		h.w = float(t[3]) if t[3] != null else 0.0 # terra recém-arada ainda não foi regada (null)
		h.u = float(t[4]) if t[4] != null else 0.0
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
		h.mudou = true
	for c in L.horta.keys():
		if not vistas.has(c):
			L.horta[c].no.queue_free()
			L.horta.erase(c)
	# terra emenda com os vizinhos: refaz quem mudou e quem ganhou ou perdeu vizinho
	for c in L.horta:
		var h: Dictionary = L.horta[c]
		h.mask = _mask_horta(L, h)
		if h.get("mudou", false):
			h.erase("mudou")
			_desenhar_canteiro(h, true)
		elif h.mask != h.get("mask_feita", -1):
			_desenhar_canteiro(h)
	_grama_sob_horta(L)
	_refazer_solidos()
	if ativo and id == meu:
		_mostrar_borda(true)
		_montar_itens()

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
	var mudou_terra: bool = forcar or mo != h.molhada or h.get("mask", 0) != h.get("mask_feita", -1)
	h.fase = f
	h.molhada = mo
	for n in h.no.get_children():
		if mudou_terra or n.name != "terra":
			n.queue_free()
	if mudou_terra or h.no.get_node_or_null("terra") == null:
		var terra := MeshInstance3D.new()
		terra.name = "terra"
		terra.mesh = _malha_terra(h)
		terra.material_override = _mat_terra(mo)
		terra.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		h.no.add_child(terra)
		h.mask_feita = h.get("mask", 0)
	if f >= 0:
		_desenhar_planta(h.no, h.c, f)

# Terra arada como a do Quimera (mgSoGeo, melhoria pedida pelo André em 2026-11-04): uma malha por canteiro que
# emenda com os vizinhos arados e, onde não tem vizinho, se desfaz no chão com borda irregular (ruído), sem caixa
# quadrada. Sulcos em ondas (3 por metro), cor e altura variando com ruído; molhada fica mais escura e brilhante.
# mask: 1 = arado a oeste (x-1), 2 = leste (x+1), 4 = norte (z-1), 8 = sul (z+1)
static func _ruido(x: float, z: float) -> float:
	var i := floorf(x)
	var j := floorf(z)
	var fx := x - i
	var fz := z - j
	var u := fx * fx * (3.0 - 2.0 * fx)
	var v := fz * fz * (3.0 - 2.0 * fz)
	return (_h2(i, j) * (1.0 - u) + _h2(i + 1.0, j) * u) * (1.0 - v) + (_h2(i, j + 1.0) * (1.0 - u) + _h2(i + 1.0, j + 1.0) * u) * v

static func _h2(i: float, j: float) -> float:
	var n := sin(i * 127.1 + j * 311.7) * 43758.5453
	return n - floorf(n)

func _mask_horta(L: Dictionary, h: Dictionary) -> int:
	var i: int = h.i
	var j: int = h.j
	var mk := 0
	if L.horta.has("%d,%d" % [i - 1, j]): mk |= 1
	if L.horta.has("%d,%d" % [i + 1, j]): mk |= 2
	if L.horta.has("%d,%d" % [i, j - 1]): mk |= 4
	if L.horta.has("%d,%d" % [i, j + 1]): mk |= 8
	return mk

func _malha_terra(h: Dictionary) -> ArrayMesh:
	var mk: int = h.get("mask", 0)
	var W := mk & 1 != 0
	var E := mk & 2 != 0
	var N := mk & 4 != 0
	var S := mk & 8 != 0
	var R := 0.25 # quanto a terra solta passa da borda do canteiro (sem vizinho)
	var x0 := -0.5 if W else -0.5 - R
	var x1 := 0.5 if E else 0.5 + R
	var z0 := -0.5 if N else -0.5 - R
	var z1 := 0.5 if S else 0.5 + R
	var nx := int(round((x1 - x0) * 8.0))
	var nz := int(round((z1 - z0) * 12.0))
	var cx: float = h.no.position.x
	var cz: float = h.no.position.z
	var gy: float = h.no.position.y
	var P := PackedVector3Array()
	var C := PackedColorArray()
	var U := PackedVector2Array()
	var A := PackedFloat32Array()
	var I := PackedInt32Array()
	for j in nz + 1:
		for i in nx + 1:
			var lx := x0 + (x1 - x0) * i / nx
			var lz := z0 + (z1 - z0) * j / nz
			var wx := cx + lx
			var wz := cz + lz
			var qx := maxf(0.0, absf(lx) - 0.34) if ((not W and lx < 0.0) or (not E and lx > 0.0)) else 0.0
			var qz := maxf(0.0, absf(lz) - 0.34) if ((not N and lz < 0.0) or (not S and lz > 0.0)) else 0.0
			var q := Vector2(qx, qz).length()
			if q > 0.0:
				q += (_ruido(wx * 2.3, wz * 2.3) - 0.5) * 0.26 + (_ruido(wx * 7.1 + 9.0, wz * 7.1 + 3.0) - 0.5) * 0.1
			var t := clampf(q / 0.3, 0.0, 1.0)
			var f := 1.0 - t * t * (3.0 - 2.0 * t)
			var rg := -cos(wz * PI * 6.0) # sulcos
			var n2 := _ruido(wx * 3.1 + 17.0, wz * 3.1 + 5.0)
			var y: float = m.terreno.altura(wx, wz) - gy
			P.append(Vector3(lx, y + 0.018 + (0.04 + rg * 0.034 + (n2 - 0.5) * 0.014) * f, lz))
			var b := 0.93 + (n2 - 0.5) * 0.24 + rg * 0.13 + (1.0 - f) * 0.07
			var a := minf(1.0, f * 1.6)
			C.append(Color(b, b * 0.985, b * 0.965, a))
			A.append(a)
			U.append(Vector2(wx, wz) * 0.5)
	for j in nz:
		for i in nx:
			var p := j * (nx + 1) + i
			var q := p + nx + 1
			if A[p] + A[p + 1] + A[q] + A[q + 1] < 0.01:
				continue
			I.append_array([p, p + 1, q, p + 1, q + 1, q])
	var st := SurfaceTool.new()
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = P
	arr[Mesh.ARRAY_COLOR] = C
	arr[Mesh.ARRAY_TEX_UV] = U
	arr[Mesh.ARRAY_INDEX] = I
	var bruto := ArrayMesh.new()
	bruto.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	st.create_from(bruto, 0)
	st.generate_normals()
	return st.commit()

# A grama do chão (main.gd grama_pedacos) não fura a terra arada: as folhas em cima de um canteiro (com a borda solta)
# ficam com tamanho zero; desarou, voltam. Só mexe nos pedaços que encostam no lote.
var _grama_original := {} # MultiMeshInstance3D -> buffer de antes
func _grama_sob_horta(L: Dictionary) -> void:
	if m.get("grama_pedacos") == null:
		return
	var l: Dictionary = L.def
	var caixa := Rect2(float(l.x0) - 1.0, float(l.z0) - 1.0, float(l.x1) - float(l.x0) + 2.0, float(l.z1) - float(l.z0) + 2.0)
	var celulas := {}
	for c in L.horta:
		celulas[Vector2i(L.horta[c].i, L.horta[c].j)] = true
	for g in m.grama_pedacos:
		if not is_instance_valid(g) or g.multimesh == null:
			continue
		var mm: MultiMesh = g.multimesh
		var orig: PackedFloat32Array = _grama_original.get(g, mm.buffer)
		var n := mm.instance_count
		if n == 0:
			continue
		var bb: AABB = g.global_transform * mm.get_aabb()
		if not caixa.intersects(Rect2(bb.position.x, bb.position.z, bb.size.x, bb.size.z)):
			continue
		_grama_original[g] = orig
		var buf := orig.duplicate()
		var mexeu := false
		for i in n:
			var x: float = buf[i * 16 + 3]
			var z: float = buf[i * 16 + 11]
			if not caixa.has_point(Vector2(x, z)):
				continue
			var tapa := false
			for di in [-1, 0, 1]: # a terra solta passa uns 25 cm da borda
				for dj in [-1, 0, 1]:
					var k := Vector2i(floori(x) + di, floori(z) + dj)
					if celulas.has(k) and absf(x - (k.x + 0.5)) < 0.72 and absf(z - (k.y + 0.5)) < 0.72:
						tapa = true
			if tapa:
				for c in [0, 1, 2, 4, 5, 6, 8, 9, 10]:
					buf[i * 16 + c] = 0.0
				mexeu = true
		mm.buffer = buf
		if not mexeu:
			_grama_original.erase(g)

var _mats_terra := {}
func _mat_terra(molhada: bool) -> StandardMaterial3D:
	if _mats_terra.has(molhada):
		return _mats_terra[molhada]
	var mt := StandardMaterial3D.new()
	var tex = load("res://modelos/stony_dirt_path.jpg") if ResourceLoader.exists("res://modelos/stony_dirt_path.jpg") else null
	if tex:
		mt.albedo_texture = tex
	mt.vertex_color_use_as_albedo = true
	mt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	# a textura já é terra marrom (média ~0,40/0,27/0,16): a cor só clareia ou escurece um pouco. Antes ela multiplicava
	# por um marrom de novo e a terra saía quase preta (direção de arte 2026-11-04: alvo #6b4a30, molhada mais escura)
	mt.albedo_color = Color(0.68, 0.62, 0.6) if molhada else Color(1.12, 1.06, 1.0)
	mt.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	mt.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	mt.metallic = 0.0
	mt.roughness = 0.6 if molhada else 1.0
	mt.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	_mats_terra[molhada] = mt
	return mt

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
		return "Só dá para construir dentro do seu terreno"
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
		return "Só dá para plantar dentro do seu terreno"
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

# estação construída perto (bigorna/fornalha: Ferreiro; bancada: Alfaiate), qualquer terreno. Mesma distância do servidor.
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

# ---------- terreno marcado: a mesma conta do servidor (shared/simulacao.js motivoTerreno) ----------
static func dist_ret(R: Dictionary, x: float, z: float) -> float:
	return Vector2(maxf(maxf(float(R.x0) - x, 0.0), x - float(R.x1)), maxf(maxf(float(R.z0) - z, 0.0), z - float(R.z1))).length()

static func max_pecas(L: Dictionary, regra: Dictionary) -> int:
	var a: float = (float(L.def.x1) - float(L.def.x0)) * (float(L.def.z1) - float(L.def.z0))
	return maxi(int(regra.pecasMin), mini(int(regra.maxPecas), roundi(a * float(regra.pecasPorBloco))))

func preco_terreno(R: Dictionary) -> int:
	return int((float(R.x1) - float(R.x0)) * (float(R.z1) - float(R.z0))) * int(D.lote.precoBloco)

func dentro_das_terras(x: float, z: float, folga := 0.0) -> bool:
	var A: Dictionary = terras.get("area", {})
	if A.is_empty():
		return false
	return Vector2(x - float(A.x), z - float(A.z)).length() <= Andar.raio_na_direcao(A, atan2(z - float(A.z), x - float(A.x))) - folga

func motivo_terreno(R: Dictionary) -> String:
	var lo: Dictionary = D.lote
	var w: int = int(R.x1) - int(R.x0)
	var d: int = int(R.z1) - int(R.z0)
	if w < int(lo.ladoMin) or d < int(lo.ladoMin):
		return "O terreno precisa de pelo menos %d x %d m" % [int(lo.ladoMin), int(lo.ladoMin)]
	if w > int(lo.ladoMax) or d > int(lo.ladoMax):
		return "Cada lado vai até %d m" % int(lo.ladoMax)
	if w * d > int(lo.areaMax):
		return "No máximo %d blocos (este tem %d)" % [int(lo.areaMax), w * d]
	for t in 2 * (w + d) + 1:
		var x: float
		var z: float
		if t <= w:
			x = R.x0 + t; z = R.z0
		elif t <= w + d:
			x = R.x1; z = R.z0 + (t - w)
		elif t <= 2 * w + d:
			x = R.x1 - (t - w - d); z = R.z1
		else:
			x = R.x0; z = R.z1 - (t - 2 * w - d)
		if not dentro_das_terras(x, z, float(lo.folgaBorda)):
			return "Passa da borda das terras"
	for e in terras.get("estradas", []):
		var meia: float = float(e.largura) / 2.0 + float(lo.folgaRua)
		var pts: Array = e.pontos
		for i in range(1, pts.size()):
			var a := Vector2(float(pts[i - 1][0]), float(pts[i - 1][1]))
			var b := Vector2(float(pts[i][0]), float(pts[i][1]))
			var n := int(ceil(a.distance_to(b) / 0.5))
			for q in n + 1:
				var p := a.lerp(b, float(q) / n)
				if dist_ret(R, p.x, p.y) < meia:
					return "Não pode pegar a estrada"
	for id in lotes:
		var o: Dictionary = lotes[id].def
		if lotes[id].dono != null and R.x0 < o.x1 and o.x0 < R.x1 and R.z0 < o.z1 and o.z0 < R.z1:
			return "Encosta no terreno de outra pessoa"
	return ""

# ---------- a cada quadro ----------
func _process(dt: float) -> void:
	if m.heroi == null or m.hud == null:
		return
	var hp: Vector3 = m.heroi.position
	var vivo: bool = m.h.morto <= 0.0
	var livre := ativo or comprando
	m.hud.modo_construcao = livre
	m.hud.arrastar_terreno = comprando
	# nas terras e sem terreno: botão Comprar terreno
	m.hud.mostrar_botao("lote", meu == "" and dentro_das_terras(hp.x, hp.z, -2.0) and vivo and not livre)
	var no_meu := meu != "" and lotes.has(meu) and dist_ret(lotes[meu].def, hp.x, hp.z) <= float(D.lote.alcance)
	m.hud.mostrar_botao("construir", no_meu and vivo and not livre)
	# estação do terreno perto: um botão só (o André tirou o botão da forja da HUD; a forja do Tomás fica no Falar)
	var prof := prof_da_estacao()
	m.hud.mostrar_botao("bancada", prof != "" and vivo and not livre)
	if prof != "":
		m.hud.icone_botao("bancada", "pf_" + prof)
	if livre:
		if not vivo or m.menu.aberto():
			sair()
			sair_compra()
		else:
			_mover_mira(dt)
			if ativo:
				_atualizar_mira()
			else:
				_atualizar_compra()
	# horta cresce sozinha: confere a fase de vez em quando
	_t_horta -= dt
	if _t_horta <= 0.0:
		_t_horta = 2.0
		for id in lotes:
			for c in lotes[id].horta:
				var h: Dictionary = lotes[id].horta[c]
				if h.no.position.distance_squared_to(hp) < 3600.0:
					_desenhar_canteiro(h)

# câmera flutuante (Quimera iD): o joystick move a mira a 7 m/s na direção da câmera; a mira não sai do terreno
# (construindo) nem das terras (comprando)
func _mover_mira(dt: float) -> void:
	var j: Vector2 = m.hud.mover
	if j.length() > 0.12:
		mira += Vector3(j.x, 0, j.y).rotated(Vector3.UP, m.cam.yaw) * VEL_MIRA * minf(dt, 0.1) * minf(1.0, j.length() * 1.2)
	if ativo and lotes.has(meu):
		var l: Dictionary = lotes[meu].def
		mira.x = clampf(mira.x, float(l.x0) - 1.5, float(l.x1) + 1.5)
		mira.z = clampf(mira.z, float(l.z0) - 1.5, float(l.z1) + 1.5)
	elif comprando:
		var A: Dictionary = terras.area
		mira.x = clampf(mira.x, float(A.x) - float(A.rx) - 2.0, float(A.x) + float(A.rx) + 2.0)
		mira.z = clampf(mira.z, float(A.z) - float(A.rz) - 2.0, float(A.z) + float(A.rz) + 2.0)
	mira.y = m.terreno.altura(mira.x, mira.z)
	m.cam.entrar_livre(mira)
	if _mira_no == null:
		_mira_no = MeshInstance3D.new()
		var t := TorusMesh.new()
		t.inner_radius = 0.34
		t.outer_radius = 0.42
		t.rings = 24
		t.ring_segments = 6
		_mira_no.mesh = t
		var mt := StandardMaterial3D.new()
		mt.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mt.albedo_color = Color(1.0, 0.9, 0.55, 0.9)
		mt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mt.no_depth_test = true
		_mira_no.material_override = mt
		_mira_no.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_mira_no.scale = Vector3(1, 0.15, 1)
		add_child(_mira_no)
	_mira_no.visible = true
	_mira_no.position = mira + Vector3(0, 0.07, 0)
	var pulso := 1.0 + 0.12 * sin(Time.get_ticks_msec() / 1000.0 * 6.0)
	_mira_no.scale = Vector3(pulso, 0.15, pulso)

func camera_livre() -> bool:
	return ativo or comprando

# ---------- modo construção ----------
func abrir() -> void:
	if not m.on():
		m.hud.aviso("Construir só funciona online (o terreno fica guardado no servidor)")
		return
	if meu == "" or not lotes.has(meu):
		m.hud.aviso("Compre um terreno nas Terras da Estrada para construir")
		return
	if m.trabalho.coletando != null:
		m.trabalho.parar(true)
	ativo = true
	giro = 0
	var hp: Vector3 = m.heroi.position
	var ry: float = m.mov.ry
	mira = hp + Vector3(sin(ry), 0, cos(ry)) * 2.0
	painel.visible = true
	_montar_itens()
	_mostrar_borda(true)
	m.hud.aviso("Modo construção: o joystick move a câmera e a mira. Toque no chão para mirar.")

func sair() -> void:
	if not ativo:
		return
	ativo = false
	painel.visible = false
	if fantasma:
		fantasma.queue_free()
		fantasma = null
		_fantasma_k = ""
	if _destaque:
		_destaque.visible = false
	if _mira_no:
		_mira_no.visible = false
	_mostrar_borda(false)
	m.cam.sair_livre()

func _mostrar_borda(v: bool) -> void:
	if _borda_lote == null:
		_borda_lote = MeshInstance3D.new()
		_borda_lote.mesh = ImmediateMesh.new()
		_borda_lote.material_override = _mat_chao(Color(1.0, 0.9, 0.55, 0.9))
		_borda_lote.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(_borda_lote)
	_borda_lote.visible = v and lotes.has(meu)
	if _borda_lote.visible:
		var im: ImmediateMesh = _borda_lote.mesh
		im.clear_surfaces()
		_pintar_ret(im, lotes[meu].def, Color(1.0, 0.9, 0.55, 0.0), Color(1.0, 0.9, 0.55, 0.95))

# material do que se pinta no chão (terreno marcado, borda): cor por vértice, sem luz, por cima da grama
func _mat_chao(cor: Color) -> StandardMaterial3D:
	var mt := StandardMaterial3D.new()
	mt.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mt.vertex_color_use_as_albedo = true
	mt.albedo_color = Color(1, 1, 1, cor.a)
	mt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mt.cull_mode = BaseMaterial3D.CULL_DISABLED
	mt.render_priority = 2
	return mt

# retângulo no chão seguindo o relevo: miolo em quadrados de 1 m (cor "miolo") e faixa de 12 cm na borda ("borda")
func _pintar_ret(im: ImmediateMesh, R: Dictionary, miolo: Color, borda: Color) -> void:
	var x0: float = float(R.x0)
	var z0: float = float(R.z0)
	var x1: float = float(R.x1)
	var z1: float = float(R.z1)
	var y := func(x: float, z: float) -> float: return m.terreno.altura(x, z) + 0.05
	im.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	if miolo.a > 0.0:
		var nx := mini(int(x1 - x0), 60)
		var nz := mini(int(z1 - z0), 60)
		for i in nx:
			for k in nz:
				var a := Vector2(x0 + i, z0 + k)
				var xadrez := 0.86 if (i + k) % 2 == 0 else 1.0 # quadradinhos de 1 m: dá para contar os blocos
				var c := Color(miolo.r * xadrez, miolo.g * xadrez, miolo.b * xadrez, miolo.a)
				var q := [Vector3(a.x, y.call(a.x, a.y), a.y), Vector3(a.x + 1, y.call(a.x + 1, a.y), a.y),
					Vector3(a.x + 1, y.call(a.x + 1, a.y + 1), a.y + 1), Vector3(a.x, y.call(a.x, a.y + 1), a.y + 1)]
				for v in [q[0], q[1], q[2], q[0], q[2], q[3]]:
					im.surface_set_color(c)
					im.surface_add_vertex(v)
		# linhas da grade a cada 1 m (alpha 0,5, direção de arte)
		var linha := Color(miolo.r * 1.25, miolo.g * 1.25, miolo.b * 1.25, 0.5)
		for i in range(1, nx):
			for k in nz:
				_faixa(im, Vector2(x0 + i - 0.03, z0 + k), Vector2(x0 + i + 0.03, z0 + k + 1), linha, y)
		for k in range(1, nz):
			for i in nx:
				_faixa(im, Vector2(x0 + i, z0 + k - 0.03), Vector2(x0 + i + 1, z0 + k + 0.03), linha, y)
	var cantos := [Vector2(x0, z0), Vector2(x1, z0), Vector2(x1, z1), Vector2(x0, z1)]
	for i in 4:
		var a: Vector2 = cantos[i]
		var b: Vector2 = cantos[(i + 1) % 4]
		var dentro: Vector2 = ((cantos[(i + 2) % 4] + cantos[(i + 3) % 4]) / 2.0 - (a + b) / 2.0).normalized() * 0.12
		var n := maxi(1, int(a.distance_to(b)))
		for s in n:
			var p: Vector2 = a.lerp(b, float(s) / n)
			var q: Vector2 = a.lerp(b, float(s + 1) / n)
			var v1 := Vector3(p.x, y.call(p.x, p.y) + 0.01, p.y)
			var v2 := Vector3(q.x, y.call(q.x, q.y) + 0.01, q.y)
			var v3 := Vector3(q.x + dentro.x, y.call(q.x + dentro.x, q.y + dentro.y) + 0.01, q.y + dentro.y)
			var v4 := Vector3(p.x + dentro.x, y.call(p.x + dentro.x, p.y + dentro.y) + 0.01, p.y + dentro.y)
			for v in [v1, v2, v3, v1, v3, v4]:
				im.surface_set_color(borda)
				im.surface_add_vertex(v)
	im.surface_end()

# retângulo fino alinhado aos eixos (linha da grade), 5 mm acima do miolo
func _faixa(im: ImmediateMesh, a: Vector2, b: Vector2, cor: Color, y: Callable) -> void:
	var q := [Vector3(a.x, y.call(a.x, a.y) + 0.005, a.y), Vector3(b.x, y.call(b.x, a.y) + 0.005, a.y),
		Vector3(b.x, y.call(b.x, b.y) + 0.005, b.y), Vector3(a.x, y.call(a.x, b.y) + 0.005, b.y)]
	for v in [q[0], q[1], q[2], q[0], q[2], q[3]]:
		im.surface_set_color(cor)
		im.surface_add_vertex(v)

# profissão da estação construída mais perto: bancada = Alfaiate, bigorna ou fornalha = Ferreiro ("" = nenhuma)
func prof_da_estacao() -> String:
	if estacao_perto(["bigorna", "fornalha"]):
		return "fer"
	if estacao_perto(["bancada"]):
		return "alf"
	return ""

func tocar_botao_construir() -> void:
	if ativo:
		sair()
	else:
		abrir()

# ponto do chão debaixo do dedo (plano na altura da mira, refinado duas vezes pelo relevo)
func _chao_na_tela(pos: Vector2):
	if m.camera == null:
		return null
	var o: Vector3 = m.camera.project_ray_origin(pos)
	var d: Vector3 = m.camera.project_ray_normal(pos)
	if absf(d.y) < 0.01:
		return null
	var y := mira.y
	var p := Vector3.ZERO
	for i in 3:
		var t: float = (y - o.y) / d.y
		if t <= 0.0:
			return null
		p = o + d * t
		y = m.terreno.altura(p.x, p.z)
	return p

# toque rápido no chão com o modo aberto: a mira vai para lá
func tocou_tela(pos: Vector2) -> void:
	if not ativo or cobre(pos):
		return
	var p = _chao_na_tela(pos)
	if p != null and lotes.has(meu) and dist_ret(lotes[meu].def, p.x, p.z) <= 1.5:
		mira = p

func _atualizar_mira() -> void:
	var p: Vector3 = mira
	var L = lotes.get(meu)
	if L == null:
		sair()
		return
	alvo = {"ok": false, "motivo": ""}
	if aba == "fazenda" or sel == "desmontar":
		_mostrar_fantasma("")
	if aba == "construir" and sel != "desmontar":
		# peça: centro numa grade de 0,5 m
		var x: float = round(p.x * 2.0) / 2.0
		var z: float = round(p.z * 2.0) / 2.0
		var C: Dictionary = D.construcoes[sel]
		var mot := motivo_peca(L, sel, x, z, giro)
		if mot == "" and not tem_custo(C.custo):
			mot = "Falta material: " + custo_txt(C.custo)
		if mot == "" and L.pecas.size() >= max_pecas(L, D.lote):
			mot = "Limite de %d peças no terreno" % max_pecas(L, D.lote)
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
		if mot == "" and m.P.vigor() < float(D.horta.vigor) and sel != "tirar":
			mot = "Sem vigor (volta sozinho com o tempo)"
		alvo = {"ok": mot == "", "motivo": mot, "tipo": "horta", "dados": dados}
		_destaque_em(Vector3(i + 0.5, m.terreno.altura(i + 0.5, j + 0.5), j + 0.5), Vector3(1.0, 0.16, 1.0), Color(0.43, 1.0, 0.54, 0.35) if alvo.ok else Color(1, 0.35, 0.29, 0.35))
	txt_motivo.text = alvo.motivo if alvo.motivo != "" else "Pode colocar aqui"
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

# ---------- comprar o terreno: toque num canto e arraste até o outro (o preço aparece na hora) ----------
func perguntar_compra() -> void:
	if not m.on():
		m.hud.aviso("Comprar terreno só funciona online (fica guardado no servidor)")
		return
	if meu != "":
		m.hud.aviso("Você já tem um terreno")
		return
	if m.trabalho.coletando != null:
		m.trabalho.parar(true)
	sair()
	comprando = true
	_canto_a = null
	_canto_b = null
	_ret = {}
	mira = m.heroi.position
	painel_compra.visible = true
	_desenhar_outros()
	_atualizar_compra()

func sair_compra() -> void:
	if not comprando:
		return
	comprando = false
	painel_compra.visible = false
	for n in [_ret_no, _outros_no, _ret_txt, _mira_no]:
		if n:
			n.visible = false
	m.cam.sair_livre()

# fase 0 = encostou o dedo (primeiro canto), 1 = arrastando, 2 = soltou
func arrasto(pos: Vector2, fase_: int) -> void:
	if not comprando or (fase_ == 0 and cobre(pos)):
		return
	var p = _chao_na_tela(pos)
	if p == null:
		return
	var c := Vector2i(floori(p.x), floori(p.z))
	if fase_ == 0 or _canto_a == null:
		_canto_a = c
	_canto_b = c
	_ret = {"x0": mini(_canto_a.x, _canto_b.x), "z0": mini(_canto_a.y, _canto_b.y), "x1": maxi(_canto_a.x, _canto_b.x) + 1, "z1": maxi(_canto_a.y, _canto_b.y) + 1}
	_atualizar_compra()

func _atualizar_compra() -> void:
	var ouro := int(m.P.prog.get("ouro", 0))
	if _ret.is_empty():
		txt_compra.text = "Toque num canto do terreno e arraste até o outro canto"
		txt_compra.add_theme_color_override("font_color", Menu.TEXTO)
		txt_compra_info.text = "%d de ouro por bloco de 1 x 1 m · lados de %d a %d m · você tem %d de ouro" % [int(D.lote.precoBloco), int(D.lote.ladoMin), int(D.lote.ladoMax), ouro]
		b_comprar.disabled = true
		if _ret_no:
			_ret_no.visible = false
			_ret_txt.visible = false
		return
	var w: int = int(_ret.x1) - int(_ret.x0)
	var d: int = int(_ret.z1) - int(_ret.z0)
	var preco := preco_terreno(_ret)
	_ret_motivo = motivo_terreno(_ret)
	if _ret_motivo == "" and ouro < preco:
		_ret_motivo = "Faltam %d de ouro" % (preco - ouro)
	var ok := _ret_motivo == ""
	txt_compra.text = "%d x %d m = %d blocos · %d de ouro" % [w, d, w * d, preco]
	txt_compra.add_theme_color_override("font_color", Menu.OURO_CLARO if ok else Color("ffb3a3"))
	txt_compra_info.text = ("Você tem %d de ouro · cabem %d peças" % [ouro, max_pecas({"def": _ret}, D.lote)]) if ok else _ret_motivo
	b_comprar.disabled = not ok
	# chão pintado: verde (dá) ou vermelho (não dá), quadriculado de 1 m
	if _ret_no == null:
		_ret_no = MeshInstance3D.new()
		_ret_no.mesh = ImmediateMesh.new()
		_ret_no.material_override = _mat_chao(Color(1, 1, 1, 1))
		_ret_no.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(_ret_no)
		_ret_txt = Label3D.new()
		_ret_txt.font = m.fonte_nome()
		_ret_txt.font_size = 40
		_ret_txt.pixel_size = 0.0011
		_ret_txt.outline_size = 10
		_ret_txt.outline_modulate = Color(0.08, 0.06, 0.04)
		_ret_txt.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		_ret_txt.no_depth_test = true
		_ret_txt.fixed_size = true # mesmo tamanho na tela de perto e de longe (~20 px)
		add_child(_ret_txt)
	var im: ImmediateMesh = _ret_no.mesh
	im.clear_surfaces()
	var cor := Color(0.45, 0.95, 0.5, 0.3) if ok else Color(1.0, 0.4, 0.32, 0.32)
	_pintar_ret(im, _ret, cor, Color(cor, 0.95))
	_ret_no.visible = true
	var cx: float = (float(_ret.x0) + float(_ret.x1)) / 2.0
	var cz: float = (float(_ret.z0) + float(_ret.z1)) / 2.0
	_ret_txt.position = Vector3(cx, m.terreno.altura(cx, cz) + 1.4, cz)
	_ret_txt.text = "%d x %d m\n%d de ouro" % [w, d, preco]
	_ret_txt.modulate = Color("fff1c8") if ok else Color("ffb3a3")
	_ret_txt.visible = true

# terrenos que já têm dono, em vermelho fraco (só enquanto se escolhe)
func _desenhar_outros() -> void:
	if _outros_no == null:
		_outros_no = MeshInstance3D.new()
		_outros_no.mesh = ImmediateMesh.new()
		_outros_no.material_override = _mat_chao(Color(1, 1, 1, 1))
		_outros_no.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(_outros_no)
	var im: ImmediateMesh = _outros_no.mesh
	im.clear_surfaces()
	var algum := false
	for id in lotes:
		if lotes[id].dono != null:
			_pintar_ret(im, lotes[id].def, Color(0.75, 0.3, 0.25, 0.16), Color(0.95, 0.45, 0.35, 0.8))
			algum = true
	_outros_no.visible = algum

func comprar() -> void:
	if _ret.is_empty() or _ret_motivo != "":
		m.hud.aviso(_ret_motivo if _ret_motivo != "" else "Marque o terreno primeiro")
		return
	m.rede("lote", {"x0": int(_ret.x0), "z0": int(_ret.z0), "x1": int(_ret.x1), "z1": int(_ret.z1)})

# ---------- tela: barra de itens embaixo, no meio (como a do Quimera); o joystick à esquerda continua livre ----------
func cobre(p: Vector2) -> bool:
	for pn in [painel, painel_compra]:
		if pn != null and pn.visible and pn.get_global_rect().grow(6).has_point(p):
			return true
	return false

func _botao(t: String, fn: Callable, ativo_ := false, tam := 15) -> Button:
	var b := Button.new()
	b.text = t
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", tam)
	b.custom_minimum_size = Vector2(0, 40)
	Menu.estilo_botao(b, ativo_)
	b.pressed.connect(fn)
	return b

func _barra_embaixo() -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", Menu.caixa(Color(Menu.FUNDO, 0.93), Menu.OURO.darkened(0.25), 2, 10, 10))
	p.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	p.grow_horizontal = Control.GROW_DIRECTION_BOTH
	p.grow_vertical = Control.GROW_DIRECTION_BEGIN
	p.offset_bottom = -12
	p.visible = false
	tela.add_child(p)
	return p

func _montar_tela() -> void:
	tela = CanvasLayer.new()
	tela.layer = 6
	add_child(tela)
	# modo construção
	painel = _barra_embaixo()
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 4)
	painel.add_child(col)
	var topo := HBoxContainer.new()
	topo.add_theme_constant_override("separation", 10)
	col.add_child(topo)
	txt_nome = Menu.rotulo("", 14, Menu.OURO_CLARO)
	topo.add_child(txt_nome)
	txt_motivo = Menu.rotulo("", 13, Color("ffb3a3"))
	txt_motivo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt_motivo.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	txt_motivo.clip_text = true
	txt_motivo.custom_minimum_size = Vector2(240, 0)
	topo.add_child(txt_motivo)
	var baixo := HBoxContainer.new()
	baixo.add_theme_constant_override("separation", 6)
	col.add_child(baixo)
	linha_abas = VBoxContainer.new()
	linha_abas.add_theme_constant_override("separation", 4)
	baixo.add_child(linha_abas)
	for k in ["construir", "fazenda"]:
		var b := _botao("Construir" if k == "construir" else "Fazenda", func(): trocar_aba(k), k == aba, 13)
		b.custom_minimum_size = Vector2(92, 29)
		_botoes_abas[k] = b
		linha_abas.add_child(b)
	var pc := Menu.rotulo("", 13, Menu.APAGADO)
	pc.name = "pecas"
	pc.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	linha_abas.add_child(pc)
	linha_itens = HBoxContainer.new()
	linha_itens.add_theme_constant_override("separation", 5)
	baixo.add_child(linha_itens)
	var sep := VSeparator.new()
	sep.add_theme_constant_override("separation", 8)
	baixo.add_child(sep)
	b_girar = _botao("Girar", girar)
	b_girar.custom_minimum_size = Vector2(76, 62)
	baixo.add_child(b_girar)
	b_ok = _botao("Colocar", colocar, true, 16)
	b_ok.custom_minimum_size = Vector2(104, 62)
	baixo.add_child(b_ok)
	b_sair = _botao("Sair", sair)
	b_sair.custom_minimum_size = Vector2(66, 62)
	baixo.add_child(b_sair)
	# compra do terreno
	painel_compra = _barra_embaixo()
	var cc := VBoxContainer.new()
	cc.add_theme_constant_override("separation", 6)
	painel_compra.add_child(cc)
	var t1 := HBoxContainer.new()
	t1.add_theme_constant_override("separation", 10)
	cc.add_child(t1)
	var tit := Menu.rotulo("Comprar terreno", 16, Menu.OURO)
	t1.add_child(tit)
	txt_compra = Menu.rotulo("", 16)
	txt_compra.custom_minimum_size = Vector2(380, 0)
	t1.add_child(txt_compra)
	var t2 := HBoxContainer.new()
	t2.add_theme_constant_override("separation", 10)
	cc.add_child(t2)
	txt_compra_info = Menu.rotulo("", 13, Menu.APAGADO)
	txt_compra_info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt_compra_info.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	txt_compra_info.custom_minimum_size = Vector2(360, 0)
	t2.add_child(txt_compra_info)
	var canc := _botao("Cancelar", sair_compra)
	canc.custom_minimum_size = Vector2(100, 42)
	t2.add_child(canc)
	b_comprar = _botao("Comprar", comprar, true, 16)
	b_comprar.custom_minimum_size = Vector2(120, 42)
	t2.add_child(b_comprar)

func trocar_aba(k: String) -> void:
	aba = k
	sel = "bancada" if k == "construir" else "arar"
	_montar_itens()

# quadrado da barra (Quimera bhi): ícone, número embaixo à direita, aro dourado no escolhido, apagado sem material
func _slot(k: String, ico: String, numero: String, escolhido: bool, tem: bool, cor_ico := Color.WHITE) -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(60, 62)
	Menu.estilo_botao(b, escolhido)
	if escolhido:
		var st: StyleBoxFlat = Menu.caixa(Menu.FUNDO3, Menu.OURO_CLARO, 3, 8)
		b.add_theme_stylebox_override("normal", st)
		b.add_theme_stylebox_override("hover", st)
	var t := TextureRect.new()
	t.texture = Menu.icone_tex(ico)
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	t.set_anchors_preset(Control.PRESET_FULL_RECT)
	t.offset_left = 9
	t.offset_right = -9
	t.offset_top = 6
	t.offset_bottom = -14
	t.modulate = cor_ico if tem else Color(cor_ico, 0.38)
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(t)
	if numero != "":
		var n := Menu.rotulo(numero, 14, Color.WHITE if tem else Color("e0a090"))
		n.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
		n.grow_horizontal = Control.GROW_DIRECTION_BEGIN
		n.grow_vertical = Control.GROW_DIRECTION_BEGIN
		n.offset_right = -4
		n.offset_bottom = -1
		n.add_theme_constant_override("outline_size", 4)
		n.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
		n.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(n)
	b.pressed.connect(func(): escolher(k))
	return b

# quantas peças dá para fazer com o que tenho na mochila
func _quantas(custo: Dictionary) -> int:
	var n := 999
	for k in custo:
		n = mini(n, int(m.P.contar(k) / maxi(1, int(custo[k]))))
	return n

func _montar_itens() -> void:
	for b in _botoes_abas:
		Menu.estilo_botao(_botoes_abas[b], b == aba)
	for n in linha_itens.get_children():
		n.queue_free()
	var L = lotes.get(meu)
	var pc: Label = linha_abas.get_node("pecas")
	pc.text = ("Peças %d/%d" % [L.pecas.size(), max_pecas(L, D.lote)] if L else "") if aba == "construir" else "Vigor %d" % int(m.P.vigor())
	var nome := ""
	if aba == "construir":
		for k in D.construcoes:
			var C: Dictionary = D.construcoes[k]
			var q := _quantas(C.custo)
			linha_itens.add_child(_slot(k, "cs_" + k, str(q), sel == k, q > 0))
			if sel == k:
				nome = "%s · %s" % [C.nome, custo_txt(C.custo)]
		linha_itens.add_child(_slot("desmontar", "cs_desmontar", "", sel == "desmontar", true, Color("ffb3a3")))
		if sel == "desmontar":
			nome = "Desmontar (o material volta para a mochila)"
	else:
		linha_itens.add_child(_slot("arar", "cs_arar", "", sel == "arar", true))
		var alguma := false
		for k in D.plantas:
			var n_sem: int = m.P.contar("semente_" + k)
			if n_sem <= 0 and not (sel == "plantar" and semente == k):
				continue
			alguma = true
			linha_itens.add_child(_slot("plantar:" + k, "it_semente", str(n_sem), sel == "plantar" and semente == k, n_sem > 0, Color(str(D.plantas[k].cor)).lightened(0.25)))
		if not alguma:
			linha_itens.add_child(_slot("plantar:" + semente, "it_semente", "0", false, false))
		linha_itens.add_child(_slot("regar", "cs_regar", "", sel == "regar", true))
		linha_itens.add_child(_slot("colher", "it_colheita", "", sel == "colher", true))
		linha_itens.add_child(_slot("tirar", "desfazer", "", sel == "tirar", true))
		nome = {"arar": "Arar a terra", "regar": "Regar (a terra fica molhada %d h)" % int(D.horta.rega), "colher": "Colher", "tirar": "Desfazer a terra arada"}.get(sel, "")
		if sel == "plantar":
			nome = "Plantar %s (%d sementes · a Rosa vende)" % [str(D.plantas[semente].nome).to_lower(), m.P.contar("semente_" + semente)]
	txt_nome.text = nome
	b_girar.visible = aba == "construir" and sel != "desmontar"
	b_ok.text = {"desmontar": "Desmontar", "arar": "Arar", "plantar": "Plantar", "regar": "Regar", "colher": "Colher", "tirar": "Desfazer"}.get(sel, "Colocar")
	Menu.estilo_botao(b_ok, true)

func escolher(k: String) -> void:
	if k.begins_with("plantar:"):
		semente = k.substr(8)
		k = "plantar"
	sel = k
	_montar_itens()

# mochila mudou (o servidor mandou o progresso): os custos e as sementes da barra se atualizam
func progresso_mudou() -> void:
	if ativo:
		_montar_itens()
	if comprando:
		_atualizar_compra()

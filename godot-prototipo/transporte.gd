extends Node
# FASE 1 (André 2026-11-08/09): packs e transportes, cópia do Quimera. Quem decide é o servidor (shared/transporte.js);
# aqui ficam os modelos (pack nas costas, packs no chão, carrinho, barquinho e navio), o botão do veículo, o painel do
# pack e do carrinho (como o #packc do Quimera), a janela do mercador e o jeito de dirigir (andar.gd passo_veiculo).
# Números em dados/habilidades.json "packs", "packRegras" e "veiculos" (shared/dados.js).
#
# Modelos: madeira de verdade (medieval_wood, mesma textura das casas) e pano trançado (T_Trim_Cloth) nas faixas, lonas
# e na vela; aro de ferro nas rodas. Nada de cor chapada.

var m # main.gd
var PK: Dictionary # packs
var PR: Dictionary # packRegras
var V: Dictionary # veiculos
var veic := {} # id do dono + tipo ("c:ID") -> {no, tipo, packs_txt, ...} (carrinhos, barcos e navios do mundo)
var chao := {} # g -> {no, k, x, z} packs largados
var costas := {} # id do jogador ("eu" = o herói) -> Node3D do pack nas costas
var _painel: PanelContainer
var _painel_txt: RichTextLabel
var _largar: Button
var _busca := 0.0
var _perto_g := "" # pack do chão ao alcance (botão Pegar)
var _botao_estado := "" # o que o botão do veículo faz agora
var comb_local := -1.0 # combustível que o app conta enquanto dirige (o servidor corrige no "prog")
var _mt_madeira: StandardMaterial3D
var _mt_madeira_esc: StandardMaterial3D
var _mt_ferro: StandardMaterial3D
var _mt_pano: StandardMaterial3D
var _mt_corda: StandardMaterial3D

func _init(principal) -> void:
	m = principal

func _ready() -> void:
	PK = m.P.dados.get("packs", {})
	PR = m.P.dados.get("packRegras", {})
	V = m.P.dados.get("veiculos", {})
	_materiais()
	# botões no fim da lista do HUD (os índices de cima são usados em mostrar_build), na coluna dos botões de ação
	m.hud._botao("veiculo", Vector2(585, 160), 30, "it_carrinho", m.hud.COR_TROCA) # dirigir, descer, colocar o barco
	m.hud.botoes[-1].oculto = true
	m.hud._botao("pegar_pack", Vector2(585, 250), 28, "it_pack", m.hud.COR_TROCA) # pack no chão ao alcance
	m.hud.botoes[-1].oculto = true
	_montar_painel()

# ---------- materiais ----------
func _materiais() -> void:
	# madeira: a faixa de veio quente do topo do T_WoodTrim (Quaternius, a mesma das casas), recortada e repetida
	var wt: Image = (load("res://construcao3d/T_WoodTrim_BaseColor.png") as Texture2D).get_image()
	if wt.is_compressed():
		wt.decompress()
	var veio := ImageTexture.create_from_image(wt.get_region(Rect2i(0, 8, wt.get_width(), int(wt.get_height() * 0.2))))
	var wn: Image = (load("res://construcao3d/T_WoodTrim_Normal.png") as Texture2D).get_image()
	if wn.is_compressed():
		wn.decompress()
	var veio_n := ImageTexture.create_from_image(wn.get_region(Rect2i(0, 8, wn.get_width(), int(wn.get_height() * 0.2))))
	_mt_madeira = StandardMaterial3D.new()
	_mt_madeira.albedo_texture = veio
	_mt_madeira.normal_enabled = true
	_mt_madeira.normal_texture = veio_n
	_mt_madeira.roughness = 0.82
	_mt_madeira.uv1_triplanar = true
	_mt_madeira.uv1_scale = Vector3(0.7, 3.2, 0.7)
	_mt_madeira_esc = _mt_madeira.duplicate()
	_mt_madeira_esc.albedo_color = Color(0.58, 0.44, 0.34)
	_mt_ferro = StandardMaterial3D.new()
	_mt_ferro.albedo_color = Color(0.32, 0.31, 0.3)
	_mt_ferro.metallic = 0.8
	_mt_ferro.roughness = 0.45
	# pano de lona: trama de verdade (fios cruzados com variação), feita uma vez aqui
	_mt_pano = StandardMaterial3D.new()
	_mt_pano.albedo_texture = _tex_lona()
	_mt_pano.roughness = 0.95
	_mt_pano.uv1_triplanar = true
	_mt_pano.uv1_scale = Vector3(3, 3, 3)
	_mt_pano.cull_mode = BaseMaterial3D.CULL_DISABLED
	_mt_corda = _mt_pano.duplicate()
	_mt_corda.albedo_color = Color(0.72, 0.58, 0.4)

func _tex_lona() -> ImageTexture:
	var n := 128
	var img := Image.create(n, n, false, Image.FORMAT_RGB8)
	var rnd := RandomNumberGenerator.new()
	rnd.seed = 77
	var fio := []
	for i in n:
		fio.append(rnd.randf_range(-0.05, 0.05))
	for y in n:
		for x in n:
			var cima: bool = ((x / 2) + (y / 2)) % 2 == 0 # trama: um fio por cima, outro por baixo
			var f: float = fio[y] if cima else fio[x]
			var borda: float = 0.9 if (x % 2 == 0 if cima else y % 2 == 0) else 1.0
			var v: float = (0.9 + f + rnd.randf_range(-0.03, 0.03)) * borda
			img.set_pixel(x, y, Color(0.93 * v, 0.88 * v, 0.77 * v))
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)

func _caixa(pai: Node3D, tam: Vector3, pos: Vector3, mt: Material, rot := Vector3.ZERO) -> MeshInstance3D:
	var b := BoxMesh.new()
	b.size = tam
	var mi := MeshInstance3D.new()
	mi.mesh = b
	mi.material_override = mt
	mi.position = pos
	mi.rotation = rot
	pai.add_child(mi)
	return mi

func _cil(pai: Node3D, r: float, h: float, pos: Vector3, mt: Material, rot := Vector3.ZERO, lados := 16) -> MeshInstance3D:
	var c := CylinderMesh.new()
	c.top_radius = r
	c.bottom_radius = r
	c.height = h
	c.radial_segments = lados
	var mi := MeshInstance3D.new()
	mi.mesh = c
	mi.material_override = mt
	mi.position = pos
	mi.rotation = rot
	pai.add_child(mi)
	return mi

# ---------- o pack: caixote de madeira com faixa de pano na cor do pack e cordas (Quimera gL) ----------
func modelo_pack(k: String) -> Node3D:
	var g := Node3D.new()
	var cor := Color(str(PK.get(k, {}).get("cor", "#a0703a")))
	var faixa: StandardMaterial3D = _mt_pano.duplicate()
	faixa.albedo_color = cor.lightened(0.15)
	_caixa(g, Vector3(0.56, 0.5, 0.42), Vector3(0, 0.25, 0), _mt_madeira)
	_caixa(g, Vector3(0.5, 0.18, 0.44), Vector3(0, 0.52, 0), faixa)
	for x in [-0.17, 0.17]:
		_caixa(g, Vector3(0.05, 0.52, 0.44), Vector3(x, 0.26, 0), _mt_madeira_esc)
	_caixa(g, Vector3(0.6, 0.04, 0.46), Vector3(0, 0.4, 0), _mt_corda)
	return g

# ---------- carrinho de carga = "trenzinho" (André 2026-11-09, modelo do Quimera e desenho de conceito aprovado):
# trator com caldeira de barril deitada na frente (tampa de ferro, chaminé), banco do motorista com volante, rodas da
# frente pequenas e de trás grandes; atrás, engatada, a mini carreta de um eixo com os engradados de ripas, que vira
# sozinha nas curvas (articulada). Nv 1: 2 packs · Nv 2: 4 (cintas de bronze) · Nv 3: 6 (aro de ferro e chaminé maior) ·
# Nv 4: 8 (bandeirinhas). "Só faz mais realista": madeira e pano com textura de verdade, ferro e bronze metálicos.
# Desempenho (Poco X7): as peças paradas de mesmo material viram 1 malha só (_juntar); rodas, volante e packs à parte.
const CARRO_BANCO := Vector3(0, 1.0, -0.36) # onde o quadril senta (no "corpo" do trator)
const CARRO_PE := Vector3(0.15, 0.62, 0.02) # pés no assoalho (x = cada lado)
const CARRO_VOLANTE := Vector3(0, 1.2, -0.04) # centro do volante
const CARRO_VOLANTE_INCL := -0.93 # o volante deitado virado para o motorista
const CARRO_ENGATE := Vector3(0, 0.52, -0.82) # onde a carreta engata (no trator)
const CARRETA_LANCA := 0.55 # do engate até a frente da caçamba
const PACK_PASSO := Vector2(0.62, 0.62) # um engradado (largura, comprimento)
var _mt_bronze: StandardMaterial3D
var _mt_ferro_esc: StandardMaterial3D

# lugares dos packs na carreta por nível: [fileira, coluna, andar]
func _lugares_carreta(nv: int) -> Array:
	var l := []
	var fileiras: int = 1 if nv <= 1 else 2
	for f in fileiras:
		for c in 2:
			l.append([f, c, 0])
	if nv >= 3:
		for c in 2:
			l.append([0, c, 1])
	if nv >= 4:
		for c in 2:
			l.append([1, c, 1])
	return l

func _materiais_carrinho() -> void:
	if _mt_bronze:
		return
	_mt_bronze = StandardMaterial3D.new()
	_mt_bronze.albedo_color = Color(0.62, 0.43, 0.2)
	_mt_bronze.metallic = 0.85
	_mt_bronze.roughness = 0.4
	# ferro fosco (metálico demais fica preto chapado sem reflexo no celular)
	_mt_ferro_esc = StandardMaterial3D.new()
	_mt_ferro_esc.albedo_color = Color(0.3, 0.29, 0.28)
	_mt_ferro_esc.metallic = 0.45
	_mt_ferro_esc.roughness = 0.55

# roda de madeira com raios, cubo e aro de ferro (o pivô vira em y; a roda gira em x)
func _roda(pai: Node3D, pos: Vector3, rr: float, larg: float, raios: int, aro_grosso: bool, frente: bool, lista: Array) -> void:
	var piv := Node3D.new()
	piv.position = pos
	piv.set_meta("frente", frente)
	pai.add_child(piv)
	var r := Node3D.new()
	r.name = "roda"
	r.set_meta("r", rr)
	piv.add_child(r)
	var t := TorusMesh.new() # aro de madeira (as cambotas)
	t.inner_radius = rr - 0.07
	t.outer_radius = rr - 0.015
	t.rings = 24
	t.ring_segments = 6
	var mi := MeshInstance3D.new()
	mi.mesh = t
	mi.material_override = _mt_madeira
	mi.rotation.z = PI / 2
	mi.scale = Vector3(1, larg / 0.055, 1)
	r.add_child(mi)
	var t2 := TorusMesh.new() # aro de ferro por fora (Nv 3+: mais grosso)
	t2.inner_radius = rr - (0.035 if aro_grosso else 0.022)
	t2.outer_radius = rr
	t2.rings = 24
	t2.ring_segments = 6
	var mi2 := MeshInstance3D.new()
	mi2.mesh = t2
	mi2.material_override = _mt_ferro_esc
	mi2.rotation.z = PI / 2
	mi2.scale = Vector3(1, larg * (1.2 if aro_grosso else 1.0) / maxf(0.01, t2.outer_radius - t2.inner_radius), 1)
	r.add_child(mi2)
	_cil(r, rr * 0.2, larg * 1.6, Vector3.ZERO, _mt_madeira_esc, Vector3(0, 0, PI / 2), 12) # cubo
	_cil(r, rr * 0.09, larg * 1.9, Vector3.ZERO, _mt_bronze, Vector3(0, 0, PI / 2), 8)
	for i in raios:
		var a := float(i) * TAU / float(raios)
		_caixa(r, Vector3(0.035, rr * 0.82, 0.045), Vector3(0, cos(a), sin(a)) * rr * 0.5, _mt_madeira, Vector3(a, 0, 0))
	lista.append(piv)

# engradado de ripas em volta de um pack: 4 esteios, ripas em cima e embaixo e o X dos lados
func _engradado(pai: Node3D, c: Vector3) -> void:
	var w := 0.6
	var h := 0.56
	var d := 0.58
	for sx in [-1.0, 1.0]:
		for sz in [-1.0, 1.0]:
			_caixa(pai, Vector3(0.045, h, 0.045), c + Vector3(sx * w * 0.5, h * 0.5, sz * d * 0.5), _mt_madeira)
	for y in [0.03, h]:
		for sx in [-1.0, 1.0]:
			_caixa(pai, Vector3(0.035, 0.045, d), c + Vector3(sx * w * 0.5, y, 0), _mt_madeira)
		for sz in [-1.0, 1.0]:
			_caixa(pai, Vector3(w, 0.045, 0.035), c + Vector3(0, y, sz * d * 0.5), _mt_madeira)
	var diag := Vector2(d, h).length()
	for sx in [-1.0, 1.0]: # X nos lados compridos
		for g in [-1.0, 1.0]:
			_caixa(pai, Vector3(0.025, diag * 0.95, 0.04), c + Vector3(sx * w * 0.5, h * 0.5, 0), _mt_madeira_esc, Vector3(g * atan2(d, h), 0, 0))
	var diag2 := Vector2(w, h).length()
	for g in [-1.0, 1.0]: # X atrás
		_caixa(pai, Vector3(diag2 * 0.95, 0.025, 0.04), c + Vector3(0, h * 0.5, -d * 0.5), _mt_madeira_esc, Vector3(0, 0, g * (PI / 2 - atan2(w, h))))

func modelo_carrinho(nv: int) -> Node3D:
	_materiais_carrinho()
	var cinta: Material = _mt_bronze if nv >= 2 else _mt_ferro_esc
	var g := Node3D.new()
	var rodas: Array = []
	var corpo := Node3D.new()
	corpo.name = "corpo"
	g.add_child(corpo)
	var fixo := Node3D.new() # tudo o que não mexe: vira 1 malha por material
	corpo.add_child(fixo)
	# chassi: duas longarinas de madeira com cantoneira de ferro, travessas e o eixo da frente
	for lado in [-1.0, 1.0]:
		_caixa(fixo, Vector3(0.1, 0.14, 2.2), Vector3(lado * 0.36, 0.5, 0.25), _mt_madeira_esc)
		_caixa(fixo, Vector3(0.11, 0.03, 2.2), Vector3(lado * 0.36, 0.58, 0.25), _mt_ferro_esc)
	for z in [-0.78, -0.3, 0.4, 1.15]:
		_caixa(fixo, Vector3(0.82, 0.08, 0.1), Vector3(0, 0.5, z), _mt_madeira_esc)
	_cil(fixo, 0.04, 1.0, Vector3(0, 0.3, 1.0), _mt_ferro_esc, Vector3(0, 0, PI / 2), 8)
	_cil(fixo, 0.05, 1.3, Vector3(0, 0.5, -0.36), _mt_ferro_esc, Vector3(0, 0, PI / 2), 8)
	# caldeira de barril deitada: aduelas (madeira no sentido do comprimento), cintas, tampa de ferro com a porta
	_cil(fixo, 0.37, 1.12, Vector3(0, 0.98, 0.68), _mt_madeira, Vector3(PI / 2, 0, 0), 18)
	_cil(fixo, 0.39, 0.5, Vector3(0, 0.98, 0.68), _mt_madeira, Vector3(PI / 2, 0, 0), 18) # barriga do barril
	for z in [0.2, 0.42, 0.94, 1.16]:
		_cil(fixo, 0.385 if absf(z - 0.68) > 0.4 else 0.4, 0.05, Vector3(0, 0.98, z), cinta, Vector3(PI / 2, 0, 0), 18)
	_cil(fixo, 0.36, 0.06, Vector3(0, 0.98, 1.25), _mt_ferro_esc, Vector3(PI / 2, 0, 0), 18) # tampa da frente
	_cil(fixo, 0.17, 0.04, Vector3(0, 0.95, 1.29), _mt_ferro_esc, Vector3(PI / 2, 0, 0), 14) # porta da fornalha
	_cil(fixo, 0.025, 0.06, Vector3(0.12, 0.95, 1.31), _mt_bronze, Vector3(PI / 2, 0, 0), 8) # trinco
	_cil(fixo, 0.36, 0.06, Vector3(0, 0.98, 0.1), _mt_ferro_esc, Vector3(PI / 2, 0, 0), 18) # tampa de trás
	for lado in [-1.0, 1.0]: # berço que segura o barril
		_caixa(fixo, Vector3(0.08, 0.3, 0.1), Vector3(lado * 0.3, 0.68, 0.3), _mt_madeira_esc)
		_caixa(fixo, Vector3(0.08, 0.3, 0.1), Vector3(lado * 0.3, 0.68, 1.05), _mt_madeira_esc)
	# chaminé (Nv 3+: mais alta, com a boca larga)
	var alta: float = 0.85 if nv >= 3 else 0.6
	_cil(fixo, 0.075, alta, Vector3(0, 1.3 + alta * 0.5, 1.0), _mt_ferro_esc, Vector3.ZERO, 12)
	_cil(fixo, 0.1, 0.05, Vector3(0, 1.32, 1.0), cinta, Vector3.ZERO, 12)
	_cil(fixo, 0.12 if nv >= 3 else 0.09, 0.07, Vector3(0, 1.3 + alta, 1.0), _mt_ferro_esc, Vector3.ZERO, 12)
	var cano := Node3D.new()
	cano.name = "cano" # a fumaça sai daqui
	cano.position = Vector3(0, 1.36 + alta, 1.0)
	corpo.add_child(cano)
	# cabine aberta: assoalho, banco com almofada de couro e encosto, caixa de lenha do lado
	_caixa(fixo, Vector3(0.95, 0.06, 0.75), Vector3(0, 0.6, -0.33), _mt_madeira)
	_caixa(fixo, Vector3(0.7, 0.3, 0.36), Vector3(0, 0.76, -0.42), _mt_madeira)
	var couro: StandardMaterial3D = _mt_pano.duplicate()
	couro.albedo_color = Color(0.36, 0.2, 0.12)
	couro.roughness = 0.7
	_caixa(fixo, Vector3(0.66, 0.08, 0.36), Vector3(0, 0.93, -0.41), couro)
	_caixa(fixo, Vector3(0.66, 0.4, 0.07), Vector3(0, 1.14, -0.62), couro, Vector3(-0.15, 0, 0))
	_caixa(fixo, Vector3(0.72, 0.05, 0.09), Vector3(0, 1.35, -0.65), _mt_madeira_esc, Vector3(-0.15, 0, 0))
	for lado in [-1.0, 1.0]:
		_caixa(fixo, Vector3(0.05, 0.34, 0.5), Vector3(lado * 0.46, 0.79, -0.33), _mt_madeira_esc) # guardas laterais
	# para-lamas das rodas grandes
	for lado in [-1.0, 1.0]:
		_caixa(fixo, Vector3(0.22, 0.04, 0.9), Vector3(lado * 0.64, 1.02, -0.36), _mt_madeira_esc)
		_caixa(fixo, Vector3(0.2, 0.3, 0.04), Vector3(lado * 0.64, 0.88, -0.82), _mt_madeira_esc)
	# volante: coluna e aro (gira com a direção)
	_cil(fixo, 0.025, 0.6, (Vector3(0, 0.62, 0.3) + CARRO_VOLANTE) * 0.5, _mt_ferro_esc, Vector3(-0.52, 0, 0), 8)
	var vol := Node3D.new()
	vol.name = "volante"
	vol.position = CARRO_VOLANTE
	vol.rotation.x = CARRO_VOLANTE_INCL
	corpo.add_child(vol)
	var aro := Node3D.new()
	aro.name = "aro"
	vol.add_child(aro)
	var t := TorusMesh.new()
	t.inner_radius = 0.15
	t.outer_radius = 0.185
	t.rings = 20
	t.ring_segments = 6
	var mi := MeshInstance3D.new()
	mi.mesh = t
	mi.material_override = _mt_madeira_esc
	aro.add_child(mi)
	for i in 2:
		_caixa(aro, Vector3(0.32, 0.02, 0.025), Vector3.ZERO, _mt_ferro_esc, Vector3(0, float(i) * PI / 2, 0))
	# rodas do trator: as da frente pequenas (viram), as de trás grandes
	var rd := Node3D.new()
	rd.name = "rodas"
	g.add_child(rd)
	for lado in [-1.0, 1.0]:
		_roda(rd, Vector3(lado * 0.5, 0.3, 1.0), 0.3, 0.09, 8, nv >= 3, true, rodas)
		_roda(rd, Vector3(lado * 0.62, 0.5, -0.36), 0.5, 0.11, 10, nv >= 3, false, rodas)
	# engate
	_cil(fixo, 0.05, 0.08, CARRO_ENGATE, _mt_ferro_esc, Vector3.ZERO, 10)
	_juntar(fixo)
	# ---- a carreta (articulada no engate) ----
	var car := Node3D.new()
	car.name = "carreta"
	car.position = CARRO_ENGATE
	g.add_child(car)
	var cfix := Node3D.new()
	car.add_child(cfix)
	var lug := _lugares_carreta(nv)
	var fileiras: int = 1 if nv <= 1 else 2
	var comp: float = float(fileiras) * PACK_PASSO.y + 0.12
	var z0 := -CARRETA_LANCA # frente da caçamba
	var zc: float = z0 - comp * 0.5
	for lado in [-1.0, 1.0]: # lança em V até o engate
		var de := Vector3(lado * 0.4, 0.0, z0)
		var meio := (de + Vector3(0, 0, -0.04)) * 0.5
		var lanca := _caixa(cfix, Vector3(0.06, 0.07, de.length()), meio, _mt_madeira_esc)
		lanca.basis = Basis.looking_at(de - Vector3(0, 0, -0.04), Vector3.UP)
	_cil(cfix, 0.045, 0.06, Vector3(0, 0.0, -0.02), _mt_ferro_esc, Vector3.ZERO, 10) # olhal
	_caixa(cfix, Vector3(1.3, 0.07, comp), Vector3(0, 0.08, zc), _mt_madeira) # piso
	for lado in [-1.0, 1.0]:
		_caixa(cfix, Vector3(0.08, 0.12, comp + 0.1), Vector3(lado * 0.6, 0.01, zc), _mt_madeira_esc) # longarinas
		_caixa(cfix, Vector3(0.05, 0.16, comp), Vector3(lado * 0.66, 0.2, zc), _mt_madeira) # guarda baixa
	_caixa(cfix, Vector3(1.3, 0.16, 0.05), Vector3(0, 0.2, z0 - comp), _mt_madeira)
	_cil(cfix, 0.045, 1.5, Vector3(0, -0.07, zc), _mt_ferro_esc, Vector3(0, 0, PI / 2), 8) # eixo
	for lado in [-1.0, 1.0]:
		_caixa(cfix, Vector3(0.24, 0.04, 0.95), Vector3(lado * 0.76, 0.42, zc), _mt_madeira_esc) # para-lamas
	var lugares := []
	for l in lug:
		var c := Vector3((float(l[1]) - 0.5) * PACK_PASSO.x, 0.12 + float(l[2]) * 0.58, z0 - 0.06 - PACK_PASSO.y * 0.5 - float(l[0]) * PACK_PASSO.y)
		_engradado(cfix, c)
		lugares.append(c + Vector3(0, 0.02, 0))
	if nv >= 4: # bandeirinhas nos cantos de cima
		var flamula: StandardMaterial3D = _mt_pano.duplicate()
		flamula.albedo_color = Color(0.85, 0.2, 0.15)
		for sx in [-1.0, 1.0]:
			for f in fileiras:
				var base := Vector3(sx * 0.62, 1.28, z0 - 0.06 - float(f) * PACK_PASSO.y * 1.0 - (0.0 if f == 0 else 0.55))
				_cil(cfix, 0.012, 0.6, base + Vector3(0, 0.3, 0), _mt_ferro_esc, Vector3.ZERO, 6)
				_caixa(cfix, Vector3(0.01, 0.13, 0.2), base + Vector3(0, 0.52, -0.1), flamula)
	_juntar(cfix)
	for lado in [-1.0, 1.0]:
		_roda(car, Vector3(lado * 0.76, -0.07, zc), 0.45, 0.1, 10, nv >= 3, false, rodas)
	var pk := Node3D.new()
	pk.name = "packs"
	pk.set_meta("lugares", lugares)
	car.add_child(pk)
	g.set_meta("rodas", rodas)
	g.set_meta("carreta_eixo", absf(zc)) # do engate até o eixo da carreta
	_sombra(g)
	return g

# junta as malhas filhas de mesmo material numa só (menos chamadas de desenho no celular)
func _juntar(pai: Node3D) -> void:
	var por_mt := {}
	for c in pai.get_children():
		if c is MeshInstance3D and c.visible and c.get_child_count() == 0:
			var mt: Material = c.material_override
			if not por_mt.has(mt):
				var st := SurfaceTool.new()
				st.begin(Mesh.PRIMITIVE_TRIANGLES)
				por_mt[mt] = st
			(por_mt[mt] as SurfaceTool).append_from(c.mesh, 0, c.transform)
	for c in pai.get_children():
		if c is MeshInstance3D and c.get_child_count() == 0:
			pai.remove_child(c)
			c.free()
	for mt in por_mt:
		var mi := MeshInstance3D.new()
		mi.mesh = (por_mt[mt] as SurfaceTool).commit()
		mi.material_override = mt
		pai.add_child(mi)

# ---------- barquinho a remo (2 pessoas): casco curvo de tábuas (feito aqui, seção por seção), amurada, faixas das
# tábuas, bancos, assoalho e o remo de pá que o herói segura sentado (André 2026-11-09) ----------
const BARCO_BANCO := Vector3(0, 0.33, -0.22) # quadril no banco do meio (no "corpo" do barco)
const BARCO_PE := Vector3(0.15, 0.03, 0.32)
const BARCO_L := 1.35 # meio comprimento do casco
const BARCO_W := 0.52 # meia largura no meio (1 m de boca: a pá entra logo fora da amurada)
func _barco_secao(z: float) -> Array: # [meia largura, altura da amurada, altura da quilha]
	var u: float = clampf(absf(z) / BARCO_L, 0.0, 1.0)
	var w: float = BARCO_W * pow(maxf(0.0, 1.0 - pow(u, 2.2)), 0.6)
	return [maxf(w, 0.008), 0.4 + 0.16 * u * u, -0.14 + 0.36 * pow(u, 4.0)]

func _barco_ponto(z: float, t: float, fora := 0.0) -> Vector3: # t: -1 (amurada esq) .. 0 (quilha) .. 1 (amurada dir)
	var sc: Array = _barco_secao(z)
	var f: float = t * PI * 0.5
	var p := Vector3(float(sc[0]) * sin(f), float(sc[2]) + (float(sc[1]) - float(sc[2])) * (1.0 - cos(f)), z)
	if fora != 0.0: # um pouco para fora da superfície (as faixas das tábuas)
		p += Vector3(sin(f), -cos(f), 0).normalized() * fora
	return p

func _malha_casco(t0: float, t1: float, fora: float, nt: int, nz: int, mt: Material) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for iz in nz:
		var za: float = -BARCO_L + 2.0 * BARCO_L * float(iz) / float(nz)
		var zb: float = -BARCO_L + 2.0 * BARCO_L * float(iz + 1) / float(nz)
		for it in nt:
			var ta: float = lerpf(t0, t1, float(it) / float(nt))
			var tb: float = lerpf(t0, t1, float(it + 1) / float(nt))
			var a := _barco_ponto(za, ta, fora)
			var b := _barco_ponto(za, tb, fora)
			var c := _barco_ponto(zb, tb, fora)
			var d := _barco_ponto(zb, ta, fora)
			for v in [a, c, b, a, d, c]:
				st.add_vertex(v)
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mt
	return mi

func modelo_barquinho() -> Node3D:
	var g := Node3D.new()
	var corpo := Node3D.new()
	corpo.name = "corpo"
	corpo.position.y = 0.1 # o fundo fica acima da água (a água não aparece dentro do barco)
	g.add_child(corpo)
	var casco_mt: StandardMaterial3D = _mt_madeira.duplicate()
	casco_mt.cull_mode = BaseMaterial3D.CULL_DISABLED # o mesmo casco por fora e por dentro
	casco_mt.uv1_scale = Vector3(0.9, 0.9, 2.6) # veio ao longo das tábuas
	corpo.add_child(_malha_casco(-1.0, 1.0, 0.0, 12, 22, casco_mt))
	# faixas das tábuas (mais escuras, um dedo para fora) e a amurada grossa no alto
	var faixa_mt: StandardMaterial3D = _mt_madeira_esc.duplicate()
	faixa_mt.cull_mode = BaseMaterial3D.CULL_DISABLED
	for lado in [-1.0, 1.0]:
		for t in [0.42, 0.72]:
			corpo.add_child(_malha_casco(lado * t, lado * (t + 0.035), 0.006, 1, 22, faixa_mt))
		corpo.add_child(_malha_casco(lado * 0.965, lado * 1.0, 0.018, 1, 22, faixa_mt))
	# amurada: tábua deitada em cima da borda, de ponta a ponta
	var n := 14
	for i in n:
		var za: float = -BARCO_L * 0.92 + 2.0 * BARCO_L * 0.92 * float(i) / float(n)
		var zb: float = -BARCO_L * 0.92 + 2.0 * BARCO_L * 0.92 * float(i + 1) / float(n)
		for lado in [-1.0, 1.0]:
			var a := _barco_ponto(za, lado)
			var b := _barco_ponto(zb, lado)
			var meio := (a + b) * 0.5
			var seg := _caixa(corpo, Vector3(0.07, 0.035, a.distance_to(b) + 0.02), meio + Vector3(0, 0.015, 0), _mt_madeira_esc)
			seg.basis = Basis.looking_at(b - a, Vector3.UP)
	# proa e popa: as pontas de madeira subindo
	_cil(corpo, 0.035, 0.42, Vector3(0, 0.42, BARCO_L - 0.02), _mt_madeira_esc, Vector3(0.25, 0, 0), 8)
	_cil(corpo, 0.035, 0.4, Vector3(0, 0.4, -BARCO_L + 0.02), _mt_madeira_esc, Vector3(-0.25, 0, 0), 8)
	# assoalho, cavernas (costelas) e bancos
	_caixa(corpo, Vector3(0.44, 0.03, 1.6), Vector3(0, -0.05, 0), _mt_madeira_esc)
	for z in [-0.8, -0.4, 0.0, 0.4, 0.8]:
		var sc: Array = _barco_secao(z)
		_caixa(corpo, Vector3(float(sc[0]) * 1.05, 0.04, 0.05), Vector3(0, -0.02, z), _mt_madeira_esc)
	for z in [BARCO_BANCO.z, 0.62, -0.95]:
		var sc2: Array = _barco_secao(z)
		_caixa(corpo, Vector3(float(sc2[0]) * 2.0 - 0.05, 0.05, 0.26), Vector3(0, 0.22, z), _mt_madeira)
	# o remo de pá: o eixo local -Y aponta para a pá; a origem fica entre as mãos (transporte.gd move a cada quadro)
	var remo := Node3D.new()
	remo.name = "remo"
	remo.position = Vector3(0, 0.5, 0.15)
	corpo.add_child(remo)
	_cil(remo, 0.022, 1.32, Vector3(0, -0.36, 0), _mt_madeira_esc, Vector3.ZERO, 8)
	_caixa(remo, Vector3(0.12, 0.035, 0.035), Vector3(0, 0.31, 0), _mt_madeira_esc) # punho em T
	_caixa(remo, Vector3(0.17, 0.4, 0.025), Vector3(0, -1.12, 0), _mt_madeira) # pá
	_sombra(g)
	return g

# navio mercante: casco largo, convés, porão com os packs à vista, mastro e vela de pano
func modelo_navio() -> Node3D:
	var g := Node3D.new()
	var corpo := Node3D.new()
	corpo.name = "corpo"
	g.add_child(corpo)
	_caixa(corpo, Vector3(3.0, 1.2, 8.5), Vector3(0, -0.1, 0), _mt_madeira_esc) # casco
	for lado in [-1.0, 1.0]:
		_caixa(corpo, Vector3(0.12, 0.5, 8.4), Vector3(lado * 1.5, 0.75, 0), _mt_madeira) # amurada
	_caixa(corpo, Vector3(2.2, 1.1, 1.8), Vector3(0, 0.25, 4.5), _mt_madeira_esc, Vector3(-0.35, 0, 0)) # proa
	_caixa(corpo, Vector3(2.9, 0.08, 8.3), Vector3(0, 0.52, 0), _mt_madeira) # convés
	_caixa(corpo, Vector3(2.8, 0.9, 1.6), Vector3(0, 0.95, -3.4), _mt_madeira) # castelo de popa
	_cil(corpo, 0.12, 7.0, Vector3(0, 4.0, 0.6), _mt_madeira_esc) # mastro
	_caixa(corpo, Vector3(3.4, 0.1, 0.1), Vector3(0, 6.4, 0.6), _mt_madeira_esc) # verga
	var vela := _caixa(corpo, Vector3(3.2, 3.6, 0.04), Vector3(0, 4.55, 0.68), _mt_pano)
	vela.name = "vela"
	var pk := Node3D.new()
	pk.name = "packs"
	pk.position = Vector3(0, 0.56, 1.8)
	corpo.add_child(pk)
	_sombra(g)
	return g

func _sombra(g: Node3D) -> void:
	for c in g.find_children("*", "MeshInstance3D", true, false):
		(c as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON

# packs empilhados na caçamba (2 por fileira) ou no porão (4 por fileira)
func _por_packs(no: Node3D, lista: Array, por_fila: int, passo: Vector2, base_y: float) -> void:
	var pk: Node3D = no.find_child("packs", true, false)
	if pk == null:
		return
	var lug: Array = pk.get_meta("lugares", [])
	var txt := ",".join(PackedStringArray(lista.map(func(k): return str(k))))
	if pk.get_meta("txt", "-") == txt:
		return
	pk.set_meta("txt", txt)
	for c in pk.get_children():
		c.queue_free()
	for i in lista.size():
		var p := modelo_pack(str(lista[i]))
		var col := i % por_fila
		var fila := i / por_fila
		p.position = lug[i] if i < lug.size() else Vector3((col - (por_fila - 1) * 0.5) * passo.x, base_y, -fila * passo.y)
		p.rotation.y = float(i) * 0.3 - floor(float(i) * 0.3)
		pk.add_child(p)

# ---------- painel do pack e do carrinho (Quimera #packc), em cima à esquerda embaixo da vida ----------
func _montar_painel() -> void:
	var cl := CanvasLayer.new()
	cl.layer = 5
	add_child(cl)
	_painel = PanelContainer.new()
	_painel.position = Vector2(16, 150)
	_painel.mouse_filter = Control.MOUSE_FILTER_STOP
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.09, 0.07, 0.05, 0.72)
	sb.border_color = Color(0.85, 0.7, 0.4, 0.6)
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(8)
	sb.content_margin_left = 10
	sb.content_margin_right = 10
	sb.content_margin_top = 6
	sb.content_margin_bottom = 6
	_painel.add_theme_stylebox_override("panel", sb)
	cl.add_child(_painel)
	var h := HBoxContainer.new()
	_painel.add_child(h)
	_painel_txt = RichTextLabel.new()
	_painel_txt.bbcode_enabled = true
	_painel_txt.fit_content = true
	_painel_txt.scroll_active = false
	_painel_txt.custom_minimum_size = Vector2(230, 0)
	_painel_txt.add_theme_font_size_override("normal_font_size", 13)
	_painel_txt.add_theme_font_size_override("bold_font_size", 14)
	_painel_txt.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(_painel_txt)
	_largar = Button.new()
	_largar.text = "Largar"
	_largar.focus_mode = Control.FOCUS_NONE
	_largar.add_theme_font_size_override("font_size", 13)
	_largar.pressed.connect(func(): m.rede("pack", {"acao": "largar"}))
	h.add_child(_largar)
	_painel.visible = false

func _atualizar_painel() -> void:
	var p: Dictionary = m.P.prog
	var t := ""
	var pk = p.get("pack")
	if pk is Dictionary and PK.has(str(pk.get("k", ""))):
		t += "[b][color=#ffe7a8]%s[/color][/b]\n[color=#cbbfa8]Feito em: %s · leve pra longe[/color]" % [PK[pk.k].nome, _onde(pk)]
	var c = p.get("carrinho")
	if c is Dictionary and m.mov.veiculo.get("k", "") == "carrinho":
		var gal: float = (comb_local if comb_local >= 0.0 else float(c.get("comb", 0))) / float(V.carrinho.galao)
		t += ("\n" if t != "" else "") + "[b]Carrinho[/b]\n[color=#cbbfa8]Combustível: %s galão · Vida: %d/%d · Packs: %d/%d[/color]" % [
			String.num(snappedf(gal, 0.1)).replace(".", ","), int(c.get("vida", 0)), int(V.carrinho.vida), (c.get("packs", []) as Array).size(), capacidade(c)]
	var nv = p.get("navio")
	if nv is Dictionary and m.mov.veiculo.get("k", "") == "navio":
		t += ("\n" if t != "" else "") + "[b]Navio mercante[/b]\n[color=#cbbfa8]Porão: %d/%d packs[/color]" % [(nv.get("porao", []) as Array).size(), int(V.navio.porao)]
	_painel_txt.text = t
	_painel.visible = t != "" and not m.menu.aberto()
	_largar.visible = pk is Dictionary

# onde o pack foi feito: o mercador mais perto da origem
func _onde(pk: Dictionary) -> String:
	var melhor := "perto daqui"
	var dm := 30.0
	for n in m.npcs:
		if n.funcao != "pack":
			continue
		var d := Vector2(n.no.position.x - float(pk.ox), n.no.position.z - float(pk.oz)).length()
		if d < dm:
			dm = d
			melhor = str(n.nome).get_slice(",", 0)
	return melhor

func capacidade(c: Dictionary) -> int:
	return int(V.carrinho.capacidade) * clampi(int(c.get("lv", 1)), 1, int(V.carrinho.nivelMax))

# ---------- preço (a mesma conta de shared/transporte.js, só para mostrar; quem paga é o servidor) ----------
func _fator_dist(d: float) -> float:
	var D: Dictionary = PR.dist
	if d <= float(D.curto):
		return clampf(float(D.a) + d * float(D.porM), float(D.a), float(D.maxCurto))
	return minf(float(D.max), float(D.maxCurto) + (d - float(D.curto)) * float(D.porMLongo))

func _fator_area(x: float, z: float) -> float:
	var nv := 1
	var dm: float = float(PR.areas.raio)
	for c in m.mundo.get("caca", []):
		var d := Vector2(float(c.x) - x, float(c.z) - z).length()
		if d < dm:
			dm = d
			nv = int(c.get("nivel", 1))
	var f := 1.0
	var A: Dictionary = PR.areas
	for i in (A.niveis as Array).size():
		if nv >= int(A.niveis[i]):
			f = float(A.fator[i])
	return f

func _k_mercador() -> float:
	var nv: int = m.P.prof_nivel("mer") if m.P.has_method("prof_nivel") else 1
	return float(nv - 1) / 19.0

func preco(pk: Dictionary, nx: float, nz: float) -> int:
	if not PK.has(str(pk.get("k", ""))):
		return 0
	var d := Vector2(nx - float(pk.ox), nz - float(pk.oz)).length()
	var area := maxf(_fator_area(float(pk.ox), float(pk.oz)), _fator_area(nx, nz))
	var navio: float = float(PR.navio) if float(pk.get("nav", 0)) >= float(PR.navioMin) else 1.0
	return int(round(float(PK[pk.k].base) * _fator_dist(d) * float(PR.k) * (1.0 + float(PR.mercador.preco) * _k_mercador()) * area * float(PR.extra) * navio))

func custo(k: String) -> Dictionary:
	var r := {}
	var km := _k_mercador()
	for c in PK[k].custo:
		r[c] = maxi(1, int(round(float(PK[k].custo[c]) * (1.0 - float(PR.mercador.material) * km))))
	return r

# ---------- janela do mercador (conversa.gd chama quando o NPC é de pack) ----------
# devolve [fala, opções [[texto, ícone, Callable]]]
func opcoes_mercador(n: Dictionary) -> Array:
	var info: Dictionary = n.get("info", {})
	var k := str(info.get("merch", ""))
	if not PK.has(k):
		return ["...", []]
	var p: Dictionary = m.P.prog
	var nx: float = n.no.position.x
	var nz: float = n.no.position.z
	var c := custo(k)
	var mat := PackedStringArray()
	for it in c:
		mat.append("%s %d/%d" % [m.P.nome_item({"k": it}) if m.P.has_method("nome_item") else it, m.P.contar(it) if m.P.has_method("contar") else 0, c[it]])
	var fala := "Eu faço o %s. Me traga: %s.\nQuanto paga em cada mercador (mais longe e área mais forte = mais caro):" % [PK[k].nome, ", ".join(mat)]
	var lista := []
	for o in m.npcs:
		if o.funcao != "pack" or o == n:
			continue
		lista.append([str(o.nome).get_slice(",", 0), preco({"k": k, "ox": nx, "oz": nz}, o.no.position.x, o.no.position.z)])
	lista.sort_custom(func(a, b): return a[1] > b[1])
	for e in lista:
		fala += "\n · %s: %d de ouro" % [e[0], e[1]]
	var ops := []
	ops.append(["Fazer o pack (%d de vigor)" % int(PR.vigor), "it_pack", func(): m.rede("pack", {"acao": "fazer", "npc": n.id})])
	var entregar := func(pk: Dictionary, de: String, i: int) -> void:
		if not (pk is Dictionary) or not PK.has(str(pk.get("k", ""))):
			return
		if Vector2(nx - float(pk.ox), nz - float(pk.oz)).length() < float(PR.perto):
			ops.append(["%s: foi feito aqui" % PK[pk.k].nome, "it_pack", func(): m.hud.aviso("Esse pack foi feito aqui. Leve pra outro mercador: quanto mais longe, mais paga!")])
			return
		var onde: String = {"costas": "", "carrinho": " (carrinho)", "porao": " (porão)"}[de]
		ops.append(["Entregar %s%s (+%d)" % [PK[pk.k].nome.replace("Pack de ", ""), onde, preco(pk, nx, nz)], "it_ouro", func(): m.rede("pack", {"acao": "entregar", "npc": n.id, "de": de, "i": i}); m.sons.tocar("moedas", -4.0)])
	entregar.call(p.get("pack"), "costas", 0)
	var c2 = p.get("carrinho")
	if c2 is Dictionary and _perto_de(c2.get("chao"), nx, nz, float(V.carrinho.entregar)) or m.mov.veiculo.get("k", "") == "carrinho":
		var cp: Array = (c2 as Dictionary).get("packs", []) if c2 is Dictionary else []
		for i in cp.size():
			entregar.call(cp[i], "carrinho", i)
	var nv = p.get("navio")
	if nv is Dictionary and (_perto_de(nv.get("chao"), nx, nz, float(V.navio.perto)) or m.mov.veiculo.get("k", "") == "navio"):
		var pp: Array = nv.get("porao", [])
		for i in pp.size():
			entregar.call(pp[i], "porao", i)
	return [fala, ops]

func _perto_de(q, x: float, z: float, d: float) -> bool:
	return q is Dictionary and Vector2(float(q.x) - x, float(q.z) - z).length() <= d

# ---------- janela do carrinho (André 2026-11-09: "nada de lista": ícones e lugares) ----------
# Combustível: um lugar só, onde os galões empilham até 8 (tocar = põe 1 galão da mochila; "Encher" põe até lotar).
# Carga: um lugar por pack; os que o carrinho ainda não leva aparecem com cadeado e o nível da melhoria que abre.
# Embaixo: Dirigir, Consertar, Melhorar e Guardar, cada um com o seu ícone. A janela se refaz quando o "prog" chega.
var _jan_carrinho := false
func abrir_carrinho() -> void:
	var c = m.P.prog.get("carrinho")
	if not (c is Dictionary):
		return
	if _jan:
		_jan.queue_free()
	_jan_carrinho = true
	var C: Dictionary = V.carrinho
	var dirigindo: bool = m.mov.veiculo.get("k", "") == "carrinho"
	var lv := int(c.get("lv", 1))
	var cp: Array = c.get("packs", [])
	var pk = m.P.prog.get("pack")
	var quebrado: bool = c.get("quebrado", false)
	_jan = CanvasLayer.new()
	_jan.layer = 16
	add_child(_jan)
	var fundo := ColorRect.new()
	fundo.color = Color(0, 0, 0, 0.35)
	fundo.set_anchors_preset(Control.PRESET_FULL_RECT)
	fundo.gui_input.connect(func(ev): if ev is InputEventMouseButton and ev.pressed: _fechar_janela())
	_jan.add_child(fundo)
	var pc := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.12, 0.09, 0.06, 0.96)
	sb.border_color = Color(0.85, 0.7, 0.4)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(12)
	sb.set_content_margin_all(14)
	pc.add_theme_stylebox_override("panel", sb)
	_jan.add_child(pc)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 10)
	pc.add_child(vb)
	# topo: ícone, nome e nível, barra de vida e o X
	var topo := HBoxContainer.new()
	topo.add_theme_constant_override("separation", 10)
	vb.add_child(topo)
	topo.add_child(_icone(m.hud.icone("it_carrinho"), 40))
	var tv := VBoxContainer.new()
	tv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	topo.add_child(tv)
	tv.add_child(_rotulo("Carrinho de carga · Nv %d" % lv, 18, Color("#ffe7a8")))
	var vida := float(c.get("vida", 0)) / float(C.vida)
	tv.add_child(_barra(vida, Color("#c0392b") if quebrado else Color("#5fae4a"), "QUEBRADO" if quebrado else "Vida %d/%d" % [int(c.get("vida", 0)), int(C.vida)], 300))
	var x := Button.new()
	x.text = "✕"
	x.focus_mode = Control.FOCUS_NONE
	x.custom_minimum_size = Vector2(44, 44)
	x.add_theme_font_size_override("font_size", 20)
	x.pressed.connect(_fechar_janela)
	topo.add_child(x)
	# meio: combustível (1 lugar) | carga (lugares por nível)
	var meio := HBoxContainer.new()
	meio.add_theme_constant_override("separation", 18)
	vb.add_child(meio)
	var vc := VBoxContainer.new()
	vc.add_theme_constant_override("separation", 6)
	meio.add_child(vc)
	vc.add_child(_rotulo("Combustível", 14, Color("#cbbfa8")))
	var comb: float = comb_local if dirigindo and comb_local >= 0.0 else float(c.get("comb", 0))
	var max_comb: float = float(C.galao) * float(C.tanque)
	var galoes: int = int(ceil(comb / float(C.galao) - 0.01))
	var na_mochila: int = m.P.contar("galao")
	var slot_c := _slot(Vector2(96, 96), m.hud.icone("it_galao"), "%d/%d" % [galoes, int(C.tanque)], Color("#e0a040") if galoes > 0 else Color(0.5, 0.42, 0.3),
		func(): _abastecer(1, comb, max_comb, na_mochila))
	vc.add_child(slot_c)
	vc.add_child(_barra(comb / max_comb, Color("#e0a040"), "%d m" % int(comb), 96))
	var encher := Button.new()
	encher.text = "Encher"
	encher.focus_mode = Control.FOCUS_NONE
	encher.custom_minimum_size = Vector2(96, 36)
	encher.disabled = comb >= max_comb - 1.0 or na_mochila <= 0
	encher.pressed.connect(func(): _abastecer(int(C.tanque), comb, max_comb, na_mochila))
	vc.add_child(encher)
	vc.add_child(_rotulo("Na mochila: %d" % na_mochila, 12, Color("#a89a80")))
	var vg := VBoxContainer.new()
	vg.add_theme_constant_override("separation", 6)
	meio.add_child(vg)
	var cap := capacidade(c)
	vg.add_child(_rotulo("Carga · %d/%d packs" % [cp.size(), cap], 14, Color("#cbbfa8")))
	var grade := GridContainer.new()
	grade.columns = 4
	grade.add_theme_constant_override("h_separation", 8)
	grade.add_theme_constant_override("v_separation", 8)
	vg.add_child(grade)
	var total: int = int(C.capacidade) * int(C.nivelMax)
	for i in total:
		if i < cp.size():
			var k := str(cp[i].get("k", ""))
			var nome := str(PK.get(k, {}).get("nome", "Pack")).replace("Pack de ", "")
			var sl := _slot(Vector2(72, 72), m.hud.icone("it_pack"), nome, Color(str(PK.get(k, {}).get("cor", "#a0703a"))),
				func(): _tirar_pack(i))
			grade.add_child(sl)
		elif i < cap:
			grade.add_child(_slot(Vector2(72, 72), null, "vazio", Color(0.5, 0.42, 0.3), func(): _por_pack()))
		else:
			var nv_abre: int = i / int(C.capacidade) + 1
			var tr := _slot(Vector2(72, 72), m.hud.icone("cadeado"), "Nv %d" % nv_abre, Color(0.32, 0.28, 0.22),
				func(): m.hud.aviso("Melhore o carrinho pro Nv %d na bancada pra abrir este lugar" % nv_abre))
			tr.modulate = Color(1, 1, 1, 0.55)
			grade.add_child(tr)
	vg.add_child(_rotulo("Toque num pack pra pegar nas costas; num lugar vazio pra pôr o das costas.", 12, Color("#a89a80")))
	# embaixo: ações com ícone
	var acoes := HBoxContainer.new()
	acoes.add_theme_constant_override("separation", 10)
	acoes.alignment = BoxContainer.ALIGNMENT_CENTER
	vb.add_child(acoes)
	var custo_txt := _rotulo("", 12, Color("#cbbfa8"))
	custo_txt.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	custo_txt.custom_minimum_size = Vector2(480, 0)
	if quebrado:
		acoes.add_child(_acao("Consertar", "cs_desmontar", func(): m.rede("veiculo", {"acao": "consertar"})))
		custo_txt.text = "Consertar o quebrado: 8 lenha + 1 barra de ferro"
	else:
		if not dirigindo:
			acoes.add_child(_acao("Dirigir", "it_carrinho", func(): m.rede("veiculo", {"acao": "subir", "k": "carrinho"}); _fechar_janela()))
		if float(c.get("vida", 0)) < float(C.vida):
			acoes.add_child(_acao("Consertar", "cs_desmontar", func(): m.rede("veiculo", {"acao": "consertar"})))
		if lv < int(C.nivelMax):
			var cu: Dictionary = C.melhorar[lv + 1]
			var t := PackedStringArray()
			for it in cu:
				t.append(("%d de ouro" % int(cu[it])) if it == "ouro" else "%d %s" % [int(cu[it]), m.P.nome_item({"k": it}) if m.P.has_method("nome_item") else it])
			acoes.add_child(_acao("Melhorar", "cs_bancada", func(): m.rede("veiculo", {"acao": "melhorar"})))
			custo_txt.text = "Melhorar pro Nv %d (%d packs, na bancada): %s" % [lv + 1, int(C.capacidade) * (lv + 1), ", ".join(t)]
		if not dirigindo:
			acoes.add_child(_acao("Guardar", "topo_mochila", func(): m.rede("veiculo", {"acao": "guardar", "k": "carrinho"}); _fechar_janela()))
	if custo_txt.text != "":
		vb.add_child(custo_txt)
	m.hud.bloqueado = true
	await get_tree().process_frame
	if is_instance_valid(pc):
		pc.position = (pc.get_viewport_rect().size - pc.size) * 0.5

func _abastecer(n: int, comb: float, max_comb: float, na_mochila: int) -> void:
	if comb >= max_comb - 1.0:
		m.hud.aviso("Tanque cheio")
		return
	if na_mochila <= 0:
		m.hud.aviso("Sem combustível na mochila (crie na bancada: 2 carvão + 1 tecido)")
		return
	m.rede("veiculo", {"acao": "abastecer", "n": n})
	m.sons.tocar("pesca_splash", -14.0)

func _tirar_pack(i: int) -> void:
	if m.P.prog.get("pack") is Dictionary:
		m.hud.aviso("Você já tem um pack nas costas")
		return
	m.rede("pack", {"acao": "tirar_carrinho", "i": i})

func _por_pack() -> void:
	if not (m.P.prog.get("pack") is Dictionary):
		m.hud.aviso("Traga um pack nas costas pra pôr no carrinho")
		return
	m.rede("pack", {"acao": "por_carrinho"})

func _rotulo(t: String, tam: int, cor: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", tam)
	l.add_theme_color_override("font_color", cor)
	return l

func _icone(tex: Texture2D, tam: float) -> TextureRect:
	var r := TextureRect.new()
	r.texture = tex
	r.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	r.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	r.custom_minimum_size = Vector2(tam, tam)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return r

# barra com texto por cima (vida, combustível)
func _barra(f: float, cor: Color, texto: String, larg: float) -> Control:
	var pb := ProgressBar.new()
	pb.min_value = 0.0
	pb.max_value = 1.0
	pb.value = clampf(f, 0.0, 1.0)
	pb.show_percentage = false
	pb.custom_minimum_size = Vector2(larg, 18)
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.05, 0.04, 0.03, 0.9)
	bg.set_corner_radius_all(5)
	var fg := StyleBoxFlat.new()
	fg.bg_color = cor
	fg.set_corner_radius_all(5)
	pb.add_theme_stylebox_override("background", bg)
	pb.add_theme_stylebox_override("fill", fg)
	var l := _rotulo(texto, 12, Color.WHITE)
	l.set_anchors_preset(Control.PRESET_FULL_RECT)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.add_theme_color_override("font_outline_color", Color.BLACK)
	l.add_theme_constant_override("outline_size", 4)
	pb.add_child(l)
	return pb

# um lugar (quadrado com borda na cor do que tem dentro, ícone e o texto embaixo)
func _slot(tam: Vector2, tex: Texture2D, texto: String, cor: Color, fn: Callable) -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = tam
	for estado in ["normal", "hover", "pressed"]:
		var st := StyleBoxFlat.new()
		st.bg_color = Color(0.06, 0.05, 0.04, 0.95) if estado != "pressed" else Color(0.2, 0.15, 0.08, 0.95)
		st.border_color = cor
		st.set_border_width_all(2)
		st.set_corner_radius_all(8)
		b.add_theme_stylebox_override(estado, st)
	if tex:
		var ic := _icone(tex, tam.x * 0.62)
		ic.position = Vector2(tam.x * 0.19, tam.y * 0.06)
		ic.size = Vector2(tam.x * 0.62, tam.x * 0.62)
		b.add_child(ic)
	var l := _rotulo(texto, 12 if tam.x < 90 else 15, Color.WHITE)
	l.add_theme_color_override("font_outline_color", Color.BLACK)
	l.add_theme_constant_override("outline_size", 4)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM if tex else VERTICAL_ALIGNMENT_CENTER
	l.clip_text = true
	l.position = Vector2(2, 0)
	l.size = Vector2(tam.x - 4, tam.y - 4)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if not tex:
		l.add_theme_color_override("font_color", Color(0.6, 0.55, 0.45))
	b.add_child(l)
	b.pressed.connect(fn)
	return b

# botão de ação com ícone grande e o nome embaixo
func _acao(nome: String, ic: String, fn: Callable) -> Button:
	var b := _slot(Vector2(84, 74), m.hud.icone(ic), nome, Color(0.85, 0.7, 0.4), fn)
	return b

func abrir_navio() -> void:
	var nv = m.P.prog.get("navio")
	if not (nv is Dictionary):
		return
	var ops := []
	var pp: Array = nv.get("porao", [])
	var pk = m.P.prog.get("pack")
	if m.mov.veiculo.is_empty():
		ops.append(["Zarpar (você pilota)", func(): m.rede("veiculo", {"acao": "subir", "k": "navio"})])
	if pk is Dictionary:
		ops.append(["Pôr o pack das costas no porão", func(): m.rede("pack", {"acao": "por_porao"})])
	else:
		for i in pp.size():
			ops.append(["Pegar %s nas costas" % str(PK.get(str(pp[i].k), {}).get("nome", "pack")).replace("Pack de ", ""), func(): m.rede("pack", {"acao": "tirar_porao", "i": i})])
	ops.append(["Carregar do carrinho", func(): m.rede("pack", {"acao": "carrinho_porao"})])
	ops.append(["Descarregar no carrinho", func(): m.rede("pack", {"acao": "porao_carrinho"})])
	if m.mov.veiculo.is_empty():
		ops.append(["Guardar na mochila", func(): m.rede("veiculo", {"acao": "guardar", "k": "navio"})])
	_janela("Navio mercante · porão %d/%d" % [pp.size(), int(V.navio.porao)], ops)

# janelinha simples de opções (a mesma cara da janela do NPC)
var _jan: CanvasLayer
func _janela(titulo: String, ops: Array) -> void:
	_jan_carrinho = false
	if _jan:
		_jan.queue_free()
	_jan = CanvasLayer.new()
	_jan.layer = 16
	add_child(_jan)
	var fundo := ColorRect.new()
	fundo.color = Color(0, 0, 0, 0.35)
	fundo.set_anchors_preset(Control.PRESET_FULL_RECT)
	fundo.gui_input.connect(func(ev): if ev is InputEventMouseButton and ev.pressed: _fechar_janela())
	_jan.add_child(fundo)
	var pc := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.12, 0.09, 0.06, 0.95)
	sb.border_color = Color(0.85, 0.7, 0.4)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(10)
	sb.set_content_margin_all(14)
	pc.add_theme_stylebox_override("panel", sb)
	pc.set_anchors_preset(Control.PRESET_CENTER)
	_jan.add_child(pc)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 6)
	pc.add_child(vb)
	var lt := Label.new()
	lt.text = titulo
	lt.add_theme_font_size_override("font_size", 17)
	lt.add_theme_color_override("font_color", Color("#ffe7a8"))
	vb.add_child(lt)
	for o in ops:
		var b := Button.new()
		b.text = str(o[0])
		b.focus_mode = Control.FOCUS_NONE
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.custom_minimum_size = Vector2(320, 38)
		b.add_theme_font_size_override("font_size", 15)
		var fn: Callable = o[1]
		b.pressed.connect(func(): fn.call(); _fechar_janela())
		vb.add_child(b)
	var sair := Button.new()
	sair.text = "Fechar"
	sair.focus_mode = Control.FOCUS_NONE
	sair.custom_minimum_size = Vector2(320, 38)
	sair.pressed.connect(_fechar_janela)
	vb.add_child(sair)
	m.hud.bloqueado = true
	await get_tree().process_frame
	pc.position = (pc.get_viewport_rect().size - pc.size) * 0.5

func _fechar_janela() -> void:
	_jan_carrinho = false
	if _jan:
		_jan.queue_free()
		_jan = null
	if not m.menu.aberto():
		m.hud.bloqueado = false

# ---------- botão do veículo ----------
func usar_botao() -> void:
	match _botao_estado:
		"descer":
			m.rede("veiculo", {"acao": "descer"})
		"carrinho":
			abrir_carrinho()
		"navio":
			abrir_navio()
		"barquinho":
			m.rede("veiculo", {"acao": "colocar", "k": "barquinho"})

func pegar_pack() -> void:
	if _perto_g != "":
		m.rede("pack", {"acao": "pegar", "g": _perto_g})
		m.sons.tocar("pano", -8.0)

func _estado_botao() -> String:
	var hp: Vector3 = m.heroi.position
	if not m.mov.veiculo.is_empty():
		return "navio" if m.mov.veiculo.k == "navio" and _abrir_do_leme else "descer"
	var p: Dictionary = m.P.prog
	var c = p.get("carrinho")
	if c is Dictionary and _perto_de(c.get("chao"), hp.x, hp.z, float(V.carrinho.perto)):
		return "carrinho"
	var nv = p.get("navio")
	if nv is Dictionary and _perto_de(nv.get("chao"), hp.x, hp.z, float(V.navio.perto)):
		return "navio"
	if m.P.contar("barquinho") > 0 and _agua_perto(hp.x, hp.z, float(V.barquinho.fundo)):
		return "barquinho"
	return ""
var _abrir_do_leme := false

func _agua_perto(x: float, z: float, fundo: float) -> bool:
	for r in [1.0, 2.5, 4.0]:
		for i in 8:
			var a := float(i) * TAU / 8.0
			var L: Dictionary = m.terreno.no_lago(x + sin(a) * r, z + cos(a) * r)
			if not L.is_empty() and float(L.fundo) >= fundo:
				return true
	return false

# ---------- o que vem do servidor ----------
# foto: carga = {packs: [[g, k, x, z]], veic: [[tipo, dono, x, z, ry, nv, packs, quebrado, dirigindo]]}
func atualizar(carga) -> void:
	if not (carga is Dictionary):
		return
	var vistos := {}
	for e in carga.get("packs", []):
		var g := str(e[0])
		vistos[g] = true
		if not chao.has(g):
			var no := modelo_pack(str(e[1]))
			m.add_child(no)
			var x := float(e[2])
			var z := float(e[3])
			no.position = Vector3(x, m.terreno.altura(x, z), z)
			no.rotation.y = fmod(x * 7.0, TAU)
			chao[g] = {"no": no, "k": str(e[1]), "x": x, "z": z}
	for g in chao.keys():
		if not vistos.has(g):
			chao[g].no.queue_free()
			chao.erase(g)
	var vv := {}
	var eu := str(m.online.meu_id) if m.online and "meu_id" in m.online else ""
	for e in carga.get("veic", []):
		var tipo := str(e[0])
		var dono := str(e[1])
		var chave := tipo + ":" + dono
		vv[chave] = true
		var v: Dictionary = veic.get(chave, {})
		var nv := int(e[5])
		if v.is_empty() or int(v.get("nv", 0)) != nv:
			if not v.is_empty():
				v.no.queue_free()
			var no: Node3D = modelo_carrinho(nv) if tipo == "c" else modelo_barquinho() if tipo == "b" else modelo_navio()
			m.add_child(no)
			v = {"no": no, "tipo": tipo, "nv": nv, "dono": dono}
			veic[chave] = v
		v.x = float(e[2])
		v.z = float(e[3])
		v.ry = float(e[4])
		v.dirigindo = int(e[8]) == 1
		v.quebrado = int(e[7]) == 1
		v.eu = dono == eu
		if tipo == "c":
			_por_packs(v.no, e[6], 2, Vector2(0.62, 0.55), 0.6)
		elif tipo == "n":
			_por_packs(v.no, e[6], 4, Vector2(0.62, 0.55), 0.0)
	for k in veic.keys():
		if not vv.has(k):
			veic[k].no.queue_free()
			veic.erase(k)

func evento(ev: Dictionary) -> void:
	match str(ev.get("acao", "")):
		"subiu":
			var k := str(ev.k)
			m.mov.x = float(ev.x)
			m.mov.z = float(ev.z)
			m.mov.ry = float(ev.get("ry", m.mov.ry))
			m.mov.vx = 0.0
			m.mov.vz = 0.0
			m.mov.veiculo = {"k": k, "v": 0.0}
			m.P.dirigindo_carrinho = k == "carrinho"
			m.P.carrinho_no_mundo()
			m.mov.disparada = false
			comb_local = float(m.P.prog.get("carrinho", {}).get("comb", 0)) if k == "carrinho" else -1.0
			if m.montaria != null:
				m.montar_lobo(false, false)
			m.sons.tocar("pano", -6.0)
		"desceu":
			m.mov.veiculo = {}
			m.P.dirigindo_carrinho = false
			m.P.carrinho_no_mundo()
			m.mov.x = float(ev.x)
			m.mov.z = float(ev.z)
			m.mov.y = m.terreno.altura(m.mov.x, m.mov.z)
			m.mov.vy = 0.0
			comb_local = -1.0
		"quebrou":
			m.mov.veiculo = {}
			m.P.dirigindo_carrinho = false
			m.P.carrinho_no_mundo()
			m.sons.tocar("arvore_queda", -6.0)
		"dano":
			if m.fx and m.fx.has_method("numero"):
				m.fx.numero(m.heroi.position + Vector3(0, 1.6, 0), "-%d carrinho" % int(ev.n), Color("#ffb35a"))

# o "prog" chegou (o servidor é quem sabe): combustível de verdade
func prog_chegou() -> void:
	if _jan_carrinho and _jan and is_instance_valid(_jan):
		abrir_carrinho.call_deferred() # a janela mostra o que o servidor mandou (combustível, packs, vida, nível)
	var c = m.P.prog.get("carrinho")
	if c is Dictionary and m.mov.veiculo.get("k", "") == "carrinho":
		comb_local = float(c.get("comb", 0))

# combustível que o app conta enquanto dirige (o servidor gasta igual: 1 por metro)
func gastou(d: float) -> void:
	if comb_local >= 0.0:
		comb_local = maxf(0.0, comb_local - d)

func tem_combustivel() -> bool:
	return comb_local > 0.0

# ---------- quadro a quadro ----------
func _process(dt: float) -> void:
	if m.heroi == null or V.is_empty():
		return
	# meu veículo segue o herói (o servidor manda a posição dele 20 vezes por segundo; a minha eu já sei)
	var hp: Vector3 = m.heroi.position
	var meu_k: String = m.mov.veiculo.get("k", "")
	var sentados := {} # id do jogador ("eu" = o herói) -> veículo onde ele está sentado (carrinho e barquinho)
	for chave in veic:
		var v: Dictionary = veic[chave]
		var no: Node3D = v.no
		var alvo := Vector3(v.x, 0, v.z)
		var ry: float = v.ry
		var dirigindo_eu: bool = v.eu and v.dirigindo and meu_k == {"c": "carrinho", "b": "barquinho", "n": "navio"}[v.tipo]
		if dirigindo_eu:
			alvo = Vector3(m.mov.x, 0, m.mov.z)
			ry = m.mov.ry
		elif v.dirigindo and m.online and m.online.outros.has(v.dono):
			var o: Dictionary = m.online.outros[v.dono]
			alvo = Vector3(o.no.position.x, 0, o.no.position.z)
			ry = o.no.rotation.y
		var agua: bool = v.tipo != "c"
		alvo.y = float(m.terreno.agua.nivel) - (0.25 if v.tipo == "n" else 0.0) if agua else m.terreno.altura(alvo.x, alvo.z)
		var antes := no.position
		var ry_antes := no.rotation.y
		no.position = alvo if dirigindo_eu or no.position.distance_to(alvo) > 6.0 else no.position.lerp(alvo, minf(1.0, dt * 12.0))
		no.rotation.y = lerp_angle(no.rotation.y, ry, minf(1.0, dt * 12.0))
		# velocidade e giro de verdade (servem para o meu e para o dos outros: rodas, volante e remada)
		var vel: float = Vector2(no.position.x - antes.x, no.position.z - antes.z).length() / maxf(dt, 0.001)
		if vel > 12.0:
			vel = 0.0 # pulou para a posição nova (chegou agora): não é velocidade
		v.vel = lerpf(float(v.get("vel", 0.0)), vel, minf(1.0, dt * 6.0))
		v.giro = lerpf(float(v.get("giro", 0.0)), clampf(angle_difference(ry_antes, no.rotation.y) / maxf(dt, 0.001), -3.0, 3.0), minf(1.0, dt * 6.0))
		var corpo: Node3D = no.get_node_or_null("corpo")
		if corpo:
			if v.tipo == "c":
				_motor(v, no, corpo, dt)
				_rodas_volante(v, no, corpo, dt)
			else: # balança na água
				corpo.rotation.z = sin(m.tempo * 1.3 + v.x) * (0.012 if v.tipo == "n" else 0.03)
				corpo.rotation.x = sin(m.tempo * 0.9 + v.z) * (0.008 if v.tipo == "n" else 0.02)
				if v.tipo == "b":
					_remar(v, corpo, dt)
		# quem está sentado nele (o carrinho e o barquinho; no navio o herói fica de pé no leme)
		if v.dirigindo and v.tipo != "n":
			if dirigindo_eu:
				sentados["eu"] = v
			elif m.online and m.online.outros.has(v.dono):
				sentados[str(v.dono)] = v
	# o herói no veículo: sentado no banco do carrinho ou do barco (sentar.gd), de pé no leme do navio
	if meu_k != "":
		var dy := 0.0
		var atras := 0.0
		if meu_k == "carrinho": # o quadril vai no banco (sentar.gd); o corpo fica em cima do assoalho
			dy = 0.15
			atras = CARRO_BANCO.z
		elif meu_k == "barquinho": # no banco do meio
			dy = 0.12
			atras = BARCO_BANCO.z
		else: # no convés, na frente do castelo de popa (o leme)
			dy = 0.33
			atras = -2.3
		m.heroi.position.y = (float(m.terreno.agua.nivel) if meu_k != "carrinho" else m.heroi.position.y) + dy
		if atras != 0.0:
			m.heroi.position.x += sin(m.mov.ry) * atras
			m.heroi.position.z += cos(m.mov.ry) * atras
	_poses_sentado(sentados)
	# pack nas costas: o meu e o dos outros jogadores
	_costas("eu", m.heroi, m.P.prog.get("pack"), m.heroi_esq if "heroi_esq" in m else null)
	if m.online:
		for id in m.online.outros:
			var o: Dictionary = m.online.outros[id]
			_costas(str(id), o.no, o.get("pack_k"), o.get("esq"))
	# botões e painel (4 vezes por segundo, é barato)
	_busca -= dt
	if _busca <= 0.0:
		_busca = 0.25
		_botao_estado = _estado_botao()
		m.hud.mostrar_botao("veiculo", _botao_estado != "" and m.h.morto <= 0.0)
		m.hud.icone_botao("veiculo", "it_" + (meu_k if _botao_estado == "descer" else _botao_estado) if _botao_estado != "" else "it_carrinho")
		_perto_g = ""
		if not m.P.prog.get("pack") is Dictionary and meu_k == "":
			var dm: float = float(PR.get("pegar", 2.5))
			for g in chao:
				var d := Vector2(chao[g].x - hp.x, chao[g].z - hp.z).length()
				if d < dm:
					dm = d
					_perto_g = g
		m.hud.mostrar_botao("pegar_pack", _perto_g != "")
		_atualizar_painel()

# motor do carrinho (André 2026-11-09: "tremor quando liga e barulho de motor de tratorzinho"): ligado enquanto
# alguém dirige. Ao ligar toca a partida (manivela, falha, pega) e o tremor vem forte; depois a marcha lenta em laço,
# com o tom e o tremor subindo com a velocidade, e baforadas de fumaça na chaminé a cada batida. Som 3D no carrinho
# (o dos outros jogadores também se ouve, mais baixo longe). Sons: ferramentas/sons/motor.py.
const MOTOR_BATIDAS := 8.5 # batidas por segundo na marcha lenta (o mesmo do som)
var _motor_laco: AudioStream
func _motor(v: Dictionary, no: Node3D, corpo: Node3D, dt: float) -> void:
	var ligado: bool = v.dirigindo and not v.quebrado
	var anda: float = absf(float(m.mov.veiculo.get("v", 0.0))) if v.eu and m.mov.veiculo.get("k", "") == "carrinho" else float(v.get("vel", 0.0))
	var rapido: float = clampf(anda / float(V.carrinho.vel), 0.0, 1.0)
	var som: AudioStreamPlayer3D = v.get("som")
	if ligado and som == null:
		if _motor_laco == null and ResourceLoader.exists("res://sons/motor_lento.ogg"):
			_motor_laco = (load("res://sons/motor_lento.ogg") as AudioStream).duplicate()
			if "loop" in _motor_laco:
				_motor_laco.set("loop", true)
		som = AudioStreamPlayer3D.new()
		som.unit_size = 5.0
		som.max_distance = 32.0
		som.position = Vector3(0, 0.9, 0.7)
		no.add_child(som)
		v.som = som
		v.liga_t = 0.0
		if ResourceLoader.exists("res://sons/motor_partida.ogg"):
			som.stream = load("res://sons/motor_partida.ogg")
			som.volume_db = -4.0 + m.sons.volume_geral
			som.play()
	elif not ligado and som != null:
		var tw := create_tween()
		tw.tween_property(som, "volume_db", som.volume_db - 30.0, 0.35)
		tw.tween_callback(som.queue_free)
		v.erase("som")
		som = null
	var tremor := 0.0
	if som != null:
		v.liga_t = float(v.get("liga_t", 0.0)) + dt
		if som.stream != _motor_laco and (not som.playing or float(v.liga_t) > 2.2) and _motor_laco:
			som.stream = _motor_laco
			som.play()
		som.pitch_scale = lerpf(som.pitch_scale, 1.0 + rapido * 0.55, minf(1.0, dt * 3.0))
		som.volume_db = lerpf(som.volume_db, -6.0 + rapido * 3.0 + m.sons.volume_geral, minf(1.0, dt * 4.0))
		# tremor: forte na partida (falha e pega), depois a batida do cilindro sacudindo o trator inteiro
		var partida: float = clampf(1.0 - (float(v.liga_t) - 0.6) / 0.9, 0.0, 1.0) if float(v.liga_t) > 0.5 else 0.3
		tremor = 1.0 + partida * 2.0 + rapido * 0.4
		var f: float = MOTOR_BATIDAS * som.pitch_scale
		var bate: float = pow(maxf(0.0, sin(m.tempo * TAU * f)), 6.0) # um tranco por batida
		corpo.position.y = bate * 0.012 * tremor
		corpo.rotation.z = (sin(m.tempo * TAU * f * 0.5) * 0.004 + bate * 0.003) * tremor
		corpo.rotation.x = -bate * 0.004 * tremor
		# baforada na chaminé (a cada 2 batidas, menos longe da câmera)
		v.fuma_t = float(v.get("fuma_t", 0.0)) - dt
		var cano: Node3D = corpo.get_node_or_null("cano")
		if cano and float(v.fuma_t) <= 0.0 and m.fx and m.fx.has_method("part"):
			v.fuma_t = 2.0 / f
			var p: Vector3 = cano.global_position
			m.fx.part(m.fx.FUMA, p.x, p.y, p.z, randf_range(-0.15, 0.15), randf_range(0.6, 1.0), randf_range(-0.15, 0.15),
				randf_range(0.8, 1.3), 0.12, 0.45 + partida * 0.3, "8a857e", "4a4642", 0.45, 0.4, 1.2)
	if som == null:
		corpo.position.y = 0.0
		corpo.rotation.z = 0.18 if v.quebrado else 0.0
		corpo.rotation.x = -0.08 if v.quebrado else 0.0

# rodas girando pelo chão andado, as da frente e o volante virando com a curva
func _rodas_volante(v: Dictionary, no: Node3D, corpo: Node3D, dt: float) -> void:
	var anda: float = float(m.mov.veiculo.get("v", 0.0)) if v.eu and m.mov.veiculo.get("k", "") == "carrinho" else float(v.get("vel", 0.0))
	var vira: float = clampf(float(v.get("giro", 0.0)) / 2.4, -1.0, 1.0) # 2,4 rad/s = volante todo virado
	v.volante = lerpf(float(v.get("volante", 0.0)), vira, minf(1.0, dt * 8.0))
	for piv in no.get_meta("rodas", []):
		if piv.get_meta("frente", false):
			piv.rotation.y = float(v.volante) * 0.45
		var r: Node3D = piv.get_node_or_null("roda")
		if r:
			r.rotation.x += anda * dt / float(r.get_meta("r", 0.42))
	var aro: Node3D = corpo.get_node_or_null("volante/aro")
	if aro:
		aro.rotation.y = -float(v.volante) * 1.6
	# carreta articulada: o eixo dela é puxado pelo engate (como reboque de verdade), então ela fecha a curva por dentro
	var car: Node3D = no.get_node_or_null("carreta")
	if car:
		var L: float = float(no.get_meta("carreta_eixo", 1.0))
		var H: Vector3 = no.global_transform * CARRO_ENGATE
		var frente := Vector3(sin(no.rotation.y), 0, cos(no.rotation.y))
		var A: Vector3 = v.get("eixo", H - frente * L)
		var d := Vector3(H.x - A.x, 0, H.z - A.z)
		if d.length() > L * 3.0 or d.length() < 0.001: # chegou agora ou pulou de lugar: carreta reta atrás
			d = frente * L
		d = d.normalized()
		v.eixo = H - d * L
		var rel: float = clampf(angle_difference(no.rotation.y, atan2(d.x, d.z)), -1.3, 1.3)
		car.rotation.y = rel
		v.eixo = H - Vector3(sin(no.rotation.y + rel), 0, cos(no.rotation.y + rel)) * L
		car.rotation.z = -0.1 if v.quebrado else 0.0

# remada do barquinho (pá de um lado, depois do outro, como canoa): o remo e as duas mãos do herói.
# Puxada (65%): a pá entra na frente e sai atrás; volta (35%): levanta, passa por cima da proa e entra do outro lado.
# Parado: o remo atravessado no colo.
func _remar(v: Dictionary, corpo: Node3D, dt: float) -> void:
	var remo: Node3D = corpo.get_node_or_null("remo")
	if remo == null:
		return
	var anda: float = absf(float(m.mov.veiculo.get("v", 0.0))) if v.eu and m.mov.veiculo.get("k", "") == "barquinho" else float(v.get("vel", 0.0))
	v.rema = move_toward(float(v.get("rema", 0.0)), 1.0 if anda > 0.25 and v.dirigindo else 0.0, dt * 2.5)
	var lado: float = float(v.get("lado", 1.0))
	var fase: float = float(v.get("fase", 0.0))
	if float(v.rema) > 0.05:
		fase += dt * (0.5 + 0.55 * minf(1.0, anda / float(V.barquinho.vel)))
		if fase >= 1.0:
			fase -= 1.0
			lado = -lado
	v.fase = fase
	v.lado = lado
	var b := Vector3.ZERO # para onde vai a pá (saindo das mãos)
	var zp := 0.0
	var troca := 0.0 # 0 = mãos no lado de agora, 1 = já no papel do outro lado
	if fase < 0.65:
		var k := fase / 0.65
		b = Vector3(lado * 0.3, -0.95, lerpf(0.3, -0.25, k))
		zp = lerpf(0.3, -0.05, k)
	else:
		var r := (fase - 0.65) / 0.35
		zp = lerpf(-0.05, 0.3, r)
		if r < 0.3:
			var e := lerpf(-1.25, 0.15, r / 0.3)
			b = Vector3(lado * cos(e), sin(e), lerpf(-0.25, 0.0, r / 0.3))
		elif r < 0.7:
			var s2 := (r - 0.3) / 0.4
			b = Vector3(lado * cos(PI * s2), 0.15, sin(PI * s2))
			troca = smoothstep(0.0, 1.0, s2)
		else:
			var e2 := lerpf(0.15, -1.25, (r - 0.7) / 0.3)
			b = Vector3(-lado * cos(e2), sin(e2), lerpf(0.0, 0.3, (r - 0.7) / 0.3))
			troca = 1.0
	b = b.normalized()
	# as mãos vão para a amurada do lado da pá (o cabo passa por fora do casco); com o remo deitado voltam para o meio
	var piv := Vector3(0.45 * b.x / maxf(0.3, absf(b.x)) * clampf(-b.y * 1.1, 0.0, 1.0), 0.62, zp)
	# parado: atravessado no colo
	var w: float = smoothstep(0.0, 1.0, float(v.rema))
	var b_parado := Vector3(1, 0, 0)
	var piv_parado := Vector3(0, 0.5, 0.16)
	b = b_parado.lerp(b, w).normalized()
	piv = piv_parado.lerp(piv, w)
	var yb := -b
	var zb := Vector3(0, 0, 1) - yb * yb.z
	if zb.length() < 0.2:
		zb = Vector3.UP - yb * yb.y
	zb = zb.normalized()
	remo.transform = Transform3D(Basis(yb.cross(zb), yb, zb), piv)
	# mãos: a de baixo (do lado da pá) perto da pá, a de cima no punho; na troca de lado as duas mudam de papel
	var de_baixo := piv + b * 0.17
	var de_cima := piv - b * 0.3
	var maos := [Vector3.ZERO, Vector3.ZERO] # [lado +x, lado -x] do barco
	for i in 2:
		var sx: float = 1.0 if i == 0 else -1.0
		var antes: Vector3 = de_baixo if sx == lado else de_cima
		var depois: Vector3 = de_baixo if sx == -lado else de_cima
		var remando: Vector3 = antes.lerp(depois, troca)
		var parado := piv_parado + Vector3(sx * 0.24, 0, 0)
		maos[i] = parado.lerp(remando, w)
	v.maos = maos
	v.deita = 0.06 + w * (0.22 if fase < 0.65 else 0.1) * (1.0 - fase / 0.65 if fase < 0.65 else 0.5)
	v.torce = w * clampf(piv.x / 0.45, -1.0, 1.0) * -0.3

# poses de sentado (sentar.gd) no esqueleto de quem está no carrinho ou no barco; tira de quem desceu
const Sentar = preload("res://sentar.gd")
var poses := {} # id -> {pose, esq}
func _poses_sentado(sentados: Dictionary) -> void:
	for id in poses.keys():
		var p: Dictionary = poses[id]
		if not sentados.has(id) or not is_instance_valid(p.esq) or p.esq != _esq_de(id):
			if is_instance_valid(p.pose):
				p.pose.queue_free()
			poses.erase(id)
			if id == "eu":
				m.armar(m.h.modo) # as armas voltam do jeito do modo
	for id in sentados:
		var esq = _esq_de(id)
		if not (esq is Skeleton3D) or not is_instance_valid(esq):
			continue
		if not poses.has(id):
			var pose = Sentar.new()
			esq.add_child(pose)
			# depois do inclinar.gd e do braço da espada, antes das molas do cabelo e da saia (como o cavalgar.gd)
			var antes: int = esq.get_child_count() - 1
			for i in esq.get_child_count():
				if esq.get_child(i) is SpringBoneSimulator3D:
					antes = i
					break
			esq.move_child(pose, antes)
			pose.preparar(esq)
			poses[id] = {"pose": pose, "esq": esq}
			if id == "eu":
				m.armar(m.h.modo) # sentado: as duas armas nas costas, mãos no volante ou no remo
		_alvos_sentado(poses[id].pose, sentados[id])

func _esq_de(id: String):
	if id == "eu":
		return m.heroi_esq
	if m.online and m.online.outros.has(id):
		return m.online.outros[id].get("esq")
	return null

func _alvos_sentado(pose, v: Dictionary) -> void:
	var corpo: Node3D = v.no.get_node_or_null("corpo")
	if corpo == null:
		return
	var T: Transform3D = corpo.global_transform
	pose.frente_lobo = T.basis.z.normalized()
	pose.lado_lobo = T.basis.x.normalized()
	pose.cima_lobo = T.basis.y.normalized()
	if v.tipo == "c":
		pose.sela = T * CARRO_BANCO
		for i in 2:
			var sx: float = 1.0 if i == 0 else -1.0
			pose.pe[i] = T * Vector3(sx * CARRO_PE.x, CARRO_PE.y, CARRO_PE.z)
			# mãos no aro, nas "nove e quinze", girando com o volante
			var na_roda := Basis(Vector3.UP, -float(v.get("volante", 0.0)) * 1.6) * Vector3(sx * 0.17, 0.025, 0.0)
			pose.pegada[i] = T * (CARRO_VOLANTE + Basis(Vector3.RIGHT, CARRO_VOLANTE_INCL) * na_roda)
		pose.deita = 0.1
		pose.torce = 0.0
	else:
		pose.sela = T * BARCO_BANCO
		for i in 2:
			var sx2: float = 1.0 if i == 0 else -1.0
			pose.pe[i] = T * Vector3(sx2 * BARCO_PE.x, BARCO_PE.y, BARCO_PE.z)
			var maos: Array = v.get("maos", [Vector3(0.24, 0.5, 0.16), Vector3(-0.24, 0.5, 0.16)])
			pose.pegada[i] = T * maos[i]
		pose.deita = float(v.get("deita", 0.06))
		pose.torce = float(v.get("torce", 0.0))

func _costas(id: String, corpo: Node3D, pk, esq) -> void:
	var k := ""
	if pk is Dictionary:
		k = str(pk.get("k", ""))
	elif pk is String:
		k = pk
	var no: Node3D = costas.get(id)
	if k == "" or not PK.has(k) or corpo == null or not is_instance_valid(corpo) or not corpo.visible:
		if no:
			no.visible = false
		return
	if no == null or no.get_meta("k", "") != k:
		if no:
			no.queue_free()
		no = modelo_pack(k)
		no.set_meta("k", k)
		no.scale = Vector3.ONE * 0.95
		m.add_child(no)
		costas[id] = no
	no.visible = true
	var ry: float = corpo.rotation.y
	var alto := 0.62
	var atras := 0.36
	if id == "eu" and m.mov.veiculo.get("k", "") == "carrinho":
		alto = 0.36
		atras = 0.3
	# o fundo do caixote fica um palmo abaixo do peito (Quimera: nas costas, com as alças)
	var base := corpo.position + Vector3(0, alto + 0.33, 0)
	if esq is Skeleton3D and is_instance_valid(esq): # preso no peito de cima do esqueleto: acompanha o corpo correndo e agachado
		var i: int = (esq as Skeleton3D).find_bone("J_Bip_C_UpperChest")
		if i >= 0:
			base = (esq as Skeleton3D).global_transform * (esq as Skeleton3D).get_bone_global_pose(i).origin - Vector3(0, 0.38, 0)
	no.position = base + Vector3(-sin(ry) * atras, 0, -cos(ry) * atras)
	no.rotation.y = ry

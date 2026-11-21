extends Node
const Idioma = preload("res://idioma.gd") # inglês (idioma.gd): texto montado também sai traduzido
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
	var wt: Image = preload("res://imagem_cpu.gd").ler(load("res://construcao3d/T_WoodTrim_BaseColor.png")) # pelo arquivo, não pela placa
	if wt.is_compressed():
		wt.decompress()
	var veio := ImageTexture.create_from_image(wt.get_region(Rect2i(0, 8, wt.get_width(), int(wt.get_height() * 0.2))))
	var wn: Image = preload("res://imagem_cpu.gd").ler(load("res://construcao3d/T_WoodTrim_Normal.png")) # pelo arquivo, não pela placa
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
const BARCO_AFUNDA := -0.1 # o "corpo" do barco em relação à linha d'água (quilha ~25 cm embaixo)
const REMO_PINO := Vector3(0.55, 0.47, 0.14) # tolete (x = cada lado), no "corpo"
const REMO_DENTRO := 0.4 # do tolete ao punho
const REMO_FORA := 1.55 # do tolete à ponta da pá

# tampa invisível no casco, na linha d'água: escreve só a profundidade antes da água (render_priority menor), então a
# água não aparece dentro do barco afundado. Fica um dedo para dentro do casco (senão abria um buraco na água de fora).
var _mt_seco: ShaderMaterial
func _tampa_seca(corpo: Node3D) -> void:
	if _mt_seco == null:
		var sh := Shader.new()
		sh.code = "shader_type spatial;\nrender_mode unshaded, depth_draw_always, cull_disabled, shadows_disabled;\nvoid fragment() { ALBEDO = vec3(0.0); ALPHA = 0.0; }\n"
		_mt_seco = ShaderMaterial.new()
		_mt_seco.shader = sh
		_mt_seco.render_priority = -2
	# 2026-11-13 (André: "às vezes a textura da água tá sobrepondo o fundo do barco quando eu tô remando"): com 3 cm a
	# popa afundava a tampa quando a proa sobe na remada e o casco deita na curva (até ~10 cm). Agora 14 cm acima da
	# água, ainda bem abaixo da amurada (30 cm) e do banco.
	var yw := -BARCO_AFUNDA + 0.14
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var n := 24
	var meio: Array = [] # [z, meia largura] onde o casco corta a altura yw
	for i in n + 1:
		var z: float = -BARCO_L + 2.0 * BARCO_L * float(i) / float(n)
		var sc: Array = _barco_secao(z)
		var k: float = (yw - float(sc[2])) / maxf(0.001, float(sc[1]) - float(sc[2]))
		if k <= 0.0:
			continue
		var w: float = float(sc[0]) * sin(acos(clampf(1.0 - k, -1.0, 1.0))) - 0.015
		if w > 0.0:
			meio.append([z, w])
	for i in meio.size() - 1:
		var a: Array = meio[i]
		var b: Array = meio[i + 1]
		for v in [Vector3(-a[1], yw, a[0]), Vector3(a[1], yw, a[0]), Vector3(b[1], yw, b[0]), Vector3(-a[1], yw, a[0]), Vector3(b[1], yw, b[0]), Vector3(-b[1], yw, b[0])]:
			st.add_vertex(v)
	var mi := MeshInstance3D.new()
	mi.name = "seco"
	mi.mesh = st.commit()
	mi.material_override = _mt_seco
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	corpo.add_child(mi)
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
	# 2026-11-09 (André: "parece que o barco tá voando na água"): o casco fica afundado ~25 cm (antes a quilha mal
	# encostava). A água de dentro some com a tampa invisível "seco" na linha d'água (_tampa_seca).
	corpo.position.y = BARCO_AFUNDA
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
	# 2026-11-09 (André: "a remada não tá legal"): no lugar do remo de pá de canoa (trocava de lado por cima da proa a
	# cada remada), dois remos de verdade nos toletes da amurada, remando de frente (empurrando, como os pescadores):
	# as duas pás entram juntas, empurram a água para trás e voltam por cima, deitadas. transporte.gd _remar move.
	for lado in [-1.0, 1.0]:
		var pino := Vector3(lado * REMO_PINO.x, REMO_PINO.y, REMO_PINO.z)
		_cil(corpo, 0.016, 0.12, pino + Vector3(0, -0.02, 0.035), _mt_ferro, Vector3.ZERO, 6) # tolete (dois pinos)
		_cil(corpo, 0.016, 0.12, pino + Vector3(0, -0.02, -0.035), _mt_ferro, Vector3.ZERO, 6)
		_caixa(corpo, Vector3(0.09, 0.04, 0.16), pino + Vector3(0, -0.07, 0), _mt_madeira_esc) # calço do tolete
		var remo := Node3D.new()
		remo.name = "remo_d" if lado > 0 else "remo_e"
		remo.position = pino
		corpo.add_child(remo)
		# o remo deitado no eixo local +X (para fora), origem no tolete: punho para dentro, pá para fora
		var ext := REMO_FORA + 0.08
		_cil(remo, 0.022, REMO_DENTRO + ext, Vector3((ext - REMO_DENTRO) * 0.5 * lado, 0, 0), _mt_madeira_esc, Vector3(0, 0, PI / 2), 8)
		_cil(remo, 0.026, 0.14, Vector3(-(REMO_DENTRO - 0.02) * lado, 0, 0), _mt_corda, Vector3(0, 0, PI / 2), 8) # punho
		_cil(remo, 0.03, 0.05, Vector3(0.0, 0, 0), _mt_corda, Vector3(0, 0, PI / 2), 8) # couro onde roça no tolete
		var pa := _caixa(remo, Vector3(0.46, 0.022, 0.15), Vector3((REMO_FORA - 0.12) * lado, 0, 0), _mt_madeira)
		pa.name = "pa"
	_tampa_seca(corpo)
	_sombra(g)
	return g

# ---------- navio mercante (André 2026-11-21: "eu queria que ele ficasse próximo disso aí"): escuna de dois mastros,
# modelo nosso no estilo das fotos de referência. Casco curvo de tábuas feito aqui (seção por seção, como o barquinho),
# faixa de tábuas pintadas de azul embaixo da borda, amurada com balaústres e corrimão, convés de tábuas, gurupés com
# bujarrona, duas velas latinas de carangueja (retangulares com a ponta de cima inclinada, verga em cima e retranca
# embaixo) de lona clara com costuras, cordame, leme de roda na popa, enfeites dourados na proa (volutas e o medalhão da
# rosa dos ventos) e o lampião da popa. Os packs do porão aparecem empilhados no convés entre os mastros.
# Medidas no "corpo": a água fica em y = NAV_AGUA (o nó fica 0,25 m abaixo do nível, como antes); proa em +z.
const NAV_L := 6.4 # meio comprimento (proa em +L, espelho de popa em -L)
const NAV_W := 1.8 # meia boca no meio
const NAV_AGUA := 0.25 # linha d'água no "corpo"
const NAV_CONVES := 1.15 # o piso do convés no "corpo"
const NAV_MASTRO_F := 2.8 # z do mastro de vante
const NAV_MASTRO_R := -1.0 # z do mastro grande
const NAV_LEME := Vector3(0, 0, -4.6) # roda do leme (o herói pilota atrás dela)
var _mt_azul: StandardMaterial3D
var _mt_ouro: StandardMaterial3D
var _mt_cabo: StandardMaterial3D
var _mt_vela: StandardMaterial3D
var _mt_conves: StandardMaterial3D
var _mt_tabua: StandardMaterial3D
var _mt_tabua_esc: StandardMaterial3D
var _mt_vidro: StandardMaterial3D
var _mt_marinho: StandardMaterial3D
var _mt_mastro: StandardMaterial3D

func _materiais_navio() -> void:
	if _mt_azul != null:
		return
	# tábuas do casco e do convés: o veio da madeira (o mesmo das casas) cortado em tábuas de 22 cm, cada uma com o seu
	# tom, a junta escura entre elas e uma emenda de topo em lugar diferente (feito uma vez aqui, 256 x 128)
	var src: Image = (_mt_madeira.albedo_texture as ImageTexture).get_image()
	if src.is_compressed():
		src.decompress()
	var W := 256
	var H := 128
	var tab := Image.create(W, H, false, Image.FORMAT_RGB8)
	var rnd := RandomNumberGenerator.new()
	rnd.seed = 23
	var sw := src.get_width()
	var sh := src.get_height()
	for k in 4:
		var tom: float = rnd.randf_range(0.82, 1.08)
		var off: int = rnd.randi_range(0, sw - 1)
		var emenda: int = rnd.randi_range(20, W - 20)
		for y in 32:
			var sy: int = clampi(int(float(y) / 32.0 * float(sh - 1)), 0, sh - 1)
			for x in W:
				var c := src.get_pixel((x * 4 + off) % sw, sy)
				var f: float = tom
				if y < 1 or y > 30:
					f *= 0.45
				if x == emenda:
					f *= 0.5
				tab.set_pixel(x, k * 32 + y, Color(c.r * f, c.g * f, c.b * f))
	tab.generate_mipmaps()
	var tex_tab := ImageTexture.create_from_image(tab)
	_mt_tabua = StandardMaterial3D.new()
	_mt_tabua.albedo_texture = tex_tab
	_mt_tabua.roughness = 0.85
	_mt_tabua.cull_mode = BaseMaterial3D.CULL_DISABLED
	_mt_tabua_esc = _mt_tabua.duplicate()
	_mt_tabua_esc.albedo_color = Color(0.56, 0.42, 0.33)
	_mt_conves = _mt_tabua.duplicate()
	_mt_conves.albedo_color = Color(1.0, 0.93, 0.82)
	# tábuas pintadas de azul: a tinta gasta deixa o veio aparecer
	var az := Image.create(W, H, false, Image.FORMAT_RGB8)
	for y in H:
		for x in W:
			var c := tab.get_pixel(x, y)
			var l: float = clampf(c.r * 0.3 + c.g * 0.59 + c.b * 0.11, 0.0, 1.0)
			var v: float = 0.5 + l * 0.75
			az.set_pixel(x, y, Color(0.4 * v, 0.6 * v, 0.7 * v))
	az.generate_mipmaps()
	_mt_azul = _mt_tabua.duplicate()
	_mt_azul.albedo_texture = ImageTexture.create_from_image(az)
	_mt_azul.roughness = 0.75
	_mt_ouro = StandardMaterial3D.new()
	_mt_ouro.albedo_color = Color(0.93, 0.68, 0.24)
	_mt_ouro.metallic = 0.9
	_mt_ouro.roughness = 0.32
	_mt_marinho = StandardMaterial3D.new()
	_mt_marinho.albedo_color = Color(0.1, 0.17, 0.3)
	_mt_marinho.roughness = 0.5
	_mt_cabo = StandardMaterial3D.new()
	_mt_cabo.albedo_color = Color(0.16, 0.13, 0.1)
	_mt_cabo.roughness = 0.9
	_mt_vidro = StandardMaterial3D.new()
	_mt_vidro.albedo_color = Color(1.0, 0.78, 0.4)
	_mt_vidro.emission_enabled = true
	_mt_vidro.emission = Color(1.0, 0.66, 0.28)
	_mt_vidro.emission_energy_multiplier = 0.9
	_mt_mastro = StandardMaterial3D.new() # mastros e paus lisos (o veio triplanar listrava os cilindros)
	_mt_mastro.albedo_color = Color(0.4, 0.27, 0.17)
	_mt_mastro.roughness = 0.75
	# lona da vela: a trama do pano mais as costuras dos panos (faixas paralelas à valuma) e o reforço da borda
	var n := 128
	var img := Image.create(n, n, false, Image.FORMAT_RGB8)
	rnd.seed = 91
	for y in n:
		var fio: float = rnd.randf_range(-0.025, 0.025)
		for x in n:
			var cima: bool = ((x / 2) + (y / 2)) % 2 == 0
			var v: float = 0.95 + fio + rnd.randf_range(-0.025, 0.025) - (0.03 if cima else 0.0)
			var costura: float = 1.0 - 0.16 * clampf(1.0 - absf(float(x % 16) - 1.0) / 1.2, 0.0, 1.0)
			var borda: float = 0.86 if x < 2 or x > n - 3 or y < 2 or y > n - 3 else 1.0
			v *= costura * borda
			img.set_pixel(x, y, Color(0.7 * v, 0.66 * v, 0.56 * v))
	img.generate_mipmaps()
	_mt_vela = StandardMaterial3D.new()
	_mt_vela.albedo_texture = ImageTexture.create_from_image(img)
	_mt_vela.roughness = 0.95
	_mt_vela.cull_mode = BaseMaterial3D.CULL_DISABLED

# seção do casco em z: [meia largura, altura da borda, altura da quilha]
func _nav_secao(z: float) -> Array:
	var u: float = clampf(z / NAV_L, -1.0, 1.0)
	var w: float
	if u >= 0.0: # proa fina
		w = NAV_W * pow(maxf(0.0, 1.0 - pow(u, 2.1)), 0.55)
	else: # popa cheia, fecha no espelho
		w = NAV_W * (1.0 - 0.4 * pow(-u, 2.4))
	var borda: float = NAV_CONVES + 0.34 + 0.42 * pow(maxf(u, 0.0), 2.0) + 0.16 * pow(maxf(-u, 0.0), 2.0)
	var quilha: float = -0.8 + 1.15 * pow(maxf(u, 0.0), 3.0) + 0.6 * pow(maxf(-u, 0.0), 3.0)
	return [maxf(w, 0.01), borda, quilha]

func _nav_ponto(z: float, t: float, fora := 0.0) -> Vector3: # t: -1 (borda esq) .. 0 (quilha) .. 1 (borda dir)
	var sc: Array = _nav_secao(z)
	var f: float = t * PI * 0.5
	var s: float = sin(f)
	var p := Vector3(float(sc[0]) * signf(s) * pow(absf(s), 0.7), float(sc[2]) + (float(sc[1]) - float(sc[2])) * (1.0 - cos(f)), z)
	if fora != 0.0:
		p += Vector3(signf(s), -cos(f) * 0.6, 0).normalized() * fora
	return p

# meia largura do convés (por dentro do casco) na altura y
func _nav_largura(z: float, y: float) -> float:
	var sc: Array = _nav_secao(z)
	var k: float = clampf((y - float(sc[2])) / maxf(0.001, float(sc[1]) - float(sc[2])), 0.0, 1.0)
	return float(sc[0]) * pow(sin(acos(1.0 - k)), 0.7)

func _nav_malha(t0: float, t1: float, fora: float, nt: int, nz: int, mt: Material) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for iz in nz:
		var za: float = -NAV_L + 2.0 * NAV_L * float(iz) / float(nz)
		var zb: float = -NAV_L + 2.0 * NAV_L * float(iz + 1) / float(nz)
		for it in nt:
			var ta: float = lerpf(t0, t1, float(it) / float(nt))
			var tb: float = lerpf(t0, t1, float(it + 1) / float(nt))
			var a := _nav_ponto(za, ta, fora)
			var b := _nav_ponto(za, tb, fora)
			var c := _nav_ponto(zb, tb, fora)
			var d := _nav_ponto(zb, ta, fora)
			var uv := {a: Vector2(za / 4.0, ta * 2.6), b: Vector2(za / 4.0, tb * 2.6), c: Vector2(zb / 4.0, tb * 2.6), d: Vector2(zb / 4.0, ta * 2.6)}
			for v in [a, c, b, a, d, c]:
				st.set_uv(uv[v])
				st.add_vertex(v)
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mt
	return mi

# um pau (mastro, verga, cabo) de a até b, mais fino em b
func _pau(pai: Node3D, a: Vector3, b: Vector3, r0: float, r1: float, mt: Material, lados := 8) -> MeshInstance3D:
	var c := CylinderMesh.new()
	c.bottom_radius = r0
	c.top_radius = r1
	c.height = a.distance_to(b)
	c.radial_segments = lados
	c.rings = 1
	var mi := MeshInstance3D.new()
	mi.mesh = c
	mi.material_override = mt
	var y := (b - a).normalized()
	var x := y.cross(Vector3.FORWARD if absf(y.dot(Vector3.FORWARD)) < 0.9 else Vector3.RIGHT).normalized()
	mi.transform = Transform3D(Basis(x, y, x.cross(y)), (a + b) * 0.5)
	pai.add_child(mi)
	return mi

# vela de pano: quadrilátero A (punho da amura, embaixo no mastro), B (boca, em cima no mastro), C (pique), D (punho
# da escota), com barriga (o vento enche o meio do pano para o lado "lado")
func _vela_pano(pai: Node3D, A: Vector3, B: Vector3, C: Vector3, D: Vector3, barriga: float, lado: Vector3) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var n := 10
	var pts := []
	for i in n + 1:
		var u: float = float(i) / float(n) # do mastro (0) para a valuma (1)
		var lin := []
		for j in n + 1:
			var v: float = float(j) / float(n) # de baixo (0) para cima (1)
			var p: Vector3 = (A.lerp(D, u)).lerp(B.lerp(C, u), v)
			p += lado * barriga * sin(PI * u) * sin(PI * minf(1.0, v * 1.1 + 0.05)) * (1.0 - u * 0.35)
			lin.append(p)
		pts.append(lin)
	for i in n:
		for j in n:
			var q := [[i, j], [i + 1, j], [i + 1, j + 1], [i, j], [i + 1, j + 1], [i, j + 1]]
			for e in q:
				st.set_uv(Vector2(float(e[0]) / float(n), 1.0 - float(e[1]) / float(n)))
				st.add_vertex(pts[e[0]][e[1]])
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = _mt_vela
	pai.add_child(mi)
	return mi

# mastro com a vela de carangueja: z do mastro, altura da boca, do pique e do topo, comprimento da retranca. A vela, a
# retranca e a carangueja giram juntas um pouco para o lado (o vento enche de lado, como no mar de verdade).
func _mastro_vela(corpo: Node3D, zm: float, boca: float, pique: float, topo: float, retranca: float, giro: float) -> void:
	var D := NAV_CONVES
	_pau(corpo, Vector3(0, D - 0.4, zm), Vector3(0, D + boca + 0.4, zm), 0.15, 0.11, _mt_mastro, 12)
	_pau(corpo, Vector3(0, D + boca + 0.2, zm), Vector3(0, D + topo, zm), 0.08, 0.05, _mt_mastro, 10) # mastaréu
	_caixa(corpo, Vector3(0.36, 0.3, 0.36), Vector3(0, D + boca + 0.3, zm), _mt_madeira) # pega do mastaréu
	_caixa(corpo, Vector3(1.6, 0.07, 0.12), Vector3(0, D + boca + 0.05, zm), _mt_mastro) # vaus (onde as enxárcias abrem)
	_cil(corpo, 0.07, 0.12, Vector3(0, D + topo + 0.04, zm), _mt_ouro, Vector3.ZERO, 10) # pomo dourado no topo
	_cil(corpo, 0.22, 0.25, Vector3(0, D + 0.12, zm), _mt_mastro, Vector3.ZERO, 12) # calço no convés
	var rig := Node3D.new()
	rig.position = Vector3(0, 0, zm)
	rig.rotation.y = giro
	corpo.add_child(rig)
	var r := 0.16
	var A := Vector3(0, D + 2.05, -r)
	var B := Vector3(0, D + boca, -r)
	var C := Vector3(0, D + pique, -retranca + 0.2)
	var Dc := Vector3(0, D + 2.2, -retranca)
	_pau(rig, Vector3(0, D + 2.0, -0.12), Vector3(0, D + 2.15, -retranca - 0.3), 0.075, 0.06, _mt_mastro) # retranca
	_pau(rig, Vector3(0, D + boca - 0.05, -0.12), C + (C - B).normalized() * 0.3, 0.065, 0.045, _mt_mastro) # carangueja
	_vela_pano(rig, A, B, C, Dc, 0.55, Vector3(signf(giro), 0, 0) * -1.0)
	# argolas da vela no mastro e as amarras no pau de cima e de baixo (os pontinhos escuros da referência)
	for i in 7:
		var y: float = lerpf(D + 2.25, D + boca - 0.15, float(i) / 6.0)
		_cil(rig, 0.18, 0.05, Vector3(0, y, 0), _mt_cabo, Vector3.ZERO, 10)
	for i in 6:
		var u: float = (float(i) + 0.5) / 6.0
		_caixa(rig, Vector3(0.1, 0.1, 0.06), B.lerp(C, u) + Vector3(0, 0.05, 0), _mt_cabo)
		_caixa(rig, Vector3(0.11, 0.1, 0.06), A.lerp(Dc, u) + Vector3(0, -0.03, 0), _mt_cabo)
	# adriças: do topo do mastro até a carangueja; escota: da ponta da retranca até o convés
	_pau(rig, Vector3(0, D + topo - 0.3, 0.05), B.lerp(C, 0.45) + Vector3(0, 0.05, 0), 0.012, 0.012, _mt_cabo, 4)
	_pau(rig, Vector3(0, D + topo - 0.6, 0.05), B.lerp(C, 0.85) + Vector3(0, 0.05, 0), 0.012, 0.012, _mt_cabo, 4)
	_pau(rig, Dc + Vector3(0, -0.05, -0.1), Vector3(0, D + 0.05, -retranca + 0.4), 0.014, 0.014, _mt_cabo, 4)
	_juntar(rig)

func modelo_navio() -> Node3D:
	_materiais_navio()
	var g := Node3D.new()
	var corpo := Node3D.new()
	corpo.name = "corpo"
	g.add_child(corpo)
	var D := NAV_CONVES
	var casco_mt: StandardMaterial3D = _mt_tabua_esc # fundo escuro; obras mortas (em cima) na madeira mais clara
	var obras_mt: StandardMaterial3D = _mt_tabua
	var esc_dup: StandardMaterial3D = _mt_madeira_esc.duplicate()
	esc_dup.cull_mode = BaseMaterial3D.CULL_DISABLED
	esc_dup.albedo_color = Color(0.42, 0.31, 0.23)
	# casco: fundo escuro, tábuas claras, a faixa azul, cintas escuras e a borda
	corpo.add_child(_nav_malha(-0.74, 0.74, 0.0, 12, 32, casco_mt))
	for lado in [-1.0, 1.0]:
		corpo.add_child(_nav_malha(lado * 0.74, lado * 0.8, 0.0, 1, 32, obras_mt))
		corpo.add_child(_nav_malha(lado * 0.8, lado * 0.93, 0.0, 2, 32, _mt_azul))
		corpo.add_child(_nav_malha(lado * 0.93, lado * 1.0, 0.0, 1, 32, obras_mt))
		corpo.add_child(_nav_malha(lado * 0.775, lado * 0.805, 0.03, 1, 32, esc_dup)) # cinta de baixo
		corpo.add_child(_nav_malha(lado * 0.925, lado * 0.95, 0.03, 1, 32, esc_dup)) # cinta de cima
		corpo.add_child(_nav_malha(lado * 0.86, lado * 1.0, -0.035, 2, 32, _mt_tabua)) # forro da amurada, por dentro
	# espelho de popa: fecha o casco atrás, com a faixa dourada e duas janelinhas acesas
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var ze := -NAV_L
	var centro := Vector3(0, (float(_nav_secao(ze)[1]) + float(_nav_secao(ze)[2])) * 0.5, ze)
	var nt := 16
	for i in nt:
		var a := _nav_ponto(ze, -1.0 + 2.0 * float(i) / float(nt))
		var b := _nav_ponto(ze, -1.0 + 2.0 * float(i + 1) / float(nt))
		for v in [centro, a, b]:
			st.add_vertex(v)
	var topo_e: float = float(_nav_secao(ze)[1])
	var w_e: float = float(_nav_secao(ze)[0])
	for v in [Vector3(-w_e, topo_e, ze), Vector3(w_e, topo_e, ze), centro]:
		st.add_vertex(v)
	st.generate_normals()
	var esp := MeshInstance3D.new()
	esp.mesh = st.commit()
	esp.material_override = esc_dup
	corpo.add_child(esp)
	_caixa(corpo, Vector3(w_e * 2.0 + 0.1, 0.09, 0.08), Vector3(0, topo_e - 0.05, ze - 0.03), _mt_ouro)
	_caixa(corpo, Vector3(w_e * 1.7, 0.06, 0.06), Vector3(0, topo_e - 0.55, ze - 0.03), _mt_ouro)
	for lx in [-0.5, 0.5]:
		_caixa(corpo, Vector3(0.34, 0.26, 0.05), Vector3(lx, topo_e - 0.3, ze - 0.03), _mt_vidro)
		_caixa(corpo, Vector3(0.42, 0.05, 0.07), Vector3(lx, topo_e - 0.15, ze - 0.04), _mt_ouro)
		_caixa(corpo, Vector3(0.42, 0.05, 0.07), Vector3(lx, topo_e - 0.45, ze - 0.04), _mt_ouro)
	# convés: tábuas ao longo do navio (fatias em z com a largura de dentro do casco)
	var sd := SurfaceTool.new()
	sd.begin(Mesh.PRIMITIVE_TRIANGLES)
	var nz := 30
	for i in nz:
		var za: float = -NAV_L + 0.06 + (2.0 * NAV_L - 0.5) * float(i) / float(nz)
		var zb: float = -NAV_L + 0.06 + (2.0 * NAV_L - 0.5) * float(i + 1) / float(nz)
		var wa: float = _nav_largura(za, D) - 0.02
		var wb: float = _nav_largura(zb, D) - 0.02
		for v in [Vector3(-wa, D, za), Vector3(wb, D, zb), Vector3(-wb, D, zb), Vector3(-wa, D, za), Vector3(wa, D, za), Vector3(wb, D, zb)]:
			sd.set_normal(Vector3.UP)
			sd.set_uv(Vector2(v.z / 4.0, v.x / 0.88))
			sd.add_vertex(v)
	var conv := MeshInstance3D.new()
	conv.mesh = sd.commit()
	conv.material_override = _mt_conves
	corpo.add_child(conv)
	# amurada: balaústres e o corrimão em cima da borda, de ponta a ponta; trincaniz (tábua por dentro, no pé)
	var nb := 18
	for lado in [-1.0, 1.0]:
		for i in nb:
			var za: float = -NAV_L + 0.15 + (2.0 * NAV_L - 0.75) * float(i) / float(nb)
			var zb: float = -NAV_L + 0.15 + (2.0 * NAV_L - 0.75) * float(i + 1) / float(nb)
			var a := _nav_ponto(za, lado) + Vector3(-lado * 0.04, 0.48, 0)
			var b := _nav_ponto(zb, lado) + Vector3(-lado * 0.04, 0.48, 0)
			var seg := _caixa(corpo, Vector3(0.1, 0.06, a.distance_to(b) + 0.03), (a + b) * 0.5, _mt_madeira_esc)
			seg.basis = Basis.looking_at(b - a, Vector3.UP)
			var pe := _nav_ponto(za, lado) + Vector3(-lado * 0.04, 0, 0)
			_caixa(corpo, Vector3(0.07, 0.5, 0.07), pe + Vector3(0, 0.24, 0), _mt_madeira_esc)
			var tb := _nav_ponto(za, lado) + Vector3(-lado * 0.05, 0.02, 0) # capa da borda
			var tb2 := _nav_ponto(zb, lado) + Vector3(-lado * 0.05, 0.02, 0)
			var cap := _caixa(corpo, Vector3(0.14, 0.04, tb.distance_to(tb2) + 0.03), (tb + tb2) * 0.5, _mt_madeira)
			cap.basis = Basis.looking_at(tb2 - tb, Vector3.UP)
	# proa: roda de proa, gurupé com a bujarrona, volutas e o medalhão dourados, beque e a âncora
	var proa := _nav_ponto(NAV_L, 1.0)
	var bico := Vector3(0, proa.y + 0.1, NAV_L + 0.1)
	_pau(corpo, Vector3(0, D + 0.4, NAV_L - 1.2), bico + Vector3(0, 0.75, 3.4), 0.12, 0.06, _mt_mastro, 10) # gurupé
	_cil(corpo, 0.07, 0.1, bico + Vector3(0, 0.79, 3.45), _mt_ouro, Vector3(-1.35, 0, 0), 8)
	_pau(corpo, Vector3(0, -0.1, NAV_L - 0.15), bico, 0.11, 0.1, _mt_madeira_esc, 8) # roda de proa
	var pomo := SphereMesh.new()
	pomo.radius = 0.13
	pomo.height = 0.26
	pomo.radial_segments = 12
	pomo.rings = 6
	var pomo_mi := MeshInstance3D.new()
	pomo_mi.mesh = pomo
	pomo_mi.material_override = _mt_ouro
	pomo_mi.position = bico + Vector3(0, 0.08, 0.02)
	corpo.add_child(pomo_mi)
	_pau(corpo, bico + Vector3(0, 0.75, 3.35), Vector3(0, NAV_AGUA + 0.15, NAV_L + 0.25), 0.02, 0.02, _mt_cabo, 4) # cabresto
	for lado in [-1.0, 1.0]:
		# volutas: dois caracóis dourados de cada lado da roda de proa, com a folha de cima
		for k in 2:
			var tor := TorusMesh.new()
			tor.inner_radius = 0.13 - 0.04 * k
			tor.outer_radius = 0.23 - 0.06 * k
			tor.rings = 12
			tor.ring_segments = 6
			var vo := MeshInstance3D.new()
			vo.mesh = tor
			vo.material_override = _mt_ouro
			vo.position = Vector3(lado * (0.16 + 0.04 * k), bico.y - 0.3 - 0.28 * k, NAV_L - 0.02 - 0.12 * k)
			vo.rotation = Vector3(0, 0, PI * 0.5)
			corpo.add_child(vo)
		_pau(corpo, Vector3(lado * 0.14, bico.y - 0.75, NAV_L - 0.3), Vector3(lado * 0.1, bico.y + 0.05, NAV_L + 0.05), 0.05, 0.03, _mt_ouro, 6)
		# medalhão da rosa dos ventos no costado da proa (aro dourado, fundo azul-escuro, estrela de oito pontas)
		var zm: float = NAV_L * 0.62
		var pm := _nav_ponto(zm, lado * 0.9) + Vector3(lado * 0.03, 0.02, 0)
		var giro: float = atan2(_nav_ponto(zm + 0.2, lado * 0.9).x - _nav_ponto(zm - 0.2, lado * 0.9).x, 0.4)
		var med := Node3D.new()
		med.position = pm
		med.rotation = Vector3(0, giro, lado * PI * 0.5)
		corpo.add_child(med)
		_cil(med, 0.36, 0.06, Vector3.ZERO, _mt_ouro, Vector3.ZERO, 20)
		_cil(med, 0.29, 0.07, Vector3.ZERO, _mt_marinho, Vector3.ZERO, 20)
		for i in 8:
			var raio: float = 0.27 if i % 2 == 0 else 0.17
			var ponta := _caixa(med, Vector3(0.06, 0.11, raio), Vector3(0, 0, 0), _mt_ouro)
			ponta.rotation.y = float(i) * PI / 4.0
			ponta.position = Vector3(sin(ponta.rotation.y), 0, cos(ponta.rotation.y)) * raio * 0.45 + Vector3(0, 0.01, 0)
		_cil(med, 0.05, 0.1, Vector3.ZERO, _mt_ouro, Vector3.ZERO, 10)
		_juntar(med)
		# âncora de ferro pendurada no costado, na frente do medalhão
		var pa := _nav_ponto(NAV_L * 0.8, lado * 0.97) + Vector3(lado * 0.08, -0.1, 0)
		_caixa(corpo, Vector3(0.05, 0.7, 0.06), pa + Vector3(0, -0.3, 0), _mt_ferro)
		_caixa(corpo, Vector3(0.05, 0.06, 0.5), pa + Vector3(0, 0.02, 0), _mt_ferro)
		for dz in [-1.0, 1.0]: # os braços em curva para cima, com as unhas
			_pau(corpo, pa + Vector3(0, -0.66, 0), pa + Vector3(0, -0.5, dz * 0.28), 0.03, 0.03, _mt_ferro, 6)
			_pau(corpo, pa + Vector3(0, -0.5, dz * 0.28), pa + Vector3(0, -0.34, dz * 0.3), 0.035, 0.015, _mt_ferro, 6)
		_cil(corpo, 0.06, 0.03, pa + Vector3(0, 0.08, 0), _mt_ferro, Vector3(0, 0, PI * 0.5), 8)
	# mastros e velas
	var D2 := Vector3(0, D, 0)
	_mastro_vela(corpo, NAV_MASTRO_F, 6.6, 9.0, 10.2, 2.9, 0.22)
	_mastro_vela(corpo, NAV_MASTRO_R, 7.2, 10.2, 11.3, 5.3, 0.2)
	# bujarrona: do gurupé até o topo do mastro de vante, punho da escota perto da proa
	var tbuj := bico + Vector3(0, 0.6, 2.7)
	var cbuj := Vector3(0, D + 9.2, NAV_MASTRO_F + 0.15)
	var ebuj := Vector3(0, D + 1.2, NAV_L - 1.6)
	_vela_pano(corpo, tbuj, cbuj, cbuj, ebuj, 0.35, Vector3(-1, 0, 0)).name = "bujarrona"
	_pau(corpo, bico + Vector3(0, 0.75, 3.35), Vector3(0, D + 10.0, NAV_MASTRO_F), 0.016, 0.016, _mt_cabo, 4) # estai
	_pau(corpo, Vector3(0, D + 10.0, NAV_MASTRO_F), Vector3(0, D + 7.3, NAV_MASTRO_R), 0.016, 0.016, _mt_cabo, 4) # estai do grande
	# enxárcias: de cada lado de cada mastro, dos vaus até a borda (três por lado), com as bigotas no costado
	for zm in [[NAV_MASTRO_F, 6.6], [NAV_MASTRO_R, 7.2]]:
		for lado in [-1.0, 1.0]:
			for k in 3:
				var zb: float = float(zm[0]) - 0.5 + 0.45 * float(k)
				var pb := _nav_ponto(zb, lado) + Vector3(lado * 0.06, -0.15, 0)
				_pau(corpo, Vector3(lado * 0.75, D + float(zm[1]), float(zm[0])), pb, 0.014, 0.014, _mt_cabo, 4)
				_cil(corpo, 0.06, 0.05, pb, _mt_madeira_esc, Vector3(0, 0, PI * 0.5), 8)
		# brandal: do topo para trás, no costado
		for lado in [-1.0, 1.0]:
			var pb2 := _nav_ponto(float(zm[0]) - 1.6, lado) + Vector3(lado * 0.06, -0.1, 0)
			_pau(corpo, Vector3(0, D + float(zm[1]) + 2.6, float(zm[0])), pb2, 0.012, 0.012, _mt_cabo, 4)
	# flâmula no topo do mastro grande (vermelho e dourado)
	var fl := StandardMaterial3D.new()
	fl.albedo_color = Color(0.72, 0.14, 0.12)
	fl.cull_mode = BaseMaterial3D.CULL_DISABLED
	fl.roughness = 0.9
	var sf := SurfaceTool.new()
	sf.begin(Mesh.PRIMITIVE_TRIANGLES)
	var ft := Vector3(0, D + 11.15, NAV_MASTRO_R - 0.05)
	for v in [ft, ft + Vector3(0, -0.45, 0), ft + Vector3(0.12, -0.18, -1.5)]:
		sf.add_vertex(v)
	sf.generate_normals()
	var flm := MeshInstance3D.new()
	flm.mesh = sf.commit()
	flm.material_override = fl
	corpo.add_child(flm)
	# leme de roda: coluna, a roda com raios e manetes, o abrigo da bússola na frente
	var lp := Vector3(0, D, NAV_LEME.z)
	_caixa(corpo, Vector3(0.24, 0.95, 0.2), lp + Vector3(0, 0.47, 0), _mt_madeira_esc)
	_caixa(corpo, Vector3(0.5, 0.08, 0.36), lp + Vector3(0, 0.04, 0), _mt_madeira_esc)
	var roda := Node3D.new()
	roda.name = "roda_leme"
	roda.position = lp + Vector3(0, 1.08, -0.15)
	corpo.add_child(roda)
	var aro := TorusMesh.new()
	aro.inner_radius = 0.4
	aro.outer_radius = 0.46
	aro.rings = 24
	aro.ring_segments = 6
	var aro_mi := MeshInstance3D.new()
	aro_mi.mesh = aro
	aro_mi.material_override = _mt_madeira
	aro_mi.rotation.x = PI * 0.5
	roda.add_child(aro_mi)
	for i in 8:
		var ang := float(i) * TAU / 8.0
		var dir := Vector3(sin(ang), cos(ang), 0)
		_pau(roda, Vector3.ZERO, dir * 0.62, 0.022, 0.018, _mt_madeira_esc, 6)
		_cil(roda, 0.03, 0.12, dir * 0.6, _mt_madeira, Vector3(0, 0, ang), 6)
	_cil(roda, 0.08, 0.14, Vector3.ZERO, _mt_ouro, Vector3(PI * 0.5, 0, 0), 10)
	_caixa(corpo, Vector3(0.34, 0.4, 0.3), lp + Vector3(0, 0.2, 0.75), _mt_madeira) # bitácula
	_cil(corpo, 0.13, 0.14, lp + Vector3(0, 0.47, 0.75), _mt_ouro, Vector3.ZERO, 12)
	# lampião na popa (poste e a lanterna acesa)
	var pl := Vector3(0, float(_nav_secao(-NAV_L + 0.3)[1]), -NAV_L + 0.3)
	_pau(corpo, pl, pl + Vector3(0, 1.1, -0.15), 0.035, 0.03, _mt_madeira_esc, 6)
	_caixa(corpo, Vector3(0.2, 0.28, 0.2), pl + Vector3(0, 1.3, -0.18), _mt_vidro)
	_caixa(corpo, Vector3(0.26, 0.05, 0.26), pl + Vector3(0, 1.46, -0.18), _mt_ouro)
	_caixa(corpo, Vector3(0.26, 0.04, 0.26), pl + Vector3(0, 1.15, -0.18), _mt_ouro)
	# no convés: escotilha do porão (grade), barris, rolos de cabo e malaguetas
	_caixa(corpo, Vector3(1.3, 0.16, 1.0), D2 + Vector3(0, 0.08, -2.6), _mt_madeira_esc)
	for i in 5:
		_caixa(corpo, Vector3(1.2, 0.03, 0.05), D2 + Vector3(0, 0.17, -2.98 + float(i) * 0.19), _mt_madeira)
		_caixa(corpo, Vector3(0.05, 0.03, 0.9), D2 + Vector3(-0.48 + float(i) * 0.24, 0.17, -2.6), _mt_madeira)
	for b in [Vector3(-1.15, 0, -1.9), Vector3(-1.1, 0, -1.35), Vector3(1.15, 0, -1.7), Vector3(1.1, 0, 4.2)]:
		_cil(corpo, 0.24, 0.6, D2 + b + Vector3(0, 0.3, 0), _mt_madeira, Vector3.ZERO, 12)
		_cil(corpo, 0.25, 0.04, D2 + b + Vector3(0, 0.12, 0), _mt_ferro, Vector3.ZERO, 12)
		_cil(corpo, 0.25, 0.04, D2 + b + Vector3(0, 0.48, 0), _mt_ferro, Vector3.ZERO, 12)
	for c in [Vector3(0.75, 0, 4.6), Vector3(-0.9, 0, -3.8)]:
		var rolo := TorusMesh.new()
		rolo.inner_radius = 0.1
		rolo.outer_radius = 0.26
		rolo.rings = 14
		rolo.ring_segments = 6
		var rm := MeshInstance3D.new()
		rm.mesh = rolo
		rm.material_override = _mt_corda
		rm.position = D2 + c + Vector3(0, 0.06, 0)
		rm.scale = Vector3(1, 0.7, 1)
		corpo.add_child(rm)
	# escada de corda de cada lado, para subir da água (ao lado do mastro grande)
	for lado in [-1.0, 1.0]:
		var zc := NAV_MASTRO_R - 1.0
		var topo := _nav_ponto(zc, lado) + Vector3(lado * 0.08, 0.0, 0)
		for k in 6:
			var y: float = topo.y - 0.12 - float(k) * 0.24
			_caixa(corpo, Vector3(0.05, 0.04, 0.5), Vector3(topo.x + lado * 0.02 * k, y, zc), _mt_madeira)
		for dz in [-0.24, 0.24]:
			_pau(corpo, topo + Vector3(0, 0, dz), Vector3(topo.x + lado * 0.1, NAV_AGUA - 0.1, zc + dz), 0.015, 0.015, _mt_corda, 4)
	_juntar(corpo)
	# os packs do porão empilhados no convés entre os mastros (4 de largura, 2 fileiras, 2 andares)
	var pk := Node3D.new()
	pk.name = "packs"
	pk.position = D2 + Vector3(0, 0.0, (NAV_MASTRO_F + NAV_MASTRO_R) * 0.5 + 0.1)
	var lug := []
	for andar in 2:
		for fila in 2:
			for col in 4:
				lug.append(Vector3((float(col) - 1.5) * 0.6, float(andar) * 0.62, 0.32 - float(fila) * 0.62))
	pk.set_meta("lugares", lug)
	pk.set_meta("alinhado", true) # empilhados certinhos, como carga amarrada
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
		p.rotation.y = (float(i % 3) - 1.0) * 0.05 if pk.get_meta("alinhado", false) else float(i) * 0.3 - floor(float(i) * 0.3)
		pk.add_child(p)

# ---------- painel do pack e do carrinho (Quimera #packc), em cima à esquerda embaixo da vida ----------
# o painel do pack (o que vai nas costas) também muda de lugar e tamanho no modo de editar a interface
# (André 2026-11-12, editar_hud.gd id "pack")
const PAINEL_POS := Vector2(16, 150)
var _painel_d := Vector2.ZERO
var _painel_s := 1.0

var _painel_livre := true # false: segue a coluna da esquerda, embaixo da missão (missao_ativa.gd, André 2026-11-14)

func posicionar(d: Vector2, s: float, livre := true) -> void:
	_painel_d = d
	_painel_s = s
	_painel_livre = livre
	if _painel:
		if livre:
			_painel.position = PAINEL_POS + d
		_painel.scale = Vector2(s, s)

# lugar na coluna da esquerda (missao_ativa.gd chama todo quadro); só vale enquanto o jogador não mudou o pack de lugar
func na_coluna(p: Vector2) -> void:
	if not _painel_livre and _painel and _painel.position != p:
		_painel.position = p

func area() -> Rect2:
	return _painel.get_global_rect() if _painel and _painel.visible else Rect2()

func _montar_painel() -> void:
	var cl := CanvasLayer.new()
	cl.layer = 5
	add_child(cl)
	_painel = PanelContainer.new()
	_painel.position = PAINEL_POS + _painel_d
	_painel.scale = Vector2(_painel_s, _painel_s)
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
		t += ("[b][color=#ffe7a8]%s[/color][/b]\n[color=#cbbfa8]" + Idioma.t("Feito em: %s · leve pra longe") + "[/color]") % [Idioma.frase(str(PK[pk.k].nome)), Idioma.frase(str(_onde(pk)))]
	var c = p.get("carrinho")
	if c is Dictionary and m.mov.veiculo.get("k", "") == "carrinho":
		var gal: float = (comb_local if comb_local >= 0.0 else float(c.get("comb", 0))) / float(V.carrinho.galao)
		t += ("\n" if t != "" else "") + ("[b]" + Idioma.t("Carrinho") + "[/b]\n[color=#cbbfa8]" + Idioma.t("Combustível: %s galão · Vida: %d/%d · Packs: %d/%d") + "[/color]") % [
			String.num(snappedf(gal, 0.1)).replace(".", ","), int(c.get("vida", 0)), int(V.carrinho.vida), (c.get("packs", []) as Array).size(), capacidade(c)]
	var nv = p.get("navio")
	if nv is Dictionary and m.mov.veiculo.get("k", "") == "navio":
		t += ("\n" if t != "" else "") + ("[b]" + Idioma.t("Navio mercante") + "[/b]\n[color=#cbbfa8]" + Idioma.t("Porão: %d/%d packs") + "[/color]") % [(nv.get("porao", []) as Array).size(), int(V.navio.porao)]
	var editando: bool = m.hud.editando
	if t == "" and editando: # no modo de editar aparece mesmo sem pack, para dar para mover
		t = "[b][color=#ffe7a8]" + Idioma.t("Pack nas costas") + "[/color][/b]\n[color=#cbbfa8]" + Idioma.t("Aparece aqui quando você carrega um pack") + "[/color]"
	if _painel_txt.text != t: # os pedaços já vêm no idioma (a frase inteira com [b][color] não bate com o dicionário)
		_painel_txt.text = t
	_painel.visible = t != "" and (editando or not m.menu.aberto())
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
	var forte: float = float(PR.areas.get("forte", 0)) # André 2026-11-16: o campo mais forte a até forte m (shared/transporte.js)
	var nv_forte := 0
	for c in m.mundo.get("caca", []):
		var d := Vector2(float(c.x) - x, float(c.z) - z).length()
		if d < dm:
			dm = d
			nv = int(c.get("nivel", 1))
		if forte > 0.0 and d < forte:
			nv_forte = maxi(nv_forte, int(c.get("nivel", 1)))
	if forte > 0.0:
		nv = maxi(1, nv_forte)
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

# o pack que esse mercador faz e o material dele (já com o desconto da profissão): conversa.gd desenha em ícones
func receita_mercador(n) -> Dictionary:
	if not (n is Dictionary):
		return {}
	var k := str(n.get("info", {}).get("merch", ""))
	if not PK.has(k):
		return {}
	return {"k": k, "nome": str(PK[k].nome), "custo": custo(k)}

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
	# o material aparece desenhado em cima, com tem/precisa (conversa.gd _itens_passe, igual ao passe do Gaspar)
	var fala := "Eu faço o %s com o material aí em cima.\nQuanto paga em cada mercador (mais longe e área mais forte = mais caro):" % PK[k].nome
	var lista := []
	for o in m.npcs:
		if o.funcao != "pack" or o == n:
			continue
		lista.append([str(o.nome).get_slice(",", 0), preco({"k": k, "ox": nx, "oz": nz}, o.no.position.x, o.no.position.z)])
	lista.sort_custom(func(a, b): return a[1] > b[1])
	for e in lista:
		fala += "\n · %s: %d de ouro" % [e[0], e[1]]
	# André 2026-11-12: dois botões separados, sempre na janela. "Criar pack" (a barrinha de criar) e "Entregar pack",
	# que só acende com um pack nas costas que não foi feito aqui, já com o ouro que vai receber.
	# [texto, ícone, Callable, aceso]
	var ops := []
	ops.append(["Criar pack (%d de vigor)" % int(PR.vigor), "it_pack", func(): m.rede("pack", {"acao": "fazer", "npc": n.id}), true])
	var entregar := func(pk, de: String, i: int) -> void:
		var onde: String = {"costas": "", "carrinho": " (carrinho)", "porao": " (porão)"}[de]
		if not (pk is Dictionary) or not PK.has(str(pk.get("k", ""))):
			if de == "costas": # sem pack nas costas: o botão fica, apagado
				ops.append(["Entregar pack", "it_ouro", func(): m.hud.aviso("Traga um pack nas costas feito em outro mercador"), false])
			return
		if Vector2(nx - float(pk.ox), nz - float(pk.oz)).length() < float(PR.perto):
			ops.append(["Entregar pack%s (feito aqui)" % onde, "it_ouro", func(): m.hud.aviso("Esse pack foi feito aqui. Leve pra outro mercador: quanto mais longe, mais paga!"), false])
			return
		ops.append(["Entregar pack%s · +%d ouro" % [onde, preco(pk, nx, nz)], "it_ouro", func(): m.rede("pack", {"acao": "entregar", "npc": n.id, "de": de, "i": i}); m.sons.tocar("moedas", -4.0), true])
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
	if not (_jan and is_instance_valid(_jan)):
		_aberta_ms = Time.get_ticks_msec() # janela nova (refazer com o "prog" não conta)
	_jan_carrinho = true
	_jan_navio = false
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
	fundo.gui_input.connect(_toque_fundo)
	_jan.add_child(fundo)
	var pc := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.12, 0.09, 0.06, 0.96)
	sb.border_color = Color(0.85, 0.7, 0.4)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(16)
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
	x.add_to_group("guia_saida") # a trava do guia (guia.gd) sempre deixa o X passar
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
	encher.set_meta("guia", "veiculo:encher") # guia.gd: abastecer o carrinho
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
			var vz := _slot(Vector2(72, 72), null, "vazio", Color(0.5, 0.42, 0.3), func(): _por_pack())
			if i == cp.size():
				vz.set_meta("guia", "veiculo:por_pack") # guia das missões: o pack das costas vai aqui
			grade.add_child(vz)
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
	var custo_ic: Control = null # André 2026-11-15: o que precisa em ícone tenho/preciso (igual às receitas), não em lista
	if quebrado:
		acoes.add_child(_acao("Consertar", "cs_desmontar", func(): m.rede("veiculo", {"acao": "consertar"})))
		custo_ic = _custo_icones("Consertar o quebrado", C.get("consertoQuebrado", {"lenha": 8, "barra_ferro": 1}))
	else:
		if not dirigindo:
			acoes.add_child(_acao("Dirigir", "it_carrinho", func(): m.rede("veiculo", {"acao": "subir", "k": "carrinho"}); _fechar_janela()))
		if float(c.get("vida", 0)) < float(C.vida):
			acoes.add_child(_acao("Consertar", "cs_desmontar", func(): m.rede("veiculo", {"acao": "consertar"})))
		if lv < int(C.nivelMax):
			var cu: Dictionary = C.melhorar[lv + 1]
			acoes.add_child(_acao("Melhorar", "cs_bancada", func(): m.rede("veiculo", {"acao": "melhorar"})))
			custo_ic = _custo_icones("Melhorar pro Nv %d · %d packs · na bancada" % [lv + 1, int(C.capacidade) * (lv + 1)], cu)
		if not dirigindo:
			acoes.add_child(_acao("Guardar", "topo_mochila", func(): m.rede("veiculo", {"acao": "guardar", "k": "carrinho"}); _fechar_janela()))
	if custo_txt.text != "":
		vb.add_child(custo_txt)
	if custo_ic:
		vb.add_child(custo_ic)
	m.hud.bloqueado = true
	await get_tree().process_frame
	if is_instance_valid(pc):
		pc.position = (pc.get_viewport_rect().size - pc.size) * 0.5

# custo (melhorar/consertar) em ícones no padrão das receitas: moldura verde/vermelha e "tenho/preciso" embaixo;
# o ouro entra como mais um ícone (moedas). Tocar no ícone mostra o nome (menu.icone_material).
func _custo_icones(titulo: String, cu: Dictionary) -> Control:
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 4)
	var tt := _rotulo(titulo, 13, Color("#cbbfa8"))
	tt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(tt)
	var fila := HBoxContainer.new()
	fila.add_theme_constant_override("separation", 8)
	fila.alignment = BoxContainer.ALIGNMENT_CENTER
	col.add_child(fila)
	for it in cu:
		var k := str(it)
		var precisa := int(cu[it])
		if k == "ouro":
			fila.add_child(_icone_ouro(int(m.P.prog.get("ouro", 0)), precisa))
		elif m.P.dados.itens.has(k):
			fila.add_child(m.menu.icone_material(k, m.P.contar(k), precisa))
	return col

func _icone_ouro(tem: int, precisa: int) -> Control:
	var ok := tem >= precisa
	var bx := VBoxContainer.new()
	bx.add_theme_constant_override("separation", 0)
	var q := Button.new()
	q.focus_mode = Control.FOCUS_NONE
	q.custom_minimum_size = Vector2(40, 40)
	q.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var st: StyleBoxFlat = m.menu.caixa(Color(0.045, 0.04, 0.036, 1), Color(0.45, 0.78, 0.45, 0.8) if ok else Color(0.88, 0.5, 0.42, 0.8), 1, 6)
	for e in ["normal", "hover", "pressed"]:
		q.add_theme_stylebox_override(e, st)
	var ic := _icone(m.menu.icone_tex("it_ouro"), 32)
	ic.set_anchors_preset(Control.PRESET_FULL_RECT)
	ic.offset_left = 4
	ic.offset_top = 4
	ic.offset_right = -4
	ic.offset_bottom = -4
	q.add_child(ic)
	q.pressed.connect(func(): m.menu.balao_nome(q, Idioma.frase("Ouro"), Color("ffd36a")))
	bx.add_child(q)
	var n := _rotulo("%s/%s" % [_curto(tem), _curto(precisa)], 11, Color(0.45, 0.78, 0.45) if ok else Color("e0806a"))
	n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bx.add_child(n)
	return bx

# 25000 → "25.000" (ouro com ponto de milhar, cabe embaixo do ícone)
func _curto(v: int) -> String:
	var t := str(absi(v))
	var r := ""
	while t.length() > 3:
		r = "." + t.substr(t.length() - 3) + r
		t = t.substr(0, t.length() - 3)
	return t + r

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
	l.text = Idioma.frase(t)
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
	b.set_meta("guia", "veiculo:" + nome.to_lower()) # guia das missões (guia.gd): Consertar, Melhorar...
	return b

# janela do navio (André 2026-11-21: "acrescentar o menu igual dos carrinhos... não vai ter gasolina, claro, mas vai
# ter a opção de dirigir"): a mesma cara da janela do carrinho, sem combustível e sem vida. O porão: um lugar por pack
# (16); tocar num pack põe nas costas, tocar num lugar vazio põe o das costas. Embaixo: Pilotar, Carregar e
# Descarregar o carrinho e Guardar; no leme, Sair do leme (o navio fica parado ali e você anda no convés) e Descer (na
# margem, como antes). Refaz quando o "prog" chega.
var _jan_navio := false
func abrir_navio() -> void:
	var nv = m.P.prog.get("navio")
	if not (nv is Dictionary):
		return
	if _jan:
		_jan.queue_free()
	if not (_jan and is_instance_valid(_jan)):
		_aberta_ms = Time.get_ticks_msec()
	_jan_carrinho = false
	_jan_navio = true
	var no_leme: bool = m.mov.veiculo.get("k", "") == "navio"
	var pp: Array = nv.get("porao", [])
	var cap: int = int(V.navio.porao)
	var c = m.P.prog.get("carrinho")
	var cp: Array = (c as Dictionary).get("packs", []) if c is Dictionary else []
	_jan = CanvasLayer.new()
	_jan.layer = 16
	add_child(_jan)
	var fundo := ColorRect.new()
	fundo.color = Color(0, 0, 0, 0.35)
	fundo.set_anchors_preset(Control.PRESET_FULL_RECT)
	fundo.gui_input.connect(_toque_fundo)
	_jan.add_child(fundo)
	var pc := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.12, 0.09, 0.06, 0.96)
	sb.border_color = Color(0.85, 0.7, 0.4)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(16)
	sb.set_content_margin_all(14)
	pc.add_theme_stylebox_override("panel", sb)
	_jan.add_child(pc)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 10)
	pc.add_child(vb)
	# topo: ícone, nome, a barra do porão e o X
	var topo := HBoxContainer.new()
	topo.add_theme_constant_override("separation", 10)
	vb.add_child(topo)
	topo.add_child(_icone(m.hud.icone("it_navio"), 40))
	var tv := VBoxContainer.new()
	tv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	topo.add_child(tv)
	tv.add_child(_rotulo("Navio mercante" + (" · no leme" if no_leme else ""), 18, Color("#ffe7a8")))
	tv.add_child(_barra(float(pp.size()) / float(cap), Color("#6fb7c9"), "Porão %d/%d packs" % [pp.size(), cap], 300))
	var x := Button.new()
	x.text = "✕"
	x.focus_mode = Control.FOCUS_NONE
	x.custom_minimum_size = Vector2(44, 44)
	x.add_theme_font_size_override("font_size", 20)
	x.pressed.connect(_fechar_janela)
	x.add_to_group("guia_saida")
	topo.add_child(x)
	# meio: o porão (8 por fileira, 2 fileiras)
	var grade := GridContainer.new()
	grade.columns = 8
	grade.add_theme_constant_override("h_separation", 8)
	grade.add_theme_constant_override("v_separation", 8)
	vb.add_child(grade)
	for i in cap:
		if i < pp.size():
			var k := str(pp[i].get("k", ""))
			var nome := str(PK.get(k, {}).get("nome", "Pack")).replace("Pack de ", "")
			var sl := _slot(Vector2(66, 66), m.hud.icone("it_pack"), nome, Color(str(PK.get(k, {}).get("cor", "#a0703a"))),
				func(): _tirar_porao(i))
			grade.add_child(sl)
		else:
			var vz := _slot(Vector2(66, 66), null, "vazio", Color(0.5, 0.42, 0.3), func(): _por_porao())
			if i == pp.size():
				vz.set_meta("guia", "veiculo:por_porao")
			grade.add_child(vz)
	vb.add_child(_rotulo("Toque num pack pra pegar nas costas; num lugar vazio pra pôr o das costas.", 12, Color("#a89a80")))
	# embaixo: ações com ícone
	var acoes := HBoxContainer.new()
	acoes.add_theme_constant_override("separation", 10)
	acoes.alignment = BoxContainer.ALIGNMENT_CENTER
	vb.add_child(acoes)
	if not no_leme:
		acoes.add_child(_acao("Pilotar", "it_navio", func(): m.rede("veiculo", {"acao": "subir", "k": "navio"}); _fechar_janela()))
	if c is Dictionary:
		var b1 := _acao("Carregar", "it_carrinho", func(): m.rede("pack", {"acao": "carrinho_porao"}))
		b1.tooltip_text = "Do carrinho pro porão"
		acoes.add_child(b1)
		var b2 := _acao("Descarregar", "it_carrinho", func(): m.rede("pack", {"acao": "porao_carrinho"}))
		b2.tooltip_text = "Do porão pro carrinho"
		acoes.add_child(b2)
	if no_leme:
		acoes.add_child(_acao("Sair do leme", "it_navio", func(): m.rede("veiculo", {"acao": "largar_leme"}); _fechar_janela()))
		acoes.add_child(_acao("Descer", "it_navio", func(): m.rede("veiculo", {"acao": "descer"}); _fechar_janela()))
	else:
		acoes.add_child(_acao("Guardar", "topo_mochila", func(): m.rede("veiculo", {"acao": "guardar", "k": "navio"}); _fechar_janela()))
	if c is Dictionary:
		vb.add_child(_rotulo("Carrinho: %d packs. Carregar e Descarregar levam tudo de uma vez (o carrinho precisa estar perto)." % cp.size(), 12, Color("#a89a80")))
	m.hud.bloqueado = true
	await get_tree().process_frame
	if is_instance_valid(pc):
		pc.position = (pc.get_viewport_rect().size - pc.size) * 0.5

func _tirar_porao(i: int) -> void:
	if m.P.prog.get("pack") is Dictionary:
		m.hud.aviso("Você já tem um pack nas costas")
		return
	m.rede("pack", {"acao": "tirar_porao", "i": i})

func _por_porao() -> void:
	if not (m.P.prog.get("pack") is Dictionary):
		m.hud.aviso("Traga um pack nas costas pra pôr no porão")
		return
	m.rede("pack", {"acao": "por_porao"})

# janelinha simples de opções (a mesma cara da janela do NPC)
var _jan: CanvasLayer
func _janela(titulo: String, ops: Array) -> void:
	if not (_jan and is_instance_valid(_jan)):
		_aberta_ms = Time.get_ticks_msec()
	_jan_carrinho = false
	_jan_navio = false
	if _jan:
		_jan.queue_free()
	_jan = CanvasLayer.new()
	_jan.layer = 16
	add_child(_jan)
	var fundo := ColorRect.new()
	fundo.color = Color(0, 0, 0, 0.35)
	fundo.set_anchors_preset(Control.PRESET_FULL_RECT)
	fundo.gui_input.connect(_toque_fundo)
	_jan.add_child(fundo)
	var pc := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.12, 0.09, 0.06, 0.95)
	sb.border_color = Color(0.85, 0.7, 0.4)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(16)
	sb.set_content_margin_all(14)
	pc.add_theme_stylebox_override("panel", sb)
	pc.set_anchors_preset(Control.PRESET_CENTER)
	_jan.add_child(pc)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 6)
	pc.add_child(vb)
	var lt := Label.new()
	lt.text = Idioma.frase(titulo)
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

# tocar fora da janela fecha. No PC (André 2026-11-14: "no pc qd clico no botao de açao nada acontece") o clique do
# mouse vira toque (emulate_touch_from_mouse): o toque abre a janela pelo botão da HUD e o mesmo clique, logo depois,
# cai no fundo novo e fechava na hora. Nos primeiros 0,3 s da janela o fundo não fecha.
var _aberta_ms := 0
func _toque_fundo(ev: InputEvent) -> void:
	if ev is InputEventMouseButton and ev.pressed and Time.get_ticks_msec() - _aberta_ms > 300:
		_fechar_janela()

func _fechar_janela() -> void:
	_jan_carrinho = false
	_jan_navio = false
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
var _abrir_do_leme := true # no leme o botão abre a janela do navio (porão e Ancorar), André 2026-11-21

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
				_guardar_veic(v)
			v = _tirar_veic(tipo, nv)
			if v.is_empty():
				var no: Node3D = modelo_carrinho(nv) if tipo == "c" else modelo_barquinho() if tipo == "b" else modelo_navio()
				m.add_child(no)
				v = {"no": no, "tipo": tipo, "nv": nv}
			v.dono = dono
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
			v.n_packs = (e[6] as Array).size()
	for k in veic.keys():
		if not vv.has(k):
			_guardar_veic(veic[k])
			veic.erase(k)

# Veículos guardados (André 2026-11-15, travadas): montar carrinho, barco ou navio é feito peça por peça aqui no jogo e
# levava ~240 ms num quadro no Poco X7 toda vez que um aparecia (rx:carga). Quem sai da visão fica escondido e o
# próximo do mesmo tipo e nível usa o mesmo, como os corpos dos jogadores (online.gd _soltar_corpo).
const VEIC_GUARDADOS := 2
var _veic_guardados := {} # "tipo:nv" -> [v]
func _guardar_veic(v: Dictionary) -> void:
	if not is_instance_valid(v.get("no")):
		return
	var k := "%s:%d" % [str(v.tipo), int(v.nv)]
	var l: Array = _veic_guardados.get(k, [])
	if l.size() >= VEIC_GUARDADOS:
		v.no.queue_free()
		return
	v.no.visible = false
	v.dirigindo = false
	l.append(v)
	_veic_guardados[k] = l

# Registros do Poco X7 (2026-11-16, versão 2420, porto em -403,67): mesmo com a guarda acima, o PRIMEIRO barco ou navio
# visto ainda montava peça por peça num quadro (rx:carga 330 ms). Atrás da capa (aquecer.gd) nasce um de cada (o
# carrinho no nível do seu), aparece na frente da câmera (os materiais ficam prontos) e vai direto para a guarda.
func aquecer_em(p: Vector3, lado: Vector3) -> Array:
	var l: Array = []
	var nv := 1
	var c = m.P.prog.get("carrinho") if m.P and m.P.prog is Dictionary else null
	if c is Dictionary:
		nv = maxi(1, int(c.get("lv", 1)))
	var i := 0
	for par in [["c", nv], ["b", 1], ["n", 1]]:
		var no: Node3D = modelo_carrinho(par[1]) if par[0] == "c" else modelo_barquinho() if par[0] == "b" else modelo_navio()
		m.add_child(no)
		no.global_position = p + lado * (float(i) - 1.0) * 4.0
		l.append({"no": no, "tipo": par[0], "nv": par[1]})
		i += 1
	return l

func guardar_aquecidos(l: Array) -> void:
	for v in l:
		_guardar_veic(v)

func _tirar_veic(tipo: String, nv: int) -> Dictionary:
	var l: Array = _veic_guardados.get("%s:%d" % [tipo, nv], [])
	while not l.is_empty():
		var v: Dictionary = l.pop_back()
		if is_instance_valid(v.get("no")):
			v.no.visible = true
			v.vel = 0.0
			v.erase("partes") # as caixas do carrinho são refeitas no lugar novo
			if v.has("pontos"):
				v.pontos = [] # o rastro do barco começa de novo onde ele aparece
			return v
	return {}

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
			if int(ev.get("leme", 0)) == 1: # largou o leme no meio da água: fica de pé no convés, atrás da roda
				m.mov.y = float(m.terreno.agua.nivel) + float(V.navio.solido.conves)
				m.mov.vy = 0.0
				comb_local = -1.0
				return
			if str(ev.get("k", "")) == "carrinho": # o carrinho agora é sólido: desce do lado da cabine, não dentro dele
				var lado := _lado_livre(m.mov.x, m.mov.z, m.mov.ry)
				m.mov.x = lado.x
				m.mov.z = lado.y
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
	if m.conversa: # o pack saiu da barrinha ou foi entregue: material e botões refazem na janela do mercador
		m.conversa.atualizar_pack()
	if _jan_carrinho and _jan and is_instance_valid(_jan):
		abrir_carrinho.call_deferred() # a janela mostra o que o servidor mandou (combustível, packs, vida, nível)
	elif _jan_navio and _jan and is_instance_valid(_jan):
		abrir_navio.call_deferred() # o porão como o servidor mandou
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
	var t0_parte := Time.get_ticks_usec()
	_process_parte(dt)
	if Time.get_ticks_usec() - t0_parte >= 1000 and Engine.has_meta("lentidao"): # quadro lento (lentidao.gd)
		Engine.get_meta("lentidao").ev("transporte", t0_parte)

func _process_parte(dt: float) -> void:
	if m.heroi == null or V.is_empty():
		return
	# meu veículo segue o herói (o servidor manda a posição dele 20 vezes por segundo; a minha eu já sei)
	var hp: Vector3 = m.heroi.position
	var meu_k: String = m.mov.veiculo.get("k", "")
	var sentados := {} # id do jogador ("eu" = o herói) -> veículo onde ele está sentado (carrinho e barquinho)
	# carrinho sólido: as caixas do quadro passado saem do chão enquanto os carrinhos se mexem (o carrinho pisa no relevo,
	# não em cima dele mesmo) e voltam no fim, nas posições novas
	var moveis_novos: Array = []
	m.terreno.moveis = []
	var meu_no: Node3D = null # o carrinho/barco que eu dirijo
	var a_pe: bool = meu_k == "" and m.mov.chao and m.mov.esc == null and m.mov.vy <= 0.0
	for chave in veic:
		var v: Dictionary = veic[chave]
		var no: Node3D = v.no
		# em pé em cima dele (André 2026-11-13: "se tiver duas pessoas, um ficar em cima"): o herói vai junto
		var pisa = null
		if a_pe and (v.tipo == "c" or v.tipo == "n") and v.has("partes"):
			for pt in v.partes:
				if absf(m.mov.y - Terreno.topo_parte(pt, m.mov.x, m.mov.z)) < 0.08:
					pisa = pt.qual
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
			if v.tipo == "n": # o piloto está no leme, atrás do meio do navio (shared/transporte.js centroNavio)
				alvo -= Vector3(sin(ry), 0, cos(ry)) * float(V.navio.get("leme", NAV_LEME.z - 0.55))
		var agua: bool = v.tipo != "c"
		alvo.y = float(m.terreno.agua.nivel) - (0.25 if v.tipo == "n" else 0.0) if agua else m.terreno.altura(alvo.x, alvo.z)
		if v.tipo == "c": # tira a altura que o _inclinar_carrinho somou no quadro passado (a conta segue do chão do meio)
			no.position.y -= float(v.get("incl_dy", 0.0))
			v.incl_dy = 0.0
		var antes := no.position
		var ry_antes := no.rotation.y
		no.position = alvo if dirigindo_eu or no.position.distance_to(alvo) > 6.0 else no.position.lerp(alvo, minf(1.0, dt * 12.0))
		no.rotation.y = lerp_angle(no.rotation.y, ry, minf(1.0, dt * 12.0))
		if v.tipo == "c":
			_inclinar_carrinho(v, no, dt)
		# velocidade e giro de verdade (servem para o meu e para o dos outros: rodas, volante e remada)
		var vel: float = Vector2(no.position.x - antes.x, no.position.z - antes.z).length() / maxf(dt, 0.001)
		if vel > 12.0:
			vel = 0.0 # pulou para a posição nova (chegou agora): não é velocidade
		v.vel = lerpf(float(v.get("vel", 0.0)), vel, minf(1.0, dt * 6.0))
		v.giro = lerpf(float(v.get("giro", 0.0)), clampf(angle_difference(ry_antes, no.rotation.y) / maxf(dt, 0.001), -3.0, 3.0), minf(1.0, dt * 6.0))
		if v.tipo == "c":
			var partes_antes: Array = v.get("partes", [])
			v.partes = _partes(v)
			if not dirigindo_eu:
				moveis_novos.append({"x": no.position.x, "z": no.position.z, "r2": 16.0, "partes": v.partes})
			if pisa != null:
				_levar(partes_antes, v.partes, pisa)
		elif v.tipo == "n": # navio sólido (André 2026-11-21): convés, amurada, mastros e a carga viram chão e parede
			var partes_n: Array = v.get("partes", [])
			v.partes = [_parte("navio", no, caixas_navio(int(v.get("n_packs", 0))))]
			if not dirigindo_eu:
				moveis_novos.append({"x": no.position.x, "z": no.position.z, "r2": 49.0, "partes": v.partes})
			if pisa != null:
				_levar(partes_n, v.partes, pisa)
		var corpo: Node3D = no.get_node_or_null("corpo")
		if corpo:
			if v.tipo == "c":
				_motor(v, no, corpo, dt)
				_rodas_volante(v, no, corpo, dt)
			else: # balança na água
				_boiar(v, corpo, dt)
				if v.tipo == "b":
					_remar(v, corpo, dt)
				_rastro(v, no, dt)
		# quem está sentado nele (o carrinho e o barquinho; no navio o herói fica de pé no leme)
		if v.dirigindo and v.tipo != "n":
			if dirigindo_eu:
				sentados["eu"] = v
				meu_no = no
			elif m.online and m.online.outros.has(v.dono):
				sentados[str(v.dono)] = v
	m.terreno.moveis = moveis_novos
	if meu_k == "":
		_escada_navio()
	# o herói no veículo: sentado no banco do carrinho ou do barco (sentar.gd), de pé no leme do navio
	if meu_k != "":
		var dy := 0.0
		var atras := 0.0
		if meu_k == "carrinho": # o quadril vai no banco (sentar.gd); o corpo fica em cima do assoalho
			dy = 0.15
			atras = CARRO_BANCO.z
		elif meu_k == "barquinho": # no banco do meio (o quadril vai no banco pelo sentar.gd; o casco afundou 0,2 m)
			dy = 0.12 + BARCO_AFUNDA - 0.1
			atras = BARCO_BANCO.z
		else: # no convés, de pé atrás da roda do leme (navio novo, André 2026-11-21)
			dy = NAV_CONVES - NAV_AGUA
			atras = float(V.navio.get("leme", NAV_LEME.z - 0.55)) # shared/dados.js VEICULOS.navio.leme
		if meu_k == "carrinho" and meu_no != null: # no banco do trator, deitado junto com ele na ladeira e na ponte
			m.heroi.position = meu_no.transform * Vector3(0, dy, atras)
			atras = 0.0
		else:
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

# Carrinho sólido (André 2026-11-13): as caixas de shared/transporte.js caixasCarrinho, no trator e na carreta (que gira
# no engate). terreno.gd usa o topo delas como chão. A conta da carreta é a mesma do servidor.
const Terreno = preload("res://terreno.gd")
var _caixas := {} # nv -> {trator, carreta}
func caixas(nv: int) -> Dictionary:
	if _caixas.has(nv):
		return _caixas[nv]
	var S: Dictionary = V.carrinho.solido
	var K: Dictionary = S.cacamba
	var fileiras: int = 1 if nv <= 1 else 2
	var fundo: float = float(K.frente) - fileiras * float(K.fileira) - 2.0 * float(K.folga)
	var carreta: Array = [S.lanca, [S.rodas[0], S.rodas[1], fundo, K.frente, S.rodas[2]]]
	for f in fileiras:
		var andar2: bool = (nv >= 3 and f == 0) or (nv >= 4 and f == 1)
		var z0: float = fundo if f == fileiras - 1 else float(K.frente) - float(K.folga) - (f + 1) * float(K.fileira)
		var z1: float = float(K.frente) if f == 0 else float(K.frente) - float(K.folga) - f * float(K.fileira)
		carreta.append([-float(K.meia), float(K.meia), z0, z1, float(K.topo) + (float(K.andar2) if andar2 else 0.0)])
	_caixas[nv] = {"trator": S.trator, "carreta": carreta}
	return _caixas[nv]

# Escada de corda (André 2026-11-21, navio sólido): nadando do lado do vão da amurada e indo para o navio, o herói sobe
# a escada e fica de pé no convés, logo para dentro do vão (o costado é alto demais para a escalada do andar.gd).
var _escada_t := 0.0
func _escada_navio() -> void:
	if m.hud.mover.length() < 0.3 or Time.get_ticks_msec() < _escada_t:
		return
	var S: Dictionary = V.navio.solido
	var deck: float = float(m.terreno.agua.nivel) + float(S.conves)
	if m.mov.y > deck - 0.3:
		return
	var esc: float = float(S.escada)
	for chave in veic:
		var v: Dictionary = veic[chave]
		if v.tipo != "n" or not v.has("partes"):
			continue
		var pt: Dictionary = v.partes[0]
		var dx: float = m.mov.x - float(pt.x)
		var dz: float = m.mov.z - float(pt.z)
		var lx: float = dx * float(pt.c) - dz * float(pt.s)
		var lz: float = dx * float(pt.s) + dz * float(pt.c)
		if absf(lz - esc) > 0.7:
			continue
		var w := 1.6
		for i in range(1, (S.boca as Array).size()):
			if esc <= float(S.boca[i][0]):
				w = float(S.boca[i][1])
				break
		if absf(lx) < w or absf(lx) > w + 1.5:
			continue
		var para := Vector2(-signf(lx) * cos(float(pt.a)), signf(lx) * sin(float(pt.a))) # para dentro do navio (mundo)
		if Vector2(sin(m.mov.ry), cos(m.mov.ry)).dot(para) < 0.3:
			continue
		var nlx: float = signf(lx) * (w - 0.55)
		m.mov.x = float(pt.x) + nlx * float(pt.c) + esc * float(pt.s)
		m.mov.z = float(pt.z) - nlx * float(pt.s) + esc * float(pt.c)
		m.mov.y = deck
		m.mov.vy = 0.0
		m.mov.chao = true
		m.mov.mergulho = 0.0
		m.heroi.position = m.mov.posicao()
		m.sons.tocar("pano", -6.0)
		_escada_t = Time.get_ticks_msec() + 800
		return

# Navio sólido (André 2026-11-21: "eu posso subir em cima dele. Outras pessoas podem subir e ir comigo"): as caixas
# [xmin, xmax, zmin, zmax, topo] no espaço do nó do navio (a água fica em NAV_AGUA), da tabela de shared/dados.js
# VEICULOS.navio.solido: o convés (chão), a amurada dos dois lados (parede, com o vão da escada de corda), proa e
# popa fechadas, os mastros, a roda do leme, a escotilha e a carga empilhada (sobe com os packs). Fora da escada, quem
# nada não sobe (o costado é alto); pela escada: o degrau na água e depois o convés (escalada curta do andar.gd).
var _caixas_navio := {} # packs -> caixas
func caixas_navio(n_packs: int) -> Array:
	var faixa: int = 0 if n_packs <= 0 else 1 if n_packs <= 8 else 2
	if _caixas_navio.has(faixa):
		return _caixas_navio[faixa]
	var S: Dictionary = V.navio.solido
	var D: float = NAV_AGUA + float(S.conves)
	var alto: float = D + float(S.alta)
	var B: Array = S.boca
	var esc: float = float(S.escada)
	var l: Array = []
	for i in range(1, B.size()):
		var za: float = float(B[i - 1][0])
		var zb: float = float(B[i][0])
		var w: float = minf(float(B[i - 1][1]), float(B[i][1]))
		var wm: float = maxf(float(B[i - 1][1]), float(B[i][1]))
		l.append([-wm, wm, za, zb, D]) # convés (a parte mais larga também: a amurada fica por cima)
		for lado in [-1.0, 1.0]:
			var x0: float = w if lado > 0 else -wm - 0.28
			var x1: float = wm + 0.28 if lado > 0 else -w
			if esc > za and esc < zb: # o vão da escada: a amurada abre 0,7 m e fica o degrau na água
				l.append([x0, x1, za, esc - 0.35, alto])
				l.append([x0, x1, esc + 0.35, zb, alto])
				var xd0: float = wm + 0.05 if lado > 0 else -wm - 0.6
				var xd1: float = wm + 0.6 if lado > 0 else -wm - 0.05
				l.append([xd0, xd1, esc - 0.35, esc + 0.35, NAV_AGUA + 0.2])
			else:
				l.append([x0, x1, za, zb, alto])
	var proa: Array = B[B.size() - 1]
	var popa: Array = B[0]
	l.append([-float(proa[1]) - 0.2, float(proa[1]) + 0.2, float(proa[0]), float(proa[0]) + 0.6, alto]) # proa fechada
	l.append([-float(popa[1]) - 0.2, float(popa[1]) + 0.2, float(popa[0]) - 0.25, float(popa[0]), alto]) # espelho de popa
	for zm in [NAV_MASTRO_F, NAV_MASTRO_R]:
		l.append([-0.2, 0.2, zm - 0.2, zm + 0.2, D + 11.0])
	l.append([-0.32, 0.32, NAV_LEME.z - 0.3, NAV_LEME.z + 0.2, D + 1.55]) # roda do leme
	l.append([-0.2, 0.2, NAV_LEME.z + 0.6, NAV_LEME.z + 0.9, D + 0.55]) # bitácula
	l.append([-0.65, 0.65, -3.1, -2.1, D + 0.17]) # escotilha (degrauzinho)
	if faixa > 0: # a carga entre os mastros (1 ou 2 andares de packs)
		var zc: float = (NAV_MASTRO_F + NAV_MASTRO_R) * 0.5 + 0.1
		l.append([-1.2, 1.2, zc - 0.52, zc + 0.54, D + 0.62 * float(faixa)])
	_caixas_navio[faixa] = l
	return l

func _parte(qual: String, n: Node3D, cx: Array) -> Dictionary:
	var T: Transform3D = n.global_transform
	var a: float = atan2(T.basis.z.x, T.basis.z.z)
	return {"qual": qual, "x": T.origin.x, "z": T.origin.z, "y": T.origin.y, "c": cos(a), "s": sin(a), "a": a, "caixas": cx}

func _partes(v: Dictionary) -> Array:
	var cx: Dictionary = caixas(int(v.nv))
	var l: Array = [_parte("trator", v.no, cx.trator)]
	var car: Node3D = v.no.get_node_or_null("carreta")
	if car:
		l.append(_parte("carreta", car, cx.carreta))
	return l

# onde o motorista pisa ao descer: do lado da cabine (o lado com o chão mais baixo, sem parede)
func _lado_livre(x: float, z: float, ry: float) -> Vector2:
	var melhor := Vector2(x, z)
	var hm := INF
	for lx in [-1.15, 1.15, -1.5, 1.5]:
		var lz: float = CARRO_BANCO.z
		var p := Vector2(x + lx * cos(ry) + lz * sin(ry), z - lx * sin(ry) + lz * cos(ry))
		var h: float = m.terreno.altura(p.x, p.y) - m.terreno.altura(x, z)
		if h < hm - 0.05:
			hm = h
			melhor = p
	return melhor

# o herói em pé em cima da peça "qual" vai junto com ela (anda, sobe e gira como a peça)
func _levar(antes: Array, agora: Array, qual: String) -> void:
	var p0 = null
	var p1 = null
	for pt in antes:
		if pt.qual == qual:
			p0 = pt
	for pt in agora:
		if pt.qual == qual:
			p1 = pt
	if p0 == null or p1 == null:
		return
	var dx: float = m.mov.x - p0.x
	var dz: float = m.mov.z - p0.z
	var lx: float = dx * p0.c - dz * p0.s
	var lz: float = dx * p0.s + dz * p0.c
	var nx: float = p1.x + lx * p1.c + lz * p1.s
	var nz: float = p1.z - lx * p1.s + lz * p1.c
	if Vector2(nx - m.mov.x, nz - m.mov.z).length() > 1.0:
		return # o carrinho pulou de lugar (chegou agora na tela): não leva o herói junto
	var d := Vector3(nx - m.mov.x, p1.y - p0.y, nz - m.mov.z)
	m.mov.x = nx
	m.mov.z = nz
	m.mov.y += d.y
	m.mov.ry += angle_difference(p0.a, p1.a)
	m.heroi.position += d # já neste quadro (o main.gd andou o herói antes do carrinho se mexer)

# Carrinho acompanha o chão (André 2026-11-17: "numa descida ele fica com as rodas da frente meio flutuando; queria que
# acompanhasse"): o trator deita para a frente/trás pelo chão embaixo do eixo da frente e do de trás e para o lado pelo
# chão embaixo das rodas da esquerda e da direita; a altura é a da linha entre os eixos (as rodas encostam). Na lombada
# o meio não afunda no chão. Suave (mola curta), e só refaz a conta quando ele se mexe (parado não custa nada).
const CARRO_EIXO_F := 1.0 # z do eixo da frente (rodas pequenas)
const CARRO_EIXO_T := -0.36 # z do eixo de trás (rodas grandes)
const CARRO_BITOLA := 0.56 # meia distância entre as rodas (esquerda/direita)
const CARRO_INCL_MAX := 0.5 # rad (~29°): mais que isso nem estrada de montanha tem
func _chao_xz(no: Node3D, lx: float, lz: float) -> float:
	var s := sin(no.rotation.y)
	var c := cos(no.rotation.y)
	return m.terreno.altura(no.position.x + lx * c + lz * s, no.position.z - lx * s + lz * c)

func _inclinar_carrinho(v: Dictionary, no: Node3D, dt: float) -> void:
	var chave := Vector3(no.position.x, no.rotation.y, no.position.z)
	var alvo: Vector3 = v.get("incl_alvo", Vector3.ZERO) # x = frente (rad), y = altura, z = lado (rad)
	if not v.has("incl_chave") or (v.incl_chave as Vector3).distance_squared_to(chave) > 0.0004:
		v.incl_chave = chave
		var hf: float = (_chao_xz(no, -CARRO_BITOLA, CARRO_EIXO_F) + _chao_xz(no, CARRO_BITOLA, CARRO_EIXO_F)) * 0.5
		var hte: float = _chao_xz(no, -CARRO_BITOLA, CARRO_EIXO_T)
		var htd: float = _chao_xz(no, CARRO_BITOLA, CARRO_EIXO_T)
		var ht: float = (hte + htd) * 0.5
		var entre: float = CARRO_EIXO_F - CARRO_EIXO_T
		var y: float = ht + (hf - ht) * (-CARRO_EIXO_T / entre) # a linha entre os eixos, no z = 0 do trator
		y = maxf(y, no.position.y - 0.12) # lombada: o chassi não entra no chão
		alvo = Vector3(clampf(-atan2(hf - ht, entre), -CARRO_INCL_MAX, CARRO_INCL_MAX), y - no.position.y,
			clampf(atan2(htd - hte, CARRO_BITOLA * 2.0), -CARRO_INCL_MAX, CARRO_INCL_MAX))
		v.incl_alvo = alvo
	var atual: Vector3 = v.get("incl", alvo)
	if (v.get("incl_pos", no.position) as Vector3).distance_to(no.position) > 6.0:
		atual = alvo # chegou agora ou pulou de lugar: já deitado certo
	atual = atual.lerp(alvo, minf(1.0, dt * 10.0))
	v.incl = atual
	v.incl_pos = no.position
	no.rotation.x = atual.x
	no.rotation.z = atual.z
	no.position.y += atual.y
	v.incl_dy = atual.y

# a carreta deita sozinha pelo chão embaixo do eixo dela (presa no engate do trator, que já deitou)
func _inclinar_carreta(v: Dictionary, no: Node3D, car: Node3D, rel: float, dt: float) -> void:
	var L: float = float(no.get_meta("carreta_eixo", 1.0))
	var H: Vector3 = no.global_transform * CARRO_ENGATE
	var eixo: Vector3 = v.get("eixo", H)
	var a: float = no.rotation.y + rel
	var lx := Vector3(cos(a), 0, -sin(a)) * 0.76
	var hl: float = m.terreno.altura(eixo.x - lx.x, eixo.z - lx.z)
	var hr: float = m.terreno.altura(eixo.x + lx.x, eixo.z + lx.z)
	var hA: float = (hl + hr) * 0.5
	# eixo da carreta: 0,07 abaixo e L atrás do engate; a roda (raio 0,45) encosta no chão
	var sobe: float = clampf((hA + 0.45 - H.y + 0.07) / maxf(L, 0.1), -0.9, 0.9)
	var frente: float = asin(sobe) # + = traseira mais alta que o engate: a frente da carreta desce
	var lado: float = atan2(hr - hl, 1.52)
	# já vem deitada do trator: só o que falta
	var cr := cos(rel)
	var sr := sin(rel)
	var alvo := Vector2(clampf(frente - (no.rotation.x * cr - no.rotation.z * sr), -0.6, 0.6), clampf(lado - (no.rotation.z * cr + no.rotation.x * sr), -0.5, 0.5))
	var at: Vector2 = v.get("incl_car", alvo)
	at = at.lerp(alvo, minf(1.0, dt * 10.0))
	v.incl_car = at
	car.rotation.x = at.x
	car.rotation.z = at.y + (-0.1 if v.quebrado else 0.0)

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
		_inclinar_carreta(v, no, car, rel, dt)

# barco na água (2026-11-09, André: "parece que o barco tá voando"): sobe e desce devagar com a ondinha (duas ondas
# misturadas, não um vaivém de relógio), a proa sobe um pouco com a velocidade e dá um tranco a cada remada, e o
# casco deita para fora na curva. No navio tudo bem menor (é pesado).
func _boiar(v: Dictionary, corpo: Node3D, dt: float) -> void:
	var nav: bool = v.tipo == "n"
	var k: float = 0.35 if nav else 1.0
	var t: float = m.tempo
	var fx: float = float(v.x) * 0.37
	var fz: float = float(v.z) * 0.29
	var vel: float = float(v.get("vel", 0.0))
	var rapido: float = clampf(vel / float(V.navio.vel if nav else V.barquinho.vel), 0.0, 1.0)
	v.tranco = lerpf(float(v.get("tranco", 0.0)), float(v.get("empurra", 0.0)), minf(1.0, dt * 5.0))
	var base: float = 0.0 if nav else BARCO_AFUNDA
	corpo.position.y = base + (sin(t * 1.15 + fx) * 0.022 + sin(t * 1.9 + fz) * 0.01) * k
	var inclina: float = clampf(float(v.get("giro", 0.0)), -1.2, 1.2) * rapido * 0.05 # deita para fora da curva
	corpo.rotation.z = (sin(t * 1.3 + fz) * 0.028 + sin(t * 2.3 + fx) * 0.01) * k + inclina * k
	corpo.rotation.x = (sin(t * 0.9 + fx) * 0.018) * k - rapido * 0.035 * k - float(v.tranco) * 0.025 * k

# rastro na água atrás do barco e do navio (2026-11-09, André: "o barquinho na água precisava fazer um rastro"):
# uma fita colada na água pelo caminho que a popa fez (pontos a cada ~0,3 m, vivem RASTRO_VIDA s), que abre em V
# como esteira de verdade (~20° de cada lado) com espuma nas bordas e a água mexida no meio sumindo. Mais a espuma
# da proa e em volta do casco na linha d'água (agua_fx.gdshader modo 2), mais forte com a velocidade.
const RASTRO_VIDA := 4.5
var _mt_rastro: ShaderMaterial
func _rastro(v: Dictionary, no: Node3D, dt: float) -> void:
	var nav: bool = v.tipo == "n"
	var fita: MeshInstance3D = v.get("fita")
	if fita == null or not is_instance_valid(fita):
		if _mt_rastro == null:
			_mt_rastro = ShaderMaterial.new()
			_mt_rastro.shader = load("res://rastro_barco.gdshader")
			_mt_rastro.render_priority = 1 # depois da água
		fita = MeshInstance3D.new()
		fita.name = "rastro"
		fita.top_level = true
		fita.mesh = ImmediateMesh.new()
		fita.material_override = _mt_rastro
		fita.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		fita.extra_cull_margin = 60.0
		no.add_child(fita)
		v.fita = fita
		v.pontos = []
		# espuma em volta do casco
		var col := MeshInstance3D.new()
		col.name = "espuma_casco"
		var q := PlaneMesh.new()
		q.size = Vector2(NAV_W * 2.0 + 0.3, NAV_L * 2.0 + 0.4) if nav else Vector2(1.45, 3.15)
		col.mesh = q
		var mc := ShaderMaterial.new()
		mc.shader = load("res://agua_fx.gdshader")
		mc.set_shader_parameter("modo", 2)
		mc.set_shader_parameter("alfa", 0.0)
		mc.set_shader_parameter("faixa", 0.35 if nav else 0.14)
		mc.set_shader_parameter("meio", 2.0 if nav else 0.8)
		mc.render_priority = 1
		col.material_override = mc
		col.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		col.position = Vector3(0, (0.25 if nav else 0.0) + 0.012, 0) # o navio fica 0,25 m abaixo do nível
		no.add_child(col)
		v.espuma_casco = mc
	var vel: float = float(v.get("vel", 0.0))
	var rapido: float = clampf(vel / float(V.navio.vel if nav else V.barquinho.vel), 0.0, 1.0)
	(v.espuma_casco as ShaderMaterial).set_shader_parameter("alfa", 0.12 + rapido * 0.4)
	(v.espuma_casco as ShaderMaterial).set_shader_parameter("forca", 1.0)
	var agora: float = m.tempo
	var frente := Vector3(sin(no.rotation.y), 0, cos(no.rotation.y))
	var popa: Vector3 = no.global_position - frente * ((NAV_L if nav else BARCO_L) * 0.92)
	popa.y = float(m.terreno.agua.nivel) + 0.015
	var pts: Array = v.pontos
	if pts.is_empty() or (pts[pts.size() - 1][0] as Vector3).distance_to(popa) > (0.6 if nav else 0.3):
		if pts.size() > 0 and (pts[pts.size() - 1][0] as Vector3).distance_to(popa) > 6.0:
			pts.clear() # pulou de lugar (entrou agora): não liga os pontos
		pts.append([popa, frente, agora, rapido])
	while pts.size() > 0 and agora - float(pts[0][2]) > RASTRO_VIDA:
		pts.pop_front()
	var im: ImmediateMesh = fita.mesh
	im.clear_surfaces()
	if pts.size() < 2 and rapido < 0.05:
		return
	# a ponta da fita fica sempre colada na popa (o último ponto pode estar até 0,3 m para trás)
	var lista: Array = pts.duplicate()
	lista.append([popa, frente, agora, rapido])
	var w0: float = 1.1 if nav else 0.32 # meia largura na popa
	im.surface_begin(Mesh.PRIMITIVE_TRIANGLE_STRIP)
	for i in range(lista.size() - 1, -1, -1):
		var p: Array = lista[i]
		var idade: float = (agora - float(p[2])) / RASTRO_VIDA
		var f: Vector3 = p[1]
		var lado := Vector3(f.z, 0, -f.x)
		var longe: float = (popa as Vector3).distance_to(p[0]) # o V abre com a distância andada (~20° de cada lado)
		var hw: float = w0 + minf(longe * 0.36, (6.0 if nav else 2.6)) + idade * 0.4
		var forca: float = float(p[3])
		im.surface_set_color(Color(1, 1, 1, forca))
		im.surface_set_uv(Vector2(0.0, idade))
		im.surface_add_vertex((p[0] as Vector3) - lado * hw)
		im.surface_set_color(Color(1, 1, 1, forca))
		im.surface_set_uv(Vector2(1.0, idade))
		im.surface_add_vertex((p[0] as Vector3) + lado * hw)
	im.surface_end()

# remada do barquinho (2026-11-09, André: "a remada não tá legal"): dois remos nos toletes, remando de frente
# (empurrando). Uma volta (fase 0..1): pega (as pás entram na água, em pé), empurrada (as pás varrem para trás e o barco
# ganha velocidade, o tronco vai para a frente), solta (as pás saem pingando) e volta (as pás deitadas passam por cima
# da água para a frente). Na curva o remo de dentro varre menos (o barco vira para o lado dele). Parado: os remos
# atravessados, pás fora da água. "empurra" (0..1) vai para o andar.gd: o barco ganha velocidade só com as pás na água.
const REMO_AGUA := 0.45 # parte da volta com as pás na água
func _remar(v: Dictionary, corpo: Node3D, dt: float) -> void:
	var remos := [corpo.get_node_or_null("remo_d"), corpo.get_node_or_null("remo_e")]
	if remos[0] == null or remos[1] == null:
		return
	var meu: bool = v.eu and m.mov.veiculo.get("k", "") == "barquinho"
	var anda: float = absf(float(m.mov.veiculo.get("v", 0.0))) if meu else float(v.get("vel", 0.0))
	var vira: float = clampf(float(v.get("giro", 0.0)) / 0.9, -1.0, 1.0)
	var quer: bool = v.dirigindo and (anda > 0.25 or absf(vira) > 0.3 or (meu and float(m.mov.veiculo.get("quer", 0.0)) > 0.1))
	v.rema = move_toward(float(v.get("rema", 0.0)), 1.0 if quer else 0.0, dt * 2.0)
	var fase: float = float(v.get("fase", 0.0))
	var rapido: float = clampf(anda / float(V.barquinho.vel), 0.0, 1.0)
	var antes := fase
	if float(v.rema) > 0.05 or fase > 0.0:
		fase += dt * (0.6 + 0.35 * rapido)
		if fase >= 1.0:
			fase = fase - 1.0 if float(v.rema) > 0.05 else 0.0 # parando: termina a volta e fica
	v.fase = fase
	var w: float = smoothstep(0.0, 1.0, float(v.rema))
	# na água: entra rápido na pega, sai na solta
	var na_agua: float = smoothstep(0.0, 0.07, fase) * (1.0 - smoothstep(REMO_AGUA - 0.06, REMO_AGUA + 0.04, fase))
	var varre := 0.0 # 0 = pá na frente, 1 = pá atrás
	if fase < REMO_AGUA:
		varre = smoothstep(0.0, 1.0, fase / REMO_AGUA)
	else:
		varre = 1.0 - smoothstep(0.0, 1.0, (fase - REMO_AGUA) / (1.0 - REMO_AGUA))
	v.empurra = na_agua * w
	if meu:
		m.mov.veiculo["empurra"] = v.empurra # o andar.gd só acelera com as pás na água
	var yw: float = -corpo.position.y # a linha d'água no "corpo" (o balanço mexe junto)
	var maos := [Vector3.ZERO, Vector3.ZERO] # [lado +x, lado -x] do barco
	for i in 2:
		var lado: float = 1.0 if i == 0 else -1.0
		var remo: Node3D = remos[i]
		var pino := Vector3(lado * REMO_PINO.x, REMO_PINO.y, REMO_PINO.z)
		# curva para o lado +x (vira > 0): o remo de +x varre pouco e o de -x varre tudo
		var forca: float = 1.0 - clampf(vira * lado, 0.0, 1.0) * 0.85
		var al: float = lerpf(0.55, -0.5, varre) * forca + (1.0 - forca) * 0.05 # ângulo da varrida (rad, + = pá na frente)
		# pá na água: a ponta afunda ~8 cm; na volta passa ~15 cm acima da água
		var queda_agua: float = REMO_PINO.y - (yw - 0.08)
		var queda_ar: float = REMO_PINO.y - (yw + 0.15)
		var be: float = asin(clampf(lerpf(queda_ar, queda_agua, na_agua) / (REMO_FORA - 0.12), -0.9, 0.9))
		var gira: float = lerpf(0.0, PI / 2, smoothstep(0.0, 1.0, na_agua * 1.3)) # pá em pé na água, deitada no ar
		# parado: os remos atravessados, perpendiculares ao barco, as pás um palmo fora da água
		var al0 := 0.0
		var be0: float = asin(clampf((REMO_PINO.y - (yw + 0.1)) / (REMO_FORA - 0.12), -0.9, 0.9))
		al = lerpf(al0, al, w)
		be = lerpf(be0, be, w)
		gira = lerpf(0.0, gira, w)
		var d := Vector3(lado * cos(al) * cos(be), -sin(be), sin(al) * cos(be)) # do tolete para a pá
		var e := d * lado # o eixo +X do remo
		var y := (Vector3.UP - e * e.y).normalized()
		var bs := Basis(e, y, e.cross(y)) * Basis(Vector3.RIGHT, gira * lado)
		remo.transform = Transform3D(bs, pino)
		maos[i] = pino - d * (REMO_DENTRO - 0.04)
		# respingo: a pá entrando (pega) e pingando ao sair (solta); só perto da câmera
		if w > 0.5 and m.fx and m.fx.has_method("part") and corpo.global_position.distance_to(m.camera.global_position if "camera" in m and m.camera else corpo.global_position) < 40.0:
			var pa: Node3D = remo.get_node_or_null("pa")
			if pa:
				var gp: Vector3 = pa.global_position
				var agua_y: float = float(m.terreno.agua.nivel)
				if antes < 0.03 and fase >= 0.03: # pega
					for k in 5:
						m.fx.part(m.fx.FUMA, gp.x, agua_y + 0.02, gp.z, randf_range(-0.5, 0.5), randf_range(0.8, 1.6), randf_range(-0.5, 0.5),
							randf_range(0.35, 0.55), 0.05, 0.02, "f2f8fa", "d8ecf0", 0.75, -6.5, 0.4)
				elif antes < REMO_AGUA and fase >= REMO_AGUA: # solta: a pá sai levantando água
					for k in 7:
						m.fx.part(m.fx.FUMA, gp.x + randf_range(-0.12, 0.12), agua_y + 0.06, gp.z + randf_range(-0.12, 0.12), randf_range(-0.3, 0.3), randf_range(0.6, 1.4), randf_range(-0.6, -0.1),
							randf_range(0.4, 0.6), 0.04, 0.02, "f2f8fa", "d8ecf0", 0.7, -6.5, 0.3)
				if fase > 0.05 and fase < REMO_AGUA and anda > 0.4: # redemoinho da pá na água
					v.poca_t = float(v.get("poca_t", 0.0)) - dt
					if float(v.poca_t) <= 0.0:
						v.poca_t = 0.12
						m.fx.part(m.fx.FUMA, gp.x, agua_y + 0.015, gp.z, 0.0, 0.0, 0.0, 0.9, 0.12, 0.4, "eaf4f6", "cfe6ea", 0.35, 0.0, 0.0)
	v.maos = maos
	# tronco: vai para a frente empurrando e volta; na curva gira um pouco para o remo que trabalha
	var corpo_vai: float = varre if fase < REMO_AGUA else varre
	v.deita = 0.05 + w * (0.06 + 0.2 * corpo_vai)
	v.torce = w * vira * -0.12

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
			else:
				_armas_outro(id, false)
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
			else:
				_armas_outro(id, true)
		_alvos_sentado(poses[id].pose, sentados[id])

# outro jogador sentou ou levantou: online.gd arruma as armas de novo (sentado, as duas nas costas; André 2026-11-13:
# "a arma que está na minha mão tem que sair da minha mão e ir para minhas costas")
func _armas_outro(id: String, sentado: bool) -> void:
	if m.online and m.online.outros.has(id):
		var o: Dictionary = m.online.outros[id]
		o.sentado = sentado
		o.modo = "" # o próximo pacote dele arma de novo (online.gd)

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
			var peito: Vector3 = (esq as Skeleton3D).get_bone_global_pose(i).origin
			# sentado no barquinho ou no carrinho (André 2026-11-21: "muito alto qd sentado no barquinho"): a pose de fora
			# é a da animação em pé; vale o peito já sentado que o sentar.gd guardou
			var ps = poses.get(id)
			if ps is Dictionary and ps.get("esq") == esq and is_instance_valid(ps.get("pose")) and ps.pose.peito_ok:
				peito = ps.pose.peito_final
			base = (esq as Skeleton3D).global_transform * peito - Vector3(0, 0.38, 0)
	no.position = base + Vector3(-sin(ry) * atras, 0, -cos(ry) * atras)
	no.rotation.y = ry

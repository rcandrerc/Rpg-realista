extends Node
# Qualidade gráfica (André 2026-11-09: no Galaxy Note 10 Lite da filha, Exynos 9810 / Mali-G72, o jogo roda muito mal).
# Configurações > Qualidade gráfica: Baixa, Média ou Alta. Alta é exatamente o jogo de hoje (o Poco X7 continua igual);
# Média e Baixa tiram peso da placa de vídeo:
# - resolução 3D menor (a interface continua nítida, só o mundo 3D é desenhado em menos pontos);
# - sombra mais curta (Média) ou desligada (Baixa); suavização (MSAA) desligada na Baixa;
# - alcance da vista menor: tudo que tem distância para sumir (árvores, casas, pedras, monstros, mato, o chão longe)
#   some mais perto, com a névoa um pouco mais fechada para não aparecer o corte;
# - grama: menos folhas e só perto;
# - água do mar, lagos e rios mais simples (agua.gdshader e rio.gdshader, uniform "simples");
# - Baixa trava em 30 quadros por segundo (estável e o celular esquenta menos).
# Na primeira vez que o jogo abre, escolhe sozinho pela placa de vídeo do aparelho (Mali-G72 do Note 10 Lite: Baixa;
# Mali-G720 do Poco X7: Alta). Depois vale o que o jogador escolher (fica em user://config.cfg, junto do som).

const ARQUIVO := "user://config.cfg"
const BAIXA := 0
const MEDIA := 1
const ALTA := 2
const NOMES := ["Baixa", "Média", "Alta"]
const PRESETS := [
	{"escala": 0.45, "sombra": false, "sombra_dist": 0.0, "atlas": 1024, "suave": RenderingServer.SHADOW_QUALITY_HARD,
		"msaa": Viewport.MSAA_DISABLED, "alcance": 0.55, "grama": 0.45, "grama_qtd": 0.5, "nevoa": 1.6,
		"fps": 30, "agua_simples": true, "lod": 4.0},
	{"escala": 0.52, "sombra": true, "sombra_dist": 15.0, "atlas": 1024, "suave": RenderingServer.SHADOW_QUALITY_SOFT_VERY_LOW,
		"msaa": Viewport.MSAA_2X, "alcance": 0.78, "grama": 0.75, "grama_qtd": 0.75, "nevoa": 1.25,
		"fps": 0, "agua_simples": false, "lod": 2.0},
	# Alta = os números de hoje (main.gd RESOLUCAO_PADRAO e montar_ambiente, project.godot)
	{"escala": 0.6, "sombra": true, "sombra_dist": 20.0, "atlas": 2048, "suave": RenderingServer.SHADOW_QUALITY_SOFT_LOW,
		"msaa": Viewport.MSAA_2X, "alcance": 1.0, "grama": 1.0, "grama_qtd": 1.0, "nevoa": 1.0,
		"fps": 0, "agua_simples": false, "lod": 1.0},
]
const ENCOLHE_DE := 65.0 # grama.gdshader: a folha encolhe de 65 a 75 m (aqui vezes o fator da grama)
const ENCOLHE_ATE := 75.0

var m # main.gd
var nivel := ALTA
var sugerido := ALTA # o que a detecção do aparelho escolheria (mostrado nas Configurações)
var placa := "" # nome da placa de vídeo (ex.: "Mali-G72")
var P: Dictionary = PRESETS[ALTA]
var _pend: Array = []
var _agendado := false
var _mats_agua := {} # materiais de água achados (para ligar e desligar o "simples")
var _mats_grama := {}

func _init(jogo) -> void:
	m = jogo
	name = "Grafico"
	placa = RenderingServer.get_video_adapter_name()
	sugerido = detectar(placa, OS.get_model_name())
	var cfg := ConfigFile.new()
	var tem := cfg.load(ARQUIVO) == OK and cfg.has_section_key("config", "grafico")
	nivel = clampi(int(cfg.get_value("config", "grafico", sugerido)) if tem else sugerido, BAIXA, ALTA)
	if not tem: # primeira vez: guarda a escolha automática (o jogador troca quando quiser)
		cfg.set_value("config", "grafico", nivel)
		cfg.save(ARQUIVO)
	P = PRESETS[nivel]

func _enter_tree() -> void:
	# tudo que entra na cena depois (pedaços do mapa, monstros, casas) recebe o alcance do nível escolhido
	get_tree().node_added.connect(_entrou)

# Escolha automática pela placa de vídeo. Mali: G31/G51/G52/G71/G72 e T* = Baixa; G57/G68/G76 = Média; G77/G78 e
# as novas (G610 em diante, G710/G720...) = Alta (G310 = Baixa, G510/G610/G615 = Média). Adreno: abaixo de 610 = Baixa,
# 610 a 629 = Média, 630 a 699 = Alta, 700 a 729 = Média, 730 em diante = Alta. PowerVR = Baixa. Xclipse = Alta.
# Placa desconhecida: Média (o jogador sobe para Alta se quiser).
static func detectar(nome_placa: String, _modelo := "") -> int:
	var n := nome_placa.to_lower()
	if n.contains("xclipse"):
		return ALTA
	if n.contains("powervr") or n.contains("mali-t") or n.contains("mali-4"):
		return BAIXA
	var r := RegEx.new()
	r.compile("mali-g(\\d+)")
	var a := r.search(n)
	if a:
		var g := int(a.get_string(1))
		if g < 100:
			if g in [57, 68, 76]:
				return MEDIA
			return ALTA if g >= 77 else BAIXA
		if g < 500:
			return BAIXA
		return MEDIA if g < 700 else ALTA
	r.compile("adreno[^0-9]*(\\d+)")
	a = r.search(n)
	if a:
		var q := int(a.get_string(1))
		if q < 610:
			return BAIXA
		if q < 630 or (q >= 700 and q < 730):
			return MEDIA
		return ALTA
	if OS.get_name() != "Android" and OS.get_name() != "iOS":
		return ALTA # PC (a versão de PC tem o modo leve dela, F9)
	return MEDIA

func trocar(n: int) -> void:
	nivel = clampi(n, BAIXA, ALTA)
	P = PRESETS[nivel]
	var cfg := ConfigFile.new()
	cfg.load(ARQUIVO)
	cfg.set_value("config", "grafico", nivel)
	cfg.save(ARQUIVO)
	aplicar()

# aplica tudo: tela, sombra, névoa e o alcance de tudo que já está na cena
func aplicar() -> void:
	var vp: Viewport = m.get_viewport()
	vp.scaling_3d_scale = P.escala
	vp.msaa_3d = P.msaa
	vp.mesh_lod_threshold = P.lod
	Engine.max_fps = P.fps
	RenderingServer.directional_shadow_atlas_set_size(P.atlas, true)
	RenderingServer.directional_soft_shadow_filter_set_quality(P.suave)
	if m.sol:
		m.sol.shadow_enabled = P.sombra
		if P.sombra:
			m.sol.directional_shadow_max_distance = P.sombra_dist
	if m.relevo: # relevo.gd mexe na névoa e no fim da câmera todo quadro (vista do alto da montanha)
		m.relevo.nevoa_mult = P.nevoa
		m.relevo.longe_mult = lerpf(P.alcance, 1.0, 0.25) # a câmera enxerga um pouco além do que some (a névoa apaga)
	_pend = m.get_tree().root.find_children("*", "GeometryInstance3D", true, false)
	_ajustar_pendentes()

func _entrou(no: Node) -> void:
	if no is GeometryInstance3D:
		_pend.append(no)
		if not _agendado:
			_agendado = true
			_ajustar_pendentes.call_deferred()

func _ajustar_pendentes() -> void:
	_agendado = false
	var lista := _pend
	_pend = []
	for g in lista:
		if is_instance_valid(g) and g.is_inside_tree():
			_ajustar(g)
	for mat in _mats_agua:
		mat.set_shader_parameter("simples", P.agua_simples)
	for mat in _mats_grama:
		mat.set_shader_parameter("encolhe_de", ENCOLHE_DE * P.grama * 0.9)
		mat.set_shader_parameter("encolhe_ate", ENCOLHE_ATE * P.grama * 0.9)

func _ajustar(g: GeometryInstance3D) -> void:
	var grama := false
	for mat in _materiais(g):
		var caminho: String = mat.shader.resource_path if mat.shader else ""
		if caminho.ends_with("/agua.gdshader") or caminho.ends_with("/rio.gdshader"):
			_mats_agua[mat] = true
		elif caminho.ends_with("/grama.gdshader"):
			_mats_grama[mat] = true
			grama = true
	var f: float = P.grama if grama else P.alcance
	# alcance (visibility range): guardo o original na primeira vez; se o jogo mudou o valor depois que eu ajustei,
	# o valor novo do jogo vira o original
	var b: Array = g.get_meta("_alcance", [])
	if not b.is_empty() and (not is_equal_approx(g.visibility_range_end, b[4]) or not is_equal_approx(g.visibility_range_begin, b[5])):
		b = []
	if b.is_empty():
		if f == 1.0 and not grama:
			return # Alta: nada muda
		b = [g.visibility_range_begin, g.visibility_range_end, g.visibility_range_begin_margin, g.visibility_range_end_margin, 0.0, 0.0]
	g.visibility_range_begin = b[0] * f
	g.visibility_range_end = b[1] * f
	g.visibility_range_begin_margin = b[2] * f
	g.visibility_range_end_margin = b[3] * f
	b[4] = g.visibility_range_end
	b[5] = g.visibility_range_begin
	g.set_meta("_alcance", b)
	if grama and g is MultiMeshInstance3D and g.multimesh:
		# menos folhas: as folhas de cada pedaço foram sorteadas em ordem aleatória, então as primeiras N cobrem o
		# pedaço inteiro (só mais ralo). O pedaço que não desenha nada (visible_instance_count 0) continua assim.
		var mm: MultiMesh = g.multimesh
		var q0: int = g.get_meta("_qtd", mm.visible_instance_count)
		g.set_meta("_qtd", q0)
		if q0 != 0:
			var total: int = mm.instance_count if q0 < 0 else mini(q0, mm.instance_count)
			mm.visible_instance_count = q0 if P.grama_qtd >= 1.0 else int(total * P.grama_qtd)

func _materiais(g: GeometryInstance3D) -> Array:
	var r: Array = []
	if g.material_override is ShaderMaterial:
		r.append(g.material_override)
	var malha: Mesh = null
	if g is MeshInstance3D:
		malha = g.mesh
		for i in g.get_surface_override_material_count():
			var o: Material = g.get_surface_override_material(i)
			if o is ShaderMaterial:
				r.append(o)
	elif g is MultiMeshInstance3D and g.multimesh:
		malha = g.multimesh.mesh
	if malha:
		for i in malha.get_surface_count():
			var s := malha.surface_get_material(i)
			if s is ShaderMaterial:
				r.append(s)
	return r

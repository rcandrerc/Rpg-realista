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
# 2026-11-04 (André: "não consigo criar nada"): a casa inteira do Quimera. Cada peça é criada antes (botão Criar,
# vira o item obra_* na mochila; parede, porta, janela, telhado e móveis pedem uma bancada perto) e depois colocada.
# Abas Casa (fundação, parede, porta, janela, telhado), Móveis (bancada, bigorna, fornalha, cerca, baú, cama, tocha)
# e Fazenda (enxada e regador também se criam aqui). Casa numa grade de 2 m: fundação no quadrado (dá para andar em
# cima), parede/porta/janela na borda, telhado em cima; os telhados vizinhos viram um telhado só, inclinado, que some
# quando o herói entra. Baú guarda 40 pilhas (todos os seus baús são o mesmo), cama é onde você volta ao morrer.
# Modelos da casa: Quaternius Medieval Village MegaKit (CC0); o telhado é montado aqui com a telha T_RoundTiles.

const Menu = preload("res://menu.gd")
const Andar = preload("res://andar.gd")
const FazendaPlano = preload("res://fazenda_plano.gd")
var plano # fazenda_plano.gd: marcar os canteiros e o herói faz tudo depois do Salvar (André 2026-11-07)
var b_salvar: Button
var b_limpar: Button

var m # main.gd
var D: Dictionary # m.P.dados
var lotes := {} # id -> {def: {id, x0, z0, x1, z1}, dono (nome ou null), pecas: [{id, k, x, z, r, no}], horta: {"i,j": {c, g, w, u, no, fase, molhada}}, raiz}
var meu := "" # id do meu terreno ("" = não tenho)
var relogio := 0.0 # ms do servidor menos ms deste celular (a horta cresce igual nos dois)
var _modelos := {} # k -> Node3D modelo (escondido) para duplicar
var _mats := {}
var _t_horta := 0.0
var _pisos: Array = [] # fundações que viraram chão no terreno.gd (o herói anda em cima)
var _portas: Array = [] # folhas das portas (abrem quando o herói chega perto)
var _mat_telha: StandardMaterial3D
var _mat_forro: StandardMaterial3D
var _mat_reboco: StandardMaterial3D
var _mat_viga: StandardMaterial3D
var terras: Dictionary # mundo.vilaLotes: area (elipse), estradas [{largura, pontos}]

# modo construção
var ativo := false
var aba := "casa" # "casa", "moveis", "fazenda" ou "terreno" (as duas primeiras são de construir; terreno = mudar e vender)
var sel := "fundacao" # peça (CONSTRUCOES), "desmontar" ou ação da fazenda ("arar", "plantar", "regar", "colher", "tirar")
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
# expansão mais leve e clara (André 2026-11-06: "quase trava" ao abrir e "não entendi como expandir"):
# - a altura do chão de cada ponto da grade fica guardada (_alt): antes cada quadro repintava o terreno marcado
#   chamando terreno.altura ~7 mil vezes (cada uma passa por todas as peças construídas), o celular ia a poucos FPS;
# - a tela só se refaz quando o retângulo, o ouro ou os terrenos mudam (_chave_compra);
# - alças no chão: + e - no meio de cada lado (um toque cresce ou encolhe 1 m) e os cantos dourados (arrastar);
# - toque fora das alças é da câmera de novo (girar e pinça), o joystick continua andando com a câmera.
var _alt := {} # Vector2i -> altura do chão + 5 cm (pintura no chão; zera ao abrir a tela)
var _chave_compra := ""
var _alcas: Array = [] # [{no, tipo: "canto"/"mais"/"menos", lado}]
var _mudar_ini := {} # o tamanho de quando abriu a tela de mudar (botão Marcar de novo / Desfazer)
var mudando := false # a mesma tela da compra, para mudar o tamanho do meu terreno (arrasta um canto)
var _correios := {} # id do terreno -> Node3D da caixa de correio (com a bandeirinha)
var _avisou_conta := false

# tela
var tela: CanvasLayer
var painel: PanelContainer # barra de itens embaixo (modo construção)
var linha_abas: HBoxContainer
var painel_acoes: PanelContainer # botões grandes à direita (Colocar, Criar, Girar, Sair)
# andares do modo construção (André 2026-11-05: "quando eu estiver no térreo, só consiga mexer no térreo"):
# "terreo" (fundação, paredes, móveis) ou "telhado" (o último andar). Desmontar e colocar só pegam o andar escolhido;
# no térreo o telhado do meu terreno some para ver dentro. Quando houver andar de cima, ele entra entre os dois.
var andar := "terreo"
var linha_andares: HBoxContainer
var _botoes_andar := {}
const ANDARES := [["terreo", "Térreo"], ["telhado", "Telhado"]]
# criar com quantidade e barrinha (André 2026-11-05)
var painel_qtd: PanelContainer # janela: quantas criar
var txt_qtd_tit: Label
var txt_qtd_custo: Label
var txt_qtd_n: Label
var b_qtd_ok: Button
var qtd := 1
var _qtd_k := ""
var _qtd_tipo := "obra" # "obra" (peça/ferramenta: fabricar) ou "receita" (Ferreiro/Alfaiate: criar)
var tela_criar: CanvasLayer # janela e barrinha por cima do menu (a aba Criar da mochila e a mesa também usam)
var painel_fab: PanelContainer # "Criando Fundação 2/6" com a barrinha carregando
var txt_fab: Label
var barra_fab: ProgressBar
var _fab := {} # {k, n, feito, dur, ini (s deste celular), fim (s em que some)}
var linha_itens: HBoxContainer
var b_girar: Button
var b_criar: Button
var b_ok: Button
var b_sair: Button
var txt_motivo: Label
var txt_nome: Label
var _botoes_abas := {}
var painel_compra: PanelContainer
var b_recomecar: Button
var txt_compra: Label
var txt_compra_info: Label
var b_comprar: Button
var txt_compra_tit: Label
# baú
var painel_bau: PanelContainer
var grade_bau: GridContainer
var grade_mochila: GridContainer
var txt_bau: Label
var bau_itens: Array = []
var rolar_bau: Array = [] # as duas listas (baú e mochila): rolam arrastando o dedo em cima dos itens
var _bau_dentro: ScrollContainer = null
var _bau_soma := 0.0
var _bau_arrastou := false # arrastou a lista: o item embaixo do dedo não vale
# fornalha do meu terreno (2026-11-07): combustível + material, queima sozinha no servidor
var painel_forno: PanelContainer
var forno_id := ""
var forno: Dictionary = {}
var forno_t := 0.0 # segundos desde que o servidor mandou (as barrinhas andam sozinhas até a próxima conta)
var forno_pediu := 0.0
var forno_alvo := "ent" # onde vai a lenha quando toca nela na mochila: combustível ou material (vira carvão)
var caixa_forno: VBoxContainer
var barra_fogo: ProgressBar
var barra_forno: ProgressBar
var txt_forno: Label
var grade_forno: GridContainer

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
	plano = FazendaPlano.new(self)
	add_child(plano)
	_montar_tela()
	# botões da HUD: comprar terreno (nas terras, sem terreno), construir (no meu terreno) e a estação perto (Alfaiate/Ferreiro)
	m.hud._botao("construir", Vector2(597, 160), 30, "construir", m.hud.COR_TROCA)
	m.hud.botoes[-1].oculto = true
	m.hud._botao("lote", Vector2(597, 160), 30, "terreno", m.hud.COR_TROCA)
	m.hud.botoes[-1].oculto = true
	m.hud._botao("bancada", Vector2(333, 160), 30, "pf_alf", m.hud.COR_TROCA)
	m.hud.botoes[-1].oculto = true
	m.hud._botao("bau", Vector2(333, 250), 30, "cs_bau", m.hud.COR_TROCA) # perto do meu baú: abre o baú
	m.hud.botoes[-1].oculto = true
	m.hud._botao("forno", Vector2(333, 340), 30, "cs_fornalha", m.hud.COR_TROCA) # 2026-11-07: a minha fornalha
	m.hud.botoes[-1].oculto = true
	m.hud._botao("encher", Vector2(509, 250), 30, "cs_regar", m.hud.COR_TROCA) # perto do poço da vila ou na beira do lago: encher o regador
	m.hud._botao("cama", Vector2(423, 250), 30, "cs_cama", m.hud.COR_TROCA) # à noite, perto da minha cama: dormir (Quimera)
	m.hud.botoes[-1].oculto = true
	m.hud._botao("correio", Vector2(333, 160), 30, "correio", m.hud.COR_TROCA) # perto da minha caixa de correio: a conta do terreno
	m.hud.botoes[-1].oculto = true

# ---------- modelos ----------
func _carregar_modelos() -> void:
	_modelos["bancada"] = _modelo_gltf("res://construcao3d/Workbench.gltf", 1.0)
	_modelos["bigorna"] = _modelo_gltf("res://construcao3d/Anvil_Log.gltf", 1.1)
	_modelos["cerca"] = _modelo_gltf("res://construcao3d/Prop_WoodenFence_Single.gltf", 0.97)
	_modelos["fornalha"] = _modelo_fornalha()
	_modelos["fogao"] = _modelo_fogao()
	# casa: o modelo da parede vai de z -0,31 a 0,09; +0,11 põe o meio da parede na linha da grade
	var meio := Vector3(0, 0, 0.11)
	_modelos["parede"] = _modelo_gltf("res://construcao3d/Wall_Plaster_Straight.gltf", 1.0, meio)
	_modelos["porta"] = _modelo_gltf("res://construcao3d/Wall_Plaster_Door_Flat.gltf", 1.0, meio,
		[["res://construcao3d/Door_1_Flat.gltf", Vector3(-0.53, 0, 0.0), "folha"]])
	_modelos["janela"] = _modelo_gltf("res://construcao3d/Wall_Plaster_Window_Wide_Flat.gltf", 1.0, meio,
		[["res://construcao3d/Window_Wide_Flat1.gltf", meio, ""]])
	for k in ["parede", "porta", "janela"]: # juntas (André 2026-11-05): pilar de madeira nas duas pontas fecha o canto
		_pilares(_modelos[k])
	_modelos["fundacao"] = _modelo_fundacao()
	_modelos["telhado"] = _modelo_telhado_um()
	_modelos["bau"] = _modelo_gltf("res://construcao3d/Chest_Wood.gltf", 1.0)
	_modelos["cama"] = _modelo_gltf("res://construcao3d/Bed_Twin1.gltf", 1.0)
	_modelos["tocha"] = _modelo_tocha()
	for k in _modelos:
		juntar_malhas(_modelos[k]) # FPS (2026-11-07): a peça vira 1 ou 2 malhas, com o mesmo visual
		_alcance_peca(_modelos[k], k)
		_modelos[k].visible = false
		add_child(_modelos[k])

# FPS na construção (André 2026-11-07: "perdas muito grandes de FPS na vila e na hora da construção"): cada peça era um
# monte de malhas soltas (a fornalha tinha 17 caixas, a tocha 11, cada parede do kit várias), e cada malha é uma chamada
# de desenho a mais, e outra na sombra. Aqui as malhas paradas da peça viram uma malha só, com uma parte por material:
# o desenho é o mesmo (mesmos vértices, mesmos materiais), só que em bem menos chamadas. O que mexe sozinho fica solto:
# a folha da porta (abre), os pilares (escala por giro), a chama da tocha (sem sombra) e o que tiver nome em MANTER.
const MANTER := ["folha", "pilares", "chama", "bandeira"]
static func juntar_malhas(raiz: Node3D) -> void:
	var grupos := {} # sombra -> {material id -> [material, SurfaceTool]}
	var feitos := []
	for mi: MeshInstance3D in raiz.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null or mi.skin != null or not mi.visible or _dentro_de_manter(mi, raiz):
			continue
		# posição da malha em relação à raiz da peça (a raiz ainda está fora da árvore: soma os pais na mão)
		var t := mi.transform
		var p := mi.get_parent()
		var escondido := false
		while p != null and p != raiz:
			if p is Node3D:
				escondido = escondido or not (p as Node3D).visible
				t = (p as Node3D).transform * t
			p = p.get_parent()
		if escondido or p == null:
			continue # algum pai escondido: fica como está
		var sombra: int = mi.cast_shadow
		if not grupos.has(sombra):
			grupos[sombra] = {}
		for i in mi.mesh.get_surface_count():
			if mi.mesh is ArrayMesh and (mi.mesh as ArrayMesh).surface_get_primitive_type(i) != Mesh.PRIMITIVE_TRIANGLES:
				continue
			var mat: Material = mi.material_override
			if mat == null:
				mat = mi.get_surface_override_material(i)
			if mat == null:
				mat = mi.mesh.surface_get_material(i)
			var chave := mat.get_instance_id() if mat else 0
			if not grupos[sombra].has(chave):
				var st := SurfaceTool.new()
				st.begin(Mesh.PRIMITIVE_TRIANGLES)
				grupos[sombra][chave] = [mat, st]
			(grupos[sombra][chave][1] as SurfaceTool).append_from(mi.mesh, i, t)
		feitos.append(mi)
	if feitos.size() < 2:
		return # nada a ganhar
	for sombra in grupos:
		var am := ArrayMesh.new()
		for chave in grupos[sombra]:
			var g: Array = grupos[sombra][chave]
			(g[1] as SurfaceTool).commit(am)
			am.surface_set_material(am.get_surface_count() - 1, g[0])
		if am.get_surface_count() == 0:
			continue
		var junto := MeshInstance3D.new()
		junto.name = "junto_%d" % sombra
		junto.mesh = am
		junto.cast_shadow = sombra
		raiz.add_child(junto)
	for mi: MeshInstance3D in feitos:
		if mi.get_child_count() == 0:
			mi.get_parent().remove_child(mi)
			mi.free()
		else:
			mi.mesh = null # tem filho (luz, outra malha solta): o nó fica, só não desenha mais

static func _dentro_de_manter(n: Node, raiz: Node) -> bool:
	while n != null and n != raiz:
		if str(n.name) in MANTER:
			return true
		n = n.get_parent()
	return false

# de longe a peça não é desenhada (como a vila em main.gd alcance_da_vila): paredes, portas, janelas e fundação até
# 100 m como as casas da vila; móveis 45 m (pequenos) ou 70 m. Perto (no terreno e na vila) nada muda.
static func _alcance_peca(raiz: Node3D, k: String) -> void:
	# André 2026-11-07: apertado como a vila (era 120/90/60 m)
	var longe := 100.0 if k in ["parede", "porta", "janela", "fundacao", "telhado"] else 70.0
	if k in ["bau", "tocha", "bigorna"]:
		longe = 45.0
	for mi: GeometryInstance3D in raiz.find_children("*", "GeometryInstance3D", true, false):
		mi.visibility_range_end = longe
		mi.visibility_range_end_margin = 8.0
		mi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF

# extra: outros modelos juntos [caminho, posição, nome] (a folha da porta, o caixilho da janela)
func _modelo_gltf(caminho: String, escala: float, pos := Vector3.ZERO, extra := []) -> Node3D:
	var raiz := Node3D.new()
	for e in [[caminho, pos, ""]] + extra:
		var cena = load(e[0])
		if cena:
			var f: Node3D = cena.instantiate()
			f.scale = Vector3.ONE * escala
			f.position = e[1]
			if e[2] != "":
				f.name = e[2]
			raiz.add_child(f)
	m.pintar(raiz, false) # mesmo jeito pintado da vila (toon, sem brilho de plástico)
	return raiz

# Juntas das paredes (André 2026-11-05: "e a junta das paredes"): a parede de 2 m acaba na linha da grade, então no
# canto (e entre duas paredes) ficava uma fresta. Cada parede ganha um pilar de madeira de 36 x 36 cm em cada ponta,
# do pé ao alto, como os esteios das casas de enxaimel. Dois pilares no mesmo canto ficam um dentro do outro (na
# mesma posição; cada giro fica um tiquinho maior, para não piscar), e o pilar some junto com a parede cortada.
const PILAR := 0.36
var _mat_pilar: StandardMaterial3D
func _pilares(raiz: Node3D) -> void:
	var alto := float(D.get("casa", {}).get("parede", 3.1)) + 0.04
	var h := PILAR / 2.0
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	# madeira clara da faixa de cima da textura (v 0,02 a 0,28), com o veio correndo de pé
	for lado in [-1.0, 1.0]:
		var c := Vector3(lado * grade() / 2.0, 0, 0)
		var y0 := -0.25
		var cantos := [Vector3(-h, 0, -h), Vector3(h, 0, -h), Vector3(h, 0, h), Vector3(-h, 0, h)]
		for k in 4:
			var a: Vector3 = c + cantos[k]
			var b: Vector3 = c + cantos[(k + 1) % 4]
			var q := [[a + Vector3(0, y0, 0), Vector2(0.0, 0.02)], [b + Vector3(0, y0, 0), Vector2(0.0, 0.28)],
				[b + Vector3(0, alto, 0), Vector2(alto / 3.0, 0.28)], [a + Vector3(0, alto, 0), Vector2(alto / 3.0, 0.02)]]
			for t in [0, 2, 1, 0, 3, 2]:
				st.set_uv(q[t][1] + Vector2(k * 0.21 + lado * 0.37, 0)) # cada face pega outro pedaço do veio
				st.add_vertex(q[t][0])
		var topo := [c + Vector3(-h, alto, -h), c + Vector3(h, alto, -h), c + Vector3(h, alto, h), c + Vector3(-h, alto, h)]
		for t in [0, 1, 2, 0, 2, 3]:
			st.set_uv(Vector2(0.5 + topo[t].x * 0.3, 0.05 + (topo[t].z + h) * 0.6))
			st.add_vertex(topo[t])
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.name = "pilares"
	mi.mesh = st.commit()
	if _mat_pilar == null: # a mesma madeira dos caibros da parede (T_WoodTrim do kit)
		_mat_pilar = StandardMaterial3D.new()
		_mat_pilar.albedo_texture = load("res://construcao3d/T_WoodTrim_BaseColor.png")
		_mat_pilar.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
		_mat_pilar.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
		_mat_pilar.roughness = 1.0
	mi.material_override = _mat_pilar
	raiz.add_child(mi)

# Fundação: bloco de pedra de 2 x 2 m (o topo fica 20 cm acima do chão; desce 60 cm para não flutuar em chão torto)
# com o assoalho de tábuas escuras em cima
func _modelo_fundacao() -> Node3D:
	var r := Node3D.new()
	_caixa(r, Vector3(2.0, 0.8, 2.0), Vector3(0, -0.2, 0), _mat_tex("stacked_stone_wall", Color("d6cec4"), 0.8))
	var piso := _modelo_gltf("res://construcao3d/Floor_WoodDark.gltf", 1.0, Vector3(0, 0.205, 0))
	r.add_child(piso)
	return r

# Tocha de pé: poste de madeira, suporte de ferro, chama acesa e uma luz quente sem sombra (some de longe)
func _modelo_tocha() -> Node3D:
	var r := Node3D.new()
	var madeira := _mat_tex("medieval_wood", Color("8a6a4a"), 2.0)
	var ferro := _mat_cor(Color(0.16, 0.15, 0.15))
	_caixa(r, Vector3(0.1, 1.5, 0.1), Vector3(0, 0.75, 0), madeira)
	_caixa(r, Vector3(0.24, 0.08, 0.24), Vector3(0, 0.04, 0), madeira)
	_caixa(r, Vector3(0.18, 0.05, 0.18), Vector3(0, 1.5, 0), ferro)
	for i in 4:
		var a := i * PI / 2.0
		_caixa(r, Vector3(0.025, 0.2, 0.025), Vector3(cos(a) * 0.08, 1.6, sin(a) * 0.08), ferro)
	for c in [[Color(1.0, 0.45, 0.12), 2.8, 0.13, 0.26, 1.64], [Color(1.0, 0.82, 0.35), 3.2, 0.07, 0.16, 1.62]]:
		var mi := MeshInstance3D.new()
		var s := SphereMesh.new()
		s.radius = c[2]
		s.height = c[3]
		s.radial_segments = 8
		s.rings = 4
		mi.mesh = s
		mi.material_override = _mat_cor(c[0], c[1])
		mi.position = Vector3(0, c[4], 0)
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.name = "chama"
		r.add_child(mi)
	var luz := OmniLight3D.new()
	luz.light_color = Color(1.0, 0.68, 0.36)
	luz.light_energy = 1.6
	luz.omni_range = 6.0
	luz.shadow_enabled = false
	luz.distance_fade_enabled = true
	luz.distance_fade_begin = 22.0
	luz.distance_fade_length = 6.0
	luz.position = Vector3(0, 1.75, 0)
	r.add_child(luz)
	return r

# telhado sozinho (um quadrado), para o fantasma; os de verdade são montados por terreno (_refazer_telhado)
func _modelo_telhado_um() -> Node3D:
	var r := Node3D.new()
	var mi := MeshInstance3D.new()
	mi.mesh = _malha_rampas(m.terreno.rampas_telhado([[0.0, 0.0, 0]], grade(), _telha_sobe()), 0.0) # rampa subindo para +z (o Girar vira o nó)
	r.add_child(mi)
	return r

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

# Fogão (2026-11-07): a fogueira de pedra da mata (Poly Haven stone_fire_pit, CC0), lenha acesa no meio, tripé de
# ferro e o caldeirão com o ensopado em cima; luz quente sem sombra que some de longe (como a tocha)
func _modelo_fogao() -> Node3D:
	var r := _modelo_gltf("res://cenario3d/fogueira.glb", 0.95, Vector3(0, 0.18, 0))
	var madeira := _mat_tex("medieval_wood", Color("6a4a32"), 2.0)
	var ferro := _mat_cor(Color(0.13, 0.12, 0.12))
	var brasa := _mat_cor(Color(1.0, 0.42, 0.12), 2.6)
	for i in 4: # lenha cruzada dentro da roda de pedra
		var a := i * PI / 4.0
		_caixa(r, Vector3(0.62, 0.09, 0.09), Vector3(0, 0.12 + i * 0.03, 0), madeira, Vector3(0, a, 0.12 if i % 2 == 0 else -0.12))
	_caixa(r, Vector3(0.42, 0.04, 0.42), Vector3(0, 0.1, 0), brasa)
	# chamas em ponta (cones) saindo da lenha: uma laranja grande e três amarelas menores em volta
	for c in [[Color(1.0, 0.45, 0.12), 2.6, 0.16, 0.42, Vector2.ZERO], [Color(1.0, 0.8, 0.3), 3.0, 0.08, 0.26, Vector2(0.09, 0.05)],
			[Color(1.0, 0.8, 0.3), 3.0, 0.07, 0.22, Vector2(-0.08, 0.06)], [Color(1.0, 0.62, 0.2), 2.8, 0.08, 0.28, Vector2(0.0, -0.1)]]:
		var mi := MeshInstance3D.new()
		var cn := CylinderMesh.new()
		cn.top_radius = 0.0
		cn.bottom_radius = c[2]
		cn.height = c[3]
		cn.radial_segments = 8
		cn.rings = 1
		mi.mesh = cn
		mi.material_override = _mat_cor(c[0], c[1])
		mi.position = Vector3(c[4].x, 0.16 + c[3] / 2.0, c[4].y)
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.name = "chama"
		r.add_child(mi)
	# tripé: três pernas de ferro inclinadas que se encontram em cima, a corrente e o caldeirão
	for i in 3:
		var a := i * TAU / 3.0
		var pe := Vector3(cos(a) * 0.62, 0.0, sin(a) * 0.62)
		var topo := Vector3(0, 1.32, 0)
		var meio := (pe + topo) / 2.0
		var mi := _caixa(r, Vector3(0.04, pe.distance_to(topo), 0.04), meio, ferro)
		mi.look_at_from_position(meio, topo, Vector3(1, 0, 0) if absf(pe.x) < 0.01 else Vector3(0, 0, 1))
		mi.rotate_object_local(Vector3.RIGHT, PI / 2.0)
	_caixa(r, Vector3(0.02, 0.36, 0.02), Vector3(0, 1.14, 0), ferro)
	var cal := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.27
	cm.bottom_radius = 0.2
	cm.height = 0.32
	cm.radial_segments = 16
	cal.mesh = cm
	cal.material_override = ferro
	cal.position = Vector3(0, 0.8, 0)
	r.add_child(cal)
	var borda := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.25
	tm.outer_radius = 0.3
	tm.rings = 16
	tm.ring_segments = 6
	borda.mesh = tm
	borda.material_override = ferro
	borda.position = Vector3(0, 0.96, 0)
	r.add_child(borda)
	var sopa := MeshInstance3D.new()
	var dm := CylinderMesh.new()
	dm.top_radius = 0.25
	dm.bottom_radius = 0.25
	dm.height = 0.02
	sopa.mesh = dm
	sopa.material_override = _mat_cor(Color("a0582a"), 0.25)
	sopa.position = Vector3(0, 0.93, 0)
	r.add_child(sopa)
	var luz := OmniLight3D.new()
	luz.light_color = Color(1.0, 0.66, 0.34)
	luz.light_energy = 0.9
	luz.omni_range = 4.5
	luz.shadow_enabled = false
	luz.distance_fade_enabled = true
	luz.distance_fade_begin = 22.0
	luz.distance_fade_length = 6.0
	luz.position = Vector3(0, 0.6, 0)
	r.add_child(luz)
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
	_correios.erase(id)
	_refazer_solidos()
	_refazer_pisos()
	_achar_portas()
	_grama_sob_horta() # a grama volta onde o terreno saiu

# ---------- o que vem do servidor ----------
func do_servidor_lotes(ev: Dictionary) -> void:
	meu = str(ev.meu) if ev.get("meu") != null else ""
	for d in ev.get("lista", []):
		do_servidor_lote(d)

func meu_lote(id: String) -> void:
	meu = id
	if id != "":
		m.sons.tocar("nivel", -6.0)
	if comprando:
		sair_compra()
	if id == "" and ativo:
		sair()

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
	elif ret is Array and ret.size() >= 4: # o dono mudou o tamanho
		L.def.x0 = float(ret[0]); L.def.z0 = float(ret[1]); L.def.x1 = float(ret[2]); L.def.z1 = float(ret[3])
	L.taxa = float(ev.get("taxa")) if ev.get("taxa") != null else 0.0
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
		ficam.append(novas[k])
	L.pecas = ficam
	_refazer_pisos() # antes de pôr as peças: o que fica em cima da fundação usa a altura do piso
	for k in novas:
		var p: Dictionary = novas[k]
		if _modelos.has(p.k) and p.k != "telhado": # o telhado é um só por terreno (_refazer_telhado)
			p.no = _copia(p.k)
			p.no.position = Vector3(p.x, _y_peca(p), p.z)
			p.no.rotation.y = p.r * PI / 2.0
			var pil = p.no.get_node_or_null("pilares")
			if pil: # dois pilares no mesmo canto: cada giro um tiquinho maior, para um cobrir o outro sem piscar
				pil.scale = Vector3(1.0 + 0.012 * p.r, 1.0 + 0.003 * p.r, 1.0 + 0.012 * p.r)
			L.raiz.add_child(p.no)
	_refazer_telhado(L)
	_achar_portas()
	L.erase("_moveis_chave") # peças mudaram: _moveis_dentro confere de novo
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
	_por_correio(id)
	if id == meu and not _avisou_conta:
		_avisou_conta = true
		var c := conta_terreno(L)
		if int(c.semanas) > 0:
			m.hud.aviso("Chegou conta do terreno no correio: %d de ouro" % int(c.valor))
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
# Com CONSTRUCOES.alto o círculo ganha o topo (2026-11-05): dá para pular e ficar em cima da bancada, baú, bigorna...
func _refazer_solidos() -> void:
	var l: Array = []
	for id in lotes:
		for p in lotes[id].pecas:
			var a: float = p.r * PI / 2.0
			var c := roundi(cos(a))
			var s := roundi(sin(a))
			var C: Dictionary = D.construcoes[p.k]
			var tem_topo := C.has("alto")
			var topo := _piso(p.x, p.z) + float(C.alto) if tem_topo else 0.0
			for q in C.circulos:
				var o := {"x": p.x + float(q[0]) * c + float(q[1]) * s, "z": p.z - float(q[0]) * s + float(q[1]) * c, "r": float(q[2])}
				if tem_topo:
					o.alto = topo
				l.append(o)
	m.mov.extras = l
	m.mov.refazer_tampos()

# ---------- casa: grade de 2 m (a mesma conta do servidor: shared/simulacao.js noMeioDaGrade, ladosDaBorda...) ----------
func grade() -> float:
	return float(D.get("casa", {}).get("grade", 2.0))

func tipo_peca(k: String) -> String:
	return str(D.construcoes[k].get("tipo", "movel")) if D.construcoes.has(k) else "movel"

static func _inteiro(v: float) -> bool:
	return absf(v - roundf(v)) < 1e-4

func no_meio_da_grade(v: float) -> bool:
	return _inteiro((v - grade() / 2.0) / grade())

func na_linha_da_grade(v: float) -> bool:
	return _inteiro(v / grade())

static func _mesmo_lugar(o: Dictionary, x: float, z: float) -> bool:
	return absf(o.x - x) < 0.01 and absf(o.z - z) < 0.01

func fundacao_em(L: Dictionary, x: float, z: float):
	for o in L.pecas:
		if tipo_peca(o.k) == "fundacao" and _mesmo_lugar(o, x, z):
			return o
	return null

func borda_em(L: Dictionary, x: float, z: float, eixo: int):
	for o in L.pecas:
		if tipo_peca(o.k) == "borda" and (o.r & 1) == eixo and _mesmo_lugar(o, x, z):
			return o
	return null

func telhado_em(L: Dictionary, x: float, z: float) -> bool:
	for o in L.pecas:
		if tipo_peca(o.k) == "telhado" and _mesmo_lugar(o, x, z):
			return true
	return false

# os dois quadrados dos lados de uma parede (r par: parede no eixo x; r ímpar: no eixo z)
func lados_da_borda(x: float, z: float, r: int) -> Array:
	var g := grade() / 2.0
	return [Vector2(x - g, z), Vector2(x + g, z)] if r & 1 else [Vector2(x, z - g), Vector2(x, z + g)]

# as quatro bordas de um quadrado: [x, z, eixo]
func bordas_do_quadrado(x: float, z: float) -> Array:
	var g := grade() / 2.0
	return [[x, z - g, 0], [x, z + g, 0], [x - g, z, 1], [x + g, z, 1]]

# chão sem as casas dos jogadores (pedras e casas da vila contam)
func _chao(x: float, z: float) -> float:
	var h := 0.0
	for r in m.terreno.solidos_em(x, z): # só os da casa de 4 m do ponto (FPS 2026-11-07)
		if r.get("obra", false):
			continue
		var a: float = m.terreno.altura_na(r, x, z)
		if a > h:
			h = a
	return h

# piso num ponto: o chão, ou o topo da fundação que estiver ali
func _piso(x: float, z: float) -> float:
	var g := grade() / 2.0
	for id in lotes:
		for p in lotes[id].pecas:
			if p.k == "fundacao" and absf(p.x - x) < g and absf(p.z - z) < g:
				return _chao(x, z) + float(D.casa.fundacao)
	return _chao(x, z)

# altura onde a peça fica: a fundação no chão; parede/porta/janela no piso mais alto dos dois lados; móvel no piso
func _y_peca(p: Dictionary) -> float:
	if p.k == "fundacao":
		return _chao(p.x, p.z)
	if tipo_peca(p.k) == "borda":
		var y := -INF
		for q in lados_da_borda(p.x, p.z, p.r):
			y = maxf(y, _piso(q.x, q.y))
		return y
	return _piso(p.x, p.z)

# A casa vira chão e parede de verdade no terreno.gd (2026-11-04, André: "a gente deve ser capaz de ficar em cima do
# telhado"): fundação é piso, parede e janela se escalam até o topo, a porta tem batentes e a verga por cima, e o
# telhado (quadrados juntos) é chão para quem está em cima e teto para quem está dentro. Mesma conta do servidor:
# shared/simulacao.js pecasCasaSolidas.
func _refazer_pisos() -> void:
	for r in _pisos:
		m.terreno.solidos.erase(r)
		m.terreno.casas.erase(r)
	_pisos.clear()
	var C: Dictionary = D.casa
	var g := grade() / 2.0
	var peca := func(x: float, z: float, hw: float, hd: float, y1: float, base: float) -> Dictionary:
		return {"casa": true, "obra": true, "x": x, "z": z, "cos": 1.0, "sen": 0.0, "hw": hw, "hd": hd, "sobe": 0.0, "y1": y1, "base": base, "R": Vector2(hw, hd).length()}
	for id in lotes:
		var L: Dictionary = lotes[id]
		var cel: Array = []
		var topo := -INF
		for p in L.pecas:
			var T := tipo_peca(p.k)
			if T == "fundacao":
				var c0 := _chao(p.x, p.z)
				_pisos.append(peca.call(p.x, p.z, g, g, c0 + float(C.fundacao), c0))
			elif T == "borda":
				var eixo: int = p.r & 1
				var y0 := _chao(p.x, p.z)
				var y1 := _y_peca(p) + float(C.parede)
				var e := float(C.espessura) / 2.0 + 0.02
				var partes: Array = [[-0.85, 0.3, y0, y1], [0.85, 0.3, y0, y1], [0.0, g + 0.15, y1 - float(C.parede) + float(C.porta), y1]] if p.k == "porta" else [[0.0, g + 0.15, y0, y1]]
				for q in partes:
					if eixo:
						_pisos.append(peca.call(p.x, p.z + q[0], e, q[1], q[3], q[2]))
					else:
						_pisos.append(peca.call(p.x + q[0], p.z, q[1], e, q[3], q[2]))
			elif T == "telhado":
				cel.append([p.x, p.z, int(p.r)])
				topo = maxf(topo, _piso(p.x, p.z) + float(C.parede))
		if cel.is_empty():
			continue
		var tem := {}
		for c in cel:
			tem[Vector2(c[0], c[1])] = true
		var seg: Array = []
		var x0 := INF
		var z0 := INF
		var x1 := -INF
		var z1 := -INF
		var bei := float(C.beiral)
		for c in cel:
			var x: float = c[0]
			var z: float = c[1]
			if not tem.has(Vector2(x - 2 * g, z)): seg.append([x - g, z - g, x - g, z + g])
			if not tem.has(Vector2(x + 2 * g, z)): seg.append([x + g, z - g, x + g, z + g])
			if not tem.has(Vector2(x, z - 2 * g)): seg.append([x - g, z - g, x + g, z - g])
			if not tem.has(Vector2(x, z + 2 * g)): seg.append([x - g, z + g, x + g, z + g])
			x0 = minf(x0, x - g - bei); x1 = maxf(x1, x + g + bei)
			z0 = minf(z0, z - g - bei); z1 = maxf(z1, z + g + bei)
		_pisos.append({"casa": true, "obra": true, "cel": cel, "seg": seg, "g": g, "base": topo, "beiral": bei, "inclina": float(C.inclina),
			"max": float(C.telhaMax), "x0": x0, "z0": z0, "x1": x1, "z1": z1, "x": (x0 + x1) / 2.0, "z": (z0 + z1) / 2.0, "cos": 1.0, "sen": 0.0,
			"hw": (x1 - x0) / 2.0, "hd": (z1 - z0) / 2.0, "sobe": 0.0, "y1": topo, "R": Vector2(x1 - x0, z1 - z0).length() / 2.0,
			"rampa": m.terreno.rampas_telhado(cel, 2.0 * g, _telha_sobe())}) # telhado em rampa (2026-11-05)
	m.terreno.solidos.append_array(_pisos)
	m.terreno.casas.append_array(_pisos) # teto: dentro de casa a cabeça bate no telhado e na verga da porta
	m.terreno.solidos_mudaram() # a grade de 4 m dos sólidos (terreno.gd) se refaz

# altura do topo das paredes de um quadrado (piso + parede)
func _topo_parede(x: float, z: float) -> float:
	return _piso(x, z) + float(D.get("casa", {}).get("parede", 3.1))

# Telhado (Quimera: telhados vizinhos se juntam num só): uma malha por terreno. A altura sobe com a distância até a
# borda de fora do conjunto de quadrados com telhado (como um telhado de quatro águas que se ajeita a qualquer
# formato), com beiral de 45 cm para fora. Telha T_RoundTiles por cima, tábuas por baixo.
# números do telhado em dados/habilidades.json casa (beiral, inclina, telhaMax): os mesmos do servidor
# (os de baixo são os mesmos números, guardados aqui como referência; quem vale é o dados)
const BEIRAL := 0.45
const INCLINA := 0.6
const TELHA_MAX := 1.8 # o telhado para de subir aqui (casa grande fica com o topo reto)

# telha (T_RoundTiles) e forro de madeira, uma vez só
func _criar_mats_telha() -> void:
	if _mat_telha != null:
		return
	_mat_telha = StandardMaterial3D.new()
	_mat_telha.albedo_texture = load("res://construcao3d/T_RoundTiles_BaseColor.png")
	_mat_telha.albedo_color = Color("d9b9a6")
	_mat_telha.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	_mat_telha.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	_mat_telha.roughness = 1.0
	_mat_forro = StandardMaterial3D.new()
	_mat_forro.albedo_texture = load("res://construcao3d/medieval_wood_diff_1k.jpg")
	_mat_forro.albedo_color = Color("9a7a5c")
	_mat_forro.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	_mat_forro.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	_mat_forro.roughness = 1.0
	_mat_forro.cull_mode = BaseMaterial3D.CULL_DISABLED
	# oitão como continuação da parede (André 2026-11-05): o reboco e a madeira do kit da parede (Wall_Plaster_Straight)
	_mat_reboco = StandardMaterial3D.new()
	_mat_reboco.albedo_texture = load("res://construcao3d/T_Plaster_BaseColor.png")
	_mat_reboco.normal_enabled = true
	_mat_reboco.normal_texture = load("res://construcao3d/T_Plaster_Normal.png")
	_mat_reboco.roughness = 1.0
	_mat_reboco.cull_mode = BaseMaterial3D.CULL_DISABLED
	_mat_viga = StandardMaterial3D.new()
	_mat_viga.albedo_texture = load("res://construcao3d/T_WoodTrim_BaseColor.png")
	_mat_viga.normal_enabled = true
	_mat_viga.normal_texture = load("res://construcao3d/T_WoodTrim_Normal.png")
	_mat_viga.roughness = 1.0

func _malha_telhado(celulas: Array, base: float) -> ArrayMesh:
	var g := grade() / 2.0
	var tem := {}
	for c in celulas:
		tem[c] = true
	# bordas de fora (segmentos) e o retângulo de cada quadrado com o beiral onde não tem vizinho
	var bordas: Array = []
	var rets: Array = []
	for c in celulas:
		var w := not tem.has(c + Vector2(-2 * g, 0))
		var e := not tem.has(c + Vector2(2 * g, 0))
		var n := not tem.has(c + Vector2(0, -2 * g))
		var s := not tem.has(c + Vector2(0, 2 * g))
		if w: bordas.append([c + Vector2(-g, -g), c + Vector2(-g, g)])
		if e: bordas.append([c + Vector2(g, -g), c + Vector2(g, g)])
		if n: bordas.append([c + Vector2(-g, -g), c + Vector2(g, -g)])
		if s: bordas.append([c + Vector2(-g, g), c + Vector2(g, g)])
		rets.append([c, w, e, n, s])
	var altura := func(q: Vector2) -> float:
		var d := INF
		for b in bordas:
			d = minf(d, q.distance_to(Geometry2D.get_closest_point_to_segment(q, b[0], b[1])))
		var dentro := false
		for c in celulas:
			if absf(q.x - c.x) <= g + 0.001 and absf(q.y - c.y) <= g + 0.001:
				dentro = true
				break
		if not dentro:
			d = -d
		return base + 0.2 + float(D.casa.inclina) * minf(d, float(D.casa.telhaMax) / float(D.casa.inclina))
	var cima := SurfaceTool.new()
	var baixo := SurfaceTool.new()
	var borda := SurfaceTool.new()
	for st in [cima, baixo, borda]:
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for R in rets:
		var c: Vector2 = R[0]
		# eixos com 8 divisões de 25 cm no quadrado + 1 no beiral (os vizinhos encaixam ponto com ponto)
		var xs: Array = []
		var zs: Array = []
		if R[1]: xs.append(c.x - g - float(D.casa.beiral))
		if R[3]: zs.append(c.y - g - float(D.casa.beiral))
		for i in 9:
			xs.append(c.x - g + i * g / 4.0)
			zs.append(c.y - g + i * g / 4.0)
		if R[2]: xs.append(c.x + g + float(D.casa.beiral))
		if R[4]: zs.append(c.y + g + float(D.casa.beiral))
		var P: Array = []
		for j in zs.size():
			for i in xs.size():
				var q := Vector2(xs[i], zs[j])
				P.append(Vector3(q.x, altura.call(q), q.y))
		var nx := xs.size()
		for j in zs.size() - 1:
			for i in nx - 1:
				var a: Vector3 = P[j * nx + i]
				var b: Vector3 = P[j * nx + i + 1]
				var cc: Vector3 = P[(j + 1) * nx + i + 1]
				var d: Vector3 = P[(j + 1) * nx + i]
				for v in [a, b, cc, a, cc, d]:
					cima.set_uv(Vector2(v.x, v.z) * 0.5)
					cima.add_vertex(v)
				for v in [a, cc, b, a, d, cc]:
					baixo.set_uv(Vector2(v.x, v.z) * 0.7)
					baixo.add_vertex(v - Vector3(0, 0.1, 0))
		# testeira: tábua de 10 cm na ponta do beiral
		var lados := []
		if R[1]: lados.append(range(zs.size()).map(func(j): return P[j * nx]))
		if R[2]: lados.append(range(zs.size()).map(func(j): return P[j * nx + nx - 1]))
		if R[3]: lados.append(range(nx).map(func(i): return P[i]))
		if R[4]: lados.append(range(nx).map(func(i): return P[(zs.size() - 1) * nx + i]))
		for L in lados:
			for k in L.size() - 1:
				var a: Vector3 = L[k]
				var b: Vector3 = L[k + 1]
				var a2 := a - Vector3(0, 0.12, 0)
				var b2 := b - Vector3(0, 0.12, 0)
				for v in [a, b, b2, a, b2, a2]:
					borda.set_uv(Vector2(v.x + v.z, v.y) * 0.7)
					borda.add_vertex(v)
	var malha := ArrayMesh.new()
	for st in [cima, baixo, borda]:
		st.generate_normals()
		st.generate_tangents()
		st.commit(malha)
	_criar_mats_telha()
	malha.surface_set_material(0, _mat_telha)
	malha.surface_set_material(1, _mat_forro)
	malha.surface_set_material(2, _mat_forro)
	return malha

# quanto cada quadrado de telhado sobe (dados casa.telhaSobe, o mesmo do servidor)
# altura do pé da rampa de um telhado novo em (x, z) virado para r, contando os que já estão no terreno
func _y_rampa_nova(L: Dictionary, x: float, z: float, r: int) -> float:
	var cel: Array = [[x, z, r]]
	var base := _topo_parede(x, z)
	for p in L.pecas:
		if p.k == "telhado" and not _mesmo_lugar(p, x, z):
			cel.append([p.x, p.z, int(p.r)])
			base = maxf(base, _topo_parede(p.x, p.z))
	return base + float(m.terreno.rampas_telhado(cel, grade(), _telha_sobe())[0].h0)

func _telha_sobe() -> float:
	return float(D.get("casa", {}).get("telhaSobe", 1.2))

# Telhado em rampa (André 2026-11-05: "o telhado é pra ser uma rampa contínua... o mesmo esquema do Quimera"):
# cada quadrado é uma rampa na direção do Girar; o seguinte na mesma direção começa onde o anterior parou (mais alto);
# duas rampas de frente fecham a cumeeira. Telha por cima, forro por baixo, testeira na beirada e oitão (o triângulo
# de madeira) nos lados abertos e atrás da parte alta. rampas = terreno.gd rampas_telhado.
func _malha_rampas(rampas: Array, base: float) -> ArrayMesh:
	var g := grade() / 2.0
	var bei := float(D.casa.beiral)
	var cima := SurfaceTool.new()
	var baixo := SurfaceTool.new()
	var borda := SurfaceTool.new()
	var reboco := SurfaceTool.new() # oitão: reboco da parede (André 2026-11-05)
	var vigas := SurfaceTool.new() # e o enxaimel de madeira por cima
	for st in [cima, baixo, borda, reboco, vigas]:
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for q in rampas:
		var dx: float = q.dx
		var dz: float = q.dz
		var P := func(u: float, v: float, h: float) -> Vector3:
			return Vector3(q.x + u * dx + v * dz, h, q.z + u * dz - v * dx)
		var H := func(u: float) -> float:
			return base + 0.2 + m.terreno.altura_na_rampa(q, u, g) # com a ponta no meio quando o vão é ímpar
		var u0 := -g - (0.0 if q.atras else bei)
		var u1 := g + (0.0 if q.frente else bei * 0.6)
		var v0 := -g - (0.0 if q.esq else bei)
		var v1 := g + (0.0 if q.dir else bei)
		var us: Array = [u0, 0.0, g] if u1 <= g + 0.001 else [u0, 0.0, g, u1] # 0: o meio (ponta do telhado ímpar)
		for i in us.size() - 1:
			var a: Vector3 = P.call(us[i], v0, H.call(us[i]))
			var b: Vector3 = P.call(us[i], v1, H.call(us[i]))
			var cc: Vector3 = P.call(us[i + 1], v1, H.call(us[i + 1]))
			var d: Vector3 = P.call(us[i + 1], v0, H.call(us[i + 1]))
			for v in [a, b, cc, a, cc, d]:
				cima.set_uv(Vector2(v.x, v.z) * 0.5)
				cima.add_vertex(v)
			for v in [a, cc, b, a, d, cc]:
				baixo.set_uv(Vector2(v.x, v.z) * 0.7)
				baixo.add_vertex(v - Vector3(0, 0.1, 0))
		# testeira (tábua de 12 cm) nas beiradas sem vizinho
		var lados: Array = []
		if not q.atras: lados.append([[u0, v0], [u0, v1]])
		if not q.frente: lados.append([[u1, v1], [u1, v0]])
		if not q.esq: lados.append(us.map(func(u): return [u, v0]))
		if not q.dir:
			var ld: Array = us.map(func(u): return [u, v1])
			ld.reverse()
			lados.append(ld)
		for L in lados:
			for k in L.size() - 1:
				var a: Vector3 = P.call(L[k][0], L[k][1], H.call(L[k][0]))
				var b: Vector3 = P.call(L[k + 1][0], L[k + 1][1], H.call(L[k + 1][0]))
				var a2 := a - Vector3(0, 0.12, 0)
				var b2 := b - Vector3(0, 0.12, 0)
				for v in [a, b, b2, a, b2, a2]:
					borda.set_uv(Vector2(v.x + v.z, v.y) * 0.7)
					borda.add_vertex(v)
		# oitão: fecha o vão entre o alto da parede e o telhado nos lados abertos (e atrás da parte alta da rampa).
		# André 2026-11-05: "uma parede tipo continuação do estilo da parede, como são as casas da vila": reboco claro
		# do kit (o mesmo da parede) com o enxaimel de madeira por cima, sozinho: frechal no pé, caibro rente ao telhado,
		# esteio nas emendas dos quadrados e na ponta, e mão-francesa onde o triângulo já é alto.
		var oitoes: Array = []
		if not q.esq: # em duas partes: a ponta pode ficar no meio
			oitoes.append([[-g, -g], [0.0, -g]])
			oitoes.append([[0.0, -g], [g, -g]])
		if not q.dir:
			oitoes.append([[g, g], [0.0, g]])
			oitoes.append([[0.0, g], [-g, g]])
		if not q.frente and not q.plano: oitoes.append([[g, -g], [g, g]])
		for o in oitoes:
			var a := P.call(o[0][0], o[0][1], base) as Vector3
			var b := P.call(o[1][0], o[1][1], base) as Vector3
			var ha: float = H.call(o[0][0]) - 0.1
			var hb: float = H.call(o[1][0]) - 0.1
			var b2 := Vector3(b.x, hb, b.z)
			var a2 := Vector3(a.x, ha, a.z)
			for v in [a, b, b2, a, b2, a2]:
				reboco.set_uv(Vector2((v.x + v.z) * 0.5, -v.y * 0.29)) # mesma escala do reboco da parede de 2 m
				reboco.add_vertex(v)
			var n := (b - a).cross(Vector3.UP).normalized() # para fora da parede (os dois lados levam madeira)
			if ha - base < 0.15 and hb - base < 0.15:
				continue
			_viga(vigas, a + Vector3(0, 0.09, 0), b + Vector3(0, 0.09, 0), n, 0.18) # frechal (em cima da parede)
			_viga(vigas, a2 - Vector3(0, 0.09, 0), b2 - Vector3(0, 0.09, 0), n, 0.18) # caibro, rente ao telhado
			var lado: bool = absf(float(o[0][1])) > g - 0.01 and absf(float(o[1][1])) > g - 0.01 # oitão do lado (v = ±g)
			var u_a: float = o[0][0]
			# esteio: na emenda dos quadrados (u = ±g) e na ponta do meio; o da beira de fora fica no pilar da parede
			var esteio_a: bool = ha - base > 0.35 and (not lado or absf(u_a) > g - 0.01 or (q.hm > q.h0 + 0.01 and q.hm > q.h1 + 0.01))
			if esteio_a and (q.atras or absf(u_a + g) > 0.01 or not lado):
				_viga(vigas, a + Vector3(0, 0.18, 0), a2 - Vector3(0, 0.18, 0), n, 0.2)
			if not lado and hb - base > 0.35:
				_viga(vigas, b + Vector3(0, 0.18, 0), b2 - Vector3(0, 0.18, 0), n, 0.2)
			if minf(ha, hb) - base > 0.9: # mão-francesa: do pé do lado baixo até o alto do outro
				var baixo_a: bool = ha < hb
				var p0 := (a if baixo_a else b) + Vector3(0, 0.18, 0)
				var alto := b2 if baixo_a else a2
				_viga(vigas, p0, alto - Vector3(0, 0.3, 0), n, 0.16)
	var malha := ArrayMesh.new()
	_criar_mats_telha() # mesmos materiais do telhado antigo
	var mats := [_mat_telha, _mat_forro, _mat_forro, _mat_reboco, _mat_viga]
	var sts := [cima, baixo, borda, reboco, vigas]
	for i in sts.size():
		var st: SurfaceTool = sts[i]
		st.generate_normals()
		st.generate_tangents()
		var antes := malha.get_surface_count()
		st.commit(malha)
		if malha.get_surface_count() > antes: # superfície vazia (sem oitão) não entra
			malha.surface_set_material(antes, mats[i])
	return malha

# uma viga de madeira (T_WoodTrim, a madeira da parede) de p0 a p1, de largura larg, saindo 5 cm dos dois lados da
# parede (n = para fora); o veio corre ao longo dela
func _viga(st: SurfaceTool, p0: Vector3, p1: Vector3, n: Vector3, larg: float) -> void:
	var t := p1 - p0
	var L := t.length()
	if L < 0.05:
		return
	var s := n.cross(t / L).normalized() * (larg / 2.0) # no plano da parede, de través da viga
	var f := n * 0.2 # meia grossura: a parede tem uns 30 cm; a madeira sai um pouco do reboco
	var c := [p0 - s - f, p0 + s - f, p0 + s + f, p0 - s + f]
	for k in 4:
		var e: Vector3 = c[k]
		var d: Vector3 = c[(k + 1) % 4]
		var vu := 0.02 + 0.26 * float(k % 2)
		var q := [[e, Vector2(0.0, 0.02)], [d, Vector2(0.0, 0.28)], [d + t, Vector2(L / 3.0, 0.28)], [e + t, Vector2(L / 3.0, 0.02)]]
		for i in [0, 2, 1, 0, 3, 2]:
			st.set_uv(q[i][1] + Vector2(k * 0.21 + vu, 0))
			st.add_vertex(q[i][0])
	for ponta in [[p0, false], [p1, true]]: # tampas
		var o: Vector3 = ponta[0] - p0
		var tp := [c[0] + o, c[1] + o, c[2] + o, c[3] + o]
		var ordem: Array = [0, 1, 2, 0, 2, 3] if not ponta[1] else [0, 2, 1, 0, 3, 2]
		for i in ordem:
			st.set_uv(Vector2(0.5, 0.1))
			st.add_vertex(tp[i])

func _refazer_telhado(L: Dictionary) -> void:
	var celulas: Array = []
	var base := -INF
	var cel_r: Array = [] # [x, z, r]: a direção de cada rampa (Girar)
	for p in L.pecas:
		if p.k == "telhado":
			celulas.append(Vector2(p.x, p.z))
			cel_r.append([p.x, p.z, int(p.r)])
			base = maxf(base, _topo_parede(p.x, p.z))
	var velho = L.get("telhado")
	var chave := str(cel_r) + str(base)
	if velho != null and L.get("telhado_chave", "") == chave:
		return
	if velho != null:
		velho.queue_free()
		L.erase("telhado")
	L.telhado_chave = chave
	L.telhado_celulas = celulas
	L.telhado_base = base
	if celulas.is_empty():
		return
	var mi := MeshInstance3D.new()
	mi.name = "telhado"
	mi.mesh = _malha_rampas(m.terreno.rampas_telhado(cel_r, grade(), _telha_sobe()), base) # rampa (o _malha_telhado antigo fica guardado)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	mi.visibility_range_end = 110.0 # FPS (2026-11-07): de muito longe não desenha (o telhado inteiro é grande; era 140 m)
	mi.visibility_range_end_margin = 8.0
	mi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
	L.raiz.add_child(mi)
	L.telhado = mi

# Como no Quimera: dentro de casa (debaixo do telhado; em cima dele não conta) o telhado some e as paredes que ficam
# entre a câmera e o herói também, conforme o ângulo (fica só a sombra, a luz de dentro não muda). No modo construção
# o telhado some com a mira lá dentro (para pôr móveis e paredes); colocando telhado ou desmontando, ele aparece.
# André (2026-11-05): "igualzinho o Quimera, dependendo do ângulo e posição a parede some; não é pra sumir a parede
# toda assim que entra". Só no modo jogo: no modo construção nenhuma parede some. Dentro de casa (em cima da fundação
# ou debaixo do telhado) a câmera não bate mais nas paredes da casa (main.distancia_livre), fica longe como lá fora, e
# só as paredes que tapam a linha herói → câmera (um cone que abre para o lado da câmera) apagam devagar.
const CORTE_PERTO := 0.75 # m: meia largura do corte junto do herói
const CORTE_ABRE := 0.3 # m a mais por metro andado para o lado da câmera (cone)
const CORTE_VEL := 5.0 # quanto o apagar/voltar anda por segundo (1 = some em 0,2 s)
const TERRENO_PERTO := 25.0 # m: terreno mais longe que isso do herói não tem telhado nem parede sumindo
var dentro_de_casa := false # o herói está dentro de uma casa, no modo jogo (a câmera ignora as paredes da casa)

func _telhados_visiveis(hp: Vector3, dt := 0.016) -> void:
	var g := grade() / 2.0
	var dentro := false
	var livre := ativo or comprando
	# FPS (2026-11-07): só os terrenos perto do herói (ou o meu, construindo) podem ter telhado ou parede sumindo; os de
	# longe que já voltaram ao normal ("quieto") nem são olhados. Antes o laço passava por todas as peças de todos os
	# terrenos a cada quadro.
	var perto := {}
	for id in lotes:
		if dist_ret(lotes[id].def, hp.x, hp.z) < TERRENO_PERTO or (ativo and id == meu):
			perto[id] = true
	for id in lotes:
		var L: Dictionary = lotes[id]
		if not perto.has(id) and L.get("quieto", false):
			continue
		var mi = L.get("telhado")
		if mi == null:
			continue
		var some := false
		if perto.has(id):
			for c in L.telhado_celulas:
				if absf(hp.x - c.x) < g and absf(hp.z - c.y) < g and hp.y < float(L.telhado_base) - 0.3:
					some = true
					dentro = true
				if ativo and id == meu and not sel in ["telhado", "desmontar"] and absf(mira.x - c.x) < g + 0.3 and absf(mira.z - c.y) < g + 0.3:
					some = true
				if ativo and id == meu and andar == "terreo": # andar térreo: o telhado inteiro some (fica a sombra)
					some = true
		_apagar(mi, some, dt)
	# em cima de uma fundação (casa ainda sem telhado também conta), abaixo do alto das paredes
	if not dentro:
		var topo := float(D.get("casa", {}).get("parede", 3.1)) - 0.3
		for id in perto:
			for p in lotes[id].pecas:
				if p.k == "fundacao" and absf(hp.x - p.x) < g and absf(hp.z - p.z) < g and hp.y < _piso(p.x, p.z) + topo:
					dentro = true
					break
			if dentro:
				break
	dentro_de_casa = dentro and not livre
	# paredes (Quimera): a linha do herói até a câmera, vista de cima; a parede que encosta nela (com folga que abre
	# para o lado da câmera) apaga. As de trás do herói e as de lado ficam.
	var a2 := Vector2(hp.x, hp.z)
	var b2 := a2
	var dir := Vector2.ZERO
	var comp := 0.0
	if dentro_de_casa and m.camera:
		var v: Vector3 = m.camera.global_position - hp
		comp = Vector2(v.x, v.z).length()
		if comp > 0.3:
			dir = Vector2(v.x, v.z) / comp
			comp += 0.6
			b2 = a2 + dir * comp
	for id in lotes:
		var L: Dictionary = lotes[id]
		var eh_perto := perto.has(id)
		if not eh_perto and L.get("quieto", false):
			continue
		var quieto := not eh_perto
		for p in L.pecas:
			if tipo_peca(p.k) != "borda" or not p.get("no") or not is_instance_valid(p.no):
				continue
			var corta := false
			if eh_perto and dir != Vector2.ZERO and absf(p.x - hp.x) < comp + g + 1.0 and absf(p.z - hp.z) < comp + g + 1.0:
				corta = _parede_tapa(p, a2, b2, dir, g)
			p.cortada = corta # a parede está cortada agora (o apagar anda devagar até lá)
			_apagar(p.no, corta, dt)
			if quieto and p.no.get_meta("apagado", 0.0) != 0.0:
				quieto = false
		var tl = L.get("telhado")
		if quieto and tl != null and is_instance_valid(tl) and tl.get_meta("apagado", 0.0) != 0.0:
			quieto = false
		L.quieto = quieto

# Móveis dentro de casa (ideia do André, 2026-11-07: "o que tiver dentro das casas, só carregar quando a pessoa
# entrar"): móvel debaixo de um telhado (mesa, baú, cama, fornalha, tocha...) só é desenhado com o herói a até 8 m do
# terreno (ou construindo nele). De longe a casa fechada esconde ele mesmo; com 6, 7, 8 casas perto, os móveis de
# todo mundo deixam de ser desenhados à toa. Móvel no quintal (sem telhado em cima) continua sempre.
const MOVEIS_PERTO := 8.0
func _moveis_dentro(hp: Vector3) -> void:
	var G := grade()
	for id in lotes:
		var L: Dictionary = lotes[id]
		var mostra: bool = dist_ret(L.def, hp.x, hp.z) < MOVEIS_PERTO or ((ativo or comprando) and id == meu)
		var chave := [mostra, L.get("telhado_chave", ""), L.pecas.size()]
		if L.get("_moveis_chave") == chave:
			continue
		L._moveis_chave = chave
		var cel := {}
		for c in L.get("telhado_celulas", []):
			cel[c] = true
		for p in L.pecas:
			if tipo_peca(p.k) != "movel" or not p.get("no") or not is_instance_valid(p.no):
				continue
			var coberto := cel.has(Vector2(floorf(p.x / G) * G + G / 2.0, floorf(p.z / G) * G + G / 2.0))
			p.no.visible = mostra or not coberto

# a parede p (de 2 m, na linha da grade) tapa a vista do herói (a2) até a câmera (b2)?
func _parede_tapa(p: Dictionary, a2: Vector2, b2: Vector2, dir: Vector2, g: float) -> bool:
	var e := Vector2(0.0, g) if p.r & 1 else Vector2(g, 0.0)
	var c := Vector2(p.x, p.z)
	var w0 := c - e
	var w1 := c + e
	# o ponto da parede mais perto da linha
	var pts: Array = [w0, w1, Geometry2D.get_closest_point_to_segment(a2, w0, w1), Geometry2D.get_closest_point_to_segment(b2, w0, w1)]
	var cruz = Geometry2D.segment_intersects_segment(a2, b2, w0, w1)
	if cruz != null:
		pts.append(cruz)
	for q in pts:
		var t: float = (q - a2).dot(dir)
		if t < 0.25:
			continue # atrás do herói ou colada nele: fica
		var lado: float = absf((q - a2).cross(dir))
		if lado < CORTE_PERTO + CORTE_ABRE * t and t < (b2 - a2).length():
			return true
	return false

# apaga devagar (transparência) e, apagado de vez, fica só a sombra; volta do mesmo jeito
func _apagar(no: Node3D, some: bool, dt: float) -> void:
	var k: float = no.get_meta("apagado", 0.0)
	var alvo := 1.0 if some else 0.0
	if k == alvo:
		return
	k = move_toward(k, alvo, dt * CORTE_VEL)
	no.set_meta("apagado", k)
	var malhas: Array = [no] if no is MeshInstance3D else no.find_children("*", "MeshInstance3D", true, false)
	for q in malhas:
		if k >= 1.0:
			q.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_SHADOWS_ONLY # some, mas a sombra fica
			q.transparency = 0.0
		else:
			q.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
			q.transparency = k

# portas: a folha abre quando o herói chega perto e fecha quando ele sai
func _achar_portas() -> void:
	_portas.clear()
	for id in lotes:
		for p in lotes[id].pecas:
			if p.k == "porta" and p.get("no") and is_instance_valid(p.no):
				var f = p.no.find_child("folha", true, false)
				if f:
					_portas.append(f)

func _mexer_portas(hp: Vector3, dt: float) -> void:
	for f in _portas:
		if not is_instance_valid(f):
			continue
		var c: Vector3 = f.get_parent().global_position
		var perto := Vector2(c.x - hp.x, c.z - hp.z).length() < 1.6
		f.rotation.y = move_toward(f.rotation.y, -1.75 if perto else 0.0, dt * 4.0)

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
		if n.name == "info": # placa da planta (barra e tempo) fica; _info_planta cuida dela
			continue
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
	_info_planta(h, h.no.position.distance_to(m.heroi.position) < INFO_PERTO) # plantou/regou: a placa já muda

# ---------- placa da planta (André 2026-11-07: "quando eu plantei não mostra nada") ----------
# Em cima de cada planta, perto do herói: nome + fase, barra de crescimento e o que fazer: "Precisa regar!" (terra
# seca, não cresce), "Regada · falta 1h 20min" ou "Pronta para colher!". Conta igual à do servidor (_crescida).
const INFO_PERTO := 14.0 # metros
const FASES_PLANTA := ["Semente", "Brotando", "Crescendo", "Quase pronta", "Pronta"]
const BARRA_W := 0.62
var _mat_barra := {}

func _mat_info(cor: Color, prio: int) -> StandardMaterial3D:
	var k := "%s/%d" % [cor.to_html(), prio]
	if not _mat_barra.has(k):
		var mt := StandardMaterial3D.new()
		mt.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mt.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		mt.no_depth_test = true
		mt.albedo_color = cor
		mt.render_priority = prio
		_mat_barra[k] = mt
	return _mat_barra[k]

static func _tempo_txt(horas: float) -> String:
	var mn := int(ceil(horas * 60.0))
	if mn < 60:
		return "%d min" % maxi(1, mn)
	return "%dh %02dmin" % [mn / 60, mn % 60] if mn % 60 else "%dh" % (mn / 60)

func _info_planta(h: Dictionary, perto: bool) -> void:
	var info: Node3D = h.no.get_node_or_null("info")
	if not perto or h.c == "" or not D.plantas.has(h.c):
		if info:
			info.visible = false
		return
	if info == null:
		info = Node3D.new()
		info.name = "info"
		var fundo := MeshInstance3D.new()
		fundo.name = "fundo"
		var qf := QuadMesh.new()
		qf.size = Vector2(BARRA_W + 0.04, 0.095)
		fundo.mesh = qf
		fundo.material_override = _mat_info(Color(0.08, 0.06, 0.04, 0.8), 10)
		fundo.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		info.add_child(fundo)
		var cheio := MeshInstance3D.new()
		cheio.name = "cheio"
		cheio.mesh = QuadMesh.new()
		cheio.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		info.add_child(cheio)
		var t := Label3D.new()
		t.name = "txt"
		t.font = m.fonte_nome()
		t.font_size = 34
		t.pixel_size = 0.0045
		t.outline_size = 10
		t.outline_modulate = Color(0.08, 0.06, 0.04)
		t.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		t.no_depth_test = true
		t.render_priority = 12
		t.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM # o texto fica todo acima da barra
		t.position.y = 0.07
		info.add_child(t)
		h.no.add_child(info)
	info.visible = true
	var P: Dictionary = D.plantas[h.c]
	var cr := minf(1.0, _crescida(h))
	var f := fase(cr)
	var mo := _molhada(h)
	var txt: Label3D = info.get_node("txt")
	var cor_barra: Color
	var linha2: String
	if f >= 4:
		cor_barra = Color(0.45, 0.9, 0.35)
		linha2 = "Pronta para colher!"
		txt.modulate = Color(0.6, 1.0, 0.5)
	elif not mo:
		cor_barra = Color(0.85, 0.7, 0.3)
		linha2 = "Precisa regar! (não cresce seca)"
		txt.modulate = Color(1.0, 0.72, 0.35)
	else:
		cor_barra = Color(0.35, 0.7, 1.0)
		var falta := (1.0 - cr) * float(P.G)
		var agua: float = (h.w + float(D.horta.rega) * 3600000.0 - agora_ms()) / 3600000.0
		linha2 = "Regada · falta %s" % _tempo_txt(falta)
		if agua < falta: # a água acaba antes: vai precisar regar de novo
			linha2 += " · seca em %s" % _tempo_txt(agua)
		txt.modulate = Color(0.85, 0.93, 1.0)
	txt.text = "%s · %s %d%%\n%s" % [P.nome, FASES_PLANTA[f], int(cr * 100.0), linha2]
	# barra: o pedaço cheio cresce da esquerda (center_offset no espaço da malha acompanha o billboard)
	var cheio: MeshInstance3D = info.get_node("cheio")
	var q: QuadMesh = cheio.mesh
	var w := maxf(0.005, BARRA_W * cr)
	q.size = Vector2(w, 0.06)
	q.center_offset = Vector3((w - BARRA_W) / 2.0, 0, 0)
	cheio.material_override = _mat_info(cor_barra, 11)
	info.position.y = 0.95 # acima da planta (abóbora e milho são os mais altos)

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
# 2026-11-05 (André: "o chão continua com grama"): cada pedaço de grama (24 m) pega vários terrenos. A conta refazia o
# pedaço a partir da grama original olhando só o terreno que chegou, e devolvia a grama embaixo das casas dos vizinhos
# (o último terreno a chegar ganhava). Agora a conta olha todos os terrenos de uma vez, sempre que um deles muda.
func _grama_sob_horta(_L = null) -> void:
	if m.get("grama_pedacos") == null:
		return
	var caixas: Array = []
	var celulas := {}
	# nada de grama furando a fundação, o piso ou os móveis; o retângulo de cada peça (menos o telhado, que fica no
	# alto) tapa a grama embaixo, com uma folga de 15 cm
	var tampas: Array = []
	for id in lotes:
		var L: Dictionary = lotes[id]
		var l: Dictionary = L.def
		caixas.append(Rect2(float(l.x0) - 1.0, float(l.z0) - 1.0, float(l.x1) - float(l.x0) + 2.0, float(l.z1) - float(l.z0) + 2.0))
		for c in L.horta:
			celulas[Vector2i(L.horta[c].i, L.horta[c].j)] = true
		for p in L.pecas:
			if tipo_peca(p.k) != "telhado" and D.construcoes.has(p.k):
				tampas.append(ret_peca(p.k, p.x, p.z, p.r).grow(0.15))
	# a grama da vila e a das clareiras da mata (os lotes ficam perto da mata: era a que ainda furava o piso)
	for g in m.grama_pedacos + m.get("grama_mata") if m.get("grama_mata") != null else m.grama_pedacos:
		if not is_instance_valid(g) or g.multimesh == null:
			continue
		var mm: MultiMesh = g.multimesh
		var n := mm.instance_count
		if n == 0:
			continue
		var bb: AABB = g.global_transform * mm.get_aabb()
		var rb := Rect2(bb.position.x, bb.position.z, bb.size.x, bb.size.z)
		var perto: Array = []
		for c in caixas:
			if c.intersects(rb):
				perto.append(c)
		if perto.is_empty() and not _grama_original.has(g):
			continue
		var orig: PackedFloat32Array = _grama_original.get(g, mm.buffer)
		_grama_original[g] = orig
		var buf := orig.duplicate()
		var mexeu := false
		for i in n:
			var x: float = buf[i * 16 + 3]
			var z: float = buf[i * 16 + 11]
			var dentro := false
			for c in perto:
				if c.has_point(Vector2(x, z)):
					dentro = true
					break
			if not dentro:
				continue
			var tapa := false
			for di in [-1, 0, 1]: # a terra solta passa uns 25 cm da borda
				for dj in [-1, 0, 1]:
					var k := Vector2i(floori(x) + di, floori(z) + dj)
					if celulas.has(k) and absf(x - (k.x + 0.5)) < 0.72 and absf(z - (k.y + 0.5)) < 0.72:
						tapa = true
			if not tapa:
				for R in tampas:
					if R.has_point(Vector2(x, z)):
						tapa = true
						break
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

# Móvel encostado na parede (pedido do André, 2026-11-06): a grade de 0,5 m deixava o baú, o fogão e a bancada
# quase meio metro longe da parede (ou em cima dela, vermelho). Com a mira a até ENCOSTA m da face de uma
# parede/porta/janela, o móvel vai colado nela (folga de 4 cm, que passa pelas juntas). Longe da parede, fica na
# grade de 0,5 m de antes (dá para centralizar). O servidor aceita a posição (arredonda em 5 cm e confere o espaço).
const ENCOSTA := 0.6
const FOLGA_PAREDE := 0.04
func encostar_movel(L: Dictionary, k: String, x: float, z: float, r: int, px: float, pz: float) -> Vector2:
	var R := ret_peca(k, x, z, r)
	var hw := R.size.x / 2.0
	var hd := R.size.y / 2.0
	var nx := x
	var nz := z
	var melhor_x := INF
	var melhor_z := INF
	for o in L.pecas:
		if tipo_peca(o.k) != "borda":
			continue
		var W := ret_peca(o.k, float(o.x), float(o.z), int(o.r))
		if int(o.r) % 2 == 0: # parede ao longo do x: encosta em z
			if R.position.x >= W.end.x - 0.05 or R.end.x <= W.position.x + 0.05:
				continue
			var lado := 1.0 if pz >= float(o.z) else -1.0
			var face: float = W.end.y if lado > 0 else W.position.y
			var dist := absf(pz - face) - hd # quanto a mira (centro) está longe de colar
			if absf(pz - face) <= hd + ENCOSTA and dist < melhor_z:
				melhor_z = dist
				nz = face + lado * (hd + FOLGA_PAREDE)
		else: # parede ao longo do z: encosta em x
			if R.position.y >= W.end.y - 0.05 or R.end.y <= W.position.y + 0.05:
				continue
			var lado := 1.0 if px >= float(o.x) else -1.0
			var face: float = W.end.x if lado > 0 else W.position.x
			var dist := absf(px - face) - hw
			if absf(px - face) <= hw + ENCOSTA and dist < melhor_x:
				melhor_x = dist
				nx = face + lado * (hw + FOLGA_PAREDE)
	return Vector2(snappedf(nx, 0.05), snappedf(nz, 0.05))

static func _cruza(a: Rect2, b: Rect2) -> bool:
	return a.position.x < b.end.x - 0.01 and b.position.x < a.end.x - 0.01 and a.position.y < b.end.y - 0.01 and b.position.y < a.end.y - 0.01

func _fora_do_lote(R: Rect2, l: Dictionary) -> bool:
	return R.position.x < float(l.x0) - 0.01 or R.end.x > float(l.x1) + 0.01 or R.position.y < float(l.z0) - 0.01 or R.end.y > float(l.z1) + 0.01

func motivo_peca(L: Dictionary, k: String, x: float, z: float, r: int) -> String:
	var R := ret_peca(k, x, z, r)
	var T := tipo_peca(k)
	if _fora_do_lote(R, L.def):
		return "Só dá para construir dentro do seu terreno"
	var na_horta := func() -> bool:
		for c in L.horta:
			if _cruza(R, Rect2(L.horta[c].i, L.horta[c].j, 1, 1)):
				return true
		return false
	var movel_cruza := func() -> bool:
		for o in L.pecas:
			if tipo_peca(o.k) == "movel" and _cruza(R, ret_peca(o.k, o.x, o.z, o.r)):
				return true
		return false
	var hp: Vector3 = m.heroi.position
	var em_cima := hp.x > R.position.x - 0.35 and hp.x < R.end.x + 0.35 and hp.z > R.position.y - 0.35 and hp.z < R.end.y + 0.35
	if T == "fundacao":
		if not no_meio_da_grade(x) or not no_meio_da_grade(z):
			return "Fora da grade da casa"
		if fundacao_em(L, x, z) != null:
			return "Já tem fundação aqui"
		if movel_cruza.call():
			return "Lugar ocupado"
		if na_horta.call():
			return "Tem horta aí"
		return ""
	if T == "borda":
		var eixo := r & 1
		if (not (na_linha_da_grade(x) and no_meio_da_grade(z))) if eixo else (not (no_meio_da_grade(x) and na_linha_da_grade(z))):
			return "Fora da grade da casa"
		var apoio := false
		for q in lados_da_borda(x, z, r):
			if fundacao_em(L, q.x, q.y) != null:
				apoio = true
		if not apoio:
			return "%s vai na borda de uma fundação" % D.construcoes[k].nome
		if borda_em(L, x, z, eixo) != null:
			return "Já tem parede aqui"
		if movel_cruza.call():
			return "Lugar ocupado"
		if em_cima:
			return "Saia de cima do lugar"
		return ""
	if T == "telhado":
		if not no_meio_da_grade(x) or not no_meio_da_grade(z):
			return "Fora da grade da casa"
		if fundacao_em(L, x, z) == null:
			return "O telhado vai em cima de uma fundação"
		if telhado_em(L, x, z):
			return "Já tem telhado aqui"
		var tem_apoio := false
		for b in bordas_do_quadrado(x, z):
			if borda_em(L, b[0], b[1], b[2]) != null:
				tem_apoio = true
		var G := grade()
		for dd in [Vector2(G, 0), Vector2(-G, 0), Vector2(0, G), Vector2(0, -G)]:
			if telhado_em(L, x + dd.x, z + dd.y):
				tem_apoio = true
		if not tem_apoio:
			return "Precisa de parede em volta (ou outro telhado do lado)"
		return ""
	for o in L.pecas:
		if not tipo_peca(o.k) in ["fundacao", "telhado"] and _cruza(R, ret_peca(o.k, o.x, o.z, o.r)):
			return "Lugar ocupado"
	if na_horta.call():
		return "Tem horta aí"
	if em_cima:
		return "Saia de cima do lugar"
	return ""

# o que impede desmontar ("" = pode): fundação com telhado ou com parede que só se apoia nela (mesma do servidor)
func motivo_desmontar(L: Dictionary, p: Dictionary) -> String:
	if tipo_peca(p.k) != "fundacao":
		return ""
	if telhado_em(L, p.x, p.z):
		return "Tire o telhado de cima primeiro"
	for b in bordas_do_quadrado(p.x, p.z):
		var o = borda_em(L, b[0], b[1], b[2])
		if o == null:
			continue
		var outra := false
		for q in lados_da_borda(o.x, o.z, o.r):
			if not _mesmo_lugar(p, q.x, q.y) and fundacao_em(L, q.x, q.y) != null:
				outra = true
		if not outra:
			return "Tire as paredes de cima primeiro"
	return ""

# ---------- criar (Quimera: a peça vira item na mochila antes de ir para o chão) ----------
# k: peça (CONSTRUCOES) ou ferramenta da fazenda (enxada, regador). "" = dá para criar
func dados_criar(k: String) -> Dictionary:
	if D.construcoes.has(k):
		return D.construcoes[k]
	return D.get("ferramentas", {}).get(k, {})

func item_criado(k: String) -> String:
	return "obra_" + k if D.construcoes.has(k) else k

func motivo_criar(k: String) -> String:
	var C := dados_criar(k)
	if C.is_empty():
		return "Isso não se cria"
	if not D.construcoes.has(k) and m.P.contar(k) > 0:
		return "Você já tem %s" % str(D.itens[k].nome).to_lower()
	if C.get("bancada", false) and not estacao_perto(["bancada"]):
		return "Crie perto de uma bancada de trabalho (faça a bancada primeiro)"
	for c in C.custo:
		if m.P.contar(c) < int(C.custo[c]):
			return "Falta %s (%d/%d)" % [str(D.itens[c].nome).to_lower(), m.P.contar(c), int(C.custo[c])]
	return ""

# o que o botão Criar faz agora ("" = nada): a peça escolhida, ou a ferramenta que falta na fazenda
func _criar_qual(acao := "") -> String:
	if acao == "":
		acao = sel
	if aba == "fazenda" or acao != sel:
		if acao == "arar" and m.P.contar("enxada") < 1:
			return "enxada"
		if acao == "regar" and m.P.contar("regador") < 1:
			return "regador"
		return ""
	return sel if D.construcoes.has(sel) else ""

func criar() -> void:
	var k := _criar_qual()
	if k == "":
		return
	var mot := motivo_criar(k)
	if mot != "":
		m.hud.aviso(mot)
		m.sons.tocar("dash", -12.0)
		return
	if not _fab.is_empty() and not _fab.get("acabou", false):
		m.hud.aviso("Já está criando: espere a barrinha ou toque em Parar")
		return
	pedir_criar("obra", k)

# abre a janelinha de quantas (construção, aba Criar da mochila e mesa de criar).
# tipo "obra": peça da casa ou ferramenta (ferramenta sai uma só, direto na barrinha); "receita": Ferreiro/Alfaiate.
func pedir_criar(tipo: String, k: String) -> void:
	if not m.on():
		m.hud.aviso("Criar só funciona online (a peça fica na sua conta)")
		return
	if not _fab.is_empty() and not _fab.get("acabou", false):
		m.hud.aviso("Já está criando: espere a barrinha ou toque em Parar")
		return
	if tipo == "obra":
		var mot := motivo_criar(k)
		if mot != "":
			m.hud.aviso(mot)
			return
		if not D.construcoes.has(k):
			m.rede("fabricar", {"k": k, "n": 1})
			return
	_qtd_tipo = tipo
	_qtd_k = k
	qtd = 1
	_mostrar_qtd()
	painel_qtd.visible = true

# custo em materiais de uma unidade (peça: custo; receita: usa)
func _custo_qtd() -> Dictionary:
	return D.receitas[_qtd_k].usa if _qtd_tipo == "receita" else dados_criar(_qtd_k).custo

func _nome_qtd() -> String:
	return str(D.itens[str(D.receitas[_qtd_k].faz)].nome) if _qtd_tipo == "receita" else str(dados_criar(_qtd_k).nome)

# vigor de uma receita (0 nas peças)
func _vigor_qtd() -> float:
	if _qtd_tipo != "receita":
		return 0.0
	var R: Dictionary = D.receitas[_qtd_k]
	return float(m.P.custo_vigor(str(R.prof), float(R.vigor)))

# quantas dá para criar com o que tenho (no máximo a fila do servidor)
func _qtd_max(k: String) -> int:
	var n := _quantas(_custo_qtd()) if k == _qtd_k else _quantas(dados_criar(k).custo)
	var vg := _vigor_qtd() if k == _qtd_k else 0.0
	if vg > 0.0:
		n = mini(n, int(floor(float(m.P.vigor()) / vg + 0.001)))
	return clampi(n, 1, int(D.get("criarObra", {}).get("maxFila", 20)))

# segundos de uma (mesma conta de tempoCriar em shared/dados.js)
func tempo_custo(custo: Dictionary) -> float:
	var R: Dictionary = D.get("criarObra", {"min": 3.0, "max": 5.0, "porMaterial": 0.125})
	var soma := 0
	for c in custo:
		soma += int(custo[c])
	return clampf(float(R.min) + soma * float(R.porMaterial), float(R.min), float(R.max))

func tempo_criar(k: String) -> float:
	return tempo_custo(dados_criar(k).get("custo", {}))

func _mostrar_qtd() -> void:
	var custo := _custo_qtd()
	var mx := _qtd_max(_qtd_k)
	var t := tempo_custo(custo)
	var vg := _vigor_qtd()
	qtd = clampi(qtd, 1, mx)
	txt_qtd_tit.text = "Criar %s" % _nome_qtd()
	var total := {}
	for c in custo:
		total[c] = int(custo[c]) * qtd
	var cada := custo_txt(custo) + ((" · vigor %s" % str(snappedf(vg, 0.1)).replace(".", ",")) if vg > 0.0 else "")
	var tudo := custo_txt(total) + ((" · vigor %s" % str(snappedf(vg * qtd, 0.1)).replace(".", ",")) if vg > 0.0 else "")
	txt_qtd_custo.text = "Cada uma: %s · %s s\nTotal: %s · %s s (dá para %d)" % [cada, str(snappedf(t, 0.1)).replace(".", ","),
		tudo, str(snappedf(t * qtd, 0.1)).replace(".", ","), mx]
	txt_qtd_n.text = str(qtd)
	b_qtd_ok.text = "Criar %d" % qtd

func _mudar_qtd(d: int) -> void:
	qtd = clampi(qtd + d, 1, _qtd_max(_qtd_k)) if d != 999 else _qtd_max(_qtd_k)
	_mostrar_qtd()

func _confirmar_qtd() -> void:
	painel_qtd.visible = false
	if _qtd_tipo == "receita":
		m.rede("criar", {"r": _qtd_k, "n": qtd})
		return
	var mot := motivo_criar(_qtd_k)
	if mot != "":
		m.hud.aviso(mot)
		return
	m.rede("fabricar", {"k": _qtd_k, "n": qtd})

# o servidor começou uma (barrinha do zero) ou acabou a fila
func fabricando(ev: Dictionary) -> void:
	var k := str(ev.get("k", ""))
	var nome := str(ev.get("nome", "")) # receitas mandam o nome
	if nome == "" and k != "":
		nome = str(dados_criar(k).get("nome", ""))
	if ev.get("fim", false):
		if _fab.is_empty():
			return
		_fab.acabou = true
		_fab.feito = int(ev.get("feito", 0))
		_fab.fim = Time.get_ticks_msec() / 1000.0 + 1.2
		barra_fab.value = 1.0 if _fab.feito >= int(_fab.n) else barra_fab.value
		txt_fab.text = ("Pronto: %d %s" % [_fab.feito, nome]) if _fab.feito > 0 else "Parou de criar"
		return
	_fab = {"k": k, "nome": nome, "n": int(ev.get("n", 1)), "feito": int(ev.get("feito", 0)), "dur": maxf(0.1, float(ev.get("dur", 3.0))), "ini": Time.get_ticks_msec() / 1000.0}
	painel_fab.visible = true

func _passo_fab() -> void:
	if _fab.is_empty():
		return
	var agora := Time.get_ticks_msec() / 1000.0
	if _fab.get("acabou", false):
		if agora >= float(_fab.fim):
			_fab = {}
			painel_fab.visible = false
		return
	barra_fab.value = clampf((agora - float(_fab.ini)) / float(_fab.dur), 0.0, 1.0)
	txt_fab.text = "Criando %s · %d de %d" % [_fab.nome, int(_fab.feito) + 1, int(_fab.n)]

func parar_criar() -> void:
	m.rede("fabricar", {"parar": true})

# o servidor criou: brilho e som de bancada; a barra se atualiza quando a mochila chegar
func fabricou(ev: Dictionary) -> void:
	if m.heroi:
		m.fx.texto(m.heroi.position + Vector3(0, 2.0, 0), "+1 " + str(ev.get("nome", "")), Color("ffe2a0"), 0.0)
	m.sons.tocar("forja", -8.0)

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
			if p.k in tipos and Vector2(p.x - hp.x, p.z - hp.z).length() < float(D.lote.estacaoDist) + 0.3 and sem_parede(Vector2(hp.x, hp.z), Vector2(p.x, p.z)):
				return true
	return false

func _fornalha_de_outro_perto() -> bool:
	if m.heroi == null:
		return false
	var hp: Vector3 = m.heroi.position
	for id in lotes:
		if id == meu:
			continue
		for p in lotes[id].pecas:
			if p.k == "fornalha" and Vector2(p.x - hp.x, p.z - hp.z).length() < float(D.lote.estacaoDist) + 0.3 and sem_parede(Vector2(hp.x, hp.z), Vector2(p.x, p.z)):
				return true
	return false

# a receita dá para criar aqui? (oficina do NPC ou a estação certa: shared/dados.js RECEITA_ESTACAO)
func estacao_da_receita(R: Dictionary) -> String:
	var faz := str(R.faz)
	if faz.begins_with("barra_") or faz == "carvao":
		return "fornalha"
	return "bigorna" if str(R.prof) == "fer" else "fogao" if str(R.prof) == "coz" else "bancada"

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

func motivo_terreno(R: Dictionary, menos := "") -> String:
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
		if id != menos and lotes[id].dono != null and R.x0 < o.x1 and o.x0 < R.x1 and R.z0 < o.z1 and o.z0 < R.z1:
			return "Encosta no terreno de outra pessoa"
	# sem frestinha (o mesmo do servidor): lado a lado com o vizinho, ou encosta ou deixa pelo menos lote.fresta m
	for id in lotes:
		if id == menos or lotes[id].dono == null:
			continue
		var o: Dictionary = lotes[id].def
		var vao := 0.0
		if maxf(R.x0, o.x0) < minf(R.x1, o.x1):
			vao = maxf(o.z0 - R.z1, R.z0 - o.z1)
		elif maxf(R.z0, o.z0) < minf(R.z1, o.z1):
			vao = maxf(o.x0 - R.x1, R.x0 - o.x1)
		if vao > 0.01 and vao < float(lo.fresta) - 0.01:
			return "Encoste no vizinho ou deixe %d m de caminho (está com %d m)" % [int(lo.fresta), int(round(vao))]
	return ""

# conta do correio (a mesma do servidor, contaTerreno): semanas fechadas, valor e quando chega a próxima (ms)
func conta_terreno(L: Dictionary) -> Dictionary:
	var sem: float = float(D.lote.taxaDias) * 86400000.0
	var agora := agora_ms()
	var ini: float = float(L.get("taxa", 0.0))
	if ini <= 0.0:
		ini = agora
	var n := maxi(0, floori((agora - ini) / sem))
	var blocos := int(round(float(L.def.x1) - float(L.def.x0))) * int(round(float(L.def.z1) - float(L.def.z0)))
	return {"semanas": n, "valor": n * blocos * int(D.lote.taxaBloco), "porSemana": blocos * int(D.lote.taxaBloco), "proxima": ini + (n + 1) * sem}

func venda_terreno(R: Dictionary) -> int:
	return int(floor((float(R.x1) - float(R.x0)) * (float(R.z1) - float(R.z0)) * float(D.lote.precoBloco) * float(D.lote.venda)))

# ímã: a borda marcada gruda na beira da estrada e na borda dos vizinhos quando passa a até lote.ima m
func _ima(R: Dictionary) -> Dictionary:
	var xs: Array = []
	var zs: Array = []
	for id in lotes:
		if (mudando and id == meu) or lotes[id].dono == null:
			continue
		var o: Dictionary = lotes[id].def
		xs.append_array([float(o.x0), float(o.x1)])
		zs.append_array([float(o.z0), float(o.z1)])
	for e in terras.get("estradas", []):
		var meia: float = float(e.largura) / 2.0 + float(D.lote.folgaRua)
		var pts: Array = e.pontos
		for i in range(1, pts.size()):
			if is_equal_approx(float(pts[i][0]), float(pts[i - 1][0])): # trecho norte-sul
				xs.append_array([ceilf(float(pts[i][0]) + meia), floorf(float(pts[i][0]) - meia)])
			elif is_equal_approx(float(pts[i][1]), float(pts[i - 1][1])): # trecho leste-oeste
				zs.append_array([ceilf(float(pts[i][1]) + meia), floorf(float(pts[i][1]) - meia)])
	var r := R.duplicate()
	var ima := float(D.lote.ima)
	var lmin := float(D.lote.ladoMin)
	for par in [["x0", "x1", xs], ["z0", "z1", zs]]:
		for k in [par[0], par[1]]:
			var melhor := ima + 0.01
			var alvo_ := float(r[k])
			for c in par[2]:
				var dd := absf(float(c) - float(r[k]))
				if dd > 0.01 and dd < melhor:
					melhor = dd
					alvo_ = float(c)
			var outro: float = float(r[par[1]]) if k == par[0] else float(r[par[0]])
			if absf(outro - alvo_) >= lmin:
				r[k] = alvo_
	return r

# ---------- água do regador (André 2026-11-07): 20 regas; enche no poço da praça ou na beira do lago ----------
func agua_regador() -> int:
	return int(m.P.prog.get("agua", D.horta.get("agua", 20)))

# a mesma conta do servidor (shared/simulacao.js pertoDeAgua)
func perto_de_agua(hp: Vector3) -> bool:
	var pc: Dictionary = D.horta.get("poco", {})
	if not pc.is_empty() and Vector2(hp.x - float(pc.x), hp.z - float(pc.z)).length() <= float(pc.r):
		return true
	var b := float(D.horta.get("beira", 2.5))
	for o in [Vector2.ZERO, Vector2(b, 0), Vector2(-b, 0), Vector2(0, b), Vector2(0, -b), Vector2(b, b) * 0.7, Vector2(-b, b) * 0.7, Vector2(b, -b) * 0.7, Vector2(-b, -b) * 0.7]:
		if not m.terreno.no_lago(hp.x + o.x, hp.z + o.y).is_empty():
			return true
	return false

func encher_regador() -> void:
	if not m.on():
		m.hud.aviso("Encher o regador só funciona online")
		return
	m.rede("regador", {})

# o servidor encheu (botão ou mergulho): respingo nas mãos, "+20" azul subindo e o aviso
func encheu(ev: Dictionary) -> void:
	var p: Vector3 = m.heroi.position + Vector3(0, 0.9, 0) + m.heroi.global_transform.basis.z * 0.45
	if m.agua_fx:
		m.agua_fx._espirrar(p, 18)
		get_tree().create_timer(0.3).timeout.connect(func(): m.agua_fx._espirrar(p, 12))
	m.fx.numero(m.heroi.position + Vector3(0, 1.6, 0), float(ev.get("agua", 20)), Color("7cc8ff"))
	m.sons.tocar("pano_1", -6.0, 0.15)
	m.hud.aviso(str(ev.get("texto", "Regador cheio")))

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
	m.hud.mostrar_botao("construir", false) # André 2026-11-06: o martelo foi para o menu do topo (menu_topo.gd), aceso aqui
	_pode_aqui = no_meu and vivo and not comprando
	# estação do terreno perto: um botão só (o André tirou o botão da forja da HUD; a forja do Tomás fica no Falar)
	# 2026-11-07 (André): no meu terreno os botões da mesa, do baú e da fornalha aparecem já ao chegar perto da casa;
	# tocar faz o herói ir andando até o lado da estação (entra pela porta) e só aí ela abre (tocar_estacao)
	# FPS (2026-11-07): os botões das estações passam por todas as peças de todos os terrenos (e pela conta de parede no
	# meio); 7 vezes por segundo basta (o botão aparece no máximo 0,15 s depois). Muda o modo, morre ou abre/fecha a
	# construção: confere na hora.
	_t_botoes -= dt
	var chave_b := [vivo, livre, no_meu]
	if _t_botoes <= 0.0 or chave_b != _chave_botoes:
		_t_botoes = 0.15
		_chave_botoes = chave_b
		_botoes_estacao(no_meu, vivo, livre, hp)
	_passo_ir_estacao()
	_passo_forno(dt)
	_passo_fab()
	_mexer_portas(hp, dt)
	_telhados_visiveis(hp, dt)
	_moveis_dentro(hp)
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
		for id in _correios:
			_por_correio(id)
		for id in lotes:
			for c in lotes[id].horta:
				var h: Dictionary = lotes[id].horta[c]
				var d2: float = h.no.position.distance_squared_to(hp)
				if d2 < 3600.0:
					_desenhar_canteiro(h)
				_info_planta(h, d2 < INFO_PERTO * INFO_PERTO)

func _botoes_estacao(no_meu: bool, vivo: bool, livre: bool, hp: Vector3) -> void:
	var prof := prof_da_estacao()
	var mesa_minha := _mais_perta(_pecas_minhas(["bancada", "bigorna", "fogao"]))
	var correio := _meu_correio_perto() and prof == ""
	var com_mesa := prof != "" or (no_meu and not mesa_minha.is_empty() and not correio)
	m.hud.mostrar_botao("bancada", com_mesa and vivo and not livre)
	if prof != "":
		m.hud.icone_botao("bancada", "pf_" + prof)
	elif not mesa_minha.is_empty():
		m.hud.icone_botao("bancada", "pf_alf" if mesa_minha.k == "bancada" else "pf_coz" if mesa_minha.k == "fogao" else "pf_fer")
	m.hud.mostrar_botao("bau", ((no_meu and not _pecas_minhas(["bau"]).is_empty()) or _meu_bau_perto()) and vivo and not livre)
	m.hud.mostrar_botao("forno", ((no_meu and not _pecas_minhas(["fornalha"]).is_empty()) or minha_fornalha_perto() != "") and vivo and not livre)
	m.hud.mostrar_botao("correio", correio and vivo and not livre)
	# dormir (dia e noite do Quimera, André 2026-11-07): só à noite, no meu terreno ou com a minha cama perto
	# André 2026-11-07 ("cliquei na cama e não aconteceu nada"): perto da cama o botão aparece também de dia (aí o
	# servidor responde que só dá à noite e diz a hora); à noite, em qualquer lugar do meu terreno
	var noite: bool = m.get("dia") != null and m.dia.eh_noite()
	m.hud.mostrar_botao("cama", ((noite and no_meu and not _pecas_minhas(["cama"]).is_empty()) or not _cama_perto().is_empty()) and vivo and not livre)
	m.hud.mostrar_botao("encher", m.P.contar("regador") > 0 and agua_regador() < int(D.horta.get("agua", 20)) and perto_de_agua(hp) and vivo and not livre)
	if painel_bau.visible and (not _meu_bau_perto() or not vivo or livre):
		fechar_bau()
	if painel_forno.visible and (minha_fornalha_perto() != forno_id or not vivo or livre):
		fechar_forno()

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
	mira.y = _piso(mira.x, mira.z) # dentro da casa a mira fica no piso, não em cima do telhado
	if andar == "telhado" and lotes.has(meu): # mexendo no telhado (André 2026-11-05): a câmera sobe até o alto das paredes
		mira.y = maxf(mira.y, _topo_parede(mira.x, mira.z) - 0.6)
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
	plano.parar() # trabalhando no plano: para; o que falta continua marcado
	ativo = true
	giro = 0
	andar = "terreo"
	var hp: Vector3 = m.heroi.position
	var ry: float = m.mov.ry
	mira = hp + Vector3(sin(ry), 0, cos(ry)) * 2.0
	painel.visible = true
	painel_acoes.visible = true
	_montar_itens()
	_alt.clear()
	_mostrar_borda(true)
	m.hud.aviso("Modo construção: o joystick move a câmera e a mira. Toque no chão para mirar.")

func sair() -> void:
	if not ativo:
		return
	ativo = false
	painel.visible = false
	painel_acoes.visible = false
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
	var y := func(x: float, z: float) -> float: return _alt_em(x, z)
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

# altura do chão guardada nos pontos inteiros da grade (1 m); entre eles, interpolada
func _alt_grade(i: int, k: int) -> float:
	var c := Vector2i(i, k)
	var v = _alt.get(c)
	if v == null:
		v = m.terreno.altura(float(i), float(k)) + 0.05
		_alt[c] = v
	return v

func _alt_em(x: float, z: float) -> float:
	var i := floori(x)
	var k := floori(z)
	var fx := x - i
	var fz := z - k
	var a := _alt_grade(i, k)
	if fx < 0.001 and fz < 0.001:
		return a
	var b := _alt_grade(i + 1, k)
	var c := _alt_grade(i, k + 1)
	var d := _alt_grade(i + 1, k + 1)
	return lerpf(lerpf(a, b, fx), lerpf(c, d, fx), fz)

# retângulo fino alinhado aos eixos (linha da grade), 5 mm acima do miolo
func _faixa(im: ImmediateMesh, a: Vector2, b: Vector2, cor: Color, y: Callable) -> void:
	var q := [Vector3(a.x, y.call(a.x, a.y) + 0.005, a.y), Vector3(b.x, y.call(b.x, a.y) + 0.005, a.y),
		Vector3(b.x, y.call(b.x, b.y) + 0.005, b.y), Vector3(a.x, y.call(a.x, b.y) + 0.005, b.y)]
	for v in [q[0], q[1], q[2], q[0], q[2], q[3]]:
		im.surface_set_color(cor)
		im.surface_add_vertex(v)

# profissão da estação construída mais perto: bancada = Alfaiate, bigorna ou fornalha = Ferreiro ("" = nenhuma)
func prof_da_estacao() -> String:
	if estacao_perto(["bigorna"]) or _fornalha_de_outro_perto(): # a minha fornalha tem botão próprio (2026-11-07)
		return "fer"
	if estacao_perto(["bancada"]):
		return "alf"
	if estacao_perto(["fogao"]): # fogão (2026-11-07): Cozinheiro
		return "coz"
	return ""

# no meu terreno e vivo: o martelo do topo fica aceso
var _pode_aqui := false
var _t_botoes := 0.0 # FPS: os botões das estações se conferem a cada 0,15 s (_process)
var _chave_botoes := []
func pode_construir_aqui() -> bool:
	return _pode_aqui

func tocar_botao_construir() -> void:
	if ativo:
		sair()
	else:
		abrir()

# ponto do chão debaixo do dedo (plano na altura da mira, refinado duas vezes pelo relevo)
# o toque caiu em cima de uma cama minha? (distância do raio da câmera até o meio da cama, ~0,5 m acima do chão)
func _tocou_cama(pos: Vector2) -> bool:
	if m.camera == null or m.heroi == null or m.h.morto > 0.0:
		return false
	var o: Vector3 = m.camera.project_ray_origin(pos)
	var d: Vector3 = m.camera.project_ray_normal(pos)
	for p in _pecas_minhas(["cama"]):
		var c := Vector3(p.x, _piso(p.x, p.z) + 0.45, p.z)
		var t: float = maxf(0.0, (c - o).dot(d))
		if (o + d * t).distance_to(c) < 1.1 and t < 40.0:
			tocar_estacao("cama")
			return true
	return false

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
	if not ativo and not comprando and _tocou_cama(pos): # tocar na minha cama: vai até ela e dorme (ou diz por que não)
		return
	if comprando and not cobre(pos):
		var a = _alca_na_tela(pos, ["mais", "menos"])
		if a != null:
			_crescer(int(a.lado), 1 if a.tipo == "mais" else -1)
		return
	if not ativo or cobre(pos):
		return
	var p = _chao_na_tela(pos)
	if p != null and lotes.has(meu) and dist_ret(lotes[meu].def, p.x, p.z) <= 1.5:
		mira = p
		if aba == "fazenda" and plano and plano.planeja(sel): # fazenda: tocar no canteiro já marca (ou desmarca)
			_atualizar_mira()
			colocar()

func _atualizar_mira() -> void:
	var p: Vector3 = mira
	var L = lotes.get(meu)
	if L == null:
		sair()
		return
	alvo = {"ok": false, "motivo": ""}
	if aba == "fazenda" or aba == "terreno" or sel == "desmontar":
		_mostrar_fantasma("")
	if aba == "terreno":
		# mudar o tamanho ou vender: o botão abre a tela de marcar ou a pergunta (não depende da mira)
		_destaque_em(null)
		var c := conta_terreno(L)
		if sel == "vender":
			alvo = {"ok": true, "motivo": "Recebe %d de ouro" % maxi(0, venda_terreno(L.def) - int(c.valor))}
		elif int(c.semanas) > 0:
			alvo = {"ok": false, "motivo": "Pague o correio antes (%d de ouro)" % int(c.valor)}
		else:
			alvo = {"ok": true, "motivo": "Toque em Mudar"}
	elif aba != "fazenda" and sel != "desmontar":
		var T := tipo_peca(sel)
		var G := grade()
		var x: float
		var z: float
		var r := giro
		if T == "fundacao" or T == "telhado": # no meio do quadrado de 2 m
			x = floorf(p.x / G) * G + G / 2.0
			z = floorf(p.z / G) * G + G / 2.0
		elif T == "borda": # na borda mais perto; Girar vira a frente da parede
			var ax := floorf(p.x / G) * G + G / 2.0
			var az := roundf(p.z / G) * G
			var bx := roundf(p.x / G) * G
			var bz := floorf(p.z / G) * G + G / 2.0
			if absf(p.z - az) <= absf(p.x - bx):
				x = ax; z = az; r = 2 * (giro % 2)
			else:
				x = bx; z = bz; r = 1 + 2 * (giro % 2)
		else: # móvel: grade de 0,5 m
			x = round(p.x * 2.0) / 2.0
			z = round(p.z * 2.0) / 2.0
			var enc := encostar_movel(L, sel, x, z, r, p.x, p.z)
			x = enc.x
			z = enc.y
		var mot := motivo_peca(L, sel, x, z, r)
		if mot == "" and L.pecas.size() >= max_pecas(L, D.lote):
			mot = "Limite de %d peças no terreno" % max_pecas(L, D.lote)
		if m.P.contar("obra_" + sel) < 1: # não tem a peça pronta: diz o que falta para criar
			var mc := motivo_criar(sel)
			if mc != "":
				mot = "Para criar: " + mc.substr(0, 1).to_lower() + mc.substr(1)
			elif mot == "":
				mot = "Toque em Criar primeiro (%s)" % custo_txt(D.construcoes[sel].custo)
		alvo = {"ok": mot == "", "motivo": mot, "tipo": "construir", "dados": {"k": sel, "x": x, "z": z, "r": r}}
		_mostrar_fantasma(sel)
		var y: float = _y_peca({"k": sel, "x": x, "z": z, "r": r}) + (0.0 if T == "fundacao" else 0.01)
		if T == "telhado":
			y = _y_rampa_nova(L, x, z, r) # já na altura em que a rampa vai ficar (a seguinte sobe)
		fantasma.position = Vector3(x, y, z)
		fantasma.rotation.y = r * PI / 2.0
		_pintar_fantasma(alvo.ok)
		_destaque_em(null)
	elif sel == "desmontar":
		# o que está mais em cima sai primeiro: telhado, parede/porta/janela, móvel e por último a fundação
		var achou = null
		var md := 1e9
		var ordem := {"telhado": 0, "borda": 1, "movel": 2, "fundacao": 3}
		for o in L.pecas:
			if not no_andar(o.k): # só o andar escolhido (no térreo o telhado não atrapalha a janela)
				continue
			var R := ret_peca(o.k, o.x, o.z, o.r).grow(0.3)
			var dd: float = Vector2(o.x - p.x, o.z - p.z).length() + ordem.get(tipo_peca(o.k), 2) * 100.0
			if R.has_point(Vector2(p.x, p.z)) and dd < md:
				md = dd
				achou = o
		if achou:
			var dm := motivo_desmontar(L, achou)
			alvo = {"ok": dm == "", "motivo": dm if dm != "" else "Vai desmontar: %s (volta para a mochila)" % D.construcoes[achou.k].nome, "tipo": "desmontar", "dados": {"p": achou.id}}
			var R2 := ret_peca(achou.k, achou.x, achou.z, achou.r)
			var T2 := tipo_peca(achou.k)
			var y0: float = _chao(achou.x, achou.z)
			var alto := 1.2
			if T2 == "telhado":
				y0 = _topo_parede(achou.x, achou.z) - 0.3
				alto = 2.4
			elif T2 == "borda":
				alto = 3.3
			elif T2 == "fundacao":
				alto = 0.35
			_destaque_em(Vector3(R2.get_center().x, y0, R2.get_center().y), Vector3(R2.size.x + 0.1, alto, R2.size.y + 0.1), Color(1, 0.35, 0.29, 0.35))
		else:
			alvo = {"ok": false, "motivo": "Mire numa peça sua para desmontar"}
			_destaque_em(null)
	else:
		# horta: quadrado de 1 m
		var i := floori(p.x)
		var j := floori(p.z)
		var c := "%d,%d" % [i, j]
		var dados := {"acao": sel, "c": c}
		if sel == "plantar":
			dados.s = semente
		var mot := motivo_fazenda(L, sel, i, j, semente)
		# planejar (André 2026-11-07): arar, plantar, regar e colher só marcam; o Salvar põe o herói para trabalhar
		if plano and plano.planeja(sel):
			mot = plano.motivo_marcar(L, dados, mot)
		alvo = {"ok": mot == "", "motivo": mot, "tipo": "horta", "dados": dados}
		if mot == "" and plano and plano.planeja(sel):
			alvo.motivo = plano.dica(dados)
		_destaque_em(Vector3(i + 0.5, m.terreno.altura(i + 0.5, j + 0.5), j + 0.5), Vector3(1.0, 0.16, 1.0), Color(0.43, 1.0, 0.54, 0.35) if alvo.ok else Color(1, 0.35, 0.29, 0.35))
	txt_motivo.text = alvo.motivo if alvo.motivo != "" else "Pode colocar aqui"
	txt_motivo.add_theme_color_override("font_color", Color("b8f0a0") if alvo.ok else Color("ffb3a3"))
	b_ok.disabled = not alvo.ok

# por que a ação da fazenda não pode ser feita no quadrado (i, j) ('' = pode). Usado na mira e no plano (fazenda_plano.gd)
func motivo_fazenda(L: Dictionary, acao: String, i: int, j: int, s: String) -> String:
	var h = L.horta.get("%d,%d" % [i, j])
	var mot := ""
	match acao:
		"arar":
			mot = "Essa terra já está arada" if h != null else motivo_horta(L, i, j)
		"plantar":
			if h == null:
				mot = "Precisa arar a terra primeiro"
			elif h.c != "":
				mot = "Já tem planta aqui"
			elif m.P.contar("semente_" + s) < 1:
				mot = "Sem semente de %s (a Rosa vende)" % str(D.plantas[s].nome).to_lower()
		"regar":
			if h == null:
				mot = "Precisa arar a terra primeiro"
			elif _molhada(h):
				mot = "A terra ainda está molhada"
			elif m.P.contar("regador") > 0 and agua_regador() <= 0:
				mot = "Regador sem água: encha no poço da vila ou na beira de um lago"
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
	if mot == "" and _criar_qual(acao) != "":
		var f := _criar_qual(acao)
		var mc := motivo_criar(f)
		mot = "Precisa de %s: toque em Criar%s" % [str(D.itens[f].nome).to_lower(), "" if mc == "" else " (" + mc.to_lower() + ")"]
	if mot == "" and m.P.vigor() < float(m.P.custo_vigor("faz", float(D.horta.vigor))) and acao != "tirar":
		mot = "Sem vigor: ele volta sozinho com o tempo (cheio a cada 6 h) ou durma na cama"
	return mot

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
	_fantasma_cor = -1
	add_child(fantasma)
	for mi in fantasma.find_children("*", "MeshInstance3D", true, false):
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

var _fantasma_cor := -1 # FPS: a cor do fantasma (1 pode, 0 não) só se repinta quando muda
func _pintar_fantasma(ok: bool) -> void:
	if int(ok) == _fantasma_cor:
		return
	_fantasma_cor = int(ok)
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
	if aba == "terreno" and alvo.get("ok", false):
		if sel == "vender":
			_perguntar_venda()
		else:
			perguntar_mudar()
		return
	if not alvo.get("ok", false):
		m.hud.aviso(str(alvo.get("motivo", "")))
		m.sons.tocar("dash", -12.0)
		return
	if alvo.tipo == "horta" and plano and plano.planeja(str(alvo.dados.acao)): # só marca; o Salvar faz tudo
		plano.alternar(alvo.dados)
		_montar_itens()
		_atualizar_mira()
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
	mudando = false
	_canto_a = null
	_canto_b = null
	_ret = {}
	_mudar_ini = {}
	mira = m.heroi.position
	_abrir_tela_compra()

func sair_compra() -> void:
	if not comprando:
		return
	comprando = false
	painel_compra.visible = false
	var voltar := mudando
	mudando = false
	for n in [_ret_no, _outros_no, _ret_txt, _mira_no]:
		if n:
			n.visible = false
	_mostrar_alcas(false)
	m.cam.sair_livre()
	if voltar and lotes.has(meu) and m.h.morto <= 0.0 and not m.menu.aberto():
		abrir() # volta para o modo construção, na aba Terreno

# fase 0 = encostou o dedo (primeiro canto), 1 = arrastando, 2 = soltou
func arrasto(pos: Vector2, fase_: int) -> void:
	if not comprando or (fase_ == 0 and cobre(pos)):
		return
	var p = _chao_na_tela(pos)
	if p == null:
		return
	var c := Vector2i(floori(p.x), floori(p.z))
	if fase_ == 0 and not _ret.is_empty():
		# mudar o tamanho: encostou perto de um canto, o canto oposto fica parado e este acompanha o dedo
		var perto := 1e9
		for cx in [float(_ret.x0), float(_ret.x1)]:
			for cz in [float(_ret.z0), float(_ret.z1)]:
				var dd := Vector2(p.x - cx, p.z - cz).length()
				if dd < perto and dd <= 4.0: # a alça do canto se pega pela tela (pega_arrasto); de longe o dedo fica a uns metros
					perto = dd
					var ox: int = int(_ret.x1) - 1 if cx == float(_ret.x0) else int(_ret.x0)
					var oz: int = int(_ret.z1) - 1 if cz == float(_ret.z0) else int(_ret.z0)
					_canto_a = Vector2i(ox, oz)
		if perto < 1e9:
			_canto_b = c
			_ret = _ima({"x0": mini(_canto_a.x, _canto_b.x), "z0": mini(_canto_a.y, _canto_b.y), "x1": maxi(_canto_a.x, _canto_b.x) + 1, "z1": maxi(_canto_a.y, _canto_b.y) + 1})
			_atualizar_compra()
			return
	if fase_ == 0 or _canto_a == null:
		_canto_a = c
	_canto_b = c
	_ret = _ima({"x0": mini(_canto_a.x, _canto_b.x), "z0": mini(_canto_a.y, _canto_b.y), "x1": maxi(_canto_a.x, _canto_b.x) + 1, "z1": maxi(_canto_a.y, _canto_b.y) + 1})
	_atualizar_compra()

# ---------- mudar o tamanho do meu terreno (aba Terreno do modo construção): a mesma tela da compra ----------
func perguntar_mudar() -> void:
	if not lotes.has(meu):
		return
	sair()
	comprando = true
	mudando = true
	var d: Dictionary = lotes[meu].def
	_ret = {"x0": int(d.x0), "z0": int(d.z0), "x1": int(d.x1), "z1": int(d.z1)}
	_mudar_ini = _ret.duplicate()
	_canto_a = null
	_canto_b = null
	mira = Vector3((float(d.x0) + float(d.x1)) / 2.0, 0, (float(d.z0) + float(d.z1)) / 2.0)
	_abrir_tela_compra()
	m.cam.zoom(1.35) # um pouco mais longe: o terreno inteiro cabe na tela

func _abrir_tela_compra() -> void:
	_alt.clear()
	_chave_compra = ""
	painel_compra.visible = true
	_desenhar_outros()
	_atualizar_compra()
	m.hud.aviso("Joystick: anda com a câmera · arraste a tela: gira · dois dedos: zoom")

# botão da barra: na compra apaga o marcado (marca de novo); no mudar volta ao tamanho de antes
# (mexeu e quer voltar: Desfazer; já está no tamanho de antes: Marcar de novo, para marcar outro pedaço perto)
func recomecar() -> void:
	_canto_a = null
	_canto_b = null
	_ret = _mudar_ini.duplicate() if (mudando and not _igual_ret(_ret, _mudar_ini)) else {}
	_atualizar_compra()

# o que muda de ouro: aumentar paga os blocos novos (preço cheio); diminuir devolve lote.venda do preço
func custo_mudar(R: Dictionary) -> int:
	var d: Dictionary = lotes[meu].def
	var antes := int(round((float(d.x1) - float(d.x0)) * (float(d.z1) - float(d.z0))))
	var depois := int(round((float(R.x1) - float(R.x0)) * (float(R.z1) - float(R.z0))))
	if depois > antes:
		return (depois - antes) * int(D.lote.precoBloco)
	return -int(floor((antes - depois) * float(D.lote.precoBloco) * float(D.lote.venda)))

func _motivo_mudar(R: Dictionary) -> String:
	var L: Dictionary = lotes[meu]
	var mot := motivo_terreno(R, meu)
	if mot != "":
		return mot
	var Rr := Rect2(float(R.x0), float(R.z0), float(R.x1) - float(R.x0), float(R.z1) - float(R.z0)).grow(0.01)
	for p in L.pecas:
		if not Rr.encloses(ret_peca(p.k, p.x, p.z, p.r)):
			return "Tem peça fora do terreno novo: desmonte ou marque maior"
	for c in L.horta:
		var h: Dictionary = L.horta[c]
		if not Rr.encloses(Rect2(h.i, h.j, 1, 1)):
			return "Tem horta fora do terreno novo: desfaça a terra ou marque maior"
	var mx := max_pecas({"def": R}, D.lote)
	if L.pecas.size() > mx:
		return "O terreno novo só comporta %d peças (você tem %d)" % [mx, L.pecas.size()]
	return ""

# ---------- vender o terreno de volta para o jogo ----------
func _perguntar_venda() -> void:
	var L = lotes.get(meu)
	if L == null:
		return
	var c := conta_terreno(L)
	var valor := maxi(0, venda_terreno(L.def) - int(c.valor))
	var pago := preco_terreno(L.def)
	var txt := "Vender o terreno para o jogo por %d de ouro? (vale %d, volta a metade)" % [valor, pago]
	if L.pecas.size() > 0:
		txt += "\nAs %d peças voltam para a mochila." % L.pecas.size()
	m.troca.mostrar_cartao(txt, [["Vender", func(): m.troca.esconder_cartao(); m.rede("venderLote", {})], ["Cancelar", func(): m.troca.esconder_cartao()]], 20.0)

# ---------- caixa de correio na frente de cada terreno: a conta da taxa semanal chega nela ----------
func _modelo_correio() -> Node3D:
	# caixinha de madeira com telhadinho de duas águas (rústica, como as casas da vila), boca de ferro e bandeirinha
	var r := Node3D.new()
	var poste := _mat_tex("medieval_wood", Color("8a6a4a"), 2.0)
	var tabua := _mat_tex("medieval_wood", Color(1.35, 1.1, 0.82), 3.0) # tábua clara (a textura é escura)
	var telha := _mat_tex("medieval_wood", Color("7a4e34"), 3.0)
	var ferro := _mat_cor(Color(0.16, 0.15, 0.15))
	_caixa(r, Vector3(0.09, 1.0, 0.09), Vector3(0, 0.5, 0), poste)
	_caixa(r, Vector3(0.28, 0.06, 0.28), Vector3(0, 0.03, 0), poste)
	_caixa(r, Vector3(0.05, 0.32, 0.05), Vector3(0, 0.86, -0.1), poste, Vector3(0.7, 0, 0)) # mão-francesa
	_caixa(r, Vector3(0.3, 0.24, 0.44), Vector3(0, 1.1, 0), tabua)
	for lado in [-1.0, 1.0]: # telhadinho
		_caixa(r, Vector3(0.22, 0.03, 0.5), Vector3(0.085 * lado, 1.27, 0), telha, Vector3(0, 0, -0.62 * lado))
	_caixa(r, Vector3(0.2, 0.05, 0.02), Vector3(0, 1.15, 0.225), ferro) # boca
	_caixa(r, Vector3(0.012, 0.012, 0.46), Vector3(0, 1.32, 0), ferro) # cumeeira
	var haste := _caixa(r, Vector3(0.025, 0.3, 0.025), Vector3(0.165, 1.18, -0.12), ferro)
	haste.name = "haste"
	var bandeira := _caixa(r, Vector3(0.02, 0.1, 0.15), Vector3(0.165, 1.28, -0.05), _mat_cor(Color(0.85, 0.18, 0.14)))
	bandeira.name = "bandeira"
	return r

# a caixa fica no canto do terreno mais perto da estrada central, virada para ela
func _por_correio(id: String) -> void:
	var L = lotes.get(id)
	if L == null or L.dono == null:
		return
	var no: Node3D = _correios.get(id)
	if no == null:
		no = _modelo_correio()
		no.name = "Correio"
		L.raiz.add_child(no)
		_correios[id] = no
	var d: Dictionary = L.def
	var rua_x := -16.0
	for e in terras.get("estradas", []):
		rua_x = float(e.pontos[0][0])
	var lado := 1.0 if (float(d.x0) + float(d.x1)) / 2.0 < rua_x else -1.0 # a estrada fica a leste (+x) ou a oeste
	var x: float = (float(d.x1) - 0.35) if lado > 0 else (float(d.x0) + 0.35)
	var z: float = clampf(float(d.z0) + 0.45, float(d.z0), float(d.z1))
	no.position = Vector3(x, m.terreno.altura(x, z), z)
	no.rotation.y = PI / 2.0 * lado # a boca (+z do modelo) olha para a estrada
	var c := conta_terreno(L)
	var levantada := int(c.semanas) > 0
	no.get_node("bandeira").position = Vector3(0.165, 1.28, -0.05) if levantada else Vector3(0.165, 1.08, -0.2)
	no.get_node("bandeira").rotation.x = 0.0 if levantada else PI / 2.0

func _meu_correio_perto() -> bool:
	var no: Node3D = _correios.get(meu)
	return no != null and m.heroi != null and no.global_position.distance_to(m.heroi.position) <= 2.6

func abrir_correio() -> void:
	var L = lotes.get(meu)
	if L == null:
		return
	var c := conta_terreno(L)
	var dias := maxf(0.0, (float(c.proxima) - agora_ms()) / 86400000.0)
	var prox := ("a próxima chega em %d dia%s" % [ceili(dias), "" if ceili(dias) == 1 else "s"]) if dias >= 1.0 else "a próxima chega hoje"
	if int(c.valor) > 0:
		var txt := "Conta do terreno: %d de ouro (%d semana%s de %d)." % [int(c.valor), int(c.semanas), "" if int(c.semanas) == 1 else "s", int(c.porSemana)]
		if int(c.semanas) >= int(D.lote.taxaTrava):
			txt += "\nAtrasada: sem pagar não dá para construir nem plantar."
		m.troca.mostrar_cartao(txt, [["Pagar", func(): m.troca.esconder_cartao(); m.rede("pagarTaxa", {})], ["Fechar", func(): m.troca.esconder_cartao()]], 20.0)
	else:
		m.troca.mostrar_cartao("Correio vazio. A taxa do terreno é %d de ouro por semana (%d por bloco); %s." % [int(c.porSemana), int(D.lote.taxaBloco), prox], [["Fechar", func(): m.troca.esconder_cartao()]], 12.0)

func _atualizar_compra() -> void:
	var ouro := int(m.P.prog.get("ouro", 0))
	var chave := "%s|%d|%s|%d" % [str(_ret), ouro, str(mudando), lotes.size()]
	if chave == _chave_compra:
		return # nada mudou: não repinta (antes era todo quadro)
	_chave_compra = chave
	b_recomecar.text = "Desfazer" if (mudando and not _ret.is_empty() and not _igual_ret(_ret, _mudar_ini)) else "Marcar de novo"
	b_recomecar.disabled = _ret.is_empty()
	txt_compra_tit.text = "Mudar o terreno" if mudando else "Comprar terreno"
	b_comprar.text = "Confirmar" if mudando else "Comprar"
	if mudando and not _ret.is_empty() and lotes.has(meu):
		_atualizar_mudar(ouro)
		return
	if _ret.is_empty():
		_mostrar_alcas(false)
		txt_compra.text = "1. Encoste o dedo no chão e arraste para marcar o terreno"
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
	txt_compra_info.text = ("2. Ajuste: toque no + ou - de um lado (1 m) ou arraste um canto dourado · 3. Comprar · você tem %d de ouro" % ouro) if ok else _ret_motivo
	b_comprar.disabled = not ok
	_pintar_marcado(ok, "%d x %d m\n%d de ouro" % [w, d, preco])

# chão pintado: verde (dá) ou vermelho (não dá), quadriculado de 1 m, com o tamanho e o preço em cima
func _pintar_marcado(ok: bool, texto: String) -> void:
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
	_ret_txt.text = texto
	_ret_txt.modulate = Color("fff1c8") if ok else Color("ffb3a3")
	_ret_txt.visible = true
	_por_alcas()

# mudar o tamanho: o mesmo desenho da compra, com o preço da diferença
func _atualizar_mudar(ouro: int) -> void:
	var w: int = int(_ret.x1) - int(_ret.x0)
	var d: int = int(_ret.z1) - int(_ret.z0)
	var custo := custo_mudar(_ret)
	_ret_motivo = _motivo_mudar(_ret)
	if _ret_motivo == "" and custo > ouro:
		_ret_motivo = "Faltam %d de ouro" % (custo - ouro)
	var L: Dictionary = lotes[meu]
	var igual: bool = int(_ret.x0) == int(L.def.x0) and int(_ret.z0) == int(L.def.z0) and int(_ret.x1) == int(L.def.x1) and int(_ret.z1) == int(L.def.z1)
	var ok := _ret_motivo == "" and not igual
	var preco_txt := ("paga %d de ouro" % custo) if custo > 0 else (("recebe %d de ouro" % -custo) if custo < 0 else "sem custo")
	txt_compra.text = "%d x %d m = %d blocos · %s" % [w, d, w * d, preco_txt]
	txt_compra.add_theme_color_override("font_color", Menu.OURO_CLARO if (ok or igual) else Color("ffb3a3"))
	if igual:
		txt_compra_info.text = "1. Toque no + de um lado para crescer 1 m (- encolhe) ou arraste um canto dourado · 2. Confirmar · aumentar: %d por bloco, diminuir: volta %d" % [int(D.lote.precoBloco), int(float(D.lote.precoBloco) * float(D.lote.venda))]
	else:
		txt_compra_info.text = ("Você tem %d de ouro · cabem %d peças" % [ouro, max_pecas({"def": _ret}, D.lote)]) if ok else _ret_motivo
	b_comprar.disabled = not ok
	_pintar_marcado(ok or igual, "%d x %d m\n%s" % [w, d, preco_txt])

# ---------- alças da expansão: + e - no meio de cada lado, cantos dourados para arrastar ----------
# lado: 0 = x0 (oeste), 1 = x1 (leste), 2 = z0, 3 = z1
func _crescer(lado: int, n: int) -> void:
	if _ret.is_empty():
		return
	var r := _ret.duplicate()
	match lado:
		0: r.x0 = float(r.x0) - n
		1: r.x1 = float(r.x1) + n
		2: r.z0 = float(r.z0) - n
		3: r.z1 = float(r.z1) + n
	if float(r.x1) - float(r.x0) < 1.0 or float(r.z1) - float(r.z0) < 1.0:
		return
	_ret = r
	m.sons.tocar("dash", -14.0)
	_atualizar_compra()

func _nova_alca(tipo: String, lado: int) -> Dictionary:
	var raiz := Node3D.new()
	var disco := MeshInstance3D.new()
	var cil := CylinderMesh.new()
	cil.top_radius = 0.45 if tipo != "canto" else 0.3
	cil.bottom_radius = cil.top_radius
	cil.height = 0.06
	cil.radial_segments = 20
	disco.mesh = cil
	var mt := StandardMaterial3D.new()
	mt.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mt.albedo_color = {"canto": Color(1.0, 0.82, 0.35), "mais": Color(0.36, 0.78, 0.4), "menos": Color(0.85, 0.42, 0.32)}[tipo]
	mt.no_depth_test = true
	mt.render_priority = 3
	disco.material_override = mt
	disco.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	raiz.add_child(disco)
	if tipo != "canto":
		var t := Label3D.new()
		t.font = m.fonte_nome()
		t.text = "+" if tipo == "mais" else "-"
		t.font_size = 110
		t.pixel_size = 0.0011
		t.outline_size = 18
		t.outline_modulate = Color(0.08, 0.06, 0.04)
		t.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		t.no_depth_test = true
		t.fixed_size = true
		t.render_priority = 6 # por cima do disco
		t.outline_render_priority = 5
		t.position = Vector3(0, 0.08, 0)
		raiz.add_child(t)
	else: # poste baixo no canto: dá para ver que se pega ali
		var poste := MeshInstance3D.new()
		var pm := CylinderMesh.new()
		pm.top_radius = 0.06
		pm.bottom_radius = 0.08
		pm.height = 0.7
		poste.mesh = pm
		poste.material_override = mt
		poste.position = Vector3(0, 0.35, 0)
		poste.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		raiz.add_child(poste)
	add_child(raiz)
	return {"no": raiz, "tipo": tipo, "lado": lado}

func _mostrar_alcas(v: bool) -> void:
	for a in _alcas:
		a.no.visible = v

func _por_alcas() -> void:
	if _alcas.is_empty():
		for i in 4:
			_alcas.append(_nova_alca("canto", i))
		for i in 4:
			_alcas.append(_nova_alca("mais", i))
			_alcas.append(_nova_alca("menos", i))
	var x0 := float(_ret.x0)
	var x1 := float(_ret.x1)
	var z0 := float(_ret.z0)
	var z1 := float(_ret.z1)
	var cx := (x0 + x1) / 2.0
	var cz := (z0 + z1) / 2.0
	var meio := [Vector2(x0, cz), Vector2(x1, cz), Vector2(cx, z0), Vector2(cx, z1)]
	var fora := [Vector2(-1, 0), Vector2(1, 0), Vector2(0, -1), Vector2(0, 1)]
	var cantos := [Vector2(x0, z0), Vector2(x1, z0), Vector2(x1, z1), Vector2(x0, z1)]
	for a in _alcas:
		var p: Vector2
		if a.tipo == "canto":
			p = cantos[a.lado]
		else:
			p = meio[a.lado] + fora[a.lado] * (0.9 if a.tipo == "mais" else -0.9)
		a.no.position = Vector3(p.x, _alt_em(p.x, p.y), p.y)
		a.no.visible = true

# a alça mais perto do dedo na tela (até 64 px), ou null
func _alca_na_tela(pos: Vector2, tipos: Array):
	if m.camera == null:
		return null
	var melhor = null
	var perto := 64.0
	for a in _alcas:
		if not a.no.visible or not (a.tipo in tipos):
			continue
		var w: Vector3 = a.no.global_position + Vector3(0, 0.2 if a.tipo == "canto" else 0.08, 0)
		if m.camera.is_position_behind(w):
			continue
		var dd: float = m.camera.unproject_position(w).distance_to(pos)
		if dd < perto:
			perto = dd
			melhor = a
	return melhor

static func _igual_ret(a: Dictionary, b: Dictionary) -> bool:
	if a.is_empty() or b.is_empty():
		return a.is_empty() and b.is_empty()
	return is_equal_approx(float(a.x0), float(b.x0)) and is_equal_approx(float(a.z0), float(b.z0)) and is_equal_approx(float(a.x1), float(b.x1)) and is_equal_approx(float(a.z1), float(b.z1))

# o hud pergunta: este dedo marca/arrasta o terreno (true) ou é da câmera (false)?
# Sem nada marcado: marca. Com o terreno marcado: só o canto dourado arrasta; o resto gira a câmera (o + e o - são toque).
func pega_arrasto(pos: Vector2) -> bool:
	if not comprando:
		return false
	if _ret.is_empty():
		return true
	return _alca_na_tela(pos, ["canto"]) != null

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
		if lotes[id].dono != null and not (mudando and id == meu):
			_pintar_ret(im, lotes[id].def, Color(0.75, 0.3, 0.25, 0.16), Color(0.95, 0.45, 0.35, 0.8))
			algum = true
	_outros_no.visible = algum

func comprar() -> void:
	if _ret.is_empty() or _ret_motivo != "":
		m.hud.aviso(_ret_motivo if _ret_motivo != "" else "Marque o terreno primeiro")
		return
	if mudando:
		m.rede("mudarLote", {"x0": int(_ret.x0), "z0": int(_ret.z0), "x1": int(_ret.x1), "z1": int(_ret.z1)})
		return
	m.rede("lote", {"x0": int(_ret.x0), "z0": int(_ret.z0), "x1": int(_ret.x1), "z1": int(_ret.z1)})

# ---------- tela: barra de itens embaixo, no meio (como a do Quimera); o joystick à esquerda continua livre ----------
func cobre(p: Vector2) -> bool:
	for pn in [painel, painel_acoes, painel_compra, painel_bau, painel_forno, painel_qtd, painel_fab]:
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
	# modo construção (2026-11-05, André: letras maiores e mais fácil no celular): embaixo, as abas grandes, o nome
	# e o custo do que está escolhido, o aviso (verde pode / vermelho não pode) e os quadrados com nome embaixo;
	# à direita, os botões grandes: Colocar, Criar, Girar e Sair
	painel = _barra_embaixo()
	painel.offset_left = -8
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 4)
	painel.add_child(col)
	linha_abas = HBoxContainer.new()
	linha_abas.add_theme_constant_override("separation", 6)
	col.add_child(linha_abas)
	for k in ["casa", "moveis", "fazenda", "terreno"]:
		var b := _botao({"casa": "Casa", "moveis": "Móveis", "fazenda": "Fazenda", "terreno": "Terreno"}[k], func(): trocar_aba(k), k == aba, 19)
		b.custom_minimum_size = Vector2(118, 42)
		_botoes_abas[k] = b
		linha_abas.add_child(b)
	var pc := Menu.rotulo("", 17, Menu.APAGADO)
	pc.name = "pecas"
	pc.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	pc.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	pc.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	linha_abas.add_child(pc)
	txt_nome = Menu.rotulo("", 19, Menu.OURO_CLARO)
	txt_nome.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	txt_nome.custom_minimum_size = Vector2(700, 0)
	col.add_child(txt_nome)
	txt_motivo = Menu.rotulo("", 18, Color("ffb3a3"))
	txt_motivo.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	txt_motivo.custom_minimum_size = Vector2(700, 0)
	col.add_child(txt_motivo)
	var rolar := ScrollContainer.new()
	rolar.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	rolar.custom_minimum_size = Vector2(760, 96)
	col.add_child(rolar)
	linha_itens = HBoxContainer.new()
	linha_itens.add_theme_constant_override("separation", 6)
	rolar.add_child(linha_itens)
	painel_acoes = PanelContainer.new()
	painel_acoes.add_theme_stylebox_override("panel", Menu.caixa(Color(Menu.FUNDO, 0.93), Menu.OURO.darkened(0.25), 2, 10, 10))
	painel_acoes.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
	painel_acoes.grow_horizontal = Control.GROW_DIRECTION_BEGIN
	painel_acoes.grow_vertical = Control.GROW_DIRECTION_BEGIN
	painel_acoes.offset_right = -12
	painel_acoes.offset_bottom = -12
	painel_acoes.visible = false
	tela.add_child(painel_acoes)
	var acoes := VBoxContainer.new()
	acoes.add_theme_constant_override("separation", 8)
	painel_acoes.add_child(acoes)
	b_ok = _botao("Colocar", colocar, true, 24)
	b_ok.custom_minimum_size = Vector2(170, 76)
	acoes.add_child(b_ok)
	acoes.move_child(b_ok, 0)
	# André 2026-11-07: regando sem vigor o botão só ficava vermelho. Travado, o toque agora mostra o motivo (colocar() avisa)
	Menu.ao_tocar_travado(b_ok, colocar)
	# fazenda: Salvar põe o herói para fazer o que foi marcado; Limpar desmarca tudo
	b_salvar = _botao("Salvar", salvar_plano, true, 22)
	b_salvar.custom_minimum_size = Vector2(170, 62)
	b_salvar.visible = false
	acoes.add_child(b_salvar)
	acoes.move_child(b_salvar, 1)
	b_limpar = _botao("Limpar", limpar_plano, false, 18)
	b_limpar.custom_minimum_size = Vector2(170, 46)
	b_limpar.visible = false
	acoes.add_child(b_limpar)
	acoes.move_child(b_limpar, 2)
	linha_andares = HBoxContainer.new()
	linha_andares.add_theme_constant_override("separation", 8)
	acoes.add_child(linha_andares)
	acoes.move_child(linha_andares, 0) # andares em cima de tudo
	for a in ANDARES:
		var ba := _botao(a[1], func(): trocar_andar(a[0]), a[0] == andar, 18)
		ba.custom_minimum_size = Vector2(81, 50)
		linha_andares.add_child(ba)
		_botoes_andar[a[0]] = ba
	b_criar = _botao("Criar", criar, false, 22)
	b_criar.custom_minimum_size = Vector2(170, 62)
	Menu.ao_tocar_travado(b_criar, criar) # travado: criar() diz o que falta (André 2026-11-07)
	acoes.add_child(b_criar)
	b_girar = _botao("Girar", girar, false, 20)
	b_girar.custom_minimum_size = Vector2(170, 54)
	acoes.add_child(b_girar)
	# zoom do modo construção (André 2026-11-05: a pinça ia de muito perto a muito longe): passinhos de 20%
	var zm := HBoxContainer.new()
	zm.add_theme_constant_override("separation", 8)
	acoes.add_child(zm)
	for z in [["−", 1.2], ["+", 1.0 / 1.2]]:
		var bz := _botao(z[0], func(): m.cam.zoom(z[1]), false, 28)
		bz.custom_minimum_size = Vector2(81, 54)
		bz.tooltip_text = "Afastar" if z[1] > 1.0 else "Aproximar"
		zm.add_child(bz)
	b_sair = _botao("Sair", sair, false, 20)
	b_sair.custom_minimum_size = Vector2(170, 50)
	acoes.add_child(b_sair)
	# compra do terreno
	painel_compra = _barra_embaixo()
	var cc := VBoxContainer.new()
	cc.add_theme_constant_override("separation", 6)
	painel_compra.add_child(cc)
	var t1 := HBoxContainer.new()
	t1.add_theme_constant_override("separation", 10)
	cc.add_child(t1)
	txt_compra_tit = Menu.rotulo("Comprar terreno", 19, Menu.OURO)
	t1.add_child(txt_compra_tit)
	txt_compra = Menu.rotulo("", 19)
	txt_compra.custom_minimum_size = Vector2(380, 0)
	t1.add_child(txt_compra)
	var t2 := HBoxContainer.new()
	t2.add_theme_constant_override("separation", 10)
	cc.add_child(t2)
	txt_compra_info = Menu.rotulo("", 16, Menu.APAGADO)
	txt_compra_info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt_compra_info.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	txt_compra_info.custom_minimum_size = Vector2(360, 0)
	t2.add_child(txt_compra_info)
	b_recomecar = _botao("Marcar de novo", recomecar, false, 16)
	b_recomecar.custom_minimum_size = Vector2(130, 54)
	t2.add_child(b_recomecar)
	var canc := _botao("Cancelar", sair_compra, false, 18)
	canc.custom_minimum_size = Vector2(120, 54)
	t2.add_child(canc)
	b_comprar = _botao("Comprar", comprar, true, 20)
	b_comprar.custom_minimum_size = Vector2(150, 54)
	Menu.ao_tocar_travado(b_comprar, func():
		m.hud.aviso(_ret_motivo if not _ret.is_empty() and _ret_motivo != "" else "Marque o terreno arrastando o dedo no chão" if _ret.is_empty() else "Nada mudou no terreno")
		m.sons.tocar("dash", -12.0))
	t2.add_child(b_comprar)
	_montar_tela_bau()
	_montar_tela_forno()
	_montar_tela_criar()

func _montar_tela_criar() -> void:
	painel_qtd = PanelContainer.new()
	painel_qtd.add_theme_stylebox_override("panel", Menu.caixa(Color(Menu.FUNDO, 0.97), Menu.OURO.darkened(0.15), 2, 12, 12))
	painel_qtd.set_anchors_preset(Control.PRESET_CENTER)
	painel_qtd.grow_horizontal = Control.GROW_DIRECTION_BOTH
	painel_qtd.grow_vertical = Control.GROW_DIRECTION_BOTH
	painel_qtd.visible = false
	tela_criar = CanvasLayer.new()
	tela_criar.layer = 25 # acima do menu (20): a aba Criar e a mesa abrem a mesma janela
	add_child(tela_criar)
	tela_criar.add_child(painel_qtd)
	var c := VBoxContainer.new()
	c.add_theme_constant_override("separation", 10)
	painel_qtd.add_child(c)
	txt_qtd_tit = Menu.rotulo("", 24, Menu.OURO)
	txt_qtd_tit.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	c.add_child(txt_qtd_tit)
	txt_qtd_custo = Menu.rotulo("", 18, Menu.TEXTO)
	txt_qtd_custo.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	txt_qtd_custo.custom_minimum_size = Vector2(440, 0)
	c.add_child(txt_qtd_custo)
	var linha := HBoxContainer.new()
	linha.alignment = BoxContainer.ALIGNMENT_CENTER
	linha.add_theme_constant_override("separation", 10)
	c.add_child(linha)
	for d in [-5, -1]:
		var b := _botao(str(d), func(): _mudar_qtd(d), false, 24)
		b.custom_minimum_size = Vector2(70, 62)
		linha.add_child(b)
	txt_qtd_n = Menu.rotulo("1", 36, Color.WHITE)
	txt_qtd_n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	txt_qtd_n.custom_minimum_size = Vector2(80, 0)
	linha.add_child(txt_qtd_n)
	for d in [1, 5]:
		var b := _botao("+%d" % d, func(): _mudar_qtd(d), false, 24)
		b.custom_minimum_size = Vector2(70, 62)
		linha.add_child(b)
	var bm := _botao("Máx", func(): _mudar_qtd(999), false, 20)
	bm.custom_minimum_size = Vector2(80, 62)
	linha.add_child(bm)
	var fim := HBoxContainer.new()
	fim.alignment = BoxContainer.ALIGNMENT_CENTER
	fim.add_theme_constant_override("separation", 14)
	c.add_child(fim)
	var canc := _botao("Cancelar", func(): painel_qtd.visible = false, false, 20)
	canc.custom_minimum_size = Vector2(160, 62)
	fim.add_child(canc)
	b_qtd_ok = _botao("Criar 1", _confirmar_qtd, true, 24)
	b_qtd_ok.custom_minimum_size = Vector2(200, 62)
	fim.add_child(b_qtd_ok)
	# barrinha (em cima, no meio; continua aparecendo fora do modo construção)
	painel_fab = PanelContainer.new()
	painel_fab.add_theme_stylebox_override("panel", Menu.caixa(Color(Menu.FUNDO, 0.93), Menu.OURO.darkened(0.25), 2, 10, 10))
	painel_fab.set_anchors_preset(Control.PRESET_CENTER_TOP)
	painel_fab.grow_horizontal = Control.GROW_DIRECTION_BOTH
	painel_fab.offset_top = 132
	painel_fab.visible = false
	tela_criar.add_child(painel_fab)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 12)
	painel_fab.add_child(h)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	h.add_child(v)
	txt_fab = Menu.rotulo("", 20, Menu.OURO_CLARO)
	v.add_child(txt_fab)
	barra_fab = ProgressBar.new()
	barra_fab.min_value = 0.0
	barra_fab.max_value = 1.0
	barra_fab.show_percentage = false
	barra_fab.custom_minimum_size = Vector2(360, 22)
	barra_fab.add_theme_stylebox_override("background", Menu.caixa(Color(0.05, 0.04, 0.03), Menu.OURO.darkened(0.5), 1, 6))
	barra_fab.add_theme_stylebox_override("fill", Menu.caixa(Color("e0a94a"), Color("ffe2a0"), 1, 6))
	v.add_child(barra_fab)
	var bp := _botao("Parar", parar_criar, false, 18)
	bp.custom_minimum_size = Vector2(100, 56)
	h.add_child(bp)

# ---------- baú (Quimera: todos os seus baús guardam as mesmas 40 pilhas) ----------
func _meu_bau_perto() -> bool:
	if meu == "" or not lotes.has(meu) or m.heroi == null:
		return false
	var hp: Vector3 = m.heroi.position
	for p in lotes[meu].pecas:
		if p.k == "bau" and Vector2(p.x - hp.x, p.z - hp.z).length() <= float(D.lote.estacaoDist) + 0.4 and sem_parede(Vector2(hp.x, hp.z), Vector2(p.x, p.z)):
			return true
	return false

# a minha cama a até 6 m (fora do terreno não acontece, mas a casa pode passar da borda)
func _cama_perto() -> Dictionary:
	var c := _mais_perta(_pecas_minhas(["cama"]))
	if c.is_empty() or Vector2(c.x - m.heroi.position.x, c.z - m.heroi.position.z).length() > 6.0:
		return {}
	return c

func abrir_bau() -> void:
	if not m.on():
		return
	m.rede("bau", {"acao": "abrir"})

# o servidor mandou o baú (ao abrir, ou depois de guardar ou tirar)
func do_bau(ev: Dictionary) -> void:
	bau_itens = ev.get("itens", []) if ev.get("itens") is Array else []
	if ev.get("abrir", false):
		painel_bau.visible = true
		m.sons.tocar("pano", -6.0)
	if painel_bau.visible:
		_montar_bau()

func fechar_bau() -> void:
	painel_bau.visible = false

# baú ou fornalha aberta: arrastar o dedo para cima/baixo em cima dos itens rola a lista; um toque parado ainda guarda/tira
func _input(ev: InputEvent) -> void:
	if not ((painel_bau != null and painel_bau.visible) or (painel_forno != null and painel_forno.visible)):
		return
	if ev is InputEventScreenTouch:
		if ev.pressed:
			_bau_dentro = null
			for sc in rolar_bau:
				var vb: VScrollBar = sc.get_v_scroll_bar()
				if sc.is_visible_in_tree() and sc.get_global_rect().has_point(ev.position) and not (vb.visible and vb.get_global_rect().has_point(ev.position)):
					_bau_dentro = sc # na barra não: a própria barra rola
			_bau_soma = 0.0
			_bau_arrastou = false
		else:
			_bau_dentro = null
			if _bau_arrastou: # o soltar passa, mas o item não dispara
				(func(): _bau_arrastou = false).call_deferred()
	elif ev is InputEventScreenDrag and _bau_dentro != null:
		_bau_soma += abs(ev.relative.y)
		if _bau_soma > 12.0:
			_bau_arrastou = true
		_bau_dentro.scroll_vertical -= int(round(ev.relative.y))
		get_viewport().set_input_as_handled()

func _montar_tela_bau() -> void:
	painel_bau = PanelContainer.new()
	painel_bau.add_theme_stylebox_override("panel", Menu.caixa(Color(Menu.FUNDO, 0.96), Menu.OURO.darkened(0.25), 2, 10, 10))
	painel_bau.set_anchors_preset(Control.PRESET_CENTER)
	painel_bau.grow_horizontal = Control.GROW_DIRECTION_BOTH
	painel_bau.grow_vertical = Control.GROW_DIRECTION_BOTH
	painel_bau.visible = false
	tela.add_child(painel_bau)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 6)
	painel_bau.add_child(col)
	var topo := HBoxContainer.new()
	col.add_child(topo)
	txt_bau = Menu.rotulo("Baú", 20, Menu.OURO)
	txt_bau.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	topo.add_child(txt_bau)
	var fe := _botao("Fechar", fechar_bau, false, 18)
	fe.custom_minimum_size = Vector2(120, 46)
	topo.add_child(fe)
	var lados := HBoxContainer.new()
	lados.add_theme_constant_override("separation", 14)
	col.add_child(lados)
	for qual in ["bau", "mochila"]:
		var c := VBoxContainer.new()
		lados.add_child(c)
		var cab := HBoxContainer.new() # André 2026-11-07: cada lado tem o seu botão Organizar
		cab.add_theme_constant_override("separation", 8)
		c.add_child(cab)
		var tt := Menu.rotulo("No baú (toque para tirar)" if qual == "bau" else "Mochila (toque para guardar)", 16, Menu.APAGADO)
		tt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		tt.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		cab.add_child(tt)
		var org := _botao("Organizar", organizar_bau if qual == "bau" else organizar_mochila_bau, false, 15)
		org.custom_minimum_size = Vector2(118, 38)
		cab.add_child(org)
		var sc := ScrollContainer.new()
		sc.custom_minimum_size = Vector2(7 * 60 + 12 + 22, 4 * 60 + 6) # itens + respiro + barra larga
		sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		Menu.barra_larga(sc)
		c.add_child(sc)
		rolar_bau.append(sc)
		var margem := MarginContainer.new() # respiro entre os itens e a barra: o dedo não pega item ao mirar na barra
		margem.add_theme_constant_override("margin_right", 12)
		sc.add_child(margem)
		var g := GridContainer.new()
		g.columns = 7
		g.add_theme_constant_override("h_separation", 4)
		g.add_theme_constant_override("v_separation", 4)
		margem.add_child(g)
		if qual == "bau":
			grade_bau = g
		else:
			grade_mochila = g

# botões Organizar da janela do baú: o servidor junta as pilhas e põe em ordem (organizar() em shared/progresso.js)
func organizar_bau() -> void:
	if m.on():
		m.rede("bau", {"acao": "organizar"})

func organizar_mochila_bau() -> void:
	if m.on():
		m.rede("item", {"acao": "organizar"})

func _montar_bau() -> void:
	for g in [grade_bau, grade_mochila]:
		for n in g.get_children():
			n.queue_free()
	var cheios := 0
	for i in int(D.get("bau", {}).get("slots", 40)):
		var it = bau_itens[i] if i < bau_itens.size() else null
		if it != null:
			cheios += 1
		var fn := func():
			if not _bau_arrastou:
				m.rede("bau", {"acao": "tirar", "i": i})
		grade_bau.add_child(m.menu.celula(it, false, fn if it != null else func(): pass, 56))
	txt_bau.text = "Baú · %d/%d" % [cheios, int(D.get("bau", {}).get("slots", 40))]
	var moch: Array = m.P.prog.get("mochila", [])
	for i in moch.size():
		var it = moch[i]
		if it == null:
			continue
		var fn := func():
			if not _bau_arrastou:
				m.rede("bau", {"acao": "guardar", "i": i})
		grade_mochila.add_child(m.menu.celula(it, false, fn, 56))

# ---------- tocar numa estação (André 2026-11-07): o herói vai andando até o lado dela e só aí abre ----------
# "Não abrir o baú a 5 metros de distância, fica feio." Ao lado (COLADO da borda da peça, sem parede no meio) abre na
# hora; senão uma rota pela grade do terreno (AStarGrid2D de GRADE_IR m, desviando dos sólidos das peças, então entra pela
# porta e dá a volta na casa) leva o herói até o lugar livre mais perto ao lado da estação (rota.gd anda como o joystick).
const COLADO := 1.25 # m da borda da peça
const GRADE_IR := 0.4 # m por quadrado da grade
const FOLGA_IR := 0.3 # m de folga do corpo do herói para os sólidos
const TIPOS_ESTACAO := {"bau": ["bau"], "forno": ["fornalha"], "bancada": ["bancada", "bigorna", "fogao"], "cama": ["cama"]}
var _indo_estacao := {} # {"qual", "id"} enquanto anda até a estação

func _circulos_peca(p) -> Array:
	var a: float = p.r * PI / 2.0
	var c := roundi(cos(a))
	var s := roundi(sin(a))
	var l := []
	for q in D.construcoes[p.k].circulos:
		l.append(Vector3(p.x + float(q[0]) * c + float(q[1]) * s, p.z - float(q[0]) * s + float(q[1]) * c, float(q[2])))
	return l

# parede, janela ou batente de porta entre os dois pontos? (mesma conta do servidor: shared/simulacao.js semParede)
func sem_parede(a: Vector2, b: Vector2) -> bool:
	for id in lotes:
		for p in lotes[id].pecas:
			if tipo_peca(p.k) != "borda":
				continue
			for o: Vector3 in _circulos_peca(p):
				var c := Vector2(o.x, o.y)
				if Geometry2D.get_closest_point_to_segment(c, a, b).distance_to(c) < o.z * 0.9:
					return false
	return true

# distância do ponto até a borda da peça (o círculo sólido mais perto)
func _dist_peca(p, q: Vector2) -> float:
	var d := Vector2(p.x, p.z).distance_to(q)
	for o: Vector3 in _circulos_peca(p):
		d = minf(d, Vector2(o.x, o.y).distance_to(q) - o.z)
	return d

func _pecas_minhas(tipos: Array) -> Array:
	var l := []
	if meu != "" and lotes.has(meu):
		for p in lotes[meu].pecas:
			if p.k in tipos:
				l.append(p)
	return l

func _mais_perta(l: Array) -> Dictionary:
	if m.heroi == null or l.is_empty():
		return {}
	var h := Vector2(m.heroi.position.x, m.heroi.position.z)
	var melhor = l[0]
	for p in l:
		if Vector2(p.x, p.z).distance_to(h) < Vector2(melhor.x, melhor.z).distance_to(h):
			melhor = p
	return melhor

func _colado(p) -> bool:
	if m.heroi == null:
		return false
	var h := Vector2(m.heroi.position.x, m.heroi.position.z)
	return _dist_peca(p, h) <= COLADO and sem_parede(h, Vector2(p.x, p.z))

# as peças que o botão serve: baú e fornalha só as minhas; a mesa também a de outro terreno (como antes)
func _alvos_estacao(qual: String) -> Array:
	var tipos: Array = TIPOS_ESTACAO.get(qual, [])
	if qual != "bancada":
		return _pecas_minhas(tipos)
	var l := []
	for id in lotes:
		for p in lotes[id].pecas:
			if p.k in tipos:
				l.append(p)
	return l

func tocar_estacao(qual: String) -> void:
	if m.heroi == null:
		return
	var alvos := _alvos_estacao(qual)
	for p in alvos:
		if _colado(p):
			_indo_estacao = {}
			_abrir_estacao(qual, p)
			return
	var ida := _rota_ate(alvos)
	if ida.is_empty():
		if qual == "bancada" and prof_da_estacao() != "": # mesa de outro jeito perto (ex.: sem caminho livre): abre como antes
			m.menu.abrir_estacao()
		else:
			m.hud.aviso("Não achei caminho até lá")
		return
	_indo_estacao = {"qual": qual, "id": str(ida.p.id)}
	m.rota.ir(ida.r, "", 0.7)

func _abrir_estacao(qual: String, p) -> void:
	match qual:
		"bau":
			abrir_bau()
		"forno":
			abrir_forno(str(p.id))
		"cama": # do lado da cama: o servidor confere a noite e os monstros e responde "dormiu" (dia_noite.gd)
			if m.on():
				m.rede("dormir", {})
			else:
				m.hud.aviso("Dormir precisa estar online")
		_:
			m.menu.abrir_estacao()

# chegou ao lado: abre; a rota parou longe (joystick, algo no meio): desiste
func _passo_ir_estacao() -> void:
	if _indo_estacao.is_empty():
		return
	var p = null
	for q in _alvos_estacao(_indo_estacao.qual):
		if str(q.id) == _indo_estacao.id:
			p = q
	if p == null or m.h.morto > 0.0:
		_indo_estacao = {}
		return
	if _colado(p) and (not m.rota.ativo or _dist_peca(p, Vector2(m.heroi.position.x, m.heroi.position.z)) <= COLADO - 0.35):
		m.rota.parar()
		var qual: String = _indo_estacao.qual
		_indo_estacao = {}
		_abrir_estacao(qual, p)
	elif not m.rota.ativo:
		_indo_estacao = {}

# rota até o lugar livre mais perto ao lado de uma das peças: {"r": PackedVector2Array, "p": peça} ou {}
func _rota_ate(alvos: Array) -> Dictionary:
	if alvos.is_empty():
		return {}
	var h := Vector2(m.heroi.position.x, m.heroi.position.z)
	var lo := h
	var hi := h
	for p in alvos:
		lo = Vector2(minf(lo.x, p.x), minf(lo.y, p.z))
		hi = Vector2(maxf(hi.x, p.x), maxf(hi.y, p.z))
	lo -= Vector2(4, 4)
	hi += Vector2(4, 4)
	var n := Vector2i(ceili((hi.x - lo.x) / GRADE_IR) + 1, ceili((hi.y - lo.y) / GRADE_IR) + 1)
	if n.x * n.y > 40000:
		return {}
	var g := AStarGrid2D.new()
	g.region = Rect2i(0, 0, n.x, n.y)
	g.cell_size = Vector2(GRADE_IR, GRADE_IR)
	g.offset = lo
	g.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	g.update()
	for o in m.mov.extras:
		var r: float = float(o.r) + FOLGA_IR
		var c0 := Vector2i(floori((o.x - r - lo.x) / GRADE_IR), floori((o.z - r - lo.y) / GRADE_IR))
		var c1 := Vector2i(ceili((o.x + r - lo.x) / GRADE_IR), ceili((o.z + r - lo.y) / GRADE_IR))
		for cx in range(maxi(c0.x, 0), mini(c1.x, n.x - 1) + 1):
			for cz in range(maxi(c0.y, 0), mini(c1.y, n.y - 1) + 1):
				if (lo + Vector2(cx, cz) * GRADE_IR).distance_to(Vector2(o.x, o.z)) < r:
					g.set_point_solid(Vector2i(cx, cz), true)
	var ch := Vector2i(roundi((h.x - lo.x) / GRADE_IR), roundi((h.y - lo.y) / GRADE_IR))
	g.set_point_solid(ch, false)
	var melhor := {}
	var melhor_d := INF
	for p in alvos:
		var centro := Vector2(p.x, p.z)
		for o: Vector3 in _circulos_peca(p):
			for k in 16:
				var q := Vector2(o.x, o.y) + Vector2.from_angle(TAU * k / 16.0) * (o.z + FOLGA_IR + 0.25)
				var cq := Vector2i(roundi((q.x - lo.x) / GRADE_IR), roundi((q.y - lo.y) / GRADE_IR))
				if not g.is_in_boundsv(cq) or g.is_point_solid(cq):
					continue
				var fim := lo + Vector2(cq) * GRADE_IR
				if _dist_peca(p, fim) > COLADO - 0.3 or not sem_parede(fim, centro):
					continue
				var r: PackedVector2Array = g.get_point_path(ch, cq)
				if r.is_empty():
					continue
				var d := 0.0
				for i in range(1, r.size()):
					d += r[i - 1].distance_to(r[i])
				if d < melhor_d:
					melhor_d = d
					if r.size() > 1:
						r.remove_at(0)
					melhor = {"r": r, "p": p}
	return melhor

# ---------- fornalha (2026-11-07: "o forno tá igual uma mesa de craft"): combustível, material e o que ficou pronto ----------
# A conta é do servidor (shared/simulacao.js avancarForno) e segue mesmo com você longe; aqui só mostra e anda as barrinhas.
func minha_fornalha_perto() -> String:
	if meu == "" or not lotes.has(meu) or m.heroi == null:
		return ""
	var hp: Vector3 = m.heroi.position
	var melhor := ""
	var dm := float(D.lote.estacaoDist) + 0.4
	for p in lotes[meu].pecas:
		if p.k == "fornalha":
			var d := Vector2(p.x - hp.x, p.z - hp.z).length()
			if d <= dm and sem_parede(Vector2(hp.x, hp.z), Vector2(p.x, p.z)):
				dm = d
				melhor = str(p.id)
	return melhor

func abrir_forno(id := "") -> void:
	if id == "":
		id = minha_fornalha_perto()
	if id == "" or not m.on():
		return
	forno_id = id
	m.rede("forno", {"acao": "abrir", "p": id})

func fechar_forno() -> void:
	painel_forno.visible = false

# o servidor mandou a fornalha (ao abrir, ou depois de pôr ou tirar)
func do_forno(ev: Dictionary) -> void:
	if str(ev.get("p", "")) != forno_id:
		return
	forno = ev
	forno_t = 0.0
	if ev.get("abrir", false) and not painel_forno.visible:
		painel_forno.visible = true
		m.sons.tocar("pano", -6.0)
	if painel_forno.visible:
		_montar_forno()

func _passo_forno(dt: float) -> void:
	if painel_forno == null or not painel_forno.visible or forno.is_empty():
		return
	forno_t += dt
	forno_pediu = maxf(0.0, forno_pediu - dt)
	var anda: bool = forno.get("anda", false)
	var dur := float(forno.get("dur", 0))
	var prog := float(forno.get("prog", 0)) + (forno_t if anda else 0.0)
	var fogo := float(forno.get("fogo", 0)) - (forno_t if anda else 0.0)
	var fmax := maxf(1.0, float(forno.get("fogoMax", 0)))
	barra_forno.value = clampf(prog / dur, 0.0, 1.0) if dur > 0 else 0.0
	barra_fogo.value = clampf(fogo / fmax, 0.0, 1.0)
	# acabou uma peça ou a lenha: pede a conta nova ao servidor (no máximo uma vez por segundo)
	if anda and forno_pediu <= 0.0 and (prog >= dur or fogo <= 0.0):
		forno_pediu = 1.0
		m.rede("forno", {"acao": "abrir", "p": forno_id})

func _nome(k: String) -> String:
	return str(D.itens.get(k, {}).get("nome", k)) if D.has("itens") else k

func _montar_tela_forno() -> void:
	painel_forno = PanelContainer.new()
	painel_forno.add_theme_stylebox_override("panel", Menu.caixa(Color(Menu.FUNDO, 0.96), Menu.OURO.darkened(0.25), 2, 10, 10))
	painel_forno.set_anchors_preset(Control.PRESET_CENTER)
	painel_forno.grow_horizontal = Control.GROW_DIRECTION_BOTH
	painel_forno.grow_vertical = Control.GROW_DIRECTION_BOTH
	painel_forno.visible = false
	tela.add_child(painel_forno)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 6)
	painel_forno.add_child(col)
	var topo := HBoxContainer.new()
	col.add_child(topo)
	var ti := Menu.rotulo("Fornalha", 20, Menu.OURO)
	ti.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	topo.add_child(ti)
	var fe := _botao("Fechar", fechar_forno, false, 18)
	fe.custom_minimum_size = Vector2(120, 46)
	topo.add_child(fe)
	caixa_forno = VBoxContainer.new()
	col.add_child(caixa_forno)
	barra_fogo = _barra_forno(Color("ff7a2a"), Color("ffc070"))
	barra_forno = _barra_forno(Color("e0a94a"), Color("ffe2a0"))
	txt_forno = Menu.rotulo("", 14, Menu.APAGADO)
	txt_forno.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	txt_forno.custom_minimum_size = Vector2(7 * 60, 0)
	col.add_child(txt_forno)
	col.add_child(Menu.rotulo("Mochila (toque para pôr na fornalha)", 16, Menu.APAGADO))
	var sc := ScrollContainer.new()
	sc.custom_minimum_size = Vector2(7 * 60 + 12 + 22, 2 * 60 + 6) # itens + respiro + barra larga (como no baú)
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	Menu.barra_larga(sc)
	col.add_child(sc)
	rolar_bau.append(sc) # arrastar em cima dos itens também rola
	var margem := MarginContainer.new()
	margem.add_theme_constant_override("margin_right", 12)
	sc.add_child(margem)
	grade_forno = GridContainer.new()
	grade_forno.columns = 7
	grade_forno.add_theme_constant_override("h_separation", 4)
	grade_forno.add_theme_constant_override("v_separation", 4)
	margem.add_child(grade_forno)

func _barra_forno(cor: Color, borda: Color) -> ProgressBar:
	var b := ProgressBar.new()
	b.min_value = 0.0
	b.max_value = 1.0
	b.show_percentage = false
	b.custom_minimum_size = Vector2(64, 10)
	b.add_theme_stylebox_override("background", Menu.caixa(Color(0.05, 0.04, 0.03), Menu.OURO.darkened(0.5), 1, 4))
	b.add_theme_stylebox_override("fill", Menu.caixa(cor, borda, 1, 4))
	b.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return b

# um lugar da fornalha: título, a célula (toque para tirar) e, embaixo, a barrinha (fogo ou preparo)
func _lugar_forno(titulo: String, lugar: String, barra, marcado: bool) -> VBoxContainer:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 3)
	v.add_child(Menu.rotulo(titulo, 14, Menu.OURO if marcado else Menu.APAGADO))
	var it = forno.get(lugar)
	var fn := func():
		if forno.get(lugar) != null:
			m.rede("forno", {"acao": "tirar", "p": forno_id, "lugar": lugar})
		elif lugar != "sai":
			forno_alvo = lugar # lugar vazio: a lenha da mochila passa a ir para cá
			_montar_forno()
	v.add_child(m.menu.celula(it, marcado, fn, 64))
	if barra != null:
		if barra.get_parent():
			barra.get_parent().remove_child(barra)
		v.add_child(barra)
	return v

func _montar_forno() -> void:
	for b in [barra_fogo, barra_forno]: # as barrinhas são sempre as mesmas: saem antes de apagar a linha velha
		if b.get_parent():
			b.get_parent().remove_child(b)
	for n in caixa_forno.get_children():
		n.queue_free()
	for n in grade_forno.get_children():
		n.queue_free()
	var cfg: Dictionary = D.get("fornalha", {})
	var comb: Dictionary = cfg.get("combustivel", {})
	var rec: Dictionary = cfg.get("receitas", {})
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 16)
	h.alignment = BoxContainer.ALIGNMENT_CENTER
	caixa_forno.add_child(h)
	h.add_child(_lugar_forno("Combustível", "comb", barra_fogo, forno_alvo == "comb"))
	h.add_child(_lugar_forno("Material", "ent", barra_forno, forno_alvo == "ent"))
	var seta := Menu.rotulo("→", 30, Menu.OURO)
	seta.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	h.add_child(seta)
	h.add_child(_lugar_forno("Pronto", "sai", null, false))
	# o que está acontecendo, em palavras
	var t := ""
	var faz := str(forno.get("faz", ""))
	if str(forno.get("precisa", "")) != "":
		t = "%s só sai com %s no combustível." % [_nome(faz), _nome(str(forno.precisa)).to_lower()]
	elif forno.get("anda", false):
		t = "Queimando: sai %s a cada %d s. Pode ir embora, ela continua." % [_nome(faz), int(forno.get("dur", 0))]
	elif forno.get("ent") == null:
		t = "Ponha minério de ferro ou de cobre (3 viram uma barra), lenha (2 viram carvão) ou barra de ferro (vira aço com carvão)."
	elif forno.get("comb") == null and float(forno.get("fogo", 0)) <= 0.0:
		t = "Sem fogo: ponha lenha ou carvão no combustível."
	elif forno.get("sai") != null and str(forno.sai.k) != faz:
		t = "Tire o que está pronto para começar outra coisa."
	else:
		t = "Parada: o lugar de pronto encheu ou falta material."
	if forno_alvo == "comb":
		t += " A lenha que você tocar vai para o combustível."
	else:
		t += " A lenha que você tocar vira carvão (toque no combustível vazio para mudar)."
	txt_forno.text = t
	# mochila: só o que entra na fornalha
	var moch: Array = m.P.prog.get("mochila", [])
	for i in moch.size():
		var it = moch[i]
		if it == null:
			continue
		var k := str(it.k)
		var e_comb := comb.has(k)
		var e_mat := rec.has(k)
		if not e_comb and not e_mat:
			continue
		var lugar := forno_alvo if e_comb and e_mat else ("comb" if e_comb else "ent")
		var fn := func():
			if not _bau_arrastou:
				m.rede("forno", {"acao": "por", "p": forno_id, "lugar": lugar, "i": i})
		grade_forno.add_child(m.menu.celula(it, false, fn, 56))

func trocar_aba(k: String) -> void:
	aba = k
	sel = {"casa": "fundacao", "moveis": "bancada", "terreno": "mudar"}.get(k, "arar")
	if k != "casa":
		andar = "terreo" # móveis, fazenda e terreno são do chão
	elif andar == "telhado":
		sel = "telhado"
	_montar_itens()

# a peça é do andar escolhido? (telhado no andar Telhado; o resto no Térreo)
func no_andar(k: String) -> bool:
	return (tipo_peca(k) == "telhado") == (andar == "telhado")

func trocar_andar(a: String) -> void:
	andar = a
	if a == "telhado":
		aba = "casa"
		if sel != "desmontar":
			sel = "telhado"
	elif sel == "telhado":
		sel = "fundacao"
	_montar_itens()

# quadrado da barra (Quimera bhi): ícone, número embaixo à direita, aro dourado no escolhido, apagado sem material
func _slot(k: String, ico: String, numero: String, escolhido: bool, tem: bool, cor_ico := Color.WHITE, rotulo := "") -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(84, 92)
	if rotulo == "":
		rotulo = _nome_slot(k)
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
	# pintado ocupa ~78% do quadrado (direção de arte, 2026-11-06); o traço antigo segue no tamanho de antes
	var pintado: bool = t.texture != null and not t.texture.resource_path.ends_with(".svg")
	t.offset_left = 8 if pintado else 18
	t.offset_right = -8 if pintado else -18
	t.offset_top = 3 if pintado else 8
	t.offset_bottom = -23 if pintado else -34
	t.modulate = Menu.tinta(t.texture, cor_ico if tem else Color(cor_ico, 0.38))
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(t)
	var nm := Menu.rotulo(rotulo, 14, Color("f3e6c8") if tem else Color(0.85, 0.8, 0.72, 0.6))
	nm.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	nm.grow_vertical = Control.GROW_DIRECTION_BEGIN
	nm.offset_bottom = -4
	nm.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	nm.clip_text = true
	nm.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(nm)
	if numero != "": # quantas tem prontas: no canto de cima, à direita
		var n := Menu.rotulo(numero, 18, Color.WHITE if tem else Color("e0a090"))
		n.set_anchors_preset(Control.PRESET_TOP_RIGHT)
		n.grow_horizontal = Control.GROW_DIRECTION_BEGIN
		n.offset_right = -6
		n.offset_top = 2
		n.add_theme_constant_override("outline_size", 4)
		n.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
		n.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(n)
	b.pressed.connect(func(): escolher(k))
	return b

# nome curto embaixo do quadrado
func _nome_slot(k: String) -> String:
	if k.begins_with("plantar:"):
		var pl = D.plantas.get(k.substr(8))
		return str(pl.nome) if pl else "Plantar"
	if D.construcoes.has(k): # nome comprido ("Fundação de pedra"): só a primeira palavra cabe no quadrado
		var nome := str(D.construcoes[k].nome)
		return nome.split(" ")[0] if nome.length() > 11 else nome
	return {"desmontar": "Desmontar", "arar": "Arar", "regar": "Regar", "colher": "Colher", "tirar": "Desfazer", "mudar": "Tamanho", "vender": "Vender"}.get(k, "")

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
	pc.text = ("Peças %d/%d" % [L.pecas.size(), max_pecas(L, D.lote)] if L else "") if aba != "fazenda" else "Arar → Plantar → Regar → Colher · Vigor %d · Água do regador %d/%d" % [int(m.P.vigor()), agua_regador(), int(D.horta.get("agua", 20))]
	var nome := ""
	if aba == "terreno":
		if L:
			var c := conta_terreno(L)
			pc.text = "%d x %d m" % [int(L.def.x1 - L.def.x0), int(L.def.z1 - L.def.z0)]
			linha_itens.add_child(_slot("mudar", "terreno", "", sel == "mudar", true))
			linha_itens.add_child(_slot("vender", "it_ouro", "", sel == "vender", true, Color("ffd27a")))
			if sel == "vender":
				nome = "Vender para o jogo (volta a metade do preço) · as peças voltam para a mochila"
			else:
				nome = "Mudar o tamanho · aumentar: %d de ouro por bloco · diminuir: volta %d" % [int(D.lote.precoBloco), int(float(D.lote.precoBloco) * float(D.lote.venda))]
			if int(c.valor) > 0:
				nome += " · conta no correio: %d" % int(c.valor)
	elif aba != "fazenda":
		# o número é quantas dessa peça já estão criadas na mochila (prontas para colocar)
		for k in D.construcoes:
			var C: Dictionary = D.construcoes[k]
			if str(C.get("aba", "moveis")) != aba or not no_andar(k):
				continue
			var q: int = m.P.contar("obra_" + k)
			linha_itens.add_child(_slot(k, "cs_" + k, str(q), sel == k, q > 0 or motivo_criar(k) == ""))
			if sel == k:
				nome = "%s · tem %d · criar: %s%s" % [C.nome, q, custo_txt(C.custo), " (bancada perto)" if C.get("bancada", false) else ""]
		linha_itens.add_child(_slot("desmontar", "cs_desmontar", "", sel == "desmontar", true, Color("ffb3a3")))
		if sel == "desmontar":
			nome = "Desmontar no %s (a peça volta para a mochila)" % ("telhado" if andar == "telhado" else "térreo")
	else:
		linha_itens.add_child(_slot("arar", "cs_enxada" if m.P.contar("enxada") > 0 else "cs_arar", "", sel == "arar", m.P.contar("enxada") > 0))
		var alguma := false
		for k in D.plantas:
			var n_sem: int = m.P.contar("semente_" + k)
			if n_sem <= 0 and not (sel == "plantar" and semente == k):
				continue
			alguma = true
			linha_itens.add_child(_slot("plantar:" + k, "it_semente_" + k, str(n_sem), sel == "plantar" and semente == k, n_sem > 0, Color(str(D.plantas[k].cor)).lightened(0.25)))
		if not alguma:
			linha_itens.add_child(_slot("plantar:" + semente, "it_semente_" + semente, "0", false, false))
		linha_itens.add_child(_slot("regar", "cs_regar", "", sel == "regar", m.P.contar("regador") > 0))
		linha_itens.add_child(_slot("colher", "it_colheita", "", sel == "colher", true))
		linha_itens.add_child(_slot("tirar", "desfazer", "", sel == "tirar", true))
		nome = {"arar": "Arar a terra", "regar": "Regar (a terra fica molhada %d h)" % int(D.horta.rega), "colher": "Colher", "tirar": "Desfazer a terra arada"}.get(sel, "")
		if sel == "plantar":
			nome = "Plantar %s (%d sementes · a Rosa vende)" % [str(D.plantas[semente].nome).to_lower(), m.P.contar("semente_" + semente)]
		var f := _criar_qual()
		if f != "":
			nome = "Falta %s · criar: %s%s" % [str(D.itens[f].nome).to_lower(), custo_txt(dados_criar(f).custo), " (bancada perto)" if dados_criar(f).get("bancada", false) else ""]
	txt_nome.text = nome
	var cq := _criar_qual()
	b_criar.visible = cq != ""
	b_criar.disabled = cq != "" and motivo_criar(cq) != ""
	Menu.estilo_botao(b_criar, cq != "" and m.P.contar(item_criado(cq)) < 1)
	b_girar.visible = aba != "fazenda" and aba != "terreno" and sel != "desmontar" and tipo_peca(sel) != "fundacao" # telhado gira: vira a rampa (2026-11-05)
	for a in _botoes_andar:
		Menu.estilo_botao(_botoes_andar[a], a == andar)
	if linha_andares:
		linha_andares.visible = aba == "casa" or aba == "moveis"
	b_ok.text = {"mudar": "Mudar", "vender": "Vender", "desmontar": "Desmontar", "arar": "Arar", "plantar": "Plantar", "regar": "Regar", "colher": "Colher", "tirar": "Desfazer"}.get(sel, "Colocar")
	Menu.estilo_botao(b_ok, true)
	var n_plano: int = plano.quantos() if plano else 0
	if aba == "fazenda" and plano and plano.planeja(sel):
		b_ok.text = "Marcar"
	if b_salvar:
		b_salvar.visible = aba == "fazenda" and n_plano > 0
		b_salvar.text = "Salvar (%d)" % n_plano
		b_limpar.visible = b_salvar.visible
	if aba == "fazenda" and n_plano > 0:
		txt_nome.text += (" · " if txt_nome.text != "" else "") + "%d marcados: toque em Salvar" % n_plano

# Salvar o plano da fazenda: sai do modo construção e o herói vai fazendo cada tarefa marcada (fazenda_plano.gd)
func salvar_plano() -> void:
	if plano.quantos() == 0:
		return
	sair()
	plano.comecar()

func limpar_plano() -> void:
	plano.limpar()
	_montar_itens()
	_atualizar_mira()

func escolher(k: String) -> void:
	if k.begins_with("plantar:"):
		semente = k.substr(8)
		k = "plantar"
	sel = k
	if D.construcoes.has(k):
		andar = "telhado" if tipo_peca(k) == "telhado" else "terreo"
	_montar_itens()
	if aba == "terreno" and k == "mudar" and ativo: # um toque no Mudar já abre a tela de expandir (André 2026-11-06)
		_atualizar_mira()
		colocar()

# mochila mudou (o servidor mandou o progresso): os custos e as sementes da barra se atualizam
func progresso_mudou() -> void:
	if ativo:
		_montar_itens()
	if painel_bau and painel_bau.visible:
		_montar_bau()
	if comprando:
		_atualizar_compra()

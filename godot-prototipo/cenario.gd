extends Node3D
# Cenário da mata (pedido do André 2026-11-03: "acrescente ruínas, pedras, troncos caídos... o mapa está muito genérico").
# Os lugares e as peças vêm de mundo.cenario (shared/dados.js CONJUNTOS e sortearEnfeites, iguais no servidor):
#   pecas    = as peças dos marcos (torre caída, portal, santuário, rochedo, tronco caído, árvore morta, acampamento)
#   enfeites = mato e pedras soltas (cogumelo, orelha-de-pau, arbusto, samambaia, planta, pedras da beira da estrada)
# Modelos em res://cenario3d (CC0: Quaternius Stylized Nature e Medieval Village MegaKit, Poly Haven; montados por
# ferramentas/cenario/preparar.mjs). Tudo vira MultiMesh por modelo e por pedaço de 64 m, com o mesmo toon do resto
# (main.gd pintar: folha recortada some em degradê colada na câmera), e só é desenhado perto (os grandes até 85 m, o miúdo até 40 m, sem sombra).
# Colisão: os sólidos (mundo.cenario.solidos) entram na grade da mata (andar.gd), como no servidor.

var m # main.gd
const PEDACO := 64.0
# grandes: aparecem de longe e fazem sombra. O resto é miúdo (some antes, sem sombra: barato no celular).
const GRANDES := ["rocha1", "rocha2", "rocha3", "parede", "parede_janela", "pilar", "tronco_caido", "arvore_morta1", "arvore_morta3",
	"estatua", "carroca", "escada", "toco2", "arbusto", "arbusto_flor"]
# só as peças altas fazem sombra (arbusto, toco e escada quase não fazem: cada sombra é mais um desenho no celular)
const SEM_SOMBRA := ["arbusto", "arbusto_flor", "toco2", "escada"]
const LONGE := {"arvore_morta1": 120.0, "arvore_morta3": 120.0} # a árvore morta gigante marca o lugar por cima das copas
# pedra com a base suja e com musgo (ruina.gdshader) e a mancha de terra no pé de cada marco (mancha.gdshader):
# direção de arte 2026-11-04, para os marcos não parecerem blocos postos em cima da grama
const PEDRA_SUJA := ["parede", "parede_janela", "pilar", "escada", "estatua", "rocha1", "rocha2", "rocha3"]
const MANCHA_FOLGA := 1.5 # m além do raio do marco
var n_instancias := 0
var n_grupos := 0

func _init(principal) -> void:
	m = principal

func _ready() -> void:
	var C: Dictionary = m.mundo.get("cenario", {})
	var grupos := {} # Vector3i(pedaço x, pedaço z, índice do modelo) -> [itens]
	var nomes: Array = []
	for lista in [C.get("pecas", []), C.get("enfeites", [])]:
		for p in lista:
			var nome := str(p.m)
			var i := nomes.find(nome)
			if i < 0:
				nomes.append(nome)
				i = nomes.size() - 1
			var k := Vector3i(floori(float(p.x) / PEDACO), floori(float(p.z) / PEDACO), i)
			if not grupos.has(k):
				grupos[k] = []
			grupos[k].append(p)
	var malhas := {} # nome -> [[Mesh, Transform3D do nó dentro do modelo], ...]
	for nome in nomes:
		malhas[nome] = _malhas(nome)
	for k in grupos:
		var nome: String = nomes[k.z]
		var itens: Array = grupos[k]
		for par in malhas[nome]:
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.mesh = par[0]
			mm.instance_count = itens.size()
			for j in itens.size():
				mm.set_instance_transform(j, _lugar(itens[j]) * par[1])
			var g := MultiMeshInstance3D.new()
			g.multimesh = mm
			var grande: bool = nome in GRANDES
			g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if grande and not nome in SEM_SOMBRA else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			g.visibility_range_end = LONGE.get(nome, 85.0 if grande else 40.0)
			g.visibility_range_end_margin = 6.0
			g.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
			add_child(g)
			n_grupos += 1
		n_instancias += itens.size()
	_manchas(C.get("marcos", []))

# mancha de terra e musgo no pé de cada marco (um disco no chão, um pouco mais largo que o marco)
func _manchas(marcos: Array) -> void:
	var disco := PlaneMesh.new()
	disco.size = Vector2(2, 2)
	var mat := ShaderMaterial.new()
	mat.shader = load("res://mancha.gdshader")
	disco.material = mat
	for o in marcos:
		var r: float = float(o.r) + MANCHA_FOLGA
		var mi := MeshInstance3D.new()
		mi.mesh = disco
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		var x := float(o.x)
		var z := float(o.z)
		mi.transform = Transform3D(Basis(Vector3.UP, float(o.ry)).scaled(Vector3(r, 1, r)), Vector3(x, m.terreno.altura(x, z) + 0.03, z))
		mi.visibility_range_end = 85.0
		mi.visibility_range_end_margin = 6.0
		mi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
		add_child(mi)

# onde fica cada item: gira (ry), inclina (rx, rz: parede torta, carroça largada), escala e pousa no chão (y = enterrado)
func _lugar(p: Dictionary) -> Transform3D:
	var b := Basis(Vector3.UP, float(p.ry))
	if p.has("rx") or p.has("rz"):
		b = b * Basis.from_euler(Vector3(float(p.get("rx", 0.0)), 0.0, float(p.get("rz", 0.0))))
	b = b.scaled(Vector3.ONE * float(p.get("s", 1.0)))
	var x := float(p.x)
	var z := float(p.z)
	return Transform3D(b, Vector3(x, m.terreno.altura(x, z) + float(p.get("y", 0.0)), z))

# as malhas de um modelo (com a posição de cada uma dentro dele), já com o material toon do jogo
func _malhas(nome: String) -> Array:
	var cena: PackedScene = load("res://cenario3d/%s.glb" % nome)
	if cena == null:
		push_warning("cenário: falta o modelo " + nome)
		return []
	var raiz: Node3D = cena.instantiate()
	add_child(raiz) # pintar e global_transform precisam dele na cena
	m.pintar(raiz, false)
	# folha recortada (samambaia, arbusto, hera, planta): baixa, fica entre a câmera e o herói. Some em degradê já a
	# 4 m da câmera (o pintar() só sabe o tamanho da malha sem a escala do modelo e deixava a samambaia tapar a tela)
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		for i in (mi.mesh.get_surface_count() if mi.mesh else 0):
			var mt = mi.mesh.surface_get_material(i)
			if mt is BaseMaterial3D and mt.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
				mt.distance_fade_mode = BaseMaterial3D.DISTANCE_FADE_PIXEL_DITHER
				mt.distance_fade_min_distance = 2.2
				mt.distance_fade_max_distance = 4.2
	if nome in PEDRA_SUJA:
		for mi in raiz.find_children("*", "MeshInstance3D", true, false):
			for i in (mi.mesh.get_surface_count() if mi.mesh else 0):
				var mt = mi.mesh.surface_get_material(i)
				if mt is BaseMaterial3D and mt.albedo_texture:
					var sm := ShaderMaterial.new()
					sm.shader = load("res://ruina.gdshader")
					sm.set_shader_parameter("tex", mt.albedo_texture)
					sm.set_shader_parameter("cor", mt.albedo_color)
					mi.mesh.surface_set_material(i, sm)
	var l: Array = []
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null:
			continue
		l.append([mi.mesh, raiz.global_transform.affine_inverse() * mi.global_transform])
	# as folhas desse modelo-guia não entram no apagar da câmera (ele sai da cena agora)
	for i in range(m.folhas.size() - 1, -1, -1):
		if not is_instance_valid(m.folhas[i][0]) or raiz.is_ancestor_of(m.folhas[i][0]):
			m.folhas.remove_at(i)
	raiz.queue_free()
	return l

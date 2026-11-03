extends RefCounted
# Espada A e Cajado A do herói (direção de arte, 2026-11-03; escolha do André): modelos em armas3d/ (feitos por
# ferramentas/armas/modelar.py). Aqui cada material do modelo vira o shader toon das armas (arma.gdshader), com
# contorno, e o cajado na mão solta uma chama pintada no topo (as mesmas partículas toon das magias novas).

const SH := preload("res://arma.gdshader")
const CONTORNO := 0.0028 # m

# cores de cada material: modo, claro, médio, sombra, riscos/força
const PECAS := {
	"aco": {"modo": 0, "c": ["cfd6df", "9aa5b4", "5a6373"], "riscos": 0.3, "espelho": 0.35}, # v2: acetinado, não cromo
	"fio": {"modo": 0, "c": ["ffffff", "c9d3e2", "56617a"]}, # fio claro nas duas bordas
	"ouro": {"modo": 0, "c": ["ffe39a", "dba64a", "8a5a22"]},
	"ferro": {"modo": 0, "c": ["c9ced6", "7c828e", "343840"]},
	"cabo": {"modo": 1, "c": ["ffffff"]},
	"madeira": {"modo": 1, "c": ["ffffff"]},
	"runa": {"modo": 2, "c": ["8fe0ff", "", "1a2c58"], "miolo": "b8ecff", "forca": 0.4},
	"gema": {"modo": 2, "c": ["3f9cff", "", "123a8a"], "miolo": "bfe8ff", "forca": 0.6, "miolo_mix": 0.25, "brilho": 0.3},
	"fogo": {"modo": 2, "c": ["ff7a18", "", "a82806"], "miolo": "ffd34a", "forca": 0.6, "pulsa": 1.0, "brilho": 0.2, "miolo_k": 0.35, "miolo_mix": 0.3}, # v2: FOGO laranja, miolo amarelo pequeno
}
static var _mats := {}
static var _malhas := {} # malha original -> cópia com os materiais das armas
static var _contorno: StandardMaterial3D

# o topo da chama do cajado, no espaço do cajado (m)
const TOPO_CHAMA := Vector3(0, 1.03, 0) # dentro da ponta do cristal de fogo (1,105 m): a chama sai dele

static func preparar(arma: Node3D) -> void:
	if _contorno == null:
		_contorno = StandardMaterial3D.new()
		_contorno.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_contorno.cull_mode = BaseMaterial3D.CULL_FRONT
		_contorno.grow = true
		_contorno.grow_amount = CONTORNO
		_contorno.albedo_color = Color(0.1, 0.07, 0.06)
	for mi in arma.find_children("*", "MeshInstance3D", true, false):
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		# o material vai na própria malha (cópia), não por cima com override: a aparência do herói (aparencia.gd)
		# limpa os overrides de tudo que está dentro do corpo, e as armas ficam presas nele
		var orig: Mesh = mi.mesh
		var k := orig.get_instance_id()
		if not _malhas.has(k):
			var nm: Mesh = orig.duplicate()
			for i in nm.get_surface_count():
				var m = nm.surface_get_material(i)
				if m != null and PECAS.has(String(m.resource_name)):
					nm.surface_set_material(i, _material(String(m.resource_name), m))
			_malhas[k] = nm
		mi.mesh = _malhas[k]

static func _material(nome: String, orig: Material) -> ShaderMaterial:
	if _mats.has(nome):
		return _mats[nome]
	var P: Dictionary = PECAS[nome]
	var s := ShaderMaterial.new()
	s.shader = SH
	s.set_shader_parameter("modo", P.modo)
	var c: Array = P.c
	s.set_shader_parameter("claro", Color(c[0]))
	if c.size() > 1 and c[1] != "":
		s.set_shader_parameter("medio", Color(c[1]))
	if c.size() > 2:
		s.set_shader_parameter("sombra", Color(c[2]))
	if P.has("miolo"):
		s.set_shader_parameter("miolo", Color(P.miolo))
	s.set_shader_parameter("riscos", P.get("riscos", 0.0))
	s.set_shader_parameter("forca", P.get("forca", 0.4))
	s.set_shader_parameter("pulsa", P.get("pulsa", 0.0))
	s.set_shader_parameter("espelho", P.get("espelho", 1.0))
	s.set_shader_parameter("brilho", P.get("brilho", 0.42))
	s.set_shader_parameter("miolo_k", P.get("miolo_k", 0.55))
	s.set_shader_parameter("miolo_mix", P.get("miolo_mix", 1.0))
	if orig is BaseMaterial3D and orig.albedo_texture:
		s.set_shader_parameter("tex", orig.albedo_texture)
		s.set_shader_parameter("tem_tex", true)
	if P.modo != 2: # o que brilha fica sem contorno (lê como luz)
		s.next_pass = _contorno
	_mats[nome] = s
	return s

# chama pintada saindo do topo do cajado: ~25 partículas vivas no máximo, em loop suave.
# v3 (direção de arte): a chama nasce do cristal (as primeiras sobrepõem ~3 cm a ponta), sobe a ~0,4 m/s e cada
# partícula encolhe até 0, formando uma gota alongada de ~25 cm que afina para cima; amarelo junto do cristal,
# laranja no meio, vermelho-escuro só nas pontas que se soltam; de vez em quando escapa uma faísca.
static var _acum := 0.0
static func chama(mg, cajado: Node3D, dt: float) -> void:
	if mg == null or not cajado.is_inside_tree():
		return
	_acum += dt * 40.0 # 40 por segundo x ~0,6 s de vida = ~24 vivas
	var topo: Vector3 = cajado.global_transform * TOPO_CHAMA
	var cima: Vector3 = cajado.global_transform.basis.y.normalized()
	while _acum >= 1.0:
		_acum -= 1.0
		var j := Vector3(randf_range(-1, 1), randf_range(-0.5, 0.5), randf_range(-1, 1)) * 0.012
		var lado := Vector3(randf_range(-0.04, 0.04), 0, randf_range(-0.04, 0.04))
		var ponta := randf() < 0.2 # as que se soltam e esfriam até o vermelho-escuro
		mg.p(mg.LUZ, topo + j, cima * randf_range(0.36, 0.46) + lado, randf_range(0.5, 0.7), randf_range(0.11, 0.15), 0.0,
			"ffc23a", "a8200a" if ponta else "ff5a10", 1.0, mg.C_FUMACA2 if randf() < 0.5 else mg.C_FUMACA, 0.0, 0.3,
			randf_range(-0.8, 0.8), 0.12, false, 0.0, -1.0, mg.TOON)
	if randf() < dt * 2.5: # faísca escapando de vez em quando
		mg.p(mg.LUZ, topo + cima * 0.08, cima * randf_range(0.7, 1.1) + Vector3(randf_range(-0.25, 0.25), 0, randf_range(-0.25, 0.25)),
			randf_range(0.4, 0.6), 0.022, 0.008, "fff2b0", "ff6a1a", 1.0, mg.C_TRACO, 0.5, 1.0, 0.0, 0.02)

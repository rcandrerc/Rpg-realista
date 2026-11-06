extends Node3D
# Contato com a água de quem nada (André 2026-11-06, direção de arte): anel de espuma que abre e some a cada ~1 s na
# linha d'água, rastro em V atrás nadando (2,5 m) e respingo nas mãos e nos pés a cada braçada.
const ANEL_CADA := 1.0
const ANEL_VIDA := 1.0
const ANEL_RAIO := 0.95 # metade do quadrado: o anel vai de ~0,6 m a ~0,9 m
const RASTRO := 2.5
const BRACADAS_POR_VOLTA := 3.0 # o Swimming do Mixamo dá 3 braçadas por volta

var _mat_anel: ShaderMaterial
var _aneis := [] # [MeshInstance3D, material, idade]
var _anel_t := 0.0
var _rastro: MeshInstance3D
var _mat_rastro: ShaderMaterial
var _respingos := []
var _resp_i := 0
var _bracada := 0.0
var _mao := 0

func _ready() -> void:
	var sh: Shader = load("res://agua_fx.gdshader")
	for i in 3:
		var mi := MeshInstance3D.new()
		var q := PlaneMesh.new()
		q.size = Vector2(ANEL_RAIO * 2.0, ANEL_RAIO * 2.0)
		mi.mesh = q
		var mat := ShaderMaterial.new()
		mat.shader = sh
		mat.set_shader_parameter("modo", 0)
		mat.set_shader_parameter("alfa", 0.4)
		mi.material_override = mat
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.visible = false
		add_child(mi)
		_aneis.append([mi, mat, 9.0])
	_rastro = MeshInstance3D.new()
	var qr := PlaneMesh.new()
	qr.size = Vector2(RASTRO * 1.1, RASTRO)
	_rastro.mesh = qr
	_mat_rastro = ShaderMaterial.new()
	_mat_rastro.shader = sh
	_mat_rastro.set_shader_parameter("modo", 1)
	_mat_rastro.set_shader_parameter("alfa", 0.3)
	_rastro.material_override = _mat_rastro
	_rastro.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_rastro.visible = false
	add_child(_rastro)
	var gota := SphereMesh.new()
	gota.radius = 0.025
	gota.height = 0.05
	gota.radial_segments = 6
	gota.rings = 3
	var mg := StandardMaterial3D.new()
	mg.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mg.albedo_color = Color(0.95, 0.98, 1.0, 0.85)
	mg.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	gota.material = mg
	var curva := Curve.new()
	curva.add_point(Vector2(0, 1))
	curva.add_point(Vector2(1, 0.3))
	for i in 4: # um respingo por mão/pé, 4 ao mesmo tempo no máximo
		var r := CPUParticles3D.new()
		r.emitting = false
		r.one_shot = true
		r.explosiveness = 0.9
		r.amount = 10
		r.lifetime = 0.4
		r.local_coords = false
		r.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
		r.emission_sphere_radius = 0.08
		r.direction = Vector3.UP
		r.spread = 35.0
		r.initial_velocity_min = 1.2
		r.initial_velocity_max = 2.2
		r.gravity = Vector3(0, -9.8, 0)
		r.scale_amount_min = 0.5
		r.scale_amount_max = 1.0
		r.scale_amount_curve = curva
		r.mesh = gota
		add_child(r)
		_respingos.append(r)

# a cada quadro: corpo (posição dos pés), se está na água funda, nível da água, quanto nada (0 boiando, 1 nadando),
# velocidade, para onde vai (ry) e o ritmo da braçada (voltas por segundo do Swimming)
func passo(dt: float, corpo: Node3D, esq: Skeleton3D, na_agua: bool, nivel: float, nada: float, vel: float, ry: float, voltas: float) -> void:
	var p := corpo.global_position
	# anéis de espuma: um novo a cada ~1 s (nadando saem mais seguidos)
	_anel_t -= dt
	if na_agua and _anel_t <= 0.0:
		_anel_t = ANEL_CADA * lerpf(1.0, 0.7, nada)
		for a in _aneis:
			if a[2] >= ANEL_VIDA:
				a[2] = 0.0
				a[0].global_position = Vector3(p.x, nivel + 0.015, p.z)
				break
	for a in _aneis:
		a[2] += dt
		var vivo: bool = a[2] < ANEL_VIDA
		a[0].visible = vivo
		if vivo:
			a[1].set_shader_parameter("fase", a[2] / ANEL_VIDA)
	# rastro em V: nadando, atrás do corpo, na superfície
	var forca: float = clampf(nada * vel / 1.2, 0.0, 1.0) if na_agua else 0.0
	_rastro.visible = forca > 0.02
	if _rastro.visible:
		var tras := Vector3(-sin(ry), 0, -cos(ry))
		_rastro.global_position = Vector3(p.x, nivel + 0.01, p.z) + tras * (RASTRO * 0.5 + 0.3)
		_rastro.global_rotation = Vector3(0, ry, 0)
		_mat_rastro.set_shader_parameter("forca", forca)
	# respingo: a cada braçada, na mão que entra na água, e nos pés que batem
	if na_agua and nada > 0.5 and vel > 0.3 and esq:
		_bracada += dt * voltas * BRACADAS_POR_VOLTA
		if _bracada >= 1.0:
			_bracada -= 1.0
			_mao = 1 - _mao
			for osso in [["J_Bip_L_Hand", "J_Bip_R_Hand"][_mao], ["J_Bip_R_Foot", "J_Bip_L_Foot"][_mao]]:
				var b := esq.find_bone(osso)
				if b >= 0:
					var q: Vector3 = esq.global_transform * esq.get_bone_global_pose(b).origin
					_espirrar(Vector3(q.x, nivel + 0.02, q.z), 10 if osso.ends_with("Hand") else 8)
	else:
		_bracada = 0.0

func _espirrar(onde: Vector3, n: int) -> void:
	var r: CPUParticles3D = _respingos[_resp_i]
	_resp_i = (_resp_i + 1) % _respingos.size()
	r.amount = n
	r.global_position = onde
	r.restart()

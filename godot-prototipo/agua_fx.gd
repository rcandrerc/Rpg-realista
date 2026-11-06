extends Node3D
# Contato com a água de quem nada (André 2026-11-06, direção de arte): espuma fixa colada no corpo na linha d'água,
# um anel de espuma que abre e some a cada ~1 s, rastro em V atrás nadando (2,5 m) e respingo nas mãos e nos pés a cada braçada.
const ANEL_CADA := 1.1
const ANEL_VIDA := 1.0 # menor que ANEL_CADA: um anel de cada vez
const ANEL_RAIO := 0.8 # metade do quadrado: o anel vai de 0,4 m a 0,7 m
const RASTRO := 2.5
const BRACADAS_POR_VOLTA := 3.0 # o Swimming do Mixamo dá 3 braçadas por volta

var _mat_anel: ShaderMaterial
var _aneis := [] # [MeshInstance3D, material, idade]
var _anel_t := 0.0
var _rastro: MeshInstance3D
var _colada: MeshInstance3D # espuma fixa em volta do corpo
var _mat_colada: ShaderMaterial
var _colada_w := 0.3 # metade da largura e do comprimento da elipse agora (m)
var _colada_l := 0.3
var _mat_rastro: ShaderMaterial
var _respingos := []
var _resp_i := 0
var _bracada := 0.0
var _mao := 0

func _ready() -> void:
	var sh: Shader = load("res://agua_fx.gdshader")
	for i in 2:
		var mi := MeshInstance3D.new()
		var q := PlaneMesh.new()
		q.size = Vector2(ANEL_RAIO * 2.0, ANEL_RAIO * 2.0)
		mi.mesh = q
		var mat := ShaderMaterial.new()
		mat.shader = sh
		mat.set_shader_parameter("modo", 0)
		mat.set_shader_parameter("alfa", 0.35)
		mat.set_shader_parameter("meio", ANEL_RAIO)
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
	_mat_rastro.set_shader_parameter("meio", RASTRO * 0.55)
	_rastro.material_override = _mat_rastro
	_rastro.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_rastro.visible = false
	add_child(_rastro)
	_colada = MeshInstance3D.new()
	var qc := PlaneMesh.new()
	qc.size = Vector2(2, 2)
	_colada.mesh = qc
	_mat_colada = ShaderMaterial.new()
	_mat_colada.shader = sh
	_mat_colada.set_shader_parameter("modo", 2)
	_mat_colada.set_shader_parameter("alfa", 0.4)
	_mat_colada.set_shader_parameter("faixa", 0.18)
	_colada.material_override = _mat_colada
	_colada.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_colada.visible = false
	add_child(_colada)
	var gota := QuadMesh.new()
	gota.size = Vector2(0.06, 0.06) # 6 cm, redonda e suave (direção de arte)
	var grad := Gradient.new()
	grad.set_color(0, Color(1, 1, 1, 0.9))
	grad.set_color(1, Color(1, 1, 1, 0.0))
	var tex := GradientTexture2D.new()
	tex.gradient = grad
	tex.fill = GradientTexture2D.FILL_RADIAL
	tex.fill_from = Vector2(0.5, 0.5)
	tex.fill_to = Vector2(1.0, 0.5)
	tex.width = 32
	tex.height = 32
	var mg := StandardMaterial3D.new()
	mg.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mg.albedo_color = Color(0.95, 0.98, 1.0)
	mg.albedo_texture = tex
	mg.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mg.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
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
	# espuma colada no corpo: boiando um círculo em volta do peito, nadando uma elipse ao longo do corpo deitado
	_colada.visible = na_agua
	if na_agua:
		var w := lerpf(0.32, 0.36, nada)
		var l := lerpf(0.32, 0.95, nada)
		_colada_w = lerpf(_colada_w, w, minf(1.0, dt * 6.0))
		_colada_l = lerpf(_colada_l, l, minf(1.0, dt * 6.0))
		var fr := Vector3(sin(ry), 0, cos(ry))
		_colada.global_transform = Transform3D(Basis(Vector3.UP, ry).scaled(Vector3(_colada_w, 1, _colada_l)), Vector3(p.x, nivel + 0.012, p.z) + fr * 0.25 * nada)
		_mat_colada.set_shader_parameter("meio", (_colada_w + _colada_l) * 0.5)
		_mat_colada.set_shader_parameter("forca", 1.0)
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

extends Node3D
# Efeitos das habilidades: círculo mágico, projéteis, explosões, raios, meteoros, cura e números de dano.
# Tudo leve para o celular: malhas simples com brilho aditivo e partículas na CPU.

var mundo # main.gd (para achar os inimigos)
var _circulo_shader: Shader
var _anel_shader: Shader
var _brilho: Dictionary = {}

const CIRCULO := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled;
uniform vec4 cor : source_color = vec4(0.5, 0.8, 1.0, 1.0);
uniform float vida = 1.0;
float linha(vec2 p, vec2 a, vec2 b, float w) {
	vec2 pa = p - a, ba = b - a;
	float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
	return smoothstep(w, 0.0, length(pa - ba * h));
}
void fragment() {
	vec2 p = (UV - 0.5) * 2.0;
	float r = length(p);
	float a = TIME * 0.8;
	mat2 gira = mat2(vec2(cos(a), -sin(a)), vec2(sin(a), cos(a)));
	vec2 q = gira * p;
	float v = smoothstep(0.03, 0.0, abs(r - 0.92)) + smoothstep(0.02, 0.0, abs(r - 0.8)) * 0.8 + smoothstep(0.015, 0.0, abs(r - 0.35)) * 0.6;
	for (int i = 0; i < 5; i++) {
		float t1 = 6.2831 * float(i) / 5.0, t2 = 6.2831 * float(i + 2) / 5.0;
		v += linha(q, vec2(sin(t1), cos(t1)) * 0.8, vec2(sin(t2), cos(t2)) * 0.8, 0.02) * 0.9;
	}
	float runas = step(0.84, r) * step(r, 0.9) * step(0.5, fract(atan(q.y, q.x) * 6.0));
	v += runas * 0.5;
	v *= step(r, 1.0);
	ALBEDO = cor.rgb * v * 1.6 * vida;
	ALPHA = clamp(v, 0.0, 1.0) * vida;
}
"""

const ANEL := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled;
uniform vec4 cor : source_color = vec4(1.0, 0.6, 0.2, 1.0);
uniform float vida = 1.0;
uniform float grossura = 0.18;
void fragment() {
	float r = length((UV - 0.5) * 2.0);
	float v = smoothstep(grossura, 0.0, abs(r - (1.0 - grossura))) + smoothstep(1.0, 0.0, r) * 0.25;
	v *= step(r, 1.0);
	ALBEDO = cor.rgb * v * 1.5 * vida;
	ALPHA = clamp(v, 0.0, 1.0) * vida;
}
"""

func _ready() -> void:
	_circulo_shader = Shader.new()
	_circulo_shader.code = CIRCULO
	_anel_shader = Shader.new()
	_anel_shader.code = ANEL

func brilho(cor: Color) -> StandardMaterial3D:
	var k := cor.to_html()
	if not _brilho.has(k):
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.no_depth_test = false
		m.albedo_color = cor * 1.6
		m.vertex_color_use_as_albedo = true
		_brilho[k] = m
	return _brilho[k]

func _some(no: Node3D, dur: float, ao_passar: Callable) -> void:
	# anima um efeito por "dur" segundos: ao_passar(t de 0 a 1); no fim some
	var tw := create_tween()
	tw.tween_method(ao_passar, 0.0, 1.0, dur)
	tw.tween_callback(no.queue_free)

func _plano(tam: float, shader: Shader, cor: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var q := PlaneMesh.new()
	q.size = Vector2(tam, tam)
	mi.mesh = q
	var m := ShaderMaterial.new()
	m.shader = shader
	m.set_shader_parameter("cor", cor)
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	return mi

# Círculo mágico (pentagrama) no chão enquanto conjura
func circulo(pos: Vector3, cor: Color, dur: float, tam := 3.0) -> void:
	var mi := _plano(tam, _circulo_shader, cor)
	mi.global_position = pos + Vector3(0, 0.04, 0)
	var m: ShaderMaterial = mi.material_override
	_some(mi, dur, func(t: float):
		m.set_shader_parameter("vida", min(1.0, t * 6.0) * (1.0 - smoothstep(0.75, 1.0, t)))
		mi.scale = Vector3.ONE * (0.6 + 0.4 * min(1.0, t * 4.0)))

# Anel que cresce (impacto no chão, explosão, cura)
func anel(pos: Vector3, cor: Color, raio: float, dur := 0.5) -> void:
	var mi := _plano(2.0, _anel_shader, cor)
	mi.global_position = pos + Vector3(0, 0.06, 0)
	var m: ShaderMaterial = mi.material_override
	_some(mi, dur, func(t: float):
		mi.scale = Vector3.ONE * lerp(0.2, raio, 1.0 - pow(1.0 - t, 3.0))
		m.set_shader_parameter("vida", 1.0 - t))

func _faiscas(pos: Vector3, cor: Color, n: int, vel: float, dur: float, sobe := 0.0) -> void:
	var p := CPUParticles3D.new()
	var esfera := SphereMesh.new()
	esfera.radius = 0.05
	esfera.height = 0.1
	esfera.radial_segments = 6
	esfera.rings = 3
	p.mesh = esfera
	p.material_override = brilho(cor)
	p.amount = n
	p.one_shot = true
	p.explosiveness = 0.9
	p.lifetime = dur
	p.direction = Vector3.UP
	p.spread = 180.0
	p.initial_velocity_min = vel * 0.4
	p.initial_velocity_max = vel
	p.gravity = Vector3(0, -4.0 + sobe, 0)
	p.scale_amount_min = 0.6
	p.scale_amount_max = 1.6
	var curva := Curve.new()
	curva.add_point(Vector2(0, 1))
	curva.add_point(Vector2(1, 0))
	p.scale_amount_curve = curva
	add_child(p)
	p.global_position = pos
	p.emitting = true
	get_tree().create_timer(dur + 0.2).timeout.connect(p.queue_free)

# Esfera de luz que cresce e some (explosão)
func explosao(pos: Vector3, cor: Color, raio: float) -> void:
	var mi := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = 1.0
	s.height = 2.0
	s.radial_segments = 16
	s.rings = 8
	mi.mesh = s
	var m: StandardMaterial3D = brilho(cor).duplicate()
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mi.global_position = pos + Vector3(0, 0.3, 0)
	_some(mi, 0.45, func(t: float):
		mi.scale = Vector3.ONE * raio * (0.3 + 0.7 * sqrt(t))
		m.albedo_color = Color(cor.r, cor.g, cor.b, 1.0 - t) * 1.6)
	anel(pos, cor, raio * 1.2, 0.55)
	_faiscas(pos + Vector3(0, 0.4, 0), cor, 28, 6.0, 0.7)
	var luz := OmniLight3D.new()
	luz.light_color = cor
	luz.omni_range = raio * 3.0
	add_child(luz)
	luz.global_position = pos + Vector3(0, 1, 0)
	_some(luz, 0.35, func(t: float): luz.light_energy = 3.0 * (1.0 - t))

# Corte em arco na frente do personagem (golpes de espada)
func corte(pos: Vector3, ry: float, cor: Color, raio := 1.6) -> void:
	var mi := MeshInstance3D.new()
	var t := TorusMesh.new()
	t.inner_radius = raio * 0.86
	t.outer_radius = raio
	t.rings = 24
	t.ring_segments = 4
	mi.mesh = t
	var m: StandardMaterial3D = brilho(cor).duplicate()
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mi.global_position = pos + Vector3(0, 1.0, 0)
	mi.rotation = Vector3(randf_range(-0.5, 0.5), ry, randf_range(-0.3, 0.3))
	mi.scale = Vector3(1, 0.15, 1)
	_some(mi, 0.22, func(k: float):
		m.albedo_color = Color(cor.r, cor.g, cor.b, (1.0 - k) * 0.8) * 1.6
		mi.rotation.y = ry + k * 1.2)

# Projétil (cometa de fogo, tiro arcano): voa até acertar alguém ou acabar o alcance
func projetil(de: Vector3, dir: Vector3, info: Dictionary, dmg: float, alcance := 20.0) -> void:
	var cor: Color = info.cor
	var no := Node3D.new()
	add_child(no)
	no.global_position = de
	var mi := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = info.tam
	s.height = info.tam * 2.0
	s.radial_segments = 12
	s.rings = 6
	mi.mesh = s
	mi.material_override = brilho(cor.lightened(0.4))
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	no.add_child(mi)
	var rastro := CPUParticles3D.new()
	var bolinha := SphereMesh.new()
	bolinha.radius = info.tam * 0.6
	bolinha.height = info.tam * 1.2
	bolinha.radial_segments = 6
	bolinha.rings = 3
	rastro.mesh = bolinha
	rastro.material_override = brilho(cor)
	rastro.amount = 24
	rastro.lifetime = 0.35
	rastro.local_coords = false
	rastro.gravity = Vector3(0, 0.6, 0)
	rastro.initial_velocity_max = 0.4
	rastro.spread = 180.0
	var curva := Curve.new()
	curva.add_point(Vector2(0, 1))
	curva.add_point(Vector2(1, 0))
	rastro.scale_amount_curve = curva
	no.add_child(rastro)
	var luz := OmniLight3D.new()
	luz.light_color = cor
	luz.light_energy = 1.5
	luz.omni_range = 3.0
	no.add_child(luz)
	var vel: float = info.vel
	var andou := 0.0
	var fim := func():
		if info.has("explosao"):
			explosao(no.global_position, cor, info.explosao)
			mundo.dano_area(no.global_position, info.explosao, dmg * 0.6, null)
		else:
			_faiscas(no.global_position, cor, 14, 4.0, 0.4)
		no.queue_free()
	var passo := func(_t: float):
		if not is_instance_valid(no):
			return
		var d := get_process_delta_time() * vel
		no.global_position += dir * d
		andou += d
		var alvo = mundo.inimigo_em(no.global_position, 0.7)
		if alvo:
			mundo.ferir(alvo, dmg, no.global_position)
			fim.call()
		elif andou > alcance:
			fim.call()
	var tw := create_tween()
	tw.tween_method(passo, 0.0, 1.0, alcance / vel + 0.5)

# Raio que cai do céu em cima do alvo
func raio(pos: Vector3, cor := Color("aee6ff")) -> void:
	var mi := MeshInstance3D.new()
	var c := CylinderMesh.new()
	c.top_radius = 0.12
	c.bottom_radius = 0.22
	c.height = 14.0
	c.radial_segments = 8
	mi.mesh = c
	var m: StandardMaterial3D = brilho(cor).duplicate()
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mi.global_position = pos + Vector3(0, 7, 0)
	_some(mi, 0.4, func(t: float):
		mi.scale = Vector3(1.0 - t, 1, 1.0 - t)
		m.albedo_color = Color(cor.r, cor.g, cor.b, 1.0 - t) * 2.0)
	anel(pos, cor, 2.2, 0.4)
	_faiscas(pos + Vector3(0, 0.3, 0), cor, 20, 5.0, 0.5)
	var luz := OmniLight3D.new()
	luz.light_color = cor
	luz.omni_range = 8.0
	add_child(luz)
	luz.global_position = pos + Vector3(0, 2, 0)
	_some(luz, 0.3, func(t: float): luz.light_energy = 6.0 * (1.0 - t))

# Bola de fogo que cai do céu (chuva de meteoros)
func meteoro(alvo: Vector3, ao_cair: Callable) -> void:
	var de := alvo + Vector3(randf_range(-3, 3), 14, randf_range(-3, 3))
	var info := {"vel": 0.0, "cor": Color("ff8a2a"), "tam": 0.3}
	var no := Node3D.new()
	add_child(no)
	no.global_position = de
	var mi := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = 0.32
	s.height = 0.64
	mi.mesh = s
	mi.material_override = brilho(Color("ffd08a"))
	no.add_child(mi)
	var rastro := CPUParticles3D.new()
	var b := SphereMesh.new()
	b.radius = 0.2
	b.height = 0.4
	b.radial_segments = 6
	b.rings = 3
	rastro.mesh = b
	rastro.material_override = brilho(info.cor)
	rastro.amount = 30
	rastro.lifetime = 0.4
	rastro.local_coords = false
	rastro.spread = 180.0
	rastro.initial_velocity_max = 0.5
	var curva := Curve.new()
	curva.add_point(Vector2(0, 1))
	curva.add_point(Vector2(1, 0))
	rastro.scale_amount_curve = curva
	no.add_child(rastro)
	var tw := create_tween()
	tw.tween_property(no, "global_position", alvo, 0.55).set_ease(Tween.EASE_IN).set_trans(Tween.TRANS_QUAD)
	tw.tween_callback(func():
		explosao(alvo, info.cor, 1.6)
		ao_cair.call(alvo)
		no.queue_free())

# Brilho verde subindo em volta de quem se cura
func cura(alvo: Node3D) -> void:
	var cor := Color("7dffa0")
	anel(alvo.global_position, cor, 1.6, 0.8)
	var p := CPUParticles3D.new()
	var s := SphereMesh.new()
	s.radius = 0.05
	s.height = 0.1
	s.radial_segments = 6
	s.rings = 3
	p.mesh = s
	p.material_override = brilho(cor)
	p.amount = 40
	p.lifetime = 1.0
	p.one_shot = true
	p.explosiveness = 0.3
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_RING
	p.emission_ring_radius = 0.6
	p.emission_ring_inner_radius = 0.4
	p.emission_ring_height = 0.1
	p.emission_ring_axis = Vector3.UP
	p.direction = Vector3.UP
	p.spread = 10.0
	p.gravity = Vector3(0, 2.0, 0)
	p.initial_velocity_min = 0.6
	p.initial_velocity_max = 1.4
	alvo.add_child(p)
	p.position = Vector3(0, 0.2, 0)
	p.emitting = true
	get_tree().create_timer(1.3).timeout.connect(p.queue_free)

# Número de dano (ou cura) que sobe e some
func numero(pos: Vector3, valor: float, cor := Color.WHITE) -> void:
	var l := Label3D.new()
	l.text = str(int(round(valor)))
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.font_size = 64
	l.outline_size = 12
	l.modulate = cor
	l.outline_modulate = Color(0.1, 0.05, 0.05)
	l.pixel_size = 0.006
	add_child(l)
	l.global_position = pos + Vector3(randf_range(-0.3, 0.3), 1.9, randf_range(-0.3, 0.3))
	var y0 := l.global_position.y
	_some(l, 0.8, func(t: float):
		l.global_position.y = y0 + t * 0.9
		l.modulate.a = 1.0 - smoothstep(0.5, 1.0, t)
		l.outline_modulate.a = l.modulate.a)

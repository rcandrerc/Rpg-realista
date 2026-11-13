extends Node3D
# Efeito de velocidade da disparada (André 2026-11-13: "quando eu apertar o botão de corrida... uns riscos, uns vultos").
# Com o botão de correr ligado e o herói na corrida de verdade:
# - riscos de vento passam rente ao corpo, da frente para trás (3D: um MultiMesh só, 1 desenho, sem sombra);
# - linhas de velocidade estilo anime piscam nas bordas da tela (2D: ~14 triângulos finos, só na borda).
# Leve para o celular: nada de tela cheia, nada de pós-processo, nada de cópia do corpo. Parado ou andando fica tudo
# escondido e não roda nada. ATIVO = false desliga tudo (o jogo fica como era antes).
const ATIVO := true
const RISCOS := 12
const LINHAS := 18
const VEL_MIN := 4.2 # m/s: acima do trote (3,8) começa a aparecer; na corrida inteira (5,4) fica na força toda
const SOBE := 3.0 # 1/s: quão rápido o efeito entra (~0,3 s)
const DESCE := 5.0 # 1/s: e sai (~0,2 s)
const COR_RISCO := Color(1.0, 0.98, 0.94)
const ALFA_RISCO := 0.6
const ALFA_LINHA := 0.55
const FRENTE := 1.4 # m à frente do corpo onde o risco nasce
const ATRAS := 3.2 # m atrás onde ele some

var k := 0.0 # força do efeito agora (0 a 1)
var _mm: MultiMesh
var _mmi: MultiMeshInstance3D
var _riscos := [] # cada um: [lado (m), altura (m), z (m, + = à frente), comprimento, largura, velocidade relativa]
var _camada: CanvasLayer
var _tela: Control
var _linhas := [] # cada uma: [ângulo, começo (0-1 do raio), largura px, vida, idade]
var _dir := Vector3.FORWARD
var _rng := RandomNumberGenerator.new()

const SH_RISCO := """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;
uniform vec4 cor : source_color = vec4(1.0);
varying float a;
void vertex() { a = INSTANCE_CUSTOM.a; }
void fragment() {
	// UV.x 0 = rabo, 1 = cabeça: some fino no rabo, ponta curta e firme na frente; afina nas beiradas
	float ponta = smoothstep(0.0, 0.7, UV.x) * smoothstep(1.0, 0.88, UV.x);
	float meio = 1.0 - abs(UV.y * 2.0 - 1.0);
	ALBEDO = cor.rgb;
	ALPHA = ponta * meio * a * cor.a;
}
"""

func _ready() -> void:
	_rng.randomize()
	if not ATIVO:
		return
	var q := QuadMesh.new()
	q.size = Vector2(1, 1)
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = SH_RISCO
	mat.shader = sh
	mat.set_shader_parameter("cor", Color(COR_RISCO, ALFA_RISCO))
	q.material = mat
	_mm = MultiMesh.new()
	_mm.transform_format = MultiMesh.TRANSFORM_3D
	_mm.use_custom_data = true
	_mm.mesh = q
	_mm.instance_count = RISCOS
	_mmi = MultiMeshInstance3D.new()
	_mmi.multimesh = _mm
	_mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_mmi.top_level = true # vai junto do herói (riscos em volta dele); a caixa fixa evita a conta da caixa por quadro
	_mmi.custom_aabb = AABB(Vector3(-5, -1, -5), Vector3(10, 5, 10))
	_mmi.visible = false
	add_child(_mmi)
	for i in RISCOS:
		var r := _novo_risco()
		r[2] = _rng.randf_range(-ATRAS, FRENTE) # o primeiro lote já espalhado ao longo do corpo
		_riscos.append(r)
	_camada = CanvasLayer.new()
	_camada.layer = 0 # embaixo do HUD (botões e barras ficam por cima das linhas)
	add_child(_camada)
	_tela = Control.new()
	_tela.set_anchors_preset(Control.PRESET_FULL_RECT)
	_tela.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_tela.visible = false
	_tela.draw.connect(_desenhar_linhas)
	_camada.add_child(_tela)
	for i in LINHAS:
		var l := _nova_linha()
		l[4] = _rng.randf() * l[3] # cada uma num ponto da vida (não piscam todas juntas)
		_linhas.append(l)

func _novo_risco() -> Array:
	var lado: float = _rng.randf_range(0.35, 1.25) * (1.0 if _rng.randf() < 0.5 else -1.0)
	return [lado, _rng.randf_range(0.15, 1.85), FRENTE, _rng.randf_range(0.9, 1.9), _rng.randf_range(0.016, 0.034), _rng.randf_range(7.0, 11.0)]

func _nova_linha() -> Array:
	return [_rng.randf() * TAU, _rng.randf_range(0.62, 0.85), _rng.randf_range(3.0, 7.0), _rng.randf_range(0.1, 0.22), 0.0]

# todo quadro (main.gd, junto do agua_fx). correndo = disparada ligada, a pé, fora da água; vel = m/s no chão
func passo(dt: float, correndo: bool, vel: float, vx: float, vz: float, heroi: Node3D, cam: Camera3D) -> void:
	if not ATIVO:
		return
	var alvo := 0.0
	if correndo:
		alvo = clampf((vel - VEL_MIN) / (5.2 - VEL_MIN), 0.0, 1.0)
	k = move_toward(k, alvo, dt * (SOBE if alvo > k else DESCE))
	var ver := k > 0.01 and cam != null and heroi != null
	_mmi.visible = ver
	_tela.visible = ver
	if not ver:
		return
	if vel > 0.5:
		_dir = Vector3(vx, 0, vz).normalized()
	_passo_riscos(dt, heroi.global_position, cam.global_position)
	for l in _linhas:
		l[4] += dt
		if l[4] >= l[3]:
			var n := _nova_linha()
			for j in 5:
				l[j] = n[j]
	var tam := get_viewport().get_visible_rect().size
	if _tela.size != tam:
		_tela.position = Vector2.ZERO
		_tela.size = tam
	_tela.queue_redraw()

func _passo_riscos(dt: float, p: Vector3, olho: Vector3) -> void:
	var f := _dir
	_mmi.global_position = p
	var dir_lado := f.cross(Vector3.UP).normalized()
	for i in RISCOS:
		var r: Array = _riscos[i]
		r[2] -= float(r[5]) * dt
		if r[2] < -ATRAS:
			r = _novo_risco()
			_riscos[i] = r
		var z: float = r[2]
		var meio: Vector3 = dir_lado * float(r[0]) + Vector3(0, float(r[1]), 0) + f * z
		var para_olho := (olho - p - meio).normalized()
		var lado := f.cross(para_olho)
		if lado.length_squared() < 0.0001:
			lado = Vector3.UP
		lado = lado.normalized()
		var normal := f.cross(lado)
		var b := Basis(f * float(r[3]), lado * float(r[4]), normal)
		_mm.set_instance_transform(i, Transform3D(b, meio))
		# acende ao nascer na frente e apaga chegando atrás
		var vida: float = smoothstep(FRENTE, FRENTE - 0.6, z) * smoothstep(-ATRAS, -ATRAS + 1.2, z)
		_mm.set_instance_custom_data(i, Color(0, 0, 0, vida * k))

func _desenhar_linhas() -> void:
	var tam := _tela.size
	var c := tam * 0.5
	var fora := tam.length() * 0.6 # passa da borda em qualquer ângulo
	var esc: float = tam.y / 720.0
	for l in _linhas:
		var t: float = float(l[4]) / float(l[3])
		var a: float = sin(PI * clampf(t, 0.0, 1.0)) * ALFA_LINHA * k
		if a <= 0.005:
			continue
		var d := Vector2(cos(float(l[0])), sin(float(l[0])))
		# começa num anel elíptico (acompanha o formato da tela) e vai até fora dela
		var ini := c + Vector2(d.x * c.x, d.y * c.y) * float(l[1])
		var fim := c + d * fora
		var w: float = float(l[2]) * esc
		var n := Vector2(-d.y, d.x) * w
		var cor := Color(1, 1, 1, a)
		# ponta fina e apagada perto do meio da tela, grossa e acesa na borda
		_tela.draw_polygon(PackedVector2Array([ini, fim + n, fim - n]), PackedColorArray([Color(1, 1, 1, 0), cor, cor]))

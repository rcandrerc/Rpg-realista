extends Node
const Lentidao = preload("res://lentidao.gd") # quadro lento: Lentidao.parte
# Debaixo d'água (André 2026-11-07): com a câmera dentro do lago, o mundo fica azul-esverdeado, a neblina fecha
# (o fundo some a poucos metros), faixas de luz descem da superfície e a borda da tela escurece. Barato para o
# celular: só um retângulo com shader de tela (sem ler a imagem do jogo) e a neblina que o Environment já tem.
# A superfície vista de baixo vem do agua.gdshader (lado de trás da água).

var m # main.gd
var _env: Environment
var _vela: ColorRect
var _k := 0.0 # 0 fora, 1 dentro
var _nevoa0 := Color.WHITE
var _dens0 := 0.0
var _salvo := false

const COR_NEVOA := Color("1d5a66")
const DENSIDADE := 0.11

const SHADER := """
shader_type canvas_item;
uniform float k = 0.0;
uniform vec3 cor : source_color = vec3(0.1, 0.42, 0.5);
void fragment() {
	vec2 uv = SCREEN_UV;
	// faixas de luz que descem da superfície, balançando devagar
	float raio = sin(uv.x * 9.0 + sin(uv.x * 3.1 + TIME * 0.35) * 2.0 + TIME * 0.25) * 0.5 + 0.5;
	raio *= sin(uv.x * 23.0 - TIME * 0.4) * 0.25 + 0.75;
	raio = pow(raio, 6.0) * (1.0 - uv.y) * 0.35;
	// borda escura (vinheta) e mais escuro embaixo (fundo)
	float bord = smoothstep(0.35, 0.95, length((uv - 0.5) * vec2(1.25, 1.0)));
	float a = 0.28 + bord * 0.35 + uv.y * 0.12;
	vec3 c = mix(cor, cor * 0.35, bord + uv.y * 0.3) + vec3(0.55, 0.85, 0.9) * raio;
	COLOR = vec4(c, clamp(a + raio * 0.5, 0.0, 0.85) * k);
}
"""

func _init(main) -> void:
	m = main

func _ready() -> void:
	var tela := CanvasLayer.new()
	tela.layer = -1 # por cima do 3D, por baixo do HUD
	add_child(tela)
	_vela = ColorRect.new()
	_vela.set_anchors_preset(Control.PRESET_FULL_RECT)
	_vela.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sh := Shader.new()
	sh.code = SHADER
	var mat := ShaderMaterial.new()
	mat.shader = sh
	_vela.material = mat
	_vela.visible = false
	tela.add_child(_vela)

func _process(_dt: float) -> void:
	var t0_parte := Time.get_ticks_usec()
	_process_parte(_dt)
	Lentidao.parte("submerso", t0_parte) # quadro lento: quanto deste script (lentidao.gd)

func _process_parte(_dt: float) -> void:
	if m.camera == null or m.terreno == null:
		return
	if _env == null:
		for we in m.find_children("*", "WorldEnvironment", false, false):
			_env = we.environment
		if _env == null:
			return
	var p: Vector3 = m.camera.global_position
	var dentro: bool = m.terreno.agua_no_corpo(p.x, p.z, p.y) > 0.02
	_k = 1.0 if dentro else 0.0 # a câmera cruza a superfície de uma vez: o visual troca junto
	_vela.visible = _k > 0.0
	_vela.material.set_shader_parameter("k", _k)
	if _k > 0.0:
		if not _salvo:
			_nevoa0 = _env.fog_light_color
			_dens0 = _env.fog_density
			_salvo = true
		_env.fog_light_color = COR_NEVOA
		_env.fog_density = DENSIDADE
	elif _salvo:
		_env.fog_light_color = _nevoa0
		_env.fog_density = _dens0
		_salvo = false

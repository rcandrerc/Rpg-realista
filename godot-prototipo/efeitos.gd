extends Node3D
# Efeitos visuais, iguais aos do site (client/src/efeitos.js): círculo mágico com pentagrama e coluna de luz ao conjurar,
# labaredas, fumaça e brasas, cometa de fogo com cauda, tiro arcano, explosões, raio em zigue-zague, chuva de meteoros,
# meias-luas do Giro, estocada da Investida, rastro da espada e do dash, e os números de dano.
# Cores: os números do site valem direto como luz linear (o site não converte as cores), por isso aqui também não.
# Partículas: dois lotes (fogo somando luz e fumaça por cima), cada um uma MultiMesh só (uma chamada de desenho).

const H := 1.65 # altura de referência de um corpo (m)
const BRILHO := 0.65 # mundo claro: o brilho somado não pode estourar

var mundo # main.gd (para achar os inimigos nos projéteis)

# som do efeito (sons.gd do main), mais baixo longe do herói
func _som(nome: String, pos, vol := 0.0, tom := 0.08) -> void:
	if mundo and mundo.sons:
		mundo.sons.tocar(nome, vol, tom, pos)

# Sons das skills do Quimera (sons/q_*.ogg). CARGA = som enquanto concentra a magia, com o tom que o Quimera usa (CH do mgSnd);
# SOM_AREA = explosão em volta do herói. Pedido do André (2026-11-02): trocar os sons das skills pelos do Quimera.
const CARGA := {"bola": ["q_carga_fogo", 1.0], "explosao": ["q_carga_fogo", 1.1], "meteoros": ["q_carga_fogo", 0.85],
	"gelo": ["q_carga_gelo", 1.0], "cura": ["q_carga_cura", 1.0], "raio": ["q_carga_arcano", 1.1], "vortice": ["q_carga_arcano", 0.9]}
const SOM_AREA := {"explosao": "q_anel", "gelo": "q_gelo", "giro": "q_golpe", "relampago": "q_golpe"}
var _raio_som_t := -9.0

func _som_voz(nome: String, pos, vol := 0.0, tom := 0.03, tom_base := 1.0):
	if mundo and mundo.sons:
		return mundo.sons.tocar_voz(nome, vol, tom, pos, tom_base)
	return null

# cores (brilho, cor) de cada habilidade, como no site no estilo anime
const FXCOR := {
	"bola": ["fff2b0", "ff7a1a"], "explosao": ["ffe6a0", "ff4a12"], "meteoros": ["ffe0a0", "ff5a12"],
	"cura": ["e4ffd8", "36c060"], "raio": ["fffbe0", "ffd23a"], "magia": ["ece2ff", "8a5cff"],
	"relampago": ["ffffff", "bcd6f0"], "giro": ["ffffff", "bcd6f0"], "salto": ["ffffff", "bcd6f0"], "investida": ["ffffff", "bcd6f0"],
	"gelo": ["eafcff", "3fb4ff"], "escudo": ["fff6d6", "ffbf3a"], "vortice": ["f2e6ff", "7a3cff"], "nivel": ["fff6d0", "ffb42a"],
}
const MAGIA := ["bola", "explosao", "meteoros", "cura", "raio", "magia", "gelo", "escudo", "vortice"]
const ESTILOS := {"fogo": ["fff6c8", "ffa21a", "ff2a06"], "arcano": ["ffffff", "c4a4ff", "5a22ff"]}

func cor_de(k: String) -> Array:
	return FXCOR.get(k, FXCOR.bola)

static func c(hex) -> Color:
	return hex if hex is Color else Color(hex)

# ---------------------------------------------------------------- shaders
const SH_PART := """
shader_type spatial;
render_mode unshaded, %s, depth_draw_never, cull_disabled, shadows_disabled;
void vertex() {
	float s = length(MODEL_MATRIX[0].xyz);
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0] * s, INV_VIEW_MATRIX[1] * s, INV_VIEW_MATRIX[2] * s, MODEL_MATRIX[3]);
	vec4 mv = MODELVIEW_MATRIX * vec4(VERTEX, 1.0);
	COLOR.a *= clamp((-mv.z - 0.6) / 1.2, 0.0, 1.0); // some perto da câmera
}
void fragment() {
	float r = length(UV - 0.5) * 2.0;
	float k = r < 0.25 ? mix(1.0, 0.8, r / 0.25) : r < 0.6 ? mix(0.8, 0.25, (r - 0.25) / 0.35) : mix(0.25, 0.0, clamp((r - 0.6) / 0.4, 0.0, 1.0));
	ALBEDO = COLOR.rgb;
	ALPHA = COLOR.a * k * %s;
}
"""

const SH_CIRCULO := """
shader_type spatial;
render_mode unshaded, %s, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
uniform vec4 cor = vec4(1.0);
uniform float op = 0.0;
uniform bool estrela = true;
float hs(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float seg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
float traco(float d, float w) { return smoothstep(w, w * 0.35, d) + smoothstep(w * 3.5, 0.0, d) * 0.35; } // linha com brilho em volta
vec2 ponto(float a, float r) { return vec2(cos(a), sin(a)) * r; }
void fragment() {
	vec2 p = (UV - 0.5) * 2.0;
	float r = length(p);
	if (r > 1.02) discard;
	float v = 0.0;
	v += traco(abs(r - 0.961), 0.018) + traco(abs(r - 0.867), 0.008) + traco(abs(r - 0.56), 0.01) + traco(abs(r - 0.2), 0.006);
	float R = 0.86;
	if (estrela) {
		for (int i = 0; i < 5; i++) {
			float a1 = -1.5708 + float(i) * 2.5133, a2 = -1.5708 + float(i + 1) * 2.5133;
			v += traco(seg(p, ponto(a1, R), ponto(a2, R)), 0.016);
		}
	} else {
		for (int k = 0; k < 2; k++) for (int i = 0; i < 3; i++) {
			float a1 = -1.5708 + float(k) * 1.0472 + float(i) * 2.0944, a2 = a1 + 2.0944;
			v += traco(seg(p, ponto(a1, R), ponto(a2, R)), 0.01);
		}
	}
	// runas entre os dois anéis de fora: 24 casas, cada uma com 2 ou 3 traços sorteados
	float ang = atan(p.y, p.x) + 3.14159;
	float cel = floor(ang / 6.28318 * 24.0);
	vec2 q = vec2(fract(ang / 6.28318 * 24.0) - 0.5, (r - 0.914) / 0.04);
	if (abs(q.y) < 1.2) {
		float g = 0.0;
		for (int s = 0; s < 3; s++) {
			float h1 = hs(vec2(cel, float(s))), h2 = hs(vec2(cel + 7.0, float(s) + 3.0));
			vec2 a = vec2(mix(-0.25, 0.25, h1), -0.8), b = vec2(mix(-0.25, 0.25, h2), 0.8);
			if (s == 1) { a = vec2(-0.25, mix(-0.6, 0.6, h1)); b = vec2(0.25, mix(-0.6, 0.6, h2)); }
			if (s == 2 && h1 < 0.5) continue;
			g += smoothstep(0.09, 0.03, seg(vec2(q.x, q.y * 0.45), a * vec2(1.0, 0.45), b * vec2(1.0, 0.45)));
		}
		v += min(g, 1.0);
	}
	// 12 pontos no anel do meio
	float ad = fract(ang / 6.28318 * 12.0 + 0.5) - 0.5;
	v += smoothstep(0.03, 0.018, length(vec2(ad * 6.28318 / 12.0 * 0.38, r - 0.38)));
	v = clamp(v, 0.0, 1.4);
	ALBEDO = cor.rgb * (1.0 + v * 0.3);
	ALPHA = clamp(v, 0.0, 1.0) * op;
}
"""

const SH_COLUNA := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
uniform vec4 cor = vec4(1.0);
uniform float op = 0.0;
void fragment() {
	float y = 1.0 - UV.y;
	float g = y < 0.35 ? mix(0.9, 0.3, y / 0.35) : mix(0.3, 0.0, (y - 0.35) / 0.65);
	ALBEDO = cor.rgb;
	ALPHA = g * op;
}
"""

const RUIDO := """
float hs3(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float rd(vec3 x){ vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hs3(i), hs3(i + vec3(1,0,0)), f.x), mix(hs3(i + vec3(0,1,0)), hs3(i + vec3(1,1,0)), f.x), f.y),
			   mix(mix(hs3(i + vec3(0,0,1)), hs3(i + vec3(1,0,1)), f.x), mix(hs3(i + vec3(0,1,1)), hs3(i + vec3(1,1,1)), f.x), f.y), f.z); }
float fbm(vec3 p){ return 0.55 * rd(p) + 0.3 * rd(p * 2.1 + 3.1) + 0.15 * rd(p * 4.3 + 7.7); }
"""

# cauda do cometa: tubo que abre para trás (y local de -0.5 na cabeça a 0.5 na ponta)
const SH_CAUDA := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;
uniform vec4 c0; uniform vec4 c1; uniform vec4 c2;
uniform float forca = 1.0; uniform float veloc = 6.0;
varying float vL; varying float vA;
%s
void vertex() { vL = VERTEX.y + 0.5; vA = atan(VERTEX.z, VERTEX.x); }
void fragment() {
	float t = TIME;
	float vB = abs(dot(NORMAL, VIEW));
	vec3 q = vec3(cos(vA) * 2.6, sin(vA) * 2.6, vL * 7.0 - t * veloc);
	float n = fbm(q), m = fbm(vec3(q.xy * 1.7, q.z * 2.3) + vec3(5.2, 1.3, t * veloc * 0.5));
	float lin = pow(1.0 - vL, 1.2), chama = smoothstep(0.42, 0.8, n * 0.75 + m * 0.45 + lin * 0.4 - vL * 0.25);
	float a = chama * pow(lin, 1.3) * pow(vB, 1.1) * forca * 0.7;
	vec3 cor = mix(c2.rgb, c1.rgb, smoothstep(0.15, 0.8, chama * lin)); cor = mix(cor, c0.rgb, smoothstep(0.8, 1.05, chama * (1.0 - vL * 2.0)));
	ALBEDO = cor; ALPHA = clamp(a, 0.0, 1.0);
}
"""
const SH_CABECA := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_back, shadows_disabled;
uniform vec4 c0; uniform vec4 c1; uniform vec4 c2;
varying vec3 vP;
%s
void vertex() { vP = VERTEX; }
void fragment() {
	float n = fbm(vP * 3.2 + vec3(0.0, 0.0, -TIME * 8.0)); float k = pow(abs(dot(NORMAL, VIEW)), 1.5);
	vec3 cor = mix(c2.rgb, c1.rgb, smoothstep(0.2, 0.75, k + n * 0.45)); cor = mix(cor, c0.rgb, smoothstep(0.8, 1.15, k + n * 0.25));
	ALBEDO = cor * (0.7 + n * 0.6); ALPHA = smoothstep(0.25, 0.7, k * 0.8 + n * 0.55) * 0.95;
}
"""
# meia-lua de energia (Giro da Lâmina, estocada da Investida)
const SH_LUA := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;
uniform vec4 c0 = vec4(1.0); uniform vec4 c1 = vec4(0.18, 0.78, 1.0, 1.0);
uniform float op = 1.0;
varying vec2 vP;
%s
void vertex() { vP = VERTEX.xz; }
void fragment() {
	float r = length(vP), ang = atan(vP.y, vP.x);
	float meio = sin(clamp(ang, 0.0, 3.1416)); float borda = smoothstep(0.62, 0.9, r) * (1.0 - smoothstep(0.94, 1.0, r));
	float n = fbm(vec3(ang * 3.0, r * 6.0, TIME * 9.0)); float k = borda * pow(meio, 1.6) * (0.7 + n * 0.6);
	ALBEDO = mix(c1.rgb, c0.rgb, smoothstep(0.55, 1.0, k)); ALPHA = clamp(k * op, 0.0, 1.0);
}
"""
const SH_BASICO := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
uniform vec4 cor = vec4(1.0);
uniform float op = 1.0;
void fragment() { ALBEDO = cor.rgb; ALPHA = op; }
"""
# bolha do Escudo Arcano e casca de gelo: borda acesa (fresnel), miolo quase transparente
const SH_BOLHA := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_back, shadows_disabled, fog_disabled;
uniform vec4 cor = vec4(1.0);
uniform float op = 1.0;
void fragment() {
	float f = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.2);
	float faixa = 0.5 + 0.5 * sin(UV.y * 40.0 - TIME * 3.0);
	ALBEDO = mix(cor.rgb, vec3(1.0), f * 0.5);
	ALPHA = op * (0.06 + f * 0.85 + faixa * f * 0.25);
}
"""
# rastro: cada vértice traz a força (COLOR.a)
const SH_FAIXA := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;
uniform vec4 cor = vec4(1.0);
void fragment() { ALBEDO = mix(cor.rgb, vec3(1.0), 0.3); ALPHA = COLOR.a; }
"""

# rocha do Meteoro: basalto escuro com rachaduras de lava acesas e borda em brasa
const SH_ROCHA := """
shader_type spatial;
render_mode cull_back;
uniform float calor = 1.0;
varying vec3 vP;
%s
void vertex() { vP = VERTEX; }
void fragment() {
	float n = fbm(vP * 2.4 + vec3(1.7, 0.3, 4.1));
	float g = fbm(vP * 6.0 + 9.0);
	float fenda = smoothstep(0.075, 0.0, abs(n - 0.5)) + smoothstep(0.05, 0.0, abs(fbm(vP * 4.2 + 2.0) - 0.48)) * 0.6;
	fenda = clamp(fenda, 0.0, 1.0);
	vec3 pedra = mix(vec3(0.07, 0.055, 0.05), vec3(0.24, 0.19, 0.16), g);
	float borda = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.4);
	float pulso = 0.85 + 0.15 * sin(TIME * 9.0 + n * 25.0);
	ALBEDO = pedra * (1.0 - fenda * 0.8);
	ROUGHNESS = 0.92;
	SPECULAR = 0.2;
	EMISSION = (vec3(1.0, 0.42, 0.07) * fenda * 4.0 * pulso + vec3(1.0, 0.32, 0.04) * borda * 2.2 + vec3(0.25, 0.06, 0.0) * g) * calor;
}
"""
# aura de fogo em volta da rocha: só a borda acesa, labaredas correndo para trás
const SH_AURA := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_back, shadows_disabled, fog_disabled;
uniform float op = 1.0;
varying vec3 vP;
%s
void vertex() { vP = VERTEX; }
void fragment() {
	float f = 1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0);
	float n = fbm(vP * 3.0 + vec3(0.0, 0.0, TIME * 7.0));
	float a = smoothstep(0.45, 0.95, f + n * 0.35 - 0.1) * (1.0 - smoothstep(0.93, 1.0, f));
	vec3 cor = mix(vec3(0.9, 0.16, 0.02), vec3(1.0, 0.62, 0.18), smoothstep(0.45, 0.9, n));
	ALBEDO = cor;
	ALPHA = clamp(a * op * 0.75, 0.0, 1.0);
}
"""
# cúpula da explosão: bola de fogo que cresce, com miolo claro e borda escurecendo
const SH_DOMO := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_back, shadows_disabled, fog_disabled;
uniform float op = 1.0;
varying vec3 vP;
%s
void vertex() { vP = VERTEX; }
void fragment() {
	float k = clamp(dot(NORMAL, VIEW), 0.0, 1.0);
	float n = fbm(vP * 2.6 + vec3(0.0, -TIME * 3.0, 0.0));
	float chama = smoothstep(0.25, 0.8, n * 0.85 + k * 0.45);
	vec3 cor = mix(vec3(0.76, 0.25, 0.1), vec3(1.0, 0.54, 0.23), chama); // vermelho-escuro -> laranja #ff8a3a, sem branco
	ALBEDO = cor;
	ALPHA = clamp(chama * op * (0.35 + 0.65 * k), 0.0, 1.0);
}
"""
# cratera do Meteoro no chão: terra queimada com rachaduras em brasa que esfriam (calor 1 -> 0)
const SH_CRATERA := """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;
uniform float calor = 1.0;
uniform float op = 1.0;
uniform float semente = 0.0;
%s
void fragment() {
	vec2 p = (UV - 0.5) * 2.0;
	float r = length(p);
	float n = fbm(vec3(p * 3.0, semente));
	float borda = 1.0 - smoothstep(0.55 + n * 0.35, 1.0, r);
	float fenda = smoothstep(0.06, 0.0, abs(fbm(vec3(p * 5.0, semente + 3.0)) - 0.5)) * (1.0 - smoothstep(0.2, 0.85, r));
	vec3 queimado = mix(vec3(0.05, 0.04, 0.035), vec3(0.16, 0.12, 0.1), n);
	vec3 brasa = mix(vec3(1.0, 0.3, 0.03), vec3(1.0, 0.75, 0.3), fenda) * 1.6;
	ALBEDO = mix(queimado, brasa, fenda * calor);
	ALPHA = clamp(borda * 0.88 * op + fenda * calor * op, 0.0, 1.0);
}
"""

var _sh := {}
func shader(nome: String, codigo: String) -> Shader:
	if not _sh.has(nome):
		var s := Shader.new()
		s.code = codigo
		_sh[nome] = s
	return _sh[nome]

func material(nome: String, codigo: String, params := {}) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = shader(nome, codigo)
	for k in params:
		m.set_shader_parameter(k, params[k])
	return m

# ---------------------------------------------------------------- partículas
class Lote:
	var n: int
	var mm: MultiMesh
	var no: MultiMeshInstance3D
	var P := PackedFloat32Array() # 19 números por partícula
	var buf := PackedFloat32Array()
	const S := 19

var FOGO: Lote
var FUMA: Lote

func _lote(n: int, aditivo: bool) -> Lote:
	var L := Lote.new()
	L.n = n
	var q := QuadMesh.new()
	q.size = Vector2(1, 1)
	q.material = material("part_add" if aditivo else "part_mix", SH_PART % ["blend_add" if aditivo else "blend_mix", str(BRILHO) if aditivo else "1.0"])
	L.mm = MultiMesh.new()
	L.mm.transform_format = MultiMesh.TRANSFORM_3D
	L.mm.use_colors = true
	L.mm.mesh = q
	L.mm.instance_count = n
	L.mm.visible_instance_count = 0
	L.no = MultiMeshInstance3D.new()
	L.no.multimesh = L.mm
	L.no.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	L.no.extra_cull_margin = 16384.0
	L.no.sorting_offset = 1.0 if aditivo else 0.0
	add_child(L.no)
	L.buf.resize(n * 16)
	return L

func part(L: Lote, x: float, y: float, z: float, vx: float, vy: float, vz: float, vida: float, t0: float, t1: float, c0, c1, a: float, sobe := 0.0, arrasto := 0.0) -> void:
	if L.P.size() >= L.n * Lote.S:
		L.P = L.P.slice(Lote.S) # cheio: tira a mais velha
	var k0: Color = (c0 if c0 is Color else Color(c0))
	var k1: Color = (c1 if c1 is Color else Color(c1))
	L.P.append_array(PackedFloat32Array([x, y, z, vx, vy, vz, 0.0, vida, t0, t1, k0.r, k0.g, k0.b, k1.r, k1.g, k1.b, a, sobe, arrasto]))

func _lote_passo(L: Lote, dt: float) -> void:
	var S := Lote.S
	var total := L.P.size() / S
	if total == 0: # sem partícula: não manda nada para a placa de vídeo
		if L.mm.visible_instance_count != 0:
			L.mm.visible_instance_count = 0
		return
	# solta as listas do lote antes de mexer (senão o Godot copia a lista inteira a cada quadro)
	var P := L.P
	L.P = PackedFloat32Array()
	var buf := L.buf
	L.buf = PackedFloat32Array()
	var vivo := 0
	for i in total:
		var o := i * S
		var t := P[o + 6] + dt
		var vida := P[o + 7]
		if t >= vida:
			continue
		var k: float = max(0.0, 1.0 - P[o + 18] * dt)
		var vx := P[o + 3] * k
		var vz := P[o + 5] * k
		var vy := P[o + 4] * k + P[o + 17] * dt
		var x := P[o] + vx * dt
		var y := P[o + 1] + vy * dt
		var z := P[o + 2] + vz * dt
		var d := vivo * S
		if d != o:
			for j in S:
				P[d + j] = P[o + j]
		P[d] = x
		P[d + 1] = y
		P[d + 2] = z
		P[d + 3] = vx
		P[d + 4] = vy
		P[d + 5] = vz
		P[d + 6] = t
		var u := t / vida
		var f := u / 0.15 if u < 0.15 else 1.0 - (u - 0.15) / 0.85
		var s := P[d + 8] + (P[d + 9] - P[d + 8]) * u
		var b := vivo * 16
		buf[b] = s
		buf[b + 1] = 0.0
		buf[b + 2] = 0.0
		buf[b + 3] = x
		buf[b + 4] = 0.0
		buf[b + 5] = s
		buf[b + 6] = 0.0
		buf[b + 7] = y
		buf[b + 8] = 0.0
		buf[b + 9] = 0.0
		buf[b + 10] = s
		buf[b + 11] = z
		buf[b + 12] = P[d + 10] + (P[d + 13] - P[d + 10]) * u
		buf[b + 13] = P[d + 11] + (P[d + 14] - P[d + 11]) * u
		buf[b + 14] = P[d + 12] + (P[d + 15] - P[d + 12]) * u
		buf[b + 15] = P[d + 16] * f
		vivo += 1
	P.resize(vivo * S)
	L.P = P
	L.buf = buf
	L.mm.buffer = buf
	L.mm.visible_instance_count = vivo

func fumaca_chao(x: float, z: float, r: float, n: int, cor = "8a8496", forte := 1.0) -> void:
	for i in n:
		var a := randf() * TAU
		var d := r * sqrt(randf())
		var s := randf_range(0.6, 1.6) * forte
		part(FUMA, x + cos(a) * d, 0.05, z + sin(a) * d, cos(a) * s, randf_range(0.3, 1.1) * H * 0.4, sin(a) * s, randf_range(1.0, 1.8), 0.3 * H, randf_range(0.7, 1.15) * H, cor, "4a4652", 0.62, 0.3, 1.6)

func labareda(x: float, y: float, z: float, cb, cc, s := 1.0) -> void:
	var vx := randf_range(-0.3, 0.3)
	var vy := randf_range(1.2, 2.4) * H * 0.5 * s
	var vz := randf_range(-0.3, 0.3)
	var v := randf_range(0.4, 0.75)
	part(FUMA, x, y, z, vx, vy, vz, v, 0.3 * H * s, 0.06 * H, cc, "3a0a04", 0.75, 1.2, 0.5)
	part(FOGO, x, y, z, vx, vy, vz, v * 0.7, 0.16 * H * s, 0.03 * H, cb, cc, 0.8, 1.2, 0.5)

func surto(x: float, y: float, z: float, n: int, cb, cc, vel := 5.0, tm := 0.12) -> void:
	for i in n:
		var a := randf() * TAU
		var b := randf_range(-0.2, 1.2)
		var v := randf_range(0.4, 1.0) * vel
		part(FOGO, x, y, z, cos(a) * cos(b) * v, sin(b) * v, sin(a) * cos(b) * v, randf_range(0.4, 0.9), tm * H * randf_range(0.7, 1.4), 0.01, cb, cc, 1.0, -4.0, 1.5)

func poeira(x: float, z: float, r: float, n: int, cb, cc) -> void:
	for i in n:
		var a := randf() * TAU
		var d := r * sqrt(randf()) * 0.95
		var px := x + cos(a) * d
		var py := randf_range(0.02, 0.3) * H
		var pz := z + sin(a) * d
		var vx := randf_range(-0.3, 0.3)
		var vy := randf_range(0.6, 1.6)
		var vz := randf_range(-0.3, 0.3)
		var v := randf_range(1.0, 1.8)
		part(FUMA, px, py, pz, vx, vy, vz, v, randf_range(0.1, 0.15) * H, 0.03 * H, cc, "2a0a04", 0.8, 0.35, 0.6)
		part(FOGO, px, py, pz, vx, vy, vz, v, 0.05 * H, 0.01 * H, cb, cc, 1.0, 0.35, 0.6)

# ---------------------------------------------------------------- luzes reaproveitadas
var luzes: Array = []
func luz(cor, intensidade: float, dist: float, vida: float, dono = null) -> Dictionary:
	var melhor: Dictionary = luzes[0]
	for q in luzes:
		if q.vida <= 0:
			melhor = q
			break
		if q.vida < melhor.vida:
			melhor = q
	melhor.l.light_color = c(cor)
	melhor.l.omni_range = dist
	melhor.int = intensidade
	melhor.vida = vida
	melhor.max = vida
	melhor.dono = dono
	return melhor

# ---------------------------------------------------------------- peças
var _malhas := {}
func _cauda_malha() -> Mesh:
	if not _malhas.has("cauda"):
		var m := CylinderMesh.new()
		m.top_radius = 1.0
		m.bottom_radius = 0.42
		m.height = 1.0
		m.radial_segments = 18
		m.rings = 10
		m.cap_top = false
		m.cap_bottom = false
		_malhas.cauda = m
	return _malhas.cauda

func _esfera_malha() -> Mesh:
	if not _malhas.has("esfera"):
		var m := SphereMesh.new()
		m.radius = 1.0
		m.height = 2.0
		m.radial_segments = 20
		m.rings = 14
		_malhas.esfera = m
	return _malhas.esfera

# rocha: esfera amassada por ruído (sempre a mesma forma; cada meteoro gira diferente)
func _rocha_malha() -> Mesh:
	if not _malhas.has("rocha"):
		var base := SphereMesh.new()
		base.radius = 1.0
		base.height = 2.0
		base.radial_segments = 28
		base.rings = 18
		var arr := base.get_mesh_arrays()
		var ruido := FastNoiseLite.new()
		ruido.seed = 7
		ruido.frequency = 1.1
		ruido.fractal_octaves = 3
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		var vs: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
		for i in idx:
			var v: Vector3 = vs[i]
			var d := v.normalized() if v.length() > 0.001 else Vector3.UP
			var k := 1.0 + ruido.get_noise_3dv(d * 1.3) * 0.32 + ruido.get_noise_3dv(d * 4.0 + Vector3(5, 1, 2)) * 0.07
			st.add_vertex(d * k * Vector3(1.0, 0.88, 1.06))
		st.index()
		st.generate_normals()
		_malhas.rocha = st.commit()
	return _malhas.rocha

func _lua_malha() -> Mesh:
	if not _malhas.has("lua"):
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		var N := 40
		for i in N:
			var a0 := PI * i / N
			var a1 := PI * (i + 1) / N
			var p := [Vector3(-cos(a0) * 0.62, 0, sin(a0) * 0.62), Vector3(-cos(a0), 0, sin(a0)), Vector3(-cos(a1) * 0.62, 0, sin(a1) * 0.62), Vector3(-cos(a1), 0, sin(a1))]
			for k in [0, 1, 2, 1, 3, 2]:
				st.add_vertex(p[k])
		_malhas.lua = st.commit()
	return _malhas.lua

func _plano(tam: float) -> PlaneMesh:
	var q := PlaneMesh.new()
	q.size = Vector2(tam, tam)
	return q

# círculo mágico: uma camada somando luz e uma normal por baixo (aparece também no chão claro)
func circulo_malha(estrela: bool) -> Node3D:
	var g := Node3D.new()
	for aditivo in [false, true]:
		var mi := MeshInstance3D.new()
		mi.mesh = _plano(2.0)
		mi.material_override = material("circ_add" if aditivo else "circ_mix", SH_CIRCULO % ["blend_add" if aditivo else "blend_mix"], {"estrela": estrela})
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.position.y = 0.01 if aditivo else 0.0
		mi.sorting_offset = 2.0 if aditivo else 1.0
		g.add_child(mi)
	add_child(g)
	return g

func circulo_definir(g: Node3D, cor, op: float) -> void:
	var k := c(cor)
	(g.get_child(0) as MeshInstance3D).material_override.set_shader_parameter("cor", k)
	(g.get_child(0) as MeshInstance3D).material_override.set_shader_parameter("op", op)
	(g.get_child(1) as MeshInstance3D).material_override.set_shader_parameter("cor", k)
	(g.get_child(1) as MeshInstance3D).material_override.set_shader_parameter("op", op * 0.6)

func cometa(estilo: String, tam: float, comp: float) -> Node3D:
	var E: Array = ESTILOS[estilo]
	var g := Node3D.new()
	var cores := {"c0": Color(E[0]), "c1": Color(E[1]), "c2": Color(E[2])}
	var cab := MeshInstance3D.new()
	cab.mesh = _esfera_malha()
	cab.material_override = material("cabeca", SH_CABECA % RUIDO, cores)
	cab.scale = Vector3.ONE * tam * 1.25
	var cauda := MeshInstance3D.new()
	cauda.mesh = _cauda_malha()
	cauda.material_override = material("cauda", SH_CAUDA % RUIDO, cores.merged({"forca": 1.0, "veloc": 6.0}))
	var nuc := MeshInstance3D.new()
	nuc.mesh = _cauda_malha()
	nuc.material_override = material("cauda", SH_CAUDA % RUIDO, {"c0": Color(E[0]), "c1": Color(E[0]), "c2": Color(E[1]), "forca": 0.3, "veloc": 8.0})
	for mi in [cauda, nuc, cab]:
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		g.add_child(mi)
	cauda.rotation.x = PI / 2
	nuc.rotation.x = PI / 2
	g.set_meta("cm", {"cab": cab, "cauda": cauda, "nuc": nuc, "tam": tam, "comp": comp})
	_cometa_escala(g, 1.0, 1.0)
	add_child(g)
	return g

func _cometa_escala(g: Node3D, k: float, comp_k: float) -> void:
	var cm: Dictionary = g.get_meta("cm")
	cm.cab.scale = Vector3.ONE * cm.tam * 1.25 * k
	var L: float = cm.comp * comp_k
	cm.cauda.scale = Vector3(cm.tam * 2.1, L, cm.tam * 2.1)
	cm.cauda.position = Vector3(0, 0, L * 0.5) # cauda para trás (+z local; a frente é -z)
	cm.nuc.scale = Vector3(cm.tam, L * 0.6, cm.tam)
	cm.nuc.position = Vector3(0, 0, L * 0.3)

func lua(cor) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = _lua_malha()
	mi.material_override = material("lua", SH_LUA % RUIDO, {"c1": c(cor), "op": 0.0})
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mi

# ---------------------------------------------------------------- estado
var circulos: Array = []
var areas: Array = []
var campos: Array = []
var aneis: Array = []
var giros: Array = []
var raios: Array = []
var meteoros: Array = []
var domos: Array = [] # cúpula de fogo do Meteoro
var ondas: Array = [] # onda de choque do Meteoro
var pedras: Array = [] # pedaços da rocha voando
var crateras: Array = [] # chão queimado em brasa
var projeteis: Array = []
var agenda: Array = []
var bolhas: Array = [] # escudo, gelo e atordoado presos num corpo: {m, corpo, t, dur, op, alt, gira}
var rastros := {} # nó -> {dash, lamina, dash_t, forte}

func _ready() -> void:
	FOGO = _lote(1100, true)
	FUMA = _lote(800, false)
	for i in 4:
		var l := OmniLight3D.new()
		l.light_energy = 0.0
		l.shadow_enabled = false
		add_child(l)
		luzes.append({"l": l, "int": 0.0, "vida": 0.0, "max": 1.0, "dono": null})

# ---------------------------------------------------------------- efeitos
# Começo da habilidade: círculo no chão, coluna de luz, labaredas, fumaça e brasas. corpo = nó do personagem
func conjura(corpo: Node3D, hab: String, dur: float, maos: Callable = Callable()) -> void:
	var voz = null
	if CARGA.has(hab):
		voz = _som_voz(CARGA[hab][0], corpo.global_position, -3.0, 0.02, CARGA[hab][1])
	else:
		_som("magia", corpo.global_position, -4.0)
	var cores := cor_de(hab)
	var cb = cores[0]
	var cc = cores[1]
	var magia := hab in MAGIA
	var r := (1.75 if hab == "explosao" else 1.45 if magia else 1.35) * H
	var g := Node3D.new()
	add_child(g)
	var a := circulo_malha(true)
	var b := circulo_malha(false)
	a.reparent(g)
	b.reparent(g)
	var col := MeshInstance3D.new()
	var cil := CylinderMesh.new()
	cil.top_radius = 1.0
	cil.bottom_radius = 1.0
	cil.height = 1.0
	cil.radial_segments = 32
	cil.cap_top = false
	cil.cap_bottom = false
	col.mesh = cil
	col.material_override = material("coluna", SH_COLUNA, {"cor": c(cc), "op": 0.0})
	col.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	g.add_child(col)
	var p := corpo.global_position
	circulos.append({"g": g, "a": a, "b": b, "col": col, "corpo": corpo, "cb": cb, "cc": cc, "r": r, "magia": magia, "t": 0.0, "dur": dur, "f": 0.0, "vivo": true,
		"luz": luz(cc, 1.2, 7.0, dur + 0.3, corpo), "maos": maos, "voz": voz, "voz_som": voz.stream if voz else null})
	fumaca_chao(p.x, p.z, r * 0.9, 22)
	for i in 36:
		var ang := i / 36.0 * TAU
		labareda(p.x + cos(ang) * r * 0.9, p.y + 0.05, p.z + sin(ang) * r * 0.9, cb, cc, 1.6)
	for i in 24:
		var ang := randf() * TAU
		var d := r * sqrt(randf()) * 0.8
		labareda(p.x + cos(ang) * d, p.y + 0.05, p.z + sin(ang) * d, cb, cc, 1.2)
	surto(p.x, p.y + 0.1, p.z, 40, cb, cc, 7.0)
	poeira(p.x, p.z, r, 40, cb, cc)

# Explosão de área: círculo gigante, fogo, fumaça e clarão
# contido = sem o círculo no chão e com clarão laranja curto e fraco (Meteoro: direção de arte, 2026-11-02)
func area(x: float, z: float, r: float, cores: Array, forte := 1.0, y := 0.0, contido := false) -> void:
	if not contido:
		var m := circulo_malha(true)
		m.position = Vector3(x, y + 0.06, z)
		areas.append({"m": m, "t": 0.0, "r": r, "cc": cores[1]})
	luz(cores[1], (2.5 if contido else 4.0) * forte, r * 3.0, 0.5).l.global_position = Vector3(x, y + 1.2, z)
	for i in int(round(55 * forte)):
		var a := randf() * TAU
		var d := r * sqrt(randf())
		labareda(x + cos(a) * d, y + 0.05, z + sin(a) * d, cores[0], cores[1], 1.1 + 0.5 * forte)
	surto(x, y + 0.4 * H, z, int(round(40 * forte)), cores[0], cores[1], 9.0)
	fumaca_chao(x, z, r * 0.8, int(round(30 * forte)), "77707e", 1.6)
	if contido:
		part(FOGO, x, y + 0.5 * H, z, 0, 0, 0, 0.2, r * 0.5, r * 1.0, "ff8a3a", "c2401a", 0.35)
	else:
		part(FOGO, x, y + 0.5 * H, z, 0, 0, 0, 0.3, r * 0.7, r * 1.4, "ffffff", cores[1], 0.6)

# habilidades de área em volta do herói (Explosão, Salto Esmagador, Giro da Lâmina)
func explosao_hab(fx: String, x: float, z: float, r: float, y := 0.0) -> void:
	if SOM_AREA.has(fx):
		_som(SOM_AREA[fx], Vector3(x, y, z), -2.0 if fx in ["giro", "relampago"] else 0.0, 0.05)
	else:
		_som("explosao", Vector3(x, y, z), -2.0 + min(4.0, r), 0.1)
	var cores := cor_de(fx)
	if fx == "giro": # três cortes de luz rodando em volta, disco no chão, faíscas e clarão
		var g := Node3D.new()
		add_child(g)
		var mats := []
		for j in 3:
			var l := lua("8fd0ff")
			l.scale = Vector3.ONE * r * 0.9
			l.rotation = Vector3(0.12 * (j - 1), j * 2.094, 0)
			g.add_child(l)
			mats.append(l.material_override)
		g.position = Vector3(x, y + 0.9, z)
		giros.append({"g": g, "mats": mats, "t": 0.0, "dur": 0.38, "gira": 16.0, "cresce": 0.25})
		area(x, z, r * 0.95, ["fff0c0", "ffb84a"], 0.5, y) # sem o anel branco fino (direção de arte: cara de debug)
		for i in 24:
			var a := i / 24.0 * TAU
			var v := randf_range(5, 9)
			part(FOGO, x + cos(a) * r * 0.5, y + 0.9, z + sin(a) * r * 0.5, cos(a) * v, randf_range(0, 2), sin(a) * v, 0.45, 0.09 * H, 0.01, "ffffff" if i % 2 else "ffe08a", "8fd0ff", 1.0, -3.0, 2.0)
		part(FOGO, x, y + 0.9, z, 0, 0, 0, 0.25, 1.2, 3.2, "ffffff", "cfe9ff", 0.5)
		luz("cfe9ff", 4.0, r * 3.0, 0.35).l.global_position = Vector3(x, y + 1.2, z)
		return
	area(x, z, r, cores, 1.5 if fx == "explosao" else 1.0, y)

func anel(x: float, z: float, r: float, cor, dur: float, y := 0.0) -> void:
	var mi := MeshInstance3D.new()
	var t := TorusMesh.new()
	t.inner_radius = r * 0.82
	t.outer_radius = r
	t.rings = 48
	t.ring_segments = 3
	mi.mesh = t
	mi.scale = Vector3(1, 0.02, 1)
	mi.material_override = material("basico", SH_BASICO, {"cor": c(cor), "op": 0.8})
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mi.position = Vector3(x, y + 0.08, z)
	aneis.append({"m": mi, "vida": dur, "max": dur})

# Estocada da Investida acertando: corte de luz de pé no alvo, faíscas e clarão
func impacto(x: float, z: float, ry: float, fx: String, y := 0.0) -> void:
	_som("q_golpe", Vector3(x, y, z), -1.0, 0.06)
	var cores := cor_de(fx)
	var g := Node3D.new()
	add_child(g)
	var l := lua(cores[1])
	l.rotation = Vector3(PI / 2, 0, 0.5)
	l.scale = Vector3.ONE * 1.2
	g.add_child(l)
	g.position = Vector3(x, y + 1.05, z)
	g.rotation.y = ry
	giros.append({"g": g, "mats": [l.material_override], "t": 0.0, "dur": 0.25, "gira": 0.0, "cresce": 1.2})
	surto(x, y + 1.1, z, 26, "ffffff", cores[1], 8.0, 0.1)
	anel(x, z, 1.2, cores[1], 0.3, y)
	for i in 12:
		part(FOGO, x, y + 1.1, z, sin(ry) * randf_range(6, 12) + randf_range(-2, 2), randf_range(-1, 2), cos(ry) * randf_range(6, 12) + randf_range(-2, 2), 0.3, 0.07 * H, 0.01, "ffffff", cores[0], 1.0, -2.0, 2.0)
	luz(cores[0], 3.5, 6.0, 0.25).l.global_position = Vector3(x, y + 1.2, z)

# Raio Celeste: zigue-zague do céu até o chão, com clarão e estalo no chão
func raio(x: float, z: float, y := 0.0) -> void:
	_som("explosao", Vector3(x, y, z), -3.0, 0.15)
	var cores := cor_de("raio")
	var pts := []
	var px := 0.0
	var pz := 0.0
	for k in 15:
		pts.append(Vector3(px, 16.0 * (1.0 - k / 14.0), pz))
		px += randf_range(-0.55, 0.55)
		pz += randf_range(-0.55, 0.55)
		px *= 0.85
		pz *= 0.85
	pts[14] = Vector3.ZERO
	var g := Node3D.new()
	add_child(g)
	var mats := []
	for f in [[0.5, cores[1], 0.35], [0.16, cores[0], 0.9], [0.05, "ffffff", 1.0]]:
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		for k in 14:
			var a: Vector3 = pts[k]
			var b: Vector3 = pts[k + 1]
			for lado in [Vector3(f[0], 0, 0), Vector3(0, 0, f[0])]: # duas fitas cruzadas: aparece de qualquer lado
				var q := [a - lado, a + lado, b - lado, b + lado]
				for i in [0, 1, 2, 1, 3, 2]:
					st.add_vertex(q[i])
		var mi := MeshInstance3D.new()
		mi.mesh = st.commit()
		mi.material_override = material("basico", SH_BASICO, {"cor": c(f[1]), "op": f[2]})
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		g.add_child(mi)
		mats.append([mi.material_override, f[2]])
	g.position = Vector3(x, y, z)
	raios.append({"g": g, "mats": mats, "t": 0.0, "dur": 0.4})
	luz(cores[0], 7.0, 14.0, 0.35).l.global_position = Vector3(x, y + 3, z)
	area(x, z, 1.4, cores, 0.7, y)
	surto(x, y + 0.3, z, 34, "ffffff", cores[1], 9.0, 0.12)
	anel(x, z, 1.8, cores[1], 0.45, y)

# Chuva de Meteoros: pentagrama no chão do alvo e bolas de fogo caindo em ondas. ao_cair(pos) = dano
func chuva(x: float, z: float, r: float, ondas: int, ao_cair: Callable) -> void:
	var cores := cor_de("meteoros")
	var m := circulo_malha(true)
	m.position = Vector3(x, 0.07, z)
	m.scale = Vector3.ONE * r
	campos.append({"m": m, "x": x, "z": z, "r": r, "t": 0.0, "dur": 0.6 + ondas * 0.22, "cb": cores[0], "cc": cores[1], "fraco": true})
	for k in ondas:
		for n in 3:
			var a := randf() * TAU
			var d := sqrt(randf()) * r * 0.9
			var alvo := Vector3(x + cos(a) * d, 0, z + sin(a) * d)
			var o := cometa("fogo", 0.26, 4.2)
			var de := alvo + Vector3(2.5, 9, 1.2)
			o.position = de
			o.look_at_from_position(de, alvo, Vector3.UP)
			o.visible = false
			meteoros.append({"o": o, "de": de, "para": alvo, "t": -(0.25 + k * 0.22 + n * 0.06) + 0.35, "dur": 0.35, "cb": cores[0], "cc": cores[1], "fn": ao_cair if n == 0 else Callable()})

# Meteoro do Quimera: runa no chão do alvo e UMA rocha gigante em chamas que cai depois de "queda" segundos, bate no chão e
# explode pegando todo mundo na área (pedido do André, 2026-11-02: "aquela bola gigante quando bate no chão, explode e pega todo mundo").
# ao_cair(pos) = dano (offline; online quem decide é o servidor, em Simulacao.soltarQ)
const METEORO_RAIO := 1.45 # m: a rocha (o herói tem 1,65 m de altura)
const METEORO_CAI := 0.85 # s caindo (o resto da "queda" é o aviso no chão)
const METEORO_ALTO := 22.0 # m de onde ela começa a cair
func meteoro(x: float, z: float, r: float, queda: float, y: float, ao_cair: Callable) -> void:
	var cores := cor_de("meteoros")
	# runa de aviso: vermelho-escuro, só linhas, entra em 0,15 s, no máximo 0,5 e some em 0,3 s depois do impacto
	var m := circulo_malha(true)
	m.position = Vector3(x, y + 0.07, z)
	m.scale = Vector3.ONE * r
	campos.append({"m": m, "x": x, "z": z, "r": r, "t": 0.0, "dur": queda + 0.3, "cb": cores[0], "cc": "c2401a", "fraco": false, "max": 0.5, "entra": 0.15, "sai": 0.3})
	anel(x, z, r, "c2401a", queda + 0.3, y) # borda da área, para saber quem vai ser pego
	var alvo := Vector3(x, y, z)
	# cai 15° inclinada para a câmera, de 22 m: a pedra atravessa a tela em vez de vir de cima, fora da vista
	var para_cam := Vector3(1.0, 0.0, 0.5).normalized()
	var cam3 := get_viewport().get_camera_3d() if is_inside_tree() else null
	if cam3:
		var v := cam3.global_position - alvo
		v.y = 0.0
		if v.length() > 0.5:
			para_cam = v.normalized()
	var de := alvo + Vector3.UP * METEORO_ALTO + para_cam * METEORO_ALTO * tan(deg_to_rad(15.0))
	var o := cometa("fogo", METEORO_RAIO * 1.05, 16.0)
	var cm: Dictionary = o.get_meta("cm")
	cm.cab.visible = false # no lugar da cabeça de fogo vai a rocha com aura
	var rocha := MeshInstance3D.new()
	rocha.mesh = _rocha_malha()
	rocha.material_override = material("rocha_lava", SH_ROCHA % RUIDO, {"calor": 1.0})
	rocha.scale = Vector3.ONE * METEORO_RAIO
	rocha.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	o.add_child(rocha)
	var aura := MeshInstance3D.new()
	aura.mesh = _esfera_malha()
	aura.material_override = material("aura_fogo", SH_AURA % RUIDO, {"op": 1.0})
	aura.scale = Vector3.ONE * METEORO_RAIO * 1.22
	aura.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	o.add_child(aura)
	o.position = de
	o.look_at_from_position(de, alvo, Vector3.UP)
	o.visible = false
	var cai: float = min(METEORO_CAI, queda)
	_som("q_meteoro_cai", alvo, 1.0, 0.03)
	meteoros.append({"o": o, "de": de, "para": alvo, "t": -(queda - cai), "dur": cai, "cb": cores[0], "cc": cores[1], "fn": ao_cair, "r_imp": r,
		"forte": 1.6, "gigante": true, "rocha": rocha, "gira": Vector3(randf_range(2, 4), randf_range(-2, 2), randf_range(1, 3))})
	luz(cores[1], 2.0, r * 2.0, queda).l.global_position = alvo + Vector3(0, 1.0, 0)

# a rocha bateu: clarão, cúpula de fogo, onda de choque, anel de chamas correndo para fora, pedras voando,
# coluna de fumaça e a cratera em brasa que esfria devagar. Tremida e vibração para quem está perto.
func meteoro_impacto(p: Vector3, r: float) -> void:
	var cores := cor_de("meteoros")
	_som("q_meteoro_impacto", p, 3.0, 0.04)
	area(p.x, p.z, r, cores, 1.4, p.y, true)
	luz("ff8a3a", 4.0, r * 4.0, 0.6).l.global_position = p + Vector3(0, 2.0, 0)
	# cúpula de fogo que cresce e some
	var d := MeshInstance3D.new()
	d.mesh = _esfera_malha()
	d.material_override = material("domo_fogo", SH_DOMO % RUIDO, {"op": 1.0})
	d.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	d.position = p
	add_child(d)
	domos.append({"m": d, "t": 0.0, "dur": 0.9, "r": r * 0.85})
	# coluna de fogo subindo do centro (a explosão tem altura, não é só um disco no chão)
	for i in 30:
		var a := randf() * TAU
		var dd := randf() * r * 0.3
		part(FOGO, p.x + cos(a) * dd, p.y + 0.3, p.z + sin(a) * dd, cos(a) * randf_range(0.5, 2.0), randf_range(5.0, 13.0), sin(a) * randf_range(0.5, 2.0), randf_range(0.5, 0.9), randf_range(0.45, 0.8) * H, 0.15 * H, "ff9a4a", "c2401a", 0.55, -2.0, 1.2)
	# onda de choque: argola baixa que corre até além da área
	for k in 2:
		var mi := MeshInstance3D.new()
		var t := TorusMesh.new()
		t.inner_radius = 0.86
		t.outer_radius = 1.0
		t.rings = 64
		t.ring_segments = 4
		mi.mesh = t
		mi.material_override = material("basico", SH_BASICO, {"cor": c("ff8a3a" if k == 0 else "c2401a"), "op": 0.5})
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.position = p + Vector3(0, 0.15 + k * 0.05, 0)
		mi.scale = Vector3(0.2, 0.04, 0.2)
		add_child(mi)
		ondas.append({"m": mi, "t": -k * 0.08, "dur": 0.5, "r": r * (1.35 - k * 0.25)})
	# anel de chamas correndo para fora
	for passo in 6:
		var rr: float = r * (0.25 + passo * 0.15)
		agenda.append({"t": passo * 0.05, "fn": func():
			for i in 22:
				var a := randf() * TAU
				labareda(p.x + cos(a) * rr, p.y + 0.05, p.z + sin(a) * rr, "ffd06a", "ff5a12", 1.9)})
	# coluna de fumaça escura subindo
	for i in 26:
		var a := randf() * TAU
		var dd := randf() * r * 0.35
		part(FUMA, p.x + cos(a) * dd, p.y + 0.5, p.z + sin(a) * dd, cos(a) * 0.6, randf_range(3.0, 6.5), sin(a) * 0.6, randf_range(1.4, 2.4), 0.9 * H, randf_range(1.6, 2.6) * H, "5a4a46", "26201f", 0.75, -0.6, 0.9)
	# brasas e faíscas para todo lado
	for i in 40:
		var a := randf() * TAU
		var v := randf_range(5.0, 12.0)
		part(FOGO, p.x, p.y + 0.6, p.z, cos(a) * v * 0.7, randf_range(4.0, 11.0), sin(a) * v * 0.7, randf_range(0.7, 1.3), 0.08 * H, 0.02 * H, "fff2b0", "ff6a1a", 1.0, -9.0, 0.3)
	# pedras da rocha que se partiu
	for i in 12:
		var a := randf() * TAU
		var v := randf_range(4.0, 9.0)
		var pe := MeshInstance3D.new()
		pe.mesh = _rocha_malha()
		pe.material_override = material("rocha_lava", SH_ROCHA % RUIDO, {"calor": 1.0})
		pe.scale = Vector3.ONE * randf_range(0.14, 0.32)
		pe.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		pe.position = p + Vector3(cos(a) * 0.6, 0.6, sin(a) * 0.6)
		add_child(pe)
		pedras.append({"m": pe, "v": Vector3(cos(a) * v, randf_range(5.0, 10.0), sin(a) * v), "gira": Vector3(randf_range(-9, 9), randf_range(-9, 9), randf_range(-9, 9)), "t": 0.0})
	# cratera em brasa
	var cr := MeshInstance3D.new()
	cr.mesh = _plano(2.0)
	cr.material_override = material("cratera", SH_CRATERA % RUIDO, {"calor": 1.0, "op": 1.0, "semente": randf() * 50.0})
	cr.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	cr.position = p + Vector3(0, 0.05, 0)
	cr.scale = Vector3.ONE * r * 0.62
	cr.rotation.y = randf() * TAU
	add_child(cr)
	crateras.append({"m": cr, "t": 0.0, "dur": 6.0})
	# tranco na câmera e vibração, mais fortes perto
	if mundo and mundo.get("heroi") and mundo.get("cam"):
		var dist: float = mundo.heroi.global_position.distance_to(p)
		if dist < 28.0:
			var q: float = 1.0 - dist / 28.0
			mundo.cam.tremer(0.75 * q)
			if mundo.has_method("vibrar"):
				mundo.vibrar(int(30 + 70 * q))

# Raio em Cadeia: zigue-zague de luz da mão (ou do último alvo) até o próximo alvo
func cadeia(de: Vector3, para: Vector3) -> void:
	if _raio_tempo() - _raio_som_t > 0.25: # um trovão por raio, não um por pulo
		_raio_som_t = _raio_tempo()
		_som("q_raio", para, 0.0, 0.05)
	var cores := cor_de("raio")
	var d := para - de
	var lado := d.cross(Vector3.UP)
	lado = lado.normalized() if lado.length() > 0.01 else Vector3.RIGHT
	var pts := []
	for k in 11:
		var j := 0.0 if k == 0 or k == 10 else 1.0
		pts.append(de + d * (k / 10.0) + (lado * randf_range(-0.35, 0.35) + Vector3(0, randf_range(-0.3, 0.3), 0)) * j)
	var g := Node3D.new()
	add_child(g)
	var mats := []
	for f in [[0.32, cores[1], 0.35], [0.1, cores[0], 0.9], [0.035, "ffffff", 1.0]]:
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		for k in 10:
			var a: Vector3 = pts[k]
			var b: Vector3 = pts[k + 1]
			for off in [Vector3(0, f[0], 0), lado * f[0]]: # duas fitas cruzadas: aparece de qualquer lado
				var q := [a - off, a + off, b - off, b + off]
				for i in [0, 1, 2, 1, 3, 2]:
					st.add_vertex(q[i])
		var mi := MeshInstance3D.new()
		mi.mesh = st.commit()
		mi.material_override = material("basico", SH_BASICO, {"cor": c(f[1]), "op": f[2]})
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		g.add_child(mi)
		mats.append([mi.material_override, f[2]])
	raios.append({"g": g, "mats": mats, "t": 0.0, "dur": 0.3})
	surto(para.x, para.y, para.z, 22, "ffffff", cores[1], 6.0, 0.1)
	luz(cores[0], 4.0, 8.0, 0.25).l.global_position = para

func _raio_tempo() -> float:
	return Time.get_ticks_msec() / 1000.0

# Salto Arcano: some num estouro roxo e aparece no destino com anel, disco e runa (como o blink do Quimera)
func teleporte(de: Vector3, para: Vector3) -> void:
	_som("q_salto", para, -1.0, 0.04)
	var cb := "f2e6ff"
	var cc := "8a4aff"
	surto(de.x, de.y + 1.0, de.z, 36, cb, cc, 5.0, 0.1)
	fumaca_chao(de.x, de.z, 0.8, 12, "5a4a7a", 1.0)
	for k in 10: # rastro de faíscas entre os dois pontos
		var p := de.lerp(para, k / 9.0) + Vector3(0, 1.0, 0)
		part(FOGO, p.x, p.y, p.z, randf_range(-0.5, 0.5), randf_range(-0.2, 0.6), randf_range(-0.5, 0.5), randf_range(0.3, 0.5), 0.12 * H, 0.02, cb, cc, 1.0, 0.3, 1.0)
	surto(para.x, para.y + 1.0, para.z, 40, cb, cc, 6.0, 0.1)
	anel(para.x, para.z, 1.4, "b58cff", 0.45, para.y)
	anel(para.x, para.z, 0.8, "f2e6ff", 0.3, para.y)
	var m := circulo_malha(true)
	m.position = para + Vector3(0, 0.07, 0)
	m.scale = Vector3.ONE * 1.3
	campos.append({"m": m, "x": para.x, "z": para.z, "r": 1.3, "t": 0.0, "dur": 0.55, "cb": cb, "cc": cc, "fraco": true})
	luz(cc, 3.0, 6.0, 0.35).l.global_position = para + Vector3(0, 1.2, 0)

# Projétil: cometa de fogo ou tiro arcano. Voa até acertar alguém ou acabar o alcance
func projetil(de: Vector3, dir: Vector3, info: Dictionary, dmg: float, alcance := 20.0) -> void:
	if info.get("estilo", "fogo") == "arcano":
		_som("tiro", de, -3.0)
	else: # Bola de Fogo e Faísca: os sons de lançar do Quimera
		_som("q_bola_lanca" if info.has("explosao") else "q_faisca_lanca", de, 0.0 if info.has("explosao") else -2.0, 0.05)
	var estilo: String = info.get("estilo", "fogo")
	var cor: Color = info.cor
	var cb = "fff2b0" if estilo == "fogo" else "ffffff"
	var tam: float = info.tam
	var m := cometa(estilo, tam, 2.2 if estilo == "arcano" else 2.6 + tam * 4.0)
	m.look_at_from_position(de, de + dir, Vector3.UP if abs(dir.y) < 0.99 else Vector3.RIGHT)
	surto(de.x, de.y, de.z, 10 if estilo == "arcano" else 26, cb, cor, 3.0 if estilo == "arcano" else 6.0, 0.07 if estilo == "arcano" else 0.12)
	var l = null if estilo == "arcano" else luz(cor, 3.0, 7.0, 2.5, m)
	projeteis.append({"m": m, "dir": dir, "vel": float(info.vel), "andou": 0.0, "alcance": alcance, "info": info, "estilo": estilo, "luz": l, "t": 0.0, "dmg": dmg})

func _fim_projetil(p: Dictionary) -> void:
	var o: Vector3 = p.m.global_position
	var cor: Color = p.info.cor
	var clara := cor.lerp(Color.WHITE, 0.6)
	if p.info.has("explosao"):
		area(o.x, o.z, p.info.explosao, [clara, cor], 0.8, max(0.0, o.y - 1.2))
		surto(o.x, o.y, o.z, 30, "fff2b0", cor, 8.0, 0.14)
	else:
		surto(o.x, o.y, o.z, 16, clara, cor, 4.0, 0.08)
	if p.info.has("explosao"):
		_som("q_bola_explode", o, 0.0, 0.06)
	elif p.estilo == "fogo":
		_som("q_faisca_acerto", o, -5.0, 0.06)
	if p.luz != null and p.luz.dono == p.m:
		p.luz.vida = 0.0
		p.luz.dono = null
	p.m.queue_free()

# Cura: brilho verde subindo (o círculo vem do conjura)
func cura(alvo: Node3D) -> void:
	_som("q_cura", alvo.global_position, -2.0, 0.02)
	var p := alvo.global_position
	anel(p.x, p.z, 1.6, "9be08f", 0.8, p.y)
	for i in 30:
		var a := randf() * TAU
		var d := randf_range(0.2, 0.7)
		part(FOGO, p.x + cos(a) * d, p.y + randf_range(0.1, 1.2), p.z + sin(a) * d, 0, randf_range(0.8, 1.8), 0, randf_range(0.7, 1.2), 0.08 * H, 0.02 * H, "e4ffd8", "36c060", 1.0, 0.5, 0.5)

var _prox_numero := 0.0 # quando o próximo número de dano pode aparecer
var _lado_numero := 1.0
var _ultimo_numero := {} # coluna (-1 ou 1) -> último número dela
# Número de dano (ou cura) que sobe e some
func numero(pos: Vector3, valor: float, cor := Color.WHITE, critico := false) -> void:
	var l := Label3D.new()
	l.text = str(int(round(valor))) + ("!" if critico else "")
	var escala_final: float = 1.45 if critico else 1.0
	var pop: float = 1.9 if critico else 1.5 # nasce grande e encolhe rápido ("pulo" do número)
	if critico: # crítico: laranja-avermelhado e contorno mais grosso
		cor = cor.lerp(Color(1.0, 0.42, 0.12), 0.5)
		l.outline_size = 16
	l.scale = Vector3.ONE * escala_final * pop
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.font_size = 64
	l.outline_size = 12
	l.modulate = cor
	l.outline_modulate = Color(0.1, 0.05, 0.05)
	l.pixel_size = 0.006
	add_child(l)
	# espalha para o lado da tela (±0,3 m) e sai 0,1 s depois do anterior, para os números não se encavalarem
	# uns 25 px para o lado da tela, alternando esquerda e direita (convertido para metros pela distância da câmera)
	var cam := get_viewport().get_camera_3d()
	var base := pos + Vector3(0, 1.9, 0)
	_lado_numero = -_lado_numero
	if cam:
		var px_m: float = 2.0 * tan(deg_to_rad(cam.fov) * 0.5) * cam.global_position.distance_to(base) / max(1.0, get_viewport().get_visible_rect().size.y)
		base += cam.global_basis.x * _lado_numero * 25.0 * px_m
		# na mesma coluna, nasce pelo menos 18 px acima do último que ainda está na tela
		var ult = _ultimo_numero.get(_lado_numero)
		if is_instance_valid(ult):
			base.y = max(base.y, ult.global_position.y + 18.0 * px_m + l.font_size * l.pixel_size)
	l.global_position = base
	_ultimo_numero[_lado_numero] = l
	var agora := Time.get_ticks_msec() / 1000.0
	var atraso: float = max(0.0, _prox_numero - agora)
	_prox_numero = agora + atraso + 0.1
	l.modulate.a = 0.0 if atraso > 0.0 else 1.0
	l.outline_modulate.a = l.modulate.a
	var y0 := l.global_position.y
	var tw := create_tween()
	if atraso > 0.0:
		tw.tween_interval(atraso)
	tw.tween_method(func(t: float):
		l.global_position.y = y0 + (1.0 - (1.0 - t) * (1.0 - t)) * 0.9 # sobe rápido e desacelera
		l.scale = Vector3.ONE * escala_final * (1.0 + (pop - 1.0) * max(0.0, 1.0 - t / 0.15))
		l.modulate.a = 1.0 - smoothstep(0.5, 1.0, t)
		l.outline_modulate.a = l.modulate.a, 0.0, 1.0, 0.8)
	tw.tween_callback(l.queue_free)

# Texto que sobe devagar e some (ouro e itens que caíram); atraso em segundos para não encavalar
func texto(pos: Vector3, t: String, cor: Color, atraso := 0.0, subir := 1.1, altura := 1.7, tam := 1.0, px := 0.0) -> void:
	var l := Label3D.new()
	l.text = t
	l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	l.no_depth_test = true
	l.font_size = 48
	l.outline_size = 14
	l.modulate = Color(cor, 0.0)
	l.outline_modulate = Color(0.06, 0.04, 0.02, 0.0)
	l.pixel_size = 0.006 * tam
	add_child(l)
	l.global_position = pos + Vector3(0, altura, 0)
	var y0 := l.global_position.y
	var tw := create_tween()
	if atraso > 0.0:
		tw.tween_interval(atraso)
	tw.tween_method(func(f: float):
		l.global_position.y = y0 + f * subir
		# não sai pelo topo da tela: no mínimo 12% abaixo dele
		var cam := get_viewport().get_camera_3d()
		if cam:
			var alto: float = get_viewport().get_visible_rect().size.y
			if px > 0.0: # tamanho fixo na tela (px de altura de letra), perto ou longe da câmera
				var dist: float = max(0.3, cam.global_position.distance_to(l.global_position))
				l.pixel_size = px * 2.0 * dist * tan(deg_to_rad(cam.fov) * 0.5) / alto / float(l.font_size) * 1.35
			for _k in 40:
				if cam.unproject_position(l.global_position).y >= alto * 0.12 + 24.0:
					break
				l.global_position.y -= 0.05
		l.modulate.a = smoothstep(0.0, 0.12, f) * (1.0 - smoothstep(0.7, 1.0, f))
		l.outline_modulate.a = l.modulate.a, 0.0, 1.0, 1.6)
	tw.tween_callback(l.queue_free)

# Dash: rastro de vento atrás do corpo (forte = investida / dash rápido, com faíscas)
func dash(corpo: Node3D, dur: float, forte: bool) -> void:
	_som("dash", corpo.global_position, 0.0 if forte else -3.0)
	var r := trilhos(corpo)
	r.dash_t = dur
	r.forte = dur if forte else 0.0
	if forte:
		var p := corpo.global_position
		fumaca_chao(p.x, p.z, 0.8, 14, "9a948a", 1.4)
		surto(p.x, p.y + 0.3, p.z, 18, "ffffff", "3aa8ff", 5.0, 0.1)

# Corpo envolvido (Escudo Arcano, casca de gelo) ou anel de estrelas girando na cabeça (atordoado)
func _bolha(corpo: Node3D, cor, dur: float, raio: float, alt: float, op: float, achatar := 1.0) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var esf := SphereMesh.new()
	esf.radius = raio
	esf.height = raio * 2.0 * achatar
	esf.radial_segments = 32
	esf.rings = 16
	mi.mesh = esf
	mi.material_override = material("bolha", SH_BOLHA, {"cor": c(cor), "op": 0.0})
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mi.global_position = corpo.global_position + Vector3(0, alt, 0)
	bolhas.append({"m": mi, "corpo": corpo, "t": 0.0, "dur": dur, "op": op, "alt": alt, "gira": 0.0})
	return mi

func escudo(corpo: Node3D, dur: float) -> void:
	escudo_fim(corpo)
	_som("q_escudo", corpo.global_position, -2.0, 0.03)
	_bolha(corpo, "ffc24a", dur, 0.95, 0.95, 0.9, 1.15)
	var p := corpo.global_position
	anel(p.x, p.z, 1.1, "ffd36a", 0.5, p.y)
	surto(p.x, p.y + 1.0, p.z, 30, "fff6d6", "ffbf3a", 4.0, 0.08)
	luz("ffc24a", 2.5, 5.0, 0.5).l.global_position = p + Vector3(0, 1.2, 0)

# o escudo acabou ou quebrou: some com um estalo dourado
func escudo_fim(corpo: Node3D) -> void:
	for b in bolhas:
		if b.corpo == corpo and b.alt > 0.5 and b.t < b.dur - 0.3:
			b.dur = b.t + 0.3
			var p: Vector3 = b.m.global_position
			surto(p.x, p.y, p.z, 24, "fff6d6", "ffbf3a", 6.0, 0.08)

# Abraço do Vórtice: anel roxo e partículas correndo em espiral para o centro
func vortice(x: float, z: float, r: float, y := 0.0) -> void:
	_som("q_vortice", Vector3(x, y, z), -1.0, 0.04)
	anel(x, z, r, "9a5cff", 0.6, y)
	anel(x, z, r * 0.55, "c8a8ff", 0.45, y)
	for i in 70:
		var a := randf() * TAU
		var d := r * randf_range(0.6, 1.0)
		var v := d / randf_range(0.35, 0.55)
		var tang := randf_range(2.0, 4.0)
		part(FOGO, x + cos(a) * d, y + randf_range(0.2, 1.4), z + sin(a) * d, -cos(a) * v - sin(a) * tang, randf_range(-0.2, 0.4), -sin(a) * v + cos(a) * tang,
			randf_range(0.35, 0.55), 0.11 * H, 0.02, "f2e6ff", "7a3cff", 1.0, 0.0, 0.5)
	fumaca_chao(x, z, r * 0.7, 18, "5a4a7a", 1.2)
	luz("8a4aff", 3.0, r * 2.0, 0.6).l.global_position = Vector3(x, y + 1.0, z)

# congelado (casca de gelo azul) ou atordoado (estrelas na cabeça)
func status(corpo: Node3D, k: String, dur: float) -> void:
	for b in bolhas: # já tinha: só estica o tempo
		if b.corpo == corpo and b.get("k", "") == k:
			b.dur = max(b.dur, b.t + dur)
			return
	var p := corpo.global_position
	if k == "congela":
		var m := _bolha(corpo, "8fdcff", dur, 0.75, 0.85, 1.0, 1.35)
		bolhas[-1].k = k
		surto(p.x, p.y + 0.9, p.z, 26, "eafcff", "3fb4ff", 3.5, 0.09)
		m.scale = Vector3(1.0, 1.0, 1.0)
	else:
		var g := Node3D.new()
		add_child(g)
		for i in 5:
			var e := MeshInstance3D.new()
			var q := SphereMesh.new()
			q.radius = 0.055
			q.height = 0.11
			q.radial_segments = 8
			q.rings = 4
			e.mesh = q
			e.material_override = material("basico", SH_BASICO, {"cor": c("ffe27a"), "op": 1.0})
			e.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			var a := i / 5.0 * TAU
			e.position = Vector3(cos(a) * 0.32, 0, sin(a) * 0.32)
			g.add_child(e)
		g.global_position = p + Vector3(0, 2.0, 0)
		bolhas.append({"m": g, "corpo": corpo, "t": 0.0, "dur": dur, "op": -1.0, "alt": 2.0 * corpo.scale.y, "gira": 5.0, "k": k})

# magia concentrada cancelada: o círculo some e a carga para
func cancelar_conjura(corpo: Node3D) -> void:
	for k in circulos:
		if k.corpo == corpo and k.vivo:
			k.dur = k.t

func status_fim(corpo: Node3D) -> void:
	for b in bolhas:
		if b.corpo == corpo and b.has("k"):
			b.dur = min(b.dur, b.t + 0.2)

# subiu de nível: coluna dourada, anel e brilho subindo
func subir_nivel(corpo: Node3D) -> void:
	_som("nivel", corpo.global_position, -2.0, 0.0)
	var p := corpo.global_position
	conjura(corpo, "nivel", 1.4)
	anel(p.x, p.z, 2.2, "ffd36a", 1.0, p.y)
	for i in 60:
		var a := randf() * TAU
		var d := randf_range(0.1, 0.9)
		part(FOGO, p.x + cos(a) * d, p.y + randf_range(0.0, 0.6), p.z + sin(a) * d, 0, randf_range(2.0, 4.5), 0, randf_range(0.8, 1.4), 0.1 * H, 0.02, "fff6d0", "ffb42a", 1.0, 0.6, 0.3)
	luz("ffc24a", 4.0, 8.0, 1.2, corpo)

# ---------------------------------------------------------------- rastros
class Faixa:
	var N: int
	var V: int
	var vida: float
	var pts: Array = []
	var im: ImmediateMesh
	var mi: MeshInstance3D
	var vazia := false

func _faixa(n: int, v: int, cor, vida: float) -> Faixa:
	var f := Faixa.new()
	f.N = n
	f.V = v
	f.vida = vida
	f.im = ImmediateMesh.new()
	f.mi = MeshInstance3D.new()
	f.mi.mesh = f.im
	f.mi.material_override = material("faixa_" + str(cor), SH_FAIXA, {"cor": c(cor)})
	f.mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	f.mi.extra_cull_margin = 16384.0
	add_child(f.mi)
	return f

func _faixa_passo(f: Faixa, dt: float, linha, perfil: Array, forca: float) -> void:
	if linha != null:
		f.pts.push_front({"l": linha, "t": 0.0})
	for p in f.pts:
		p.t += dt
	while f.pts.size() > f.N or (f.pts.size() > 0 and f.pts.back().t > f.vida):
		f.pts.pop_back()
	if f.pts.size() < 2:
		if f.vazia:
			return
		f.vazia = true
		f.im.clear_surfaces()
		return
	f.vazia = false
	f.im.clear_surfaces()
	f.im.surface_begin(Mesh.PRIMITIVE_TRIANGLES)
	var n := f.pts.size()
	for i in n - 1:
		for j in f.V - 1:
			var q := [[i, j], [i, j + 1], [i + 1, j], [i, j + 1], [i + 1, j + 1], [i + 1, j]]
			for e in q:
				var p: Dictionary = f.pts[e[0]]
				var a: float = max(0.0, 1.0 - p.t / f.vida) * (1.0 - float(e[0]) / f.N) * forca * perfil[e[1]]
				f.im.surface_set_color(Color(1, 1, 1, a))
				f.im.surface_add_vertex(p.l[e[1]])
	f.im.surface_end()

func trilhos(corpo: Node3D) -> Dictionary:
	if not rastros.has(corpo):
		rastros[corpo] = {"dash": _faixa(28, 5, "73c7ff", 0.3), "lamina": _faixa(14, 2, "bfeaff", 0.14), "dash_t": 0.0, "forte": 0.0,
			"lamina2": _faixa(36, 4, "6fbfff", 0.22), "l2_ult": null} # lamina2: brilho largo da espada mágica, curvo, some fazendo a curva do golpe
	return rastros[corpo]

const PERFIL_DASH := [0.0, 0.55, 1.0, 0.7, 0.0]
const PERFIL_LAMINA := [0.25, 1.0]
const PERFIL_LAMINA2 := [0.0, 0.3, 1.0, 0.25] # transparente no lado do cabo, forte na ponta (borda de fora)
const LAMINA2_SUB := 3 # amostras extras por quadro, girando em volta do herói: o rastro sai curvo mesmo a 30 FPS

# chamado todo quadro para o herói: lamina = [base, ponta] da espada no mundo durante o golpe (ou null)
func corpo_passo(corpo: Node3D, dt: float, correndo_dash: bool, lamina) -> void:
	var r := trilhos(corpo)
	var dash_on: bool = correndo_dash or r.dash_t > 0
	r.dash_t -= dt
	r.forte = max(0.0, r.forte - dt)
	var p := corpo.global_position
	var linha = null
	if dash_on:
		linha = []
		for k in [0.12, 0.31, 0.51, 0.7, 0.9]:
			linha.append(Vector3(p.x, p.y + H * k, p.z))
	_faixa_passo(r.dash, dt, linha, PERFIL_DASH, 0.75 if r.forte > 0 else 0.42)
	if r.forte > 0:
		for k in 4:
			var y := p.y + randf_range(0.2, 1.6)
			part(FOGO, p.x + randf_range(-0.3, 0.3), y, p.z + randf_range(-0.3, 0.3), randf_range(-0.3, 0.3), randf_range(-0.2, 0.2), randf_range(-0.3, 0.3), randf_range(0.2, 0.35), 0.08 * H, 0.01, "ffffff", "3aa8ff", 0.9)
			if k < 2:
				part(FUMA, p.x, p.y + 0.1, p.z, randf_range(-1, 1), randf_range(0.2, 0.8), randf_range(-1, 1), 0.6, 0.2 * H, 0.5 * H, "b0a898", "6a6458", 0.35, 0.3, 1.5)
	_faixa_passo(r.lamina, dt, lamina, PERFIL_LAMINA, 0.7)
	var l2 = null
	if lamina != null: # do meio da lâmina até um pouco além da ponta
		var b: Vector3 = lamina[0]
		var p2: Vector3 = lamina[1]
		l2 = [b.lerp(p2, 0.3), b.lerp(p2, 0.75), p2, p2 + (p2 - b) * 0.1]
		# entre o quadro anterior e este: amostras girando em volta do corpo (arco, não reta)
		if r.l2_ult != null:
			for s in range(1, LAMINA2_SUB + 1):
				var u: float = float(s) / (LAMINA2_SUB + 1)
				var meio := []
				for k in l2.size():
					meio.append(_arco_em_volta(r.l2_ult[k], l2[k], p, u))
				r.lamina2.pts.push_front({"l": meio, "t": -dt * u})
		r.l2_ult = l2
	else:
		r.l2_ult = null
	_faixa_passo(r.lamina2, dt, l2, PERFIL_LAMINA2, 0.55)

# ponto entre a e b girando em volta do eixo vertical que passa por centro (ângulo, raio e altura interpolados)
func _arco_em_volta(a: Vector3, b: Vector3, centro: Vector3, u: float) -> Vector3:
	var va := Vector2(a.x - centro.x, a.z - centro.z)
	var vb := Vector2(b.x - centro.x, b.z - centro.z)
	var ang: float = lerp_angle(va.angle(), vb.angle(), u)
	var raio: float = lerp(va.length(), vb.length(), u)
	return Vector3(centro.x + cos(ang) * raio, lerp(a.y, b.y, u), centro.z + sin(ang) * raio)

# onda de choque de gelo no chão: anel fino (12% do raio) que abre de 0,4 a 1,6 m em 0,28 s, alfa 0,5 -> 0
const SH_ONDA_CORTE := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;
uniform vec4 cor : source_color = vec4(0.62, 0.89, 1.0, 1.0);
uniform float op = 0.5;
void fragment() {
	float d = length(UV - 0.5) * 2.0;
	float anel = smoothstep(0.86, 0.9, d) * (1.0 - smoothstep(0.97, 1.0, d));
	ALBEDO = cor.rgb;
	ALPHA = anel * op;
}
"""
func onda_corte(x: float, z: float, y: float) -> void:
	var mi := MeshInstance3D.new()
	var q := PlaneMesh.new()
	q.size = Vector2(2, 2)
	mi.mesh = q
	var mat := material("onda_corte", SH_ONDA_CORTE).duplicate()
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mi.global_position = Vector3(x, y + 0.04, z)
	mi.scale = Vector3.ONE * 0.4
	var tw := create_tween()
	tw.tween_method(func(t: float):
		var r: float = lerp(0.4, 1.6, 1.0 - (1.0 - t) * (1.0 - t))
		mi.scale = Vector3(r, 1, r)
		mat.set_shader_parameter("op", 0.5 * (1.0 - t)), 0.0, 1.0, 0.28)
	tw.tween_callback(mi.queue_free)

# marca do corte da espada no ponto que acertou: meia-lua branca-azulada rápida, na direção do golpe
func marca_corte(p: Vector3, ry: float, forte: bool) -> void:
	var g := Node3D.new()
	add_child(g)
	var l := lua("bfe6ff")
	l.rotation = Vector3(PI / 2, 0, randf_range(-0.9, 0.9)) # de pé, inclinada como o golpe
	l.scale = Vector3.ONE * (0.75 if forte else 0.55)
	g.add_child(l)
	g.position = p
	g.rotation.y = ry
	giros.append({"g": g, "mats": [l.material_override], "t": 0.0, "dur": 0.16, "gira": 0.0, "cresce": 0.7})
	if forte: # 4º golpe e crítico: onda de choque de gelo no chão (#9fe3ff)
		onda_corte(p.x, p.z, p.y - 1.05)
		poeira(p.x, p.z, 0.8, 8, "c9bda6", "8a7f6c")

# ---------------------------------------------------------------- quadro a quadro
var ms := 0.0 # tempo gasto aqui por quadro (média), aparece no Teste
func _process(dt: float) -> void:
	var t0 := Time.get_ticks_usec()
	_passo(dt)
	ms = lerp(ms, (Time.get_ticks_usec() - t0) / 1000.0, 0.05)

func _passo(dt: float) -> void:
	var i := agenda.size() - 1
	while i >= 0:
		agenda[i].t -= dt
		if agenda[i].t <= 0:
			var fn: Callable = agenda[i].fn
			agenda.remove_at(i)
			fn.call()
		i -= 1
	# bolhas presas nos corpos (escudo, gelo, atordoado)
	i = bolhas.size() - 1
	while i >= 0:
		var b: Dictionary = bolhas[i]
		b.t += dt
		if not is_instance_valid(b.corpo) or b.t >= b.dur:
			b.m.queue_free()
			bolhas.remove_at(i)
			i -= 1
			continue
		b.m.global_position = b.corpo.global_position + Vector3(0, b.alt, 0)
		if b.gira != 0.0:
			b.m.rotation.y += b.gira * dt
		if b.op >= 0.0:
			var k: float = min(1.0, b.t / 0.2) * min(1.0, (b.dur - b.t) / 0.3)
			b.m.material_override.set_shader_parameter("op", b.op * k)
		i -= 1
	# raios
	i = raios.size() - 1
	while i >= 0:
		var r: Dictionary = raios[i]
		r.t += dt
		var u: float = r.t / r.dur
		r.g.visible = u < 0.15 or randf() < 0.8
		for mm in r.mats:
			mm[0].set_shader_parameter("op", mm[1] * max(0.0, 1.0 - u))
		if u >= 1:
			r.g.queue_free()
			raios.remove_at(i)
		i -= 1
	# meias-luas
	i = giros.size() - 1
	while i >= 0:
		var q: Dictionary = giros[i]
		q.t += dt
		var u: float = q.t / q.dur
		q.g.rotation.y += q.gira * dt
		q.g.scale = Vector3.ONE * (1.0 + q.cresce * u)
		for m in q.mats:
			m.set_shader_parameter("op", max(0.0, u * 5.0 if u < 0.2 else 1.0 - (u - 0.2) / 0.8))
		if u >= 1:
			q.g.queue_free()
			giros.remove_at(i)
		i -= 1
	# círculos de quem está conjurando
	i = circulos.size() - 1
	while i >= 0:
		var k: Dictionary = circulos[i]
		var corpo: Node3D = k.corpo
		var ok := is_instance_valid(corpo)
		var p: Vector3 = corpo.global_position if ok else k.g.position
		var cb = k.cb
		var cc = k.cc
		var r: float = k.r
		k.t += dt
		if k.t >= k.dur or not ok:
			if k.vivo and k.get("voz") != null and mundo and mundo.sons:
				mundo.sons.parar(k.voz, k.voz_som)
			k.vivo = false
		k.f = min(1.0, k.f + dt * 6.0) if k.vivo else k.f - dt * 3.0
		k.g.position = Vector3(p.x, p.y + 0.07, p.z)
		var pulso := 1.0 + sin(k.t * 14.0) * 0.04
		var ent := 1.0 - pow(1.0 - min(1.0, k.t / 0.25), 3.0)
		if k.vivo:
			k.a.scale = Vector3.ONE * r * ent * pulso
			k.b.scale = Vector3.ONE * r * 0.62 * ent
			k.col.scale = Vector3(r * 0.8 * ent, H * 1.5, r * 0.8 * ent)
			k.col.position.y = H * 0.75
		else:
			k.a.scale *= 1.0 + dt * 0.6
		k.a.rotation.y = -k.t * 0.9
		k.b.rotation.y = k.t * 1.6
		var f: float = max(0.0, k.f)
		circulo_definir(k.a, cc, f)
		circulo_definir(k.b, cc, f * 0.9)
		k.col.material_override.set_shader_parameter("op", f * 0.45)
		if k.vivo:
			if randf() < dt * 40:
				var a := randf() * TAU
				labareda(p.x + cos(a) * r * 0.9, p.y + 0.05, p.z + sin(a) * r * 0.9, cb, cc, 0.8)
			if randf() < dt * 30:
				var a: float = k.t * 5.0 + randf() * 0.4
				var d := r * randf_range(0.3, 0.8)
				part(FOGO, p.x + cos(a) * d, p.y + 0.1, p.z + sin(a) * d, -sin(a) * 0.8, randf_range(1.5, 3), cos(a) * 0.8, 0.8, 0.07 * H, 0.02 * H, "ffffff", cc, 1.0, 0.5, 0.3)
			if randf() < dt * 8:
				fumaca_chao(p.x, p.z, r * 0.9, 1, "8a8496", 0.6)
			var n := dt * 120.0
			while n > 0:
				if randf() < n:
					poeira(p.x, p.z, r, 1, cb, cc)
				n -= 1.0
			if k.magia and k.maos.is_valid():
				for m in k.maos.call():
					part(FOGO, m.x, m.y, m.z, 0, 0, 0, 0.1, 0.3 * H, 0.18 * H, cb, cc, 0.85)
					if randf() < dt * 20:
						part(FOGO, m.x, m.y, m.z, randf_range(-1, 1), randf_range(0, 1.5), randf_range(-1, 1), 0.4, 0.06 * H, 0.01, "ffffff", cc, 1.0, -2.0)
			k.luz.l.global_position = Vector3(p.x, p.y + 0.9 * H, p.z)
			k.luz.int = 1.0 + sin(k.t * 20.0) * 0.25
		if k.f <= 0:
			k.g.queue_free()
			circulos.remove_at(i)
		i -= 1
	# explosões
	i = areas.size() - 1
	while i >= 0:
		var a: Dictionary = areas[i]
		a.t += dt
		var u: float = a.t / 0.9
		if u >= 1:
			a.m.queue_free()
			areas.remove_at(i)
			i -= 1
			continue
		a.m.scale = Vector3.ONE * a.r * (0.3 + 0.75 * (1.0 - pow(1.0 - u, 3.0)))
		a.m.rotation.y = -a.t * 1.2
		circulo_definir(a.m, a.cc, u * 10.0 if u < 0.1 else 1.0 - (u - 0.1) / 0.9)
		i -= 1
	# área da chuva de meteoros
	i = campos.size() - 1
	while i >= 0:
		var fc: Dictionary = campos[i]
		fc.t += dt
		var op: float = min(1.0, min(fc.t * 4.0, (fc.dur - fc.t) * 2.0))
		fc.m.rotation.y = -fc.t * 0.7
		if fc.has("max"):
			op = min(1.0, min(fc.t / fc.entra, (fc.dur - fc.t) / fc.sai))
			circulo_definir(fc.m, fc.cc, max(0.0, op) * fc.max)
		else:
			circulo_definir(fc.m, fc.cc, max(0.0, op) * (0.7 if fc.fraco else 0.9))
		if fc.t >= fc.dur:
			fc.m.queue_free()
			campos.remove_at(i)
		i -= 1
	# projéteis
	i = projeteis.size() - 1
	while i >= 0:
		var p: Dictionary = projeteis[i]
		var m: Node3D = p.m
		var passo: float = p.vel * dt
		m.global_position += p.dir * passo
		p.andou += passo
		p.t += dt
		var o := m.global_position
		var cor: Color = p.info.cor
		var tm: float = p.info.tam
		var vx: float = -p.dir.x * p.vel
		var vy: float = -p.dir.y * p.vel
		var vz: float = -p.dir.z * p.vel
		_cometa_escala(m, 1.0 + sin(p.t * 31.0) * 0.08, min(1.0, p.t * 6.0) * (1.0 + sin(p.t * 23.0) * 0.06))
		if p.estilo == "fogo":
			part(FOGO, o.x, o.y, o.z, 0, 0, 0, 0.08, 1.6 * tm * 2.0, tm * 2.0, "fff2b0", cor, 0.7)
			for k in 2:
				part(FUMA, o.x + randf_range(-0.1, 0.1), o.y + randf_range(-0.1, 0.1), o.z + randf_range(-0.1, 0.1), vx * 0.1 + randf_range(-0.4, 0.4), vy * 0.1 + randf_range(0.2, 1), vz * 0.1 + randf_range(-0.4, 0.4), randf_range(0.35, 0.6), tm * 1.2, tm * 4.0, "ff7a1a", "2a0a04", 0.3, 1.2, 0.8)
			for k in 4:
				var fr := randf_range(0, 0.6)
				part(FOGO, o.x + vx * fr * 0.1 + randf_range(-0.1, 0.1), o.y + vy * fr * 0.1 + randf_range(-0.1, 0.1), o.z + vz * fr * 0.1 + randf_range(-0.1, 0.1), vx * 0.15 + randf_range(-0.6, 0.6), randf_range(-0.3, 0.9), vz * 0.15 + randf_range(-0.6, 0.6), randf_range(0.2, 0.5), tm * randf_range(0.4, 0.9), 0.01, "ffe08a", "ff3a0a", 1.0, -2.0, 1.0)
		else:
			part(FOGO, o.x, o.y, o.z, randf_range(-0.4, 0.4), randf_range(-0.2, 0.4), randf_range(-0.4, 0.4), 0.3, 0.1 * H, 0.01, "ffffff", cor, 0.9, 0.0, 1.0)
		if p.luz != null and p.luz.dono == m:
			p.luz.l.global_position = o
			p.luz.vida = 1.0
		var acabou: bool = p.andou > p.alcance
		if mundo != null:
			var alvo = mundo.inimigo_em(o, 0.7)
			if alvo:
				mundo.ferir(alvo, p.dmg, o, p.info.get("hab"))
				if p.info.has("explosao"):
					mundo.dano_area(o, p.info.explosao, p.dmg * 0.6, p.info.get("hab"))
				acabou = true
		if not acabou and mundo != null and o.y < mundo.terreno.altura(o.x, o.z, o.y) + 0.05:
			acabou = true # bateu na pedra ou no chão
		if acabou:
			_fim_projetil(p)
			projeteis.remove_at(i)
		i -= 1
	# meteoros: descem em diagonal deixando fogo e explodem no chão
	i = meteoros.size() - 1
	while i >= 0:
		var q: Dictionary = meteoros[i]
		q.t += dt
		if q.t < 0:
			i -= 1
			continue
		var u: float = min(1.0, q.t / q.dur)
		q.o.visible = true
		q.o.global_position = q.de.lerp(q.para, pow(u, 1.5) if q.get("gigante", false) else u * u)
		var o: Vector3 = q.o.global_position
		if q.get("gigante", false):
			q.rocha.rotation += q.gira * dt
			for k in 5:
				var a := randf() * TAU
				var rr := randf_range(0.6, 1.2) * METEORO_RAIO
				part(FOGO, o.x + cos(a) * rr, o.y + randf_range(-0.6, 0.6), o.z + sin(a) * rr, randf_range(-1, 1), randf_range(1, 3), randf_range(-1, 1), randf_range(0.35, 0.6), 0.6 * H, 0.1 * H, q.cb, q.cc, 0.9, 1.5, 0.5)
			for k in 2:
				part(FUMA, o.x + randf_range(-0.8, 0.8), o.y + randf_range(-0.4, 0.8), o.z + randf_range(-0.8, 0.8), randf_range(-0.5, 0.5), randf_range(0.5, 1.5), randf_range(-0.5, 0.5), randf_range(1.0, 1.6), 0.9 * H, 1.7 * H, "6a5048", "201a18", 0.65, 0.4, 0.6)
			if u >= 1:
				q.o.queue_free()
				meteoros.remove_at(i)
				meteoro_impacto(q.para, q.r_imp)
				if q.fn.is_valid():
					q.fn.call(q.para)
			i -= 1
			continue
		for k in 3:
			part(FOGO, o.x + randf_range(-0.1, 0.1), o.y + randf_range(-0.1, 0.1), o.z + randf_range(-0.1, 0.1), randf_range(-0.4, 0.4), randf_range(0, 1), randf_range(-0.4, 0.4), randf_range(0.25, 0.45), 0.35 * H, 0.04 * H, q.cb, q.cc, 0.9, 1.5, 0.5)
		part(FUMA, o.x, o.y, o.z, randf_range(-0.3, 0.3), randf_range(0, 0.6), randf_range(-0.3, 0.3), 0.5, 0.25 * H, 0.45 * H, "ff9a1a", "3a0a04", 0.7, 1.0, 0.5)
		if u >= 1:
			q.o.queue_free()
			meteoros.remove_at(i)
			area(q.para.x, q.para.z, q.get("r_imp", 1.1), [q.cb, q.cc], q.get("forte", 0.45), q.para.y)
			_som("explosao", q.para, -4.0, 0.15)
			if q.fn.is_valid():
				q.fn.call(q.para)
		i -= 1
	# Meteoro: cúpula de fogo, onda de choque, pedras voando e cratera esfriando
	i = domos.size() - 1
	while i >= 0:
		var dm: Dictionary = domos[i]
		dm.t += dt
		var u: float = dm.t / dm.dur
		if u >= 1:
			dm.m.queue_free()
			domos.remove_at(i)
			i -= 1
			continue
		var cresce: float = 1.0 - pow(1.0 - min(1.0, u * 1.6), 3.0)
		dm.m.scale = Vector3(dm.r, dm.r * 0.85, dm.r) * (0.25 + 0.75 * cresce)
		dm.m.material_override.set_shader_parameter("op", 0.6 * (1.0 - u * u)) # direção de arte: cúpula + clarão até 0,6
		i -= 1
	i = ondas.size() - 1
	while i >= 0:
		var od: Dictionary = ondas[i]
		od.t += dt
		if od.t < 0:
			od.m.visible = false
			i -= 1
			continue
		od.m.visible = true
		var u: float = od.t / od.dur
		if u >= 1:
			od.m.queue_free()
			ondas.remove_at(i)
			i -= 1
			continue
		var rr: float = od.r * (0.15 + 0.85 * (1.0 - pow(1.0 - u, 2.0)))
		od.m.scale = Vector3(rr, 0.04 + 0.3 * (1.0 - u), rr)
		od.m.material_override.set_shader_parameter("op", 0.5 * (1.0 - u))
		i -= 1
	i = pedras.size() - 1
	while i >= 0:
		var pd: Dictionary = pedras[i]
		pd.t += dt
		pd.v.y -= 18.0 * dt
		pd.m.position += pd.v * dt
		pd.m.rotation += pd.gira * dt
		var pp: Vector3 = pd.m.position
		if pd.t < 0.9 and randf() < 0.7:
			part(FOGO, pp.x, pp.y, pp.z, 0, 0.3, 0, 0.3, 0.14 * H, 0.03 * H, "ffd06a", "ff5a12", 0.8, 0.5, 0.5)
			part(FUMA, pp.x, pp.y, pp.z, 0, 0.4, 0, 0.6, 0.12 * H, 0.35 * H, "4a3a36", "201a18", 0.5, 0.2, 0.5)
		var chao: float = mundo.terreno.altura(pp.x, pp.z) if mundo and mundo.get("terreno") else 0.0
		if (pd.v.y < 0 and pp.y < chao + 0.1) or pd.t > 2.5:
			fumaca_chao(pp.x, pp.z, 0.3, 4, "6a5e58", 0.6)
			pd.m.queue_free()
			pedras.remove_at(i)
		i -= 1
	i = crateras.size() - 1
	while i >= 0:
		var cr: Dictionary = crateras[i]
		cr.t += dt
		var u: float = cr.t / cr.dur
		if u >= 1:
			cr.m.queue_free()
			crateras.remove_at(i)
			i -= 1
			continue
		cr.m.material_override.set_shader_parameter("calor", max(0.0, 1.0 - u * 1.4))
		cr.m.material_override.set_shader_parameter("op", 1.0 if u < 0.7 else 1.0 - (u - 0.7) / 0.3)
		i -= 1
	# anéis
	i = aneis.size() - 1
	while i >= 0:
		var e: Dictionary = aneis[i]
		e.vida -= dt
		var k: float = max(0.0, e.vida / e.max)
		e.m.material_override.set_shader_parameter("op", 0.8 * k)
		var s := 1.0 + (1.0 - k) * 0.3
		e.m.scale = Vector3(s, 0.02, s)
		if e.vida <= 0:
			e.m.queue_free()
			aneis.remove_at(i)
		i -= 1
	# luzes
	for q in luzes:
		if q.vida > 0:
			q.vida -= dt
			q.l.light_energy = q.int * BRILHO * min(1.0, q.vida / min(0.3, q.max))
		else:
			q.l.light_energy = 0.0
	_lote_passo(FOGO, dt)
	_lote_passo(FUMA, dt)

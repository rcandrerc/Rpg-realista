extends Node3D
# Efeitos visuais, iguais aos do site (client/src/efeitos.js): círculo mágico com pentagrama e coluna de luz ao conjurar,
# labaredas, fumaça e brasas, cometa de fogo com cauda, tiro arcano, explosões, raio em zigue-zague, chuva de meteoros,
# meias-luas do Giro, estocada da Investida, rastro da espada e do dash, e os números de dano.
# Cores: os números do site valem direto como luz linear (o site não converte as cores), por isso aqui também não.
# Partículas: dois lotes (fogo somando luz e fumaça por cima), cada um uma MultiMesh só (uma chamada de desenho).

const H := 1.65 # altura de referência de um corpo (m)
const BRILHO := 0.65 # mundo claro: o brilho somado não pode estourar

var mundo # main.gd (para achar os inimigos nos projéteis)

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
		"luz": luz(cc, 1.2, 7.0, dur + 0.3, corpo), "maos": maos})
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
func area(x: float, z: float, r: float, cores: Array, forte := 1.0, y := 0.0) -> void:
	var m := circulo_malha(true)
	m.position = Vector3(x, y + 0.06, z)
	areas.append({"m": m, "t": 0.0, "r": r, "cc": cores[1]})
	luz(cores[1], 4.0 * forte, r * 3.0, 0.5).l.global_position = Vector3(x, y + 1.2, z)
	for i in int(round(55 * forte)):
		var a := randf() * TAU
		var d := r * sqrt(randf())
		labareda(x + cos(a) * d, y + 0.05, z + sin(a) * d, cores[0], cores[1], 1.1 + 0.5 * forte)
	surto(x, y + 0.4 * H, z, int(round(40 * forte)), cores[0], cores[1], 9.0)
	fumaca_chao(x, z, r * 0.8, int(round(30 * forte)), "77707e", 1.6)
	part(FOGO, x, y + 0.5 * H, z, 0, 0, 0, 0.3, r * 0.7, r * 1.4, "ffffff", cores[1], 0.6)

# habilidades de área em volta do herói (Explosão, Salto Esmagador, Giro da Lâmina)
func explosao_hab(fx: String, x: float, z: float, r: float, y := 0.0) -> void:
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
		anel(x, z, r, "eef4ff", 0.35, y)
		area(x, z, r * 0.95, ["fff0c0", "ffb84a"], 0.5, y)
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

# Projétil: cometa de fogo ou tiro arcano. Voa até acertar alguém ou acabar o alcance
func projetil(de: Vector3, dir: Vector3, info: Dictionary, dmg: float, alcance := 20.0) -> void:
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
	if p.luz != null and p.luz.dono == p.m:
		p.luz.vida = 0.0
		p.luz.dono = null
	p.m.queue_free()

# Cura: brilho verde subindo (o círculo vem do conjura)
func cura(alvo: Node3D) -> void:
	var p := alvo.global_position
	anel(p.x, p.z, 1.6, "9be08f", 0.8, p.y)
	for i in 30:
		var a := randf() * TAU
		var d := randf_range(0.2, 0.7)
		part(FOGO, p.x + cos(a) * d, p.y + randf_range(0.1, 1.2), p.z + sin(a) * d, 0, randf_range(0.8, 1.8), 0, randf_range(0.7, 1.2), 0.08 * H, 0.02 * H, "e4ffd8", "36c060", 1.0, 0.5, 0.5)

# Número de dano (ou cura) que sobe e some
func numero(pos: Vector3, valor: float, cor := Color.WHITE, critico := false) -> void:
	var l := Label3D.new()
	l.text = str(int(round(valor))) + ("!" if critico else "")
	if critico:
		l.scale = Vector3.ONE * 1.45
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
	var tw := create_tween()
	tw.tween_method(func(t: float):
		l.global_position.y = y0 + t * 0.9
		l.modulate.a = 1.0 - smoothstep(0.5, 1.0, t)
		l.outline_modulate.a = l.modulate.a, 0.0, 1.0, 0.8)
	tw.tween_callback(l.queue_free)

# Dash: rastro de vento atrás do corpo (forte = investida / dash rápido, com faíscas)
func dash(corpo: Node3D, dur: float, forte: bool) -> void:
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

func status_fim(corpo: Node3D) -> void:
	for b in bolhas:
		if b.corpo == corpo and b.has("k"):
			b.dur = min(b.dur, b.t + 0.2)

# subiu de nível: coluna dourada, anel e brilho subindo
func subir_nivel(corpo: Node3D) -> void:
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
		rastros[corpo] = {"dash": _faixa(28, 5, "73c7ff", 0.3), "lamina": _faixa(14, 2, "bfeaff", 0.14), "dash_t": 0.0, "forte": 0.0}
	return rastros[corpo]

const PERFIL_DASH := [0.0, 0.55, 1.0, 0.7, 0.0]
const PERFIL_LAMINA := [0.25, 1.0]

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
		q.o.global_position = q.de.lerp(q.para, u * u)
		var o: Vector3 = q.o.global_position
		for k in 3:
			part(FOGO, o.x + randf_range(-0.1, 0.1), o.y + randf_range(-0.1, 0.1), o.z + randf_range(-0.1, 0.1), randf_range(-0.4, 0.4), randf_range(0, 1), randf_range(-0.4, 0.4), randf_range(0.25, 0.45), 0.35 * H, 0.04 * H, q.cb, q.cc, 0.9, 1.5, 0.5)
		part(FUMA, o.x, o.y, o.z, randf_range(-0.3, 0.3), randf_range(0, 0.6), randf_range(-0.3, 0.3), 0.5, 0.25 * H, 0.45 * H, "ff9a1a", "3a0a04", 0.7, 1.0, 0.5)
		if u >= 1:
			q.o.queue_free()
			meteoros.remove_at(i)
			area(q.para.x, q.para.z, 1.1, [q.cb, q.cc], 0.45)
			if q.fn.is_valid():
				q.fn.call(q.para)
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

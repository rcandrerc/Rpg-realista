extends Node3D
const Lentidao = preload("res://lentidao.gd") # quadro lento: Lentidao.parte
# Magias novas do cajado (pedido do André, 2026-11-03: "skills de mago incríveis, sem cara de amador"):
# Faísca (básico), Bola de Fogo (dano num alvo), Nova de Gelo (controle) e o portal/fogo do Meteoro.
# As partículas aqui usam TEXTURA (efeitos/magia_atlas.png, montado do Kenney Particle Pack, CC0): chama de verdade,
# fumaça em flocos, faísca esticada na direção do voo, runa girando no chão. O sistema antigo (bolinhas suaves de
# efeitos.gd) continua lá para as outras skills.
# Dois lotes (luz somada e fumaça/terra por cima), cada um uma MultiMesh só: uma chamada de desenho por lote.

var fx # efeitos.gd (sons, luzes, mundo, câmera, materiais)

const ATLAS := "res://efeitos/magia_atlas.png"
# casas do atlas (4x4)
const C_LUZ := 0
const C_FLARE := 1
const C_ESTRELA := 2
const C_RAIO := 3
const C_CHAMA := 4
const C_CHAMA2 := 5
const C_FOGO := 6
const C_RUNA := 7
const C_FUMACA := 8
const C_FUMACA2 := 9
const C_DISCO := 10
const C_GIRO := 11
const C_QUEIMADO := 12
const C_TERRA := 13
const C_TRACO := 14
const C_ESTRELA2 := 15

const BRILHO := 0.85 # mundo claro: a luz somada não pode estourar em branco
# quanto cada textura tampa o fundo (o resto soma luz): faísca e clarão só brilham.
# TOON (2.0) = chama/fumaça no estilo anime: formas de borda dura com 3 faixas de cor (miolo claro, meio, borda escura)
# que vão sendo "comidas" pelo ruído até sumir. Num mundo claro de dia, fogo só somando luz vira borrão branco;
# assim ele lê como fogo pintado (direção de arte: mundo anime pintado).
const TOON := 2.0
const COBRE := {C_RUNA: 0.3, C_GIRO: 0.4, C_DISCO: 0.2, C_LUZ: 0.15}

const SH := """
shader_type spatial;
render_mode unshaded, %s, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
uniform sampler2D atlas : source_color, filter_linear_mipmap, repeat_disable;
uniform float brilho = 1.0;
varying float cobre;
varying float vida;
varying vec2 luv;
varying vec2 semente;
void vertex() {
	cobre = INSTANCE_CUSTOM.z;
	float w = INSTANCE_CUSTOM.w;
	bool plano = w > 1.5;
	vida = plano ? w - 2.0 : w;
	float sx = length(MODEL_MATRIX[0].xyz);
	float sy = length(MODEL_MATRIX[1].xyz);
	float r = INSTANCE_CUSTOM.y;
	semente = vec2(fract(r * 0.7), fract(r * 1.3));
	vec3 ox;
	vec3 oy;
	if (plano) { // deitada no chão
		ox = vec3(cos(r), 0.0, -sin(r));
		oy = vec3(sin(r), 0.0, cos(r));
	} else { // virada para a câmera
		vec3 R = INV_VIEW_MATRIX[0].xyz;
		vec3 U = INV_VIEW_MATRIX[1].xyz;
		ox = R * cos(r) + U * sin(r);
		oy = -R * sin(r) + U * cos(r);
	}
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(vec4(ox * sx, 0.0), vec4(oy * sy, 0.0), vec4(cross(ox, oy), 0.0), MODEL_MATRIX[3]);
	vec4 mv = MODELVIEW_MATRIX * vec4(VERTEX, 1.0);
	COLOR.a *= clamp((-mv.z - 0.5) / 1.0, 0.0, 1.0); // some perto da câmera
	float c = floor(INSTANCE_CUSTOM.x + 0.5);
	luv = UV;
	UV = (UV + vec2(mod(c, 4.0), floor(c / 4.0))) * 0.25;
}
void fragment() {
	float a = texture(atlas, UV).a;
	if (cobre > 1.5) {
		// ruído = a fumaça do próprio atlas (casa 9), deslocada por partícula
		vec2 nu = fract(luv * 0.6 + semente * 0.4 + vec2(0.2)) ;
		float n = texture(atlas, (nu * 0.9 + 0.05 + vec2(1.0, 2.0)) * 0.25).a;
		float d = a * (0.45 + 0.75 * n);
		float th = 0.08 + vida * 0.7;
		float aa = fwidth(d) * 1.2 + 0.004;
		float corpo = smoothstep(th - aa, th + aa, d);
		if (corpo <= 0.001) discard;
		float meio = smoothstep(th + 0.14 - aa, th + 0.14 + aa, d);
		float miolo = smoothstep(th + 0.42 - aa, th + 0.42 + aa, d);
		// 3 faixas chapadas: borda escura e mais avermelhada, meio = a cor, miolo amarelo-claro
		float sat = max(COLOR.r, max(COLOR.g, COLOR.b)) - min(COLOR.r, min(COLOR.g, COLOR.b));
		vec3 borda = COLOR.rgb * mix(vec3(0.55), vec3(0.62, 0.3, 0.28), clamp(sat * 2.0, 0.0, 1.0)); // fumaça cinza fica cinza
		vec3 cor = mix(borda, COLOR.rgb, meio);
		cor = mix(cor, mix(COLOR.rgb, vec3(1.0, 0.9, 0.45), 0.7), miolo) * 1.15;
		float k = corpo * clamp(COLOR.a * 3.0, 0.0, 1.0);
		%s
	} else {
		float k = clamp(COLOR.a * a * brilho, 0.0, 1.0);
		%s
	}
}
"""
# lote de luz: alfa pré-multiplicado ("cobre" 0 = só soma luz; 1 = tampa o fundo)
const FRAG_LUZ := ["ALBEDO = cor * k; ALPHA = k;", "ALBEDO = COLOR.rgb * (1.0 + a * a * 0.6) * k; ALPHA = k * cobre;"]
const FRAG_NUV := ["ALBEDO = cor; ALPHA = k * 0.92;", "ALBEDO = COLOR.rgb; ALPHA = k;"]

# selo: um quadro do atlas num quadrado deitado (runa do chão, portal no céu, chão queimado)
# ponta de gelo: facetada (normal de cada face), 3 tons chapados de azul e borda clara, como gelo pintado
const SH_ESPINHO := """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_opaque, cull_back, shadows_disabled;
uniform float op = 1.0;
varying float altura;
void vertex() { altura = clamp(VERTEX.y + 0.5, 0.0, 1.0); } // 0 na base, 1 na ponta (cone de 1 m)
void fragment() {
	vec3 nv = normalize(cross(dFdx(VERTEX), dFdy(VERTEX)));
	vec3 nw = (INV_VIEW_MATRIX * vec4(nv, 0.0)).xyz;
	float l = dot(nw, normalize(vec3(0.35, 0.8, 0.45)));
	vec3 c = l > 0.45 ? vec3(0.80, 0.95, 1.0) : l > 0.0 ? vec3(0.42, 0.76, 0.97) : vec3(0.16, 0.42, 0.80);
	float f = 1.0 - clamp(abs(dot(nv, normalize(-VERTEX))), 0.0, 1.0);
	c = mix(c, vec3(0.95, 1.0, 1.0), smoothstep(0.55, 0.7, f) * 0.7);
	c *= mix(0.7, 1.0, altura); // base ~30% mais escura e funda, ponta clara (direção de arte 2026-11-03)
	ALBEDO = c;
	ALPHA = 0.9 * op;
}
"""

const SH_SELO := """
shader_type spatial;
render_mode unshaded, %s, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
uniform sampler2D atlas : source_color, filter_linear_mipmap, repeat_disable;
uniform vec4 cor = vec4(1.0);
uniform float op = 1.0;
uniform float cel = 7.0;
uniform float cobre = 0.4;
void fragment() {
	vec2 uv = (UV + vec2(mod(cel, 4.0), floor(cel / 4.0))) * 0.25;
	float a = clamp(texture(atlas, uv).a * op, 0.0, 1.0);
	%s
}
"""

class Lote:
	var n: int
	var mm: MultiMesh
	var P := PackedFloat32Array()
	var buf := PackedFloat32Array()
	const S := 26 # números por partícula
	const B := 20 # números por instância no buffer (12 posição + 4 cor + 4 extra)

var LUZ: Lote # soma luz (fogo, faísca, brilho)
var NUV: Lote # por cima (fumaça, terra, névoa de gelo)
var _tex: Texture2D
var _cam_r := Vector3.RIGHT
var _cam_u := Vector3.UP

func _ready() -> void:
	# mipmaps feitos aqui (o .import do Godot não sabe que a textura vai para 3D): partícula longe não pisca
	var img: Image = load(ATLAS).get_image()
	img.decompress()
	img.generate_mipmaps()
	_tex = ImageTexture.create_from_image(img)
	LUZ = _lote(700, true)
	NUV = _lote(420, false)
	var q := CylinderMesh.new() # ponta de gelo: cone de 5 faces (cristal facetado)
	q.top_radius = 0.0
	q.bottom_radius = 1.0
	q.height = 1.0
	q.radial_segments = 6
	q.rings = 1
	q.cap_top = false
	_espinho = q

func _lote(n: int, soma: bool) -> Lote:
	var L := Lote.new()
	L.n = n
	var q := QuadMesh.new()
	q.size = Vector2(1, 1)
	var m := ShaderMaterial.new()
	var s := Shader.new()
	var fr: Array = FRAG_LUZ if soma else FRAG_NUV
	s.code = SH % ["blend_premul_alpha" if soma else "blend_mix", fr[0], fr[1]]
	m.shader = s
	m.set_shader_parameter("atlas", _tex)
	m.set_shader_parameter("brilho", BRILHO if soma else 1.0)
	q.material = m
	L.mm = MultiMesh.new()
	L.mm.transform_format = MultiMesh.TRANSFORM_3D
	L.mm.use_colors = true
	L.mm.use_custom_data = true
	L.mm.mesh = q
	L.mm.instance_count = n
	L.mm.visible_instance_count = 0
	var no := MultiMeshInstance3D.new()
	no.multimesh = L.mm
	no.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	no.extra_cull_margin = 16384.0
	no.sorting_offset = 1.5 if soma else 0.5
	add_child(no)
	L.buf.resize(n * Lote.B)
	return L

static var _cores := {}
static func _c(hex) -> Color:
	if hex is Color:
		return hex
	var k = _cores.get(hex)
	if k == null:
		k = Color(hex)
		_cores[hex] = k
	return k

# uma partícula. cel = casa do atlas; giro = rad/s; estica = quanto ela alonga na direção do voo (faísca, rastro);
# plano = deitada no chão; entra = parte da vida em que ela acende (0 = já nasce acesa)
func p(L: Lote, pos: Vector3, vel: Vector3, vida: float, s0: float, s1: float, c0, c1, a: float, cel: int,
		grav := 0.0, arrasto := 0.0, giro := 0.0, estica := 0.0, plano := false, entra := 0.1, rot := -1.0, cb := -1.0) -> void:
	# cheio: a mais velha sai no próximo passo (_passo_lote), uma vez por quadro (conselho de auditoria 2026-11-13)
	var k0 := _c(c0)
	var k1 := _c(c1)
	L.P.append_array(PackedFloat32Array([pos.x, pos.y, pos.z, vel.x, vel.y, vel.z, 0.0, vida, s0, s1,
		k0.r, k0.g, k0.b, k1.r, k1.g, k1.b, a, grav, arrasto, float(cel), randf() * TAU if rot < 0.0 else rot, giro, estica,
		1.0 if plano else 0.0, entra, cb if cb >= 0.0 else COBRE.get(cel, 0.0)]))

func _passo_lote(L: Lote, dt: float) -> void:
	var S := Lote.S
	var total := L.P.size() / S
	var primeiro: int = maxi(0, total - L.n) # passou do lote: as mais velhas saem
	if total == 0:
		if L.mm.visible_instance_count != 0:
			L.mm.visible_instance_count = 0
		return
	var P := L.P
	L.P = PackedFloat32Array()
	var buf := L.buf
	L.buf = PackedFloat32Array()
	var vivo := 0
	var cr := _cam_r
	var cu := _cam_u
	for i in range(primeiro, total):
		var o := i * S
		var t := P[o + 6] + dt
		var vida := P[o + 7]
		if t >= vida:
			continue
		var k: float = max(0.0, 1.0 - P[o + 18] * dt)
		var vx := P[o + 3] * k
		var vy := P[o + 4] * k + P[o + 17] * dt
		var vz := P[o + 5] * k
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
		var en := P[d + 24]
		var f := 1.0
		if en > 0.0 and u < en:
			f = u / en
		else:
			f = 1.0 - (u - en) / (1.0 - en)
			f = f * (2.0 - f) # apaga devagar no começo e rápido no fim
		var s := P[d + 8] + (P[d + 9] - P[d + 8]) * u
		var sx := s
		var rot := P[d + 20] + P[d + 21] * t
		var est := P[d + 22]
		if est > 0.0: # alonga na direção do voo, como vista pela câmera
			var px := vx * cr.x + vy * cr.y + vz * cr.z
			var py := vx * cu.x + vy * cu.y + vz * cu.z
			var vel := sqrt(px * px + py * py)
			if vel > 0.01:
				rot = atan2(py, px)
				sx = s + vel * est
		var b := vivo * Lote.B
		buf[b] = sx
		buf[b + 1] = 0.0
		buf[b + 2] = 0.0
		buf[b + 3] = x
		buf[b + 4] = 0.0
		buf[b + 5] = s
		buf[b + 6] = 0.0
		buf[b + 7] = y
		buf[b + 8] = 0.0
		buf[b + 9] = 0.0
		buf[b + 10] = 1.0
		buf[b + 11] = z
		buf[b + 12] = P[d + 10] + (P[d + 13] - P[d + 10]) * u
		buf[b + 13] = P[d + 11] + (P[d + 14] - P[d + 11]) * u
		buf[b + 14] = P[d + 12] + (P[d + 15] - P[d + 12]) * u
		buf[b + 15] = P[d + 16] * f
		buf[b + 16] = P[d + 19]
		buf[b + 17] = rot
		buf[b + 18] = P[d + 25]
		buf[b + 19] = P[d + 23] * 2.0 + min(u, 0.999)
		vivo += 1
	P.resize(vivo * S)
	L.P = P
	L.buf = buf
	L.mm.buffer = buf
	L.mm.visible_instance_count = vivo

# ---------------------------------------------------------------- peças que ficam (selos, pontas de gelo)
var _espinho: Mesh
var selos: Array = [] # {m, t, dur, entra, sai, op, gira, cresce, s0, s1, segue}
func selo(pos: Vector3, cel: int, cor, tam: float, dur: float, soma := true, op := 1.0, gira := 0.0, entra := 0.15, sai := 0.3, s1 := -1.0, deitado := true) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(2, 2)
	mi.mesh = q
	var m := ShaderMaterial.new()
	m.shader = fx.shader("selo_" + ("soma" if soma else "mix"), SH_SELO % (["blend_premul_alpha", "ALBEDO = cor.rgb * (1.0 + a * a * 0.5) * a; ALPHA = a * cobre;"] if soma else ["blend_mix", "ALBEDO = cor.rgb; ALPHA = a;"]))
	m.set_shader_parameter("atlas", _tex)
	m.set_shader_parameter("cor", _c(cor))
	m.set_shader_parameter("cel", float(cel))
	m.set_shader_parameter("op", 0.0)
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mi.position = pos
	if deitado:
		mi.rotation.x = -PI / 2
	mi.scale = Vector3.ONE * tam
	selos.append({"m": mi, "t": 0.0, "dur": dur, "entra": entra, "sai": sai, "op": op, "gira": gira, "s0": tam, "s1": tam if s1 < 0.0 else s1, "deitado": deitado})
	return mi

# ---------------------------------------------------------------- conjurar (concentrando a magia)
var cargas: Array = []
func conjura(corpo: Node3D, k: String, dur: float, maos: Callable) -> void:
	var voz = null
	if fx.CARGA.has(k):
		voz = fx._som_voz(fx.CARGA[k][0], corpo.global_position, -3.0, 0.02, fx.CARGA[k][1])
	var cores: Array = fx.cor_de(k)
	var pe := corpo.global_position + Vector3(0, 0.06, 0)
	var r := 1.25
	var runa := selo(pe, C_RUNA, cores[1], r, dur + 0.25, true, 0.85, 1.4 if k != "gelo" else -1.1, 0.2, 0.25)
	var disco := selo(pe + Vector3(0, 0.01, 0), C_DISCO, cores[1], r * 1.1, dur + 0.25, true, 0.35, 0.0, 0.25, 0.25)
	cargas.append({"corpo": corpo, "k": k, "t": 0.0, "dur": dur, "maos": maos, "vivo": true, "voz": voz, "voz_som": voz.stream if voz else null,
		"runa": runa, "disco": disco, "cb": cores[0], "cc": cores[1], "luz": fx.luz(cores[1], 1.0, 5.0, dur + 0.2, corpo)})
	# um sopro de poeira/geada no chão quando começa
	for i in 10:
		var a := randf() * TAU
		var v := Vector3(cos(a), 0, sin(a))
		p(NUV, pe + v * 0.4 + Vector3(0, 0.15, 0), v * randf_range(1.5, 2.5) + Vector3(0, 0.3, 0), randf_range(0.7, 1.0), 0.5, 1.4,
			"dfe8f0" if k == "gelo" else "b8a89a", "8a8496", 0.35, C_FUMACA if i % 2 else C_FUMACA2, 0.0, 2.0, randf_range(-1, 1))

func cancelar(corpo: Node3D) -> void:
	for c in cargas:
		if c.corpo == corpo and c.vivo:
			c.dur = c.t

func _passo_cargas(dt: float) -> void:
	var i := cargas.size() - 1
	while i >= 0:
		var c: Dictionary = cargas[i]
		c.t += dt
		var ok := is_instance_valid(c.corpo)
		if c.t >= c.dur or not ok:
			if c.voz != null and fx.mundo and fx.mundo.sons:
				fx.mundo.sons.parar(c.voz, c.voz_som)
			for s in [c.runa, c.disco]:
				for q in selos:
					if q.m == s:
						q.dur = min(q.dur, q.t + q.sai)
			cargas.remove_at(i)
			i -= 1
			continue
		var pe: Vector3 = c.corpo.global_position + Vector3(0, 0.06, 0)
		c.runa.position = pe
		c.disco.position = pe + Vector3(0, 0.01, 0)
		var u: float = c.t / c.dur
		var maos: Array = c.maos.call() if c.maos.is_valid() else [pe + Vector3(0, 1.2, 0)]
		var cb = c.cb
		var cc = c.cc
		match c.k:
			"bola": # orbe de fogo crescendo entre as mãos, faíscas sendo puxadas para ele
				var m: Vector3 = maos[0]
				if maos.size() > 1:
					m = (maos[0] + maos[1]) * 0.5
				var tam: float = 0.15 + 0.4 * u
				p(LUZ, m, Vector3.ZERO, 0.07, tam * 2.4, tam * 2.2, "ffd27a", cc, 0.5, C_LUZ, 0, 0, 0, 0, false, 0.0)
				fogo(LUZ, m, Vector3.ZERO, 0.08, tam * 1.5, tam * 1.4, "ff9a20", F_QUENTE, C_FUMACA, 0.0, 0.0, 6.0)
				p(LUZ, m, Vector3.ZERO, 0.07, tam * 1.0, tam * 0.9, "fff6d0", "ffb44a", 0.9, C_FLARE, 0, 0, 0, 0, false, 0.0, c.t * 3.0)
				if randf() < dt * 30.0:
					fogo(LUZ, m, Vector3(randf_range(-0.4, 0.4), randf_range(0.6, 1.4), randf_range(-0.4, 0.4)), 0.3, tam * 0.9, tam * 0.3, F_QUENTE, F_FRIO, C_FUMACA2, 0.0, 1.0)
				for n in 2:
					if randf() < dt * 22.0:
						var dir := Vector3(randf_range(-1, 1), randf_range(-0.6, 1), randf_range(-1, 1)).normalized()
						var dd := randf_range(0.9, 1.5)
						var vida := randf_range(0.25, 0.35)
						p(LUZ, m + dir * dd, -dir * dd / vida, vida, 0.05, 0.12, "fff2b0", "ff8a3a", 1.0, C_TRACO, 0.0, 0.0, 0.0, 0.03, false, 0.3)
			"gelo": # flocos subindo em espiral em volta do corpo, geada no chão, brilho frio nas mãos
				for m in maos:
					p(LUZ, m, Vector3.ZERO, 0.06, 0.45, 0.4, "eafcff", "3fb4ff", 0.55, C_LUZ, 0, 0, 0, 0, false, 0.0)
					if randf() < dt * 12.0:
						p(LUZ, m, Vector3(randf_range(-0.2, 0.2), randf_range(0.1, 0.5), randf_range(-0.2, 0.2)), 0.35, 0.22, 0.05, "ffffff", "8fd8ff", 1.0, C_ESTRELA, 0.0, 1.0, randf_range(-4, 4))
				for n in 2:
					if randf() < dt * 16.0:
						var a := randf() * TAU
						var rr := randf_range(0.6, 1.3)
						var o := pe + Vector3(cos(a) * rr, randf_range(0.0, 0.4), sin(a) * rr)
						p(LUZ, o, Vector3(-sin(a) * 1.6, randf_range(1.2, 2.4), cos(a) * 1.6), randf_range(0.6, 0.9), 0.12, 0.03, "ffffff", "6fc8ff", 0.9, C_ESTRELA2 if randf() < 0.5 else C_ESTRELA, 0.0, 0.5, randf_range(-3, 3))
				if randf() < dt * 6.0:
					var a := randf() * TAU
					p(NUV, pe + Vector3(cos(a) * 1.0, 0.15, sin(a) * 1.0), Vector3(cos(a) * 0.4, 0.15, sin(a) * 0.4), 1.0, 0.6, 1.1, "e8f6ff", "bfe2f5", 0.3, C_FUMACA, 0.0, 0.5, randf_range(-0.5, 0.5))
			_: # Meteoro: brasas subindo das mãos levantadas
				for m in maos:
					p(LUZ, m, Vector3.ZERO, 0.06, 0.5, 0.45, "ffd27a", cc, 0.5, C_LUZ, 0, 0, 0, 0, false, 0.0)
					if randf() < dt * 14.0:
						p(LUZ, m, Vector3(randf_range(-0.3, 0.3), randf_range(1.5, 3.0), randf_range(-0.3, 0.3)), 0.4, 0.3, 0.08, "ffe08a", "ff4a0a", 0.9, C_CHAMA2, 0.0, 0.5, randf_range(-3, 3))
				if randf() < dt * 10.0:
					var a := randf() * TAU
					p(LUZ, pe + Vector3(cos(a) * 1.1, 0.05, sin(a) * 1.1), Vector3(0, randf_range(2.0, 4.0), 0), 0.6, 0.06, 0.02, "fff2b0", "ff5a12", 1.0, C_TRACO, -1.0, 0.0, 0.0, 0.04)
		i -= 1

# ---------------------------------------------------------------- fogo pintado
# um floco de fogo/fumaça TOON: forma de borda dura, miolo claro, borda escura, comido pelo ruído no fim da vida
func fogo(L: Lote, pos: Vector3, vel: Vector3, vida: float, s0: float, s1: float, c0, c1, cel := C_FUMACA2, grav := 0.0, arrasto := 1.5, giro := 0.0) -> void:
	p(L, pos, vel, vida, s0, s1, c0, c1, 1.0, cel, grav, arrasto, giro if giro != 0.0 else randf_range(-1.5, 1.5), 0.0, false, 0.0, -1.0, TOON)

const F_QUENTE := "ff7414" # fogo: começa amarelo-laranja...
const F_FRIO := "d0240a" # ...e esfria para vermelho
const F_FUMACA := "4e4446"
const F_FUMACA2 := "2e2729"

# ---------------------------------------------------------------- projéteis (Faísca e Bola de Fogo)
# saída da mão: clarão, labareda curta para a frente e faíscas
func lanca(de: Vector3, dir: Vector3, grande: bool) -> void:
	var k := 1.7 if grande else 1.0
	p(LUZ, de, Vector3.ZERO, 0.1, 0.5 * k, 1.2 * k, "fff6d0", "ffa21a", 0.9, C_FLARE, 0, 0, 0, 0, false, 0.0)
	for i in int(3 * k):
		fogo(LUZ, de + dir * 0.15, dir * randf_range(2.0, 4.0) + Vector3(randf_range(-0.6, 0.6), randf_range(0, 0.8), randf_range(-0.6, 0.6)), randf_range(0.16, 0.24),
			0.28 * k, 0.12 * k, F_QUENTE, F_FRIO, C_FUMACA2, 0.0, 5.0)
	for i in int(7 * k):
		var v := (dir + Vector3(randf_range(-0.5, 0.5), randf_range(-0.3, 0.5), randf_range(-0.5, 0.5))).normalized() * randf_range(4.0, 9.0)
		p(LUZ, de, v, randf_range(0.15, 0.3), 0.05, 0.02, "fff6d0", "ff8a3a", 1.0, C_TRACO, -4.0, 2.0, 0.0, 0.035)

# um quadro do voo: núcleo claro, flocos de fogo pintado ficando para trás (a cauda), faíscas e (na grande) fumaça
func voo(o: Vector3, dir: Vector3, vel: float, tam: float, grande: bool, t: float, dt: float) -> void:
	var tr := -dir * vel
	p(LUZ, o, Vector3.ZERO, 0.05, tam * 2.6, tam * 2.6, "ffc06a", "ff6a1a", 0.45, C_LUZ, 0, 0, 0, 0, false, 0.0)
	# cabeça: 2 flocos grandes girando no lugar (a bola tem volume, não é um ponto)
	fogo(LUZ, o + dir * tam * 0.3, tr * 0.02, 0.07, tam * 3.2, tam * 2.8, "ff9a20", F_QUENTE, C_FUMACA, 0.0, 0.0, 9.0)
	p(LUZ, o + dir * tam * 0.4, Vector3.ZERO, 0.05, tam * 1.3, tam * 1.3, "fffaf0", "ffe2a0", 0.9, C_FLARE, 0, 0, 0, 0, false, 0.0, t * 9.0)
	# risco de luz atrás (~1,2 m na Faísca; direção de arte 2026-11-03: a bolinha sumia no verde)
	p(LUZ, o - dir * tam * 0.5, tr * 0.3, 0.06, tam * 1.2, tam * 0.9, "ffe9a0", "ff7a1a", 0.85, C_TRACO, 0, 0, 0, 0.17)
	# cauda: flocos nascem ao longo do caminho deste quadro e ficam para trás encolhendo
	var n := 4 if grande else 3
	for i in n:
		var j := Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)) * tam * 0.3
		fogo(LUZ, o + j + tr * dt * (float(i) / n), tr * 0.04 + Vector3(0, randf_range(0.3, 1.2), 0), randf_range(0.2, 0.32) * (1.35 if grande else 1.0),
			tam * randf_range(2.6, 3.2), tam * 0.6, F_QUENTE, F_FRIO, C_FUMACA2 if i % 2 else C_FUMACA, 0.0, 2.0)
	if randf() < 0.7:
		p(LUZ, o, tr * 0.05 + Vector3(randf_range(-1.5, 1.5), randf_range(-0.5, 2.0), randf_range(-1.5, 1.5)), randf_range(0.3, 0.5), 0.06, 0.02, "fff2b0", "ff5a12", 1.0, C_TRACO, -6.0, 1.0, 0.0, 0.03)
	if grande and randf() < 0.6:
		fogo(NUV, o - dir * tam * 1.5, Vector3(0, randf_range(0.4, 0.9), 0), randf_range(0.5, 0.8), tam * 1.2, tam * 2.4, F_FUMACA, F_FUMACA2, C_FUMACA, 0.0, 1.0)

# Faísca acertou: estouro de fogo pintado, clarão e faíscas espirrando
func impacto(o: Vector3, dir: Vector3) -> void:
	p(LUZ, o, Vector3.ZERO, 0.12, 0.6, 1.4, "fffaf0", "ffb44a", 0.9, C_FLARE, 0, 0, 0, 0, false, 0.0)
	for i in 6:
		var v := (Vector3(randf_range(-1, 1), randf_range(-0.2, 1), randf_range(-1, 1)).normalized() - dir * 0.5) * randf_range(1.5, 3.0)
		fogo(LUZ, o, v, randf_range(0.3, 0.42), 0.6, 1.2, F_QUENTE, F_FRIO, C_FUMACA if i % 2 else C_FUMACA2, 0.0, 6.0)
	for i in 12:
		var v := (-dir * 0.4 + Vector3(randf_range(-1, 1), randf_range(-0.3, 1.0), randf_range(-1, 1))).normalized() * randf_range(4.0, 9.0)
		p(LUZ, o, v, randf_range(0.2, 0.4), 0.06, 0.02, "fff6d0", "ff8a3a", 1.0, C_TRACO, -9.0, 2.0, 0.0, 0.035)
	fogo(NUV, o + Vector3(0, 0.2, 0), Vector3(0, 0.9, 0), 0.6, 0.35, 0.8, F_FUMACA, F_FUMACA2, C_FUMACA, 0.0, 1.5)
	fx.luz("ff8a3a", 2.2, 4.0, 0.18).l.global_position = o

# Bola de Fogo explodiu: clarão, bola de fogo pintada que incha e esfria em fumaça, onda no chão, terra, brasas e chão queimado
func explosao(o: Vector3, r: float, chao: float) -> void:
	var g := Vector3(o.x, chao + 0.05, o.z)
	var c := Vector3(o.x, max(o.y, chao + r * 0.35), o.z) # o centro não afunda no chão
	p(LUZ, c, Vector3.ZERO, 0.14, r * 0.6, r * 1.8, "fffaf0", "ffb44a", 1.0, C_FLARE, 0, 0, 0, 0, false, 0.0)
	for i in 16: # bola de fogo: flocos que saem do centro e freiam (incham), depois sobem
		var v := Vector3(randf_range(-1, 1), randf_range(-0.25, 1), randf_range(-1, 1)).normalized() * randf_range(2.0, 4.5) * r / 2.2
		fogo(LUZ, c + v * 0.05, v, randf_range(0.55, 0.8), r * 0.55, r * randf_range(1.0, 1.3), "ff8a18" if i < 6 else F_QUENTE, F_FRIO,
			C_FUMACA if i % 2 else C_FUMACA2, 2.5, 4.0)
	for i in 10: # fumaça que fica onde o fogo estava e sobe
		var v := Vector3(randf_range(-1, 1), randf_range(0, 1), randf_range(-1, 1)).normalized() * randf_range(1.0, 2.5)
		agenda_fumaca.append({"t": 0.25 + randf() * 0.15, "pos": c + v * 0.5, "vel": v * 0.6 + Vector3(0, 1.6, 0), "s0": r * 0.7, "s1": r * 1.4})
	selo(g, C_DISCO, "ff8a3a", r * 0.25, 0.35, true, 0.7, 0.0, 0.0, 0.25, r * 1.3)
	for i in 8: # terra/pedrinhas
		var a := randf() * TAU
		var v := randf_range(3.0, 6.0)
		p(NUV, g + Vector3(0, 0.3, 0), Vector3(cos(a) * v, randf_range(3.0, 6.0), sin(a) * v), randf_range(0.6, 0.9), 0.16, 0.12, "3a2c24", "2a201c", 0.9, C_TERRA, -14.0, 0.2, randf_range(-6, 6))
	for i in 22: # brasas
		var a := randf() * TAU
		var v := randf_range(5.0, 11.0)
		p(LUZ, c, Vector3(cos(a) * v * 0.8, randf_range(2.0, 9.0), sin(a) * v * 0.8), randf_range(0.5, 1.0), 0.07, 0.03, "fff6d0", "ff6a1a", 1.0, C_TRACO, -12.0, 0.6, 0.0, 0.03)
	selo(g + Vector3(0, -0.02, 0), C_QUEIMADO, "1a120e", r * 0.7, 5.0, false, 0.85, 0.0, 0.05, 1.5)
	fx.luz("ff7a2a", 4.5, r * 4.0, 0.45).l.global_position = c + Vector3(0, 0.8, 0)
	_tremer(c, 0.35, 16.0)

var agenda_fumaca: Array = []

# ---------------------------------------------------------------- Nova de Gelo
# anel de pontas de gelo saindo do chão em onda, de dentro para fora, geada correndo e névoa fria; depois as pontas
# quebram em cacos e afundam. O congelado dos monstros continua o de efeitos.gd (_congelar).
var gelos: Array = [] # {no, mm, pontas, lascas, t, dur}
const GELO_ANEL := 4.5 # m: raio do anel de cristais (direção de arte, 2026-11-03)
const GELO_QUEBRA := 0.6 # s de pé antes de quebrar
const LASCAS := 5 # lascas por cristal
func nova_gelo(x: float, z: float, r: float, y: float, alt: Callable) -> void:
	var c0 := Vector3(x, y, z)
	fx._som("q_gelo", c0, 1.0, 0.04)
	# 8 grupos de 2 ou 3 cristais num anel em volta dela: o maior no meio do grupo, inclinados 15-30° para fora
	var pontas := []
	var anel: float = min(GELO_ANEL, r * 0.8)
	var grupos := 8
	for g_i in grupos:
		var a0 := (g_i + randf_range(-0.2, 0.2)) / grupos * TAU
		var n := 2 if g_i % 3 == 1 else 3
		for k in n:
			var meio := k == 0
			var a := a0 + (0.0 if meio else randf_range(-0.11, 0.11))
			var d := anel + (0.0 if meio else randf_range(-0.45, 0.45))
			var px := x + cos(a) * d + (0.0 if meio else randf_range(-0.2, 0.2))
			var pz := z + sin(a) * d + (0.0 if meio else randf_range(-0.2, 0.2))
			var h: float = randf_range(1.15, 1.4) if meio else randf_range(0.5, 0.85)
			var inc := deg_to_rad(randf_range(15.0, 30.0))
			pontas.append({"x": px, "z": pz, "y": float(alt.call(px, pz)), "alt": h, "larg": h * randf_range(0.3, 0.38), "ry": randf() * TAU,
				"incx": cos(a) * inc, "incz": sin(a) * inc, "ini": 0.04 + randf() * 0.08 + (0.0 if meio else 0.04)})
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = _espinho
	mm.instance_count = pontas.size() * (1 + LASCAS)
	var no := MultiMeshInstance3D.new()
	no.multimesh = mm
	no.material_override = fx.material("espinho_gelo", SH_ESPINHO, {"op": 1.0})
	no.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	no.extra_cull_margin = 16384.0
	add_child(no)
	var zero := Transform3D(Basis.from_scale(Vector3(0.001, 0.001, 0.001)), c0)
	for i in mm.instance_count:
		mm.set_instance_transform(i, zero)
	gelos.append({"no": no, "mm": mm, "pontas": pontas, "lascas": [], "t": 0.0, "dur": GELO_QUEBRA + 0.9})
	# chão: geada fraca (alpha 0,35) com borda em flocos e a runa de gelo; onda clara curta correndo até o anel
	selo(c0 + Vector3(0, 0.06, 0), C_FUMACA2, "cfeeff", anel * 0.5, 1.6, true, 0.35, 0.3, 0.05, 0.6, anel * 1.15)
	selo(c0 + Vector3(0, 0.07, 0), C_RUNA, "bfe8ff", anel * 0.4, 1.0, true, 0.4, -2.0, 0.0, 0.5, anel * 0.85)
	selo(c0 + Vector3(0, 0.08, 0), C_GIRO, "e8f8ff", anel * 0.2, 0.4, true, 0.35, 4.0, 0.0, 0.25, anel * 1.2)
	p(LUZ, c0 + Vector3(0, 1.0, 0), Vector3.ZERO, 0.14, 0.8, 2.6, "ffffff", "8fd8ff", 0.6, C_FLARE, 0, 0, 0, 0, false, 0.0)
	# névoa fria pintada correndo para fora, rente ao chão, até o anel
	for i in 14:
		var a := i / 14.0 * TAU + randf_range(-0.2, 0.2)
		var v := randf_range(5.0, 7.0) * anel / 4.5
		fogo(NUV, c0 + Vector3(cos(a) * 0.6, 0.25, sin(a) * 0.6), Vector3(cos(a) * v, 0.25, sin(a) * v), randf_range(0.7, 0.9), 0.4, 1.0,
			"e8f6ff", "a8d4f0", C_FUMACA if i % 2 else C_FUMACA2, 0.0, 3.2)
	fx.luz("8fd8ff", 3.0, r * 2.5, 0.5).l.global_position = c0 + Vector3(0, 1.2, 0)
	_tremer(c0, 0.3, 14.0)

func _passo_gelos(dt: float) -> void:
	var i := gelos.size() - 1
	while i >= 0:
		var g: Dictionary = gelos[i]
		g.t += dt
		var t: float = g.t
		if t >= g.dur:
			g.no.queue_free()
			gelos.remove_at(i)
			i -= 1
			continue
		var np: int = g.pontas.size()
		for j in np:
			var pt: Dictionary = g.pontas[j]
			var u: float = clamp((t - pt.ini) / 0.1, 0.0, 1.0)
			if u <= 0.0:
				continue
			if not pt.has("saiu"):
				pt.saiu = true
				var o := Vector3(pt.x, pt.y + 0.1, pt.z)
				p(NUV, o, Vector3(pt.incx * 2.0, 0.8, pt.incz * 2.0), 0.5, 0.25, 0.6, "f2fbff", "cfe8f5", 0.5, C_FUMACA2, 0.0, 2.0, randf_range(-1, 1))
			var b := Basis.from_euler(Vector3(pt.incz, 0, -pt.incx)) * Basis(Vector3.UP, pt.ry)
			if t < GELO_QUEBRA + pt.ini:
				var cresce: float = 1.0 + 0.2 * sin(u * PI) if u < 1.0 else 1.0 # passa um pouco e volta (salta do chão)
				var h: float = pt.alt * u * cresce
				var w: float = pt.larg * (0.6 + 0.4 * u)
				var bs := b.scaled(Vector3(w, max(0.001, h), w))
				g.mm.set_instance_transform(j, Transform3D(bs, Vector3(pt.x, pt.y - 0.1, pt.z) + bs.y * 0.5))
			elif not pt.has("quebrou"): # quebra em lascas que caem e somem
				pt.quebrou = true
				g.mm.set_instance_transform(j, Transform3D(Basis.from_scale(Vector3(0.001, 0.001, 0.001)), Vector3(pt.x, pt.y, pt.z)))
				var cima: Vector3 = b.y
				for k in LASCAS:
					var o: Vector3 = Vector3(pt.x, pt.y, pt.z) + cima * pt.alt * randf_range(0.15, 0.85)
					var v: Vector3 = Vector3(randf_range(-1, 1), randf_range(0.5, 1.5), randf_range(-1, 1)) * randf_range(1.2, 2.6) + cima * 0.8
					g.lascas.append({"i": np + j * LASCAS + k, "o": o, "v": v, "t": 0.0, "tam": pt.larg * randf_range(0.35, 0.6), "alt": pt.alt * randf_range(0.18, 0.3),
						"giro": Vector3(randf_range(-9, 9), randf_range(-9, 9), randf_range(-9, 9)), "rot": Basis.from_euler(Vector3(randf() * TAU, randf() * TAU, randf() * TAU))})
				p(LUZ, Vector3(pt.x, pt.y + pt.alt * 0.5, pt.z), Vector3.ZERO, 0.12, 0.3, 0.8, "ffffff", "8fd8ff", 0.6, C_FLARE, 0, 0, 0, 0, false, 0.0)
				if j == 0:
					fx._som("q_gelo", Vector3(pt.x, pt.y, pt.z), -6.0, 0.12)
		for l in g.lascas:
			if l.t >= 0.3:
				continue
			l.t += dt
			l.v.y -= 14.0 * dt
			l.o += l.v * dt
			l.rot = l.rot * Basis.from_euler(l.giro * dt)
			var k: float = max(0.001, 1.0 - l.t / 0.3)
			g.mm.set_instance_transform(l.i, Transform3D(l.rot * Basis.from_scale(Vector3(l.tam, l.alt, l.tam) * k), l.o))
		i -= 1

# ---------------------------------------------------------------- Meteoro: portal no céu e fogo com textura
var portais: Array = []
func portal(alvo: Vector3, de: Vector3, dur: float) -> void:
	for q in portais: # já tem um aberto ali (o do herói abre no começo da concentração)
		if q.alvo.distance_to(alvo) < 2.0 and q.t < q.dur:
			q.dur = max(q.dur, q.t + dur)
			return
	var pos := alvo + (de - alvo) * 0.62
	var g := Node3D.new()
	add_child(g)
	g.position = pos
	g.look_at(alvo, Vector3.UP if abs((alvo - pos).normalized().y) < 0.99 else Vector3.RIGHT)
	var ps := []
	for k in 3:
		var mi := MeshInstance3D.new()
		var q := QuadMesh.new()
		q.size = Vector2(2, 2)
		mi.mesh = q
		var m := ShaderMaterial.new()
		m.shader = fx.shader("selo_soma", SH_SELO % ["blend_premul_alpha", "ALBEDO = cor.rgb * (1.0 + a * a * 0.5) * a; ALPHA = a * cobre;"])
		m.set_shader_parameter("atlas", _tex)
		m.set_shader_parameter("cor", _c(["ff8a3a", "c2401a", "ffb44a"][k]))
		m.set_shader_parameter("cel", float([C_RUNA, C_GIRO, C_DISCO][k]))
		m.set_shader_parameter("op", 0.0)
		mi.material_override = m
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.position = Vector3(0, 0, -0.05 * k)
		g.add_child(mi)
		ps.append(mi)
	portais.append({"g": g, "ps": ps, "t": 0.0, "dur": dur, "alvo": alvo, "pos": pos})

func _passo_portais(dt: float) -> void:
	var i := portais.size() - 1
	while i >= 0:
		var q: Dictionary = portais[i]
		q.t += dt
		if q.t >= q.dur + 0.5:
			q.g.queue_free()
			portais.remove_at(i)
			i -= 1
			continue
		var ent: float = 1.0 - pow(1.0 - min(1.0, q.t / 0.6), 3.0)
		var sai: float = clamp((q.dur + 0.5 - q.t) / 0.5, 0.0, 1.0)
		var r: float = 3.6 * ent * (1.0 + 0.3 * (1.0 - sai))
		var op: float = ent * sai
		var rs := [r, r * 0.8, r * 0.55]
		var ops := [0.75, 0.6, 0.55]
		var gs := [0.7, -2.2, 0.0]
		for k in 3:
			var mi: MeshInstance3D = q.ps[k]
			mi.scale = Vector3.ONE * rs[k]
			mi.rotation.z = q.t * gs[k]
			mi.material_override.set_shader_parameter("op", ops[k] * op)
		if sai >= 1.0 and randf() < dt * 30.0: # brasas caindo do portal
			var a := randf() * TAU
			var d := randf() * r * 0.7
			var o: Vector3 = q.g.global_transform * Vector3(cos(a) * d, sin(a) * d, 0)
			p(LUZ, o, (q.alvo - o).normalized() * randf_range(2.0, 5.0), randf_range(0.5, 0.9), 0.12, 0.04, "fff2b0", "ff5a12", 1.0, C_TRACO, -2.0, 0.0, 0.0, 0.03)
		i -= 1

# a rocha caindo: flocos de fogo pintado saindo da aura e fumaça grossa atrás
func meteoro_voo(o: Vector3, dir: Vector3, raio: float) -> void:
	for i in 2:
		var j := Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)).normalized() * raio * 0.8
		fogo(LUZ, o + j, -dir * randf_range(4.0, 8.0) + j, randf_range(0.3, 0.45), raio * 1.1, raio * 0.4, F_QUENTE, F_FRIO, C_FUMACA if i % 2 else C_FUMACA2, 0.0, 1.0)
	if randf() < 0.7:
		fogo(NUV, o - dir * raio, -dir * 2.0 + Vector3(0, 0.5, 0), randf_range(0.9, 1.3), raio * 0.9, raio * 2.0, F_FUMACA, F_FUMACA2, C_FUMACA, 0.0, 1.2)

# camadas pintadas somadas à explosão do Meteoro (a cúpula, a cratera e as pedras de efeitos.gd continuam)
func meteoro_impacto(o: Vector3, r: float) -> void:
	for i in 8: # bola de fogo que sobe em cogumelo
		var a := randf() * TAU
		var v := Vector3(cos(a) * randf_range(1.0, 3.0), randf_range(3.0, 7.0), sin(a) * randf_range(1.0, 3.0))
		fogo(LUZ, o + Vector3(cos(a), 0.6, sin(a)) * 0.5, v, randf_range(0.7, 1.0), r * 0.22, r * randf_range(0.35, 0.45), "ff8a18" if i < 3 else F_QUENTE, F_FRIO, C_FUMACA2, -1.0, 1.6)
	for i in 14: # anel de fumaça rolando para fora, rente ao chão
		var a := i / 14.0 * TAU
		fogo(NUV, o + Vector3(cos(a) * r * 0.3, 0.5, sin(a) * r * 0.3), Vector3(cos(a) * r * 1.5, 0.6, sin(a) * r * 1.5), randf_range(1.1, 1.5), 1.0, r * 0.5, F_FUMACA, F_FUMACA2, C_FUMACA if i % 2 else C_FUMACA2, 0.0, 2.2)
	for i in 10: # terra
		var a := randf() * TAU
		var v := randf_range(4.0, 9.0)
		p(NUV, o + Vector3(0, 0.4, 0), Vector3(cos(a) * v, randf_range(5.0, 10.0), sin(a) * v), randf_range(0.8, 1.2), 0.28, 0.2, "3a2c24", "2a201c", 0.9, C_TERRA, -16.0, 0.2, randf_range(-6, 6))

func _tremer(o: Vector3, forca: float, alcance: float) -> void:
	var w = fx.mundo
	if w and w.get("heroi") and w.get("cam"):
		var dist: float = w.heroi.global_position.distance_to(o)
		if dist < alcance:
			w.cam.tremer(forca * (1.0 - dist / alcance))

# ---------------------------------------------------------------- quadro
func _process(dt: float) -> void:
	var t0_parte := Time.get_ticks_usec()
	_process_parte(dt)
	Lentidao.parte("magias", t0_parte) # quadro lento: quanto deste script (lentidao.gd)

func _process_parte(dt: float) -> void:
	var cam := get_viewport().get_camera_3d()
	if cam:
		_cam_r = cam.global_transform.basis.x
		_cam_u = cam.global_transform.basis.y
	_passo_cargas(dt)
	var j := agenda_fumaca.size() - 1
	while j >= 0:
		var q: Dictionary = agenda_fumaca[j]
		q.t -= dt
		if q.t <= 0.0:
			fogo(NUV, q.pos, q.vel, randf_range(1.0, 1.5), q.s0, q.s1, F_FUMACA, F_FUMACA2, C_FUMACA if randf() < 0.5 else C_FUMACA2, 0.0, 1.2)
			agenda_fumaca.remove_at(j)
		j -= 1
	_passo_gelos(dt)
	_passo_portais(dt)
	var i := selos.size() - 1
	while i >= 0:
		var s: Dictionary = selos[i]
		s.t += dt
		if s.t >= s.dur or not is_instance_valid(s.m):
			if is_instance_valid(s.m):
				s.m.queue_free()
			selos.remove_at(i)
			i -= 1
			continue
		var u: float = s.t / s.dur
		var f: float = 1.0
		if s.entra > 0.0:
			f = min(f, s.t / s.entra)
		if s.sai > 0.0:
			f = min(f, (s.dur - s.t) / s.sai)
		var e := 1.0 - pow(1.0 - min(1.0, u * 2.5), 3.0) # cresce rápido e assenta
		s.m.scale = Vector3.ONE * lerp(float(s.s0), float(s.s1), e)
		if s.gira != 0.0:
			if s.deitado:
				s.m.rotation.y += s.gira * dt
			else:
				s.m.rotation.z += s.gira * dt
		s.m.material_override.set_shader_parameter("op", s.op * max(0.0, f))
		i -= 1
	_passo_lote(LUZ, dt)
	_passo_lote(NUV, dt)

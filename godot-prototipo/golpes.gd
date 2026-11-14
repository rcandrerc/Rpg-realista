extends Node3D
# Skills de espada novas (André 2026-11-12: "o mesmo revamp que fizemos nas skills de mago, agora nas de melee",
# "principalmente o som das skills estão péssimos"). Mesmo caminho do magias.gd (PR #89): formas pintadas de borda
# dura no estilo anime (TOON) no lugar do brilho somado, que no mundo claro virava borrão branco, e um som próprio
# para cada skill (sons/esp_*.ogg, montados por ferramentas/sons/espada.py com gravações CC0).
#   - Corte em meia-lua: fio branco por fora, faixa de aço azul no meio e borda funda por dentro; corre na direção
#     do golpe e depois é comido pelo ruído (Corte Duplo em X, Giro em anel, Golpe Esmagador de cima para baixo).
#   - Chão rachando (Golpe Esmagador e Pisão Sísmico): rachaduras com a força acesa no fundo, pedras lascadas
#     voando, pontas de pedra saindo do chão em onda (Pisão) e poeira pintada rolando.
#   - Acerto: marca do corte no alvo, estrela de brilho e faíscas; Investida: rajada de vento e estocada.
# Leve para o celular: as partículas vão nos dois lotes do magias.gd (nenhuma chamada de desenho a mais), cada corte
# é uma malha só que vive ~0,3 s, o chão rachado é um quadrado e as pedras de cada golpe são uma MultiMesh.
# Para voltar ao visual antigo das skills de espada: efeitos.gd ESPADA_NOVA = false.

var fx # efeitos.gd (sons, luzes, materiais, mundo)
var mg # magias.gd (lotes de partículas com textura)

# cores pintadas: miolo (fio), meio, borda
const ACO := ["ffffff", "9ad8ff", "2c63c4"] # combo, Corte Duplo, Giro, Investida
const OURO := ["fffbe8", "ffd166", "b8541c"] # Golpe Esmagador: a lâmina carregada de força
const TERRA_C := ["d8c29a", "a88658"] # poeira pintada (o miolo claro sai do TOON do magias.gd)
const PEDRA := [Color(0.66, 0.6, 0.52), Color(0.45, 0.4, 0.34), Color(0.25, 0.21, 0.18)]

# meia-lua do corte: UV.x corre ao longo do arco (0 -> 1 na direção do golpe), UV.y de dentro (0) para o fio (1)
const SH_CORTE := """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
uniform vec4 c0 : source_color = vec4(1.0);
uniform vec4 c1 : source_color = vec4(0.6, 0.85, 1.0, 1.0);
uniform vec4 c2 : source_color = vec4(0.17, 0.39, 0.77, 1.0);
uniform float cabeca = 1.0; // até onde o corte já passou
uniform float cauda = 0.0; // de onde ele já apagou
uniform float come = 0.0; // 0 -> 1: o ruído come de dentro para fora
uniform float largura = 0.5;
uniform float op = 1.0;
uniform float semente = 0.0;
%s
void fragment() {
	float u = UV.x;
	float v = UV.y;
	if (u > cabeca || u < cauda) discard;
	float s = (u - cauda) / max(cabeca - cauda, 0.001);
	float sp = pow(clamp(s, 0.0, 1.0), 0.7); // mais grosso perto da cabeça, afinando até a cauda
	float w = largura * pow(sin(3.14159 * clamp(sp * 0.94 + 0.03, 0.0, 1.0)), 0.45) * (0.4 + 0.6 * s);
	float k = (v - (1.0 - w)) / max(w, 0.001);
	float n = rd(vec3(u * 16.0, v * 5.0, semente));
	float th = come * 1.05 + (n - 0.5) * 0.3 * (0.3 + come);
	float aa = fwidth(k) * 1.2 + 0.01;
	float corpo = smoothstep(th - aa, th + aa, k);
	if (corpo <= 0.01) discard;
	float meio = smoothstep(0.32 - aa, 0.32 + aa, k + (n - 0.5) * 0.12);
	float fio = smoothstep(0.72 - aa, 0.72 + aa, k);
	vec3 c = mix(c2.rgb, c1.rgb, meio);
	c = mix(c, c0.rgb, fio);
	ALBEDO = c;
	ALPHA = corpo * op * mix(0.8, 1.0, meio);
}
"""

# chão rachado: rachaduras saindo do centro (com a força acesa no fundo, que esfria), buraco no meio e terra revolvida
const SH_FENDA := """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;
uniform float op = 1.0;
uniform float brilho = 1.0;
uniform float abre = 1.0;
uniform float semente = 0.0;
uniform float buraco = 0.16;
uniform vec4 cor_brilho : source_color = vec4(1.0, 0.82, 0.4, 1.0);
uniform vec4 cor_fenda : source_color = vec4(0.11, 0.08, 0.06, 1.0);
uniform vec4 cor_terra : source_color = vec4(0.35, 0.26, 0.18, 1.0);
%s
float h1(float x) { return fract(sin(x * 91.3458 + semente * 17.17) * 47453.5453); }
void fragment() {
	vec2 p = (UV - 0.5) * 2.0;
	float r = length(p);
	if (r > 1.0) discard;
	float ang = atan(p.y, p.x);
	float v = 0.0;
	// 8 rachaduras grandes do centro (quebradas em zigue-zague) e 6 galhos que nascem no meio do caminho
	for (int i = 0; i < 14; i++) {
		float fi = float(i);
		bool galho = i >= 8;
		float a0 = galho ? (h1(fi) * 6.28318) : (fi + (h1(fi) - 0.5) * 0.7) / 8.0 * 6.28318;
		float ini = galho ? 0.22 + 0.35 * h1(fi + 5.0) : 0.0;
		float alc = galho ? ini + 0.15 + 0.3 * h1(fi + 11.0) : 0.45 + 0.55 * h1(fi + 11.0);
		float ac = a0 + (rd(vec3(r * 3.5, fi * 3.1, semente)) - 0.5) * 0.75 * (0.25 + r) + (rd(vec3(r * 13.0, fi * 7.3, semente)) - 0.5) * 0.16;
		float da = abs(mod(ang - ac + 3.14159, 6.28318) - 3.14159) * r;
		float w = mix(galho ? 0.016 : 0.042, 0.005, clamp((r - ini) / max(alc - ini, 0.01), 0.0, 1.0));
		float vivo = (1.0 - smoothstep(alc * abre - 0.03, alc * abre, r)) * step(ini, r);
		v = max(v, smoothstep(w, w * 0.35, da) * vivo);
	}
	float g = smoothstep(0.03, 0.0, abs(fbm(vec3(p * 5.0, semente + 5.0)) - 0.5)) * (1.0 - smoothstep(0.1, 0.7 * abre, r)) * 0.85;
	v = max(v, g);
	float nb = fbm(vec3(p * 4.0, semente + 9.0));
	float centro = 1.0 - smoothstep(buraco, buraco + 0.05 + nb * 0.08, r);
	float terra = (1.0 - smoothstep(buraco + 0.04, buraco + 0.3 + nb * 0.18, r)) * 0.6;
	vec3 c = mix(cor_terra.rgb * (0.85 + nb * 0.3), cor_fenda.rgb, max(v, centro));
	float alfa = max(terra, max(v, centro * 0.95));
	c = mix(c, cor_brilho.rgb * 1.25, smoothstep(0.6, 0.95, v) * brilho);
	ALBEDO = c;
	ALPHA = clamp(alfa * op, 0.0, 1.0);
}
"""

# pedra lascada pintada: cada face numa de três cores chapadas (luz de cima), sem textura
const SH_PEDRA := """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_opaque, cull_back, shadows_disabled;
uniform vec4 claro : source_color = vec4(0.66, 0.6, 0.52, 1.0);
uniform vec4 meio : source_color = vec4(0.45, 0.4, 0.34, 1.0);
uniform vec4 escuro : source_color = vec4(0.25, 0.21, 0.18, 1.0);
void fragment() {
	vec3 nv = normalize(cross(dFdx(VERTEX), dFdy(VERTEX)));
	vec3 nw = (INV_VIEW_MATRIX * vec4(nv, 0.0)).xyz;
	float l = dot(nw, normalize(vec3(0.35, 0.8, 0.45)));
	vec3 c = l > 0.45 ? claro.rgb : l > 0.0 ? meio.rgb : escuro.rgb;
	float f = 1.0 - clamp(abs(dot(nv, normalize(-VERTEX))), 0.0, 1.0);
	ALBEDO = mix(c, escuro.rgb * 0.6, smoothstep(0.75, 0.9, f)); // contorno escuro fino
}
"""

var _meia: ArrayMesh # meia-lua (180°)
var _volta: ArrayMesh # anel quase inteiro (Giro)
var _pedra: ArrayMesh # pedra lascada (poucas faces: lê como pintada)
var _mat_pedra: ShaderMaterial

var cortes: Array = [] # {m, mat, t, varre, dur, cresce, s0}
var chaos: Array = [] # chão rachado {m, mat, t, dur, abre}
var pedras: Array = [] # {no, mm, itens: [{p, v, giro, eixo, tam, y0}], t, dur}
var pontas: Array = [] # pontas de pedra do Pisão {no, mm, itens, t, dur}
var _duplo := {"t": -9.0, "x": 0.0, "z": 0.0, "lado": 1.0}
var _tempo := 0.0

func _ready() -> void:
	_meia = _arco(PI, 40)
	_volta = _arco(TAU * 0.97, 72)
	_pedra = _malha_pedra()
	_mat_pedra = fx.material("pedra_toon", SH_PEDRA, {"claro": PEDRA[0], "meio": PEDRA[1], "escuro": PEDRA[2]})

func _arco(abre: float, n: int) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in n:
		var u0 := float(i) / n
		var u1 := float(i + 1) / n
		var a0 := -abre * 0.5 + abre * u0
		var a1 := -abre * 0.5 + abre * u1
		var q := [[Vector3(sin(a0) * 0.5, 0, cos(a0) * 0.5), Vector2(u0, 0)], [Vector3(sin(a0), 0, cos(a0)), Vector2(u0, 1)],
			[Vector3(sin(a1) * 0.5, 0, cos(a1) * 0.5), Vector2(u1, 0)], [Vector3(sin(a1), 0, cos(a1)), Vector2(u1, 1)]]
		for k in [0, 1, 2, 1, 3, 2]:
			st.set_uv(q[k][1])
			st.add_vertex(q[k][0])
	return st.commit()

func _malha_pedra() -> ArrayMesh:
	var base := SphereMesh.new()
	base.radius = 1.0
	base.height = 2.0
	base.radial_segments = 7
	base.rings = 4
	var arr := base.get_mesh_arrays()
	var ruido := FastNoiseLite.new()
	ruido.seed = 31
	ruido.frequency = 1.6
	var vs: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in idx:
		var d: Vector3 = vs[i].normalized() if vs[i].length() > 0.001 else Vector3.UP
		st.add_vertex(d * (1.0 + ruido.get_noise_3dv(d * 1.4) * 0.45) * Vector3(1.0, 0.7, 1.15))
	return st.commit()

static func _cor(hex) -> Color:
	return hex if hex is Color else Color(hex)

func _som(nome: String, pos: Vector3, vol := 0.0, tom := 0.05) -> void:
	if fx.mundo and fx.mundo.sons and fx.mundo.sons.tem(nome):
		fx.mundo.sons.tocar(nome, vol, tom, pos)

# base do plano do corte: virado para ry e girado 'inclina' em volta da frente (0 = deitado, PI/2 = de pé)
static func plano(ry: float, inclina: float) -> Basis:
	return Basis(Vector3.UP, ry) * Basis(Vector3(0, 0, 1), inclina)

# ---------------------------------------------------------------- o corte em meia-lua
# centro = meio do arco; raio em m; varre = s para o corte passar; dur = vida toda; sentido -1 = corre ao contrário
func corte(centro: Vector3, base: Basis, raio: float, cores: Array, varre := 0.08, dur := 0.3, largura := 0.5,
		volta := false, sentido := 1.0, cresce := 0.08) -> void:
	var mi := MeshInstance3D.new()
	mi.mesh = _volta if volta else _meia
	var mat: ShaderMaterial = fx.material("corte_toon", SH_CORTE % fx.RUIDO, {"c0": _cor(cores[0]), "c1": _cor(cores[1]), "c2": _cor(cores[2]),
		"cabeca": 0.0, "cauda": 0.0, "come": 0.0, "largura": largura, "op": 1.0, "semente": randf() * 50.0})
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.extra_cull_margin = 4.0
	add_child(mi)
	var b := base * Basis.from_scale(Vector3(raio * sentido, raio, raio))
	mi.global_transform = Transform3D(b, centro)
	cortes.append({"m": mi, "mat": mat, "t": 0.0, "varre": varre, "dur": dur, "cresce": cresce, "b": b, "c": centro})

func _passo_cortes(dt: float) -> void:
	var i := cortes.size() - 1
	while i >= 0:
		var q: Dictionary = cortes[i]
		q.t += dt
		if q.t >= q.dur or not is_instance_valid(q.m):
			if is_instance_valid(q.m):
				q.m.queue_free()
			cortes.remove_at(i)
			i -= 1
			continue
		var u: float = q.t / q.dur
		var cab: float = 1.0 - pow(1.0 - min(1.0, q.t / q.varre), 2.0)
		var cau: float = clamp((q.t - q.varre * 0.7) / max(0.01, q.dur - q.varre * 0.7), 0.0, 1.0)
		q.mat.set_shader_parameter("cabeca", cab)
		q.mat.set_shader_parameter("cauda", cau * cau * 0.9)
		q.mat.set_shader_parameter("come", smoothstep(0.3, 1.0, u))
		q.m.global_transform = Transform3D(q.b * (1.0 + q.cresce * u), q.c)
		i -= 1

# ---------------------------------------------------------------- começo da skill
# no lugar do círculo mágico do mago: a lâmina brilha na ponta, o vento gira no pé e levanta um pouco de poeira
func foco(corpo: Node3D, k: String, dur: float, ponta: Callable) -> void:
	var pe := corpo.global_position
	_som("esp_foco", pe, -7.0, 0.06)
	var cores: Array = OURO if k in ["esmagar", "salto"] else ACO
	var pts: Array = ponta.call() if ponta.is_valid() else [pe + Vector3(0, 1.3, 0)]
	var o: Vector3 = pts[0]
	mg.p(mg.LUZ, o, Vector3(0, 0.3, 0), 0.32, 0.2, 0.9, cores[0], cores[1], 0.95, mg.C_ESTRELA2, 0, 0, 5.0, 0, false, 0.25)
	mg.p(mg.LUZ, o, Vector3.ZERO, 0.18, 0.5, 1.0, cores[0], cores[1], 0.5, mg.C_FLARE, 0, 0, 0, 0, false, 0.0)
	mg.selo(pe + Vector3(0, 0.06, 0), mg.C_GIRO, cores[1], 0.7, min(0.45, dur * 0.6), true, 0.45, -7.0, 0.04, 0.2, 1.3)
	for i in 6:
		var a := i / 6.0 * TAU + randf_range(-0.3, 0.3)
		var v := Vector3(cos(a), 0, sin(a))
		mg.fogo(mg.NUV, pe + v * 0.35 + Vector3(0, 0.12, 0), v * randf_range(1.6, 2.4) + Vector3(-v.z, 0.3, v.x) * 1.2, randf_range(0.4, 0.55),
			0.22, 0.5, TERRA_C[0], TERRA_C[1], mg.C_FUMACA if i % 2 else mg.C_FUMACA2, 0.0, 3.0)

# ---------------------------------------------------------------- acerto da espada no monstro
# marca do corte no alvo (meia-lua pequena na direção do golpe), estrela de brilho e faíscas; forte: poeira no pé
func acerto(p: Vector3, ry: float, forte: bool) -> void:
	var inc := randf_range(-0.9, 0.9)
	corte(p, plano(ry, PI * 0.5 + inc), 0.6 if forte else 0.45, ACO, 0.05, 0.2, 0.7, false, -1.0 if randf() < 0.5 else 1.0, 0.25)
	mg.p(mg.LUZ, p, Vector3.ZERO, 0.11, 0.35, 0.95 if forte else 0.7, "ffffff", ACO[1], 0.95, mg.C_ESTRELA, 0, 0, 0, 0, false, 0.0, randf() * TAU)
	var dir := Vector3(sin(ry), 0, cos(ry))
	for i in (14 if forte else 8):
		var v := (dir * 0.8 + Vector3(randf_range(-1, 1), randf_range(-0.2, 1.0), randf_range(-1, 1))).normalized() * randf_range(4.0, 9.0)
		mg.p(mg.LUZ, p, v, randf_range(0.14, 0.26), 0.05, 0.02, "ffffff", ACO[1], 1.0, mg.C_TRACO, -10.0, 3.0, 0.0, 0.03)
	if forte:
		var pe := p - Vector3(0, 1.05, 0)
		for i in 5:
			var a := randf() * TAU
			mg.fogo(mg.NUV, pe + Vector3(cos(a) * 0.3, 0.15, sin(a) * 0.3), Vector3(cos(a) * 1.6, 0.5, sin(a) * 1.6), randf_range(0.45, 0.6), 0.25, 0.55,
				TERRA_C[0], TERRA_C[1], mg.C_FUMACA if i % 2 else mg.C_FUMACA2, 0.0, 2.5)

# ---------------------------------------------------------------- Corte Duplo (um por corte, em X)
func duplo(x: float, z: float, y: float, ry: float, r: float) -> void:
	var o := Vector3(x, y + 1.0, z)
	# o 2º corte (até 0,6 s depois, no mesmo lugar) cruza o 1º
	var segundo: bool = _tempo - float(_duplo.t) < 0.6 and Vector2(x - float(_duplo.x), z - float(_duplo.z)).length() < 1.5
	var lado: float = -float(_duplo.lado) if segundo else 1.0
	_duplo = {"t": _tempo, "x": x, "z": z, "lado": lado}
	_som("esp_duplo", o, -1.0, 0.04)
	var tam: float = max(1.2, r * 0.7)
	corte(o - Vector3(sin(ry), 0, cos(ry)) * tam * 0.55, plano(ry, PI * 0.5 + 0.75 * lado), tam, ACO, 0.07, 0.36, 0.85, false, lado, 0.1)
	mg.p(mg.LUZ, o, Vector3.ZERO, 0.12, 0.6, 1.6, "ffffff", ACO[1], 0.8, mg.C_ESTRELA, 0, 0, 0, 0, false, 0.0, randf() * TAU)
	mg.selo(Vector3(x, y + 0.06, z), mg.C_GIRO, ACO[1], r * 0.3, 0.3, true, 0.35, 6.0 * lado, 0.0, 0.2, r * 0.75)
	for i in 10:
		var a := randf() * TAU
		var v := Vector3(cos(a), randf_range(0.1, 0.8), sin(a)).normalized() * randf_range(5.0, 9.0)
		mg.p(mg.LUZ, o, v, randf_range(0.15, 0.28), 0.06, 0.02, "ffffff", ACO[1], 1.0, mg.C_TRACO, -8.0, 3.0, 0.0, 0.03)
	fx.luz(ACO[1], 2.0, 5.0, 0.18).l.global_position = o

# ---------------------------------------------------------------- Giro da Lâmina (um por volta)
var _giro_n := 0
func giro(x: float, z: float, y: float, r: float) -> void:
	_giro_n += 1
	var o := Vector3(x, y + 0.85 + (_giro_n % 2) * 0.2, z)
	_som("esp_giro", o, -1.0, 0.04)
	var raio: float = r * 0.62
	corte(o, plano(randf() * TAU, randf_range(-0.12, 0.12)), raio, ACO, 0.16, 0.38, 0.6, true, 1.0 if _giro_n % 2 else -1.0, 0.12)
	# poeira pintada rolando para fora, rente ao chão, e faíscas na tangente da lâmina
	for i in 10:
		var a := i / 10.0 * TAU + randf_range(-0.2, 0.2)
		var v := Vector3(cos(a), 0, sin(a))
		mg.fogo(mg.NUV, Vector3(x, y + 0.2, z) + v * raio * 0.5, v * randf_range(3.0, 4.5) + Vector3(-v.z, 0.25, v.x) * 1.5, randf_range(0.45, 0.6),
			0.3, 0.75, TERRA_C[0], TERRA_C[1], mg.C_FUMACA if i % 2 else mg.C_FUMACA2, 0.0, 3.0)
	for i in 14:
		var a := randf() * TAU
		var t := Vector3(-sin(a), 0, cos(a))
		mg.p(mg.LUZ, o + Vector3(cos(a), 0, sin(a)) * raio, t * randf_range(6.0, 10.0) + Vector3(0, randf_range(0.0, 2.0), 0), randf_range(0.15, 0.25),
			0.06, 0.02, "ffffff", ACO[1], 1.0, mg.C_TRACO, -6.0, 2.0, 0.0, 0.03)
	fx.luz(ACO[1], 2.2, r * 2.0, 0.2).l.global_position = o

# ---------------------------------------------------------------- Golpe Esmagador
# a espada desce de cima (corte de pé, dourado) e crava no chão: clarão, onda, chão rachado, pedras e poeira
func esmagar(x: float, z: float, y: float, r: float, ry: float) -> void:
	var g := Vector3(x, y, z)
	_som("esp_esmagar", g, 0.0, 0.03)
	var f := Vector3(sin(ry), 0, cos(ry))
	corte(g + Vector3(0, 1.0, 0) - f * 0.9, plano(ry, PI * 0.5), 1.5, OURO, 0.06, 0.3, 0.9, false, -1.0, 0.05)
	mg.p(mg.LUZ, g + Vector3(0, 0.4, 0), Vector3.ZERO, 0.14, 0.8, r * 1.4, "fffaf0", OURO[1], 0.95, mg.C_FLARE, 0, 0, 0, 0, false, 0.0)
	mg.selo(g + Vector3(0, 0.07, 0), mg.C_DISCO, OURO[1], r * 0.2, 0.32, true, 0.6, 0.0, 0.0, 0.22, r * 1.15)
	chao_rachado(g, r * 0.85, 1.8, OURO[1], 0.14)
	pedras_voando(g, 9, 0.12, 0.26, 4.0, 7.5, r * 0.25)
	for i in 12: # anel de poeira pintada rolando para fora
		var a := i / 12.0 * TAU + randf_range(-0.15, 0.15)
		var v := Vector3(cos(a), 0, sin(a))
		mg.fogo(mg.NUV, g + v * 0.5 + Vector3(0, 0.25, 0), v * randf_range(3.5, 5.0) * r / 2.8 + Vector3(0, 0.5, 0), randf_range(0.7, 0.95),
			0.45, r * 0.42, TERRA_C[0], TERRA_C[1], mg.C_FUMACA if i % 2 else mg.C_FUMACA2, 0.0, 2.6)
	for i in 8: # terra e cascalho
		var a := randf() * TAU
		var v := randf_range(2.5, 5.0)
		mg.p(mg.NUV, g + Vector3(0, 0.3, 0), Vector3(cos(a) * v, randf_range(4.0, 7.0), sin(a) * v), randf_range(0.6, 0.85), 0.2, 0.14, "4a3a2c", "2e241c", 0.9, mg.C_TERRA, -16.0, 0.2, randf_range(-6, 6))
	for i in 12: # faíscas douradas da lâmina batendo
		var a := randf() * TAU
		mg.p(mg.LUZ, g + Vector3(0, 0.2, 0), Vector3(cos(a) * randf_range(3, 7), randf_range(3, 8), sin(a) * randf_range(3, 7)), randf_range(0.25, 0.45),
			0.07, 0.02, "fffbe8", OURO[1], 1.0, mg.C_TRACO, -14.0, 1.0, 0.0, 0.03)
	fx.luz(OURO[1], 3.5, r * 3.0, 0.3).l.global_position = g + Vector3(0, 1.0, 0)
	mg._tremer(g, 0.4, 16.0)

# ---------------------------------------------------------------- Pisão Sísmico
# o chão racha em volta do herói, pontas de pedra saem em onda de dentro para fora e a poeira rola até a borda
func pisao(x: float, z: float, y: float, r: float) -> void:
	var g := Vector3(x, y, z)
	_som("esp_pisao", g, 0.0, 0.03)
	mg.selo(g + Vector3(0, 0.07, 0), mg.C_DISCO, TERRA_C[1], r * 0.15, 0.4, true, 0.55, 0.0, 0.0, 0.28, r * 1.05)
	chao_rachado(g, r * 0.95, 2.2, "ffb347", 0.12)
	pontas_pedra(g, r)
	pedras_voando(g, 7, 0.1, 0.2, 3.0, 6.0, r * 0.3)
	for i in 16:
		var a := i / 16.0 * TAU + randf_range(-0.1, 0.1)
		var v := Vector3(cos(a), 0, sin(a))
		mg.fogo(mg.NUV, g + v * r * 0.25 + Vector3(0, 0.2, 0), v * randf_range(4.0, 5.5) * r / 5.0 + Vector3(0, 0.4, 0), randf_range(0.8, 1.05),
			0.5, r * 0.3, TERRA_C[0], TERRA_C[1], mg.C_FUMACA if i % 2 else mg.C_FUMACA2, 0.0, 2.2)
	fx.luz("ffb347", 2.6, r * 2.2, 0.3).l.global_position = g + Vector3(0, 0.8, 0)
	mg._tremer(g, 0.45, 18.0)

# ---------------------------------------------------------------- Investida
# começo: poeira chutada para trás e o vento rasgando; a estocada em cada inimigo da linha
func arrancada(corpo: Node3D) -> void:
	var p := corpo.global_position
	var f := corpo.global_transform.basis.z.normalized()
	_som("esp_investida", p, 0.0, 0.04)
	for i in 6:
		var v := (-f + Vector3(randf_range(-0.6, 0.6), 0, randf_range(-0.6, 0.6))).normalized()
		mg.fogo(mg.NUV, p + Vector3(0, 0.15, 0), v * randf_range(2.0, 3.5) + Vector3(0, 0.6, 0), randf_range(0.45, 0.6), 0.3, 0.7,
			TERRA_C[0], TERRA_C[1], mg.C_FUMACA if i % 2 else mg.C_FUMACA2, 0.0, 2.5)
	for i in 10: # riscos de vento na frente, passando por ele
		var o := p + f * randf_range(0.5, 3.5) + Vector3(randf_range(-0.6, 0.6), randf_range(0.4, 1.7), randf_range(-0.6, 0.6))
		mg.p(mg.LUZ, o, -f * randf_range(14.0, 20.0), randf_range(0.12, 0.2), 0.05, 0.03, "ffffff", ACO[1], 0.85, mg.C_TRACO, 0.0, 0.0, 0.0, 0.025)

func estocada(x: float, z: float, y: float, ry: float) -> void:
	var o := Vector3(x, y + 1.05, z)
	_som("esp_estocada", o, -2.0, 0.05)
	var f := Vector3(sin(ry), 0, cos(ry))
	# risco de luz atravessando o alvo na direção da investida, estrela e faíscas saindo para a frente
	mg.p(mg.LUZ, o - f * 0.6, f * 22.0, 0.12, 0.12, 0.06, "ffffff", ACO[1], 1.0, mg.C_TRACO, 0.0, 6.0, 0.0, 0.05)
	mg.p(mg.LUZ, o, Vector3.ZERO, 0.12, 0.4, 1.1, "ffffff", ACO[1], 0.95, mg.C_ESTRELA, 0, 0, 0, 0, false, 0.0, randf() * TAU)
	corte(o, plano(ry, PI * 0.5 + randf_range(-0.4, 0.4)), 0.55, ACO, 0.05, 0.2, 0.65, false, 1.0, 0.3)
	for i in 10:
		var v := (f + Vector3(randf_range(-0.7, 0.7), randf_range(-0.2, 0.8), randf_range(-0.7, 0.7))).normalized() * randf_range(5.0, 10.0)
		mg.p(mg.LUZ, o, v, randf_range(0.15, 0.28), 0.06, 0.02, "ffffff", ACO[1], 1.0, mg.C_TRACO, -9.0, 2.5, 0.0, 0.03)
	fx.luz(ACO[1], 2.0, 5.0, 0.15).l.global_position = o

# ---------------------------------------------------------------- peças que ficam: chão rachado, pedras, pontas
func chao_rachado(g: Vector3, r: float, dur: float, cor_brilho, buraco := 0.14) -> void:
	var mi := MeshInstance3D.new()
	var q := PlaneMesh.new()
	q.size = Vector2(2, 2)
	mi.mesh = q
	var mat: ShaderMaterial = fx.material("fenda_toon", SH_FENDA % fx.RUIDO, {"op": 1.0, "brilho": 1.0, "abre": 0.0, "semente": randf() * 40.0,
		"cor_brilho": _cor(cor_brilho), "buraco": buraco})
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.sorting_offset = -1.0
	add_child(mi)
	mi.global_position = g + Vector3(0, 0.05, 0)
	mi.rotation.y = randf() * TAU
	mi.scale = Vector3(r, 1, r)
	chaos.append({"m": mi, "mat": mat, "t": 0.0, "dur": dur})

func _passo_chaos(dt: float) -> void:
	var i := chaos.size() - 1
	while i >= 0:
		var q: Dictionary = chaos[i]
		q.t += dt
		if q.t >= q.dur or not is_instance_valid(q.m):
			if is_instance_valid(q.m):
				q.m.queue_free()
			chaos.remove_at(i)
			i -= 1
			continue
		var t: float = q.t
		q.mat.set_shader_parameter("abre", 1.0 - pow(1.0 - min(1.0, t / 0.16), 3.0)) # racha rápido do centro para fora
		q.mat.set_shader_parameter("brilho", clamp(1.0 - (t - 0.1) / 0.6, 0.0, 1.0)) # a força apaga no fundo
		q.mat.set_shader_parameter("op", clamp((q.dur - t) / 0.5, 0.0, 1.0))
		i -= 1

func pedras_voando(g: Vector3, n: int, tam0: float, tam1: float, v0: float, v1: float, espalha: float) -> void:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = _pedra
	mm.instance_count = n
	var no := MultiMeshInstance3D.new()
	no.multimesh = mm
	no.material_override = _mat_pedra
	no.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	no.extra_cull_margin = 16384.0
	add_child(no)
	var itens := []
	for i in n:
		var a := randf() * TAU
		var h := randf_range(v0, v1)
		itens.append({"p": g + Vector3(cos(a) * espalha * randf(), 0.2, sin(a) * espalha * randf()),
			"v": Vector3(cos(a) * randf_range(1.5, 4.0), h, sin(a) * randf_range(1.5, 4.0)), "giro": randf_range(6.0, 14.0),
			"eixo": Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)).normalized(), "tam": randf_range(tam0, tam1),
			"y0": g.y, "parada": false, "ang": randf() * TAU})
	pedras.append({"no": no, "mm": mm, "itens": itens, "t": 0.0, "dur": 1.4})

func _passo_pedras(dt: float) -> void:
	var i := pedras.size() - 1
	while i >= 0:
		var q: Dictionary = pedras[i]
		q.t += dt
		if q.t >= q.dur:
			q.no.queue_free()
			pedras.remove_at(i)
			i -= 1
			continue
		var some: float = clamp((q.dur - q.t) / 0.35, 0.0, 1.0)
		for k in q.itens.size():
			var it: Dictionary = q.itens[k]
			if not it.parada:
				it.v.y -= 18.0 * dt
				it.p += it.v * dt
				if it.p.y < it.y0 + it.tam * 0.5 and it.v.y < 0.0: # bateu no chão: quica uma vez e para
					it.p.y = it.y0 + it.tam * 0.5
					if abs(it.v.y) > 3.0:
						it.v = Vector3(it.v.x * 0.4, -it.v.y * 0.3, it.v.z * 0.4)
					else:
						it.parada = true
			if not it.parada:
				it.ang += it.giro * dt
			var b := Basis(it.eixo, it.ang) * Basis.from_scale(Vector3.ONE * max(0.001, it.tam * some))
			q.mm.set_instance_transform(k, Transform3D(b, it.p))
		i -= 1

# pontas de pedra saindo do chão em 2 anéis (de dentro para fora), ficam um instante e afundam
func pontas_pedra(g: Vector3, r: float) -> void:
	var itens := []
	var w = fx.mundo
	for anel in 2:
		var d: float = r * (0.45 if anel == 0 else 0.78)
		var n := 7 if anel == 0 else 10
		for i in n:
			var a := (i + randf_range(-0.25, 0.25) + anel * 0.5) / n * TAU
			var px := g.x + cos(a) * d
			var pz := g.z + sin(a) * d
			var py: float = w.terreno.altura(px, pz) if w and w.get("terreno") else g.y
			var inc := deg_to_rad(randf_range(12.0, 28.0))
			itens.append({"p": Vector3(px, py, pz), "alt": randf_range(0.55, 0.95) * (1.0 if anel == 0 else 0.8), "larg": randf_range(0.18, 0.28),
				"ini": 0.03 + anel * 0.1 + randf() * 0.05, "ry": randf() * TAU, "incx": cos(a) * inc, "incz": sin(a) * inc})
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mg._espinho
	mm.instance_count = itens.size()
	var no := MultiMeshInstance3D.new()
	no.multimesh = mm
	no.material_override = _mat_pedra
	no.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	no.extra_cull_margin = 16384.0
	add_child(no)
	var zero := Transform3D(Basis.from_scale(Vector3(0.001, 0.001, 0.001)), g)
	for k in itens.size():
		mm.set_instance_transform(k, zero)
	pontas.append({"no": no, "mm": mm, "itens": itens, "t": 0.0, "dur": 1.0})

func _passo_pontas(dt: float) -> void:
	var i := pontas.size() - 1
	while i >= 0:
		var q: Dictionary = pontas[i]
		q.t += dt
		if q.t >= q.dur:
			q.no.queue_free()
			pontas.remove_at(i)
			i -= 1
			continue
		for k in q.itens.size():
			var it: Dictionary = q.itens[k]
			var t: float = q.t - it.ini
			var h := 0.0
			if t > 0.0:
				h = 1.0 - pow(1.0 - min(1.0, t / 0.09), 3.0) # sobe rápido
				if t > 0.5:
					h *= clamp(1.0 - (t - 0.5) / 0.3, 0.0, 1.0) # afunda
			if h <= 0.001:
				q.mm.set_instance_transform(k, Transform3D(Basis.from_scale(Vector3(0.001, 0.001, 0.001)), it.p))
				continue
			var alt: float = it.alt * h
			# inclinada para fora, como as pontas de gelo da Nova de Gelo (magias.gd), com a escala no próprio eixo dela
			var b := Basis.from_euler(Vector3(it.incz, 0, -it.incx)) * Basis(Vector3.UP, it.ry) * Basis.from_scale(Vector3(it.larg, alt, it.larg))
			# o cone tem 1 m de altura com o meio na origem: sobe metade para a base ficar no chão (um pouco enterrada)
			q.mm.set_instance_transform(k, Transform3D(b, it.p + b.y * 0.5 - Vector3(0, 0.08, 0)))
		i -= 1

# ---------------------------------------------------------------- quadro
func _process(dt: float) -> void:
	var t0_parte := Time.get_ticks_usec()
	_process_parte(dt)
	if Time.get_ticks_usec() - t0_parte >= 1000 and Engine.has_meta("lentidao"): # quadro lento (lentidao.gd)
		Engine.get_meta("lentidao").ev("golpes", t0_parte)

func _process_parte(dt: float) -> void:
	_tempo += dt
	_passo_cortes(dt)
	_passo_chaos(dt)
	_passo_pedras(dt)
	_passo_pontas(dt)

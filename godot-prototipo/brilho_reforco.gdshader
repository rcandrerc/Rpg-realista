// Aura do reforço da arma (André 2026-11-24: "efeito de brilho nas armas à medida que o reforço aumenta"; v2: "achei
// muito discreto, quero algo incandescente como uma aura / fogo"). Uma casca por cima da própria malha da arma (sem
// modelo novo), somando luz: a casca é empurrada para fora e ondula como chama (ruído subindo), a lâmina fica em
// brasa (miolo claro) e a borda queima na cor da faixa. Cor, força e grossura vêm do +N (Armas.brilho_reforco).
// As línguas de fogo de verdade são partículas (Armas.faiscas); aqui é o corpo incandescente da aura.
shader_type spatial;
render_mode blend_add, unshaded, cull_back, depth_draw_never, shadows_disabled;

uniform vec4 cor : source_color = vec4(0.3, 0.65, 1.0, 1.0); // borda da chama
uniform vec4 miolo : source_color = vec4(1.0, 1.0, 1.0, 1.0); // brasa (perto do metal)
uniform float forca = 0.5; // 0 a ~1,6: cresce com o reforço
uniform float comprimento = 1.0; // m da arma no espaço dela (cabo na origem, ponta em +Y)
uniform float inicio = 0.18; // onde a aura começa (fração do comprimento): o cabo fica apagado
uniform float casca = 0.02; // quanto a aura sai da malha (m)
uniform float onda = 1.0; // velocidade da chama subindo

varying float v_y;
varying vec3 v_loc;

float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido(vec2 p) {
	vec2 i = floor(p);
	vec2 f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h(i), h(i + vec2(1.0, 0.0)), f.x), mix(h(i + vec2(0.0, 1.0)), h(i + vec2(1.0, 1.0)), f.x), f.y);
}
float chama(vec2 p) { return ruido(p) * 0.6 + ruido(p * 2.3 + 7.1) * 0.4; }

void vertex() {
	v_y = VERTEX.y / comprimento;
	v_loc = VERTEX;
	// a casca respira como chama: mais grossa onde o ruído sobe
	float n = chama(vec2(VERTEX.x * 18.0 + VERTEX.z * 18.0, VERTEX.y * 7.0 - TIME * 3.0 * onda));
	VERTEX += NORMAL * casca * (0.55 + 0.9 * n);
}

void fragment() {
	float frente = clamp(abs(dot(NORMAL, VIEW)), 0.0, 1.0);
	float borda = pow(1.0 - frente, 1.3);
	vec2 q = vec2((v_loc.x + v_loc.z) * 22.0, v_loc.y * 9.0 - TIME * 3.4 * onda);
	float n = chama(q);
	float lingua = smoothstep(0.35, 0.85, n); // manchas de fogo subindo
	float a = (0.12 + borda * 1.5 + lingua * 0.8) * (0.85 + 0.15 * sin(TIME * 5.0 + v_y * 6.0)) * forca;
	a *= smoothstep(inicio - 0.06, inicio + 0.1, v_y);
	vec3 c = mix(cor.rgb, miolo.rgb, clamp(lingua * lingua * 0.45, 0.0, 1.0));
	ALBEDO = c * a;
	ALPHA = 1.0;
}

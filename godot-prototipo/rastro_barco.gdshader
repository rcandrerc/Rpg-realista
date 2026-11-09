shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_disabled, specular_disabled, unshaded, shadows_disabled;
// Esteira atrás do barco e do navio (transporte.gd _rastro, 2026-11-09): fita colada na água.
// UV.x: 0 = borda esquerda, 1 = borda direita; UV.y: idade (0 = na popa, 1 = sumindo); COLOR.a: velocidade do barco
// quando passou ali. Espuma de ruído nas duas bordas do V (as ondas que abrem) e água mexida no meio, logo atrás da popa.
uniform vec3 cor : source_color = vec3(0.94, 0.98, 1.0);
uniform vec3 cor_mexida : source_color = vec3(0.62, 0.84, 0.86);
uniform float noite = 0.0;
varying vec3 mundo;
varying float forca;
void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	forca = COLOR.a;
}
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }
float ruido(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y);
}
void fragment() {
	float x = abs(UV.x - 0.5) * 2.0; // 0 no meio, 1 na borda
	float idade = clamp(UV.y, 0.0, 1.0);
	float n = ruido(mundo.xz * 3.2 + vec2(TIME * 0.35, 0.0)) * 0.6 + ruido(mundo.xz * 8.5 - vec2(0.0, TIME * 0.5)) * 0.4;
	// bordas do V: uma faixa de espuma que vai ficando fina e rala
	float borda = smoothstep(0.62, 0.9, x + (n - 0.5) * 0.25) * (1.0 - smoothstep(0.93, 1.0, x));
	borda *= smoothstep(0.32, 0.62, n) * pow(1.0 - idade, 1.4);
	// meio: água revirada logo atrás da popa (espuma em manchas), some rápido
	float meio = (1.0 - smoothstep(0.0, 0.55, x)) * pow(1.0 - idade, 3.0);
	float manchas = smoothstep(0.45, 0.75, n) * meio;
	float liso = (1.0 - x) * pow(1.0 - idade, 1.6) * 0.25; // a esteira lisa, mais clara que a água em volta
	float f = smoothstep(0.05, 0.6, forca);
	vec3 c = mix(cor_mexida, cor, clamp(max(borda, manchas) * 1.3, 0.0, 1.0));
	ALBEDO = c * mix(1.0, 0.3, noite);
	ALPHA = clamp(max(max(borda * 0.75, manchas * 0.8), liso) * f, 0.0, 0.9);
	if (ALPHA < 0.004) discard;
}

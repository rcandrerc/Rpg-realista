shader_type spatial;
render_mode cull_disabled, depth_draw_opaque;
// Cachoeira (FASE 3, Parte 4b): a água cai em fios brancos (UV.y = de cima para baixo), mais espessa no meio
uniform vec3 cor_agua : source_color = vec3(0.55, 0.75, 0.8);
uniform vec3 cor_espuma : source_color = vec3(0.95, 0.98, 1.0);
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void fragment() {
	vec2 p = vec2(UV.x * 14.0, UV.y * 1.5 - TIME * 2.2);
	float fio = ruido(p * vec2(1.0, 0.35)) * 0.65 + ruido(p * vec2(2.7, 0.9) + 5.0) * 0.35;
	float beira = smoothstep(0.0, 0.1, UV.x) * smoothstep(1.0, 0.9, UV.x);
	float baixo = smoothstep(0.7, 1.0, UV.y); // embaixo vira espuma
	ALBEDO = mix(cor_agua, cor_espuma, clamp(smoothstep(0.35, 0.75, fio) + baixo, 0.0, 1.0));
	ROUGHNESS = 0.25;
	ALPHA = clamp((0.55 + fio * 0.45) * beira, 0.0, 1.0);
}

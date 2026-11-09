shader_type spatial;
render_mode cull_disabled, depth_draw_opaque, specular_schlick_ggx;
// Água do rio (FASE 3, Parte 4b): corre ao longo do leito (UV.y = metros rio abaixo / 4), com as listras da correnteza
// e espuma nas beiras e onde desce mais rápido (rapidez = quanto o nível cai, vem na cor do vértice)
uniform vec3 cor_raso : source_color = vec3(0.2, 0.5, 0.62); // 2026-11-09: o mesmo azul do lago e do mar
uniform vec3 cor_fundo : source_color = vec3(0.04, 0.19, 0.42);
uniform vec3 cor_espuma : source_color = vec3(0.9, 0.95, 0.96);
uniform float velocidade = 0.55;
// qualidade gráfica Baixa (grafico.gd, André 2026-11-09): uma camada de ruído só e sem o relevo da superfície
uniform bool simples = false;
varying float rapidez;
float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
void vertex() {
	rapidez = COLOR.r;
}
void fragment() {
	float t = TIME * velocidade * (1.0 + rapidez * 2.0);
	vec2 p = vec2(UV.x * 3.0, UV.y * 2.0 - t);
	float n = simples ? ruido(p * vec2(2.0, 0.6)) : ruido(p * vec2(2.0, 0.6)) * 0.6 + ruido(p * vec2(5.0, 1.6) + 3.1) * 0.4;
	float meio = 1.0 - abs(UV.x - 0.5) * 2.0;
	vec3 c = mix(cor_raso, cor_fundo, smoothstep(0.0, 0.8, meio));
	float espuma = smoothstep(0.62, 0.9, n) * (0.25 + rapidez * 0.75) + (1.0 - smoothstep(0.0, 0.12, meio)) * 0.6 * n;
	ALBEDO = mix(c, cor_espuma, clamp(espuma, 0.0, 1.0));
	ROUGHNESS = 0.08 + espuma * 0.5;
	SPECULAR = 0.6;
	if (!simples) {
		NORMAL_MAP = normalize(vec3((n - 0.5) * 0.6, (ruido(p * 3.0 + 7.0) - 0.5) * 0.6, 1.0)) * 0.5 + 0.5;
	}
	ALPHA = mix(0.72, 0.95, max(meio, espuma)) * smoothstep(0.0, 0.06, meio);
}

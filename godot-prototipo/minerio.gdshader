shader_type spatial;
render_mode specular_schlick_ggx;
// Pedra de minério (cobre e ferro): o bloco inteiro é metal bruto, facetado. Cada face tem um tom (cor do vértice,
// canal r), o metal reflete forte e faíscas piscam. "cheio" a 0 = veio esgotado: vira pedra cinza fosca.

uniform vec3 cor_escura : source_color = vec3(0.35, 0.16, 0.09);
uniform vec3 cor_clara : source_color = vec3(0.95, 0.6, 0.42);
uniform float metal = 0.9;
uniform float cheio : hint_range(0.0, 1.0) = 1.0;
uniform float semente = 0.0;

varying vec3 p_obj;

float hash(vec3 p) {
	p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float ruido(vec3 x) {
	vec3 i = floor(x);
	vec3 f = fract(x);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

void vertex() {
	p_obj = VERTEX;
}

void fragment() {
	float tom = COLOR.r; // um tom por face: as facetas aparecem
	float sujo = ruido(p_obj * 7.0 + vec3(semente)) * 0.6 + ruido(p_obj * 19.0) * 0.4;
	vec3 metal_cor = mix(cor_escura, cor_clara, clamp(tom * 0.75 + sujo * 0.3, 0.0, 1.0));
	vec3 pedra = vec3(0.32, 0.31, 0.3) * (0.7 + tom * 0.5);
	ALBEDO = mix(pedra, metal_cor, cheio);
	METALLIC = metal * cheio;
	ROUGHNESS = mix(0.85, 0.16 + sujo * 0.18, cheio);
	SPECULAR = 0.8;
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	// facetas que "pegam o sol": algumas faces acendem forte, como o metal polido da referência
	float reflexo = smoothstep(0.78, 0.95, tom) * (0.6 + 0.4 * clamp(dot(NORMAL, VIEW), 0.0, 1.0));
	// faísca: acende e some rápido, em lugares diferentes (não fica um pixel branco parado)
	float faisca = step(0.982, ruido(p_obj * 26.0 + vec3(TIME * 2.5, semente, TIME * 1.7)));
	EMISSION = (metal_cor * (0.22 + fres * 0.5) + cor_clara * reflexo * 0.75 + vec3(1.0, 0.95, 0.85) * faisca * 2.2) * cheio;
}

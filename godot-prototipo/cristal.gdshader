shader_type spatial;
render_mode blend_mix, depth_draw_always, cull_back, specular_schlick_ggx;
// Cristal do veio: vidro colorido (base azul, meio violeta, ponta clara pela cor do vértice), com nuvens
// por dentro, borda clara (fresnel), reflexo forte e faíscas que piscam. Sem textura extra e sem ler a tela (leve no celular).

uniform vec3 brilho_cor : source_color = vec3(0.62, 0.5, 1.0);
uniform float brilho = 0.55;

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
	vec3 c = pow(COLOR.rgb, vec3(2.2)); // a cor do vértice vem em sRGB
	// nuvens leitosas dentro do cristal (ao longo do comprimento)
	float nuvem = ruido(p_obj * vec3(9.0, 3.0, 9.0)) * 0.6 + ruido(p_obj * 22.0) * 0.4;
	c = mix(c * 0.75, c * 1.25 + vec3(0.08), nuvem);
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.5);
	ALBEDO = c;
	ROUGHNESS = 0.06;
	METALLIC = 0.0;
	SPECULAR = 0.9;
	CLEARCOAT = 1.0;
	CLEARCOAT_ROUGHNESS = 0.02;
	// meio transparente no corpo, mais opaco na borda e na ponta
	ALPHA = clamp(0.72 + fres * 0.28 + COLOR.r * 0.0, 0.0, 1.0);
	// ponta acesa (a cor do vértice da ponta é branca: canal g alto), pulsando devagar
	float ponta = smoothstep(0.6, 1.0, COLOR.g) * (0.65 + 0.35 * sin(TIME * 1.3 + p_obj.x * 6.0 + p_obj.z * 4.0));
	// faíscas: pontinhos que acendem e somem rápido (não ficam parados)
	float faisca = step(0.985, ruido(p_obj * 38.0 + vec3(TIME * 2.5)));
	EMISSION = c * brilho * (0.55 + nuvem * 0.6) + brilho_cor * fres * 0.45 + vec3(0.85, 0.8, 1.0) * ponta * 0.9 + vec3(1.0) * faisca * 1.6;
}

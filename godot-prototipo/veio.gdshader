shader_type spatial;
render_mode diffuse_toon, specular_toon; // mesmo degrau de sombra das outras pedras da vila
// Pedra dos veios (Parte 3): a textura da rocha da vila, com o minério correndo por dentro dela.
// tipo 0 = cobre (veios de cobre metálico com manchas verdes de malaquita), 1 = ferro (rocha escura com faixas
// de ferrugem e brilho de metal), 2 = cristal (rocha clara, os cristais são malhas à parte).
// "cheio" vai a 0 quando o veio esgota: o minério some e fica só a pedra.
// Tudo calculado no espaço do objeto (o veio não "escorre" quando a pedra gira) e sem textura extra.

uniform sampler2D tex_pedra : source_color, filter_linear_mipmap, repeat_enable;
uniform int tipo = 0;
uniform float cheio : hint_range(0.0, 1.0) = 1.0;
uniform float semente = 0.0;
uniform vec3 cor_pedra : source_color = vec3(0.42, 0.38, 0.34);
uniform vec3 cor_veio : source_color = vec3(0.86, 0.47, 0.26);
uniform vec3 cor_mancha : source_color = vec3(0.18, 0.72, 0.62);
uniform float escala = 1.6;
uniform float relevo = 0.07;

varying vec3 p_obj;
varying float veio_v;

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
float fbm(vec3 p) {
	return ruido(p) * 0.55 + ruido(p * 2.1) * 0.3 + ruido(p * 4.3) * 0.15;
}
// veio: faixa fina onde o ruído passa por 0,5 (ridged), torta por um segundo ruído
float veio(vec3 p, float largura) {
	vec3 q = p * escala + vec3(semente);
	q += vec3(fbm(q * 0.7 + 3.1), fbm(q * 0.7 + 7.7), fbm(q * 0.7 + 1.3)) * 1.4;
	float r = abs(fbm(q) - 0.5);
	return 1.0 - smoothstep(largura * 0.4, largura, r);
}
// uns 30% da pedra ficam sem veio (rocha com veio, não rocha toda pintada)
float regiao(vec3 p) {
	return smoothstep(0.4, 0.52, fbm(p * 0.8 + vec3(semente * 0.37)));
}
float forca_veio_bruta(vec3 p) {
	if (tipo == 0) {
		// cobre nativo: veios finos e caroços grossos onde eles se cruzam
		float fino = max(veio(p, 0.035), veio(p * 1.7 + 5.0, 0.022) * 0.85);
		float caroco = smoothstep(0.6, 0.68, fbm(p * 2.6 + semente + 4.0)) * smoothstep(0.0, 0.6, veio(p, 0.14));
		return max(fino, caroco);
	}
	if (tipo == 1) return veio(p, 0.03);
	return 0.0;
}

float forca_veio(vec3 p) {
	return forca_veio_bruta(p) * regiao(p);
}

void vertex() {
	p_obj = VERTEX;
	veio_v = forca_veio(VERTEX) * cheio;
	// o cobre sobe para fora da pedra (pepita grossa); o ferro quase não
	VERTEX += NORMAL * veio_v * (tipo == 0 ? relevo : relevo * 0.35);
}

void fragment() {
	vec3 rocha = texture(tex_pedra, UV).rgb;
	float lum = dot(rocha, vec3(0.3, 0.55, 0.15));
	// a pedra pega a cor do tipo, mas o desenho da textura e manchas de relevo continuam aparecendo
	vec3 base = mix(rocha, cor_pedra * (0.4 + lum * 1.2), 0.7) * (0.6 + 0.75 * fbm(p_obj * 6.0 + semente));
	float v = forca_veio(p_obj) * cheio;
	float rough = 0.85;
	float metal = 0.0;
	vec3 cor = base;
	if (tipo == 0) {
		// cobre: metal alaranjado com variação (manchas mais escuras e mais claras)
		float var_c = fbm(p_obj * 9.0 + semente);
		vec3 cobre = cor_veio * (0.75 + var_c * 0.55);
		cor = mix(base, cobre, v);
		metal = v * 0.9;
		rough = mix(0.85, 0.32, v);
		// malaquita: pontinhos verdes perto do veio
		float m = smoothstep(0.66, 0.74, fbm(p_obj * 7.0 + semente + 11.0)) * smoothstep(0.0, 0.5, veio(p_obj, 0.1)) * cheio * regiao(p_obj);
		cor = mix(cor, cor_mancha * (0.8 + var_c * 0.4), m * (1.0 - v));
	} else if (tipo == 1) {
		// ferro: ferrugem larga e suja em volta, metal cinza brilhante no meio da faixa
		float halo = max(veio(p_obj, 0.065), veio(p_obj * 1.4 + 9.0, 0.035)) * cheio * regiao(p_obj);
		float sujo = fbm(p_obj * 11.0 + semente);
		cor = mix(base, cor_mancha * (0.45 + sujo * 0.6), halo * 0.75 * smoothstep(0.35, 0.7, sujo + 0.25));
		cor = mix(cor, cor_veio * (0.8 + sujo * 0.4), v);
		metal = v * 0.85;
		rough = mix(0.85, 0.38, v);
	}
	ALBEDO = cor;
	METALLIC = metal;
	ROUGHNESS = rough;
	SPECULAR = 0.5;
	// brilho próprio fraquinho no metal: aparece também na sombra
	EMISSION = (tipo == 0) ? cor * v * 0.1 : vec3(0.0);
}

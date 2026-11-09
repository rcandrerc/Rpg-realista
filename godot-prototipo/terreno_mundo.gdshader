shader_type spatial;
render_mode diffuse_toon, specular_disabled;
// Chão do mundo grande (FASE 3, mundo_terreno.gd): os continentes e a ilha em volta do mapa de hoje. Mesmas faixas da
// montanha (grama pintada no plano, cascalho nas encostas médias, rocha nos paredões) e uma praia de areia na beira do
// mar, com a areia molhada mais escura rente à água.
uniform sampler2D grama_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D pedra_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D areia_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D terra_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec3 tom_grama : source_color = vec3(0.91, 0.94, 0.85);
uniform vec3 tom_areia : source_color = vec3(1.18, 1.08, 0.86);
uniform float alto = 22.0;
uniform float praia = 1.1; // até essa altura é areia
// 2026-11-09: estradas e trilhas vêm da máscara de 1 m (relevo/mundo_mascara.png, R), com a borda macia dos dois lados
uniform sampler2D mascara_mundo : filter_linear, repeat_disable;
uniform vec4 mascara_area = vec4(-260.5, -320.5, 1441.0, 741.0);
uniform float com_mascara = 0.0;
// boca da caverna do mundo grande montada agora (caverna.gd _corte_na_montanha): não desenha o que fica dentro do vão
// do arco (a mesma conta do montanha.gdshader)
uniform float boca_on = 0.0;
uniform vec3 boca_o = vec3(0.0);
uniform vec2 boca_d = vec2(1.0, 0.0);
uniform vec2 boca_w = vec2(2.9, 2.4);
uniform vec2 boca_h = vec2(4.6, 4.2);
uniform float boca_incl = 0.0;
uniform float boca_fora = 6.7;
uniform float boca_ate = 10.0;
varying vec3 mundo;
varying vec3 nm;
varying float estrada;
varying float rio;
void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	nm = NORMAL;
	estrada = COLOR.r;
	rio = COLOR.g;
}
vec3 tri(vec3 p, vec3 b, float esc) {
	return texture(pedra_tex, p.zy / esc).rgb * b.x + texture(pedra_tex, p.xz / esc).rgb * b.y + texture(pedra_tex, p.xy / esc).rgb * b.z;
}
void fragment() {
	if (boca_on > 0.5) {
		vec2 r = mundo.xz - boca_o.xz;
		float t = dot(r, boca_d);
		float u = dot(r, vec2(-boca_d.y, boca_d.x));
		if (t > 0.12 && t < boca_ate) {
			float k = smoothstep(0.0, 4.0, t);
			float W = mix(boca_w.x, boca_w.y, k), H = mix(boca_h.x, boca_h.y, k);
			float yf = boca_o.y + boca_incl * (1.0 - k) * u;
			float a = clamp(abs(u) / W, 0.0, 1.0);
			float teto = H * pow(max(0.0, 1.0 - a * a), 0.36);
			if (abs(u) < W * 0.995 && mundo.y > yf - 0.5 && mundo.y < yf + teto * 0.995) discard;
		}
	}
	vec3 n = normalize(nm);
	vec2 w = vec2(mundo.x, -mundo.z);
	vec3 grama = texture(grama_tex, w * (70.0 / 320.0)).rgb * tom_grama;
	vec3 b = pow(abs(n), vec3(4.0));
	b /= b.x + b.y + b.z;
	vec3 base = tri(mundo, b, 4.0);
	vec3 det = tri(mundo, b, 0.5);
	vec3 pedra = base * (0.75 + 0.5 * dot(det, vec3(0.333)));
	float hk = clamp(mundo.y / alto, 0.0, 1.0);
	float incl = 1.0 - n.y;
	float ruido = texture(pedra_tex, w / 37.0).g;
	float ruido2 = texture(pedra_tex, w / 11.0).r;
	float pr = smoothstep(0.2, 0.36, incl + (ruido - 0.5) * 0.25 + smoothstep(0.45, 0.8, hk) * 0.3);
	float talus = smoothstep(0.12, 0.25, incl) * (1.0 - smoothstep(0.42, 0.6, incl));
	vec3 cascalho = mix(base, det, 0.6) * vec3(1.12, 1.1, 1.04) * (0.85 + 0.3 * ruido2);
	vec3 g = mix(grama, grama * vec3(1.08, 1.0, 0.78), smoothstep(0.35, 0.8, hk));
	vec3 rocha = mix(pedra, cascalho, talus * smoothstep(0.35, 0.55, ruido2 + 0.2));
	rocha *= mix(1.0, 0.78, smoothstep(0.45, 0.78, incl));
	vec3 c = mix(g, rocha, pr);
	// praia: areia que entra na grama em ondas; rente à água (e embaixo dela) a areia molhada escurece
	vec3 areia = texture(areia_tex, w / 3.0).rgb * tom_areia * (0.92 + 0.16 * ruido2);
	float ka = 1.0 - smoothstep(praia - 0.35, praia + 0.25, mundo.y + (ruido - 0.5) * 0.6);
	areia = mix(areia, areia * vec3(0.62, 0.6, 0.58), 1.0 - smoothstep(-0.1, 0.35, mundo.y));
	c = mix(c, areia, ka * (1.0 - pr * 0.7));
	// estrada de terra batida (shared/mundo.js), com a borda comida pela grama
	float est = estrada;
	if (com_mascara > 0.5) est = texture(mascara_mundo, (mundo.xz - mascara_area.xy) / mascara_area.zw).r;
	float ke = smoothstep(0.3, 0.75, est + (ruido2 - 0.5) * 0.4 + (texture(terra_tex, w / 0.9).g - 0.4) * 0.25);
	c = mix(c, texture(terra_tex, w / 3.2).rgb * 0.82, ke);
	// leito e barranco do rio (Parte 4b): seixo e cascalho molhado, mais escuro no fundo
	float kr = smoothstep(0.25, 0.7, rio + (ruido2 - 0.5) * 0.3);
	c = mix(c, cascalho * mix(0.85, 0.55, smoothstep(0.6, 1.0, rio)), kr);
	ALBEDO = c;
	ROUGHNESS = mix(1.0, 0.55, kr * smoothstep(0.6, 1.0, rio));
}

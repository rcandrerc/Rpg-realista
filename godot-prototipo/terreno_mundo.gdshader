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
uniform float praia = 1.3; // até essa altura é areia (2026-11-09: 1,1 -> 1,3, prainha mais larga no mar)
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
// sombra pintada das árvores (visual_leve.gd, Sombras "Leves"): mapa do mundo, 1 px por metro, 1 = sol
uniform sampler2D sombra_mapa : filter_linear, repeat_disable;
uniform vec4 sombra_area = vec4(0.0, 0.0, 1.0, 1.0);
uniform float sombra_forca = 0.0;
varying vec3 mundo;
// R = copas (com manchinhas de sol entre as folhas, ruído no chão), G = casas (sombra lisa)
float sp_ruido(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5);
	float b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5);
	float c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5);
	float d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5);
	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float sombra_pintada(vec2 xz) {
	if (sombra_forca <= 0.0) return 1.0;
	vec2 uv = (xz - sombra_area.xy) / sombra_area.zw;
	if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) return 1.0;
	vec2 s = textureLod(sombra_mapa, uv, 0.0).rg;
	float copa = 1.0 - s.r;
	if (copa > 0.01) {
		float n = sp_ruido(xz * 1.35) * 0.65 + sp_ruido(xz * 3.1 + 7.3) * 0.35;
		copa *= clamp(0.35 + 1.1 * smoothstep(0.25, 0.75, n), 0.0, 1.1);
	}
	return 1.0 - clamp(copa + (1.0 - s.g), 0.0, 0.72) * sombra_forca;
}
varying vec3 nm;
varying float estrada;
varying float rio;
void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	nm = NORMAL;
	estrada = COLOR.r;
	rio = COLOR.g;
}
// (leveza 2026-11-10) no chão quase plano só a projeção de cima conta: as dos lados só são lidas onde pesam
vec3 tri(vec3 p, vec3 b, float esc) {
	vec3 c = texture(pedra_tex, p.xz / esc).rgb * b.y;
	float s = b.y;
	if (b.x > 0.02) { c += texture(pedra_tex, p.zy / esc).rgb * b.x; s += b.x; }
	if (b.z > 0.02) { c += texture(pedra_tex, p.xy / esc).rgb * b.z; s += b.z; }
	return c / s;
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
	float hk = clamp(mundo.y / alto, 0.0, 1.0);
	float incl = 1.0 - n.y;
	float ruido = texture(pedra_tex, w / 37.0).g;
	float ruido2 = texture(pedra_tex, w / 11.0).r;
	float pr = smoothstep(0.2, 0.36, incl + (ruido - 0.5) * 0.25 + smoothstep(0.45, 0.8, hk) * 0.3);
	float talus = smoothstep(0.12, 0.25, incl) * (1.0 - smoothstep(0.42, 0.6, incl));
	float kr = smoothstep(0.25, 0.7, rio + (ruido2 - 0.5) * 0.3);
	// (leveza 2026-11-10) rocha e cascalho (6 a 12 leituras) só onde aparecem: na grama plana não lê nada disso
	vec3 cascalho = vec3(0.0);
	vec3 rocha = vec3(0.0);
	if (pr > 0.001 || kr > 0.001) {
		vec3 base = tri(mundo, b, 4.0);
		vec3 det = tri(mundo, b, 0.5);
		vec3 pedra = base * (0.75 + 0.5 * dot(det, vec3(0.333)));
		cascalho = mix(base, det, 0.6) * vec3(1.12, 1.1, 1.04) * (0.85 + 0.3 * ruido2);
		rocha = mix(pedra, cascalho, talus * smoothstep(0.35, 0.55, ruido2 + 0.2));
		rocha *= mix(1.0, 0.78, smoothstep(0.45, 0.78, incl));
	}
	vec3 g = mix(grama, grama * vec3(1.08, 1.0, 0.78), smoothstep(0.35, 0.8, hk));
	// 2026-11-09 (André: "como na estradinha: a grama vai ficando mais clarinha e a faixa em volta cor de terra, uma
	// prainha"): antes da areia do mar e na beira dos rios a grama clareia (seca, amarelada) numa faixa larga e macia
	float kc = 1.0 - smoothstep(praia + 0.3, praia + 2.2, mundo.y + (ruido - 0.5) * 1.1);
	kc = max(kc, smoothstep(0.02, 0.22, rio + (ruido2 - 0.5) * 0.15));
	g = mix(g, g * vec3(1.22, 1.16, 0.86) + vec3(0.05, 0.04, 0.0), kc * 0.85);
	vec3 c = mix(g, rocha, pr);
	// praia: faixa de terra/areia que entra na grama em ondas; rente à água (e embaixo dela) a areia molhada escurece
	float ka = 1.0 - smoothstep(praia - 0.35, praia + 0.25, mundo.y + (ruido - 0.5) * 0.6);
	if (ka > 0.001) {
		vec3 areia = texture(areia_tex, w / 3.0).rgb * tom_areia * (0.92 + 0.16 * ruido2);
		areia = mix(areia, vec3(dot(areia, vec3(0.333))) * vec3(1.12, 1.02, 0.86), 0.35); // menos alaranjada (prainha)
		// (2026-11-09, André: sem a faixa escura molhada rente à água, parecia borda de piscina; só embaixo d'água escurece)
		c = mix(c, areia, ka * (1.0 - pr * 0.7));
	}
	// estrada de terra batida (shared/mundo.js), com a borda comida pela grama
	float est = estrada;
	if (com_mascara > 0.5) est = texture(mascara_mundo, (mundo.xz - mascara_area.xy) / mascara_area.zw).r;
	// (leveza 2026-11-10) longe da estrada a terra nem é lida (a borda comida chega a no máximo +0,35)
	if (est + (ruido2 - 0.5) * 0.4 + 0.15 > 0.3) {
		float ke = smoothstep(0.3, 0.75, est + (ruido2 - 0.5) * 0.4 + (texture(terra_tex, w / 0.9).g - 0.4) * 0.25);
		c = mix(c, texture(terra_tex, w / 3.2).rgb * 0.82, ke);
	}
	// leito e barranco do rio (Parte 4b): seixo e cascalho molhado, mais escuro no fundo
	c = mix(c, cascalho * mix(0.85, 0.55, smoothstep(0.6, 1.0, rio)), kr);
	// 2026-11-09: embaixo da água o fundo escurece e esverdeia com a fundura (a água do agua.gdshader é translúcida
	// no raso: sem isso a areia do fundo parecia praia seca com o barco em cima)
	float sub = -0.05 - mundo.y;
	c *= mix(vec3(1.0), vec3(0.5, 0.68, 0.7), smoothstep(-0.02, 1.2, sub));
	ALBEDO = c * sombra_pintada(mundo.xz);
	ROUGHNESS = mix(1.0, 0.55, max(kr * smoothstep(0.6, 1.0, rio), smoothstep(-0.3, 0.0, sub)));
}

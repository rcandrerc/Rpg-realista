shader_type spatial;
render_mode diffuse_toon, specular_disabled;
// Chão da vila como no site: grama pintada, e a máscara da vila mistura trilhas de terra e a praça de pedra
uniform sampler2D grama_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D terra_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D pedra_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D mascara : filter_linear, repeat_disable;
// as mesmas fotos lidas sem conversão de cor: a borda da trilha usa o brilho linear, como no site
uniform sampler2D grama_cru : filter_linear_mipmap, repeat_enable;
uniform sampler2D pedra_cru : filter_linear_mipmap, repeat_enable;
uniform vec3 area = vec3(-30.0, -34.0, 56.0);
uniform vec3 tom_grama : source_color = vec3(0.91, 0.94, 0.85);
// lagos (relevo.gd): o chão plano abre um buraco onde tem água (a mesma margem de shared/relevo.js) e, em volta, pinta a
// beira (2026-11-06, André: "a grama vindo, ficando mais clara, e no final aquela cor de terra em volta do lago"):
// grama que clareia e uma faixa de terra rente à água, com a largura variando ao longo da margem.
// lago_a = (x, z, rx, rz); lago_g = (giro, 1 = lago existe, -, -); lago_l[4 i + j] = lobo j do lago i (k, amplitude, fase)
uniform vec4 lago_a[8];
uniform vec4 lago_g[8];
uniform vec4 lago_l[32];
// beira: (terra mín, terra máx, clara mín, clara máx) em metros (shared/relevo.js BEIRA)
uniform vec4 beira = vec4(0.4, 1.6, 2.5, 5.0);
// chão de longe (relevo.gd, direção de arte): passando de ~75 m da câmera, a máscara longe_tex (R = mata, G = trilha)
// pinta a copa vista de cima com a textura da folha das árvores e as trilhas em terra a 50%; fora da máscara é mata.
// Da altura do herói isso fica na névoa; do alto da montanha vira a mata vista de longe, até o horizonte.
uniform sampler2D longe_tex : filter_linear, repeat_disable;
uniform sampler2D folha_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec3 longe_area = vec3(-64.0, -146.0, 412.0);
uniform float longe_ligado = 0.0;
varying vec3 mundo;
void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	// distância (m) até a margem do lago mais perto, por fora da água (99 = longe de todos)
	float dist_agua = 99.0;
	for (int i = 0; i < 8; i++) {
		if (lago_g[i].y < 0.5) continue;
		vec2 d = mundo.xz - lago_a[i].xy;
		float R = max(lago_a[i].z, lago_a[i].w) * 1.4 + beira.y + beira.w;
		if (abs(d.x) > R || abs(d.y) > R) continue;
		float cg = cos(lago_g[i].x), sg = sin(lago_g[i].x);
		float u = d.x * cg + d.y * sg, v = -d.x * sg + d.y * cg;
		float ang = atan(v / lago_a[i].w, u / lago_a[i].z);
		float k = 1.0;
		for (int j = 0; j < 4; j++) {
			vec4 l = lago_l[i * 4 + j];
			k *= 1.0 + l.y * sin(l.x * ang + l.z);
		}
		float q = length(vec2(u / lago_a[i].z, v / lago_a[i].w)) / k;
		if (q < 1.0) discard;
		dist_agua = min(dist_agua, length(vec2(u, v)) * (1.0 - 1.0 / q));
	}
	vec2 w = vec2(mundo.x, -mundo.z);
	vec3 g0 = texture(grama_tex, w * (70.0 / 320.0)).rgb;
	vec3 grama = g0 * tom_grama;
	vec3 terra = texture(terra_tex, w / 3.2).rgb * 0.82;
	vec3 p0 = texture(pedra_tex, w / 2.6).rgb;
	vec3 pedra = p0 * 0.8 * 0.5;
	vec2 mk = texture(mascara, (mundo.xz - area.xy) / area.z).rg;
	float lum = dot(pow(texture(grama_cru, w * (70.0 / 320.0)).rgb, vec3(2.2)), vec3(0.6));
	float pt = smoothstep(0.3, 0.62, mk.r + (lum - 0.3) * 1.4);
	float pp = smoothstep(0.35, 0.6, mk.g + (dot(pow(texture(pedra_cru, w / 2.6).rgb, vec3(2.2)), vec3(0.5)) - 0.15) * 0.8);
	vec3 c = mix(grama, terra, pt);
	c = mix(c, pedra * 1.6, pp);
	if (dist_agua < beira.y + beira.w) {
		// largura da faixa muda devagar ao longo da margem (manchas grandes da grama crua) e a borda sai quebrada
		float var1 = smoothstep(0.25, 0.65, texture(grama_cru, w / 23.0 + 0.37).g);
		float var2 = smoothstep(0.25, 0.65, texture(grama_cru, w / 17.0 + 0.71).r);
		float quebra = (lum - 0.3) * 0.9 + (texture(grama_cru, w / 4.3 + 0.13).g - 0.45) * 1.1;
		float lt = mix(beira.x, beira.y, var1 * var1);
		float lc = lt + mix(beira.z, beira.w, var2);
		vec3 clara = mix(grama, vec3(0.76, 0.74, 0.46) * (0.85 + lum * 0.5), 0.45); // grama mais rala e seca: clareia e amarela
		vec3 seca = terra * vec3(1.04, 1.0, 0.94);
		vec3 molhada = terra * vec3(0.62, 0.58, 0.54);
		float fc = 1.0 - smoothstep(lt, lc, dist_agua + quebra * 0.8);
		float ft = 1.0 - smoothstep(lt - 0.25, lt + 0.15, dist_agua + quebra * 0.6);
		float fm = 1.0 - smoothstep(0.08, 0.45, dist_agua + quebra * 0.2);
		vec3 b = mix(c, clara, fc * (0.65 + 0.35 * var2));
		b = mix(b, seca, ft);
		b = mix(b, molhada, fm);
		c = b;
	}
	if (longe_ligado > 0.5) {
		float longe = smoothstep(72.0, 92.0, distance(mundo.xz, CAMERA_POSITION_WORLD.xz));
		if (longe > 0.0) {
			vec2 uv = (mundo.xz - longe_area.xy) / longe_area.z;
			vec2 mk2 = texture(longe_tex, clamp(uv, vec2(0.002), vec2(0.998))).rg;
			// saindo do quadrado da máscara: mata fechada, com a passagem macia em ~4% da borda
			vec2 fora = max(-uv, uv - 1.0);
			float f = smoothstep(-0.04, 0.0, max(fora.x, fora.y));
			mk2 = mix(mk2, vec2(1.0, 0.0), f);
			// copa de cima: a folha das árvores em dois tamanhos e manchas grandes de luz e sombra (nada de bolinha)
			// manchas em escalas sem múltiplo comum e giradas: de longe não aparece a grade da repetição
			vec2 wr = mat2(vec2(0.8, 0.6), vec2(-0.6, 0.8)) * w;
			float mancha = texture(grama_cru, wr / 53.0).g * 0.5 + texture(grama_cru, w / 171.0 + 0.21).g * 0.5;
			mancha = smoothstep(0.15, 0.75, mancha);
			vec3 folha = texture(folha_tex, w / 3.1).rgb * 0.5 + texture(folha_tex, wr / 13.7 + 0.37).rgb * 0.5;
			folha *= vec3(0.55, 0.66, 0.45) * (0.6 + 0.55 * mancha);
			vec3 cf = mix(c, terra, mk2.g * 0.5);
			cf = mix(cf, folha, smoothstep(0.05, 0.6, mk2.r));
			c = mix(c, cf, longe);
		}
	}
	ALBEDO = c;
	ROUGHNESS = 1.0;
}

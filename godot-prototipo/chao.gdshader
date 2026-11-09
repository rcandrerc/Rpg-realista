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
// lago_a = (x, z, rx, rz); lago_g = (giro, 1 = lago existe, faixa de terra mín, máx em m); lago_l[4 i + j] = lobo j do lago i (k, amplitude, fase)
uniform vec4 lago_a[8];
uniform vec4 lago_g[8];
uniform vec4 lago_l[32];
// beira: (-, -, grama clara mín, máx) em metros (shared/relevo.js BEIRA); a terra de cada lago vem em lago_g.zw
uniform vec4 beira = vec4(0.0, 3.0, 0.3, 0.6);
// prainhas (direção de arte 2026-11-06): trechos de terra larga numa parte da margem: (x, z, raio da mancha, largura)
uniform vec4 prainha[2];
// ruído de valor (de 0 a 1) para a faixa variar ao longo da margem e os tufos de grama entrarem na terra
float ruido_v(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5);
	float b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5);
	float c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5);
	float d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5);
	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
// chão de longe (relevo.gd, direção de arte): passando de ~75 m da câmera, a máscara longe_tex (R = mata, G = trilha)
// pinta a copa vista de cima com a textura da folha das árvores e as trilhas em terra a 50%; fora da máscara é mata.
// Da altura do herói isso fica na névoa; do alto da montanha vira a mata vista de longe, até o horizonte.
uniform sampler2D longe_tex : filter_linear, repeat_disable;
uniform sampler2D folha_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec3 longe_area = vec3(-64.0, -146.0, 412.0);
uniform float longe_ligado = 0.0;
// 2026-11-09 (FASE 3): máscara do mundo grande (relevo/mundo_mascara.png, 1 px por metro). B = onde a grade do mundo é o
// mapa de hoje: fora disso o chão plano some e quem aparece é o chão do mundo (nada de quadrado do mapa antigo).
// R = estradas e trilhas do mundo, que entram no mapa de hoje com a mesma borda macia.
uniform sampler2D mascara_mundo : filter_linear, repeat_disable;
uniform vec4 mascara_area = vec4(-260.5, -320.5, 1441.0, 741.0);
uniform float com_mascara = 0.0;
varying vec3 mundo;
void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	vec3 mm = vec3(0.0, 0.0, 1.0);
	if (com_mascara > 0.5) {
		mm = texture(mascara_mundo, (mundo.xz - mascara_area.xy) / mascara_area.zw).rgb;
		if (mm.b < 0.5) discard;
	}
	// distância (m) até a margem do lago mais perto, por fora da água (99 = longe de todos)
	float dist_agua = 99.0;
	vec2 faixa = vec2(0.3, 1.2); // terra mín e máx do lago mais perto
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
		float dq = length(vec2(u, v)) * (1.0 - 1.0 / q);
		if (dq < dist_agua) {
			dist_agua = dq;
			faixa = lago_g[i].zw;
		}
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
	// estrada do mundo chegando no mapa de hoje: a mesma terra e a mesma borda do chão do mundo
	c = mix(c, terra, smoothstep(0.3, 0.75, mm.r + (lum - 0.3) * 0.8));
	if (dist_agua < beira.y + beira.w) {
		// direção de arte 2026-11-06: largura da terra proporcional ao lago, variando devagar (1 ciclo a cada ~7 m), e em
		// ~30% da margem a faixa some (a grama chega na terra molhada); mistura grama -> terra quebrada em tufos de ~0,4 m
		vec2 pm = mundo.xz;
		float n1 = ruido_v(pm / 7.0 + 3.1);
		float n2 = ruido_v(pm / 6.3 + 17.7);
		float lt = mix(faixa.x, faixa.y, n1) * smoothstep(0.28, 0.42, n2);
		for (int j = 0; j < 2; j++) {
			if (prainha[j].z <= 0.0) continue;
			float pr = 1.0 - smoothstep(prainha[j].z * 0.5, prainha[j].z, distance(pm, prainha[j].xy) + (n1 - 0.5) * 3.0);
			lt = max(lt, prainha[j].w * pr);
		}
		float tufo = (ruido_v(pm / 0.42) - 0.5) * 0.45 + (ruido_v(pm / 0.17 + 5.3) - 0.5) * 0.15;
		float lc = lt + mix(beira.z, beira.w, ruido_v(pm / 5.0 + 9.4));
		// terra e cascalho fino (textura 2x menor), sem o vermelho: seca 6b5a40 e molhada 3f3426, com o desenho da textura
		float tl = dot(texture(terra_tex, w / 1.6).rgb, vec3(0.3, 0.5, 0.2));
		float det = clamp(0.55 + tl * 3.2, 0.6, 1.45);
		// 2026-11-09 (André): a terra cor de prainha (mais clara) e a molhada sem o contorno preto; a grama clareia
		// de verdade numa faixa larga antes da terra (como na beira da estrada)
		vec3 seca = vec3(0.2, 0.152, 0.088) * det;
		vec3 molhada = vec3(0.11, 0.083, 0.054) * det;
		vec3 clara = grama * vec3(1.24, 1.19, 0.86) + vec3(0.04, 0.035, 0.0); // mais clara e amarelada
		float fc = 1.0 - smoothstep(lt, lc, dist_agua + tufo * 0.5);
		float ft = 1.0 - smoothstep(lt - 0.2, lt + 0.2, dist_agua + tufo);
		float fm = 1.0 - smoothstep(0.05, 0.22, dist_agua + tufo * 0.25);
		vec3 b = mix(c, clara, fc * 0.9);
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

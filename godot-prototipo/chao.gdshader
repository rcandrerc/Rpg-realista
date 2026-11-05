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
// lagos (relevo.gd): o chão plano abre um buraco onde tem água (a mesma margem de shared/relevo.js)
// a = (x, z, rx, rz); b = (giro, k1, amplitude1, fase1); c = (k2, amplitude2, fase2, 1 = lago existe)
uniform vec4 lago_a[6];
uniform vec4 lago_b[6];
uniform vec4 lago_c[6];
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
	for (int i = 0; i < 6; i++) {
		if (lago_c[i].w < 0.5) continue;
		vec2 d = mundo.xz - lago_a[i].xy;
		float R = max(lago_a[i].z, lago_a[i].w) * 1.25;
		if (abs(d.x) > R || abs(d.y) > R) continue;
		float cg = cos(lago_b[i].x), sg = sin(lago_b[i].x);
		float u = d.x * cg + d.y * sg, v = -d.x * sg + d.y * cg;
		float ang = atan(v / lago_a[i].w, u / lago_a[i].z);
		float k = (1.0 + lago_b[i].z * sin(lago_b[i].y * ang + lago_b[i].w)) * (1.0 + lago_c[i].y * sin(lago_c[i].x * ang + lago_c[i].z));
		if (length(vec2(u / lago_a[i].z, v / lago_a[i].w)) / k < 1.0) discard;
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

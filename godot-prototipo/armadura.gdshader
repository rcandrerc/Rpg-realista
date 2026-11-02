// Metal, couro e pano da armadura que aparece no corpo (armadura.gd). Toon de 3 degraus com brilho duro, sem reflexo
// de céu (direção de arte): claro / médio / sombra vêm do script por raridade. Friso dourado na borda das peças.
// UV2.x = distância até a borda da peça (m), UV2.y = coordenada das lâminas (faixas; < -0.5 = sem faixas).
shader_type spatial;
render_mode cull_disabled, ambient_light_disabled, specular_disabled;

uniform vec4 claro : source_color = vec4(0.784, 0.839, 0.91, 1.0);  // #c8d6e8
uniform vec4 medio : source_color = vec4(0.49, 0.576, 0.706, 1.0);  // #7d93b4
uniform vec4 sombra : source_color = vec4(0.243, 0.298, 0.416, 1.0); // #3e4c6a
uniform vec4 friso : source_color = vec4(0.851, 0.647, 0.29, 1.0);   // #d9a54a
uniform vec4 friso_claro : source_color = vec4(0.953, 0.824, 0.478, 1.0); // #f3d27a
uniform float brilho = 0.0; // friso das raridades altas brilha um pouco
uniform float duro = 1.0; // 1 metal (brilho duro), 0 couro e pano
uniform float so_friso = 0.0; // fecho da capa: peça inteira de friso
uniform float faixa = 0.045; // distância entre as lâminas (m)
uniform float junta_y = -1.0; // junta entre peito e barriga (coordenada das faixas)
uniform float ganho = 2.1; // compensa a curva de tom do jogo (ACES 0,68) para as cores chegarem na tela como as da direção de arte

varying float v_dist;
varying float v_seg;
varying float v_friso;
varying float v_esc;

void vertex() {
	v_dist = UV2.x;
	v_seg = UV2.y;
}

void fragment() {
	float f = 1.0 - smoothstep(0.0095, 0.0115, v_dist);
	f = max(f, so_friso);
	float sulco = smoothstep(0.016, 0.0175, v_dist) * (1.0 - smoothstep(0.0195, 0.021, v_dist));
	float lam = 0.0;
	if (v_seg > -0.5) {
		float q = fract(v_seg / faixa);
		lam = (1.0 - smoothstep(0.0, 0.05, q)) * smoothstep(0.03, 0.04, v_dist);
	}
	if (junta_y > 0.0) {
		lam = max(lam, (1.0 - smoothstep(0.004, 0.006, abs(v_seg - junta_y))) * smoothstep(0.03, 0.04, v_dist));
	}
	v_friso = f;
	ALBEDO = vec3(1.0);
	v_esc = 1.0 - 0.6 * max(lam, sulco * (1.0 - f)); // lâminas e sulco escurecem
	EMISSION = friso_claro.rgb * f * brilho * 0.25;
	NORMAL = FRONT_FACING ? NORMAL : -NORMAL;
}

void light() {
	// sombra projetada (cabelo, ombreira) só tira o degrau claro: no aço polido virava manchas
	float ndl = dot(NORMAL, LIGHT);
	float att = ATTENUATION;
	vec3 c1 = mix(claro.rgb, friso_claro.rgb, v_friso);
	vec3 c2 = mix(medio.rgb, friso.rgb, v_friso);
	vec3 c3 = mix(sombra.rgb, friso.rgb * 0.55, v_friso);
	vec3 c = (ndl > 0.55 && att > 0.5) ? c1 : (ndl > -0.12 ? c2 : c3); // sombra só no lado de trás de verdade (luz embrulha um pouco)
	float lc = max(max(LIGHT_COLOR.r, LIGHT_COLOR.g), LIGHT_COLOR.b);
	vec3 tinta = LIGHT_COLOR / max(lc, 0.001);
	DIFFUSE_LIGHT += c * v_esc * mix(vec3(1.0), tinta, 0.35) * ganho;
	// brilho duro do metal
	vec3 h = normalize(LIGHT + VIEW);
	float e = step(0.993, dot(NORMAL, h)) * step(0.1, ndl) * step(0.5, att) * duro;
	DIFFUSE_LIGHT += vec3(e) * 0.5 * ganho;
}

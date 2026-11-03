// Metal, couro e pano da armadura que aparece no corpo (armadura.gd). Toon de 3 degraus com brilho duro, sem reflexo
// de céu (direção de arte): claro / médio / sombra vêm do script por raridade. Friso dourado na borda das peças.
// UV2.x = distância até a borda da peça (m), UV2.y = coordenada das lâminas (faixas; < -0.5 = sem faixas).
// Metal (duro = 1), André 2026-11-03 ("parece roupa de astronauta de plástico"): o aço agora reflete um "céu"
// desenhado em faixas, como metal de anime (céu claro em cima, faixa escura do horizonte, chão no meio-tom),
// com riscos de escovado. A cor da luz só escurece na sombra; o desenho do reflexo é que diz "metal".
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
uniform float luz_ref = 2.83; // LIGHT_COLOR do sol do jogo (cor x energia 0,9 x PI): luz mais fraca soma menos

varying float v_dist;
varying float v_seg;
varying float v_friso;
varying float v_esc;
varying vec3 v_env;
varying vec3 v_pos;
uniform float costura = 0.0; // 1: couro com costura tracejada clara logo dentro do friso (direção de arte v6)

void vertex() {
	v_dist = UV2.x;
	v_seg = UV2.y;
	v_pos = VERTEX;
}

float v_esc_calc(float lam, float sulco, float f) {
	return 1.0 - 0.6 * max(lam, sulco * (1.0 - f));
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
	v_esc = v_esc_calc(lam, sulco, f); // lâminas e sulco escurecem
	float ponto = 0.0;
	if (costura > 0.5) {
		// pontos de ~6 mm a cada 1,2 cm na faixa do sulco (coordenada do modelo: não depende da UV)
		float faixa_c = smoothstep(0.0165, 0.018, v_dist) * (1.0 - smoothstep(0.02, 0.0215, v_dist));
		ponto = faixa_c * step(0.5, fract((v_pos.x + v_pos.y + v_pos.z) * 83.0));
		v_esc = mix(v_esc, 1.0, faixa_c);
	}
	NORMAL = FRONT_FACING ? NORMAL : -NORMAL;
	// reflexo do metal: direção refletida no espaço da câmera (y = para cima)
	vec3 rf = reflect(-VIEW, NORMAL);
	float ry = rf.y;
	// riscos de escovado: o reflexo treme um pouco ao longo da peça
	ry += (fract(sin(dot(floor(vec2(v_seg * 900.0, v_dist * 40.0)), vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.04;
	vec3 env;
	vec3 c1 = mix(claro.rgb, friso_claro.rgb, f);
	vec3 c2 = mix(medio.rgb, friso.rgb, f);
	vec3 c3 = mix(sombra.rgb, friso.rgb * 0.45, f);
	if (ry > 0.42) env = mix(c1, c2, smoothstep(0.5, 0.95, ry) * 0.45); // céu: claro perto do horizonte, mais fundo no alto (o topo do capacete não fica cor de pele)
	else if (ry > 0.08) env = mix(c2, c1, smoothstep(0.30, 0.42, ry));
	else if (ry > -0.12) env = c3; // horizonte escuro: a faixa que faz o aço parecer aço
	else env = mix(c3, c2, smoothstep(-0.12, -0.45, ry) * 0.85); // chão rebatido
	v_env = env * v_esc;
	vec3 base_s = mix(sombra.rgb, friso.rgb * 0.55, f) * v_esc;
	if (duro > 0.5) {
		EMISSION = v_env * ganho * 0.42 + friso_claro.rgb * f * brilho * 0.25;
	} else {
		// base: o tom de sombra entra uma vez só (cada luz soma só o que clareia acima dele)
		EMISSION = base_s * ganho * 0.55 + friso_claro.rgb * f * brilho * 0.25;
		EMISSION = mix(EMISSION, friso_claro.rgb * ganho * 0.5, ponto);
	}
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
	float k = clamp(lc / luz_ref, 0.0, 1.3);
	if (duro > 0.5) {
		// metal: a luz só tira da sombra (no sol o reflexo fica inteiro; na sombra cai para ~45%)
		float sol = (ndl > -0.05 && att > 0.5) ? 1.0 : 0.3;
		DIFFUSE_LIGHT += v_env * 0.58 * sol * mix(vec3(1.0), tinta, 0.35) * ganho * k;
	} else {
		DIFFUSE_LIGHT += max(c - c3 * 0.55, vec3(0.0)) * v_esc * mix(vec3(1.0), tinta, 0.35) * ganho * k;
	}
	// brilho duro do metal
	vec3 h = normalize(LIGHT + VIEW);
	float e = step(0.985, dot(NORMAL, h)) * step(0.1, ndl) * step(0.5, att) * duro;
	DIFFUSE_LIGHT += vec3(e) * 0.9 * ganho * k;
}

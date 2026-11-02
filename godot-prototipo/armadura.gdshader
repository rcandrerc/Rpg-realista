// Metal, pano e couro das roupas que aparecem no corpo (armadura.gd). Estilo pintado: luz em degraus (toon),
// reflexo de céu desenhado (claro em cima, escuro embaixo, linha do horizonte), brilho duro e friso dourado na borda.
// UV2.x = distância até a borda da peça (m), UV2.y = coordenada das lâminas (faixas).
shader_type spatial;
render_mode cull_disabled, diffuse_toon, specular_toon;

uniform vec4 base : source_color = vec4(0.78, 0.84, 0.94, 1.0);
uniform vec4 friso : source_color = vec4(1.0, 0.78, 0.32, 1.0);
uniform float brilho = 0.0; // friso das raridades altas brilha
uniform float tipo = 0.0; // 0 metal, 1 pano, 2 couro
uniform float so_friso = 0.0; // fecho da capa: peça inteira de friso

varying float v_dist;
varying float v_seg;

void vertex() {
	v_dist = UV2.x;
	v_seg = UV2.y;
}

void fragment() {
	vec3 n = FRONT_FACING ? NORMAL : -NORMAL;
	// friso na borda (1,1 cm) e um sulco fino logo depois dele
	float f = 1.0 - smoothstep(0.0095, 0.0115, v_dist);
	float sulco = smoothstep(0.016, 0.0175, v_dist) * (1.0 - smoothstep(0.0195, 0.021, v_dist));
	f = max(f, so_friso);
	// lâminas: linhas finas a cada 4,5 cm (só no metal)
	float lam = 0.0;
	if (tipo < 0.5 && v_seg > -0.5) {
		float q = fract(v_seg / 0.045);
		lam = (1.0 - smoothstep(0.0, 0.06, q)) * smoothstep(0.03, 0.04, v_dist);
	}
	// "céu" refletido pela normal na tela
	float up = n.y;
	vec3 ceu = mix(vec3(0.16, 0.18, 0.26), vec3(0.78, 0.82, 0.9), smoothstep(-0.35, 0.5, up));
	ceu += vec3(0.32) * (1.0 - smoothstep(0.0, 0.07, abs(up - 0.12))); // linha do horizonte
	float esp = smoothstep(0.9, 0.93, dot(n, normalize(vec3(-0.4, 0.55, 0.75))));
	vec3 cor;
	vec3 emis = vec3(0.0);
	if (tipo < 0.5) {
		vec3 metal = base.rgb * ceu;
		vec3 ouro = friso.rgb * mix(vec3(0.55, 0.42, 0.3), vec3(1.25, 1.15, 0.9), smoothstep(-0.3, 0.5, up));
		cor = mix(metal, ouro, f);
		cor *= 1.0 - 0.45 * sulco * (1.0 - f);
		cor *= 1.0 - 0.5 * lam;
		emis = cor * 0.1 + vec3(esp) * 0.5 + friso.rgb * f * brilho * 0.5;
	} else {
		// pano e couro: cor chapada com friso bordado
		float tecido = tipo < 1.5 ? 0.0 : 0.15;
		cor = mix(base.rgb, friso.rgb * 0.9, f);
		cor *= 1.0 - 0.3 * sulco * (1.0 - f);
		emis = cor * 0.06 + vec3(esp) * tecido * 0.4 + friso.rgb * f * brilho * 0.3;
	}
	ALBEDO = cor;
	EMISSION = emis;
	ROUGHNESS = tipo < 0.5 ? 0.35 : 0.9;
	METALLIC = 0.0;
	SPECULAR = tipo < 0.5 ? 0.6 : 0.1;
	RIM = 0.3;
	RIM_TINT = 0.6;
	NORMAL = n;
}

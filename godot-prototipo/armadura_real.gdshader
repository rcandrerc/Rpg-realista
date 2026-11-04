// Armadura v11 (André 2026-11-04, referência de couro e aço): material com cara de peça de verdade, em vez do toon
// de 3 degraus de armadura.gdshader (que continua no projeto). Mesmas entradas (UV2.x = distância até a borda da
// peça, UV2.y = coordenada das lâminas), mesmas cores por raridade:
//   claro = brilho/reflexo do céu, medio = cor da peça, sombra = reflexo escuro; friso = borda; friso_claro = bisel.
// Aço (duro = 1): escovado (riscos finos numa direção), reflexo suave do céu, brilho largo + ponto de luz, borda de
// ferro escuro com bisel claro e rebites. Couro (duro = 0): grão fino, manchas largas, borda gasta mais escura,
// costura tracejada e um brilho fosco.
shader_type spatial;
render_mode cull_disabled, specular_disabled;

uniform vec4 claro : source_color = vec4(0.78, 0.8, 0.83, 1.0);
uniform vec4 medio : source_color = vec4(0.54, 0.56, 0.6, 1.0);
uniform vec4 sombra : source_color = vec4(0.16, 0.17, 0.19, 1.0);
uniform vec4 friso : source_color = vec4(0.2, 0.21, 0.23, 1.0);
uniform vec4 friso_claro : source_color = vec4(0.85, 0.87, 0.9, 1.0);
uniform float brilho = 0.0;
uniform float duro = 1.0;
uniform float so_friso = 0.0;
uniform float faixa = 0.045;
uniform float junta_y = -1.0;
uniform float largura = 0.009; // borda escura (m)
uniform float costura = 0.0;
uniform float rebites = 1.0;
uniform float reflexo = 0.55; // quanto do "céu" o aço reflete (o jogo não tem reflexo de ambiente)
uniform float luz_ref = 2.83;
// não usados aqui, mas o script define (mesmo material serve aos dois shaders)
uniform vec2 horizonte = vec2(-0.12, 0.08);
uniform float chao = 0.33;
uniform float zenite = 0.45;
uniform float crista_esc = 1.0;
uniform float ganho = 2.1;

varying float v_dist;
varying float v_seg;
varying vec3 v_pos;
varying float v_metal;

float hash3(vec3 p) {
	p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float ruido(vec3 x) {
	vec3 i = floor(x);
	vec3 f = fract(x);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 x) {
	float s = 0.0;
	float a = 0.5;
	for (int i = 0; i < 4; i++) {
		s += a * ruido(x);
		x *= 2.03;
		a *= 0.5;
	}
	return s;
}

void vertex() {
	v_dist = UV2.x;
	v_seg = UV2.y;
	v_pos = VERTEX;
}

void fragment() {
	float L = largura;
	float borda = 1.0 - smoothstep(L - 0.0015, L, v_dist); // faixa escura da borda
	borda = max(borda, so_friso);
	float bisel = smoothstep(L - 0.0005, L + 0.0005, v_dist) * (1.0 - smoothstep(L + 0.0015, L + 0.003, v_dist)); // fio claro logo dentro
	// lâminas (sulco escuro entre placas) e junta
	float sulco = 0.0;
	if (v_seg > -0.5) {
		float q = fract(v_seg / faixa);
		sulco = (1.0 - smoothstep(0.0, 0.035, q)) * smoothstep(L + 0.004, L + 0.012, v_dist);
	}
	if (junta_y > 0.0) {
		sulco = max(sulco, (1.0 - smoothstep(0.003, 0.005, abs(v_seg - junta_y))) * smoothstep(L + 0.004, L + 0.012, v_dist));
	}
	vec3 cor;
	float rough;
	if (duro > 0.5) {
		// aço escovado: riscos finos e compridos na horizontal da peça
		float risco = ruido(v_pos * vec3(9.0, 260.0, 9.0)) * 0.6 + ruido(v_pos * vec3(4.0, 120.0, 4.0)) * 0.4;
		float mancha = fbm(v_pos * 7.0);
		cor = medio.rgb * (0.88 + 0.22 * risco) * (0.9 + 0.2 * mancha);
		// desgaste: arranhões claros
		float arranhao = smoothstep(0.78, 0.82, ruido(v_pos * vec3(40.0, 6.0, 40.0) + 3.1));
		cor = mix(cor, claro.rgb, arranhao * 0.25);
		rough = 0.35;
	} else {
		// couro: grão fino + manchas largas + borda gasta
		float grao = ruido(v_pos * 380.0);
		float mancha = fbm(v_pos * 9.0);
		cor = medio.rgb * (0.86 + 0.18 * grao) * (0.8 + 0.4 * mancha);
		cor = mix(cor, sombra.rgb, smoothstep(0.025, 0.0, v_dist) * 0.45); // borda mais escura (gasta, oleosa)
		rough = 0.75;
	}
	cor *= 1.0 - 0.55 * sulco;
	cor = mix(cor, friso.rgb, borda);
	cor = mix(cor, friso_claro.rgb, bisel * duro * 0.6);
	// rebites na borda do aço, a cada ~3 cm (coordenada do modelo)
	if (duro > 0.5 && rebites > 0.5 && so_friso < 0.5) {
		float faixa_r = smoothstep(L + 0.001, L + 0.003, v_dist) * (1.0 - smoothstep(L + 0.009, L + 0.011, v_dist));
		vec3 cel = v_pos * 33.0;
		vec3 c = fract(cel) - 0.5;
		float pino = 1.0 - smoothstep(0.16, 0.22, length(c));
		float r = faixa_r * pino;
		cor = mix(cor, friso_claro.rgb * 0.9, r);
	}
	// costura do couro
	if (costura > 0.5 && duro < 0.5) {
		float fc = smoothstep(L + 0.003, L + 0.0045, v_dist) * (1.0 - smoothstep(L + 0.0055, L + 0.007, v_dist));
		float ponto = step(0.45, fract((v_pos.x + v_pos.y + v_pos.z) * 90.0));
		cor = mix(cor, vec3(0.62, 0.52, 0.38), fc * ponto);
	}
	ALBEDO = cor;
	v_metal = duro;
	NORMAL = FRONT_FACING ? NORMAL : -NORMAL;
	// reflexo do céu no aço (o jogo desliga o reflexo de ambiente): suave, sem faixas duras
	if (duro > 0.5) {
		vec3 rf = reflect(-VIEW, NORMAL);
		float ry = rf.y + (ruido(v_pos * vec3(6.0, 140.0, 6.0)) - 0.5) * 0.08;
		vec3 env = mix(sombra.rgb, claro.rgb, smoothstep(-0.35, 0.55, ry));
		env = mix(env, sombra.rgb * 0.8, (1.0 - smoothstep(-0.05, 0.12, ry)) * smoothstep(-0.3, -0.05, ry) * 0.6); // horizonte
		EMISSION = env * reflexo * (1.0 - borda * 0.7) * (1.0 - 0.5 * sulco) + friso_claro.rgb * borda * brilho * 0.2;
	}
	ROUGHNESS = rough;
}

void light() {
	float ndl = dot(NORMAL, LIGHT);
	float k = clamp(max(max(LIGHT_COLOR.r, LIGHT_COLOR.g), LIGHT_COLOR.b) / luz_ref, 0.0, 1.3);
	// difusa embrulhada (meio-tom macio, sem degrau de desenho)
	float w = clamp((ndl + 0.35) / 1.35, 0.0, 1.0);
	float sombra_proj = mix(0.35, 1.0, ATTENUATION);
	DIFFUSE_LIGHT += LIGHT_COLOR * w * w * sombra_proj * (v_metal > 0.5 ? 0.55 : 0.9) / PI * 2.2;
	vec3 h = normalize(LIGHT + VIEW);
	float nh = max(dot(NORMAL, h), 0.0);
	if (v_metal > 0.5) {
		float largo = pow(nh, 18.0) * 0.35;
		float ponto = pow(nh, 160.0) * 1.4;
		SPECULAR_LIGHT += LIGHT_COLOR * (largo + ponto) * sombra_proj * step(0.0, ndl) * 0.5;
	} else {
		SPECULAR_LIGHT += LIGHT_COLOR * pow(nh, 14.0) * 0.06 * sombra_proj * step(0.0, ndl);
	}
}

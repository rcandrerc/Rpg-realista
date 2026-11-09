shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_disabled, specular_disabled, unshaded, shadows_disabled;
// Água dos lagos e do mar. 2026-11-09 (André: "mais realismo nessa água, as bordas são esquisitas"): continua pintada
// (anime), mas agora com ondinhas de verdade (mapa de normais agua_ondas.png em duas camadas andando), o céu
// refletido pelo ângulo (Fresnel: de perto se vê dentro, de longe vira espelho), o brilho do sol cortado em pontos
// (anime) e a beira com ondinhas de espuma chegando na areia e a água ficando transparente onde é rasa.
// A fundura de cada ponto vem pronta na malha (sem ler a tela, igual em qualquer celular):
// - lagos e mar: UV.x = metros de água (negativo onde o chão já saiu da água: a borda cai no zero certinho)
// - antigo: cor do vértice (COLOR.r x 5 m), se prof_uv for falso
uniform vec3 cor_raso : source_color = vec3(0.2, 0.56, 0.7); // 2026-11-09 (André): mais azul
uniform vec3 cor_fundo : source_color = vec3(0.04, 0.19, 0.42);
uniform vec3 cor_espuma : source_color = vec3(0.93, 0.97, 0.98);
uniform vec3 cor_ceu : source_color = vec3(0.6, 0.78, 0.95); // horizonte refletido
uniform vec3 cor_zenite : source_color = vec3(0.36, 0.58, 0.86); // céu alto refletido
uniform float fundo_lago = 1.0;
uniform bool prof_uv = false;
uniform float escala_fundo = 1.0; // o mar escurece mais devagar que o lago (fundo de verdade)
uniform sampler2D ondas_tex : hint_normal, filter_linear_mipmap, repeat_enable;
uniform float ondas = 1.0; // força das ondinhas (mar um pouco mais mexido)
// sol (não anda: dia_noite.gd manda uma vez) e a noite
uniform vec3 sol_dir = vec3(0.5, 0.62, 0.6);
uniform vec3 sol_cor : source_color = vec3(1.0, 0.95, 0.84);
// reflexo da lua na água à noite (dia_noite.gd manda só quando muda; André 2026-11-08)
uniform float noite = 0.0;
uniform vec3 lua_dir = vec3(0.77, 0.22, 0.44);
// qualidade gráfica Baixa (grafico.gd, André 2026-11-09): sem as ondinhas (2 leituras de textura a menos) e sem os
// riscos de brilho (menos conta por ponto no mar, que cobre boa parte da tela)
uniform bool simples = false;
varying vec3 mundo;
varying float fundura;
void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	fundura = prof_uv ? UV.x : COLOR.r * 5.0;
}
float ruido(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	float a = fract(sin(dot(i, vec2(127.1, 311.7))) * 43758.5);
	float b = fract(sin(dot(i + vec2(1, 0), vec2(127.1, 311.7))) * 43758.5);
	float c = fract(sin(dot(i + vec2(0, 1), vec2(127.1, 311.7))) * 43758.5);
	float d = fract(sin(dot(i + vec2(1, 1), vec2(127.1, 311.7))) * 43758.5);
	return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
void fragment() {
	float prof = fundura;
	float p = max(0.0, prof);
	float t = smoothstep(0.0, 2.6 * escala_fundo, p);
	float dist = length(CAMERA_POSITION_WORLD - mundo);
	float perto = 1.0 - smoothstep(18.0, 160.0, dist); // longe as ondinhas somem (sem chiado na tela do celular)
	// ondinhas: duas camadas do mesmo mapa em escalas e direções diferentes (não se vê a repetição)
	vec2 inc = vec2(0.0);
	if (!simples) {
		vec2 n1 = texture(ondas_tex, mundo.xz * 0.11 + vec2(TIME * 0.021, TIME * 0.009)).xy * 2.0 - 1.0;
		vec2 n2 = texture(ondas_tex, mundo.xz * 0.29 + vec2(-TIME * 0.016, TIME * 0.027)).xy * 2.0 - 1.0;
		inc = (n1 * 0.6 + n2 * 0.4) * ondas * mix(0.25, 0.75, perto) * mix(0.35, 1.0, smoothstep(0.0, 0.6, p));
	}
	vec3 nw = normalize(vec3(inc.x, 1.0, inc.y));
	vec3 olho = normalize(mundo - CAMERA_POSITION_WORLD);
	float cosv = clamp(dot(-olho, nw), 0.0, 1.0);
	float fr = 0.03 + 0.97 * pow(1.0 - cosv, 5.0); // Fresnel (Schlick)
	vec3 r = reflect(olho, nw);
	r.y = abs(r.y);
	vec3 ceu = mix(cor_ceu, cor_zenite, smoothstep(0.02, 0.5, r.y));
	// corpo da água pela fundura; as cristas pegam um pouco mais de luz (a água "acende" onde a onda vira pro sol)
	vec3 c = mix(cor_raso, cor_fundo, t);
	c *= 1.0 + dot(inc, normalize(sol_dir.xz)) * 0.35;
	c = mix(c, ceu, clamp(fr * 0.7, 0.0, 0.7)); // 2026-11-09: reflexo menos forte (a água ficava clara demais)
	// riscos finos de brilho que vêm e vão (desenho de anime, não reflexo de foto)
	float o1 = sin(mundo.x * 0.8 + TIME * 0.9 + sin(mundo.z * 0.55 + TIME * 0.5) * 1.6);
	float o2 = sin(mundo.z * 1.1 - TIME * 0.7 + sin(mundo.x * 0.45 - TIME * 0.3) * 2.0);
	float risco = sin(mundo.x * 0.42 + mundo.z * 0.9 + o1 * 0.5 + TIME * 0.35);
	float brilho = simples ? 0.0 : smoothstep(0.978, 0.995, risco) * smoothstep(0.6, 0.95, o2 * 0.5 + 0.5) * (0.4 + 0.6 * perto);
	if (!simples) {
		brilho *= smoothstep(0.55, 0.8, ruido(mundo.xz * 0.9 + vec2(0.0, TIME * 0.2))); // em pedaços curtos, não arcos longos
	}
	// sol na água: um caminho largo e suave e, por cima, os pontinhos cortados (anime) onde a onda espelha o sol
	float s = max(dot(r, normalize(sol_dir)), 0.0);
	float sol = pow(s, 40.0) * 0.22 + smoothstep(0.988, 0.996, s) * 0.9 * (0.5 + 0.5 * perto);
	// beira: onde a água afina, ondinhas de espuma vêm chegando na areia e quebram em pedaços; rente à areia um fio
	float n = ruido(mundo.xz * 1.4 + vec2(TIME * 0.12, 0.0));
	float chega = sin(p * 11.0 - TIME * 1.25 + n * 2.4);
	float linhas = smoothstep(0.72, 0.96, chega) * (1.0 - smoothstep(0.05, 0.55, p)) * smoothstep(0.3, 0.6, n);
	float fio = (1.0 - smoothstep(0.0, 0.05, prof)) * smoothstep(0.4, 0.6, ruido(mundo.xz * 2.3 - vec2(0.0, TIME * 0.1)));
	float espuma = clamp(max(fio * 0.75, linhas * 0.55), 0.0, 1.0) * mix(0.4, 1.0, perto);
	c = mix(c, cor_espuma, espuma);
	c += sol_cor * sol * (1.0 - noite);
	// noite: a água escurece junto (antes ficava clara, sem luz)
	c *= mix(1.0, 0.3, noite);
	ALBEDO = c;
	// raso translúcido (o leito/areia aparece), fundo fechado; de longe o reflexo fecha a água
	// rente à margem a água afina até sumir (sem a linha dura de piscina): a borda some no zero da fundura
	float rente = smoothstep(-0.01, 0.07, prof);
	ALPHA = clamp((mix(0.6, 0.93, t) + fr * 0.5) * rente + espuma * 0.6 + sol * 0.5, 0.0, 0.96);
	// vista de baixo (mergulhando, André 2026-11-07): a superfície é um teto claro que ondula, com o céu passando
	// 2026-11-09: decide pela altura da câmera, não pelo lado da face (a malha dos lagos vem virada: de cima eles
	// caíam aqui e ficavam com a cor clara chapada da vista de baixo)
	if (CAMERA_POSITION_WORLD.y < mundo.y) {
		vec3 baixo = mix(vec3(0.32, 0.62, 0.66), cor_ceu, 0.35 + (o1 + o2) * 0.12 + inc.x * 0.5);
		ALBEDO = (baixo + brilho * 0.25) * mix(1.0, 0.3, noite);
		ALPHA = 0.7;
	}
	if (noite > 0.01 && CAMERA_POSITION_WORLD.y > mundo.y) {
		// caminho de luz da lua: reflexo na superfície com as ondas quebrando o brilho em pedaços (só vista de cima;
		// fica fora do FRONT_FACING porque no OpenGL do PC a face de cima pode vir como a de trás)
		vec3 rl = reflect(olho, normalize(vec3(o1 * 0.05 + inc.x * 0.5, 1.0, o2 * 0.05 + inc.y * 0.5)));
		float lm = max(dot(rl, normalize(lua_dir)), 0.0);
		float reflexo = pow(lm, 500.0) * 1.3 + pow(lm, 60.0) * 0.12;
		ALBEDO += vec3(0.85, 0.9, 1.0) * reflexo * noite;
		ALPHA = max(ALPHA, min(reflexo * noite, 0.95));
	}
}

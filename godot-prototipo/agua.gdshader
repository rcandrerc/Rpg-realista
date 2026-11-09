shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_disabled, specular_disabled, unshaded;
// Água dos lagos no estilo pintado: verde-água translúcido no raso (o leito aparece) a azul fechado no fundo, pela
// fundura de cada ponto (vem na cor do vértice, relevo.gd: funciona igual em qualquer celular). Espuma só num fio
// quebrado rente à margem, riscos finos de brilho que vêm e vão e um pouco do céu de lado.
uniform vec3 cor_raso : source_color = vec3(0.36, 0.7, 0.64);
uniform vec3 cor_fundo : source_color = vec3(0.08, 0.27, 0.42);
uniform vec3 cor_espuma : source_color = vec3(0.93, 0.97, 0.98);
uniform vec3 cor_ceu : source_color = vec3(0.72, 0.86, 0.96);
uniform float fundo_lago = 1.0;
// reflexo da lua na água à noite (dia_noite.gd manda só quando muda; André 2026-11-08)
uniform float noite = 0.0;
uniform vec3 lua_dir = vec3(0.77, 0.22, 0.44);
// qualidade gráfica Baixa (grafico.gd, André 2026-11-09): sem a espuma quebrada e sem os riscos de brilho (menos conta
// por ponto no mar, que cobre boa parte da tela)
uniform bool simples = false;
varying vec3 mundo;
varying float fundura;
void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	fundura = COLOR.r * 5.0;
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
	float prof = max(0.0, fundura);
	float t = smoothstep(0.0, 2.6, prof);
	vec3 c = mix(cor_raso, cor_fundo, t);
	float o1 = sin(mundo.x * 0.8 + TIME * 0.9 + sin(mundo.z * 0.55 + TIME * 0.5) * 1.6);
	float o2 = sin(mundo.z * 1.1 - TIME * 0.7 + sin(mundo.x * 0.45 - TIME * 0.3) * 2.0);
	c *= 1.0 + (o1 + o2) * 0.025;
	// riscos finos de brilho que vêm e vão (desenho de anime, não reflexo de foto)
	float risco = sin(mundo.x * 0.42 + mundo.z * 0.9 + o1 * 0.5 + TIME * 0.35);
	float brilho = simples ? 0.0 : smoothstep(0.978, 0.995, risco) * smoothstep(0.6, 0.95, o2 * 0.5 + 0.5);
	float fr = pow(1.0 - clamp(abs(dot(NORMAL, VIEW)), 0.0, 1.0), 4.0);
	c = mix(c, cor_ceu, fr * 0.35);
	// espuma: fio de até ~10 cm rente à margem, quebrado em pedaços (não um contorno contínuo)
	float fio = 1.0 - smoothstep(0.0, 0.025, prof);
	float pedacos = simples ? 0.5 : smoothstep(0.45, 0.65, ruido(mundo.xz * 1.6 + vec2(TIME * 0.15, 0.0)));
	float espuma = fio * pedacos * 0.5;
	c = mix(c, cor_espuma, max(espuma, brilho * 0.4));
	ALBEDO = c;
	// raso translúcido (o leito aparece), fundo fechado
	// 2026-11-06 (beira natural): rente à margem a água afina até quase sumir (sem a linha dura de piscina)
	float rente = mix(0.18, 1.0, smoothstep(0.0, 0.3, prof));
	ALPHA = clamp((mix(0.5, 0.9, t) + fr * 0.15) * rente + espuma * 0.3, 0.0, 0.95);
	// vista de baixo (mergulhando, André 2026-11-07): a superfície é um teto claro que ondula, com o céu passando
	if (!FRONT_FACING) {
		vec3 baixo = mix(vec3(0.32, 0.62, 0.66), cor_ceu, 0.35 + (o1 + o2) * 0.12);
		ALBEDO = baixo + brilho * 0.25;
		ALPHA = 0.7;
	}
	if (noite > 0.01 && CAMERA_POSITION_WORLD.y > mundo.y) {
		// caminho de luz da lua: reflexo na superfície com as ondas quebrando o brilho em pedaços (só vista de cima;
		// fica fora do FRONT_FACING porque no OpenGL do PC a face de cima pode vir como a de trás)
		vec3 olho = normalize(mundo - CAMERA_POSITION_WORLD);
		vec3 r = reflect(olho, normalize(vec3(o1 * 0.05, 1.0, o2 * 0.05)));
		float lm = max(dot(r, normalize(lua_dir)), 0.0);
		float reflexo = pow(lm, 500.0) * 1.3 + pow(lm, 60.0) * 0.12;
		ALBEDO += vec3(0.85, 0.9, 1.0) * reflexo * noite;
		ALPHA = max(ALPHA, min(reflexo * noite, 0.95));
	}
}

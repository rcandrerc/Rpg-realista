shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_disabled, specular_disabled, unshaded;
// Água dos lagos no estilo pintado: cor de raso (verde-água) a fundo (azul), pela fundura que se vê embaixo
// (a fundura de cada ponto vem na cor do vértice, relevo.gd: funciona igual em qualquer celular), espuma branca na beira, faixas de brilho que andam devagar e o céu refletido
// de lado. Funda o bastante, o leito some no azul (dá para mergulhar quando vier a natação).
uniform vec3 cor_raso : source_color = vec3(0.42, 0.78, 0.76);
uniform vec3 cor_fundo : source_color = vec3(0.09, 0.31, 0.5);
uniform vec3 cor_espuma : source_color = vec3(0.95, 0.98, 1.0);
uniform vec3 cor_ceu : source_color = vec3(0.78, 0.9, 1.0);
uniform float fundo_lago = 1.0;
varying vec3 mundo;
varying float fundura;
void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	fundura = COLOR.r * 5.0;
}
void fragment() {
	float prof = max(0.0, fundura); // fundura embaixo deste ponto da água
	float t = smoothstep(0.0, 2.6, prof);
	vec3 c = mix(cor_raso, cor_fundo, t);
	// ondinhas: duas ondas cruzadas que andam; onde as duas sobem junto, um risco de brilho (desenho, não foto)
	float o1 = sin(mundo.x * 0.8 + TIME * 0.9 + sin(mundo.z * 0.55 + TIME * 0.5) * 1.6);
	float o2 = sin(mundo.z * 1.1 - TIME * 0.7 + sin(mundo.x * 0.45 - TIME * 0.3) * 2.0);
	// riscos finos de brilho que vêm e vão (desenho de anime, não reflexo de foto)
	float risco = sin(mundo.x * 0.42 + mundo.z * 0.9 + o1 * 0.5 + TIME * 0.35);
	float brilho = smoothstep(0.975, 0.995, risco) * smoothstep(0.55, 0.95, o2 * 0.5 + 0.5);
	c = mix(c, c * 1.08, (o1 + o2) * 0.25 + 0.5);
	// céu refletido quando se olha de lado
	float fr = pow(1.0 - clamp(abs(dot(NORMAL, VIEW)), 0.0, 1.0), 3.0);
	c = mix(c, cor_ceu, fr * 0.55);
	// espuma na beira (onde a água fica rasinha), tremendo de leve
	float beira = 1.0 - smoothstep(0.0, 0.06 + 0.025 * sin(TIME * 1.6 + mundo.x * 1.7 + mundo.z), prof);
	c = mix(c, cor_espuma, max(beira * 0.7, brilho * 0.45));
	ALBEDO = c;
	ALPHA = clamp(0.5 + t * 0.45 + beira * 0.4 + fr * 0.2, 0.0, 0.96);
}

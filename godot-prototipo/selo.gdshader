shader_type spatial;
render_mode unshaded, blend_mix, cull_disabled, depth_draw_never, shadows_disabled;
// Selo da Caverna da Montanha (caverna.gd), v2 da direção de arte (2026-11-06): um véu laranja translúcido no
// formato do arco (alfa 0,3 a 0,45, de ff7a18 embaixo a ffd34a em cima), com o clarão dourado pulsando devagar (1,5 s).
// Sem o círculo de runas desde 2026-11-06 (pedido do André). Sem refração nem ler a tela. Quando o herói usa o passe, o véu some num dissolve (aberto 0 -> 1).
uniform float aberto = 0.0;
uniform float aspecto = 1.0; // largura / altura do arco
uniform vec3 cor_baixo : source_color = vec3(1.0, 0.478, 0.094); // ff7a18
uniform vec3 cor_cima : source_color = vec3(1.0, 0.827, 0.29); // ffd34a
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y);
}
void fragment() {
	vec2 uv = vec2(UV.x, 1.0 - UV.y); // y para cima
	float x = uv.x * 2.0 - 1.0;
	float topo = pow(max(0.0, 1.0 - x * x), 0.375);
	if (uv.y > topo) discard;
	float pulso = 0.7 + 0.3 * sin(TIME * 6.2832 / 1.5);
	// véu: degradê de cor, um pouco mais denso embaixo e nas bordas, com ondas de calor subindo devagar
	vec3 veu = mix(cor_baixo, cor_cima, smoothstep(0.0, 0.9, uv.y));
	float onda = ruido(vec2(uv.x * 6.0, uv.y * 4.0 - TIME * 0.5)) * 0.08;
	float borda = smoothstep(0.1, 0.0, topo - uv.y) + smoothstep(0.85, 1.0, abs(x));
	float alfa = 0.28 + 0.08 * (1.0 - uv.y) + onda + borda * 0.1;
	// dissolve: manchas de ruído somem uma a uma, com a beira acesa
	float n = ruido(uv * vec2(9.0 * aspecto, 9.0)) * 0.7 + ruido(uv * 23.0) * 0.3;
	float corte = aberto * 1.15;
	if (n < corte - 0.02) discard;
	float beira = smoothstep(0.08, 0.0, n - corte) * step(0.001, aberto);
	// 2026-11-06 André: sem o círculo de runas, só a película com o clarão dourado (que pulsa devagar)
	ALBEDO = veu * (0.85 + 0.15 * pulso) + cor_cima * beira * 2.0;
	// véu no máximo 0,45 (dá para ver um pouco do outro lado); a beira do dissolve passa disso
	ALPHA = clamp(min(alfa, 0.45) + beira, 0.0, 1.0) * (1.0 - smoothstep(0.95, 1.0, aberto));
}

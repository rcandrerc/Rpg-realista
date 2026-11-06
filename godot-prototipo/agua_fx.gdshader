shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_disabled, specular_disabled, unshaded, shadows_disabled;
// Contato do corpo com a água (nado, André 2026-11-06; direção de arte): espuma pintada, borda dura, sem degradê de protótipo.
// modo 0 = anel que abre em volta do corpo (raio vai de r0 a r1 com "fase" de 0 a 1 e some)
// modo 1 = rastro em V atrás de quem nada (UV.y: 0 = no corpo, 1 = 2,5 m atrás)
uniform int modo = 0;
uniform float fase = 0.0;
uniform float alfa = 0.4;
uniform float forca = 1.0;
uniform vec3 cor : source_color = vec3(0.95, 0.98, 1.0);
float ruido(vec2 p) {
	return fract(sin(dot(floor(p), vec2(127.1, 311.7))) * 43758.5);
}
void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float a = 0.0;
	if (modo == 0) {
		float r = length(p);
		float raio = mix(0.62, 0.98, fase);
		float largura = mix(0.09, 0.03, fase);
		float anel = step(abs(r - raio), largura);
		// anel quebrado em gomos, como espuma pintada
		float ang = atan(p.y, p.x);
		float gomo = step(0.28, ruido(vec2(ang * 5.0 + fase * 2.0, 0.0)));
		a = anel * gomo * (1.0 - fase) * alfa;
	} else {
		float y = UV.y; // 0 no corpo, 1 no fim
		float x = abs(UV.x - 0.5) * 2.0; // 0 no meio, 1 na beira
		float braco = y * 0.95; // os dois braços do V abrem com a distância
		float linha = step(abs(x - braco), mix(0.05, 0.02, y));
		float quebra = step(0.3, ruido(vec2(y * 18.0 - TIME * 6.0, x > braco ? 1.0 : 0.0)));
		a = linha * quebra * (1.0 - y) * alfa * forca;
	}
	if (a < 0.01) discard;
	ALBEDO = cor;
	ALPHA = a;
}

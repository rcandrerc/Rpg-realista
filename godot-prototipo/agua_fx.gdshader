shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_disabled, specular_disabled, unshaded, shadows_disabled;
// Contato do corpo com a água (nado, André 2026-11-06; direção de arte): espuma de ruído com borda suave.
// modo 0 = anel que abre em volta do corpo (raio de r0 a r1 em metros com "fase" de 0 a 1 e some)
// modo 1 = rastro em V atrás de quem nada (UV.y: 0 = no corpo, 1 = no fim)
// modo 2 = espuma fixa colada no corpo (elipse do tamanho do plano, faixa logo dentro da borda)
uniform int modo = 0;
uniform float fase = 0.0;
uniform float alfa = 0.35;
uniform float forca = 1.0;
uniform float meio = 0.8; // metade do lado do plano (m)
uniform float r0 = 0.4;
uniform float r1 = 0.7;
uniform float faixa = 0.12; // largura da faixa (m)
uniform vec3 cor : source_color = vec3(0.95, 0.98, 1.0);
varying vec3 mundo;
void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5); }
float ruido(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	vec2 u = f * f * (3.0 - 2.0 * f);
	return mix(mix(h(i), h(i + vec2(1, 0)), u.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), u.x), u.y);
}
float espuma(vec2 p) { // ruído em duas escalas: manchas de espuma, não gomos
	return ruido(p * 7.0 + TIME * 0.6) * 0.6 + ruido(p * 17.0 - TIME * 0.9) * 0.4;
}
// 0 fora da faixa, sobe suave até 1 no meio e volta a 0
float banda(float d, float largura) {
	return 1.0 - smoothstep(0.0, largura * 0.5, abs(d));
}
void fragment() {
	vec2 p = (UV * 2.0 - 1.0) * meio; // metros a partir do centro
	float a = 0.0;
	float n = espuma(mundo.xz);
	if (modo == 0) {
		float raio = mix(r0, r1, fase);
		float d = length(p) - raio + (n - 0.5) * 0.06;
		a = banda(d, faixa) * smoothstep(0.25, 0.6, n) * (1.0 - fase) * alfa;
	} else if (modo == 1) {
		float y = UV.y;
		float x = abs(UV.x - 0.5) * 2.0;
		float d = (x - y * 0.95) * meio + (n - 0.5) * 0.05;
		a = banda(d, mix(0.14, 0.3, y)) * smoothstep(0.2, 0.55, n) * (1.0 - y) * alfa * forca;
	} else {
		// elipse do plano: borda em 1; a faixa fica de 0,85 a 1 (largura em metros ~faixa)
		float e = length(UV * 2.0 - 1.0);
		float d = (e - 0.86 + (n - 0.5) * 0.18) * meio;
		a = banda(d, faixa) * smoothstep(0.15, 0.5, n) * alfa * forca;
	}
	if (a < 0.005) discard;
	ALBEDO = cor;
	ALPHA = a;
}

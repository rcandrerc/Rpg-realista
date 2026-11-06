shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;
// Selo da Caverna da Montanha (caverna.gd): um véu de luz no formato do arco do túnel, com um círculo de runas que gira
// devagar. Fechado brilha forte; aberto (o herói usou o passe) fica só um rastro fraco e o herói passa.
uniform float aberto = 0.0;
uniform float aspecto = 1.0; // largura / altura do arco
uniform vec3 cor : source_color = vec3(1.0, 0.72, 0.32);
uniform vec3 cor2 : source_color = vec3(0.45, 0.85, 1.0);
float anel(float r, float raio, float larg) { return smoothstep(larg, 0.0, abs(r - raio)); }
void fragment() {
	vec2 uv = vec2(UV.x, 1.0 - UV.y); // y para cima
	float x = uv.x * 2.0 - 1.0;
	float topo = pow(max(0.0, 1.0 - x * x), 0.375);
	if (uv.y > topo) discard;
	vec2 p = vec2(x * aspecto, uv.y * 2.0 - 0.95);
	float r = length(p);
	float ang = atan(p.y, p.x) + TIME * 0.18;
	float runas = anel(r, 0.62, 0.025) + anel(r, 0.5, 0.012) * 0.8 + anel(r, 0.28, 0.02) * 0.7;
	float marcas = step(0.5, fract(ang * 12.0 / 6.2832)) * smoothstep(0.03, 0.0, abs(r - 0.56)) * 0.9;
	float raios = smoothstep(0.035, 0.0, abs(sin(ang * 3.0)) * r) * step(r, 0.5) * step(0.28, r) * 0.7;
	float desenho = clamp(runas + marcas + raios, 0.0, 1.0);
	float pulso = 0.75 + 0.25 * sin(TIME * 2.1);
	float veu = 0.07 + 0.1 * smoothstep(0.0, 1.0, 1.0 - uv.y) + 0.06 * sin(uv.y * 30.0 + TIME * 3.0) * 0.5;
	float borda = smoothstep(0.08, 0.0, topo - uv.y) * 0.6;
	float k = mix(1.0, 0.18, aberto);
	vec3 c = cor * desenho * pulso * 1.6 + mix(cor, cor2, 0.55) * (veu + borda);
	ALBEDO = c * k;
}

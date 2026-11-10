shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
// Sombra pintada embaixo das árvores (visual_leve.gd, Sombras "Leves"): mancha macia e transparente no chão, mais forte
// no meio e sumindo na borda (nas casas: retângulo macio, o meio fica embaixo da casa). forca: 1 de dia, ~0,3 à noite.
uniform float forca = 1.0;
uniform bool retangulo = false; // casas: mancha retangular macia em volta da base
uniform vec3 cor : source_color = vec3(0.04, 0.06, 0.08);
void fragment() {
	vec2 q = abs(UV * 2.0 - 1.0);
	float d = retangulo ? smoothstep(0.55, 1.0, max(q.x, q.y)) * 0.9 + 0.1 : length(UV * 2.0 - 1.0);
	ALBEDO = cor;
	ALPHA = (1.0 - smoothstep(0.1, 1.0, d)) * 0.55 * forca;
}

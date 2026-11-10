shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
// Sombra pintada embaixo das árvores (visual_leve.gd, Sombras "Leves"): mancha macia e transparente no chão, mais forte
// no meio e sumindo na borda. forca: 1 de dia, ~0,3 à noite.
uniform float forca = 1.0;
uniform vec3 cor : source_color = vec3(0.04, 0.06, 0.08);
void fragment() {
	float d = length(UV * 2.0 - 1.0);
	ALBEDO = cor;
	ALPHA = (1.0 - smoothstep(0.1, 1.0, d)) * 0.55 * forca;
}

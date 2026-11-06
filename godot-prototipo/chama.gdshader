shader_type spatial;
render_mode unshaded, blend_add, cull_disabled, depth_draw_never, shadows_disabled;
// Chama de tocha e de braseiro (caverna.gd): um quadrado sempre virado para a câmera, em forma de gota que tremula.
uniform vec3 cor : source_color = vec3(1.0, 0.55, 0.18);
instance uniform float fase = 0.0;
void vertex() {
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
	MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(vec4(length(MODEL_MATRIX[0].xyz), 0, 0, 0), vec4(0, length(MODEL_MATRIX[1].xyz), 0, 0), vec4(0, 0, 1, 0), vec4(0, 0, 0, 1));
}
void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	p.y = -p.y;
	float t = TIME * 7.0 + fase;
	p.x += sin(p.y * 4.0 + t) * 0.12 * (p.y + 1.0) * 0.5;
	float larg = mix(0.62, 0.05, clamp((p.y + 0.7) / 1.6, 0.0, 1.0));
	float d = abs(p.x) / max(larg, 0.001);
	float forma = smoothstep(1.0, 0.2, d) * smoothstep(-1.0, -0.55, p.y) * smoothstep(1.0, 0.6, p.y + 0.12 * sin(t * 1.3));
	float miolo = smoothstep(0.6, 0.0, d) * smoothstep(0.3, -0.5, p.y);
	vec3 c = cor * forma * 1.6 + vec3(1.0, 0.9, 0.6) * miolo * 1.3;
	ALBEDO = c;
}

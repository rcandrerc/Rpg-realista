// Calcinha de biquíni e samba-canção (armadura.gd, _material_baixo; André 2026-11-07). A malha é uma casca do corpo
// (_casca): UV2.x = distância até a borda (m), UV2.y = ângulo em volta do quadril (listras do samba-canção).
shader_type spatial;
render_mode diffuse_toon, specular_disabled, cull_disabled;

uniform vec4 cor : source_color = vec4(0.48, 0.14, 0.21, 1.0);
uniform vec4 listra : source_color = vec4(0.36, 0.46, 0.58, 1.0);
uniform float listras = 0.0;

varying vec2 v;

void vertex() {
	v = UV2;
}

void fragment() {
	vec3 c = cor.rgb;
	if (listras > 0.5) {
		// listras finas, uma a cada ~2 cm
		float s = abs(fract(v.y * 16.0) - 0.5);
		float w = fwidth(v.y * 16.0) + 0.001;
		c = mix(c, listra.rgb, 1.0 - smoothstep(0.06 - w, 0.06 + w, s));
	}
	// barra e cós: costura mais escura perto da borda
	float b = 1.0 - smoothstep(0.004, 0.007, v.x);
	c = mix(c, c * (listras > 0.5 ? 0.8 : 0.62), b);
	ALBEDO = c;
	ROUGHNESS = 1.0;
	RIM = 0.2;
	RIM_TINT = 0.6;
}

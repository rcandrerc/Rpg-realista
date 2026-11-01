shader_type spatial;
render_mode cull_disabled;
uniform vec3 cor_base : source_color = vec3(0.32, 0.55, 0.18);
uniform vec3 cor_ponta : source_color = vec3(0.62, 0.82, 0.32);
varying float altura;
void vertex() {
	altura = VERTEX.y / 0.3;
	vec3 wp = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	float k = altura * altura * 0.72;
	VERTEX.x += sin(TIME * 1.7 + wp.x * 0.35 + wp.z * 0.2) * 0.09 * k;
	VERTEX.z += cos(TIME * 1.3 + wp.z * 0.4) * 0.05 * k;
}
void fragment() {
	ALBEDO = mix(cor_base, cor_ponta, altura) * COLOR.rgb;
	ROUGHNESS = 0.95;
}

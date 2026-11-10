shader_type spatial;
render_mode cull_disabled;
uniform vec3 cor_base : source_color = vec3(0.32, 0.55, 0.18);
uniform vec3 cor_ponta : source_color = vec3(0.62, 0.82, 0.32);
uniform vec3 tom_ponta : source_color = vec3(1.0); // visual_leve.gd: cor da grama "Natural"
// longe a folha encolhe até sumir (sem linha reta onde a grama acaba): de encolhe_de até encolhe_ate metros da câmera
uniform float encolhe_de = 65.0;
uniform float encolhe_ate = 75.0;
varying float altura;
void vertex() {
	altura = VERTEX.y / 0.3;
	vec3 wp = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	float tam = 1.0 - smoothstep(encolhe_de, encolhe_ate, distance(wp, CAMERA_POSITION_WORLD));
	VERTEX *= tam;
	float k = altura * altura * 0.72;
	VERTEX.x += sin(TIME * 1.7 + wp.x * 0.35 + wp.z * 0.2) * 0.09 * k;
	VERTEX.z += cos(TIME * 1.3 + wp.z * 0.4) * 0.05 * k;
}
void fragment() {
	ALBEDO = COLOR.rgb * tom_ponta * mix(0.95, 1.3, altura);
	ROUGHNESS = 0.95;
}

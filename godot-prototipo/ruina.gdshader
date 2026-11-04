shader_type spatial;
render_mode diffuse_toon, specular_disabled;
// Pedra das ruínas, pedras e estátua da mata (direção de arte 2026-11-04): os 40 cm de baixo ficam ~30% mais escuros
// e puxam para o verde do musgo (sujeira e umidade do chão), com uma borda irregular. Altura pelo mundo, então vale
// para cada cópia do MultiMesh (cenario.gd), enterrada ou não.
uniform sampler2D tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec4 cor : source_color = vec4(1.0);
uniform float altura_suja = 0.4;
uniform vec3 musgo : source_color = vec3(0.62, 0.72, 0.42);
varying vec3 mundo;
float ruido(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	float a = fract(sin(dot(i, vec2(12.9898, 78.233))) * 43758.5453);
	float b = fract(sin(dot(i + vec2(1.0, 0.0), vec2(12.9898, 78.233))) * 43758.5453);
	float c = fract(sin(dot(i + vec2(0.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);
	float d = fract(sin(dot(i + vec2(1.0, 1.0), vec2(12.9898, 78.233))) * 43758.5453);
	return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	vec4 t = texture(tex, UV) * cor;
	float borda = altura_suja * (0.75 + 0.5 * ruido(mundo.xz * 2.3 + mundo.y));
	float k = 1.0 - smoothstep(borda * 0.35, borda, mundo.y);
	vec3 c = t.rgb * mix(1.0, 0.7, k);
	c = mix(c, c * musgo * 1.35, k * 0.55);
	ALBEDO = c;
	ROUGHNESS = 1.0;
}

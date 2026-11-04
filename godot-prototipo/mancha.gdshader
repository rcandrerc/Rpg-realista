shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_disabled, diffuse_toon, specular_disabled, shadows_disabled;
// Mancha de terra e musgo no pé de cada marco da mata (direção de arte 2026-11-04): tira a cara de "bloco posto em cima
// da grama". Disco de raio 1 (o cenario.gd escala), borda irregular que some aos poucos.
uniform vec3 terra : source_color = vec3(0.36, 0.29, 0.2);
uniform vec3 musgo : source_color = vec3(0.32, 0.42, 0.2);
uniform float semente = 0.0;
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
	vec2 p = UV * 2.0 - 1.0;
	float r = length(p);
	float n = ruido(mundo.xz * 0.9) * 0.6 + ruido(mundo.xz * 3.1) * 0.4;
	float borda = 0.72 + 0.28 * n;
	ALPHA = (1.0 - smoothstep(borda - 0.3, borda, r)) * 0.92;
	ALBEDO = mix(terra, musgo, smoothstep(0.35, 0.75, ruido(mundo.xz * 1.7 + 7.0)));
	ROUGHNESS = 1.0;
}

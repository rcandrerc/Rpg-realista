shader_type spatial;
render_mode cull_disabled, diffuse_toon, specular_disabled;
// Juncos e taboas da beira dos lagos (relevo.gd): cor no vértice, balançam com o vento como a grama (mais na ponta)
void vertex() {
	vec3 wp = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	float k = VERTEX.y * VERTEX.y * 0.12;
	VERTEX.x += sin(TIME * 1.4 + wp.x * 0.5 + wp.z * 0.3) * k;
	VERTEX.z += cos(TIME * 1.1 + wp.z * 0.4) * k * 0.6;
}
void fragment() {
	ALBEDO = COLOR.rgb;
	ROUGHNESS = 0.9;
}

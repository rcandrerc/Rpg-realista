shader_type spatial;
render_mode diffuse_toon, specular_disabled, cull_disabled;
// Leito do lago (relevo.gd): lama com folhas pintada (brown_mud_leaves_01 da Poly Haven, CC0) que escurece com a
// fundura; perto da margem, acima da água, vira a grama do chão (emenda sem costura).
uniform sampler2D lama_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D grama_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec3 tom_grama : source_color = vec3(0.91, 0.94, 0.85);
uniform float nivel = -0.12;
varying vec3 mundo;
void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	vec2 w = vec2(mundo.x, -mundo.z);
	vec3 lama = texture(lama_tex, w / 4.0).rgb;
	vec3 grama = texture(grama_tex, w * (70.0 / 320.0)).rgb * tom_grama;
	float prof = nivel - mundo.y;
	vec3 c = mix(lama * 1.05, lama * vec3(0.45, 0.55, 0.6), smoothstep(0.2, 3.5, prof));
	c = mix(c, grama, smoothstep(-0.02, 0.1, -prof - 0.02)); // acima da água: grama
	ALBEDO = c;
	ROUGHNESS = 1.0;
}

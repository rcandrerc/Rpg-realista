shader_type spatial;
render_mode diffuse_toon, specular_disabled, cull_disabled;
// Leito do lago (relevo.gd): lama com folhas pintada (brown_mud_leaves_01 da Poly Haven, CC0) que escurece com a
// fundura. 2026-11-06 (beira natural): rente à margem o leito é a mesma terra molhada da beira do chão plano
// (chao.gdshader), que vai virando lama conforme afunda; sem emenda de cor na linha da margem.
uniform sampler2D lama_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D grama_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D terra_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec3 tom_grama : source_color = vec3(0.91, 0.94, 0.85);
uniform float nivel = -0.05;
varying vec3 mundo;
void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	vec2 w = vec2(mundo.x, -mundo.z);
	vec3 lama = texture(lama_tex, w / 3.0).rgb;
	vec3 terra = texture(terra_tex, w / 3.2).rgb * 0.82;
	float prof = nivel - mundo.y;
	vec3 c = mix(lama * 0.95, lama * vec3(0.42, 0.52, 0.58), smoothstep(0.15, 3.5, prof));
	// terra molhada (a mesma da beira do chão plano) no raso e acima da água; vira lama ao afundar, com a borda quebrada
	vec3 molhada = terra * vec3(0.62, 0.58, 0.54);
	float quebra = (texture(lama_tex, w / 1.3).g - 0.4) * 0.25;
	c = mix(c, molhada, 1.0 - smoothstep(0.02, 0.14, prof + quebra * 0.5));
	ALBEDO = c;
	ROUGHNESS = mix(1.0, 0.6, 1.0 - smoothstep(0.0, 0.3, abs(prof)));
}

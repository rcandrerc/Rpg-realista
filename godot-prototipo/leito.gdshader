shader_type spatial;
render_mode diffuse_toon, specular_disabled, cull_disabled;
// Leito do lago (relevo.gd): lama com folhas pintada (brown_mud_leaves_01 da Poly Haven, CC0) que escurece com a
// fundura. Entre a grama e a água fica uma faixa de lama molhada (escura, com um brilho de umidade), como margem de
// verdade; na volta de fora do lago (embaixo do chão plano) vira a grama do chão.
uniform sampler2D lama_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D grama_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec3 tom_grama : source_color = vec3(0.91, 0.94, 0.85);
uniform float nivel = -0.05;
varying vec3 mundo;
void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	vec2 w = vec2(mundo.x, -mundo.z);
	vec3 lama = texture(lama_tex, w / 3.0).rgb;
	vec3 grama = texture(grama_tex, w * (70.0 / 320.0)).rgb * tom_grama;
	float prof = nivel - mundo.y;
	vec3 c = mix(lama * 0.95, lama * vec3(0.42, 0.52, 0.58), smoothstep(0.15, 3.5, prof));
	// margem molhada: acima da água, lama escura e úmida
	vec3 molhada = lama * vec3(0.62, 0.58, 0.52);
	c = mix(c, molhada, smoothstep(-0.01, 0.01, -prof));
	// de leve mais claro bem rente à grama (secando), quebrado pela textura
	float seca = smoothstep(-0.012, -0.002, mundo.y) * smoothstep(0.35, 0.6, texture(lama_tex, w / 1.3).g);
	c = mix(c, mix(lama, grama, 0.35), seca * 0.6);
	ALBEDO = c;
	ROUGHNESS = mix(1.0, 0.55, smoothstep(-0.01, 0.01, -prof) * (1.0 - smoothstep(-0.012, -0.002, mundo.y)));
}

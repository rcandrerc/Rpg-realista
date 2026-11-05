shader_type spatial;
render_mode diffuse_toon, specular_disabled, cull_disabled;
// Montanha (relevo.gd): grama pintada (a mesma do chão, emenda sem costura no pé) nas partes deitadas e pedra pintada
// (rocky_terrain_02 da Poly Haven, CC0, ferramentas/pintar-texturas) nas encostas, projetada nos 3 eixos (sem esticar
// no paredão). Faixas de rocha em camadas e paredão mais escuro dão o ar de montanha de verdade.
uniform sampler2D grama_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D pedra_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec3 tom_grama : source_color = vec3(0.91, 0.94, 0.85);
uniform float alto = 44.0;
varying vec3 mundo;
varying vec3 nm;
void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	nm = NORMAL;
}
vec3 tri(vec3 p, vec3 b, float esc) {
	return texture(pedra_tex, p.zy / esc).rgb * b.x + texture(pedra_tex, p.xz / esc).rgb * b.y + texture(pedra_tex, p.xy / esc).rgb * b.z;
}
void fragment() {
	vec3 n = normalize(nm);
	vec2 w = vec2(mundo.x, -mundo.z);
	vec3 grama = texture(grama_tex, w * (70.0 / 320.0)).rgb * tom_grama;
	vec3 b = pow(abs(n), vec3(4.0));
	b /= b.x + b.y + b.z;
	vec3 pedra = tri(mundo, b, 6.0) * 0.6 + tri(mundo, b, 19.0) * 0.4;
	float hk = clamp(mundo.y / alto, 0.0, 1.0);
	float incl = 1.0 - n.y; // 0 deitado, 1 paredão
	float ruido = texture(pedra_tex, w / 41.0).g; // quebra a linha da grama (sem borda reta)
	// camadas de rocha no paredão (sedimento), onduladas
	float camada = 0.88 + 0.12 * smoothstep(0.3, 0.7, sin(mundo.y * 1.7 + sin(mundo.x * 0.09 + mundo.z * 0.07) * 3.0) * 0.5 + 0.5);
	float pr = smoothstep(0.13, 0.24, incl + (ruido - 0.5) * 0.22 + hk * 0.1);
	// grama alta é mais seca (amarelada) e a do pé é a mesma do chão
	vec3 g = mix(grama, grama * vec3(1.08, 1.0, 0.78), smoothstep(0.25, 0.7, hk));
	vec3 c = mix(g, pedra * camada, pr);
	c *= mix(1.0, 0.78, smoothstep(0.42, 0.75, incl)); // paredão mais escuro
	c = mix(c, c * vec3(0.92, 0.96, 1.04), smoothstep(0.6, 1.0, hk)); // alto um pouco mais frio (longe, no ar)
	ALBEDO = c;
	ROUGHNESS = 1.0;
}

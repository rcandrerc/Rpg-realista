shader_type spatial;
render_mode diffuse_toon, specular_schlick_ggx, cull_back;
// Rocha da Caverna da Montanha (caverna.gd). A mesma pedra da montanha (rocky_terrain_02 da Poly Haven, CC0, pintada)
// projetada nos 3 eixos, mais fria e escura, com camadas de sedimento nas paredes. O chão (COLOR.r = 1) é cascalho
// batido com manchas úmidas que brilham na luz das tochas.
uniform sampler2D pedra_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D chao_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec3 tom : source_color = vec3(0.6, 0.57, 0.56);
uniform vec3 tom_chao : source_color = vec3(0.56, 0.5, 0.45);
varying vec3 mundo;
varying vec3 nm;
varying float piso;
void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	nm = NORMAL;
	piso = COLOR.r;
}
vec3 tri(vec3 p, vec3 b, float esc) {
	return texture(pedra_tex, p.zy / esc).rgb * b.x + texture(pedra_tex, p.xz / esc).rgb * b.y + texture(pedra_tex, p.xy / esc).rgb * b.z;
}
void fragment() {
	vec3 n = normalize(nm);
	vec3 b = pow(abs(n), vec3(4.0));
	b /= b.x + b.y + b.z;
	vec3 base = tri(mundo, b, 3.2);
	vec3 det = tri(mundo, b, 0.55);
	vec3 rocha = base * (0.72 + 0.56 * dot(det, vec3(0.333))) * tom;
	float camada = 0.84 + 0.16 * smoothstep(0.3, 0.7, sin(mundo.y * 2.4 + sin(mundo.x * 0.21 + mundo.z * 0.17) * 2.2) * 0.5 + 0.5);
	rocha *= camada;
	// musgo escuro e manchas de umidade escorrendo (mais embaixo das paredes)
	float mancha = texture(pedra_tex, mundo.xz / 7.0 + mundo.y * 0.05).g;
	rocha = mix(rocha, rocha * vec3(0.7, 0.78, 0.7), smoothstep(0.55, 0.75, mancha) * 0.6);
	vec3 chao = texture(chao_tex, mundo.xz / 2.4).rgb * tom_chao;
	chao = mix(chao, det * tom * 0.9, 0.38);
	float pk = smoothstep(0.35, 0.8, piso + (texture(pedra_tex, mundo.xz / 4.3).g - 0.5) * 0.5);
	vec3 c = mix(rocha, chao, pk);
	float molhado = smoothstep(0.58, 0.72, texture(pedra_tex, mundo.xz / 8.5 + 0.31).r) * pk;
	c *= 1.0 - 0.3 * molhado;
	ALBEDO = c;
	ROUGHNESS = mix(0.95, 0.3, molhado);
	SPECULAR = 0.15 + 0.35 * molhado;
}

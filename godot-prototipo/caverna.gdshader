shader_type spatial;
render_mode diffuse_toon, specular_schlick_ggx, cull_back;
// Rocha da Caverna da Montanha (caverna.gd). A mesma pedra da montanha (rocky_terrain_02 da Poly Haven, CC0, pintada)
// projetada nos 3 eixos, mais fria e escura, com camadas de sedimento nas paredes. O chão (COLOR.r = 1) é cascalho
// batido com pedrinhas, poças que brilham na luz das tochas e manchas de cascalho solto.
// v2 (direção de arte 2026-11-06): textura com o dobro de repetição, relevo (normal) tirado da própria textura e
// luz em degraus (toon) como o resto do jogo. so_rocha = rochas soltas, pilares e lintel (sem chão).
uniform sampler2D pedra_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D chao_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec3 tom : source_color = vec3(0.6, 0.57, 0.56);
uniform vec3 tom_chao : source_color = vec3(0.56, 0.5, 0.45);
uniform bool so_rocha = false;
uniform float relevo = 1.0; // força do normal tirado da textura
varying vec3 mundo;
varying vec3 nm;
varying float piso;
void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	nm = (MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz;
	piso = so_rocha ? 0.0 : COLOR.r;
}
vec3 tri(vec3 p, vec3 b, float esc) {
	return texture(pedra_tex, p.zy / esc).rgb * b.x + texture(pedra_tex, p.xz / esc).rgb * b.y + texture(pedra_tex, p.xy / esc).rgb * b.z;
}
float lum(vec3 c) { return dot(c, vec3(0.333)); }
// "normal map" barato: a inclinação do brilho da textura vira relevo (pedra clara = saliente)
vec3 bump(vec3 p, vec3 n, vec3 b, float esc) {
	float e = 0.06;
	float h0 = lum(tri(p, b, esc));
	vec3 t1 = normalize(cross(n, abs(n.y) > 0.9 ? vec3(1, 0, 0) : vec3(0, 1, 0)));
	vec3 t2 = cross(n, t1);
	float h1 = lum(tri(p + t1 * e, b, esc));
	float h2 = lum(tri(p + t2 * e, b, esc));
	return normalize(n - (t1 * (h1 - h0) + t2 * (h2 - h0)) / e * 0.09 * relevo);
}
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
void fragment() {
	vec3 n = normalize(nm);
	vec3 b = pow(abs(n), vec3(4.0));
	b /= b.x + b.y + b.z;
	vec3 base = tri(mundo, b, 1.6);
	vec3 det = tri(mundo, b, 0.3);
	vec3 rocha = base * (0.72 + 0.56 * lum(det)) * tom;
	float camada = 0.82 + 0.18 * smoothstep(0.3, 0.7, sin(mundo.y * 2.4 + sin(mundo.x * 0.21 + mundo.z * 0.17) * 2.2) * 0.5 + 0.5);
	rocha *= camada;
	// musgo escuro e manchas de umidade escorrendo (mais embaixo das paredes)
	float mancha = texture(pedra_tex, mundo.xz / 7.0 + mundo.y * 0.05).g;
	rocha = mix(rocha, rocha * vec3(0.7, 0.78, 0.7), smoothstep(0.55, 0.75, mancha) * 0.6);
	// chão: terra batida + cascalho (manchas) + pedrinhas (células com um seixo claro)
	vec3 chao = texture(chao_tex, mundo.xz / 1.4).rgb * tom_chao;
	chao = mix(chao, det * tom * 0.9, 0.38);
	float cascalho = smoothstep(0.45, 0.7, texture(pedra_tex, mundo.xz / 5.0 + 0.17).b);
	chao = mix(chao, tri(mundo * 3.0, vec3(0, 1, 0), 0.5) * tom * 0.85, cascalho * 0.6);
	vec2 cel = floor(mundo.xz / 0.22);
	vec2 fc = fract(mundo.xz / 0.22) - 0.5;
	float seixo = step(0.9, h21(cel)) * smoothstep(0.3, 0.12, length((fc + (vec2(h21(cel + 3.1), h21(cel + 7.7)) - 0.5) * 0.3) * vec2(1.0, 0.6 + h21(cel + 5.0))));
	chao = mix(chao, chao * 1.35 + vec3(0.03), seixo * 0.7);
	float pk = smoothstep(0.35, 0.8, piso + (texture(pedra_tex, mundo.xz / 4.3).g - 0.5) * 0.5);
	vec3 c = mix(rocha, chao, pk);
	// poças: escuras, lisas e com reflexo forte (só no chão)
	float poca = smoothstep(0.62, 0.68, texture(pedra_tex, mundo.xz / 9.0 + 0.31).r) * pk;
	float molhado = max(poca, smoothstep(0.55, 0.62, texture(pedra_tex, mundo.xz / 9.0 + 0.31).r) * pk * 0.5);
	c = mix(c, c * 0.35 + vec3(0.02, 0.03, 0.04), poca);
	c *= 1.0 - 0.25 * molhado;
	ALBEDO = c;
	vec3 nb = mix(bump(mundo, n, b, 1.6), n, poca);
	NORMAL = normalize((VIEW_MATRIX * vec4(nb, 0.0)).xyz);
	ROUGHNESS = mix(0.95, 0.08, molhado);
	SPECULAR = 0.15 + 0.6 * molhado;
}

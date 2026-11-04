// Blusa por baixo do peitoral feminino com decote em V (armadura.gd, _decote; André 2026-11-04: "mais sensual,
// cavado no peito"). A pele do VRoid por baixo da blusa quase não tem vértices, então o V é pintado aqui, por pixel:
// UV2 = (distância até o meio do peito, altura) na pose de descanso; UV2.x >= 5 = costas (sem decote).
shader_type spatial;
render_mode diffuse_toon, specular_disabled, cull_disabled;

uniform vec4 tecido : source_color = vec4(0.12, 0.16, 0.25, 1.0);
uniform vec4 pele : source_color = vec4(1.0, 0.9, 0.84, 1.0);
uniform float y_pescoco = 1.35;
uniform float fundo = 0.2; // quanto o V desce abaixo do pescoço (m)
uniform float largura = 0.105; // meia-largura do V na altura do pescoço (m)
uniform float faixa = 0.015; // borda de tecido que sobra por dentro do V do metal (m)

varying vec2 v;

void vertex() {
	v = UV2;
}

void fragment() {
	float borda = y_pescoco - fundo * (1.0 - clamp((v.x + faixa) / largura, 0.0, 1.0)) + faixa * 0.8;
	float dentro = (v.x < 5.0 && v.y < y_pescoco + 0.03) ? smoothstep(borda - 0.002, borda + 0.002, v.y) : 0.0;
	// sombra suave do vale do busto, só na parte de baixo do V
	float vale = (1.0 - smoothstep(0.0, 0.008, v.x)) * smoothstep(y_pescoco - fundo + 0.01, y_pescoco - fundo + 0.035, v.y)
		* (1.0 - smoothstep(y_pescoco - fundo + 0.06, y_pescoco - fundo + 0.1, v.y));
	vec3 p = pele.rgb * vec3(1.0, 0.94, 0.9) * (1.0 - 0.18 * vale);
	ALBEDO = mix(tecido.rgb, p, dentro);
	ROUGHNESS = 1.0;
	RIM = mix(0.2, 0.25, dentro);
	RIM_TINT = 0.6;
}

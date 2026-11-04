// Blusa por baixo do peitoral (armadura.gd, _decote). A pele do VRoid por baixo da blusa quase não tem vértices,
// então o desenho é pintado aqui, por pixel. UV2 = (distância até o meio do peito, altura) na pose de descanso;
// UV2.x de 10 a 20 = costas; UV2.x >= 20 = manga.
// v10 (André 2026-11-04): decote em V (fundo > 0). v11 (referência de couro e aço): tronco de couro marrom (colete)
// e mangas de tecido cinza-chumbo, colado no braço.
shader_type spatial;
render_mode diffuse_toon, specular_disabled, cull_disabled;

uniform vec4 tecido : source_color = vec4(0.12, 0.16, 0.25, 1.0);
uniform vec4 colete : source_color = vec4(0.36, 0.24, 0.15, 1.0);
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
	bool manga = v.x >= 19.0;
	bool costas = v.x >= 9.0 && !manga;
	float ax = costas ? v.x - 10.0 : v.x;
	float borda = y_pescoco - fundo * (1.0 - clamp((ax + faixa) / largura, 0.0, 1.0)) + faixa * 0.8;
	float dentro = (!manga && !costas && fundo > 0.0 && v.y < y_pescoco + 0.03) ? smoothstep(borda - 0.002, borda + 0.002, v.y) : 0.0;
	float vale = (1.0 - smoothstep(0.0, 0.008, ax)) * smoothstep(y_pescoco - fundo + 0.01, y_pescoco - fundo + 0.035, v.y)
		* (1.0 - smoothstep(y_pescoco - fundo + 0.06, y_pescoco - fundo + 0.1, v.y));
	vec3 p = pele.rgb * vec3(1.0, 0.94, 0.9) * (1.0 - 0.18 * vale);
	// colete de couro: costura clara em volta da cava (onde o tronco encontra a manga) e pesponto no meio da frente
	vec3 roupa = manga ? tecido.rgb : colete.rgb;
	if (!manga) {
		float meio = (1.0 - smoothstep(0.003, 0.005, ax)) * step(v.y, y_pescoco - 0.02) * (costas ? 0.0 : 1.0);
		roupa = mix(roupa, roupa * 0.55, meio);
	}
	ALBEDO = mix(roupa, p, dentro);
	ROUGHNESS = 1.0;
	RIM = mix(0.2, 0.25, dentro);
	RIM_TINT = 0.6;
}

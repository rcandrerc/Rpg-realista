// Blusa sem peitoral (armadura.gd, _material_biquini). André 2026-11-07: no lugar da camiseta branca, a blusa (justa,
// como debaixo da armadura) é pintada de pele, e na menina ganha um top de biquíni de cortininha: dois triângulos
// sobre o busto, faixa embaixo dando a volta nas costas e alças finas até a nuca.
// UV2 (armadura.gd, _decote) = (distância até o meio do peito, altura) na pose de descanso; UV2.x de 10 a 20 = costas;
// UV2.x >= 20 = manga (pele).
shader_type spatial;
render_mode diffuse_toon, specular_disabled, cull_disabled;

uniform vec4 pele : source_color = vec4(1.0, 0.9, 0.84, 1.0);
uniform vec4 tecido : source_color = vec4(0.48, 0.14, 0.21, 1.0);
uniform float fem = 1.0;
uniform float x_busto = 0.05;
uniform float y_busto = 1.2;
uniform float y_pescoco = 1.35;

varying vec2 v;

void vertex() {
	v = UV2;
}

float segmento(vec2 p, vec2 a, vec2 b) {
	vec2 pa = p - a, ba = b - a;
	float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
	return length(pa - ba * h);
}

void fragment() {
	bool manga = v.x >= 19.0;
	bool costas = v.x >= 9.0 && !manga;
	float ax = costas ? v.x - 10.0 : v.x;
	float px = fwidth(v.y) * 1.5 + 0.0008; // borda macia sem serrilhado
	float top = 0.0;
	float borda = 0.0; // costura escura na beira do pano
	if (fem > 0.5 && !manga) {
		float baixo = y_busto - 0.06; // faixa sob o busto
		if (!costas) {
			// triângulo: base larga na faixa, ponta no alto do busto
			float alto = y_busto + 0.055;
			float t = clamp((v.y - baixo) / (alto - baixo), 0.0, 1.0);
			float meia = mix(0.058, 0.012, t);
			float d = abs(ax - x_busto) - meia;
			float dentro = (1.0 - smoothstep(-px, px, d)) * step(baixo - 0.004, v.y) * (1.0 - smoothstep(alto - px, alto + px, v.y));
			top = max(top, dentro);
			borda = max(borda, dentro * (1.0 - smoothstep(0.0025, 0.004, -d)));
			// alça: da ponta do triângulo até a nuca
			float al = segmento(vec2(ax, v.y), vec2(x_busto - 0.004, alto - 0.004), vec2(0.045, y_pescoco + 0.02));
			top = max(top, 1.0 - smoothstep(0.004 - px, 0.004 + px, al));
		} else {
			// alça da nuca descendo pelos ombros até a gola (atrás só a faixa e o laço das alças no pescoço)
			float al = segmento(vec2(ax, v.y), vec2(0.045, y_pescoco - 0.02), vec2(0.045, y_pescoco + 0.03));
			top = max(top, 1.0 - smoothstep(0.004 - px, 0.004 + px, al));
		}
		// faixa de 1,6 cm em volta do corpo, sob o busto
		float f = abs(v.y - (baixo + 0.004)) - 0.008;
		float faixa = 1.0 - smoothstep(-px, px, f);
		top = max(top, faixa);
		borda = max(borda, faixa * (1.0 - smoothstep(0.0, 0.0015, -f)));
	}
	vec3 p = pele.rgb * vec3(1.0, 0.94, 0.9);
	vec3 pano = mix(tecido.rgb, tecido.rgb * 0.6, borda);
	ALBEDO = mix(p, pano, top);
	ROUGHNESS = 1.0;
	BACKLIGHT = vec3(0.32, 0.12, 0.07) * (1.0 - top); // sombra quente da pele (main.pele_viva)
	RIM = 0.08; // o contorno de luz forte deixava a pele pintada branca perto da pele de verdade

	RIM_TINT = 0.6;
}

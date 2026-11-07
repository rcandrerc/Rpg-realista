// Blusa sem peitoral (armadura.gd, _material_biquini). André 2026-11-07: no lugar da camiseta branca, a blusa (justa,
// como debaixo da armadura) é pintada de pele, e na menina ganha um top de biquíni de cortininha: dois triângulos
// sobre o busto, faixa embaixo dando a volta nas costas e alças finas até a nuca.
// UV2 (armadura.gd, _decote) = (distância até o meio do peito, altura) na pose de descanso; UV2.x de 10 a 20 = costas;
// UV2.x >= 20 = manga (pele).
shader_type spatial;
render_mode diffuse_lambert_wrap, specular_disabled, cull_disabled; // luz macia: pano com volume (o toon dava cara de pintura)

uniform vec4 pele : source_color = vec4(1.0, 0.9, 0.84, 1.0);
uniform vec4 tecido : source_color = vec4(0.48, 0.14, 0.21, 1.0);
uniform float fem = 1.0;
uniform float x_busto = 0.05;
uniform float y_busto = 1.2;
uniform float y_pescoco = 1.35;
uniform float so_pano = 0.0; // 1: casca do top sobre a pele de verdade (armadura.gd, base_top): o que não é pano some

varying vec2 v;

void vertex() {
	v = UV2;
}

float segmento(vec2 p, vec2 a, vec2 b) {
	vec2 pa = p - a, ba = b - a;
	float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
	return length(pa - ba * h);
}

// trama do tecido (lycra): xadrez fino de ~1,5 mm que some de longe (sem serrilhar)
float trama(vec2 q) {
	vec2 f = q * 650.0;
	float w = fwidth(f.x) + fwidth(f.y);
	float a = sin(f.x + f.y) * sin(f.x - f.y);
	return a * (1.0 - smoothstep(0.6, 1.6, w));
}

void fragment() {
	bool manga = v.x >= 19.0;
	bool costas = v.x >= 9.0 && !manga;
	float ax = costas ? v.x - 10.0 : v.x;
	float px = fwidth(v.y) * 1.5 + 0.0008; // borda macia sem serrilhado
	float top = 0.0;
	float borda = 99.0; // distância até a beira do pano (m): costura e bainha
	float volume = 1.0; // sombra do tecido na taça (embaixo e por dentro mais escuro)
	if (fem > 0.5 && !manga) {
		float baixo = y_busto - 0.06; // faixa sob o busto
		if (!costas) {
			// André 2026-11-07: as duas taças separadas (cada uma sobre um seio), com o vale do decote de fora
			float alto = y_busto + 0.05;
			float t = clamp((v.y - baixo) / (alto - baixo), 0.0, 1.0);
			float dentro_max = max(0.016, x_busto - 0.014); // a beira de dentro não passa do vale
			float meia_base = min(0.058, dentro_max);
			// beira de dentro quase reta (segue o seio) e a de fora abre em curva
			float l_dentro = mix(meia_base, 0.008, pow(t, 0.8));
			float l_fora = mix(0.06, 0.008, t * t);
			float dx = ax - x_busto;
			float d = dx < 0.0 ? -dx - l_dentro : dx - l_fora;
			float dy = max(baixo - v.y, v.y - alto);
			float dist = max(d, dy);
			float dentro = 1.0 - smoothstep(-px, px, dist);
			top = max(top, dentro);
			borda = min(borda, dentro > 0.5 ? -dist : 99.0);
			volume = mix(0.82, 1.06, smoothstep(0.0, 0.8, t)) * mix(0.92, 1.0, smoothstep(-0.03, 0.02, dx));
			// franzido: o pano da taça é preso na faixa de baixo e abre em pregas finas que sobem para a ponta
			float ang = atan(dx, v.y - baixo + 0.02);
			float prega = sin(ang * 22.0 + sin(ang * 7.0) * 0.8);
			float some = (1.0 - smoothstep(0.15, 0.85, t)) * (1.0 - smoothstep(0.5, 1.5, fwidth(ang * 22.0)));
			volume *= 1.0 + 0.11 * prega * some;
			// brilho do pano esticado no alto do seio
			volume *= 1.0 + 0.08 * (1.0 - smoothstep(0.0, 0.03, abs(dx + 0.004))) * smoothstep(0.3, 0.75, t);
			// alça: da ponta da taça até a nuca
			float al = segmento(vec2(ax, v.y), vec2(x_busto, alto - 0.004), vec2(0.045, y_pescoco + 0.02));
			top = max(top, 1.0 - smoothstep(0.0035 - px, 0.0035 + px, al));
		} else {
			float al = segmento(vec2(ax, v.y), vec2(0.045, y_pescoco - 0.02), vec2(0.045, y_pescoco + 0.03));
			top = max(top, 1.0 - smoothstep(0.0035 - px, 0.0035 + px, al));
		}
		// faixa de 1,4 cm em volta do corpo, sob o busto (elástico canelado)
		float f = abs(v.y - (baixo + 0.004)) - 0.007;
		float faixa = 1.0 - smoothstep(-px, px, f);
		if (faixa > top) {
			volume = 0.93 + 0.05 * sin(ax * 900.0) * (1.0 - smoothstep(0.5, 1.5, fwidth(ax * 900.0)));
		}
		top = max(top, faixa);
		if (faixa > 0.5) {
			borda = min(borda, -f);
		}
	}
	if (so_pano > 0.5 && top < 0.5) {
		discard;
	}
	vec3 p = pele.rgb * vec3(1.0, 0.94, 0.9);
	// tecido: trama, bainha mais escura (pano dobrado) e pesponto claro tracejado 3 mm para dentro
	vec3 pano = tecido.rgb * volume * (1.0 + 0.06 * trama(vec2(ax, v.y)));
	// bainha enrolada: beira escura, um filete de luz no alto da dobra e o pano volta ao normal
	pano *= mix(0.62, 1.0, smoothstep(0.0006, 0.002, borda));
	pano *= 1.0 + 0.22 * (1.0 - smoothstep(0.0, 0.0007, abs(borda - 0.0026)));
	float ponto = (1.0 - smoothstep(0.0005, 0.001, abs(borda - 0.0045))) * step(0.45, fract((ax + v.y) * 230.0));
	pano = mix(pano, tecido.rgb * 1.75 + vec3(0.04), ponto * 0.8 * (1.0 - smoothstep(0.5, 1.5, fwidth((ax + v.y) * 230.0))));
	ALBEDO = mix(p, pano, top);
	ROUGHNESS = 1.0;
	BACKLIGHT = vec3(0.32, 0.12, 0.07) * (1.0 - top); // sombra quente da pele (main.pele_viva)
	RIM = mix(0.08, 0.45, top); // pano: brilho de lycra na borda da luz
	RIM_TINT = mix(0.6, 0.3, top);
}

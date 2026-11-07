// Calcinha de biquíni e samba-canção (armadura.gd, _material_baixo; André 2026-11-07: "tem que parecer roupa").
// A malha é uma casca do corpo (_casca): UV2.x = distância até a borda (m), UV2.y = ângulo em volta do quadril
// (listras e braguilha do samba-canção; -1 na calcinha).
shader_type spatial;
render_mode diffuse_lambert_wrap, specular_disabled, cull_disabled; // luz macia, igual ao top (biquini.gdshader): pano com volume

uniform vec4 cor : source_color = vec4(0.48, 0.14, 0.21, 1.0);
uniform vec4 listra : source_color = vec4(0.36, 0.46, 0.58, 1.0);
uniform float listras = 0.0; // 1 = samba-canção (algodão listrado, cós largo, braguilha); 0 = calcinha (lycra)

varying vec2 v;
varying vec3 q; // posição no corpo (trama do tecido)
varying vec3 nq; // normal no corpo (listras: frente e costas pelo x, lados pelo z)

void vertex() {
	v = UV2;
	q = VERTEX;
	nq = NORMAL;
}

float faixa_listra(float x) {
	float s = abs(fract(x) - 0.5);
	float w = fwidth(x) + 0.001;
	return 1.0 - smoothstep(0.06 - w, 0.06 + w, s);
}

// trama: xadrez fino que some de longe (sem serrilhar)
float trama(vec3 p, float escala) {
	vec3 f = p * escala;
	float w = length(fwidth(f));
	float a = sin(f.x + f.y) * sin(f.z - f.y) * sin(f.x - f.z);
	return a * (1.0 - smoothstep(0.6, 1.6, w));
}

void fragment() {
	bool samba = listras > 0.5;
	vec3 c = cor.rgb;
	float b = v.x; // distância até a borda
	if (samba) {
		// listras finas, uma a cada ~2 cm, e pregas suaves do algodão folgado
		// (pelo ângulo em volta do quadril as listras esticavam nas pernas: agora seguem o pano, ~2 cm entre elas)
		vec2 lado = abs(normalize(nq).xz);
		lado = pow(lado, vec2(4.0));
		float l = (faixa_listra(q.x * 50.0) * lado.y + faixa_listra(q.z * 50.0) * lado.x) / max(lado.x + lado.y, 0.001);
		c = mix(c, listra.rgb, l);
		c *= 0.94 + 0.06 * sin(v.y * 95.0 + q.y * 40.0);
		// braguilha: costura dupla no meio da frente com dois botões de osso
		float meio = abs(v.y - 0.1);
		float costura = 1.0 - smoothstep(0.0015, 0.003, abs(meio - 0.006));
		c = mix(c, c * 0.62, costura * step(0.012, b));
		c *= 1.0 + 0.1 * trama(q, 900.0);
	} else {
		c *= 1.0 + 0.07 * trama(q, 1300.0);
	}
	// cós e bainha: o pano dobra na borda (mais escuro), elástico canelado e pesponto claro tracejado por dentro
	float faixa = samba ? 0.016 : 0.006;
	float dobra = 1.0 - smoothstep(faixa - 0.002, faixa, b);
	float canelado = 0.5 + 0.5 * sin((q.x + q.z) * 1400.0);
	canelado *= 1.0 - smoothstep(0.5, 1.5, length(fwidth((q.x + q.z) * 1400.0)));
	c *= mix(1.0, (samba ? 0.86 : 0.8) - 0.06 * canelado, dobra);
	c *= mix(0.72, 1.0, smoothstep(0.0, 0.0018, b)); // a beira enrolada
	float ponto = (1.0 - smoothstep(0.0004, 0.0009, abs(b - faixa - 0.0012))) * step(0.5, fract((q.x + q.y + q.z) * 230.0));
	ponto *= 1.0 - smoothstep(0.5, 1.5, length(fwidth((q.x + q.y + q.z) * 230.0)));
	c = mix(c, samba ? vec3(0.93, 0.93, 0.9) : cor.rgb * 1.7, ponto * 0.6);
	ALBEDO = c;
	ROUGHNESS = 1.0;
	RIM = samba ? 0.2 : 0.45; // a lycra brilha mais na borda da luz que o algodão
	RIM_TINT = samba ? 0.6 : 0.3;
}

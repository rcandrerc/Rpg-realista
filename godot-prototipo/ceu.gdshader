// Céu do dia e da noite (dia_noite.gd, André 2026-11-07). De dia é o mesmo céu pintado de antes (modelos/ceu.hdr);
// no pôr e no nascer do sol a faixa do horizonte esquenta (laranja do Quimera f0a878); de noite vira o degradê azul-escuro
// do Quimera (040816 em cima, 142048 no meio, 18223e embaixo) com estrelas (sem TIME: o céu não é refeito a cada quadro no celular) e uma lua cheia pequena.
// André 2026-11-08: lua maior com manchas e brilho em volta (baixa no céu, para a câmera ver), estrelas maiores e nuvens
// de dia e de noite tiradas do próprio céu pintado (nada novo para carregar; tudo fixo, sem TIME).
shader_type sky;

uniform sampler2D panorama : source_color, filter_linear, hint_default_black;
uniform float noite = 0.0;
uniform float por = 0.0;
uniform vec3 topo : source_color = vec3(0.016, 0.031, 0.086);
uniform vec3 meio : source_color = vec3(0.078, 0.125, 0.282);
uniform vec3 baixo : source_color = vec3(0.094, 0.133, 0.243);
uniform vec3 cor_por : source_color = vec3(0.94, 0.66, 0.47);
uniform vec3 lua_dir = vec3(0.4, 0.55, 0.7);
// a névoa do mundo não cobre mais o céu inteiro (fog_sky_affect baixo em dia_noite.gd): aqui ela só esbranquiça o horizonte
uniform vec3 nevoa : source_color = vec3(0.66, 0.78, 0.9);

float sorteio(vec3 p) {
	p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

// nuvem do próprio céu pintado: branco/cinza (pouca cor) é nuvem, azul é céu aberto
float nuvem_de(vec3 p) {
	float mx = max(p.r, max(p.g, p.b));
	float mn = min(p.r, min(p.g, p.b));
	float sat = (mx - mn) / max(mx, 0.001);
	return smoothstep(0.42, 0.18, sat) * smoothstep(0.25, 0.6, mx);
}

void sky() {
	vec3 d = EYEDIR;
	vec3 dia = texture(panorama, SKY_COORDS).rgb;
	float nv = d.y > -0.02 ? nuvem_de(dia) : 0.0;
	// de dia as nuvens do céu pintado ficam um pouco mais brancas e cheias (André 2026-11-08)
	dia = mix(dia, vec3(1.0, 0.99, 0.97) * max(dia.g, 0.85), nv * 0.45 * (1.0 - por));
	float horiz = 1.0 - smoothstep(0.0, 0.5, abs(d.y));
	dia = mix(dia, dia * cor_por * 1.5 + cor_por * 0.12, por * horiz * 0.75);
	vec3 grad = d.y > 0.0 ? mix(meio, topo, smoothstep(0.0, 0.65, d.y)) : mix(meio, baixo, smoothstep(0.0, -0.3, d.y));
	grad = mix(grad, cor_por * 0.55, por * horiz * 0.5);
	vec3 L = normalize(lua_dir);
	float lm = dot(d, L);
	if (noite > 0.01) {
		// estrelas: uma em cada célula sorteada da esfera, grandes o bastante para aparecer no celular
		float est = 0.0;
		vec3 q = d * 110.0;
		vec3 cel = floor(q);
		float h = sorteio(cel);
		if (h > 0.94) {
			vec3 f = fract(q) - 0.5;
			float forte = sorteio(cel + 3.1);
			float raio = 0.1 + 0.14 * forte * forte;
			est = smoothstep(raio, 0.0, length(f)) * (0.5 + 0.9 * forte);
		}
		est *= smoothstep(0.35, 0.8, noite) * smoothstep(-0.01, 0.08, d.y) * (1.0 - smoothstep(0.9965, 0.999, lm));
		grad += vec3(0.88, 0.92, 1.0) * est * 1.6 * (1.0 - nv);
		// nuvens da noite: as mesmas do dia, cinza-azuladas, com a borda prateada perto da lua
		float perto = pow(max(lm, 0.0), 24.0);
		vec3 nuvem_noite = mix(vec3(0.13, 0.16, 0.27), vec3(0.42, 0.47, 0.62), perto) + vec3(0.1, 0.11, 0.14) * pow(max(lm, 0.0), 6.0);
		grad = mix(grad, nuvem_noite, nv * 0.8);
	}
	vec3 c = mix(dia, grad, noite);
	// lua: disco com manchas (mares) e brilho em volta, em duas camadas
	if (noite > 0.01 && lm > 0.9) {
		const float R = 0.034; // raio da lua (~2 graus)
		float ang = acos(clamp(lm, -1.0, 1.0));
		vec3 ux = normalize(cross(L, vec3(0.0, 1.0, 0.0)));
		vec3 uy = cross(ux, L);
		vec2 uv = vec2(dot(d, ux), dot(d, uy)) / R;
		float disco = smoothstep(1.0, 0.93, length(uv));
		float mar = smoothstep(0.42, 0.2, length(uv - vec2(-0.28, 0.22))) * 0.55
			+ smoothstep(0.32, 0.12, length(uv - vec2(0.3, -0.05))) * 0.45
			+ smoothstep(0.26, 0.1, length(uv - vec2(-0.05, -0.42))) * 0.35;
		vec3 cor_lua = vec3(1.0, 0.98, 0.9) * (1.15 - 0.32 * min(mar, 1.0)) * (1.0 - 0.18 * dot(uv, uv));
		vec3 halo = vec3(0.55, 0.66, 0.95) * (exp(-ang / (R * 1.4)) * 0.55 + exp(-ang / (R * 6.0)) * 0.22);
		c = mix(c + halo * noite * (1.0 - nv * 0.4), cor_lua, disco * noite * (1.0 - nv * 0.75));
	}
	c = mix(c, nevoa, (1.0 - smoothstep(-0.02, 0.22, d.y)) * 0.75);
	COLOR = c;
}

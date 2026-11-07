// Céu do dia e da noite (dia_noite.gd, André 2026-11-07). De dia é o mesmo céu pintado de antes (modelos/ceu.hdr);
// no pôr e no nascer do sol a faixa do horizonte esquenta (laranja do Quimera f0a878); de noite vira o degradê azul-escuro
// do Quimera (040816 em cima, 142048 no meio, 18223e embaixo) com estrelas (sem TIME: o céu não é refeito a cada quadro no celular) e uma lua cheia pequena.
shader_type sky;

uniform sampler2D panorama : source_color, filter_linear, hint_default_black;
uniform float noite = 0.0;
uniform float por = 0.0;
uniform vec3 topo : source_color = vec3(0.016, 0.031, 0.086);
uniform vec3 meio : source_color = vec3(0.078, 0.125, 0.282);
uniform vec3 baixo : source_color = vec3(0.094, 0.133, 0.243);
uniform vec3 cor_por : source_color = vec3(0.94, 0.66, 0.47);
uniform vec3 lua_dir = vec3(0.4, 0.55, 0.7);

float sorteio(vec3 p) {
	p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void sky() {
	vec3 d = EYEDIR;
	vec3 dia = texture(panorama, SKY_COORDS).rgb;
	float horiz = 1.0 - smoothstep(0.0, 0.5, abs(d.y));
	dia = mix(dia, dia * cor_por * 1.5 + cor_por * 0.12, por * horiz * 0.75);
	vec3 grad = d.y > 0.0 ? mix(meio, topo, smoothstep(0.0, 0.65, d.y)) : mix(meio, baixo, smoothstep(0.0, -0.3, d.y));
	grad = mix(grad, cor_por * 0.55, por * horiz * 0.5);
	vec3 c = mix(dia, grad, noite);
	if (noite > 0.35 && d.y > 0.0) {
		// estrelas: uma em cada célula sorteada da esfera
		vec3 q = d * 160.0;
		vec3 cel = floor(q);
		float h = sorteio(cel);
		if (h > 0.972) {
			vec3 f = fract(q) - 0.5;
			float brilho = smoothstep(0.16, 0.0, length(f)) * (0.45 + 0.55 * sorteio(cel + 3.1));
			c += vec3(0.9, 0.93, 1.0) * brilho * smoothstep(0.35, 0.8, noite) * smoothstep(0.02, 0.25, d.y) * 1.3;
		}
	}
	// lua: disco claro com um halo azulado
	float lm = dot(d, normalize(lua_dir));
	c += vec3(0.92, 0.94, 1.0) * smoothstep(0.99955, 0.99975, lm) * noite * 1.4;
	c += vec3(0.32, 0.4, 0.7) * pow(max(lm, 0.0), 220.0) * noite * 0.35;
	COLOR = c;
}

shader_type spatial;
render_mode diffuse_toon, specular_disabled;
// Pedra do totem de teleporte (André 2026-11-10): a mesma pedra das ruínas (textura de rocha, base mais escura com
// musgo, ruina.gdshader) e, nas faces do obelisco, runas entalhadas que acendem azul e pulsam devagar. Sem textura
// extra: as runas saem de uma grade de traços sorteados por face (leve no celular).
uniform sampler2D tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec4 cor : source_color = vec4(1.0);
uniform vec2 escala_uv = vec2(1.0, 1.0);
uniform vec2 faixa = vec2(0.64, 0.35); // pedaço da textura (folha de acabamentos): começo e altura em V (lados)
uniform float altura_suja = 0.4; // m acima do chão (chao) que ficam sujos
uniform float chao = 0.0; // altura do chão no meio do totem
uniform vec3 musgo : source_color = vec3(0.62, 0.72, 0.42);
uniform float runas = 0.0; // 1 = obelisco (com runas)
uniform float faces = 4.0;
uniform vec3 runa_cor : source_color = vec3(0.35, 0.85, 1.0);
uniform float forca = 1.0; // perto acende mais (totem.gd)
varying vec3 mundo;
varying vec3 nrm;
float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
float ruido(vec2 p) {
	vec2 i = floor(p), f = fract(p);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	nrm = (MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz;
}
// um traço de (a) a (b) com espessura e: 1 dentro
float traco(vec2 p, vec2 a, vec2 b, float e) {
	vec2 pa = p - a, ba = b - a;
	float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
	return 1.0 - smoothstep(e * 0.6, e, length(pa - ba * h));
}
void fragment() {
	// tampos (virados para cima): as pedras de calçamento do alto da folha, pelo mundo; lados: a faixa pedida
	vec2 bruto, uv;
	if (abs(normalize(nrm).y) > 0.6) {
		bruto = mundo.xz * 0.35;
		uv = vec2(fract(bruto.x), 0.02 + fract(bruto.y) * 0.26);
		bruto.y *= 0.26;
	} else {
		bruto = UV * escala_uv;
		uv = vec2(bruto.x, faixa.x + fract(bruto.y) * faixa.y);
		bruto.y *= faixa.y;
	}
	vec4 t = textureGrad(tex, uv, dFdx(bruto), dFdy(bruto)) * cor;
	float y = mundo.y - chao;
	float borda = altura_suja * (0.75 + 0.5 * ruido(mundo.xz * 2.3 + mundo.y));
	float k = 1.0 - smoothstep(borda * 0.35, borda, y);
	vec3 c = t.rgb * mix(1.0, 0.7, k);
	c = mix(c, c * musgo * 1.35, k * 0.55);
	vec3 em = vec3(0.0);
	if (runas > 0.5) {
		// cada face do obelisco: uma coluna de 6 runas no meio (UV.x dá a volta, UV.y desce)
		float u = fract(UV.x * faces);
		float face = floor(UV.x * faces);
		vec2 q = vec2((u - 0.5) / 0.36, UV.y); // -1..1 no meio da face
		float m = 0.0;
		if (abs(q.x) < 0.5 && q.y > 0.1 && q.y < 0.86) {
			float cel = floor((q.y - 0.1) / 0.126);
			vec2 l = vec2(q.x + 0.5, fract((q.y - 0.1) / 0.126)); // 0..1 dentro da runa
			float r1 = hash(vec2(face, cel)), r2 = hash(vec2(cel, face + 7.0)), r3 = hash(vec2(face + cel, 3.0));
			float e = 0.07;
			m = max(m, traco(l, vec2(0.5, 0.15), vec2(0.5, 0.85), e)); // a haste
			m = max(m, step(0.4, r1) * traco(l, vec2(0.5, 0.3 + r2 * 0.4), vec2(0.18 + r3 * 0.1, 0.15 + r1 * 0.3), e));
			m = max(m, step(0.35, r2) * traco(l, vec2(0.5, 0.25 + r3 * 0.5), vec2(0.82 - r1 * 0.1, 0.5 + r2 * 0.35), e));
			m = max(m, step(0.7, r3) * traco(l, vec2(0.25, 0.85), vec2(0.75, 0.85), e));
		}
		// linha fina em volta da base e do topo do obelisco
		m = max(m, (1.0 - smoothstep(0.006, 0.012, abs(UV.y - 0.95))) * 0.8);
		float pulso = 0.65 + 0.35 * sin(TIME * 1.6 + mundo.y * 1.2);
		c = mix(c, c * 0.35, m); // o entalhe é fundo e escuro por baixo da luz
		em = runa_cor * m * pulso * (0.9 + 1.6 * forca);
	}
	ALBEDO = c;
	ROUGHNESS = 1.0;
	EMISSION = em;
}

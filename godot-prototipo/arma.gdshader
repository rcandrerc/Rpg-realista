// Espada A e Cajado A (direção de arte, 2026-11-03; escolha do André). Um shader para as peças das armas do herói:
// modo 0 = metal toon (aço, fio, ouro, ferro): reflete um "céu" desenhado em faixas, como metal de anime
//          (claro em cima, faixa escura do horizonte, chão no meio-tom), com os riscos de forja da textura. É a faixa
//          escura que faz ler "lâmina" (o André achou a espada antiga "uma coisa", sem brilho).
// modo 1 = toon de 3 degraus com textura (couro do cabo, madeira do cajado)
// modo 2 = brilho (runa, gemas, cristal de fogo): cor própria; a runa só acende onde a textura desenha a runa.
shader_type spatial;
render_mode cull_back, ambient_light_disabled, specular_disabled;

uniform int modo = 0;
uniform sampler2D tex : source_color, filter_linear_mipmap, repeat_enable;
uniform bool tem_tex = false;
uniform vec4 claro : source_color = vec4(0.86, 0.9, 0.95, 1.0);
uniform vec4 medio : source_color = vec4(0.56, 0.62, 0.72, 1.0);
uniform vec4 sombra : source_color = vec4(0.24, 0.28, 0.36, 1.0);
uniform vec4 miolo : source_color = vec4(1.0, 0.95, 0.7, 1.0); // brilho: cor do centro da pedra
uniform float riscos = 0.0; // quanto a textura (riscos de forja) mexe no reflexo
uniform float forca = 0.4; // brilho próprio (modo 2): ~40% (direção de arte), sem halo
uniform float pulsa = 0.0; // fogo do cajado: o brilho respira devagar
uniform float espelho = 1.0; // modo 0: 1 = reflexo cheio (ouro); menos = metal acetinado, rugoso ~0,35 (aço da lâmina, v2)
uniform float brilho = 0.42; // modo 2: quanto a cor própria acende (menos = laranja não estoura para amarelo)
uniform float miolo_mix = 1.0; // modo 2: quanto o miolo clareia (fogo: pouco, para ficar laranja)
uniform float miolo_k = 0.55; // modo 2: até onde vai o miolo claro (menor = miolo pequeno no centro)
uniform float ganho = 2.1; // compensa a curva de tom do jogo (igual à armadura)
uniform float luz_ref = 2.83;

varying vec3 v_env;
varying vec3 v_loc;
varying vec3 v_cor;

void vertex() {
	v_loc = VERTEX;
}

void fragment() {
	NORMAL = FRONT_FACING ? NORMAL : -NORMAL;
	vec3 t = tem_tex ? texture(tex, UV).rgb : vec3(1.0);
	if (modo == 0) {
		// reflexo numa direção na diagonal (alto e à direita da tela): a face de frente fica no meio-claro, o chanfro
		// de um lado acende e o do outro cai na faixa escura. É o desenho de lâmina de anime (lado claro / lado escuro).
		vec3 rf = reflect(-VIEW, NORMAL);
		// + degradê pela largura da peça (do meio para o fio) e um pouco pelo comprimento: a face plana não fica de um tom só
		float ry = 0.5 + dot(rf, normalize(vec3(0.55, 0.85, 0.0))) * 0.35 + clamp(v_loc.x / 0.04, -1.0, 1.0) * 0.22
			+ sin(v_loc.y * 7.0) * 0.06 + (t.r - 0.78) * riscos;
		// acetinado: o tom vem mais da direção da face (luz fixa) que do reflexo, e as faixas ficam suaves
		float dif = 0.52 + dot(NORMAL, normalize(vec3(0.35, 0.75, 0.55))) * 0.22 + clamp(v_loc.x / 0.05, -1.0, 1.0) * 0.1 + (t.r - 0.78) * riscos;
		ry = mix(dif, ry, espelho);
		vec3 env;
		if (ry > 0.62) env = mix(claro.rgb, medio.rgb, smoothstep(0.85, 1.1, ry) * 0.3);
		else if (ry > 0.3) env = mix(medio.rgb, claro.rgb, smoothstep(0.38, 0.62, ry));
		else if (ry > 0.18) env = sombra.rgb; // faixa escura do horizonte (estreita)
		else env = mix(sombra.rgb, medio.rgb, smoothstep(0.18, 0.0, ry) * 0.8);
		v_env = env * mix(1.0, t.r * 1.15, riscos > 0.0 ? 0.35 : 0.0);
		ALBEDO = vec3(0.0);
		EMISSION = v_env * ganho * 0.42;
	} else if (modo == 1) {
		v_cor = t * claro.rgb;
		ALBEDO = vec3(0.0);
		EMISSION = v_cor * ganho * 0.36;
	} else {
		float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 1.5);
		// facetas: cada face da pedra num tom (luz fixa de cima), miolo claro e borda na cor mais funda
		float fac = dot(NORMAL, normalize(vec3(0.3, 0.8, 0.5)));
		vec3 c = mix(claro.rgb, miolo.rgb, (1.0 - smoothstep(miolo_k * 0.27, miolo_k, fres)) * miolo_mix);
		c = mix(c, sombra.rgb, smoothstep(0.55, 0.95, fres));
		c *= fac > 0.35 ? 1.0 : (fac > -0.2 ? 0.82 : 0.66);
		float k = 1.0;
		if (tem_tex) { // runa: só o desenho acende; o fundo do sulco é azul-escuro
			float l = dot(t, vec3(0.33));
			k = smoothstep(0.25, 0.6, l);
			c = mix(sombra.rgb, miolo.rgb, k);
		}
		float p = 1.0 + pulsa * 0.2 * sin(TIME * 3.1);
		ALBEDO = vec3(0.0);
		v_cor = c;
		EMISSION = c * ganho * brilho * (1.0 + forca * k * p);
	}
}

void light() {
	float ndl = dot(NORMAL, LIGHT);
	float att = ATTENUATION;
	float lc = max(max(LIGHT_COLOR.r, LIGHT_COLOR.g), LIGHT_COLOR.b);
	vec3 tinta = LIGHT_COLOR / max(lc, 0.001);
	float k = clamp(lc / luz_ref, 0.0, 1.3);
	if (modo == 0) {
		float sol = (ndl > -0.05 && att > 0.5) ? 1.0 : 0.3;
		DIFFUSE_LIGHT += v_env * 0.58 * sol * mix(vec3(1.0), tinta, 0.35) * ganho * k;
		vec3 h = normalize(LIGHT + VIEW);
		float e = step(0.992, dot(NORMAL, h)) * step(0.1, ndl) * step(0.5, att); // brilho duro pequeno
		DIFFUSE_LIGHT += vec3(e) * 0.9 * ganho * k;
	} else if (modo == 1) {
		float deg = (ndl > 0.5 && att > 0.5) ? 1.0 : (ndl > -0.1 ? 0.62 : 0.3);
		DIFFUSE_LIGHT += v_cor * deg * 0.8 * mix(vec3(1.0), tinta, 0.35) * ganho * k;
	}
}

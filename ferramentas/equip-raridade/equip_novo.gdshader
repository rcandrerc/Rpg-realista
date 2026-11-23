shader_type spatial;
// Proposta de equipamentos por raridade (setor de arte, 2026-11-23): um shader só para todas as peças, barato
// para o celular. Sem textura grande: o grão (couro, aço escovado, pano, fendas de brasa) sai de um ruído pequeno
// de 128 px projetado no espaço da peça. O brilho é só emissão (não usa luz de verdade nem transparência).
// tipo: 0 couro, 1 metal, 2 pano, 3 gema, 4 brasa (aço negro com fendas acesas), 5 pérola iridescente,
//       6 cristal, 7 runa acesa
render_mode cull_disabled;

uniform int tipo = 1;
uniform vec3 cor : source_color = vec3(0.6);
uniform vec3 cor2 : source_color = vec3(0.3);
uniform vec3 luz : source_color = vec3(1.0, 0.5, 0.1);
uniform float metal = 0.0;
uniform float aspereza = 0.6;
uniform float forca = 1.0;
uniform sampler2D ruido : filter_linear_mipmap, repeat_enable;

varying vec3 p_local;
varying vec3 n_local;

void vertex() {
	p_local = VERTEX;
	n_local = NORMAL;
}

float rui(vec3 p, float esc) { // projeção triplanar barata (2 amostras)
	vec3 w = abs(n_local);
	float a = texture(ruido, p.xy * esc).r;
	float b = texture(ruido, p.zy * esc).r;
	return mix(a, b, smoothstep(0.3, 0.7, w.x / (w.x + w.z + 0.001)));
}

// reflexo de céu desenhado (sem sonda de reflexo, que o celular fraco não aguenta): claro em cima, horizonte escuro,
// uma faixa de brilho; o mesmo truque da armadura de hoje (armadura_real.gdshader)
vec3 ceu(vec3 r, vec3 c, float liso) {
	float y = r.y;
	vec3 alto = mix(c * 1.45, vec3(1.0), 0.15);
	vec3 baixo = c * 0.42;
	vec3 e = mix(baixo, alto, smoothstep(-0.35, 0.55, y));
	e += vec3(1.0) * pow(max(0.0, 1.0 - abs(y - 0.12) * 6.0), 2.0) * 0.55 * liso; // faixa do horizonte
	return e;
}

void fragment() {
	vec3 Rw = (INV_VIEW_MATRIX * vec4(reflect(-VIEW, NORMAL), 0.0)).xyz;
	float fres = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	float n = rui(p_local, 6.0);
	float n2 = rui(p_local, 22.0);
	vec3 alb = cor;
	vec3 emi = vec3(0.0);
	float met = metal;
	float rug = aspereza;
	if (tipo == 0) { // couro: manchas e grão
		alb = cor * (0.82 + 0.25 * n) * (0.88 + 0.24 * n2);
		rug = 0.7 + 0.2 * n2;
	} else if (tipo == 1) { // metal escovado (riscos verticais)
		float risco = texture(ruido, vec2(p_local.x * 40.0 + p_local.z * 40.0, p_local.y * 1.5)).r;
		alb = ceu(Rw + vec3(0.0, (risco - 0.5) * 0.25, 0.0), cor, 1.0 - aspereza) * (0.88 + 0.2 * risco) * (0.92 + 0.12 * n);
		rug = aspereza + 0.12 * risco;
		met = 0.0;
		emi = cor2 * fres * 0.35; // borda que pega o céu
	} else if (tipo == 2) { // pano: trama
		float tr = sin(p_local.x * 900.0) * sin(p_local.y * 900.0);
		alb = cor * (0.82 + 0.1 * tr + 0.2 * n);
		rug = 0.9;
		emi = cor * fres * 0.25;
	} else if (tipo == 3) { // gema: miolo aceso que pulsa devagar
		float pul = 0.75 + 0.25 * sin(TIME * 2.2);
		alb = cor * 0.4;
		emi = mix(luz, cor2, fres) * forca * pul * (0.8 + 0.6 * n2);
		rug = 0.08;
		met = 0.0;
	} else if (tipo == 4) { // aço negro com fendas de brasa que correm
		float f = rui(p_local + vec3(0.0, -TIME * 0.02, 0.0), 2.2);
		float fenda = 1.0 - smoothstep(0.0, 0.022, abs(f - 0.5));
		float pul = 0.7 + 0.3 * sin(TIME * 3.0 + p_local.y * 20.0);
		fenda *= smoothstep(0.45, 0.6, rui(p_local, 2.5)); // só algumas fendas, não a peça inteira
		alb = mix(ceu(Rw, cor, 0.7) * (0.85 + 0.3 * n2), vec3(0.04), fenda);
		met = 0.0;
		emi = mix(luz, vec3(1.0, 0.85, 0.4), fenda * 0.6) * fenda * forca * pul + cor2 * fres * 0.5;
		rug = 0.35 + 0.2 * n2;
	} else if (tipo == 5) { // pérola iridescente: a cor muda com o ângulo
		float h = dot(NORMAL, VIEW);
		vec3 iri = 0.5 + 0.5 * cos(6.2831 * (vec3(0.0, 0.33, 0.67) + h * 1.3 + n * 0.4));
		alb = ceu(Rw, cor * 0.78, 0.8) * mix(vec3(1.0), iri, 0.12 + 0.35 * fres);
		met = 0.0;
		emi = mix(cor2, iri, 0.35) * fres * 0.7 * forca;
		rug = aspereza;
	} else if (tipo == 6) { // cristal: escuro por dentro, aceso nas bordas e com faíscas
		float pul = 0.8 + 0.2 * sin(TIME * 1.6 + p_local.y * 8.0);
		float brilho = smoothstep(0.74, 0.8, rui(p_local + vec3(0.0, TIME * 0.02, 0.0), 30.0)) * 0.5;
		alb = cor * 0.5;
		emi = (cor2 * (0.25 + fres * 1.4 + n * 0.25) + luz * brilho) * forca * pul;
		rug = 0.05;
		met = 0.3;
	} else if (tipo == 7) { // runa acesa
		float pul = 0.6 + 0.4 * sin(TIME * 2.5 - p_local.y * 12.0);
		alb = cor * 0.3;
		emi = luz * forca * pul;
	}
	ALBEDO = alb;
	METALLIC = met;
	ROUGHNESS = rug;
	EMISSION = emi;
}

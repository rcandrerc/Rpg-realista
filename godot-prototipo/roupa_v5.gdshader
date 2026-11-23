// Armadura v5 (André 2026-11-23, referência de patrulheiro de couro e roupão de mago): couro e pano de verdade.
// Entradas iguais às de armadura_real.gdshader: UV2.x = distância até a borda da peça (m), UV2.y = coordenada livre
// da peça (faixas das tiras; no colete é o z da pose de descanso, para achar a frente). UV = (x, y) da pose de
// descanso no espaço do personagem (cadarço da frente do colete, bordado).
//   modo 0 = couro (grão, manchas, borda gasta, pesponto), 1 = pano (trama, dobras macias).
//   acento = barra da borda (couro escuro no Comum, bronze, prata, ouro, brasa); bordado = losangos na barra.
//   brasa = a barra e veios finos brilham (Mítico).
shader_type spatial;
render_mode cull_disabled, specular_disabled;

uniform vec4 claro : source_color = vec4(0.62, 0.48, 0.32, 1.0);
uniform vec4 medio : source_color = vec4(0.45, 0.32, 0.19, 1.0);
uniform vec4 sombra : source_color = vec4(0.16, 0.1, 0.06, 1.0);
uniform vec4 acento : source_color = vec4(0.29, 0.2, 0.14, 1.0);
uniform vec4 linha : source_color = vec4(0.85, 0.78, 0.63, 1.0); // pesponto e cadarço
uniform float modo = 0.0;
uniform float largura = 0.009; // barra da borda (m)
uniform float bordado = 0.0;
uniform float brasa = 0.0;
uniform float cadarco = 0.0;
uniform float faixa = 0.0; // tiras (m entre elas na coordenada UV2.y); 0 = sem
uniform float costura = 1.0;
uniform float punho = 0.0; // manga do roupão: largura da barra na boca da manga (m ao longo do braço)
instance uniform float punho_x = 9.0; // onde começa a boca da manga (x da pose de descanso)
uniform float faixa_meio = 0.0; // roupão: faixa bordada no meio da frente (meia-largura, m)
uniform float luz_ref = 2.83;

varying vec4 v_pk; // posição + distância até a borda (um varying só: PowerVR, ver armadura_real.gdshader)
varying vec3 v_uv; // x, y de descanso + coordenada da peça

float hash3(vec3 p) {
	p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float ruido(vec3 x) {
	vec3 i = floor(x);
	vec3 f = fract(x);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hash3(i), hash3(i + vec3(1, 0, 0)), f.x), mix(hash3(i + vec3(0, 1, 0)), hash3(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(hash3(i + vec3(0, 0, 1)), hash3(i + vec3(1, 0, 1)), f.x), mix(hash3(i + vec3(0, 1, 1)), hash3(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}
float fbm(vec3 x) {
	float s = 0.0;
	float a = 0.5;
	for (int i = 0; i < 3; i++) {
		s += a * ruido(x);
		x *= 2.03;
		a *= 0.5;
	}
	return s;
}

void vertex() {
	vec4 pk = vec4(VERTEX, UV2.x);
	v_pk = pk;
	v_uv = vec3(UV, UV2.y);
}

void fragment() {
	vec3 P = v_pk.xyz;
	float d = v_pk.w;
	float L = largura;
	float barra = 1.0 - smoothstep(L - 0.0012, L, d);
	vec3 cor;
	float rough;
	if (modo < 0.5) {
		// couro: grão fino, manchas largas, borda gasta mais escura e um pouco de brilho no alto relevo
		float grao = ruido(P * 420.0);
		float mancha = fbm(P * 8.0);
		cor = medio.rgb * (0.88 + 0.16 * grao) * (0.78 + 0.42 * mancha);
		cor = mix(cor, claro.rgb, smoothstep(0.62, 0.8, mancha) * 0.35);
		cor = mix(cor, sombra.rgb, smoothstep(0.02, 0.0, d - L) * 0.4 * (1.0 - barra));
		rough = 0.7;
	} else {
		// pano: trama fina (duas direções) e dobras largas e macias
		float tr = 0.5 + 0.25 * (sin(P.x * 1400.0 + P.z * 900.0) + sin(P.y * 1400.0));
		float dobra = fbm(P * vec3(10.0, 3.5, 10.0));
		cor = medio.rgb * (0.94 + 0.08 * tr) * (0.8 + 0.36 * dobra);
		cor = mix(cor, sombra.rgb, (1.0 - smoothstep(0.25, 0.45, dobra)) * 0.35);
		rough = 0.95;
	}
	// tiras de couro (braçadeira): faixa mais escura com pesponto dos dois lados
	if (faixa > 0.0) {
		float q = fract(v_uv.z / faixa);
		float tira = smoothstep(0.0, 0.03, q) * (1.0 - smoothstep(0.26, 0.29, q));
		cor = mix(cor, sombra.rgb * 1.3, tira * 0.75);
		float pt = (1.0 - smoothstep(0.0, 0.025, abs(q - 0.04))) + (1.0 - smoothstep(0.0, 0.025, abs(q - 0.25)));
		cor = mix(cor, linha.rgb * 0.8, pt * 0.6 * step(0.5, fract((P.x + P.y + P.z) * 160.0)));
	}
	// cadarço do colete: abertura no meio da frente, ilhoses e cordão cruzado
	if (cadarco > 0.5 && v_uv.z > 0.0) {
		float ax = abs(v_uv.x);
		float t = fract(v_uv.y / 0.024);
		float fenda = 1.0 - smoothstep(0.0025, 0.0038, ax);
		cor = mix(cor, sombra.rgb * 0.4, fenda);
		float ilhos = 1.0 - smoothstep(0.0022, 0.003, length(vec2(ax - 0.011, (t - 0.5) * 0.024)));
		cor = mix(cor, acento.rgb * 0.9 + vec3(0.06), ilhos);
		float cruz = 1.0 - smoothstep(0.0012, 0.0024, abs(ax - 0.011 * abs(2.0 * t - 1.0)));
		cruz *= step(ax, 0.0115);
		cor = mix(cor, linha.rgb, cruz);
	}
	if (punho > 0.0) {
		float bp = smoothstep(punho_x - punho - 0.001, punho_x - punho, abs(v_uv.x));
		d = mix(d, max(0.0, abs(v_uv.x) - (punho_x - punho)), bp);
		barra = max(barra, bp);
	}
	// faixa do meio da frente (roupão): conta como barra
	if (faixa_meio > 0.0 && v_uv.z > 0.0) {
		float fm = 1.0 - smoothstep(faixa_meio - 0.001, faixa_meio, abs(v_uv.x));
		d = min(d, mix(1.0, faixa_meio - abs(v_uv.x), fm));
		barra = max(barra, fm);
	}
	// barra da borda na cor de acento; fio escuro por dentro; bordado de losangos nos sets altos
	vec3 cb = acento.rgb;
	if (modo < 0.5) {
		cb *= 0.85 + 0.2 * ruido(P * 300.0);
	}
	if (bordado > 0.5) {
		vec2 g = vec2(v_uv.x * 70.0 + P.z * 70.0, v_uv.y * 70.0);
		vec2 f = abs(fract(g) - 0.5);
		float los = 1.0 - smoothstep(0.24, 0.3, f.x + f.y);
		float meio = smoothstep(0.0015, 0.003, d) * (1.0 - smoothstep(L - 0.003, L - 0.0015, d));
		cb = mix(cb * 0.62, cb * 1.15, los * meio);
	}
	cor = mix(cor, cb, barra);
	float fio = smoothstep(L, L + 0.0008, d) * (1.0 - smoothstep(L + 0.0012, L + 0.002, d));
	cor = mix(cor, sombra.rgb * 0.6, fio * 0.8);
	// pesponto
	if (costura > 0.5) {
		float fc = smoothstep(L + 0.003, L + 0.004, d) * (1.0 - smoothstep(L + 0.005, L + 0.006, d));
		float ponto = step(0.45, fract((P.x + P.y + P.z) * 110.0));
		cor = mix(cor, linha.rgb * (modo < 0.5 ? 0.85 : 0.7), fc * ponto * 0.85);
	}
	vec3 em = vec3(0.0);
	if (brasa > 0.0) {
		float pulso = 0.75 + 0.25 * fbm(P * 22.0);
		em += acento.rgb * barra * brasa * 0.9 * pulso;
		// veios de brasa: poucos e finos, só no couro (no pano ficava sujo)
		float veio = 1.0 - smoothstep(0.0, 0.008, abs(fbm(P * 14.0) - 0.5));
		veio *= smoothstep(0.03, 0.06, d) * (1.0 - barra) * (1.0 - modo) * smoothstep(0.45, 0.6, ruido(P * 6.0));
		em += acento.rgb * veio * brasa * 0.45;
		cor = mix(cor, acento.rgb * 0.5, veio * brasa * 0.5);
	}
	if (!FRONT_FACING) {
		cor *= 0.45; // por dentro da peça (capuz, mangas abertas) fica na sombra
	}
	ALBEDO = cor;
	EMISSION = em;
	NORMAL = FRONT_FACING ? NORMAL : -NORMAL;
	ROUGHNESS = rough;
}

void light() {
	float ndl = dot(NORMAL, LIGHT);
	float w = clamp((ndl + 0.35) / 1.35, 0.0, 1.0);
	float sombra_proj = mix(0.35, 1.0, ATTENUATION);
	DIFFUSE_LIGHT += LIGHT_COLOR * w * w * sombra_proj * 0.9 / PI * 2.2;
	vec3 h = normalize(LIGHT + VIEW);
	float nh = max(dot(NORMAL, h), 0.0);
	SPECULAR_LIGHT += LIGHT_COLOR * pow(nh, 14.0) * (modo < 0.5 ? 0.07 : 0.02) * sombra_proj * step(0.0, ndl);
}

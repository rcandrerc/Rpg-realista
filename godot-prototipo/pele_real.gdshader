// Pele semi-realista (André 2026-11-07: "puxado pro anime, mas com a pele com mais textura, mais sombras, marcas no
// corpo", estilo Where Winds Meet / Age of Wushu). Teste: realista.gd troca a pele do personagem por este shader.
// - luz macia com a sombra quente (sangue por baixo da pele) em vez do degrau do toon
// - poros e textura fina da pele (ruído no espaço do corpo, some de longe)
// - dobras e vincos mais escuros (onde a normal muda depressa: clavícula, axila, umbigo, dobra do braço)
// - brilho fraco e largo de pele (oleosidade), mais forte no rosto e no ombro
shader_type spatial;
render_mode blend_mix, depth_draw_opaque, cull_back, diffuse_lambert, specular_schlick_ggx;

uniform vec4 albedo : source_color = vec4(1.0);
uniform sampler2D texture_albedo : source_color, filter_linear_mipmap, repeat_enable;
uniform float poros = 1.0; // força da textura fina
uniform float vinco = 1.0; // força das dobras escuras
uniform float rosto = 0.0; // 1 no rosto: mais macio (o desenho do VRoid já traz traço e blush)
uniform vec4 cor_vertice_escala = vec4(0.0); // >0: multiplica pela cor de vértice (tronco da Ruiva, emenda)

varying vec3 q;
varying vec3 cv;

float hash(vec3 p) {
	p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
	p *= 17.0;
	return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float ruido(vec3 x) {
	vec3 i = floor(x);
	vec3 f = fract(x);
	f = f * f * (3.0 - 2.0 * f);
	return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x), mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
		mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x), mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

void vertex() {
	q = VERTEX;
	cv = COLOR.rgb;
}

void fragment() {
	vec4 t = texture(texture_albedo, UV);
	vec3 c = albedo.rgb * t.rgb;
	if (cor_vertice_escala.x > 0.0) {
		c *= cv * cor_vertice_escala.x;
	}
	// poros: duas oitavas de ruído (~1,5 mm e ~4 mm) que mexem na normal e um tiquinho na cor; somem de longe
	float longe = 1.0 - smoothstep(0.4, 1.6, length(fwidth(q * 600.0)));
	float n1 = ruido(q * 600.0);
	float n2 = ruido(q * 230.0 + 7.0);
	float pr = (n1 - 0.5) * 0.7 + (n2 - 0.5) * 0.3;
	c *= 1.0 + pr * 0.1 * poros * longe * (1.0 - 0.6 * rosto);
	// manchas suaves de cor (pele de verdade não é de uma cor só): mais rosada em umas partes, mais amarelada noutras
	float mancha = ruido(q * 18.0 + 3.0) - 0.5;
	c *= vec3(1.0 + 0.05 * mancha, 1.0 - 0.02 * mancha, 1.0 - 0.04 * mancha);
	// relevo vindo do próprio desenho da textura: os traços de músculo, costela e clavícula viram volume de verdade
	float lum = dot(t.rgb, vec3(0.3, 0.59, 0.11));
	pr += lum * 0.35 * (1.0 - rosto);
	vec3 gx = dFdx(q);
	vec3 gy = dFdy(q);
	float hx = dFdx(pr);
	float hy = dFdy(pr);
	vec3 r1 = cross(gy, NORMAL);
	vec3 r2 = cross(NORMAL, gx);
	float det = dot(gx, r1);
	vec3 grad = sign(det) * (hx * r1 + hy * r2);
	NORMAL = normalize(NORMAL - grad * 0.004 * poros * longe * (1.0 - 0.7 * rosto) / max(abs(det), 1e-8) * length(gx));
	// vincos: a normal vira depressa nas dobras (curvatura de tela) -> sombra de contato
	float curva = length(fwidth(NORMAL)) / max(length(fwidth(q)) * 120.0, 1e-4);
	c *= 1.0 - clamp(curva * 0.15, 0.0, 0.06) * vinco * (1.0 - 0.6 * rosto);
	// cor mais viva (o toon lavava a pele) e luz ambiente mais fraca embaixo (queixo, peito, barriga, axila):
	// é a sombra de contato que dá peso ao corpo e ameniza a junção entre queixo e pescoço
	float lc = dot(c, vec3(0.3, 0.59, 0.11));
	c = mix(vec3(lc), c, 1.2);
	ALBEDO = c;
	vec3 nm = (INV_VIEW_MATRIX * vec4(NORMAL, 0.0)).xyz;
	// gradiente suave de oclusão no queixo/mandíbula conectando com o pescoço
	AO = mix(mix(0.45, 0.82, rosto), 1.0, clamp(nm.y * 0.5 + 0.55, 0.0, 1.0)) ;
	AO_LIGHT_AFFECT = 0.0;
	ROUGHNESS = mix(0.62, 0.55, rosto);
	SPECULAR = 0.28;
	METALLIC = 0.0;
	// sangue por baixo da pele: a luz atravessa um pouco nas bordas finas (orelha, dedos, nariz)
	BACKLIGHT = vec3(0.35, 0.12, 0.06);
	RIM = 0.06;
	RIM_TINT = 0.7;
}

void light() {
	float nl = dot(NORMAL, LIGHT);
	// difusa embrulhada: a sombra entra devagar e puxa para o vermelho perto da divisa (espalhamento da pele)
	// o rosto embrulha mais e quase não pega a sombra do cabelo (senão o rosto anime fica cinza)
	float emb = mix(0.1, 0.6, rosto);
	float w = clamp((nl + emb) / (1.0 + emb), 0.0, 1.0);
	float sombra = mix(1.0, ATTENUATION, mix(0.85, 0.3, rosto));
	vec3 espalha = vec3(w, pow(w, 1.5), pow(w, 1.85));
	DIFFUSE_LIGHT += LIGHT_COLOR * espalha * sombra / PI * 1.12;
	// brilho largo e fraco (GGX simples)
	vec3 h = normalize(VIEW + LIGHT);
	float nh = max(dot(NORMAL, h), 0.0);
	float a = ROUGHNESS * ROUGHNESS;
	float d = a * a / (PI * pow(nh * nh * (a * a - 1.0) + 1.0, 2.0));
	SPECULAR_LIGHT += LIGHT_COLOR * min(d, 4.0) * 0.016 * max(nl, 0.0) * sombra;
	// brilho rasante (fresnel) de pele, fraco
	SPECULAR_LIGHT += LIGHT_COLOR * pow(1.0 - max(dot(NORMAL, VIEW), 0.0), 4.0) * 0.06 * max(nl, 0.0) * sombra;
}

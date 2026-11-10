shader_type spatial;
render_mode cull_disabled, diffuse_toon, specular_disabled, world_vertex_coords;
// Mato alto (mato.gd, André 2026-11-10: "os matos crescendo, mais mato mesmo, em vez de um chão pintado de verde").
// Capim em cartas com folhinhas desenhadas (com_textura) e samambaia em malha. UV.y = altura (0 no pé, 1 na ponta).
// - pé da touceira na cor do chão em volta (o mesmo forrest_ground do chão, lido bem borrado), ponta na cor sorteada
//   da touceira (COLOR, a PALETA da grama do jogo): o mato nasce do chão pintado sem emenda;
// - vento: balanço lento com rajada que corre pelo campo;
// - o herói passa por dentro e o mato abre e deita em volta dele (pisa);
// - longe a touceira encolhe até sumir (de encolhe_de a encolhe_ate m): sem borda reta onde o mato acaba.
uniform sampler2D grama_tex : source_color, filter_linear_mipmap, repeat_enable;
// capim em cartas (2026-11-10): mato_capim.png, duas touceiras lado a lado (COLOR.a escolhe), recortada pelo alfa
uniform sampler2D capim_tex : source_color, filter_linear_mipmap, repeat_disable;
uniform bool com_textura = false;
uniform vec3 tom_grama : source_color = vec3(0.91, 0.94, 0.85);
uniform vec3 tom_ponta : source_color = vec3(1.0); // visual_leve.gd: cor da grama "Natural"
uniform float encolhe_de = 30.0;
uniform float encolhe_ate = 42.0;
uniform float vento = 1.0;
uniform vec4 pisa = vec4(0.0, -999.0, 0.0, 0.9); // xyz = pés do herói, w = raio
varying float altura;
varying vec3 cor_chao;
varying vec3 nw;
varying float metade;
void vertex() {
	altura = UV.y;
	metade = COLOR.a;
	vec3 o = MODEL_MATRIX[3].xyz;
	float tam = 1.0 - smoothstep(encolhe_de, encolhe_ate, distance(o, CAMERA_POSITION_WORLD));
	VERTEX = o + (VERTEX - o) * tam; // world_vertex_coords: VERTEX e NORMAL já vêm no mundo
	vec3 wp = VERTEX;
	float k = altura * altura;
	// rajada: uma onda larga que corre pelo campo, por cima do balanço miúdo de cada folha
	float onda = sin(TIME * 1.1 - o.x * 0.11 - o.z * 0.07) * 0.5 + 0.5;
	float bal = sin(TIME * 2.3 + wp.x * 0.9 + wp.z * 0.6 + VERTEX.x * 3.0);
	vec3 desv = vec3(0.0);
	desv.x = (onda * 0.16 + bal * 0.045) * k * vento;
	desv.z = (onda * 0.07 + cos(TIME * 1.9 + wp.z * 0.8) * 0.035) * k * vento;
	// herói passando: empurra para fora e deita
	vec2 d = wp.xz - pisa.xz;
	float L = length(d);
	float empurra = (1.0 - smoothstep(pisa.w * 0.35, pisa.w, L)) * step(abs(wp.y - pisa.y), 2.0);
	vec2 dir = L > 0.001 ? d / L : vec2(1.0, 0.0);
	desv.xz += dir * empurra * 0.45 * k;
	desv.y -= empurra * 0.35 * k;
	VERTEX += desv * tam;
	// cor do chão embaixo da touceira (mesma conta do chao.gdshader / terreno_mundo.gdshader, num mip borrado)
	// luz como a do chão (normal quase para cima, dos dois lados da folha): sem o lado de trás escuro
	nw = normalize(vec3(0.0, 1.0, 0.0) + NORMAL * 0.35);
	vec2 w = vec2(o.x, -o.z);
	cor_chao = textureLod(grama_tex, w * (70.0 / 320.0), 5.0).rgb * tom_grama;
}
void fragment() {
	vec3 ponta = COLOR.rgb * tom_ponta;
	vec3 c;
	if (com_textura) {
		vec4 t = texture(capim_tex, vec2(UV.x * 0.5 + step(0.5, metade) * 0.5, 1.0 - UV.y));
		ALPHA = t.a;
		ALPHA_SCISSOR_THRESHOLD = 0.45;
		// o desenho dá as folhinhas claras e escuras; a touceira dá o tom (PALETA da grama do jogo)
		c = t.rgb * ponta * 1.85;
		c = mix(vec3(dot(c, vec3(0.333))), c, 0.8); // menos neon
		c = mix(cor_chao * 0.7, c, smoothstep(0.0, 0.3, altura));
	} else {
		c = mix(cor_chao * 0.62, ponta, smoothstep(0.0, 0.55, altura));
	}
	c *= mix(0.9, 1.04, altura);
	NORMAL = normalize(mat3(VIEW_MATRIX) * nw);
	ALBEDO = c;
	ROUGHNESS = 0.9;
	BACKLIGHT = c * 0.25; // contraluz: a folha fina acende quando o sol está atrás
}

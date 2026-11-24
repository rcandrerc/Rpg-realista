// Brilho do reforço da arma (André 2026-11-24: "efeito de brilho nas armas à medida que o reforço aumenta").
// Uma casca fina por cima da própria malha da arma (sem modelo novo), somando luz: borda acesa (fresnel), uma
// faixa de luz que sobe pela lâmina e uma respiração lenta. Cor e força vêm do +N (Armas.brilho_reforco, armas.gd).
shader_type spatial;
render_mode blend_add, unshaded, cull_back, depth_draw_never, shadows_disabled;

uniform vec4 cor : source_color = vec4(0.3, 0.65, 1.0, 1.0);
uniform float forca = 0.5; // 0 a ~1,2: cresce com o reforço
uniform float comprimento = 1.0; // m da arma no espaço dela (cabo na origem, ponta em +Y)
uniform float inicio = 0.18; // onde o brilho começa (fração do comprimento): o cabo fica apagado
uniform float casca = 0.004; // quanto a casca sai da malha
uniform float onda = 1.0; // velocidade da faixa que sobe

varying float v_y;

void vertex() {
	v_y = VERTEX.y / comprimento;
	VERTEX += NORMAL * casca;
}

void fragment() {
	float fres = pow(1.0 - clamp(abs(dot(NORMAL, VIEW)), 0.0, 1.0), 1.6);
	float faixa = smoothstep(0.78, 1.0, sin(v_y * 8.0 - TIME * 2.4 * onda) * 0.5 + 0.5);
	float respira = 0.8 + 0.2 * sin(TIME * 2.2);
	float a = (0.32 + fres * 1.1 + faixa * 0.6) * respira * forca;
	a *= smoothstep(inicio - 0.06, inicio + 0.08, v_y);
	ALBEDO = cor.rgb * a;
	ALPHA = 1.0;
}

shader_type spatial;
// Estrada da base do clã (base_cla.gd _desenhar_estradas, André 2026-11-23): faixa de terra batida em cima do chão, a
// mesma terra das estradas do mundo (terreno_mundo.gdshader: stony_dirt_path em projeção de cima), com a borda comida
// pela grama (sem linha reta). UV.x: 0 a 1 de um lado ao outro; UV.y: metros ao longo da estrada.
render_mode blend_mix, cull_disabled, depth_draw_opaque, shadows_disabled;

uniform sampler2D terra_tex : source_color, filter_linear_mipmap, repeat_enable;

varying vec3 v_mundo;

void vertex() {
	v_mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec3 t = texture(terra_tex, v_mundo.xz / 3.2).rgb * 0.82;
	float det = texture(terra_tex, v_mundo.xz / 0.9).g;
	float bord = abs(UV.x * 2.0 - 1.0); // 0 no meio, 1 na beira
	float ondas = 0.08 * sin(UV.y * 0.7) + 0.06 * sin(UV.y * 2.3 + 1.7);
	float a = 1.0 - smoothstep(0.5 + ondas, 0.95 + ondas, bord + (det - 0.4) * 0.35);
	// marcas de roda: duas faixas um pouco mais escuras
	float roda = smoothstep(0.08, 0.0, abs(bord - 0.42)) * 0.12;
	ALBEDO = t * (1.0 - roda);
	ROUGHNESS = 0.95;
	ALPHA = a;
}

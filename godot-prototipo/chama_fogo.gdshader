shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled, fog_disabled;
// Chama do fogão e da fornalha (André 2026-11-07: "o fogo é fixo, como um desenho parado").
// O cone de chama estica, encolhe e balança a ponta, e a cor vai do laranja da base ao amarelo da ponta.
// Tudo na placa de vídeo (nada no processador) e opaco (sem transparência, que pesa no celular).
// Mais longe que uns 25 m a chama para de mexer (a peça inteira some aos 70 m).
uniform vec3 cor_base : source_color = vec3(1.0, 0.45, 0.12);
uniform vec3 cor_ponta : source_color = vec3(1.0, 0.85, 0.4);
uniform float altura = 0.4;
uniform float fase = 0.0;
varying float alt;
void vertex() {
	float h = clamp(VERTEX.y / altura + 0.5, 0.0, 1.0);
	alt = h;
	float perto = 1.0 - smoothstep(18.0, 25.0, distance(NODE_POSITION_WORLD, CAMERA_POSITION_WORLD));
	float t = TIME * 6.0 + fase + NODE_POSITION_WORLD.x * 3.1 + NODE_POSITION_WORLD.z * 1.7;
	VERTEX.xz *= 1.0 + 0.12 * sin(t * 1.7) * (1.0 - h) * perto;
	float sobe = 1.0 + (0.2 * sin(t) + 0.12 * sin(t * 2.3 + 1.0)) * perto;
	VERTEX.y = (VERTEX.y + altura * 0.5) * sobe - altura * 0.5;
	VERTEX.x += sin(t * 1.4 + h * 3.0) * 0.14 * altura * h * h * perto;
	VERTEX.z += cos(t * 1.1 + h * 2.5) * 0.1 * altura * h * h * perto;
}
void fragment() {
	float pisca = 1.0 + 0.12 * sin(TIME * 11.0 + fase);
	ALBEDO = mix(cor_base, cor_ponta, alt * alt) * 1.25 * pisca;
}

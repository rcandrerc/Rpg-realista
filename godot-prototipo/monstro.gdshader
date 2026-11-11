// Monstros do Mixamo no visual anime do jogo (direção de arte, Warrok v2, 2026-11-04): luz em 3 faixas como a Ruiva
// (sombra ~35% mais escura que a luz, nunca preta), borda quente (fresnel) para descolar do fundo e olhos acesos.
shader_type spatial;
render_mode specular_disabled;

uniform sampler2D textura : source_color, filter_linear_mipmap;
uniform sampler2D brilho : source_color, hint_default_black, filter_linear;
uniform float brilho_forca = 0.6;
uniform vec3 borda_cor : source_color = vec3(1.0, 0.69, 0.44);
uniform float borda_forca = 0.25;
uniform vec3 faixas = vec3(1.0, 0.82, 0.65);
// boss de mundo (André 2026-11-11, boss_mundo.gd): tinta própria por cima da textura; 0 = o monstro de sempre
uniform vec3 tinta : source_color = vec3(1.0);
uniform float tinta_forca = 0.0;

void fragment() {
	vec3 cor = texture(textura, UV).rgb;
	float lum = dot(cor, vec3(0.299, 0.587, 0.114));
	ALBEDO = mix(cor, tinta * (0.35 + lum * 1.3), tinta_forca);
	ROUGHNESS = 1.0;
	METALLIC = 0.0;
	float f = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	EMISSION = texture(brilho, UV).rgb * brilho_forca + borda_cor * borda_forca * f;
}

void light() {
	float n = clamp(dot(NORMAL, LIGHT), 0.0, 1.0) * ATTENUATION;
	float b = n > 0.45 ? faixas.x : (n > 0.12 ? faixas.y : faixas.z);
	DIFFUSE_LIGHT += LIGHT_COLOR * b / PI;
}

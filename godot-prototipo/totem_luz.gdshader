shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;
// Luz do totem de teleporte (André 2026-11-10): tipo 0 = o círculo de runas no tampo da plataforma (anéis, marcas e
// glifos girando devagar); tipo 1 = o cristal que flutua em cima do obelisco (núcleo claro e borda azul, fresnel).
uniform float tipo = 0.0;
uniform vec3 cor : source_color = vec3(0.35, 0.85, 1.0);
uniform float forca = 1.0;
float hash(float n) { return fract(sin(n * 12.9898) * 43758.5453); }
float anel(float r, float c, float e) { return 1.0 - smoothstep(e * 0.5, e, abs(r - c)); }
void fragment() {
	float pulso = 0.75 + 0.25 * sin(TIME * 1.6);
	if (tipo < 0.5) {
		vec2 p = (UV - 0.5) * 2.0; // -1..1
		float r = length(p);
		float a = atan(p.y, p.x);
		float m = anel(r, 0.94, 0.03) + anel(r, 0.80, 0.018) * 0.8 + anel(r, 0.5, 0.02) * 0.6;
		// marcas entre os anéis de fora, girando devagar
		float ag = a + TIME * 0.12;
		float n = 24.0, cel = floor(ag / 6.2831 * n), f = fract(ag / 6.2831 * n);
		float glifo = step(0.3, hash(cel)) * (1.0 - smoothstep(0.08, 0.16, abs(f - 0.5))) * step(0.83, r) * step(r, 0.91);
		// pétalas de dentro girando para o outro lado
		float ai = a - TIME * 0.2;
		float pet = (1.0 - smoothstep(0.0, 0.03, abs(r - (0.55 + 0.17 * abs(cos(ai * 3.0)))))) * step(r, 0.78);
		m += glifo * 0.9 + pet * 0.55;
		m *= 1.0 - smoothstep(0.96, 1.0, r);
		float fundo = (1.0 - smoothstep(0.0, 1.0, r)) * 0.12; // um véu claro no meio
		ALBEDO = cor * (m + fundo) * pulso * (0.5 + 0.9 * forca);
	} else {
		float fres = pow(1.0 - clamp(abs(dot(NORMAL, VIEW)), 0.0, 1.0), 2.0);
		ALBEDO = mix(vec3(0.85, 0.97, 1.0) * 0.7, cor * 1.6, fres) * pulso * (0.6 + 0.8 * forca);
	}
}

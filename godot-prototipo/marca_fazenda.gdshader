shader_type spatial;
render_mode unshaded, cull_disabled, shadows_disabled, fog_disabled, depth_draw_never;
// Marca do plano da fazenda (André 2026-11-07: "as que ainda não estão plantadas ficam verdes, como se fossem
// marcadas... queria uma coisa bonitinha de se observar"). No lugar do quadrado colorido chapado: uma moldura de
// luz suave com cantos arredondados, um brilho que corre devagar pela borda e o miolo quase transparente, que
// "respira". Tudo na placa de vídeo, uma malha só por canteiro.
uniform vec3 cor : source_color = vec3(1.0, 0.86, 0.5);
uniform float fase = 0.0;

float caixa(vec2 p, vec2 b, float r) {
	vec2 q = abs(p) - b + r;
	return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r;
}

void fragment() {
	vec2 p = UV - 0.5;
	float d = caixa(p, vec2(0.42), 0.14);
	float t = TIME + fase;
	float respira = 0.82 + 0.18 * sin(t * 2.2);
	// linha fina e nítida + halo macio dos dois lados
	float linha = 1.0 - smoothstep(0.0, 0.012, abs(d + 0.01));
	float halo = exp(-abs(d + 0.01) * 38.0) * 0.55;
	// brilho que dá a volta na moldura (uma volta a cada ~3 s)
	float ang = atan(p.y, p.x) / 6.2832 + 0.5;
	float corre = pow(0.5 + 0.5 * cos((ang - fract(t * 0.33)) * 6.2832), 10.0);
	// miolo: véu bem leve, mais forte perto da borda (some no meio)
	float miolo = (d < 0.0) ? smoothstep(-0.32, 0.0, d) * 0.16 : 0.0;
	float a = (linha * 0.85 + halo) * respira + corre * (linha + halo) * 0.9 + miolo * respira;
	vec3 c = mix(cor, vec3(1.0, 0.98, 0.9), corre * 0.6 + linha * 0.25);
	ALBEDO = c;
	ALPHA = clamp(a, 0.0, 1.0) * step(d, 0.06);
}

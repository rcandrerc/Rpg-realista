// Capa (armadura.gd): pano que balança e abre para trás com a corrida. O pano gira em volta da borda de cima
// (CUSTOM0 = ponto do alto da coluna); "abre" vem do script (0 parado, 1 correndo).
shader_type spatial;
render_mode cull_disabled, diffuse_toon, specular_disabled;

uniform vec4 fora : source_color = vec4(0.72, 0.13, 0.12, 1.0);
uniform vec4 dentro : source_color = vec4(0.42, 0.07, 0.08, 1.0);
uniform vec4 friso : source_color = vec4(1.0, 0.78, 0.32, 1.0);
uniform float brilho = 0.0;
instance uniform float abre = 0.0;

void vertex() {
	float t = UV.y;
	vec3 topo = vec3(VERTEX.x, UV2.y, UV2.x);
	vec3 d = VERTEX - topo;
	// parado: balanço leve; correndo: abre para trás e ondula
	float onda = sin(TIME * (2.2 + 4.0 * abre) - t * 5.0 + UV.x * 3.0);
	float ang = (0.04 + 0.95 * abre) * pow(t, 1.25) + onda * (0.025 + 0.09 * abre) * t;
	float c = cos(ang), s = sin(ang);
	// gira em volta do eixo x (lado a lado): para trás = -z
	d = vec3(d.x, d.y * c + d.z * s, -d.y * s + d.z * c);
	d.x += sin(TIME * 1.7 + t * 4.0) * 0.012 * t * (1.0 + abre);
	VERTEX = topo + d;
}

void fragment() {
	float borda = max(1.0 - smoothstep(0.012, 0.03, min(UV.x, 1.0 - UV.x)), 1.0 - smoothstep(0.965, 0.985, 1.0 - UV.y));
	borda = max(borda, 0.0);
	vec3 c = FRONT_FACING ? dentro.rgb : fora.rgb;
	// barra de baixo e laterais com friso dourado
	float fx = smoothstep(0.95, 0.965, UV.y) * (1.0 - smoothstep(0.975, 0.985, UV.y));
	c = mix(c, friso.rgb * 0.95, fx);
	ALBEDO = c;
	EMISSION = c * 0.08 + friso.rgb * fx * brilho * 0.4;
	ROUGHNESS = 0.9;
	RIM = 0.25;
	RIM_TINT = 0.5;
	NORMAL = FRONT_FACING ? NORMAL : -NORMAL;
}

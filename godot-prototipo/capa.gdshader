// Capa (armadura.gd): pano grosso que balança e abre para trás com a corrida. O pano gira em volta da borda de cima
// (UV2 = z e y do alto da coluna); a dobra cresce para baixo, como uma corrente de ossos (4 na vertical, 3 na
// horizontal: o meio e as pontas abrem diferente). "abre" vem do script (0 parado, 1 correndo); no máximo 40 graus.
// COLOR.r: 1 lado de fora, 0 lado de dentro, 0,5 beirada.
shader_type spatial;
render_mode cull_back, diffuse_toon, specular_disabled;

uniform vec4 fora : source_color = vec4(0.72, 0.13, 0.12, 1.0);
uniform vec4 dentro : source_color = vec4(0.42, 0.07, 0.08, 1.0);
uniform vec4 friso : source_color = vec4(0.85, 0.65, 0.29, 1.0);
uniform float brilho = 0.0;
instance uniform float abre = 0.0;

varying float v_lado;

void vertex() {
	float t = UV.y;
	float s = UV.x * 2.0 - 1.0;
	vec3 topo = vec3(VERTEX.x, UV2.y, UV2.x);
	vec3 d = VERTEX - topo;
	// curva em degraus suaves (cada "osso" dobra um pouco mais), pontas abrem mais que o meio
	float curva = pow(t, 1.8);
	float onda = sin(TIME * (2.0 + 4.5 * abre) - t * 6.0 + s * 2.0);
	float ang = (0.05 + 0.65 * abre) * curva * (1.0 + 0.18 * abs(s) * abre) + onda * (0.03 + 0.07 * abre) * t * t;
	ang = min(ang, 0.7); // 40 graus
	float c = cos(ang), sn = sin(ang);
	d = vec3(d.x, d.y * c + d.z * sn, -d.y * sn + d.z * c);
	// ondulação de lado (ossos horizontais)
	d.z -= sin(TIME * (1.6 + 3.0 * abre) + s * 3.5 - t * 4.0) * 0.02 * t * (0.4 + abre);
	d.x += sin(TIME * 1.7 + t * 4.0) * 0.01 * t * (1.0 + abre);
	VERTEX = topo + d;
	v_lado = COLOR.r;
}

void fragment() {
	vec3 c = v_lado > 0.75 ? fora.rgb : (v_lado < 0.25 ? dentro.rgb : friso.rgb);
	// barra dourada embaixo (e a beirada inteira dourada)
	float fx = smoothstep(0.94, 0.955, UV.y) * (1.0 - smoothstep(0.972, 0.985, UV.y));
	c = mix(c, friso.rgb, fx);
	ALBEDO = c;
	EMISSION = c * 0.06 + friso.rgb * max(fx, step(0.25, v_lado) * step(v_lado, 0.75)) * brilho * 0.3;
	ROUGHNESS = 0.9;
	RIM = 0.25;
	RIM_TINT = 0.5;
}

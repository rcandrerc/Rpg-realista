// Capa (armadura.gd): pano grosso que balança e abre para trás com a corrida. O pano gira em volta da borda de cima
// (UV2 = z e y do alto da coluna); a dobra cresce para baixo, como uma corrente de ossos (4 na vertical, 3 na
// horizontal: o meio e as pontas abrem diferente). "abre" vem do script (0 parado, 1 correndo).
// COLOR.r: 1 lado de fora, 0 lado de dentro, 0,5 beirada.
shader_type spatial;
render_mode cull_back, diffuse_toon, specular_disabled;

uniform vec4 fora : source_color = vec4(0.72, 0.13, 0.12, 1.0);
uniform vec4 dentro : source_color = vec4(0.42, 0.07, 0.08, 1.0);
uniform vec4 friso : source_color = vec4(0.85, 0.65, 0.29, 1.0);
uniform float brilho = 0.0;
instance uniform float abre = 0.0;
instance uniform float lado = 0.0; // virando: o pano vai para fora da curva (-1 a 1), vem do script
instance uniform float sobe = 0.0; // pulo e queda: o pano sobe na queda e desce na subida (-1 a 1)

varying float v_lado;

// André 2026-11-03: "a capa não voa quando corre". O giro antigo levava a barra para a FRENTE (+z), para dentro
// do corpo, e o pano parecia parado. Agora gira para trás (-z) e abre até ~70 graus na corrida, com ondas que
// correm do ombro para a barra, mais fortes nas pontas.
void vertex() {
	float t = UV.y;
	float s = UV.x * 2.0 - 1.0;
	vec3 topo = vec3(VERTEX.x, UV2.y, UV2.x);
	vec3 d = VERTEX - topo;
	// curva em degraus suaves (cada "osso" dobra um pouco mais), pontas abrem mais que o meio
	float curva = pow(t, 1.5);
	float vel_onda = 2.0 + 7.0 * abre;
	float onda = sin(TIME * vel_onda - t * 7.0 + s * 2.2);
	float onda2 = sin(TIME * vel_onda * 1.37 - t * 11.0 - s * 3.1);
	float ang = (0.06 + 0.8 * abre) * curva * (1.0 + 0.22 * abs(s) * abre)
		+ (onda * (0.04 + 0.2 * abre) + onda2 * 0.07 * abre) * t * t
		+ sobe * 0.5 * curva;
	ang = clamp(ang, -0.2, 1.1); // até ~63 graus
	float c = cos(ang), sn = sin(ang);
	d = vec3(d.x, d.y * c - d.z * sn, d.y * sn + d.z * c);
	// virando: o pano vai para o lado de fora da curva
	float la = lado * 0.55 * curva;
	d = vec3(d.x * cos(la) - d.y * sin(la), d.x * sin(la) + d.y * cos(la), d.z);
	// ondulação de lado (ossos horizontais): o pano faz "S" atravessado, mais forte correndo
	d.z -= sin(TIME * (1.6 + 5.0 * abre) + s * 3.5 - t * 5.0) * (0.02 + 0.045 * abre) * t;
	d.x += sin(TIME * (1.7 + 3.0 * abre) + t * 4.0) * 0.012 * t * (1.0 + 1.5 * abre);
	VERTEX = topo + d;
	vec3 n = NORMAL;
	n = vec3(n.x, n.y * c - n.z * sn, n.y * sn + n.z * c);
	NORMAL = vec3(n.x * cos(la) - n.y * sin(la), n.x * sin(la) + n.y * cos(la), n.z);
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

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

// Física de pano (pano_capa.gd, André 2026-11-04): com "pano" = 1 a malha segue uma grade de 8 x 7 pontos que o
// script simula (gravidade do mundo, ar, corpo e lobo). grade0 = grade em descanso; grade = agora (espaço da malha).
// Cada vértice acha a célula dele pelo UV, guarda a distância até a superfície da célula em descanso (dobras,
// espessura, cantos redondos) e repõe essa distância na célula dobrada. Sem o script, vale o giro antigo abaixo.
uniform float pano = 0.0;
uniform vec3 grade0[56];
uniform vec3 grade[56];

varying float v_lado;

const int PC = 8;
const int PL = 7;

mat3 celula(vec3 a, vec3 b, vec3 c, vec3 d, float u, float v, out vec3 p) {
	// a = (i, j), b = (i+1, j), c = (i, j+1), d = (i+1, j+1)
	p = mix(mix(a, b, u), mix(c, d, u), v);
	vec3 tu = mix(b - a, d - c, v);
	vec3 tv = mix(c - a, d - b, u);
	vec3 e1 = normalize(tu);
	vec3 e3 = normalize(cross(tu, tv));
	vec3 e2 = cross(e3, e1);
	return mat3(e1, e2, e3);
}

// André 2026-11-03: "a capa não voa quando corre". O giro antigo levava a barra para a FRENTE (+z), para dentro
// do corpo, e o pano parecia parado. Agora gira para trás (-z) e abre até ~70 graus na corrida, com ondas que
// correm do ombro para a barra, mais fortes nas pontas.
void vertex() {
	v_lado = COLOR.r;
	if (pano > 0.5) {
		float fu = clamp(UV.x, 0.0, 1.0) * float(PC - 1);
		float fv = clamp(UV.y, 0.0, 1.0) * float(PL - 1);
		int i = min(int(fu), PC - 2);
		int j = min(int(fv), PL - 2);
		float u = fu - float(i);
		float v = fv - float(j);
		int k = j * PC + i;
		vec3 r0;
		vec3 r1;
		mat3 f0 = celula(grade0[k], grade0[k + 1], grade0[k + PC], grade0[k + PC + 1], u, v, r0);
		mat3 f1 = celula(grade[k], grade[k + 1], grade[k + PC], grade[k + PC + 1], u, v, r1);
		mat3 gira = f1 * transpose(f0);
		vec3 d0 = gira * (VERTEX - r0);
		// ondinhas finas do pano correndo (a grade faz o balanço grande)
		float t0 = UV.y;
		float s0 = UV.x * 2.0 - 1.0;
		d0 += f1[2] * sin(TIME * (3.0 + 8.0 * abre) + s0 * 6.0 - t0 * 9.0) * 0.012 * abre * t0;
		VERTEX = r1 + d0;
		NORMAL = normalize(gira * NORMAL);
	} else {
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
	}
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

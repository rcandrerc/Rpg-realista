shader_type spatial;
render_mode diffuse_toon, specular_disabled, cull_disabled;
// Montanha (relevo.gd), em faixas como montanha de verdade (direção de arte 2026-11-05):
// - embaixo: a grama pintada do chão (emenda sem costura no pé), mais seca subindo;
// - meio: rocha com cascalho (talus) nas encostas médias, mais claro e miúdo, juntando no pé dos paredões;
// - alto: rocha nua, paredão mais escuro com camadas.
// Pedra: rocky_terrain_02 da Poly Haven (CC0) pintada (ferramentas/pintar-texturas), projetada nos 3 eixos com repetição
// de ~4 m e uma camada de detalhe de ~0,5 m (de perto não fica borrada nem esticada).
uniform sampler2D grama_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D pedra_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec3 tom_grama : source_color = vec3(0.91, 0.94, 0.85);
uniform float alto = 40.0;
// trilhas de terra subindo a encosta (a mesma máscara do chão plano: chao.gdshader), como a da Caverna da Montanha
uniform sampler2D mascara : filter_linear, repeat_disable;
uniform sampler2D terra_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec3 area = vec3(-38.0, -62.0, 292.0);
uniform float com_trilha = 0.0;
varying vec3 mundo;
varying vec3 nm;
void vertex() {
	mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	nm = NORMAL;
}
vec3 tri(vec3 p, vec3 b, float esc) {
	return texture(pedra_tex, p.zy / esc).rgb * b.x + texture(pedra_tex, p.xz / esc).rgb * b.y + texture(pedra_tex, p.xy / esc).rgb * b.z;
}
void fragment() {
	vec3 n = normalize(nm);
	vec2 w = vec2(mundo.x, -mundo.z);
	vec3 grama = texture(grama_tex, w * (70.0 / 320.0)).rgb * tom_grama;
	vec3 b = pow(abs(n), vec3(4.0));
	b /= b.x + b.y + b.z;
	vec3 base = tri(mundo, b, 4.0);
	vec3 det = tri(mundo, b, 0.5);
	vec3 pedra = base * (0.75 + 0.5 * dot(det, vec3(0.333))); // detalhe miúdo por cima da repetição de 4 m
	float hk = clamp(mundo.y / alto, 0.0, 1.0);
	float incl = 1.0 - n.y; // 0 deitado, 1 paredão
	float ruido = texture(pedra_tex, w / 37.0).g;
	float ruido2 = texture(pedra_tex, w / 11.0).r;
	// camadas de rocha no paredão (sedimento), onduladas
	float camada = 0.86 + 0.14 * smoothstep(0.3, 0.7, sin(mundo.y * 1.9 + sin(mundo.x * 0.09 + mundo.z * 0.07) * 3.0) * 0.5 + 0.5);
	// rocha aparece pela inclinação e pela altura (acima de ~45% quase só rocha)
	float pr = smoothstep(0.16, 0.3, incl + (ruido - 0.5) * 0.25 + smoothstep(0.3, 0.6, hk) * 0.35);
	// talus: cascalho claro nas encostas médias (nem deitado nem paredão), na faixa do meio da montanha
	float talus = smoothstep(0.12, 0.25, incl) * (1.0 - smoothstep(0.42, 0.6, incl)) * smoothstep(0.18, 0.35, hk) * (1.0 - smoothstep(0.7, 0.9, hk));
	vec3 cascalho = mix(base, det, 0.6) * vec3(1.12, 1.1, 1.04) * (0.85 + 0.3 * ruido2);
	vec3 g = mix(grama, grama * vec3(1.1, 1.0, 0.75), smoothstep(0.15, 0.45, hk)); // grama alta mais seca
	vec3 rocha = pedra * camada;
	rocha = mix(rocha, cascalho, talus * smoothstep(0.35, 0.55, ruido2 + 0.2));
	rocha *= mix(1.0, 0.76, smoothstep(0.45, 0.78, incl)); // paredão mais escuro
	rocha = mix(rocha, rocha * vec3(1.06, 1.06, 1.08), smoothstep(0.75, 1.0, hk)); // cume de rocha nua, mais clara ao sol
	vec3 c = mix(g, rocha, pr);
	if (com_trilha > 0.5) {
		vec2 uvm = (mundo.xz - area.xy) / area.z;
		if (uvm.x > 0.0 && uvm.y > 0.0 && uvm.x < 1.0 && uvm.y < 1.0) {
			float pt = smoothstep(0.3, 0.62, texture(mascara, uvm).r + (ruido2 - 0.5) * 0.3) * (1.0 - smoothstep(0.35, 0.6, incl));
			c = mix(c, texture(terra_tex, w / 3.2).rgb * 0.82, pt);
		}
	}
	ALBEDO = c;
	ROUGHNESS = 1.0;
}

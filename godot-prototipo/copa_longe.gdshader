shader_type spatial;
render_mode specular_disabled, cull_back;
// Copa simples das árvores vistas de longe (relevo.gd copas_simples): a textura da folha das árvores de verdade nos
// 3 eixos, o tom de cada árvore (cor da instância) e o miolo de baixo mais escuro. Perto da câmera (< 76 m) a copa
// encolhe até sumir dentro da árvore de verdade, que ainda está desenhada.
uniform sampler2D folha_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform float perto = 76.0;
varying vec3 mundo;
varying vec3 normal_mundo;
void vertex() {
	vec3 o = MODEL_MATRIX[3].xyz;
	float k = smoothstep(perto, perto + 6.0, distance(o.xz, CAMERA_POSITION_WORLD.xz));
	VERTEX *= k;
	mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	normal_mundo = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment() {
	vec3 b = abs(normal_mundo);
	b /= (b.x + b.y + b.z);
	vec3 t = texture(folha_tex, mundo.zy / 2.2).rgb * b.x + texture(folha_tex, mundo.xz / 2.2).rgb * b.y + texture(folha_tex, mundo.xy / 2.2).rgb * b.z;
	ALBEDO = t * COLOR.rgb * mix(0.5, 1.0, UV.y);
	ROUGHNESS = 1.0;
}

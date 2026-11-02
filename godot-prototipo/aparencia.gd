extends RefCounted
# Aparência do criador de personagem no corpo da Ruiva, igual ao site (tingirVRM e aplicarRosto em client/src/personagens.js):
# cor do cabelo, dos olhos, da pele, da roupa e da calça, altura e tamanho dos olhos, do nariz e da boca.
# Cada personagem pinta só a cópia dele (material por cima com set_surface_override_material): a malha é dividida entre todos.
# A cor troca no shader (toon como o dos personagens, com a troca de cor no meio), então mudar é na hora.
# O formato do rosto vem pronto no GLB como blend shape (olhosT, narizT, bocaT; client/exportar-godot/exportar.js).

const PARTES := [["FaceBrow", "sobrancelha"], ["HAIR", "cabelo"], ["EyeIris", "olhos"], ["SKIN", "pele"], ["Bottoms", "calca"], ["Tops", "roupa"], ["Accessory", "roupa"]]
const ROSTO := ["olhosT", "narizT", "bocaT"]
const CORES := ["cabelo", "olhos", "pele", "roupa", "calca"]

# troca a cor guardando o claro e escuro da textura ("troca"); a pele multiplica cada canal ("razao"), como no site
# As contas são feitas no mesmo espaço de cor em que a textura chega no shader (linear no celular; no renderizador de
# compatibilidade da nuvem ela chega sem converter), então a parte tingida fica igual ao resto em qualquer um.
const TINTA := """
uniform vec3 tinta_cor = vec3(1.0);
uniform vec3 tinta_media = vec3(0.5);
uniform float tinta_razao = 0.0;
uniform float tinta_teto = 1.0;
uniform vec3 tinta_piso = vec3(0.0);
vec3 tingir_cor(vec3 s) {
	vec3 r;
	float lm = max(0.003, dot(tinta_media, vec3(0.3, 0.59, 0.11)));
	float l = dot(s, vec3(0.3, 0.59, 0.11)) / lm;
	if (tinta_razao > 0.5) {
		r = min(vec3(1.0), s * tinta_cor / max(tinta_media, vec3(0.003)));
		r = mix(vec3(dot(r, vec3(0.3, 0.59, 0.11))), r, 0.85); // um pouco menos saturada: a luz toon do Godot puxa para o laranja
		r = max(r, tinta_piso); // a pele mais escura nunca abaixo de #4a3024 (senão a sombra vira preto)
		// só a pele: as linhas do desenho (boca, nariz, olhos), bem mais escuras que a pele, ficam como estão
		r = mix(s, r, smoothstep(0.35, 0.7, l));
	} else {
		r = tinta_cor * (0.32 + 0.62 * min(l, 1.3));
		r *= min(1.0, tinta_teto / max(0.001, max(r.r, max(r.g, r.b)))); // limita o claro sem mudar o tom
	}
	return r;
}
"""


static var _tingidos := {} # "id do material|cor" -> material tingido
static var _medias := {} # "id da textura|claro" -> cor média (sRGB)
static var _shaders := {} # código -> Shader

# Aparência que veio do servidor, do criador ou do arquivo: só o que a lista do criador aceita (como aparenciaValida)
static func valida(a, criador: Dictionary) -> Dictionary:
	var r := {}
	var d: Dictionary = a if a is Dictionary else {}
	for k in CORES:
		var c = d.get(k)
		r[k] = null
		if c != null:
			for ok in criador[k]:
				if ok != null and int(ok) == int(c):
					r[k] = int(ok)
	var alt: Array = criador.altura
	r.altura = snappedf(clampf(float(d.get("altura", 1.0)) if d.get("altura") != null else 1.0, float(alt[0]), float(alt[1])), 0.01)
	for k in ROSTO:
		var lim: Array = criador.rosto[k]
		var v = d.get(k)
		r[k] = snappedf(clampf(float(v) if v != null else 1.0, float(lim[0]), float(lim[1])), 0.01)
	return r

# Pinta, estica e forma o rosto de um personagem (no = o que main.modelo devolveu)
static func aplicar(no: Node3D, ap) -> void:
	var a: Dictionary = ap if ap is Dictionary else {}
	var alt = a.get("altura")
	no.scale = Vector3.ONE * (float(alt) if alt != null else 1.0)
	for mi in no.find_children("*", "MeshInstance3D", true, false):
		var malha: Mesh = mi.mesh
		if malha == null:
			continue
		for i in malha.get_surface_count():
			var base = malha.surface_get_material(i)
			var parte := _parte(base, malha, i)
			var cor = null
			if parte == "sobrancelha":
				cor = a.get("cabelo")
				if cor != null:
					cor = _int(_cor(int(cor)).darkened(0.25))
			elif parte != "":
				cor = a.get(parte)
				if cor == null and parte == "calca":
					cor = a.get("roupa")
			var dono := _contorno_de(base, malha, i) # contorno escuro do cabelo ou da pele: vai junto com a cor
			if dono != "" and a.get(dono) != null:
				mi.set_surface_override_material(i, _contorno(base, int(a[dono])))
				continue
			if cor == null:
				if mi.get_surface_override_material(i) != null:
					mi.set_surface_override_material(i, null)
			else:
				mi.set_surface_override_material(i, _tingido(base, int(cor), parte))
		for k in ROSTO:
			var idx: int = mi.find_blend_shape_by_name(k)
			if idx >= 0:
				var v = a.get(k)
				mi.set_blend_shape_value(idx, (float(v) if v != null else 1.0) - 1.0)

static func _parte(base, malha: Mesh, i: int) -> String:
	if not (base is StandardMaterial3D) or base.albedo_texture == null:
		return "" # o contorno não tem textura (fica escuro como está)
	var nome: String = base.resource_name + " " + malha.surface_get_name(i)
	if "(Outline)" in nome:
		return ""
	for p in PARTES:
		if p[0] in nome:
			return p[1]
	return ""

# cor sRGB no espaço em que a textura chega no shader
static func _esp(c: Color) -> Vector3:
	if RenderingServer.get_current_rendering_method() != "gl_compatibility":
		c = c.srgb_to_linear()
	return Vector3(c.r, c.g, c.b)

static func _int(c: Color) -> int:
	return (c.r8 << 16) | (c.g8 << 8) | c.b8

# contorno escuro (casca de main.pintar) do cabelo e da pele: vai junto com a cor, senão vira um arco preto
# em volta da orelha e das mechas quando o cabelo ou a pele ficam claros
static func _contorno_de(base, malha: Mesh, i: int) -> String:
	if not (base is StandardMaterial3D):
		return ""
	var nome: String = base.resource_name + " " + malha.surface_get_name(i)
	if not "(Outline)" in nome:
		return ""
	return "cabelo" if "HAIR" in nome else ("pele" if "SKIN" in nome else "")

static func _contorno(base: StandardMaterial3D, cor: int) -> Material:
	var chave := "c%d|%d" % [base.get_instance_id(), cor]
	if not _tingidos.has(chave):
		var n: StandardMaterial3D = base.duplicate()
		n.albedo_color = _cor(cor).darkened(0.55).lerp(Color(0.12, 0.08, 0.08), 0.3)
		_tingidos[chave] = n
	return _tingidos[chave]

static func _cor(c: int) -> Color:
	return Color8((c >> 16) & 255, (c >> 8) & 255, c & 255)

# shader toon igual ao que o Godot faz para os materiais dos personagens (main.pintar: toon, sem brilho, contorno de luz),
# com a troca de cor no meio. Um por jeito de transparência e de lado desenhado.
static func _shader(base: StandardMaterial3D, pele := false, rosto := false) -> Shader:
	var tr := base.transparency
	var modos := ["blend_mix", "depth_draw_opaque", "diffuse_toon", "specular_disabled",
		["cull_back", "cull_front", "cull_disabled"][base.cull_mode]]
	if tr == BaseMaterial3D.TRANSPARENCY_ALPHA_DEPTH_PRE_PASS:
		modos.append("depth_prepass_alpha")
	var alfa := ""
	if tr == BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR or tr == BaseMaterial3D.TRANSPARENCY_ALPHA_HASH:
		alfa = "ALPHA = albedo.a * t.a;\n\tALPHA_SCISSOR_THRESHOLD = alpha_scissor_threshold;"
	elif tr != BaseMaterial3D.TRANSPARENCY_DISABLED:
		alfa = "ALPHA = albedo.a * t.a;"
	var rim := "RIM = rim;\n\tRIM_TINT = rim_tint;" if base.rim_enabled else ""
	# pele: a sombra sai da própria cor (um pouco de luz própria segura o lado escuro, uns 78% do claro) e o rosto não
	# recebe a sombra do cabelo cheia, senão a pele escura virava preto e a boca e o nariz sumiam
	var luz := ""
	if pele:
		# luz toon própria: o lado da sombra fica com 78% do claro, e a sombra que cai (cabelo no rosto) pesa no máximo 35%
		luz = """
void light() {
	float lado = smoothstep(-0.02, 0.02, dot(NORMAL, LIGHT));
	float caida = mix(1.0, ATTENUATION, %s);
	DIFFUSE_LIGHT += LIGHT_COLOR * mix(0.78, 1.0, lado * caida) / PI;
}
""" % ("0.35" if rosto else "1.0")
	var codigo := """shader_type spatial;
render_mode %s;
uniform vec4 albedo : source_color = vec4(1.0);
uniform sampler2D texture_albedo : source_color, filter_linear_mipmap, repeat_enable;
uniform float alpha_scissor_threshold = 0.5;
uniform float rim = 0.25;
uniform float rim_tint = 0.6;
uniform vec3 uv1_scale = vec3(1.0);
uniform vec3 uv1_offset = vec3(0.0);
%s
void vertex() {
	UV = UV * uv1_scale.xy + uv1_offset.xy;
}
void fragment() {
	vec4 t = texture(texture_albedo, UV);
	t.rgb = tingir_cor(t.rgb);
	ALBEDO = albedo.rgb * t.rgb;
	ROUGHNESS = 1.0;
	METALLIC = 0.0;
	SPECULAR = 0.0;
	%s
	%s
}
%s""" % [", ".join(modos), TINTA, alfa, rim, luz]
	if not _shaders.has(codigo):
		var sh := Shader.new()
		sh.code = codigo
		_shaders[codigo] = sh
	return _shaders[codigo]

static func _tingido(base: StandardMaterial3D, cor: int, parte: String) -> Material:
	var chave := "%d|%d" % [base.get_instance_id(), cor]
	if _tingidos.has(chave):
		return _tingidos[chave]
	var alvo := _cor(cor)
	var sm := ShaderMaterial.new()
	sm.shader = _shader(base, parte == "pele", parte == "pele" and "Face" in base.resource_name)
	# o laranja que a Ruiva leva no cabelo e o rosado da pele (main.pintar) não podem somar com a cor nova
	sm.set_shader_parameter("albedo", Color(1, 1, 1, base.albedo_color.a))
	sm.set_shader_parameter("texture_albedo", base.albedo_texture)
	sm.set_shader_parameter("alpha_scissor_threshold", base.alpha_scissor_threshold)
	sm.set_shader_parameter("rim", base.rim)
	sm.set_shader_parameter("rim_tint", base.rim_tint)
	sm.set_shader_parameter("uv1_scale", base.uv1_scale)
	sm.set_shader_parameter("uv1_offset", base.uv1_offset)
	sm.set_shader_parameter("tinta_cor", _esp(alvo))
	sm.set_shader_parameter("tinta_media", _esp(media(base.albedo_texture, parte == "pele")))
	sm.set_shader_parameter("tinta_piso", _esp(Color8(0x4a, 0x30, 0x24)))
	sm.set_shader_parameter("tinta_razao", 1.0 if parte == "pele" else 0.0)
	# cabelo claro não estoura em branco chapado (a luz do Godot clareia bastante): no máximo uns #b8b5ae no material, para o degrau de sombra aparecer
	sm.set_shader_parameter("tinta_teto", _esp(Color.WHITE * (0.62 if parte == "cabelo" else 0.95)).x)
	sm.render_priority = base.render_priority
	_tingidos[chave] = sm
	return sm

# cor média da textura (sRGB), só onde não é transparente: base do "troca". Na pele (claro = true) vale a média só da
# parte clara (a pele de verdade, sem os traços e as sombras desenhadas), senão o corpo, que tem mais traço que o rosto,
# ficava mais claro que o rosto depois de tingido.
static func media(tex: Texture2D, claro := false) -> Color:
	var id := "%d|%s" % [tex.get_instance_id(), claro]
	if _medias.has(id):
		return _medias[id]
	var r := Color(0.5, 0.5, 0.5)
	var img := tex.get_image()
	if img != null:
		img = img.duplicate()
		if img.is_compressed():
			img.decompress()
		if not img.is_compressed():
			img.convert(Image.FORMAT_RGBA8)
			img.resize(48, 48, Image.INTERPOLATE_BILINEAR)
			var px: Array[Vector3] = []
			var soma := Vector3.ZERO
			for y in 48:
				for x in 48:
					var c := img.get_pixel(x, y)
					if c.a > 0.03:
						px.append(Vector3(c.r, c.g, c.b))
						soma += Vector3(c.r, c.g, c.b)
			if px.size() > 0:
				soma /= px.size()
				if claro:
					var lum := soma.dot(Vector3(0.3, 0.59, 0.11))
					var s2 := Vector3.ZERO
					var n := 0
					for v in px:
						if v.dot(Vector3(0.3, 0.59, 0.11)) >= lum:
							s2 += v
							n += 1
					if n > 0:
						soma = s2 / n
				r = Color(maxf(soma.x, 0.03), maxf(soma.y, 0.03), maxf(soma.z, 0.03))
	_medias[id] = r
	return r

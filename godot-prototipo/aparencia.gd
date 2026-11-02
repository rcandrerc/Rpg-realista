extends RefCounted
# Aparência do criador de personagem no corpo da Ruiva, igual ao site (tingirVRM e aplicarRosto em client/src/personagens.js):
# cor do cabelo, dos olhos, da pele, da roupa e da calça, altura e tamanho dos olhos, do nariz e da boca.
# Cada personagem pinta só a cópia dele (material por cima com set_surface_override_material): a malha é dividida entre todos.
# A cor troca no shader (toon como o dos personagens, com a troca de cor no meio), então mudar é na hora.
# O formato do rosto vem pronto no GLB como blend shape (olhosT, narizT, bocaT; client/exportar-godot/exportar.js).

const PARTES := [["HAIR", "cabelo"], ["EyeIris", "olhos"], ["SKIN", "pele"], ["Bottoms", "calca"], ["Tops", "roupa"], ["Accessory", "roupa"]]
const ROSTO := ["olhosT", "narizT", "bocaT"]
const CORES := ["cabelo", "olhos", "pele", "roupa", "calca"]

# troca a cor guardando o claro e escuro da textura ("troca"); a pele multiplica cada canal ("razao"), como no site
const TINTA := """
uniform vec3 tinta_cor = vec3(1.0);
uniform vec3 tinta_media = vec3(0.5);
uniform float tinta_razao = 0.0;
vec3 tinta_srgb(vec3 c) { return mix(c * 12.92, 1.055 * pow(max(c, vec3(0.0)), vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c)); }
vec3 tinta_linear(vec3 c) { return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }
vec3 tingir_cor(vec3 lin) {
	vec3 s = tinta_srgb(lin);
	vec3 r;
	if (tinta_razao > 0.5) {
		r = min(vec3(1.0), s * tinta_cor / max(tinta_media, vec3(0.03)));
		r = mix(vec3(dot(r, vec3(0.3, 0.59, 0.11))), r, 0.85); // um pouco menos saturada: a luz toon do Godot puxa para o laranja
	} else {
		float lm = max(0.03, dot(tinta_media, vec3(0.3, 0.59, 0.11)));
		float l = min(1.7, dot(s, vec3(0.3, 0.59, 0.11)) / lm);
		r = min(vec3(1.0), tinta_cor * (0.35 + 0.65 * l));
	}
	return tinta_linear(r);
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
			if parte != "":
				cor = a.get(parte)
				if cor == null and parte == "calca":
					cor = a.get("roupa")
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

static func _cor(c: int) -> Color:
	return Color8((c >> 16) & 255, (c >> 8) & 255, c & 255)

# shader toon igual ao que o Godot faz para os materiais dos personagens (main.pintar: toon, sem brilho, contorno de luz),
# com a troca de cor no meio. Um por jeito de transparência e de lado desenhado.
static func _shader(base: StandardMaterial3D) -> Shader:
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
""" % [", ".join(modos), TINTA, alfa, rim]
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
	sm.shader = _shader(base)
	# o laranja que a Ruiva leva no cabelo (main.pintar) não pode somar com a cor nova. A pele sai um pouco mais escura:
	# com a luz do Godot a pele original já fica quase branca, e uma pele morena estourava em laranja
	sm.set_shader_parameter("albedo", Color(0.8, 0.76, 0.74, base.albedo_color.a) if parte == "pele" else Color(1, 1, 1, base.albedo_color.a))
	sm.set_shader_parameter("texture_albedo", base.albedo_texture)
	sm.set_shader_parameter("alpha_scissor_threshold", base.alpha_scissor_threshold)
	sm.set_shader_parameter("rim", base.rim)
	sm.set_shader_parameter("rim_tint", base.rim_tint)
	sm.set_shader_parameter("uv1_scale", base.uv1_scale)
	sm.set_shader_parameter("uv1_offset", base.uv1_offset)
	sm.set_shader_parameter("tinta_cor", Vector3(alvo.r, alvo.g, alvo.b))
	var med := media(base.albedo_texture, parte == "pele")
	sm.set_shader_parameter("tinta_media", Vector3(med.r, med.g, med.b))
	sm.set_shader_parameter("tinta_razao", 1.0 if parte == "pele" else 0.0)
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

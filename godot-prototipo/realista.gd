# Visual semi-realista do personagem (André 2026-11-07, estilo Where Winds Meet / Age of Wushu; ele aprovou ligar):
# pele com textura, sombra macia e quente e dobras marcadas (pele_real.gdshader), cabelo com brilho de fio e o
# contorno de desenho bem mais fino. O rosto continua o do VRoid (anime).
# Quem chama: Aparencia.aplicar e Armadura.vestir (no fim). A pele tingida da aparência vira a pele realista com a
# mesma tinta (Aparencia.TINTA).
extends RefCounted

const CONTORNO := 0.0012 # era 0.006 (main.pintar)
static var _feitos := {}
static var _tingida: Shader
static var ligado := true # false volta ao visual de desenho

static func aplicar(no: Node3D) -> void:
	if not ligado:
		return
	for mi in no.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null or str(mi.name).begins_with("Armadura") or mi.material_override != null:
			continue
		for i in mi.mesh.get_surface_count():
			var nome: String = mi.mesh.surface_get_name(i)
			var m: Material = mi.get_surface_override_material(i)
			if m == null:
				m = mi.mesh.surface_get_material(i)
			if not (m is StandardMaterial3D or (m is ShaderMaterial and m.get_meta("parte", "") == "pele")):
				continue
			if m.has_meta("realista"):
				continue # já trocado
			var chave := m.get_instance_id()
			if not _feitos.has(chave):
				_feitos[chave] = _trocar(m, nome)
				_feitos[chave].set_meta("realista", true)
			if _feitos[chave] != m:
				mi.set_surface_override_material(i, _feitos[chave])

static func _trocar(m: Material, nome: String) -> Material:
	if m is ShaderMaterial:
		return _pele_tingida(m, nome)
	if "Outline" in nome:
		var o: StandardMaterial3D = m.duplicate()
		o.grow_amount = CONTORNO
		if not m.has_meta("tingido"): # o contorno tingido da aparência fica com a cor dele
			o.albedo_color = Color(0.26, 0.17, 0.15)
		return o
	if "SKIN" in nome or "SKIN" in m.resource_name:
		var s := ShaderMaterial.new()
		s.shader = preload("res://pele_real.gdshader")
		s.set_shader_parameter("albedo", m.albedo_color)
		s.set_shader_parameter("texture_albedo", m.albedo_texture)
		s.set_shader_parameter("rosto", 1.0 if "Face" in nome else 0.0)
		if m.vertex_color_use_as_albedo:
			s.set_shader_parameter("cor_vertice_escala", Vector4(1, 1, 1, 1))
		if m.next_pass is StandardMaterial3D:
			var o: StandardMaterial3D = m.next_pass.duplicate()
			o.grow_amount = CONTORNO
			s.next_pass = o
		return s
	if "HAIR" in nome:
		var h: StandardMaterial3D = m.duplicate()
		h.diffuse_mode = BaseMaterial3D.DIFFUSE_BURLEY
		h.specular_mode = BaseMaterial3D.SPECULAR_SCHLICK_GGX
		h.roughness = 0.55
		h.metallic_specular = 0.25
		h.rim = 0.12
		if h.next_pass is StandardMaterial3D:
			var o: StandardMaterial3D = h.next_pass.duplicate()
			o.grow_amount = CONTORNO
			h.next_pass = o
		return h
	# só a íris e o branco do olho: "Eye" sozinho pegava também cílios e delineado (FaceEyelash, FaceEyeline)
	if "EyeIris" in nome or "EyeWhite" in nome:
		var e: StandardMaterial3D = m.duplicate()
		e.diffuse_mode = BaseMaterial3D.DIFFUSE_BURLEY
		e.specular_mode = BaseMaterial3D.SPECULAR_SCHLICK_GGX
		e.roughness = 0.15 # superfície vítrea brilhante dos olhos
		e.metallic_specular = 0.5
		e.rim = 0.08
		return e
	return m

# pele com a cor escolhida no criador: o mesmo pele_real com a troca de cor da aparência no meio
static func _pele_tingida(t: ShaderMaterial, nome: String) -> Material:
	if _tingida == null:
		var c: String = preload("res://pele_real.gdshader").code
		c = c.replace("varying vec3 q;", preload("res://aparencia.gd").TINTA + "\nvarying vec3 q;")
		c = c.replace("vec4 t = texture(texture_albedo, UV);", "vec4 t = texture(texture_albedo, UV);\n\tt.rgb = tingir_cor(t.rgb);")
		_tingida = Shader.new()
		_tingida.code = c
	var base: StandardMaterial3D = t.get_meta("base")
	var s := ShaderMaterial.new()
	s.shader = _tingida
	for k in ["tinta_cor", "tinta_media", "tinta_piso", "tinta_razao", "tinta_teto"]:
		s.set_shader_parameter(k, t.get_shader_parameter(k))
	s.set_shader_parameter("albedo", Color(1, 1, 1, 1))
	s.set_shader_parameter("texture_albedo", base.albedo_texture)
	s.set_shader_parameter("rosto", 1.0 if "Face" in nome or "Face" in base.resource_name else 0.0)
	if base.next_pass is StandardMaterial3D:
		var o: StandardMaterial3D = base.next_pass.duplicate()
		o.grow_amount = CONTORNO
		s.next_pass = o
	return s

# Visual semi-realista do personagem (teste, André 2026-11-07: estilo Where Winds Meet / Age of Wushu): pele com
# textura, sombra macia e quente e dobras marcadas (pele_real.gdshader), cabelo com brilho de fio e o contorno de
# desenho bem mais fino. O rosto continua o do VRoid (anime).
extends RefCounted

const CONTORNO := 0.0022 # era 0.006 (main.pintar)
static var _feitos := {}

static func aplicar(no: Node3D) -> void:
	for mi in no.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null or str(mi.name).begins_with("Armadura") or mi.material_override != null:
			continue
		for i in mi.mesh.get_surface_count():
			var nome: String = mi.mesh.surface_get_name(i)
			var m: Material = mi.get_surface_override_material(i)
			if m == null:
				m = mi.mesh.surface_get_material(i)
			if not (m is StandardMaterial3D):
				continue
			var chave := m.get_instance_id()
			if not _feitos.has(chave):
				_feitos[chave] = _trocar(m, nome)
			if _feitos[chave] != m:
				mi.set_surface_override_material(i, _feitos[chave])

static func _trocar(m: StandardMaterial3D, nome: String) -> Material:
	if "Outline" in nome:
		var o: StandardMaterial3D = m.duplicate()
		o.grow_amount = CONTORNO
		o.albedo_color = Color(0.2, 0.13, 0.12)
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
	return m

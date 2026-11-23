extends RefCounted
# Proposta de equipamentos por raridade (setor de arte, 2026-11-23): veste no herói as peças de pecas_rN.glb
# (modelar.py) só para as fotos (foto.gd). Não mexe no jogo: a armadura de hoje continua igual.
# peito* vai no osso UpperChest, ombro_e*/ombro_d* nos braços e espada* no lugar do modelo da espada.

var pasta: String = (get_script() as Script).resource_path.get_base_dir()
var shader: Shader
var ruido: Texture2D
var _postos: Array = []
var _mats := {}

# material -> [tipo, cor, cor2, luz, metal, aspereza, força]
const M := {
	"couro": [0, "8a5c38", "000000", "000000", 0.0, 0.75, 1.0],
	"couro_escuro": [0, "3e2a1c", "000000", "000000", 0.0, 0.8, 1.0],
	"ferro": [1, "8e8a84", "202020", "000000", 0.85, 0.55, 1.0],
	"ferro_fio": [1, "c8c6c0", "303030", "000000", 0.9, 0.35, 1.0],
	"aco": [1, "8c939e", "4a5a70", "000000", 0.95, 0.3, 1.0],
	"aco_fio": [1, "eef2f8", "606a78", "000000", 1.0, 0.18, 1.0],
	"aco_escuro": [1, "5a6170", "202838", "000000", 0.9, 0.4, 1.0],
	"pano": [2, "1f4e9c", "000000", "000000", 0.0, 0.9, 1.0],
	"aco_azul": [1, "283352", "6a4aa8", "000000", 0.95, 0.28, 1.0],
	"ouro": [1, "e0b04a", "7a4a10", "000000", 1.0, 0.25, 1.0],
	"gema_roxa": [3, "7a2ad0", "e0b0ff", "b04aff", 0.0, 0.1, 2.2],
	"runa": [7, "7a2ad0", "000000", "c070ff", 0.0, 0.4, 2.4],
	"obsidiana": [4, "24201e", "6a2a10", "ff5a10", 0.7, 0.35, 3.0],
	"brasa": [3, "ff6a10", "ffd060", "ff4a00", 0.0, 0.2, 4.0],
	"brasa_linha": [7, "ff6a10", "000000", "ff6010", 0.0, 0.4, 3.5],
	"bronze": [1, "b0703a", "5a2a10", "000000", 1.0, 0.3, 1.0],
	"perola": [5, "e8ecf4", "7ad8ff", "000000", 0.6, 0.22, 1.2],
	"ouro_claro": [1, "f4dc9a", "a08040", "000000", 1.0, 0.2, 1.0],
	"cristal": [6, "1a5a8a", "6ae8ff", "ffffff", 0.0, 0.05, 1.6],
	"cristal_fio": [6, "2a7aaa", "b0f4ff", "ffffff", 0.0, 0.05, 2.2],
}

func _init() -> void:
	shader = Shader.new()
	shader.code = FileAccess.get_file_as_string(pasta + "/equip_novo.gdshader")
	var nt := NoiseTexture2D.new()
	nt.width = 128
	nt.height = 128
	nt.seamless = true
	nt.generate_mipmaps = true
	var fn := FastNoiseLite.new()
	fn.frequency = 0.03
	fn.fractal_octaves = 3
	nt.noise = fn
	ruido = nt

func material(nome: String) -> Material:
	var k := nome.split(".")[0]
	if not M.has(k):
		print("material sem tabela: ", nome)
		k = "aco"
	if _mats.has(k):
		return _mats[k]
	var d: Array = M[k]
	var sm := ShaderMaterial.new()
	sm.shader = shader
	sm.set_shader_parameter("tipo", d[0])
	sm.set_shader_parameter("cor", Color(d[1]))
	sm.set_shader_parameter("cor2", Color(d[2]))
	sm.set_shader_parameter("luz", Color(d[3]))
	sm.set_shader_parameter("metal", d[4])
	sm.set_shader_parameter("aspereza", d[5])
	sm.set_shader_parameter("forca", d[6])
	sm.set_shader_parameter("ruido", ruido)
	_mats[k] = sm
	return sm

func _malhas(n: Node, out: Array) -> void:
	if n is MeshInstance3D:
		out.append(n)
	for c in n.get_children():
		_malhas(c, out)

func vestir(heroi: Node3D, esq: Skeleton3D, espada: Node3D, r: int) -> void:
	for p in _postos:
		if is_instance_valid(p):
			p.queue_free()
	_postos.clear()
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	if doc.append_from_file(pasta + "/pecas_r%d.glb" % r, st) != OK:
		print("não abriu pecas_r%d.glb" % r)
		return
	var cena: Node = doc.generate_scene(st)
	var ms: Array = []
	_malhas(cena, ms)
	# esconde a espada de hoje (só as malhas dela)
	var velhas: Array = []
	_malhas(espada, velhas)
	for v in velhas:
		if not v.has_meta("novo"):
			v.visible = false
	for mi: MeshInstance3D in ms:
		var nome := String(mi.name)
		var malha: Mesh = mi.mesh
		for s in malha.get_surface_count():
			malha.surface_set_material(s, material(malha.surface_get_material(s).resource_name if malha.surface_get_material(s) else "aco"))
		var novo := MeshInstance3D.new()
		novo.mesh = malha
		novo.set_meta("novo", true)
		novo.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		if nome.begins_with("espada"):
			# Blender Z-cima -> glTF Y-cima: a lâmina já sai em +Y, cabo na origem (mesma regra da espada de hoje)
			espada.add_child(novo)
			_postos.append(novo)
			if r >= 3:
				_faiscas(novo, r, Vector3(0, 0.55, 0), Vector3(0.03, 0.4, 0.01), 14)
			continue
		var osso := "J_Bip_C_UpperChest"
		if nome.begins_with("ombro_e"):
			osso = "J_Bip_L_Shoulder"
		elif nome.begins_with("ombro_d"):
			osso = "J_Bip_R_Shoulder"
		var i := esq.find_bone(osso)
		if nome.begins_with("ombro"):
			# ombreira modelada com o braço caído: gira em volta do ombro até o eixo do braço de agora (foto parada)
			var lado := 1.0 if nome.begins_with("ombro_e") else -1.0
			var lb := "J_Bip_L_" if lado > 0 else "J_Bip_R_"
			var u := esq.find_bone(lb + "UpperArm")
			var a0 := esq.get_bone_global_pose(u).origin
			var d := (esq.get_bone_global_pose(esq.find_bone(lb + "LowerArm")).origin - a0).normalized()
			var A := Vector3(lado * sin(deg_to_rad(28.0)), -cos(deg_to_rad(28.0)), 0.0).normalized()
			var q := Quaternion.IDENTITY.slerp(Quaternion(A, d), 0.75)
			var rest0 := esq.get_bone_global_rest(u).origin
			esq.add_child(novo)
			_postos.append(novo)
			novo.transform = Transform3D(Basis(q), a0 - Basis(q) * rest0)
			if r == 4:
				_faiscas(novo, r, Vector3(0.2 * lado, 1.33, 0.0), Vector3(0.05, 0.04, 0.05), 6)
			continue
		var ba := BoneAttachment3D.new()
		ba.bone_name = osso
		esq.add_child(ba)
		_postos.append(ba)
		ba.add_child(novo)
		novo.transform = esq.get_bone_global_rest(i).affine_inverse()
		if nome == "peito" and r >= 3:
			_faiscas(novo, r, Vector3(0, 1.2, 0.17), Vector3(0.05, 0.05, 0.02), 10)
		if nome.begins_with("ombro") and r == 4:
			_faiscas(novo, r, Vector3(0.2 * (1 if nome.ends_with("e") else -1), 1.33, 0.0), Vector3(0.05, 0.04, 0.05), 6)
	cena.free()

func espada_escala(espada: Node3D) -> float:
	# a espada de hoje tem a ponta em 0,924 m no espaço dela (armas3d/espada.glb); a nova também
	return espada.global_transform.basis.get_scale().x

# brasas (Lendário) e estrelinhas (Mítico): CPUParticles com poucas partículas, um quadrado aditivo cada
func _faiscas(pai: Node3D, r: int, centro: Vector3, caixa: Vector3, qtd: int) -> void:
	var p := CPUParticles3D.new()
	p.amount = qtd
	p.lifetime = 1.6 if r == 3 else 2.2
	p.preprocess = 2.0
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	p.emission_box_extents = caixa
	p.position = centro
	p.direction = Vector3(0, 1, 0)
	p.spread = 25.0
	p.gravity = Vector3(0, 0.25 if r == 3 else 0.02, 0)
	p.initial_velocity_min = 0.05
	p.initial_velocity_max = 0.18
	p.scale_amount_min = 0.5
	p.scale_amount_max = 1.0
	var q := QuadMesh.new()
	q.size = Vector2(0.018, 0.018) if r == 3 else Vector2(0.022, 0.022)
	var sm := StandardMaterial3D.new()
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	sm.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	sm.vertex_color_use_as_albedo = true
	var g := GradientTexture2D.new()
	g.fill = GradientTexture2D.FILL_RADIAL
	g.fill_from = Vector2(0.5, 0.5)
	g.fill_to = Vector2(1.0, 0.5)
	var gr := Gradient.new()
	gr.set_color(0, Color(1, 1, 1, 1))
	gr.set_color(1, Color(1, 1, 1, 0))
	g.gradient = gr
	g.width = 32
	g.height = 32
	sm.albedo_texture = g
	q.material = sm
	p.mesh = q
	var cores := Gradient.new()
	if r == 3:
		cores.set_color(0, Color(1.0, 0.85, 0.4, 1))
		cores.set_color(1, Color(1.0, 0.25, 0.0, 0))
	else:
		cores.set_color(0, Color(0.8, 1.0, 1.0, 1))
		cores.set_color(1, Color(0.6, 0.5, 1.0, 0))
	p.color_ramp = cores
	pai.add_child(p)

# só a espada da raridade r (fila das 5 espadas na foto)
func espada_sozinha(r: int) -> MeshInstance3D:
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	doc.append_from_file(pasta + "/pecas_r%d.glb" % r, st)
	var cena: Node = doc.generate_scene(st)
	var ms: Array = []
	_malhas(cena, ms)
	var novo: MeshInstance3D = null
	for mi: MeshInstance3D in ms:
		if String(mi.name).begins_with("espada"):
			var malha: Mesh = mi.mesh
			for s in malha.get_surface_count():
				malha.surface_set_material(s, material(malha.surface_get_material(s).resource_name if malha.surface_get_material(s) else "aco"))
			novo = MeshInstance3D.new()
			novo.mesh = malha
			if r >= 3:
				_faiscas(novo, r, Vector3(0, 0.55, 0), Vector3(0.03, 0.4, 0.01), 14)
	cena.free()
	return novo

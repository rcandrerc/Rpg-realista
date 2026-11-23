extends RefCounted
# Proposta de equipamentos por raridade (setor de arte, 2026-11-23): veste no herói as peças de pecas_rN.glb
# (modelar.py) só para as fotos (foto.gd). Não mexe no jogo: a armadura de hoje continua igual.
# peito* vai no osso UpperChest, ombro_e*/ombro_d* nos braços e espada* no lugar do modelo da espada.

var pasta: String = (get_script() as Script).resource_path.get_base_dir()
var shader: Shader
var ruido: Texture2D
var _postos: Array = []
var _mats := {}
var prefixo: String = {"2": "pecas2_r", "3": "pecas3_r", "ia": "ia_r", "robe": "robe_r"}.get(OS.get_environment("VERSAO"), "pecas_r")
var v3: bool = prefixo == "pecas3_r" or prefixo == "ia_r" or prefixo == "robe_r" # ia_r: teste do caminho da IA (vestir_ia.py)

# material -> [tipo, cor, cor2, luz, metal, aspereza, força]
const M := {
	"couro": [0, "70482c", "000000", "000000", 0.0, 0.75, 1.0],
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
	"couro_fervido": [0, "6a4026", "000000", "000000", 0.0, 0.6, 1.0],
	"pano_roxo": [2, "4a1e7a", "000000", "000000", 0.0, 0.9, 1.0],
	"pano_brasa": [2, "5a1408", "000000", "000000", 0.0, 0.9, 1.0],
	"pano_branco": [2, "dfe6f0", "000000", "000000", 0.0, 0.9, 1.0],
	"luz_branca": [7, "ffffff", "000000", "d8fbff", 0.0, 0.4, 2.2],
	"luz_brasa": [7, "ffd060", "000000", "ffc040", 0.0, 0.4, 3.5],
	"madeira": [0, "6a4a30", "000000", "000000", 0.0, 0.8, 1.0],
	"pedra": [0, "6e6e72", "000000", "000000", 0.0, 0.8, 1.0],
	"gema_azul": [3, "1a5ad0", "b0e0ff", "3a9aff", 0.0, 0.1, 2.2],
	# proposta 3 (roupa leve de patrulheira/maga)
	"linho": [2, "d6cab0", "000000", "000000", 0.0, 0.9, 1.0],
	"linho_punho": [2, "b0a080", "000000", "000000", 0.0, 0.9, 1.0],
	"linho_claro": [2, "e8e0cc", "000000", "000000", 0.0, 0.9, 1.0],
	"cadarco": [0, "3a2618", "000000", "000000", 0.0, 0.8, 1.0],
	"couro_costura": [9, "5e3c24", "c8b090", "000000", 0.0, 0.7, 1.0],
	"pano_cinza": [2, "6a6660", "000000", "000000", 0.0, 0.9, 1.0],
	"pano_cinza_escuro": [2, "3c3e44", "000000", "000000", 0.0, 0.9, 1.0],
	"pano_verde": [2, "3e4a2c", "000000", "000000", 0.0, 0.9, 1.0],
	"bordado_azul": [8, "1e3f7a", "d8d0b0", "000000", 0.0, 0.8, 1.0],
	"couro_oleado": [0, "4a3020", "000000", "000000", 0.0, 0.5, 1.0],
	"couro_costura_clara": [9, "3e2a1e", "d8c8a0", "000000", 0.0, 0.6, 1.0],
	"couro_preto": [0, "221c18", "000000", "000000", 0.0, 0.55, 1.0],
	"latao": [1, "c09040", "604010", "000000", 1.0, 0.3, 1.0],
	"pano_azul": [2, "234a8a", "000000", "000000", 0.0, 0.9, 1.0],
	"seda_branca": [2, "eeeef2", "c8c8ff", "000000", 0.0, 0.6, 1.0],
	"bordado_roxo": [8, "3e1a6a", "e8c060", "000000", 0.0, 0.7, 1.0],
	"couro_vinho": [0, "4e1c24", "000000", "000000", 0.0, 0.5, 1.0],
	"couro_costura_ouro": [9, "4e1c24", "e8c060", "000000", 0.0, 0.5, 1.0],
	"cadarco_ouro": [1, "d8a848", "6a4a10", "000000", 1.0, 0.3, 1.0],
	"seda_negra": [2, "1e1b1e", "ff6020", "000000", 0.0, 0.6, 1.0],
	"bordado_brasa": [8, "3a0a06", "ff8030", "ff5a10", 0.0, 0.7, 1.6],
	"couro_negro": [0, "1c1816", "000000", "000000", 0.0, 0.45, 1.0],
	"costura_brasa": [9, "1c1816", "ff8030", "ff5a10", 0.0, 0.5, 1.8],
	"cadarco_brasa": [7, "ff6010", "000000", "ff6010", 0.0, 0.4, 2.0],
	"pano_carmesim": [2, "6a0e12", "ff4020", "000000", 0.0, 0.85, 1.0],
	"seda_aurora": [2, "e6eef8", "7ad8ff", "000000", 0.0, 0.6, 1.0],
	"bordado_aurora": [8, "c8d8f0", "6ae8ff", "6ae8ff", 0.0, 0.6, 1.3],
	"couro_perola": [0, "d6d2ca", "000000", "000000", 0.0, 0.45, 1.0],
	"costura_aurora": [9, "d6d2ca", "8af0ff", "6ae8ff", 0.0, 0.5, 1.4],
	"couro_perola_escuro": [0, "7a7a86", "000000", "000000", 0.0, 0.45, 1.0],
	"prata": [1, "c8d0dc", "6a8aaa", "000000", 1.0, 0.22, 1.0],
	"cadarco_aurora": [7, "8af0ff", "000000", "8af0ff", 0.0, 0.4, 1.6],
	"prata_viva": [7, "c8f8ff", "000000", "a8f4ff", 0.0, 0.4, 1.6],
	"pano_aurora": [2, "1d5a86", "8af0ff", "000000", 0.0, 0.8, 1.2],
	"robe_azul": [2, "1f2f8a", "5a7aff", "000000", 0.0, 0.85, 1.0],
	"robe_negro": [2, "1a1416", "ff5a20", "000000", 0.0, 0.8, 1.0],
	"cetim_escuro": [2, "2a2a30", "8a8aa0", "000000", 0.0, 0.45, 1.0],
	"ouro_velho": [1, "c8a050", "6a4a18", "000000", 1.0, 0.35, 1.0],
	"cordao_preto": [0, "1a1818", "000000", "000000", 0.0, 0.8, 1.0],
	"pano_negro": [2, "201c1e", "ff5a20", "000000", 0.0, 0.85, 1.0],
	"couro_aurora": [0, "2c3a66", "000000", "000000", 0.0, 0.5, 1.0],
	"seda_aurora_tunica": [2, "e4ecf6", "7ad8ff", "000000", 0.0, 0.7, 1.0],
	"pano_noite": [2, "1a2036", "6ae8ff", "000000", 0.0, 0.85, 1.0],
	"seda_carmesim_esc": [2, "4c0c10", "ff5a20", "000000", 0.0, 0.6, 1.0],
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
	st.use_named_skin_binds = true # a pele liga nos ossos do herói pelo nome
	if doc.append_from_file(pasta + "/" + prefixo + "%d.glb" % r, st) != OK:
		print("não abriu pecas_r%d.glb" % r)
		return
	var cena: Node = doc.generate_scene(st)
	var ms: Array = []
	_malhas(cena, ms)
	var cena_armas: Node = _armas3(r, ms)
	# esconde a espada de hoje (só as malhas dela)
	var velhas: Array = []
	_malhas(espada, velhas)
	for v in velhas:
		if not v.has_meta("novo"):
			v.visible = false
	if prefixo != "pecas_r":
		var corpo: Array = []
		_malhas(heroi, corpo)
		for c in corpo:
			if c.has_meta("novo") or c.mesh == null:
				continue
			for s in c.mesh.get_surface_count():
				var mt = c.get_active_material(s)
				if v3 and c.name == "Tronco":
					c.visible = false # o tronco de pele (peito da Victoria) fica por baixo da camisa
				if mt and v3 and prefixo != "ia_r" and mt.resource_name.contains("Shoes"):
					# o pé da bota: o sapato da Ruiva vira couro da cor da bota de cada raridade
					c.set_surface_override_material(s, material(["couro", "couro_oleado", "couro_preto", "couro_negro", "couro_aurora"][r]))
				if mt and OS.get_environment("SEM_PELE") != "" and mt.resource_name.contains("Body"):
					c.visible = false # só para achar furo na roupa
				if mt and (mt.resource_name.contains("Tops") or mt.resource_name.contains("Tie") or (v3 and (mt.resource_name.contains("Bottoms") or false))):
					c.visible = false
	for mi: MeshInstance3D in ms:
		var nome := String(mi.name)
		if nome.begins_with("cajado"):
			continue
		var malha: Mesh = mi.mesh
		for s in malha.get_surface_count():
			var mo: Material = malha.surface_get_material(s)
			if mo and mo.resource_name.begins_with("ia_"):
				continue # a peça da IA fica com a textura dela
			malha.surface_set_material(s, material(mo.resource_name if mo else "aco"))
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
		if mi.skin != null: # peça com pele: dobra junto com o corpo, no esqueleto do herói
			novo.skin = mi.skin
			esq.add_child(novo)
			novo.skeleton = NodePath("..")
			_postos.append(novo)
			if nome.begins_with("peito") and r >= 3:
				var c := Node3D.new()
				var ba2 := BoneAttachment3D.new()
				ba2.bone_name = "J_Bip_C_UpperChest"
				esq.add_child(ba2)
				_postos.append(ba2)
				ba2.add_child(c)
				c.transform = esq.get_bone_global_rest(esq.find_bone("J_Bip_C_UpperChest")).affine_inverse()
				_faiscas(c, r, Vector3(0, 1.2, 0.17), Vector3(0.05, 0.05, 0.02), 10)
			continue
		var osso := "J_Bip_C_UpperChest"
		if nome.begins_with("quadril"):
			osso = "J_Bip_C_Hips"
		elif nome.begins_with("braco_e"):
			osso = "J_Bip_L_LowerArm"
		elif nome.begins_with("braco_d"):
			osso = "J_Bip_R_LowerArm"
		elif nome.begins_with("ombro_e"):
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
	if cena_armas:
		cena_armas.free()

# proposta 3: espada e cajado vêm de armas3_rN.glb (modelar2.py SO_ARMAS=1)
func _armas3(r: int, ms: Array) -> Node:
	if not v3:
		return null
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	if doc.append_from_file(pasta + "/armas3_r%d.glb" % r, st) != OK:
		return null
	var cena: Node = doc.generate_scene(st)
	_malhas(cena, ms)
	return cena

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
func espada_sozinha(r: int, qual := "espada") -> MeshInstance3D:
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	doc.append_from_file(pasta + "/" + prefixo + "%d.glb" % r, st)
	var cena: Node = doc.generate_scene(st)
	var ms: Array = []
	_malhas(cena, ms)
	var cena_armas: Node = _armas3(r, ms)
	var novo: MeshInstance3D = null
	for mi: MeshInstance3D in ms:
		if String(mi.name).begins_with(qual):
			var malha: Mesh = mi.mesh
			for s in malha.get_surface_count():
				malha.surface_set_material(s, material(malha.surface_get_material(s).resource_name if malha.surface_get_material(s) else "aco"))
			novo = MeshInstance3D.new()
			novo.mesh = malha
			if r >= 3:
				if qual == "espada":
					_faiscas(novo, r, Vector3(0, 0.55, 0), Vector3(0.03, 0.4, 0.01), 14)
				else:
					_faiscas(novo, r, Vector3(0, 1.1, 0), Vector3(0.06, 0.06, 0.06), 14)
	cena.free()
	if cena_armas:
		cena_armas.free()
	return novo

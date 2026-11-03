extends RefCounted
# Roupa de ofício dos NPCs, montada em código em cima do corpo VRoid (pedido do André, 2026-11-03, com a direção de arte):
# o Tomás, o ferreiro, ganha avental de couro (do peito ao joelho, alça no pescoço, queimado embaixo),
# ombros uns 10% mais largos e martelo na mão direita.
# Serve para o NPC no mundo e para o retrato da janela de conversa (conversa.gd).

const COURO := Color("4a2f1c")
const MADEIRA := Color("6b4a2e")
const FERRO := Color("3a3b3f")

static var _mats := {}

# veste o NPC conforme o ofício (só o ferreiro por enquanto)
static func vestir(no: Node3D, npc_id: String) -> void:
	if npc_id != "ferreiro":
		return
	var esq: Skeleton3D = _esqueleto(no)
	if esq == null:
		return
	_corpo_de_ferreiro(esq)
	_avental(esq)
	_martelo(esq)

static func _esqueleto(no: Node) -> Skeleton3D:
	var l := no.find_children("*", "Skeleton3D", true, false)
	return l[0] if l.size() > 0 else null

# ombros 10% mais largos (o pescoço volta ao normal)
static func _corpo_de_ferreiro(esq: Skeleton3D) -> void:
	# depois da animação e das molas do cabelo (um modificador no fim da fila do esqueleto), senão elas desfazem
	var mod := Escala.new()
	var peito := esq.find_bone("J_Bip_C_UpperChest")
	var pescoco := esq.find_bone("J_Bip_C_Neck")
	if peito >= 0 and pescoco >= 0:
		mod.escalas[peito] = Vector3(1.1, 1.0, 1.06)
		mod.escalas[pescoco] = Vector3(1.0 / 1.1, 1.0, 1.0 / 1.06)
	esq.add_child(mod)

class Escala extends SkeletonModifier3D:
	var escalas := {} # osso -> escala
	func _process_modification() -> void:
		var s := get_skeleton()
		if s == null:
			return
		for i in escalas:
			s.set_bone_pose_scale(i, escalas[i])

static func _mat(chave: String, cor: Color, rugoso: float, metal := 0.0) -> StandardMaterial3D:
	if _mats.has(chave):
		return _mats[chave]
	var m := StandardMaterial3D.new()
	m.albedo_color = cor
	m.roughness = rugoso
	m.metallic = metal
	m.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON # igual aos personagens (main.pintar)
	if chave == "couro":
		m.vertex_color_use_as_albedo = true # queimados mais escuros embaixo
		var ruido := FastNoiseLite.new()
		ruido.frequency = 0.09
		ruido.fractal_octaves = 3
		var tex := NoiseTexture2D.new()
		tex.width = 128
		tex.height = 128
		tex.seamless = true
		tex.noise = ruido
		var grad := Gradient.new() # grão do couro, bem sutil
		grad.set_color(0, Color(0.82, 0.8, 0.78))
		grad.set_color(1, Color(1.0, 1.0, 1.0))
		tex.color_ramp = grad
		m.albedo_texture = tex
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
	_mats[chave] = m
	return m

# posição de um osso no espaço do esqueleto (pose de descanso)
static func _p(esq: Skeleton3D, nome: String) -> Vector3:
	var i := esq.find_bone(nome)
	return esq.get_bone_global_rest(i).origin if i >= 0 else Vector3.ZERO

# avental: placa curva na frente do corpo, do peito até o joelho, presa no quadril; alça em volta do pescoço
static func _avental(esq: Skeleton3D) -> void:
	var quadril := esq.find_bone("J_Bip_C_Hips")
	if quadril < 0:
		return
	var peito := _p(esq, "J_Bip_C_UpperChest")
	var joelho := _p(esq, "J_Bip_L_LowerLeg")
	var pescoco := _p(esq, "J_Bip_C_Neck")
	var base := esq.get_bone_global_rest(quadril)
	var topo_y: float = lerp(peito.y, pescoco.y, 0.35)
	var fim_y: float = joelho.y - 0.04
	# frente do corpo: no esqueleto do VRoid o rosto olha para -Z. Largura e quanto afasta do corpo em cada altura (peito, barriga, coxa)
	var linhas := [[topo_y, 0.24, 0.16], [peito.y, 0.3, 0.19], [base.origin.y + 0.12, 0.36, 0.2], [base.origin.y - 0.12, 0.38, 0.17], [fim_y, 0.4, 0.13]]
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var cols := 6
	var pontos := []
	for li in linhas.size():
		var y: float = linhas[li][0]
		var larg: float = linhas[li][1]
		var frente: float = linhas[li][2]
		var linha := []
		for c in cols + 1:
			var u := float(c) / cols - 0.5
			var x := u * larg
			var z := -(frente - u * u * 0.22) # curva em volta do corpo
			var queimado: float = clamp((topo_y - y) / max(0.01, topo_y - fim_y), 0.0, 1.0)
			var escuro: float = lerp(1.0, 0.55, pow(queimado, 2.5)) * (0.92 + 0.08 * cos(u * 9.0 + y * 13.0))
			linha.append([base.affine_inverse() * Vector3(x, y, z), Color(escuro, escuro * 0.97, escuro * 0.94), Vector2(u + 0.5, queimado)])
		pontos.append(linha)
	for li in pontos.size() - 1:
		for c in cols:
			var a = pontos[li][c]
			var b = pontos[li][c + 1]
			var d = pontos[li + 1][c]
			var e = pontos[li + 1][c + 1]
			for v in [a, b, d, b, e, d]:
				st.set_color(v[1])
				st.set_uv(v[2] * 3.0)
				st.add_vertex(v[0])
	st.generate_normals()
	var placa := MeshInstance3D.new()
	placa.mesh = st.commit()
	placa.material_override = _mat("couro", Color(0.52, 0.32, 0.17), 0.8) # o #4a2f1c na luz toon fica quase preto: couro mais claro e quente, e os queimados escurecem embaixo
	var ba := BoneAttachment3D.new()
	ba.bone_idx = quadril
	esq.add_child(ba)
	ba.add_child(placa)
	# alça: duas tiras do canto de cima até a nuca, presas no peito
	var bp := esq.find_bone("J_Bip_C_UpperChest")
	var bap := BoneAttachment3D.new()
	bap.bone_idx = bp
	esq.add_child(bap)
	var rest_peito := esq.get_bone_global_rest(bp)
	for lado in [-1.0, 1.0]:
		var de := Vector3(lado * 0.14, topo_y, -0.11)
		var ate := Vector3(lado * 0.055, pescoco.y + 0.06, 0.03)
		var tira := MeshInstance3D.new()
		var caixa := BoxMesh.new()
		caixa.size = Vector3(0.022, 0.006, de.distance_to(ate))
		tira.mesh = caixa
		tira.material_override = _mat("couro_tira", COURO.darkened(0.15), 0.8)
		var meio := (de + ate) * 0.5
		var xf := Transform3D(Basis.looking_at(ate - de, Vector3.FORWARD), meio)
		tira.transform = rest_peito.affine_inverse() * xf
		bap.add_child(tira)

# martelo de ferreiro na mão direita: cabo de madeira descendo pela direção dos dedos e cabeça de ferro embaixo
static func _martelo(esq: Skeleton3D) -> void:
	var mao := esq.find_bone("J_Bip_R_Hand")
	var dedo := esq.find_bone("J_Bip_R_Middle1")
	if mao < 0 or dedo < 0:
		return
	var rm := esq.get_bone_global_rest(mao)
	var dir_local: Vector3 = (rm.basis.inverse() * (esq.get_bone_global_rest(dedo).origin - rm.origin)).normalized()
	var ba := BoneAttachment3D.new()
	ba.bone_idx = mao
	esq.add_child(ba)
	var martelo := Node3D.new()
	ba.add_child(martelo)
	# eixo Y do martelo = direção dos dedos (o cabo sai do punho fechado)
	var y := dir_local
	var x := y.cross(Vector3.FORWARD if abs(y.dot(Vector3.FORWARD)) < 0.9 else Vector3.UP).normalized()
	var z := x.cross(y).normalized()
	martelo.transform = Transform3D(Basis(x, y, z), y * 0.05)
	var cabo := MeshInstance3D.new()
	var cil := CylinderMesh.new()
	cil.top_radius = 0.014
	cil.bottom_radius = 0.017
	cil.height = 0.36
	cil.radial_segments = 10
	cabo.mesh = cil
	cabo.position = Vector3(0, 0.12, 0)
	cabo.material_override = _mat("madeira", MADEIRA, 0.85)
	martelo.add_child(cabo)
	var cabeca := MeshInstance3D.new()
	var bx := BoxMesh.new()
	bx.size = Vector3(0.055, 0.055, 0.15)
	cabeca.mesh = bx
	cabeca.position = Vector3(0, 0.31, 0)
	cabeca.material_override = _mat("ferro", FERRO, 0.45, 0.8)
	martelo.add_child(cabeca)
	var aro := MeshInstance3D.new() # anel de ferro onde o cabo entra
	var ca := CylinderMesh.new()
	ca.top_radius = 0.02
	ca.bottom_radius = 0.02
	ca.height = 0.03
	aro.mesh = ca
	aro.position = Vector3(0, 0.27, 0)
	aro.material_override = cabeca.material_override
	martelo.add_child(aro)

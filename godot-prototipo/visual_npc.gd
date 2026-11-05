extends RefCounted
# Roupa de ofício dos NPCs, montada em código em cima do corpo VRoid (pedido do André, 2026-11-03, com a direção de arte):
# o Tomás, o ferreiro, ganha avental de couro (do peito ao joelho, alça no pescoço, queimado embaixo),
# ombros uns 10% mais largos e martelo na mão direita.
# Serve para o NPC no mundo e para o retrato da janela de conversa (conversa.gd).

const COURO := Color("4a2f1c")
const MADEIRA := Color("6b4a2e")
const FERRO := Color("3a3b3f")

const Armadura := preload("res://armadura.gd")
const BARBA := Color("d6d2ca") # branca puxando para o cinza, como o cabelo grisalho do Aldo

static var _mats := {}

# André 2026-11-05: "esses NPCs estão muito modernos". Cada NPC veste peças da armadura do herói (roupa em
# shared/dados.js, mesmo texto do servidor: "peitoral0,capa3") e o Aldo vira o ancião da vila: corpo curvado,
# barba branca e cajado na mão (a arma vem de main.criar_npc).
static func vestir(no: Node3D, npc_id: String, info = {}) -> void:
	var esq: Skeleton3D = _esqueleto(no)
	if esq == null:
		return
	if info is Dictionary and str(info.get("roupa", "")) != "":
		Armadura.vestir(no, Armadura.de_texto(str(info.roupa)))
	if info is Dictionary and info.get("anciao", false):
		_corpo_de_anciao(esq)
		_barba(no, esq, info)
	if npc_id != "ferreiro":
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

# ---------- ancião ----------
# frente do corpo no esqueleto: +1 quando o pé aponta para +z (a Ruiva), -1 nos outros VRoid
static func _frente(esq: Skeleton3D) -> float:
	var pe := esq.find_bone("J_Bip_L_Foot")
	var dedo := esq.find_bone("J_Bip_L_ToeBase")
	if pe < 0 or dedo < 0:
		return -1.0
	return 1.0 if esq.get_bone_global_rest(dedo).origin.z > esq.get_bone_global_rest(pe).origin.z else -1.0

# costas curvadas de idade: coluna e peito vão para a frente, pescoço e cabeça voltam para olhar à frente
static func _corpo_de_anciao(esq: Skeleton3D) -> void:
	var mod := Curvar.new()
	var f := _frente(esq)
	for par in [["J_Bip_C_Spine", 0.17], ["J_Bip_C_Chest", 0.14], ["J_Bip_C_UpperChest", 0.1], ["J_Bip_C_Neck", -0.14], ["J_Bip_C_Head", -0.16]]:
		var i := esq.find_bone(par[0])
		if i >= 0: # eixo do lado do corpo (x do modelo) escrito no espaço do próprio osso
			var eixo: Vector3 = (esq.get_bone_global_rest(i).basis.inverse() * Vector3.RIGHT).normalized()
			mod.giros[i] = Quaternion(eixo, float(par[1]) * f)
	esq.add_child(mod)

class Curvar extends SkeletonModifier3D:
	var giros := {} # osso -> giro a mais, por cima da animação
	func _process_modification() -> void:
		var s := get_skeleton()
		if s == null:
			return
		for i in giros:
			s.set_bone_pose_rotation(i, s.get_bone_pose_rotation(i) * giros[i])

# barba branca em ponta, presa no osso da cabeça: nasce nas costeletas, contorna o queixo e desce uns 13 cm
static func _barba(raiz: Node3D, esq: Skeleton3D, info: Dictionary) -> void:
	var cab := esq.find_bone("J_Bip_C_Head")
	if cab < 0:
		return
	var f := _frente(esq)
	# queixo: o ponto mais baixo do rosto no meio; a largura da mandíbula vem da largura do rosto nessa altura
	# (o rosto do VRoid vem em mais de uma malha: junta todas)
	var V: PackedVector3Array = PackedVector3Array()
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh is ArrayMesh and not str(mi.name).begins_with("Armadura"):
			for sfc in mi.mesh.get_surface_count():
				var nome: String = mi.mesh.surface_get_name(sfc)
				if "Face_00_SKIN" in nome and not "Outline" in nome:
					V.append_array(mi.mesh.surface_get_arrays(sfc)[Mesh.ARRAY_VERTEX])
	if V.is_empty():
		return
	var queixo := Vector3(0, 99, 0)
	var topo := -99.0
	for p in V:
		topo = max(topo, p.y)
		if abs(p.x) < 0.012 and p.z * f > 0.0 and p.y < queixo.y:
			queixo = p
	if queixo.y > 90.0:
		return
	var alt_rosto := topo - queixo.y
	var meia := 0.0
	var fundo := 0.0
	for p in V:
		if abs(p.y - (queixo.y + alt_rosto * 0.22)) < 0.01:
			meia = max(meia, abs(p.x))
			fundo = min(fundo, p.z * f) if fundo != 0.0 else p.z * f
	meia = max(meia, 0.045)
	# linhas da barba (de cima para baixo): altura, meia-largura, quanto vai para a frente do queixo
	var y0 := queixo.y
	var linhas := [[y0 + alt_rosto * 0.3, meia * 1.02, -0.035], [y0 + alt_rosto * 0.14, meia * 0.98, -0.012],
		[y0 + 0.005, meia * 0.78, 0.006], [y0 - 0.04, meia * 0.6, 0.014], [y0 - 0.085, meia * 0.36, 0.012], [y0 - 0.13, 0.006, 0.0]]
	var cols := 10
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rest := esq.get_bone_global_rest(cab)
	var pts := []
	for li in linhas.size():
		var y: float = linhas[li][0]
		var larg: float = linhas[li][1]
		var adiante: float = linhas[li][2]
		var linha := []
		for c in cols + 1:
			var u := float(c) / cols * 2.0 - 1.0 # -1 (lado) .. 1 (outro lado), 0 = meio
			var ang := u * 1.45 # contorna a mandíbula: os lados vão para trás até a orelha
			var x := sin(ang) * larg
			var z := queixo.z * f + adiante - (1.0 - cos(ang)) * larg * 1.15
			var mecha := 0.9 + 0.1 * sin(u * 17.0 + y * 60.0) # mechas
			linha.append(Vector3(x, y, (z + 0.008) * f))
			linha[-1] = [linha[-1], Color(mecha, mecha, mecha), Vector2(u * 0.5 + 0.5, float(li) / (linhas.size() - 1))]
		pts.append(linha)
	for li in pts.size() - 1:
		for c in cols:
			var a = pts[li][c]
			var b = pts[li][c + 1]
			var d = pts[li + 1][c]
			var e = pts[li + 1][c + 1]
			for v in [a, b, d, b, e, d]:
				st.set_color(v[1])
				st.set_uv(v[2])
				st.add_vertex(rest.affine_inverse() * v[0])
	st.generate_normals()
	var barba := MeshInstance3D.new()
	barba.name = "Barba"
	barba.mesh = st.commit()
	var cor := BARBA
	if info.get("tinta") is Dictionary and info.tinta.get("cabelo") != null:
		cor = Color.hex(int(info.tinta.cabelo) << 8 | 0xff).lightened(0.08)
	var m := StandardMaterial3D.new()
	m.albedo_color = cor
	m.vertex_color_use_as_albedo = true
	m.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	m.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
	m.roughness = 1.0
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.rim_enabled = true
	m.rim = 0.25
	barba.material_override = m
	var ba := BoneAttachment3D.new()
	ba.bone_idx = cab
	esq.add_child(ba)
	ba.add_child(barba)
	# bigode: duas mechas que saem de baixo do nariz e caem pelos cantos da boca até encontrar a barba
	var y_boca := queixo.y + alt_rosto * 0.17
	var w := meia * 0.62
	var sb := SurfaceTool.new()
	sb.begin(Mesh.PRIMITIVE_TRIANGLES)
	var n_b := 12
	var cima := []
	var baixo := []
	for c in n_b + 1:
		var u := float(c) / n_b * 2.0 - 1.0
		var x := u * w
		var y: float = y_boca + 0.012 - pow(abs(u), 1.6) * 0.03
		var grossura: float = 0.011 * (1.0 - 0.55 * abs(u))
		# na frente do rosto: o vértice do rosto mais à frente perto desse ponto
		var z := -99.0
		for p in V:
			if abs(p.x - x) < 0.008 and abs(p.y - y) < 0.012:
				z = max(z, p.z * f)
		if z < -90.0:
			z = queixo.z * f - abs(u) * 0.02
		cima.append(rest.affine_inverse() * Vector3(x, y + grossura * 0.5, (z + 0.005) * f))
		baixo.append(rest.affine_inverse() * Vector3(x, y - grossura * 0.5, (z + 0.007) * f))
	for c in n_b:
		for v in [cima[c], cima[c + 1], baixo[c], cima[c + 1], baixo[c + 1], baixo[c]]:
			sb.set_color(Color(0.95, 0.95, 0.95))
			sb.add_vertex(v)
	sb.generate_normals()
	var bigode := MeshInstance3D.new()
	bigode.name = "Bigode"
	bigode.mesh = sb.commit()
	bigode.material_override = m
	ba.add_child(bigode)

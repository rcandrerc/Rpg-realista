extends RefCounted
const Malhas = preload("res://malhas.gd") # ler malha sem esperar o desenho (malhas.gd arrays)
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
	_vestir(no, npc_id, info)
	# peças da armadura juntadas (junta_pecas.gd) só depois da roupa de ofício: ela esconde as placas do peitoral, e a
	# placa escondida fica de fora da junta
	if info is Dictionary and str(info.get("roupa", "")) != "":
		preload("res://junta_pecas.gd").juntar(no)

static func _vestir(no: Node3D, npc_id: String, info = {}) -> void:
	var esq: Skeleton3D = _esqueleto(no)
	if esq == null:
		return
	if info is Dictionary and str(info.get("roupa", "")) != "":
		Armadura.vestir(no, Armadura.de_texto(str(info.roupa)))
	# roupa de ofício (direção de arte 2026-11-05: só quem luta usa couraça e ombreira): túnica, saia, faixa, corpete
	if info is Dictionary and info.get("veste") is Dictionary:
		_roupa_de_oficio(no, esq, info.veste)
	if info is Dictionary and info.get("esconder") is Array: # peças do modelo que quebram o medieval (fone sci-fi)
		for mi in no.find_children("*", "MeshInstance3D", true, false):
			if not (mi.mesh is ArrayMesh):
				continue
			for sfc in mi.mesh.get_surface_count():
				for trecho in info.esconder:
					if str(trecho) in mi.mesh.surface_get_name(sfc):
						mi.visible = false
	if info is Dictionary and info.get("friso", false):
		_friso_dourado(no, esq)
	if info is Dictionary and info.get("limpar_rosto", false):
		_limpar_rosto(no)
	if info is Dictionary and info.get("anciao", false):
		_corpo_de_anciao(esq)
		_barba(no, esq, info)
	# o Tomás e os ferreiros das mini vilas do mundo grande (história v2: "oficio" em shared/dados.js ferreiroDe)
	if npc_id != "ferreiro" and not (info is Dictionary and info.get("oficio", false)):
		return
	_corpo_de_ferreiro(esq)
	_avental(esq)
	_martelo(esq)

# André 2026-11-06: "tem um cara lá de casaco" (o corpo masculino do criador, cabelo_m, vem do VRoid de moletom com
# capuz, e o capuz só saía com peitoral). Agora a blusa perde o capuz e os cordões e cola no corpo como a túnica dos
# NPCs: vira camisa de linho justa, com decote redondo, como a roupa de baixo dos outros corpos. Vale para o herói,
# o boneco do menu, os outros jogadores e os NPCs (main.modelo, antes da armadura).
static func tirar_casaco(raiz: Node3D) -> void:
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		if not (mi.mesh is ArrayMesh) or str(mi.name).begins_with("Armadura") or mi.has_meta("colada"):
			continue
		for sfc in mi.mesh.get_surface_count():
			if "Tops" in mi.mesh.surface_get_name(sfc):
				mi.set_meta("colada", true)
				_sem_capuz(raiz, mi)
				_colar_no_corpo(raiz, mi)
				break

# tira os triângulos do capuz: no tronco (as mangas ficam), o que passa da base do pescoço. O resto do capuz, caído
# nas costas, cola no corpo depois (_colar_no_corpo)
static var _sem_capuz_cache := {}
static func _sem_capuz(raiz: Node3D, tops: MeshInstance3D) -> void:
	var orig: Mesh = tops.mesh
	var chave := orig.get_instance_id()
	if _sem_capuz_cache.has(chave):
		tops.mesh = _sem_capuz_cache[chave]
		return
	var esq := _esqueleto(raiz)
	if esq == null:
		return
	var pescoco := esq.find_bone("J_Bip_C_Neck")
	var braco := esq.find_bone("J_Bip_L_UpperArm")
	if pescoco < 0 or braco < 0:
		return
	var base_pesc := esq.get_bone_global_rest(pescoco).origin
	var y_corte := base_pesc.y - 0.012
	var x_ombro := absf(esq.get_bone_global_rest(braco).origin.x)
	var am := ArrayMesh.new()
	for sfc in orig.get_surface_count():
		var arr: Array = Malhas.arrays(orig, sfc)
		var V: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var I: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
		# direção de arte (2026-11-06): o decote ficava canoa largo, quase caindo do ombro. A faixa de 9 cm abaixo do
		# corte fecha para o pescoço (até 55% no alto, ~60% da largura de antes); depois _colar_no_corpo assenta na pele
		var contorno: bool = "Outline" in orig.surface_get_name(sfc)
		var fora := {}
		for vi in V.size():
			var p := V[vi]
			if absf(p.x) > x_ombro:
				continue
			if p.y > y_corte:
				fora[vi] = true
			elif contorno and p.y > y_corte - 0.05:
				# o contorno de desenho na borda do decote e na nuca saía em riscos pretos (sobra do capuz)
				fora[vi] = true
			elif p.y > y_corte - 0.09:
				var k := clampf((p.y - (y_corte - 0.09)) / 0.09, 0.0, 1.0) * 0.55
				var d := Vector2(p.x - base_pesc.x, p.z - base_pesc.z) * (1.0 - k)
				V[vi] = Vector3(base_pesc.x + d.x, p.y + k * 0.03, base_pesc.z + d.y)
		arr[Mesh.ARRAY_VERTEX] = V
		var J := PackedInt32Array()
		for t in range(0, I.size(), 3):
			if not (fora.has(I[t]) or fora.has(I[t + 1]) or fora.has(I[t + 2])):
				J.append_array([I[t], I[t + 1], I[t + 2]])
		arr[Mesh.ARRAY_INDEX] = J
		am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		am.surface_set_name(sfc, orig.surface_get_name(sfc))
		am.surface_set_material(sfc, orig.surface_get_material(sfc))
	_sem_capuz_cache[chave] = am
	tops.mesh = am

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
	for par in [["J_Bip_C_Spine", 0.2], ["J_Bip_C_Chest", 0.2], ["J_Bip_C_UpperChest", 0.16], ["J_Bip_C_Neck", 0.04], ["J_Bip_C_Head", -0.4]]:
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

# ---------- material toon de dois tons (direção de arte: cor e sombra toon definidas, contorno como o do cabelo) ----------
const SHADER_TOON := """
shader_type spatial;
render_mode cull_disabled, specular_disabled;
uniform vec3 base : source_color = vec3(0.85);
uniform vec3 sombra : source_color = vec3(0.65);
uniform vec2 degrau = vec2(0.02, 0.1); // onde a sombra toon vira luz (mais largo = mais macio)
void fragment() {
	ALBEDO = base * COLOR.rgb;
	ROUGHNESS = 1.0;
}
void light() {
	float t = smoothstep(degrau.x, degrau.y, dot(NORMAL, LIGHT)) * ATTENUATION;
	vec3 fator = mix(sombra / max(base, vec3(0.02)), vec3(1.0), t);
	DIFFUSE_LIGHT += LIGHT_COLOR * fator / PI;
}
"""
const SHADER_CONTORNO := """
shader_type spatial;
render_mode unshaded, cull_front;
uniform vec3 cor : source_color = vec3(0.2);
uniform float grossura = 0.0035;
void vertex() { VERTEX += NORMAL * grossura; }
void fragment() { ALBEDO = cor; }
"""
static var _sh_toon: Shader
static var _sh_contorno: Shader

static func _toon(base: Color, sombra: Color, contorno := Color(0, 0, 0, 0), grossura := 0.0035, degrau := Vector2(0.02, 0.1)) -> ShaderMaterial:
	var chave := "toon:%s:%s:%s:%f:%s" % [base.to_html(), sombra.to_html(), contorno.to_html(), grossura, degrau]
	if _mats.has(chave):
		return _mats[chave]
	if _sh_toon == null:
		_sh_toon = Shader.new()
		_sh_toon.code = SHADER_TOON
		_sh_contorno = Shader.new()
		_sh_contorno.code = SHADER_CONTORNO
	var m := ShaderMaterial.new()
	m.shader = _sh_toon
	m.set_shader_parameter("base", base)
	m.set_shader_parameter("sombra", sombra)
	m.set_shader_parameter("degrau", degrau)
	if contorno.a > 0.0:
		var c := ShaderMaterial.new()
		c.shader = _sh_contorno
		c.set_shader_parameter("cor", contorno)
		c.set_shader_parameter("grossura", grossura)
		m.next_pass = c
	_mats[chave] = m
	return m

# a blusa do VRoid tem gola de marinheiro, abas e capuz que a couraça escondia: sem ela, cada ponto da blusa fica
# entre 0,6 cm e 2,5 cm da pele mais perto (vira túnica justa; a pele também não fura mais o pano)
static var _coladas := {}
static func _colar_no_corpo(raiz: Node3D, tops: MeshInstance3D) -> void:
	var orig: Mesh = tops.mesh
	var chave := orig.get_instance_id()
	if _coladas.has(chave):
		tops.mesh = _coladas[chave]
		return
	var corpo := PackedVector3Array()
	var normais := PackedVector3Array()
	var ossos_c := [] # por vértice do corpo: [[nome do osso, peso], ...] (a pele do VRoid liga os ossos pelo nome)
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh is ArrayMesh and "Body_00_SKIN" in mi.mesh.surface_get_name(0):
			var arr: Array = Malhas.arrays(mi.mesh, 0)
			var VV: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
			corpo.append_array(VV)
			normais.append_array(arr[Mesh.ARRAY_NORMAL])
			var B = arr[Mesh.ARRAY_BONES]
			var W = arr[Mesh.ARRAY_WEIGHTS]
			var nb: int = B.size() / VV.size() if B != null and VV.size() > 0 and mi.skin else 0
			for i in VV.size():
				var l := []
				for j in nb:
					if W[i * nb + j] > 0.0:
						l.append([_nome_bind(mi.skin, B[i * nb + j], raiz), W[i * nb + j]])
				ossos_c.append(l)
	if corpo.is_empty():
		return
	const CEL := 0.04
	var grade := {}
	for i in corpo.size():
		var k := Vector3i(floor(corpo[i].x / CEL), floor(corpo[i].y / CEL), floor(corpo[i].z / CEL))
		if not grade.has(k):
			grade[k] = []
		grade[k].append(i)
	var am := ArrayMesh.new()
	for sfc in orig.get_surface_count():
		var arr: Array = Malhas.arrays(orig, sfc)
		var V: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var dentro := 0.0
		# a blusa dobra com os pesos da pele de baixo: as abas da manga do VRoid ficavam soltas no ombro (Rosa)
		var B = arr[Mesh.ARRAY_BONES]
		var W = arr[Mesh.ARRAY_WEIGHTS]
		var nbt: int = B.size() / V.size() if B != null and V.size() > 0 and tops.skin else 0
		var bind_de := {}
		if nbt > 0:
			for bi in tops.skin.get_bind_count():
				bind_de[_nome_bind(tops.skin, bi, raiz)] = bi
		for vi in V.size():
			var p := V[vi]
			var k0 := Vector3i(floor(p.x / CEL), floor(p.y / CEL), floor(p.z / CEL))
			var melhor := -1
			var md := 1e9
			for dx in [-1, 0, 1]:
				for dy in [-1, 0, 1]:
					for dz in [-1, 0, 1]:
						for i in grade.get(k0 + Vector3i(dx, dy, dz), []):
							var d := p.distance_squared_to(corpo[i])
							if d < md:
								md = d
								melhor = i
			if melhor < 0: # aba solta muito para fora: procura no corpo todo
				for i in corpo.size():
					var d := p.distance_squared_to(corpo[i])
					if d < md:
						md = d
						melhor = i
			var b := corpo[melhor]
			var n := normais[melhor].normalized()
			var fora := (p - b).dot(n)
			var lado := (p - b) - n * fora
			V[vi] = b + lado * 0.5 + n * clamp(fora, 0.006, 0.025) + n * dentro
			var l: Array = ossos_c[melhor] if melhor < ossos_c.size() else []
			if nbt > 0 and not l.is_empty() and l.all(func(e): return bind_de.has(e[0])):
				for j in nbt:
					B[vi * nbt + j] = bind_de[l[j][0]] if j < l.size() else 0
					W[vi * nbt + j] = l[j][1] if j < l.size() else 0.0
		arr[Mesh.ARRAY_VERTEX] = V
		if nbt > 0:
			arr[Mesh.ARRAY_BONES] = B
			arr[Mesh.ARRAY_WEIGHTS] = W
		am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr, [], {}, orig.surface_get_format(sfc) & ~Mesh.ARRAY_FORMAT_VERTEX & 0)
		am.surface_set_name(sfc, orig.surface_get_name(sfc))
		am.surface_set_material(sfc, orig.surface_get_material(sfc)) # o herói usa o material da malha (não há override)
	_coladas[chave] = am
	tops.mesh = am

# desenho de circuito turquesa pintado na textura do rosto (corpo vita): pinta da cor da pele, só neste NPC
static var _rostos := {}
static func _limpar_rosto(raiz: Node3D) -> void:
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		if not (mi.mesh is ArrayMesh):
			continue
		for sfc in mi.mesh.get_surface_count():
			var nome: String = mi.mesh.surface_get_name(sfc)
			if not ("Face_00_SKIN" in nome) or "Outline" in nome:
				continue
			var m = mi.get_active_material(sfc)
			if not (m is StandardMaterial3D) or m.albedo_texture == null:
				continue
			var chave: int = m.get_instance_id()
			if not _rostos.has(chave):
				var img: Image = m.albedo_texture.get_image()
				if img == null:
					continue
				img = img.duplicate()
				if img.is_compressed():
					img.decompress()
				img.convert(Image.FORMAT_RGBA8)
				var pele := img.get_pixel(img.get_width() / 2, int(img.get_height() * 0.62))
				for y in img.get_height():
					for x in img.get_width():
						var c := img.get_pixel(x, y)
						if c.a > 0.1 and (c.b > c.r + 0.06 or c.g > c.r + 0.04):
							img.set_pixel(x, y, Color(pele.r, pele.g, pele.b, c.a))
				img.generate_mipmaps()
				var n: StandardMaterial3D = m.duplicate()
				n.albedo_texture = ImageTexture.create_from_image(img)
				_rostos[chave] = n
			mi.set_surface_override_material(sfc, _rostos[chave])

static func _nome_bind(sk: Skin, bi: int, raiz: Node) -> String:
	var nome := str(sk.get_bind_name(bi))
	if nome == "":
		var esq: Skeleton3D = _esqueleto(raiz)
		var osso := sk.get_bind_bone(bi)
		nome = esq.get_bone_name(osso) if esq and osso >= 0 else ""
	return nome

static func _invisivel() -> Material:
	if not _mats.has("invisivel"):
		var m := StandardMaterial3D.new()
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.albedo_color = Color(0, 0, 0, 0)
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_mats["invisivel"] = m
	return _mats["invisivel"]

# sombra do pano: a mesma cor mais escura e um pouco mais quente
static func _sombra(c: Color) -> Color:
	return Color(c.r * 0.74, c.g * 0.7, c.b * 0.72)

static func _cor(v) -> Color:
	return Color.hex(int(v) << 8 | 0xff)

# ---------- tubo de mecha: seções elípticas ao longo de uma linha, fecha na ponta ----------
# pts: pontos no espaço do esqueleto; larg/fundo: meia-largura e meia-espessura em cada ponto; lado: eixo da largura
static func _tubo(st: SurfaceTool, pts: Array, larg: Array, fundo: Array, lado: Vector3, cor_raiz: float, cor_ponta: float) -> void:
	var n := 10
	var aneis := []
	for k in pts.size():
		var t: Vector3 = (pts[min(k + 1, pts.size() - 1)] - pts[max(k - 1, 0)]).normalized()
		var x: Vector3 = (lado - t * lado.dot(t)).normalized()
		var z: Vector3 = t.cross(x).normalized()
		var anel := []
		for i in n:
			var a := TAU * i / n
			anel.append(pts[k] + x * cos(a) * float(larg[k]) + z * sin(a) * float(fundo[k]))
		aneis.append(anel)
	for k in aneis.size() - 1:
		var c0: float = lerp(cor_raiz, cor_ponta, float(k) / (aneis.size() - 1))
		var c1: float = lerp(cor_raiz, cor_ponta, float(k + 1) / (aneis.size() - 1))
		for i in n:
			var j := (i + 1) % n
			for v in [[aneis[k][i], c0], [aneis[k][j], c0], [aneis[k + 1][i], c1], [aneis[k][j], c0], [aneis[k + 1][j], c1], [aneis[k + 1][i], c1]]:
				st.set_color(Color(v[1], v[1], v[1]))
				st.add_vertex(v[0])

# barba branca de mago: base por cima do queixo e 5 mechas em camadas (a do meio desce ~18 cm, pontas desiguais),
# com o bigode ligado nela. Tudo preso no osso da cabeça e medido pelo rosto do VRoid.
static func _barba(raiz: Node3D, esq: Skeleton3D, info: Dictionary) -> void:
	var cab := esq.find_bone("J_Bip_C_Head")
	if cab < 0:
		return
	var f := _frente(esq)
	# o rosto do VRoid vem em mais de uma malha: junta todas (espaço canônico: +z = frente)
	var V := PackedVector3Array()
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh is ArrayMesh and not str(mi.name).begins_with("Armadura"):
			for sfc in mi.mesh.get_surface_count():
				var nome: String = mi.mesh.surface_get_name(sfc)
				if "Face_00_SKIN" in nome and not "Outline" in nome:
					for p in Malhas.vertices(mi.mesh, sfc):
						V.append(Vector3(p.x, p.y, p.z * f))
	if V.is_empty():
		return
	var boca := PackedVector3Array() # a malha da boca do VRoid diz onde ela fica de verdade
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh is ArrayMesh:
			for sfc in mi.mesh.get_surface_count():
				if "FaceMouth" in mi.mesh.surface_get_name(sfc):
					boca.append_array(Malhas.vertices(mi.mesh, sfc))
	var queixo := Vector3(0, 99, 0)
	var topo := -99.0
	for p in V:
		topo = max(topo, p.y)
		if abs(p.x) < 0.012 and p.z > 0.0 and p.y < queixo.y:
			queixo = p
	if queixo.y > 90.0:
		return
	var alt := topo - queixo.y
	var meia := 0.0
	for p in V:
		if abs(p.y - (queixo.y + alt * 0.22)) < 0.01:
			meia = max(meia, abs(p.x))
	meia = max(meia, 0.045)
	# frente do rosto perto de (x, y): o vértice mais à frente
	var frente_em := func(x: float, y: float, fora: float) -> float:
		var z := -99.0
		for p in V:
			if abs(p.x - x) < 0.01 and abs(p.y - y) < 0.012:
				z = max(z, p.z)
		return (z if z > -90.0 else queixo.z - abs(x) * 0.5) + fora
	var rest := esq.get_bone_global_rest(cab)
	var inv := rest.affine_inverse()
	var P := func(x: float, y: float, z: float) -> Vector3: return inv * Vector3(x, y, z * f)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var y0 := queixo.y
	var y_boca := queixo.y + alt * 0.17
	if not boca.is_empty(): # meio da boca: a boca fechada fica no meio da malha (ela inclui o lábio aberto)
		var lo := 99.0
		var hi := -99.0
		for p in boca:
			lo = min(lo, p.y)
			hi = max(hi, p.y)
		y_boca = (lo + hi) * 0.5
	# base: concha grossa que cobre a mandíbula de uma costeleta à outra (camada de baixo, mais escura)
	var cols := 12
	# a borda de cima faz um arco: no meio fica abaixo do lábio (a boca aparece), nos lados sobe até a costeleta
	var linhas := [[1.0, meia * 1.0, 0.004], [0.62, meia * 0.97, 0.008], [0.3, meia * 0.86, 0.012],
		[y0 - 0.005, meia * 0.72, 0.016], [y0 - 0.035, meia * 0.5, 0.018]]
	var pts := []
	for li in linhas.size():
		var linha := []
		for c in cols + 1:
			var u := float(c) / cols * 2.0 - 1.0
			var ang := u * 1.5
			var x: float = sin(ang) * linhas[li][1]
			var y: float = linhas[li][0]
			if li < 3: # fração entre o lábio de baixo (meio) e a costeleta (lado)
				var topo_y: float = lerp(y_boca - 0.026, y0 + alt * 0.22, pow(abs(u), 1.2)) # 1,2 cm do lábio de baixo à mostra
				y = lerp(y0 + 0.004, topo_y, float(linhas[li][0]))
			var z: float = frente_em.call(x, y, linhas[li][2]) if li < 3 else queixo.z + linhas[li][2] - (1.0 - cos(ang)) * linhas[li][1] * 1.1
			linha.append(P.call(x, y, z))
		pts.append(linha)
	for li in pts.size() - 1:
		for c in cols:
			for v in [pts[li][c], pts[li][c + 1], pts[li + 1][c], pts[li][c + 1], pts[li + 1][c + 1], pts[li + 1][c]]:
				st.set_color(Color(0.75, 0.75, 0.75))
				st.add_vertex(v)
	var lado: Vector3 = (inv.basis * Vector3.RIGHT).normalized()
	# mechas: [x da raiz, y da raiz (fração da altura do rosto), comprimento, meia-largura, x da ponta, à frente]
	# 6 tufos grandes (direção de arte: menos tubos, mais volume), o do meio em dois que se cruzam um pouco
	var mechas := [[-0.12, 0.0, 0.18, 0.036, 0.006, 0.03], [0.14, 0.0, 0.165, 0.034, -0.004, 0.026],
		[-0.5, 0.06, 0.14, 0.032, -0.03, 0.02], [0.5, 0.06, 0.13, 0.032, 0.035, 0.02],
		[-0.88, 0.17, 0.1, 0.024, -0.05, 0.012], [0.88, 0.17, 0.11, 0.024, 0.055, 0.012]]
	for mc in mechas:
		var rx: float = mc[0] * meia
		var ry: float = y0 + alt * float(mc[1])
		var comp: float = mc[2]
		var linha_m := []
		var la := []
		var fu := []
		var nseg := 7
		for k in nseg + 1:
			var t := float(k) / nseg
			var x: float = lerp(rx, float(mc[4]), t * t)
			var y: float = ry - comp * t
			# afasta do rosto: em cima encosta, embaixo vai para a frente e volta na ponta (barba pesada)
			var zr: float = frente_em.call(rx, ry, 0.006) if ry > y0 else queixo.z + 0.006
			var z: float = lerp(zr, queixo.z, clamp(t * 2.0, 0.0, 1.0)) + float(mc[5]) * sin(t * PI) + 0.012 * t
			linha_m.append(P.call(x, y, z))
			la.append(float(mc[3]) * (1.0 - pow(t, 1.7)) + 0.002)
			fu.append(0.014 * (1.0 - t * 0.8) + 0.002)
		_tubo(st, linha_m, la, fu, lado, 0.86, 1.0)
	# bigode: sai de baixo do nariz, passa pelos cantos da boca e desce até encontrar as mechas do lado
	var w := meia * 0.6
	for s in [-1.0, 1.0]:
		var linha_b := []
		var la_b := []
		var fu_b := []
		# por cima do lábio de cima e por fora dos cantos da boca: a boca fica livre
		var trilha := [[0.004, y_boca + 0.02], [w * 0.45, y_boca + 0.017], [w * 0.9, y_boca + 0.006], [w * 1.12, y_boca - 0.018], [w * 1.12, y0 + alt * 0.06]]
		var grosso := [0.011, 0.01, 0.008, 0.006, 0.004] # afina até a ponta
		for k in trilha.size():
			var x: float = trilha[k][0] * s
			var y: float = trilha[k][1]
			linha_b.append(P.call(x, y, frente_em.call(x, y, 0.008)))
			la_b.append(grosso[k])
			fu_b.append(grosso[k] * 0.6)
		_tubo(st, linha_b, la_b, fu_b, Vector3.UP, 1.0, 0.92)
	st.index() # junta os vértices iguais: normais suaves, sem facetas duras
	st.generate_normals()
	var barba := MeshInstance3D.new()
	barba.name = "Barba"
	barba.mesh = st.commit()
	barba.material_override = _toon(Color("d8d4cc"), Color("a8a49c"), Color("4a4640"), 0.0022, Vector2(-0.15, 0.4))
	var ba := BoneAttachment3D.new()
	ba.bone_idx = cab
	esq.add_child(ba)
	ba.add_child(barba)

# ---------- roupa de ofício ----------
# Quem não luta não usa couraça (direção de arte 2026-11-05). A peça "peitoral0" da roupa só serve para deixar a blusa
# do VRoid lisa e justa (sem capuz nem gola de uniforme); as placas dela somem e a blusa ganha a cor do ofício.
# v: tunica (cor da blusa), saia (cor), ate ("joelho" ou "canela"), faixa (cor), corpete (cor), avental (cor)
static func _roupa_de_oficio(raiz: Node3D, esq: Skeleton3D, v: Dictionary) -> void:
	var placas := esq.get_node_or_null("Armadura_corpo")
	if placas:
		placas.visible = false
	if v.has("tunica"):
		var c := _cor(v.tunica)
		var m := _toon(c, _sombra(c), c.darkened(0.65), 0.0025)
		for mi in raiz.find_children("*", "MeshInstance3D", true, false):
			if not (mi.mesh is ArrayMesh) or str(mi.name).begins_with("Armadura"):
				continue
			for sfc in mi.mesh.get_surface_count():
				var nome: String = mi.mesh.surface_get_name(sfc)
				if "Tops" in nome and not "Outline" in nome:
					if not mi.has_meta("colada"):
						mi.set_meta("colada", true)
						_colar_no_corpo(raiz, mi)
					mi.set_surface_override_material(sfc, m)
				elif "Tops" in nome:
					# o contorno original da blusa não foi apertado junto (_cintura) e saía em abas pretas nos ombros:
					# some, e o contorno vem do material novo (next_pass)
					mi.set_surface_override_material(sfc, _invisivel())
	var f := _frente(esq)
	var quadril := esq.find_bone("J_Bip_C_Hips")
	if quadril < 0:
		return
	# corpo na pose de descanso (espaço canônico, +z = frente): pele, blusa e as peças da armadura que estão à mostra
	var V := PackedVector3Array()
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		if not (mi.mesh is ArrayMesh) or not _visivel(mi, raiz) or str(mi.name) == "Barba":
			continue
		for sfc in mi.mesh.get_surface_count():
			var nome: String = mi.mesh.surface_get_name(sfc)
			if "Outline" in nome or "HAIR" in nome or "Hair" in nome or "FACE" in nome or "EYE" in nome:
				continue
			for p in Malhas.vertices(mi.mesh, sfc):
				V.append(Vector3(p.x, p.y, p.z * f))
	var bp := func(n: String) -> Vector3:
		var i := esq.find_bone(n)
		var o := esq.get_bone_global_rest(i).origin if i >= 0 else Vector3.ZERO
		return Vector3(o.x, o.y, o.z * f)
	var centro: Vector3 = bp.call("J_Bip_C_Hips")
	var y_cint: float = bp.call("J_Bip_C_Spine").y + 0.06
	var joelho: Vector3 = bp.call("J_Bip_L_LowerLeg")
	var pe: Vector3 = bp.call("J_Bip_L_Foot")
	var y_fim: float = joelho.y - 0.035 if str(v.get("ate", "joelho")) == "joelho" else lerp(joelho.y, pe.y, 0.62)
	var no := Node3D.new()
	no.name = "Oficio"
	var ba := BoneAttachment3D.new()
	ba.bone_idx = quadril
	esq.add_child(ba)
	ba.add_child(no)
	var inv := esq.get_bone_global_rest(quadril).affine_inverse()
	var ctx := {"V": V, "c": centro, "f": f, "inv": inv, "esq": esq, "xl": 0.0, "xr": 0.0}
	# pele do corpo do VRoid: a saia usa os mesmos ossos (quadril e coxas)
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		if mi.skin and mi.mesh is ArrayMesh and "Body_00_SKIN" in mi.mesh.surface_get_name(0):
			ctx.skin = mi.skin
			break
	if ctx.has("skin"):
		var sk: Skin = ctx.skin
		for bi in sk.get_bind_count():
			var osso := sk.get_bind_bone(bi)
			var nome := esq.get_bone_name(osso) if osso >= 0 else str(sk.get_bind_name(bi))
			for par in [["J_Bip_C_Hips", "b_quadril"], ["J_Bip_L_UpperLeg", "b_coxa_l"], ["J_Bip_R_UpperLeg", "b_coxa_r"]]:
				if nome == par[0]:
					ctx[par[1]] = bi
		ctx.xl = esq.get_bone_global_rest(esq.find_bone("J_Bip_L_UpperLeg")).origin.x
		ctx.xr = esq.get_bone_global_rest(esq.find_bone("J_Bip_R_UpperLeg")).origin.x
	if v.has("saia"):
		var c := _cor(v.saia)
		_saia(no, ctx, y_cint, y_fim, 0.03, -PI, PI, _toon(c, _sombra(c), c.darkened(0.6), 0.003), true)
		if v.has("avental"):
			var ca := _cor(v.avental)
			_saia(no, ctx, y_cint - 0.01, y_fim + 0.07, 0.03, -0.85, 0.85, _toon(ca, _sombra(ca), ca.darkened(0.6), 0.002), false)
	if v.has("corpete"):
		var cc := _cor(v.corpete)
		_faixa(no, ctx, y_cint - 0.02, Armadura.junta_peito + 0.01, 0.008, _toon(cc, _sombra(cc), cc.darkened(0.6), 0.002), false)
	if v.has("faixa"):
		var cf := _cor(v.faixa)
		_faixa(no, ctx, y_cint - 0.025, y_cint + 0.025, 0.03 if v.has("saia") else 0.012, _toon(cf, _sombra(cf), cf.darkened(0.6), 0.002), true)

# raio do corpo em cada direção numa altura (o mais longe que algum vértice chega), suavizado
# Corrida de lobo (varredura 2026-11-13): cada anel olhava todos os vértices do corpo (~20 mil) e refazia seno e
# cosseno por vértice. Saia, avental e faixas pedem dezenas de anéis por NPC: 35 a 60 ms no PC (~150 ms no celular)
# toda vez que um NPC de vila nascia. Agora os vértices ficam em gavetas de 1 cm de altura (montadas uma vez por
# corpo) e cada anel só olha as gavetas da sua faixa. O resultado é o mesmo, ponto por ponto.
const GAVETA_Y := 0.01
static func _gavetas(ctx: Dictionary) -> Dictionary:
	if ctx.has("_gavetas"):
		return ctx._gavetas
	var g := {}
	for p in ctx.V:
		var k := int(floor(p.y / GAVETA_Y))
		if not g.has(k):
			g[k] = []
		g[k].append(p)
	ctx._gavetas = g
	return g

static func _contorno_em(ctx: Dictionary, y: float, n: int, faixa := 0.015) -> Array:
	var r := []
	r.resize(n)
	r.fill(0.0)
	var c: Vector3 = ctx.c
	var dirs: Array[Vector2] = []
	for i in n:
		var a := TAU * i / n - PI
		dirs.append(Vector2(sin(a), cos(a)))
	var g := _gavetas(ctx)
	for k in range(int(floor((y - faixa) / GAVETA_Y)), int(floor((y + faixa) / GAVETA_Y)) + 1):
		for p in g.get(k, []):
			if abs(p.y - y) > faixa:
				continue
			var d := Vector2(p.x - c.x, p.z - c.z)
			for i in n:
				var proj := d.dot(dirs[i])
				if proj > r[i]:
					r[i] = proj
	var s := []
	for i in n:
		s.append(max(0.06, (r[(i - 1 + n) % n] + r[i] * 2.0 + r[(i + 1) % n]) / 4.0))
	return s

# saia (ou avental, quando a0..a1 não dá a volta): anéis da cintura até a barra, nunca entra depois do quadril,
# abre um pouco para baixo e tem dobras que crescem perto da barra
static func _saia(no: Node3D, ctx: Dictionary, y0: float, y1: float, folga: float, a0: float, a1: float, mat: Material, volta: bool) -> void:
	var n := 40
	var niveis := 16
	var aneis := []
	var ant := []
	for k in niveis + 1:
		var t := float(k) / niveis
		var y: float = lerp(y0, y1, t)
		var r := _contorno_em(ctx, y, n)
		# ponta solta (algum vértice longe do corpo) não pode puxar o pano: no máximo 35% acima da mediana do anel
		var ord := r.duplicate()
		ord.sort()
		var med: float = ord[n / 2]
		var anel := []
		for i in n + 1:
			var ii := i % n
			var a := TAU * ii / n - PI
			# na pose parada as coxas vêm um pouco para a frente: mais folga na frente, crescendo para baixo
			var rr: float = min(r[ii], med * 1.35) + folga + t * 0.07 + max(0.0, cos(a)) * 0.07 * t
			if k > 0:
				rr = clamp(rr, ant[ii] * 0.995, ant[ii] + 0.03) # depois do quadril o pano cai, não volta para dentro
			r[ii] = rr
			anel.append(rr)
		ant = r.duplicate()
		aneis.append(anel)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var c: Vector3 = ctx.c
	var f: float = ctx.f
	var inv: Transform3D = ctx.inv
	var pts := []
	for k in aneis.size():
		var t := float(k) / niveis
		var linha := []
		for i in n + 1:
			var a := TAU * i / n - PI
			if not volta:
				a = lerp(a0, a1, float(i) / n)
			var ii := int(round((a + PI) / TAU * n)) % n
			var dobra := 1.0 + (0.012 + 0.035 * t) * sin(a * 9.0 + 0.6)
			var rr: float = aneis[k][ii] * dobra + (0.006 if not volta else 0.0)
			var y: float = lerp(y0, y1, t) + (0.012 * sin(a * 5.0 + 1.3) * t if k == niveis else 0.0)
			var p := Vector3(c.x + sin(a) * rr, y, c.z + cos(a) * rr)
			var sombra := 0.82 + 0.18 * (0.5 + 0.5 * sin(a * 9.0 + 0.6 + 1.2)) # fundo das dobras mais escuro
			# pele da saia: embaixo ela segue as coxas (senão o joelho fura o pano na pose parada); em cima, o quadril
			var pm := Vector3(p.x, p.y, p.z * f) # espaço do modelo
			var g: float = smoothstep(0.05, 1.0, t) * 0.9
			var sl: float = clamp(0.5 + (pm.x - (ctx.xl + ctx.xr) * 0.5) / (ctx.xl - ctx.xr) * 1.4, 0.0, 1.0) if ctx.xl != ctx.xr else 0.5
			linha.append([pm, sombra, [1.0 - g, g * sl, g * (1.0 - sl)]])
		pts.append(linha)
	var skin: Skin = ctx.get("skin")
	var b_q: int = ctx.get("b_quadril", -1)
	var b_l: int = ctx.get("b_coxa_l", -1)
	var b_r: int = ctx.get("b_coxa_r", -1)
	var com_pele := skin != null and b_q >= 0 and b_l >= 0 and b_r >= 0
	for k in pts.size() - 1:
		for i in n:
			for q in [pts[k][i], pts[k][i + 1], pts[k + 1][i], pts[k][i + 1], pts[k + 1][i + 1], pts[k + 1][i]]:
				st.set_color(Color(q[1], q[1], q[1]))
				if com_pele:
					st.set_bones(PackedInt32Array([b_q, b_l, b_r, b_q]))
					st.set_weights(PackedFloat32Array([q[2][0], q[2][1], q[2][2], 0.0]))
					st.add_vertex(q[0])
				else:
					st.add_vertex(inv * q[0])
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	if com_pele: # malha com pele, presa no esqueleto como a roupa do VRoid
		var esq: Skeleton3D = ctx.esq
		mi.name = "Oficio_saia"
		esq.add_child(mi)
		mi.skin = skin
		mi.skeleton = mi.get_path_to(esq)
	else:
		no.add_child(mi)

# faixa de pano em volta do corpo entre duas alturas (cinta da túnica ou corpete); com ponta caída do lado esquerdo
static func _faixa(no: Node3D, ctx: Dictionary, y0: float, y1: float, folga: float, mat: Material, ponta: bool) -> void:
	var n := 40
	var niveis := 4
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var c: Vector3 = ctx.c
	var f: float = ctx.f
	var inv: Transform3D = ctx.inv
	var pts := []
	for k in niveis + 1:
		var y: float = lerp(y0, y1, float(k) / niveis)
		var r := _contorno_em(ctx, y, n, 0.012)
		var linha := []
		for i in n + 1:
			var a := TAU * i / n - PI
			var rr: float = r[i % n] + folga
			linha.append(inv * Vector3(c.x + sin(a) * rr, y, (c.z + cos(a) * rr) * f))
		pts.append(linha)
	for k in niveis:
		for i in n:
			for q in [pts[k][i], pts[k][i + 1], pts[k + 1][i], pts[k][i + 1], pts[k + 1][i + 1], pts[k + 1][i]]:
				st.set_color(Color(1, 1, 1))
				st.add_vertex(q)
	if ponta: # duas pontas do nó caindo na frente, um pouco para a esquerda
		var r0 := _contorno_em(ctx, (y0 + y1) * 0.5, n, 0.012)
		for lado in [[0.42, 0.2], [0.52, 0.16]]:
			var a: float = lado[0]
			var comp: float = lado[1]
			var rr: float = r0[int(round((a + PI) / TAU * n)) % n] + folga + 0.006
			var topo := Vector3(c.x + sin(a) * rr, (y0 + y1) * 0.5, c.z + cos(a) * rr)
			var larg := 0.022
			var tg := Vector3(cos(a), 0, -sin(a)) * larg
			var q := [topo - tg, topo + tg, topo + tg + Vector3(0.005, -comp, 0.012), topo - tg + Vector3(-0.004, -comp * 0.94, 0.012)]
			for i in [0, 1, 2, 0, 2, 3]:
				st.set_color(Color(0.92, 0.92, 0.92))
				var p: Vector3 = q[i]
				st.add_vertex(inv * Vector3(p.x, p.y, p.z * f))
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mat
	no.add_child(mi)

# visível até a raiz do modelo (funciona fora da árvore também); a capa não conta como corpo
static func _visivel(n: Node, raiz: Node) -> bool:
	while n and n != raiz:
		if n is Node3D and not n.visible:
			return false
		if str(n.name) in ["Armadura_capa", "Oficio"]:
			return false
		n = n.get_parent()
	return true

# ---------- friso dourado do Mestre Ivo (direção de arte: o Lendário precisa ler laranja/dourado) ----------
# barras de 3,5 cm na gola, nos punhos e na barra da túnica, por cima do set de couro. Só no NPC: o set do herói fica.
const OURO := Color("e0a030")
const OURO_SOMBRA := Color("a8701c")

static func _vertices_corpo(raiz: Node3D, f: float) -> PackedVector3Array:
	var V := PackedVector3Array()
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		if not (mi.mesh is ArrayMesh) or not _visivel(mi, raiz) or str(mi.name) == "Barba":
			continue
		for sfc in mi.mesh.get_surface_count():
			var nome: String = mi.mesh.surface_get_name(sfc)
			if "Outline" in nome or "HAIR" in nome or "Hair" in nome or "FACE" in nome or "EYE" in nome:
				continue
			for p in Malhas.vertices(mi.mesh, sfc):
				V.append(Vector3(p.x, p.y, p.z * f))
	return V

static func _friso_dourado(raiz: Node3D, esq: Skeleton3D) -> void:
	var f := _frente(esq)
	var V := _vertices_corpo(raiz, f)
	if V.is_empty():
		return
	var mat := _toon(OURO, OURO_SOMBRA, Color("4a2e10"), 0.002)
	var bp := func(n: String) -> Vector3:
		var i := esq.find_bone(n)
		var o := esq.get_bone_global_rest(i).origin if i >= 0 else Vector3.ZERO
		return Vector3(o.x, o.y, o.z * f)
	var prender := func(osso: String) -> Array: # [nó preso no osso, inversa da pose de descanso]
		var i := esq.find_bone(osso)
		var ba := BoneAttachment3D.new()
		ba.bone_idx = i
		esq.add_child(ba)
		var n := Node3D.new()
		n.name = "Friso"
		ba.add_child(n)
		return [n, esq.get_bone_global_rest(i).affine_inverse()]
	# gola: em volta da base do pescoço
	var pesc: Vector3 = bp.call("J_Bip_C_Neck")
	var perto := PackedVector3Array() # só o tronco perto do pescoço (os braços abertos em T ficam na mesma altura)
	for p in V:
		if Vector2(p.x - pesc.x, p.z - pesc.z).length() < 0.12:
			perto.append(p)
	var g = prender.call("J_Bip_C_UpperChest")
	_faixa(g[0], {"V": perto, "c": pesc, "f": f, "inv": g[1]}, pesc.y - 0.035, pesc.y - 0.002, 0.005, mat, false)
	# barra do gibão: faixa na cintura, por cima do cinto (um anel na barra da túnica abraçava as duas pernas)
	var quadril: Vector3 = bp.call("J_Bip_C_Hips")
	var y_c: float = bp.call("J_Bip_C_Spine").y + 0.02
	var tronco := PackedVector3Array()
	for p in V:
		if Vector2(p.x - quadril.x, p.z - quadril.z).length() < 0.2:
			tronco.append(p)
	var h = prender.call("J_Bip_C_Hips")
	_faixa(h[0], {"V": tronco, "c": quadril, "f": f, "inv": h[1]}, y_c - 0.015, y_c + 0.015, 0.006, mat, false)
	# punhos: anel em volta do antebraço, logo antes da mão (os braços ficam abertos em T na pose de descanso)
	for lado in ["L", "R"]:
		var mao: Vector3 = bp.call("J_Bip_%s_Hand" % lado)
		var cot: Vector3 = bp.call("J_Bip_%s_LowerArm" % lado)
		var eixo := (mao - cot).normalized()
		var a = prender.call("J_Bip_%s_LowerArm" % lado)
		_anel_braco(a[0], V, mao - eixo * 0.05, eixo, 0.035, f, a[1], mat)

# anel em volta de um eixo (braço): raio de cada direção = o vértice mais longe naquela fatia, mais 6 mm
static func _anel_braco(no: Node3D, V: PackedVector3Array, centro: Vector3, eixo: Vector3, alt: float, f: float, inv: Transform3D, mat: Material) -> void:
	var n := 24
	var u := eixo.cross(Vector3.FORWARD).normalized()
	var w := eixo.cross(u).normalized()
	var r := []
	r.resize(n)
	r.fill(0.03)
	for p in V:
		var d := p - centro
		var h := d.dot(eixo)
		if abs(h) > alt * 0.6:
			continue
		var q := d - eixo * h
		if q.length() > 0.09:
			continue
		for i in n:
			var a := TAU * i / n
			var pr := q.dot(u * cos(a) + w * sin(a))
			if pr > r[i]:
				r[i] = pr
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var aneis := []
	for k in 2:
		var linha := []
		for i in n + 1:
			var a := TAU * (i % n) / n
			var rr: float = (r[(i - 1 + n) % n] + r[i % n] * 2.0 + r[(i + 1) % n]) / 4.0 + 0.006
			var p := centro + eixo * (alt * (k - 0.5)) + (u * cos(a) + w * sin(a)) * rr
			linha.append(inv * Vector3(p.x, p.y, p.z * f))
		aneis.append(linha)
	for i in n:
		for q in [aneis[0][i], aneis[0][i + 1], aneis[1][i], aneis[0][i + 1], aneis[1][i + 1], aneis[1][i]]:
			st.set_color(Color(1, 1, 1))
			st.add_vertex(q)
	st.generate_normals()
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mat
	no.add_child(mi)

extends SceneTree
# André 2026-11-07: a Ruiva não tem peito nem braço por baixo da roupa (o VRoid apagou). Este script pega o tronco
# e o alto dos braços de pele de verdade da Victoria (outro corpo VRoid, já no jogo), encaixa nos ossos da Ruiva e
# grava godot-prototipo/corpo/tronco_ruiva.res (malha) e tronco_ruiva.png (textura da pele da Victoria).
# Cada vértice segue os ossos da Victoria e vai para os mesmos ossos da Ruiva, encolhido na proporção das alturas.
# Os ossos ficam por nome (meta "ossos"): o jogo monta o Skin com as poses da Ruiva (armadura.gd, _tronco).
# Uso (com os modelos gerados em godot-prototipo/modelos):
#   godot --headless --path godot-prototipo -s ../ferramentas/tronco/assar_tronco.gd
const OSSOS := ["J_Bip_C_Spine", "J_Bip_C_Chest", "J_Bip_C_UpperChest", "J_Sec_L_Bust1", "J_Sec_L_Bust2", "J_Sec_R_Bust1",
	"J_Sec_R_Bust2", "J_Bip_L_Shoulder", "J_Bip_R_Shoulder", "J_Bip_L_UpperArm", "J_Bip_R_UpperArm",
	"J_Bip_L_LowerArm", "J_Bip_R_LowerArm"]
# O pescoço da Victoria também vem (a Ruiva tem um buraco em V na frente do pescoço, onde era a gola), mas a
# pele do pescoço da Ruiva fica por baixo: só os ossos de OSSOS tiram a pele dela.
# o quadril fica com a pele da própria Ruiva (o short desenhado nela sai em limpar_pele.gd)
const FOLGA := 0.0025

func _init():
	var doador: Node3D = load("res://modelos/victoria.glb").instantiate()
	var alvo: Node3D = load("res://modelos/ruiva.glb").instantiate()
	var esq_d: Skeleton3D = doador.find_children("*", "Skeleton3D", true, false)[0]
	var esq_a: Skeleton3D = alvo.find_children("*", "Skeleton3D", true, false)[0]
	var vira_d := _vira(esq_d)
	var vira_a := _vira(esq_a)
	print("vira ", vira_d, " ", vira_a)
	var corpo_a: MeshInstance3D = null
	for mi in alvo.find_children("*", "MeshInstance3D", true, false):
		if "Body_00" in mi.mesh.surface_get_name(0):
			corpo_a = mi
	var poses_a := {}
	for i in corpo_a.skin.get_bind_count():
		poses_a[_nome(corpo_a.skin, i, esq_a)] = corpo_a.skin.get_bind_pose(i)
	var esc := (esq_a.get_bone_global_rest(esq_a.find_bone("J_Bip_C_Neck")).origin.y - esq_a.get_bone_global_rest(esq_a.find_bone("J_Bip_C_Hips")).origin.y) \
		/ (esq_d.get_bone_global_rest(esq_d.find_bone("J_Bip_C_Neck")).origin.y - esq_d.get_bone_global_rest(esq_d.find_bone("J_Bip_C_Hips")).origin.y)
	print("escala ", esc)
	var nomes: Array[String] = []
	var st_pos := PackedVector3Array()
	var st_nor := PackedVector3Array()
	var st_uv := PackedVector2Array()
	var st_b := PackedInt32Array()
	var st_w := PackedFloat32Array()
	var st_i := PackedInt32Array()

	var textura: Texture2D = null
	for mi in doador.find_children("*", "MeshInstance3D", true, false):
		if not "Body_00" in mi.mesh.surface_get_name(0):
			continue
		var a: Array = mi.mesh.surface_get_arrays(0)
		var m = mi.mesh.surface_get_material(0)
		if m is BaseMaterial3D and m.albedo_texture:
			textura = m.albedo_texture
		var V: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
		var N: PackedVector3Array = a[Mesh.ARRAY_NORMAL]
		var U: PackedVector2Array = a[Mesh.ARRAY_TEX_UV]
		var B: PackedInt32Array = a[Mesh.ARRAY_BONES]
		var W: PackedFloat32Array = a[Mesh.ARRAY_WEIGHTS]
		var I: PackedInt32Array = a[Mesh.ARRAY_INDEX]
		var k := B.size() / V.size()
		var bnome := []
		for i in mi.skin.get_bind_count():
			bnome.append(_nome(mi.skin, i, esq_d))
		var ok := PackedByteArray()

		ok.resize(V.size())
		for v in V.size():
			var melhor := -1.0
			var nm := ""
			for j in k:
				if W[v * k + j] > melhor:
					melhor = W[v * k + j]
					nm = bnome[B[v * k + j]]
			ok[v] = 1 if (nm in OSSOS or nm == "J_Bip_C_Neck") else 0

		var novo := {}
		for t in range(0, I.size(), 3):
			if not (ok[I[t]] and ok[I[t + 1]] and ok[I[t + 2]]):
				continue
			var lista := st_i
			for e in 3:
				var v := I[t + e]
				if not novo.has(v):
					novo[v] = st_pos.size()
					var p := Vector3.ZERO
					var n := Vector3.ZERO
					var soma := 0.0
					var vd := _F(V[v], vira_d)
					for j in k:
						var w := W[v * k + j]
						if w <= 0.0:
							continue
						var nmj: String = bnome[B[v * k + j]]
						if not poses_a.has(nmj) or esq_d.find_bone(nmj) < 0 or esq_a.find_bone(nmj) < 0:
							continue
						var od := _F(esq_d.get_bone_global_rest(esq_d.find_bone(nmj)).origin, vira_d)
						var oa := _F(esq_a.get_bone_global_rest(esq_a.find_bone(nmj)).origin, vira_a)
						p += (oa + (vd - od) * esc) * w
						soma += w
						if not nmj in nomes:
							nomes.append(nmj)
						st_b.append(nomes.find(nmj))
						st_w.append(w)
					while st_b.size() % 4 != 0:
						st_b.append(0)
						st_w.append(0.0)
					var base := st_w.size() - 4
					for j in 4:
						st_w[base + j] /= maxf(soma, 1e-6)
					n = _F(_F(N[v], vira_d), vira_a).normalized()
					# 2,5 mm por fora da pele da Ruiva (o que sobrou dela por baixo não pisca através)
					st_pos.append(_F(p / maxf(soma, 1e-6), vira_a) + n * FOLGA)
					st_nor.append(n)
					st_uv.append(U[v])
				lista.append(novo[v])
	print("vertices ", st_pos.size(), " triangulos ", st_i.size() / 3, " ossos ", nomes)
	var img := textura.get_image().duplicate()
	if img.is_compressed():
		img.decompress()
	img.clear_mipmaps()
	img.convert(Image.FORMAT_RGBA8)
	var cos := _costurar(st_pos, st_i, st_uv, img, corpo_a, esq_a, vira_a)
	_gravar(cos[0], st_nor, st_uv, st_b, st_w, cos[1], nomes, "res://corpo/tronco_ruiva.res", cos[2], cos[3], cos[4])
	img.resize(1024, 1024, Image.INTERPOLATE_LANCZOS)
	img.save_png("res://corpo/tronco_ruiva.png")
	print("gravou")
	quit()

# A Ruiva ganha cintura fina no jogo (armadura.gd, _forma_corpo): o tronco aperta igual. A emenda fica numa altura
# só (CORTE acima do osso Spine): abaixo dela é a pele da Ruiva, acima o tronco. A borda do tronco (pescoço, cintura,
# punhos) cola na borda do buraco que ele deixa na Ruiva, e o resto vem junto aos poucos (3 cm). Na emenda a cor
# da Victoria é corrigida pela da Ruiva (cor de vértice), sumindo em 8 cm.
const CORTE := 0.0
func _costurar(pos: PackedVector3Array, I: PackedInt32Array, U: PackedVector2Array, img_d: Image, corpo: MeshInstance3D, esq: Skeleton3D, vira: bool) -> Array:
	var Arm = load("res://armadura.gd")
	var Ap = load("res://aparencia.gd")
	Arm._orientar(esq)
	var R = Arm._ref(esq)
	var corte: float = R.y_cintura + CORTE
	var forma = func(p: Vector3) -> Vector3:
		if absf(p.x) > 0.24 or p.y > R.y_cintura + 0.25 or p.y < R.y_cintura - 0.2:
			return p
		var k: Vector2 = Arm._fator_forma(p.y, R)
		return Vector3(p.x * k.x, p.y, 0.005 + (p.z - 0.005) * k.y)
	for i in pos.size():
		pos[i] = _F(forma.call(_F(pos[i], vira)), vira)
	# o tronco fica só do corte para cima
	var J := PackedInt32Array()
	for t in range(0, I.size(), 3):
		if maxf(pos[I[t]].y, maxf(pos[I[t + 1]].y, pos[I[t + 2]].y)) > corte:
			J.append_array([I[t], I[t + 1], I[t + 2]])
	I = J
	# borda do tronco: arestas de um triângulo só (vértices soldados pela posição)
	var chave := func(p: Vector3) -> Vector3i:
		return Vector3i(roundi(p.x * 10000.0), roundi(p.y * 10000.0), roundi(p.z * 10000.0))
	var arestas := {}
	for t in range(0, I.size(), 3):
		for e in 3:
			var c0: Vector3i = chave.call(pos[I[t + e]])
			var c1: Vector3i = chave.call(pos[I[t + (e + 1) % 3]])
			var ar := [c0, c1] if str(c0) < str(c1) else [c1, c0]
			arestas[ar] = arestas.get(ar, 0) + 1
	var na_borda := {}
	for ar in arestas:
		if arestas[ar] == 1:
			na_borda[ar[0]] = true
			na_borda[ar[1]] = true
	var usado := PackedByteArray()
	usado.resize(pos.size())
	for i in I:
		usado[i] = 1
	# até onde o pescoço da Victoria cobre o da Ruiva (abaixo disso a pele do pescoço da Ruiva sai)
	var pescoco_ate := 10.0
	for i in pos.size():
		if usado[i] and na_borda.has(chave.call(pos[i])) and _F(pos[i], vira).y > R.y_pescoco - 0.02:
			pescoco_ate = minf(pescoco_ate, _F(pos[i], vira).y - 0.012)
	print("pescoço até ", pescoco_ate, " (pescoço ", R.y_pescoco, ")")
	# borda do buraco na pele da Ruiva (mesma regra de armadura.gd, _sem_contorno_tronco)
	var a: Array = corpo.mesh.surface_get_arrays(0)
	var V: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
	var UA: PackedVector2Array = a[Mesh.ARRAY_TEX_UV]
	var B: PackedInt32Array = a[Mesh.ARRAY_BONES]
	var W: PackedFloat32Array = a[Mesh.ARRAY_WEIGHTS]
	var IC: PackedInt32Array = a[Mesh.ARRAY_INDEX]
	var k := B.size() / V.size()
	var tira := PackedByteArray()
	tira.resize(V.size())
	for v in V.size():
		var melhor := -1.0
		var nm := ""
		for j in k:
			if W[v * k + j] > melhor:
				melhor = W[v * k + j]
				nm = _nome(corpo.skin, B[v * k + j], esq)
		var y := _F(V[v], vira).y
		tira[v] = 1 if ((nm in OSSOS and y > corte) or (nm == "J_Bip_C_Neck" and y < pescoco_ate)) else 0
	var no_tirado := PackedByteArray()
	var no_fica := PackedByteArray()
	no_tirado.resize(V.size())
	no_fica.resize(V.size())
	for t in range(0, IC.size(), 3):
		var sai: bool = tira[IC[t]] and tira[IC[t + 1]] and tira[IC[t + 2]]
		for e in 3:
			if sai:
				no_tirado[IC[t + e]] = 1
			else:
				no_fica[IC[t + e]] = 1
	var img_a: Image = load("res://corpo/pele_ruiva.png").get_image()
	var borda_a := PackedVector3Array()
	var cor_a := []
	for v in V.size():
		if no_tirado[v] and no_fica[v]:
			borda_a.append(_F(forma.call(_F(V[v], vira)), vira))
			cor_a.append(_amostra(img_a, UA[v]))
	# o mesmo ajuste de tom que o jogo faz no material (armadura.gd, _tronco)
	var ma: Color = Ap.media(ImageTexture.create_from_image(img_a), true)
	var mdi := img_d.duplicate()
	mdi.resize(1024, 1024, Image.INTERPOLATE_LANCZOS)
	var md: Color = Ap.media(ImageTexture.create_from_image(mdi), true)
	var tom := Vector3(clampf(ma.r / maxf(md.r, 0.01), 0.7, 1.4), clampf(ma.g / maxf(md.g, 0.01), 0.7, 1.4), clampf(ma.b / maxf(md.b, 0.01), 0.7, 1.4))
	var bp := PackedVector3Array()
	var bd := PackedVector3Array()
	var bc := PackedVector3Array()
	for i in pos.size():
		var c: Vector3i = chave.call(pos[i])
		if not usado[i] or not na_borda.has(c) or _F(pos[i], vira).y > R.y_pescoco - 0.02:
			continue
		var perto := -1
		var dm := 1e9
		for q in borda_a.size():
			var d := borda_a[q].distance_squared_to(pos[i])
			if d < dm:
				dm = d
				perto = q
		if perto >= 0 and sqrt(dm) < 0.05:
			bp.append(pos[i])
			bd.append(borda_a[perto] - pos[i])
			var ca: Color = cor_a[perto]
			var cd := _amostra(img_d, U[i])
			# só pele com pele (ponto de roupa, sombra ou borda da textura não corrige nada)
			var pele_a: bool = absf(ca.r - ma.r) + absf(ca.g - ma.g) + absf(ca.b - ma.b) < 0.18
			var pele_d: bool = absf(cd.r - md.r) + absf(cd.g - md.g) + absf(cd.b - md.b) < 0.18
			if pele_a and pele_d:
				bc.append(Vector3(clampf(ca.r / maxf(cd.r * tom.x, 0.01), 0.88, 1.12), clampf(ca.g / maxf(cd.g * tom.y, 0.01), 0.88, 1.12), clampf(ca.b / maxf(cd.b * tom.z, 0.01), 0.88, 1.12)))
			else:
				bc.append(Vector3.ONE)
	var ruins := 0
	for c in bc:
		if c == Vector3.ONE:
			ruins += 1
	print("sem cor ", ruins)
	print("borda do tronco ", bp.size(), " borda da pele ", borda_a.size(), " tom ", tom)
	var saida := PackedVector3Array(pos)
	var cores := PackedColorArray()
	cores.resize(pos.size())
	for i in pos.size():
		var dm := 1e9
		var d := Vector3.ZERO
		var cc := Vector3.ONE
		for j in bp.size():
			var dd := bp[j].distance_squared_to(pos[i])
			if dd < dm:
				dm = dd
				d = bd[j]
				cc = bc[j]
		var t := clampf(1.0 - sqrt(dm) / 0.03, 0.0, 1.0)
		saida[i] = pos[i] + d * t * t * (3.0 - 2.0 * t)
		var tc := clampf(1.0 - sqrt(dm) / 0.08, 0.0, 1.0)
		tc = tc * tc * (3.0 - 2.0 * tc)
		# a cor de vértice entra linear e o albedo_color é sRGB: a razão vai elevada a 2,2
		var f := Vector3.ONE.lerp(cc, tc) / ESCALA_COR
		cores[i] = Color(pow(f.x, 2.2), pow(f.y, 2.2), pow(f.z, 2.2), 1.0)
	return [saida, I, cores, corte, pescoco_ate]

# a cor de vértice vai de 0 a 1: guarda dividida por ESCALA_COR e o jogo multiplica de volta (meta "escala_cor")
const ESCALA_COR := 1.25

func _amostra(img: Image, uv: Vector2) -> Color:
	var x := clampi(int(uv.x * img.get_width()), 2, img.get_width() - 3)
	var y := clampi(int(uv.y * img.get_height()), 2, img.get_height() - 3)
	var s := Color(0, 0, 0, 0)
	for dy in range(-2, 3):
		for dx in range(-2, 3):
			s += img.get_pixel(x + dx, y + dy)
	return s / 25.0

func _gravar(st_pos, st_nor, st_uv, st_b, st_w, st_i, nomes, arq: String, cores: PackedColorArray, corte: float, pescoco_ate: float) -> void:
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = st_pos
	arr[Mesh.ARRAY_NORMAL] = st_nor
	arr[Mesh.ARRAY_TEX_UV] = st_uv
	arr[Mesh.ARRAY_BONES] = st_b
	arr[Mesh.ARRAY_WEIGHTS] = st_w
	arr[Mesh.ARRAY_INDEX] = st_i
	arr[Mesh.ARRAY_COLOR] = cores
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	am.surface_set_name(0, "Tronco_Body_SKIN")
	am.set_meta("ossos", nomes)
	am.set_meta("escala_cor", ESCALA_COR)
	am.set_meta("corte", corte) # a pele da Ruiva só sai acima dessa altura
	am.set_meta("pescoco_ate", pescoco_ate) # e a do pescoço só abaixo dessa
	am.set_meta("cobre", OSSOS) # ossos cuja pele da Ruiva sai debaixo do tronco (armadura.gd, _sem_contorno_tronco)
	ResourceSaver.save(am, arq)

func _vira(esq: Skeleton3D) -> bool: # como armadura.gd (_orientar): o dedo do pé atrás do pé = virado
	var pe := esq.find_bone("J_Bip_L_Foot")
	var dedo := esq.find_bone("J_Bip_L_ToeBase")
	return esq.get_bone_global_rest(dedo).origin.z < esq.get_bone_global_rest(pe).origin.z

func _F(p: Vector3, vira: bool) -> Vector3:
	return Vector3(-p.x, p.y, -p.z) if vira else p

func _nome(skin: Skin, i: int, esq: Skeleton3D) -> String:
	var n := skin.get_bind_name(i)
	if n == "":
		n = esq.get_bone_name(skin.get_bind_bone(i))
	return n

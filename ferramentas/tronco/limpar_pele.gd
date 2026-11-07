extends SceneTree
# André 2026-11-07: a textura do corpo da Ruiva tem um short preto desenhado no quadril (e é transparente onde a
# roupa cobria). Este script pinta de pele, na textura, os triângulos do quadril e das coxas que não têm cor de pele,
# e preenche o transparente. Grava godot-prototipo/corpo/pele_ruiva.png, que armadura.gd (_tronco) põe no corpo.
# Uso: godot --headless --path godot-prototipo -s ../ferramentas/tronco/limpar_pele.gd
const OSSOS := ["J_Bip_C_Hips", "J_Bip_L_UpperLeg", "J_Bip_R_UpperLeg", "J_Bip_C_Spine", "J_Bip_C_Neck"]

func _init():
	var no: Node3D = load("res://modelos/ruiva.glb").instantiate()
	var esq: Skeleton3D = no.find_children("*", "Skeleton3D", true, false)[0]
	var corpo: MeshInstance3D = null
	for mi in no.find_children("*", "MeshInstance3D", true, false):
		if "Body_00" in mi.mesh.surface_get_name(0):
			corpo = mi
	var m: BaseMaterial3D = corpo.mesh.surface_get_material(0)
	var img: Image = m.albedo_texture.get_image().duplicate()
	if img.is_compressed():
		img.decompress()
	img.clear_mipmaps()
	img.convert(Image.FORMAT_RGBA8)
	var W := img.get_width()
	var H := img.get_height()
	var pele: Color = load("res://aparencia.gd").media(m.albedo_texture, true)
	pele.a = 1.0
	var a: Array = corpo.mesh.surface_get_arrays(0)
	var U: PackedVector2Array = a[Mesh.ARRAY_TEX_UV]
	var B: PackedInt32Array = a[Mesh.ARRAY_BONES]
	var Wt: PackedFloat32Array = a[Mesh.ARRAY_WEIGHTS]
	var I: PackedInt32Array = a[Mesh.ARRAY_INDEX]
	var k := B.size() / U.size()
	var ok := PackedByteArray()
	ok.resize(U.size())
	for v in U.size():
		var melhor := -1.0
		var nm := ""
		for j in k:
			if Wt[v * k + j] > melhor:
				melhor = Wt[v * k + j]
				var bi := corpo.skin.get_bind_bone(B[v * k + j])
				nm = corpo.skin.get_bind_name(B[v * k + j])
				if nm == "":
					nm = esq.get_bone_name(bi)
		ok[v] = 1 if nm in OSSOS else 0
	var trocados := 0
	for t in range(0, I.size(), 3):
		if not (ok[I[t]] or ok[I[t + 1]] or ok[I[t + 2]]):
			continue
		var p0 := U[I[t]] * Vector2(W, H)
		var p1 := U[I[t + 1]] * Vector2(W, H)
		var p2 := U[I[t + 2]] * Vector2(W, H)
		var x0 := clampi(int(floor(minf(p0.x, minf(p1.x, p2.x)))) - 1, 0, W - 1)
		var x1 := clampi(int(ceil(maxf(p0.x, maxf(p1.x, p2.x)))) + 1, 0, W - 1)
		var y0 := clampi(int(floor(minf(p0.y, minf(p1.y, p2.y)))) - 1, 0, H - 1)
		var y1 := clampi(int(ceil(maxf(p0.y, maxf(p1.y, p2.y)))) + 1, 0, H - 1)
		var area := (p1 - p0).cross(p2 - p0)
		if absf(area) < 1e-6:
			continue
		for y in range(y0, y1 + 1):
			for x in range(x0, x1 + 1):
				var q := Vector2(x + 0.5, y + 0.5)
				var w0 := (p1 - q).cross(p2 - q) / area
				var w1 := (p2 - q).cross(p0 - q) / area
				var w2 := 1.0 - w0 - w1
				if w0 < -0.02 or w1 < -0.02 or w2 < -0.02:
					continue
				var c := img.get_pixel(x, y)
				if c.a < 0.5 or absf(c.r - pele.r) + absf(c.g - pele.g) + absf(c.b - pele.b) > 0.22:
					img.set_pixel(x, y, pele)
					trocados += 1
	# o resto transparente vira pele também
	var fundo := Image.create(W, H, false, Image.FORMAT_RGBA8)
	fundo.fill(pele)
	fundo.blend_rect(img, Rect2i(0, 0, W, H), Vector2i.ZERO)
	fundo.save_png("res://corpo/pele_ruiva.png")
	print("pixels trocados ", trocados, " tamanho ", W, "x", H)
	quit()

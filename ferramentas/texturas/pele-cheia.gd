extends SceneTree
# Pele cheia pronta no build (2026-11-19, pedido do setor de Desempenho). armadura.gd _pele_cheia dá à textura do corpo
# VRoid um fundo da cor da pele (o transparente por baixo da roupa vira pele). Antes o celular montava isso no jogo: uma
# imagem de 2048 px sem compressão (~22 MB na placa por corpo) e ~100 ms de processador na primeira vez de cada corpo.
# Aqui o build grava modelos/<textura>_pele.png com a mesma conta (Armadura.pele_cheia_imagem); celular.mjs comprime
# para a placa como as outras texturas dos corpos e o jogo só carrega o arquivo.
# Roda no apk.yml depois do primeiro "godot --import" (precisa das texturas tiradas do .glb). Só regrava o arquivo que
# mudou, para não reimportar nem mandar de novo no pacote.
# Uso: godot --headless --path godot-prototipo -s ../ferramentas/texturas/pele-cheia.gd
func _initialize() -> void:
	var Armadura = load("res://armadura.gd")
	var feitas := 0
	var iguais := 0
	var dir := DirAccess.open("res://modelos")
	if dir == null:
		print("pele cheia: sem modelos/")
		quit()
		return
	for n in dir.get_files():
		if not n.ends_with(".glb"):
			continue
		var cena = load("res://modelos/" + n)
		if not (cena is PackedScene):
			continue
		var raiz: Node = cena.instantiate()
		var vistos := {}
		for mi in raiz.find_children("*", "MeshInstance3D", true, false):
			if not (mi.mesh is ArrayMesh) or mi.mesh.get_surface_count() == 0 or not "Body_00" in mi.mesh.surface_get_name(0):
				continue
			var m = mi.mesh.surface_get_material(0)
			if not (m is BaseMaterial3D) or m.albedo_texture == null:
				continue
			var arq: String = Armadura.pele_cheia_arquivo(m.albedo_texture)
			if arq == "" or vistos.has(arq):
				continue
			vistos[arq] = true
			var img: Image = Armadura.pele_cheia_imagem(m.albedo_texture)
			if img == null:
				printerr("pele cheia: não leu ", m.albedo_texture.resource_path)
				continue
			img.clear_mipmaps() # o Godot refaz o mipmap na importação (mipmaps/generate=true, celular.mjs)
			var png := img.save_png_to_buffer()
			var caminho := ProjectSettings.globalize_path(arq)
			if FileAccess.file_exists(caminho) and FileAccess.get_file_as_bytes(caminho) == png:
				iguais += 1
				continue
			var f := FileAccess.open(caminho, FileAccess.WRITE)
			f.store_buffer(png)
			f.close()
			feitas += 1
			print("pele cheia: ", arq)
		raiz.free()
	print("pele cheia: %d novas, %d iguais" % [feitas, iguais])
	quit()

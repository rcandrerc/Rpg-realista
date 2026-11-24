extends SceneTree
# Grava o corpo como ele fica DENTRO do jogo com o traje vestido (pele, blusa, saia e sapato já apertados por
# armadura.gd: cintura, manga justa, tronco afinado do masculino, saia curta). É a "linha" que o patrulheiro do irmão
# segue; reajustar.py mede o Patrulheiro 2 / Roupão 2 por ela. Saída: OBJ em espaço do modelo (Y para cima).
# Uso: CORPO=ruiva SAIDA=/tmp/ruiva.obj xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/trajes-justos/corpo-do-jogo.gd
const Armadura := preload("res://armadura.gd")
func _initialize() -> void:
	var m = load("res://main.tscn").instantiate()
	root.add_child(m)
	for i in 60:
		await process_frame
	var corpo := OS.get_environment("CORPO")
	var no: Node3D = m.modelo(corpo)
	no.set_meta("traje", OS.get_environment("TRAJE") if OS.get_environment("TRAJE") != "" else "patrulheiro2")
	Armadura.vestir(no, Armadura.de_texto("chapeu2,peitoral2,calca2,botas2"))
	for i in 10:
		await process_frame
	var f := FileAccess.open(OS.get_environment("SAIDA"), FileAccess.WRITE)
	var base := 1
	for trecho in ["Body_00", "Tops", "Bottoms", "Shoes"]:
		var mi: MeshInstance3D = Armadura._fonte(no, trecho)
		if mi == null or mi.mesh == null:
			print("sem ", trecho)
			continue
		var t: Transform3D = no.global_transform.affine_inverse() * mi.global_transform
		print(trecho, " visivel=", mi.is_visible_in_tree(), " superficies=", mi.mesh.get_surface_count())
		# par: a malha crua (a do .glb, guardada em "malha_larga") e a do jogo, mesmos vértices na mesma ordem
		var larga: Mesh = mi.get_meta("malha_larga") if mi.has_meta("malha_larga") else mi.mesh
		for par in [["cru", larga], ["jogo", mi.mesh]]:
			var malha: Mesh = par[1]
			for s in malha.get_surface_count():
				var mat = malha.surface_get_material(s)
				var nome := str(malha.surface_get_name(s)) + "|" + (str(mat.resource_name) if mat else "")
				if nome.contains("Outline"):
					continue
				var arr := malha.surface_get_arrays(s)
				var V: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
				var I: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
				f.store_line("o %s_%s_%d" % [par[0], trecho, s])
				for p in V:
					var q := t * p
					f.store_line("v %f %f %f" % [q.x, q.y, q.z])
				for k in range(0, I.size(), 3):
					f.store_line("f %d %d %d" % [I[k] + base, I[k + 1] + base, I[k + 2] + base])
				base += V.size()
	f.close()
	quit()

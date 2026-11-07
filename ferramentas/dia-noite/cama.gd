extends SceneTree
# Teste da cama (André 2026-11-07: "cliquei na cama e não aconteceu nada"): põe uma cama minha do lado do herói,
# confere o botão de dia e de noite e o toque em cima da cama. Uso: FOTO_SAIDA=/pasta xvfb-run godot --path godot-prototipo -s ../ferramentas/dia-noite/cama.gd
var m
var saida := OS.get_environment("FOTO_SAIDA")

func esperar(n: int) -> void:
	for i in n:
		await process_frame

func foto(nome: String) -> void:
	await esperar(6)
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
	print("foto ", nome)

func botao_visivel() -> bool:
	for b in m.hud.botoes:
		if b.acao == "cama":
			return not b.oculto
	return false

func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(60)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	await esperar(10)
	var hp: Vector3 = m.heroi.position
	var C = m.construcao
	C.do_servidor_lote({"lote": "t1", "dono": "Ruiva", "ret": [hp.x - 6, hp.z - 6, hp.x + 6, hp.z + 6], "pecas": [["c1", "cama", hp.x + 1.5, hp.z - 3.0, 0]]})
	C.meu = "t1"
	m.dia.ajustar(14.3)
	await esperar(10)
	print("BOTAO_DIA ", botao_visivel())
	await foto("cama-dia")
	var cam: Camera3D = m.get_viewport().get_camera_3d()
	var tela := cam.unproject_position(Vector3(hp.x + 1.5, m.terreno.altura(hp.x + 1.5, hp.z - 3.0) + 0.45, hp.z - 3.0))
	print("TELA ", tela)
	C.tocou_tela(tela)
	await esperar(30)
	print("TOQUE indo=", C._indo_estacao, " aviso=", m.hud.aviso_txt, " rota=", m.rota.ativo)
	m.dia.ajustar(23.0)
	await esperar(10)
	print("BOTAO_NOITE ", botao_visivel())
	await foto("cama-noite")
	quit()

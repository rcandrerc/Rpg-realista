extends SceneTree
# Fotos da faixa do boss derrotado (para todos) e da janela do loot (só quem ganhou), festa.gd, sem o jogo inteiro.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/loot-boss-foto.gd
class FakeP: # cores como no jogo (client/exportar-godot/mundo.mjs manda texto)
	var dados := {"raridades": [{"cor": "cfc8b8"}, {"cor": "5aa8ff"}, {"cor": "b974ff"}, {"cor": "ffb03a"}, {"cor": "ff5a72"}]}
class FakeM:
	var P = FakeP.new()
	var sons = null
	var cam = null
	var fx = null
	var heroi = null
	var menu = null
	func vibrar(_ms) -> void:
		pass
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome)
func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	var fundo := TextureRect.new()
	var img := Image.load_from_file(OS.get_environment("FUNDO")) if OS.get_environment("FUNDO") != "" else null
	if img:
		fundo.texture = ImageTexture.create_from_image(img)
		fundo.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		fundo.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	fundo.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(fundo)
	var f = load("res://festa.gd").new(FakeM.new())
	root.add_child(f)
	await esperar(5)
	f.anuncio("BOSS DE MUNDO DERROTADO", "Chifre-de-Ferro caiu para Ana, Gael! Volta em umas 4,6 h", "caiu",
		["Ana: Selo Lendário, Espada Raro, Tomo de Golpe Giratório VII", "Gael: Runa Lendária, Botas de Couro Raro"])
	await create_timer(1.2).timeout
	await foto("1-faixa-todos.png")
	f.loot_boss("Chifre-de-Ferro", 0, [{"nome": "Poção de vida", "n": 3, "r": -1}, {"nome": "Espada Raro", "n": 1, "r": 1},
		{"nome": "Selo Lendário", "n": 1, "r": 3}, {"nome": "Runa Mítica", "n": 1, "r": 4}, {"nome": "Tomo de Golpe Giratório VII", "n": 1, "r": -1, "chao": 1}])
	await create_timer(6.6).timeout # entra na fila depois da faixa de todos (3,6 s + 1,2 s por linha)
	await foto("2-janela-loot.png")
	quit()

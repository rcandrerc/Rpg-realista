extends RefCounted
# Ler os pixels de uma textura SEM pedir para a placa de vídeo (André 2026-11-16: no Galaxy Note 10 Lite da filha,
# Mali-G72, a pele do personagem ficava rosa-choque com partes brancas; olhos e boca normais).
# Texture2D.get_image() no celular copia a textura de volta da placa (a cópia de dentro do jogo não existe mais). Nessa
# placa a cópia volta com as cores erradas, e a pele é montada em cima dela: a média da pele (aparencia.gd, tingir a
# pele) e o corpo com fundo de pele (armadura.gd _pele_cheia). Além disso cada leitura da placa para o jogo um quadro
# inteiro (rpg-realista-leitura-placa).
# Aqui a imagem vem direto do arquivo do jogo (.ctex do Godot, que guarda a imagem em PNG ou WebP sem perda): o
# processador abre e pronto, igual em todo celular. Se o arquivo for de outro tipo (textura comprimida para a placa,
# textura feita durante o jogo), volta para o get_image() de sempre.
#
# Formato do .ctex (Godot 4, CompressedTexture2D): "GST2", versão, largura, altura, formato dos dados, limite de mipmap,
# 3 reservados (32 bits cada). Depois a imagem: tipo (1 PNG, 2 WebP), largura e altura (16 bits cada), quantos
# mipmaps, formato da Image e, para cada nível (o maior primeiro), o tamanho em bytes e o arquivo PNG/WebP daquele nível.

const PNG := 1
const WEBP := 2

static var _caminhos := {} # caminho da textura -> caminho do .ctex ("" = não dá para ler pelo arquivo)

# Imagem da textura (descomprimida). menor_lado > 0: devolve o menor nível de mipmap que ainda tem pelo menos esse
# tamanho (para a média de cor basta uma imagem pequena: abre bem mais rápido).
static func ler(tex: Texture2D, menor_lado := 0) -> Image:
	if tex == null:
		return null
	if tex.has_meta("imagem_cpu_fundo"): # textura feita no jogo: [textura de arquivo, cor de fundo] (armadura.gd _pele_cheia)
		var de: Array = tex.get_meta("imagem_cpu_fundo")
		var src := ler(de[0], menor_lado)
		if src == null:
			return null
		src.clear_mipmaps()
		src.convert(Image.FORMAT_RGBA8)
		var c: Color = de[1]
		var fundo := Image.create(src.get_width(), src.get_height(), false, Image.FORMAT_RGBA8)
		fundo.fill(Color(c.r, c.g, c.b, 1.0))
		fundo.blend_rect(src, Rect2i(Vector2i.ZERO, src.get_size()), Vector2i.ZERO)
		return fundo
	var img := _do_arquivo(tex.resource_path, menor_lado)
	if img == null:
		img = tex.get_image()
		if img != null:
			img = img.duplicate()
	if img != null and img.is_compressed():
		img.decompress()
	return img

static func _ctex(caminho: String) -> String:
	if _caminhos.has(caminho):
		return _caminhos[caminho]
	var r := ""
	if caminho != "" and not caminho.contains("::"):
		var cfg := ConfigFile.new()
		if cfg.load(caminho + ".import") == OK:
			var p := str(cfg.get_value("remap", "path", ""))
			if p.ends_with(".ctex"):
				r = p
	_caminhos[caminho] = r
	return r

static func _do_arquivo(caminho: String, menor_lado: int) -> Image:
	var ctex := _ctex(caminho)
	if ctex == "":
		return null
	var f := FileAccess.open(ctex, FileAccess.READ)
	if f == null or f.get_length() < 56:
		return null
	if f.get_buffer(4).get_string_from_ascii() != "GST2":
		return null
	for i in 8: # versão, largura, altura, formato dos dados, limite de mipmap, 3 reservados
		f.get_32()
	var tipo := f.get_32()
	if tipo != PNG and tipo != WEBP:
		return null # dados crus ou comprimidos para a placa: fica com o get_image()
	var w := f.get_16()
	var h := f.get_16()
	var mips := f.get_32()
	f.get_32() # formato da Image
	# escolhe o nível: o menor que ainda tem pelo menos menor_lado
	var nivel := 0
	if menor_lado > 0:
		var lw := w
		var lh := h
		while nivel < mips and mini(lw >> 1, lh >> 1) >= menor_lado:
			lw = maxi(1, lw >> 1)
			lh = maxi(1, lh >> 1)
			nivel += 1
	for i in nivel + 1:
		if f.get_position() + 4 > f.get_length():
			return null
		var tam := f.get_32()
		if tam == 0 or f.get_position() + tam > f.get_length():
			return null
		if i < nivel:
			f.seek(f.get_position() + tam)
			continue
		var buf := f.get_buffer(tam)
		var img := Image.new()
		var erro := img.load_png_from_buffer(buf) if tipo == PNG else img.load_webp_from_buffer(buf)
		return img if erro == OK and not img.is_empty() else null
	return null

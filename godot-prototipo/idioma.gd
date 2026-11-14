extends RefCounted
# Uso: const Idioma = preload("res://idioma.gd") (preload e não class_name: o teste do guia roda sem o cache de classes)
# Idioma do jogo (André 2026-11-14, para divulgar em sites gringos): Português (padrão) ou English, e só esses dois.
# Configurações > Idioma / Language, com a bandeirinha do Brasil e a dos EUA (desenhadas aqui, sem arquivo de fora).
# Sem escolha guardada, o jogo abre em inglês se o celular estiver em inglês; senão em português.
#
# Como funciona: o próprio texto em português é a chave. dados/idioma_en.json tem {"texto em português": "English"}.
# O Godot traduz sozinho Label, Button e LineEdit (placeholder) quando o texto inteiro bate com uma chave; frase montada
# com número ou nome precisa de tr("... %s ...") % [...] no lugar do texto. Faltou tradução: aparece em português
# (nada some). O inglês não é palavra por palavra (André): soa como jogo feito em inglês, curto. Nome próprio fica
# igual, título e parentesco traduzem (Mestre Ivo = Master Ivo, Tio José = Uncle José).
# Não mexe no project.godot (o APK casca não muda): a tradução entra no TranslationServer ao abrir o jogo (main.gd).

const ARQUIVO := "user://config.cfg" # o mesmo do som e dos gráficos (seção "idioma")
const DICIONARIO := "res://dados/idioma_en.json"
const NOMES := {"pt": "Português", "en": "English"}
const LISTA := ["pt", "en"]
const SEPARADORES := ["\n", " · ", "; ", ". ", ": ", ", "]

static var atual := "pt"
static var _traducao: Translation

# chamado no começo do main.gd: carrega o inglês e põe o idioma guardado (ou o do celular)
static func iniciar() -> void:
	if _traducao == null:
		_traducao = Translation.new()
		_traducao.locale = "en"
		var txt := FileAccess.get_file_as_string(DICIONARIO)
		var d = JSON.parse_string(txt) if txt != "" else null
		if d is Dictionary:
			for k in d:
				var pt := str(k)
				var en := str(d[k])
				if en == "" or pt.begins_with("_"): # "_nota": comentário do arquivo
					continue
				_traducao.add_message(pt, en) # tr("Nível %d") % n também acha
				if pt.contains("{1}"):
					_modelo(pt, en)
				elif _formato.search(pt) != null: # "Nível %d" vira o modelo "Nível {1}" para a frase já montada
					_modelo(_numerar(pt), en if en.contains("{1}") else _numerar(en))
			_modelos.sort_custom(func(a, b): return a[2].get_pattern().length() > b[2].get_pattern().length())
	var cfg := ConfigFile.new()
	cfg.load(ARQUIVO)
	var guardado := str(cfg.get_value("idioma", "codigo", ""))
	_aplicar(guardado if guardado in LISTA else do_celular())

static func do_celular() -> String:
	return "en" if OS.get_locale_language() == "en" else "pt"

# troca na hora (os textos fixos mudam sozinhos; as janelas abertas se montam de novo) e guarda neste aparelho
static func trocar(codigo: String) -> void:
	if not codigo in LISTA:
		return
	_aplicar(codigo)
	var cfg := ConfigFile.new()
	cfg.load(ARQUIVO)
	cfg.set_value("idioma", "codigo", codigo)
	cfg.save(ARQUIVO)

static func ingles() -> bool:
	return atual == "en"

# Em Português a tradução sai do TranslationServer: o idioma de reserva do Godot é o inglês, e com ela lá os textos
# em português virariam inglês mesmo com o jogo em Português.
static func _aplicar(codigo: String) -> void:
	atual = codigo
	_cache.clear()
	if codigo == "en":
		if not TranslationServer.get_translation_object("en"):
			TranslationServer.add_translation(_traducao)
	else:
		TranslationServer.remove_translation(_traducao)
	TranslationServer.set_locale("en" if codigo == "en" else "pt_BR")

# para quem não é Node (função estática): mesma coisa que tr()
static func t(texto: String) -> String:
	return TranslationServer.translate(texto) if atual == "en" else texto

# frase montada (aviso do servidor, faixa de nível, nome com número): primeiro a frase inteira; senão os modelos do
# dicionário com {1}, {2}... ("Missão cumprida: {1}" = "Quest complete: {1}"); o pedaço que entra no {n} também é
# traduzido (nome de item, de missão). Sem modelo, fica como veio.
static var _modelos: Array = [] # [começo, fim, RegEx, inglês com {n}, várias linhas]
static var _formato := RegEx.create_from_string("%[-+0-9.]*[sdf]")

# "%s · Nv %d" vira "{1} · Nv {2}" (e "%%" vira "%")
static func _numerar(t: String) -> String:
	var r := ""
	var n := 0
	var i := 0
	while i < t.length():
		if t[i] == "%" and i + 1 < t.length() and t[i + 1] == "%":
			r += "%"
			i += 2
			continue
		var a := _formato.search(t, i)
		if a != null and a.get_start() == i:
			n += 1
			r += "{%d}" % n
			i = a.get_end()
			continue
		r += t[i]
		i += 1
	return r
static var _cache := {}

static func frase(texto: String) -> String:
	if atual != "en" or texto == "":
		return texto
	if _cache.has(texto):
		return _cache[texto]
	var r := _frase(texto, 0)
	if _cache.size() > 600:
		_cache.clear()
	_cache[texto] = r
	return r

static func _frase(texto: String, fundo: int) -> String:
	var direto := TranslationServer.translate(texto)
	if direto != texto or fundo > 6 or texto.is_valid_float():
		return direto
	var varias := texto.contains("\n")
	var r := _por_modelo(texto, fundo, true) if varias else _por_modelo(texto, fundo, false)
	if r != "":
		return r
	# texto montado aos pedaços (aviso + "Atenção: ...", "Dano 120% · Alcance 3 m", "Perdeu 5 de ouro. O equipamento
	# desgastou"): cada pedaço por si, do separador mais forte para o mais fraco
	for sep in SEPARADORES:
		if not texto.contains(sep):
			continue
		var partes := texto.split(sep)
		var mudou := false
		for i in partes.size():
			var en := _frase(partes[i], fundo + 1)
			mudou = mudou or en != partes[i]
			partes[i] = en
		if mudou:
			return sep.join(partes)
	return texto

# modelos de uma linha não pegam texto de várias (um "{1} e {2}" engoliria o aviso inteiro); "" = nenhum serviu
static func _por_modelo(texto: String, fundo: int, varias: bool) -> String:
	for md in _modelos:
		if md[4] != varias or not texto.begins_with(md[0]) or not texto.ends_with(md[1]):
			continue
		var achou: RegExMatch = md[2].search(texto)
		if achou == null:
			continue
		var r: String = md[3]
		for i in range(1, achou.get_group_count() + 1):
			r = r.replace("{%d}" % i, _frase(achou.get_string(i), fundo + 1))
		return r
	return ""

static func _modelo(pt: String, en: String) -> void:
	var rx := ("(?s)^" if pt.contains("\n") else "^")
	var resto := pt
	var comeco := ""
	var primeiro := true
	while true:
		var i := resto.find("{")
		var j := resto.find("}", i)
		if i < 0 or j < 0 or not resto.substr(i + 1, j - i - 1).is_valid_int():
			break
		if primeiro:
			comeco = resto.substr(0, i)
			primeiro = false
		rx += _escapar(resto.substr(0, i)) + "(.*?)"
		resto = resto.substr(j + 1)
	rx += _escapar(resto) + "$"
	var re := RegEx.new()
	if re.compile(rx) == OK:
		_modelos.append([comeco, resto, re, en, pt.contains("\n")])

static func _escapar(t: String) -> String:
	var r := ""
	for ch in t:
		r += ("\\" + ch) if ch in ".^$*+?()[]{}|\\/" else ch
	return r

# bandeirinha desenhada (sem imagem de fora): "pt" = Brasil, "en" = Estados Unidos
static func bandeira(codigo: String, tamanho := Vector2(36, 25)) -> Control:
	var c := Control.new()
	c.custom_minimum_size = tamanho
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.draw.connect(func(): _desenhar(c, codigo))
	return c

static func _desenhar(c: Control, codigo: String) -> void:
	var s := c.size
	if codigo == "en":
		var faixa := s.y / 13.0
		for i in 13:
			c.draw_rect(Rect2(0, i * faixa, s.x, faixa + 0.5), Color(0.70, 0.13, 0.20) if i % 2 == 0 else Color.WHITE)
		var canto := Vector2(s.x * 0.4, faixa * 7.0)
		c.draw_rect(Rect2(Vector2.ZERO, canto), Color(0.24, 0.23, 0.43))
		for lin in 5: # estrelinhas em pontos (no tamanho de botão não dá para ver as 50)
			for col in 6:
				var p := Vector2((col + 0.5 + (0.5 if lin % 2 else 0.0)) * canto.x / 6.5, (lin + 0.6) * canto.y / 5.2)
				c.draw_circle(p, maxf(0.7, s.y * 0.03), Color.WHITE)
	else:
		c.draw_rect(Rect2(Vector2.ZERO, s), Color(0.0, 0.61, 0.23))
		var m := s * 0.5
		var dx := s.x * 0.42
		var dy := s.y * 0.38
		c.draw_colored_polygon(PackedVector2Array([m + Vector2(-dx, 0), m + Vector2(0, -dy), m + Vector2(dx, 0), m + Vector2(0, dy)]), Color(1.0, 0.87, 0.0))
		var r := s.y * 0.25
		c.draw_circle(m, r, Color(0.0, 0.15, 0.46))
		var faixa := PackedVector2Array() # a faixa branca: arco que só vale dentro do globo
		var cen := m + Vector2(-r * 0.3, r * 1.9)
		for i in 41:
			var a := deg_to_rad(lerpf(-140.0, -40.0, i / 40.0))
			var p := cen + Vector2(cos(a), sin(a)) * r * 2.1
			if p.distance_to(m) < r * 0.96:
				faixa.append(p)
		if faixa.size() > 1:
			c.draw_polyline(faixa, Color.WHITE, maxf(1.0, s.y * 0.06))
	c.draw_rect(Rect2(Vector2.ZERO, s), Color(0, 0, 0, 0.45), false, 1.0)

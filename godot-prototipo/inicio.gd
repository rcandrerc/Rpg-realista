extends Control
# Abertura do app: confere se tem atualização do jogo, baixa e carrega antes de abrir a vila (main.tscn).
#
# O APK é a "casca": traz o jogo inteiro de uma versão base. Cada push na main gera um pacote .pck só com o que mudou
# desde essa base (ferramentas/atualizacao/LEIAME.md) e publica no site do GitHub Pages, junto com manifesto.json.
# Aqui: lê o manifesto, baixa o pacote se for mais novo (com barra), confere o sha256 e carrega por cima dos arquivos
# do APK (ProjectSettings.load_resource_pack). Sem internet, abre o último pacote baixado ou a versão do próprio APK.
#
# APK casca (aethra/atualizacao/casca = true, preset "Android casca"): o APK não traz o jogo. Na primeira abertura baixa
# o jogo inteiro (completo, em partes) e depois só as mudanças (deltas), tudo descrito em conteudo.json. Ver _casca_*.
#
# Cuidado: este arquivo NÃO carrega nada do jogo (scripts, cenas) antes do pacote, senão a versão velha fica no cache.
# Mudanças neste arquivo e no project.godot só chegam com APK novo.

const MANIFESTO := "https://rcandrerc.github.io/Rpg-realista/atualizacao/manifesto.json"
const PASTA := "user://atualizacao/"
const PACOTE := PASTA + "pacote.pck"
const BAIXANDO := PASTA + "baixando.pck"
const ESTADO := PASTA + "estado.cfg"
const CENA_JOGO := "res://main.tscn"
const ESPERA_MANIFESTO := 6.0 # segundos: sem resposta, entra com o que já tem

# ---- APK casca ----
const CONTEUDO_JSON := "https://rcandrerc.github.io/Rpg-realista/atualizacao/conteudo.json"
const PASTA_CONTEUDO := "user://conteudo/"
const COMPLETO := PASTA_CONTEUDO + "completo.pck"
const COMPLETO_TMP := PASTA_CONTEUDO + "completo.tmp"
const PARTE_TMP := PASTA_CONTEUDO + "parte.tmp"
const ESTADO_CONTEUDO := PASTA_CONTEUDO + "estado.cfg"

const OURO := Color(0.95, 0.80, 0.45)
const TEXTO := Color(0.96, 0.93, 0.86)

var url_manifesto := MANIFESTO
var base := "" # versão base do APK (gravada pelo CI no project.godot na hora de exportar)
var http: HTTPRequest
var manifesto := {}
var barra: ProgressBar
var aviso: Label
var detalhe: Label
var pular: Button
var baixando := false
var saindo := false
var casca := false
var url_conteudo := CONTEUDO_JSON
var conteudo := {} # conteudo.json: {"versao", "completo": {"id", "tamanho", "partes": [{"arq", "tamanho", "sha256"}]}, "deltas": [{"versao", "arq", "tamanho", "sha256"}]}
var feito_bytes := 0 # já baixado nesta abertura (barra soma todos os arquivos)
var total_bytes := 0
var tentar: Button

func _ready() -> void:
	base = str(ProjectSettings.get_setting("aethra/atualizacao/base", ""))
	casca = bool(ProjectSettings.get_setting("aethra/atualizacao/casca", false))
	_montar_tela()
	if casca:
		if OS.get_environment("RPG_CONTEUDO") != "": # testes: outro endereço
			url_conteudo = OS.get_environment("RPG_CONTEUDO")
		DirAccess.make_dir_recursive_absolute(PASTA_CONTEUDO)
		_casca_iniciar()
		return
	DirAccess.make_dir_recursive_absolute(PASTA)
	if OS.get_environment("RPG_ATUALIZACAO") != "": # testes: outro endereço
		url_manifesto = OS.get_environment("RPG_ATUALIZACAO")
	if base == "":
		# build feito à mão / editor: não tem base para comparar, joga a versão do próprio projeto
		_entrar("")
		return
	_texto("Procurando atualização…", "versão %s" % _versao_local())
	http = HTTPRequest.new()
	http.use_threads = true
	http.timeout = ESPERA_MANIFESTO
	add_child(http)
	http.request_completed.connect(_manifesto_chegou)
	var cache := "?t=%d" % Time.get_unix_time_from_system() # o Pages guarda cópia por 10 min
	if http.request(url_manifesto + cache) != OK:
		_sem_internet()

func _process(_d: float) -> void:
	if casca:
		if baixando and http and total_bytes > 0:
			var agora := feito_bytes + http.get_downloaded_bytes()
			barra.value = 100.0 * agora / total_bytes
			detalhe.text = "%s de %s" % [_mb(agora), _mb(total_bytes)]
		return
	if baixando and http:
		var total := http.get_body_size()
		var feito := http.get_downloaded_bytes()
		if total > 0:
			barra.value = 100.0 * feito / total
			detalhe.text = "%s de %s" % [_mb(feito), _mb(total)]
		else:
			detalhe.text = _mb(feito)

func _manifesto_chegou(resultado: int, codigo: int, _h: PackedStringArray, corpo: PackedByteArray) -> void:
	if resultado != HTTPRequest.RESULT_SUCCESS or codigo != 200:
		_sem_internet()
		return
	var m = JSON.parse_string(corpo.get_string_from_utf8())
	if typeof(m) != TYPE_DICTIONARY:
		_sem_internet()
		return
	manifesto = m
	if str(m.get("base", "")) != base or str(m.get("pacote", "")) == "":
		# o pacote no ar é para outro APK (ou não tem pacote): fica com o que o APK traz
		if str(m.get("base", "")) != base and int(str(m.get("base", "0"))) > int(base):
			_texto("Tem um APK novo do jogo", "Baixe o APK mais recente para receber as próximas atualizações.")
			await get_tree().create_timer(2.5).timeout
		_entrar("")
		return
	var est := _estado()
	if est.get_value("pacote", "base", "") == base and est.get_value("pacote", "sha256", "") == str(m.get("sha256", "")) and FileAccess.file_exists(PACOTE):
		_entrar(PACOTE) # já está em dia
		return
	_baixar()

func _baixar() -> void:
	baixando = true
	barra.visible = true
	barra.value = 0
	pular.visible = true
	_texto("Baixando atualização…", "")
	if FileAccess.file_exists(BAIXANDO):
		DirAccess.remove_absolute(BAIXANDO)
	# outro HTTPRequest: o do manifesto ainda está fechando dentro do próprio sinal
	http.queue_free()
	http = HTTPRequest.new()
	http.use_threads = true
	http.timeout = 0.0 # o download pode levar minutos no 4G
	http.download_file = BAIXANDO
	add_child(http)
	http.request_completed.connect(_pacote_chegou)
	var url := str(manifesto.get("url", ""))
	if url == "":
		url = url_manifesto.get_base_dir() + "/" + str(manifesto.get("pacote", ""))
	if http.request(url) != OK:
		_falhou()

func _pacote_chegou(resultado: int, codigo: int, _h: PackedStringArray, _c: PackedByteArray) -> void:
	baixando = false
	if saindo:
		return
	if resultado != HTTPRequest.RESULT_SUCCESS or codigo != 200:
		_falhou()
		return
	barra.value = 100
	_texto("Conferindo…", "")
	await get_tree().process_frame
	var sha := FileAccess.get_sha256(BAIXANDO)
	if sha != str(manifesto.get("sha256", "")):
		DirAccess.remove_absolute(BAIXANDO)
		_falhou()
		return
	if FileAccess.file_exists(PACOTE):
		DirAccess.remove_absolute(PACOTE)
	DirAccess.rename_absolute(BAIXANDO, PACOTE)
	var est := ConfigFile.new()
	est.set_value("pacote", "base", base)
	est.set_value("pacote", "versao", str(manifesto.get("versao", "")))
	est.set_value("pacote", "sha256", sha)
	est.save(ESTADO)
	_texto("Atualizado!", "versão %s" % str(manifesto.get("versao", "")))
	_entrar(PACOTE)

func _falhou() -> void:
	_texto("Não deu para baixar agora", "Abrindo a versão que já está no celular.")
	await get_tree().create_timer(1.5).timeout
	_entrar(_pacote_valido())

func _sem_internet() -> void:
	_entrar(_pacote_valido())

# último pacote baixado, se é desta base do APK
func _pacote_valido() -> String:
	var est := _estado()
	if est.get_value("pacote", "base", "") == base and FileAccess.file_exists(PACOTE):
		return PACOTE
	return ""

func _estado() -> ConfigFile:
	var est := ConfigFile.new()
	est.load(ESTADO)
	return est

func _versao_local() -> String:
	var est := _estado()
	if est.get_value("pacote", "base", "") == base and FileAccess.file_exists(PACOTE):
		return str(est.get_value("pacote", "versao", base))
	return base

func _entrar(pacote: String) -> void:
	if saindo:
		return
	saindo = true
	print("[atualização] base ", base, ", pacote: ", pacote if pacote != "" else "nenhum (versão do APK)")
	if http:
		http.cancel_request()
	if pacote != "" and not ProjectSettings.load_resource_pack(pacote, true):
		push_warning("Pacote de atualização não carregou: abrindo a versão do APK")
		DirAccess.remove_absolute(pacote)
	await get_tree().process_frame
	get_tree().change_scene_to_file(CENA_JOGO)

func _pular() -> void:
	if casca:
		_casca_entrar()
		return
	_entrar(_pacote_valido())


# ================= APK casca: o jogo inteiro vem pela internet =================
func _casca_iniciar() -> void:
	saindo = false
	if tentar:
		tentar.visible = false
	barra.visible = false
	_texto("Procurando atualização…", "")
	var r = await _casca_pedir(url_conteudo + "?t=%d" % Time.get_unix_time_from_system(), "", 8.0)
	if r == null:
		_casca_sem_internet()
		return
	var m = JSON.parse_string((r as PackedByteArray).get_string_from_utf8())
	if typeof(m) != TYPE_DICTIONARY or not m.has("completo"):
		_casca_sem_internet()
		return
	conteudo = m
	var est := _casca_estado()
	var comp: Dictionary = m.completo
	var deltas: Array = m.get("deltas", [])
	var tem_completo := str(est.get_value("c", "completo", "")) == str(comp.id) and FileAccess.file_exists(COMPLETO)
	var aplicados: Array = est.get_value("c", "deltas", []) if tem_completo else []
	# os deltas são uma corrente: o que está no celular tem que ser o começo da lista do servidor
	var faltam: Array = []
	for i in deltas.size():
		if i < aplicados.size() and str(aplicados[i]) == str(deltas[i].versao) and FileAccess.file_exists(_casca_delta(deltas[i])):
			continue
		faltam = deltas.slice(i)
		aplicados = aplicados.slice(0, i)
		break
	total_bytes = 0
	feito_bytes = 0
	if not tem_completo:
		var feitas := int(est.get_value("c", "partes_ok", 0)) if str(est.get_value("c", "baixando", "")) == str(comp.id) else 0
		for i in range(feitas, comp.partes.size()):
			total_bytes += int(comp.partes[i].tamanho)
	for d in faltam:
		total_bytes += int(d.tamanho)
	if total_bytes > 0:
		baixando = true
		barra.visible = true
		pular.visible = tem_completo
		_texto("Baixando o jogo (primeira vez)…" if not tem_completo else "Baixando atualização…", "")
	if not tem_completo and not await _casca_baixar_completo(comp, est):
		_casca_falhou()
		return
	for d in faltam:
		if saindo:
			return
		if not await _casca_baixar(_casca_url_base() + str(d.arq), _casca_delta(d), str(d.sha256)):
			_casca_falhou()
			return
		feito_bytes += int(d.tamanho)
		aplicados.append(str(d.versao))
		est.set_value("c", "deltas", aplicados)
		est.save(ESTADO_CONTEUDO)
	baixando = false
	if saindo:
		return
	_limpar_deltas_velhos(aplicados)
	_texto("Abrindo…", "versão %s" % str(m.get("versao", "")))
	_casca_entrar()

# completo em partes: baixa uma, confere, junta no completo.tmp e apaga (cabe em celular com pouco espaço)
func _casca_baixar_completo(comp: Dictionary, est: ConfigFile) -> bool:
	if str(est.get_value("c", "baixando", "")) != str(comp.id):
		est.set_value("c", "baixando", str(comp.id))
		est.set_value("c", "partes_ok", 0)
		est.set_value("c", "deltas", [])
		est.save(ESTADO_CONTEUDO)
		if FileAccess.file_exists(COMPLETO_TMP):
			DirAccess.remove_absolute(COMPLETO_TMP)
	var feitas := int(est.get_value("c", "partes_ok", 0))
	# o completo.tmp tem que ter exatamente as partes já juntadas; senão recomeça
	var esperado := 0
	for i in feitas:
		esperado += int(comp.partes[i].tamanho)
	var atual := FileAccess.open(COMPLETO_TMP, FileAccess.READ)
	var tam_atual := atual.get_length() if atual else 0
	atual = null
	if tam_atual != esperado:
		feitas = 0
		if FileAccess.file_exists(COMPLETO_TMP):
			DirAccess.remove_absolute(COMPLETO_TMP)
	for i in range(feitas, comp.partes.size()):
		if saindo:
			return false
		var p: Dictionary = comp.partes[i]
		if not await _casca_baixar(_casca_url_base() + str(p.arq), PARTE_TMP, str(p.sha256)):
			return false
		var saida := FileAccess.open(COMPLETO_TMP, FileAccess.READ_WRITE if FileAccess.file_exists(COMPLETO_TMP) else FileAccess.WRITE)
		var entrada := FileAccess.open(PARTE_TMP, FileAccess.READ)
		if saida == null or entrada == null:
			return false
		saida.seek_end()
		while entrada.get_position() < entrada.get_length():
			saida.store_buffer(entrada.get_buffer(4 * 1024 * 1024))
		saida = null
		entrada = null
		DirAccess.remove_absolute(PARTE_TMP)
		feito_bytes += int(p.tamanho)
		est.set_value("c", "partes_ok", i + 1)
		est.save(ESTADO_CONTEUDO)
	if FileAccess.file_exists(COMPLETO):
		DirAccess.remove_absolute(COMPLETO)
	DirAccess.rename_absolute(COMPLETO_TMP, COMPLETO)
	est.set_value("c", "completo", str(comp.id))
	est.set_value("c", "baixando", "")
	est.set_value("c", "deltas", [])
	est.save(ESTADO_CONTEUDO)
	return true

# baixa um arquivo para destino e confere o sha256
func _casca_baixar(url: String, destino: String, sha: String) -> bool:
	if FileAccess.file_exists(destino):
		DirAccess.remove_absolute(destino)
	var r = await _casca_pedir(url, destino, 0.0)
	if r == null:
		return false
	if sha != "" and FileAccess.get_sha256(destino) != sha:
		DirAccess.remove_absolute(destino)
		return false
	return true

# um pedido HTTP; devolve o corpo (ou PackedByteArray vazio se foi para arquivo) ou null se falhou
func _casca_pedir(url: String, arquivo: String, espera: float):
	if http:
		http.queue_free()
	http = HTTPRequest.new()
	http.use_threads = true
	http.timeout = espera
	http.download_file = arquivo
	add_child(http)
	if http.request(url) != OK:
		return null
	var res: Array = await http.request_completed
	if res[0] != HTTPRequest.RESULT_SUCCESS or res[1] != 200:
		return null
	return res[3]

# onde ficam os arquivos: "url_base" do conteudo.json (ex.: balde da Oracle) ou a mesma pasta do conteudo.json
func _casca_url_base() -> String:
	var u := str(conteudo.get("url_base", ""))
	if u == "":
		u = url_conteudo.get_base_dir()
	return u if u.ends_with("/") else u + "/"

func _casca_delta(d: Dictionary) -> String:
	return PASTA_CONTEUDO + "delta-%s.pck" % str(d.versao)

# apaga deltas que não estão mais na corrente (o servidor juntou tudo num completo novo)
func _limpar_deltas_velhos(aplicados: Array) -> void:
	var dir := DirAccess.open(PASTA_CONTEUDO)
	if dir == null:
		return
	for f in dir.get_files():
		if f.begins_with("delta-") and f.ends_with(".pck") and not aplicados.has(f.trim_prefix("delta-").trim_suffix(".pck")):
			DirAccess.remove_absolute(PASTA_CONTEUDO + f)

func _casca_estado() -> ConfigFile:
	var est := ConfigFile.new()
	est.load(ESTADO_CONTEUDO)
	return est

func _casca_falhou() -> void:
	baixando = false
	if saindo:
		return
	if _casca_tem_jogo():
		_texto("Não deu para baixar agora", "Abrindo a versão que já está no celular.")
		await get_tree().create_timer(1.5).timeout
		_casca_entrar()
	else:
		_texto("Não deu para baixar o jogo", "Confira a internet e toque em Tentar de novo.")
		barra.visible = false
		tentar.visible = true

func _casca_sem_internet() -> void:
	if _casca_tem_jogo():
		_casca_entrar()
	else:
		_texto("Sem internet", "Na primeira vez o jogo precisa ser baixado. Conecte e toque em Tentar de novo.")
		tentar.visible = true

func _casca_tem_jogo() -> bool:
	var est := _casca_estado()
	return str(est.get_value("c", "completo", "")) != "" and FileAccess.file_exists(COMPLETO)

# carrega o completo e os deltas na ordem (cada um por cima do anterior) e abre o jogo
func _casca_entrar() -> void:
	if saindo:
		return
	saindo = true
	baixando = false
	if http:
		http.cancel_request()
	var est := _casca_estado()
	var ok := ProjectSettings.load_resource_pack(COMPLETO, true)
	for v in est.get_value("c", "deltas", []):
		var f := PASTA_CONTEUDO + "delta-%s.pck" % str(v)
		if ok and FileAccess.file_exists(f):
			ok = ProjectSettings.load_resource_pack(f, true)
	print("[atualização] casca: completo ", est.get_value("c", "completo", ""), ", deltas ", est.get_value("c", "deltas", []), ", ok ", ok)
	if not ok or not ResourceLoader.exists(CENA_JOGO):
		# pacote estragado: apaga e baixa de novo
		est.set_value("c", "completo", "")
		est.save(ESTADO_CONTEUDO)
		DirAccess.remove_absolute(COMPLETO)
		_texto("O jogo baixado veio com defeito", "Toque em Tentar de novo para baixar outra vez.")
		saindo = false
		tentar.visible = true
		return
	await get_tree().process_frame
	get_tree().change_scene_to_file(CENA_JOGO)

# ---------- tela ----------
func _montar_tela() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	var fundo := ColorRect.new()
	fundo.color = Color(0.05, 0.06, 0.09)
	fundo.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(fundo)
	# capa sem cache: se o pacote trouxer outra capa, o jogo usa a nova
	var tex = ResourceLoader.load("res://ui/capa_aethra.jpg", "", ResourceLoader.CACHE_MODE_IGNORE)
	if tex is Texture2D:
		var capa := TextureRect.new()
		capa.texture = tex
		capa.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		capa.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
		capa.set_anchors_preset(Control.PRESET_FULL_RECT)
		add_child(capa)
	var sombra := ColorRect.new()
	sombra.color = Color(0, 0, 0, 0.45)
	sombra.anchor_left = 0
	sombra.anchor_right = 1
	sombra.anchor_top = 0.72
	sombra.anchor_bottom = 1
	add_child(sombra)
	var caixa := VBoxContainer.new()
	caixa.anchor_left = 0.25
	caixa.anchor_right = 0.75
	caixa.anchor_top = 0.76
	caixa.anchor_bottom = 0.97
	caixa.alignment = BoxContainer.ALIGNMENT_CENTER
	caixa.add_theme_constant_override("separation", 6)
	add_child(caixa)
	aviso = _rotulo(22, TEXTO)
	caixa.add_child(aviso)
	barra = ProgressBar.new()
	barra.custom_minimum_size = Vector2(0, 14)
	barra.show_percentage = false
	barra.visible = false
	var trilho := StyleBoxFlat.new()
	trilho.bg_color = Color(0, 0, 0, 0.6)
	trilho.border_color = Color(OURO, 0.6)
	trilho.set_border_width_all(1)
	trilho.set_corner_radius_all(7)
	var cheio := StyleBoxFlat.new()
	cheio.bg_color = OURO
	cheio.set_corner_radius_all(7)
	barra.add_theme_stylebox_override("background", trilho)
	barra.add_theme_stylebox_override("fill", cheio)
	caixa.add_child(barra)
	detalhe = _rotulo(15, Color(TEXTO, 0.75))
	caixa.add_child(detalhe)
	pular = Button.new()
	pular.text = "Jogar sem atualizar"
	pular.flat = true
	pular.visible = false
	pular.add_theme_color_override("font_color", Color(TEXTO, 0.7))
	pular.add_theme_font_size_override("font_size", 14)
	pular.pressed.connect(_pular)
	pular.anchor_left = 1
	pular.anchor_right = 1
	pular.anchor_top = 1
	pular.anchor_bottom = 1
	pular.offset_left = -200
	pular.offset_top = -44
	pular.offset_right = -16
	pular.offset_bottom = -12
	add_child(pular)
	tentar = Button.new()
	tentar.text = "Tentar de novo"
	tentar.visible = false
	tentar.add_theme_font_size_override("font_size", 18)
	tentar.custom_minimum_size = Vector2(220, 44)
	tentar.pressed.connect(_casca_iniciar)
	caixa.add_child(tentar)

func _rotulo(tam: int, cor: Color) -> Label:
	var l := Label.new()
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.add_theme_font_size_override("font_size", tam)
	l.add_theme_color_override("font_color", cor)
	l.add_theme_color_override("font_shadow_color", Color(0, 0, 0, 0.8))
	l.add_theme_constant_override("shadow_offset_x", 1)
	l.add_theme_constant_override("shadow_offset_y", 2)
	return l

func _texto(a: String, b: String) -> void:
	print("[atualização] ", a, " ", b) # aparece no logcat
	aviso.text = a
	detalhe.text = b

static func _mb(bytes: int) -> String:
	return "%.1f MB" % (bytes / 1048576.0)

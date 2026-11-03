extends Control
# Abertura do app: confere se tem atualização do jogo, baixa e carrega antes de abrir a vila (main.tscn).
#
# O APK é a "casca": traz o jogo inteiro de uma versão base. Cada push na main gera um pacote .pck só com o que mudou
# desde essa base (ferramentas/atualizacao/LEIAME.md) e publica no site do GitHub Pages, junto com manifesto.json.
# Aqui: lê o manifesto, baixa o pacote se for mais novo (com barra), confere o sha256 e carrega por cima dos arquivos
# do APK (ProjectSettings.load_resource_pack). Sem internet, abre o último pacote baixado ou a versão do próprio APK.
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

func _ready() -> void:
	base = str(ProjectSettings.get_setting("aethra/atualizacao/base", ""))
	_montar_tela()
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
	_entrar(_pacote_valido())

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

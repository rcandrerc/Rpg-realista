extends Node
# Cardápio do app no balde da Oracle, sem APK novo (André 2026-11-18: "o jogo não pode depender do GitHub";
# não quer reinstalar o app nele nem no celular da filha).
# O APK 4.7 lê ao abrir o user://motor.cfg por cima do project.godot (application/config/project_settings_override),
# e o inicio.gd do APK usa aethra/atualizacao/pc_conteudo como endereço do cardápio quando existe (com pc_id 0 o modo
# PC fica desligado). Então o jogo grava ali o cardápio do balde, e da próxima abertura em diante o app pergunta ao
# balde. O CI copia o cardápio para o balde antes do Pages (ferramentas/atualizacao/espelhar-balde.sh).
# Segurança: só grava se o cardápio do balde está em dia (versão >= a do Pages). Se o balde ficar para trás ou sumir,
# apaga o endereço e o app volta a ler do Pages na abertura seguinte.

const MOTOR := "user://motor.cfg"
const CHAVE := "atualizacao/pc_conteudo"
const PAGES := "https://rcandrerc.github.io/Rpg-realista/atualizacao/"
const BALDE := "https://objectstorage.sa-saopaulo-1.oraclecloud.com/n/gri0v6lf72rz/b/Aethra-jofo/o/"
const ESPERA := 10.0

static func vale_aqui() -> bool:
	if str(ProjectSettings.get_setting("application/config/project_settings_override", "")) != MOTOR:
		return false # APK sem o motor.cfg: não leria o endereço
	if not bool(ProjectSettings.get_setting("aethra/atualizacao/casca", false)):
		return false # só o APK casca lê o cardápio (o APK cheio usa o manifesto)
	if int(ProjectSettings.get_setting("aethra/atualizacao/pc_id", 0)) > 0:
		return false # versão PC já tem o seu (conteudo-pc.json)
	return OS.get_name() == "Android"

static func nome_cardapio() -> String:
	var v := Engine.get_version_info()
	return "conteudo-%d.%d.json" % [int(v.major), int(v.minor)]

# decide o que gravar: "" = apagar o endereço; senão o endereço do balde
static func decidir(balde: Dictionary, pages: Dictionary) -> String:
	if balde.is_empty() or str(balde.get("url_base", "")) != BALDE:
		return ""
	if pages.is_empty():
		return BALDE + nome_cardapio() # Pages fora do ar: o balde manda
	return BALDE + nome_cardapio() if int(str(balde.get("versao", "0"))) >= int(str(pages.get("versao", "0"))) else ""

func _ready() -> void:
	if not vale_aqui():
		queue_free()
		return
	var t := "?t=%d" % Time.get_unix_time_from_system()
	var balde := await _pedir(BALDE + nome_cardapio() + t)
	var pages := await _pedir(PAGES + nome_cardapio() + t)
	if balde.is_empty() and pages.is_empty():
		queue_free() # sem internet: não mexe em nada
		return
	_gravar(decidir(balde, pages))
	queue_free()

func _gravar(endereco: String) -> void:
	var cfg := ConfigFile.new()
	cfg.load(MOTOR)
	var antes := str(cfg.get_value("aethra", CHAVE, ""))
	if antes == endereco:
		return
	if endereco == "":
		if cfg.has_section_key("aethra", CHAVE):
			cfg.erase_section_key("aethra", CHAVE)
	else:
		cfg.set_value("aethra", CHAVE, endereco)
	cfg.save(MOTOR)
	print("Cardápio do app: ", endereco if endereco != "" else "Pages")

func _pedir(url: String) -> Dictionary:
	var http := HTTPRequest.new()
	http.timeout = ESPERA
	add_child(http)
	if http.request(url) != OK:
		http.queue_free()
		return {}
	var r: Array = await http.request_completed
	http.queue_free()
	if int(r[0]) != HTTPRequest.RESULT_SUCCESS or int(r[1]) != 200:
		return {}
	var j = JSON.parse_string((r[3] as PackedByteArray).get_string_from_utf8())
	return j if j is Dictionary else {}

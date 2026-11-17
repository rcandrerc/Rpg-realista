extends RefCounted
# Voltar do segundo plano (André 2026-11-17: "só de pôr em segundo plano, quando volta pesquisa atualização, depois mais
# tempo para conectar"). Registros da entrada de 2026-11-16/17: a cada 1 a 5 min de jogo vinha uma abertura nova inteira
# (o Android fecha o app no fundo: ~2,5 GB de memória de vídeo) e o preparo dos efeitos atrás da capa levava ~14 s em
# TODA abertura, mesmo já tendo aberto antes.
#
# O que fica aqui:
# - preparo da placa entre aberturas: o Godot guarda os pipelines montados pela placa (user://vulkan/pipelines.*.cache)
#   só a cada 3 MB novos ou ao fechar o app do jeito certo. O Android mata o app no fundo (nunca fecha do jeito certo),
#   então o fim do preparo nunca era guardado e a placa montava tudo de novo na abertura seguinte. Agora guarda a cada
#   PSO_SALVAR_MB (numa linha de fundo do motor).
# - registro: tamanho desse arquivo na abertura (pso0) e na entrada (pso1), por que o Android fechou o app da última vez
#   (saida) e quanto da memória de vídeo é textura e quanto é malha (vtex/vbuf), para /lentidao tipo "entrada".

const PSO_SALVAR_MB := 0.5
const PSO_DIR := "user://vulkan"

static var pso0 := -1 # KB do arquivo de pipelines no começo do main (antes de montar qualquer coisa nesta abertura)

static func ajustar() -> void:
	ProjectSettings.set_setting("rendering/rendering_device/pipeline_cache/save_chunk_size_mb", PSO_SALVAR_MB)
	pso0 = pso_kb()

# KB somados dos arquivos de pipelines guardados (0 = nada guardado; -1 = sem a pasta, desenho sem Vulkan)
static func pso_kb() -> int:
	var d := DirAccess.open(PSO_DIR)
	if d == null:
		return -1
	var t := 0
	for f in d.get_files():
		if f.begins_with("pipelines.") and f.ends_with(".cache"):
			var a := FileAccess.open(PSO_DIR.path_join(f), FileAccess.READ)
			if a:
				t += a.get_length()
	return t / 1024

# Por que o Android fechou este app da última vez (Android 11 em diante, ApplicationExitInfo): motivo (3 = pouca memória,
# 10/11 = o jogador fechou, 1 = o jogo saiu sozinho, 13 = outro, 2 = sinal do sistema), importância na hora (400 = no fundo,
# 100 = na tela, 125 = serviço na frente), memória que ele usava (MB) e há quantos minutos foi. {} quando não dá para ler.
static var _saida_lida := false
static func saida_anterior() -> Dictionary:
	if _saida_lida or OS.get_name() != "Android" or not Engine.has_singleton("AndroidRuntime"):
		return {}
	_saida_lida = true # uma leitura por abertura: um erro aqui nunca se repete
	var ver := OS.get_version().split(".")[0]
	if not ver.is_valid_int() or int(ver) < 11:
		return {}
	var act = Engine.get_singleton("AndroidRuntime").getActivity()
	if act == null:
		return {}
	var am = act.getSystemService("activity")
	if am == null:
		return {}
	var lista = am.getHistoricalProcessExitReasons(act.getPackageName(), 0, 1)
	if lista == null or not (lista is Object) or int(lista.size()) < 1:
		return {}
	var x = lista.get(0)
	if x == null:
		return {}
	var r := {"motivo": int(x.getReason()), "imp": int(x.getImportance()), "rss": int(x.getRss()) / 1024, "pss": int(x.getPss()) / 1024}
	var quando := int(x.getTimestamp())
	if quando > 0:
		r.min = snappedf((Time.get_unix_time_from_system() * 1000.0 - quando) / 60000.0, 0.1)
	var desc = x.getDescription()
	if desc is String and desc != "":
		r.desc = desc.substr(0, 60)
	return r

# MB de textura e de malha/buffer na placa agora (o vmem dos registros é a soma de tudo)
static func memoria_placa() -> Dictionary:
	return {
		"vtex": roundi(Performance.get_monitor(Performance.RENDER_TEXTURE_MEM_USED) / 1048576.0),
		"vbuf": roundi(Performance.get_monitor(Performance.RENDER_BUFFER_MEM_USED) / 1048576.0),
	}

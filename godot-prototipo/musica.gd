extends Node
# Música de fundo (André 2026-11-06: "bem repetitiva, com aquele instrumento medieval, suave, meio épica").
# As faixas ficam em godot-prototipo/musica/ (fora de sons/, para o sons.gd não carregar como efeito).
# Todas CC0 (domínio público): lista e origem em musica/LICENCAS.md.
# Toca em loop, entra devagar, e o volume vem do menu Configurações > Música (0..100).

const PASTA := "res://musica/"
const BASE_DB := -8.0 # fundo: abaixo dos efeitos mesmo com o volume da música em 100%
const ENTRADA := 4.0 # segundos de fade ao começar ou trocar de faixa

var faixa := "" # nome do arquivo sem .ogg
var volume := 70.0 # 0..100, ajustado pelo menu_topo.gd
var _p: AudioStreamPlayer
var _tw: Tween

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_p = AudioStreamPlayer.new()
	_p.bus = "Master"
	add_child(_p)

func faixas() -> Array[String]:
	var nomes: Array[String] = []
	for f in ResourceLoader.list_directory(PASTA):
		f = f.trim_suffix(".import").trim_suffix(".remap")
		if f.ends_with(".ogg") and not nomes.has(f.get_basename()):
			nomes.append(f.get_basename())
	nomes.sort()
	return nomes

# toca a faixa (nome sem .ogg); "" = a primeira da pasta
func tocar(nome := "") -> void:
	if nome == "":
		var lista := faixas()
		if lista.is_empty():
			return
		nome = lista[0]
	if nome == faixa and _p.playing:
		return
	var s = load(PASTA + nome + ".ogg")
	if s == null:
		return
	if s is AudioStreamOggVorbis:
		s.loop = true
	faixa = nome
	_p.stream = s
	_p.volume_db = -60.0
	_p.play()
	_aplicar(ENTRADA)

func parar() -> void:
	faixa = ""
	if _tw:
		_tw.kill()
	_tw = create_tween()
	_tw.tween_property(_p, "volume_db", -60.0, 1.5)
	_tw.tween_callback(_p.stop)

func definir_volume(v: float) -> void:
	volume = clampf(v, 0.0, 100.0)
	if _p and _p.playing:
		_aplicar(0.25)

func _alvo_db() -> float:
	if volume <= 0.0:
		return -80.0
	return BASE_DB + linear_to_db(volume / 100.0)

func _aplicar(tempo: float) -> void:
	if _tw:
		_tw.kill()
	_tw = create_tween()
	_tw.tween_property(_p, "volume_db", _alvo_db(), tempo)

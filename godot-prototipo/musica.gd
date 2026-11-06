extends Node
# Música de fundo (André 2026-11-06: "bem repetitiva, com aquele instrumento medieval, suave, meio épica").
# As faixas ficam em godot-prototipo/musica/ (fora de sons/, para o sons.gd não carregar como efeito).
# Licença e origem de cada faixa em musica/LICENCAS.md (só faixas livres para uso comercial).
# Toca em loop, entra devagar, e o volume vem do menu Configurações > Música (0..100).

const PASTA := "res://musica/"
const BASE_DB := -8.0 # fundo: abaixo dos efeitos mesmo com o volume da música em 100%
const ENTRADA := 2.5 # segundos de fade ao começar ou trocar de faixa (direção de arte: 2 a 3 s)
# Música de combate (André 2026-11-06: "uma música diferente pra quando eu entrar em combate").
# Fica em musica/combate/ (subpasta: faixas() não lista, a música de fundo continua a mesma).
const PASTA_COMBATE := "res://musica/combate/"
const ENTRA_COMBATE := 1.2 # s: a luta começa rápido
const SAI_COMBATE := 3.0 # s: na volta a música de fundo entra devagar
const ESPERA_SAIR := 4.0 # s fora de combate antes de voltar (somado aos 5 s do combate: não fica trocando entre golpes)

var faixa := "" # nome do arquivo sem .ogg
var volume := 45.0 # 0..100, ajustado pelo menu_topo.gd (padrão 45%: abaixo do golpe e da magia)
var _p: AudioStreamPlayer
var _tw: Tween
var _pc: AudioStreamPlayer # faixa de combate
var _twc: Tween
var lutando := false # tocando a música de combate agora
var _fora_t := 0.0 # quanto tempo já está fora de combate

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_p = AudioStreamPlayer.new()
	_p.bus = "Master"
	add_child(_p)
	_pc = AudioStreamPlayer.new()
	_pc.bus = "Master"
	add_child(_pc)

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
	if not lutando:
		_aplicar(ENTRADA)

func parar() -> void:
	faixa = ""
	if lutando:
		lutando = false
		faixa_luta = ""
		_twc = _fade(_pc, _twc, -60.0, 1.5)
		_twc.tween_callback(_pc.stop)
	if _tw:
		_tw.kill()
	_tw = create_tween()
	_tw.tween_property(_p, "volume_db", -60.0, 1.5)
	_tw.tween_callback(_p.stop)

func definir_volume(v: float) -> void:
	volume = clampf(v, 0.0, 100.0)
	if lutando:
		if _pc and _pc.playing:
			_twc = _fade(_pc, _twc, _alvo_db(), 0.25)
	elif _p and _p.playing:
		_aplicar(0.25)

# chamado todo quadro pelo main.gd com trabalho.em_combate(): entra na hora, sai só depois de ESPERA_SAIR.
# chefe = luta com chefe (Imp Chefe, Warrok): toca musica/combate/chefe.ogg se existir; senão a faixa comum (luta.ogg)
func combate(em_luta: bool, dt: float, chefe := false) -> void:
	if em_luta:
		_fora_t = 0.0
		var nome := faixa_combate(chefe)
		if nome != "" and (not lutando or nome != faixa_luta):
			_entrar_combate(nome)
	elif lutando:
		_fora_t += dt
		if _fora_t >= ESPERA_SAIR:
			_sair_combate()

var _lista_combate = null # nomes em musica/combate/ (lidos uma vez)
var faixa_luta := "" # faixa de combate tocando agora

func faixa_combate(chefe := false) -> String:
	if _lista_combate == null:
		_lista_combate = []
		for f in ResourceLoader.list_directory(PASTA_COMBATE):
			f = f.trim_suffix(".import").trim_suffix(".remap")
			if f.ends_with(".ogg") and not _lista_combate.has(f.get_basename()):
				_lista_combate.append(f.get_basename())
		_lista_combate.sort()
	if chefe and _lista_combate.has("chefe"):
		return "chefe"
	if _lista_combate.has("luta"):
		return "luta"
	return "" if _lista_combate.is_empty() or _lista_combate[0] == "chefe" else _lista_combate[0]

func _entrar_combate(nome: String) -> void:
	if faixa == "": # música parada: não toca a de combate
		return
	var s = load(PASTA_COMBATE + nome + ".ogg")
	if s == null:
		return
	if s is AudioStreamOggVorbis:
		s.loop = true
	lutando = true
	faixa_luta = nome
	if _pc.stream != s or not _pc.playing:
		_pc.stream = s
		_pc.volume_db = -60.0
		_pc.play() # cada luta começa do começo da faixa (a abertura é a parte mais forte)
	_twc = _fade(_pc, _twc, _alvo_db(), ENTRA_COMBATE)
	_tw = _fade(_p, _tw, -60.0, ENTRA_COMBATE)

func _sair_combate() -> void:
	lutando = false
	faixa_luta = ""
	_twc = _fade(_pc, _twc, -60.0, SAI_COMBATE)
	_twc.tween_callback(_pc.stop)
	if faixa != "":
		_aplicar(SAI_COMBATE)

func _fade(pl: AudioStreamPlayer, tw: Tween, db: float, tempo: float) -> Tween:
	if tw:
		tw.kill()
	tw = create_tween()
	tw.tween_property(pl, "volume_db", db, tempo)
	return tw

func _alvo_db() -> float:
	if volume <= 0.0:
		return -80.0
	return BASE_DB + linear_to_db(volume / 100.0)

func _aplicar(tempo: float) -> void:
	if _tw:
		_tw.kill()
	_tw = create_tween()
	_tw.tween_property(_p, "volume_db", _alvo_db(), tempo)

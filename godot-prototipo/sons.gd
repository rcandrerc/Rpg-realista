extends Node
# Sons do jogo (godot-prototipo/sons/, gerados por ferramentas/sons/gerar.py: Kenney CC0 + sons próprios).
# tocar("acerto") escolhe uma das variações (acerto_1, acerto_2...) e varia um pouco o tom, para não soar repetido.
# Com posição: mais baixo longe do herói, e nem toca a mais de 30 m.

const VOZES := 14
const LONGE := 30.0

var _sons := {} # nome -> [AudioStream, ...]
var _vozes: Array[AudioStreamPlayer] = []
var _i := 0
var ouvinte: Node3D # o herói
var volume_geral := 0.0 # dB

func _ready() -> void:
	var nomes := {}
	for f in ResourceLoader.list_directory("res://sons"):
		f = f.trim_suffix(".import").trim_suffix(".remap")
		if f.ends_with(".ogg"):
			nomes[f] = true
	for f in nomes:
		var s = load("res://sons/" + f)
		if s == null:
			continue
		var base: String = f.get_basename()
		var partes := base.rsplit("_", true, 1)
		if partes.size() == 2 and partes[1].is_valid_int():
			base = partes[0]
		if not _sons.has(base):
			_sons[base] = []
		_sons[base].append(s)
	for i in VOZES:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_vozes.append(p)

func tem(nome: String) -> bool:
	return _sons.has(nome)

# vol em dB; tom = variação do tom (0.08 = ±8%); pos = onde aconteceu (null = no herói)
func tocar(nome: String, vol := 0.0, tom := 0.08, pos = null, tom_base := 1.0) -> void:
	var lista = _sons.get(nome)
	if lista == null:
		return
	if pos is Vector3 and ouvinte:
		var d: float = (pos as Vector3).distance_to(ouvinte.global_position)
		if d > LONGE:
			return
		vol -= d * 0.6 # cai uns 6 dB a cada 10 m
	var p := _vozes[_i]
	_i = (_i + 1) % _vozes.size()
	p.stream = lista[randi() % lista.size()]
	p.volume_db = vol + volume_geral
	p.pitch_scale = tom_base * randf_range(1.0 - tom, 1.0 + tom)
	p.play()

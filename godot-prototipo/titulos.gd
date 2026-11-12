extends Node
# Títulos (André 2026-11-12): o título em uso aparece em cima da cabeça, acima do nome e do nível. Quanto mais difícil,
# mais bonito: Comum (texto simples), Raro (azul com ◇), Épico (roxo com ◆), Lendário (dourado, maior, pulsando) e
# Mítico (maior ainda, cor que corre do rosa ao dourado). Os títulos vêm de habilidades.json "titulos" (TITULOS em
# shared/dados.js); quem dá, troca e confere o bônus é o servidor (acao 'titulo' na mensagem 'item').
# Também põe o nome e o nível em cima da cabeça do próprio herói (André 2026-11-12: "em cima da minha cabeça").
# Leve no celular: são só Label3D; o brilho é uma conta de cor por quadro e só nos títulos Lendário e Mítico que estão
# na tela (no máximo uns poucos).

var m # main.gd
var _placa: Label3D # "Nome · Nv X" do herói
var _tit_heroi: Label3D
var _texto := ""
var _id_heroi := "-"
var _t := 0.0
var _brilham: Array = [] # Label3D dos títulos Lendário e Mítico (pulsam)

# cor de cada brilho (as cores das raridades) e o contorno
const COR := [Color("d9d2c2"), Color("7cbcff"), Color("c690ff"), Color("ffc24d"), Color("ff6f86")]
const CONTORNO := [Color(0.08, 0.07, 0.06, 0.9), Color(0.03, 0.09, 0.22, 0.95), Color(0.16, 0.05, 0.3, 0.95), Color(0.32, 0.17, 0.0, 1.0), Color(0.35, 0.02, 0.1, 1.0)]
const TAMANHO := [58, 60, 62, 68, 74]

func _init(main) -> void:
	m = main

static func dados_de(P) -> Dictionary:
	return P.dados.get("titulos", {}) if P != null and P.dados is Dictionary else {}

# texto do título como vai na cabeça
static func enfeite(nome: String, r: int) -> String:
	match r:
		1: return "◇ %s ◇" % nome
		2, 3: return "◆ %s ◆" % nome
		4: return "◆◇ %s ◇◆" % nome
	return nome

# põe (ou tira, id "") o título em cima de quem tem a placa do nome; devolve o Label3D (ou null)
func por(no: Node3D, placa: Label3D, id: String) -> Label3D:
	var t: Label3D = no.get_node_or_null("TituloJogador")
	var T: Dictionary = dados_de(m.P).get(id, {}) if id != "" else {}
	if T.is_empty() or placa == null:
		if t:
			_brilham.erase(t)
			t.queue_free()
		return null
	if t == null:
		t = Label3D.new()
		t.name = "TituloJogador"
		t.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		t.fixed_size = true
		t.font = m.fonte_nome()
		t.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		no.add_child(t)
	var r: int = clampi(int(T.get("r", 0)), 0, 4)
	t.text = enfeite(str(T.nome), r)
	t.font_size = TAMANHO[r]
	t.outline_size = 12 if r >= 3 else 9
	t.pixel_size = placa.pixel_size
	t.modulate = COR[r]
	t.outline_modulate = CONTORNO[r]
	t.position = placa.position
	t.offset = Vector2(0, placa.offset.y + 64.0 * placa.font_size / 72.0)
	t.visibility_range_end = placa.visibility_range_end
	t.set_meta("r", r)
	if r >= 3:
		if not _brilham.has(t):
			_brilham.append(t)
	else:
		_brilham.erase(t)
	return t

func _process(dt: float) -> void:
	_t += dt
	_heroi()
	# brilho dos títulos difíceis: o Lendário pulsa (dourado que clareia), o Mítico corre do rosa ao dourado
	for i in range(_brilham.size() - 1, -1, -1):
		var l = _brilham[i]
		if not is_instance_valid(l):
			_brilham.remove_at(i)
			continue
		if not l.is_visible_in_tree():
			continue
		var r: int = l.get_meta("r", 3)
		var s := 0.5 + 0.5 * sin(_t * (2.4 if r == 3 else 3.2))
		if r == 3:
			l.modulate = COR[3].lerp(Color("fff1c4"), s * 0.6)
			l.outline_modulate = CONTORNO[3].lerp(Color(0.85, 0.5, 0.05, 1.0), s * 0.5)
		else:
			var c := Color.from_hsv(fposmod(0.97 + 0.12 * (0.5 + 0.5 * sin(_t * 1.3)), 1.0), 0.62, 1.0)
			l.modulate = c.lerp(Color.WHITE, s * 0.35)
			l.outline_modulate = Color(0.45, 0.04, 0.16, 1.0).lerp(Color(0.95, 0.35, 0.2, 1.0), s * 0.6)

# nome e nível em cima do próprio herói (o corpo troca no criador: a placa vai junto para o corpo novo)
func _heroi() -> void:
	var h: Node3D = m.heroi
	if h == null or m.P == null:
		return
	if _placa == null or not is_instance_valid(_placa) or _placa.get_parent() != h:
		if _placa != null and is_instance_valid(_placa):
			_placa.queue_free()
		_placa = Label3D.new()
		_placa.name = "PlacaHeroi"
		_placa.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		_placa.fixed_size = true
		_placa.font = m.fonte_nome()
		_placa.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		_placa.font_size = 72
		_placa.outline_size = 9
		_placa.pixel_size = 0.00034
		_placa.offset = Vector2(0, 40)
		_placa.modulate = Color(1, 0.93, 0.8)
		_placa.outline_modulate = Color(0.06, 0.05, 0.04, 0.9)
		_placa.position = Vector3(0, 1.95, 0)
		h.add_child(_placa)
		_texto = ""
		_id_heroi = "-"
	var prog: Dictionary = m.P.prog
	var texto := "%s · Nv %d" % [str(m.hud.nome), int(prog.get("nivel", 1))]
	if texto != _texto:
		_texto = texto
		_placa.text = texto
	var tit = prog.get("tit")
	var id: String = str(tit.get("uso", "")) if tit is Dictionary else ""
	if id != _id_heroi:
		_id_heroi = id
		_tit_heroi = por(h, _placa, id)
	# no criador e nas cenas a cabeça fica limpa
	var ver: bool = not (m.criador != null and m.criador.has_method("aberto") and m.criador.aberto())
	_placa.visible = ver
	if _tit_heroi != null and is_instance_valid(_tit_heroi):
		_tit_heroi.visible = ver

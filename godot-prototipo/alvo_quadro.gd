extends Node
const Idioma = preload("res://idioma.gd") # inglês (idioma.gd)
# Quadro do alvo (André 2026-11-17: "o monstro ou o personagem que eu estiver com o target, aparece uma barrinha de HP dele,
# do lado esquerdo ali pequena", como no Quimera). Vale para qualquer alvo da marca no chão (main.gd alvo_atual): monstro,
# chefe ou o outro do duelo. Sem lugar guardado fica na coluna da esquerda, logo abaixo das barras do time (amigos.gd).
# André 2026-11-17: "um pouco diferente" do time (fundo e borda avermelhados, duas espadas cruzadas = inimigo) e editável no
# Editar interface (editar_hud.gd, id "alvo"): posição e tamanho, independente do time.

const TAM := Vector2(196, 36)
const BASE_LIVRE := Vector2(18, 204) # com lugar guardado: BASE_LIVRE + d (como a missão)
const COR_BORDA := Color(0.95, 0.3, 0.22)
const COR_FUNDO := Color(0.17, 0.05, 0.04, 0.8)

var m # main.gd
var tela: Control
var _chave := "" # redesenha só quando muda
var _d := {} # o que está desenhado: nome, nível, vida, máx, cor
var _sb: StyleBoxFlat
var _desl := Vector2.ZERO # lugar guardado (editar_hud.gd)
var _s := 1.0
var _livre := false

func _init(principal) -> void:
	m = principal

func _ready() -> void:
	tela = Control.new()
	tela.mouse_filter = Control.MOUSE_FILTER_IGNORE
	tela.size = TAM
	tela.visible = false
	tela.draw.connect(_desenhar)
	m.hud.add_child(tela)

# editar_hud.gd: lugar e tamanho. livre = o jogador mexeu (sai da coluna da esquerda)
func posicionar(d: Vector2, s: float, livre: bool) -> void:
	_desl = d
	_s = s
	_livre = livre
	_chave = "" # refaz no próximo quadro

# caixa na tela (editar_hud.gd)
func area() -> Rect2:
	if tela == null:
		return Rect2()
	return Rect2(_lugar(), TAM * _s)

# quanto a coluna da esquerda (missao_ativa.gd) desce para não ficar embaixo do quadro (só quando ele está na coluna)
func altura() -> float:
	return (TAM.y + 4.0) * _s if tela != null and tela.visible and not _livre else 0.0

func _lugar() -> Vector2:
	if _livre:
		return BASE_LIVRE + _desl
	var A = m.amigos
	if A == null:
		return Vector2(18, 122)
	return A.BARRAS + A.barras_d + Vector2(0, A.altura_barras(m.hud.editando))

# {nome, nivel, vida, max, cor} do alvo agora; {} = nada para mostrar
func _dados() -> Dictionary:
	if m.hud.editando: # modelo para dar para mover e mudar o tamanho mesmo sem alvo
		var r := _do_alvo()
		return r if not r.is_empty() else {"nome": Idioma.frase("Alvo"), "nivel": 5, "vida": 70.0, "max": 100.0, "cor": Color(1.0, 0.5, 0.42)}
	if m.hud.esconder_combate:
		return {}
	return _do_alvo()

func _do_alvo() -> Dictionary:
	var e = m.alvo_atual
	if e == null or not (e is Dictionary):
		return {}
	if not e.has("no") or not is_instance_valid(e.no) or not e.no.visible or str(e.get("estado", "")) == "morto":
		return {}
	if e.get("duelo", false): # o outro do duelo (duelo.gd alvo): números do servidor (online.gd)
		var o = m.online.outros.get(str(e.get("id", ""))) if m.online else null
		if o == null:
			return {}
		return {"nome": str(o.get("nome", m.duelo.nome)), "nivel": int(o.get("nivel", 0)), "vida": float(o.get("vida", 0.0)),
			"max": float(o.get("vida_max", 1.0)), "cor": Color(1.0, 0.5, 0.42)}
	var nome := ""
	for l in e.no.get_children(): # o nome em cima da cabeça (main.gd criar_inimigo): "Puglin  Nv 5"
		if l is Label3D:
			nome = l.text.split("  Nv ")[0].split("\n")[0]
			break
	var mx: float = float(e.get("vida_max_srv", e.get("vida_max", 1.0)))
	var v: float = float(e.get("vida", 0.0))
	if m.online and e.has("vida_max_srv"):
		v -= m.online._soma_prev(e) # o golpe que acabou de sair já desce a barra (como a barra em cima da cabeça)
	if v <= 0.0:
		return {}
	var nv := int(e.get("nivel", 0))
	return {"nome": nome if nome != "" else Idioma.frase("Inimigo"), "nivel": nv, "vida": v, "max": mx,
		"cor": m.cor_nivel(nv) if nv > 0 else Color(1, 1, 1)}

func _process(_dt: float) -> void:
	if tela == null:
		return
	var d := _dados()
	var pos := _lugar()
	var chave := "" if d.is_empty() else "%s|%d|%d|%d|%s|%s" % [d.nome, d.nivel, int(ceil(d.vida)), int(d.max), pos, _s]
	if chave == _chave:
		return
	_chave = chave
	_d = d
	tela.position = pos
	tela.scale = Vector2(_s, _s)
	tela.visible = not d.is_empty()
	tela.queue_redraw()

func _desenhar() -> void:
	if _d.is_empty():
		return
	var f := ThemeDB.fallback_font
	var r := Rect2(Vector2.ZERO, TAM)
	_caixa(r, 10, COR_FUNDO)
	_caixa(r, 10, COR_BORDA, 2)
	_espadas(Vector2(15, 8.5), 6.5)
	var cab: String = _d.nome + (("  " + Idioma.t("Nv %d")) % int(_d.nivel) if int(_d.nivel) > 0 else "")
	tela.draw_string_outline(f, Vector2(26, 13), cab, HORIZONTAL_ALIGNMENT_LEFT, TAM.x - 32, 13, 3, Color(0, 0, 0, 0.7))
	tela.draw_string(f, Vector2(26, 13), cab, HORIZONTAL_ALIGNMENT_LEFT, TAM.x - 32, 13, _d.cor)
	var frac: float = clamp(float(_d.vida) / max(1.0, float(_d.max)), 0.0, 1.0)
	var bp := Vector2(8, 19)
	var bt := Vector2(TAM.x - 16, 12)
	_caixa(Rect2(bp, bt), 3, Color(0, 0, 0, 0.5))
	_caixa(Rect2(bp, Vector2(bt.x * frac, bt.y)), 3, Color(0.8, 0.22, 0.2))
	var txt := "%d/%d" % [int(ceil(_d.vida)), int(_d.max)]
	var w := f.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 10).x
	tela.draw_string_outline(f, bp + Vector2((bt.x - w) * 0.5, bt.y - 2), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, 3, Color(0, 0, 0, 0.7))
	tela.draw_string(f, bp + Vector2((bt.x - w) * 0.5, bt.y - 2), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 10, Color.WHITE)

# duas espadas cruzadas (desenhadas, sem depender de símbolo na fonte): inimigo
func _espadas(c: Vector2, r: float) -> void:
	for lado in [1.0, -1.0]:
		var ponta := c + Vector2(r * lado, -r) # lâmina para cima
		var cabo := c + Vector2(-r * lado, r)
		var dir := (ponta - cabo).normalized()
		var perp := Vector2(-dir.y, dir.x)
		var guarda := cabo + dir * (r * 0.55)
		tela.draw_line(guarda, ponta, Color(0, 0, 0, 0.7), 3.6, true)
		tela.draw_line(cabo, guarda, Color(0, 0, 0, 0.7), 3.6, true)
		tela.draw_line(guarda, ponta, Color(0.93, 0.9, 0.85), 1.8, true) # lâmina
		tela.draw_line(cabo, guarda, Color(0.55, 0.32, 0.16), 2.0, true) # cabo
		tela.draw_line(guarda - perp * 2.6, guarda + perp * 2.6, Color(0.95, 0.72, 0.3), 1.8, true) # guarda dourada

func _caixa(r: Rect2, raio: int, cor: Color, borda := 0) -> void:
	if r.size.x <= 0.5 or r.size.y <= 0.5:
		return
	if _sb == null:
		_sb = StyleBoxFlat.new()
		_sb.anti_aliasing = true
	_sb.set_corner_radius_all(int(min(float(raio), r.size.y * 0.5, r.size.x * 0.5)))
	_sb.draw_center = borda == 0
	_sb.set_border_width_all(borda)
	_sb.bg_color = cor
	_sb.border_color = cor
	_sb.draw(tela.get_canvas_item(), r)

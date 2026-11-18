extends CanvasLayer
# Balão de fala do chat Local (André 2026-11-18: "eu pensei que ia ser balãozinho mesmo, não texto"): balão de quadrinho,
# fundo claro arredondado com borda e a pontinha apontando para a cabeça de quem falou. Fica na tela (2D), preso à
# cabeça. Dois balões que se encostam: o de quem está mais longe sobe. Some sozinho em DUR s.
# online.gd chama falar(no, texto, lingua) quando chega o evento "balao" do servidor.
const DUR := 5.0
const SOME := 0.35 # s do fim em que ele vai sumindo
const LARG_MAX := 230.0 # px do texto antes de quebrar a linha
const FONTE := 15
const MARGEM := Vector2(11, 6)
const PONTA := 13.0 # px da pontinha
const CABECA := 1.95 # m acima dos pés: onde fica o nome
const ACIMA_NOME := 22.0 # px entre a ponta e o nome
const LONGE := 40.0 # m: mais longe que isso não mostra
const FOLGA := 4.0 # px entre dois balões empilhados
const COR_FUNDO := Color(0.99, 0.96, 0.88, 0.97)
const COR_BORDA := Color(0.27, 0.18, 0.10)
const COR_TEXTO := Color(0.17, 0.11, 0.06)
const COR_LINGUA := Color(0.36, 0.38, 0.48) # da outra raça (embaralhado): azulado e em itálico

var m
var lista := {} # nó do corpo (instance id) -> Balao
var _estilo: StyleBoxFlat
var relogio := 0.0 # s do jogo (anda com o dt: pausa e --fixed-fps valem)

class Balao extends Control:
	var no: Node3D
	var fim := 0.0
	var ponta := Vector2.ZERO # onde a pontinha encosta, relativo a este Control
	var tam := Vector2.ZERO
	var estilo: StyleBoxFlat
	var rotulo: Label
	var cor_fundo: Color
	var cor_borda: Color
	func _draw() -> void:
		estilo.draw(get_canvas_item(), Rect2(Vector2.ZERO, tam))
		var base := tam.y - 2.5 # cobre a borda de baixo no pé da ponta
		var cx := clampf(ponta.x, 18.0, tam.x - 18.0)
		var e := Vector2(cx - 8.0, base)
		var d := Vector2(cx + 8.0, base)
		draw_colored_polygon(PackedVector2Array([e, d, ponta]), cor_fundo)
		draw_line(Vector2(e.x, tam.y - 1.0), ponta, cor_borda, 2.0, true)
		draw_line(Vector2(d.x, tam.y - 1.0), ponta, cor_borda, 2.0, true)

func _init(principal) -> void:
	m = principal
	layer = 3 # junto da HUD, abaixo do chat e do menu do topo (4)
	_estilo = StyleBoxFlat.new()
	_estilo.bg_color = COR_FUNDO
	_estilo.border_color = COR_BORDA
	_estilo.set_border_width_all(2)
	_estilo.set_corner_radius_all(12)
	_estilo.anti_aliasing = true
	_estilo.shadow_color = Color(0, 0, 0, 0.25)
	_estilo.shadow_size = 3
	_estilo.shadow_offset = Vector2(0, 2)
	set_process(false)

func falar(no: Node3D, texto: String, lingua := false) -> void:
	if no == null or not is_instance_valid(no) or texto == "":
		return
	var k := no.get_instance_id()
	var b: Balao = lista.get(k)
	if b == null or not is_instance_valid(b):
		b = Balao.new()
		b.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.estilo = _estilo
		b.cor_fundo = COR_FUNDO
		b.cor_borda = COR_BORDA
		b.rotulo = Label.new()
		b.rotulo.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.rotulo.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		b.rotulo.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		b.rotulo.add_theme_font_override("font", m.fonte_nome())
		b.rotulo.add_theme_font_size_override("font_size", FONTE)
		b.add_child(b.rotulo)
		add_child(b)
		lista[k] = b
	b.no = no
	var fonte: Font = m.fonte_nome()
	var larg: float = minf(fonte.get_string_size(texto, HORIZONTAL_ALIGNMENT_LEFT, -1, FONTE).x + 2.0, LARG_MAX)
	var alt: float = fonte.get_multiline_string_size(texto, HORIZONTAL_ALIGNMENT_CENTER, larg, FONTE).y
	b.rotulo.text = texto
	b.rotulo.add_theme_color_override("font_color", COR_LINGUA if lingua else COR_TEXTO)
	b.rotulo.position = MARGEM
	b.rotulo.size = Vector2(larg, alt)
	b.tam = Vector2(larg, alt) + MARGEM * 2.0
	b.fim = relogio + DUR
	b.modulate.a = 1.0
	b.visible = false # o próximo quadro põe no lugar
	set_process(true)

func _process(dt: float) -> void:
	relogio += dt
	var cam: Camera3D = get_viewport().get_camera_3d()
	var agora := relogio
	var tela := get_viewport().get_visible_rect().size
	var vivos := []
	for k in lista.keys():
		var b: Balao = lista[k]
		if not is_instance_valid(b) or not is_instance_valid(b.no) or agora >= b.fim or not b.no.is_visible_in_tree():
			if is_instance_valid(b):
				b.queue_free()
			lista.erase(k)
			continue
		var p: Vector3 = b.no.global_position + Vector3.UP * CABECA * b.no.scale.y
		if cam == null or cam.is_position_behind(p) or cam.global_position.distance_to(p) > LONGE:
			b.visible = false
			continue
		var ponta: Vector2 = cam.unproject_position(p) - Vector2(0, ACIMA_NOME)
		var r := Rect2(ponta - Vector2(b.tam.x * 0.5, b.tam.y + PONTA), b.tam)
		r.position.x = clampf(r.position.x, 6.0, maxf(6.0, tela.x - b.tam.x - 6.0))
		vivos.append([cam.global_position.distance_to(p), b, r, ponta])
	if lista.is_empty():
		set_process(false)
		return
	# o mais perto fica no lugar; quem encosta nele sobe (a pontinha estica até a cabeça)
	vivos.sort_custom(func(a, c): return a[0] < c[0])
	var postos: Array[Rect2] = []
	for v in vivos:
		var r: Rect2 = v[2]
		for volta in 8:
			var bateu := false
			for q in postos:
				if q.grow(FOLGA).intersects(r):
					r.position.y = q.position.y - r.size.y - FOLGA - 2.0
					bateu = true
			if not bateu:
				break
		r.position.y = maxf(r.position.y, 4.0)
		postos.append(r)
		var b: Balao = v[1]
		b.position = r.position
		b.ponta = v[3] - r.position
		b.modulate.a = clampf((b.fim - agora) / SOME, 0.0, 1.0)
		b.visible = true
		b.queue_redraw()

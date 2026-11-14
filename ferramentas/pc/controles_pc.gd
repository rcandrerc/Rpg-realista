extends Node
# Controles do PC (teclado e mouse) da versão .exe para Windows.
#
# NÃO entra no celular: fica fora do projeto (ferramentas/pc/). Só o build do PC (.github/workflows/pc.yml, via
# ferramentas/pc/preparar.sh) copia para godot-prototipo/ e grava o [autoload] no project.godot na hora de exportar
# o .exe. O APK e as atualizações do celular nem veem este arquivo.
# Também não mexe no hud.gd nem na câmera: só preenche o que o joystick e os botões da tela já preenchem
# (hud.mover, hud.giro_cam, os sinais apertou/soltou/tocou), então o jogo responde igual ao toque.
#
# Teclas:
#   WASD / setas: andar (Alt segurado: andar devagar)
#   clique esquerdo ou J: golpe     1..6: habilidades (clicar no número do slot troca a tecla)     Espaço: pular    Q: dash    C ou Ctrl: rolar
#   Shift: disparada (liga/desliga)  F: cura    R: trocar arma    T: lobo    E: falar / coletar
#   Tab ou I: menu do personagem      botão direito arrastando: girar a câmera; clique rápido: tocar (NPC, alvo, troca)
#   roda do mouse: zoom (já era do hud.gd)    F11 ou Alt+Enter: tela cheia
#
# O nó "instalador" (autoload) espera a vila abrir e põe uma cópia dentro da HUD. A cópia fica dentro da HUD de
# propósito: assim recebe o clique antes do hud.gd e decide se ele é golpe (área livre) ou botão/menu (deixa passar).

const NOME := "ControlesPC"
const TECLAS := {
	KEY_J: "basico", KEY_1: "hab0", KEY_2: "hab1", KEY_3: "hab2", KEY_4: "hab3", KEY_5: "hab4", KEY_6: "hab5",
	KEY_SPACE: "pular", KEY_Q: "dash", KEY_C: "rolar", KEY_CTRL: "rolar", KEY_SHIFT: "disparada", KEY_F: "cura",
	KEY_R: "troca", KEY_T: "montar", KEY_TAB: "menu", KEY_I: "menu",
}
# o que aparece no cantinho de cada botão
const DICA := {
	"basico": "Clique", "hab0": "1", "hab1": "2", "hab2": "3", "hab3": "4", "hab4": "5", "hab5": "6",
	"pular": "Espaço", "dash": "Q", "rolar": "C", "disparada": "Shift", "cura": "F", "troca": "R", "montar": "T",
	"falar": "E", "coletar": "E",
}
# barra de atalhos reta (André 2026-11-14: "no pc queria que em vez das skills distribuídas como no celular fosse uma
# barra de hotkeys reta"). Só o PC: as 6 skills saem do arco e ficam em fila na beira de baixo, à esquerda da fileira
# Lobo/Shift/C/Q/Espaço, com o número da tecla no canto de cima de cada slot. Contadas do canto de baixo à direita,
# como no hud.gd, então acompanham a janela de qualquer tamanho. O celular continua com o arco.
const BARRA_Y := 61.0 # a mesma altura da fileira de baixo
const BARRA_FIM := 761.0 # centro do slot 6 (a partir da direita): folga antes do Lobo (667)
const BARRA_PASSO := 76.0
# trocar a tecla de cada slot (André 2026-11-14: "colocar de alguma maneira que eu possa editar quais botões são
# cada skill", "ou em configurações ou na própria tela"): clicar no número do slot, depois apertar a tecla nova.
# Esc cancela. Tecla de outro slot: os dois trocam. Tecla de outra ação (Q, C, F...): não deixa, para nada sumir.
# Fica em user://config.cfg, seção "pc", chave "teclas_skills" (o mesmo arquivo da HUD e do chat).
const ARQ_CFG := "user://config.cfg"
const TECLAS_PADRAO := [KEY_1, KEY_2, KEY_3, KEY_4, KEY_5, KEY_6]
const CLIQUE_RAPIDO_MS := 350
const CLIQUE_RAPIDO_PX := 22.0

var instalador := true
var hud = null
var _teclas_movendo := false
var _mouse_golpe := -1 # índice do toque (vindo do mouse) que está segurando o golpe
var _dir_inicio := Vector2.ZERO # botão direito: onde e quando apertou (clique rápido vira "tocou")
var _dir_hora := -1
var _dir_andou := 0.0
var _dicas: Control
var _barra: Control # moldura da barra, atrás dos botões
var teclas_hab: Array = TECLAS_PADRAO.duplicate() # tecla de cada slot (hab0..hab5)
var _gravando := -1 # slot esperando a tecla nova (-1: nenhum)

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	if instalador:
		set_process_input(false)
		return
	# dicas das teclas desenhadas por cima dos botões (somem junto com a HUD de combate)
	_dicas = Control.new()
	_dicas.set_anchors_preset(Control.PRESET_FULL_RECT)
	_dicas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_dicas.draw.connect(_desenhar_dicas)
	hud._combate.add_child(_dicas)
	_barra = Control.new()
	_barra.set_anchors_preset(Control.PRESET_FULL_RECT)
	_barra.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_barra.show_behind_parent = true
	_barra.draw.connect(_desenhar_barra)
	hud._combate.add_child(_barra)
	_montar_barra()
	_carregar_teclas()

func _process(_dt: float) -> void:
	if instalador:
		_instalar()
		return
	if not is_instance_valid(hud):
		return
	_andar()
	_dicas.queue_redraw()
	_barra.queue_redraw()

func _instalar() -> void:
	if hud != null and is_instance_valid(hud):
		return
	hud = null
	var cena = get_tree().current_scene
	if cena == null or not ("hud" in cena):
		return
	var h = cena.hud
	if h == null or not is_instance_valid(h) or not h.is_inside_tree() or h.has_node(NOME):
		return
	var c = get_script().new()
	c.instalador = false
	c.hud = h
	c.name = NOME
	h.add_child(c)
	hud = h

# ---------- teclado ----------

func _digitando() -> bool:
	var f := get_viewport().gui_get_focus_owner()
	return f is LineEdit or f is TextEdit

func _andar() -> void:
	if hud._toques.values().has("joy"): # alguém usando o joystick da tela (PC com toque): ele manda
		_teclas_movendo = false
		return
	var v := Vector2.ZERO
	if not hud.bloqueado and not _digitando():
		if Input.is_physical_key_pressed(KEY_A) or Input.is_physical_key_pressed(KEY_LEFT): v.x -= 1.0
		if Input.is_physical_key_pressed(KEY_D) or Input.is_physical_key_pressed(KEY_RIGHT): v.x += 1.0
		if Input.is_physical_key_pressed(KEY_W) or Input.is_physical_key_pressed(KEY_UP): v.y -= 1.0
		if Input.is_physical_key_pressed(KEY_S) or Input.is_physical_key_pressed(KEY_DOWN): v.y += 1.0
	if v != Vector2.ZERO:
		v = v.normalized()
		if Input.is_physical_key_pressed(KEY_ALT):
			v *= 0.45
		hud.mover = v
		_teclas_movendo = true
	elif _teclas_movendo:
		hud.mover = Vector2.ZERO
		_teclas_movendo = false

func _botao(acao: String):
	for b in hud.botoes:
		if b.acao == acao:
			return b
	return null

# a ação pode ser usada agora? (mesmas regras do toque no hud.gd: botão escondido ou modo construção não respondem)
func _pode(acao: String) -> bool:
	if acao == "menu":
		return true
	if hud.modo_construcao or hud.esconder_combate or hud.caido:
		return false
	var b = _botao(acao)
	return b != null and not b.oculto

func _apertar(chave: String, acao: String) -> void:
	if hud._toques.has(chave):
		return
	if acao == "menu":
		hud.apertou.emit("menu")
		return
	hud._toques[chave] = acao # o hud.segurando() enxerga a tecla como um dedo no botão (golpe repete segurando)
	var b = _botao(acao)
	if b:
		b.apertado = true
	hud.apertou.emit(acao)

func _soltar(chave: String) -> void:
	if not hud._toques.has(chave):
		return
	var acao = hud._toques[chave]
	hud._toques.erase(chave)
	if hud.segurando(acao): # outra tecla (ou o mouse) ainda no mesmo botão
		return
	var b = _botao(acao)
	if b:
		b.apertado = false
	hud.soltou.emit(acao)

func _input(ev: InputEvent) -> void:
	if instalador or not is_instance_valid(hud):
		return
	if ev is InputEventKey:
		_tecla(ev)
	elif ev is InputEventScreenTouch:
		_toque_do_mouse(ev)
	elif ev is InputEventMouseButton and ev.button_index == MOUSE_BUTTON_RIGHT:
		_direito(ev)
	elif ev is InputEventMouseMotion and (ev.button_mask & MOUSE_BUTTON_MASK_RIGHT) and _dir_hora >= 0:
		if not hud.bloqueado:
			hud.giro_cam += ev.relative
		_dir_andou += ev.relative.length()

func _tecla(ev: InputEventKey) -> void:
	if ev.echo:
		return
	var k: Key = ev.physical_keycode
	if ev.pressed and (k == KEY_F11 or (k == KEY_ENTER and ev.alt_pressed)):
		var cheia := DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_MAXIMIZED if cheia else DisplayServer.WINDOW_MODE_FULLSCREEN)
		get_viewport().set_input_as_handled()
		return
	if _gravando >= 0:
		if ev.pressed:
			_gravar_tecla(k)
		get_viewport().set_input_as_handled()
		return
	var chave := "tecla_%d" % k
	if not ev.pressed:
		_soltar(chave)
		return
	if hud.bloqueado or _digitando():
		return
	var acao := ""
	if k == KEY_E: # falar com quem está perto; senão minerar/cortar
		for a in ["falar", "coletar"]:
			if _pode(a):
				acao = a
				break
	elif teclas_hab.has(k):
		acao = "hab%d" % teclas_hab.find(k)
	elif not TECLAS_PADRAO.has(k): # 1..6 fora da barra (trocadas por outra tecla) não fazem nada
		acao = TECLAS.get(k, "")
	if acao == "" or not _pode(acao):
		return
	_apertar(chave, acao)
	if k == KEY_TAB:
		get_viewport().set_input_as_handled() # Tab não pula o foco entre botões

# ---------- mouse ----------

# O Godot transforma o clique esquerdo em toque (emulate_touch_from_mouse): botões, menus e minimapa continuam
# iguais. Só o clique na área livre do jogo (onde no celular seria joystick ou câmera) vira golpe.
func _area_livre(p: Vector2) -> bool:
	if hud.bloqueado or hud.modo_construcao or hud.esconder_combate or hud.caido:
		return false
	if hud.menu_topo and hud.menu_topo.cobre(p): return false
	if hud.minimapa and hud.minimapa.cobre(p): return false
	if hud.construcao and hud.construcao.cobre(p): return false
	if hud.troca and hud.troca.cobre(p): return false
	if hud.PAINEL.has_point(p): return false
	for b in hud.botoes:
		if not b.oculto and p.distance_to(hud._centro(b)) <= b.raio * 1.15:
			return false
	# a folga em volta dos botões continua; o arco do celular não (as skills estão na barra)
	for b in hud.botoes:
		if not b.oculto and p.distance_to(hud._centro(b)) <= b.raio * 1.15 + hud.FOLGA_BOTAO:
			return false
	return true

func _toque_do_mouse(ev: InputEventScreenTouch) -> void:
	if ev.pressed and not hud.bloqueado:
		var i := _selo_em(ev.position)
		if i >= 0 or _gravando >= 0:
			if i >= 0 and i != _gravando:
				_gravando = i
				hud.aviso("Aperte a tecla do slot %d (Esc cancela)" % (i + 1))
			else:
				_gravando = -1 # clicou de novo no mesmo número (ou fora): cancela
			get_viewport().set_input_as_handled()
			return
	if ev.pressed:
		if _mouse_golpe < 0 and _area_livre(ev.position):
			_mouse_golpe = ev.index
			_apertar("mouse_golpe", "basico")
			get_viewport().set_input_as_handled()
	elif ev.index == _mouse_golpe:
		_mouse_golpe = -1
		_soltar("mouse_golpe")
		get_viewport().set_input_as_handled()

# botão direito: arrastar gira a câmera; clique rápido parado é o "tocar" do celular (ir até o NPC, travar o alvo,
# pedir troca a outro jogador)
func _direito(ev: InputEventMouseButton) -> void:
	if ev.pressed:
		_dir_inicio = ev.position
		_dir_hora = Time.get_ticks_msec()
		_dir_andou = 0.0
	elif _dir_hora >= 0:
		var rapido := Time.get_ticks_msec() - _dir_hora < CLIQUE_RAPIDO_MS and _dir_andou < CLIQUE_RAPIDO_PX
		_dir_hora = -1
		if rapido and not hud.bloqueado:
			hud.tocou.emit(ev.position)

# ---------- barra de atalhos ----------

func _montar_barra() -> void:
	for i in 6:
		var b = _botao("hab%d" % i)
		if b:
			b.canto = Vector2(BARRA_FIM + BARRA_PASSO * (5 - i), BARRA_Y)

func _slots_visiveis() -> Array:
	var l := []
	if hud.modo_construcao or hud.esconder_combate:
		return l
	for i in 6:
		var b = _botao("hab%d" % i)
		if b and not b.oculto and b.d == Vector2.ZERO: # movido no modo de editar: sai da moldura
			l.append(b)
	return l

# moldura escura com borda dourada atrás dos 6 slots, e um quadradinho por slot (fica com cara de barra de MMO)
func _desenhar_barra() -> void:
	var l := _slots_visiveis()
	if l.is_empty():
		return
	var ini: Vector2 = hud._centro(l[0])
	var fim: Vector2 = hud._centro(l[-1])
	var r: float = l[0].raio
	var caixa := Rect2(ini - Vector2(r + 9, r + 9), Vector2(fim.x - ini.x + 2 * r + 18, 2 * r + 18))
	var sombra := StyleBoxFlat.new()
	sombra.bg_color = Color(0, 0, 0, 0.3)
	sombra.set_corner_radius_all(10)
	_barra.draw_style_box(sombra, caixa.grow(2).grow_side(SIDE_BOTTOM, 2))
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.1, 0.088, 0.072, 0.72)
	sb.border_color = Color(0.72, 0.57, 0.32, 0.85)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(9)
	_barra.draw_style_box(sb, caixa)
	var slot := StyleBoxFlat.new()
	slot.bg_color = Color(0, 0, 0, 0.28)
	slot.border_color = Color(0.72, 0.57, 0.32, 0.35)
	slot.set_border_width_all(1)
	slot.set_corner_radius_all(6)
	for b in l:
		var c: Vector2 = hud._centro(b)
		_barra.draw_style_box(slot, Rect2(c - Vector2(b.raio + 3, b.raio + 3), Vector2(b.raio * 2 + 6, b.raio * 2 + 6)))

# ---------- trocar a tecla do slot ----------

func _carregar_teclas() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(ARQ_CFG) != OK or not cfg.has_section_key("pc", "teclas_skills"):
		return
	var l = cfg.get_value("pc", "teclas_skills", [])
	if l is Array and l.size() == 6:
		var ok := true
		for i in 6:
			var k := int(l[i])
			if k <= 0 or (TECLAS.has(k) and not TECLAS_PADRAO.has(k)) or l.count(l[i]) > 1:
				ok = false
		if ok:
			for i in 6:
				teclas_hab[i] = int(l[i])

func _salvar_teclas() -> void:
	var cfg := ConfigFile.new()
	cfg.load(ARQ_CFG) # guarda junto do que já está lá (HUD, chat, som)
	cfg.set_value("pc", "teclas_skills", teclas_hab)
	cfg.save(ARQ_CFG)

func nome_tecla(k: int) -> String:
	var t := OS.get_keycode_string(k)
	return t if t.length() <= 6 else t.substr(0, 6)

func _gravar_tecla(k: int) -> void:
	var i := _gravando
	_gravando = -1
	if k == KEY_ESCAPE:
		hud.aviso("Tecla mantida")
		return
	var outro := teclas_hab.find(k)
	if outro < 0 and ((TECLAS.has(k) and not TECLAS_PADRAO.has(k)) or k in [KEY_E, KEY_W, KEY_A, KEY_S, KEY_D, KEY_UP, KEY_DOWN, KEY_LEFT, KEY_RIGHT, KEY_ALT, KEY_F11, KEY_ENTER]):
		hud.aviso("Tecla %s já tem outra ação" % nome_tecla(k))
		return
	if outro >= 0: # era de outro slot: os dois trocam
		teclas_hab[outro] = teclas_hab[i]
	teclas_hab[i] = k
	_salvar_teclas()
	hud.aviso("Slot %d: tecla %s" % [i + 1, nome_tecla(k)])

# o clique pegou o número (selo) de algum slot da barra?
func _selo_em(p: Vector2) -> int:
	for i in 6:
		var b = _botao("hab%d" % i)
		if b and not b.oculto and _rect_selo(b, nome_tecla(teclas_hab[i])).grow(4).has_point(p):
			return i
	return -1

func _rect_selo(b, txt: String) -> Rect2:
	var w := ThemeDB.fallback_font.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
	var p: Vector2 = hud._centro(b) + Vector2(-b.raio - 3.0, -b.raio + 9.0)
	return Rect2(p + Vector2(-5, -12), Vector2(w + 10, 16))

# ---------- dicas das teclas ----------

func _desenhar_dicas() -> void:
	if hud.modo_construcao:
		return
	var f := ThemeDB.fallback_font
	for b in hud.botoes:
		if b.oculto or not DICA.has(b.acao):
			continue
		var txt: String = DICA[b.acao]
		var slot := -1
		if str(b.acao).begins_with("hab"):
			slot = int(str(b.acao).substr(3))
			txt = "?" if slot == _gravando else nome_tecla(teclas_hab[slot])
		var tam := 12
		var w := f.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, tam).x
		var c: Vector2 = hud._centro(b)
		# selo no canto de baixo à direita do botão (embaixo dele encostaria no botão vizinho do arco)
		var p := c + Vector2(b.raio * 0.72 - w * 0.5, b.raio * 0.72 + 6.0)
		if str(b.acao).begins_with("hab"): # na barra: número no canto de cima à esquerda, como nos MMOs
			tam = 14
			w = f.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, tam).x
			p = c + Vector2(-b.raio - 3.0, -b.raio + 9.0)
		var fundo := Rect2(p + Vector2(-5, -12), Vector2(w + 10, 16))
		_dicas.draw_rect(fundo, Color(0.1, 0.088, 0.072, 0.78))
		if slot >= 0 and slot == _gravando: # esperando a tecla: selo aceso piscando
			var pisca: float = 0.6 + 0.4 * sin(Time.get_ticks_msec() / 1000.0 * TAU * 1.5)
			_dicas.draw_rect(fundo, Color(0.93, 0.82, 0.32, pisca))
		_dicas.draw_rect(fundo, Color(0.72, 0.57, 0.32, 0.8), false, 1.0)
		var cor_txt := Color(0.1, 0.088, 0.072) if slot >= 0 and slot == _gravando else Color(0.96, 0.93, 0.86)
		_dicas.draw_string(f, p, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, cor_txt)

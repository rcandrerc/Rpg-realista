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
#   clique esquerdo ou J: golpe     1..6: habilidades     Espaço: pular    Q: dash    C ou Ctrl: rolar
#   Shift: disparada (liga/desliga)  F: cura    R: trocar arma    T: lobo    E: falar / coletar
#   Tab ou I: menu do personagem      botão direito arrastando: girar a câmera; clique rápido: tocar (NPC, alvo, troca)
#   roda do mouse: zoom (já era do hud.gd)    F11 ou Alt+Enter: tela cheia
#   F9: modo leve liga/desliga    F3: mostra o FPS
#
# Modo leve (PC fraco): resolução 3D menor, sem sombra do sol, sem MSAA e sem a grama solta. Liga sozinho quando o jogo
# abre em OpenGL (placa sem Vulkan/DirectX 12, Aethra-OpenGL.bat) e a escolha fica salva em user://pc.cfg.
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
var _leve := false
var _fps: Label

const LEVE_ESCALA := 0.4
const CFG := "user://pc.cfg"

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

func _process(_dt: float) -> void:
	if instalador:
		_instalar()
		return
	if not is_instance_valid(hud):
		return
	_andar()
	_dicas.queue_redraw()

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
	c._modo_leve(c._leve_salvo())

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
	if ev.pressed and k == KEY_F9:
		_modo_leve(not _leve)
		var cfg := ConfigFile.new()
		cfg.load(CFG)
		cfg.set_value("video", "leve", _leve)
		cfg.save(CFG)
		get_viewport().set_input_as_handled()
		return
	if ev.pressed and k == KEY_F3:
		_mostrar_fps(_fps == null or not _fps.visible)
		get_viewport().set_input_as_handled()
		return
	if ev.pressed and (k == KEY_F11 or (k == KEY_ENTER and ev.alt_pressed)):
		var cheia := DisplayServer.window_get_mode() == DisplayServer.WINDOW_MODE_FULLSCREEN
		DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_MAXIMIZED if cheia else DisplayServer.WINDOW_MODE_FULLSCREEN)
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
	else:
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
	return not hud.zona_morta(p)

func _toque_do_mouse(ev: InputEventScreenTouch) -> void:
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

# ---------- dicas das teclas ----------

func _desenhar_dicas() -> void:
	if hud.modo_construcao:
		return
	var f := ThemeDB.fallback_font
	for b in hud.botoes:
		if b.oculto or not DICA.has(b.acao):
			continue
		var txt: String = DICA[b.acao]
		var tam := 12
		var w := f.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, tam).x
		var c: Vector2 = hud._centro(b)
		# selo no canto de baixo à direita do botão (embaixo dele encostaria no botão vizinho do arco)
		var p := c + Vector2(b.raio * 0.72 - w * 0.5, b.raio * 0.72 + 6.0)
		var fundo := Rect2(p + Vector2(-5, -12), Vector2(w + 10, 16))
		_dicas.draw_rect(fundo, Color(0.1, 0.088, 0.072, 0.78))
		_dicas.draw_rect(fundo, Color(0.72, 0.57, 0.32, 0.8), false, 1.0)
		_dicas.draw_string(f, p, txt, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, Color(0.96, 0.93, 0.86))

# ---------- modo leve (PC fraco) ----------

func _leve_salvo() -> bool:
	var cfg := ConfigFile.new()
	if cfg.load(CFG) == OK and cfg.has_section_key("video", "leve"):
		return cfg.get_value("video", "leve")
	# sem escolha salva: liga sozinho se a placa só abriu em OpenGL
	return RenderingServer.get_current_rendering_method() == "gl_compatibility"

func _modo_leve(v: bool) -> void:
	_leve = v
	var cena = get_tree().current_scene
	if cena == null:
		return
	var vp := get_viewport()
	var padrao: float = cena.get("RESOLUCAO_PADRAO") if cena.get("RESOLUCAO_PADRAO") != null else 0.6
	vp.scaling_3d_scale = LEVE_ESCALA if v else padrao
	var msaa: int = 0 if v else int(ProjectSettings.get_setting("rendering/anti_aliasing/quality/msaa_3d", 0))
	vp.msaa_3d = msaa as Viewport.MSAA
	var sol = cena.get("sol")
	if sol is DirectionalLight3D:
		sol.shadow_enabled = not v
	var grama = cena.get("grama")
	if grama is Node3D:
		grama.visible = not v
	var mata = cena.get("grama_mata")
	if mata is Array:
		for g in mata:
			if g is Node3D and is_instance_valid(g):
				g.visible = not v
	_aviso("Modo leve ligado (F9 desliga)" if v else "Modo leve desligado (F9 liga)")

func _aviso(texto: String) -> void:
	var l := Label.new()
	l.text = texto
	l.add_theme_font_size_override("font_size", 18)
	l.add_theme_color_override("font_outline_color", Color.BLACK)
	l.add_theme_constant_override("outline_size", 6)
	l.set_anchors_preset(Control.PRESET_CENTER_TOP)
	l.position.y = 70
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	hud.add_child(l)
	get_tree().create_timer(3.0).timeout.connect(l.queue_free)

func _mostrar_fps(v: bool) -> void:
	if _fps == null:
		_fps = Label.new()
		_fps.add_theme_font_size_override("font_size", 16)
		_fps.add_theme_color_override("font_outline_color", Color.BLACK)
		_fps.add_theme_constant_override("outline_size", 5)
		_fps.position = Vector2(8, 4)
		_fps.mouse_filter = Control.MOUSE_FILTER_IGNORE
		hud.add_child(_fps)
	_fps.visible = v

func _physics_process(_dt: float) -> void:
	if _fps != null and _fps.visible:
		_fps.text = "%d FPS" % Engine.get_frames_per_second()

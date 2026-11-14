extends Node
# Rosto do herói no painel de vida e mana (André 2026-11-06: "a foto do meu avatar, e não essa letra A").
# Foto FIXA, de frente, só o rosto (André 2026-11-06: "quero uma foto fixa de frente e só"): um palco pequeno com mundo
# próprio, igual ao retrato dos NPCs (conversa.gd). Uma cópia do corpo com a mesma aparência fica parada, a câmera
# tira UMA foto e o palco para de desenhar. Só tira outra quando o corpo ou a aparência mudam (criador de personagem).

const Aparencia = preload("res://aparencia.gd")
const TAM := 128
const ESPERA := 0.4 # segundos para o cabelo (molas) assentar antes da foto

var m # main.gd
var vp: SubViewport
var cam: Camera3D
var corpo: Node3D
var _chave := "" # corpo + aparência da última foto
var _olhar_t := 0.0
var _foto_t := -1.0 # contagem até a foto (-1 = nenhuma pendente)

func _init(principal) -> void:
	m = principal

func _ready() -> void:
	vp = SubViewport.new()
	vp.size = Vector2i(TAM, TAM)
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_4X
	vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	add_child(vp)
	var amb := WorldEnvironment.new()
	var env := Environment.new() # fundo de couro escuro e luz de estúdio, iguais aos dos NPCs
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.16, 0.13, 0.1)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.85, 0.8, 0.72)
	env.ambient_light_energy = 0.7
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	amb.environment = env
	vp.add_child(amb)
	var sol := DirectionalLight3D.new()
	sol.light_energy = 1.1
	sol.rotation = Vector3(-0.5, 0.5, 0)
	vp.add_child(sol)
	cam = Camera3D.new()
	cam.fov = 30.0
	cam.near = 0.05
	vp.add_child(cam)
	m.hud.retrato = vp.get_texture()

func _process(dt: float) -> void:
	var t0_parte := Time.get_ticks_usec()
	_process_parte(dt)
	if Time.get_ticks_usec() - t0_parte >= 1000 and Engine.has_meta("lentidao"): # quadro lento (lentidao.gd)
		Engine.get_meta("lentidao").ev("retrato_heroi", t0_parte)

func _process_parte(dt: float) -> void:
	if _foto_t >= 0.0:
		_foto_t -= dt
		if _foto_t < 0.0:
			vp.render_target_update_mode = SubViewport.UPDATE_ONCE
			if corpo:
				corpo.process_mode = Node.PROCESS_MODE_DISABLED # parado de vez: não gasta nada até a próxima foto
		return
	_olhar_t -= dt
	if _olhar_t > 0.0:
		return
	_olhar_t = 1.0
	var chave := str(m.visual) + JSON.stringify(m.aparencia)
	if chave != _chave:
		_chave = chave
		_montar()

func _montar() -> void:
	if corpo:
		corpo.queue_free()
		corpo = null
	corpo = m.modelo(str(m.visual))
	corpo.get_parent().remove_child(corpo)
	vp.add_child(corpo)
	corpo.position = Vector3.ZERO
	corpo.rotation = Vector3.ZERO
	if not (m.aparencia as Dictionary).is_empty():
		Aparencia.aplicar(corpo, m.aparencia)
	var cab := Vector3(0, 1.45, 0)
	var esq: Skeleton3D = m.esqueleto(corpo)
	if esq:
		for i in esq.get_bone_count():
			var nb := esq.get_bone_name(i).to_lower()
			if nb.ends_with("head") or nb == "cabeca":
				cab = esq.global_transform * esq.get_bone_global_rest(i).origin
				break
	# de frente, olho no olho (o modelo olha para +Z)
	cam.look_at_from_position(cab + Vector3(0, 0.03, 0.62), cab + Vector3(0, 0.02, 0), Vector3.UP)
	_foto_t = ESPERA
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS # desenha enquanto o cabelo assenta; depois, uma foto e para


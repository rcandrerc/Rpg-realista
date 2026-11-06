extends Node
# Rosto do herói no painel de vida e mana (André 2026-11-06: "a foto do meu avatar, e não essa letra A").
# Um palco pequeno (128 px) que enxerga o MESMO mundo do jogo, mas só a camada do herói: a roupa, o cabelo, a arma e a luz
# do momento aparecem iguais. Desenha 2 vezes por segundo (não a cada quadro), para não pesar no celular.

const CAMADA := 1 << 19 # camada 20 do 3D: só o herói entra nela (o resto do mundo continua só na camada 1)
const TAM := 128
const INTERVALO := 0.5

var m # main.gd
var vp: SubViewport
var cam: Camera3D
var _t := 0.0
var _esq: Skeleton3D
var _cabeca := -1

func _init(principal) -> void:
	m = principal

func _ready() -> void:
	vp = SubViewport.new()
	vp.size = Vector2i(TAM, TAM)
	vp.msaa_3d = Viewport.MSAA_2X
	vp.positional_shadow_atlas_size = 0
	vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	add_child(vp)
	vp.world_3d = get_viewport().world_3d
	cam = Camera3D.new()
	cam.fov = 30.0
	cam.near = 0.05
	cam.far = 6.0
	cam.cull_mask = CAMADA
	var env := Environment.new() # fundo de couro escuro, igual ao do retrato dos NPCs (conversa.gd)
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.16, 0.13, 0.1)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.85, 0.8, 0.72)
	env.ambient_light_energy = 0.7
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	cam.environment = env
	vp.add_child(cam)
	m.hud.retrato = vp.get_texture()

func _process(dt: float) -> void:
	_t -= dt
	if _t > 0.0:
		return
	_t = INTERVALO
	var h: Node3D = m.heroi
	if h == null or not is_instance_valid(h):
		return
	# roupa e arma trocam a toda hora: marca de novo o que for do herói
	for vi in h.find_children("*", "VisualInstance3D", true, false):
		(vi as VisualInstance3D).layers |= CAMADA
	var b := h.global_transform.basis.orthonormalized()
	var cab := h.global_position + b.y * 1.45
	if m.heroi_esq != _esq:
		_esq = m.heroi_esq
		_cabeca = -1
		if _esq:
			for i in _esq.get_bone_count():
				var nb := _esq.get_bone_name(i).to_lower()
				if nb.ends_with("head") or nb == "cabeca":
					_cabeca = i
					break
	if _esq and is_instance_valid(_esq) and _cabeca >= 0:
		cab = _esq.global_transform * _esq.get_bone_global_pose(_cabeca).origin
	var frente := b.z # o modelo olha para +Z (o mesmo do retrato dos NPCs)
	cam.look_at_from_position(cab + frente * 0.75 + b.x * 0.12 + Vector3(0, 0.03, 0), cab - Vector3(0, 0.01, 0), Vector3.UP)
	vp.render_target_update_mode = SubViewport.UPDATE_ONCE

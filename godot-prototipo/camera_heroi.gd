extends RefCounted
# Câmera em volta do herói (saiu do main.gd). O que ela faz:
# - segue com mola amortecida (sem atraso duro) e um pouco à frente de onde o herói corre;
# - correndo sem mexer na câmera, gira devagar para trás das costas dele (não precisa ficar arrumando com o dedo);
# - giro do dedo suavizado (toque de celular chega aos trancos);
# - abre o campo de visão correndo e no dash (sensação de velocidade);
# - treme no golpe que acerta e afunda um pouco no pouso;
# - não atravessa parede (main.distancia_livre) e sobe por cima do ombro quando fica muito perto.

# ajuste aqui testando no celular
const SENS_GIRO := 0.006 # rad por pixel arrastado (lado)
const SENS_PITCH := 0.004 # rad por pixel arrastado (cima/baixo)
const SUAVE_DEDO := 22.0 # quanto o giro do dedo é suavizado (maior = mais direto)
const MOLA := 9.0 # rigidez da mola que segue o herói
const ANTECIPA := 0.22 # segundos de antecipação para onde ele corre
const SEGUE_APOS := 1.1 # s sem mexer na câmera para ela começar a ir para as costas
const SEGUE_VEL := 1.6 # rad/s máximos girando para as costas (na corrida)
const FOV_BASE := 52.0
const FOV_CORRIDA := 5.0 # graus a mais correndo
const FOV_DASH := 9.0 # graus a mais no dash

var cam: Camera3D
var m # main.gd
var yaw := 0.6
var pitch := 0.35
var dist := 5.2
var dist_cam := 5.2
var alvo := Vector3.ZERO
var _vel_alvo := Vector3.ZERO
var _giro_pend := Vector2.ZERO
var _sem_dedo := 9.0
var trauma := 0.0 # tremida (0 a 1); cai sozinha
var _afunda := 0.0
var _afunda_v := 0.0
var _t := 0.0
var _fov := FOV_BASE

func _init(principal, camera: Camera3D) -> void:
	m = principal
	cam = camera
	cam.fov = FOV_BASE

func colocar(p: Vector3) -> void:
	alvo = p + Vector3(0, 1.35, 0)
	_vel_alvo = Vector3.ZERO

func tremer(q: float) -> void:
	trauma = min(1.0, trauma + q)

func afundar(q: float) -> void:
	_afunda_v -= q * 1.6

# dt de verdade (sem câmera lenta do hitstop): a câmera não congela junto com o golpe
func atualizar(dt: float, giro: Vector2) -> void:
	_t += dt
	# dedo: acumula e solta aos poucos
	_giro_pend += giro
	var k: float = min(1.0, dt * SUAVE_DEDO)
	var usa := _giro_pend * k
	_giro_pend -= usa
	yaw -= usa.x * SENS_GIRO
	pitch = clamp(pitch + usa.y * SENS_PITCH, -0.3, 1.1)
	_sem_dedo = 0.0 if giro.length() > 0.5 else _sem_dedo + dt
	var mov = m.mov
	var vel: float = mov.velocidade()
	# correndo e sem mexer na câmera: vai para as costas do herói (mais forte quanto mais rápido)
	var j: Vector2 = m.hud.mover # só com o joystick para a frente (de lado ele daria voltas em círculo)
	if _sem_dedo > SEGUE_APOS and vel > 2.0 and mov.esc == null and m.acao.is_empty() and j.y < -0.45 and abs(j.x) < 0.6:
		var atras: float = mov.ry + PI
		var d: float = atan2(sin(atras - yaw), cos(atras - yaw))
		if abs(d) < 2.6: # andando para a câmera (de frente): não gira em volta dele
			var forca: float = clamp((vel - 2.0) / 3.4, 0.0, 1.0) * min(1.0, (_sem_dedo - SEGUE_APOS) / 0.8)
			yaw += clamp(d, -1.0, 1.0) * SEGUE_VEL * forca * dt
	# mola amortecida até o herói, um pouco à frente de onde ele vai
	var quer: Vector3 = m.heroi.position + Vector3(0, 1.35, 0) + Vector3(mov.vx, 0, mov.vz) * ANTECIPA
	var acel: Vector3 = (quer - alvo) * MOLA * MOLA - _vel_alvo * 2.0 * MOLA
	_vel_alvo += acel * dt
	alvo += _vel_alvo * dt
	if alvo.distance_to(quer) > 4.0: # teleporte ou renascer: vai direto
		alvo = quer
		_vel_alvo = Vector3.ZERO
	# afundar no pouso (mola rápida que volta)
	_afunda_v += (-_afunda * 120.0 - _afunda_v * 16.0) * dt
	_afunda += _afunda_v * dt
	var dir_cam := Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch))
	var foco_base := alvo + Vector3(0, _afunda, 0)
	var livre: float = m.distancia_livre(foco_base, dir_cam, dist)
	# bateu em parede, telhado, pedra ou tronco: chega perto na hora; volta devagar quando abre
	dist_cam = livre if livre < dist_cam else lerp(dist_cam, livre, min(1.0, dt * 2.5))
	# muito perto (parede atrás): sobe por cima do ombro esquerdo, para não ficar dentro do cabelo e do cajado
	var ombro: float = clamp((1.3 - dist_cam) / 0.7, 0.0, 1.0)
	var lado := Vector3(cos(yaw), 0, -sin(yaw))
	var foco := foco_base + Vector3(0, 0.62 * ombro, 0) - lado * 0.42 * ombro
	cam.position = foco + dir_cam * max(dist_cam, 0.6)
	cam.look_at(foco - Vector3(0, 0.25 * ombro, 0) + Vector3(-dir_cam.x, 0, -dir_cam.z) * 2.0 * ombro)
	# tremida: trauma² (golpe fraco quase não treme, forte treme bem), cai rápido
	if trauma > 0.0:
		var s: float = trauma * trauma
		var n1: float = sin(_t * 71.0) + sin(_t * 113.0) * 0.5
		var n2: float = sin(_t * 89.0 + 1.3) + sin(_t * 131.0) * 0.5
		var n3: float = sin(_t * 97.0 + 2.1)
		cam.rotate_object_local(Vector3.RIGHT, n1 * 0.012 * s)
		cam.rotate_object_local(Vector3.UP, n2 * 0.012 * s)
		cam.rotate_object_local(Vector3.FORWARD, n3 * 0.02 * s)
		trauma = max(0.0, trauma - dt * 2.2)
	# campo de visão: abre correndo e no dash
	var fov_alvo: float = FOV_BASE + FOV_CORRIDA * clamp((vel - 2.5) / 2.9, 0.0, 1.0)
	if mov.arrancada != null or (m.h.lunge != null and m.h.lunge.fantasma):
		fov_alvo = FOV_BASE + FOV_DASH
	_fov = lerp(_fov, fov_alvo, min(1.0, dt * (9.0 if fov_alvo > _fov else 3.0)))
	cam.fov = _fov

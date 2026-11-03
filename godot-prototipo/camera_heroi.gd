extends RefCounted
# Câmera em volta do herói (saiu do main.gd). O que ela faz:
# - segue com mola amortecida (sem atraso duro) e um pouco à frente de onde o herói corre;
# - correndo sem mexer na câmera, gira devagar para trás das costas dele (não precisa ficar arrumando com o dedo);
# - giro do dedo suavizado (toque de celular chega aos trancos);
# - abre o campo de visão correndo e no dash (sensação de velocidade);
# - treme no golpe que acerta e afunda um pouco no pouso;
# - não atravessa parede (main.distancia_livre) e sobe por cima do ombro quando fica muito perto.
# - André (2026-11-02): nunca vira primeira pessoa. A câmera
#   nunca chega mais perto que DIST_MIN (o "por cima do ombro" ficou guardado, mas não liga mais).
#   Minério não puxa a câmera; parede, árvore e poço ainda puxam, só até DIST_MIN.

# ajuste aqui testando no celular
const SENS_GIRO := 0.006 # rad por pixel arrastado (lado)
const SENS_PITCH := 0.004 # rad por pixel arrastado (cima/baixo)
const SUAVE_DEDO := 22.0 # quanto o giro do dedo é suavizado (maior = mais direto)
const MOLA := 9.0 # rigidez da mola que segue o herói
const ANTECIPA := 0.22 # segundos de antecipação para onde ele corre
const SEGUE_APOS := 1.1 # s sem mexer na câmera para ela começar a ir para as costas
const SEGUE_VEL := 1.6 # rad/s máximos girando para as costas (na corrida)
const FOV_BASE := 52.0
const DIST_MIN := 2.6 # m: mais perto que isso parecia primeira pessoa
const DIST_MAX := 12.0 # m: zoom mais longe (pinça com dois dedos)
# faixa do zoom de pinça (André 2026-11-03: estava grande demais; longe pesa no celular). A câmera começa em 5,2 m
const ZOOM_PERTO := 3.6 # m: o mais perto que a pinça chega (parede e árvore ainda puxam até DIST_MIN)
const ZOOM_LONGE := 8.0 # m: o mais longe que a pinça chega
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
# janela de um NPC aberta (conversa.gd): a câmera gira em 0,35 s para um 3/4 por cima do ombro
# (o NPC de frente no terço de cima à esquerda, a Ruiva de costas na borda) e volta ao fechar
const CONVERSA_T := 0.35
const CONVERSA_LADO := -0.62 # rad em volta do meio dos dois (lado do ombro)
const CONVERSA_PITCH := 0.32
const CONVERSA_DIST := 3.0
var _conversando := false
var _conv_k := 0.0
var _conv := {} # foco, yaw, pitch, dist do enquadramento
var _antes := {} # yaw, pitch e dist de antes de abrir

func olhar_conversa(heroi_pos: Vector3, npc_pos: Vector3) -> void:
	if not _conversando and _conv_k <= 0.0:
		_antes = {"yaw": yaw, "pitch": pitch, "dist": dist}
	_conversando = true
	var d := Vector3(heroi_pos.x - npc_pos.x, 0, heroi_pos.z - npc_pos.z).normalized()
	_conv = {"foco": heroi_pos.lerp(npc_pos, 0.55) + Vector3(0, 0.95, 0), "yaw": atan2(d.x, d.z) + CONVERSA_LADO, "pitch": CONVERSA_PITCH, "dist": CONVERSA_DIST}

# zoom (André 2026-11-03, volta do jogo HTML): fator > 1 afasta, < 1 aproxima; nunca mais perto que DIST_MIN
func zoom(fator: float) -> void:
	if is_equal_approx(fator, 1.0) or _conversando or _conv_k > 0.0:
		return
	dist = clamp(dist * fator, max(DIST_MIN, ZOOM_PERTO), min(DIST_MAX, ZOOM_LONGE))

func soltar_conversa() -> void:
	_conversando = false

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
	# em passos de no máximo 1/60 s: num quadro lento (engasgo do celular) a mola dura não explode e joga a câmera
	# para dentro do chão ou da pedra
	var resta := dt
	while resta > 0.0:
		var h: float = min(resta, 1.0 / 60.0)
		resta -= h
		var acel: Vector3 = (quer - alvo) * MOLA * MOLA - _vel_alvo * 2.0 * MOLA
		_vel_alvo += acel * h
		alvo += _vel_alvo * h
	if alvo.distance_to(quer) > 4.0: # teleporte ou renascer: vai direto
		alvo = quer
		_vel_alvo = Vector3.ZERO
	# afundar no pouso (mola rápida que volta)
	resta = dt
	while resta > 0.0:
		var h: float = min(resta, 1.0 / 60.0)
		resta -= h
		_afunda_v += (-_afunda * 120.0 - _afunda_v * 16.0) * h
		_afunda += _afunda_v * h
	# enquadramento da conversa com NPC (vai e volta em CONVERSA_T)
	_conv_k = move_toward(_conv_k, 1.0 if _conversando else 0.0, dt / CONVERSA_T)
	if _conv_k > 0.0 and not _conv.is_empty():
		var s: float = smoothstep(0.0, 1.0, _conv_k)
		yaw = lerp_angle(float(_antes.yaw), float(_conv.yaw), s)
		pitch = lerp(float(_antes.pitch), float(_conv.pitch), s)
		dist = lerp(float(_antes.dist), float(_conv.dist), s)
		alvo = alvo.lerp(_conv.foco, s)
		_vel_alvo = Vector3.ZERO
	var dir_cam := Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch))
	var foco_base := alvo + Vector3(0, _afunda, 0)
	var livre: float = max(DIST_MIN, m.distancia_livre(foco_base, dir_cam, dist, true))
	# bateu em parede, telhado, pedra ou tronco: chega perto na hora; volta devagar quando abre
	dist_cam = livre if livre < dist_cam else lerp(dist_cam, livre, min(1.0, dt * 2.5))
	# muito perto (parede atrás): sobe por cima do ombro esquerdo, para não ficar dentro do cabelo e do cajado
	var ombro: float = clamp((1.3 - dist_cam) / 0.7, 0.0, 1.0)
	var lado := Vector3(cos(yaw), 0, -sin(yaw))
	var foco := foco_base + Vector3(0, 0.62 * ombro, 0) - lado * 0.42 * ombro
	cam.position = foco + dir_cam * max(dist_cam, 0.6)
	# conversa: a câmera vai 0,4 m para a direita e 0,2 m para cima, olhando para o mesmo ponto
	# (a Ruiva e o cajado das costas saem pela borda; o NPC fica onde estava)
	if _conv_k > 0.0:
		cam.position += (lado * 0.4 + Vector3(0, 0.2, 0)) * smoothstep(0.0, 1.0, _conv_k)
	# encostada na parede/chão: não entra no chão (sobe um pouco por cima)
	var chao_cam: float = m.terreno.altura(cam.position.x, cam.position.z, cam.position.y + 1.5) + 0.3
	if cam.position.y < chao_cam and chao_cam - cam.position.y < 2.5:
		cam.position.y = chao_cam
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

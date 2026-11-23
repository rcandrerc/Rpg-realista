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
# pilotando o navio (André 2026-11-21: "a câmera na distância máx ainda está muito próxima"): a pinça e o atalho vão
# até NAVIO_LONGE. Desceu do leme: a câmera volta sozinha para o limite de sempre
const NAVIO_LONGE := 24.0
func _no_leme() -> bool:
	return m != null and m.mov != null and str(m.mov.veiculo.get("k", "")) == "navio"
func _longe_max() -> float:
	return NAVIO_LONGE if _no_leme() else ZOOM_LONGE
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
# Travar câmera (André 2026-11-14: "a câmera travada nas costas do personagem, para quando eu virar à direita ficar
# sempre com a visão nas costas"): chave em Configurações, com ou sem a voz. Andando, a câmera volta sozinha para trás
# do herói. A voz vira o herói em 90° (virar): o giro anda aos poucos e a câmera vai junto.
const TRAVA_VEL := 5.0 # quão rápido volta para as costas
const VIRAR_VEL := 3.5 # rad/s do giro pedido pela voz
var giro_voz := 0.0 # giro que falta (rad)
func travada() -> bool: # nas costas (o jeito de 2026-11-14, ficou como opção "Costas")
	return m.menu_topo != null and m.menu_topo.camera_travada and m.menu_topo.camera_tipo == "costas"

# Visão do alto (André 2026-11-15, "travar visão isométrica", "estilo Albion Online", "só quando eu travar"): com
# Travar câmera ligado e a visão "Do alto", a câmera fica alta, inclinada e afastada, sem girar (o dedo não gira; o
# joystick anda sempre igual na tela), com o herói no meio. Destravada, volta a ser livre 360 como antes.
# Olhando de cima não aparece o horizonte: entra menos coisa longe na tela. A sombra passa a contar a partir do herói
# (a câmera está ~13 m longe dele), por isso o alcance dela soma ISO_SOMBRA.
const ISO_YAW := PI * 0.25 # fixo (45°): a tela não gira
const ISO_PITCH := 0.87 # rad (~50° olhando para baixo)
const ISO_DIST := 13.0 # m até o herói
const ISO_PERTO := 10.0 # pinça no modo do alto
const ISO_LONGE := 17.0
const ISO_FOV := 46.0 # um pouco mais fechado: menos deformação nas bordas, cara de isométrica
const ISO_SOMBRA := 10.0 # m somados ao alcance da sombra do nível de gráficos
const ISO_VEL := 3.0 # quão rápido entra e sai da visão do alto
var dist_iso := ISO_DIST
var _iso_k := 0.0 # 0 = câmera normal, 1 = do alto
var _sombra_iso := -1.0
func iso() -> bool:
	return m.menu_topo != null and m.menu_topo.camera_travada and m.menu_topo.camera_tipo == "iso"

func _iso_ativa() -> bool:
	return iso() and not _conversando and _conv_k <= 0.0 and foco_livre == null

func virar(a: float) -> void:
	giro_voz += a
var _sem_dedo := 9.0
const SUBMERSO := 0.45 # m de mergulho a partir do qual a cabeça do herói está debaixo d'água
var trauma := 0.0 # tremida (0 a 1); cai sozinha
var _afunda := 0.0
var _afunda_v := 0.0
var _t := 0.0
var _fov := FOV_BASE
var soco := 0.0 # festa.gd (subiu de nível, missão): o campo de visão fecha uns graus e volta, um "soco" leve na câmera
# montado no lobo (direção de arte 2026-11-03): a câmera sobe 0,4 m e se afasta 1 m, para o lobo não tapar a estrada
const MONTADO_SOBE := 0.4
const MONTADO_AFASTA := 1.0
var _montado_k := 0.0
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
# câmera flutuante do modo construção e da compra de terreno (construcao.gd, como no Quimera): segue a mira em vez do
# herói, mais alta e mais longe; o joystick move a mira. Ao sair volta para o herói com o enquadramento de antes.
const LIVRE_PITCH := 0.82
const LIVRE_DIST := 10.5
const LIVRE_LONGE := 18.0 # m: o mais longe que a pinça chega no modo livre
var foco_livre = null # Vector3 ou null
var espiar = null # Node3D do recruta que o painel do clã mandou ver (espiar.gd), ou null
var _antes_livre := {}

func entrar_livre(p: Vector3) -> void:
	if foco_livre == null:
		_antes_livre = {"pitch": pitch, "dist": dist}
		pitch = LIVRE_PITCH
		dist = LIVRE_DIST
	foco_livre = p

func sair_livre() -> void:
	if foco_livre == null:
		return
	foco_livre = null
	pitch = float(_antes_livre.get("pitch", pitch))
	dist = float(_antes_livre.get("dist", dist))
	_antes_livre["voltando"] = true # volta deslizando até o herói (sem pulo)

func olhar_conversa(heroi_pos: Vector3, npc_pos: Vector3) -> void:
	if _dist_alvo >= 0.0: # atalho do zoom andando: termina na hora (a conversa guarda a distância final)
		dist = _dist_alvo
		_dist_alvo = -1.0
	if not _conversando and _conv_k <= 0.0:
		_antes = {"yaw": yaw, "pitch": pitch, "dist": dist}
	_conversando = true
	var d := Vector3(heroi_pos.x - npc_pos.x, 0, heroi_pos.z - npc_pos.z).normalized()
	_conv = {"foco": heroi_pos.lerp(npc_pos, 0.55) + Vector3(0, 0.95, 0), "yaw": atan2(d.x, d.z) + CONVERSA_LADO, "pitch": CONVERSA_PITCH, "dist": CONVERSA_DIST}

# zoom (André 2026-11-03, volta do jogo HTML): fator > 1 afasta, < 1 aproxima; nunca mais perto que DIST_MIN
func zoom(fator: float) -> void:
	if is_equal_approx(fator, 1.0) or _conversando or _conv_k > 0.0:
		return
	_dist_alvo = -1.0 # a pinça manda: o atalho para onde está
	if _iso_ativa():
		dist_iso = clamp(dist_iso * fator, ISO_PERTO, ISO_LONGE)
		return
	if foco_livre != null: # câmera flutuante do modo construção: afasta mais para ver o terreno inteiro
		dist = clamp(dist * fator, max(DIST_MIN, ZOOM_PERTO), LIVRE_LONGE)
		return
	if _no_leme(): # pilotando o navio: vai mais longe
		dist = clamp(dist * fator, max(DIST_MIN, ZOOM_PERTO), NAVIO_LONGE)
		return
	dist = clamp(dist * fator, max(DIST_MIN, ZOOM_PERTO), min(DIST_MAX, ZOOM_LONGE))

# atalho do zoom (André 2026-11-12: "no combate quero afastar a tela ao máximo, rápido, com um toque só"): um toque
# vai em ~0,3 s para o mais longe da pinça (ZOOM_LONGE); outro toque volta para onde estava. Só mexe na distância
# (nada novo para desenhar além do que a pinça já mostra).
const ZOOM_RAPIDO := 14.0 # quão rápido a distância anda no atalho (maior = mais rápido)
const DIST_PADRAO := 5.2 # onde a câmera começa
var _dist_alvo := -1.0 # < 0 = atalho parado
var _dist_volta := DIST_PADRAO # onde estava antes de afastar
var _rapido_t := 0.0 # s em que a câmera acompanha a distância nova sem a volta lenta de depois da parede

func longe() -> bool:
	if _iso_ativa():
		return dist_iso >= ISO_LONGE - 0.05
	return (_dist_alvo if _dist_alvo >= 0.0 else dist) >= _longe_max() - 0.05

func zoom_maximo() -> void:
	if _conversando or _conv_k > 0.0 or foco_livre != null:
		return
	if _iso_ativa(): # do alto: o atalho alterna entre o padrão e o mais longe da pinça
		dist_iso = ISO_DIST if dist_iso >= ISO_LONGE - 0.05 else ISO_LONGE
		_rapido_t = 0.6
		return
	var perto_min: float = max(DIST_MIN, ZOOM_PERTO)
	if not longe():
		_dist_volta = _dist_alvo if _dist_alvo >= 0.0 else dist
		_dist_alvo = _longe_max()
	else: # já está longe: volta (se chegou longe pela pinça, volta para a distância de começo)
		_dist_alvo = clamp(_dist_volta, perto_min, ZOOM_LONGE)
		if _dist_alvo >= ZOOM_LONGE - 0.05:
			_dist_alvo = DIST_PADRAO
	_rapido_t = 0.6

func soltar_conversa() -> void:
	_conversando = false

func _init(principal, camera: Camera3D) -> void:
	m = principal
	cam = camera
	cam.fov = FOV_BASE

func colocar(p: Vector3) -> void:
	alvo = p + Vector3(0, 1.35, 0)
	_vel_alvo = Vector3.ZERO

func socar(graus: float) -> void:
	soco = max(soco, graus)

func tremer(q: float) -> void:
	trauma = min(1.0, trauma + q)

func afundar(q: float) -> void:
	_afunda_v -= q * 1.6

# dt de verdade (sem câmera lenta do hitstop): a câmera não congela junto com o golpe
var _livre_v := 0.0
var _livre_foco := Vector3(INF, INF, INF)
var _livre_dir := Vector3.ZERO
var _livre_ate := 0.0
var _livre_t := 0.0

func atualizar(dt: float, giro: Vector2) -> void:
	_t += dt
	# dedo: acumula e solta aos poucos
	var do_alto := _iso_ativa()
	_iso_k = move_toward(_iso_k, 1.0 if do_alto else 0.0, dt * ISO_VEL)
	_giro_pend += giro
	var k: float = min(1.0, dt * SUAVE_DEDO)
	var usa := _giro_pend * k
	_giro_pend -= usa
	if do_alto: # do alto o dedo não gira: a câmera vai e fica no ângulo fixo (o joystick usa este yaw)
		usa = Vector2.ZERO
		giro_voz = 0.0
		yaw = lerp_angle(yaw, ISO_YAW, min(1.0, dt * ISO_VEL * 2.0))
	yaw -= usa.x * SENS_GIRO
	pitch = clamp(pitch + usa.y * SENS_PITCH, -0.3, 1.1)
	_sem_dedo = 0.0 if giro.length() > 0.5 else _sem_dedo + dt
	var mov = m.mov
	var vel: float = mov.velocidade()
	_montado_k = move_toward(_montado_k, 1.0 if m.montaria != null else 0.0, dt * 2.0)
	# correndo e sem mexer na câmera: vai para as costas do herói (mais forte quanto mais rápido)
	var j: Vector2 = m.hud.mover # só com o joystick para a frente (de lado ele daria voltas em círculo)
	if giro_voz != 0.0:
		var passo: float = sign(giro_voz) * min(abs(giro_voz), VIRAR_VEL * dt)
		yaw += passo
		giro_voz -= passo
	elif travada() and not _conversando and foco_livre == null and vel > 0.5 and not m.heroi_anim.mirando and _sem_dedo > 0.6:
		yaw = lerp_angle(yaw, mov.ry + PI, min(1.0, dt * TRAVA_VEL))
	# virado para o alvo (mirando, andando de lado): a câmera não persegue o giro do corpo (tremia entre alvo e caminho)
	if not do_alto and _iso_k <= 0.0 and _sem_dedo > SEGUE_APOS and vel > 2.0 and mov.esc == null and m.acao.is_empty() and not m.heroi_anim.mirando and j.y < -0.45 and abs(j.x) < 0.6:
		var atras: float = mov.ry + PI
		var d: float = atan2(sin(atras - yaw), cos(atras - yaw))
		if abs(d) < 2.6: # andando para a câmera (de frente): não gira em volta dele
			var forca: float = clamp((vel - 2.0) / 3.4, 0.0, 1.0) * min(1.0, (_sem_dedo - SEGUE_APOS) / 0.8)
			yaw += clamp(d, -1.0, 1.0) * SEGUE_VEL * forca * dt
	# mola amortecida até o herói, um pouco à frente de onde ele vai
	var quer: Vector3 = m.heroi.position + Vector3(0, 1.35 + MONTADO_SOBE * _montado_k, 0) + Vector3(mov.vx, 0, mov.vz) * ANTECIPA
	if foco_livre != null:
		quer = foco_livre + Vector3(0, 0.4, 0)
	elif espiar is Node3D and is_instance_valid(espiar): # "Ver" o recruta (espiar.gd): só olha, o herói fica onde está
		quer = espiar.position + Vector3(0, 1.35, 0)
	# em passos de no máximo 1/60 s: num quadro lento (engasgo do celular) a mola dura não explode e joga a câmera
	# para dentro do chão ou da pedra
	var resta := dt
	while resta > 0.0:
		var h: float = min(resta, 1.0 / 60.0)
		resta -= h
		var acel: Vector3 = (quer - alvo) * MOLA * MOLA - _vel_alvo * 2.0 * MOLA
		_vel_alvo += acel * h
		alvo += _vel_alvo * h
	if alvo.distance_to(quer) > 4.0 and foco_livre == null and not _antes_livre.get("voltando", false): # teleporte ou renascer: vai direto
		alvo = quer
		_vel_alvo = Vector3.ZERO
	if _antes_livre.get("voltando", false) and alvo.distance_to(quer) < 0.6:
		_antes_livre["voltando"] = false
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
	# saiu do leme com a câmera mais longe que o limite a pé: volta deslizando para ZOOM_LONGE
	if _dist_alvo < 0.0 and dist > ZOOM_LONGE + 0.05 and foco_livre == null and not _conversando and _conv_k <= 0.0 and not _no_leme():
		_dist_alvo = ZOOM_LONGE
		_rapido_t = 0.6
	# atalho do zoom: a distância desliza rápida até o alvo
	if _dist_alvo >= 0.0:
		dist = lerp(dist, _dist_alvo, 1.0 - exp(-ZOOM_RAPIDO * dt))
		if absf(dist - _dist_alvo) < 0.02:
			dist = _dist_alvo
			_dist_alvo = -1.0
	_rapido_t = maxf(0.0, _rapido_t - dt)
	var s_iso: float = smoothstep(0.0, 1.0, _iso_k)
	var pitch_v: float = lerpf(pitch, ISO_PITCH, s_iso)
	var dist_v: float = lerpf(dist, dist_iso, s_iso)
	var dir_cam := Vector3(sin(yaw) * cos(pitch_v), sin(pitch_v), cos(yaw) * cos(pitch_v))
	var foco_base := alvo + Vector3(0, _afunda, 0)
	# FPS (auditoria 2026-11-11): a conta de parede (passos ao longo da linha da câmera) só é refeita quando o foco,
	# a direção ou a distância mudaram, ou a cada 0,25 s (árvore caiu, parede nova); parado, ela custava todo quadro
	var ate_l: float = dist_v + MONTADO_AFASTA * _montado_k
	_livre_t -= dt
	if _livre_t <= 0.0 or foco_base.distance_squared_to(_livre_foco) > 0.0001 or dir_cam.dot(_livre_dir) < 0.99999 or absf(ate_l - _livre_ate) > 0.005:
		_livre_v = m.distancia_livre(foco_base, dir_cam, ate_l, true)
		_livre_foco = foco_base
		_livre_dir = dir_cam
		_livre_ate = ate_l
		_livre_t = 0.25
	var livre: float = max(DIST_MIN, _livre_v)
	if s_iso > 0.0: # do alto a linha até a câmera passa por copas e telhados: não puxa (como no Albion)
		livre = lerpf(livre, ate_l, s_iso)
	# bateu em parede, telhado, pedra ou tronco: chega perto na hora; volta devagar quando abre
	# (no atalho do zoom ela acompanha rápido: afastar ao máximo leva ~0,3 s, não 1 s)
	dist_cam = livre if livre < dist_cam else lerp(dist_cam, livre, min(1.0, dt * (ZOOM_RAPIDO if _rapido_t > 0.0 else 2.5)))
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
	# mergulhado (André 2026-11-07): o "chão" do lago fundo é a linha de boiar; a câmera desce até o leito de verdade
	var submerso: bool = m.mov.mergulho > SUBMERSO and m.terreno.agua_no_corpo(cam.position.x, cam.position.z, -9.0) > 0.0 # câmera em cima do lago
	if submerso:
		chao_cam = minf(chao_cam, m.terreno.relevo(cam.position.x, cam.position.z) + 0.3)
	if cam.position.y < chao_cam and chao_cam - cam.position.y < 2.5:
		cam.position.y = chao_cam
	# na água a câmera nunca fica cortada pela superfície: com a cabeça do herói debaixo d'água ela desce junto e fica
	# atrás dele, dentro da água (submerso.gd pinta o lado de dentro); boiando ou nadando em cima, fica acima da água
	var nivel := float(m.terreno.agua.nivel)
	var leito: float = m.terreno.relevo(cam.position.x, cam.position.z) + 0.3
	if submerso and leito < nivel - 0.2:
		cam.position.y = clampf(cam.position.y, leito, nivel - 0.2)
	elif submerso: # raso demais para caber a câmera: fica acima da água
		cam.position.y = maxf(cam.position.y, nivel + 0.35)
	elif m.terreno.agua_no_corpo(cam.position.x, cam.position.z, cam.position.y - 0.35) > 0.0:
		cam.position.y = nivel + 0.35
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
	cam.fov = lerpf(_fov, ISO_FOV, s_iso) - soco
	# relevo.gd: a altura que a visão do alto ganhou não conta como "vista do alto da montanha" (névoa, copas de longe)
	var sobe_iso: float = maxf(0.0, (cam.position.y - foco_base.y) - sin(0.35) * minf(dist_cam, ZOOM_LONGE)) if s_iso > 0.0 else 0.0
	if absf(float(cam.get_meta("sobe_iso", 0.0)) - sobe_iso) > 0.01:
		cam.set_meta("sobe_iso", sobe_iso)
	_sombra_alto(s_iso)
	soco = move_toward(soco, 0.0, dt * max(4.0, soco * 3.0))

# do alto a câmera fica longe do herói: a sombra (que conta a partir da câmera) ganha ISO_SOMBRA m para cobrir a tela
func _sombra_alto(s_iso: float) -> void:
	if m.sol == null or not m.sol.shadow_enabled:
		return
	var base: float = 20.0
	if m.grafico != null and m.grafico.P != null:
		base = float(m.grafico.P.sombra_dist)
	var quer: float = base + ISO_SOMBRA * s_iso
	if s_iso <= 0.0 and _sombra_iso < 0.0:
		return # nunca entrou no modo do alto: não mexe (grafico.gd manda)
	if absf(m.sol.directional_shadow_max_distance - quer) > 0.05:
		m.sol.directional_shadow_max_distance = quer
	_sombra_iso = quer if s_iso > 0.0 else -1.0

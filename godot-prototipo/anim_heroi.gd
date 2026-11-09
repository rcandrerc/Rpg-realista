extends RefCounted
# Animação do herói com AnimationTree (antes era só o AnimationPlayer trocando de animação):
# - locomoção misturada pela velocidade de verdade: parada -> andar -> corrida, sem pulo entre elas, e as duas
#   no mesmo ritmo de passo enquanto misturam;
# - ações (golpe, magia, pulo, escalada...) por cima, com mistura de uma para a outra (dois "lugares", A e B);
# - ação só no tronco: o tiro do cajado anda junto e as pernas continuam correndo (antes as pernas ficavam paradas
#   e o corpo deslizava).
# Tem a mesma cara do AnimationPlayer (play, current_animation, seek, has_animation, get_animation) para o resto
# do código não mudar.

const LOCO := ["parada", "espada_parada", "andar", "trote", "corrida"]
const ANDAR := 1.8
const CORRIDA := 5.4
const PASSO_ANDAR := 1.15
const PASSO_CORRIDA := 4.0
# trote (Mixamo Jogging, 3 passadas por volta): passada curta e ritmo mais rápido que a corrida em câmera lenta
const TROTE := CORRIDA * 0.7
const PASSO_TROTE := 2.6 # metros por passada inteira (dois pés): no trote dá ~0,69 s por passada
const TROTE_CICLOS := 3.0

var player: AnimationPlayer
var tree: AnimationTree
var current_animation := ""
var _slot := 0
var _nos := [] # AnimationNodeAnimation dos lugares A e B
var _ab := 0.0 # 0 = lugar A, 1 = lugar B
var _ab_alvo := 0.0
var _ab_vel := 10.0
var _corpo := 0.0 # quanto a ação manda no corpo todo (0 = locomoção)
var _corpo_alvo := 0.0
var _corpo_vel := 10.0
var _tronco := 0.0 # quanto a ação manda no tronco por cima da locomoção
var _tronco_alvo := 0.0
var _idle := 1.0 # 0 = parada (cajado), 1 = guarda de espada
var _idle_alvo := 1.0
# guarda do cajado (André 2026-11-04: com o cajado ficava reto, sem base): parado no modo magia, a "parada" vira a
# postura de mago do Mixamo Pro Magic Pack. Quem chama liga guarda_cajado; montado ou sem a animação fica a parada.
var tem_guarda_cajado := false
var guarda_cajado := false
# postura de luta só em combate (André 2026-11-06: "até o posicionamento de livre em combate deveria ser diferente"):
# fora de combate a guarda da espada vira a parada relaxada; quem chama (main.gd) desliga. true = como era antes.
var em_guarda := true
# parada solta (André 2026-11-09: "uma pose mais legalzinha quando fica parado, mas não retão"): fora de combate a
# parada vira parada_solta (peso numa perna, joelho solto, mão livre na cintura, quadril balançando devagar). Em
# combate volta para a parada/guarda de sempre. Corpo exportado antes, sem a animação, fica com a parada.
var tem_solta := false
var pode_soltar := true # quem chama desliga montado, sentado, escalando, nadando, coletando ou pescando
var _solta := 0.0
var _gcaj := 0.0
var _mexe := 0.0 # 0 = parado, 1 = andando/correndo
var _corre := 0.0 # 0 = andar, 1 = corrida
var _rapido := 0.0 # com o trote: 0 = trote, 1 = corrida (o _corre vai de andar ao trote)
var tem_trote := false
var _len_trote := 1.0
var so_tronco := false # a ação de agora pode tocar só no tronco quando o herói anda
var _len_andar := 1.0
var _len_corrida := 1.0
var _ts := 1.0 # velocidade pedida para a ação de agora
var _tem_arrancada := false
const ARR_INICIO := 0.35 # s: antes disso a animação do Mixamo está parada na pose do fuzil (quadril torto)
var _pernas := 0.0 # quanto as pernas da arrancada mandam (0 = locomoção)
var _pernas_alvo := 0.0
var arrancando := 0.0 # segundos de animação da arrancada já tocados (0 = parada)
var _arr_ritmo := 1.0
# Mago atirando virado para o alvo (pedido do André 2026-11-04): as pernas andam para onde o joystick manda,
# de lado (esquerda/direita) e de costas, com as animações do Mixamo Pro Magic Pack. Fora disso fica igual.
const LADO_ANIMS := ["lado_e_andar", "lado_d_andar", "tras_andar", "lado_e_correr", "lado_d_correr", "tras_correr"]
var tem_lado := false
var mirando := false # quem chama liga quando o corpo está virado para o alvo e as pernas andam para outro lado
var dir_local := Vector2(0, 1) # para onde anda, visto pelo corpo: x = esquerda (+) / direita (-), y = frente (+) / trás (-)
var _lado := 0.0 # quanto a parte de lado manda (0 = frente/costas, 1 = de lado)
var _tras := 0.0 # 0 = frente (andar/trote/corrida), 1 = de costas
var _lr := 0.0 # 0 = esquerda, 1 = direita
var _len_lado := {}
# corridinha leve (André 2026-11-04: o passo de lado estava "muito calmo"): atirando, as pernas usam o trote e as
# corridas de lado/costas com passada curta e ritmo rápido, mesmo na velocidade de quem atira
const PASSO_LEVE := 1.6 # metros por passada inteira: a 2,3 m/s dá ~0,7 s, o mesmo ritmo do trote
var _leve := 0.0
# Nado (André 2026-11-06): no lago fundo a locomoção vira boiar (Mixamo Treading Water) parado e nadar (Swimming)
# andando. As ações (golpe, magia, saída da água) continuam por cima. Quem chama liga "nadando".
const NADO_VOLTA := 5.5 # metros por volta inteira do Swimming (4,5 s): a 1,7 m/s (AGUA.nado) toca a 1,4x
var tem_nado := false
var nadando := false
var _nado := 0.0 # 0 = locomoção de terra, 1 = na água
var _nada := 0.0 # 0 = boiando, 1 = nadando
var _len_nadar := 1.0
var voltas_nado := 0.0 # voltas por segundo do Swimming agora (agua_fx.gd: respingo a cada braçada)

func _init(p: AnimationPlayer) -> void:
	player = p
	player.stop()
	player.active = false
	_len_andar = player.get_animation("andar").length
	_len_corrida = player.get_animation("corrida").length
	tem_trote = player.has_animation("trote") # corpo sem a animação (exportado antes) continua com andar -> corrida
	if tem_trote:
		_len_trote = player.get_animation("trote").length
	tree = AnimationTree.new()
	tree.name = "ArvoreAnim"
	player.get_parent().add_child(tree)
	tree.root_node = tree.get_path_to(player.get_node(player.root_node))
	tree.anim_player = tree.get_path_to(player)
	var bt := AnimationNodeBlendTree.new()
	var anim := func(nome: String, n: String, pos: Vector2) -> AnimationNodeAnimation:
		var a := AnimationNodeAnimation.new()
		a.animation = nome
		bt.add_node(n, a, pos)
		return a
	anim.call("parada", "parada", Vector2(0, 0))
	anim.call("espada_parada", "espada", Vector2(0, 120))
	var parada_no := "parada"
	tem_solta = player.has_animation("parada_solta")
	if tem_solta:
		anim.call("parada_solta", "parada_solta", Vector2(-150, 60))
		bt.add_node("solta", AnimationNodeBlend2.new(), Vector2(60, 30))
		bt.connect_node("solta", 0, "parada")
		bt.connect_node("solta", 1, "parada_solta")
		parada_no = "solta"
	var idle := AnimationNodeBlend2.new()
	bt.add_node("idle", idle, Vector2(200, 60))
	tem_guarda_cajado = player.has_animation("cajado_parada")
	if tem_guarda_cajado:
		anim.call("cajado_parada", "cajado", Vector2(0, -120))
		# o braço do cajado fica com o da parada (mão na altura do quadril, ponteira perto do chão); o resto do corpo
		# vai para a guarda (direção de arte 2026-11-04). Na guarda do Mixamo o braço sobe até o ombro.
		var gc := AnimationNodeBlend2.new()
		gc.filter_enabled = true
		var braco := ["J_Bip_R_Shoulder", "J_Bip_R_UpperArm", "J_Bip_R_LowerArm", "J_Bip_R_Hand"]
		var ref_g: Animation = player.get_animation("cajado_parada")
		for t in ref_g.get_track_count():
			var cam := ref_g.track_get_path(t)
			var osso := str(cam.get_subname(0)) if cam.get_subname_count() > 0 else ""
			if not (osso in braco or osso.begins_with("J_Bip_R_Thumb") or osso.begins_with("J_Bip_R_Index")
					or osso.begins_with("J_Bip_R_Middle") or osso.begins_with("J_Bip_R_Ring") or osso.begins_with("J_Bip_R_Little")):
				gc.set_filter_path(cam, true)
		bt.add_node("idle_caj", gc, Vector2(120, -60))
		bt.connect_node("idle_caj", 0, parada_no)
		bt.connect_node("idle_caj", 1, "cajado")
		bt.connect_node("idle", 0, "idle_caj")
	else:
		bt.connect_node("idle", 0, parada_no)
	bt.connect_node("idle", 1, "espada")
	anim.call("andar", "andar", Vector2(0, 260))
	anim.call("corrida", "corrida", Vector2(0, 380))
	bt.add_node("ts_andar", AnimationNodeTimeScale.new(), Vector2(150, 260))
	bt.add_node("ts_corrida", AnimationNodeTimeScale.new(), Vector2(150, 380))
	bt.connect_node("ts_andar", 0, "andar")
	bt.connect_node("ts_corrida", 0, "corrida")
	var passo := AnimationNodeBlend2.new()
	passo.sync = true # as duas andam juntas (mesmo ritmo), mesmo com peso zero
	bt.add_node("passo", passo, Vector2(320, 320))
	bt.connect_node("passo", 0, "ts_andar")
	if tem_trote:
		# andar -> (trote -> corrida): o trote fica no meio e a corrida do botão continua a mesma
		anim.call("trote", "trote", Vector2(0, 440))
		bt.add_node("ts_trote", AnimationNodeTimeScale.new(), Vector2(150, 440))
		bt.connect_node("ts_trote", 0, "trote")
		var rapido := AnimationNodeBlend2.new()
		rapido.sync = true
		bt.add_node("rapido", rapido, Vector2(260, 420))
		bt.connect_node("rapido", 0, "ts_trote")
		bt.connect_node("rapido", 1, "ts_corrida")
		bt.connect_node("passo", 1, "rapido")
	else:
		bt.connect_node("passo", 1, "ts_corrida")
	bt.add_node("mexe", AnimationNodeBlend2.new(), Vector2(480, 180))
	bt.connect_node("mexe", 0, "idle")
	tem_lado = LADO_ANIMS.all(func(n): return player.has_animation(n))
	if tem_lado:
		# andar de lado e de costas: cada direção mistura o andar e a corrida dela no mesmo ritmo da frente;
		# "costas" troca a frente pelas costas e "lado" põe a esquerda/direita por cima (na diagonal, metade de cada)
		var y0 := 1500
		for dirn in ["lado_e", "lado_d", "tras"]:
			for vel in ["andar", "correr"]:
				var nome: String = dirn + "_" + vel
				anim.call(nome, "a_" + nome, Vector2(0, y0))
				bt.add_node("ts_" + nome, AnimationNodeTimeScale.new(), Vector2(150, y0))
				bt.connect_node("ts_" + nome, 0, "a_" + nome)
				_len_lado[nome] = player.get_animation(nome).length
				y0 += 110
			var b := AnimationNodeBlend2.new()
			b.sync = true
			bt.add_node("v_" + dirn, b, Vector2(320, y0 - 160))
			bt.connect_node("v_" + dirn, 0, "ts_" + dirn + "_andar")
			bt.connect_node("v_" + dirn, 1, "ts_" + dirn + "_correr")
		var lr := AnimationNodeBlend2.new()
		lr.sync = true
		bt.add_node("lado_lr", lr, Vector2(480, 1560))
		bt.connect_node("lado_lr", 0, "v_lado_e")
		bt.connect_node("lado_lr", 1, "v_lado_d")
		var ft := AnimationNodeBlend2.new()
		ft.sync = true
		bt.add_node("frente_tras", ft, Vector2(480, 1400))
		bt.connect_node("frente_tras", 0, "passo")
		bt.connect_node("frente_tras", 1, "v_tras")
		var ld := AnimationNodeBlend2.new()
		ld.sync = true
		bt.add_node("lado", ld, Vector2(640, 1450))
		bt.connect_node("lado", 0, "frente_tras")
		bt.connect_node("lado", 1, "lado_lr")
		bt.connect_node("mexe", 1, "lado")
	else:
		bt.connect_node("mexe", 1, "passo")
	# lugares A e B das ações; cada um em dobro (corpo todo e só tronco), porque no BlendTree a saída de um nó
	# só pode ligar em um lugar. Os dois tocam a mesma animação, no mesmo tempo.
	for parte in ["", "u"]:
		for i in 2:
			var y := 520 + i * 140 + (300 if parte == "u" else 0)
			var a: AnimationNodeAnimation = anim.call("parada", "a%s%d" % [parte, i], Vector2(0, y))
			_nos.append(a)
			bt.add_node("ts%s%d" % [parte, i], AnimationNodeTimeScale.new(), Vector2(150, y))
			bt.add_node("seek%s%d" % [parte, i], AnimationNodeTimeSeek.new(), Vector2(300, y))
			bt.connect_node("ts%s%d" % [parte, i], 0, "a%s%d" % [parte, i])
			bt.connect_node("seek%s%d" % [parte, i], 0, "ts%s%d" % [parte, i])
		bt.add_node("ab" + parte, AnimationNodeBlend2.new(), Vector2(480, 580 + (300 if parte == "u" else 0)))
		bt.connect_node("ab" + parte, 0, "seek%s0" % parte)
		bt.connect_node("ab" + parte, 1, "seek%s1" % parte)
	bt.add_node("corpo", AnimationNodeBlend2.new(), Vector2(660, 300))
	tem_nado = player.has_animation("nadar") and player.has_animation("boiar")
	if tem_nado:
		anim.call("boiar", "boiar", Vector2(0, 2300))
		anim.call("nadar", "nadar", Vector2(0, 2420))
		_len_nadar = player.get_animation("nadar").length
		bt.add_node("ts_nadar", AnimationNodeTimeScale.new(), Vector2(150, 2420))
		bt.connect_node("ts_nadar", 0, "nadar")
		bt.add_node("nada", AnimationNodeBlend2.new(), Vector2(320, 2360))
		bt.connect_node("nada", 0, "boiar")
		bt.connect_node("nada", 1, "ts_nadar")
		bt.add_node("agua", AnimationNodeBlend2.new(), Vector2(560, 240))
		bt.connect_node("agua", 0, "mexe")
		bt.connect_node("agua", 1, "nada")
		bt.connect_node("corpo", 0, "agua")
	else:
		bt.connect_node("corpo", 0, "mexe")
	bt.connect_node("corpo", 1, "ab")
	# tronco: da coluna para cima (braços, cabeça); as pernas e o quadril ficam com a locomoção
	var tronco := AnimationNodeBlend2.new()
	tronco.filter_enabled = true
	var esq: Skeleton3D = _esqueleto(player.get_node(player.root_node))
	var cima := {}
	if esq:
		var raiz := esq.find_bone("J_Bip_C_Spine")
		if raiz >= 0:
			var fila := [raiz]
			while not fila.is_empty():
				var o: int = fila.pop_back()
				cima[esq.get_bone_name(o)] = true
				fila.append_array(esq.get_bone_children(o))
	var ref: Animation = player.get_animation("magia1") if player.has_animation("magia1") else player.get_animation("corrida")
	for t in ref.get_track_count():
		var cam := ref.track_get_path(t)
		if cam.get_subname_count() > 0 and cima.has(str(cam.get_subname(0))):
			tronco.set_filter_path(cam, true)
	bt.add_node("tronco", tronco, Vector2(840, 300))
	bt.connect_node("tronco", 0, "corpo")
	bt.connect_node("tronco", 1, "abu")
	# arrancada: só o quadril e as pernas da animação de sair correndo, por cima de tudo (os braços ficam com a
	# corrida e a arma). A animação do Mixamo segura um fuzil, por isso o resto do corpo não toca.
	if player.has_animation("arrancada"):
		anim.call("arrancada", "arr", Vector2(600, 1100))
		bt.add_node("ts_arr", AnimationNodeTimeScale.new(), Vector2(750, 1100))
		bt.add_node("seek_arr", AnimationNodeTimeSeek.new(), Vector2(900, 1100))
		bt.connect_node("ts_arr", 0, "arr")
		bt.connect_node("seek_arr", 0, "ts_arr")
		var pernas := AnimationNodeBlend2.new()
		pernas.filter_enabled = true
		var baixo := {}
		if esq:
			for n in ["J_Bip_C_Hips", "J_Bip_L_UpperLeg", "J_Bip_L_LowerLeg", "J_Bip_L_Foot", "J_Bip_L_ToeBase",
					"J_Bip_R_UpperLeg", "J_Bip_R_LowerLeg", "J_Bip_R_Foot", "J_Bip_R_ToeBase"]:
				baixo[n] = true
		var ref_a: Animation = player.get_animation("arrancada")
		for t in ref_a.get_track_count():
			var cam := ref_a.track_get_path(t)
			if cam.get_subname_count() > 0 and baixo.has(str(cam.get_subname(0))):
				pernas.set_filter_path(cam, true)
		bt.add_node("pernas", pernas, Vector2(1020, 300))
		bt.connect_node("pernas", 0, "tronco")
		bt.connect_node("pernas", 1, "seek_arr")
		bt.connect_node("output", 0, "pernas")
		_tem_arrancada = true
	else:
		bt.connect_node("output", 0, "tronco")
	tree.tree_root = bt
	tree.active = true
	_aplicar(0.0)

# quanto a guarda do cajado manda agora (0 a 1): parado em guarda, sem ação e sem andar
func peso_guarda() -> float:
	return _gcaj * (1.0 - _mexe) * (1.0 - max(_corpo, _tronco)) * (1.0 - _idle)

func _esqueleto(no: Node) -> Skeleton3D:
	var l := no.find_children("*", "Skeleton3D", true, false)
	return l[0] if l.size() > 0 else null

func has_animation(n: String) -> bool:
	return player.has_animation(n)

func get_animation(n: String) -> Animation:
	return player.get_animation(n)

# mesmo jeito do AnimationPlayer.play(nome, mistura, velocidade)
func play(nome: String, fade := -1.0, vel := 1.0) -> void:
	if fade < 0.0:
		fade = 0.15
	current_animation = nome
	var vel_fade: float = 1.0 / max(0.03, fade)
	if nome in LOCO:
		# locomoção: a mistura parada/andar/corrida vem da velocidade (atualizar); aqui só sai da ação
		_corpo_alvo = 0.0
		_tronco_alvo = 0.0
		_corpo_vel = vel_fade
		so_tronco = false
		if nome == "parada":
			_idle_alvo = 0.0
		elif nome == "espada_parada":
			_idle_alvo = 1.0
		return
	# ação: entra no lugar livre (A ou B) e mistura a partir do que estava tocando
	if _corpo > 0.02 or _tronco > 0.02:
		_slot = 1 - _slot
		_ab_vel = vel_fade
	else:
		_ab = float(_slot) # vindo da locomoção: o lugar já está certo, mistura pelo corpo
	_nos[_slot].animation = nome
	_nos[2 + _slot].animation = nome
	_ab_alvo = float(_slot)
	_ts = vel
	for parte in ["", "u"]:
		tree.set("parameters/ts%s%d/scale" % [parte, _slot], vel)
		tree.set("parameters/seek%s%d/seek_request" % [parte, _slot], 0.0)
	_corpo_alvo = 1.0
	_corpo_vel = vel_fade
	so_tronco = false

# arrancada: as pernas saem do parado com a animação própria (ritmo = quanto mais rápida que o original)
func arrancar(ritmo: float) -> void:
	if not _tem_arrancada:
		return
	_arr_ritmo = ritmo
	arrancando = ARR_INICIO
	tree.set("parameters/ts_arr/scale", ritmo)
	tree.set("parameters/seek_arr/seek_request", ARR_INICIO)
	_pernas_alvo = 1.0

func soltar_arrancada() -> void:
	_pernas_alvo = 0.0

# muda o ritmo da ação que está tocando (a freada derrapa rápido e se arruma devagar)
func ritmo_acao(v: float) -> void:
	_ts = v
	for parte in ["", "u"]:
		tree.set("parameters/ts%s%d/scale" % [parte, _slot], v)

func seek(t: float, _atualizar := true) -> void:
	for parte in ["", "u"]:
		tree.set("parameters/seek%s%d/seek_request" % [parte, _slot], t)

# a cada quadro: velocidade no chão (m/s), modo da arma e se o corpo está andando de verdade
func atualizar(dt: float, vel: float) -> void:
	_mexe = move_toward(_mexe, clamp(vel / 0.7, 0.0, 1.0), dt * 6.0)
	var corre: float = smoothstep(ANDAR * 1.05, CORRIDA * 0.85, vel)
	if tem_trote:
		corre = smoothstep(ANDAR * 1.05, TROTE * 0.85, vel) # andar -> trote
		_rapido = move_toward(_rapido, smoothstep(TROTE * 1.03, CORRIDA * 0.92, vel), dt * 5.0) # trote -> corrida
	_leve = move_toward(_leve, 1.0 if tem_lado and mirando and vel > 0.35 else 0.0, dt * 5.0)
	corre = lerp(corre, 1.0, _leve)
	_corre = move_toward(_corre, corre, dt * 5.0)
	# ritmo: andar e corrida com o mesmo período de passo enquanto misturam (os pés batem juntos)
	var v: float = max(vel, 0.6)
	var t_andar: float = _len_andar / (v / PASSO_ANDAR)
	var t_corrida: float = _len_corrida / (v / PASSO_CORRIDA)
	var periodo: float = lerp(t_andar, t_corrida, _corre)
	if tem_trote:
		# período de uma passada inteira: andar -> trote -> corrida (o trote tem 3 passadas por volta)
		var t_trote: float = PASSO_TROTE / v
		periodo = lerp(t_andar, lerp(t_trote, t_corrida, _rapido), _corre)
		periodo = lerp(periodo, PASSO_LEVE / v, _leve)
		tree.set("parameters/ts_trote/scale", clamp(_len_trote / TROTE_CICLOS / periodo, 0.3, 2.6))
	tree.set("parameters/ts_andar/scale", clamp(_len_andar / periodo, 0.3, 2.6))
	tree.set("parameters/ts_corrida/scale", clamp(_len_corrida / periodo, 0.3, 2.6))
	if tem_lado:
		# as animações de lado e de costas dão uma passada inteira por volta: todas no mesmo período da frente
		for nome in LADO_ANIMS:
			tree.set("parameters/ts_%s/scale" % nome, clamp(_len_lado[nome] / periodo, 0.3, 2.6))
		var lado_alvo := 0.0
		var tras_alvo := 0.0
		if mirando and vel > 0.35 and dir_local.length() > 0.01:
			var d := dir_local.normalized()
			lado_alvo = clamp(abs(d.x) / (abs(d.x) + abs(d.y) + 0.0001), 0.0, 1.0)
			tras_alvo = 1.0 if d.y < -0.05 else 0.0
			if abs(d.x) > 0.2:
				_lr = move_toward(_lr, 0.0 if d.x > 0.0 else 1.0, dt * 6.0)
		# frente <-> costas só troca rápido quando está de lado (passando pela lateral não aparece a troca)
		_tras = move_toward(_tras, tras_alvo, dt * (4.0 + 10.0 * _lado))
		_lado = move_toward(_lado, lado_alvo, dt * 5.0)
	# ação que só toca no tronco quando o herói anda (tiro do cajado andando)
	if so_tronco:
		var andando: bool = vel > 0.35
		_corpo_alvo = 0.0 if andando else 1.0
		_tronco_alvo = 1.0
	_corpo = move_toward(_corpo, _corpo_alvo, dt * _corpo_vel)
	_tronco = move_toward(_tronco, _tronco_alvo, dt * max(_corpo_vel, 6.0))
	_ab = move_toward(_ab, _ab_alvo, dt * _ab_vel)
	_idle = move_toward(_idle, _idle_alvo if em_guarda else 0.0, dt * (5.0 if em_guarda else 2.5)) # baixa a guarda devagar
	_gcaj = move_toward(_gcaj, 1.0 if guarda_cajado and em_guarda else 0.0, dt * (4.0 if em_guarda else 2.0))
	var solta_alvo := 1.0 if pode_soltar and not em_guarda else 0.0
	_solta = move_toward(_solta, solta_alvo, dt * (1.2 if solta_alvo > _solta else 5.0)) # entra na guarda rápido, relaxa devagar
	if tem_nado:
		_nado = move_toward(_nado, 1.0 if nadando else 0.0, dt * 2.5)
		_nada = move_toward(_nada, smoothstep(0.15, 0.9, vel) if nadando else 0.0, dt * 2.0)
		# braçada no ritmo da velocidade, entre 0,7x e 1,5x (mais rápido que isso parece afobado)
		var ts_nado: float = clamp(vel * _len_nadar / NADO_VOLTA, 0.7, 1.5)
		tree.set("parameters/ts_nadar/scale", ts_nado)
		voltas_nado = ts_nado / _len_nadar
	if arrancando > 0.0:
		arrancando += dt * _arr_ritmo
	_pernas = move_toward(_pernas, _pernas_alvo, dt * (12.0 if _pernas_alvo > _pernas else 6.0))
	if _pernas <= 0.0 and _pernas_alvo <= 0.0:
		arrancando = 0.0
	_aplicar(dt)

func _aplicar(_dt: float) -> void:
	tree.set("parameters/idle/blend_amount", _idle)
	if tem_guarda_cajado:
		tree.set("parameters/idle_caj/blend_amount", _gcaj)
	if tem_solta:
		tree.set("parameters/solta/blend_amount", _solta)
	tree.set("parameters/passo/blend_amount", _corre)
	if tem_trote:
		tree.set("parameters/rapido/blend_amount", _rapido)
	tree.set("parameters/mexe/blend_amount", _mexe)
	if tem_nado:
		tree.set("parameters/agua/blend_amount", _nado)
		tree.set("parameters/nada/blend_amount", _nada)
	if tem_lado:
		tree.set("parameters/v_lado_e/blend_amount", _corre)
		tree.set("parameters/v_lado_d/blend_amount", _corre)
		tree.set("parameters/v_tras/blend_amount", _corre)
		tree.set("parameters/lado_lr/blend_amount", _lr)
		tree.set("parameters/frente_tras/blend_amount", _tras)
		tree.set("parameters/lado/blend_amount", _lado)
	tree.set("parameters/ab/blend_amount", _ab)
	tree.set("parameters/abu/blend_amount", _ab)
	tree.set("parameters/corpo/blend_amount", _corpo)
	tree.set("parameters/tronco/blend_amount", _tronco)
	if _tem_arrancada:
		tree.set("parameters/pernas/blend_amount", _pernas)

extends RefCounted
# Animação do herói com AnimationTree (antes era só o AnimationPlayer trocando de animação):
# - locomoção misturada pela velocidade de verdade: parada -> andar -> corrida, sem pulo entre elas, e as duas
#   no mesmo ritmo de passo enquanto misturam;
# - ações (golpe, magia, pulo, escalada...) por cima, com mistura de uma para a outra (dois "lugares", A e B);
# - ação só no tronco: o tiro do cajado anda junto e as pernas continuam correndo (antes as pernas ficavam paradas
#   e o corpo deslizava).
# Tem a mesma cara do AnimationPlayer (play, current_animation, seek, has_animation, get_animation) para o resto
# do código não mudar.

const LOCO := ["parada", "espada_parada", "andar", "corrida"]
const ANDAR := 1.8
const CORRIDA := 5.4
const PASSO_ANDAR := 1.15
const PASSO_CORRIDA := 4.0

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
var _mexe := 0.0 # 0 = parado, 1 = andando/correndo
var _corre := 0.0 # 0 = andar, 1 = corrida
var so_tronco := false # a ação de agora pode tocar só no tronco quando o herói anda
var _len_andar := 1.0
var _len_corrida := 1.0
var _ts := 1.0 # velocidade pedida para a ação de agora

func _init(p: AnimationPlayer) -> void:
	player = p
	player.stop()
	player.active = false
	_len_andar = player.get_animation("andar").length
	_len_corrida = player.get_animation("corrida").length
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
	var idle := AnimationNodeBlend2.new()
	bt.add_node("idle", idle, Vector2(200, 60))
	bt.connect_node("idle", 0, "parada")
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
	bt.connect_node("passo", 1, "ts_corrida")
	bt.add_node("mexe", AnimationNodeBlend2.new(), Vector2(480, 180))
	bt.connect_node("mexe", 0, "idle")
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
	bt.connect_node("output", 0, "tronco")
	tree.tree_root = bt
	tree.active = true
	_aplicar(0.0)

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

func seek(t: float, _atualizar := true) -> void:
	for parte in ["", "u"]:
		tree.set("parameters/seek%s%d/seek_request" % [parte, _slot], t)

# a cada quadro: velocidade no chão (m/s), modo da arma e se o corpo está andando de verdade
func atualizar(dt: float, vel: float) -> void:
	_mexe = move_toward(_mexe, clamp(vel / 0.7, 0.0, 1.0), dt * 6.0)
	var corre: float = smoothstep(ANDAR * 1.05, CORRIDA * 0.85, vel)
	_corre = move_toward(_corre, corre, dt * 5.0)
	# ritmo: andar e corrida com o mesmo período de passo enquanto misturam (os pés batem juntos)
	var v: float = max(vel, 0.6)
	var t_andar: float = _len_andar / (v / PASSO_ANDAR)
	var t_corrida: float = _len_corrida / (v / PASSO_CORRIDA)
	var periodo: float = lerp(t_andar, t_corrida, _corre)
	tree.set("parameters/ts_andar/scale", clamp(_len_andar / periodo, 0.3, 2.6))
	tree.set("parameters/ts_corrida/scale", clamp(_len_corrida / periodo, 0.3, 2.6))
	# ação que só toca no tronco quando o herói anda (tiro do cajado andando)
	if so_tronco:
		var andando: bool = vel > 0.35
		_corpo_alvo = 0.0 if andando else 1.0
		_tronco_alvo = 1.0
	_corpo = move_toward(_corpo, _corpo_alvo, dt * _corpo_vel)
	_tronco = move_toward(_tronco, _tronco_alvo, dt * max(_corpo_vel, 6.0))
	_ab = move_toward(_ab, _ab_alvo, dt * _ab_vel)
	_idle = move_toward(_idle, _idle_alvo, dt * 5.0)
	_aplicar(dt)

func _aplicar(_dt: float) -> void:
	tree.set("parameters/idle/blend_amount", _idle)
	tree.set("parameters/passo/blend_amount", _corre)
	tree.set("parameters/mexe/blend_amount", _mexe)
	tree.set("parameters/ab/blend_amount", _ab)
	tree.set("parameters/abu/blend_amount", _ab)
	tree.set("parameters/corpo/blend_amount", _corpo)
	tree.set("parameters/tronco/blend_amount", _tronco)

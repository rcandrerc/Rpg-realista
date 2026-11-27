extends RefCounted
# NPCs das vilas vivos (André 2026-11-27: "npcs muito estáticos, o ferreiro podia ficar meio que trabalhando na bigorna e
# parando um pouco, outros caminhando caminhadas curtas"). Só enfeite do app: o servidor não sabe de nada disso e as
# lojas, o conserto e as missões continuam contando da casa do NPC (o lugar fixo de shared/dados.js). Por isso:
# - o herói chegou perto (PERTO m) ou abriu a conversa: o NPC volta para a casa dele e fica ali, virado como sempre;
# - só quem está a até VIVO m do herói trabalha ou passeia; mais longe ele termina de voltar para casa e fica parado;
# - ferreiro (Tomás e os das mini vilas com martelo): vai até a bigorna da ferraria, bate umas vezes e para um pouco;
# - quem fica atrás de balcão ou banca (lojas, leilão, Guilda, mercadores de pack) não sai do lugar, só se espreguiça;
# - os outros dão voltinhas de até PASSEIO m em volta da casa e param um pouco em cada ponto.
# Custo: só anda a posição e troca a animação; o NPC longe continua com a animação espaçada do main.gd (lod_inimigos).

const VIVO := 25.0 # m do herói: mais longe que isso o NPC não começa nada novo
const PERTO := 5.0 # m: herói mais perto que isso, o NPC fica na casa (sai acima de PERTO_SAI)
const PERTO_SAI := 6.5
const PASSEIO := 2.4 # m em volta da casa
const VEL := 1.15 # m/s andando à toa
const VEL_VOLTA := 1.6 # m/s voltando para casa porque o herói chegou
const PASSO_ANDAR := 1.9 # m/s que a animação "andar" anda (online.gd PASSO_HUMANO)
const BIGORNA_MAX := 3.6 # m da casa do ferreiro até a bigorna dele
const NA_BIGORNA := 0.95 # m do centro da bigorna até onde ele fica em pé para bater
const GOLPE := 1.15 # s de cada martelada
const PARADOS := ["loja", "leilao", "guilda", "pack", "mural", "totem"]
const ESPREGUICAR := ["parada_esticar_bracos", "parada_esticar_pescoco", "parada_bracos", "parada_calma"]
# tempos dentro da animação "descendente" (os mesmos da picareta em trabalho.gd): pronto, erguido, na bigorna
const G_PRONTO := 0.40
const G_ALTO := 0.58
const G_BATE_T := 0.667
const G_BATE := 0.55 # fração da martelada em que o martelo encosta na bigorna

var m # main.gd

func _init(principal) -> void:
	m = principal

# chamado pelo main.gd (lod_inimigos) para cada NPC que está aparecendo; dn = distância ao quadrado até o herói
func passo(n: Dictionary, dn: float, dt: float) -> void:
	if not n.has("vv"):
		_comecar(n)
	var v: Dictionary = n.vv
	if v.tipo == "nada":
		return
	var no: Node3D = n.no
	var falando: bool = m.conversa != null and m.conversa.npc == n
	if falando: # a conversa.gd vira o NPC para o herói; aqui só para o que ele fazia
		if v.est != "falando":
			v.est = "falando"
			_anim(v, "parada", 0.25)
		return
	# perto conta do herói (quem fala e compra), mesmo vendo um recruta pelo painel (dn é do centro da visão)
	var dh: float = no.position.distance_squared_to(m.heroi.position) if m.heroi else dn
	var perto: bool = dh < (PERTO_SAI * PERTO_SAI if v.get("perto", false) else PERTO * PERTO)
	v.perto = perto
	var casa: Vector3 = v.casa
	var longe_casa: float = Vector2(no.position.x - casa.x, no.position.z - casa.z).length()
	if perto or dn > VIVO * VIVO or not m.heroi:
		# para em casa: o herói vai falar com ele (ou ninguém está olhando de perto)
		if longe_casa > 0.08:
			_andar_ate(n, v, casa, VEL_VOLTA if perto else VEL, dt)
			if v.est != "voltando":
				v.est = "voltando"
		else:
			if v.est != "casa":
				v.est = "casa"
				v.t = randf_range(2.0, 5.0)
				_anim(v, "parada", 0.3)
			no.rotation.y = lerp_angle(no.rotation.y, float(v.ry_casa), minf(1.0, dt * 3.0))
			_ry0(n)
			if not perto:
				return
			_espreguicar(v, dt)
		return
	match v.tipo:
		"ferreiro":
			_ferreiro(n, v, dt)
		"passeio":
			_passeio(n, v, dt)
		_:
			_parado(n, v, dt)

func _comecar(n: Dictionary) -> void:
	var info: Dictionary = n.get("info", {}) if n.get("info") is Dictionary else {}
	var no: Node3D = n.no
	var v := {"tipo": "parado", "est": "casa", "t": randf_range(1.0, 6.0), "casa": no.position, "ry_casa": no.rotation.y,
		"an": no.find_child("AnimationPlayer", true, false), "esp": randf_range(6.0, 14.0)}
	n.vv = v
	var funcao := str(n.get("funcao", ""))
	var onde := str(info.get("onde", ""))
	if v.an == null or funcao in ["mural", "totem"]:
		v.tipo = "nada"
		return
	if (str(n.id) == "ferreiro" or info.get("oficio", false)) and (v.an as AnimationPlayer).has_animation("descendente"):
		var b = _bigorna_perto(no.position)
		if b != null:
			var bp: Vector3 = b
			var d := Vector3(no.position.x - bp.x, 0, no.position.z - bp.z)
			if d.length() < 0.01:
				d = Vector3(0, 0, 1)
			var lugar: Vector3 = bp + d.normalized() * NA_BIGORNA
			lugar.y = _chao(lugar.x, lugar.z, no.position.y)
			v.tipo = "ferreiro"
			v.bigorna = bp
			v.lugar = lugar
			v.ry_bigorna = atan2(bp.x - lugar.x, bp.z - lugar.z)
			v.t = randf_range(0.5, 3.0)
			return
	if funcao in PARADOS or funcao == "ferreiro" or onde.begins_with("banca") or onde.begins_with("peca") or onde.begins_with("comercio"):
		return # atrás do balcão, da banca ou na ferraria sem martelo: só se espreguiça
	v.tipo = "passeio"

# a bigorna pública da ferraria mais perto da casa do ferreiro (shared/dados.js ESTACOES_PUBLICAS, mundo.estacoes)
func _bigorna_perto(p: Vector3):
	var melhor = null
	var md := BIGORNA_MAX
	for e in m.mundo.get("estacoes", []):
		if str(e.get("k", "")) != "bigorna":
			continue
		var d := Vector2(float(e.x) - p.x, float(e.z) - p.z).length()
		if d < md:
			md = d
			var y: float = _chao(float(e.x), float(e.z), p.y)
			melhor = Vector3(float(e.x), y, float(e.z))
	return melhor

# chão embaixo do NPC: dentro da ferraria ou da Casa do Comércio é o piso, não o telhado (altura com a altura de agora)
func _chao(x: float, z: float, y: float) -> float:
	return m.terreno.altura(x, z, y + 0.3) if m.terreno else y

func _anim(v: Dictionary, nome: String, mistura := 0.25, vel := 1.0) -> void:
	var an: AnimationPlayer = v.an
	if an == null or not is_instance_valid(an) or not an.has_animation(nome):
		return
	if an.current_animation != nome:
		an.play(nome, mistura, vel)
	an.speed_scale = 1.0 if nome != "andar" else an.speed_scale

# a conversa.gd puxa o NPC de volta para o giro de antes (ry0); com ele andando, o giro de agora é o certo
func _ry0(n: Dictionary) -> void:
	if n.has("ry0"):
		n.ry0 = n.no.rotation.y

func _andar_ate(n: Dictionary, v: Dictionary, alvo: Vector3, vel: float, dt: float) -> bool:
	var no: Node3D = n.no
	var d := Vector2(alvo.x - no.position.x, alvo.z - no.position.z)
	var l := d.length()
	if l < 0.06:
		no.position = alvo
		return true
	var passo: float = minf(l, vel * dt)
	var u := d / l
	no.position.x += u.x * passo
	no.position.z += u.y * passo
	no.position.y = _chao(no.position.x, no.position.z, no.position.y)
	no.rotation.y = lerp_angle(no.rotation.y, atan2(u.x, u.y), minf(1.0, dt * 6.0))
	_ry0(n)
	var an: AnimationPlayer = v.an
	if an and an.has_animation("andar"):
		if an.current_animation != "andar":
			an.play("andar", 0.25)
		an.speed_scale = clampf(vel / PASSO_ANDAR, 0.55, 1.4) # o pé não desliza (online.gd _passo_no_ritmo)
	return l - passo < 0.06

# de vez em quando, parado, ele se espreguiça ou mexe os braços e volta a ficar quieto
func _espreguicar(v: Dictionary, dt: float) -> void:
	v.esp = float(v.esp) - dt
	var an: AnimationPlayer = v.an
	if v.get("esp_fim", 0.0) > 0.0:
		v.esp_fim = float(v.esp_fim) - dt
		if v.esp_fim <= 0.0:
			_anim(v, "parada", 0.5)
		return
	if v.esp > 0.0:
		return
	v.esp = randf_range(9.0, 18.0)
	var nome: String = ESPREGUICAR[randi() % ESPREGUICAR.size()]
	if an and an.has_animation(nome):
		an.play(nome, 0.5)
		an.speed_scale = 1.0
		v.esp_fim = minf(an.get_animation(nome).length, 5.0)

func _parado(n: Dictionary, v: Dictionary, dt: float) -> void:
	if v.est != "casa":
		v.est = "casa"
		_anim(v, "parada", 0.3)
	n.no.rotation.y = lerp_angle(n.no.rotation.y, float(v.ry_casa), minf(1.0, dt * 3.0))
	_ry0(n)
	_espreguicar(v, dt)

# ---------- ferreiro: vai até a bigorna, bate 3 a 6 vezes, para um pouco; às vezes volta para a casa e descansa ----------
func _ferreiro(n: Dictionary, v: Dictionary, dt: float) -> void:
	var no: Node3D = n.no
	match v.est:
		"casa", "voltando", "falando":
			v.t = float(v.t) - dt
			if v.est != "casa":
				v.est = "casa"
				_anim(v, "parada", 0.3)
			_espreguicar(v, dt)
			if v.t <= 0.0:
				v.est = "indo"
		"indo":
			if _andar_ate(n, v, v.lugar, VEL, dt):
				v.est = "pausa"
				v.t = 0.6
				_anim(v, "parada", 0.25)
		"pausa":
			no.rotation.y = lerp_angle(no.rotation.y, float(v.ry_bigorna), minf(1.0, dt * 5.0))
			_ry0(n)
			v.t = float(v.t) - dt
			if v.t <= 0.0:
				if v.get("vezes", 0) >= 3 and randf() < 0.35: # cansou: volta para a casa e descansa um pouco
					v.vezes = 0
					v.est = "descansar"
				else:
					v.est = "batendo"
					v.golpes = randi_range(3, 6)
					v.g = 0.0
					v.bateu = false
					v.vezes = int(v.get("vezes", 0)) + 1
					v.fase = -1
		"descansar":
			if _andar_ate(n, v, v.casa, VEL, dt):
				v.est = "casa"
				v.t = randf_range(5.0, 9.0)
				_anim(v, "parada", 0.3)
		"batendo":
			no.rotation.y = lerp_angle(no.rotation.y, float(v.ry_bigorna), minf(1.0, dt * 5.0))
			_ry0(n)
			v.g = float(v.g) + dt
			var f: float = clampf(v.g / GOLPE, 0.0, 1.0)
			var an: AnimationPlayer = v.an
			# a martelada procura o tempo dentro da animação (como a picareta do herói em trabalho.gd); longe do herói o
			# main.gd anda a animação só a cada 2 ou 3 quadros (anim_espacada), então o advance(0) aplica o tempo na hora
			if v.fase < 0:
				v.fase = 0
				an.speed_scale = 1.0
				if an.current_animation != "descendente":
					an.play("descendente", 0.15, 0.0)
			an.seek(_tempo_golpe(f), true)
			if an.callback_mode_process == AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL:
				an.advance(0.0)
			if not v.bateu and f >= G_BATE:
				v.bateu = true
				_martelada(v)
			if f >= 1.0:
				v.golpes = int(v.golpes) - 1
				v.g = 0.0
				v.bateu = false
				v.fase = -1
				if v.golpes <= 0:
					v.est = "pausa"
					v.t = randf_range(2.5, 5.5) # para um pouco: olha a peça, respira
					_anim(v, "parada", 0.35)
					v.esp = randf_range(0.3, 1.5) # e às vezes se espreguiça na pausa

func _tempo_golpe(f: float) -> float:
	if f < 0.45: # ergue o martelo devagar
		return lerp(G_PRONTO, G_ALTO, smoothstep(0.0, 1.0, f / 0.45))
	if f < G_BATE: # desce rápido
		var k: float = (f - 0.45) / (G_BATE - 0.45)
		return lerp(G_ALTO, G_BATE_T, k * k)
	if f < 0.72: # na bigorna
		return G_BATE_T
	return lerp(G_BATE_T, G_PRONTO, smoothstep(0.0, 1.0, (f - 0.72) / 0.28))

# faíscas e o tinido do ferro na bigorna (só de perto: o efeito e o som custam)
func _martelada(v: Dictionary) -> void:
	var b: Vector3 = v.bigorna
	var p := Vector3(b.x, b.y + 0.04, b.z) # b.y já é o tampo da bigorna (terreno.gd tampos)
	if m.heroi and m.heroi.position.distance_squared_to(p) > 18.0 * 18.0:
		return
	if m.fx:
		m.fx.surto(p.x, p.y, p.z, 7, "fff0b0", "ff8a2a", 2.6, 0.045)
	if m.sons:
		m.sons.tocar("minerar", -9.0, 0.1, p, 1.35)

# ---------- passeio: voltinhas curtas em volta da casa, com paradas ----------
func _passeio(n: Dictionary, v: Dictionary, dt: float) -> void:
	match v.est:
		"andando":
			if _andar_ate(n, v, v.alvo, VEL, dt):
				v.est = "pausa"
				v.t = randf_range(3.5, 9.0)
				_anim(v, "parada", 0.3)
		_:
			if v.est != "pausa":
				v.est = "pausa"
				_anim(v, "parada", 0.3)
			v.t = float(v.t) - dt
			_espreguicar(v, dt)
			if v.t > 0.0 or v.get("esp_fim", 0.0) > 0.0:
				return
			var alvo = _proximo_ponto(n, v)
			if alvo == null:
				v.t = randf_range(3.0, 6.0)
				return
			v.alvo = alvo
			v.est = "andando"
			v.esp_fim = 0.0

func _proximo_ponto(n: Dictionary, v: Dictionary):
	var casa: Vector3 = v.casa
	var de: Vector3 = n.no.position
	if Vector2(de.x - casa.x, de.z - casa.z).length() > 0.5 and randf() < 0.45:
		return casa # volta para o lugar de sempre de vez em quando
	for i in 6:
		var a := randf() * TAU
		var r := randf_range(1.0, PASSEIO)
		var p := Vector3(casa.x + sin(a) * r, 0, casa.z + cos(a) * r)
		if Vector2(p.x - de.x, p.z - de.z).length() < 0.8:
			continue
		p.y = _chao(p.x, p.z, casa.y)
		if _livre(de, p, casa.y):
			return p
	return null

# o caminho reto de a até b não bate em casa, pedra, árvore, mesa, água nem degrau (a casa é parede no terreno)
func _livre(a: Vector3, b: Vector3, y_casa: float) -> bool:
	var mov = m.mov
	var l := Vector2(b.x - a.x, b.z - a.z).length()
	var n: int = maxi(1, ceili(l / 0.35))
	var y_ant: float = a.y
	for i in range(1, n + 1):
		var t := float(i) / float(n)
		var px: float = lerpf(a.x, b.x, t)
		var pz: float = lerpf(a.z, b.z, t)
		var h: float = _chao(px, pz, y_ant)
		if absf(h - y_casa) > 0.35 or absf(h - y_ant) > 0.2:
			return false
		y_ant = h
		if m.terreno and m.terreno.has_method("no_lago") and not m.terreno.no_lago(px, pz).is_empty():
			return false
		if mov == null:
			continue
		if not mov.dentro_do_mapa(px, pz, 0.6):
			return false
		var ci := Vector2i(floori(px / 6.0), floori(pz / 6.0))
		for k in mov.perto_obstaculos(px, pz) + mov.perto_na_mata(px, pz) + mov._obst_extras.get(ci, []):
			var kr: float = float(k.r) + 0.45
			var dx: float = px - float(k.x)
			var dz: float = pz - float(k.z)
			if dx * dx + dz * dz < kr * kr:
				# já começou dentro dessa folga (casa colada no poço, na banca): só não pode chegar mais perto
				var ax: float = a.x - float(k.x)
				var az: float = a.z - float(k.z)
				if ax * ax + az * az < kr * kr and dx * dx + dz * dz >= ax * ax + az * az:
					continue
				return false
	return true

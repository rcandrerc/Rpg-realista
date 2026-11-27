extends RefCounted
# NPCs das vilas vivos (André 2026-11-27: "npcs muito estáticos, o ferreiro podia ficar meio que trabalhando na bigorna e
# parando um pouco, outros caminhando caminhadas curtas"). Só enfeite do app: o servidor não sabe de nada disso e as
# lojas, o conserto e as missões continuam contando da casa do NPC (o lugar fixo de shared/dados.js). Por isso:
# - o herói chegou perto (PERTO m) ou abriu a conversa: o NPC volta para a casa dele e fica ali, virado como sempre;
# - só quem está a até VIVO m do herói trabalha ou passeia; mais longe ele termina de voltar para casa e fica parado;
# - a martelada na bigorna saiu (André 2026-11-27: "animação do ferreiro e bigorna não estão bem feias, põe só
#   voltinhas neles também"): os ferreiros passeiam como os outros, dentro e em volta da ferraria;
# - quem fica atrás de balcão ou banca (lojas, leilão, Guilda, mercadores de pack) não sai do lugar, só se espreguiça;
# - os outros (ferreiros também) dão voltinhas de até PASSEIO m em volta da casa e param um pouco em cada ponto.
# Custo: só anda a posição e troca a animação; o NPC longe continua com a animação espaçada do main.gd (lod_inimigos).

const VIVO := 25.0 # m do herói: mais longe que isso o NPC não começa nada novo
const PERTO := 5.0 # m: herói mais perto que isso, o NPC fica na casa (sai acima de PERTO_SAI)
const PERTO_SAI := 6.5
const PASSEIO := 2.4 # m em volta da casa
const VEL := 1.15 # m/s andando à toa
const VEL_VOLTA := 1.6 # m/s voltando para casa porque o herói chegou
const PASSO_ANDAR := 1.9 # m/s que a animação "andar" anda (online.gd PASSO_HUMANO)
const PARADOS := ["loja", "leilao", "guilda", "pack", "mural", "totem"]
const ESPREGUICAR := ["parada_esticar_bracos", "parada_esticar_pescoco", "parada_bracos", "parada_calma"]

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
	if funcao in PARADOS or onde.begins_with("banca") or onde.begins_with("peca") or onde.begins_with("comercio"):
		return # atrás do balcão, da banca ou na ferraria sem martelo: só se espreguiça
	v.tipo = "passeio"

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

extends Node
# Seguir a Cecília ou outro jogador (André 2026-11-17: "um botão seguir quando eu estiver perto dela... ela escolhe pra onde vai, eu aperto
# Seguir e meu personagem segue ela automaticamente"). O botão fica no cartão dela (troca.gd); o servidor responde com o
# evento "seguir" (shared/amiga.js seguirAmiga) e daí o herói vai atrás dela pelo "Ir para" (rota.gd), replanejando a
# rota conforme ela anda. Perto dela, para; ela se afastou de novo, volta a andar. Como no "Ir para", só o joystick
# (ou morrer, ou ela sair do mundo) para de seguir; ao parar, avisa o servidor (ela deixa de ir na frente).
# André 2026-11-17: "tudo é igualzinho para um jogador e para ela": outro jogador também; aí só o app segue (o servidor
# não precisa saber) e o herói vai atrás dele do mesmo jeito.

const PARA := 3.5 # m: chegou perto dela, o herói para
const ANDA := 5.5 # m: parado perto, só volta a andar quando ela passar disto
const REPLANEJA := 1.0 # s entre um plano de rota e outro enquanto ela anda
const MEXEU := 3.0 # m que ela andou desde o último plano para valer um novo
const ATRAS := 2.0 # m: o ponto mirado fica este tanto antes dela (o herói não sobe nela)
const LOBO := 30.0 # m: mais longe que isto vai de lobo (viagem do rota.gd); ela no lobo, ele também

var m # main.gd
var alvo := "" # id dela (na rede) enquanto segue; "" = não está seguindo
var nome := ""
var avisa_servidor := false # Cecília: o servidor sabe (ela vai na frente); outro jogador: só aqui
var _t := 0.0
var _ult := Vector2.INF

func _init(principal) -> void:
	m = principal

func ativo() -> bool:
	return alvo != ""

func segue(id: String) -> bool:
	return alvo != "" and alvo == id

# o servidor topou (evento "seguir", Cecília) ou o jogador tocou Seguir num jogador
func comecar(id: String, nome_: String, servidor := true) -> void:
	if id == "" or m.online == null or m.online.outros.get(id) == null:
		return
	if alvo != "" and alvo != id:
		parar(false)
	alvo = id
	nome = nome_
	avisa_servidor = servidor
	_t = REPLANEJA
	_ult = Vector2.INF
	m.hud.aviso("Seguindo %s" % nome)

# o jogador apertou "Parar de seguir", mexeu no joystick ou ela sumiu
func parar(aviso := true) -> void:
	if alvo == "":
		return
	var id := alvo
	alvo = ""
	if m.rota and m.rota.ativo:
		m.rota.parar()
	if aviso:
		m.hud.aviso("Parou de seguir %s" % nome)
	if m.online and avisa_servidor:
		m.rede("amiga", {"acao": "naoSegue", "id": id})

func _process(dt: float) -> void:
	if alvo == "" or m.heroi == null:
		return
	var o = m.online.outros.get(alvo) if m.online else null
	if o == null or m.h.morto > 0.0:
		parar(false)
		return
	if m.hud.mover.length() > 0.15: # o joystick manda (como no "Ir para")
		parar()
		return
	var p: Vector3 = o.no.position
	var ela := Vector2(p.x, p.z)
	var eu := Vector2(m.heroi.position.x, m.heroi.position.z)
	var d := eu.distance_to(ela)
	if d <= PARA:
		if m.rota.ativo:
			m.rota.parar()
		return
	_t += dt
	if _t < REPLANEJA or (not m.rota.ativo and d < ANDA):
		return
	if m.rota.ativo and ela.distance_to(_ult) < MEXEU: # ela quase não andou: a rota de agora serve
		return
	_t = 0.0
	_ult = ela
	var mira := ela + (eu - ela).normalized() * ATRAS
	# de lobo quando ela vai de lobo (a mesma velocidade) ou quando está longe
	m.rota.ir(m.rota.planejar(mira), "", m.rota.OLHA, d > LOBO or o.get("montaria") != null)

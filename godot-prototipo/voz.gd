extends Node
# Comando de voz (André 2026-11-14, "tô lavando louça e quero continuar jogando"): só no celular Android, ligado em
# Configurações > Comando de voz. Ligado, escuta sem parar (mãos livres); desligado, o microfone fica fechado e não
# gasta nada. Começa sempre desligado ao abrir o jogo (ninguém fica com o microfone aberto sem saber).
# Teste inicial (André: "faz um inicial só, eu testo; ficou legal, a gente aumenta"): mapa, andar e combate.
# Cada frase = uma ação, igual a um toque de botão: nada de jogar sozinho. Quem decide golpe, dano e viagem continua
# sendo o mesmo caminho dos botões (main.usar, mapa "Ir para"), e o servidor confere tudo como sempre.
# O reconhecedor é o do próprio Android (plugin VozJogo, plugin-android/voz). Ele manda até 5 tentativas por frase e
# aqui fica a primeira que bate com um comando; frase comprida ou sem comando (barulho de água, TV) é ignorada.

const Idioma = preload("res://idioma.gd")

const SKILLS := { # palavra falada -> skill (HABILIDADES de shared/dados.js); só funciona se estiver na barra da arma
	"gelo": "lanca", "lanca": "lanca", "meteoro": "meteoros", "giro": "giro", "cometa": "bola", "relampago": "relampago",
	"explosao": "explosao", "esmagar": "salto", "salto": "salto", "onda": "onda", "chama": "chamas", "investida": "investida",
	"furia": "furia", "corte": "corte", "fenda": "fenda", "raio": "raio", "rajada": "rajada", "vortice": "vortice",
	"barreira": "barreira",
	"ice": "lanca", "meteor": "meteoros", "spin": "giro", "comet": "bola", "lightning": "relampago", "explosion": "explosao",
	"smash": "salto", "wave": "onda", "flame": "chamas", "charge": "investida", "fury": "furia", "slash": "corte",
	"rift": "fenda", "bolt": "raio", "barrier": "barreira", "vortex": "vortice",
}
const ANDAR := { # palavra -> direção do joystick (y negativo = para a frente da câmera)
	"frente": Vector2(0, -1), "forward": Vector2(0, -1), "front": Vector2(0, -1),
	"tra": Vector2(0, 1), "atra": Vector2(0, 1), "back": Vector2(0, 1), "backward": Vector2(0, 1),
	"esquerda": Vector2(-1, 0), "left": Vector2(-1, 0),
	"direita": Vector2(1, 0), "right": Vector2(1, 0),
}
const ACOES := { # palavra -> ação do botão (main.usar)
	"atacar": "basico", "ataca": "basico", "ataque": "basico", "atacando": "basico", "bater": "basico", "bate": "basico",
	"golpe": "basico", "basico": "basico", "basica": "basico", "attack": "basico", "hit": "basico",
	"vida": "pocao", "cura": "pocao", "health": "pocao", "heal": "pocao", "life": "pocao",
	"mana": "pocao_mana", "humana": "pocao_mana", "mano": "pocao_mana",
	"rolar": "rolar", "rola": "rolar", "esquivar": "rolar", "esquiva": "rolar", "roll": "rolar", "dodge": "rolar",
	"pular": "pular", "pula": "pular", "jump": "pular",
}
const PARAR := ["parar", "pare", "parou", "stop", "chega"]
const MAPA := ["mapa", "map"]
const FECHAR := ["fechar", "fecha", "close", "sair"]
# palavras que não mudam o comando ("usar gelo", "poção de vida", "ir para a vila", "anda pra frente")
const ENCHE := ["a", "o", "as", "os", "de", "da", "do", "das", "dos", "e", "pra", "pro", "para", "por", "em", "no", "na",
	"usar", "usa", "use", "soltar", "solta", "skill", "magia", "pocao", "potion", "ir", "vai", "vamo", "vamos", "go",
	"to", "the", "andar", "anda", "ande", "andando", "corre", "correr", "walk", "run", "move", "um", "uma", "agora", "ai",
	"nv", "nivel", "level", "lv", "lvl", "of", "cortar"]
const MAX_PALAVRAS := 4 # frase com mais palavras que isso (sem as de enchimento) não é comando: é conversa ou TV

var m # main.gd
var plugin = null
var ligado := false
var andar := Vector2.ZERO # andando por voz: para onde (o joystick ganha; "parar" zera)
var _ultimo := ""
var _ultimo_t := -10.0

func _init(principal) -> void:
	m = principal
	name = "Voz"

static func existe() -> bool:
	return OS.get_name() == "Android" and Engine.has_singleton("VozJogo")

func _ready() -> void:
	if existe():
		plugin = Engine.get_singleton("VozJogo")
		# adiado: o sinal do Android pode chegar fora da linha principal do jogo; assim a ação roda no quadro, como um toque
		plugin.ouviu.connect(_ouviu, CONNECT_DEFERRED)
		plugin.parcial.connect(_parcial, CONNECT_DEFERRED)
		plugin.estado.connect(_estado, CONNECT_DEFERRED)
	get_tree().on_request_permissions_result.connect(_permissao)

# Configurações > Comando de voz
func ligar(v: bool) -> void:
	if plugin == null:
		ligado = false
		return
	if not v:
		ligado = false
		andar = Vector2.ZERO
		plugin.desligar()
		return
	if not "android.permission.RECORD_AUDIO" in OS.get_granted_permissions():
		ligado = true # liga quando o Android responder (_permissao)
		OS.request_permission("android.permission.RECORD_AUDIO")
		return
	if not plugin.disponivel():
		ligado = false
		m.hud.aviso(tr("Celular sem reconhecimento de voz"))
		return
	ligado = true
	_escutou = false
	plugin.ligar("en-US" if Idioma.atual == "en" else "pt-BR")
	m.hud.aviso(tr("Voz ligada"))

func _permissao(nome: String, ok: bool) -> void:
	if not nome.ends_with("RECORD_AUDIO") or not ligado:
		return
	if ok:
		ligar(true)
	else:
		ligado = false
		m.hud.aviso(tr("Sem microfone"))
		if m.menu_topo:
			m.menu_topo.voz_negada()

# o que o microfone está fazendo aparece na tela (André 2026-11-14: "quais comandos estão valendo? só para eu saber
# se está funcionando"): "Escutando..." na primeira vez, e o erro do Android (cada número no máximo a cada 8 s)
var _escutou := false
var _erro_t := {}
func _estado(e: String) -> void:
	if e == "escutando":
		if not _escutou:
			_escutou = true
			m.hud.aviso(tr("Escutando..."))
		return
	if e.begins_with("erro:"):
		var agora := Time.get_ticks_msec() / 1000.0
		if agora - float(_erro_t.get(e, -100.0)) > 8.0:
			_erro_t[e] = agora
			m.hud.aviso(tr("Voz: erro %s") % e.substr(5))
		return
	if e == "sem_permissao":
		ligado = false
		m.hud.aviso(tr("Sem microfone"))
	elif e == "sem_servico":
		ligado = false
		m.hud.aviso(tr("Celular sem reconhecimento de voz"))

# ---------- texto ----------
const ACENTOS := {"á": "a", "à": "a", "â": "a", "ã": "a", "ä": "a", "é": "e", "ê": "e", "è": "e", "í": "i", "î": "i",
	"ó": "o", "ô": "o", "õ": "o", "ò": "o", "ú": "u", "ü": "u", "û": "u", "ç": "c", "ñ": "n"}

# "Poção de Mana!" -> ["mana"]; plural vira singular (imps = imp, golens = golem) para bater com o mapa
static func palavras(t: String, tirar_enche := true) -> Array:
	var s := t.to_lower()
	for k in ACENTOS:
		s = s.replace(k, ACENTOS[k])
	var limpo := ""
	for ch in s:
		limpo += ch if (ch >= "a" and ch <= "z") or (ch >= "0" and ch <= "9") else " "
	var r: Array = []
	for p in limpo.split(" ", false):
		if p.ends_with("ns") and p.length() > 4:
			p = p.substr(0, p.length() - 2) + "m"
		elif p.ends_with("s") and p.length() > 3:
			p = p.substr(0, p.length() - 1)
		if tirar_enche and p in ENCHE:
			continue
		r.append(p)
	return r

# o que a frase pede: {} se não for comando
static func entender(t: String, mapa_aberto: bool) -> Dictionary:
	var crua := palavras(t, false)
	var p := palavras(t)
	if crua.size() == 1 and crua[0] == "para": # "para!" sozinho é parar (no meio da frase é "ir para")
		return {"k": "parar"}
	if p.is_empty() or p.size() > MAX_PALAVRAS:
		return {}
	if p[0] == "desligar" or p[0] == "desliga":
		if p.size() > 1 and p[1] in ["voz", "microfone"]:
			return {"k": "desligar"}
	for w in p:
		if w in PARAR:
			return {"k": "parar"}
	if p[0] in MAPA and p.size() == 1:
		return {"k": "mapa"}
	if p[0] in FECHAR:
		return {"k": "fechar"}
	if mapa_aberto: # com o mapa aberto, o nome de um lugar leva até ele
		return {"k": "lugar", "p": p}
	for w in p:
		if ANDAR.has(w):
			return {"k": "andar", "d": ANDAR[w]}
		if SKILLS.has(w):
			return {"k": "skill", "s": SKILLS[w]}
		if ACOES.has(w):
			return {"k": "acao", "a": ACOES[w]}
	return {}

# ---------- frases ----------
func _parcial(txt: String) -> void:
	# "parar" age já no pedaço (não espera o fim da frase): andar por voz para na hora
	if not ligado:
		return
	var t0: String = txt.split("\n", false)[0] if txt != "" else ""
	if t0 != "": # enquanto fala já aparece o que está entendendo (se aparece aqui e a ação não vem, o problema é o fim da frase)
		m.hud.aviso(tr("Ouvi: %s") % t0.left(30))
	for t in txt.split("\n", false):
		var e := entender(t, false)
		if e.get("k", "") == "parar":
			_fazer(e, t)
			return

func _ouviu(txt: String) -> void:
	if not ligado or m.heroi == null:
		return
	var aberto: bool = m.minimapa != null and m.minimapa.aberto
	for t in txt.split("\n", false):
		var e := entender(t, aberto)
		if e.is_empty():
			continue
		if e.k == "lugar":
			var l := lugar(e.p)
			if l.is_empty():
				continue # tenta a próxima tentativa do reconhecedor
			_ir_para(l)
			return
		_fazer(e, t)
		return
	if aberto:
		m.hud.aviso(tr("Lugar não encontrado"))
		return
	# ouviu, mas não é comando: mostra o que entendeu (assim dá para ver se o microfone pega e qual palavra trocar)
	var t0: String = txt.split("\n", false)[0] if txt != "" else ""
	if t0 != "":
		m.hud.aviso(tr("Ouvi: %s") % t0.left(30))

func _fazer(e: Dictionary, t: String) -> void:
	if e.k != "parar":
		m.hud.aviso(tr("Ouvi: %s") % t.left(30)) # o aviso da própria ação (Parou, Indo...) vem por cima quando tem
	var agora := Time.get_ticks_msec() / 1000.0
	if e.k == "parar" and _ultimo == "parar" and agora - _ultimo_t < 1.5:
		return # o pedaço já parou: a frase final não repete o aviso
	_ultimo = str(e.k)
	_ultimo_t = agora
	match e.k:
		"parar":
			andar = Vector2.ZERO
			if m.rota and m.rota.ativo:
				m.rota.parar()
			m.hud.aviso(tr("Parou"))
		"desligar":
			ligar(false)
			if m.menu_topo:
				m.menu_topo.voz_negada()
			m.hud.aviso(tr("Voz desligada"))
		"mapa":
			andar = Vector2.ZERO
			if m.minimapa and not m.minimapa.aberto:
				m.minimapa.abrir()
		"fechar":
			if m.minimapa and m.minimapa.aberto:
				m.minimapa.fechar()
		"andar":
			if m.rota and m.rota.ativo:
				m.rota.parar()
			if m.conversa:
				m.conversa.indo = null
			andar = e.d
		"skill":
			andar = Vector2.ZERO # golpe e skill plantam o pé (andar cortaria a magia concentrada e a corrida até o alvo)
			var barra: Array = m.barra_atual()
			var i := barra.find(e.s)
			if i < 0:
				m.hud.aviso(tr("Skill não está na barra"))
				return
			m.usar("hab%d" % i)
		"acao":
			if not e.a in ["rolar", "pular"]: # rolar e pular seguem andando para o mesmo lado
				andar = Vector2.ZERO
			m.usar(str(e.a))

# ---------- mapa: nome falado -> lugar da lista do mapa ----------
# Cada lugar tem nome curto ("Imps Nv 15", "Lúcia", "Vila da Clareira"). Ganha o que tiver mais palavras iguais às
# faladas; número falado tem que bater (imp 15 não leva aos imps 10). Empate: o mais perto do herói.
func lugar(faladas: Array) -> Dictionary:
	if m.minimapa == null:
		return {}
	var nums: Array = faladas.filter(func(w): return str(w).is_valid_int())
	var hp: Vector3 = m.heroi.position
	var melhor := {}
	var melhor_n := 0.0
	var melhor_d := INF
	for l in m.minimapa._lugares():
		var nomes: Array = palavras(str(l.get("curto", ""))) + palavras(str(l.get("nome", "")).split("  (")[0])
		if nomes.is_empty():
			continue
		var ok := true
		for n in nums:
			if not n in nomes:
				ok = false
		if not ok:
			continue
		var iguais := 0.0
		for w in faladas:
			if w in nomes:
				iguais += 1.0
		if iguais <= 0.0 or iguais < faladas.size() * 0.5:
			continue
		var d := Vector2(float(l.x) - hp.x, float(l.z) - hp.z).length()
		if iguais > melhor_n or (iguais == melhor_n and d < melhor_d):
			melhor = l
			melhor_n = iguais
			melhor_d = d
	return melhor

func _ir_para(l: Dictionary) -> void:
	andar = Vector2.ZERO
	var mm = m.minimapa
	mm.selecionado = "" # o mesmo nome de novo não pode ir duas vezes (_escolher já iria)
	mm._escolher(l) # marca e traça a rota pela estrada, como o toque no nome da lista
	if mm.marcado == null:
		m.hud.aviso(tr("Não dá para ir até lá"))
		return
	mm._ir()
	m.hud.aviso(tr("Indo: %s") % str(l.get("curto", "")))

# ---------- quadro a quadro ----------
func _process(_dt: float) -> void:
	if andar == Vector2.ZERO:
		return
	# o dedo ganha da voz; morrer, conversa, menu ou mapa aberto param a caminhada
	if m.hud.mover.length() > 0.15 or m.h.morto > 0.0 or m.hud.bloqueado:
		andar = Vector2.ZERO

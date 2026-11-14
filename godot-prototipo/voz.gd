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
# As skills de verdade da barra (HABS de shared/progresso.js, as do Quimera). A lista de cima é a antiga (HABILIDADES de
# shared/dados.js) e fica como segunda tentativa. André 2026-11-14 (2239): "falei meteoro, gelo... disse que a skill não
# estava na barra": o meteoro da barra é "meteoro" e o gelo é "nova_gelo", não "meteoros" e "lanca".
const SKILLS_Q := {
	"corte": "corte_duplo", "duplo": "corte_duplo", "giro": "giro", "redemoinho": "giro",
	"esmagar": "golpe_esmagador", "esmagador": "golpe_esmagador", "martelo": "golpe_esmagador",
	"pisao": "pisao_sismico", "sismico": "pisao_sismico", "tremor": "pisao_sismico", "investida": "investida",
	"bola": "bola_fogo", "fogo": "bola_fogo", "cometa": "bola_fogo", "anel": "anel_chamas", "chama": "anel_chamas",
	"circulo": "anel_chamas", "meteoro": "meteoro", "estrela": "meteoro", "gelo": "nova_gelo", "nova": "nova_gelo",
	"inverno": "nova_gelo", "lanca": "nova_gelo", "raio": "raio_cadeia", "cadeia": "raio_cadeia", "tempestade": "raio_cadeia",
	"salto": "salto_arcano", "floresta": "cura_floresta", "escudo": "escudo_arcano", "egide": "escudo_arcano",
	"barreira": "escudo_arcano", "vortice": "vortice", "abraco": "vortice",
	"ice": "nova_gelo", "meteor": "meteoro", "spin": "giro", "fireball": "bola_fogo", "fire": "bola_fogo",
	"lightning": "raio_cadeia", "chain": "raio_cadeia", "shield": "escudo_arcano",
	"smash": "golpe_esmagador", "charge": "investida", "slash": "corte_duplo", "ring": "anel_chamas", "vortex": "vortice",
}
const ANDAR := { # palavra -> direção do joystick (y negativo = para a frente da câmera)
	"frente": Vector2(0, -1), "gente": Vector2(0, -1), "frete": Vector2(0, -1), "forward": Vector2(0, -1), "front": Vector2(0, -1),
	"tra": Vector2(0, 1), "atra": Vector2(0, 1), "traz": Vector2(0, 1), "atraz": Vector2(0, 1), "tras": Vector2(0, 1), "back": Vector2(0, 1), "backward": Vector2(0, 1),
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
const MAPA := ["mapa", "map", "napa"]
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
		if Engine.has_singleton("VozVosk"): # APK com escuta contínua (2026-11-14); APK velho fica no botão
			vosk = Engine.get_singleton("VozVosk")
			vosk.ouviu.connect(_ouviu, CONNECT_DEFERRED)
			vosk.parcial.connect(_parcial, CONNECT_DEFERRED)
			vosk.estado.connect(_estado, CONNECT_DEFERRED)
	get_tree().on_request_permissions_result.connect(_permissao)

# Configurações > Comando de voz
func ligar(v: bool) -> void:
	if plugin == null:
		ligado = false
		return
	if not v:
		ligado = false
		andar = Vector2.ZERO
		ouvindo = false
		plugin.desligar()
		_vosk_desligar()
		m.hud.mostrar_botao("voz", false)
		m.hud.ligar_botao("voz", false)
		return
	if not "android.permission.RECORD_AUDIO" in OS.get_granted_permissions():
		ligado = true # liga quando o Android responder (_permissao)
		OS.request_permission("android.permission.RECORD_AUDIO")
		return
	if _usa_vosk():
		ligado = true
		_escutou = false
		_vosk_ligar()
		return
	if not plugin.disponivel():
		ligado = false
		m.hud.aviso(tr("Celular sem reconhecimento de voz"))
		return
	ligado = true
	_escutou = false
	if _botao():
		m.hud.mostrar_botao("voz", true)
		m.hud.aviso(tr("Toque no microfone e fale"))
		return
	plugin.ligar(_lingua())
	m.hud.aviso(tr("Voz ligada"))

func _lingua() -> String:
	return "en-US" if Idioma.atual == "en" else "pt-BR"

# Teste com botão (André 2026-11-14: "a gente testa com um botão de ativar o microfone, só para testar os comandos
# primeiro"): o reconhecedor do Android fecha e reabre a cada frase e perdia o que se falava no meio. Com o botão,
# cada toque escuta uma fala (até ESCUTA_MAX s ou o fim da frase); os comandos dela valem em sequência, como antes.
# No APK novo (plugin VozVosk) a escuta é contínua e o botão some sozinho (_botao(), lá embaixo).
const MODO_BOTAO := true
const ESCUTA_MAX := 8.0
var ouvindo := false
var _ouvindo_ate := 0.0
func tocar() -> void:
	if plugin == null or not ligado:
		return
	if ouvindo:
		_parar_escuta()
		return
	ouvindo = true
	_ouvindo_ate = Time.get_ticks_msec() / 1000.0 + ESCUTA_MAX
	_nova_frase()
	m.hud.ligar_botao("voz", true)
	m.hud.aviso(tr("Escutando..."))
	plugin.ligar(_lingua())

func _parar_escuta() -> void:
	ouvindo = false
	m.hud.ligar_botao("voz", false)
	if plugin:
		plugin.desligar()

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
	if e == "carregando":
		m.hud.aviso(tr("Carregando voz..."))
		return
	if e == "escutando":
		_nova_frase()
		if not _escutou:
			_escutou = true
			m.hud.aviso(tr("Voz ligada: pode falar") if _usa_vosk() else tr("Escutando..."))
		return
	if e.begins_with("erro:"):
		var agora := Time.get_ticks_msec() / 1000.0
		if agora - float(_erro_t.get(e, -100.0)) > 8.0:
			_erro_t[e] = agora
			m.hud.aviso(tr("Voz: erro %s") % e.substr(5).left(40))
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
		if p == "unk" and tirar_enche: # "[unk]" do Vosk = barulho ou palavra fora da lista (fica na sequência: "[unk] vida"
			continue # de "minha vida" não é comando, a palavra antes dela não era de comando)
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
	if p[0] in FECHAR:
		return {"k": "fechar"}
	if p.size() <= 2 and (p[0] in MAPA or p[-1] in MAPA): # "mapa", "abrir mapa", "abre o mapa"
		return {"k": "mapa"}
	if mapa_aberto: # com o mapa aberto, o nome de um lugar leva até ele
		return {"k": "lugar", "p": p}
	for w in p:
		if ANDAR.has(w):
			return {"k": "andar", "d": ANDAR[w]}
		if SKILLS_Q.has(w) or SKILLS.has(w):
			return {"k": "skill", "s": str(SKILLS_Q.get(w, SKILLS.get(w, ""))), "s2": str(SKILLS.get(w, ""))}
		if ACOES.has(w):
			return {"k": "acao", "a": ACOES[w]}
	return {}

# ---------- frases ----------
# André 2026-11-14 (2229): "Ouvi: frente" aparecia e o herói não andava. O texto do meio da frase chegava, mas o fim
# da frase muitas vezes não (o Android fecha com "não entendi" quando tem barulho). Agora o comando age já no pedaço,
# uma vez por frase; o fim da frase só age se o pedaço não agiu. Com o mapa aberto espera o fim (nome de lugar é longo).
var _feito := false # esta frase já virou ação (com o mapa aberto)
# Em sequência (André 2026-11-14: "o microfone fica aberto o tempo inteiro, tem que ir pegando todos os comandos na
# sequência, mesmo que não pare"): cada palavra nova que chega no pedaço da frase é olhada uma vez; a que for comando
# vira ação na hora. "frente ... gelo ... atacar" numa fala só = andar, gelo e ataque, na ordem.
var _usadas := 0 # palavras desta frase já olhadas
# O reconhecedor reescreve o pedaço enquanto a pessoa fala ("a" vira "atrás", "abrir nada" vira "abrir mapa"). Antes
# só as palavras depois da última olhada contavam, e a palavra corrigida no lugar dela passava batida (André
# 2026-11-14, 2235: "frente andou 2 de 20", "atrás nunca apareceu"). Agora volta até onde o texto mudou.
var _vistas: Array = []
var _ultima_acao := "" # a mesma ação duas vezes seguidas na mesma frase ("lança de gelo", o Android corrigindo) vale uma
# Palavras fracas: sinônimos que o reconhecedor trocava ("gente" = frente, "mano"/"humana" = mana) e as que aparecem em
# conversa ("minha vida"). Conselho 2026-11-14: TV e conversa viravam comando ("a gente", "mano", "minha vida"). Elas
# só valem no começo da frase ou depois de outro comando ou de palavra de comando ("pra", "poção de", "usar").
const FRACAS := ["gente", "frete", "mano", "humana", "napa", "vida", "cura", "traz", "atraz", "atra", "tra"]
const ANTES_FRACA := ["", "pra", "pro", "para", "pocao", "potion", "de", "da", "usar", "usa", "use", "toma", "tomar",
	"vai", "anda", "andar", "ande", "abrir", "abre", "abra", "open", "go", "drink"]
static func cmd_palavra(w: String, antes: String) -> Dictionary:
	if w in FRACAS and not antes in ANTES_FRACA and cmd_palavra(antes, "").is_empty():
		return {}
	if w == "para": # André 2026-11-14 (2251): "o para não funcionou... deixa para e parar os 2" = parar na hora
		return {"k": "parar"}
	if w in MAPA and antes in FECHAR: # "fechar mapa"
		return {}
	if w in ["voz", "microfone"] and antes in ["desligar", "desliga"]:
		return {"k": "desligar"}
	return entender(w, false)

func _sequencia(txt: String, final: bool) -> void:
	var t0: String = txt.split("\n", false)[0] if txt != "" else ""
	var w := palavras(t0, false)
	if final and w.size() == 1 and w[0] == "para" and not _ultima_acao.begins_with("parar"):
		_ultima_acao = "parar"
		_fazer({"k": "parar"}, t0) # "para!" sozinho: o pedaço já tinha olhado a palavra (e ignorado, era "ir para")
	var fez := false
	var igual := 0 # palavras do começo que não mudaram desde o último pedaço
	while igual < mini(w.size(), _vistas.size()) and w[igual] == _vistas[igual]:
		igual += 1
	_vistas = w
	for i in range(mini(_usadas, igual), w.size()):
		var e := cmd_palavra(str(w[i]), str(w[i - 1]) if i > 0 else "")
		if e.is_empty():
			continue
		var chave := "%s %s %s %s" % [e.k, e.get("s", ""), e.get("d", ""), e.get("a", "")] # "bola de fogo" = uma vez
		if chave == _ultima_acao:
			continue
		_ultima_acao = chave
		_fazer(e, str(w[i]))
		fez = true
		if e.k == "mapa": # o resto da frase é o nome do lugar (fim da frase)
			_usadas = w.size()
			return
	_usadas = w.size()
	if not fez and t0 != "":
		_ouvi(t0)

static func sem_unk(t: String) -> String: # "[unk]" do Vosk não aparece na tela
	return " ".join(t.replace("[unk]", " ").split(" ", false))

func _parcial(txt: String) -> void:
	if not ligado or m.heroi == null:
		return
	if m.minimapa != null and m.minimapa.aberto: # mapa aberto: o nome do lugar espera o fim da frase
		var t0: String = txt.split("\n", false)[0] if txt != "" else ""
		if t0 != "":
			_ouvi(t0)
		var e := entender(t0, true)
		if not e.is_empty() and e.k != "lugar" and not _feito: # "fechar" e "parar" já valem
			_feito = true
			_fazer(e, t0)
		return
	_sequencia(txt, false)

func _ouviu(txt: String) -> void:
	if not ligado or m.heroi == null:
		return
	if sem_unk(txt).strip_edges() == "" or palavras(sem_unk(txt), false).is_empty(): # frase vazia ou só barulho ([unk])
		_nova_frase()
		return
	if _botao() and ouvindo:
		call_deferred("_parar_escuta") # uma fala por toque
	var aberto: bool = m.minimapa != null and m.minimapa.aberto
	if not aberto:
		_sequencia(txt, true)
		_nova_frase()
		return
	if _feito:
		_nova_frase()
		return
	_nova_frase()
	for t in txt.split("\n", false):
		var e := entender(t, true)
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
	m.hud.aviso(tr("Lugar não encontrado"))

func _nova_frase() -> void:
	_feito = false
	_usadas = 0
	_vistas = []
	_ultima_acao = ""

var _voz_t := -10.0 # quando a última ação apareceu ("Voz: ..."): o "Ouvi" não passa por cima dela por 2 s
func _ouvi(t: String) -> void:
	t = sem_unk(t)
	if t != "" and Time.get_ticks_msec() / 1000.0 - _voz_t > 2.0:
		m.hud.aviso(tr("Ouvi: %s") % t.right(30))

func _fazer(e: Dictionary, t: String) -> void:
	_voz_t = Time.get_ticks_msec() / 1000.0
	if e.k != "parar":
		m.hud.aviso(tr("Voz: %s") % t.left(30)) # "Voz:" = virou ação ("Ouvi:" = só ouviu); Parou, Indo... vêm por cima
	var agora := Time.get_ticks_msec() / 1000.0
	if e.k == "parar" and _ultimo == "parar" and agora - _ultimo_t < 1.5:
		return # o pedaço já parou: a frase final não repete o aviso
	_ultimo = str(e.k)
	_ultimo_t = agora
	match e.k:
		"parar":
			andar = Vector2.ZERO
			atacando = false
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
			atacando = false # andar tira do ataque contínuo
			if m.cam and m.cam.travada(): # câmera nas costas: direita/esquerda viram 90°, trás dá meia-volta
				if e.d.x > 0.0:
					m.cam.virar(-PI / 2.0)
				elif e.d.x < 0.0:
					m.cam.virar(PI / 2.0)
				elif e.d.y > 0.0:
					m.cam.virar(PI)
				andar = Vector2(0, -1)
		"skill":
			andar = Vector2.ZERO # golpe e skill plantam o pé (andar cortaria a magia concentrada e a corrida até o alvo)
			var barra: Array = m.barra_atual()
			var i := barra.find(e.s)
			if i < 0 and str(e.get("s2", "")) != "":
				i = barra.find(e.s2)
			if i < 0:
				m.hud.aviso(tr("Skill não está na barra"))
				return
			m.usar("hab%d" % i)
		"acao":
			if not e.a in ["rolar", "pular"]: # rolar e pular seguem andando para o mesmo lado
				andar = Vector2.ZERO
			if e.a == "basico": # André 2026-11-14: "fala uma vez atacar, ele só vai parar quando mandar parar"
				atacando = true
				_ataque_t = 0.0
				m.hud.aviso(tr("Atacando (fale parar)"))
				return
			m.usar(str(e.a))

# ---------- mapa: nome falado -> lugar da lista do mapa ----------
# Cada lugar tem nome curto ("Imps Nv 15", "Lúcia", "Vila da Clareira"). Ganha o que tiver mais palavras iguais às
# faladas; número falado tem que bater (imp 15 não leva aos imps 10). Empate: o mais perto do herói.
func lugar(faladas: Array) -> Dictionary:
	if m.minimapa == null:
		return {}
	faladas = faladas.filter(func(w): return not (w in MAPA or w in ["abrir", "abre", "abra", "open"])) # "abrir mapa imp 15"
	faladas = juntar_numeros(faladas) # o Vosk escreve "quinze": vira "15" como no mapa
	if faladas.is_empty():
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
# ataque básico contínuo: "atacar" liga, "parar" (ou andar, morrer, desligar a voz) desliga. Repete como o dedo
# segurando o botão (main.gd, a cada 0,2 s); a recarga e o alvo continuam sendo os do botão.
var atacando := false
var _ataque_t := 0.0
func _process(_dt: float) -> void:
	if atacando:
		# conselho 2026-11-14: o ataque repetido tirava do lobo, cortava coleta, pesca e "Ir para" e repetia avisos.
		# Agora desliga sozinho com o dedo no joystick, montado, nadando, no barco, coletando ou indo pelo mapa.
		var ocupado: bool = m.montaria != null or m._nadando or not m.mov.veiculo.is_empty() \
			or (m.trabalho != null and m.trabalho.coletando != null) or (m.rota != null and m.rota.ativo)
		if not ligado or m.h.morto > 0.0 or m.hud.mover.length() > 0.15 or ocupado:
			atacando = false
			# André 2026-11-14 (2251): "falei atacar e não funcionou": a tela diz por que o ataque parou
			var porque := "joystick" if m.hud.mover.length() > 0.15 else ("lobo" if m.montaria != null else ("nadando" if m._nadando \
				else ("barco" if not m.mov.veiculo.is_empty() else ("coleta" if m.trabalho != null and m.trabalho.coletando != null \
				else ("mapa" if m.rota != null and m.rota.ativo else "")))))
			if porque != "":
				m.hud.aviso(tr("Ataque parou: %s") % porque)
		elif not m.hud.bloqueado:
			var agora := Time.get_ticks_msec() / 1000.0
			if agora - _ataque_t >= 0.2:
				_ataque_t = agora
				m.usar("basico")
	if _baixando != null:
		_progresso()
	if _unzip != null and not _unzip.is_alive():
		_desempacotou()
	if ouvindo and Time.get_ticks_msec() / 1000.0 > _ouvindo_ate:
		_parar_escuta()
	if andar == Vector2.ZERO:
		return
	# o dedo ganha da voz; morrer, conversa, menu ou mapa aberto param a caminhada
	if m.hud.mover.length() > 0.15 or m.h.morto > 0.0 or m.hud.bloqueado:
		andar = Vector2.ZERO

# ---------- escuta contínua (Vosk) ----------
# André 2026-11-14: "se eu tiver que ficar clicando em botão de microfone, pra mim não compensa. Eu quero é o jogo
# hands-free por alguns minutos". O reconhecedor do Android fecha e reabre a cada frase e perde o que se fala no meio.
# O Vosk (plugin VozVosk, Apache 2.0, roda no celular sem internet) deixa o microfone aberto direto e só procura as
# palavras dos comandos e dos lugares do mapa (gramatica()). Precisa do APK novo; o modelo de voz em português (32 MB)
# é baixado na primeira vez que liga e fica guardado no celular. Em inglês continua o do Android (com o botão).
const VOSK_URL := "https://alphacephei.com/vosk/models/vosk-model-small-pt-0.3.zip"
const VOSK_DIR := "user://voz/"
const VOSK_MODELO := "user://voz/vosk-model-small-pt-0.3"
var vosk = null
var _baixando: HTTPRequest = null
var _baixa_t := 0.0
var _pediu_t := -1000.0
var _unzip: Thread = null # desempacota fora do quadro (conselho 2026-11-14: travava o jogo uns segundos)

func _usa_vosk() -> bool:
	return vosk != null and Idioma.atual != "en"

func _botao() -> bool: # escuta com o botão: só no APK velho (ou em inglês)
	return MODO_BOTAO and not _usa_vosk()

func _vosk_ligar() -> void:
	if FileAccess.file_exists(VOSK_DIR + "pronto") and FileAccess.file_exists(VOSK_MODELO + "/final.mdl"):
		vosk.ligar(ProjectSettings.globalize_path(VOSK_MODELO), gramatica())
		return
	if _baixando != null or _unzip != null:
		return
	# conselho 2026-11-14: 32 MB sem perguntar. Na primeira vez avisa; ligar de novo (em até 2 min) baixa.
	var agora := Time.get_ticks_msec() / 1000.0
	if agora - _pediu_t > 120.0:
		_pediu_t = agora
		ligado = false
		m.hud.aviso(tr("A voz baixa 32 MB. Ligue de novo para baixar"))
		if m.menu_topo:
			m.menu_topo.voz_negada()
		return
	DirAccess.make_dir_recursive_absolute(VOSK_DIR)
	_baixando = HTTPRequest.new()
	_baixando.download_file = VOSK_DIR + "modelo.zip"
	_baixando.timeout = 600.0
	add_child(_baixando)
	_baixando.request_completed.connect(_baixou)
	if _baixando.request(VOSK_URL) != OK:
		_baixou(HTTPRequest.RESULT_CANT_CONNECT, 0, [], [])
		return
	_baixa_t = Time.get_ticks_msec() / 1000.0
	m.hud.aviso(tr("Baixando a voz (32 MB)..."))

func _progresso() -> void:
	var agora := Time.get_ticks_msec() / 1000.0
	if agora - _baixa_t < 4.0:
		return
	_baixa_t = agora
	var total := _baixando.get_body_size()
	if total > 0:
		m.hud.aviso(tr("Baixando a voz: %s%%") % str(int(100.0 * _baixando.get_downloaded_bytes() / total)))

func _baixou(res: int, codigo: int, _h, _b) -> void:
	var zip_path := VOSK_DIR + "modelo.zip"
	if _baixando != null:
		_baixando.queue_free()
		_baixando = null
	if res != HTTPRequest.RESULT_SUCCESS or codigo != 200:
		_falhou(zip_path)
		return
	m.hud.aviso(tr("Instalando a voz..."))
	_unzip = Thread.new()
	_unzip.start(_desempacotar.bind(zip_path))

func _falhou(zip_path: String) -> void:
	DirAccess.remove_absolute(zip_path)
	if ligado:
		ligado = false
		m.hud.aviso(tr("Não deu para baixar a voz"))
		if m.menu_topo:
			m.menu_topo.voz_negada()

func _desempacotou() -> void:
	var ok: bool = _unzip.wait_to_finish()
	_unzip = null
	var zip_path := VOSK_DIR + "modelo.zip"
	if not ok:
		_falhou(zip_path)
		return
	DirAccess.remove_absolute(zip_path)
	var f := FileAccess.open(VOSK_DIR + "pronto", FileAccess.WRITE)
	if f:
		f.store_string("vosk-model-small-pt-0.3")
		f.close()
	if ligado:
		_vosk_ligar()

func _desempacotar(zip_path: String) -> bool:
	var z := ZIPReader.new()
	if z.open(zip_path) != OK:
		return false
	for nome in z.get_files():
		if nome.contains(".."):
			continue
		var destino: String = VOSK_DIR + nome
		if nome.ends_with("/"):
			DirAccess.make_dir_recursive_absolute(destino)
			continue
		DirAccess.make_dir_recursive_absolute(destino.get_base_dir())
		var f := FileAccess.open(destino, FileAccess.WRITE)
		if f == null:
			z.close()
			return false
		f.store_buffer(z.read_file(nome))
		f.close()
	z.close()
	return FileAccess.file_exists(VOSK_MODELO + "/final.mdl")

func _vosk_desligar() -> void:
	if vosk != null:
		vosk.desligar()
	if _baixando != null:
		_baixando.cancel_request()
		_baixando.queue_free()
		_baixando = null
		DirAccess.remove_absolute(VOSK_DIR + "modelo.zip")

# as formas com acento que o modelo conhece (as sem acento das listas acima ficam de fora se ele não conhecer)
const FALA_EXTRA := ["pisão", "sísmico", "círculo", "égide", "abraço", "trás", "atrás", "lança", "explosão", "relâmpago", "fúria", "vórtice", "básico", "básica", "poção",
	"nível", "abrir", "abre", "desligar", "desliga", "voz", "microfone"]
const NUMEROS_FALA := ["zero", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez", "onze",
	"doze", "treze", "quatorze", "catorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove", "vinte", "trinta",
	"quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa", "cem", "cento", "duzentos", "trezentos"]
# depois de palavras() (sem acento, sem o "s" do fim): "três" = "tre", "dois" = "doi", "seis" = "sei"
const NUM_VAL := {"zero": 0, "doi": 2, "tre": 3, "quatro": 4, "cinco": 5, "sei": 6, "sete": 7, "oito": 8, "nove": 9,
	"dez": 10, "onze": 11, "doze": 12, "treze": 13, "quatorze": 14, "catorze": 14, "quinze": 15, "dezessei": 16,
	"dezessete": 17, "dezoito": 18, "dezenove": 19, "vinte": 20, "trinta": 30, "quarenta": 40, "cinquenta": 50,
	"sessenta": 60, "setenta": 70, "oitenta": 80, "noventa": 90, "cem": 100, "cento": 100, "duzento": 200, "trezento": 300}

# "imp quinze" -> ["imp", "15"]; "vinte cinco" (o "e" já saiu) -> "25"
static func juntar_numeros(ws: Array) -> Array:
	var r: Array = []
	var soma := -1
	for w in ws:
		if NUM_VAL.has(w):
			soma = (0 if soma < 0 else soma) + int(NUM_VAL[w])
			continue
		if soma >= 0:
			r.append(str(soma))
			soma = -1
		r.append(w)
	if soma >= 0:
		r.append(str(soma))
	return r

static func _tokens(t: String) -> Array: # palavras de um nome, com acento (como o modelo escreve)
	var limpo := ""
	for ch in t.to_lower():
		limpo += ch if ch.to_upper() != ch.to_lower() else " "
	return Array(limpo.split(" ", false))

# lista JSON das palavras que o Vosk pode ouvir: comandos, números e os nomes dos lugares do mapa
func gramatica() -> String:
	var ws := {}
	for d in [SKILLS, SKILLS_Q, ANDAR, ACOES]:
		for k in d:
			ws[k] = true
	for a in [PARAR, MAPA, FECHAR, ENCHE, FALA_EXTRA, NUMEROS_FALA]:
		for k in a:
			ws[k] = true
	if m.minimapa != null and m.heroi != null:
		for l in m.minimapa._lugares():
			for w in _tokens(str(l.get("curto", ""))) + _tokens(str(l.get("nome", "")).split("  (")[0]):
				ws[w] = true
	var r: Array = ws.keys()
	r.append("[unk]")
	return JSON.stringify(r)

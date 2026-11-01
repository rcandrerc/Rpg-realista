extends RefCounted
# Progressão do herói (ideia do Quimera), igual a shared/progresso.js: nível e XP, atributos, skills que sobem
# de nível usando e os 6 botões da tela. Online quem decide é o servidor (chega no evento "prog");
# sem internet o app usa as mesmas contas, a partir do último progresso da conta (treino: não grava na conta).
# Os números das skills vêm de dados/habilidades.json (gerado por client/exportar-godot/mundo.mjs).

const ARQUIVO := "user://progresso.cfg" # última cópia do progresso da conta (para jogar sem internet)

var dados: Dictionary # habilidades.json
var habs: Dictionary
var prog := {}
var st := {} # números do herói: vidaMax, manaMax, defesa, danoFisico...
var xp_prox := 16
var mudou := false # o menu redesenha quando muda

# ícone (icones/*.svg) e cores dos efeitos (efeitos.gd FXCOR) de cada skill
const ICONE := {"espada_basico": "basico", "cajado_basico": "magia", "corte_duplo": "corte", "giro": "giro", "golpe_esmagador": "salto",
	"pisao_sismico": "fenda", "investida": "investida", "bola_fogo": "bola", "anel_chamas": "explosao", "meteoro": "meteoros",
	"nova_gelo": "gelo", "raio_cadeia": "raio", "salto_arcano": "salto_arcano", "cura_floresta": "cura", "escudo_arcano": "barreira", "vortice": "vortice"}
const FX := {"espada_basico": "giro", "cajado_basico": "magia", "corte_duplo": "relampago", "giro": "giro", "golpe_esmagador": "salto",
	"pisao_sismico": "salto", "investida": "investida", "bola_fogo": "bola", "anel_chamas": "explosao", "meteoro": "meteoros",
	"nova_gelo": "gelo", "raio_cadeia": "raio", "salto_arcano": "magia", "cura_floresta": "cura", "escudo_arcano": "escudo", "vortice": "vortice"}

func _init() -> void:
	dados = JSON.parse_string(FileAccess.get_file_as_string("res://dados/habilidades.json"))
	habs = dados.habs
	var cfg := ConfigFile.new()
	var p = null
	if cfg.load(ARQUIVO) == OK:
		p = JSON.parse_string(str(cfg.get_value("conta", "progresso", "")))
	definir(p if p is Dictionary else novo())

func novo() -> Dictionary:
	return {"nivel": 1, "xp": 0, "pontos": 0, "atr": {"for": 3, "des": 3, "int": 3, "vit": 3}, "habs": {}, "botoes": dados.botoesPadrao.duplicate()}

func definir(p: Dictionary) -> void:
	prog = p
	for k in ["nivel", "xp", "pontos"]:
		prog[k] = int(prog.get(k, 0))
	if not prog.has("atr"):
		prog.atr = novo().atr
	for k in prog.atr:
		prog.atr[k] = int(prog.atr[k])
	if not prog.has("habs") or not (prog.habs is Dictionary):
		prog.habs = {}
	if not (prog.get("botoes") is Array) or prog.botoes.size() != int(dados.nBotoes):
		prog.botoes = dados.botoesPadrao.duplicate()
	st = calcular_status()
	xp_prox = xp_proximo(prog.nivel)
	mudou = true

# veio do servidor: vale o que ele diz (e guarda uma cópia para jogar sem internet)
func do_servidor(ev: Dictionary) -> void:
	definir(ev.prog)
	if ev.has("st"):
		for k in ev.st:
			st[k] = float(ev.st[k])
	var cfg := ConfigFile.new()
	cfg.set_value("conta", "progresso", JSON.stringify(prog))
	cfg.save(ARQUIVO)

static func xp_proximo(n: int) -> int:
	return int(round(16.0 * pow(n, 1.45)))

func passiva(k: String) -> bool:
	return prog.nivel >= int(dados.passivas[k].libera)

func calcular_status() -> Dictionary:
	var a: Dictionary = prog.atr
	var n: int = prog.nivel
	var nivel_k := 1.0 + 0.08 * (n - 1)
	var defesa: float = a["for"] + (3 if passiva("pele_pedra") else 0)
	return {
		"vidaMax": round(84 + 8 * a.vit + 4 * a["for"] + 6 * (n - 1)),
		"manaMax": round((82 + 6 * a.int + 2 * (n - 1)) * (1.1 if passiva("mente_arcana") else 1.0)),
		"regenMana": 7.0 + (0.3 if passiva("mente_arcana") else 0.0),
		"regenVida": 0.1 * a.vit,
		"defesa": defesa, "reducao": defesa / (defesa + 24.0),
		"danoFisico": 10.0 * nivel_k * (1 + 0.06 * (a["for"] - 3)),
		"danoMagico": 10.0 * nivel_k * (1 + 0.06 * (a.int - 3)),
		"critico": min(1.0, 0.0455 + 0.0015 * a.des + (0.02 if passiva("sorte_arcana") else 0.0)),
		"recarga": min(0.4, 0.0133 * a.des),
	}

func nivel_de(id: String) -> int:
	return int(prog.habs.get(id, {}).get("nv", 1))

func uso_de(id: String) -> int:
	return int(prog.habs.get(id, {}).get("uso", 0))

static func usos_para_subir(nv: int) -> int:
	return 6 + 4 * nv

func maximo(id: String) -> int:
	return int(habs[id].get("max", dados.skillMax))

func liberada(id: String) -> bool:
	return prog.nivel >= int(habs[id].libera)

# números da skill no nível nv (dano +15%, área +5%, recarga -6% por nível), como habNoNivel
func hab_nivel(id: String, nv := -1) -> Dictionary:
	if nv < 0:
		nv = nivel_de(id)
	var h: Dictionary = habs[id].duplicate(true)
	var k := nv - 1
	h.nv = nv
	h.pct = float(h.get("pct", 0)) * (1 + 0.15 * k)
	if h.has("area"):
		h.area = snappedf(h.area * (1 + 0.05 * k), 0.01)
	if h.has("cd") and not h.get("basico", false):
		h.cd = snappedf(h.cd * (1 - 0.06 * k), 0.01)
	if h.has("combo"):
		for c in h.combo:
			c.pct = c.pct * (1 + 0.15 * k)
	if h.has("escudo"):
		h.escudo.absorve = round(h.escudo.absorve * (1 + 0.15 * k))
	if h.has("curaPct"):
		h.curaPct = h.curaPct * (1 + 0.08 * k)
	if h.has("salto"):
		h.salto = snappedf(h.salto * (1 + 0.04 * k), 0.01)
	return h

# pronta para usar: dano em pontos (pelo atributo da árvore) e recarga com a Destreza
func hab_pronta(id: String) -> Dictionary:
	var h := hab_nivel(id)
	var dano: float = st.danoMagico if h.arvore == "cajado" else st.danoFisico if h.arvore == "espada" else max(st.danoFisico, st.danoMagico)
	h.dmg = dano * h.pct
	if h.has("combo"):
		for c in h.combo:
			c.dmg = dano * c.pct
	if h.has("cd") and not h.get("basico", false):
		h.cd = h.cd * (1 - st.recarga)
	return h

# ---------- texto do menu (igual ao Quimera: "Dano 220% · Área 2,2 m · Mana 10 · Recarga 1,1 s") ----------
static func num(v: float, casas := 1) -> String:
	var s := str(snappedf(v, pow(10, -casas)))
	if s.ends_with(".0"):
		s = s.substr(0, s.length() - 2)
	return s.replace(".", ",")

func linha(h: Dictionary) -> String:
	var p := []
	if h.has("combo"):
		p.append("Dano %s%%–%s%%" % [num(h.combo[0].pct * 100, 0), num(h.combo[-1].pct * 100, 0)])
	elif h.get("pct", 0) > 0:
		var golpes: int = h.hits.size() if h.has("hits") else 1
		p.append("Dano %s%%%s" % [num(h.pct * 100, 0), (" ×%d" % golpes) if golpes > 1 else ""])
	if h.has("area"):
		p.append("Raio %s m" % num(h.area))
	if h.has("proj") and h.proj.has("explosao"):
		p.append("Área %s m" % num(h.proj.explosao))
	if h.has("chuva"):
		p.append("Raio %s m" % num(h.chuva.r))
	if h.has("raios"):
		p.append("Alvos %d" % int(h.raios.n))
	if h.has("salto"):
		p.append("Distância %s m" % num(h.salto))
	if h.has("avanco") and h.get("dash", false):
		p.append("Distância %s m" % num(h.avanco, 0))
	if h.has("curaPct"):
		p.append("Cura %s%%" % num(h.curaPct * 100, 0))
		if h.has("grupo"):
			p.append("Grupo (%s m) %s%%" % [num(h.grupo.r, 0), num(h.grupo.pct * 100, 0)])
	if h.has("escudo"):
		p.append("Absorve %d · Duração %s s" % [int(h.escudo.absorve), num(h.escudo.dur, 0)])
	if h.has("puxa"):
		p.append("Puxa (%s m)" % num(h.puxa.r))
	if h.has("atordoa"):
		p.append("Atordoa %s s" % num(h.atordoa))
	if h.has("congela"):
		p.append("Congela %s s" % num(h.congela))
	if h.has("lento"):
		p.append("Lentidão %s%% · %s s" % [num(h.lento.k * 100, 0), num(h.lento.dur, 0)])
	if h.has("vulneravel"):
		p.append("Dano recebido +%s%% · %s s" % [num(h.vulneravel.k * 100, 0), num(h.vulneravel.dur, 0)])
	p.append(("Mana %d" % int(h.mana)) if h.get("mana", 0) > 0 else "Sem mana")
	if not h.get("basico", false):
		p.append("Recarga %s s" % num(h.cd))
	return " · ".join(p)

func proximo(id: String) -> String:
	var nv := nivel_de(id)
	if nv >= maximo(id):
		return "Nível máximo"
	var a := hab_nivel(id, nv)
	var b := hab_nivel(id, nv + 1)
	var p := []
	if b.get("pct", 0) > 0:
		p.append("Dano %s%%" % num(b.pct * 100, 0))
	if b.has("area"):
		p.append("Raio %s m" % num(b.area))
	if b.has("salto"):
		p.append("Distância %s m" % num(b.salto))
	if b.has("escudo"):
		p.append("Absorve %d" % int(b.escudo.absorve))
	if b.has("curaPct"):
		p.append("Cura %s%%" % num(b.curaPct * 100, 0))
	if b.get("cd", 0) != a.get("cd", 0):
		p.append("Recarga %s s" % num(b.cd))
	return "Próximo: " + " · ".join(p)

# ---------- sem internet: as mesmas regras do servidor, só neste celular ----------
func ganhar_xp(n: int) -> String:
	if prog.nivel >= int(dados.nivelMax):
		return ""
	prog.xp += n
	var subiu := false
	while prog.nivel < int(dados.nivelMax) and prog.xp >= xp_proximo(prog.nivel):
		prog.xp -= xp_proximo(prog.nivel)
		prog.nivel += 1
		prog.pontos += int(dados.pontosPorNivel)
		subiu = true
	st = calcular_status()
	xp_prox = xp_proximo(prog.nivel)
	mudou = true
	return ("Nível %d! +%d pontos de atributo" % [prog.nivel, int(dados.pontosPorNivel)]) if subiu else ""

func contar_uso(id: String) -> String:
	if habs[id].get("basico", false):
		return ""
	var s: Dictionary = prog.habs.get(id, {"nv": 1, "uso": 0})
	prog.habs[id] = s
	if int(s.nv) >= maximo(id):
		return ""
	s.uso = int(s.uso) + 1
	mudou = true
	if s.uso >= usos_para_subir(int(s.nv)):
		s.uso = 0
		s.nv = int(s.nv) + 1
		return "%s subiu para Nv %d" % [habs[id].nome, s.nv]
	return ""

func distribuir(k: String) -> bool:
	if prog.pontos <= 0 or not prog.atr.has(k):
		return false
	prog.atr[k] += 1
	prog.pontos -= 1
	st = calcular_status()
	mudou = true
	return true

# põe a skill no botão i (se já estava em outro, troca de lugar)
func por_no_botao(id: String, i: int) -> void:
	var b: Array = prog.botoes
	var antes := b.find(id)
	if antes >= 0:
		b[antes] = b[i]
	b[i] = id
	mudou = true

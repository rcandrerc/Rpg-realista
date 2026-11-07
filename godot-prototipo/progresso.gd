extends RefCounted
# Progressão do herói (ideia do Quimera), igual a shared/progresso.js: nível e XP, atributos, skills que sobem
# de nível usando e as duas barras de 6 botões (a da espada e a do cajado; Trocar mostra a outra). Online quem decide é o servidor (chega no evento "prog");
# sem internet o app usa as mesmas contas, a partir do último progresso da conta (treino: não grava na conta).
# Os números das skills vêm de dados/habilidades.json (gerado por client/exportar-godot/mundo.mjs).

const ARQUIVO := "user://progresso.cfg" # última cópia do progresso da conta (para jogar sem internet)

var dados: Dictionary # habilidades.json
var habs: Dictionary
var prog := {}
var st := {} # números do herói: vidaMax, manaMax, defesa, danoFisico...
var xp_prox := 16
var teste := false # conta de teste do André: o menu mostra os botões de mudar o nível (o servidor confere)
var mudou := false # o menu redesenha quando muda
var relogio := 0.0 # ms: relógio do servidor - relógio do celular (o vigor enche pelo relógio do servidor)

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
	var mochila := []
	mochila.resize(int(dados.mochila))
	mochila[0] = {"k": "pocao", "n": 3}
	mochila[1] = {"k": "pocao_mana", "n": 2}
	return {"nivel": 1, "xp": 0, "pontos": 0, "atr": {"for": 3, "des": 3, "int": 3, "vit": 3}, "habs": {}, "barras": dados.botoesPadrao.duplicate(true),
		"ouro": 20, "mochila": mochila, "paginas": 1, "equip": {}, "vigor": {"v": float(dados.vigor.max), "t": agora_ms()}, "prof": {}}

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
	var barras = prog.get("barras")
	if not (barras is Dictionary):
		barras = {}
	for b in ["espada", "cajado"]:
		if not (barras.get(b) is Array) or barras[b].size() != int(dados.nBotoes):
			barras[b] = dados.botoesPadrao[b].duplicate()
	prog.barras = barras
	prog.erase("botoes")
	# mochila e equipamento (o JSON traz número como float: volta para int)
	if not (prog.get("mochila") is Array):
		var n := novo()
		prog.mochila = n.mochila
		prog.ouro = n.ouro
	# páginas da mochila (André 2026-11-03): cada uma tem dados.mochila lugares (10 x 4); começa com 1 e compra até 4.
	# Nada some: a mochila só cresce até as páginas que a conta tem, nunca corta lugar com item.
	prog.paginas = clampi(int(prog.get("paginas", 1)), 1, int(dados.get("mochilaPaginas", 1)))
	prog.mochila.resize(max(prog.mochila.size(), int(dados.mochila) * int(prog.paginas)))
	for i in prog.mochila.size():
		prog.mochila[i] = item_int(prog.mochila[i])
	prog.ouro = int(prog.get("ouro", 0))
	prog.semCapacete = prog.get("semCapacete", false) == true
	if not (prog.get("equip") is Dictionary):
		prog.equip = {}
	for l in dados.lugares:
		prog.equip[l] = item_int(prog.equip.get(l))
	# vigor e profissões (Parte 3)
	var vg = prog.get("vigor")
	if not (vg is Dictionary) or not vg.has("v") or not vg.has("t"):
		vg = {"v": float(dados.vigor.max), "t": agora_ms()}
	prog.vigor = {"v": float(vg.v), "t": float(vg.t)}
	var pf = prog.get("prof")
	if not (pf is Dictionary):
		pf = {}
	for k in dados.profissoes:
		pf[k] = float(pf.get(k, 0.0))
	prog.prof = pf
	st = calcular_status()
	xp_prox = xp_proximo(prog.nivel)
	mudou = true

# veio do servidor: vale o que ele diz (e guarda uma cópia para jogar sem internet)
func do_servidor(ev: Dictionary) -> void:
	if ev.has("agora"):
		relogio = float(ev.agora) - Time.get_unix_time_from_system() * 1000.0
	definir(ev.prog)
	teste = bool(ev.get("teste", false))
	if ev.has("st"):
		for k in ev.st:
			st[k] = float(ev.st[k])
	_guardar_t = GUARDAR_DEPOIS if _guardar_t < 0.0 else _guardar_t

# Cópia no celular do progresso que veio do servidor. Desempenho (2026-11-03): cada monstro morto manda o progresso
# (XP) e o jogo gravava o arquivo na hora, no meio do quadro: no Android isso dá um tranco bem na morte do bicho.
# Agora grava no máximo a cada GUARDAR_DEPOIS s, fora do quadro (WorkerThreadPool), e na hora quando o app vai para
# o fundo ou fecha (main.gd _notification). O servidor continua sendo quem guarda de verdade.
const GUARDAR_DEPOIS := 8.0
var _guardar_t := -1.0 # s para gravar; -1 = nada pendente
var _tarefa := -1
func passo(dt: float) -> void:
	if _guardar_t < 0.0:
		return
	_guardar_t -= dt
	if _guardar_t > 0.0:
		return
	if _tarefa >= 0 and not WorkerThreadPool.is_task_completed(_tarefa):
		return # a gravação anterior ainda não terminou: tenta no próximo quadro
	if _tarefa >= 0:
		WorkerThreadPool.wait_for_task_completion(_tarefa)
	_guardar_t = -1.0
	var txt := JSON.stringify(prog)
	_tarefa = WorkerThreadPool.add_task(func():
		var cfg := ConfigFile.new()
		cfg.set_value("conta", "progresso", txt)
		cfg.save(ARQUIVO))

func guardar_agora() -> void:
	if _tarefa >= 0:
		WorkerThreadPool.wait_for_task_completion(_tarefa)
		_tarefa = -1
	if _guardar_t < 0.0:
		return
	_guardar_t = -1.0
	var cfg := ConfigFile.new()
	cfg.set_value("conta", "progresso", JSON.stringify(prog))
	cfg.save(ARQUIVO)

static func xp_proximo(n: int) -> int:
	return int(round(16.0 * pow(n, 1.45) * (1.0 + max(0, n - 30) / 50.0))) # igual a shared/progresso.js (Nv 200)

func passiva(k: String) -> bool:
	return prog.nivel >= int(dados.passivas[k].libera)

# regeneração do Quimera (dados.regen vem de shared/dados.js REGEN); o padrão aqui é o mesmo, para pacote antigo sem a chave
func regen() -> Dictionary:
	if dados is Dictionary and dados.has("regen"):
		return dados.regen
	return {"vida": 1.0, "vidaNivel": 0.05, "vidaVit": 0.25, "vidaCombate": 0.0, "mana": 1.1, "manaNivel": 0.07, "manaInt": 0.05, "manaMente": 0.3, "manaCombate": 0.35}

func calcular_status() -> Dictionary:
	var a: Dictionary = prog.atr
	var n: int = prog.nivel
	var eq := bonus_equip()
	var nivel_k := 1.0 + 0.08 * (n - 1)
	var R: Dictionary = regen()
	var defesa: float = a["for"] + (3 if passiva("pele_pedra") else 0) + eq.defesa
	return {
		"vidaMax": round(84 + 8 * a.vit + 4 * a["for"] + 6 * (n - 1) + eq.vida),
		"manaMax": round((82 + 6 * a.int + 2 * (n - 1) + eq.mana) * (1.1 if passiva("mente_arcana") else 1.0)),
		# fora de combate (REGEN de shared/dados.js, números do Quimera); em luta main.gd aplica vidaCombate/manaCombate
		"regenMana": (float(R.mana) + float(R.manaNivel) * n + float(R.manaInt) * a.int + (float(R.manaMente) if passiva("mente_arcana") else 0.0)) * (1.0 + eq.regenManaK),
		"regenVida": float(R.vida) + float(R.vidaNivel) * n + float(R.vidaVit) * a.vit,
		"defesa": defesa, "reducao": defesa / (defesa + 24.0),
		"danoFisico": (10.0 * nivel_k * (1 + 0.06 * (a["for"] - 3)) + eq.danoFisico) * (1.0 + eq.danoK),
		"danoMagico": (10.0 * nivel_k * (1 + 0.06 * (a.int - 3)) + eq.danoMagico) * (1.0 + eq.danoK),
		"critico": min(1.0, 0.0455 + 0.0015 * a.des + (0.02 if passiva("sorte_arcana") else 0.0) + eq.critico),
		"recarga": min(0.4, 0.0133 * a.des),
		"areaK": eq.areaK,
		"estaminaMax": round(float(dados.estamina.base) + float(dados.estamina.porNivel) * n + float(dados.estamina.porDes) * a.des),
	}

# ---------- vigor e profissões (igual a shared/progresso.js; dados de shared/dados.js) ----------
func agora_ms() -> float:
	return Time.get_unix_time_from_system() * 1000.0 + relogio

func vigor() -> float:
	var s: float = max(0.0, agora_ms() - float(prog.vigor.t)) / 1000.0
	return min(float(dados.vigor.max), float(prog.vigor.v) + s / float(dados.vigor.enche) * float(dados.vigor.max))

# segundos até o vigor encher
func vigor_cheio_em() -> float:
	return (float(dados.vigor.max) - vigor()) / float(dados.vigor.max) * float(dados.vigor.enche)

static func prof_nivel_pts(pts: float, maxn: int) -> int:
	return min(maxn, int(floor(sqrt(pts / 8.0))) + 1)

func prof_nivel(k: String) -> int:
	return prof_nivel_pts(float(prog.prof.get(k, 0.0)), int(dados.profMax))

static func prof_pontos(nv: int) -> float:
	return 8.0 * (nv - 1) * (nv - 1)

static func prof_rank(nv: int) -> int:
	return 10 if nv >= 20 else 9 if nv >= 19 else int((nv - 1) / 2)

# o que o rank dá: menos vigor, rapidez e chance de +1 na coleta
func prof_bonus(k: String) -> Dictionary:
	var r := prof_rank(prof_nivel(k))
	return {"rank": r, "menosVigor": 0.04 * r, "rapidez": 1.0 + 0.035 * r, "extra": 0.02 * r}

func mercador() -> Dictionary:
	var f: float = float(prof_nivel("mer") - 1) / float(int(dados.profMax) - 1)
	return {"venda": float(dados.mercador.venda) * f, "compra": float(dados.mercador.compra) * f}

func chance_raridade(k: String) -> float:
	var R: Dictionary = dados.raridadeCriar
	return float(R.base) + (float(R.max) - float(R.base)) * float(prof_nivel(k) - 1) / float(int(dados.profMax) - 1)

func custo_vigor(k: String, base: float) -> float:
	return base * (1.0 - prof_bonus(k).menosVigor)

# quantos de um material tem na mochila
func contar(k: String) -> int:
	var n := 0
	for o in prog.mochila:
		if o != null and o.k == k and not o.has("h"):
			n += int(o.get("n", 1))
	return n

func preco_compra(o: Dictionary) -> int:
	return max(1, int(round(float(o.preco) * (1.0 - mercador().compra))))

# ---------- mochila e equipamento (igual a shared/progresso.js; os dados vêm de shared/dados.js) ----------
static func item_int(it):
	if not (it is Dictionary) or not it.has("k"):
		return null
	var r := {"k": "peitoral" if str(it.k) == "manto" else "colar" if str(it.k) == "oculos" else str(it.k)} # conta antiga: o Manto virou Peitoral; Óculos virou Colar (André 2026-11-03)
	for c in ["r", "n", "nv", "d", "e"]: # d: durabilidade gasta (sem d = inteira; MORTE em shared/dados.js) · e: reforço (+1, +2...)
		if it.has(c):
			r[c] = int(it[c])
	if it.has("h"):
		r.h = str(it.h)
	return r

func eh_equip(it) -> bool:
	return it is Dictionary and dados.itens.has(it.k) and dados.itens[it.k].has("lugar")

# quantas peças de cada raridade (ou melhor) estão no corpo; a Arma conta pela melhor entre espada e cajado
func pecas_conjunto() -> Array:
	var r := func(l): return int(prog.equip[l].r) if prog.equip.get(l) != null and not quebrado(prog.equip[l]) else -1 # quebrada não conta
	var lugares := [r.call("cabeca"), r.call("corpo"), r.call("pernas"), r.call("capa"), r.call("pes"), r.call("acessorio"), max(r.call("espada"), r.call("cajado"))]
	var n := []
	for i in dados.raridades.size():
		n.append(lugares.filter(func(x): return x >= i).size())
	return n

# o melhor bônus de conjunto para 2, 3 e 6 peças: {"2": raridade, ...} (0 = nenhum)
func conjunto_ativo() -> Dictionary:
	var n := pecas_conjunto()
	var r := {}
	for t in ["2", "3", "6"]:
		r[t] = 0
		for i in range(1, dados.conjunto.size()):
			if n[i] >= int(t):
				r[t] = i
	return r

func bonus_equip() -> Dictionary:
	var b := {"vida": 0.0, "mana": 0.0, "defesa": 0.0, "critico": 0.0, "danoFisico": 0.0, "danoMagico": 0.0, "danoK": 0.0, "areaK": 0.0, "regenManaK": 0.0}
	if not prog.has("equip"):
		return b
	for l in dados.lugares:
		var it = prog.equip.get(l)
		if it == null or not dados.itens.has(it.k) or quebrado(it): # quebrada: sem bônus até o Tomás consertar
			continue
		var st: Dictionary = dados.itens[it.k].st
		for c in st:
			b[c] += float(st[c][int(it.r)]) * reforco_k(it, c)
	var ativo := conjunto_ativo()
	for t in ativo:
		if ativo[t] > 0:
			var bon: Dictionary = dados.conjunto[ativo[t]][t]
			for c in bon:
				b[c] += float(bon[c])
	return b

# ---------- reforço de equipamento (igual a shared/progresso.js; REFORCO em shared/dados.js, como no Quimera) ----------
func reforco_dados() -> Dictionary:
	return dados.get("reforco", {"max": [0, 5, 10, 15, 20], "chance": [100, 80, 75, 70, 66, 62, 59, 56, 53, 50, 48, 46, 44, 42, 40, 38, 36, 34, 32, 30],
		"custo": {"base": 10, "porRaridade": 12, "sobe": 1.07}, "seguro": 5, "bonus": 0.4, "bonusCritico": 0.2, "atributo": {"livre": 2, "porNivel": 10}, "tempo": 1.6})

# multiplicador de um número da peça pelo reforço (+0 = 1; o crítico sobe a metade)
func reforco_k(it, c: String) -> float:
	var e := int(it.get("e", 0)) if it is Dictionary else 0
	var R := reforco_dados()
	return 1.0 + float(R.bonusCritico if c == "critico" else R.bonus) * e

func reforco_max(it) -> int:
	return int(reforco_dados().max[int(it.r)]) if eh_equip(it) else 0

func chance_reforco(e: int) -> int:
	var ch: Array = reforco_dados().chance
	return int(ch[min(e, ch.size() - 1)])

func custo_reforco(it) -> int:
	var C: Dictionary = reforco_dados().custo
	return int(round((float(C.base) + float(C.porRaridade) * int(it.r)) * pow(float(C.sobe), int(it.get("e", 0)))))

func reforco_falhou(e: int) -> int:
	var s := int(reforco_dados().seguro)
	return max(int(floor(float(e) / s)) * s, e - 1)

# atributo que a peça pede para chegar no reforço e: [chave ("for", "int" ou "maior"), quanto] (0 = não pede)
func reforco_precisa(it, e: int) -> Array:
	var A: Dictionary = reforco_dados().atributo
	var n := 0 if e <= int(A.livre) else int(A.porNivel) * e
	var l: String = dados.itens[it.k].lugar
	return ["for" if l == "espada" else "int" if l == "cajado" else "maior", n]

func atributo_reforco(k: String) -> int:
	var a: Dictionary = prog.get("atr", {})
	return max(int(a.get("for", 0)), int(a.get("int", 0))) if k == "maior" else int(a.get(k, 0))

static func nome_atributo_reforco(k: String) -> String:
	return "Força" if k == "for" else "Inteligência" if k == "int" else "Força ou Inteligência"

# por que não dá para tentar agora ("" = dá)
func reforco_erro(it) -> String:
	if not eh_equip(it):
		return "Só equipamento se reforça"
	var e := int(it.get("e", 0))
	if reforco_max(it) <= 0:
		return "Peça Comum não dá pra reforçar"
	if e >= reforco_max(it):
		return "Reforço no máximo!"
	var pr := reforco_precisa(it, e + 1)
	if atributo_reforco(pr[0]) < int(pr[1]):
		return "Precisa %d de %s (você tem %d). Suba o atributo pra reforçar mais" % [pr[1], nome_atributo_reforco(pr[0]), atributo_reforco(pr[0])]
	if int(prog.ouro) < custo_reforco(it):
		return "Ouro insuficiente (%d/%d)" % [int(prog.ouro), custo_reforco(it)]
	return ""

# sem internet: tenta aqui mesmo (online quem sorteia é o servidor). Devolve como o evento 'reforco' do servidor
func reforcar(it) -> Dictionary:
	var erro := reforco_erro(it)
	if erro != "":
		return {"erro": erro}
	var de := int(it.get("e", 0))
	var custo := custo_reforco(it)
	prog.ouro = int(prog.ouro) - custo
	var ok: bool = randf() * 100.0 < chance_reforco(de)
	var e := de + 1 if ok else reforco_falhou(de)
	if e > 0:
		it.e = e
	else:
		it.erase("e")
	st = calcular_status()
	mudou = true
	return {"ok": ok, "de": de, "e": e, "custo": custo, "nome": nome_item(it)}

# ---------- durabilidade e penalidade de morte (igual a shared/progresso.js; MORTE em shared/dados.js) ----------
func morte_dados() -> Dictionary:
	return dados.get("morte", {"ouro": 0.1, "desgaste": 10, "durMax": 100, "conserto": 0.3})

func durab(it) -> int:
	return int(it.d) if it is Dictionary and it.has("d") else int(morte_dados().durMax)

func quebrado(it) -> bool:
	return eh_equip(it) and durab(it) <= 0

func custo_conserto(it) -> int:
	var M := morte_dados()
	if not eh_equip(it) or durab(it) >= int(M.durMax):
		return 0
	return max(1, int(ceil(float(int(M.durMax) - durab(it)) / float(M.durMax) * float(dados.vendaEquip[int(it.r)]) * float(M.conserto))))

# ouro para consertar tudo (corpo e mochila)
func custo_conserto_tudo() -> int:
	var t := 0
	for l in dados.lugares:
		t += custo_conserto(prog.equip.get(l))
	for it in prog.mochila:
		t += custo_conserto(it)
	return t

# sem internet: o Tomás conserta aqui mesmo. Devolve o aviso
func consertar_tudo() -> String:
	var custo := custo_conserto_tudo()
	if custo <= 0:
		return "Nada para consertar: está tudo inteiro"
	if int(prog.ouro) < custo:
		return "O conserto custa %d de ouro (faltam %d)" % [custo, custo - int(prog.ouro)]
	var n := 0
	for l in dados.lugares:
		if custo_conserto(prog.equip.get(l)) > 0:
			prog.equip[l].erase("d")
			n += 1
	for it in prog.mochila:
		if custo_conserto(it) > 0:
			it.erase("d")
			n += 1
	prog.ouro = int(prog.ouro) - custo
	st = calcular_status()
	mudou = true
	return "Tomás consertou %d %s por %d de ouro" % [n, "peça" if n == 1 else "peças", custo]

# sem internet, caiu: perde parte do ouro e o equipamento do corpo desgasta. Devolve o texto para quando levantar
func penalidade_morte() -> String:
	var M := morte_dados()
	var ouro := int(floor(int(prog.ouro) * float(M.ouro)))
	prog.ouro = int(prog.ouro) - ouro
	var quebrou := []
	for l in dados.lugares:
		var it = prog.equip.get(l)
		if not eh_equip(it):
			continue
		var antes := durab(it)
		if antes <= 0:
			continue
		it["d"] = max(0, antes - int(M.desgaste))
		if int(it.d) == 0:
			quebrou.append(nome_item(it))
	st = calcular_status()
	mudou = true
	var t := (". Perdeu %d de ouro" % ouro) if ouro > 0 else ""
	t += ". O equipamento desgastou"
	if quebrou.size() > 0:
		t += "; quebrou: %s (o Tomás conserta)" % ", ".join(quebrou)
	return t

func nome_item(it) -> String:
	if not (it is Dictionary) or not dados.itens.has(it.k):
		return ""
	if eh_equip(it):
		return "%s %s" % [dados.itens[it.k].nome, dados.raridades[int(it.r)].nome] + (" +%d" % int(it.e) if int(it.get("e", 0)) > 0 else "")
	if it.k == "tomo":
		return "%s %s" % [habs[it.h].tomo, dados.romano[int(it.nv)]]
	return dados.itens[it.k].nome

const COR_MAT := {"minerio_ferro": "b9b2a6", "minerio_cobre": "d99060", "cristal": "a98cff", "lenha": "c79a62", "barra_ferro": "d6dbe0",
	"barra_cobre": "e8a06a", "carvao": "4a4644", "pedra": "9a958c", "barra_aco": "9fb0c2", "couro": "b07a4a", "tecido": "c9a6e8"}
func cor_item(it) -> Color:
	if eh_equip(it):
		return Color(dados.raridades[int(it.r)].cor)
	if COR_MAT.has(it.k):
		return Color(COR_MAT[it.k])
	if dados.itens.has(it.k) and dados.itens[it.k].has("cor"): # sementes e colheita da horta (cor da planta)
		return Color(str(dados.itens[it.k].cor))
	if it.k == "pocao":
		return Color("ff6b5e")
	if it.k == "pocao_mana":
		return Color("5aa8ff")
	if it.k == "tomo":
		return Color("d9b4ff")
	return Color.WHITE

# o que se colhe na horta da Vila dos Lotes (shared/dados.js PLANTAS): ícone de colheita na cor da planta
const COLHEITA := ["rabanete", "cenoura", "batata", "tomate", "milho", "abobora"]
static func icone_item(it) -> String:
	# pintado em icones/itens/<k>.png vem primeiro (minérios, barras, colheita, sementes... ganharam pintura própria em 2026-11-06)
	if not (it.has("r") and int(it.r) >= (2 if it.k == "calca" else 1) and ResourceLoader.exists("res://icones/itens/%s_aco.png" % it.k)) \
			and ResourceLoader.exists("res://icones/itens/%s.png" % it.k):
		return "it_" + str(it.k)
	if str(it.k).begins_with("barra_"):
		return "it_barra"
	if str(it.k).begins_with("minerio_") or it.k == "carvao" or it.k == "pedra":
		return "it_minerio"
	if str(it.k).begins_with("semente_"): # Vila dos Lotes: sementes e o que se colhe na horta (cor de cada planta)
		return "it_semente"
	if it.k in COLHEITA:
		return "it_colheita"
	if str(it.k).begins_with("obra_"): # peças da construção (criar e colocar, 2026-11-04): o mesmo ícone da barra
		return "cs_" + str(it.k).substr(5)
	if it.k == "enxada":
		return "cs_enxada"
	if it.k == "regador":
		return "cs_regar"
	# pintado em icones/itens/<k>.png; armadura do Raro em diante é de aço (<k>_aco.png)
	if it.has("r") and int(it.r) >= (2 if it.k == "calca" else 1) and ResourceLoader.exists("res://icones/itens/%s_aco.png" % it.k):
		return "it_%s_aco" % it.k
	if ResourceLoader.exists("res://icones/itens/%s.png" % it.k):
		return "it_" + str(it.k)
	return "it_" + ("pocao" if it.k == "pocao_mana" else str(it.k))

func eh_mat(it) -> bool:
	return it is Dictionary and dados.itens.has(it.k) and dados.itens[it.k].get("mat", false)

func preco_venda(it) -> int:
	var v := 0
	if eh_equip(it):
		v = int(dados.vendaEquip[int(it.r)])
	elif it.k == "tomo":
		v = int(dados.vendaTomo) * int(it.nv)
	else:
		v = int(dados.itens[it.k].get("venda", 1))
	return int(round(v * (1.0 + mercador().venda)))

const NOME_ST := {"vida": "Vida", "mana": "Mana", "defesa": "Defesa", "critico": "Crítico", "danoFisico": "Dano físico", "danoMagico": "Dano mágico",
	"danoK": "Dano", "areaK": "Área das skills", "regenManaK": "Regeneração de mana"}
static func texto_st(c: String, v: float) -> String:
	if c in ["critico", "danoK", "areaK", "regenManaK"]:
		return "+%s%% %s" % [num(v * 100, 1), NOME_ST[c]]
	return "+%s %s" % [num(v, 0), NOME_ST[c]]

# o que a peça dá: "+3 Defesa · +7 Vida"
func texto_item(it) -> String:
	if eh_equip(it):
		var p := []
		var st: Dictionary = dados.itens[it.k].st
		for c in st:
			var v: float = float(st[c][int(it.r)]) * reforco_k(it, c)
			if v > 0:
				p.append(texto_st(c, v))
		return " · ".join(p)
	if it.k == "tomo":
		return "Sobe %s do Nv %d para o %d (com a barra de usos cheia)." % [habs[it.h].nome, int(it.nv) - 1, int(it.nv)]
	return str(dados.itens[it.k].get("desc", ""))

func texto_bonus(raridade: int, t: String) -> String:
	var p := []
	var bon: Dictionary = dados.conjunto[raridade][t]
	for c in bon:
		p.append(texto_st(c, float(bon[c])))
	return ", ".join(p)

# ---------- sem internet: mexer na mochila só neste celular (não grava na conta, como o resto do treino) ----------
# o que aparece no corpo: o equipamento, sem o capacete quando o jogador escolheu esconder (o bônus continua)
func equip_visivel() -> Dictionary:
	var eq: Dictionary = prog.get("equip", {}).duplicate()
	if prog.get("semCapacete", false):
		eq.erase("cabeca")
	return eq

func equipar(i: int) -> void:
	var it = prog.mochila[i]
	if not eh_equip(it):
		return
	var l: String = dados.itens[it.k].lugar
	prog.mochila[i] = prog.equip.get(l)
	prog.equip[l] = it
	st = calcular_status()
	mudou = true

func tirar(l: String) -> String:
	if prog.equip.get(l) == null:
		return ""
	var v: int = prog.mochila.find(null)
	if v < 0:
		return "Mochila cheia"
	prog.mochila[v] = prog.equip[l]
	prog.equip[l] = null
	st = calcular_status()
	mudou = true
	return ""

# Tomo (sem internet): devolve o aviso; poção quem aplica é o main.gd (vida e mana do herói)
func usar_tomo(i: int) -> String:
	var it = prog.mochila[i]
	var nv := nivel_de(it.h)
	if nv >= int(it.nv):
		return "%s já está no Nv %d" % [habs[it.h].nome, nv]
	if nv != int(it.nv) - 1:
		return "Este Tomo é para subir do Nv %d para o %d" % [int(it.nv) - 1, int(it.nv)]
	if uso_de(it.h) < usos_para_subir(nv):
		return "Encha a barra de usos de %s primeiro" % habs[it.h].nome
	prog.habs[it.h] = {"nv": int(it.nv), "uso": 0}
	gastar(i)
	return "%s subiu para Nv %d!" % [habs[it.h].nome, int(it.nv)]

func gastar(i: int) -> void:
	prog.mochila[i].n = int(prog.mochila[i].n) - 1
	if prog.mochila[i].n <= 0:
		prog.mochila[i] = null
	mudou = true

# precisa de Tomo agora? (barra de usos cheia do Nv 5 em diante): devolve o lugar do Tomo na mochila, -1 se não tem, -2 se não precisa
func tomo_para(id: String) -> int:
	var nv := nivel_de(id)
	if not habs[id].has("tomo") or nv >= maximo(id) or nv < int(dados.nivelSemTomo) or uso_de(id) < usos_para_subir(nv):
		return -2
	for i in prog.mochila.size():
		var it = prog.mochila[i]
		if it != null and it.k == "tomo" and it.h == id and int(it.nv) == nv + 1:
			return i
	return -1

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

# números da skill no nível nv, como habNoNivel: dano +18% (o Lm do Quimera), recarga -6% e os campos de "nv" somados
func hab_nivel(id: String, nv := -1) -> Dictionary:
	if nv < 0:
		nv = nivel_de(id)
	var h: Dictionary = habs[id].duplicate(true)
	var k := nv - 1
	h.nv = nv
	h.id = id
	h.pct = float(h.get("pct", 0)) * (1 + 0.18 * k)
	if h.has("cd") and not h.get("basico", false):
		h.cd = h.cd * (1 - 0.06 * k)
	var cresce: Dictionary = habs[id].get("nv", {})
	for c in cresce:
		var v: float = float(cresce[c]) * k
		if c == "explosao":
			h.proj.explosao = float(h.proj.explosao) + v
		elif c == "lentoK":
			h.lento.k = float(h.lento.k) + v
		else:
			h[c] = float(h[c]) + v
	return h

# pronta para usar: dano em pontos (pelo atributo da árvore) e recarga com a Destreza
func hab_pronta(id: String) -> Dictionary:
	var h := hab_nivel(id)
	var dano: float = st.danoMagico if h.arvore == "cajado" else st.danoFisico if h.arvore == "espada" else max(st.danoFisico, st.danoMagico)
	h.dmg = dano * h.pct
	if h.has("cd") and not h.get("basico", false):
		h.cd = h.cd * (1 - st.recarga)
	if h.tipo == "escudo":
		h.absorve = round(h.absorve + st.defesa * h.defK)
	var ak: float = st.get("areaK", 0.0)
	if ak > 0.0 and not h.get("basico", false): # conjunto de 6 peças: área das skills maior
		if h.has("area"):
			h.area = snappedf(h.area * (1.0 + ak), 0.01)
		if h.has("proj") and h.proj.has("explosao"):
			h.proj.explosao = snappedf(h.proj.explosao * (1.0 + ak), 0.01)
	return h

# ---------- texto do menu (igual ao Quimera: "Dano 220% · Área 2,2 m · Mana 10 · Recarga 1,1 s") ----------
static func num(v: float, casas := 1) -> String:
	var s := str(snappedf(v, pow(10, -casas)))
	if s.ends_with(".0"):
		s = s.substr(0, s.length() - 2)
	return s.replace(".", ",")

func linha(h: Dictionary) -> String:
	var p := []
	if h.get("pct", 0) > 0:
		var golpes: int = h.hits.size() if h.has("hits") else 1
		p.append("Dano %s%%%s" % [num(h.pct * 100, 0), (" ×%d" % golpes) if golpes > 1 else ""])
	if h.has("alcance"):
		p.append("Alcance %s m" % num(h.alcance))
	if h.has("area"):
		p.append("Raio %s m" % num(h.area))
	if h.has("proj") and h.proj.has("explosao"):
		p.append("Área %s m" % num(h.proj.explosao))
	if h.has("alvos"):
		p.append("Alvos %d" % int(round(h.alvos)))
	if h.has("distancia"):
		p.append("Distância %s m" % num(h.distancia))
	if h.has("curaPct"):
		p.append("Cura %s%% · perto %s%%" % [num(h.curaPct * 100, 0), num(h.curaPct * 50, 0)])
	if h.has("absorve"):
		p.append("Absorve %d · %s s" % [int(h.absorve), num(h.duracao, 0)])
	if h.has("atordoa") and h.tipo != "puxar":
		p.append("Atordoa %s s" % num(h.atordoa))
	if h.has("congela"):
		p.append("Congela %s s" % num(h.congela))
	if h.has("lento"):
		p.append("Lentidão %s%% · %s s" % [num(h.lento.k * 100, 1), num(h.lento.dur, 0)])
	if h.has("vulneravel"):
		p.append("Quebrado +%s%% · %s s" % [num(h.vulneravel.k * 100, 0), num(h.vulneravel.dur, 0)])
	if h.has("canal"):
		p.append("Concentra %s s" % num(h.canal, 2))
	p.append(("Mana %d" % int(h.mana)) if h.get("mana", 0) > 0 else "Sem mana")
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
	for c in ["alcance", "area", "distancia", "alvos", "congela", "atordoa"]:
		if b.has(c) and not is_equal_approx(float(b[c]), float(a[c])):
			p.append({"alcance": "Alcance %s m", "area": "Raio %s m", "distancia": "Distância %s m", "alvos": "Alvos %s", "congela": "Congela %s s", "atordoa": "Atordoa %s s"}[c] % num(b[c]))
	if b.has("curaPct"):
		p.append("Cura %s%%" % num(b.curaPct * 100, 0))
	if b.has("absorve"):
		p.append("Absorve +12")
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
	var precisa := usos_para_subir(int(s.nv))
	if int(s.uso) >= precisa: # cheia: esperando o Tomo
		return ""
	s.uso = int(s.uso) + 1
	mudou = true
	if s.uso >= precisa:
		if int(s.nv) < int(dados.nivelSemTomo):
			s.uso = 0
			s.nv = int(s.nv) + 1
			return "%s subiu para Nv %d" % [habs[id].nome, s.nv]
		return "%s: barra cheia. Use o %s %s" % [habs[id].nome, habs[id].tomo, dados.romano[int(s.nv) + 1]]
	return ""

func distribuir(k: String) -> bool:
	if prog.pontos <= 0 or not prog.atr.has(k):
		return false
	prog.atr[k] += 1
	prog.pontos -= 1
	st = calcular_status()
	mudou = true
	return true

# pontos de atributo já gastos (cada atributo começa em 3)
func pontos_gastos() -> int:
	var n := 0
	for k in prog.atr:
		n += int(prog.atr[k]) - 3
	return n

# Mestre Ivo sem internet (treino, como o resto do modo sozinho): mesma conta de Simulacao.resetarBuild
func resetar(custo: int) -> String:
	var gastos := pontos_gastos()
	if gastos <= 0:
		return "Você ainda não gastou nenhum ponto."
	if int(prog.get("ouro", 0)) < custo:
		return "Falta ouro: custa %d" % custo
	prog.ouro = int(prog.ouro) - custo
	for k in prog.atr:
		prog.atr[k] = 3
	prog.pontos = int(prog.pontos) + gastos
	st = calcular_status()
	mudou = true
	return "Build resetada: %d pontos para distribuir de novo" % gastos

# a skill serve nessa barra? (espada só na da espada, cajado só na do cajado, as gerais nas duas)
func cabe(id: String, barra: String) -> bool:
	return habs.has(id) and not habs[id].get("basico", false) and (habs[id].arvore == "geral" or habs[id].arvore == barra)

# barra da arma na mão
static func barra_de(modo: String) -> String:
	return "espada" if modo == "Espada" else "cajado"

# põe a skill no botão i da barra (se já estava em outro botão dela, troca de lugar); id "" esvazia o botão
func por_no_botao(id: String, barra: String, i: int) -> void:
	var b: Array = prog.barras[barra]
	if id == "":
		b[i] = null
	else:
		var antes := b.find(id)
		if antes >= 0:
			b[antes] = b[i]
		b[i] = id
	mudou = true

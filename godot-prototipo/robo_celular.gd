extends Node
# Robô no celular de verdade (André 2026-11-16: "testa no Motorola, no Samsung, todos os aparelhos intermediários").
# O Firebase Test Lab instala o APK num celular de verdade e põe um arquivo robo.cfg na pasta do app
# (--other-files). Com ele, o jogo entra sozinho com a conta do robô, anda pela vila e pela estrada, luta na Clareira
# dos Puglins e mede cada quadro, igual o robô 2 (ferramentas/robo/celular.gd) faz na nuvem, mas aqui com a placa de
# vídeo do celular. O lentidao.gd manda as linhas dele para o /lentidao como em qualquer celular; no fim o relatório
# vai para a página /robo e para o log do Android ("CELULAR fim {...}").
# Sem o arquivo (todo celular de jogador) nada disto liga.
#
# Missões (André 2026-11-17: "queria q fizessem missoes combates e tudo mais pra verificar tudo, como primeiro robo"):
# no modo "missoes" (o normal) ele joga como uma pessoa: segue o brilho do guia das missões (guia.gd) e toca na tela
# naquele ponto (toque de verdade, o mesmo caminho do dedo), aperta o "Ir", fala com os NPCs, cria, coleta; sem nada
# piscando ele luta com o monstro mais perto (golpe, habilidades e poção). Etapa parada TRAVA_S s vira "travou": anota e
# pula (missaoTeste, só a conta de robô). O modo "passeio" é o de antes: volta na vila, estrada e luta na Clareira.
#
# robo.cfg (ConfigFile): [robo] sessao="...", duracao=240, turno="tl-...", modo="missoes"|"passeio"
# No PC dá para testar com a variável RPG_ROBO_CFG=/caminho/robo.cfg.

const PASTAS := [
	"/sdcard/Android/data/com.rcandrerc.rpgprototipo/files/robo.cfg",
	"/storage/emulated/0/Android/data/com.rcandrerc.rpgprototipo/files/robo.cfg",
]
const AQUECE := 20.0 # s depois de entrar (shaders, NPCs chegando) antes de medir
const ESPERA_MAX := 420.0 # s até entrar no servidor (o celular novo baixa o jogo inteiro antes)
const VEL := 5.0 # m/s, correndo
const RELATORIO := "https://163-176-80-126.sslip.io/robo/relatorio"
const TRAVA_S := 300.0 # s na mesma etapa = travou (anota e pula)
const PASSO_JOGO := 0.4 # s entre uma decisão e outra
const LUTA_LONGE := 40.0 # m: monstro mais longe que isto não é procurado

static var _cfg = null # null = ainda não leu; {} = não é robô

# Configuração do robô (vazia no celular de jogador).
static func config() -> Dictionary:
	if _cfg != null:
		return _cfg
	_cfg = {}
	var lista: Array = PASTAS.duplicate()
	if OS.get_environment("RPG_ROBO_CFG") != "":
		lista.push_front(OS.get_environment("RPG_ROBO_CFG"))
	for p in lista:
		if not FileAccess.file_exists(p):
			continue
		var c := ConfigFile.new()
		if c.load(p) != OK:
			continue
		var s := str(c.get_value("robo", "sessao", ""))
		if s == "":
			continue
		_cfg = {"sessao": s, "duracao": float(c.get_value("robo", "duracao", 240.0)), "turno": str(c.get_value("robo", "turno", "tl-%d" % int(Time.get_unix_time_from_system())))}
		print("CELULAR robô ligado por ", p)
		break
	return _cfg

var m # main.gd
var t := 0.0
var entrou_t := -1.0
var apertou_t := -99.0
var n_toques := 0
var ultimo_estado := ""
var dur := 240.0
var acabou := false
var passeio := [
	["vila", "volta", {"c": Vector2(0, 0), "r": 12.0, "s": 90.0}],
	["estrada", "ir", {"p": Vector2(77, -8)}],
	["caça", "volta", {"c": Vector2(77, -8), "r": 7.0, "s": 90.0, "luta": true}],
	["estrada", "ir", {"p": Vector2(0, 0)}],
]
var etapa := 0
var etapa_t := 0.0
var ang := 0.0
var pos := Vector2.ZERO
var golpe_t := 0.0
var trechos := {}
var travadas: Array = []
var n100 := 0
var n250 := 0
var n1000 := 0
var amostra_t := 0.0
var mem_max := 0.0
var nos_max := 0
var fps_min := 999.0
# modo missões
var modo := "missoes"
var jogar_t := 0.0
var soltar_t := -1.0
var toque_pos := Vector2.ZERO
var n_toque := 0
var alvo_e = null # monstro que ele está caçando
var hab_t := 0.0
var hab_i := 0
var pocao_t := 0.0
var etapa_k := ""
var etapa_desde := 0.0
var hist_p := -1
var pulou := false
var feitas := 0
var puladas := 0
var nivel_de := -1
var problemas: Array = []
var morto_t := 0.0

func _init(main) -> void:
	m = main
	dur = config().get("duracao", 240.0)
	modo = str(config().get("modo", "missoes"))
	name = "RoboCelular"
	process_mode = Node.PROCESS_MODE_ALWAYS

func _process(dt: float) -> void:
	if acabou:
		return
	t += dt
	if entrou_t < 0.0 and t > ESPERA_MAX:
		print("CELULAR FALHOU: não entrou no servidor em %d s (%s)" % [ESPERA_MAX, ultimo_estado])
		_terminar("não entrou no servidor: " + ultimo_estado)
		return
	var on = m.online
	if on == null:
		return
	if entrou_t < 0.0:
		var est := "%s | %s | botão=%s" % [on.carregando.text if on.carregando and on.carregando.visible else "", on.aviso_login.text if on.aviso_login else "", on.b_continuar.is_visible_in_tree() if on.b_continuar else "-"]
		if est != ultimo_estado:
			ultimo_estado = est
			print("CELULAR tela t=%.1f s: %s" % [t, est])
		if on.b_continuar and on.b_continuar.is_visible_in_tree() and t - apertou_t > 3.0:
			apertou_t = t
			n_toques += 1
			print("CELULAR toque %d em Entrar (t=%.1f s)" % [n_toques, t])
			on.b_continuar.pressed.emit()
		if on.rede and on.rede.conectado:
			entrou_t = t
			pos = Vector2(m.heroi.position.x, m.heroi.position.z)
			print("CELULAR entrou no servidor em %.1f s" % t)
		return
	if modo == "passeio":
		_andar(dt)
	else:
		_jogar(dt)
	if t - entrou_t < AQUECE:
		return
	_medir(dt)
	if t - entrou_t >= AQUECE + dur:
		_terminar("")

func _andar(dt: float) -> void:
	var E = passeio[etapa]
	var d: Dictionary = E[2]
	etapa_t += dt
	var prox := false
	if E[1] == "volta":
		var c: Vector2 = d.c
		if etapa_t < dt * 1.5:
			ang = atan2(pos.y - c.y, pos.x - c.x)
		ang += dt * VEL / d.r
		var alvo: Vector2 = c + Vector2(cos(ang), sin(ang)) * float(d.r)
		pos = pos.move_toward(alvo, VEL * dt * 1.5)
		prox = etapa_t >= d.s
		if d.get("luta", false):
			golpe_t -= dt
			if golpe_t <= 0.0:
				golpe_t = 0.6
				m.usar("basico")
	else:
		pos = pos.move_toward(d.p, VEL * dt)
		prox = pos.distance_to(d.p) < 0.5 or etapa_t > 120.0
	m.mov.por_em(Vector3(pos.x, 0, pos.y))
	if prox:
		etapa = (etapa + 1) % passeio.size()
		etapa_t = 0.0

# ---------- missões: joga como uma pessoa ----------
func _jogar(dt: float) -> void:
	if soltar_t >= 0.0: # o dedo sai da tela um instante depois de encostar (o botão age ao soltar)
		soltar_t -= dt
		if soltar_t < 0.0:
			_dedo(false)
	if m.heroi == null or m.P == null:
		return
	_lutar(dt)
	jogar_t -= dt
	if jogar_t > 0.0:
		return
	jogar_t = PASSO_JOGO
	_etapa_da_vez()
	if m.h.morto > 0.0:
		morto_t += PASSO_JOGO
		alvo_e = null
		return
	var vmax: float = float(m.P.st.get("vidaMax", 100.0))
	pocao_t -= PASSO_JOGO
	if m.h.vida < vmax * 0.4 and pocao_t <= 0.0:
		pocao_t = 4.0
		m.usar("pocao")
	# o que o guia pisca: toca ali
	var G = m.guia
	if G != null and soltar_t < 0.0 and G._tem():
		var c := Vector2(-1, -1)
		var r: Rect2 = G._ret_alvo()
		if r.has_area():
			c = r.get_center()
		elif G._circ.z > 0.0:
			c = Vector2(G._circ.x, G._circ.y)
		if c.x >= 0.0:
			alvo_e = null
			_tocar(c)
			return
	if m.rota != null and m.rota.ativo:
		alvo_e = null # indo sozinho pelo "Ir": só espera
		return
	if alvo_e == null or alvo_e.estado == "morto" or not is_instance_valid(alvo_e.no):
		alvo_e = m.mais_perto(m.heroi.position, LUTA_LONGE)

# anda até o monstro e bate (golpe a cada 0,6 s, uma habilidade a cada 3 s)
func _lutar(dt: float) -> void:
	if alvo_e == null or m.h.morto > 0.0 or (m.rota != null and m.rota.ativo):
		return
	if alvo_e.estado == "morto" or not is_instance_valid(alvo_e.no):
		alvo_e = null
		return
	var hp: Vector3 = m.heroi.position
	var ep: Vector3 = alvo_e.no.position
	var d := Vector2(hp.x, hp.z).distance_to(Vector2(ep.x, ep.z))
	if d > LUTA_LONGE * 1.5:
		alvo_e = null
		return
	if d > 1.8:
		var p := Vector2(hp.x, hp.z).move_toward(Vector2(ep.x, ep.z), VEL * dt)
		m.mov.por_em(Vector3(p.x, hp.y, p.y))
		return
	golpe_t -= dt
	if golpe_t <= 0.0:
		golpe_t = 0.6
		m.usar("basico")
	hab_t -= dt
	if hab_t <= 0.0:
		hab_t = 3.0
		hab_i = (hab_i + 1) % 6
		m.usar("hab%d" % hab_i)

# toque de verdade na tela (o mesmo caminho do dedo: o Godot também gera o clique para os botões)
func _tocar(c: Vector2) -> void:
	toque_pos = c
	n_toque += 1
	_dedo(true)
	soltar_t = 0.08

func _dedo(apertou: bool) -> void:
	var ev := InputEventScreenTouch.new()
	ev.index = 0
	ev.position = toque_pos
	ev.pressed = apertou
	Input.parse_input_event(ev)

# a etapa da vez: conta as missões feitas e pula a que travou
func _etapa_da_vez() -> void:
	var prog: Dictionary = m.P.prog
	if nivel_de < 0 and prog.has("nivel"):
		nivel_de = int(prog.nivel)
	var h = prog.get("hist", {})
	var p: int = int(h.get("p", -1)) if h is Dictionary else -1
	if hist_p >= 0 and p > hist_p:
		if not pulou:
			feitas += 1
			print("CELULAR missão feita (%d) t=%.0f s" % [feitas, t - entrou_t])
		pulou = false
	hist_p = p
	var hi: Dictionary = m.P.hist_info
	var k := "%d|%s|%s|%s" % [p, str(hi.get("id", "")), str(hi.get("ev", "")), str(hi.get("texto", ""))]
	if k != etapa_k:
		etapa_k = k
		etapa_desde = t
		print("CELULAR etapa: %s (%s)" % [str(hi.get("texto", "")), str(hi.get("ev", ""))])
		return
	if t - etapa_desde > TRAVA_S and not hi.is_empty():
		var txt := "Travou %d s na etapa \"%s\" (%s, missão %s)" % [roundi(TRAVA_S), str(hi.get("texto", "")), str(hi.get("ev", "")), str(hi.get("id", ""))]
		print("CELULAR ", txt)
		if problemas.size() < 30:
			problemas.append(txt)
		puladas += 1
		pulou = true
		etapa_desde = t
		alvo_e = null
		m.rede("missaoTeste", {"acao": "pular"})

func _medir(dt: float) -> void:
	var nome: String = passeio[etapa][0] if modo == "passeio" else ("vila" if Vector2(m.heroi.position.x, m.heroi.position.z).length() < 30.0 else "fora da vila")
	if not trechos.has(nome):
		trechos[nome] = {"q": 0, "s": 0.0, "dts": PackedFloat32Array(), "pior": 0.0, "cham": 0, "tri": 0, "obj": 0, "proc": 0.0, "fis": 0.0}
	var T: Dictionary = trechos[nome]
	var ms := dt * 1000.0
	T.q += 1
	T.s += dt
	if T.dts.size() < 100000:
		T.dts.append(ms)
	T.pior = max(T.pior, ms)
	T.proc += Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0
	T.fis += Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS) * 1000.0
	if ms > 100.0:
		n100 += 1
		if ms > 250.0:
			n250 += 1
		if ms > 1000.0:
			n1000 += 1
		travadas.append({"t": snappedf(t - entrou_t, 0.1), "ms": roundi(ms), "trecho": nome, "x": roundi(pos.x), "z": roundi(pos.y)})
		travadas.sort_custom(func(a, b): return a.ms > b.ms)
		if travadas.size() > 25:
			travadas.resize(25)
	amostra_t -= dt
	if amostra_t <= 0.0:
		amostra_t = 1.0
		T.cham = max(T.cham, int(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME)))
		T.tri = max(T.tri, int(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME)))
		T.obj = max(T.obj, int(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_OBJECTS_IN_FRAME)))
		mem_max = max(mem_max, Performance.get_monitor(Performance.MEMORY_STATIC) / 1048576.0)
		nos_max = max(nos_max, int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT)))
		if t - entrou_t > AQUECE + 5.0:
			fps_min = min(fps_min, Engine.get_frames_per_second())
	if int(t) % 30 == 0 and int(t - dt) % 30 != 0:
		print("CELULAR t=%.0f s trecho=%s fps=%.0f travadas>100ms=%d" % [t - entrou_t, nome, Engine.get_frames_per_second(), n100])

static func _pct(a: PackedFloat32Array, q: float) -> float:
	if a.is_empty():
		return 0.0
	var b := a.duplicate()
	b.sort()
	return b[mini(b.size() - 1, int(q * b.size()))]

func _aparelho() -> String:
	return "%s %s" % [OS.get_model_name(), "(Android %s)" % OS.get_version() if OS.get_name() == "Android" else OS.get_name()]

func _terminar(erro: String) -> void:
	acabou = true
	var tr := {}
	var q := 0
	var s := 0.0
	for n in trechos:
		var T: Dictionary = trechos[n]
		q += T.q
		s += T.s
		tr[n] = {"fps": snappedf(T.q / max(T.s, 0.001), 0.1), "p50": snappedf(_pct(T.dts, 0.5), 0.1), "p95": snappedf(_pct(T.dts, 0.95), 0.1),
			"p99": snappedf(_pct(T.dts, 0.99), 0.1), "pior": roundi(T.pior), "proc": snappedf(T.proc / max(T.q, 1), 0.01),
			"fis": snappedf(T.fis / max(T.q, 1), 0.01), "cham": T.cham, "tri": roundi(T.tri / 1000.0), "obj": T.obj, "seg": roundi(T.s)}
	var cfg := ConfigFile.new()
	cfg.load("user://config.cfg")
	var r := {"modo": "celular de verdade", "aparelho": _aparelho(), "motor": Engine.get_version_info().string,
		"placa": RenderingServer.get_video_adapter_name(), "drv": RenderingServer.get_current_rendering_driver_name(),
		"grafico": cfg.get_value("config", "grafico", -1), "entrou_s": snappedf(entrou_t, 0.1),
		"fps": snappedf(q / max(s, 0.001), 0.1), "fps_min": snappedf(fps_min, 1.0) if fps_min < 999.0 else null, "segundos": roundi(s), "quadros": q,
		"travadas": {"acima100": n100, "acima250": n250, "acima1000": n1000, "piores": travadas}, "trechos": tr,
		"mem_max": roundi(mem_max), "nos_max": nos_max, "erro": erro}
	if modo != "passeio":
		var hi: Dictionary = m.P.hist_info if m.P else {}
		r["missoes"] = {"feitas": feitas, "puladas": puladas, "toques": n_toque, "agora": str(hi.get("texto", "")),
			"nivel_de": nivel_de, "nivel_ate": int(m.P.prog.get("nivel", 0)) if m.P else null, "morto_s": roundi(morto_t)}
	print("CELULAR fim ", JSON.stringify(r))
	var agora := int(Time.get_unix_time_from_system() * 1000.0)
	var rel := {"turno": str(config().get("turno", "tl")).substr(0, 40), "tipo": "celular", "fisico": true,
		"inicio": agora - int(t * 1000.0), "ultimo": agora, "ativo": false,
		"modos": {_aparelho(): r}, "problemas": ([erro] if erro != "" else []) + problemas.map(func(x): return _aparelho() + ": " + x)}
	var h := HTTPRequest.new()
	h.timeout = 20.0
	add_child(h)
	h.request_completed.connect(func(res, cod, _hh, _c): print("CELULAR relatório enviado: ", res, " ", cod))
	h.request(RELATORIO, ["Content-Type: application/json", "Authorization: Bearer " + str(config().get("sessao", ""))], HTTPClient.METHOD_POST, JSON.stringify(rel))

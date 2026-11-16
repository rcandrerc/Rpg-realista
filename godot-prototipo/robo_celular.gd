extends Node
# Robô no celular de verdade (André 2026-11-16: "testa no Motorola, no Samsung, todos os aparelhos intermediários").
# O Firebase Test Lab instala o APK num celular de verdade e põe um arquivo robo.cfg na pasta do app
# (--other-files). Com ele, o jogo entra sozinho com a conta do robô, anda pela vila e pela estrada, luta na Clareira
# dos Puglins e mede cada quadro, igual o robô 2 (ferramentas/robo/celular.gd) faz na nuvem, mas aqui com a placa de
# vídeo do celular. O lentidao.gd manda as linhas dele para o /lentidao como em qualquer celular; no fim o relatório
# vai para a página /robo e para o log do Android ("CELULAR fim {...}").
# Sem o arquivo (todo celular de jogador) nada disto liga.
#
# robo.cfg (ConfigFile): [robo] sessao="...", duracao=240, turno="tl-..."
# No PC dá para testar com a variável RPG_ROBO_CFG=/caminho/robo.cfg.

const PASTAS := [
	"/sdcard/Android/data/com.rcandrerc.rpgprototipo/files/robo.cfg",
	"/storage/emulated/0/Android/data/com.rcandrerc.rpgprototipo/files/robo.cfg",
]
const AQUECE := 20.0 # s depois de entrar (shaders, NPCs chegando) antes de medir
const ESPERA_MAX := 420.0 # s até entrar no servidor (o celular novo baixa o jogo inteiro antes)
const VEL := 5.0 # m/s, correndo
const RELATORIO := "https://163-176-80-126.sslip.io/robo/relatorio"

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

func _init(main) -> void:
	m = main
	dur = config().get("duracao", 240.0)
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
	_andar(dt)
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

func _medir(dt: float) -> void:
	var nome: String = passeio[etapa][0]
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
	print("CELULAR fim ", JSON.stringify(r))
	var agora := int(Time.get_unix_time_from_system() * 1000.0)
	var rel := {"turno": str(config().get("turno", "tl")).substr(0, 40), "tipo": "celular", "fisico": true,
		"inicio": agora - int(t * 1000.0), "ultimo": agora, "ativo": false,
		"modos": {_aparelho(): r}, "problemas": [erro] if erro != "" else []}
	var h := HTTPRequest.new()
	h.timeout = 20.0
	add_child(h)
	h.request_completed.connect(func(res, cod, _hh, _c): print("CELULAR relatório enviado: ", res, " ", cod))
	h.request(RELATORIO, ["Content-Type: application/json", "Authorization: Bearer " + str(config().get("sessao", ""))], HTTPClient.METHOD_POST, JSON.stringify(rel))

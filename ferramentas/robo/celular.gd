extends SceneTree
# Robô 2 (André 2026-11-14: "o robô 2 vai ser mais interessante pra detectar perda de performance, travamentos"): o app
# Godot de verdade, com as opções do Poco X7 (Alta manual, limite 60), entra no servidor e joga sozinho: anda em volta
# da vila, vai pela estrada até a Clareira dos Puglins, luta lá e volta, sem parar. Mede cada quadro (FPS, pior quadro,
# travadas acima de 100 ms e onde aconteceram) por pedaço do passeio, o que a placa desenha (chamadas, triângulos) e a
# memória. O lentidao.gd do próprio jogo também manda as linhas dele para o servidor, como no celular.
# Limite: a máquina da nuvem não tem placa de vídeo de celular. Sem tela (--headless) mede só o processador (scripts,
# física, animação, carregamento); com Vulkan por software o desenho é muito mais lento que num celular.
# Uso: RPG_SERVIDOR=... RPG_SESSAO=... DURACAO=600 SAIDA=/tmp/celular.json godot --path godot-prototipo -s ferramentas/robo/celular.gd
var t := 0.0
var entrou_t := -1.0
var apertou := false
var apertou_t := -99.0 # o Entrar volta a aparecer se a entrada demorar (online.gd _voltar_a_tela_inicial): toca de novo
var n_toques := 0
var ultimo_estado := ""
var dur := 600.0
var saida := ""
var modo := "sem tela"
const ESPERA_MAX := 240.0
const AQUECE := 20.0 # s depois de entrar (shaders, NPCs chegando) antes de medir
const VEL := 5.0 # m/s, correndo
# o passeio: [nome, tipo, dados]
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
var trechos := {} # nome -> {q: quadros, s: segundos, dts: [], pior, chamadas_max, tri_max, ...}
var travadas: Array = [] # {t, ms, trecho, x, z}
var n100 := 0
var n250 := 0
var n1000 := 0
var amostra_t := 0.0
var mem_max := 0.0
var nos_max := 0
var antes_us := 0

func _initialize() -> void:
	dur = float(OS.get_environment("DURACAO")) if OS.get_environment("DURACAO") != "" else 600.0
	saida = OS.get_environment("SAIDA")
	modo = "sem tela" if DisplayServer.get_name() == "headless" else "Vulkan por software"
	# opções do Poco X7 do André: Alta manual (não o Auto: na nuvem o FPS baixo faria o Auto descer sem parar), limite 60
	var cfg := ConfigFile.new()
	cfg.load("user://config.cfg")
	cfg.set_value("config", "grafico", 2)
	cfg.set_value("config", "grafico_auto", false)
	cfg.set_value("config", "fps_limite", 60)
	cfg.save("user://config.cfg")
	print("CELULAR motor ", Engine.get_version_info().string, " ", modo, " placa ", RenderingServer.get_video_adapter_name(), " duração ", dur, " s")
	change_scene_to_file("res://main.tscn")

func _trecho(n: String) -> Dictionary:
	if not trechos.has(n):
		trechos[n] = {"q": 0, "s": 0.0, "dts": PackedFloat32Array(), "pior": 0.0, "cham": 0, "tri": 0, "obj": 0, "proc": 0.0, "fis": 0.0}
	return trechos[n]

func _process(dt: float) -> bool:
	t += dt
	var m = current_scene
	if entrou_t < 0.0 and t > ESPERA_MAX:
		print("CELULAR FALHOU: não entrou no servidor em %d s" % ESPERA_MAX)
		_salvar("não entrou no servidor")
		quit(1)
		return false
	if m == null or not ("online" in m) or m.online == null:
		return false
	var on = m.online
	# o que a tela de entrada diz (para saber onde parou se não entrar)
	var est := "%s | %s | botão=%s capa=%s" % [on.carregando.text if on.carregando.visible else "", on.aviso_login.text, on.b_continuar.is_visible_in_tree() if on.b_continuar else "-", on.capa.visible]
	if entrou_t < 0.0 and est != ultimo_estado:
		ultimo_estado = est
		print("CELULAR tela t=%.1f s: %s" % [t, est])
	if entrou_t < 0.0 and on.b_continuar and on.b_continuar.is_visible_in_tree() and t - apertou_t > 3.0:
		apertou = true
		apertou_t = t
		n_toques += 1
		print("CELULAR toque %d em Entrar (t=%.1f s)" % [n_toques, t])
		on.b_continuar.pressed.emit()
	if entrou_t < 0.0 and on.rede and on.rede.conectado:
		entrou_t = t
		pos = Vector2(m.heroi.position.x, m.heroi.position.z)
		print("CELULAR entrou no servidor em %.1f s" % t)
	if entrou_t < 0.0:
		return false
	_andar(m, dt)
	if t - entrou_t < AQUECE:
		return false
	_medir(m, dt)
	if t - entrou_t >= AQUECE + dur:
		_salvar("")
		quit(0)
	return false

func _andar(m, dt: float) -> void:
	var E = passeio[etapa]
	var d: Dictionary = E[2]
	etapa_t += dt
	var prox := false
	if E[1] == "volta":
		var c: Vector2 = d.c
		if etapa_t < dt * 1.5: # chegou: começa a volta de onde está
			ang = atan2(pos.y - c.y, pos.x - c.x)
		ang += dt * VEL / d.r
		var alvo: Vector2 = c + Vector2(cos(ang), sin(ang)) * float(d.r)
		pos = pos.move_toward(alvo, VEL * dt * 1.5)
		prox = etapa_t >= d.s
		if d.get("luta", false):
			golpe_t -= dt
			if golpe_t <= 0.0:
				golpe_t = 0.6
				m.usar("basico") # o botão de ataque: o golpe acha o monstro mais perto sozinho
	else:
		pos = pos.move_toward(d.p, VEL * dt)
		prox = pos.distance_to(d.p) < 0.5 or etapa_t > 120.0
	m.mov.por_em(Vector3(pos.x, 0, pos.y))
	if prox:
		etapa = (etapa + 1) % passeio.size()
		etapa_t = 0.0

func _medir(m, dt: float) -> void:
	var nome: String = passeio[etapa][0]
	var T := _trecho(nome)
	T.q += 1
	T.s += dt
	if T.dts.size() < 200000:
		T.dts.append(dt * 1000.0)
	T.pior = max(T.pior, dt * 1000.0)
	T.proc += Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0
	T.fis += Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS) * 1000.0
	var ms := dt * 1000.0
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
	if int(t) % 60 == 0 and int(t - dt) % 60 != 0:
		print("CELULAR t=%.0f s trecho=%s fps=%.0f travadas>100ms=%d" % [t - entrou_t, nome, Engine.get_frames_per_second(), n100])

func _pct(a: PackedFloat32Array, q: float) -> float:
	if a.is_empty():
		return 0.0
	var b := a.duplicate()
	b.sort()
	return b[mini(b.size() - 1, int(q * b.size()))]

func _salvar(erro: String) -> void:
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
	var r := {"modo": modo, "motor": Engine.get_version_info().string, "placa": RenderingServer.get_video_adapter_name(),
		"entrou_s": snappedf(entrou_t, 0.1), "fps": snappedf(q / max(s, 0.001), 0.1), "segundos": roundi(s), "quadros": q,
		"travadas": {"acima100": n100, "acima250": n250, "acima1000": n1000, "piores": travadas}, "trechos": tr,
		"mem_max": roundi(mem_max), "nos_max": nos_max, "erro": erro}
	print("CELULAR fim ", JSON.stringify(r))
	if saida != "":
		var f := FileAccess.open(saida, FileAccess.WRITE)
		if f:
			f.store_string(JSON.stringify(r))

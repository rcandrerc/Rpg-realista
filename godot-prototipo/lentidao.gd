extends Node
# Registro das lentidões (André 2026-11-13: "uns slow motion... quando estou correndo com lobo... sensação que o personagem
# entrou em câmera lenta"; tirar print do Teste correndo é impossível). O jogo confere sozinho, a cada segundo:
# - o tempo do jogo andou junto com o relógio de verdade? (relogio: 1 = sim; câmera lenta de verdade fica abaixo)
# - montado e com o joystick, o herói andou na tela o que o lobo devia andar? (pedido x andou)
# - o servidor puxou o herói de volta? (corr = quantas vezes, corr_m = o maior puxão em metros)
# - quanto tempo ficou sem foto do servidor (foto_ms), ping, FPS e o pior quadro do segundo.
# Segundo ruim vira uma linha que vai sozinha para o servidor (/lentidao, sem nome nem conta) e fica nas últimas
# GUARDA do aparelho (user://lentidao.json). Na tela, só a contagem no Teste ("lentas N").

const JANELA := 1.0 # s de verdade por conferência
const GUARDA := 40
const MANDA_MAX := 300 # por abertura do jogo (nada de inundar o servidor)
const ARQUIVO := "user://lentidao.json"

var m # main.gd
var lentas := 0
var lista: Array = []
var _t0 := 0
var _ult := 0
var _jogo := 0.0
var _pior := 0.0
var _quadros := 0
var _escala := 1.0
var _pedido := 0.0
var _andou := 0.0
var _andou_lobo := 0.0 # metros na tela nos quadros de galope (o que conta contra o pedido)
var _mov := 0.0
var _bloq := 0
var _corr := 0
var _corr_m := 0.0
var _foto_ms := 0.0
var _proc := 0.0 # ms: o maior tempo de conta do jogo (scripts e física) num quadro do segundo
var _p_vis = null
var _p_mov = null
var _mandadas := 0

func _init(principal) -> void:
	m = principal
	atual = self

func _ready() -> void:
	if FileAccess.file_exists(ARQUIVO):
		var v = JSON.parse_string(FileAccess.get_file_as_string(ARQUIVO))
		if v is Array:
			lista = v
	_zerar(Time.get_ticks_usec())
	_r_zerar(Time.get_ticks_usec())
	# quanto do quadro foi a placa de vídeo (gpu) e quanto o processador montando o desenho (cpu): lido só nos registros
	RenderingServer.viewport_set_measure_render_time(get_viewport().get_viewport_rid(), true)

# Linha do tempo da entrada (André 2026-11-13, "a tela de carregamento já está um pouco lenta no celular"): ms desde que
# o app abriu até cada passo (ini = começo do main, pronto = primeiro quadro, escolha = "Entrar como…", toque = tocou em
# Entrar, conectado, foto = primeira foto do servidor, fila = monstros e NPCs prontos, aquecer = efeitos prontos,
# capa = o jogo aparece). Vai uma vez por abertura, junto com as lentidões (/lentidao, tipo "entrada").
var _entrada := {}
var _entrada_mandada := false
func marcar(nome: String) -> void:
	if not _entrada.has(nome):
		_entrada[nome] = Time.get_ticks_msec()

func _seguir_entrada() -> void:
	var on = m.online
	if not _entrada.has("pronto"):
		_entrada.ini = int(m.t_ready0)
		marcar("pronto")
	if on == null:
		return
	if on.rede and on.rede.conectado:
		marcar("conectado")
	if on.foto_ms > 0:
		marcar("foto")
	if m._a_criar.is_empty():
		marcar("fila")
	if m.aquecer and m.aquecer.feito:
		marcar("aquecer")
	# André 2026-11-13: no celular a linha não chegava. Agora não depende do toque em Entrar nem dos efeitos prontos:
	# sai quando o jogo aparece e os efeitos ficam prontos, ou 20 s depois disso com o que tiver.
	if on.ligado and not on._cobrindo and not (on.capa and on.capa.visible):
		marcar("capa")
		if not _entrada_mandada and (_entrada.has("aquecer") or Time.get_ticks_msec() - int(_entrada.capa) > 20000):
			_entrada_mandada = true
			var e := _entrada.duplicate()
			e.tipo = "entrada"
			e.grafico = int(m.grafico.nivel) if m.grafico else -1
			e.versao = str(load("res://versao.gd").NUMERO)
			on.rede.enviar("lentidao", e)

# Menus e conversas (André 2026-11-13: "quando abro os menus tem um lag grande, tipo um delay"; "quando vou comprar
# semente na Rosa ou falar com o Aldo sempre tem um lag alto"; a conversa vai com aba "npc:<id>"): cada abertura anota quanto
# levou montar (abrir, ms), o quadro seguinte (quadro: arrumar e desenhar a tela nova) e o outro depois (quadro2).
# Vai como tipo "menu" para /lentidao, no máximo MENU_MAX por abertura do jogo.
# Shader montado na placa na primeira vez que algo aparece (a caverna, o retrato de um NPC, uma skill): é o tranco
# mais comum no celular e não aparece na conta do jogo. pip = quantos pipelines a placa montou desde o registro
# anterior (lido só junto de um registro: a leitura espera a linha do desenho).
var _pip_total := -1
func pipelines_novos() -> int:
	var t := 0
	for k in [RenderingServer.RENDERING_INFO_PIPELINE_COMPILATIONS_CANVAS, RenderingServer.RENDERING_INFO_PIPELINE_COMPILATIONS_MESH,
			RenderingServer.RENDERING_INFO_PIPELINE_COMPILATIONS_SURFACE, RenderingServer.RENDERING_INFO_PIPELINE_COMPILATIONS_DRAW,
			RenderingServer.RENDERING_INFO_PIPELINE_COMPILATIONS_SPECIALIZATION]:
		t += RenderingServer.get_rendering_info(k)
	var novos := t - _pip_total if _pip_total >= 0 else 0
	_pip_total = t
	return novos

const MENU_MAX := 40
var _menu := {}
var _menus_mandados := 0
# espera = ms entre o toque e a resposta do servidor (baú e fornalha só abrem quando o servidor manda o conteúdo)
func menu_aberto(aba: String, t0_us: int, itens: int, espera := -1) -> void:
	if _menus_mandados >= MENU_MAX:
		return
	var agora := Time.get_ticks_usec()
	pipelines_novos()
	_menu = {"tipo": "menu", "aba": aba.left(15), "abrir": roundi((agora - t0_us) / 1000.0), "itens": itens, "_t": agora, "_f": Engine.get_process_frames()}
	if espera >= 0:
		_menu.espera = espera

func _seguir_menu() -> void:
	if Engine.get_process_frames() == int(_menu._f):
		return # o toque abriu o menu neste mesmo quadro: conta a partir do próximo
	var agora := Time.get_ticks_usec()
	var ms := roundi((agora - int(_menu._t)) / 1000.0)
	_menu._t = agora
	if not _menu.has("quadro"):
		_menu.quadro = ms
		return
	_menu.quadro2 = ms
	_menu.pip = pipelines_novos()
	_menu.erase("_t")
	_menu.erase("_f")
	_menu.versao = str(load("res://versao.gd").NUMERO)
	_menu.limite = Engine.max_fps
	_menu.grafico = int(m.grafico.nivel) if m.grafico else -1
	var on = m.online
	if on and on.rede and on.rede.conectado:
		_menus_mandados += 1
		on.rede.enviar("lentidao", _menu)
	_menu = {}

# Quem pesou no segundo (André 2026-11-14, "pode sim fazer tudo"): o que nasce ou monta com o jogo andando (monstro,
# NPC, modelo carregado pela primeira vez, pedaço da caverna, vila pequena, terreno de outro jogador, mato, LOD) anota
# quanto levou. O segundo ruim leva os que mais pesaram em "ev" ({nome: [vezes, ms]}) e os do segundo anterior em "ev0"
# (o tranco de um quadro pode cair já no segundo seguinte). nos/dnos e dres: nós na cena e quantos nós e recursos
# entraram ou saíram no segundo (pega o que não tem marca).
const EV_MAX := 6
var _ev := {}
var _ev0 := {}
var _nos0 := 0
var _res0 := 0
func ev(nome: String, t0_us: int) -> void:
	var ms := (Time.get_ticks_usec() - t0_us) / 1000.0
	_qev[nome] = _qev.get(nome, 0.0) + ms
	var a = _ev.get(nome)
	if a == null:
		_ev[nome] = [1, ms]
	else:
		a[0] += 1
		a[1] += ms

# Quadro lento (André 2026-11-14: "deslocamento de lobo ainda dá lag spike, nada absurdo mas com frequência"; o
# registro mostrou um quadro de ~110 ms quase todo segundo no lobo, sem nenhum culpado marcado): o _process de cada
# script e cada parte do main.gd passam por parte(); passou de PARTE_US, anota. No quadro de QUADRO_LENTO ms ou mais,
# o registro leva qev = quanto cada parte gastou NAQUELE quadro (o pior do segundo) e qms = o quadro inteiro; o que
# faltar entre a soma e qms foi fora dos scripts (desenho, espera da placa, física).
static var atual = null # o registro em uso (os outros scripts chamam Lentidao.parte com o preload)
const PARTE_US := 1000
const QUADRO_LENTO := 60.0 # ms
var _qev := {}
var _qev_pior := {}
var _qev_pior_ms := 0.0
static func parte(nome: String, t0_us: int) -> int:
	var agora := Time.get_ticks_usec()
	if atual != null and agora - t0_us >= PARTE_US:
		atual.ev(nome, t0_us)
	return agora

func _ev_top(d: Dictionary) -> Dictionary:
	var ks := d.keys()
	ks.sort_custom(func(a, b): return d[a][1] > d[b][1])
	var r := {}
	for k in ks.slice(0, EV_MAX):
		r[str(k).left(19)] = [int(d[k][0]), snappedf(d[k][1], 0.1)]
	return r

# Calor (André 2026-11-14, "tem como traquear o que tá aquecendo o celular"): o Android diz o estado de calor (term:
# 0 normal, 1 leve, 2 moderado, 3 forte, 4 grave, 5 emergência, 6 desligando; do 2 para cima ele já baixa a velocidade
# do processador) e quanto falta para começar a frear daqui a 10 s (folga: 1.0 = começa a frear). bat = °C da bateria.
# Lido a cada CALOR_S (cada leitura passa pelo sistema), vai em todo registro junto com gpu/cpu (ms do último quadro
# na placa de vídeo e no processador montando o desenho), memória e minutos de jogo.
const CALOR_S := 15.0
var term := -1
var folga := -1.0
var bat := -1.0
var _t_calor := 0.0
var _pm = null # PowerManager do Android
var _pm_falhou := false
var _bat_falhou := false
var _bat_filtro = null
func _ler_calor() -> void:
	if OS.get_name() != "Android" or _pm_falhou:
		return
	var act = null
	if _pm == null:
		_pm_falhou = true
		if not Engine.has_singleton("AndroidRuntime"):
			return
		act = Engine.get_singleton("AndroidRuntime").getActivity()
		_pm = act.getSystemService("power") if act else null
		if _pm == null:
			return
		_pm_falhou = false
	var t = _pm.getCurrentThermalStatus()
	if t is int:
		term = t
	var f = _pm.getThermalHeadroom(10)
	if (f is float or f is int) and is_finite(float(f)):
		folga = snappedf(float(f), 0.01)
	_ler_bateria(act)

# temperatura da bateria: o aviso fixo do Android de bateria (ACTION_BATTERY_CHANGED), em décimos de grau. Marca
# "falhou" antes de tentar e só desmarca se der certo: um erro aqui nunca se repete a cada leitura.
func _ler_bateria(act) -> void:
	if _bat_falhou:
		return
	_bat_falhou = true
	if act == null:
		act = Engine.get_singleton("AndroidRuntime").getActivity()
	if act == null:
		return
	if _bat_filtro == null:
		var IF = JavaClassWrapper.wrap("android.content.IntentFilter")
		if IF == null:
			return
		_bat_filtro = IF.IntentFilter("android.intent.action.BATTERY_CHANGED") # o construtor tem o nome da classe
		if _bat_filtro == null:
			return
	var it = act.registerReceiver(null, _bat_filtro)
	if it == null:
		return
	var dec = it.getIntExtra("temperature", -1)
	if dec is int and dec > 0:
		bat = dec / 10.0
		_bat_falhou = false

# campos que vão em todo registro (segundo ruim e resumo): minutos desde que o app abriu, memória (MB: mem = do jogo,
# vmem = da placa, livre = do aparelho), calor e ms da placa/processador no último quadro
func _comum(e: Dictionary) -> void:
	e.min = snappedf(Time.get_ticks_msec() / 60000.0, 0.1)
	var mem := Performance.get_monitor(Performance.MEMORY_STATIC)
	if mem > 0.0:
		e.mem = roundi(mem / 1048576.0)
	e.vmem = roundi(Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED) / 1048576.0)
	var livre := int(OS.get_memory_info().get("available", -1))
	if livre > 0:
		e.livre = roundi(livre / 1048576.0)
	var rid := get_viewport().get_viewport_rid()
	e.gpu = snappedf(RenderingServer.viewport_get_measured_render_time_gpu(rid), 0.1)
	e.cpu = snappedf(RenderingServer.viewport_get_measured_render_time_cpu(rid), 0.1)
	if term >= 0:
		e.term = term
	if folga >= 0.0:
		e.folga = folga
	if bat > 0.0:
		e.bat = bat
	e.nos = int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT))

# Resumo de cada minuto (mesmo sem tranco): FPS médio, pior quadro, quantos segundos ruins, o que a placa desenhava,
# onde o herói estava e o calor. Mostra o celular esquentando ao longo da partida. No máximo RESUMO_MAX por abertura.
const RESUMO_S := 60.0
const RESUMO_MAX := 180
var _r_t0 := 0
var _r_quadros := 0
var _r_pior := 0.0
var _r_proc := 0.0
var _r_lentas := 0
var _resumos := 0
func _r_zerar(agora: int) -> void:
	_r_t0 = agora
	_r_quadros = 0
	_r_pior = 0.0
	_r_proc = 0.0
	_r_lentas = lentas

func _resumo(real: float) -> void:
	var g = m.grafico
	var e := {
		"tipo": "resumo", "fps": snappedf(_r_quadros / real, 0.1), "pior": roundi(_r_pior), "proc": roundi(_r_proc),
		"lentas": lentas - _r_lentas, "x": roundi(m.heroi.position.x), "z": roundi(m.heroi.position.z),
		"montado": m.montaria != null, "grafico": int(g.nivel) if g else -1, "limite": Engine.max_fps,
		"versao": str(load("res://versao.gd").NUMERO),
	}
	e.cham = RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME)
	e.tri = roundi(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME) / 1000.0)
	e.obj = RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_OBJECTS_IN_FRAME)
	_comum(e)
	var on = m.online
	if _resumos < RESUMO_MAX and on and on.rede and on.rede.conectado:
		_resumos += 1
		on.rede.enviar("lentidao", e)

# online.gd: o servidor mandou "corrigir" (d = metros entre onde o herói estava e onde o servidor pôs)
func corrigiu(d: float) -> void:
	_corr += 1
	_corr_m = maxf(_corr_m, d)

func _zerar(agora: int) -> void:
	_t0 = agora
	_jogo = 0.0
	_pior = 0.0
	_quadros = 0
	_escala = 1.0
	_pedido = 0.0
	_andou = 0.0
	_andou_lobo = 0.0
	_mov = 0.0
	_bloq = 0
	_corr = 0
	_corr_m = 0.0
	_foto_ms = 0.0
	_proc = 0.0
	_ev0 = _ev
	_ev = {}
	_qev_pior = {}
	_qev_pior_ms = 0.0
	_nos0 = int(Performance.get_monitor(Performance.OBJECT_NODE_COUNT))
	_res0 = int(Performance.get_monitor(Performance.OBJECT_RESOURCE_COUNT))

func _process(dt: float) -> void:
	if not _entrada_mandada:
		_seguir_entrada()
	if not _menu.is_empty():
		_seguir_menu()
	var agora := Time.get_ticks_usec()
	var q: float = (agora - _ult) / 1000000.0 if _ult > 0 else 0.0
	_ult = agora
	if q * 1000.0 >= QUADRO_LENTO and q * 1000.0 > _qev_pior_ms:
		_qev_pior_ms = q * 1000.0
		_qev_pior = _qev.duplicate()
	_qev.clear()
	_t_calor -= q
	if _t_calor <= 0.0:
		_t_calor = CALOR_S
		var t0 := Time.get_ticks_usec()
		_ler_calor()
		if OS.get_name() == "Android":
			ev("calor", t0) # a própria leitura também conta, se um dia pesar
	var on = m.online
	if m.heroi == null or on == null or not on.ligado or on._cobrindo or m.h.morto > 0.0:
		_p_vis = null
		_zerar(agora)
		_r_zerar(agora)
		return
	_quadros += 1
	_jogo += dt
	_pior = maxf(_pior, q * 1000.0)
	_proc = maxf(_proc, (Performance.get_monitor(Performance.TIME_PROCESS) + Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS)) * 1000.0)
	_r_quadros += 1
	_r_pior = maxf(_r_pior, q * 1000.0)
	_r_proc = maxf(_r_proc, _proc)
	var r_real: float = (agora - _r_t0) / 1000000.0
	if r_real >= RESUMO_S:
		_resumo(r_real)
		_r_zerar(agora)
	_escala = minf(_escala, Engine.time_scale)
	_foto_ms = maxf(_foto_ms, float(Time.get_ticks_msec() - on.foto_ms) if on.foto_ms > 0 else 0.0)
	var pv: Vector3 = m.heroi.position
	var pm: Vector3 = m.mov.posicao()
	if _p_vis != null:
		_andou += Vector2(pv.x - _p_vis.x, pv.z - _p_vis.z).length()
		_mov += Vector2(pm.x - _p_mov.x, pm.z - _p_mov.z).length()
		# montado e já no galope (fora a arrancada, que é devagar mesmo): o lobo vai sempre a MONTARIAS.correr
		if m.montaria != null and not m.mov.montado.is_empty() and m._forca_joy > 0.15 and m.mov.veiculo.is_empty() and m.mov.esc == null:
			var corre := float(m.mov.montado.correr)
			if m.mov.bloqueado:
				_bloq += 1
			elif m.mov.velocidade() >= corre * 0.9:
				_pedido += corre * q
				_andou_lobo += Vector2(pv.x - _p_vis.x, pv.z - _p_vis.z).length()
	_p_vis = pv
	_p_mov = pm
	var real: float = (agora - _t0) / 1000000.0
	if real < JANELA:
		return
	var relogio: float = _jogo / real
	var lento_lobo: bool = _pedido > 3.0 and _andou_lobo < _pedido * 0.75
	# o congelamento do golpe e a câmera lenta de propósito (Engine.time_scale < 1) atrasam o relógio do jogo sem ser
	# lentidão: nesse segundo só conta quadro travado, puxão e o lobo (eram 4 de cada 10 linhas, e empurravam as de verdade)
	if (relogio < 0.85 and _escala >= 1.0) or lento_lobo or _corr > 0 or _pior >= 100.0:
		var ta := Time.get_ticks_usec()
		_anotar(real, relogio)
		ev("registro", ta) # o próprio registro (guardar no aparelho e mandar): aparece no quadro seguinte
	_zerar(agora)

func _anotar(real: float, relogio: float) -> void:
	lentas += 1
	var g = m.grafico
	var e := {
		"quando": int(Time.get_unix_time_from_system()), "fps": snappedf(_quadros / real, 0.1), "pior": roundi(_pior),
		"relogio": snappedf(relogio, 0.01), "escala": snappedf(_escala, 0.01), "pedido": snappedf(_pedido, 0.1),
		"andou": snappedf(_andou, 0.1), "andou_lobo": snappedf(_andou_lobo, 0.1), "mov": snappedf(_mov, 0.1), "bloq": _bloq, "corr": _corr, "corr_m": snappedf(_corr_m, 0.1),
		"foto_ms": roundi(_foto_ms), "ping": roundi(float(m.online.rede.ping_ms)), "montado": m.montaria != null,
		"x": roundi(m.heroi.position.x), "z": roundi(m.heroi.position.z), "grafico": int(g.nivel) if g else -1,
		"limite": Engine.max_fps, "paralelo": int(m._q_paralelo), "versao": str(load("res://versao.gd").NUMERO),
	}
	# André 2026-11-13 ("as travadas ficam sendo mapeadas"): quanto do segundo ruim foi conta do jogo (proc) e quanto a
	# placa desenhava (chamadas, mil triângulos, objetos) e para onde a câmera olhava (rumo, graus). Lido só no segundo
	# ruim: com o desenho em paralelo, a leitura da placa espera a outra linha, então nunca por quadro.
	e.proc = roundi(_proc)
	e.cham = RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME)
	e.tri = roundi(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME) / 1000.0)
	e.obj = RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_OBJECTS_IN_FRAME)
	e.pip = pipelines_novos()
	var cam: Camera3D = m.get_viewport().get_camera_3d()
	if cam:
		e.rumo = roundi(fposmod(rad_to_deg(cam.global_rotation.y), 360.0))
	if not _ev.is_empty():
		e.ev = _ev_top(_ev)
	if not _ev0.is_empty():
		e.ev0 = _ev_top(_ev0)
	if _qev_pior_ms > 0.0:
		e.qms = roundi(_qev_pior_ms)
		var ks := _qev_pior.keys()
		ks.sort_custom(func(a, b): return _qev_pior[a] > _qev_pior[b])
		var qe := {}
		for k in ks.slice(0, 8):
			qe[str(k).left(19)] = snappedf(_qev_pior[k], 0.1)
		e.qev = qe
	_comum(e)
	e.dnos = e.nos - _nos0
	e.dres = int(Performance.get_monitor(Performance.OBJECT_RESOURCE_COUNT)) - _res0
	lista.append(e)
	while lista.size() > GUARDA:
		lista.pop_front()
	var f := FileAccess.open(ARQUIVO, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(lista))
	if _mandadas < MANDA_MAX:
		_mandadas += 1
		m.online.rede.enviar("lentidao", e)

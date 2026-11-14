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

func _ready() -> void:
	if FileAccess.file_exists(ARQUIVO):
		var v = JSON.parse_string(FileAccess.get_file_as_string(ARQUIVO))
		if v is Array:
			lista = v
	_zerar(Time.get_ticks_usec())

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
func menu_aberto(aba: String, t0_us: int, itens: int) -> void:
	if _menus_mandados >= MENU_MAX:
		return
	var agora := Time.get_ticks_usec()
	pipelines_novos()
	_menu = {"tipo": "menu", "aba": aba.left(15), "abrir": roundi((agora - t0_us) / 1000.0), "itens": itens, "_t": agora, "_f": Engine.get_process_frames()}

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

func _process(dt: float) -> void:
	if not _entrada_mandada:
		_seguir_entrada()
	if not _menu.is_empty():
		_seguir_menu()
	var agora := Time.get_ticks_usec()
	var q: float = (agora - _ult) / 1000000.0 if _ult > 0 else 0.0
	_ult = agora
	var on = m.online
	if m.heroi == null or on == null or not on.ligado or on._cobrindo or m.h.morto > 0.0:
		_p_vis = null
		_zerar(agora)
		return
	_quadros += 1
	_jogo += dt
	_pior = maxf(_pior, q * 1000.0)
	_proc = maxf(_proc, (Performance.get_monitor(Performance.TIME_PROCESS) + Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS)) * 1000.0)
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
		_anotar(real, relogio)
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
	lista.append(e)
	while lista.size() > GUARDA:
		lista.pop_front()
	var f := FileAccess.open(ARQUIVO, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(lista))
	if _mandadas < MANDA_MAX:
		_mandadas += 1
		m.online.rede.enviar("lentidao", e)

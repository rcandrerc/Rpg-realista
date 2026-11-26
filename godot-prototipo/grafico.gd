extends Node
# Qualidade gráfica (André 2026-11-09: no Galaxy Note 10 Lite da filha, Exynos 9810 / Mali-G72, o jogo roda muito mal).
# Configurações > Qualidade gráfica: Baixa, Média ou Alta. Alta é exatamente o jogo de hoje (o Poco X7 continua igual);
# Média e Baixa tiram peso da placa de vídeo:
# - resolução 3D menor (a interface continua nítida, só o mundo 3D é desenhado em menos pontos);
# - sombra mais curta (Média) ou desligada (Baixa); suavização (MSAA) desligada na Baixa;
# - alcance da vista menor: tudo que tem distância para sumir (árvores, casas, pedras, monstros, mato, o chão longe)
#   some mais perto, com a névoa um pouco mais fechada para não aparecer o corte;
# - grama: menos folhas e só perto;
# - água do mar, lagos e rios mais simples (agua.gdshader e rio.gdshader, uniform "simples");
# - Baixa trava em 30 quadros por segundo (estável e o celular esquenta menos).
# Auto (André 2026-11-14): parte do nível da placa e alivia sozinho quando esquenta (ver "Auto" mais abaixo); quem
# instala agora começa nele.
# Na primeira vez que o jogo abre, escolhe sozinho pela placa de vídeo do aparelho (Mali-G72 do Note 10 Lite: Baixa;
# Mali-G720 do Poco X7: Alta). Depois vale o que o jogador escolher (fica em user://config.cfg, junto do som).

const ARQUIVO := "user://config.cfg"
const BAIXA := 0
const MEDIA := 1
const ALTA := 2
const NOMES := ["Baixa", "Média", "Alta"]
const PRESETS := [
	{"escala": 0.45, "sombra": false, "sombra_dist": 0.0, "atlas": 1024, "suave": RenderingServer.SHADOW_QUALITY_HARD,
		"msaa": Viewport.MSAA_DISABLED, "alcance": 0.55, "grama": 0.45, "grama_qtd": 0.5, "nevoa": 1.6,
		"fps": 30, "agua_simples": true, "lod": 4.0, "desce_mais": true},
	{"escala": 0.52, "sombra": true, "sombra_dist": 15.0, "atlas": 1024, "suave": RenderingServer.SHADOW_QUALITY_SOFT_VERY_LOW,
		"msaa": Viewport.MSAA_2X, "alcance": 0.78, "grama": 0.75, "grama_qtd": 0.75, "nevoa": 1.25,
		"fps": 60, "agua_simples": false, "lod": 2.0},
	# Alta = os números de hoje (main.gd RESOLUCAO_PADRAO e montar_ambiente, project.godot)
	{"escala": 0.6, "sombra": true, "sombra_dist": 20.0, "atlas": 2048, "suave": RenderingServer.SHADOW_QUALITY_SOFT_LOW,
		"msaa": Viewport.MSAA_2X, "alcance": 1.0, "grama": 1.0, "grama_qtd": 1.0, "nevoa": 1.0,
		"fps": 60, "agua_simples": false, "lod": 1.0},
]
# André 2026-11-12: Média e Alta travam em 60 por padrão (eram "sem limite": numa tela de 120 Hz o celular esquentava
# à toa). Quem escolheu outro valor em "Limite FPS" continua com o dele.
const ENCOLHE_DE := 65.0 # grama.gdshader: a folha encolhe de 65 a 75 m (aqui vezes o fator da grama)
const ENCOLHE_ATE := 75.0

var m # main.gd
var nivel := ALTA
var sugerido := ALTA # o que a detecção do aparelho escolheria (mostrado nas Configurações)
var placa := "" # nome da placa de vídeo (ex.: "Mali-G72")
var P: Dictionary = PRESETS[ALTA]
var _pend: Array = []
var _agendado := false
var _mats_agua := {} # materiais de água achados (para ligar e desligar o "simples")
var _mats_grama := {}
# Limite de quadros por segundo (varredura de FPS 2026-11-10): Configurações > Limite de FPS. -1 = o do nível (Baixa
# trava em 30; Média e Alta sem limite, como sempre foi). Sem limite, num celular de tela 120 Hz o jogo tenta fazer
# 120 quadros, esquenta e oscila (60, 45, 40...): travado em 30 ou 60 o ritmo fica igual e o celular esquenta menos.
const LIMITES := [30, 60, 0] # 0 = sem limite
var limite := -1

func _init(jogo) -> void:
	m = jogo
	name = "Grafico"
	placa = RenderingServer.get_video_adapter_name()
	sugerido = detectar(placa, OS.get_model_name())
	var cfg := ConfigFile.new()
	var tem := cfg.load(ARQUIVO) == OK and cfg.has_section_key("config", "grafico")
	nivel = clampi(int(cfg.get_value("config", "grafico", sugerido)) if tem else sugerido, BAIXA, ALTA)
	if not tem: # primeira vez: guarda a escolha automática (o jogador troca quando quiser)
		cfg.set_value("config", "grafico", nivel)
		cfg.save(ARQUIVO)
	# Auto (André 2026-11-14): quem instala agora começa no Auto; quem já jogava continua no nível que escolheu
	if not cfg.has_section_key("config", "grafico_auto"):
		cfg.set_value("config", "grafico_auto", not tem)
		cfg.save(ARQUIVO)
	auto = bool(cfg.get_value("config", "grafico_auto", false))
	if auto:
		nivel = sugerido
	hz = ler_hz()
	P = preset_auto(PRESETS[nivel], 0, hz) if auto else PRESETS[nivel]
	# Paralelo, Sombras e Cor da grama saíram das Configurações (André 2026-11-14, "deixamos como padrão"): o
	# paralelo fica ligado (quem tinha desligado na mão volta a ligado; a trava contra queda continua valendo)
	var mc := _motor()
	if paralelo_disponivel() and mc.has_section_key("aethra", "paralelo") and not bool(mc.get_value("aethra", "paralelo", true)):
		trocar_paralelo(true)
	limite = int(cfg.get_value("config", "fps_limite", -1))
	if limite not in LIMITES:
		limite = -1
	# botão Teste (conselho 2026-11-13): saiu da tela em 2026-11-14 (André: os registros automáticos já mapeiam o jogo).
	# "teste" continua só como o padrão da chave FPS e ping (menu_topo.gd): quem já jogava vê, quem instala agora não.
	teste = bool(cfg.get_value("config", "teste_fps", tem))
	if not cfg.has_section_key("config", "teste_fps"):
		cfg.set_value("config", "teste_fps", teste)
		cfg.save(ARQUIVO)

# ---------- desenho em paralelo (APK 2026-11-12) ----------
# A lógica do jogo e o desenho rodam em linhas separadas do processador: o quadro passa a custar o maior dos dois, não a
# soma. Só vale no APK que traz a opção (project.godot lê user://motor.cfg) e só muda ao abrir o jogo de novo.
# A trava contra queda fica no inicio.gd (APK): ele grava o modo antigo a cada abertura em paralelo; aqui, depois de
# PARALELO_OK s jogando sem cair, a escolha do jogador volta a valer.
const MOTOR := "user://motor.cfg"
const PARALELO_OK := 15.0
const PARALELO_FALHAS_MAX := 2

func paralelo_disponivel() -> bool:
	return str(ProjectSettings.get_setting("application/config/project_settings_override", "")) == MOTOR

func paralelo_agora() -> bool:
	# no modo antigo a linha principal é a própria linha do desenho (vale também para --render-thread nos testes do PC)
	return not RenderingServer.is_on_render_thread()

func _motor() -> ConfigFile:
	var cfg := ConfigFile.new()
	cfg.load(MOTOR)
	return cfg

func paralelo_quer() -> bool:
	return bool(_motor().get_value("aethra", "paralelo", true))

# desligou sozinho porque o jogo fechou sem querer duas vezes seguidas com ele ligado
func paralelo_caiu() -> bool:
	return paralelo_quer() and int(_motor().get_value("aethra", "paralelo_falhas", 0)) >= PARALELO_FALHAS_MAX

# main.gd chama depois de PARALELO_OK s de jogo: esta abertura não caiu
func paralelo_confirmar() -> void:
	if not paralelo_disponivel():
		return
	var cfg := _motor()
	if paralelo_agora():
		cfg.set_value("aethra", "paralelo_falhas", 0)
	var liga: bool = bool(cfg.get_value("aethra", "paralelo", true)) and int(cfg.get_value("aethra", "paralelo_falhas", 0)) < PARALELO_FALHAS_MAX
	cfg.set_value("rendering", "driver/threads/thread_model", 2 if liga else 1)
	cfg.save(MOTOR)

# ---------- linhas de fundo do motor (André 2026-11-12: "o app não abre", APK 2006 / Godot 4.7.1) ----------
# Na primeira abertura do 4.7 (celular sem nada guardado em user://shader_cache) o motor prepara centenas de shaders.
# Cada um vira várias tarefas no WorkerThreadPool e, com as linhas padrão (uma por núcleo: 8 no Poco X7), todas ficavam
# esperando umas pelas outras: o jogo parava antes do primeiro quadro na tela "Procurando atualização…"/"Abrindo…" e só
# andava depois de muito tempo (André: ~1 hora). Reproduzido no PC com Vulkan e cache vazio: 4 e 8 linhas travam, 32
# abre. Linha parada não gasta processador, então sobrar linha não pesa. O ajuste vai no user://motor.cfg (o APK lê ao
# abrir, como o desenho em paralelo) e só vale na próxima abertura; o project.godot já traz o mesmo para o próximo APK.
const LINHAS := 32

# true = acabou de gravar o ajuste e esta abertura ainda está sem ele (main.gd mostra o aviso e fecha o app)
static func ajustar_linhas() -> bool:
	if str(ProjectSettings.get_setting("application/config/project_settings_override", "")) != MOTOR:
		return false # APK sem o motor.cfg (4.5): não tem o problema e não leria o ajuste
	if int(ProjectSettings.get_setting("threading/worker_pool/max_threads", -1)) >= LINHAS:
		return false # já está valendo
	var cfg := ConfigFile.new()
	cfg.load(MOTOR)
	if int(cfg.get_value("threading", "worker_pool/max_threads", -1)) >= LINHAS:
		return not bool(cfg.get_value("aethra", "linhas_aviso", false)) # gravado, falta abrir de novo
	cfg.set_value("threading", "worker_pool/max_threads", LINHAS)
	# as aberturas que travaram contaram como queda do desenho em paralelo; a culpa era daqui: zera a conta
	cfg.set_value("aethra", "paralelo_falhas", 0)
	cfg.save(MOTOR)
	return true

# o aviso de "abra de novo" aparece uma vez só (se o ajuste não pegar, o jogo segue e não fica fechando)
static func linhas_avisou() -> void:
	var cfg := ConfigFile.new()
	cfg.load(MOTOR)
	cfg.set_value("aethra", "linhas_aviso", true)
	cfg.save(MOTOR)

func trocar_paralelo(v: bool) -> void:
	var cfg := _motor()
	cfg.set_value("aethra", "paralelo", v)
	cfg.set_value("aethra", "paralelo_falhas", 0) # ligou na mão: tenta de novo do zero
	cfg.set_value("rendering", "driver/threads/thread_model", 2 if v else 1)
	cfg.save(MOTOR)

# quantos quadros por segundo valem agora (0 = sem limite). No Auto quem escolhe é o Auto.
func fps_alvo() -> int:
	if auto:
		return int(P.fps)
	return limite if limite >= 0 else int(P.fps)

var teste := false # botão Teste à vista

func trocar_teste(v: bool) -> void:
	teste = v
	var cfg := ConfigFile.new()
	cfg.load(ARQUIVO)
	cfg.set_value("config", "teste_fps", v)
	cfg.save(ARQUIVO)

func trocar_limite(v: int) -> void:
	limite = v if v in LIMITES else -1
	var cfg := ConfigFile.new()
	cfg.load(ARQUIVO)
	cfg.set_value("config", "fps_limite", limite)
	cfg.save(ARQUIVO)
	Engine.max_fps = fps_alvo()

func _enter_tree() -> void:
	# tudo que entra na cena depois (pedaços do mapa, monstros, casas) recebe o alcance do nível escolhido
	get_tree().node_added.connect(_entrou)

# Escolha automática pela placa de vídeo. Mali: G31/G51/G52/G71/G72 e T* = Baixa; G57/G68/G76 = Média; G77/G78 e
# as novas (G610 em diante, G710/G720...) = Alta (G310 = Baixa, G510/G610/G615 = Média). Adreno: abaixo de 610 = Baixa,
# 610 a 629 = Média, 630 a 699 = Alta, 700 a 729 = Média, 730 em diante = Alta. PowerVR = Baixa. Xclipse = Alta.
# Placa desconhecida: Média (o jogador sobe para Alta se quiser).
static func detectar(nome_placa: String, _modelo := "") -> int:
	var n := nome_placa.to_lower()
	if n.contains("xclipse"):
		return ALTA
	if n.contains("powervr") or n.contains("mali-t") or n.contains("mali-4"):
		return BAIXA
	var r := RegEx.new()
	r.compile("mali-g(\\d+)")
	var a := r.search(n)
	if a:
		var g := int(a.get_string(1))
		if g < 100:
			if g in [57, 68, 76]:
				return MEDIA
			return ALTA if g >= 77 else BAIXA
		if g < 500:
			return BAIXA
		return MEDIA if g < 700 else ALTA
	r.compile("adreno[^0-9]*(\\d+)")
	a = r.search(n)
	if a:
		var q := int(a.get_string(1))
		if q < 610:
			return BAIXA
		if q < 630 or (q >= 700 and q < 730):
			return MEDIA
		return ALTA
	if OS.get_name() != "Android" and OS.get_name() != "iOS":
		return ALTA # PC (a versão de PC tem o modo leve dela, F9)
	return MEDIA

func trocar(n: int) -> void:
	nivel = clampi(n, BAIXA, ALTA)
	auto = false
	degrau = 0
	P = PRESETS[nivel]
	var cfg := ConfigFile.new()
	cfg.load(ARQUIVO)
	cfg.set_value("config", "grafico", nivel)
	cfg.set_value("config", "grafico_auto", false)
	cfg.save(ARQUIVO)
	aplicar()

func trocar_auto() -> void:
	auto = true
	nivel = sugerido
	degrau = 0
	_frio_s = 0.0
	_espera_sobe = AUTO_SOBE_S
	_t_auto = AUTO_S
	_gpu_soma = 0.0
	_gpu_n = 0
	hz = ler_hz()
	P = preset_auto(PRESETS[nivel], 0, hz)
	var cfg := ConfigFile.new()
	cfg.load(ARQUIVO)
	cfg.set_value("config", "grafico_auto", true)
	cfg.save(ARQUIVO)
	aplicar()

# ---------- Auto (André 2026-11-14: "opção auto e opção manual low, médio e high, e escolher fps; no auto escolhe tudo") ----------
# O Auto parte do nível que a detecção escolheu para a placa (sugerido) e, a cada AUTO_S, olha o FPS de verdade
# e o calor do Android (lentidao.gd: term, folga, bat). Quente ou FPS bem abaixo do alvo: desce um degrau. Frio e com
# o FPS no alvo por _espera_sobe: sobe um. Se subiu e logo teve de descer, a próxima
# subida espera o dobro (não fica indo e voltando).
# André 2026-11-17: "a minha ideia era ir baixando o FPS à medida que fosse necessário... não já travar em 30". Antes o
# degrau 2 já era 30 FPS e o Poco X7 Pro, que faz uns 40 a 50 na Alta, caía para 30 em 2 a 5 minutos (registros de
# 17/11: term 0, bateria abaixo de 42 °C; foi o "FPS abaixo de 48", não o calor). Agora a escada (escada()) é:
#   1 a 4. limite de 55, 50, 45 e 40 FPS (a qualidade fica igual; só os que dividem a frequência da tela, ver abaixo)
#   5. resolução 3D menor (a interface continua nítida)
#   6. resolução 3D menor ainda e sombra mais curta
#   7. grama mais rala e só perto, vista ao longe mais curta (névoa um pouco mais fechada); a câmera continua livre
#   8. 30 FPS: só em último caso
# FPS abaixo do limite (o celular não chega lá): desce direto para o limite que ele aguenta, só no FPS (ex.: fazendo
# 46 com limite 60 vai para 45 e fica). Quente: desce um degrau; se o único sinal é a bateria (esquenta e esfria
# devagar), espera CALOR_BAT_S entre um degrau e outro.
# 2026-11-17 noite (registros do Poco X7 Pro, versões 2540 a 2581: 4 h a 30 FPS sem esquentar): com a sincronia da tela
# ligada (project.godot vsync), o quadro só aparece na batida da tela. Numa tela a 60 Hz um limite de 55, 50, 45 ou 40
# vira 30 de verdade (o quadro de 20 a 25 ms espera a batida de 33 ms), a conta via "não chega no limite" e descia
# até o 30. Agora só entram os limites que dividem a frequência da tela (hz): 120 Hz tem 60, 40 e 30; 90 Hz tem 45
# e 30; 60 Hz só 60 e 30. Sem limite intermediário, "não chega no limite" não desce mais para o 30 enquanto o celular
# faz mais de 33 (60 Hz fazendo 46 fica no 60, a qualidade inteira); o calor continua descendo um degrau por vez.
# E o tranco de carregamento (quadro de mais de TRANCO_S) não entra na conta do FPS da janela.
const AUTO_S := 15.0
const AUTO_SOBE_S := 60.0
const AUTO_SOBE_MAX := 600.0
const DEGRAUS := 8 # degraus do Auto na Média e na Alta (a Baixa tem menos: degraus())
const ESCADA_FPS := [55, 50, 45, 40]
const LENTO := 0.9 # FPS de verdade abaixo de 90% do limite: o celular não chega lá
const TRANCO_S := 0.25 # quadro maior que isto (carregamento) fica fora da conta do FPS do Auto
const CALOR_BAT_S := 90.0 # a bateria leva minutos para mostrar o efeito de um degrau (com 45 s, 60 -> 30 em 3 min)
# 2026-11-18 (registros do Poco X7 Pro com o #628: hz 60, 42 a 55 FPS, bateria de 29 a 43 °C em 10 min e 30 FPS logo
# depois): o Godot entrega o limite de FPS ao Swappy (frame pacing do Android), que pede à tela a frequência que casa
# com ele. Com limite 60 a tela fica em 60 Hz e o 40 não cabe; com limite 40 o Swappy pode pedir 120 Hz e aí 40 fica
# liso. Então, numa tela a 60 Hz, o primeiro degrau do calor é um teste de 40: se depois de uma janela a tela foi para
# 120 Hz, fica (escada de 120: 60, 40, 30); se continuou em 60, o teste sai até o jogo abrir de novo (_sem_40) e segue
# para a resolução. A lentidão sozinha não usa o teste (fazendo 45 no 60, fica no 60).
const TENTA_40 := true
const ESCALA_MIN := 0.4
const QUENTE_TERM := 2 # Android: 2 = já freando de leve
const QUENTE_FOLGA := 0.6 # 1.0 = começa a frear daqui a 10 s
const QUENTE_BAT := 42.0 # °C
var auto := false
var degrau := 0
var hz := 60 # frequência da tela agora (DisplayServer): os limites de FPS do Auto dividem ela
var _sem_40 := not TENTA_40 # o teste de 40 já falhou nesta abertura (a tela não foi a 120 Hz)
var _t_auto := AUTO_S
var _frio_s := 0.0
var _espera_sobe := AUTO_SOBE_S
var _subiu_em := -1000.0
var _desceu_em := -1000.0
var _motivo := "" # por que decidir() quis descer: "lento", "quente" ou "bateria"
var _gpu_soma := 0.0
var _gpu_n := 0
var _janelas := 0 # janelas seguidas com o jogo na tela
var _quadros := 0
var _tempo := 0.0
var _tranco_n := 0 # quadros de tranco na janela (fora da conta do FPS)
var _tranco_t := 0.0
var _t_amostra := 0.0 # (sem uso desde 2026-11-14: o tempo da placa não é mais lido)
const AMOSTRA_S := 5.0
# o tempo da placa não é lido (2026-11-14): com o desenho em paralelo, cada leitura faz a linha do jogo esperar a linha
# do desenho terminar o quadro (malhas.gd). O Auto usa o FPS de verdade (contado todo quadro, de graça) e o calor.

# a frequência da tela de agora (Hz inteiros; sem leitura: 60)
static func ler_hz() -> int:
	var r := roundi(DisplayServer.screen_get_refresh_rate())
	return r if r >= 30 else 60

# os degraus do Auto para um nível (0 = o nível cheio). Degrau que não mudaria nada fica de fora (a Baixa já é 30
# FPS: começa direto na resolução). Limite de FPS só os que dividem a frequência da tela (h).
# tenta_40: tela a 60 Hz que talvez vá a 120 (ver TENTA_40): entra um degrau de teste de 40 FPS logo abaixo do nível
# cheio, marcado "tenta" (os degraus seguintes continuam a partir do de antes, não dele)
static func escada(base: Dictionary, h := 60, tenta_40 := false) -> Array:
	var lista: Array = [base]
	var p: Dictionary = base
	for f in ESCADA_FPS:
		if h % f != 0:
			continue
		if int(base.fps) <= 0 or f < int(base.fps):
			p = p.duplicate()
			p.fps = f
			lista.append(p)
	if tenta_40 and h == 60 and int(p.fps) == 60:
		var t := p.duplicate()
		t.fps = 40
		t.tenta = true
		lista.append(t)
	p = p.duplicate()
	p.escala = maxf(ESCALA_MIN, float(base.escala) * 0.88)
	if p != lista.back():
		lista.append(p)
	p = p.duplicate()
	p.escala = maxf(ESCALA_MIN, float(base.escala) * 0.78)
	p.sombra_dist = float(base.sombra_dist) * 0.7
	if p != lista.back():
		lista.append(p)
	p = p.duplicate()
	p.grama = float(base.grama) * 0.8
	p.grama_qtd = float(base.grama_qtd) * 0.7
	p.alcance = float(base.alcance) * 0.85
	p.nevoa = float(base.nevoa) * 1.15
	lista.append(p)
	if int(base.fps) != 30:
		p = p.duplicate()
		p.fps = 30
		lista.append(p)
	# André 2026-11-25 (Note 10 Lite no fundo do Auto da Baixa e ainda 13 a 20 FPS; o gargalo é a quantidade de coisas
	# desenhadas, não a resolução): só a Baixa ganha mais dois degraus "mínimos", abaixo de tudo. Vista bem mais curta,
	# mato ralo ou nenhum, e personagens simplificados (corpos: 1 e 2, lidos em main.gd e online.gd). O Auto só chega
	# neles se o FPS não aguentar e sobe de volta quando sobra (decidir); celular que roda bem nunca passa por aqui.
	if base.get("desce_mais", false):
		p = p.duplicate()
		p.alcance = float(base.alcance) * 0.7
		p.grama = float(base.grama) * 0.6
		p.grama_qtd = float(base.grama_qtd) * 0.4
		p.nevoa = float(base.nevoa) * 1.4
		p.corpos = 1
		lista.append(p)
		p = p.duplicate()
		p.alcance = float(base.alcance) * 0.55
		p.grama = float(base.grama) * 0.4
		p.grama_qtd = 0.0
		p.nevoa = float(base.nevoa) * 1.8
		p.corpos = 2
		lista.append(p)
	return lista

# personagens simplificados nos degraus mínimos da Baixa (escada): 0 = normal, 1 e 2 = cada vez mais simples
func corpos() -> int:
	return int(P.get("corpos", 0))

static func preset_auto(base: Dictionary, d: int, h := 60, tenta_40 := false) -> Dictionary:
	var e := escada(base, h, tenta_40)
	return e[clampi(d, 0, e.size() - 1)]

# a escada de agora (nível, frequência da tela e se o teste de 40 ainda vale)
func _escada() -> Array:
	return escada(PRESETS[nivel], hz, not _sem_40)

# quantos degraus o Auto tem no nível de agora (menu_topo.gd mostra "aliviando 2 de 5")
func degraus() -> int:
	return _escada().size() - 1

func _process(dt: float) -> void:
	if _aos_poucos:
		var t0 := Time.get_ticks_usec()
		_ajustar_pendentes(AOS_POUCOS_US)
		if Engine.has_meta("lentidao"): # quadro lento (lentidao.gd)
			Engine.get_meta("lentidao").ev("grafico", t0)
	if not auto or m.etapa >= 0: # durante o Teste de FPS o Auto espera
		return
	var real := dt / maxf(Engine.time_scale, 0.001) # tempo de verdade (o golpe congela o jogo)
	_quadros += 1
	_tempo += real
	if real > TRANCO_S:
		_tranco_n += 1
		_tranco_t += real
	_t_auto -= real
	if _t_auto > 0.0:
		return
	_t_auto = AUTO_S
	var gpu := _gpu_soma / _gpu_n if _gpu_n > 0 else -1.0
	var t_bom := _tempo - _tranco_t
	var fps := (_quadros - _tranco_n) / t_bom if t_bom > AUTO_S * 0.5 else -1.0
	_gpu_soma = 0.0
	_gpu_n = 0
	_quadros = 0
	_tempo = 0.0
	_tranco_n = 0
	_tranco_t = 0.0
	# a tela pode trocar de frequência (economia de bateria do Android): refaz a escada no mesmo limite de FPS
	var h := ler_hz()
	if h != hz:
		_trocar_hz(h)
	elif P.get("tenta", false) and Time.get_ticks_msec() / 1000.0 - maxf(_desceu_em, _subiu_em) >= AUTO_S * 0.9:
		# uma janela inteira no teste de 40 e a tela continuou em 60 Hz: 40 vira 30 de verdade. Tira o teste da escada;
		# o mesmo número de degrau passa a ser o seguinte (resolução menor no 60)
		_sem_40 = true
		_desceu_em = Time.get_ticks_msec() / 1000.0
		_mudar(degrau)
		return
	# tela de entrada ou de carregamento na frente, ou o jogo acabou de aparecer (a fila de entrada pesa): não conta
	var on = m.online
	if m.heroi == null or (on and (on._cobrindo or (on.capa and on.capa.visible))):
		_janelas = 0
		return
	_janelas += 1
	if _janelas <= 2:
		return
	var L = m.lentidao
	var d := decidir(degrau, gpu, int(L.term) if L else -1, float(L.folga) if L else -1.0, float(L.bat) if L else -1.0, fps)
	var agora := Time.get_ticks_msec() / 1000.0
	if d > degrau:
		_frio_s = 0.0
		if _motivo == "bateria" and agora - _desceu_em < CALOR_BAT_S:
			return # a bateria demora a responder ao degrau de antes: espera mais um pouco
		if agora - _subiu_em < AUTO_S * 2.5: # tinha acabado de subir e não aguentou
			_espera_sobe = minf(_espera_sobe * 2.0, AUTO_SOBE_MAX)
		_desceu_em = agora
		_mudar(d)
	elif d < degrau:
		_frio_s += AUTO_S
		if _frio_s >= _espera_sobe:
			_frio_s = 0.0
			_subiu_em = agora
			_mudar(d)
	else:
		_frio_s = 0.0

# o degrau que o Auto quer agora (um passo por vez): gpu = ms médios da placa (-1 = sem medida); term/folga/bat -1 = sem leitura
# fps = quadros por segundo de verdade na janela (-1 = sem conta): bem abaixo do alvo também é "sem folga"
func decidir(d: int, gpu: float, term: int, folga: float, bat: float, fps := -1.0) -> int:
	var esc := _escada()
	var n := esc.size() - 1
	d = clampi(d, 0, n)
	var alvo := float(P.fps) if int(P.fps) > 0 else 60.0
	var orc := 1000.0 / alvo
	_motivo = ""
	if fps > 0.0 and fps < alvo * LENTO and d < n:
		# não chega no limite: desce só o FPS até o limite que ele aguenta (40 numa tela de 120 Hz, 45 na de 90). Sem
		# limite de FPS abaixo (tela de 60 Hz), só desce se nem 33 ele faz: dali, um degrau por vez até o 30
		var j := d + 1
		if j < n and int(esc[j].fps) < int(esc[d].fps) and float(esc[j].escala) == float(esc[d].escala) and not esc[j].get("tenta", false):
			if fps >= float(esc[j].fps) * 1.15:
				return d # faz bem mais que o limite de baixo (ex.: 50 com limite 60 numa tela de 120 Hz): fica
			_motivo = "lento"
			while j + 1 < n and int(esc[j].fps) > fps * 1.05 and int(esc[j + 1].fps) < int(esc[j].fps) \
					and float(esc[j + 1].escala) == float(esc[d].escala):
				j += 1
			return j
		if fps < 33.0:
			_motivo = "lento"
			return j
	if term >= QUENTE_TERM or folga >= QUENTE_FOLGA or gpu > orc * 0.92:
		_motivo = "quente"
		return mini(d + 1, n)
	if bat >= QUENTE_BAT:
		_motivo = "bateria"
		return mini(d + 1, n)
	if d == 0:
		return d
	var acima: Dictionary = esc[d - 1]
	# a placa trabalha mais ou menos pelo número de pontos desenhados (resolução ao quadrado)
	var k := pow(float(acima.escala) / float(P.escala), 2.0)
	var orc_acima := 1000.0 / float(acima.fps) if int(acima.fps) > 0 else 1000.0 / 60.0
	var frio := term < 1 and folga < QUENTE_FOLGA - 0.15 and bat < QUENTE_BAT - 2.5 and (gpu < 0.0 or gpu * k < orc_acima * 0.75) \
		and (fps < 0.0 or fps >= alvo * 0.95)
	return d - 1 if frio else d

# a tela trocou de frequência: fica no degrau da nova escada com o mesmo jeito (mesma qualidade, limite que divide)
func _trocar_hz(h: int) -> void:
	var antes: Dictionary = P
	hz = h
	var esc := _escada()
	var novo := esc.size() - 1
	for i in esc.size():
		if float(esc[i].escala) == float(antes.escala) and float(esc[i].alcance) == float(antes.alcance) and int(esc[i].fps) <= int(antes.fps):
			novo = i
			break
	if novo == esc.size() - 1 and int(antes.fps) > 30: # nenhum com o mesmo FPS: o de mesma qualidade (não cai para o 30)
		for i in esc.size():
			if float(esc[i].escala) == float(antes.escala) and float(esc[i].alcance) == float(antes.alcance):
				novo = i
				break
	_mudar(novo)

func _mudar(d: int) -> void:
	var antes: Dictionary = P
	degrau = clampi(d, 0, degraus())
	var esc := _escada()
	P = esc[degrau]
	if P.alcance != antes.alcance or P.grama != antes.grama or P.grama_qtd != antes.grama_qtd or P.nevoa != antes.nevoa:
		aplicar(true) # degrau da vista: confere o alcance de tudo que está na cena, aos poucos
	else:
		_aplicar_tela()

# aplica tudo: tela, sombra, névoa e o alcance de tudo que já está na cena
# aos_poucos (Auto no degrau da vista): o alcance de tudo que está na cena é conferido AOS_POUCOS_US por quadro (de uma vez
# custava ~250 ms no PC: um tranco no meio do jogo)
const AOS_POUCOS_US := 3000
var _aos_poucos := false
var _atlas_posto = null # o que já foi posto na placa (aplicar)
var _suave_posto = null

func aplicar(aos_poucos := false) -> void:
	_aplicar_tela()
	# Conselho 2026-11-14 (registros do celular: quadros de 282 a 472 ms com 164 a 292 shaders montados ao entrar no
	# degrau 4 do Auto): trocar a sombra suave, mesmo para o mesmo valor, faz a placa remontar os shaders de tudo que
	# está na cena. Só chama quando o valor muda de verdade.
	if P.atlas != _atlas_posto:
		_atlas_posto = P.atlas
		RenderingServer.directional_shadow_atlas_set_size(P.atlas, true)
	if P.suave != _suave_posto:
		_suave_posto = P.suave
		RenderingServer.directional_soft_shadow_filter_set_quality(P.suave)
	if m.relevo: # relevo.gd mexe na névoa e no fim da câmera todo quadro (vista do alto da montanha)
		m.relevo.nevoa_mult = P.nevoa
		m.relevo.longe_mult = lerpf(P.alcance, 1.0, 0.25) # a câmera enxerga um pouco além do que some (a névoa apaga)
	_pend = m.get_tree().root.find_children("*", "GeometryInstance3D", true, false)
	if aos_poucos:
		_aos_poucos = true # _process confere um pedaço por quadro
	else:
		_ajustar_pendentes()

# a parte leve (o Auto troca só isto nos degraus de FPS, resolução e sombra): resolução, suavização, LOD, FPS e sombra
func _aplicar_tela() -> void:
	var vp: Viewport = m.get_viewport()
	# versão PC (ferramentas/pc/preparar.sh grava aethra/pc_escala): monitor de PC tem bem menos pontos por polegada que
	# o celular, então a mesma escala ficava com cara de resolução baixa. No celular a opção não existe (x1).
	vp.scaling_3d_scale = minf(1.0, P.escala * float(ProjectSettings.get_setting("aethra/pc_escala", 1.0)))
	vp.msaa_3d = P.msaa
	vp.mesh_lod_threshold = P.lod
	Engine.max_fps = fps_alvo()
	if m.sol:
		m.sol.shadow_enabled = P.sombra
		if P.sombra:
			m.sol.directional_shadow_max_distance = P.sombra_dist

func _entrou(no: Node) -> void:
	# FPS (varredura 2026-11-10): na Alta o ajuste não muda nada (alcance x1, grama inteira, água completa) e cada
	# monstro, magia ou pedaço de mato que entra na cena passava por ele. Trocar de nível chama aplicar(), que
	# confere de novo tudo que está na cena.
	if _cheio():
		return
	if no is GeometryInstance3D:
		_pend.append(no)
		if not _agendado and not _aos_poucos:
			_agendado = true
			_ajustar_pendentes.call_deferred()

# alcance, grama e água inteiros (Alta, ou o Auto em cima da Alta antes do degrau da vista): nada a ajustar no que entra
func _cheio() -> bool:
	return float(P.alcance) == 1.0 and float(P.grama) == 1.0 and float(P.grama_qtd) >= 1.0 and not P.agua_simples

func _ajustar_pendentes(limite_us := 0) -> void:
	_agendado = false
	var t0 := Time.get_ticks_usec()
	while not _pend.is_empty():
		var g = _pend.pop_back()
		if is_instance_valid(g) and g.is_inside_tree():
			_ajustar(g)
		if limite_us > 0 and Time.get_ticks_usec() - t0 >= limite_us:
			return # o resto fica para o próximo quadro
	_aos_poucos = false
	for mat in _mats_agua:
		mat.set_shader_parameter("simples", P.agua_simples)
	for mat in _mats_grama:
		mat.set_shader_parameter("encolhe_de", ENCOLHE_DE * P.grama * 0.9)
		mat.set_shader_parameter("encolhe_ate", ENCOLHE_ATE * P.grama * 0.9)

func _ajustar(g: GeometryInstance3D) -> void:
	var grama := false
	for mat in _materiais(g):
		var caminho: String = mat.shader.resource_path if mat.shader else ""
		if caminho.ends_with("/agua.gdshader") or caminho.ends_with("/rio.gdshader"):
			_mats_agua[mat] = true
		elif caminho.ends_with("/grama.gdshader"):
			_mats_grama[mat] = true
			grama = true
	var f: float = P.grama if grama else P.alcance
	# alcance (visibility range): guardo o original na primeira vez; se o jogo mudou o valor depois que eu ajustei,
	# o valor novo do jogo vira o original
	var b: Array = g.get_meta("_alcance", [])
	if not b.is_empty() and (not is_equal_approx(g.visibility_range_end, b[4]) or not is_equal_approx(g.visibility_range_begin, b[5])):
		b = []
	if b.is_empty():
		if f == 1.0 and not grama:
			return # Alta: nada muda
		b = [g.visibility_range_begin, g.visibility_range_end, g.visibility_range_begin_margin, g.visibility_range_end_margin, 0.0, 0.0]
	g.visibility_range_begin = b[0] * f
	g.visibility_range_end = b[1] * f
	g.visibility_range_begin_margin = b[2] * f
	g.visibility_range_end_margin = b[3] * f
	b[4] = g.visibility_range_end
	b[5] = g.visibility_range_begin
	g.set_meta("_alcance", b)
	if grama and g is MultiMeshInstance3D and g.multimesh:
		# menos folhas: as folhas de cada pedaço foram sorteadas em ordem aleatória, então as primeiras N cobrem o
		# pedaço inteiro (só mais ralo). O pedaço que não desenha nada (visible_instance_count 0) continua assim.
		var mm: MultiMesh = g.multimesh
		var q0: int = g.get_meta("_qtd", mm.visible_instance_count)
		g.set_meta("_qtd", q0)
		if q0 != 0:
			var total: int = mm.instance_count if q0 < 0 else mini(q0, mm.instance_count)
			mm.visible_instance_count = q0 if P.grama_qtd >= 1.0 else int(total * P.grama_qtd)

func _materiais(g: GeometryInstance3D) -> Array:
	var r: Array = []
	if g.material_override is ShaderMaterial:
		r.append(g.material_override)
	var malha: Mesh = null
	if g is MeshInstance3D:
		malha = g.mesh
		for i in g.get_surface_override_material_count():
			var o: Material = g.get_surface_override_material(i)
			if o is ShaderMaterial:
				r.append(o)
	elif g is MultiMeshInstance3D and g.multimesh:
		malha = g.multimesh.mesh
	if malha:
		for i in malha.get_surface_count():
			var s := malha.surface_get_material(i)
			if s is ShaderMaterial:
				r.append(s)
	return r

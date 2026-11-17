extends Node
# Conversa com o servidor do jogo no Oracle (Node.js + Colyseus 0.15, o mesmo do site).
# Login: o app nunca vê a senha do Google. "Entrar com Google" abre o site com ?vincular=CODIGO; depois do login lá,
# o servidor guarda uma sessão para este código e o app busca (GET /conta/vinculo/CODIGO). A sessão fica em user://conta.cfg.
# Sala: POST /matchmake/joinOrCreate/clareira e WebSocket em /{processo}/{sala}?sessionId=...; as mensagens vão em MessagePack.

const MP = preload("res://msgpack.gd")
const SERVIDOR := "https://163-176-80-126.sslip.io"
const SITE := "https://rcandrerc.github.io/Rpg-realista/"
const ARQUIVO := "user://conta.cfg"
# códigos do protocolo do Colyseus 0.15
const JOIN_ROOM := 10
const ERROR := 11
const LEAVE_ROOM := 12
const ROOM_DATA := 13

signal estado(texto: String) # para mostrar na tela ("Conectando…", "Online", erro)
signal entrou(meu_id: String, conta: Dictionary)
signal mensagem(tipo, dados)
signal caiu(motivo: String)
signal precisa_login # sem sessão guardada (ou vencida): mostrar o botão Entrar com Google
signal escolher_conta(conta: Dictionary) # abriu o jogo com conta salva: perguntar se entra com ela ou troca
signal conta_respondeu(r: Dictionary) # a conferência da conta salva (feita por trás da janela de escolha) voltou

var servidor := SERVIDOR # dá para trocar no teste (variável RPG_SERVIDOR)
# Caminho reserva (André 2026-11-16: o celular dele parou de abrir qualquer endereço *.sslip.io, no Wi-Fi e no 5G, com
# ERR_SSL_PROTOCOL_ERROR; o servidor abria normal no resto do mundo). Se o nome falha, o app vai direto no IP do servidor
# e manda o nome dentro do TLS (o certificado é o mesmo); o servidor pediu ao Caddy para aceitar o IP (server/caddy-reserva.js).
# Deu certo pelo IP: fica pelo IP até fechar o app.
var _reserva := false
var sessao := ""
var conta := {}
var meu_id := ""
var ws: WebSocketPeer
var conectado := false
var _codigo := ""
var _espera_vinculo := 0.0
var _vinculo_ate := 0.0
var _pedindo := false
var _tempo := 0.0
var ping_ms := -1.0
# André 2026-11-12 (de quem é a culpa do lag?): quando chegou o último pacote do servidor e o pior passo dele nos
# últimos segundos (mensagem "carga", junto com o pong). online.gd mostra "Internet travada" ou "Servidor lento".
var ult_pacote_ms := 0
var servidor_pico := -1.0
var _ping_t := 0.0
# Religar na mesma sessão (André 2026-11-12, internet caindo): o servidor segura o herói 20 s esperando a volta
# (allowReconnection). Com o token que ele manda ao entrar, o app volta como o mesmo herói, sem entrar de novo na sala.
# {processo, sala, id, token, caiu_ms}; vazio = não dá para religar (saiu de propósito, foi trocado, passou do tempo)
var _volta := {}
const VOLTA_MAX_MS := 17000 # o servidor espera 20 s a partir de quando ele viu a queda
# Conexão morta sem o celular saber (André 2026-11-12: ligação corta os dados móveis). O WebSocket fica "aberto" e o
# sistema demora muito para desistir; e quando os dados voltam, o TCP antigo pode levar mais uns 10 a 30 s para
# reenviar. O servidor manda algo 20 vezes por segundo (o mundo) e o pong a cada 2 s: SILENCIO_MAX_MS sem nada é
# conexão morta. Larga ela e religa (mesma sessão se o servidor já viu a queda; senão entra de novo, o #408 cuida)
const SILENCIO_MAX_MS := 6000
# André 2026-11-13 ("conta sem nome" que entrava como "Ruiva"): o nome da conta fica guardado no aparelho junto com a
# sessão, para a tela "Entrar como…" mostrar o nome certo mesmo quando o servidor demora a responder na abertura.
var nome_salvo := ""
var _abriu_google := false # a janela do Google (ou o navegador) abriu: na volta o jogo esconde de novo a barra do Android
var _trocado := false # o servidor disse que a conta está jogando em outro aparelho (último login vale)
var _entrando_auto := false # entrando de novo sozinho (queda), ainda sem resposta da sala

# a conta está jogando em outro aparelho agora? (servidor fora ou sem resposta: false, segue o caminho de sempre)
# "163-176-80-126.sslip.io" (o nome que está no certificado) e "163.176.80.126" (o IP que ele traz)
func _nome_servidor() -> String:
	return servidor.trim_prefix("https://").trim_prefix("http://").get_slice("/", 0)

func _ip_reserva() -> String:
	if not servidor.begins_with("https://"):
		return ""
	var n := _nome_servidor()
	if not n.ends_with(".sslip.io"):
		return ""
	var ip := n.trim_suffix(".sslip.io").replace("-", ".")
	return ip if ip.is_valid_ip_address() else ""

func _ligada_em_outro() -> bool:
	var r := await pedir("GET", "/conta/ligada")
	return r.codigo == 200 and r.dados.get("ligada", false) == true

func _conferir_troca(motivo: String) -> void:
	caiu.emit("trocado" if await _ligada_em_outro() else motivo)

func _ready() -> void:
	if OS.get_environment("RPG_SERVIDOR") != "":
		servidor = OS.get_environment("RPG_SERVIDOR")
	var cfg := ConfigFile.new()
	if cfg.load(ARQUIVO) == OK:
		sessao = str(cfg.get_value("conta", "sessao", ""))
		nome_salvo = str(cfg.get_value("conta", "nome", "")) if sessao != "" else ""
	if OS.get_environment("RPG_SESSAO") != "": # só para teste
		sessao = OS.get_environment("RPG_SESSAO")
	# celular de teste (Firebase Test Lab): conta do robô. load e não preload: o teste da rede (motor-teste.yml) roda este
	# arquivo sozinho num projeto vazio
	if ResourceLoader.exists("res://robo_celular.gd"):
		var robo: Dictionary = load("res://robo_celular.gd").config()
		if robo.has("sessao"):
			sessao = robo.sessao

# André 2026-11-17: voltou do segundo plano (o serviço do fundo segura o app vivo, plugin FundoJogo). A conexão caída logo
# depois volta em silêncio, sem o aviso "Caiu a conexão" (online.gd)
var voltou_ms := -100000
func voltou_agora() -> bool:
	return Time.get_ticks_msec() - voltou_ms < 15000

# voltou para o app (o site abre o jogo depois do login): busca a sessão na hora
func _notification(o: int) -> void:
	if o == NOTIFICATION_APPLICATION_RESUMED:
		voltou_ms = Time.get_ticks_msec()
	if o == NOTIFICATION_APPLICATION_FOCUS_IN or o == NOTIFICATION_APPLICATION_RESUMED:
		_espera_vinculo = 0.0
		if _abriu_google:
			tela_cheia.call_deferred()

# André 2026-11-13: depois da janela do Google a barra do Android ficava aparecendo, como se o jogo tivesse saído.
# O Godot só esconde a barra quando o modo muda (Godot.kt enableImmersiveMode ignora "tela cheia" de novo), então
# desliga e liga a tela cheia para ele esconder de verdade. Só no celular e só depois de abrir o login do Google.
func tela_cheia() -> void:
	if OS.get_name() != "Android":
		return
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_MAXIMIZED)
	DisplayServer.window_set_mode(DisplayServer.WINDOW_MODE_FULLSCREEN)

# a conta chegou do servidor: guarda o nome junto da sessão (tela "Entrar como…")
func _lembrar_conta(c: Dictionary) -> void:
	conta = c
	var n := str(c.get("nome", ""))
	if n == "" or n == nome_salvo:
		return
	nome_salvo = n
	var cfg := ConfigFile.new()
	cfg.load(ARQUIVO)
	cfg.set_value("conta", "nome", n)
	cfg.save(ARQUIVO)

func guardar(s: String) -> void:
	if s != sessao: # outra conta (ou saiu): o nome guardado era da conta antiga
		nome_salvo = ""
	sessao = s
	var cfg := ConfigFile.new()
	cfg.set_value("conta", "sessao", s)
	if nome_salvo != "":
		cfg.set_value("conta", "nome", nome_salvo)
	cfg.save(ARQUIVO)

# Começo: com sessão guardada, confere e entra (perguntar = abriu o jogo agora: mostra a janela de escolher a conta);
# sem sessão, pede login
# automatico = o app tentando voltar sozinho depois de uma queda: o servidor não deixa essa entrada derrubar outro aparelho
func iniciar(perguntar := false, automatico := false) -> void:
	if sessao == "":
		precisa_login.emit()
		return
	# André 2026-11-15 ("ainda fica mais alguns segundos até aparecer a janela"): com o nome guardado no aparelho a
	# janela de escolher a conta abre na hora; a conta é conferida no servidor por trás (_conferir_por_tras). O Entrar
	# espera essa resposta (continuar), e sessão vencida troca a janela pela do Google, como antes.
	if perguntar and nome_salvo != "" and str(conta.get("nome", "")) == "":
		estado.emit("")
		escolher_conta.emit(conta)
		_conferir_por_tras()
		return
	estado.emit("Conectando…")
	var r := await _pedir_conta()
	if r.codigo == 200:
		_lembrar_conta(r.dados.get("conta", {}))
		if perguntar:
			estado.emit("")
			escolher_conta.emit(conta)
			return
		entrar_na_sala(automatico)
	elif r.codigo == 401:
		guardar("")
		precisa_login.emit()
	else:
		estado.emit("Servidor fora do ar")
		caiu.emit("fora")

var _conta_no_ar := false # a conferência por trás ainda não voltou
var _continuando := false # o jogador já tocou em Entrar: quem trata a resposta é o continuar
func _conferir_por_tras() -> void:
	_conta_no_ar = true
	var r := await _pedir_conta()
	_conta_no_ar = false
	if r.codigo == 200:
		_lembrar_conta(r.dados.get("conta", {}))
	elif r.codigo == 401 and not _continuando:
		guardar("")
		precisa_login.emit()
	conta_respondeu.emit(r)

# GET /conta/eu com mais paciência. André 2026-11-13: na abertura o celular está montando o mundo e a primeira
# resposta às vezes não vinha a tempo; a tela aparecia "sem nome" e o "Entrar" ia para a sala sem os dados da conta
# (o herói ficava com o nome padrão "Ruiva"). Tenta de novo 3 vezes antes de desistir; 401 (sessão vencida) não insiste.
func _pedir_conta() -> Dictionary:
	var r := {"codigo": 0, "dados": {}}
	for i in 4:
		r = await pedir("GET", "/conta/eu")
		if r.codigo == 200 or r.codigo == 401:
			return r
		if i < 3:
			await get_tree().create_timer(1.5 + i).timeout
	return r

# Botão "Entrar com Google": janela do próprio Google dentro do app (plugin LoginGoogle). Se ela não der
# (app ainda não cadastrado no Google Cloud, celular sem Play Services), cai no login pelo site.
const CLIENT_ID_WEB := "21985745474-qfl366rlb5c357rnh8p520sd46al3m48.apps.googleusercontent.com" # o mesmo de shared/conta.js
var _login_nativo = null
func entrar_com_google() -> void:
	if Engine.has_singleton("LoginGoogle"):
		if _login_nativo == null:
			_login_nativo = Engine.get_singleton("LoginGoogle")
			_login_nativo.login_ok.connect(_nativo_ok)
			_login_nativo.login_erro.connect(_nativo_erro)
		estado.emit("Entrando…")
		_abriu_google = true
		_login_nativo.entrar(CLIENT_ID_WEB)
	else:
		entrar_pelo_site()

func _nativo_ok(token: String, _nome: String) -> void:
	tela_cheia.call_deferred()
	estado.emit("Entrando…")
	# "criar" entra na conta que já existe ou cria uma na primeira vez (o servidor confere o crachá do Google)
	var r := await pedir("POST", "/conta/entrar", {"credencial": token, "modo": "criar"}, false)
	if r.codigo == 200 and r.dados.has("sessao"):
		guardar(str(r.dados.sessao))
		iniciar()
	else:
		estado.emit("O servidor não aceitou o login. Tente de novo.")
		precisa_login.emit()

func _nativo_erro(msg: String) -> void:
	tela_cheia.call_deferred()
	push_warning("login nativo: " + msg)
	if msg == "cancelado":
		estado.emit("Login cancelado")
		precisa_login.emit()
	else:
		entrar_pelo_site()

# Login pelo site: abre o navegador e fica esperando o servidor liberar a sessão
# o site sempre esquece a conta que ele mesmo lembrava: quem escolhe a conta é a janela do Google (versão PC 2026-11-13:
# depois de sair ou de "Trocar de conta", entrava de novo sozinho na mesma conta)
func entrar_pelo_site() -> void:
	_abrir_site(true)

func _abrir_site(trocar: bool) -> void:
	var letras := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	var cripto := Crypto.new()
	var bytes := cripto.generate_random_bytes(32)
	_codigo = ""
	for b in bytes:
		_codigo += letras[b % letras.length()]
	# trocar=1: o site esquece a conta que ele mesmo lembrava e mostra a escolha de conta do Google (versão PC, 2026-11-13:
	# "Trocar de conta" voltava sempre na mesma conta)
	_abriu_google = true
	OS.shell_open(SITE + "?vincular=" + _codigo + ("&trocar=1" if trocar else ""))
	_vinculo_ate = _tempo + 300.0
	_espera_vinculo = 2.0
	estado.emit("Faça o login no navegador e volte para o jogo")

# janela do começo: entrar com a conta salva, ou sair dela e abrir a escolha de conta do Google
# Sem os dados da conta (o servidor não tinha respondido na abertura), busca antes de entrar: assim o herói entra com
# o nome dele e não com o padrão "Ruiva".
func continuar() -> void:
	estado.emit("Conectando…")
	if str(conta.get("nome", "")) == "":
		_continuando = true
		var r: Dictionary = (await conta_respondeu) if _conta_no_ar else (await _pedir_conta())
		_continuando = false
		if r.codigo == 401:
			guardar("")
			precisa_login.emit()
			return
		if r.codigo != 200:
			estado.emit("Servidor fora do ar")
			caiu.emit("fora")
			return
		_lembrar_conta(r.dados.get("conta", {}))
	entrar_na_sala()

func trocar_conta() -> void:
	sair_da_conta()
	if _login_nativo or Engine.has_singleton("LoginGoogle"):
		entrar_com_google()
	else:
		_abrir_site(true)

func sair_da_conta() -> void:
	if _login_nativo:
		_login_nativo.sair()
	if sessao != "":
		pedir("POST", "/conta/sair", {})
	guardar("")
	fechar()

# André (2026-11-03): "Sair da conta" sai de verdade. Espera o servidor apagar a sessão antes de esquecer a conta
# (o jogo é recarregado logo depois e o pedido não pode morrer no meio).
func sair_de_vez() -> void:
	_sair_google()
	if sessao != "":
		await pedir("POST", "/conta/sair", {})
	guardar("")
	conta = {}
	fechar()

# Apagar o personagem (pedido do André, 2026-11-03): apaga a conta do jogo no servidor (nome, corpo, nível, itens,
# ouro). A conta Google continua; entrando de novo com ela, o servidor cria uma conta nova e o criador abre.
# Devolve true se o servidor apagou.
func apagar_personagem() -> bool:
	if sessao == "":
		return false
	var r := await pedir("POST", "/conta/apagar", {})
	if r.codigo != 200:
		return false
	_sair_google()
	guardar("")
	conta = {}
	fechar()
	return true

# esquece o login do Google no aparelho (na próxima vez a janela do Google pergunta qual conta)
func _sair_google() -> void:
	if _login_nativo:
		_login_nativo.sair()
	elif Engine.has_singleton("LoginGoogle"):
		Engine.get_singleton("LoginGoogle").sair()

func fechar() -> void:
	_volta = {} # saiu de propósito: não volta como o mesmo herói
	if ws:
		ws.close()
	ws = null
	conectado = false

# HTTP simples: devolve {codigo, dados}
func pedir(metodo: String, caminho: String, corpo = null, com_sessao := true) -> Dictionary:
	var http := HTTPRequest.new()
	http.timeout = 8.0
	# linha própria (André 2026-11-15): na abertura os quadros estão pesados e, sem ela, a conexão só andava um pouco
	# por quadro; a resposta da conta chegava 8 a 10 s depois
	http.use_threads = true
	add_child(http)
	var cab := PackedStringArray(["Content-Type: application/json"])
	if com_sessao and sessao != "":
		cab.append("Authorization: Bearer " + sessao)
	var m := HTTPClient.METHOD_POST if metodo == "POST" else HTTPClient.METHOD_GET
	var base := servidor
	if _reserva and _ip_reserva() != "":
		base = "https://" + _ip_reserva()
		http.set_tls_options(TLSOptions.client(null, _nome_servidor()))
		cab.append("Host: " + _nome_servidor())
	var erro := http.request(base + caminho, cab, m, JSON.stringify(corpo) if corpo != null else "")
	if erro != OK:
		http.queue_free()
		return {"codigo": 0, "dados": {}}
	var res: Array = await http.request_completed
	http.queue_free()
	# o nome do servidor não abriu (bloqueado, não achou, TLS estranho): tenta uma vez pelo IP
	if not _reserva and _ip_reserva() != "" and int(res[0]) in [HTTPRequest.RESULT_CANT_RESOLVE, HTTPRequest.RESULT_CANT_CONNECT,
			HTTPRequest.RESULT_CONNECTION_ERROR, HTTPRequest.RESULT_TLS_HANDSHAKE_ERROR, HTTPRequest.RESULT_TIMEOUT]:
		_reserva = true
		var r2 := await pedir(metodo, caminho, corpo, com_sessao)
		if r2.codigo == 0: # pelo IP também não: volta a tentar pelo nome na próxima
			_reserva = false
		else:
			print("rede: servidor pelo caminho reserva (IP)")
		return r2
	var txt := (res[3] as PackedByteArray).get_string_from_utf8().strip_edges()
	# resposta vazia ou que não é JSON (servidor reiniciando, página de erro): sem dados, sem erro no log
	var dados = JSON.parse_string(txt) if txt.begins_with("{") or txt.begins_with("[") else null
	return {"codigo": int(res[1]) if res[0] == HTTPRequest.RESULT_SUCCESS else 0, "dados": dados if dados is Dictionary else {}}

func entrar_na_sala(automatico := false) -> void:
	estado.emit("Entrando no mundo…")
	_trocado = false
	_entrando_auto = automatico
	if automatico and await _ligada_em_outro(): # a conta já está jogando em outro aparelho: não derruba ele
		_entrando_auto = false
		caiu.emit("trocado")
		return
	# volta: entrada automática (queda). O servidor recusa se a conta já está jogando em outro aparelho (último login vale)
	var r := await pedir("POST", "/matchmake/joinOrCreate/clareira", {"sessao": sessao, "nome": conta.get("nome", "Andarilho"), "json": true, "aoi": true, "volta": automatico}) # aoi: só o que está perto (server/visao.js)
	if r.codigo != 200 or not r.dados.has("room"):
		if Engine.has_meta("lentidao"):
			Engine.get_meta("lentidao").anotar("sala_erro", r.codigo)
		estado.emit("Não deu para entrar na sala")
		caiu.emit("sala")
		return
	var sala: Dictionary = r.dados.room
	meu_id = str(r.dados.sessionId)
	if Engine.has_meta("lentidao"):
		Engine.get_meta("lentidao").marcar("sala") # a sala respondeu (registro da entrada)
	_volta = {"processo": str(sala.processId), "sala": str(sala.roomId), "id": meu_id, "token": "", "caiu_ms": 0}
	_abrir_ws("")

# volta para a mesma sala como o mesmo herói. false = não dá (o online.gd entra de novo do jeito normal)
func pode_religar() -> bool:
	return not _volta.is_empty() and str(_volta.token) != "" and int(_volta.caiu_ms) > 0 and Time.get_ticks_msec() - int(_volta.caiu_ms) < VOLTA_MAX_MS

func religar() -> void:
	if not pode_religar():
		_volta = {}
		iniciar(false, true)
		return
	estado.emit("Voltando…")
	var v := _volta
	var r := await pedir("POST", "/matchmake/reconnect/" + str(v.sala), {"reconnectionToken": str(v.token)})
	if conectado or ws != null: # já voltou por outro caminho enquanto esperava a resposta
		return
	if r.codigo == 0: # sem internet ainda: o token continua valendo, tenta de novo daqui a pouco (online.gd)
		estado.emit("Sem internet")
		caiu.emit("fora")
		return
	if r.codigo != 200 or not r.dados.has("room") or str(r.dados.get("sessionId", "")) != str(v.id):
		_volta = {} # o servidor não segura mais o herói (passou dos 20 s, reiniciou ou a conta entrou em outro aparelho): entra de novo
		iniciar(false, true)
		return
	meu_id = str(v.id)
	_abrir_ws(str(v.token))

func _abrir_ws(token: String) -> void:
	var base := "https://" + _ip_reserva() if _reserva and _ip_reserva() != "" else servidor
	var url := base.replace("https://", "wss://").replace("http://", "ws://") + "/" + str(_volta.processo) + "/" + str(_volta.sala) + "?sessionId=" + meu_id
	if token != "":
		url += "&reconnectionToken=" + token.uri_encode()
	ws = WebSocketPeer.new()
	ws.inbound_buffer_size = 1 << 20
	ws.outbound_buffer_size = 1 << 18
	ws.max_queued_packets = 4096
	if ws.connect_to_url(url, TLSOptions.client(null, _nome_servidor()) if _reserva and _ip_reserva() != "" else null) != OK:
		ws = null
		caiu.emit("ws")

# Manda uma mensagem para a sala (igual a room.send(tipo, dados) do site)
func enviar(tipo: String, dados = null) -> void:
	if not conectado or ws == null:
		return
	var b := PackedByteArray([ROOM_DATA])
	b.append_array(MP.codificar(tipo))
	if dados != null:
		b.append_array(MP.codificar(dados))
	ws.send(b)
	# André 2026-11-11 (ping 200 a 1000): o WebSocket do Godot só põe na rede o que foi enviado no próximo poll(), que
	# era no quadro seguinte. A 30 FPS cada mensagem (posição, golpe, ping) esperava até mais um quadro inteiro.
	# Agora sai na hora.
	ws.poll()

var ms := 0.0 # tempo gasto aqui por quadro (média), aparece no Teste
var _fila_mundo: Array = [] # fotos do mundo que chegaram neste quadro
func _process(dt: float) -> void:
	var t0_parte := Time.get_ticks_usec()
	_process_parte(dt)
	if Time.get_ticks_usec() - t0_parte >= 1000 and Engine.has_meta("lentidao"): # quadro lento (lentidao.gd)
		Engine.get_meta("lentidao").ev("rede", t0_parte)

func _process_parte(dt: float) -> void:
	var t0 := Time.get_ticks_usec()
	_passo(dt)
	ms = lerp(ms, (Time.get_ticks_usec() - t0) / 1000.0, 0.05)

func _passo(dt: float) -> void:
	_tempo += dt
	# esperando o login no navegador
	if _codigo != "" and not _pedindo:
		_espera_vinculo -= dt
		if _tempo > _vinculo_ate:
			_codigo = ""
			estado.emit("O login demorou demais. Toque em Entrar de novo.")
			precisa_login.emit()
		elif _espera_vinculo <= 0.0:
			_espera_vinculo = 2.0
			_buscar_vinculo()
	if ws == null:
		return
	ws.poll()
	var st := ws.get_ready_state()
	if conectado and st == WebSocketPeer.STATE_OPEN and ws.get_available_packet_count() == 0 and ult_pacote_ms > 0 and Time.get_ticks_msec() - ult_pacote_ms > SILENCIO_MAX_MS:
		ws = null # não espera o fechamento educado de um socket morto
		conectado = false
		if not _volta.is_empty():
			_volta.caiu_ms = Time.get_ticks_msec()
		estado.emit("Caiu a conexão")
		caiu.emit("silencio")
		return
	if st == WebSocketPeer.STATE_CLOSED:
		var codigo_fim := ws.get_close_code()
		var motivo := "fechou %d" % codigo_fim
		# André 2026-11-13: a conta entrou em outro aparelho (4001) ou o servidor recusou a volta automática porque ela já
		# está jogando em outro (erro "outro_aparelho"). Este aparelho sai e não tenta voltar sozinho (online.gd "trocado")
		if codigo_fim == 4001 or _trocado:
			motivo = "trocado"
			_trocado = false
		ws = null
		# volta automática recusada antes de entrar (4002: o Godot nem sempre lê o erro que vem junto com o fechamento)
		if codigo_fim == 4002 and _entrando_auto and not conectado:
			_entrando_auto = false
			_conferir_troca(motivo)
			return
		if not _volta.is_empty():
			if codigo_fim == 1000 or codigo_fim >= 4000: # o servidor fechou de propósito (trocado por outro aparelho, saiu, reiniciou)
				_volta = {}
			elif conectado:
				_volta.caiu_ms = Time.get_ticks_msec()
		var estava := conectado
		conectado = false
		if estava:
			estado.emit("Caiu a conexão")
		caiu.emit(motivo)
		return
	while ws.get_available_packet_count() > 0:
		ult_pacote_ms = Time.get_ticks_msec()
		_receber(ws.get_packet())
	# André 2026-11-12: depois de um engasgo da internet chegam dezenas de fotos atrasadas juntas. Antes cada uma era
	# aplicada inteira no mesmo quadro (o jogo travava na volta). Agora só a mais nova é aplicada inteira; as do meio só
	# completam o que se sabe de cada corpo e entregam os eventos (online.gd "mundo_meio")
	if not _fila_mundo.is_empty():
		var fila := _fila_mundo
		_fila_mundo = []
		for k in fila.size() - 1:
			mensagem.emit("mundo_meio", fila[k])
		mensagem.emit("mundo", fila[fila.size() - 1])
	if conectado:
		_ping_t -= dt
		if _ping_t <= 0.0:
			_ping_t = 2.0
			enviar("ping", Time.get_ticks_msec())

func _buscar_vinculo() -> void:
	_pedindo = true
	var cod := _codigo
	var r := await pedir("GET", "/conta/vinculo/" + cod, null, false)
	_pedindo = false
	if r.codigo == 200 and r.dados.has("sessao") and cod == _codigo:
		_codigo = ""
		guardar(str(r.dados.sessao))
		iniciar()

func _receber(p: PackedByteArray) -> void:
	if p.is_empty():
		return
	var b := StreamPeerBuffer.new()
	b.big_endian = true
	b.data_array = p
	var codigo := b.get_u8()
	match codigo:
		JOIN_ROOM:
			# [10, token de reconexão, serializador]: responde [10] e passa a valer como dentro da sala
			var n := b.get_u8() if p.size() > 1 else 0
			if not _volta.is_empty() and n > 0 and p.size() >= 2 + n:
				_volta.token = p.slice(2, 2 + n).get_string_from_utf8() # o servidor troca o token a cada entrada
				_volta.caiu_ms = 0
			ws.send(PackedByteArray([JOIN_ROOM]))
			ult_pacote_ms = Time.get_ticks_msec() # o silêncio conta a partir de agora
			conectado = true
			_entrando_auto = false
			estado.emit("Online")
			entrou.emit(meu_id, conta)
		ERROR:
			var cod = MP.ler(b)
			var txt = MP.ler(b) if b.get_position() < p.size() else ""
			if str(txt) == "login":
				guardar("")
				precisa_login.emit()
			if str(txt) == "outro_aparelho": # o fechamento vem logo depois: vira caiu("trocado")
				_trocado = true
				_volta = {}
			estado.emit("Servidor recusou: %s" % str(txt))
			push_warning("erro do servidor %s %s" % [cod, txt])
		LEAVE_ROOM:
			fechar()
			caiu.emit("saiu")
		ROOM_DATA:
			var tipo = MP.ler(b)
			var dados = MP.ler(b) if b.get_position() < p.size() else null
			if str(tipo) == "mundoJ" and dados is String: # o mundo em JSON (mais rápido de ler aqui)
				var d = JSON.parse_string(dados)
				if d is Dictionary:
					_fila_mundo.append(d) # vai no fim do quadro (_passo): só a foto mais nova é aplicada inteira
				return
			if str(tipo) == "pong" and dados is int:
				ping_ms = Time.get_ticks_msec() - dados
				return
			if str(tipo) == "carga" and dados is Dictionary:
				servidor_pico = float(dados.get("pico", -1))
				return
			mensagem.emit(tipo, dados)

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

var servidor := SERVIDOR # dá para trocar no teste (variável RPG_SERVIDOR)
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
var _ping_t := 0.0

func _ready() -> void:
	if OS.get_environment("RPG_SERVIDOR") != "":
		servidor = OS.get_environment("RPG_SERVIDOR")
	var cfg := ConfigFile.new()
	if cfg.load(ARQUIVO) == OK:
		sessao = str(cfg.get_value("conta", "sessao", ""))
	if OS.get_environment("RPG_SESSAO") != "": # só para teste
		sessao = OS.get_environment("RPG_SESSAO")

# voltou para o app (o site abre o jogo depois do login): busca a sessão na hora
func _notification(o: int) -> void:
	if o == NOTIFICATION_APPLICATION_FOCUS_IN or o == NOTIFICATION_APPLICATION_RESUMED:
		_espera_vinculo = 0.0

func guardar(s: String) -> void:
	sessao = s
	var cfg := ConfigFile.new()
	cfg.set_value("conta", "sessao", s)
	cfg.save(ARQUIVO)

# Começo: com sessão guardada, confere e entra (perguntar = abriu o jogo agora: mostra a janela de escolher a conta);
# sem sessão, pede login
func iniciar(perguntar := false) -> void:
	if sessao == "":
		precisa_login.emit()
		return
	estado.emit("Conectando…")
	var r := await pedir("GET", "/conta/eu")
	if r.codigo == 200:
		conta = r.dados.get("conta", {})
		if perguntar:
			estado.emit("")
			escolher_conta.emit(conta)
			return
		entrar_na_sala()
	elif r.codigo == 401:
		guardar("")
		precisa_login.emit()
	else:
		estado.emit("Servidor fora do ar")
		caiu.emit("fora")

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
		_login_nativo.entrar(CLIENT_ID_WEB)
	else:
		entrar_pelo_site()

func _nativo_ok(token: String, _nome: String) -> void:
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
	push_warning("login nativo: " + msg)
	if msg == "cancelado":
		estado.emit("Login cancelado")
		precisa_login.emit()
	else:
		entrar_pelo_site()

# Login pelo site: abre o navegador e fica esperando o servidor liberar a sessão
func entrar_pelo_site() -> void:
	var letras := "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"
	var cripto := Crypto.new()
	var bytes := cripto.generate_random_bytes(32)
	_codigo = ""
	for b in bytes:
		_codigo += letras[b % letras.length()]
	OS.shell_open(SITE + "?vincular=" + _codigo)
	_vinculo_ate = _tempo + 300.0
	_espera_vinculo = 2.0
	estado.emit("Faça o login no navegador e volte para o jogo")

# janela do começo: entrar com a conta salva, ou sair dela e abrir a escolha de conta do Google
func continuar() -> void:
	estado.emit("Conectando…")
	entrar_na_sala()

func trocar_conta() -> void:
	sair_da_conta()
	entrar_com_google()

func sair_da_conta() -> void:
	if _login_nativo:
		_login_nativo.sair()
	if sessao != "":
		pedir("POST", "/conta/sair", {})
	guardar("")
	fechar()

func fechar() -> void:
	if ws:
		ws.close()
	ws = null
	conectado = false

# HTTP simples: devolve {codigo, dados}
func pedir(metodo: String, caminho: String, corpo = null, com_sessao := true) -> Dictionary:
	var http := HTTPRequest.new()
	http.timeout = 8.0
	add_child(http)
	var cab := PackedStringArray(["Content-Type: application/json"])
	if com_sessao and sessao != "":
		cab.append("Authorization: Bearer " + sessao)
	var m := HTTPClient.METHOD_POST if metodo == "POST" else HTTPClient.METHOD_GET
	var erro := http.request(servidor + caminho, cab, m, JSON.stringify(corpo) if corpo != null else "")
	if erro != OK:
		http.queue_free()
		return {"codigo": 0, "dados": {}}
	var res: Array = await http.request_completed
	http.queue_free()
	var dados = JSON.parse_string((res[3] as PackedByteArray).get_string_from_utf8())
	return {"codigo": int(res[1]) if res[0] == HTTPRequest.RESULT_SUCCESS else 0, "dados": dados if dados is Dictionary else {}}

func entrar_na_sala() -> void:
	estado.emit("Entrando no mundo…")
	var r := await pedir("POST", "/matchmake/joinOrCreate/clareira", {"sessao": sessao, "nome": conta.get("nome", "Andarilho"), "json": true})
	if r.codigo != 200 or not r.dados.has("room"):
		estado.emit("Não deu para entrar na sala")
		caiu.emit("sala")
		return
	var sala: Dictionary = r.dados.room
	meu_id = str(r.dados.sessionId)
	var url := servidor.replace("https://", "wss://").replace("http://", "ws://") + "/" + str(sala.processId) + "/" + str(sala.roomId) + "?sessionId=" + meu_id
	ws = WebSocketPeer.new()
	ws.inbound_buffer_size = 1 << 20
	ws.outbound_buffer_size = 1 << 18
	ws.max_queued_packets = 4096
	if ws.connect_to_url(url) != OK:
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

var ms := 0.0 # tempo gasto aqui por quadro (média), aparece no Teste
func _process(dt: float) -> void:
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
	if st == WebSocketPeer.STATE_CLOSED:
		var motivo := "fechou %d" % ws.get_close_code()
		ws = null
		var estava := conectado
		conectado = false
		if estava:
			estado.emit("Caiu a conexão")
		caiu.emit(motivo)
		return
	while ws.get_available_packet_count() > 0:
		_receber(ws.get_packet())
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
			ws.send(PackedByteArray([JOIN_ROOM]))
			conectado = true
			estado.emit("Online")
			entrou.emit(meu_id, conta)
		ERROR:
			var cod = MP.ler(b)
			var txt = MP.ler(b) if b.get_position() < p.size() else ""
			if str(txt) == "login":
				guardar("")
				precisa_login.emit()
			estado.emit("Servidor recusou: %s" % str(txt))
			push_warning("erro do servidor %s %s" % [cod, txt])
		LEAVE_ROOM:
			fechar()
			caiu.emit("saiu")
		ROOM_DATA:
			var tipo = MP.ler(b)
			var dados = MP.ler(b) if b.get_position() < p.size() else null
			if str(tipo) == "mundoJ" and dados is String: # o mundo em JSON (mais rápido de ler aqui)
				mensagem.emit("mundo", JSON.parse_string(dados))
				return
			if str(tipo) == "pong" and dados is int:
				ping_ms = Time.get_ticks_msec() - dados
				return
			mensagem.emit(tipo, dados)

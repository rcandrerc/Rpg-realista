extends SceneTree
# Teste da rede do Godot contra o servidor local (motor-teste.yml): os mesmos pedidos que o rede.gd faz para entrar.
# Uso: RPG_SERVIDOR=http://127.0.0.1:2567 RPG_SESSAO=... godot --headless -s ferramentas/motor/rede_teste.gd
var srv := OS.get_environment("RPG_SERVIDOR")
var sessao := OS.get_environment("RPG_SESSAO")

func _initialize() -> void:
	print("REDE motor ", Engine.get_version_info().string)
	_rodar()

func _pedir(metodo: int, caminho: String, corpo = null) -> Array:
	var http := HTTPRequest.new()
	http.timeout = 8.0
	root.add_child(http)
	var cab := PackedStringArray(["Content-Type: application/json", "Authorization: Bearer " + sessao])
	var erro := http.request(srv + caminho, cab, metodo, JSON.stringify(corpo) if corpo != null else "")
	if erro != OK:
		print("REDE ", caminho, " request() erro ", erro)
		return [-1, 0, ""]
	var res: Array = await http.request_completed
	http.queue_free()
	var txt := (res[3] as PackedByteArray).get_string_from_utf8()
	print("REDE ", caminho, " resultado=", res[0], " codigo=", res[1], " bytes=", (res[3] as PackedByteArray).size(), " corpo=", txt.left(160).c_escape())
	return [res[0], res[1], txt]

func _rodar() -> void:
	await process_frame
	await _pedir(HTTPClient.METHOD_GET, "/saude")
	await _pedir(HTTPClient.METHOD_GET, "/conta/eu")
	var r := await _pedir(HTTPClient.METHOD_POST, "/matchmake/joinOrCreate/clareira", {"sessao": sessao, "nome": "Teste", "json": true, "aoi": true})
	await _pedir(HTTPClient.METHOD_GET, "/conta/eu")
	await _pedir(HTTPClient.METHOD_GET, "/conta/eu")
	var d = JSON.parse_string(r[2])
	if d is Dictionary and d.has("room"):
		var url: String = srv.replace("http://", "ws://") + "/" + str(d.room.processId) + "/" + str(d.room.roomId) + "?sessionId=" + str(d.sessionId)
		var ws := WebSocketPeer.new()
		ws.inbound_buffer_size = 1 << 20
		print("REDE ws connect ", ws.connect_to_url(url))
		var t0 := Time.get_ticks_msec()
		var msgs := 0
		while Time.get_ticks_msec() - t0 < 8000:
			ws.poll()
			while ws.get_available_packet_count() > 0:
				ws.get_packet()
				msgs += 1
			if ws.get_ready_state() == WebSocketPeer.STATE_CLOSED:
				break
			await process_frame
		print("REDE ws estado=", ws.get_ready_state(), " mensagens=", msgs, " fechou=", ws.get_close_code())
	quit(0)

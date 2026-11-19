extends SceneTree
# Fotos dos comandos rápidos do time (André 2026-11-19): tocar no nome de alguém no painel do time abre 4 botões; o pedido
# e a resposta aparecem no chat do time; o jogador que recebe vê o comando em destaque; sem IA, eles se despedem e saem.
# O "online" é de mentira; as falas são as que o servidor de verdade gerou (FOTO_EVENTOS: JSON de comandos-eventos.mjs).
# Uso: FOTO_SAIDA=/pasta FOTO_EVENTOS=eventos.json FOTO_SEM_LOD=1 xvfb-run -a godot --path godot-prototipo \
#   --rendering-driver opengl3 --render-thread safe -s ../ferramentas/amiga/foto-comandos.gd
var m
var E: Dictionary
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
	print("foto ", nome)
func online_de_mentira() -> void:
	var o = m.online
	o.ligado = true
	o.jogadores = 4
	o.rede.ping_ms = 42
	o.rede.ult_pacote_ms = Time.get_ticks_msec()
func npcs() -> void:
	var h: Vector3 = m.heroi.position
	var fr := Vector3(sin(m.heroi.rotation.y), 0, cos(m.heroi.rotation.y))
	var lado := fr.cross(Vector3.UP)
	var pc: Vector3 = h + fr * 3.2 + lado * 1.4
	var pd: Vector3 = h + fr * 4.0 - lado * 1.8
	var pi: Vector3 = h + fr * 5.5 + lado * 0.2
	m.online.outro({"id": E.ids.cecilia, "nome": "Cecília", "visual": "victoria", "x": pc.x, "y": m.terreno.altura(pc.x, pc.z), "z": pc.z, "ry": m.heroi.rotation.y + PI, "bot": true, "vida": 120, "vidaMax": 120})
	m.online.outro({"id": E.ids.dario, "nome": "Dario", "visual": "cabelo_m", "x": pd.x, "y": m.terreno.altura(pd.x, pd.z), "z": pd.z, "ry": m.heroi.rotation.y + PI, "bot": true, "vida": 120, "vidaMax": 120})
	m.online.outro({"id": E.ids.irmao, "nome": "Irmão", "visual": "ruiva", "x": pi.x, "y": m.terreno.altura(pi.x, pi.z), "z": pi.z, "ry": m.heroi.rotation.y + PI, "vida": 120, "vidaMax": 120})
func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	if OS.get_environment("FOTO_SEM_LOD") != "":
		load("res://lod_malha.gd")._tarefa = 1 << 40
	E = JSON.parse_string(FileAccess.get_file_as_string(OS.get_environment("FOTO_EVENTOS")))
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	load("res://idioma.gd").trocar("pt")
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	online_de_mentira()
	m.online.amiga_ids = [E.ids.cecilia, E.ids.dario]
	m.online.amiga_papeis = {E.ids.cecilia: "a guerreira", E.ids.dario: "o guerreiro"}
	var eu := str(m.online.meu_id)
	m.amigos.time = [
		{"id": eu, "nome": "Ruiva", "nivel": 12, "vida": 120, "vidaMax": 120, "mana": 100, "manaMax": 100},
		{"id": E.ids.cecilia, "nome": "Cecília", "nivel": 11, "vida": 90, "vidaMax": 120, "mana": 80, "manaMax": 100},
		{"id": E.ids.dario, "nome": "Dario", "nivel": 12, "vida": 110, "vidaMax": 120, "mana": 60, "manaMax": 100},
		{"id": E.ids.irmao, "nome": "Irmão", "nivel": 8, "vida": 70, "vidaMax": 100, "mana": 50, "manaMax": 100},
	]
	m.amigos.lider = eu
	for i in 60:
		npcs()
		online_de_mentira()
		await esperar(2)
	await foto("1-time-painel")
	# 1) tocou no nome do Dario: os 4 comandos ao lado
	m.amigos._arrumar_toques()
	m.amigos._toque_barra(1)
	await esperar(12)
	await foto("2-tocou-no-dario-4-comandos")
	m.amigos._fechar_comandos()
	# 2) o pedido e a resposta no chat do time
	m.chat.do_servidor({"t": "chatHist", "lista": E.chat})
	m.chat.abrir_time()
	await esperar(30)
	await foto("3-chat-time-pedido-e-resposta")
	m.chat.fechar() if m.chat.has_method("fechar") else null
	await esperar(10)
	# 3) o irmão mandou "Recua" para a Ruiva: aparece em destaque
	m.online.evento(E.comando.duplicate(true))
	await esperar(8)
	await foto("4-irmao-mandou-recua")
	await esperar(120)
	# 4) acabou a IA do dia: a despedida no chat do time
	m.chat.do_servidor({"t": "chatHist", "lista": E.chat + E.chat2 + E.tchau})
	m.chat.abrir_time()
	await esperar(30)
	await foto("5-sem-ia-se-despedem")
	quit()

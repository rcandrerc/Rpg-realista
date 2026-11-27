extends SceneTree
# Fotos da barra do time com vários clãs (André 2026-11-27: "aparecia o líder do outro clã e mais os bots dele. Eu podia
# minimizar essa aba para aparecer só o nome da líder, ou maximizar"; o meu grupo também). No jogo de verdade, sem
# servidor: a lista é a mesma que o evento 'time' do servidor traria (shared/simulacao.js enviarTime, grupos).
# Uso: FOTO_SAIDA=/pasta FOTO_W=1280 FOTO_H=576 xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/time-lideres-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
func esperar(k: int) -> void:
	for i in k:
		await process_frame
func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
func membro(id: String, nome: String, nv: int, g: String, vida: float, bot := true, esc := false) -> Dictionary:
	var d := {"id": id, "nome": nome, "nivel": nv, "vida": int(vida * 100), "vidaMax": 100, "mana": 40, "manaMax": 60, "x": 0.0, "z": 0.0, "g": g}
	if bot:
		d["bot"] = 1
	if esc:
		d["esc"] = 1
	return d
func _initialize() -> void:
	var w := int(OS.get_environment("FOTO_W")) if OS.get_environment("FOTO_W") != "" else 1280
	var h := int(OS.get_environment("FOTO_H")) if OS.get_environment("FOTO_H") != "" else 576
	DisplayServer.window_set_size(Vector2i(w, h))
	root.size = Vector2i(w, h)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	load("res://idioma.gd")._aplicar("pt")
	await esperar(60)
	var eu := str(m.online.meu_id) if m.online else ""
	var A = m.amigos
	# antes: um clã só (como hoje, sem cabeçalho)
	A.time = [membro(eu, "Yukmei", 34, "c:a", 1.0, false), membro("r1", "Flora Brasa", 31, "c:a", 0.8), membro("r2", "Bento Fogo", 30, "c:a", 0.55), membro("r3", "Irene Cinza", 29, "c:a", 0.9)]
	A.grupos = []
	A.lider = eu
	await esperar(20)
	await foto("1-um-cla-como-hoje")
	# 3 clãs: o meu (3 recrutas), o da filha (2 recrutas) e o Dario (escolta de 2)
	A.time = [membro(eu, "Yukmei", 34, "c:a", 1.0, false), membro("r1", "Flora Brasa", 31, "c:a", 0.8), membro("r2", "Bento Fogo", 30, "c:a", 0.55), membro("r3", "Irene Cinza", 29, "c:a", 0.9),
		membro("f", "Filha", 22, "c:f", 0.7, false), membro("f1", "Tomás Rubro", 20, "c:f", 1.0), membro("f2", "Nina Faísca", 19, "c:f", 0.4),
		membro("d", "Dario", 41, "b:dario", 0.95), membro("d1", "Caio Brasa", 38, "b:dario", 1.0, true, true), membro("d2", "Rosa Lume", 37, "b:dario", 0.85, true, true)]
	A.grupos = [{"g": "c:a", "nome": "Yukmei", "cla": "Brasil", "lid": eu}, {"g": "c:f", "nome": "Filha", "cla": "Rosas", "lid": "f"}, {"g": "b:dario", "nome": "Dario", "cla": "Guarda da Chama", "lid": "d"}]
	A._fechados = {}
	await esperar(20)
	await foto("2-tres-clas-abertos")
	A._fechados = {"c:f": true, "b:dario": true}
	await esperar(20)
	await foto("3-outros-minimizados-so-lider")
	A._fechados = {"c:a": true, "c:f": true, "b:dario": true}
	await esperar(20)
	await foto("4-tudo-minimizado-so-lideres")
	# 5 clãs (André 2026-11-27, desenho): 3 na coluna da esquerda, o 4º e o 5º na da direita
	A.time += [membro("i", "Irmão", 28, "c:i", 0.9, false), membro("i1", "Davi Brasa", 25, "c:i", 1.0), membro("i2", "Lara Fogo", 24, "c:i", 0.6),
		membro("x", "Maya", 30, "c:x", 1.0, false), membro("x1", "Otto Lume", 27, "c:x", 0.75)]
	A.grupos += [{"g": "c:i", "nome": "Irmão", "cla": "Lobos de Brasa", "lid": "i"}, {"g": "c:x", "nome": "Maya", "cla": "Aurora", "lid": "x"}]
	A._fechados = {"c:f": true, "b:dario": true}
	await esperar(20)
	await foto("5-cinco-clas-duas-colunas")
	A._fechados = {"c:a": true, "c:f": true, "b:dario": true, "c:i": true, "c:x": true}
	await esperar(20)
	await foto("6-cinco-clas-minimizados")
	A._fechados = {}
	await esperar(20)
	await foto("7-cinco-clas-tudo-aberto")
	A._so_meu = true # botão "Só meu clã"
	A._arrumar_toques()
	await esperar(20)
	await foto("8-so-meu-cla")
	quit()

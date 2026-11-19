extends SceneTree
# Fotos das missões de vila no app (lote 1 das vilas, Presidente 19/11/2026): o cartão âmbar embaixo do da história com a
# coluna de luz na pista, o botão "Vila: ..." na conversa com o NPC, a janela da fala com o nome da missão, a aba Vilas,
# a festa de missão de vila cumprida e o grupo Vilas na aba Títulos. Sem servidor: o resumo (vila_info) é de exemplo, do
# jeito que shared/missoes-vila.js vilaInfo manda; "online" fica ligado de mentira só para a história e o botão aparecerem.
# Uso: FOTO_SAIDA=/pasta xvfb-run -a godot --render-thread safe --path godot-prototipo --rendering-driver opengl3 -s ../ferramentas/vilas-missoes-foto.gd
var m
var saida := OS.get_environment("FOTO_SAIDA") if OS.get_environment("FOTO_SAIDA") != "" else "/tmp"
const Idioma = preload("res://idioma.gd")

func esperar(k: int) -> void:
	for i in k:
		await process_frame

func foto(nome: String) -> void:
	await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png(saida + "/" + nome + ".png")
	print("FOTO ", nome)

func npc(id: String) -> Dictionary:
	for n in m.npcs:
		if str(n.get("id", "")) == id:
			return n
	return {}

# herói em (x, z) olhando para (tx, tz), câmera atrás dele
func por(x: float, z: float, tx: float, tz: float, dist := 4.2, pitch := 0.22) -> void:
	m.mov.por_em(Vector3(x, m.chao_em(x, z), z), true)
	m.heroi.position = m.mov.posicao()
	m.mov.ry = atan2(tx - x, tz - z)
	m.cam.colocar(m.heroi.position)
	m.cam.yaw = m.mov.ry + PI
	m.cam.pitch = pitch
	m.cam.dist = dist

func _initialize() -> void:
	root.size = Vector2i(1280, 576)
	m = load("res://main.tscn").instantiate()
	root.add_child(m)
	await esperar(90)
	if m.online and m.online.has_method("esconder_login"):
		m.online.esconder_login()
	if m.get("dia") != null:
		m.dia.ajustar(10.0)
	Idioma.trocar("pt") # o Xvfb sem LANG abre em inglês; as fotos em inglês vêm no fim
	# conta no Nv 34, no meio da história (a missão da vez aparece no cartão lilás)
	var ms: Array = m.nevoa.H.get("missoes", [])
	var p := 0
	while p < ms.size() - 1 and int(ms[p].get("nv", 0)) < 34:
		p += 1
	m.P.prog.nivel = 34
	m.P.prog.hist = {"p": p, "ac": true, "e": 0, "n": 0}
	m.online.ligado = true # de mentira: a história e o botão de vila só aparecem online (rede.enviar não manda nada sem conexão)
	# rc1 aceita, na 2ª etapa (as pistas da beira do rio): a 1ª pista já vista, a próxima é a flecha
	var s_ex := "aoopoozzznnn"
	m.P.vila_info = {"s": s_ex, "dar": {}, "a": {"id": "rc1", "nome": "O Pacto da Ponte", "vila": "rio_claro",
		"txt": "Veja os sinais da Geada na beira do rio (1/3)", "e": 1, "total": 3, "dono": "v_heitor", "npc": "",
		"alvo": {"x": -286.0, "z": 26.0, "nome": "uma flecha de ponta azul", "npc": ""}, "marca": true}}
	m.P.mudou = true
	por(-280.0, 36.0, -286.0, 26.0, 5.5, 0.12)
	await esperar(240)
	var mv = m.missao_vila
	print("MARCA ", mv._marca != null and mv._marca.visible, " ", mv._marca.global_position if mv._marca != null else Vector3.ZERO)
	await foto("1-cartoes-e-pista")
	# conversa com o Capitão Heitor sem missão de vila aceita: ele tem a dele para dar ("Vila: O Pacto da Ponte")
	m.P.vila_info = {"s": "poopoozzznnn", "a": null, "dar": {"v_heitor": "O Pacto da Ponte"}}
	var h := npc("v_heitor")
	print("HEITOR ", h.get("x", "?"), " ", h.get("z", "?"))
	if not h.is_empty():
		var hx := float(h.no.position.x)
		var hz := float(h.no.position.z)
		por(hx + 2.4, hz + 0.6, hx, hz)
		await esperar(60)
		m.conversa.abrir(h, false)
		await esperar(90)
		await foto("2-botao-vila-no-npc")
		m.conversa.fechar()
		await esperar(10)
		# a resposta do servidor ao tocar em "Vila: ...": a fala do pedido na janela da missão, com o nome em âmbar
		m.online.evento({"t": "fala", "npc": "v_heitor", "texto": "Você ficou forte o bastante para a Geada te notar. A Trégua acabou para você. Antes da primeira briga, conheça as regras: estão na placa da Ponte do Rio Claro, a oeste daqui.", "missao": "vila:rc1"})
		await esperar(40)
		await foto("3-fala-da-missao-de-vila")
		m.missao_fala.fechar()
	# aba Vilas: rc1 fazendo (etapa 2), rc2 e rc3 depois da anterior, Pouso da Serra pode pegar, Juncal fechado, Porto no nível
	m.P.vila_info = {"s": s_ex, "dar": {}, "a": {"id": "rc1", "nome": "O Pacto da Ponte", "vila": "rio_claro",
		"txt": "Veja os sinais da Geada na beira do rio (1/3)", "e": 1, "total": 3, "dono": "v_heitor", "npc": "",
		"alvo": {"x": -286.0, "z": 26.0, "nome": "uma flecha de ponta azul", "npc": ""}, "marca": true}}
	m.menu.abrir("vilas")
	await esperar(30)
	await foto("4-aba-vilas")
	m.menu.rolagem.scroll_vertical = 420
	await esperar(10)
	await foto("5-aba-vilas-embaixo")
	# títulos: o grupo Vilas (aparece com as missões de vila ligadas)
	m.menu.abrir("titulos")
	await esperar(20)
	for c in m.menu.conteudo.get_children():
		if c is Label and c.text.begins_with(Idioma.frase("Vilas").to_upper()):
			m.menu.rolagem.scroll_vertical = int(c.position.y) - 10
	await esperar(10)
	await foto("6-titulos-grupo-vilas")
	m.menu.fechar()
	# festa de missão de vila cumprida (o aviso do servidor vira a faixa)
	m.hud.aviso("Missão de vila cumprida: O Pacto da Ponte (+300 de ouro)")
	await create_timer(0.9).timeout
	await foto("7-festa-vila-cumprida")
	await create_timer(4.0).timeout
	# inglês: a aba Vilas e o cartão
	Idioma.trocar("en")
	await esperar(10)
	m.menu.abrir("vilas")
	await esperar(10)
	m.menu.rolagem.scroll_vertical = 0
	await esperar(20)
	await foto("8-aba-vilas-ingles")
	m.menu.fechar()
	m.missao_vila._visto = null
	por(-280.0, 36.0, -286.0, 26.0, 5.5, 0.12)
	await esperar(60)
	await foto("9-cartoes-ingles")
	Idioma.trocar("pt")
	m.online.ligado = false
	quit()

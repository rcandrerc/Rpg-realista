extends Node
# Modo online: o herói anda no celular e o servidor confere (igual ao site depois do PR #42).
# Vão para o servidor: posição 20x por segundo, botões (golpe, habilidades, pulo, dash, rolar, troca).
# Vêm do servidor: vida e mana, inimigos (posição, animação, vida), outros jogadores e o dano de verdade.
# Golpes e magias aparecem na hora no celular (animação e efeitos); quem acerta e quanto tira é o servidor que diz.

const Rede = preload("res://rede.gd")
const D = preload("res://dados.gd")

var m # main.gd
var rede
var ligado := false # dentro da sala
var meu_id := ""
var outros := {} # id -> {no, anim, alvo, ry, seq, barra, modo, uma_vez}
var corpos := {} # id do servidor -> Node3D (para números de dano e efeitos)
var de_servidor := {} # nome da animação no servidor -> nome no Godot
var para_servidor := {} # o contrário
var _pos_t := 0.0
var _ent_t := 0.0
var _ultima_entrada := {}
var _tentar_de_novo := -1.0
var _build_ok := false
var _pronto := false
var _status_t := 0.0
var jogadores := 0
# tela de login
var tela: CanvasLayer
var painel: Control
var aviso_login: Label
var status: Button

func _init(principal) -> void:
	m = principal

func _ready() -> void:
	para_servidor = m.mundo.anims
	for k in para_servidor:
		de_servidor[para_servidor[k]] = k
	de_servidor.merge({"Walk": "andar", "Run": "corrida", "Idle": "parada", "dash": "corrida", "puloCorrendo": "pulo"}, true)
	rede = Rede.new()
	add_child(rede)
	rede.estado.connect(func(t):
		aviso_login.text = t
		atualizar_status(t))
	rede.precisa_login.connect(mostrar_login)
	rede.entrou.connect(ao_entrar)
	rede.mensagem.connect(ao_receber)
	rede.caiu.connect(ao_cair)
	montar_tela()
	rede.iniciar()

# ---------- tela de login ----------
func montar_tela() -> void:
	tela = CanvasLayer.new()
	tela.layer = 5
	add_child(tela)
	status = Button.new()
	status.flat = true
	status.add_theme_font_size_override("font_size", 14)
	status.add_theme_color_override("font_color", Color(1, 0.95, 0.85))
	status.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	status.add_theme_constant_override("outline_size", 4)
	status.anchor_left = 0.5
	status.anchor_right = 0.5
	status.offset_left = -170
	status.offset_right = 170
	status.offset_top = 6
	status.offset_bottom = 34
	status.text = "Sozinho · tocar para jogar online"
	status.pressed.connect(func(): if not ligado: mostrar_login())
	tela.add_child(status)

	painel = PanelContainer.new()
	var caixa := StyleBoxFlat.new()
	caixa.bg_color = Color(0.07, 0.06, 0.09, 0.88)
	caixa.border_color = Color(0.95, 0.75, 0.42, 0.75)
	caixa.set_border_width_all(2)
	caixa.set_corner_radius_all(18)
	caixa.content_margin_left = 34
	caixa.content_margin_right = 34
	caixa.content_margin_top = 24
	caixa.content_margin_bottom = 24
	caixa.shadow_color = Color(0, 0, 0, 0.5)
	caixa.shadow_size = 16
	painel.add_theme_stylebox_override("panel", caixa)
	painel.anchor_left = 0.5
	painel.anchor_right = 0.5
	painel.anchor_top = 0.5
	painel.anchor_bottom = 0.5
	painel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	painel.grow_vertical = Control.GROW_DIRECTION_BOTH
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 14)
	col.alignment = BoxContainer.ALIGNMENT_CENTER
	painel.add_child(col)
	var titulo := Label.new()
	titulo.text = "Jogar online"
	titulo.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	titulo.add_theme_font_size_override("font_size", 30)
	titulo.add_theme_color_override("font_color", Color(1, 0.86, 0.6))
	col.add_child(titulo)
	var sub := Label.new()
	sub.text = "Entre com a mesma conta Google do site.\nO login abre no navegador e depois volta para cá."
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.add_theme_font_size_override("font_size", 16)
	sub.add_theme_color_override("font_color", Color(0.9, 0.87, 0.82))
	col.add_child(sub)
	col.add_child(_botao("Entrar com Google", Color(0.93, 0.62, 0.25), func(): rede.entrar_com_google()))
	col.add_child(_botao("Jogar sozinho", Color(0.3, 0.3, 0.36), func(): esconder_login()))
	aviso_login = Label.new()
	aviso_login.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	aviso_login.add_theme_font_size_override("font_size", 15)
	aviso_login.add_theme_color_override("font_color", Color(1, 0.8, 0.55))
	col.add_child(aviso_login)
	painel.visible = false
	tela.add_child(painel)

func _botao(texto: String, cor: Color, fn: Callable) -> Button:
	var b := Button.new()
	b.text = texto
	b.custom_minimum_size = Vector2(300, 54)
	b.add_theme_font_size_override("font_size", 20)
	for estado in ["normal", "hover", "pressed", "focus"]:
		var s := StyleBoxFlat.new()
		s.bg_color = cor.darkened(0.15) if estado == "pressed" else cor
		s.set_corner_radius_all(27)
		b.add_theme_stylebox_override(estado, s)
	b.pressed.connect(fn)
	return b

func mostrar_login() -> void:
	painel.visible = true
	m.hud.set_process_input(false) # os toques não mexem no joystick por trás
	atualizar_status("")

func esconder_login() -> void:
	painel.visible = false
	m.hud.set_process_input(true)

func atualizar_status(_t := "") -> void:
	if ligado:
		var p := "" if rede.ping_ms < 0 else " · %d ms" % rede.ping_ms
		var txt := "Online · %d %s%s" % [jogadores, "jogador" if jogadores == 1 else "jogadores", p]
		if status.text != txt: # trocar o texto refaz o layout: só quando muda
			status.text = txt
	elif _t != "" and _t != "Online":
		status.text = _t
	else:
		status.text = "Sozinho · tocar para jogar online"

# ---------- sala ----------
func ao_entrar(id: String, conta: Dictionary) -> void:
	ligado = true
	meu_id = id
	_build_ok = false
	esconder_login()
	m.hud.nome = str(conta.get("nome", m.hud.nome))
	m.hud.aviso("Online!")
	rede.enviar("modo", m.h.modo)
	for e in m.inimigos:
		e.estado = "vivo"
		e.seq = -1
		e.uma_vez = 0.0
		e.alvo = e.no.position

func ao_cair(motivo: String) -> void:
	var estava := ligado
	ligado = false
	for id in outros:
		outros[id].no.queue_free()
	outros.clear()
	for e in m.inimigos: # inimigos voltam para a cabeça do celular
		if e.estado != "morto":
			e.estado = "vagar"
	if estava:
		m.hud.aviso("Caiu a conexão. Tentando de novo…")
		_tentar_de_novo = 4.0
	elif motivo == "fora" or motivo == "sala" or motivo.begins_with("fechou"):
		_tentar_de_novo = 15.0 if rede.sessao != "" else -1.0
	atualizar_status("Sem conexão" if rede.sessao != "" else "")

func enviar(tipo: String, dados = null) -> void:
	if ligado:
		rede.enviar(tipo, dados)

func ao_receber(tipo, dados) -> void:
	if str(tipo) != "mundo" or not (dados is Dictionary):
		return
	if dados.has("foto"):
		aplicar_foto(dados.foto)
	for ev in dados.get("eventos", []):
		evento(ev)

func aplicar_foto(f: Dictionary) -> void:
	corpos.clear()
	corpos[meu_id] = m.heroi
	var vistos := {}
	jogadores = 0
	for j in f.get("jogadores", []):
		if j.get("criando", false):
			if str(j.id) == meu_id and not _pronto: # conta nova: o app ainda não tem o criador, então entra de Ruiva
				_pronto = true
				var nome := str(rede.conta.get("nome", "Andarilho")).strip_edges().left(16)
				if nome.length() < 3:
					nome = "Andarilho"
				rede.enviar("pronto", {"nome": nome, "visual": "ruiva", "aparencia": null})
			continue
		jogadores += 1
		if str(j.id) == meu_id:
			meu(j)
		else:
			vistos[str(j.id)] = true
			outro(j)
	for id in outros.keys():
		if not vistos.has(id):
			outros[id].no.queue_free()
			outros.erase(id)
	for e in f.get("inimigos", []):
		inimigo(e)

func meu(j: Dictionary) -> void:
	var h: Dictionary = m.h
	h.mana = float(j.mana)
	if j.morto:
		if h.morto <= 0.0:
			h.vida = 0.0
			h.morto = 999.0 # espera o servidor levantar
			m.acao = {}
			m.heroi_anim.play("morrer", 0.1)
			m.hud.aviso("Você caiu!")
	elif h.morto > 0.0:
		h.morto = 0.0
		m.mov.por_em(Vector3(float(j.x), float(j.y), float(j.z)))
		m.heroi.position = m.mov.posicao()
		m.heroi_anim.play("parada", 0.2)
	h.vida = float(j.vida)
	# a build vem da conta; se tiver habilidade que o app ainda não tem, manda a padrão do app
	if not _build_ok:
		_build_ok = true
		var b: Array = j.get("build", [])
		var conhecidas := b.size() == 8
		for k in b:
			if not D.HABILIDADES.has(k):
				conhecidas = false
		if conhecidas:
			m.build = b.duplicate()
		else:
			rede.enviar("build", m.build)
		m.mostrar_build()
	# recargas: vale a maior (o servidor pode ter começado um pouco depois)
	var cds: Dictionary = j.get("cds", {})
	for k in cds:
		var v := float(cds[k])
		if k in ["basico", "magia"]:
			continue
		if v > m.recargas.get(k, 0.0) + 0.25:
			m.recargas[k] = v

func animacao(nome: String) -> String:
	return de_servidor.get(nome, nome)

func tocar(no_anim: AnimationPlayer, nome: String, vel := 1.0, fade := 0.15) -> void:
	var a := animacao(nome)
	if no_anim.has_animation(a) and no_anim.current_animation != a:
		no_anim.play(a, fade, vel)

func outro(j: Dictionary) -> void:
	var id := str(j.id)
	var o = outros.get(id)
	if o == null:
		var no: Node3D = m.modelo("ruiva") # por enquanto todo jogador usa o corpo da Ruiva (é o que tem todas as animações)
		var esq: Skeleton3D = m.esqueleto(no)
		var esp: Node3D = m.nova_arma("espada")
		var caj: Node3D = m.nova_arma("cajado")
		o = {"no": no, "anim": no.find_child("AnimationPlayer", true, false), "esq": esq, "espada": esp, "cajado": caj,
			"alvo": Vector3(float(j.x), float(j.y), float(j.z)), "ry": float(j.ry), "seq": -1, "modo": "", "uma_vez": 0.0}
		no.position = o.alvo
		o.barra = m.barra_vida(no, str(j.get("nome", "")), Color(0.35, 0.85, 0.4))
		outros[id] = o
	o.alvo = Vector3(float(j.x), float(j.y), float(j.z))
	o.ry = float(j.ry)
	corpos[id] = o.no
	if o.barra:
		o.barra.scale.x = max(0.001, float(j.vida) / max(1.0, float(j.vidaMax)))
	var modo := str(j.get("modo", "Espada"))
	if modo != o.modo:
		o.modo = modo
		var L: Dictionary = m.armas_lugar.ruiva
		if modo == "Espada":
			m.prender(o.esq, o.espada, L.espadaMao)
			m.prender(o.esq, o.cajado, L.cajadoCostas)
		else:
			m.prender(o.esq, o.espada, L.espadaCostas)
			m.prender(o.esq, o.cajado, L.cajadoMao)
	animar(o, j)

# animação de quem vem do servidor: ação de uma vez (golpe, magia, apanhar) ou o laço do movimento
func animar(o: Dictionary, c: Dictionary) -> void:
	var an: AnimationPlayer = o.anim
	var acao = c.get("acao")
	if acao is Dictionary and int(c.get("acaoSeq", 0)) != o.seq:
		o.seq = int(c.get("acaoSeq", 0))
		var a := animacao(str(acao.get("nome", "")))
		if an.has_animation(a):
			var vel := float(acao.get("ts", 1.0))
			an.play(a, 0.08, vel)
			an.seek(0.0, true)
			o.uma_vez = an.get_animation(a).length / max(0.1, vel)
			return
	if acao is Dictionary and o.uma_vez > 0.0:
		return
	if c.get("morto", false):
		return
	o.uma_vez = 0.0
	tocar(an, str(c.get("anim", "Idle")))

func inimigo(c: Dictionary) -> void:
	var v := int(c.get("v", -1))
	if v < 0 or v >= m.inimigos.size():
		return
	var e: Dictionary = m.inimigos[v]
	corpos[str(c.id)] = e.no
	e.alvo = Vector3(float(c.x), float(c.y), float(c.z))
	e.ry = float(c.ry)
	e.vida = float(c.vida)
	if e.barra:
		e.barra.scale.x = max(0.001, float(c.vida) / max(1.0, float(c.vidaMax)))
	if not e.has("seq"):
		e.seq = -1
		e.uma_vez = 0.0
	if c.morto and e.estado != "morto":
		e.estado = "morto"
		e.anim.play("morrer", 0.1)
		_barra_visivel(e, false)
	elif not c.morto and e.estado == "morto":
		e.estado = "vivo"
		e.no.position = e.alvo
		_barra_visivel(e, true)
		e.anim.play("espada_parada", 0.2)
	if not c.morto:
		animar(e, c)

func _barra_visivel(e: Dictionary, v: bool) -> void:
	if e.barra:
		e.barra.visible = v
		e.barra.get_parent().get_child(e.barra.get_index() - 1).visible = v

func cor(n) -> Color:
	return Color.hex((int(n) << 8) | 0xff) if n != null else Color(1, 1, 1)

func evento(ev: Dictionary) -> void:
	var t := str(ev.get("t", ""))
	var meu := str(ev.get("de", "")) == meu_id
	var fx = m.fx
	match t:
		"dano":
			var no = corpos.get(str(ev.alvo))
			if no:
				var eu: bool = str(ev.alvo) == meu_id
				fx.numero(no.position, ev.n, Color(1, 0.45, 0.4) if eu else Color(1, 0.95, 0.6))
				if eu and m.acao.is_empty() and m.mov.esc == null:
					m.heroi_anim.play("apanhar", 0.05, 1.4)
			return
		"cura":
			if str(ev.alvo) != meu_id and corpos.has(str(ev.alvo)):
				fx.cura(corpos[str(ev.alvo)])
				fx.numero(corpos[str(ev.alvo)].position, ev.n, Color("7dffa0"))
			return
		"aviso":
			m.hud.aviso(str(ev.texto))
			return
		"fala":
			m.hud.aviso(str(ev.texto))
			return
		"corrigir": # o servidor não aceitou a posição: volta para onde ele sabe
			m.mov.por_em(Vector3(float(ev.x), float(ev.y), float(ev.z)))
			m.mov.ry = float(ev.ry)
			m.heroi.position = m.mov.posicao()
			return
	if meu: # o que eu fiz já apareceu na hora, aqui no celular
		return
	match t:
		"proj":
			var info := {"vel": float(ev.vel), "cor": cor(ev.get("cor")), "tam": float(ev.get("tam", 0.24)), "estilo": str(ev.get("estilo", "arcano"))}
			if ev.get("explosao"):
				info.explosao = float(ev.explosao)
			fx.projetil(Vector3(float(ev.x), float(ev.y), float(ev.z)), Vector3(float(ev.dx), float(ev.dy), float(ev.dz)).normalized(), info, 0, 22.0)
		"raio":
			fx.raio(float(ev.x), float(ev.z), m.terreno.altura(float(ev.x), float(ev.z)))
		"explosao":
			var x := float(ev.x)
			var z := float(ev.z)
			fx.explosao_hab(str(ev.get("fx", "explosao")), x, z, float(ev.r), m.terreno.altura(x, z))
		"chuva":
			fx.chuva(float(ev.x), float(ev.z), float(ev.r), int(ev.ondas), func(_p): pass)
		"impacto":
			var x := float(ev.x)
			var z := float(ev.z)
			fx.impacto(x, z, float(ev.ry), str(ev.get("fx", "investida")), m.terreno.altura(x, z))
		"anel":
			var x := float(ev.x)
			var z := float(ev.z)
			fx.anel(x, z, float(ev.r), cor(ev.get("cor")), float(ev.get("dur", 0.8)), m.terreno.altura(x, z))
		"conjura":
			var no = corpos.get(str(ev.id))
			if no and no != m.heroi:
				fx.conjura(no, str(ev.hab), float(ev.dur), func(): return [no.position + Vector3(0, 1.2, 0)])
		"dash":
			var no = corpos.get(str(ev.id))
			if no and no != m.heroi:
				fx.dash(no, float(ev.get("dur", 0.28)), ev.get("forte", 0) == 1)

# ---------- quadro a quadro ----------
var ms := 0.0 # tempo gasto aqui por quadro (média), aparece no Teste
func _process(dt: float) -> void:
	var t0 := Time.get_ticks_usec()
	_passo(dt)
	ms = lerp(ms, (Time.get_ticks_usec() - t0) / 1000.0, 0.05)

func _passo(dt: float) -> void:
	if _tentar_de_novo > 0.0:
		_tentar_de_novo -= dt
		if _tentar_de_novo <= 0.0 and not ligado and rede.sessao != "":
			rede.iniciar()
	if not ligado:
		return
	# outros jogadores e inimigos deslizam até a posição do servidor (chega 20 vezes por segundo)
	var k: float = min(1.0, dt * 12.0)
	for id in outros:
		var o: Dictionary = outros[id]
		o.no.position = o.no.position.lerp(o.alvo, k)
		o.no.rotation.y = lerp_angle(o.no.rotation.y, o.ry, k)
		o.uma_vez = max(0.0, o.uma_vez - dt)
	for e in m.inimigos:
		if e.has("alvo") and e.estado != "morto":
			e.no.position = e.no.position.lerp(e.alvo, k)
			e.no.rotation.y = lerp_angle(e.no.rotation.y, e.get("ry", e.no.rotation.y), k)
			e.uma_vez = max(0.0, e.get("uma_vez", 0.0) - dt)
	# minha posição (o servidor confere velocidade e altura)
	_pos_t -= dt
	if _pos_t <= 0.0 and m.h.morto <= 0.0:
		_pos_t = 0.05
		var p: Vector3 = m.heroi.position
		var a: String = para_servidor.get(m.heroi_anim.current_animation, "Idle")
		rede.enviar("pos", {"x": snappedf(p.x, 0.001), "y": snappedf(p.y, 0.001), "z": snappedf(p.z, 0.001), "ry": snappedf(m.mov.ry, 0.001), "anim": a})
	# para onde o joystick aponta (o servidor usa no rolamento e no dash)
	_ent_t -= dt
	if _ent_t <= 0.0:
		_ent_t = 0.1
		var d: Vector3 = m.direcao_joystick()
		var ent := {"mx": snappedf(d.x, 0.01), "mz": snappedf(d.z, 0.01), "correr": m.hud.mover.length() >= 0.55}
		if ent != _ultima_entrada:
			_ultima_entrada = ent
			rede.enviar("entrada", ent)
	_status_t -= dt
	if _status_t <= 0.0:
		_status_t = 0.5
		atualizar_status()

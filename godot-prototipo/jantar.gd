extends Node
# Jantar do clã (André 2026-11-25: "eu podia chamar eles para comer... selecionava os que eu queria... clicando na mesa,
# aparece um slot de comida igual o que aparece nos packs. Aí eu coloco a comida, aparece na mesa... eles sentam,
# comem... conversam entre si"; "depois de servir eu poder sentar também"). As regras são do servidor (shared/jantar.js).
# - Perto da Mesa do Clã aparece o botão do jantar (mesa com prato); a aba Clã do menu também abre a janela.
# - A janela: quem vem (toque para escolher, até 7), Chamar, os 8 lugares de comida da mesa (toque na comida da mochila
#   para pôr; toque no prato da mesa para tirar), pratos tenho/preciso, Servir, Sentar e Mudar de lugar.
# - A comida aparece na mesa (travessas no meio) e, servido, um prato com caneca na frente de quem sentou.
# - Sentado (o servidor manda jantarSentar): o herói fica no lugar da cabeceira na pose kk_sentado; o joystick levanta.
# - As conversas chegam como balões (evento "balao", baloes.gd), como o chat Local.
const Idioma = preload("res://idioma.gd") # inglês (idioma.gd)
const Menu = preload("res://menu.gd")
const Sentar = preload("res://sentar.gd") # a mesma pose do carrinho e do barquinho: quadril no banco, pés no chão
const QUADRIL := 0.1 # o osso do quadril fica um palmo acima do assento
const PERTO := 4.0 # m da mesa (JANTAR.perto)
const ASSENTO := 0.46 # altura do assento (construcao.gd MESA_ASSENTO)
const TAMPO := 0.78 # altura do tampo (construcao.gd MESA_TAMPO)
# lugares da mesa (JANTAR.lugares em shared/dados.js): o 0 é a cabeceira do líder
const LUGARES := [Vector2(2.35, 0), Vector2(-2.35, 0), Vector2(-1.2, 1.0), Vector2(0, 1.0), Vector2(1.2, 1.0), Vector2(-1.2, -1.0), Vector2(0, -1.0), Vector2(1.2, -1.0)]

var m
var tela: CanvasLayer
var painel: PanelContainer
var col: VBoxContainer
var info := {} # o último jantarInfo do servidor
var escolhidos := {} # id do recruta -> true (marcado para chamar)
var mesas := {} # chave da base -> {no: Node3D, comida: Array, fase, lugares}
var sentado := {} # {x, z, ry}: o herói sentado na cabeceira
var _t := 0.0
var _mats := {}
var _relogio := 0.0 # s de jogo (a garfada anda no tempo do jogo)
var poses := {} # id ("eu" = o herói) -> {pose: sentar.gd, esq}: quem está sentado na mesa agora

func _init(principal) -> void:
	m = principal

func _ready() -> void:
	m.hud._botao("jantar", Vector2(685, 250), 30, "jantar", m.hud.COR_TROCA) # perto da Mesa do Clã: a janela do jantar
	m.hud.botoes[-1].oculto = true
	tela = CanvasLayer.new()
	tela.layer = 22 # acima do menu (20): a aba Clã também abre
	add_child(tela)
	painel = PanelContainer.new()
	painel.add_theme_stylebox_override("panel", Menu.caixa(Color(Menu.FUNDO, 0.96), Menu.OURO.darkened(0.25), 2, 10, 10))
	painel.set_anchors_preset(Control.PRESET_CENTER)
	painel.grow_horizontal = Control.GROW_DIRECTION_BOTH
	painel.grow_vertical = Control.GROW_DIRECTION_BOTH
	painel.custom_minimum_size = Vector2(640, 0)
	painel.visible = false
	tela.add_child(painel)
	col = VBoxContainer.new()
	col.add_theme_constant_override("separation", 8)
	painel.add_child(col)

# ---------- botão e janela ----------
func _process(dt: float) -> void:
	_relogio += dt
	_poses_mesa()
	_t -= dt
	if _t > 0.0:
		return
	_t = 0.2
	var M := mesa()
	var vivo: bool = m.h.morto <= 0.0
	var perto := not M.is_empty() and m.heroi != null and Vector2(float(M.x) - m.heroi.position.x, float(M.z) - m.heroi.position.z).length() <= PERTO + 0.3
	m.hud.mostrar_botao("jantar", perto and vivo and m.on() and sentado.is_empty())

# a Mesa do Clã da minha base (base_cla.gd)
func mesa() -> Dictionary:
	return m.base_cla.minha_mesa() if m.base_cla != null else {}

func abrir() -> void:
	if not m.on():
		return
	if m.menu and m.menu.aberto():
		m.menu.fechar()
	painel.visible = true
	_montar()
	m.rede("cla", {"acao": "jantar", "sub": "info"})

func fechar() -> void:
	painel.visible = false

func aberto() -> bool:
	return painel.visible

func _rede(sub: String, extra := {}) -> void:
	var d := {"acao": "jantar", "sub": sub}
	d.merge(extra)
	m.rede("cla", d)

func _botao(t: String, fn: Callable, ativo := false, tam := 16, largura := 0.0) -> Button:
	var b := Button.new()
	b.set_meta("pt", t)
	b.text = Idioma.frase(t)
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", tam)
	b.custom_minimum_size = Vector2(largura, 44)
	Menu.estilo_botao(b, ativo)
	b.pressed.connect(fn)
	return b

func _montar() -> void:
	for n in col.get_children():
		n.queue_free()
	var topo := HBoxContainer.new()
	col.add_child(topo)
	var tt := Menu.rotulo("Jantar do clã", 21, Menu.OURO)
	tt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	topo.add_child(tt)
	topo.add_child(_botao("Fechar", fechar, false, 17, 110))
	if info.is_empty():
		col.add_child(Menu.rotulo("Carregando...", 14, Menu.APAGADO))
		return
	var fase := str(info.get("fase", ""))
	var ms: Array = info.get("m", [])
	var vem := 0
	var sent := 0
	for r in ms:
		vem += int(r.get("vem", 0))
		sent += int(r.get("sent", 0))
	# a linha do que acontece agora
	var msg := ""
	if int(info.get("base", 0)) == 0:
		msg = "Funde a base do clã: a Mesa do Clã fica nela."
	elif int(info.get("tem", 0)) == 0:
		msg = "A Mesa do Clã está na mochila: ponha na base (martelo, Móveis)."
	elif fase == "comendo":
		msg = "Servido! Fique perto da mesa até o fim (%s) para a moral subir +%d." % [Menu.tempo_txt(float(info.get("falta", 0))), int(info.get("moral", 35))]
	elif int(info.get("feito", 0)) == 1:
		msg = "O jantar de hoje já foi. Amanhã tem mais."
	elif fase == "chamando":
		msg = "%d a caminho, %d sentado%s. Ponha um prato por recruta sentado e sirva." % [vem - sent, sent, "" if sent == 1 else "s"]
	else:
		msg = "Escolha quem vem (até %d) e toque em Chamar. Com você perto, a moral de cada um sobe +%d. Uma vez por dia." % [int(info.get("max", 7)), int(info.get("moral", 35))]
	col.add_child(Menu.rotulo(msg, 14, Menu.OURO_CLARO if fase != "" else Menu.TEXTO))
	if int(info.get("tem", 0)) == 0:
		return
	# quem vem: um botão por recruta (toque marca; quem já vem aparece aceso, com a cadeira quando sentou)
	var fq := HFlowContainer.new()
	fq.add_theme_constant_override("h_separation", 6)
	fq.add_theme_constant_override("v_separation", 6)
	for r in ms:
		var id := str(r.id)
		var on := int(r.get("on", 0)) == 1
		var ja := int(r.get("vem", 0)) == 1
		var marca := ja or escolhidos.has(id)
		var t := str(r.nome).split(" ")[0]
		if ja:
			t += " · " + ("sentado" if int(r.get("sent", 0)) == 1 else "vindo")
		elif not on:
			t += " · fora"
		var b := _botao(t, func(): _marcar(id), marca, 15)
		b.disabled = not on or ja or fase == "comendo" or int(info.get("feito", 0)) == 1
		fq.add_child(b)
	if ms.is_empty():
		col.add_child(Menu.rotulo("Sem recrutas: contrate no Recrutador.", 13, Menu.APAGADO))
	col.add_child(fq)
	var lb := HBoxContainer.new()
	lb.add_theme_constant_override("separation", 8)
	col.add_child(lb)
	if fase != "comendo" and int(info.get("feito", 0)) == 0:
		var bc := _botao("Chamar", _chamar, not escolhidos.is_empty(), 17, 130)
		bc.disabled = escolhidos.is_empty()
		lb.add_child(bc)
	if fase == "chamando":
		lb.add_child(_botao("Cancelar", func(): _rede("cancelar"), false, 15, 120))
	# a comida da mesa: os 8 lugares (como os do pack) e os pratos tenho/preciso
	var perto := int(info.get("perto", 0)) == 1
	if fase != "":
		col.add_child(Menu.rotulo("Comida na mesa" + ("" if perto or fase == "comendo" else " (chegue perto da mesa para pôr)"), 15, Menu.TEXTO))
		var fs := HBoxContainer.new()
		fs.add_theme_constant_override("separation", 6)
		col.add_child(fs)
		var com: Array = info.get("comida", [])
		var pratos := 0
		for o in com:
			pratos += int(o.n)
		fs.add_child(m.menu.icone_material("carne_assada", pratos, maxi(sent, 1), {}, "Pratos na mesa: um por recruta sentado"))
		for i in int(info.get("slots", 8)):
			var it = {"k": str(com[i].k), "n": int(com[i].n)} if i < com.size() else null
			var si := i
			var fn := func(): if it != null and fase == "chamando": _rede("tirarComida", {"s": si})
			fs.add_child(m.menu.celula(it, false, fn, 52))
		if fase == "chamando":
			col.add_child(Menu.rotulo("Mochila: toque numa comida para pôr na mesa", 13, Menu.APAGADO))
			var fm := HFlowContainer.new()
			fm.add_theme_constant_override("h_separation", 4)
			fm.add_theme_constant_override("v_separation", 4)
			var moch: Array = m.P.prog.get("mochila", [])
			var nada := true
			for i in moch.size():
				var it2 = moch[i]
				if it2 == null or not _comida(str(it2.k)):
					continue
				nada = false
				var mi := i
				var falta := maxi(1, vem - pratos)
				fm.add_child(m.menu.celula(it2, false, func(): if perto: _rede("comida", {"i": mi, "n": falta}), 52))
			if nada:
				fm.add_child(Menu.rotulo("Sem comida na mochila: cozinhe no fogão ou pesque.", 13, Menu.APAGADO))
			col.add_child(fm)
	var la := HBoxContainer.new()
	la.add_theme_constant_override("separation", 8)
	col.add_child(la)
	if fase == "chamando":
		var bs := _botao("Servir", func(): _rede("servir"), sent > 0, 17, 130)
		bs.disabled = sent == 0 or not perto
		la.add_child(bs)
	if fase != "" and perto:
		la.add_child(_botao("Levantar" if not sentado.is_empty() else "Sentar na cabeceira", _sentar, false, 16))
	var B: Dictionary = m.base_cla.minha() if m.base_cla != null else {}
	if fase == "" and perto and B.get("mesa") is Dictionary and not B.mesa.has("peca"):
		la.add_child(_botao("Mudar de lugar", func(): _rede("recolher"); fechar(), false, 15))

func _marcar(id: String) -> void:
	if escolhidos.has(id):
		escolhidos.erase(id)
	elif escolhidos.size() < int(info.get("max", 7)):
		escolhidos[id] = true
	_montar()

func _chamar() -> void:
	_rede("chamar", {"ids": escolhidos.keys()})
	escolhidos.clear()

func _sentar() -> void:
	if sentado.is_empty():
		_rede("sentar")
	else:
		levantar()

# o que pode ir para a mesa (shared/jantar.js comidaJantar): comida, menos o Peixe-Dourado
func _comida(k: String) -> bool:
	if k == "dourado" or not m.P.dados.itens.has(k):
		return false
	var it: Dictionary = m.P.dados.itens[k]
	return it.get("comida", false) == true or it.get("colheita", false) == true or k == "carne"

# ---------- servidor ----------
func do_servidor(ev: Dictionary) -> void:
	match str(ev.t):
		"jantarInfo":
			info = ev
			for id in escolhidos.keys():
				var ok := false
				for r in info.get("m", []):
					if str(r.id) == id and int(r.get("on", 0)) == 1 and int(r.get("vem", 0)) == 0:
						ok = true
				if not ok:
					escolhidos.erase(id)
			if painel.visible:
				_montar()
		"jantar":
			_mesa_comida(ev)
		"jantarSentar":
			if int(ev.get("sai", 0)) == 1:
				if not sentado.is_empty():
					sentado = {}
					m.armar(m.h.modo)
			else:
				sentado = {"x": float(ev.x), "z": float(ev.z), "ry": float(ev.ry)}
				m.armar("Escalada") # sentado: as duas armas nas costas
				fechar()
			if painel.visible:
				_montar()

# ---------- o herói sentado (main.gd chama a cada quadro) ----------
func sentado_ok() -> bool:
	return not sentado.is_empty()

func prender_heroi(forca: float) -> void:
	if forca > 0.35 or m.h.morto > 0.0: # mexeu o joystick: levanta
		levantar()
		return
	m.mov.por_em(Vector3(float(sentado.x), 0.0, float(sentado.z)))
	m.mov.ry = float(sentado.ry)

func levantar() -> void:
	if sentado.is_empty():
		return
	sentado = {}
	m.armar(m.h.modo)
	_rede("levantar")

# ---------- o corpo sentado no banco (sentar.gd, como no carrinho) ----------
# O servidor manda kk_sentado para quem sentou; online.gd marca o.mesa_sent e toca a parada. Aqui o quadril vai para o
# banco, os pés para o chão na frente e as mãos para a mesa; servido, uma mão leva a comida à boca de vez em quando.
func _esq(id: String):
	if id == "eu":
		return m.heroi_esq
	if m.online and m.online.outros.has(id):
		return m.online.outros[id].get("esq")
	return null

func _poses_mesa() -> void:
	var quem := {}
	if not sentado.is_empty() and m.heroi != null:
		quem["eu"] = m.heroi
	if m.online:
		for id in m.online.outros:
			var o: Dictionary = m.online.outros[id]
			if o.get("mesa_sent", false) and is_instance_valid(o.no) and o.no.visible:
				quem[str(id)] = o.no
	for id in poses.keys():
		var p: Dictionary = poses[id]
		if not quem.has(id) or not is_instance_valid(p.esq) or p.esq != _esq(id):
			if is_instance_valid(p.pose):
				p.pose.queue_free()
			poses.erase(id)
			if id != "eu" and m.online.outros.has(id):
				m.online.outros[id].sentado = false
				m.online.outros[id].modo = "" # o próximo pacote arma de novo (online.gd)
	for id in quem:
		var esq = _esq(id)
		if not (esq is Skeleton3D) or not is_instance_valid(esq):
			continue
		if not poses.has(id):
			var pose = Sentar.new()
			esq.add_child(pose)
			# como o transporte.gd: antes das molas do cabelo e da saia
			var antes: int = esq.get_child_count() - 1
			for i in esq.get_child_count():
				if esq.get_child(i) is SpringBoneSimulator3D:
					antes = i
					break
			esq.move_child(pose, antes)
			pose.preparar(esq)
			poses[id] = {"pose": pose, "esq": esq}
			if id != "eu" and m.online.outros.has(id):
				m.online.outros[id].sentado = true # sentado: as armas nas costas (online.gd)
				m.online.outros[id].modo = ""
		_alvos(poses[id].pose, quem[id], id)

func _alvos(pose, no: Node3D, id: String) -> void:
	var ry: float = no.global_rotation.y
	var fr := Vector3(sin(ry), 0.0, cos(ry))
	var lat := Vector3(cos(ry), 0.0, -sin(ry)) # +x do corpo (o lado esquerdo dele)
	var b: Vector3 = no.global_position
	pose.frente_lobo = fr
	pose.lado_lobo = lat
	pose.cima_lobo = Vector3.UP
	pose.sela = b + Vector3(0, ASSENTO + QUADRIL, 0) - fr * 0.04
	pose.deita = 0.1
	pose.torce = 0.0
	# comendo: a mão direita (lado -x) vai do prato à boca, cada um no seu ritmo
	var come := 0.0
	for k in mesas:
		if str(mesas[k].fase) == "comendo":
			# relógio do jogo (_relogio), não o do aparelho: a garfada leva 2,6 s (sobe e desce) a cada ~8 s, cada um no seu ritmo
			var t := fmod(_relogio + float(hash(id) % 1000) / 125.0, 8.0)
			come = sin(t / 2.6 * PI) if t < 2.6 else 0.0
			break
	for i in 2:
		var sx: float = 1.0 if i == 0 else -1.0
		pose.pe[i] = b + fr * 0.4 + lat * sx * 0.13 + Vector3(0, 0.07, 0)
		var mao: Vector3 = b + fr * 0.55 + lat * sx * 0.19 + Vector3(0, TAMPO + 0.05, 0)
		if i == 1 and come > 0.0:
			mao = mao.lerp(b + fr * 0.2 - lat * 0.04 + Vector3(0, ASSENTO + QUADRIL + 0.62, 0), come * 0.9)
		pose.pegada[i] = mao

# ---------- a comida em cima da mesa ----------
func _mesa_comida(ev: Dictionary) -> void:
	var k := str(ev.get("k", ""))
	if mesas.has(k) and is_instance_valid(mesas[k].no):
		mesas[k].no.queue_free()
	mesas.erase(k)
	var com: Array = ev.get("comida", [])
	var fase := str(ev.get("fase", ""))
	if fase == "" or (com.is_empty() and fase != "comendo"):
		return
	var raiz := Node3D.new()
	raiz.name = "Jantar_" + k
	add_child(raiz)
	var x := float(ev.x)
	var z := float(ev.z)
	# y do servidor: o piso onde a mesa está (com fundação embaixo, 0,2 m acima do chão; shared/base.js mesaBase)
	var y: float = float(ev.y) if ev.get("y") != null else (m.base_cla._chao(x, z) if m.base_cla != null else 0.0)
	raiz.position = Vector3(x, y + TAMPO, z)
	raiz.rotation.y = float(ev.get("ry", 0.0))
	# travessas no meio da mesa: uma por lugar de comida (o slot), em fila em cima do caminho de mesa
	var n := com.size()
	for i in n:
		var px := (float(i) - (n - 1) / 2.0) * 0.42
		_travessa(raiz, str(com[i]), Vector3(px, 0.0, 0.0 if n <= 4 else (0.09 if i % 2 == 0 else -0.09)))
	# servido: um prato com caneca na frente de cada lugar ocupado
	if fase == "comendo":
		var lugs: Array = ev.get("lugares", [0, 1, 2, 3, 4, 5, 6, 7])
		for s in lugs:
			var L: Vector2 = LUGARES[int(s)]
			var dentro := Vector3(L.x * 0.72 if absf(L.y) < 0.01 else L.x, 0.0, L.y * 0.62)
			_prato(raiz, str(com[int(s) % maxi(1, n)]) if n > 0 else "", dentro, absf(L.y) < 0.01)
	mesas[k] = {"no": raiz, "comida": com, "fase": fase}

func _mat(c: Color, brilho := 0.0) -> StandardMaterial3D:
	var chave := c.to_html() + str(brilho)
	if _mats.has(chave):
		return _mats[chave]
	var mt := StandardMaterial3D.new()
	mt.albedo_color = c
	mt.roughness = 0.75
	if brilho > 0.0:
		mt.emission_enabled = true
		mt.emission = c
		mt.emission_energy_multiplier = brilho
	_mats[chave] = mt
	return mt

func _cilindro(pai: Node3D, r: float, h: float, pos: Vector3, c: Color, r2 := -1.0) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = r
	cm.bottom_radius = r2 if r2 >= 0.0 else r
	cm.height = h
	cm.radial_segments = 14
	cm.rings = 1
	mi.mesh = cm
	mi.material_override = _mat(c)
	mi.position = pos
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	pai.add_child(mi)
	return mi

func _bola(pai: Node3D, tam: Vector3, pos: Vector3, c: Color) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.5
	sm.height = 1.0
	sm.radial_segments = 10
	sm.rings = 5
	mi.mesh = sm
	mi.material_override = _mat(c)
	mi.position = pos
	mi.scale = tam
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	pai.add_child(mi)
	return mi

# a comida de um item, em cima de um prato (centro em pos): peixe, carne, pão, sopa, torta ou legumes
func _comida_3d(pai: Node3D, k: String, pos: Vector3, tam := 1.0) -> void:
	var it: Dictionary = m.P.dados.itens.get(k, {})
	if it.get("peixe", false) == true or k == "peixe_assado":
		var cor := Color(0.78, 0.5, 0.24) if k == "peixe_assado" else Color(0.62, 0.66, 0.7)
		_bola(pai, Vector3(0.2, 0.05, 0.07) * tam, pos + Vector3(0, 0.03 * tam, 0), cor)
		var rabo := _bola(pai, Vector3(0.05, 0.035, 0.06) * tam, pos + Vector3(0.11 * tam, 0.03 * tam, 0), cor.darkened(0.15))
		rabo.rotation.y = 0.3
	elif k in ["sopa_legumes", "ensopado"]:
		_cilindro(pai, 0.085 * tam, 0.06 * tam, pos + Vector3(0, 0.03 * tam, 0), Color(0.45, 0.3, 0.2), 0.06 * tam)
		_cilindro(pai, 0.075 * tam, 0.005, pos + Vector3(0, 0.058 * tam, 0), Color(0.8, 0.55, 0.2) if k == "sopa_legumes" else Color(0.5, 0.24, 0.12))
	elif k == "torta_abobora":
		_cilindro(pai, 0.1 * tam, 0.045 * tam, pos + Vector3(0, 0.025 * tam, 0), Color(0.92, 0.55, 0.18))
		_cilindro(pai, 0.103 * tam, 0.012, pos + Vector3(0, 0.048 * tam, 0), Color(0.85, 0.66, 0.38))
	elif k == "pao_milho":
		_bola(pai, Vector3(0.14, 0.07, 0.09) * tam, pos + Vector3(0, 0.035 * tam, 0), Color(0.9, 0.72, 0.34))
	elif k in ["carne", "carne_assada"]:
		_bola(pai, Vector3(0.15, 0.07, 0.11) * tam, pos + Vector3(0, 0.035 * tam, 0), Color(0.48, 0.24, 0.13) if k == "carne_assada" else Color(0.72, 0.28, 0.26))
		_cilindro(pai, 0.012 * tam, 0.09 * tam, pos + Vector3(0.07 * tam, 0.05 * tam, 0), Color(0.92, 0.88, 0.78)).rotation.z = 1.2
	else: # legumes e frutas da horta: três de uma cor
		var cores := {"rabanete": Color(0.78, 0.15, 0.25), "cenoura": Color(0.95, 0.5, 0.1), "batata": Color(0.78, 0.62, 0.38), "tomate": Color(0.86, 0.16, 0.12),
			"milho": Color(0.98, 0.82, 0.25), "abobora": Color(0.93, 0.52, 0.12)}
		var c: Color = cores.get(k, Color(0.5, 0.7, 0.3))
		for i in 3:
			var a := i * TAU / 3.0
			_bola(pai, Vector3(0.055, 0.05, 0.055) * tam, pos + Vector3(cos(a) * 0.045 * tam, 0.028 * tam, sin(a) * 0.045 * tam), c)

func _travessa(pai: Node3D, k: String, pos: Vector3) -> void:
	_cilindro(pai, 0.17, 0.025, pos + Vector3(0, 0.013, 0), Color(0.7, 0.67, 0.6))
	_comida_3d(pai, k, pos + Vector3(0, 0.025, 0), 1.25)

func _prato(pai: Node3D, k: String, pos: Vector3, cabeceira: bool) -> void:
	_cilindro(pai, 0.12, 0.018, pos + Vector3(0, 0.009, 0), Color(0.82, 0.8, 0.74))
	if k != "":
		_comida_3d(pai, k, pos + Vector3(0, 0.018, 0), 0.85)
	# caneca ao lado do prato
	var lado := Vector3(0, 0, 0.17) if cabeceira else Vector3(0.17, 0, 0)
	_cilindro(pai, 0.035, 0.09, pos + lado + Vector3(0, 0.045, 0), Color(0.46, 0.32, 0.2))
	_cilindro(pai, 0.031, 0.004, pos + lado + Vector3(0, 0.088, 0), Color(0.86, 0.68, 0.3))

extends Node
const Idioma = preload("res://idioma.gd") # inglês (idioma.gd)
const Menu = preload("res://menu.gd")
# Arena PvP 3x3 Geada x Chama (André 2026-11-21: "opção lá na barra recolhível de entrar nas duas opções"; "o 3x3 dura
# 5 mins, o time que matar mais nesse tempo vence, no final abre uma janela com a qtd de kills e quem venceu").
# Quem decide tudo é o servidor (shared/arena.js). Aqui: a janela do botão PvP do menu do topo (Arena 3x3, Battle Royale
# "em breve" e a Loja da Arena), o placar com o tempo no alto da tela, a contagem, o chão das bases nas cores dos times,
# os nomes do outro time em vermelho (e do meu em azul), o alvo do golpe e a janela do fim com os abates de cada um.

const COR := {"chama": Color(1.0, 0.6, 0.24), "geada": Color(0.56, 0.82, 1.0)}
const NOME := {"chama": "Chama", "geada": "Geada"}
const VERMELHO := Color(1.0, 0.42, 0.36)
const AZUL := Color(0.55, 0.82, 1.0)

var m # main.gd
var info := {} # o último "info" do servidor (Insígnias, placar e loja)
var na_fila := false
var fila_n := 0
var fila_falta := -1
var fase := "" # "", "contagem", "luta", "fim"
var meu_time := ""
var times := {} # id -> "chama" | "geada"
var nomes := {} # id -> nome
var arena := {} # x, z, r
var bases := {}
var luta_em := 0.0 # m.tempo em que a luta começa
var fim_em := 0.0 # m.tempo em que acaba
var placar := {"chama": 0, "geada": 0}
var caidos := {} # id -> m.tempo em que levanta
var _alvos := {} # id -> o alvo do golpe (main.gd mais_perto): {no, estado, duelo, id}
var _cor := {} # id -> cores de antes da barra e do nome
var _enfeites: Array = [] # anel, chão das bases e luzes
var _mat_anel: StandardMaterial3D
var _camada: CanvasLayer
var _placar: PanelContainer
var _placar_txt: Label
var _tempo_txt: Label
var _grande: Label # contagem e "Lutem!"
var _fim: Control # janela do fim
var _pintar_t := 0.0

func _init(principal) -> void:
	m = principal

func ativo() -> bool:
	return fase != ""

# dentro da arena a névoa não vale (nevoa.gd): ela fica dentro de uma região fechada de propósito
func livre_em(x: float, z: float) -> bool:
	return ativo() and not arena.is_empty() and Vector2(x - float(arena.x), z - float(arena.z)).length() <= float(arena.r) + 4.0

# ---------- a janela do botão PvP (menu_topo.gd) ----------
func abrir() -> void:
	m.rede("pvp", {"acao": "info"})
	m.menu_topo.abrir("pvp")

func _refazer() -> void:
	if m.menu_topo and m.menu_topo.aberta == "pvp":
		m.menu_topo.montar()

func montar_janela(t) -> void:
	t._cabeca("topo_pvp", "PvP")
	t._texto("Arena 3x3 · Geada x Chama", Menu.OURO_CLARO, 20)
	t._texto("5 minutos. Vence o time que derrubar mais. Quem cai levanta na base em 5 s, sem perder XP nem equipamento. Faltando gente, os NPCs completam os times.", Menu.TEXTO, 15)
	if not m.on():
		t._texto("O PvP é online: entre com a conta para jogar.", Menu.APAGADO, 16)
	elif ativo():
		t._texto("Você está numa partida (time %s)." % NOME.get(meu_time, ""), COR.get(meu_time, Menu.TEXTO), 17)
		t._add(t._botao("Sair da partida (sem Insígnias)", func():
			m.rede("pvp", {"acao": "sair"})
			t.fechar(), false, true))
	elif na_fila:
		var txt := "Na fila: %d %s" % [fila_n, "pessoa" if fila_n == 1 else "pessoas"]
		if fila_falta > 0:
			txt += " · começa em %d s" % fila_falta
		elif fila_falta < 0:
			txt += " · esperando a partida de agora acabar"
		t._texto(txt, Menu.VERDE, 17)
		t._add(t._botao("Sair da fila", func(): m.rede("pvp", {"acao": "sair"}), false))
	else:
		if info.get("partida", false):
			t._texto("Tem uma partida rolando: entrando agora, você joga a próxima.", Menu.APAGADO, 15)
		t._add(t._botao("Entrar na fila da Arena 3x3", func(): m.rede("pvp", {"acao": "fila"})))
	var br: Button = t._botao("Battle Royale · em breve", func(): m.hud.aviso("Battle Royale: em breve"), false)
	br.modulate = Color(1, 1, 1, 0.55)
	t._add(br)
	# placar e loja
	t._texto("%d vitórias · %d derrotas · %d empates · %d abates" % [int(info.get("v", 0)), int(info.get("d", 0)), int(info.get("e", 0)), int(info.get("k", 0))], Menu.APAGADO, 15)
	t._texto("Loja da Arena · %d %s" % [int(info.get("pts", 0)), str(info.get("moeda", "Insígnias da Arena"))], Menu.OURO_CLARO, 20)
	for o in info.get("loja", []):
		var linha := HBoxContainer.new()
		linha.add_theme_constant_override("separation", 10)
		var col := VBoxContainer.new()
		col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		col.add_child(Menu.rotulo(str(o.get("nome", "")), 16, Menu.TEXTO))
		var d := Menu.rotulo(str(o.get("txt", "")), 13, Menu.APAGADO)
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		d.custom_minimum_size = Vector2(250, 0)
		col.add_child(d)
		linha.add_child(col)
		var tem: bool = o.get("tem", false) == true
		var preco := int(o.get("preco", 0))
		var id := str(o.get("id", ""))
		var b: Button = t._botao("Já é seu" if tem else "%d" % preco, func(): m.rede("pvp", {"acao": "comprar", "id": id}), not tem and int(info.get("pts", 0)) >= preco)
		b.custom_minimum_size = Vector2(110, 46)
		b.disabled = tem
		linha.add_child(b)
		t.conteudo.add_child(linha)

# ---------- eventos do servidor ----------
func do_servidor(ev: Dictionary) -> void:
	match str(ev.get("fase", "")):
		"info":
			info = ev
			na_fila = ev.get("naFila", false) == true
			fila_n = int(ev.get("fila", 0))
			_refazer()
		"fila":
			na_fila = ev.get("na", false) == true
			fila_n = int(ev.get("n", 0))
			fila_falta = int(ev.get("falta", -1))
			_refazer()
		"inicio":
			_inicio(ev)
		"luta":
			fase = "luta"
			fim_em = m.tempo + float(ev.get("fimEm", 300))
			if m.sons:
				m.sons.tocar("festa_libera", -6.0)
		"abate":
			_abate(ev)
		"pulo":
			_pulo(ev)
		"fim":
			_fim_partida(ev)
		"saiu":
			var era := fase
			_limpar()
			if str(ev.get("motivo", "")) == "saiu" and era != "":
				m.hud.aviso("Você saiu da Arena")
			m.rede("pvp", {"acao": "info"})
		"saiuOutro":
			m.hud.aviso("%s saiu da partida" % str(ev.get("nome", "")))

func _inicio(ev: Dictionary) -> void:
	_limpar()
	na_fila = false
	meu_time = str(ev.get("time", "chama"))
	arena = ev.get("arena", {})
	bases = ev.get("bases", {})
	for j in ev.get("jogadores", []):
		times[str(j.id)] = str(j.time)
		nomes[str(j.id)] = str(j.nome)
	placar = {"chama": 0, "geada": 0}
	fase = "contagem"
	luta_em = m.tempo + float(ev.get("conta", 5))
	fim_em = luta_em + float(ev.get("dur", 300))
	_montar_chao()
	_pintar(true)
	_hud()
	if m.menu_topo and m.menu_topo.aberta == "pvp":
		m.menu_topo.fechar()
	if m.hud.festa:
		m.hud.festa.anuncio("Arena 3x3", "Você é da %s" % NOME.get(meu_time, ""), "boss")
	if m.sons:
		m.sons.tocar("pano", -6.0)

func _abate(ev: Dictionary) -> void:
	var p = ev.get("placar")
	if p is Dictionary:
		placar = p
	var alvo := str(ev.get("alvo", ""))
	caidos[alvo] = m.tempo + float(ev.get("volta", 5))
	if _alvos.has(alvo):
		_alvos[alvo].estado = "morto" # o alvo travado solta (main.gd vivo)
	var de := str(ev.get("de", ""))
	var meu: String = m.online.meu_id if m.online else ""
	if de == meu:
		m.hud.aviso("Você derrubou %s!" % str(ev.get("alvoNome", "")))
		if m.sons:
			m.sons.tocar("moedas", -10.0)
	elif alvo == meu:
		m.hud.aviso("%s derrubou você. Levantando na base..." % str(ev.get("deNome", "")))
	else:
		m.hud.aviso("%s derrubou %s" % [str(ev.get("deNome", "")), str(ev.get("alvoNome", ""))])

# alguém foi levado para a arena, para a base ou de volta: aparece direto lá (sem deslizar o mapa todo)
func _pulo(ev: Dictionary) -> void:
	if m.online == null:
		return
	var id := str(ev.get("id", ""))
	if id == m.online.meu_id: # o meu vem pelo "corrigir"; a câmera vai junto
		if m.cam:
			m.cam.colocar(m.heroi.position)
		return
	var o = m.online.outros.get(id)
	if o == null:
		return
	var para := Vector3(float(ev.x), float(ev.y), float(ev.z))
	o.alvo = para
	o.buf = []
	if is_instance_valid(o.no):
		o.no.position = para
	caidos.erase(id)

# ---------- o alvo do golpe (main.gd mais_perto) ----------
# o mais perto do outro time, de pé, à vista (só na luta)
func alvo(pos: Vector3, max_d: float):
	if fase != "luta" or m.online == null:
		return null
	var melhor = null
	var md := max_d
	for id in times:
		if times[id] == meu_time or caidos.get(id, 0.0) > m.tempo:
			continue
		var o = m.online.outros.get(id)
		if o == null or not is_instance_valid(o.no) or not o.no.visible:
			continue
		var d: float = o.no.position.distance_to(pos)
		if d >= md:
			continue
		if not _alvos.has(id) or _alvos[id].no != o.no:
			_alvos[id] = {"no": o.no, "estado": "vivo", "duelo": true, "id": id}
		_alvos[id].estado = "vivo"
		md = d
		melhor = _alvos[id]
	return melhor

# ---------- fim ----------
func _fim_partida(ev: Dictionary) -> void:
	fase = "fim"
	var p = ev.get("placar")
	if p is Dictionary:
		placar = p
	_atualizar_placar()
	_janela_fim(ev)
	var res := str(ev.get("resultado", ""))
	if m.sons:
		m.sons.tocar("festa_libera" if res == "v" else "pano", -4.0)

func _janela_fim(ev: Dictionary) -> void:
	if _fim != null:
		_fim.queue_free()
	_fim = Control.new()
	_fim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_camada_ui().add_child(_fim)
	var escuro := ColorRect.new()
	escuro.color = Color(0.03, 0.025, 0.02, 0.55)
	escuro.set_anchors_preset(Control.PRESET_FULL_RECT)
	_fim.add_child(escuro)
	var centro := CenterContainer.new()
	centro.set_anchors_preset(Control.PRESET_FULL_RECT)
	_fim.add_child(centro)
	var caixa := PanelContainer.new()
	var est := Menu.caixa(Color(0.086, 0.07, 0.055, 0.96), Color(0.925, 0.81, 0.55, 0.5), 1, 16, 16)
	for k in ["content_margin_left", "content_margin_right"]:
		est.set(k, 26)
	est.content_margin_top = 18
	est.content_margin_bottom = 18
	caixa.add_theme_stylebox_override("panel", est)
	centro.add_child(caixa)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	caixa.add_child(col)
	var venc := str(ev.get("vencedor", ""))
	var res := str(ev.get("resultado", ""))
	var titulo := "Empate!" if venc == "" else "Vitória da %s!" % NOME.get(venc, venc)
	var t := Menu.rotulo(titulo, 30, COR.get(venc, Menu.OURO_CLARO))
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(t)
	var sub := Menu.rotulo("Seu time venceu" if res == "v" else ("Seu time perdeu" if res == "d" else "Ninguém levou"), 17, Menu.TEXTO)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(sub)
	var pl := Menu.rotulo("Chama %d  ×  %d Geada" % [int(placar.get("chama", 0)), int(placar.get("geada", 0))], 22, Menu.OURO_CLARO)
	pl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(pl)
	# os dois times lado a lado: nome, abates e quedas de cada um
	var lados := HBoxContainer.new()
	lados.add_theme_constant_override("separation", 28)
	col.add_child(lados)
	var meu: String = m.online.meu_id if m.online else ""
	for tm in ["chama", "geada"]:
		var g := GridContainer.new()
		g.columns = 3
		g.add_theme_constant_override("h_separation", 16)
		g.add_theme_constant_override("v_separation", 4)
		g.add_child(Menu.rotulo(NOME[tm], 18, COR[tm]))
		g.add_child(Menu.rotulo("Abates", 13, Menu.APAGADO))
		g.add_child(Menu.rotulo("Quedas", 13, Menu.APAGADO))
		for s in ev.get("stats", []):
			if str(s.get("time", "")) != tm:
				continue
			var eu := str(s.get("id", "")) == meu
			var c: Color = Menu.OURO_CLARO if eu else Menu.TEXTO
			var n := Menu.rotulo(str(s.get("nome", "")) + (" (você)" if eu else ""), 16, c)
			n.custom_minimum_size = Vector2(150, 0)
			g.add_child(n)
			var k := Menu.rotulo(str(int(s.get("k", 0))), 17, c)
			k.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			g.add_child(k)
			var q := Menu.rotulo(str(int(s.get("m", 0))), 17, c)
			q.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			g.add_child(q)
		lados.add_child(g)
	var ganhou := int(ev.get("ganhou", 0))
	var moeda := str(ev.get("moeda", "Insígnias da Arena"))
	var pr := Menu.rotulo(("+%d %s (agora você tem %d)" % [ganhou, moeda, int(ev.get("pts", 0))]) if ganhou > 0 else "Sem %s: você ficou pouco tempo na partida" % moeda, 16, Menu.VERDE if ganhou > 0 else Menu.APAGADO)
	pr.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(pr)
	var volta := Menu.rotulo("Voltando para onde você estava...", 13, Menu.APAGADO)
	volta.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(volta)
	var b := Button.new()
	b.text = Idioma.frase("Fechar")
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(0, 46)
	b.add_theme_font_size_override("font_size", 17)
	Menu.estilo_botao(b, true)
	b.pressed.connect(func():
		if _fim != null:
			_fim.queue_free()
			_fim = null)
	col.add_child(b)

# ---------- HUD: placar, tempo e contagem ----------
func _camada_ui() -> CanvasLayer:
	if _camada == null:
		_camada = CanvasLayer.new()
		_camada.layer = 4 # junto do menu do topo, acima da HUD
		add_child(_camada)
	return _camada

func _hud() -> void:
	var c := _camada_ui()
	if _placar == null:
		_placar = PanelContainer.new()
		var est := Menu.caixa(Color(0.07, 0.055, 0.045, 0.82), Color(0.925, 0.81, 0.55, 0.45), 1, 12, 6)
		est.content_margin_left = 16
		est.content_margin_right = 16
		est.content_margin_top = 4
		est.content_margin_bottom = 4
		_placar.add_theme_stylebox_override("panel", est)
		_placar.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_placar.set_anchors_preset(Control.PRESET_CENTER_TOP)
		_placar.grow_horizontal = Control.GROW_DIRECTION_BOTH
		_placar.offset_top = 128 # abaixo dos ícones do menu do topo (em cima ficam o FPS e o aviso de conexão)
		var col := VBoxContainer.new()
		col.add_theme_constant_override("separation", 0)
		col.mouse_filter = Control.MOUSE_FILTER_IGNORE
		_placar.add_child(col)
		_placar_txt = Label.new()
		_placar_txt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_placar_txt.add_theme_font_size_override("font_size", 22)
		_placar_txt.add_theme_color_override("font_color", Menu.OURO_CLARO)
		_placar_txt.add_theme_color_override("font_outline_color", Color(0.1, 0.05, 0.0))
		_placar_txt.add_theme_constant_override("outline_size", 6)
		col.add_child(_placar_txt)
		_tempo_txt = Label.new()
		_tempo_txt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_tempo_txt.add_theme_font_size_override("font_size", 16)
		_tempo_txt.add_theme_color_override("font_color", Menu.TEXTO)
		col.add_child(_tempo_txt)
		c.add_child(_placar)
	if _grande == null:
		_grande = Label.new()
		_grande.set_anchors_preset(Control.PRESET_CENTER_TOP)
		_grande.grow_horizontal = Control.GROW_DIRECTION_BOTH
		_grande.offset_left = -200
		_grande.offset_right = 200
		_grande.offset_top = 200
		_grande.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_grande.add_theme_color_override("font_color", Menu.OURO_CLARO)
		_grande.add_theme_color_override("font_outline_color", Color(0.25, 0.05, 0.0))
		_grande.add_theme_constant_override("outline_size", 10)
		_grande.mouse_filter = Control.MOUSE_FILTER_IGNORE
		c.add_child(_grande)
	_placar.visible = true
	_atualizar_placar()

func _atualizar_placar() -> void:
	if _placar_txt == null:
		return
	_placar_txt.text = "%s %d  ×  %d %s" % [Idioma.frase("Chama"), int(placar.get("chama", 0)), int(placar.get("geada", 0)), Idioma.frase("Geada")]

func _process(dt: float) -> void:
	if fase == "" or _placar == null:
		return
	_atualizar_placar()
	var falta: float = luta_em - m.tempo
	if fase == "contagem" and falta > 0.0:
		_tempo_txt.text = Idioma.frase("Prepare-se")
		_grande.visible = true
		_grande.add_theme_font_size_override("font_size", 72)
		_grande.text = str(int(ceil(falta)))
	elif fase == "luta" and falta > -0.9:
		_grande.visible = true
		_grande.add_theme_font_size_override("font_size", 56)
		_grande.text = Idioma.frase("Lutem!")
	else:
		_grande.visible = false
	if fase == "luta":
		var s := maxf(0.0, fim_em - m.tempo)
		_tempo_txt.text = "%d:%02d" % [int(s) / 60, int(s) % 60]
		_tempo_txt.add_theme_color_override("font_color", VERMELHO if s < 30.0 else Menu.TEXTO)
	elif fase == "fim":
		_tempo_txt.text = Idioma.frase("Fim de partida")
	# caído: o texto de quanto falta para levantar
	var meu: String = m.online.meu_id if m.online else ""
	if caidos.get(meu, 0.0) > m.tempo and fase == "luta":
		_grande.visible = true
		_grande.add_theme_font_size_override("font_size", 26)
		_grande.text = Idioma.frase("Levantando na base em %d s") % int(ceil(caidos[meu] - m.tempo))
	_pintar_t -= dt
	if _pintar_t <= 0.0: # quem chegou à vista depois (o corpo aparece quando entra na área de interesse)
		_pintar_t = 1.0
		_pintar(true)
	if _mat_anel != null:
		_mat_anel.albedo_color.a = 0.55 + 0.25 * sin(m.tempo * 3.0)

# ---------- no chão: a borda da arena e as bases nas cores dos times ----------
func _montar_chao() -> void:
	if arena.is_empty():
		return
	var cx := float(arena.x)
	var cz := float(arena.z)
	var r := float(arena.r)
	_mat_anel = _material(Color(1.0, 0.82, 0.45, 0.8))
	_enfeites.append(_fita(Vector3(cx, 0, cz), r, 0.25, _mat_anel))
	_enfeites.append(_fita(Vector3(cx, 0, cz), 2.2, 0.12, _material(Color(1.0, 0.9, 0.6, 0.55)))) # o meio
	for tm in ["chama", "geada"]:
		var b = bases.get(tm)
		if not (b is Dictionary):
			continue
		var p := Vector3(float(b.x), 0, float(b.z))
		_enfeites.append(_disco(p, 4.0, _material(Color(COR[tm].r, COR[tm].g, COR[tm].b, 0.42), false)))
		_enfeites.append(_fita(p, 4.0, 0.24, _material(Color(COR[tm].r, COR[tm].g, COR[tm].b, 0.95), false)))
		var luz := OmniLight3D.new() # a base acesa na cor do time (sem sombra: o celular agradece)
		luz.light_color = COR[tm]
		luz.light_energy = 1.6
		luz.omni_range = 9.0
		luz.shadow_enabled = false
		luz.position = Vector3(p.x, m.chao_em(p.x, p.z) + 2.5, p.z)
		m.add_child(luz)
		_enfeites.append(luz)

func _material(c: Color, somar := true) -> StandardMaterial3D:
	var mt := StandardMaterial3D.new()
	mt.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mt.blend_mode = BaseMaterial3D.BLEND_MODE_ADD if somar else BaseMaterial3D.BLEND_MODE_MIX # no capim claro a cor do time só aparece misturada
	mt.cull_mode = BaseMaterial3D.CULL_DISABLED
	mt.albedo_color = c
	return mt

# anel fino no chão que segue o relevo (como o círculo do duelo)
func _fita(centro: Vector3, raio: float, larg: float, mat: Material) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLE_STRIP)
	var n := 96
	for i in range(n + 1):
		var a := TAU * float(i) / float(n)
		var d := Vector3(sin(a), 0.0, cos(a))
		for rr in [raio - larg, raio + larg]:
			var p: Vector3 = Vector3(centro.x, 0.0, centro.z) + d * rr
			p.y = m.chao_em(p.x, p.z) + 0.07
			st.add_vertex(p)
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	m.add_child(mi)
	return mi

func _disco(centro: Vector3, raio: float, mat: Material) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var n := 48
	var meio := Vector3(centro.x, m.chao_em(centro.x, centro.z) + 0.05, centro.z)
	for i in n:
		var a0 := TAU * float(i) / float(n)
		var a1 := TAU * float(i + 1) / float(n)
		var p0 := Vector3(centro.x + sin(a0) * raio, 0, centro.z + cos(a0) * raio)
		var p1 := Vector3(centro.x + sin(a1) * raio, 0, centro.z + cos(a1) * raio)
		p0.y = m.chao_em(p0.x, p0.z) + 0.05
		p1.y = m.chao_em(p1.x, p1.z) + 0.05
		st.add_vertex(meio)
		st.add_vertex(p0)
		st.add_vertex(p1)
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	m.add_child(mi)
	return mi

# ---------- nomes e barras: o outro time em vermelho, o meu em azul ----------
func _pintar(liga: bool) -> void:
	if m.online == null:
		return
	for id in times:
		var o = m.online.outros.get(id)
		if o == null:
			continue
		var barra: MeshInstance3D = o.get("barra")
		var placa: Label3D = o.get("placa")
		if liga:
			if _cor.has(id) and _cor[id].get("no") == o.no: # já pintado
				continue
			var cor: Color = AZUL if times[id] == meu_time else VERMELHO
			var c := {"no": o.no}
			if barra and barra.material_override:
				c.barra = barra.material_override.albedo_color
				barra.material_override.albedo_color = cor
			if placa:
				c.placa = placa.modulate
				placa.modulate = cor
			_cor[id] = c
		elif _cor.has(id) and _cor[id].get("no") == o.no: # o corpo ainda é o mesmo
			if barra and barra.material_override and _cor[id].has("barra"):
				barra.material_override.albedo_color = _cor[id].barra
			if placa and _cor[id].has("placa"):
				placa.modulate = _cor[id].placa
	if not liga:
		_cor = {}

func _limpar() -> void:
	_pintar(false)
	for a in _alvos.values():
		a.estado = "morto"
	_alvos = {}
	for n in _enfeites:
		if is_instance_valid(n):
			n.queue_free()
	_enfeites = []
	_mat_anel = null
	fase = ""
	times = {}
	nomes = {}
	caidos = {}
	if _placar != null:
		_placar.visible = false
	if _grande != null:
		_grande.visible = false

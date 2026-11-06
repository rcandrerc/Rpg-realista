extends CanvasLayer
# Interação com os NPCs (como no Quimera): perto de um NPC aparece o botão Falar (balão); tocar num NPC na tela
# faz o herói ir até ele sozinho. Os dois abrem a janela do NPC: o nome, a fala e o que dá para fazer com ele
# (vender itens, comprar, forja, missão, cura, resetar a build...). O que cada um oferece vem de "acoes"
# em shared/dados.js (MAPA_CLAREIRA.npcs, copiado para dados/mundo.json). Online quem decide é o servidor:
# a janela só manda "falar" ({npc, conversa}) ou abre o menu do personagem na aba certa (vender manda "item").

const Menu = preload("res://menu.gd")
const Aparencia = preload("res://aparencia.gd")
const VisualNpc = preload("res://visual_npc.gd")
const PERTO := 3.0 # metros para o botão aparecer (o servidor responde até 3,2)
const CHEGOU := 2.2 # andando sozinho: para a esta distância e abre a janela

# o que aparece na janela para cada ação de "acoes": texto e ícone
const ACOES := {
	"comprar": ["Comprar", "loja"],
	"vender": ["Vender itens", "it_ouro"],
	"forja": ["Forja (criar)", "pf_fer"],
	"consertar": ["Consertar", "cs_bigorna"], # durabilidade (penalidade de morte, André 2026-11-05)
	"alfaiate": ["Alfaiate (criar)", "pf_alf"],
	"habilidades": ["Habilidades", "basico"],
	"missao": ["Missão", "it_tomo"],
	"cura": ["Curar", "cura"],
	"resetar": ["Resetar build", "desfazer"],
	"passe": ["Fazer passe da caverna", "it_passe_caverna"], # Gaspar, na boca da Caverna da Montanha (2026-11-06)
}

var m # main.gd
var raiz: Control
var caixa_ui: PanelContainer
var nome_ui: Label
var papel_ui: Label
var fala_ui: Label
var opcoes: GridContainer
var retrato_ui: TextureRect
var _retratos := {} # id do NPC -> SubViewport com o rosto dele
var npc = null # o NPC com a janela aberta (dicionário de main.npcs)
var ry_antes := 0.0 # o NPC vira para o herói e depois volta
var indo = null # {npc, ate, d, t}: tocou no NPC longe e o herói está indo até ele
var _falas := {} # sem internet: qual fala de cada NPC vem agora
# O mesmo toque que aperta o Falar (hud.gd _input) segue para a interface depois que a janela já abriu: caía no
# fundo escuro (fechava na hora) ou numa opção embaixo do dedo ("Até logo", "Vender"). Por isso a janela às vezes
# "não abria" (André 2026-11-05). Toques que chegam logo depois de abrir são ignorados.
const ESPERA_TOQUE := 400 # ms
var _aberto_ms := 0

func _toque_valido() -> bool:
	return Time.get_ticks_msec() - _aberto_ms >= ESPERA_TOQUE

func _init(principal) -> void:
	m = principal
	layer = 15 # acima da HUD, abaixo do menu do personagem (20)

func _ready() -> void:
	raiz = Control.new()
	raiz.set_anchors_preset(Control.PRESET_FULL_RECT)
	raiz.mouse_filter = Control.MOUSE_FILTER_IGNORE
	raiz.visible = false
	add_child(raiz)
	# fundo escurecido embaixo (a cena continua visível em cima, com o NPC)
	var sombra := ColorRect.new()
	sombra.color = Color(0, 0, 0, 0.35)
	sombra.set_anchors_preset(Control.PRESET_FULL_RECT)
	sombra.gui_input.connect(func(ev): if ((ev is InputEventScreenTouch and ev.pressed) or (ev is InputEventMouseButton and ev.pressed)) and _toque_valido(): fechar())
	raiz.add_child(sombra)
	caixa_ui = PanelContainer.new()
	caixa_ui.add_theme_stylebox_override("panel", Menu.caixa(Menu.FUNDO, Menu.OURO.darkened(0.25), 2, 10, 14))
	caixa_ui.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	caixa_ui.grow_horizontal = Control.GROW_DIRECTION_BOTH
	caixa_ui.grow_vertical = Control.GROW_DIRECTION_BEGIN
	caixa_ui.offset_left = -410
	caixa_ui.offset_right = 410
	caixa_ui.offset_bottom = -18
	raiz.add_child(caixa_ui)
	var lado := HBoxContainer.new()
	lado.add_theme_constant_override("separation", 16)
	caixa_ui.add_child(lado)
	# retrato do NPC (rosto renderizado do modelo dele), redondo com moldura dourada, como o do herói
	var moldura := Control.new()
	moldura.custom_minimum_size = Vector2(96, 96)
	moldura.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	lado.add_child(moldura)
	retrato_ui = TextureRect.new()
	retrato_ui.set_anchors_preset(Control.PRESET_FULL_RECT)
	retrato_ui.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	retrato_ui.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	var sh := Shader.new()
	sh.code = "shader_type canvas_item;\nvoid fragment(){ vec4 c = texture(TEXTURE, UV); float r = length(UV - vec2(0.5)); COLOR = vec4(c.rgb, c.a * (1.0 - smoothstep(0.47, 0.49, r))); }"
	var mat := ShaderMaterial.new()
	mat.shader = sh
	retrato_ui.material = mat
	moldura.add_child(retrato_ui)
	var aro := Panel.new()
	aro.set_anchors_preset(Control.PRESET_FULL_RECT)
	aro.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sa := StyleBoxFlat.new()
	sa.bg_color = Color(0, 0, 0, 0)
	sa.border_color = Color(0.9, 0.75, 0.4)
	sa.set_border_width_all(3)
	sa.set_corner_radius_all(48)
	sa.anti_aliasing = true
	aro.add_theme_stylebox_override("panel", sa)
	moldura.add_child(aro)
	# meio: quem é e o que disse
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.add_theme_constant_override("separation", 3)
	lado.add_child(txt)
	nome_ui = Menu.rotulo("", 22, Menu.OURO_CLARO)
	txt.add_child(nome_ui)
	papel_ui = Menu.rotulo("", 13, Menu.APAGADO)
	txt.add_child(papel_ui)
	var linha := ColorRect.new()
	linha.color = Menu.BORDA
	linha.custom_minimum_size = Vector2(0, 1)
	txt.add_child(linha)
	fala_ui = Menu.rotulo("", 15, Menu.TEXTO)
	fala_ui.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	fala_ui.custom_minimum_size = Vector2(250, 0)
	txt.add_child(fala_ui)
	# direita: o que dá para fazer, em duas colunas (a janela fica baixa, uns 170 px)
	opcoes = GridContainer.new()
	opcoes.columns = 2
	opcoes.add_theme_constant_override("h_separation", 6)
	opcoes.add_theme_constant_override("v_separation", 6)
	opcoes.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	lado.add_child(opcoes)

func aberto() -> bool:
	return raiz != null and raiz.visible

# o NPC mais perto (até "metros"), ou null
func npc_perto(metros := PERTO):
	if m.heroi == null:
		return null
	var achou = null
	var md := metros
	for n in m.npcs:
		var d := _dist(n)
		if d < md and abs(n.no.position.y - m.heroi.position.y) < 2.0:
			md = d
			achou = n
	return achou

func _dist(n: Dictionary) -> float:
	return Vector2(n.no.position.x - m.heroi.position.x, n.no.position.z - m.heroi.position.z).length()

# botão Falar da HUD
func tocar_botao() -> void:
	var n = npc_perto()
	if n != null:
		abrir(n)

# toque rápido na tela (sem arrastar): se foi num NPC, abre a janela (perto) ou vai até ele (longe)
func tocou_tela(pos: Vector2) -> void:
	if aberto() or m.menu.aberto() or m.h.morto > 0.0 or m.camera == null:
		return
	var achou = null
	var md := 1e9
	for n in m.npcs:
		var d := _dist(n)
		if d > 35.0:
			continue
		var pe: Vector3 = n.no.position
		var cabeca: Vector3 = pe + Vector3.UP * 1.75
		if m.camera.is_position_behind(pe) or m.camera.is_position_behind(cabeca):
			continue
		var a: Vector2 = m.camera.unproject_position(pe)
		var b: Vector2 = m.camera.unproject_position(cabeca)
		var largura: float = max(34.0, (a.y - b.y) * 0.3) # meio corpo para cada lado (longe fica fácil de acertar)
		if pos.y < b.y - 14.0 or pos.y > a.y + 14.0 or abs(pos.x - lerp(a.x, b.x, 0.5)) > largura:
			continue
		if d < md:
			md = d
			achou = n
	if achou == null:
		return
	if md <= PERTO:
		abrir(achou)
		return
	indo = {"npc": achou, "ate": m.tempo + 3.0 + md / 3.0, "d": md, "t": m.tempo}
	m.hud.aviso("Indo até %s" % _curto(achou))

# para onde o herói anda sozinho (main.direcao_joystick), ou zero
func direcao_auto() -> Vector3:
	if indo == null:
		return Vector3.ZERO
	var d: Vector3 = indo.npc.no.position - m.heroi.position
	d.y = 0
	return d.normalized() * (1.0 if d.length() > 6.0 else 0.55) # longe corre, perto anda

func _process(dt: float) -> void:
	if m.heroi == null:
		return
	if indo != null:
		var d := _dist(indo.npc)
		if m.hud.mover.length() > 0.15 or m.tempo > indo.ate or not m.acao.is_empty() or m.h.morto > 0.0 or m.menu.aberto():
			indo = null # mexeu no joystick, fez outra coisa ou não chegou
		elif d <= CHEGOU:
			var n = indo.npc
			indo = null
			abrir(n)
		elif m.tempo - indo.t > 1.2: # a cada 1,2 s precisa ter chegado mais perto (casa ou pedra no meio)
			if d > indo.d - 0.4:
				m.hud.aviso("Não achei caminho até %s" % _curto(indo.npc))
				indo = null
			else:
				indo.d = d
				indo.t = m.tempo
	if npc != null:
		# o NPC vira para o herói enquanto conversa e volta para onde olhava depois
		var alvo: float = atan2(m.heroi.position.x - npc.no.position.x, m.heroi.position.z - npc.no.position.z)
		npc.no.rotation.y = lerp_angle(npc.no.rotation.y, alvo, min(1.0, dt * 6.0))
		if _dist(npc) > 4.5 or m.h.morto > 0.0:
			fechar()
	for n in m.npcs:
		if n != npc and n.has("ry0"):
			n.no.rotation.y = lerp_angle(n.no.rotation.y, float(n.ry0), min(1.0, dt * 3.0))

# "Tomás, o ferreiro" -> "Tomás"
func _curto(n: Dictionary) -> String:
	return str(n.get("nome", "")).get_slice(",", 0)

func abrir(n: Dictionary) -> void:
	if m.menu.aberto():
		return
	indo = null
	if m.trabalho.coletando != null:
		m.trabalho.parar(true)
	npc = n
	if not n.has("ry0"):
		n.ry0 = n.no.rotation.y
	# o herói vira para o NPC
	var ry: float = atan2(n.no.position.x - m.heroi.position.x, n.no.position.z - m.heroi.position.z)
	m.mov.ry = ry
	m.mov.ry_mira = null
	m.heroi.rotation.y = ry
	var nome := str(n.get("nome", ""))
	nome_ui.text = nome.get_slice(",", 0)
	var papel := nome.get_slice(",", 1).strip_edges() if nome.contains(",") else ""
	papel_ui.text = (papel.substr(0, 1).to_upper() + papel.substr(1)) if papel != "" else "" # "O ferreiro"
	var falas: Array = n.get("falas", [])
	fala_ui.text = str(falas[0]) if falas.size() > 0 else "..."
	if n.funcao == "loja":
		fala_ui.text = "Dá uma olhada no que eu tenho. E se quiser vender algo, eu compro."
	elif n.funcao == "passe": # o Gaspar diz do que precisa e quanto você já tem
		fala_ui.text = _fala_passe()
	elif n.funcao == "resetar" and falas.size() > 0:
		fala_ui.text = "%s Custa %d de ouro." % [falas[0], m.custo_reset()]
	for c in opcoes.get_children():
		opcoes.remove_child(c)
		c.queue_free()
	for a in n.get("acoes", []):
		if not ACOES.has(a):
			continue
		var t: String = ACOES[a][0]
		if a == "missao" and str(n.get("missao", "")) != "":
			t = "Missão: %s" % n.missao
		elif a == "consertar":
			var custo: int = m.P.custo_conserto_tudo()
			t = ("Consertar · %d ouro" % custo) if custo > 0 else "Consertar (tudo inteiro)"
		opcoes.add_child(_opcao(t, ACOES[a][1], func(): escolher(a)))
	opcoes.add_child(_opcao("Conversar", "falar", func(): escolher("conversar")))
	opcoes.add_child(_opcao("Até logo", "sair", fechar))
	retrato_ui.texture = _retrato(n)
	_aberto_ms = Time.get_ticks_msec()
	raiz.visible = true
	m.hud.bloqueado = true
	m.hud.esconder_combate = true
	m.cam.olhar_conversa(m.heroi.position, n.no.position)
	m.sons.tocar("pano", -10.0)

func fechar() -> void:
	if raiz == null or not raiz.visible:
		return
	raiz.visible = false
	if npc != null and _retratos.has(npc.id):
		_retratos[npc.id].render_target_update_mode = SubViewport.UPDATE_DISABLED
	npc = null
	m.hud.esconder_combate = false
	m.cam.soltar_conversa()
	if not m.menu.aberto():
		m.hud.bloqueado = false

func _opcao(t: String, ic: String, fn: Callable) -> Button:
	var b := Button.new()
	b.text = t
	b.focus_mode = Control.FOCUS_NONE
	b.alignment = HORIZONTAL_ALIGNMENT_LEFT
	b.custom_minimum_size = Vector2(196, 36)
	b.add_theme_font_size_override("font_size", 15)
	b.add_theme_constant_override("icon_max_width", 22)
	b.add_theme_constant_override("h_separation", 10)
	if ic != "":
		b.icon = Menu.icone_tex(ic)
	Menu.estilo_botao(b, false)
	b.pressed.connect(func(): if _toque_valido(): fn.call())
	return b

# uma opção da janela
func escolher(a: String) -> void:
	if npc == null:
		return
	var n: Dictionary = npc
	match a:
		"comprar":
			fechar()
			m.menu.abrir("loja")
		"vender": # a mochila abre já marcando itens para vender (André 2026-11-04); Pronto volta ao Vender de um em um
			fechar()
			m.menu.abrir("mochila")
			m.menu.modo_vender(true)
			m.hud.aviso("%s compra: marque os itens ou Selecionar tudo" % _curto(n))
		"forja":
			fechar()
			m.menu.abrir("profissoes", "fer")
		"alfaiate":
			fechar()
			m.menu.abrir("profissoes", "alf")
		"habilidades":
			fechar()
			m.menu.abrir("habilidades")
		"consertar": # tudo o que desgastou, no corpo e na mochila, de uma vez (online o servidor confere e cobra)
			var custo: int = m.P.custo_conserto_tudo()
			if custo <= 0:
				fala_ui.text = "Seu equipamento está inteiro. Volte quando ele apanhar lá fora."
			elif int(m.P.prog.ouro) < custo:
				fala_ui.text = "Esse conserto sai por %d de ouro. Você tem %d." % [custo, int(m.P.prog.ouro)]
			elif m.on():
				m.rede("item", {"acao": "consertar"})
				fala_ui.text = "Pronto, ficou como novo. São %d de ouro." % custo
				m.sons.tocar("forja", -4.0)
			else:
				var r: String = m.P.consertar_tudo()
				fala_ui.text = "Pronto, ficou como novo. São %d de ouro." % custo
				m.hud.aviso(r)
				m.sons.tocar("forja", -4.0)
			_atualizar_consertar()
		"passe": # faz um passe com o material dos monstros (o servidor confere e gasta; a resposta chega em fala())
			if not m.on():
				fala_ui.text = "Sem conexão com o servidor eu não posso fazer o passe. Volte depois."
			elif _falta_passe() != "":
				fala_ui.text = "Ainda falta: %s. Os monstros carregam isso, é só caçar." % _falta_passe()
			else:
				m.rede("item", {"acao": "fazer_passe"})
				m.sons.tocar("forja", -6.0)
		"resetar":
			fechar()
			if m.on():
				m.rede("falar", {"npc": n.id}) # ele responde com o preço e a janela de confirmar abre (online.gd "fala")
			else:
				m.menu.perguntar_reset(m.custo_reset())
		"missao", "cura":
			if m.on():
				m.rede("falar", {"npc": n.id}) # a resposta chega em fala()
			elif a == "cura":
				m.h.vida = m.P.st.vidaMax
				m.h.mana = m.P.st.manaMax
				m.fx.cura(m.heroi)
				fala_ui.text = "Pronto, novinho em folha. Vá com cuidado lá fora."
			else:
				fala_ui.text = "As missões só valem online (o progresso fica na sua conta)."
		"conversar":
			if m.on():
				m.rede("falar", {"npc": n.id, "conversa": true})
			else:
				var falas: Array = n.get("falas", [])
				if falas.size() > 0:
					var i: int = (int(_falas.get(n.id, 0)) + 1) % falas.size()
					_falas[n.id] = i
					fala_ui.text = str(falas[i])

# depois de consertar o botão mostra o preço novo (online o progresso chega um instante depois)
func _atualizar_consertar() -> void:
	await get_tree().create_timer(0.6).timeout
	if npc == null:
		return
	for b in opcoes.get_children():
		if b is Button and str(b.text).begins_with("Consertar"):
			var custo: int = m.P.custo_conserto_tudo()
			b.text = ("Consertar · %d ouro" % custo) if custo > 0 else "Consertar (tudo inteiro)"

# o servidor respondeu ("fala"): se a janela desse NPC está aberta, a fala aparece nela. true = mostrou aqui
func fala(npc_id: String, texto: String) -> bool:
	if npc == null or str(npc.id) != npc_id:
		return false
	fala_ui.text = texto
	return true

# rosto do NPC: o modelo dele num palco pequeno (192 px), câmera na altura da cabeça. Fica pronto na
# primeira conversa e só desenha enquanto a janela dele está aberta.
func _retrato(n: Dictionary) -> Texture2D:
	if _retratos.has(n.id):
		_retratos[n.id].render_target_update_mode = SubViewport.UPDATE_ALWAYS
		return _retratos[n.id].get_texture()
	var vp := SubViewport.new()
	vp.size = Vector2i(192, 192)
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_4X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(vp)
	var amb := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.16, 0.13, 0.1)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.85, 0.8, 0.72)
	env.ambient_light_energy = 0.7
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	amb.environment = env
	vp.add_child(amb)
	var sol := DirectionalLight3D.new()
	sol.light_energy = 1.1
	sol.rotation = Vector3(-0.5, 0.5, 0)
	vp.add_child(sol)
	var corpo: Node3D = m.modelo(str(n.get("modelo", "vivi")))
	corpo.get_parent().remove_child(corpo)
	vp.add_child(corpo)
	corpo.position = Vector3.ZERO
	corpo.rotation = Vector3.ZERO
	if not (n.get("aparencia", {}) as Dictionary).is_empty(): # mesma pintura do NPC no mundo
		Aparencia.aplicar(corpo, n.aparencia)
	VisualNpc.vestir(corpo, str(n.id), n.get("info", {}))
	var cab := Vector3(0, 1.45, 0)
	var esq: Skeleton3D = m.esqueleto(corpo)
	if esq:
		for i in esq.get_bone_count():
			var nb := esq.get_bone_name(i).to_lower()
			if nb.ends_with("head") or nb == "cabeca":
				cab = esq.get_bone_global_rest(i).origin
				break
	cab *= corpo.scale.y # NPC mais alto ou mais baixo (tinta: escala)
	var c := Camera3D.new()
	c.fov = 30.0
	vp.add_child(c)
	c.position = cab + Vector3(0.12, 0.03, 0.75)
	c.look_at_from_position(c.position, cab + Vector3(0, -0.01, 0))
	_retratos[n.id] = vp
	return vp.get_texture()

# ---------- Gaspar, o guardião da Caverna da Montanha (receita em shared/dados.js CAVERNA_DUNGEON.passe) ----------
func _receita_passe() -> Dictionary:
	var dg = m.mundo.get("dungeon")
	return dg.passe if dg != null else {}

func _tenho(k: String) -> int:
	var n := 0
	for it in m.P.prog.mochila:
		if it is Dictionary and str(it.get("k", "")) == k and not it.has("h"):
			n += int(it.get("n", 1))
	return n

func _nome_item(k: String) -> String:
	return str(m.P.dados.itens.get(k, {}).get("nome", k))

func _falta_passe() -> String:
	var l := []
	var r := _receita_passe()
	for k in r:
		var falta := int(r[k]) - _tenho(k)
		if falta > 0:
			l.append("%d %s" % [falta, _nome_item(k)])
	return ", ".join(l)

func _fala_passe() -> String:
	var r := _receita_passe()
	var l := []
	for k in r:
		l.append("%d %s (tem %d)" % [int(r[k]), _nome_item(k), _tenho(k)])
	return "Ninguém passa do selo sem passe. Um passe sai por %s. Cada passe abre o selo uma vez." % ", ".join(l)

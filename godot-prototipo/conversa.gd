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
	"forja": ["Bigorna e forninho (você cria)", "pf_fer"], # 2026-11-11: leva até a estação pública, o NPC não cria
	"consertar": ["Consertar", "cs_bigorna"], # durabilidade (penalidade de morte, André 2026-11-05)
	"alfaiate": ["Bancada de costura (você cria)", "pf_alf"],
	"habilidades": ["Habilidades", "basico"],
	"missao": ["Missão", "it_tomo"],
	"cura": ["Curar", "cura"],
	"resetar": ["Resetar build", "desfazer"],
	"passe": ["Fazer passe da caverna", "it_passe_caverna"], # Gaspar, na boca da Caverna da Montanha (2026-11-06)
	"pack": ["Packs (fazer e entregar)", "it_pack"], # mercadores de pack (FASE 1, transporte.gd)
	"alquimia": ["Sintetizar catalisador", "it_selo_epico"], # Mirela, a alquimista (André 2026-11-09)
	"leilao": ["Leilão (comprar e vender)", "negociar"], # Otávio, na Casa do Comércio do Rio Claro (história v2, Entrega 3)
	# Cecília, a amiga (shared/amiga.js, André 2026-11-09): o servidor decide o que ela responde
	"amiga_casa": ["Como vai a casa?", "lote"],
	"amiga_ajuda": ["Precisa de ajuda?", "falar"],
	"amiga_time": ["Chamar para o time", "basico"],
	"amiga_sair": ["Sair do time", "desfazer"],
	"amiga_dungeon": ["Vamos na caverna?", "it_passe_caverna"],
	"amiga_troca": ["Quer trocar itens?", "it_ouro"],
	"amiga_equip": ["Ver equipamento", "basico"],
}
const AMIGA_BOTOES := ["amiga_casa", "amiga_ajuda", "amiga_time", "amiga_dungeon", "amiga_troca", "amiga_equip"]
var _amiga := {} # id -> a Cecília ou o Dario vistos como NPC da janela (o corpo vem do online.gd, como outro jogador)
var _amiga_pedido = null # o que ela pediu ({k, n, nome}): aparece o botão Dar
var _amiga_time := false # ela está no meu time: o botão vira "Sair do time" (fase 2)

var m # main.gd
var raiz: Control
var caixa_ui: PanelContainer
var nome_ui: Label
var papel_ui: Label
var fala_ui: Label
var itens_ui: HBoxContainer # material do passe do Gaspar, em ícones (André 2026-11-06: mostrar os itens, não escrever)
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
	itens_ui = HBoxContainer.new()
	itens_ui.add_theme_constant_override("separation", 8)
	itens_ui.visible = false
	txt.add_child(itens_ui)
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
	for n in _com_amiga():
		var d := _dist(n)
		if d < md and abs(n.no.position.y - m.heroi.position.y) < 2.0:
			md = d
			achou = n
	return achou

func _dist(n: Dictionary) -> float: # folga: o totem é largo (conta da beira da pedra)
	return Vector2(n.no.position.x - m.heroi.position.x, n.no.position.z - m.heroi.position.z).length() - float(n.get("folga", 0.0))

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
	for n in _com_amiga():
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

# os NPCs da vila e, para o dono dela, a Cecília (um jogador do servidor com bot: o corpo é o do online.gd)
func _com_amiga() -> Array:
	var l: Array = m.npcs
	if m.totem: # totens de teleporte (totem.gd): a pedra abre a janela como um NPC
		l = l + m.totem.como_npcs()
	if not m.on():
		return l
	for aid in m.online.amiga_ids: # a Cecília e o Dario (André 2026-11-11)
		var a = _amiga_npc(str(aid))
		if a != null:
			l = l + [a]
	return l

func _amiga_npc(aid: String):
	var o = m.online.outros.get(aid)
	if o == null or not is_instance_valid(o.get("no")) or not o.no.visible:
		return null
	if not _amiga.has(aid):
		_amiga[aid] = {"id": aid, "nome": "%s, %s" % [str(o.get("nome", "Cecília")), str(m.online.amiga_papeis.get(aid, "a guerreira"))], "funcao": "amiga", "amiga": true,
			"acoes": [], "falas": [], "modelo": str(o.get("visual", "victoria")), "aparencia": {}, "info": {"roupa": str(o.get("roupa", ""))}}
	var a: Dictionary = _amiga[aid]
	a.no = o.no
	if a.aparencia.is_empty() and o.get("ap", "") != "": # as cores (as mesmas do corpo no mundo), para o retrato
		var ap = JSON.parse_string(str(o.ap))
		if ap is Dictionary:
			a.aparencia = Aparencia.valida(ap, m.P.dados.criador)
	return a

# botões da conversa com a Cecília (o Dar aparece quando ela pediu alguma coisa)
func _botoes_amiga() -> void:
	for c in opcoes.get_children():
		opcoes.remove_child(c)
		c.queue_free()
	var nid: String = str(npc.id) if npc != null else "" # qual amigo: Cecília ou Dario (o servidor responde com a cabeça dele)
	if _amiga_pedido is Dictionary:
		var p: Dictionary = _amiga_pedido
		opcoes.add_child(_opcao("Dar %d %s" % [int(p.n), str(p.nome).to_lower()], "it_" + str(p.k), func(): m.rede("amiga", {"acao": "dar", "id": nid})))
	for a0 in AMIGA_BOTOES:
		var a: String = "amiga_sair" if a0 == "amiga_time" and _amiga_time else a0
		var acao: String = a.trim_prefix("amiga_")
		if a == "amiga_equip": # ver o equipamento dela (o mesmo de qualquer jogador, troca.gd)
			opcoes.add_child(_opcao(ACOES[a][0], ACOES[a][1], func(): fechar(); m.troca.pedir_equip(nid)))
			continue
		opcoes.add_child(_opcao(ACOES[a][0], ACOES[a][1], func(): m.rede("amiga", {"acao": acao, "id": nid})))
	opcoes.add_child(_opcao("Até logo", "sair", func(): m.rede("amiga", {"acao": "tchau", "id": nid}); fechar()))

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
			abrir(n, false)
		elif m.tempo - indo.t > 1.2: # a cada 1,2 s precisa ter chegado mais perto (casa ou pedra no meio)
			if d > indo.d - 0.4:
				m.hud.aviso("Não achei caminho até %s" % _curto(indo.npc))
				indo = null
			else:
				indo.d = d
				indo.t = m.tempo
	_reabrir()
	if npc != null and not is_same(m.P.hist_info, _hi_visto): # chegou progresso novo com a janela aberta
		_botao_missao()
	if npc != null:
		# o NPC vira para o herói enquanto conversa e volta para onde olhava depois
		var alvo: float = atan2(m.heroi.position.x - npc.no.position.x, m.heroi.position.z - npc.no.position.z)
		if npc.funcao != "totem": # a pedra não vira
			npc.no.rotation.y = lerp_angle(npc.no.rotation.y, alvo, min(1.0, dt * 6.0))
		if _dist(npc) > 4.5 or m.h.morto > 0.0:
			fechar()
	for n in m.npcs:
		if n != npc and n.has("ry0"):
			n.no.rotation.y = lerp_angle(n.no.rotation.y, float(n.ry0), min(1.0, dt * 3.0))

# "Tomás, o ferreiro" -> "Tomás"
func _curto(n: Dictionary) -> String:
	return str(n.get("nome", "")).get_slice(",", 0)

# toque = a janela abriu por um toque agora (botão Falar, toque no NPC perto): os toques dos primeiros ESPERA_TOQUE ms
# são ignorados. Abrindo sozinha (chegou andando, o Ir da missão chegou) não tem toque nenhum para filtrar: antes o
# primeiro toque em "Missão" logo que a janela aparecia era jogado fora e precisava tocar de novo (robô das missões).
func abrir(n: Dictionary, toque := true) -> void:
	if m.menu.aberto():
		return
	indo = null
	if n.funcao == "totem" and m.minimapa: # totem de teleporte (André 2026-11-11): abre o mapa mundi com os totens acesos
		m.minimapa.abrir_totem(n.totem)
		m.sons.tocar("q_anel_1", -14.0)
		return
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
	elif n.funcao == "passe": # o Gaspar mostra o material do passe em ícones, com quanto você já tem
		fala_ui.text = _fala_passe()
	elif n.funcao == "pack" and m.transporte: # mercador de pack: material, quanto paga em cada um e o que dá para entregar
		fala_ui.text = m.transporte.opcoes_mercador(n)[0]
	elif n.funcao == "alquimia":
		fala_ui.text = "Traga catalisadores fracos e ouro, que eu faço um mais forte. Até o Lendário."
	elif n.funcao == "resetar" and falas.size() > 0:
		fala_ui.text = "%s Custa %d de ouro." % [falas[0], m.custo_reset()]
	_itens_passe(n.funcao == "passe")
	if n.funcao == "totem": # totem de teleporte: os destinos com a taxa no lugar das opções
		_destinos_totem(n)
		retrato_ui.texture = Menu.icone_tex("salto_arcano")
		retrato_ui.modulate = Color("8fe2ff") # o traço branco do ícone fica azul das runas
		_aberto_ms = Time.get_ticks_msec() if toque else -ESPERA_TOQUE
		raiz.visible = true
		m.hud.bloqueado = true
		m.hud.esconder_combate = true
		m.cam.olhar_conversa(m.heroi.position, n.no.position)
		m.sons.tocar("q_anel_1", -14.0)
		return
	if n.get("amiga", false): # Cecília: o servidor responde (shared/amiga.js) e os botões são os dela
		fala_ui.text = "..."
		_amiga_pedido = null # o pedido e o time são de cada amigo: a resposta do servidor traz os deste
		_amiga_time = false
		m.rede("amiga", {"acao": "oi", "id": str(n.id)})
		_botoes_amiga()
	for c in (opcoes.get_children() if not n.get("amiga", false) else []):
		opcoes.remove_child(c)
		c.queue_free()
	# história v2 (André 2026-11-11): o NPC com quem a missão principal quer falar agora ganha o botão da missão, primeiro
	_btn_missao = null
	_botao_missao()
	for a in (n.get("acoes", []) if not n.get("amiga", false) else []):
		if not ACOES.has(a):
			continue
		var t: String = ACOES[a][0]
		if a == "missao" and str(n.get("missao", "")) != "":
			t = "Missão: %s" % n.missao
		elif a == "consertar":
			var custo: int = m.P.custo_conserto_tudo()
			t = ("Consertar · %d ouro" % custo) if custo > 0 else "Consertar (tudo inteiro)"
		opcoes.add_child(_opcao(t, ACOES[a][1], func(): escolher(a)))
	if not n.get("amiga", false):
		opcoes.add_child(_opcao("Conversar", "falar", func(): escolher("conversar")))
		opcoes.add_child(_opcao("Até logo", "sair", fechar))
	retrato_ui.texture = _retrato(n)
	retrato_ui.modulate = Color.WHITE
	_aberto_ms = Time.get_ticks_msec() if toque else -ESPERA_TOQUE
	raiz.visible = true
	m.hud.bloqueado = true
	m.hud.esconder_combate = true
	m.cam.olhar_conversa(m.heroi.position, n.no.position)
	m.sons.tocar("pano", -10.0)

# O botão "Missão: ..." (história v2) acompanha o servidor com a janela aberta: o progresso que chega um instante
# depois de abrir (subiu de nível, terminou a etapa lá fora, rede lenta) faz o botão aparecer ou sumir na hora. Antes
# ele só mudava fechando e abrindo a janela de novo (robô das missões, André 2026-11-12).
var _btn_missao: Button = null
var _hi_visto = null # o hist_info que o botão já mostra (progresso.gd troca o dicionário a cada pacote)
func _quer_missao() -> String:
	if npc == null or npc.get("amiga", false) or npc.funcao == "totem" or not m.on():
		return ""
	var hi: Dictionary = m.P.hist_info
	return "Missão: %s" % str(hi.get("nome", "")) if str(hi.get("npc", "")) == str(npc.id) else ""

func _botao_missao() -> void:
	_hi_visto = m.P.hist_info
	var t := _quer_missao()
	if _btn_missao != null and (not is_instance_valid(_btn_missao) or _btn_missao.is_queued_for_deletion() or _btn_missao.get_parent() != opcoes):
		_btn_missao = null
	if t == "":
		if _btn_missao != null:
			opcoes.remove_child(_btn_missao)
			_btn_missao.queue_free()
			_btn_missao = null
		return
	if _btn_missao == null:
		_btn_missao = _opcao(t, "it_tomo", func(): escolher("historia"))
		opcoes.add_child(_btn_missao)
		opcoes.move_child(_btn_missao, 0)
	elif _btn_missao.text != t:
		_btn_missao.text = t

# Depois do toque em "Missão" a janela fecha (André 2026-11-12). Se a resposta do servidor deixa a próxima conversa com
# o mesmo NPC (entregou e ele já tem a próxima missão; aceitou e a etapa é entregar a ele), a janela volta sozinha com o
# botão, em vez de pedir Ir e Missão de novo. Só se o progresso mudou (o "Ainda falta" fica só no aviso).
var _depois: Dictionary = {}
var _depois_fala := {} # npc -> o que ele respondeu com a janela fechada (aparece quando ela reabre)
const REABRE := 2.5 # s esperando a resposta

func _reabrir() -> void:
	if _depois.is_empty():
		return
	var n: Dictionary = _depois.n
	if m.tempo > float(_depois.ate) or aberto() or m.h.morto > 0.0 or not is_instance_valid(n.get("no")):
		_depois = {}
		return
	if m.menu.aberto() or (m.cinematica and m.cinematica.ativa):
		return # espera a cena ou o menu (até REABRE)
	var hi: Dictionary = m.P.hist_info
	if JSON.stringify(hi) == str(_depois.hi):
		return # a resposta ainda não chegou
	_depois = {}
	var t := str(_depois_fala.get(str(n.id), ""))
	_depois_fala.clear()
	if str(hi.get("npc", "")) == str(n.id) and _dist(n) <= 4.0:
		abrir(n, false)
		if t != "":
			fala_ui.text = t

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
		"forja": # André 2026-11-11 ("não criar no próprio NPC"): vai até a bigorna da ferraria e cria lá
			fechar()
			m.construcao.ir_publica("fer")
		"alfaiate": # e a bancada ao lado da Rosa
			fechar()
			m.construcao.ir_publica("alf")
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
		"pack": # FASE 1: as opções do mercador (fazer o pack, entregar o das costas, do carrinho ou do porão)
			var r: Array = m.transporte.opcoes_mercador(n)
			fala_ui.text = r[0]
			for c in opcoes.get_children():
				opcoes.remove_child(c)
				c.queue_free()
			for o in r[1]:
				var fn: Callable = o[2]
				opcoes.add_child(_opcao(str(o[0]), str(o[1]), func(): fn.call(); escolher.call_deferred("pack_volta")))
			opcoes.add_child(_opcao("Até logo", "sair", fechar))
		"pack_volta": # depois de fazer/entregar, a lista refaz quando o servidor responde (o progresso chega um instante depois)
			await get_tree().create_timer(0.5).timeout
			if npc == n:
				escolher("pack")
		"leilao": # Otávio: a janela da Casa do Comércio abre quando o servidor responde (leilao_ui.gd)
			if not m.on():
				fala_ui.text = "Sem conexão com o servidor o leilão fica fechado. Volte depois."
			else:
				m.leilao.pedir({"acao": "ver"})
		"alquimia": # Mirela: a lista de sínteses (Selo e Runa, Épico e Lendário) no lugar das opções
			_lista_alquimia(n)
		"alquimia_volta": # depois de sintetizar, refaz a lista quando o servidor responde (mochila e ouro chegam depois)
			await get_tree().create_timer(0.6).timeout
			if npc == n:
				_lista_alquimia(n, false)
		"passe": # faz um passe com o material dos monstros (o servidor confere e gasta; a resposta chega em fala())
			if not m.on():
				fala_ui.text = "Sem conexão com o servidor eu não posso fazer o passe. Volte depois."
			elif _falta_passe() != "":
				fala_ui.text = "Ainda falta o que está em vermelho. Os monstros carregam isso, é só caçar."
			else:
				m.rede("item", {"acao": "fazer_passe"})
				m.sons.tocar("forja", -6.0)
				_itens_passe.call_deferred(true) # a mochila muda quando o servidor responde; refaz já e de novo na fala
		"resetar":
			fechar()
			if m.on():
				m.rede("falar", {"npc": n.id}) # ele responde com o preço e a janela de confirmar abre (online.gd "fala")
			else:
				m.menu.perguntar_reset(m.custo_reset())
		"historia": # missão principal: aceitar, cumprir a etapa de falar ou entregar (o servidor responde em fala())
			m.rede("falar", {"npc": n.id, "missao": true})
			m.sons.tocar("q_anel_1", -14.0)
			_missao_iniciada()
		"missao", "cura":
			if m.on():
				m.rede("falar", {"npc": n.id}) # a resposta chega em fala()
				if a == "missao":
					_missao_iniciada()
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

# André 2026-11-12: "iniciar a missão, fecha, já aparece a barrinha lá". Tocou na missão: a janela do NPC fecha na hora
# (antes ficava aberta e tocar de novo travava), a resposta do NPC vira aviso na tela (online.gd "fala") e a barrinha da
# missão ativa (missao_ativa.gd) pisca para mostrar onde está o "Ir".
func _missao_iniciada() -> void:
	if npc != null:
		_depois = {"n": npc, "hi": JSON.stringify(m.P.hist_info), "ate": m.tempo + REABRE}
		_depois_fala.clear()
	fechar()
	if m.missao_ativa != null:
		m.missao_ativa.destacar()

# Totem de teleporte (André 2026-11-10, totem.gd): os outros totens, cada um com a taxa; o que ainda não foi visitado
# a pé aparece trancado. Tocar num destino fecha a janela e começa a viagem (volta_vila.gd pedir_totem).
func _destinos_totem(n: Dictionary) -> void:
	var de: Dictionary = n.totem
	var ouro := int(m.P.prog.get("ouro", 0))
	fala_ui.text = "As runas brilham. Para onde você quer ir? Você tem %d de ouro." % ouro
	for c in opcoes.get_children():
		opcoes.remove_child(c)
		c.queue_free()
	for t in m.totem.T.lista:
		if str(t.id) == str(de.id):
			continue
		var tt: Dictionary = t
		var ok: bool = m.totem.descoberto(str(t.id))
		var b := _opcao("%s · %d" % [t.nome, m.totem.taxa(t)] if ok else "%s (visite a pé)" % t.nome, "salto_arcano" if ok else "cadeado",
func(): _ir_totem(de, tt))
		b.tooltip_text = str(t.get("faixa", ""))
		if not ok:
			b.modulate = Color(1, 1, 1, 0.55)
		elif m.totem.taxa(t) > ouro:
			b.modulate = Color(1, 0.75, 0.7)
		opcoes.add_child(b)
	opcoes.add_child(_opcao("Até logo", "sair", fechar))

func _ir_totem(de: Dictionary, para: Dictionary) -> void:
	var r: String = m.totem.ir(de, para)
	if r != "":
		fala_ui.text = r

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
func fala(npc_id: String, texto: String, ev := {}) -> bool:
	if not _depois.is_empty() and str(_depois.n.id) == npc_id:
		_depois_fala[npc_id] = texto
	if npc == null or str(npc.id) != npc_id:
		return false
	fala_ui.text = texto
	if npc.get("amiga", false): # Cecília: pediu alguma coisa (ou não pede mais) -> o botão Dar aparece ou some
		var p = ev.get("pedido")
		var no_time: bool = ev.get("noTime", false) == true
		if JSON.stringify(p) != JSON.stringify(_amiga_pedido) or no_time != _amiga_time:
			_amiga_pedido = p
			_amiga_time = no_time
			_botoes_amiga()
	if itens_ui.visible:
		_itens_passe(true)
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
	return "Ninguém passa do selo sem passe. Traga isto e eu faço um. Cada passe abre o selo uma vez."

# os itens do passe em ícones: cada um com "tem/precisa" (verde quando já tem tudo, vermelho quando falta), uma seta
# e o passe que sai
func _itens_passe(mostrar: bool) -> void:
	for c in itens_ui.get_children():
		itens_ui.remove_child(c)
		c.queue_free()
	itens_ui.visible = mostrar
	if not mostrar:
		return
	var r := _receita_passe()
	for k in r:
		var tem := _tenho(k)
		var precisa := int(r[k])
		itens_ui.add_child(_slot_item(k, "%d/%d" % [mini(tem, 99), precisa], Menu.VERDE if tem >= precisa else Color(0.92, 0.38, 0.32)))
	var seta := Menu.rotulo("›", 26, Menu.OURO_CLARO)
	seta.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	itens_ui.add_child(seta)
	itens_ui.add_child(_slot_item("passe_caverna", "x%d" % _tenho("passe_caverna"), Menu.OURO_CLARO))

func _slot_item(k: String, conta: String, cor: Color) -> Control:
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 2)
	col.tooltip_text = _nome_item(k)
	var caixa := PanelContainer.new()
	caixa.add_theme_stylebox_override("panel", Menu.caixa(Menu.FUNDO3, cor.darkened(0.2), 2, 7))
	caixa.custom_minimum_size = Vector2(54, 50)
	caixa.mouse_filter = Control.MOUSE_FILTER_STOP # no celular não tem tooltip: tocar mostra o nome (André 2026-11-09)
	caixa.gui_input.connect(func(ev: InputEvent):
		if ev is InputEventMouseButton and ev.button_index == MOUSE_BUTTON_LEFT and not ev.pressed:
			Menu.balao_nome(caixa, _nome_item(k)))
	var ic := TextureRect.new()
	ic.texture = Menu.icone_tex("it_" + k)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.custom_minimum_size = Vector2(40, 40)
	caixa.add_child(ic)
	col.add_child(caixa)
	var n := Menu.rotulo(conta, 16, cor) # "tem/precisa", ex.: 2/4
	n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(n)
	return col

# ---------- Mirela, a alquimista (André 2026-11-09; números em CATALISADOR.sintese, shared/dados.js) ----------
# Junta n catalisadores de uma raridade + ouro e faz 1 da raridade de cima, do mesmo tipo. Só até Lendário (Mítico
# nunca). Cada botão faz 1; "Fazer o máximo" liga e desliga fazer quantos der de uma vez (até o lote). Online só:
# o servidor confere a distância, os catalisadores e o ouro, e responde com a fala dela.
var _alq_max := false

func _lista_alquimia(n: Dictionary, falar := true) -> void:
	var C: Dictionary = m.P.dados.get("catalisador", {})
	var S = C.get("sintese")
	for c in opcoes.get_children():
		opcoes.remove_child(c)
		c.queue_free()
	if S == null:
		fala_ui.text = "O caldeirão ainda está frio. Volte depois."
	else:
		if falar:
			fala_ui.text = "Escolha o catalisador. Mostro quanto você tem de cada um. Mítico eu não faço."
		for tipo in ["armadura", "arma"]:
			for r in range(2, int(S.ate) + 1):
				var custo = S.custo[r]
				if custo == null:
					continue
				var k: String = str(C[tipo][r - 1])
				var de: String = str(C[tipo][r - 2])
				var tem := _tenho(de)
				var da := mini(tem / int(custo.n), int(m.P.prog.ouro) / int(custo.ouro))
				var t := "%s\n%d %s (tem %d) + %d ouro" % [_nome_item(k), int(custo.n), _nome_item(de), tem, int(custo.ouro)]
				var b := _opcao(t, "it_" + k, func(): _sintetizar(n, k, da))
				b.custom_minimum_size = Vector2(250, 52)
				b.add_theme_font_size_override("font_size", 13)
				b.add_theme_constant_override("icon_max_width", 30)
				if da < 1:
					b.modulate = Color(1, 1, 1, 0.55)
				opcoes.add_child(b)
	opcoes.add_child(_opcao("Fazer o máximo: %s" % ("sim" if _alq_max else "não"), "it_ouro", func():
		_alq_max = not _alq_max
		_lista_alquimia(n, false)))
	opcoes.add_child(_opcao("Voltar", "desfazer", func(): abrir(n)))

func _sintetizar(n: Dictionary, k: String, da: int) -> void:
	if not m.on():
		fala_ui.text = "Sem conexão com o servidor o caldeirão não acende. Volte depois."
		return
	if da < 1:
		fala_ui.text = "Ainda não dá: falta catalisador ou ouro. O que está apagado é o que falta."
		return
	var quantos: int = mini(da, int(m.P.dados.catalisador.sintese.lote)) if _alq_max else 1
	m.rede("item", {"acao": "sintetizar", "k": k, "n": quantos})
	m.sons.tocar("magia", -6.0)
	escolher.call_deferred("alquimia_volta")


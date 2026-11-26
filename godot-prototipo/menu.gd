extends CanvasLayer
# Menu do personagem (ideia do Quimera, com cara mais adulta): abre tocando no painel de vida.
# Esquerda: o herói em 3D (arrasta para girar) com os 6 lugares de equipamento (Camisa, Calça, Botas | Arma, Acessório, Capa).
# Direita: abas Status (nível, XP, pontos de atributo e os números do herói) e Habilidades (Espada, Cajado e Gerais,
# com nível de cada skill, o que melhora no próximo e em qual botão de cada barra ela fica). Passivas no fim.
# Duas barras como no Quimera: a da espada e a do cajado (Trocar mostra a outra); toque em dois botões da barra para
# trocar de lugar. Quem decide é o servidor (online manda "atributo" e "barra"); sem internet muda só neste celular.
# Mochila (páginas de 10 x 4, até 4 páginas) e Loja da Rosa (Parte 2 do Quimera): toque num item para ver, equipar, usar ou vender; toque num lugar
# de equipamento para ver a peça e tirar. Online quem decide é o servidor (manda "item"); sem internet muda só aqui.
# Profissões (Parte 3 do Quimera): vigor, ouro e o nível de cada profissão; Ferreiro e Alfaiate com as receitas
# (Criar só perto da forja do Tomás ou da banca da Rosa; online quem confere e dá a peça é o servidor, mensagem "criar").
# André 2026-11-04: o menu ficou em dois. Tocar na barra de vida abre o do personagem (Status, Habilidades, Profissões
# e Aparência); o botão da mochila no menu do topo abre o da bolsa (Mochila e Criar, e a Loja perto de quem vende).
# Criar mostra tudo o que se cria no jogo, em submenus (Materiais, Armas, Armaduras, Estações, Casa, Móveis,
# Ferramentas): o que precisa de bigorna, fornalha ou bancada diz onde, e dá para ver mas só criar lá.
# A lista rola arrastando o dedo (feito aqui em _input: as linhas e os botões não deixavam o ScrollContainer rolar).

const Armadura = preload("res://armadura.gd")
const Titulos = preload("res://titulos.gd") # cores e enfeites dos títulos (aba Títulos)
const Idioma = preload("res://idioma.gd") # Português ou English (Configurações > Idioma / Language)
const OURO := Color(0.80, 0.64, 0.36)
const OURO_CLARO := Color(0.95, 0.82, 0.55)
const TEXTO := Color(0.93, 0.89, 0.80)
const APAGADO := Color(0.72, 0.68, 0.60) # #b8ae9a
const FUNDO := Color(0.075, 0.065, 0.055, 0.97)
const FUNDO2 := Color(0.12, 0.105, 0.088, 1.0)
const FUNDO3 := Color(0.17, 0.148, 0.12, 1.0)
const BORDA := Color(0.42, 0.33, 0.20, 1.0)
const VERDE := Color(0.45, 0.78, 0.45)

const ARVORES := {"espada": "Espada", "cajado": "Cajado", "geral": "Gerais"}
const ARVORE_TXT := {
	"espada": "Com a espada na mão. Escala com Força. Cada skill sobe de nível usando.",
	"cajado": "Com o cajado na mão. Escala com Inteligência. Cada skill sobe de nível usando.",
	"geral": "Servem com a espada e com o cajado. Cada skill sobe de nível usando.",
}
const PLURAL := ["Comuns", "Raras", "Épicas", "Lendárias", "Míticas"] # "3 peças Raras (ou melhores)"
# Lugares do corpo (pedido do André, diferente do Quimera): cada um é um medalhão redondo em volta do boneco, na
# altura da parte do corpo, ligado a ela por um fio dourado. [id, nome, x, y (fração do palco), osso, lado do texto]
const SLOTS := [
	["cabeca", "Capacete", 0.17, 0.1, "J_Bip_C_Head", -1], ["corpo", "Camisa", 0.1, 0.34, "J_Bip_C_UpperChest", -1],
	["pernas", "Calça ou Short", 0.1, 0.58, "J_Bip_R_UpperLeg", -1], ["pes", "Botas", 0.17, 0.82, "J_Bip_R_Foot", -1],
	["capa", "Capa", 0.83, 0.16, "J_Bip_L_Shoulder", 1], ["acessorio", "Acessório", 0.9, 0.4, "J_Bip_C_Neck", 1],
	["arma", "Arma", 0.85, 0.64, "J_Bip_L_Hand", 1]]
const MEDALHAO := 52.0
# abas de cada menu (André 2026-11-04): barra de vida = personagem; botão da mochila no topo = bolsa
# André 2026-11-12: aba Títulos (títulos com bônus; um em uso por vez)
const ABAS_PERSONAGEM := ["status", "habilidades", "profissoes", "titulos", "aparencia"]
# André 2026-11-11: Missões saiu do menu do personagem e ganhou ícone no menu do topo (abre só ela)
const ABAS_MISSOES := ["missoes", "diarias", "guilda", "cla_missoes"] # História e Diárias (André 2026-11-16); Guilda (2026-11-18)
const ABAS_CLA := ["cla"] # clã e recrutas (André 2026-11-22), janela própria
const ABAS_BOLSA := ["mochila", "criar", "recipedia", "loja"] # Recipedia: todas as receitas para consultar (André 2026-11-21)
# submenus da aba Criar
# "aqui" (André 2026-11-05: "unificar os menus"): o botão de ação da mesa abre esta mesma aba Criar no submenu do que
# a estação perto faz (Alfaiate e móveis na bancada, Ferreiro na bigorna, barras na fornalha); só aparece perto de uma.
const CATS_CRIAR := [["aqui", "Aqui"], ["materiais", "Materiais"], ["armas", "Armas"], ["armaduras", "Armaduras"], ["comida", "Comida"], ["estacoes", "Estações"],
	["casa", "Casa"], ["moveis", "Móveis"], ["ferramentas", "Ferramentas"]]
const NOME_ESTACAO := {"fornalha": "Fornalha", "bigorna": "Bigorna", "bancada": "Bancada de trabalho", "fogao": "Fogão a lenha"}

var m # main.gd
var raiz: Control
var aba := "status"
var arvore := "espada"
var conteudo: VBoxContainer
var rolagem: ScrollContainer
var botoes_aba := {}
var botoes_arvore := {}
var linha_arvores: HBoxContainer
var linha_prof: HBoxContainer
var botoes_prof := {}
var sub_prof := "lista" # aba Profissões: "lista", "fer" (Ferreiro) ou "alf" (Alfaiate)
const SUB_PROF := {"lista": "Profissões", "fer": "Ferreiro", "alf": "Alfaiate"}
var cat_criar := "materiais" # submenu aberto na aba Criar
var rar_criar := {} # receita -> raridade escolhida nas abas Armas e Armaduras (André 2026-11-09)
# Criar igual ao Quimera (André 2026-11-09, com print do Quimera: "eu quero exatamente assim"): Buscar, as estações
# perto em cima para alternar (Ver tudo = todas), e grupos sanfona (ARMADURAS, ARMAS...) com "dá para criar/total".
# André 2026-11-09: sem grupo Melhorar; evoluir/reforçar fica dentro de Armaduras (bancada) e de Armas (bigorna)
const GRUPOS_CRIAR := [["armaduras", "Armaduras"], ["armas", "Armas"], ["ferramentas", "Ferramentas"],
	["materiais", "Materiais"], ["comida", "Comida"], ["estacoes", "Estações"], ["casa", "Casa"], ["moveis", "Móveis"]]
var est_criar := "" # estação escolhida em cima ("" = Ver tudo)
var busca_criar := ""
var grupos_abertos := {} # grupo -> aberto
var lista_criar: VBoxContainer # só a lista se refaz ao digitar na busca (a caixa não perde o foco)
var linha_criar: HBoxContainer
var botoes_criar := {}
var titulo_nivel: Label
var vp: SubViewport
var boneco: Node3D
var boneco_anim: AnimationPlayer
var boneco_modo := ""
var esp: Node3D
var caj: Node3D
var giro := 0.4
var arrastando := false
var slot_arma: Dictionary = {}
var slots_ui := {} # lugar -> {icone, painel, no}
var fios: Control # fios dourados dos medalhões até o corpo
var cam_palco: Camera3D
var sel_mochila := -1 # item escolhido na mochila
var pag_mochila := 0 # página da mochila aberta (0..3; André 2026-11-03: 4 páginas de 10 x 4, compradas com ouro)
var sel_equip := "" # peça escolhida no corpo (lugar)
# André 2026-11-12: no celular o cartão do item ficava embaixo da grade e tinha que rolar. Agora o item escolhido abre
# num painel por cima do boneco (lado esquerdo), com letra maior; o ouro mora ao lado do nome do personagem.
var painel_item: PanelContainer
var painel_rolagem: ScrollContainer
var painel_corpo: VBoxContainer
var ouro_esq: HBoxContainer
var ferramentas_bolsa: HBoxContainer # Organizar, Filtro e Vender vários na fileira das abas (só na Mochila)
var _segurou_ms := -1 # segurar um item (perto de quem compra) liga o Vender vários com ele marcado
# André 2026-11-04: perto de quem compra (Rosa, Tomás) dá para marcar vários itens, ou Selecionar tudo, e vender de uma vez
var vendendo := false # modo de marcar itens para vender
var marcados := {} # lugar da mochila -> true
# André 2026-11-18: conserto do Tomás na tela do equipamento (modo_consertar): peças marcadas para consertar
var consertando := false
var marc_conserto := {} # "l:<lugar>" ou "i:<lugar da mochila>" -> {"lugar": l} ou {"i": i}
# André 2026-11-07: filtro de coleta (botão Filtro da mochila). O que está desmarcado não entra na mochila (o servidor decide)
var filtro_aberto := false
var filtro_lista := false # lista de todos os recursos aberta
var _confirma: Control # janelinha "tem certeza?" (apagar item, vender vários)
# André 2026-11-03: tocar num lugar do corpo abre a janela da peça: Tirar (vai para a mochila; dá para ficar só com a
# roupa de baixo) e a lista das peças da mochila que servem ali, comparadas com a vestida (melhor ou pior), com Trocar
var janela: Control # véu escuro + painel da peça (por cima do menu)
var janela_lugar := "" # lugar aberto ("" = fechada)
var janela_nome := ""
var janela_rolagem: ScrollContainer
var quadradinhos: Array = [] # "Mostrar capacete" (André 2026-11-03: quadradinho marcado = capacete aparece; desmarcado = rosto à mostra, a peça continua vestida)
var _sel = null # botão da barra escolhido para trocar de lugar: [barra, i]
# Menu do recruta (André 2026-11-24: "no 'ver' recruta... ter acesso a toda sua interface, poder entrar nos status, no
# inventário, verificar profissões, tudo, só não vou poder editar nada, somente visual... vou precisar de um botão sair
# porque agora todo o menu vai ser dele"). O servidor manda o progresso do recruta (shared/cla.js fichaVer, evento
# claFicha); o menu inteiro lê P_menu, que é o progresso dele enquanto ver_rec está ligado. Só olhando: nada sai para o
# servidor (rede) e nenhuma ação muda nada (_so_olhando). "Sair" volta para o seu menu.
const Progresso = preload("res://progresso.gd")
const Aparencia = preload("res://aparencia.gd")
const ABAS_RECRUTA := ["status", "habilidades", "profissoes", "titulos", "mochila", "criar", "recipedia"]
var ver_rec := {} # {id, nome, visual, aparencia, mundo} do recruta aberto; vazio = o seu menu
var _pede_rec := {} # {id, nome, de: "cla" | "espiar"}: pedido feito, esperando o servidor
var P_rec = null # progresso.gd do recruta (cópia, nunca grava)
var cab_titulo: Label
var bt_sair: Button
var P_menu:
	get:
		return P_rec if P_rec != null and not ver_rec.is_empty() else m.P

func vendo_recruta() -> bool:
	return P_rec != null and not ver_rec.is_empty()

# ação no menu do recruta: só avisa (nada muda, nada vai para o servidor)
func _so_olhando() -> bool:
	if not vendo_recruta():
		return false
	_avisar_motivo("Só olhando: o menu de %s não pode ser mudado" % str(ver_rec.get("nome", "")))
	return true

# tudo que o menu manda ao servidor passa aqui; no menu do recruta não sai nada
func rede(tipo: String, dados = null) -> void:
	if _so_olhando():
		return
	m.rede(tipo, dados)

# "Ver menu" no painel do clã ou "Menu dele" na faixa do Ver: pede o progresso dele ao servidor
func pedir_recruta(rid: String, nome: String, de: String) -> void:
	if not m.on():
		m.hud.aviso("O menu do recruta só abre online")
		return
	_pede_rec = {"id": rid, "nome": nome, "de": de}
	m.rede("cla", {"acao": "fichaVer", "id": rid})

# chegou do servidor (online.gd, evento claFicha)
func ver_recruta(ev: Dictionary) -> void:
	if _pede_rec.is_empty() or str(_pede_rec.get("id", "")) != str(ev.get("rid", "")):
		if not (vendo_recruta() and str(ver_rec.get("id", "")) == str(ev.get("rid", ""))):
			return # pedido velho (já saiu ou pediu outro)
	var de := str(_pede_rec.get("de", ver_rec.get("de", "cla")))
	_pede_rec = {}
	var p = ev.get("prog")
	if not (p is Dictionary):
		return
	var R = Progresso.new()
	if ev.has("agora"):
		R.relogio = float(ev.agora) - Time.get_unix_time_from_system() * 1000.0
	R.definir(p.duplicate(true))
	if ev.get("st") is Dictionary:
		for k in ev.st:
			R.st[k] = float(ev.st[k])
	R.carrinho_no_mundo() # (estático) volta ao do herói no Sair
	P_rec = R
	var ap = ev.get("aparencia")
	ver_rec = {"id": str(ev.rid), "nome": str(ev.get("nome", "Recruta")), "de": de, "mundo": bool(ev.get("mundo", false)),
		"visual": m.corpo_valido(str(ev.get("visual", "ruiva"))) if m.has_method("corpo_valido") else str(ev.get("visual", "ruiva")),
		"aparencia": Aparencia.valida(ap, m.P.dados.criador) if ap is Dictionary else {}}
	sel_mochila = -1
	sel_equip = ""
	_sel = null
	_pend.clear()
	fechar_confirma()
	fechar_janela(false)
	vendendo = false
	marcados = {}
	consertando = false
	marc_conserto = {}
	trocar_boneco()
	if aberto():
		aba = "status"
		atualizar()
		rolagem.scroll_vertical = 0
	else:
		abrir("status")

# Sair: volta para o seu menu (veio do painel do clã: a aba Clã; veio do Ver: fecha e continua vendo ele)
func sair_recruta(fechar_tudo := false) -> void:
	if not vendo_recruta():
		return
	var de := str(ver_rec.get("de", "cla"))
	_limpar_recruta()
	if fechar_tudo:
		return
	if de == "cla":
		abrir("cla")
	else:
		fechar()

func _limpar_recruta() -> void:
	ver_rec = {}
	_pede_rec = {}
	P_rec = null
	m.P.carrinho_no_mundo() # o carrinho/navio "no mundo" é estático em progresso.gd: volta ao do herói
	sel_mochila = -1
	sel_equip = ""
	_sel = null
	fechar_confirma()
	fechar_janela(false)
	trocar_boneco()

# o corpo do boneco do menu: o do recruta enquanto vê o menu dele
func _visual_boneco() -> String:
	return str(ver_rec.get("visual", m.visual)) if vendo_recruta() else str(m.visual)

func _aparencia_boneco() -> Dictionary:
	return ver_rec.get("aparencia", {}) if vendo_recruta() else m.aparencia
var _arrastou := false # o dedo arrastou a lista: o botão embaixo dele não vale
var _arrasto_dentro := false
var _arrasto_soma := 0.0
var _rol_painel := false

func _init(principal) -> void:
	m = principal
	layer = 20 # acima da tela de login e do status online

func _ready() -> void:
	raiz = Control.new()
	raiz.set_anchors_preset(Control.PRESET_FULL_RECT)
	raiz.visible = false
	add_child(raiz)
	var escuro := ColorRect.new()
	escuro.color = Color(0, 0, 0, 0.55)
	escuro.set_anchors_preset(Control.PRESET_FULL_RECT)
	raiz.add_child(escuro)
	# moldura principal
	var moldura := Panel.new()
	moldura.set_anchors_preset(Control.PRESET_FULL_RECT)
	moldura.offset_left = 22
	moldura.offset_top = 14
	moldura.offset_right = -22
	moldura.offset_bottom = -14
	moldura.add_theme_stylebox_override("panel", caixa(FUNDO, OURO.darkened(0.25), 2, 10, 14))
	raiz.add_child(moldura)
	var tudo := HBoxContainer.new()
	tudo.set_anchors_preset(Control.PRESET_FULL_RECT)
	tudo.offset_left = 18
	tudo.offset_top = 14
	tudo.offset_right = -18
	tudo.offset_bottom = -14
	tudo.add_theme_constant_override("separation", 18)
	moldura.add_child(tudo)
	esquerda = montar_esquerda()
	tudo.add_child(esquerda)
	tudo.add_child(montar_direita())
	# fechar (canto de cima à direita)
	var x := Fechar.new()
	x.position = Vector2(-50, 8)
	x.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	x.offset_left = -56
	x.offset_top = 4
	x.offset_right = -8
	x.offset_bottom = 52
	x.gui_input.connect(func(ev): if (ev is InputEventMouseButton and ev.pressed) or (ev is InputEventScreenTouch and ev.pressed): fechar())
	x.set_meta("guia", "fechar") # guia das missões (guia.gd): pisca quando o menu está no grupo errado
	moldura.add_child(x)

# ---------- peças de estilo ----------
# barra de rolar larga, fácil de pegar com o dedo (André 2026-11-07: na mochila cheia o toque caía nos itens)
static func barra_larga(sc: ScrollContainer, largura := 22) -> void:
	var vb := sc.get_v_scroll_bar()
	if OS.has_feature("mobile"): # celular: só um risquinho dourado, a lista rola arrastando o dedo (André 2026-11-25)
		largura = 6
		vb.mouse_filter = Control.MOUSE_FILTER_IGNORE
	vb.custom_minimum_size.x = largura
	var trilho := StyleBoxFlat.new()
	trilho.bg_color = Color(0.03, 0.026, 0.022, 0.9)
	trilho.set_corner_radius_all(int(largura / 2.0))
	trilho.content_margin_left = largura / 2.0
	trilho.content_margin_right = largura / 2.0
	vb.add_theme_stylebox_override("scroll", trilho)
	vb.add_theme_stylebox_override("scroll_focus", trilho)
	for e in [["grabber", 0.55], ["grabber_highlight", 0.75], ["grabber_pressed", 0.95]]:
		var g := StyleBoxFlat.new()
		g.bg_color = Color(OURO, e[1])
		g.set_corner_radius_all(int(largura / 2.0))
		g.border_color = Color(0.03, 0.026, 0.022, 0.9)
		g.set_border_width_all(3 if largura > 10 else 0) # um respiro dentro do trilho (o risquinho do celular não tem)
		vb.add_theme_stylebox_override(e[0], g)

const RAIO_JANELA := 16 # cantos das janelas pop-up (André 2026-11-11)

static func caixa(cor: Color, borda: Color, b := 1, raio := 6, sombra := 0) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = cor
	s.border_color = borda
	s.set_border_width_all(b)
	# André 2026-11-11: "qualquer janela pop-up ... com as pontinhas mais arredondadas". Toda caixa com sombra é
	# janela flutuante (pop-up, painel da bancada, baú, troca, conversa, menu): raio mínimo 16. Cor e o resto iguais.
	if sombra > 0:
		raio = max(raio, RAIO_JANELA)
	s.set_corner_radius_all(raio)
	if sombra > 0:
		s.shadow_color = Color(0, 0, 0, 0.55)
		s.shadow_size = sombra
	s.content_margin_left = 10
	s.content_margin_right = 10
	s.content_margin_top = 6
	s.content_margin_bottom = 6
	return s

# André 2026-11-09: "clicou ali aquela barra, já aparece barra de ferro". Balãozinho com o nome do item em cima do
# ícone tocado, dentro do próprio menu (o aviso da HUD fica atrás do menu aberto e ninguém via). Só o nome, nada de
# "onde conseguir" (para não poluir). Some sozinho em 2,5 s ou no próximo toque em outro ícone.
static func balao_nome(alvo: Control, texto: String, cor := OURO_CLARO) -> void:
	var camada: Node = alvo
	while camada != null and not (camada is CanvasLayer):
		camada = camada.get_parent()
	if camada == null:
		return
	var velho = camada.get_meta("balao_nome") if camada.has_meta("balao_nome") else null
	if velho != null and is_instance_valid(velho):
		velho.queue_free()
	var bx := PanelContainer.new()
	bx.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bx.add_theme_stylebox_override("panel", caixa(Color(0.06, 0.052, 0.042, 0.96), Color(cor, 0.9), 2, 8, 6))
	var l := rotulo(texto, 20, cor)
	l.add_theme_constant_override("outline_size", 4)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.7))
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bx.add_child(l)
	bx.modulate.a = 0.0
	camada.add_child(bx)
	camada.set_meta("balao_nome", bx)
	await bx.get_tree().process_frame # tamanho certo só depois de entrar na árvore
	if not is_instance_valid(bx) or not is_instance_valid(alvo):
		if is_instance_valid(bx):
			bx.queue_free()
		return
	var r := alvo.get_global_rect()
	var tela := bx.get_viewport().get_visible_rect().size
	var pos := Vector2(r.get_center().x - bx.size.x * 0.5, r.position.y - bx.size.y - 6)
	if pos.y < 4: # sem espaço em cima: vai para baixo do ícone
		pos.y = r.end.y + 6
	pos.x = clampf(pos.x, 4, tela.x - bx.size.x - 4)
	bx.position = pos
	var tw := bx.create_tween()
	tw.tween_property(bx, "modulate:a", 1.0, 0.1)
	tw.tween_interval(2.4)
	tw.tween_property(bx, "modulate:a", 0.0, 0.25)
	tw.tween_callback(bx.queue_free)

# letras legíveis no celular (conselho de auditoria 2026-11-13, Mestra Moldura: mais da metade das letras tinha 10 a 14):
# 10 e 11 sobem 2; 12 e 13 sobem 1; de 14 para cima ficam iguais. Vale para todo rotulo() e botao() do jogo.
static func legivel(tam: int) -> int:
	return tam + 2 if tam <= 11 else (tam + 1 if tam <= 13 else tam)

static func rotulo(t: String, tam := 15, cor := TEXTO) -> Label:
	var l := Label.new()
	l.text = Idioma.frase(t) # inglês (idioma.gd): frase inteira ou modelo com {1}
	l.add_theme_font_size_override("font_size", legivel(tam))
	l.add_theme_color_override("font_color", cor)
	return l

func botao(t: String, fn: Callable, tam := 15, ativo := false) -> Button:
	var b := Button.new()
	b.text = Idioma.frase(t)
	b.set_meta("pt", t) # o guia das missões acha o botão pelo texto em português
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", legivel(tam))
	estilo_botao(b, ativo)
	b.pressed.connect(func():
		if not _arrastou:
			fn.call())
	return b

# André 2026-11-07: botão travado (apagado/vermelho) não fica mudo. Tocar nele chama fn, que mostra o motivo
# (sem vigor, mochila cheia, falta material, nível, ouro...). O Godot não solta "pressed" com o botão travado,
# mas o toque ainda chega no gui_input.
static func ao_tocar_travado(b: BaseButton, fn: Callable) -> void:
	b.gui_input.connect(func(e: InputEvent): _toque_travado(b, e, fn))

static func _toque_travado(b: BaseButton, e: InputEvent, fn: Callable) -> void:
	if b.disabled and e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT and not e.pressed:
		fn.call()

static func estilo_botao(b: Button, ativo: bool) -> void:
	var n := caixa(FUNDO3 if ativo else FUNDO2, OURO if ativo else BORDA, 1, 6)
	var p := caixa(FUNDO3.lightened(0.08), OURO_CLARO, 1, 6)
	var d := caixa(Color(0.1, 0.09, 0.08, 0.9), Color(0.25, 0.21, 0.16), 1, 6)
	# botão mais alto para o dedo (conselho 2026-11-13: botões de cerca de 4 mm): 2 px a mais em cima e embaixo
	for s in [n, p, d]:
		s.content_margin_top += 2
		s.content_margin_bottom += 2
	b.add_theme_stylebox_override("normal", n)
	b.add_theme_stylebox_override("hover", n)
	b.add_theme_stylebox_override("pressed", p)
	b.add_theme_stylebox_override("disabled", d)
	b.add_theme_color_override("font_color", OURO_CLARO if ativo else TEXTO)
	b.add_theme_color_override("font_hover_color", OURO_CLARO if ativo else TEXTO)
	b.add_theme_color_override("font_pressed_color", OURO_CLARO)
	b.add_theme_color_override("font_disabled_color", Color(0.4, 0.37, 0.32))

# Menus (André 2026-11-13: "quando abro os menus tem um lag grande, tipo um delay"): cada abertura refaz o conteúdo e
# os ícones saíam da memória quando o menu fechava, então toda abertura lia de novo do disco (~9 ms no PC só na
# Mochila). Agora cada ícone é lido uma vez e fica guardado (são poucos e pequenos).
static var _icones := {}
static func icone_tex(nome: String) -> Texture2D:
	if not _icones.has(nome):
		_icones[nome] = _icone_tex_ler(nome)
	return _icones[nome]

static func _icone_tex_ler(nome: String) -> Texture2D:
	if nome.begins_with("it_") and ResourceLoader.exists("res://icones/itens/%s.png" % nome.substr(3)):
		return load("res://icones/itens/%s.png" % nome.substr(3)) # item pintado (godot-prototipo/icones/itens)
	if nome != "" and ResourceLoader.exists("res://icones/pintados/%s.png" % nome):
		return load("res://icones/pintados/%s.png" % nome) # construção, profissões e ferramentas pintados (2026-11-06); o .svg de traço fica de reserva
	if nome.begins_with("it_semente_") and not ResourceLoader.exists("res://icones/%s.svg" % nome):
		return icone_tex("it_semente")
	return load("res://icones/%s.svg" % nome) if nome != "" else null

# cor para o modulate de um ícone: o desenho de traço (.svg, branco) toma a cor pedida; o pintado guarda as cores
# dele e só escurece (apagado) ou fica transparente junto
static func tinta(tex: Texture2D, cor: Color) -> Color:
	if tex == null or tex.resource_path.ends_with(".svg"):
		return cor
	var v: float = clamp(cor.v * 1.15, 0.0, 1.0) if cor.s < 0.25 else 1.0
	return Color(v, v, v, cor.a)

# ---------- moldura dos itens: fundo com o brilho da cor da raridade, aro na cor e faixa embaixo (como no Quimera) ----------
static var _fundos := {}
static func fundo_raridade(cor: Color) -> GradientTexture2D:
	var k := cor.to_html()
	if not _fundos.has(k):
		var g := Gradient.new()
		g.offsets = PackedFloat32Array([0.0, 0.5, 1.0])
		g.colors = PackedColorArray([Color(cor, 0.62).lerp(Color.WHITE, 0.08), Color(cor.darkened(0.45), 0.55), Color(0.035, 0.03, 0.028, 1)])
		var t := GradientTexture2D.new()
		t.gradient = g
		t.fill = GradientTexture2D.FILL_RADIAL
		t.fill_from = Vector2(0.5, 0.58)
		t.fill_to = Vector2(1.08, 1.12)
		t.width = 64
		t.height = 64
		_fundos[k] = t
	return _fundos[k]

# põe (ou troca) a moldura num quadrado de item; cor = raridade; destaque = escolhido
func moldurar(q: Control, cor: Color, destaque: bool, com_item: bool, raio := 8, forte := false) -> void:
	q.clip_children = CanvasItem.CLIP_CHILDREN_AND_DRAW
	for n in ["_fundo", "_brilho", "_faixa", "_aro"]:
		var v := q.get_node_or_null(n)
		if v:
			q.remove_child(v)
			v.queue_free()
	if com_item:
		var f := TextureRect.new()
		f.name = "_fundo"
		f.texture = fundo_raridade(cor)
		f.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		f.stretch_mode = TextureRect.STRETCH_SCALE
		f.set_anchors_preset(Control.PRESET_FULL_RECT)
		f.mouse_filter = Control.MOUSE_FILTER_IGNORE
		q.add_child(f)
		q.move_child(f, 0)
		# reflexo de vidro na metade de cima
		var b := ColorRect.new()
		b.name = "_brilho"
		b.color = Color(1, 1, 1, 0.05)
		b.set_anchors_preset(Control.PRESET_TOP_WIDE)
		b.anchor_bottom = 0.42
		b.mouse_filter = Control.MOUSE_FILTER_IGNORE
		q.add_child(b)
		q.move_child(b, 1)
		var fx := ColorRect.new()
		fx.name = "_faixa"
		fx.color = cor
		fx.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
		fx.offset_top = -3
		fx.mouse_filter = Control.MOUSE_FILTER_IGNORE
		q.add_child(fx)
	var aro := Panel.new()
	aro.name = "_aro"
	aro.mouse_filter = Control.MOUSE_FILTER_IGNORE
	aro.set_anchors_preset(Control.PRESET_FULL_RECT)
	var st := StyleBoxFlat.new()
	st.draw_center = false
	st.set_corner_radius_all(raio)
	if destaque:
		st.border_color = OURO_CLARO
		st.set_border_width_all(5 if forte else 3) # forte: medalhão com a janela da peça aberta
	elif com_item:
		st.border_color = cor.lightened(0.1)
		st.set_border_width_all(2)
	else:
		st.border_color = Color(0.22, 0.18, 0.13)
		st.set_border_width_all(1)
	aro.add_theme_stylebox_override("panel", st)
	q.add_child(aro)

# ---------- esquerda: herói 3D e equipamentos ----------
var esquerda: Control # some na aba Clã (André 2026-11-23: "painel de administração do clã... não faz sentido ter meus equipamentos")
func montar_esquerda() -> Control:
	var col := VBoxContainer.new()
	col.custom_minimum_size = Vector2(430, 0)
	col.add_theme_constant_override("separation", 6)
	var cab := HBoxContainer.new()
	cab.add_theme_constant_override("separation", 10)
	cab_titulo = rotulo("PERSONAGEM", 13, OURO)
	cab_titulo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cab_titulo.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	cab.add_child(cab_titulo)
	bt_sair = botao("Sair", func(): sair_recruta(), 15, true) # menu do recruta: volta para o seu (André 2026-11-24)
	bt_sair.custom_minimum_size = Vector2(110, 38)
	bt_sair.visible = false
	cab.add_child(bt_sair)
	col.add_child(cab)
	var linha_nome := HBoxContainer.new()
	titulo_nivel = rotulo("", 20, TEXTO)
	titulo_nivel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	linha_nome.add_child(titulo_nivel)
	ouro_esq = HBoxContainer.new() # ouro do lado do personagem (André 2026-11-12); preenchido em atualizar()
	ouro_esq.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	linha_nome.add_child(ouro_esq)
	col.add_child(linha_nome)
	# manequim: o boneco no meio de tudo e os medalhões soltos em volta, cada um ligado à parte do corpo
	var meio := Control.new()
	meio.size_flags_vertical = Control.SIZE_EXPAND_FILL
	meio.clip_contents = true
	col.add_child(meio)
	var palco := SubViewportContainer.new()
	palco.stretch = true
	palco.set_anchors_preset(Control.PRESET_FULL_RECT)
	palco.mouse_filter = Control.MOUSE_FILTER_STOP
	palco.gui_input.connect(_girar)
	vp = SubViewport.new()
	vp.own_world_3d = true
	vp.transparent_bg = true
	vp.msaa_3d = Viewport.MSAA_2X
	vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	vp.process_mode = Node.PROCESS_MODE_DISABLED # FPS 2026-11-12: o boneco do menu fechado não anima à toa
	palco.add_child(vp)
	meio.add_child(palco)
	fios = Control.new()
	fios.set_anchors_preset(Control.PRESET_FULL_RECT)
	fios.mouse_filter = Control.MOUSE_FILTER_IGNORE
	fios.draw.connect(_desenhar_fios)
	meio.add_child(fios)
	get_tree().process_frame.connect(fios.queue_redraw)
	for d in SLOTS:
		var s := slot(d[0], d[1], d[5])
		s.anchor_left = d[2]
		s.anchor_right = d[2]
		s.anchor_top = d[3]
		s.anchor_bottom = d[3]
		s.offset_left = -MEDALHAO * 0.5
		s.offset_right = MEDALHAO * 0.5
		s.offset_top = -MEDALHAO * 0.5 - 6
		s.offset_bottom = MEDALHAO * 0.5 - 6
		meio.add_child(s)
		if d[0] == "cabeca":
			var q := linha_mostrar_capacete(12)
			q.anchor_left = d[2]
			q.anchor_right = d[2]
			q.anchor_top = d[3]
			q.anchor_bottom = d[3]
			q.offset_left = -50
			q.offset_right = 70
			q.offset_top = MEDALHAO * 0.5 + 16
			q.offset_bottom = MEDALHAO * 0.5 + 40
			meio.add_child(q)
	meio.add_child(montar_painel_item())
	var pe := HBoxContainer.new()
	pe.add_theme_constant_override("separation", 10)
	var dica := rotulo("Arraste o personagem para girar", 12, APAGADO)
	dica.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	dica.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	dica.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	pe.add_child(dica)
	# o botão Aparência (criador sem o nome: cores, altura e rosto) virou aba do menu do personagem (André 2026-11-04)
	col.add_child(pe)
	montar_palco()
	return col

# painel do item escolhido (André 2026-11-12): por cima do boneco, tudo à vista sem rolar a mochila. Enquanto ele está
# aberto o boneco 3D não é desenhado (o painel cobre ele todo; poupa o celular).
func montar_painel_item() -> Control:
	painel_item = PanelContainer.new()
	painel_item.set_anchors_preset(Control.PRESET_FULL_RECT)
	painel_item.mouse_filter = Control.MOUSE_FILTER_STOP
	painel_item.add_theme_stylebox_override("panel", caixa(Color(0.07, 0.062, 0.052, 1), BORDA, 1, 10))
	painel_item.visible = false
	painel_rolagem = ScrollContainer.new()
	painel_rolagem.set_meta("arrasto_proprio", true) # rola pelo _input daqui (rolagem_toque.gd só dá a inércia)
	painel_rolagem.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	painel_item.add_child(painel_rolagem)
	painel_corpo = VBoxContainer.new()
	painel_corpo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	painel_rolagem.add_child(painel_corpo)
	return painel_item

func mostrar_painel(c: Control) -> void:
	if painel_item == null:
		return
	for f in painel_corpo.get_children():
		painel_corpo.remove_child(f)
		f.queue_free()
	painel_item.visible = c != null
	if c != null:
		painel_corpo.add_child(c)
		painel_rolagem.scroll_vertical = 0
	if aberto():
		vp.render_target_update_mode = SubViewport.UPDATE_DISABLED if c != null else SubViewport.UPDATE_ALWAYS

func fechar_item() -> void:
	sel_mochila = -1
	sel_equip = ""
	atualizar()

# lugar de equipamento: moldura escura com o nome; a arma mostra a que está na mão (o resto vem com a mochila)
func slot(id: String, nome: String, lado := 1) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(MEDALHAO, MEDALHAO)
	c.size = Vector2(MEDALHAO, MEDALHAO)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var p := Panel.new()
	p.set_anchors_preset(Control.PRESET_FULL_RECT)
	p.add_theme_stylebox_override("panel", caixa(Color(0.05, 0.045, 0.04, 1), BORDA, 1, int(MEDALHAO * 0.5)))
	var ic := TextureRect.new()
	ic.set_anchors_preset(Control.PRESET_FULL_RECT)
	ic.offset_left = 8
	ic.offset_top = 8
	ic.offset_right = -8
	ic.offset_bottom = -8
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.modulate = Color(1, 1, 1, 0.9)
	p.add_child(ic)
	c.add_child(p)
	# nome do lado de fora (do lado oposto ao boneco), em cima de uma linha fina
	var l := rotulo(nome, 12, APAGADO)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	l.offset_left = -60
	l.offset_right = 60
	l.offset_top = 2
	l.offset_bottom = 18
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.add_child(l)
	# durabilidade da peça vestida (André 2026-11-17): filete no pé do medalhão e o número "70/100" embaixo, só depois
	# da primeira pancada. Quebrada: medalhão vermelho com "QUEBRADA" (antes só a mochila mostrava)
	var veu := Panel.new()
	veu.set_anchors_preset(Control.PRESET_FULL_RECT)
	veu.add_theme_stylebox_override("panel", caixa(Color(0.6, 0.05, 0.03, 0.42), Color("e0452e"), 2, int(MEDALHAO * 0.5)))
	veu.mouse_filter = Control.MOUSE_FILTER_IGNORE
	veu.visible = false
	c.add_child(veu)
	var qb := rotulo("QUEBRADA", 9, Color("ffd2c8"))
	qb.add_theme_constant_override("outline_size", 4)
	qb.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	qb.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	qb.position = Vector2(-10, MEDALHAO * 0.5 - 8)
	qb.size = Vector2(MEDALHAO + 20, 16)
	qb.mouse_filter = Control.MOUSE_FILTER_IGNORE
	qb.visible = false
	c.add_child(qb)
	var df := ColorRect.new()
	df.color = Color(0, 0, 0, 0.7)
	df.position = Vector2(MEDALHAO * 0.24, MEDALHAO - 9)
	df.size = Vector2(MEDALHAO * 0.56, 5)
	df.mouse_filter = Control.MOUSE_FILTER_IGNORE
	df.visible = false
	c.add_child(df)
	var db := ColorRect.new()
	db.position = df.position + Vector2(1, 1)
	db.size = Vector2(df.size.x - 2, 3)
	db.mouse_filter = Control.MOUSE_FILTER_IGNORE
	db.visible = false
	c.add_child(db)
	var dn := rotulo("", 11, TEXTO)
	dn.add_theme_constant_override("outline_size", 4)
	dn.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	dn.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	dn.position = Vector2(-10, MEDALHAO - 23)
	dn.size = Vector2(MEDALHAO + 20, 14)
	dn.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.add_child(dn)
	# reforço da peça vestida (André 2026-11-09: "+N" para saber qual é qual; 2026-11-17: "tá muito pequeno")
	var rf := rotulo("", 18, OURO_CLARO)
	rf.add_theme_constant_override("outline_size", 6)
	rf.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	rf.position = Vector2(MEDALHAO * 0.6, -9)
	rf.mouse_filter = Control.MOUSE_FILTER_IGNORE
	c.add_child(rf)
	slots_ui[id] = {"icone": ic, "painel": p, "no": c, "reforco": rf, "dur_veu": veu, "dur_quebrada": qb, "dur_fundo": df,
		"dur_barra": db, "dur_num": dn}
	if id == "arma":
		slot_arma = slots_ui[id]
	p.mouse_filter = Control.MOUSE_FILTER_STOP
	ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
	p.gui_input.connect(func(ev):
		if toque(ev):
			tocar_slot(id))
	return c

# um toque no celular chega duas vezes (o toque e o clique de mouse que o Godot imita a partir dele, e no PC o contrário).
# Sem filtrar, o segundo caía no véu da janela recém-aberta e fechava (só a Camisa e vizinhos escapavam, porque a janela
# nascia por cima deles antes de ir para o lugar) e o quadradinho do capacete marcava e desmarcava no mesmo toque.
var _toque_ms := -1000
func toque(ev: InputEvent) -> bool:
	if not ((ev is InputEventMouseButton and ev.pressed and ev.button_index == MOUSE_BUTTON_LEFT) or (ev is InputEventScreenTouch and ev.pressed)):
		return false
	var agora := Time.get_ticks_msec()
	if agora - _toque_ms < 250:
		return false
	_toque_ms = agora
	return true

func lugar_de(id: String) -> String:
	return ("espada" if boneco_modo == "Espada" else "cajado") if id == "arma" else id

# peças do corpo: ícone com a cor da raridade; vazio = silhueta apagada
var _vestido := "" # o que o boneco do menu está vestindo (atualizar_slots)
func atualizar_slots() -> void:
	quadradinhos = quadradinhos.filter(func(q): return is_instance_valid(q))
	for q in quadradinhos:
		q.marcado = not P_menu.prog.get("semCapacete", false)
		q.queue_redraw()
	if boneco:
		# o boneco veste o mesmo que o herói (capacete escondido também). Refaz só quando muda a roupa, a aparência
		# ou o corpo: vestir custava ~4 ms no PC (~13 ms no celular) e rodava 2 vezes a cada abrir
		var eq: Dictionary = P_menu.equip_visivel()
		var chave := "%d|%s|%s" % [boneco.get_instance_id(), str(eq), str(_aparencia_boneco())]
		if chave != _vestido:
			_vestido = chave
			Armadura.vestir(boneco, eq)
	for id in slots_ui:
		var u: Dictionary = slots_ui[id]
		var it = P_menu.prog.equip.get(lugar_de(id))
		var escolhido: bool = (sel_equip != "" and sel_equip == lugar_de(id)) or (janela_lugar != "" and janela_lugar == lugar_de(id)) \
			or (consertando and marc_conserto.has("l:" + lugar_de(id)))
		if u.has("reforco"):
			u.reforco.text = "+%d" % int(it.get("e", 0)) if it != null and int(it.get("e", 0)) > 0 else ""
		if u.has("dur_num"):
			_durabilidade_slot(u, it)
		if it != null:
			var c: Color = P_menu.cor_item(it)
			u.icone.texture = icone_tex(P_menu.icone_item(it))
			u.icone.modulate = c if u.icone.texture and u.icone.texture.resource_path.ends_with(".svg") else Color.WHITE
			u.painel.add_theme_stylebox_override("panel", caixa(Color(0.05, 0.045, 0.04, 1), Color(0, 0, 0, 0), 0, int(MEDALHAO * 0.5)))
			moldurar(u.painel, PIOR if P_menu.quebrado(it) else c, escolhido, true, int(MEDALHAO * 0.5), janela_lugar == lugar_de(id))
		else:
			u.icone.texture = icone_tex("basico" if id == "arma" and boneco_modo == "Espada" else "magia" if id == "arma" else "eq_" + id)
			u.icone.modulate = Color(0.85, 0.75, 0.55, 0.45 if id == "arma" else 0.25)
			u.painel.add_theme_stylebox_override("panel", caixa(Color(0.05, 0.045, 0.04, 1), Color(0, 0, 0, 0), 0, int(MEDALHAO * 0.5)))
			moldurar(u.painel, BORDA, escolhido, false, int(MEDALHAO * 0.5), janela_lugar == lugar_de(id))

# durabilidade no medalhão (só aparece depois da primeira pancada; quebrada fica vermelha mesmo vestida)
func _durabilidade_slot(u: Dictionary, it) -> void:
	var P = P_menu
	var mx := int(P.morte_dados().durMax)
	var gasta: bool = it != null and P.eh_equip(it) and P.durab(it) < mx
	var du: int = P.durab(it) if gasta else mx
	var k: float = clamp(float(du) / float(mx), 0.0, 1.0)
	var quebrada: bool = gasta and du <= 0
	u.dur_veu.visible = quebrada
	u.dur_quebrada.visible = quebrada
	u.dur_fundo.visible = gasta and not quebrada
	u.dur_barra.visible = gasta and not quebrada
	var cor: Color = Color("ff6a50") if k <= 0.3 else Color("f0c060")
	u.dur_barra.color = cor
	u.dur_barra.size.x = (u.dur_fundo.size.x - 2) * k
	var t := "%d/%d" % [du, mx] if gasta and not quebrada else ""
	if u.dur_num.text != t:
		u.dur_num.text = t
	u.dur_num.add_theme_color_override("font_color", Color("ff6a50") if quebrada else cor)

func tocar_slot(id: String) -> void:
	var l := lugar_de(id)
	if consertando: # conserto do Tomás: o toque marca a peça (André 2026-11-18)
		marcar_conserto({"lugar": l})
		return
	sel_mochila = -1
	sel_equip = l
	if aba != "mochila" and aba in ABAS_BOLSA: # no menu do personagem a janela da peça abre por cima, sem trocar de menu
		aba = "mochila"
	janela_lugar = l
	for d in SLOTS:
		if d[0] == id:
			janela_nome = d[1] if id != "arma" else ("Arma · espada" if l == "espada" else "Arma · cajado")
	atualizar()

# fio dourado de cada medalhão até a parte do corpo (segue o boneco quando ele gira)
func _desenhar_fios() -> void:
	if boneco == null or cam_palco == null or not is_instance_valid(boneco):
		return
	var esq: Skeleton3D = Armadura._esqueleto(boneco)
	if esq == null:
		return
	for d in SLOTS:
		var u: Dictionary = slots_ui.get(d[0], {})
		if u.is_empty():
			continue
		var b := esq.find_bone(d[4])
		if b < 0:
			continue
		var g: Vector3 = esq.global_transform * esq.get_bone_global_pose(b).origin
		if d[0] == "cabeca":
			g.y += 0.1
		var alvo := cam_palco.unproject_position(g)
		var no: Control = u.no
		var centro := no.position + no.size * 0.5
		var dir := (alvo - centro).normalized()
		var ini := centro + dir * MEDALHAO * 0.5
		var tem: bool = P_menu.prog.equip.get(lugar_de(d[0])) != null
		var cor := Color(OURO.r, OURO.g, OURO.b, 0.55 if tem else 0.22)
		# fio com um cotovelo: sai reto para o lado e desce/sobe até a parte do corpo
		var cot := Vector2(lerpf(ini.x, alvo.x, 0.45), alvo.y)
		fios.draw_polyline(PackedVector2Array([ini, cot, alvo]), cor, 1.2, true)
		fios.draw_circle(alvo, 2.6, cor)

func montar_palco() -> void:
	var cam := Camera3D.new()
	cam_palco = cam
	cam.fov = 30
	cam.position = Vector3(0, 1.05, 4.6)
	cam.look_at_from_position(cam.position, Vector3(0, 0.88, 0))
	vp.add_child(cam)
	var amb := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_CLEAR_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.45, 0.42, 0.4)
	env.ambient_light_energy = 0.5
	env.tonemap_exposure = 0.85
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	amb.environment = env
	vp.add_child(amb)
	var chave := DirectionalLight3D.new() # luz principal quente e um contraluz frio, como estúdio
	chave.light_color = Color(1.0, 0.92, 0.8)
	chave.light_energy = 0.8
	chave.rotation = Vector3(deg_to_rad(-25), deg_to_rad(45), 0) # luz-chave lateral a 45°: aparece o degrau de sombra do anime
	vp.add_child(chave)
	var contra := DirectionalLight3D.new()
	contra.light_color = Color(0.6, 0.72, 1.0)
	contra.light_energy = 0.9
	contra.rotation = Vector3(deg_to_rad(-20), deg_to_rad(170), 0) # recorte atrás
	vp.add_child(contra)
	# chão: disco escuro com brilho dourado
	var disco := MeshInstance3D.new()
	var cil := CylinderMesh.new()
	cil.top_radius = 0.75
	cil.bottom_radius = 0.8
	cil.height = 0.04
	disco.mesh = cil
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.045, 0.04, 0.035) # disco escuro e fosco (o metálico refletia a luz e estourava em branco)
	mat.roughness = 1.0
	mat.metallic_specular = 0.05
	disco.material_override = mat
	disco.position.y = -0.02
	vp.add_child(disco)
	var aro := MeshInstance3D.new() # brilho fraco só na borda
	var tor := TorusMesh.new()
	tor.inner_radius = 0.785
	tor.outer_radius = 0.8
	aro.mesh = tor
	var ma := StandardMaterial3D.new()
	ma.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	ma.albedo_color = Color(0.38, 0.29, 0.16)
	aro.material_override = ma
	aro.scale.y = 0.3
	aro.position.y = 0.0
	vp.add_child(aro)
	boneco = m.modelo(_visual_boneco())
	boneco.get_parent().remove_child(boneco)
	vp.add_child(boneco)
	boneco.position = Vector3.ZERO
	boneco_anim = boneco.find_child("AnimationPlayer", true, false)
	esp = m.nova_arma("espada")
	caj = m.nova_arma("cajado")

# o herói trocou de corpo no criador: o boneco do menu troca junto (mesmo lugar, mesma roupa e pintura)
func trocar_boneco() -> void:
	if boneco == null or not is_instance_valid(boneco):
		return
	var pai := boneco.get_parent()
	var ry := boneco.rotation.y
	for a in [esp, caj]: # as armas saem do corpo velho antes de ele sumir
		if a.get_parent():
			a.get_parent().remove_child(a)
	boneco.queue_free()
	boneco = m.modelo(_visual_boneco())
	boneco.get_parent().remove_child(boneco)
	pai.add_child(boneco)
	boneco.position = Vector3.ZERO
	boneco.rotation.y = ry
	boneco_anim = boneco.find_child("AnimationPlayer", true, false)
	boneco_modo = ""
	m.Aparencia.aplicar(boneco, _aparencia_boneco())
	armar_boneco()

func armar_boneco() -> void:
	if boneco_modo == m.h.modo:
		return
	boneco_modo = m.h.modo
	var esq: Skeleton3D = m.esqueleto(boneco)
	var L: Dictionary = m.lugar_armas()
	m.prender(esq, esp, L.espadaMao if boneco_modo == "Espada" else L.espadaCostas)
	m.prender(esq, caj, L.cajadoCostas if boneco_modo == "Espada" else L.get("cajadoMao", L.cajadoCostas))
	boneco_anim.play("espada_parada" if boneco_modo == "Espada" else ("cajado_parada" if boneco_anim.has_animation("cajado_parada") else "parada"), 0.2)
	atualizar_slots()

func _girar(ev: InputEvent) -> void:
	if ev is InputEventScreenDrag:
		giro += ev.relative.x * 0.012
	elif ev is InputEventMouseMotion and (ev.button_mask & MOUSE_BUTTON_MASK_LEFT):
		giro += ev.relative.x * 0.012

# ---------- direita: abas ----------
func montar_direita() -> Control:
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.clip_contents = true # nada passa da borda: a mochila nunca fica cortada
	col.add_theme_constant_override("separation", 8)
	var abas := HBoxContainer.new()
	abas.add_theme_constant_override("separation", 6)
	for a in [["status", "Status"], ["habilidades", "Habilidades"], ["profissoes", "Profissões"], ["titulos", "Títulos"], ["missoes", "História"], ["diarias", "Diárias"], ["guilda", "Guilda"], ["cla_missoes", "Missão do Clã"], ["cla", "Clã"], ["aparencia", "Aparência"],
			["mochila", "Mochila"], ["criar", "Criar"], ["recipedia", "Recipedia"], ["loja", "Loja"]]:
		var b := botao(a[1], func(): trocar_aba(a[0]), 16)
		b.custom_minimum_size = Vector2(126, 40)
		botoes_aba[a[0]] = b
		abas.add_child(b)
	ferramentas_bolsa = HBoxContainer.new()
	ferramentas_bolsa.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	ferramentas_bolsa.alignment = BoxContainer.ALIGNMENT_END
	ferramentas_bolsa.add_theme_constant_override("separation", 6)
	abas.add_child(ferramentas_bolsa)
	var lugar_x := Control.new() # o X de fechar fica por cima deste canto
	lugar_x.custom_minimum_size = Vector2(48, 0)
	abas.add_child(lugar_x)
	col.add_child(abas)
	linha_arvores = HBoxContainer.new()
	linha_arvores.add_theme_constant_override("separation", 6)
	for k in ARVORES:
		var b := botao(ARVORES[k], func(): trocar_arvore(k), 14)
		b.custom_minimum_size = Vector2(110, 34)
		botoes_arvore[k] = b
		linha_arvores.add_child(b)
	col.add_child(linha_arvores)
	linha_prof = HBoxContainer.new()
	linha_prof.add_theme_constant_override("separation", 6)
	for k in SUB_PROF:
		var b := botao(SUB_PROF[k], func(): trocar_sub_prof(k), 14)
		b.custom_minimum_size = Vector2(110, 34)
		botoes_prof[k] = b
		linha_prof.add_child(b)
	col.add_child(linha_prof)
	linha_criar = HBoxContainer.new()
	linha_criar.add_theme_constant_override("separation", 5)
	for c in CATS_CRIAR:
		var b := botao(c[1], func(): trocar_cat_criar(c[0]), 13)
		b.custom_minimum_size = Vector2(0, 34)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		botoes_criar[c[0]] = b
		linha_criar.add_child(b)
	col.add_child(linha_criar)
	var fundo := PanelContainer.new()
	fundo.size_flags_vertical = Control.SIZE_EXPAND_FILL
	fundo.add_theme_stylebox_override("panel", caixa(Color(0.055, 0.048, 0.04, 1), Color(0.24, 0.2, 0.14), 1, 8))
	rolagem = ScrollContainer.new()
	rolagem.set_meta("arrasto_proprio", true)
	rolagem.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	rolagem.size_flags_vertical = Control.SIZE_EXPAND_FILL
	fundo.add_child(rolagem)
	barra_larga(rolagem)
	conteudo = VBoxContainer.new()
	conteudo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	conteudo.add_theme_constant_override("separation", 8)
	rolagem.add_child(conteudo)
	col.add_child(fundo)
	return col

func trocar_aba(a: String) -> void:
	if vendo_recruta() and not (a in ABAS_RECRUTA):
		return
	if a == "aparencia": # abre o criador de personagem (sem o nome), como o botão de antes
		fechar()
		m.abrir_aparencia()
		return
	aba = a
	atualizar()
	rolagem.scroll_vertical = 0
	_viu_barra()
	_viu_diarias()

# missão "Confira sua barra de habilidades" (André 2026-11-14): abrir a aba Habilidades já conta; não precisa tirar
# uma skill que já está no lugar e pôr de novo. Quem decide é o servidor (shared/historia.js, etapa com ver)
func _viu_barra() -> void:
	if aba == "habilidades" and str(P_menu.hist_info.get("ev", "")) == "barra":
		rede("barra_vista")

# missão "Tarefas do dia" (Rosa): abrir a aba Diárias conta. Quem decide é o servidor (shared/diarias.js, acao "ver")
func _viu_diarias() -> void:
	if aba == "diarias" and str(P_menu.hist_info.get("ev", "")) in ["diaria_vista", "diaria"]:
		rede("diaria", {"acao": "ver"})

func trocar_sub_prof(k: String) -> void:
	sub_prof = k
	atualizar()
	rolagem.scroll_vertical = 0

func trocar_cat_criar(k: String) -> void:
	cat_criar = k
	atualizar()
	rolagem.scroll_vertical = 0

func trocar_arvore(k: String) -> void:
	arvore = k
	atualizar()
	rolagem.scroll_vertical = 0

func abrir(qual := "", sub := "") -> void:
	var t0 := Time.get_ticks_usec() # quanto a abertura leva no celular (lentidao.gd, tipo "menu")
	if m.h.modo == "Magia":
		arvore = "cajado"
	if sub != "":
		sub_prof = sub
	if qual != "":
		aba = qual
		if qual == "diarias":
			_viu_diarias.call_deferred()
		if qual == "guilda" and m.on(): # o "perto do mural" e os contratos do dia vêm do servidor na hora
			rede("guilda", {"acao": "ver"})
		if qual == "cla_missoes" and m.on(): # a escolta e o tempo da próxima vêm do servidor na hora
			rede("cla", {"acao": "ver"})
		if qual == "cla" and m.on(): # o "perto do Recrutador" e o cofre vêm do servidor na hora
			rede("cla", {"acao": "ver"})
	elif aba in ABAS_BOLSA or aba in ABAS_MISSOES or aba in ABAS_CLA: # barra de vida: só o menu do personagem
		aba = "status"
	sel_mochila = -1
	sel_equip = ""
	janela_lugar = ""
	vendendo = false
	marcados = {}
	consertando = false
	marc_conserto = {}
	filtro_aberto = false
	raiz.visible = true
	m.hud.bloqueado = true
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp.process_mode = Node.PROCESS_MODE_INHERIT
	boneco_modo = ""
	atualizar()
	_viu_barra()
	if m.lentidao:
		m.lentidao.menu_aberto(aba, t0, conteudo.get_child_count())

# botão de ação perto da bancada, bigorna ou fornalha: a aba Criar inteira, aberta no que esta estação faz
func abrir_estacao() -> void:
	cat_criar = "aqui"
	var ests := estacoes_perto()
	est_criar = ests[0] if not ests.is_empty() else ""
	abrir("criar")
	rolagem.scroll_vertical = 0

# estações perto do herói (construídas no terreno, ou a oficina do Tomás / banca da Rosa), na ordem de NOME_ESTACAO
func estacoes_perto() -> Array:
	var l := []
	var cons = m.construcao
	for est in NOME_ESTACAO:
		var prof := "alf" if est == "bancada" else "coz" if est == "fogao" else "fer"
		if (cons != null and cons.estacao_perto([est])) or (m.trabalho != null and m.trabalho.perto_oficina(prof)):
			l.append(est)
	return l

# botão da mochila no menu do topo: volta na aba da bolsa que estava (Mochila ou Criar)
# André 2026-11-21: o Criar da bolsa mostra só o que se cria em qualquer lugar (a estação mostra o dela)
func abrir_bolsa() -> void:
	est_criar = ""
	abrir(aba if aba in ["mochila", "criar", "recipedia"] else "mochila")

func fechar() -> void:
	if vendo_recruta(): # o X no menu do recruta: sai dele e fecha
		_limpar_recruta()
	_pend.clear() # fechou sem confirmar: nada foi gasto
	limpar_ver() # o filtro do que aparece é só do momento (André 2026-11-25)
	fechar_confirma()
	fechar_janela(false)
	raiz.visible = false
	m.hud.bloqueado = false
	vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	vp.process_mode = Node.PROCESS_MODE_DISABLED # fechado: o boneco para de animar (custava um herói inteiro por quadro)

func aberto() -> bool:
	return raiz != null and raiz.visible

# Menu aquecido atrás da capa (frente de desempenho, ronda de 25/11: no Note 10 Lite a primeira vez que a aba Clã abriu
# levou 6,8 s num quadro só, com 360 pipelines montadas de uma vez; no Poco até 236 ms). A placa monta os shaders de cada
# jeito de desenhar (boneco do menu, caixas, barras, botões, textos) na primeira vez que aparecem. Aqui, enquanto a capa
# ainda cobre a tela (aquecer.gd), o menu abre por baixo dela (camada 4, a capa é a 5): Personagem com o boneco, Clã com
# um clã de exemplo de 10 recrutas e Mochila, um quadro cada; depois fecha e tudo volta como estava. Nada vai ao servidor.
var _aquecendo := false
var _aq_camada := 20
var _aq_cla = null
func aquecer_passo(i: int) -> void:
	match i:
		0:
			var on = m.online
			if aberto() or on == null or on.capa == null or not on.capa.visible: # só com a capa cobrindo
				return
			_aquecendo = true
			_aq_camada = layer
			_aq_cla = m.P.cla
			layer = 4
			abrir("status")
		1:
			if not _aquecendo:
				return
			var ms := []
			for k in 10:
				ms.append({"id": "aq%d" % k, "nome": "Recruta %d" % k, "tier": "Soldado", "nv": 10 + k, "sem": 50, "on": 1, "g": 0,
					"fn": {"k": ["livre", "recurso", "proteger", "fazenda"][k % 4]}, "c": "r:aq%d" % k, "hp": 300, "hpM": 400, "mp": 50, "mpM": 80,
					"vg": 60, "vgM": 100, "morto": 0, "x": 10, "z": 20, "bid": "aq%d" % k, "fz": "Treinando"})
			m.P.cla = {"n": "Brasas", "cofre": 1200, "semana": 300, "prox": 3600000, "max": 10, "nv": 10, "sobe": null, "perto": true,
				"eu": {"nome": "Líder", "nv": 40, "hp": 500, "hpM": 600, "mp": 90, "mpM": 100, "vg": 70, "vgM": 100, "morto": 0},
				"m": ms, "bauCla": {}, "plantas": [{"k": "cenoura", "nome": "Cenoura"}], "veic": {"carrinho": 0, "mercante": 0},
				"funcoes": [{"id": "livre", "nome": "Livre"}, {"id": "recurso", "nome": "Recurso"}], "recursos": [{"k": "ferro", "nome": "ferro"}],
				"tiers": [], "rec": {}, "log": [{"txt": "Exemplo", "v": 10}], "dep": [100, 1000], "clas": [], "base": null, "baseNiveis": []}
			aba = "cla"
			atualizar()
		2:
			if not _aquecendo:
				return
			m.P.cla = _aq_cla
			aba = "mochila"
			atualizar()
		3, 4: # ronda de 25/11 (Note 10 Lite): Títulos 25 ms e Habilidades 13 ms na primeira abertura
			if not _aquecendo:
				return
			aba = "titulos" if i == 3 else "habilidades"
			atualizar()
		_:
			aquecer_fim()

func aquecer_fim() -> void:
	if not _aquecendo:
		return
	m.P.cla = _aq_cla
	_aq_cla = null
	fechar()
	aba = "status"
	layer = _aq_camada
	_aquecendo = false
	_cla_vivos = {}
	_cla_chave = ""

# rolar a lista arrastando o dedo (em cima de qualquer coisa: linha, botão, texto)
func _input(ev: InputEvent) -> void:
	if not aberto() or rolagem == null or menu_ver_aberto(): # menuzinho do filtro por cima: ele rola (rolagem_toque.gd)
		return
	var rol: ScrollContainer = janela_rolagem if janela_aberta() and janela_rolagem != null else rolagem
	if ev is InputEventScreenTouch and ev.pressed and not janela_aberta() and painel_item != null and painel_item.visible \
			and painel_rolagem.get_global_rect().has_point(ev.position):
		rol = painel_rolagem
		_rol_painel = true
	elif ev is InputEventScreenTouch and ev.pressed:
		_rol_painel = false
	if _rol_painel and painel_item != null and painel_item.visible:
		rol = painel_rolagem
	if ev is InputEventScreenTouch:
		if ev.pressed:
			_arrasto_dentro = rol.get_global_rect().has_point(ev.position)
			if _arrasto_dentro and Engine.has_meta("rolagem_toque"):
				Engine.get_meta("rolagem_toque", null).esquecer() # encostou: a lista que deslizava para
			var vb := rol.get_v_scroll_bar()
			if vb.visible and vb.mouse_filter != Control.MOUSE_FILTER_IGNORE and vb.get_global_rect().has_point(ev.position):
				_arrasto_dentro = false # dedo na barra: a própria barra rola, no sentido dela
			_arrasto_soma = 0.0
			_arrastou = false
		else:
			if _arrasto_dentro and _arrastou and Engine.has_meta("rolagem_toque"):
				Engine.get_meta("rolagem_toque", null).inercia(rol) # soltou arrastando: a lista segue deslizando e freia
			_arrasto_dentro = false
			if _arrastou: # deixa o soltar passar, mas o botão não dispara (o pressed vem antes de zerar)
				(func(): _arrastou = false).call_deferred()
	elif ev is InputEventScreenDrag and _arrasto_dentro:
		_arrasto_soma += abs(ev.relative.y)
		if _arrasto_soma > 12.0:
			_arrastou = true
		rol.scroll_vertical -= int(round(ev.relative.y))
		if Engine.has_meta("rolagem_toque"):
			Engine.get_meta("rolagem_toque", null).anotar(ev.relative.y)
		get_viewport().set_input_as_handled()

func _process(dt: float) -> void:
	var t0_parte := Time.get_ticks_usec()
	_process_parte(dt)
	if Time.get_ticks_usec() - t0_parte >= 1000 and Engine.has_meta("lentidao"): # quadro lento (lentidao.gd)
		Engine.get_meta("lentidao").ev("menu", t0_parte)

func _process_parte(dt: float) -> void:
	if not aberto():
		return
	if boneco:
		boneco.rotation.y = lerp_angle(boneco.rotation.y, giro, min(1.0, dt * 10.0))
	armar_boneco()

# ---------- conteúdo ----------
func atualizar() -> void:
	if not aberto():
		return
	var P = P_menu
	var vr := vendo_recruta()
	titulo_nivel.text = tr("%s  ·  Nível %d") % [str(ver_rec.nome) if vr else m.hud.nome, P.prog.nivel]
	cab_titulo.text = Idioma.frase("MENU DE %s  ·  SÓ OLHANDO" % str(ver_rec.nome).to_upper()) if vr else Idioma.frase("PERSONAGEM")
	cab_titulo.add_theme_color_override("font_color", Color(0.55, 0.78, 1.0) if vr else OURO)
	bt_sair.visible = vr
	if vr and not (aba in ABAS_RECRUTA):
		aba = "status"
	for c in ouro_esq.get_children():
		ouro_esq.remove_child(c)
		c.queue_free()
	ouro_esq.add_child(linha_ouro(18))
	for c in ferramentas_bolsa.get_children():
		ferramentas_bolsa.remove_child(c)
		c.queue_free()
	mostrar_painel(null)
	if aba == "loja" and (not m.perto_da_loja() or vendo_recruta()):
		aba = "mochila"
	if esquerda != null:
		esquerda.visible = not (aba in ABAS_CLA)
	var grupo: Array = ABAS_RECRUTA if vr else (ABAS_BOLSA if aba in ABAS_BOLSA else (ABAS_MISSOES if aba in ABAS_MISSOES else (ABAS_CLA if aba in ABAS_CLA else ABAS_PERSONAGEM)))
	for k in botoes_aba:
		_estilo_se_mudou(botoes_aba[k], k == aba)
		botoes_aba[k].visible = k in grupo
		botoes_aba[k].custom_minimum_size.x = 0 if vr else (104 if grupo == ABAS_BOLSA else (170 if k == "cla_missoes" else 126))
		# no menu do recruta são 7 abas + Sair: fonte menor e sem largura mínima, senão a coluna passa da tela e entorta a mochila
		botoes_aba[k].add_theme_font_size_override("font_size", legivel(13 if vr else 16))
	botoes_aba.loja.visible = aba in ABAS_BOLSA and m.perto_da_loja() and not vr
	_bolinha_diarias()
	linha_criar.visible = false # a fileira de submenus deu lugar às estações e aos grupos sanfona (André 2026-11-09)
	var est_aqui := estacoes_perto()
	if cat_criar == "aqui" and est_aqui.is_empty():
		cat_criar = "materiais"
	botoes_criar.aqui.visible = not est_aqui.is_empty()
	botoes_criar.aqui.text = Idioma.frase(str(NOME_ESTACAO[est_aqui[0]]).split(" ")[0] if est_aqui.size() == 1 else "Aqui")
	for k in botoes_criar:
		_estilo_se_mudou(botoes_criar[k], k == cat_criar)
	atualizar_slots()
	linha_arvores.visible = aba == "habilidades"
	for k in botoes_arvore:
		_estilo_se_mudou(botoes_arvore[k], k == arvore)
	linha_prof.visible = aba == "profissoes"
	for k in botoes_prof:
		_estilo_se_mudou(botoes_prof[k], k == sub_prof)
	var y := rolagem.scroll_vertical
	for c in conteudo.get_children():
		conteudo.remove_child(c)
		c.queue_free()
	if aba == "status":
		montar_status()
	elif aba == "mochila":
		montar_mochila()
	elif aba == "loja":
		montar_loja()
	elif aba == "criar":
		montar_criar()
	elif aba == "recipedia":
		montar_recipedia()
	elif aba == "missoes":
		montar_missoes()
	elif aba == "diarias":
		montar_diarias()
	elif aba == "guilda":
		montar_guilda()
	elif aba == "cla_missoes":
		montar_cla_missoes()
		_quebrar_linhas(conteudo)
	elif aba == "cla":
		montar_cla()
		_quebrar_linhas(conteudo) # nada cortado à direita (André 2026-11-23: "está cortando ali o nível")
	elif aba == "titulos":
		montar_titulos()
	elif aba == "profissoes":
		if sub_prof == "lista":
			montar_profissoes()
		else:
			montar_receitas(sub_prof)
	else:
		montar_habilidades()
	montar_janela()
	await get_tree().process_frame
	rolagem.scroll_vertical = y

# as abas de cima (e as fileiras de baixo delas) só trocam de estilo quando a escolhida muda: refazer as 3 caixas e
# as cores de uns 15 botões a cada atualizar custava ~4 ms no PC por abertura e por toque dentro do menu
func _estilo_se_mudou(b: Button, ativo: bool) -> void:
	if b.has_meta("ativo") and b.get_meta("ativo") == ativo:
		return
	b.set_meta("ativo", ativo)
	estilo_botao(b, ativo)

func separador(t: String) -> void:
	var l := rotulo(Idioma.frase(t).to_upper(), 12, OURO)
	conteudo.add_child(l)
	var linha := ColorRect.new()
	linha.color = Color(0.42, 0.33, 0.2, 0.6)
	linha.custom_minimum_size = Vector2(0, 1)
	conteudo.add_child(linha)

func barra_prog(frac: float, cor: Color, alto := 8.0) -> Control:
	var fundo := Panel.new()
	fundo.custom_minimum_size = Vector2(0, alto)
	fundo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	fundo.add_theme_stylebox_override("panel", caixa(Color(0.03, 0.03, 0.03), Color(0.25, 0.2, 0.14), 1, 3))
	var cheio := Panel.new()
	cheio.anchor_right = clamp(frac, 0.0, 1.0)
	cheio.anchor_bottom = 1.0
	cheio.add_theme_stylebox_override("panel", caixa(cor, cor.lightened(0.2), 0, 3))
	fundo.add_child(cheio)
	return fundo

func montar_status() -> void:
	var P = P_menu
	var p: Dictionary = P.prog
	separador("Nível")
	var lv := HBoxContainer.new()
	lv.add_child(rotulo("Nível %d" % p.nivel, 20, OURO_CLARO))
	var xp_txt := rotulo("  XP %d / %d" % [p.xp, P.xp_prox] if p.nivel < int(P.dados.nivelMax) else "  Nível máximo", 14, APAGADO)
	lv.add_child(xp_txt)
	conteudo.add_child(lv)
	conteudo.add_child(barra_prog(float(p.xp) / max(1, P.xp_prox), Color(0.85, 0.66, 0.3)))
	if P.teste: # só na conta de teste do André: mudar o nível na hora para testar os campos de caça
		var tl := HBoxContainer.new()
		tl.add_theme_constant_override("separation", 8)
		tl.add_child(rotulo("Teste de nível:", 14, APAGADO))
		for d in [-10, -1, 1, 10]:
			tl.add_child(botao(("%+d" % d), func(): rede("nivelTeste", {"nv": int(p.nivel) + d}), 14))
		tl.add_child(botao("Zerar pontos", func(): rede("nivelTeste", {"nv": int(p.nivel), "zerar": true}), 14))
		conteudo.add_child(tl)
	separador("Atributos")
	# André 2026-11-06: + e − só mexem nos pontos pendentes; nada muda até apertar Confirmar (Desfazer zera).
	# O − nunca tira ponto já confirmado.
	var pend := _pend_validos()
	var n_pend := _soma_pend()
	var sobram: int = int(p.pontos) - n_pend
	var topo := HBoxContainer.new()
	topo.add_theme_constant_override("separation", 14)
	topo.add_child(rotulo("Pontos sobrando: %d" % sobram, 16, VERDE if sobram > 0 else APAGADO))
	if n_pend > 0:
		topo.add_child(rotulo("(%d para confirmar)" % n_pend, 14, OURO_CLARO))
	conteudo.add_child(topo)
	for k in ["for", "des", "int", "vit"]:
		var a: Dictionary = P.dados.atributos[k]
		var linha := HBoxContainer.new()
		linha.add_theme_constant_override("separation", 8)
		var txt := VBoxContainer.new()
		txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		txt.add_theme_constant_override("separation", 0)
		txt.add_child(rotulo(a.nome, 16, TEXTO))
		var d := rotulo(a.desc, 12, APAGADO)
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		txt.add_child(d)
		linha.add_child(txt)
		var extra: int = int(pend.get(k, 0))
		var menos := botao("−", func(): mudar_pend(k, -1), 20, extra > 0)
		menos.custom_minimum_size = Vector2(44, 40)
		menos.disabled = extra <= 0
		linha.add_child(menos)
		var v := rotulo(str(int(p.atr[k]) + extra), 20, VERDE if extra > 0 else OURO_CLARO)
		v.custom_minimum_size = Vector2(44, 0)
		v.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		if extra > 0:
			v.tooltip_text = "%d + %d" % [p.atr[k], extra]
		linha.add_child(v)
		var mais := botao("+", func(): mudar_pend(k, 1), 20, sobram > 0)
		mais.custom_minimum_size = Vector2(44, 40)
		mais.disabled = sobram <= 0
		linha.add_child(mais)
		var mostra := rotulo("+%d" % extra if extra > 0 else "", 14, VERDE)
		mostra.custom_minimum_size = Vector2(34, 0)
		linha.add_child(mostra)
		conteudo.add_child(linha)
	if n_pend > 0:
		var acoes := HBoxContainer.new()
		acoes.alignment = BoxContainer.ALIGNMENT_END
		acoes.add_theme_constant_override("separation", 10)
		var desfazer := botao("Desfazer", func(): _pend.clear(); atualizar(), 15)
		desfazer.custom_minimum_size = Vector2(120, 42)
		acoes.add_child(desfazer)
		var ok := botao("Confirmar (%d)" % n_pend, confirmar_pontos, 15, true)
		ok.custom_minimum_size = Vector2(160, 42)
		acoes.add_child(ok)
		conteudo.add_child(acoes)
	separador("Herói")
	var st: Dictionary = P.st
	var g := GridContainer.new()
	g.columns = 2
	g.add_theme_constant_override("h_separation", 28)
	g.add_theme_constant_override("v_separation", 4)
	var itens := [
		["Vida", "%d / %d" % [ceil(m.h.vida), st.vidaMax]], ["Mana", "%d / %d" % [floor(m.h.mana), st.manaMax]],
		["Defesa", "%d (-%s%% de dano)" % [st.defesa, P.num(st.reducao * 100, 0)]], ["Crítico", "%s%%" % P.num(st.critico * 100, 1)],
		["Dano crítico", "+%d" % int(round(float(st.get("danoCritico", 0))))], # André 2026-11-17: número somado no golpe crítico
		["Dano físico", P.num(st.danoFisico, 1)], ["Dano mágico", P.num(st.danoMagico, 1)],
		["Recarga", "-%s%%" % P.num(st.recarga * 100, 0)], ["Regeneração", "%s vida/s · %s mana/s (fora de luta)" % [P.num(st.regenVida, 1), P.num(st.regenMana, 1)]],
		["Estamina", "%d / %d" % [floor(m.trabalho.sta), m.trabalho.sta_max()]], ["Vigor", "%d / %d" % [floor(P.vigor()), int(P.vigor_max())]],
		["Ouro", str(int(p.ouro))],
	]
	# com pontos pendentes, mostra como os números ficam depois de confirmar (em verde)
	var depois := {}
	if n_pend > 0:
		var antes: Dictionary = p.atr.duplicate()
		for k in pend:
			p.atr[k] = int(p.atr[k]) + int(pend[k])
		var st2: Dictionary = P.calcular_status()
		p.atr = antes
		depois = {
			"Vida": "%d" % st2.vidaMax, "Mana": "%d" % st2.manaMax, "Defesa": "%d" % st2.defesa,
			"Crítico": "%s%%" % P.num(st2.critico * 100, 1), "Dano físico": P.num(st2.danoFisico, 1),
			"Dano mágico": P.num(st2.danoMagico, 1), "Recarga": "-%s%%" % P.num(st2.recarga * 100, 0),
		}
		var ref := {
			"Vida": "%d" % st.vidaMax, "Mana": "%d" % st.manaMax, "Defesa": "%d" % st.defesa,
			"Crítico": "%s%%" % P.num(st.critico * 100, 1), "Dano físico": P.num(st.danoFisico, 1),
			"Dano mágico": P.num(st.danoMagico, 1), "Recarga": "-%s%%" % P.num(st.recarga * 100, 0),
		}
		for nome in ref:
			if ref[nome] == depois[nome]:
				depois.erase(nome)
	for it in itens:
		var c := HBoxContainer.new()
		c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var n := rotulo(it[0], 14, APAGADO)
		n.custom_minimum_size = Vector2(110, 0)
		c.add_child(n)
		c.add_child(rotulo(it[1], 14, TEXTO))
		if depois.has(it[0]):
			c.add_child(rotulo("  → %s" % depois[it[0]], 14, VERDE))
		g.add_child(c)
	conteudo.add_child(g)
	if not vendo_recruta(): # a ficha do recruta aparece no painel do clã e no equipamento
		_minha_ficha()

# Minha ficha (André 2026-11-23: "no jogador também tem esse espaço... a gente preenche se quiser, pode deixar em branco"):
# as mesmas escolhas da ficha do recruta (FICHA_RECRUTA em shared/dados.js, na mesma ordem); o servidor confere.
const FICHA_JEITOS := [["Disciplinado", "Disciplinada"], ["Brincalhão", "Brincalhona"], ["Ambicioso", "Ambiciosa"], ["Medroso", "Medrosa"], ["Rabugento", "Rabugenta"], ["Curioso", "Curiosa"], ["Orgulhoso", "Orgulhosa"], ["Gentil", "Gentil"], ["Competitivo", "Competitiva"], ["Saudoso", "Saudosa"]]
const FICHA_ESTILOS := [["espada", "Espada"], ["meio", "Meio a meio"], ["magia", "Magia"]]
const FICHA_GOSTOS := [["cacar", "Caçar"], ["minerar", "Minerar"], ["lenha", "Cortar lenha"], ["pescar", "Pescar"]]

func _minha_ficha() -> void:
	separador("Minha ficha")
	conteudo.add_child(rotulo("Opcional: aparece para quem vê o seu equipamento. Toque para trocar.", 12, APAGADO))
	var fic: Dictionary = P_menu.prog.get("fic", {}) if P_menu.prog.get("fic") is Dictionary else {}
	var f := 0 if str(m.visual) == "cabelo_m" else 1 # o corpo do herói (main.gd)
	var j := int(fic.get("j", -1))
	var e := -1
	var g := -1
	for i in FICHA_ESTILOS.size():
		if FICHA_ESTILOS[i][0] == str(fic.get("e", "")):
			e = i
	for i in FICHA_GOSTOS.size():
		if FICHA_GOSTOS[i][0] == str(fic.get("g", "")):
			g = i
	var linhas := [
		["Jeito", FICHA_JEITOS[j][f] if j >= 0 and j < FICHA_JEITOS.size() else "em branco", func(): _mudar_ficha(fic, "j", -1 if j + 1 >= FICHA_JEITOS.size() else j + 1)],
		["Preferência", FICHA_ESTILOS[e][1] if e >= 0 else "em branco", func(): _mudar_ficha(fic, "e", null if e + 1 >= FICHA_ESTILOS.size() else FICHA_ESTILOS[e + 1][0])],
		["Gosta de", FICHA_GOSTOS[g][1] if g >= 0 else "em branco", func(): _mudar_ficha(fic, "g", null if g + 1 >= FICHA_GOSTOS.size() else FICHA_GOSTOS[g + 1][0])],
	]
	for L in linhas:
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 8)
		var n := rotulo(L[0], 14, APAGADO)
		n.custom_minimum_size = Vector2(110, 0)
		h.add_child(n)
		var b := botao("%s  ›" % L[1], L[2], 14)
		b.custom_minimum_size = Vector2(200, 38)
		h.add_child(b)
		conteudo.add_child(h)

func _mudar_ficha(fic: Dictionary, k: String, v) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	var novo := fic.duplicate()
	if v == null or (v is int and v < 0):
		novo.erase(k)
	else:
		novo[k] = v
	P_menu.prog["fic"] = novo # já mostra; o servidor confere e devolve o progresso
	rede("ficha", novo)
	atualizar()

# Mestre Ivo (NPC de resetar a build): janela pequena para confirmar. Online quem confere e cobra é o servidor.
var _reset: Control
func perguntar_reset(custo: int) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	if _reset:
		_reset.queue_free()
	var gastos: int = P_menu.pontos_gastos()
	_reset = Control.new()
	_reset.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_reset)
	var escuro := ColorRect.new()
	escuro.color = Color(0, 0, 0, 0.45)
	escuro.set_anchors_preset(Control.PRESET_FULL_RECT)
	_reset.add_child(escuro)
	var caixa_r := PanelContainer.new()
	caixa_r.add_theme_stylebox_override("panel", caixa(FUNDO, OURO.darkened(0.25), 2, 10, 14))
	caixa_r.set_anchors_preset(Control.PRESET_CENTER)
	caixa_r.custom_minimum_size = Vector2(430, 0)
	caixa_r.position = Vector2(-215, -95)
	_reset.add_child(caixa_r)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	caixa_r.add_child(col)
	var t := Label.new()
	t.text = "Mestre Ivo · Resetar build"
	t.add_theme_font_size_override("font_size", 20)
	t.add_theme_color_override("font_color", OURO_CLARO)
	col.add_child(t)
	var d := Label.new()
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	d.text = Idioma.frase("Seus atributos voltam pro começo e os %d pontos voltam pra você distribuir de novo. As skills não mudam.\nCusta %d de ouro (você tem %d)." % [gastos, custo, int(P_menu.prog.get("ouro", 0))]) if gastos > 0 else "Você ainda não gastou nenhum ponto."
	d.add_theme_font_size_override("font_size", 15)
	d.add_theme_color_override("font_color", TEXTO)
	col.add_child(d)
	var linha := HBoxContainer.new()
	linha.alignment = BoxContainer.ALIGNMENT_END
	linha.add_theme_constant_override("separation", 10)
	col.add_child(linha)
	var fechar_r := func():
		if _reset:
			_reset.queue_free()
			_reset = null
	linha.add_child(botao("Agora não", fechar_r))
	if gastos > 0:
		linha.add_child(botao("Resetar (%d de ouro)" % custo, func():
			fechar_r.call()
			if m.on():
				rede("resetar") # o servidor confere a distância e o ouro e manda o progresso novo
			else:
				m.hud.aviso(P_menu.resetar(custo))
				atualizar(), 15, true))

# Pontos ainda não confirmados, por atributo ({"for": 2}). Some ao confirmar, desfazer ou fechar o menu.
var _pend := {}

# Se os pontos livres mudaram por fora (reset no Mestre Ivo, outro aparelho) e não cabem mais, zera o pendente.
func _pend_validos() -> Dictionary:
	if _soma_pend() > int(P_menu.prog.pontos):
		_pend.clear()
	return _pend

func _soma_pend() -> int:
	var t := 0
	for k in _pend:
		t += int(_pend[k])
	return t

func mudar_pend(k: String, d: int) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	var atual: int = int(_pend.get(k, 0))
	if d > 0 and _soma_pend() >= int(P_menu.prog.pontos):
		return
	if d < 0 and atual <= 0:
		return # o − só tira o que ainda não foi confirmado
	atual += d
	if atual <= 0:
		_pend.erase(k)
	else:
		_pend[k] = atual
	atualizar()

func confirmar_pontos() -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	var envio := _pend_validos().duplicate()
	_pend.clear()
	if envio.is_empty():
		atualizar()
		return
	if m.on():
		rede("atributos", envio) # o servidor confere tudo de uma vez e devolve o progresso novo
		atualizar()
	else:
		for k in envio:
			for i in int(envio[k]):
				P_menu.distribuir(k)
		atualizar()

func distribuir(k: String) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	if m.on():
		rede("atributo", k) # o servidor confere e devolve o progresso novo
	elif P_menu.distribuir(k):
		atualizar()

func montar_habilidades() -> void:
	var P = P_menu
	for b in (["espada", "cajado"] if arvore == "geral" else [arvore]):
		separador("Barra da espada" if b == "espada" else "Barra do cajado")
		conteudo.add_child(linha_barra(b))
	var dica := rotulo("Trocar mostra a outra barra. Toque em dois botões para trocar de lugar; em cada skill, escolha o número do botão (tocar de novo tira).", 12, APAGADO)
	dica.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	conteudo.add_child(dica)
	var info := rotulo(ARVORE_TXT[arvore], 13, APAGADO)
	info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	conteudo.add_child(info)
	separador("Skills")
	var ids := []
	for id in P.habs:
		var h: Dictionary = P.habs[id]
		if h.arvore == arvore:
			ids.append(id)
	var ordem := func(id): return int(P.habs[id].libera) * 2 + (0 if P.habs[id].get("basico", false) else 1)
	ids.sort_custom(func(a, b): return ordem.call(a) < ordem.call(b))
	for id in ids:
		conteudo.add_child(linha_skill(id))
	separador("Passivas")
	for k in P.dados.passivas:
		var pv: Dictionary = P.dados.passivas[k]
		var ok: bool = P.passiva(k)
		var l := HBoxContainer.new()
		l.add_theme_constant_override("separation", 10)
		var marca := Panel.new()
		marca.custom_minimum_size = Vector2(12, 12)
		marca.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		marca.add_theme_stylebox_override("panel", caixa(VERDE if ok else Color(0.2, 0.18, 0.15), BORDA, 1, 6))
		l.add_child(marca)
		l.add_child(rotulo(pv.nome, 15, TEXTO if ok else APAGADO))
		l.add_child(rotulo(pv.desc if ok else "Libera no nível %d. %s" % [int(pv.libera), pv.desc], 13, APAGADO))
		conteudo.add_child(l)

func linha_skill(id: String) -> Control:
	var P = P_menu
	var base: Dictionary = P.habs[id]
	var livre: bool = P.liberada(id)
	var nv: int = P.nivel_de(id)
	var h: Dictionary = P.hab_pronta(id)
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1) if livre else Color(0.07, 0.063, 0.055, 1), Color(0.3, 0.24, 0.16), 1, 8))
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 12)
	cx.add_child(l)
	var moldura := Panel.new()
	moldura.custom_minimum_size = Vector2(52, 52)
	moldura.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	moldura.add_theme_stylebox_override("panel", caixa(Color(0.05, 0.045, 0.04, 1), OURO.darkened(0.2) if livre else BORDA, 1, 26))
	var ic := TextureRect.new()
	ic.texture = icone_tex(P.ICONE.get(id, ""))
	ic.set_anchors_preset(Control.PRESET_FULL_RECT)
	ic.offset_left = 9
	ic.offset_top = 9
	ic.offset_right = -9
	ic.offset_bottom = -9
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.modulate = Color(1, 1, 1) if livre else Color(0.45, 0.45, 0.45)
	moldura.add_child(ic)
	l.add_child(moldura)
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.add_theme_constant_override("separation", 2)
	var cab := HBoxContainer.new()
	cab.add_child(rotulo(base.nome, 16, TEXTO if livre else APAGADO))
	if livre:
		cab.add_child(rotulo("   Nv %d/%d" % [nv, P.maximo(id)], 13, OURO))
	txt.add_child(cab)
	var d := rotulo(base.desc if livre else "Libera no nível %d. %s" % [int(base.libera), base.desc], 12, APAGADO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	txt.add_child(d)
	var nums := rotulo(P.linha(h), 13, Color(0.85, 0.8, 0.7) if livre else APAGADO)
	nums.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	txt.add_child(nums)
	if livre: # ataque básico também mostra a barra de usos (sobe até o 5 sem livro)
		if nv < P.maximo(id):
			var uso := HBoxContainer.new()
			uso.add_theme_constant_override("separation", 8)
			var b := barra_prog(float(P.uso_de(id)) / P.usos_para_subir(nv), Color(0.55, 0.42, 0.2), 6)
			b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			uso.add_child(b)
			uso.add_child(rotulo("%d/%d usos" % [P.uso_de(id), P.usos_para_subir(nv)], 12, APAGADO))
			txt.add_child(uso)
		var ti: int = P.tomo_para(id)
		if ti == -2:
			txt.add_child(rotulo(P.proximo(id), 12, Color(0.6, 0.75, 0.55)))
		else: # barra cheia do Nv 5 em diante: sobe com o Tomo
			var lt := HBoxContainer.new()
			lt.add_theme_constant_override("separation", 8)
			var nome_t: String = "%s %s" % [base.tomo, P.dados.romano[nv + 1]]
			lt.add_child(rotulo(("Pronta para o %s" if ti >= 0 else "Precisa do %s (cai dos monstros)") % nome_t, 12, Color("d9b4ff")))
			if ti >= 0:
				var bt := botao("Usar Tomo", func(): acao_item({"acao": "usar", "i": ti}), 13, true)
				bt.custom_minimum_size = Vector2(110, 32)
				lt.add_child(bt)
			txt.add_child(lt)
	if not base.get("basico", false):
		# em qual botão de cada barra ela fica (as gerais servem nas duas)
		for barra in ["espada", "cajado"]:
			if not P.cabe(id, barra):
				continue
			var bs := HBoxContainer.new()
			bs.add_theme_constant_override("separation", 5)
			bs.add_child(rotulo("Espada:" if barra == "espada" else "Cajado:", 13, APAGADO))
			var lista: Array = P.prog.barras[barra]
			var guia_i := -1 # guia.gd: skill fora da barra -> o primeiro botão vazio (ou o 1) pisca
			if lista.find(id) < 0 and barra == P.barra_de(m.h.modo):
				guia_i = maxi(0, lista.find(""))
			for i in lista.size():
				var nb := botao(str(i + 1), func(): por_no_botao(id, barra, i), 14, lista[i] == id)
				if i == guia_i:
					nb.set_meta("guia", "barra:livre")
				nb.custom_minimum_size = Vector2(40, 34)
				bs.add_child(nb)
			txt.add_child(bs)
	elif base.get("basico", false):
		txt.add_child(rotulo("Golpe da arma na mão (botão grande)", 12, Color(0.6, 0.75, 0.55)))
	l.add_child(txt)
	return cx

# ---------- profissões (Parte 3 do Quimera) ----------
const ICONE_PROF := {"min": "pf_min", "len": "pf_len", "pes": "pf_pes", "fer": "pf_fer", "alf": "pf_alf", "mer": "pf_mer", "faz": "pf_faz", "coz": "pf_coz"}
const COR_VIGOR := Color(0.55, 0.8, 0.42)

func icone_redondo(nome: String, tam: float, cor := Color.WHITE, borda := OURO) -> Control:
	var moldura := Panel.new()
	moldura.custom_minimum_size = Vector2(tam, tam)
	moldura.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	moldura.add_theme_stylebox_override("panel", caixa(Color(0.05, 0.045, 0.04, 1), borda.darkened(0.2), 1, int(tam / 2)))
	var ic := TextureRect.new()
	ic.texture = icone_tex(nome)
	ic.set_anchors_preset(Control.PRESET_FULL_RECT)
	var f := tam * 0.2
	ic.offset_left = f
	ic.offset_top = f
	ic.offset_right = -f
	ic.offset_bottom = -f
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.modulate = tinta(ic.texture, cor)
	ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
	moldura.add_child(ic)
	return moldura

static func tempo_txt(s: float) -> String:
	var mi := int(ceil(s / 60.0))
	if mi < 60:
		return "%d min" % mi
	return "%d h %02d min" % [mi / 60, mi % 60]

# vigor (energia para trabalhar) e ouro, em cima das profissões e das receitas
func linha_vigor() -> Control:
	var P = P_menu
	var v: float = P.vigor()
	var mx: float = P.vigor_max()
	var cx := VBoxContainer.new()
	cx.add_theme_constant_override("separation", 3)
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 8)
	var ic := TextureRect.new()
	ic.texture = icone_tex("vigor")
	ic.custom_minimum_size = Vector2(20, 20)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.modulate = COR_VIGOR
	ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(ic)
	l.add_child(rotulo("Vigor %d / %d" % [floor(v), int(mx)], 16, COR_VIGOR))
	l.add_child(rotulo("   cheio" if v >= mx - 0.01 else "   cheio em %s" % tempo_txt(P.vigor_cheio_em()), 13, APAGADO))
	var esp_ := Control.new()
	esp_.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	l.add_child(esp_)
	l.add_child(linha_ouro())
	cx.add_child(l)
	cx.add_child(barra_prog(v / mx, COR_VIGOR.darkened(0.15), 7))
	var d := rotulo("Coletar e criar gastam vigor. Ele volta sozinho: +%d a cada %d h, mesmo com o jogo fechado." % [int(mx), int(P.dados.vigor.enche) / 3600], 12, APAGADO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	cx.add_child(d)
	return cx

func montar_profissoes() -> void:
	var P = P_menu
	conteudo.add_child(linha_vigor())
	var grupo := ""
	for k in P.dados.profissoes:
		var pf: Dictionary = P.dados.profissoes[k]
		if pf.grupo != grupo:
			grupo = pf.grupo
			separador(grupo)
		conteudo.add_child(linha_prof_card(k))
	separador("Ranks")
	var ranks: Array = P.dados.ranks
	var t := "Sobe sozinha trabalhando. Cada rank (a cada 2 níveis; o 19 e o 20 têm rank próprio): -4% de vigor, +3,5% de rapidez e +2% de chance de +1 na coleta. Criar: mais chance de a peça sair Rara ou Épica."
	var d := rotulo(t, 12, APAGADO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	conteudo.add_child(d)
	var g := GridContainer.new()
	g.columns = 4
	g.add_theme_constant_override("h_separation", 18)
	g.add_theme_constant_override("v_separation", 2)
	for r in ranks.size():
		var nv := "20" if r == 10 else "19" if r == 9 else "%d-%d" % [2 * r + 1, 2 * r + 2]
		g.add_child(rotulo("%s  ·  Nv %s" % [ranks[r], nv], 12, OURO_CLARO if r == 0 else TEXTO))
	conteudo.add_child(g)

# ---------- Títulos (André 2026-11-12) ----------
# Todos os títulos, os ganhos primeiro em cada grupo. Cada um: nome na cor do brilho, como ganhou e o bônus
# ("Venceu o Uivo-Rei · +5% crítico"). Tocar em Usar põe o título em cima da cabeça e liga o bônus (o servidor confere);
# Tirar deixa sem título. Os que faltam ficam apagados, com o feito que falta.
const GRUPOS_TITULO := [["caca", "Caça"], ["guerra", "Guerra"], ["boss", "Bosses de mundo"], ["historia", "História"], ["prof", "Profissões"]] # Guerra: Patente de Guerra (André 2026-11-26)
func grupo_titulo(T: Dictionary) -> String:
	var c: Dictionary = T.get("cond", {})
	if c.has("boss"):
		return "boss"
	if c.has("prof"):
		return "prof"
	if c.has("abates"):
		return "caca"
	if c.has("pat"):
		return "guerra"
	return "historia"

func montar_titulos() -> void:
	var P = P_menu
	var todos: Dictionary = Titulos.dados_de(P)
	var tit = P.prog.get("tit")
	var tem: Array = tit.get("tem", []) if tit is Dictionary else []
	var uso: String = str(tit.get("uso", "")) if tit is Dictionary else ""
	var d := rotulo("Um título em uso por vez: ele aparece em cima da sua cabeça e o bônus só vale enquanto está em uso. Troque quando quiser. Quanto mais difícil, mais brilhante.", 12, APAGADO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	conteudo.add_child(d)
	separador("Em uso")
	if uso != "" and todos.has(uso):
		conteudo.add_child(card_titulo(uso, todos[uso], true, true))
	else:
		conteudo.add_child(rotulo("Nenhum. Toque em Usar num título ganho.", 13, APAGADO))
	var n := 0
	for id in todos:
		if id in tem:
			n += 1
	for g in GRUPOS_TITULO:
		var ids: Array = todos.keys().filter(func(id): return grupo_titulo(todos[id]) == g[0])
		if ids.is_empty():
			continue
		ids.sort_custom(func(a, b):
			var ta: bool = a in tem
			var tb: bool = b in tem
			if ta != tb:
				return ta
			return int(todos[a].get("r", 0)) < int(todos[b].get("r", 0)))
		var ganhos: int = ids.filter(func(id): return id in tem).size()
		separador("%s  ·  %d de %d" % [g[1], ganhos, ids.size()])
		for id in ids:
			conteudo.add_child(card_titulo(id, todos[id], id in tem, id == uso))

func card_titulo(id: String, T: Dictionary, ganho: bool, em_uso: bool) -> Control:
	var r: int = clampi(int(T.get("r", 0)), 0, 4)
	var cor: Color = Titulos.COR[r] if ganho else Color(0.45, 0.42, 0.38)
	var cx := PanelContainer.new()
	var fundo := Color(0.1, 0.088, 0.072, 1) if ganho else Color(0.07, 0.064, 0.056, 1)
	cx.add_theme_stylebox_override("panel", caixa(fundo, cor.darkened(0.35) if ganho and r >= 2 else Color(0.3, 0.24, 0.16) if ganho else Color(0.18, 0.16, 0.13), 2 if em_uso else 1, 8))
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 10)
	cx.add_child(l)
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.add_theme_constant_override("separation", 1)
	var nome := rotulo(Titulos.enfeite(str(T.nome), r) if ganho else str(T.nome), 16, cor)
	if ganho and r >= 3:
		nome.add_theme_color_override("font_outline_color", Titulos.CONTORNO[r])
		nome.add_theme_constant_override("outline_size", 4)
	txt.add_child(nome)
	var raridade: String = str(P_menu.dados.raridades[r].nome) if r < P_menu.dados.raridades.size() else ""
	var dsc := rotulo("%s · %s" % [str(T.como), str(T.txt)] if str(T.txt) != "" else str(T.como), 12, TEXTO if ganho else APAGADO) # patente: sem bônus
	dsc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	txt.add_child(dsc)
	if raridade != "":
		txt.add_child(rotulo(raridade, 11, Titulos.COR[r].darkened(0.15) if ganho else APAGADO.darkened(0.3)))
	l.add_child(txt)
	var b: Button
	if not ganho:
		b = botao("Falta", func(): m.hud.aviso("Para ganhar: %s" % str(T.como)), 13)
		b.modulate = Color(1, 1, 1, 0.6)
	elif em_uso:
		b = botao("Tirar", func(): acao_item({"acao": "titulo", "id": ""}), 13, true)
	else:
		b = botao("Usar", func(): acao_item({"acao": "titulo", "id": id}), 13)
	b.custom_minimum_size = Vector2(86, 38)
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(b)
	return cx

# ---------- Missões (progressão até o Nv 100, André 2026-11-11: "um menu de missões") ----------
# História v2 (André 2026-11-11, "Aethra: a Crônica da Névoa"): a aba vira o livro da história. Capítulos em ordem,
# agrupados por ato. Capítulo feito: a página do Diário (o que aconteceu) e os rumores ouvidos. Capítulo da vez: as
# missões dele, e na missão da vez cada etapa (feita, a da vez com o andamento, as próximas) e o "Ir para". Capítulo
# que ainda não chegou: só o número e o nível (o nome aparece quando o herói chega no nível dele).
# ---------- Diárias (André 2026-11-16) ----------
# As 4 diárias de hoje (o servidor manda o resumo no progresso: shared/diarias.js diariasInfo). Cada uma: o que pede, o
# prêmio, a barra e o botão (Ir enquanto falta; Receber quando terminou). Embaixo, o bônus de fazer as 4. O dia vira à
# meia-noite de Brasília: o relógio "Novas em" conta a partir de quando o resumo chegou.
const VERDE_DIARIA := Color(0.6, 0.9, 0.55)
var _bolinha: PanelContainer = null
func diarias_prontas() -> int:
	var n := 0
	for d in P_menu.diarias.get("l", []):
		if int(d.n) >= int(d.t) and not d.get("r", false):
			n += 1
	return n

# bolinha vermelha na aba Diárias: quantas estão prontas para receber
func _bolinha_diarias() -> void:
	var b: Button = botoes_aba.get("diarias")
	if b == null:
		return
	if _bolinha == null:
		_bolinha = PanelContainer.new()
		_bolinha.add_theme_stylebox_override("panel", caixa(Color(0.85, 0.24, 0.2), Color(1, 0.85, 0.8), 1, 10))
		_bolinha.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var l := rotulo("0", 11, Color.WHITE)
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		l.custom_minimum_size = Vector2(16, 0)
		_bolinha.add_child(l)
		b.add_child(_bolinha)
		_bolinha.position = Vector2(b.custom_minimum_size.x - 18, -6)
	var n := diarias_prontas()
	_bolinha.visible = n > 0 and b.visible
	var lb := _bolinha.get_child(0) as Label
	if lb.text != str(n):
		lb.text = str(n)

func montar_diarias() -> void:
	var D: Dictionary = P_menu.diarias
	if D.is_empty() or not D.has("l"):
		conteudo.add_child(rotulo("Diárias abrem no Nv %d." % 8, 14, APAGADO))
		return
	var falta := maxf(0.0, float(D.get("fim", 0)) - float(Time.get_ticks_msec() - P_menu.diarias_t))
	conteudo.add_child(rotulo("Novas em %d h %d min" % [int(falta / 3600000.0), int(fmod(falta, 3600000.0) / 60000.0)], 13, APAGADO))
	var feitas := 0
	for d in D.l:
		var ok: bool = int(d.n) >= int(d.t)
		var recebida: bool = d.get("r", false) == true
		if recebida:
			feitas += 1
		var pc := PanelContainer.new()
		pc.add_theme_stylebox_override("panel", caixa(FUNDO2, VERDE_DIARIA if ok and not recebida else Color(0.3, 0.26, 0.2), 2 if ok and not recebida else 1, RAIO_JANELA))
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 10)
		pc.add_child(h)
		var v := VBoxContainer.new()
		v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		v.add_theme_constant_override("separation", 3)
		h.add_child(v)
		var nome := rotulo(str(d.txt), 16, VERDE_DIARIA if ok else TEXTO)
		if ok:
			nome.text = "✓ " + nome.text
		v.add_child(nome)
		v.add_child(rotulo("Prêmio: %d ouro · %d XP" % [int(D.get("ouro", 0)), int(D.get("xp", 0))], 12, OURO))
		var linha := HBoxContainer.new()
		linha.add_theme_constant_override("separation", 8)
		var bp := barra_prog(clampf(float(d.n) / maxf(1.0, float(d.t)), 0.0, 1.0), VERDE_DIARIA if ok else LILAS, 10.0)
		bp.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		linha.add_child(bp)
		linha.add_child(rotulo("%d/%d" % [int(d.n), int(d.t)], 13, TEXTO))
		v.add_child(linha)
		var id := str(d.id)
		if not recebida:
			v.add_child(botao_fixar("diaria", id))
		var bt: Button
		if recebida:
			bt = botao("Recebida", func(): pass, 15)
			bt.disabled = true
		elif ok:
			bt = botao("Receber", func(): rede("diaria", {"acao": "receber", "id": id}), 15, true)
		else:
			bt = botao("Ir", func(): rede("diaria", {"acao": "ir", "id": id}), 15)
		bt.custom_minimum_size = Vector2(110, 44)
		bt.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		h.add_child(bt)
		conteudo.add_child(pc)
	var pb := PanelContainer.new()
	var b_ok: bool = D.get("b", false) == true
	pb.add_theme_stylebox_override("panel", caixa(Color(0.14, 0.115, 0.08, 1), VERDE_DIARIA if b_ok else OURO, 1, RAIO_JANELA))
	var vb := VBoxContainer.new()
	pb.add_child(vb)
	var lb := rotulo("Faça as 4: bônus de %d ouro" % int(D.get("bonus", 0)), 15, VERDE_DIARIA if b_ok else OURO_CLARO)
	if b_ok:
		lb.text = "✓ " + lb.text
	vb.add_child(lb)
	vb.add_child(rotulo("%d de %d feitas hoje" % [feitas, D.l.size()], 12, APAGADO))
	conteudo.add_child(pb)

# o servidor respondeu o "Ir" de uma diária (evento diaria_ir): fecha o menu e vai pela estrada, como o Ir da missão
# Clã e recrutas (André 2026-11-22; regras em shared/cla.js): sem clã, o nome para fundar; com clã, o cofre, a semana,
# os membros (dispensar), os recursos nas bolsas dos recrutas, os 3 níveis do Recrutador e os últimos gastos.
var _cla_nome: LineEdit
# Base do clã (André 2026-11-22, shared/base.js): sem base, o botão de fundar onde estou e a tabela dos níveis; com
# base, onde fica, o nível, a taxa da semana (sai do cofre) e de quem é cada lote
# fecha o menu e liga a prévia da base (base_cla.gd comecar_escolha)
func _escolher_base() -> void:
	fechar()
	if m.minimapa: # o mapa com as áreas verdes (André 2026-11-22); a prévia andando (base_cla.gd) continua lá
		m.minimapa.abrir_base()
	elif m.base_cla:
		m.base_cla.comecar_escolha()

# Escolta do Clã (André 2026-11-23, shared/missao-cla.js): levar os recrutas vivos até o totem mais perto (300 m ou
# mais), com emboscadas no nível do líder que vão primeiro neles. Quem chega ganha 1 nível de XP.
func _escolta_cla(vs: VBoxContainer, Mi) -> void:
	if not (Mi is Dictionary):
		return
	vs.add_child(rotulo("Missão do clã: Escolta", 16, OURO_CLARO))
	if int(Mi.get("ativa", 0)) == 1:
		vs.add_child(rotulo("Levando %d recruta(s) até %s · emboscada %d de %d · faltam %s" % [int(Mi.rec), str(Mi.dest), int(Mi.emb), int(Mi.embs), _tempo_cla(int(Mi.falta) * 1000)], 13, TEXTO))
		var dx := float(Mi.x)
		var dz := float(Mi.z)
		var nome := str(Mi.dest)
		var bi := botao("Ir até %s" % nome, func():
			fechar()
			if m.rota:
				m.rota.ir(m.rota.planejar(Vector2(dx, dz)), "Indo para " + nome), 14)
		bi.custom_minimum_size = Vector2(0, 42)
		vs.add_child(bi)
	elif int(Mi.get("espera", 0)) > 0:
		vs.add_child(rotulo("Próxima escolta em %s." % _tempo_cla(int(Mi.espera)), 12, APAGADO))
	else:
		vs.add_child(rotulo("Leve os recrutas vivos até o totem mais perto (300 m ou mais) em 10 min. No caminho vêm 4 emboscadas no seu nível, e os monstros vão primeiro nos recrutas: bata neles para segurar. Quem chegar ganha 1 nível de XP; o cofre ganha ouro e você, 1 Fragmento de Alma. Abra no Baú do Clã, com os recrutas perto. Cumprida, a próxima abre em 6 h; se falhar, pode tentar de novo na hora.", 12, APAGADO))
		var be := botao("Começar a escolta", func(): rede("cla", {"acao": "missao"}), 15, true)
		be.custom_minimum_size = Vector2(0, 44)
		vs.add_child(be)

func _base_cla(C: Dictionary) -> void:
	var cs := PanelContainer.new()
	cs.add_theme_stylebox_override("panel", caixa(FUNDO2, OURO.darkened(0.35), 1, 10))
	var vs := VBoxContainer.new()
	vs.add_theme_constant_override("separation", 3)
	cs.add_child(vs)
	var B = C.get("base")
	if B is Dictionary and B.get("missao") is Dictionary: # a escolta num cartão próprio, antes da base (André 2026-11-23: "não tô achando a missão do clã")
		var ce := PanelContainer.new()
		ce.add_theme_stylebox_override("panel", caixa(FUNDO2, OURO, 2, 10))
		var ve := VBoxContainer.new()
		ve.add_theme_constant_override("separation", 3)
		ce.add_child(ve)
		_escolta_cla(ve, B.missao)
		conteudo.add_child(ce)
	if B is Dictionary:
		vs.add_child(rotulo("Base do clã · Nv %d" % int(B.nv), 16, OURO_CLARO))
		var h: Vector3 = m.heroi.position if m.heroi != null else Vector3.ZERO
		var dist := Vector2(float(B.x) - h.x, float(B.z) - h.z).length()
		vs.add_child(rotulo("%s · centro de %d m · área de %d m · %s" % [str(B.tem), int(B.centro), int(B.raio), "você está nela" if dist < float(B.raio) else "a %d m daqui" % int(dist)], 13, TEXTO))
		if int(B.get("trava", 0)) == 1:
			vs.add_child(rotulo("Taxa atrasada: %d de ouro. Deposite no cofre: até pagar, não dá para construir nem abrir o Baú do Clã." % int(B.devendo), 13, Color(1.0, 0.6, 0.5)))
		elif int(B.get("atraso", 0)) > 0:
			vs.add_child(rotulo("Taxa da semana: %d de ouro (atrasada: deposite no cofre)" % int(B.taxa), 13, Color(1.0, 0.8, 0.5)))
		else:
			vs.add_child(rotulo("Taxa: %d de ouro por semana, sai do cofre. Próxima em %s." % [int(B.taxa), _tempo_cla(int(B.get("prox", 0)))], 13, TEXTO))
		var ls := []
		for l in B.get("lotes", []):
			ls.append("%d: %s" % [int(l.i), str(l.dono) if str(l.dono) != "" else "livre"])
		vs.add_child(rotulo("Lotes · " + ", ".join(PackedStringArray(ls)), 13, TEXTO))
		# realocar (André 2026-11-22): a 1ª grátis; depois ouro do cofre e espera (shared/base.js moverBase)
		var custo := int(B.get("mudar", 0))
		var espera := int(B.get("mudarEm", 0))
		var livres := int(B.get("livres", 0))
		var tm := ("Mudar a base de lugar (grátis, faltam %d)" % livres) if livres > 0 else "Mudar a base de lugar (grátis)" if custo == 0 else "Mudar a base de lugar (%d de ouro)" % custo
		if espera > 0:
			vs.add_child(rotulo("Pode mudar a base de novo em %s." % _tempo_cla(espera), 12, APAGADO))
		else:
			var bm := botao(tm, func():
				fechar()
				if m.minimapa:
					m.minimapa.abrir_base(true), 14)
			bm.custom_minimum_size = Vector2(0, 42)
			vs.add_child(bm)
	else:
		vs.add_child(rotulo("Base do clã", 16, OURO_CLARO))
		vs.add_child(rotulo("Vá até o lugar e funde a base onde você está. No meio fica o salão com o Baú do Clã; em volta, o seu lote e um lote para cada recruta. Sem aluguel: a taxa sai do cofre toda semana.", 12, APAGADO))
		vs.add_child(rotulo("Não pode: a menos de 20 m de totem e de NPC de missão, 10 m de vila, masmorra, arena e cais, 6 m de rio, 3 m de estrada e 100 m de outra base; na água; em morro de mais de 20 m de desnível. O chão da base é nivelado e ganha uma estrada até a estrada mais perto. Nas terras do começo, só no território da sua raça (Ilha do Meio e Aurora são livres).", 11, APAGADO))
		var bf := botao("Escolher o lugar da base", _escolher_base, 15, true)
		bf.custom_minimum_size = Vector2(0, 44)
		vs.add_child(bf)
	var tab := []
	for N in C.get("baseNiveis", []):
		tab.append("Nv %d: centro %d m, %d lote%s, %d/semana, %s" % [int(N.nv), int(N.centro), int(N.lotes), "s" if int(N.lotes) > 1 else "", int(N.taxa), str(N.tem).to_lower()])
	if not tab.is_empty():
		vs.add_child(rotulo("\n".join(PackedStringArray(tab)), 11, APAGADO))
	conteudo.add_child(cs)

# fila de símbolos que quebra a linha sozinha (materiais, estoque)
func _fila_icones() -> HFlowContainer:
	var f := HFlowContainer.new()
	f.add_theme_constant_override("h_separation", 6)
	f.add_theme_constant_override("v_separation", 4)
	return f

# { item: quantidade } em símbolos com a quantidade embaixo
func _icones_estoque(d: Dictionary) -> HFlowContainer:
	var f := _fila_icones()
	for k in d:
		if P_menu.dados.itens.has(str(k)):
			f.add_child(icone_material(str(k), int(d[k]), 0, {}, "", true))
	return f

# Despensa do clã (André 2026-11-24, DESPENSA em shared/dados.js e shared/cla.js): a comida do Baú do Clã em símbolos
# com a quantidade, as rações (tenho/o que 2 dias pedem) e a lenha da semana da base (tenho/preciso). Nada de lista.
func _despensa_cla(C: Dictionary) -> void:
	if not (C.get("dsp") is Dictionary):
		return
	var D: Dictionary = C.dsp
	var cs := PanelContainer.new()
	var fome := int(D.get("fome", 0)) == 1 or (D.get("lenha") is Dictionary and int(D.lenha.get("frio", 0)) == 1)
	cs.add_theme_stylebox_override("panel", caixa(FUNDO2, Color(0.88, 0.5, 0.42, 0.9) if fome else OURO.darkened(0.35), 1, 10))
	var vs := VBoxContainer.new()
	vs.add_theme_constant_override("separation", 4)
	cs.add_child(vs)
	vs.add_child(rotulo("Despensa", 16, OURO_CLARO))
	if int(D.get("bau", 0)) == 0:
		vs.add_child(rotulo("Sem Baú do Clã não há despensa: funde a base do clã.", 12, APAGADO))
		conteudo.add_child(cs)
		return
	var est := str(D.get("estado", ""))
	var mult := float(D.get("mult", 0))
	if est != "":
		vs.add_child(rotulo("%s: %s%d%% de dano e XP nos recrutas" % [est, "+" if mult > 0 else "", roundi(mult * 100)], 14, VERDE if mult > 0 else Color(1.0, 0.55, 0.45)))
	var f := _fila_icones()
	# rações: o que tem / o que 2 dias pedem (bem alimentados); tocar explica
	var rac: Dictionary = D.get("racao", {})
	f.add_child(icone_material("carne_assada", int(D.get("tem", 0)), int(D.get("bem", 0)), {},
		"Rações: %d moradores comem %d por dia. %d (2 dias) e %d comidas diferentes = Bem alimentados" % [int(D.get("n", 1)), int(D.get("dia", 0)), int(D.get("bem", 0)), int(D.get("tiposBem", 3))]))
	if D.get("lenha") is Dictionary:
		var Lw: Dictionary = D.lenha
		var pede := int(Lw.get("semana", 0)) + int(Lw.get("deve", 0))
		f.add_child(icone_material("lenha", int(Lw.get("tem", 0)), pede, {}, "Lenha da base: %d por semana%s" % [int(Lw.get("semana", 0)), (", faltam %d" % int(Lw.get("deve", 0))) if int(Lw.get("deve", 0)) > 0 else ""]))
	var kk: Dictionary = D.get("k", {})
	for k in kk:
		if P_menu.dados.itens.has(str(k)):
			var r := int(rac.get(k, 1))
			f.add_child(icone_material(str(k), int(kk[k]), 0, {}, "%s · %d %s" % [str(P_menu.dados.itens[k].nome), r, "ração" if r == 1 else "rações"], true))
	vs.add_child(f)
	if D.get("lenha") is Dictionary and int(D.lenha.get("frio", 0)) == 1:
		vs.add_child(rotulo("Base sem lenha: deixou de ser área segura. Ponha lenha no Baú do Clã.", 12, Color(1.0, 0.55, 0.45)))
	elif kk.is_empty():
		vs.add_child(rotulo("Ponha comida no Baú do Clã. Prato do fogão rende mais que peixe cru.", 12, APAGADO))
	conteudo.add_child(cs)

# Patente de Guerra (André 2026-11-26, shared/patente.js guerraInfo): placar do mês Chama x Geada e o escudo com anel de
# cada um do clã (você e os recrutas), sem lista de texto. Tocar num escudo: "Sargento · 64% para Tenente".
const PatenteG = preload("res://patente.gd")
func _guerra_cla(C: Dictionary) -> void:
	var G = C.get("gu")
	if not (G is Dictionary):
		return
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(FUNDO2, OURO.darkened(0.35), 1, 10))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	cx.add_child(v)
	var cab := HBoxContainer.new()
	var tt := rotulo("Guerra do mês", 16, OURO_CLARO)
	tt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cab.add_child(tt)
	cab.add_child(rotulo("Clã: %d abates" % int(G.get("cla", 0)), 14, TEXTO))
	v.add_child(cab)
	# placar: escudo Chama, números, escudo Geada
	var pl := HBoxContainer.new()
	pl.alignment = BoxContainer.ALIGNMENT_CENTER
	pl.add_theme_constant_override("separation", 12)
	var R: Dictionary = G.get("r", {})
	for lado in ["chama", "geada"]:
		var ic := TextureRect.new()
		ic.texture = PatenteG.textura(lado, 3)
		ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ic.custom_minimum_size = Vector2(44, 44)
		var n := rotulo(str(int(R.get(lado, 0))), 28, Color("ff9a3c") if lado == "chama" else Color("8fd0ff"))
		if lado == "chama":
			pl.add_child(ic)
			pl.add_child(n)
			pl.add_child(rotulo("x", 20, APAGADO))
		else:
			pl.add_child(n)
			pl.add_child(ic)
	v.add_child(pl)
	# escudos do clã: você primeiro
	var fl := HFlowContainer.new()
	fl.add_theme_constant_override("h_separation", 10)
	fl.add_theme_constant_override("v_separation", 8)
	var raca := str(m.online.eu_raca) if m.online else ""
	var todos: Array = []
	if G.get("eu") is Dictionary:
		var eu: Dictionary = G.eu.duplicate()
		eu["nome"] = "Você"
		todos.append(eu)
	todos.append_array(G.get("m", []))
	for o in todos:
		fl.add_child(_escudo_guerra(o, raca))
	v.add_child(fl)
	v.add_child(rotulo("Anel = quanto falta para a próxima patente. Dia 1º volta a Recruta e cada um ganha o prêmio da patente que pegou; o título da maior fica.", 11, APAGADO))
	conteudo.add_child(cx)

func _escudo_guerra(o: Dictionary, raca: String) -> Control:
	var i := int(o.get("i", 0))
	var pct := float(o.get("pct", 0.0))
	var b := VBoxContainer.new()
	b.custom_minimum_size = Vector2(76, 0)
	b.add_theme_constant_override("separation", 0)
	var d := Control.new()
	d.custom_minimum_size = Vector2(76, 60)
	d.mouse_filter = Control.MOUSE_FILTER_STOP
	d.draw.connect(func(): PatenteG.desenhar(d, Vector2(38, 30), 24.0, raca, i, pct))
	d.gui_input.connect(func(ev):
		if (ev is InputEventMouseButton or ev is InputEventScreenTouch) and ev.pressed:
			m.hud.aviso("%s: %s · %d abates no mês" % [str(o.get("nome", "")), PatenteG.texto(i, pct), int(o.get("a", 0))]))
	b.add_child(d)
	var n := rotulo(str(o.get("nome", "")), 13, TEXTO)
	n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	n.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	n.custom_minimum_size = Vector2(76, 18)
	b.add_child(n)
	var s := rotulo("%d abates" % int(o.get("a", 0)), 12, APAGADO)
	s.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	b.add_child(s)
	return b

func _jantar_cla(C: Dictionary) -> void:
	# o jantar do clã (shared/jantar.js): chamar os recrutas para a mesa uma vez por dia; o resto é na janela do jantar
	if not (C.get("jantar") is Dictionary):
		return
	var J: Dictionary = C.jantar
	var cs := PanelContainer.new()
	cs.add_theme_stylebox_override("panel", caixa(FUNDO2, OURO.darkened(0.35), 1, 10))
	var vs := VBoxContainer.new()
	vs.add_theme_constant_override("separation", 4)
	cs.add_child(vs)
	vs.add_child(rotulo("Jantar do clã", 16, OURO_CLARO))
	var fase := str(J.get("fase", ""))
	var txt := "Chame até 7 recrutas para a Mesa do Clã. Com você junto: moral dos recrutas sobe e você ganha o Banquete do clã."
	var cor := APAGADO
	if int(J.get("tem", 0)) == 0:
		txt = "Sem Mesa do Clã: construa uma na base (aba Móveis)."
	elif fase == "chamando":
		txt = "Recrutas indo para a mesa. Ponha a comida e sirva."
		cor = VERDE
	elif fase == "comendo":
		txt = "Jantar servido: estão comendo."
		cor = VERDE
	elif int(J.get("feito", 0)) == 1:
		txt = "Jantar de hoje já feito. Amanhã tem mais."
	vs.add_child(rotulo(txt, 12, cor))
	if int(J.get("tem", 0)) == 1:
		var b := botao("Jantar do clã", func(): m.jantar.abrir(), 15, true)
		b.custom_minimum_size = Vector2(0, 44)
		vs.add_child(b)
	conteudo.add_child(cs)

func _tempo_cla(ms: int) -> String:
	var hs := int(ms / 3600000)
	return "%d dia%s" % [int(hs / 24), "s" if int(hs / 24) != 1 else ""] if hs >= 24 else "%d h" % maxi(1, hs)

func montar_cla() -> void:
	var C: Dictionary = P_menu.cla
	if not m.on() and not _aquecendo:
		conteudo.add_child(rotulo("O clã só funciona online.", 14, APAGADO))
		return
	if C.is_empty():
		conteudo.add_child(rotulo("Carregando o clã...", 14, APAGADO))
		return
	# o botão de reset (André 2026-11-23) mudou para Configurações > Ajustes (André 2026-11-24: "coloca os 2 botões na aba configurações")
	if int(C.get("sem", 0)) == 1:
		conteudo.add_child(rotulo("Funde o seu clã", 20, OURO_CLARO))
		conteudo.add_child(rotulo("Você será o líder. Depois, fale com o Recrutador (Clareira ou Juncal) para contratar soldados.", 14, TEXTO))
		_cla_nome = LineEdit.new()
		_cla_nome.placeholder_text = Idioma.frase("Nome do clã")
		_cla_nome.max_length = 20
		_cla_nome.custom_minimum_size = Vector2(0, 48)
		_cla_nome.add_theme_font_size_override("font_size", 18)
		conteudo.add_child(_cla_nome)
		var bf := botao("Fundar clã", func(): rede("cla", {"acao": "fundar", "nome": _cla_nome.text.strip_edges()}), 17, true)
		bf.custom_minimum_size = Vector2(0, 50)
		conteudo.add_child(bf)
		return
	var cab := PanelContainer.new()
	cab.add_theme_stylebox_override("panel", caixa(FUNDO2, OURO, 2, RAIO_JANELA))
	var vc := VBoxContainer.new()
	vc.add_theme_constant_override("separation", 4)
	cab.add_child(vc)
	vc.add_child(rotulo("Clã %s" % str(C.get("n", "")), 20, OURO_CLARO))
	vc.add_child(rotulo("Clã Nv %d · Líder: você · %d/%d recrutas" % [int(C.get("nv", 1)), (C.get("m", []) as Array).size(), int(C.get("max", 6))], 13, TEXTO))
	var falta := maxf(0.0, float(C.get("prox", 0)) - float(Time.get_ticks_msec() - P_menu.cla_t))
	var cofre := int(C.get("cofre", 0))
	var semana := int(C.get("semana", 0))
	vc.add_child(rotulo("Cofre: %d de ouro · Semana: %d de ouro" % [cofre, semana], 15, OURO))
	_cla_vivos = {}
	_cla_chave = _chave_cla()
	_cla_vivos["_cobranca"] = rotulo(_texto_cobranca(falta), 12, Color(1.0, 0.55, 0.45) if cofre < semana else APAGADO)
	vc.add_child(_cla_vivos["_cobranca"])
	conteudo.add_child(cab)
	# sem base ainda (André 2026-11-22: "como é que eu faço para escolher o terreno?"): o botão logo no topo
	if not (C.get("base") is Dictionary):
		conteudo.add_child(rotulo("Seu clã ainda não tem base. Toque abaixo: o mapa mostra em verde onde dá para fundar.", 13, OURO_CLARO))
		var fb := botao("Escolher o lugar da base", _escolher_base, 17, true)
		fb.custom_minimum_size = Vector2(0, 50)
		conteudo.add_child(fb)
	# cofre: depositar e sacar
	var lc := HBoxContainer.new()
	lc.add_theme_constant_override("separation", 6)
	for v in C.get("dep", [100, 1000]):
		lc.add_child(botao("+%d" % int(v), func(): rede("cla", {"acao": "depositar", "ouro": int(v)}), 14))
	lc.add_child(botao("Sacar 100", func(): rede("cla", {"acao": "sacar", "ouro": 100}), 14))
	conteudo.add_child(lc)
	# nível do clã (André 2026-11-22: "fosse uma coisa progressiva"): o que o próximo pede e o que já tem
	if C.get("sobe") is Dictionary:
		var S: Dictionary = C.sobe
		var cs := PanelContainer.new()
		cs.add_theme_stylebox_override("panel", caixa(FUNDO2, OURO.darkened(0.35), 1, 10))
		var vs := VBoxContainer.new()
		vs.add_theme_constant_override("separation", 3)
		cs.add_child(vs)
		var nv_ok := int(P_menu.prog.get("nivel", 1)) >= int(S.lider)
		var ouro_ok := int(C.get("cofre", 0)) >= int(S.ouro)
		var tudo := nv_ok and ouro_ok
		for it in S.get("itens", []):
			tudo = tudo and int(it.tem) >= int(it.n)
		# André 2026-11-24: igual ao painel.html, ícones com tenho/preciso no lugar da lista de texto
		var tl := HBoxContainer.new()
		var tt := rotulo("Próximo nível: clã Nv %d (%d vagas)" % [int(S.nv), int(S.nv)], 16, OURO_CLARO)
		tt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		tl.add_child(tt)
		if tudo:
			tl.add_child(rotulo("Pronto!", 14, VERDE_DIARIA))
		vs.add_child(tl)
		var fi := HFlowContainer.new()
		fi.add_theme_constant_override("h_separation", 8)
		fi.add_theme_constant_override("v_separation", 6)
		fi.add_child(_icone_req_cla(null, "Nv", "Seu nível", int(P_menu.prog.get("nivel", 1)), int(S.lider)))
		fi.add_child(_icone_req_cla(icone_tex("it_ouro"), "", "Ouro no cofre", int(C.get("cofre", 0)), int(S.ouro)))
		for it in S.get("itens", []):
			if P_menu.dados.itens.has(str(it.k)):
				fi.add_child(icone_material(str(it.k), mini(int(it.tem), int(it.n)), int(it.n)))
			else:
				fi.add_child(_icone_req_cla(null, str(it.nome).substr(0, 2), str(it.nome), int(it.tem), int(it.n)))
		vs.add_child(fi)
		vs.add_child(rotulo("Conta o Baú do Clã e a sua mochila. Toque num ícone para ver o nome. Fragmento de Alma: derrube quem é da outra raça.", 11, APAGADO))
		var bm := botao("Melhorar clã", func(): rede("cla", {"acao": "melhorar"}), 15, tudo)
		bm.custom_minimum_size = Vector2(0, 44)
		vs.add_child(bm)
		conteudo.add_child(cs)
	_base_cla(C)
	_despensa_cla(C)
	_jantar_cla(C)
	_guerra_cla(C) # Patente de Guerra (André 2026-11-26)
	# membros (André 2026-11-22: "apareça eu no painel... nível Hp mana e vigor... determinar funções")
	conteudo.add_child(rotulo("Membros", 17, OURO_CLARO))
	var ms: Array = C.get("m", [])
	if C.has("eu"):
		conteudo.add_child(_cartao_cla(C.eu, "Líder · Nv %d" % int(C.eu.get("nv", 1)), null, ms, C))
	if ms.is_empty():
		conteudo.add_child(rotulo("Nenhum recruta ainda.", 13, APAGADO))
	for r in ms:
		conteudo.add_child(_cartao_cla(r, "%s Nv %d · %d/semana" % [str(r.tier), int(r.nv), int(r.sem)], r, ms, C))
	_cla_vivo()
	# dispensados há pouco (André 2026-11-24): 10 minutos para chamar de volta pagando a taxa
	for dd in C.get("disp", []):
		var did := str(dd.id)
		var bv := botao("Chamar %s de volta (Nv %d) · %d de ouro" % [str(dd.nome), int(dd.get("nv", 1)), int(dd.get("taxa", 0))], func(): rede("cla", {"acao": "chamarVolta", "id": did}), 14)
		bv.disabled = int(P_menu.prog.get("ouro", 0)) < int(dd.get("taxa", 0))
		bv.custom_minimum_size = Vector2(0, 44)
		conteudo.add_child(bv)
	if not C.get("disp", []).is_empty():
		conteudo.add_child(rotulo("Dispensado há pouco: até 10 minutos depois de dispensar, dá para chamar de volta.", 12, APAGADO))
	# recursos nas bolsas dos recrutas
	# (André 2026-11-24: nada de lista: cada item no símbolo com a quantidade)
	var rec: Dictionary = C.get("rec", {})
	if not rec.is_empty():
		conteudo.add_child(rotulo("Recursos com os recrutas", 13, TEXTO))
		conteudo.add_child(_icones_estoque(rec))
	# Baú do Clã (base no seu terreno, André 2026-11-22)
	if C.get("bauCla") is Dictionary:
		var bc: Dictionary = C.bauCla
		conteudo.add_child(rotulo("Baú do Clã" if not bc.is_empty() else "Baú do Clã: vazio", 13, TEXTO))
		if not bc.is_empty():
			conteudo.add_child(_icones_estoque(bc))
	else:
		conteudo.add_child(rotulo("Sem Baú do Clã: funde a base do clã (o salão tem um na porta) ou crie um na construção (aba Móveis).", 12, APAGADO))
	# os clãs bot (André 2026-11-22): o inimigo (Lobos da Geada, do Gael) e quem mais existir
	for K in C.get("clas", []):
		var ini := int(K.get("inimigo", 0)) == 1
		var nv_l := int(K.get("nvLider", 0)) # André 2026-11-24: o nível do líder também, não só o dos recrutas
		conteudo.add_child(rotulo("%s %s Nv %d (%s) · líder %s%s · %d recrutas" % ["Inimigo:" if ini else "Neutro:", str(K.n), int(K.get("nv", 1)), str(K.get("raca", "")), str(K.lider), ((" Lv %d" if Idioma.ingles() else " Nv %d") % nv_l) if nv_l > 0 else "", int(K.get("recrutas", 0))], 16, Color(1.0, 0.55, 0.45) if ini else APAGADO.lightened(0.2)))
		conteudo.add_child(rotulo(", ".join(PackedStringArray(K.get("membros", []))), 12, APAGADO))
	# Recrutador
	conteudo.add_child(rotulo("Recrutar", 17, OURO_CLARO))
	var perto: bool = C.get("perto", false) == true
	if not perto:
		conteudo.add_child(rotulo("Fale com o Recrutador (Sargento Bruno na Clareira, Sargenta Hela no Juncal).", 12, APAGADO))
	var cheio := ms.size() >= int(C.get("max", 6))
	for T in C.get("tiers", []):
		var tid := str(T.id)
		var bt := botao("%s Nv %d · %d de ouro · %d/semana" % [str(T.nome), int(T.nv), int(T.preco), int(T.sem)], func(): rede("cla", {"acao": "candidatos", "tier": tid}), 15, perto) # 3 candidatos com ficha (troca.gd)
		bt.custom_minimum_size = Vector2(0, 46)
		var trava := int(T.get("claNv", 1)) > int(C.get("nv", 1))
		if trava:
			bt.text = Idioma.frase("%s · só no clã Nv %d" % [str(T.nome), int(T.claNv)])
		bt.disabled = not perto or cheio or trava or int(P_menu.prog.get("ouro", 0)) < int(T.preco)
		conteudo.add_child(bt)
	conteudo.add_child(rotulo("Cada recruta depois do 3º deixa a semana toda 10% mais cara. 7 dias sem pagamento, ele vai embora.", 12, APAGADO))
	# gastos
	var log: Array = C.get("log", [])
	if not log.is_empty():
		conteudo.add_child(rotulo("Últimos gastos", 17, OURO_CLARO))
		for L in log:
			var v := int(L.get("v", 0))
			conteudo.add_child(rotulo("%s%s" % [str(L.txt), "" if v == 0 else " (%+d)" % v], 12, VERDE_DIARIA if v > 0 else (Color(1.0, 0.7, 0.6) if v < 0 else APAGADO)))

# cartão de um membro do clã: nome, barras de HP, mana e vigor, o que está fazendo e a função (recruta)
func _cartao_cla(d: Dictionary, sub: String, r, ms: Array, C: Dictionary) -> Control:
	var card := PanelContainer.new()
	card.add_theme_stylebox_override("panel", caixa(FUNDO2, OURO.darkened(0.35), 1, 10))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 4)
	card.add_child(v)
	var on := r == null or int(r.get("on", 0)) == 1
	var vivo := {} # o que a volta de 3 s troca no lugar (_cla_pintar_vivo)
	_cla_vivos["eu" if r == null else "r:" + str(r.id)] = vivo
	var topo := HBoxContainer.new()
	topo.add_theme_constant_override("separation", 8)
	var nome := rotulo(str(d.get("nome", "")) + ("" if r != null else " (você)"), 16, OURO_CLARO)
	nome.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	topo.add_child(nome)
	if r != null and r.has("re"): # moral (MORAL, André 2026-11-25): ícone da produção ~N/h + seta e % que rende
		_moral_ui(topo, r, vivo)
	topo.add_child(rotulo(sub, 12, TEXTO))
	v.add_child(topo)
	if on and d.has("hpM"):
		for b in [["HP", "hp", "hpM", Color(0.8, 0.25, 0.22)], ["Mana", "mp", "mpM", Color(0.3, 0.5, 0.9)], ["Vigor", "vg", "vgM", Color(0.85, 0.7, 0.25)]]:
			var lb := HBoxContainer.new()
			lb.add_theme_constant_override("separation", 6)
			var t := rotulo(b[0], 12, APAGADO)
			t.custom_minimum_size = Vector2(46, 0)
			lb.add_child(t)
			var mx := maxf(1.0, float(d.get(b[2], 1)))
			var barra := barra_prog(float(d.get(b[1], 0)) / mx, b[3], 10.0)
			barra.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			lb.add_child(barra)
			var n := rotulo("%d/%d" % [int(d.get(b[1], 0)), int(mx)], 12, TEXTO)
			n.custom_minimum_size = Vector2(70, 0)
			lb.add_child(n)
			v.add_child(lb)
			vivo[b[1]] = [barra.get_child(0), n, b[2]]
	elif not on:
		v.add_child(rotulo("Fora do mundo", 12, APAGADO))
	if r == null:
		return card
	if r.has("fz"):
		vivo["fz"] = rotulo("Agora: %s" % str(r.fz), 12, APAGADO.lightened(0.25))
		v.add_child(vivo["fz"])
	if r.has("dev"):
		v.add_child(rotulo("Sem pagamento", 12, Color(1.0, 0.55, 0.45)))
	var rid := str(r.id)
	var fn_atual: Dictionary = r.get("fn", {"k": "livre"})
	# André 2026-11-24: marcar a ordem não manda nada; só o botão "Dar ordem" (como no painel.html) envia ao recruta
	var fn: Dictionary = _ordem_pend.get(rid, fn_atual)
	var k := str(fn.get("k", "livre"))
	var lf := HFlowContainer.new()
	lf.add_theme_constant_override("h_separation", 6)
	lf.add_theme_constant_override("v_separation", 6)
	for F in C.get("funcoes", []):
		var fid := str(F.id)
		var pedido := {"k": fid}
		if fid == "recurso":
			pedido.r = str(fn.get("r", "ferro")) if k == "recurso" else "ferro"
		elif fid == "proteger":
			pedido.p = str(fn.get("p", "lider")) if k == "proteger" else "lider"
		elif fid == "fazenda":
			pedido.s = str(fn.get("s", "cenoura")) if k == "fazenda" else "cenoura"
		elif fid == "arvores": # Plantar árvores (André 2026-11-25): planta até 10 nas áreas de plantio e volta ao Livre
			pedido.s = str(fn.get("s", "betula")) if k == "arvores" else "betula"
		lf.add_child(botao(str(F.nome), func(): _marcar_ordem(rid, pedido), 13, fid == k))
	v.add_child(lf)
	if k == "recurso":
		var lr := HFlowContainer.new()
		lr.add_theme_constant_override("h_separation", 6)
		lr.add_theme_constant_override("v_separation", 6)
		for R in C.get("recursos", []):
			var rk := str(R.k)
			lr.add_child(botao(str(R.nome).capitalize(), func(): _marcar_ordem(rid, {"k": "recurso", "r": rk}), 12, rk == str(fn.get("r", ""))))
		v.add_child(lr)
	elif k == "proteger":
		var lp := HFlowContainer.new()
		lp.add_theme_constant_override("h_separation", 6)
		lp.add_theme_constant_override("v_separation", 6)
		var alvos := [["lider", "Você"]]
		for o in ms:
			if str(o.id) != rid:
				alvos.append([str(o.id), str(o.nome)])
		for A in alvos:
			var pid: String = A[0]
			lp.add_child(botao(A[1], func(): _marcar_ordem(rid, {"k": "proteger", "p": pid}), 12, pid == str(fn.get("p", ""))))
		# André 2026-11-23: proteger o carrinho ou o navio mercante (apagado quando não está no mundo; tocar diz o porquê)
		var vc: Dictionary = C.get("veic", {})
		for A in [["carrinho", "Carrinho", "Coloque o carrinho no mundo primeiro"], ["mercante", "Mercante", "Coloque o navio mercante na água primeiro"]]:
			var vid: String = A[0]
			var bv := botao(A[1], func(): _marcar_ordem(rid, {"k": "proteger", "p": vid}), 12, vid == str(fn.get("p", "")))
			if not int(vc.get(vid, 0)):
				bv.disabled = true
				var mot: String = A[2]
				ao_tocar_travado(bv, func(): _avisar_motivo(mot))
			lp.add_child(bv)
		v.add_child(lp)
	if k == "fazenda": # o que plantar nos canteiros da base (André 2026-11-22: "solicitar plante tal coisa")
		var lpl := HFlowContainer.new()
		lpl.add_theme_constant_override("h_separation", 6)
		lpl.add_theme_constant_override("v_separation", 6)
		for P in C.get("plantas", []):
			var sk := str(P.k)
			# André 2026-11-25: com o ícone da semente
			var bs := botao(str(P.nome), func(): _marcar_ordem(rid, {"k": "fazenda", "s": sk}), 12, sk == str(fn.get("s", "")))
			var tx = icone_tex(P_menu.icone_item({"k": "semente_" + sk}))
			if tx != null:
				bs.icon = tx
				bs.expand_icon = true
				bs.add_theme_constant_override("icon_max_width", 26)
			lpl.add_child(bs)
		v.add_child(lpl)
	if k == "arvores": # que árvore plantar (ícone da semente + nome e horas para crescer)
		var lav := HFlowContainer.new()
		lav.add_theme_constant_override("h_separation", 6)
		lav.add_theme_constant_override("v_separation", 6)
		for T in C.get("arvores", []):
			var tk := str(T.k)
			var ba := botao("%s %dh" % [str(T.nome), int(T.get("h", 0))], func(): _marcar_ordem(rid, {"k": "arvores", "s": tk}), 12, tk == str(fn.get("s", "")))
			var ta = icone_tex(P_menu.icone_item({"k": "semente_" + tk}))
			if ta != null:
				ba.icon = ta
				ba.expand_icon = true
				ba.add_theme_constant_override("icon_max_width", 26)
			lav.add_child(ba)
		v.add_child(lav)
	var lo := HBoxContainer.new()
	lo.alignment = BoxContainer.ALIGNMENT_END
	var pendente: bool = _ordem_pend.has(rid) and JSON.stringify(_ordem_pend[rid]) != JSON.stringify(fn_atual)
	var bo := botao("Dar ordem", func():
		var pf: Dictionary = _ordem_pend.get(rid, fn)
		_ordem_pend.erase(rid)
		rede("cla", {"acao": "funcao", "id": rid, "fn": pf}), 14, pendente)
	bo.disabled = not pendente
	lo.add_child(bo)
	v.add_child(lo)
	var ld := HBoxContainer.new()
	ld.alignment = BoxContainer.ALIGNMENT_END
	ld.add_theme_constant_override("separation", 6)
	if r.has("el"): # Elogiar (MORAL): só no jogo, perto dele, 1 vez a cada 8 h
		ld.add_child(botao("Elogiar", func(): rede("cla", {"acao": "elogiar", "id": rid}), 12, true))
	if r.has("x"): # onde ele está (André 2026-11-23: "ver no mapa onde ele está" e "Ver" só olhando, sem controlar)
		var rn := str(r.nome)
		ld.add_child(botao("Ver no mapa", func():
			var ra := _recruta_agora(rid, r)
			fechar()
			m.minimapa.abrir_em(Vector2(float(ra.get("x", 0)), float(ra.get("z", 0))), rn, rid), 12))
		ld.add_child(botao("Ver", func():
			fechar()
			m.espiar.comecar(rid, rn), 12))
	# André 2026-11-24: o menu inteiro dele (status, mochila, profissões, habilidades, Tomos), só olhando; no mundo ou fora
	var rnv := str(r.nome)
	ld.add_child(botao("Ver menu", func(): pedir_recruta(rid, rnv, "cla"), 12))
	# André 2026-11-23: os recrutas saíram da lista de amigos; a mensagem (texto e voz, com os comandos) e o time ficam aqui
	if r.has("c") and m.chat:
		var rc := str(r.c)
		var rnm := str(r.nome)
		ld.add_child(botao("Mensagem", func():
			fechar()
			m.chat.abrir_pm(rc, rnm), 12))
	if r.has("bid"):
		var bid := str(r.bid)
		if int(r.get("time", 0)) == 1:
			ld.add_child(botao("Sair do time", func(): rede("time", {"acao": "expulsar", "com": bid}), 12))
		else:
			ld.add_child(botao("Time", func(): rede("time", {"acao": "convidar", "com": bid}), 12))
	# André 2026-11-24: apertou Dispensar achando que era sair do time; agora pergunta antes (e dá 10 min para chamar de volta)
	var rnd := str(r.nome)
	ld.add_child(botao("Dispensar", func():
		confirmar("Dispensar %s" % rnd, "Tem certeza? Você perderá este recruta para sempre.\n(Até 10 minutos depois, dá para chamar de volta pagando uma taxa.)\nPara só tirar do grupo, use \"Sair do time\".", "Dispensar", func(): rede("cla", {"acao": "dispensar", "id": rid}), true), 12))
	v.add_child(ld)
	return card

# Aba Clã mais leve (frente "personagens mais leves", 2026-11-24; robô 2: montar a aba com 10 recrutas leva 13 a 34 ms
# no PC, umas 5 vezes isso no Poco X7): com a aba aberta, a volta de 3 s (_cla_vivo) traz o painel de novo e antes
# refazia o menu inteiro. Agora, se só mudou o que anda sozinho (HP, mana, vigor, "Agora:", posição e o tempo da
# cobrança), troca só esses números e barras no lugar. Qualquer outra mudança (recruta, função, cofre, ouro...) refaz tudo.
var _cla_vivos := {} # "eu" / "r:<id>" -> {hp: [barra, rótulo, chave do máximo], ..., fz: rótulo}; "_cobranca": rótulo
var _cla_chave := ""
var _ordem_pend := {} # id do recruta -> ordem marcada e ainda não enviada (botão "Dar ordem")
func _marcar_ordem(rid: String, pedido: Dictionary) -> void:
	_ordem_pend[rid] = pedido
	atualizar()

const CLA_ANDA := ["hp", "mp", "vg", "fz", "x", "z", "morto", "ml", "re", "seta", "cor", "ph", "tr", "fm", "fn2"]

func _texto_cobranca(falta: float) -> String:
	return "Próxima cobrança em %d d %d h" % [int(falta / 86400000.0), int(fmod(falta, 86400000.0) / 3600000.0)]

func _sem_o_que_anda(d) -> Dictionary:
	var c: Dictionary = (d as Dictionary).duplicate() if d is Dictionary else {}
	for k in CLA_ANDA:
		if c.has(k):
			c[k] = 1 # quem tem continua tendo (a linha "Agora:" aparece ou some: aí refaz)
	return c

func _chave_cla() -> String:
	var C = P_menu.cla
	if not (C is Dictionary):
		return ""
	var c: Dictionary = C.duplicate()
	c.erase("prox") # o tempo da cobrança anda: vai pelo texto (abaixo)
	if c.get("eu") is Dictionary:
		c.eu = _sem_o_que_anda(c.eu)
	var ms := []
	for r in c.get("m", []):
		ms.append(_sem_o_que_anda(r))
	c.m = ms
	return JSON.stringify([c, P_menu.prog, m.on()])

func _recruta_agora(rid: String, antes: Dictionary) -> Dictionary:
	if P_menu.cla is Dictionary:
		for r in P_menu.cla.get("m", []):
			if r is Dictionary and str(r.get("id", "")) == rid:
				return r
	return antes

# veio do servidor (main.gd, P.mudou): na aba Clã, sem mudança de verdade, só os números; senão o atualizar de sempre
func atualizar_do_servidor() -> void:
	if aberto() and aba == "cla" and not _cla_vivos.is_empty() and _cla_chave != "" and _chave_cla() == _cla_chave:
		_cla_pintar_vivo()
		return
	# outras abas (registros do Poco X7 de 25/11: m:build 60 a 143 ms num quadro): o servidor manda o progresso de novo a
	# cada HP, mana ou vigor de recruta que anda, e o menu aberto era refeito inteiro. Sem mudança no que a aba mostra,
	# não refaz; mesmo assim refaz a cada TUDO_REFAZ_MS (contagens de tempo e o que não está na chave)
	var chave := _chave_tudo() if aberto() and aba != "cla" else ""
	if chave != "" and chave == _tudo_chave and Time.get_ticks_msec() - _tudo_t < TUDO_REFAZ_MS:
		return
	atualizar()
	_tudo_chave = chave
	_tudo_t = Time.get_ticks_msec()

const TUDO_REFAZ_MS := 10000
var _tudo_chave := ""
var _tudo_t := 0
func _chave_tudo() -> String:
	var P = P_menu
	return JSON.stringify([_chave_cla(), P.st, P.hist_info, P.diarias, P.guilda, P.teste, aba, vendo_recruta(), m.perto_da_loja()])

func _cla_pintar_vivo() -> void:
	var C: Dictionary = P_menu.cla
	var cob = _cla_vivos.get("_cobranca")
	if is_instance_valid(cob):
		cob.text = Idioma.frase(_texto_cobranca(maxf(0.0, float(C.get("prox", 0)) - float(Time.get_ticks_msec() - P_menu.cla_t))))
	var membros := {"eu": C.get("eu", {})}
	for r in C.get("m", []):
		membros["r:" + str(r.get("id", ""))] = r
	for id in membros:
		var vivo = _cla_vivos.get(id)
		var d = membros[id]
		if not (vivo is Dictionary) or not (d is Dictionary):
			continue
		for k in ["hp", "mp", "vg"]:
			if not vivo.has(k):
				continue
			var par: Array = vivo[k]
			if not is_instance_valid(par[0]):
				continue
			var mx := maxf(1.0, float(d.get(par[2], 1)))
			par[0].anchor_right = clampf(float(d.get(k, 0)) / mx, 0.0, 1.0)
			par[1].text = "%d/%d" % [int(d.get(k, 0)), int(mx)]
		if vivo.has("fz") and is_instance_valid(vivo.fz):
			vivo.fz.text = Idioma.frase("Agora: %s" % str(d.get("fz", "")))
		_moral_pintar(vivo, d)

# com a aba Clã aberta, pede o painel de novo a cada 3 s (HP, mana e vigor andando)
var _cla_timer := false
# textos compridos quebram linha em vez de alargar o painel (o que passava da tela sumia)
func _quebrar_linhas(no: Node) -> void:
	for c in no.get_children():
		if c is Label:
			if no is HBoxContainer and not (c.size_flags_horizontal & Control.SIZE_EXPAND): # rótulo curto da fileira (HP, Nv): fica inteiro
				continue
			c.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			c.custom_minimum_size.x = maxf(c.custom_minimum_size.x, 40.0)
		elif c is Button:
			c.clip_text = false
		else:
			_quebrar_linhas(c)

func _cla_vivo() -> void:
	if _cla_timer:
		return
	_cla_timer = true
	get_tree().create_timer(3.0).timeout.connect(func():
		_cla_timer = false
		if aberto() and (aba == "cla" or aba == "cla_missoes") and m.on():
			rede("cla", {"acao": "ver"}))

# Fixar no atalho (André 2026-11-23: "qualquer missão, da guilda ou do clã, eu posso marcar para ficar aparecendo no
# atalho de missões"): o botão de cada missão. Fixada, o cartão da tela (missao_ativa.gd) mostra ela no lugar da história.
func botao_fixar(tipo: String, id: String) -> Button:
	var ma = m.missao_ativa
	var fixa: bool = ma != null and ma.esta_fixada(tipo, id)
	var b := botao("Fixada no atalho" if fixa else "Fixar no atalho", func():
		if m.missao_ativa:
			if m.missao_ativa.esta_fixada(tipo, id):
				m.missao_ativa.soltar()
			else:
				m.missao_ativa.fixar(tipo, id)
		atualizar(), 13, fixa)
	b.custom_minimum_size = Vector2(0, 34)
	b.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	return b

# aba Missão do Clã (André 2026-11-23: "a missão do clã também aparece na aba de missões"): hoje a Escolta do Clã
func montar_cla_missoes() -> void:
	var C: Dictionary = P_menu.cla
	if not m.on():
		conteudo.add_child(rotulo("As missões do clã só funcionam online.", 14, APAGADO))
		return
	if C.is_empty():
		conteudo.add_child(rotulo("Carregando o clã...", 14, APAGADO))
		return
	if int(C.get("sem", 0)) == 1:
		conteudo.add_child(rotulo("Você ainda não tem clã. Funde o seu na aba Clã para ter missões do clã.", 14, APAGADO))
		return
	conteudo.add_child(rotulo("Clã %s" % str(C.get("n", "")), 18, OURO_CLARO))
	var B = C.get("base")
	var Mi = B.get("missao") if B is Dictionary else null
	var ce := PanelContainer.new()
	ce.add_theme_stylebox_override("panel", caixa(FUNDO2, OURO, 2, 10))
	var ve := VBoxContainer.new()
	ve.add_theme_constant_override("separation", 3)
	ce.add_child(ve)
	if Mi is Dictionary:
		_escolta_cla(ve, Mi)
		ve.add_child(botao_fixar("cla", "escolta"))
	else:
		ve.add_child(rotulo("Missão do clã: Escolta", 16, OURO_CLARO))
		ve.add_child(rotulo("A Escolta abre depois de fundar a base do clã (aba Clã).", 12, APAGADO))
	conteudo.add_child(ce)

# Guilda dos Aventureiros (André 2026-11-18; regras em shared/guilda.js): o rank (F a SS), os pontos, a Prova e os
# contratos do dia. Pega no mural ou com a Brenda (Rio Claro); "Ir" e "Receber" valem em qualquer lugar.
const COR_RANK := {"F": Color(0.62, 0.62, 0.62), "E": Color(0.5, 0.72, 0.38), "D": Color(0.35, 0.66, 0.78), "C": Color(0.3, 0.45, 0.85),
	"B": Color(0.6, 0.38, 0.85), "A": Color(0.88, 0.56, 0.18), "S": Color(0.88, 0.3, 0.25), "SS": Color(1.0, 0.84, 0.32)}
func montar_guilda() -> void:
	var G: Dictionary = P_menu.guilda
	if G.is_empty() or not G.has("l"):
		conteudo.add_child(rotulo("A Guilda abre no Nv 30, no Rio Claro.", 14, APAGADO))
		return
	var rk := str(G.get("rank", "F"))
	var cab := PanelContainer.new()
	cab.add_theme_stylebox_override("panel", caixa(FUNDO2, COR_RANK.get(rk, OURO), 2, RAIO_JANELA))
	var hc := HBoxContainer.new()
	hc.add_theme_constant_override("separation", 12)
	cab.add_child(hc)
	var selo := PanelContainer.new()
	selo.add_theme_stylebox_override("panel", caixa(COR_RANK.get(rk, OURO), Color(0, 0, 0, 0.4), 1, 10))
	selo.custom_minimum_size = Vector2(64, 64)
	var lr := rotulo(rk, 30, Color(0.1, 0.08, 0.06))
	lr.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lr.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	selo.add_child(lr)
	hc.add_child(selo)
	var vc := VBoxContainer.new()
	vc.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vc.add_theme_constant_override("separation", 4)
	hc.add_child(vc)
	vc.add_child(rotulo("Rank %s da Guilda" % rk, 17, OURO_CLARO))
	var prox = G.get("prox")
	if prox is Dictionary:
		var pm := int(G.get("pgMax", 1))
		var lp := HBoxContainer.new()
		lp.add_theme_constant_override("separation", 8)
		var bp := barra_prog(clampf(float(G.get("pg", 0)) / maxf(1.0, float(pm)), 0.0, 1.0), COR_RANK.get(rk, OURO), 10.0)
		bp.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		lp.add_child(bp)
		lp.add_child(rotulo("%d/%d pontos" % [int(G.get("pg", 0)), pm], 13, TEXTO))
		vc.add_child(lp)
		vc.add_child(rotulo("Próximo: Rank %s · Nv %d · Prova" % [str(prox.rank), int(prox.nv)], 12, APAGADO))
	else:
		vc.add_child(rotulo("Rank máximo!", 13, VERDE_DIARIA))
	conteudo.add_child(cab)
	var perto: bool = G.get("perto", false) == true
	if G.get("pv", false) == true:
		conteudo.add_child(rotulo("Prova aceita: vença o elite vermelho num campo da sua faixa.", 14, Color(1.0, 0.55, 0.45)))
	elif G.get("prova", false) == true:
		var bpv := botao("Fazer a Prova do rank %s" % str(prox.rank), func(): rede("guilda", {"acao": "prova"}), 16, true)
		bpv.disabled = not perto
		bpv.custom_minimum_size = Vector2(0, 48)
		conteudo.add_child(bpv)
		if not perto:
			conteudo.add_child(rotulo("A Prova se pega no mural.", 12, APAGADO))
	montar_vantagens_guilda(G, prox)
	var falta := maxf(0.0, float(G.get("fim", 0)) - float(Time.get_ticks_msec() - P_menu.guilda_t))
	conteudo.add_child(rotulo("Cada um: %d ouro · %d XP · %d pontos" % [int(G.get("ouro", 0)), int(G.get("xp", 0)), int(G.get("pgGanha", 0))], 13, OURO))
	if G.get("cat", false) == true:
		conteudo.add_child(rotulo("Chance de runa ou selo", 12, OURO))
	conteudo.add_child(rotulo(("Pegue até %d no mural." % int(G.get("ativos", 3))) if perto else "Pegue contratos no mural do Rio Claro.", 13, VERDE_DIARIA if perto else APAGADO))
	conteudo.add_child(rotulo("Novos em %d h %d min" % [int(falta / 3600000.0), int(fmod(falta, 3600000.0) / 60000.0)], 12, APAGADO))
	var troca: int = int(G.v.get("troca", -1)) if G.get("v") is Dictionary else -1
	for c in G.l:
		var e := str(c.get("e", "livre"))
		var feito := e == "feito"
		var pc := PanelContainer.new()
		pc.add_theme_stylebox_override("panel", caixa(FUNDO2, VERDE_DIARIA if feito else (OURO if e == "ativo" else Color(0.3, 0.26, 0.2)), 2 if feito else 1, RAIO_JANELA))
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 10)
		pc.add_child(h)
		var v := VBoxContainer.new()
		v.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		v.add_theme_constant_override("separation", 3)
		h.add_child(v)
		var nome := rotulo(str(c.txt), 16, VERDE_DIARIA if feito else (APAGADO if e == "recebido" else TEXTO))
		if feito or e == "recebido":
			nome.text = "✓ " + nome.text
		v.add_child(nome)
		if c.get("x", 0):
			v.add_child(rotulo("Extra do rank · sem XP", 12, APAGADO))
		if e == "ativo" or feito:
			var linha := HBoxContainer.new()
			linha.add_theme_constant_override("separation", 8)
			var bpr := barra_prog(clampf(float(c.n) / maxf(1.0, float(c.t)), 0.0, 1.0), VERDE_DIARIA if feito else LILAS, 10.0)
			bpr.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			linha.add_child(bpr)
			linha.add_child(rotulo("%d/%d" % [int(c.n), int(c.t)], 13, TEXTO))
			v.add_child(linha)
		var id := str(c.id)
		if e == "ativo" or feito:
			v.add_child(botao_fixar("guilda", id))
		var bt: Button
		match e:
			"recebido":
				bt = botao("Recebido", func(): pass, 15)
				bt.disabled = true
			"feito":
				bt = botao("Receber", func(): rede("guilda", {"acao": "receber", "id": id}), 15, true)
			"ativo":
				bt = botao("Ir", func(): rede("guilda", {"acao": "ir", "id": id}), 15)
			_:
				bt = botao("Pegar", func(): rede("guilda", {"acao": "aceitar", "id": id}), 15, perto)
				bt.disabled = not perto
		bt.custom_minimum_size = Vector2(110, 44)
		bt.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		if e == "livre" and troca > 0: # vantagem A: troca um contrato livre por outro
			var btr := botao("Trocar", func(): rede("guilda", {"acao": "trocar", "id": id}), 15)
			btr.custom_minimum_size = Vector2(96, 44)
			btr.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			h.add_child(btr)
		h.add_child(bt)
		conteudo.add_child(pc)

# o que cada vantagem fixa do rank faz, em poucas palavras (GUILDA.ranks[].v em shared/dados.js)
static func textos_vantagens(v: Dictionary) -> Array:
	var l := []
	if int(v.get("extra", 0)) > 0:
		l.append("+%d contrato por dia (sem XP)" % int(v.extra))
	if float(v.get("conserto", 0.0)) > 0.0:
		l.append("Conserto %d%% mais barato" % int(round(float(v.conserto) * 100.0)))
	if int(v.get("ativos", 0)) > 3:
		l.append("%d contratos de uma vez" % int(v.ativos))
	if v.has("voltar") and float(v.voltar) >= 0.0:
		l.append("Voltar à Guilda grátis, 1 vez por hora")
	if v.has("troca") and float(v.troca) >= 0.0:
		l.append("Trocar 1 contrato por dia")
	if float(v.get("pack", 0.0)) > 0.0:
		l.append("+%d%% de ouro na entrega de pack" % int(round(float(v.pack) * 100.0)))
	if int(v.get("marca", 0)) > 0:
		l.append("Marca SS no nome")
	return l

# vantagens fixas do rank (Presidente 2026-11-19): valem sempre, sem equipar título; e as do próximo rank
func montar_vantagens_guilda(G: Dictionary, prox) -> void:
	var v = G.get("v")
	if not (v is Dictionary):
		return
	var l := textos_vantagens(v)
	if not l.is_empty():
		var lv := rotulo("", 13, VERDE_DIARIA)
		lv.text = Idioma.frase("Vantagens:") + " " + " · ".join(l.map(func(x): return Idioma.frase(x)))
		lv.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		conteudo.add_child(lv)
	if prox is Dictionary and prox.get("v") is Dictionary:
		var lp := textos_vantagens(prox.v)
		if not lp.is_empty():
			var lx := rotulo("", 12, APAGADO)
			lx.text = Idioma.frase("No Rank %s:" % str(prox.rank)) + " " + " · ".join(lp.map(func(x): return Idioma.frase(x)))
			lx.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			conteudo.add_child(lx)
	if float(v.get("voltar", -1)) >= 0.0:
		var falta_v := maxf(0.0, float(v.voltar) - float(Time.get_ticks_msec() - P_menu.guilda_t))
		var perto: bool = G.get("perto", false) == true
		var txt := "Voltar à Guilda" if falta_v <= 0.0 else "Voltar à Guilda · %d min" % int(ceil(falta_v / 60000.0))
		var bv := botao(txt, func(): fechar(); m.volta.pedir_guilda(), 15, falta_v <= 0.0 and not perto)
		bv.disabled = falta_v > 0.0 or perto
		bv.custom_minimum_size = Vector2(0, 44)
		conteudo.add_child(bv)

func ir_diaria(ev: Dictionary) -> void:
	var a = ev.get("alvo")
	if not (a is Dictionary) or m.rota == null or m.heroi == null:
		return
	var r: PackedVector2Array = m.rota.planejar(Vector2(float(a.x), float(a.z)))
	if r.is_empty():
		return
	fechar()
	m.rota.ir(r, "Indo até %s" % str(a.get("nome", "")), m.rota.OLHA, true)

const LILAS := Color(0.72, 0.62, 0.95)
func montar_missoes() -> void:
	_card_escolta()
	var nv = m.nevoa
	if nv == null or nv.H.is_empty():
		conteudo.add_child(rotulo("Sem missões por enquanto.", 14, APAGADO))
		return
	var ms: Array = nv.H.get("missoes", [])
	var caps: Array = nv.H.get("capitulos", [])
	var feitas: int = nv.feitas()
	var h: Dictionary = nv.hist()
	if P_menu.teste_missoes: # só na conta do André, temporário (2026-11-14): refazer missões sem apagar o personagem
		var tm := HBoxContainer.new()
		tm.add_theme_constant_override("separation", 8)
		tm.add_child(rotulo("Teste:", 14, APAGADO))
		tm.add_child(botao("Voltar 1 missão", func(): rede("missaoTeste", {"acao": "voltar"}), 14))
		tm.add_child(botao("Zerar missões", func(): rede("missaoTeste", {"acao": "zerar"}), 14))
		conteudo.add_child(tm)
	var titulo := str(P_menu.hist_info.get("titulo", "")) if P_menu.hist_info.get("titulo") != null else ""
	if titulo != "": # título do ato (Ato II: Sentinela da Ordem), vem do servidor (histInfo)
		conteudo.add_child(rotulo("Título: %s" % titulo, 15, Color("f3d27a")))
	var d := rotulo("A história principal abre o mapa: cada capítulo tira a névoa de uma região ou abre um recurso. O nível sobe caçando; a história chama quando você chega no nível do próximo capítulo.", 12, APAGADO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	conteudo.add_child(d)
	if caps.is_empty(): # dados antigos: lista simples
		for i in ms.size():
			conteudo.add_child(_card_missao(ms[i], i, feitas, h))
		return
	var ato := ""
	for C in caps:
		var idx: Array = [] # índices das missões do capítulo
		for i in ms.size():
			if int(ms[i].get("cap", 0)) == int(C.n):
				idx.append(i)
		if idx.is_empty():
			continue
		if str(C.get("ato", "")) != ato:
			ato = str(C.get("ato", ""))
			separador(ato)
		var feito: bool = feitas > int(idx[-1])
		var atual: bool = not feito and feitas >= int(idx[0])
		conteudo.add_child(_card_capitulo(C, idx, ms, feitas, h, feito, atual))

# a Escolta do Clã em andamento, no alto da aba (André 2026-11-23: "coloca essa missão do clã também na aba de missões")
func _card_escolta() -> void:
	if m.missao_ativa == null:
		return
	var E: Dictionary = m.missao_ativa.escolta()
	if E.is_empty():
		return
	var pc := PanelContainer.new()
	pc.add_theme_stylebox_override("panel", caixa(Color(0.14, 0.07, 0.06, 1), Color(1.0, 0.36, 0.28), 2, RAIO_JANELA))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 4)
	pc.add_child(v)
	var te: Array = m.missao_ativa.textos_escolta(E)
	v.add_child(rotulo("Missão do clã: " + str(te[0]), 16, OURO_CLARO))
	v.add_child(rotulo(str(te[1]), 14, Color("ffb4a6")))
	var d := rotulo("Leve os recrutas vivos até o totem. Nas emboscadas, derrube todos os monstros da onda antes de seguir.", 12, APAGADO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(d)
	v.add_child(botao_fixar("cla", "escolta"))
	v.add_child(botao("Ir até %s" % str(E.get("nome", "o totem")), func():
		fechar()
		m.missao_ativa.ir(), 14, true))
	conteudo.add_child(pc)

func _card_capitulo(C: Dictionary, idx: Array, ms: Array, feitas: int, h: Dictionary, feito: bool, atual: bool) -> Control:
	var nivel := int(P_menu.prog.nivel)
	var cedo: bool = nivel < int(C.nv) and not feito and not atual
	var pc := PanelContainer.new()
	var borda := Color(0.45, 0.75, 0.4) if feito else (LILAS if atual else Color(0.3, 0.26, 0.2))
	pc.add_theme_stylebox_override("panel", caixa(Color(0.12, 0.1, 0.16, 1) if atual else Color(0.09, 0.075, 0.06, 1), borda, 2 if atual else 1, RAIO_JANELA))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 4)
	pc.add_child(v)
	var nome := "???" if cedo else str(C.nome)
	var topo := rotulo("%sCapítulo %d · %s   ·   Nv %d" % ["✓ " if feito else "", int(C.n), nome, int(C.nv)], 16, Color(0.6, 0.9, 0.55) if feito else (Color("e6dcff") if atual else APAGADO))
	topo.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(topo)
	if cedo:
		v.add_child(rotulo("Chega no nível %d para a história continuar." % int(C.nv), 12, APAGADO))
		return pc
	if atual and str(C.get("frase", "")) != "":
		v.add_child(rotulo(str(C.frase), 12, Color(0.8, 0.76, 0.95)))
	if feito: # a página do Diário e os rumores que já chegaram
		if str(C.get("diario", "")) != "":
			var dd := rotulo(str(C.diario), 12, TEXTO)
			dd.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			v.add_child(dd)
		for R in C.get("rumores", []):
			if int(R.nv) <= nivel:
				var r := rotulo("Rumor (Nv %d) · %s: \"%s\"" % [int(R.nv), str(R.quem), str(R.texto)], 11, APAGADO)
				r.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
				v.add_child(r)
		return pc
	for i in idx:
		v.add_child(_card_missao(ms[i], i, feitas, h))
	return pc

func _card_missao(M: Dictionary, i: int, feitas: int, h: Dictionary) -> Control:
	var feita := i < feitas
	var atual := i == feitas
	var cedo: bool = int(P_menu.prog.nivel) < int(M.nv)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)
	var topo := rotulo("%s%s   ·   Nv %d" % ["✓ " if feita else ("▸ " if atual else "○ "), M.nome, int(M.nv)], 14, Color(0.6, 0.9, 0.55) if feita else (Color("e6dcff") if atual else (APAGADO if cedo else TEXTO)))
	v.add_child(topo)
	if not atual:
		return v
	var quem: String = str(M.get("npcNome", M.npc))
	var abre: Array = []
	for k in M.get("libera", []):
		var Z: Dictionary = m.nevoa.zona(str(k))
		abre.append(Z.nome if not Z.is_empty() else str(m.nevoa.H.get("recursos", {}).get(k, k)))
	var linha := "Com %s" % quem + ("  ·  abre: %s" % ", ".join(abre) if not abre.is_empty() else "")
	if cedo:
		linha += "\nLibera no nível %d" % int(M.nv)
	elif not h.get("ac", false):
		linha += "\nFale com %s para começar" % quem
	var l := rotulo(linha, 12, TEXTO)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(l)
	if h.get("ac", false): # as etapas: feitas, a da vez (com o texto do servidor) e as próximas
		var e := int(h.get("e", 0))
		var hi: Dictionary = P_menu.hist_info
		var etapas: Array = M.get("etapas", [])
		for k in etapas.size():
			var txt: String = str(etapas[k])
			if k == e and str(hi.get("id", "")) == str(M.id):
				txt = str(hi.get("txt", txt))
			var et := rotulo("%s %s" % ["✓" if k < e else ("▸" if k == e else "·"), txt], 12, Color(0.6, 0.9, 0.55) if k < e else (Color(1, 0.95, 0.85) if k == e else APAGADO))
			et.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			v.add_child(et)
		if etapas.size() > 1:
			v.add_child(barra_prog(float(e) / float(etapas.size()), LILAS))
	if not cedo and m.missao_ativa != null: # fixar no atalho: a da história volta a aparecer quando se solta a outra
		v.add_child(botao_fixar("historia", str(M.get("id", ""))))
	if not cedo and m.missao_ativa != null: # André 2026-11-11: "Ir para" leva sozinho até o NPC ou o lugar
		var ir := botao("Ir para", _ir_missao, 14, true)
		ir.custom_minimum_size = Vector2(130, 34)
		ir.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
		v.add_child(ir)
	return v

func _ir_missao() -> void:
	fechar()
	m.missao_ativa.ir()

func linha_prof_card(k: String) -> Control:
	var P = P_menu
	var pf: Dictionary = P.dados.profissoes[k]
	var nv: int = P.prof_nivel(k)
	var pts: float = float(P.prog.prof.get(k, 0.0))
	var b: Dictionary = P.prof_bonus(k)
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1), Color(0.3, 0.24, 0.16), 1, 8))
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 12)
	cx.add_child(l)
	l.add_child(icone_redondo(ICONE_PROF[k], 48))
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.add_theme_constant_override("separation", 2)
	var cab := HBoxContainer.new()
	cab.add_theme_constant_override("separation", 10)
	cab.add_child(rotulo(pf.nome, 16, TEXTO))
	cab.add_child(rotulo(str(P.dados.ranks[b.rank]), 14, OURO_CLARO))
	cab.add_child(rotulo("Nv %d" % nv, 13, APAGADO))
	var esp_ := Control.new()
	esp_.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cab.add_child(esp_)
	var maxn := int(P.dados.profMax)
	cab.add_child(rotulo("Nível máximo" if nv >= maxn else "%d / %d pontos" % [floor(pts), int(P.prof_pontos(nv + 1))], 12, OURO_CLARO if nv >= maxn else APAGADO))
	txt.add_child(cab)
	var d := rotulo(pf.desc, 12, APAGADO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	txt.add_child(d)
	var a: float = P.prof_pontos(nv)
	var z: float = P.prof_pontos(nv + 1)
	txt.add_child(barra_prog(1.0 if nv >= maxn else (pts - a) / max(1.0, z - a), Color(0.85, 0.66, 0.3), 6))
	var bon := []
	if k == "mer":
		var mc: Dictionary = P.mercador()
		bon.append("Rosa paga +%s%% e cobra -%s%%" % [P.num(mc.venda * 100, 0), P.num(mc.compra * 100, 0)])
		bon.append("1 ponto a cada %d de ouro negociado" % int(P.dados.mercador.pontoOuro))
	else:
		if b.menosVigor > 0:
			bon.append("-%d%% vigor" % round(b.menosVigor * 100))
		if k in ["min", "len"]:
			if b.rapidez > 1.0:
				bon.append("+%s%% mais rápido" % P.num((b.rapidez - 1.0) * 100, 1))
			if b.extra > 0:
				bon.append("+%d%% de chance de +1" % round(b.extra * 100))
		else:
			bon.append("%s%% de chance de subir a raridade" % P.num(P.chance_raridade(k) * 100, 1))
	if bon.is_empty():
		bon.append("Trabalhe para subir de rank")
	txt.add_child(rotulo(" · ".join(bon), 12, Color(0.6, 0.75, 0.55)))
	l.add_child(txt)
	return cx

# receitas do Ferreiro (forja do Tomás) ou do Alfaiate (banca da Rosa)
func montar_receitas(prof: String) -> void:
	var P = P_menu
	conteudo.add_child(linha_vigor())
	var of: Dictionary = P.dados.oficina[prof]
	var aqui: bool = m.trabalho.perto_oficina(prof)
	# Vila dos Lotes: perto de uma bigorna, fornalha ou bancada construída também dá (cada uma serve para umas receitas)
	var estacoes := ["bigorna", "fornalha"] if prof == "fer" else ["fogao"] if prof == "coz" else ["bancada"]
	var na_estacao: bool = not aqui and m.construcao != null and m.construcao.estacao_perto(estacoes)
	var st := rotulo(("Você está %s: dá para criar." % of.onde) if aqui else ("Você está perto da sua estação: dá para criar o que ela faz.") if na_estacao else ("Para criar, vá %s ou a uma %s construída na Vila dos Lotes." % [str(of.onde) if Idioma.ingles() else str(of.onde).replace("na ", "até a "), " ou ".join(estacoes.map(func(e): return str(NOME_ESTACAO[e]).to_lower()))]), 13, VERDE if aqui or na_estacao else APAGADO)
	st.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	conteudo.add_child(st)
	separador("Receitas · %s Nv %d" % [P.dados.profissoes[prof].nome, P.prof_nivel(prof)])
	for r in P.dados.receitas:
		var R: Dictionary = P.dados.receitas[r]
		if R.prof == prof:
			conteudo.add_child(linha_receita(r, R, aqui or (na_estacao and m.construcao.estacao_perto([m.construcao.estacao_da_receita(R)]))))

func linha_receita(r: String, R: Dictionary, aqui: bool) -> Control:
	var P = P_menu
	var faz := {"k": str(R.faz), "r": 0} if P.dados.itens[str(R.faz)].has("lugar") else {"k": str(R.faz), "n": 1}
	var nv_ok: bool = P.prof_ok(str(R.prof), int(R.nivel), str(R.faz))
	var custo: float = P.custo_vigor(R.prof, float(R.vigor))
	var tem := true
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1) if nv_ok else Color(0.07, 0.063, 0.055, 1), Color(0.3, 0.24, 0.16), 1, 8))
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 12)
	cx.add_child(l)
	var c := celula(faz, false, func(): pass, 52)
	c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(c)
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.add_theme_constant_override("separation", 2)
	var nome: String = P.dados.itens[str(R.faz)].nome
	var cab := HBoxContainer.new()
	cab.add_theme_constant_override("separation", 10)
	cab.add_child(rotulo(nome, 15, TEXTO if nv_ok else APAGADO))
	if not nv_ok:
		cab.add_child(rotulo("precisa de Nv %d" % int(R.nivel), 12, Color("e0806a")))
	txt.add_child(cab)
	if P.eh_equip(faz):
		var t := rotulo("Sai Comum, com %s%% de chance de subir de raridade · %s" % [P.num(P.chance_raridade(R.prof) * 100, 0), P.texto_item(faz)], 12, APAGADO)
		t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		txt.add_child(t)
	# materiais: verde se tem, vermelho se falta
	var mats := HFlowContainer.new()
	mats.add_theme_constant_override("h_separation", 12)
	for k in R.usa:
		var n := int(R.usa[k])
		var t2: int = P.contar(k)
		if t2 < n:
			tem = false
		var ml := HBoxContainer.new()
		ml.add_theme_constant_override("separation", 4)
		var ic := TextureRect.new()
		ic.texture = icone_tex(P.icone_item({"k": k}))
		ic.custom_minimum_size = Vector2(18, 18)
		ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ic.modulate = tinta(ic.texture, P.cor_item({"k": k}))
		ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		ml.add_child(ic)
		ml.add_child(rotulo("%s %d/%d" % [P.dados.itens[k].nome, t2, n], 12, VERDE if t2 >= n else Color("e0806a")))
		mats.add_child(ml)
	var vg := rotulo("Vigor %s" % P.num(custo, 1), 12, COR_VIGOR if P.vigor() >= custo else Color("e0806a"))
	mats.add_child(vg)
	txt.add_child(mats)
	l.add_child(txt)
	var pode: bool = aqui and nv_ok and tem and P.vigor() >= custo
	var b := botao("Criar", func(): criar(r), 14, pode)
	b.custom_minimum_size = Vector2(96, 40)
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	b.disabled = not pode
	avisar_travado(b, func(): return motivo_receita(aqui, "a oficina ou a estação certa", nv_ok, "%s Nv %d" % [P.dados.profissoes[R.prof].nome, int(R.nivel)], R.usa, custo))
	l.add_child(b)
	return cx

# mostra o motivo de um botão travado no meio da tela, com o som de "não dá"
func avisar_travado(b: BaseButton, motivo: Callable) -> void:
	ao_tocar_travado(b, func(): _avisar_motivo(str(motivo.call())))

func _avisar_motivo(t: String) -> void:
	if t != "":
		m.hud.aviso(t)
		m.sons.tocar("dash", -12.0)

# primeiro motivo que impede criar ("" = dá)
func motivo_receita(aqui: bool, onde: String, nv_ok: bool, nv_txt: String, usa: Dictionary, custo: float) -> String:
	var P = P_menu
	if not nv_ok:
		return "Nível baixo: precisa de %s" % nv_txt
	if not aqui:
		return "Vá até %s para criar" % onde
	for k in usa:
		if P.contar(k) < int(usa[k]):
			return "Falta %s (%d/%d)" % [str(P.dados.itens[k].nome).to_lower(), P.contar(k), int(usa[k])]
	if P.vigor() < custo:
		return "Sem vigor: ele volta sozinho com o tempo (cheio a cada 6 h)"
	return ""

func criar(r: String, rar := 0) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	if not m.on():
		m.hud.aviso("Criar só funciona online (a peça fica na sua conta)")
		return
	if rar > 0: # Raro em diante: evolui a peça da raridade de baixo (a janelinha de sempre pergunta e mostra a chance)
		var i: int = P_menu.peca_para_evoluir(str(P_menu.dados.receitas[r].faz), rar)
		if i < 0:
			_avisar_motivo("Precisa de %s na mochila" % P_menu.nome_item({"k": str(P_menu.dados.receitas[r].faz), "r": rar - 1}))
			return
		perguntar_evoluir(i)
		return
	if m.construcao: # janelinha de quantas + barrinha (André 2026-11-05)
		m.construcao.pedir_criar("receita", r)
		return
	rede("criar", {"r": r})

# ---------- aba Criar (André 2026-11-04): tudo o que se cria, em submenus ----------
# receitas das profissões (Ferreiro, Alfaiate) e peças da construção / ferramentas da fazenda, cada uma com onde se cria
func itens_criar(cat: String) -> Array:
	var P = P_menu
	var D: Dictionary = P.dados
	var lista := []
	for r in D.receitas:
		var R: Dictionary = D.receitas[r]
		# André 2026-11-09: barras e carvão saem da janela da fornalha (combustível + minério), não da aba Criar
		# (criar por aqui desconectava). A receita na hora continua no Tomás (Profissões > Ferreiro).
		if eh_da_fornalha(R):
			continue
		var lugar := str(D.itens[str(R.faz)].get("lugar", ""))
		var c := "comida" if str(R.prof) == "coz" else "materiais" if lugar == "" else "armas" if lugar in ["espada", "cajado", "acessorio"] else "armaduras"
		if c == cat:
			lista.append({"tipo": "receita", "k": r, "nome": str(D.itens[str(R.faz)].nome), "nivel": int(R.nivel)})
	for k in D.get("construcoes", {}):
		var C: Dictionary = D.construcoes[k]
		var c := "estacoes" if C.has("estacao") else "casa" if str(C.get("aba", "")) == "casa" else "moveis"
		if c == cat:
			lista.append({"tipo": "obra", "k": k, "nome": str(C.nome), "nivel": 0})
	if cat == "ferramentas":
		for k in D.get("ferramentas", {}):
			if D.ferramentas[k].get("varios", false): # galão: só em Materiais (André 2026-11-15, remoção aprovada)
				continue
			lista.append({"tipo": "obra", "k": k, "nome": str(D.itens[k].nome), "nivel": 0})
	if cat == "materiais": # galão de combustível (varios): fica em Materiais (André 2026-11-15)
		for k in D.get("ferramentas", {}):
			if D.ferramentas[k].get("varios", false):
				lista.append({"tipo": "obra", "k": k, "nome": str(D.itens[k].nome), "nivel": 0})
	lista.sort_custom(func(a, b): return a.nivel < b.nivel or (a.nivel == b.nivel and a.nome.naturalnocasecmp_to(b.nome) < 0))
	return lista

# receita que é da fornalha (mesma conta de shared/dados.js RECEITA_ESTACAO)
static func eh_da_fornalha(R: Dictionary) -> bool:
	var faz := str(R.faz)
	return faz.begins_with("barra_") or faz == "carvao"

# aviso com botão: barras e carvão ficam na fornalha (perto do herói abre a janela; longe, leva até ela)
func linha_fornalha() -> Control:
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1), Color(0.3, 0.24, 0.16), 1, 8))
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 12)
	cx.add_child(l)
	var ic := TextureRect.new()
	ic.texture = icone_tex("cs_fornalha")
	ic.custom_minimum_size = Vector2(40, 40)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(ic)
	var t := rotulo("Barras e carvão saem da Fornalha: ponha lenha ou carvão e o minério, ela funde sozinha.", 13, OURO_CLARO)
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	l.add_child(t)
	var cons = m.construcao
	var b := botao("Fornalha", ir_fornalha, 14, cons != null)
	b.custom_minimum_size = Vector2(96, 40)
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(b)
	return cx

func ir_fornalha() -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	var cons = m.construcao
	if cons == null:
		return
	if cons._alvos_estacao("fornalha").is_empty():
		_avisar_motivo("Construa uma fornalha no seu terreno (ou crie as barras no Tomás)")
		return
	fechar()
	cons.tocar_estacao("fornalha")

func montar_criar() -> void:
	conteudo.add_child(linha_vigor())
	montar_criar_quimera()
	return
	# (antes: submenus Aqui, Materiais, Armas...; ficou de reserva)
	if cat_criar == "aqui":
		montar_criar_aqui()
		return
	if cat_criar == "materiais":
		conteudo.add_child(linha_fornalha())
	var lista := itens_criar(cat_criar)
	if lista.is_empty():
		conteudo.add_child(rotulo("Nada para criar aqui ainda.", 13, APAGADO))
	for e in lista:
		conteudo.add_child(linha_do_criar(e))

# submenu "Aqui": tudo o que pede a estação perto, separado pelos outros submenus (Materiais, Armas, Armaduras...)
func montar_criar_aqui() -> void:
	var ests := estacoes_perto()
	var nomes := []
	for est in ests:
		nomes.append("da " + NOME_ESTACAO[est])
	var st := rotulo("Você está perto %s: aqui fica tudo o que %s. Os outros submenus mostram o resto." % [" e ".join(nomes), "ela faz" if nomes.size() == 1 else "elas fazem"], 13, VERDE)
	st.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	conteudo.add_child(st)
	var algum := false
	if "fornalha" in ests and m.construcao != null and m.construcao.minha_fornalha_perto() != "":
		conteudo.add_child(linha_fornalha())
		algum = true
	for c in CATS_CRIAR:
		if c[0] == "aqui":
			continue
		var lista := []
		for e in itens_criar(c[0]):
			var est := estacao_do_item(e)
			# móveis e peças da casa pedem a bancada construída (a banca da Rosa só faz as receitas do Alfaiate)
			if est in ests and (e.tipo == "receita" or (m.construcao != null and m.construcao.estacao_perto([est]))):
				lista.append(e)
		if lista.is_empty():
			continue
		algum = true
		separador(c[1])
		for e in lista:
			conteudo.add_child(linha_do_criar(e))
	algum = montar_melhorar_aqui(ests) or algum
	if not algum:
		conteudo.add_child(rotulo("Nada para criar aqui ainda.", 13, APAGADO))

# "Melhorar equipamento" no submenu da estação (André 2026-11-07: "pegar um épico, transformar em lendário" na bancada):
# as peças da mochila e as vestidas que esta estação melhora (bigorna/forja do Tomás: armas; bancada/banca da Rosa:
# armaduras e colar). Evoluir e Reforçar são os mesmos do cartão da peça na mochila (que continua igual); o servidor confere.
func montar_melhorar_aqui(ests: Array, so_tipo := "", so_reforco := false) -> bool:
	var P = P_menu
	var D: Dictionary = P.dados
	if not D.has("catalisador"):
		return false
	var pecas := [] # [peça, i da mochila (-1 = vestida), lugar vestido]
	for lg in P.prog.equip:
		var v = P.prog.equip[lg]
		if v != null and P.eh_equip(v):
			pecas.append([v, -1, str(lg)])
	for i in P.prog.mochila.size():
		var it = P.prog.mochila[i]
		if it != null and P.eh_equip(it):
			pecas.append([it, i, ""])
	var achou := false
	for p in pecas:
		var it = p[0]
		var tipo := tipo_catalisador(it.k)
		if so_tipo != "" and tipo != so_tipo:
			continue
		var prof: String = str(D.receitas[it.k].prof) if D.receitas.has(it.k) else ("fer" if tipo == "arma" else "alf")
		if not (("bigorna" if prof == "fer" else "bancada") in ests):
			continue
		var pode_evoluir: bool = not so_reforco and p[1] >= 0 and int(it.r) < D.raridades.size() - 1
		var pode_reforcar: bool = int(it.get("e", 0)) < P.reforco_max(it)
		if not pode_evoluir and not pode_reforcar:
			continue
		if not achou:
			separador("Melhorar equipamento")
			var ex := rotulo("Evoluir sobe a raridade (Épica vira Lendária, Lendária vira Mítica) com catalisador e material. Reforçar dá +1.", 12, APAGADO)
			ex.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			conteudo.add_child(ex)
			achou = true
		var cx := PanelContainer.new()
		cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1), P.cor_item(it).darkened(0.3), 1, 8))
		var l := HBoxContainer.new()
		l.add_theme_constant_override("separation", 12)
		cx.add_child(l)
		var c := celula(it, false, func(): pass, 52)
		c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		l.add_child(c)
		var txt := VBoxContainer.new()
		txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		txt.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		txt.add_theme_constant_override("separation", 2)
		txt.add_child(rotulo(P.nome_item(it), 15, P.cor_item(it)))
		if pode_evoluir:
			var r := int(it.r) + 1
			var usa := {D.catalisador[tipo][r - 1]: 1}
			usa.merge(D.catalisador.usa[tipo][r - 1])
			var partes := []
			var tem_tudo := true
			for k in usa:
				var tem: int = P.contar(k)
				tem_tudo = tem_tudo and tem >= int(usa[k])
				partes.append("%s %d/%d" % [D.itens[k].nome, tem, int(usa[k])])
			txt.add_child(rotulo("Evoluir para %s:" % D.raridades[r].nome, 12, VERDE if tem_tudo else Color("e0806a")))
			var ics := HFlowContainer.new() # André 2026-11-09: materiais em ícone, nada de lista
			ics.add_theme_constant_override("h_separation", 8)
			for k in usa:
				ics.add_child(icone_material(str(k), P.contar(k), int(usa[k])))
			txt.add_child(ics)
		elif p[1] < 0 and not so_reforco:
			txt.add_child(rotulo("Vestida · para evoluir, tire e guarde na mochila", 12, APAGADO))
		l.add_child(txt)
		var bs := VBoxContainer.new()
		bs.add_theme_constant_override("separation", 4)
		bs.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		if pode_evoluir:
			var i: int = p[1]
			var be := botao("Evoluir", func(): perguntar_evoluir(i), 14, true)
			be.custom_minimum_size = Vector2(120, 36)
			bs.add_child(be)
		if pode_reforcar:
			var onde := {"i": p[1]} if p[1] >= 0 else {"lugar": p[2]}
			var rf := botao("Reforçar", func(): m.reforco.abrir(onde), 14, not pode_evoluir) # abre a janela (1 vez / Até o máximo)
			rf.custom_minimum_size = Vector2(120, 36)
			bs.add_child(rf)
		l.add_child(bs)
		conteudo.add_child(cx)
	return achou

# estação que o item pede ("" = cria em qualquer lugar). A mesma conta de linha_criavel.
func estacao_do_item(e: Dictionary) -> String:
	var D: Dictionary = P_menu.dados
	if e.tipo == "receita":
		var R: Dictionary = D.receitas[e.k]
		var faz_s := str(R.faz)
		return "fornalha" if faz_s.begins_with("barra_") or faz_s == "carvao" else "bigorna" if str(R.prof) == "fer" else "fogao" if str(R.prof) == "coz" else "bancada"
	var cons = m.construcao
	var C: Dictionary = cons.dados_criar(e.k) if cons != null else D.get("construcoes", {}).get(e.k, D.get("ferramentas", {}).get(e.k, {}))
	return "bancada" if C.get("bancada", false) else ""

# ---------- Criar igual ao Quimera ----------
func montar_criar_quimera() -> void:
	var busca := LineEdit.new()
	busca.placeholder_text = "Buscar"
	busca.text = busca_criar
	busca.right_icon = icone_tex("lupa") if ResourceLoader.exists("res://icones/lupa.svg") else null
	busca.add_theme_font_size_override("font_size", 16)
	busca.custom_minimum_size = Vector2(0, 42)
	busca.add_theme_stylebox_override("normal", caixa(Color(0.035, 0.03, 0.026, 1), Color(0.36, 0.29, 0.19), 1, 10))
	busca.add_theme_stylebox_override("focus", caixa(Color(0.035, 0.03, 0.026, 1), OURO, 1, 10))
	busca.clear_button_enabled = true
	busca.text_changed.connect(func(t: String):
		busca_criar = t
		preencher_lista_criar())
	conteudo.add_child(busca)
	# estações perto, para alternar entre uma e outra (Fornalha e Baú abrem a janela deles)
	var ests := estacoes_perto()
	var cons = m.construcao
	var tem_bau: bool = cons != null and cons.estacao_perto(["bau"])
	if est_criar != "" and not (est_criar in ests):
		est_criar = ""
	var chips := HFlowContainer.new()
	chips.add_theme_constant_override("h_separation", 8)
	chips.add_theme_constant_override("v_separation", 6)
	for est in ["bancada", "bigorna", "fornalha", "fogao"]: # mesma ordem do Quimera (Bancada, Bigorna, Forno, Baú)
		if est in ests:
			chips.add_child(chip_estacao(est, str(NOME_ESTACAO[est]).split(" ")[0], est == est_criar))
	if tem_bau:
		chips.add_child(chip_estacao("bau", "Baú", false))
	var vt := botao("Qualquer lugar", func(): # era "Ver tudo"; agora só o que se cria longe de estação (André 2026-11-21)
		est_criar = ""
		atualizar(), 15, est_criar == "")
	vt.custom_minimum_size = Vector2(0, 40)
	vt.icon = icone_tex("topo_mochila")
	vt.expand_icon = false
	vt.add_theme_constant_override("icon_max_width", 24)
	chips.add_child(vt)
	conteudo.add_child(chips)
	lista_criar = VBoxContainer.new()
	lista_criar.add_theme_constant_override("separation", 8)
	conteudo.add_child(lista_criar)
	preencher_lista_criar()

func chip_estacao(est: String, nome: String, ativo: bool) -> Button:
	var b := botao(nome, func(): tocar_chip_estacao(est), 15, ativo)
	b.custom_minimum_size = Vector2(0, 40)
	b.icon = icone_tex("cs_" + est)
	b.expand_icon = false
	b.add_theme_constant_override("icon_max_width", 26)
	return b

func tocar_chip_estacao(est: String) -> void:
	var cons = m.construcao
	if est == "fornalha" and cons != null and cons.minha_fornalha_perto() != "":
		fechar()
		cons.abrir_forno(cons.minha_fornalha_perto())
		return
	if est == "bau" and cons != null:
		fechar()
		cons.tocar_estacao("bau")
		return
	est_criar = est
	grupos_abertos = {}
	atualizar()
	rolagem.scroll_vertical = 0

# o que entra num grupo: [{e, rar}] (arma e armadura: uma linha por raridade), já filtrado pela estação e pela busca
func entradas_grupo(g: String) -> Array:
	var D: Dictionary = P_menu.dados
	var out := []
	var q := busca_criar.strip_edges().to_lower()
	for e in itens_criar(g):
		# André 2026-11-21: "separar completamente": bancada só o da bancada, bigorna só o da bigorna e o Criar da
		# bolsa (est_criar "") só o que se cria em qualquer lugar. Tudo junto, só para consultar: aba Recipedia.
		if estacao_do_item(e) != est_criar:
			continue
		var equip: bool = e.tipo == "receita" and D.has("catalisador") and D.itens[str(D.receitas[e.k].faz)].has("lugar")
		for r in (D.raridades.size() if equip else 1):
			var nome: String = P_menu.nome_item({"k": str(D.receitas[e.k].faz), "r": r}) if equip else str(e.nome)
			if q != "" and not (q in nome.to_lower()) and not (q in str(e.nome).to_lower()):
				continue
			out.append({"e": e, "rar": r if equip else -1})
	return out

# dá para criar agora? (a mesma conta do botão Criar da linha)
func pode_criar_ja(x: Dictionary) -> bool:
	var P = P_menu
	var D: Dictionary = P.dados
	var e: Dictionary = x.e
	var cons = m.construcao
	if e.tipo == "receita":
		var R: Dictionary = P.receita_na_raridade(e.k, maxi(0, int(x.rar)))
		var est := estacao_do_item(e)
		if not (m.trabalho.perto_oficina(str(R.prof)) or (cons != null and cons.estacao_perto([est]))):
			return false
		if P.prof_nivel(str(R.prof)) < int(R.nivel) or P.vigor() < P.custo_vigor(str(R.prof), float(R.vigor)):
			return false
		for k in R.usa:
			if P.contar(k) < int(R.usa[k]):
				return false
		return int(x.rar) <= 0 or P.peca_para_evoluir(str(R.faz), int(x.rar)) >= 0
	if cons == null or cons.motivo_criar(e.k) != "":
		return false
	var C: Dictionary = cons.dados_criar(e.k)
	if C.get("bancada", false) and not cons.estacao_perto(["bancada"]):
		return false
	for k in C.get("custo", {}):
		if P.contar(k) < int(C.custo[k]):
			return false
	return true

func preencher_lista_criar() -> void:
	if lista_criar == null or not is_instance_valid(lista_criar):
		return
	for c in lista_criar.get_children():
		lista_criar.remove_child(c)
		c.queue_free()
	var buscando := busca_criar.strip_edges() != ""
	var algum := false
	for g in GRUPOS_CRIAR:
		var k: String = g[0]
		if k == "melhorar":
			if busca_criar.strip_edges() != "":
				continue
			var ests: Array = [est_criar] if est_criar != "" else estacoes_perto()
			if not ("bigorna" in ests or "bancada" in ests):
				continue
			var antes = conteudo # montar_melhorar_aqui escreve em "conteudo": aponta para a sanfona
			var corpo := VBoxContainer.new()
			corpo.add_theme_constant_override("separation", 6)
			conteudo = corpo
			var tem := montar_melhorar_aqui(ests)
			conteudo = antes
			if not tem:
				corpo.queue_free()
				continue
			algum = true
			for i in 2: # sem o separador "MELHORAR EQUIPAMENTO": o cabeçalho da sanfona já diz
				var sp := corpo.get_child(0)
				corpo.remove_child(sp)
				sp.queue_free()
			lista_criar.add_child(cabeca_grupo(k, str(g[1]), -1, corpo.get_child_count() - 1))
			if grupos_abertos.get(k, false):
				lista_criar.add_child(corpo)
			else:
				corpo.queue_free()
			continue
		var itens := entradas_grupo(k)
		if itens.is_empty():
			continue
		algum = true
		var prontas := 0
		for x in itens:
			if pode_criar_ja(x):
				prontas += 1
		lista_criar.add_child(cabeca_grupo(k, str(g[1]), prontas, itens.size()))
		if not (grupos_abertos.get(k, false) or buscando):
			continue
		var corpo := VBoxContainer.new()
		corpo.add_theme_constant_override("separation", 6)
		if k == "materiais" and est_criar == "fornalha" and not buscando:
			corpo.add_child(linha_fornalha())
		for x in itens:
			corpo.add_child(linha_criavel_rar(x.e, int(x.rar)) if int(x.rar) >= 0 else linha_criavel(x.e))
		if k in ["armaduras", "armas"] and not buscando: # as suas peças para evoluir e reforçar, no mesmo grupo
			linhas_melhorar(corpo, "armadura" if k == "armaduras" else "arma")
		lista_criar.add_child(corpo)
	if not algum:
		lista_criar.add_child(rotulo("Nada encontrado." if buscando else "Nada para criar aqui.", 14, APAGADO))
	if est_criar == "" and not buscando: # na bolsa: o resto fica na estação; a Recipedia mostra tudo
		lista_criar.add_child(aviso_recipedia())

# "O que pede bancada, bigorna, fornalha ou fogão só aparece perto dela" + botão Recipedia
func aviso_recipedia() -> Control:
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1), Color(0.3, 0.24, 0.16), 1, 8))
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 12)
	cx.add_child(l)
	for est in ["bancada", "bigorna", "fornalha", "fogao"]:
		var ic := TextureRect.new()
		ic.texture = icone_tex("cs_" + est)
		ic.custom_minimum_size = Vector2(30, 30)
		ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		l.add_child(ic)
	var t := rotulo("O que pede bancada, bigorna, fornalha ou fogão aparece só perto dela. Para ver tudo, abra a Recipedia.", 13, OURO_CLARO)
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	l.add_child(t)
	var b := botao("Recipedia", func(): trocar_aba("recipedia"), 14, true)
	b.custom_minimum_size = Vector2(110, 40)
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(b)
	return cx

# evoluir/reforçar as peças da mochila e vestidas, dentro do grupo (sem o título "Melhorar equipamento")
func linhas_melhorar(corpo: Control, tipo: String) -> void:
	if est_criar == "": # evoluir e reforçar são na bigorna e na bancada, não na bolsa (André 2026-11-21)
		return
	var ests: Array = [est_criar] if est_criar != "" else estacoes_perto()
	var antes = conteudo # montar_melhorar_aqui escreve em "conteudo"
	var tmp := VBoxContainer.new()
	conteudo = tmp
	var tem := montar_melhorar_aqui(ests, tipo, true) # evoluir já é a linha da raridade (precisa da peça de baixo)
	conteudo = antes
	if tem:
		for i in 3: # separador (2) e a explicação: o grupo já diz o que é
			var sp := tmp.get_child(0)
			tmp.remove_child(sp)
			sp.queue_free()
		for c in tmp.get_children():
			tmp.remove_child(c)
			corpo.add_child(c)
	tmp.queue_free()

# cabeçalho da sanfona: ▸ ARMADURAS ........ 2/25 (verde = dá para criar agora)
func cabeca_grupo(k: String, nome: String, prontas: int, total: int) -> Control:
	var aberto: bool = grupos_abertos.get(k, false) or busca_criar.strip_edges() != ""
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.set_meta("guia", "grupo:" + k) # guia.gd: abrir o grupo onde está o que a missão pede
	b.custom_minimum_size = Vector2(0, 54)
	var st := caixa(Color(0.16, 0.135, 0.11, 1) if aberto else Color(0.12, 0.103, 0.085, 1), Color(0.34, 0.28, 0.2), 1, 12)
	for e in ["normal", "hover", "pressed"]:
		b.add_theme_stylebox_override(e, st)
	b.pressed.connect(func():
		if _arrastou:
			return
		grupos_abertos[k] = not grupos_abertos.get(k, false)
		preencher_lista_criar())
	var h := HBoxContainer.new()
	h.set_anchors_preset(Control.PRESET_FULL_RECT)
	h.offset_left = 16
	h.offset_right = -18
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var t := rotulo(("▾  " if aberto else "▸  ") + Idioma.frase(nome).to_upper(), 18, TEXTO)
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	t.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	t.size_flags_vertical = Control.SIZE_FILL
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(t)
	var n := RichTextLabel.new()
	n.bbcode_enabled = true
	n.fit_content = true
	n.scroll_active = false
	n.autowrap_mode = TextServer.AUTOWRAP_OFF
	n.custom_minimum_size = Vector2(90, 0)
	n.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	n.mouse_filter = Control.MOUSE_FILTER_IGNORE
	n.add_theme_font_size_override("normal_font_size", 17)
	n.add_theme_font_size_override("bold_font_size", 17)
	n.text = "[right]%s[/right]" % (str(total) if prontas < 0 else ("[b][color=#7fd46a]%d[/color][/b]/%d" % [prontas, total] if prontas > 0 else "%d" % total))
	h.add_child(n)
	b.add_child(h)
	return b

# arma e armadura: linha com as 5 raridades; o resto, a linha de sempre
func linha_do_criar(e: Dictionary) -> Control:
	var D: Dictionary = P_menu.dados
	if e.tipo == "receita" and D.has("catalisador") and D.itens[str(D.receitas[e.k].faz)].has("lugar"):
		return linha_criavel_rar(e)
	return linha_criavel(e)

# André 2026-11-09: "comum, raro, épico, lendário e mítico para craftar, mostrando os itens que precisa com um
# símbolozinho, nada de lista". Toque na raridade; embaixo os materiais em ícones com tem/precisa (toque no ícone
# diz o nome). Comum é a receita de sempre (com a sorte de sair melhor); as outras saem certinho nela e pedem o
# Selo/Runa da raridade e o material de evoluir (shared/simulacao.js receitaNaRaridade).
func linha_criavel_rar(e: Dictionary, fixa := -1) -> Control:
	var P = P_menu
	var D: Dictionary = P.dados
	var cons = m.construcao
	var R0: Dictionary = D.receitas[e.k]
	var rar: int = clampi(fixa if fixa >= 0 else int(rar_criar.get(e.k, 0)), 0, D.raridades.size() - 1)
	var R: Dictionary = P.receita_na_raridade(e.k, rar)
	var faz_s := str(R0.faz)
	var est := "bigorna" if str(R0.prof) == "fer" else "bancada"
	var of: Dictionary = D.oficina[str(R0.prof)]
	var onde: String = NOME_ESTACAO[est] if str(of.npc) == "" else "%s ou %s" % [NOME_ESTACAO[est], str(of.onde).replace("na ", "a ")]
	var aqui: bool = m.trabalho.perto_oficina(str(R0.prof)) or (cons != null and cons.estacao_perto([est]))
	var nv_ok: bool = P.prof_ok(str(R0.prof), int(R.nivel), faz_s if rar == 0 else "")
	var custo: float = P.custo_vigor(str(R0.prof), float(R.vigor))
	var it := {"k": faz_s, "r": rar}
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1) if aqui and nv_ok else Color(0.07, 0.063, 0.055, 1), P.cor_item(it).darkened(0.35), 1, 8))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	cx.add_child(v)
	# cabeçalho: peça na raridade escolhida, nome e nível
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 10)
	var c := celula(it, false, func(): pass, 52)
	c.pressed.connect(func(): # tocar na peça também diz o nome
		if not _arrastou:
			balao_nome(c, P.nome_item(it), P.cor_item(it)))
	c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(c)
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.add_theme_constant_override("separation", 2)
	txt.add_child(rotulo(P.nome_item(it), 15, P.cor_item(it) if nv_ok else APAGADO))
	txt.add_child(rotulo("%s Nv %d" % [D.profissoes[str(R0.prof)].nome, int(R0.nivel)], 12, OURO_CLARO if nv_ok else Color("e0806a")))
	var o := rotulo(("%s · você está aqui" % onde) if aqui else onde, 12, VERDE if aqui else OURO)
	o.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	if fixa < 0 or not aqui: # na linha compacta (sanfona) a estação já está escolhida em cima
		txt.add_child(o)
	if fixa >= 0:
		txt.size_flags_horizontal = Control.SIZE_FILL
		txt.custom_minimum_size = Vector2(190, 0)
		txt.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(txt)
	v.add_child(l)
	# as 5 raridades (na tela do Quimera cada raridade já é uma linha: sem seletor)
	var rs := HBoxContainer.new()
	rs.visible = fixa < 0
	rs.add_theme_constant_override("separation", 4)
	for r in D.raridades.size():
		var nome_r := str(D.raridades[r].nome)
		var br := botao(nome_r, func():
			rar_criar[e.k] = r
			atualizar(), 12, r == rar)
		br.custom_minimum_size = Vector2(0, 30)
		br.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		br.add_theme_color_override("font_color", Color(D.raridades[r].cor) if r != rar else Color(D.raridades[r].cor).lightened(0.35))
		rs.add_child(br)
	if fixa < 0:
		v.add_child(rs)
	else:
		rs.queue_free()
	# materiais em ícones + botão Criar
	var baixo := HBoxContainer.new()
	baixo.add_theme_constant_override("separation", 8)
	var mats := HFlowContainer.new()
	mats.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mats.add_theme_constant_override("h_separation", 8)
	mats.add_theme_constant_override("v_separation", 4)
	var tem := true
	if rar > 0: # evoluir: primeiro a peça da raridade de baixo
		var baixa := {"k": faz_s, "r": rar - 1}
		var qt := 0
		for ob in P.prog.mochila:
			if ob != null and str(ob.k) == faz_s and int(ob.get("r", 0)) == rar - 1 and not ob.has("n"):
				qt += 1
		tem = qt >= 1
		mats.add_child(icone_material(faz_s, qt, 1, baixa))
	for k in R.usa:
		var n := int(R.usa[k])
		var t2: int = P.contar(k)
		tem = tem and t2 >= n
		mats.add_child(icone_material(str(k), t2, n))
	if custo > 0.0:
		var vg := rotulo("Vigor %s" % P.num(custo, 1), 12, COR_VIGOR if P.vigor() >= custo else Color("e0806a"))
		vg.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		mats.add_child(vg)
	baixo.add_child(mats)
	var pode: bool = aqui and nv_ok and tem and P.vigor() >= custo
	var b := botao("Criar", func(): # Raro em diante gasta a peça da raridade de baixo (André: "é uma aba só")
		if not _arrastou:
			criar(e.k, rar), 14, pode)
	b.custom_minimum_size = Vector2(96, 40)
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	b.disabled = not pode
	if rar == 0: # guia.gd: o Criar que a missão pede (longe da estação: o guia manda fechar e ir até lá)
		b.set_meta("guia", ("criar:" if aqui else "criar_longe:") + str(e.k))
	avisar_travado(b, func():
		if rar > 0 and P.peca_para_evoluir(faz_s, rar) < 0:
			return "Precisa de %s na mochila (evolui a de baixo)" % P.nome_item({"k": faz_s, "r": rar - 1})
		return motivo_receita(aqui, onde, nv_ok, "%s Nv %d" % [D.profissoes[str(R0.prof)].nome, int(R.nivel)], R.usa, custo))
	baixo.add_child(b)
	if fixa >= 0: # uma linha só: peça · nome · materiais · Criar (como no Quimera)
		baixo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		mats.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		l.add_child(baixo)
	else:
		v.add_child(baixo)
	return cx

# material como símbolo: ícone com "tem/precisa" embaixo (verde ou vermelho); tocar diz o nome
# requisito do próximo nível do clã que não é item (nível do líder, ouro do cofre): o mesmo quadradinho do
# icone_material, com o desenho (ou um texto curto, "Nv") e tenho/preciso embaixo; número grande vira "25k"
# moral do recruta (MORAL, André 2026-11-25: "setinha verde pra cima... no meio amarelo, seta pro lado... lá embaixo
# vermelha pra baixo... e o percentual do lado"; "mais ou menos 20 mobs por hora"): pouca coisa na tela do celular:
# [ícone da ordem ~20/h] [seta 99%]. Tocar explica com um aviso.
func _moral_ui(fila: HBoxContainer, r: Dictionary, vivo: Dictionary) -> void:
	var ph := HBoxContainer.new()
	ph.add_theme_constant_override("separation", 2)
	var ti := TextureRect.new()
	ti.custom_minimum_size = Vector2(20, 20)
	ti.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ti.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ti.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	ph.add_child(ti)
	var tl := rotulo("", 13, TEXTO)
	ph.add_child(tl)
	fila.add_child(ph)
	var mb := Button.new() # a seta e o % (tocar: o que sobe e o que desce)
	mb.flat = true
	mb.focus_mode = Control.FOCUS_NONE
	var mh := HBoxContainer.new()
	mh.add_theme_constant_override("separation", 3)
	mh.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mh.set_anchors_preset(Control.PRESET_FULL_RECT)
	var seta := Control.new()
	seta.custom_minimum_size = Vector2(16, 16)
	seta.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	seta.mouse_filter = Control.MOUSE_FILTER_IGNORE
	seta.draw.connect(func(): _desenhar_seta(seta))
	mh.add_child(seta)
	var ml := rotulo("", 15, TEXTO)
	ml.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mh.add_child(ml)
	var fome := TextureRect.new() # comida: a Despensa está mexendo no %
	fome.texture = icone_tex("it_peixe_assado")
	fome.custom_minimum_size = Vector2(16, 16)
	fome.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	fome.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	fome.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	fome.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mh.add_child(fome)
	mb.add_child(mh)
	mb.custom_minimum_size = Vector2(64, 26)
	var rid := str(r.get("id", ""))
	mb.pressed.connect(func():
		if _arrastou:
			return
		var d := _recruta_agora(rid, r)
		m.hud.aviso(_moral_texto(d)))
	fila.add_child(mb)
	vivo["moral"] = [seta, ml, ti, tl, ph, fome]
	_moral_pintar(vivo, r)

# o que o tocar na seta diz: a moral, se sobe ou desce por hora, e a comida (que mexe no % sem mexer na moral)
func _moral_texto(d: Dictionary) -> String:
	var tend := int(d.get("tr", 0))
	var t := Idioma.frase("Moral %d (%s por hora)") % [int(d.get("ml", 0)), ("+%d" % tend) if tend > 0 else str(tend)]
	if d.has("fm"):
		t += Idioma.frase(" · %s: %+d%% (comida no Baú do Clã)") % [Idioma.frase(str(d.get("fn2", ""))), int(d.fm)]
	t += Idioma.frase(" · rende %d%%. Sobe: perto de você ou no seu time, Livre, Elogiar. Desce: 3 h seguidas trabalhando, 12 h sem você no jogo.") % int(d.get("re", 100))
	return t

func _moral_pintar(vivo: Dictionary, d: Dictionary) -> void:
	var q = vivo.get("moral")
	if not (q is Array) or not is_instance_valid(q[0]) or not d.has("re"):
		return
	var cor := Color.html(str(d.get("cor", "#9ad86a")))
	q[0].set_meta("seta", str(d.get("seta", "cima")))
	q[0].set_meta("cor", cor)
	q[0].queue_redraw()
	q[1].text = "%d%%" % int(d.get("re", 100))
	q[5].visible = d.has("fm") # a comida mexe no %: o garfo aparece (laranja com fome, verde bem alimentado)
	q[5].modulate = Color(1, 0.6, 0.35) if int(d.get("fm", 0)) < 0 else Color(0.6, 1, 0.6)
	q[1].add_theme_color_override("font_color", cor)
	var ph = d.get("ph")
	q[4].visible = ph is Dictionary
	if ph is Dictionary:
		q[2].texture = icone_tex("it_" + str(ph.get("i", "")))
		q[3].text = "~%d/h" % int(ph.get("n", 0))

func _desenhar_seta(c: Control) -> void:
	var s := c.size
	var cor: Color = c.get_meta("cor", Color(0.6, 0.85, 0.4))
	var k := str(c.get_meta("seta", "cima"))
	var pts: PackedVector2Array
	if k == "cima":
		pts = PackedVector2Array([Vector2(s.x * 0.5, 1), Vector2(s.x - 1, s.y * 0.55), Vector2(s.x * 0.68, s.y * 0.55), Vector2(s.x * 0.68, s.y - 1), Vector2(s.x * 0.32, s.y - 1), Vector2(s.x * 0.32, s.y * 0.55), Vector2(1, s.y * 0.55)])
	elif k == "baixo":
		pts = PackedVector2Array([Vector2(s.x * 0.5, s.y - 1), Vector2(1, s.y * 0.45), Vector2(s.x * 0.32, s.y * 0.45), Vector2(s.x * 0.32, 1), Vector2(s.x * 0.68, 1), Vector2(s.x * 0.68, s.y * 0.45), Vector2(s.x - 1, s.y * 0.45)])
	else:
		pts = PackedVector2Array([Vector2(s.x - 1, s.y * 0.5), Vector2(s.x * 0.45, 1), Vector2(s.x * 0.45, s.y * 0.32), Vector2(1, s.y * 0.32), Vector2(1, s.y * 0.68), Vector2(s.x * 0.45, s.y * 0.68), Vector2(s.x * 0.45, s.y - 1)])
	c.draw_colored_polygon(pts, cor)

func _icone_req_cla(tex: Texture2D, texto: String, nome: String, tem: int, precisa: int) -> Control:
	var ok := tem >= precisa
	var bx := VBoxContainer.new()
	bx.add_theme_constant_override("separation", 0)
	bx.custom_minimum_size = Vector2(44, 0)
	var q := Button.new()
	q.focus_mode = Control.FOCUS_NONE
	q.custom_minimum_size = Vector2(40, 40)
	q.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var st := caixa(Color(0.045, 0.04, 0.036, 1), Color(0.45, 0.78, 0.45, 0.8) if ok else Color(0.88, 0.5, 0.42, 0.8), 1, 6)
	for e in ["normal", "hover", "pressed"]:
		q.add_theme_stylebox_override(e, st)
	if tex != null:
		var ic := TextureRect.new()
		ic.texture = tex
		ic.set_anchors_preset(Control.PRESET_FULL_RECT)
		ic.offset_left = 4
		ic.offset_top = 4
		ic.offset_right = -4
		ic.offset_bottom = -4
		ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
		q.add_child(ic)
	else:
		q.text = texto
		q.add_theme_font_size_override("font_size", 15)
		q.add_theme_color_override("font_color", OURO_CLARO)
	q.pressed.connect(func():
		if not _arrastou:
			balao_nome(q, "%s: tem %d, precisa %d" % [Idioma.t(nome), tem, precisa], OURO_CLARO))
	bx.add_child(q)
	var curto := func(v: int) -> String: return "%dk" % (v / 1000) if v >= 10000 else str(v)
	var n := rotulo("%s/%s" % [curto.call(mini(tem, precisa)), curto.call(precisa)], 11, VERDE if ok else Color("e0806a"))
	n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bx.add_child(n)
	return bx

# material como símbolo (acima): balao: outro texto ao tocar; so_qtd: só a quantidade (estoque, sem pedido), com a borda neutra
func icone_material(k: String, tem: int, precisa: int, peca := {}, balao := "", so_qtd := false) -> Control:
	var P = P_menu
	var alvo: Dictionary = peca if not peca.is_empty() else {"k": k}
	var bx := VBoxContainer.new()
	bx.add_theme_constant_override("separation", 0)
	bx.custom_minimum_size = Vector2(44, 0)
	var q := Button.new()
	q.focus_mode = Control.FOCUS_NONE
	q.custom_minimum_size = Vector2(40, 40)
	q.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	var st := caixa(Color(0.045, 0.04, 0.036, 1), OURO.darkened(0.3) if so_qtd else (Color(0.45, 0.78, 0.45, 0.8) if tem >= precisa else Color(0.88, 0.5, 0.42, 0.8)), 1, 6)
	for e in ["normal", "hover", "pressed"]:
		q.add_theme_stylebox_override(e, st)
	var ic := TextureRect.new()
	ic.texture = icone_tex(P.icone_item(alvo))
	ic.set_anchors_preset(Control.PRESET_FULL_RECT)
	ic.offset_left = 4
	ic.offset_top = 4
	ic.offset_right = -4
	ic.offset_bottom = -4
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.modulate = tinta(ic.texture, P.cor_item(alvo))
	ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
	q.add_child(ic)
	var nome: String = balao if balao != "" else (str(P.nome_item(alvo)) if not peca.is_empty() else str(P.dados.itens[k].nome))
	q.pressed.connect(func():
		if not _arrastou:
			balao_nome(q, nome, P.cor_item(alvo)))
	bx.add_child(q)
	var n := rotulo(("%d" % tem) if so_qtd else ("%d/%d" % [tem, precisa]), 11, TEXTO if so_qtd else (VERDE if tem >= precisa else Color("e0806a")))
	n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bx.add_child(n)
	return bx

# uma linha da aba Criar: ícone, nome, onde se cria (verde se você está lá), materiais e o botão Criar.
# Longe da estação certa o botão vira uma plaquinha com o nome dela: dá para ver a receita, mas não criar.
func linha_criavel(e: Dictionary) -> Control:
	var P = P_menu
	var D: Dictionary = P.dados
	var cons = m.construcao
	var usa: Dictionary
	var faz: Dictionary
	var onde := ""
	var est := ""
	var aqui := true
	var nv_ok := true
	var custo := 0.0
	var motivo := ""
	if e.tipo == "receita":
		var R: Dictionary = D.receitas[e.k]
		usa = R.usa
		faz = {"k": str(R.faz), "r": 0} if D.itens[str(R.faz)].has("lugar") else {"k": str(R.faz), "n": 1}
		var faz_s := str(R.faz)
		est = "fornalha" if faz_s.begins_with("barra_") or faz_s == "carvao" else "bigorna" if str(R.prof) == "fer" else "fogao" if str(R.prof) == "coz" else "bancada"
		var of: Dictionary = D.oficina[str(R.prof)]
		onde = NOME_ESTACAO[est] if str(of.npc) == "" else "%s ou %s" % [NOME_ESTACAO[est], str(of.onde).replace("na ", "a ")]
		aqui = m.trabalho.perto_oficina(str(R.prof)) or (cons != null and cons.estacao_perto([est]))
		nv_ok = P.prof_ok(str(R.prof), int(R.nivel), faz_s)
		custo = P.custo_vigor(str(R.prof), float(R.vigor))
	else:
		var C: Dictionary = cons.dados_criar(e.k) if cons != null else D.get("construcoes", {}).get(e.k, D.get("ferramentas", {}).get(e.k, {}))
		usa = C.get("custo", {})
		faz = {"k": ("obra_" + e.k) if D.get("construcoes", {}).has(e.k) else e.k, "n": 1}
		if C.get("bancada", false):
			est = "bancada"
			onde = NOME_ESTACAO.bancada
			aqui = cons != null and cons.estacao_perto(["bancada"])
		else:
			onde = "Em qualquer lugar"
		if cons != null:
			motivo = cons.motivo_criar(e.k)
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1) if aqui and nv_ok else Color(0.07, 0.063, 0.055, 1), Color(0.3, 0.24, 0.16), 1, 8))
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 12)
	cx.add_child(l)
	var c := celula(faz, false, func(): pass, 52)
	c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(c)
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.add_theme_constant_override("separation", 2)
	var cab := HBoxContainer.new()
	cab.add_theme_constant_override("separation", 10)
	cab.add_child(rotulo(str(e.nome), 15, TEXTO if nv_ok else APAGADO))
	if e.tipo == "receita":
		var R: Dictionary = D.receitas[e.k]
		cab.add_child(rotulo("%s Nv %d" % [D.profissoes[str(R.prof)].nome, int(R.nivel)], 12, OURO_CLARO if nv_ok else Color("e0806a")))
	txt.add_child(cab)
	var o := rotulo(("%s · você está aqui" % onde) if est != "" and aqui else onde, 12, VERDE if aqui else OURO)
	o.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	txt.add_child(o)
	var tem := true
	var mats := HFlowContainer.new()
	mats.add_theme_constant_override("h_separation", 12)
	for k in usa:
		var n := int(usa[k])
		var t2: int = P.contar(k)
		if t2 < n:
			tem = false
		mats.add_child(icone_material(str(k), t2, n)) # André 2026-11-09: material em ícone, nada de lista
	if custo > 0.0:
		mats.add_child(rotulo("Vigor %s" % P.num(custo, 1), 12, COR_VIGOR if P.vigor() >= custo else Color("e0806a")))
	txt.add_child(mats)
	l.add_child(txt)
	if not aqui: # plaquinha da estação no lugar do botão
		var pl := PanelContainer.new()
		pl.add_theme_stylebox_override("panel", caixa(Color(0.06, 0.052, 0.045, 1), Color(0.36, 0.29, 0.19), 1, 8))
		pl.custom_minimum_size = Vector2(96, 40)
		pl.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		var pv := VBoxContainer.new()
		pv.add_theme_constant_override("separation", 0)
		pv.alignment = BoxContainer.ALIGNMENT_CENTER
		var ic2 := TextureRect.new()
		ic2.texture = icone_tex("cs_" + est)
		ic2.custom_minimum_size = Vector2(22, 22)
		ic2.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ic2.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ic2.modulate = tinta(ic2.texture, APAGADO)
		pv.add_child(ic2)
		var nl := rotulo(str(NOME_ESTACAO[est]).split(" ")[0], 12, APAGADO) # "Bigorna", "Fornalha", "Bancada"
		nl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		pv.add_child(nl)
		pl.add_child(pv)
		pl.set_meta("guia", "criar_longe:" + str(e.k)) # guia.gd: longe da estação, o guia manda fechar e ir até lá
		l.add_child(pl)
		return cx
	var pode: bool = nv_ok and tem and P.vigor() >= custo and motivo == ""
	var b := botao("Criar", func(): criar_item(e), 14, pode)
	b.set_meta("guia", "criar:" + str(e.k)) # guia das missões (guia.gd)
	b.custom_minimum_size = Vector2(96, 40)
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	b.disabled = not pode
	avisar_travado(b, func():
		var nv_txt := "%s Nv %d" % [D.profissoes[str(D.receitas[e.k].prof)].nome, int(e.nivel)] if e.tipo == "receita" else ""
		var mt := motivo_receita(aqui, onde, nv_ok, nv_txt, usa, custo)
		return mt if mt != "" else motivo)
	l.add_child(b)
	if e.tipo == "obra" and motivo.begins_with("Você já tem"):
		o.text = Idioma.frase(motivo)
	return cx

# ---------- Recipedia (André 2026-11-21) ----------
# "Queria poder acessar um menu e ter todos os itens craftáveis do jogo, como se fosse um Wikipedia... incluindo os
# packs, separados pelo nome do mercador... nada de lista, com símbolos, no mesmo formato de todo o jogo, mostrando
# quantos itens precisa". Aba da bolsa (abre de qualquer lugar), só para consultar: sem botão Criar. Os mesmos grupos
# sanfona da aba Criar, busca, filtro por estação (ícones) e os materiais em ícone com tem/precisa (icone_material).
const FILTROS_REC := [["", "Todas", ""], ["livre", "Qualquer lugar", "topo_mochila"], ["bancada", "Bancada", "cs_bancada"], ["bigorna", "Bigorna", "cs_bigorna"],
	["fornalha", "Fornalha", "cs_fornalha"], ["fogao", "Fogão", "cs_fogao"], ["pack", "Packs", "it_pack"]]
var est_rec := "" # filtro de cima ("" = todas)
var busca_rec := ""
var grupos_rec := {} # grupo -> aberto
var rar_rec := {} # receita -> raridade escolhida (armas e armaduras)
var lista_rec: VBoxContainer

func montar_recipedia() -> void:
	var busca := LineEdit.new()
	busca.placeholder_text = Idioma.frase("Buscar receita")
	busca.text = busca_rec
	busca.right_icon = icone_tex("lupa") if ResourceLoader.exists("res://icones/lupa.svg") else null
	busca.add_theme_font_size_override("font_size", 16)
	busca.custom_minimum_size = Vector2(0, 42)
	busca.add_theme_stylebox_override("normal", caixa(Color(0.035, 0.03, 0.026, 1), Color(0.36, 0.29, 0.19), 1, 10))
	busca.add_theme_stylebox_override("focus", caixa(Color(0.035, 0.03, 0.026, 1), OURO, 1, 10))
	busca.clear_button_enabled = true
	busca.text_changed.connect(func(t: String):
		busca_rec = t
		preencher_recipedia())
	conteudo.add_child(busca)
	var chips := HFlowContainer.new()
	chips.add_theme_constant_override("h_separation", 6)
	chips.add_theme_constant_override("v_separation", 6)
	for f in FILTROS_REC:
		var k: String = f[0]
		var b := botao(f[1], func():
			est_rec = k
			grupos_rec = {}
			atualizar()
			rolagem.scroll_vertical = 0, 14, k == est_rec)
		b.custom_minimum_size = Vector2(0, 38)
		if str(f[2]) != "":
			b.icon = icone_tex(str(f[2]))
			b.expand_icon = false
			b.add_theme_constant_override("icon_max_width", 24)
		chips.add_child(b)
	conteudo.add_child(chips)
	lista_rec = VBoxContainer.new()
	lista_rec.add_theme_constant_override("separation", 8)
	conteudo.add_child(lista_rec)
	preencher_recipedia()

# tudo o que se cria num grupo da aba Criar, mais barras e carvão (fornalha) em Materiais
func itens_recipedia(g: String) -> Array:
	var D: Dictionary = P_menu.dados
	var l := itens_criar(g)
	if g == "materiais":
		for r in D.receitas:
			if eh_da_fornalha(D.receitas[r]):
				l.append({"tipo": "receita", "k": r, "nome": str(D.itens[str(D.receitas[r].faz)].nome), "nivel": int(D.receitas[r].nivel)})
		l.sort_custom(func(a, b): return a.nivel < b.nivel or (a.nivel == b.nivel and a.nome.naturalnocasecmp_to(b.nome) < 0))
	return l

# mercadores de pack do mundo: [[nome, k do pack]] (sem mundo carregado: um "Mercador" por pack)
func mercadores_pack() -> Array:
	var PK: Dictionary = P_menu.dados.get("packs", {})
	var out := []
	var npcs = m.get("npcs")
	for n in (npcs if npcs is Array else []):
		if not (n is Dictionary):
			continue
		var k := str(n.get("info", {}).get("merch", n.get("merch", "")))
		if str(n.get("funcao", "")) == "pack" and PK.has(k):
			out.append([str(n.nome).get_slice(",", 0), k])
	if out.is_empty():
		for k in PK:
			out.append(["Mercador de pack", k])
	out.sort_custom(func(a, b): return a[0].naturalnocasecmp_to(b[0]) < 0)
	return out

func preencher_recipedia() -> void:
	if lista_rec == null or not is_instance_valid(lista_rec):
		return
	for c in lista_rec.get_children():
		lista_rec.remove_child(c)
		c.queue_free()
	var D: Dictionary = P_menu.dados
	var q := busca_rec.strip_edges().to_lower()
	var buscando := q != ""
	var algum := false
	var grupos := [] # [chave, nome, [linhas como {e, rar} ou {pack, merc}]]
	if est_rec != "pack":
		for g in GRUPOS_CRIAR:
			var itens := []
			for e in itens_recipedia(str(g[0])):
				var est := estacao_do_item(e)
				if est_rec != "" and est != ("" if est_rec == "livre" else est_rec):
					continue
				if q != "" and not (q in str(e.nome).to_lower()):
					continue
				itens.append({"e": e})
			grupos.append([str(g[0]), str(g[1]), itens])
	if est_rec in ["", "pack"]:
		var por_merc := {}
		var ordem := []
		for mk in mercadores_pack():
			var nome_pk := str(D.packs[mk[1]].nome)
			if q != "" and not (q in nome_pk.to_lower()) and not (q in str(mk[0]).to_lower()):
				continue
			if not por_merc.has(mk[0]):
				por_merc[mk[0]] = []
				ordem.append(mk[0])
			por_merc[mk[0]].append({"pack": mk[1], "merc": mk[0]})
		for nome in ordem:
			grupos.append(["pack:" + nome, "Packs · " + nome, por_merc[nome]])
	for g in grupos:
		var itens: Array = g[2]
		if itens.is_empty():
			continue
		algum = true
		var prontas := 0
		for x in itens:
			if tem_material_rec(x):
				prontas += 1
		var k: String = g[0]
		lista_rec.add_child(cabeca_grupo_rec(k, str(g[1]), prontas, itens.size()))
		if not (grupos_rec.get(k, false) or buscando):
			continue
		var corpo := VBoxContainer.new()
		corpo.add_theme_constant_override("separation", 6)
		for x in itens:
			corpo.add_child(linha_pack_rec(x.pack, x.merc) if x.has("pack") else linha_receita_rec(x.e))
		lista_rec.add_child(corpo)
	if not algum:
		lista_rec.add_child(rotulo("Nada encontrado." if buscando else "Nenhuma receita aqui.", 14, APAGADO))

# materiais da receita (na raridade escolhida) ou do pack: {k: n}
func materiais_rec(x: Dictionary) -> Dictionary:
	var D: Dictionary = P_menu.dados
	if x.has("pack"):
		if m.get("transporte") != null: # já com o desconto da profissão Mercador (transporte.gd custo)
			return m.transporte.custo(x.pack)
		return D.packs[x.pack].custo
	var e: Dictionary = x.e
	if e.tipo == "receita":
		return P_menu.receita_na_raridade(e.k, int(rar_rec.get(e.k, 0))).usa
	var cons = m.get("construcao")
	var C: Dictionary = cons.dados_criar(e.k) if cons != null else D.get("construcoes", {}).get(e.k, D.get("ferramentas", {}).get(e.k, {}))
	return C.get("custo", {})

func tem_material_rec(x: Dictionary) -> bool:
	var usa := materiais_rec(x)
	for k in usa:
		if P_menu.contar(k) < int(usa[k]):
			return false
	return true

# cabeçalho da sanfona da Recipedia (igual ao da aba Criar; verde = você já tem o material)
func cabeca_grupo_rec(k: String, nome: String, prontas: int, total: int) -> Control:
	var antes: Dictionary = grupos_abertos
	var antes_busca := busca_criar
	grupos_abertos = grupos_rec
	busca_criar = busca_rec
	var b: Button = cabeca_grupo(k, nome, prontas, total)
	grupos_abertos = antes
	busca_criar = antes_busca
	b.set_meta("guia", "rec:" + k)
	for c in b.pressed.get_connections():
		b.pressed.disconnect(c.callable)
	b.pressed.connect(func():
		if _arrastou:
			return
		grupos_rec[k] = not grupos_rec.get(k, false)
		preencher_recipedia())
	return b

# onde se cria, com o ícone da estação: "Bigorna ou a forja do Tomás"
func onde_rec(e: Dictionary) -> Array:
	var D: Dictionary = P_menu.dados
	var est := estacao_do_item(e)
	if est == "":
		return ["", "Em qualquer lugar (aba Criar)"]
	var onde: String = NOME_ESTACAO[est]
	if e.tipo == "receita":
		var of: Dictionary = D.oficina.get(str(D.receitas[e.k].prof), {})
		if str(of.get("npc", "")) != "":
			onde = "%s ou %s" % [onde, str(of.onde).replace("na ", "a ")]
	return [est, onde]

func linha_onde_rec(icone: String, texto: String) -> Control:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 6)
	if icone != "":
		var ic := TextureRect.new()
		ic.texture = icone_tex(icone)
		ic.custom_minimum_size = Vector2(20, 20)
		ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ic.modulate = tinta(ic.texture, OURO)
		ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		h.add_child(ic)
	var o := rotulo(texto, 12, OURO)
	o.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	o.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(o)
	return h

# uma receita para consultar: peça, nome, profissão e nível, onde se cria, raridades (arma e armadura) e materiais
func linha_receita_rec(e: Dictionary) -> Control:
	var P = P_menu
	var D: Dictionary = P.dados
	var equip: bool = e.tipo == "receita" and D.has("catalisador") and D.itens[str(D.receitas[e.k].faz)].has("lugar")
	var rar: int = clampi(int(rar_rec.get(e.k, 0)), 0, D.raridades.size() - 1) if equip else 0
	var faz: Dictionary
	var usa := materiais_rec({"e": e})
	var custo := 0.0
	var nv_txt := ""
	if e.tipo == "receita":
		var R0: Dictionary = D.receitas[e.k]
		var R: Dictionary = P.receita_na_raridade(e.k, rar)
		faz = {"k": str(R0.faz), "r": rar} if D.itens[str(R0.faz)].has("lugar") else {"k": str(R0.faz), "n": 1}
		custo = P.custo_vigor(str(R0.prof), float(R.vigor))
		nv_txt = "%s Nv %d" % [D.profissoes[str(R0.prof)].nome, int(R.nivel)]
	else:
		faz = {"k": ("obra_" + e.k) if D.get("construcoes", {}).has(e.k) else e.k, "n": 1}
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1), P.cor_item(faz).darkened(0.35) if equip else Color(0.3, 0.24, 0.16), 1, 8))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	cx.add_child(v)
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 12)
	v.add_child(l)
	var c := celula(faz, false, func(): pass, 52)
	c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(c)
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.add_theme_constant_override("separation", 2)
	var cab := HBoxContainer.new()
	cab.add_theme_constant_override("separation", 10)
	cab.add_child(rotulo(P.nome_item(faz) if equip else str(e.nome), 15, P.cor_item(faz) if equip else TEXTO))
	if nv_txt != "":
		cab.add_child(rotulo(nv_txt, 12, OURO_CLARO))
	txt.add_child(cab)
	var on := onde_rec(e)
	txt.add_child(linha_onde_rec("cs_" + str(on[0]) if str(on[0]) != "" else "topo_mochila", str(on[1])))
	l.add_child(txt)
	if equip:
		var rs := HBoxContainer.new()
		rs.add_theme_constant_override("separation", 4)
		for r in D.raridades.size():
			var br := botao(str(D.raridades[r].nome), func():
				if _arrastou:
					return
				rar_rec[e.k] = r
				preencher_recipedia(), 12, r == rar)
			br.custom_minimum_size = Vector2(0, 30)
			br.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			br.add_theme_color_override("font_color", Color(D.raridades[r].cor) if r != rar else Color(D.raridades[r].cor).lightened(0.35))
			rs.add_child(br)
		v.add_child(rs)
	var mats := HFlowContainer.new()
	mats.add_theme_constant_override("h_separation", 10)
	mats.add_theme_constant_override("v_separation", 4)
	if rar > 0: # evoluir: primeiro a peça da raridade de baixo
		var fk := str(D.receitas[e.k].faz)
		var qt := 0
		for ob in P.prog.mochila:
			if ob != null and str(ob.k) == fk and int(ob.get("r", 0)) == rar - 1 and not ob.has("n"):
				qt += 1
		mats.add_child(icone_material(fk, qt, 1, {"k": fk, "r": rar - 1}))
	for k in usa:
		mats.add_child(icone_material(str(k), P.contar(k), int(usa[k])))
	if custo > 0.0:
		var vg := rotulo("Vigor %s" % P.num(custo, 1), 12, COR_VIGOR)
		vg.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		mats.add_child(vg)
	v.add_child(mats)
	return cx

# um pack para consultar: o pack (na cor dele), o mercador que faz, o material e o vigor
func linha_pack_rec(k: String, merc: String) -> Control:
	var P = P_menu
	var D: Dictionary = P.dados
	var PKk: Dictionary = D.packs[k]
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1), Color(str(PKk.get("cor", "#8a6a3a"))).darkened(0.35), 1, 8))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	cx.add_child(v)
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 12)
	v.add_child(l)
	var q := PanelContainer.new()
	q.custom_minimum_size = Vector2(52, 52)
	q.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	q.add_theme_stylebox_override("panel", caixa(Color(0.045, 0.04, 0.036, 1), Color(str(PKk.get("cor", "#8a6a3a"))), 1, 8))
	var ic := TextureRect.new()
	ic.texture = icone_tex("it_pack")
	ic.custom_minimum_size = Vector2(44, 44)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.modulate = Color(str(PKk.get("cor", "#ffffff"))).lightened(0.25) if ic.texture != null and ic.texture.resource_path.ends_with(".svg") else Color.WHITE
	q.add_child(ic)
	l.add_child(q)
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.add_theme_constant_override("separation", 2)
	txt.add_child(rotulo(str(PKk.nome), 15, Color(str(PKk.get("cor", "#eeeeee"))).lightened(0.2)))
	txt.add_child(linha_onde_rec("it_pack", "Feito por %s · leve a outro mercador" % merc))
	l.add_child(txt)
	var mats := HFlowContainer.new()
	mats.add_theme_constant_override("h_separation", 10)
	mats.add_theme_constant_override("v_separation", 4)
	var usa := materiais_rec({"pack": k})
	for c in usa:
		mats.add_child(icone_material(str(c), P.contar(c), int(usa[c])))
	var vg_n := float(D.get("packRegras", {}).get("vigor", 0))
	if vg_n > 0.0:
		var vg := rotulo("Vigor %s" % P.num(vg_n, 1), 12, COR_VIGOR)
		vg.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		mats.add_child(vg)
	v.add_child(mats)
	return cx

func criar_item(e: Dictionary) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	if _arrastou:
		return
	if e.tipo == "receita":
		criar(e.k)
		return
	if not m.on():
		m.hud.aviso("Criar só funciona online (a peça fica na sua conta)")
		return
	if m.construcao: # janelinha de quantas + barrinha (André 2026-11-05)
		m.construcao.pedir_criar("obra", e.k)
		return
	rede("fabricar", {"k": e.k})

# ---------- mochila e loja ----------
func linha_ouro(tam := 16) -> Control:
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 6)
	var ic := TextureRect.new()
	ic.texture = icone_tex("it_ouro")
	ic.custom_minimum_size = Vector2(tam + 6, tam + 6)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(ic)
	l.add_child(rotulo("%d de ouro" % int(P_menu.prog.ouro), tam, Color("ffd36a")))
	return l

# quadradinho de item: moldura e ícone na cor da raridade, quantidade no canto
# barra de água do regador (André 2026-11-21): fina, na esquerda do quadrado; esvazia a cada rega (20 regas cheio)
static func barra_agua(b: Control, frac: float) -> void:
	frac = clampf(frac, 0.0, 1.0)
	var fundo := ColorRect.new()
	fundo.color = Color(0.02, 0.03, 0.05, 0.85)
	fundo.set_anchors_preset(Control.PRESET_LEFT_WIDE)
	fundo.offset_left = 4
	fundo.offset_right = 10
	fundo.offset_top = 8
	fundo.offset_bottom = -8
	fundo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(fundo)
	var agua := ColorRect.new()
	agua.color = Color("4fb4ff") if frac > 0.25 else Color("e0a040")
	agua.set_anchors_preset(Control.PRESET_BOTTOM_WIDE)
	agua.anchor_top = 1.0 - frac
	agua.anchor_bottom = 1.0
	agua.offset_left = 1
	agua.offset_right = -1
	agua.offset_top = 0
	agua.offset_bottom = -1
	agua.mouse_filter = Control.MOUSE_FILTER_IGNORE
	fundo.add_child(agua)

func celula(it, escolhido: bool, fn: Callable, tam := 56, marcado := false) -> Button:
	var P = P_menu
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(tam, tam)
	var cor: Color = P.cor_item(it) if it != null else BORDA
	var est := caixa(Color(0.045, 0.04, 0.036, 1), Color(0, 0, 0, 0), 0, 8)
	for e in ["normal", "hover", "pressed"]:
		b.add_theme_stylebox_override(e, est)
	if it != null:
		var ic := TextureRect.new()
		ic.texture = icone_tex(P.icone_item(it))
		ic.set_anchors_preset(Control.PRESET_FULL_RECT)
		ic.offset_left = tam * 0.08
		ic.offset_top = tam * 0.08
		ic.offset_right = -tam * 0.08
		ic.offset_bottom = -tam * 0.1
		ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
		if ic.texture and ic.texture.resource_path.ends_with(".svg"):
			ic.modulate = cor # desenho de linha (sem pintura ainda): toma a cor do item
		b.add_child(ic)
		if it.k == "tomo":
			var r := rotulo(P.dados.romano[int(it.nv)], 11, Color("fff6c8"))
			r.position = Vector2(4, 1)
			r.mouse_filter = Control.MOUSE_FILTER_IGNORE
			b.add_child(r)
		if it.k == "regador":
			barra_agua(b, P.agua_frac())
		if int(it.get("n", 1)) > 1:
			var n := rotulo(str(int(it.n)), 14 if tam >= 64 else 12, TEXTO)
			n.add_theme_constant_override("outline_size", 4)
			n.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
			n.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
			n.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
			n.offset_left = -30
			n.offset_top = -19
			n.offset_right = -4
			n.offset_bottom = -1
			n.mouse_filter = Control.MOUSE_FILTER_IGNORE
			b.add_child(n)
	if it != null and P.eh_equip(it) and P.durab(it) < int(P.morte_dados().durMax):
		_marca_durabilidade(b, it, tam)
	moldurar(b, PIOR if it != null and P.quebrado(it) else cor, escolhido, it != null) # quebrada: moldura vermelha (André 2026-11-17)
	if it != null and it.get("cad", false): # cadeado (André 2026-11-07): cadeadinho dourado no canto de baixo
		var cd := TextureRect.new()
		cd.texture = icone_tex("cadeado")
		cd.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		cd.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		cd.position = Vector2(3, tam - tam * 0.36 - 3)
		cd.size = Vector2(tam * 0.34, tam * 0.36)
		cd.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(cd)
	if it != null and P.eh_equip(it) and int(it.get("e", 0)) > 0: # reforço "+N" no canto de cima (André 2026-11-09)
		var rf := rotulo("+%d" % int(it.e), 14 if tam < 56 else 16 if tam < 70 else 19, OURO_CLARO) # maior (André 2026-11-17)
		rf.add_theme_constant_override("outline_size", 5)
		rf.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
		rf.position = Vector2(3, -2)
		rf.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(rf)
	if it != null and marcado:
		var vel := ColorRect.new() # escurece um pouco e põe o sinal dourado no canto
		vel.color = Color(0.95, 0.75, 0.3, 0.16)
		vel.set_anchors_preset(Control.PRESET_FULL_RECT)
		vel.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(vel)
		var ok := TextureRect.new()
		ok.texture = icone_tex("marcado")
		ok.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ok.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ok.position = Vector2(tam - tam * 0.42, 2)
		ok.size = Vector2(tam * 0.38, tam * 0.38)
		ok.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(ok)
	b.pressed.connect(func():
		if not _arrastou:
			fn.call())
	return b

# André 2026-11-12: "no celular o ideal era que ficasse tudo à vista". Organizar, Filtro e Vender vários subiram para
# a fileira das abas; as páginas viraram botões curtos e, no Vender vários, Selecionar tudo / Vender / Pronto ficam
# na mesma linha delas; o item escolhido abre no painel da esquerda (por cima do boneco). Nada saiu.
const CEL_MOCHILA := 58
# André 2026-11-12: a ficha por cima do boneco cobria o personagem; preferiu embaixo da grade (false). true = painel da esquerda
const PAINEL_AO_LADO := false
func montar_mochila() -> void:
	var P = P_menu
	var cheios: int = P.prog.mochila.filter(func(x): return x != null).size()
	# fileira das abas: Organizar, Filtro e (perto de quem compra) Vender vários
	# André 2026-11-07: botão Organizar (junta as pilhas e põe em ordem de tipo, raridade e nome; quem decide é o servidor)
	var org := botao("Organizar", func(): acao_item({"acao": "organizar"}), 15, true)
	org.custom_minimum_size = Vector2(104, 40)
	org.disabled = cheios == 0 or vendendo
	ferramentas_bolsa.add_child(org)
	# André 2026-11-07: filtro de coleta (fica dourado quando tem algo desmarcado)
	var f_atual := filtro_atual()
	var fil := botao("Voltar" if filtro_aberto else "Filtro", func():
		filtro_aberto = not filtro_aberto
		vendendo = false
		marcados = {}
		atualizar(), 15, filtro_aberto or f_atual.r.size() > 0 or f_atual.k.size() > 0)
	fil.custom_minimum_size = Vector2(84, 40)
	if not filtro_aberto and (f_atual.r.size() > 0 or f_atual.k.size() > 0):
		fil.add_theme_color_override("font_color", OURO_CLARO)
	ferramentas_bolsa.add_child(fil)
	var compra: bool = m.perto_de_quem_compra()
	if consertando and (not m.perto_de_quem_conserta() or filtro_aberto): # longe do Tomás o conserto desliga
		consertando = false
		marc_conserto = {}
	if not compra:
		vendendo = false
		marcados = {}
	elif not filtro_aberto and not consertando:
		# "Vender vários" saiu (André 2026-11-25, remoção aprovada). Vender agora tem só 2 jeitos ("só isso"): tocar no item
		# (pilha pergunta quantos e pode passar da pilha: vende as iguais) ou filtrar a bag e apertar "Vender tudo" (o que aparece)
		var vt := botao("Vender tudo", func(): perguntar_vender_tudo(), 15, filtrando())
		vt.custom_minimum_size = Vector2(124, 40)
		vt.disabled = ids_visiveis(P.prog.mochila).is_empty() or vendo_recruta()
		ferramentas_bolsa.add_child(vt)
	if filtro_aberto:
		montar_filtro()
		return
	# páginas: botões curtos 1 a 4; a que ainda não foi comprada mostra o preço e abre o cadeado
	var por_pag: int = int(P.dados.mochila)
	var total_pag: int = int(P.dados.get("mochilaPaginas", 1))
	var tem: int = int(P.prog.get("paginas", 1))
	pag_mochila = clampi(pag_mochila, 0, total_pag - 1)
	var linha := HBoxContainer.new()
	linha.add_theme_constant_override("separation", 6)
	if not vendendo and not consertando: # o que aparece (André 2026-11-25): os 2 botões na linha das páginas
		linha.add_child(botoes_ver(P.prog.mochila, atualizar, 90))
	if not vendendo and not consertando and not filtrando():
		var tp := rotulo("Página", 15, APAGADO)
		tp.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		linha.add_child(tp)
	for n in (0 if filtrando() else total_pag): # filtrando: tudo que aparece numa grade só, sem página
		var t := str(n + 1) if n < tem else "%d · %d" % [n + 1, int(P.dados.paginaPreco[n])]
		var b := botao(t, func(): trocar_pagina(n), 16, n == pag_mochila)
		b.set_meta("guia", "pag:%d" % n) # guia.gd: a peça pedida está noutra página
		b.custom_minimum_size = Vector2(48, 38)
		if n >= tem:
			b.add_theme_color_override("font_color", APAGADO)
			b.icon = icone_tex("it_ouro")
			b.expand_icon = false
			b.add_theme_constant_override("icon_max_width", 18)
		linha.add_child(b)
	if consertando:
		barra_conserto(linha)
	elif vendendo:
		barra_venda(linha)
	else:
		var esp_ := Control.new()
		esp_.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		linha.add_child(esp_)
		var cont := rotulo("%d / %d" % [cheios, P.prog.mochila.size()], 15, APAGADO)
		cont.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		linha.add_child(cont)
	conteudo.add_child(linha)
	if vendendo:
		conteudo.add_child(botoes_ver(P.prog.mochila, atualizar))
	if filtrando():
		var gf := GridContainer.new()
		gf.columns = 10
		gf.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		gf.add_theme_constant_override("h_separation", 6)
		gf.add_theme_constant_override("v_separation", 6)
		var vis: Array = ids_visiveis(P.prog.mochila, true)
		for i in vis:
			var cel := celula_mochila(i, compra)
			cel.set_meta("guia_i", i)
			gf.add_child(cel)
		if vis.is_empty():
			conteudo.add_child(rotulo("Nada aparecendo: toque nos botões de equipamento e recurso para escolher.", 14, APAGADO))
		else:
			conteudo.add_child(gf)
	elif pag_mochila >= tem:
		conteudo.add_child(pagina_trancada(pag_mochila, tem))
	else:
		var g := GridContainer.new()
		g.columns = 10
		g.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		g.add_theme_constant_override("h_separation", 6)
		g.add_theme_constant_override("v_separation", 6)
		for i in range(pag_mochila * por_pag, min(P.prog.mochila.size(), (pag_mochila + 1) * por_pag)):
			var cel := celula_mochila(i, compra)
			cel.set_meta("guia_i", i) # guia das missões (guia.gd): qual lugar da mochila é esta célula
			g.add_child(cel)
		conteudo.add_child(g)
		# lugar a mais (só se uma mochila antiga trouxe mais itens do que cabem): aparece no fim da última página
		if pag_mochila == tem - 1 and P.prog.mochila.size() > tem * por_pag:
			var g2 := GridContainer.new()
			g2.columns = 10
			g2.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
			for i in range(tem * por_pag, P.prog.mochila.size()):
				var cel := celula_mochila(i, compra)
				cel.set_meta("guia_i", i)
				g2.add_child(cel)
			conteudo.add_child(g2)
	var dica := ""
	if consertando:
		dica = "Toque nas peças gastas (no corpo ou na mochila) para marcar. Cada uma volta inteira."
	elif vendendo:
		dica = "Toque na peça para marcar. Toque na pilha para dizer quantos (pode passar da pilha)."
	elif sel_mochila >= 0 and P.prog.mochila[sel_mochila] != null:
		if PAINEL_AO_LADO:
			mostrar_painel(detalhe(P.prog.mochila[sel_mochila], sel_mochila, ""))
		else:
			conteudo.add_child(detalhe(P.prog.mochila[sel_mochila], sel_mochila, "", true))
			return # a ficha ocupa o lugar do Conjunto (volta ao fechar a ficha)
	elif sel_equip != "" and janela_lugar == "" and P.prog.equip.get(sel_equip) != null: # com a janela aberta, o cartão não repete o Tirar (direção de arte)
		if PAINEL_AO_LADO:
			mostrar_painel(detalhe(P.prog.equip[sel_equip], -1, sel_equip))
		else:
			conteudo.add_child(detalhe(P.prog.equip[sel_equip], -1, sel_equip, true))
			return
	elif janela_lugar == "":
		dica = ""
	if dica != "":
		var d := rotulo(dica, 14, APAGADO)
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		conteudo.add_child(d)
	# quadro "Conjunto" embaixo da mochila saiu (André 2026-11-17, remoção aprovada: "pode apagar esse conjunto lá
	# embaixo"); o bônus agora aparece no cartão de cada peça (lista_conjunto). montar_conjunto() fica para quem quiser voltar

# célula da mochila: tocar escolhe (ou marca, no Vender vários); segurar perto de quem compra liga o Vender vários
func celula_mochila(i: int, compra: bool) -> Button:
	var P = P_menu
	var marcada: bool = marcados.has(i) or marc_conserto.has("i:%d" % i)
	var b := celula(P.prog.mochila[i], i == sel_mochila or marcada, func():
		if Time.get_ticks_msec() - _segurou_ms < 600: # o soltar do segurar não desmarca
			return
		tocar_mochila(i), CEL_MOCHILA, marcada)
	if P.prog.mochila[i] != null and not marcada:
		seta_comparar(b, P.prog.mochila[i])
	if false and compra and not vendendo and P.prog.mochila[i] != null: # segurar = Vender vários saiu (André 2026-11-25, remoção aprovada)
		b.button_down.connect(func():
			await get_tree().create_timer(0.45).timeout
			if is_instance_valid(b) and b.button_pressed and not _arrastou and aberto() and not vendendo:
				segurar_item(i))
	return b

# André 2026-11-12: setinha no canto da peça da bag: verde ▲ = melhor que a vestida, vermelha ▼ = pior,
# amarela = melhor/pior só em parte, nada = igual. Lugar vazio no corpo conta como melhor.
func seta_comparar(b: Control, it) -> void:
	var P = P_menu
	if not P.eh_equip(it):
		return
	var atual = P.prog.equip.get(P.dados.itens[it.k].lugar)
	var cor := MELHOR
	var cima := true
	if atual != null:
		var df := diferenca(it, atual)
		if df.is_empty():
			return
		var ver: Array = veredito(df)
		cor = ver[1]
		cima = nota(df) >= 0
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.03, 0.025, 0.02, 0.85)
	sb.set_corner_radius_all(12)
	sb.set_content_margin_all(2)
	var pc := PanelContainer.new()
	pc.add_theme_stylebox_override("panel", sb)
	pc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var l := Control.new() # triângulo desenhado (o ▲ da fonte sai miúdo no celular)
	l.custom_minimum_size = Vector2(18, 18)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.draw.connect(func():
		var pts := PackedVector2Array([Vector2(9, 2), Vector2(17, 15), Vector2(1, 15)]) if cima else PackedVector2Array([Vector2(1, 3), Vector2(17, 3), Vector2(9, 16)])
		l.draw_colored_polygon(pts, cor))
	pc.add_child(l)
	pc.position = Vector2(CEL_MOCHILA - 26, 2)
	b.add_child(pc)

func segurar_item(i: int) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	var it = P_menu.prog.mochila[i]
	_segurou_ms = Time.get_ticks_msec()
	modo_vender(true)
	if it != null and it.get("cad", false):
		m.hud.aviso("Item com cadeado: não vende. Abra o cadeado para vender")
	elif it != null:
		marcados[i] = true
		atualizar()
	Input.vibrate_handheld(30)

# ---------- filtro de coleta (André 2026-11-07: "a bag enche muito rápido") ----------
# prog.filtro = { r: [raridades desmarcadas], k: [recursos desmarcados] }; sem o campo = pega tudo.
# Online quem decide é o servidor (filtrado() em shared/progresso.js): o desmarcado que cai do monstro fica no chão.
func filtro_atual() -> Dictionary:
	var f = P_menu.prog.get("filtro")
	var r: Array = []
	var k: Array = []
	if f is Dictionary:
		for v in f.get("r", []):
			r.append(int(v))
		for v in f.get("k", []):
			k.append(str(v))
	return {"r": r, "k": k}

func mandar_filtro(r: Array, k: Array) -> void:
	acao_item({"acao": "filtro", "r": r, "k": k})

func recursos_do_jogo() -> Array:
	var itens: Dictionary = P_menu.dados.itens
	var l: Array = itens.keys().filter(func(k): return itens[k].get("mat", false))
	l.sort_custom(func(a, b):
		var sa: bool = str(a).begins_with("semente_")
		var sb: bool = str(b).begins_with("semente_")
		if sa != sb:
			return sb # sementes no fim
		return str(itens[a].nome).naturalnocasecmp_to(str(itens[b].nome)) < 0)
	return l

# um quadradinho de marcar: toca em qualquer parte (é um botão: arrastar a lista não marca sem querer)
func marca_filtro(texto: String, cor: Color, marcado: bool, fn: Callable, icone := "", ao_nome := Callable()) -> Button:
	var b := Button.new()
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(0, 44)
	b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	estilo_botao(b, marcado)
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 8)
	l.set_anchors_preset(Control.PRESET_FULL_RECT)
	l.offset_left = 8
	l.offset_right = -6
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var q := Quadradinho.new()
	q.lado = 20
	q.marcado = marcado
	q.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(q)
	if icone != "":
		var ic := TextureRect.new()
		ic.texture = icone_tex(icone)
		ic.custom_minimum_size = Vector2(30, 30)
		ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
		if ic.texture and ic.texture.resource_path.ends_with(".svg"):
			ic.modulate = cor
		if not marcado:
			ic.modulate.a = 0.45
		l.add_child(ic)
	var t := rotulo(texto, 14, cor if marcado else APAGADO)
	t.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	t.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	t.clip_text = true
	t.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if ao_nome.is_valid():
		# André 2026-11-07: o quadradinho marca/desmarca tudo; tocar no nome abre a lista um por um
		var nb := Button.new()
		nb.flat = true
		nb.focus_mode = Control.FOCUS_NONE
		nb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		nb.mouse_filter = Control.MOUSE_FILTER_STOP
		nb.add_child(t)
		t.set_anchors_preset(Control.PRESET_FULL_RECT)
		nb.pressed.connect(func():
			if not _arrastou:
				ao_nome.call())
		l.add_child(nb)
	else:
		l.add_child(t)
	b.add_child(l)
	b.pressed.connect(func():
		if not _arrastou:
			fn.call())
	return b

func montar_filtro() -> void:
	var P = P_menu
	var f := filtro_atual()
	separador("Filtro de coleta")
	var d := rotulo("O que estiver desmarcado não entra na mochila: fica no chão. Ouro, poções e Tomos sempre entram, e o recurso do veio ou da árvore que você está coletando também.", 12, APAGADO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	conteudo.add_child(d)
	separador("Equipamentos por raridade")
	var g := GridContainer.new()
	g.columns = 5
	g.add_theme_constant_override("h_separation", 6)
	for r in P.dados.raridades.size():
		var marcado: bool = not f.r.has(r)
		g.add_child(marca_filtro(str(P.dados.raridades[r].nome), Color(P.dados.raridades[r].cor), marcado, func():
			var nr: Array = f.r.duplicate()
			if nr.has(r):
				nr.erase(r)
			else:
				nr.append(r)
			mandar_filtro(nr, f.k)))
	conteudo.add_child(g)
	separador("Recursos")
	var todos: Array = recursos_do_jogo()
	var fora: int = todos.filter(func(k): return f.k.has(k)).size()
	var linha := HBoxContainer.new()
	linha.add_theme_constant_override("separation", 8)
	var txt := "Todos os recursos" if fora == 0 else ("Nenhum recurso" if fora == todos.size() else "Recursos: %d de %d" % [todos.size() - fora, todos.size()])
	txt += "  ▴" if filtro_lista else "  ▾"
	# André 2026-11-07: sem botão "Escolher um por um": o quadradinho marca tudo, o nome abre a lista
	linha.add_child(marca_filtro(txt, TEXTO, fora < todos.size(), func():
		mandar_filtro(f.r, [] if fora > 0 else todos), P.icone_item({"k": "couro", "n": 1}) if P.dados.itens.has("couro") else "", func():
		filtro_lista = not filtro_lista
		atualizar()))
	conteudo.add_child(linha)
	if filtro_lista:
		var g2 := GridContainer.new()
		g2.columns = 3
		g2.add_theme_constant_override("h_separation", 6)
		g2.add_theme_constant_override("v_separation", 6)
		for k in todos:
			var it := {"k": k, "n": 1}
			g2.add_child(marca_filtro(str(P.dados.itens[k].nome), P.cor_item(it), not f.k.has(k), func():
				var nk: Array = f.k.duplicate()
				if nk.has(k):
					nk.erase(k)
				else:
					nk.append(k)
				mandar_filtro(f.r, nk), P.icone_item(it)))
		conteudo.add_child(g2)

# bônus de conjunto: peças da mesma raridade (ou melhor), como o Set de Bruxa do Quimera
func montar_conjunto() -> void:
	var P = P_menu
	separador("Conjunto")
	var n: Array = P.pecas_conjunto()
	var ativo: Dictionary = P.conjunto_ativo()
	var algum := false
	for t in ["2", "3", "6"]:
		var r: int = ativo[t]
		if r > 0:
			algum = true
			var l := HBoxContainer.new()
			l.add_theme_constant_override("separation", 8)
			l.add_child(rotulo("%s peças %s" % [t, PLURAL[r]], 15, Color(P.dados.raridades[r].cor)))
			l.add_child(rotulo(P.texto_bonus(r, t), 15, TEXTO))
			conteudo.add_child(l)
	var prox := ""
	for r in range(1, P.dados.raridades.size()):
		for t in ["2", "3", "6"]:
			if prox == "" and n[r] < int(t) and ativo[t] < r:
				prox = "Próximo: %s peças %s (tem %d): %s" % [t, PLURAL[r], n[r], P.texto_bonus(r, t)]
	if not algum:
		conteudo.add_child(rotulo("Use 2, 3 ou 6 peças Raras (ou melhores) para ganhar bônus.", 14, APAGADO))
	if prox != "":
		var d := rotulo(prox, 14, APAGADO)
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		conteudo.add_child(d)

# bônus de conjunto de uma raridade no cartão da peça: verde quando já tem as peças vestidas (dessa raridade ou
# melhor), cinza quando ainda falta. Os de vida/dano/área (2, 3, 6) e os de crítico (2, 4, 6)
func lista_conjunto(r: int, compacto := false) -> Control:
	var P = P_menu
	var n: int = P.pecas_conjunto()[r]
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 0)
	var tam := 13 if compacto else 14
	v.add_child(rotulo("Conjunto %s · %d vestidas" % [P.dados.raridades[r].nome, n], tam, Color(P.dados.raridades[r].cor)))
	var linhas := [] # só o conjunto de crítico (o antigo saiu, André 2026-11-17)
	var cc: Array = P.dados.get("conjuntoCritico", [])
	if r < cc.size() and cc[r] != null:
		for t in ["2", "4", "6"]:
			var p := []
			for c in cc[r][t]:
				p.append(P.texto_st(c, float(cc[r][t][c])))
			linhas.append([int(t), ", ".join(p)])
	# mesma quantidade numa linha só (André 2026-11-17: "2 peças" aparecia duas vezes)
	var junta := {}
	for l in linhas:
		junta[l[0]] = (junta[l[0]] + ", " + l[1]) if junta.has(l[0]) else l[1]
	linhas = []
	for t in junta:
		linhas.append([t, junta[t]])
	linhas.sort_custom(func(a, b): return a[0] < b[0])
	for l in linhas:
		var ok: bool = n >= int(l[0])
		var rt := rotulo("%d peças: %s" % [l[0], l[1]], tam, MELHOR if ok else CINZA_FALTA)
		rt.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		v.add_child(rt)
	return v

func trocar_pagina(n: int) -> void:
	pag_mochila = n
	sel_mochila = -1
	atualizar()

# página ainda não comprada: cadeado, preço e o botão de comprar (só a próxima da fila)
func pagina_trancada(n: int, tem: int) -> Control:
	var P = P_menu
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(Color(0.08, 0.07, 0.058, 1), Color(0.3, 0.25, 0.17), 1, 8))
	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 10)
	v.custom_minimum_size = Vector2(0, 4 * 60 + 3 * 5 - 18)
	cx.add_child(v)
	var preco: int = int(P.dados.paginaPreco[n])
	var t := rotulo("Página %d trancada" % (n + 1), 18, OURO_CLARO)
	t.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(t)
	var proxima: bool = n == tem
	var txt := "Mais %d lugares na mochila por %d de ouro." % [int(P.dados.mochila), preco] if proxima else "Compre a página %d primeiro (as páginas abrem uma de cada vez)." % (tem + 1)
	var d := rotulo(txt, 13, APAGADO)
	d.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(d)
	if proxima:
		var pode: bool = int(P.prog.ouro) >= preco
		var b := botao("Comprar · %d" % preco, func(): acao_item({"acao": "pagina"}), 15, pode)
		b.icon = icone_tex("it_ouro")
		b.add_theme_constant_override("icon_max_width", 20)
		b.custom_minimum_size = Vector2(200, 42)
		b.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
		b.disabled = not pode
		avisar_travado(b, func(): return "Faltam %d de ouro" % (preco - int(P.prog.ouro)))
		v.add_child(b)
		if not pode:
			var f := rotulo("Faltam %d de ouro" % (preco - int(P.prog.ouro)), 12, APAGADO)
			f.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
			v.add_child(f)
	return cx

func tocar_mochila(i: int) -> void:
	if consertando:
		marcar_conserto({"i": i})
		return
	if vendendo:
		if marcados.has(i):
			marcados.erase(i)
		elif P_menu.prog.mochila[i] != null and P_menu.prog.mochila[i].get("cad", false):
			m.hud.aviso("Item com cadeado: não vende. Abra o cadeado para vender")
		elif P_menu.prog.mochila[i] != null and total_igual(P_menu.prog.mochila, i) > 1:
			vender_qtd(i) # André 2026-11-25: pilha pergunta quantos (pode passar da pilha: vende das pilhas iguais)
			return
		elif P_menu.prog.mochila[i] != null:
			marcados[i] = true
		atualizar()
		return
	sel_equip = ""
	sel_mochila = -1 if sel_mochila == i or P_menu.prog.mochila[i] == null else i
	atualizar()

# cartão do item escolhido: nome na cor da raridade, o que faz, comparação com a peça do corpo e os botões
# peça gasta: filete de durabilidade no pé da célula (âmbar; vermelho quando está no fim). Quebrada: véu vermelho
func _marca_durabilidade(b: Control, it, tam: int) -> void:
	var P = P_menu
	var k: float = clamp(float(P.durab(it)) / float(P.morte_dados().durMax), 0.0, 1.0)
	if k <= 0.0:
		var veu := ColorRect.new()
		veu.color = Color(0.6, 0.05, 0.03, 0.45)
		veu.position = Vector2.ZERO
		veu.size = Vector2(tam, tam)
		veu.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(veu)
		var x := rotulo("QUEBRADA", 9 if tam < 70 else 12, Color("ffd2c8"))
		x.add_theme_constant_override("outline_size", 4)
		x.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
		x.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		x.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		x.position = Vector2(-4, tam * 0.5 - 8) # sem âncora no centro: a célula ainda não tem tamanho e o texto ia parar no canto
		x.size = Vector2(tam + 8, 16)
		x.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(x)
		return
	var fundo := ColorRect.new()
	fundo.color = Color(0, 0, 0, 0.7)
	fundo.position = Vector2(tam * 0.14, tam - 9)
	fundo.size = Vector2(tam * 0.72, 5)
	fundo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(fundo)
	var barra := ColorRect.new()
	barra.color = Color("ff6a50") if k <= 0.3 else Color("f0c060")
	barra.position = fundo.position + Vector2(1, 1)
	barra.size = Vector2((tam * 0.72 - 2) * k, 3)
	barra.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(barra)
	# número (André 2026-11-17: "pode ser número tipo 100/200 mas que fique mais visível"), em cima do filete
	var mx := int(P.morte_dados().durMax)
	var nu := rotulo("%d/%d" % [P.durab(it), mx], 10 if tam < 56 else 11 if tam < 70 else 13, barra.color)
	nu.add_theme_constant_override("outline_size", 4)
	nu.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	nu.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	nu.position = Vector2(0, tam - 9 - (14 if tam < 70 else 17))
	nu.size = Vector2(tam, 14 if tam < 70 else 17)
	nu.mouse_filter = Control.MOUSE_FILTER_IGNORE
	b.add_child(nu)

func detalhe(it, i: int, lugar: String, compacto := false) -> Control:
	var P = P_menu
	# compacto (André 2026-11-12, segunda versão): a ficha deitada embaixo da grade, sem cobrir o personagem:
	# ícone, textos no meio e os botões numa grade de 3 colunas à direita. Tudo igual, só arrumado para caber.
	var fonte := 14 if compacto else 16
	var alto := 34 if compacto else 42
	# André 2026-11-12: abre no painel da esquerda (por cima do boneco), em pé: ícone e nome em cima, texto maior,
	# botões que quebram linha sozinhos. Mesmo conteúdo e os mesmos botões de antes.
	var cx := PanelContainer.new()
	cx.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cx.add_theme_stylebox_override("panel", caixa(Color(0.1, 0.088, 0.072, 1), P.cor_item(it).darkened(0.3), 1, 8))
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.add_theme_constant_override("separation", 5)
	cx.add_child(txt)
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 10 if compacto else 12)
	txt.add_child(l)
	var c := celula(it, false, func(): pass, 56 if compacto else 76)
	c.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	l.add_child(c)
	var cab := VBoxContainer.new()
	cab.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	cab.add_theme_constant_override("separation", 2)
	l.add_child(cab)
	var fx := botao("✕", fechar_item, 16 if compacto else 20)
	fx.custom_minimum_size = Vector2(34, 34) if compacto else Vector2(44, 44)
	fx.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
	fx.add_to_group("guia_saida") # a trava do guia (guia.gd) sempre deixa o X passar
	var info: VBoxContainer = cab if compacto else txt # onde entram descrição, comparação e avisos
	var bs: Container
	if compacto:
		var gb := GridContainer.new()
		gb.columns = 3
		gb.add_theme_constant_override("h_separation", 6)
		gb.add_theme_constant_override("v_separation", 6)
		gb.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
		bs = gb
	else:
		var fl := HFlowContainer.new()
		fl.add_theme_constant_override("h_separation", 8)
		fl.add_theme_constant_override("v_separation", 8)
		bs = fl
	var nm := rotulo(P.nome_item(it), 19 if compacto else 22, P.cor_item(it))
	nm.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	cab.add_child(nm)
	var tipo := ""
	if P.eh_equip(it):
		var lg: String = P.dados.itens[it.k].lugar
		tipo = {"cabeca": "Capacete", "corpo": "Camisa", "pernas": "Calça", "capa": "Capa", "pes": "Botas", "acessorio": "Acessório", "espada": "Arma · espada", "cajado": "Arma · cajado"}[lg]
		tipo += " · No corpo" if lugar != "" else ""
	elif it.k == "tomo":
		tipo = "Tomo de %s" % P.habs[it.h].nome
	elif P.eh_mat(it):
		tipo = "Material · %d" % int(it.n)
	else:
		tipo = "Consumível · %d" % int(it.n)
	var lt := rotulo(tipo, 14 if compacto else 15, APAGADO)
	cab.add_child(lt)
	# atributos da peça um por linha (André 2026-11-17: "Def x / Vida x / Durabilidade x/x"), a durabilidade por último
	var d := rotulo(P.texto_item(it).replace(" · ", "\n") if P.eh_equip(it) else P.texto_item(it), 16 if compacto else 18, TEXTO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.add_child(d)
	if P.eh_equip(it): # durabilidade (André 2026-11-05): cada morte desgasta; quebrada não dá bônus até o Tomás consertar
		var dmax: int = int(P.morte_dados().durMax)
		var du: int = P.durab(it)
		if du <= 0:
			var q := rotulo("QUEBRADA · sem bônus até o Tomás consertar (%d ouro)" % P.custo_conserto(it), 16 if compacto else 18, PIOR)
			q.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			info.add_child(q)
		else:
			var tdu := "Durabilidade %d/%d" % [du, dmax] + (" · conserto %d ouro" % P.custo_conserto(it) if du < dmax else "")
			var q := rotulo(tdu, 16 if compacto else 18, PIOR if du <= dmax * 0.3 else TEXTO if du < dmax else APAGADO)
			q.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			info.add_child(q)
	if P.eh_equip(it) and int(it.r) >= 1: # bônus de conjunto da raridade (André 2026-11-17): verde = já vale, cinza = falta
		info.add_child(lista_conjunto(int(it.r), compacto))
	if P.eh_equip(it): # reforço (igual ao Quimera, André 2026-11-07): +N de +máx, próxima chance, custo e se falhar
		info.add_child(linha_reforco(it))
	if P.eh_equip(it) and lugar == "":
		var atual = P.prog.equip.get(P.dados.itens[it.k].lugar)
		# André 2026-11-12: na bag, dizer na hora se é melhor ou pior que a peça vestida (como na janela do medalhão)
		if atual != null:
			var df := diferenca(it, atual)
			var ver: Array = veredito(df)
			var lv := HBoxContainer.new()
			lv.add_theme_constant_override("separation", 8)
			var vr := rotulo(ver[0], 16 if compacto else 18, ver[1])
			vr.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			lv.add_child(vr)
			var td := texto_diferenca(df)
			td.add_theme_font_size_override("normal_font_size", 15)
			td.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			td.size_flags_vertical = Control.SIZE_SHRINK_CENTER
			lv.add_child(td)
			info.add_child(lv)
		var nc := rotulo(("Vestida: %s" % P.nome_item(atual)) if atual != null else "Lugar vazio no corpo", 13 if compacto else 15, APAGADO)
		nc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		info.add_child(nc)
	if lugar != "":
		bs.add_child(botao_acao("Tirar", {"acao": "tirar", "lugar": lugar}))
	elif P.eh_equip(it):
		bs.add_child(botao_acao("Equipar", {"acao": "equipar", "i": i}))
	elif P.dados.itens.has(it.k) and P.dados.itens[it.k].has("obra"):
		# peça de construção ou estação (André 2026-11-07): "Colocar" abre o modo construção já com ela escolhida
		var ob: String = str(P.dados.itens[it.k].obra)
		var por := func():
			fechar()
			m.construcao.abrir_com(ob)
		var bc := botao("Colocar", por, 16, true)
		bc.custom_minimum_size = Vector2(120, 42)
		bs.add_child(bc)
	elif P.dados.itens.has(it.k) and P.dados.itens[it.k].has("arvore") and lugar == "":
		# semente de árvore (André 2026-11-16): planta no quadrado livre mais perto, numa área de plantio ou no terreno
		var arv: String = str(P.dados.itens[it.k].arvore)
		var pl := func():
			fechar()
			m.plantio.plantar(arv)
		var bp := botao("Plantar", pl, 16, true)
		bp.custom_minimum_size = Vector2(120, 42)
		bs.add_child(bp)
	elif it.k == "carrinho" and lugar == "": # Quimera: coloca no chão; no mundo, o mesmo botão traz de volta de onde estiver
		bs.add_child(botao_acao("Guardar carrinho" if P.carrinho_no_mundo() else "Colocar no chão", {"acao": "usar", "i": i}))
	elif it.k == "navio" and lugar == "" and P.navio_no_mundo(): # André 2026-11-21: igual ao carrinho
		bs.add_child(botao_acao("Guardar navio", {"acao": "usar", "i": i}))
	elif not P.eh_mat(it) and (it.k == "tomo" or (P.dados.itens.has(it.k) and P.dados.itens[it.k].has("usar"))):
		bs.add_child(botao_acao("Usar", {"acao": "usar", "i": i}))
	if P.eh_equip(it) and int(it.get("e", 0)) < P.reforco_max(it):
		var onde := {"i": i} if lugar == "" else {"lugar": lugar}
		# André 2026-11-17: um botão só; ele abre a janela do reforço com "1 vez", "Até o máximo" e "Cancelar"
		var r1 := botao("Reforçar", func(): m.reforco.abrir(onde), 16, true)
		r1.custom_minimum_size = Vector2(140, 42)
		bs.add_child(r1)
	var trancado: bool = bool(it.get("cad", false))
	if P.veiculo_no_mundo(it):
		var nm2 := rotulo("No mundo: travado na mochila. Toque em Guardar pra ele voltar de qualquer distância.", 15, APAGADO)
		nm2.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		info.add_child(nm2)
	# cadeado (André 2026-11-07): trancado não vende (nem no Vender vários), não vai para o lixo nem para a troca
	var cad := botao("Destrancar" if trancado else "Trancar", func(): acao_item({"acao": "cadeado", "i": i} if lugar == "" else {"acao": "cadeado", "lugar": lugar}), 16, false)
	cad.icon = icone_tex("cadeado")
	cad.expand_icon = false
	cad.add_theme_constant_override("icon_max_width", 18)
	cad.custom_minimum_size = Vector2(130, 42)
	bs.add_child(cad)
	if P.veiculo_no_mundo(it):
		trancado = true # no mundo: não vende nem joga fora (o servidor também recusa)
	if i >= 0 and not trancado and m.perto_de_quem_compra():
		if total_igual(P.prog.mochila, i) > 1: # pilha: a janelinha da quantidade (André 2026-11-25)
			var bvq := botao("Vender · %d" % P.preco_venda(it), func(): vender_qtd(i), 14, false)
			bvq.custom_minimum_size = Vector2(120, 36)
			bs.add_child(bvq)
		else:
			bs.add_child(botao_acao("Vender · %d" % P.preco_venda(it), {"acao": "vender", "i": i}, false))
	if i >= 0 and not trancado: # André 2026-11-04: jogar fora (pergunta antes; não dá ouro)
		var ap := botao("Apagar", func(): perguntar_apagar(i), 16)
		ap.custom_minimum_size = Vector2(110, 42)
		ap.add_theme_color_override("font_color", PIOR)
		ap.add_theme_color_override("font_hover_color", PIOR)
		bs.add_child(ap)
	if compacto:
		l.add_child(bs)
	else:
		txt.add_child(bs)
	# catalisador (André 2026-11-07): Evoluir sobe a raridade com catalisador; Destruir dá catalisador (só da mochila)
	if i >= 0 and P.eh_equip(it) and P.dados.has("catalisador"):
		var bs2: Container = bs
		if not compacto:
			bs2 = HFlowContainer.new()
			bs2.add_theme_constant_override("h_separation", 8)
		if int(it.r) < P.dados.raridades.size() - 1:
			var be := botao("Evoluir", func(): perguntar_evoluir(i), 16, true)
			be.custom_minimum_size = Vector2(120, 42)
			bs2.add_child(be)
		if not trancado:
			var bd := botao("Destruir", func(): perguntar_destruir(i), 16)
			bd.custom_minimum_size = Vector2(120, 42)
			bd.add_theme_color_override("font_color", PIOR)
			bd.add_theme_color_override("font_hover_color", PIOR)
			bs2.add_child(bd)
		if bs2 != bs:
			txt.add_child(bs2)
	if trancado:
		var tc := rotulo("Com cadeado: não vende, não vai para o lixo nem para a troca", 13 if compacto else 15, OURO)
		tc.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		info.add_child(tc)
	for fila in ([bs] if compacto else [bs, txt.get_child(txt.get_child_count() - 1)]): # botões: letra e altura maiores (dedo no celular)
		for bt in fila.get_children():
			if bt is Button:
				bt.add_theme_font_size_override("font_size", fonte)
				bt.custom_minimum_size.y = alto
				if compacto:
					bt.custom_minimum_size.x = 118
	if compacto:
		_limpar_botoes(bs, l, trancado, it)
	l.add_child(fx)
	return cx

# André 2026-11-17 ("é muito botão numa janela só"): na ficha deitada ficam à vista só a ação principal e o Reforçar;
# Evoluir, Apagar e Destruir vão para o "Mais" e o cadeado vira um ícone ao lado do X. Nada some ("Até o máximo"
# ficou na janela do reforço, André 2026-11-17).
const BOTOES_NO_MAIS := ["Evoluir", "Apagar", "Destruir"]
func _limpar_botoes(bs: Container, l: HBoxContainer, trancado: bool, it) -> void:
	var gb := bs as GridContainer
	gb.columns = 2
	var guardados: Array = []
	for bt in bs.get_children():
		if not (bt is Button):
			continue
		var pt := str(bt.get_meta("pt", bt.text))
		if pt in ["Trancar", "Destrancar"]: # cadeado: ícone quadrado ao lado do X (dourado = trancado)
			bs.remove_child(bt)
			bt.text = ""
			bt.tooltip_text = Idioma.frase(pt)
			bt.custom_minimum_size = Vector2(34, 34)
			bt.size_flags_vertical = Control.SIZE_SHRINK_BEGIN
			bt.add_theme_constant_override("icon_max_width", 20)
			bt.modulate = Color(1.25, 1.05, 0.6) if trancado else Color(0.75, 0.72, 0.66)
			l.add_child(bt)
		elif pt in BOTOES_NO_MAIS:
			bs.remove_child(bt)
			guardados.append(bt)
	if guardados.is_empty():
		return
	guardados.sort_custom(func(a, b): return BOTOES_NO_MAIS.find(str(a.get_meta("pt", ""))) < BOTOES_NO_MAIS.find(str(b.get_meta("pt", ""))))
	var mais := botao("Mais ▾", func(): pass, 14)
	mais.custom_minimum_size = Vector2(118, 34)
	mais.pressed.connect(func():
		if not _arrastou:
			_abrir_mais(mais, guardados))
	mais.tree_exiting.connect(func():
		for b in guardados:
			if is_instance_valid(b) and b.get_parent() == null:
				b.queue_free())
	bs.add_child(mais)

var _mais_aberto: Control
func _abrir_mais(origem: Control, botoes: Array) -> void:
	if _mais_aberto and is_instance_valid(_mais_aberto):
		_mais_aberto.queue_free()
	var capa := Control.new()
	capa.set_anchors_preset(Control.PRESET_FULL_RECT)
	(self if is_inside_tree() else origem.get_tree().root).add_child(capa) # fora da árvore: só na foto (ferramentas)
	_mais_aberto = capa
	var fundo := ColorRect.new() # tocar fora fecha
	fundo.color = Color(0, 0, 0, 0.25)
	fundo.set_anchors_preset(Control.PRESET_FULL_RECT)
	fundo.gui_input.connect(func(ev):
		if toque(ev):
			_fechar_mais(botoes))
	capa.add_child(fundo)
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(FUNDO, OURO.darkened(0.15), 1, 8, 8))
	capa.add_child(cx)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	cx.add_child(v)
	for b in botoes:
		if b.get_parent():
			b.get_parent().remove_child(b)
		b.custom_minimum_size = Vector2(170, 40)
		if not b.has_meta("fecha_mais"):
			b.set_meta("fecha_mais", true)
			b.pressed.connect(func(): _fechar_mais.call_deferred(botoes))
		v.add_child(b)
	cx.reset_size()
	var r := origem.get_global_rect()
	var tam := cx.get_combined_minimum_size()
	cx.position = Vector2(clampf(r.position.x + r.size.x - tam.x, 8, origem.get_viewport_rect().size.x - tam.x - 8), maxf(8, r.position.y - tam.y - 6))

func _fechar_mais(botoes: Array) -> void:
	for b in botoes:
		if is_instance_valid(b) and b.get_parent():
			b.get_parent().remove_child(b)
	if _mais_aberto and is_instance_valid(_mais_aberto):
		_mais_aberto.queue_free()
	_mais_aberto = null

# ---------- vender vários (André 2026-11-04) ----------
# fora do modo: botão "Vender vários". No modo: Selecionar tudo / Desmarcar, Vender N · ouro e Pronto.
# O preço é o mesmo do Vender de um em um (cada pilha vende inteira); online o servidor confere tudo (vender_varios).
func preco_marcados() -> Array: # [itens, ouro, raros (Épico ou melhor)]
	var P = P_menu
	var n := 0
	var ouro := 0
	var raros := 0
	for i in marcados.keys():
		var it = P.prog.mochila[i] if i < P.prog.mochila.size() else null
		if it == null or it.get("cad", false) or not aparece(it): # escondido pelo filtro não vende (André 2026-11-25)
			marcados.erase(i)
			continue
		var q: int = 1 if P.eh_equip(it) else max(1, int(it.get("n", 1)))
		n += q
		ouro += P.preco_venda(it) * q
		if P.eh_equip(it) and int(it.r) >= 2:
			raros += 1
	return [n, ouro, raros]

# André 2026-11-12: os botões do modo ficam na linha das páginas (o "Vender vários" de entrar subiu para as abas)
func barra_venda(l: HBoxContainer) -> void:
	var P = P_menu
	var cheios: Array = []
	for i in P.prog.mochila.size():
		if aparece(P.prog.mochila[i]) and not P.prog.mochila[i].get("cad", false): # com cadeado fica de fora do Selecionar tudo; só o que aparece (André 2026-11-25)
			cheios.append(i)
	var todos: bool = cheios.size() > 0 and marcados.size() >= cheios.size()
	var sel := botao("Desmarcar tudo" if todos else "Selecionar tudo", func():
		marcados = {}
		if not todos:
			for i in cheios:
				marcados[i] = true
		atualizar(), 15)
	sel.custom_minimum_size = Vector2(150, 38)
	l.add_child(sel)
	var r: Array = preco_marcados()
	var vb := botao("Vender %d · %d de ouro" % [r[0], r[1]] if r[0] > 0 else "Marque os itens", func(): perguntar_vender_varios(), 15, r[0] > 0)
	vb.custom_minimum_size = Vector2(0, 38)
	vb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	vb.disabled = r[0] == 0
	avisar_travado(vb, func(): return "Marque primeiro os itens que quer vender")
	l.add_child(vb)
	var pr := botao("Pronto", func(): modo_vender(false), 15)
	pr.custom_minimum_size = Vector2(90, 38)
	l.add_child(pr)

# André 2026-11-24: marcar de uma vez no Vender vários. Chips só com ícone + quantidade: equipamento Comum / Raro / Épico (ou
# melhor) e Recurso. Toque marca tudo que combina (com cadeado e o que está vestido ficam de fora: vestido nem está na mochila);
# se tudo isso já estava marcado, desmarca. Marcar um por um continua valendo.
# ---------- o que aparece (André 2026-11-25: "deixava só 2 botões, um de arma e armadura e um de recurso"; depois:
# "lista por nome, raro azulzinho, comum cinzinha"; "o filtro dentro da minha bag mesmo, só aparece o que eu marquei";
# "se eu fechar a bag e abrir de novo, esse filtro não fica salvo"; "vender tudo só vende o que tá aparecendo") ----------
# Um filtro só, igual na mochila, na venda, no baú (os dois lados) e na troca. O botão abre a lista por nome ali mesmo
# (sem janela por cima): Equipamento = raridades (na cor) e tipos de peça; Recurso = cada item. Desmarcado some da grade.
# Fecha a mochila, o baú ou a troca: tudo volta a aparecer (limpar_ver). O "tudo" de cada tela só pega o que aparece.
var ver_fora := {"k": {}, "r": {}} # desmarcados: k = item, r = raridade da peça

func limpar_ver() -> void:
	ver_fora = {"k": {}, "r": {}}
	fechar_menu_ver()

func filtrando() -> bool:
	return not ver_fora.k.is_empty() or not ver_fora.r.is_empty()

func aparece(it) -> bool:
	if it == null:
		return false
	if ver_fora.k.has(str(it.k)):
		return false
	if P_menu.eh_equip(it) and ver_fora.r.has(int(it.get("r", 0))):
		return false
	return true

# lugares que aparecem (sem cadeado: o "tudo" nunca leva item trancado)
func ids_visiveis(lista: Array, com_cadeado := false) -> Array:
	var l: Array = []
	for i in lista.size():
		if aparece(lista[i]) and (com_cadeado or not lista[i].get("cad", false)):
			l.append(i)
	return l

# os 2 botões (peitoral = equipamento, couro = recurso), só o símbolo; borda dourada quando algo está escondido.
# Tocar abre um menuzinho de marcar (André 2026-11-25: "clicou no menu de armadura, eu escolho o que eu quero, só vai
# aparecer o que eu quero"; "retire esses balões"): equipamento = raridades, recurso = cada item com o símbolo.
# Cada toque marca/desmarca e a tela atrás já muda; toque fora fecha. ao_mudar remonta a tela.
var _menu_ver: CanvasLayer = null # menuzinho aberto (abrir_menu_ver)
func botoes_ver(lista: Array, ao_mudar: Callable, larg := 64, _lado := "") -> HBoxContainer:
	var P = P_menu
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 6)
	for eq in [true, false]:
		var fora: bool = eq and not ver_fora.r.is_empty()
		for it in lista:
			if it != null and P.eh_equip(it) == eq and not aparece(it):
				fora = true
		var b := Button.new()
		b.focus_mode = Control.FOCUS_NONE
		b.custom_minimum_size = Vector2(larg, 40)
		estilo_botao(b, fora)
		b.icon = icone_tex(P.icone_item({"k": "peitoral", "r": 1}) if eq else P.icone_item({"k": "couro", "n": 1}))
		b.expand_icon = true
		b.icon_alignment = HORIZONTAL_ALIGNMENT_CENTER
		b.add_theme_constant_override("icon_max_width", 30)
		b.pressed.connect(func(): abrir_menu_ver(b, lista, eq, ao_mudar))
		h.add_child(b)
	return h

# André 2026-11-25: "o botãozinho do lado direito para arrastar é bom para computador, para celular é horrível; quero
# igual Instagram, clica, joga para cima ou para baixo". O menuzinho não é mais PopupMenu (janela à parte, só rolava
# pela barra): é uma lista comum numa camada por cima de tudo, então rola arrastando o dedo e desliza (rolagem_toque.gd).
func menu_ver_aberto() -> bool:
	return _menu_ver != null and is_instance_valid(_menu_ver)

func fechar_menu_ver() -> void:
	if _menu_ver != null and is_instance_valid(_menu_ver):
		_menu_ver.queue_free()
	_menu_ver = null

# quadradinho de marcar grande e dourado (o do Godot é escuro e some no fundo do menu)
static var _caixinhas := {}
static func caixinha(marcada: bool) -> Texture2D:
	if _caixinhas.has(marcada):
		return _caixinhas[marcada]
	var t := 26
	var img := Image.create(t, t, false, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	for y in t:
		for x in t:
			var borda := x < 2 or y < 2 or x >= t - 2 or y >= t - 2
			if borda:
				img.set_pixel(x, y, OURO)
			elif marcada:
				img.set_pixel(x, y, OURO.darkened(0.15))
	if marcada: # o vezinho escuro
		for i in 6:
			for e in 3:
				img.set_pixel(6 + i, 12 + i + e - 1, FUNDO.lightened(0.02))
		for i in 11:
			for e in 3:
				img.set_pixel(11 + i, 17 - i + e - 1, FUNDO.lightened(0.02))
	_caixinhas[marcada] = ImageTexture.create_from_image(img)
	return _caixinhas[marcada]

func abrir_menu_ver(b: Control, lista: Array, eq: bool, ao_mudar: Callable) -> void:
	var P = P_menu
	fechar_menu_ver()
	# o que existe nesta lista (e o que está desmarcado, para dar para marcar de volta). Equipamento: Raridade e, embaixo,
	# Peça (André 2026-11-25: "além da raridade, a especificidade: só tops, só calças, só arma"). Recurso: cada item.
	var ks: Array = []
	for it in lista:
		if it != null and P.eh_equip(it) == eq and not ks.has(str(it.k)):
			ks.append(str(it.k))
	for k in ver_fora.k.keys():
		if not ks.has(k) and P.dados.itens.has(k) and P.eh_equip({"k": k, "r": 0}) == eq:
			ks.append(k)
	var camada := CanvasLayer.new()
	camada.layer = 60 # acima do menu (20), do baú e da troca
	_menu_ver = camada
	add_child(camada)
	var fundo := Control.new() # toque fora da lista fecha
	fundo.set_anchors_preset(Control.PRESET_FULL_RECT)
	fundo.mouse_filter = Control.MOUSE_FILTER_STOP
	fundo.gui_input.connect(func(ev):
		if ev is InputEventMouseButton and ev.pressed:
			fechar_menu_ver())
	camada.add_child(fundo)
	var painel := PanelContainer.new()
	painel.add_theme_stylebox_override("panel", caixa(FUNDO, OURO.darkened(0.25), 2, 8, 8))
	fundo.add_child(painel)
	var sc := ScrollContainer.new()
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	sc.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_SHOW_NEVER # sem barra: rola arrastando o dedo
	painel.add_child(sc)
	var col := VBoxContainer.new()
	col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	col.add_theme_constant_override("separation", 2)
	sc.add_child(col)
	var caixas: Array = [] # [CheckBox, "r" ou "k", raridade ou item]
	var linha := func(nome: String, tex: Texture2D, cor_icone: Color, ligado: bool, tipo: String, chave) -> void:
		var c := CheckBox.new()
		c.focus_mode = Control.FOCUS_NONE
		c.text = nome
		c.icon = tex
		c.button_pressed = ligado
		c.custom_minimum_size = Vector2(0, 50)
		c.add_theme_font_size_override("font_size", 20)
		c.add_theme_constant_override("icon_max_width", 28)
		c.add_theme_constant_override("h_separation", 10)
		c.add_theme_icon_override("checked", caixinha(true))
		c.add_theme_icon_override("unchecked", caixinha(false))
		for k in ["icon_normal_color", "icon_pressed_color", "icon_hover_color", "icon_hover_pressed_color", "icon_focus_color"]:
			c.add_theme_color_override(k, cor_icone)
		c.toggled.connect(func(on: bool):
			var d: Dictionary = ver_fora.r if tipo == "r" else ver_fora.k
			if on:
				d.erase(chave)
			else:
				d[chave] = true
			ao_mudar.call())
		col.add_child(c)
		caixas.append([c, tipo, chave])
	var titulo := func(t: String) -> void:
		var l := rotulo(tr(t), 15, APAGADO)
		l.custom_minimum_size = Vector2(0, 30)
		l.vertical_alignment = VERTICAL_ALIGNMENT_BOTTOM
		col.add_child(l)
	if eq:
		titulo.call("Raridade")
		for x in P.dados.raridades.size():
			linha.call(str(P.dados.raridades[x].nome), icone_tex("it_espada"), Color(P.dados.raridades[x].cor), not ver_fora.r.has(x), "r", x)
		if not ks.is_empty():
			titulo.call("Peça")
	for k in ks:
		var it := {"k": k, "r": 0} if eq else {"k": k, "n": 1}
		linha.call(str(P.dados.itens[k].nome) if eq else P.nome_item({"k": k, "n": 1}), icone_tex(P.icone_item(it)), Color.WHITE, not ver_fora.k.has(k), "k", k)
	if caixas.is_empty():
		col.add_child(rotulo(tr("Nada aqui"), 18, APAGADO))
	else:
		col.add_child(HSeparator.new())
		for liga in [true, false]:
			var t := Button.new()
			t.focus_mode = Control.FOCUS_NONE
			t.flat = true
			t.text = tr("Marcar todos") if liga else tr("Desmarcar todos")
			t.alignment = HORIZONTAL_ALIGNMENT_LEFT
			t.custom_minimum_size = Vector2(0, 50)
			t.add_theme_font_size_override("font_size", 20)
			t.pressed.connect(func():
				for e in caixas:
					(e[0] as CheckBox).set_pressed_no_signal(liga)
					var d: Dictionary = ver_fora.r if e[1] == "r" else ver_fora.k
					if liga:
						d.erase(e[2])
					else:
						d[e[2]] = true
				ao_mudar.call())
			col.add_child(t)
	# tamanho e lugar: embaixo do botão; se não couber, a lista fica do tamanho da tela e rola com o dedo
	var r := b.get_global_rect()
	var tela := b.get_viewport_rect().size if b.is_inside_tree() else Vector2(1280, 720)
	var ajustar := func():
		if not is_instance_valid(col):
			return
		var conteudo_min := col.get_combined_minimum_size()
		var larg := clampf(conteudo_min.x + 24, 260.0, tela.x - 16)
		var y := r.end.y + 4
		if tela.y - y < 240: # botão lá embaixo: abre do alto da tela
			y = 8.0
		sc.custom_minimum_size = Vector2(larg - 16, minf(conteudo_min.y, tela.y - y - 24))
		painel.position = Vector2(clampf(r.position.x, 8, tela.x - larg - 8), y)
		painel.reset_size()
	ajustar.call()
	ajustar.call_deferred() # de novo com as fontes já medidas

# André 2026-11-25: o mesmo item (mesmo k, lugar rápido, nível e cadeado) espalhado em várias pilhas. A janelinha da
# quantidade (pedir_qtd) aceita até a soma de todas: número maior que a pilha puxa das outras (o servidor faz igual).
func pilhas_iguais(lista: Array, i: int) -> Array:
	var o = lista[i] if i >= 0 and i < lista.size() else null
	if o == null:
		return []
	if not o.has("n") or P_menu.eh_equip(o):
		return [i]
	var r: Array = [i]
	for x in lista.size():
		var v = lista[x]
		if x != i and v != null and v.has("n") and str(v.get("k")) == str(o.k) and str(v.get("h", "")) == str(o.get("h", "")) \
				and str(v.get("nv", "")) == str(o.get("nv", "")) and bool(v.get("cad", false)) == bool(o.get("cad", false)):
			r.append(x)
	return r

func total_igual(lista: Array, i: int) -> int:
	var t := 0
	for x in pilhas_iguais(lista, i):
		t += maxi(1, int(lista[x].get("n", 1)))
	return t

# venda por quantidade (a mesma janelinha do baú e da troca): Vender N · ouro vende na hora
func vender_qtd(i: int) -> void:
	var P = P_menu
	var it = P.prog.mochila[i]
	if it == null:
		return
	pedir_qtd(it, total_igual(P.prog.mochila, i), "Vender", func(n: int): acao_item({"acao": "vender", "i": i, "n": n}), P.preco_venda(it))

func modo_vender(ligar: bool) -> void:
	if ligar and _so_olhando(): # menu do recruta (só olhando)
		return
	vendendo = ligar
	marcados = {}
	sel_mochila = -1
	sel_equip = ""
	if aba != "mochila":
		aba = "mochila"
	atualizar()

# Vender tudo: tudo que aparece na mochila agora (sem cadeado), com uma pergunta antes
func perguntar_vender_tudo() -> void:
	if _so_olhando():
		return
	var P = P_menu
	var lista: Array = ids_visiveis(P.prog.mochila)
	var n := 0
	var ouro := 0
	var raros := 0
	for i in lista:
		var it = P.prog.mochila[i]
		var q: int = 1 if P.eh_equip(it) else maxi(1, int(it.get("n", 1)))
		n += q
		ouro += P.preco_venda(it) * q
		if P.eh_equip(it) and int(it.r) >= 2:
			raros += 1
	if n == 0:
		return
	var txt := "Vender tudo que aparece: %d %s por %d de ouro?" % [n, "item" if n == 1 else "itens", ouro]
	if raros > 0:
		txt += "\nAtenção: %d %s Épica%s ou melhor." % [raros, "peça é" if raros == 1 else "peças são", "" if raros == 1 else "s"]
	confirmar("Vender tudo", txt, "Vender", func(): acao_item({"acao": "vender_varios", "lista": lista}))

func perguntar_vender_varios() -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	var r: Array = preco_marcados()
	if r[0] == 0:
		return
	var txt := "Vender %d %s por %d de ouro?" % [r[0], "item" if r[0] == 1 else "itens", r[1]]
	if r[2] > 0:
		txt += "\nAtenção: %d %s Épica%s ou melhor." % [r[2], "peça é" if r[2] == 1 else "peças são", "" if r[2] == 1 else "s"]
	var lista: Array = marcados.keys()
	lista.sort()
	confirmar("Vender de uma vez", txt, "Vender", func(): acao_item({"acao": "vender_varios", "lista": lista}))

# ---------- conserto do Tomás (André 2026-11-18: "menu visual, não lista: aparece igual à interface do meu equipamento
# vestido, aí posso selecionar manualmente as partes a serem reparadas ou clicar reparar tudo") ----------
# Como o Vender vários: o Consertar do Tomás abre a mochila com o boneco e liga este modo. Tocar num medalhão gasto (ou
# numa peça gasta da mochila) marca; embaixo ficam Consertar marcadas · ouro, Consertar tudo · ouro e Pronto. Cada peça
# volta inteira ou não é consertada (nunca pela metade). Online o servidor confere e cobra (shared/progresso.js).
func abrir_conserto() -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	modo_consertar(true)

func modo_consertar(ligar: bool) -> void:
	if ligar and _so_olhando(): # menu do recruta (só olhando)
		return
	consertando = ligar
	marc_conserto = {}
	vendendo = false
	marcados = {}
	sel_mochila = -1
	sel_equip = ""
	janela_lugar = ""
	if aba != "mochila":
		aba = "mochila"
	atualizar()

func _chave_conserto(onde: Dictionary) -> String:
	return ("l:%s" % onde.lugar) if onde.has("lugar") else ("i:%d" % int(onde.i))

func marcar_conserto(onde: Dictionary) -> void:
	var P = P_menu
	var k := _chave_conserto(onde)
	if marc_conserto.has(k):
		marc_conserto.erase(k)
	elif P.peca_em(onde) == null:
		pass
	elif P.custo_conserto(P.peca_em(onde)) <= 0:
		m.hud.aviso("Essa peça está inteira")
	else:
		marc_conserto[k] = onde
	atualizar()

func barra_conserto(l: HBoxContainer) -> void:
	var P = P_menu
	for k in marc_conserto.keys(): # consertou, vendeu ou mudou de lugar: sai da marcação
		if P.custo_conserto(P.peca_em(marc_conserto[k])) <= 0:
			marc_conserto.erase(k)
	var lista: Array = marc_conserto.values()
	var custo: int = P.custo_conserto_lista(lista)
	var ouro := int(P.prog.ouro)
	var mb := botao("Consertar %d · %d de ouro" % [lista.size(), custo] if lista.size() > 0 else "Marque as peças", func(): consertar_lista(lista), 15, lista.size() > 0)
	mb.custom_minimum_size = Vector2(0, 38)
	mb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	mb.disabled = lista.is_empty() or ouro < custo
	avisar_travado(mb, func(): return "Toque nas peças gastas para marcar" if lista.is_empty() else "Faltam %d de ouro" % (custo - ouro))
	l.add_child(mb)
	var total: int = P.custo_conserto_tudo()
	var tb := botao("Tudo · %d" % total, func(): consertar_lista([]), 15, total > 0)
	tb.custom_minimum_size = Vector2(120, 38)
	tb.disabled = total <= 0 or ouro < total
	avisar_travado(tb, func(): return "Está tudo inteiro" if total <= 0 else "Faltam %d de ouro para consertar tudo" % (total - ouro))
	l.add_child(tb)
	var pr := botao("Pronto", func(): modo_consertar(false), 15)
	pr.custom_minimum_size = Vector2(90, 38)
	l.add_child(pr)

# [] = Consertar tudo (corpo e mochila); senão só as marcadas
func consertar_lista(lista: Array) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	var msg := {"acao": "consertar"}
	if not lista.is_empty():
		msg["lista"] = lista.duplicate(true)
	marc_conserto = {}
	acao_item(msg)
	m.sons.tocar("forja", -4.0)
	if m.on(): # o progresso novo chega um instante depois: a barra mostra o preço que sobrou
		await get_tree().create_timer(0.6).timeout
	if consertando and aberto():
		if P_menu.pecas_gastas().is_empty():
			modo_consertar(false)
		else:
			atualizar()

# ---------- catalisador (André 2026-11-07, como no Quimera; números em CATALISADOR, shared/dados.js) ----------
# Runa = catalisador de arma (espada, cajado); Selo = de armadura (o resto). O servidor sorteia e confere tudo.
const RAR_F := ["Comum", "Rara", "Épica", "Lendária", "Mítica"] # "peça Rara"
const RAR_FP := ["Comuns", "Raras", "Épicas", "Lendárias", "Míticas"]
func tipo_catalisador(k: String) -> String:
	return "arma" if str(P_menu.dados.itens[k].lugar) in ["espada", "cajado"] else "armadura"

# o que destruir a peça pode dar, em texto ("1 Selo Raro (às vezes 0, 2 ou 3) · 25% de 1 Selo Épico")
func texto_destruir(it) -> String:
	var C: Dictionary = P_menu.dados.catalisador
	var r := int(it.r)
	if r < 1:
		return "1 %s (às vezes nada, 2 ou 3)" % P_menu.dados.itens[C.comum].nome
	var lista: Array = C[tipo_catalisador(it.k)]
	var t := "1 %s (às vezes nada, 2 ou 3)" % P_menu.dados.itens[lista[maxi(1, r - 1) - 1]].nome
	if r > 1 and float(C.extra[r]) > 0:
		t += "\n%d%% de chance de mais 1 %s" % [roundi(float(C.extra[r]) * 100), P_menu.dados.itens[lista[r - 1]].nome]
	return t

func perguntar_destruir(i: int) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	var P = P_menu
	var it = P.prog.mochila[i]
	if it == null or not P.eh_equip(it):
		return
	var txt := "Destruir %s?\nA peça some e vira catalisador:\n%s" % [P.nome_item(it), texto_destruir(it)]
	if int(it.get("e", 0)) > 0:
		txt += "\nAtenção: perde o reforço +%d." % int(it.e)
	# André 2026-11-07: sem linha "Destruir todas" na mochila; a escolha aparece aqui (só esta ou todas da raridade)
	var r := int(it.r)
	var n := 0
	if not it.get("cad", false):
		for o in P.prog.mochila:
			if o != null and P.eh_equip(o) and int(o.r) == r and not o.get("cad", false):
				n += 1
	var todas := Callable()
	var todas_txt := ""
	if n > 1:
		todas_txt = "Todas %s · %d" % [RAR_FP[r].to_lower(), n]
		todas = func(): perguntar_destruir_todas(r)
		txt += "\nOu destrua de uma vez todas as %d %s da mochila (sem cadeado)." % [n, RAR_FP[r].to_lower()]
	confirmar("Destruir peça", txt, "Só esta", func(): acao_item({"acao": "destruir", "i": i}), true, todas_txt, todas)

func perguntar_destruir_todas(r: int) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	var P = P_menu
	var n := 0
	var reforcadas := 0
	for o in P.prog.mochila:
		if o != null and P.eh_equip(o) and int(o.r) == r and not o.get("cad", false):
			n += 1
			if int(o.get("e", 0)) > 0:
				reforcadas += 1
	if n == 0:
		return
	var seg: float = float(P.dados.catalisador.tempoDestruir) * n
	var da: String = texto_destruir({"k": "peitoral", "r": r})
	if r >= 1:
		var C: Dictionary = P.dados.catalisador
		da = "1 catalisador %s (às vezes nada, 2 ou 3): Runa nas armas, Selo nas armaduras" % P.dados.raridades[maxi(1, r - 1)].nome
		if r > 1 and float(C.extra[r]) > 0:
			da += "\n%d%% de chance de mais 1 catalisador %s" % [roundi(float(C.extra[r]) * 100), P.dados.raridades[r].nome]
	var txt := "Destruir %d %s %s da mochila?\nCada uma faz a própria barrinha, uma depois da outra (uns %d s no total).\nCada peça dá: %s\nPeças com cadeado e as do corpo ficam." % [n, "peça" if n == 1 else "peças", RAR_F[r] if n == 1 else RAR_FP[r], ceili(seg), da]
	if reforcadas > 0:
		txt += "\nAtenção: %d %s reforço e %s." % [reforcadas, "tem" if reforcadas == 1 else "têm", "perde" if reforcadas == 1 else "perdem"]
	confirmar("Destruir todas", txt, "Destruir %d" % n, func(): acao_item({"acao": "destruir", "raridade": r}), true)

func perguntar_evoluir(i: int) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	var P = P_menu
	var it = P.prog.mochila[i]
	if it == null or not P.eh_equip(it):
		return
	var C: Dictionary = P.dados.catalisador
	var r := int(it.r) + 1
	if r >= P.dados.raridades.size():
		return
	var tipo := tipo_catalisador(it.k)
	var usa := {C[tipo][r - 1]: 1}
	usa.merge(C.usa[tipo][r - 1])
	var falta := false
	var linhas: Array = []
	for k in usa:
		var tem: int = P.contar(k)
		falta = falta or tem < int(usa[k])
		linhas.append("%d %s (tem %d)" % [int(usa[k]), P.dados.itens[k].nome, tem])
	var prof: String = str(P.dados.receitas[it.k].prof) if P.dados.receitas.has(it.k) else ("fer" if tipo == "arma" else "alf")
	var t: float = float(P.prof_nivel(prof) - 1) / float(int(P.dados.profMax) - 1)
	var falha: float = float(C.falha[r]) * (1.0 - 0.5 * t)
	var sorte: float = (float(C.sorte[0]) + (float(C.sorte[1]) - float(C.sorte[0])) * t) if r < P.dados.raridades.size() - 1 else 0.0
	var onde: String = "%s ou perto de uma %s" % [P.dados.oficina[prof].onde, "bigorna" if prof == "fer" else "bancada de trabalho"]
	var txt := "Evoluir %s para %s?\nUsa: %s.\nFalha %s%% (perde o catalisador e o material, a peça fica)%s.\nA peça nova sai +0. Faça %s." % [P.nome_item(it), P.dados.raridades[r].nome, ", ".join(linhas), P.num(falha * 100, 1), (" · sorte %s%% (pula uma raridade)" % P.num(sorte * 100, 1)) if sorte > 0 else "", onde]
	if int(it.get("e", 0)) > 0:
		txt += "\nAtenção: perde o reforço +%d." % int(it.e)
	if falta:
		txt += "\nFalta material: destrua peças para juntar catalisador."
	# André 2026-11-10: "tá uma lista de obrigações", quer entender de relance. Mesma informação em desenho: peça de
	# agora -> peça nova, materiais em ícone com tem/precisa, chances numa barra colorida e avisos em faixinha.
	# O texto acima fica guardado como dica (tooltip) da janela, nada some.
	var corpo := corpo_evoluir(it, r, usa, falha, sorte, onde)
	corpo.tooltip_text = txt
	# André 2026-11-21: longe da bigorna/bancada avisa na hora para ir até uma (faixa vermelha no topo da janelinha e
	# aviso no meio da tela). A janela abre igual para ver o que precisa; o servidor confere de novo.
	var longe := aviso_evoluir_longe(prof)
	if longe != "":
		var fx := faixa_aviso("✖ " + longe, PIOR)
		corpo.add_child(fx)
		corpo.move_child(fx, 0)
		_avisar_motivo(longe)
	var mandar := func():
		var ainda: String = aviso_evoluir_longe(prof)
		if ainda != "": # continua longe: não manda, só repete o aviso
			_avisar_motivo(ainda)
			return
		acao_item({"acao": "evoluir", "i": i})
	confirmar("Evoluir peça", "", "Evoluir", mandar, false, "", Callable(), corpo)

# "" = está perto da estação que evolui a peça (Ferreiro: bigorna; Alfaiate: bancada), a pública da vila ou uma de terreno.
# Mesma conta do servidor (estacaoPerto) e mesmo texto (AVISO_EVOLUIR em shared/dados.js).
func aviso_evoluir_longe(prof: String) -> String:
	var cons = m.construcao
	if cons == null or m.heroi == null: # sem como medir: o servidor decide
		return ""
	if prof == "fer":
		return "" if cons.estacao_perto(["bigorna"]) else "Vá até uma bigorna para evoluir: a da ferraria da vila ou uma construída num terreno"
	return "" if cons.estacao_perto(["bancada"]) else "Vá até uma bancada para evoluir: a da vila, ao lado da banca, ou uma construída num terreno"

# conteúdo desenhado da janelinha de evoluir
func corpo_evoluir(it, r: int, usa: Dictionary, falha: float, sorte: float, onde: String) -> Control:
	var P = P_menu
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 10)
	# 1) peça de agora -> peça nova
	var topo := HBoxContainer.new()
	topo.alignment = BoxContainer.ALIGNMENT_CENTER
	topo.add_theme_constant_override("separation", 14)
	col.add_child(topo)
	var novo := {"k": it.k, "r": r}
	topo.add_child(peca_com_nome(it))
	var seta := VBoxContainer.new()
	seta.alignment = BoxContainer.ALIGNMENT_CENTER
	var st := rotulo("➜", 34, Color(P.dados.raridades[r].cor))
	st.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	seta.add_child(st)
	var sub := rotulo("evoluir", 12, APAGADO)
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	seta.add_child(sub)
	topo.add_child(seta)
	topo.add_child(peca_com_nome(novo))
	# 2) materiais (ícones com tem/precisa; tocar diz o nome)
	var mats := HBoxContainer.new()
	mats.alignment = BoxContainer.ALIGNMENT_CENTER
	mats.add_theme_constant_override("separation", 10)
	for k in usa:
		mats.add_child(icone_material(k, P.contar(k), int(usa[k])))
	col.add_child(faixa_titulo("Usa", mats))
	# 3) chances numa barra só: verde = evolui, dourado = sorte (pula uma raridade), vermelho = falha
	var ok: float = maxf(0.0, 1.0 - falha - sorte)
	var bar := HBoxContainer.new()
	bar.add_theme_constant_override("separation", 0)
	bar.custom_minimum_size = Vector2(0, 14)
	for par in [[ok, VERDE], [sorte, OURO_CLARO], [falha, PIOR]]:
		if float(par[0]) <= 0.0:
			continue
		var pd := Panel.new()
		pd.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		pd.size_flags_stretch_ratio = maxf(float(par[0]), 0.02)
		pd.add_theme_stylebox_override("panel", caixa(Color(par[1]).darkened(0.15), Color(par[1]).lightened(0.15), 0, 3))
		bar.add_child(pd)
	var chances := VBoxContainer.new()
	chances.add_theme_constant_override("separation", 6)
	chances.add_child(bar)
	var leg := HBoxContainer.new()
	leg.alignment = BoxContainer.ALIGNMENT_CENTER
	leg.add_theme_constant_override("separation", 8)
	leg.add_child(selo_chance("Evolui", ok, VERDE, ""))
	if sorte > 0:
		leg.add_child(selo_chance("Sorte", sorte, OURO_CLARO, "pula 1 raridade"))
	leg.add_child(selo_chance("Falha", falha, PIOR, "perde catalisador e material, a peça fica"))
	chances.add_child(leg)
	col.add_child(faixa_titulo("Chance", chances))
	# 4) onde fazer e +0, linha pequena
	var info := rotulo("A peça nova sai +0 · Faça %s" % onde, 12, APAGADO)
	info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	col.add_child(info)
	# 5) avisos em faixinha colorida
	if int(it.get("e", 0)) > 0:
		col.add_child(faixa_aviso("⚠ Perde o reforço +%d" % int(it.e), Color("e8a24a")))
	for k in usa:
		if P.contar(k) < int(usa[k]):
			col.add_child(faixa_aviso("✖ Falta material: destrua peças para juntar catalisador", PIOR))
			break
	return col

# quadrado do item (moldura da raridade, +N no canto) com o nome embaixo na cor da raridade
func peca_com_nome(it) -> Control:
	var P = P_menu
	var bx := VBoxContainer.new()
	bx.add_theme_constant_override("separation", 4)
	bx.custom_minimum_size = Vector2(120, 0)
	var c := celula(it, false, func(): balao_nome(bx, P.nome_item(it), P.cor_item(it)), 76)
	c.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	bx.add_child(c)
	var n := rotulo(P.nome_item(it), 14, P.cor_item(it))
	n.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bx.add_child(n)
	return bx

# bloquinho com título pequeno à esquerda ("Usa", "Chance") e o conteúdo ao lado
func faixa_titulo(t: String, conteudo: Control) -> Control:
	var pc := PanelContainer.new()
	pc.add_theme_stylebox_override("panel", caixa(Color(0.11, 0.095, 0.08, 1), Color(0.3, 0.24, 0.16), 1, 8))
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 12)
	pc.add_child(h)
	var l := rotulo(t, 13, OURO)
	l.custom_minimum_size = Vector2(56, 0)
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	h.add_child(l)
	conteudo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(conteudo)
	return pc

# "● Falha 14,6%" com a explicação curtinha embaixo
func selo_chance(nome: String, v: float, cor: Color, explica: String) -> Control:
	var P = P_menu
	var bx := VBoxContainer.new()
	bx.add_theme_constant_override("separation", 0)
	bx.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var l := rotulo("● %s %s%%" % [nome, P.num(v * 100, 1)], 14, cor)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	bx.add_child(l)
	if explica != "":
		var e := rotulo(explica, 12, APAGADO)
		e.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		e.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		e.custom_minimum_size = Vector2(110, 0)
		bx.add_child(e)
	return bx

# aviso curto em faixa colorida (perde reforço, falta material)
func faixa_aviso(t: String, cor: Color) -> Control:
	var pc := PanelContainer.new()
	pc.add_theme_stylebox_override("panel", caixa(Color(cor, 0.14), Color(cor, 0.6), 1, 6))
	var l := rotulo(t, 13, cor)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	pc.add_child(l)
	return pc

func perguntar_apagar(i: int) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	var P = P_menu
	var it = P.prog.mochila[i]
	if it == null:
		return
	var nome: String = P.nome_item(it)
	if not P.eh_equip(it) and int(it.get("n", 1)) > 1:
		nome += " (%d)" % int(it.n)
	confirmar("Apagar item", "Jogar fora %s?\nO item some para sempre e não dá ouro." % nome, "Apagar", func(): acao_item({"acao": "apagar", "i": i}), true)

# janelinha de confirmação no meio da tela (como a do Mestre Ivo)
func fechar_confirma() -> void:
	if _confirma:
		_confirma.queue_free()
		_confirma = null

func confirmar(titulo: String, texto: String, sim: String, fn: Callable, perigo := false, extra := "", fn_extra := Callable(), conteudo: Control = null) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	fechar_confirma()
	_confirma = Control.new()
	_confirma.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_confirma)
	var escuro := ColorRect.new()
	escuro.color = Color(0, 0, 0, 0.5)
	escuro.set_anchors_preset(Control.PRESET_FULL_RECT)
	_confirma.add_child(escuro)
	# André 2026-11-10: a de Destruir (com 2 botões) abria cortada no canto esquerdo: o position.x = -280 era aplicado
	# já dentro da árvore, onde vira posição absoluta. Agora um CenterContainer centraliza qualquer tamanho.
	var meio := CenterContainer.new()
	meio.set_anchors_preset(Control.PRESET_FULL_RECT)
	_confirma.add_child(meio)
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(FUNDO, (PIOR if perigo else OURO).darkened(0.25), 2, 10, 14))
	cx.custom_minimum_size = Vector2(430 if conteudo == null else 520, 0)
	meio.add_child(cx)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	cx.add_child(col)
	col.add_child(rotulo(titulo, 20, OURO_CLARO))
	if texto != "":
		var d := rotulo(texto, 15, TEXTO)
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		col.add_child(d)
	if conteudo != null:
		col.add_child(conteudo)
	var linha := HBoxContainer.new()
	linha.alignment = BoxContainer.ALIGNMENT_END
	linha.add_theme_constant_override("separation", 10)
	col.add_child(linha)
	var nao := botao("Cancelar", fechar_confirma, 15)
	nao.custom_minimum_size = Vector2(120, 44)
	linha.add_child(nao)
	var ok := botao(sim, func():
		fechar_confirma()
		fn.call(), 15, true)
	ok.custom_minimum_size = Vector2(140, 44)
	if perigo:
		ok.add_theme_color_override("font_color", PIOR)
		ok.add_theme_color_override("font_hover_color", PIOR)
	linha.add_child(ok)
	if extra != "" and fn_extra.is_valid(): # segunda escolha (ex.: destruir todas da raridade)
		cx.custom_minimum_size.x = maxf(cx.custom_minimum_size.x, 560)
		var b2 := botao(extra, func():
			fechar_confirma()
			fn_extra.call(), 15, true)
		b2.custom_minimum_size = Vector2(170, 44)
		if perigo:
			b2.add_theme_color_override("font_color", PIOR)
			b2.add_theme_color_override("font_hover_color", PIOR)
		linha.add_child(b2)

# André 2026-11-07: no card da peça só os números (o +N já vem no nome). Chance, custo e falta de atributo aparecem
# na janelinha de reforçar e nos avisos. Aqui só um aviso curto quando a peça reforçada não pode ser usada (Quimera).
# explica o botão "Até o máximo" (antes "Até cancelar"): tenta de novo sozinho, cada tentativa cobra o ouro
func texto_ate_maximo(it) -> String:
	return Idioma.t("Tenta de novo sozinho até +%d, até o ouro acabar ou até você tocar em Cancelar") % int(P_menu.reforco_max(it))

func dica_ate_maximo(it) -> Control:
	var d := rotulo(texto_ate_maximo(it), 11, APAGADO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	d.custom_minimum_size = Vector2(140, 0)
	return d

func linha_reforco(it) -> Control:
	var P = P_menu
	var l := rotulo("", 12, PIOR)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.visible = false
	if not P.reforco_ok(it):
		l.text = "⛔ " + tr("Sem bônus: falta atributo" if it in P.prog.equip.values() else "Falta atributo para usar")
		l.visible = true
	return l

func botao_acao(t: String, msg: Dictionary, ativo := true) -> Button:
	var b := botao(t, func(): acao_item(msg), 14, ativo)
	b.custom_minimum_size = Vector2(120, 36)
	if vendo_recruta(): # menu do recruta: aparece, mas travado (só olhando)
		b.disabled = true
		ao_tocar_travado(b, func(): _so_olhando())
	return b

# ---------- janela da peça do corpo (André 2026-11-03) ----------
# Tirar manda a peça para a mochila (qualquer lugar pode ficar vazio: sem nada, aparece a roupa de baixo: biquíni ou samba-canção).
# Embaixo, as peças da mochila que servem nesse lugar, com o que cada uma ganha ou perde em relação à vestida
# (verde = melhor, vermelho = pior), as melhores primeiro; Trocar veste e a vestida vai para o lugar dela na mochila
# (por isso trocar funciona mesmo com a mochila cheia). Online quem decide é o servidor (mensagem "item").
const MELHOR := Color(0.5, 0.86, 0.45)
const CINZA_FALTA := Color(0.46, 0.44, 0.41) # bônus de conjunto que ainda falta (André 2026-11-17)
const PIOR := Color(0.92, 0.42, 0.36)
# peso de cada número só para pôr a lista em ordem (melhor primeiro); o que aparece na tela são os números de verdade
const PESO_ST := {"vida": 1.0 / 20.0, "mana": 1.0 / 20.0, "defesa": 1.0 / 5.0, "danoFisico": 1.0 / 5.0, "danoMagico": 1.0 / 5.0,
	"critico": 1.0 / 0.01, "danoCritico": 1.0 / 5.0, "danoK": 1.0 / 0.05, "areaK": 1.0 / 0.05, "regenManaK": 1.0 / 0.05}

# quadradinho "Mostrar capacete": toca em qualquer parte da linha para marcar ou desmarcar (o bônus da peça continua)
func linha_mostrar_capacete(tam := 13) -> Control:
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 6)
	l.mouse_filter = Control.MOUSE_FILTER_STOP
	var q := Quadradinho.new()
	q.lado = tam + 6
	q.marcado = not P_menu.prog.get("semCapacete", false)
	q.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(q)
	quadradinhos.append(q)
	var t := rotulo("Mostrar capacete", tam, TEXTO)
	t.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.add_child(t)
	l.gui_input.connect(func(ev):
		if toque(ev):
			acao_item({"acao": "capacete", "mostrar": P_menu.prog.get("semCapacete", false)}))
	return l

func janela_aberta() -> bool:
	return janela_lugar != "" and janela != null and is_instance_valid(janela) and janela.visible

func fechar_janela(refazer := true) -> void:
	janela_lugar = ""
	sel_equip = ""
	if janela and is_instance_valid(janela):
		janela.queue_free()
	janela = null
	janela_rolagem = null
	if refazer:
		atualizar()

# números da peça: {"defesa": 4.0, ...}; null = nada
func st_item(it) -> Dictionary:
	var r := {}
	if P_menu.eh_equip(it):
		var st: Dictionary = P_menu.dados.itens[it.k].st
		for c in st:
			r[c] = float(st[c][int(it.r)]) * P_menu.reforco_k(it, c) # com o reforço (+N)
	return r

# diferença da peça nova para a vestida: {"defesa": +2, "mana": -3}
func diferenca(novo, atual) -> Dictionary:
	var a := st_item(atual)
	var n := st_item(novo)
	var d := {}
	for c in n.keys() + a.keys():
		var v: float = n.get(c, 0.0) - a.get(c, 0.0)
		if abs(v) > 0.00001:
			d[c] = v
	return d

func nota(d: Dictionary) -> float:
	var s := 0.0
	for c in d:
		s += d[c] * PESO_ST.get(c, 1.0)
	return s

# "Melhor", "Pior" ou "Melhor em parte"; e a cor
func veredito(d: Dictionary) -> Array:
	var ganha := d.values().any(func(v): return v > 0)
	var perde := d.values().any(func(v): return v < 0)
	if ganha and not perde:
		return ["Melhor", MELHOR]
	if perde and not ganha:
		return ["Pior", PIOR]
	if ganha and perde:
		return ["Melhor em parte" if nota(d) >= 0 else "Pior em parte", OURO_CLARO]
	return ["Igual", APAGADO]

# "▲ +2 Defesa   ▼ -3 Mana" com as cores
func texto_diferenca(d: Dictionary) -> RichTextLabel:
	var t := RichTextLabel.new()
	t.bbcode_enabled = true
	t.fit_content = true
	t.scroll_active = false
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	t.add_theme_font_size_override("normal_font_size", 12)
	var p := []
	var chaves: Array = d.keys()
	chaves.sort_custom(func(a, b): return (d[a] > 0) and not (d[b] > 0))
	for c in chaves:
		var v: float = d[c]
		var txt: String = P_menu.texto_st(c, abs(v)).substr(1) # tira o "+" (o sinal vem abaixo)
		p.append("[color=#%s]%s %s%s[/color]" % [(MELHOR if v > 0 else PIOR).to_html(false), "▲" if v > 0 else "▼", "+" if v > 0 else "−", txt])
	t.text = "  ".join(p) if not p.is_empty() else "[color=#%s]%s[/color]" % [APAGADO.to_html(false), tr("Mesmos números")]
	return t

# janela pequena colada no medalhão (André: "o mais enxuta possível, estamos no celular"): a peça vestida em uma linha,
# Tirar, um aviso curto (é a sua melhor peça / tem peça melhor na mochila) e, se houver, as peças da mochila que servem
func montar_janela() -> void:
	if janela and is_instance_valid(janela):
		janela.queue_free()
		janela = null
		janela_rolagem = null
	if janela_lugar == "" or not aberto():
		return
	var P = P_menu
	var l := janela_lugar
	var atual = P.prog.equip.get(l)
	janela = Control.new()
	janela.set_anchors_preset(Control.PRESET_FULL_RECT)
	raiz.add_child(janela)
	# véu leve: tocar fora fecha
	var veu := ColorRect.new()
	veu.color = Color(0, 0, 0, 0.3)
	veu.set_anchors_preset(Control.PRESET_FULL_RECT)
	veu.mouse_filter = Control.MOUSE_FILTER_STOP
	veu.gui_input.connect(func(ev):
		if toque(ev):
			fechar_janela())
	janela.add_child(veu)
	var cx := PanelContainer.new()
	cx.custom_minimum_size = Vector2(430, 0)
	var est := caixa(FUNDO, OURO.darkened(0.15), 1, 10, 16)
	est.content_margin_left = 12
	est.content_margin_right = 12
	est.content_margin_top = 10
	est.content_margin_bottom = 10
	cx.add_theme_stylebox_override("panel", est)
	janela.add_child(cx)
	cx.modulate.a = 0.0 # aparece só depois de ir para o lado do medalhão (_posicionar_janela)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	cx.add_child(v)
	# peças da mochila que servem aqui, comparadas com a vestida (melhores primeiro)
	var opcoes := []
	for i in P.prog.mochila.size():
		var it = P.prog.mochila[i]
		if P.eh_equip(it) and str(P.dados.itens[it.k].lugar) == l:
			var d := diferenca(it, atual)
			opcoes.append({"i": i, "it": it, "d": d, "nota": nota(d)})
	opcoes.sort_custom(func(a, b): return a.nota > b.nota if a.nota != b.nota else int(a.it.r) > int(b.it.r))
	var melhores: int = opcoes.filter(func(o): return o.nota > 0.0001).size()
	# linha 1: a peça vestida (ícone, nome, números) e Tirar
	var linha := HBoxContainer.new()
	linha.add_theme_constant_override("separation", 10)
	var c := celula(atual, false, func(): pass, 52)
	c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	if atual == null: # lugar vazio: o desenho do lugar, apagado
		var ic := TextureRect.new()
		ic.texture = icone_tex("eq_" + l if l in ["cabeca", "corpo", "pernas", "pes", "capa", "acessorio"] else ("basico" if l == "espada" else "magia"))
		ic.set_anchors_preset(Control.PRESET_FULL_RECT)
		ic.offset_left = 10
		ic.offset_top = 10
		ic.offset_right = -10
		ic.offset_bottom = -10
		ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ic.modulate = Color(0.85, 0.75, 0.55, 0.3)
		ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
		c.add_child(ic)
	linha.add_child(c)
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	txt.add_theme_constant_override("separation", 0)
	txt.add_child(rotulo(Idioma.frase(janela_nome).to_upper(), 11, OURO))
	if atual != null:
		txt.add_child(rotulo(P.nome_item(atual), 16, P.cor_item(atual)))
		# um por linha, durabilidade e conjunto (André 2026-11-17: igual ao cartão da mochila)
		var d := rotulo(P.texto_item(atual).replace(" · ", "\n"), 13, TEXTO)
		d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		txt.add_child(d)
		var dmax: int = int(P.morte_dados().durMax)
		var du: int = P.durab(atual)
		var tdu := ("QUEBRADA · conserto %d ouro" % P.custo_conserto(atual)) if du <= 0 else ("Durabilidade %d/%d" % [du, dmax])
		txt.add_child(rotulo(tdu, 13, PIOR if du <= dmax * 0.3 else TEXTO if du < dmax else APAGADO))
		if int(atual.r) >= 1:
			txt.add_child(lista_conjunto(int(atual.r), true))
		txt.add_child(linha_reforco(atual))
	else:
		txt.add_child(rotulo("Nada vestido", 16, APAGADO))
		if l in ["corpo", "pernas"]:
			txt.add_child(rotulo("Aparece a roupa de baixo", 12, APAGADO))
	linha.add_child(txt)
	var cheia: bool = P.prog.mochila.find(null) < 0
	if atual != null and int(atual.get("e", 0)) < P.reforco_max(atual): # reforçar a peça vestida (igual ao Quimera)
		# André 2026-11-17: um botão só; a janela do reforço tem "1 vez", "Até o máximo" e "Cancelar"
		var rf := botao("Reforçar", func(): m.reforco.abrir({"lugar": l}), 15, true)
		rf.custom_minimum_size = Vector2(110, 44)
		rf.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		linha.add_child(rf)
	if atual != null:
		var b := botao("Tirar", func(): acao_item({"acao": "tirar", "lugar": l}), 15, not cheia)
		b.custom_minimum_size = Vector2(96, 44)
		b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		b.disabled = cheia
		avisar_travado(b, func(): return "Mochila cheia: libere um espaço para tirar a peça")
		linha.add_child(b)
	v.add_child(linha)
	# linha 2: o aviso curto
	var aviso := ""
	var cor_aviso := OURO_CLARO
	if atual != null and cheia:
		aviso = "Mochila cheia: libere um lugar para tirar" + (" (trocar funciona)." if not opcoes.is_empty() else ".")
		cor_aviso = PIOR
	elif atual == null:
		aviso = ("Tem %d peça%s na mochila para este lugar" % [opcoes.size(), "" if opcoes.size() == 1 else "s"]) if not opcoes.is_empty() else "Nenhuma peça na mochila para este lugar"
		cor_aviso = MELHOR if not opcoes.is_empty() else APAGADO
	elif melhores > 0:
		aviso = "▲ Tem peça melhor na mochila" if melhores == 1 else "▲ Tem %d peças melhores na mochila" % melhores
		cor_aviso = MELHOR
	else:
		aviso = "✓ É a sua melhor peça para este lugar"
	var a := rotulo(aviso, 13, cor_aviso)
	a.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(a)
	if l == "cabeca":
		v.add_child(linha_mostrar_capacete(14))
	# linhas 3+: as peças da mochila (até 3 à vista; mais que isso rola)
	if not opcoes.is_empty():
		var fio := ColorRect.new()
		fio.color = Color(OURO, 0.18)
		fio.custom_minimum_size = Vector2(0, 1)
		v.add_child(fio)
		janela_rolagem = ScrollContainer.new()
		janela_rolagem.set_meta("arrasto_proprio", true)
		janela_rolagem.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		janela_rolagem.custom_minimum_size = Vector2(0, min(opcoes.size(), 3) * 56 - 6)
		v.add_child(janela_rolagem)
		var lista := VBoxContainer.new()
		lista.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		lista.add_theme_constant_override("separation", 6)
		janela_rolagem.add_child(lista)
		for o in opcoes:
			lista.add_child(linha_opcao(o, atual != null))
	# ao lado do medalhão tocado, sem sair da tela
	_posicionar_janela.call_deferred(cx)

func _posicionar_janela(cx: Control) -> void:
	if not is_instance_valid(cx):
		return
	var tela := raiz.get_viewport_rect().size
	var alvo := Vector2(tela.x * 0.5, tela.y * 0.5)
	for id in slots_ui:
		if lugar_de(id) == janela_lugar:
			var r: Rect2 = slots_ui[id].no.get_global_rect()
			alvo = Vector2(r.end.x + 14, r.get_center().y - 40)
	cx.reset_size()
	var s := cx.get_combined_minimum_size()
	cx.position = Vector2(clampf(alvo.x, 12, tela.x - s.x - 12), clampf(alvo.y, 12, tela.y - s.y - 12))
	cx.modulate.a = 1.0

# uma peça da mochila numa linha: ícone, nome + Melhor/Pior, o que ganha e perde, e Trocar (ou Vestir)
func linha_opcao(o: Dictionary, tem_atual: bool) -> Control:
	var P = P_menu
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 10)
	var c := celula(o.it, false, func(): pass, 48)
	c.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(c)
	var txt := VBoxContainer.new()
	txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	txt.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	txt.add_theme_constant_override("separation", 0)
	var topo := HBoxContainer.new()
	topo.add_theme_constant_override("separation", 8)
	topo.add_child(rotulo(P.nome_item(o.it), 14, P.cor_item(o.it)))
	if tem_atual:
		var ver: Array = veredito(o.d)
		var tag := rotulo(ver[0], 11, ver[1])
		tag.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		topo.add_child(tag)
	txt.add_child(topo)
	if tem_atual:
		txt.add_child(texto_diferenca(o.d))
	else:
		txt.add_child(rotulo(P.texto_item(o.it), 12, MELHOR))
	l.add_child(txt)
	var b := botao("Trocar" if tem_atual else "Vestir", func(): acao_item({"acao": "equipar", "i": int(o.i)}), 14, true)
	b.custom_minimum_size = Vector2(88, 44)
	b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	l.add_child(b)
	return l

func montar_loja() -> void:
	var P = P_menu
	var topo := HBoxContainer.new()
	topo.add_child(linha_ouro())
	conteudo.add_child(topo)
	var merc: Dictionary = P.mercador()
	var txt_merc := "" if merc.venda <= 0.0 else " Mercador Nv %d: ela paga +%s%% e cobra -%s%%." % [P.prof_nivel("mer"), P.num(merc.venda * 100, 0), P.num(merc.compra * 100, 0)]
	var d := rotulo("Rosa compra o que você tiver: na Mochila, toque no item e em Vender." + txt_merc + " A banca dela também é a do Alfaiate (Profissões → Alfaiate).", 12, APAGADO)
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	conteudo.add_child(d)
	separador("À venda")
	for i in P.dados.loja.size():
		var o: Dictionary = P.dados.loja[i]
		var it := {"k": str(o.k), "n": 1} if not P.dados.itens[str(o.k)].has("lugar") else {"k": str(o.k), "r": int(o.r)}
		var l := HBoxContainer.new()
		l.add_theme_constant_override("separation", 12)
		l.add_child(celula(it, false, func(): pass, 48))
		var txt := VBoxContainer.new()
		txt.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		txt.add_theme_constant_override("separation", 0)
		txt.add_child(rotulo(P.nome_item(it), 15, P.cor_item(it)))
		var t := rotulo(P.texto_item(it), 12, APAGADO)
		t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		txt.add_child(t)
		l.add_child(txt)
		var preco: int = P.preco_compra(o)
		var pode: bool = int(P.prog.ouro) >= preco
		var b := botao("Comprar · %d" % preco, func(): escolher_quantidade(i), 14, pode) # André 2026-11-07: escolhe quantos
		b.set_meta("guia", "loja:" + str(o.k)) # guia.gd: o item que a missão pede
		b.custom_minimum_size = Vector2(140, 40)
		b.size_flags_vertical = Control.SIZE_SHRINK_CENTER
		b.disabled = not pode
		avisar_travado(b, func(): return "Faltam %d de ouro" % (preco - int(P.prog.ouro)))
		l.add_child(b)
		conteudo.add_child(l)

# ---------- comprar várias de uma vez (André 2026-11-07) ----------
# Tocar em Comprar abre a janelinha da quantidade: − e + (segurar repete e acelera), Máx (o que o ouro e a mochila deixam),
# o total em ouro e Comprar, que manda tudo de uma vez ({ acao: 'comprar', i, n }; o servidor confere ouro e espaço).
# Quando o servidor confirma (evento 'compra'), toca o som de moedas e sobe o "+20 Semente de cenoura" (comprou()).
var _qtd := 1
var _qtd_max := 1
var _qtd_repete: Timer
var _qtd_passo := 1 # quanto o − / + segurado anda (acelera)
var _qtd_vezes := 0

# quantos desse item ainda cabem na mochila (igual ao servidor: pilhas iguais com espaço + lugares vazios)
func cabe_na_mochila(o: Dictionary) -> int:
	var P = P_menu
	var equip: bool = P.dados.itens[str(o.k)].has("lugar")
	var pilha: int = 1 if equip else int(P.dados.itens[str(o.k)].get("pilha", 1))
	var n := 0
	for x in P.prog.mochila:
		if x == null:
			n += pilha
		elif not equip and str(x.k) == str(o.k) and not x.has("h") and not x.has("nv") and int(x.n) < pilha:
			n += pilha - int(x.n)
	return n

func escolher_quantidade(i: int) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	var P = P_menu
	var o: Dictionary = P.dados.loja[i]
	var equip: bool = P.dados.itens[str(o.k)].has("lugar")
	var it := {"k": str(o.k), "r": int(o.r)} if equip else {"k": str(o.k), "n": 1}
	var preco: int = P.preco_compra(o)
	var cabe := cabe_na_mochila(o)
	_qtd_max = mini(int(P.dados.get("lojaMax", 999)), mini(int(P.prog.ouro) / maxi(1, preco), cabe))
	if _qtd_max <= 0:
		m.hud.aviso("Mochila cheia" if cabe <= 0 else "Ouro insuficiente")
		return
	_qtd = 1
	# missão pede comprar N (André 2026-11-16: "não fala a quantidade, então eu compro um"): já abre com o que falta
	var hi_q: Dictionary = P_menu.hist_info
	if not equip and str(hi_q.get("ev", "")) == "comprar" and str(hi_q.get("k", "")) == str(o.k):
		_qtd = clampi(int(hi_q.get("qtd", 1)), 1, _qtd_max)
	fechar_confirma()
	_confirma = Control.new()
	_confirma.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_confirma)
	var escuro := ColorRect.new()
	escuro.color = Color(0, 0, 0, 0.5)
	escuro.set_anchors_preset(Control.PRESET_FULL_RECT)
	_confirma.add_child(escuro)
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(FUNDO, OURO.darkened(0.25), 2, 10, 16))
	cx.set_anchors_preset(Control.PRESET_CENTER)
	cx.custom_minimum_size = Vector2(460, 0)
	cx.position = Vector2(-230, -150)
	_confirma.add_child(cx)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	cx.add_child(col)
	# o item: ícone, nome e preço de cada um
	var topo := HBoxContainer.new()
	topo.add_theme_constant_override("separation", 12)
	topo.add_child(celula(it, false, func(): pass, 56))
	var nomes := VBoxContainer.new()
	nomes.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	nomes.alignment = BoxContainer.ALIGNMENT_CENTER
	nomes.add_child(rotulo(P.nome_item(it), 18, P.cor_item(it)))
	nomes.add_child(rotulo("%d de ouro cada · você tem %d" % [preco, int(P.prog.ouro)], 13, APAGADO))
	topo.add_child(nomes)
	col.add_child(topo)
	# − quantidade + e Máx
	var linha_q := HBoxContainer.new()
	linha_q.alignment = BoxContainer.ALIGNMENT_CENTER
	linha_q.add_theme_constant_override("separation", 10)
	col.add_child(linha_q)
	var menos := botao_repete("−", -1)
	linha_q.add_child(menos)
	var caixa_n := PanelContainer.new()
	caixa_n.add_theme_stylebox_override("panel", caixa(Color(0.04, 0.035, 0.03, 1), OURO, 1, 8, 6))
	caixa_n.custom_minimum_size = Vector2(110, 56)
	var num := rotulo("1", 28, OURO_CLARO)
	num.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	num.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	caixa_n.add_child(num)
	linha_q.add_child(caixa_n)
	var mais := botao_repete("+", 1)
	linha_q.add_child(mais)
	var maximo := botao("Máx", func(): mudar_qtd(_qtd_max - _qtd), 16)
	maximo.custom_minimum_size = Vector2(72, 56)
	linha_q.add_child(maximo)
	var limite := rotulo("", 12, APAGADO)
	limite.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	limite.text = Idioma.frase("Até %d (%s)" % [_qtd_max, "o que cabe na mochila" if _qtd_max >= cabe else "o que o ouro paga" if _qtd_max < int(P.dados.get("lojaMax", 999)) else "por vez"])
	col.add_child(limite)
	# total e botões
	var linha := HBoxContainer.new()
	linha.add_theme_constant_override("separation", 10)
	col.add_child(linha)
	var total := HBoxContainer.new()
	total.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	total.add_theme_constant_override("separation", 6)
	var ic := TextureRect.new()
	ic.texture = icone_tex("it_ouro")
	ic.custom_minimum_size = Vector2(24, 24)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	total.add_child(ic)
	var t_total := rotulo("", 18, Color("ffd36a"))
	t_total.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	total.add_child(t_total)
	linha.add_child(total)
	var nao := botao("Cancelar", fechar_confirma, 15)
	nao.custom_minimum_size = Vector2(110, 48)
	linha.add_child(nao)
	var ok := botao("Comprar", func():
		var n := _qtd
		fechar_confirma()
		acao_item({"acao": "comprar", "i": i, "n": n}), 16, true)
	ok.custom_minimum_size = Vector2(130, 48)
	linha.add_child(ok)
	var mostrar := func():
		num.text = str(_qtd)
		t_total.text = tr("Total: %d de ouro") % (_qtd * preco)
		ok.text = tr("Comprar %d") % _qtd
		menos.disabled = _qtd <= 1
		mais.disabled = _qtd >= _qtd_max
		maximo.disabled = _qtd >= _qtd_max
	_confirma.set_meta("mostrar", mostrar)
	mostrar.call()

func mudar_qtd(d: int) -> void:
	_qtd = clampi(_qtd + d, 1, maxi(1, _qtd_max))
	if _confirma and _confirma.has_meta("mostrar"):
		(_confirma.get_meta("mostrar") as Callable).call()

# ---------- quantos passam (André 2026-11-17: "escolher tudo ou a quantidade específica") ----------
# Troca, leilão, baú, fornalha e fogão: tocar numa pilha abre esta janelinha. "Tudo (N)" passa a pilha inteira na hora;
# ou escolhe o número (− e + seguram e aceleram, ou digita no campo) e toca no botão da direita. Um item só vai direto.
# feito recebe o número escolhido; quem decide é o servidor (nunca passa mais do que tem).
var _qtd_campo: LineEdit

func pedir_qtd(it: Dictionary, maximo: int, verbo: String, feito: Callable, preco_un := 0) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	if maximo <= 1:
		feito.call(maxi(1, maximo))
		return
	var P = P_menu
	_qtd_max = maximo
	_qtd = 1
	fechar_confirma()
	_confirma = Control.new()
	_confirma.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_confirma)
	var escuro := ColorRect.new()
	escuro.color = Color(0, 0, 0, 0.5)
	escuro.set_anchors_preset(Control.PRESET_FULL_RECT)
	escuro.gui_input.connect(func(ev): if (ev is InputEventMouseButton and ev.pressed) or (ev is InputEventScreenTouch and ev.pressed): fechar_confirma())
	_confirma.add_child(escuro)
	var cx := PanelContainer.new()
	cx.add_theme_stylebox_override("panel", caixa(FUNDO, OURO.darkened(0.25), 2, 10, 16))
	cx.set_anchors_preset(Control.PRESET_CENTER)
	cx.custom_minimum_size = Vector2(440, 0)
	cx.position = Vector2(-220, -120)
	_confirma.add_child(cx)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 12)
	cx.add_child(col)
	# o item: ícone, nome e quantos tem
	var mostra := it.duplicate()
	if mostra.has("n"):
		mostra.n = maximo
	var topo := HBoxContainer.new()
	topo.add_theme_constant_override("separation", 12)
	topo.add_child(celula(mostra, false, func(): pass, 56))
	var nomes := VBoxContainer.new()
	nomes.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	nomes.alignment = BoxContainer.ALIGNMENT_CENTER
	nomes.add_child(rotulo(P.nome_item(it), 18, P.cor_item(it)))
	nomes.add_child(rotulo(tr("Tem %d") % maximo, 13, APAGADO))
	topo.add_child(nomes)
	col.add_child(topo)
	# − número + (o número dá para digitar)
	var linha_q := HBoxContainer.new()
	linha_q.alignment = BoxContainer.ALIGNMENT_CENTER
	linha_q.add_theme_constant_override("separation", 10)
	col.add_child(linha_q)
	var menos := botao_repete("−", -1)
	linha_q.add_child(menos)
	_qtd_campo = LineEdit.new()
	_qtd_campo.text = "1"
	_qtd_campo.alignment = HORIZONTAL_ALIGNMENT_CENTER
	_qtd_campo.virtual_keyboard_type = LineEdit.KEYBOARD_TYPE_NUMBER
	_qtd_campo.select_all_on_focus = true
	_qtd_campo.max_length = 5
	_qtd_campo.custom_minimum_size = Vector2(120, 56)
	_qtd_campo.add_theme_font_size_override("font_size", 28)
	_qtd_campo.add_theme_color_override("font_color", OURO_CLARO)
	_qtd_campo.add_theme_stylebox_override("normal", caixa(Color(0.04, 0.035, 0.03, 1), OURO, 1, 8, 6))
	_qtd_campo.add_theme_stylebox_override("focus", caixa(Color(0.04, 0.035, 0.03, 1), OURO_CLARO, 2, 8, 6))
	_qtd_campo.text_changed.connect(func(t: String):
		if t.strip_edges().is_valid_int():
			_qtd = clampi(int(t.strip_edges()), 1, _qtd_max)
			(_confirma.get_meta("mostrar") as Callable).call())
	linha_q.add_child(_qtd_campo)
	var mais := botao_repete("+", 1)
	linha_q.add_child(mais)
	# Cancelar, Tudo e o número escolhido
	var linha := HBoxContainer.new()
	linha.add_theme_constant_override("separation", 10)
	col.add_child(linha)
	var nao := botao("Cancelar", fechar_confirma, 15)
	nao.custom_minimum_size = Vector2(110, 48)
	linha.add_child(nao)
	var tudo := botao("Tudo (%d)" % maximo, func():
		fechar_confirma()
		feito.call(maximo), 16)
	tudo.set_meta("pt", "Tudo (%d)" % maximo) # o guia das missões pisca o Tudo
	tudo.text = tr("Tudo (%d)") % maximo
	tudo.custom_minimum_size = Vector2(0, 48)
	tudo.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	linha.add_child(tudo)
	var ok := botao(verbo, func():
		var n := _qtd
		fechar_confirma()
		feito.call(n), 16, true)
	ok.custom_minimum_size = Vector2(0, 48)
	ok.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	linha.add_child(ok)
	_qtd_campo.text_submitted.connect(func(_t): ok.pressed.emit())
	var mostrar := func():
		var t := _qtd_campo.text.strip_edges()
		if not (t.is_valid_int() and int(t) == _qtd) and not (t == "" and _qtd_campo.has_focus()):
			_qtd_campo.text = str(_qtd)
			_qtd_campo.caret_column = _qtd_campo.text.length()
		ok.text = tr(verbo + " %d") % _qtd
		if preco_un > 0: # venda: quanto de ouro dá
			ok.text += " · %d" % (_qtd * preco_un)
			tudo.text = tr("Tudo (%d)") % maximo + " · %d" % (maximo * preco_un)
		menos.disabled = _qtd <= 1
		mais.disabled = _qtd >= _qtd_max
	_confirma.set_meta("mostrar", mostrar)
	mostrar.call()

# − / + que repetem enquanto o dedo segura (começa de 1 em 1, depois de 5 em 5 e de 10 em 10)
func botao_repete(t: String, sinal: int) -> Button:
	var b := Button.new()
	b.set_meta("pt", t) # o guia das missões acha o botão pelo texto em português
	b.text = Idioma.frase(str(b.get_meta("pt")))
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 28)
	b.custom_minimum_size = Vector2(64, 56)
	estilo_botao(b, true)
	b.button_down.connect(func():
		mudar_qtd(sinal)
		_qtd_vezes = 0
		_qtd_passo = sinal
		if _qtd_repete == null:
			_qtd_repete = Timer.new()
			add_child(_qtd_repete)
			_qtd_repete.timeout.connect(func():
				if _confirma == null or not _confirma.has_meta("mostrar"):
					_qtd_repete.stop()
					return
				_qtd_vezes += 1
				_qtd_repete.wait_time = 0.09
				var passo := 1 if _qtd_vezes < 12 else 5 if _qtd_vezes < 30 else 10
				mudar_qtd(passo * signi(_qtd_passo)))
		_qtd_repete.wait_time = 0.4
		_qtd_repete.start())
	b.button_up.connect(func():
		if _qtd_repete:
			_qtd_repete.stop())
	return b

# o servidor confirmou a compra (evento 'compra' em online.gd): som de moedas e o "+n Item" subindo, com o ouro gasto
func comprou(ev: Dictionary) -> void:
	var P = P_menu
	if m.sons:
		m.sons.tocar("moedas", -2.0, 0.05)
	var it := {"k": str(ev.k), "r": int(ev.r)} if int(ev.get("r", -1)) >= 0 else {"k": str(ev.k), "n": int(ev.n)}
	var caixa_f := PanelContainer.new()
	caixa_f.add_theme_stylebox_override("panel", caixa(Color(0.07, 0.06, 0.045, 0.94), OURO_CLARO, 2, 12, 12))
	caixa_f.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 10)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	caixa_f.add_child(l)
	var ic := TextureRect.new()
	ic.texture = icone_tex(P.icone_item(it))
	ic.custom_minimum_size = Vector2(52, 52)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.add_child(ic)
	var txt := VBoxContainer.new()
	txt.add_theme_constant_override("separation", 0)
	txt.mouse_filter = Control.MOUSE_FILTER_IGNORE
	txt.add_child(rotulo("+%d %s" % [int(ev.n), P.nome_item(it)], 24, MELHOR))
	txt.add_child(rotulo("−%d de ouro" % int(ev.ouro), 17, Color("ffd36a")))
	l.add_child(txt)
	add_child(caixa_f)
	await get_tree().process_frame
	if not is_instance_valid(caixa_f):
		return
	var tela := get_viewport().get_visible_rect().size
	caixa_f.position = Vector2((tela.x - caixa_f.size.x) * 0.5, tela.y * 0.42)
	caixa_f.pivot_offset = caixa_f.size * 0.5
	caixa_f.scale = Vector2(0.6, 0.6)
	var tw := caixa_f.create_tween()
	tw.tween_property(caixa_f, "scale", Vector2.ONE, 0.18).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(caixa_f, "position:y", tela.y * 0.42 - 70.0, 1.5).set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_OUT)
	tw.parallel().tween_property(caixa_f, "modulate:a", 0.0, 0.5).set_delay(1.1)
	tw.tween_callback(caixa_f.queue_free)

# aprendeu com o Tomo (André 2026-11-07): faixa pequena e dourada, "Parabéns! Você liberou X Nv N", some sozinha
func aprendeu(id: String, nv: int) -> void:
	var P = P_menu
	if not P.habs.has(id):
		return
	if m.sons:
		m.sons.tocar("nivel", -4.0, 0.0)
	var caixa_f := PanelContainer.new()
	caixa_f.add_theme_stylebox_override("panel", caixa(Color(0.07, 0.06, 0.045, 0.95), OURO_CLARO, 2, 12, 14))
	caixa_f.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var l := HBoxContainer.new()
	l.add_theme_constant_override("separation", 12)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	caixa_f.add_child(l)
	var ic := TextureRect.new()
	ic.texture = icone_tex(P.ICONE.get(id, ""))
	ic.custom_minimum_size = Vector2(52, 52)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.add_child(ic)
	var txt := VBoxContainer.new()
	txt.add_theme_constant_override("separation", 0)
	txt.mouse_filter = Control.MOUSE_FILTER_IGNORE
	txt.add_child(rotulo("Parabéns!", 24, Color("ffd36a")))
	txt.add_child(rotulo("Você liberou %s Nv %d" % [P.habs[id].nome, nv], 17, TEXTO))
	l.add_child(txt)
	add_child(caixa_f)
	await get_tree().process_frame
	if not is_instance_valid(caixa_f):
		return
	var tela := get_viewport().get_visible_rect().size
	caixa_f.position = Vector2((tela.x - caixa_f.size.x) * 0.5, tela.y * 0.16)
	caixa_f.pivot_offset = caixa_f.size * 0.5
	caixa_f.scale = Vector2(0.6, 0.6)
	var tw := caixa_f.create_tween()
	tw.tween_property(caixa_f, "scale", Vector2(1.08, 1.08), 0.2).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
	tw.tween_property(caixa_f, "scale", Vector2.ONE, 0.15)
	tw.tween_property(caixa_f, "modulate:a", 0.0, 0.5).set_delay(2.0)
	tw.tween_callback(caixa_f.queue_free)

# online o servidor confere e devolve a mochila nova; sem internet muda só neste celular (a loja só funciona online)
func acao_item(msg: Dictionary) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	var P = P_menu
	var i: int = msg.get("i", -1)
	if msg.acao == "usar" and i >= 0 and P.prog.mochila[i] != null and P.prog.mochila[i].k != "tomo":
		if not m.usar_pocao(P.prog.mochila[i]): # vida/mana cheia: nem gasta
			return
	if msg.acao in ["equipar", "tirar", "vender", "apagar", "vender_varios", "organizar"]:
		sel_mochila = -1
		sel_equip = ""
	if msg.acao == "vender_varios":
		vendendo = false
		marcados = {}
	if msg.acao in ["destruir", "evoluir"] and not m.on():
		m.hud.aviso("Destruir e evoluir peça só funcionam online")
		return
	if msg.acao == "filtro": # o quadradinho responde na hora; online o servidor devolve o mesmo
		if msg.r.is_empty() and msg.k.is_empty():
			P.prog.erase("filtro")
		else:
			P.prog.filtro = {"r": msg.r.duplicate(), "k": msg.k.duplicate()}
		P.mudou = true
	if m.on():
		rede("item", msg)
		if msg.acao == "filtro":
			atualizar()
		return
	match msg.acao:
		"titulo": # sozinho (sem servidor): só usa o que a conta já ganhou
			var tt = P.prog.get("tit")
			if tt is Dictionary and (msg.id == "" or msg.id in tt.get("tem", [])):
				tt.uso = msg.id
		"capacete":
			P.prog.semCapacete = msg.mostrar == false
		"equipar":
			if i >= 0 and P.eh_equip(P.prog.mochila[i]) and not P.reforco_ok(P.prog.mochila[i]):
				m.hud.aviso(P.texto_reforco_precisa(P.prog.mochila[i]))
			P.equipar(i)
		"tirar":
			var r: String = P.tirar(msg.lugar)
			if r != "":
				m.hud.aviso(r)
		"usar":
			var it = P.prog.mochila[i]
			if it.k == "tomo":
				var h := str(it.h)
				var r: String = P.usar_tomo(i)
				m.hud.aviso(r)
				if r.ends_with("!"): # subiu
					aprendeu(h, P.nivel_de(h))
			else:
				P.gastar(i)
			if P.prog.mochila[i] == null:
				sel_mochila = -1
		"cadeado":
			var it = P.prog.mochila[i] if i >= 0 and i < P.prog.mochila.size() else P.prog.equip.get(msg.get("lugar", ""))
			if it != null:
				if it.get("cad", false):
					it.erase("cad")
				else:
					it.cad = 1
				P.mudou = true
				m.hud.aviso(("%s trancado: não dá para vender nem jogar fora" if it.has("cad") else "%s destrancado") % P.nome_item(it))
		"apagar":
			var it = P.prog.mochila[i] if i >= 0 and i < P.prog.mochila.size() else null
			if it != null and it.get("cad", false):
				m.hud.aviso("Item trancado. Abra o cadeado para jogar fora")
			elif it != null:
				P.prog.mochila[i] = null
				P.mudou = true
				m.hud.aviso("Jogou fora %s" % P.nome_item(it))
		"consertar": # sem internet: tudo, ou só as peças marcadas na tela do equipamento (André 2026-11-18)
			m.hud.aviso(P.consertar_pecas(msg.lista) if msg.has("lista") else P.consertar_tudo())
		"vender", "comprar", "vender_varios":
			m.hud.aviso("A loja só funciona online (o ouro fica na sua conta)")
		"pagina":
			m.hud.aviso("Páginas da mochila só se compram online (o ouro fica na sua conta)")
		"organizar":
			P.prog.mochila = P.organizar(P.prog.mochila)
			P.mudou = true
	m.h.vida = min(m.h.vida, P.st.vidaMax)
	m.h.mana = min(m.h.mana, P.st.manaMax)
	atualizar()

# a barra (6 botões): toque em um e depois em outro para trocar de lugar; Padrão volta ao começo
func linha_barra(barra: String) -> Control:
	var P = P_menu
	var bt := HBoxContainer.new()
	bt.add_theme_constant_override("separation", 8)
	var lista: Array = P.prog.barras[barra]
	for i in lista.size():
		var k = lista[i]
		var escolhido: bool = _sel != null and _sel[0] == barra and _sel[1] == i
		var s := Button.new()
		s.focus_mode = Control.FOCUS_NONE
		s.custom_minimum_size = Vector2(56, 56)
		var est := caixa(Color(0.16, 0.13, 0.08, 1) if escolhido else Color(0.05, 0.045, 0.04, 1), OURO_CLARO if escolhido else OURO if k != null else BORDA, 2 if escolhido else 1, 28)
		for e in ["normal", "hover", "pressed"]:
			s.add_theme_stylebox_override(e, est)
		s.pressed.connect(func():
			if not _arrastou:
				tocar_barra(barra, i))
		var n := rotulo(str(i + 1), 12, OURO)
		n.position = Vector2(5, 1)
		if k != null and P.habs.has(k):
			var ic := TextureRect.new()
			ic.texture = icone_tex(P.ICONE.get(k, ""))
			ic.set_anchors_preset(Control.PRESET_FULL_RECT)
			ic.offset_left = 10
			ic.offset_top = 10
			ic.offset_right = -10
			ic.offset_bottom = -10
			ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
			if not P.liberada(k):
				ic.modulate = Color(0.4, 0.4, 0.4)
				var nv := rotulo("Nv %d" % int(P.habs[k].libera), 11, APAGADO)
				nv.position = Vector2(14, 38)
				s.add_child(ic)
				s.add_child(nv)
			else:
				s.add_child(ic)
		n.mouse_filter = Control.MOUSE_FILTER_IGNORE
		s.add_child(n)
		bt.add_child(s)
	var pd := botao("Padrão", func(): barra_padrao(barra), 13)
	pd.custom_minimum_size = Vector2(76, 40)
	pd.size_flags_vertical = Control.SIZE_SHRINK_CENTER
	bt.add_child(pd)
	return bt

func tocar_barra(barra: String, i: int) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	if _sel == null or _sel[0] != barra:
		_sel = [barra, i]
	elif _sel[1] == i:
		_sel = null
	else:
		var b: Array = P_menu.prog.barras[barra]
		var t = b[i]
		b[i] = b[_sel[1]]
		b[_sel[1]] = t
		_sel = null
		mandar_barra(barra)
	atualizar()

func barra_padrao(barra: String) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	P_menu.prog.barras[barra] = P_menu.dados.botoesPadrao[barra].duplicate()
	_sel = null
	mandar_barra(barra)
	atualizar()

func por_no_botao(id: String, barra: String, i: int) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	var b: Array = P_menu.prog.barras[barra]
	P_menu.por_no_botao("" if b[i] == id else id, barra, i)
	_sel = null
	mandar_barra(barra)
	atualizar()

func mandar_barra(barra: String) -> void:
	if _so_olhando(): # menu do recruta (só olhando)
		return
	P_menu.mudou = true
	rede("barra", {"barra": barra, "lista": P_menu.prog.barras[barra]})

# X de fechar desenhado (sem depender de símbolo na fonte)
class Quadradinho extends Control:
	var marcado := true
	var lado := 18.0
	func _ready() -> void:
		custom_minimum_size = Vector2(lado, lado)
		mouse_filter = Control.MOUSE_FILTER_IGNORE
	func _draw() -> void:
		var r := Rect2(Vector2(1, 1), Vector2(lado - 2, lado - 2))
		draw_rect(r, Color(0.05, 0.045, 0.04) if not marcado else Color(0.17, 0.148, 0.12))
		draw_rect(r, Color(0.95, 0.82, 0.55) if marcado else Color(0.42, 0.33, 0.20), false, 1.5)
		if marcado:
			var k := lado / 18.0
			draw_polyline(PackedVector2Array([Vector2(4.5, 9.5) * k, Vector2(7.8, 13) * k, Vector2(13.8, 5) * k]), Color(0.95, 0.82, 0.55), 2.4 * k, true)

class Fechar extends Control:
	func _ready() -> void:
		custom_minimum_size = Vector2(48, 48) # conselho 2026-11-13: era 40 (X de cerca de 5 mm); o centro fica no mesmo lugar
		mouse_filter = Control.MOUSE_FILTER_STOP
		add_to_group("guia_saida") # a trava do guia (guia.gd) sempre deixa o X passar
	func _draw() -> void:
		var c := size * 0.5
		draw_circle(c, 21, Color(0.12, 0.105, 0.088))
		draw_arc(c, 21, 0, TAU, 32, Color(0.8, 0.64, 0.36), 1.5, true)
		var r := 7.5
		draw_line(c + Vector2(-r, -r), c + Vector2(r, r), Color(0.95, 0.82, 0.55), 2.5, true)
		draw_line(c + Vector2(-r, r), c + Vector2(r, -r), Color(0.95, 0.82, 0.55), 2.5, true)

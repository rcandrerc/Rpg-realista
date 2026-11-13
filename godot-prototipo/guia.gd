extends CanvasLayer
# Guia das missões (André 2026-11-12: "assim que você aceita [a missão], o ícone da mochila fica aceso lá, piscando, até
# que você clica... vai abrir a mochila. Aí o primeiro equipamento lá que tiver, ele vai ficar piscando também. Aí você
# clica. Aí o botão de destruir vai ficar piscando... Mesma coisa quando for uma missão para construir uma picareta...
# o fogão. Ele te guia o passo a passo inteiro, porque a função da missão é ensinar").
#
# Como funciona: cada tipo de etapa da história (o servidor manda o tipo em hist_info: ev, k, min, de) vira uma lista de
# "toques", na ordem em que o jogador faz (passos()). A cada 0,15 s o guia procura, de trás para a frente, o primeiro
# toque da lista que está na tela agora e pisca só ele. Assim não precisa guardar em que passo o jogador está: abriu a
# mochila, o botão da mochila some atrás do menu e quem pisca é a peça; tocou na peça, aparece o Destruir e ele pisca;
# fechou tudo no meio, volta a piscar a mochila. Só procura dentro da janela que está por cima (a confirmação, o menu,
# a conversa...), então nunca pisca um botão tapado por outra janela.
# Não tem texto novo na tela, só o brilho (o que fazer já está na barrinha da missão).
# Trava (André 2026-11-12: "quando estivesse fazendo a missão, só conseguisse fazer aquilo que o sistema estava pedindo"):
# com uma janela aberta (menu, conversa, confirmação, fornalha...) e algo piscando nela, só o que pisca aceita toque; o
# resto da tela não responde. No jogo (sem janela) não trava: andar, lutar e fugir ficam livres, só o brilho guia.
# Saída de emergência: se o mesmo botão fica piscando TRAVA_MAX s sem o jogador conseguir, a trava solta (o brilho fica).
# Leve: uma busca na janela de cima a cada 0,15 s e um desenho só (um Control) enquanto tem algo piscando.

const Menu = preload("res://menu.gd")
const LIGADO := true # chave geral do guia
const PASSO := 0.15 # s entre uma busca e outra
const LONGE := 7.0 # m: mais longe que isto do lugar da etapa, o "Ir" da barrinha pisca
const LONGE_CAMPO := 30.0 # m: caçar, pistas e coleta (o campo é grande: lá dentro o "Ir" para de piscar)
const PERTO_NPC := 4.5 # m: do lado do NPC (missao_ativa.gd abre a conversa a 4 m)
const COR := Color(1.0, 0.86, 0.42) # dourado claro (o mesmo brilho dos botões ativos)
const TRAVA := true # chave da trava (só o que pisca aceita toque)
const TRAVA_MAX := 20.0 # s no mesmo botão: a trava solta (nunca prende o jogador de vez)
const TRAVA_EM := ["menu", "janela", "confirma", "qtd", "conversa", "leilao", "forno", "veiculo", "topo", "mapa"]

# tela inteira que come o toque, menos no buraco (o que pisca): o toque no buraco passa para o botão de baixo
class Trava extends Control:
	var buraco := Rect2()
	func _has_point(p: Vector2) -> bool:
		if buraco.has_point(p):
			return false
		# o X de fechar sempre passa (conselho 2026-11-13: a trava prendia até o X por 20 s); grupo "guia_saida"
		for x in get_tree().get_nodes_in_group("guia_saida"):
			if x is Control and x.is_visible_in_tree():
				var xf: Transform2D = x.get_global_transform_with_canvas()
				if Rect2(xf.origin, x.size * xf.get_scale()).grow(4.0).has_point(p):
					return false
		return true

var m # main.gd
var desenho: Control
var _t := 0.0
var _alvo = null # Control que pisca agora (ou null)
var _circ := Vector3.ZERO # botão redondo da HUD que pisca: x, y = centro, z = raio (z <= 0: nenhum)
var _ret := Rect2() # retângulo solto (painel do herói, totem no mapa)
var _chave := "" # o que pisca agora (para rolar a lista até ele só uma vez)
var _grupo_de := {} # cache: o que se cria -> grupo da aba Criar
var trava: Trava
var _tipo := "" # janela de cima na última busca
var _trava_t := 0.0 # s que o mesmo botão está piscando
var _trava_de := ""

func _init(principal) -> void:
	m = principal
	layer = 26 # acima de tudo que tem botão (menu 20, reforço 22, janela de criar 25); abaixo da cena da história (45)

func _ready() -> void:
	trava = Trava.new()
	trava.set_anchors_preset(Control.PRESET_FULL_RECT)
	trava.mouse_filter = Control.MOUSE_FILTER_STOP
	trava.visible = false
	add_child(trava)
	desenho = Control.new()
	desenho.set_anchors_preset(Control.PRESET_FULL_RECT)
	desenho.mouse_filter = Control.MOUSE_FILTER_IGNORE
	desenho.draw.connect(_desenhar)
	add_child(desenho)
	_sb = _moldura(true, 4)
	_sb2 = _moldura(false, 3)

func _process(dt: float) -> void:
	_t -= dt
	if _t <= 0.0:
		_t = PASSO
		var tinha: bool = _tem()
		_procurar()
		_travar(PASSO)
		if tinha and not _tem():
			desenho.queue_redraw() # apaga o último brilho
	if _tem():
		desenho.queue_redraw()

func _tem() -> bool:
	return (_alvo != null and is_instance_valid(_alvo)) or _circ.z > 0.0 or _ret.has_area()

# a trava segue o que pisca: buraco no lugar dele, só com janela aberta, e solta depois de TRAVA_MAX s no mesmo botão
func _travar(dt: float) -> void:
	if _chave != _trava_de:
		_trava_de = _chave
		_trava_t = 0.0
	else:
		_trava_t += dt
	var r := _ret_alvo()
	var pode: bool = TRAVA and LIGADO and _chave != "" and _tipo in TRAVA_EM and r.has_area() and _trava_t < TRAVA_MAX
	if pode:
		trava.buraco = r.grow(4.0)
	if trava.visible != pode:
		trava.visible = pode

# o retângulo na tela do que pisca (Control ou retângulo solto); vazio = nada (ou só um círculo da HUD)
func _ret_alvo() -> Rect2:
	if _alvo != null and is_instance_valid(_alvo):
		if not _alvo.is_visible_in_tree():
			return Rect2()
		var xf: Transform2D = _alvo.get_global_transform_with_canvas()
		return Rect2(xf.origin, _alvo.size * xf.get_scale())
	return _ret

func _limpar() -> void:
	_alvo = null
	_circ = Vector3.ZERO
	_ret = Rect2()

# ---------- o que a etapa pede ----------
# a etapa da vez (a mesma da barrinha da missão); vazio = nada a guiar
func _etapa() -> Dictionary:
	if m.P == null or m.nevoa == null:
		return {}
	var M: Dictionary = m.nevoa.missao_atual()
	if M.is_empty():
		return {}
	var hi: Dictionary = m.P.hist_info
	if hi.is_empty() or str(hi.get("id", "")) != str(M.get("id", "")):
		return {}
	return hi

# a lista de toques da etapa, na ordem em que o jogador faz
func passos(hi: Dictionary) -> Array:
	if str(hi.get("npc", "")) != "": # falar com alguém: aceitar, entregar ou a etapa de falar
		return ["ir", "hud:falar", "b^Missão:"]
	var ev := str(hi.get("ev", ""))
	var k := str(hi.get("k", "")) if hi.get("k") != null else ""
	var mn := int(hi.get("min", 0)) if hi.get("min") != null else 0
	var bolsa := ["topo:mochila", "aba:mochila"]
	match ev:
		"destruir":
			return bolsa + ["item:equip", "b:Destruir", "b:Só esta"]
		"evoluir":
			return ["ir"] + bolsa + ["item:evoluir:%d" % mn, "b:Evoluir"] # a janelinha também tem "Evoluir"
		"reforcar":
			return bolsa + ["item:reforco", "b:Reforçar 1 vez"]
		"arma":
			return bolsa + ["item:arma:%d" % mn, "b:Equipar"]
		"criar":
			return _passos_criar(k)
		"construir":
			return ["ir", "topo:construir", "cons:aba:" + _aba_obra(k), "cons:slot:" + k, "cons:criar:" + k, "cons:ok:" + k]
		"plantar":
			return ["ir", "topo:construir", "cons:aba:fazenda", "cons:slot:plantar:" + k, "cons:marcar:plantar", "cons:salvar"]
		"regar", "colher":
			return ["ir", "topo:construir", "cons:aba:fazenda", "cons:slot:" + ev, "cons:marcar:" + ev, "cons:salvar"]
		"terreno":
			return ["ir", "hud:lote", "cons:comprar"]
		"dormir":
			return ["ir", "hud:cama"]
		"montar":
			return ["hud:montar"]
		"treino":
			return ["ir", "hud:hab" if hi.get("skill", false) == true else "hud:basico"]
		"item":
			var de := str(hi.get("de", ""))
			if de == "solto" or de == "coleta":
				return ["ir", "hud:coletar"]
			if de == "pesca":
				return ["ir", "hud:pescar"]
			return ["ir"]
		"pesca":
			return ["ir", "hud:veiculo", "hud:pescar"] if hi.get("barco", false) == true else ["ir", "hud:pescar"]
		"vender":
			return ["ir", "hud:falar", "b:Vender itens", "item:vende", "b^Vender"]
		"comprar":
			return ["ir", "hud:falar", "b:Comprar", "loja:" + k]
		"atributo":
			return ["hud:painel", "aba:status", "b:+", "b^Confirmar ("]
		"barra":
			return ["hud:painel", "aba:habilidades", "m:barra:livre"]
		# o mercador tem "Criar pack" e "Entregar pack" direto na janela (André 2026-11-12)
		"pack_fez":
			return ["ir", "hud:falar", "b^Criar pack"]
		"pack":
			return ["ir", "hud:falar", "b^Entregar pack"]
		"passe":
			return ["ir", "hud:selo"] if k == "usar" else ["ir", "hud:falar", "b^Fazer passe"]
		"resetar":
			return ["ir", "hud:falar", "b:Resetar build", "b^Resetar ("]
		"sintetizar":
			return ["ir", "hud:falar", "b:Sintetizar catalisador", "m:alq"]
		"leilao":
			var base := ["ir", "hud:falar", "b^Leilão"]
			match str(hi.get("de", "")):
				"anunciar":
					return base + ["leilao:aba:vender", "leilao:item", "b:Anunciar"]
				"comprar":
					return base + ["leilao:aba:comprar", "m:leilao:comprar"]
				"retirar":
					return base + ["leilao:aba:retirar", "b:Retirar tudo"]
			return base
		"viajar":
			return ["ir", "hud:falar", "mapa:totem:" + k]
		"time":
			return ["topo:multi", "b:Time"]
		"veiculo":
			var antes: Array = [] if m.P.carrinho_no_mundo() else bolsa + ["item:k:carrinho", "b:Colocar no chão"]
			match k:
				"abastecer":
					return antes + ["hud:veiculo", "m:veiculo:encher"]
				"melhorar":
					return ["ir"] + antes + ["hud:veiculo", "m:veiculo:melhorar"]
				"consertar":
					return antes + ["hud:veiculo", "m:veiculo:consertar"]
			return antes + ["hud:veiculo"]
	return ["ir"] # matar, pos, pistas, totem, ter, noite...: o "Ir" leva até lá

# criar: barra e carvão saem da fornalha (a aba Criar não tem); o resto, Mochila > Criar > grupo > Criar > Criar 1
func _passos_criar(k: String) -> Array:
	var D: Dictionary = m.P.dados
	var forn: Dictionary = D.get("fornalha", {}).get("receitas", {})
	for ent in forn:
		if str(forn[ent].get("faz", "")) == k:
			return ["ir", "hud:forno", "forno:comb:" + str(forn[ent].get("fogo", "")), "forno:mat:" + str(ent), "forno:sai:" + k]
	var chave := k.trim_prefix("obra_") if k.begins_with("obra_") else k
	if not D.get("receitas", {}).has(chave): # receita pelo que ela faz (colar, short, peixe assado...)
		for r in D.get("receitas", {}):
			if str(D.receitas[r].faz) == k:
				chave = str(r)
				break
	return ["ir", "topo:mochila", "aba:criar", "vertudo:" + chave, "grupo:" + chave, "criar:" + chave, "b^Criar "]

func _aba_obra(k: String) -> String:
	var C: Dictionary = m.P.dados.get("construcoes", {}).get(k, {})
	return str(C.get("aba", "moveis"))

# ---------- a janela de cima ----------
# {raiz: Control/CanvasLayer onde procurar (null = a tela do jogo), tipo, esconde}
func _janela() -> Dictionary:
	if m.cinematica != null and m.cinematica.ativa:
		return {"esconde": true}
	if m.h.morto > 0.0 or (m.hud != null and m.hud.editando):
		return {"esconde": true}
	if m.criador != null and m.criador.aberto():
		return {"esconde": true}
	var cons = m.construcao
	if cons != null and cons.painel_qtd != null and cons.painel_qtd.visible:
		return {"raiz": cons.painel_qtd, "tipo": "qtd"}
	if m.reforco != null and m.reforco.aberta():
		return {"esconde": true}
	var mn = m.menu
	if mn != null:
		if mn._reset != null and is_instance_valid(mn._reset) and mn._reset.is_inside_tree():
			return {"raiz": mn._reset, "tipo": "confirma"}
		if mn._confirma != null and is_instance_valid(mn._confirma):
			return {"raiz": mn._confirma, "tipo": "confirma"}
		if mn.aberto():
			if mn.janela_aberta():
				return {"raiz": mn.janela, "tipo": "janela"}
			return {"raiz": mn.raiz, "tipo": "menu"}
	if m.leilao != null and m.leilao.aberto():
		return {"raiz": m.leilao.raiz, "tipo": "leilao"}
	if m.troca != null and m.troca.aberto():
		return {"esconde": true}
	if m.transporte != null and m.transporte._jan != null and is_instance_valid(m.transporte._jan):
		return {"raiz": m.transporte._jan, "tipo": "veiculo"}
	if m.conversa != null and m.conversa.aberto():
		return {"raiz": m.conversa.raiz, "tipo": "conversa"}
	if m.minimapa != null and m.minimapa.aberto:
		return {"tipo": "mapa"}
	if m.menu_topo != null and m.menu_topo.janela != null and m.menu_topo.janela.visible:
		return {"raiz": m.menu_topo.janela, "tipo": "topo"}
	if m.chat != null and m.chat.aberto():
		return {"esconde": true}
	if cons != null:
		if cons.painel_forno != null and cons.painel_forno.visible:
			return {"raiz": cons.painel_forno, "tipo": "forno"}
		if cons.painel_bau != null and cons.painel_bau.visible:
			return {"esconde": true}
	return {"tipo": "jogo"}

# ---------- procurar ----------
var _botoes: Array = [] # Buttons visíveis da janela de cima
var _metas := {} # meta "guia" -> [Control]
var _itens := {} # meta "guia_i" (lugar da mochila) -> Control (mochila do menu, leilão, fornalha)

func _procurar() -> void:
	_limpar()
	if not LIGADO:
		_chave = ""
		return
	var hi := _etapa()
	_tipo = ""
	if hi.is_empty():
		_chave = ""
		return
	var J := _janela()
	_tipo = str(J.get("tipo", ""))
	if J.get("esconde", false):
		_chave = ""
		return
	var lista := passos(hi)
	_botoes = []
	_metas = {}
	_itens = {}
	var tipo := str(J.get("tipo", ""))
	if J.get("raiz") != null:
		_varrer(J.raiz)
	elif tipo == "jogo":
		for r in [m.menu_topo.raiz if m.menu_topo else null, m.missao_ativa.cartao if m.missao_ativa else null, m.construcao.tela if m.construcao else null]:
			if r != null:
				_varrer(r)
	var fala := lista.find("hud:falar") # os botões da conversa com o NPC só valem depois do "Falar"
	for i in range(lista.size() - 1, -1, -1):
		var p := str(lista[i])
		# André 2026-11-12: no barquinho, o "Criar " do menu achava o "Criar pack" da conversa do Nico e travava nele
		if tipo == "conversa" and (p.begins_with("b:") or p.begins_with("b^")) and (fala < 0 or i < fala):
			continue
		if _achar(p, hi, tipo):
			if _chave != p:
				_chave = p
				_rolar_ate()
			return
	# o menu aberto no grupo errado (Status no lugar da Mochila): pisca o X para fechar
	if tipo == "menu":
		for p in lista:
			if str(p).begins_with("aba:") and m.menu.botoes_aba.has(str(p).substr(4)) and not m.menu.botoes_aba[str(p).substr(4)].visible:
				var x = _meta("fechar")
				if x != null:
					_alvo = x
					_chave = "fechar"
				else:
					_chave = ""
				return
	_chave = ""

func _varrer(n: Node) -> void:
	if n is Viewport or n is Node3D: # o boneco do menu, retratos: nada de botão lá dentro
		return
	if n is CanvasItem:
		if not n.visible:
			return
	elif n is CanvasLayer and not n.visible:
		return
	if n is Control:
		if n.has_meta("guia"):
			var g := str(n.get_meta("guia"))
			if not _metas.has(g):
				_metas[g] = []
			_metas[g].append(n)
		if n.has_meta("guia_i"):
			_itens[int(n.get_meta("guia_i"))] = n
		if n is Button:
			_botoes.append(n)
	for c in n.get_children():
		_varrer(c)

func _meta(g: String):
	var l: Array = _metas.get(g, [])
	for c in l:
		if is_instance_valid(c) and not c.is_queued_for_deletion():
			return c
	return null

func _meta_prefixo(pre: String):
	for g in _metas:
		if str(g).begins_with(pre):
			var c = _meta(str(g))
			if c != null:
				return c
	return null

func _botao_texto(t: String, prefixo: bool):
	for b in _botoes:
		if not is_instance_valid(b) or b.disabled:
			continue
		var s := str(b.text)
		if (prefixo and s.begins_with(t)) or (not prefixo and (s == t or s.begins_with(t + " "))):
			return b
	return null

# acha o toque p na tela agora; true = achou (e marcou o que pisca)
func _achar(p: String, hi: Dictionary, tipo: String) -> bool:
	var jogo := tipo == "jogo"
	if p.begins_with("b:") or p.begins_with("b^"):
		var b = _botao_texto(p.substr(2), p.begins_with("b^"))
		if b != null:
			_alvo = b
		return b != null
	if p.begins_with("m:"):
		var c = _meta(p.substr(2))
		if c != null:
			_alvo = c
		return c != null
	if p == "ir":
		return jogo and _achar_ir(str(hi.get("ev", "")))
	if p.begins_with("hud:"):
		return jogo and _achar_hud(p.substr(4))
	if p.begins_with("topo:"):
		if not jogo or m.menu_topo == null:
			return false
		var c = _meta("topo:seta") if m.menu_topo.recolhido else _meta(p)
		if c != null:
			_alvo = c
		return c != null
	if p.begins_with("aba:"):
		if tipo != "menu":
			return false
		var a := p.substr(4)
		var b = m.menu.botoes_aba.get(a)
		if b == null or not b.is_visible_in_tree() or m.menu.aba == a:
			return false
		_alvo = b
		return true
	if p.begins_with("item:"):
		return tipo == "menu" and m.menu.aba == "mochila" and _achar_item(p.substr(5))
	if p.begins_with("vertudo:"):
		if tipo != "menu" or m.menu.aba != "criar" or m.menu.est_criar == "" or _meta("grupo:" + _grupo(p.substr(8))) != null:
			return false
		var b = _botao_texto("Ver tudo", false)
		if b != null:
			_alvo = b
		return b != null
	if p.begins_with("grupo:"):
		if tipo != "menu" or m.menu.aba != "criar":
			return false
		var g := _grupo(p.substr(6))
		if g == "" or m.menu.grupos_abertos.get(g, false):
			return false
		var c = _meta("grupo:" + g)
		if c != null:
			_alvo = c
		return c != null
	if p.begins_with("criar:"):
		if tipo != "menu":
			return false
		var c = _meta(p)
		if c == null and _meta("criar_longe:" + p.substr(6)) != null:
			c = _meta("fechar") # longe da estação: fecha o menu e o "Ir" leva até ela
		if c != null:
			_alvo = c
		return c != null
	if p.begins_with("loja:"):
		var c = _meta(p)
		if c != null:
			_alvo = c
		return c != null
	if p.begins_with("cons:"):
		return _achar_cons(p.substr(5), tipo)
	if p.begins_with("forno:"):
		return tipo == "forno" and _achar_forno(p.substr(6))
	if p.begins_with("leilao:"):
		return tipo == "leilao" and _achar_leilao(p.substr(7))
	if p.begins_with("mapa:totem:"):
		return tipo == "mapa" and _achar_totem(p.substr(11))
	return false

# "Ir" da barrinha: só quando está longe do lugar da etapa e o herói não está indo sozinho
func _achar_ir(ev: String) -> bool:
	var ma = m.missao_ativa
	if ma == null or ma.cartao == null or not ma.cartao.visible or ma.ir_btn.disabled or m.heroi == null:
		return false
	if (m.rota != null and m.rota.ativo) or (m.hud != null and m.hud.em_combate):
		return false # já indo sozinho, ou brigando: não distrai
	var A: Dictionary = ma.alvo()
	if A.is_empty():
		return false
	var hp := Vector2(m.heroi.position.x, m.heroi.position.z)
	var perto: float = PERTO_NPC if str(A.get("npc", "")) != "" else (LONGE_CAMPO if ev in ["matar", "pistas", "item", "ter", "pesca"] else LONGE)
	if hp.distance_to(A.pos) <= perto:
		return false
	_alvo = ma.ir_btn
	return true

# botão redondo da HUD (desenhado, não é Control)
func _achar_hud(acao: String) -> bool:
	var H = m.hud
	if H == null or H.bloqueado:
		return false
	if acao == "painel": # o painel do herói abre o menu do personagem
		_ret = H.painel_rect()
		return true
	if H.modo_construcao or H.esconder_combate or H.caido:
		return false
	if acao == "montar" and m.montaria != null:
		return false # já montado
	var b: Dictionary = {}
	if acao == "hab": # a primeira habilidade da barra (treino)
		for i in 6:
			var x: Dictionary = H.botao("hab%d" % i)
			if not x.is_empty() and str(x.icone) != "" and not x.travado and not x.oculto:
				b = x
				break
	else:
		b = H.botao(acao)
	if b.is_empty() or b.oculto:
		return false
	var c: Vector2 = H._centro(b)
	_circ = Vector3(c.x, c.y, float(b.raio))
	return true

# célula da mochila (menu > Mochila) que serve para a etapa; se ela está noutra página, a aba da página
func _achar_item(filtro: String) -> bool:
	var P = m.P
	var moch: Array = P.prog.mochila
	var serve := func(i: int) -> bool:
		var it = moch[i]
		if it == null:
			return false
		var f := filtro.split(":")
		match f[0]:
			"equip":
				return P.eh_equip(it) and not it.get("cad", false)
			"evoluir":
				var alvo := int(f[1]) if f.size() > 1 else 1
				return P.eh_equip(it) and int(it.r) < alvo and int(it.r) < P.dados.raridades.size() - 1
			"reforco":
				return P.eh_equip(it) and int(it.get("e", 0)) < P.reforco_max(it)
			"arma":
				return P.eh_equip(it) and str(P.dados.itens[it.k].get("lugar", "")) in ["espada", "cajado"] and int(it.r) >= (int(f[1]) if f.size() > 1 else 0)
			"k":
				return str(it.k) == (f[1] if f.size() > 1 else "")
			"vende":
				return not it.get("cad", false) and not m.menu.marcados.has(i) and not P.eh_equip(it)
		return false
	# evoluir: primeiro a peça uma raridade abaixo da pedida (sobe direto para ela)
	var melhor := -1
	var pref := -1
	for i in moch.size():
		if serve.call(i):
			if melhor < 0:
				melhor = i
			if filtro.begins_with("evoluir") and int(moch[i].r) == int(filtro.split(":")[1]) - 1 and pref < 0:
				pref = i
	if pref >= 0:
		melhor = pref
	if melhor < 0:
		return false
	if m.menu.sel_mochila == melhor and not m.menu.vendendo:
		return false # já escolhida: o botão do cartão é o próximo
	var c = _itens.get(melhor)
	if c != null and is_instance_valid(c):
		_alvo = c
		return true
	var pag: int = melhor / maxi(1, int(P.dados.mochila)) # está noutra página
	var bp = _meta("pag:%d" % pag)
	if bp != null:
		_alvo = bp
		return true
	return false

# grupo da aba Criar onde a coisa está (Ferramentas, Materiais, Armas...)
func _grupo(k: String) -> String:
	if _grupo_de.has(k):
		return _grupo_de[k]
	var g := ""
	for gr in Menu.GRUPOS_CRIAR:
		if str(gr[0]) == "melhorar":
			continue
		for e in m.menu.itens_criar(str(gr[0])):
			if str(e.k) == k:
				g = str(gr[0])
				break
		if g != "":
			break
	_grupo_de[k] = g
	return g

# modo construção (martelo): aba, peça, Criar, Colocar; fazenda: ação, Marcar, Salvar; compra do terreno
func _achar_cons(p: String, tipo: String) -> bool:
	var cons = m.construcao
	if cons == null or tipo != "jogo":
		return false
	if p == "comprar":
		if cons.comprando and cons.b_comprar != null and cons.b_comprar.is_visible_in_tree():
			_alvo = cons.b_comprar
			return true
		return false
	if not cons.ativo:
		return false
	var f := p.split(":")
	match f[0]:
		"aba":
			var a := p.substr(4)
			if cons.aba == a or not cons._botoes_abas.has(a):
				return false
			_alvo = cons._botoes_abas[a]
		"slot":
			var k := p.substr(5)
			var sel: String = str(cons.sel) if cons.sel != "plantar" else "plantar:" + str(cons.semente)
			if k == "plantar:": # qualquer semente
				if str(cons.sel) == "plantar":
					return false
				_alvo = _meta_prefixo("cons:plantar:")
				return _alvo != null
			if sel == k:
				return false
			_alvo = _meta("cons:" + k)
		"criar":
			var k := p.substr(6)
			if str(cons.sel) != k or m.P.contar("obra_" + k) > 0 or not cons.b_criar.is_visible_in_tree():
				return false
			_alvo = cons.b_criar
		"ok":
			var k := p.substr(3)
			if str(cons.sel) != k or m.P.contar("obra_" + k) < 1 or not cons.b_ok.is_visible_in_tree():
				return false
			_alvo = cons.b_ok
		"marcar":
			if str(cons.sel) != f[1] or not cons.b_ok.is_visible_in_tree() or (cons.plano != null and cons.plano.quantos() > 0):
				return false
			_alvo = cons.b_ok
		"salvar":
			if cons.b_salvar == null or not cons.b_salvar.is_visible_in_tree():
				return false
			_alvo = cons.b_salvar
		_:
			return false
	return _alvo != null

# fornalha (a do terreno ou o forninho da ferraria): combustível, material e o que ficou pronto
func _achar_forno(p: String) -> bool:
	var cons = m.construcao
	if cons == null or cons.forno_tipo == "fogao":
		return false
	var F: Dictionary = cons.forno
	var f := p.split(":")
	var moch: Array = m.P.prog.mochila
	match f[0]:
		"sai":
			var s = F.get("sai")
			if s == null or str(s.get("k", "")) != (f[1] if f.size() > 1 else ""):
				return false
			_alvo = _meta("forno:lugar:sai")
		"mat":
			if F.get("ent") != null:
				return false
			for i in _itens:
				if moch[i] != null and str(moch[i].k) == f[1]:
					_alvo = _itens[i]
					break
			if f[1] == "lenha" and _alvo != null and cons.forno_alvo == "comb": # lenha vira carvão: o lugar do material primeiro
				_alvo = _meta("forno:lugar:ent")
		"comb":
			if F.get("comb") != null or float(F.get("fogo", 0.0)) > 0.0:
				return false
			var fogo: String = f[1] if f.size() > 1 else ""
			var comb: Dictionary = m.P.dados.get("fornalha", {}).get("combustivel", {})
			for i in _itens:
				var it = moch[i]
				if it == null or not comb.has(str(it.k)) or (fogo != "" and str(it.k) != fogo):
					continue
				_alvo = _itens[i]
				if str(it.k) == "lenha" and cons.forno_alvo != "comb": # a lenha iria para o material: toca no combustível antes
					_alvo = _meta("forno:lugar:comb")
				break
		_:
			return false
	return _alvo != null

# Casa do Comércio (leilão do Otávio): aba, item da mochila para anunciar
func _achar_leilao(p: String) -> bool:
	var L = m.leilao
	if p.begins_with("aba:"):
		var a := p.substr(4)
		if L.aba == a:
			return false
		_alvo = _meta("leilao:aba:" + a)
		return _alvo != null
	if p == "item":
		if L.sel >= 0:
			return false
		var moch: Array = m.P.prog.mochila
		for i in _itens:
			var it = moch[i] if i < moch.size() else null
			if it != null and not it.get("cad", false) and not m.P.eh_equip(it):
				_alvo = _itens[i]
				return true
		for i in _itens: # sem material: qualquer item sem cadeado
			var it = moch[i] if i < moch.size() else null
			if it != null and not it.get("cad", false):
				_alvo = _itens[i]
				return true
	return false

# mapa do totem: o totem de destino (ou o "Teleportar" ao lado dele, quando já escolhido)
func _achar_totem(k: String) -> bool:
	var mm = m.minimapa
	if mm == null or mm.totem_de.is_empty():
		return false
	var r: Rect2 = mm.guia_totem(k)
	if not r.has_area():
		return false
	_ret = r
	return true

# o que pisca está numa lista que rola e ficou fora da vista: rola até ele (só quando o alvo muda)
func _rolar_ate() -> void:
	if _alvo == null or not is_instance_valid(_alvo):
		return
	var p: Node = _alvo.get_parent()
	while p != null:
		if p is ScrollContainer:
			var sc: ScrollContainer = p
			var r: Rect2 = _alvo.get_global_rect()
			if not sc.get_global_rect().encloses(r):
				sc.ensure_control_visible.call_deferred(_alvo)
			return
		p = p.get_parent()

# ---------- desenho ----------
func _desenhar() -> void:
	var t := Time.get_ticks_msec() / 1000.0
	var pulso := 0.5 + 0.5 * sin(t * TAU * 1.4) # pisca ~1,4 vez por segundo
	var onda := fmod(t, 1.1) / 1.1 # anel que abre e some
	if _circ.z > 0.0:
		var c := Vector2(_circ.x, _circ.y)
		var r := _circ.z
		desenho.draw_circle(c, r, Color(COR, 0.24 * pulso))
		desenho.draw_arc(c, r + 3.0, 0.0, TAU, 48, Color(COR, 0.6 + 0.4 * pulso), 4.5, true)
		desenho.draw_arc(c, r + 5.0 + 18.0 * onda, 0.0, TAU, 48, Color(COR, 0.8 * (1.0 - onda)), 3.0, true)
		return
	var ret := _ret_alvo()
	var raio := 14.0
	if _alvo != null and is_instance_valid(_alvo):
		raio = clampf(minf(ret.size.x, ret.size.y) * 0.25, 8.0, 18.0)
	if not ret.has_area():
		return
	_sb.bg_color = Color(COR, 0.24 * pulso)
	_sb.border_color = Color(COR, 0.6 + 0.4 * pulso)
	_sb.set_corner_radius_all(int(raio))
	desenho.draw_style_box(_sb, ret.grow(3.0))
	_sb2.border_color = Color(COR, 0.8 * (1.0 - onda))
	_sb2.set_corner_radius_all(int(raio + 6.0))
	desenho.draw_style_box(_sb2, ret.grow(6.0 + 16.0 * onda))

# as duas molduras do brilho (feitas uma vez; só a cor e o canto mudam)
var _sb: StyleBoxFlat
var _sb2: StyleBoxFlat
static func _moldura(meio: bool, borda: int) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.draw_center = meio
	sb.set_border_width_all(borda)
	sb.anti_aliasing = true
	return sb

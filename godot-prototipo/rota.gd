extends Node
# "Ir para" do mapa (pedido do André 2026-11-03): no mapa completo o jogador toca num lugar, aparece o botão "Ir para"
# e o herói vai sozinho até lá SEMPRE pela estrada, mesmo que exista caminho mais curto pelo meio do mato. Ele só sai
# da estrada no fim, do ponto da estrada mais perto do lugar marcado até o lugar. Só mexer no joystick cancela
# (André 2026-11-06): abrir mochila, mapa, chat ou qualquer menu não para; golpe, skill, conversa com NPC e modo
# construção só pausam e a viagem segue depois. Vale online e sem internet: o herói anda como se fosse o joystick, então
# o servidor recebe as posições de sempre (online.gd "pos") e confere igual.
#
# A rede de estradas são os caminhos de terra do mapa (mundo.caminhos = shared/dados.js CAMINHOS: ruas da vila, saída
# do leste, estrada principal da mata e as trilhas que entram nas clareiras), picados em pontos a cada 2 m e ligados
# nas junções. O caminho mais curto POR ELAS sai do AStar2D do Godot.

const PASSO := 2.0 # m entre os pontos da rede
const JUNTA := 3.2 # m: a ponta de um caminho liga no outro caminho se estiver até aqui dele
const OLHA := 2.4 # m: o herói mira no próximo ponto quando chega a esta distância do atual (faz a curva macia)
const CHEGOU := 0.7 # m do lugar marcado: chegou
const PERTO := 8.0 # m: lugar marcado tão perto que não vale ir até a estrada (vai direto)
const CONFERE := 1.5 # s: a cada tanto tempo precisa ter andado (casa, árvore ou gente no meio)

var m # main.gd
var astar := AStar2D.new()
var ativo := false
var caminho := PackedVector2Array() # rota de agora: pontos da estrada e, por último, o lugar marcado
var i := 0 # ponto da rota para onde o herói está indo
var _t := 0.0
var _p0 := Vector2.ZERO
var olha := OLHA # dentro de casa (ir até uma estação) mira mais perto, para não cortar o canto da porta

# Montado no "Ir para" (André 2026-11-09: "sempre que eu usar o autopath já entra na montaria; se for cruzar algum rio
# ele sai da montaria e nada; se for cruzar continente ele para, não deixa ir"). Só nas viagens do mapa (viagem = true);
# ir até uma estação dentro de casa segue a pé. Rio, lago e mar vêm da grade do mundo (terreno.gd agua_no_caminho,
# terra_id, mar_fundo), nada preso ao mapa de hoje.
const AGUA_FRENTE := 3.0 # m à frente na rota: água aqui já desce do lobo (entra na água a pé e nada)
const SECO_MONTA := 0.8 # s em terra seca, andando, para subir de novo no lobo (sem pisca-pisca na margem)
const AMOSTRA_MAR := 3.0 # m entre as amostras da rota na conferência do mar
var viagem := false # viagem do mapa: vai no lobo
var a_pe := false # o jogador desceu do lobo no botão durante a viagem: respeita e segue a pé
var _seco := 0.0
var _confere_agua := 0.0

func _init(principal) -> void:
	m = principal

func _ready() -> void:
	_montar()

func _novo(p: Vector2) -> int:
	var id := astar.get_available_point_id()
	astar.add_point(id, p)
	return id

func _montar() -> void:
	var linhas: Array = m.mundo.get("caminhos", [])
	if linhas.is_empty() and m.mundo.has("estrada"): # mundo.json antigo: só a estrada principal
		linhas = [{"pontos": m.mundo.estrada}]
	if m.terreno != null: # FASE 3: as estradas do mundo grande (shared/mundo.js) também entram na rede
		linhas = linhas.duplicate()
		for e in m.terreno.mundo_g.get("estradas", []):
			linhas.append({"pontos": e.get("curva", [])})
	var por_linha: Array = []
	for L in linhas:
		var pts: Array = L.get("pontos", [])
		var ids: Array = []
		for k in pts.size():
			var a := Vector2(float(pts[k][0]), float(pts[k][1]))
			if k > 0:
				var b := Vector2(float(pts[k - 1][0]), float(pts[k - 1][1]))
				var n: int = max(1, ceili(b.distance_to(a) / PASSO))
				for s in range(1, n):
					ids.append(_novo(b.lerp(a, float(s) / n)))
			ids.append(_novo(a))
		for k in range(1, ids.size()):
			astar.connect_points(ids[k - 1], ids[k])
		if not ids.is_empty():
			por_linha.append(ids)
	_ligar(por_linha)

# Junções da rede (2026-11-10, André: "o mapa inteiro tem que seguir essa regra"). Antes só a ponta de um caminho a até
# JUNTA m de outro ligava: a estrada sul (e_sul) e a leste (e_leste) do mundo grande começam a 10 e 13 m do fim das
# ruas da vila, então a rede ficava em pedaços e o "Ir para" das partes novas ia em linha reta pelo mato. Agora:
#  1. ponta de caminho liga no ponto mais perto de outro caminho até JUNTA m (como antes);
#  2. dois caminhos que se cruzam no meio ligam onde passam a até CRUZA m um do outro;
#  3. pedaços que ainda ficaram soltos na mesma terra se emendam pela ponta mais perto, até EMENDA m, sem passar no
#     mar (o menor vão primeiro). Nada preso ao mapa de hoje: vale para qualquer estrada nova que entrar no mundo.
# Tudo por uma grade de CELULA m (antes comparava cada ponta com todos os pontos: bem mais lento ao abrir o jogo).
const CRUZA := 1.6
const EMENDA := 30.0
const CELULA := 8.0
var _grade := {} # Vector2i -> [[id, linha], ...]

func _cel(p: Vector2) -> Vector2i:
	return Vector2i(floori(p.x / CELULA), floori(p.y / CELULA))

# ponto de outra linha (ou de outro pedaço, com pedaco) mais perto de p até raio m; -1 se nenhum
func _perto(p: Vector2, raio: float, linha: int, pedaco := {}, meu := -1) -> int:
	var c := _cel(p)
	var r := ceili(raio / CELULA)
	var melhor := -1
	var md := raio
	for gx in range(c.x - r, c.x + r + 1):
		for gz in range(c.y - r, c.y + r + 1):
			for e in _grade.get(Vector2i(gx, gz), []):
				if e[1] == linha or (meu >= 0 and _raiz(pedaco, e[0]) == meu):
					continue
				var d: float = p.distance_to(astar.get_point_position(e[0]))
				if d < md:
					md = d
					melhor = e[0]
	return melhor

func _raiz(pai: Dictionary, a: int) -> int:
	while pai.get(a, a) != a:
		pai[a] = pai.get(pai[a], pai[a])
		a = pai[a]
	return a

func _unir(pai: Dictionary, a: int, b: int) -> void:
	pai[_raiz(pai, a)] = _raiz(pai, b)

func _ligar(por_linha: Array) -> void:
	_grade.clear()
	for li in por_linha.size():
		for id in por_linha[li]:
			var c := _cel(astar.get_point_position(id))
			if not _grade.has(c):
				_grade[c] = []
			_grade[c].append([id, li])
	var pai := {}
	for li in por_linha.size():
		var ids: Array = por_linha[li]
		for id in ids:
			pai[id] = ids[0]
	# 1. pontas
	for li in por_linha.size():
		for ponta in [por_linha[li][0], por_linha[li][-1]]:
			var pp: Vector2 = astar.get_point_position(ponta)
			var ja := {}
			for e in _vizinhos(pp, JUNTA):
				if e[1] != li:
					ja[e[1]] = true
			for lj in ja: # como antes: liga no ponto mais perto de CADA outro caminho
				var melhor := _perto_na_linha(pp, JUNTA, lj)
				if melhor >= 0 and melhor != ponta:
					astar.connect_points(ponta, melhor)
					_unir(pai, ponta, melhor)
	# 2. cruzamentos no meio
	for li in por_linha.size():
		for id in por_linha[li]:
			var o := _perto(astar.get_point_position(id), CRUZA, li)
			if o >= 0 and not astar.are_points_connected(id, o):
				astar.connect_points(id, o)
				_unir(pai, id, o)
	# 3. emendas dos pedaços soltos (menor vão primeiro)
	var vaos: Array = []
	for li in por_linha.size():
		for ponta in [por_linha[li][0], por_linha[li][-1]]:
			var pp: Vector2 = astar.get_point_position(ponta)
			var o := _perto(pp, EMENDA, li, pai, _raiz(pai, ponta))
			if o >= 0:
				vaos.append([pp.distance_to(astar.get_point_position(o)), ponta, o])
	vaos.sort_custom(func(a, b): return a[0] < b[0])
	for v in vaos:
		if _raiz(pai, v[1]) == _raiz(pai, v[2]) or not _emenda_ok(astar.get_point_position(v[1]), astar.get_point_position(v[2])):
			continue
		astar.connect_points(v[1], v[2])
		_unir(pai, v[1], v[2])
	_grade.clear()

func _vizinhos(p: Vector2, raio: float) -> Array:
	var c := _cel(p)
	var r := ceili(raio / CELULA)
	var out: Array = []
	for gx in range(c.x - r, c.x + r + 1):
		for gz in range(c.y - r, c.y + r + 1):
			for e in _grade.get(Vector2i(gx, gz), []):
				if p.distance_to(astar.get_point_position(e[0])) < raio:
					out.append(e)
	return out

func _perto_na_linha(p: Vector2, raio: float, linha: int) -> int:
	var melhor := -1
	var md := raio
	for e in _vizinhos(p, raio):
		if e[1] != linha:
			continue
		var d: float = p.distance_to(astar.get_point_position(e[0]))
		if d < md:
			md = d
			melhor = e[0]
	return melhor

# emenda só na mesma terra e sem passar pelo mar
func _emenda_ok(a: Vector2, b: Vector2) -> bool:
	var T = m.terreno
	if T == null or T.mundo_g.is_empty():
		return true
	if T.terra_id(a.x, a.y) != T.terra_id(b.x, b.y):
		return false
	var n: int = max(1, ceili(a.distance_to(b) / 2.0))
	for s in range(n + 1):
		var q: Vector2 = a.lerp(b, float(s) / n)
		if T.mar_fundo(q.x, q.y):
			return false
	return true

func _heroi() -> Vector2:
	return Vector2(m.heroi.position.x, m.heroi.position.z)

# o lugar marcado vai para dentro da parte andável do mapa (tocar fora da mata cai na beirada)
func ajustar(alvo: Vector2) -> Vector2:
	if m.mov and m.mov.has_method("limitar_ao_mapa"):
		return m.mov.limitar_ao_mapa(alvo.x, alvo.y, 0.6)
	return alvo

# A névoa (André 2026-11-11, "Ir para" da missão ativa): a rota não passa por estrada que está numa região ainda fechada
# (nevoa.gd). Os pontos da rede dentro da névoa ficam desligados no AStar; refaz só quando uma missão abre região.
var _nevoa_p := -1
func _desligar_nevoa() -> void:
	var nv = m.nevoa
	if nv == null:
		return
	var p: int = nv.feitas()
	if p == _nevoa_p:
		return
	_nevoa_p = p
	for id in astar.get_point_ids():
		var q: Vector2 = astar.get_point_position(id)
		astar.set_point_disabled(id, nv.fechado(q.x, q.y))

# rota pela estrada até o lugar (o último ponto é o lugar)
func planejar(alvo: Vector2) -> PackedVector2Array:
	alvo = ajustar(alvo)
	_desligar_nevoa()
	var h := _heroi()
	var r := PackedVector2Array()
	if h.distance_to(alvo) < PERTO or astar.get_point_count() == 0:
		r.append(alvo)
		return r
	var a := astar.get_closest_point(h)
	var b := astar.get_closest_point(alvo)
	r = astar.get_point_path(a, b)
	# já está na estrada um pouco à frente do ponto mais perto: não volta para trás
	if r.size() >= 2 and h.distance_to(r[1]) < r[0].distance_to(r[1]):
		r.remove_at(0)
	# o lugar fica entre os dois últimos pontos: sai da estrada antes, sem ir até o fim e voltar
	if r.size() >= 2 and alvo.distance_to(r[r.size() - 2]) < r[r.size() - 1].distance_to(r[r.size() - 2]):
		r.remove_at(r.size() - 1)
	r.append(alvo)
	return r

# metros da rota a partir do herói (para o botão mostrar)
func comprimento(r: PackedVector2Array, de := 0) -> float:
	if r.is_empty():
		return 0.0
	var t: float = _heroi().distance_to(r[min(de, r.size() - 1)])
	for k in range(de + 1, r.size()):
		t += r[k - 1].distance_to(r[k])
	return t

# por que essa rota não dá ("" = dá): atravessar o mar para outro continente ou para a ilha só de barco ou navio
func bloqueio(r: PackedVector2Array) -> String:
	var T = m.terreno
	if T == null or r.is_empty() or T.mundo_g.is_empty():
		return ""
	var h := _heroi()
	var de: int = T.terra_id(h.x, h.y)
	var ate: int = T.terra_id(r[r.size() - 1].x, r[r.size() - 1].y)
	if de > 0 and ate > 0 and de != ate:
		return "Fica em outro continente: só de barco ou navio"
	var a := h
	for p in r:
		var n: int = max(1, ceili(a.distance_to(p) / AMOSTRA_MAR))
		for s in range(1, n + 1):
			var q: Vector2 = a.lerp(p, float(s) / n)
			if T.mar_fundo(q.x, q.y):
				return "O caminho passa pelo mar: só de barco ou navio"
		a = p
	return ""

func ir(r: PackedVector2Array, aviso := "Indo pela estrada", olha_ := OLHA, viagem_ := false) -> void:
	if r.is_empty() or m.heroi == null:
		return
	if viagem_:
		var porque := bloqueio(r)
		if porque != "":
			parar()
			m.hud.aviso(porque)
			return
	viagem = viagem_
	a_pe = false
	_seco = SECO_MONTA # a viagem já começa no lobo (se der)
	_confere_agua = 0.0
	caminho = r
	i = 0
	ativo = true
	_t = 0.0
	_p0 = _heroi()
	olha = olha_
	if m.conversa:
		m.conversa.indo = null
	if m.trabalho and m.trabalho.coletando != null:
		m.trabalho.parar(true)
	if aviso != "":
		m.hud.aviso(aviso)

func parar(aviso := "") -> void:
	if not ativo:
		return
	ativo = false
	viagem = false
	caminho = PackedVector2Array()
	if aviso != "":
		m.hud.aviso(aviso)

func destino():
	return caminho[caminho.size() - 1] if ativo and caminho.size() > 0 else null

# conversando com um NPC ou no modo construção: o herói fica parado e a viagem continua quando fechar
func pausado() -> bool:
	return (m.conversa != null and m.conversa.npc != null) or (m.construcao != null and m.construcao.camera_livre())

# para onde o herói anda sozinho (main.direcao_joystick), ou zero
func direcao_auto() -> Vector3:
	if not ativo or caminho.is_empty() or pausado():
		return Vector3.ZERO
	var p := _heroi()
	var ultimo := caminho.size() - 1
	while i < ultimo and p.distance_to(caminho[i]) < olha:
		i += 1
	var d: Vector2 = caminho[i] - p
	if d.length() < 0.05:
		return Vector3.ZERO
	# trota (o máximo do joystick; com a disparada ligada corre) e chega andando no lugar marcado
	var forca: float = 0.55 if i == ultimo and d.length() < 3.0 else 1.0
	return Vector3(d.x, 0.0, d.y).normalized() * forca

func _process(dt: float) -> void:
	if not ativo or m.heroi == null:
		return
	# só o joystick tira do "Ir para" (André 2026-11-06): mochila, mapa, chat, menus e janelas ficam abertos
	# com o herói indo. Morrer também para, e tocar num NPC longe troca o destino (o herói vai até ele).
	if m.hud.mover.length() > 0.15 or m.h.morto > 0.0 or (m.conversa and m.conversa.indo != null):
		parar()
		return
	if pausado() or not m.acao.is_empty(): # golpe, rolamento ou conversa: espera e depois continua
		_t = 0.0
		_p0 = _heroi()
		return
	if viagem:
		_montaria(dt)
	var p := _heroi()
	if i >= caminho.size() - 1 and p.distance_to(caminho[caminho.size() - 1]) <= CHEGOU:
		parar("Chegou")
		return
	_t += dt
	if _t >= CONFERE:
		if p.distance_to(_p0) < 0.6: # parado no mesmo lugar: algo no meio
			parar("Cheguei o mais perto que deu" if i >= caminho.size() - 1 else "Tem algo no caminho")
			return
		_t = 0.0
		_p0 = p

# água logo ali na rota: o herói, o ponto da frente e AGUA_FRENTE m adiante na direção dele
func _agua_a_frente() -> bool:
	var T = m.terreno
	if T == null or caminho.is_empty():
		return false
	var p := _heroi()
	if T.agua_no_caminho(p.x, p.y):
		return true
	var alvo: Vector2 = caminho[min(i, caminho.size() - 1)]
	var d := alvo - p
	if d.length() < 0.05:
		return false
	var q: Vector2 = p + d.normalized() * minf(AGUA_FRENTE, d.length())
	return T.agua_no_caminho(q.x, q.y) or (d.length() < AGUA_FRENTE and T.agua_no_caminho(alvo.x, alvo.y))

# dá para subir no lobo agora (as mesmas regras do botão e do servidor: Simulacao.montar e motivoCarga)
func _pode_montar() -> bool:
	if m.mov == null or m.mov.esc != null or not m.mov.chao or m.mov.arrancada != null or not m.mov.veiculo.is_empty():
		return false
	if not m.acao.is_empty() or m._nadando or m._saindo_agua > 0.0 or m.h.morto > 0.0:
		return false
	if m.nevoa and not m.nevoa.liberado("lobo", true): # lobo ainda não amansado (missão): o "Ir para" vai a pé
		return false
	if m.P and m.P.prog.get("pack") is Dictionary: # pack nas costas não monta (Quimera)
		return false
	if m.trabalho and (m.trabalho.coletando != null or m.trabalho.em_combate()):
		return false
	return m.tempo >= m._guarda_ate # acabou de golpear: espera a guarda baixar

# a cada quadro da viagem: água à frente desce do lobo (ele entra a pé e nada); seco de novo, sobe
func _montaria(dt: float) -> void:
	_confere_agua -= dt
	if _confere_agua > 0.0:
		return
	_confere_agua = 0.15
	var agua := _agua_a_frente()
	if m.montaria != null:
		_seco = 0.0
		if agua:
			m.montar_lobo(false)
			m.hud.aviso("Água no caminho: atravessando a nado")
		return
	if a_pe or agua or m._nadando:
		_seco = 0.0
		return
	if not _pode_montar():
		return
	_seco += 0.15
	if _seco >= SECO_MONTA:
		m.montar_lobo(true)

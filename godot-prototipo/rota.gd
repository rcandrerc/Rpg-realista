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
	# junções: cada ponta de caminho liga no ponto mais perto dos outros caminhos (as trilhas saem do meio da estrada)
	for li in por_linha.size():
		for ponta in [por_linha[li][0], por_linha[li][-1]]:
			var pp: Vector2 = astar.get_point_position(ponta)
			for lj in por_linha.size():
				if lj == li:
					continue
				var melhor := -1
				var md := JUNTA
				for id in por_linha[lj]:
					var d: float = pp.distance_to(astar.get_point_position(id))
					if d < md:
						md = d
						melhor = id
				if melhor >= 0 and melhor != ponta:
					astar.connect_points(ponta, melhor)

func _heroi() -> Vector2:
	return Vector2(m.heroi.position.x, m.heroi.position.z)

# o lugar marcado vai para dentro da parte andável do mapa (tocar fora da mata cai na beirada)
func ajustar(alvo: Vector2) -> Vector2:
	if m.mov and m.mov.has_method("limitar_ao_mapa"):
		return m.mov.limitar_ao_mapa(alvo.x, alvo.y, 0.6)
	return alvo

# rota pela estrada até o lugar (o último ponto é o lugar)
func planejar(alvo: Vector2) -> PackedVector2Array:
	alvo = ajustar(alvo)
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

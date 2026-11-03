extends RefCounted
# Como o herói anda, pula, colide e escala: a mesma conta da simulação do servidor (shared/simulacao.js:
# moverJogador, colidir, passoVertical, tentarEscalar, passoEscalada...). Assim o servidor aceita a posição
# que o celular manda (Simulacao.posicaoCliente) e o jogo solo se comporta igual ao online.

var T # terreno.gd
var m: Dictionary # mundo.json
var x := 0.0
var y := 0.0
var z := 0.0
var ry := 0.0
var vy := 0.0
var chao := true
var pulos := 0
var pulo_t := 9.0
var mortal := 0.0
var pouso := 0.0
var arrancada = null # {t, dx, dz}
var arrancada_no_ar := false
var bloqueado := false
var empurra := 0.0
var esc = null # escalando: {parado, clip, escada}
var anim := "" # animação de escalada pedida agora ("" = a do chão, escolhida pelo jogo)
var outros: Array = [] # posições de quem não deixa passar (inimigos, NPCs)
var _depois := ""
var clip_seq := 0 # muda a cada pedaço de escalada novo (para recomeçar a animação mesmo se for a mesma) # o que fazer quando o pedaço de escalada acaba
# inércia: velocidade de verdade no chão (m/s), que chega aos poucos na que o joystick pede
var vx := 0.0
var vz := 0.0
var fora_do_chao := 0.0 # segundos desde que saiu do chão sem pular (coyote time: ainda dá para pular)
var ry_mira = null # virar para o alvo do golpe aos poucos (em vez de estalar)
var giro := 0.0 # velocidade de giro do corpo (rad/s), para inclinar nas curvas
var manobra = null # andando pelo caminho do quadril de uma animação (freada, meia-volta): {nome, t, r, esc, ry0, px, pz}
var altura_quadril := 0.9 # metros (main.gd mede no herói): o caminho do quadril vem em alturas de quadril
var _correu := 0.0 # segundos correndo rápido (freada de verdade só depois de embalar)
var vel_max := 99.0 # sem fôlego (estamina zerada): só trota (trabalho.gd)
# 3 velocidades (André 2026-11-03): o joystick só anda (1) e trota (2); a corrida de 5,4 m/s, a que gasta estamina,
# só com o botão de disparada ligado (hud.gd "disparada", main.gd ligar_disparada). Sem fôlego ela desliga sozinha.
var disparada := false
var pousou := 0.0 # força do pouso que acabou de acontecer (0 a 1); o main.gd lê, faz a câmera afundar e zera

var mata := {} # árvores da mata (mundo.mata) numa grade de 6 m: só confere as de perto (como Simulacao.pertoNaMata)
var obst := {} # mundo.obstaculos na mesma grade de 6 m (cada um em toda casa que ele toca, com 1 m de folga)

func _init(terreno, mundo: Dictionary) -> void:
	T = terreno
	m = mundo
	for a in m.get("mata", []):
		var k := Vector2i(floori(float(a.x) / 6.0), floori(float(a.z) / 6.0))
		if not mata.has(k):
			mata[k] = []
		mata[k].append({"x": float(a.x), "z": float(a.z), "r": 0.32 * float(a.s)})
	for o in m.get("obstaculos", []):
		var r: float = float(o.r) + 1.0
		for i in range(floori((float(o.x) - r) / 6.0), floori((float(o.x) + r) / 6.0) + 1):
			for j in range(floori((float(o.z) - r) / 6.0), floori((float(o.z) + r) / 6.0) + 1):
				var k := Vector2i(i, j)
				if not obst.has(k):
					obst[k] = []
				obst[k].append(o)

# árvores da mata nas 9 casas da grade em volta de (px, pz)
func perto_na_mata(px: float, pz: float) -> Array:
	var l: Array = []
	if mata.is_empty():
		return l
	var i := floori(px / 6.0)
	var j := floori(pz / 6.0)
	for a in range(i - 1, i + 2):
		for b in range(j - 1, j + 2):
			var c = mata.get(Vector2i(a, b))
			if c != null:
				l.append_array(c)
	return l

# obstáculos (casas, pedras, poço...) que podem estar a até r + 1 m de (px, pz): só os da casa da grade do ponto.
# Desempenho (2026-11-03): os monstros das clareiras conferiam os 110 obstáculos do mapa todo, um por um, a cada quadro
const _NADA := []
func perto_obstaculos(px: float, pz: float) -> Array:
	return obst.get(Vector2i(floori(px / 6.0), floori(pz / 6.0)), _NADA)

func posicao() -> Vector3:
	return Vector3(x, y, z)

func por_em(p: Vector3) -> void:
	x = p.x
	y = T.altura(p.x, p.z)
	z = p.z
	vy = 0.0
	chao = true
	esc = null
	arrancada = null
	vx = 0.0
	vz = 0.0
	ry_mira = null
	manobra = null

# velocidade no chão (m/s): a locomoção mistura parada, andar e corrida por ela
func velocidade() -> float:
	return Vector2(vx, vz).length()

# virar para o alvo em ~0,1 s (golpe, skill); quem precisa da direção já usa ry_mira
func mirar(r: float) -> void:
	ry_mira = r

func direcao() -> float:
	return ry_mira if ry_mira != null else ry

func ad(a: float, b: float) -> float:
	return atan2(sin(a - b), cos(a - b))

# ---------- andar e colidir ----------
func colidir() -> void:
	for k in m.obstaculos + perto_na_mata(x, z):
		if k.has("alto") and y > float(k.alto):
			continue # por cima (esteio da ferraria visto do telhado)
		var dx: float = x - k.x
		var dz: float = z - k.z
		var d := sqrt(dx * dx + dz * dz)
		var mm: float = k.r + 0.35
		if d < mm and d > 0:
			x = k.x + dx / d * mm
			z = k.z + dz / d * mm
	for o in outros:
		if abs(o.y - y) > 1.0:
			continue
		var dx: float = x - o.x
		var dz: float = z - o.z
		var d := sqrt(dx * dx + dz * dz)
		if d < 0.7 and d > 0:
			x = o.x + dx / d * 0.7
			z = o.z + dz / d * 0.7
	var lim := limitar_ao_mapa(x, z, 2.2) # vila, passagem e clareira de fora (shared/mapa.js limitarAoMapa)
	x = lim.x
	z = lim.y

# mesma conta de shared/mapa.js: círculos (m.areas) ligados por corredores (cápsulas); sem areas, o círculo de raio m.raio
func _no_segmento(c: Dictionary, px: float, pz: float) -> Vector2:
	var a := Vector2(float(c.a[0]), float(c.a[1]))
	var b := Vector2(float(c.b[0]), float(c.b[1]))
	var v := b - a
	var t: float = clamp((Vector2(px, pz) - a).dot(v) / max(0.0001, v.length_squared()), 0.0, 1.0)
	return a + v * t

# raio da área na direção ang (shared/mapa.js raioNaDirecao): círculo r, ou elipse rx × rz com ondas (lobos)
static func raio_na_direcao(a: Dictionary, ang: float) -> float:
	if not a.has("rx"):
		return float(a.r)
	var c: float = cos(ang) / float(a.rx)
	var s: float = sin(ang) / float(a.rz)
	var r: float = 1.0 / sqrt(c * c + s * s)
	for l in a.get("lobos", []):
		r *= 1.0 + float(l[1]) * sin(float(l[0]) * ang + float(l[2]))
	return r

func _raio_ate(a: Dictionary, px: float, pz: float) -> float:
	return raio_na_direcao(a, atan2(pz - float(a.z), px - float(a.x)))

func _areas() -> Array:
	return m.areas if m.get("areas", []).size() > 0 else [{"x": 0.0, "z": 0.0, "r": float(m.raio)}]

# maior raio possível de cada área (com as ondas): ponto mais longe que isso nem precisa da conta do ângulo.
# Desempenho (2026-11-03): com a mata são 42 áreas, conferidas por cada monstro e pelo herói a cada quadro
var _tetos := PackedFloat32Array()
func _teto(a: Dictionary) -> float:
	var t: float = float(a.get("r", 0.0)) if not a.has("rx") else maxf(float(a.rx), float(a.rz))
	if a.has("rx"):
		for l in a.get("lobos", []):
			t *= 1.0 + absf(float(l[1]))
	return t

func dentro_do_mapa(px: float, pz: float, margem := 0.0) -> bool:
	var areas := _areas()
	if _tetos.size() != areas.size():
		_tetos.resize(areas.size())
		for i in areas.size():
			_tetos[i] = _teto(areas[i])
	for i in areas.size():
		var a: Dictionary = areas[i]
		var d := Vector2(px - float(a.x), pz - float(a.z)).length()
		if d > _tetos[i] - margem + 0.001:
			continue
		if d <= _raio_ate(a, px, pz) - margem:
			return true
	for c in m.get("corredores", []):
		if Vector2(px, pz).distance_to(_no_segmento(c, px, pz)) <= float(c.larg) / 2.0 - margem:
			return true
	return false

func limitar_ao_mapa(px: float, pz: float, margem := 0.0) -> Vector2:
	if dentro_do_mapa(px, pz, margem):
		return Vector2(px, pz)
	var melhor := Vector2(px, pz)
	var md := INF
	var centros: Array = []
	for a in _areas():
		centros.append([Vector2(float(a.x), float(a.z)), _raio_ate(a, px, pz) - margem])
	for c in m.get("corredores", []):
		centros.append([_no_segmento(c, px, pz), float(c.larg) / 2.0 - margem])
	for k in centros:
		var cc: Vector2 = k[0]
		var d := Vector2(px, pz) - cc
		var q: Vector2 = cc + (d.normalized() * max(0.0, k[1]) if d.length() > 0.0 else Vector2.ZERO)
		var dd := Vector2(px, pz).distance_to(q)
		if dd < md:
			md = dd
			melhor = q
	return melhor

func _vai(nx: float, nz: float) -> bool:
	var h: float = T.altura(nx, nz, y)
	if h > y + m.subida.degrau:
		return false
	x = nx
	z = nz
	if chao and vy <= 0:
		if h >= y - 0.4:
			y = h # sobe e desce a pedra andando
		else:
			chao = false # caiu da beirada
	return true

func mover(dx: float, dz: float) -> void:
	var x0 := x
	var y0 := y
	var z0 := z
	var chao0 := chao
	if not _vai(x + dx, z + dz):
		bloqueado = true
		if not _vai(x + dx, z):
			_vai(x, z + dz)
	colidir()
	# o empurrão de um obstáculo (tina, bigorna, esteio, NPC) não pode jogar o herói para dentro de uma parede:
	# senão o chão "sobe" até o alto dela e ele aparece no telhado (ferraria: tina rente ao muro do fundo)
	if T.altura(x, z, y) > y + m.subida.degrau:
		x = x0
		y = y0
		z = z0
		chao = chao0
		bloqueado = true

# ---------- pulo, queda e dash ----------
func pular(pode_mortal := true) -> String:
	if esc != null:
		if esc.clip == null:
			soltar()
		return ""
	if arrancada != null:
		return ""
	if chao or (pulos == 0 and fora_do_chao < COYOTE and vy <= 0.0): # saiu da beirada agora há pouco: ainda vale
		vy = m.movimento.pulo
		chao = false
		pulos = 1
		pulo_t = 0.0
		pouso = 0.0
		return "pulo"
	if pulos < 2 and pode_mortal:
		vy = max(vy, m.movimento.pulo * 0.9)
		pulos = 2
		mortal = 1.1
		return "mortal"
	return ""

# devolve true se saiu correndo pela parede em vez do dash
func dash(mx: float, mz: float) -> bool:
	if esc != null or arrancada != null or (not chao and arrancada_no_ar):
		return false
	if Vector2(mx, mz).length() > 0.1:
		ry = atan2(mx, mz)
	manobra = null
	if chao and correr_na_parede():
		return true
	ry_mira = null
	arrancada = {"t": float(m.movimento.dashTempo), "dx": sin(ry), "dz": cos(ry)}
	mortal = 0.0
	pouso = 0.0
	if not chao:
		vy = max(0.0, vy)
		arrancada_no_ar = true
	return false

func passo_vertical(dt: float) -> void:
	var c: float = T.altura(x, z, y)
	if arrancada != null:
		vy = 0.0
	elif not chao or vy > 0:
		vy -= m.movimento.gravidade * dt
	y += vy * dt
	var teto: float = T.teto(x, z, y - vy * dt) - m.alturaHeroi # debaixo do telhado a cabeça bate
	if y > teto and vy > 0:
		y = max(c, teto)
		vy = 0.0
	if y <= c + 0.001:
		if not chao and vy < -3:
			pouso = 0.64
		if not chao:
			pousou = clamp((-vy - 2.0) / 8.0, 0.0, 1.0) if vy < -2.0 else 0.0
		if not chao:
			pulos = 0
			mortal = 0.0
			arrancada_no_ar = false
		y = c
		vy = 0.0
		chao = true
	else:
		chao = false
	fora_do_chao = 0.0 if chao else fora_do_chao + dt
	pulo_t += dt
	mortal = max(0.0, mortal - dt)
	pouso = max(0.0, pouso - dt)

# Um quadro no chão. mx/mz = direção no mundo com a força do joystick (0..1), livre = pode andar (sem golpe em andamento)
# velocidades do herói (iguais a HEROI em shared/dados.js) e a velocidade "natural" das animações:
# o quanto o pé de apoio anda para trás por segundo com a animação em 1x (medido em teste_passo.gd).
# A animação toca em velocidade / PASSO_*: o pé acompanha o chão e não parece que desliza.
const CORRIDA := 5.4
const TROTE := CORRIDA * 0.7 # = ESTAMINA.trote x HEROI.correr (shared/dados.js): o máximo do joystick, não gasta estamina
const ANDAR := 1.8
const PASSO_CORRIDA := 4.0
const PASSO_ANDAR := 1.15
# sensação do movimento (ajuste aqui testando no celular)
const ACELERA := 15.0 # m/s² saindo do parado: o primeiro empurrão é forte...
const ACELERA_FIM := 0.4 # ...e perto da velocidade máxima cai para 40%: chega macio (0 a 5,4 m/s em ~0,5 s)
const FREIA := 16.0 # m/s² soltando o joystick: a corrida para em ~0,35 s (o corpo freia e dá o tranco no main.gd)
const VIRA_FREIA := 24.0 # m/s² dando meia-volta: freia no sentido antigo antes de sair para o outro lado
const CURVA_ANDANDO := 14.0 # rad/s que a direção do movimento vira andando devagar (quase na hora)
const CURVA_CORRENDO := 4.5 # rad/s correndo: a velocidade faz arco, o corpo "escorrega" um pouco para fora
const CURVA_PERDA := 0.35 # fração da velocidade perdida numa curva fechada (90° ou mais)
const MEIA_VOLTA := 2.3 # rad (~130°): acima disso é meia-volta (freia e sai do outro lado), abaixo é curva
# animações com o caminho do quadril (Mixamo Run To Stop e Running Turn 180, mundo.json raiz)
const FREADA_MIN := 4.2 # m/s: soltar o joystick acima disso faz a freada com derrapada
const FREADA_ESC := 0.65 # a derrapada anda 65% do que a animação anda (para em ~0,5 s e ~1,5 m)
const FREADA_FIM := 1.05 # s da animação: depois disso ela só fica de braço esticado; o jogo volta para a parada
const MEIA_VOLTA_MIN := 3.8 # m/s: meia-volta acima disso gira com a animação
const NO_AR := 0.35 # controle no ar (fração da aceleração)
const GIRO_MAX := 13.0 # rad/s que o corpo gira (~750°/s: meia volta em 0,24 s)
const GIRO_MIRA := 26.0 # rad/s virando para o alvo do golpe
const COYOTE := 0.12 # s depois de sair da beirada em que o pulo ainda vale
const SUBPASSO := 1.0 / 60.0 # o movimento roda em passos de 1/60 s: pulo e corrida iguais a 30 ou 60 FPS

# velocidade que a força do joystick pede: devagar no começo, andar até a metade e trote no fim (sem degrau).
# Com a disparada ligada, o joystick a partir de 30% já pede a corrida inteira.
static func vel_joystick(forca: float, disparando := false) -> float:
	if forca < 0.15:
		return 0.0
	if disparando and forca >= 0.3:
		return CORRIDA
	if forca < 0.5:
		return ANDAR * lerp(0.55, 1.0, (forca - 0.15) / 0.35)
	return lerp(ANDAR, TROTE, smoothstep(0.5, 0.9, forca))

func passo(dt: float, mx: float, mz: float, correr: bool, livre: bool, vel_k := 1.0) -> void:
	var n: int = max(1, ceili(dt / SUBPASSO - 0.001))
	for i in n:
		_passo(dt / n, mx, mz, correr, livre, vel_k)

func _passo(dt: float, mx: float, mz: float, correr: bool, livre: bool, vel_k := 1.0) -> void:
	if esc != null:
		passo_escalada(dt, mx, mz)
		vx = 0.0
		vz = 0.0
		return
	anim = ""
	passo_vertical(dt)
	bloqueado = false
	var mag: float = min(1.0, Vector2(mx, mz).length())
	var ry0 := ry
	if arrancada != null:
		var a: Dictionary = arrancada
		var u: float = 1.0 - a.t / m.movimento.dashTempo
		var v: float = m.movimento.dashVel * (1.6 * pow(1.0 - u, 0.7) + 0.15) # sai rápido e freia
		mover(a.dx * v * dt, a.dz * v * dt)
		a.t -= dt
		if a.t <= 0:
			arrancada = null
			# sai do dash correndo na mesma direção (sem parar seco)
			var sai: float = min(CORRIDA if disparada else TROTE, vel_max) if mag > 0.5 else 1.5
			vx = a.dx * sai
			vz = a.dz * sai
	else:
		# velocidade que o joystick pede
		var alvo := Vector2.ZERO
		if livre and mag > 0.15:
			alvo = Vector2(mx, mz).normalized() * min(vel_joystick(mag, disparada) * vel_k, vel_max)
		var s0 := Vector2(vx, vz).length()
		_correu = _correu + dt if s0 > FREADA_MIN else 0.0
		if manobra == null and chao and livre and m.has("raiz"):
			if alvo.length() < 0.01 and s0 > FREADA_MIN and _correu > 0.35:
				iniciar_manobra("freada", s0)
			elif alvo.length() > 0.01 and s0 > MEIA_VOLTA_MIN and abs(Vector2(vx, vz).angle_to(alvo)) > MEIA_VOLTA:
				iniciar_manobra("meia_volta", s0)
		if manobra != null and _passo_manobra(dt, mag, livre):
			giro = lerp(giro, ad(ry, ry0) / max(dt, 0.0001), min(1.0, dt * 10.0))
			empurra = 0.0
			return
		var v := _inercia(Vector2(vx, vz), alvo, dt, livre)
		vx = v.x
		vz = v.y
		if v.length() > 0.001:
			var x0 := x
			var z0 := z
			mover(vx * dt, vz * dt)
			if bloqueado: # bateu: a velocidade fica só no que andou (não acumula contra a parede)
				vx = (x - x0) / dt
				vz = (z - z0) / dt
		# corpo vira para onde o joystick aponta, com giro limitado (sem estalar)
		if ry_mira != null:
			var d: float = ad(ry_mira, ry)
			ry += clamp(d, -GIRO_MIRA * dt, GIRO_MIRA * dt)
			if abs(d) < 0.02:
				ry_mira = null
		elif livre and mag > 0.15:
			var d2: float = ad(atan2(mx, mz), ry)
			ry += clamp(d2, -GIRO_MAX * dt, GIRO_MAX * dt)
	giro = lerp(giro, ad(ry, ry0) / max(dt, 0.0001), min(1.0, dt * 10.0))
	if livre and chao and arrancada == null and mag > 0.5:
		tentar_escalar(mx, mz, correr, dt)
	else:
		empurra = 0.0

# Inércia no chão: a velocidade não pula para a que o joystick pede.
# - arrancada: empurrão forte no começo que vai suavizando até a velocidade de corrida;
# - curva: a direção do movimento gira com limite (correndo faz arco e perde um pouco de velocidade);
# - meia-volta: freia no sentido antigo antes de sair para o outro lado;
# - soltar: freia mantendo a direção (o corpo dá o tranco e volta, em main.gd corpo_vivo).
func _inercia(v: Vector2, alvo: Vector2, dt: float, livre: bool) -> Vector2:
	var ar: float = 1.0 if chao else NO_AR
	var s := v.length()
	if alvo.length() < 0.01: # golpe em andamento planta os pés mais rápido (~0,15 s)
		return v.move_toward(Vector2.ZERO, (FREIA if livre else FREIA * 2.4) * ar * dt)
	if s < 0.3: # saindo do parado: vai direto para onde o joystick aponta
		return v.move_toward(alvo, ACELERA * ar * dt)
	var d := v / s
	var da := alvo.normalized()
	var ang := d.angle_to(da)
	if abs(ang) > MEIA_VOLTA:
		return d * move_toward(s, 0.0, VIRA_FREIA * ar * dt)
	var q: float = clamp(s / CORRIDA, 0.0, 1.0)
	var vira: float = lerp(CURVA_ANDANDO, CURVA_CORRENDO, q) * ar * dt
	d = d.rotated(clamp(ang, -vira, vira))
	var quer: float = alvo.length() * (1.0 - CURVA_PERDA * clamp(abs(ang) / (PI * 0.5), 0.0, 1.0) * q)
	if s < quer:
		s = move_toward(s, quer, ACELERA * lerp(1.0, ACELERA_FIM, q * q) * ar * dt)
	else:
		s = move_toward(s, quer, FREIA * 0.7 * ar * dt) # corrida para andar: desacelera sem tranco
	return d * s

# Freada e meia-volta com animação: o corpo anda (e vira) pelo caminho do quadril da animação, na velocidade em que
# o herói vinha. Assim o pé derrapa e o corpo freia junto com a animação, sem deslizar.
func iniciar_manobra(nome: String, vel: float) -> void:
	var r: Dictionary = m.raiz[nome]
	var esc: float = FREADA_ESC if nome == "freada" else 1.0
	var v_anim: float = max(float(r.z[3]) - float(r.z[0]), float(r.z[6]) - float(r.z[3])) * 10.0 * altura_quadril * esc # m/s no começo da animação
	ry = atan2(vx, vz)
	ry_mira = null
	manobra = {"nome": nome, "t": 0.0, "r": clamp(vel / max(v_anim, 0.5), 0.8, 2.5), "esc": esc, "ry0": ry, "px": 0.0, "pz": 0.0}

# ritmo da animação agora (a freada acelera a derrapada, mas o corpo se arruma no ritmo normal)
func ritmo_manobra() -> float:
	if manobra == null:
		return 1.0
	return manobra.r if manobra.nome != "freada" or manobra.t < 0.85 else 1.3

func _passo_manobra(dt: float, mag: float, livre: bool) -> bool:
	var mb: Dictionary = manobra
	if not livre or not chao or (mb.nome == "freada" and mag > 0.15):
		manobra = null # golpe, pulo ou joystick de novo: sai na hora, com a velocidade que tinha
		return false
	var r: Dictionary = m.raiz[mb.nome]
	mb.t += dt * ritmo_manobra()
	var u: float = min(mb.t, float(r.d)) * 30.0
	var i: int = clampi(int(u), 0, r.x.size() - 2)
	var a: float = u - i
	var px: float = lerp(float(r.x[i]), float(r.x[i + 1]), a) * altura_quadril * mb.esc
	var pz: float = lerp(float(r.z[i]), float(r.z[i + 1]), a) * altura_quadril * mb.esc
	var dx: float = px - mb.px
	var dz: float = pz - mb.pz
	mb.px = px
	mb.pz = pz
	var c := cos(float(mb.ry0))
	var sn := sin(float(mb.ry0))
	var x0 := x
	var z0 := z
	mover(dx * c + dz * sn, -dx * sn + dz * c)
	vx = (x - x0) / max(dt, 0.0001)
	vz = (z - z0) / max(dt, 0.0001)
	if mb.nome == "meia_volta":
		ry = float(mb.ry0) + lerp(float(r.giro[i]), float(r.giro[i + 1]), a)
	if mb.t >= (FREADA_FIM if mb.nome == "freada" else float(r.d)):
		manobra = null
	return true

# ---------- escalada ----------
func iniciar_clip(nome: String, vs := 1.0, hs := 1.0, ls := 1.0, depois := "") -> void:
	var e: Dictionary = m.escalada[nome]
	if esc == null:
		esc = {"parado": 0.0, "clip": null}
	manobra = null
	esc.clip = {"nome": nome, "t": 0.0, "dur": float(e.dur), "vs": vs, "hs": hs, "ls": ls, "x": x, "y": y, "z": z}
	_depois = depois
	clip_seq += 1
	anim = "esc_" + nome
	chao = false
	vy = 0.0
	arrancada = null
	empurra = 0.0

func ficar_em_pe() -> void:
	var h: float = T.altura(x, z, y)
	var cai := h < y - 0.3 # pousou fora (ponta de pedra): cai em vez de teleportar para baixo
	esc = null
	if not cai:
		y = h
	chao = not cai
	vy = 0.0
	pulos = 0
	anim = ""

func soltar() -> void:
	x -= sin(ry) * 0.35
	z -= cos(ry) * 0.35
	esc = null
	vy = 1.0
	chao = false
	pulos = 2
	anim = ""

func parede_a_frente(dir: float, ate: float):
	if T.teto(x, z, y) < INF:
		return null
	var fx := sin(dir)
	var fz := cos(dir)
	var d := 0.1
	while d <= ate + 0.0001:
		if T.teto(x + fx * d, z + fz * d, y) < INF:
			return null # o caminho entra debaixo de um telhado (ferraria aberta): parede lá dentro não se escala correndo
		var h: float = T.altura(x + fx * d, z + fz * d, y)
		if h > y + m.subida.degrau:
			if h > y + m.subida.mini:
				return {"dist": d, "r": T.rocha_em(x + fx * d, z + fz * d, y)}
			return null
		d += 0.1
	return null

func beirada() -> float:
	if esc != null and esc.get("escada") != null:
		return esc.escada.alt
	var fx := sin(ry)
	var fz := cos(ry)
	var r = T.rocha_em(x + fx * 0.8, z + fz * 0.8, y)
	if r != null and r.casa:
		var d := 0.05
		while d <= 1.2001:
			var h: float = T.altura(x + fx * d, z + fz * d, y)
			if h > y + m.subida.degrau:
				var atras: float = T.frente(x + fx * d, z + fz * d, ry, 0.6, null, y).topo
				return atras if atras > h + 0.8 else h
			d += 0.05
	return T.frente(x, z, ry, 1.0, null, y).topo

func ajustar_parede() -> void:
	var r = T.rocha_em(x + sin(ry) * 0.8, z + cos(ry) * 0.8, y)
	if r != null:
		ry = T.de_frente_para(r, x, z) if r.casa else atan2(r.x - x, r.z - z)
	var fx := sin(ry)
	var fz := cos(ry)
	var d := -0.5
	while d <= 1.2001:
		if T.altura(x + fx * (d + 0.4), z + fz * (d + 0.4), y) > y + 0.9:
			x += fx * d
			z += fz * d
			return
		d += 0.05

func agarrar() -> void:
	if esc == null:
		esc = {"parado": 0.0, "clip": null}
	esc.clip = null
	esc.parado = 0.0
	chao = false
	vy = 0.0
	anim = "parede_agarrado"
	if esc.get("escada") == null:
		ajustar_parede()

func mini_subida(dir: float) -> void:
	var fx := sin(dir)
	var fz := cos(dir)
	var topo: float = T.frente(x, z, dir, 1.6, null, y).topo
	var d := 0.3
	while d < 1.6:
		if T.altura(x + fx * d, z + fz * d, y) >= topo - 0.2:
			break
		d += 0.1
	var pousa := d
	while pousa < d + 0.3 and T.altura(x + fx * (pousa + 0.05), z + fz * (pousa + 0.05), y) >= topo - 0.2:
		pousa += 0.05
	ry = dir
	iniciar_clip("miniSubida", (topo - y) / 1.38, min(1.7, pousa) / 1.15, 1.0, "ficar")

func subir_no_topo() -> void:
	var fx := sin(ry)
	var fz := cos(ry)
	var topo := beirada()
	var d := 0.3
	while d < 2.0:
		if T.altura(x + fx * d, z + fz * d, y) >= topo - 0.25:
			break
		d += 0.1
	var pousa := d
	while pousa < d + 0.35 and T.altura(x + fx * (pousa + 0.05), z + fz * (pousa + 0.05), y) >= topo - 0.25:
		pousa += 0.05
	iniciar_clip("topo", max(0.3, (topo - y) / 1.29), min(2.2, pousa) / 0.49, 1.0, "ficar")

func pegar_escada(e: Dictionary) -> void:
	ry = e.ry
	x = e.x
	z = e.z
	esc = {"parado": 0.0, "clip": null, "escada": e}
	iniciar_clip("pegarEscada" if m.escalada.has("pegarEscada") else "subirParede", 1.0, 0.0, 0.0, "agarrar")

func correr_na_parede() -> bool:
	var f = parede_a_frente(ry, 2.9)
	if f == null or f.dist < 0.5 or f.r == null:
		return false
	var lado := ad(atan2(f.r.x - x, f.r.z - z), ry)
	esc = {"parado": 0.0, "clip": null}
	if lado < -0.35:
		iniciar_clip("diagonal", 1.0, max(0.3, (f.dist - 0.3) / 1.44), 1.0, "agarrar")
	else:
		iniciar_clip("correrNaParede", 1.0, max(0.2, (f.dist - 0.4) / 2.69), 1.0, "agarrar")
	return true

func tentar_escalar(mx: float, mz: float, correr: bool, dt: float) -> void:
	var dir := atan2(mx, mz)
	for e in m.escadas:
		if Vector2(x - (e.x - sin(e.ry) * 0.2), z - (e.z - cos(e.ry) * 0.2)).length() < 0.55 and cos(ad(dir, e.ry)) > 0.6:
			pegar_escada(e)
			return
	if correr:
		var f = parede_a_frente(dir, 3.1)
		if f != null and f.dist >= 1.5:
			ry = dir
			esc = {"parado": 0.0, "clip": null}
			iniciar_clip("corridaParede", 1.0, (f.dist - 0.4) / 2.79, 1.0, "agarrar")
			return
	if not bloqueado:
		empurra = 0.0
		return
	empurra += dt
	if empurra < m.subida.empurrar:
		return
	var topo: float = T.frente(x, z, dir, 1.6, null, y).topo
	if topo - y <= m.subida.mini:
		mini_subida(dir)
		return
	if T.teto(x, z, y) < INF:
		empurra = 0.0
		return
	ry = dir
	agarrar()

func _fim_clip() -> void:
	var o := _depois
	_depois = ""
	match o:
		"ficar":
			ficar_em_pe()
		"agarrar":
			agarrar()
		"descer":
			if y - T.altura(x - sin(ry) * 0.3, z - cos(ry) * 0.3, y) < 0.3:
				ficar_em_pe()
			else:
				agarrar()

func passo_escalada(dt: float, mx: float, mz: float) -> void:
	var s: Dictionary = esc
	var fx := sin(ry)
	var fz := cos(ry)
	var lx := cos(ry)
	var lz := -sin(ry)
	if s.clip != null:
		var c: Dictionary = s.clip
		c.t += dt
		var u: float = min(1.0, c.t / c.dur)
		var tr: Array = m.escalada[c.nome].traj
		var k: float = u * (tr.size() - 1)
		var i: int = min(tr.size() - 2, int(floor(k)))
		var a: float = k - i
		var p := []
		for n in 3:
			p.append(float(tr[i][n]) * (1 - a) + float(tr[i + 1][n]) * a)
		y = c.y + p[1] * c.vs
		if s.get("escada") != null and c.nome != "topo":
			var e: Dictionary = s.escada
			var t: float = clamp((y + 0.5) / e.alt, 0.0, 1.0)
			x = e.x + (e.topo.x - e.x) * t - fx * 0.35
			z = e.z + (e.topo.z - e.z) * t - fz * 0.35
		else:
			x = c.x + lx * p[0] * c.ls + fx * p[2] * c.hs
			z = c.z + lz * p[0] * c.ls + fz * p[2] * c.hs
		if u < 1.0:
			return
		s.clip = null
		_fim_clip()
		if esc != s or (esc != null and esc.clip != null):
			return
	# agarrado: para a frente sobe, para trás desce, para os lados anda pela parede
	var mag := Vector2(mx, mz).length()
	var fr := mx * fx + mz * fz
	var lado := mx * lx + mz * lz
	var falta := beirada() - y
	s.parado += dt
	if mag > 0.5 and fr > 0.5 * mag:
		s.parado = 0.0
		if falta <= m.subida.topo:
			subir_no_topo()
			return
		if s.get("escada") != null:
			iniciar_clip("subirEscada" if m.escalada.has("subirEscada") else "subirParede", 1.0, 0.0, 0.0, "agarrar")
			return
		iniciar_clip("subirParede", max(0.3, min(1.0, (falta - 1.29) / 1.06)), 1.0, 1.0, "agarrar")
		return
	if mag > 0.5 and fr < -0.5 * mag:
		s.parado = 0.0
		var c2: float = T.altura(x - fx * 0.3, z - fz * 0.3, y)
		var alt := y - c2
		if alt < 0.25:
			esc = null
			y = max(c2, y)
			chao = false
			anim = ""
			return
		iniciar_clip("descerParede", min(1.0, alt / 1.06), 1.0, 1.0, "descer")
		return
	if s.get("escada") == null and mag > 0.5 and abs(lado) > 0.5 * mag:
		s.parado = 0.0
		var sx: float = x + lx * sign(lado) * 0.5
		var sz: float = z + lz * sign(lado) * 0.5
		if T.altura(sx + fx * 0.8, sz + fz * 0.8, y) > y + 0.9:
			iniciar_clip("esquerda" if lado > 0 else "direita", 1.0, 1.0, 1.0, "agarrar")
			return
	if falta < m.subida.topo + 0.3:
		anim = "parede_beirada"
	elif s.parado > 4 and fmod(s.parado, 8.0) < 4:
		anim = "parede_balanca"
	else:
		anim = "parede_agarrado"

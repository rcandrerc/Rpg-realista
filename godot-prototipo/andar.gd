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

func _init(terreno, mundo: Dictionary) -> void:
	T = terreno
	m = mundo

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

func ad(a: float, b: float) -> float:
	return atan2(sin(a - b), cos(a - b))

# ---------- andar e colidir ----------
func colidir() -> void:
	for k in m.obstaculos:
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
	var r := sqrt(x * x + z * z)
	var lim: float = m.raio - 2.2
	if r > lim:
		x *= lim / r
		z *= lim / r

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
	if not _vai(x + dx, z + dz):
		bloqueado = true
		if not _vai(x + dx, z):
			_vai(x, z + dz)
	colidir()

# ---------- pulo, queda e dash ----------
func pular() -> String:
	if esc != null:
		if esc.clip == null:
			soltar()
		return ""
	if arrancada != null:
		return ""
	if chao:
		vy = m.movimento.pulo
		chao = false
		pulos = 1
		pulo_t = 0.0
		pouso = 0.0
		return "pulo"
	if pulos < 2:
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
	if chao and correr_na_parede():
		return true
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
			pulos = 0
			mortal = 0.0
			arrancada_no_ar = false
		y = c
		vy = 0.0
		chao = true
	else:
		chao = false
	pulo_t += dt
	mortal = max(0.0, mortal - dt)
	pouso = max(0.0, pouso - dt)

# Um quadro no chão. mx/mz = direção no mundo (0..1), livre = pode andar (sem golpe em andamento)
# corrida: 4,5 m/s (era 5,4; André achou rápido demais em 2026-11-02). O servidor aceita até 5,4 x 1,3.
const CORRIDA := 4.5
func passo(dt: float, mx: float, mz: float, correr: bool, livre: bool, vel_k := 1.0) -> void:
	if esc != null:
		passo_escalada(dt, mx, mz)
		return
	anim = ""
	passo_vertical(dt)
	bloqueado = false
	var mag := Vector2(mx, mz).length()
	if arrancada != null:
		var a: Dictionary = arrancada
		var u: float = 1.0 - a.t / m.movimento.dashTempo
		var v: float = m.movimento.dashVel * (1.6 * pow(1.0 - u, 0.7) + 0.15) # sai rápido e freia
		mover(a.dx * v * dt, a.dz * v * dt)
		a.t -= dt
		if a.t <= 0:
			arrancada = null
	elif livre and mag > 0.15:
		var vel: float = (CORRIDA if correr else 1.8) * vel_k
		mover(mx * vel * dt, mz * vel * dt)
		ry += ad(atan2(mx, mz), ry) * min(1.0, dt * 12.0)
	if livre and chao and arrancada == null and mag > 0.5:
		tentar_escalar(mx, mz, correr, dt)
	else:
		empurra = 0.0

# ---------- escalada ----------
func iniciar_clip(nome: String, vs := 1.0, hs := 1.0, ls := 1.0, depois := "") -> void:
	var e: Dictionary = m.escalada[nome]
	if esc == null:
		esc = {"parado": 0.0, "clip": null}
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

extends Control
# Mapa-múndi 3D (André 2026-11-15, inspirado no mapa do Albion): o mundo inteiro como uma maquete low poly que a
# câmera sobrevoa. Arrastar anda, pinça (ou roda do mouse) aproxima, tocar no chão marca o lugar e mostra o "Ir para".
# No canto, o mapinha do mundo inteiro com o quadrado vermelho do que a câmera mostra. O mapa 2D de hoje continua: o
# botão "Mapa 2D" troca (minimapa.gd guarda a escolha).
# Peso: a maquete é montada uma vez (numa linha de fundo, ~0,6 s no PC) e fica num mundo 3D só dela (SubViewport).
# Com o mapa aberto, o mundo do jogo para de ser desenhado (root.disable_3d), então só a maquete custa.

const BLOCO := 64 # pontos da grade de 4 m por pedaço do terreno (256 m): a câmera e a sombra pulam o que não veem
const PASSO := 2 # pontos da grade de 4 m por faceta (8 m)
const EXAG := 1.6 # relevo um pouco exagerado para aparecer de longe
const UMA_ARVORE_EM := 9 # do mata do mundo, 1 a cada 9 vira árvore grande (o Albion usa poucas e grandes)
const DIST_MIN := 120.0
const DIST_MAX := 2100.0
const DIST_ABRIR := 330.0
const INCL := 48.0 # graus da câmera acima do chão (o ângulo de quando abre)
# Girar e inclinar (André 2026-11-17): dois dedos girando giram o mapa em 360°; dois dedos arrastando juntos para cima
# ou para baixo inclinam, da vista de cima (quase 2D) até INCL_MIN. Mais deitado que isso aparece terra longe demais
# (pesa) e a borda vazia do mundo; o limite saiu da medição de quadros por ângulo. A bússola volta ao norte e ao INCL.
const INCL_MIN := 35.0 # o mais deitado de perto (55° a partir da vista de cima; André 2026-11-17 escolheu 35): 30° custava +15% e 25° +30% por quadro
const INCL_MIN_LONGE := 45.0 # de longe não deita tanto: senão aparece a ponta do mar e o fundo vazio
const INCL_MAX := 89.0
const COR_OURO := Color("c9a35a")
const Idioma = preload("res://idioma.gd") # inglês: todo texto desenhado passa por Idioma.frase

var mm # minimapa.gd
var m # main.gd
var fonte: Font
var sv: SubViewport
var mundo3d: Node3D
var cam: Camera3D
var mini_sv: SubViewport
var mini_tex: TextureRect
var marcas: Control
var pronto := false
var _tarefa := -1
var _dados: Dictionary = {}
var _t_abriu := 0
var _mini_feito := false

var foco := Vector3.ZERO
var foco_alvo := Vector3.ZERO
var dist := DIST_ABRIR
var dist_alvo := DIST_ABRIR
var giro := 0.0 # radianos; 0 = norte para cima
var giro_alvo := 0.0
var incl := INCL
var incl_alvo := INCL
var b_bussola := Rect2()
var toques := {}
var arrastou := false
var pinca := {}

var g: Dictionary # terreno.mundo_g
var nx := 0
var nz := 0
var hh: PackedFloat32Array
var hv: PackedFloat32Array # alturas da malha do chão: hh com o leito dos rios cavado (só o desenho; alt() e estradas usam hh)
var X0 := 0.0
var Z0 := 0.0
var ATE := Vector2.ZERO # fim do desenho em metros (x, z), já com a terra de fora
var J0 := Vector2.ZERO # começo e fim do mundo andável (a grade do servidor)
var J1 := Vector2.ZERO
var fora := PackedFloat32Array() # metros de cada ponto até o mundo andável (0 = dentro)
# Borda natural (André 2026-11-15: "a borda tá um retângulo super perfeito"): só no desenho do mapa, o continente
# continua além da borda do mundo andável, com morros e mata, cada vez mais apagado até sumir na névoa (terra que
# ainda não dá para acessar). O mundo do jogo não muda. Quando o mundo crescer, a grade cresce e a névoa vai junto.
const ALEM := 110 # pontos de 4 m desenhados além da borda (440 m)
const COR_NEVOA := Color8(140, 154, 162)

var b_x := Rect2()
var b_2d := Rect2()
var b_mais := Rect2()
var b_menos := Rect2()
var b_eu := Rect2()
var b_ir := Rect2()
var b_lista := Rect2()
var b_nevoa := Rect2() # tira e põe a névoa no mapa (André 2026-11-17)
var b_tp := Rect2() # "Teleportar" do totem escolhido
var totens_ao_ficar_pronto := false # encostou no totem com a maquete ainda montando
# André 2026-11-17: "opção para eu tirar a neblina... e botasse de volta para eu ver o que estava liberado". Só o
# desenho do mapa: o mundo continua fechado do mesmo jeito (o servidor decide) e o minimapa segue com a névoa.
var nevoa_no_mapa := true
var lista_aberta := true # lista de Lugares na direita (como no 2D); o botão no alto esconde
# áreas de plantio (camada do filtro do mapa, André 2026-11-16): pinheirinhos em fileiras (antes quadradinhos amarelos)
var _quads_plantio := {} # lido na linha principal antes de montar no fundo
var plantio_mi: MultiMeshInstance3D

func _init(minimapa) -> void:
	mm = minimapa
	m = minimapa.m
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	visible = false

func _ready() -> void:
	fonte = load("res://fontes/AlegreyaSans-Bold.ttf")
	var fundo := ColorRect.new()
	fundo.color = COR_NEVOA
	fundo.set_anchors_preset(Control.PRESET_FULL_RECT)
	fundo.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(fundo)
	var cont := SubViewportContainer.new()
	cont.set_anchors_preset(Control.PRESET_FULL_RECT)
	cont.stretch = true
	cont.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(cont)
	sv = SubViewport.new()
	sv.own_world_3d = true
	sv.transparent_bg = false
	sv.render_target_update_mode = SubViewport.UPDATE_DISABLED
	cont.add_child(sv)
	marcas = Control.new()
	marcas.set_anchors_preset(Control.PRESET_FULL_RECT)
	marcas.mouse_filter = Control.MOUSE_FILTER_IGNORE
	marcas.draw.connect(_desenhar)
	add_child(marcas)
	g = m.terreno.mundo_g if m.terreno != null else {}

# ---------- abrir e fechar ----------

func disponivel() -> bool:
	return not g.is_empty()

func abrir() -> void:
	_t_abriu = Time.get_ticks_usec()
	visible = true
	toques = {}
	pinca = {}
	var hp: Vector3 = m.heroi.position if m.heroi != null else Vector3.ZERO
	foco_alvo = Vector3(hp.x, 0, hp.z)
	foco = foco_alvo
	dist = DIST_ABRIR
	dist_alvo = DIST_ABRIR
	giro = 0.0
	giro_alvo = 0.0
	incl = INCL
	incl_alvo = INCL
	get_viewport().disable_3d = true # o mundo do jogo não é desenhado atrás do mapa
	if pronto:
		_ligar()
	else:
		preparar()
	marcas.queue_redraw()

# Monta a maquete numa linha de fundo antes do primeiro toque (André 2026-11-15: a primeira vez levava ~4 s para
# abrir). Começa sozinho uns segundos depois do jogo carregar; tudo pesado (grade, malhas, árvores) fica fora da linha
# principal, que só encaixa a cena pronta (sem engasgo no jogo). Se abrir antes de acabar, mostra "Montando o mapa…".
func preparar() -> void:
	if pronto or _tarefa >= 0 or g.is_empty():
		return
	if m.plantio:
		_quads_plantio = m.plantio.quadrados().duplicate()
	_tarefa = WorkerThreadPool.add_task(_montar_fundo, false, "mapa3d")

func _montar_fundo() -> void:
	_montar_dados()
	_montar_cena()

func fechar() -> void:
	if not visible:
		return
	visible = false
	get_viewport().disable_3d = false
	if sv != null:
		sv.render_target_update_mode = SubViewport.UPDATE_DISABLED

func _ligar() -> void:
	sv.render_target_update_mode = SubViewport.UPDATE_WHEN_VISIBLE
	if not _mini_feito:
		_mini_feito = true
		mini_sv.render_target_update_mode = SubViewport.UPDATE_ONCE
	_camera()
	if m.lentidao and _t_abriu > 0: # quanto o mapa 3D levou para abrir (lentidao.gd, tipo "menu")
		m.lentidao.menu_aberto("mapa3d", _t_abriu, 0)
		_t_abriu = 0

# Aquecer (achado da linha de desempenho nos registros do André, 2026-11-16: a 1ª abertura do mapa 3D levou 3,5 s no
# 1º quadro, 27 pipelines da placa compiladas na hora). aquecer() monta a maquete (se ainda não montou) e a desenha uma
# vez escondida, com a câmera no herói: as pipelines compilam ali (atrás da capa de abertura, quem chama escolhe a hora)
# e a primeira abertura de verdade já sai pronta. Escondido o mapa não aparece nem pega toque.
var _aquecer := false
func aquecer() -> void:
	if g.is_empty():
		return
	if pronto:
		if not visible:
			_desenhar_escondido()
		return
	_aquecer = true
	preparar()

# a capa saiu antes da maquete ficar pronta: não desenha escondido no meio do jogo (seria o engasgo que se quer evitar)
func cancelar_aquecer() -> void:
	_aquecer = false

func _desenhar_escondido() -> void:
	_aquecer = false
	if m.heroi != null:
		foco = Vector3(m.heroi.position.x, 0, m.heroi.position.z)
		foco_alvo = foco
	dist = DIST_ABRIR
	dist_alvo = DIST_ABRIR
	_camera()
	sv.render_target_update_mode = SubViewport.UPDATE_ONCE
	if not _mini_feito:
		_mini_feito = true
		mini_sv.render_target_update_mode = SubViewport.UPDATE_ONCE

const PREPARAR_APOS := 12.0 # segundos de jogo antes de montar o mapa 3D em segundo plano
var _t_jogo := 0.0

func _process(dt: float) -> void:
	if not pronto:
		if _tarefa >= 0:
			if WorkerThreadPool.is_task_completed(_tarefa):
				WorkerThreadPool.wait_for_task_completion(_tarefa)
				_tarefa = -1
				_encaixar()
				pronto = true
				if visible:
					_ligar()
					if totens_ao_ficar_pronto and not mm.totem_de.is_empty():
						ver_totens()
				totens_ao_ficar_pronto = false
				if _aquecer and not visible:
					_desenhar_escondido()
		elif not visible and m.heroi != null and not g.is_empty():
			_t_jogo += minf(dt, 0.1) # quadro longo do carregamento não conta
			if _t_jogo > PREPARAR_APOS:
				preparar()
		if visible:
			marcas.queue_redraw()
		return
	if not visible:
		return
	var a: float = 1.0 - exp(-12.0 * dt)
	dist = lerpf(dist, dist_alvo, a)
	foco = foco.lerp(foco_alvo, a)
	giro = lerp_angle(giro, giro_alvo, a)
	incl = lerpf(incl, incl_alvo, a)
	_camera()
	# as marcas (símbolos, nomes, névoa) só são redesenhadas quando a câmera mexe, ou 4 vezes por segundo para os
	# jogadores e o herói andando: parado, o mapa quase não gasta
	_t_marcas += dt
	var tc: Transform3D = cam.global_transform if cam != null else Transform3D()
	if _t_marcas > 0.25 or not tc.is_equal_approx(_cam_antes) or not mm.totem_de.is_empty():
		_t_marcas = 0.0
		_cam_antes = tc
		marcas.queue_redraw()

var _t_marcas := 0.0
var _cam_antes := Transform3D()

func _camera() -> void:
	if cam == null:
		return
	foco.x = clampf(foco.x, J0.x - 150.0, J1.x + 150.0)
	foco.z = clampf(foco.z, J0.y - 150.0, J1.y + 150.0)
	var f := Vector3(foco.x, alt(foco.x, foco.z) * 0.5, foco.z)
	var fz := (dist - DIST_MIN) / (DIST_MAX - DIST_MIN)
	var p := deg_to_rad(clampf(incl + fz * 10.0, lerpf(INCL_MIN, INCL_MIN_LONGE, fz), INCL_MAX)) # de longe, um pouco mais de cima
	var pos := f + Vector3(sin(giro) * cos(p), sin(p), cos(giro) * cos(p)) * dist
	pos.y = maxf(pos.y, alt(pos.x, pos.z) + 15.0) # deitada, a câmera não entra no morro
	cam.look_at_from_position(pos, f, Vector3.UP)

# ---------- montagem (linha de fundo: só contas; a cena é criada na linha principal) ----------

func alt(x: float, z: float) -> float:
	if nx == 0:
		return 0.0
	var fi := clampf((x - X0) / 4.0, 0.0, nx - 1.001)
	var fj := clampf((z - Z0) / 4.0, 0.0, nz - 1.001)
	var i := int(fi)
	var j := int(fj)
	var a := fi - i
	var b := fj - j
	var v := lerpf(lerpf(hh[j * nx + i], hh[j * nx + i + 1], a), lerpf(hh[(j + 1) * nx + i], hh[(j + 1) * nx + i + 1], a), b)
	return _y(v)

static func _y(v: float) -> float:
	if v < 0.0:
		return v * 0.6 - 1.0
	return 0.8 + (v if v < 25.0 else 25.0 + (v - 25.0) * 0.45) * EXAG

func _montar_dados() -> void:
	nx = int(g.nx)
	nz = int(g.nz)
	X0 = float(g.x0)
	Z0 = float(g.z0)
	ATE = Vector2(X0 + (nx - 1) * 4.0, Z0 + (nz - 1) * 4.0)
	hh = (g.h as PackedFloat32Array).duplicate()
	# a montanha do mapa de hoje (grade própria, mais fina)
	var gm = m.mundo.get("montanha_grade")
	if gm != null:
		var n := int(gm.n)
		var ps := float(gm.passo)
		for b in n:
			for a in n:
				var i := int(round((float(gm.x0) + a * ps - X0) / 4.0))
				var j := int(round((float(gm.z0) + b * ps - Z0) / 4.0))
				if i >= 0 and j >= 0 and i < nx and j < nz:
					hh[j * nx + i] = maxf(hh[j * nx + i], float(gm.h[b * n + a]))
	_alem()
	_cavar_rios()
	# praia: só a areia perto do mar (o chão plano do mapa de hoje também é baixo)
	var praia := PackedByteArray()
	praia.resize(nx * nz)
	for j in nz:
		for i in nx:
			if hh[j * nx + i] < 0.0:
				for b in range(maxi(0, j - 2), mini(nz, j + 3)):
					for a in range(maxi(0, i - 2), mini(nx, i + 3)):
						praia[b * nx + a] = 1
	# densidade da mata em quadrados de 8 m (chão mais escuro embaixo da mata)
	var w := nx / PASSO + 1
	var hq := nz / PASSO + 1
	var dens := PackedFloat32Array()
	dens.resize(w * hq)
	var arvores := []
	var k := 0
	for a in m.mundo.get("mata", []):
		var i := int((float(a.x) - X0) / (4.0 * PASSO))
		var j := int((float(a.z) - Z0) / (4.0 * PASSO))
		for dj in range(-1, 2):
			for di in range(-1, 2):
				var ii := i + di
				var jj := j + dj
				if ii >= 0 and jj >= 0 and ii < w and jj < hq:
					dens[jj * w + ii] += 0.35 if (di == 0 and dj == 0) else 0.12
		k += 1
		if k % UMA_ARVORE_EM == 0:
			arvores.append(Vector2(float(a.x), float(a.z)))
	# mata da terra de fora (só desenho): manchas onde o ruído diz, nas partes baixas
	var rm := FastNoiseLite.new()
	rm.seed = 7
	rm.frequency = 1.0 / 120.0
	for j in range(0, nz, 3):
		for i in range(0, nx, 3):
			var d: float = fora[j * nx + i]
			if d < 30.0 or d > ALEM * 4.0 - 80.0:
				continue
			var v: float = hh[j * nx + i]
			var x := X0 + i * 4.0 + fmod(i * 7.13, 3.0)
			var z := Z0 + j * 4.0 + fmod(j * 5.71, 3.0)
			if v > 1.5 and v < 35.0 and rm.get_noise_2d(x, z) > 0.15 and fmod(absf(x * 12.9898 + z * 78.233), 1.0) < 0.35:
				arvores.append(Vector2(x, z))
	# terreno: facetas planas (low poly), cor por vértice. Manchas claras e escuras e grama seca (André 2026-11-17):
	# ruído só aqui na montagem (linha de fundo), vira a cor do vértice; desenhar não custa nada a mais
	var mancha := FastNoiseLite.new()
	mancha.seed = 21
	mancha.frequency = 1.0 / 260.0
	mancha.fractal_octaves = 3
	var seco := FastNoiseLite.new()
	seco.seed = 5
	seco.frequency = 1.0 / 170.0
	seco.fractal_octaves = 1
	# em pedaços de BLOCO pontos (André 2026-11-18, registros do celular: 1,9 M triângulos por quadro com o mapa aberto):
	# o terreno era uma malha só, desenhada inteira mesmo fora da tela e de novo em cada faixa da sombra. Em pedaços, a
	# câmera e a sombra só desenham os pedaços que enxergam. A imagem não muda.
	var pedacos := {} # Vector2i -> [V, N, C]
	for bj in range(0, nz - PASSO, BLOCO):
		for bi in range(0, nx - PASSO, BLOCO):
			var V := PackedVector3Array()
			var N := PackedVector3Array()
			var C := PackedColorArray()
			for j in range(bj, mini(bj + BLOCO, nz - PASSO), PASSO):
				for i in range(bi, mini(bi + BLOCO, nx - PASSO), PASSO):
					var P: Array[Vector3] = [_ponto(i, j), _ponto(i + PASSO, j), _ponto(i + PASSO, j + PASSO), _ponto(i, j + PASSO)]
					var tris: Array = [[0, 1, 2], [0, 2, 3]] if (i / PASSO + j / PASSO) % 2 == 0 else [[0, 1, 3], [1, 2, 3]]
					var mx := X0 + (i + 1) * 4.0 # o ruído uma vez por quadrado de 8 m (os dois triângulos usam o mesmo)
					var mz := Z0 + (j + 1) * 4.0
					var k1 := mancha.get_noise_2d(mx, mz)
					var k2 := seco.get_noise_2d(mx, mz)
					for t in tris:
						var a3: Vector3 = P[t[0]]
						var b3: Vector3 = P[t[1]]
						var c3: Vector3 = P[t[2]]
						var nn := (c3 - a3).cross(b3 - a3).normalized()
						var cx := (a3 + b3 + c3) / 3.0
						var ci := clampi(int((cx.x - X0) / 4.0), 0, nx - 1)
						var cj := clampi(int((cx.z - Z0) / 4.0), 0, nz - 1)
						var v0: float = hh[cj * nx + ci]
						var incl := sqrt(maxf(0.0, 1.0 - nn.y * nn.y)) / maxf(nn.y, 0.05)
						var cor := _cor(v0, incl, dens[mini(cj / PASSO, hq - 1) * w + mini(ci / PASSO, w - 1)], praia[cj * nx + ci] == 1)
						if v0 >= 0.0:
							cor = _manchar(cor, k1, k2, cx, incl, v0)
						var df: float = fora[cj * nx + ci]
						if df > 0.0: # terra sem acesso: mais apagada e sumindo na névoa
							var kf := clampf((df - 60.0) / (ALEM * 4.0 - 100.0), 0.0, 1.0)
							var cinza := Color(cor.get_luminance(), cor.get_luminance(), cor.get_luminance())
							cor = cor.lerp(cinza, 0.15 + 0.35 * kf).darkened(0.06 + 0.1 * kf)
						for v in [a3, b3, c3]:
							V.append(v)
							N.append(nn)
							C.append(cor)
			pedacos[Vector2i(bi, bj)] = [V, N, C]
	_dados = {"pedacos": pedacos, "arvores": arvores}

# aumenta a grade para os lados: o que é terra na borda continua (o muro de montanha vai baixando para morros e serras
# de ruído); o que é mar na borda continua mar
func _alem() -> void:
	J0 = Vector2(X0, Z0)
	J1 = ATE
	var M := ALEM
	var enx := nx + 2 * M
	var enz := nz + 2 * M
	var hx := PackedFloat32Array()
	hx.resize(enx * enz)
	fora.resize(enx * enz)
	var n1 := FastNoiseLite.new()
	n1.seed = 3
	n1.frequency = 1.0 / 320.0
	n1.fractal_octaves = 3
	var n2 := FastNoiseLite.new()
	n2.seed = 5
	n2.frequency = 1.0 / 90.0
	for J in enz:
		for I in enx:
			var i := I - M
			var j := J - M
			var k := J * enx + I
			if i >= 0 and j >= 0 and i < nx and j < nz:
				hx[k] = hh[j * nx + i]
				fora[k] = 0.0
				continue
			var ci := clampi(i, 0, nx - 1)
			var cj := clampi(j, 0, nz - 1)
			var d := Vector2(i - ci, j - cj).length() * 4.0
			fora[k] = d
			var x := X0 + i * 4.0
			var z := Z0 + j * 4.0
			var a := n1.get_noise_2d(x, z)
			var b := n2.get_noise_2d(x, z)
			var borda: float = _borda_lisa(ci, cj, int(a * d * 0.25)) # o litoral de fora entorta com o ruído
			if borda < 0.5:
				hx[k] = borda - d * 0.01 + maxf(0.0, a - 0.35) * 40.0 * minf(1.0, d / 200.0) # mar (às vezes uma ilhota)
				continue
			# a serra da borda continua por fora, recortada pelo ruído, e vai baixando para morros com mata
			var perto := exp(-d / 160.0)
			var serra := maxf(0.0, a * 0.5 + 0.5 + b * 0.25 - 0.25) * (borda * 1.1 * perto + 70.0 * (1.0 - perto))
			var morro := 3.0 + 12.0 * (a * 0.5 + 0.5) + 4.0 * b
			var muro := borda * exp(-d / 45.0)
			hx[k] = maxf(maxf(muro, morro), serra)
	hh = hx
	nx = enx
	nz = enz
	X0 -= M * 4.0
	Z0 -= M * 4.0
	ATE = Vector2(X0 + (nx - 1) * 4.0, Z0 + (nz - 1) * 4.0)

# altura da borda já alisada ao longo dela (sem isso a terra de fora sai em listras)
func _borda_lisa(ci: int, cj: int, desloc := 0) -> float:
	var soma := 0.0
	var n := 0
	var lado := ci == 0 or ci == nx - 1
	if lado:
		cj = clampi(cj + desloc, 0, nz - 1)
	else:
		ci = clampi(ci + desloc, 0, nx - 1)
	for o in range(-6, 7):
		var i := ci
		var j := cj
		if lado:
			j = clampi(cj + o * 2, 0, nz - 1)
		else:
			i = clampi(ci + o * 2, 0, nx - 1)
		soma += hh[j * nx + i]
		n += 1
	return soma / n

func _ponto(i: int, j: int) -> Vector3:
	return Vector3(X0 + i * 4.0, _y(hv[j * nx + i]), Z0 + j * 4.0)

# Rios no mapa 3D (André 2026-11-16: "os lagos e rios não estão aparecendo no mapa 3D"). O leito tem uns 8 m e as
# facetas do chão têm 8 m: a faceta pulava o leito e ligava um barranco no outro, cobrindo a fita do rio. Aqui a malha
# do chão desce até o leito em volta da água do rio (grade "rio" >= 8, a mesma do terreno.gd), e a fita fica por cima.
# Só o desenho muda: alt() e as estradas continuam na altura de verdade (a estrada passa por cima, como ponte).
const RIO_AGUA := 8
const RIO_VOLTA := 2 # pontos de 4 m em volta da água que descem junto (o fundo do vale fica mais largo que a fita)
func _cavar_rios() -> void:
	hv = hh.duplicate()
	var rio: String = g.get("rio", "")
	var gx := int(g.nx)
	var gz := int(g.nz)
	if rio.length() != gx * gz:
		return
	var di := int(round((float(g.x0) - X0) / 4.0)) # a grade do mapa tem a terra de fora em volta (_alem)
	var dj := int(round((float(g.z0) - Z0) / 4.0))
	for j in gz:
		for i in gx:
			if rio.unicode_at(j * gx + i) - 48 < RIO_AGUA:
				continue
			var fundo: float = hh[(j + dj) * nx + i + di]
			for b in range(maxi(0, j + dj - RIO_VOLTA), mini(nz, j + dj + RIO_VOLTA + 1)):
				for a in range(maxi(0, i + di - RIO_VOLTA), mini(nx, i + di + RIO_VOLTA + 1)):
					hv[b * nx + a] = minf(hv[b * nx + a], fundo)

static func _cor(v: float, incl: float, mata: float, praia: bool) -> Color:
	if v < 0.0:
		return Color8(196, 186, 140).lerp(Color8(40, 70, 90), clampf(-v / 6.0, 0.0, 1.0))
	var c := Color8(112, 118, 52) # grama oliva
	c = c.lerp(Color8(78, 98, 44), clampf(mata, 0.0, 1.0) * 0.85)
	c = c.lerp(Color8(134, 126, 80), clampf((v - 30.0) / 40.0, 0.0, 1.0) * 0.5)
	if v < 1.4 and praia:
		c = c.lerp(Color8(190, 172, 122), clampf(1.0 - v / 1.4, 0.0, 1.0))
	c = c.lerp(Color8(112, 104, 94), clampf((incl - 0.55) * 2.5, 0.0, 1.0)) # pedra nas encostas
	c = c.lerp(Color8(220, 224, 232), clampf((v - 95.0) / 20.0, 0.0, 1.0)) # neve nos picos
	return c

# k1 (-1..1) clareia ou escurece em manchas grandes; k2 puxa a grama para seca (amarelada) ou viçosa; cada faceta ainda
# varia um pouquinho (o low poly aparece). Na pedra e na neve a mancha é mais fraca
static func _manchar(c: Color, k1: float, k2: float, cx: Vector3, incl: float, v: float) -> Color:
	var grama := clampf(1.0 - (incl - 0.55) * 2.5, 0.0, 1.0) * clampf(1.0 - (v - 95.0) / 20.0, 0.0, 1.0)
	c = c.lerp(Color8(150, 140, 76), clampf(k2 * 1.6, 0.0, 1.0) * 0.3 * grama) # grama seca
	c = c.lerp(Color8(58, 92, 40), clampf(-k2 * 1.6, 0.0, 1.0) * 0.3 * grama) # grama viçosa, mais escura
	var luz := 1.0 + k1 * (0.24 * grama + 0.1) * (0.55 if k1 > 0.0 else 1.0) + (fmod(absf(cx.x * 12.9898 + cx.z * 78.233), 1.0) - 0.5) * 0.05
	return Color(clampf(c.r * luz, 0.0, 1.0), clampf(c.g * luz, 0.0, 1.0), clampf(c.b * luz, 0.0, 1.0))

# terreno e árvores: longe do mundo andável a cor vira névoa por igual (a luz sai e a névoa entra como emissão, da
# mesma cor do fundo), então a terra de fora some sem borda
var _nevoa_mat: ShaderMaterial
func _mat_nevoa() -> ShaderMaterial:
	if _nevoa_mat != null:
		return _nevoa_mat
	_nevoa_mat = ShaderMaterial.new()
	_nevoa_mat.shader = Shader.new()
	_nevoa_mat.shader.code = """shader_type spatial;
uniform vec4 jogo;
uniform float alem0;
uniform float alem;
uniform vec3 nevoa;
varying vec3 pw;
void vertex() { pw = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 q = max(max(jogo.xy - pw.xz, pw.xz - jogo.zw), vec2(0.0));
	float dq = length(q);
	float onda = sin(pw.x * 0.0061) * sin(pw.z * 0.0073 + 1.3) * 70.0 + sin(pw.x * 0.017 + pw.z * 0.013) * 28.0; // borda da névoa torta
	float k = smoothstep(alem0, alem, dq + onda * smoothstep(0.0, alem0, dq));
	vec3 c = COLOR.rgb;
	ALBEDO = c * (1.0 - k);
	ROUGHNESS = 1.0;
	SPECULAR = 0.5 * (1.0 - k);
	EMISSION = nevoa * k;
}"""
	_nevoa_mat.set_shader_parameter("jogo", Vector4(J0.x, J0.y, J1.x, J1.y))
	_nevoa_mat.set_shader_parameter("alem0", 90.0)
	_nevoa_mat.set_shader_parameter("alem", ALEM * 4.0 - 50.0)
	var nl := COR_NEVOA.srgb_to_linear()
	_nevoa_mat.set_shader_parameter("nevoa", Vector3(nl.r, nl.g, nl.b))
	return _nevoa_mat

func _mat(srgb := true) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.vertex_color_is_srgb = srgb
	mat.roughness = 1.0
	return mat

# roda na linha de fundo: monta a cena fora da árvore (nada entra no SubViewport aqui)
func _montar_cena() -> void:
	mundo3d = Node3D.new()
	var baixa: bool = m.grafico != null and int(m.grafico.nivel) == 0
	var sol := DirectionalLight3D.new()
	sol.rotation_degrees = Vector3(-48, -140, 0)
	sol.light_color = Color(1.0, 0.95, 0.85)
	sol.light_energy = 0.9
	sol.shadow_enabled = not baixa
	sol.directional_shadow_max_distance = 900
	mundo3d.add_child(sol)
	var we := WorldEnvironment.new()
	var env := Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = COR_NEVOA
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color8(150, 165, 190)
	env.ambient_light_energy = 0.5
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	we.environment = env
	mundo3d.add_child(we)
	cam = Camera3D.new()
	cam.fov = 42
	cam.near = 4.0
	cam.far = 4500.0
	mundo3d.add_child(cam)
	# terreno
	var mat_ter := _mat_nevoa()
	for chave in _dados.pedacos:
		var pd: Array = _dados.pedacos[chave]
		if (pd[0] as PackedVector3Array).is_empty():
			continue
		var arr := []
		arr.resize(Mesh.ARRAY_MAX)
		arr[Mesh.ARRAY_VERTEX] = pd[0]
		arr[Mesh.ARRAY_NORMAL] = pd[1]
		arr[Mesh.ARRAY_COLOR] = pd[2]
		var am := ArrayMesh.new()
		am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		var ter := MeshInstance3D.new()
		ter.mesh = am
		ter.material_override = mat_ter
		mundo3d.add_child(ter)
	# mar
	var pm := PlaneMesh.new()
	pm.size = Vector2(7000, 7000)
	var mar := MeshInstance3D.new()
	mar.mesh = pm
	mar.position = Vector3((X0 + ATE.x) * 0.5, -0.3, (Z0 + ATE.y) * 0.5)
	var mt := ShaderMaterial.new() # o mar também some na névoa longe do mundo andável
	mt.shader = Shader.new()
	mt.shader.code = """shader_type spatial;
render_mode cull_disabled;
uniform vec4 jogo; // x0, z0, x1, z1 do mundo andável
uniform float alem;
uniform vec3 nevoa;
varying vec3 pw;
void vertex() { pw = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 q = max(max(jogo.xy - pw.xz, pw.xz - jogo.zw), vec2(0.0));
	float dq = length(q);
	float onda = sin(pw.x * 0.0061) * sin(pw.z * 0.0073 + 1.3) * 70.0 + sin(pw.x * 0.017 + pw.z * 0.013) * 28.0;
	float k = clamp((dq + onda * smoothstep(0.0, 60.0, dq)) / alem, 0.0, 1.0);
	k = smoothstep(0.15, 1.0, k);
	ALBEDO = vec3(0.10, 0.30, 0.45) * (1.0 - k);
	ROUGHNESS = 0.7;
	SPECULAR = 0.2 * (1.0 - k);
	EMISSION = nevoa * k;
	ALPHA = mix(0.8, 1.0, k);
}"""
	mt.set_shader_parameter("jogo", Vector4(J0.x, J0.y, J1.x, J1.y))
	mt.set_shader_parameter("alem", ALEM * 4.0 - 50.0)
	mt.set_shader_parameter("nevoa", Vector3(COR_NEVOA.srgb_to_linear().r, COR_NEVOA.srgb_to_linear().g, COR_NEVOA.srgb_to_linear().b))
	mar.material_override = mt
	mar.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mundo3d.add_child(mar)
	# estradas (fitas por cima do chão, todas numa malha só)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	# rios e lagos numa malha própria que não recebe sombra (no fundo do vale a sombra do barranco apagava o rio)
	var sa := SurfaceTool.new()
	sa.begin(Mesh.PRIMITIVE_TRIANGLES)
	for r in g.get("rios", []):
		_fita(sa, r.curva, 16.0, COR_AGUA_BEIRA, 0.6, true)
		_fita(sa, r.curva, 11.0, COR_AGUA, 0.9, true)
	_lagos(sa)
	var agua := MeshInstance3D.new()
	agua.mesh = sa.commit()
	var ma := _mat()
	ma.cull_mode = BaseMaterial3D.CULL_DISABLED
	ma.disable_receive_shadows = true
	agua.material_override = ma
	agua.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mundo3d.add_child(agua)
	for e in g.get("estradas", []):
		_fita(st, e.curva, 3.5 if str(e.id).begins_with("t_") else 5.5, Color8(128, 96, 62), 2.2)
	# todas as outras estradas da rede do "Ir para" (rota.gd): caminhos do mapa de hoje e ruas das vilas com terreno
	# (André 2026-11-15: "queria que todas as estradas aparecessem, para a gente poder se guiar só pelo mapa")
	var linhas: Array = m.mundo.get("caminhos", [])
	if linhas.is_empty() and m.mundo.has("estrada"):
		linhas = [{"pontos": m.mundo.estrada, "largura": 4.0}]
	var vistas := {}
	for vt in m.mundo.get("vilasTerreno", []):
		for e in vt.get("estradas", []):
			var pts: Array = e.get("pontos", [])
			if pts.size() < 2:
				continue
			var chave := "%s|%s|%d" % [str(pts[0]), str(pts[pts.size() - 1]), pts.size()] # Aurora repete a estrada grande em cada bairro
			if vistas.has(chave):
				continue
			vistas[chave] = true
			linhas = linhas.duplicate()
			linhas.append(e)
	for L in linhas:
		var pts: Array = L.get("pontos", [])
		if pts.size() >= 2:
			_fita(st, pts, clampf(float(L.get("largura", 2.4)) * 1.3, 3.0, 6.0), Color8(128, 96, 62), 2.2)
	var fitas := MeshInstance3D.new()
	fitas.mesh = st.commit()
	var mf := _mat()
	mf.cull_mode = BaseMaterial3D.CULL_DISABLED
	fitas.material_override = mf
	fitas.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mundo3d.add_child(fitas)
	_mata(_dados.arvores)
	_vilas()
	_plantio()
	_dados = {}

# linha principal: só põe a cena pronta no SubViewport e cria o mapinha
func _encaixar() -> void:
	sv.add_child(mundo3d)
	cam.current = true
	# mapinha do mundo inteiro: câmera de cima, desenhado uma vez só
	mini_sv = SubViewport.new()
	mini_sv.world_3d = sv.find_world_3d()
	mini_sv.size = Vector2i(240, int(240.0 * (ATE.y - Z0) / (ATE.x - X0)))
	mini_sv.render_target_update_mode = SubViewport.UPDATE_DISABLED # desenha ao abrir (fechado não pesa no jogo)
	add_child(mini_sv)
	var mc := Camera3D.new()
	mc.projection = Camera3D.PROJECTION_ORTHOGONAL
	mc.size = ATE.y - Z0
	mc.far = 3000
	mc.position = Vector3((X0 + ATE.x) * 0.5, 1200, (Z0 + ATE.y) * 0.5)
	mc.rotation_degrees = Vector3(-90, 0, 0)
	mini_sv.add_child(mc)
	mc.current = true
	cam.make_current()

# o terreno é desenhado em facetas de 8 m: a fita usa o canto mais alto da faceta embaixo dela, senão some no morro
func _alto_faceta(x: float, z: float) -> float:
	var i := int(floor((x - X0) / (4.0 * PASSO))) * PASSO
	var j := int(floor((z - Z0) / (4.0 * PASSO))) * PASSO
	var v := -100.0
	for b in [j, j + PASSO]:
		for a in [i, i + PASSO]:
			v = maxf(v, hh[clampi(b, 0, nz - 1) * nx + clampi(a, 0, nx - 1)])
	if v < -99.0:
		return alt(x, z)
	return minf(_y(v), alt(x, z) + 6.0)

func _fita(st: SurfaceTool, curva: Array, largura: float, cor: Color, sobe: float, rio := false) -> void:
	var pts: Array[Vector3] = []
	for p in curva:
		var x := float(p[0])
		var z := float(p[1])
		var y := _alto_faceta(x, z)
		if rio: # a água do rio (3º número da curva) por cima do leito cavado (_cavar_rios)
			y = maxf(_y(float(p[2])) if p.size() > 2 else alt(x, z), _fundo_cavado(x, z))
		pts.append(Vector3(x, y + sobe, z))
	for k in range(pts.size() - 1):
		var d := pts[k + 1] - pts[k]
		d.y = 0.0
		if d.length() < 0.01:
			continue
		var s := Vector3(-d.z, 0.0, d.x).normalized() * largura * 0.5
		st.set_color(cor)
		st.set_normal(Vector3.UP)
		var tri := [pts[k] - s, pts[k] + s, pts[k + 1] + s, pts[k] - s, pts[k + 1] + s, pts[k + 1] - s]
		if rio: # água de frente para cima (de costas a luz vinha de baixo e o rio saía quase preto)
			tri.reverse()
		for v in tri:
			st.add_vertex(v)

const COR_AGUA := Color8(48, 104, 140)
const COR_AGUA_BEIRA := Color8(30, 64, 84)

# chão cavado mais alto em volta de (x, z), para a fita do rio não sumir dentro da faceta
func _fundo_cavado(x: float, z: float) -> float:
	var i := int(floor((x - X0) / (4.0 * PASSO))) * PASSO
	var j := int(floor((z - Z0) / (4.0 * PASSO))) * PASSO
	var v := -100.0
	for b in [j, j + PASSO]:
		for a in [i, i + PASSO]:
			v = maxf(v, hv[clampi(b, 0, nz - 1) * nx + clampi(a, 0, nx - 1)])
	return _y(v)

# Lagos do mapa de hoje (Lago Grande, Lago Fundo...): no mundo eles são um buraco no chão (terreno.gd, no_lago), mas a
# grade do mapa tem o chão do mapa de hoje todo plano, então o 3D não tinha lago nenhum. Aqui cada lago vira uma
# lâmina de água com a mesma forma do jogo (elipse com lobos, terreno.margem_lago), com a beira mais escura em volta.
func _lagos(st: SurfaceTool) -> void:
	for l in m.mundo.get("lagos", []):
		var L := {"x": float(l.x), "z": float(l.z), "rx": float(l.rx), "rz": float(l.rz), "lobos": l.get("lobos", []),
			"c": cos(float(l.get("giro", 0.0))), "s": sin(float(l.get("giro", 0.0)))}
		# altura: acima do chão mais alto embaixo do lago (as facetas de 8 m são maiores que os lagos pequenos)
		var y := -100.0
		var R := maxf(L.rx, L.rz) * 1.3
		for dz in range(-1, 2):
			for dx in range(-1, 2):
				y = maxf(y, _alto_faceta(L.x + dx * R, L.z + dz * R))
		_lamina(st, L, 1.0 + 3.5 / minf(L.rx, L.rz), y + 0.6, COR_AGUA_BEIRA)
		_lamina(st, L, 1.0, y + 0.9, COR_AGUA)

func _lamina(st: SurfaceTool, L: Dictionary, escala: float, y: float, cor: Color) -> void:
	const N := 40
	var c := Vector3(L.x, y, L.z)
	var borda: Array[Vector3] = []
	for n in N:
		var t := TAU * n / N
		var k := 1.0
		for lb in L.lobos:
			k *= 1.0 + float(lb[1]) * sin(float(lb[0]) * t + float(lb[2]))
		var u: float = cos(t) * L.rx * k * escala
		var v: float = sin(t) * L.rz * k * escala
		borda.append(Vector3(L.x + u * L.c - v * L.s, y, L.z + u * L.s + v * L.c))
	st.set_color(cor)
	st.set_normal(Vector3.UP)
	for n in N:
		st.add_vertex(c)
		st.add_vertex(borda[n])
		st.add_vertex(borda[(n + 1) % N])

func _mata(lista: Array) -> void:
	var pinheiro := CylinderMesh.new()
	pinheiro.top_radius = 0.0
	pinheiro.bottom_radius = 3.2
	pinheiro.height = 11.0
	pinheiro.radial_segments = 6
	pinheiro.rings = 1
	var copa := SphereMesh.new()
	copa.radius = 4.2
	copa.height = 7.0
	copa.radial_segments = 7
	copa.rings = 4
	var tronco := CylinderMesh.new()
	tronco.top_radius = 0.5
	tronco.bottom_radius = 0.7
	tronco.height = 4.0
	tronco.radial_segments = 5
	tronco.rings = 1
	var redondas := []
	var pontudas := []
	for p in lista:
		(redondas if int(absf(p.x * 13.0 + p.y * 7.0)) % 3 == 0 else pontudas).append(p)
	_multi(pinheiro, pontudas, 7.5, Color8(40, 72, 42))
	_multi(copa, redondas, 6.0, Color8(92, 116, 44))
	_multi(tronco, lista, 2.0, Color8(80, 56, 36))

func _multi(mesh: Mesh, lista: Array, sobe: float, cor: Color) -> void:
	var mmu := MultiMesh.new()
	mmu.transform_format = MultiMesh.TRANSFORM_3D
	mmu.use_colors = true
	mmu.mesh = mesh
	mmu.instance_count = lista.size()
	for n in lista.size():
		var p: Vector2 = lista[n]
		var s := 0.8 + fmod(absf(p.x * 7.3 + p.y * 3.1), 0.6)
		mmu.set_instance_transform(n, Transform3D(Basis().scaled(Vector3(s, s, s)), Vector3(p.x, alt(p.x, p.y) + sobe * s, p.y)))
		mmu.set_instance_color(n, cor.lightened(fmod(absf(p.x + p.y), 1.0) * 0.12))
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mmu
	mi.material_override = _mat_nevoa()
	mundo3d.add_child(mi)

func _vilas() -> void:
	var casas := [] # [x, z, ry, cor do telhado]
	for v in m.mundo.get("vilasMundo", []):
		for c in v.get("casas", []):
			casas.append([float(c.x), float(c.z), float(c.get("ry", 0.0)), Color8(170, 66, 50)])
	# as vilas do mapa de hoje: algumas casinhas de telhado azul onde elas ficam
	var nasc: Dictionary = m.mundo.get("nascimento", {"x": 0.0, "z": 1.0})
	var vl: Dictionary = m.mundo.get("vilaLotes", {})
	for centro in [Vector2(float(nasc.get("x", 0.0)), float(nasc.get("z", 1.0))), Vector2(float(vl.get("x", -13.5)), float(vl.get("z", 88.0)))]:
		for a in [[0, -10, 0.3], [10, 4, -0.5], [-9, 8, 1.2], [3, 14, 0.1]]:
			casas.append([centro.x + a[0], centro.y + a[1], a[2], Color8(70, 90, 150)])
	var parede := BoxMesh.new()
	parede.size = Vector3(6, 4, 8) * 1.3
	var telhado := PrismMesh.new()
	telhado.size = Vector3(7.2, 3.5, 8.8) * 1.3
	for parte in 2:
		var mmu := MultiMesh.new()
		mmu.transform_format = MultiMesh.TRANSFORM_3D
		mmu.use_colors = true
		mmu.mesh = parede if parte == 0 else telhado
		mmu.instance_count = casas.size()
		for n in casas.size():
			var c: Array = casas[n]
			var y := alt(c[0], c[1]) + (2.6 if parte == 0 else 7.4)
			mmu.set_instance_transform(n, Transform3D(Basis(Vector3.UP, c[2]), Vector3(c[0], y, c[1])))
			mmu.set_instance_color(n, Color8(222, 206, 170) if parte == 0 else c[3])
		var mi := MultiMeshInstance3D.new()
		mi.multimesh = mmu
		mi.material_override = _mat()
		mundo3d.add_child(mi)

func _plantio() -> void:
	if _quads_plantio.is_empty():
		return
	# André 2026-11-16: pinheirinhos verde-claro em fileiras (cara de plantação) no lugar dos quadrados amarelos.
	# Um a cada 12 m (3 x 3 quadrados) que tenha ao menos 3 quadrados de área; a mata de verdade é escura e solta.
	var cel := {}
	for q in _quads_plantio:
		var c := Vector2i(floori(q.x / 3.0), floori(q.y / 3.0))
		cel[c] = int(cel.get(c, 0)) + 1
	var pontos := []
	for c in cel:
		if int(cel[c]) >= 3:
			pontos.append(Vector2((c.x + 0.5) * 12.0, (c.y + 0.5) * 12.0))
	_quads_plantio = {}
	if pontos.is_empty():
		return
	var folhas := CylinderMesh.new()
	folhas.top_radius = 0.0
	folhas.bottom_radius = 2.4
	folhas.height = 6.5
	folhas.radial_segments = 6
	folhas.rings = 1
	var tronco := CylinderMesh.new()
	tronco.top_radius = 0.35
	tronco.bottom_radius = 0.45
	tronco.height = 2.0
	tronco.radial_segments = 5
	tronco.rings = 1
	plantio_mi = MultiMeshInstance3D.new()
	plantio_mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	for parte in [[folhas, 5.0, Color8(96, 170, 72)], [tronco, 1.0, Color8(96, 66, 40)]]:
		var mmu := MultiMesh.new()
		mmu.transform_format = MultiMesh.TRANSFORM_3D
		mmu.use_colors = true
		mmu.mesh = parte[0]
		mmu.instance_count = pontos.size()
		for n in pontos.size():
			var p: Vector2 = pontos[n]
			mmu.set_instance_transform(n, Transform3D(Basis(), Vector3(p.x, alt(p.x, p.y) + parte[1], p.y)))
			mmu.set_instance_color(n, (parte[2] as Color).lightened(fmod(absf(p.x * 0.37 + p.y * 0.21), 1.0) * 0.08))
		var mi := MultiMeshInstance3D.new()
		mi.multimesh = mmu
		mi.material_override = _mat_nevoa()
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		plantio_mi.add_child(mi)
	mundo3d.add_child(plantio_mi)

# ---------- toque ----------

func entrada(ev: InputEvent) -> void:
	if ev is InputEventMouseButton and ev.pressed and (ev.button_index == MOUSE_BUTTON_WHEEL_UP or ev.button_index == MOUSE_BUTTON_WHEEL_DOWN):
		if mm._painel().has_point(ev.position): # roda em cima da lista (PC): rola a lista
			mm.rolar = clampf(mm.rolar + (-40.0 if ev.button_index == MOUSE_BUTTON_WHEEL_UP else 40.0), 0.0, maxf(0.0, mm.lista_alt - mm._painel().size.y))
			marcas.queue_redraw()
			return
		dist_alvo = clampf(dist_alvo * (1.0 / 1.15 if ev.button_index == MOUSE_BUTTON_WHEEL_UP else 1.15), DIST_MIN, DIST_MAX)
		return
	if ev is InputEventMouseMotion and (ev.button_mask & MOUSE_BUTTON_MASK_RIGHT): # PC: botão direito gira e inclina
		giro_alvo -= ev.relative.x * 0.006
		giro = giro_alvo
		incl_alvo = clampf(incl_alvo + ev.relative.y * 0.25, INCL_MIN, INCL_MAX)
		incl = incl_alvo
		return
	if ev is InputEventScreenTouch:
		if ev.pressed:
			if toques.is_empty():
				arrastou = false
			toques[ev.index] = {"p": ev.position, "ini": ev.position}
			if toques.size() == 2:
				var ks: Array = toques.keys()
				var p0: Vector2 = toques[ks[0]].p
				var p1: Vector2 = toques[ks[1]].p
				pinca = {"d": p0.distance_to(p1), "dist": dist, "ang": (p1 - p0).angle(), "giro": giro_alvo,
					"meio": (p0 + p1) * 0.5, "incl": incl_alvo, "modo": ""}
			return
		var t = toques.get(ev.index)
		toques.erase(ev.index)
		if mm.ignorar.has(ev.index): # o toque que abriu o mapa
			mm.ignorar.erase(ev.index)
			return
		if toques.size() < 2:
			pinca = {}
		if t != null and not arrastou and toques.is_empty():
			_toque(ev.position)
		return
	if ev is InputEventScreenDrag:
		if not toques.has(ev.index) or mm.ignorar.has(ev.index):
			return
		var td: Dictionary = toques[ev.index]
		td.p = ev.position
		if mm.filtro.cobre(td.ini - get_global_rect().position): # dedo no filtro não arrasta o mapa
			return
		if mm._painel().has_point(td.ini): # dedo na lista: rola a lista
			if ev.position.distance_to(td.ini) > 12.0:
				arrastou = true
			if arrastou:
				mm.rolar = clampf(mm.rolar - ev.relative.y, 0.0, maxf(0.0, mm.lista_alt - mm._painel().size.y))
				marcas.queue_redraw()
			return
		if toques.size() >= 2 and not pinca.is_empty():
			_dois_dedos()
			arrastou = true
			return
		if not arrastou and ev.position.distance_to(td.ini) > 12.0:
			arrastou = true
		if arrastou and cam != null:
			# metros por px no meio da tela, mais ou menos: anda o mapa junto com o dedo
			var k: float = dist * tan(deg_to_rad(cam.fov * 0.5)) * 2.0 / maxf(size.y, 1.0)
			var dx: float = ev.relative.x * k
			var dz: float = ev.relative.y * k / sin(deg_to_rad(incl))
			foco_alvo -= Vector3(dx * cos(giro) + dz * sin(giro), 0.0, -dx * sin(giro) + dz * cos(giro)) # girado junto
			foco_alvo.x = clampf(foco_alvo.x, J0.x - 150.0, J1.x + 150.0)
			foco_alvo.z = clampf(foco_alvo.z, J0.y - 150.0, J1.y + 150.0)
			foco = foco_alvo

# dois dedos: pinça aproxima, girar gira, os dois arrastando juntos na vertical inclinam. O gesto escolhe o modo no
# começo (inclinar fica sozinho; aproximar e girar andam juntos, como no mapa do celular)
func _dois_dedos() -> void:
	var ks: Array = toques.keys()
	var p0: Vector2 = toques[ks[0]].p
	var p1: Vector2 = toques[ks[1]].p
	var d := p0.distance_to(p1)
	var da := wrapf((p1 - p0).angle() - float(pinca.ang), -PI, PI)
	var dm: Vector2 = (p0 + p1) * 0.5 - (pinca.meio as Vector2)
	var dd: float = d - float(pinca.d)
	if pinca.modo == "":
		if absf(dm.y) > 24.0 and absf(dd) < 30.0 and absf(da) < 0.12:
			pinca.modo = "inclinar"
		elif absf(da) > 0.14 or absf(dd) > 24.0:
			pinca.modo = "girar"
		else:
			return
	if pinca.modo == "inclinar":
		incl_alvo = clampf(float(pinca.incl) + dm.y * 0.22, INCL_MIN, INCL_MAX)
		incl = incl_alvo
		return
	dist = clampf(float(pinca.dist) * float(pinca.d) / maxf(d, 1.0), DIST_MIN, DIST_MAX)
	dist_alvo = dist
	giro_alvo = float(pinca.giro) + da
	giro = giro_alvo

func _toque(pos: Vector2) -> void:
	var lp := pos - get_global_rect().position
	marcas.queue_redraw() # o toque muda o desenho na hora (pino, filtro, legenda), sem esperar a câmera mexer
	if mm.filtro.toque(lp): # filtro das camadas (André 2026-11-16)
		marcas.queue_redraw()
		return
	if mm.icones.botao_legenda.has_point(lp): # abre e fecha a legenda
		legenda_aberta = not legenda_aberta
		marcas.queue_redraw()
		return
	if b_x.has_point(lp):
		mm.fechar()
		return
	if b_2d.has_point(lp):
		mm.trocar_modo(false)
		return
	if not mm.totem_de.is_empty(): # mapa do totem: escolher o totem e teleportar
		if b_mais.has_point(lp) or b_menos.has_point(lp):
			dist_alvo = clampf(dist_alvo * (1.0 / 1.45 if b_mais.has_point(lp) else 1.45), DIST_MIN, DIST_MAX)
		elif b_eu.has_point(lp):
			ver_totens()
		else:
			_toque_totem(lp)
		return
	if b_nevoa.has_point(lp):
		nevoa_no_mapa = not nevoa_no_mapa
		if m.sons:
			m.sons.tocar("pano", -16.0)
		return
	if b_lista.has_point(lp):
		lista_aberta = not lista_aberta
		_arrumar_lista(false)
		if m.sons:
			m.sons.tocar("pano", -16.0)
		return
	var sel_antes: String = mm.selecionado
	if mm._toque_lista(pos): # lista de Lugares: marca o lugar e leva a câmera até ele
		if mm.aberto and mm.selecionado != "" and mm.selecionado != sel_antes:
			foco_alvo = Vector3(mm.foco_alvo.x, 0.0, mm.foco_alvo.y)
			dist_alvo = minf(dist_alvo, DIST_ABRIR)
		return
	if mm.marcado != null and b_ir.has_point(lp):
		mm._ir()
		return
	if b_mais.has_point(lp) or b_menos.has_point(lp):
		dist_alvo = clampf(dist_alvo * (1.0 / 1.45 if b_mais.has_point(lp) else 1.45), DIST_MIN, DIST_MAX)
		if m.sons:
			m.sons.tocar("pano", -16.0)
		return
	if b_bussola.has_point(lp): # volta ao norte e ao ângulo de quando abre
		giro_alvo = 0.0
		incl_alvo = INCL
		if m.sons:
			m.sons.tocar("pano", -16.0)
		return
	if b_eu.has_point(lp) and m.heroi != null:
		foco_alvo = Vector3(m.heroi.position.x, 0, m.heroi.position.z)
		dist_alvo = DIST_ABRIR
		return
	if not pronto or m.rota == null:
		return
	var w = _no_chao(lp)
	if w != null:
		mm._marcar(w)
		mm.selecionado = ""

# ponto do chão embaixo do dedo: anda pelo raio da câmera até passar do relevo
func _no_chao(lp: Vector2):
	var o := cam.project_ray_origin(lp)
	var d := cam.project_ray_normal(lp)
	if d.y >= -0.01:
		return null
	var t := 0.0
	var passo := 6.0
	while t < 6000.0:
		var p := o + d * t
		if p.y <= alt(p.x, p.z):
			if p.x < J0.x or p.x > J1.x or p.z < J0.y or p.z > J1.y: # terra sem acesso não marca
				return null
			return Vector2(p.x, p.z)
		t += passo
	return null

# ---------- desenho por cima (nomes, herói, pino, botões, mapinha) ----------

func _na_tela(x: float, z: float, sobe := 0.0):
	var p := Vector3(x, alt(x, z) + sobe, z)
	if cam.is_position_behind(p):
		return null
	return cam.unproject_position(p)

func _desenhar() -> void:
	var c := marcas
	var tam := size
	if not pronto:
		c.draw_string(fonte, tam * 0.5 + Vector2(-120, 0), Idioma.frase("Montando o mapa…"), HORIZONTAL_ALIGNMENT_CENTER, 240, 22, Color8(250, 232, 190))
		_botoes(c, tam)
		return
	var tm: bool = not mm.totem_de.is_empty() # encostou num totem: o mapa mostra os totens para viajar
	_arrumar_lista(tm)
	var lw: float = mm.LARGURA_LISTA if mm.painel_3d.has_area() else 0.0 # a lista de Lugares ocupa a direita
	var perto := dist < 900.0
	var longe := dist > LONGE # de longe, como no 2D afastado: só os símbolos, sem nomes miúdos nem NPCs
	var em := func(x: float, z: float) -> Vector2: return _em(x, z, 4.0)
	var k := _px_por_metro()
	if not tm:
		if nevoa_no_mapa:
			_nevoa(c, tam, longe) # zonas ainda fechadas pela névoa, como no 2D
		_terras(c, tam, longe)
	# rota sendo andada (o herói já vai indo): a mesma fita dourada da prévia
	if m.rota and m.rota.ativo and mm.marcado == null:
		_rota(c, m.rota.caminho, int(m.rota.i))
	# rota planejada e pino
	if mm.marcado != null and mm.previa.size() > 1:
		var ant = null
		for q in mm.previa:
			var s = _na_tela(q.x, q.y, 3.0)
			if s != null and ant != null:
				c.draw_line(ant, s, Color(0.05, 0.04, 0.03, 0.6), 5.0, true)
				c.draw_line(ant, s, Color("ffd27a"), 3.0, true)
			ant = s
	if not tm:
		_simbolos(c, tam, em, k, longe) # tudo o que o mapa 2D mostra: veios, caça, chefes, dungeons, totens, NPCs, casa...
	for l in (mm._lugares() if not tm else []): # no mapa do totem só os nomes dos totens (os outros embolam)
		var tipo := str(l.get("tipo", ""))
		if tipo != "vila":
			continue
		if not mm.filtro.ok("vilas"):
			continue
		var s = _na_tela(float(l.x), float(l.z), 8.0)
		if s == null or s.x < -60 or s.y < -30 or s.x > tam.x + 60 or s.y > tam.y + 30:
			continue
		_fita2d(c, s - Vector2(0, 20), str(l.get("curto", l.get("nome", ""))), 17 if perto else 13, l)
	for v in (m.mundo.get("vilasMundo", []) if mm.filtro.ok("vilas") and not tm else []): # as vilas do mundo grande (com o nível)
		var s = _na_tela(float(v.x), float(v.z), 8.0)
		if s == null or s.x < -60 or s.y < -30 or s.x > tam.x + 60 or s.y > tam.y + 30:
			continue
		_fita2d(c, s - Vector2(0, 20), str(v.nome), 17 if perto else 13, {"nivel": int(v.get("nivel", 0))})
	if mm.marcado != null:
		var sm = _na_tela(mm.marcado.x, mm.marcado.y, 2.0)
		if sm != null:
			mm._pino(c, sm, 1.15)
	if not tm:
		_pessoas(c, em) # jogadores perto, o time e os amigos virtuais
	# herói
	if m.heroi != null:
		var hp: Vector3 = m.heroi.position
		var sh = _na_tela(hp.x, hp.z, 3.0)
		if sh != null:
			c.draw_circle(sh, 13.0, Color(1, 0.85, 0.4, 0.22))
			var fr: Vector2 = mm._frente_heroi()
			var sf = _na_tela(hp.x + fr.x * 6.0, hp.z + fr.y * 6.0, 3.0) # a seta segue o giro e a inclinação
			mm._seta(c, sh, (sf - sh).normalized() if sf != null and sf != sh else fr, 11.0, COR_OURO)
	if tm:
		_totens(c, tam, em)
	_mapinha(c, Vector2(tam.x - lw, tam.y))
	_botoes(c, tam, lw, tm)
	if plantio_mi != null:
		plantio_mi.visible = mm.filtro.ok("plantio") and not tm
	if tm:
		_botao_teleportar(c, tam, em)
		return
	if lw > 0.0:
		mm._desenhar_lista(c) # a lista de Lugares do 2D, a mesma (sanfona, toque marca, de novo vai)
	# a mesma legenda dos símbolos do 2D, embaixo à esquerda; no 3D começa fechada (só o botão "Legenda") para não
	# tapar a maquete, e lembra se foi aberta (estado próprio, o do 2D não muda)
	var leg_2d: bool = mm.icones.legenda_aberta
	mm.icones.legenda_aberta = legenda_aberta
	mm.icones.legenda(c, mm, fonte, tam)
	mm.icones.legenda_aberta = leg_2d
	mm.filtro.desenhar(c, Vector2(12, 58), fonte) # filtro das camadas, embaixo da barra de cima

# ---------- o que o mapa 2D mostra, no 3D (André 2026-11-16: "tudo que tiver no mapa 2D eu quero que apareça no 3D,
# os spots de monstro e tudo mais, de maneira condizente com o mapa; que fique bonito, mas funcional") ----------
# Os símbolos são os mesmos do 2D (minimapa.gd e icones_npc.gd), desenhados por cima da maquete no ponto do chão de
# cada coisa, com uma sombrinha no chão para parecerem pousados no relevo. Barato: só contas de projeção e draw_*,
# nada novo no mundo 3D; o que está fora da tela nem é desenhado.

var legenda_aberta := false
const LONGE := 700.0 # câmera mais longe que isto: sem NPCs e sem os nomes pequenos (embolam)
const FORA := Vector2(-99999, -99999)

# ponto da tela de um lugar do mundo; fora da tela (ou atrás da câmera) devolve FORA, que os desenhos pulam
func _em(x: float, z: float, sobe := 4.0) -> Vector2:
	var s = _na_tela(x, z, sobe)
	return s if s != null else FORA

# px por metro perto do meio da tela (o tamanho dos símbolos e quando os nomes cabem, como o zoom do 2D)
func _px_por_metro() -> float:
	var f := Vector3(foco.x, alt(foco.x, foco.z), foco.z)
	var lado := cam.global_transform.basis.x # o mapa pode estar girado: mede na horizontal da tela
	return cam.unproject_position(f).distance_to(cam.unproject_position(f + Vector3(lado.x, 0, lado.z).normalized() * 10.0)) / 10.0

func _na_tela_ok(q: Vector2, tam: Vector2, borda := 40.0) -> bool:
	return q.x > -borda and q.y > -borda and q.x < tam.x + borda and q.y < tam.y + borda

# sombra oval no chão embaixo do símbolo (achatada como o chão visto de lado)
func _sombra(c: Control, q: Vector2, r: float) -> void:
	c.draw_set_transform(q + Vector2(0, r * 0.9), 0.0, Vector2(1.0, 0.42))
	c.draw_circle(Vector2.ZERO, r * 1.1, Color(0, 0, 0, 0.28))
	c.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

func _rota(c: Control, r: PackedVector2Array, de: int) -> void:
	var ant = null
	for i in range(maxi(de - 1, 0), r.size()):
		var s = _na_tela(r[i].x, r[i].y, 3.0)
		if s != null and ant != null:
			c.draw_line(ant, s, Color(0.05, 0.04, 0.03, 0.6), 5.0, true)
			c.draw_line(ant, s, Color("ffd27a"), 3.0, true)
		ant = s

# névoa: a mancha lilás de cada região ainda fechada, com o nome e a missão que abre (o mesmo do 2D). O contorno é
# cortado um pouco à frente da câmera antes de projetar (ponto atrás da câmera não tem lugar na tela).
const COR_NEVOA_3D := Color(0.78, 0.74, 0.92, 0.4) # a lilás do 2D, mais clara: o relevo aparece por baixo
func _nevoa(c: Control, tam: Vector2, longe: bool) -> void:
	if m.get("nevoa") == null:
		return
	var cz: float = cam.global_position.z - 30.0
	var corte := PackedVector2Array([Vector2(-1e5, -1e5), Vector2(1e5, -1e5), Vector2(1e5, cz), Vector2(-1e5, cz)])
	var tela := Rect2(Vector2(-50, -50), tam + Vector2(100, 100))
	var perto := Rect2(foco.x - dist * 2.5, foco.z - dist * 3.0, dist * 5.0, dist * 4.0) # o chão que a câmera alcança
	for Z in m.nevoa.H.get("zonas", []):
		var id := str(Z.id)
		if Z.get("selo", false) or m.nevoa.liberado(id):
			continue
		var zp: Dictionary = _pol_nevoa(Z)
		if zp.pol.size() < 3 or not (zp.caixa as Rect2).intersects(perto):
			continue
		var soma := Vector2.ZERO
		var n := 0
		for pc in Geometry2D.intersect_polygons(zp.pol, corte):
			var tl := PackedVector2Array()
			var caixa := Rect2()
			for w in pc:
				var s = _na_tela(w.x, w.y, 2.0)
				if s == null:
					tl = PackedVector2Array()
					break
				tl.append(s)
				caixa = Rect2(s, Vector2.ZERO) if tl.size() == 1 else caixa.expand(s)
			if tl.size() < 3 or not caixa.intersects(tela):
				continue
			if not Geometry2D.triangulate_polygon(tl).is_empty(): # contorno que se cruza na tela: só a linha
				c.draw_colored_polygon(tl, COR_NEVOA_3D)
			c.draw_polyline(tl + PackedVector2Array([tl[0]]), Color(0.93, 0.9, 1.0, 0.7), 1.5, true)
			var meio := caixa.get_center().clamp(Vector2(80, 70), tam - Vector2(80, 60))
			if tela.has_point(meio):
				soma += meio
				n += 1
		if n == 0 or longe: # de longe só a mancha (os nomes embolam com os das vilas)
			continue
		var M: Dictionary = m.nevoa.H.missoes[int(m.nevoa.quem_libera[id])]
		var centro := soma / n
		mm._texto(c, centro, "Névoa: %s" % Z.nome, 14, Color("e6dcff"))
		mm._texto(c, centro + Vector2(0, 16), "Missão Nv %d (%s)" % [int(M.nv), str(M.get("npcNome", M.npc))], 12, Color(0.85, 0.82, 0.78))

# contorno de cada zona da névoa, simplificado (até ~90 pontos: de longe uma mancha não precisa de mais) e guardado
var _pols_nevoa := {}
func _pol_nevoa(Z: Dictionary) -> Dictionary:
	var id := str(Z.id)
	if not _pols_nevoa.has(id):
		var lista = Z.get("poligono")
		var pol := PackedVector2Array()
		var caixa := Rect2()
		if lista is Array and lista.size() >= 3:
			var passo: int = maxi(1, lista.size() / 90)
			for i in range(0, lista.size(), passo):
				var w := Vector2(float(lista[i][0]), float(lista[i][1]))
				pol.append(w)
				caixa = Rect2(w, Vector2.ZERO) if pol.size() == 1 else caixa.expand(w)
		_pols_nevoa[id] = {"pol": pol, "caixa": caixa}
	return _pols_nevoa[id]

# o nome de cada terra (continente, ilha, Aurora) com a faixa de nível, como no 2D
func _terras(c: Control, tam: Vector2, longe: bool) -> void:
	if not mm.filtro.ok("vilas"):
		return
	for t in g.get("terras", []):
		var nv: Array = t.get("niveis", [])
		var tx: float = float(t.x) if t.has("x") else float(g.x0) + float(g.nx) * float(g.passo) * 0.5
		var tz: float = float(t.z) - float(t.rz) * 0.97 if t.has("z") else (float(t.costa) - 560.0 if str(t.get("forma", "")) == "norte" else float(t.costa) + 60.0)
		var q := _em(tx, tz, 12.0)
		if not _na_tela_ok(q, tam, 0.0):
			continue
		mm._texto(c, q, "%s%s" % [str(t.nome), "  (Nv %d-%d)" % [int(nv[0]), int(nv[1])] if nv.size() == 2 else ""], 22 if not longe else 18, Color("f4e6c4"))

func _simbolos(c: Control, tam: Vector2, em: Callable, k: float, longe: bool) -> void:
	var t: float = clampf(k * 1.6, 7.0, 11.0) # meio tamanho dos símbolos, cresce um pouco de perto
	# portos e postos do mundo grande (as vilas têm a fita com o nome)
	if mm.filtro.ok("vilas"):
		for l in g.get("lugares", []):
			var tl := str(l.get("tipo", ""))
			if tl != "porto" and tl != "posto":
				continue
			var q := _em(float(l.x), float(l.z))
			if not _na_tela_ok(q, tam):
				continue
			c.draw_circle(q, 5.0, Color(0.05, 0.04, 0.03, 0.85))
			c.draw_circle(q, 3.6, Color(1, 0.95, 0.85))
			if not longe:
				mm._texto(c, q + Vector2(0, -13), str(l.get("nome", "")), 13, Color(1, 0.95, 0.85))
	# veios de minério: losango na cor do minério; os grandes com o nome de perto
	for mn in (m.mundo.get("mina", []) if mm.filtro.ok("recursos") else []):
		var miudo: bool = mn.get("pequeno", false) or mn.get("mundo", false)
		if longe and miudo:
			continue
		var q := _em(float(mn.x), float(mn.z), 2.0)
		if not _na_tela_ok(q, tam):
			continue
		var cm: Color = mm.COR_MINA.get(str(mn.get("tipo", "")), Color("d9822b"))
		var r := 6.0 if not miudo else 4.5
		c.draw_colored_polygon(PackedVector2Array([q + Vector2(0, -r - 1.5), q + Vector2(r + 1.5, 0), q + Vector2(0, r + 1.5), q + Vector2(-r - 1.5, 0)]), Color(0.05, 0.04, 0.03, 0.85))
		c.draw_colored_polygon(PackedVector2Array([q + Vector2(0, -r), q + Vector2(r, 0), q + Vector2(0, r), q + Vector2(-r, 0)]), cm)
		if not miudo and not longe:
			mm._texto(c, q + Vector2(0, -15), str(mn.get("nome", "Veio")), 13, Color("f2b56b") if str(mn.get("tipo", "cobre")) == "cobre" else cm.lightened(0.35))
	# spots de pesca (Radar ligado)
	if m.get("pesca") and m.pesca.radar_ligado():
		for id in m.pesca.spots:
			var v: Dictionary = m.pesca.spots[id]
			var q := _em(v.x, v.z, 1.0)
			if not _na_tela_ok(q, tam):
				continue
			mm._marca_spot(c, q, 7.0, m.pesca.cor_spot(v.tipo))
			if not longe:
				mm._texto(c, q + Vector2(0, 18), str(m.P.dados.pesca.spots[v.tipo].nome), 12, m.pesca.cor_spot(v.tipo).lightened(0.3))
	# dungeons (todas as cavernas da lista do mapa)
	if mm.filtro.ok("dungeon"):
		for l in mm._lugares():
			if str(l.get("tipo", "")) != "caverna":
				continue
			var q := _em(float(l.x), float(l.z), 6.0)
			if not _na_tela_ok(q, tam):
				continue
			_sombra(c, q, t)
			mm._marca_caverna(c, q, t + 1.0)
			if not longe:
				mm._texto(c, q + Vector2(0, t + 14.0), str(l.get("curto", l.get("nome", ""))), 14, Color("ffc27a"))
	# totens de teleporte: o losango azul (cinza se ainda não visitado)
	if m.get("totem") and mm.filtro.ok("totens"):
		for tt in m.totem.T.lista:
			var q := _em(float(tt.x), float(tt.z), 6.0)
			if not _na_tela_ok(q, tam):
				continue
			var aceso: bool = m.totem.descoberto(str(tt.id))
			_sombra(c, q, t * 0.8)
			mm._marca_totem(c, q, t, aceso)
			if not longe:
				mm._texto(c, q + Vector2(0, t + 10.0), "Totem", 12, Color("9fe6ff") if aceso else Color(0.75, 0.8, 0.85))
	# a minha casa: o contorno do terreno tracejado no chão e a casinha
	var casa: Dictionary = mm._minha_casa()
	if not casa.is_empty() and mm.filtro.ok("vilas"):
		var cs := [em.call(casa.x0, casa.z0), em.call(casa.x1, casa.z0), em.call(casa.x1, casa.z1), em.call(casa.x0, casa.z1)]
		if not cs.has(FORA):
			for i in 4:
				c.draw_dashed_line(cs[i], cs[(i + 1) % 4], Color(COR_OURO, 0.85), 1.5, 4.0, true)
		var qa := _em(casa.x, casa.z, 6.0)
		if _na_tela_ok(qa, tam):
			_sombra(c, qa, t)
			mm._marca_casa(c, qa, t + 2.0)
			mm._texto(c, qa + Vector2(0, t + 16.0), "Sua casa", 15, Color("ffb39a"))
	# clareiras de caça (bolinha na cor do bicho com o nível) e os chefes do mundo (escudo)
	for cc in m.mundo.get("caca", []):
		if not mm.filtro.ok("boss" if cc.has("boss") else "caca"):
			continue
		var q := _em(float(cc.x), float(cc.z), 5.0)
		if not _na_tela_ok(q, tam):
			continue
		var r := t if not longe else 7.0
		_sombra(c, q, r)
		mm._marca_clareira(c, q, cc, r, true)
		if not longe:
			mm._texto(c, q + Vector2(0, r + 13.0), "%s  Nv %d" % [mm.NOME_BICHO.get(str(cc.get("bicho", "")), "Monstros"), int(cc.get("nivel", 1))], 14, Color(1, 0.96, 0.88))
	# NPCs: o símbolo da função e, de perto, o nome e o título (icones_npc.gd, o mesmo do 2D)
	if mm.filtro.ok("npcs"):
		mm.icones.desenhar_mapa(c, em, k * 0.9, longe, fonte, tam)

# jogadores online perto (azul), o time (verde com o nome) e os amigos virtuais (coração), como no 2D
func _pessoas(c: Control, em: Callable) -> void:
	for p in mm._outros():
		var q: Vector2 = em.call(p.x, p.z)
		if q == FORA:
			continue
		c.draw_circle(q, 5.0, Color(0.05, 0.05, 0.1, 0.8))
		c.draw_circle(q, 4.0, Color("6fb6ff"))
	for p in mm._time():
		var q: Vector2 = em.call(p.x, p.z)
		if q == FORA:
			continue
		c.draw_circle(q, 6.0, Color(0.03, 0.08, 0.03, 0.9))
		c.draw_circle(q, 5.0, m.amigos.COR_TIME)
		mm._texto(c, q + Vector2(0, -12), p.nome, 13, m.amigos.COR_TIME.lightened(0.3))
	for ce in mm._amigas():
		var q: Vector2 = em.call(ce.x, ce.z)
		if q == FORA:
			continue
		mm._coracao(c, q, 7.0)
		mm._texto(c, q + Vector2(0, -14), ce.nome, 13, mm.COR_AMIGA.lightened(0.3))

# ---------- lista de Lugares e totens no 3D (André 2026-11-16: "quando encosto no totem abre o mapa 3D, mas não
# aparece totem nenhum; tenho que mudar pro 2D". A ideia dele é ficar só com o 3D: tudo do 2D precisa funcionar aqui) ----

# onde fica a lista (a mesma do 2D, minimapa.gd): na direita, embaixo da barra de cima
func _arrumar_lista(tm: bool) -> void:
	if tm or not lista_aberta or not pronto:
		mm.painel_3d = Rect2()
		return
	var g := get_global_rect()
	mm.painel_3d = Rect2(g.position + Vector2(g.size.x - mm.LARGURA_LISTA, 44.0), Vector2(mm.LARGURA_LISTA, g.size.y - 44.0))

# nome do lugar marcado para o "Ir para": o da lista ou a clareira embaixo do pino
func _nome_marcado() -> String:
	if mm.selecionado != "":
		for l in mm._lugares():
			if str(l.id) == mm.selecionado:
				return str(l.get("curto", l.get("nome", "")))
	return mm._clareira_em(mm.marcado)

# a câmera mostra todos os totens (abre assim quando o herói encosta num totem)
func ver_totens() -> void:
	var r := Rect2()
	var primeiro := true
	for t in m.totem.T.lista:
		var p := Vector2(float(t.x), float(t.z))
		r = Rect2(p, Vector2.ZERO) if primeiro else r.expand(p)
		primeiro = false
	if primeiro:
		return
	r = r.grow(60.0)
	foco_alvo = Vector3(r.get_center().x, 0.0, r.get_center().y - r.size.y * 0.04)
	foco = foco_alvo
	dist_alvo = clampf(maxf(r.size.x / 1.5, r.size.y / 0.85) * 1.1, DIST_MIN, DIST_MAX)
	dist = dist_alvo
	_camera()
	marcas.queue_redraw()

# os totens grandes: acesos pulsando (dá para tocar), apagados (visite a pé), o daqui com "Você está aqui"
func _totens(c: Control, tam: Vector2, em: Callable) -> void:
	var ouro := int(m.P.prog.get("ouro", 0))
	var pulso: float = 0.5 + 0.5 * sin(Time.get_ticks_msec() / 1000.0 * 3.0)
	for t in m.totem.T.lista:
		var id := str(t.id)
		var q := _em(float(t.x), float(t.z), 8.0)
		if not _na_tela_ok(q, tam, 60.0):
			continue
		var aqui: bool = id == str(mm.totem_de.get("id", ""))
		var ok: bool = m.totem.descoberto(id)
		_sombra(c, q, 12.0)
		if ok and not aqui:
			c.draw_circle(q, 20.0 + pulso * 5.0, Color(0.35, 0.85, 1.0, 0.14 + pulso * 0.1))
			c.draw_circle(q, 15.0, Color(0.35, 0.85, 1.0, 0.24))
		if id == mm.totem_alvo:
			c.draw_arc(q, 21.0, 0, TAU, 40, COR_OURO, 2.5, true)
		mm._marca_totem(c, q, 12.0, ok)
		var sub := ""
		var cor_sub := Color("9fe6ff")
		if aqui:
			sub = "Você está aqui"
			cor_sub = COR_OURO
			c.draw_arc(q, 19.0, 0, TAU, 40, COR_OURO, 2.0, true)
		elif ok:
			sub = "%d de ouro" % m.totem.taxa(t)
			if m.totem.taxa(t) > ouro:
				cor_sub = Color(1, 0.62, 0.55)
		else:
			sub = "visite a pé"
			cor_sub = Color(0.72, 0.75, 0.8)
		mm._texto(c, q + Vector2(0, -24), str(t.nome), 16, Color(1, 0.96, 0.88) if ok else Color(0.78, 0.8, 0.84))
		mm._texto(c, q + Vector2(0, 26), sub, 13, cor_sub)
	# título: o totem daqui e o ouro, embaixo da barra de cima
	var t1 := "Totem de teleporte · %s" % str(mm.totem_de.get("nome", ""))
	var t2 := "Você tem %d de ouro. Toque num totem aceso para viajar." % ouro
	var wt: float = maxf(fonte.get_string_size(t1, HORIZONTAL_ALIGNMENT_LEFT, -1, 20).x, fonte.get_string_size(t2, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x) + 40.0
	var rt := Rect2(Vector2(14.0, tam.y - 66.0), Vector2(wt, 52.0)) # embaixo à esquerda: não tapa os totens do norte
	var sbt := StyleBoxFlat.new()
	sbt.bg_color = Color(0.08, 0.06, 0.04, 0.9)
	sbt.border_color = COR_OURO
	sbt.set_border_width_all(2)
	sbt.set_corner_radius_all(16)
	sbt.shadow_color = Color(0, 0, 0, 0.4)
	sbt.shadow_size = 5
	sbt.draw(c.get_canvas_item(), rt)
	mm._texto(c, rt.position + Vector2(wt * 0.5, 18.0), t1, 20, COR_OURO, true, 4)
	mm._texto(c, rt.position + Vector2(wt * 0.5, 39.0), t2, 14, Color(1, 0.96, 0.88, 0.9), true, 3)

# "Teleportar" ao lado do totem escolhido, ligado por uma linha dourada
func _botao_teleportar(c: Control, tam: Vector2, em: Callable) -> void:
	b_tp = Rect2()
	if mm.totem_alvo == "":
		return
	var alvo: Dictionary = m.totem.dados(mm.totem_alvo)
	if alvo.is_empty():
		return
	var qa := _em(float(alvo.x), float(alvo.z), 8.0)
	if qa == FORA:
		return
	var ouro := int(m.P.prog.get("ouro", 0))
	var custo: int = m.totem.taxa(alvo)
	var falta: int = custo - ouro
	var b1 := "Teleportar"
	var b2 := "%d de ouro" % custo if falta <= 0 else "Faltam %d de ouro" % falta
	var w: float = maxf(fonte.get_string_size(b1, HORIZONTAL_ALIGNMENT_LEFT, -1, 20).x, fonte.get_string_size(b2, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x) + 40.0
	# à direita ou à esquerda do totem: o lado que cabe na tela e não cobre outro totem
	var y: float = clampf(qa.y - 27.0, 56.0, tam.y - 130.0)
	var bt := Rect2()
	for x in [qa.x + 34.0, qa.x - 34.0 - w, qa.x - w * 0.5]:
		var r := Rect2(Vector2(x, y if x != qa.x - w * 0.5 else clampf(qa.y + 40.0, 56.0, tam.y - 130.0)), Vector2(w, 54.0))
		if r.position.x < 12.0 or r.end.x > tam.x - 12.0:
			continue
		var cobre := false
		for t in m.totem.T.lista:
			if str(t.id) != mm.totem_alvo and r.grow(14.0).has_point(_em(float(t.x), float(t.z), 8.0)):
				cobre = true
				break
		if not cobre or bt == Rect2():
			bt = r
		if not cobre:
			break
	b_tp = bt.grow(8.0)
	var borda := Vector2(clampf(qa.x, bt.position.x, bt.end.x), clampf(qa.y, bt.position.y, bt.end.y))
	c.draw_line(qa + (borda - qa).normalized() * 14.0, borda, Color(0.05, 0.04, 0.03, 0.6), 3.0, true)
	c.draw_line(qa + (borda - qa).normalized() * 14.0, borda, COR_OURO, 1.2, true)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.1, 0.14, 0.95) if falta <= 0 else Color(0.14, 0.07, 0.06, 0.95)
	sb.border_color = Color("5ad8ff") if falta <= 0 else Color(1, 0.62, 0.55)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(16)
	sb.shadow_color = Color(0, 0, 0, 0.45)
	sb.shadow_size = 6
	sb.draw(c.get_canvas_item(), bt)
	mm._texto(c, bt.position + Vector2(w * 0.5, 19.0), b1, 20, Color("9fe6ff") if falta <= 0 else Color(1, 0.8, 0.75), true, 4)
	mm._texto(c, bt.position + Vector2(w * 0.5, 39.0), b2, 13, Color(1, 0.96, 0.88, 0.85) if falta <= 0 else Color(1, 0.62, 0.55), true, 3)

# toque no mapa do totem: o botão viaja; um totem aceso (até 34 px) é escolhido; o mesmo de novo já viaja
func _toque_totem(lp: Vector2) -> void:
	if mm.totem_alvo != "" and b_tp.has_point(lp):
		mm._teleportar()
		return
	var melhor := ""
	var menor := 34.0
	for t in m.totem.T.lista:
		var q := _em(float(t.x), float(t.z), 8.0)
		var d: float = q.distance_to(lp)
		if d < menor:
			menor = d
			melhor = str(t.id)
	if melhor == "" or melhor == str(mm.totem_de.get("id", "")) or not m.totem.descoberto(melhor):
		mm.totem_alvo = ""
		return
	if melhor == mm.totem_alvo:
		mm._teleportar()
		return
	mm.totem_alvo = melhor
	if m.sons:
		m.sons.tocar("pano", -14.0)

# guia das missões (guia.gd): onde está, na tela, o totem de destino ou o botão "Teleportar" (Rect2() = não aparece)
func guia_totem(k: String) -> Rect2:
	var g := get_global_rect().position
	if mm.totem_alvo != "" and (k == "" or mm.totem_alvo == k) and b_tp.has_area():
		return Rect2(g + b_tp.position, b_tp.size)
	if not pronto:
		return Rect2()
	for t in m.totem.T.lista:
		var id := str(t.id)
		if id == str(mm.totem_de.get("id", "")) or not m.totem.descoberto(id) or (k != "" and id != k):
			continue
		var q := _em(float(t.x), float(t.z), 8.0)
		if not _na_tela_ok(q, size, 0.0):
			continue
		return Rect2(g + q - Vector2(20, 20), Vector2(40, 40))
	return Rect2()

func _fita2d(c: Control, centro: Vector2, txt: String, tam: int, l: Dictionary) -> void:
	txt = Idioma.frase(txt)
	var nv := int(l.get("nivel", 0))
	var rom := _romano(nv) if nv > 0 else ""
	var w := fonte.get_string_size(txt, HORIZONTAL_ALIGNMENT_LEFT, -1, tam).x + 18.0
	if rom != "":
		w += fonte.get_string_size(rom, HORIZONTAL_ALIGNMENT_LEFT, -1, tam).x + 18.0
	var r := Rect2(centro - Vector2(w * 0.5, tam * 0.75), Vector2(w, tam * 1.5))
	c.draw_rect(r, Color8(236, 200, 172))
	c.draw_rect(r, Color8(150, 96, 70), false, 2.0)
	var x := r.position.x + 9.0
	if rom != "":
		c.draw_string(fonte, Vector2(x, centro.y + tam * 0.35), rom, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, Color8(60, 30, 20))
		x += fonte.get_string_size(rom, HORIZONTAL_ALIGNMENT_LEFT, -1, tam).x + 4.0
		c.draw_circle(Vector2(x + 5.0, centro.y), 5.0, _cor_nivel(nv))
		x += 14.0
	c.draw_string(fonte, Vector2(x, centro.y + tam * 0.35), txt, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, Color8(50, 28, 18))

static func _romano(n: int) -> String:
	return ["I", "I", "II", "III", "IV", "V", "VI", "VII", "VIII"][clampi(int(ceil(n / 12.5)), 0, 8)]

static func _cor_nivel(nv: int) -> Color:
	if nv < 20:
		return Color8(90, 200, 255)
	if nv < 45:
		return Color8(255, 220, 60)
	if nv < 70:
		return Color8(255, 140, 40)
	return Color8(230, 50, 60)

func _mapinha(c: Control, tam: Vector2) -> void:
	if mini_sv == null:
		return
	var alto: float = 0.42 if not mm.painel_3d.has_area() else 0.3 # com a lista aberta, o mapinha fica menor
	var ms := Vector2(mini_sv.size) * minf(1.0, tam.y * alto / float(mini_sv.size.y))
	var r := Rect2(Vector2(tam.x - ms.x - 18.0, tam.y - ms.y - 18.0), ms)
	c.draw_rect(r.grow(4.0), Color8(20, 32, 44))
	c.draw_texture_rect(mini_sv.get_texture(), r, false)
	c.draw_rect(r.grow(4.0), COR_OURO, false, 2.0)
	# o que a câmera mostra: o chão nos quatro cantos da tela
	var cantos := PackedVector2Array()
	for q in [Vector2(0, tam.y * 0.08), Vector2(tam.x, tam.y * 0.08), Vector2(tam.x, tam.y), Vector2(0, tam.y)]:
		var o := cam.project_ray_origin(q)
		var d := cam.project_ray_normal(q)
		var t := (0.0 - o.y) / minf(d.y, -0.05)
		var p := o + d * minf(t, 4000.0)
		cantos.append(r.position + Vector2((p.x - X0) / (ATE.x - X0), (p.z - Z0) / (ATE.y - Z0)) * r.size)
	cantos.append(cantos[0])
	for i in cantos.size():
		cantos[i] = cantos[i].clamp(r.position, r.end)
	c.draw_polyline(cantos, Color8(230, 40, 40), 2.0, true)
	if m.heroi != null:
		var hp: Vector3 = m.heroi.position
		c.draw_circle(r.position + Vector2((hp.x - X0) / (ATE.x - X0), (hp.z - Z0) / (ATE.y - Z0)) * r.size, 3.0, Color.WHITE)

# bússola ao lado do "+": a ponta vermelha mostra o norte (gira com o mapa); tocar volta ao norte e ao ângulo de abrir
func _bussola(c: Control, p: Vector2) -> void:
	b_bussola = Rect2(p - Vector2(24, 24), Vector2(48, 48))
	c.draw_circle(p, 21.0, Color(0.08, 0.06, 0.04, 0.88))
	c.draw_arc(p, 21.0, 0, TAU, 40, COR_OURO, 2.0, true)
	var n := Vector2(0, -1)
	if cam != null and pronto:
		var a = _na_tela(foco.x, foco.z)
		var b = _na_tela(foco.x, foco.z - 40.0)
		if a != null and b != null and (b - a).length() > 0.5:
			n = (b - a).normalized()
	var lado := Vector2(-n.y, n.x) * 5.5
	c.draw_colored_polygon(PackedVector2Array([p + n * 15.0, p + lado, p - lado]), Color8(220, 50, 45))
	c.draw_colored_polygon(PackedVector2Array([p - n * 15.0, p + lado, p - lado]), Color8(235, 225, 205))
	c.draw_string(fonte, p + n * 27.0 + Vector2(-6, 6), "N", HORIZONTAL_ALIGNMENT_LEFT, -1, 15, Color8(250, 232, 190))

func _botao(c: Control, r: Rect2, txt: String, tam := 17) -> void:
	txt = Idioma.frase(txt)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.08, 0.06, 0.04, 0.88)
	sb.border_color = COR_OURO
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(int(r.size.y * 0.5))
	sb.draw(c.get_canvas_item(), r)
	c.draw_string(fonte, Vector2(r.position.x, r.position.y + r.size.y * 0.5 + tam * 0.35), txt, HORIZONTAL_ALIGNMENT_CENTER, r.size.x, tam, Color(1, 0.95, 0.85))

func _botoes(c: Control, tam: Vector2, lw := 0.0, tm := false) -> void:
	c.draw_rect(Rect2(0, 0, tam.x, 48), Color(0.08, 0.06, 0.04, 0.78))
	c.draw_string(fonte, Vector2(18, 32), Idioma.frase("Mundo de Aethra"), HORIZONTAL_ALIGNMENT_LEFT, -1, 22, Color8(250, 232, 190))
	var cx := Vector2(tam.x - 28.0, 24.0)
	b_x = Rect2(cx - Vector2(22, 22), Vector2(44, 44))
	c.draw_circle(cx, 15.0, Color(0.05, 0.04, 0.03, 0.85))
	c.draw_arc(cx, 15.0, 0, TAU, 32, COR_OURO, 1.5, true)
	c.draw_line(cx + Vector2(-6, -6), cx + Vector2(6, 6), Color(1, 0.95, 0.85), 2.5, true)
	c.draw_line(cx + Vector2(6, -6), cx + Vector2(-6, 6), Color(1, 0.95, 0.85), 2.5, true)
	b_2d = Rect2() # sem o botão "Mapa 2D": só o 3D (André 2026-11-16, "remoção aprovada")
	b_eu = Rect2(Vector2(tam.x - 180.0, 6.0), Vector2(118, 36))
	_botao(c, b_eu, "Onde estou")
	b_lista = Rect2()
	if not tm and pronto: # mostra e esconde a lista de Lugares
		b_lista = Rect2(Vector2(tam.x - 300.0, 6.0), Vector2(108, 36))
		_botao(c, b_lista, "Esconder lista" if lista_aberta else "Lugares", 15 if lista_aberta else 17)
	b_nevoa = Rect2()
	if not tm and pronto and m.get("nevoa") != null: # tira e põe a névoa das regiões fechadas
		b_nevoa = Rect2(Vector2(tam.x - 420.0, 6.0), Vector2(112, 36))
		_botao(c, b_nevoa, "Tirar névoa" if nevoa_no_mapa else "Pôr névoa", 15)
	var cz := Vector2((tam.x - lw) * 0.5, tam.y - 34.0)
	b_menos = Rect2(cz - Vector2(62, 22), Vector2(58, 44))
	b_mais = Rect2(cz + Vector2(4, -22), Vector2(58, 44))
	_botao(c, b_menos, "−", 26)
	_botao(c, b_mais, "+", 26)
	_bussola(c, cz + Vector2(92, 0))
	b_ir = Rect2()
	if mm.marcado != null and m.rota:
		var metros: float = m.rota.comprimento(mm.previa)
		var lugar := _nome_marcado()
		var t := Idioma.frase("Ir para %s (%d m)" % [lugar, int(round(metros))]) if lugar != "" else Idioma.frase("Ir para (%d m)" % int(round(metros)))
		var w := fonte.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, 20).x + 40.0
		b_ir = Rect2(Vector2(cz.x - w * 0.5, cz.y - 84.0), Vector2(w, 44))
		_botao(c, b_ir, t, 20)
		b_ir = b_ir.grow(8.0)

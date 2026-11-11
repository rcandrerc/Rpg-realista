extends SkeletonModifier3D
# Física de pano da capa (armadura.gd, André 2026-11-04: "a física da capa está muito zuada, e montada está pior
# ainda, vai pra cima"). Antes a capa era uma placa presa no peito que o shader girava para trás pela velocidade:
# quando o tronco deitava (correndo e, pior, no lobo, ~60°), a placa deitava junto e ainda abria mais 63°, apontando
# para o céu. Agora o pano é uma grade de pontos (8 x 7) que cai com a gravidade do MUNDO, arrasta no ar (correndo,
# o vento de frente levanta a barra para trás) e bate no corpo e no lobo (cápsulas). A borda de cima segue o peito.
# Roda como o último modificador do esqueleto: lê a pose final do quadro (depois da animação, da montaria e das
# molas do cabelo), simula e manda a grade para o capa.gdshader, que dobra a malha da capa por cima dela.

const COLS := 8 # pontos na largura (colunas 0, 2, ... 14 da malha)
const LINHAS := 7 # pontos na altura (linhas 0, 3, ... 18 da malha)
const PASSO := 1.0 / 60.0
const GRAVIDADE := Vector3(0, -9.8, 0)
const AR := 1.0 # freio do ar em todo o pano (1/s)
const VENTO := 3.2 # quanto o ar empurra o pano pela frente da face (vento da corrida)
const VENTO_MAX := 5.5 # m/s: acima disso (galope do lobo) o ar não levanta mais o pano (senão ele vira bandeira)
const FORMA := [1.0, 0.25, 0.03, 0.004, 0.0, 0.0, 0.0] # quanto cada linha volta para a forma de descanso (por passo)

var mi: MeshInstance3D # a malha da capa (presa no osso pelo BoneAttachment3D)
var osso := -1 # J_Bip_C_UpperChest
var base := PackedVector3Array() # grade de descanso, no espaço da malha
var _p := PackedVector3Array() # posição agora (mundo)
var _q := PackedVector3Array() # posição no passo anterior (mundo)
var _la := PackedInt32Array() # ligas do pano: ponto a, ponto b (listas planas: rápido no celular)
var _lb := PackedInt32Array()
var _lc := PackedFloat32Array() # comprimento no espaço da malha
var _lk := PackedFloat32Array() # rigidez
var tempo_us := 0 # quanto o último quadro gastou (para medir no celular)
var _cap: Array = [] # cápsulas do corpo: [osso a, osso b, raio]
var _acum := 0.0
var _pronto := false
var _t := 0.0
var _mat: ShaderMaterial

# Desempenho (André 2026-11-11: "FPS péssimo, 30 no máximo"): cada capa custava ~0,4 ms por passo de pano em script,
# 60 passos por segundo, e a vila tinha 10 capas (os NPCs e os aventureiros vestem capa): o pano sozinho gastava
# tanto quanto o resto do jogo. Agora o pano de verdade fica para o herói (e os bonecos do menu e do criador) e para
# as OUTRAS_MAX capas de NPC ou outro jogador mais perto da câmera (até OUTRAS_PERTO m). As outras ficam na forma de
# descanso presa no peito (a mesma que já valia longe, a mais de 30 m), sem conta nenhuma por quadro.
# Quem é "outro" vem marcado no corpo (meta "pano_outro": online.gd e os NPCs da vila no main.gd).
const OUTRAS_MAX := 2
const OUTRAS_PERTO := 10.0
static var _quadro := -1
static var _cand := {} # capas de outros que pediram pano neste quadro: id -> distância da câmera
static var _vez := {} # as escolhidas para este quadro (vêm das candidatas do quadro anterior)
static var ms_quadro := 0.0 # tempo de todas as capas no último quadro (Teste)
static var _ms_acum := 0.0
var _outro := -1 # -1 = ainda não sabe; 0 = herói/boneco (pano sempre); 1 = NPC ou outro jogador
var _rigido := false # na forma de descanso (grade = base), sem simular

static func _novo_quadro() -> void:
	var fr := Engine.get_process_frames()
	if fr == _quadro:
		return
	_quadro = fr
	ms_quadro = _ms_acum
	_ms_acum = 0.0
	var l := []
	for id in _cand:
		l.append([_cand[id] * (0.8 if _vez.has(id) else 1.0), id]) # quem já tem pano tem preferência (não fica trocando)
	l.sort_custom(func(a, b): return a[0] < b[0])
	_vez.clear()
	for k in mini(OUTRAS_MAX, l.size()):
		_vez[l[k][1]] = true
	_cand.clear()

func _eh_outro(s: Skeleton3D) -> int:
	var no: Node = s
	while no != null:
		if no.has_meta("pano_outro"):
			return 1
		no = no.get_parent()
	return 0

# forma de descanso: a grade do shader é a própria base (no espaço da malha), sem conta por quadro
func _ficar_rigido() -> void:
	if _rigido:
		return
	_rigido = true
	_mat.set_shader_parameter("grade", base)
	_p.resize(0) # na volta para o pano nasce em descanso
	_M_ant_ok = false

func preparar(esq: Skeleton3D, malha: MeshInstance3D, grade: PackedVector3Array) -> void:
	mi = malha
	osso = esq.find_bone("J_Bip_C_UpperChest")
	base = grade
	_mat = mi.material_override as ShaderMaterial
	var id := func(i: int, j: int) -> int: return j * COLS + i
	for j in LINHAS:
		for i in COLS:
			if i + 1 < COLS:
				_liga(id.call(i, j), id.call(i + 1, j), 1.0)
			if j + 1 < LINHAS:
				_liga(id.call(i, j), id.call(i, j + 1), 1.0)
			if i + 1 < COLS and j + 1 < LINHAS:
				_liga(id.call(i, j), id.call(i + 1, j + 1), 0.5)
				_liga(id.call(i + 1, j), id.call(i, j + 1), 0.5)
			if i + 2 < COLS:
				_liga(id.call(i, j), id.call(i + 2, j), 0.12) # pano grosso, mas deita nas costas e no lobo
			if j + 2 < LINHAS:
				_liga(id.call(i, j), id.call(i, j + 2), 0.08)
	# corpo: tronco, quadril e pernas. O raio de cada cápsula é o do corpo, mas nunca encosta na capa em
	# descanso (fica 1 cm longe), para o pano não nascer "dentro" de nada
	var C := [["J_Bip_C_Hips", "J_Bip_C_UpperChest", 0.14], ["J_Bip_L_UpperLeg", "J_Bip_L_LowerLeg", 0.095],
		["J_Bip_R_UpperLeg", "J_Bip_R_LowerLeg", 0.095], ["J_Bip_L_LowerLeg", "J_Bip_L_Foot", 0.065],
		["J_Bip_R_LowerLeg", "J_Bip_R_Foot", 0.065], ["J_Bip_L_UpperLeg", "J_Bip_R_UpperLeg", 0.11]]
	var mundo_descanso := esq.get_bone_global_rest(osso) * mi.transform # malha -> esqueleto em descanso
	for c in C:
		var a := esq.find_bone(c[0])
		var b := esq.find_bone(c[1])
		if a < 0 or b < 0:
			continue
		var pa := esq.get_bone_global_rest(a).origin
		var pb := esq.get_bone_global_rest(b).origin
		var r: float = c[2]
		for j in range(1, LINHAS):
			for i in COLS:
				r = minf(r, _dist_seg(mundo_descanso * base[j * COLS + i], pa, pb) - 0.01)
		_cap.append([a, b, maxf(r, 0.03)])
	_pronto = osso >= 0 and base.size() == COLS * LINHAS

func _liga(a: int, b: int, k: float) -> void:
	_la.append(a)
	_lb.append(b)
	_lc.append(base[a].distance_to(base[b]))
	_lk.append(k)

static func _dist_seg(p: Vector3, a: Vector3, b: Vector3) -> float:
	var ab := b - a
	var t := clampf((p - a).dot(ab) / maxf(ab.length_squared(), 1e-6), 0.0, 1.0)
	return p.distance_to(a + ab * t)

# malha -> mundo agora (o BoneAttachment só se atualiza depois dos modificadores, então a conta é feita aqui)
func _malha_mundo(s: Skeleton3D) -> Transform3D:
	return s.global_transform * s.get_bone_global_pose(osso) * mi.transform

func _process_modification() -> void:
	var s := get_skeleton()
	if not _pronto or s == null or not is_instance_valid(mi):
		return
	# o pano precisa da pose final: se alguém entrou depois (montaria, braço da espada), volta para o fim
	if get_index() != s.get_child_count() - 1:
		_ao_fim.call_deferred()
	var t0 := Time.get_ticks_usec()
	if _outro < 0:
		_outro = _eh_outro(s)
	var cam := get_viewport().get_camera_3d()
	_novo_quadro()
	if _outro == 1: # NPC ou outro jogador: pano só para os mais perto da câmera
		var dc := cam.global_position.distance_to(s.global_position) if cam else 0.0
		var id := get_instance_id()
		if dc <= OUTRAS_PERTO and s.is_visible_in_tree():
			_cand[id] = dc
		if not _vez.has(id):
			_ficar_rigido()
			tempo_us = 0
			return
	_rigido = false
	var M := _malha_mundo(s)
	var esc := M.basis.get_scale().x
	var n := base.size()
	var dt := get_viewport().get_process_delta_time() if is_inside_tree() else PASSO
	# começo, teletransporte (sair do lobo, voltar para a vila) ou longe da câmera parado: nasce em descanso
	var topo0 := M * base[COLS / 2]
	var dcam := cam.global_position.distance_to(topo0) if cam else 0.0
	var longe := dcam > 30.0
	if _p.size() != n or _p[COLS / 2].distance_to(topo0) > 1.5:
		_topo_ok = false
		_p.resize(n)
		_q.resize(n)
		for k in n:
			_p[k] = M * base[k]
			_q[k] = _p[k]
		_acum = 0.0
	if longe: # fora da vista: não gasta conta, só acompanha o corpo
		for k in n:
			_p[k] = M * base[k]
			_q[k] = _p[k]
	else:
		_acum = minf(_acum + dt, PASSO * 3.0)
		var M0 := _M_ant if _M_ant_ok else M
		var passos := 0
		while _acum >= PASSO:
			_acum -= PASSO
			passos += 1
		if dcam > 12.0: # outros jogadores mais longe: um passo por quadro basta (o pano fica um pouco mais lento)
			passos = mini(passos, 1)
		if passos > 0:
			_caps = _capsulas(s)
		for p in passos:
			# a borda de cima vai do lugar antigo ao novo aos poucos (sem tranco a 30 quadros por segundo)
			var f := float(p + 1) / float(passos)
			_passo(_mistura(M0, M, f), esc)
	_M_ant = M
	_M_ant_ok = true
	# grade no espaço da malha para o shader
	var inv := M.affine_inverse()
	var g := PackedVector3Array()
	g.resize(n)
	for k in n:
		g[k] = inv * _p[k]
	_mat.set_shader_parameter("grade", g)
	tempo_us = Time.get_ticks_usec() - t0
	_ms_acum += tempo_us / 1000.0

var _M_ant := Transform3D()
var _topo_ant := Vector3.ZERO
var _topo_ok := false
var _vc := Vector3.ZERO # velocidade do corpo suavizada (m/s, só no chão)
var _trem := 0.0 # força do tremular (0 parado a 1 correndo)
var _M_ant_ok := false

func _ao_fim() -> void:
	var s := get_parent()
	if s:
		s.move_child(self, -1)

static func _mistura(a: Transform3D, b: Transform3D, f: float) -> Transform3D:
	return a.interpolate_with(b, f)

func _passo(M: Transform3D, esc: float) -> void:
	_t += PASSO
	# velocidade do corpo (meio da borda de cima), suavizada em ~0,3 s: liga o tremular devagar
	var topo := M * base[COLS / 2]
	var vc := (topo - _topo_ant) / PASSO if _topo_ok else Vector3.ZERO
	_topo_ant = topo
	_topo_ok = true
	vc.y = 0.0
	_vc = _vc.lerp(vc, 1.0 - exp(-PASSO / 0.3))
	_trem = smoothstep(1.0, 5.5, minf(_vc.length(), VENTO_MAX))
	var n := base.size()
	var h2 := PASSO * PASSO
	var amort := 1.0 - AR * PASSO
	# alvo de cada ponto se o pano fosse duro (forma de descanso presa no peito)
	var alvo := PackedVector3Array()
	alvo.resize(n)
	for k in n:
		alvo[k] = M * base[k]
	# velocidade do peito: o "vento" é o ar parado batendo no pano que anda junto com o corpo
	for j in LINHAS:
		for i in COLS:
			var k := j * COLS + i
			if j == 0:
				_q[k] = _p[k]
				_p[k] = alvo[k]
				continue
			var v := (_p[k] - _q[k]) / PASSO
			# normal da face (aproximada pela grade): o ar empurra só de frente para a face
			var iu := mini(i + 1, COLS - 1)
			var iv := maxi(i - 1, 0)
			var du := _p[j * COLS + iu] - _p[j * COLS + iv]
			var dv := _p[k] - _p[(j - 1) * COLS + i]
			var nn := du.cross(dv)
			var a := GRAVIDADE
			if nn.length_squared() > 1e-8:
				nn = nn.normalized()
				a -= nn * (clampf(v.dot(nn), -VENTO_MAX, VENTO_MAX) * VENTO)
			# pano tremulando com a velocidade do CORPO (suavizada), crescendo e sumindo aos poucos. Antes dependia da
			# velocidade de cada ponto passar de 1 m/s: ligava e desligava sozinho (André 2026-11-04: "treme
			# rapidamente e depois para do nada", "vento do nada")
			if _trem > 0.01:
				var t := float(j) / (LINHAS - 1)
				a += nn * (sin(_t * 7.0 + i * 0.9 - j * 1.4) + 0.5 * sin(_t * 4.3 - i * 0.6 + j * 0.8)) * _trem * 2.2 * t
			var novo := _p[k] + (_p[k] - _q[k]) * amort + a * h2
			_q[k] = _p[k]
			_p[k] = novo
	# ligas do pano (comprimento no mundo = da malha x escala do personagem)
	var nl := _la.size()
	for it in 3:
		for l in nl:
			var a := _la[l]
			var b := _lb[l]
			var d := _p[b] - _p[a]
			var len := d.length()
			if len < 1e-6:
				continue
			var falta := (len - _lc[l] * esc) / len * _lk[l]
			if a < COLS: # linha de cima presa
				_p[b] -= d * falta
			else:
				_p[a] += d * (falta * 0.5)
				_p[b] -= d * (falta * 0.5)
		if it == 1:
			_colidir()
	# um pouco da forma de descanso perto dos ombros (o pano abraça os ombros e não vira lençol); embaixo é solto
	for k in range(COLS, n):
		_p[k] = _p[k].lerp(alvo[k], FORMA[k / COLS])
	_colidir()

# cápsulas no mundo, uma vez por quadro (os ossos já estão na pose final)
var _caps: Array = []
func _capsulas(s: Skeleton3D) -> Array:
	var g := s.global_transform
	var esc := g.basis.get_scale().x
	var caps: Array = []
	for c in _cap:
		caps.append([g * s.get_bone_global_pose(c[0]).origin, g * s.get_bone_global_pose(c[1]).origin, float(c[2]) * esc])
	# montado: o lombo do lobo (montaria.gd põe a cápsula no meta do esqueleto do herói)
	for c in s.get_meta("pano_extra", []):
		var e = c[0]
		if is_instance_valid(e):
			var ge: Transform3D = e.global_transform
			caps.append([ge * e.get_bone_global_pose(c[1]).origin + Vector3(0, c[4], 0), ge * e.get_bone_global_pose(c[2]).origin + Vector3(0, c[4], 0), float(c[3])])
	return caps

func _colidir() -> void:
	var caps := _caps
	for k in range(COLS, base.size()):
		var p := _p[k]
		# o ar não levanta a barra acima da linha dos ombros (antes, montada, a capa apontava para o céu)
		var teto := _p[k % COLS].y + 0.04
		if p.y > teto:
			p.y = teto
		for c in caps:
			var a: Vector3 = c[0]
			var ab: Vector3 = c[1] - a
			var t := clampf((p - a).dot(ab) / maxf(ab.length_squared(), 1e-6), 0.0, 1.0)
			var perto := a + ab * t
			var d := p - perto
			var r: float = c[2]
			var l2 := d.length_squared()
			if l2 < r * r:
				var l := sqrt(l2)
				p = perto + (d / l * r if l > 1e-5 else Vector3.UP * r)
		_p[k] = p

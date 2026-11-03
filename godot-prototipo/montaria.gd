extends RefCounted
# Montaria (lobo) no app, como no jogo HTML (PR #41): o lobo anda embaixo do herói e o herói vai agachado na sela,
# com as mãos na juba e as pernas no flanco (cavalgar.gd). O lobo segue a posição e o giro do herói; a animação
# dele (parada, andar, corrida) vem da velocidade. No galope o quadril do herói sobe e desce com uma mola (atrasa um
# pouco do lombo do lobo e passa do ponto), o tronco dobra no pouso e a cabeça vem depois; o cabelo segue sozinho.
# Usado pelo herói (main.gd) e pelos outros jogadores (online.gd). Números de MONTARIAS em shared/dados.js.

const Cavalgar = preload("res://cavalgar.gd")

# andar/correr: m/s (o servidor confere com MONTARIAS); escala: tamanho do lobo no jogo; o lobo.glb do app já vem
# 18% menor (o lobo de caça), por isso glb = 1,9 x 0,82. sela: entre o lombo (0) e a cernelha (1); flanco: pé no lado.
const DADOS := {"lobo": {"modelo": "lobo", "andar": 3.0, "trote": 6.0, "correr": 9.0, "escala": 1.9, "glb": 1.9 * 0.82, "sela": 0.3, "flanco": 0.17}}
# ritmo de cada animação do lobo (m/s em que o pé não desliza) e quantas passadas cabem num ciclo
const PASSO := {"parada": {"ref": 1.0, "n": 1, "pulo": 0.0}, "andar": {"ref": 3.0, "n": 2, "pulo": 0.018}, "corrida": {"ref": 8.0, "n": 1, "pulo": 0.055}}
const MOLA_K := 260.0 # quadril preso na sela por uma mola: acompanha o lombo com um pequeno atraso
const MOLA_AMORT := 15.0

var d: Dictionary
var no: Node3D
var anim: AnimationPlayer
var esq: Skeleton3D
var pose # cavalgar.gd no esqueleto do herói
var cav: Node3D
var atual := ""
var _o := {}
var _lombo_descanso := 0.0
var _y := 0.0 # mola do quadril (altura relativa à sela, m)
var _vy := 0.0
var _sela_ant := INF
var _tronco := 0.0
var _tronco_v := 0.0
var _pescoco := 0.0
var _pulo_k := 0.0 # força do balanço da passada agora (muda aos poucos entre andar e galope)
var _rabo # mola do rabo (Rabo, abaixo)

func _init(m, id: String, cavaleiro: Node3D, cav_esq: Skeleton3D) -> void:
	d = DADOS.get(id, DADOS.lobo)
	cav = cavaleiro
	no = m.modelo(d.modelo)
	no.get_parent().remove_child(no)
	cav.add_child(no) # vai junto com o corpo (some, aparece e é apagado com ele)
	_assentar()
	m.contorno(no, 0.012)
	for g in no.find_children("*", "GeometryInstance3D", true, false):
		g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	anim = no.find_child("AnimationPlayer", true, false)
	esq = m.esqueleto(no)
	for n in ["coluna", "peito", "cabeca"]:
		_o[n] = esq.find_bone(n)
	var r := func(i: int) -> Vector3: return esq.get_bone_global_rest(i).origin
	if _o.coluna >= 0 and _o.peito >= 0:
		var c: Vector3 = r.call(_o.peito) - r.call(_o.coluna)
		_lombo_descanso = atan2(c.y, Vector2(c.x, c.z).length())
	_rabo = Rabo.new()
	esq.add_child(_rabo)
	_rabo.preparar(esq)
	pose = Cavalgar.new()
	cav_esq.add_child(pose)
	# depois do inclinar.gd e do braço da espada, antes das molas do cabelo e da saia
	var antes := cav_esq.get_child_count() - 1
	for i in cav_esq.get_child_count():
		if cav_esq.get_child(i) is SpringBoneSimulator3D:
			antes = i
			break
	cav_esq.move_child(pose, antes)
	pose.preparar(cav_esq)
	tocar("parada")

# no chão embaixo do corpo, no giro dele; o lobo não cresce junto com a altura que o jogador escolheu
func _assentar() -> void:
	no.transform = Transform3D(Basis().scaled(Vector3.ONE * float(d.escala) / float(d.glb) / max(0.01, cav.scale.x)), Vector3.ZERO)

func tocar(nome: String) -> void:
	if atual == nome or not anim.has_animation(nome):
		return
	anim.play(nome, 0.25)
	atual = nome

# ponto de um osso do lobo no mundo
func _osso(i: int) -> Vector3:
	return esq.global_transform * esq.get_bone_global_pose(i).origin

# vel: m/s no chão agora (o herói ou o outro jogador)
func passo(dt: float, vel: float) -> void:
	if dt <= 0.0:
		return
	_assentar()
	var a := "parada"
	if vel > 4.4:
		a = "corrida"
	elif vel > 0.35:
		a = "andar"
	tocar(a)
	var ps: Dictionary = PASSO[a]
	anim.speed_scale = clamp(vel / float(ps.ref), 0.6, 1.25) if a != "parada" else 1.0
	_pulo_k = move_toward(_pulo_k, float(ps.pulo) * (clamp(vel / float(ps.ref), 0.5, 1.2) if a != "parada" else 0.0), dt * 0.15)
	var b := no.global_basis.orthonormalized()
	var k: float = float(d.escala)
	var sela: Vector3 = _osso(_o.coluna).lerp(_osso(_o.peito), float(d.sela))
	# passada: o lombo empurra o cavaleiro para cima no impulso; o quadril segue numa mola (atrasa e passa do ponto)
	var fase := 0.0
	var dur := anim.current_animation_length
	if dur > 0.0:
		fase = fmod(anim.current_animation_position / dur * float(ps.n), 1.0)
	var empurra: float = _pulo_k * pow(sin(PI * fase), 2.0)
	var sy: float = sela.y + empurra
	if _sela_ant == INF:
		_sela_ant = sy
		_y = 0.0
	var dts: float = min(dt, 0.05)
	# a mola guarda a altura do quadril relativa a onde a sela estava; a sela anda e a mola corre atrás
	_y -= sy - _sela_ant
	_sela_ant = sy
	_vy += (-_y * MOLA_K - _vy * MOLA_AMORT) * dts
	_y = clamp(_y + _vy * dts, -0.08, 0.08)
	# tronco: quando o quadril é jogado para cima, o peito fica e o corpo dobra; a cabeça vem depois (olha o caminho)
	var alvo_t: float = clamp(_vy * 0.2, -0.12, 0.12)
	_tronco_v += ((alvo_t - _tronco) * 180.0 - _tronco_v * 13.0) * dts
	_tronco += _tronco_v * dts
	_pescoco = lerp(_pescoco, _tronco, min(1.0, dts * 9.0))
	pose.sela = Vector3(sela.x, sy + _y, sela.z) + b.y * (0.2 * k / 1.9) # da coluna até o lombo
	pose.pulo = 0.0
	pose.tronco = _tronco
	pose.pescoco = _pescoco
	var c := _osso(_o.peito) - _osso(_o.coluna)
	var lc := b.inverse() * c
	pose.lombo = clamp((atan2(lc.y, Vector2(lc.x, lc.z).length()) - _lombo_descanso) * 0.3, -0.15, 0.15)
	pose.frente_lobo = b.z
	pose.lado_lobo = b.x
	pose.cima_lobo = b.y
	# mãos: juba logo atrás das orelhas, do lado de cada mão; pés: no flanco, atrás e abaixo da sela
	var nuca := _osso(_o.cabeca)
	for i in 2:
		var l: float = 1.0 if i == 0 else -1.0
		pose.pegada[i] = nuca + b * (Vector3(l * 0.06, 0.12, -0.02) * k)
		pose.pe[i] = sela + b * (Vector3(l * float(d.flanco), -0.17, -0.2) * k)
	_rabo.passo(dt, cav.global_rotation.y)

func remover() -> void:
	if is_instance_valid(no):
		no.queue_free()
	if is_instance_valid(pose):
		pose.queue_free()

# Rabo com mola: quando o lobo vira, o rabo fica para trás e depois balança até assentar (mais solto na ponta)
class Rabo extends SkeletonModifier3D:
	var ossos: Array = []
	var ang := 0.0
	var vel := 0.0
	var _ry = null

	func preparar(s: Skeleton3D) -> void:
		for i in range(1, 6):
			var o := s.find_bone("cauda%d" % i)
			if o >= 0:
				ossos.append(o)

	func passo(dt: float, ry: float) -> void:
		if _ry == null:
			_ry = ry
		var giro: float = wrapf(ry - _ry, -PI, PI) / max(dt, 0.0001)
		_ry = ry
		var alvo: float = clamp(-giro * 0.12, -0.5, 0.5)
		var h: float = min(dt, 0.05)
		vel += ((alvo - ang) * 60.0 - vel * 7.0) * h
		ang += vel * h

	func _process_modification() -> void:
		var s := get_skeleton()
		if s == null or abs(ang) < 0.001:
			return
		var cima: Vector3 = (s.global_basis.orthonormalized().inverse() * Vector3.UP).normalized()
		for i in ossos.size():
			var o: int = ossos[i]
			var pai := s.get_bone_global_pose(s.get_bone_parent(o)).basis.orthonormalized()
			var eixo := (pai.inverse() * cima).normalized()
			s.set_bone_pose_rotation(o, Quaternion(eixo, ang * (0.35 + 0.15 * i)) * s.get_bone_pose_rotation(o))

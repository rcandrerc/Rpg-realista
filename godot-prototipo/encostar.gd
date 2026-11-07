extends SkeletonModifier3D
# Escalando, o corpo encosta na pedra (pedido do André, 2026-11-07: "quando estou escalando estou muito distante
# das pedras"). A conta da escalada (andar.gd, igual ao servidor) usa a grade de alturas da pedra vista de cima:
# numa pedra redonda a parte de baixo entra para dentro e a grade alarga a borda, então o herói ficava a meio
# metro da rocha. Aqui é só o desenho (o servidor não muda): o tiro de raio vai no modelo de verdade da pedra
# (TriangleMesh, como a picareta do trabalho.gd) e
# - corpo: diz quanto o herói ainda pode chegar para a frente (main.gd soma em "_encosta" e move o modelo);
# - mãos e pés: cada um vai até a rocha logo à frente dele (IK de dois ossos, o cotovelo e o joelho continuam
#   dobrando para o mesmo lado da animação).
# peso 0 = animação pura (no chão, na escada e passando por cima da beirada).

var peso := 0.0
var rochas: Array = [] # [{tri: TriangleMesh, xf: Transform3D (global da malha), inv: Transform3D, c: Vector3, r: float}]
var falta := 0.0 # m que o corpo ainda pode ir para a frente até encostar (lido e somado pelo main.gd)
var normal := Vector3.ZERO # para onde a parede olha (mundo, média do peito e das mãos); ZERO = sem parede
const FOLGA_CORPO := 0.07 # m entre a roupa e a pedra
const MAO_GROSSA := 0.035 # m da palma até a pedra
const PE_GROSSO := 0.05 # m da ponta do pé até a pedra
const ALCANCE := 0.5 # m (mão: ALCANCE_MAO) que a mão ou o pé vai atrás da pedra (mais longe que isso, fica no ar como na animação)

const ALCANCE_MAO := 0.7 # a mão estica mais que o pé (pedra que deita para trás lá em cima)
var _b := {}
var _frente := Vector3.BACK # frente do corpo no espaço do esqueleto (pose de descanso)
var _perto: Array = [] # rochas a até alguns metros (escolhidas a cada passo pelo main.gd)

func preparar(esq: Skeleton3D) -> void:
	for n in ["C_Hips", "C_Chest", "C_Head", "R_UpperArm", "R_LowerArm", "R_Hand", "L_UpperArm", "L_LowerArm", "L_Hand",
			"R_UpperLeg", "R_LowerLeg", "R_Foot", "R_ToeBase", "L_UpperLeg", "L_LowerLeg", "L_Foot", "L_ToeBase"]:
		_b[n] = esq.find_bone("J_Bip_" + n)
	if not pronto():
		return
	var p := func(n: String) -> Vector3: return esq.get_bone_global_rest(_b[n]).origin
	var cima: Vector3 = (p.call("C_Head") - p.call("C_Hips")).normalized()
	_frente = cima.cross((p.call("R_UpperArm") - p.call("L_UpperArm")).normalized()).normalized()
	if (p.call("R_ToeBase") - p.call("R_Foot")).dot(_frente) < 0.0:
		_frente = -_frente

func pronto() -> bool:
	if _b.is_empty():
		return false
	for k in _b:
		if int(_b[k]) < 0:
			return false
	return true

# as malhas das pedras escaláveis (terreno.solidos sem casa) dentro do vila.glb
func achar_rochas(vila: Node3D, solidos: Array) -> void:
	rochas = []
	var pedras: Array = []
	for r in solidos:
		if not r.get("casa", false):
			pedras.append(r)
	if pedras.is_empty():
		return
	for mi in vila.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null:
			continue
		var ab: AABB = mi.global_transform * mi.get_aabb()
		var c: Vector3 = ab.get_center()
		var raio: float = Vector2(ab.size.x, ab.size.z).length() * 0.5
		for r in pedras:
			if Vector2(c.x - r.x, c.z - r.z).length() < max(0.6, r.R * 0.35) and raio < r.R * 1.6 and raio > r.R * 0.35:
				rochas.append({"tri": mi.mesh.generate_triangle_mesh(), "xf": mi.global_transform, "inv": mi.global_transform.affine_inverse(), "c": c, "r": raio})
				break
	print("encostar: ", rochas.size(), " pedras de escalar")

func escolher_perto(p: Vector3) -> void:
	_perto = []
	for o in rochas:
		if Vector2(p.x - o.c.x, p.z - o.c.z).length() < o.r + 3.0:
			_perto.append(o)

# raio no mundo; devolve {t, n} (t em metros a partir de "de") ou vazio
func raio(de: Vector3, dir: Vector3, ate: float) -> Dictionary:
	var melhor := {}
	for o in _perto:
		var a: Vector3 = o.inv * de
		var b: Vector3 = o.inv * (de + dir * ate)
		var hit: Dictionary = (o.tri as TriangleMesh).intersect_segment(a, b)
		if hit.is_empty():
			continue
		var pm: Vector3 = o.xf * hit.position
		var t := de.distance_to(pm)
		if melhor.is_empty() or t < melhor.t:
			var n: Vector3 = (o.xf.basis.inverse().transposed() * hit.normal).normalized()
			if n.dot(dir) > 0.0:
				n = -n # malha de um lado só: a normal olha para quem atira
			melhor = {"t": t, "n": n, "p": pm}
	return melhor

func _process_modification() -> void:
	var s := get_skeleton()
	if s == null or not pronto() or _perto.is_empty():
		falta = 0.0
		normal = Vector3.ZERO
		return
	var g := s.global_transform
	var f: Vector3 = g.basis * _frente
	f.y = 0.0
	f = f.normalized()
	if f.length() < 0.5:
		return
	# corpo: o quanto cada parte (cabeça, peito, quadril, joelhos) ainda pode ir até a pedra logo à frente dela
	var menor := INF
	var nsoma := Vector3.ZERO
	for n in ["C_Head", "C_Chest", "C_Hips", "R_LowerLeg", "L_LowerLeg"]:
		var p: Vector3 = g * s.get_bone_global_pose(_b[n]).origin
		var grosso := 0.12 if n == "C_Chest" else (0.1 if n == "C_Hips" else 0.08)
		var h := raio(p - f * 0.6, f, 2.2)
		if h.is_empty():
			continue
		menor = min(menor, h.t - 0.6 - grosso - FOLGA_CORPO)
		if n == "C_Chest" or n == "C_Head":
			nsoma += h.n
	falta = 0.0 if menor == INF else menor
	normal = nsoma.normalized() if nsoma.length() > 0.1 else Vector3.ZERO
	if peso <= 0.001:
		return
	var inv := g.affine_inverse()
	_membro(s, inv, g, f, "R_UpperArm", "R_LowerArm", "R_Hand", "", MAO_GROSSA, ALCANCE_MAO)
	_membro(s, inv, g, f, "L_UpperArm", "L_LowerArm", "L_Hand", "", MAO_GROSSA, ALCANCE_MAO)
	_membro(s, inv, g, f, "R_UpperLeg", "R_LowerLeg", "R_Foot", "R_ToeBase", PE_GROSSO, ALCANCE)
	_membro(s, inv, g, f, "L_UpperLeg", "L_LowerLeg", "L_Foot", "L_ToeBase", PE_GROSSO, ALCANCE)

# leva a ponta (mão, ou dedos do pé) até a pedra à frente dela
func _membro(s: Skeleton3D, inv: Transform3D, g: Transform3D, f: Vector3, nu: String, nl: String, nh: String, ponta: String, grosso: float, alcance: float) -> void:
	var u: int = _b[nu]
	var l: int = _b[nl]
	var h: int = _b[nh]
	var gh := s.get_bone_global_pose(h)
	var pe: Vector3 = g * gh.origin # ponto que encosta (mundo)
	if ponta != "":
		pe = g * s.get_bone_global_pose(_b[ponta]).origin
	var hit := raio(pe - f * 0.5, f, 0.5 + alcance)
	if hit.is_empty():
		return
	var anda: float = hit.t - 0.5 - grosso # + = a pedra está à frente; - = a ponta entrou na pedra
	if anda > alcance:
		return
	var w: float = peso * (1.0 - smoothstep(alcance * 0.75, alcance, anda))
	if w <= 0.001:
		return
	var alvo: Vector3 = inv * (g * gh.origin + f * anda) # a mão/o tornozelo vai junto com a ponta
	_dois_ossos(s, u, l, h, alvo, w)

# IK de dois ossos no espaço do esqueleto: o meio (cotovelo, joelho) dobra no mesmo plano da animação
func _dois_ossos(s: Skeleton3D, u: int, l: int, h: int, alvo: Vector3, w: float) -> void:
	var gp := s.get_bone_global_pose(s.get_bone_parent(u))
	var gu := gp * s.get_bone_pose(u)
	var gl := gu * s.get_bone_pose(l)
	var gh := gl * s.get_bone_pose(h)
	var giro_mao := gh.basis.get_rotation_quaternion()
	var S: Vector3 = gu.origin
	var a: float = S.distance_to(gl.origin)
	var b: float = gl.origin.distance_to(gh.origin)
	var st: Vector3 = alvo - S
	var d: float = clamp(st.length(), abs(a - b) + 0.01, (a + b) * 0.999)
	var n: Vector3 = st.normalized()
	var polo: Vector3 = gl.origin - S
	polo = polo - n * polo.dot(n)
	if polo.length() < 0.001:
		return
	polo = polo.normalized()
	var ao_longo: float = (a * a + d * d - b * b) / (2.0 * d)
	var alto: float = sqrt(max(0.0, a * a - ao_longo * ao_longo))
	var E: Vector3 = S + n * ao_longo + polo * alto
	var T: Vector3 = S + n * d
	var gu2 := _apontar(s, u, gp, s.get_bone_pose(l).origin, E - S, w)
	var gl2 := _apontar(s, l, gu2, s.get_bone_pose(h).origin, T - E, w)
	# a mão / o pé mantém o giro da animação (não torce junto com o braço)
	var ph := s.get_bone_pose(h)
	var local := (gl2.basis.get_rotation_quaternion().inverse() * giro_mao).normalized()
	s.set_bone_pose_rotation(h, ph.basis.get_rotation_quaternion().slerp(local, w))

func _apontar(s: Skeleton3D, osso: int, pai_global: Transform3D, eixo_local: Vector3, alvo: Vector3, w: float) -> Transform3D:
	var pose := s.get_bone_pose(osso)
	var gg := pai_global * pose
	var eixo: Vector3 = (gg.basis * eixo_local).normalized()
	if alvo.length() < 1e-5 or eixo.length() < 1e-5:
		return gg
	var giro := Quaternion(eixo, alvo.normalized())
	var alvo_local := (pai_global.basis.orthonormalized().inverse() * (Basis(giro) * gg.basis.orthonormalized())).get_rotation_quaternion()
	var q := pose.basis.get_rotation_quaternion().slerp(alvo_local, w)
	s.set_bone_pose_rotation(osso, q)
	return pai_global * Transform3D(Basis(q).scaled(pose.basis.get_scale()), pose.origin)

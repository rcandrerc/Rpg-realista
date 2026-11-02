extends SkeletonModifier3D
# Peso do corpo, por cima da animação (roda antes do braco_espada.gd):
# - inclinacao: tronco deita para dentro da curva (radianos, + = para a direita);
# - frente: tronco vai para a frente na arrancada e para trás na freada (radianos, + = para a frente),
#   dividido pela coluna e pelo peito; o pescoço compensa um pouco para a cabeça ficar firme;
# - afunda: quadril desce (metros), no pouso e na freada.

var inclinacao := 0.0
var frente := 0.0
var afunda := 0.0
var _coluna := -1
var _peito := -1
var _pescoco := -1
var _quadril := -1
var _frente := Vector3.BACK # frente do corpo no espaço do esqueleto
var _lado := Vector3.RIGHT # direita do corpo
var _cima := Vector3.UP

func preparar(esq: Skeleton3D) -> void:
	_coluna = esq.find_bone("J_Bip_C_Spine")
	_peito = esq.find_bone("J_Bip_C_Chest")
	_pescoco = esq.find_bone("J_Bip_C_Neck")
	_quadril = esq.find_bone("J_Bip_C_Hips")
	if _coluna < 0 or _quadril < 0:
		return
	var p := func(n: String) -> Vector3: return esq.get_bone_global_rest(esq.find_bone(n)).origin
	_cima = (p.call("J_Bip_C_Head") - p.call("J_Bip_C_Hips")).normalized()
	var dir: Vector3 = (p.call("J_Bip_R_UpperArm") - p.call("J_Bip_L_UpperArm")).normalized()
	_frente = _cima.cross(dir).normalized()
	if (p.call("J_Bip_R_ToeBase") - p.call("J_Bip_R_Foot")).dot(_frente) < 0.0:
		_frente = -_frente
	_lado = _frente.cross(_cima).normalized() # girar em volta dele com ângulo negativo leva o tronco para a frente

func _girar(s: Skeleton3D, osso: int, eixo_esq: Vector3, ang: float) -> void:
	if osso < 0 or abs(ang) < 0.0005:
		return
	var pai := s.get_bone_global_pose(s.get_bone_parent(osso))
	var eixo := (pai.basis.inverse() * eixo_esq).normalized()
	s.set_bone_pose_rotation(osso, Quaternion(eixo, ang) * s.get_bone_pose_rotation(osso))

func _process_modification() -> void:
	var s := get_skeleton()
	if s == null or _coluna < 0:
		return
	# frente/trás: 60% na coluna, 40% no peito (curva o tronco em vez de dobrar num ponto só)
	var f := -frente # ângulo negativo em volta do lado = para a frente
	if _peito >= 0:
		_girar(s, _coluna, _lado, f * 0.6)
		_girar(s, _peito, _lado, f * 0.4)
	else:
		_girar(s, _coluna, _lado, f)
	_girar(s, _pescoco, _lado, -f * 0.45)
	# curva: deita em volta da frente do corpo
	_girar(s, _coluna, _frente, inclinacao)
	if afunda > 0.001:
		var pq := s.get_bone_parent(_quadril)
		var b := s.get_bone_global_pose(pq).basis if pq >= 0 else Basis()
		s.set_bone_pose_position(_quadril, s.get_bone_pose_position(_quadril) - (b.inverse() * _cima) * afunda)

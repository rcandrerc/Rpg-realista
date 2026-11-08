class_name Expressao
extends RefCounted

# Expressões leves no combate (André 2026-11-08, plano do Jules feito aqui): o herói semicerra os olhos e franze a
# testa quando leva dano, e fica com o olhar firme (olhos um pouco fechados, sobrancelha baixa) durante o combo de
# espada. Usa os blend shapes de rosto que o VRoid já traz (Fcl_EYE_Close, Fcl_EYE_Angry, Fcl_BRW_Angry).
# Alguns GLB do exportar.js perdem os nomes e ficam só com o número, e a ordem muda de modelo para modelo: a tabela
# abaixo (para esses) saiu dos .vrm (client/public/assets/personagens/vrm, extras.targetNames da malha do rosto).
const INDICES := {
	"ruiva": {"fechar": 13, "bravo": 12, "testa": 6},
	"cabelo_m": {"fechar": 10, "bravo": 16, "testa": 7},
	"fumiriya": {"fechar": 10, "bravo": 16, "testa": 7},
	"shino": {"fechar": 12, "bravo": 11, "testa": 5},
	"vivi": {"fechar": 12, "bravo": 11, "testa": 5},
	"vita": {"fechar": 12, "bravo": 11, "testa": 5},
	"victoria": {"fechar": 12, "bravo": 11, "testa": 5},
	"shibu": {"fechar": 12, "bravo": 11, "testa": 5},
	"shibu_sombrio": {"fechar": 12, "bravo": 11, "testa": 5},
}
const DOR_DURA := 0.45 # s: o susto do dano some nesse tempo
const DOR_FECHA := 0.55 # olhos semicerrados (1 = fechados)
const DOR_TESTA := 0.6
const FOCO_DURA := 1.3 # s depois do último golpe o rosto relaxa
const FOCO_BRAVO := 0.6
const FOCO_TESTA := 0.5
const FOCO_FECHA := 0.15

var _malhas: Array[MeshInstance3D] = []
var _idx: Array[Vector3i] = [] # fechar, bravo, testa em cada malha
var dor := 0.0
var foco := 0.0
var _foco_t := 0.0
var _ultimo := Vector3(-1, -1, -1)

func _init(no: Node3D, visual: String) -> void:
	var tab: Dictionary = INDICES.get(visual, {})
	for mi: MeshInstance3D in no.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh == null or mi.mesh.get_blend_shape_count() == 0:
			continue
		var v := Vector3i(_achar(mi, "Fcl_EYE_Close", tab.get("fechar")), _achar(mi, "Fcl_EYE_Angry", tab.get("bravo")),
			_achar(mi, "Fcl_BRW_Angry", tab.get("testa")))
		if v.x >= 0 and v.y >= 0 and v.z >= 0:
			_malhas.append(mi)
			_idx.append(v)

# pelo nome do VRoid (alguns GLB guardam) ou pelo número da tabela (os que perderam o nome)
static func _achar(mi: MeshInstance3D, nome: String, numero) -> int:
	for i in mi.mesh.get_blend_shape_count():
		if String(mi.mesh.get_blend_shape_name(i)).ends_with(nome):
			return i
	return mi.find_blend_shape_by_name(str(numero)) if numero != null else -1

func levou_dano() -> void:
	dor = 1.0

func golpeou() -> void:
	_foco_t = FOCO_DURA

func atualizar(dt: float) -> void:
	if _malhas.is_empty():
		return
	dor = move_toward(dor, 0.0, dt / DOR_DURA)
	_foco_t = max(0.0, _foco_t - dt)
	foco = move_toward(foco, 1.0 if _foco_t > 0.0 else 0.0, dt * (6.0 if _foco_t > 0.0 else 2.5))
	var d := dor * dor * (3.0 - 2.0 * dor) # suave na volta
	var alvo := Vector3(
		max(DOR_FECHA * d, FOCO_FECHA * foco),
		FOCO_BRAVO * foco * (1.0 - d),
		max(DOR_TESTA * d, FOCO_TESTA * foco))
	if alvo.is_equal_approx(_ultimo):
		return # parado: não mexe na malha (FPS)
	_ultimo = alvo
	for n in _malhas.size():
		var mi := _malhas[n]
		if not is_instance_valid(mi):
			continue
		mi.set_blend_shape_value(_idx[n].x, alvo.x)
		mi.set_blend_shape_value(_idx[n].y, alvo.y)
		mi.set_blend_shape_value(_idx[n].z, alvo.z)

extends Node
# Névoa encantada (progressão até o Nv 100, André 2026-11-10; dados em habilidades.json, chave "historia", feitos por
# shared/historia.js). O mapa começa fechado: cada zona (campos, grutas, vilas do mundo grande, a Ilha do Meio e
# Aurora) fica coberta por uma parede de névoa lilás até a missão principal que a abre. O André escolheu "Névoa
# visível + aviso": nada de parede invisível. O herói para na borda (andar.gd pergunta fechado()) e o servidor
# confere (Simulacao.naNevoa) e manda o aviso de qual missão abre.
# Desempenho (André prefere FPS a enfeite): uma malha por região fechada, um material só para todas; sem sombra, sem luz.

const ALTURA := 16.0 # m da parede de névoa na borda das regiões
const ALTURA_TERRA := 34.0 # m da parede de névoa na costa da ilha e de Aurora
const COR := Color(0.86, 0.82, 0.97)

var m # main.gd
var H: Dictionary = {} # historia
var quem_libera: Dictionary = {} # zona ou recurso -> índice da missão
var _mat: ShaderMaterial
var _malhas: Dictionary = {} # id da zona -> MeshInstance3D
var _feito_p := -1 # hist.p da última montagem
var _t := 0.0

func _init(principal) -> void:
	m = principal
	var d = m.P.dados.get("historia")
	if d is Dictionary:
		H = d
	var ms: Array = H.get("missoes", [])
	for i in ms.size():
		for k in ms[i].get("libera", []):
			quem_libera[str(k)] = i

# ---------- regras (as mesmas de shared/historia.js) ----------
# sem internet (reserva) não tem como fazer missão: tudo aberto, como antes
func hist() -> Dictionary:
	var h = m.P.prog.get("hist")
	if not (m.online and m.online.ligado) or not (h is Dictionary):
		return {"p": H.get("missoes", []).size(), "ac": false, "n": 0}
	return h

func feitas() -> int:
	return int(hist().get("p", 0))

func liberado(k: String) -> bool:
	return not quem_libera.has(k) or feitas() > int(quem_libera[k])

func missao_atual() -> Dictionary:
	var ms: Array = H.get("missoes", [])
	var p := feitas()
	return ms[p] if p < ms.size() else {}

func zona(id: String) -> Dictionary:
	for z in H.get("zonas", []):
		if str(z.id) == id:
			return z
	return {}

# (x, z) dentro da região? (André 2026-11-11: regiões grandes; toda zona vem como polígono, a ilha também)
func na_zona(Z: Dictionary, x: float, z: float) -> bool:
	var pol: PackedVector2Array = _pol(Z)
	return pol.size() >= 3 and Geometry2D.is_point_in_polygon(Vector2(x, z), pol)

var _pols: Dictionary = {}
func _pol(Z: Dictionary) -> PackedVector2Array:
	var id := str(Z.id)
	if not _pols.has(id):
		var pol := PackedVector2Array()
		var lista = Z.get("poligono")
		if lista is Array:
			for q in lista:
				pol.append(Vector2(float(q[0]), float(q[1])))
		_pols[id] = pol
	return _pols[id]

# a zona ainda na névoa em (x, z), ou {}
func fechada_em(x: float, z: float) -> Dictionary:
	if H.is_empty():
		return {}
	for Z in H.get("zonas", []):
		if not Z.get("selo", false) and not liberado(str(Z.id)) and na_zona(Z, x, z):
			return Z
	return {}

func fechado(x: float, z: float) -> bool:
	return not fechada_em(x, z).is_empty()

# a missão que abre a zona ou o recurso k (André 2026-11-11: "falar concluir tal missão para desbloquear")
func texto(k: String) -> String:
	if not quem_libera.has(k):
		return ""
	var M: Dictionary = H.missoes[int(quem_libera[k])]
	var Z := zona(k)
	return "%s: %s. Conclua a missão \"%s\" (fale com %s, Nv %d) para desbloquear" % ["Região fechada" if not Z.is_empty() else "Ainda fechado", Z.nome if not Z.is_empty() else str(H.get("recursos", {}).get(k, k)), M.nome, str(M.get("npcNome", M.npc)), int(M.nv)]

# andar.gd: o herói bateu na névoa em (x, z). Avisa qual missão abre (no máximo a cada 4 s)
var _aviso_t := 0.0
func bateu(x: float, z: float) -> void:
	var Z := fechada_em(x, z)
	if Z.is_empty() or Time.get_ticks_msec() < _aviso_t:
		return
	_aviso_t = Time.get_ticks_msec() + 4000.0
	m.hud.aviso(texto(str(Z.id)))

# ---------- desenho ----------
func _material() -> ShaderMaterial:
	if _mat:
		return _mat
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
render_mode unshaded, blend_mix, cull_disabled, depth_draw_never, shadows_disabled, fog_disabled;
uniform vec3 cor = vec3(0.86, 0.82, 0.97);
varying float alto;
varying vec3 mundo;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float ruido(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
	return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void vertex() { alto = UV.y; mundo = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 q = vec2(mundo.x + mundo.z, mundo.y) * 0.09;
	float n = ruido(q + vec2(TIME * 0.13, -TIME * 0.05)) * 0.6 + ruido(q * 2.3 - vec2(TIME * 0.21, TIME * 0.08)) * 0.4;
	float a = (0.35 + 0.65 * n) * pow(1.0 - alto, 1.4) * smoothstep(0.0, 0.08, alto + 0.02);
	float perto = smoothstep(2.0, 9.0, length(VERTEX)); // colado na câmera fica mais transparente (não tampa a tela)
	ALBEDO = cor * (0.9 + 0.2 * n);
	ALPHA = clamp(a * 0.85 * perto, 0.0, 0.9);
}
"""
	_mat = ShaderMaterial.new()
	_mat.shader = sh
	_mat.set_shader_parameter("cor", Vector3(COR.r, COR.g, COR.b))
	return _mat

func _chao(x: float, z: float) -> float:
	return m.terreno.altura(x, z) if m.terreno else 0.0

# um pedaço de parede de a até b, subindo h m (UV.y: 0 embaixo, 1 em cima; o shader desbota para cima)
func _parede(st: SurfaceTool, a: Vector3, b: Vector3, h: float) -> void:
	var a2 := a + Vector3(0, h, 0)
	var b2 := b + Vector3(0, h, 0)
	for v in [[a, 0.0], [b, 0.0], [b2, 1.0], [a, 0.0], [b2, 1.0], [a2, 1.0]]:
		st.set_uv(Vector2(0.0, v[1]))
		st.add_vertex(v[0])

# a parede de névoa em toda a borda da região, em pedaços de PASSO m que seguem o chão (no mar fica um pouco abaixo da
# água). Bordas fora do mundo não aparecem para ninguém, então tanto faz.
const PASSO := 6.0
func _montar(Z: Dictionary) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pol := _pol(Z)
	var alt := ALTURA_TERRA if Z.get("terra") else ALTURA
	for i in pol.size():
		var a: Vector2 = pol[i]
		var b: Vector2 = pol[(i + 1) % pol.size()]
		var n: int = maxi(1, int(ceil(a.distance_to(b) / PASSO)))
		var q0 := a
		for k in n:
			var q1: Vector2 = a.lerp(b, float(k + 1) / n)
			_parede(st, Vector3(q0.x, maxf(_chao(q0.x, q0.y), -1.0) - 0.5, q0.y), Vector3(q1.x, maxf(_chao(q1.x, q1.y), -1.0) - 0.5, q1.y), alt)
			q0 = q1
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = _material() # um material só para todas as zonas
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.name = "Nevoa_%s" % Z.id
	return mi

func _process(dt: float) -> void:
	if H.is_empty() or m.heroi == null or m.terreno == null:
		return
	_t -= dt
	if _t > 0.0:
		return
	_t = 0.5
	if _feito_p == feitas():
		return
	_feito_p = feitas() # missão entregue (ou o progresso chegou): a névoa da região liberada some, a das fechadas aparece
	for id in _malhas.keys():
		if liberado(id):
			_malhas[id].queue_free()
			_malhas.erase(id)
	for Z in H.get("zonas", []):
		var id := str(Z.id)
		if Z.get("selo", false) or liberado(id) or _malhas.has(id):
			continue
		var mi := _montar(Z)
		m.add_child(mi)
		_malhas[id] = mi

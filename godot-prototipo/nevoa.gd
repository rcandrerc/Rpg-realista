extends Node
# Névoa encantada (progressão até o Nv 100, André 2026-11-10; dados em habilidades.json, chave "historia", feitos por
# shared/historia.js). O mapa começa fechado: cada zona (campos, grutas, vilas do mundo grande, a Ilha do Meio e
# Aurora) fica coberta por uma parede de névoa lilás até a missão principal que a abre. O André escolheu "Névoa
# visível + aviso": nada de parede invisível. O herói para na borda (andar.gd pergunta fechado()) e o servidor
# confere (Simulacao.naNevoa) e manda o aviso de qual missão abre.
# Desempenho (André prefere FPS a enfeite): só as zonas fechadas a até ALCANCE m têm malha; um material só para todas;
# sem sombra, sem luz.

const ALCANCE := 260.0
const ALTURA := 11.0 # m da parede de névoa dos campos
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

# (x, z) dentro da zona? Círculos (campo, gruta, vila) ou contorno da terra (ilha fechada, continente aberto)
func na_zona(Z: Dictionary, x: float, z: float) -> bool:
	if Z.get("terra"):
		var c: Array = Z.get("contorno", [])
		if c.is_empty():
			return false
		if Z.get("fechado", false):
			var pol := PackedVector2Array()
			for q in c:
				pol.append(Vector2(float(q[0]), float(q[1])))
			return Geometry2D.is_point_in_polygon(Vector2(x, z), pol)
		# continente (Aurora, forma sul): fechado ao sul da linha
		var i: int = clampi(int(round((x - float(c[0][0])) / 8.0)), 0, c.size() - 1)
		return z > float(c[i][1]) if str(Z.get("forma", "sul")) == "sul" else z < float(c[i][1])
	for q in Z.get("circulos", []):
		if Vector2(float(q.x) - x, float(q.z) - z).length() < float(q.r):
			return true
	return false

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

# a missão que abre a zona ou o recurso k
func texto(k: String) -> String:
	if not quem_libera.has(k):
		return ""
	var M: Dictionary = H.missoes[int(quem_libera[k])]
	var Z := zona(k)
	return "%s abre com a missão \"%s\" (Nv %d)" % [Z.nome if not Z.is_empty() else str(H.get("recursos", {}).get(k, k)), M.nome, int(M.nv)]

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

# anel de névoa em volta de um círculo do campo (parede baixa, sobe do chão)
func _anel(cx: float, cz: float, r: float, st: SurfaceTool) -> void:
	var n: int = clampi(int(r * 1.6), 24, 72)
	for i in n:
		var a0 := TAU * i / n
		var a1 := TAU * (i + 1) / n
		var x0 := cx + cos(a0) * r
		var z0 := cz + sin(a0) * r
		var x1 := cx + cos(a1) * r
		var z1 := cz + sin(a1) * r
		_parede(st, Vector3(x0, _chao(x0, z0) - 0.4, z0), Vector3(x1, _chao(x1, z1) - 0.4, z1), ALTURA)

func _chao(x: float, z: float) -> float:
	return m.terreno.altura(x, z) if m.terreno else 0.0

# um pedaço de parede de a até b, subindo h m (UV.y: 0 embaixo, 1 em cima; o shader desbota para cima)
func _parede(st: SurfaceTool, a: Vector3, b: Vector3, h: float) -> void:
	var a2 := a + Vector3(0, h, 0)
	var b2 := b + Vector3(0, h, 0)
	for v in [[a, 0.0], [b, 0.0], [b2, 1.0], [a, 0.0], [b2, 1.0], [a2, 1.0]]:
		st.set_uv(Vector2(0.0, v[1]))
		st.add_vertex(v[0])

func _montar(Z: Dictionary) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var alt := ALTURA
	if Z.get("terra"):
		alt = ALTURA_TERRA
		var c: Array = Z.get("contorno", [])
		var n := c.size()
		for i in (n if Z.get("fechado", false) else n - 1):
			var p0 = c[i]
			var p1 = c[(i + 1) % n]
			_parede(st, Vector3(float(p0[0]), -3.0, float(p0[1])), Vector3(float(p1[0]), -3.0, float(p1[1])), alt)
	else:
		for q in Z.get("circulos", []):
			_anel(float(q.x), float(q.z), float(q.r), st)
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
	if _t > 0.0 and _feito_p == feitas():
		return
	_t = 0.5
	if _feito_p != feitas(): # missão entregue: a névoa da zona liberada some
		_feito_p = feitas()
		for id in _malhas.keys():
			if liberado(id):
				_malhas[id].queue_free()
				_malhas.erase(id)
	var hp: Vector3 = m.heroi.position
	for Z in H.get("zonas", []):
		var id := str(Z.id)
		if Z.get("selo", false) or liberado(id):
			continue
		var perto := _perto(Z, hp)
		if perto and not _malhas.has(id):
			var mi := _montar(Z)
			m.add_child(mi)
			_malhas[id] = mi
		elif _malhas.has(id):
			_malhas[id].visible = perto

func _perto(Z: Dictionary, hp: Vector3) -> bool:
	if Z.get("terra"):
		for q in Z.get("contorno", []):
			if absf(float(q[0]) - hp.x) < ALCANCE * 1.6 and absf(float(q[1]) - hp.z) < ALCANCE * 1.6:
				return true
		return false
	for q in Z.get("circulos", []):
		if Vector2(float(q.x) - hp.x, float(q.z) - hp.z).length() < ALCANCE + float(q.r):
			return true
	return false

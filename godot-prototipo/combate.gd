extends RefCounted
# Sensação do combate (André 2026-11-02: "o combate parece de jogo amador"). Pacote A:
# - o monstro avisa antes de bater: brilho vermelho que cresce durante o preparo (COMBATE.preparo em dados.gd);
# - tranco no corpo do monstro para o lado do golpe (mola), em vez de só tocar "apanhar";
# - firme: depois de muitos golpes seguidos ele aguenta e revida (brilho laranja + "Firme!");
# - esquiva: rolar ou dar dash na hora do golpe = câmera lenta curtinha + "Esquiva!" e o próximo golpe vale mais;
# - morte: o corpo é jogado para trás, depois se desfaz em fumaça; volta com um sopro de poeira;
# - último inimigo por perto: câmera lenta curtinha (a câmera não se mexe, só o tempo).
# As regras (quando bate, quem fica firme, quanto vale o contra-ataque) são do servidor (shared/simulacao.js);
# sem internet main.gd faz igual com os mesmos números (dados.gd COMBATE).

const MOLA_K := 190.0
const MOLA_AMORT := 13.0
const TRANCO := 3.2 # rad/s de impulso por golpe (forte = 1,6x)
const TRANCO_MAX := 0.38 # rad
const DESFAZ_APOS := 1.5 # s depois de morrer o corpo vira fumaça
const DESFAZ_DUR := 0.55

var m # main.gd
var fx
var _corpos := {} # Node3D do monstro -> estado (mola, brilho, morte)
var _mat_preparo: StandardMaterial3D
var _mat_firme: StandardMaterial3D

func _init(principal) -> void:
	m = principal
	fx = m.fx
	_mat_preparo = _brilho_mat(Color(1.0, 0.12, 0.05))
	_mat_firme = _brilho_mat(Color(1.0, 0.55, 0.1))

func _brilho_mat(cor: Color) -> StandardMaterial3D:
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	mat.albedo_color = Color(cor, 0.0)
	return mat

func _c(no: Node3D) -> Dictionary:
	var c = _corpos.get(no)
	if c == null:
		var malhas := []
		for mi in no.find_children("*", "MeshInstance3D", true, false):
			if not (mi.mesh is QuadMesh): # o corpo, não a barra de vida
				malhas.append(mi)
		c = {"tilt": Vector2.ZERO, "v": Vector2.ZERO, "preparo": 0.0, "preparo_dur": 0.0, "firme": 0.0,
			"morto": -1.0, "escala": no.scale, "malhas": malhas, "volta": 0.0, "reagiu": -9.0}
		_corpos[no] = c
	return c

# tranco do golpe: o corpo inclina para longe de quem bateu e volta na mola
func reacao(no: Node3D, de: Vector3, forte := false) -> void:
	if not is_instance_valid(no):
		return
	var c := _c(no)
	c.reagiu = m.tempo
	if c.firme > 0.0:
		forte = false # firme: quase não balança
	else:
		c.preparo = 0.0 # apanhou no meio do preparo: o golpe dele foi cortado (o servidor faz igual)
	var d := no.global_position - de
	d.y = 0
	if d.length() < 0.01:
		d = -Vector3(sin(no.rotation.y), 0, cos(no.rotation.y))
	d = d.normalized()
	var fr := Vector3(sin(no.rotation.y), 0, cos(no.rotation.y))
	var di := Vector3(cos(no.rotation.y), 0, -sin(no.rotation.y))
	var k: float = TRANCO * (1.6 if forte else 1.0) * (0.35 if c.firme > 0.0 else 1.0)
	c.v += Vector2(d.dot(fr), -d.dot(di)) * k

func reagiu_agora(no: Node3D) -> bool:
	var c = _corpos.get(no)
	return c != null and m.tempo - c.reagiu < 0.3

# o monstro vai bater daqui a `dur` s: brilho vermelho que cresce
func preparo(no: Node3D, dur: float) -> void:
	if not is_instance_valid(no):
		return
	var c := _c(no)
	c.preparo = dur
	c.preparo_dur = dur

func firme(no: Node3D, dur: float) -> void:
	if not is_instance_valid(no):
		return
	var c := _c(no)
	c.firme = dur
	fx.texto(no.global_position, "Firme!", Color(1.0, 0.62, 0.2), 0.0, 0.7, 2.1, 0.8)
	var p: Vector3 = no.global_position
	fx.surto(p.x, p.y + 1.0, p.z, 10, "ffe0a0", "ff8a1a", 3.5, 0.08)

# o herói rolou ou deu dash bem na hora do golpe
func esquiva(heroi: Node3D) -> void:
	fx.texto(heroi.global_position, "Esquiva!", Color(0.7, 0.95, 1.0), 0.0, 0.8, 1.9, 0.9)
	m.lenta(0.28, 0.35)
	m.sons.tocar("dash", -4.0, 0.05)

func morreu(no: Node3D) -> void:
	if not is_instance_valid(no):
		return
	var c := _c(no)
	c.morto = 0.0
	c.preparo = 0.0
	c.firme = 0.0
	c.volta = 0.0
	# último monstro por perto: câmera lenta curtinha (só o tempo; a câmera fica como está)
	var vivos := 0
	for e in m.inimigos:
		if e.no != no and e.estado != "morto" and e.no.position.distance_to(m.heroi.position) < 15.0:
			vivos += 1
	if vivos == 0 and m.tempo - c.reagiu < 0.6:
		m.lenta(0.45, 0.3)

# voltou (renasceu): aparece com um sopro de poeira, crescendo
func voltou(no: Node3D) -> void:
	if not is_instance_valid(no):
		return
	var c := _c(no)
	c.morto = -1.0
	c.volta = 0.35
	no.visible = true
	no.scale = c.escala * 0.6
	var p: Vector3 = no.global_position
	fx.poeira(p.x, p.z, 0.9, 10, "b8ab95", "7a6f60")

func passo(dt: float) -> void:
	for no in _corpos.keys():
		if not is_instance_valid(no):
			_corpos.erase(no)
			continue
		var c: Dictionary = _corpos[no]
		# mola do tranco (em passos curtos: quadro lento não explode)
		var resta := dt
		while resta > 0.0:
			var h: float = min(resta, 1.0 / 60.0)
			resta -= h
			c.v += (-c.tilt * MOLA_K - c.v * MOLA_AMORT) * h
			c.tilt += c.v * h
		c.tilt = c.tilt.limit_length(TRANCO_MAX)
		no.rotation.x = c.tilt.x
		no.rotation.z = c.tilt.y
		# brilho: preparo (vermelho crescendo) ou firme (laranja pulsando)
		var mat: StandardMaterial3D = null
		if c.preparo > 0.0:
			c.preparo -= dt
			var f: float = 1.0 - clamp(c.preparo / max(0.05, c.preparo_dur), 0.0, 1.0)
			_mat_preparo.albedo_color.a = 0.12 + 0.5 * f * f
			mat = _mat_preparo
		elif c.firme > 0.0:
			c.firme -= dt
			_mat_firme.albedo_color.a = 0.18 + 0.12 * sin(m.tempo * 14.0)
			mat = _mat_firme
		for mi in c.malhas:
			if not is_instance_valid(mi):
				continue
			if mat != null and (mi.material_overlay == null or mi.material_overlay == _mat_preparo or mi.material_overlay == _mat_firme):
				mi.material_overlay = mat
			elif mat == null and (mi.material_overlay == _mat_preparo or mi.material_overlay == _mat_firme):
				mi.material_overlay = null
		# morte: depois de cair, o corpo encolhe virando fumaça e some
		if c.morto >= 0.0:
			c.morto += dt
			if c.morto > DESFAZ_APOS and no.visible:
				var k: float = clamp((c.morto - DESFAZ_APOS) / DESFAZ_DUR, 0.0, 1.0)
				no.scale = c.escala * max(0.02, 1.0 - k * k)
				var p: Vector3 = no.global_position
				if randf() < 0.6:
					fx.fumaca_chao(p.x, p.z, 0.6, 2, "6a5f72", 0.6)
					fx.surto(p.x, p.y + 0.5, p.z, 2, "e8d8ff", "8a5cff", 1.6, 0.06)
				if k >= 1.0:
					no.visible = false
					no.scale = c.escala
		elif c.volta > 0.0:
			c.volta -= dt
			no.scale = c.escala * lerp(1.0, 0.6, clamp(c.volta / 0.35, 0.0, 1.0))

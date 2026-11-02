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
var _mat_preparo: ShaderMaterial
var _mat_firme: ShaderMaterial
var _arco_sh: Shader
var _arco_malha: Mesh

# brilho só na borda do corpo (fresnel): o miolo do monstro continua com a cor e a sombra dele (direção de arte)
const SH_BORDA := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_back, shadows_disabled;
uniform vec4 cor : source_color = vec4(1.0, 0.2, 0.05, 1.0);
uniform float forca = 0.0;
void fragment() {
	float f = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 2.5);
	ALBEDO = cor.rgb;
	ALPHA = f * forca;
}
"""
const BRILHO_MAX := 0.62
const ARCO_COR := Color("c2401a")
const ARCO_ALFA := 0.4
const ARCO_R0 := 0.4
const ARCO_R1 := 1.8 # m: alcance do golpe
# arco do preparo (direção de arte): só contorno de fora (8 cm, alfa 0,45) e um degradê por dentro que vai de 0
# no monstro até 0,15 na ponta, e avança para fora conforme o preparo (mostra o tempo até o golpe)
const SH_ARCO := """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;
uniform vec4 cor : source_color = vec4(0.76, 0.25, 0.1, 1.0);
uniform float prog = 0.0;
uniform float aparece = 0.0;
uniform float borda_k = 0.057;
void fragment() {
	float r = UV.x;
	float borda = step(1.0 - borda_k, r) * 0.45;
	float miolo = r * 0.15 * step(r, prog);
	ALBEDO = cor.rgb;
	ALPHA = max(borda, miolo) * aparece;
}
"""

func _init(principal) -> void:
	m = principal
	fx = m.fx
	_mat_preparo = _brilho_mat(Color(1.0, 0.12, 0.05))
	_mat_firme = _brilho_mat(Color(1.0, 0.55, 0.1))
	_arco_sh = Shader.new()
	_arco_sh.code = SH_ARCO
	_arco_malha = _malha_arco()

func _brilho_mat(cor: Color) -> ShaderMaterial:
	var sh := Shader.new()
	sh.code = SH_BORDA
	var mat := ShaderMaterial.new()
	mat.shader = sh
	mat.set_shader_parameter("cor", cor)
	return mat

# arco no chão à frente do monstro (o alcance do golpe): o jogador lê no celular onde vai pegar
func _malha_arco() -> Mesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var N := 24
	var r0 := ARCO_R0
	var r1 := ARCO_R1
	var abre := deg_to_rad(55.0)
	for i in N:
		var a0: float = -abre + 2.0 * abre * i / N
		var a1: float = -abre + 2.0 * abre * (i + 1) / N
		var p := [Vector3(sin(a0) * r0, 0, cos(a0) * r0), Vector3(sin(a0) * r1, 0, cos(a0) * r1), Vector3(sin(a1) * r0, 0, cos(a1) * r0), Vector3(sin(a1) * r1, 0, cos(a1) * r1)]
		var uv := [Vector2(0, 0), Vector2(1, 0), Vector2(0, 1), Vector2(1, 1)] # x: 0 no monstro, 1 na ponta
		for k in [0, 1, 2, 1, 3, 2]:
			st.set_uv(uv[k])
			st.add_vertex(p[k])
	return st.commit()

func _c(no: Node3D) -> Dictionary:
	var c = _corpos.get(no)
	if c == null:
		var malhas := []
		for mi in no.find_children("*", "MeshInstance3D", true, false):
			if not (mi.mesh is QuadMesh): # o corpo, não a barra de vida
				malhas.append(mi)
		c = {"tilt": Vector2.ZERO, "v": Vector2.ZERO, "preparo": 0.0, "preparo_dur": 0.0, "firme": 0.0,
			"morto": -1.0, "escala": no.scale, "malhas": malhas, "volta": 0.0, "reagiu": -9.0, "arco": null, "firme_txt": null}
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
	if c.arco == null:
		var a := MeshInstance3D.new()
		a.mesh = _arco_malha
		var am := ShaderMaterial.new()
		am.shader = _arco_sh
		am.set_shader_parameter("cor", ARCO_COR)
		am.set_shader_parameter("borda_k", 0.08 / (ARCO_R1 - ARCO_R0))
		a.material_override = am
		a.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		no.add_child(a)
		c.arco = a
	c.arco.position = Vector3(0, 0.05 / max(0.01, no.scale.y), 0)
	c.arco.scale = Vector3.ONE / max(0.01, no.scale.x) # mesmo tamanho em metros no monstro grande (chefe)
	c.arco.visible = true

func firme(no: Node3D, dur: float) -> void:
	if not is_instance_valid(no):
		return
	var c := _c(no)
	c.firme = dur
	# um "Firme!" por monstro, 0,4 m acima do nome, letra de 22 px, some em 0,6 s
	if c.firme_txt == null or not is_instance_valid(c.firme_txt):
		var l := Label3D.new()
		l.text = "Firme!"
		l.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		l.fixed_size = true
		l.no_depth_test = true
		l.font_size = 72
		l.outline_size = 16
		l.pixel_size = 0.00034 * 22.0 / 14.0 # o nome tem 14 px
		l.offset = Vector2(0, 52.0 * 14.0 / 22.0)
		l.modulate = Color(1.0, 0.62, 0.2)
		l.outline_modulate = Color(0.12, 0.05, 0.0)
		l.position = Vector3(0, 1.95, 0) # no lugar do nome (main.empilhar_nomes esconde o nome enquanto dura)
		no.add_child(l)
		c.firme_txt = l
	c.firme_txt_t = 0.6
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

# marca do alvo: anel fino laranja no chão de quem o golpe vai pegar (null = esconde)
var _marca: MeshInstance3D
var _marca_a := 0.0
func marcar(no, dt: float) -> void:
	if _marca == null:
		_marca = MeshInstance3D.new()
		var t := TorusMesh.new()
		t.inner_radius = 0.62
		t.outer_radius = 0.7
		t.rings = 32
		t.ring_segments = 4
		_marca.mesh = t
		_marca.scale = Vector3(1, 0.05, 1)
		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		mat.albedo_color = Color(1.0, 0.55, 0.2, 0.0)
		_marca.material_override = mat
		_marca.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		m.add_child(_marca)
	var quer: float = 1.0 if no != null and is_instance_valid(no) and no.visible else 0.0
	_marca_a = move_toward(_marca_a, quer, dt * 6.0)
	_marca.visible = _marca_a > 0.01
	if quer > 0.0:
		_marca.global_position = no.global_position + Vector3(0, 0.06, 0)
		var s: float = no.scale.x * (1.0 + 0.04 * sin(m.tempo * 6.0))
		_marca.scale = Vector3(s, 0.05, s)
	_marca.material_override.albedo_color.a = 0.55 * _marca_a

# aviso no chão da magia de área enquanto concentra: círculo do tamanho da área, na cor do elemento,
# borda fina e miolo quase transparente; segue `no` (o herói ou o alvo do Meteoro) e some quando solta
const SH_AREA := """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;
uniform vec4 cor : source_color = vec4(1.0, 0.4, 0.1, 1.0);
uniform float aparece = 0.0;
uniform float prog = 0.0;
uniform float borda_k = 0.03;
void fragment() {
	float d = length(UV - 0.5) * 2.0;
	if (d > 1.0) discard;
	float borda = step(1.0 - borda_k, d) * 0.45;
	float miolo = d * 0.12 * step(d, prog);
	ALBEDO = cor.rgb;
	ALPHA = max(borda, miolo) * aparece;
}
"""
var _area: MeshInstance3D
var _area_no: Node3D
var _area_t := 0.0
var _area_dur := 0.0
var _area_fim := false
func aviso_area(no: Node3D, raio: float, dur: float, cor: Color) -> void:
	if _area == null:
		_area = MeshInstance3D.new()
		var q := PlaneMesh.new()
		q.size = Vector2(2, 2)
		_area.mesh = q
		var sh := Shader.new()
		sh.code = SH_AREA
		var mat := ShaderMaterial.new()
		mat.shader = sh
		_area.material_override = mat
		_area.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		m.add_child(_area)
	_area_no = no
	_area_t = 0.0
	_area_dur = max(0.1, dur)
	_area_fim = false
	_area.scale = Vector3(raio, 1, raio)
	_area.material_override.set_shader_parameter("cor", cor)
	_area.material_override.set_shader_parameter("borda_k", 0.12 / max(0.5, raio))
	_area.visible = true

func aviso_area_fim() -> void:
	_area_fim = true

func _area_passo(dt: float) -> void:
	if _area == null or not _area.visible:
		return
	_area_t += dt
	if _area_t >= _area_dur:
		_area_fim = true
	var a: float = clamp(_area_t / 0.15, 0.0, 1.0)
	if _area_fim:
		a = 0.0
		_area.visible = false
	if is_instance_valid(_area_no):
		_area.global_position = _area_no.global_position + Vector3(0, 0.05, 0)
	_area.material_override.set_shader_parameter("aparece", a)
	_area.material_override.set_shader_parameter("prog", clamp(_area_t / _area_dur, 0.0, 1.0))

func passo(dt: float) -> void:
	_area_passo(dt)
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
		# brilho na borda: preparo (vermelho crescendo, com o arco no chão) ou firme (laranja pulsando)
		var mat: ShaderMaterial = null
		var arco_a := 0.0
		var arco_prog := 0.0
		if c.preparo > 0.0:
			c.preparo -= dt
			var f: float = 1.0 - clamp(c.preparo / max(0.05, c.preparo_dur), 0.0, 1.0)
			_mat_preparo.set_shader_parameter("forca", 0.12 + (BRILHO_MAX - 0.12) * f * f)
			mat = _mat_preparo
			arco_a = clamp(f * 4.0, 0.0, 1.0)
			arco_prog = f
		elif c.firme > 0.0:
			c.firme -= dt
			_mat_firme.set_shader_parameter("forca", 0.4 + 0.15 * sin(m.tempo * 14.0))
			mat = _mat_firme
		if c.arco != null and is_instance_valid(c.arco):
			c.arco.visible = arco_a > 0.0
			c.arco.material_override.set_shader_parameter("aparece", arco_a)
			c.arco.material_override.set_shader_parameter("prog", arco_prog)
		if c.get("firme_txt_t", 0.0) > 0.0 and c.firme_txt != null and is_instance_valid(c.firme_txt):
			c.firme_txt_t -= dt
			var a: float = clamp(c.firme_txt_t / 0.6, 0.0, 1.0)
			c.firme_txt.modulate.a = a
			c.firme_txt.outline_modulate.a = a
			c.firme_txt.visible = a > 0.0
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

extends Node
const Idioma = preload("res://idioma.gd") # inglês (idioma.gd): texto montado também sai traduzido
# Bosses de mundo (André 2026-11-11: "uns bosses espalhados pelo mundo... com skills especiais, não só bater").
# Quem decide tudo é o servidor (shared/simulacao.js passoBosses / lancarSkillBoss; dados em shared/dados.js
# BOSSES_MUNDO). Aqui só o que se vê:
#   - a marca vermelha no chão antes da skill (círculo, cone ou faixa) enchendo até a hora do golpe, e o golpe;
#   - poças que ficam (lava, veneno) brilhando no chão enquanto machucam;
#   - a barra do boss no topo da tela quando o herói está perto, com o nome e a fúria;
#   - no herói: atordoado/congelado/derrubado (não anda nem age), lento e os números do sangramento, veneno e queimadura;
#   - o visual de cada boss (tamanho, tinta e brilho na borda) e o estado de cada um para o mapa (vivo ou quando volta).

var m # main.gd
var _shader: Shader
var avisos: Array = [] # {no, mat, t, dur, id}
var pocas: Array = [] # {no, mat, t, ate, ef, x, z, r, fx}
var estado := {} # id do boss -> {"vivo": bool, "volta": segundos que faltavam, "t": m.tempo quando chegou}
var preso_ate := 0.0
var lento_ate := 0.0
var lento_k := 0.0
var _escondidos: Array = [] # [nó, m.tempo para aparecer de novo] (skills 'voo' e 'sumir')
var _hud: CanvasLayer
var _painel: PanelContainer
var _nome: Label
var _barra: ProgressBar
var _fundo_barra: StyleBoxFlat
var _hud_t := 0.0
var _alvo_hud = null

const COR := {"dano": Color("ff4a2a"), "atordoa": Color("ff5a2a"), "sangra": Color("e0182a"), "veneno": Color("7ae04a"),
	"queima": Color("ff8a1a"), "congela": Color("8adfff"), "lento": Color("a77bff")}
const TEXTO_EF := {"atordoa": "Atordoado!", "congela": "Congelado!", "derruba": "Derrubado!", "lento": "Lento",
	"sangra": "Sangrando", "veneno": "Envenenado", "queima": "Queimando"}

const SHADER := """
shader_type spatial;
render_mode unshaded, cull_disabled, depth_draw_never, blend_mix, shadows_disabled;
uniform vec4 cor : source_color = vec4(1.0, 0.3, 0.2, 1.0);
uniform float prog = 0.0;
uniform float pulso = 0.0;
void fragment() {
	float u = UV.x;
	float borda = max(smoothstep(0.92, 0.985, u), smoothstep(0.9, 0.99, UV.y));
	float cheio = 1.0 - smoothstep(prog - 0.025, prog, u);
	float a = 0.16 + 0.34 * cheio + 0.55 * borda + pulso * 0.12 * sin(TIME * 6.0);
	ALBEDO = cor.rgb * (1.0 + 0.5 * cheio + 0.4 * borda);
	ALPHA = clamp(a, 0.0, 1.0) * cor.a;
}
"""

func _init(principal) -> void:
	m = principal

func _ready() -> void:
	_shader = Shader.new()
	_shader.code = SHADER
	_montar_hud()

# ---------- o que o resto do jogo pergunta ----------
func preso() -> bool:
	return m.tempo < preso_ate

func lento() -> float:
	return 1.0 - lento_k if m.tempo < lento_ate else 1.0

# estado de um boss para o mapa: "" (vivo ou sem notícia) ou o texto de quando volta
func volta_texto(id: String) -> String:
	if not estado.has(id) or estado[id].vivo:
		return ""
	var s: float = max(0.0, float(estado[id].volta) - (m.tempo - float(estado[id].t)))
	if s <= 60.0:
		return "volta já"
	var h := int(s / 3600.0)
	var mi := int(fmod(s, 3600.0) / 60.0)
	return "volta em %d h %02d" % [h, mi] if h > 0 else "volta em %d min" % mi

func vivo(id: String) -> bool:
	return not estado.has(id) or estado[id].vivo

# ---------- visual de cada boss (main.gd _criar_vaga): tinta por cima e brilho da cor dele na borda ----------
func vestir(e: Dictionary, v: Dictionary) -> void:
	var cor := Color.hex((int(v.get("cor", 0xffffff)) << 8) | 0xff)
	for mi in e.no.find_children("*", "MeshInstance3D", true, false):
		for i in mi.mesh.get_surface_count():
			var mat = mi.get_surface_override_material(i)
			if mat == null:
				mat = mi.mesh.surface_get_material(i)
			if mat is ShaderMaterial:
				var s: ShaderMaterial = mat.duplicate() # só este boss: os monstros comuns continuam com o material de sempre
				s.set_shader_parameter("tinta", cor)
				s.set_shader_parameter("tinta_forca", float(v.get("tinta", 0.55))) # o Titã e o dragão já têm a cor deles: tinta fraca
				s.set_shader_parameter("borda_cor", cor.lightened(0.25))
				s.set_shader_parameter("borda_forca", 0.75 if float(v.get("tinta", 0.55)) > 0.1 else 0.25) # sem tinta (Titã): cor do Quimera, borda fraca
				s.set_shader_parameter("brilho_forca", 1.8)
				mi.set_surface_override_material(i, s)
			elif mat is BaseMaterial3D:
				var b: BaseMaterial3D = mat.duplicate()
				b.albedo_color = b.albedo_color * cor.lerp(Color.WHITE, 0.25)
				b.rim_enabled = true
				b.rim = 0.9
				b.rim_tint = 0.2
				b.emission_enabled = true
				b.emission = cor * 0.18
				mi.set_surface_override_material(i, b)
	for l in e.no.get_children():
		if l is Label3D:
			l.modulate = Color("ffd76a")
			l.outline_modulate = Color(0.25, 0.05, 0.02)
			break

# ---------- eventos do servidor (online.gd) ----------
func evento(ev: Dictionary, corpos: Dictionary, meu_id: String) -> void:
	match str(ev.get("t", "")):
		"bosses": # [id, vivo, segundos até voltar]
			for l in ev.get("l", []):
				estado[str(l[0])] = {"vivo": int(l[1]) == 1, "volta": float(l[2]), "t": m.tempo}
		"bossSkill":
			var cor: Color = COR.get(str(ev.get("ef", "dano")), COR.dano)
			for f in ev.get("formas", []):
				var no := _marca(f, cor)
				avisos.append({"no": no, "mat": no.material_override, "t": 0.0, "dur": max(0.2, float(ev.dur)), "id": str(ev.id)})
			var k := str(ev.get("k", ""))
			var corpo = corpos.get(str(ev.id))
			if corpo:
				m.fx.texto(corpo.global_position, str(ev.get("nome", "")), Color("ffcf6a"), 0.0, 1.2, 3.2, 1.25)
				if k == "voo" or k == "sumir": # sobe no ar ou some na sombra: ninguém acerta até cair
					m.fx.fumaca_chao(corpo.global_position.x, corpo.global_position.z, 2.5, 30, "3a3040", 1.4)
					corpo.visible = false
					_escondidos.append([corpo, m.tempo + float(ev.dur)])
		"bossGolpe":
			var cor: Color = COR.get(str(ev.get("ef", "dano")), COR.dano)
			var k := str(ev.get("k", ""))
			for a in avisos:
				if a.id == str(ev.id):
					a.t = a.dur # acabou o aviso: some já
			for f in ev.get("formas", []):
				_golpe(f, cor, k)
		"furia":
			var corpo = corpos.get(str(ev.id))
			if corpo:
				m.fx.texto(corpo.global_position, "FÚRIA!", Color("ff3a2a"), 0.0, 1.4, 3.6, 1.6)
				m.fx.surto(corpo.global_position.x, corpo.global_position.y + 1.5, corpo.global_position.z, 40, "ffd27a", "ff2a1a", 6.0)
		"efeito":
			var ef := str(ev.get("ef", ""))
			var dur := float(ev.get("dur", 1.0))
			var eu: bool = str(ev.get("id", "")) == meu_id
			var corpo = m.heroi if eu else corpos.get(str(ev.get("id", "")))
			if ef in ["atordoa", "congela", "derruba"]:
				if eu:
					preso_ate = max(preso_ate, m.tempo + dur)
					m.acao = {}
					if ef == "derruba" and m.heroi_anim:
						m.heroi_anim.play("apanhar", 0.05, 0.8)
				if corpo:
					m.fx.status(corpo, "congela" if ef == "congela" else "atordoa", dur)
			elif ef == "lento" and eu:
				lento_ate = m.tempo + dur
				lento_k = float(ev.get("k", 0.3))
			if eu:
				var t: String = TEXTO_EF.get(ef, "")
				if ef == "sangra" and int(ev.get("n", 1)) > 1:
					t += " x%d" % int(ev.n)
				if t != "":
					m.fx.texto(m.heroi.global_position, t, COR.get(ef, Color("ff5a2a")), 0.0, 1.0, 2.2, 1.0)

# cor do número de dano de sangramento, veneno ou queimadura (online.gd)
func cor_dot(k: String) -> Color:
	return COR.get(k, Color(1, 0.45, 0.4))

# ---------- marcas no chão ----------
func _altura(x: float, z: float) -> float:
	return m.terreno.relevo(x, z) + 0.08 if m.terreno != null else 0.08

func _marca(f: Dictionary, cor: Color) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var x := float(f.x)
	var z := float(f.z)
	match str(f.f):
		"c": # círculo: anéis do meio até a borda (UV.x = quanto longe do meio)
			_leque(st, x, z, float(f.r), 0.0, TAU, 40)
		"v": # cone: na frente do boss (frente = (sin ry, cos ry), como no servidor)
			_leque(st, x, z, float(f.a), float(f.ry), float(f.ang), 22)
		_: # faixa (investida): UV.x = o quanto já andou, UV.y = o quanto para o lado
			_faixa(st, x, z, float(f.ry), float(f.a), float(f.l))
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var mat := ShaderMaterial.new()
	mat.shader = _shader
	mat.set_shader_parameter("cor", Color(cor.r, cor.g, cor.b, 0.95))
	mat.set_shader_parameter("prog", 0.0)
	mi.material_override = mat
	add_child(mi)
	return mi

func _leque(st: SurfaceTool, x: float, z: float, r: float, ry: float, ang: float, n: int) -> void:
	var aneis := 5
	var pts := [] # [anel][i] = Vector3
	for a in aneis + 1:
		var linha := []
		var rr := r * a / aneis
		for i in n + 1:
			var t := ry - ang * 0.5 + ang * i / n
			var px := x + sin(t) * rr
			var pz := z + cos(t) * rr
			linha.append(Vector3(px, _altura(px, pz), pz))
		pts.append(linha)
	var cheio := ang >= TAU - 0.01
	for a in aneis:
		for i in n:
			var u0 := float(a) / aneis
			var u1 := float(a + 1) / aneis
			var lado0: float = 0.0 if cheio else absf(float(i) / n - 0.5) * 2.0
			var lado1: float = 0.0 if cheio else absf(float(i + 1) / n - 0.5) * 2.0
			_tri(st, [pts[a][i], pts[a + 1][i], pts[a + 1][i + 1]], [Vector2(u0, lado0), Vector2(u1, lado0), Vector2(u1, lado1)])
			_tri(st, [pts[a][i], pts[a + 1][i + 1], pts[a][i + 1]], [Vector2(u0, lado0), Vector2(u1, lado1), Vector2(u0, lado1)])

func _faixa(st: SurfaceTool, x: float, z: float, ry: float, comp: float, larg: float) -> void:
	var fx := sin(ry)
	var fz := cos(ry)
	var n := int(max(4, comp / 1.5))
	for i in n:
		var s0 := comp * i / n
		var s1 := comp * (i + 1) / n
		var q := []
		for s in [s0, s1]:
			for l in [-larg * 0.5, larg * 0.5]:
				var px: float = x + fx * s + fz * l
				var pz: float = z + fz * s - fx * l
				q.append(Vector3(px, _altura(px, pz), pz))
		var u0 := float(i) / n
		var u1 := float(i + 1) / n
		_tri(st, [q[0], q[2], q[3]], [Vector2(u0, 1), Vector2(u1, 1), Vector2(u1, 1)])
		_tri(st, [q[0], q[3], q[1]], [Vector2(u0, 1), Vector2(u1, 1), Vector2(u0, 1)])
		# miolo da faixa sem borda dos lados: um quadrado por dentro (a borda do lado vem do UV.y = 1 só na beira)
		var mid := []
		for s in [s0, s1]:
			for l in [-larg * 0.42, larg * 0.42]:
				var px: float = x + fx * s + fz * l
				var pz: float = z + fz * s - fx * l
				mid.append(Vector3(px, _altura(px, pz) + 0.01, pz))
		_tri(st, [mid[0], mid[2], mid[3]], [Vector2(u0, 0), Vector2(u1, 0), Vector2(u1, 0)])
		_tri(st, [mid[0], mid[3], mid[1]], [Vector2(u0, 0), Vector2(u1, 0), Vector2(u0, 0)])

func _tri(st: SurfaceTool, v: Array, uv: Array) -> void:
	for k in 3:
		st.set_uv(uv[k])
		st.add_vertex(v[k])

# a hora do golpe: explosão da cor do efeito e, se a skill deixa poça, a poça brilhando no chão
func _golpe(f: Dictionary, cor: Color, k: String) -> void:
	var x := float(f.x)
	var z := float(f.z)
	var y := _altura(x, z)
	var c0 := cor.lightened(0.45).to_html(false)
	var c1 := cor.to_html(false)
	match str(f.f):
		"c":
			m.fx.area(x, z, float(f.r), [c0, c1], 0.55, y)
			if k == "pocas":
				var no := _marca(f, cor)
				no.material_override.set_shader_parameter("prog", 1.0)
				no.material_override.set_shader_parameter("pulso", 1.0)
				pocas.append({"no": no, "t": 0.0, "ate": m.tempo + 5.5, "x": x, "z": z, "r": float(f.r), "c0": c0, "c1": c1, "fx": 0.0})
		"v":
			var a := float(f.a)
			for i in 4:
				var s := a * (0.3 + 0.23 * i)
				var px := x + sin(float(f.ry)) * s
				var pz := z + cos(float(f.ry)) * s
				m.fx.surto(px, _altura(px, pz) + 0.6, pz, 18, c0, c1, 5.0)
			m.fx.poeira(x + sin(float(f.ry)) * a * 0.5, z + cos(float(f.ry)) * a * 0.5, a * 0.4, 20, c0, c1)
		_:
			var a := float(f.a)
			for i in 5:
				var s := a * i / 4.0
				var px := x + sin(float(f.ry)) * s
				var pz := z + cos(float(f.ry)) * s
				m.fx.poeira(px, pz, float(f.l) * 0.6, 10, "b8a080", "6a5a40")

func _process(dt: float) -> void:
	var t0_parte := Time.get_ticks_usec()
	_process_parte(dt)
	if Time.get_ticks_usec() - t0_parte >= 1000 and Engine.has_meta("lentidao"): # quadro lento (lentidao.gd)
		Engine.get_meta("lentidao").ev("boss_mundo", t0_parte)

func _process_parte(dt: float) -> void:
	for i in range(avisos.size() - 1, -1, -1):
		var a: Dictionary = avisos[i]
		a.t += dt
		if a.t >= a.dur + 0.05:
			a.no.queue_free()
			avisos.remove_at(i)
		else:
			a.mat.set_shader_parameter("prog", clamp(a.t / a.dur, 0.0, 1.0))
	for i in range(pocas.size() - 1, -1, -1):
		var p: Dictionary = pocas[i]
		p.fx -= dt
		if p.fx <= 0.0:
			p.fx = 0.45
			var a := randf() * TAU
			var d: float = p.r * sqrt(randf()) * 0.8
			m.fx.labareda(p.x + cos(a) * d, _altura(p.x, p.z), p.z + sin(a) * d, p.c0, p.c1, 0.9)
		if m.tempo >= p.ate:
			p.no.queue_free()
			pocas.remove_at(i)
	for i in range(_escondidos.size() - 1, -1, -1):
		if m.tempo >= _escondidos[i][1]:
			var no = _escondidos[i][0]
			if is_instance_valid(no):
				no.visible = true
				m.fx.fumaca_chao(no.global_position.x, no.global_position.z, 3.0, 30, "3a3040", 1.4)
			_escondidos.remove_at(i)
	_hud_t -= dt
	if _hud_t <= 0.0:
		_hud_t = 0.15
		_atualizar_hud()

# ---------- barra do boss no topo da tela ----------
func _montar_hud() -> void:
	_hud = CanvasLayer.new()
	_hud.layer = 5
	add_child(_hud)
	_painel = PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.06, 0.04, 0.03, 0.78)
	sb.border_color = Color("c9a24a")
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(16)
	sb.content_margin_left = 18
	sb.content_margin_right = 18
	sb.content_margin_top = 8
	sb.content_margin_bottom = 10
	_painel.add_theme_stylebox_override("panel", sb)
	_painel.anchor_left = 0.5
	_painel.anchor_right = 0.5
	_painel.offset_left = -230
	_painel.offset_right = 230
	_painel.offset_top = 64
	_painel.visible = false
	_hud.add_child(_painel)
	var col := VBoxContainer.new()
	col.add_theme_constant_override("separation", 5)
	_painel.add_child(col)
	_nome = Label.new()
	_nome.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_nome.add_theme_font_size_override("font_size", 22)
	_nome.add_theme_color_override("font_color", Color("ffd76a"))
	_nome.add_theme_color_override("font_outline_color", Color(0.15, 0.05, 0.02))
	_nome.add_theme_constant_override("outline_size", 6)
	col.add_child(_nome)
	_barra = ProgressBar.new()
	_barra.custom_minimum_size = Vector2(420, 16)
	_barra.show_percentage = false
	var fundo := StyleBoxFlat.new()
	fundo.bg_color = Color(0.15, 0.08, 0.06, 0.95)
	fundo.set_corner_radius_all(8)
	_fundo_barra = StyleBoxFlat.new()
	_fundo_barra.bg_color = Color("c8281e")
	_fundo_barra.set_corner_radius_all(8)
	_barra.add_theme_stylebox_override("background", fundo)
	_barra.add_theme_stylebox_override("fill", _fundo_barra)
	col.add_child(_barra)

func _atualizar_hud() -> void:
	if m.heroi == null:
		return
	var hp: Vector3 = m.heroi.position
	var melhor = null
	var md := 40.0
	for e in m.inimigos:
		if not e.has("boss") or e.estado == "morto" or e.get("vazio", false):
			continue
		var d: float = e.no.position.distance_to(hp)
		if d < md:
			md = d
			melhor = e
	_painel.visible = melhor != null
	if melhor == null:
		return
	var vm: float = max(1.0, float(melhor.get("vida_max", 1.0)))
	_barra.max_value = vm
	_barra.value = clamp(float(melhor.get("vida", vm)), 0.0, vm)
	var furia: bool = float(melhor.get("vida", vm)) < vm * 0.5
	_fundo_barra.bg_color = Color("ff3a1a") if furia else Color("c8281e")
	var nome := ""
	for l in melhor.no.get_children():
		if l is Label3D:
			nome = l.text
			break
	_nome.text = Idioma.frase(nome + ("   · FÚRIA" if furia else ""))

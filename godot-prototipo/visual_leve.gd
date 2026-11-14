extends Node
# Visual leve (André 2026-11-10, olhando o Evil Lands: "gráficos simples mas bonitos e o jogo muito leve").
# Duas escolhas em Configurações (Configurações > Sombras e Cor da grama):
# - Sombras "Leves": a sombra de verdade (a que a placa desenha de novo todo quadro) só nos personagens (herói, NPCs,
#   monstros, montaria) e nas casas construídas nos lotes; árvores, casas da vila, mato, pedras e chão param de entrar no
#   mapa de sombra. Embaixo de cada árvore e ao lado de cada casa da vila fica uma sombra pronta, pintada uma vez só num
#   mapa do mundo (mais abaixo), que fica bem fraca à noite. Padrão desde 2026-11-10 (André aprovou pelas fotos).
#   Na medição (placa de vídeo por software, 2400x1080) a sombra era 1/3 a 1/2 do desenho; assim cai ~15-20%.
# - Cor da grama "Natural": verde-oliva mais natural (como o capim do Evil Lands), ainda pintado: o chão, o capim alto
#   e as folhinhas de grama ganham o mesmo tom.
# Personagem = malha presa num esqueleto (Skeleton3D); casa = o que construcao.gd monta e as casas do vila.glb.

const ARQUIVO := "user://config.cfg"
const CAMADA := 2 # bit das layers: quem projeta sombra no modo leve
const TOM_NATURAL := Color(0.93, 0.86, 0.72) # chão (multiplica a foto da grama, que é verde forte)
const PONTA_NATURAL := Color(1.0, 0.9, 0.76) # capim e folhinhas (mais amarelado, menos neon)

var m # main.gd
var sombra_leve := false
var grama_natural := false
var casas := false # André 2026-11-10: na vila a sombra das casas pode ser fixa, pintada (as casas que o jogador constrói continuam com a de verdade)
var _feito := false
var _t := 0.0
var _forca := -1.0
var _mats := {} # ShaderMaterial -> [parâmetro, valor original]

func _init(jogo) -> void:
	m = jogo
	name = "VisualLeve"
	var cfg := ConfigFile.new()
	cfg.load(ARQUIVO)
	sombra_leve = bool(cfg.get_value("config", "sombra_leve", true)) # André 2026-11-10: o leve é o padrão
	grama_natural = bool(cfg.get_value("config", "grama_natural", false)) # André preferiu a cor atual (fica a opção)

func _enter_tree() -> void:
	get_tree().node_added.connect(_entrou)

func _ready() -> void:
	for g in m.find_children("*", "GeometryInstance3D", true, false):
		_marcar(g)
	aplicar()

func _salvar(chave: String, v) -> void:
	var cfg := ConfigFile.new()
	cfg.load(ARQUIVO)
	cfg.set_value("config", chave, v)
	cfg.save(ARQUIVO)

func trocar_sombra(v: bool) -> void:
	sombra_leve = v
	_salvar("sombra_leve", v)
	aplicar()

func trocar_grama(v: bool) -> void:
	grama_natural = v
	_salvar("grama_natural", v)
	aplicar()

func aplicar() -> void:
	if m.sol:
		m.sol.shadow_caster_mask = CAMADA if sombra_leve else 0xFFFFFFFF
	if sombra_leve and not _feito:
		_montar_manchas()
	for mat in _mats_sombra:
		_ligar_mapa(mat)
	for mat in _mats:
		_tom(mat)

# ---------- quem projeta sombra no modo leve ----------
func _entrou(no: Node) -> void:
	if no is GeometryInstance3D:
		_marcar.call_deferred(no)

func _marcar(g) -> void:
	if not is_instance_valid(g) or not g.is_inside_tree():
		return
	if g is MeshInstance3D or g is MultiMeshInstance3D:
		for mat in _materiais(g):
			if not _mats.has(mat):
				var p := _param(mat)
				if p == "tom_grama" or mat.shader.resource_path.ends_with("/mato.gdshader"):
					_mats_sombra[mat] = true
					_ligar_mapa(mat)
				if p != "":
					_mats[mat] = {p: _valor(mat, p)}
					if p == "tom_ponta" and mat.shader.resource_path.ends_with("/mato.gdshader"): # o pé do capim acompanha o chão
						_mats[mat]["tom_grama"] = _valor(mat, "tom_grama")
					_tom(mat)
	if g.cast_shadow == GeometryInstance3D.SHADOW_CASTING_SETTING_OFF:
		return
	if _projeta(g):
		g.layers |= CAMADA

func _projeta(g: Node) -> bool:
	var a: Node = g.get_parent()
	var n := 0
	while a != null and a != m and n < 10:
		if a is Skeleton3D:
			return true
		if a == m.vila_no:
			if not casas:
				return false # a casa ganha sombra pintada (_montar_manchas)
			# casas do vila.glb: as grandes que não são árvore (as árvores ganham sombra pintada)
			return g is MeshInstance3D and g.get_aabb().size.y * g.global_transform.basis.get_scale().y > 3.0 and not _eh_arvore_vila(g)
		if a == m.construcao: # Vila dos Lotes: casas e peças construídas (poucas, continuam com sombra de verdade)
			return true
		a = a.get_parent()
		n += 1
	return false

func _queda():
	return m.trabalho.queda if m.trabalho and "queda" in m.trabalho else null

func _eh_arvore_vila(g: Node3D) -> bool:
	var q = _queda()
	if q == null:
		return false
	for l in q._vila.values():
		if g in l:
			return true
	return false

# ---------- sombra pintada embaixo das árvores ----------
# 2026-11-10 (André no celular: "com sombra leve nem tô vendo sombra nas árvores"): a primeira versão era uma mancha
# transparente deitada no chão, e o capim alto (mato.gd) e a grama ficavam por cima dela, tapando quase tudo. Agora a
# sombra é um mapa do mundo (1 pixel por metro) com a copa de cada árvore carimbada: o chão (chao.gdshader,
# terreno_mundo.gdshader) e o capim/samambaia (mato.gdshader) leem o mapa e escurecem embaixo da árvore. Árvore cortada
# sai do mapa (só o pedaço em volta é refeito) e volta quando cresce.
const ESCURO := 0.66 # quanto a copa tira de luz no meio (0 = nada, 1 = preto); o shader ainda salpica luz no meio
const ESCURO_CASA := 0.55
# o sol do jogo (main.gd montar_ambiente, sol.rotation -52/60 graus) não anda: a sombra pronta cai sempre para o mesmo lado
const SOL_ROT := Vector3(-52.0, 60.0, 0.0)
var _mapa: Image # RG8: R = copas, G = casas; 255 = sol, menor = sombra
var _sol := Vector2.ZERO # para onde a sombra anda no chão, por metro de altura
var _tex: ImageTexture
var _area := Rect2() # x0, z0, largura, altura (m = pixels)
var _copas := {} # Vector2i(célula de 16 m) -> [[x, z, raio, chave]]
var _pincel := {} # raio (px) -> Image RGBA do carimbo
var _mats_sombra := {} # materiais que leem o mapa
const CEL := 16.0

func _montar_manchas() -> void:
	_feito = true
	var L := -Basis.from_euler(SOL_ROT * PI / 180.0).z # direção em que a luz anda
	_sol = Vector2(L.x, L.z) / maxf(-L.y, 0.3)
	var raios := {}
	var lista: Array = [] # [x, z, raio, chave]
	for pos in m.arvores_mata:
		var c: Dictionary = m.arvores_mata[pos]
		if not raios.has(c.v):
			var malha: Mesh = m._malhas_mata.get("copa_%d" % c.v)
			var bb := malha.get_aabb() if malha else AABB(Vector3(-2, 0, -2), Vector3(4, 6, 4))
			raios[c.v] = maxf(bb.size.x, bb.size.z) * 0.5
		# a sombra da copa cai um pouco para o lado contrário ao sol (copa a ~4 m de altura por escala)
		var dz := _sol * minf(3.5 * c.t.basis.get_scale().y, 4.0) * 0.6
		lista.append([pos.x + dz.x, pos.y + dz.y, float(raios[c.v]) * c.t.basis.get_scale().x, pos])
	var q = _queda()
	if q != null:
		for k in q._vila:
			var l: Array = q._vila[k]
			var r := 1.5
			for mi in l:
				var bb: AABB = mi.get_aabb()
				var sc: Vector3 = mi.global_transform.basis.get_scale()
				r = maxf(r, maxf(bb.size.x * sc.x, bb.size.z * sc.z) * 0.5)
			lista.append([k.x / 10.0 + _sol.x * 2.0, k.y / 10.0 + _sol.y * 2.0, r, k])
			if not l.is_empty():
				var mi0: Node3D = l[0]
				var x0: float = k.x / 10.0
				var z0: float = k.y / 10.0
				var rr := r
				mi0.visibility_changed.connect(func(): _repintar(x0, z0, rr + 3.0))
	lista.append_array(_casas_carimbos())
	if lista.is_empty():
		return
	var a := Vector2(INF, INF)
	var b := Vector2(-INF, -INF)
	for t in lista:
		a = a.min(Vector2(t[0] - t[2], t[1] - t[2]))
		b = b.max(Vector2(t[0] + t[2], t[1] + t[2]))
		var ce := Vector2i(floori(t[0] / CEL), floori(t[1] / CEL))
		if not _copas.has(ce):
			_copas[ce] = []
		_copas[ce].append(t)
	a = (a - Vector2(4, 4)).floor()
	b = (b + Vector2(4, 4)).ceil()
	_area = Rect2(a, b - a)
	_mapa = Image.create(int(_area.size.x), int(_area.size.y), false, Image.FORMAT_RG8)
	_mapa.fill(Color.WHITE)
	# pinta em blocos de 256 m (o carimbo precisa de RGBA; o mapa inteiro em RGBA gastaria 4x a memória)
	var B := 256
	for by in range(0, _mapa.get_height(), B):
		for bx in range(0, _mapa.get_width(), B):
			_pintar(Rect2i(bx, by, mini(B, _mapa.get_width() - bx), mini(B, _mapa.get_height() - by)))
	_tex = ImageTexture.create_from_image(_mapa)
	for mat in _mats_sombra:
		_ligar_mapa(mat)

# refaz um pedaço do mapa (em pixels): fundo branco e o carimbo de cada copa que encosta nele
func _pintar(r: Rect2i) -> void:
	var img := Image.create(r.size.x, r.size.y, false, Image.FORMAT_RGBA8)
	img.fill(Color.WHITE)
	var o := _area.position + Vector2(r.position)
	var c0 := Vector2i(floori((o.x - 20.0) / CEL), floori((o.y - 20.0) / CEL))
	var c1 := Vector2i(floori((o.x + r.size.x + 20.0) / CEL), floori((o.y + r.size.y + 20.0) / CEL))
	for cz in range(c0.y, c1.y + 1):
		for cx in range(c0.x, c1.x + 1):
			for t in _copas.get(Vector2i(cx, cz), []):
				if _cortada(t[3]):
					continue
				var p: Image = t[4] if t.size() > 4 else _carimbo(t[2])
				var w := p.get_width()
				img.blend_rect(p, Rect2i(0, 0, w, w), Vector2i(roundi(t[0] - o.x) - w / 2, roundi(t[1] - o.y) - w / 2))
	img.convert(Image.FORMAT_RG8)
	_mapa.blit_rect(img, Rect2i(Vector2i.ZERO, r.size), r.position)

func _cortada(chave) -> bool:
	if chave == null: # casa
		return false
	if chave is Vector2:
		var c = m.arvores_mata.get(chave)
		return c == null or c.get("caida", false)
	var q = _queda()
	var l: Array = q._vila.get(chave, []) if q else []
	return not l.is_empty() and not l[0].visible

# copa vista de cima: escura no meio, sumindo macia até a borda (um pouco além da copa, como a sombra de verdade)
func _carimbo(raio: float) -> Image:
	var rp := clampi(roundi(raio * 1.1), 2, 14)
	if _pincel.has(rp):
		return _pincel[rp]
	var w := rp * 2 + 1
	var img := Image.create(w, w, false, Image.FORMAT_RGBA8)
	for y in w:
		for x in w:
			var d := Vector2(x - rp, y - rp).length() / float(rp)
			var al := (1.0 - smoothstep(0.45, 1.0, d)) * ESCURO
			img.set_pixel(x, y, Color(0, 1, 1, al)) # só o canal das copas (R)
	_pincel[rp] = img
	return img

func _repintar(x: float, z: float, raio: float) -> void:
	if _mapa == null:
		return
	var e := raio * 1.1 + 2.0
	var r := Rect2i(Vector2i(floori(x - e - _area.position.x), floori(z - e - _area.position.y)), Vector2i(ceili(e * 2.0) + 1, ceili(e * 2.0) + 1))
	r = r.intersection(Rect2i(Vector2i.ZERO, _mapa.get_size()))
	if r.size.x <= 0 or r.size.y <= 0:
		return
	_pintar(r)
	_tex.update(_mapa)

func _ligar_mapa(mat: ShaderMaterial) -> void:
	if _tex == null:
		return
	mat.set_shader_parameter("sombra_mapa", _tex)
	mat.set_shader_parameter("sombra_area", Vector4(_area.position.x, _area.position.y, _area.size.x, _area.size.y))
	mat.set_shader_parameter("sombra_forca", (_forca if _forca >= 0.0 else 1.0) if sombra_leve else 0.0)

# casas da vila (vila.glb, terreno.casas): a planta da casa arrastada para o lado contrário ao sol (como a sombra de
# verdade de uma casa de ~5 m), com a borda macia; vai no canal G do mapa (sem o salpicado de luz das copas)
func _casas_carimbos() -> Array:
	var l: Array = []
	if m.terreno == null or casas:
		return l
	for c in m.terreno.casas:
		if c.has("cel") or not c.has("hw"):
			continue
		var ex := Vector2(float(c.cos), -float(c.sen))
		var ez := Vector2(float(c.sen), float(c.cos))
		var hw: float = float(c.hw)
		var hd: float = float(c.hd)
		var alto: float = clampf(float(c.get("y1", 3.0)) + float(c.get("sobe", 2.0)) - m.terreno.altura_mundo(float(c.x), float(c.z)), 3.0, 7.0)
		var off := _sol * alto
		if off.length() > 6.0:
			off = off.normalized() * 6.0
		var meio := off * 0.5
		var E := ceili(Vector2(hw, hd).length() + off.length() * 0.5 + 2.0)
		var w := E * 2 + 1
		var img := Image.create(w, w, false, Image.FORMAT_RGBA8)
		for py in w:
			for px in w:
				var p := Vector2(px - E, py - E) + meio # em relação ao centro da casa
				var a := 0.0
				for k in 6:
					var q := p - off * (k / 5.0)
					var lq := Vector2(absf(q.dot(ex)) - hw, absf(q.dot(ez)) - hd)
					var dist := Vector2(maxf(lq.x, 0.0), maxf(lq.y, 0.0)).length()
					a = maxf(a, 1.0 - smoothstep(0.0, 1.3, dist))
				img.set_pixel(px, py, Color(1, 0, 1, a * ESCURO_CASA))
		l.append([float(c.x) + meio.x, float(c.z) + meio.y, float(E), null, img])
	return l

# chamado por queda_arvore.gd quando a árvore da mata cai (k = 0) ou volta a crescer (k de 0 a 1): a sombra sai do
# mapa quando cai e volta inteira quando a árvore termina de crescer (caida = false)
func crescer(c: Dictionary, k: float) -> void:
	if k > 0.0 and k < 1.0:
		return
	var o: Vector3 = c.t.origin
	_repintar.call_deferred(o.x, o.z, 8.0)

func _process(dt: float) -> void:
	var t0_parte := Time.get_ticks_usec()
	_process_parte(dt)
	if Time.get_ticks_usec() - t0_parte >= 1000 and Engine.has_meta("lentidao"): # quadro lento (lentidao.gd)
		Engine.get_meta("lentidao").ev("visual_leve", t0_parte)

func _process_parte(dt: float) -> void:
	_t += dt
	if _t < 0.5 or not sombra_leve:
		return
	_t = 0.0
	# de noite a mancha fica bem fraca (a lua ainda faz um pouco de sombra); no pôr e no nascer do sol, no meio
	var noite: float = m.dia.noite if m.dia else 0.0
	var f := lerpf(1.0, 0.3, noite)
	if absf(f - _forca) > 0.01:
		_forca = f
		for mat in _mats_sombra:
			mat.set_shader_parameter("sombra_forca", f)

# ---------- cor da grama ----------
func _param(mat: ShaderMaterial) -> String:
	var c: String = mat.shader.resource_path if mat.shader else ""
	if c.ends_with("/chao.gdshader") or c.ends_with("/terreno_mundo.gdshader"):
		return "tom_grama"
	if c.ends_with("/grama.gdshader") or c.ends_with("/mato.gdshader"):
		return "tom_ponta"
	return ""

func _tom(mat: ShaderMaterial) -> void:
	var b: Dictionary = _mats[mat]
	for p in b:
		var v = b[p]
		if grama_natural:
			v = PONTA_NATURAL if p == "tom_ponta" else TOM_NATURAL
		mat.set_shader_parameter(p, v)

func _valor(mat: ShaderMaterial, p: String):
	var v = mat.get_shader_parameter(p)
	if v == null:
		v = RenderingServer.shader_get_parameter_default(mat.shader.get_rid(), p)
	if v is Vector3:
		v = Color(v.x, v.y, v.z)
	return v

func _materiais(g: GeometryInstance3D) -> Array:
	var l: Array = []
	if g.material_override is ShaderMaterial:
		l.append(g.material_override)
	var mesh: Mesh = null
	if g is MeshInstance3D:
		mesh = g.mesh
	elif g is MultiMeshInstance3D and g.multimesh:
		mesh = g.multimesh.mesh
	if mesh:
		for i in mesh.get_surface_count():
			var mt = mesh.surface_get_material(i)
			if mt is ShaderMaterial:
				l.append(mt)
	return l

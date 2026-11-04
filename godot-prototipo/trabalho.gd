extends Node3D
# Parte 3 do Quimera: estamina (a barra amarela), vigor e profissões (Minerador, Lenhador, Ferreiro, Alfaiate, Mercador).
# Quem decide é o servidor (shared/simulacao.js): a estamina corre aqui junto para o herói responder na hora e acerta
# pelo valor que o servidor manda; os veios são desenhados aqui; o botão Coletar e o menu Criar só mandam o pedido.
# Números e receitas: dados/habilidades.json (shared/dados.js ESTAMINA, VIGOR, PROFISSOES, COLETA, RECEITAS).

var m # main.gd
var E: Dictionary # estamina
var sta := 67.0
var sta_t := 0.0 # s até a estamina voltar a encher
var sem_folego := false
var seguida := {"k": 1.0, "t": -9.0}
var combate_ate := -9.0
var coletaveis: Array = [] # {id, tipo, pos, r, no (veio), minerio (pedaços que somem esgotado), cargas, volta_ate}
var por_id := {}
# Desde 2026-11-03 todas as ~900 árvores da mata dão lenha: o botão procura só nas 9 casas de 6 m em volta do herói
# (grade), e o que precisa olhar todo quadro (veio que voltou, câmera dentro da pedra) anda só pelos veios.
var veios: Array = []
var grade := {} # Vector2i(casa de 6 m) -> [coletáveis]
var coletando = null # {c, dur, t, n (golpes dados), prof}
var ferramentas := {} # "min" -> picareta, "len" -> machado
var perto = null # coletável mais perto (para o botão)
var indo = null # {o, ate}: tocou em Coletar longe e o herói está andando até encostar
const DuasMaos = preload("res://duas_maos.gd")
var duas # duas_maos.gd: as duas mãos no cabo da picareta e do machado

# cores de cada veio (minerio.gdshader): o bloco inteiro é o minério bruto, facetado, como a referência do André
const BLOCO_VEIO := {
	"cobre": {"escura": Color("8a3416"), "clara": Color("ffbf86"), "metal": 0.75},
	"ferro": {"escura": Color("23262c"), "clara": Color("b4bfcc"), "metal": 0.7},
	"cristal": {"escura": Color("17122a"), "clara": Color("3f3266"), "metal": 0.15},
}
const COR_MINERIO := {"ferro": Color(0.34, 0.38, 0.45), "cobre": Color(0.72, 0.36, 0.16), "cristal": Color(0.55, 0.45, 1.0)}

func _init(principal) -> void:
	m = principal
	E = m.P.dados.estamina

func _ready() -> void:
	sta = sta_max()
	for c in m.mundo.get("coletaveis", []):
		var o := {"id": str(c.id), "tipo": str(c.tipo), "pos": Vector3(float(c.x), 0, float(c.z)), "r": float(c.r), "cargas": -1, "volta_ate": -1.0}
		o.pos.y = m.terreno.altura(o.pos.x, o.pos.z)
		if o.tipo != "arvore":
			_montar_veio(o, float(c.get("ry", 0.0)))
			veios.append(o)
		coletaveis.append(o)
		por_id[o.id] = o
		var k := Vector2i(floori(o.pos.x / 6.0), floori(o.pos.z / 6.0))
		if not grade.has(k):
			grade[k] = []
		grade[k].append(o)
	ferramentas["min"] = _ferramenta("res://ferramentas3d/Pickaxe_Bronze.gltf")
	ferramentas["len"] = _ferramenta("res://ferramentas3d/Axe_Bronze.gltf", 1.05) # o machado é mais fino: um pouco maior para ler na mão

# ---------- estamina ----------
func sta_max() -> float:
	return float(m.P.st.get("estaminaMax", 67))

func em_combate() -> bool:
	return m.tempo < combate_ate

func combate() -> void:
	combate_ate = m.tempo + float(E.combate)

func _seguida_k() -> float:
	if m.tempo - seguida.t < float(E.seguidaJanela):
		return min(float(E.seguidaMax), seguida.k + float(E.seguidaK))
	return 1.0

func pode(n: float) -> bool:
	return sta >= n * _seguida_k()

# dash, rolamento, mortal: gasto de uma vez, mais caro se seguido (igual ao servidor)
func gastar(n: float) -> bool:
	var k := _seguida_k()
	if sta < n * k:
		m.hud.aviso("Sem fôlego!")
		return false
	seguida = {"k": k, "t": m.tempo}
	sta -= n * k
	sta_t = max(sta_t, float(E.espera))
	return true

func passo_estamina(dt: float) -> void:
	var mx := sta_max()
	sta = min(sta, mx)
	var trote: float = float(m.P.dados.heroiCorrer) * float(E.trote)
	var mov = m.mov
	var correndo: bool = mov.chao and mov.arrancada == null and mov.esc == null and m.h.lunge == null and mov.montado.is_empty() and mov.velocidade() > trote * 1.12
	if correndo:
		var c := em_combate()
		sta = max(0.0, sta - float(E.correr) * (float(E.combateK) if c else 1.0) * dt)
		sta_t = max(sta_t, float(E.esperaCombate) if c else float(E.espera))
		if sta <= 0.0 and not sem_folego:
			sem_folego = true
			m.hud.aviso("Sem fôlego!")
			mov.disparada = false # acabou a estamina: a disparada desliga e o herói volta ao trote
	elif sta_t > 0.0:
		sta_t -= dt
	else:
		sta = min(mx, sta + mx * float(E.volta) * (float(E.voltaCombate) if em_combate() else 1.0) * dt)
	if sem_folego and sta >= mx * float(E.folego):
		sem_folego = false
	mov.vel_max = trote if sem_folego else 99.0

# o servidor manda a estamina dele 20 vezes por segundo: aqui só acerta quando os dois se perdem
func do_servidor(v: float) -> void:
	if abs(v - sta) > 8.0 or (v <= 0.5 and sta > 3.0):
		sta = v

# ---------- veios e árvores ----------
# a pedra dos veios é a mesma das rochas de musgo da vila (Poly Haven), já pintada no estilo do jogo
func _montar_veio(o: Dictionary, ry: float) -> void:
	var raiz := Node3D.new()
	raiz.position = o.pos
	raiz.rotation.y = ry
	add_child(raiz)
	o.no = raiz
	var rnd := RandomNumberGenerator.new()
	rnd.seed = hash(o.id)
	var cor: Color = COR_MINERIO.get(o.tipo, Color.GRAY)
	var cristal: bool = o.tipo == "cristal"
	# um material por veio: "cheio" a 0 deixa só este veio cinza quando esgota
	var B: Dictionary = BLOCO_VEIO.get(o.tipo, BLOCO_VEIO.cristal)
	var pm := ShaderMaterial.new()
	pm.shader = load("res://minerio.gdshader")
	pm.set_shader_parameter("cor_escura", B.escura)
	pm.set_shader_parameter("cor_clara", B.clara)
	pm.set_shader_parameter("metal", B.metal)
	pm.set_shader_parameter("semente", rnd.randf() * 50.0)
	# contorno escuro de ~1,2 cm, como as outras pedras e os personagens
	var cont := StandardMaterial3D.new()
	cont.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	cont.cull_mode = BaseMaterial3D.CULL_FRONT
	cont.grow = true
	cont.grow_amount = 0.012
	cont.albedo_color = Color(0.08, 0.06, 0.05)
	pm.next_pass = cont
	o.pedra_mat = pm
	# o veio inteiro (blocos e cristais) fica neste nó: some quando esgota e volta crescendo
	var corpo := Node3D.new()
	raiz.add_child(corpo)
	o.corpo = corpo
	# bloco principal grande e uns pedaços menores em volta, tudo dentro do raio de colisão (0,8 m)
	var principal := _bloco(rnd, 0.62 if not cristal else 0.6, 0.72 if not cristal else 0.42)
	var blocos := [[principal, Vector3.ZERO, 0.0]]
	var n := rnd.randi_range(3, 4)
	var a0 := rnd.randf() * TAU
	for i in n:
		var a: float = a0 + TAU * i / n + rnd.randf_range(-0.4, 0.4)
		var r: float = rnd.randf_range(0.2, 0.34)
		blocos.append([_bloco(rnd, r, r * rnd.randf_range(0.8, 1.2)), Vector3(cos(a), 0, sin(a)) * rnd.randf_range(0.5, 0.72), rnd.randf() * TAU])
	for bl in blocos:
		var mi := MeshInstance3D.new()
		mi.mesh = bl[0]
		mi.material_override = pm
		mi.position = bl[1]
		mi.rotation.y = bl[2]
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		corpo.add_child(mi)
	var alto_pedra: float = principal.get_aabb().end.y
	o.tri = principal.generate_triangle_mesh() # para achar a face da pedra onde a picareta bate
	# sombra de contato: mancha escura e suave no chão em volta da base
	var sombra := MeshInstance3D.new()
	var pl := PlaneMesh.new()
	pl.size = Vector2(2.4, 2.4)
	sombra.mesh = pl
	sombra.material_override = _mat_sombra()
	sombra.position.y = 0.03
	sombra.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	raiz.add_child(sombra)
	# cristais (somem quando o veio esgota para você)
	var minerio := Node3D.new()
	corpo.add_child(minerio)
	o.minerio = minerio
	# o que sobra quando o veio esgota: cascalho baixo no chão (o lugar continua ocupado para quem ainda não minerou)
	var entulho := Node3D.new()
	entulho.visible = false
	raiz.add_child(entulho)
	o.entulho = entulho
	for i in 7:
		var r: float = rnd.randf_range(0.07, 0.15)
		var cas := MeshInstance3D.new()
		cas.mesh = _bloco(rnd, r, r * 0.5)
		cas.material_override = _mat_cascalho()
		var a: float = rnd.randf() * TAU
		cas.position = Vector3(cos(a), 0, sin(a)) * rnd.randf_range(0.05, 0.55)
		cas.rotation.y = rnd.randf() * TAU
		entulho.add_child(cas)
	if cristal:
		# cacho de 10 a 14 cristais saindo da pedra escura: os do meio grandes e claros, os de fora menores e mais roxos
		var tri: TriangleMesh = principal.generate_triangle_mesh()
		var mc := _mat_cristal()
		var nc := rnd.randi_range(10, 14)
		var ac := rnd.randf() * TAU
		for i in nc:
			var a: float = ac + rnd.randf_range(-1.6, 1.6)
			var d: float = 0.0 if i == 0 else rnd.randf_range(0.06, 0.48)
			var alto: float = 1.25 if i == 0 else rnd.randf_range(0.3, 1.0) * (1.0 - d * 0.8)
			var base := Vector3(cos(a) * d, 0, sin(a) * d)
			var y: float = alto_pedra * 0.8
			var hit: Dictionary = tri.intersect_ray(base + Vector3(0, 3, 0), Vector3.DOWN)
			if not hit.is_empty():
				y = (hit.position as Vector3).y
			var p := MeshInstance3D.new()
			p.mesh = _cristal(alto, alto * rnd.randf_range(0.13, 0.19))
			p.material_override = mc
			p.position = Vector3(base.x, y - alto * 0.12, base.z) # o pé entra na pedra
			p.rotation_order = EULER_ORDER_YXZ
			var incl: float = rnd.randf_range(0.05, 0.18) if i == 0 else rnd.randf_range(0.25, 0.9)
			p.rotation = Vector3(incl, -a + PI / 2 + rnd.randf_range(-0.3, 0.3), rnd.randf_range(-0.15, 0.15))
			p.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
			minerio.add_child(p)
		var luz := OmniLight3D.new()
		luz.light_color = cor
		luz.light_energy = 1.3
		luz.omni_range = 4.0
		luz.position = Vector3(0, alto_pedra + 0.5, 0)
		minerio.add_child(luz)

# bloco facetado: esfera de poucas faces com os vértices puxados para dentro e para fora (pedra lascada), base chata
# enterrada uns 12 cm, normais chapadas e um tom por face (canal r da cor) para as facetas brilharem diferente
func _bloco(rnd: RandomNumberGenerator, raio: float, alto: float) -> ArrayMesh:
	var esf := SphereMesh.new()
	esf.radius = 1.0
	esf.height = 2.0
	esf.radial_segments = 7
	esf.rings = 4
	var arr := esf.get_mesh_arrays()
	var vs: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
	var puxa := {}
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_smooth_group(-1)
	for t in range(0, idx.size(), 3):
		st.set_color(Color(rnd.randf(), 0, 0))
		for j in 3:
			var v: Vector3 = vs[idx[t + j]]
			var chave := Vector3i((v * 100.0).round())
			if not puxa.has(chave):
				puxa[chave] = Vector3(rnd.randf_range(0.65, 1.2), rnd.randf_range(0.7, 1.2), rnd.randf_range(0.65, 1.2))
			var q: Vector3 = v * puxa[chave]
			st.add_vertex(Vector3(q.x * raio, (max(q.y, -0.35) + 0.35) * alto - 0.12, q.z * raio))
	st.generate_normals()
	return st.commit()

# cristal: prisma de 6 lados com ponta, normais chapadas; base ciano médio e ponta clara (cor no vértice)
func _cristal(alto: float, raio: float) -> Mesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_smooth_group(-1)
	var cb := Color("4a44e0") # pé azul fundo, meio violeta, ponta quase branca (como cristal de verdade, só que mais vivo)
	var cm := Color("9a80ff")
	var cp := Color("ffffff")
	var corpo: float = alto * 0.72
	for s in 6:
		var a1: float = TAU * s / 6.0
		var a2: float = TAU * (s + 1) / 6.0
		var b1 := Vector3(cos(a1) * raio, 0, sin(a1) * raio)
		var b2 := Vector3(cos(a2) * raio, 0, sin(a2) * raio)
		var t1 := b1 + Vector3(0, corpo, 0)
		var t2 := b2 + Vector3(0, corpo, 0)
		var pt := Vector3(0, alto, 0)
		for v in [[b1, cb], [b2, cb], [t2, cm], [b1, cb], [t2, cm], [t1, cm], [t1, cm], [t2, cm], [pt, cp]]:
			st.set_color(v[1])
			st.add_vertex(v[0])
	st.generate_normals()
	return st.commit()

var _mat_sb: ShaderMaterial
func _mat_sombra() -> ShaderMaterial:
	if _mat_sb:
		return _mat_sb
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode unshaded, depth_draw_never, cull_disabled, shadows_disabled;
void fragment() {
	float d = length(UV - vec2(0.5)) * 2.0;
	ALBEDO = vec3(0.04, 0.05, 0.02);
	ALPHA = (1.0 - smoothstep(0.35, 1.0, d)) * 0.45;
}"""
	_mat_sb = ShaderMaterial.new()
	_mat_sb.shader = sh
	return _mat_sb

var _mat_cr: ShaderMaterial
func _mat_cristal() -> ShaderMaterial:
	if _mat_cr:
		return _mat_cr
	_mat_cr = ShaderMaterial.new()
	_mat_cr.shader = load("res://cristal.gdshader") # vidro colorido com nuvens, reflexo e faíscas
	return _mat_cr

func _ferramenta(caminho: String, escala := 0.8) -> Node3D:
	var cena = load(caminho)
	var raiz := Node3D.new()
	if cena:
		var f: Node3D = cena.instantiate()
		raiz.add_child(f)
		f.position = Vector3(0, 0.36, 0) # o cabo na mão: a ferramenta sai para cima da mão como a espada
		f.scale = Vector3.ONE * escala
		var cx := AABB()
		var prim := true
		for mi in f.find_children("*", "MeshInstance3D", true, false):
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
			# tamanho no espaço da raiz (o cabo na origem): para pôr as duas mãos no cabo e a cabeça na pedra
			var tr: Transform3D = f.transform
			var no: Node = mi
			var acc := Transform3D.IDENTITY
			while no != f:
				acc = (no as Node3D).transform * acc
				no = no.get_parent()
			var bx: AABB = (tr * acc) * mi.get_aabb()
			cx = bx if prim else cx.merge(bx)
			prim = false
		raiz.set_meta("base", cx.position.y)
		raiz.set_meta("topo", cx.end.y)
	raiz.visible = false
	m.add_child(raiz)
	return raiz

# a câmera para antes da pedra do veio inteira (o raio de colisão do jogador é 0,7 m)
func dentro_de_pedra(p: Vector3) -> bool:
	for o in veios:
		if p.y < o.pos.y + 1.4 and Vector2(p.x - o.pos.x, p.z - o.pos.z).length() < 1.0:
			return true
	return false

func esgotado(o: Dictionary) -> bool:
	return o.cargas == 0 and o.volta_ate > m.tempo

# ---------- quadro a quadro ----------
func _process(dt: float) -> void:
	if m.heroi == null:
		return
	# veio que voltou: o minério aparece de novo
	for o in veios:
		if o.has("corpo") and not o.corpo.visible and not esgotado(o):
			_mostrar_veio(o, true)
			o.cargas = -1
	# o mais perto que dá para coletar (o botão aparece)
	perto = null
	if m.h.morto <= 0.0 and m.mov.esc == null:
		var md: float = float(m.P.dados.coletaDistancia) - 0.25
		for o in _perto_do_heroi():
			var d: float = Vector2(o.pos.x - m.heroi.position.x, o.pos.z - m.heroi.position.z).length() - o.r
			if d < md and not esgotado(o) and abs(o.pos.y - m.heroi.position.y) < 1.5:
				md = d
				perto = o
	if indo != null:
		if m.hud.mover.length() > 0.15 or m.tempo > indo.ate or esgotado(indo.o) or not m.acao.is_empty():
			indo = null # mexeu no joystick, fez outra coisa ou não chegou
		elif abs(_falta(indo.o)) <= 0.15:
			var o: Dictionary = indo.o
			indo = null
			m.rede("coletar", {"no": o.id})
	if coletando != null:
		_passo_coleta(dt)
	var ic := "pf_min" if perto != null and perto.tipo != "arvore" else "pf_len"
	if coletando != null:
		ic = "pf_" + coletando.prof
	m.hud.mostrar_botao("coletar", perto != null or coletando != null)
	m.hud.icone_botao("coletar", ic)

# coletáveis nas 9 casas da grade em volta do herói (a distância de coleta é bem menor que 6 m)
func _perto_do_heroi() -> Array:
	var l: Array = []
	var i := floori(m.heroi.position.x / 6.0)
	var j := floori(m.heroi.position.z / 6.0)
	for a in range(i - 1, i + 2):
		for b in range(j - 1, j + 2):
			var c = grade.get(Vector2i(a, b))
			if c != null:
				l.append_array(c)
	return l

# perto da oficina (forja do Tomás ou banca da Rosa)? O servidor confere a mesma distância.
func perto_oficina(prof: String) -> bool:
	var of: Dictionary = m.P.dados.oficina[prof]
	for n in m.npcs:
		if n.id == str(of.npc) and Vector2(n.no.position.x - m.heroi.position.x, n.no.position.z - m.heroi.position.z).length() < float(m.P.dados.oficinaDistancia) - 0.3:
			return true
	return false

# botão Coletar: começa (o servidor confere e manda "coleta") ou para
func tocar_botao() -> void:
	if coletando != null:
		parar(true)
		return
	if perto == null:
		return
	if not m.on():
		m.hud.aviso("A coleta só funciona online (o que você coleta fica na sua conta)")
		return
	var C: Dictionary = m.P.dados.coleta[perto.tipo]
	if m.P.prof_nivel(str(C.prof)) < int(C.get("nivel", 1)):
		m.hud.aviso("%s: precisa de %s Nv %d" % [C.nome, m.P.dados.profissoes[C.prof].nome, int(C.nivel)])
		return
	if m.P.vigor() < m.P.custo_vigor(str(m.P.dados.coleta[perto.tipo].prof), float(m.P.dados.coleta[perto.tipo].vigor)):
		m.hud.aviso("Sem vigor: ele volta sozinho com o tempo (cheio a cada 6 h)")
		return
	# longe do veio ou do tronco: anda até encostar e só então começa (a picareta tem que bater na pedra)
	if abs(_falta(perto)) > 0.2:
		indo = {"o": perto, "ate": m.tempo + 3.0}
		return
	m.rede("coletar", {"no": perto.id})

# quanto falta andar até ficar colado no coletável (veio: a pedra tem uns 2 m; árvore: o tronco)
func _falta(o: Dictionary) -> float:
	var encosto: float = ENCOSTO_VEIO if o.tipo != "arvore" else float(o.r) + 0.5
	if ferramentas.size() == 2:
		# a cabeça da ferramenta, no golpe com as duas mãos, para na face da pedra (ou na casca do tronco)
		var c: Vector2 = _cabeca_golpe(o)
		encosto = c.x + (_face_veio(o, c.y) if o.tipo != "arvore" else float(o.r) * 0.7)
		encosto = max(encosto, float(o.r) + 0.72) # mais perto que isso o corpo bate
	return Vector2(o.pos.x - m.heroi.position.x, o.pos.z - m.heroi.position.z).length() - encosto

# raio da pedra do veio na altura h, do lado de onde o herói está (raio contra o bloco principal)
func _face_veio(o: Dictionary, h: float) -> float:
	if not o.has("tri") or m.heroi == null:
		return 0.62
	var d: Vector3 = m.heroi.position - o.pos
	d.y = 0
	if d.length() < 0.01:
		return 0.62
	var raiz: Node3D = o.no
	var de: Vector3 = raiz.global_transform.affine_inverse() * (o.pos + d.normalized() * 3.0 + Vector3(0, h, 0))
	var para: Vector3 = raiz.global_transform.basis.inverse() * (-d.normalized())
	var hit: Dictionary = (o.tri as TriangleMesh).intersect_ray(de, para)
	if hit.is_empty():
		return 0.5
	var p: Vector3 = hit.position
	return Vector2(p.x, p.z).length()

# distância do centro do veio até o herói na hora de bater: a ponta da picareta desce na face da pedra
const ENCOSTO_VEIO := 1.95

# para onde o herói anda sozinho (main.direcao_joystick), ou zero
func direcao_auto() -> Vector3:
	if indo == null:
		return Vector3.ZERO
	var d: Vector3 = indo.o.pos - m.heroi.position
	d.y = 0
	# perto demais (colado na pedra), dá uns passos para trás; longe, anda até ela
	return d.normalized() * (0.5 if _falta(indo.o) > 0.0 else -0.35)

# o servidor começou uma batida (vem uma por batida; a coleta continua sozinha)
func comecou(no_id: String, dur: float, prof: String) -> void:
	var o = por_id.get(no_id)
	if o == null:
		return
	if coletando == null or coletando.c != o:
		coletando = {"c": o, "dur": dur, "t": 0.0, "n": -1, "prof": prof}
		m.acao = {"nome": "coleta", "t": 0.0, "dur": 1e9, "hits": [], "feitos": 0, "fn": func(_i): pass}
		m.h.pend = null
		_segurar_ferramenta(prof)
	else:
		coletando.dur = dur
		coletando.t = 0.0
		coletando.n = -1
	var d: Vector3 = o.pos - m.heroi.position
	m.mov.ry = atan2(d.x, d.z)
	m.mov.ry_mira = null
	m.heroi.rotation.y = m.mov.ry

func _passo_coleta(dt: float) -> void:
	var o: Dictionary = coletando.c
	# joystick, golpe ou outra ação: para (o servidor também para quando o herói sai do lugar)
	if m.acao.get("nome", "") != "coleta" or m.hud.mover.length() > 0.35 or m.h.morto > 0.0:
		parar(true)
		return
	coletando.t += dt
	# dois golpes por batida. A animação é o golpe de espada de cima para baixo, mas tocada por partes e controlada
	# aqui: ergue a ferramenta, desce rápido até a face da pedra (ou do tronco), fica cravada um instante e volta.
	# Assim ela nunca segue o movimento da espada para trás do corpo.
	var meio: float = coletando.dur / 2.0
	var n := int(coletando.t / meio)
	if n != coletando.n and n < 2:
		coletando.n = n
		if not coletando.get("duas", false) and m.heroi_anim.has_animation("descendente") and m.heroi_anim.current_animation != "descendente":
			m.heroi_anim.play("descendente", 0.12, 0.0)
		coletando["bateu"] = false
	var f: float = clamp(fmod(coletando.t, meio) / meio, 0.0, 1.0) if n < 2 else 1.0
	if coletando.get("duas", false):
		_passo_duas(o, f)
	elif m.heroi_anim.current_animation == "descendente":
		m.heroi_anim.seek(_tempo_golpe(f), true)
	if not coletando.get("bateu", true) and f >= GOLPE_BATE:
		coletando.bateu = true
		_impacto(o)

# tempos dentro da animação "descendente" (s): pronto, ferramenta erguida atrás da cabeça, ponta na face da pedra
const GOLPE_PRONTO := 0.40
const GOLPE_ALTO := 0.58
const GOLPE_PEDRA := 0.667
const GOLPE_BATE := 0.55 # fração da batida em que a ponta encosta

func _tempo_golpe(f: float) -> float:
	if f < 0.45: # ergue devagar
		return lerp(GOLPE_PRONTO, GOLPE_ALTO, smoothstep(0.0, 1.0, f / 0.45))
	if f < GOLPE_BATE: # desce rápido
		var k: float = (f - 0.45) / (GOLPE_BATE - 0.45)
		return lerp(GOLPE_ALTO, GOLPE_PEDRA, k * k)
	if f < 0.75: # cravada na pedra
		return GOLPE_PEDRA
	return lerp(GOLPE_PEDRA, GOLPE_PRONTO, smoothstep(0.0, 1.0, (f - 0.75) / 0.25)) # puxa de volta

func _impacto(o: Dictionary) -> void:
	var d: Vector3 = (o.pos - m.heroi.position)
	d.y = 0
	var p: Vector3 = m.heroi.position + d.normalized() * max(0.3, d.length() - o.r * 0.8) + Vector3(0, 0.4 if o.tipo != "arvore" else 0.9, 0)
	var fx = m.fx
	if o.tipo == "arvore":
		m.sons.tocar("lenha", -4.0, 0.08, p)
		fx.poeira(p.x, p.z, 0.35, 6, "d8b27a", "8a6a44")
	else:
		m.sons.tocar("minerar", -3.0, 0.08, p)
		var c: Color = COR_MINERIO.get(o.tipo, Color.GRAY)
		fx.surto(p.x, p.y, p.z, 12, "ffe0a0", c.to_html(false), 4.0, 0.06)
		fx.poeira(p.x, p.z, 0.4, 5, "8a8070", "b0a898")
	m.cam.tremer(0.06)

# veio esgotado: a pedra se desfaz (estouro de lascas e poeira) e fica só o cascalho; quando volta, cresce do chão
func _mostrar_veio(o: Dictionary, mostrar: bool) -> void:
	o.entulho.visible = not mostrar
	if o.has("anima"):
		o.anima.kill()
	if mostrar:
		o.corpo.visible = true
		o.corpo.scale = Vector3.ONE * 0.05
		o.anima = create_tween()
		o.anima.tween_property(o.corpo, "scale", Vector3.ONE, 0.6).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		return
	var p: Vector3 = o.pos + Vector3(0, 0.45, 0)
	var c: Color = COR_MINERIO.get(o.tipo, Color.GRAY)
	m.fx.surto(p.x, p.y, p.z, 26, c.lightened(0.3).to_html(false), c.to_html(false), 5.0, 0.09)
	m.fx.poeira(p.x, p.z, 0.9, 12, "8a8070", "b0a898")
	m.sons.tocar("minerar", -1.0, 0.15, p)
	o.anima = create_tween()
	o.anima.tween_property(o.corpo, "scale", Vector3(1.15, 0.05, 1.15), 0.22).set_trans(Tween.TRANS_QUAD).set_ease(Tween.EASE_IN)
	o.anima.tween_callback(func(): o.corpo.visible = false)

var _mat_cas: StandardMaterial3D
func _mat_cascalho() -> StandardMaterial3D:
	if _mat_cas == null:
		_mat_cas = StandardMaterial3D.new()
		_mat_cas.albedo_color = Color(0.36, 0.34, 0.31)
		_mat_cas.roughness = 0.95
		_mat_cas.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	return _mat_cas

# o servidor mandou o que saiu da batida
func coletou(ev: Dictionary) -> void:
	var o = por_id.get(str(ev.no))
	if o == null:
		return
	o.cargas = int(ev.get("cargas", 0))
	o.volta_ate = m.tempo + float(ev.get("volta", 60))
	if o.cargas == 0 and o.has("corpo"):
		_mostrar_veio(o, false)
	var itens: Array = ev.get("itens", [])
	for i in itens.size():
		var it: Dictionary = itens[i]
		# em cima da cabeça, um pouco para o lado (o aviso de nível fica no meio da tela)
		var lado := Vector3(cos(m.cam.yaw), 0, -sin(m.cam.yaw)) * 0.55
		m.fx.texto(m.heroi.position + lado + Vector3(0, 0.3 * i, 0), "+%d %s" % [int(it.n), str(it.nome)], Color("e8d6a8"), 0.1 * i, 0.5, 1.95, 0.55, 26.0) # letra pequena: é informação rápida, não título

# veio de zona de mineração (o minério é de todos): alguém bateu nele (evento "veio" do servidor)
func veio_comum(id: String, cargas: int, volta: float) -> void:
	var o = por_id.get(id)
	if o == null:
		return
	o.cargas = cargas
	o.volta_ate = m.tempo + volta
	if cargas == 0 and o.has("corpo") and o.corpo.visible:
		_mostrar_veio(o, false)
		if coletando != null and coletando.c == o:
			parar(false)

# a foto do servidor diz quais veios comuns já foram batidos ([id, cargas, s para voltar]): quem entra depois vê igual
func veios_comuns(lista: Array) -> void:
	for v in lista:
		var o = por_id.get(str(v[0]))
		if o != null and (int(v[1]) != o.cargas or abs(o.volta_ate - (m.tempo + float(v[2]))) > 2.0):
			veio_comum(str(v[0]), int(v[1]), float(v[2]))

# parou (o servidor mandou "coletaFim", ou o joystick aqui): ferramenta volta para a bolsa, arma volta para a mão
func parar(avisar_servidor := false) -> void:
	if coletando == null:
		return
	coletando = null
	if avisar_servidor:
		m.rede("coletar", {"no": "", "parar": true})
	if m.acao.get("nome", "") == "coleta":
		m.acao = {}
	if duas != null and is_instance_valid(duas):
		duas.peso = 0.0
	for k in ferramentas:
		ferramentas[k].visible = false
		if ferramentas[k].get_parent() != m:
			ferramentas[k].get_parent().remove_child(ferramentas[k])
			m.add_child(ferramentas[k])
	m.armar(m.h.modo)
	m.espada.visible = true
	m.cajado.visible = true

func _segurar_ferramenta(prof: String) -> void:
	var f: Node3D = ferramentas.get(prof)
	if f == null:
		return
	var L: Dictionary = m.lugar_armas()
	m.armar("Escalada") # as duas armas nas costas
	m.prender(m.heroi_esq, f, L.espadaMao)
	f.visible = true
	# com as duas mãos: a ferramenta sai da mão e o código leva o cabo pelo golpe; as mãos seguem o cabo
	if _preparar_duas() and coletando != null:
		f.get_parent().remove_child(f)
		m.add_child(f)
		coletando["duas"] = true
		m.heroi_anim.play("parada", 0.2)

func _preparar_duas() -> bool:
	if m.heroi_esq == null:
		return false
	if duas == null or not is_instance_valid(duas) or duas.get_parent() != m.heroi_esq:
		if duas != null and is_instance_valid(duas):
			duas.queue_free()
		duas = DuasMaos.new()
		m.heroi_esq.add_child(duas) # por último: depois da animação, do braço da espada e da inclinação
		duas.preparar(m.heroi_esq)
	return duas.pronto()

# ---------- golpe com as duas mãos ----------
# poses do cabo no espaço do herói (x direita, y cima, z frente): ângulo do cabo (graus, 0 = para a frente,
# 90 = para cima) e onde fica o pé do cabo (a mão de baixo)
# O corpo vai junto (duas_maos.gd): "ag" = m que o quadril desce, "av" = m que o peso vai para a frente (+) ou para
# trás (-), "tor" = graus que o peito gira para a direita, "cur" = curva do tronco (1 = curvado no golpe, negativo
# = arqueado para trás)
const DUAS_PRONTO := {"ang": 55.0, "pe": Vector3(0.0, 1.0, 0.28), "ag": 0.05, "av": 0.0, "tor": 5.0, "cur": 0.25}
const DUAS_ALTO := {"ang": 155.0, "pe": Vector3(0.0, 1.42, 0.02), "ag": 0.035, "av": -0.05, "tor": 10.0, "cur": -0.4}
const DUAS_PEDRA := {"ang": -45.0, "pe": Vector3(0.0, 1.05, 0.3), "ag": 0.12, "av": 0.06, "tor": -4.0, "cur": 1.0} # picareta: de cima para baixo na face da pedra
const DUAS_TRONCO := {"ang": -6.0, "pe": Vector3(0.0, 1.12, 0.3)} # machado: quase reto no tronco, na altura do peito
const DUAS_MAO_BAIXO := 0.04 # m do pé do cabo até a mão esquerda
const DUAS_MAO_CIMA := 0.2 # até a mão direita
const DUAS_GIRO := PI / 2.0 # giro da ferramenta em volta do cabo (rad): a ponta da picareta e o fio do machado para a frente

# machado (pedido do André): golpe de lado, na horizontal, vindo de trás do ombro direito até o tronco, com o fio
# virado para onde o machado vai. "giro" = para que lado o cabo aponta em volta do herói (graus, 0 = frente,
# 90 = direita); "ang" = quanto o cabo sobe (graus)
const LADO_PRONTO := {"ang": 25.0, "giro": 70.0, "pe": Vector3(0.12, 1.05, 0.25), "ag": 0.05, "av": 0.0, "tor": 12.0, "cur": 0.12}
const LADO_ALTO := {"ang": 20.0, "giro": 150.0, "pe": Vector3(0.3, 1.2, -0.02), "ag": 0.045, "av": -0.05, "tor": 42.0, "cur": -0.1}
const LADO_TRONCO := {"ang": -4.0, "giro": 8.0, "pe": Vector3(0.04, 1.05, 0.32), "ag": 0.09, "av": 0.05, "tor": -16.0, "cur": 0.45}

func _pose_golpe(o: Dictionary) -> Dictionary:
	return LADO_TRONCO if o.tipo == "arvore" else DUAS_PEDRA

# alcance da cabeça da ferramenta na pose do golpe: quanto ela vai à frente do herói e em que altura
func _cabeca_golpe(o: Dictionary) -> Vector2:
	var f: Node3D = ferramentas.get("len" if o.tipo == "arvore" else "min")
	var P: Dictionary = _pose_golpe(o)
	var comp: float = float(f.get_meta("topo", 0.8)) - float(f.get_meta("base", 0.0)) - 0.07 if f else 0.7
	var a: float = deg_to_rad(float(P.ang))
	var g: float = deg_to_rad(float(P.get("giro", 0.0)))
	return Vector2(P.pe.z + cos(a) * cos(g) * comp, P.pe.y + sin(a) * comp)

func _passo_duas(o: Dictionary, f: float) -> void:
	var fe: Node3D = ferramentas.get(coletando.prof)
	if fe == null:
		return
	var lado: bool = o.tipo == "arvore"
	var PRONTO: Dictionary = LADO_PRONTO if lado else DUAS_PRONTO
	var ALTO: Dictionary = LADO_ALTO if lado else DUAS_ALTO
	var A: Dictionary = PRONTO
	var B: Dictionary = ALTO
	var k := 0.0
	var curva := 0.0
	var G: Dictionary = _pose_golpe(o)
	if f < 0.45: # ergue devagar
		k = smoothstep(0.0, 1.0, f / 0.45)
		curva = lerp(0.25, 0.0, k)
	elif f < GOLPE_BATE: # desce rápido
		A = ALTO
		B = G
		k = (f - 0.45) / (GOLPE_BATE - 0.45)
		k = k * k
		curva = k
	elif f < 0.75: # cravada
		A = G
		B = G
		curva = 1.0
	else: # puxa de volta
		A = G
		B = PRONTO
		k = smoothstep(0.0, 1.0, (f - 0.75) / 0.25)
		curva = lerp(1.0, 0.25, k)
	var ang: float = deg_to_rad(lerp(float(A.ang), float(B.ang), k))
	var pe: Vector3 = (A.pe as Vector3).lerp(B.pe, k)
	var h: Node3D = m.heroi
	var frente: Vector3 = Vector3(sin(h.rotation.y), 0, cos(h.rotation.y))
	var cima := Vector3.UP
	var dir: Vector3 = frente.cross(cima)
	var giro: float = deg_to_rad(lerp(float(A.get("giro", 0.0)), float(B.get("giro", 0.0)), k))
	var plano: Vector3 = frente * cos(giro) + dir * sin(giro)
	var cabo: Vector3 = (plano * cos(ang) + cima * sin(ang)).normalized()
	var P0: Vector3 = h.global_position + dir * pe.x + cima * pe.y + frente * pe.z
	# a ferramenta gira em volta do cabo para a ponta (ou o fio) ir na frente do golpe: no golpe de cima o plano
	# do giro é o vertical (normal = direita); no de lado é o horizontal (normal = cima)
	var normal: Vector3 = cima if lado else dir
	var bz: Vector3 = normal.cross(cabo).normalized()
	var b := Basis(cabo.cross(bz), cabo, bz).orthonormalized() * Basis(Vector3.UP, DUAS_GIRO)
	fe.global_transform = Transform3D(b, P0 - cabo * float(fe.get_meta("base", 0.0)))
	duas.mao_e = P0 + cabo * DUAS_MAO_BAIXO
	duas.mao_d = P0 + cabo * DUAS_MAO_CIMA
	duas.cabo = cabo
	duas.curva = lerp(float(A.get("cur", curva)), float(B.get("cur", curva)), k)
	duas.agacha = lerp(float(A.get("ag", 0.0)), float(B.get("ag", 0.0)), k)
	duas.avanco = lerp(float(A.get("av", 0.0)), float(B.get("av", 0.0)), k)
	duas.torcao = deg_to_rad(lerp(float(A.get("tor", 0.0)), float(B.get("tor", 0.0)), k))
	duas.peso = move_toward(duas.peso, 1.0, get_process_delta_time() * 8.0)

# criou uma peça na oficina: faíscas na bigorna (ou linha na banca da Rosa) e o som
func criou(ev: Dictionary) -> void:
	var x := float(ev.get("x", m.heroi.position.x))
	var z := float(ev.get("z", m.heroi.position.z))
	var p := Vector3(x, m.terreno.altura(x, z) + 1.0, z)
	if str(ev.get("prof", "")) == "fer":
		m.sons.tocar("forja", -2.0, 0.06, p)
		m.fx.surto(p.x, p.y, p.z, 16, "fff0b0", "ff8a3a", 5.0, 0.06)
	else:
		m.sons.tocar("pano", -3.0)
		m.fx.surto(p.x, p.y, p.z, 10, "f4e6c8", "c9a6e8", 2.5, 0.08)
	var r := int(ev.get("r", -1))
	var cor: Color = Color(m.P.dados.raridades[r].cor) if r >= 0 else Color("e8d6a8")
	m.fx.texto(m.heroi.position + Vector3(0, 0.45, 0), str(ev.get("nome", "")), cor)

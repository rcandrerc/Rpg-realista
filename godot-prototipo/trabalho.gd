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
var soltos: Array = [] # pedras e galhos soltos no chão (André 2026-11-07): pega com a mão, com um brilho que se vê de perto
const SOLTO_VE := 11.0 # m: o brilho em cima aparece só de perto
var caidas: Array = [] # árvores derrubadas (de todos, André 2026-11-04): o _process só olha estas para saber quando voltam
const QuedaArvore = preload("res://queda_arvore.gd")
const Malhas = preload("res://malhas.gd")
var queda # queda_arvore.gd: a árvore tomba, some e cresce de novo
var grade := {} # Vector2i(casa de 6 m) -> [coletáveis]
var coletando = null # {c, dur, t, n (golpes dados), prof}
var ferramentas := {} # "min" -> picareta, "len" -> machado
var perto = null # coletável mais perto (para o botão)
var indo = null # {o, ate}: tocou em Coletar longe e o herói está andando até encostar
const DuasMaos = preload("res://duas_maos.gd")
var duas # duas_maos.gd: as duas mãos no cabo da picareta e do machado
const MaoFechadaT = preload("res://mao_fechada.gd")
var dedos := [] # mao_fechada.gd (só os dedos), direita e esquerda: os dedos fecham em volta do cabo

# cores de cada veio (minerio.gdshader): o bloco inteiro é o minério bruto, facetado, como a referência do André
const BLOCO_VEIO := {
	"pedra": {"escura": Color("4a463f"), "clara": Color("b3ab9c"), "metal": 0.05}, # pedra comum, cinza-areia, fosca
	"cobre": {"escura": Color("8a3416"), "clara": Color("ffbf86"), "metal": 0.75},
	"ferro": {"escura": Color("23262c"), "clara": Color("b4bfcc"), "metal": 0.7},
	"cristal": {"escura": Color("17122a"), "clara": Color("3f3266"), "metal": 0.15},
}
const COR_MINERIO := {"pedra": Color(0.55, 0.52, 0.47), "ferro": Color(0.34, 0.38, 0.45), "cobre": Color(0.72, 0.36, 0.16), "cristal": Color(0.55, 0.45, 1.0)}

func _init(principal) -> void:
	m = principal
	E = m.P.dados.estamina

func _ready() -> void:
	sta = sta_max()
	for c in m.mundo.get("coletaveis", []):
		var o := {"id": str(c.id), "tipo": str(c.tipo), "pos": Vector3(float(c.x), 0, float(c.z)), "r": float(c.r), "cargas": -1, "volta_ate": -1.0}
		o.pos.y = float(c.y) if c.has("y") else m.terreno.altura(o.pos.x, o.pos.z) # veio de caverna: o chão dela
		if c.get("solto", false):
			o.solto = true
			_montar_solto(o, float(c.get("ry", 0.0)))
			soltos.append(o)
		elif o.tipo != "arvore":
			# André 2026-11-16 ("o jogo tá demorando muito para abrir"): montar as pedras dos 263 veios levava 11 a 17 s
			# no celular com a tela parada (registros da entrada, parte "trabalho"; 1,5 s no PC). Agora cada veio entra
			# na fila de montagem (main.gd criar_aos_poucos), o mais perto do herói primeiro, atrás da capa e da janela
			# "Entrar como…"; a capa só sai quando a fila acaba. Até montar, o veio já existe para o servidor e a colisão.
			o.k = float(o.r) / 0.8
			o.ry_veio = float(c.get("ry", 0.0))
			_veios_fila.append(o)
			veios.append(o)
		coletaveis.append(o)
		por_id[o.id] = o
		var k := Vector2i(floori(o.pos.x / 6.0), floori(o.pos.z / 6.0))
		if not grade.has(k):
			grade[k] = []
		grade[k].append(o)
	_chave_veios = _chave()
	if FileAccess.file_exists(VEIOS_PRONTOS):
		_carga_tarefa = WorkerThreadPool.add_task(_ler_prontos) # lê enquanto o resto da abertura monta
	else:
		_guardando = true
	for i in _veios_fila.size():
		m._a_criar.append(_montar_proximo_veio)
	queda = QuedaArvore.new(m)
	add_child(queda)
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
var _veios_fila: Array = [] # veios ainda sem pedra (montam um por vez na fila do main.gd)

# monta a pedra do veio mais perto do herói; se o servidor já disse que ele está esgotado, nasce só o cascalho
func _montar_proximo_veio() -> void:
	if _veios_fila.is_empty():
		return
	var h: Vector3 = m.heroi.position if m.heroi else Vector3.ZERO
	var melhor := 0
	var dmin := INF
	for i in _veios_fila.size():
		var p: Vector3 = _veios_fila[i].pos
		var d := Vector2(p.x - h.x, p.z - h.z).length_squared()
		if d < dmin:
			dmin = d
			melhor = i
	var o: Dictionary = _veios_fila[melhor]
	_veios_fila.remove_at(melhor)
	_abrir_prontos()
	var d = _prontos.get(o.id)
	if d is Array and d.size() == 5:
		_montar_veio_pronto(o, d)
	else:
		_montar_veio(o, float(o.ry_veio))
	if _veios_fila.is_empty():
		_prontos = {}
		if _guardando and _novos.size() == veios.size():
			WorkerThreadPool.add_task(_salvar_prontos.bind({"chave": _chave_veios, "veios": _novos}))
		_guardando = false
		_novos = {}
	if esgotado(o):
		o.corpo.visible = false
		o.entulho.visible = true
		m.mov.vazios[o.id] = true

# um material por veio: "cheio" a 0 deixa só este veio cinza quando esgota. A semente é o primeiro número da
# sorte do veio (rnd com a semente do id), igual na montagem e nos veios prontos
func _mat_veio(o: Dictionary, rnd: RandomNumberGenerator) -> ShaderMaterial:
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
	return pm

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
	# tamanho da pedra (shared/dados.js TAMANHO_VEIO): o raio sólido do veio já vem multiplicado (0,8 m = cobre)
	var k: float = float(o.r) / 0.8
	o.k = k
	var pm := _mat_veio(o, rnd)
	o.pedra_mat = pm
	# o veio inteiro (blocos e cristais) fica neste nó: some quando esgota e volta crescendo
	var corpo := Node3D.new()
	raiz.add_child(corpo)
	o.corpo = corpo
	# bloco principal grande e uns pedaços menores em volta, tudo dentro do raio de colisão (0,8 m)
	var principal := _bloco(rnd, (0.62 if not cristal else 0.6) * k, (0.72 if not cristal else 0.42) * k)
	var blocos := [[principal, Vector3.ZERO, 0.0]]
	var n := rnd.randi_range(3, 4)
	var a0 := rnd.randf() * TAU
	for i in n:
		var a: float = a0 + TAU * i / n + rnd.randf_range(-0.4, 0.4)
		var r: float = rnd.randf_range(0.2, 0.34)
		blocos.append([_bloco(rnd, r * k, r * k * rnd.randf_range(0.8, 1.2)), Vector3(cos(a), 0, sin(a)) * rnd.randf_range(0.5, 0.72) * k, rnd.randf() * TAU])
	for bl in blocos:
		var mi := MeshInstance3D.new()
		mi.mesh = bl[0]
		mi.material_override = pm
		mi.position = bl[1]
		mi.rotation.y = bl[2]
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		corpo.add_child(mi)
	var alto_pedra: float = principal.get_aabb().end.y
	o.malha_tri = principal # a face da pedra onde a picareta bate: o TriangleMesh sai só na primeira batida (_face_veio), não na abertura
	_sombra_veio(raiz, k)
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
		cas.mesh = _bloco(rnd, r * k, r * k * 0.5)
		cas.material_override = _mat_cascalho()
		var a: float = rnd.randf() * TAU
		cas.position = Vector3(cos(a), 0, sin(a)) * rnd.randf_range(0.05, 0.55) * k
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
			var hit: Dictionary = {} if tri == null else tri.intersect_ray(base + Vector3(0, 3, 0), Vector3.DOWN)
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
		_luz_veio(minerio, cor, alto_pedra)
	# FPS (André 2026-11-13, "juntar tudo como se fosse um desenho só"; os registros do celular mostraram 1.100 chamadas de
	# desenho perto das minas): cada pedaço do veio era uma malha solta (4 a 5 blocos com contorno e sombra, 10 a 14
	# cristais com sombra, 7 pedrinhas do cascalho). Agora cada grupo vira uma malha só, com o mesmo desenho: os blocos
	# numa, os cristais noutra e o cascalho noutra, e cada grupo continua sumindo e voltando sozinho (corpo, minerio e
	# entulho são os mesmos nós). O que está escondido não entra na junta, então cada grupo é juntado com o outro à parte.
	Malhas.Junta.guardar_listas = _guardando
	_juntar_veio(o)
	Malhas.Junta.guardar_listas = false
	if _guardando:
		_guardar_um(o, principal, alto_pedra)
	_alcance_veio(raiz)

# sombra de contato: mancha escura e suave no chão em volta da base
func _sombra_veio(raiz: Node3D, k: float) -> void:
	var sombra := MeshInstance3D.new()
	var pl := PlaneMesh.new()
	pl.size = Vector2(2.4, 2.4) * k
	sombra.mesh = pl
	sombra.material_override = _mat_sombra()
	sombra.position.y = 0.03
	sombra.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	raiz.add_child(sombra)

func _luz_veio(minerio: Node3D, cor: Color, alto_pedra: float) -> void:
	var luz := OmniLight3D.new()
	luz.light_color = cor
	luz.light_energy = 1.3
	luz.omni_range = 4.0
	luz.position = Vector3(0, alto_pedra + 0.5, 0)
	luz.distance_fade_enabled = true # FPS (André 2026-11-07): a luz do cristal só acende de perto
	luz.distance_fade_begin = 25.0
	luz.distance_fade_length = 6.0
	minerio.add_child(luz)

# FPS (André 2026-11-07, "prefiro perder um pouquinho de qualidade do que ter jogo travando"): o veio (blocos,
# contorno, cristais e o cascalho) só é desenhado até 80 m, com fade curtinho, como as pedras grandes do cenário
func _alcance_veio(raiz: Node3D) -> void:
	for gi: GeometryInstance3D in raiz.find_children("*", "GeometryInstance3D", true, false):
		gi.visibility_range_end = 80.0
		gi.visibility_range_end_margin = 6.0
		gi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF

# ---------- veios prontos no aparelho ----------
# André 2026-11-16 ("por que os minérios demoram tanto pra carregar e as árvores não?"): a árvore é um modelo pronto,
# carregado uma vez e copiado; o veio era esculpido pedra por pedra a cada abertura (~3.000 pedras, 11 a 17 s no
# celular). Agora, na primeira abertura, cada veio montado guarda o resultado final (as malhas juntadas, já com os
# números de cada vértice) em user://veios_prontos.bin; nas próximas, o celular só lê o arquivo (numa linha de fundo)
# e põe as malhas prontas. O desenho é exatamente o mesmo (mesmos números, mesmos materiais). A chave muda quando
# muda o mundo (veios, posições), o motor ou os arquivos que desenham o veio: aí monta de novo e guarda outra vez.
const VEIOS_PRONTOS := "user://veios_prontos.bin"
const VEIOS_FORMATO := 1 # suba se o desenho do veio mudar por um arquivo que não entra na chave (shaders entram pelo caminho)
var _guardando := false # montando do zero: guarda cada veio para a próxima abertura
var _prontos := {} # id -> [corpo, minerio, entulho, listas do bloco principal, altura da pedra] lidos do aparelho
var _novos := {} # o mesmo, dos veios montados agora (salvo quando o último monta)
var _chave_veios := ""
var _carga_tarefa := -1
var _carga = null

func _chave() -> String:
	var partes := [VEIOS_FORMATO, Engine.get_version_info().string]
	for f in ["res://trabalho.gd", "res://malhas.gd", "res://construcao.gd"]:
		var g: String = f if FileAccess.file_exists(f) else f.replace(".gd", ".gdc") # no APK o script vai compilado
		partes.append(FileAccess.get_md5(g) if FileAccess.file_exists(g) else "")
	for o in veios:
		partes.append([o.id, o.tipo, o.r, o.ry_veio, o.pos])
	return str(partes).md5_text()

func _ler_prontos() -> void: # linha de fundo: só lê números do arquivo
	var f := FileAccess.open_compressed(VEIOS_PRONTOS, FileAccess.READ, FileAccess.COMPRESSION_ZSTD)
	if f != null:
		_carga = f.get_var()

func _salvar_prontos(dados: Dictionary) -> void: # linha de fundo: grava num temporário e troca (nunca fica pela metade)
	var tmp := VEIOS_PRONTOS + ".tmp"
	var f := FileAccess.open_compressed(tmp, FileAccess.WRITE, FileAccess.COMPRESSION_ZSTD)
	if f == null:
		return
	f.store_var(dados)
	f.close()
	DirAccess.rename_absolute(tmp, VEIOS_PRONTOS)

# primeiro veio da fila: espera a leitura (começou no _ready) e confere se o arquivo vale para este mundo
func _abrir_prontos() -> void:
	if _carga_tarefa < 0:
		return
	WorkerThreadPool.wait_for_task_completion(_carga_tarefa)
	_carga_tarefa = -1
	var d = _carga
	_carga = null
	if d is Dictionary and str(d.get("chave", "")) == _chave_veios and d.get("veios") is Dictionary:
		var v: Dictionary = d.veios
		var todos := v.size() == veios.size()
		for o in veios:
			todos = todos and v.has(o.id)
		if todos:
			_prontos = v
	_guardando = _prontos.is_empty()
	if Engine.has_meta("lentidao"):
		print("[entrada] veios prontos: ", "do aparelho" if not _guardando else "montando e guardando")

# as malhas juntadas ("junto_N") que ficaram direto em no, com as listas de cada superfície; null = algo fora do
# esperado (aí não guarda nada e a próxima abertura monta de novo, como antes)
func _juntos(no: Node3D, o: Dictionary):
	var r := []
	for c in no.get_children():
		if not (c is MeshInstance3D):
			continue
		var mi := c as MeshInstance3D
		if mi.mesh == null:
			continue
		if not str(mi.name).begins_with("junto_") or not (mi.mesh is ArrayMesh):
			return null
		var am := mi.mesh as ArrayMesh
		var listas: Array = am.get_meta("listas", [])
		if listas.size() != am.get_surface_count():
			return null
		var sups := []
		for i in listas.size():
			var mat := am.surface_get_material(i)
			var tag := "pm" if mat == o.pedra_mat else ("cas" if mat == _mat_cas and _mat_cas != null else ("cris" if mat == _mat_cr and _mat_cr != null else ""))
			if tag == "" or mi.material_override != null:
				return null
			sups.append([listas[i], tag])
		r.append([str(mi.name), int(mi.cast_shadow), sups])
	return r

func _guardar_um(o: Dictionary, principal: ArrayMesh, alto_pedra: float) -> void:
	var c = _juntos(o.corpo, o)
	var mn = _juntos(o.minerio, o)
	var e = _juntos(o.entulho, o)
	var pl: Array = principal.get_meta("listas", [])
	if c == null or mn == null or e == null or pl.size() != 1:
		_guardando = false
		_novos = {}
		return
	_novos[o.id] = [c, mn, e, pl[0], alto_pedra]

func _por_juntos(no: Node3D, lista: Array, pm: Material) -> void:
	for j in lista:
		var am := ArrayMesh.new()
		for sf in j[2]:
			am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, sf[0])
			am.surface_set_material(am.get_surface_count() - 1, pm if sf[1] == "pm" else (_mat_cascalho() if sf[1] == "cas" else _mat_cristal()))
		var junto := MeshInstance3D.new()
		junto.name = str(j[0])
		junto.mesh = am
		junto.cast_shadow = int(j[1])
		no.add_child(junto)

# o mesmo veio do _montar_veio, com as malhas lidas do aparelho (mesma ordem de nós, materiais e alcance)
func _montar_veio_pronto(o: Dictionary, d: Array) -> void:
	var raiz := Node3D.new()
	raiz.position = o.pos
	raiz.rotation.y = float(o.ry_veio)
	add_child(raiz)
	o.no = raiz
	var rnd := RandomNumberGenerator.new()
	rnd.seed = hash(o.id)
	var k: float = float(o.r) / 0.8
	o.k = k
	var pm := _mat_veio(o, rnd)
	o.pedra_mat = pm
	var corpo := Node3D.new()
	raiz.add_child(corpo)
	o.corpo = corpo
	var principal := ArrayMesh.new()
	principal.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, d[3])
	o.malha_tri = principal
	_sombra_veio(raiz, k)
	var minerio := Node3D.new()
	corpo.add_child(minerio)
	o.minerio = minerio
	var entulho := Node3D.new()
	entulho.visible = false
	raiz.add_child(entulho)
	o.entulho = entulho
	if o.tipo == "cristal":
		_luz_veio(minerio, COR_MINERIO.get(o.tipo, Color.GRAY), float(d[4]))
	_por_juntos(minerio, d[1], pm)
	_por_juntos(corpo, d[0], pm)
	_por_juntos(entulho, d[2], pm)
	_alcance_veio(raiz)

const Construcao = preload("res://construcao.gd")
func _juntar_veio(o: Dictionary) -> void:
	var minerio: Node3D = o.minerio
	var entulho: Node3D = o.entulho
	Construcao.juntar_malhas(minerio) # os cristais (a luz fica solta)
	minerio.visible = false # escondido: fora da junta dos blocos
	Construcao.juntar_malhas(o.corpo)
	minerio.visible = true
	entulho.visible = true
	Construcao.juntar_malhas(entulho)
	entulho.visible = false

# bloco facetado: esfera de poucas faces com os vértices puxados para dentro e para fora (pedra lascada), base chata
# enterrada uns 12 cm, normais chapadas e um tom por face (canal r da cor) para as facetas brilharem diferente
static var _esfera: Array = []
func _bloco(rnd: RandomNumberGenerator, raio: float, alto: float) -> ArrayMesh:
	if _esfera.is_empty(): # a esfera base é sempre a mesma: calcula uma vez só (antes, uma vez por bloco, ~3.000 vezes)
		var esf := SphereMesh.new()
		esf.radius = 1.0
		esf.height = 2.0
		esf.radial_segments = 7
		esf.rings = 4
		_esfera = esf.get_mesh_arrays()
	var arr := _esfera
	if arr.size() <= Mesh.ARRAY_INDEX or arr[Mesh.ARRAY_VERTEX] == null: # sem placa de vídeo (teste sem tela no Godot 4.7)
		push_warning("pedra sem malha (get_mesh_arrays vazio)")
		return ArrayMesh.new()
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
	var listas := st.commit_to_arrays() # o mesmo que st.commit(), mas as listas ficam (veios prontos no aparelho)
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, listas)
	am.set_meta("listas", [listas])
	return am

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

# pedra ou galho solto: um montinho pequeno (2 ou 3 pedrinhas / pedaços de lenha, dos modelos do cenário em escala
# pequena) e, em cima, o ícone do que ele dá num brilho dourado que sobe e desce, só de perto (SOLTO_VE)
func _montar_solto(o: Dictionary, ry: float) -> void:
	o.pos.y = m.terreno.relevo(o.pos.x, o.pos.z) # no chão de verdade (sem o tampo das pedras grandes)
	var raiz := Node3D.new()
	raiz.position = o.pos
	raiz.rotation.y = ry
	add_child(raiz)
	o.no = raiz
	var rnd := RandomNumberGenerator.new()
	rnd.seed = hash(o.id)
	var galho: bool = o.tipo == "galho"
	var n := rnd.randi_range(2, 3)
	for i in n:
		var nome: String = "tronco_caido" if galho else ["rocha1", "rocha2", "rocha3"][rnd.randi() % 3]
		var cena: PackedScene = load("res://cenario3d/%s.glb" % nome)
		if cena == null:
			continue
		var p: Node3D = cena.instantiate()
		raiz.add_child(p)
		m.pintar(p, false)
		if galho: # tronco de 4 m vira lenha de 0,7 a 0,9 m, uma cruzada por cima da outra
			p.scale = Vector3.ONE * rnd.randf_range(0.17, 0.22)
			p.rotation = Vector3(0, i * 1.1 + rnd.randf_range(-0.3, 0.3), 0)
			p.position = Vector3(rnd.randf_range(-0.1, 0.1), 0.03 + 0.08 * i, rnd.randf_range(-0.1, 0.1))
		else: # pedra de 3 m vira pedrinha de 0,3 a 0,45 m, meio enterrada
			p.scale = Vector3.ONE * (rnd.randf_range(0.11, 0.14) if i == 0 else rnd.randf_range(0.06, 0.09))
			p.rotation.y = rnd.randf() * TAU
			var a := TAU * i / n + rnd.randf_range(-0.5, 0.5)
			p.position = Vector3(cos(a), 0, sin(a)) * (0.0 if i == 0 else rnd.randf_range(0.25, 0.32)) + Vector3(0, -0.02, 0)
		for mi in p.find_children("*", "MeshInstance3D", true, false):
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF # miúdo: sem sombra (barato no celular)
			mi.visibility_range_end = 40.0 # longe não se desenha (como o mato miúdo do cenario.gd)
	# o símbolo: brilho dourado e o ícone do item (lenha ou pedra) por cima, sempre virado para a câmera
	var marca := Node3D.new()
	marca.position = Vector3(0, 0.85, 0)
	raiz.add_child(marca)
	var brilho := Sprite3D.new()
	brilho.texture = _textura_brilho()
	brilho.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	brilho.shaded = false
	brilho.no_depth_test = false
	brilho.pixel_size = 0.55 / 128.0
	brilho.modulate = Color(1.0, 0.85, 0.45, 0.85)
	marca.add_child(brilho)
	var ic := Sprite3D.new()
	ic.texture = load("res://icones/itens/%s.png" % ("lenha" if galho else "pedra"))
	ic.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	ic.shaded = false
	ic.render_priority = 1
	if ic.texture:
		ic.pixel_size = 0.3 / float(ic.texture.get_width())
	marca.add_child(ic)
	marca.visible = false
	o.marca = marca
	o.fase = rnd.randf() * TAU

static var _brilho: Texture2D
static func _textura_brilho() -> Texture2D:
	if _brilho == null:
		var g := Gradient.new()
		g.set_color(0, Color(1, 1, 1, 1))
		g.set_color(1, Color(1, 1, 1, 0))
		g.add_point(0.35, Color(1, 1, 1, 0.45))
		var t := GradientTexture2D.new()
		t.gradient = g
		t.fill = GradientTexture2D.FILL_RADIAL
		t.fill_from = Vector2(0.5, 0.5)
		t.fill_to = Vector2(1.0, 0.5)
		t.width = 128
		t.height = 128
		_brilho = t
	return _brilho

# todo quadro, só nos ~40 soltos: o que voltou aparece de novo e o brilho só se vê de perto
func _passo_soltos() -> void:
	var h: Vector3 = m.heroi.position
	for o in soltos:
		var raiz: Node3D = o.no
		if not raiz.visible:
			if esgotado(o):
				continue
			o.cargas = -1
			raiz.visible = true
			raiz.scale = Vector3.ONE * 0.05
			create_tween().tween_property(raiz, "scale", Vector3.ONE, 0.5).set_trans(Tween.TRANS_BACK).set_ease(Tween.EASE_OUT)
		var d: float = Vector2(o.pos.x - h.x, o.pos.z - h.z).length()
		var mk: Node3D = o.marca
		mk.visible = d < SOLTO_VE
		if mk.visible:
			var a: float = clamp((SOLTO_VE - d) / 3.0, 0.0, 1.0) # some aos poucos na borda
			var t: float = m.tempo * 2.2 + float(o.fase)
			mk.position.y = 0.85 + sin(t) * 0.07
			var b: Sprite3D = mk.get_child(0)
			b.modulate.a = a * (0.55 + 0.3 * sin(t * 1.3))
			(mk.get_child(1) as Sprite3D).modulate.a = a

# a câmera para antes da pedra do veio inteira (o raio de colisão do jogador é 0,7 m)
func dentro_de_pedra(p: Vector3) -> bool:
	for o in veios:
		if m.mov.vazios.has(o.id):
			continue # esgotado: a pedra não está lá
		var k: float = o.get("k", 1.0)
		if p.y < o.pos.y + 1.4 * k and Vector2(p.x - o.pos.x, p.z - o.pos.z).length() < 1.0 * k:
			return true
	return false

func esgotado(o: Dictionary) -> bool:
	return o.cargas == 0 and o.volta_ate > m.tempo

# ---------- quadro a quadro ----------
var _t_veios := 0.0
func _process(dt: float) -> void:
	var t0_parte := Time.get_ticks_usec()
	_process_parte(dt)
	if Time.get_ticks_usec() - t0_parte >= 1000 and Engine.has_meta("lentidao"): # quadro lento (lentidao.gd)
		Engine.get_meta("lentidao").ev("trabalho", t0_parte)

func _process_parte(dt: float) -> void:
	if m.heroi == null:
		return
	_passo_soltos()
	# veio que voltou: o minério aparece de novo. FPS (varredura 2026-11-10): o mapa grande tem veio espalhado por
	# todo lado; conferir todos a cada 0,25 s basta (o minério volta no máximo 0,25 s depois)
	_t_veios -= dt
	if _t_veios <= 0.0:
		_t_veios = 0.25
		for o in veios:
			if o.has("corpo") and not o.corpo.visible and not esgotado(o):
				_mostrar_veio(o, true)
				o.cargas = -1
	# árvore que voltou: o toco some e ela cresce de novo
	for i in range(caidas.size() - 1, -1, -1):
		var ca: Dictionary = caidas[i]
		if not esgotado(ca):
			caidas.remove_at(i)
			ca.cargas = -1
			queda.levantar(ca)
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
	var ic := "pf_" + str(m.P.dados.coleta[perto.tipo].prof) if perto != null else "pf_len"
	if coletando != null:
		ic = "pf_" + coletando.prof
	m.hud.mostrar_botao("coletar", perto != null or coletando != null)
	m.hud.icone_botao("coletar", ic)

# árvore plantada (plantio.gd, André 2026-11-16): entra e sai da lista de coletáveis com o jogo rodando
func registrar(o: Dictionary) -> void:
	coletaveis.append(o)
	por_id[o.id] = o
	var k := Vector2i(floori(o.pos.x / 6.0), floori(o.pos.z / 6.0))
	if not grade.has(k):
		grade[k] = []
	grade[k].append(o)

func esquecer(o: Dictionary) -> void:
	coletaveis.erase(o)
	por_id.erase(o.id)
	caidas.erase(o)
	var k := Vector2i(floori(o.pos.x / 6.0), floori(o.pos.z / 6.0))
	if grade.has(k):
		grade[k].erase(o)
	if perto == o:
		perto = null
	if indo != null and indo.o == o:
		indo = null
	if coletando != null and coletando.c == o:
		parar(false)

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

# perto da oficina? André 2026-11-11: o Tomás e a Rosa não criam mais; a oficina agora é a estação pública ao lado
# deles (bigorna/forninho da ferraria, bancada da Rosa: construcao.gd publica_perto). O servidor confere a mesma distância.
func perto_oficina(prof: String) -> bool:
	if m.construcao == null:
		return false
	var tipos := ["bigorna", "fornalha"] if prof == "fer" else ["bancada"] if prof == "alf" else []
	return not tipos.is_empty() and not m.construcao.publica_perto(tipos).is_empty()

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
	if C.get("mao", false): # pedra ou galho solto: pega com a mão, na hora
		m.rede("coletar", {"no": perto.id})
		return
	# picareta para minerar e machado para cortar (André 2026-11-07); o servidor confere de novo
	var fer := str(C.get("ferramenta", ""))
	if fer != "" and m.P.contar(fer) < 1:
		m.hud.aviso("Precisa de %s (crie na mochila: Criar > Ferramentas, sem bancada)" % str(m.P.dados.itens[fer].nome).to_lower())
		return
	var da: Array = C.get("da", {}).keys()
	if not m.P.prof_ok(str(C.prof), int(C.get("nivel", 1)), str(da[0]) if da.size() > 0 else ""): # a missão que pede o minério libera o veio (hi.livre)
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
	if not o.has("tri") and o.get("malha_tri") is Mesh:
		o.tri = (o.malha_tri as Mesh).generate_triangle_mesh()
	if not o.has("tri") or o.tri == null or m.heroi == null:
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
	if not coletando.get("bateu", true) and f >= ((float(LADO_T.bate) if o.tipo == "arvore" else float(PEDRA_T.bate)) if coletando.get("duas", false) else GOLPE_BATE):
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
	# sem a pedra, o lugar fica livre para passar (andar.gd colidir); volta a bloquear quando o veio volta
	if mostrar:
		m.mov.vazios.erase(o.id)
	else:
		m.mov.vazios[o.id] = true
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
	if o.get("solto", false): # pegou a pedra ou o galho: some (volta em COLETA.galho.volta s, só para mim)
		o.no.visible = false
		m.sons.tocar("pano", -8.0)
	var itens: Array = ev.get("itens", [])
	for i in itens.size():
		var it: Dictionary = itens[i]
		# em cima da cabeça, um pouco para o lado (o aviso de nível fica no meio da tela)
		var lado := Vector3(cos(m.cam.yaw), 0, -sin(m.cam.yaw)) * 0.55
		m.fx.texto(m.heroi.position + lado + Vector3(0, 0.3 * i, 0), "+%d %s" % [int(it.n), str(it.nome)], Color("e8d6a8"), 0.1 * i, 0.5, 1.95, 0.55, 26.0) # letra pequena: é informação rápida, não título

# veio de zona de mineração ou árvore (são de todos): alguém bateu nele (evento "veio" do servidor).
# dir: para onde a árvore tomba; animar false = a foto do servidor (já estava no chão quando entrei)
func veio_comum(id: String, cargas: int, volta: float, dir = null, animar := true) -> void:
	var o = por_id.get(id)
	if o == null:
		return
	o.cargas = cargas
	o.volta_ate = m.tempo + volta
	if o.tipo == "arvore":
		if cargas == 0 and not queda.caida(o.id):
			queda.derrubar(o, dir, animar)
			caidas.append(o)
			if coletando != null and coletando.c == o:
				parar(false)
		return
	if cargas == 0 and o.has("corpo") and o.corpo.visible:
		_mostrar_veio(o, false)
		if coletando != null and coletando.c == o:
			parar(false)

# a foto do servidor diz quais veios comuns já foram batidos ([id, cargas, s para voltar]): quem entra depois vê igual
func veios_comuns(lista: Array) -> void:
	for v in lista:
		var o = por_id.get(str(v[0]))
		if o != null and (int(v[1]) != o.cargas or abs(o.volta_ate - (m.tempo + float(v[2]))) > 2.0):
			# árvore que acabou de cair: o evento "veio" (que vem logo depois da foto) traz a queda com a direção
			if o.tipo == "arvore" and int(v[1]) == 0 and float(v[2]) > float(m.P.dados.coleta.arvore.volta) - 1.5 and not queda.caida(o.id):
				continue
			veio_comum(str(v[0]), int(v[1]), float(v[2]), null, false)

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
	for d in dedos:
		if is_instance_valid(d):
			d.peso = 0.0
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
	m.armar("Coleta") # as duas armas nas costas, cruzadas em X
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
		# dedos fechados nas duas mãos, depois do duas (o pulso fica do jeito que o duas pôs)
		for d in dedos:
			if is_instance_valid(d):
				d.queue_free()
		dedos.clear()
		if PEGADA_NOVA:
			for lado in ["R", "L"]:
				var osso: int = m.heroi_esq.find_bone("J_Bip_%s_Hand" % lado)
				if osso >= 0:
					var d = MaoFechadaT.new()
					d.so_dedos = true
					m.heroi_esq.add_child(d)
					d.preparar(m.heroi_esq, osso)
					dedos.append(d)
					duas.furo_local[osso] = d.furo_local(m.heroi_esq)
	return duas.pronto()

# ---------- golpe com as duas mãos ----------
# poses do cabo no espaço do herói (x direita, y cima, z frente): ângulo do cabo (graus, 0 = para a frente,
# 90 = para cima) e onde fica o pé do cabo (a mão de baixo)
# O corpo vai junto (duas_maos.gd): "ag" = m que o quadril desce, "av" = m que o peso vai para a frente (+) ou para
# trás (-), "tor" = graus que o peito gira para a direita, "cur" = curva do tronco (1 = curvado no golpe, negativo
# = arqueado para trás)
const DUAS_PRONTO := {"ang": 55.0, "pe": Vector3(0.0, 1.0, 0.28), "ag": 0.05, "av": 0.0, "tor": 5.0, "cur": 0.25}
# erguida (André, 2026-11-06: "os braços passam por trás da cabeça, parece que quebram"): as mãos ficam acima e um
# pouco à frente da testa, com o cabo inclinado para trás; só a cabeça da picareta passa por trás. Antes o cabo
# deitava a 155° com o pé atrás do rosto e as mãos iam para a nuca.
const DUAS_ALTO := {"ang": 118.0, "pe": Vector3(0.0, 1.5, 0.24), "ag": 0.035, "av": -0.04, "tor": 8.0, "cur": -0.22}
const DUAS_PEDRA := {"ang": -45.0, "pe": Vector3(0.0, 1.05, 0.3), "ag": 0.12, "av": 0.06, "tor": -4.0, "cur": 1.0} # picareta: de cima para baixo na face da pedra
const DUAS_TRONCO := {"ang": -6.0, "pe": Vector3(0.0, 1.12, 0.3)} # machado: quase reto no tronco, na altura do peito
const DUAS_MAO_BAIXO := 0.04 # m do pé do cabo até a mão esquerda
const DUAS_MAO_CIMA := 0.2 # até a mão direita (pegada antiga: mãos quase juntas, guardada)
# pegada de verdade (André 2026-11-16: "a mão esquerda fica quase embaixo, no final do cabo, e a outra no meio do
# cabo, para ter balanço"): a esquerda no pé do cabo e a direita no meio dele, com alavanca.
const PEGADA_NOVA := true # false volta para as mãos quase juntas (DUAS_MAO_CIMA)
const PEGADA_MEIO := 0.5 # onde fica a mão direita: fração do cabo (0 = pé, 1 = encosta na cabeça da ferramenta)
const PEGADA_JUNTA := 0.13 # m mínimos do pé do cabo até a mão direita (um punho de distância da esquerda)
const PEGADA_PUNHO := 0.05 # m do pulso até o meio do punho fechado (o cabo passa ali)
const PEGADA_CABECA := 0.13 # m da ponta de cima que é a cabeça (machado ou picareta), fora do cabo
const DUAS_GIRO := PI / 2.0 # giro da ferramenta em volta do cabo (rad): a ponta da picareta e o fio do machado para a frente

# machado (pedido do André): golpe de lado, na horizontal, vindo de trás do ombro direito até o tronco, com o fio
# virado para onde o machado vai. "giro" = para que lado o cabo aponta em volta do herói (graus, 0 = frente,
# 90 = direita); "ang" = quanto o cabo sobe (graus)
const LADO1_PRONTO := {"ang": 25.0, "giro": 70.0, "pe": Vector3(0.12, 1.05, 0.25), "ag": 0.05, "av": 0.0, "tor": 12.0, "cur": 0.12}
const LADO1_ALTO := {"ang": 20.0, "giro": 150.0, "pe": Vector3(0.3, 1.2, -0.02), "ag": 0.045, "av": -0.05, "tor": 42.0, "cur": -0.1}
const LADO1_TRONCO := {"ang": -4.0, "giro": 8.0, "pe": Vector3(0.04, 1.05, 0.32), "ag": 0.09, "av": 0.05, "tor": -16.0, "cur": 0.45}
# golpe novo da picareta (André 2026-11-15, no jeito da mineração do ArcheAge): base bem aberta, a picareta sobe
# reta acima da cabeça (as mãos na frente da testa, nunca na nuca) e desce com o corpo todo, curvado e agachado, na
# face da pedra; a ponta quica e volta.
const PEDRA2_PRONTO := {"ang": 50.0, "pe": Vector3(0.0, 1.0, 0.3), "ag": 0.1, "av": 0.0, "tor": 4.0, "cur": 0.3, "mao": 0.55}
const PEDRA2_ALTO := {"ang": 112.0, "pe": Vector3(0.0, 1.56, 0.2), "ag": 0.02, "av": -0.07, "tor": 10.0, "cur": -0.3, "mao": 0.12}
const PEDRA2_GOLPE := {"ang": -52.0, "pe": Vector3(0.0, 0.98, 0.32), "ag": 0.2, "av": 0.1, "tor": -5.0, "cur": 1.25, "mao": 0.3}
const PEDRA_QUICA := {"ang": -36.0, "pe": Vector3(0.0, 1.03, 0.3), "ag": 0.17, "av": 0.07, "tor": -3.0, "cur": 1.0, "mao": 0.33}
const GOLPE_NOVO := true # false volta para o golpe antigo (DUAS_* e LADO1_*)
const PEDRA_T := {"ergue": 0.4, "bate": 0.5, "quica": 0.6, "solta": 0.7}
# golpe do machado v2 (André 2026-11-15, segunda gravação do ArcheAge: "não tá natural"): base bem aberta, o
# machado vai para trás do lado direito na altura do ombro com o peito todo torcido e volta na HORIZONTAL, forte,
# até a casca na altura do peito/cintura; o fio quica e o corpo volta para a guarda. O diagonal (v1) está em LADO2_*.
const LADO2_PRONTO := {"ang": 18.0, "giro": 62.0, "pe": Vector3(0.1, 1.0, 0.26), "ag": 0.1, "av": 0.0, "tor": 12.0, "cur": 0.22}
const LADO2_ALTO := {"ang": 48.0, "giro": 158.0, "pe": Vector3(0.26, 1.42, -0.04), "ag": 0.08, "av": -0.08, "tor": 55.0, "cur": -0.18}
const LADO2_TRONCO := {"ang": -18.0, "giro": -4.0, "pe": Vector3(0.02, 0.87, 0.34), "ag": 0.2, "av": 0.09, "tor": -22.0, "cur": 0.7}
const LADO2_QUICA := {"ang": -11.0, "giro": 16.0, "pe": Vector3(0.05, 0.9, 0.31), "ag": 0.18, "av": 0.06, "tor": -12.0, "cur": 0.6}
# André 2026-11-16 ("o braço entra dentro do peito"): o pé do cabo mais à frente, mais baixo e para a esquerda na
# guarda, no golpe e no quique, para os antebraços passarem na frente do peito. Antes: pe (0.12, 1.05, 0.26),
# (0.0, 1.0, 0.34) e (0.04, 1.02, 0.32).
const LADO_PRONTO := {"ang": 14.0, "giro": 60.0, "pe": Vector3(0.0, 0.9, 0.46), "ag": 0.12, "av": 0.0, "tor": 18.0, "cur": 0.15, "mao": 0.5}
const LADO_ALTO := {"ang": 22.0, "giro": 172.0, "pe": Vector3(0.3, 1.22, -0.06), "ag": 0.14, "av": -0.06, "tor": 75.0, "cur": -0.08, "mao": 0.15}
const LADO_TRONCO := {"ang": -3.0, "giro": -12.0, "pe": Vector3(-0.08, 0.95, 0.44), "ag": 0.2, "av": 0.08, "tor": -32.0, "cur": 0.42, "mao": 0.28}
const LADO_QUICA := {"ang": 2.0, "giro": 8.0, "pe": Vector3(-0.04, 0.97, 0.42), "ag": 0.19, "av": 0.05, "tor": -20.0, "cur": 0.36, "mao": 0.32}
# tempos do golpe novo (fração da batida): ergue, desce, bate, quica, volta
const LADO_T := {"ergue": 0.42, "bate": 0.52, "quica": 0.62, "solta": 0.72}

# molas do molejo: x = valor, v = velocidade. Pouco amortecida para passar um pouco do ponto e voltar.
const MOLEJO_K := 170.0
const MOLEJO_AMORT := 13.0
const MOLEJO_BALANCO := 0.018 # m
var _molas := {}

func _mola(nome: String, alvo: float, dt: float) -> void:
	if not _molas.has(nome) or duas.peso < 0.05: # começando: parte do lugar certo
		_molas[nome] = {"x": alvo, "v": 0.0}
	var m2: Dictionary = _molas[nome]
	dt = min(dt, 0.05)
	m2.v += ((alvo - float(m2.x)) * MOLEJO_K - float(m2.v) * MOLEJO_AMORT) * dt
	m2.x += float(m2.v) * dt

func _pose_golpe(o: Dictionary) -> Dictionary:
	return LADO_TRONCO if o.tipo == "arvore" else PEDRA2_GOLPE

# alcance da cabeça da ferramenta na pose do golpe: quanto ela vai à frente do herói e em que altura
func _cabeca_golpe(o: Dictionary) -> Vector2:
	var f: Node3D = ferramentas.get("len" if o.tipo == "arvore" else "min")
	var P: Dictionary = _pose_golpe(o)
	var comp: float = float(f.get_meta("topo", 0.8)) - float(f.get_meta("base", 0.0)) - 0.07 if f else 0.7
	var a: float = deg_to_rad(float(P.ang))
	var g: float = deg_to_rad(float(P.get("giro", 0.0)))
	return Vector2(P.pe.z + cos(a) * cos(g) * comp, P.pe.y + sin(a) * comp)

# onde a mão direita segura, em m a partir do pé do cabo
func _mao_cima(fe: Node3D, frac := PEGADA_MEIO) -> float:
	if not PEGADA_NOVA:
		return DUAS_MAO_CIMA
	var cabo_m: float = float(fe.get_meta("topo", 0.8)) - float(fe.get_meta("base", 0.0)) - PEGADA_CABECA
	return max(PEGADA_JUNTA, DUAS_MAO_BAIXO + (cabo_m - DUAS_MAO_BAIXO) * frac)

func _passo_duas(o: Dictionary, f: float) -> void:
	var fe: Node3D = ferramentas.get(coletando.prof)
	if fe == null:
		return
	var lado: bool = o.tipo == "arvore"
	var PRONTO: Dictionary = LADO_PRONTO if lado else PEDRA2_PRONTO
	var ALTO: Dictionary = LADO_ALTO if lado else PEDRA2_ALTO
	var A: Dictionary = PRONTO
	var B: Dictionary = ALTO
	var k := 0.0
	var curva := 0.0
	var G: Dictionary = _pose_golpe(o)
	if GOLPE_NOVO: # golpe novo (machado e picareta), com o quique
		var T: Dictionary = LADO_T if lado else PEDRA_T
		var QUICA: Dictionary = LADO_QUICA if lado else PEDRA_QUICA
		if f < T.ergue: # ergue, ganhando força
			k = smoothstep(0.0, 1.0, f / T.ergue)
		elif f < T.bate: # desce rápido na diagonal
			A = ALTO
			B = G
			k = (f - T.ergue) / (T.bate - T.ergue)
			k = k * k
		elif f < T.quica: # o fio quica para trás
			A = G
			B = QUICA
			k = sin((f - T.bate) / (T.quica - T.bate) * PI * 0.5)
		elif f < T.solta: # firma de novo
			A = QUICA
			B = QUICA
		else: # volta para a guarda
			A = QUICA
			B = PRONTO
			k = smoothstep(0.0, 1.0, (f - T.solta) / (1.0 - T.solta))
	elif f < 0.45: # (golpe antigo, guardado) ergue devagar
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
	# a mão de cima desliza pelo cabo como nas referências (Vanilla Loop, 2026-11-15): no meio do cabo na guarda,
	# desce até perto da esquerda com a ferramenta erguida e volta um pouco no golpe
	var frac: float = lerp(float(A.get("mao", PEGADA_MEIO)), float(B.get("mao", PEGADA_MEIO)), k)
	duas.mao_d = P0 + cabo * _mao_cima(fe, frac)
	duas.cabo = cabo
	duas.punho = PEGADA_PUNHO if PEGADA_NOVA else 0.0
	var alvo_cur: float = lerp(float(A.get("cur", curva)), float(B.get("cur", curva)), k)
	var alvo_ag: float = lerp(float(A.get("ag", 0.0)), float(B.get("ag", 0.0)), k)
	var alvo_av: float = lerp(float(A.get("av", 0.0)), float(B.get("av", 0.0)), k)
	var alvo_tor: float = deg_to_rad(lerp(float(A.get("tor", 0.0)), float(B.get("tor", 0.0)), k))
	if GOLPE_NOVO:
		# molejo (André 2026-11-15: "ainda duro, no ArcheAge o corpo tem molejo"): o corpo não copia a ferramenta na
		# hora, vai atrás dela numa mola. No impacto o joelho afunda um pouco mais e volta, o peito passa do ponto e
		# o quadril balança com o peso, como um corpo solto de verdade.
		var dt: float = get_process_delta_time()
		_mola("cur", alvo_cur, dt)
		_mola("ag", alvo_ag, dt)
		_mola("av", alvo_av, dt)
		_mola("tor", alvo_tor, dt)
		var balanco: float = sin(f * TAU) * MOLEJO_BALANCO # o peso sobe e desce de leve no ritmo do golpe
		duas.curva = float(_molas.cur.x)
		duas.agacha = float(_molas.ag.x) + balanco
		duas.avanco = float(_molas.av.x)
		duas.torcao = float(_molas.tor.x)
	else:
		duas.curva = alvo_cur
		duas.agacha = alvo_ag
		duas.avanco = alvo_av
		duas.torcao = alvo_tor
	duas.peso = move_toward(duas.peso, 1.0, get_process_delta_time() * 8.0)
	for d in dedos:
		d.peso = duas.peso

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

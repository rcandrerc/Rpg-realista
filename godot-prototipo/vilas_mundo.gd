extends Node3D
# As mini vilas do mundo grande (história v2, Entrega 3; André 2026-11-11, esboço aprovado com o totem no meio de cada
# vila). Onde fica cada casa, a banca e os enfeites vem de mundo.json "vilasMundo" (shared/vilas.js arrumarVila, a mesma
# conta do servidor, que também faz as paredes e o telhado sólidos). Modelos em res://vilas3d/vilas.glb (CC0, Quaternius
# Medieval Village MegaKit e Fantasy Props MegaKit, montados por ferramentas/vilas/montar.mjs); a fogueira é a do
# cenário (res://cenario3d/fogueira.glb).
# Leve no celular (André: desempenho acima de tudo): nada é carregado enquanto o herói está longe de todas as vilas.
# Chegando a uns 260 m de uma, o modelo carrega em segundo plano e a vila nasce como MultiMesh (um por peça de modelo);
# passando de 330 m ela sai da cena. As casas aparecem até 170 m e os enfeites até 60 m.

var m # main.gd
const PERTO := 260.0 # monta a vila
const LONGE := 330.0 # tira a vila
const VE_CASA := 170.0
const VE_ENFEITE := 60.0
const ARQUIVO := "res://vilas3d/vilas.glb"
# Aurora viva (André 2026-11-12, esboço aprovado): a cidade de pedra branca. As torres e os prédios grandes aparecem de
# mais longe; o vidro das janelas e lanternas, os cristais e a água da fonte acendem depois da Vesper (mundo.json
# vilasMundo[].cidade.acende, a mesma conta do servidor para a gente nova: nevoa.npc_apareceu). Praça e ruas de calçada
# branca são uma malha só, feita aqui com o material do calçamento (modelo aurora_chao).
const VE_LONGE := 320.0
const MODELOS_LONGE := ["aurora_torre", "aurora_paco", "aurora_templo", "aurora_pousada", "aurora_portao"]
var mats_aurora := {} # nome do material (Vidro_Aurora, Cristal_Aurora, Agua_Aurora) -> [StandardMaterial3D]
var aceso := -1 # -1 ainda não olhou, 0 apagada, 1 acesa
var vilas: Array = []
var montadas := {} # id da vila -> Node3D
var malhas := {} # nome do modelo -> [[Mesh, Transform3D], ...]
var _pedido := false
var _espera := 0.0
# Rio Claro (André 2026-11-16): a Casa do Comércio grande é de entrar. Por fora é comercio_grande + comercio_grande_cima
# (andar de cima e telhados); lá dentro, comercio_grande_dentro (balcão, estantes, caldeirão: sem sombra, só de perto).
# Com o herói lá dentro e a câmera no alto (visão "Do alto"), o andar de cima some para ver o salão, como a casa do lote.
const SALAO_W := 8.2 # meia largura do salão (shared/vilas.js COMERCIO_GRANDE: paredes em x = ±8, z = ±10)
const SALAO_D := 10.2
const SALAO_ALTO := 5.6 # câmera acima disto (do piso do salão) esconde o telhado
var saloes: Array = [] # [{no, t: Transform3D, cima: [GeometryInstance3D]}]
# carroças paradas com o cavalo (Quaternius Lowpoly Animated Animals, CC0): mexe só de perto
const CAVALO := "res://vilas3d/cavalo.glb"
const CAVALO_LOCAL := Vector3(0, 0, 0.1) # shared/vilas.js CAVALO_CARROCA (o servidor põe o obstáculo no mesmo lugar)
const CAVALO_ESCALA := 0.24
const CAVALO_GIRO := 0.0 # o cavalo olha para +z, para longe da caçamba
const CAVALO_PERTO := 70.0
var cavalos: Array = [] # [{no: Node3D, anim: AnimationPlayer, vila: String}]
var _cavalo_cena: PackedScene
# lampiões do Rio Claro (André 2026-11-17: "postes luminários bonitinhos" para a cidade à noite). Sem luz de verdade
# (cada luz pesa no celular): de noite o vidro das lanternas brilha (material Vidro_Rio do vilas.glb), cada lanterna
# ganha um halo e o chão embaixo uma mancha de luz quente; os halos e as manchas são dois MultiMesh por vila.
const LAMPIAO_LANTERNAS := [Vector3(-0.56, 2.71, 0), Vector3(0.56, 2.71, 0)] # pecas.mjs @lampiao
var mats_rio: Array = [] # Vidro_Rio
var mat_halo: StandardMaterial3D
var mat_poca: StandardMaterial3D
var luz_rio := -1.0 # força do brilho já aplicada (0 = dia)

func _init(principal) -> void:
	m = principal

func _ready() -> void:
	vilas = m.mundo.get("vilasMundo", [])

func _process(dt: float) -> void:
	var t0_parte := Time.get_ticks_usec()
	_process_parte(dt)
	if Time.get_ticks_usec() - t0_parte >= 1000 and Engine.has_meta("lentidao"): # quadro lento (lentidao.gd)
		Engine.get_meta("lentidao").ev("vilas_mundo", t0_parte)

func _process_parte(dt: float) -> void:
	_espera -= dt
	if not saloes.is_empty() and m.heroi != null:
		_telhado_salao()
	if _espera > 0.0 or vilas.is_empty() or m.heroi == null:
		return
	# atrás da capa da entrada (online.gd), confere a cada 0,1 s: a vila perto já nasce antes de o jogo aparecer
	_espera = 0.1 if m.online and m.online._cobrindo else 1.0
	_acender()
	_lampioes()
	var h: Vector3 = m.heroi.position
	var precisa := false
	for V in vilas:
		var d := Vector2(float(V.x) - h.x, float(V.z) - h.z).length()
		var id := str(V.id)
		if d < PERTO and not montadas.has(id):
			precisa = true
			var t0 := Time.get_ticks_usec()
			if _carregado():
				_montar(V)
				if m.lentidao:
					m.lentidao.ev("vila", t0)
				return # uma vila por segundo: nada de travada
		elif d > LONGE and montadas.has(id):
			montadas[id].queue_free()
			montadas.erase(id)
			saloes = saloes.filter(func(s): return is_instance_valid(s.no) and not s.no.is_queued_for_deletion())
			cavalos = cavalos.filter(func(c): return c.vila != id)
	_cavalos_perto(h)
	if precisa and not _pedido:
		_pedido = true
		ResourceLoader.load_threaded_request(ARQUIVO)

# bases dos clãs (base_cla.gd, André 2026-11-22): cada uma entra como mais uma vila (o id muda com o nível, então a
# base que cresceu é montada de novo). As que sumiram ou mudaram saem da cena.
func por_bases(lista: Array) -> void:
	var ids := {}
	for B in lista:
		ids[str(B.id)] = true
	var fica: Array = []
	for V in vilas:
		var id := str(V.id)
		if id.begins_with("base_") and not ids.has(id):
			if montadas.has(id):
				montadas[id].queue_free()
				montadas.erase(id)
			continue
		if not id.begins_with("base_") or ids.has(id):
			fica.append(V)
	var tem := {}
	for V in fica:
		tem[str(V.id)] = true
	for B in lista:
		if not tem.has(str(B.id)):
			fica.append(B)
	vilas = fica
	_espera = 0.0

# tem vila perto do herói que ainda não nasceu (a capa da entrada espera: main.gd montando)
func pendente() -> bool:
	if vilas.is_empty() or m.heroi == null:
		return false
	var h: Vector3 = m.heroi.position
	for V in vilas:
		if Vector2(float(V.x) - h.x, float(V.z) - h.z).length() < PERTO and not montadas.has(str(V.id)):
			return true
	return false

# o modelo das vilas já está na memória (pede em segundo plano e confere a cada segundo)
func _carregado() -> bool:
	if not malhas.is_empty():
		return true
	if not _pedido:
		return false
	var st := ResourceLoader.load_threaded_get_status(ARQUIVO)
	if st == ResourceLoader.THREAD_LOAD_IN_PROGRESS:
		return false
	if st != ResourceLoader.THREAD_LOAD_LOADED:
		push_warning("vilas: não carregou " + ARQUIVO)
		vilas = []
		return false
	var cena: PackedScene = ResourceLoader.load_threaded_get(ARQUIVO)
	var raiz: Node3D = cena.instantiate()
	add_child(raiz) # pintar precisa dele na cena
	m.pintar(raiz, false)
	for modelo in raiz.get_children():
		var l: Array = []
		for mi in modelo.find_children("*", "MeshInstance3D", true, false):
			if mi.mesh != null:
				l.append([mi.mesh, modelo.global_transform.affine_inverse() * mi.global_transform])
		malhas[str(modelo.name)] = l
		for par in l: # os materiais que acendem (os mesmos em todas as peças da cidade)
			for i in par[0].get_surface_count():
				var mt = par[0].surface_get_material(i)
				if mt is StandardMaterial3D and mt.resource_name == "Vidro_Rio" and not mats_rio.has(mt):
					mats_rio.append(mt)
				if mt is StandardMaterial3D and mt.resource_name in ["Vidro_Aurora", "Cristal_Aurora", "Agua_Aurora"]:
					if not mats_aurora.has(mt.resource_name):
						mats_aurora[mt.resource_name] = []
					if not mats_aurora[mt.resource_name].has(mt):
						mats_aurora[mt.resource_name].append(mt)
	raiz.queue_free()
	aceso = -1 # pinta os materiais da cidade no estado certo já na primeira vez
	var fog = load("res://cenario3d/fogueira.glb")
	if fog is PackedScene:
		var r2: Node3D = fog.instantiate()
		add_child(r2)
		m.pintar(r2, false)
		var l2: Array = []
		for mi in r2.find_children("*", "MeshInstance3D", true, false):
			if mi.mesh != null:
				l2.append([mi.mesh, r2.global_transform.affine_inverse() * mi.global_transform])
		malhas["fogueira"] = l2
		r2.queue_free()
	return true

func _montar(V: Dictionary) -> void:
	var no := Node3D.new()
	no.name = "Vila_" + str(V.id)
	add_child(no)
	montadas[str(V.id)] = no
	var grupos := {} # modelo -> [Transform3D]
	var casa := {}
	var salao_ts: Array = []
	var lampioes: Array = []
	for c in V.get("casas", []):
		_por(grupos, str(c.m), c)
		casa[str(c.m)] = true
		if str(c.m) == "comercio_grande":
			_por(grupos, "comercio_grande_cima", c)
			casa["comercio_grande_cima"] = true
			_por(grupos, "comercio_grande_dentro", c) # sem sombra, some de longe (enfeite)
			salao_ts.append(Transform3D(Basis(Vector3.UP, float(c.ry)), Vector3(float(c.x), float(c.y), float(c.z))))
	if V.get("banca") is Dictionary:
		_por(grupos, "banca", V.banca)
		casa["banca"] = true
	for e in V.get("enfeites", []):
		_por(grupos, str(e.m), e)
		if str(e.m) == "lampiao":
			lampioes.append(Transform3D(Basis(Vector3.UP, float(e.ry)), Vector3(float(e.x), float(e.y), float(e.z))))
		if str(e.m) == "carroca_carga":
			_cavalo(no, str(V.id), e)
	var cima: Array = []
	for nome in grupos:
		var ts: Array = grupos[nome]
		for par in malhas.get(nome, []):
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.mesh = par[0]
			mm.instance_count = ts.size()
			for j in ts.size():
				mm.set_instance_transform(j, ts[j] * par[1])
			var g := MultiMeshInstance3D.new()
			g.multimesh = mm
			var grande: bool = casa.has(nome)
			# só as casas fazem sombra (cada sombra é mais um desenho no celular)
			g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if grande else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			g.visibility_range_end = VE_LONGE if nome in MODELOS_LONGE else (VE_CASA if grande else VE_ENFEITE)
			g.visibility_range_end_margin = 8.0
			g.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
			no.add_child(g)
			if nome == "comercio_grande_cima":
				cima.append(g)
	if not lampioes.is_empty():
		_luz_lampioes(no, lampioes)
	for t in salao_ts:
		saloes.append({"no": no, "t": t, "cima": cima})
	if V.get("cidade") is Dictionary:
		_calcada(no, V.cidade)

# herói dentro do salão e câmera no alto: esconde o andar de cima e o telhado (volta ao sair ou com a câmera baixa)
func _telhado_salao() -> void:
	var cam: Camera3D = m.get_viewport().get_camera_3d()
	var h: Vector3 = m.heroi.position
	for S in saloes:
		if not is_instance_valid(S.no):
			continue
		var t: Transform3D = S.t
		var l: Vector3 = t.affine_inverse() * h
		var dentro := absf(l.x) < SALAO_W and absf(l.z) < SALAO_D and l.y > -1.0 and l.y < SALAO_ALTO
		var esconde: bool = dentro and cam != null and cam.global_position.y > t.origin.y + SALAO_ALTO
		for g in S.cima:
			if g.visible == esconde:
				g.visible = not esconde

# o cavalo parado na frente da carroça de carga, com a animação de ficar parado (pausa de longe)
func _cavalo(no: Node3D, vila: String, e: Dictionary) -> void:
	if _cavalo_cena == null:
		_cavalo_cena = load(CAVALO)
		if _cavalo_cena == null:
			return
	var c: Node3D = _cavalo_cena.instantiate()
	var t := Transform3D(Basis(Vector3.UP, float(e.ry)), Vector3(float(e.x), float(e.y), float(e.z)))
	c.transform = t * Transform3D(Basis(Vector3.UP, CAVALO_GIRO).scaled(Vector3.ONE * CAVALO_ESCALA), CAVALO_LOCAL)
	no.add_child(c)
	m.pintar(c, false)
	var anim: AnimationPlayer = c.find_child("AnimationPlayer", true, false)
	if anim != null and anim.has_animation("Armature|Idle"):
		anim.get_animation("Armature|Idle").loop_mode = Animation.LOOP_LINEAR
		anim.play("Armature|Idle")
		anim.seek(randf() * anim.current_animation_length, true) # cada cavalo num passo do balanço
		anim.pause() # anda só quando o herói chega perto (_cavalos_perto)
	c.visible = false
	cavalos.append({"no": c, "anim": anim, "vila": vila})

func _cavalos_perto(h: Vector3) -> void:
	for C in cavalos:
		if not is_instance_valid(C.no):
			continue
		var perto: bool = C.no.global_position.distance_to(h) < CAVALO_PERTO
		if C.no.visible != perto:
			C.no.visible = perto
			if C.anim != null:
				if perto:
					C.anim.play()
				else:
					C.anim.pause()

# Praça das Luzes (disco) e ruas de pedra branca (faixas que seguem as estradas), um pouco acima do chão (o mesmo
# CALCADA de shared/vilas.js: o servidor tem o piso de andar na mesma altura). Textura no mundo: 2 m por ladrilho.
func _calcada(no: Node3D, C: Dictionary) -> void:
	var mat: Material = null
	for par in malhas.get(str(C.get("chao", "aurora_chao")), []): # Rio Claro: tijolo (rio_chao)
		mat = par[0].surface_get_material(0)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var pt := func(p: Vector3) -> void:
		st.set_normal(Vector3.UP)
		st.set_uv(Vector2(p.x * 0.5, p.z * 0.5))
		st.add_vertex(p)
	# cada ponto fica um pouco acima do chão desenhado ali (André 2026-11-17: nas beiradas a grama passava por cima da
	# calçada, porque a altura era só a do meio da rua e o terreno sobe para os lados). Calçada em grade de ~2 m.
	var T = m.terreno
	var assenta := func(p: Vector3, sobe: float) -> Vector3:
		if T != null: # o ponto e a volta (1 m): o chão é desenhado em triângulos maiores que a grade da calçada
			var h: float = T.altura_montanha(p.x, p.z)
			for d in [Vector2(1, 0), Vector2(-1, 0), Vector2(0, 1), Vector2(0, -1)]:
				h = maxf(h, T.altura_montanha(p.x + d.x, p.z + d.y))
			p.y = maxf(p.y, h + sobe + 0.05)
		return p
	var quad := func(a: Vector3, b: Vector3, c2: Vector3, d: Vector3) -> void: # a-b-c2-d em volta
		pt.call(a); pt.call(b); pt.call(c2)
		pt.call(a); pt.call(c2); pt.call(d)
	var P: Dictionary = C.praca
	var sp := float(C.sobePraca)
	var c := Vector3(float(P.x), float(P.y) + sp, float(P.z))
	var r := float(P.r)
	var n := 40
	var aneis := maxi(1, int(ceil(r / 2.0)))
	var anel := func(j: int, i: int) -> Vector3:
		var a := TAU * i / n
		return assenta.call(c + Vector3(sin(a), 0, cos(a)) * (r * j / aneis), sp)
	var meio: Vector3 = assenta.call(c, sp)
	for i in n:
		pt.call(meio); pt.call(anel.call(1, i + 1)); pt.call(anel.call(1, i))
		for j in range(1, aneis):
			quad.call(anel.call(j, i), anel.call(j, i + 1), anel.call(j + 1, i + 1), anel.call(j + 1, i))
	var meia := float(C.largura) / 2.0
	var sr := float(C.sobe)
	var faixas := maxi(1, int(ceil(meia * 2.0 / 1.5)))
	for L in C.ruas:
		var k: int = L.size()
		var lin: Array = [] # lin[i][f]: da esquerda para a direita
		for i in k:
			var a: Array = L[maxi(i - 1, 0)]
			var b: Array = L[mini(i + 1, k - 1)]
			var t := Vector2(float(b[0]) - float(a[0]), float(b[1]) - float(a[1])).normalized() # direção da rua (dx, dz); cada ponto é [x, z, y]
			var q := Vector3(float(L[i][0]), float(L[i][2]) + sr, float(L[i][1]))
			var lado := Vector3(t.y, 0, -t.x)
			var fila: Array = []
			for f in faixas + 1:
				fila.append(assenta.call(q + lado * (-meia + 2.0 * meia * f / faixas), sr))
			lin.append(fila)
		for i in k - 1:
			for f in faixas:
				quad.call(lin[i][f], lin[i][f + 1], lin[i + 1][f + 1], lin[i + 1][f])
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	if mat != null:
		mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.visibility_range_end = VE_CASA
	no.add_child(mi)

# depois da Vesper (a missão "acende" da cidade): janelas, lanternas, cristais e a água da fonte com luz própria
func _acender() -> void:
	if mats_aurora.is_empty() or m.nevoa == null:
		return
	var acende := ""
	for V in vilas:
		if V.get("cidade") is Dictionary and V.cidade.get("acende") != null: # só Aurora acende (Rio Claro não)
			acende = str(V.cidade.acende)
	var agora := 1 if acende != "" and m.nevoa.tem_conta() and not m.nevoa.H.is_empty() and m.nevoa.npc_apareceu(acende) else 0
	if agora == aceso:
		return
	aceso = agora
	var luz := agora == 1
	for mt in mats_aurora.get("Vidro_Aurora", []):
		mt.albedo_color = Color(1.0, 0.86, 0.58) if luz else Color(0.13, 0.15, 0.22)
		mt.emission_enabled = luz
		mt.emission = Color(1.0, 0.76, 0.4)
		mt.emission_energy_multiplier = 1.5
	for mt in mats_aurora.get("Cristal_Aurora", []):
		mt.albedo_color = Color(0.75, 0.95, 1.0) if luz else Color(0.5, 0.55, 0.68)
		mt.emission_enabled = luz
		mt.emission = Color(0.45, 0.85, 1.0)
		mt.emission_energy_multiplier = 2.0
	for mt in mats_aurora.get("Agua_Aurora", []):
		mt.albedo_color = Color(0.35, 0.66, 0.86) if luz else Color(0.2, 0.32, 0.42)
		mt.emission_enabled = luz
		mt.emission = Color(0.2, 0.5, 0.72)
		mt.emission_energy_multiplier = 0.6

func _por(grupos: Dictionary, nome: String, p: Dictionary) -> void:
	if not grupos.has(nome):
		grupos[nome] = []
	grupos[nome].append(Transform3D(Basis(Vector3.UP, float(p.ry)), Vector3(float(p.x), float(p.y), float(p.z))))

# halos (um por lanterna, virado para a câmera) e manchas de luz no chão (uma por lampião): somem de dia
func _luz_lampioes(no: Node3D, ts: Array) -> void:
	if mat_halo == null:
		var g := Gradient.new()
		g.set_color(0, Color(1.0, 0.8, 0.45, 1.0))
		g.set_color(1, Color(1.0, 0.6, 0.25, 0.0))
		var tx := GradientTexture2D.new()
		tx.gradient = g
		tx.fill = GradientTexture2D.FILL_RADIAL
		tx.fill_from = Vector2(0.5, 0.5)
		tx.fill_to = Vector2(0.5, 0.0)
		tx.width = 64
		tx.height = 64
		mat_halo = StandardMaterial3D.new()
		mat_halo.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat_halo.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mat_halo.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		mat_halo.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		mat_halo.no_depth_test = false
		mat_halo.albedo_texture = tx
		mat_poca = mat_halo.duplicate()
		mat_poca.billboard_mode = BaseMaterial3D.BILLBOARD_DISABLED
		mat_poca.cull_mode = BaseMaterial3D.CULL_DISABLED
	var halo := QuadMesh.new()
	halo.size = Vector2(1.1, 1.1)
	halo.material = mat_halo
	var poca := PlaneMesh.new()
	poca.size = Vector2(6.0, 6.0)
	poca.material = mat_poca
	for par in [[halo, LAMPIAO_LANTERNAS.size()], [poca, 1]]:
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = par[0]
		mm.instance_count = ts.size() * int(par[1])
		var j := 0
		for t in ts:
			if par[0] == halo:
				for l in LAMPIAO_LANTERNAS:
					mm.set_instance_transform(j, Transform3D(Basis(), t * l))
					j += 1
			else:
				var c: Vector3 = t.origin
				var y: float = m.terreno.altura_montanha(c.x, c.z) if m.terreno != null else c.y
				mm.set_instance_transform(j, Transform3D(Basis(), Vector3(c.x, maxf(c.y, y) + 0.12, c.z)))
				j += 1
		var g2 := MultiMeshInstance3D.new()
		g2.multimesh = mm
		g2.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		g2.visibility_range_end = VE_CASA
		g2.add_to_group("luz_lampiao")
		g2.visible = luz_rio > 0.0
		no.add_child(g2)

func _lampioes() -> void:
	if m.get("dia") == null or m.dia == null:
		return
	var k := clampf((float(m.dia.noite) - 0.15) / 0.5, 0.0, 1.0)
	if absf(k - luz_rio) < 0.02:
		return
	luz_rio = k
	for mt in mats_rio:
		mt.emission_enabled = k > 0.0
		mt.emission = Color(1.0, 0.72, 0.36)
		mt.emission_energy_multiplier = 1.4 * k
	if mat_halo != null:
		mat_halo.albedo_color = Color(1, 1, 1, 0.9 * k)
		mat_poca.albedo_color = Color(1, 1, 1, 0.45 * k)
	for g in get_tree().get_nodes_in_group("luz_lampiao"):
		g.visible = k > 0.0

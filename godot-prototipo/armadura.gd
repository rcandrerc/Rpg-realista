extends RefCounted
# Armadura que aparece no corpo (peitoral com ombreiras e braçadeiras, calça, botas e capa), no estilo da capa do Aethra.
#
# As peças de metal e pano não são modelos à parte: nascem da própria malha do VRoid (blusa, pele das pernas,
# sapatos). Cada vértice da região escolhida é empurrado para fora pela normal, a superfície é suavizada (some o
# desenho do corpo e fica cara de placa), as bordas ganham espessura e um friso dourado. Como a casca usa os mesmos
# ossos e pesos da roupa de baixo, ela dobra junto com o corpo em qualquer animação, sem atravessar.
# A capa é um pano presa no peito (osso UpperChest) que balança e abre para trás com a corrida (capa.gdshader).
#
# Uso: Armadura.vestir(modelo_do_personagem, equip) com equip = {"corpo": {"k": "peitoral", "r": 3}, ...}.
# Chamar de novo só refaz o que mudou. Malhas ficam em cache (montar a casca custa uma vez por peça).

const SHADER_METAL_TOON := preload("res://armadura.gdshader") # v10 e antes: toon de 3 degraus
const SHADER_METAL := preload("res://armadura_real.gdshader") # v11: aço escovado e couro com grão
const SHADER_CAPA := preload("res://capa.gdshader")
const PanoCapa := preload("res://pano_capa.gd") # física de pano da capa (André 2026-11-04)

# uma linha só de armadura (André): Comum é de couro, do Raro em diante placas de aço com friso
# André 2026-11-05: "adorei o equipamento de couro". Todas as raridades ficam de couro natural (sem placa de ferro);
# o que muda de um set para o outro é só um detalhe na cor da raridade, discreto: ombreiras e cinto tingidos, mais a
# capa. A linha de aço (v11c, ficha técnica) continua aqui: COURO_EM_TUDO = false volta para ela.
const COURO_EM_TUDO := true
static func pecas(k: String, r: int) -> Array: # [[parte, material], ...]
	if COURO_EM_TUDO and r >= 1:
		return _pecas_couro(k, r)
	var metal := r >= 1
	match k:
		"peitoral":
			var m := "metal" if metal else "couro"
			# cinto escuro de 3 cm logo abaixo da ponta do peitoral: é ele que desenha a cintura (direção de arte v7)
			# v10 (arte do Aethra): do Raro em diante, cinto de quadril de couro vermelho com bolsa, caído de lado
			# v11c (ficha técnica do André, 2026-11-04): luvas de couro marrom sem dedos
			return [["peito", "peito" if metal else "couro"], ["ombro_e", m], ["ombro_d", m], ["braco_e", m], ["braco_d", m], ["cinto", "cinto"]] \
				+ ([["cinto_quadril", "cinto_quadril"], ["luva_e", "couro_marrom"], ["luva_d", "couro_marrom"]] if metal else [])
		"calca":
			# Épico ou melhor: saiote de 5 lâminas por cima da saia
			# v10 (André 2026-11-04): saiote em todas as raridades (Comum de couro); antes só do Épico em diante
			# v10 (André 2026-11-04, "a calça parece desbotada"): couro liso de cor firme, sem o reflexo em faixas
			# v11b (referência de couro e aço): do Raro em diante, tabardo de couro na frente e atrás até o joelho
			return [["coxa_e", "calca"], ["coxa_d", "calca"], ["saia", "saia" if metal else "saia_couro"]] + ([["tabardo", "couro_tunica"]] if metal else [])
		"botas":
			# v11 (referência de couro e aço): bota de couro marrom até abaixo do joelho e greva de aço só na frente
			# v11c (ficha técnica): joelheira, greva e placa no peito do pé separadas; couro no tornozelo e calcanhar
			return [["canela_e", "metal"], ["canela_d", "metal"], ["joelho_e", "metal"], ["joelho_d", "metal"], ["cano_e", "couro_marrom"], ["cano_d", "couro_marrom"], ["sapato", "couro_marrom"], ["peito_pe", "metal"]] if metal else [["cano_e", "couro"], ["cano_d", "couro"], ["sapato_couro", "couro"]]
		"short":
			# short de couro (coxa de cima); Épico ou melhor ganha o mesmo saiote de lâminas da calça
			return [["short_e", "couro_escuro"], ["short_d", "couro_escuro"], ["saia", "saia" if metal else "saia_couro"]] + ([["tabardo", "couro_tunica"]] if metal else [])
		"capa":
			return [["capa", "capa"]]
		"chapeu": # Capacete: Comum de couro, Raro em diante de aço
			return [["elmo", "elmo" if metal else "elmo_couro"]]
	return []
# sets de couro (Raro em diante): a mesma armadura do Comum, mais luvas sem dedos, joelheiras de couro, cinto de
# quadril e (no masculino) a túnica; ombreiras e cinto na cor do set ("couro_set")
static func _pecas_couro(k: String, r: int) -> Array:
	match k:
		"peitoral":
			return [["peito", "couro"], ["ombro_e", "couro_set"], ["ombro_d", "couro_set"], ["braco_e", "couro"], ["braco_d", "couro"],
				["cinto", "cinto_set"], ["cinto_quadril", "cinto_quadril"], ["luva_e", "couro_marrom"], ["luva_d", "couro_marrom"]]
		"calca":
			return [["coxa_e", "calca"], ["coxa_d", "calca"], ["saia", "saia_couro"], ["tabardo", "couro_tunica"]]
		"short":
			return [["short_e", "couro_escuro"], ["short_d", "couro_escuro"], ["saia", "saia_couro"], ["tabardo", "couro_tunica"]]
		"botas":
			return [["cano_e", "couro"], ["cano_d", "couro"], ["joelho_e", "couro_set"], ["joelho_d", "couro_set"], ["sapato_couro", "couro"]]
		"capa":
			return [["capa", "capa"]]
		"chapeu":
			return [["elmo", "elmo_couro"]]
	return []
const PECAS := {"chapeu": "cabeca", "peitoral": "corpo", "calca": "pernas", "short": "pernas", "botas": "pes", "capa": "capa"}
const LUGARES := ["cabeca", "corpo", "pernas", "pes", "capa"]

# cores por raridade (Comum, Raro, Épico, Lendário, Mítico): metal, friso, pano da capa (fora, dentro)
# André 2026-11-03: placas com cor de metal de verdade (ferro e aço; o Épico pode puxar um pouco para o roxo) e as
# partes de tecido na cor da raridade (azul, roxo, laranja, pink). Antes as placas eram lilás e azul-claro lisas e
# pareciam roupa de astronauta de plástico.
# metal: [céu refletido (claro), meio-tom, horizonte escuro (sombra)] do reflexo desenhado em armadura.gdshader
# André 2026-11-04 (v10, referência: arte de capa do Aethra): aço azulado polido com friso de ouro grosso em todas as
# raridades de metal, vestido e mangas azul-marinho quase preto por baixo, e a cor da raridade vai para a capa
# (Comum marrom, Raro azul, Épico roxo, Lendário vermelho como na arte, Mítico carmesim escuro).
# André 2026-11-04 (v11, nova referência: guerreira de couro e aço): aço prateado de verdade com borda de ferro
# escuro e rebites, colete de couro marrom, mangas e calça cinza-chumbo, cintos de couro marrom e capa vinho longa.
# A raridade se lê pela capa e pelo brilho do aço. (A v10, aço azul com ouro, está no commit 541c45b.)
# (os tons passam pelo ganho de 2,1 do shader: o "claro" acima de ~0,55 estoura em branco)
const METAL := [ # [céu refletido, cor da peça, reflexo escuro] (armadura_real.gdshader)
	[Color("b8b2a6"), Color("6e665a"), Color("1e1b17")], # Comum: ferro velho
	[Color("c4c8ce"), Color("8a8e95"), Color("23252a")], # Raro: aço
	[Color("c2c3d4"), Color("878a9c"), Color("22222c")], # Épico: aço com um toque frio
	[Color("bcc0c6"), Color("7e838a"), Color("222428")], # Lendário: aço polido (a referência)
	[Color("9c98a0"), Color("5a5660"), Color("141216")]] # Mítico: aço escurecido
const FRISO := [[Color("3a2e22"), Color("b89a72")], [Color("2a2c30"), Color("d0d4da")], [Color("2a2b32"), Color("d0d3dc")],
	[Color("26282c"), Color("e2e6ea")], [Color("4a3020"), Color("e0b088")]] # borda de ferro escuro + bisel claro
const COURO := [Color("9a7a58"), Color("6e4e32"), Color("2e1e12")]
const COURO_ESCURO := [Color("4e3a2c"), Color("33251c"), Color("150e0b")]
const COURO_MARROM := [Color("6a4a30"), Color("4a3220"), Color("1c120a")] # saiote, cintos e botas (v11)
# tecido (mangas e o que fica por baixo): Comum linho cru; do Raro em diante cinza-chumbo
const TECIDO := [Color("b9a47e"), Color("2c3036"), Color("2e2d3c"), Color("2a2e34"), Color("2c2428")]
const ROUPA := TECIDO # nome antigo (a blusa e a saia lisas usam a cor do tecido)
const COLETE := [Color("8a6a48"), Color("4e3422"), Color("4a3222"), Color("4e3422"), Color("40281e")] # couro do colete na blusa
const BRILHO := [0.0, 0.0, 0.05, 0.1, 0.3]
const CAPA := [[Color(0.45, 0.33, 0.24), Color(0.3, 0.22, 0.16)], [Color(0.14, 0.2, 0.36), Color(0.07, 0.1, 0.18)],
	[Color(0.27, 0.13, 0.38), Color(0.13, 0.06, 0.19)], [Color(0.44, 0.07, 0.1), Color(0.22, 0.035, 0.05)], [Color(0.2, 0.05, 0.07), Color(0.08, 0.02, 0.03)]] # Lendário vinho escuro (referência)
# couro tingido de cada set (ombreiras, joelheiras e cinto): tons escuros e foscos, nada chamativo
const COURO_SET := [
	[Color("9a7a58"), Color("6e4e32"), Color("2e1e12")], # Comum: o próprio couro
	[Color("6a7682"), Color("3a4656"), Color("141a20")], # Raro: azul-petróleo
	[Color("766a82"), Color("4a3c58"), Color("18121e")], # Épico: roxo
	[Color("8a5a4e"), Color("5a2a26"), Color("200e0c")], # Lendário: vinho
	[Color("5a4e4e"), Color("2e2424"), Color("0e0a0a")]] # Mítico: couro negro
const CINTO_QUADRIL := [Color("5a3e28"), Color("3e2a1a"), Color("150c07")] # couro marrom (v11)

static var _malhas := {} # "id da malha:parte" -> ArrayMesh pronta
static var _soldas := {} # id da malha de origem -> malha soldada (sem costuras de UV)
static var _materiais := {}
static var junta_peito := 1.1 # y da junta peito/barriga (medido no corpo em _ref)

# ---------- frente do corpo ----------
# André 2026-11-03: nos outros corpos do criador a capa ia para a frente e o capacete saía da cabeça. A Ruiva olha
# para +z; os outros VRoid olham para -z (o pé aponta para trás no espaço do modelo). Tudo aqui é calculado num
# espaço "canônico" (+z = frente, +x = esquerda do personagem): _F leva do modelo para ele e de volta (giro de 180
# graus em volta de y), e _G() põe na frente certa as peças feitas nele e presas a ossos.
static var _vira := false

static func _orientar(esq: Skeleton3D) -> void:
	var pe := esq.find_bone("J_Bip_L_Foot")
	var dedo := esq.find_bone("J_Bip_L_ToeBase")
	_vira = pe >= 0 and dedo >= 0 and esq.get_bone_global_rest(dedo).origin.z < esq.get_bone_global_rest(pe).origin.z

static func _F(p: Vector3) -> Vector3:
	return Vector3(-p.x, p.y, -p.z) if _vira else p

static func _FA(V: PackedVector3Array) -> PackedVector3Array:
	if not _vira:
		return V
	var o := PackedVector3Array(V)
	for i in o.size():
		o[i] = Vector3(-o[i].x, o[i].y, -o[i].z)
	return o

static func _G() -> Transform3D:
	return Transform3D(Basis(Vector3.UP, PI), Vector3.ZERO) if _vira else Transform3D.IDENTITY

# ---------- vestir ----------
static func vestir(raiz: Node3D, equip) -> void:
	var esq: Skeleton3D = _esqueleto(raiz)
	if esq == null:
		return
	_orientar(esq)
	# André 2026-11-07: sem peitoral a blusa vira pele (top de biquíni na menina, peito nu no menino), então ela fica
	# sempre justa como debaixo da armadura (antes, sem peitoral, era a camiseta branca larga)
	_cintura(raiz, true, equip is Dictionary and equip.get("corpo") is Dictionary and PECAS.has(str(equip.corpo.get("k", ""))))
	var tem_capa := false
	if equip is Dictionary and equip.get("capa") is Dictionary:
		tem_capa = PECAS.get(str(equip.capa.get("k", ""))) == "capa"
	for l in LUGARES:
		var it = equip.get(l) if equip is Dictionary else null
		var chave := ""
		if it is Dictionary and PECAS.has(str(it.get("k", ""))):
			chave = "%s:%d" % [str(it.k), int(it.get("r", 0))]
			if l == "pernas" and tem_capa:
				chave += ":capa" # com capa o saiote perde as lâminas de trás (o pano cobre e elas furariam a capa)
		var nome: String = "Armadura_" + str(l)
		var velho := esq.get_node_or_null(nome)
		if velho and velho.get_meta("chave", "") == chave:
			continue
		if velho:
			esq.remove_child(velho)
			velho.queue_free()
		if chave == "":
			continue
		# a capa é um modificador do esqueleto: simula o pano depois da pose final do quadro (pano_capa.gd)
		var no: Node3D = PanoCapa.new() if l == "capa" else Node3D.new()
		no.name = nome
		no.set_meta("chave", chave)
		esq.add_child(no)
		_montar(raiz, esq, no, str(it.k), int(it.get("r", 0)), tem_capa)
	_pele_cheia(raiz)
	_tronco(raiz, esq)
	_sem_contorno_tronco(raiz, esq)
	_roupa_base(raiz, esq) # antes do _uniforme: ele pinta o short de baixo na cor da calça quando há armadura
	_uniforme(raiz, equip if equip is Dictionary else {})
	_cabelo(raiz, esq.get_node_or_null("Armadura_cabeca") != null)
	# armas nas costas passam por fora da capa
	var capa := esq.get_node_or_null("Armadura_capa") != null
	for ba in esq.get_children():
		if ba is BoneAttachment3D and ba.bone_name == "J_Bip_C_UpperChest":
			for arma in ba.get_children():
				costas(esq, arma, capa)
	preload("res://realista.gd").aplicar(raiz) # pele semi-realista (André 2026-11-07)

# André 2026-11-03: "tá gordão, sem cintura". A blusa (Tops) e o cós da saia (Bottoms) do VRoid são largos na
# cintura (~3 cm de folga de cada lado). Uma cópia das malhas é apertada para o centro do corpo entre o quadril e o
# busto (até 24% na largura, 20% atrás), como roupa colada. A armadura do peito nasce dessa blusa já apertada.
# Só com peça no corpo: aí a blusa vira tecido liso (sem o contorno do VRoid). Sem armadura, o contorno da camisa de
# baixo furava o colete apertado em pontos pretos, então a roupa original fica como era.
static func _cintura(raiz: Node3D, ativo := true, peitoral := true) -> void:
	var esq := _esqueleto(raiz)
	if esq == null:
		return
	var R := _ref(esq)
	# André 2026-11-03 (tarde): "o corpo tá muito reto, não tem cintura". Antes de tudo, o próprio corpo (pele,
	# blusa e saia, igual nas três) ganha cintura fina e quadril: vale sempre, com ou sem armadura.
	# só nos corpos femininos (os masculinos do criador, cabelo_m e fumiriya, não têm osso de busto)
	var feminino := esq.find_bone("J_Sec_L_Bust1") >= 0
	var formas := {}
	for trecho in ["Body_00", "Tops", "Bottoms"]:
		var mi := _fonte(raiz, trecho)
		if mi == null or not (mi.mesh is ArrayMesh):
			continue
		if not mi.has_meta("malha_larga"):
			mi.set_meta("malha_larga", mi.mesh)
		var orig: ArrayMesh = mi.get_meta("malha_larga")
		if not feminino:
			formas[trecho] = orig
			if trecho == "Body_00" and not (ativo and peitoral):
				# André 2026-11-07: sem camisa, o menino um pouco mais atlético (peitoral e ombro), "nada demais"
				var chave_a := "atletico:%d" % orig.get_instance_id()
				if not _malhas.has(chave_a):
					_malhas[chave_a] = _atletico(orig, R)
				formas[trecho] = _malhas[chave_a]
			continue
		var chave_f := "forma:%d" % orig.get_instance_id()
		if not _malhas.has(chave_f):
			_malhas[chave_f] = _forma_corpo(orig, R)
		formas[trecho] = _malhas[chave_f]
	for trecho in formas:
		var mi := _fonte(raiz, trecho)
		var alvo: ArrayMesh = formas[trecho]
		if ativo and trecho == "Tops" and not feminino:
			# v10: o capuz do moletom masculino saía por cima da couraça; com peitoral ele entra no corpo
			var chave_q := "sem_capuz:%d" % alvo.get_instance_id()
			if not _malhas.has(chave_q):
				_malhas[chave_q] = _sem_capuz(alvo, R)
			alvo = _malhas[chave_q]
		if ativo and peitoral and trecho == "Body_00" and not feminino:
			# v11d: a pele da axila (escondida pela roupa) aparecia em pontinhos entre o colete e a manga; com
			# armadura ela entra 1,5 cm
			var chave_x := "axila:%d" % alvo.get_instance_id()
			if not _malhas.has(chave_x):
				_malhas[chave_x] = _encolher_axila(alvo, R)
			alvo = _malhas[chave_x]
		if ativo and trecho != "Body_00" and feminino:
			var chave := "cintura:%d" % alvo.get_instance_id()
			if not _malhas.has(chave):
				_malhas[chave] = _apertar_cintura(alvo, R, 1.35 if trecho == "Bottoms" else 1.0, formas.get("Body_00"))
			alvo = _malhas[chave]
			if feminino:
				var chave_c := "saia_curta:%d" % alvo.get_instance_id()
				if not _malhas.has(chave_c):
					_malhas[chave_c] = _saia_curta(alvo, R)
				alvo = _malhas[chave_c]
		if trecho == "Tops" and ativo:
			# v10 (André 2026-11-04): manga colada no braço, como segunda pele por baixo da armadura
			var chave_m := "manga:%d" % alvo.get_instance_id()
			if not _malhas.has(chave_m):
				_malhas[chave_m] = _manga_justa(alvo, R, formas.get("Body_00", alvo), 0.0035 if feminino else 0.009)
			alvo = _malhas[chave_m]
		if trecho == "Tops" and ativo and not feminino:
			# v11b (André 2026-11-04, "o masculino parece um bujão de gás"): o moletom vira roupa colada no tronco,
			# e a couraça (feita a partir dele) acompanha o corpo. Depois da manga justa: a última palavra é não
			# entrar na pele (a manga puxava o pano da axila para dentro do corpo)
			var chave_a := "afinar:%d" % alvo.get_instance_id()
			if not _malhas.has(chave_a):
				_malhas[chave_a] = _afinar_tronco(alvo, R, formas.get("Body_00"))
			alvo = _malhas[chave_a]
		if trecho == "Tops" and ativo:
			# v11: a blusa marca por vértice o que é manga e o que é tronco (colete de couro), e o decote no feminino
			var chave_d := "decote:%d" % alvo.get_instance_id()
			if not _malhas.has(chave_d):
				_malhas[chave_d] = _decote(alvo, R)
			alvo = _malhas[chave_d]
			mi.set_meta("decote", R.y_pescoco)
			mi.set_meta("decote_fem", feminino)
		elif trecho == "Tops":
			mi.remove_meta("decote")
		if trecho == "Tops":
			mi.set_meta("malha_saia", alvo)
			var chave_b := "blusa_curta:%d" % alvo.get_instance_id()
			if not _malhas.has(chave_b):
				_malhas[chave_b] = _blusa_curta(alvo, R)
			alvo = _malhas[chave_b]
		_trocar_malha(mi, alvo)

# direção de arte v9: nos outros corpos do criador a saia ou o vestido original é mais comprido que o saiote e
# aparecia por baixo dele (duas roupas, uma sobre a outra). Com peitoral, o tecido abaixo do quadril fecha 10% para
# dentro e não passa da altura da barra da saia da Ruiva (proporcional ao corpo); na Ruiva nada muda.
static func _saia_curta(orig: ArrayMesh, R: Ref) -> ArrayMesh:
	var barra := R.y_cintura - 0.25 * R.y_cintura / 0.998
	var topo := R.y_cintura - 0.075
	var am := ArrayMesh.new()
	for sfc in orig.get_surface_count():
		var arr := orig.surface_get_arrays(sfc)
		var V: PackedVector3Array = _FA(arr[Mesh.ARRAY_VERTEX])
		for i in V.size():
			var p := V[i]
			if p.y >= topo or absf(p.x) > 0.3 or p.y < R.y_pe + 0.05:
				continue
			var k := smoothstep(topo, topo - 0.06, p.y) * 0.1
			var d := Vector2(p.x, p.z - 0.01) * (1.0 - k)
			V[i] = Vector3(d.x, maxf(p.y, barra), d.y + 0.01)
		arr[Mesh.ARRAY_VERTEX] = _FA(V)
		var flags: int = orig.surface_get_format(sfc) & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS
		am.add_surface_from_arrays(orig.surface_get_primitive_type(sfc), arr, [], {}, flags)
		am.surface_set_material(sfc, orig.surface_get_material(sfc))
		am.surface_set_name(sfc, orig.surface_get_name(sfc))
	return am

# André 2026-11-03: "tirar essa roupa padrão... uma camisa bem colada e um shortinho bem colado, branco, como se
# fosse um underwear, pra usar a armadura por cima e ficar clean". A saia/calça do VRoid, a gravata e os colares somem;
# a blusa vira camiseta branca lisa (já afinada e cortada no quadril em _cintura) e o corpo ganha um short branco
# colado, 3,5 mm acima da pele, feito da própria malha do corpo. Debaixo da blusa o VRoid não tem pele, por isso a
# camiseta sai da blusa. Com peitoral a blusa continua na cor do tecido da raridade (_uniforme). Os sapatos ficam.
# Vale para todos os corpos do criador (herói, boneco do menu e outros jogadores); os NPCs não passam por aqui.
const ROUPA_BASE := Color("eeece6")

static func _roupa_base(raiz: Node3D, esq: Skeleton3D) -> void:
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		if not (mi.mesh is ArrayMesh) or mi.mesh.get_surface_count() == 0 or str(mi.name).begins_with("Armadura"):
			continue
		var nome: String = mi.mesh.surface_get_name(0)
		if "Bottoms" in nome or "Accessory" in nome:
			mi.visible = false
	if esq.get_node_or_null("Roupa_base") != null:
		return
	var corpo := _fonte(raiz, "Body_00")
	if corpo == null:
		return
	var no := Node3D.new()
	no.name = "Roupa_base"
	esq.add_child(no)
	# o short colado continua debaixo da calça e do short de armadura (tapa o vão entre as peças, na cor da calça);
	# sem peça nas pernas aparece a roupa de baixo nova (André 2026-11-07): calcinha de biquíni ou samba-canção
	var masc := esq.find_bone("J_Sec_L_Bust1") < 0
	var partes := ["base_short", "base_samba"] if masc else ["base_short", "base_pele", "base_calcinha"]
	var tronco: MeshInstance3D = esq.get_node_or_null("Tronco")
	if not masc and _peito_de_pele(raiz):
		partes = ["base_short", "base_calcinha_alta", "base_top"] # pele de verdade: o top de biquíni vai por cima dela
	elif not masc and tronco:
		partes = ["base_short", "base_calcinha_alta", "base_top"] # top por cima do tronco encaixado
	for parte in partes:
		var src := tronco if (parte == "base_top" and tronco) else corpo
		# o tronco é uma cópia por corpo (_tronco): a chave é o arquivo dele, senão o top era refeito em cada moça nova
		# (~80 ms no PC a cada corpo, 2026-11-13)
		var chave := "%s:%s" % [str(src.mesh.get_meta("fonte_malha", src.mesh.get_instance_id())), parte]
		if not _malhas.has(chave):
			_malhas[chave] = _casca(src, parte, esq)
		if _malhas[chave] == null:
			continue
		var mi := MeshInstance3D.new()
		mi.name = {"base_short": "Short", "base_pele": "Pele", "base_top": "Top"}.get(parte, "Baixo")
		if parte == "base_top":
			var chave_t := chave + ":uv"
			if not _malhas.has(chave_t):
				_malhas[chave_t] = _uv_tronco(_malhas[chave])
			mi.mesh = _malhas[chave_t]
		else:
			mi.mesh = _malhas[chave]
		mi.skin = src.skin
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		no.add_child(mi)
		mi.skeleton = mi.get_path_to(esq)
		mi.material_override = _material_base() if parte == "base_short" else (_material_pele(raiz) if parte == "base_pele" else (_material_top(raiz) if parte == "base_top" else _material_baixo(masc)))

# casca do top de biquíni: UV2 = (distância até o meio do peito, altura), +10 nas costas, como a blusa (_decote), para
# o biquini.gdshader desenhar o top e descartar o resto
static func _uv_tronco(orig: ArrayMesh) -> ArrayMesh:
	var am := ArrayMesh.new()
	for sfc in orig.get_surface_count():
		var arr := orig.surface_get_arrays(sfc)
		var V: PackedVector3Array = _FA(arr[Mesh.ARRAY_VERTEX])
		var u2 := PackedVector2Array()
		u2.resize(V.size())
		for i in V.size():
			u2[i] = Vector2(absf(V[i].x) + (0.0 if V[i].z > 0.0 else 10.0), V[i].y)
		arr[Mesh.ARRAY_TEX_UV2] = u2
		var flags: int = orig.surface_get_format(sfc) & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS
		am.add_surface_from_arrays(orig.surface_get_primitive_type(sfc), arr, [], {}, flags)
		am.surface_set_name(sfc, orig.surface_get_name(sfc))
	return am

static func _material_top(raiz: Node3D) -> Material:
	var esq := _esqueleto(raiz)
	var R := _ref(esq) if esq else Ref.new()
	var chave := "top:%.3f:%.3f:%.3f" % [R.busto.x, R.busto.y, R.y_pescoco]
	if not _materiais.has(chave):
		var m := ShaderMaterial.new()
		m.shader = preload("res://biquini.gdshader")
		m.set_meta("armadura", true)
		m.set_shader_parameter("tecido", BIQUINI)
		m.set_shader_parameter("fem", 1.0)
		m.set_shader_parameter("so_pano", 1.0)
		m.set_shader_parameter("x_busto", absf(R.busto.x))
		m.set_shader_parameter("y_busto", R.busto.y)
		m.set_shader_parameter("y_pescoco", R.y_pescoco)
		_materiais[chave] = m
	return _materiais[chave]

# a blusa vira camiseta: o que passa do quadril (vestidos dos outros corpos) entra no corpo, sem aparecer
static func _blusa_curta(orig: ArrayMesh, R: Ref) -> ArrayMesh:
	var am := ArrayMesh.new()
	for sfc in orig.get_surface_count():
		var arr := orig.surface_get_arrays(sfc)
		var V: PackedVector3Array = _FA(arr[Mesh.ARRAY_VERTEX])
		var yt := R.y_cintura - 0.075
		for i in V.size():
			var p := V[i]
			if p.y >= yt or absf(p.x) > 0.3:
				continue
			# vai para dentro do corpo (um anel no quadril aparecia: o contorno de desenho dos outros corpos engorda a
			# malha 6 mm e o anel virava uma faixa preta)
			V[i] = Vector3(0.0, yt + 0.03, 0.0)
		arr[Mesh.ARRAY_VERTEX] = _FA(V)
		var flags: int = orig.surface_get_format(sfc) & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS
		am.add_surface_from_arrays(orig.surface_get_primitive_type(sfc), arr, [], {}, flags)
		am.surface_set_material(sfc, orig.surface_get_material(sfc))
		am.surface_set_name(sfc, orig.surface_get_name(sfc))
	return am

static func _material_base() -> Material:
	if not _materiais.has("base"):
		var m := StandardMaterial3D.new()
		m.set_meta("armadura", true) # a cor da roupa da aparência não pinta a roupa de baixo
		m.albedo_color = ROUPA_BASE
		m.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
		m.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
		m.roughness = 1.0
		m.rim_enabled = true # o mesmo contorno de luz da pele (main.pintar)
		m.rim = 0.25
		m.rim_tint = 0.6
		_materiais["base"] = m
	return _materiais["base"]

# roupa de baixo nova (André 2026-11-07): top e calcinha de biquíni (feminino) e samba-canção listrado (masculino)
const BIQUINI := Color("7a2436") # vinho
const SAMBA := Color("b9c6d6") # azul bem claro, com listras finas mais escuras
const SAMBA_LISTRA := Color("5d7594")
# a pele lisa pintada saía mais clara e amarelada que a pele de verdade (a textura do VRoid tem sombra desenhada):
# medido nas fotos de teste, coxa (pele do VRoid) x barriga (pintada)
const PELE_PINTADA := Color(0.98, 0.82, 0.82)

static func _material_baixo(masc: bool) -> Material:
	var chave := "baixo:%s" % masc
	if not _materiais.has(chave):
		var m := ShaderMaterial.new()
		m.shader = preload("res://roupa_baixo.gdshader")
		m.set_meta("armadura", true) # a cor da roupa da aparência não pinta a roupa de baixo
		m.set_shader_parameter("cor", SAMBA if masc else BIQUINI)
		m.set_shader_parameter("listra", SAMBA_LISTRA if masc else BIQUINI)
		m.set_shader_parameter("listras", 1.0 if masc else 0.0)
		_materiais[chave] = m
	return _materiais[chave]

# a blusa sem peitoral: pele pintada nela (o VRoid quase não tem pele debaixo da blusa, ver _decote) e, na menina,
# o top de biquíni. A cor da pele segue a aparência (_cor_pele).
static func _material_biquini(raiz: Node3D, fem: bool) -> Material:
	var esq := _esqueleto(raiz)
	var R := _ref(esq) if esq else Ref.new()
	var pele := _cor_pele(raiz)
	var chave := "biquini:%s:%s:%.3f:%.3f:%.3f" % [fem, pele.to_html(), R.busto.x, R.busto.y, R.y_pescoco]
	if not _materiais.has(chave):
		var m := ShaderMaterial.new()
		m.shader = preload("res://biquini.gdshader")
		m.set_meta("armadura", true) # a aparência não troca (a pele já vem dela)
		m.set_meta("biquini", true)
		m.set_shader_parameter("pele", pele * PELE_PINTADA)
		m.set_shader_parameter("tecido", BIQUINI)
		m.set_shader_parameter("fem", 1.0 if fem and R.busto != Vector3.ZERO else 0.0)
		m.set_shader_parameter("x_busto", absf(R.busto.x))
		m.set_shader_parameter("y_busto", R.busto.y)
		m.set_shader_parameter("y_pescoco", R.y_pescoco)
		_materiais[chave] = m
	return _materiais[chave]

# André 2026-11-07 ("parece uma camisa rosa"): a pele pintada na blusa juntava braço e peito. O corpo do VRoid tem a
# pele do tronco por baixo da roupa, mas a textura fica transparente onde a roupa cobria (a Ruiva some do pescoço ao
# quadril). Aqui a textura do corpo ganha um fundo da cor da pele: o transparente vira pele (uma vez por textura).
static func _pele_cheia(raiz: Node3D) -> void:
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		if not (mi.mesh is ArrayMesh) or mi.mesh.get_surface_count() == 0 or not "Body_00" in mi.mesh.surface_get_name(0):
			continue
		var m = mi.mesh.surface_get_material(0)
		if not (m is BaseMaterial3D) or m.albedo_texture == null or m.has_meta("pele_cheia"):
			continue
		m.set_meta("pele_cheia", true)
		var chave := "pele_cheia:%d" % m.albedo_texture.get_instance_id()
		if not _malhas.has(chave):
			var img: Image = m.albedo_texture.get_image()
			if img == null:
				continue
			img = img.duplicate()
			if img.is_compressed():
				img.decompress()
			img.clear_mipmaps()
			img.convert(Image.FORMAT_RGBA8)
			var fundo := Image.create(img.get_width(), img.get_height(), false, Image.FORMAT_RGBA8)
			var c: Color = preload("res://aparencia.gd").media(m.albedo_texture, true)
			fundo.fill(Color(c.r, c.g, c.b, 1.0))
			fundo.blend_rect(img, Rect2i(Vector2i.ZERO, img.get_size()), Vector2i.ZERO)
			fundo.generate_mipmaps()
			_malhas[chave] = ImageTexture.create_from_image(fundo)
		m.albedo_texture = _malhas[chave]
		# André 2026-11-07 ("o rosto com uma cor e o corpo com outra"): sem camisa aparece muito mais corpo; ele
		# ganha o mesmo tom médio do rosto
		for rosto in raiz.find_children("*", "MeshInstance3D", true, false):
			var feito := false
			for sfc in rosto.mesh.get_surface_count() if rosto.mesh is ArrayMesh else 0: # só malha importada tem nome (a mancha e a barra de vida não)
				var mr = rosto.mesh.surface_get_material(sfc)
				var nome_r: String = (mr.resource_name if mr else "") + " " + rosto.mesh.surface_get_name(sfc)
				if mr is BaseMaterial3D and mr.albedo_texture and "Face_00_SKIN" in nome_r and not "Outline" in nome_r:
					var Ap = preload("res://aparencia.gd")
					var a: Color = Ap.media(mr.albedo_texture, true)
					var b: Color = Ap.media(m.albedo_texture, true)
					var k := Color(clampf(a.r / maxf(b.r, 0.01), 0.75, 1.3), clampf(a.g / maxf(b.g, 0.01), 0.75, 1.3), clampf(a.b / maxf(b.b, 0.01), 0.75, 1.3))
					# mais um pouco de claro no verde e no azul: o rosto (textura com menos sombra desenhada) saía mais claro
					# e amarelado que o peito com a mesma média (medido nas fotos de teste do Cabelo M)
					m.albedo_color = m.albedo_color * k * Color(1.0, 1.1, 1.12)
					if mr.backlight_enabled:
						m.backlight = mr.backlight # a mesma sombra quente do rosto (no corpo era mais forte e alaranjava)
					feito = true
					break
			if feito:
				break

# André 2026-11-07: a Ruiva não tem peito nem o alto dos braços debaixo da roupa. O tronco de pele da Victoria, já
# encaixado nos ossos dela (ferramentas/tronco/assar_tronco.gd), entra no lugar quando ela está sem peitoral.
const TRONCOS := {"N00_000_00_Body_00_SKIN": "res://corpo/tronco_ruiva"}
static func _tronco(raiz: Node3D, esq: Skeleton3D) -> MeshInstance3D:
	var ja: MeshInstance3D = esq.get_node_or_null("Tronco")
	if ja:
		return ja
	var corpo := _fonte(raiz, "Body_00")
	if corpo == null:
		return null
	var arq := ""
	for k in TRONCOS:
		if k in corpo.mesh.surface_get_name(0):
			arq = TRONCOS[k]
	if arq == "" or not ResourceLoader.exists(arq + ".res"):
		return null
	var malha: ArrayMesh = load(arq + ".res")
	# a pele do quadril sem o short desenhado (ferramentas/tronco/limpar_pele.gd)
	var limpa := arq.replace("tronco_", "pele_") + ".png"
	if ResourceLoader.exists(limpa):
		for mc in raiz.find_children("*", "MeshInstance3D", true, false):
			if mc.mesh is ArrayMesh and mc.mesh.get_surface_count() > 0 and "Body_00" in mc.mesh.surface_get_name(0):
				var mb = mc.mesh.surface_get_material(0)
				if mb is BaseMaterial3D and not mb.has_meta("pele_limpa"):
					mb.set_meta("pele_limpa", true)
					mb.albedo_texture = load(limpa)
	var poses := {}
	for i in corpo.skin.get_bind_count():
		var n := corpo.skin.get_bind_name(i)
		if n == "":
			n = esq.get_bone_name(corpo.skin.get_bind_bone(i))
		poses[n] = corpo.skin.get_bind_pose(i)
	var skin := Skin.new()
	for n in malha.get_meta("ossos"):
		skin.add_named_bind(n, poses.get(n, Transform3D.IDENTITY))
	# material: o mesmo da pele do corpo (toon, sombra quente), com a textura da Victoria no tom da pele da Ruiva
	var base = corpo.mesh.surface_get_material(0)
	var chave := "tronco_mat:%s:%d" % [arq, base.get_instance_id() if base else 0]
	if not _materiais.has(chave):
		var tex: Texture2D = load(arq + ".png")
		var m: StandardMaterial3D = base.duplicate() if base is StandardMaterial3D else StandardMaterial3D.new()
		var Ap = preload("res://aparencia.gd")
		if base is StandardMaterial3D and base.albedo_texture:
			var a: Color = Ap.media(base.albedo_texture, true)
			var b: Color = Ap.media(tex, true)
			m.albedo_color = m.albedo_color * Color(clampf(a.r / maxf(b.r, 0.01), 0.7, 1.4), clampf(a.g / maxf(b.g, 0.01), 0.7, 1.4), clampf(a.b / maxf(b.b, 0.01), 0.7, 1.4))
		# na emenda a cor de vértice acerta a pele da Victoria com a da Ruiva (guardada dividida por escala_cor)
		var ec: float = malha.get_meta("escala_cor", 0.0)
		if ec > 0.0:
			m.vertex_color_use_as_albedo = true
			m.albedo_color = m.albedo_color * Color(ec, ec, ec)
		m.albedo_texture = tex
		m.resource_name = "Tronco_Body_SKIN"
		var c := StandardMaterial3D.new() # contorno escuro de desenho, como o resto do corpo (main.pintar)
		c.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		c.cull_mode = BaseMaterial3D.CULL_FRONT
		c.grow = true
		c.grow_amount = 0.006
		c.albedo_color = Color(0.12, 0.08, 0.08)
		m.next_pass = c
		_materiais[chave] = m
	var mi: MeshInstance3D = null
	# o tronco e os braços aparecem só sem peitoral
	for par in [["Tronco", arq + ".res"]]:
		if not ResourceLoader.exists(par[1]):
			continue
		var copia: ArrayMesh = (load(par[1]) as ArrayMesh).duplicate()
		copia.surface_set_material(0, _materiais[chave])
		copia.set_meta("fonte_malha", par[1]) # mesma malha em todo corpo: o top de biquíni (_roupa_base) sai do cache
		var no := MeshInstance3D.new()
		no.name = par[0]
		no.mesh = copia
		no.skin = skin
		no.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		esq.add_child(no)
		no.skeleton = no.get_path_to(esq)
		if par[0] == "Tronco":
			mi = no
	return mi

# o corpo do VRoid tem pele de verdade no peito e na barriga (e não uma camiseta pintada na textura nem um buraco)?
# Amostra a textura do corpo nos vértices da frente do tronco e compara com a cor da pele.
static func _peito_de_pele(raiz: Node3D) -> bool:
	var corpo := _fonte(raiz, "Body_00")
	var esq := _esqueleto(raiz)
	if corpo == null or esq == null:
		return false
	var chave := "peito_pele:%d" % corpo.mesh.get_instance_id()
	if _malhas.has(chave):
		return _malhas[chave]
	var R := _ref(esq)
	var ok := false
	var m = corpo.mesh.surface_get_material(0)
	if m is BaseMaterial3D and m.albedo_texture:
		var img: Image = m.albedo_texture.get_image()
		if img:
			img = img.duplicate()
			if img.is_compressed():
				img.decompress()
			var ref: Color = preload("res://aparencia.gd").media(m.albedo_texture, true)
			var n := 0
			var bons := 0
			for mi in raiz.find_children("*", "MeshInstance3D", true, false):
				if not (mi.mesh is ArrayMesh) or mi.mesh.get_surface_count() == 0 or not "Body_00" in mi.mesh.surface_get_name(0):
					continue
				var a: Array = mi.mesh.surface_get_arrays(0)
				var V: PackedVector3Array = _FA(a[Mesh.ARRAY_VERTEX])
				var U: PackedVector2Array = a[Mesh.ARRAY_TEX_UV]
				for i in V.size():
					var p := V[i]
					if p.z < 0.0 or absf(p.x) > 0.08 or p.y < R.y_cintura + 0.03 or p.y > R.y_pescoco - 0.08:
						continue
					n += 1
					var c := img.get_pixelv(Vector2i(clampi(int(U[i].x * img.get_width()), 0, img.get_width() - 1), clampi(int(U[i].y * img.get_height()), 0, img.get_height() - 1)))
					if absf(c.r - ref.r) + absf(c.g - ref.g) + absf(c.b - ref.b) < 0.25:
						bons += 1
			ok = n >= 20 and bons >= n * 0.7
	_malhas[chave] = ok
	return ok

static func _material_pele(raiz: Node3D) -> Material:
	var pele := _cor_pele(raiz)
	var chave := "pele:%s" % pele.to_html()
	if not _materiais.has(chave):
		var m := StandardMaterial3D.new()
		m.set_meta("armadura", true)
		m.albedo_color = pele * PELE_PINTADA * Color(1.0, 0.97, 0.95)
		m.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
		m.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
		m.roughness = 1.0
		m.backlight_enabled = true # a mesma sombra quente da pele (main.pele_viva)
		m.backlight = Color(0.32, 0.12, 0.07)
		m.rim_enabled = true
		m.rim = 0.08
		m.rim_tint = 0.6
		_materiais[chave] = m
	return _materiais[chave]

# a aparência trocou a cor da pele: a pele pintada na blusa (sem peitoral) e no quadril acompanha
static func atualizar_pele(raiz: Node3D) -> void:
	var mi := _fonte(raiz, "Tops")
	if mi:
		for sfc in mi.get_surface_override_material_count():
			var m := mi.get_surface_override_material(sfc)
			if m != null and m.has_meta("biquini"):
				mi.set_surface_override_material(sfc, _material_biquini(raiz, mi.get_meta("decote_fem", true)))
	var esq := _esqueleto(raiz)
	var p: MeshInstance3D = esq.get_node_or_null("Roupa_base/Pele") if esq else null
	if p:
		p.material_override = _material_pele(raiz)

# Menina: o corpo debaixo da blusa (pele de rascunho, textura escura, e o contorno escuro 6 mm maior de main.pintar)
# furava a blusa justa em pontos pretos na cintura quando ela vira pele pintada. No tronco a blusa (ou a armadura)
# sempre cobre o corpo, então ali o contorno sai e a pele entra 1,2 cm.
static func _sem_contorno_tronco(raiz: Node3D, esq: Skeleton3D) -> void:
	if esq.find_bone("J_Sec_L_Bust1") < 0 or _peito_de_pele(raiz):
		return # corpo com peito de pele de verdade: sem blusa por cima, o tronco fica como é
	var R := _ref(esq)
	var tronco: MeshInstance3D = esq.get_node_or_null("Tronco")
	var cobre: Array = tronco.mesh.get_meta("cobre", []) if tronco else []
	# abaixo do corte a pele é da Ruiva mesmo (a emenda com o tronco fica nessa altura)
	var corte: float = tronco.mesh.get_meta("corte", -10.0) if tronco else -10.0
	var pescoco_ate: float = tronco.mesh.get_meta("pescoco_ate", -10.0) if tronco else -10.0
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		if not (mi.mesh is ArrayMesh) or mi.mesh.get_surface_count() < 2 or not "Body_00" in mi.mesh.surface_get_name(0):
			continue
		var orig: ArrayMesh = mi.mesh
		if orig.has_meta("sem_contorno"):
			continue
		# com o tronco encaixado, a pele da própria Ruiva debaixo dele sai (o que sobrava furava o tronco)
		var nomes_osso := []
		for i in mi.skin.get_bind_count() if mi.skin else 0:
			var n: String = mi.skin.get_bind_name(i)
			nomes_osso.append(n if n != "" else esq.get_bone_name(mi.skin.get_bind_bone(i)))
		var chave := "sem_contorno:%d" % orig.get_instance_id()
		if not _malhas.has(chave):
			var am := ArrayMesh.new()
			for sfc in orig.get_surface_count():
				var arr := orig.surface_get_arrays(sfc)
				if not cobre.is_empty() and arr[Mesh.ARRAY_INDEX] != null and arr[Mesh.ARRAY_BONES] != null:
					var Bs: PackedInt32Array = arr[Mesh.ARRAY_BONES]
					var Ws: PackedFloat32Array = arr[Mesh.ARRAY_WEIGHTS]
					var nv: int = (arr[Mesh.ARRAY_VERTEX] as PackedVector3Array).size()
					var kb := Bs.size() / maxi(nv, 1)
					var Vs: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
					var sob := PackedByteArray()
					sob.resize(nv)
					for i in nv:
						var melhor := -1.0
						var nm := ""
						for j in kb:
							if Ws[i * kb + j] > melhor:
								melhor = Ws[i * kb + j]
								nm = nomes_osso[Bs[i * kb + j]] if Bs[i * kb + j] < nomes_osso.size() else ""
						var y := _F(Vs[i]).y
						sob[i] = 1 if ((nm in cobre and y > corte) or (nm == "J_Bip_C_Neck" and y < pescoco_ate)) else 0
					var I0: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
					var J0 := PackedInt32Array()
					# sai o triângulo todo debaixo do tronco: a borda do tronco foi colada nesse buraco
					# (ferramentas/tronco/assar_tronco.gd, _costurar)
					# no pescoço o contorno sai já com um vértice debaixo (senão o lado de dentro dele aparece preto)
					var contorno := "Outline" in orig.surface_get_name(sfc)
					for t in range(0, I0.size(), 3):
						if contorno and (sob[I0[t]] or sob[I0[t + 1]] or sob[I0[t + 2]]) and _F(Vs[I0[t]]).y > R.y_pescoco - 0.12:
							continue
						if not (sob[I0[t]] and sob[I0[t + 1]] and sob[I0[t + 2]]):
							J0.append_array([I0[t], I0[t + 1], I0[t + 2]])
					arr[Mesh.ARRAY_INDEX] = J0
				if "Outline" in orig.surface_get_name(sfc) and arr[Mesh.ARRAY_INDEX] != null and tronco == null:
					var V: PackedVector3Array = _FA(arr[Mesh.ARRAY_VERTEX])
					var I: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
					var fora := PackedByteArray()
					fora.resize(V.size())
					for i in V.size():
						var p := V[i]
						fora[i] = 1 if (p.y > R.y_cintura - 0.06 and p.y < R.y_pescoco - 0.03 and absf(p.x) < R.x_braco + 0.01) else 0
					var J := PackedInt32Array()
					for t in range(0, I.size(), 3):
						if not (fora[I[t]] and fora[I[t + 1]] and fora[I[t + 2]]):
							J.append_array([I[t], I[t + 1], I[t + 2]])
					arr[Mesh.ARRAY_INDEX] = J
				elif arr[Mesh.ARRAY_NORMAL] != null and esq.get_node_or_null("Tronco") == null:
					# (com o tronco encaixado por cima, a pele fica onde está: entrar abria um degrau na cintura)
					# a pele de rascunho debaixo da blusa (textura escura) furava a cintura justa: entra 1,2 cm
					var V: PackedVector3Array = _FA(arr[Mesh.ARRAY_VERTEX])
					var N: PackedVector3Array = _FA(arr[Mesh.ARRAY_NORMAL])
					for i in V.size():
						var p := V[i]
						if p.y > R.y_cintura - 0.05 and p.y < R.y_pescoco - 0.05 and absf(p.x) < R.x_braco - 0.01:
							V[i] = p - N[i] * 0.012
					arr[Mesh.ARRAY_VERTEX] = _FA(V)
				var flags: int = orig.surface_get_format(sfc) & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS
				am.add_surface_from_arrays(orig.surface_get_primitive_type(sfc), arr, orig.surface_get_blend_shape_arrays(sfc), {}, flags)
				am.surface_set_material(sfc, orig.surface_get_material(sfc))
				am.surface_set_name(sfc, orig.surface_get_name(sfc))
			am.set_meta("sem_contorno", true)
			_malhas[chave] = am
		_trocar_malha(mi, _malhas[chave])

static func _trocar_malha(mi: MeshInstance3D, malha: Mesh) -> void:
	if mi.mesh == malha:
		return
	var mats := []
	for i in mi.get_surface_override_material_count():
		mats.append(mi.get_surface_override_material(i))
	mi.mesh = malha
	for i in mini(mats.size(), mi.get_surface_override_material_count()):
		mi.set_surface_override_material(i, mats[i])

# fator de largura do corpo por altura: cintura fina (~5 cm acima do umbigo) e quadril um pouco mais largo.
# Só depende da altura, então pele, blusa e saia apertam igual e uma camada nunca fura a outra.
static func _fator_forma(y: float, R: Ref) -> Vector2: # (x, z)
	# André 2026-11-07: com o tronco de pele de verdade (_tronco) a cintura de 38% ficou "artificial demais": agora
	# aperta 24%, numa curva mais longa e suave, e o quadril abre menos
	var cint := _sino(absf(y - (R.y_cintura + 0.05)), 0.17)
	var quad := _sino(absf(y - (R.y_cintura - 0.085)), 0.09)
	return Vector2(1.0 - 0.24 * cint + 0.06 * quad, 1.0 - 0.12 * cint)

static func _forma_corpo(orig: ArrayMesh, R: Ref) -> ArrayMesh:
	var am := ArrayMesh.new()
	am.blend_shape_mode = orig.blend_shape_mode
	for i in orig.get_blend_shape_count():
		am.add_blend_shape(orig.get_blend_shape_name(i))
	var mexe := func(V: PackedVector3Array) -> PackedVector3Array:
		V = _FA(V)
		for i in V.size():
			var p := V[i]
			if absf(p.x) > 0.24 or p.y > R.y_cintura + 0.25 or p.y < R.y_cintura - 0.2: # braços (em T), peito e pernas ficam
				continue
			var k := _fator_forma(p.y, R)
			V[i] = Vector3(p.x * k.x, p.y, 0.005 + (p.z - 0.005) * k.y)
		return _FA(V)
	for sfc in orig.get_surface_count():
		var arr := orig.surface_get_arrays(sfc)
		arr[Mesh.ARRAY_VERTEX] = mexe.call(arr[Mesh.ARRAY_VERTEX])
		var bs := orig.surface_get_blend_shape_arrays(sfc)
		for j in bs.size():
			var b: Array = bs[j]
			if b.size() > Mesh.ARRAY_VERTEX and b[Mesh.ARRAY_VERTEX] is PackedVector3Array and am.blend_shape_mode == Mesh.BLEND_SHAPE_MODE_NORMALIZED:
				b[Mesh.ARRAY_VERTEX] = mexe.call(b[Mesh.ARRAY_VERTEX])
			bs[j] = b
		am.add_surface_from_arrays(orig.surface_get_primitive_type(sfc), arr, bs, {}, orig.surface_get_format(sfc) & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS)
		am.surface_set_material(sfc, orig.surface_get_material(sfc))
		am.surface_set_name(sfc, orig.surface_get_name(sfc))
	return am

# peitoral 7 mm mais alto e ombro (deltoide) 4 mm mais cheio, com borda macia; só no corpo, na pose de descanso
static func _atletico(orig: ArrayMesh, R: Ref) -> ArrayMesh:
	var y_peito := R.y_pescoco - 0.13
	var mexe := func(V: PackedVector3Array) -> PackedVector3Array:
		V = _FA(V)
		for i in V.size():
			var p := V[i]
			var ax := absf(p.x)
			if p.z > 0.0 and ax < R.x_braco + 0.03 and absf(p.y - y_peito) < 0.09:
				var d := Vector2((ax - 0.062) / 0.075, (p.y - y_peito) / (0.05 if p.y < y_peito else 0.07)).length()
				var w := _sino(d, 1.0) * clampf(p.z / 0.04, 0.0, 1.0)
				p += Vector3(signf(p.x) * 0.0015 * w, 0.0015 * w, 0.007 * w)
			var ombro := Vector3(signf(p.x) * (R.p_braco.x + 0.025), R.p_braco.y, R.p_braco.z)
			var dd := p.distance_to(ombro)
			if dd < 0.08:
				var r := Vector3(0.0, p.y - ombro.y, p.z - ombro.z)
				if r.length() > 0.001:
					p += r.normalized() * 0.004 * _sino(dd, 0.08)
			V[i] = p
		return _FA(V)
	var am := ArrayMesh.new()
	am.blend_shape_mode = orig.blend_shape_mode
	for i in orig.get_blend_shape_count():
		am.add_blend_shape(orig.get_blend_shape_name(i))
	for sfc in orig.get_surface_count():
		var arr := orig.surface_get_arrays(sfc)
		arr[Mesh.ARRAY_VERTEX] = mexe.call(arr[Mesh.ARRAY_VERTEX])
		var bs := orig.surface_get_blend_shape_arrays(sfc)
		for j in bs.size():
			var b: Array = bs[j]
			if b.size() > Mesh.ARRAY_VERTEX and b[Mesh.ARRAY_VERTEX] is PackedVector3Array and am.blend_shape_mode == Mesh.BLEND_SHAPE_MODE_NORMALIZED:
				b[Mesh.ARRAY_VERTEX] = mexe.call(b[Mesh.ARRAY_VERTEX])
			bs[j] = b
		am.add_surface_from_arrays(orig.surface_get_primitive_type(sfc), arr, bs, {}, orig.surface_get_format(sfc) & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS)
		am.surface_set_material(sfc, orig.surface_get_material(sfc))
		am.surface_set_name(sfc, orig.surface_get_name(sfc))
	return am

# mais = aperta mais (o cós da saia aperta mais que a blusa, para ficar sempre por dentro dela)
# fecha o saiote (e a saia de baixo) em volta do quadril: raio máximo = raio do alto + tan(17°) x descida
static func _fechar_saia(pos: PackedVector3Array, R: Ref, folga := 0.0) -> PackedVector3Array:
	var yt := R.y_cintura - 0.075
	var rt := 0.0
	for p in pos:
		if absf(p.y - yt) < 0.02:
			rt = maxf(rt, Vector2(p.x, p.z - 0.01).length())
	if rt <= 0.0:
		return pos
	for i in pos.size():
		var p := pos[i]
		if p.y >= yt:
			continue
		var d := Vector2(p.x, p.z - 0.01)
		var rmax := rt + folga + tan(deg_to_rad(17.0)) * (yt - p.y)
		if d.length() > rmax:
			d = d.normalized() * rmax
			pos[i] = Vector3(d.x, p.y, d.y + 0.01)
	return pos

# v11b: tronco do moletom masculino colado no corpo. Por fatia de 1 cm, a largura e a profundidade da roupa encolhem
# até a da pele + 8 mm (sem pele medida na fatia: encolhe 14%). As mangas (braço em T) e a gola ficam; o ombro faz
# a transição.
static func _encolher_axila(orig: ArrayMesh, R: Ref) -> ArrayMesh:
	var am := ArrayMesh.new()
	for sfc in orig.get_surface_count():
		var arr := orig.surface_get_arrays(sfc)
		var V: PackedVector3Array = _FA(arr[Mesh.ARRAY_VERTEX])
		for i in V.size():
			var p := V[i]
			# tronco debaixo do colete (do quadril até a axila; no ombro só até o osso do braço): entra 1,5 cm na
			# horizontal, em direção ao meio do corpo. O pano do moletom tem triângulos grandes e a pele furava
			if p.y < R.y_cintura - 0.04 or p.y > R.y_braco + 0.02:
				continue
			var lim := 0.25 if p.y < R.y_braco - 0.07 else R.x_braco + 0.02
			if absf(p.x) > lim:
				continue
			var k := smoothstep(R.y_cintura - 0.04, R.y_cintura + 0.02, p.y) * (1.0 - smoothstep(R.y_braco - 0.03, R.y_braco + 0.02, p.y))
			var d := Vector2(p.x, p.z - 0.0)
			if d.length() < 0.03 or k <= 0.0:
				continue
			d = d.normalized() * maxf(0.03, d.length() - 0.015 * k)
			V[i] = Vector3(d.x, p.y, d.y)
		arr[Mesh.ARRAY_VERTEX] = _FA(V)
		var flags: int = orig.surface_get_format(sfc) & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS
		am.add_surface_from_arrays(orig.surface_get_primitive_type(sfc), arr, [], {}, flags)
		am.surface_set_material(sfc, orig.surface_get_material(sfc))
		am.surface_set_name(sfc, orig.surface_get_name(sfc))
	return am

static func _afinar_tronco(orig: ArrayMesh, R: Ref, corpo: Mesh) -> ArrayMesh:
	# v11d (André 2026-11-04, "ainda parece um barril reto"): o moletom tem os lados bem fora do ombro (x além do
	# osso do braço). Abaixo da axila tudo até 25 cm do meio é tronco; só na altura do ombro a manga fica de fora.
	var axila := R.y_braco - 0.07
	var no_tronco := func(p: Vector3) -> bool:
		return absf(p.x) < (0.25 if p.y < axila else R.x_braco + 0.01)
	# a pele por baixo do moletom tem poucos vértices (triângulos grandes): amostra a superfície a cada ~8 mm
	var amostras := PackedVector3Array()
	if corpo:
		var ca := corpo.surface_get_arrays(0)
		var CV: PackedVector3Array = _FA(ca[Mesh.ARRAY_VERTEX])
		var CI: PackedInt32Array = ca[Mesh.ARRAY_INDEX]
		for t in range(0, CI.size(), 3):
			var a := CV[CI[t]]
			var b := CV[CI[t + 1]]
			var c := CV[CI[t + 2]]
			if absf(a.x) > 0.27 or a.y < R.y_cintura - 0.25 or a.y > R.y_pescoco + 0.05:
				continue
			var lado := maxf(a.distance_to(b), maxf(b.distance_to(c), c.distance_to(a)))
			var n := clampi(int(ceil(lado / 0.008)), 1, 40)
			for i in n + 1:
				for j in n + 1 - i:
					var u := float(i) / n
					var v := float(j) / n
					amostras.append(a + (b - a) * u + (c - a) * v)
	var pele := {}
	if corpo:
		for p in amostras:
			if not no_tronco.call(p):
				continue
			var q := int(round(p.y * 100.0))
			var f: Array = pele.get(q, [0.0, 9.0, -9.0, 0])
			pele[q] = [maxf(f[0], absf(p.x)), minf(f[1], p.z), maxf(f[2], p.z), f[3] + 1]
	# contorno da pele por fatia e por ângulo (36 setores em volta do centro da fatia): a roupa nunca entra nele
	var NA := 36
	var raio_pele := {}
	if corpo:
		# (aqui com o ombro e o alto do braço junto: a pele da axila furava o colete)
		for p in amostras:
			if absf(p.x) > 0.25:
				continue
			var q := int(round(p.y * 100.0))
			if not pele.has(q):
				continue
			var fp: Array = pele[q]
			var c := Vector2(0.0, (fp[1] + fp[2]) * 0.5)
			var d := Vector2(p.x, p.z) - c
			var k := posmod(int(round(atan2(d.x, d.y) / TAU * NA)), NA)
			var chave_r := q * 100 + k
			raio_pele[chave_r] = maxf(raio_pele.get(chave_r, 0.0), d.length())
	# cintura: um pouco acima do osso da coluna (que fica no quadril); afina mais 8% ali
	var y_fina := R.y_cintura + 0.06
	var am := ArrayMesh.new()
	for sfc in orig.get_surface_count():
		var arr := orig.surface_get_arrays(sfc)
		var V: PackedVector3Array = _FA(arr[Mesh.ARRAY_VERTEX])
		var roupa := {}
		for p in V:
			if not no_tronco.call(p):
				continue
			var q := int(round(p.y * 100.0))
			var f: Array = roupa.get(q, [0.0, 9.0, -9.0])
			roupa[q] = [maxf(f[0], absf(p.x)), minf(f[1], p.z), maxf(f[2], p.z)]
		for i in V.size():
			var p := V[i]
			if absf(p.x) > 0.27 or p.y > R.y_braco + 0.04:
				continue
			# peso: tronco inteiro; na altura do ombro some para a manga e para a gola
			var w := 1.0 - smoothstep(axila, R.y_braco + 0.01, p.y)
			if p.y >= axila:
				w *= 1.0 - smoothstep(R.x_braco - 0.03, R.x_braco + 0.05, absf(p.x))
			if not no_tronco.call(p) and p.y < axila:
				w = 0.0
			var q := int(round(p.y * 100.0))
			var fr = roupa.get(q)
			if fr == null:
				fr = [1.0, -1.0, 1.0]
				w = 0.0
			var kx := 0.8
			var kz := 0.82
			var cz: float = (fr[1] + fr[2]) * 0.5
			for dq in [0, -1, 1, -2, 2]:
				var fp = pele.get(q + dq)
				if fp == null or fp[3] < 6:
					continue
				kx = clampf((fp[0] + 0.007) / maxf(0.01, fr[0]), 0.5, 1.0)
				cz = (fp[1] + fp[2]) * 0.5
				kz = clampf(((fp[2] - fp[1]) * 0.5 + 0.007) / maxf(0.01, (fr[2] - fr[1]) * 0.5), 0.55, 1.0)
				break
			var fina := 1.0 - 0.08 * _sino(absf(p.y - y_fina), 0.14)
			var n := Vector3(p.x * kx * fina, p.y, cz + (p.z - cz) * kz * (1.0 - 0.04 * _sino(absf(p.y - y_fina), 0.14)))
			n = p.lerp(n, w)
			# não entra na pele: no setor dela (e nos vizinhos, fatias de cima e de baixo) fica 7 mm por fora
			var fp0 = pele.get(q) if p.y < axila + 0.02 else null # ombro e manga em T ficam com a manga justa
			if fp0 != null:
				var c := Vector2(0.0, (fp0[1] + fp0[2]) * 0.5)
				var d := Vector2(n.x, n.z) - c
				var k := posmod(int(round(atan2(d.x, d.y) / TAU * NA)), NA)
				var rmin := 0.0
				for dq in [-1, 0, 1]:
					for dk in [-1, 0, 1]:
						rmin = maxf(rmin, raio_pele.get((q + dq) * 100 + posmod(k + dk, NA), 0.0))
				if rmin > 0.0 and d.length() < rmin + 0.007:
					d = d.normalized() * (rmin + 0.007)
					n = Vector3(d.x, n.y, c.y + d.y)
			V[i] = n
		arr[Mesh.ARRAY_VERTEX] = _FA(V)
		var flags: int = orig.surface_get_format(sfc) & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS
		am.add_surface_from_arrays(orig.surface_get_primitive_type(sfc), arr, [], {}, flags)
		am.surface_set_material(sfc, orig.surface_get_material(sfc))
		am.surface_set_name(sfc, orig.surface_get_name(sfc))
	return am

static func _apertar_cintura(orig: ArrayMesh, R: Ref, mais := 1.0, corpo: Mesh = null) -> ArrayMesh:
	# contorno do corpo (pele) em fatias de 1 cm: a roupa apertada nunca entra na pele (furava em pontos pretos)
	var fat := {} # fatia -> [x máx, z de trás, z da frente]
	if corpo:
		for p in _FA(corpo.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]):
			if absf(p.x) > 0.2:
				continue
			var q := int(round(p.y * 100.0))
			var f: Array = fat.get(q, [0.0, 9.0, -9.0])
			fat[q] = [maxf(f[0], absf(p.x)), minf(f[1], p.z), maxf(f[2], p.z)]
	var meio := lerpf(R.y_cintura, junta_peito, 0.6) # ponto mais fino (acima do umbigo)
	var y_cinto := R.y_cintura + 0.055 # meio do cinto (ver _malha_cinto)
	var raio_y := maxf(0.06, (junta_peito - R.y_cintura) * 0.5 + 0.03) # a barra da blusa (quadril) quase não mexe
	var am := ArrayMesh.new()
	for sfc in orig.get_surface_count():
		var arr := orig.surface_get_arrays(sfc)
		var V: PackedVector3Array = _FA(arr[Mesh.ARRAY_VERTEX])
		for i in V.size():
			var p := V[i]
			if absf(p.x) > 0.2: # mangas (braço em T) ficam
				continue
			var k := _sino(absf(p.y - meio), raio_y * (1.25 if mais > 1.0 else 1.0)) * mais
			if k <= 0.0:
				continue
			var cz := 0.03
			var kz := 1.0 - (0.2 if p.z < cz else 0.1) * k
			var n := Vector3(p.x * (1.0 - 0.24 * k), p.y, cz + (p.z - cz) * kz)
			# direção de arte v8: o tecido entra no cinto. Na altura do cinto a blusa fica com a meia-largura dele
			# (de frente), afinando aos poucos 6 cm acima e 4 cm abaixo, sem degrau (a pele ainda manda: ver abaixo)
			var wc := 1.0 - smoothstep(0.015, 0.075, p.y - y_cinto) if p.y > y_cinto else 1.0 - smoothstep(0.015, 0.055, y_cinto - p.y)
			var xcap := X_CINTO - (0.004 if mais > 1.0 else 0.0)
			if wc > 0.0 and absf(n.x) > xcap:
				n.x = signf(n.x) * lerpf(absf(n.x), xcap, wc)
			var q := int(round(p.y * 100.0))
			for dq in [-1, 0, 1]: # a fatia de cima e a de baixo também (pele inclinada)
				var f = fat.get(q + dq)
				if f == null:
					continue
				var folga := 0.007
				if absf(n.x) < f[0] + folga and absf(p.x) >= f[0] + folga:
					n.x = signf(p.x) * (f[0] + folga)
				if p.z < cz and n.z > f[1] - folga and p.z <= f[1] - folga:
					n.z = f[1] - folga
				if p.z >= cz and n.z < f[2] + folga and p.z >= f[2] + folga:
					n.z = f[2] + folga
			V[i] = n
		if mais > 1.0: # saia de baixo: fecha junto com o saiote (fica por dentro das lâminas)
			V = _fechar_saia(V, R, -0.012)
		arr[Mesh.ARRAY_VERTEX] = _FA(V)
		var flags: int = orig.surface_get_format(sfc) & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS
		am.add_surface_from_arrays(orig.surface_get_primitive_type(sfc), arr, [], {}, flags)
		am.surface_set_material(sfc, orig.surface_get_material(sfc))
		am.surface_set_name(sfc, orig.surface_get_name(sfc))
	return am

# espada e cajado nas costas (presos no UpperChest): com capa, 9 cm mais para trás para não atravessar o pano
static func costas(esq: Skeleton3D, arma: Node3D, capa: bool) -> void:
	var b := esq.find_bone("J_Bip_C_UpperChest")
	if b < 0:
		return
	_orientar(esq)
	var v := esq.get_bone_global_rest(b).basis.inverse() * _F(Vector3(0, 0.02, -0.09))
	var agora: float = arma.get_meta("afastada", 0.0)
	var quer := 1.0 if capa else 0.0
	arma.position += v * (quer - agora)
	arma.set_meta("afastada", quer)

# a blusa e a saia do VRoid brigam com a armadura (xadrez, gravata): com a peça no corpo viram tecido liso
static func _uniforme(raiz: Node3D, equip: Dictionary) -> void:
	var troca := {"Tops": equip.get("corpo"), "Bottoms": equip.get("pernas")}
	for trecho in troca:
		var mi := _fonte(raiz, trecho)
		if mi == null:
			continue
		var it = troca[trecho]
		# todas as partes da roupa (vestidos dos outros corpos têm várias): senão a estampa original aparecia
		for sfc in mi.get_surface_override_material_count():
			if "Outline" in mi.mesh.surface_get_name(sfc):
				continue # contorno de desenho dos outros corpos fica escuro
			if it is Dictionary and PECAS.has(str(it.get("k", ""))):
				var r := clampi(int(it.get("r", 0)), 0, 4)
				if trecho == "Tops" and mi.has_meta("decote"):
					mi.set_surface_override_material(sfc, _material_decote(r, mi.get_meta("decote"), _cor_pele(raiz), mi.get_meta("decote_fem", true)))
				else:
					mi.set_surface_override_material(sfc, _material_tecido(r))
			elif trecho == "Tops":
				# André 2026-11-07: sem peitoral, no lugar da camiseta branca (2026-11-03) a blusa vira pele, com top
				# de biquíni na menina e peito nu no menino (biquini.gdshader)
				mi.set_surface_override_material(sfc, _material_biquini(raiz, mi.get_meta("decote_fem", true)))
			elif sfc == 0 or mi.get_surface_override_material(sfc) in _materiais.values():
				mi.set_surface_override_material(sfc, null) # só tira o que a armadura pôs (a cor da aparência fica)
	# André 2026-11-07: menino sem peitoral fica sem camisa. Se o corpo do VRoid tem o peito de pele de verdade
	# (desenho do peito e da barriga), a blusa some; senão (camiseta pintada na pele) ela vira pele (biquini.gdshader)
	var blusa := _fonte(raiz, "Tops")
	if blusa:
		var c = equip.get("corpo")
		var sem_peitoral := not (c is Dictionary and PECAS.has(str(c.get("k", ""))))
		var esq_b := _esqueleto(raiz)
		var tronco: Node = esq_b.get_node_or_null("Tronco") if esq_b else null
		blusa.visible = not (sem_peitoral and (_peito_de_pele(raiz) or tronco != null))
		if tronco:
			tronco.visible = sem_peitoral
	# André 2026-11-04 (print no jogo): com calça ou short de armadura, o short branco de baixo aparecia entre as
	# peças no meio das pernas (pose de espada, pernas abertas). Com peça nas pernas ele fica na cor da calça.
	var esq := _esqueleto(raiz)
	var base: Node = esq.get_node_or_null("Roupa_base") if esq else null
	if base:
		var pe = equip.get("pernas")
		var r_p := clampi(int(pe.get("r", 0)), 0, 4) if pe is Dictionary and PECAS.has(str(pe.get("k", ""))) else -1
		for mi in base.find_children("*", "MeshInstance3D", true, false):
			if mi.name == "Baixo" or mi.name == "Pele": # calcinha ou samba-canção: só sem peça nas pernas
				mi.visible = r_p < 0
			elif mi.name == "Top": # top de biquíni sobre a pele de verdade: só sem peitoral
				var c2 = equip.get("corpo")
				mi.visible = not (c2 is Dictionary and PECAS.has(str(c2.get("k", ""))))
			else: # short colado: debaixo da calça, na cor dela (sem calça fica escondido debaixo da roupa de baixo)
				mi.visible = r_p >= 0 or base.get_node_or_null("Baixo") == null
				mi.material_override = _material("calca", r_p) if r_p >= 0 else _material_base()
	# gravata some com peitoral de aço (a gola metálica fica no lugar dela)
	var gravata := _fonte(raiz, "Tie")
	if gravata:
		var p = equip.get("corpo")
		gravata.visible = false # André 2026-11-03: sem roupa padrão (antes sumia só com peitoral de aço)

static func _material_tecido(r: int) -> Material:
	var chave := "tecido:%d" % r
	if not _materiais.has(chave):
		var m := StandardMaterial3D.new()
		m.set_meta("armadura", true) # a aparência (cor da roupa) não troca o tecido da armadura
		m.albedo_color = ROUPA[r]
		m.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
		m.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
		m.roughness = 1.0
		m.rim_enabled = true
		m.rim = 0.2
		m.rim_tint = 0.6
		_materiais[chave] = m
	return _materiais[chave]

# equip "compacto" que vem do servidor para os outros jogadores: "peitoral3,capa1"
static func de_texto(t: String) -> Dictionary:
	var r := {}
	for p in t.split(",", false):
		var k := p.substr(0, p.length() - 1)
		if PECAS.has(k):
			var l: String = PECAS[k]
			r[l] = {"k": k, "r": clampi(int(p.right(1)), 0, 4)}
	return r

# velocidade do dono (m/s): a capa abre para trás correndo. Também sente a curva (o pano vai para fora) e o pulo
# (sobe na queda), com mola: na freada ela ainda balança um pouco antes de cair.
static func vento(raiz: Node3D, vel: float, dt: float) -> void:
	var esq := _esqueleto(raiz)
	if esq == null:
		return
	var no := esq.get_node_or_null("Armadura_capa")
	if no == null:
		return
	var mi: MeshInstance3D = no.get_meta("capa_mi", null)
	if mi == null:
		return
	dt = maxf(dt, 0.0001)
	var alvo := clampf(vel / 5.4, 0.0, 1.0)
	var a: float = no.get_meta("abre", 0.0)
	a = lerpf(a, alvo, 1.0 - exp(-dt * (5.0 if alvo > a else 2.5)))
	no.set_meta("abre", a)
	mi.set_instance_shader_parameter("abre", a)
	# giro do corpo (rad/s) e velocidade vertical (m/s), medidos pela raiz do personagem
	var fr := raiz.global_basis.z
	var ry := atan2(fr.x, fr.z)
	var ry0: float = no.get_meta("ry", ry)
	var giro := wrapf(ry - ry0, -PI, PI) / dt
	no.set_meta("ry", ry)
	var y0: float = no.get_meta("y", raiz.global_position.y)
	var vy := (raiz.global_position.y - y0) / dt
	no.set_meta("y", raiz.global_position.y)
	# molas: lado (curva) e sobe (queda); passam um pouco do ponto e voltam
	for q in [["lado", clampf(-giro * 0.22, -1.0, 1.0), 38.0, 7.0], ["sobe", clampf(-vy * 0.18, -1.0, 1.0), 30.0, 6.0]]:
		var x: float = no.get_meta(q[0], 0.0)
		var v: float = no.get_meta(q[0] + "_v", 0.0)
		var h := dt
		while h > 0.0:
			var p := minf(h, 1.0 / 60.0)
			h -= p
			v += ((float(q[1]) - x) * float(q[2]) - v * float(q[3])) * p
			x += v * p
		x = clampf(x, -1.0, 1.0)
		no.set_meta(q[0], x)
		no.set_meta(q[0] + "_v", v)
		mi.set_instance_shader_parameter(q[0], x)

static func _esqueleto(raiz: Node) -> Skeleton3D:
	var l := raiz.find_children("*", "Skeleton3D", true, false)
	return l[0] if l.size() > 0 else null

static func _fonte(raiz: Node3D, trecho: String) -> MeshInstance3D:
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh is ArrayMesh and mi.mesh.get_surface_count() > 0 and trecho in mi.mesh.surface_get_name(0): # as peças feitas em código (cilindro) não têm nome
			return mi
	return null

static func _montar(raiz: Node3D, esq: Skeleton3D, no: Node3D, k: String, r: int, tem_capa := false) -> void:
	for pm in pecas(k, r):
		var parte: String = pm[0]
		# v10 (André 2026-11-04): o saiote dá a volta inteira mesmo com capa (antes, com capa, ficava só a frente);
		# a capa se afasta um pouco mais embaixo para não furar (_malha_capa)
		var mat: String = pm[1]
		if parte == "capa":
			_montar_capa(raiz, esq, no, r)
			continue
		if parte == "elmo":
			_montar_elmo(raiz, esq, no, mat, r)
			continue
		if parte.begins_with("ombro"):
			_montar_ombreira(esq, no, 1.0 if parte == "ombro_e" else -1.0, mat, r)
			continue
		if parte == "cinto":
			_montar_cinto(raiz, esq, no, r)
			continue
		if parte == "cinto_quadril":
			_montar_cinto_quadril(raiz, esq, no, r)
			continue
		if parte == "tabardo":
			_montar_tabardo(raiz, esq, no, mat, r)
			continue
		var src := _fonte(raiz, REGIOES[parte].fonte)
		var temp: MeshInstance3D = null
		if src == null and REGIOES[parte].fonte == "Bottoms":
			# corpos de vestido (sem saia separada): o saiote nasce da barra do vestido, antes de a blusa virar camiseta
			var tops := _fonte(raiz, "Tops")
			if tops and tops.has_meta("malha_saia"):
				temp = MeshInstance3D.new()
				temp.mesh = tops.get_meta("malha_saia")
				temp.skin = tops.skin
				src = temp
		if src == null:
			continue
		var chave := "%d:%s" % [src.mesh.get_instance_id(), parte]
		if not _malhas.has(chave):
			_malhas[chave] = _casca(src, parte, esq)
			if parte.begins_with("saia") and _malhas[chave] != null and not _ref(esq).masc:
				_malhas[chave] = _alongar(_malhas[chave], _ref(esq), 1.5) # v11: saiote até o meio da coxa
		var am: ArrayMesh = _malhas[chave]
		if am == null:
			if temp:
				temp.free()
			continue
		var mi := MeshInstance3D.new()
		mi.mesh = am
		mi.skin = src.skin
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		no.add_child(mi)
		mi.skeleton = mi.get_path_to(esq)
		# v11b: no masculino o saiote vira placas de aço dos lados do quadril (a frente e as costas são do tabardo)
		var mat_f := mat
		if parte == "peito" and mat == "peito" and _ref(esq).masc:
			mat_f = "peito_reto"
		mi.material_override = _material(mat_f, r)
		if temp:
			temp.free()

# ---------- regiões (posição de descanso em T, metros; +x = esquerda do personagem, +z = frente) ----------
# off(p, b): quanto a casca sai do corpo naquele ponto (<= 0 = fora da peça). seg: coordenada das faixas (lâminas).
const REGIOES := {
	"peito": {"fonte": "Tops"}, "base_short": {"fonte": "Body_00"}, "base_pele": {"fonte": "Body_00"}, "base_calcinha": {"fonte": "Body_00"}, "base_calcinha_alta": {"fonte": "Body_00"}, "base_top": {"fonte": "Body_00"}, "base_samba": {"fonte": "Body_00"}, "ombro_e": {"fonte": "Tops"}, "ombro_d": {"fonte": "Tops"},
	"braco_e": {"fonte": "Tops"}, "braco_d": {"fonte": "Tops"}, 
	"canela_e": {"fonte": "Body_00"}, "canela_d": {"fonte": "Body_00"}, "cano_e": {"fonte": "Body_00"}, "cano_d": {"fonte": "Body_00"},
	"sapato": {"fonte": "Shoes"}, "sapato_couro": {"fonte": "Shoes"},
	"coxa_e": {"fonte": "Body_00"}, "coxa_d": {"fonte": "Body_00"}, "short_e": {"fonte": "Body_00"}, "short_d": {"fonte": "Body_00"}, "saia": {"fonte": "Bottoms"}, "saia_frente": {"fonte": "Bottoms"},
	"luva_e": {"fonte": "Body_00"}, "luva_d": {"fonte": "Body_00"}, "joelho_e": {"fonte": "Body_00"}, "joelho_d": {"fonte": "Body_00"},
	"peito_pe": {"fonte": "Shoes"},
}

class Ref:
	var y_cintura := 1.0
	var y_pescoco := 1.33
	var x_braco := 0.11
	var y_braco := 1.31
	var x_cotovelo := 0.33
	var x_mao := 0.535
	var y_joelho := 0.535
	var z_joelho := 0.0
	var y_pe := 0.106
	var p_braco := Vector3.ZERO # ombro, cotovelo e mão esquerdos na pose de descanso (manga justa)
	var p_cotovelo := Vector3.ZERO
	var p_mao := Vector3.ZERO
	var masc := false # corpo sem osso de busto: cintura de verdade fica abaixo do osso da coluna
	var y_coxa := 0.93 # alto da coxa (osso UpperLeg): a virilha fica uns 7 cm abaixo (roupa de baixo)
	var busto := Vector3.ZERO # osso do busto esquerdo (J_Sec_L_Bust1) na pose de descanso; zero no masculino

static func _ref(esq: Skeleton3D) -> Ref:
	var r := Ref.new()
	var p := func(n: String) -> Vector3:
		var b := esq.find_bone(n)
		return _F(esq.get_bone_global_rest(b).origin) if b >= 0 else Vector3.ZERO
	r.y_cintura = p.call("J_Bip_C_Spine").y
	r.y_pescoco = p.call("J_Bip_C_Neck").y
	r.x_braco = p.call("J_Bip_L_UpperArm").x
	r.y_braco = p.call("J_Bip_L_UpperArm").y
	r.x_cotovelo = p.call("J_Bip_L_LowerArm").x
	r.x_mao = p.call("J_Bip_L_Hand").x
	r.y_joelho = p.call("J_Bip_L_LowerLeg").y
	r.z_joelho = p.call("J_Bip_L_LowerLeg").z
	r.y_pe = p.call("J_Bip_L_Foot").y
	r.p_braco = p.call("J_Bip_L_UpperArm")
	r.p_cotovelo = p.call("J_Bip_L_LowerArm")
	r.p_mao = p.call("J_Bip_L_Hand")
	r.y_coxa = p.call("J_Bip_L_UpperLeg").y
	var busto: Vector3 = p.call("J_Sec_L_Bust1")
	r.busto = busto
	if busto != Vector3.ZERO:
		junta_peito = busto.y - 0.11 # base do busto ~8 cm abaixo do osso, mais 3 cm
	else:
		# corpos masculinos (sem osso de busto): a placa desce até a cintura (antes ficava o valor do último corpo
		# feminino montado e o peitoral saía curto, com a barriga de fora)
		r.masc = true
		junta_peito = r.y_cintura + 0.14
	return r

# altura da borda do decote em V (feminino) a uma distância ax do meio do peito
const DECOTE_FUNDO := 0.0 # quanto o V desce abaixo do pescoço (m). v10: 0,2; v11 (referência de couro e aço): fechado
const DECOTE_LARG := 0.105 # meia-largura do V na altura do pescoço (m)
static func _decote_y(ax: float, R: Ref) -> float:
	return R.y_pescoco - DECOTE_FUNDO * (1.0 - clampf(ax / DECOTE_LARG, 0.0, 1.0))

static func _sino(d: float, raio: float) -> float:
	var t := clampf(1.0 - d / raio, 0.0, 1.0)
	return t * t * (3.0 - 2.0 * t)

# devolve [offset, seg] ; offset <= 0 = fora
static func _regiao(parte: String, p: Vector3, R: Ref) -> Vector2:
	var ax := absf(p.x)
	var lado_ok := true
	if parte.ends_with("_e"):
		lado_ok = p.x > 0.0
	elif parte.ends_with("_d"):
		lado_ok = p.x < 0.0
	if not lado_ok:
		return Vector2(-1, 0)
	match parte:
		"peito":
			# do pescoço até a cintura, ponta em V na frente; não pega as mangas
			# do pescoço (gola metálica cobrindo a gola da blusa) até a cintura, ponta em V na frente; dos lados até a axila
			# André 2026-11-03: a placa vai só até ~8 cm abaixo do busto (ponta em V); a barriga e as mangas mostram o
			# tecido colorido por baixo, como na capa do Aethra (antes o tronco todo era casca e parecia traje espacial)
			# André 2026-11-03 (tarde): borda de baixo em ponta descendo até a cintura na frente, como na capa do
			# Aethra (antes era quase reta e lia redonda); atrás e dos lados fica 2 cm abaixo do busto
			# v8: a cintura fina deste corpo fica ~8 cm acima do osso da cintura (que está no quadril). A ponta desce
			# até o umbigo, encostando no cinto; dos lados e atrás a placa termina 1 cm abaixo da junta do busto
			var baixo := junta_peito + 0.01
			if R.masc:
				# v11 (referência de couro e aço): couraça até abaixo do peito, com ponta em V na frente; embaixo
				# aparece o corpete de couro da blusa
				baixo = R.y_cintura + 0.06 - (0.025 * (1.0 - clampf(ax / 0.07, 0.0, 1.0)) if p.z > 0.0 else 0.0) # v11c: encosta nos cintos
			elif p.z >= 0.0:
				baixo = minf(R.y_cintura + 0.072 + 0.6 * ax, baixo) # ponta no umbigo
			var lado_max := R.x_braco + (0.03 if p.y < R.y_braco - 0.07 else 0.005)
			if p.y < baixo or p.y > R.y_pescoco + 0.02 or ax > lado_max:
				return Vector2(-1, 0)
			# v10 (André 2026-11-04, "mais sensual, cavado no peito"): decote em V fundo na frente do corpo feminino,
			# descendo até o meio do busto; as bordas do V sobem retas até os ombros (nada arredondado)
			if not R.masc and p.z > 0.0 and p.y > _decote_y(ax, R):
				return Vector2(-1, 0)
			# v11 (referência de couro e aço): no feminino a placa cobre o busto (borda de cima em coração, ~8 cm abaixo
			# do pescoço) e deixa o colete de couro aparecer dos lados e no alto do peito
			if not R.masc:
				var topo_p := R.y_pescoco - 0.075 - 0.035 * (1.0 - clampf(ax / 0.045, 0.0, 1.0)) + 0.02 * clampf((ax - 0.05) / 0.05, 0.0, 1.0)
				if p.y > topo_p or ax > R.x_braco + 0.005:
					return Vector2(-1, 0)
			# 1,1 cm no busto; abaixo dele a placa cola (0,4 cm) e afina junto com a cintura
			var cola := clampf((junta_peito - p.y) / 0.04, 0.0, 1.0)
			return Vector2(lerpf(0.011, 0.004, cola), p.y) # a junta peito/barriga fica no shader (junta_y)
		"ombro_e", "ombro_d":
			# casco em cúpula no alto do braço e no ombro, por cima do peitoral
			var dx := ax - (R.x_braco + 0.04)
			if ax < R.x_braco - 0.035 or ax > R.x_braco + 0.14 or p.y < R.y_braco - 0.075 + 0.3 * maxf(0.0, ax - R.x_braco - 0.07):
				return Vector2(-1, 0)
			return Vector2(0.03 + 0.03 * _sino(Vector2(dx, p.y - R.y_braco - 0.03).length(), 0.11), ax)
		"braco_e", "braco_d":
			if ax < R.x_cotovelo + 0.035 or ax > R.x_mao - 0.02:
				return Vector2(-1, 0)
			# v10 (André 2026-11-04): o braço por baixo é segunda pele; a braçadeira fica grossa e robusta
			return Vector2(0.02 + 0.008 * _sino(ax - R.x_cotovelo - 0.1, 0.08), ax)
		"canela_e", "canela_d":
			# v10 (arte do Aethra): bota de cano alto até o meio da coxa, com a boca subindo em ponta na frente e
			# joelheira pontuda saltada
			# v11 (referência de couro e aço): greva só na frente da canela, da bota até a joelheira pontuda, que sobe
			# um palmo acima do joelho; atrás aparece a bota de couro
			# v11c (ficha técnica do André): a greva vai só da canela até 5 cm abaixo do joelho; a joelheira é outra peça
			if p.y > R.y_joelho - 0.05 or p.y < R.y_pe + 0.05 or ax > 0.2 or p.z < R.z_joelho - 0.012:
				return Vector2(-1, 0)
			return Vector2(0.014, -1.0)
		"joelho_e", "joelho_d":
			# joelheira: concha redonda na frente do joelho, saltada no meio
			var dj := Vector3(0.0, (p.y - R.y_joelho - 0.005) * 0.9, 0.0)
			if absf(dj.y) > 0.06 or p.z < R.z_joelho + 0.0 or ax > 0.2:
				return Vector2(-1, 0)
			return Vector2(0.016 + 0.014 * _sino(absf(dj.y), 0.06), p.y)
		"luva_e", "luva_d":
			# luva de couro sem dedos: do punho até a base dos dedos
			if ax < R.x_mao - 0.04 or ax > R.x_mao + 0.055:
				return Vector2(-1, 0)
			return Vector2(0.003, -1.0)
		"peito_pe":
			# placa de aço no peito do pé (o bico, o tornozelo e o calcanhar ficam de couro)
			if p.z < R.z_joelho + 0.03 or p.y < R.y_pe - 0.06 or p.y > R.y_pe + 0.03:
				return Vector2(-1, 0)
			if p.y < R.y_pe - 0.075 + 0.25 * maxf(0.0, p.z - R.z_joelho - 0.03):
				return Vector2(-1, 0)
			return Vector2(0.012, p.z)
		"cano_e", "cano_d":
			# André 2026-11-05 (sets de couro): o cano sobe até 5 cm do joelho (antes 12 cm: aparecia a perna entre a
			# joelheira e a bota)
			if p.y > R.y_joelho - (0.05 if COURO_EM_TUDO else 0.12) or p.y < R.y_pe - 0.01 or ax > 0.16:
				return Vector2(-1, 0)
			return Vector2(0.011, p.y)
		"coxa_e", "coxa_d":
			# masculino: o osso da coluna fica mais alto; a calça sobe até a cintura (antes o bumbum ficava de fora)
			if p.y < R.y_joelho - 0.03 or p.y > R.y_cintura - (0.03 if R.masc else 0.12) or ax > 0.17:
				return Vector2(-1, 0)
			return Vector2(0.006, p.y)
		"short_e", "short_d":
			# só a coxa de cima: termina um palmo acima do joelho
			if p.y < R.y_joelho + 0.17 or p.y > R.y_cintura - (0.03 if R.masc else 0.12) or ax > 0.17:
				return Vector2(-1, 0)
			return Vector2(0.007, p.y)
		"base_short":
			# short colado: do quadril até o meio da coxa (cobre a barra da camiseta)
			if p.y > R.y_cintura - (0.0 if R.masc else 0.05) or p.y < lerpf(R.y_joelho, R.y_cintura, 0.45) or ax > 0.2:
				return Vector2(-1, 0)
			return Vector2(0.0025, -1.0)
		"base_top":
			# top de biquíni sobre o peito de pele de verdade: a casca cobre o tronco de cima e o biquini.gdshader
			# desenha só o pano (triângulos, faixa e alças)
			if p.y < R.busto.y - 0.09 or p.y > R.y_pescoco + 0.05 or ax > R.x_braco - 0.005:
				return Vector2(-1, 0)
			return Vector2(0.003, -1.0)
		"base_pele":
			# a Ruiva não tem pele do quadril até a coxa (era a saia, e nas costas a blusa acaba mais alto): pele pintada da cintura ao alto da coxa,
			# por baixo da calcinha
			if p.y > R.y_cintura + 0.02 or p.y < R.y_coxa - 0.11 or ax > 0.2:
				return Vector2(-1, 0)
			return Vector2(0.0015, -1.0)
		"base_calcinha", "base_calcinha_alta":
			# André 2026-11-07: sem calça, a menina fica de calcinha de biquíni. Cós baixo no quadril, cavada dos
			# lados (sobe até o osso do quadril) e atrás cobre o bumbum
			var virilha := R.y_coxa - 0.07
			var tras := smoothstep(0.02, -0.04, p.z)
			var topo_c := R.y_cintura - 0.07 # logo abaixo da barra da blusa (ela por cima piscava com a calcinha)
			if parte == "base_calcinha_alta":
				topo_c = R.y_cintura - 0.025 # sem blusa: sobe e cobre a calcinha branca desenhada na textura do corpo
			var lado := smoothstep(0.025, 0.13, ax)
			var fundo_c := virilha + lerpf(lerpf(0.0, 0.085, lado), lerpf(-0.015, 0.035, lado), tras)
			if p.y > topo_c or p.y < fundo_c or ax > 0.17:
				return Vector2(-1, 0)
			return Vector2(0.006, -1.0) # bem acima da pele pintada (mais perto piscava)
		"base_samba":
			# André 2026-11-07: sem calça, o menino fica de samba-canção: folgado, da cintura até o meio da coxa,
			# com listras finas (seg = ângulo em volta do quadril, como as lâminas do saiote)
			if p.y > R.y_cintura - 0.02 or p.y < lerpf(R.y_joelho, R.y_coxa, 0.5) or ax > 0.17:
				return Vector2(-1, 0)
			return Vector2(0.009, atan2(p.x, p.z) * 0.16 + 0.1)
		"saia", "saia_frente":
			# placas verticais (lâminas) em volta do quadril; começa abaixo da barra da blusa (que cobre o alto da saia)
			# saia_frente (com capa): só a frente e os lados; atrás fica o pano da capa
			# v10 (André 2026-11-04): atrás o saiote sobe até a barra da blusa (antes ficava um vão com a roupa
			# branca aparecendo e o saiote parecia solto); na frente continua onde estava
			var topo_s := R.y_cintura - lerpf(0.05, 0.02, smoothstep(0.0, -0.06, p.z))
			if p.y > topo_s or (parte == "saia_frente" and p.z < -0.02):
				return Vector2(-1, 0)
			# masculino: a calça do VRoid vai até o pé; o saiote para no meio da coxa
			if R.masc and p.y < lerpf(R.y_joelho, R.y_cintura, 0.5):
				return Vector2(-1, 0)
			# v11b (André 2026-11-04, "parece um bujão"): no masculino só os lados (placas de aço em lâminas
			# horizontais sobre o quadril); frente e costas ficam com o tabardo de couro
			# v11c (ficha técnica): no masculino a túnica de couro faz o papel do saiote (dividida dos lados)
			if R.masc:
				return Vector2(-1, 0)
			return Vector2(0.016, atan2(p.x, p.z) * 0.16 + 0.1) # 5 lâminas (faixa 0,2 no material "saia")
		"sapato":
			return Vector2(0.01, p.z)
		"sapato_couro":
			return Vector2(0.006, p.z)
	return Vector2(-1, 0)

# ---------- malha soldada (sem costuras de UV: um vértice por posição) ----------
class Solda:
	var pos := PackedVector3Array()
	var nor := PackedVector3Array()
	var pesos := [] # Dictionary osso -> peso
	var tris := PackedInt32Array()

static func _soldar(src: MeshInstance3D) -> Solda:
	var id := src.mesh.get_instance_id()
	if _soldas.has(id):
		return _soldas[id]
	var a := src.mesh.surface_get_arrays(0)
	var V: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
	var N: PackedVector3Array = a[Mesh.ARRAY_NORMAL]
	var B: PackedInt32Array = a[Mesh.ARRAY_BONES]
	var W: PackedFloat32Array = a[Mesh.ARRAY_WEIGHTS]
	var I: PackedInt32Array = a[Mesh.ARRAY_INDEX]
	var por := V.size()
	var nb: int = B.size() / max(1, por)
	var s := Solda.new()
	var mapa := {}
	var novo := PackedInt32Array()
	novo.resize(por)
	for i in por:
		var q := Vector3i(roundi(V[i].x * 4000.0), roundi(V[i].y * 4000.0), roundi(V[i].z * 4000.0))
		if mapa.has(q):
			var j: int = mapa[q]
			novo[i] = j
			s.nor[j] += _F(N[i])
		else:
			var j := s.pos.size()
			mapa[q] = j
			novo[i] = j
			s.pos.append(_F(V[i]))
			s.nor.append(_F(N[i]))
			var d := {}
			for k in nb:
				var w := W[i * nb + k]
				if w > 0.0:
					d[B[i * nb + k]] = d.get(B[i * nb + k], 0.0) + w
			s.pesos.append(d)
	for j in s.nor.size():
		s.nor[j] = s.nor[j].normalized()
	if I.is_empty():
		I.resize(por)
		for i in por:
			I[i] = i
	for t in range(0, I.size(), 3):
		var x := novo[I[t]]
		var y := novo[I[t + 1]]
		var z := novo[I[t + 2]]
		if x != y and y != z and x != z:
			s.tris.append(x)
			s.tris.append(y)
			s.tris.append(z)
	_soldas[id] = s
	return s

static func _misturar(a: Dictionary, b: Dictionary) -> Dictionary:
	var d := {}
	for k in a:
		d[k] = a[k] * 0.5
	for k in b:
		d[k] = d.get(k, 0.0) + b[k] * 0.5
	return d

static func _aresta(a: int, b: int) -> int:
	return mini(a, b) * 1000003 + maxi(a, b)

# ---------- a casca ----------
static func _casca(src: MeshInstance3D, parte: String, esq: Skeleton3D) -> ArrayMesh:
	var S := _soldar(src)
	var R := _ref(esq)
	# 1) triângulos da região
	var dentro := {}
	var reg := {}
	for i in S.pos.size():
		var g := _regiao(parte, S.pos[i], R)
		if g.x > 0.0:
			reg[i] = g
	var pos := PackedVector3Array()
	var nor := PackedVector3Array()
	var pesos := []
	var off := PackedFloat32Array()
	var seg := PackedFloat32Array()
	var tris := PackedInt32Array()
	var novo := {}
	var pega := func(i: int) -> int:
		if not novo.has(i):
			novo[i] = pos.size()
			pos.append(S.pos[i])
			nor.append(S.nor[i])
			pesos.append(S.pesos[i])
			off.append(reg[i].x)
			seg.append(reg[i].y)
		return novo[i]
	for t in range(0, S.tris.size(), 3):
		var a := S.tris[t]
		var b := S.tris[t + 1]
		var c := S.tris[t + 2]
		if reg.has(a) and reg.has(b) and reg.has(c):
			tris.append(pega.call(a))
			tris.append(pega.call(b))
			tris.append(pega.call(c))
	if tris.size() < 9:
		return null
	# 2) subdivide uma vez (borda mais lisa, friso mais fino)
	var meio := {}
	var t2 := PackedInt32Array()
	var mid := func(a: int, b: int) -> int:
		var k := _aresta(a, b)
		if not meio.has(k):
			meio[k] = pos.size()
			var p := (pos[a] + pos[b]) * 0.5
			pos.append(p)
			nor.append((nor[a] + nor[b]).normalized())
			pesos.append(_misturar(pesos[a], pesos[b]))
			var g := _regiao(parte, p, R)
			off.append(g.x if g.x > 0.0 else (off[a] + off[b]) * 0.5)
			seg.append(g.y if g.x > 0.0 else (seg[a] + seg[b]) * 0.5)
		return meio[k]
	for t in range(0, tris.size(), 3):
		var a := tris[t]
		var b := tris[t + 1]
		var c := tris[t + 2]
		var ab: int = mid.call(a, b)
		var bc: int = mid.call(b, c)
		var ca: int = mid.call(c, a)
		t2.append_array([a, ab, ca, ab, b, bc, ca, bc, c, ab, bc, ca])
	tris = t2
	var n := pos.size()
	# 3) vizinhos e bordas
	var viz := []
	viz.resize(n)
	for i in n:
		viz[i] = {}
	var uso := {}
	for t in range(0, tris.size(), 3):
		for e in 3:
			var a := tris[t + e]
			var b := tris[t + (e + 1) % 3]
			viz[a][b] = true
			viz[b][a] = true
			var k := _aresta(a, b)
			uso[k] = uso.get(k, 0) + 1
	var borda := PackedByteArray()
	borda.resize(n)
	var viz_borda := []
	viz_borda.resize(n)
	var arestas_borda := []
	for t in range(0, tris.size(), 3):
		for e in 3:
			var a := tris[t + e]
			var b := tris[t + (e + 1) % 3]
			if uso[_aresta(a, b)] == 1:
				borda[a] = 1
				borda[b] = 1
				arestas_borda.append(Vector2i(a, b))
				if viz_borda[a] == null:
					viz_borda[a] = []
				if viz_borda[b] == null:
					viz_borda[b] = []
				viz_borda[a].append(b)
				viz_borda[b].append(a)
	# 4) contorno liso: a borda segue a malha em zigue-zague; alisa só ao longo dela
	for it in 6:
		var np := pos.duplicate()
		for i in n:
			if borda[i] and viz_borda[i] != null and viz_borda[i].size() == 2:
				np[i] = pos[i].lerp((pos[viz_borda[i][0]] + pos[viz_borda[i][1]]) * 0.5, 0.5)
		pos = np
	# 5) empurra para fora e alisa (placa lisa, sem o desenho do corpo); nunca menos que 60% do afastamento
	var base := pos.duplicate()
	for i in n:
		pos[i] = base[i] + nor[i] * off[i]
	# o peitoral alisava 20 vezes e virava um barril (André: "tá gordão"); agora segue o busto e a cintura
	# a roupa de baixo (3 mm da pele) não alisa: alisar escorrega os vértices pela curva do busto e a casca entra na pele
	# v11c (ficha técnica): no masculino a placa do peito é reta e plana, sem volume marcado: alisa bem mais
	for it in ((24 if R.masc else 7) if parte == "peito" else (0 if parte.begins_with("base") else 8)):
		var np := pos.duplicate()
		for i in n:
			if borda[i]:
				continue
			var m := Vector3.ZERO
			for j in viz[i]:
				m += pos[j]
			m /= viz[i].size()
			np[i] = pos[i].lerp(m, 0.6)
		for i in n:
			var d := (np[i] - base[i]).dot(nor[i])
			if d < off[i] * 0.6:
				np[i] += nor[i] * (off[i] * 0.6 - d)
		pos = np
	# saiote: as lâminas abriam quase na horizontal (tutu) e alargavam o quadril; agora abrem no máximo ~17 graus
	if parte.begins_with("saia"):
		pos = _fechar_saia(pos, R)
		base = _fechar_saia(base, R, -0.012)
	# 6) distância até a borda (friso) por relaxamento nas arestas
	var dist := PackedFloat32Array()
	dist.resize(n)
	for i in n:
		dist[i] = 0.0 if borda[i] else 1.0
	for it in 14:
		var mudou := false
		for i in n:
			if borda[i]:
				continue
			for j in viz[i]:
				var d: float = dist[j] + pos[i].distance_to(pos[j])
				if d < dist[i] - 0.0001:
					dist[i] = d
					mudou = true
		if not mudou:
			break
	# borda dobrada para fora (aba enrolada)
	for i in n:
		pos[i] += nor[i] * (0.0 if parte.begins_with("base") else 0.004) * _sino(dist[i], 0.012)
	if parte == "peito" and not R.masc:
		# quina do esterno (capa do Aethra, direção de arte): a placa sobe ~7 mm numa linha vertical no meio da
		# frente, do colarinho até a ponta do V, com um filete de friso dourado em cima dela
		for i in n:
			if pos[i].z <= 0.0 or pos[i].y > R.y_pescoco - 0.03:
				continue
			var ax := absf(pos[i].x)
			pos[i] += nor[i] * 0.007 * _sino(ax, 0.03)
			dist[i] = minf(dist[i], ax + 0.0065)
	# 7) normais do resultado
	var vn := PackedVector3Array()
	vn.resize(n)
	for t in range(0, tris.size(), 3):
		var a := tris[t]
		var b := tris[t + 1]
		var c := tris[t + 2]
		var f := (pos[b] - pos[a]).cross(pos[c] - pos[a])
		vn[a] += f
		vn[b] += f
		vn[c] += f
	var lado := 0.0
	for i in n:
		lado += vn[i].dot(nor[i])
	var sinal := 1.0 if lado >= 0.0 else -1.0
	for i in n:
		vn[i] = (vn[i] * sinal).normalized()
		if vn[i] == Vector3.ZERO:
			vn[i] = nor[i]
	if parte == "peito":
		# placa do peito: normal de um elipsoide achatado (frente/trás) misturada à da malha, para o toon dar
		# uma faixa de sombra limpa no lado oposto à luz em vez de manchas no busto
		var lo := pos[0]
		var hi := pos[0]
		for i in n:
			lo = lo.min(pos[i])
			hi = hi.max(pos[i])
		var c := (lo + hi) * 0.5
		var rad := ((hi - lo) * 0.5).max(Vector3(0.05, 0.05, 0.05))
		rad.y *= 1.6 # mais alto que largo: as faixas ficam verticais
		for i in n:
			var d := pos[i] - c
			var en := Vector3(d.x / (rad.x * rad.x), d.y / (rad.y * rad.y), d.z / (rad.z * rad.z)).normalized()
			if en.dot(vn[i]) < 0.0:
				continue
			vn[i] = vn[i].lerp(en, 0.3).normalized() # pouco: o reflexo desenha o busto e a cintura, não uma bola
	# 8) arrays: casca + parede da borda (espessura)
	var V := PackedVector3Array(pos)
	var Nn := PackedVector3Array(vn)
	var U2 := PackedVector2Array()
	for i in n:
		U2.append(Vector2(dist[i], seg[i]))
	var P := pesos.duplicate()
	var I := PackedInt32Array(tris)
	for e in arestas_borda:
		var a: int = e.x
		var b: int = e.y
		var k := V.size()
		var fora := ((pos[a] + pos[b]) * 0.5 - (base[a] + base[b]) * 0.5).normalized()
		var lateral := (pos[b] - pos[a]).cross(nor[a]).normalized()
		if lateral.dot(pos[a] - _centro(pos, tris, a)) < 0.0:
			lateral = -lateral
		var nl := (lateral * 0.8 + fora * 0.2).normalized()
		V.append_array([pos[a], pos[b], base[a] + nor[a] * 0.002, base[b] + nor[b] * 0.002])
		Nn.append_array([nl, nl, nl, nl])
		U2.append_array([Vector2(0, seg[a]), Vector2(0, seg[b]), Vector2(0, seg[a]), Vector2(0, seg[b])])
		P.append_array([pesos[a], pesos[b], pesos[a], pesos[b]])
		I.append_array([k, k + 2, k + 1, k + 1, k + 2, k + 3])
	# pesos em 4 ossos
	var Bo := PackedInt32Array()
	var We := PackedFloat32Array()
	for d in P:
		var ks: Array = d.keys()
		ks.sort_custom(func(x, y): return d[x] > d[y])
		var soma := 0.0
		for q in mini(4, ks.size()):
			soma += d[ks[q]]
		for q in 4:
			if q < ks.size():
				Bo.append(ks[q])
				We.append(d[ks[q]] / maxf(soma, 0.0001))
			else:
				Bo.append(0)
				We.append(0.0)
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = _FA(V) # de volta ao espaço do modelo
	arr[Mesh.ARRAY_NORMAL] = _FA(Nn)
	arr[Mesh.ARRAY_TEX_UV2] = U2
	arr[Mesh.ARRAY_BONES] = Bo
	arr[Mesh.ARRAY_WEIGHTS] = We
	arr[Mesh.ARRAY_INDEX] = I
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return am

static func _centro(pos: PackedVector3Array, tris: PackedInt32Array, a: int) -> Vector3:
	# centro aproximado da peça perto do vértice a (para saber o lado de fora da parede)
	var c := Vector3.ZERO
	var k := 0
	for t in range(0, mini(tris.size(), 600), 3):
		c += pos[tris[t]]
		k += 1
	return c / maxf(k, 1)

# ---------- ombreira: duas lâminas em cúpula presas no braço (como na capa do Aethra) ----------
static func _preso(esq: Skeleton3D, no: Node3D, osso: String) -> BoneAttachment3D:
	var ba := BoneAttachment3D.new()
	no.add_child(ba)
	ba.use_external_skeleton = true
	ba.external_skeleton = ba.get_path_to(esq)
	ba.bone_name = osso
	return ba

# cinto (direção de arte v7): faixa de 3 cm logo abaixo da ponta do peitoral, colada na blusa já apertada, com
# fivela na frente. A malha da blusa é grossa demais para recortar uma faixa tão fina, então o anel é feito aqui:
# para cada ângulo, o raio é o da blusa naquela altura (+3 mm), e o anel vai preso no osso da cintura.
const X_CINTO := 0.104 # meia-largura da blusa dentro do cinto (m), de frente
const CINTO := [Color("5a3e28"), Color("3e2a1a"), Color("150c07")] # v11: couro marrom # v10: couro vermelho-escuro (arte do Aethra)

static func _montar_cinto(raiz: Node3D, esq: Skeleton3D, no: Node3D, r: int) -> void:
	var b := esq.find_bone("J_Bip_C_Spine")
	var tops := _fonte(raiz, "Tops")
	if b < 0 or tops == null:
		return
	var R := _ref(esq)
	var ba := _preso(esq, no, "J_Bip_C_Spine")
	var rest := esq.get_bone_global_rest(b)
	# v11c (ficha técnica do André): faixas e cintos largos sobrepostos abaixo do peitoral, fivelas quadradas
	for desce in [0.0, 0.046]:
		_cinto_em(tops, R, r, ba, rest, desce)

static func _cinto_em(tops: MeshInstance3D, R: Ref, r: int, ba: Node3D, rest: Transform3D, desce: float) -> void:
	var chave := "cinto:%d:%s:%.3f" % [tops.mesh.get_instance_id(), R.masc, desce]
	if not _malhas.has(chave):
		_malhas[chave] = _malha_cinto(tops.mesh, R, desce)
	if _malhas[chave][0] == null:
		return
	var mi := MeshInstance3D.new()
	mi.mesh = _malhas[chave][0]
	mi.material_override = _material("cinto_set" if COURO_EM_TUDO and r >= 1 else "cinto", r)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	mi.transform = rest.affine_inverse() * _G()
	ba.add_child(mi)
	var fv := MeshInstance3D.new()
	fv.mesh = _malhas[chave][1]
	fv.material_override = _material("fecho", r)
	fv.transform = rest.affine_inverse() * _G()
	ba.add_child(fv)

static func _malha_cinto(tops: Mesh, R: Ref, desce := 0.0) -> Array:
	var y1 := R.y_cintura + (0.02 if R.masc else 0.07) - desce # na parte mais fina da cintura, encostando na ponta do V (o osso fica no quadril)
	var y0 := y1 - 0.042 # v11: cinto mais largo (4,2 cm), de couro marrom
	var V: PackedVector3Array = _FA(tops.surface_get_arrays(0)[Mesh.ARRAY_VERTEX])
	var zmin := 9.0
	var zmax := -9.0
	for p in V:
		if p.y > y0 - 0.01 and p.y < y1 + 0.01 and absf(p.x) < 0.2:
			zmin = minf(zmin, p.z)
			zmax = maxf(zmax, p.z)
	if zmin > zmax:
		return [null, null]
	var cz := (zmin + zmax) * 0.5
	var NA := 48
	var raio := PackedFloat32Array()
	raio.resize(NA)
	for p in V:
		if p.y < y0 - 0.004 or p.y > y1 + 0.004 or absf(p.x) > 0.2: # só a faixa: 1 cm abaixo a blusa já abre no quadril
			continue
		var a := atan2(p.x, p.z - cz)
		var i := posmod(int(round(a / TAU * NA)), NA)
		raio[i] = maxf(raio[i], Vector2(p.x, p.z - cz).length())
	# ângulos sem vértice: média dos vizinhos; depois alisa (a blusa tem poucos vértices na cintura)
	for it in NA:
		for i in NA:
			if raio[i] <= 0.0:
				var a0 := raio[(i + NA - 1) % NA]
				var a1 := raio[(i + 1) % NA]
				raio[i] = maxf(a0, a1)
	for it in 3:
		var nr := raio.duplicate()
		for i in NA:
			nr[i] = maxf(raio[i], (raio[(i + NA - 1) % NA] + raio[i] * 2.0 + raio[(i + 1) % NA]) * 0.25)
		raio = nr
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	# perfil: borda de cima dobrando para dentro, faixa, borda de baixo (couro grosso, 3 mm)
	var perfil := [[y1, -0.003], [y1 - 0.002, 0.003], [y0 + 0.002, 0.003], [y0, -0.003]]
	var pts := []
	for i in NA + 1:
		var a := TAU * float(i) / NA
		var d := Vector2(sin(a), cos(a))
		var rr: float = raio[i % NA]
		var linha := []
		for pf in perfil:
			var q: float = rr + 0.003 + float(pf[1])
			linha.append(Vector3(d.x * q, float(pf[0]), cz + d.y * q))
		pts.append(linha)
	for i in NA:
		for j in perfil.size() - 1:
			var a: Vector3 = pts[i][j]
			var b2: Vector3 = pts[i + 1][j]
			var c: Vector3 = pts[i + 1][j + 1]
			var d2: Vector3 = pts[i][j + 1]
			for v in [a, c, d2, a, b2, c]: # v10: frente para fora (antes o contorno de desenho cobria o cinto de preto)
				var dn := Vector3(v.x, 0.0, v.z - cz).normalized()
				st.set_normal(dn)
				st.set_uv(Vector2(float(i) / NA, (v.y - y0) / 0.03))
				st.set_uv2(Vector2(0.05, -1.0)) # longe da borda: sem friso nem lâminas
				st.add_vertex(v)
	var anel := st.commit()
	# fivela: placa retangular na frente (4 x 3,4 cm), um pouco saltada
	var rf: float = raio[0] + 0.009
	var fz := cz + rf
	var bx := BoxMesh.new()
	bx.size = Vector3(0.04, 0.034, 0.006)
	var st2 := SurfaceTool.new()
	st2.create_from(bx, 0)
	var fv := ArrayMesh.new()
	var arr := st2.commit_to_arrays()
	var P: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	for i in P.size():
		P[i] += Vector3(0, (y0 + y1) * 0.5, fz)
	arr[Mesh.ARRAY_VERTEX] = P
	fv.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return [anel, fv]

static func _montar_ombreira(esq: Skeleton3D, no: Node3D, lado: float, mat: String, r: int) -> void:
	var osso := "J_Bip_L_UpperArm" if lado > 0.0 else "J_Bip_R_UpperArm"
	var b := esq.find_bone(osso)
	if b < 0:
		return
	var chave := "ombro3:%s" % lado
	if not _malhas.has(chave):
		_malhas[chave] = _malha_ombreira(lado)
	var ba := _preso(esq, no, osso)
	var mi := MeshInstance3D.new()
	mi.mesh = _malhas[chave]
	mi.material_override = _material(mat, r)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	var R := _ref(esq)
	var rest := esq.get_bone_global_rest(b)
	# centro da cúpula: um pouco para fora e acima da junta do ombro (espaço do personagem em T)
	var c := Vector3(lado * (R.x_braco + 0.035), R.y_braco + 0.008, _F(rest.origin).z - 0.004)
	# direção de arte v7: 25% menores e inclinadas 10 graus para baixo, acompanhando o ombro (alargavam o tronco)
	# v10 (arte do Aethra): ombreiras grandes de três lâminas, 15 graus para baixo (antes 75% e 10 graus)
	# v11b (André: "ficou muito quadrado"): 12% menores e mais caídas (22 graus), acompanhando o ombro
	var giro := Basis(Vector3(0, 0, 1), -lado * deg_to_rad(22.0)).scaled(Vector3.ONE * 0.84)
	mi.transform = rest.affine_inverse() * _G() * Transform3D(giro, c)
	ba.add_child(mi)
	# v11 (referência de couro e aço): crista em ponta no alto da ombreira, inclinada para fora
	if false: # v11c (ficha técnica): três placas arredondadas, sem crista em ponta (v11 tinha)
		var ponta := MeshInstance3D.new()
		var cone := CylinderMesh.new()
		cone.top_radius = 0.0
		cone.bottom_radius = 0.024
		cone.height = 0.075
		cone.radial_segments = 4 # quatro faces: lâmina, não cone liso
		cone.rings = 1
		ponta.mesh = cone
		ponta.material_override = _material(mat, r)
		ponta.transform = Transform3D(Basis(Vector3(0, 0, 1), lado * deg_to_rad(75.0)).scaled(Vector3(0.5, 1.0, 1.0)), Vector3(lado * 0.03, 0.105 * 0.82 * 1.06 + 0.02, 0.0))
		mi.add_child(ponta)

# malha em volta do eixo x (o braço em T): lâmina de cima maior e uma menor embaixo, sobrepostas
static func _malha_ombreira(lado: float) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	# x0, x1 (em semi-eixos), escala, ângulo máx (rad): a de cima grande e a de baixo saindo por baixo dela
	var placas := [[-0.7, 0.36, 1.06, 2.0], [0.22, 0.72, 0.95, 1.85], [0.6, 1.02, 0.86, 1.72]]
	var A := 0.142 * 0.82 # direção de arte v2: 18% menores que na v1
	var B := 0.105 * 0.82
	var NU := 22
	var NV := 10
	var k := 0
	for pl in placas:
		var x0: float = pl[0]
		var x1: float = pl[1]
		var esc: float = pl[2]
		var tm: float = pl[3]
		var pts := []
		for j in NV + 1:
			var fx := lerpf(x0, x1, float(j) / NV)
			var rr := B * esc * sqrt(maxf(0.04, 1.0 - fx * fx * 0.85))
			# v11b: a borda de baixo de cada lâmina abre para fora (lâbio), como placa martelada, não caixa
			rr *= 1.0 + 0.1 * smoothstep(0.55, 1.0, (fx - x0) / (x1 - x0))
			# borda arredondada (raio ~2 cm) nas pontas da lâmina: o casco se curva para dentro, não termina reto como caixa
			var ponta := minf(fx - x0, x1 - fx) * A
			var u := clampf(1.0 - ponta / 0.02, 0.0, 1.0)
			rr -= 0.02 * (1.0 - sqrt(1.0 - u * u))
			var linha := []
			for i in NU + 1:
				var th := lerpf(-tm, tm, float(i) / NU)
				var p := Vector3(lado * fx * A, cos(th) * rr, sin(th) * rr * 1.08)
				var dist := minf(minf((tm - absf(th)) * rr, (fx - x0) * A), (x1 - fx) * A)
				linha.append([p, dist])
			pts.append(linha)
		for j in NV:
			for i in NU:
				var q := [pts[j][i], pts[j][i + 1], pts[j + 1][i], pts[j + 1][i + 1]]
				var ordem := [0, 1, 2, 1, 3, 2] if lado > 0.0 else [0, 2, 1, 1, 2, 3]
				for o in ordem:
					st.set_uv2(Vector2(q[o][1], -1.0))
					st.add_vertex(q[o][0])
		k += 1
	st.generate_normals()
	return st.commit()

# v10 (André 2026-11-04): a blusa abre no mesmo V do peitoral, 1,5 cm mais estreito (fica uma faixa do tecido
# escuro fazendo a borda do decote). A pele do VRoid por baixo da blusa é só um rascunho (quase sem vértices), então
# o V é pintado na própria blusa, por pixel (decote.gdshader), com a cor da pele.
static func _cor_pele(raiz: Node3D) -> Color:
	if raiz.has_meta("pele_cor"): # cor da pele escolhida na aparência (Aparencia.aplicar)
		return raiz.get_meta("pele_cor")
	var corpo := _fonte(raiz, "Body_00")
	if corpo:
		var m = corpo.mesh.surface_get_material(0)
		if m is StandardMaterial3D and m.albedo_texture:
			return preload("res://aparencia.gd").media(m.albedo_texture, true) * Color(1.0, 0.9, 0.84)
	return Color(0.98, 0.84, 0.76)

static func _decote(orig: ArrayMesh, R: Ref) -> ArrayMesh:
	var am := ArrayMesh.new()
	for sfc in orig.get_surface_count():
		var arr := orig.surface_get_arrays(sfc)
		var V: PackedVector3Array = _FA(arr[Mesh.ARRAY_VERTEX])
		var u2 := PackedVector2Array()
		u2.resize(V.size())
		for i in V.size():
			var q := Vector3(absf(V[i].x), V[i].y, V[i].z)
			var x := q.x if V[i].z > 0.0 else q.x + 10.0 # +10: costas (sem decote)
			if R.p_mao != Vector3.ZERO:
				var e := _eixo_braco(q, R)
				if float(e[0]) > 0.1 and float(e[2]) < 0.1:
					x = 20.0 + float(e[0]) # +20: manga (t de 0 a 2 ao longo do braço)
			u2[i] = Vector2(x, V[i].y)
		arr[Mesh.ARRAY_TEX_UV2] = u2
		var flags: int = orig.surface_get_format(sfc) & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS
		am.add_surface_from_arrays(orig.surface_get_primitive_type(sfc), arr, [], {}, flags)
		am.surface_set_material(sfc, orig.surface_get_material(sfc))
		am.surface_set_name(sfc, orig.surface_get_name(sfc))
	return am

static func _material_decote(r: int, y_pescoco: float, pele: Color, fem := true) -> Material:
	var chave := "decote:%d:%.3f:%s:%s" % [r, y_pescoco, pele.to_html(), fem]
	if not _materiais.has(chave):
		var m := ShaderMaterial.new()
		m.shader = preload("res://decote.gdshader")
		m.set_meta("armadura", true) # a aparência (cor da roupa) não troca o tecido da armadura
		m.set_shader_parameter("tecido", ROUPA[r])
		m.set_shader_parameter("pele", pele)
		m.set_shader_parameter("y_pescoco", y_pescoco)
		m.set_shader_parameter("fundo", DECOTE_FUNDO if fem else 0.0)
		m.set_shader_parameter("colete", COLETE[r])
		m.set_shader_parameter("largura", DECOTE_LARG)
		_materiais[chave] = m
	return _materiais[chave]

# Manga justa: cada vértice da manga vai para no máximo "folga" acima da pele do braço. O braço é medido pelos ossos
# (ombro, cotovelo, mão: serve para corpo em T e em A), em fatias ao longo dele. Perto do ombro a mudança some aos poucos.
static func _eixo_braco(q: Vector3, R: Ref) -> Array: # [t de 0 (ombro) a 2 (mão), ponto do eixo]
	var melhor := [0.0, R.p_braco, INF]
	var segs := [[R.p_braco, R.p_cotovelo, 0.0], [R.p_cotovelo, R.p_mao, 1.0]]
	for sg in segs:
		var a: Vector3 = sg[0]
		var b: Vector3 = sg[1]
		var ab := b - a
		var u := clampf((q - a).dot(ab) / maxf(ab.length_squared(), 1e-6), 0.0, 1.0)
		var c := a + ab * u
		var d := q.distance_to(c)
		if d < melhor[2]:
			melhor = [float(sg[2]) + u, c, d]
	return melhor

static func _manga_justa(orig: ArrayMesh, R: Ref, corpo: Mesh, folga: float) -> ArrayMesh:
	if R.p_mao == Vector3.ZERO:
		return orig
	var NB := 32
	var raio := PackedFloat32Array()
	raio.resize(NB)
	var CV: PackedVector3Array = _FA(corpo.surface_get_arrays(0)[Mesh.ARRAY_VERTEX])
	for p in CV:
		var q := Vector3(absf(p.x), p.y, p.z)
		var e := _eixo_braco(q, R)
		var t: float = e[0]
		if t < 0.12 or t > 1.97 or float(e[2]) > 0.08:
			continue
		var bi := clampi(int(t / 2.0 * NB), 0, NB - 1)
		raio[bi] = maxf(raio[bi], float(e[2]))
	for it in 2: # fatias vazias: copia a vizinha
		for bi in NB:
			if raio[bi] <= 0.0:
				raio[bi] = maxf(raio[maxi(bi - 1, 0)], raio[mini(bi + 1, NB - 1)])
	var am := ArrayMesh.new()
	for sfc in orig.get_surface_count():
		var arr := orig.surface_get_arrays(sfc)
		var V: PackedVector3Array = _FA(arr[Mesh.ARRAY_VERTEX])
		for i in V.size():
			var p := V[i]
			var sx := signf(p.x)
			var q := Vector3(absf(p.x), p.y, p.z)
			var e := _eixo_braco(q, R)
			var t: float = e[0]
			if t < 0.12 or t > 1.97:
				continue
			var bi := clampi(int(t / 2.0 * NB), 0, NB - 1)
			if raio[bi] <= 0.0:
				continue
			var c: Vector3 = e[1]
			var d := q - c
			var alvo: float = raio[bi] + folga
			if d.length() <= alvo:
				continue
			var peso := smoothstep(0.12, 0.35, t)
			var n := c + d.normalized() * lerpf(d.length(), alvo, peso)
			V[i] = Vector3(n.x * (sx if sx != 0.0 else 1.0), n.y, n.z)
		arr[Mesh.ARRAY_VERTEX] = _FA(V)
		var flags: int = orig.surface_get_format(sfc) & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS
		am.add_surface_from_arrays(orig.surface_get_primitive_type(sfc), arr, [], {}, flags)
		am.surface_set_material(sfc, orig.surface_get_material(sfc))
		am.surface_set_name(sfc, orig.surface_get_name(sfc))
	return am

# v10: o capuz (o que fica atrás e acima do pescoço) vira uma gola baixa, colada na nuca
static func _sem_capuz(orig: ArrayMesh, R: Ref) -> ArrayMesh:
	var am := ArrayMesh.new()
	for sfc in orig.get_surface_count():
		var arr := orig.surface_get_arrays(sfc)
		var V: PackedVector3Array = _FA(arr[Mesh.ARRAY_VERTEX])
		var y0 := R.y_pescoco - 0.035
		for i in V.size():
			var p := V[i]
			if p.y < y0 or absf(p.x) > R.x_braco + 0.02:
				continue
			# para dentro do pescoço e para baixo (escondido pela gola da couraça)
			var c := Vector3(0.0, y0 - 0.03, -0.005)
			V[i] = c + (p - c) * Vector3(0.3, 0.15, 0.3)
		# cordões do capuz: ilhas pequenas de malha na frente do peito, que a couraça copiava em relevo
		var I: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
		if I.size() > 0:
			var pai := PackedInt32Array()
			pai.resize(V.size())
			for i in V.size():
				pai[i] = i
			var raiz_de := func(x: int) -> int:
				while pai[x] != x:
					pai[x] = pai[pai[x]]
					x = pai[x]
				return x
			for t in range(0, I.size(), 3):
				var a: int = raiz_de.call(I[t])
				for q in [1, 2]:
					var b: int = raiz_de.call(I[t + q])
					if a != b:
						pai[b] = a
			var soma := {}
			for i in V.size():
				var k: int = raiz_de.call(i)
				if not soma.has(k):
					soma[k] = [Vector3.ZERO, 0]
				soma[k][0] += V[i]
				soma[k][1] += 1
			for i in V.size():
				var k: int = raiz_de.call(i)
				var n: int = soma[k][1]
				var m: Vector3 = soma[k][0] / n
				if n < V.size() / 20 and absf(m.x) < 0.1 and m.y > R.y_cintura and m.y < R.y_pescoco and m.z > 0.0:
					V[i] = Vector3(0.0, m.y, m.z - 0.08) # some para dentro do peito
		arr[Mesh.ARRAY_VERTEX] = _FA(V)
		var flags: int = orig.surface_get_format(sfc) & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS
		am.add_surface_from_arrays(orig.surface_get_primitive_type(sfc), arr, [], {}, flags)
		am.surface_set_material(sfc, orig.surface_get_material(sfc))
		am.surface_set_name(sfc, orig.surface_get_name(sfc))
	return am

# estica para baixo o que fica abaixo do alto da peça (saiote mais comprido que a saia do VRoid)
static func _alongar(orig: ArrayMesh, R: Ref, fator: float) -> ArrayMesh:
	var am := ArrayMesh.new()
	for sfc in orig.get_surface_count():
		var arr := orig.surface_get_arrays(sfc)
		var V: PackedVector3Array = _FA(arr[Mesh.ARRAY_VERTEX])
		var topo := -INF
		for p in V:
			topo = maxf(topo, p.y)
		for i in V.size():
			var p := V[i]
			var y := topo - (topo - p.y) * fator
			# abre um pouco embaixo, para a barra não entrar na coxa
			var k := 1.0 + 0.08 * clampf((topo - y) / 0.25, 0.0, 1.0) * (fator - 1.0)
			V[i] = Vector3(p.x * k, y, p.z * k)
		arr[Mesh.ARRAY_VERTEX] = _FA(V)
		var flags: int = orig.surface_get_format(sfc) & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS
		am.add_surface_from_arrays(orig.surface_get_primitive_type(sfc), arr, [], {}, flags)
		am.surface_set_material(sfc, orig.surface_get_material(sfc))
		am.surface_set_name(sfc, orig.surface_get_name(sfc))
	return am

# ---------- tabardo (v11b, referência de couro e aço) ----------
# Duas abas de couro (frente e costas) caindo do cinto até um palmo acima do joelho, um pouco mais estreitas
# embaixo, com a borda gasta e costura. Cada vértice copia os pesos da pele: em cima, do ponto mais perto; embaixo,
# metade de cada coxa (a aba fica no meio das duas pernas quando o personagem anda).
static func _montar_tabardo(raiz: Node3D, esq: Skeleton3D, no: Node3D, mat: String, r: int) -> void:
	var corpo := _fonte(raiz, "Body_00")
	if corpo == null:
		return
	var R := _ref(esq)
	if not R.masc:
		return # no feminino o saiote de couro já faz esse papel (a aba por cima ficava parecendo um bolso)
	var chave := "tabardo:%d" % corpo.mesh.get_instance_id()
	if not _malhas.has(chave):
		_malhas[chave] = _malha_tabardo(corpo, raiz, R)
	var mi := MeshInstance3D.new()
	mi.mesh = _malhas[chave]
	mi.skin = corpo.skin
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	no.add_child(mi)
	mi.skeleton = mi.get_path_to(esq)
	mi.material_override = _material(mat, r)

static func _malha_tabardo(corpo: MeshInstance3D, raiz: Node3D, R: Ref) -> ArrayMesh:
	var S := _soldar(corpo)
	# contorno da frente e de trás (pele e saia/calça) por fatia de 1 cm, no meio do corpo
	var fontes := [S.pos]
	var saia := _fonte(raiz, "Bottoms")
	if saia and saia.mesh and R.masc: # a saia do VRoid (feminino) é larga e fica escondida: só a pele
		fontes.append(_FA(saia.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]))
	var yt := R.y_cintura - (0.02 if R.masc else 0.02) # começa por baixo do cinto de baixo
	var yb := lerpf(R.y_joelho, R.y_cintura, 0.42) # v11c (ficha técnica): até o meio da coxa
	var frente := {}
	var tras := {}
	for V in fontes:
		for p in V:
			if absf(p.x) > 0.11 or p.y > yt + 0.03 or p.y < yb - 0.03:
				continue
			var q := int(round(p.y * 100.0))
			frente[q] = maxf(frente.get(q, -9.0), p.z)
			tras[q] = minf(tras.get(q, 9.0), p.z)
	var perto := [] # vértices da pele perto do quadril e das coxas (para os pesos)
	for i in S.pos.size():
		var p := S.pos[i]
		if absf(p.x) < 0.2 and p.y < yt + 0.06 and p.y > yb - 0.06:
			perto.append(i)
	var peso_em := func(alvo: Vector3) -> Dictionary:
		var melhor := -1
		var dm := INF
		for i in perto:
			var d: float = S.pos[i].distance_squared_to(alvo)
			if d < dm:
				dm = d
				melhor = i
		return S.pesos[melhor] if melhor >= 0 else {}
	var gancho := lerpf(yb, yt, 0.62) # abaixo daqui a aba fica entre as duas pernas
	var NX := 8
	var NY := 16
	var V := PackedVector3Array()
	var U2 := PackedVector2Array()
	var P := []
	var I := PackedInt32Array()
	var folga := 0.022 if R.masc else 0.03
	for lado in [1.0, -1.0]: # frente, costas
		var base := V.size()
		var z_ant := -9.0
		for j in NY + 1:
			var t := float(j) / NY
			var y := lerpf(yt, yb, t)
			var q := int(round(y * 100.0))
			var z := -9.0
			for dq in [0, -1, 1]:
				var m = (frente if lado > 0.0 else tras).get(q + dq)
				if m != null:
					z = maxf(z, m * lado)
			z = maxf(z, z_ant) # cai reto: nunca volta para dentro descendo
			if not R.masc:
				z = maxf(z, z_ant + 0.3 * (yt - yb) / NY) # por cima do saiote que abre embaixo
				if j == 0:
					z += 0.012
			z_ant = z
			var meia := lerpf(0.15 if R.masc else 0.12, 0.14 if R.masc else 0.11, t) # dividida só nos lados
			for i in NX + 1:
				var x := lerpf(-meia, meia, float(i) / NX)
				var zz: float = (z + folga - 3.2 * x * x * (1.0 - 0.4 * t)) * lado # curva em volta do quadril
				var p := Vector3(x, y, zz)
				V.append(p)
				var dist := minf(minf(meia - absf(x), y - yb), yt - y)
				U2.append(Vector2(dist, -1.0))
				var w := smoothstep(gancho + 0.04, gancho - 0.04, y)
				var pc: Dictionary = peso_em.call(Vector3(x, y, zz - 0.03 * lado))
				var pm: Dictionary = _misturar(peso_em.call(Vector3(0.08, y, zz - 0.03 * lado)), peso_em.call(Vector3(-0.08, y, zz - 0.03 * lado)))
				var d := {}
				for k in pc:
					d[k] = pc[k] * (1.0 - w)
				for k in pm:
					d[k] = d.get(k, 0.0) + pm[k] * w
				P.append(d)
		for j in NY:
			for i in NX:
				var a := base + j * (NX + 1) + i
				var b := a + 1
				var c := a + NX + 1
				var d2 := c + 1
				if lado > 0.0: # sentido horário visto de fora (frente da face no Godot)
					I.append_array([a, b, c, b, d2, c])
				else:
					I.append_array([a, c, b, b, c, d2])
	var Bo := PackedInt32Array()
	var We := PackedFloat32Array()
	for d in P:
		var ks: Array = d.keys()
		ks.sort_custom(func(x, y): return d[x] > d[y])
		var soma := 0.0
		for q in mini(4, ks.size()):
			soma += d[ks[q]]
		for q in 4:
			if q < ks.size():
				Bo.append(ks[q])
				We.append(d[ks[q]] / maxf(soma, 0.0001))
			else:
				Bo.append(0)
				We.append(0.0)
	# normais lisas
	var Nn := PackedVector3Array()
	Nn.resize(V.size())
	for t in range(0, I.size(), 3):
		var n := (V[I[t + 2]] - V[I[t]]).cross(V[I[t + 1]] - V[I[t]]) # para fora
		for e in 3:
			Nn[I[t + e]] += n
	for i in Nn.size():
		Nn[i] = Nn[i].normalized()
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = _FA(V)
	arr[Mesh.ARRAY_NORMAL] = _FA(Nn)
	arr[Mesh.ARRAY_TEX_UV2] = U2
	arr[Mesh.ARRAY_BONES] = Bo
	arr[Mesh.ARRAY_WEIGHTS] = We
	arr[Mesh.ARRAY_INDEX] = I
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return am

# ---------- cinto de quadril (v10, arte do Aethra) ----------
# Faixa de couro vermelho caída na diagonal por cima do saiote (alta à direita, baixa à esquerda), com bolsa e
# fivela de ouro do lado baixo. Presa no osso do quadril.
static func _montar_cinto_quadril(raiz: Node3D, esq: Skeleton3D, no: Node3D, r: int) -> void:
	var b := esq.find_bone("J_Bip_C_Hips")
	var corpo := _fonte(raiz, "Body_00")
	var saia := _fonte(raiz, "Bottoms")
	if b < 0 or corpo == null:
		return
	var R := _ref(esq)
	# por fora da saia (a Ruiva) ou do corpo; a saia do VRoid fica escondida, mas a malha dela ainda dá o contorno
	if saia and not R.masc:
		corpo = saia
	var chave := "cinto_quadril:%d:%s" % [corpo.mesh.get_instance_id(), R.masc]
	if not _malhas.has(chave):
		_malhas[chave] = _malha_cinto_quadril(corpo.mesh, R)
	if _malhas[chave] == null:
		return
	var ba := _preso(esq, no, "J_Bip_C_Hips")
	var rest := esq.get_bone_global_rest(b)
	var pecas_q: Array = _malhas[chave]
	var mats := ["cinto_quadril", "cinto_quadril", "fecho"]
	for i in pecas_q.size():
		var mi := MeshInstance3D.new()
		mi.mesh = pecas_q[i]
		mi.material_override = _material(mats[i], r)
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		mi.transform = rest.affine_inverse() * _G()
		ba.add_child(mi)

static func _malha_cinto_quadril(corpo: Mesh, R: Ref) -> Array:
	var yc := R.y_cintura - (0.13 if R.masc else 0.085) # meio da faixa
	var incl := 0.035 # meia-diferença de altura entre os lados
	var alt := 0.04
	var V: PackedVector3Array = _FA(corpo.surface_get_arrays(0)[Mesh.ARRAY_VERTEX])
	var NA := 48
	var raio := PackedFloat32Array()
	raio.resize(NA)
	var zs := 0.0
	var n := 0
	for p in V:
		if absf(p.y - yc) < 0.06 and absf(p.x) < 0.22:
			zs += p.z
			n += 1
	if n == 0:
		return []
	var cz := zs / n
	for p in V:
		if absf(p.x) > 0.22:
			continue
		var a := atan2(p.x, p.z - cz)
		var yl := yc + incl * sin(a)
		if absf(p.y - yl) > alt:
			continue
		var i := posmod(int(round(a / TAU * NA)), NA)
		raio[i] = maxf(raio[i], Vector2(p.x, p.z - cz).length())
	for it in NA:
		for i in NA:
			if raio[i] <= 0.0:
				raio[i] = maxf(raio[(i + NA - 1) % NA], raio[(i + 1) % NA])
	for it in 3:
		var nr := raio.duplicate()
		for i in NA:
			nr[i] = maxf(raio[i], (raio[(i + NA - 1) % NA] + raio[i] * 2.0 + raio[(i + 1) % NA]) * 0.25)
		raio = nr
	var folga := 0.03 # por fora do saiote (que sai 1,6 cm do corpo)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var perfil := [[alt * 0.5, -0.003], [alt * 0.5 - 0.002, 0.003], [-alt * 0.5 + 0.002, 0.003], [-alt * 0.5, -0.003]]
	var pts := []
	for i in NA + 1:
		var a := TAU * float(i) / NA
		var d := Vector2(sin(a), cos(a))
		# atrás, embaixo da capa, a faixa encosta no saiote (senão furava o pano)
		var rr: float = raio[i % NA] + folga * (1.0 - smoothstep(1.9, 2.6, absf(wrapf(a, -PI, PI))))
		var yl := yc + incl * sin(a)
		var linha := []
		for pf in perfil:
			var q: float = rr + float(pf[1])
			linha.append(Vector3(d.x * q, yl + float(pf[0]), cz + d.y * q))
		pts.append(linha)
	for i in NA:
		for j in perfil.size() - 1:
			var a: Vector3 = pts[i][j]
			var b2: Vector3 = pts[i + 1][j]
			var c: Vector3 = pts[i + 1][j + 1]
			var d2: Vector3 = pts[i][j + 1]
			for v in [a, c, d2, a, b2, c]:
				st.set_normal(Vector3(v.x, 0.0, v.z - cz).normalized())
				st.set_uv2(Vector2(0.05, -1.0))
				st.add_vertex(v)
	var anel := st.commit()
	# bolsa de couro no lado baixo (esquerda do personagem, um pouco para a frente)
	var ab := -PI * 0.42
	var db := Vector2(sin(ab), cos(ab))
	var rb: float = raio[posmod(int(round(ab / TAU * NA)), NA)] + folga + 0.022
	var yb := yc + incl * sin(ab) - 0.03
	var cb := Vector3(db.x * rb, yb, cz + db.y * rb)
	var base := Basis(Vector3.UP, ab)
	var bolsa := _caixa(Vector3(0.075, 0.07, 0.035), Transform3D(base, cb))
	var tampa := _caixa(Vector3(0.08, 0.035, 0.04), Transform3D(base, cb + Vector3(0, 0.03, 0) + base * Vector3(0, 0, 0.004)))
	var st2 := SurfaceTool.new()
	st2.append_from(bolsa, 0, Transform3D.IDENTITY)
	st2.append_from(tampa, 0, Transform3D.IDENTITY)
	var bolsas := st2.commit()
	# fivela de ouro na frente, no meio da descida
	var af := PI * 0.12
	var dfv := Vector2(sin(af), cos(af))
	var rf: float = raio[posmod(int(round(af / TAU * NA)), NA)] + folga + 0.005
	var fivela := _caixa(Vector3(0.036, 0.032, 0.006), Transform3D(Basis(Vector3.UP, af).rotated(Vector3(dfv.x, 0, dfv.y), -0.25), Vector3(dfv.x * rf, yc + incl * sin(af), cz + dfv.y * rf)))
	return [anel, bolsas, fivela]

static func _caixa(tam: Vector3, t: Transform3D) -> ArrayMesh:
	var bx := BoxMesh.new()
	bx.size = tam
	var st := SurfaceTool.new()
	st.create_from(bx, 0)
	var arr := st.commit_to_arrays()
	var P: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var N: PackedVector3Array = arr[Mesh.ARRAY_NORMAL]
	var U2 := PackedVector2Array()
	U2.resize(P.size())
	for i in P.size():
		P[i] = t * P[i]
		N[i] = t.basis * N[i]
		U2[i] = Vector2(0.05, -1.0)
	arr[Mesh.ARRAY_VERTEX] = P
	arr[Mesh.ARRAY_NORMAL] = N
	arr[Mesh.ARRAY_TEX_UV2] = U2
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return am

# ---------- capa ----------
const CAPA_COLS := 14
const CAPA_LINHAS := 18

static func _montar_capa(raiz: Node3D, esq: Skeleton3D, no: Node3D, r: int) -> void:
	var osso := esq.find_bone("J_Bip_C_UpperChest")
	if osso < 0:
		return
	var src := _fonte(raiz, "Tops")
	var chave := "%d:capa" % (src.mesh.get_instance_id() if src else 0)
	if not _malhas.has(chave):
		_malhas[chave] = _malha_capa(src, esq, osso)
	var ba := BoneAttachment3D.new()
	no.add_child(ba)
	# o BoneAttachment fica dentro do nó da peça (não é filho direto do esqueleto): usa o esqueleto "de fora"
	ba.use_external_skeleton = true
	ba.external_skeleton = ba.get_path_to(esq)
	ba.bone_name = "J_Bip_C_UpperChest"
	var mi := MeshInstance3D.new()
	mi.mesh = _malhas[chave]
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	mi.material_override = _material("capa", r)
	mi.extra_cull_margin = 0.6
	if no is PanoCapa:
		# cada capa tem a grade dela no material (o pano de cada jogador balança do seu jeito)
		var mat: ShaderMaterial = (_material("capa", r) as ShaderMaterial).duplicate()
		var g := _grade_capa(mi.mesh)
		mat.set_shader_parameter("grade0", g)
		mat.set_shader_parameter("grade", g)
		mat.set_shader_parameter("pano", 1.0)
		mi.material_override = mat
		mi.extra_cull_margin = 1.5
	# a malha foi feita no espaço do personagem em T; o osso em descanso leva para lá
	mi.transform = esq.get_bone_global_rest(osso).affine_inverse() * _G()
	ba.add_child(mi)
	no.set_meta("capa_mi", mi)
	if no is PanoCapa:
		no.preparar(esq, mi, mi.material_override.get_shader_parameter("grade0"))
	# v11 (referência de couro e aço): gola de pano da capa enrolada no pescoço
	var gola := MeshInstance3D.new()
	var Rg := _ref(esq)
	var chave_g := "gola:%.3f" % Rg.y_pescoco
	if not _malhas.has(chave_g):
		_malhas[chave_g] = _malha_gola(Rg)
	gola.mesh = _malhas[chave_g]
	gola.material_override = _material_gola(r)
	gola.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	gola.transform = esq.get_bone_global_rest(osso).affine_inverse() * _G()
	ba.add_child(gola)
	# v11c (ficha técnica do André): a capa fecha num broche redondo de metal no peito esquerdo (+x)
	var zb := 0.06
	if src:
		var Rb := _ref(esq)
		for p in _FA(src.mesh.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]):
			if absf(p.x - 0.075) < 0.03 and absf(p.y - (Rb.y_pescoco - 0.075)) < 0.03:
				zb = maxf(zb, p.z)
	for s in [1.0]:
		var f := MeshInstance3D.new()
		var cil := CylinderMesh.new()
		cil.top_radius = 0.022
		cil.bottom_radius = 0.026
		cil.height = 0.012
		cil.radial_segments = 16
		cil.rings = 1
		f.mesh = cil
		f.material_override = _material("fecho", r)
		var R := _ref(esq)
		f.transform = esq.get_bone_global_rest(osso).affine_inverse() * _G() * Transform3D(Basis(Vector3.RIGHT, PI * 0.5).rotated(Vector3.RIGHT, -0.25), Vector3(s * 0.075, R.y_pescoco - 0.075, zb + 0.022))
		ba.add_child(f)

# gola: anel de pano grosso em volta do pescoço, mais largo embaixo, com duas dobras (pose de descanso, canônico)
static func _malha_gola(R: Ref) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var NA := 32
	var dobras := [[R.y_pescoco - 0.06, 0.105, 0.0], [R.y_pescoco - 0.035, 0.098, 0.006], [R.y_pescoco - 0.01, 0.082, 0.0], [R.y_pescoco + 0.025, 0.07, 0.004], [R.y_pescoco + 0.045, 0.064, -0.006]]
	var cz := -0.01
	var pts := []
	for i in NA + 1:
		var a := TAU * float(i) / NA
		var d := Vector2(sin(a), cos(a))
		var linha := []
		for f in dobras:
			var rr: float = float(f[1]) + float(f[2])
			# na frente desce um pouco (o pano cai sobre o peito)
			var y: float = float(f[0]) - 0.02 * maxf(0.0, d.y) * (1.0 if f == dobras[0] else 0.4)
			linha.append(Vector3(d.x * rr * 1.05, y, cz + d.y * rr))
		pts.append(linha)
	for i in NA:
		for j in dobras.size() - 1:
			var a: Vector3 = pts[i][j]
			var b: Vector3 = pts[i + 1][j]
			var c: Vector3 = pts[i + 1][j + 1]
			var d2: Vector3 = pts[i][j + 1]
			for v in [a, c, d2, a, b, c]:
				st.add_vertex(v)
	st.generate_normals()
	return st.commit()

static func _material_gola(r: int) -> Material:
	var chave := "gola:%d" % r
	if not _materiais.has(chave):
		var m := StandardMaterial3D.new()
		m.albedo_color = CAPA[r][0].darkened(0.35) # o shader da capa escurece o pano; a gola acompanha
		m.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
		m.specular_mode = BaseMaterial3D.SPECULAR_DISABLED
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
		m.roughness = 1.0
		m.rim_enabled = true
		m.rim = 0.2
		m.rim_tint = 0.6
		var o := StandardMaterial3D.new()
		o.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		o.cull_mode = BaseMaterial3D.CULL_FRONT
		o.grow = true
		o.grow_amount = 0.004
		o.albedo_color = Color(0.1, 0.08, 0.09)
		m.next_pass = o
		_materiais[chave] = m
	return _materiais[chave]

# pontos da grade do pano (pano_capa.gd): vértices de fora da malha nas colunas 0, 2, ... 14 e linhas 0, 3, ... 18
static func _grade_capa(m: Mesh) -> PackedVector3Array:
	var V: PackedVector3Array = m.surface_get_arrays(0)[Mesh.ARRAY_VERTEX]
	var g := PackedVector3Array()
	var pc: int = PanoCapa.COLS
	var pl: int = PanoCapa.LINHAS
	for j in pl:
		for i in pc:
			g.append(V[(j * CAPA_LINHAS / (pl - 1)) * (CAPA_COLS + 1) + i * CAPA_COLS / (pc - 1)])
	return g

# costas do corpo na altura y: o z mais de trás da blusa (para a capa não atravessar)
static func _costas(S: Solda, y: float, x: float) -> float:
	var z := 0.0
	for i in S.pos.size():
		var p := S.pos[i]
		if absf(p.y - y) < 0.03 and absf(p.x - x) < 0.05:
			z = minf(z, p.z)
	return z

static func _malha_capa(src: MeshInstance3D, esq: Skeleton3D, osso: int) -> ArrayMesh:
	var R := _ref(esq)
	var S: Solda = _soldar(src) if src else null
	var topo_y := R.y_pescoco - 0.025
	var costas := _costas(S, R.y_braco - 0.06, 0.0) if S else -0.1
	var costas_q := -0.15
	var quadril := esq.find_bone("J_Bip_C_Hips")
	if quadril >= 0:
		costas_q = _F(esq.get_bone_global_rest(quadril).origin).z - 0.14 # nádegas ficam ~14 cm atrás do quadril
	var comp := topo_y - (R.y_pe + 0.2) # v11 (referência de couro e aço): capa longa, até o meio da canela
	var V := PackedVector3Array()
	var Nn := PackedVector3Array()
	var U := PackedVector2Array()
	var C := PackedVector3Array() # ponto de cima de cada coluna (o pano dobra em volta dele)
	var I := PackedInt32Array()
	for j in CAPA_LINHAS + 1:
		var t := float(j) / CAPA_LINHAS
		for i in CAPA_COLS + 1:
			var s := float(i) / CAPA_COLS * 2.0 - 1.0
			var y := topo_y - comp * t
			# em cima abraça os ombros, embaixo abre em leque
			var larg := lerpf(0.13, 0.3, pow(t, 0.7))
			var x := s * larg
			var curva := (1.0 - s * s)
			var z_topo := costas - 0.035 + 0.06 * (1.0 - curva)
			var z_baixo := costas_q - 0.09 # folga do saiote, que agora dá a volta inteira (v10)
			var z := lerpf(z_topo, z_baixo, smoothstep(0.0, 0.45, t)) - 0.04 * curva * t
			# dobras verticais do pano, mais fundas embaixo
			z += 0.022 * t * sin(s * PI * 3.0)
			# v6 (direção de arte): pontas de baixo arredondadas (raio 8 cm) e barra levemente ondulada (3 cm),
			# para a ponta não parecer tábua correndo
			var dx := (1.0 - absf(s)) * larg
			var rr := 0.08
			if dx < rr:
				y += (rr - sqrt(maxf(0.0, rr * rr - (rr - dx) * (rr - dx)))) * smoothstep(0.82, 1.0, t)
			y += 0.03 * sin(s * PI * 3.5 + 0.6) * smoothstep(0.85, 1.0, t) * 0.5
			# v10 (arte do Aethra): barra rasgada em pontas. Só as colunas ímpares sobem (as pares são pontos da
			# grade do pano em pano_capa.gd e ficam onde estavam); a penúltima linha acompanha um pouco
			if i % 2 == 1 and t > 0.9:
				var corte := 0.05 + 0.04 * absf(sin(float(i) * 2.7))
				y += corte * (1.0 if j == CAPA_LINHAS else 0.3)
			if t == 0.0:
				# borda de cima sobe pelos ombros
				y += 0.03 * (1.0 - curva)
				z += 0.07 * (1.0 - curva)
			V.append(Vector3(x, y, z))
			U.append(Vector2(float(i) / CAPA_COLS, t))
			C.append(Vector3(x, topo_y, z_topo))
	for j in CAPA_LINHAS:
		for i in CAPA_COLS:
			var a := j * (CAPA_COLS + 1) + i
			var b := a + 1
			var c := a + CAPA_COLS + 1
			var d := c + 1
			I.append_array([a, b, c, b, d, c])
	Nn.resize(V.size())
	for t in range(0, I.size(), 3):
		var f := (V[I[t + 1]] - V[I[t]]).cross(V[I[t + 2]] - V[I[t]])
		for q in 3:
			Nn[I[t + q]] += f
	for i in Nn.size():
		Nn[i] = Nn[i].normalized()
		if Nn[i].z > 0.0: # normal para fora (para trás)
			Nn[i] = -Nn[i]
	# pano grosso (1,5 cm): camada de fora, camada de dentro e as bordas dos lados e de baixo
	var n := V.size()
	var V2 := PackedVector3Array(V)
	var N2 := PackedVector3Array(Nn)
	var U2 := PackedVector2Array(U)
	var C2 := C.duplicate()
	var cor := PackedColorArray()
	for i in n:
		cor.append(Color(1, 0, 0)) # fora
	for i in n:
		V2.append(V[i] - Nn[i] * 0.015)
		N2.append(-Nn[i])
		U2.append(U[i])
		C2.append(C[i])
		cor.append(Color(0, 0, 0)) # dentro
	var I2 := PackedInt32Array(I)
	for t in range(0, I.size(), 3):
		I2.append_array([I[t] + n, I[t + 2] + n, I[t + 1] + n])
	var borda := func(a: int, b: int) -> void:
		var k := V2.size()
		var nb := (V[b] - V[a]).cross(Nn[a]).normalized()
		for q in [a, b, a + n, b + n]:
			V2.append(V2[q])
			N2.append(nb)
			U2.append(U[q % n])
			C2.append(C[q % n])
			cor.append(Color(0.5, 0, 0)) # beirada
		I2.append_array([k, k + 2, k + 1, k + 1, k + 2, k + 3])
	for j in CAPA_LINHAS:
		borda.call(j * (CAPA_COLS + 1), (j + 1) * (CAPA_COLS + 1))
		borda.call((j + 1) * (CAPA_COLS + 1) + CAPA_COLS, j * (CAPA_COLS + 1) + CAPA_COLS)
	for i in CAPA_COLS:
		var base := CAPA_LINHAS * (CAPA_COLS + 1)
		borda.call(base + i + 1, base + i)
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = V2
	arr[Mesh.ARRAY_NORMAL] = N2
	arr[Mesh.ARRAY_TEX_UV] = U2
	arr[Mesh.ARRAY_COLOR] = cor
	arr[Mesh.ARRAY_INDEX] = I2
	# UV2: z e y do alto da coluna, para o shader girar o pano em volta da borda de cima
	var u2 := PackedVector2Array()
	for p in C2:
		u2.append(Vector2(p.z, p.y))
	arr[Mesh.ARRAY_TEX_UV2] = u2
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	return am

# ---------- materiais ----------
const CALCA := [Color("4a3324"), Color("2a2230"), Color("2a2238"), Color("2c2226"), Color("2a1a22")] # couro da calça por raridade

static func _material(tipo: String, r: int) -> Material:
	var chave := "%s:%d" % [tipo, r]
	if _materiais.has(chave):
		return _materiais[chave]
	var m: Material
	if tipo == "calca":
		var c := StandardMaterial3D.new()
		c.albedo_color = CALCA[r]
		c.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
		c.specular_mode = BaseMaterial3D.SPECULAR_TOON
		c.roughness = 0.55 # um brilho pequeno de couro
		c.rim_enabled = true
		c.rim = 0.2
		c.rim_tint = 0.6
		var o := StandardMaterial3D.new() # contorno de desenho igual ao das outras peças
		o.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		o.cull_mode = BaseMaterial3D.CULL_FRONT
		o.grow = true
		o.grow_amount = 0.005
		o.albedo_color = Color(0.1, 0.08, 0.09)
		c.next_pass = o
		_materiais[chave] = c
		return c
	if tipo == "capa":
		var s := ShaderMaterial.new()
		s.shader = SHADER_CAPA
		s.set_shader_parameter("fora", CAPA[r][0])
		s.set_shader_parameter("dentro", CAPA[r][1])
		s.set_shader_parameter("friso", FRISO[r][0])
		s.set_shader_parameter("brilho", BRILHO[r])
		m = s
	else:
		var s := ShaderMaterial.new()
		s.shader = SHADER_METAL
		var c3: Array = METAL[r]
		if tipo == "couro" or tipo == "elmo_couro":
			c3 = COURO if r == 0 or COURO_EM_TUDO else COURO_ESCURO
		elif tipo == "couro_set" or tipo == "cinto_set":
			c3 = COURO_SET[r] # couro tingido na cor do set
		elif tipo == "couro_escuro":
			c3 = COURO_ESCURO
		elif tipo == "couro_marrom":
			c3 = COURO_MARROM
		elif tipo == "couro_tunica":
			c3 = [Color("6a4a30"), Color("3c2718"), Color("150d07")] # v11c: túnica de couro marrom-escuro
		elif tipo == "cinto":
			c3 = CINTO
		s.set_shader_parameter("claro", c3[0])
		s.set_shader_parameter("medio", c3[1])
		s.set_shader_parameter("sombra", c3[2])
		s.set_shader_parameter("friso", FRISO[r][0])
		s.set_shader_parameter("friso_claro", FRISO[r][1])
		s.set_shader_parameter("brilho", BRILHO[r])
		s.set_shader_parameter("duro", 0.0 if tipo.begins_with("couro") or tipo == "elmo_couro" or tipo == "cinto" or tipo == "cinto_set" else 1.0)
		s.set_shader_parameter("so_friso", 1.0 if tipo == "fecho" else 0.0)
		s.set_shader_parameter("costura", 1.0 if tipo.begins_with("couro") or tipo == "elmo_couro" else 0.0)
		if tipo.begins_with("couro") or tipo == "elmo_couro":
			s.set_shader_parameter("largura", 0.0115) # couro: friso fino, como antes
		if tipo == "cinto_quadril":
			s.set_shader_parameter("claro", CINTO_QUADRIL[0])
			s.set_shader_parameter("medio", CINTO_QUADRIL[1])
			s.set_shader_parameter("sombra", CINTO_QUADRIL[2])
			s.set_shader_parameter("duro", 0.0)
			s.set_shader_parameter("largura", 0.0)
		if tipo == "saia_couro":
			s.set_shader_parameter("claro", COURO_ESCURO[0])
			s.set_shader_parameter("medio", COURO_ESCURO[1])
			s.set_shader_parameter("sombra", COURO_ESCURO[2])
			s.set_shader_parameter("duro", 0.0)
			s.set_shader_parameter("faixa", 0.2) # as mesmas 5 abas do saiote de metal, em couro
			s.set_shader_parameter("largura", 0.0115)
		if tipo == "saia":
			# v11 (referência de couro e aço): saiote de abas de couro marrom com costura (v10: placas azul-marinho)
			s.set_shader_parameter("claro", COURO_MARROM[0])
			s.set_shader_parameter("medio", COURO_MARROM[1])
			s.set_shader_parameter("sombra", COURO_MARROM[2])
			s.set_shader_parameter("duro", 0.0)
			s.set_shader_parameter("costura", 1.0)
			s.set_shader_parameter("largura", 0.0115)
			s.set_shader_parameter("faixa", 0.2) # 5 lâminas grandes em volta do quadril
		if tipo.begins_with("elmo"):
			s.set_shader_parameter("faixa", 100.0) # sem lâminas; a crista do meio é a junta
			s.set_shader_parameter("junta_y", 0.0)
			# direção de arte v6: o topo do casco lia como "careca" (reflexo bege-claro grande). Aço: topo frio
			# (azulado, valor até 0,80) e brilho só numa faixa estreita; couro: no máximo marrom médio
			s.set_shader_parameter("zenite", 0.9)
			s.set_shader_parameter("crista_esc", 0.85)
			# (os tons passam pelo ganho de 2,1 e pela curva do jogo: aqui ficam mais escuros que o alvo na tela)
			if tipo == "elmo":
				s.set_shader_parameter("claro", Color("9aaecb"))
				s.set_shader_parameter("medio", Color("6b7a93"))
			else:
				s.set_shader_parameter("claro", Color("6e4a2b"))
				s.set_shader_parameter("medio", Color("553820"))
		if tipo == "peito" or tipo == "peito_reto":
			# v11c (ficha técnica do André): peitoral de metal escuro, chumbo fosco (ombreiras e grevas são prateadas)
			s.set_shader_parameter("claro", Color("7a7f86"))
			s.set_shader_parameter("medio", Color("4a4e54"))
			s.set_shader_parameter("sombra", Color("16171a"))
			s.set_shader_parameter("reflexo", 0.3)
		if tipo == "peito_reto":
			s.set_shader_parameter("faixa", 100.0)
			s.set_shader_parameter("junta_y", -1.0)
		if tipo == "fecho":
			s.set_shader_parameter("friso", Color("7c8188")) # fivelas e broche de metal prateado
		if tipo == "metal":
			s.set_shader_parameter("reflexo", 0.28) # prateado fosco
		if tipo == "peito":
			# horizonte escuro só no que olha para baixo (faixa fina sob o busto); a barriga fica no meio-tom
			s.set_shader_parameter("horizonte", Vector2(-0.08, -0.03))
			s.set_shader_parameter("chao", 0.08) # v8: o escuro fica só numa faixa fina sob o busto
			s.set_shader_parameter("faixa", 100.0) # sem lâminas: só a junta
			s.set_shader_parameter("junta_y", junta_peito) # junta de 1 cm entre peito e barriga, 3 cm abaixo do busto
		# contorno escuro de desenho, igual ao dos personagens
		var c := StandardMaterial3D.new()
		c.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		c.cull_mode = BaseMaterial3D.CULL_FRONT
		c.grow = true
		c.grow_amount = 0.0025
		c.albedo_color = Color(0.1, 0.08, 0.09)
		s.next_pass = c
		m = s
	_materiais[chave] = m
	return m

# ---------- capacete ----------
# Casco aberto na frente (testa à mostra das sobrancelhas para baixo), descendo pelas bochechas e pela nuca.
# Medido pelo rosto do VRoid (maior malha Face_*). O cabelo de cima é apertado para dentro do casco (_cabelo).
class Cabeca:
	var c := Vector3(0, 1.52, -0.02) # centro do elipsoide
	var raio := Vector3(0.13, 0.14, 0.125)
	var testa := 1.517 # borda da frente (logo acima das sobrancelhas)
	var bochecha := 1.45
	var nuca := 1.44
	var rabo := Vector3.ZERO # onde o cabelo de trás sai do casco (anel na nuca)
	var tem_rabo := false

static var _cab_cache := {}
static func _cabeca(raiz: Node3D) -> Cabeca:
	var rosto: MeshInstance3D = null
	var maior := 0.0
	for mi in raiz.find_children("Face*", "MeshInstance3D", true, false):
		var v: float = mi.mesh.get_aabb().get_volume() if mi.mesh else 0.0
		if v > maior:
			maior = v
			rosto = mi
	var k := rosto.mesh.get_instance_id() if rosto else 0
	if _cab_cache.has(k):
		return _cab_cache[k]
	var h := Cabeca.new()
	if rosto:
		var F: AABB = rosto.mesh.get_aabb()
		# os outros corpos do criador têm a pele da cabeça em duas malhas (rosto e lados/nuca): o casco tem de
		# cobrir as duas, senão a pele dos lados fura o capacete e a cabeça lê como careca
		for mi in raiz.find_children("Face*", "MeshInstance3D", true, false):
			if mi != rosto and mi.mesh is ArrayMesh and mi.mesh.get_surface_count() > 0 and "Face_00_SKIN" in mi.mesh.surface_get_name(0):
				F = F.merge(mi.mesh.get_aabb())
		if _vira: # caixa do rosto no espaço canônico
			F = AABB(Vector3(-F.end.x, F.position.y, -F.end.z), F.size)
		var H := F.size.y
		var base := F.position.y
		var frente := F.end.z
		var tras := frente - 0.98 * H # nuca: o crânio é mais fundo que o rosto
		h.c = Vector3(F.get_center().x, base + 0.58 * H, (frente + tras) * 0.5 - 0.005)
		# André 2026-11-03 ("capacete por cima do cabelo"): casco mais justo na cabeça e cúpula 15% mais baixa
		# (direção de arte); o cabelo de cima é apertado mais para dentro (_cabelo_apertado)
		# v6 (direção de arte, André aprovou): mais estreito (~1,15x a cabeça, era ~1,3x) e a borda da frente
		# ~1 cm acima das sobrancelhas: olhos livres de frente e em 3/4. A altura volta à de antes: mais baixa, a pele
		# do alto da cabeça do VRoid furava o casco e o topo lia como "careca"
		h.raio = Vector3(F.size.x * 0.5 * 0.97, (F.end.y - h.c.y + 0.02) * 1.0 + 0.004, (frente - tras) * 0.5 - 0.01)
		h.testa = base + 0.74 * H
		h.bochecha = base + 0.14 * H # protege a bochecha até perto do queixo
		h.nuca = base + 0.2 * H
	_cab_cache[k] = h
	return h

# altura da borda do casco no ângulo a (0 = frente, PI = nuca)
static func _borda_elmo(h: Cabeca, a: float) -> float:
	var x := absf(wrapf(a, -PI, PI))
	if x < 1.6:
		return lerpf(h.testa, h.bochecha, smoothstep(0.75, 1.3, x)) # frente aberta (olhos livres em 3/4), desce pela bochecha
	return lerpf(h.bochecha, h.nuca, smoothstep(1.6, 2.6, x))

static func _ponto_elmo(h: Cabeca, a: float, y: float, folga: float) -> Vector3:
	var k := 1.0
	if y > h.c.y:
		k = sqrt(maxf(0.0, 1.0 - pow((y - h.c.y) / h.raio.y, 2.0)))
	return Vector3(h.c.x + (h.raio.x + folga) * k * sin(a), y, h.c.z + (h.raio.z + folga) * k * cos(a))

static func _montar_elmo(raiz: Node3D, esq: Skeleton3D, no: Node3D, mat: String, r: int) -> void:
	var osso := esq.find_bone("J_Bip_C_Head")
	if osso < 0:
		return
	var h := _cabeca(raiz)
	var chave := "elmo:%s" % str(h.c)
	if not _malhas.has(chave):
		_malhas[chave] = _malha_elmo(h)
	var ba := BoneAttachment3D.new()
	no.add_child(ba)
	ba.use_external_skeleton = true
	ba.external_skeleton = ba.get_path_to(esq)
	ba.bone_name = "J_Bip_C_Head"
	var mi := MeshInstance3D.new()
	mi.mesh = _malhas[chave]
	mi.material_override = _material(mat, r)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	mi.transform = esq.get_bone_global_rest(osso).affine_inverse() * _G() # malha feita no espaço do personagem em T
	ba.add_child(mi)
	# anel na nuca por onde o cabelo de trás sai (couro no Comum, friso nos outros)
	_achar_rabo(h, _malha_cabelo(raiz))
	if h.tem_rabo:
		var anel := MeshInstance3D.new()
		var tor := TorusMesh.new()
		tor.inner_radius = 0.021
		tor.outer_radius = 0.032
		tor.rings = 24
		tor.ring_segments = 10
		anel.mesh = tor
		anel.material_override = _material("fecho" if mat == "elmo" else "couro", r)
		anel.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		anel.transform = esq.get_bone_global_rest(osso).affine_inverse() * _G() * Transform3D(Basis(), h.rabo)
		ba.add_child(anel)

static func _malha_elmo(h: Cabeca) -> ArrayMesh:
	var NA := 96 # colunas finas: a crista do meio tem ~1,4 cm de largura
	var NJ := 28
	var topo := h.c.y + h.raio.y
	var V := PackedVector3Array()
	var U2 := PackedVector2Array()
	var I := PackedInt32Array()
	# casca de fora: colunas em volta da cabeça, da borda até o topo (linhas mais juntas perto do topo)
	for j in NJ + 1:
		var s := float(j) / NJ
		for i in NA + 1:
			var a := float(i) / NA * TAU
			var e := _borda_elmo(h, a)
			var y := e + (topo - e) * (0.5 * s + 0.5 * sin(s * PI * 0.5)) # linhas mais juntas na faixa da borda
			# faixa de reforço em volta da borda (2,5 cm de altura, 4 mm para fora) e crista do meio (1 cm, só em cima)
			var folga := 0.004 * (1.0 - smoothstep(0.022, 0.027, y - e))
			var p := _ponto_elmo(h, a, y, folga)
			var dc := absf(p.x - h.c.x) # distância até a linha do meio, da testa à nuca (m)
			var crista := 0.009 * (1.0 - smoothstep(0.004, 0.014, dc)) * smoothstep(h.c.y - 0.01, h.c.y + 0.03, y)
			if j == NJ:
				p = Vector3(h.c.x, topo, h.c.z)
				crista = 0.009
			var rad := (p - h.c) / h.raio
			p += Vector3(rad.x / h.raio.x, maxf(0.0, rad.y) / h.raio.y, rad.z / h.raio.z).normalized() * crista
			V.append(p)
			# UV2: distância até a borda (friso) e ângulo (a crista no meio é a "junta" em 0)
			var meio := absf(wrapf(a, -PI, PI))
			# a crista ganha a marca 7 (o shader escurece 15%: lê como peça separada do casco)
			U2.append(Vector2((y - e) * 1.15, 7.0 if crista > 0.0045 else (minf(meio, TAU - meio) * 0.12 if y > h.c.y + 0.02 else 5.0)))
	for j in NJ:
		for i in NA:
			var a0 := j * (NA + 1) + i
			var b0 := a0 + 1
			var c0 := a0 + NA + 1
			var d0 := c0 + 1
			I.append_array([a0, c0, b0, b0, c0, d0])
	# borda com espessura (8 mm) para dentro
	var n := V.size()
	for i in NA + 1:
		var a := float(i) / NA * TAU
		var e := _borda_elmo(h, a)
		V.append(_ponto_elmo(h, a, e + 0.002, -0.008))
		U2.append(Vector2(0.0, 5.0))
	for i in NA:
		I.append_array([i, i + 1, n + i, i + 1, n + i + 1, n + i])
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for q in I:
		st.set_uv2(U2[q])
		st.add_vertex(V[q])
	st.generate_normals()
	return st.commit()

# Com capacete o cabelo de cima é apertado para dentro do casco (técnica comum em jogo: "cabelo de capacete").
# A franja abaixo da testa, o cabelo que cai pelos lados e o rabo de cavalo continuam como estão.
static func _cabelo(raiz: Node3D, com_elmo: bool) -> void:
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		if not (mi.mesh is ArrayMesh) or mi.mesh.get_surface_count() == 0 or str(mi.name).begins_with("Armadura"):
			continue
		var nome: String = str(mi.name) + mi.mesh.surface_get_name(0)
		if not ("Hair" in nome or "HAIR" in nome):
			continue
		if not mi.has_meta("malha_original"):
			if not com_elmo:
				continue
			mi.set_meta("malha_original", mi.mesh)
		var orig: Mesh = mi.get_meta("malha_original")
		if not com_elmo:
			mi.mesh = orig
			continue
		# corpo que já ganhou LOD (lod_malha.gd) aperta a malha original: a mesma do boneco aquecido atrás da capa
		# (aquecer.gd), senão cada penteado debaixo do capacete era refeito no quadro (~30 ms, 2026-11-13)
		var fonte: Mesh = preload("res://lod_malha.gd").original(orig)
		var chave := "cabelo:%d" % fonte.get_instance_id()
		if not _malhas.has(chave):
			_malhas[chave] = _cabelo_apertado(fonte, _cabeca(raiz), _bind_cabeca(mi))
		mi.mesh = _malhas[chave]

static func _malha_cabelo(raiz: Node3D) -> Mesh:
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		if not (mi.mesh is ArrayMesh) or mi.mesh.get_surface_count() == 0 or str(mi.name).begins_with("Armadura"):
			continue
		var nome: String = str(mi.name) + mi.mesh.surface_get_name(0)
		if "Hair" in nome or "HAIR" in nome:
			return mi.get_meta("malha_original") if mi.has_meta("malha_original") else mi.mesh
	return null

# centro do cabelo que cai atrás da nuca, logo abaixo da borda do casco: ali fica o anel por onde ele sai
static func _achar_rabo(h: Cabeca, malha: Mesh) -> void:
	if h.tem_rabo or malha == null:
		return
	var soma := Vector3.ZERO
	var n := 0
	for sfc in malha.get_surface_count():
		var V: PackedVector3Array = _FA(malha.surface_get_arrays(sfc)[Mesh.ARRAY_VERTEX])
		for p in V:
			var d := p - h.c
			if absf(p.y - (h.nuca - 0.03)) < 0.015 and d.z < -h.raio.z * 0.25 and absf(d.x) < 0.08:
				soma += p
				n += 1
	if n >= 6:
		h.rabo = soma / n
		h.tem_rabo = true

# índice (no Skin da malha) do osso da cabeça: o cabelo apertado dentro do casco passa a seguir só a cabeça
static func _bind_cabeca(mi: MeshInstance3D) -> int:
	var sk: Skin = mi.skin
	if sk == null:
		return -1
	var esq := mi.get_node_or_null(mi.skeleton) as Skeleton3D
	for i in sk.get_bind_count():
		var nome := str(sk.get_bind_name(i))
		if nome == "" and esq and sk.get_bind_bone(i) >= 0:
			nome = esq.get_bone_name(sk.get_bind_bone(i))
		if nome == "J_Bip_C_Head":
			return i
	return -1

static func _cabelo_apertado(orig: Mesh, h: Cabeca, cabeca := -1) -> ArrayMesh:
	_achar_rabo(h, orig)
	var am := ArrayMesh.new()
	var dentro := h.raio * 0.93 # bem para dentro do casco: nenhum fio aparece por cima
	for sfc in orig.get_surface_count():
		var arr := orig.surface_get_arrays(sfc)
		var V: PackedVector3Array = _FA(arr[Mesh.ARRAY_VERTEX])
		var B = arr[Mesh.ARRAY_BONES]
		var W = arr[Mesh.ARRAY_WEIGHTS]
		var nb: int = (B.size() / V.size()) if B != null and V.size() > 0 else 0
		for i in V.size():
			var p := V[i]
			var d := p - h.c
			var a := atan2(d.x, d.z)
			var e := _borda_elmo(h, a)
			var cobre := smoothstep(e - 0.03, e + 0.005, p.y) # só o que fica dentro do casco
			if h.tem_rabo and d.z < 0.0 and p.y < e + 0.01:
				# o cabelo de trás junta num rabo redondo que passa pelo anel (raio 2,5 cm), logo abaixo da borda
				var aperta := 1.0 - smoothstep(0.0, 0.07, absf(p.y - h.rabo.y))
				var lado := Vector2(p.x - h.rabo.x, p.z - h.rabo.z)
				if aperta > 0.0 and lado.length() > 0.022:
					var novo := lado.normalized() * lerpf(lado.length(), 0.022, aperta)
					p = Vector3(h.rabo.x + novo.x, p.y, h.rabo.z + novo.y)
					V[i] = p
			# André 2026-11-03: correndo, as molas do cabelo jogavam os fios para fora do casco. O que fica dentro
			# dele segue só o osso da cabeça (sem mola); nos 10 cm abaixo da borda a mola volta aos poucos (o rabo de
			# cavalo balança sem esticar fios de dentro do casco para fora)
			var rigido := smoothstep(e - 0.1, e - 0.01, p.y)
			if cabeca >= 0 and rigido > 0.0 and nb > 0:
				var pw := {}
				for k in nb:
					var w0: float = W[i * nb + k] * (1.0 - rigido)
					if w0 > 0.0:
						pw[B[i * nb + k]] = pw.get(B[i * nb + k], 0.0) + w0
				pw[cabeca] = pw.get(cabeca, 0.0) + rigido
				var ks: Array = pw.keys()
				ks.sort_custom(func(x, y): return pw[x] > pw[y])
				var soma := 0.0
				for k in mini(nb, ks.size()):
					soma += pw[ks[k]]
				for k in nb:
					B[i * nb + k] = ks[k] if k < ks.size() else 0
					W[i * nb + k] = (pw[ks[k]] / soma) if k < ks.size() else 0.0
			if cobre <= 0.0:
				continue
			# raio "do casco" naquele ponto (parede reta embaixo do centro, cúpula em cima)
			var q := Vector3(d.x / dentro.x, maxf(0.0, d.y) / dentro.y, d.z / dentro.z)
			var f := q.length()
			if f <= 1.0:
				continue
			var w := cobre # tudo o que está na altura do casco entra; o rabo de cavalo sai por baixo da borda da nuca
			var alvo := h.c + Vector3(d.x, maxf(0.0, d.y), d.z) / f + Vector3(0, minf(0.0, d.y), 0)
			V[i] = p.lerp(alvo, w)
		arr[Mesh.ARRAY_VERTEX] = _FA(V)
		if cabeca >= 0 and nb > 0:
			arr[Mesh.ARRAY_BONES] = B
			arr[Mesh.ARRAY_WEIGHTS] = W
		var flags: int = orig.surface_get_format(sfc) & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS
		am.add_surface_from_arrays(orig.surface_get_primitive_type(sfc), arr, [], {}, flags)
		am.surface_set_material(sfc, orig.surface_get_material(sfc))
		am.surface_set_name(sfc, orig.surface_get_name(sfc))
	return am

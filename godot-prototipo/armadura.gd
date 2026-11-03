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

const SHADER_METAL := preload("res://armadura.gdshader")
const SHADER_CAPA := preload("res://capa.gdshader")

# uma linha só de armadura (André): Comum é de couro, do Raro em diante placas de aço com friso
static func pecas(k: String, r: int) -> Array: # [[parte, material], ...]
	var metal := r >= 1
	match k:
		"peitoral":
			var m := "metal" if metal else "couro"
			return [["peito", "peito" if metal else "couro"], ["ombro_e", m], ["ombro_d", m], ["braco_e", m], ["braco_d", m]]
		"calca":
			# Épico ou melhor: saiote de 5 lâminas por cima da saia
			return [["coxa_e", "couro_escuro"], ["coxa_d", "couro_escuro"]] + ([["saia", "saia"]] if r >= 2 else [])
		"botas":
			return [["canela_e", "metal"], ["canela_d", "metal"], ["sapato", "metal"]] if metal else [["cano_e", "couro"], ["cano_d", "couro"], ["sapato_couro", "couro"]]
		"short":
			# short de couro (coxa de cima); Épico ou melhor ganha o mesmo saiote de lâminas da calça
			return [["short_e", "couro_escuro"], ["short_d", "couro_escuro"]] + ([["saia", "saia"]] if r >= 2 else [])
		"capa":
			return [["capa", "capa"]]
		"chapeu": # Capacete: Comum de couro, Raro em diante de aço
			return [["elmo", "elmo" if metal else "elmo_couro"]]
	return []
const PECAS := {"chapeu": "cabeca", "peitoral": "corpo", "calca": "pernas", "short": "pernas", "botas": "pes", "capa": "capa"}
const LUGARES := ["cabeca", "corpo", "pernas", "pes", "capa"]

# cores por raridade (Comum, Raro, Épico, Lendário, Mítico): metal, friso, pano da capa (fora, dentro)
# André 2026-11-03: placas com cor de metal de verdade (ferro e aço; o Épico pode puxar um pouco para o roxo) e as
# partes de tecido na cor da raridade (azul, roxo, laranja, pink). Antes as placas eram lilás e azul-claro lisas e
# pareciam roupa de astronauta de plástico.
# metal: [céu refletido (claro), meio-tom, horizonte escuro (sombra)] do reflexo desenhado em armadura.gdshader
const METAL := [
	[Color("d4d8dc"), Color("7b8189"), Color("2c3036")], # Comum: ferro (só o couro usa a cor de couro)
	[Color("dfe6ee"), Color("7f8c9b"), Color("27303b")], # Raro: aço
	[Color("ddd8ec"), Color("7c7496"), Color("29233a")], # Épico: aço com um toque violeta
	[Color("e6ebf2"), Color("838fa1"), Color("252c38")], # Lendário: aço claro polido (friso de ouro)
	[Color("b4adbf"), Color("4c4656"), Color("16131b")]] # Mítico: aço escurecido (friso de ouro rosé)
const FRISO := [[Color("a8743c"), Color("d4a060")], [Color("9aa4b0"), Color("e4e9ee")], [Color("c99a45"), Color("f0cf7a")],
	[Color("d9a54a"), Color("f3d27a")], [Color("d9826e"), Color("ffc2a8")]]
const COURO := [Color("8a5e3c"), Color("62412b"), Color("392517")]
const COURO_ESCURO := [Color("6b4a36"), Color("4a3226"), Color("2a1c16")]
# tecido (blusa, mangas e saia do VRoid por baixo da armadura, e a capa) na cor da raridade:
# Comum linho marrom, Raro azul, Épico roxo, Lendário laranja, Mítico pink
const TECIDO := [Color("7a5a3e"), Color("2e5596"), Color("5d2f8e"), Color("c8641e"), Color("c23a7c")]
const ROUPA := TECIDO # nome antigo (a blusa e a saia lisas usam a cor do tecido)
const BRILHO := [0.0, 0.0, 0.15, 0.25, 0.6] # o friso das raridades altas brilha um pouco
const CAPA := [[Color(0.45, 0.33, 0.24), Color(0.3, 0.22, 0.16)], [Color(0.18, 0.33, 0.6), Color(0.1, 0.17, 0.33)],
	[Color(0.37, 0.18, 0.56), Color(0.2, 0.09, 0.31)], [Color(0.8, 0.38, 0.11), Color(0.45, 0.18, 0.06)], [Color(0.78, 0.22, 0.48), Color(0.36, 0.07, 0.2)]]

static var _malhas := {} # "id da malha:parte" -> ArrayMesh pronta
static var _soldas := {} # id da malha de origem -> malha soldada (sem costuras de UV)
static var _materiais := {}
static var junta_peito := 1.1 # y da junta peito/barriga (medido no corpo em _ref)

# ---------- vestir ----------
static func vestir(raiz: Node3D, equip) -> void:
	var esq: Skeleton3D = _esqueleto(raiz)
	if esq == null:
		return
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
		var no := Node3D.new()
		no.name = nome
		no.set_meta("chave", chave)
		esq.add_child(no)
		_montar(raiz, esq, no, str(it.k), int(it.get("r", 0)), tem_capa)
	_uniforme(raiz, equip if equip is Dictionary else {})
	_cabelo(raiz, esq.get_node_or_null("Armadura_cabeca") != null)
	# armas nas costas passam por fora da capa
	var capa := esq.get_node_or_null("Armadura_capa") != null
	for ba in esq.get_children():
		if ba is BoneAttachment3D and ba.bone_name == "J_Bip_C_UpperChest":
			for arma in ba.get_children():
				costas(esq, arma, capa)

# espada e cajado nas costas (presos no UpperChest): com capa, 9 cm mais para trás para não atravessar o pano
static func costas(esq: Skeleton3D, arma: Node3D, capa: bool) -> void:
	var b := esq.find_bone("J_Bip_C_UpperChest")
	if b < 0:
		return
	var v := esq.get_bone_global_rest(b).basis.inverse() * Vector3(0, 0.02, -0.09)
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
		if it is Dictionary and PECAS.has(str(it.get("k", ""))):
			var r := clampi(int(it.get("r", 0)), 0, 4)
			mi.set_surface_override_material(0, _material_tecido(r))
		else:
			mi.set_surface_override_material(0, null)
	# gravata some com peitoral de aço (a gola metálica fica no lugar dela)
	var gravata := _fonte(raiz, "Tie")
	if gravata:
		var p = equip.get("corpo")
		gravata.visible = not (p is Dictionary and str(p.get("k", "")) == "peitoral" and int(p.get("r", 0)) >= 1)

static func _material_tecido(r: int) -> Material:
	var chave := "tecido:%d" % r
	if not _materiais.has(chave):
		var m := StandardMaterial3D.new()
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
		if parte == "saia" and tem_capa:
			parte = "saia_frente"
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
		var src := _fonte(raiz, REGIOES[parte].fonte)
		if src == null:
			continue
		var chave := "%d:%s" % [src.mesh.get_instance_id(), parte]
		if not _malhas.has(chave):
			_malhas[chave] = _casca(src, parte, esq)
		var am: ArrayMesh = _malhas[chave]
		if am == null:
			continue
		var mi := MeshInstance3D.new()
		mi.mesh = am
		mi.skin = src.skin
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		no.add_child(mi)
		mi.skeleton = mi.get_path_to(esq)
		mi.material_override = _material(mat, r)

# ---------- regiões (posição de descanso em T, metros; +x = esquerda do personagem, +z = frente) ----------
# off(p, b): quanto a casca sai do corpo naquele ponto (<= 0 = fora da peça). seg: coordenada das faixas (lâminas).
const REGIOES := {
	"peito": {"fonte": "Tops"}, "ombro_e": {"fonte": "Tops"}, "ombro_d": {"fonte": "Tops"},
	"braco_e": {"fonte": "Tops"}, "braco_d": {"fonte": "Tops"}, 
	"canela_e": {"fonte": "Body_00"}, "canela_d": {"fonte": "Body_00"}, "cano_e": {"fonte": "Body_00"}, "cano_d": {"fonte": "Body_00"},
	"sapato": {"fonte": "Shoes"}, "sapato_couro": {"fonte": "Shoes"},
	"coxa_e": {"fonte": "Body_00"}, "coxa_d": {"fonte": "Body_00"}, "short_e": {"fonte": "Body_00"}, "short_d": {"fonte": "Body_00"}, "saia": {"fonte": "Bottoms"}, "saia_frente": {"fonte": "Bottoms"},
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

static func _ref(esq: Skeleton3D) -> Ref:
	var r := Ref.new()
	var p := func(n: String) -> Vector3:
		var b := esq.find_bone(n)
		return esq.get_bone_global_rest(b).origin if b >= 0 else Vector3.ZERO
	r.y_cintura = p.call("J_Bip_C_Spine").y
	r.y_pescoco = p.call("J_Bip_C_Neck").y
	r.x_braco = p.call("J_Bip_L_UpperArm").x
	r.y_braco = p.call("J_Bip_L_UpperArm").y
	r.x_cotovelo = p.call("J_Bip_L_LowerArm").x
	r.x_mao = p.call("J_Bip_L_Hand").x
	r.y_joelho = p.call("J_Bip_L_LowerLeg").y
	r.z_joelho = p.call("J_Bip_L_LowerLeg").z
	r.y_pe = p.call("J_Bip_L_Foot").y
	var busto: Vector3 = p.call("J_Sec_L_Bust1")
	if busto != Vector3.ZERO:
		junta_peito = busto.y - 0.11 # base do busto ~8 cm abaixo do osso, mais 3 cm
	return r

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
			var baixo := maxf(R.y_cintura + 0.02, junta_peito - 0.085) + 0.5 * ax + (0.03 if p.z < 0.0 else 0.0)
			var lado_max := R.x_braco + (0.03 if p.y < R.y_braco - 0.07 else 0.005)
			if p.y < baixo or p.y > R.y_pescoco + 0.02 or ax > lado_max:
				return Vector2(-1, 0)
			return Vector2(0.016, p.y) # a junta peito/barriga fica no shader (junta_y)
		"ombro_e", "ombro_d":
			# casco em cúpula no alto do braço e no ombro, por cima do peitoral
			var dx := ax - (R.x_braco + 0.04)
			if ax < R.x_braco - 0.035 or ax > R.x_braco + 0.14 or p.y < R.y_braco - 0.075 + 0.3 * maxf(0.0, ax - R.x_braco - 0.07):
				return Vector2(-1, 0)
			return Vector2(0.03 + 0.03 * _sino(Vector2(dx, p.y - R.y_braco - 0.03).length(), 0.11), ax)
		"braco_e", "braco_d":
			if ax < R.x_cotovelo + 0.035 or ax > R.x_mao - 0.02:
				return Vector2(-1, 0)
			return Vector2(0.012 + 0.006 * _sino(ax - R.x_cotovelo - 0.1, 0.08), ax)
		"canela_e", "canela_d":
			# canela inteira, com a joelheira subindo na frente
			var topo := R.y_joelho - 0.05 + 0.13 * clampf((p.z - R.z_joelho) / 0.05, 0.0, 1.0)
			if p.y > topo or p.y < R.y_pe - 0.01 or ax > 0.16:
				return Vector2(-1, 0)
			var joelho := _sino(Vector3(ax - 0.075, p.y - R.y_joelho, p.z - R.z_joelho - 0.06).length(), 0.075)
			return Vector2(0.014 + 0.018 * joelho, p.y)
		"cano_e", "cano_d":
			if p.y > R.y_joelho - 0.12 or p.y < R.y_pe - 0.01 or ax > 0.16:
				return Vector2(-1, 0)
			return Vector2(0.011, p.y)
		"coxa_e", "coxa_d":
			if p.y < R.y_joelho - 0.03 or p.y > R.y_cintura - 0.12 or ax > 0.17:
				return Vector2(-1, 0)
			return Vector2(0.006, p.y)
		"short_e", "short_d":
			# só a coxa de cima: termina um palmo acima do joelho
			if p.y < R.y_joelho + 0.17 or p.y > R.y_cintura - 0.12 or ax > 0.17:
				return Vector2(-1, 0)
			return Vector2(0.007, p.y)
		"saia", "saia_frente":
			# placas verticais (lâminas) em volta do quadril; começa abaixo da barra da blusa (que cobre o alto da saia)
			# saia_frente (com capa): só a frente e os lados; atrás fica o pano da capa
			if p.y > R.y_cintura - 0.075 or (parte == "saia_frente" and p.z < -0.02):
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
			s.nor[j] += N[i]
		else:
			var j := s.pos.size()
			mapa[q] = j
			novo[i] = j
			s.pos.append(V[i])
			s.nor.append(N[i])
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
	for it in (20 if parte == "peito" else 8): # o peitoral alisa mais: placa, não o desenho do corpo
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
		pos[i] += nor[i] * 0.004 * _sino(dist[i], 0.012)
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
			vn[i] = vn[i].lerp(en, 0.75).normalized()
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
	arr[Mesh.ARRAY_VERTEX] = V
	arr[Mesh.ARRAY_NORMAL] = Nn
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

static func _montar_ombreira(esq: Skeleton3D, no: Node3D, lado: float, mat: String, r: int) -> void:
	var osso := "J_Bip_L_UpperArm" if lado > 0.0 else "J_Bip_R_UpperArm"
	var b := esq.find_bone(osso)
	if b < 0:
		return
	var chave := "ombro:%s" % lado
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
	var c := Vector3(lado * (R.x_braco + 0.035), R.y_braco + 0.008, rest.origin.z - 0.004)
	mi.transform = rest.affine_inverse() * Transform3D(Basis(), c)
	ba.add_child(mi)

# malha em volta do eixo x (o braço em T): lâmina de cima maior e uma menor embaixo, sobrepostas
static func _malha_ombreira(lado: float) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	# x0, x1 (em semi-eixos), escala, ângulo máx (rad): a de cima grande e a de baixo saindo por baixo dela
	var placas := [[-0.62, 0.42, 1.0, 1.95], [0.3, 0.98, 0.9, 1.8]]
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
	# a malha foi feita no espaço do personagem em T; o osso em descanso leva para lá
	mi.transform = esq.get_bone_global_rest(osso).affine_inverse()
	ba.add_child(mi)
	no.set_meta("capa_mi", mi)
	# fechos dourados nos ombros
	for s in [-1.0, 1.0]:
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
		f.transform = esq.get_bone_global_rest(osso).affine_inverse() * Transform3D(Basis(Vector3.RIGHT, PI * 0.5).rotated(Vector3.UP, s * 0.5), Vector3(s * 0.085, R.y_pescoco - 0.035, 0.035))
		ba.add_child(f)

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
		costas_q = esq.get_bone_global_rest(quadril).origin.z - 0.14 # nádegas ficam ~14 cm atrás do quadril
	var comp := topo_y - (R.y_joelho - 0.08) # até um pouco abaixo do joelho, como na capa do Aethra
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
			var z_baixo := costas_q - 0.07 # 3 cm ou mais de folga do saiote e da saia
			var z := lerpf(z_topo, z_baixo, smoothstep(0.0, 0.45, t)) - 0.04 * curva * t
			# dobras verticais do pano, mais fundas embaixo
			z += 0.022 * t * sin(s * PI * 3.0)
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
static func _material(tipo: String, r: int) -> Material:
	var chave := "%s:%d" % [tipo, r]
	if _materiais.has(chave):
		return _materiais[chave]
	var m: Material
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
			c3 = COURO if r == 0 else COURO_ESCURO
		elif tipo == "couro_escuro":
			c3 = COURO_ESCURO
		s.set_shader_parameter("claro", c3[0])
		s.set_shader_parameter("medio", c3[1])
		s.set_shader_parameter("sombra", c3[2])
		s.set_shader_parameter("friso", FRISO[r][0])
		s.set_shader_parameter("friso_claro", FRISO[r][1])
		s.set_shader_parameter("brilho", BRILHO[r])
		s.set_shader_parameter("duro", 0.0 if tipo.begins_with("couro") or tipo == "elmo_couro" else 1.0)
		s.set_shader_parameter("so_friso", 1.0 if tipo == "fecho" else 0.0)
		if tipo == "saia":
			s.set_shader_parameter("duro", 0.6) # lâminas do saiote: reflexo de metal, brilho duro a 60%
			s.set_shader_parameter("faixa", 0.2) # 5 lâminas grandes em volta do quadril
		if tipo.begins_with("elmo"):
			s.set_shader_parameter("faixa", 100.0) # sem lâminas; a crista do meio é a junta
			s.set_shader_parameter("junta_y", 0.0)
		if tipo == "peito":
			s.set_shader_parameter("faixa", 100.0) # sem lâminas: só a junta
			s.set_shader_parameter("junta_y", junta_peito) # junta de 1 cm entre peito e barriga, 3 cm abaixo do busto
		# contorno escuro de desenho, igual ao dos personagens
		var c := StandardMaterial3D.new()
		c.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		c.cull_mode = BaseMaterial3D.CULL_FRONT
		c.grow = true
		c.grow_amount = 0.005
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
		var H := F.size.y
		var base := F.position.y
		var frente := F.end.z
		var tras := frente - 0.98 * H # nuca: o crânio é mais fundo que o rosto
		h.c = Vector3(F.get_center().x, base + 0.58 * H, (frente + tras) * 0.5 - 0.005)
		# André 2026-11-03 ("capacete por cima do cabelo"): casco mais justo na cabeça e cúpula 15% mais baixa
		# (direção de arte); o cabelo de cima é apertado mais para dentro (_cabelo_apertado)
		h.raio = Vector3(F.size.x * 0.5 * 1.07, (F.end.y - h.c.y + 0.02) * 0.85, (frente - tras) * 0.5 - 0.004)
		h.testa = base + 0.63 * H
		h.bochecha = base + 0.14 * H # protege a bochecha até perto do queixo
		h.nuca = base + 0.2 * H
	_cab_cache[k] = h
	return h

# altura da borda do casco no ângulo a (0 = frente, PI = nuca)
static func _borda_elmo(h: Cabeca, a: float) -> float:
	var x := absf(wrapf(a, -PI, PI))
	if x < 1.6:
		return lerpf(h.testa, h.bochecha, smoothstep(0.5, 1.05, x)) # frente aberta, desce pela bochecha
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
	mi.transform = esq.get_bone_global_rest(osso).affine_inverse() # malha feita no espaço do personagem em T
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
		anel.transform = esq.get_bone_global_rest(osso).affine_inverse() * Transform3D(Basis(), h.rabo)
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
			U2.append(Vector2((y - e) * 1.15, minf(meio, TAU - meio) * 0.12 if y > h.c.y + 0.02 else 5.0))
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
		var chave := "cabelo:%d" % orig.get_instance_id()
		if not _malhas.has(chave):
			_malhas[chave] = _cabelo_apertado(orig, _cabeca(raiz), _bind_cabeca(mi))
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
		var V: PackedVector3Array = malha.surface_get_arrays(sfc)[Mesh.ARRAY_VERTEX]
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
		var V: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
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
		arr[Mesh.ARRAY_VERTEX] = V
		if cabeca >= 0 and nb > 0:
			arr[Mesh.ARRAY_BONES] = B
			arr[Mesh.ARRAY_WEIGHTS] = W
		var flags: int = orig.surface_get_format(sfc) & Mesh.ARRAY_FLAG_USE_8_BONE_WEIGHTS
		am.add_surface_from_arrays(orig.surface_get_primitive_type(sfc), arr, [], {}, flags)
		am.surface_set_material(sfc, orig.surface_get_material(sfc))
		am.surface_set_name(sfc, orig.surface_get_name(sfc))
	return am

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
		"capa":
			return [["capa", "capa"]]
	return []
const PECAS := {"peitoral": "corpo", "calca": "pernas", "botas": "pes", "capa": "capa"}
const LUGARES := ["corpo", "pernas", "pes", "capa"]

# cores por raridade (Comum, Raro, Épico, Lendário, Mítico): metal, friso, pano da capa (fora, dentro)
# toon de 3 degraus (direção de arte): [claro, médio, sombra] do metal por raridade e [friso, friso claro]
const METAL := [
	[Color("c9ced4"), Color("8a929c"), Color("474d57")], # Comum: ferro (só o couro usa a cor de couro)
	[Color("c9d3de"), Color("8c99ab"), Color("4a5466")], # Raro: aço
	[Color("c9bde3"), Color("8573ad"), Color("43365e")], # Épico: aço violeta
	[Color("c8d6e8"), Color("7d93b4"), Color("3e4c6a")], # Lendário: aço azul da capa do Aethra
	[Color("8e6e7c"), Color("4f3542"), Color("24161e")]] # Mítico: aço escuro
const FRISO := [[Color("a8743c"), Color("d4a060")], [Color("b9c3cf"), Color("eef2f6")], [Color("d9a54a"), Color("f3d27a")],
	[Color("d9a54a"), Color("f3d27a")], [Color("e07a5a"), Color("ffb08a")]]
const COURO := [Color("8a5e3c"), Color("62412b"), Color("392517")]
const COURO_ESCURO := [Color("6b4a36"), Color("4a3226"), Color("2a1c16")]
# roupa de baixo (blusa e saia do VRoid) quando a armadura está no corpo: Épico ou melhor = escura; antes, lisa na cor da raridade
const ROUPA := [Color("6d5a46"), Color("3a5a8a"), Color("2a2f3a"), Color("2a2f3a"), Color("2a2f3a")]
const BRILHO := [0.0, 0.0, 0.15, 0.25, 0.6] # o friso das raridades altas brilha um pouco
const CAPA := [[Color(0.45, 0.33, 0.24), Color(0.3, 0.22, 0.16)], [Color(0.2, 0.36, 0.62), Color(0.12, 0.2, 0.36)],
	[Color(0.42, 0.24, 0.6), Color(0.24, 0.13, 0.34)], [Color(0.72, 0.13, 0.12), Color(0.42, 0.07, 0.08)], [Color(0.16, 0.08, 0.12), Color(0.55, 0.08, 0.12)]]

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

# velocidade do dono (m/s): a capa abre para trás correndo
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
	var alvo := clampf(vel / 5.4, 0.0, 1.0)
	var a: float = no.get_meta("abre", 0.0)
	a = lerpf(a, alvo, 1.0 - exp(-dt * (5.0 if alvo > a else 2.5)))
	no.set_meta("abre", a)
	mi.set_instance_shader_parameter("abre", a)

static func _esqueleto(raiz: Node) -> Skeleton3D:
	var l := raiz.find_children("*", "Skeleton3D", true, false)
	return l[0] if l.size() > 0 else null

static func _fonte(raiz: Node3D, trecho: String) -> MeshInstance3D:
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		if mi.mesh and mi.mesh.get_surface_count() > 0 and trecho in mi.mesh.surface_get_name(0):
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
	"coxa_e": {"fonte": "Body_00"}, "coxa_d": {"fonte": "Body_00"}, "saia": {"fonte": "Bottoms"}, "saia_frente": {"fonte": "Bottoms"},
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
			var baixo := R.y_cintura - 0.06 + 0.45 * ax + (0.02 if p.z < 0.0 else 0.0) # cobre a barra da blusa
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
		if tipo == "couro":
			c3 = COURO if r == 0 else COURO_ESCURO
		elif tipo == "couro_escuro":
			c3 = COURO_ESCURO
		s.set_shader_parameter("claro", c3[0])
		s.set_shader_parameter("medio", c3[1])
		s.set_shader_parameter("sombra", c3[2])
		s.set_shader_parameter("friso", FRISO[r][0])
		s.set_shader_parameter("friso_claro", FRISO[r][1])
		s.set_shader_parameter("brilho", BRILHO[r])
		s.set_shader_parameter("duro", 0.0 if tipo.begins_with("couro") else 1.0)
		s.set_shader_parameter("so_friso", 1.0 if tipo == "fecho" else 0.0)
		if tipo == "saia":
			s.set_shader_parameter("duro", 0.3) # direção de arte: brilho do saiote a 30% do metal
			s.set_shader_parameter("faixa", 0.2) # 5 lâminas grandes em volta do quadril
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

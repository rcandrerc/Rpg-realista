extends Node
# FASE 1 (André 2026-11-08/09): packs e transportes, cópia do Quimera. Quem decide é o servidor (shared/transporte.js);
# aqui ficam os modelos (pack nas costas, packs no chão, carrinho, barquinho e navio), o botão do veículo, o painel do
# pack e do carrinho (como o #packc do Quimera), a janela do mercador e o jeito de dirigir (andar.gd passo_veiculo).
# Números em dados/habilidades.json "packs", "packRegras" e "veiculos" (shared/dados.js).
#
# Modelos: madeira de verdade (medieval_wood, mesma textura das casas) e pano trançado (T_Trim_Cloth) nas faixas, lonas
# e na vela; aro de ferro nas rodas. Nada de cor chapada.

var m # main.gd
var PK: Dictionary # packs
var PR: Dictionary # packRegras
var V: Dictionary # veiculos
var veic := {} # id do dono + tipo ("c:ID") -> {no, tipo, packs_txt, ...} (carrinhos, barcos e navios do mundo)
var chao := {} # g -> {no, k, x, z} packs largados
var costas := {} # id do jogador ("eu" = o herói) -> Node3D do pack nas costas
var _painel: PanelContainer
var _painel_txt: RichTextLabel
var _largar: Button
var _busca := 0.0
var _perto_g := "" # pack do chão ao alcance (botão Pegar)
var _botao_estado := "" # o que o botão do veículo faz agora
var comb_local := -1.0 # combustível que o app conta enquanto dirige (o servidor corrige no "prog")
var _mt_madeira: StandardMaterial3D
var _mt_madeira_esc: StandardMaterial3D
var _mt_ferro: StandardMaterial3D
var _mt_pano: StandardMaterial3D
var _mt_corda: StandardMaterial3D

func _init(principal) -> void:
	m = principal

func _ready() -> void:
	PK = m.P.dados.get("packs", {})
	PR = m.P.dados.get("packRegras", {})
	V = m.P.dados.get("veiculos", {})
	_materiais()
	# botões no fim da lista do HUD (os índices de cima são usados em mostrar_build), na coluna dos botões de ação
	m.hud._botao("veiculo", Vector2(585, 160), 30, "it_carrinho", m.hud.COR_TROCA) # dirigir, descer, colocar o barco
	m.hud.botoes[-1].oculto = true
	m.hud._botao("pegar_pack", Vector2(585, 250), 28, "it_pack", m.hud.COR_TROCA) # pack no chão ao alcance
	m.hud.botoes[-1].oculto = true
	_montar_painel()

# ---------- materiais ----------
func _materiais() -> void:
	_mt_madeira = StandardMaterial3D.new()
	_mt_madeira.albedo_texture = load("res://construcao3d/medieval_wood_diff_1k.jpg")
	_mt_madeira.normal_enabled = true
	_mt_madeira.normal_texture = load("res://construcao3d/medieval_wood_nor_gl_1k.jpg")
	_mt_madeira.roughness = 0.85
	_mt_madeira.uv1_triplanar = true
	_mt_madeira.uv1_scale = Vector3(1.6, 1.6, 1.6)
	_mt_madeira_esc = _mt_madeira.duplicate()
	_mt_madeira_esc.albedo_color = Color(0.62, 0.5, 0.4)
	_mt_ferro = StandardMaterial3D.new()
	_mt_ferro.albedo_color = Color(0.32, 0.31, 0.3)
	_mt_ferro.metallic = 0.8
	_mt_ferro.roughness = 0.45
	_mt_pano = StandardMaterial3D.new()
	_mt_pano.albedo_texture = load("res://construcao3d/T_Trim_Cloth_BaseColor.png")
	_mt_pano.normal_enabled = true
	_mt_pano.normal_texture = load("res://construcao3d/T_Trim_Cloth_Normal.png")
	_mt_pano.roughness = 0.95
	_mt_pano.uv1_triplanar = true
	_mt_pano.uv1_scale = Vector3(2, 2, 2)
	_mt_corda = _mt_pano.duplicate()
	_mt_corda.albedo_color = Color(0.78, 0.66, 0.48)

func _caixa(pai: Node3D, tam: Vector3, pos: Vector3, mt: Material, rot := Vector3.ZERO) -> MeshInstance3D:
	var b := BoxMesh.new()
	b.size = tam
	var mi := MeshInstance3D.new()
	mi.mesh = b
	mi.material_override = mt
	mi.position = pos
	mi.rotation = rot
	pai.add_child(mi)
	return mi

func _cil(pai: Node3D, r: float, h: float, pos: Vector3, mt: Material, rot := Vector3.ZERO, lados := 16) -> MeshInstance3D:
	var c := CylinderMesh.new()
	c.top_radius = r
	c.bottom_radius = r
	c.height = h
	c.radial_segments = lados
	var mi := MeshInstance3D.new()
	mi.mesh = c
	mi.material_override = mt
	mi.position = pos
	mi.rotation = rot
	pai.add_child(mi)
	return mi

# ---------- o pack: caixote de madeira com faixa de pano na cor do pack e cordas (Quimera gL) ----------
func modelo_pack(k: String) -> Node3D:
	var g := Node3D.new()
	var cor := Color(str(PK.get(k, {}).get("cor", "#a0703a")))
	var faixa: StandardMaterial3D = _mt_pano.duplicate()
	faixa.albedo_color = cor.lightened(0.15)
	_caixa(g, Vector3(0.56, 0.5, 0.42), Vector3(0, 0.25, 0), _mt_madeira)
	_caixa(g, Vector3(0.5, 0.18, 0.44), Vector3(0, 0.52, 0), faixa)
	for x in [-0.17, 0.17]:
		_caixa(g, Vector3(0.05, 0.52, 0.44), Vector3(x, 0.26, 0), _mt_madeira_esc)
	_caixa(g, Vector3(0.6, 0.04, 0.46), Vector3(0, 0.4, 0), _mt_corda)
	return g

# ---------- carrinho de carga: caçamba de tábuas, duas rodas com aro de ferro, varais e o motor a combustível ----------
func modelo_carrinho(nv: int) -> Node3D:
	var g := Node3D.new()
	var corpo := Node3D.new()
	corpo.name = "corpo"
	g.add_child(corpo)
	var comp: float = 1.6 + 0.35 * float(max(0, nv - 1)) # cresce com o nível (leva mais packs)
	_caixa(corpo, Vector3(1.3, 0.08, comp), Vector3(0, 0.55, -0.15), _mt_madeira) # piso
	for lado in [-1.0, 1.0]:
		_caixa(corpo, Vector3(0.06, 0.32, comp), Vector3(lado * 0.62, 0.74, -0.15), _mt_madeira) # laterais
		_caixa(corpo, Vector3(0.08, 0.36, 0.08), Vector3(lado * 0.62, 0.74, -0.15 + comp * 0.5), _mt_madeira_esc)
		_caixa(corpo, Vector3(0.08, 0.36, 0.08), Vector3(lado * 0.62, 0.74, -0.15 - comp * 0.5), _mt_madeira_esc)
		_caixa(corpo, Vector3(0.06, 0.06, 1.2), Vector3(lado * 0.45, 0.62, 0.95 + comp * 0.5 - 0.8), _mt_madeira_esc) # varais
	_caixa(corpo, Vector3(1.3, 0.32, 0.06), Vector3(0, 0.74, -0.15 - comp * 0.5), _mt_madeira)
	# motorzinho na frente (o carrinho anda a combustível): caixa de ferro com o tanque e o escapamento
	_caixa(corpo, Vector3(0.7, 0.36, 0.42), Vector3(0, 0.78, 0.35 + comp * 0.5 - 0.6), _mt_ferro)
	_cil(corpo, 0.13, 0.5, Vector3(0, 1.0, 0.35 + comp * 0.5 - 0.6), _mt_madeira_esc, Vector3(0, 0, PI / 2))
	var cano := _cil(corpo, 0.04, 0.5, Vector3(0.3, 1.1, 0.25 + comp * 0.5 - 0.6), _mt_ferro)
	cano.name = "cano"
	# rodas
	var rodas := Node3D.new()
	rodas.name = "rodas"
	g.add_child(rodas)
	for lado in [-1.0, 1.0]:
		var r := Node3D.new()
		r.position = Vector3(lado * 0.75, 0.42, -0.25)
		rodas.add_child(r)
		_cil(r, 0.42, 0.07, Vector3.ZERO, _mt_ferro, Vector3(0, 0, PI / 2), 20)
		_cil(r, 0.37, 0.09, Vector3.ZERO, _mt_madeira, Vector3(0, 0, PI / 2), 20)
		for i in 4:
			_caixa(r, Vector3(0.05, 0.7, 0.05), Vector3.ZERO, _mt_madeira_esc, Vector3(i * PI / 4, 0, 0))
	var pk := Node3D.new()
	pk.name = "packs"
	corpo.add_child(pk)
	_sombra(g)
	return g

# barquinho a remo (2 pessoas): casco de tábuas, bancos e os remos
func modelo_barquinho() -> Node3D:
	var g := Node3D.new()
	var corpo := Node3D.new()
	corpo.name = "corpo"
	g.add_child(corpo)
	_caixa(corpo, Vector3(0.9, 0.06, 2.4), Vector3(0, 0.05, 0), _mt_madeira) # fundo
	for lado in [-1.0, 1.0]:
		_caixa(corpo, Vector3(0.06, 0.36, 2.3), Vector3(lado * 0.5, 0.2, 0), _mt_madeira, Vector3(0, 0, lado * -0.18))
		_caixa(corpo, Vector3(0.07, 0.05, 2.3), Vector3(lado * 0.54, 0.38, 0), _mt_madeira_esc)
		var remo := _caixa(corpo, Vector3(0.05, 0.05, 1.7), Vector3(lado * 0.8, 0.32, -0.1), _mt_madeira_esc, Vector3(0.2, lado * 0.5, 0))
		remo.name = "remo_e" if lado < 0 else "remo_d"
	_caixa(corpo, Vector3(0.6, 0.3, 0.5), Vector3(0, 0.18, 1.25), _mt_madeira, Vector3(0.5, 0, 0)) # proa
	_caixa(corpo, Vector3(0.9, 0.05, 0.3), Vector3(0, 0.25, 0.4), _mt_madeira_esc) # bancos
	_caixa(corpo, Vector3(0.9, 0.05, 0.3), Vector3(0, 0.25, -0.6), _mt_madeira_esc)
	_sombra(g)
	return g

# navio mercante: casco largo, convés, porão com os packs à vista, mastro e vela de pano
func modelo_navio() -> Node3D:
	var g := Node3D.new()
	var corpo := Node3D.new()
	corpo.name = "corpo"
	g.add_child(corpo)
	_caixa(corpo, Vector3(3.0, 1.2, 8.5), Vector3(0, -0.1, 0), _mt_madeira_esc) # casco
	for lado in [-1.0, 1.0]:
		_caixa(corpo, Vector3(0.12, 0.5, 8.4), Vector3(lado * 1.5, 0.75, 0), _mt_madeira) # amurada
	_caixa(corpo, Vector3(2.0, 1.0, 1.6), Vector3(0, 0.0, 4.6), _mt_madeira_esc, Vector3(0.6, 0, 0)) # proa
	_caixa(corpo, Vector3(2.9, 0.08, 8.3), Vector3(0, 0.52, 0), _mt_madeira) # convés
	_caixa(corpo, Vector3(2.8, 0.9, 1.6), Vector3(0, 0.95, -3.4), _mt_madeira) # castelo de popa
	_cil(corpo, 0.12, 7.0, Vector3(0, 4.0, 0.6), _mt_madeira_esc) # mastro
	_caixa(corpo, Vector3(3.4, 0.1, 0.1), Vector3(0, 6.4, 0.6), _mt_madeira_esc) # verga
	var vela := _caixa(corpo, Vector3(3.2, 3.6, 0.04), Vector3(0, 4.55, 0.68), _mt_pano)
	vela.name = "vela"
	var pk := Node3D.new()
	pk.name = "packs"
	pk.position = Vector3(0, 0.56, 1.8)
	corpo.add_child(pk)
	_sombra(g)
	return g

func _sombra(g: Node3D) -> void:
	for c in g.find_children("*", "MeshInstance3D", true, false):
		(c as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON

# packs empilhados na caçamba (2 por fileira) ou no porão (4 por fileira)
func _por_packs(no: Node3D, lista: Array, por_fila: int, passo: Vector2, base_y: float) -> void:
	var pk: Node3D = no.find_child("packs", true, false)
	if pk == null:
		return
	var txt := ",".join(PackedStringArray(lista.map(func(k): return str(k))))
	if pk.get_meta("txt", "-") == txt:
		return
	pk.set_meta("txt", txt)
	for c in pk.get_children():
		c.queue_free()
	for i in lista.size():
		var p := modelo_pack(str(lista[i]))
		var col := i % por_fila
		var fila := i / por_fila
		p.position = Vector3((col - (por_fila - 1) * 0.5) * passo.x, base_y, -fila * passo.y)
		p.rotation.y = float(i) * 0.3 - floor(float(i) * 0.3)
		pk.add_child(p)

# ---------- painel do pack e do carrinho (Quimera #packc), em cima à esquerda embaixo da vida ----------
func _montar_painel() -> void:
	var cl := CanvasLayer.new()
	cl.layer = 5
	add_child(cl)
	_painel = PanelContainer.new()
	_painel.position = Vector2(16, 150)
	_painel.mouse_filter = Control.MOUSE_FILTER_STOP
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.09, 0.07, 0.05, 0.72)
	sb.border_color = Color(0.85, 0.7, 0.4, 0.6)
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(8)
	sb.content_margin_left = 10
	sb.content_margin_right = 10
	sb.content_margin_top = 6
	sb.content_margin_bottom = 6
	_painel.add_theme_stylebox_override("panel", sb)
	cl.add_child(_painel)
	var h := HBoxContainer.new()
	_painel.add_child(h)
	_painel_txt = RichTextLabel.new()
	_painel_txt.bbcode_enabled = true
	_painel_txt.fit_content = true
	_painel_txt.scroll_active = false
	_painel_txt.custom_minimum_size = Vector2(230, 0)
	_painel_txt.add_theme_font_size_override("normal_font_size", 13)
	_painel_txt.add_theme_font_size_override("bold_font_size", 14)
	_painel_txt.mouse_filter = Control.MOUSE_FILTER_IGNORE
	h.add_child(_painel_txt)
	_largar = Button.new()
	_largar.text = "Largar"
	_largar.focus_mode = Control.FOCUS_NONE
	_largar.add_theme_font_size_override("font_size", 13)
	_largar.pressed.connect(func(): m.rede("pack", {"acao": "largar"}))
	h.add_child(_largar)
	_painel.visible = false

func _atualizar_painel() -> void:
	var p: Dictionary = m.P.prog
	var t := ""
	var pk = p.get("pack")
	if pk is Dictionary and PK.has(str(pk.get("k", ""))):
		t += "[b][color=#ffe7a8]%s[/color][/b]\n[color=#cbbfa8]Feito em: %s · leve pra longe[/color]" % [PK[pk.k].nome, _onde(pk)]
	var c = p.get("carrinho")
	if c is Dictionary and m.mov.veiculo.get("k", "") == "carrinho":
		var gal: float = (comb_local if comb_local >= 0.0 else float(c.get("comb", 0))) / float(V.carrinho.galao)
		t += ("\n" if t != "" else "") + "[b]Carrinho[/b]\n[color=#cbbfa8]Combustível: %s galão · Vida: %d/%d · Packs: %d/%d[/color]" % [
			String.num(snappedf(gal, 0.1)).replace(".", ","), int(c.get("vida", 0)), int(V.carrinho.vida), (c.get("packs", []) as Array).size(), capacidade(c)]
	var nv = p.get("navio")
	if nv is Dictionary and m.mov.veiculo.get("k", "") == "navio":
		t += ("\n" if t != "" else "") + "[b]Navio mercante[/b]\n[color=#cbbfa8]Porão: %d/%d packs[/color]" % [(nv.get("porao", []) as Array).size(), int(V.navio.porao)]
	_painel_txt.text = t
	_painel.visible = t != "" and not m.menu.aberto()
	_largar.visible = pk is Dictionary

# onde o pack foi feito: o mercador mais perto da origem
func _onde(pk: Dictionary) -> String:
	var melhor := "perto daqui"
	var dm := 30.0
	for n in m.npcs:
		if n.funcao != "pack":
			continue
		var d := Vector2(n.no.position.x - float(pk.ox), n.no.position.z - float(pk.oz)).length()
		if d < dm:
			dm = d
			melhor = str(n.nome).get_slice(",", 0)
	return melhor

func capacidade(c: Dictionary) -> int:
	return int(V.carrinho.capacidade) * clampi(int(c.get("lv", 1)), 1, int(V.carrinho.nivelMax))

# ---------- preço (a mesma conta de shared/transporte.js, só para mostrar; quem paga é o servidor) ----------
func _fator_dist(d: float) -> float:
	var D: Dictionary = PR.dist
	if d <= float(D.curto):
		return clampf(float(D.a) + d * float(D.porM), float(D.a), float(D.maxCurto))
	return minf(float(D.max), float(D.maxCurto) + (d - float(D.curto)) * float(D.porMLongo))

func _fator_area(x: float, z: float) -> float:
	var nv := 1
	var dm: float = float(PR.areas.raio)
	for c in m.mundo.get("caca", []):
		var d := Vector2(float(c.x) - x, float(c.z) - z).length()
		if d < dm:
			dm = d
			nv = int(c.get("nivel", 1))
	var f := 1.0
	var A: Dictionary = PR.areas
	for i in (A.niveis as Array).size():
		if nv >= int(A.niveis[i]):
			f = float(A.fator[i])
	return f

func _k_mercador() -> float:
	var nv: int = m.P.prof_nivel("mer") if m.P.has_method("prof_nivel") else 1
	return float(nv - 1) / 19.0

func preco(pk: Dictionary, nx: float, nz: float) -> int:
	if not PK.has(str(pk.get("k", ""))):
		return 0
	var d := Vector2(nx - float(pk.ox), nz - float(pk.oz)).length()
	var area := maxf(_fator_area(float(pk.ox), float(pk.oz)), _fator_area(nx, nz))
	var navio: float = float(PR.navio) if float(pk.get("nav", 0)) >= float(PR.navioMin) else 1.0
	return int(round(float(PK[pk.k].base) * _fator_dist(d) * float(PR.k) * (1.0 + float(PR.mercador.preco) * _k_mercador()) * area * float(PR.extra) * navio))

func custo(k: String) -> Dictionary:
	var r := {}
	var km := _k_mercador()
	for c in PK[k].custo:
		r[c] = maxi(1, int(round(float(PK[k].custo[c]) * (1.0 - float(PR.mercador.material) * km))))
	return r

# ---------- janela do mercador (conversa.gd chama quando o NPC é de pack) ----------
# devolve [fala, opções [[texto, ícone, Callable]]]
func opcoes_mercador(n: Dictionary) -> Array:
	var info: Dictionary = n.get("info", {})
	var k := str(info.get("merch", ""))
	if not PK.has(k):
		return ["...", []]
	var p: Dictionary = m.P.prog
	var nx: float = n.no.position.x
	var nz: float = n.no.position.z
	var c := custo(k)
	var mat := PackedStringArray()
	for it in c:
		mat.append("%s %d/%d" % [m.P.nome_item({"k": it}) if m.P.has_method("nome_item") else it, m.P.contar(it) if m.P.has_method("contar") else 0, c[it]])
	var fala := "Eu faço o %s. Me traga: %s.\nQuanto paga em cada mercador (mais longe e área mais forte = mais caro):" % [PK[k].nome, ", ".join(mat)]
	var lista := []
	for o in m.npcs:
		if o.funcao != "pack" or o == n:
			continue
		lista.append([str(o.nome).get_slice(",", 0), preco({"k": k, "ox": nx, "oz": nz}, o.no.position.x, o.no.position.z)])
	lista.sort_custom(func(a, b): return a[1] > b[1])
	for e in lista:
		fala += "\n · %s: %d de ouro" % [e[0], e[1]]
	var ops := []
	ops.append(["Fazer o pack (%d de vigor)" % int(PR.vigor), "it_pack", func(): m.rede("pack", {"acao": "fazer", "npc": n.id})])
	var entregar := func(pk: Dictionary, de: String, i: int) -> void:
		if not (pk is Dictionary) or not PK.has(str(pk.get("k", ""))):
			return
		if Vector2(nx - float(pk.ox), nz - float(pk.oz)).length() < float(PR.perto):
			ops.append(["%s: foi feito aqui" % PK[pk.k].nome, "it_pack", func(): m.hud.aviso("Esse pack foi feito aqui. Leve pra outro mercador: quanto mais longe, mais paga!")])
			return
		var onde: String = {"costas": "", "carrinho": " (carrinho)", "porao": " (porão)"}[de]
		ops.append(["Entregar %s%s (+%d)" % [PK[pk.k].nome.replace("Pack de ", ""), onde, preco(pk, nx, nz)], "it_ouro", func(): m.rede("pack", {"acao": "entregar", "npc": n.id, "de": de, "i": i}); m.sons.tocar("moedas", -4.0)])
	entregar.call(p.get("pack"), "costas", 0)
	var c2 = p.get("carrinho")
	if c2 is Dictionary and _perto_de(c2.get("chao"), nx, nz, float(V.carrinho.entregar)) or m.mov.veiculo.get("k", "") == "carrinho":
		var cp: Array = (c2 as Dictionary).get("packs", []) if c2 is Dictionary else []
		for i in cp.size():
			entregar.call(cp[i], "carrinho", i)
	var nv = p.get("navio")
	if nv is Dictionary and (_perto_de(nv.get("chao"), nx, nz, float(V.navio.perto)) or m.mov.veiculo.get("k", "") == "navio"):
		var pp: Array = nv.get("porao", [])
		for i in pp.size():
			entregar.call(pp[i], "porao", i)
	return [fala, ops]

func _perto_de(q, x: float, z: float, d: float) -> bool:
	return q is Dictionary and Vector2(float(q.x) - x, float(q.z) - z).length() <= d

# ---------- janela do carrinho e do navio (tocar no botão do veículo parado perto) ----------
func abrir_carrinho() -> void:
	var c = m.P.prog.get("carrinho")
	if not (c is Dictionary):
		return
	var ops := []
	var dirigindo: bool = m.mov.veiculo.get("k", "") == "carrinho"
	if c.get("quebrado", false):
		ops.append(["Consertar (8 lenha + 1 barra de ferro)", func(): m.rede("veiculo", {"acao": "consertar"})])
	elif not dirigindo:
		ops.append(["Dirigir", func(): m.rede("veiculo", {"acao": "subir", "k": "carrinho"})])
	if float(c.get("comb", 0)) < float(V.carrinho.galao) * float(V.carrinho.tanque) - 1.0:
		ops.append(["Abastecer (1 galão)", func(): m.rede("veiculo", {"acao": "abastecer"}); m.sons.tocar("pesca_splash", -14.0)])
	if not c.get("quebrado", false) and float(c.get("vida", 0)) < float(V.carrinho.vida):
		ops.append(["Consertar (4 lenha)", func(): m.rede("veiculo", {"acao": "consertar"})])
	var pk = m.P.prog.get("pack")
	if pk is Dictionary:
		ops.append(["Pôr o pack das costas no carrinho", func(): m.rede("pack", {"acao": "por_carrinho"})])
	var cp: Array = c.get("packs", [])
	if not (pk is Dictionary):
		for i in cp.size():
			ops.append(["Pegar %s nas costas" % str(PK.get(str(cp[i].k), {}).get("nome", "pack")).replace("Pack de ", ""), func(): m.rede("pack", {"acao": "tirar_carrinho", "i": i})])
	var lv := int(c.get("lv", 1))
	if lv < int(V.carrinho.nivelMax) and not c.get("quebrado", false):
		var cu: Dictionary = V.carrinho.melhorar[lv + 1]
		var t := PackedStringArray()
		for it in cu:
			t.append(("%d de ouro" % int(cu[it])) if it == "ouro" else "%d %s" % [int(cu[it]), m.P.nome_item({"k": it}) if m.P.has_method("nome_item") else it])
		ops.append(["Melhorar pro Nv %d (%d packs, na bancada): %s" % [lv + 1, 2 * (lv + 1), ", ".join(t)], func(): m.rede("veiculo", {"acao": "melhorar"})])
	if not dirigindo and not c.get("quebrado", false):
		ops.append(["Guardar na mochila", func(): m.rede("veiculo", {"acao": "guardar", "k": "carrinho"})])
	var titulo := "Carrinho Nv %d · %d/%d packs · %s galões" % [lv, cp.size(), capacidade(c), String.num(snappedf(float(c.get("comb", 0)) / float(V.carrinho.galao), 0.1)).replace(".", ",")]
	m.menu.escolher_opcao(titulo, ops) if m.menu.has_method("escolher_opcao") else _janela(titulo, ops)

func abrir_navio() -> void:
	var nv = m.P.prog.get("navio")
	if not (nv is Dictionary):
		return
	var ops := []
	var pp: Array = nv.get("porao", [])
	var pk = m.P.prog.get("pack")
	if m.mov.veiculo.is_empty():
		ops.append(["Zarpar (você pilota)", func(): m.rede("veiculo", {"acao": "subir", "k": "navio"})])
	if pk is Dictionary:
		ops.append(["Pôr o pack das costas no porão", func(): m.rede("pack", {"acao": "por_porao"})])
	else:
		for i in pp.size():
			ops.append(["Pegar %s nas costas" % str(PK.get(str(pp[i].k), {}).get("nome", "pack")).replace("Pack de ", ""), func(): m.rede("pack", {"acao": "tirar_porao", "i": i})])
	ops.append(["Carregar do carrinho", func(): m.rede("pack", {"acao": "carrinho_porao"})])
	ops.append(["Descarregar no carrinho", func(): m.rede("pack", {"acao": "porao_carrinho"})])
	if m.mov.veiculo.is_empty():
		ops.append(["Guardar na mochila", func(): m.rede("veiculo", {"acao": "guardar", "k": "navio"})])
	_janela("Navio mercante · porão %d/%d" % [pp.size(), int(V.navio.porao)], ops)

# janelinha simples de opções (a mesma cara da janela do NPC)
var _jan: CanvasLayer
func _janela(titulo: String, ops: Array) -> void:
	if _jan:
		_jan.queue_free()
	_jan = CanvasLayer.new()
	_jan.layer = 16
	add_child(_jan)
	var fundo := ColorRect.new()
	fundo.color = Color(0, 0, 0, 0.35)
	fundo.set_anchors_preset(Control.PRESET_FULL_RECT)
	fundo.gui_input.connect(func(ev): if ev is InputEventMouseButton and ev.pressed: _fechar_janela())
	_jan.add_child(fundo)
	var pc := PanelContainer.new()
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.12, 0.09, 0.06, 0.95)
	sb.border_color = Color(0.85, 0.7, 0.4)
	sb.set_border_width_all(2)
	sb.set_corner_radius_all(10)
	sb.set_content_margin_all(14)
	pc.add_theme_stylebox_override("panel", sb)
	pc.set_anchors_preset(Control.PRESET_CENTER)
	_jan.add_child(pc)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 6)
	pc.add_child(vb)
	var lt := Label.new()
	lt.text = titulo
	lt.add_theme_font_size_override("font_size", 17)
	lt.add_theme_color_override("font_color", Color("#ffe7a8"))
	vb.add_child(lt)
	for o in ops:
		var b := Button.new()
		b.text = str(o[0])
		b.focus_mode = Control.FOCUS_NONE
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		b.custom_minimum_size = Vector2(320, 38)
		b.add_theme_font_size_override("font_size", 15)
		var fn: Callable = o[1]
		b.pressed.connect(func(): fn.call(); _fechar_janela())
		vb.add_child(b)
	var sair := Button.new()
	sair.text = "Fechar"
	sair.focus_mode = Control.FOCUS_NONE
	sair.custom_minimum_size = Vector2(320, 38)
	sair.pressed.connect(_fechar_janela)
	vb.add_child(sair)
	m.hud.bloqueado = true
	await get_tree().process_frame
	pc.position = (pc.get_viewport_rect().size - pc.size) * 0.5

func _fechar_janela() -> void:
	if _jan:
		_jan.queue_free()
		_jan = null
	if not m.menu.aberto():
		m.hud.bloqueado = false

# ---------- botão do veículo ----------
func usar_botao() -> void:
	match _botao_estado:
		"descer":
			m.rede("veiculo", {"acao": "descer"})
		"carrinho":
			abrir_carrinho()
		"navio":
			abrir_navio()
		"barquinho":
			m.rede("veiculo", {"acao": "colocar", "k": "barquinho"})

func pegar_pack() -> void:
	if _perto_g != "":
		m.rede("pack", {"acao": "pegar", "g": _perto_g})
		m.sons.tocar("pano", -8.0)

func _estado_botao() -> String:
	var hp: Vector3 = m.heroi.position
	if not m.mov.veiculo.is_empty():
		return "navio" if m.mov.veiculo.k == "navio" and _abrir_do_leme else "descer"
	var p: Dictionary = m.P.prog
	var c = p.get("carrinho")
	if c is Dictionary and _perto_de(c.get("chao"), hp.x, hp.z, float(V.carrinho.perto)):
		return "carrinho"
	var nv = p.get("navio")
	if nv is Dictionary and _perto_de(nv.get("chao"), hp.x, hp.z, float(V.navio.perto)):
		return "navio"
	if m.P.contar("barquinho") > 0 and _agua_perto(hp.x, hp.z, float(V.barquinho.fundo)):
		return "barquinho"
	return ""
var _abrir_do_leme := false

func _agua_perto(x: float, z: float, fundo: float) -> bool:
	for r in [1.0, 2.5, 4.0]:
		for i in 8:
			var a := float(i) * TAU / 8.0
			var L: Dictionary = m.terreno.no_lago(x + sin(a) * r, z + cos(a) * r)
			if not L.is_empty() and float(L.fundo) >= fundo:
				return true
	return false

# ---------- o que vem do servidor ----------
# foto: carga = {packs: [[g, k, x, z]], veic: [[tipo, dono, x, z, ry, nv, packs, quebrado, dirigindo]]}
func atualizar(carga) -> void:
	if not (carga is Dictionary):
		return
	var vistos := {}
	for e in carga.get("packs", []):
		var g := str(e[0])
		vistos[g] = true
		if not chao.has(g):
			var no := modelo_pack(str(e[1]))
			m.add_child(no)
			var x := float(e[2])
			var z := float(e[3])
			no.position = Vector3(x, m.terreno.altura(x, z), z)
			no.rotation.y = fmod(x * 7.0, TAU)
			chao[g] = {"no": no, "k": str(e[1]), "x": x, "z": z}
	for g in chao.keys():
		if not vistos.has(g):
			chao[g].no.queue_free()
			chao.erase(g)
	var vv := {}
	var eu := str(m.online.meu_id) if m.online and "meu_id" in m.online else ""
	for e in carga.get("veic", []):
		var tipo := str(e[0])
		var dono := str(e[1])
		var chave := tipo + ":" + dono
		vv[chave] = true
		var v: Dictionary = veic.get(chave, {})
		var nv := int(e[5])
		if v.is_empty() or int(v.get("nv", 0)) != nv:
			if not v.is_empty():
				v.no.queue_free()
			var no: Node3D = modelo_carrinho(nv) if tipo == "c" else modelo_barquinho() if tipo == "b" else modelo_navio()
			m.add_child(no)
			v = {"no": no, "tipo": tipo, "nv": nv, "dono": dono}
			veic[chave] = v
		v.x = float(e[2])
		v.z = float(e[3])
		v.ry = float(e[4])
		v.dirigindo = int(e[8]) == 1
		v.quebrado = int(e[7]) == 1
		v.eu = dono == eu
		if tipo == "c":
			_por_packs(v.no, e[6], 2, Vector2(0.62, 0.55), 0.6)
		elif tipo == "n":
			_por_packs(v.no, e[6], 4, Vector2(0.62, 0.55), 0.0)
	for k in veic.keys():
		if not vv.has(k):
			veic[k].no.queue_free()
			veic.erase(k)

func evento(ev: Dictionary) -> void:
	match str(ev.get("acao", "")):
		"subiu":
			var k := str(ev.k)
			m.mov.x = float(ev.x)
			m.mov.z = float(ev.z)
			m.mov.ry = float(ev.get("ry", m.mov.ry))
			m.mov.vx = 0.0
			m.mov.vz = 0.0
			m.mov.veiculo = {"k": k, "v": 0.0}
			m.mov.disparada = false
			comb_local = float(m.P.prog.get("carrinho", {}).get("comb", 0)) if k == "carrinho" else -1.0
			if m.montaria != null:
				m.montar_lobo(false, false)
			m.sons.tocar("pano", -6.0)
		"desceu":
			m.mov.veiculo = {}
			m.mov.x = float(ev.x)
			m.mov.z = float(ev.z)
			m.mov.y = m.terreno.altura(m.mov.x, m.mov.z)
			m.mov.vy = 0.0
			comb_local = -1.0
		"quebrou":
			m.mov.veiculo = {}
			m.sons.tocar("arvore_queda", -6.0)
		"dano":
			if m.fx and m.fx.has_method("numero"):
				m.fx.numero(m.heroi.position + Vector3(0, 1.6, 0), "-%d carrinho" % int(ev.n), Color("#ffb35a"))

# o "prog" chegou (o servidor é quem sabe): combustível de verdade
func prog_chegou() -> void:
	var c = m.P.prog.get("carrinho")
	if c is Dictionary and m.mov.veiculo.get("k", "") == "carrinho":
		comb_local = float(c.get("comb", 0))

# combustível que o app conta enquanto dirige (o servidor gasta igual: 1 por metro)
func gastou(d: float) -> void:
	if comb_local >= 0.0:
		comb_local = maxf(0.0, comb_local - d)

func tem_combustivel() -> bool:
	return comb_local > 0.0

# ---------- quadro a quadro ----------
func _process(dt: float) -> void:
	if m.heroi == null or V.is_empty():
		return
	# meu veículo segue o herói (o servidor manda a posição dele 20 vezes por segundo; a minha eu já sei)
	var hp: Vector3 = m.heroi.position
	var meu_k: String = m.mov.veiculo.get("k", "")
	for chave in veic:
		var v: Dictionary = veic[chave]
		var no: Node3D = v.no
		var alvo := Vector3(v.x, 0, v.z)
		var ry: float = v.ry
		var dirigindo_eu: bool = v.eu and v.dirigindo and meu_k == {"c": "carrinho", "b": "barquinho", "n": "navio"}[v.tipo]
		if dirigindo_eu:
			alvo = Vector3(m.mov.x, 0, m.mov.z)
			ry = m.mov.ry
		elif v.dirigindo and m.online and m.online.outros.has(v.dono):
			var o: Dictionary = m.online.outros[v.dono]
			alvo = Vector3(o.no.position.x, 0, o.no.position.z)
			ry = o.no.rotation.y
		var agua: bool = v.tipo != "c"
		alvo.y = float(m.terreno.agua.nivel) - (0.25 if v.tipo == "n" else 0.0) if agua else m.terreno.altura(alvo.x, alvo.z)
		no.position = alvo if dirigindo_eu or no.position.distance_to(alvo) > 6.0 else no.position.lerp(alvo, minf(1.0, dt * 12.0))
		no.rotation.y = lerp_angle(no.rotation.y, ry, minf(1.0, dt * 12.0))
		var corpo: Node3D = no.get_node_or_null("corpo")
		if corpo:
			if v.tipo == "c":
				corpo.rotation.z = 0.18 if v.quebrado else (sin(m.tempo * 31.0) * 0.006 + sin(m.tempo * 13.0) * 0.01) * (1.0 if v.dirigindo else 0.0)
				corpo.rotation.x = -0.08 if v.quebrado else 0.0
				var rodas: Node3D = no.get_node_or_null("rodas")
				if rodas and dirigindo_eu:
					for r in rodas.get_children():
						r.rotation.x += float(m.mov.veiculo.get("v", 0.0)) * dt / 0.42
			else: # balança na água
				corpo.rotation.z = sin(m.tempo * 1.3 + v.x) * (0.012 if v.tipo == "n" else 0.03)
				corpo.rotation.x = sin(m.tempo * 0.9 + v.z) * (0.008 if v.tipo == "n" else 0.02)
	# o herói no veículo: sentado no carrinho, no banco do barco ou no leme do navio
	if meu_k != "":
		var dy := 0.0
		var atras := 0.0
		if meu_k == "carrinho":
			dy = 0.34
			atras = 0.56
		elif meu_k == "barquinho":
			dy = 0.05
		else:
			dy = 0.6
			atras = -3.2
		m.heroi.position.y = (float(m.terreno.agua.nivel) if meu_k != "carrinho" else m.heroi.position.y) + dy
		if atras != 0.0:
			m.heroi.position.x += sin(m.mov.ry) * atras * (1.0 if meu_k == "carrinho" else 1.0)
			m.heroi.position.z += cos(m.mov.ry) * atras
	# pack nas costas: o meu e o dos outros jogadores
	_costas("eu", m.heroi, m.P.prog.get("pack"), m.heroi_esq if "heroi_esq" in m else null)
	if m.online:
		for id in m.online.outros:
			var o: Dictionary = m.online.outros[id]
			_costas(str(id), o.no, o.get("pack_k"), o.get("esq"))
	# botões e painel (4 vezes por segundo, é barato)
	_busca -= dt
	if _busca <= 0.0:
		_busca = 0.25
		_botao_estado = _estado_botao()
		m.hud.mostrar_botao("veiculo", _botao_estado != "" and m.h.morto <= 0.0)
		_perto_g = ""
		if not m.P.prog.get("pack") is Dictionary and meu_k == "":
			var dm: float = float(PR.get("pegar", 2.5))
			for g in chao:
				var d := Vector2(chao[g].x - hp.x, chao[g].z - hp.z).length()
				if d < dm:
					dm = d
					_perto_g = g
		m.hud.mostrar_botao("pegar_pack", _perto_g != "")
		_atualizar_painel()

func _costas(id: String, corpo: Node3D, pk, esq) -> void:
	var k := ""
	if pk is Dictionary:
		k = str(pk.get("k", ""))
	elif pk is String:
		k = pk
	var no: Node3D = costas.get(id)
	if k == "" or not PK.has(k) or corpo == null or not is_instance_valid(corpo) or not corpo.visible:
		if no:
			no.visible = false
		return
	if no == null or no.get_meta("k", "") != k:
		if no:
			no.queue_free()
		no = modelo_pack(k)
		no.set_meta("k", k)
		no.scale = Vector3.ONE * 0.95
		m.add_child(no)
		costas[id] = no
	no.visible = true
	var ry: float = corpo.rotation.y
	var alto := 0.62
	var atras := 0.36
	if id == "eu" and m.mov.veiculo.get("k", "") == "carrinho":
		alto = 0.36
		atras = 0.3
	var base := corpo.position
	if esq is Skeleton3D: # preso no peito de cima do esqueleto: acompanha o corpo correndo e agachado
		var i: int = (esq as Skeleton3D).find_bone("J_Bip_C_UpperChest")
		if i >= 0:
			base = (esq as Skeleton3D).global_transform * (esq as Skeleton3D).get_bone_global_pose(i).origin - Vector3(0, 0.62 + 0.3, 0)
	no.position = base + Vector3(-sin(ry) * atras, alto + 0.3, -cos(ry) * atras)
	no.rotation.y = ry

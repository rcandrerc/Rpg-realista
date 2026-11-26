extends RefCounted
# "Patrulheiro 2" e "Roupão 2" (André 2026-11-23: "bote patrulheiro 2 e roupão 2 lá como opção para eu marcar, que eu quero
# comparar os dois"): as peças feitas à mão na thread de arte (ferramentas/equip-raridade, modelar3.py e
# modelar_robe.py), uma por raridade, nos dois corpos. Ficam ao lado do patrulheiro/roupão v5 (armadura.gd), sem
# mexer neles: só entram quando a Aparência marca traje "patrulheiro2" ou "roupao2".
# Arquivos em res://equip2/ (glb enxugados por ferramentas/equip2-enxugar.py: sem as animações da Ruiva).
# Cada peça vai na vaga do equipamento: capuz = chapéu, tronco/manto/corpete = peitoral, saia/túnica/calça = calça,
# bota = botas. A raridade de cada vaga vem do item dela (dá para misturar raridades). A capa continua a da v5.

const PASTA := "res://equip2/"
const TRAJES := ["patrulheiro2", "roupao2"]

const M := {
	"couro": [0, "70482c", "000000", "000000", 0.0, 0.75, 1.0],
	"couro_escuro": [0, "3e2a1c", "000000", "000000", 0.0, 0.8, 1.0],
	"ferro": [1, "8e8a84", "202020", "000000", 0.85, 0.55, 1.0],
	"ferro_fio": [1, "c8c6c0", "303030", "000000", 0.9, 0.35, 1.0],
	"aco": [1, "8c939e", "4a5a70", "000000", 0.95, 0.3, 1.0],
	"aco_fio": [1, "eef2f8", "606a78", "000000", 1.0, 0.18, 1.0],
	"aco_escuro": [1, "5a6170", "202838", "000000", 0.9, 0.4, 1.0],
	"pano": [2, "1f4e9c", "000000", "000000", 0.0, 0.9, 1.0],
	"aco_azul": [1, "283352", "6a4aa8", "000000", 0.95, 0.28, 1.0],
	"ouro": [1, "e0b04a", "7a4a10", "000000", 1.0, 0.25, 1.0],
	"gema_roxa": [3, "7a2ad0", "e0b0ff", "b04aff", 0.0, 0.1, 2.2],
	"runa": [7, "7a2ad0", "000000", "c070ff", 0.0, 0.4, 2.4],
	"obsidiana": [4, "24201e", "6a2a10", "ff5a10", 0.7, 0.35, 3.0],
	"brasa": [3, "ff6a10", "ffd060", "ff4a00", 0.0, 0.2, 4.0],
	"brasa_linha": [7, "ff6a10", "000000", "ff6010", 0.0, 0.4, 3.5],
	"bronze": [1, "b0703a", "5a2a10", "000000", 1.0, 0.3, 1.0],
	"perola": [5, "e8ecf4", "7ad8ff", "000000", 0.6, 0.22, 1.2],
	"ouro_claro": [1, "f4dc9a", "a08040", "000000", 1.0, 0.2, 1.0],
	"cristal": [6, "1a5a8a", "6ae8ff", "ffffff", 0.0, 0.05, 1.6],
	"cristal_fio": [6, "2a7aaa", "b0f4ff", "ffffff", 0.0, 0.05, 2.2],
	"couro_fervido": [0, "6a4026", "000000", "000000", 0.0, 0.6, 1.0],
	"pano_roxo": [2, "4a1e7a", "000000", "000000", 0.0, 0.9, 1.0],
	"pano_brasa": [2, "5a1408", "000000", "000000", 0.0, 0.9, 1.0],
	"pano_branco": [2, "dfe6f0", "000000", "000000", 0.0, 0.9, 1.0],
	"luz_branca": [7, "ffffff", "000000", "d8fbff", 0.0, 0.4, 2.2],
	"luz_brasa": [7, "ffd060", "000000", "ffc040", 0.0, 0.4, 3.5],
	"madeira": [0, "6a4a30", "000000", "000000", 0.0, 0.8, 1.0],
	"pedra": [0, "6e6e72", "000000", "000000", 0.0, 0.8, 1.0],
	"gema_azul": [3, "1a5ad0", "b0e0ff", "3a9aff", 0.0, 0.1, 2.2],
	# proposta 3 (roupa leve de patrulheira/maga)
	"linho": [2, "d6cab0", "000000", "000000", 0.0, 0.9, 1.0],
	"linho_punho": [2, "b0a080", "000000", "000000", 0.0, 0.9, 1.0],
	"linho_claro": [2, "e8e0cc", "000000", "000000", 0.0, 0.9, 1.0],
	"cadarco": [0, "3a2618", "000000", "000000", 0.0, 0.8, 1.0],
	"couro_costura": [9, "5e3c24", "c8b090", "000000", 0.0, 0.7, 1.0],
	"pano_cinza": [2, "6a6660", "000000", "000000", 0.0, 0.9, 1.0],
	"pano_cinza_escuro": [2, "3c3e44", "000000", "000000", 0.0, 0.9, 1.0],
	"pano_verde": [2, "3e4a2c", "000000", "000000", 0.0, 0.9, 1.0],
	"bordado_azul": [8, "1e3f7a", "d8d0b0", "000000", 0.0, 0.8, 1.0],
	"couro_oleado": [0, "4a3020", "000000", "000000", 0.0, 0.5, 1.0],
	"couro_costura_clara": [9, "3e2a1e", "d8c8a0", "000000", 0.0, 0.6, 1.0],
	"couro_preto": [0, "221c18", "000000", "000000", 0.0, 0.55, 1.0],
	"latao": [1, "c09040", "604010", "000000", 1.0, 0.3, 1.0],
	"pano_azul": [2, "234a8a", "000000", "000000", 0.0, 0.9, 1.0],
	"seda_branca": [2, "eeeef2", "c8c8ff", "000000", 0.0, 0.6, 1.0],
	"bordado_roxo": [8, "3e1a6a", "e8c060", "000000", 0.0, 0.7, 1.0],
	"couro_vinho": [0, "4e1c24", "000000", "000000", 0.0, 0.5, 1.0],
	"couro_costura_ouro": [9, "4e1c24", "e8c060", "000000", 0.0, 0.5, 1.0],
	"cadarco_ouro": [1, "d8a848", "6a4a10", "000000", 1.0, 0.3, 1.0],
	"seda_negra": [2, "1e1b1e", "ff6020", "000000", 0.0, 0.6, 1.0],
	"bordado_brasa": [8, "3a0a06", "ff8030", "ff5a10", 0.0, 0.7, 1.6],
	"couro_negro": [0, "1c1816", "000000", "000000", 0.0, 0.45, 1.0],
	"costura_brasa": [9, "1c1816", "ff8030", "ff5a10", 0.0, 0.5, 1.8],
	"cadarco_brasa": [7, "ff6010", "000000", "ff6010", 0.0, 0.4, 2.0],
	"pano_carmesim": [2, "6a0e12", "ff4020", "000000", 0.0, 0.85, 1.0],
	"seda_aurora": [2, "e6eef8", "7ad8ff", "000000", 0.0, 0.6, 1.0],
	"bordado_aurora": [8, "c8d8f0", "6ae8ff", "6ae8ff", 0.0, 0.6, 1.3],
	"couro_perola": [0, "d6d2ca", "000000", "000000", 0.0, 0.45, 1.0],
	"costura_aurora": [9, "d6d2ca", "8af0ff", "6ae8ff", 0.0, 0.5, 1.4],
	"couro_perola_escuro": [0, "7a7a86", "000000", "000000", 0.0, 0.45, 1.0],
	"prata": [1, "c8d0dc", "6a8aaa", "000000", 1.0, 0.22, 1.0],
	"cadarco_aurora": [7, "8af0ff", "000000", "8af0ff", 0.0, 0.4, 1.6],
	"prata_viva": [7, "c8f8ff", "000000", "a8f4ff", 0.0, 0.4, 1.6],
	"pano_aurora": [2, "1d5a86", "8af0ff", "000000", 0.0, 0.8, 1.2],
	"robe_azul": [2, "1f2f8a", "5a7aff", "000000", 0.0, 0.85, 1.0],
	"robe_verde": [2, "1f4a2a", "6ac07a", "000000", 0.0, 0.85, 1.0],
	"robe_roxo": [2, "3e1a6e", "b07aff", "000000", 0.0, 0.8, 1.0],
	"cetim_preto": [2, "141216", "8a7aa0", "000000", 0.0, 0.4, 1.0],
	"gema_verde": [3, "1a8a3a", "a0ffb0", "40e070", 0.0, 0.1, 1.8],
	"robe_negro": [2, "1a1416", "ff5a20", "000000", 0.0, 0.8, 1.0],
	"cetim_escuro": [2, "2a2a30", "8a8aa0", "000000", 0.0, 0.45, 1.0],
	"ouro_velho": [1, "c8a050", "6a4a18", "000000", 1.0, 0.35, 1.0],
	"cordao_preto": [0, "1a1818", "000000", "000000", 0.0, 0.8, 1.0],
	"pano_negro": [2, "201c1e", "ff5a20", "000000", 0.0, 0.85, 1.0],
	"couro_aurora": [0, "2c3a66", "000000", "000000", 0.0, 0.5, 1.0],
	"seda_aurora_tunica": [2, "e4ecf6", "7ad8ff", "000000", 0.0, 0.7, 1.0],
	"pano_noite": [2, "1a2036", "6ae8ff", "000000", 0.0, 0.85, 1.0],
	"seda_carmesim_esc": [2, "4c0c10", "ff5a20", "000000", 0.0, 0.6, 1.0],
}

static var _shader: Shader
static var _ruido: Texture2D
static var _mats := {}
static var _cenas := {} # arquivo -> {"malhas": [[nome, malha, skin ou null]]}

static func arquivo(traje: String, masc: bool, r: int) -> String:
	var base := "robe_" if traje == "roupao2" else "pecas3_"
	var a := PASTA + base + ("m_" if masc else "") + "r%d.glb" % r
	if masc and not ResourceLoader.exists(a):
		a = PASTA + base + "r%d.glb" % r # corpo masculino ainda sem arquivo próprio: usa o da moça
	return a

# vaga do equipamento de cada peça (pelo nome do nó no glb)
static func vaga(nome: String) -> String:
	var n := nome.to_lower()
	if n.contains("capuz") or n.begins_with("cabeca"):
		return "chapeu"
	if n.contains("bota"):
		return "botas"
	if n.contains("saia") or n.contains("tunica") or n.contains("calca"):
		return "calca"
	return "peitoral" # robe_tronco, manto, cordão, camisa, corpete, braçadeiras, cinto, bolsa

static func material(nome: String) -> Material:
	var k := nome.split(".")[0]
	if not M.has(k):
		k = "couro"
	if _mats.has(k):
		return _mats[k]
	if _shader == null:
		_shader = load(PASTA + "equip_novo.gdshader")
		var nt := NoiseTexture2D.new()
		nt.width = 128
		nt.height = 128
		nt.seamless = true
		nt.generate_mipmaps = true
		var fn := FastNoiseLite.new()
		fn.frequency = 0.03
		fn.fractal_octaves = 3
		nt.noise = fn
		_ruido = nt
	var d: Array = M[k]
	var sm := ShaderMaterial.new()
	sm.shader = _shader
	sm.set_shader_parameter("tipo", d[0])
	sm.set_shader_parameter("cor", Color(d[1]))
	sm.set_shader_parameter("cor2", Color(d[2]))
	sm.set_shader_parameter("luz", Color(d[3]))
	sm.set_shader_parameter("metal", d[4])
	sm.set_shader_parameter("aspereza", d[5])
	sm.set_shader_parameter("forca", d[6])
	sm.set_shader_parameter("ruido", _ruido)
	sm.set_meta("tipo2", d[0]) # tingir() só pinta pano (tipo 2)
	sm.set_meta("borda2", k.begins_with("cetim") or k.begins_with("bordado")) # barra/bordado: cor da borda do set
	_mats[k] = sm
	return sm

# abre o glb uma vez: malhas com o material da tabela e a pele ligada aos ossos pelo NOME (o esqueleto do glb é o
# da Ruiva/cabelo_m exportado pelo Blender; a ordem dos ossos pode ser outra no corpo do jogo)
static func _abrir(arq: String) -> Array:
	if _cenas.has(arq):
		return _cenas[arq]
	var out := []
	var ps = load(arq) if ResourceLoader.exists(arq) else null
	if ps is PackedScene:
		var cena: Node = ps.instantiate()
		for mi in cena.find_children("*", "MeshInstance3D", true, false):
			var malha: Mesh = mi.mesh
			if malha == null:
				continue
			malha = malha.duplicate()
			for s in malha.get_surface_count():
				var mo: Material = malha.surface_get_material(s)
				malha.surface_set_material(s, material(mo.resource_name if mo else "couro"))
			var skin: Skin = null
			var esq_glb: Skeleton3D = mi.get_node_or_null(mi.skeleton) as Skeleton3D if mi.skin else null
			if mi.skin and esq_glb:
				skin = mi.skin.duplicate()
				for b in skin.get_bind_count():
					var osso := skin.get_bind_bone(b)
					if skin.get_bind_name(b) == &"" and osso >= 0:
						skin.set_bind_name(b, esq_glb.get_bone_name(osso))
					skin.set_bind_bone(b, -1)
			# peça dura (capuz, cordão): vértices no espaço do corpo em descanso, presa no osso
			var osso_duro := ""
			if skin == null:
				var n := String(mi.name).to_lower()
				osso_duro = "J_Bip_C_Head" if n.begins_with("cabeca") or n.begins_with("capuz") else ("J_Bip_C_Hips" if n.begins_with("quadril") or n.begins_with("cordao") else "J_Bip_C_UpperChest")
			out.append([String(mi.name), malha, skin, osso_duro])
		cena.free()
	_cenas[arq] = out
	return out

# veste as peças da vaga k (raridade r) no nó no da armadura (filho do esqueleto)
static func montar(esq: Skeleton3D, no: Node3D, k: String, r: int, traje: String, masc: bool) -> void:
	var vk := "calca" if k == "short" else k
	for p in _abrir(arquivo(traje, masc, clampi(r, 0, 4))):
		if vaga(p[0]) != vk:
			continue
		var mi := MeshInstance3D.new()
		mi.mesh = p[1]
		mi.set_meta("equip2_nome", String(p[0])) # tingir() acha o pano da roupa e da calça por aqui
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		if p[2] != null:
			mi.skin = p[2]
			no.add_child(mi)
			mi.skeleton = mi.get_path_to(esq)
			continue
		var i := esq.find_bone(p[3])
		if i < 0:
			continue
		var ba := BoneAttachment3D.new()
		no.add_child(ba)
		ba.use_external_skeleton = true # o nó da armadura fica entre o esqueleto e a peça
		ba.external_skeleton = ba.get_path_to(esq)
		ba.bone_name = p[3]
		ba.add_child(mi)
		mi.transform = esq.get_bone_global_rest(i).affine_inverse()

# o pé da bota: o sapato do corpo vira couro da cor da bota de cada raridade
static func material_sapato(r: int) -> Material:
	return material(["couro", "couro_oleado", "couro_preto", "couro_negro", "couro_aurora"][clampi(r, 0, 4)])

# Espada e cajado feitos à mão (André 2026-11-23: "as armas já pode dar merge", junto com os trajes): no Patrulheiro 2 e
# no Roupão 2 a espada e o cajado do herói viram os de armas3_rN.glb, na raridade da arma equipada. Nos outros trajes
# (ou sem arma equipada) volta o modelo de hoje. A peça nova entra dentro do nó da arma (cabo na origem, ponta em +Y,
# a mesma regra de armas3d/espada.glb e cajado.glb), então mão, costas e golpe continuam iguais.
static func armas(espada: Node3D, cajado: Node3D, traje: String, r_espada: int, r_cajado: int) -> void:
	for par in [[espada, "espada", r_espada], [cajado, "cajado", r_cajado]]:
		var no: Node3D = par[0]
		if no == null:
			continue
		var r: int = par[2] if traje in TRAJES else -1
		var velha: Node = no.get_node_or_null("Arma2")
		if velha and int(velha.get_meta("r", -1)) == r:
			continue
		if velha:
			no.remove_child(velha)
			velha.queue_free()
		for mi in no.find_children("*", "MeshInstance3D", true, false):
			mi.visible = r < 0 # o modelo de hoje some só enquanto a arma nova está na mão
		if r < 0:
			continue
		for p in _abrir(PASTA + "armas3_r%d.glb" % clampi(r, 0, 4)):
			if not String(p[0]).begins_with(par[1]):
				continue
			var mi := MeshInstance3D.new()
			mi.name = "Arma2"
			mi.mesh = p[1]
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
			mi.set_meta("r", r)
			no.add_child(mi)
			break

# Cor livre no Patrulheiro 2 / Roupão 2 (André 2026-11-23, "por enquanto sim", mesmo sistema do PR 843): a cor de Roupa
# e de Calça da Aparência pinta só o PANO (tipo 2: túnica, robe, manto, capuz, saia, calça). Couro, metal, bordado,
# costura e gemas ficam como estão. cr / cc = null: volta à cor do set. O material pintado é copiado e guardado por
# cor (_tintas), então não pesa; a malha compartilhada não muda, só o material da peça (surface override).
static var _tintas := {}
# André 2026-11-25: cb = cor da "Borda do set" (aba Set da Aparência): pinta o cetim da gola/barra e o bordado. O pano
# principal (tipo 2 sem ser borda) segue a cor do set; null = a cor original.
static func tingir(mi: MeshInstance3D, cr, cc, cb = null) -> void:
	if mi.mesh == null:
		return
	var cor = cc if String(mi.get_meta("equip2_nome", "")).to_lower().contains("calca") else cr
	for s in mi.mesh.get_surface_count():
		var base: Material = mi.mesh.surface_get_material(s)
		var e_borda: bool = base != null and bool(base.get_meta("borda2", false))
		var c = cb if e_borda else cor
		if c == null or not (base is ShaderMaterial) or (not e_borda and int(base.get_meta("tipo2", -1)) != 2):
			mi.set_surface_override_material(s, null)
			continue
		var chave := "%d|%s" % [base.get_instance_id(), (c as Color).to_html()]
		if not _tintas.has(chave):
			var t: ShaderMaterial = base.duplicate()
			t.set_shader_parameter("cor", c)
			var c2: Color = base.get_shader_parameter("cor2")
			if c2.r + c2.g + c2.b > 0.01:
				t.set_shader_parameter("cor2", (c as Color).lightened(0.45 if e_borda else 0.3)) # linha do bordado / brilho de seda
			_tintas[chave] = t
		mi.set_surface_override_material(s, _tintas[chave])

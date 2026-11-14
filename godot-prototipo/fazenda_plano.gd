extends Node
# Planejar a fazenda (pedido do André, 2026-11-07): "eu escolho lá tudo que vai ser arado, vai ficar marcado. Quando eu
# salvo, aí ela começa a trabalhar, como se eu tivesse feito um planejamento de tudo que é pra ela fazer."
# No modo construção, aba Fazenda, Arar / Plantar / Regar / Colher só MARCAM o quadrado (toque no chão marca, toque de
# novo desmarca). O botão Salvar fecha o modo construção e o herói vai sozinho de canteiro em canteiro fazendo cada
# tarefa com animação: arar com a enxada (dois golpes), plantar e colher agachado com as mãos na terra, regar com o
# regador. Cada tarefa acaba mandando ao servidor o MESMO pedido de antes ("horta"), então as regras continuam as do
# servidor (vigor, sementes, água do regador, terra molhada, planta madura) e o aviso diz o motivo quando não dá.
# Desfazer a terra continua na hora, como antes. Mexer no joystick para o trabalho; o que faltou continua marcado.
# Uma ação por quadrado: arar tudo, Salvar; depois plantar tudo, Salvar (a conta é com a terra como está agora).

const Menu = preload("res://menu.gd")
const ACOES := ["arar", "plantar", "regar", "colher"]
const DUR := {"arar": 1.6, "plantar": 1.2, "regar": 1.4, "colher": 1.2} # s de cada tarefa
const LONGE := {"arar": 1.0, "plantar": 0.6, "regar": 0.75, "colher": 0.6} # m do herói até o meio do quadrado
const COR := {"arar": Color(0.86, 0.66, 0.38), "plantar": Color(0.45, 0.9, 0.42), "regar": Color(0.4, 0.72, 1.0), "colher": Color(1.0, 0.84, 0.35)}
# cores da moldura de luz (marca_fazenda.gdshader): tons quentes e suaves, nada de verde-marca-texto
const COR_MOLDURA := {"arar": Color(1.0, 0.78, 0.5), "plantar": Color(1.0, 0.9, 0.58), "regar": Color(0.62, 0.86, 1.0), "colher": Color(1.0, 0.8, 0.42)}
const SHADER_MARCA := preload("res://marca_fazenda.gdshader")
const TEMPO_IR := 6.0 # s para chegar a um quadrado; não chegou: pula (avisa)

var c # construcao.gd
var m # main.gd
var fila := {} # "i,j" -> {"acao", "c", "s"?}
var _marcas := {} # "i,j" -> Node3D (quadrado colorido no chão + ícone)
var trabalhando := false
var _atual := {} # tarefa de agora
var _estado := "" # "indo" ou "fazendo"
var _t := 0.0
var _golpe := -1
var _enxada: Node3D
var _regador: Node3D
var _mats := {}

func _init(construcao) -> void:
	c = construcao
	m = construcao.m

func planeja(acao: String) -> bool:
	return acao in ACOES

func quantos() -> int:
	return fila.size()

func _custo_vigor() -> float:
	return float(m.P.custo_vigor("faz", float(c.D.horta.vigor)))

# por que não dá para marcar (mot = o motivo de sempre da mira); "" = marca (ou desmarca, se já estava marcado igual)
func motivo_marcar(_L: Dictionary, dados: Dictionary, mot: String) -> String:
	var ja = fila.get(dados.c)
	if ja != null and ja.acao == dados.acao and str(ja.get("s", "")) == str(dados.get("s", "")):
		return ""
	if mot != "":
		return mot
	var n := 0 # tarefas já no plano (sem contar este quadrado, que pode estar trocando de ação)
	var sem := 0
	var regas := 0
	for k in fila:
		if k == dados.c:
			continue
		n += 1
		if fila[k].acao == "plantar" and fila[k].get("s", "") == dados.get("s", ""):
			sem += 1
		elif fila[k].acao == "regar":
			regas += 1
	if m.P.vigor() < _custo_vigor() * (n + 1):
		return "Sem vigor para mais tarefas: o plano já usa %d de vigor" % int(ceil(_custo_vigor() * n))
	if dados.acao == "plantar" and m.P.contar("semente_" + str(dados.s)) <= sem:
		return "As sementes de %s já estão todas no plano" % str(c.D.plantas[dados.s].nome).to_lower()
	if dados.acao == "regar" and m.P.contar("regador") > 0 and c.agua_regador() <= regas:
		return "A água do regador dá só para %d regas: encha no poço ou no lago" % c.agua_regador()
	return ""

# texto da mira quando dá
func dica(dados: Dictionary) -> String:
	var ja = fila.get(dados.c)
	if ja != null and ja.acao == dados.acao:
		return "Marcado: toque de novo para desmarcar"
	return "Toque para marcar · %d marcados · depois toque em Salvar" % fila.size()

func alternar(dados: Dictionary) -> void:
	var ja = fila.get(dados.c)
	if ja != null and ja.acao == dados.acao and str(ja.get("s", "")) == str(dados.get("s", "")):
		fila.erase(dados.c)
		m.sons.tocar("pano", -16.0)
	else:
		fila[dados.c] = dados.duplicate()
		m.sons.tocar("passo", -10.0)
	_refazer_marca(str(dados.c))

func limpar() -> void:
	parar()
	fila.clear()
	for k in _marcas.keys():
		_refazer_marca(k)

# ---------- marcas no chão ----------
func _mat(cor: Color) -> StandardMaterial3D:
	var k := cor.to_html()
	if not _mats.has(k):
		var mt := StandardMaterial3D.new()
		mt.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		mt.albedo_color = Color(cor, 0.42)
		mt.cull_mode = BaseMaterial3D.CULL_DISABLED
		_mats[k] = mt
	return _mats[k]

func _mat_moldura(acao: String) -> ShaderMaterial:
	var k := "moldura/" + acao
	if not _mats.has(k):
		var sm := ShaderMaterial.new()
		sm.shader = SHADER_MARCA
		sm.set_shader_parameter("cor", COR_MOLDURA.get(acao, Color(1.0, 0.9, 0.6)))
		_mats[k] = sm
	return _mats[k]

func _icone(acao: String, s: String) -> String:
	return {"arar": "cs_arar", "plantar": "it_semente_" + s, "regar": "cs_regar", "colher": "it_colheita"}[acao]

func _refazer_marca(k: String) -> void:
	if _marcas.has(k):
		_marcas[k].queue_free()
		_marcas.erase(k)
	if not fila.has(k):
		return
	var d: Dictionary = fila[k]
	var ij := k.split(",")
	var x := float(ij[0]) + 0.5
	var z := float(ij[1]) + 0.5
	var raiz := Node3D.new()
	raiz.position = Vector3(x, m.terreno.altura(x, z) + 0.12, z)
	add_child(raiz)
	var q := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(0.92, 0.92)
	q.mesh = pm
	q.material_override = _mat_moldura(str(d.acao)) # antes: _mat(COR[...]), quadrado chapado
	q.position.y = -0.07
	q.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	raiz.add_child(q)
	var ic := Sprite3D.new()
	ic.texture = Menu.icone_tex(_icone(d.acao, str(d.get("s", ""))))
	ic.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	ic.shaded = false
	ic.render_priority = 1
	ic.position = Vector3(0, 0.38, 0)
	if ic.texture:
		ic.pixel_size = 0.26 / float(ic.texture.get_width())
	ic.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	raiz.add_child(ic)
	# o ícone flutua devagar, subindo e descendo (cada canteiro num tempo diferente)
	var tw := ic.create_tween().set_loops()
	tw.set_trans(Tween.TRANS_SINE).set_ease(Tween.EASE_IN_OUT)
	var atraso := fmod(x * 0.37 + z * 0.61, 1.0) * 0.6
	tw.tween_property(ic, "position:y", 0.46, 0.9 + atraso)
	tw.tween_property(ic, "position:y", 0.34, 0.9 + atraso)
	_marcas[k] = raiz

# ---------- trabalhar ----------
func comecar() -> void:
	if fila.is_empty():
		return
	if not m.on():
		m.hud.aviso("A fazenda só funciona online")
		return
	if m.trabalho.coletando != null:
		m.trabalho.parar(true)
	if m.montaria != null: # montado no lobo: desce sozinho e vai a pé de canteiro em canteiro (André 2026-11-13)
		m.montar_lobo(false)
	trabalhando = true
	_estado = ""
	m.hud.aviso("Plano salvo: %d tarefas. Mexa no joystick para parar." % fila.size())

func parar(aviso := "") -> void:
	if not trabalhando:
		return
	trabalhando = false
	_estado = ""
	_atual = {}
	_soltar()
	if aviso != "":
		m.hud.aviso(aviso)

func andando() -> bool:
	return trabalhando and _estado == "indo"

func _alvo_pe(d: Dictionary) -> Vector2:
	var ij := str(d.c).split(",")
	var meio := Vector2(float(ij[0]) + 0.5, float(ij[1]) + 0.5)
	var h := Vector2(m.heroi.position.x, m.heroi.position.z)
	var v := h - meio
	if v.length() < 0.05:
		v = Vector2(0, -1)
	return meio + v.normalized() * float(LONGE[d.acao])

func _meio(d: Dictionary) -> Vector3:
	var ij := str(d.c).split(",")
	var x := float(ij[0]) + 0.5
	var z := float(ij[1]) + 0.5
	return Vector3(x, m.terreno.altura(x, z), z)

# direção para main.direcao_joystick (andando, devagar)
func direcao_auto() -> Vector3:
	if _atual.is_empty():
		return Vector3.ZERO
	var a: Vector2 = _atual.pe - Vector2(m.heroi.position.x, m.heroi.position.z)
	if a.length() < 0.05:
		return Vector3.ZERO
	return Vector3(a.x, 0, a.y).normalized() * (0.5 if a.length() > 0.6 else 0.3)

func _proxima() -> void:
	var L = c.lotes.get(c.meu)
	if L == null:
		parar()
		return
	# a mais perto do herói primeiro
	var h := Vector2(m.heroi.position.x, m.heroi.position.z)
	while not fila.is_empty():
		var melhor := ""
		var md := INF
		for k in fila:
			var ij: PackedStringArray = k.split(",")
			var dd := h.distance_squared_to(Vector2(float(ij[0]) + 0.5, float(ij[1]) + 0.5))
			if dd < md:
				md = dd
				melhor = k
		var d: Dictionary = fila[melhor]
		var ij2 := melhor.split(",")
		var mot: String = c.motivo_fazenda(L, d.acao, int(ij2[0]), int(ij2[1]), str(d.get("s", c.semente)))
		if mot == "":
			_atual = d.duplicate()
			_atual.pe = _alvo_pe(d)
			_estado = "indo"
			_t = 0.0
			return
		# falta vigor, água ou ferramenta: para e o resto fica marcado; o quadrado mudou (já arado, colhido): sai do plano
		if mot.begins_with("Sem vigor") or mot.begins_with("Regador sem água") or mot.begins_with("Precisa de "):
			parar(mot + " · o resto continua marcado")
			return
		m.hud.aviso(mot)
		fila.erase(melhor)
		_refazer_marca(melhor)
	parar("Plano da fazenda terminado!")

func _process(dt: float) -> void:
	var t0_parte := Time.get_ticks_usec()
	_process_parte(dt)
	if Time.get_ticks_usec() - t0_parte >= 1000 and Engine.has_meta("lentidao"): # quadro lento (lentidao.gd)
		Engine.get_meta("lentidao").ev("fazenda_plano", t0_parte)

func _process_parte(dt: float) -> void:
	if not trabalhando or m.heroi == null:
		return
	if m.h.morto > 0.0 or c.ativo or c.comprando:
		parar()
		return
	if m.hud.mover.length() > 0.35:
		parar("Trabalho parado: o resto continua marcado (abra a Fazenda e toque em Salvar)")
		return
	if _estado == "":
		_proxima()
		return
	_t += dt
	if _estado == "indo":
		if m.acao.size() > 0: # golpe, rolamento: espera
			return
		var falta: float = (_atual.pe - Vector2(m.heroi.position.x, m.heroi.position.z)).length()
		var meio := _meio(_atual)
		var ao_meio := Vector2(meio.x - m.heroi.position.x, meio.z - m.heroi.position.z).length()
		if falta < 0.22 or (_t > TEMPO_IR and ao_meio < float(LONGE[_atual.acao]) + 0.6):
			_comecar_tarefa()
		elif _t > TEMPO_IR:
			m.hud.aviso("Não deu para chegar nesse canteiro: pulei")
			fila.erase(_atual.c)
			_refazer_marca(_atual.c)
			_estado = ""
		return
	# fazendo
	var dur: float = DUR[_atual.acao]
	_animar(clampf(_t / dur, 0.0, 1.0), dt)
	if _t >= dur:
		var d: Dictionary = {"acao": _atual.acao, "c": _atual.c}
		if _atual.acao == "plantar":
			d.s = _atual.get("s", c.semente)
		m.rede("horta", d)
		fila.erase(_atual.c)
		_refazer_marca(_atual.c)
		_fim_tarefa()
		_estado = ""

func _comecar_tarefa() -> void:
	_estado = "fazendo"
	_t = 0.0
	_golpe = -1
	var meio := _meio(_atual)
	var d: Vector3 = meio - m.heroi.position
	m.mov.ry = atan2(d.x, d.z)
	m.mov.ry_mira = null
	m.heroi.rotation.y = m.mov.ry
	m.acao = {"nome": "fazenda", "t": 0.0, "dur": 1e9, "hits": [], "feitos": 0, "fn": func(_i): pass}
	m.h.pend = null
	m.armar("Coleta") # as duas armas nas costas, mãos livres
	if m.heroi_anim.has_animation("parada"):
		m.heroi_anim.play("parada", 0.2)
	m.trabalho._preparar_duas()
	if _atual.acao == "arar":
		_ferramenta("enxada").visible = true
	elif _atual.acao == "regar":
		_ferramenta("regador").visible = true

func _fim_tarefa() -> void:
	if m.acao.get("nome", "") == "fazenda":
		m.acao = {}
	for f in [_enxada, _regador]:
		if f:
			f.visible = false
	var du = m.trabalho.duas
	if du != null and is_instance_valid(du):
		du.peso = 0.0 # andando até o próximo canteiro: as pernas e os braços voltam para a animação

func _soltar() -> void:
	_fim_tarefa()
	m.armar(m.h.modo)
	m.espada.visible = true
	m.cajado.visible = true

# ---------- animação (duas_maos.gd: o corpo agacha, curva e as mãos vão onde o código manda) ----------
const ENX_PRONTO := {"ang": 40.0, "pe": Vector3(0.0, 1.0, 0.26), "ag": 0.05, "av": 0.0, "tor": 5.0, "cur": 0.25}
const ENX_ALTO := {"ang": 110.0, "pe": Vector3(0.0, 1.45, 0.22), "ag": 0.03, "av": -0.04, "tor": 8.0, "cur": -0.2}
const ENX_CHAO := {"ang": -48.0, "pe": Vector3(0.0, 0.95, 0.3), "ag": 0.16, "av": 0.06, "tor": -4.0, "cur": 1.0}
const ENX_COMP := 1.25 # m do cabo

func _animar(f: float, dt: float) -> void:
	var du = m.trabalho.duas
	if du == null or not is_instance_valid(du) or not du.pronto():
		return
	var h: Node3D = m.heroi
	var frente := Vector3(sin(h.rotation.y), 0, cos(h.rotation.y))
	var cima := Vector3.UP
	var dir: Vector3 = frente.cross(cima)
	var base: Vector3 = h.global_position
	du.peso = move_toward(du.peso, 1.0, dt * 6.0)
	var meio := _meio(_atual)
	if _atual.acao == "arar":
		# dois golpes: ergue, desce rápido até a terra, puxa de volta
		var n := mini(int(f * 2.0), 1)
		var g := fmod(f * 2.0, 1.0) if f < 1.0 else 1.0
		var A: Dictionary = ENX_PRONTO
		var B: Dictionary = ENX_ALTO
		var k := 0.0
		if g < 0.45:
			k = smoothstep(0.0, 1.0, g / 0.45)
		elif g < 0.6:
			A = ENX_ALTO
			B = ENX_CHAO
			k = pow((g - 0.45) / 0.15, 2.0)
		elif g < 0.75:
			A = ENX_CHAO
			B = ENX_CHAO
		else:
			A = ENX_CHAO
			B = ENX_PRONTO
			k = smoothstep(0.0, 1.0, (g - 0.75) / 0.25)
		if g >= 0.6 and _golpe != n:
			_golpe = n
			m.sons.tocar("pouso", -9.0, 0.1, meio)
			m.fx.surto(meio.x, meio.y + 0.1, meio.z, 10, "8a6a4a", "c9a27a", 2.2, 0.07)
		var ang: float = deg_to_rad(lerpf(A.ang, B.ang, k))
		var pe: Vector3 = (A.pe as Vector3).lerp(B.pe, k)
		var cabo: Vector3 = (frente * cos(ang) + cima * sin(ang)).normalized()
		var P0: Vector3 = base + dir * pe.x + cima * pe.y + frente * pe.z
		var z: Vector3 = dir.cross(cabo).normalized()
		var en := _ferramenta("enxada")
		en.global_transform = Transform3D(Basis(cabo.cross(z).normalized(), cabo, z), P0 - cabo * 0.12)
		du.mao_e = P0 + cabo * 0.02
		du.mao_d = P0 + cabo * 0.32
		du.cabo = cabo
		du.curva = lerpf(A.cur, B.cur, k)
		du.agacha = lerpf(A.ag, B.ag, k)
		du.avanco = lerpf(A.av, B.av, k)
		du.torcao = deg_to_rad(lerpf(A.tor, B.tor, k))
		return
	if _atual.acao == "regar":
		# em pé, meio curvado, o regador inclinado e a água caindo no canteiro
		var inc := smoothstep(0.0, 0.25, f) * (1.0 - smoothstep(0.85, 1.0, f))
		var mao: Vector3 = base + cima * (0.95 - 0.1 * inc) + frente * 0.42
		du.mao_d = mao + dir * 0.09
		du.mao_e = mao - dir * 0.09
		du.cabo = (frente + cima * 0.3).normalized()
		du.curva = 0.35 + 0.25 * inc
		du.agacha = 0.06
		du.avanco = 0.03
		du.torcao = 0.0
		var rg := _ferramenta("regador")
		var inclina := Basis(dir.normalized(), -0.75 * inc) # bico para baixo
		rg.global_transform = Transform3D(inclina * Basis.looking_at(-frente, cima), mao + cima * -0.12)
		if inc > 0.6 and int(_t * 8.0) != _golpe:
			_golpe = int(_t * 8.0)
			m.fx.surto(meio.x, meio.y + 0.45, meio.z, 4, "bfe6ff", "5aa8ff", 1.2, 0.05)
		return
	# plantar e colher: agachado, as mãos na terra, uma mão de cada vez
	var desce := smoothstep(0.0, 0.25, f) * (1.0 - smoothstep(0.85, 1.0, f))
	var bate := sin(f * TAU * 2.0)
	var chao: Vector3 = base + frente * 0.5 + cima * 0.32
	du.mao_d = chao + dir * 0.13 + cima * (0.06 * maxf(0.0, bate))
	du.mao_e = chao - dir * 0.13 + cima * (0.06 * maxf(0.0, -bate))
	du.cabo = frente
	du.curva = 1.3 * desce
	du.agacha = 0.36 * desce
	du.avanco = -0.04 * desce
	du.torcao = 0.0
	if f >= 0.5 and _golpe != 1:
		_golpe = 1
		if _atual.acao == "plantar":
			m.fx.surto(meio.x, meio.y + 0.1, meio.z, 8, "8a6a4a", "c9a27a", 1.6, 0.06)
			m.sons.tocar("passo", -8.0, 0.1, meio)
		else:
			m.fx.surto(meio.x, meio.y + 0.3, meio.z, 10, "8fd46a", "5fae4a", 2.0, 0.07)
			m.sons.tocar("pano", -6.0, 0.1, meio)

# ---------- enxada e regador (malha simples, madeira e metal) ----------
func _ferramenta(qual: String) -> Node3D:
	if qual == "enxada" and _enxada:
		return _enxada
	if qual == "regador" and _regador:
		return _regador
	var raiz := Node3D.new()
	var metal := StandardMaterial3D.new()
	metal.diffuse_mode = BaseMaterial3D.DIFFUSE_TOON
	metal.metallic = 0.6
	metal.roughness = 0.45
	if qual == "enxada":
		metal.albedo_color = Color("6d7178")
		var cabo := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.017
		cm.bottom_radius = 0.02
		cm.height = ENX_COMP
		cm.radial_segments = 8
		cm.rings = 1
		cabo.mesh = cm
		cabo.material_override = c._mat_tex("medieval_wood", Color("a07a52"), 3.0)
		cabo.position = Vector3(0, ENX_COMP / 2.0, 0)
		raiz.add_child(cabo)
		var lam := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.19, 0.016, 0.17)
		lam.mesh = bm
		lam.material_override = metal
		lam.position = Vector3(0, ENX_COMP - 0.02, -0.085)
		lam.rotation.x = 0.25
		raiz.add_child(lam)
		var anel := MeshInstance3D.new()
		var am := CylinderMesh.new()
		am.top_radius = 0.028
		am.bottom_radius = 0.028
		am.height = 0.06
		am.radial_segments = 8
		am.rings = 1
		anel.mesh = am
		anel.material_override = metal
		anel.position = Vector3(0, ENX_COMP - 0.03, 0)
		raiz.add_child(anel)
		_enxada = raiz
	else:
		metal.albedo_color = Color("7f9a8c") # cobre esverdeado
		var corpo := MeshInstance3D.new()
		var cm2 := CylinderMesh.new()
		cm2.top_radius = 0.085
		cm2.bottom_radius = 0.1
		cm2.height = 0.2
		cm2.radial_segments = 12
		cm2.rings = 1
		corpo.mesh = cm2
		corpo.material_override = metal
		raiz.add_child(corpo)
		var bico := MeshInstance3D.new()
		var bc := CylinderMesh.new()
		bc.top_radius = 0.012
		bc.bottom_radius = 0.02
		bc.height = 0.3
		bc.radial_segments = 6
		bc.rings = 1
		bico.mesh = bc
		bico.material_override = metal
		bico.position = Vector3(0, 0.06, -0.17) # -z = frente (looking_at)
		bico.rotation.x = -0.9
		raiz.add_child(bico)
		var alca := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 0.06
		tm.outer_radius = 0.075
		tm.rings = 12
		tm.ring_segments = 6
		alca.mesh = tm
		alca.material_override = metal
		alca.position = Vector3(0, 0.12, 0)
		alca.rotation.z = PI / 2.0
		raiz.add_child(alca)
		_regador = raiz
	for mi in raiz.find_children("*", "MeshInstance3D", true, false):
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	raiz.visible = false
	m.add_child(raiz)
	return raiz

extends CanvasLayer
# Comemoração (André 2026-11-11: "preciso gerar endorfina no jogo... quando você passa de nível parece que nada
# aconteceu"). Subir de nível, missão cumprida, coisa liberada, skill subindo, reforço e evoluir agora fazem festa:
# "janela do sistema" estilo anime no meio da tela (painel azul brilhante que abre rápido, texto nítido), faíscas azuis subindo, borda da tela acendendo, som próprio
# (sons/festa_*.ogg, ferramentas/sons/festa.py), câmera dando um "soco" leve e, no mundo, coluna de luz no herói.
# As faixas entram numa fila (uma depois da outra), então "Nível 12", "Liberado: ..." e "Missão nova" não se apagam
# mais um ao outro como no aviso de uma linha só.
# Estilo: André 2026-11-11 "cuidado para não exagerar e ficar brega" e "estilosa, estilo anime, tipo Solo Leveling"
# (só a ideia; desenho próprio, nenhum asset de lá).
# Desempenho (André: FPS antes de enfeite, Poco X7 e mais fracos): tudo 2D é desenhado num Control só, por _draw,
# e só enquanto tem festa na tela (parado = sem _process e sem redesenho). No 3D: um cilindro unshaded/aditivo
# (shader próprio, SH_COLUNA) por festa grande, apagado sozinho em ~2 s, e as faíscas que já existem.

const Efeitos = preload("res://efeitos.gd")
# coluna de luz da festa: cilindro aditivo sem luz e sem sombra; forte embaixo, some no alto, borda macia, riscos subindo
const SH_COLUNA := """
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;
uniform vec4 cor = vec4(0.48, 0.85, 1.0, 1.0);
uniform float op = 0.0;
uniform float alt = 8.0;
void fragment() {
	float h = (1.0 - UV.y) * alt;
	float sobe = 1.0 - smoothstep(0.0, alt, h);
	float borda = pow(abs(dot(NORMAL, VIEW)), 1.5);
	float faixa = fract(UV.x * 9.0);
	float risco = smoothstep(0.4, 0.5, faixa) * (1.0 - smoothstep(0.5, 0.6, faixa));
	risco *= smoothstep(0.0, 0.3, fract(h / 2.5 - TIME * 0.9 + floor(UV.x * 9.0) * 0.37));
	float base = 1.0 - smoothstep(0.0, 1.2, h);
	ALBEDO = mix(cor.rgb, vec3(1.0), base * 0.6 + risco * 0.4);
	ALPHA = clamp(op * borda * (sobe * 0.55 + risco * sobe * 0.9 + base * 0.5), 0.0, 1.0);
}
"""

const OURO := Color(1.0, 0.82, 0.36)
const OURO_CLARO := Color(1.0, 0.95, 0.75)
const VERDE := Color(0.55, 1.0, 0.5)
const VERMELHO := Color(1.0, 0.36, 0.28)
const CORES_FAISCA := [Color("7ad8ff"), Color("e6f8ff")]
const SISTEMA := Color("5fd3ff") # azul da "janela do sistema" (André 2026-11-11: estilo anime, tipo Solo Leveling)
const FUNDO := Color(0.02, 0.06, 0.12)
const MAX_FAISCAS := 80 # teto (celular fraco)

var m # main.gd
var _tela: Control
var fonte: Font
var _fila: Array = [] # faixas esperando: {tipo, cab, titulo, sub, cor, dur, grande}
var _atual: Dictionary = {}
var _t := 0.0
var _faiscas: Array = [] # {p, v, giro, w, h, cor, vida, vida0}
var _borda_t := 0.0
var _borda_cor := OURO
var _clarao_t := 0.0
var _colunas: Array = [] # {no, mat, t, dur, corpo}
var _ativo := false

func _init(principal) -> void:
	m = principal
	layer = 23 # acima do menu (20) e da janelinha do reforço (22): a festa aparece até com o menu aberto

func _ready() -> void:
	fonte = load("res://fontes/AlegreyaSans-Bold.ttf")
	_tela = Control.new()
	_tela.set_anchors_preset(Control.PRESET_FULL_RECT)
	_tela.mouse_filter = Control.MOUSE_FILTER_IGNORE # nunca rouba toque
	_tela.draw.connect(_desenhar)
	add_child(_tela)
	set_process(false)

# ---------------------------------------------------------------- entradas
# hud.aviso passa por aqui: o que é motivo de festa vira faixa (devolve true) e o resto segue como aviso normal
func do_aviso(t: String) -> bool:
	if t.begins_with("Nível ") and t.contains("!") and t.substr(6, t.find("!") - 6).is_valid_int():
		var nv := t.substr(6, t.find("!") - 6)
		var resto := t.substr(t.find("!") + 1).strip_edges()
		nivel(int(nv), resto)
		return true
	if t.begins_with("Missão cumprida: "):
		var nome := t.substr(17)
		var sub := ""
		var i := nome.rfind(" (+")
		if i > 0:
			sub = nome.substr(i + 2).trim_suffix(")")
			nome = nome.substr(0, i)
		missao(nome, sub)
		return true
	if t.begins_with("Título novo: "): # títulos com bônus (André 2026-11-12): "Título novo: Rei da Matilha (+5% crítico)"
		var nt := t.substr(13)
		var sub_t := "Use na aba Títulos do personagem"
		var it := nt.rfind(" (+")
		if it > 0:
			sub_t = nt.substr(it + 2).trim_suffix(")") + "  ·  aba Títulos"
			nt = nt.substr(0, it)
		_faixa({"tipo": "grande", "cab": "NOVO TÍTULO", "titulo": nt, "sub": sub_t, "cor": SISTEMA, "tit": Color("ffe7a8"), "dur": 3.0, "som": "festa_libera", "faiscas": 16})
		return true
	if t.begins_with("Liberado: "):
		liberado(t.substr(10))
		return true
	if t.begins_with("Missão nova"):
		_faixa({"tipo": "pequena", "cab": "NOVA MISSÃO", "titulo": t.trim_prefix("Missão nova: ").trim_prefix("Missão nova"), "cor": SISTEMA, "dur": 2.4, "som": "festa_libera"})
		return true
	if t.contains(" subiu para o Nv "): # profissão (minerar, lenhar, pescar...)
		var i := t.find(" subiu para o Nv ")
		_faixa({"tipo": "pequena", "cab": "PROFISSÃO MELHOROU", "titulo": "%s  Nv %s" % [t.substr(0, i), t.substr(i + 17).strip_edges()], "cor": SISTEMA, "dur": 2.4, "som": "festa_sucesso"})
		return true
	if t.contains(" subiu para Nv "): # skill subiu por uso ou por livro
		var i := t.find(" subiu para Nv ")
		var nv := t.substr(i + 15).trim_suffix("!").strip_edges()
		_faixa({"tipo": "pequena", "cab": "HABILIDADE MELHOROU", "titulo": "%s  Nv %s" % [t.substr(0, i), nv], "cor": SISTEMA, "dur": 2.2, "som": "festa_sucesso"})
		return true
	return false

# Boss de mundo (André 2026-11-12: "quando renascer, foi até anunciar assim na tela mesmo e depois sumir, mas ficar
# no chat permanente tá poluindo o visual"): o servidor manda a todos online (evento "anuncio") e aqui vira a janelinha
# do sistema que abre, fica uns segundos e some. Nada vai para o chat.
func anuncio(cab: String, titulo: String, tom: String) -> void:
	var cor: Color = VERMELHO if tom == "boss" else (OURO if tom == "mitico" else SISTEMA)
	_faixa({"tipo": "pequena", "cab": cab, "titulo": titulo, "cor": cor, "dur": 3.6, "som": "festa_libera" if tom != "caiu" else "festa_sucesso"})

# Subiu de nível (André 2026-11-11: "tem que ser mais pro canto, lá em cima, de maneira que não atrapalhe se o jogador
# estiver em combate, e já ter um botãozinho de atalho que te leva pra distribuir os pontos"): janelinha do sistema
# pequena no alto da tela, fora da fila do meio (missão e liberado seguem no meio sem esperar por ela), com o botão
# "+N PONTOS" que abre o menu do personagem na aba Status. Sem clarão na tela e sem soco na câmera; fica a coluna de
# luz no herói, o som e umas faíscas saindo da janelinha. Fica mais tempo aberta (dá tempo de tocar no atalho) e some sozinha.
const CANTO_DUR := 7.0 # com pontos para distribuir
const CANTO_DUR_SEM := 3.2
const CANTO_W := 236.0 # parte do texto
const CANTO_BT := 118.0 # botão do atalho
const CANTO_H := 60.0
const CANTO_TOPO := 6.0
var _canto: Dictionary = {} # {nv, pts, t, dur}

func nivel(nv: int, sub := "") -> void:
	var pts := 0
	var i := sub.find("+")
	if i >= 0 and sub.contains("ponto"):
		pts = int(sub.substr(i + 1).get_slice(" ", 0))
	if not _canto.is_empty() and float(_canto.t) < float(_canto.dur) - 0.3: # subiu de novo com a janelinha aberta: só atualiza
		_canto.nv = nv
		_canto.pts = int(_canto.pts) + pts
		_canto.t = min(float(_canto.t), 0.45)
		_canto.dur = CANTO_DUR
	else:
		_canto = {"nv": nv, "pts": pts, "t": 0.0, "dur": CANTO_DUR}
	_tocar("festa_nivel", -1.0)
	_borda(SISTEMA, 0.5)
	m.vibrar(40)
	_coluna(Color("7ad8ff"))
	_ligar()
	_soltar_faiscas(14, false, null, _canto_rect(_tela.size))

# pontos livres para o atalho: o que o jogo já sabe (progresso) ou, se ainda não chegou, o que veio no aviso
func _canto_pontos() -> int:
	var vivo := 0
	if m.P and m.P.get("prog") is Dictionary:
		vivo = int(m.P.prog.get("pontos", 0))
	return max(vivo, int(_canto.get("pts", 0)))

func _canto_rect(tam: Vector2) -> Rect2:
	var w: float = CANTO_W + (CANTO_BT if _canto_pontos() > 0 else 0.0)
	return Rect2(tam.x * 0.5 - w * 0.5, CANTO_TOPO, w, CANTO_H)

func _canto_botao(tam: Vector2) -> Rect2:
	var r := _canto_rect(tam)
	return Rect2(r.end.x - CANTO_BT + 4.0, r.position.y + 8.0, CANTO_BT - 12.0, r.size.y - 16.0)

# hud.gd pergunta antes de virar câmera/joystick: toque no botão "+N PONTOS" abre a aba Status e fecha a janelinha
func atalho(p: Vector2) -> bool:
	if _canto.is_empty() or _canto_pontos() <= 0 or float(_canto.t) < 0.25:
		return false
	if not _canto_botao(_tela.size).grow(10.0).has_point(p):
		return false
	_canto.dur = min(float(_canto.dur), float(_canto.t) + 0.22) # fecha encolhendo
	if m.menu:
		m.menu.abrir("status")
	return true

func missao(nome: String, sub := "") -> void:
	_faixa({"tipo": "grande", "cab": "MISSÃO CONCLUÍDA", "titulo": nome, "sub": sub, "cor": SISTEMA, "tit": Color("ffe7a8"), "dur": 3.2,
		"som": "festa_missao", "coluna": "9fe4ff", "faiscas": 30, "soco": 2.5})

# História v2 (André 2026-11-11): cartão de capítulo. Abre: "CAPÍTULO 3" + nome + a frase de efeito. Fecha: "CAPÍTULO 3
# CONCLUÍDO" + nome + o nível do próximo capítulo (o nome dele só aparece no Diário quando chegar no nível).
func capitulo(fase: String, n: int, nome: String, frase: String, prox) -> void:
	if fase == "abre":
		_faixa({"tipo": "grande", "cab": "CAPÍTULO %d" % n, "titulo": nome, "sub": frase, "cor": SISTEMA, "tit": Color("e6dcff"), "dur": 4.2,
			"som": "festa_missao", "coluna": "b9a4ff", "faiscas": 24, "soco": 2.0})
	else:
		var sub := ("Próximo capítulo no Nv %d" % int(prox.get("nv", 0))) if prox is Dictionary else "Fim do que já foi escrito. Continua..."
		_faixa({"tipo": "grande", "cab": "CAPÍTULO %d CONCLUÍDO" % n, "titulo": nome, "sub": sub, "cor": SISTEMA, "tit": Color("ffe7a8"), "dur": 3.8,
			"som": "festa_nivel", "faiscas": 30})

func liberado(txt: String) -> void:
	# várias coisas liberadas juntas (subiu 2 níveis, missão que abre zona) viram uma janela só
	for f in _fila:
		if f.tipo == "libera":
			f.titulo = str(f.titulo) + ", " + txt
			return
	_faixa({"tipo": "libera", "cab": "NOVO RECURSO LIBERADO", "titulo": txt, "cor": SISTEMA, "dur": 2.8, "som": "festa_libera", "faiscas": 10})

# evoluir deu certo (construcao.gd evoluiu): título e coluna de luz na cor da raridade nova
func evoluiu(nome: String, cor: Color, sorte: bool) -> void:
	_faixa({"tipo": "grande", "cab": "EVOLUÇÃO COM SORTE" if sorte else "EVOLUÇÃO CONCLUÍDA", "titulo": nome, "cor": SISTEMA, "tit": cor.lerp(Color.WHITE, 0.25),
		"dur": 3.0, "som": "festa_missao" if sorte else "festa_nivel", "coluna": cor.to_html(false), "faiscas": 26, "soco": 2.5, "tinta": cor})

# reforço (reforco.gd): certo = faíscas e borda azul (a cada +5 vira janela grande); falhou = borda vermelha e som
func reforco(ok: bool, e: int, nome := "") -> void:
	if not ok:
		falhou()
		return
	if e > 0 and e % 5 == 0:
		_faixa({"tipo": "grande", "cab": "REFORÇO +%d ALCANÇADO" % e, "titulo": nome if nome != "" else "+%d" % e, "cor": SISTEMA, "dur": 2.6,
			"som": "festa_nivel", "faiscas": 26, "coluna": "7ad8ff"})
		return
	_tocar("festa_sucesso", -3.0)
	_borda(SISTEMA, 0.6)
	_soltar_faiscas(14 + e, true)
	m.vibrar(25)
	_ligar()

func falhou() -> void:
	_tocar("festa_falha", -4.0)
	_borda(VERMELHO, 0.55)
	m.vibrar(60)
	_ligar()

# ---------------------------------------------------------------- fila
func _faixa(f: Dictionary) -> void:
	for k in ["sub", "titulo", "cab"]:
		f[k] = str(f.get(k, ""))
	_fila.append(f)
	if _atual.is_empty():
		_proxima()
	_ligar()

func _proxima() -> void:
	_atual = {}
	if _fila.is_empty():
		return
	_atual = _fila.pop_front()
	_t = 0.0
	var f := _atual
	if f.has("som"):
		_tocar(str(f.som), -1.0 if f.tipo == "grande" else -4.0)
	if f.tipo == "grande":
		_clarao_t = 0.28
		_borda(f.cor, 1.1)
		m.vibrar(70)
	else:
		_borda(f.cor, 0.6)
	if f.has("faiscas"):
		_soltar_faiscas(int(f.faiscas), false, f.get("tinta"))
	if f.has("coluna"):
		_coluna(Color(str(f.coluna)))
	if f.has("soco") and m.cam and m.cam.has_method("socar"):
		m.cam.socar(float(f.soco))
		m.cam.tremer(0.22)

func _ligar() -> void:
	_ativo = true
	set_process(true)

# som futurista da "janela do sistema" (André 2026-11-11: os festa_* ficaram "breguinhas"; sistema_* cortados do pacote
# grátis da The Audio Horizon SFX, ver sons/LICENCAS.md). Os festa_* continuam na pasta e voltam sozinhos se faltar o sistema_*.
const SOM_SISTEMA := {"festa_nivel": "sistema_nivel", "festa_missao": "sistema_nivel", "festa_libera": "sistema_janela",
	"festa_sucesso": "sistema_sucesso", "festa_falha": "sistema_falha"}

func _tocar(nome: String, vol: float) -> void:
	if m.sons:
		var novo: String = SOM_SISTEMA.get(nome, "")
		m.sons.tocar(novo if novo != "" and m.sons.tem(novo) else nome, vol, 0.0)

func _borda(cor: Color, dur: float) -> void:
	_borda_cor = cor
	_borda_t = dur

# ---------------------------------------------------------------- faíscas (2D, um _draw só)
func _soltar_faiscas(n: int, do_meio: bool, tinta = null, de = null) -> void:
	# André 2026-11-11: "cuidado para não exagerar e ficar brega". Nada de chuva de confete: faíscas douradas
	# pequenas que sobem devagar do meio da tela e piscam, como brasa de fogueira, e somem.
	var tam: Vector2 = _tela.size
	n = min(n, MAX_FAISCAS - _faiscas.size())
	for i in n:
		var p: Vector2
		var v: Vector2
		if de is Rect2: # janelinha do nível no alto: saem dela e descem um pouco, sem tampar o meio da tela
			var rr: Rect2 = de
			p = Vector2(randf_range(rr.position.x, rr.end.x), rr.end.y + randf_range(-6, 4))
			v = Vector2(randf_range(-25, 25), randf_range(10, 45))
		elif do_meio: # reforço: saem da janelinha
			p = tam * Vector2(0.5, 0.5) + Vector2(randf_range(-170, 170), randf_range(-30, 50))
			v = Vector2(randf_range(-25, 25), randf_range(-150, -60))
		else: # faixa grande: sobem da faixa para cima, espalhadas
			p = Vector2(tam.x * 0.5 + randf_range(-290, 290), tam.y * 0.36 + randf_range(-40, 70))
			v = Vector2(randf_range(-20, 20), randf_range(-130, -45))
		var cor: Color = CORES_FAISCA[randi() % 2] # ouro e ouro claro
		if tinta is Color and randf() < 0.6:
			cor = (tinta as Color).lerp(Color.WHITE, randf_range(0.1, 0.4))
		var vida := randf_range(1.2, 2.4)
		_faiscas.append({"p": p, "v": v, "giro": randf() * TAU, "gv": randf_range(5.0, 11.0), "w": randf_range(1.4, 2.6), "h": 0.0,
			"cor": cor, "vida": vida, "vida0": vida, "fase": randf() * TAU, "atraso": randf_range(0.0, 0.5)})

# ---------------------------------------------------------------- coluna de luz (3D, uma malha por festa grande)
func _coluna(cor: Color) -> void:
	if m.heroi == null or m.fx == null:
		return
	var p: Vector3 = m.heroi.global_position
	var col := MeshInstance3D.new()
	var cil := CylinderMesh.new()
	cil.top_radius = 0.8
	cil.bottom_radius = 0.6
	cil.height = 8.0
	cil.radial_segments = 24
	cil.rings = 1
	cil.cap_top = false
	cil.cap_bottom = false
	col.mesh = cil
	var mat: ShaderMaterial = m.fx.material("coluna_festa", SH_COLUNA, {"cor": cor, "op": 0.0, "alt": 0.1})
	col.material_override = mat
	col.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	m.fx.add_child(col)
	col.global_position = p + Vector3(0, 4.0, 0)
	_colunas.append({"no": col, "mat": mat, "t": 0.0, "dur": 2.2})
	var hx := cor.to_html(false)
	m.fx.anel(p.x, p.z, 2.6, hx, 0.9, p.y)
	m.fx.anel(p.x, p.z, 1.4, "ffffff", 0.6, p.y)
	m.fx.surto(p.x, p.y + 1.1, p.z, 40, "ffffff", hx, 6.0, 0.1)

# ---------------------------------------------------------------- tempo
func _process(dt: float) -> void:
	var t0_parte := Time.get_ticks_usec()
	_process_parte(dt)
	if Time.get_ticks_usec() - t0_parte >= 1000 and Engine.has_meta("lentidao"): # quadro lento (lentidao.gd)
		Engine.get_meta("lentidao").ev("festa", t0_parte)

func _process_parte(dt: float) -> void:
	if not _atual.is_empty():
		_t += dt
		if _t >= float(_atual.dur):
			_proxima()
	if not _canto.is_empty():
		_canto.t = float(_canto.t) + dt
		if float(_canto.t) >= float(_canto.dur) or (m.menu and m.menu.aberto() and float(_canto.t) > 0.3):
			_canto = {}
	_borda_t = max(0.0, _borda_t - dt)
	_clarao_t = max(0.0, _clarao_t - dt)
	var i := _faiscas.size() - 1
	while i >= 0:
		var c: Dictionary = _faiscas[i]
		if c.atraso > 0.0:
			c.atraso -= dt
		else:
			c.vida -= dt
			c.giro += c.gv * dt
			var v: Vector2 = c.v
			v *= pow(0.55, dt) # vão perdendo força e flutuam
			c.v = v
			c.p = c.p + v * dt + Vector2(sin(c.vida * 3.0 + c.fase) * 14.0 * dt, 0)
		if c.vida <= 0.0:
			_faiscas.remove_at(i)
		i -= 1
	i = _colunas.size() - 1
	while i >= 0:
		var k: Dictionary = _colunas[i]
		k.t += dt
		var u: float = k.t / k.dur
		var sobe: float = clamp(k.t / 0.35, 0.0, 1.0)
		k.mat.set_shader_parameter("alt", 8.0 * (1.0 - pow(1.0 - sobe, 3.0)))
		k.mat.set_shader_parameter("op", clamp(k.t / 0.12, 0.0, 1.0) * (1.0 - smoothstep(0.55, 1.0, u)))
		if is_instance_valid(m.heroi): # acompanha o herói se ele andar
			var p: Vector3 = m.heroi.global_position
			k.no.global_position = Vector3(p.x, p.y + 4.0, p.z)
		if u >= 1.0:
			k.no.queue_free()
			_colunas.remove_at(i)
		i -= 1
	_tela.queue_redraw()
	if _atual.is_empty() and _canto.is_empty() and _faiscas.is_empty() and _colunas.is_empty() and _borda_t <= 0.0 and _clarao_t <= 0.0:
		_ativo = false
		set_process(false)

# ---------------------------------------------------------------- desenho
func _desenhar() -> void:
	if not _ativo:
		return
	var tam: Vector2 = _tela.size
	if _clarao_t > 0.0: # clarão rápido da tela
		_tela.draw_rect(Rect2(Vector2.ZERO, tam), Color(0.62, 0.86, 1.0, 0.12 * _clarao_t / 0.28))
	if _borda_t > 0.0:
		_desenhar_borda(tam, clamp(_borda_t / 0.5, 0.0, 1.0))
	if not _atual.is_empty():
		_desenhar_faixa(tam)
	if not _canto.is_empty():
		_desenhar_canto(tam)
	for c in _faiscas:
		if c.atraso > 0.0:
			continue
		var a: float = clamp(c.vida / 0.6, 0.0, 1.0) * clamp((c.vida0 - c.vida) / 0.2, 0.0, 1.0)
		a *= 0.65 + 0.35 * sin(c.giro) # pisca
		var cor: Color = c.cor
		_tela.draw_circle(c.p, c.w * 3.2, Color(cor, 0.16 * a))
		_tela.draw_circle(c.p, c.w, Color(cor.lerp(Color.WHITE, 0.5), a))

# brilho entrando pelas bordas da tela (4 degradês)
func _desenhar_borda(tam: Vector2, a: float) -> void:
	var w: float = min(tam.x, tam.y) * 0.16
	var c0 := Color(_borda_cor, 0.32 * a)
	var c1 := Color(_borda_cor, 0.0)
	var cs := PackedColorArray([c0, c0, c1, c1])
	_tela.draw_polygon(PackedVector2Array([Vector2(0, 0), Vector2(tam.x, 0), Vector2(tam.x - w, w), Vector2(w, w)]), cs)
	_tela.draw_polygon(PackedVector2Array([Vector2(0, tam.y), Vector2(tam.x, tam.y), Vector2(tam.x - w, tam.y - w), Vector2(w, tam.y - w)]), cs)
	_tela.draw_polygon(PackedVector2Array([Vector2(0, 0), Vector2(0, tam.y), Vector2(w, tam.y - w), Vector2(w, w)]), cs)
	_tela.draw_polygon(PackedVector2Array([Vector2(tam.x, 0), Vector2(tam.x, tam.y), Vector2(tam.x - w, tam.y - w), Vector2(tam.x - w, w)]), cs)

static func _volta(x: float) -> float: # ease-out com passadinha
	var c1 := 1.70158
	var c3 := c1 + 1.0
	return 1.0 + c3 * pow(x - 1.0, 3.0) + c1 * pow(x - 1.0, 2.0)

# Janela do "sistema" (estilo anime, André 2026-11-11): painel azul-escuro translúcido com borda azul brilhante,
# cantoneiras, linhas de varredura fracas. Abre rápido: um risco de luz cresce na horizontal (0,12 s) e o painel abre
# na vertical (0,14 s); o texto pisca duas vezes ao entrar, como tela ligando. Fecha encolhendo de volta para o risco.
func _desenhar_faixa(tam: Vector2) -> void:
	var f := _atual
	var dur: float = f.dur
	var grande: bool = f.tipo == "grande"
	var cor: Color = f.cor
	var W: float = min(tam.x * 0.9, 600.0 if grande else 470.0)
	var H: float = (138.0 if f.sub != "" else 116.0) if grande else 84.0
	var cx: float = tam.x * 0.5
	var cy: float = tam.y * (0.36 if grande else 0.25)
	# abrir / fechar
	var risco: float = clamp(_t / 0.12, 0.0, 1.0)
	var abre: float = clamp((_t - 0.12) / 0.14, 0.0, 1.0)
	var fecha: float = clamp((dur - _t) / 0.22, 0.0, 1.0) # 1 = aberto, 0 = fechado
	var w: float = W * (1.0 - pow(1.0 - risco, 3.0)) * (0.4 + 0.6 * clamp(fecha * 2.0, 0.0, 1.0))
	var h: float = max(2.0, H * (1.0 - pow(1.0 - abre, 3.0)) * min(1.0, fecha * 1.6))
	var a: float = min(1.0, risco * 2.0) * clamp(fecha * 3.0, 0.0, 1.0)
	var r := Rect2(cx - w * 0.5, cy - h * 0.5, w, h)
	# brilho difuso atrás (3 retângulos cada vez maiores e mais fracos)
	for k in 3:
		var g: float = 6.0 + k * 9.0
		_caixa(r.grow(g), RAIO + g, Color(cor, (0.07 - k * 0.02) * a))
	var ra: float = min(RAIO, h * 0.5)
	_caixa(r, ra, Color(FUNDO, 0.86 * a))
	# faixa mais clara no topo do painel (cabeçalho), arredondada só em cima
	if h > 30.0:
		_caixa(Rect2(r.position, Vector2(w, min(h, 30.0))), ra, Color(cor, 0.10 * a), 0.0, true)
	# linhas de varredura fracas e uma barra de luz descendo logo que abre
	var yy: float = r.position.y + 3.0
	while yy < r.end.y:
		var e: float = _recuo(r, ra, yy)
		_tela.draw_line(Vector2(r.position.x + e, yy), Vector2(r.end.x - e, yy), Color(cor, 0.035 * a), 1.0)
		yy += 4.0
	if abre > 0.0 and _t < 0.9:
		var by: float = r.position.y + h * clamp((_t - 0.2) / 0.6, 0.0, 1.0)
		var y0: float = max(r.position.y, by - 6.0)
		var y1: float = min(r.end.y, by + 6.0)
		var e2: float = max(_recuo(r, ra, y0), _recuo(r, ra, y1))
		if y1 > y0:
			_tela.draw_rect(Rect2(r.position.x + e2, y0, w - e2 * 2.0, y1 - y0), Color(cor, 0.10 * a))
	# borda e cantoneiras
	_caixa(r, ra, Color(cor, 0.85 * a), 1.5)
	_caixa(r.grow(3.0), ra + 3.0, Color(cor, 0.18 * a), 1.0)
	_cantos(r.grow(3.0), ra + 3.0, min(18.0, h * 0.4), Color(cor.lerp(Color.WHITE, 0.45), a), 3.0)
	if abre < 0.6:
		return
	# texto: pisca ao entrar (liga, apaga, liga) e assenta
	var tt: float = _t - 0.2
	var pisca: float = 1.0 if tt > 0.22 else (0.35 if fmod(tt, 0.08) < 0.04 else 1.0)
	var at: float = a * clamp(tt / 0.1, 0.0, 1.0) * pisca
	# cabeçalho: losango com "!" e o título da janela, letras espaçadas
	var cab: String = _espacar(f.cab)
	var t_cab: int = 17 if grande else 14
	var y_cab: float = r.position.y + (21.0 if grande else 19.0)
	var wc: float = fonte.get_string_size(cab, HORIZONTAL_ALIGNMENT_LEFT, -1, t_cab).x
	var lx: float = cx - wc * 0.5 - 20.0
	var ly: float = y_cab - t_cab * 0.36
	_tela.draw_colored_polygon(PackedVector2Array([Vector2(lx, ly - 8), Vector2(lx + 8, ly), Vector2(lx, ly + 8), Vector2(lx - 8, ly)]), Color(cor, 0.9 * at))
	_tela.draw_string(fonte, Vector2(lx - 2.5, ly + 5.0), "!", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(FUNDO, at))
	_texto_centro(cab, Vector2(cx, y_cab), t_cab, cor.lerp(Color.WHITE, 0.25), at, 1.0, 0, cor)
	# título grande, branco com brilho azul (ou na cor de raridade / ouro da missão)
	var titulo: String = f.titulo
	var t_tit: int = 46 if grande else 26
	while t_tit > 18 and fonte.get_string_size(titulo, HORIZONTAL_ALIGNMENT_LEFT, -1, t_tit).x > w - 40.0:
		t_tit -= 2
	var y_tit: float = (cy + t_tit * 0.42 + 4.0 - (10.0 if f.sub != "" else 0.0)) if grande else cy + t_tit * 0.42 + 8.0
	var esc: float = 1.0 + (1.0 - _volta(clamp(tt / 0.3, 0.0, 1.0))) * 0.12
	_texto_centro(titulo, Vector2(cx, y_tit), t_tit, f.get("tit", Color(0.93, 0.98, 1.0)), at, esc, 0, cor)
	if grande and f.sub != "":
		_texto_centro(f.sub, Vector2(cx, r.end.y - 14.0), 17, Color(0.72, 0.86, 0.95), at * clamp((tt - 0.25) / 0.2, 0.0, 1.0), 1.0, 0, cor)

# janelinha do nível no alto (mesmo visual da janela do sistema, pequena): abre num risco de luz, texto à esquerda
# ("NÍVEL AUMENTOU" / "NÍVEL 12") e, com pontos livres, o botão "+N PONTOS / DISTRIBUIR" à direita, que pulsa de leve
func _desenhar_canto(tam: Vector2) -> void:
	var t: float = _canto.t
	var dur: float = _canto.dur
	var cor := SISTEMA
	var R := _canto_rect(tam)
	var risco: float = clamp(t / 0.12, 0.0, 1.0)
	var abre: float = clamp((t - 0.12) / 0.14, 0.0, 1.0)
	var fecha: float = clamp((dur - t) / 0.22, 0.0, 1.0)
	var w: float = R.size.x * (1.0 - pow(1.0 - risco, 3.0)) * (0.4 + 0.6 * clamp(fecha * 2.0, 0.0, 1.0))
	var h: float = max(2.0, R.size.y * (1.0 - pow(1.0 - abre, 3.0)) * min(1.0, fecha * 1.6))
	var a: float = min(1.0, risco * 2.0) * clamp(fecha * 3.0, 0.0, 1.0)
	var r := Rect2(R.get_center().x - w * 0.5, R.get_center().y - h * 0.5, w, h)
	for k in 2:
		_caixa(r.grow(4.0 + k * 6.0), RAIO_CANTO + 4.0 + k * 6.0, Color(cor, (0.06 - k * 0.02) * a))
	var ra: float = min(RAIO_CANTO, h * 0.5)
	_caixa(r, ra, Color(FUNDO, 0.84 * a))
	var yy: float = r.position.y + 3.0
	while yy < r.end.y:
		var e: float = _recuo(r, ra, yy)
		_tela.draw_line(Vector2(r.position.x + e, yy), Vector2(r.end.x - e, yy), Color(cor, 0.035 * a), 1.0)
		yy += 4.0
	_caixa(r, ra, Color(cor, 0.85 * a), 1.5)
	_cantos(r.grow(2.0), ra + 2.0, min(12.0, h * 0.4), Color(cor.lerp(Color.WHITE, 0.45), a), 2.5)
	if abre < 0.6:
		return
	var tt: float = t - 0.2
	var pisca: float = 1.0 if tt > 0.22 else (0.35 if fmod(tt, 0.08) < 0.04 else 1.0)
	var at: float = a * clamp(tt / 0.1, 0.0, 1.0) * pisca
	var cx: float = R.position.x + CANTO_W * 0.5
	_texto_centro(_espacar("NÍVEL AUMENTOU"), Vector2(cx, R.position.y + 19.0), 12, cor.lerp(Color.WHITE, 0.25), at, 1.0, 0, cor)
	var esc: float = 1.0 + (1.0 - _volta(clamp(tt / 0.3, 0.0, 1.0))) * 0.12
	_texto_centro("NÍVEL  %d" % int(_canto.nv), Vector2(cx, R.position.y + 49.0), 27, Color(0.93, 0.98, 1.0), at, esc, 0, cor)
	var pts := _canto_pontos()
	if pts <= 0:
		return
	# botão do atalho: separador fino, caixa azul que pulsa devagar
	var b := _canto_botao(tam)
	_tela.draw_line(Vector2(b.position.x - 7.0, R.position.y + 10.0), Vector2(b.position.x - 7.0, R.end.y - 10.0), Color(cor, 0.35 * at), 1.0)
	var pulso: float = 0.5 + 0.5 * sin(t * 4.0)
	_caixa(b.grow(2.0 + pulso * 2.0), RAIO_BOTAO + 2.0 + pulso * 2.0, Color(cor, (0.06 + 0.08 * pulso) * at))
	_caixa(b, RAIO_BOTAO, Color(cor, 0.22 * at))
	_caixa(b, RAIO_BOTAO, Color(cor.lerp(Color.WHITE, 0.3), 0.9 * at), 1.5)
	var bx: float = b.get_center().x
	_texto_centro("+%d PONTOS" % pts, Vector2(bx, b.position.y + 19.0), 15, Color(1.0, 0.95, 0.75), at, 1.0, 0, cor)
	_texto_centro("DISTRIBUIR  ▸", Vector2(bx, b.position.y + 36.0), 11, cor.lerp(Color.WHITE, 0.5), at, 1.0, 0, cor)

# Cantos arredondados (André 2026-11-11: "as bordinhas um pouco mais arredondadas"; cor e o resto iguais).
# Tudo pelo StyleBoxFlat (um só, reaproveitado): fundo cheio, ou só a borda quando largura > 0.
const RAIO := 16.0 # janela do meio (igual às janelas pop-up, Menu.RAIO_JANELA)
const RAIO_CANTO := 12.0 # janelinha do nível no alto
const RAIO_BOTAO := 8.0 # botão "+N PONTOS"
var _sb: StyleBoxFlat

func _caixa(r: Rect2, raio: float, cor: Color, largura := 0.0, so_em_cima := false) -> void:
	if cor.a <= 0.003 or r.size.x <= 0.0 or r.size.y <= 0.0:
		return
	if _sb == null:
		_sb = StyleBoxFlat.new()
		_sb.anti_aliasing = true
		_sb.corner_detail = 8
	var rr: int = int(round(min(raio, r.size.y * 0.5, r.size.x * 0.5)))
	_sb.corner_radius_top_left = rr
	_sb.corner_radius_top_right = rr
	_sb.corner_radius_bottom_left = 0 if so_em_cima else rr
	_sb.corner_radius_bottom_right = 0 if so_em_cima else rr
	if largura > 0.0:
		_sb.draw_center = false
		_sb.set_border_width_all(int(ceil(largura)))
		_sb.border_color = cor
	else:
		_sb.draw_center = true
		_sb.set_border_width_all(0)
		_sb.bg_color = cor
	_sb.draw(_tela.get_canvas_item(), r)

# quanto a linha na altura y entra para dentro por causa do canto arredondado (linhas de varredura não vazam)
static func _recuo(r: Rect2, raio: float, y: float) -> float:
	var d: float = min(y - r.position.y, r.end.y - y)
	if d >= raio:
		return 0.0
	var k: float = raio - max(d, 0.0)
	return raio - sqrt(max(raio * raio - k * k, 0.0))

# cantoneiras claras acompanhando a curva: arco de 90° em cada canto e um trechinho reto saindo dele
func _cantos(r: Rect2, raio: float, c: float, cor: Color, larg: float) -> void:
	raio = min(raio, r.size.y * 0.5)
	var reto: float = max(c - raio * 0.6, 2.0)
	for q in [[Vector2(1, 1), PI], [Vector2(-1, 1), PI * 1.5], [Vector2(-1, -1), 0.0], [Vector2(1, -1), PI * 0.5]]:
		var dirv: Vector2 = q[0]
		var canto := Vector2(r.position.x if dirv.x > 0 else r.end.x, r.position.y if dirv.y > 0 else r.end.y)
		var centro: Vector2 = canto + dirv * raio
		_tela.draw_arc(centro, raio, q[1], q[1] + PI * 0.5, 10, cor, larg, true)
		_tela.draw_line(Vector2(centro.x, canto.y), Vector2(centro.x + dirv.x * reto, canto.y), cor, larg, true)
		_tela.draw_line(Vector2(canto.x, centro.y), Vector2(canto.x, centro.y + dirv.y * reto), cor, larg, true)

func _espacar(s: String) -> String:
	var out := ""
	for i in s.length():
		out += ("   " if s[i] == " " else s[i] + (" " if i < s.length() - 1 and s[i + 1] != " " else ""))
	return out

# texto centrado com brilho (contorno largo e fraco na cor do sistema) e contorno escuro fino
func _texto_centro(s: String, base: Vector2, tam: int, cor: Color, a: float, escala: float, _contorno: int, brilho: Color) -> void:
	if a <= 0.01 or s == "":
		return
	var w: float = fonte.get_string_size(s, HORIZONTAL_ALIGNMENT_LEFT, -1, tam).x
	_tela.draw_set_transform(base, 0.0, Vector2(escala, escala))
	var p := Vector2(-w * 0.5, 0)
	_tela.draw_string_outline(fonte, p, s, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, 10, Color(brilho, 0.16 * a))
	_tela.draw_string_outline(fonte, p, s, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, 5, Color(brilho, 0.28 * a))
	_tela.draw_string_outline(fonte, p, s, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, 2, Color(0.0, 0.03, 0.08, 0.9 * a))
	_tela.draw_string(fonte, p, s, HORIZONTAL_ALIGNMENT_LEFT, -1, tam, Color(cor, a))
	_tela.draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

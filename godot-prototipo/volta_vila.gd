extends Node
# Voltar para a vila e o lugar onde o herói estava (André 2026-11-03).
# - Lugar: saiu do jogo longe da vila, entra de volta no mesmo lugar; só a morte leva para a praça. Online quem guarda é o
#   servidor (na conta, Simulacao.guardarPosicao) e a primeira foto do mundo traz o herói para lá (online.gd). Aqui o
#   aparelho também guarda (user://lugar.cfg), para o Jogar sozinho voltar onde estava e a capa abrir já no lugar certo.
# - Casinha no menu do topo (menu_topo.gd): canalização lenta (voltaVila.canal s) parado, com o círculo dourado no chão,
#   faíscas subindo e a coluna de luz (efeitos.gd volta_vila). Andar, atacar, pular, coletar ou levar dano cancela.
#   Chegou: aparece na praça e a casinha fica em recarga (voltaVila.cd s = 10 min, como no Quimera). A recarga fica no
#   progresso (vilaAte, relógio do servidor), então sair e entrar não zera. Online quem decide é o servidor.

const D = preload("res://dados.gd")
const ARQUIVO := "user://lugar.cfg"
const GUARDAR_CADA := 20.0 # s entre uma gravação do lugar e outra (fora do quadro, sem tranco)
const ESPERA_SERVIDOR := 3.0 # s depois do fim da canalização esperando o servidor confirmar

var m # main.gd
var V := {"canal": 8.0, "cd": 600.0, "vila": 30.0} # shared/dados.js VOLTA_VILA (vem em habilidades.json)
var canal := {} # canalização em andamento: {"t": s, "dur": s}
var _congelou := false
var _guardar_t := GUARDAR_CADA
var _tarefa := -1
var _ultimo := Vector3(INF, 0, 0)

func _init(principal) -> void:
	m = principal
	var vv = m.P.dados.get("voltaVila")
	if vv is Dictionary:
		for k in vv:
			V[k] = float(vv[k])

func ativo() -> bool:
	return not canal.is_empty()

# 0..1 da canalização (barra no meio da tela); -1 = nenhuma
func progresso() -> float:
	return clamp(canal.t / canal.dur, 0.0, 1.0) if ativo() else -1.0

# segundos que faltam para a casinha voltar
func falta() -> float:
	return max(0.0, (float(m.P.prog.get("vilaAte", 0.0)) - m.P.agora_ms()) / 1000.0)

static func tempo_txt(s: float) -> String:
	var n := int(ceil(s))
	return "%d:%02d" % [n / 60, n % 60]

func na_vila() -> bool:
	return Vector2(m.heroi.position.x - D.NASCIMENTO.x, m.heroi.position.z - D.NASCIMENTO.z).length() < V.vila

# ---------- casinha ----------
func pedir() -> void:
	if m.h.morto > 0.0 or m.criador.aberto():
		return
	if ativo(): # tocou de novo: desiste
		cancelar("Volta para a vila cancelada")
		m.rede("vila") # o servidor também desiste (o mesmo pedido de novo cancela)
		return
	var f := falta()
	if f > 0.0:
		m.hud.aviso("Voltar para a vila: pronto em %s" % tempo_txt(f))
		return
	if na_vila():
		m.hud.aviso("Você já está na vila")
		return
	if m.mov.esc != null or not m.mov.chao:
		m.hud.aviso("Fique no chão para voltar para a vila")
		return
	if m.acao.get("canal", false):
		m.cancelar_canal("")
	m.acao = {}
	m.h.segurando = false
	m.fila = null
	if m.trabalho.coletando != null:
		m.trabalho.parar(true)
	m.rede("vila")
	canal = {"t": 0.0, "dur": V.canal}
	_congelou = false
	# a mão sobe devagar (a mesma magia da Cura, em câmera lenta) e fica erguida enquanto o círculo carrega
	m.heroi_anim.play("cura", 0.35, 0.5)
	m.fx.volta_vila(m.heroi, V.canal)

# Totem de teleporte (André 2026-11-10, totem.gd): a mesma canalização, para o totem escolhido, sem recarga e pagando a
# taxa ao chegar. Online o servidor confere tudo de novo (Simulacao.irTotem) e manda o evento "vila" com o totem.
func pedir_totem(t: Dictionary) -> void:
	if m.h.morto > 0.0 or m.criador.aberto():
		return
	if ativo():
		cancelar("Viagem cancelada")
		m.rede("vila")
		return
	if m.mov.esc != null or not m.mov.chao:
		m.hud.aviso("Fique no chão para viajar")
		return
	if m.acao.get("canal", false):
		m.cancelar_canal("")
	m.acao = {}
	m.h.segurando = false
	m.fila = null
	if m.trabalho.coletando != null:
		m.trabalho.parar(true)
	m.rede("totem", {"para": str(t.id)})
	canal = {"t": 0.0, "dur": float(m.totem.T.canal), "totem": t}
	_congelou = false
	m.heroi_anim.play("cura", 0.35, 0.5)
	m.fx.volta_vila(m.heroi, float(m.totem.T.canal))

# texto da barra do meio da tela
func texto() -> String:
	return "Viajando para %s" % canal.totem.nome if ativo() and canal.has("totem") else "Voltando para a vila"

func cancelar(motivo := "Volta para a vila cancelada") -> void:
	if not ativo():
		return
	if canal.has("totem"): # totem: "viagem", não "volta para a vila"
		motivo = motivo.replace("Volta para a vila", "Viagem").replace("volta para a vila", "viagem")
	canal = {}
	m.fx.volta_vila_fim(m.heroi, false)
	if motivo != "":
		m.hud.aviso(motivo)
	if m.h.morto <= 0.0 and m.acao.is_empty():
		m.heroi_anim.play("parada" if m.h.modo == "Magia" else "espada_parada", 0.3)

# chegou na praça (sozinho: aqui mesmo; online: o servidor manda onde, no evento "vila"). totem: chegou num totem
func chegar(para: Vector3, totem_id := "") -> void:
	var de: Vector3 = m.heroi.position
	if totem_id == "" and canal.has("totem") and not m.on():
		totem_id = str(canal.totem.id)
	canal = {}
	m.acao = {}
	m.mov.por_em(para)
	m.heroi.position = m.mov.posicao()
	m.cam.colocar(m.heroi.position)
	m.fx.volta_vila_fim(m.heroi, true, de)
	m.heroi_anim.play("parada" if m.h.modo == "Magia" else "espada_parada", 0.3)
	var t: Dictionary = m.totem.dados(totem_id) if totem_id != "" else {}
	if not t.is_empty():
		if not m.on(): # sozinho: paga aqui e o totem vira o lugar de renascer (online vem no progresso do servidor)
			var c: int = m.totem.taxa(t)
			m.P.prog.ouro = int(m.P.prog.get("ouro", 0)) - c
			m.P.prog.totem = str(t.id)
			m.P.mudou = true
			m.hud.aviso("Você chegou em %s (-%d de ouro)" % [t.nome, c])
		m.sons.tocar("moedas", -8.0)
		guardar(true)
		return
	if not m.on(): # sozinho a recarga também conta (online vem no progresso do servidor)
		m.P.prog.vilaAte = m.P.agora_ms() + V.cd * 1000.0
		m.P.mudou = true
	m.hud.aviso("Você voltou para a vila")
	guardar(true)

func passo(dt: float) -> void:
	_guardar_t -= dt
	if _guardar_t <= 0.0:
		_guardar_t = GUARDAR_CADA
		guardar()
	if not ativo():
		return
	canal.t += dt
	# braço no alto: a animação quase para ali (canalizando) até o fim
	if not _congelou and canal.t > 1.1:
		_congelou = true
		m.heroi_anim.ritmo_acao(0.04)
	if canal.t < canal.dur:
		return
	if not m.on() and canal.has("totem"):
		var tt: Dictionary = canal.totem
		if int(m.P.prog.get("ouro", 0)) < m.totem.taxa(tt):
			cancelar("Ouro insuficiente: viagem cancelada")
			return
		chegar(m.totem.lado(tt), str(tt.id))
	elif not m.on():
		var x := D.NASCIMENTO.x + randf_range(-1.5, 1.5)
		var z := D.NASCIMENTO.z + randf_range(-1.5, 1.5)
		chegar(Vector3(x, 0, z))
	elif canal.t > canal.dur + ESPERA_SERVIDOR:
		cancelar("Sem resposta do servidor: tente de novo")

# ---------- lugar onde o herói estava ----------
func carregar() -> void:
	var cfg := ConfigFile.new()
	if cfg.load(ARQUIVO) != OK:
		return
	var p := Vector3(float(cfg.get_value("lugar", "x", D.NASCIMENTO.x)), float(cfg.get_value("lugar", "y", 0.0)), float(cfg.get_value("lugar", "z", D.NASCIMENTO.z)))
	if not m.mov.dentro_do_mapa(p.x, p.z): # o mapa mudou: começa na vila
		return
	colocar(p, float(cfg.get_value("lugar", "ry", 0.0)))

# põe o herói num lugar guardado (o y diz se estava em cima de um telhado ou no chão)
func colocar(p: Vector3, ry: float) -> void:
	m.mov.por_em(p, true)
	m.mov.ry = ry
	m.heroi.position = m.mov.posicao()
	m.heroi.rotation.y = ry
	m.cam.colocar(m.heroi.position)
	_ultimo = m.heroi.position

# grava no aparelho (fora do quadro). agora: na hora (o app vai para o fundo ou fecha)
func guardar(agora := false) -> void:
	if m.heroi == null:
		return
	var p: Vector3 = D.NASCIMENTO if m.h.morto > 0.0 else m.heroi.position # caído: entra de novo na vila
	if m.mov.esc != null and m.h.morto <= 0.0:
		return # pendurado na parede: guarda quando sair dela
	if not agora and p.distance_to(_ultimo) < 1.0:
		return
	_ultimo = p
	var ry: float = m.mov.ry
	if _tarefa >= 0:
		WorkerThreadPool.wait_for_task_completion(_tarefa)
		_tarefa = -1
	var gravar := func():
		var cfg := ConfigFile.new()
		cfg.set_value("lugar", "x", snappedf(p.x, 0.01))
		cfg.set_value("lugar", "y", snappedf(p.y, 0.01))
		cfg.set_value("lugar", "z", snappedf(p.z, 0.01))
		cfg.set_value("lugar", "ry", snappedf(ry, 0.01))
		cfg.save(ARQUIVO)
	if agora:
		gravar.call()
	else:
		_tarefa = WorkerThreadPool.add_task(gravar)

extends SceneTree
# "Ir" até todos os NPCs (André 2026-11-17: "quero que qualquer NPC a gente consiga chegar de AutoPath", de carrinho,
# de lobo e a pé). Monta a rede do app (godot-prototipo/rota.gd) com o mundo.json de verdade e faz o herói andar de
# verdade (andar.gd, a mesma física do jogo) pela rota até cada NPC da mesma terra do ponto de saída. Mostra quem
# chegou e quem travou. Sem névoa (tudo aberto).
# Uso (na pasta godot-prototipo): godot --headless --path . -s ../ferramentas/rota/ir-npcs.gd -- [id_do_npc|todos] [x z]
# Ex.: -- todos           (sai de onde o herói nasce)    -- todos 200 966   (sai de Aurora)    -- m_pedra

class Principal extends Node:
	var mundo
	var terreno
	var mov
	var heroi
	var nevoa = null
	var hud
	var conversa = null
	var trabalho = null
	var construcao = null

class Hud extends Node:
	var mover := Vector2.ZERO
	func aviso(_t) -> void:
		pass

class Transporte extends Node:
	func tem_combustivel() -> bool:
		return true
	func gastou(_d) -> void:
		pass

class Jogo extends Node: # o que andar.gd passo_veiculo lê do main.gd (números de shared/dados.js VEICULOS.carrinho)
	var P = {"dados": {"veiculos": {"carrinho": {"vel": 2.8, "giro": 2.4, "acelera": 1.3, "freia": 3.5, "curvaFechada": 1.6,
		"curvaK": 0.3, "perdePorPack": 0.05, "packsLivres": 2}}}, "prog": {}}
	var transporte
	var hud

func _init() -> void:
	var m := Principal.new()
	m.mundo = JSON.parse_string(FileAccess.get_file_as_string("res://dados/mundo.json"))
	m.terreno = load("res://terreno.gd").new(m.mundo)
	m.mov = load("res://andar.gd").new(m.terreno, m.mundo)
	m.heroi = Node3D.new()
	m.hud = Hud.new()
	var J := Jogo.new()
	J.transporte = Transporte.new()
	J.hud = m.hud
	m.mov.jogo = J
	var R = load("res://rota.gd").new(m)
	R._montar()
	var args := OS.get_cmdline_user_args()
	var so: String = args[0] if args.size() > 0 else "todos"
	var de := Vector2(float(args[1]), float(args[2])) if args.size() > 2 else Vector2(float(m.mundo.nascimento.x), float(m.mundo.nascimento.z))
	var falhas := 0
	for n in m.mundo.npcs:
		if so != "todos" and str(n.id) != so:
			continue
		var alvo := Vector2(float(n.x), float(n.z))
		if m.terreno.terra_id(alvo.x, alvo.y) != m.terreno.terra_id(de.x, de.y):
			continue
		var linha := "%-14s" % n.id
		for modo in ["pe", "lobo", "carrinho"]:
			m.mov.por_em(Vector3(de.x, m.terreno.altura(de.x, de.y), de.y))
			m.mov.montado = {"andar": 3.0, "trote": 6.0, "correr": 9.0} if modo == "lobo" else {}
			m.mov.veiculo = {"k": "carrinho", "v": 0.0} if modo == "carrinho" else {}
			m.heroi.position = m.mov.posicao()
			var t0 := Time.get_ticks_usec()
			var r: PackedVector2Array = R.planejar(alvo)
			var ms := (Time.get_ticks_usec() - t0) / 1000.0
			if r.size() >= 2: # como a missão (missao_ativa.gd): para 1,5 m antes do NPC
				var antes: Vector2 = r[r.size() - 2]
				if antes.distance_to(alvo) > 1.5:
					r[r.size() - 1] = alvo + (antes - alvo).normalized() * 1.5
			R.ir(r, "", R.OLHA, false)
			var t := 0.0
			var dt := 1.0 / 30.0
			var p0 := Vector2(m.mov.x, m.mov.z)
			var tp := 0.0
			var res := ""
			var nadou := 0.0
			while t < 900.0:
				var d: Vector3 = R.direcao_auto()
				m.mov.passo(dt, d.x, d.z, false, true)
				m.heroi.position = m.mov.posicao()
				var p := Vector2(m.mov.x, m.mov.z)
				t += dt
				var Lg: Dictionary = m.terreno.no_lago(p.x, p.y)
				if not Lg.is_empty() and float(Lg.fundo) > 1.0 and not m.terreno.na_ponte(p.x, p.y):
					nadou += dt
				if p.distance_to(alvo) < 2.6:
					res = "chegou %.0fs" % t + (" (nadou %.0fs)" % nadou if nadou > 0.5 else "")
					break
				tp += dt
				if tp >= 3.0:
					if p.distance_to(p0) < 0.5:
						res = "TRAVOU em (%.1f, %.1f) a %.0f m" % [p.x, p.y, p.distance_to(alvo)]
						break
					tp = 0.0
					p0 = p
			if res == "":
				res = "DEMOROU (a %.0f m)" % Vector2(m.mov.x, m.mov.z).distance_to(alvo)
			if not res.begins_with("chegou"):
				falhas += 1
			linha += " | %s: %s (rota %.0f ms)" % [modo, res, ms]
		print(linha)
	print("FALHAS: %d" % falhas)
	quit(1 if falhas > 0 else 0)

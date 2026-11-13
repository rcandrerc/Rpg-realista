extends SceneTree
# Último login vale (André 2026-11-13), com o rede.gd de verdade contra o servidor local: dois aparelhos na mesma conta.
# O primeiro tem que receber caiu("trocado") quando o segundo entra, e a volta automática dele (religar, como o online.gd
# faz depois de uma queda) também tem que acabar em "trocado", sem derrubar o segundo.
# Uso (projeto com cópias de rede.gd e msgpack.gd na raiz; ferramentas/motor/trocado.sh monta tudo):
#   RPG_SERVIDOR=http://127.0.0.1:2567 RPG_SESSAO=... RPG_SESSAO2=... godot --headless --path PASTA -s trocado_teste.gd
var falhou := false

func _ok(c: bool, m: String) -> void:
	print(("TROCA ok " if c else "TROCA FALHOU ") + m)
	if not c:
		falhou = true

func _initialize() -> void:
	_rodar()

func _rede(sessao: String) -> Node:
	var r: Node = load("res://rede.gd").new()
	root.add_child(r)
	r.servidor = OS.get_environment("RPG_SERVIDOR")
	r.sessao = sessao
	r.set_meta("motivos", [])
	r.caiu.connect(func(m): r.get_meta("motivos").append(m))
	return r

func _esperar(cond: Callable, seg := 8.0) -> bool:
	var t0 := Time.get_ticks_msec()
	while Time.get_ticks_msec() - t0 < seg * 1000.0:
		if cond.call():
			return true
		await process_frame
	return cond.call()

func _rodar() -> void:
	await process_frame
	var pc := _rede(OS.get_environment("RPG_SESSAO"))
	var cel := _rede(OS.get_environment("RPG_SESSAO2"))
	pc.iniciar()
	_ok(await _esperar(func(): return pc.conectado), "PC entrou")
	cel.iniciar()
	_ok(await _esperar(func(): return cel.conectado), "celular entrou")
	_ok(await _esperar(func(): return "trocado" in pc.get_meta("motivos")), "PC recebeu 'trocado': %s" % [pc.get_meta("motivos")])
	_ok(not pc.pode_religar(), "PC não tenta religar como o mesmo herói")
	# o online.gd antigo tentava de novo sozinho: simula essa volta automática e confere que ela não derruba o celular
	pc.get_meta("motivos").clear()
	pc.religar()
	_ok(await _esperar(func(): return "trocado" in pc.get_meta("motivos")), "volta automática do PC recusada: %s" % [pc.get_meta("motivos")])
	await _esperar(func(): return false, 1.0)
	_ok(cel.conectado and cel.get_meta("motivos").is_empty(), "celular continua jogando: %s" % [cel.get_meta("motivos")])
	_ok(not pc.conectado, "PC fora da sala")
	# André tocou em Entrar no PC: agora o celular sai
	pc.continuar()
	_ok(await _esperar(func(): return pc.conectado and "trocado" in cel.get_meta("motivos")), "Entrar no PC derruba o celular: %s" % [cel.get_meta("motivos")])
	quit(1 if falhou else 0)

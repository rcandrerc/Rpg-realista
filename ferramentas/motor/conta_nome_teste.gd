extends SceneTree
# Nome da conta na tela "Entrar como…" (André 2026-11-13: aparecia "sem nome" e entrava como "Ruiva").
# O proxy (conta_nome_proxy.mjs) falha as 2 primeiras respostas de /conta/eu; o rede.gd tem que insistir e achar o nome.
const Rede = preload("res://rede.gd")
var falhas := 0

func ok(c: bool, txt: String) -> void:
	if c:
		print("NOME ok ", txt)
	else:
		falhas += 1
		print("NOME FALHOU ", txt)

func _initialize() -> void:
	_rodar.call_deferred()

func _rodar() -> void:
	DirAccess.remove_absolute(ProjectSettings.globalize_path("user://conta.cfg"))
	var r = Rede.new()
	root.add_child(r)
	ok(r.sessao != "", "sessão do teste lida")
	var escolhida := {}
	r.escolher_conta.connect(func(c): escolhida.merge(c, true))
	var caiu := []
	r.caiu.connect(func(m): caiu.append(m))
	r.guardar(r.sessao) # grava no user://conta.cfg (o RPG_SESSAO não grava sozinho)
	await r.iniciar(true)
	ok(str(escolhida.get("nome", "")) == "Teste", "abertura com 2 falhas ainda mostra o nome (%s)" % str(escolhida.get("nome", "")))
	ok(caiu.is_empty(), "não caiu para a tela de servidor fora")
	var cfg := ConfigFile.new()
	cfg.load("user://conta.cfg")
	ok(str(cfg.get_value("conta", "nome", "")) == "Teste", "nome guardado no aparelho junto da sessão")
	var r2 = Rede.new()
	root.add_child(r2)
	ok(r2.nome_salvo == "Teste", "abrindo de novo o nome já vem do aparelho")
	# Entrar sem os dados da conta: busca antes de ir para a sala
	r2.conta = {}
	r2.continuar()
	for i in 60:
		await create_timer(0.1).timeout
		if str(r2.conta.get("nome", "")) != "":
			break
	ok(str(r2.conta.get("nome", "")) == "Teste", "Entrar sem dados da conta busca o nome antes da sala")
	r2.fechar()
	r2.guardar("")
	ok(r2.nome_salvo == "", "sair da conta esquece o nome")
	cfg = ConfigFile.new()
	cfg.load("user://conta.cfg")
	ok(str(cfg.get_value("conta", "nome", "")) == "", "arquivo sem o nome depois de sair")
	print("NOME FIM falhas=%d" % falhas)
	quit(1 if falhas else 0)

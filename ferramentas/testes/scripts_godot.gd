# Confere se TODO .gd do jogo compila (André 2026-11-16, depois da tela cinza da versão 2293: um `const` repetido
# no amigos.gd quebrou o main.gd e o robô 2 passou verde, porque o Godot sai com código 0 mesmo com erro de script).
# Carrega cada script e conta os erros que o motor anota. Sai com 1 se algum não compilou.
# Uso: godot --headless --path godot-prototipo -s ferramentas/testes/scripts_godot.gd
extends SceneTree

class Anotador extends Logger:
	var erros: Array[String] = []
	func _log_error(_funcao: String, arquivo: String, linha: int, codigo: String, texto: String, _editor: bool, tipo: int, _pilha: Array[ScriptBacktrace]) -> void:
		if tipo == ERROR_TYPE_SCRIPT or tipo == ERROR_TYPE_ERROR:
			erros.append("%s:%d %s %s" % [arquivo, linha, codigo, texto])
	func _log_message(_m: String, _e: bool) -> void:
		pass

func _scripts(pasta: String, lista: Array[String]) -> void:
	for d in DirAccess.get_directories_at(pasta):
		if d.begins_with("."):
			continue
		_scripts(pasta.path_join(d), lista)
	for f in DirAccess.get_files_at(pasta):
		if f.ends_with(".gd"):
			lista.append(pasta.path_join(f))

func _initialize() -> void:
	var anot := Anotador.new()
	OS.add_logger(anot)
	var lista: Array[String] = []
	_scripts("res://", lista)
	var ruins: Array[String] = []
	for p in lista:
		var antes := anot.erros.size()
		var s = ResourceLoader.load(p, "", ResourceLoader.CACHE_MODE_REUSE)
		if s == null or anot.erros.size() > antes:
			ruins.append(p)
	OS.remove_logger(anot)
	for e in anot.erros:
		print("ERRO ", e)
	print("SCRIPTS ", lista.size(), " conferidos, ", ruins.size(), " com erro")
	for p in ruins:
		print("QUEBRADO ", p)
	quit(1 if ruins.size() > 0 else 0)

@tool
extends EditorPlugin
# Põe no APK o plugin Android FundoJogo (godot-prototipo/plugin-android/fundo, compilado em bin/fundo-release.aar):
# com o jogo no segundo plano, um serviço na frente segura o app vivo por até 10 min (André 2026-11-17: voltar de uma
# mensagem abria o jogo do zero, ~40 s). Ele traz no manifesto o serviço e as permissões FOREGROUND_SERVICE.

class Exportar extends EditorExportPlugin:
	func _get_name() -> String:
		return "FundoJogo"
	func _supports_platform(p: EditorExportPlatform) -> bool:
		return p is EditorExportPlatformAndroid
	func _get_android_libraries(_p: EditorExportPlatform, _debug: bool) -> PackedStringArray:
		return PackedStringArray(["fundo_jogo/bin/fundo-release.aar"])

var exp: Exportar

func _enter_tree() -> void:
	exp = Exportar.new()
	add_export_plugin(exp)

func _exit_tree() -> void:
	remove_export_plugin(exp)

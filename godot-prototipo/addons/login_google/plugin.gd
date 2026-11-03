@tool
extends EditorPlugin
# Põe no APK o plugin Android LoginGoogle (godot-prototipo/plugin-android, compilado em bin/login-release.aar)
# e as bibliotecas do Google que ele usa. No jogo: Engine.get_singleton("LoginGoogle").entrar(CLIENT_ID_WEB).

class Exportar extends EditorExportPlugin:
	func _get_name() -> String:
		return "LoginGoogle"
	func _supports_platform(p: EditorExportPlatform) -> bool:
		return p is EditorExportPlatformAndroid
	func _get_android_libraries(_p: EditorExportPlatform, _debug: bool) -> PackedStringArray:
		return PackedStringArray(["login_google/bin/login-release.aar"])
	func _get_android_dependencies(_p: EditorExportPlatform, _debug: bool) -> PackedStringArray:
		return PackedStringArray([
			"androidx.credentials:credentials:1.3.0",
			"androidx.credentials:credentials-play-services-auth:1.3.0",
			"com.google.android.libraries.identity.googleid:googleid:1.1.1",
		])

var exp: Exportar

func _enter_tree() -> void:
	exp = Exportar.new()
	add_export_plugin(exp)

func _exit_tree() -> void:
	remove_export_plugin(exp)

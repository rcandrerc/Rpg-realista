@tool
extends EditorPlugin
# Põe no APK o plugin Android VozJogo (godot-prototipo/plugin-android/voz, compilado em bin/voz-release.aar):
# comando de voz no celular (voz.gd): VozJogo (reconhecedor do Android) e VozVosk (escuta contínua). Ele traz no manifesto a permissão do microfone (RECORD_AUDIO).

class Exportar extends EditorExportPlugin:
	func _get_name() -> String:
		return "VozJogo"
	func _supports_platform(p: EditorExportPlatform) -> bool:
		return p is EditorExportPlatformAndroid
	func _get_android_libraries(_p: EditorExportPlatform, _debug: bool) -> PackedStringArray:
		return PackedStringArray(["voz_jogo/bin/voz-release.aar"])
	# escuta contínua (VozVosk): reconhecedor Vosk (Apache 2.0) e o JNA que ele usa
	func _get_android_dependencies(_p: EditorExportPlatform, _debug: bool) -> PackedStringArray:
		return PackedStringArray(["com.alphacephei:vosk-android:0.3.75@aar", "net.java.dev.jna:jna:5.18.1@aar"])

var exp: Exportar

func _enter_tree() -> void:
	exp = Exportar.new()
	add_export_plugin(exp)

func _exit_tree() -> void:
	remove_export_plugin(exp)

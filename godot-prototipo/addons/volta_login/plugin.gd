@tool
extends EditorPlugin
# Na exportação Android, põe na tela do jogo o link rpgaethra://voltar: depois do login no site, a página abre o app de novo.

class Exportar extends EditorExportPlugin:
	func _get_name() -> String:
		return "VoltaLogin"
	func _supports_platform(p: EditorExportPlatform) -> bool:
		return p is EditorExportPlatformAndroid
	func _get_android_manifest_activity_element_contents(_p: EditorExportPlatform, _debug: bool) -> String:
		return """
			<intent-filter>
				<action android:name="android.intent.action.VIEW" />
				<category android:name="android.intent.category.DEFAULT" />
				<category android:name="android.intent.category.BROWSABLE" />
				<data android:scheme="rpgaethra" />
			</intent-filter>
"""

var exp: Exportar

func _enter_tree() -> void:
	exp = Exportar.new()
	add_export_plugin(exp)

func _exit_tree() -> void:
	remove_export_plugin(exp)

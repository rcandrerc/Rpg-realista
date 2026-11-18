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
	# Robô nos celulares de verdade (2026-11-18): o Firebase Test Lab no modo "game loop" abre o jogo por esta porta
	# (TEST_LOOP) e deixa jogar o tempo todo; o modo "robo" encerrava o teste em ~3 min. O jogador não vê nada: sem
	# ícone, só abre a mesma tela do jogo (GodotApp).
	func _get_android_manifest_application_element_contents(_p: EditorExportPlatform, _debug: bool) -> String:
		return """
        <activity-alias android:name="com.rcandrerc.fundo.TesteLoop" android:targetActivity="com.godot.game.GodotApp" android:exported="true">
            <intent-filter>
                <action android:name="com.google.intent.action.TEST_LOOP" />
                <category android:name="android.intent.category.DEFAULT" />
                <data android:mimeType="application/javascript" />
            </intent-filter>
        </activity-alias>
"""

var exp: Exportar

func _enter_tree() -> void:
	exp = Exportar.new()
	add_export_plugin(exp)

func _exit_tree() -> void:
	remove_export_plugin(exp)

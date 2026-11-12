extends SceneTree
# Teste de fumaça do jogo num motor novo (apk.yml, em PR): abre a vila, entra no servidor local, anda um pouco e mede.
# Erro de script ou de shader aparece no log (o apk.yml procura e falha). Imprime linhas "FUMACA ..." com o resultado.
# Uso: RPG_SERVIDOR=http://127.0.0.1:2567 RPG_SESSAO=... godot --path godot-prototipo -s ferramentas/motor/fumaca.gd
var t := 0.0
var entrou_t := -1.0
var apertou := false
var medindo := false
var t_med := 0.0
var quadros := 0
var proc_ms := 0.0
var pico := 0.0
var ang := 0.0
const AQUECE := 15.0
const DUR := 30.0
const RAIO := 12.0
const ESPERA_MAX := 180.0

func _initialize() -> void:
	# PACOTES (opcional): .pck publicados para carregar antes (ex.: completo + deltas baixados), separados por vírgula
	for p in OS.get_environment("PACOTES").split(",", false):
		print("FUMACA pacote ", p, " ", ProjectSettings.load_resource_pack(p, true))
	print("FUMACA motor ", Engine.get_version_info().string, " desenho ", "junto" if RenderingServer.is_on_render_thread() else "em paralelo")
	change_scene_to_file("res://main.tscn")

var aviso_t := 0.0

func _process(dt: float) -> bool:
	t += dt
	var m = current_scene
	if t - aviso_t >= 5.0: # andamento (se o log parar aqui, o jogo travou)
		aviso_t = t
		var on = m.get("online") if m else null
		print("FUMACA t=%.0f s quadros=%d cena=%s online=%s conectado=%s" % [t, Engine.get_process_frames(), m.name if m else "-",
			on != null, on != null and on.rede != null and on.rede.conectado])
	if entrou_t < 0.0 and t > ESPERA_MAX:
		print("FUMACA FALHOU: não entrou no servidor em %d s" % ESPERA_MAX)
		quit(1)
		return false
	if m == null or not ("online" in m) or m.online == null:
		return false
	var on = m.online
	if not apertou and on.b_continuar and on.b_continuar.visible:
		apertou = true
		on.b_continuar.pressed.emit()
	if entrou_t < 0.0 and on.rede and on.rede.conectado:
		entrou_t = t
		print("FUMACA entrou no servidor em %.1f s" % t)
	if entrou_t < 0.0:
		return false
	# anda em volta da vila (carrega casas, NPCs, grama e sombras de todos os lados)
	ang += dt * 9.0 / RAIO
	m.mov.por_em(Vector3(cos(ang) * RAIO, 0, sin(ang) * RAIO))
	if not medindo and t - entrou_t > AQUECE:
		medindo = true
	if medindo:
		quadros += 1
		t_med += dt
		proc_ms += Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0
		pico = max(pico, dt)
		if t_med >= DUR:
			print("FUMACA ok: %d quadros em %.1f s = %.1f FPS, lógica média %.1f ms, pico %.0f ms, nós %d" % [
				quadros, t_med, quadros / t_med, proc_ms / quadros, pico * 1000.0, Performance.get_monitor(Performance.OBJECT_NODE_COUNT)])
			quit(0)
	return false

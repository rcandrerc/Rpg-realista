extends SceneTree
# Volta inteira (360°) de barco, carrinho e navio: o veículo vira sempre para o lado apertado (andar.gd volante).
# André 2026-11-15: "dando 360 com barco carrinho o controle buga, parece que muda a direção".
# Rodar: godot --headless --path godot-prototipo --script ../ferramentas/testes/volante-godot.gd

const Andar = preload("res://andar.gd")

var bons := 0
var falhas := 0

func ok(c: bool, msg: String) -> void:
	if c:
		bons += 1
	else:
		falhas += 1
		print("FALHOU: ", msg)

static func ad(a: float, b: float) -> float:
	return atan2(sin(a - b), cos(a - b))

# Simula o volante: giro = rad/s do veículo; joy(t, ry, yaw) devolve o ângulo do alvo no mundo; segue = a câmera vai
# para as costas do veículo (camera_heroi.gd travada). Devolve {trocas, total}: trocas = vezes que a curva mudou de lado
# com o alvo ainda longe (o defeito); total = quanto virou somando tudo.
func simular(giro: float, segundos: float, joy: Callable, segue: bool, novo: bool) -> Dictionary:
	var ry := 0.0
	var yaw := PI
	var lado := 0.0
	var ultimo := 0.0
	var trocas := 0
	var total := 0.0
	var dt := 1.0 / 30.0
	var t := 0.0
	while t < segundos:
		var alvo: float = joy.call(t, ry, yaw)
		var dif := ad(alvo, ry)
		if novo:
			dif = Andar.volante(dif, lado)
			if absf(dif) > 0.05:
				lado = signf(dif)
		var passo: float = clamp(dif, -giro * dt, giro * dt)
		ry += passo
		total += passo
		if absf(passo) > 0.0001 and absf(dif) > 0.5: # longe do alvo (perto dele, corrigir o tremor do dedo é normal)
			if ultimo != 0.0 and signf(passo) != ultimo:
				trocas += 1
			ultimo = signf(passo)
		if segue:
			yaw = lerp_angle(yaw, ry + PI, min(1.0, dt * 3.0))
		t += dt
	return {"trocas": trocas, "total": total}

func _init() -> void:
	var ruido := func(t: float) -> float: return sin(t * 7.3) * 0.18 + sin(t * 2.1) * 0.12 # dedo tremendo no joystick
	for giro in [0.65, 0.7, 2.4]: # barquinho, navio, carrinho (shared/dados.js VEICULOS)
		# 1) câmera atrás do veículo, joystick para trás e para a direita (o alvo fica sempre perto de 180°)
		var tras := func(t: float, ry: float, yaw: float) -> float: return yaw + PI + 3.05 + ruido.call(t)
		var r1 := simular(giro, 30.0, tras, true, true)
		ok(r1.trocas == 0, "giro %.2f câmera atrás, joystick para trás: não troca de lado (%d trocas)" % [giro, r1.trocas])
		ok(absf(r1.total) > TAU, "giro %.2f câmera atrás: dá a volta inteira (%.1f rad)" % [giro, r1.total])
		# 2) câmera parada, o dedo roda o joystick em volta devagar e depressa (volta inteira contínua)
		for vel in [giro * 0.5, giro * 0.95]: # o dedo roda até quase tão rápido quanto o veículo vira
			var roda := func(t: float, ry: float, yaw: float) -> float: return -t * vel + ruido.call(t)
			var r2 := simular(giro, TAU * 2.0 / vel + 3.0, roda, false, true)
			ok(r2.trocas == 0, "giro %.2f joystick rodando %.2f rad/s: não troca de lado (%d trocas)" % [giro, vel, r2.trocas])
			ok(r2.total < -TAU, "giro %.2f joystick rodando %.2f rad/s: volta inteira para o lado certo (%.1f rad)" % [giro, vel, r2.total])
	# o jeito antigo (lado mais curto) trocava de lado: o teste pega o defeito
	var antigo := simular(0.65, 30.0, func(t: float, ry: float, yaw: float) -> float: return yaw + PI + 3.05 + sin(t * 7.3) * 0.18 + sin(t * 2.1) * 0.12, true, false)
	ok(antigo.trocas > 0, "o jeito antigo trocava de lado (%d trocas)" % antigo.trocas)
	# virar de propósito para o outro lado continua funcionando: joystick claramente do outro lado, na frente
	ok(Andar.volante(-1.5, 1.0) == -1.5, "virando para um lado, joystick a 90° do outro lado: troca na hora")
	ok(Andar.volante(-2.0, 1.0) == -2.0, "joystick a 115° do outro lado: troca")
	ok(Andar.volante(-3.0, 1.0) > PI, "alvo lá atrás do outro lado: continua a volta pelo mesmo lado")
	ok(Andar.volante(-3.0, 0.0) == -3.0, "sem lado ainda (joystick acabou de ser apertado): lado mais curto")
	ok(Andar.volante(0.5, -1.0) == 0.5, "alvo na frente: vai direto")
	print("volante: %d ok, %d falhas" % [bons, falhas])
	quit(1 if falhas > 0 else 0)

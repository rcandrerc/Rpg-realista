extends RefCounted
const Idioma = preload("res://idioma.gd") # inglês: nomes e frase montados aqui já traduzidos
# Patente de Guerra (André 2026-11-26): escudo da patente com o anel de 0 a 100% até a próxima. Quem conta é o servidor
# (shared/patente.js, prog.gu = { m: 'AAAA-MM', a: abates no mês, x: maior patente já pega }); aqui só desenha.
# Os escudos são os PNG de res://icones/patente/<raça>_<0..7>.png (ferramentas/patente/escudos.py), os mesmos do painel.
# Usado no quadro do herói (hud.gd), em cima da cabeça (titulos.gd) e na aba do clã (menu.gd).

const NOMES := ["Recruta", "Soldado", "Cabo", "Sargento", "Tenente", "Capitão", "Comandante", "Lenda"]
const ABATES := [0, 5, 15, 30, 50, 80, 120, 180] # iguais a PATENTE em shared/dados.js (mude os dois juntos)
const COR_ANEL := {"chama": Color(1.0, 0.55, 0.17), "geada": Color(0.45, 0.78, 1.0)}
static var _tex := {}

static func raca_de(r) -> String:
	return "geada" if str(r) == "geada" else "chama"

static func textura(raca: String, i: int) -> Texture2D:
	var k := "%s_%d" % [raca_de(raca), clampi(i, 0, 7)]
	if not _tex.has(k):
		_tex[k] = load("res://icones/patente/%s.png" % k)
	return _tex[k]

# o mês da guerra na hora de Brasília ('AAAA-MM'), pelo relógio do servidor (progresso.gd agora_ms)
static func mes(agora_ms: float) -> String:
	return Time.get_datetime_string_from_unix_time(int(agora_ms / 1000.0) - 3 * 3600).substr(0, 7)

# patente pelos abates do mês: {i, pct (0..1), a}
static func de_abates(a: int) -> Dictionary:
	var i := 0
	while i + 1 < ABATES.size() and a >= int(ABATES[i + 1]):
		i += 1
	var pct := 1.0 if i + 1 >= ABATES.size() else float(a - int(ABATES[i])) / float(int(ABATES[i + 1]) - int(ABATES[i]))
	return {"i": i, "pct": pct, "a": a}

# a do herói, pelo prog (mês que virou e ainda não fechou no servidor = Recruta 0%)
static func do_prog(prog: Dictionary, agora_ms: float) -> Dictionary:
	var g = prog.get("gu")
	var a := int(g.get("a", 0)) if g is Dictionary and str(g.get("m", "")) == mes(agora_ms) else 0
	return de_abates(a)

# "Sargento · 64% para Tenente" (Lenda: "Lenda · topo do mês")
static func texto(i: int, pct: float) -> String:
	if i >= NOMES.size() - 1:
		return Idioma.frase("%s · topo do mês") % Idioma.frase(NOMES[NOMES.size() - 1])
	return Idioma.frase("%s · %d%% para %s") % [Idioma.frase(NOMES[i]), int(round(pct * 100.0)), Idioma.frase(NOMES[i + 1])]

# escudo com anel: fundo escuro, anel cinza e o arco que enche (cor da raça); r = raio do anel
static func desenhar(ci: CanvasItem, c: Vector2, r: float, raca: String, i: int, pct: float) -> void:
	var cor: Color = COR_ANEL[raca_de(raca)]
	var lg := maxf(3.0, r * 0.16)
	ci.draw_circle(c + Vector2(0, 2), r + lg * 0.5, Color(0, 0, 0, 0.4))
	ci.draw_circle(c, r, Color(0.06, 0.05, 0.04, 0.92))
	ci.draw_arc(c, r, 0.0, TAU, 48, Color(0.24, 0.2, 0.15, 0.95), lg, true)
	if pct > 0.0:
		ci.draw_arc(c, r, -PI / 2, -PI / 2 + TAU * clampf(pct, 0.0, 1.0), 48, cor, lg, true)
		ci.draw_arc(c, r + lg * 0.5, -PI / 2, -PI / 2 + TAU * clampf(pct, 0.0, 1.0), 48, Color(cor.lightened(0.45), 0.5), 1.0, true)
	var t := textura(raca, i)
	if t:
		var s := r * 1.45
		ci.draw_texture_rect(t, Rect2(c - Vector2(s, s) * 0.5, Vector2(s, s)), false)

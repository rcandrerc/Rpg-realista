extends RefCounted
# Dados do jogo (mesmos números de shared/dados.js do HTML). Conteúdo novo entra aqui.

const HEROI := {"vida": 120.0, "mana": 100.0, "mana_por_seg": 7.0, "andar": 1.8, "correr": 5.4, "rolar_cd": 1.2, "renascer": 3.5}
const MOVIMENTO := {"pulo": 6.2, "gravidade": 17.0, "dash_vel": 11.0, "dash_tempo": 0.28, "dash_cd": 0.9}
const NASCIMENTO := Vector3(0, 0, 1)

# golpe básico: combo de 4 cortes (modo espada) ou 3 tiros (modo magia)
const BASICO := {"nome": "Golpe", "alcance": 2.3, "arco": 1.6, "combo": [
	{"anim": "combo1", "ts": 1.45, "at": 0.5, "dmg": 12}, {"anim": "combo2", "ts": 1.45, "at": 0.53, "dmg": 13},
	{"anim": "combo3", "ts": 1.45, "at": 0.58, "dmg": 14}, {"anim": "combo4", "ts": 1.35, "at": 0.41, "dmg": 20}]}
const BASICO_MAGIA := {"nome": "Disparo", "proj": {"vel": 18.0, "cor": Color("9a6bff"), "tam": 0.24, "estilo": "arcano"}, "combo": [
	{"anim": "magia1", "ts": 1.5, "at": 0.34, "dmg": 9}, {"anim": "magia2", "ts": 1.5, "at": 0.44, "dmg": 10}, {"anim": "magia3", "ts": 1.35, "at": 0.4, "dmg": 15}]}

const HABILIDADES := {
	"investida": {"nome": "Investida", "tipo": "Espada", "anim": "investida", "ts": 1.5, "hits": [0.22, 0.78], "dmg": 19, "alcance": 2.8, "arco": 2.4, "avanco": 7.0, "avanco_t": 0.2, "cd": 4.0},
	"giro": {"nome": "Giro da Lâmina", "tipo": "Espada", "anim": "giro", "ts": 1.2, "hits": [0.52, 0.74], "dmg": 30, "area": 4.0, "cd": 6.0},
	"salto": {"nome": "Salto Esmagador", "tipo": "Espada", "anim": "salto", "ts": 1.1, "hits": [0.55], "dmg": 26, "area": 3.2, "avanco": 3.5, "cd": 7.0},
	"relampago": {"nome": "Combo Relâmpago", "tipo": "Espada", "anim": "relampago", "ts": 1.6, "hits": [0.14, 0.4, 0.6, 0.76], "dmg": 11, "alcance": 2.6, "arco": 2.4, "cd": 5.0},
	"bola": {"nome": "Cometa de Fogo", "tipo": "Magia", "anim": "bola", "ts": 1.7, "hits": [0.43], "proj": {"vel": 14.0, "cor": Color("ff7a2a"), "tam": 0.26, "explosao": 1.8, "estilo": "fogo"}, "dmg": 24, "cd": 1.5, "mana": 10},
	"raio": {"nome": "Raio Celeste", "tipo": "Magia", "anim": "raio", "ts": 1.3, "hits": [0.3], "raios": 3, "alcance": 14.0, "dmg": 28, "cd": 8.0, "mana": 25},
	"explosao": {"nome": "Explosão", "tipo": "Magia", "anim": "explosao", "ts": 1.6, "hits": [0.6], "dmg": 34, "area": 3.6, "cd": 7.0, "mana": 25},
	"meteoros": {"nome": "Chuva de Meteoros", "tipo": "Magia", "anim": "meteoros", "ts": 1.2, "hits": [0.6], "chuva": {"r": 3.4, "ondas": 4, "dmg": 12}, "cd": 10.0, "mana": 30},
}
const CURA := {"nome": "Cura", "anim": "cura", "ts": 1.2, "hits": [0.55], "cura": 38, "cd": 8.0, "mana": 25}
const BUILD_PADRAO := ["investida", "giro", "salto", "relampago", "bola", "raio", "explosao", "meteoros"]

# Bando Sombrio: personagens anime que o jogador não escolhe
# combate dos monstros: mesmos números de COMBATE_INIMIGO em shared/dados.js (o servidor decide online)
const COMBATE := {"preparo": {"puglin": 0.5, "imp": 0.55, "chefe": 0.7, "golem": 0.65, "maw": 0.6, "warrok": 0.75}, "preparoTs": 0.3, "golpeTs": 1.1, "acerto": 0.45,
	"aoMesmoTempo": 2, "roda": 3.4, "rodaVel": 1.1, "firmeGolpes": {"puglin": 6, "imp": 6, "chefe": 4, "golem": 5, "maw": 5, "warrok": 4}, "firmeJanela": 1.6,
	"firmeDur": 2.0, "contraDur": 1.5, "contraK": 1.5, "voaMorte": 1.4}
const INIMIGO := {"vida": 80.0, "dmg": 8, "vel": 3.6, "alcance": 1.9, "visao": 11.0, "ataque_cd": 1.8, "renascer": 6.0}

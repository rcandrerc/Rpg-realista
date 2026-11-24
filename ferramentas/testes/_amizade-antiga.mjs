// Testes da amizade e do papo sozinho dos bots (antes de 2026-11-22): o André trocou por "soldados" (NPC_SOLDADO em
// shared/dados.js). Estes testes conferem o jeito antigo, que continua no código: desliga o soldado só aqui.
// Lista de amigos só com líder de clã (AMIGOS.soLideres, André 2026-11-23): aqui a Cecília e os outros entram na lista
// como antes, para conferir o jeito antigo.
import { NPC_SOLDADO, AMIGOS } from '../../shared/dados.js';
NPC_SOLDADO.ligado = false;
AMIGOS.soLideres = false;

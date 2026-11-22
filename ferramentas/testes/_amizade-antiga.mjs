// Testes da amizade e do papo sozinho dos bots (antes de 2026-11-22): o André trocou por "soldados" (NPC_SOLDADO em
// shared/dados.js). Estes testes conferem o jeito antigo, que continua no código: desliga o soldado só aqui.
import { NPC_SOLDADO } from '../../shared/dados.js';
NPC_SOLDADO.ligado = false;

// Para os testes das missões (André 2026-11-27 desligou as missões: MISSOES_LIGA em shared/dados.js). O motor continua
// no jogo para voltar depois, então os testes dele rodam com as missões ligadas. Uso: import './_missoes-ligadas.mjs';
// (antes de criar a Simulacao). O teste missoes-desligadas.mjs confere o jogo como está (desligadas).
import { MISSOES_LIGA } from '../../shared/dados.js';
for (const k of Object.keys(MISSOES_LIGA)) MISSOES_LIGA[k] = true;

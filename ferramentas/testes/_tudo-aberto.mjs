// Para os testes que não são da progressão (André 2026-11-10): personagem de teste com todas as missões principais
// feitas (nada na névoa) e sem trava de nível no criar e no transporte, como era antes. O teste da progressão
// (progressao.mjs) não usa isto. Uso: import './_tudo-aberto.mjs'; (antes de criar a Simulacao)
import { Simulacao, HISTORIA, LIBERA_NIVEL } from '../../shared/index.js';
const add = Simulacao.prototype.adicionarJogador;
Simulacao.prototype.adicionarJogador = function (...a) { const j = add.apply(this, a); if (j?.prog) j.prog.hist = { p: HISTORIA.length, ac: false, n: 0 }; return j; };
for (const [k, v] of Object.entries(LIBERA_NIVEL)) {
  if (typeof v === 'number') LIBERA_NIVEL[k] = 0;
  else if (Array.isArray(v)) v.fill(0);
  else for (const c of Object.keys(v)) v[c] = 0;
}

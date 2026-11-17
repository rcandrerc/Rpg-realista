// Planta da missão cresce em HORTA.missaoSeg segundos (André 2026-11-17). Nos testes, passarMissao(s) faz esses
// segundos passarem para as plantas da missão de todos os lotes (o resto da horta não anda).
import { crescerPlanta } from '../../shared/simulacao.js';
export function passarMissao(s) {
  let n = 0;
  for (const L of s.lotes.values()) for (const t of Object.values(L.horta)) if (t?.mf) { t.mi -= 3600000; t.mf -= 3600000; crescerPlanta(t, Date.now()); n++; }
  return n;
}

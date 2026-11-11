// Mede o tamanho da foto que um jogador recebe 20x/s (área de interesse) e de que ela é feita.
// Uso: node ferramentas/carga/tamanho-foto.mjs [segundos=20]
import { Simulacao, MAPA_CLAREIRA } from '@rpg/shared';
import { Visao } from '../../server/visao.js';
const S = Number(process.argv[2] || 20);
const sim = new Simulacao(MAPA_CLAREIRA);
sim.adicionarJogador('eu', 'Eu', 'ruiva', {});
const visao = new Visao();
let n = 0, tot = 0, max = 0; const partes = {};
for (let p = 0; p < S * 20; p++) {
  const ev = sim.passo(1 / 20);
  const ctx = visao.preparar(sim.foto(), ev);
  const s = visao.paraJogador(ctx, 'eu');
  if (p < 40) continue; // começo (tudo entra pela primeira vez)
  n++; tot += s.length; max = Math.max(max, s.length);
  const o = JSON.parse(s);
  const add = (k, v) => { partes[k] = (partes[k] || 0) + JSON.stringify(v ?? null).length; };
  const eu = o.foto.jogadores.find((j) => j.id === 'eu');
  for (const [k, v] of Object.entries(eu)) add('eu.' + k, v);
  add('outros', o.foto.jogadores.filter((j) => j.id !== 'eu')); add('inimigos', o.foto.inimigos);
  for (const k of ['veios', 'spots', 'carga', 'mapa']) add(k, o.foto[k]); add('eventos', o.eventos);
}
console.log(`média ${(tot / n / 1024).toFixed(2)} KB por foto (pico ${(max / 1024).toFixed(1)} KB) = ${(tot / n * 20 * 8 / 1000).toFixed(0)} kbit/s`);
for (const [k, v] of Object.entries(partes).sort((a, b) => b[1] - a[1]).slice(0, 15)) console.log(k.padEnd(16), (v / n).toFixed(0), 'B');

// Orelha-de-pau (cogumelo de prateleira grudado no tronco) só existe onde a árvore existe (André 2026-11-16: "vários
// cogumelos flutuantes, eles ficavam nas árvores"). A mata nativa (NATIVAS) tirou ~93% das árvores e as orelhas delas
// ficaram no ar. Confere: toda orelha tem uma árvore da mata a menos de 0,6 m do pé, e fica abaixo do alto do toco
// (queda_arvore.gd: 0,42 x tamanho), para não flutuar quando a árvore é cortada.
import { MAPA_CLAREIRA } from '../../shared/dados.js';

const mata = MAPA_CLAREIRA.mata, orelhas = MAPA_CLAREIRA.cenario.enfeites.filter((e) => e.m === 'orelha_de_pau');
let falhas = 0;
for (const o of orelhas) {
  let perto = null, dm = Infinity;
  for (const a of mata) { const d = Math.hypot(a.x - o.x, a.z - o.z); if (d < dm) { dm = d; perto = a; } }
  const dentro = perto && dm <= 0.32 * perto.s * 0.75 + 0.6;
  if (!dentro) { falhas++; if (falhas <= 10) console.error(`NO AR: orelha-de-pau em (${o.x}, ${o.z}) sem árvore (a mais perto a ${dm.toFixed(2)} m)`); continue; }
  if (o.y > 0.42 * perto.s + 0.01) { falhas++; console.error(`ACIMA DO TOCO: orelha em (${o.x}, ${o.z}) y ${o.y} > toco ${(0.42 * perto.s).toFixed(2)}`); }
}
console.log(`${orelhas.length} orelhas-de-pau, ${mata.length} árvores na mata`);
if (falhas) { console.error('FALHOU:', falhas, 'orelhas fora da árvore'); process.exitCode = 1; } else console.log('ok: toda orelha-de-pau está grudada numa árvore');

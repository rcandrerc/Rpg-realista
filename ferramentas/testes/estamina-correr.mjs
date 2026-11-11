// Correr com a disparada gasta estamina sem parar, mesmo com a rede oscilando (André 2026-11-11: a barra
// caía e de repente enchia de novo). Uso: node ferramentas/testes/estamina-correr.mjs
import { Simulacao, MAPA_CLAREIRA, HEROI, ESTAMINA } from '../../shared/index.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const TICK = 1 / 20;
// corre 6 s a 5,4 m/s; pacotes a cada 0,05 s, mas "juntar" deles chegam no mesmo tick do servidor (celular na rede)
function correr(juntar, vel = HEROI.correr) {
  const s = new Simulacao(MAPA_CLAREIRA);
  const j = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
  j.criando = false; j.x = 0; j.z = 0; j.y = s.terreno.altura(0, 0, 10);
  s.passo(TICK); s.eventos = [];
  const cheia = j.sta;
  let z = 0, k = 0;
  for (let t = 0; t < 6; t += TICK) {
    s.passo(TICK);
    // no tick, chegam 0, 1 ou 3 pacotes (média de 1 por tick)
    const n = juntar ? [3, 0, 0, 1][k++ % 4] : 1;
    for (let i = 0; i < n; i++) { z += vel * TICK; s.posicaoCliente('A', { x: 0, y: s.terreno.altura(0, z, 10), z, ry: 0, e: 1 }); }
    s.eventos = [];
  }
  return { cheia, sta: j.sta };
}
const r1 = correr(false), r2 = correr(true);
const gasto = ESTAMINA.correr * 6 * 0.8;
ok(r1.cheia - r1.sta >= gasto, `rede boa: gastou ${(r1.cheia - r1.sta).toFixed(1)} de ${r1.cheia}`);
ok(r2.cheia - r2.sta >= gasto, `pacotes juntos: gastou ${(r2.cheia - r2.sta).toFixed(1)} de ${r2.cheia}`);
const r3 = correr(true, HEROI.correr * ESTAMINA.trote);
ok(r3.cheia - r3.sta < 0.01, `trote com pacotes juntos não gasta (${(r3.cheia - r3.sta).toFixed(1)})`);

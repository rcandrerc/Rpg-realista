// Rollback com a internet engasgando (André 2026-11-12: "rollback o tempo todo", ping 3000 a 20000 ms).
// O celular manda a posição 20 vezes por segundo; quando a rede trava, as posições chegam todas juntas. Antes a folga do
// servidor parava em 10 m: 1,5 s de engasgo correndo já virava dezenas de "corrigir" e o herói voltava até 10 m.
// Uso: node ferramentas/testes/rollback-rede.mjs
import { Simulacao, MAPA_CLAREIRA, HEROI, ORCAMENTO } from '../../shared/index.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const TICK = 1 / 20;

function novo() {
  const s = new Simulacao(MAPA_CLAREIRA);
  const j = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
  j.criando = false; j.x = 0; j.z = 0; j.y = s.terreno.altura(0, 0, 10);
  s.passo(TICK); s.eventos = [];
  return { s, j };
}
const correcoes = (ev) => ev.filter((e) => e.t === 'corrigir' && e.para === 'A');

// corre em linha reta; de 1 s a 1 s + trava a rede segura tudo e entrega junto no fim
function engasgo(trava, vel = HEROI.correr) {
  const { s, j } = novo();
  let z = 0, fila = [], n = 0;
  for (let t = 0; t < 4 + trava; t += TICK) {
    z += vel * TICK;
    fila.push({ x: 0, y: s.terreno.altura(0, z, j.y + 1), z, ry: 0, e: 1, c: 0 });
    if (!(t >= 1 && t < 1 + trava)) { for (const p of fila) s.posicaoCliente('A', p); fila = []; }
    n += correcoes(s.passo(TICK)).length;
  }
  return { n, z: j.z, fim: z };
}
for (const t of [1.5, 2, 3, 4.5]) {
  const r = engasgo(t);
  ok(r.n === 0 && Math.abs(r.z - r.fim) < 0.01, `engasgo de ${t} s correndo: ${r.n} correções, servidor em z ${r.z.toFixed(1)} (celular ${r.fim.toFixed(1)})`);
}

// hack de velocidade continua barrado: correr o dobro o tempo todo
{
  const { s } = novo();
  let z = 0, n = 0;
  for (let t = 0; t < 4; t += TICK) { z += HEROI.correr * 2 * TICK; s.posicaoCliente('A', { x: 0, y: s.terreno.altura(0, z, 10), z, ry: 0, e: 1, c: n ? 1 : 0 }); n += correcoes(s.passo(TICK)).length; }
  ok(n >= 1, `correr 2x mais rápido é recusado (${n} correção)`);
}

// calado o máximo e depois teleporte maior que a folga: recusado
{
  const { s, j } = novo();
  for (let t = 0; t < ORCAMENTO.silencio + 1; t += TICK) s.passo(TICK);
  const longe = ORCAMENTO.burst + HEROI.correr * 1.3 * ORCAMENTO.silencio + 5;
  s.posicaoCliente('A', { x: 0, y: s.terreno.altura(0, longe, 10), z: longe, ry: 0, e: 1, c: 0 });
  ok(correcoes(s.passo(TICK)).length === 1 && Math.abs(j.z) < 0.01, `teleporte de ${longe.toFixed(0)} m depois de ${ORCAMENTO.silencio + 1} s calado é recusado`);
}

// posições que saíram antes da correção (c velho) são ignoradas: uma correção só, sem cascata
{
  const { s, j } = novo();
  s.posicaoCliente('A', { x: 0, y: s.terreno.altura(0, 80, 10), z: 80, ry: 0, e: 1, c: 0 }); // longe demais: corrige
  let ev = correcoes(s.passo(TICK));
  ok(ev.length === 1 && ev[0].c === 1, 'a correção vai numerada (c: 1)');
  let n = 0;
  for (let k = 1; k <= 20; k++) { s.posicaoCliente('A', { x: 0, y: s.terreno.altura(0, 80 + k * 0.27, 10), z: 80 + k * 0.27, ry: 0, e: 1, c: 0 }); n += correcoes(s.passo(TICK)).length; }
  ok(n === 0, `20 posições atrasadas de antes da correção: ${n} correções a mais`);
  s.posicaoCliente('A', { x: 0, y: s.terreno.altura(0, 0.25, 10), z: 0.25, ry: 0, e: 1, c: 1 }); // já aplicou a correção
  s.passo(TICK);
  ok(Math.abs(j.z - 0.25) < 0.01, 'depois da correção a posição nova vale');
  // app antigo (sem c): continua como antes
  s.posicaoCliente('A', { x: 0, y: s.terreno.altura(0, 90, 10), z: 90, ry: 0, e: 1 });
  ok(correcoes(s.passo(TICK)).length === 1, 'app sem número de correção é conferido como antes');
}

// celular calado (internet engasgada): o servidor não anda o herói pelo último joystick, espera
{
  const { s, j } = novo();
  s.entrada('A', { mx: 0, mz: 1, correr: true });
  for (let k = 1; k <= 10; k++) { s.posicaoCliente('A', { x: 0, y: s.terreno.altura(0, k * 0.27, 10), z: k * 0.27, ry: 0, e: 1, c: 0 }); s.passo(TICK); }
  const z0 = j.z;
  for (let t = 0; t < 2; t += TICK) s.passo(TICK);
  ok(Math.abs(j.z - z0) < 0.01, `2 s calado correndo: o herói ficou parado no servidor (andou ${(j.z - z0).toFixed(2)} m)`);
}

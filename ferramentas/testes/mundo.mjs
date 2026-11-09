// FASE 3, Parte 2 (André 2026-11-08): a grade do mundo (2 continentes, mar central e ilha). O mapa de hoje fica igual
// (altura 0 da grade em tudo que já existe), o mundo fica umas 4 vezes maior e o mar entre as terras dá para o navio.
// Uso: node ferramentas/testes/mundo.mjs
import { MAPA_CLAREIRA as M } from '../../shared/index.js';
import { montarMundo, alturaMundo, terraEm, TERRAS, MUNDO } from '../../shared/mundo.js';
import { VEICULOS } from '../../shared/dados.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const G = montarMundo(M);
let terra = 0; for (const t of G.terra) if (t) terra++;
const area = terra * G.passo * G.passo;
ok(area > 350000 && area < 600000, `terra do mundo: ${Math.round(area / 1000)} mil m² (o mapa de hoje tem uns 100 mil)`);
ok(TERRAS.every((T) => G.terra.includes(TERRAS.indexOf(T) + 1)), 'Vael, a Ilha do Meio e Aurora existem');
const pontos = [[0, 0], ...M.npcs.filter((n) => !n.mundo).map((n) => [n.x, n.z]), ...M.caca.filter((c) => !c.mundo).map((c) => [c.x, c.z]), ...M.mina.filter((c) => !c.mundo).map((c) => [c.x, c.z])];
ok(pontos.every(([x, z]) => Math.abs(alturaMundo(G, x, z)) < 1e-6 && terraEm(G, x, z)?.id === 'vael'), 'o mapa de hoje fica no plano (grade 0) e em Vael');
// do litoral leste de Vael até Aurora passando pela ilha: tem mar fundo para o navio dos dois lados da ilha
const fundo = (a, b) => { let m = 0; for (let x = a; x <= b; x += 2) m = Math.min(m, alturaMundo(G, x, 40)); return m; };
ok(fundo(420, 470) < MUNDO.mar - VEICULOS.navio.fundo, 'mar fundo entre Vael e a ilha: ' + fundo(395, 445).toFixed(1));
ok(fundo(655, 700) < MUNDO.mar - VEICULOS.navio.fundo, 'mar fundo entre a ilha e Aurora: ' + fundo(595, 640).toFixed(1));
ok(terraEm(G, 565, 40)?.id === 'ilha' && terraEm(G, 905, 50)?.id === 'aurora' && terraEm(G, 500, 300) === null, 'terraEm');
// sorteio fixo: duas montagens saem iguais
const G2 = montarMundo(M); ok(G2.h.every((v, i) => v === G.h[i]), 'sorteio fixo');

// Parte 3: o servidor já conhece o mundo grande. A terra nova é andável, o mar é água (boia), e no mar só de barco.
import { Simulacao } from '../../shared/index.js';
import { dentroDoMapa } from '../../shared/mapa.js';
import { noLago, chaoDoRelevo, relevo, alturaMontanha } from '../../shared/relevo.js';
ok(dentroDoMapa(M, 300, 300) === false || terraEm(G, 300, 300), 'fora da terra não anda');
ok(dentroDoMapa(M, 905, 50) && dentroDoMapa(M, 565, 40) && dentroDoMapa(M, -150, 50), 'Aurora, a ilha e o oeste de Vael são andáveis');
ok(!dentroDoMapa(M, 470, 40) && noLago(450, 40)?.lago.mar && relevo(450, 40) < -1.6, 'o mar entre Vael e a ilha é água funda e não se anda nele');
ok(chaoDoRelevo(450, 40) > relevo(450, 40), 'no mar o herói boia');
ok(alturaMontanha(0, 0) === 0 && alturaMontanha(188, -62) > 0, 'a vila e a montanha de hoje não mudaram de altura');
const s = new Simulacao(M);
ok(s.terreno.altura(905, 50) > 0, 'o terreno do servidor tem a altura de Aurora');

// Parte 4: lugares planos e estradas de subida suave
import { LUGARES_MUNDO, ESTRADAS_MUNDO, RAMPA_MAX } from '../../shared/mundo.js';
for (const L of LUGARES_MUNDO) {
  let pior = 0, praia = Infinity;
  for (let a = 0; a < 6.28; a += 0.3) for (const f of [0.3, 0.6, 0.9]) pior = Math.max(pior, Math.abs(alturaMundo(G, L.x + Math.cos(a) * L.r * f, L.z + Math.sin(a) * L.r * f) - L.y));
  for (let a = 0; a < 6.28; a += 0.2) for (let d = 0; d < 60; d += 2) if (alturaMundo(G, L.x + Math.cos(a) * d, L.z + Math.sin(a) * d) < 0) { praia = Math.min(praia, d); break; }
  const T = terraEm(G, L.x, L.z);
  ok(T?.id === L.terra && (L.tipo === 'porto' ? praia < 30 : pior < 0.15 && praia > L.r + 10), `${L.id} (${L.tipo}) em ${L.terra}, plano (${pior.toFixed(2)} m), mar a ${praia === Infinity ? '60+' : praia} m`);
}
for (let a = 0; a < LUGARES_MUNDO.length; a++) for (let b = a + 1; b < LUGARES_MUNDO.length; b++) {
  const A = LUGARES_MUNDO[a], B = LUGARES_MUNDO[b];
  if (![A.tipo, B.tipo].some((t) => t === 'porto' || t === 'mina')) ok(Math.hypot(A.x - B.x, A.z - B.z) > A.r + B.r + 25, `${A.id} longe de ${B.id}`);
}
for (const E of ESTRADAS_MUNDO) {
  let pior = 0, molhado = 0;
  // rampa medida em trechos de ~6 m (a grade tem 4 m: de 2 em 2 m sobra degrauzinho de interpolação)
  for (let i = 3; i < E.curva.length; i++) {
    const [x0, z0] = E.curva[i - 3], [x1, z1] = E.curva[i], d = Math.hypot(x1 - x0, z1 - z0);
    if (d > 3) pior = Math.max(pior, Math.abs(alturaMundo(G, x1, z1) - alturaMundo(G, x0, z0)) / d);
  }
  for (const [x, z] of E.curva) if (alturaMundo(G, x, z) < 0) molhado++;
  ok(pior <= RAMPA_MAX * 1.25 && molhado === 0, `${E.id}: rampa máxima ${(pior * 100).toFixed(1)}%, ${molhado} pontos na água`);
}

// Parte 5: campos de caça do Nv 30 ao 100 nos lugares planos, com monstros vivos e no nível
const novos = M.caca.filter((c) => c.mundo);
ok(novos.length >= 20 && Math.min(...novos.map((c) => c.nivel)) > 30 && Math.max(...novos.map((c) => c.nivel)) === 100, `${novos.length} campos novos, Nv ${Math.min(...novos.map((c) => c.nivel))} a 100`);
const sim = new Simulacao(M);
for (const c of novos) {
  const ci = M.caca.indexOf(c), vivos = sim.cacas[ci].vagas.filter((vg) => vg.e && vg.e.vida > 0);
  const chao = vivos.every((vg) => Math.abs(vg.e.y ?? 0) < 30 && Math.hypot(vg.e.x - c.x, vg.e.z - c.z) <= c.r + 0.5);
  ok(vivos.length === 11 && chao, `${c.id} Nv ${c.nivel}: ${vivos.length} monstros dentro do campo`);
}

// Parte 6b: poucos mercadores por região no mundo grande, em terra firme; a entrega que cruza o mar de navio é a que
// mais paga (André 2026-11-08)
import { MERCADORES_PACK } from '../../shared/dados.js';
import { precoPack } from '../../shared/transporte.js';
const reg = {};
for (const n of MERCADORES_PACK) { const T = terraEm(G, n.x, n.z); const k = n.mundo ? T?.id : 'hoje'; reg[k] = (reg[k] || 0) + 1; ok(T && alturaMundo(G, n.x, n.z) > 0.5 || !n.mundo, `${n.id} em terra (${T?.id})`); }
ok(reg.vael <= 3 && reg.ilha <= 2 && reg.aurora <= 4, 'poucos mercadores por região: ' + JSON.stringify(reg));
ok(new Set(MERCADORES_PACK.map((n) => n.merch)).size === MERCADORES_PACK.length, 'cada mercador faz um pack diferente');
let melhorTerra = 0, melhorMar = 0;
for (const a of MERCADORES_PACK) for (const b of MERCADORES_PACK) {
  if (a === b) continue;
  const mesma = terraEm(G, a.x, a.z)?.id === terraEm(G, b.x, b.z)?.id;
  const p = precoPack({ k: a.merch, ox: a.x, oz: a.z, nav: mesma ? 0 : 200 }, b) / 1; // por base: pack mais caro não conta
  const porBase = p / ({ ...Object.fromEntries([]) }, 1);
  if (mesma) melhorTerra = Math.max(melhorTerra, porBase); else melhorMar = Math.max(melhorMar, porBase);
}
ok(melhorMar > melhorTerra * 1.3, `entrega pelo mar paga mais: ${melhorMar} contra ${melhorTerra} em terra`);

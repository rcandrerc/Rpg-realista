// Cavernas nas montanhas do mundo grande (André 2026-11-09): cada caverna tem boca no pé de uma montanha, trilha da
// rede até a frente, rocha por cima do túnel inteiro, chão contínuo do lado de fora até o fundo e parede dos lados.
// Uso: node ferramentas/testes/cavernas-mundo.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { TUNEIS_MUNDO } from '../../shared/dados.js';
import { pontoDoTunel, TUNEIS, noTunel } from '../../shared/caverna.js';
import { CAVERNAS_MUNDO, LUGARES_MUNDO, ESTRADAS_MUNDO, alturaMundo } from '../../shared/mundo.js';
import { gradeDoMundo } from '../../shared/relevo.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA), T = s.terreno, G = gradeDoMundo();
ok(TUNEIS_MUNDO.length === CAVERNAS_MUNDO.length && TUNEIS_MUNDO.length >= 5, `${TUNEIS_MUNDO.length} cavernas no mundo grande`);
ok(TUNEIS.length === TUNEIS_MUNDO.length + 1, 'a caverna da dungeon continua lá');
for (const C of TUNEIS_MUNDO) {
  const L = LUGARES_MUNDO.find((l) => l.id === C.id);
  ok(L && ESTRADAS_MUNDO.some((E) => E.id === `t_${C.id}`), `${C.id}: frente plana com trilha`);
  let pouca = 0;
  for (const a of C.amostras) { if (a.s < 8) continue; for (const k of [-1, 0, 1]) { const p = pontoDoTunel(a.s, (a.l + 1) * k, C); if (alturaMundo(G, p.x, p.z) < a.y + a.teto + 1) pouca++; } }
  ok(pouca === 0, `${C.id}: rocha por cima do túnel todo (da boca para dentro; na boca é o paredão)`);
  // andando da frente (chão plano) até o fundo, sem degrau
  let y = T.altura(L.x, L.z, 99), pior = 0;
  const dx = C.amostras[0].x - L.x, dz = C.amostras[0].z - L.z;
  for (let t = 0; t <= 1; t += 0.05) { const h = T.altura(L.x + dx * t, L.z + dz * t, y + 0.3); pior = Math.max(pior, Math.abs(h - y)); y = h; }
  for (let sv = 0; sv <= C.total; sv += 0.25) { const p = pontoDoTunel(sv, 0, C), h = T.altura(p.x, p.z, y + 0.3); pior = Math.max(pior, Math.abs(h - y)); y = h; }
  ok(pior < 0.2, `${C.id}: da frente ao fundo sem degrau (${pior.toFixed(3)} m)`);
  const meio = pontoDoTunel(46, 0, C), parede = pontoDoTunel(46, meio.l + 1.2, C);
  ok(Math.abs(T.altura(meio.x, meio.z, meio.y + 0.3) - meio.y) < 0.01 && T.altura(meio.x, meio.z) > meio.y + 8, `${C.id}: lá dentro o chão é o da caverna, por cima é a montanha`);
  ok(T.altura(parede.x, parede.z, meio.y + 0.3) > meio.y + 3, `${C.id}: um passo para o lado é rocha`);
  ok(T.teto(meio.x, meio.z, meio.y + 0.3) < meio.y + 9, `${C.id}: tem teto`);
}

// o que tem lá dentro: covil (monstros no chão da caverna, presos no túnel) e minério bom (pedras no chão dela)
for (const C of TUNEIS_MUNDO) {
  const ci = s.cacas.findIndex((c) => c.def.tunel === C.id), cc = s.cacas[ci];
  ok(cc && cc.vagas.every((vg) => vg.e && Math.abs(vg.e.y - noTunel(C, vg.e.x, vg.e.z)?.y) < 0.01), `${C.id}: covil cheio, monstros no chão da caverna`);
  const e = cc.vagas[0].e, fora = LUGARES_MUNDO.find((l) => l.id === C.id);
  for (let k = 0; k < 200; k++) s.mover(e, (fora.x - e.x) * 0.05, (fora.z - e.z) * 0.05);
  ok(noTunel(C, e.x, e.z) && noTunel(C, e.x, e.z).s >= 3.9, `${C.id}: monstro do covil não sai pela boca`);
  for (let k = 0; k < 50; k++) s.mover(e, -e.x * 0 + (C.amostras[30].dz) * 0.5, -(C.amostras[30].dx) * 0.5);
  ok(noTunel(C, e.x, e.z), `${C.id}: nem atravessa a parede`);
  const pedras = [...s.coletaveis.values()].filter((v) => v.mina === `m_${C.id}`);
  ok(pedras.length === 4 && pedras.every((v) => { const c = noTunel(C, v.x, v.z); return c && Math.abs(c.y - v.y) < 0.01 && c.d < c.l - 0.5; }), `${C.id}: 4 pedras de minério no chão da caverna`);
}

// as árvores lá em cima da montanha não seguram quem anda na caverna embaixo (e seguram quem está lá em cima)
{
  const j = s.adicionarJogador('Z', 'Zeca');
  let ok1 = true, ok2 = true;
  for (const C of TUNEIS_MUNDO) {
    const a = C.amostras[34], k = Math.floor(a.x / 6) * 10007 + Math.floor(a.z / 6), topo = T.altura(a.x, a.z);
    if (!s.mata.has(k)) s.mata.set(k, []);
    const arv = { x: a.x + 0.2, z: a.z, r: 0.4, base: topo }; s.mata.get(k).push(arv);
    Object.assign(j, { x: a.x, z: a.z, y: a.y }); s.colidir(j); if (Math.hypot(j.x - a.x, j.z - a.z) > 0.01) ok1 = false;
    Object.assign(j, { x: a.x, z: a.z, y: topo }); s.colidir(j); if (Math.hypot(j.x - a.x, j.z - a.z) < 0.1) ok2 = false;
    s.mata.get(k).pop();
  }
  ok(ok1 && ok2, 'árvore em cima da montanha não segura quem passa na caverna embaixo (e segura quem está lá em cima)');
}

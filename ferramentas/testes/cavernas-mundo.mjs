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

// Cap. 10 "A gruta que canta" (André 2026-11-17: "a entrada da caverna é muito alta, quando você entra quase que por
// debaixo da terra e depois aparece por cima... pode fazer uma montanha, mas suavizando, para eu conseguir subir")
{
  const fs = await import('node:fs');
  const MB = (await import('../../shared/mundo.js')).MORRO_BOCA;
  // o app usa a MESMA grade do servidor (antes o exportador montava de novo e a frente da boca ficava 3,5 m mais baixa)
  const GA = JSON.parse(fs.readFileSync(new URL('../../godot-prototipo/dados/mundo_grade.json', import.meta.url)));
  let dif = 0; for (let k = 0; k < G.h.length; k++) if (Math.abs(GA.h[k] / 10 - G.h[k]) > 0.06) dif++;
  ok(GA.nx === G.nx && GA.nz === G.nz && dif === 0, `chão do app = chão do servidor (${dif} pontos diferentes; rode node client/exportar-godot/mundo.mjs)`);
  for (const C of TUNEIS_MUNDO) {
    const a0 = C.amostras[0], L = LUGARES_MUNDO.find((l) => l.id === C.id);
    ok(Math.abs(alturaMundo(G, a0.x - a0.dx * 2, a0.z - a0.dz * 2) - a0.y) < 0.3, `${C.id}: a boca fica no nível do chão da frente`);
    // dos lados da boca, logo atrás da cara do paredão, é rocha (não dá para sair andando do túnel e subir por dentro da pedra)
    let baixo = 0;
    for (let s2 = 3; s2 <= 8; s2 += 0.5) for (const k of [-1, 1]) { const p = pontoDoTunel(s2, k * (C.amostras[Math.round(s2)].l + 1.5), C); if (!noTunel(C, p.x, p.z) && alturaMundo(G, p.x, p.z) < a0.y + 2.5) baixo++; }
    ok(baixo === 0, `${C.id}: dos lados do túnel, perto da boca, a rocha passa de 2,5 m (${baixo} pontos baixos)`);
    // o morro novo dos lados sobe suave: de 4 a 10 m para dentro, de 10 a 26 m para o lado (fora da rocha do paredão), nenhum metro do chão novo mais
    // íngreme que o de antes ou que 2x a rampa (folga da grade de 4 m)
    let pior = 0;
    const GA = { ...G, h: G.hAntesArenas };
    for (const k of [-1, 1]) for (let s2 = 4; s2 <= 10; s2 += 2) for (let l = 10; l <= 26; l += 1) {
      const p = pontoDoTunel(s2, k * l, C), q = pontoDoTunel(s2, k * (l + 1), C);
      const novo = Math.abs(alturaMundo(G, p.x, p.z) - alturaMundo(G, q.x, q.z)), antes = Math.abs(alturaMundo(GA, p.x, p.z) - alturaMundo(GA, q.x, q.z));
      if (novo > antes + 0.15) pior = Math.max(pior, novo);
    }
    ok(pior <= MB.rampa * 2 + 0.05, `${C.id}: encosta do lado da boca dá para subir (pior ${pior.toFixed(2)} m por m)`);
  }
}

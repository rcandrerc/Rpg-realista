// Catalisador (André 2026-11-07, como no Quimera): destruir peça dá catalisador (Runa = arma, Selo = armadura);
// "Destruir todas" de uma raridade faz uma barrinha por peça, uma depois da outra; evoluir sobe a raridade.
// Uso: node ferramentas/testes/catalisador.mjs
import { Simulacao, MAPA_CLAREIRA, CATALISADOR, ITENS, contar } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const nova = () => {
  const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('C', 'Cris');
  j.criando = false; j.morto = false; s.estacaoPerto = () => ({ x: j.x, z: j.z }); // como se estivesse na bigorna/bancada
  const ev = []; const e0 = s.evento.bind(s); s.evento = (e) => { ev.push(e); e0(e); };
  const fim = () => { let n = 0; while (j.fabrica && n++ < 200) { s.tempo = j.fabrica.fim; s.passoFabrica(j); } };
  return { s, j, M: j.prog.mochila, ev, fim };
};
ok(CATALISADOR.arma.concat(CATALISADOR.armadura).every((k) => ITENS[k]?.mat), 'os 8 catalisadores existem como material');

// destruir uma: barrinha, a peça some e vem o catalisador da raridade de baixo (Rara dá Selo Raro / Runa Rara)
{
  const { s, j, M, ev, fim } = nova();
  const r0 = Math.random; Math.random = () => 0.5; // 1 catalisador, sem extra
  M[0] = { k: 'peitoral', r: 1 }; M[1] = { k: 'espada', r: 2 };
  s.item('C', { acao: 'destruir', i: 0 });
  ok(j.fabrica && M[0], 'destruir começa a barrinha e a peça ainda está lá');
  ok(ev.some((e) => e.t === 'fabricando' && e.v === 'Destruindo'), 'barrinha "Destruindo"');
  fim();
  ok(!M.some((o) => o && o.k === 'peitoral'), 'peça destruída some');
  ok(contar(M, 'selo_raro') === 1, 'Peitoral Raro dá 1 Selo Raro');
  s.item('C', { acao: 'destruir', i: M.findIndex((o) => o && o.k === 'espada') }); fim();
  ok(contar(M, 'runa_rara') === 1, 'Espada Épica dá 1 Runa Rara (a de baixo)');
  Math.random = () => 0.01; // extra sai
  M[5] = { k: 'cajado', r: 3 }; s.item('C', { acao: 'destruir', i: 5 }); fim();
  ok(contar(M, 'runa_lendaria') === 1, 'com sorte, peça Lendária dá também 1 Runa Lendária');
  Math.random = r0;
}
// destruir todas as Raras: uma por uma, com o mesmo tempo; cadeado e outras raridades ficam
{
  const { s, j, M, ev, fim } = nova();
  M[0] = { k: 'botas', r: 1 }; M[1] = { k: 'capa', r: 1 }; M[2] = { k: 'espada', r: 1, cad: 1 }; M[3] = { k: 'chapeu', r: 2 }; M[4] = { k: 'calca', r: 1, e: 3 };
  s.item('C', { acao: 'destruir', raridade: 1 });
  ok(j.fabrica && j.fabrica.n === 3, 'Destruir todas as Raras: 3 (cadeado fica de fora)');
  const t0 = s.tempo; fim();
  ok(Math.abs(s.tempo - t0 - 3 * CATALISADOR.tempoDestruir) < 1e-6, 'leva o tempo de 3 barrinhas');
  ok(ev.filter((e) => e.t === 'fabricando' && !e.fim).length === 3, 'uma barrinha por peça');
  ok(ev.filter((e) => e.t === 'destruiu').length === 3, 'cada peça mostra o que deu');
  const eq = M.filter((o) => o && ITENS[o.k].lugar);
  ok(eq.length === 2 && eq.some((o) => o.k === 'espada' && o.cad) && eq.some((o) => o.k === 'chapeu' && o.r === 2), 'só as Raras sem cadeado foram destruídas');
  const f = ev.filter((e) => e.t === 'fabricando' && e.fim).pop();
  ok(f && /Destruiu \d+ peças?/.test(f.msg) || /Destruiu/.test(f.msg), 'no fim mostra quanto ganhou: ' + f.msg);
  s.item('C', { acao: 'destruir', raridade: 4 });
  ok(!j.fabrica, 'sem peça Mítica não começa');
  s.item('C', { acao: 'destruir', i: 2 });
  ok(!j.fabrica && M[2], 'peça com cadeado não se destrói');
}
// parar no meio: o que já foi destruído fica, o resto continua na mochila
{
  const { s, j, M } = nova();
  M[0] = { k: 'botas', r: 0 }; M[1] = { k: 'capa', r: 0 }; M[2] = { k: 'calca', r: 0 };
  s.item('C', { acao: 'destruir', raridade: 0 });
  s.tempo = j.fabrica.fim; s.passoFabrica(j);
  s.fabricar('C', { parar: true });
  ok(!j.fabrica && !M.some((o) => o?.k === 'botas') && M[1]?.k === 'capa' && M[2]?.k === 'calca', 'Parar: as que faltavam continuam');
}
// evoluir: precisa do catalisador e do material; sobe 1, sai +0 e com o cadeado
{
  const { s, j, M, fim } = nova();
  j.prog.vigor = { v: 100, t: Date.now() };
  M[0] = { k: 'peitoral', r: 1, e: 4, cad: 1 };
  s.item('C', { acao: 'evoluir', i: 0 });
  ok(!j.fabrica, 'sem Selo Épico não evolui');
  M[1] = { k: 'selo_epico', n: 1 }; M[2] = { k: 'couro', n: 6 }; M[3] = { k: 'barra_ferro', n: 4 };
  const r0 = Math.random; Math.random = () => 0.5;
  s.item('C', { acao: 'evoluir', i: 0 }); fim();
  ok(M[0].r === 2 && !M[0].e && M[0].cad === 1, 'Peitoral Raro +4 vira Épico +0 (cadeado fica)');
  ok(!contar(M, 'selo_epico') && !contar(M, 'couro') && !contar(M, 'barra_ferro'), 'gasta catalisador e material');
  // falha: perde o catalisador e o material, a peça fica
  M[1] = { k: 'selo_lendario', n: 1 }; M[2] = { k: 'couro', n: 8 }; M[3] = { k: 'cristal', n: 5 };
  Math.random = () => 0.0;
  s.item('C', { acao: 'evoluir', i: 0 }); fim();
  ok(M[0].r === 2 && !contar(M, 'selo_lendario'), 'falhou: perde o catalisador, a peça continua Épica');
  // arma usa Runa
  M[4] = { k: 'cajado', r: 0 }; M[5] = { k: 'runa_rara', n: 1 }; M[6] = { k: 'lenha', n: 4 }; M[7] = { k: 'barra_cobre', n: 3 };
  Math.random = () => 0.5;
  s.item('C', { acao: 'evoluir', i: 4 }); fim();
  ok(M[4].r === 1, 'Cajado Comum + Runa Rara vira Raro');
  M[8] = { k: 'espada', r: 4 }; s.item('C', { acao: 'evoluir', i: 8 });
  ok(!j.fabrica, 'Mítica não evolui mais');
  Math.random = r0;
}

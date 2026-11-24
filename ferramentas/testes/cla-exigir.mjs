// O líder bot exige os recursos dos membros (André 2026-11-24, CLAS_NPC_ORDENS.exigir): tira das bolsas os materiais de
// clã para o Baú do Clã (nunca o ouro), guarda o que os próximos níveis pedem e vende o resto para o líder.
// Uso: node ferramentas/testes/cla-exigir.mjs
import { Simulacao, MAPA_CLAREIRA, CLAS_NPC, CLAS_NPC_ORDENS, CLA, ITENS } from '../../shared/index.js';
import { sortearRecruta } from '../../shared/cla.js';
import { contar, guardar } from '../../shared/progresso.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

const s = new Simulacao(MAPA_CLAREIRA);
const p = s.adicionarJogador('P', 'Pedro', undefined, { conta: 11 }); p.criando = false;
s.carregarClasNpc(null);
for (const ctx of s.amigosIa) ctx.amigaEntrar('P', false);
const C = CLAS_NPC.find((K) => K.id === 'geada'), E = s.clasNpc.geada, L = s.liderNpc(C);
E.nv = 1; E.bau = Array(CLA.bauCla).fill(null);
for (let i = 0; i < 2; i++) { const m = sortearRecruta(Math.random, CLA.tiers[0], 10, Date.now()); m.fn = { k: 'grind' }; E.m.push(m); s.criarRecrutaNpc(C, m, true); }
const xs = s.amigosIa.filter((x) => x.AMIGA.clanpc === 'geada' && x.amiga);
ok(xs.length === 2, 'dois recrutas no clã bot');
const [a, b] = xs.map((x) => x.amiga);
a.prog.mochila.fill(null); b.prog.mochila.fill(null);
a.prog.ouro = 5000; b.prog.ouro = 7000; L.prog.ouro = 1000;
guardar(a.prog.mochila, { k: 'lenha', n: 50 }); guardar(a.prog.mochila, { k: 'lenha', n: 50 }); guardar(a.prog.mochila, { k: 'minerio_cobre', n: 10 });
guardar(b.prog.mochila, { k: 'pedra', n: 20 }); guardar(b.prog.mochila, { k: 'cristal', n: 5 }); guardar(b.prog.mochila, { k: 'alma_chama', n: 3 });
guardar(b.prog.mochila, { k: 'pocao', n: 4 });
const b0 = { ...b.prog.mochila.find((o) => o?.k === 'pocao') };

// André 2026-11-24: só o recurso da ORDEM (ia.levar) e a Alma vão para o clã; o que juntou no tempo livre fica com ele
a.ia.levar = { r: 'lenha', item: 'lenha', nome: 'Lenha' }; b.ia.levar = { r: 'pedra', item: 'pedra', nome: 'Pedra' };
ok(s.exigirRecursosNpc(C, E, L, xs), 'o líder recolheu');
ok(['lenha', 'pedra', 'alma_chama'].every((k) => contar(a.prog.mochila, k) + contar(b.prog.mochila, k) === 0), 'o recurso da ordem e a alma saíram das bolsas');
ok(contar(a.prog.mochila, 'minerio_cobre') === 10 && contar(b.prog.mochila, 'cristal') === 5, 'cobre e cristal do tempo livre ficam com eles');
ok(contar(b.prog.mochila, 'pocao') === b0.n, 'o que não é material (poção) fica com o recruta');
ok(a.prog.ouro === 5000 && b.prog.ouro === 7000, 'o ouro dos recrutas não é tocado');
// Nv 1 -> próximos 2 níveis pedem lenha 80 (Nv 3) e pedra 30 (Nv 2): guarda isso
ok(contar(E.bau, 'lenha') === 80, `guarda a lenha dos próximos níveis (${contar(E.bau, 'lenha')})`);
ok(contar(E.bau, 'pedra') === 20, 'pedra abaixo do pedido: guarda tudo');
ok(contar(E.bau, 'alma_chama') === 3, 'alma nunca vende');
// sem leilão (teste antigo): a sobra vai para a loja
ok(L.prog.ouro === 1000 + 20 * ITENS.lenha.venda, `sem leilão, a sobra de lenha vai para a loja (${L.prog.ouro})`);
// Nv 4 pede cristal 20 (Nv 5): aí guarda
E.nv = 3; a.ia.levar = { r: 'cristal', item: 'cristal', nome: 'Cristal' }; guardar(a.prog.mochila, { k: 'cristal', n: 25 });
s.exigirRecursosNpc(C, E, L, xs);
ok(contar(E.bau, 'cristal') === 20, `do Nv 3, guarda o cristal do Nv 5 (${contar(E.bau, 'cristal')})`);
// com o leilão: pouco anúncio do item -> o líder anuncia a sobra lá; muito anúncio -> loja
{
  const { Leilao, LEILAO_BOT } = await import('../../shared/index.js');
  s.leilao = new Leilao(); E.nv = 1; E.bau.fill(null); L.prog.ouro = 1000;
  a.prog.mochila.fill(null); b.prog.mochila.fill(null); a.ia.levar = { r: 'lenha', item: 'lenha', nome: 'Lenha' }; guardar(a.prog.mochila, { k: 'lenha', n: 50 }); guardar(a.prog.mochila, { k: 'lenha', n: 50 });
  s.exigirRecursosNpc(C, E, L, xs);
  const meus = s.leilao.anuncios.filter((x) => x.item.k === 'lenha');
  ok(meus.length === 1 && meus[0].item.n === 20 && contar(E.bau, 'lenha') === 80, `pouca lenha no leilão: o líder anunciou a sobra (${meus.map((x) => x.item.n + ' por ' + x.preco)})`);
  for (let i = 0; i < LEILAO_BOT.pouco; i++) s.leilao.anunciar('x' + i, 'X', { k: 'pedra', n: 5 }, 100, 24);
  E.nv = 1; b.ia.levar = { r: 'pedra', item: 'pedra', nome: 'Pedra' }; guardar(b.prog.mochila, { k: 'pedra', n: 50 }); guardar(b.prog.mochila, { k: 'pedra', n: 10 });
  const o0 = L.prog.ouro; s.exigirRecursosNpc(C, E, L, xs);
  ok(s.leilao.anuncios.filter((x) => x.item.k === 'pedra' && x.vendedor !== 'X').length === 0 && L.prog.ouro > o0, 'muita pedra no leilão: a sobra vai para a loja');
}
// desligado: nada muda
CLAS_NPC_ORDENS.exigir.ligado = false; guardar(a.prog.mochila, { k: 'pedra', n: 5 });
ok(!s.exigirRecursosNpc(C, E, L, xs) && contar(a.prog.mochila, 'pedra') === 5, 'desligado: não recolhe');
CLAS_NPC_ORDENS.exigir.ligado = true;

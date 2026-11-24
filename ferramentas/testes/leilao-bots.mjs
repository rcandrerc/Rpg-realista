// Os bots no leilão (André 2026-11-21): vendem o que sobra com o nome deles, compram o que melhora (material de evoluir,
// peça melhor, Tomo, consumível), guardam poupança para a próxima grande peça e o preço de mercado sobe com venda rápida,
// cai sem venda e acompanha o ouro do mundo (inflação). Sem rede. Uso: node ferramentas/testes/leilao-bots.mjs
import { Simulacao, MAPA_CLAREIRA, Leilao, LEILAO, LEILAO_BOT, contar, DIA } from '../../shared/index.js';
import { chaveMercado } from '../../shared/leilao.js';
import { HISTORIA } from '../../shared/index.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA); s.adicionarJogador('p', 'P', 'ruiva', { conta: 9 });
for (const x of s.amigosIa) x.amigaEntrar('p', false);
const bot = (id) => s.amigosIa.find((x) => x.AMIGA.id === id);
const C = bot('cecilia'), D = bot('dario');
ok(C?.amiga && D?.amiga, 'Cecília e Dario no mundo');
// a tabela de personalidade: todos os 7 bots têm jeito no comércio
for (const id of ['cecilia', 'dario', 'lia', 'kira', 'rufo', 'lis', 'gael']) ok(LEILAO_BOT.jeitos[id]?.texto && LEILAO_BOT.jeitos[id].poupa > 0, `${id}: tem jeito no leilão (poupa ${LEILAO_BOT.jeitos[id]?.poupa})`);
ok(LEILAO_BOT.jeitos.dario.poupa === 0.8 && LEILAO_BOT.jeitos.cecilia.poupa === 0.6, 'Dario poupa 80%, Cecília 60%');

// ---------- o mercado ----------
{
  const L = new Leilao(), it = { k: 'barra_ferro', n: 1 }, p0 = L.precoMercado(it);
  const a = L.anunciar('x', 'X', { k: 'barra_ferro', n: 10 }, p0 * 10 * 2, 24); // vendeu o dobro do mercado, rápido
  L.comprar(a.id, 'y');
  ok(L.precoMercado(it) > p0, `venda rápida e cara sobe o preço (${p0} -> ${L.precoMercado(it)})`);
  const p1 = L.precoMercado(it), b = L.anunciar('x', 'X', { k: 'barra_ferro', n: 1 }, p1, 24); b.ate = Date.now() - 1; L.vencer();
  ok(L.precoMercado(it) < p1, `anúncio que venceu sem vender derruba o preço (${p1} -> ${L.precoMercado(it)})`);
  const p2 = L.precoMercado(it); L.mercado[chaveMercado(it)].t -= 6 * 24 * 3600e3;
  ok(L.precoMercado(it) < p2, `dias sem venda: o preço cai devagar (${p2} -> ${L.precoMercado(it)})`);
  const casa0 = L.casa[0].preco, base = L.precoMercado({ k: 'espada', r: 3 });
  for (let i = 0; i < 5; i++) L.verOuro('c' + i, 48000);
  ok(L.inflacao() > 3.5 && L.precoMercado({ k: 'espada', r: 3 }) > base * 3.5, `muito ouro no mundo: inflação ${L.inflacao().toFixed(2)}x no preço de referência`);
  L.buscar({}, 'z');
  ok(L.casa[0].preco > casa0 * 3.5, `a casa acompanha a inflação (${casa0} -> ${L.casa[0].preco})`);
  const L2 = new Leilao(JSON.parse(JSON.stringify(L.estado())));
  ok(L2.precoMercado(it) === L.precoMercado(it) && L2.inflacao() === L.inflacao(), 'mercado e inflação guardados no banco');
}

// ---------- o bot vende o que sobra ----------
const a = C.amiga, p = a.prog;
s.leilao = new Leilao();
p.mochila.fill(null); p.ouro = 500;
p.mochila[0] = { k: 'pedra', n: 50 }; p.mochila[1] = { k: 'pedra', n: 30 }; // 80 de pedra: guarda 50
p.mochila[2] = { k: 'capa', r: 2 }; // capa Épica que não usa (a dela é Lendária)
p.equip.capa = { k: 'capa', r: 3 };
a.ia.leilaoT = 0; a.leilaoBot = null;
const r1 = C.leilaoBotAmiga(a);
const meus = s.leilao.meus(a.conta);
ok(r1.anunciou >= 2 && meus.every((x) => x.vendedor === 'Cecília'), `anunciou ${r1.anunciou} itens com o nome dela`);
const pedra = meus.find((x) => x.item.k === 'pedra');
ok(pedra && pedra.item.n === 30 && contar(p.mochila, 'pedra') === 50, 'pedra: guarda 50 de reserva e anuncia só as 30 que sobram');
const mp = s.leilao.precoMercado({ k: 'pedra', n: 1 }) * 30;
ok(pedra.preco >= Math.round(mp * 1.04) && pedra.preco <= Math.round(mp * 1.16) + 1, `preço entre 5% e 15% acima do mercado (${pedra.preco} sobre ${mp})`);
ok(pedra.preco > 30 * 1, 'nunca pelo preço da loja');
ok(p.ouro < 500, `pagou a taxa de anúncio (${500 - p.ouro} de ouro)`);
// o Dario, ganancioso, anuncia mais caro pela mesma coisa
{
  const b = D.amiga; b.prog.mochila.fill(null); b.prog.ouro = 500; b.prog.mochila[0] = { k: 'pedra', n: 80 }; b.leilaoBot = null;
  D.leilaoBotAmiga(b);
  const pd = s.leilao.meus(b.conta).find((x) => x.item.k === 'pedra');
  ok(pd && pd.preco / pd.item.n > pedra.preco / pedra.item.n, `Dario anuncia mais caro que a Cecília (${(pd.preco / pd.item.n).toFixed(2)} x ${(pedra.preco / pedra.item.n).toFixed(2)} por pedra)`);
}

// ---------- poupança e compra ----------
{
  s.leilao.caixa[a.conta] = { ouro: 0, itens: [] }; a.leilaoBot.visto = p.ouro; p.ouro += 1000; // ganhou 1000 caçando (sem venda no meio)
  const antes = a.leilaoBot.poupado;
  a.ia.leilaoT = 0; C.leilaoBotAmiga(a);
  ok(a.leilaoBot.poupado - antes === 600, `60% da renda da Cecília vai para a poupança (${a.leilaoBot.poupado - antes})`);
  ok(a.leilaoBot.meta && a.leilaoBot.meta.preco > 0, `tem meta: ${a.leilaoBot.meta.nome} por ${a.leilaoBot.meta.preco}`);
}
// consumível barato não sai da poupança (só do que passa de 1,5x a meta)
{
  const L = s.leilao; s.leilao.caixa[a.conta] = { ouro: 0, itens: [] }; p.ouro = 400; a.leilaoBot.poupado = 360; a.leilaoBot.visto = 400; // abaixo de 1,5x a meta
  for (let i = 0; i < p.mochila.length; i++) if (p.mochila[i]?.k === 'pocao') p.mochila[i] = null;
  const an = L.anunciar('c77', 'Zé', { k: 'pocao', n: 1 }, 2, 24);
  C.leilaoBotAmiga(a);
  ok(L.achar(an.id), 'com pouco ouro livre não compra consumível (guarda para a meta)');
  p.ouro = 1e6; a.leilaoBot.visto = 1e6; a.leilaoBot.poupado = 0; a.leilaoBot.meta = null;
  C.leilaoBotAmiga(a);
  ok(!L.achar(an.id), 'com muito ouro sobrando compra a poção barata');
  ok(L.caixa.c77?.ouro > 0, 'o vendedor recebe o ouro com o Otávio');
  ok(a.leilaoBot.log.some((x) => x.o === 'comprou' && /Zé/.test(x.txt)), 'o negócio vai para o registro dela (relatório e chat)');
}
// peça de raridade maior: usa a poupança e veste na hora
{
  const L = s.leilao; for (const k of Object.keys(p.atr)) p.atr[k] = 999;
  p.equip.pes = { k: 'botas', r: 0 };
  const preco = L.precoMercado({ k: 'botas', r: 1 });
  const an = L.anunciar('c78', 'Ana', { k: 'botas', r: 1 }, preco, 24);
  p.ouro = preco + 100; a.leilaoBot.visto = p.ouro; a.leilaoBot.poupado = preco; // quase tudo é poupança
  C.leilaoBotAmiga(a);
  ok(!L.achar(an.id) && p.equip.pes?.r === 1 && p.equip.pes.k === 'botas', 'comprou a bota Rara com a poupança e já vestiu');
}
// cara demais (mais de 30% acima do mercado): não compra
{
  const L = s.leilao; p.equip.pernas = { k: 'calca', r: 0 };
  const an = L.anunciar('c79', 'Beto', { k: 'calca', r: 1 }, L.precoMercado({ k: 'calca', r: 1 }) * 3, 24);
  p.ouro = 1e6; a.leilaoBot.visto = 1e6; a.leilaoBot.poupado = 0;
  C.leilaoBotAmiga(a);
  ok(L.achar(an.id), 'anúncio 3x acima do mercado fica lá (difícil de vender)');
}
// material de evoluir: compra se for mais barato que farmar
{
  const L = s.leilao;
  for (const [l, it] of Object.entries(p.equip)) if (it && l !== 'pernas') p.equip[l] = { k: it.k, r: 4 }; // só a calça fraca: ela é a meta
  const R = C.receitaEvoluir(p.equip.pernas), k = Object.keys(R.usa).find((x) => /runa|selo/.test(x));
  p.prof = { ...(p.prof || {}), [R.prof]: 1e6 }; p.hist = { v: 2, p: HISTORIA.length, ac: false, e: 0, n: 0, m: 0 }; // história feita: a forja está aberta
  const an = L.anunciar('c80', 'Caio', { k, n: 1 }, L.precoMercado({ k, n: 1 }), 24);
  a.leilaoBot.meta = null; C.leilaoBotAmiga(a);
  const quer = C.precisaLeilaoAmiga(a, a.leilaoBot.meta);
  ok(a.leilaoBot.meta?.l === 'pernas' && quer[k] && !L.achar(an.id) && contar(p.mochila, k) >= 1, `material para evoluir a peça da meta (${k}) é comprado no leilão`);
}
// ritmo: 2 ou 3 olhadas por dia do jogo
{
  a.ia.leilaoT = s.tempo; const t0 = s.tempo; C.leilaoTalvezAmiga(a);
  const dia = DIA.horaSeg * 24, passo = a.ia.leilaoT - t0;
  ok(passo >= dia / 3 - 1 && passo <= dia / 2 + 1, `próxima olhada em ${Math.round(passo)} s (dia do jogo ${dia} s: 2 a 3 vezes)`);
}
// a ficha do chat conta só o que fez
ok(/comprou|anunciou/.test(C.fichaLeilaoAmiga(a) || ''), 'ficha do chat com os negócios de verdade');
// guardado com o bot (banco)
C.guardarAmiga();
const salvo = C.npcSalvos?.get(C.AMIGA.id); // o save de todos fica na tabela mundo (André 2026-11-22)
ok(salvo?.leilao?.log?.length > 0, 'a poupança e os negócios ficam salvos com ela');
ok(LEILAO.taxaAnuncio === 0.02 && LEILAO.taxa === 0.05, 'taxas: 2% para anunciar e 5% na venda');
// pelo menos um Tomo vai ao leilão (André 2026-11-24: "não existe tomo vendendo na Action House"), mesmo com peças caras
{
  s.leilao = new Leilao(); p.mochila.fill(null); p.ouro = 5000; a.ia.leilaoT = 0; a.leilaoBot = null;
  const { HABS } = await import('../../shared/progresso.js'); const h = Object.keys(HABS).find((k) => HABS[k].tomo);
  for (let i = 0; i < 10; i++) p.mochila[i] = { k: 'capa', r: 2 };
  p.mochila[10] = { k: 'tomo', h, nv: 7, n: 2 }; // repetido: um fica, o outro vai
  C.leilaoBotAmiga(a);
  const tomos = s.leilao.meus(a.conta).filter((x) => x.item.k === 'tomo').length;
  ok(tomos >= 1 && p.mochila.some((o) => o?.k === 'tomo' && o.n === 1), `anunciou ${tomos} tomo repetido e guardou 1 para ler depois`);
}

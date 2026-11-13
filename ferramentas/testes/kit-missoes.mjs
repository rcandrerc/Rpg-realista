// Missão nunca trava por falta de item (André 2026-11-12, shared/kit.js).
// Kit: só nas missões que ensinam, o NPC dá o que falta (peça para destruir/evoluir/reforçar, material da vara, lenha do
// primeiro pack, ouro da primeira compra e do terreno), o primeiro reforço é grátis. Junta: carrinho, barquinho, navio e
// toda criação nunca vêm de graça; a etapa vira "Corte Lenha: 0/30" e o Ir leva à fonte.
// Uso: node ferramentas/testes/kit-missoes.mjs
import { Simulacao, MAPA_CLAREIRA, HISTORIA, ITENS } from '../../shared/index.js';
import { etapasDe } from '../../shared/historia.js';
import { contar, guardar } from '../../shared/progresso.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
let n = 0;
// herói novo, de mochila vazia e sem ouro, na etapa e da missão id
const novo = (id, e, extra = {}) => {
  const j = s.adicionarJogador('K' + ++n, 'Kit' + n), p = j.prog, i = HISTORIA.findIndex((M) => M.id === id);
  p.nivel = Math.max(p.nivel, HISTORIA[i].nv); p.ouro = 0; p.mochila.fill(null);
  p.hist = { v: 2, p: i, ac: true, e, n: 0, m: 0 };
  Object.assign(p, extra);
  return j;
};
const etapa = (id, f) => etapasDe(HISTORIA.find((M) => M.id === id)).findIndex(f);
const dar = (p, k, q) => { const P = ITENS[k].pilha || 1; for (; q > 0; q -= P) guardar(p.mochila, { k, n: Math.min(P, q) }); };
const npc = (id) => MAPA_CLAREIRA.npcs.find((o) => o.id === id);

// ---------- a15 (Tomás): destruir, evoluir, reforçar ----------
{
  const j = novo('a15', etapa('a15', (E) => E.ev === 'destruir')), p = j.prog;
  s.kitEtapa(j);
  ok(p.mochila.some((o) => o?.k === 'botas' && o.r === 0), 'destruir sem peça: o Tomás dá uma peça velha');
  const antes = JSON.stringify(p.mochila); s.kitEtapa(j);
  ok(JSON.stringify(p.mochila) === antes, 'quem já tem a peça não ganha outra');
}
{
  const j = novo('a15', etapa('a15', (E) => E.ev === 'evoluir')), p = j.prog;
  s.kitEtapa(j);
  const peca = p.mochila.find((o) => o?.k === 'botas' && o.r === 0), R = peca && s.receitaEvoluir(peca);
  ok(!!peca && R && Object.entries(R.usa).every(([k, q]) => contar(p.mochila, k) >= q), 'evoluir sem nada: peça comum, Selo Raro e o material da receita');
}
{
  const j = novo('a15', etapa('a15', (E) => E.ev === 'reforcar')), p = j.prog;
  s.kitEtapa(j);
  const i = p.mochila.findIndex((o) => o?.k === 'botas' && o.r === 1);
  ok(i >= 0, 'reforçar sem peça Rara: o Tomás dá uma');
  ok(s.histInfo(j).gratis === true, 'hist_info avisa o app que o reforço é grátis');
  s.item(j.id, { acao: 'reforcar', i }); // +0 -> +1 tem 100%
  ok(p.ouro === 0 && (p.mochila[i].e | 0) === 1, 'reforço grátis: sem ouro e sem tecido, deu +1');
}
// ---------- a5: a primeira compra ----------
{
  const j = novo('a5', etapa('a5', (E) => E.ev === 'comprar'));
  s.kitEtapa(j);
  ok(j.prog.ouro === 45, `primeira compra sem ouro: a Rosa dá o das 3 poções (${j.prog.ouro})`);
}
// ---------- a11: a vara (material) e a pesca (a vara, no comecinho) ----------
{
  const j = novo('a11', etapa('a11', (E) => E.ev === 'criar' && E.k === 'vara')), p = j.prog;
  s.kitEtapa(j);
  ok(contar(p.mochila, 'lenha') >= 3 && contar(p.mochila, 'couro') >= 1, 'vara: o Nico dá a lenha e o couro');
  const j2 = novo('a11', etapa('a11', (E) => E.ev === 'pesca'));
  s.kitEtapa(j2);
  ok(contar(j2.prog.mochila, 'vara') === 1, 'pesca do comecinho sem vara: o Nico dá uma');
  const j3 = novo('c4', etapa('c4', (E) => E.ev === 'pesca'));
  s.kitEtapa(j3);
  ok(contar(j3.prog.mochila, 'vara') === 0, 'pesca depois do comecinho: vara não vem de graça');
}
// ---------- a14: o primeiro pack ----------
{
  const j = novo('a14', etapa('a14', (E) => E.ev === 'pack_fez'));
  s.kitEtapa(j);
  ok(contar(j.prog.mochila, 'lenha') >= 20, 'primeiro pack: o Seu Joca dá a lenha');
}
// ---------- coisa grande nunca vem: junta ----------
{
  const j = novo('a16', etapa('a16', (E) => E.ev === 'criar' && E.k === 'barquinho')), p = j.prog;
  ok(!s.kitEtapa(j) && contar(p.mochila, 'barquinho') === 0 && contar(p.mochila, 'lenha') === 0, 'barquinho: nada de graça');
  let hi = s.histInfo(j);
  // sem machado (André 2026-11-13: guiar cada passo): primeiro o machado, com galho e pedrinha do chão
  ok(/^Machado de pedra: pegue do chão Lenha 0\/3/.test(hi.txt) && hi.ev === 'item' && hi.de === 'solto', `sem machado: o machado antes, galho do chão (${hi.txt})`);
  guardar(p.mochila, { k: 'lenha', n: 3 }); guardar(p.mochila, { k: 'pedra', n: 2 });
  hi = s.histInfo(j);
  ok(/crie Machado de pedra$/.test(hi.txt) && hi.ev === 'criar' && hi.k === 'machado' && !hi.alvo, `com o material: crie o machado aqui mesmo (${hi.txt})`);
  p.mochila.fill(null);
  guardar(p.mochila, { k: 'machado' });
  hi = s.histInfo(j);
  ok(/^Barquinho: corte Lenha 0\/30/.test(hi.txt) && hi.ev === 'item' && hi.de === 'coleta' && hi.k === 'lenha' && hi.alvo, `com machado: "${hi.txt}", Ir na árvore`);
  guardar(p.mochila, { k: 'lenha', n: 30 });
  hi = s.histInfo(j);
  ok(/^Barquinho: cace para ter Couro 0\/4/.test(hi.txt) && hi.ev === 'matar' && hi.alvo, `lenha pronta: "${hi.txt}" (Ir no campo de caça)`);
  guardar(p.mochila, { k: 'couro', n: 4 });
  hi = s.histInfo(j);
  ok(hi.txt.startsWith('Crie o barquinho') && hi.ev === 'criar' && hi.k === 'barquinho', 'tudo junto: volta o "Crie o barquinho"');
}
{
  const j = novo('b5', etapa('b5', (E) => E.ev === 'criar' && E.k === 'carrinho')), p = j.prog;
  guardar(p.mochila, { k: 'machado' }); guardar(p.mochila, { k: 'picareta' }); dar(p, 'lenha', 60);
  ok(!s.kitEtapa(j), 'carrinho: nada de graça');
  let hi = s.histInfo(j);
  ok(/minere Minério de ferro 0\/18/.test(hi.txt) && hi.k === 'minerio_ferro', `barra de ferro: primeiro o minério (${hi.txt})`);
  dar(p, 'minerio_ferro', 18);
  hi = s.histInfo(j);
  ok(/funda no forninho Barra de ferro 0\/6/.test(hi.txt) && hi.ev === 'criar' && hi.k === 'barra_ferro' && hi.alvo?.estacao, `com o minério: forninho (${hi.txt})`);
}
{
  const j = novo('c15', etapa('c15', (E) => E.ev === 'criar' && E.k === 'navio')), p = j.prog;
  ok(!s.kitEtapa(j) && contar(p.mochila, 'navio') === 0, 'navio: nunca vem de graça');
  ok(/^(Navio mercante|Machado de pedra|Picareta de pedra): /.test(s.histInfo(j).txt), `navio: diz o que falta (${s.histInfo(j).txt})`);
}
// ---------- c2: retirar no leilão sem esperar 24 h ----------
{
  const j = novo('c2', etapa('c2', (E) => E.ev === 'leilao' && E.de === 'retirar'));
  s.kitEtapa(j);
  const o = npc('v_otavio'); Object.assign(j, { x: o.x + 1, z: o.z });
  s.leilaoMsg(j.id, { acao: 'retirar' });
  ok(j.prog.ouro === 20 && j.prog.hist.e > etapa('c2', (E) => E.ev === 'leilao' && E.de === 'retirar'), 'leilão: o Otávio deixa 20 na caixa e o retirar já funciona');
}
// ---------- h14: o Catalisador da Memória (só existe um) ----------
{
  const j = novo('h14', etapa('h14', (E) => E.ev === 'ter'));
  s.kitEtapa(j);
  ok(contar(j.prog.mochila, 'catalisador_memoria') === 1, 'vendeu o Catalisador da Memória: ganha de novo (sem ele a história parava)');
}
// ---------- nenhuma etapa com kit fora do comecinho, a não ser as de item único ----------
const kits = HISTORIA.flatMap((M) => etapasDe(M).filter((E) => E.kit).map((E) => `${M.id}:${E.ev}`));
ok(kits.every((k) => /^a\d+:/.test(k) || ['c2:leilao', 'h14:ter'].includes(k)), 'kit só nas missões do comecinho (e o leilão e o catalisador único): ' + kits.join(' '));

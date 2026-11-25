// Mover por quantidade igual em todo lugar (André 2026-11-25): na venda, no Baú do Clã/baú e na troca o número pode ser
// menor, igual ou MAIOR que a pilha; maior puxa das pilhas iguais. lista = várias pilhas inteiras (botões de tipo).
// Uso: node ferramentas/testes/quantidade-pilhas.mjs
import { Simulacao, MAPA_CLAREIRA, contar, pilhasIguais, moverQtd } from '../../shared/index.js';
import './_tudo-aberto.mjs';
import './_relogio-fixo.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const ev = (s) => { const e = s.eventos; s.eventos = []; return e; };
const pil = (k) => ({ k, n: 20 });

// funções puras
{
  const de = [pil('carne'), { k: 'lenha', n: 5 }, pil('carne'), { k: 'carne', n: 7, cad: 1 }, { k: 'carne', n: 3 }];
  ok(pilhasIguais(de, 0).join() === '0,2,4', 'pilhasIguais: mesma carne sem cadeado');
  const r = moverQtd(de, Array(10).fill(null), 0, 30);
  ok(r.n === 30 && contar(r.para, 'carne') === 30 && contar(r.de, 'carne') === 20 && de[0].n === 20, 'moverQtd: 30 de pilhas de 20 (sem mexer na original)');
  const r2 = moverQtd(de, Array(10).fill(null), 4, 999);
  ok(r2.n === 43 && !r2.de[0] && !r2.de[2] && !r2.de[4] && r2.de[3].n === 7, 'moverQtd: maior que tudo leva todas as pilhas iguais, cadeado fica');
  const cheio = [{ k: 'pedra', n: 1 }, { k: 'carne', n: 45 }];
  const r3 = moverQtd(de, cheio, 0, 40);
  ok(r3.n === 5 && r3.de[0].n === 15 && r3.de[2].n === 20, 'moverQtd: destino cheio para no que coube');
}

// venda
{
  const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('V', 'Vera');
  j.criando = false; s.pertoDeQuemCompra = () => true;
  const M = j.prog.mochila;
  M[0] = pil('carne'); M[1] = pil('carne'); M[2] = { k: 'lenha', n: 9 }; M[3] = pil('carne');
  const o0 = j.prog.ouro;
  s.item('V', { acao: 'vender', i: 0 });
  ok(contar(M, 'carne') === 59 && j.prog.ouro > o0, 'vender sem n: vende 1 (como antes)');
  const o1 = j.prog.ouro;
  s.item('V', { acao: 'vender', i: 1, n: 45 }); ev(s);
  ok(contar(M, 'carne') === 14 && M[2].n === 9 && j.prog.ouro > o1, 'vender 45: puxa das outras pilhas de carne, lenha fica');
  s.item('V', { acao: 'vender', i: M.findIndex((o) => o && o.k === 'carne'), n: 999 });
  ok(contar(M, 'carne') === 0 && M[2].n === 9, 'vender mais do que tem: vende toda a carne');
}

// baú particular e Baú do Clã pelo mesmo caminho (moverQtd)
{
  const s = new Simulacao(MAPA_CLAREIRA), a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
  a.criando = false; a.x = -19; a.z = 60; a.prog.ouro = 5000;
  s.comprarLote('A', { x0: -28, z0: 55, x1: -20, z1: 63 }); ev(s);
  a.prog.mochila[10] = { k: 'obra_bau', n: 1 };
  s.construir('A', { k: 'bau', x: -25, z: 58.5, r: 0 }); ev(s);
  a.x = -23.6; a.z = 58.5;
  const L = s.loteDe(a);
  a.prog.mochila.fill(null);
  for (let x = 0; x < 5; x++) a.prog.mochila[x] = pil('carne');
  a.prog.mochila[5] = { k: 'lenha', n: 9 }; a.prog.mochila[6] = { k: 'espada', r: 1 };
  s.bau('A', { acao: 'guardar', i: 0, n: 70 }); ev(s);
  ok(contar(L.bau, 'carne') === 70 && contar(a.prog.mochila, 'carne') === 30, 'baú: guardar 70 puxa de 4 pilhas');
  const iB = L.bau.findIndex((o) => o && o.k === 'carne');
  s.bau('A', { acao: 'tirar', i: iB, n: 50 }); ev(s);
  ok(contar(L.bau, 'carne') === 20 && contar(a.prog.mochila, 'carne') === 80, 'baú: tirar 50 puxa de 3 pilhas');
  s.bau('A', { acao: 'guardar', lista: [5, 6] }); ev(s);
  ok(contar(L.bau, 'lenha') === 9 && L.bau.some((o) => o && o.k === 'espada') && !a.prog.mochila[5] && !a.prog.mochila[6], 'baú: lista guarda as pilhas inteiras');
  const li = L.bau.map((o, x) => (o ? x : -1)).filter((x) => x >= 0);
  s.bau('A', { acao: 'tirar', lista: li }); ev(s);
  ok(L.bau.every((o) => !o) && contar(a.prog.mochila, 'carne') === 100, 'baú: lista tira tudo');
}

// troca
{
  const s = new Simulacao(MAPA_CLAREIRA);
  const a = s.adicionarJogador('A', 'Ana'), b = s.adicionarJogador('B', 'Bia');
  for (const j of [a, b]) { j.criando = false; j.x = 0; j.z = 0; }
  b.x = 1;
  a.prog.mochila[0] = pil('carne'); a.prog.mochila[1] = pil('carne'); a.prog.mochila[2] = { k: 'lenha', n: 9 };
  s.troca('A', { acao: 'pedir', com: 'B' }); s.troca('B', { acao: 'aceitar', com: 'A' }); ev(s);
  s.troca('A', { acao: 'por', i: 0, n: 30 }); ev(s);
  const of = a.troca?.of.A.itens || [];
  ok(of.length === 2 && of.reduce((t, e) => t + e.n, 0) === 30, 'troca: pôr 30 usa as duas pilhas de carne');
  s.troca('A', { acao: 'por', lista: [2] }); ev(s);
  ok(a.troca.of.A.itens.some((e) => e.i === 2 && e.n === 9), 'troca: lista põe a pilha inteira');
}

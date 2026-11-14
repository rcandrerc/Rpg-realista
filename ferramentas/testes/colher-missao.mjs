// Provisões travada (André 2026-11-14: "to nessa missão de sopa há 5 horas"): a horta da missão fica pronta ao plantar,
// ele colheu já na etapa de regar e a etapa "Colha o que plantou 0/6" nunca andava (não sobrava planta). Agora o que
// colheu antes conta, e terreno sem planta fecha a etapa. E os botões de teste de missão (só a conta do André).
// Uso: node ferramentas/testes/colher-missao.mjs
import { Simulacao, MAPA_CLAREIRA, HISTORIA, contar } from '../../shared/index.js';
import { etapasDe, histValida } from '../../shared/historia.js';
import { CONTA_TESTE } from '../../shared/dados.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const ev = () => { const e = s.eventos; s.eventos = []; return e; };
const idx = (id) => HISTORIA.findIndex((o) => o.id === id);
const L2 = etapasDe(HISTORIA[idx('b2')]);
const eP = L2.findIndex((E) => E.ev === 'plantar'), eC = L2.findIndex((E) => E.ev === 'colher'), eS = L2.findIndex((E) => E.ev === 'criar' && E.k === 'sopa_legumes');

function novo(id, conta, z) {
  const a = s.adicionarJogador(id, 'Ana' + id, undefined, { conta });
  a.criando = false; a.x = -24; a.z = z; a.prog.ouro = 5000;
  s.comprarLote(id, { x0: -28, z0: z - 4, x1: -20, z1: z + 4 }); ev();
  const p = a.prog; p.mochila.fill(null);
  p.mochila[0] = { k: 'enxada', n: 1 }; p.mochila[1] = { k: 'regador', n: 1 };
  p.mochila[2] = { k: 'semente_cenoura', n: 2 }; p.mochila[3] = { k: 'semente_batata', n: 2 }; p.mochila[4] = { k: 'semente_rabanete', n: 2 };
  p.hist = { v: 2, p: idx('b2'), ac: true, e: eP, n: 0, m: 0, u: HISTORIA[idx('b2') - 1].id };
  return a;
}
const V = (a) => { a.prog.vigor = { v: 999, t: Date.now() }; };
const cels = (z) => { const c = []; for (let i = -27; i <= -22; i++) c.push(i + ',' + (z - 3)); return c; };

// 1) colheu na etapa de regar: a etapa "Colha" começa com as 6 e passa direto para a sopa
{
  const a = novo('A', 1, 59), cel = cels(59);
  for (const c of cel) { V(a); s.horta('A', { acao: 'arar', c }); }
  ['cenoura', 'batata', 'rabanete', 'cenoura', 'batata', 'rabanete'].forEach((k, i) => { V(a); s.horta('A', { acao: 'plantar', c: cel[i], s: k }); });
  for (const c of cel) { V(a); s.horta('A', { acao: 'colher', c }); }
  ok(a.prog.hist.e === eP + 1 && a.prog.hist.cc === 6, 'colheu cedo (na etapa de regar): guardou 6 ' + JSON.stringify(a.prog.hist));
  ok(histValida(JSON.parse(JSON.stringify(a.prog.hist)), a.prog.nivel).cc === 6, 'cc fica guardado ao salvar');
  for (const c of cel.slice(0, 3)) { V(a); s.horta('A', { acao: 'regar', c }); }
  ok(a.prog.hist.e === eS, 'depois de regar: pulou "Colha" (já colheu) e está na sopa ' + s.textoEtapa(a));
  s.estacaoPerto = () => ({});
  for (let i = 0; i < 3; i++) { V(a); s.criarUm('A', { r: 'sopa_legumes' }); }
  ok(contar(a.prog.mochila, 'sopa_legumes') === 3 && a.prog.hist.e === eS + 1, '3 sopas: a missão anda');
  delete s.estacaoPerto;
}
// 2) conta que já travou (etapa "Colha 0/6", terreno sem planta): destrava sozinha
{
  const a = novo('B', 2, 72); ev();
  a.prog.hist.e = eC; a.prog.hist.n = 0;
  s.passoHistoria(1);
  ok(a.prog.hist.e === eC + 1, 'travada em "Colha 0/6" sem planta no terreno: passa para a sopa');
}
// 3) caminho normal continua igual: com planta no terreno, "Colha" espera colher
{
  const a = novo('C', 3, 85), cel = cels(85);
  for (const c of cel) { V(a); s.horta('C', { acao: 'arar', c }); }
  ['cenoura', 'batata', 'rabanete', 'cenoura', 'batata', 'rabanete'].forEach((k, i) => { V(a); s.horta('C', { acao: 'plantar', c: cel[i], s: k }); });
  for (const c of cel.slice(0, 3)) { V(a); s.horta('C', { acao: 'regar', c }); }
  s.passoHistoria(1);
  ok(a.prog.hist.e === eC && a.prog.hist.n === 0, 'normal: na etapa "Colha 0/6" com as plantas lá');
  for (const c of cel) { V(a); s.horta('C', { acao: 'colher', c }); }
  ok(a.prog.hist.e === eS, 'colheu as 6: vai para a sopa');
}
// 4) botões de teste: só a conta do André (testador), e só com CONTA_TESTE.missoes
{
  const outro = s.jogadores.get('A'); const h0 = JSON.stringify(outro.prog.hist);
  s.missaoTeste('A', 'zerar');
  ok(JSON.stringify(outro.prog.hist) === h0, 'conta comum: o servidor recusa');
  const t = s.adicionarJogador('T', 'Andre', undefined, { conta: 9, testador: true }); t.criando = false; ev();
  t.prog.hist = { v: 2, p: idx('b2'), ac: true, e: eC, n: 2, m: 0, u: HISTORIA[idx('b2') - 1].id };
  s.avisarProg(t);
  ok(ev().some((e) => e.t === 'prog' && e.testeMissoes === true), 'conta do André: o app recebe testeMissoes');
  s.missaoTeste('T', 'voltar');
  ok(t.prog.hist.p === idx('b2') && !t.prog.hist.ac && t.prog.hist.e === 0, 'Voltar 1 missão (no meio dela): recomeça a da vez');
  s.missaoTeste('T', 'voltar');
  ok(t.prog.hist.p === idx('b2') - 1 && !t.prog.hist.ac && t.prog.hist.u === HISTORIA[idx('b2') - 2].id, 'Voltar de novo: a de antes');
  ok(histValida(JSON.parse(JSON.stringify(t.prog.hist)), t.prog.nivel).p === idx('b2') - 1, 'fica salvo assim');
  s.missaoTeste('T', 'zerar');
  ok(t.prog.hist.p === 0 && !t.prog.hist.ac, 'Zerar missões: do começo');
  CONTA_TESTE.missoes = false; t.prog.hist.p = 5;
  s.missaoTeste('T', 'zerar');
  ok(t.prog.hist.p === 5, 'CONTA_TESTE.missoes = false: desligado');
  ev(); s.avisarProg(t); ok(!ev().some((e) => e.t === 'prog' && e.testeMissoes), 'desligado: o app não mostra');
  CONTA_TESTE.missoes = true;
}
// 5) Barra de aço (foto do André 2026-11-14): lenha no Material, carvão no combustível e pronto, barra de ferro na
// mochila. O guia mandava "Barra de aço: corte Lenha 0/4"; agora conta o que está na fornalha.
{
  const a = novo('F', 5, 98), p = a.prog, L = s.loteDe(a);
  const eA = L2.findIndex((E) => E.ev === 'criar' && E.k === 'barra_aco');
  p.hist.e = eA; p.hist.n = 0; p.mochila.fill(null);
  p.mochila[0] = { k: 'barra_ferro', n: 3 }; p.mochila[1] = { k: 'minerio_cobre', n: 4 };
  L.pecas.push({ id: 'fx', k: 'fornalha', x: -24, z: 96, r: 0 });
  L.fornos = { fx: { comb: { k: 'carvao', n: 6 }, ent: { k: 'lenha', n: 17 }, sai: { k: 'carvao', n: 2 }, fogo: 10, fogoK: 'carvao', prog: 0 } };
  const t = s.textoEtapa(a);
  ok(!/Lenha/.test(t), 'carvão na fornalha conta: o texto não manda cortar lenha (' + t + ')');
  L.fornos.fx = { comb: null, ent: { k: 'lenha', n: 17 }, sai: null, fogo: 0, prog: 0 };
  const t2 = s.textoEtapa(a);
  ok(!/corte Lenha/.test(t2), 'lenha no Material conta para o carvão (' + t2 + ')');
}
// 6) Sopa: enquanto junta, o texto mantém o andamento (não parece que voltou para o rabanete)
{
  const a = novo('G', 6, 111), p = a.prog;
  p.hist.e = eS; p.hist.n = 1; p.mochila.fill(null);
  p.mochila[0] = { k: 'cenoura', n: 2 }; p.mochila[1] = { k: 'batata', n: 2 }; p.mochila[2] = { k: 'rabanete', n: 1 }; p.mochila[3] = { k: 'enxada', n: 1 }; p.mochila[4] = { k: 'regador', n: 1 }; p.mochila[5] = { k: 'semente_rabanete', n: 1 };
  const t = s.textoEtapa(a);
  ok(/^Sopa de legumes \(1\/3\): /.test(t), 'falta rabanete: "' + t + '"');
}

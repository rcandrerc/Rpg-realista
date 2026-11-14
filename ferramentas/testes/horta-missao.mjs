// Horta da missão (André 2026-11-14: "coleta instantânea somente a qtd suficiente pra fazer a missão pra o cara não
// ficar esperando um dia"). Planta de legume que a missão usa fica pronta ao plantar, só até a cota da missão; o resto,
// a horta fora da missão e o replantio depois de vender crescem no tempo normal. Uso: node ferramentas/testes/horta-missao.mjs
import { Simulacao, MAPA_CLAREIRA, HISTORIA, PLANTAS, contar } from '../../shared/index.js';
import { plantasDaMissao } from '../../shared/kit.js';
import { etapasDe, histValida } from '../../shared/historia.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const ev = () => { const e = s.eventos; s.eventos = []; return e; };
const M = (id) => HISTORIA.find((o) => o.id === id), idx = (id) => HISTORIA.findIndex((o) => o.id === id);

// cotas das missões que plantam
const b2 = plantasDaMissao(M('b2')), c3 = plantasDaMissao(M('c3'));
ok(b2['*'] === 6 && b2.cenoura === 2 && b2.batata === 1 && b2.rabanete === 2, 'Provisões: 6 sementes + o da sopa (sem contar a sopa entregue duas vezes) ' + JSON.stringify(b2));
ok(c3.abobora >= 4 && c3.milho >= 5 && c3.rabanete >= 6, 'Doce para o norte: abóbora, milho e rabanete do pack ' + JSON.stringify(c3));
ok(Object.keys(plantasDaMissao(M('a1'))).length === 0, 'missão sem horta: cota zero');

const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.x = -24; a.z = 59; a.prog.ouro = 5000;
s.comprarLote('A', { x0: -28, z0: 55, x1: -20, z1: 63 }); ev();
const p = a.prog, L = s.loteDe(a);
p.mochila.fill(null);
p.mochila[0] = { k: 'enxada', n: 1 }; p.mochila[1] = { k: 'regador', n: 1 };
p.mochila[2] = { k: 'semente_cenoura', n: 20 }; p.mochila[3] = { k: 'semente_batata', n: 20 }; p.mochila[4] = { k: 'semente_rabanete', n: 20 }; p.mochila[5] = { k: 'semente_tomate', n: 5 };
p.vigor = { v: 999, t: Date.now() };
const cel = [];
for (let i = -27; i <= -22; i++) for (let k = 56; k <= 58; k++) cel.push(i + ',' + k);
const arar = (c) => { p.vigor = { v: 999, t: Date.now() }; s.horta('A', { acao: 'arar', c }); };
const plantar = (c, sm) => { p.vigor = { v: 999, t: Date.now() }; s.horta('A', { acao: 'plantar', c, s: sm }); };
const colher = (c) => { p.vigor = { v: 999, t: Date.now() }; s.horta('A', { acao: 'colher', c }); };
const pronta = (c) => { const t = L.horta[c]; return !!t?.c && t.g >= PLANTAS[t.c].G; };
for (const c of cel) arar(c);
ok(Object.keys(L.horta).length === cel.length, 'arou ' + cel.length + ' quadrados');

// fora de missão: cresce no tempo normal
p.hist = { v: 2, p: idx('b2') + 1, ac: false, e: 0, n: 0, m: 0 };
plantar(cel[0], 'tomate'); ev();
ok(L.horta[cel[0]].c === 'tomate' && !pronta(cel[0]), 'sem missão aceita: horta normal, cresce no tempo');

// Provisões, etapa "Plante 6 sementes": as 6 ficam prontas na hora, a 7ª da etapa não
const eP = etapasDe(M('b2')).findIndex((E) => E.ev === 'plantar');
p.hist = { v: 2, p: idx('b2'), ac: true, e: eP, n: 0, m: 0, u: HISTORIA[idx('b2') - 1].id };
const seis = cel.slice(1, 7);
seis.forEach((c, i) => plantar(c, ['cenoura', 'batata', 'rabanete'][i % 3]));
let e = ev();
ok(seis.every(pronta), 'as 6 sementes da missão ficaram prontas na hora');
ok(e.some((x) => x.t === 'aviso' && x.texto === 'Missão: pronta pra colher!'), 'aviso curto');
ok(p.hist.e === eP + 1, 'a etapa plantar contou as 6');
// regar ainda ensina (planta pronta aceita água) e colher conta
p.hist.hz && ok(p.hist.hz.u['*'] === 6, 'cota "*" gasta: 6');
// a cota da sopa (2 de cada) ainda acelera as próximas da sopa
plantar(cel[7], 'cenoura'); plantar(cel[8], 'cenoura'); plantar(cel[9], 'cenoura'); ev();
ok(pronta(cel[7]) && pronta(cel[8]) && !pronta(cel[9]), 'cenoura da sopa: 2 prontas (cota), a 3ª cresce normal');
// colhe e replanta: a cota não volta
const antes = contar(p.mochila, 'cenoura');
colher(cel[7]); ev();
ok(contar(p.mochila, 'cenoura') > antes, 'colheu a cenoura pronta');
plantar(cel[7], 'cenoura'); ev();
ok(!pronta(cel[7]), 'replantar depois de colher: cota não volta, cresce normal');
// tomate não é da missão
plantar(cel[10], 'tomate'); ev();
ok(!pronta(cel[10]), 'legume que a missão não usa: cresce normal');
// a cota fica guardada na conta (histValida), só para a mesma missão
const hv = histValida(JSON.parse(JSON.stringify(p.hist)), p.nivel);
ok(hv.hz?.m === 'b2' && hv.hz.u.cenoura === 2, 'cota guardada ao salvar ' + JSON.stringify(hv.hz));
ok(!histValida({ ...p.hist, hz: { m: 'c3', u: { cenoura: 2 } } }, p.nivel).hz, 'cota de outra missão não vale');
// depois da sopa (entrega ao Gaspar): nada da horta acelera
p.hist.e = etapasDe(M('b2')).findIndex((E) => E.ev === 'falar'); delete p.hist.hz;
plantar(cel[11], 'batata'); ev();
ok(!pronta(cel[11]), 'etapa que não usa mais legume: cresce normal');

// planta de antes, crescendo, fica pronta quando a missão que usa começa (dentro da cota)
const j2 = s.adicionarJogador('B', 'Bia', undefined, { conta: 2 }); ev();
j2.criando = false; j2.x = -24; j2.z = 72; j2.prog.ouro = 5000;
s.comprarLote('B', { x0: -28, z0: 68, x1: -20, z1: 76 }); ev();
const L2 = s.loteDe(j2), p2 = j2.prog;
if (L2) {
  p2.mochila.fill(null); p2.mochila[0] = { k: 'enxada', n: 1 }; p2.mochila[1] = { k: 'semente_milho', n: 9 };
  p2.hist = { v: 2, p: idx('c3') + 1, ac: false, e: 0, n: 0, m: 0 };
  for (const c of ['-27,70', '-26,70']) { p2.vigor = { v: 999, t: Date.now() }; s.horta('B', { acao: 'arar', c }); p2.vigor = { v: 999, t: Date.now() }; s.horta('B', { acao: 'plantar', c, s: 'milho' }); }
  ok(!L2.horta['-27,70'].g, 'milho plantado antes da missão: crescendo');
  p2.hist = { v: 2, p: idx('c3'), ac: true, e: etapasDe(M('c3')).findIndex((E) => E.ev === 'criar'), n: 0, m: 0 };
  s.hortaMissao(j2); ev();
  ok(L2.horta['-27,70'].g >= PLANTAS.milho.G && L2.horta['-26,70'].g >= PLANTAS.milho.G, 'o milho de antes ficou pronto quando a etapa do pão começou');
} else ok(false, 'segundo lote');

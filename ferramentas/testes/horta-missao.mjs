// Horta da missão (André 2026-11-14: "coleta instantânea somente a qtd suficiente pra fazer a missão pra o cara não
// ficar esperando um dia"). Planta de legume que a missão usa fica pronta ao plantar, só até a cota da missão; o resto,
// a horta fora da missão e o replantio depois de vender crescem no tempo normal. Uso: node ferramentas/testes/horta-missao.mjs
import { Simulacao, MAPA_CLAREIRA, HISTORIA, PLANTAS, HORTA, contar } from '../../shared/index.js';
import { plantasDaMissao } from '../../shared/kit.js';
import { etapasDe, histValida } from '../../shared/historia.js';
import './_tudo-aberto.mjs';
import { passarMissao } from './_horta-rapida.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const ev = () => { const e = s.eventos; s.eventos = []; return e; };
const M = (id) => HISTORIA.find((o) => o.id === id), idx = (id) => HISTORIA.findIndex((o) => o.id === id);

// cotas das missões que plantam
const b2 = plantasDaMissao(M('b2')), c3 = plantasDaMissao(M('c3'));
ok(b2['*'] === 6 && b2.cenoura === 2 && b2.batata === 1 && b2.rabanete === 2, 'Provisões: 6 sementes + o da sopa (sem contar a sopa entregue duas vezes) ' + JSON.stringify(b2));
ok(c3.abobora >= 4 && c3.milho >= 4 && c3.rabanete >= 6, 'Doce para o norte: abóbora, milho e rabanete do pack ' + JSON.stringify(c3));
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
const pronta = (c) => { passarMissao(s); const t = L.horta[c]; return !!t?.c && t.g >= PLANTAS[t.c].G; };
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
ok(e.some((x) => x.t === 'aviso' && /^Missão: pronta em \d+ s$/.test(x.texto)), 'aviso curto');
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
  s.hortaMissao(j2); ev(); passarMissao(s);
  ok(L2.horta['-27,70'].g >= PLANTAS.milho.G && L2.horta['-26,70'].g >= PLANTAS.milho.G, 'o milho de antes ficou pronto quando a etapa do pão começou');
} else ok(false, 'segundo lote');

// André 2026-11-17 (c3 depois de "Voltar 1 missão"): abóboras velhas crescendo gastaram a cota ao aceitar; plantou 2,
// comprou mais 2 e ficou "Abóbora crescendo 2/4". Agora: toda planta que a missão ainda precisa cresce pela missão, em
// HORTA.missaoSeg segundos (não na hora: a barrinha anda), e nunca passa do que falta.
{
  const j3 = s.adicionarJogador('C', 'Caio', undefined, { conta: 3 }); ev();
  j3.criando = false; j3.x = -24; j3.z = 85; j3.prog.ouro = 5000;
  s.comprarLote('C', { x0: -28, z0: 81, x1: -20, z1: 89 }); ev();
  const L3 = s.loteDe(j3), p3 = j3.prog;
  if (L3) {
    p3.mochila.fill(null); p3.mochila[0] = { k: 'enxada', n: 1 }; p3.mochila[1] = { k: 'semente_abobora', n: 20 };
    const cs = []; for (let i = -27; i <= -22; i++) cs.push(i + ',83');
    const V3 = () => { p3.vigor = { v: 999, t: Date.now() }; };
    for (const c of cs) { V3(); s.horta('C', { acao: 'arar', c }); }
    const pl = (c) => { V3(); s.horta('C', { acao: 'plantar', c, s: 'abobora' }); };
    pl(cs[0]); pl(cs[1]); // as velhas, antes de aceitar: crescem normal
    p3.hist = { v: 2, p: idx('c3'), ac: true, e: 0, n: 0, m: 0 };
    s.hortaMissao(j3); ev(); // aceitou: as velhas viram da missão (gastam a cota)
    pl(cs[2]); pl(cs[3]); pl(cs[4]); pl(cs[5]);
    const t2 = L3.horta[cs[2]];
    ok(t2.mf && t2.g < PLANTAS.abobora.G, 'planta da missão não fica pronta na hora: cresce em segundos');
    ok(t2.mf - t2.mi === HORTA.missaoSeg * 1000 && HORTA.missaoSeg >= 5 && HORTA.missaoSeg <= 10, `cresce em ${HORTA.missaoSeg} s`);
    passarMissao(s);
    const prontas = cs.filter((c) => L3.horta[c].g >= PLANTAS.abobora.G).length;
    ok(prontas === 6, `as 4 plantadas depois da cota também ficam prontas (plante 4 + as 2 velhas): ${prontas}/6`);
    V3(); s.horta('C', { acao: 'arar', c: '-21,83' }); pl('-21,83'); passarMissao(s);
    ok(!(L3.horta['-21,83'].g >= PLANTAS.abobora.G), 'a 7ª abóbora (a missão já tem as que precisa) cresce no tempo normal');
  } else ok(false, 'terceiro lote');
}

// André 2026-11-17 (milho da c3): passados os segundos, o servidor manda o lote com a planta pronta (sem esperar outra mexida)
{
  const j4 = s.adicionarJogador('D', 'Duda', undefined, { conta: 4 }); ev();
  j4.criando = false; j4.x = -24; j4.z = 98; j4.prog.ouro = 5000;
  s.comprarLote('D', { x0: -28, z0: 94, x1: -20, z1: 102 }); ev();
  const L4 = s.loteDe(j4), p4 = j4.prog;
  if (L4) {
    p4.mochila.fill(null); p4.mochila[0] = { k: 'enxada', n: 1 }; p4.mochila[1] = { k: 'semente_milho', n: 4 };
    p4.hist = { v: 2, p: idx('c3'), ac: true, e: 1, n: 0, m: 0, hz: { m: 'c3', u: { abobora: 4 } } };
    p4.vigor = { v: 999, t: Date.now() }; s.horta('D', { acao: 'arar', c: '-27,96' });
    p4.vigor = { v: 999, t: Date.now() }; s.horta('D', { acao: 'plantar', c: '-27,96', s: 'milho' }); ev();
    const t = L4.horta['-27,96'];
    ok(t.mf > 0, 'milho da etapa "Plante 4 sementes de milho" cresce pela missão');
    t.mi -= 9000; t.mf -= 9000; // os 8 s passaram
    const vistos = []; for (let k = 0; k < 30; k++) vistos.push(...(s.passo(0.05) || []));
    const e = [...vistos, ...ev()].filter((x) => x.t === 'lote' && x.lote === L4.def.id);
    const h = e.at(-1)?.horta?.find((o) => o[0] === '-27,96');
    ok(h && h[2] >= PLANTAS.milho.G && !t.mf, `passados os segundos, o lote vai pronto para o celular (${JSON.stringify(h)})`);
  } else ok(false, 'quarto lote');
}

// André 2026-11-17 ("milho continua em 25%"): levar o pack sem pack, refazendo: o milho do pão de milho do pack também
// cresce pela missão (antes só o legume que o pack pede direto, a abóbora)
{
  const j5 = s.adicionarJogador('E', 'Edu', undefined, { conta: 5 }); ev();
  j5.criando = false; j5.x = -24; j5.z = 111; j5.prog.ouro = 5000;
  s.comprarLote('E', { x0: -28, z0: 107, x1: -20, z1: 115 }); ev();
  const L5 = s.loteDe(j5), p5 = j5.prog;
  if (L5) {
    p5.mochila.fill(null); p5.mochila[0] = { k: 'enxada', n: 1 }; p5.mochila[1] = { k: 'semente_milho', n: 6 };
    p5.hist = { v: 2, p: idx('c3'), ac: true, e: etapasDe(M('c3')).findIndex((E) => E.ev === 'pack'), n: 0, m: 0, hz: { m: 'c3', u: { abobora: 4, milho: 4, rabanete: 6 } } };
    const cs = ['-27,109', '-26,109', '-25,109', '-24,109', '-23,109', '-22,109'];
    for (const c of cs) { p5.vigor = { v: 999, t: Date.now() }; s.horta('E', { acao: 'arar', c }); p5.vigor = { v: 999, t: Date.now() }; s.horta('E', { acao: 'plantar', c, s: 'milho' }); }
    ev(); passarMissao(s);
    const prontas = cs.filter((c) => L5.horta[c].g >= PLANTAS.milho.G).length;
    // 2 packs refeitos: 4 pães de milho = 8 milhos = 4 pés (colheita mínima 2); o 5º e o 6º crescem normal
    ok(prontas === 4, `refazendo os packs: o milho dos pães cresce pela missão, só o que falta (${prontas}/6)`);
  } else ok(false, 'quinto lote');
}

// André 2026-11-17 (print, versão 2497): dez pés de milho em 0% e 45% e a etapa esperando "milho crescendo": o que o
// guia da etapa espera desse legume também cresce pela missão (qualquer etapa), até a quantidade que o guia pede
{
  const j6 = s.jogadores.get('E'), L6 = s.loteDe(j6), p6 = j6.prog;
  if (L6) {
    L6.horta = {}; p6.mochila.fill(null); p6.mochila[0] = { k: 'enxada', n: 1 }; p6.mochila[1] = { k: 'semente_milho', n: 6 }; p6.mochila[2] = { k: 'lenha', n: 10 };
    // etapa "Asse 2 Pães de milho" com a cota de milho já gasta (as plantas de antes)
    p6.hist = { v: 2, p: idx('c3'), ac: true, e: etapasDe(M('c3')).findIndex((E) => E.ev === 'criar'), n: 0, m: 0, hz: { m: 'c3', u: { abobora: 4, milho: 99, rabanete: 6 } } };
    const cs = ['-27,109', '-26,109', '-25,109', '-24,109', '-23,109', '-22,109'];
    for (const c of cs) { p6.vigor = { v: 999, t: Date.now() }; s.horta('E', { acao: 'arar', c }); p6.vigor = { v: 999, t: Date.now() }; s.horta('E', { acao: 'plantar', c, s: 'milho' }); }
    ev(); passarMissao(s);
    const prontas = cs.filter((c) => L6.horta[c].g >= PLANTAS.milho.G).length;
    ok(prontas >= 2 && prontas <= 4, `etapa do pão com a cota gasta: o milho que o guia espera cresce pela missão (${prontas}/6), o resto normal`);
  } else ok(false, 'lote do Edu');
}

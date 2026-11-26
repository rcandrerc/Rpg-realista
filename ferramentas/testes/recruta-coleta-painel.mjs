// Farmar recurso com o líder só no painel (André 2026-11-26: "todos estão zero mineração/hora"): o recruta vai ao veio DO
// RECURSO PEDIDO, leva ao Baú do Clã e, quando o vigor acaba e ele cai no Livre (caçando), volta à ordem quando o vigor
// volta. Peixe: só spot de lago e só com a pesca liberada na história. O painel mostra a quantidade exata (pt). Livre:
// membro de clã só gasta 20% do vigor (CLA.livreVigor).
// Uso: node ferramentas/testes/recruta-coleta-painel.mjs
import { Simulacao, MAPA_CLAREIRA, contar, CLA } from '../../shared/index.js';
import { sortearRecruta } from '../../shared/cla.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
let fake = Date.now(); const agoraReal = Date.now; Date.now = () => fake;

function montar(rec, aberto = true) {
  const s = new Simulacao(MAPA_CLAREIRA);
  const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 'c5' });
  a.criando = false; a.ciente = true; a.x = -24; a.z = 59; a.prog.ouro = 990000; a.prog.nivel = 60;
  s.comprarLote('A', { x0: -28, z0: 55, x1: -20, z1: 63 });
  const L = s.loteDe(a); a.prog.mochila.fill(null); a.prog.mochila[0] = { k: 'obra_bau_cla', n: 1 };
  s.cla('A', { acao: 'fundar', nome: 'Brasa' });
  s.construir('A', { k: 'bau_cla', x: -21.5, z: 61, r: 0 });
  const cla = a.prog.cla; cla.nv = 3; cla.sem = Date.now() + 9e9;
  const m = sortearRecruta(Math.random, CLA.tiers[0], 60, Date.now()); m.nv = 60; m.fn = { k: 'recurso', r: rec }; cla.m.push(m);
  s.removerJogador('A'); if (!s.loteDaConta('c5')) { s.lotes.set(L.def.id, L); L.dono = 'c5'; } // o terreno com o Baú fica
  s.paineis.set('PN', 'c5');
  s.entrarRecrutasSemLider([{ conta: 'c5', cla, raca: 'chama' }], 'PN');
  const x = s.recrutasNoMundo({ conta: 'c5' })[0], b = x.amiga;
  b.prog.prof = { ...b.prog.prof, min: 5000, len: 5000, pes: 5000 }; b.prog.vigor = { v: 60, m: 160, t: Date.now() };
  b.prog.mochila[3] = { k: 'vara', n: 1 }; b.prog.mochila[4] = { k: 'picareta', n: 1 }; b.prog.mochila[5] = { k: 'machado', n: 1 };
  if (aberto) b.prog.hist = { ...(b.prog.hist || {}), p: 99 };
  s.painelFuncao('c5', cla, 'chama', m.id, { k: 'recurso', r: rec });
  const rodar = (min) => { for (let i = 0; i < min * 240; i++) { s.passo(0.25); fake += 250; } };
  return { s, cla, L, x, b, m, rodar };
}

// ferro: minera o ferro (não pedra nem cobre), leva ao Baú e o painel conta
{
  const T = montar('ferro');
  T.rodar(25);
  const bau = contar(T.L.bauCla || [], 'minerio_ferro'), outro = contar(T.L.bauCla || [], 'pedra') + contar(T.L.bauCla || [], 'minerio_cobre');
  ok(bau > 50 && outro === 0, `ferro: ${bau} no Baú do Clã em 25 min (antes ia caçar), nada de pedra/cobre`);
  const pi = T.s.painelInfo('c5', T.cla, 'chama').m[0];
  ok(pi.pt?.i === 'minerio_ferro' && pi.pt.t > 30 && pi.ph?.n > 0, `painel: pegou ${pi.pt?.t} (~${pi.ph?.n}/h)`);
  // vigor acabou: Livre (caça); com o vigor de volta (10% do máximo) volta ao ferro
  T.b.prog.vigor = { v: 0, m: 160, t: Date.now() }; T.b.ia.av = { fase: 'escolher' };
  T.s.passoRecrutasSemLider();
  ok(T.b.ia.av?.fase === 'escolher', 'sem vigor: fica no Livre');
  T.b.prog.vigor = { v: 40, m: 160, t: Date.now() };
  T.s.passoRecrutasSemLider();
  ok(T.b.ia.av?.coleta === 'minerar' && T.b.ia.av.noTipo === 'ferro', 'vigor de volta: larga a caçada e volta ao veio de ferro');
}
// lenha e cristal também
for (const [rec, item] of [['lenha', 'lenha'], ['cristal', 'cristal']]) {
  const T = montar(rec);
  T.rodar(20);
  const n = contar(T.L.bauCla || [], item) + contar(T.b.prog.mochila, item);
  ok(n > 5, `${rec}: juntou ${n}`);
}
// peixe: spot de lago, pesca de verdade
{
  const T = montar('peixe');
  T.rodar(20);
  const n = (T.L.bauCla || []).concat(T.b.prog.mochila).reduce((s, o) => s + (o && ['lambari', 'tilapia', 'traira'].includes(o.k) ? o.n || 1 : 0), 0);
  ok(n > 5, `peixe: pescou ${n} no lago (antes rodava entre spots do mar)`);
}
// peixe sem a pesca liberada: diz o motivo em vez de rodar
{
  const T = montar('peixe', false);
  T.rodar(2);
  ok(!T.b.pesca && !(T.b.ia.av?.coleta === 'pescar'), 'pesca fechada: não fica indo de spot em spot');
  ok(/vara|Nico|pescaria/i.test(T.s.fazendoRecruta(T.b, { conta: 'c5' }) + JSON.stringify(T.b.ia.funcaoSt || '')), 'pesca fechada: diz o porquê');
}
// Livre: guarda 80% do vigor para o clã
{
  const T = montar('ferro');
  T.m.fn = undefined; T.s.painelFuncao('c5', T.cla, 'chama', T.m.id, { k: 'livre' });
  T.b.prog.vigor = { v: 100, m: 160, t: Date.now() };
  ok(T.x.vigorLivreAmiga(T.b) < 1, 'Livre com 100/160: não gasta (reserva 128)');
  T.b.prog.vigor = { v: 150, m: 160, t: Date.now() };
  ok(Math.abs(T.x.vigorLivreAmiga(T.b) - 22) < 0.5, 'Livre com 150/160: só 22 para gastar');
  T.b.ia.levar = { r: 'ferro', item: 'minerio_ferro', nome: 'x' };
  ok(T.x.vigorLivreAmiga(T.b) >= 149, 'com ordem: usa o vigor todo');
}

// rende (moral x comida): mais ou menos recurso por batida, mesmo vigor e mesma velocidade (André 2026-11-26)
{
  const medir = (mo) => { // a moral dá o rende (faixaMoral): 70 = 100%, 95 = 110%, 40 = 75%
    const T = montar('ferro'); T.m.mo = mo; T.m.mt = Date.now();
    T.rodar(12);
    const pi = T.s.painelInfo('c5', T.cla, 'chama').m[0];
    return { n: contar(T.L.bauCla || [], 'minerio_ferro') + contar(T.b.prog.mochila, 'minerio_ferro'), pi, v: T.b.prog.vigor };
  };
  const A = medir(70), B = medir(95), C = medir(40);
  ok(B.n > A.n && C.n < A.n, `rende muda a quantidade com o mesmo vigor: 75% ${C.n} · 100% ${A.n} · 110% ${B.n}`);
  ok(B.pi.pt?.x > 0 && C.pi.pt?.x < 0 && !A.pi.pt?.x, `painel: a mais/menos pela moral (110%: +${B.pi.pt?.x}, 75%: ${C.pi.pt?.x})`);
}
Date.now = agoraReal;

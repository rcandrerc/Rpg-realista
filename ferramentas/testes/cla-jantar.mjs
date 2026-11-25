// Jantar do clã (André 2026-11-25, shared/jantar.js): a Mesa do Clã na base (8 lugares, uma por clã, muda de lugar), o
// líder chama quem quer, os recrutas andam até a mesa e sentam, a comida vai para a mesa, servir, conversa em balões
// (mais de 5.000 falas), moral +35 com o líder perto, buff Banquete do clã para o líder que sentou, uma vez por dia, e o
// jantar do clã bot.
// Uso: node ferramentas/testes/cla-jantar.mjs
import { Simulacao, MAPA_CLAREIRA, JANTAR, contar, totalFalasJantar, calcularStatus } from '../../shared/index.js';
import { acharLugarBase } from '../../shared/base.js';
import { lugaresMesa, diaJantar } from '../../shared/jantar.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const ev = () => { const e = s.eventos; s.eventos = []; return e; };
const avisos = (l) => l.filter((e) => e.t === 'aviso').map((e) => e.texto).join(' | ');

ok(totalFalasJantar() > 5000, `mais de 5.000 falas diferentes (${totalFalasJantar()})`);
const LM = lugaresMesa({ x: 0, z: 0, ry: 0 });
ok(LM.length === 8 && LM.every((P, i) => LM.every((Q, k) => i === k || Math.hypot(P.x - Q.x, P.z - Q.z) > 1)), '8 lugares, sem um em cima do outro');
ok(Math.abs(LM[2].ry - Math.PI) < 0.01 && Math.abs(LM[5].ry) < 0.01 && Math.abs(LM[0].ry + Math.PI / 2) < 0.01, 'cada lugar virado para a mesa');

const a = s.adicionarJogador('A', 'André Teste', undefined, { conta: 1 });
a.criando = false; a.ciente = true; a.prog.ouro = 90000; a.prog.nivel = 40;
s.cla('A', { acao: 'fundar', nome: 'Jantar' });
const p = a.prog, c = p.cla;
const r = s.mapa.npcs.find((n) => n.funcao === 'recrutador');
c.nv = 4; a.x = r.x + 1; a.z = r.z;
for (let i = 0; i < 4; i++) s.cla('A', { acao: 'recrutar', tier: 'recruta' });
const pc = acharLugarBase(-6, 1, 'chama', []);
a.x = pc.x; a.z = pc.z;
s.cla('A', { acao: 'base' });
const B = s.baseDe(a);
ok(!!B, 'base fundada');
const M = s.mesaBase(B);
ok(M && Math.hypot(M.x - B.x, M.z - B.z) < B.nv * 4 + 7, 'a Mesa do Clã nasce na base, já no nível dela');
ok(s.terreno.solidos.some((o) => o.casa && Math.abs(o.x - M.x) < 0.01 && Math.abs(o.z - M.z) < 0.01 && o.hw === 1.8), 'o tampo é sólido');
ok(!s.dadosBase(B).pecas.some((o) => o.m === 'mesa'), 'a mesinha de antes virou a Mesa do Clã');
ev();

// chamar: só recrutas no mundo, até 7
const ctxs = s.recrutasNoMundo(a);
ok(ctxs.length === 4, `4 recrutas no mundo (${ctxs.length})`);
ctxs.forEach((x, i) => { x.amiga.x = M.x + 6 + i; x.amiga.z = M.z + 5; });
a.x = M.x + 3; a.z = M.z;
s.cla('A', { acao: 'jantar', sub: 'chamar', ids: [] });
ok(/Escolha quem vem/.test(avisos(ev())), 'sem ninguém escolhido: pede para escolher');
const ids = ctxs.slice(0, 3).map((x) => x.AMIGA.id);
s.cla('A', { acao: 'jantar', sub: 'chamar', ids });
let e = ev();
ok(/3 recrutas estão vindo/.test(avisos(e)) && e.some((o) => o.t === 'jantarInfo' && o.m.filter((m) => m.vem).length === 3), 'chamou 3 (o 4º fica no trabalho)');
ok(e.some((o) => o.t === 'jantar' && o.para === 'A' && o.fase === 'chamando'), 'o app sabe que tem jantar na mesa');
for (let i = 0; i < 400 && !ids.every((id) => ctxs.find((x) => x.AMIGA.id === id).amiga.mesaSent); i++) s.passo(0.1);
const sent = ids.filter((id) => ctxs.find((x) => x.AMIGA.id === id).amiga.mesaSent);
ok(sent.length === 3, `os 3 andaram até a mesa e sentaram (${sent.length})`);
const J = s.jantares.get(B.k);
const x0 = ctxs[0].amiga, P0 = J.lugares[J.conv.get(ids[0]).s];
ok(Math.hypot(x0.x - P0.x, x0.z - P0.z) < 0.01 && x0.anim === 'kk_sentado', 'sentado no lugar dele, na animação de sentar');
ok(!ctxs[3].amiga.mesaSent && !ctxs[3].amiga.ia.jantar, 'quem não foi chamado não vem');

// comida
p.mochila.fill(null);
p.mochila[0] = { k: 'peixe_assado', n: 2 }; p.mochila[1] = { k: 'pedra', n: 5 };
s.cla('A', { acao: 'jantar', sub: 'servir' });
ok(/Falta comida/.test(avisos(ev())), 'sem comida não serve');
s.cla('A', { acao: 'jantar', sub: 'comida', i: 1 });
ok(/só vai comida/.test(avisos(ev())), 'pedra não vai para a mesa');
s.cla('A', { acao: 'jantar', sub: 'comida', i: 0 });
e = ev();
ok(J.comida[0]?.k === 'peixe_assado' && J.comida[0].n === 2 && contar(p.mochila, 'peixe_assado') === 2, 'a comida vai para a mesa (reservada na mochila até servir)');
ok(e.some((o) => o.t === 'jantar' && o.comida.includes('peixe_assado')), 'a comida aparece na mesa para quem está no mundo');
s.cla('A', { acao: 'jantar', sub: 'servir' });
ok(/3 sentados e 2 pratos/.test(avisos(ev())), 'um prato por sentado');
p.mochila[2] = { k: 'sopa_legumes', n: 3 };
s.cla('A', { acao: 'jantar', sub: 'comida', i: 2 });
s.cla('A', { acao: 'jantar', sub: 'servir' });
ok(J.fase === 'comendo', 'servido');
ok(contar(p.mochila, 'peixe_assado') + contar(p.mochila, 'sopa_legumes') === 2, `comeram 3 pratos, sobraram 2 na mochila (${contar(p.mochila, 'peixe_assado')} + ${contar(p.mochila, 'sopa_legumes')})`);
ev();

// o líder senta: buff
const L0 = J.lugares[0];
s.cla('A', { acao: 'jantar', sub: 'sentar' });
ok(/Chegue perto/.test(avisos(ev())) === false && a.mesaSent, 'o líder senta na cabeceira');
a.x = L0.x; a.z = L0.z;
// conversa
let baloes = [];
const moral0 = {};
for (const id of ids) moral0[id] = 0;
const somadas = {};
s.somarMoral = (j, id, n) => { somadas[id] = (somadas[id] || 0) + n; return n; }; // a moral é da outra thread: aqui só confere a chamada
for (let t = 0; t < JANTAR.comer + 2; t += 0.5) baloes.push(...s.passo(0.5).filter((o) => o.t === 'balao'));
ok(baloes.length >= 15 && baloes.every((b) => b.para === 'A' && b.npc === 1 && b.texto.length > 2), `conversaram em balões (${baloes.length})`);
ok(new Set(baloes.map((b) => b.id)).size >= 2, 'mais de um recruta falou');
ok(!baloes.some((b) => /\{\w+\}/.test(b.texto)), 'nenhuma lacuna sobrou nas falas');
console.log('   exemplos:', baloes.slice(0, 4).map((b) => b.texto).join(' / '));
ok(!s.jantares.has(B.k), 'o jantar acabou');
ok(ids.every((id) => somadas[id] === JANTAR.moral), `moral +${JANTAR.moral} para cada um que comeu`);
ok(!ctxs[3].AMIGA.id in somadas || !somadas[ctxs[3].AMIGA.id], 'quem não veio não ganha');
ok(p.banq?.ate > Date.now() && !a.mesaSent, 'o líder que sentou ganhou o Banquete do clã e levantou no fim');
ok(s.bfJogador(a).some((b) => b[0] === 'banq' && b[1] === p.banq.ate && b[2] === JANTAR.buff.dano), 'o Banquete aparece nos buffs perto da barra de vida (bf banq)');
const semBq = calcularStatus({ ...p, banq: null });
ok(Math.abs(a.st.danoFisico / semBq.danoFisico - (1 + JANTAR.buff.dano)) < 0.02, 'Banquete: +10% de dano');
ok(c.jd === diaJantar() && ids.every((id) => !ctxs.find((x) => x.AMIGA.id === id).amiga.ia.jantar), 'jantar de hoje anotado; os recrutas voltaram ao trabalho');
s.cla('A', { acao: 'jantar', sub: 'chamar', ids });
ok(/já foi hoje/.test(avisos(ev())), 'uma vez por dia');

// longe da mesa: sem moral
c.jd = '2000-01-01';
for (const k of Object.keys(somadas)) delete somadas[k];
x0.x = M.x + 4; x0.z = M.z + 4;
s.cla('A', { acao: 'jantar', sub: 'chamar', ids: [ids[0]] });
for (let i = 0; i < 600 && !x0.mesaSent; i++) s.passo(0.1);
ok(x0.mesaSent, `sentou de novo (${Math.hypot(x0.x - M.x, x0.z - M.z).toFixed(1)} m da mesa; ${avisos(ev())})`);
a.x = M.x + 3; a.z = M.z;
s.cla('A', { acao: 'jantar', sub: 'comida', i: p.mochila.findIndex((o) => o && (o.k === 'sopa_legumes' || o.k === 'peixe_assado')) });
s.cla('A', { acao: 'jantar', sub: 'servir' });
a.x = M.x + 60;
for (let t = 0; t < JANTAR.comer + 2; t += 1) { s.passo(1); s.eventos = []; }
ok(!s.jantares.has(B.k) && !somadas[ids[0]], 'o líder saiu de perto: o jantar não dá moral');

// mudar a mesa de lugar
c.jd = '2000-01-01';
a.x = M.x + 1; a.z = M.z + 1.3;
p.mochila.fill(null);
s.cla('A', { acao: 'jantar', sub: 'recolher' });
ok(contar(p.mochila, 'obra_mesa_cla') === 1 && !s.mesaBase(B) && B.mesaSolta, 'Mudar de lugar: a mesa vai para a mochila');
ok(!s.terreno.solidos.some((o) => o.casa && Math.abs(o.x - M.x) < 0.01 && Math.abs(o.z - M.z) < 0.01 && o.hw === 1.8), 'o tampo some de onde estava');
const L1 = s.loteDe(a);
a.x = B.x + 2; a.z = B.z + 3;
s.construir('A', { k: 'mesa_cla', x: B.x - 2, z: B.z + 3, r: 1 });
const nova = s.mesaBase(B);
ok(nova && nova.x === B.x - 2 && Math.abs(nova.ry - Math.PI / 2) < 0.01 && L1.pecas.some((o) => o.k === 'mesa_cla'), `pôs a mesa em outro lugar da base (${avisos(ev())})`);
p.mochila[0] = { k: 'obra_mesa_cla', n: 1 };
s.construir('A', { k: 'mesa_cla', x: B.x + 4, z: B.z + 5, r: 0 });
{ const t = avisos(ev()); ok(/já tem uma Mesa do Clã/.test(t), `só uma mesa por clã (${t})`); }

// clã bot: o líder faz o jantar dele, com a comida do Baú do Clã
{
  const s2 = new Simulacao(MAPA_CLAREIRA);
  const q = s2.adicionarJogador('Q', 'Quim', undefined, { conta: 12 }); q.criando = false;
  s2.carregarClasNpc(null);
  for (const ctx of s2.amigosIa) ctx.amigaEntrar('Q', false);
  const E = s2.clasNpc.geada;
  const gael = s2.liderNpc({ lider: 'gael' });
  gael.prog.ouro = 99999; E.prox = 0; E.nv = 6;
  for (let i = 0; i < 3; i++) { E.prox = 0; s2.passoClasNpc(); }
  const Cg = (await import('../../shared/dados.js')).CLAS_NPC.find((o) => o.id === 'geada');
  let Bg = s2.baseDoClaNpc(Cg);
  if (!Bg) { s2.passoBasesNpc?.(); Bg = s2.baseDoClaNpc(Cg); }
  ok(!!Bg && !!s2.mesaBase(Bg), 'o clã bot tem base com Mesa do Clã');
  E.bau = Array(60).fill(null); E.bau[0] = { k: 'tilapia', n: 10 };
  E.jhDia = diaJantar(); E.jh = 0;
  const cg = s2.amigosIa.filter((x) => x.amiga && (x.AMIGA.clanpc === 'geada'));
  const Mg = s2.mesaBase(Bg);
  for (const x of [...cg, s2.amigosIa.find((o) => o.AMIGA.id === 'gael')]) { x.amiga.x = Mg.x + 4; x.amiga.z = Mg.z + 4; }
  s2.jantarNpc(Cg, E, cg.concat(s2.amigosIa.find((o) => o.AMIGA.id === 'gael')));
  const Jg = s2.jantares?.get(Bg.k);
  ok(!!Jg && Jg.conv.size === cg.length, `Gael chamou o clã para o jantar (${Jg?.conv.size})`);
  for (let t = 0; t < 300 && Jg.fase !== 'comendo'; t += 0.25) s2.passo(0.25);
  ok(Jg.fase === 'comendo' && contar(E.bau, 'tilapia') < 10, `o líder bot serviu com a comida do Baú do Clã (sobrou ${contar(E.bau, 'tilapia')})`);
  for (let t = 0; t < JANTAR.comer + 5; t += 1) s2.passo(1);
  ok(!s2.jantares.has(Bg.k) && E.jd === diaJantar() && gael.prog.banq?.ate > Date.now(), 'o jantar do bot acabou: anotado o dia e o Gael ganhou o Banquete');
}

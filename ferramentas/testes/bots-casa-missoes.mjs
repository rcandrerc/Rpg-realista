// Todo bot de clã faz missão e casa (André 2026-11-23: "quero que todos eles façam missões diárias... casa, baú, no lote do
// plano específico deles... quero que todos sejam", NPC_CASA_BASE em shared/dados.js): os recrutas do jogador e dos clãs
// bot fazem a história e as diárias no modo livre, e todo bot com lote na base do clã constrói a casa com cama e baú nele.
// Uso: node ferramentas/testes/bots-casa-missoes.mjs
import { Simulacao, MAPA_CLAREIRA, CLA, CLAS_NPC, NPC_VIDA, HISTORIA } from '../../shared/index.js';
import { acharLugarBase } from '../../shared/base.js';
import { sortearRecruta } from '../../shared/cla.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 }); a.criando = false; a.ciente = true; a.prog.ouro = 90000; a.prog.nivel = 40;
s.carregarClasNpc(null);
for (const ctx of s.amigosIa) ctx.amigaEntrar('A', false);
s.cla('A', { acao: 'fundar', nome: 'Ruivas' }); a.prog.cla.nv = 3;
const rec = s.mapa.npcs.find((n) => n.funcao === 'recrutador'); a.x = rec.x + 1; a.z = rec.z;
s.cla('A', { acao: 'recrutar', tier: 'recruta' }); s.cla('A', { acao: 'recrutar', tier: 'recruta' });
const pc = acharLugarBase(-6, 1, 'chama', []); a.x = pc.x; a.z = pc.z; // antes da base do clã bot (ela acha outro lugar)
s.eventos = []; s.cla('A', { acao: 'base' }); if (!s.baseDe(a)) console.log('aviso', s.eventos.filter((e) => e.t === 'aviso').map((e) => e.texto), Object.keys(s.basesCla || {}));
const B = s.baseDe(a); ok(B, 'base do jogador fundada');
const C = CLAS_NPC.find((K) => K.id === 'geada'), E = s.clasNpc.geada; E.nv = 6; // 6 lotes: Gael, Kira, Rufo, Lis e 2 recrutas
{ const m = sortearRecruta(Math.random, CLA.tiers[0], 10, Date.now()); m.fn = { k: 'grind' }; E.m.push(m); s.criarRecrutaNpc(C, m, true); }
s.passoClasNpc(); s.passoBasesNpc();
const meus = s.recrutasNoMundo(a);
for (const m of a.prog.cla.m) m.fn = { k: 'livre' }; // modo livre: a vida dele, como um jogador
ok(meus.length === 2 && meus.every((x) => x.amiga.tarefas && !x.amiga.semTeto), 'recrutas do jogador fazem tarefas e continuam com o teto de nível');
ok(meus.every((x) => (x.amiga.prog.hist.p | 0) === 0), 'a história deles começa do zero (antes vinha toda feita)');
ok(meus.every((x) => x.loteDaAmiga()?.def.baseK === B.k), `cada recruta tem o lote dele na base do clã (${meus.map((x) => x.loteDaAmiga()?.def.id)})`);
const kira = s.amigosIa.find((x) => x.AMIGA.id === 'kira'), gael = s.amigosIa.find((x) => x.AMIGA.id === 'gael'), bg = s.basesCla.ngeada;
ok(gael.loteDaAmiga()?.def.id.endsWith('_1') && gael.loteDaAmiga().def.baseK === bg.k, 'o Gael (líder) tem o lote 1 da base da Geada');
ok(kira.loteDaAmiga()?.def.baseK === bg.k, 'a Kira tem o lote dela na base da Geada');
const rbot = s.amigosIa.find((x) => x.AMIGA.clanpc === 'geada' && x.amiga);
ok(rbot?.amiga.tarefas && rbot.loteDaAmiga()?.def.baseK === bg.k, 'recruta do clã bot: tarefas e lote na base');
const av = s.amigosIa.find((x) => !x.AMIGA.recruta && !x.AMIGA.rival && !x.AMIGA.terreno);
ok(!av || !av.loteDaAmiga(), 'aventureiro sem clã continua sem casa');
// o tempo passa: no modo livre eles constroem a casa (com cama e baú) e saem para missão e diária
const todos = [...meus, kira, rbot];
for (const x of todos) { const R = x.rotinaAmiga(); x.amiga.prog.dia = { h: (R.saiDe + 1) % 24, t: Date.now() }; x.amiga.prog.vigor = { v: 100, t: Date.now() }; }
const pecas0 = new Map(todos.map((x) => [x.AMIGA.id, x.loteDaAmiga().pecas.length]));
for (let i = 0; i < 25 * 600; i++) s.passo(0.1);
for (const x of todos) {
  const L = x.loteDaAmiga(), n = x.AMIGA.nome, ks = new Set(L.pecas.map((p) => p.k));
  ok(L.pecas.length > pecas0.get(x.AMIGA.id), `${n}: construiu no lote (${pecas0.get(x.AMIGA.id)} -> ${L.pecas.length} peças: ${[...ks].join(',')})`);
}
const fez = (x) => (x.amiga.missaoDia?.seg || 0) > 0 || (x.amiga.prog.hist.p | 0) > 0 || Object.keys(x.amiga.prog.diarias?.n || {}).length > 0;
ok(meus.some(fez), `recruta do jogador no modo livre fez missão ou diária (${meus.map((x) => `${x.AMIGA.nome}: missão ${Math.round(x.amiga.missaoDia?.seg || 0)} s, hist ${x.amiga.prog.hist.p}, diárias ${JSON.stringify(x.amiga.prog.diarias?.n || {})}`).join(' | ')})`);
// com função no painel (grind), missão e diária só no modo livre (André 2026-11-23)
{ const x = meus[1], m = a.prog.cla.m.find((o) => o.id === x.AMIGA.id); m.fn = { k: 'grind' };
  ok(!x.modoLivreAmiga() && !x.querMissaoAmiga(x.amiga) && x.diariasQueFaltamAmiga(x.amiga).length === 0, 'recruta no grind não sai para missão nem diária');
  m.fn = { k: 'livre' }; ok(x.modoLivreAmiga(), 'de volta ao modo livre: pode fazer missão de novo'); }
// dispensar: o lote fica livre e a casa sai
const x0 = meus[0], lid = x0.loteDaAmiga().def.id;
s.cla('A', { acao: 'dispensar', id: x0.AMIGA.id });
ok(!s.lotes.has(lid) || !String(s.lotes.get(lid).dono).startsWith('r:' + x0.AMIGA.id), 'recruta dispensado: o lote dele fica livre');
ok(HISTORIA.length > 0 && NPC_VIDA.missao.segPorDia > 0, 'limites de missão do NPC de sempre');
// lote fora da grade da casa (base em número ímpar): a casa vai para a grade e a cama que já estava lá vai junto
{
  const L = { def: { id: 'tgrade', x0: 15, z0: -3, x1: 25, z1: 7, baseK: 'x' }, dono: 'a:kira', pecas: [{ id: 'p1', k: 'cama', x: 18.4, z: 1.3, r: 1, lote: 'tgrade' }], horta: {}, prox: 2 };
  const mov = kira.movelForaAmiga(L);
  ok(mov?.velho.k === 'cama' && mov.p.x === 14 + 3.4, `cama fora do lugar: vai para ${mov?.p.x}, ${mov?.p.z} (canto da casa na grade: 14, -4)`);
  kira.moverMovelAmiga(L, mov);
  ok(L.pecas.length === 1 && L.pecas[0].id === 'p1' && !kira.movelForaAmiga(L), 'a mesma cama mudou de lugar (nada some)');
}

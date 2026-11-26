// Casa dos bots fica pronta mesmo com o bot ocupado (André 2026-11-26: "todas as casas de bot estão sem telhado")
import { Simulacao, MAPA_CLAREIRA, CLA, CLAS_NPC, NPC_VIDA, HISTORIA } from '../../shared/index.js';
import { acharLugarBase } from '../../shared/base.js';
import { sortearRecruta } from '../../shared/cla.js';
import { pecaDaCasa, mesmaPeca } from '../../shared/amiga.js';
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
// o clã agora vai até o Nv 10 (André 2026-11-23): no Nv 6 o líder manda gente caçar alma para o Nv 7 e a Kira pode sair
// à caça em vez de ficar no lote. Este teste é da casa, não das ordens (cla-ordens.mjs): o clã não persegue o próximo nível.
s.faltaClaNpc = () => ({});
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
const r = [kira, rbot].filter(Boolean);
// casas quase prontas, sem telhado (como no servidor): o bot ocupado (ordem do líder) não volta para casa
const L0 = (x) => x.loteDaAmiga();
const pronta = (x) => { const L = L0(x); for (const c of x.AMIGA.casa) { const p = pecaDaCasa(L.def, c); if (p.k !== 'telhado' && !L.pecas.some((o) => mesmaPeca(o, p))) x.colocarPeca(L, p); } };
for (const x of [...meus, ...r, gael]) pronta(x);
for (const x of [...meus, ...r, gael]) ok(L0(x).pecas.length === 19 && !L0(x).pecas.some((p) => p.k === 'telhado'), `${x.AMIGA.nome}: casa com paredes e sem telhado`);
kira.amiga.ia.pulas = new Set(['telhado:' + pecaDaCasa(L0(kira).def, ['telhado', 3, 3, 0]).x + ',' + pecaDaCasa(L0(kira).def, ['telhado', 3, 3, 0]).z]); // pulada numa tentativa antiga
for (let k = 0; k < 3; k++) { s.passoObraCasas(60); s.tempo += 60; }
for (const x of [...meus, ...r, gael]) ok(L0(x).pecas.filter((p) => p.k === 'telhado').length >= 3, `${x.AMIGA.nome}: em 3 min já tem telhado subindo (${L0(x).pecas.filter((p) => p.k === 'telhado').length})`);
for (let k = 0; k < 12; k++) { s.passoObraCasas(60); s.tempo += 60; }
for (const x of [...meus, ...r, gael]) ok(L0(x).pecas.filter((p) => p.k === 'telhado').length === 6, `${x.AMIGA.nome}: telhado inteiro (a peça pulada voltou a ser tentada)`);
const n = L0(kira).pecas.length; s.passoObraCasas(60); ok(L0(kira).pecas.length === n, 'casa pronta: nada mais é posto');

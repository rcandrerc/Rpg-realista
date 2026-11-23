// O líder bot comanda o clã (André 2026-11-23, CLAS_NPC_ORDENS em shared/dados.js): ordens pelo que o clã precisa (grind
// para recruta fraco, farmar o que falta para o próximo nível, proteger com inimigo perto, fazenda), peso da
// personalidade do líder, horasDia de caça por dia real no lugar dos 30 min, e mundo vazio com XP real da curva.
// Uso: node ferramentas/testes/cla-ordens.mjs
import { Simulacao, MAPA_CLAREIRA, CLAS_NPC, CLAS_NPC_ORDENS, NPC_VIDA, CLA } from '../../shared/index.js';
import { sortearRecruta } from '../../shared/cla.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

const s = new Simulacao(MAPA_CLAREIRA);
const p = s.adicionarJogador('P', 'Pedro', undefined, { conta: 11 }); p.criando = false;
s.carregarClasNpc(null);
for (const ctx of s.amigosIa) ctx.amigaEntrar('P', false);
const C = CLAS_NPC.find((K) => K.id === 'geada'), E = s.clasNpc.geada, L = s.liderNpc(C);
L.prog.nivel = 40; L.prog.ouro = 99999;
E.nv = 6; // vagas
const T = CLA.tiers[0];
for (let i = 0; i < 3; i++) { const m = sortearRecruta(Math.random, T, 10, Date.now()); m.fn = s.funcaoBotCla(i, false); E.m.push(m); s.criarRecrutaNpc(C, m, true); }
const ctxs = () => s.amigosIa.filter((x) => x.AMIGA.clanpc === 'geada' && x.amiga);
const xs = ctxs(); ok(xs.length === 3, 'três recrutas no clã bot');
xs.forEach((x) => { x.amiga.prog.nivel = 10; x.amiga.prog.xp = 0; });
const meio = () => 0.5; // sem sorte: só necessidade e personalidade

// 1) recruta fraco, clã no nível máximo (nada falta): grind
E.nv = CLA.niveis.length - 1;
s.ordensLiderNpc(C, E, L, xs, false, meio);
ok(E.m.every((m) => m.fn.k === 'grind'), `fracos com caça sobrando: grind (${E.m.map((m) => m.fn.k)})`);

// 2) caça do dia acabou: o líder manda outra coisa (proteger sem nada faltando)
for (const x of xs) { x.grindHojeAmiga(x.amiga); x.amiga.grind.seg = CLAS_NPC_ORDENS.horasDia * 3600; }
ok(xs.every((x) => x.grindAcabouAmiga(x.amiga)), `${CLAS_NPC_ORDENS.horasDia} h de caça no dia: acabou o grind`);
s.ordensLiderNpc(C, E, L, xs, false, meio);
ok(E.m.every((m) => m.fn.k !== 'grind'), `sem caça sobrando: ninguém no grind (${E.m.map((m) => m.fn.k)})`);
for (const x of xs) x.amiga.grind.seg = 30 * 60;
ok(xs.every((x) => !x.grindAcabouAmiga(x.amiga)), 'recruta de clã bot passa dos 30 min antigos (o limite agora é em horas)');
ok(NPC_VIDA.grind.segPorDia === 1800, 'os 30 min dos outros NPCs continuam');

// 3) falta material para o próximo nível: farmam o que falta e se espalham (Dario, construtor)
E.nv = 1; E.bau = Array(CLA.bauCla).fill(null);
xs.forEach((x) => { x.amiga.prog.nivel = 40; x.amiga.grind.seg = 0; x.amiga.prog.vigor = { v: 100, t: Date.now() }; });
s.ordensLiderNpc(C, E, L, xs, false, meio);
const ks = E.m.map((m) => m.fn.k + ':' + (m.fn.r || ''));
ok(E.m.some((m) => m.fn.k === 'recurso'), `do nível do líder e falta lenha/pedra/alma: farmam (${ks})`);
ok(new Set(ks).size > 1, 'não vão todos atrás da mesma coisa');
// sem vigor: não farma (grinda ou protege)
xs.forEach((x) => { x.amiga.prog.vigor = { v: 0, t: Date.now() }; });
s.ordensLiderNpc(C, E, L, xs, false, meio);
ok(E.m.every((m) => !(m.fn.k === 'recurso' && m.fn.r !== 'alma')), `sem vigor: ninguém farma material (${E.m.map((m) => m.fn.k + ':' + (m.fn.r || ''))})`);

// 4) inimigo perto da base: proteger
xs.forEach((x) => { x.amiga.prog.vigor = { v: 100, t: Date.now() }; });
E.nv = CLA.niveis.length - 1; xs.forEach((x) => { x.amiga.grind.seg = CLAS_NPC_ORDENS.horasDia * 3600; });
const B = s.baseDoClaNpc(C) || L;
const inimigo = s.adicionarJogador('Q', 'Quim', undefined, { conta: 12 }); inimigo.criando = false;
ok(s.racaDe(inimigo) && s.racaDe(inimigo) !== 'geada', 'o jogador é da Chama');
Object.assign(inimigo, { x: B.x + 5, z: B.z + 5 });
s.ordensLiderNpc(C, E, L, xs, false, meio);
ok(E.m.some((m) => m.fn.k === 'proteger'), `Chama perto da base: protegem (${E.m.map((m) => m.fn.k)})`);
s.removerJogador('Q');

// 5) personalidade: Gael pesa grind, Dario pesa material
ok(CLAS_NPC_ORDENS.pesos.gael.grind > CLAS_NPC_ORDENS.pesos.dario.grind && CLAS_NPC_ORDENS.pesos.dario.recurso > CLAS_NPC_ORDENS.pesos.gael.recurso, 'Gael agressivo, Dario construtor');

// 6) mundo vazio: XP real pela curva, até horasDia, nunca acima do líder
const [x1, x2] = xs, m1 = E.m.find((m) => m.id === x1.AMIGA.id), m2 = E.m.find((m) => m.id === x2.AMIGA.id);
m1.fn = { k: 'grind' }; m2.fn = { k: 'grind' };
x1.amiga.prog.nivel = 8; x1.amiga.prog.xp = 0; x1.amiga.grind.seg = 0;
L.prog.nivel = 200; x2.amiga.prog.nivel = 99; x2.amiga.prog.xp = 0; x2.amiga.grind.seg = 0;
s.trabalhoFora(x1, m1, 10, L.prog.nivel);
s.trabalhoFora(x2, m2, 10, L.prog.nivel);
ok(x1.amiga.prog.nivel > 8 || x1.amiga.prog.xp > 0, `Nv 8 em 10 h fora (conta ${CLAS_NPC_ORDENS.horasDia} h): Nv ${x1.amiga.prog.nivel} + ${x1.amiga.prog.xp} XP`);
ok(x2.amiga.prog.nivel <= 100, `Nv 99 quase não sobe: Nv ${x2.amiga.prog.nivel} (xp ${x2.amiga.prog.xp})`);
ok(Math.abs(x1.amiga.grind.seg - CLAS_NPC_ORDENS.horasDia * 3600) < 1, 'as horas fora gastam a caça do dia');
const n1 = x1.amiga.prog.nivel; s.trabalhoFora(x1, m1, 5, L.prog.nivel);
ok(x1.amiga.prog.nivel === n1, 'sem caça sobrando no dia: não sobe mais fora');
L.prog.nivel = 10; x1.amiga.prog.nivel = 8; x1.amiga.grind.seg = 0; s.trabalhoFora(x1, m1, 2, L.prog.nivel);
ok(x1.amiga.prog.nivel <= 10, 'fora não passa do nível do líder');

// 7) o passo do clã roda com as ordens
L.prog.nivel = 40; E.ordensT = 0;
for (let i = 0; i < 200; i++) s.passo(0.05);
s.passoClasNpc();
ok(E.ordensT > Date.now(), 'o líder marcou a próxima olhada');
ok(true, 'simulação roda com o líder comandando');

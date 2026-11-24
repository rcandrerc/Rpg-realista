// Despensa e lenha do clã (André 2026-11-24, DESPENSA em shared/dados.js): cada morador come rações do Baú do Clã por
// hora; sem comida os recrutas ficam com fome (dano e XP menores, nunca vão embora); despensa cheia e variada, bem
// alimentados; a base gasta lenha por semana e, sem lenha, deixa de ser área segura. Clã bot segue a mesma regra.
// Uso: node ferramentas/testes/cla-despensa.mjs
import { Simulacao, MAPA_CLAREIRA, CLAS_NPC, CLA, DESPENSA, BASES_FRIAS } from '../../shared/index.js';
import { sortearRecruta, racoesDia, estoqueDespensa } from '../../shared/cla.js';
import { contar, guardar } from '../../shared/progresso.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const H = 3600e3;
const s = new Simulacao(MAPA_CLAREIRA);
const bau = Array(CLA.bauCla).fill(null);

// números: 11 moradores = 3 x 11 x 1,4
ok(Math.abs(racoesDia(11) - 46.2) < 1e-9, `11 moradores comem ${racoesDia(11)} rações por dia`);
ok(racoesDia(3) === 9, '3 moradores: 9 por dia, sem extra');

// come primeiro o que vale menos ouro por ração; prato do fogão rende mais
guardar(bau, { k: 'tilapia', n: 10 }); guardar(bau, { k: 'ensopado', n: 2 });
ok(estoqueDespensa(bau).racoes === 20, 'tilápia 1 e ensopado 5: 20 rações');
const D = {}; const t0 = Date.now() - 24 * H;
let r = s.passoDespensa(D, bau, 4, null, t0);
r = s.passoDespensa(D, bau, 4, null, t0 + 6 * H); // 4 moradores: 12,6 por dia, 3,15 em 6 h
ok(contar(bau, 'ensopado') === 2 && contar(bau, 'tilapia') < 10, 'comeu a tilápia primeiro (o mais simples) e guardou o ensopado');
ok(!D.fome, 'com comida: sem fome');
ok(s.estadoDespensa(D, bau, 4, t0 + 6 * H).mult === 0, 'pouca variedade: nem fome nem bem alimentado');
// variedade e 2 dias de estoque: bem alimentados
guardar(bau, { k: 'carne_assada', n: 10 });
const e = s.estadoDespensa(D, bau, 4, t0 + 6 * H);
ok(e.bem && e.mult === DESPENSA.bem.mult, `3 comidas e 2 dias de estoque: ${e.nome}`);
// acaba a comida: com fome, depois famintos; ninguém sai
const vazio = Array(CLA.bauCla).fill(null), D2 = {};
s.passoDespensa(D2, vazio, 4, null, t0); s.passoDespensa(D2, vazio, 4, null, t0 + 2 * H);
ok(D2.fome, 'sem comida: fome');
ok(s.estadoDespensa(D2, vazio, 4, t0 + 2 * H).mult === DESPENSA.fome[0].mult, 'primeiro dia: com fome (-10%)');
s.passoDespensa(D2, vazio, 4, null, t0 + 60 * H);
ok(s.estadoDespensa(D2, vazio, 4, t0 + 60 * H).mult === DESPENSA.fome[1].mult, 'depois de 2 dias: famintos (-25%)');
ok(D2.d <= racoesDia(4) + 1e-9, 'a fome guardada não passa de um dia');
guardar(vazio, { k: 'ensopado', n: 5 });
s.passoDespensa(D2, vazio, 4, null, t0 + 60 * H + 60e3);
ok(!D2.fome && contar(vazio, 'ensopado') < 5, 'chegou comida: comem na hora e a fome passa');
// sem Baú do Clã: sem despensa, sem castigo
const D3 = {}; s.passoDespensa(D3, null, 4, null, t0); s.passoDespensa(D3, null, 4, null, t0 + 30 * H);
ok(!D3.fome && s.estadoDespensa(D3, null, 4).mult === 0, 'sem Baú do Clã: sem fome');

// lenha da base: na semana, sem lenha a base fica fria (sai da área segura); com lenha volta
const B = { k: 'teste_base', nv: 2 }, D4 = {}, b4 = Array(CLA.bauCla).fill(null);
guardar(b4, { k: 'tilapia', n: 99 });
s.passoDespensa(D4, b4, 2, B, t0);
s.passoDespensa(D4, b4, 2, B, t0 + CLA.semana + H);
ok(D4.frio && D4.lf === DESPENSA.lenha[2] && BASES_FRIAS.has('teste_base'), `sem lenha: base fria, deve ${D4.lf}`);
guardar(b4, { k: 'lenha', n: 50 });
s.passoDespensa(D4, b4, 2, B, t0 + CLA.semana + 2 * H);
ok(!D4.frio && !BASES_FRIAS.has('teste_base') && contar(b4, 'lenha') === 50 - DESPENSA.lenha[2], 'com lenha: paga e a base volta a ser segura');

// o recruta com fome bate e aprende menos; bem alimentado, mais
const p = s.adicionarJogador('P', 'Pedro', undefined, { conta: 11 }); p.criando = false;
s.carregarClasNpc(null);
for (const ctx of s.amigosIa) ctx.amigaEntrar('P', false);
const C = CLAS_NPC.find((K) => K.id === 'geada'), E = s.clasNpc.geada, L = s.liderNpc(C);
const m = sortearRecruta(Math.random, CLA.tiers[0], 10, Date.now()); m.fn = { k: 'grind' }; E.m.push(m); s.criarRecrutaNpc(C, m, true);
const x = s.amigosIa.find((o) => o.AMIGA.id === m.id), a = x.amiga;
const dano0 = a.st.danoFisico;
s.mesaRecrutas([x], { mult: -0.25, vigor: 0.5, nome: 'Famintos' });
ok(Math.abs(a.st.danoFisico - dano0 * 0.75) < 1e-6, 'faminto: -25% de dano');
const xp0 = a.prog.xp; s.ganharXP(a, 100);
ok(a.prog.xp - xp0 === 75 || a.prog.nivel > 1, 'faminto: -25% de XP');
const dano1 = a.st.danoFisico; s.mesaRecrutas([x], { mult: 0, vigor: 1, nome: '' });
ok(Math.abs(a.st.danoFisico - dano1 / 0.75) < 1e-6, 'comeu: dano normal de novo');

// clã bot: o líder manda buscar comida e lenha; às vezes esquece, nunca com fome; com fome há 6 h, compra
E.dsp = {}; E.bau = Array(CLA.bauCla).fill(null);
let pediu = 0, esqueceu = 0;
for (let i = 0; i < 400; i++) { const f = s.faltaDespensaNpc(C, E); if (f.peixe) pediu++; else esqueceu++; }
ok(pediu > 300 && esqueceu > 10, `despensa vazia: pede comida (${pediu}), às vezes esquece (${esqueceu})`);
E.dsp.fome = Date.now() - H;
ok([...Array(200)].every(() => s.faltaDespensaNpc(C, E).peixe === 1), 'com fome: nunca esquece');
E.dsp.fome = Date.now() - 7 * H; L.prog.ouro = 100000;
ok(s.comprarDespensaNpc(E, L, s.moradoresNpc(C, E)) && contar(E.bau, DESPENSA.bots.comida) > 0 && L.prog.ouro < 100000, 'com fome há 6 h: o líder compra comida com o ouro dele');
// o líder recolhe a comida das bolsas para a despensa e nunca vende
E.bau = Array(CLA.bauCla).fill(null); a.prog.mochila.fill(null); guardar(a.prog.mochila, { k: 'tilapia', n: 30 });
s.exigirRecursosNpc(C, E, L, [x]);
ok(contar(E.bau, 'tilapia') === 30 && contar(a.prog.mochila, 'tilapia') === 0, 'o líder bot põe o peixe dos membros na despensa e não vende');

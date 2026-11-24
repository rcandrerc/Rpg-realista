// O líder bot exige os recursos dos membros (André 2026-11-24, CLAS_NPC_ORDENS.exigir): tira das bolsas os materiais de
// clã para o Baú do Clã (nunca o ouro), guarda o que os próximos níveis pedem e vende o resto para o líder.
// Uso: node ferramentas/testes/cla-exigir.mjs
import { Simulacao, MAPA_CLAREIRA, CLAS_NPC, CLAS_NPC_ORDENS, CLA, ITENS } from '../../shared/index.js';
import { sortearRecruta } from '../../shared/cla.js';
import { contar, guardar } from '../../shared/progresso.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

const s = new Simulacao(MAPA_CLAREIRA);
const p = s.adicionarJogador('P', 'Pedro', undefined, { conta: 11 }); p.criando = false;
s.carregarClasNpc(null);
for (const ctx of s.amigosIa) ctx.amigaEntrar('P', false);
const C = CLAS_NPC.find((K) => K.id === 'geada'), E = s.clasNpc.geada, L = s.liderNpc(C);
E.nv = 1; E.bau = Array(CLA.bauCla).fill(null);
for (let i = 0; i < 2; i++) { const m = sortearRecruta(Math.random, CLA.tiers[0], 10, Date.now()); m.fn = { k: 'grind' }; E.m.push(m); s.criarRecrutaNpc(C, m, true); }
const xs = s.amigosIa.filter((x) => x.AMIGA.clanpc === 'geada' && x.amiga);
ok(xs.length === 2, 'dois recrutas no clã bot');
const [a, b] = xs.map((x) => x.amiga);
a.prog.mochila.fill(null); b.prog.mochila.fill(null);
a.prog.ouro = 5000; b.prog.ouro = 7000; L.prog.ouro = 1000;
guardar(a.prog.mochila, { k: 'lenha', n: 50 }); guardar(a.prog.mochila, { k: 'lenha', n: 50 }); guardar(a.prog.mochila, { k: 'minerio_cobre', n: 10 });
guardar(b.prog.mochila, { k: 'pedra', n: 20 }); guardar(b.prog.mochila, { k: 'cristal', n: 5 }); guardar(b.prog.mochila, { k: 'alma_chama', n: 3 });
guardar(b.prog.mochila, { k: 'pocao', n: 4 });
const b0 = { ...b.prog.mochila.find((o) => o?.k === 'pocao') };

ok(s.exigirRecursosNpc(C, E, L, xs), 'o líder recolheu');
ok(['lenha', 'minerio_cobre', 'pedra', 'cristal', 'alma_chama'].every((k) => contar(a.prog.mochila, k) + contar(b.prog.mochila, k) === 0), 'os materiais saíram das bolsas');
ok(contar(b.prog.mochila, 'pocao') === b0.n, 'o que não é material (poção) fica com o recruta');
ok(a.prog.ouro === 5000 && b.prog.ouro === 7000, 'o ouro dos recrutas não é tocado');
// Nv 1 -> próximos 2 níveis pedem lenha 80 (Nv 3) e pedra 30 (Nv 2): guarda isso
ok(contar(E.bau, 'lenha') === 80, `guarda a lenha dos próximos níveis (${contar(E.bau, 'lenha')})`);
ok(contar(E.bau, 'pedra') === 20, 'pedra abaixo do pedido: guarda tudo');
ok(contar(E.bau, 'alma_chama') === 3, 'alma nunca vende');
ok(contar(E.bau, 'minerio_cobre') === 0 && contar(E.bau, 'cristal') === 0, 'cobre e cristal (sem uso nos Nv 2 e 3) vendidos');
const esperado = 1000 + 20 * ITENS.lenha.venda + 10 * ITENS.minerio_cobre.venda + 5 * ITENS.cristal.venda;
ok(L.prog.ouro === esperado, `o ouro da venda vai para o líder (${L.prog.ouro} = ${esperado})`);
// Nv 4 pede cristal 20 (Nv 5): aí guarda
E.nv = 3; guardar(a.prog.mochila, { k: 'cristal', n: 25 });
s.exigirRecursosNpc(C, E, L, xs);
ok(contar(E.bau, 'cristal') === 20, `do Nv 3, guarda o cristal do Nv 5 (${contar(E.bau, 'cristal')})`);
// desligado: nada muda
CLAS_NPC_ORDENS.exigir.ligado = false; guardar(a.prog.mochila, { k: 'pedra', n: 5 });
ok(!s.exigirRecursosNpc(C, E, L, xs) && contar(a.prog.mochila, 'pedra') === 5, 'desligado: não recolhe');
CLAS_NPC_ORDENS.exigir.ligado = true;

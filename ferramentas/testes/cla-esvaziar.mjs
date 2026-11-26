// Botão "Esvaziar bags" (André 2026-11-26): o recruta vai ao Baú do Clã, guarda o que o clã usa e vende o resto;
// ferramenta, poção, semente e o travado ficam com ele. Vale para todo clã (aqui um clã bot).
// Uso: node ferramentas/testes/cla-esvaziar.mjs
import { Simulacao, MAPA_CLAREIRA, CLAS_NPC, CLA, ITENS } from '../../shared/index.js';
import { sortearRecruta } from '../../shared/cla.js';
import { contar, guardar } from '../../shared/progresso.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

const s = new Simulacao(MAPA_CLAREIRA);
const p = s.adicionarJogador('P', 'Pedro', undefined, { conta: 11 }); p.criando = false;
s.carregarClasNpc(null);
for (const ctx of s.amigosIa) ctx.amigaEntrar('P', false);
const C = CLAS_NPC.find((K) => K.id === 'geada'), E = s.clasNpc.geada;
E.nv = 1; E.bau = Array(CLA.bauCla).fill(null);
const m = sortearRecruta(Math.random, CLA.tiers[0], 10, Date.now()); m.fn = { k: 'grind' }; E.m.push(m); s.criarRecrutaNpc(C, m, true);
const x = s.amigosIa.find((o) => o.AMIGA.id === m.id), a = x?.amiga;
ok(!!a, 'recruta no mundo');
a.prog.mochila.fill(null); a.prog.ouro = 100;
guardar(a.prog.mochila, { k: 'lenha', n: 40 }); guardar(a.prog.mochila, { k: 'pedra', n: 20 }); guardar(a.prog.mochila, { k: 'alma_chama', n: 2 });
guardar(a.prog.mochila, { k: 'pocao', n: 3 }); guardar(a.prog.mochila, { k: 'picareta', n: 1 });
const lixo = Object.keys(ITENS).find((k) => !s.precisaCla().has(k) && ITENS[k].venda > 0 && !ITENS[k].comida && !ITENS[k].usar && !ITENS[k].lugar && k !== 'pocao' && !k.startsWith('semente_') && k !== 'tomo');
guardar(a.prog.mochila, { k: lixo, n: 5 });
const trav = { k: 'cristal', n: 4, h: 1 }; a.prog.mochila[a.prog.mochila.indexOf(null)] = trav;
a.prog.mochila[a.prog.mochila.indexOf(null)] = { k: 'barquinho', n: 1 }; // com barquinho: lenha e couro não ficam

ok(s.esvaziarRecruta(x).endsWith('esvaziar a bolsa no Baú do Clã'), 'aceitou a ordem');
ok(s.esvaziarRecruta(x).includes('já está indo'), 'não repete enquanto vai');
ok(s.fazendoRecruta(a, p).includes('esvaziar'), 'painel mostra o que faz');
ok(s.esvaziarPassoRecruta(x, a, 0.1), 'deu o passo (clã bot sem base: guarda ali mesmo)');
ok(contar(E.bau, 'lenha') === 40 && contar(E.bau, 'pedra') === 20 && contar(E.bau, 'alma_chama') === 2, 'lenha, pedra e alma no Baú do Clã');
ok(contar(a.prog.mochila, lixo) === 0 && a.prog.ouro >= 100 + 5 * ITENS[lixo].venda, `vendeu o que o clã não usa (${lixo})`);
ok(contar(a.prog.mochila, 'pocao') === 3 && contar(a.prog.mochila, 'picareta') === 1, 'poção e picareta ficam com ele');
ok(a.prog.mochila.includes(trav), 'item travado fica');
ok(!a.ia.esvaziar && /Guardou 62/.test(a.ia.funcaoSt.txt), `terminou: ${a.ia.funcaoSt.txt}`);
ok(s.esvaziarRecruta(x).includes('bolsa vazia'), 'nada mais para esvaziar');

// baú cheio: o que o clã usa não é vendido
E.bau.fill({ k: 'pedra', n: 999999 }); guardar(a.prog.mochila, { k: 'pedra', n: 10 });
s.esvaziarRecruta(x); s.esvaziarPassoRecruta(x, a, 0.1);
ok(contar(a.prog.mochila, 'pedra') === 10, 'baú cheio: a pedra fica com ele, não vende');
ok(/encheu/.test(a.ia.funcaoSt.txt), 'avisa que o baú encheu');

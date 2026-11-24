// Robô de testes (ronda 2026-11-19): com a mochila cheia de pilhas de poção ele nunca vendia nada (22 mil avisos
// "Mochila cheia" num turno). Uso: node ferramentas/testes/robo-escolhas.mjs
import { FERRAMENTAS_FAZENDA, ITENS } from '../../shared/index.js';
import { listaVenda, pocoesQueFicam } from '../robo/robo-escolhas.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const protegido = (o) => !o || !!o.cad || !!FERRAMENTAS_FAZENDA[o.k] || !!ITENS[o.k]?.usar?.veiculo;

// mochila de 40 lugares: 36 pilhas de poção de vida, 3 de mana e uma ferramenta (o que o turno de 19/11 deixou)
const ferramenta = Object.keys(FERRAMENTAS_FAZENDA)[0];
const m = [...Array.from({ length: 36 }, (_, i) => ({ k: 'pocao', n: i === 5 ? 20 : 19 })), { k: 'pocao_mana', n: 4 }, { k: 'pocao_mana', n: 20 }, { k: 'pocao_mana', n: 7 }, { k: ferramenta, n: 1 }];
const fica = pocoesQueFicam(m);
ok(fica.has(5) && fica.has(37) && fica.size === 2, 'fica a pilha maior de cada poção (vida e mana)');
const l = listaVenda(m, protegido);
ok(l.length === 37 && !l.includes(5) && !l.includes(37) && !l.includes(39), 'vende as outras 37 pilhas de poção; a maior de cada e a ferramenta ficam');
ok(listaVenda([{ k: 'pocao', n: 3 }, { k: 'pocao_mana', n: 2 }, null, null, null, null], protegido).length === 0, 'com só uma pilha de cada e lugar sobrando, não vende poção');
ok(listaVenda([{ k: 'pocao', n: 3, cad: 1 }, { k: 'pocao', n: 20, cad: 1 }], protegido).length === 0, 'poção com cadeado nunca vende');
const eq = Object.keys(ITENS).find((k) => ITENS[k].lugar);
ok(listaVenda([{ k: eq, n: 1 }, { k: 'couro', n: 50 }, { k: 'couro', n: 50 }, ...Array(6).fill(null)], protegido).join() === '0,2', 'continua vendendo a peça de equipamento e a pilha repetida');

// Ronda 2026-11-24: 175 mortes na guerra numa noite, sempre voltando ao mesmo campo
import { campoPerigoso, MORTES_TROCA } from '../robo/robo-escolhas.mjs';
const t0 = 1_000_000, min = 60e3;
const tres = [{ t: t0, campo: 'A' }, { t: t0 + 2 * min, campo: 'A' }, { t: t0 + 4 * min, campo: 'A' }];
ok(MORTES_TROCA === 3 && campoPerigoso(tres, 'A', t0 + 5 * min), '3 mortes em 10 min no mesmo campo: troca de campo');
ok(!campoPerigoso(tres.slice(0, 2), 'A', t0 + 5 * min), '2 mortes ainda não trocam');
ok(!campoPerigoso(tres, 'A', t0 + 12 * min), 'morte de mais de 10 min atrás não conta');
ok(!campoPerigoso(tres, 'B', t0 + 5 * min) && !campoPerigoso(tres, null, t0), 'morte em outro campo (ou sem campo) não conta');

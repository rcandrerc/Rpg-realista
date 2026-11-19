// Revisão antes do lançamento (2026-11-19): guardar() é tudo ou nada. Antes, com a mochila cheia, juntava um pedaço da
// pilha e devolvia false, e quem chamou ficava com o item inteiro (duplicava minério no Otávio, na síntese e na horta).
// Uso: node ferramentas/testes/guardar-inteiro.mjs
import { guardar } from '../../shared/progresso.js';
import { ITENS } from '../../shared/dados.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const k = Object.keys(ITENS).find((x) => ITENS[x].pilha >= 50 && !ITENS[x].lugar);
const P = ITENS[k].pilha;
const cheia = () => Array.from({ length: 6 }, (_, i) => (i === 0 ? { k, n: P - 9 } : { k: 'pocao', n: 1 }));

let m = cheia(), it = { k, n: 50 };
ok(guardar(m, it) === false, `pilha de 50 ${k} não cabe numa mochila cheia com 9 de espaço`);
ok(m[0].n === P - 9, 'a mochila ficou como estava (nada juntou pela metade)');
ok(it.n === 50, 'o item de quem chamou não mudou');

m = cheia();
ok(guardar(m, { k, n: 9 }) === true && m[0].n === P, 'cabe exato: junta tudo na pilha');

m = cheia(); m[5] = null;
ok(guardar(m, { k, n: 50 }) === true && m[0].n === P && m[5]?.n === 41, 'com um lugar vazio: completa a pilha e o resto vai para o vazio');

// Otávio: retirar com a mochila cheia não cria item
m = cheia(); const caixa = [{ k, n: 50 }];
let n = 0; while (caixa.length && guardar(m, caixa[0])) { caixa.shift(); n++; }
const total = m.filter((o) => o?.k === k).reduce((a, o) => a + o.n, 0) + caixa.reduce((a, o) => a + o.n, 0);
ok(total === P - 9 + 50, `retirar do Otávio não duplica (total ${total})`);

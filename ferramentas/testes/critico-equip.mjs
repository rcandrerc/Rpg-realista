// Atributo extra das peças e conjunto de crítico (André 2026-11-17): capacete e botas dão dano crítico (número),
// a arma dá chance de crítico; 2/4/6 peças da mesma raridade dão crítico e dano crítico (só raridade, vale o maior).
import assert from 'node:assert/strict';
import { bonusEquip, conjuntoCritico, calcularStatus, progressoNovo } from '../../shared/progresso.js';

const quase = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} != ${b}`);
const mit = (k, e = 0) => ({ k, r: 4, ...(e ? { e } : {}) });
// tudo Mítico +40 (sem conferir atributo)
const tudo = { cabeca: mit('chapeu', 40), corpo: mit('peitoral', 40), pernas: mit('calca', 40), pes: mit('botas', 40),
  capa: mit('capa', 40), acessorio: mit('colar', 40), espada: mit('espada', 40) };
const b = bonusEquip(tudo);
quase(b.critico, 0.008 * 9 + 0.08 + 0.1, 'crítico: arma 7,2% + conjunto antigo 8% + conjunto novo 10%');
quase(b.danoCritico, 12 * 9 * 2 + 70, 'dano crítico: capacete e botas +108 cada + conjunto +70');
// 2 peças Raras: conjunto de 2
const c2 = conjuntoCritico([7, 2, 0, 0, 0]);
assert.deepEqual([c2.r, c2.t, c2.critico, c2.danoCritico], [1, 2, 0.01, 5]);
// 6 Raras e 2 Míticas: vale o maior crítico (Mítica 2 = 3% = Rara 6 = 3%; desempata pelo dano: Rara 6 = +20)
const c3 = conjuntoCritico([7, 6, 2, 2, 2]);
assert.deepEqual([c3.r, c3.t], [1, 6]);
// quebrada não conta
const q = bonusEquip({ ...tudo, cabeca: { k: 'chapeu', r: 4, e: 40, d: 0 } });
quase(q.danoCritico, 12 * 9 + 70, 'capacete quebrado não dá dano crítico');
// sem equipamento: zero
const p = progressoNovo();
if (p) assert.equal(calcularStatus(p).danoCritico, 0);
console.log('critico-equip: ok');

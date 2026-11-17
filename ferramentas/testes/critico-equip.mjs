// Atributo extra das peças e conjunto novo (André 2026-11-17): capacete e botas dão dano crítico (número), a arma dá
// chance de crítico; 2/4/6 peças da mesma raridade dão vida / crítico e dano crítico / mais crítico, dano crítico e dano %
// (só raridade, níveis somam). O CONJUNTO antigo não vale mais.
import assert from 'node:assert/strict';
import { bonusEquip, conjuntoAtivo, calcularStatus, progressoNovo } from '../../shared/progresso.js';

const quase = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} != ${b}`);
const mit = (k, e = 0) => ({ k, r: 4, ...(e ? { e } : {}) });
const tudo = { cabeca: mit('chapeu', 40), corpo: mit('peitoral', 40), pernas: mit('calca', 40), pes: mit('botas', 40),
  capa: mit('capa', 40), acessorio: mit('colar', 40), espada: mit('espada', 40) };
const b = bonusEquip(tudo);
quase(b.critico, 0.008 * 9 + 0.06, 'crítico: arma 7,2% + conjunto 6%');
quase(b.danoCritico, 12 * 9 * 2 + 48, 'dano crítico: capacete e botas +108 cada + conjunto +48');
quase(b.vida, [20, 46, 27, 27, 60].reduce((a, v) => a + v * 17, 0) + 50, 'vida: peças + 50 do conjunto');
quase(b.danoK, 0.013 * 17 + 0.1, 'dano %: colar + conjunto');
assert.equal(b.areaK, 0, 'área do conjunto antigo não vale mais');
// 2 Raras: só vida
assert.deepEqual(conjuntoAtivo([7, 2, 0, 0, 0]).map((x) => [x.t, x.r]), [[2, 1]]);
// 6 Raras e 2 Míticas: 2 = Mítica, 4 e 6 = Rara
assert.deepEqual(conjuntoAtivo([7, 6, 2, 2, 2]).map((x) => [x.t, x.r]), [[2, 4], [4, 1], [6, 1]]);
// quebrada não conta
const q = bonusEquip({ ...tudo, cabeca: { k: 'chapeu', r: 4, e: 40, d: 0 } });
quase(q.danoCritico, 12 * 9 + 48, 'capacete quebrado não dá dano crítico');
assert.equal(calcularStatus(progressoNovo()).danoCritico, 0);
console.log('critico-equip: ok');

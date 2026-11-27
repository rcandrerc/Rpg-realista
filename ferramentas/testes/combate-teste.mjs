// Combate de teste (André 2026-11-27, COMBATE_TESTE em shared/dados.js): só a conta do robô de testes. Confere que o
// jogador comum não muda, que no teste a arma multiplica o dano (pelado = metade, Épica +10 ~ hoje), que o golpe de
// monstro gasta o equipamento e que a marca de reset zera o robô uma vez só.
import assert from 'node:assert/strict';
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { calcularStatus, progressoValido, desgasteGolpe } from '../../shared/progresso.js';
import { COMBATE_TESTE } from '../../shared/dados.js';

const atr = { for: 3, vit: 3, int: 127, des: 3 };
const set = (r, e) => Object.fromEntries(['cabeca:chapeu', 'corpo:peitoral', 'pernas:calca', 'capa:capa', 'pes:botas', 'acessorio:colar', 'cajado:cajado'].map((x) => { const [l, k] = x.split(':'); return [l, { k, r, ...(e ? { e } : {}) }]; }));
const st = (eq, ct) => calcularStatus({ atr, nivel: 63, equip: eq, ...(ct ? { ct: 1 } : {}) });
// pelado: metade do dano de hoje
assert.ok(Math.abs(st({}, true).danoMagico / st({}).danoMagico - COMBATE_TESTE.base / COMBATE_TESTE.ref) < 0.02);
// Épica +10: perto de hoje (10%)
const e10 = set(2, 10);
assert.ok(Math.abs(st(e10, true).danoMagico / st(e10).danoMagico - 1) < 0.1, 'Épica +10 ~ hoje');
// armadura x2
assert.ok(st(e10, true).vidaMax > st(e10).vidaMax);
// desgaste: a cada desgasteGolpes golpes, -1 em cada peça
const p = { ct: 1, equip: set(1, 0) };
for (let i = 0; i < COMBATE_TESTE.desgasteGolpes - 1; i++) assert.equal(desgasteGolpe(p), null);
assert.deepEqual(desgasteGolpe(p), []);
assert.equal(p.equip.corpo.d, 99);
assert.equal(desgasteGolpe({ equip: set(1, 0) }), null, 'sem o teste não gasta');
// salvar guarda ct, ctg e ctz
const v = progressoValido({ ct: 1, ctg: 7, ctz: COMBATE_TESTE.zerar, nivel: 5 });
assert.equal(v.ct, 1); assert.equal(v.ctg, 7); assert.equal(v.ctz, COMBATE_TESTE.zerar);
// reset uma vez só, e só na conta do robô
const sim = new Simulacao(MAPA_CLAREIRA);
sim.adicionarJogador('r', 'Robô', 'cabelo_m', { progresso: { nivel: 50, ouro: 9999 }, robo: true, combateTeste: true });
const r = sim.jogadores.get('r');
assert.equal(r.prog.nivel, 1); assert.equal(r.prog.ct, 1); assert.equal(r.prog.ctz, COMBATE_TESTE.zerar);
const salvo = progressoValido({ ...r.prog, nivel: 30 });
sim.adicionarJogador('r2', 'Robô 2', 'cabelo_m', { progresso: salvo, robo: true, combateTeste: true });
assert.equal(sim.jogadores.get('r2').prog.nivel, 30, 'não zera de novo');
sim.adicionarJogador('g', 'Gente', 'cabelo_m', { progresso: { nivel: 50, ct: 1 } });
assert.equal(sim.jogadores.get('g').prog.nivel, 50); assert.equal(sim.jogadores.get('g').prog.ct, undefined, 'jogador comum nunca liga');
console.log('combate-teste: ok');

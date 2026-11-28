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
// teste 2: pelado bem mais fraco que hoje (nível e pontos dão menos e a arma multiplica); Rara +0 bem abaixo de hoje.
// André 2026-11-28 (DANO_ARMA): o jogo normal também ficou mais fraco depois de 60 pontos, então as margens diminuíram
// (pelado era < 0,4 e Rara < 0,5 do normal; agora 0,56 e 0,62).
assert.ok(st({}, true).danoMagico < 0.6 * st({}).danoMagico, 'pelado: bem mais fraco');
assert.ok(st(set(1, 0), true).danoMagico < 0.7 * st(set(1, 0)).danoMagico, 'Rara +0: bem abaixo de hoje');
assert.ok(st(set(0, 0), true).defesa < st(set(0, 0)).defesa, 'Comum: defesa menor que hoje');
assert.ok(st(set(3, 12), true).danoMagico > 1.3 * st(set(3, 12)).danoMagico, 'Lendária +12: bem mais forte que hoje');
// Épica +10: perto de hoje (era 10%; com DANO_ARMA, 2026-11-28, fica 14% acima: margem 20%)
const e10 = set(2, 10);
assert.ok(Math.abs(st(e10, true).danoMagico / st(e10).danoMagico - 1) < 0.2, 'Épica +10 ~ hoje');
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
// sem névoa (história feita) e com todos os totens: só grind, sem barco
const { CACA, TOTENS } = await import('../../shared/dados.js'); const { zonaFechadaEm } = await import('../../shared/historia.js');
assert.ok(CACA.every((c) => !zonaFechadaEm(progressoValido(r.prog), c.x, c.z)), 'nenhum campo na névoa');
assert.equal(progressoValido(r.prog).totens.length, TOTENS.lista.length);
const salvo = progressoValido({ ...r.prog, nivel: 30 });
sim.adicionarJogador('r2', 'Robô 2', 'cabelo_m', { progresso: salvo, robo: true, combateTeste: true });
assert.equal(sim.jogadores.get('r2').prog.nivel, 30, 'não zera de novo');
sim.adicionarJogador('g', 'Gente', 'cabelo_m', { progresso: { nivel: 50, ct: 1 } });
assert.equal(sim.jogadores.get('g').prog.nivel, 50); assert.equal(sim.jogadores.get('g').prog.ct, undefined, 'jogador comum nunca liga');
console.log('combate-teste: ok');
// upgrade manual (COMBATE_TESTE.upgrade): veste uma vez por marca
COMBATE_TESTE.upgrade = { v: 't1', equip: { corpo: { k: 'peitoral', r: 2, e: 3 } } };
sim.adicionarJogador('r3', 'Robô 3', 'cabelo_m', { progresso: salvo, robo: true, combateTeste: true });
assert.deepEqual(sim.jogadores.get('r3').prog.equip.corpo, { k: 'peitoral', r: 2, e: 3 }); assert.equal(sim.jogadores.get('r3').prog.ctu, 't1');
COMBATE_TESTE.upgrade = { v: '', equip: {} };
console.log('combate-teste upgrade: ok');
// a marca do upgrade sobrevive ao salvar/ler (senão o robô é revestido a cada login)
{ const U = COMBATE_TESTE.upgrade.v; assert.equal(progressoValido({ ct: 1, ctu: U, ctz: COMBATE_TESTE.zerar, nivel: 5 }).ctu, U, 'ctu fica gravado'); }

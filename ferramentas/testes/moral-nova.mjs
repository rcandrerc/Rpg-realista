// Moral nova (André 2026-11-26): o vigor freia a coleta, a moral freia o grind. Uma regra só, online e offline, todos os clãs.
// - grind (e caçar couro, carne...) sozinho: a moral cai cada hora mais rápido (100 -> 85 -> 60 -> 25 -> 0); a XP, o ouro
//   e a chance dos itens do bicho valem a moral (piso 5%); ele nunca para
// - coleta, profissão e Livre: a moral fica parada e a coleta rende igual
// - perto do líder / no time: +60 por hora até 100; Elogiar e Jantar até 120
// - clã bot: o líder sai com os recrutas 2 vezes por dia (passeio), sem a cota de horas
// Uso: node ferramentas/testes/moral-nova.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { MORAL, CLAS_NPC } from '../../shared/dados.js';
import { caiGrind, xpMoral, moralAgora, passarMoral, trMoral } from '../../shared/cla.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const H = 3600e3, perto = (a, b, e = 0.6) => Math.abs(a - b) <= e;

ok(MORAL.nova, 'regra nova ligada');
// a queda da tabela
const tab = [1, 2, 3, 4].map((h) => Math.round(caiGrind(100, h)));
ok(tab.join() === '85,60,25,0', `grind sozinho: 100 -> ${tab.join(' -> ')} (1 a 4 h)`);
ok(xpMoral(120) === 1.2 && xpMoral(0) === MORAL.xpMin && xpMoral(72) === 0.72, 'XP = moral (120 dá +20%, piso 5%)');
// moralAgora: grind cai, coleta e Livre param
const t0 = 1e12;
ok(perto(moralAgora({ mo: 100, mt: t0, fn: { k: 'grind' } }, null, t0 + 3 * H), 25), 'grind: 3 h sozinho = moral 25');
ok(perto(moralAgora({ mo: 100, mt: t0, fn: { k: 'recurso', r: 'carne' } }, null, t0 + 2 * H), 60), 'caçar carne conta como grind');
ok(moralAgora({ mo: 80, mt: t0, fn: { k: 'recurso', r: 'ferro' } }, t0 - 48 * H, t0 + 10 * H) === 80, 'minerar 10 h (e sem o líder): a moral não mexe');
ok(moralAgora({ mo: 40, mt: t0, fn: { k: 'livre' } }, null, t0 + 10 * H) === 40, 'Livre 10 h: a moral fica parada (não sobe sozinha)');
ok(trMoral(90, { k: 'grind' }, false) === -15 && trMoral(50, { k: 'grind' }, false) === -35 && trMoral(50, { k: 'grind' }, true) === 60, 'o por hora que o menu mostra');
// perto do líder: sobe 60/h até 100, mesmo grindando; Elogiar passa de 100, teto 120
const m = { mo: 5, mt: t0, fn: { k: 'grind' } };
for (let t = t0 + 60e3; t <= t0 + H; t += 60e3) passarMoral(m, null, true, t);
ok(perto(m.mo, 65, 1), `1 h no time com o líder: 5 -> ${m.mo}`);
for (let t = t0 + H + 60e3; t <= t0 + 3 * H; t += 60e3) passarMoral(m, null, true, t);
ok(m.mo === 100, 'no time não passa de 100');
passarMoral(m, null, true, t0 + 3 * H + 60e3, 10); passarMoral(m, null, true, t0 + 3 * H + 120e3, 35);
ok(m.mo === 120, `Elogiar + Jantar: até o teto (${m.mo})`);

// no jogo: a moral vai na XP e no drop, a coleta e o dano ficam
const s = new Simulacao(MAPA_CLAREIRA); s.nivelTetoNpc = 99;
s.adicionarJogador('A', 'André', 'ruiva', {}); const j = s.jogadores.get('A');
const b = { bot: true, prog: { nivel: 10, xp: 0, pontos: 0, mochila: [], ouro: 0 }, st: {} };
s.mesaRecrutas([{ amiga: b }], { mult: 0, vigor: 1 }, Date.now(), () => 0.5);
ok(b.moXp === 0.5 && !b.rende && !b.mesa, 'moral 50: só a XP cai (coleta e dano iguais)');
s.ganharXP(b, 100); ok(b.prog.xp === 50, `XP com moral 50: ${b.prog.xp} de 100`);
ok(Math.round(b.xpProdX) === -50, `o contador mostra o que perdeu (${Math.round(b.xpProdX)} XP, em vermelho)`);
// drops: o ouro (hoje ECONOMIA.ouroMonstro) e a chance dos itens valem a moral
const itens = (mo) => { let t = 0; const c = { tipo: 'lobo', nivel: 10, x: 0, z: 0 }; for (let i = 0; i < 1500; i++) { const p = { ...j.prog, ouro: 0, mochila: Array(40).fill(null), filtro: null }; const q = { ...j, prog: p, moXp: mo }; s.soltarDrops(c, q); t += p.mochila.reduce((n, o) => n + (o?.n || 0), 0); } return t; };
const o1 = itens(undefined), o5 = itens(0.5);
ok(o1 > 50 && o5 > o1 * 0.38 && o5 < o1 * 0.62, `itens do bicho com moral 50: ${o5} contra ${o1}`);

// tempo fora: 15 h grindando sozinho rende ~as 3 h boas (não 15 h)
const ctx = s.amigosIa.find((x) => !x.AMIGA.clanpc && !s.fixoClaNpc(x) && !x.AMIGA.recruta); ctx.amigaEntrar('A', false); const a = ctx.amiga;
if (a) {
  a.prog.nivel = 20; a.prog.xp = 0; const mm = { id: ctx.AMIGA.id, nome: 'X', fn: { k: 'grind' }, mo: 100, mt: Date.now() - 15 * H };
  const xp0 = a.prog.xp; s.trabalhoFora(ctx, mm, 15, 99);
  const tot = (a.prog.nivel - 20) * 1e9 + a.prog.xp - xp0;
  a.prog.nivel = 20; a.prog.xp = 0; const m2 = { ...mm, mo: 100, mt: Date.now() + 1 }; // moral parada em 100 (referência: 1 h cheia)
  s.trabalhoFora(ctx, m2, 1, 99); const uma = a.prog.xp + (a.prog.nivel - 20) * 1e9;
  ok(uma > 0 && tot / uma > 2 && tot / uma < 3.6, `15 h fora rendem ~${(tot / uma).toFixed(1)} h de XP cheia`);
}

// clã bot: o passeio do líder (2 vezes por dia, 1 h), sem a cota de horas
const C = CLAS_NPC[0]; let horas = 0; const dia0 = Date.UTC(2026, 10, 26, 3);
for (let k = 0; k < 24 * 4 * 20; k++) if (s.passeioNpc(C, dia0 + k * 15 * 60e3)) horas += 0.25;
ok(horas / 20 > 1.6 && horas / 20 <= 2, `passeio do líder bot: ~${(horas / 20).toFixed(1)} h por dia`);

// clã bot com o mundo vazio: sem cota, 15 h fora rendem ~as horas boas da moral (antes: 2 h cheias por dia)
{
  const xb = s.amigosIa.find((x) => x.AMIGA.clanpc && x.amiga && x.AMIGA.id !== CLAS_NPC.find((C) => C.id === x.AMIGA.clanpc)?.lider);
  const K = xb && s.claDoRecruta(xb);
  if (xb && K?.E) {
    const ab = xb.amiga, id = xb.AMIGA.id; ab.prog.nivel = 20; ab.prog.xp = 0;
    (K.E.mo ||= {})[id] = { mo: 100, mt: Date.now() - 15 * H, fn: { k: 'grind' } };
    const mb = { id, nome: 'B', fn: { k: 'grind' } }; s.grindForaBot(xb, mb, 15, 99);
    const t15 = (ab.prog.nivel - 20) * 1e9 + ab.prog.xp; ab.prog.nivel = 20; ab.prog.xp = 0;
    K.E.mo[id] = { mo: 100, mt: Date.now() + 1, fn: { k: 'grind' } }; s.grindForaBot(xb, mb, 1, 99);
    const t1 = (ab.prog.nivel - 20) * 1e9 + ab.prog.xp;
    ok(t1 > 0 && t15 / t1 > 2 && t15 / t1 < 3.6, `clã bot, 15 h fora: ~${(t15 / t1).toFixed(1)} h de XP cheia`);
  } else ok(true, 'clã bot: sem recruta no mundo neste teste (pulado)');
}

// Moral dos recrutas (André 2026-11-25, MORAL em shared/dados.js): 0 a 100, a faixa dá o rende (dano, XP e coleta) e
// multiplica a Despensa; perto do líder sobe (sem somar com o Livre), Livre sobe, 3 h seguidas trabalhando desce,
// 12 h sem o líder no jogo desce; Elogiar +10 a cada 8 h; menu do clã e painel mostram seta, % e ~N/h.
// Uso: node ferramentas/testes/cla-moral.mjs
import { Simulacao, MAPA_CLAREIRA, CLAS_NPC, CLA, MORAL } from '../../shared/index.js';
import { sortearRecruta, moralAgora, passarMoral, faixaMoral, claValido } from '../../shared/cla.js';
import { guardar } from '../../shared/progresso.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const H = 3600e3, t0 = Date.now() - 100 * H;

// faixas
ok(faixaMoral(95).rende === 1.1 && faixaMoral(95).seta === 'cima', '90+: Leal, 110%, seta pra cima');
ok(faixaMoral(70).rende === 1 && faixaMoral(55).rende === 0.9 && faixaMoral(55).seta === 'lado', '70: 100%; 55: 90% seta de lado');
ok(faixaMoral(40).rende === 0.75 && faixaMoral(10).rende === 0.6 && faixaMoral(10).seta === 'baixo', '40: 75%; 10: 60% seta pra baixo');
// Livre sobe 3/h
let m = { fn: { k: 'livre' }, mo: 50, mt: t0 };
ok(Math.abs(moralAgora(m, t0, t0 + 2 * H) - 56) < 1e-9, 'Livre 2 h: +6');
// trabalhando: 3 h sem cansar, depois -2/h
m = { fn: { k: 'grind' }, mo: 70, mt: t0, ot: t0 };
ok(moralAgora(m, t0, t0 + 3 * H) === 70, '3 h trabalhando: ainda não cansou');
ok(Math.abs(moralAgora(m, t0, t0 + 5 * H) - 66) < 1e-9, '5 h trabalhando: -4 (2/h depois de 3 h)');
// 12 h sem o líder: -1/h (Livre compensa em parte)
m = { fn: { k: 'livre' }, mo: 70, mt: t0 };
ok(Math.abs(moralAgora(m, t0, t0 + 14 * H) - Math.min(100, 70 + 42 - 2)) < 1e-9 || moralAgora(m, t0, t0 + 14 * H) === 100, 'sem o líder: só desce depois de 12 h');
m = { fn: { k: 'grind' }, mo: 70, mt: t0, ot: t0 };
ok(Math.abs(moralAgora(m, t0, t0 + 24 * H) - (70 - 42 - 12)) < 1e-9, 'um dia trabalhando sem o líder: -42 cansaço -12 sem líder');
ok(moralAgora({ fn: { k: 'grind' }, mo: 5, mt: t0, ot: t0 }, t0, t0 + 99 * H) === 0, 'nunca abaixo de 0');
// trocar de ordem não descansa; Livre zera o cansaço
m = { fn: { k: 'grind' }, mo: 70 }; passarMoral(m, t0, false, t0);
m.fn = { k: 'recurso', r: 'ferro' }; passarMoral(m, t0, false, t0 + H);
ok(m.ot === t0, 'trocou de grind para farmar: o cansaço continua contando');
m.fn = { k: 'livre' }; passarMoral(m, t0, false, t0 + 2 * H);
ok(!m.ot, 'Livre: zera o cansaço');
// perto do líder: +15/h e não soma com o Livre
m = { fn: { k: 'livre' }, mo: 50, mt: t0 }; passarMoral(m, t0, true, t0 + 60e3);
ok(Math.abs(m.mo - (50 + MORAL.pertoH / 60)) < 0.011, `Livre e perto do líder: só o perto (+${MORAL.pertoH}/h), não soma`);
m = { fn: { k: 'grind' }, mo: 50, mt: t0 }; passarMoral(m, t0, true, t0 + 60e3);
ok(Math.abs(m.mo - (50 + MORAL.pertoH / 60)) < 0.011, 'trabalhando perto do líder: +15/h');
// o perto conta só o passo, não horas
m = { fn: { k: 'grind' }, mo: 50, mt: t0, ot: t0 }; passarMoral(m, t0 + 10 * H, true, t0 + 10 * H);
ok(m.mo < 50, 'voltou depois de 10 h: o perto não ganha as 10 h');
// salva no clã
const cv = claValido({ n: 'Teste', vis: t0, m: [{ id: 'rcabcdef', nome: 'Rufo', mo: 52.5, mt: t0, ot: t0, el: t0 }] });
ok(cv.vis === t0 && cv.m[0].mo === 52.5 && cv.m[0].ot === t0 && cv.m[0].el === t0, 'moral e tempos ficam salvos no clã');

// jogo: clã do jogador com 1 recruta
const s = new Simulacao(MAPA_CLAREIRA);
const p = s.adicionarJogador('P', 'Pedro', undefined, { conta: 11 }); p.criando = false;
const r = sortearRecruta(Math.random, CLA.tiers[0], 10, Date.now()); r.fn = { k: 'grind' };
p.prog.cla = { n: 'Teste', c: Date.now(), cofre: 99999, sem: Date.now() + CLA.semana, m: [r], log: [], nv: 3 };
s.entrarRecrutas(p);
const x = s.amigosIa.find((o) => o.AMIGA.id === r.id), a = x.amiga;
ok(!!a, 'recruta no mundo');
// moral baixa: rende 75% no dano
const dano0 = a.st.danoFisico;
r.mo = 40; r.mt = Date.now();
s.mesaRecrutas([x], { mult: 0, vigor: 1, nome: '' }, Date.now(), () => faixaMoral(r.mo).rende);
ok(Math.abs(a.st.danoFisico - dano0 * 0.75) < 1e-6 && Math.abs(a.rende - 0.75) < 1e-9, 'moral 40: dano 75% e coleta 75%');
// junto com a fome: multiplica
s.mesaRecrutas([x], { mult: -0.1, vigor: 1, nome: 'Com fome' }, Date.now(), () => faixaMoral(52).rende);
ok(Math.abs(a.rende - 0.81) < 1e-9 && Math.abs(a.st.danoFisico - dano0 * 0.81) < 1e-6, 'moral 52 com fome: rende 81% (90% x 90%)');
// o menu do clã mostra seta e %
const info = s.claInfo(p).m[0];
ok(info.ml === 40, `menu: moral ${info.ml}`);
ok(['cima', 'lado', 'baixo'].includes(info.seta) && Number.isInteger(info.re) && /^#/.test(info.cor), `menu: seta ${info.seta}, rende ${info.re}%`);
// elogiar: perto, 1 vez a cada 8 h
Object.assign(a, { x: p.x + 2, z: p.z }); r.mo = 50; r.mt = Date.now(); delete r.el;
s.cla('P', { acao: 'elogiar', id: r.id });
ok(r.mo >= 60 && r.el, `elogiou: ${r.mo}`);
const mo1 = r.mo; s.cla('P', { acao: 'elogiar', id: r.id });
ok(r.mo - mo1 < 1, 'elogiar de novo antes de 8 h: nada');
Object.assign(a, { x: p.x + 200, z: p.z }); delete r.el; const mo2 = r.mo;
s.cla('P', { acao: 'elogiar', id: r.id });
ok(r.mo - mo2 < 1, 'longe: não elogia');
// passo do clã: perto sobe; longe e trabalhando não
Object.assign(a, { x: p.x + 5, z: p.z }); r.mo = 50; r.mt = Date.now() - 60e3; delete r.ot;
s.passoMoralCla(p);
ok(r.mo > 50 && p.prog.cla.vis, 'líder perto: subiu');
// produção por hora: grind conta monstros
a.prodH = { k: 'grind', t0: Date.now() - H, ev: [], ult: 0 }; a.mortesProd = 0;
a.mortesProd = 20; s.passoProdRecrutas();
const ph = s.claInfo(p).m[0].ph;
ok(ph && ph.i === 'espada' && ph.n === 20, `grind: ~${ph?.n}/h com ícone ${ph?.i}`);
// recurso: o que entrou na mochila
r.fn = { k: 'recurso', r: 'lenha' }; a.ia.levar = { r: 'lenha', item: 'lenha', nome: 'lenha' };
s.passoProdRecrutas(); a.prodH.t0 = Date.now() - 30 * 60e3;
guardar(a.prog.mochila, { k: 'lenha', n: 10 }); s.passoProdRecrutas();
const ph2 = s.claInfo(p).m[0].ph;
ok(ph2 && ph2.i === 'lenha' && ph2.n === 20, `lenha: 10 em 30 min = ~${ph2?.n}/h`);
// painel mostra igual
const pi = s.painelInfo(11, p.prog.cla, null, p, p.prog).m[0];
ok(pi.seta && pi.re && pi.ph?.i === 'lenha' && Number.isInteger(pi.ml), 'painel: seta, % e ~N/h iguais ao jogo');
// contador da ordem (André 2026-11-26): fica no membro (salvo), desde a ordem; zera só ao trocar a ordem
ok(r.oc && r.oc.k === 'r:lenha' && r.oc.n === 10, `contador da ordem no membro: ${r.oc?.k} ${r.oc?.n}`);
delete a.prodH; guardar(a.prog.mochila, { k: 'lenha', n: 5 }); s.passoProdRecrutas(); // corpo novo (deslogou/servidor reiniciou): não zera
guardar(a.prog.mochila, { k: 'lenha', n: 4 }); s.passoProdRecrutas();
ok(r.oc.n === 14 && s.claInfo(p).m[0].pt?.t === 14 && s.claInfo(p).m[0].pt?.desde, `continua contando depois de voltar: ${r.oc.n}`);
const oc0 = JSON.parse(JSON.stringify(r.oc)); ok(oc0.n === 14, 'vai no save (JSON)');
r.fn = { k: 'grind' }; s.passoProdRecrutas();
ok(r.oc.k === 'grind' && r.oc.n === 0, 'trocou a ordem: zera');
r.fn = { k: 'recurso', r: 'lenha' }; s.passoProdRecrutas(); s.passoProdRecrutas();

// clã bot: as mesmas regras
s.carregarClasNpc(null);
for (const ctx of s.amigosIa) if (!ctx.amiga) ctx.amigaEntrar('P', false);
const C = CLAS_NPC.find((K) => K.id === 'geada'), E = s.clasNpc.geada, L = s.liderNpc(C);
const rb = sortearRecruta(Math.random, CLA.tiers[0], 10, Date.now()); rb.fn = { k: 'grind' }; E.m.push(rb); s.criarRecrutaNpc(C, rb, true);
const xb = s.amigosIa.find((o) => o.AMIGA.id === rb.id);
Object.assign(xb.amiga, { x: L.x + 3, z: L.z });
const doM = (q) => [...E.m].find((o) => o.id === q.AMIGA.id);
E.mo = { [rb.id]: { mo: 50, mt: Date.now() - 60e3 } };
s.passoMoralNpc(E, L, [xb], doM);
ok(E.mo[rb.id].mo >= 60 && E.mo[rb.id].el, `clã bot: o líder perto elogia e sobe (${E.mo[rb.id].mo})`);
// o líder bot administra: cansado ou com moral baixa ganha Livre por 1 h (às vezes esquece)
E.mo[rb.id] = { mo: 80, mt: Date.now(), ot: Date.now() - 4 * H };
ok(s.descansoNpc(E, rb, () => 0.5) && E.mo[rb.id].desc > Date.now(), 'clã bot: 4 h trabalhando, o líder dá descanso');
s.ordensLiderNpc(C, E, L, [xb], false, () => 0.5);
ok(rb.fn.k === 'livre', 'na rodada de ordens ele fica no Livre');
E.mo[rb.id] = { mo: 30, mt: Date.now() };
ok(!s.descansoNpc(E, rb, () => 0.01), 'às vezes o líder esquece');
ok(s.descansoNpc(E, rb, () => 0.5), 'moral 30: descanso');
// André 2026-11-25: "no Livre estavam com 100% agora estão com 90%": a moral sobe, quem tirou 10% foi a fome (Despensa).
// O info diz os dois: tr (quanto a moral anda por hora) e fm (o que a comida tira ou põe no %).
const mL = { fn: { k: 'livre' }, mo: 80, mt: Date.now() };
const iF = s.moralInfo(mL, Date.now(), { mult: -0.1, nome: 'Com fome' }, null);
ok(iF.tr === 3 && iF.fm === -10 && iF.fn2 === 'Com fome' && iF.re === 90, `Livre com fome: moral +3/h, rende 90% pela comida (${JSON.stringify(iF)})`);
const iB = s.moralInfo(mL, Date.now(), { mult: 0, nome: '' }, null);
ok(iB.tr === 3 && !('fm' in iB) && iB.re === 100, 'Livre com comida: sem aviso de fome, 100%');
const mT = { fn: { k: 'grind' }, mo: 80, mt: Date.now(), ot: Date.now() - 4 * H };
ok(s.moralInfo(mT, Date.now(), { mult: 0 }, null).tr === -2, 'trabalhando 4 h: -2/h');

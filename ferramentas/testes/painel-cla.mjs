// Painel do clã (página leve, André 2026-11-24): "quando eu deixasse ele aberto, os meus bots contariam como se eu
// estivesse online". Sem corpo no mundo: a página conta como gente online (genteOnline), os recrutas ficam no mundo
// fazendo a ordem, a ordem pela página passa pelas mesmas regras do painel do jogo e o tempo fora conta certo.
// Uso: node ferramentas/testes/painel-cla.mjs
import { Simulacao, MAPA_CLAREIRA, CLA } from '../../shared/index.js';
import { sortearRecruta } from '../../shared/cla.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

const s = new Simulacao(MAPA_CLAREIRA);
const T = CLA.tiers[0], conta = 'c5';
const cla = { n: 'Brasa', c: Date.now(), cofre: 10, sem: Date.now() + CLA.semana, m: [], log: [], nv: 3 };
for (let i = 0; i < 2; i++) cla.m.push(sortearRecruta(Math.random, T, 10, Date.now()));
cla.m[0].fn = { k: 'grind' };
const [r1, r2] = cla.m;

ok(!s.genteOnline(), 'servidor vazio: ninguém online');
s.paineis.set('PN', conta);
ok(s.genteOnline() && !s.genteOnline('PN'), 'painel aberto conta como gente online');

s.entrarRecrutasSemLider([{ conta, cla, raca: 'chama' }], 'PN');
const noMundo = () => s.recrutasNoMundo({ conta }).filter((x) => x.amiga);
ok(noMundo().length === 2, 'com o painel aberto os recrutas ficam no mundo');

// o que a página mostra
const info = s.painelInfo(conta, cla, 'chama');
ok(info.n === 'Brasa' && info.m.length === 2 && info.m.every((m) => m.on === 1 && Number.isFinite(m.x) && typeof m.fz === 'string'), 'lista: no mundo, posição e o que está fazendo');
ok(!info.funcoes.some((F) => F.id === 'seguir'), 'sem o herói no jogo não tem "Me seguir"');
ok(Array.isArray(info.clas) && info.clas.length > 0 && info.lugares?.length > 1 && info.lugares.every((o) => o.nome && Number.isFinite(o.x)), 'clãs bot e as vilas do mapinha');
ok(!JSON.stringify(info).includes('"prog"'), 'não manda o progresso inteiro de ninguém');

// ordens: as mesmas regras do painel do jogo
let r = s.painelFuncao(conta, cla, 'chama', r2.id, { k: 'recurso', r: 'lenha' });
ok(r.ok && r2.fn?.k === 'recurso' && r2.fn.r === 'lenha', `ordem Farmar lenha (${r.texto})`);
const x2 = noMundo().find((x) => x.AMIGA.id === r2.id);
ok(x2.amiga.ia.levar?.r === 'lenha' || x2.amiga.ia.av || x2.amiga.ia.levar, 'o recruta do mundo já recebeu a ordem');
r = s.painelFuncao(conta, cla, 'chama', r2.id, { k: 'livre' });
ok(r.ok && !r2.fn, 'Livre tira a ordem');
r = s.painelFuncao(conta, cla, 'chama', r1.id, { k: 'seguir' });
ok(!r.ok && r1.fn.k === 'grind', 'Me seguir sem o herói: recusado');
r = s.painelFuncao(conta, cla, 'chama', r1.id, { k: 'proteger', p: 'lider' });
ok(!r.ok, 'Proteger você sem o herói: recusado');
r = s.painelFuncao(conta, cla, 'chama', r1.id, { k: 'proteger', p: r1.id });
ok(!r.ok, 'proteger a si mesmo: recusado');
r = s.painelFuncao(conta, cla, 'chama', r1.id, { k: 'proteger', p: r2.id });
ok(r.ok && r1.fn.p === r2.id, 'proteger outro membro do clã');
r = s.painelFuncao(conta, cla, 'chama', 'rcnaoexiste', { k: 'grind' });
ok(!r.ok, 'recruta de outro clã: recusado');
r = s.painelFuncao(conta, cla, 'chama', r1.id, { k: 'recurso', r: '__proto__' });
ok(!r.ok && r1.fn.k === 'proteger', 'recurso inventado: recusado');
r = s.painelFuncao(conta, cla, 'chama', r1.id, { k: 'hackear' });
ok(!r.ok, 'ordem inventada: recusada');

// fechou a página com mais ninguém: saem e o tempo fora conta daqui
const antes = Date.now();
s.painelSaiu(conta, cla);
ok(cla.saiu >= antes, 'fechou: o tempo fora volta a contar');
for (const ctx of s.amigosIa) ctx.amigaSair('Q'); // outro saiu: o painel segura
ok(noMundo().length === 2, 'outro saiu com o painel aberto: ficam');
s.paineis.delete('PN');
for (const ctx of s.amigosIa) ctx.amigaSair('PN');
ok(noMundo().length === 0, 'painel fechou e o servidor esvaziou: saem');

// abriu de novo depois de 3 h fora: os recrutas entregam o tempo fora (registro do clã) e para de contar
cla.saiu = Date.now() - 3 * 3600e3; r1.fn = { k: 'grind' };
s.paineis.set('PN2', conta);
s.entrarRecrutasSemLider([{ conta, cla, raca: 'chama' }], 'PN2');
const x1 = noMundo().find((x) => x.AMIGA.id === r1.id); delete x1.foraDesde; x1.amiga.prog.nivel = 5;
s.painelEntrou(conta, cla, 30, new Set(noMundo().map((x) => x.AMIGA.id)));
ok(!cla.saiu, 'abriu: o tempo fora parou de contar');
ok(cla.log.some((l) => /^Fora \(/.test(l.txt)), `o tempo fora foi para o registro (${cla.log.map((l) => l.txt).join(' | ')})`);
ok(!s.eventos?.some?.((e) => e.t === 'aviso' && e.para == null), 'sem aviso para todo mundo');

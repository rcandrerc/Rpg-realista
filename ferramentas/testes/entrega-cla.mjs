// Entrega no Baú do Clã (André 2026-11-23): nada vai sozinho para o baú; só o recurso pedido no painel ("Farmar
// recurso"), e o recruta leva andando até o baú, deixa e volta a farmar. Bolsa cheia: leva e volta também.
// Uso: node ferramentas/testes/entrega-cla.mjs
import { Simulacao, MAPA_CLAREIRA, contar, NPC_VIDA } from '../../shared/index.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.ciente = true; a.x = -24; a.z = 59; a.prog.ouro = 90000; a.prog.nivel = 30;
s.comprarLote('A', { x0: -28, z0: 55, x1: -20, z1: 63 });
const p = a.prog, L = s.loteDe(a);
p.mochila.fill(null); p.mochila[0] = { k: 'obra_bau_cla', n: 1 };
s.cla('A', { acao: 'fundar', nome: 'Entrega' }); p.cla.nv = 6;
s.construir('A', { k: 'bau_cla', x: -21.5, z: 61, r: 0 });
ok(L.pecas.some((o) => o.k === 'bau_cla'), 'Baú do Clã no terreno');
const r = s.mapa.npcs.find((n) => n.funcao === 'recrutador'); a.x = r.x + 1; a.z = r.z;
s.cla('A', { acao: 'recrutar', tier: 'recruta' });
const m = p.cla.m[0], x = s.recrutasNoMundo(a).find((o) => o.AMIGA.id === m.id), b = x.amiga;
b.prog.prof = { ...b.prog.prof, min: 5000 }; b.prog.mochila[7] = { k: 'picareta', n: 1 }; b.prog.vigor = { v: 100, t: Date.now() };

// grind: o couro da caça fica com ele
s.cla('A', { acao: 'funcao', id: m.id, fn: { k: 'grind' } });
b.prog.mochila[8] = { k: 'couro', n: 5 };
for (let i = 0; i < 40; i++) s.passo(0.25);
ok(contar(L.bauCla || [], 'couro') === 0 && contar(b.prog.mochila, 'couro') >= 5, 'grind: nada vai sozinho para o Baú do Clã');

// pediu ferro: ele volta da coleta carregando, anda até o baú e deixa só o ferro
s.cla('A', { acao: 'funcao', id: m.id, fn: { k: 'recurso', r: 'ferro' } });
ok(b.ia.levar?.item === 'minerio_ferro', 'Farmar ferro: sabe o que levar');
b.ia.encomenda = null; b.ia.av = { fase: 'voltar' };
b.prog.mochila[9] = { k: 'minerio_ferro', n: 20 };
b.x = -21.5 + 25; b.z = 61; b.y = s.alturaEm ? s.alturaEm(b.x, b.z) : b.y;
s.passo(0.25);
ok(contar(L.bauCla || [], 'minerio_ferro') === 0, 'longe do baú: não teleporta');
ok(s.fazendoRecruta(b, a).startsWith('Levando'), `painel: "${s.fazendoRecruta(b, a)}"`);
let t = 0; for (; t < 400 && contar(L.bauCla || [], 'minerio_ferro') === 0; t++) s.passo(0.25);
ok(contar(L.bauCla || [], 'minerio_ferro') === 20, `andou até o baú e deixou 20 de ferro (${(t / 4).toFixed(0)} s)`);
ok(Math.hypot(b.x + 21.5, b.z - 61) < 3, 'deixou estando perto do baú');
ok(contar(L.bauCla || [], 'couro') === 0 && contar(b.prog.mochila, 'couro') >= 5, 'o couro (não pedido) ficou na bolsa');
b.prog.vigor = { v: 100, t: Date.now() };
// (já voltou sozinho ao deixar)
ok(b.ia.encomenda && !b.ia.encomenda.pronta, 'depois de deixar, volta a farmar ferro');

// bolsa cheia no meio da coleta: leva e volta
for (let i = 0; i < b.prog.mochila.length; i++) if (!b.prog.mochila[i]) b.prog.mochila[i] = { k: 'pedra', n: 1 };
b.prog.mochila[9] = { k: 'minerio_ferro', n: 7 };
for (let i = 0; i < 8; i++) s.passo(0.25);
ok(b.ia.av?.fase === 'voltar' && s.levandoRecruta(b), 'bolsa cheia: vem trazer o que juntou');
for (let i = 0; i < 1200 && contar(L.bauCla || [], 'minerio_ferro') < 27; i++) s.passo(0.25);
ok(contar(L.bauCla || [], 'minerio_ferro') === 27, 'bolsa cheia: deixou no baú');

// pediu couro: aparece no painel
ok(s.claInfo(a).recursos.some((o) => o.k === 'couro'), 'couro na lista do Farmar recurso');
s.cla('A', { acao: 'funcao', id: m.id, fn: { k: 'recurso', r: 'couro' } });
ok(p.cla.m[0].fn?.r === 'couro' && b.ia.levar?.item === 'couro', 'Farmar couro: caça e leva o couro');
void NPC_VIDA;

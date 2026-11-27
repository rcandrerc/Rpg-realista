// Selo da mochila do recruta (André 2026-11-27): o menu do clã do JOGO (claInfo) e o painel/leve (painelInfo)
// mandam cheia/mo de cada recruta no mundo. O #997 só lia isso do painelInfo e no jogo o selo e o Esvaziar sumiam.
// Uso: node ferramentas/testes/cla-mochila-selo.mjs
import { Simulacao, MAPA_CLAREIRA, CLA } from '../../shared/index.js';
import { sortearRecruta } from '../../shared/cla.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

const s = new Simulacao(MAPA_CLAREIRA);
ok(s.mochilaInfo({ prog: { mochila: [{ k: 'pedra', n: 1 }, null] } }).mo?.join('/') === '1/2', 'com lugar: mo 1/2');
ok(!s.mochilaInfo({ prog: { mochila: [{ k: 'pedra', n: 1 }, null] } }).cheia, 'com lugar: não cheia');
ok(s.mochilaInfo({ prog: { mochila: [{ k: 'pedra', n: 1 }] } }).cheia === 1, 'sem lugar: cheia');
const p = s.adicionarJogador('P', 'Pedro', undefined, { conta: 11 }); p.criando = false;
const m = sortearRecruta(Math.random, CLA.tiers[0], 10, Date.now());
p.prog.cla = { n: 'Teste', nv: 1, cofre: 0, sem: Date.now() + 1e8, m: [m], log: [] };
const mo = Array(10).fill(null).map((_, i) => (i < 9 ? { k: 'pedra', n: 1 } : null));
const a = { id: 'b1', prog: { mochila: mo, nivel: 10, vigor: { m: 100 } }, vida: 10, vidaMax: 10, mana: 1, manaMax: 1, x: 0, z: 0, ia: {} };
s.recrutasNoMundo = () => [{ AMIGA: { id: m.id, recruta: true }, amiga: a }];
let r; try { r = s.claInfo(p).m[0]; } catch (e) { console.error(e); }
ok(r?.mo?.join('/') === '9/10', 'jogo (claInfo): mo 9/10');
mo[9] = { k: 'pedra', n: 1 };
ok(s.claInfo(p).m[0].cheia === 1, 'jogo (claInfo): cheia');

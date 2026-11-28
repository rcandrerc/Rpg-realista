// Recruta remando fora da grade do mundo (André 2026-11-28: o Bento "tá nadando, remando e não sai do lugar" há 1 h,
// em x 190, z -1980, mais de 1400 m além da borda do mar, z -540). Ele tem que voltar para o mundo e ir fazer a ordem.
// Uso: node ferramentas/testes/recruta-fora-do-mundo.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { AGUA, gradeDoMundo } from '../../shared/relevo.js';
import { terraId } from '../../shared/rota.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const L = s.adicionarJogador('L', 'Chefe', undefined, { conta: 52 }); L.criando = false; L.ciente = true; L.prog.nivel = 60; L.prog.ouro = 90000;
const r = s.mapa.npcs.find((n) => n.funcao === 'recrutador'); L.x = r.x + 1; L.z = r.z;
s.cla('L', { acao: 'fundar', nome: 'Teste Borda' }); L.prog.cla.nv = 6;
s.cla('L', { acao: 'recrutar', tier: 'recruta' });
const m = L.prog.cla.m[0];
s.cla('L', { acao: 'funcao', id: m.id, fn: { k: 'recurso', r: process.argv[3] || 'ferro' } });
const x = s.recrutasNoMundo(L)[0], a = x.amiga;
a.prog.nivel = 65; s.aplicarStatus(a); a.vida = a.vidaMax;
for (let i = 0; i < 20; i++) s.passo(0.05);
// a mochila do Bento no servidor (28/11 15:15 UTC): 153 de 160 lugares, com picareta, machado e muito couro
if (process.argv[4] === 'bento') {
  const mo = a.prog.mochila; while (mo.length < 160) mo.push(null);
  const pos = (o) => { const i = mo.indexOf(null); if (i >= 0) mo[i] = o; };
  for (let i = 0; i < mo.length; i++) mo[i] = null;
  pos({ k: 'picareta', n: 1 }); pos({ k: 'machado', n: 1 }); pos({ k: 'pocao', n: 40 }); pos({ k: 'lenha', n: 58 }); pos({ k: 'pedra', n: 44 });
  while (mo.filter(Boolean).length < 153) pos({ k: 'couro', n: 99 });
}
const G = gradeDoMundo(), zMin = G.z0;
const modo = process.argv[2] || 'barco';
a.x = 190; a.z = -1980; a.y = AGUA.nivel; a.vy = 0; a.montado = null; a.bordo = null; a.chao = true;
a.veiculo = modo === 'barco' ? 'barquinho' : null;
if (modo !== 'barco') { const i = a.prog.mochila.indexOf(null); a.prog.mochila[i] = { k: 'barquinho', n: 1 }; }
const z0 = a.z; let maxZ = a.z;
for (let i = 0; i < 20 * 60 * (+process.env.MIN || 20); i++) {
  s.passo(0.05); if (a.morto) { a.morto = false; a.vida = a.vidaMax; }
  maxZ = Math.max(maxZ, a.z);
  if (i % (20 * 60) === 0) console.log(`t=${i / 20 / 60} min x=${a.x.toFixed(0)} z=${a.z.toFixed(0)} veic=${a.veiculo} terra=${terraId(a.x, a.z)} fase=${a.ia.fase} av=${a.ia.av?.fase} st=${a.ia.funcaoSt?.txt}`);
  if (!process.env.LONGO && a.z > zMin + 30 && terraId(a.x, a.z) > 0) break;
}
ok(a.z > zMin, `voltou para dentro do mundo (z ${z0} -> ${a.z.toFixed(0)}, borda ${zMin})`);
// e de dentro não sai mais: na beirada do mar, de barco, mandado reto para fora da grade (o que levou o Bento até lá)
// (mar do oeste: x -520, z 400; a borda da grade é x ${G.x0})
a.x = G.x0 + 40; a.z = 400; a.y = AGUA.nivel; a.veiculo = 'barquinho'; a.montado = null;
let minX = a.x;
for (let i = 0; i < 20 * 120; i++) { s.moverJogador(a, -2.1 * 0.05, 0); minX = Math.min(minX, a.x); }
ok(minX < G.x0 + 30 && minX >= G.x0 + 23, `remando para fora, para na beirada (x mínimo ${minX.toFixed(0)}, borda da grade ${G.x0})`);
a.veiculo = null;
for (let i = 0; i < 20 * 120; i++) { s.moverJogador(a, -1.4 * 0.05, 0); minX = Math.min(minX, a.x); }
ok(minX >= G.x0 + 23, `nadando para fora, também (x mínimo ${minX.toFixed(0)})`);

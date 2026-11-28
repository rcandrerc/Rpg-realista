// Toda ordem dada zera o "Coletou" e o "desde a ordem", mesmo repetindo a mesma (André 2026-11-28).
// Uso: node ferramentas/testes/recruta-ordem-zera.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
const s = new Simulacao(MAPA_CLAREIRA);
const L = s.adicionarJogador('L', 'Chefe', undefined, { conta: 53 }); L.criando = false; L.ciente = true; L.prog.nivel = 40; L.prog.ouro = 90000;
const r = s.mapa.npcs.find((n) => n.funcao === 'recrutador'); L.x = r.x + 1; L.z = r.z;
s.cla('L', { acao: 'fundar', nome: 'Teste Zera' }); s.cla('L', { acao: 'recrutar', tier: 'recruta' });
const m = L.prog.cla.m[0];
s.cla('L', { acao: 'funcao', id: m.id, fn: { k: 'recurso', r: 'ferro' } });
m.oc.t0 -= 36 * 3600e3; m.oc.n = 73;
s.cla('L', { acao: 'funcao', id: m.id, fn: { k: 'recurso', r: 'ferro' } });
const z = m.oc.n === 0 && Date.now() - m.oc.t0 < 5000; console.log(z ? 'ok' : 'FALHOU', 'a mesma ordem de novo zera o contador', m.oc); if (!z) process.exitCode = 1;

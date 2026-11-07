// Esconder o capacete (André 2026-11-03) continua funcionando no servidor junto com o reforço (2026-11-07: um merge
// tinha engolido a ação "capacete"). Uso: node ferramentas/testes/capacete.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('C', 'Cris');
j.criando = false; j.morto = false;
s.item('C', { acao: 'capacete', mostrar: false });
ok(j.prog.semCapacete === true, 'esconder o capacete grava na conta');
s.item('C', { acao: 'reforcar', lugar: 'cabeca' });
ok(j.prog.semCapacete === true, 'reforçar não mostra o capacete de novo');
s.item('C', { acao: 'capacete', mostrar: true });
ok(j.prog.semCapacete === false, 'mostrar o capacete de novo');

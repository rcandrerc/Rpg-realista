// "Usar" numa peça de construção/estação ou ferramenta (André 2026-11-07): antes dava erro no servidor e desconectava.
// Agora só avisa e não gasta o item; a poção continua funcionando.
// Uso: node ferramentas/testes/usar-obra.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('C', 'Cris');
j.criando = false; j.morto = false;
const M = j.prog.mochila;
M[0] = { k: 'obra_bancada', n: 2 }; M[1] = { k: 'enxada', n: 1 }; M[2] = { k: 'pocao', n: 3 };
let erro = null;
try { s.item('C', { acao: 'usar', i: 0 }); s.item('C', { acao: 'usar', i: 1 }); } catch (e) { erro = e; }
ok(!erro, 'Usar na bancada e na enxada não dá erro');
ok(M[0]?.n === 2 && M[1]?.n === 1, 'não gasta a peça nem a ferramenta');
j.vida = 1;
s.item('C', { acao: 'usar', i: 2 });
ok(M[2]?.n === 2 && j.vida > 1, 'poção continua funcionando');

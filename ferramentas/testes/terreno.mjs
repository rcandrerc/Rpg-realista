// Teste do terreno (André 2026-11-05): mínimo 6 x 6, sem frestinha. Vender, mudar o tamanho e a conta do correio saíram
// com as bases do clã (André 2026-11-23): terreno fora da base não cobra nem trava.
// Uso: node ferramentas/testes/terreno.mjs
import { Simulacao, MAPA_CLAREIRA, motivoTerreno, LOTE } from '../../shared/index.js';
import './_tudo-aberto.mjs'; // progressão (2026-11-10): este teste não é sobre a névoa nem a trava de nível
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 }), b = s.adicionarJogador('B', 'Beto', undefined, { conta: 2 });
for (const j of [a, b]) { j.criando = false; j.x = -19; j.z = 60; j.prog.ouro = 5000; }
const avisos = () => { const e = s.eventos; s.eventos = []; return e.filter((x) => x.t === 'aviso').map((x) => x.texto); };
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
ok(motivoTerreno({ x0: -26, z0: 55, x1: -21, z1: 61 }).includes('6 x 6'), 'menor que 6 x 6 não dá');
s.comprarLote('A', { x0: -28, z0: 55, x1: -20, z1: 63 }); ok(s.loteDe(a) && a.prog.ouro === 5000 - 64 * 4, 'A comprou 8 x 8 ' + avisos());
s.comprarLote('B', { x0: -28, z0: 64, x1: -20, z1: 72 }); ok(!s.loteDe(b), 'fresta de 1 m não dá: ' + avisos());
s.comprarLote('B', { x0: -28, z0: 63, x1: -20, z1: 71 }); ok(s.loteDe(b), 'encostado dá ' + avisos());
const LA = s.loteDe(a);
a.prog.mochila[0] = { k: 'obra_bancada', n: 2 };
s.construir('A', { k: 'bancada', x: -26, z: 57.5, r: 0 }); ok(LA.pecas.length === 1, 'construiu ' + avisos());
ok(!('taxa' in LA) && !('taxa' in s.dadosLote(LA)), 'sem conta de terreno (nem no app)');
s.construir('A', { k: 'bancada', x: -23, z: 60.5, r: 0 }); ok(LA.pecas.length === 2, 'nada trava por conta de terreno ' + avisos());
ok(typeof s.venderLote !== 'function' && typeof s.mudarLote !== 'function' && typeof s.pagarTaxa !== 'function', 'vender, mudar e pagar o correio saíram');
s.esquecerLotesDe('c2', null); ok(!s.loteDe(b), 'esquece terreno vendido em outra sala');
console.log('limites:', LOTE.ladoMin, LOTE.fresta);

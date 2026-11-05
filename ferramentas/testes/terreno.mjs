// Teste do terreno (André 2026-11-05): mínimo 6 x 6, sem frestinha, vender, mudar o tamanho e a conta do correio.
// Uso: node ferramentas/testes/terreno.mjs
import { Simulacao, MAPA_CLAREIRA, motivoTerreno, LOTE, contaTerreno } from '../../shared/index.js';
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
// peça e horta, depois mudar
a.prog.mochila[0] = { k: 'obra_bancada', n: 1 };
s.construir('A', { k: 'bancada', x: -26, z: 57.5, r: 0 }); ok(LA.pecas.length === 1, 'construiu ' + avisos());
const ouro0 = a.prog.ouro;
s.mudarLote('A', { x0: -24, z0: 52, x1: -18, z1: 58 }); ok(LA.def.x0 === -28, 'peça fora do novo não deixa: ' + avisos());
s.mudarLote('A', { x0: -28, z0: 52, x1: -20, z1: 63 }); ok(LA.def.z0 === 52 && a.prog.ouro === ouro0 - 24 * 4, 'aumentou e pagou ' + avisos());
s.mudarLote('A', { x0: -28, z0: 55, x1: -20, z1: 63 }); ok(LA.def.z0 === 55 && a.prog.ouro === ouro0 - 24 * 4 + 48, 'diminuiu e recebeu metade ' + avisos());
// conta do correio
LA.taxa = Date.now() - 15 * 86400000;
const c = contaTerreno(LA.def, LA.taxa, Date.now()); ok(c.semanas === 2 && c.valor === 128, 'duas contas de 64 ' + JSON.stringify(c));
a.prog.mochila[0] = { k: 'obra_bancada', n: 1 };
s.construir('A', { k: 'bancada', x: -23, z: 60.5, r: 0 }); ok(LA.pecas.length === 1, 'conta atrasada trava: ' + avisos());
const o1 = a.prog.ouro; s.pagarTaxa('A'); ok(a.prog.ouro === o1 - 128 && contaTerreno(LA.def, LA.taxa, Date.now()).semanas === 0, 'pagou ' + avisos());
s.construir('A', { k: 'bancada', x: -23, z: 60.5, r: 0 }); ok(LA.pecas.length === 2, 'depois de pagar constrói ' + avisos());
// vender
let soltou = ''; s.aoVenderLote = (id) => { soltou = id; };
const o2 = a.prog.ouro; s.venderLote('A');
ok(!s.loteDe(a) && soltou === LA.def.id && a.prog.ouro === o2 + 128 && a.prog.mochila.filter((x) => x?.k === 'obra_bancada').reduce((n, x) => n + x.n, 0) === 2, 'vendeu por metade e as peças voltaram ' + avisos());
const salvo = s.lotesParaSalvar(); ok(salvo.some((l) => l.id === LA.def.id && l.dono === null), 'grava sem dono');
a.z = 100; s.comprarLote('A', { x0: -10, z0: 100, x1: -4, z1: 106 }); ok(s.loteDe(a), 'compra em outro lugar ' + avisos());
s.esquecerLotesDe('c2', null); ok(!s.loteDe(b), 'esquece terreno vendido em outra sala');
console.log('limites:', LOTE.ladoMin, LOTE.venda, LOTE.taxaBloco, LOTE.fresta);

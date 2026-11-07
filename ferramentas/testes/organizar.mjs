// Botão Organizar da mochila e do baú (André 2026-11-07): junta pilhas pela metade, ordena por tipo, raridade e nome,
// e nenhum item some nem duplica. Uso: node ferramentas/testes/organizar.mjs
import { Simulacao, MAPA_CLAREIRA, organizar, ITENS } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const conta = (l, k) => l.reduce((t, o) => t + (o && o.k === k ? o.n || 1 : 0), 0);
const L = [null, { k: 'lenha', n: 30 }, { k: 'espada', r: 1 }, { k: 'pocao', n: 5 }, null, { k: 'lenha', n: 40 }, { k: 'peitoral', r: 3, e: 2, d: 40 },
  { k: 'tomo', h: 'giro', nv: 6, n: 1 }, { k: 'pocao', n: 18 }, { k: 'espada', r: 4 }, { k: 'picareta', n: 1 }, { k: 'obra_parede', n: 3 }, null];
const r = organizar(L);
ok(r.length === L.length, 'mesmo tamanho');
for (const k of ['lenha', 'pocao', 'espada', 'peitoral', 'tomo', 'picareta', 'obra_parede']) ok(conta(r, k) === conta(L, k), `${k}: nada some nem duplica`);
ok(r[0].k === 'peitoral' && r[0].e === 2 && r[0].d === 40, 'equipamento primeiro, com reforço e desgaste');
ok(r[1].k === 'espada' && r[1].r === 4 && r[2].r === 1, 'raridade melhor primeiro');
ok(r[3].k === 'pocao' && r[3].n === ITENS.pocao.pilha && r[4].n === 3, 'pilhas pela metade se juntam');
ok(r.slice(-3).every((o) => o === null), 'vazios no fim');
ok(L[1].n === 30, 'não mexe na lista de antes');
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('C', 'Cris');
j.criando = false; j.morto = false;
j.prog.mochila = j.prog.mochila.map((_, i) => L[i] ?? null);
s.item('C', { acao: 'organizar' });
ok(j.prog.mochila[0].k === 'peitoral' && conta(j.prog.mochila, 'lenha') === 70, 'servidor: item/organizar');

// Buffs e debuffs na barra de vida (André 2026-11-25): o servidor manda em cada corpo a lista curta bf
// [código, fim, valor] (simulacao.js bfJogador/bfInimigo). O fim é absoluto, então a lista não muda a cada foto
// (a parte FIXO da área de interesse só vai de novo quando um efeito entra ou sai).
// Uso: node ferramentas/testes/buffs-barra.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.ciente = true; a.prog.ouro = 90000; a.prog.nivel = 40;
const eu = () => s.foto().jogadores.find((j) => j.id === 'A');
ok(Array.isArray(eu().bf) && eu().bf.length === 0, 'sem nada: bf vazio (vai sempre, para o app apagar o que acabou)');
s.cla('A', { acao: 'fundar', nome: 'Ruivas' });
a.prog.cla.nv = 3; a._bfT = 0;
ok(eu().bf.some(([k, f, v]) => k === 'cla' && f === 0 && v === 3), 'clã Nv 3: ícone do clã com o nível');
a.prog.buff = { k: 'torta_abobora', ate: Date.now() + 60000 };
ok(eu().bf.some(([k, f, v]) => k === 'co' && v === 'torta_abobora' && f === a.prog.buff.ate), 'comida: item e fim em ms');
s.efeitoNoHeroi(a, { atordoa: 2 });
s.efeitoNoHeroi(a, { lento: { k: 0.4, dur: 5 } });
let bf = eu().bf;
ok(bf.some(([k]) => k === 'atordoa'), 'atordoado aparece');
ok(bf.some(([k, , v]) => k === 'lento' && v === 0.4), 'lento com a força');
const antes = JSON.stringify(eu().bf);
s.tempo += 0.05;
ok(JSON.stringify(eu().bf) === antes, 'a lista não muda entre fotos (fim absoluto)');
s.tempo += 3;
bf = eu().bf;
ok(!bf.some(([k]) => k === 'atordoa') && bf.some(([k]) => k === 'lento'), 'o atordoado acaba antes da lentidão');
s.efeitoNoHeroi(a, { congela: 1 });
ok(eu().bf.some(([k]) => k === 'congela'), 'congelado tem código próprio');
// monstro
const e = s.inimigos.find((x) => !x.morto);
ok(Array.isArray(s.foto().inimigos.find((x) => x.id === e.id).bf), 'monstro também tem bf');
e.parado = s.tempo + 2; e.ef = 'atordoado'; e.lento = { k: 0.3, ate: s.tempo + 4 }; e.vuln = { k: 0.2, ate: s.tempo + 4 };
const be = s.foto().inimigos.find((x) => x.id === e.id).bf;
ok(be.some(([k]) => k === 'atordoa') && be.some(([k]) => k === 'lento') && be.some(([k]) => k === 'vuln'), 'monstro: atordoado, lento e vulnerável');

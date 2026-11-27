// Cada baú com o seu estoque, nome e tamanho; Baú do Clã com upgrade (André 2026-11-27).
// Uso: node ferramentas/testes/baus-independentes.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { BAU_CLA } from '../../shared/dados.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const ev = (s) => { const e = s.eventos; s.eventos = []; return e; };
const avisos = (e) => e.filter((x) => x.t === 'aviso').map((x) => x.texto).join(' | ');
const contar = (l, k) => (l || []).reduce((s, o) => s + (o?.k === k ? o.n || 1 : 0), 0);

const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.x = -19; a.z = 60; a.prog.ouro = 50000;
s.comprarLote('A', { x0: -28, z0: 55, x1: -20, z1: 63 }); ev(s);
const L = s.loteDe(a);
// o baú único de antes: 60 lugares (nv 1) com lenha dentro
L.bauNv = 1; L.bau = Array(60).fill(null); L.bau[0] = { k: 'lenha', n: 7 }; L.bau[59] = { k: 'pedra', n: 3 };
a.prog.mochila[10] = { k: 'obra_bau', n: 2 };
s.construir('A', { k: 'bau', x: -25, z: 58.5, r: 0 }); ev(s);
s.construir('A', { k: 'bau', x: -25, z: 61, r: 0 }); ev(s);
const [p1, p2] = L.pecas.filter((o) => o.k === 'bau').map((o) => o.id);
ok(L.baus[p1].it.length === 60 && L.baus[p1].nv === 1 && contar(L.baus[p1].it, 'lenha') === 7 && L.baus[p1].it[59]?.k === 'pedra', 'o estoque de antes foi inteiro para o baú mais antigo, com o tamanho');
ok(!L.bau && !L.bauNv, 'o baú único ficou vazio (nada duplicado)');
ok(L.baus[p2].it.length === 40 && L.baus[p2].it.every((o) => !o), 'o segundo baú nasce vazio com 40');
// guardar em um não aparece no outro
a.x = -23.6; a.z = 61; a.prog.mochila[0] = { k: 'cristal', n: 4 };
s.bau('A', { acao: 'guardar', i: 0, p: p2 }); let e = ev(s);
ok(contar(L.baus[p2].it, 'cristal') === 4 && contar(L.baus[p1].it, 'cristal') === 0, 'guardou só no baú 2 ' + avisos(e));
const eb = e.find((x) => x.t === 'bau'); ok(eb?.p === p2 && eb.slots === 40, 'o evento diz qual baú');
// sem p: o mais perto
s.bau('A', { acao: 'abrir' }); e = ev(s); ok(e.find((x) => x.t === 'bau')?.p === p2, 'sem p abre o mais perto');
// renomear e nome no lote
s.bau('A', { acao: 'nome', p: p2, nome: '  Minérios <b>  e  gemas que passam do limite ' }); e = ev(s);
ok(L.baus[p2].nome === 'Minérios b e gemas', 'nome limpo e curto: ' + L.baus[p2].nome);
ok(e.some((x) => x.t === 'lote' && x.bn?.[p2] === L.baus[p2].nome), 'o lote manda o nome para o app');
s.bau('A', { acao: 'nome', p: p2, nome: '' }); ev(s); ok(!L.baus[p2].nome, 'nome vazio volta a Baú');
// melhorar só esse
a.prog.mochila[1] = { k: 'lenha', n: 30 }; a.prog.mochila[2] = { k: 'barra_ferro', n: 10 };
s.bau('A', { acao: 'melhorar', p: p2 }); e = ev(s);
ok(L.baus[p2].it.length === 60 && L.baus[p1].it.length === 60 && L.baus[p2].nv === 1, 'melhorou só o baú 2 ' + avisos(e));
// baú com coisa dentro não desmonta; vazio e melhorado desmonta e o tamanho volta no próximo
s.desmontar('A', { p: p2 }); ok(avisos(ev(s)).includes('Esvazie'), 'com coisa dentro não desmonta');
const ic = L.baus[p2].it.findIndex((o) => o?.k === 'cristal');
s.bau('A', { acao: 'tirar', i: ic, p: p2 }); ev(s);
s.desmontar('A', { p: p2 }); ev(s);
ok(!L.baus[p2] && L.bausNv?.[0] === 1, 'desmontou e guardou o tamanho');
s.construir('A', { k: 'bau', x: -25, z: 61, r: 0 }); ev(s);
const p3 = L.pecas.filter((o) => o.k === 'bau').map((o) => o.id).find((id) => id !== p1);
ok(L.baus[p3]?.it.length === 60 && !L.bausNv, 'o baú novo nasce com 60');
// salva e carrega
L.baus[p1].nome = 'Madeira';
const salvo = s.lotesParaSalvar().find((x) => x.id === L.def.id);
const s2 = new Simulacao(MAPA_CLAREIRA); s2.carregarLotes([salvo]);
const L2 = s2.lotes.get(L.def.id);
ok(L2.baus[p1].nome === 'Madeira' && contar(L2.baus[p1].it, 'lenha') === 7 && L2.baus[p3].it.length === 60, 'salva e carrega cada baú');

// ---------- Baú do Clã ----------
ok(BAU_CLA.niveis.join() === '60,90,120,160,200', 'Baú do Clã 60 a 200');
const B = Array(60).fill(null);
let r = s.melhorarBauCla(B, 2, 99999, [B]); ok(r.falta && r.falta.includes('clã Nv 3'), 'precisa do clã Nv 3: ' + r.falta);
const fonte = [{ k: 'lenha', n: 100 }, { k: 'barra_ferro', n: 15 }];
r = s.melhorarBauCla(B, 3, 1000, [B, fonte]); ok(!r.falta, 'com tudo dá');
r.tirar(); const B2 = r.bau; ok(B2.length === 90 && contar(fonte, 'lenha') === 0, 'cresceu para 90 e gastou o material');
r = s.melhorarBauCla(Array(200).fill(null), 10, 1e9, []); ok(r.falta.includes('máximo'), 'para em 200');
const px = s.proxBauCla(Array(90).fill(null), { nv: 4, cofre: 5000 }, [[{ k: 'lenha', n: 20 }]]);
ok(px.proxSlots === 120 && px.px.cla === 5 && px.px.itens.find((o) => o.k === 'lenha').tem === 20 && px.prox.ouro === 4000, 'janela recebe tenho/preciso');
// carrega um Baú do Clã de 120 sem encolher
const s3 = new Simulacao(MAPA_CLAREIRA);
s3.carregarLotes([{ ...salvo, dados: { ...salvo.dados, bauCla: Array(120).fill(null).map((_, i) => (i === 110 ? { k: 'lenha', n: 5 } : null)) } }]);
ok(s3.lotes.get(L.def.id).bauCla.length === 120 && s3.lotes.get(L.def.id).bauCla[110]?.k === 'lenha', 'Baú do Clã de 120 não encolhe ao carregar');

// Escolher quantos passam (André 2026-11-17: "escolher tudo ou a quantidade específica"): baú (guardar e tirar),
// fornalha/forninho (pôr), leilão (anunciar) e troca (pôr) aceitam n; sem n continua indo a pilha inteira.
// Uso: node ferramentas/testes/quantidade-mover.mjs
import { Simulacao, MAPA_CLAREIRA, ESTACOES_PUBLICAS, contar } from '../../shared/index.js';
import './_tudo-aberto.mjs';
import './_relogio-fixo.mjs'; // relógio fixo: no GitHub (máquina cheia) a lenha queimava entre duas linhas
// cada baú com o seu estoque (2026-11-27): o primeiro baú do lote
const bauDe = (L) => Object.values(L.baus || {})[0]?.it;
const nvDe = (L) => Object.values(L.baus || {})[0]?.nv | 0;
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const ev = () => { const e = s.eventos; s.eventos = []; return e; };
const avisos = (e) => e.filter((x) => x.t === 'aviso').map((x) => x.texto).join(' | ');
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.x = -19; a.z = 60; a.prog.ouro = 5000;

// baú
s.comprarLote('A', { x0: -28, z0: 55, x1: -20, z1: 63 }); ev();
a.prog.mochila[10] = { k: 'obra_bau', n: 1 };
s.construir('A', { k: 'bau', x: -25, z: 58.5, r: 0 }); ev();
a.x = -23.6; a.z = 58.5;
const L = s.loteDe(a);
a.prog.mochila[0] = { k: 'lenha', n: 30 };
s.bau('A', { acao: 'guardar', i: 0, n: 12 }); let e = ev();
ok(a.prog.mochila[0]?.n === 18 && contar(bauDe(L), 'lenha') === 12, 'baú: guardou 12 de 30 ' + avisos(e));
s.bau('A', { acao: 'guardar', i: 0, n: 999 }); ev();
ok(!a.prog.mochila[0] && contar(bauDe(L), 'lenha') === 30, 'baú: n maior que a pilha guarda tudo');
const iB = bauDe(L).findIndex((o) => o && o.k === 'lenha');
s.bau('A', { acao: 'tirar', i: iB, n: 5 }); ev();
ok(contar(a.prog.mochila, 'lenha') === 5 && contar(bauDe(L), 'lenha') === 25, 'baú: tirou 5');
s.bau('A', { acao: 'tirar', i: iB }); ev();
ok(contar(a.prog.mochila, 'lenha') === 30 && contar(bauDe(L), 'lenha') === 0, 'baú: sem n tira a pilha inteira');
const iM = a.prog.mochila.findIndex((o) => o && o.k === 'lenha');
s.bau('A', { acao: 'guardar', i: iM }); ev();
ok(contar(a.prog.mochila, 'lenha') === 0 && contar(bauDe(L), 'lenha') === 30, 'baú: sem n guarda a pilha inteira');

// forninho público
const f = ESTACOES_PUBLICAS.find((o) => o.id === 'pub_fornalha');
a.x = f.x - 1.4; a.z = f.z + 0.5;
a.prog.mochila.fill(null);
a.prog.mochila[0] = { k: 'minerio_cobre', n: 12 }; a.prog.mochila[1] = { k: 'lenha', n: 20 };
s.forno('A', { acao: 'abrir', p: f.id }); ev();
s.forno('A', { acao: 'por', p: f.id, lugar: 'ent', i: 0, n: 6 }); s.forno('A', { acao: 'por', p: f.id, lugar: 'comb', i: 1, n: 3 }); e = ev();
const F = a.prog.fornosPub[f.id];
ok(F.ent?.n === 6 && a.prog.mochila[0].n === 6, 'forninho: pôs 6 de 12 minérios ' + avisos(e));
ok(F.comb?.n === 3 && a.prog.mochila[1].n === 17, 'forninho: pôs 3 lenhas');
s.forno('A', { acao: 'por', p: f.id, lugar: 'ent', i: 0 }); ev();
ok(!a.prog.mochila[0] && F.ent?.k === 'minerio_cobre', 'forninho: sem n vai o resto (o forno já começou a fundir)');

// leilão
const O = MAPA_CLAREIRA.npcs.find((n) => n.id === 'v_otavio');
a.x = O.x + 1; a.z = O.z + 1;
a.prog.mochila[2] = { k: 'barra_ferro', n: 10 };
s.leilaoMsg('A', { acao: 'anunciar', i: 2, n: 4, preco: 80, horas: 24 }); e = ev();
let Lt = e.filter((x) => x.t === 'leilao').pop();
ok(a.prog.mochila[2]?.n === 6 && Lt.meus.some((x) => x.item.k === 'barra_ferro' && x.item.n === 4), 'leilão: anunciou 4 de 10 ' + avisos(e));
s.leilaoMsg('A', { acao: 'anunciar', i: 2, preco: 80, horas: 24 }); e = ev();
Lt = e.filter((x) => x.t === 'leilao').pop();
ok(!a.prog.mochila[2] && Lt.meus.some((x) => x.item.k === 'barra_ferro' && x.item.n === 6), 'leilão: sem n vai a pilha inteira');

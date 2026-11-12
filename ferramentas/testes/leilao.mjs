// A Casa do Comércio (história v2, Entrega 3): o leilão entre jogadores com o Otávio, no Rio Claro (shared/leilao.js).
// Uso: node ferramentas/testes/leilao.mjs
import { Simulacao, MAPA_CLAREIRA, Leilao, LEILAO, contar } from '../../shared/index.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const ev = () => { const e = s.eventos; s.eventos = []; return e; };
const avisos = (e) => e.filter((x) => x.t === 'aviso').map((x) => x.texto).join(' | ');
const ultimo = (e, id) => e.filter((x) => x.t === 'leilao' && x.para === id).pop();
const O = MAPA_CLAREIRA.npcs.find((n) => n.id === 'v_otavio');
ok(O && O.funcao === 'leilao' && O.vila === 'rio_claro', 'Otávio, o leiloeiro, no Rio Claro');
const iara = MAPA_CLAREIRA.npcs.find((n) => n.id === 'v_iara');
ok(iara && iara.funcao === 'resetar' && Math.hypot(iara.x - O.x, iara.z - O.z) < 8, 'Mestra Iara (reset) ao lado da Casa do Comércio');
const A = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 }), B = s.adicionarJogador('B', 'Beto', undefined, { conta: 2 });
for (const j of [A, B]) { j.criando = false; j.prog.ouro = 1000; }
// longe do Otávio não dá
s.leilaoMsg('A', { acao: 'ver' });
ok(/Otávio/.test(avisos(ev())), 'longe do Otávio: avisa onde fica');
for (const j of [A, B]) { j.x = O.x + 1; j.z = O.z + 1; }
// anunciar
A.prog.mochila[0] = { k: 'barra_ferro', n: 10 };
A.prog.mochila[1] = { k: 'couro', n: 5, cad: 1 };
s.leilaoMsg('A', { acao: 'anunciar', i: 1, preco: 50, horas: 24 });
ok(/trancado/.test(avisos(ev())) && A.prog.mochila[1], 'item com cadeado não vai à venda');
s.leilaoMsg('A', { acao: 'anunciar', i: 0, preco: 50, horas: 12 });
ok(/24 ou 48/.test(avisos(ev())) && A.prog.mochila[0], 'prazo só 24 ou 48 h');
s.leilaoMsg('A', { acao: 'anunciar', i: 0, preco: 200, horas: 48 });
let e = ev(), L = ultimo(e, 'A');
ok(A.prog.mochila[0] === null && L.meus.length === 1 && L.meus[0].preco === 200, 'anunciou: saiu da mochila e está em Meus anúncios');
ok(L.lista.every((a) => a.id !== L.meus[0].id) && L.lista.some((a) => a.casa), 'na busca dele aparecem os da casa, não os dele');
// comprar (o outro jogador)
s.leilaoMsg('B', { acao: 'ver', busca: { tipo: 'mat', ordem: 'barato' } });
L = ultimo(ev(), 'B');
const meu = L.lista.find((a) => !a.casa);
ok(meu && meu.item.k === 'barra_ferro' && L.lista.every((a, i) => !i || L.lista[i - 1].preco <= a.preco), 'Beto acha a barra no filtro Materiais, do mais barato');
s.leilaoMsg('B', { acao: 'comprar', id: meu.id });
e = ev();
ok(B.prog.ouro === 800 && contar(B.prog.mochila, 'barra_ferro') === 10, 'Beto comprou: pagou 200 e levou as 10 barras');
ok(e.some((x) => x.t === 'aviso' && x.para === 'A' && /Vendeu/.test(x.texto)), 'Ana recebe o aviso da venda');
ok(s.leilao.caixa.c1.ouro === 200, 'primeira venda sem taxa: 200 de ouro guardados com o Otávio');
s.leilaoMsg('A', { acao: 'retirar' });
ok(A.prog.ouro === 1200 && s.leilao.caixa.c1.ouro === 0, 'Ana retirou o ouro');
// a 4a venda paga 5%
for (let k = 0; k < 3; k++) { A.prog.mochila[0] = { k: 'pedra', n: 1 }; s.leilaoMsg('A', { acao: 'anunciar', i: 0, preco: 100, horas: 24 }); }
ev();
for (const a of [...s.leilao.anuncios]) s.leilaoMsg('B', { acao: 'comprar', id: a.id });
ok(s.leilao.caixa.c1.ouro === 200 + 95, 'vendas 2 e 3 sem taxa, a 4a com 5% (100 -> 95)');
// sem ouro e anúncio da casa
B.prog.ouro = 1;
s.leilaoMsg('B', { acao: 'comprar', id: 'casa0' });
ok(/Faltam/.test(avisos(ev())), 'sem ouro não compra');
B.prog.ouro = 10000; const antes = contar(B.prog.mochila, 'minerio_cobre');
s.leilaoMsg('B', { acao: 'comprar', id: 'casa0' }); ev();
ok(contar(B.prog.mochila, 'minerio_cobre') === antes + 20 && s.leilao.casa.length === LEILAO.casa.length, 'anúncio da casa: compra e ele continua lá');
// limite de 10 e cancelar
for (let k = 0; k < 11; k++) { A.prog.mochila[k] = { k: 'lenha', n: 1 }; s.leilaoMsg('A', { acao: 'anunciar', i: k, preco: 5, horas: 24 }); }
ok(/já tem 10/.test(avisos(ev())) && s.leilao.meus('c1').length === 10, 'até 10 anúncios por vez');
const id = s.leilao.meus('c1')[0].id;
s.leilaoMsg('B', { acao: 'cancelar', id }); ok(/não é seu/.test(avisos(ev())), 'não cancela o anúncio dos outros');
s.leilaoMsg('A', { acao: 'cancelar', id }); ev();
ok(s.leilao.meus('c1').length === 9, 'cancelou: o item voltou');
// vencer: o item fica com o Otávio
for (const a of s.leilao.anuncios) a.ate = Date.now() - 1;
s.leilaoMsg('A', { acao: 'ver' }); L = ultimo(ev(), 'A');
ok(L.meus.length === 0 && L.caixa.itens.length === 9, 'vencidos ficam guardados com o Otávio');
// guardado no banco: o estado volta igual
const L2 = new Leilao(JSON.parse(JSON.stringify(s.leilao.estado())));
ok(L2.caixa.c1.itens.length === 9 && L2.vendas.c1 === 4 && L2.seq === s.leilao.seq, 'estado guardado volta igual (reiniciar o servidor)');
// conversa com o Otávio abre a janela do leilão
s.falar('A', { npc: 'v_otavio' });
e = ev();
ok(e.some((x) => x.t === 'fala' && x.abrir === 'leilao') && ultimo(e, 'A'), 'falar com o Otávio abre o leilão');

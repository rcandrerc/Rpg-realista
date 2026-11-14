// Fogão que cozinha sozinho, como a fornalha (André 2026-11-07). Uso: node ferramentas/testes/fogao-sozinho.mjs
import { Simulacao, MAPA_CLAREIRA, FOGAO, contar } from '../../shared/index.js';
import { avancarForno } from '../../shared/simulacao.js';
import './_tudo-aberto.mjs'; // progressão (2026-11-10): este teste não é sobre a névoa nem a trava de nível
import './_relogio-fixo.mjs'; // relógio e sorte fixos: o mesmo resultado em máquina rápida ou lenta (CI)
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
const b = s.adicionarJogador('B', 'Bia', undefined, { conta: 2 });
a.criando = false; a.x = -19; a.z = 60; a.prog.ouro = 5000; b.criando = false;
const ev = () => { const e = s.eventos; s.eventos = []; return e; };
const avisos = (e) => e.filter((x) => x.t === 'aviso').map((x) => x.texto).join(' | ');
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
ok(FOGAO.receitas.sopa_legumes && FOGAO.receitas.carne_assada.dur > 0, 'pratos do fogão vêm das receitas do Cozinheiro');
s.comprarLote('A', { x0: -28, z0: 55, x1: -20, z1: 63 }); ev();
a.prog.mochila[10] = { k: 'obra_fogao', n: 1 };
s.construir('A', { k: 'fogao', x: -25, z: 58.5, r: 0 }); ev();
const peca = s.loteDe(a).pecas.find((o) => o.k === 'fogao'); ok(peca, 'construiu o fogão');
a.x = -23.6; a.z = 58.5;
a.prog.mochila[0] = { k: 'cenoura', n: 5 }; a.prog.mochila[1] = { k: 'batata', n: 3 }; a.prog.mochila[2] = { k: 'rabanete', n: 4 }; a.prog.mochila[3] = { k: 'lenha', n: 10 };
s.forno('A', { acao: 'abrir', p: peca.id }); let e = ev();
ok(e.some((x) => x.t === 'forno' && x.tipo === 'fogao' && x.abrir), 'abre a janela do fogão');
s.forno('A', { acao: 'por', p: peca.id, lugar: 'ent', r: 'sopa_legumes', n: 99 }); e = ev();
const F = s.loteDe(a).fornos[peca.id];
ok(F.ent && F.ent.k === 'sopa_legumes' && F.ent.n === 3, 'põe 3 sopas (batata só dá 3) ' + avisos(e));
ok(contar(a.prog.mochila, 'batata') === 0 && contar(a.prog.mochila, 'cenoura') === 2 && contar(a.prog.mochila, 'rabanete') === 1, 'ingredientes saíram da mochila');
s.forno('A', { acao: 'por', p: peca.id, lugar: 'ent', r: 'carne_assada', n: 1 }); ok(avisos(ev()).includes('Tire o prato'), 'um prato por vez na panela');
// relógio parado ao pôr a lenha: na máquina lenta do CI o milissegundo virava no meio da ação e o fogo já acendia (10 -> 9)
{ const agora = Date.now, t0 = F.t; Date.now = () => t0; s.forno('A', { acao: 'por', p: peca.id, lugar: 'comb', i: 3 }); ev(); Date.now = agora; }
ok(F.comb && F.comb.k === 'lenha' && F.comb.n === 10, 'lenha no combustível');
// vai embora: 31 s depois (2 sopas de 15 s, 3 lenhas de 12 s)
a.x = 0; a.z = 0;
avancarForno(F, F.t + 31000, FOGAO);
ok(F.sai && F.sai.k === 'sopa_legumes' && F.sai.n === 2 && F.ent.n === 1, 'cozinhou sozinho com o dono longe');
ok(F.comb.n === 7, 'gastou 3 lenhas');
s.forno('A', { acao: 'tirar', p: peca.id, lugar: 'sai' }); ok(avisos(ev()).includes('Chegue perto'), 'de longe não pega');
a.x = -23.6; a.z = 58.5; F.t = Date.now();
const pts = a.prog.prof.coz || 0;
s.forno('A', { acao: 'tirar', p: peca.id, lugar: 'sai' }); e = ev();
ok(contar(a.prog.mochila, 'sopa_legumes') === 2 && (a.prog.prof.coz || 0) > pts, 'pegou 2 sopas e ganhou pontos de Cozinheiro ' + avisos(e));
s.forno('A', { acao: 'tirar', p: peca.id, lugar: 'ent' }); ev();
ok(!F.ent && contar(a.prog.mochila, 'batata') === 1 && contar(a.prog.mochila, 'cenoura') === 3, 'tirar a panela devolve os ingredientes');
// só o dono
b.x = a.x; b.z = a.z;
s.forno('B', { acao: 'abrir', p: peca.id }); ok(avisos(ev()).includes('seu terreno'), 'outro jogador não usa o meu fogão');
b.prog.mochila[0] = { k: 'cenoura', n: 1 }; b.prog.mochila[1] = { k: 'batata', n: 1 }; b.prog.mochila[2] = { k: 'rabanete', n: 1 };
s.criarUm('B', { r: 'sopa_legumes' }); ok(contar(b.prog.mochila, 'sopa_legumes') === 0 && avisos(ev()).includes('fogão'), 'nem cozinha na hora no fogão dos outros');
// cozinhar na hora continua (aba Criar)
a.prog.mochila[20] = { k: 'carne', n: 1 }; a.prog.mochila[21] = { k: 'lenha', n: 1 };
s.criarUm('A', { r: 'carne_assada' }); ok(contar(a.prog.mochila, 'carne_assada') === 1, 'na hora pela aba Criar continua ' + avisos(ev()));
// com coisa dentro não desmonta
s.forno('A', { acao: 'por', p: peca.id, lugar: 'ent', r: 'sopa_legumes', n: 1 }); ev();
s.desmontar('A', { p: peca.id }); ok(avisos(ev()).includes('Esvazie o fogão') && s.loteDe(a).pecas.includes(peca), 'não desmonta com prato dentro');

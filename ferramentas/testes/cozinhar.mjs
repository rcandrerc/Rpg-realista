// Fogão a lenha e pratos de comida (André 2026-11-07). Uso: node ferramentas/testes/cozinhar.mjs
import { Simulacao, MAPA_CLAREIRA, VIGOR, vigorAgora, ITENS, RECEITAS, DROPS, RECEITA_ESTACAO, PLANTAS, contar } from '../../shared/index.js';
import './_tudo-aberto.mjs'; // progressão (2026-11-10): este teste não é sobre a névoa nem a trava de nível
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.x = -19; a.z = 60; a.prog.ouro = 5000;
const ev = () => { const e = s.eventos; s.eventos = []; return e; };
const avisos = (e) => e.filter((x) => x.t === 'aviso').map((x) => x.texto).join(' | ');
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
ok(RECEITA_ESTACAO(RECEITAS.sopa_legumes) === 'fogao' && RECEITA_ESTACAO(RECEITAS.espada) === 'bigorna' && RECEITA_ESTACAO(RECEITAS.botas) === 'bancada', 'pratos no fogão; o resto continua igual');
ok(DROPS.lobo.mat.carne && DROPS.lobo.mat.couro && DROPS.puglin.mat.carne, 'lobo e puglin soltam carne (e ainda couro)');
for (const k of ['carne_assada', 'sopa_legumes', 'pao_milho', 'ensopado', 'torta_abobora']) ok(ITENS[k]?.comida && RECEITAS[k], 'prato ' + k);
// André 2026-11-21: receita de comida só leva coisa de comer (lenha e afins são combustível do fogão, não ingrediente)
for (const [k, R] of Object.entries(RECEITAS)) if (R.prof === 'coz') for (const ing of Object.keys(R.usa))
  ok(ITENS[ing]?.comida || PLANTAS[ing] || ing === 'carne', 'receita ' + k + ' só com comida (' + ing + ')');
s.comprarLote('A', { x0: -28, z0: 55, x1: -20, z1: 63 }); ev();
a.prog.mochila[0] = { k: 'cenoura', n: 2 }; a.prog.mochila[1] = { k: 'batata', n: 2 }; a.prog.mochila[2] = { k: 'rabanete', n: 2 };
s.criarUm('A', { r: 'sopa_legumes' }); ok(avisos(ev()).includes('fogão'), 'sem fogão não cozinha');
a.prog.mochila[10] = { k: 'obra_fogao', n: 1 };
s.construir('A', { k: 'fogao', x: -25, z: 58.5, r: 0 }); ok(s.loteDe(a).pecas.some((o) => o.k === 'fogao'), 'construiu o fogão ' + avisos(ev()));
a.x = -23.6; a.z = 58.5;
s.criarUm('A', { r: 'sopa_legumes' }); let e = ev();
ok(contar(a.prog.mochila, 'sopa_legumes') === 1 && contar(a.prog.mochila, 'cenoura') === 1, 'cozinhou a sopa ' + avisos(e));
ok(a.prog.prof.coz > 0, 'ganhou pontos de Cozinheiro');
const i = a.prog.mochila.findIndex((o) => o && o.k === 'sopa_legumes');
// André 2026-11-24: comida não dá mais vigor; prato com buff vale comer mesmo com a vida cheia (ferramentas/testes/comida-buff.mjs)
a.vida = a.vidaMax * 0.5; a.prog.vigor = { v: 50, t: Date.now() };
s.item('A', { acao: 'usar', i }); e = ev();
ok(Math.abs(vigorAgora(a.prog.vigor) - 50) < 0.1 && contar(a.prog.mochila, 'sopa_legumes') === 0 && a.vida > a.vidaMax * 0.5, 'comeu, curou a vida e o vigor não subiu ' + avisos(e));
a.prog.mochila[5] = { k: 'tilapia', n: 1 }; a.vida = a.vidaMax; a.prog.vigor = { v: 50, t: Date.now() };
s.item('A', { acao: 'usar', i: 5 }); ok(avisos(ev()).includes('satisfeito') && contar(a.prog.mochila, 'tilapia') === 1, 'vida cheia e sem buff: não gasta a comida');
a.prog.mochila[6] = { k: 'pocao', n: 1 }; a.vida = a.vidaMax;
s.item('A', { acao: 'usar', i: 6 }); ok(avisos(ev()).includes('vida já está cheia'), 'poção continua igual');
a.prog.mochila[7] = { k: 'carne_assada', n: 3 }; a.prog.vigor = { v: 10, t: Date.now() }; a.vida = 1;
s.item('A', { acao: 'usar', i: 7 }); s.item('A', { acao: 'usar', i: 7 }); s.item('A', { acao: 'usar', i: 7 }); ev();
ok(contar(a.prog.mochila, 'carne_assada') === 0 && Math.abs(vigorAgora(a.prog.vigor) - 10) < 0.1, 'come vários seguidos, sem recarga e sem vigor');

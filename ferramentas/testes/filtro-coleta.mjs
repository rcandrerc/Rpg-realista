// Filtro de coleta da mochila (André 2026-11-07): raridade ou recurso desmarcado não entra na mochila.
// Uso: node ferramentas/testes/filtro-coleta.mjs
import { Simulacao, MAPA_CLAREIRA, progressoValido, filtroValido, filtrado } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const conta = (l, k) => l.reduce((t, o) => t + (o && o.k === k ? o.n || 1 : 0), 0);
ok(filtroValido({ r: [], k: [] }) === null, 'tudo marcado = sem filtro');
ok(JSON.stringify(filtroValido({ r: [1, 1, 9, 'x'], k: ['couro', 'pocao', 'nada'] })) === '{"r":[1],"k":["couro"]}', 'só raridade e recurso que existem');
const p = { filtro: { r: [0], k: ['couro'] } };
ok(filtrado(p, { k: 'espada', r: 0 }) && !filtrado(p, { k: 'espada', r: 1 }), 'equipamento pela raridade');
ok(filtrado(p, { k: 'couro', n: 1 }) && !filtrado(p, { k: 'tecido', n: 1 }), 'recurso pela lista');
ok(!filtrado(p, { k: 'pocao', n: 1 }), 'poção sempre entra');
ok(JSON.stringify(progressoValido({ mochila: [], filtro: p.filtro }).filtro) === JSON.stringify(p.filtro), 'filtro fica gravado na conta');
ok(!('filtro' in progressoValido({ mochila: [] })), 'conta sem filtro continua sem');
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('C', 'Cris');
j.criando = false; j.morto = false;
s.item('C', { acao: 'filtro', r: [0, 1], k: ['couro', 'carne', 'fragmento'] });
ok(j.prog.filtro && j.prog.filtro.r.length === 2 && j.prog.filtro.k.length === 3, 'servidor: item/filtro grava');
const antes = j.prog.mochila.filter(Boolean).length;
const c = { tipo: 'chefe', x: j.x, z: j.z, nivel: 1 };
for (let n = 0; n < 40; n++) s.soltarDrops(c, j);
ok(conta(j.prog.mochila, 'couro') === 0 && conta(j.prog.mochila, 'fragmento') === 0, 'chefe: couro e fragmento ficam no chão');
ok(conta(j.prog.mochila, 'tecido') > 0, 'chefe: tecido (marcado) entra');
ok(!j.prog.mochila.some((o) => o && o.r === 1 && o.k !== 'tomo'), 'chefe: peça Rara desmarcada fica no chão');
ok(j.prog.mochila.filter(Boolean).length > antes, 'o resto entra');
s.item('C', { acao: 'filtro', r: [], k: [] });
ok(!j.prog.filtro, 'tudo marcado de novo: sem filtro');
for (let n = 0; n < 10; n++) s.soltarDrops(c, j);
ok(conta(j.prog.mochila, 'couro') > 0, 'sem filtro o couro volta a entrar');

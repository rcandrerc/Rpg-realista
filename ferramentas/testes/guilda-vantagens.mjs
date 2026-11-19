// Vantagens fixas por rank da Guilda (Presidente 2026-11-19, aprovadas no lugar do André): valem sem equipar título e
// somam subindo. E +1 contrato por dia (sem XP), D conserto -10%, C 4 contratos de uma vez, B Voltar à Guilda grátis
// 1x por hora, A trocar 1 contrato por dia, S +5% de ouro de pack, SS marca no nome. Desligadas antes de
// GUILDA.vantagensDesde. Uso: node ferramentas/testes/guilda-vantagens.mjs
import { Simulacao, MAPA_CLAREIRA, GUILDA, progressoValido } from '../../shared/index.js';
import { vantagensGuilda, premioGuilda } from '../../shared/guilda.js';
import { consertarTudo, comDesconto } from '../../shared/progresso.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

// a tabela
const V = (r) => vantagensGuilda(r, '2026-12-01');
ok(V(0).extra === 0 && V(0).ativos === 3 && !V(0).voltar, 'rank F: nada a mais');
ok(V(1).extra === 1 && V(1).conserto === 0, 'rank E: +1 contrato');
ok(V(2).conserto === 0.10 && V(2).extra === 1, 'rank D: conserto -10% (e mantém o do E)');
ok(V(3).ativos === 4, 'rank C: 4 de uma vez');
ok(V(4).voltar === 3600, 'rank B: Voltar à Guilda, 1 h');
ok(V(5).troca === 1, 'rank A: 1 troca por dia');
ok(V(6).pack === 0.05, 'rank S: +5% de pack');
ok(V(7).marca === 1 && V(7).pack === 0.05 && V(7).extra === 1 && V(7).ativos === 4, 'rank SS: marca e todas as anteriores');
ok(vantagensGuilda(7, '2000-01-01').extra === 0 && vantagensGuilda(7, '2000-01-01').marca === 0, 'antes de vantagensDesde: desligadas');
ok(comDesconto(100, 0.1) === 90 && comDesconto(1, 0.1) === 1 && comDesconto(0, 0.1) === 0, 'desconto: arredonda para cima e nunca zera');

let relogio = Date.UTC(2026, 10, 20, 12, 0);
const s = new Simulacao(MAPA_CLAREIRA); s.relogioMs = () => relogio;
const j = s.adicionarJogador('A', 'Ana', undefined, { conta: 9 });
j.criando = false; j.ciente = true;
const p = j.prog; p.nivel = 40;
const todos = []; { const ev0 = s.evento.bind(s); s.evento = (e) => { todos.push(e); return ev0(e); }; }
const avisos = () => s.eventos.filter((e) => e.t === 'aviso' && e.para === 'A').map((e) => e.texto);
const mural = s.mapa.npcs.find((n) => n.funcao === 'mural');
s.guildaInfo(j);
ok(p.guilda.of.length === GUILDA.porDia, 'rank F: 5 contratos');
const base = JSON.stringify(p.guilda.of);

// E: entra 1 contrato extra na hora, os de hoje continuam
p.guilda.r = 1;
let info = s.guildaInfo(j);
ok(p.guilda.of.length === GUILDA.porDia + 1 && JSON.stringify(p.guilda.of.slice(0, GUILDA.porDia)) === base, 'rank E: +1 contrato e os 5 de hoje não mudam');
const X = p.guilda.of.at(-1);
ok(X.x === 1 && info.l.at(-1).x === 1, 'o extra vem marcado (sem XP)');
// o extra paga ouro e pontos, sem XP
j.x = mural.x + 2; j.z = mural.z;
s.guilda('A', { acao: 'aceitar', id: X.id });
p.guilda.at[X.id] = X.n;
const ouro0 = p.ouro, xp0 = p.xp, nv0 = p.nivel, pg0 = p.guilda.pg, pr = premioGuilda(1, p.nivel);
s.guilda('A', { acao: 'receber', id: X.id });
ok(p.ouro === ouro0 + pr.ouro && p.xp === xp0 && p.nivel === nv0 && p.guilda.pg === pg0 + pr.pg, 'contrato extra: ouro e pontos, XP nenhum');
// a conta guarda o extra
const g2 = progressoValido(JSON.parse(JSON.stringify(p))).guilda;
ok(g2.of.length === GUILDA.porDia + 1 && g2.of.at(-1).x === 1, 'a conta guarda o contrato extra');

// C: 4 de uma vez
p.guilda.r = 3; p.guilda.at = {}; p.guilda.f = []; s.eventos = [];
for (const O of p.guilda.of) s.guilda('A', { acao: 'aceitar', id: O.id });
ok(Object.keys(p.guilda.at).length === 4 && avisos().some((t) => t.includes('No máximo 4')), 'rank C: pega 4 de uma vez');
ok(Object.keys(progressoValido(JSON.parse(JSON.stringify(p))).guilda.at).length === 4, 'a conta guarda os 4');

// A: troca um contrato livre, 1 vez por dia
p.guilda.r = 5; s.guildaInfo(j); p.guilda.at = {}; s.eventos = [];
const T = p.guilda.of[0];
s.guilda('A', { acao: 'trocar', id: T.id });
ok(p.guilda.tr === 1 && avisos().some((t) => t.startsWith('Contrato trocado')) && p.guilda.of[0].id === T.id, 'rank A: trocou o contrato (mesmo lugar)');
s.eventos = [];
s.guilda('A', { acao: 'trocar', id: p.guilda.of[1].id });
ok(p.guilda.tr === 1 && avisos().some((t) => t.includes('já usada')), 'a segunda troca do dia não vale');
p.guilda.r = 4; p.guilda.tr = 0; s.eventos = [];
s.guilda('A', { acao: 'trocar', id: p.guilda.of[1].id });
ok(!p.guilda.tr && avisos().some((t) => t.includes('Rank A')), 'rank B: ainda não troca');

// B: Voltar à Guilda (canaliza, chega na frente do mural, recarga de 1 h)
p.guilda.r = 4; j.x = 0; j.z = 0; j.chao = true; s.eventos = [];
s.guilda('A', { acao: 'voltar' });
ok(j.vila?.guilda, 'rank B: começou a canalizar');
for (let t = 0; t < 60; t++) s.passo(0.1);
ok(Math.hypot(j.x - mural.x, j.z - mural.z) < GUILDA.perto && s.pertoDaGuilda(j), `chegou na Guilda (${j.x.toFixed(1)}, ${j.z.toFixed(1)})`);
ok(todos.some((e) => e.t === 'vila' && e.fase === 'chegou' && e.guilda), 'o app recebe a chegada da Guilda');
ok(p.guilda.vt > Date.now() + 3500e3, 'recarga de 1 h');
j.x = 0; j.z = 0; s.eventos = [];
s.guilda('A', { acao: 'voltar' });
ok(!j.vila && avisos().some((t) => t.includes('pronto em')), 'na recarga não volta');
ok(progressoValido(JSON.parse(JSON.stringify(p))).guilda.vt === p.guilda.vt, 'a conta guarda a recarga');
p.guilda.r = 3; p.guilda.vt = 0; s.eventos = [];
s.guilda('A', { acao: 'voltar' });
ok(!j.vila && avisos().some((t) => t.includes('Rank B')), 'rank C: ainda não volta');

// D: conserto mais barato (o mesmo cálculo do servidor)
p.guilda.r = 2;
ok(s.vantagensDe(j).conserto === 0.10, 'rank D: o servidor dá o desconto');
p.ouro = 1e6; p.equip.corpo = { k: 'peitoral', r: 3, d: 0 };
const c1 = consertarTudo(JSON.parse(JSON.stringify(p))), c2 = consertarTudo(JSON.parse(JSON.stringify(p)), 0.10);
ok(c1?.custo > 0 && c2.custo === comDesconto(c1.custo, 0.1) && c2.custo < c1.custo, `conserto: ${c1?.custo} vira ${c2?.custo}`);

// SS: marca no nome para todos
p.guilda.r = 7;
const eu = s.foto().jogadores.find((o) => o.id === 'A');
ok(eu?.gss === 1, 'rank SS: a marca vai para os outros');
ok(s.guildaInfo(j).v.marca === 1, 'rank SS: o app sabe da marca');

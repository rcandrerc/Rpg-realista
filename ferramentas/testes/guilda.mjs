// Guilda dos Aventureiros (André 2026-11-18): abre no Nv 30, o mural oferece 5 contratos por dia (os mesmos ao sair e
// entrar), pega até 3 perto do mural ou da Brenda, a caça só conta monstro da faixa, "Receber" paga ouro + XP + pontos,
// pontos cheios + nível liberam a Prova, o elite vermelho aparece no campo da faixa e vencer sobe o rank (com título),
// a conta guarda tudo (progressoValido) e o dia vira à meia-noite de Brasília.
// Uso: node ferramentas/testes/guilda.mjs
import './_missoes-ligadas.mjs'; // missões desligadas no jogo (André 2026-11-27): o motor delas segue testado ligado
import { Simulacao, MAPA_CLAREIRA, GUILDA, TITULOS, progressoValido } from '../../shared/index.js';
import { ofertasGuilda, premioGuilda, textoContrato } from '../../shared/guilda.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

let relogio = Date.UTC(2026, 10, 18, 12, 0);
const s = new Simulacao(MAPA_CLAREIRA); s.relogioMs = () => relogio;
const j = s.adicionarJogador('A', 'Ana', undefined, { conta: 9 });
j.criando = false; j.ciente = true;
const p = j.prog; p.nivel = 31;
const avisos = () => s.eventos.filter((e) => e.t === 'aviso' && e.para === 'A').map((e) => e.texto);
const brenda = s.mapa.npcs.find((n) => n.id === 'v_brenda'), mural = s.mapa.npcs.find((n) => n.id === 'v_mural_guilda');
ok(brenda && mural && brenda.funcao === 'guilda' && mural.funcao === 'mural', 'Brenda e o mural estão no Rio Claro');
ok(Math.hypot(brenda.x + 234, brenda.z - 85) < 40, `perto da praça do Rio Claro (${brenda.x}, ${brenda.z})`);
ok(GUILDA.ranks.map((R) => R.r).join('') === 'FEDCBASSS' && GUILDA.ranks.every((R, i) => !i || R.nv > GUILDA.ranks[i - 1].nv), '8 ranks de F a SS, nível subindo');
ok(Object.keys(TITULOS).filter((k) => k.startsWith('guilda_')).length === 7, 'um título por rank (E a SS)');

// abaixo do nível: nada
p.nivel = 20; ok(s.guildaInfo(j) === null, 'Nv 20: sem Guilda'); p.nivel = 31;
const info = () => s.guildaInfo(j), C = (id) => info().l.find((c) => c.id === id);
ok(info().rank === 'F' && info().l.length === GUILDA.porDia, `Nv 31: rank F e ${GUILDA.porDia} contratos`);
const of1 = JSON.stringify(p.guilda.of);
ok(JSON.stringify(ofertasGuilda(`${j.conta ?? j.id}:${p.guilda.d}:0`, 0, 31)) === of1, 'as ofertas do dia são sempre as mesmas para a conta');
ok(p.guilda.of.every((O) => O.k !== 'elite' && O.k !== 'pack'), 'rank F: sem elite nem pack');

// longe do mural não pega
j.x = 0; j.z = 0; s.eventos = [];
const caca = p.guilda.of.find((O) => O.k === 'caca');
s.guilda('A', { acao: 'aceitar', id: caca.id });
ok(!(caca.id in p.guilda.at) && avisos().some((t) => t.includes('mural')), 'longe do mural: não pega');
// perto do mural pega até 3
j.x = mural.x + 2; j.z = mural.z; s.eventos = [];
for (const O of p.guilda.of) s.guilda('A', { acao: 'aceitar', id: O.id });
ok(Object.keys(p.guilda.at).length === GUILDA.ativos && avisos().some((t) => t.includes('No máximo')), `pega só ${GUILDA.ativos} de uma vez`);
ok(caca.id in p.guilda.at && C(caca.id).e === 'ativo', 'o de caça está pego');

// caça: monstro abaixo da faixa não conta, da faixa conta
s.historia(j, 'matar', { nivel: 5 });
ok(p.guilda.at[caca.id] === 0, 'monstro Nv 5 não conta');
for (let i = 0; i < caca.n; i++) s.historia(j, 'matar', { nivel: 30 });
ok(C(caca.id).e === 'feito', `${caca.n} monstros Nv 30: contrato feito`);

// receber paga ouro, XP e pontos (de qualquer lugar)
j.x = 0; j.z = 0; s.eventos = [];
const ouro0 = p.ouro, xp0 = p.xp, nv0 = p.nivel, pr = premioGuilda(0, p.nivel);
s.guilda('A', { acao: 'receber', id: caca.id });
ok(p.ouro === ouro0 + pr.ouro && (p.xp > xp0 || p.nivel > nv0) && p.guilda.pg === pr.pg, `recebeu longe: +${pr.ouro} ouro, XP e +${pr.pg} pontos`);
ok(C(caca.id).e === 'recebido', 'fica como recebido');
s.guilda('A', { acao: 'receber', id: caca.id });
ok(p.ouro === ouro0 + pr.ouro, 'não recebe duas vezes');
// pegou outro no lugar do recebido (volta a ter vaga)
j.x = mural.x + 2; j.z = mural.z;
const livre = p.guilda.of.find((O) => !(O.id in p.guilda.at) && !p.guilda.f.includes(O.id));
s.guilda('A', { acao: 'aceitar', id: livre.id });
ok(livre.id in p.guilda.at, 'recebeu um: abriu vaga para outro');
// desistir
s.guilda('A', { acao: 'desistir', id: livre.id });
ok(!(livre.id in p.guilda.at), 'desistiu: volta para o mural');

// conta guardada
const v = progressoValido(JSON.parse(JSON.stringify(p)));
ok(v.guilda && v.guilda.r === 0 && v.guilda.pg === pr.pg && v.guilda.f.includes(caca.id) && v.guilda.of.length === GUILDA.porDia, 'a conta guarda rank, pontos e contratos');
ok(progressoValido({ ...p, guilda: { r: 99, pg: -5 } }).guilda.r === GUILDA.ranks.length - 1, 'rank inválido é limitado');

// Prova: pontos cheios, mas sem o nível do E (36) não dá
p.guilda.pg = GUILDA.ranks[0].pg; s.eventos = [];
s.guilda('A', { acao: 'prova' });
ok(p.guilda.pv !== 1 && avisos().some((t) => t.includes('Nv 36')), 'Prova pede o nível do próximo rank');
p.nivel = 36;
s.guilda('A', { acao: 'prova' });
ok(p.guilda.pv === 1 && info().pv, 'Nv 36 e pontos cheios: Prova aceita');
// o elite da Prova aparece perto de um campo da faixa
const D = s.campoDaFaixa(j, null, Infinity);
ok(!!D, `há campo na faixa do Nv 36 (${D?.id} Nv ${D?.nivel})`);
j.x = D.x + 3; j.z = D.z;
for (let t = 0; t < 40 && !s.inimigos.some((e) => e.hc === 'gp:' + j.conta); t++) s.passo(0.1);
const prova = s.inimigos.find((e) => e.hc === 'gp:' + j.conta);
ok(!!prova && prova.nome === 'Prova do rank E' && prova.esc > 1, `apareceu: ${prova?.nome}`);
// vencer a Prova sobe o rank
s.eventos = [];
s.historia(j, 'matar', { hc: 'gp:' + j.conta, nivel: prova.nivel });
ok(p.guilda.r === 1 && p.guilda.pg === 0 && p.guilda.pv !== 1, 'venceu a Prova: Rank E, pontos zerados');
ok(p.tit.tem.includes('guilda_E') && avisos().some((t) => t.includes('Rank E')), 'ganhou o título Aventureiro Rank E');

// o dia vira: ofertas novas do rank E
relogio += 24 * 3600000; s.eventos = [];
ok(info().rank === 'E' && p.guilda.f.length === 0 && Object.keys(p.guilda.at).length === 0, 'dia novo: contratos novos, rank fica');
// rank C já tem elite
p.guilda.r = 3; p.nivel = 52; p.guilda.d = 'x';
ok(s.guildaDe(j).of.some((O) => O.k === 'elite'), 'rank C: aparece contrato de elite');
const el = p.guilda.of.find((O) => O.k === 'elite');
j.x = mural.x + 2; j.z = mural.z; s.guilda('A', { acao: 'aceitar', id: el.id });
s.historia(j, 'matar', { hc: 'gorduncho', nivel: 52 });
ok(p.guilda.at[el.id] === 0, 'chefe da história não conta como elite da Guilda');
s.historia(j, 'matar', { hc: 'ge:B', nivel: 52 });
ok(p.guilda.at[el.id] === 1, 'elite de alguém do time conta');
ok(textoContrato({ k: 'caca', n: 20, a: 30 }) === 'Derrube 20 monstros Nv 30+', 'texto curto do contrato');

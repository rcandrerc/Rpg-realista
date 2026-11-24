// Missões diárias (André 2026-11-16): as 4 de hoje contam com a ação de verdade (plantar, derrubar monstro, pescar,
// cortar/minerar), "Receber" paga ouro + XP uma vez só, as 4 dão o bônus, o dia vira à meia-noite de Brasília, a conta
// guarda (progressoValido), o "Ir" de cada uma leva a um lugar, e a missão da Rosa "Tarefas do dia" ensina a aba.
// Uso: node ferramentas/testes/diarias.mjs
import { Simulacao, MAPA_CLAREIRA, DIARIAS, HISTORIA, PLANTIO, QUADRADOS_PLANTIO, lugarNoQuadrado, progressoValido, contar } from '../../shared/index.js';
import { diaDiarias, fimDoDia, premioDiaria } from '../../shared/diarias.js';
import { histValida } from '../../shared/historia.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

// 2026-11-16 23:50 em Brasília = 2026-11-17 02:50 UTC
let relogio = Date.UTC(2026, 10, 17, 2, 50);
ok(diaDiarias(relogio) === '2026-11-16', `23:50 de Brasília ainda é dia 16 (${diaDiarias(relogio)})`);
ok(fimDoDia(relogio) - relogio === 10 * 60000, 'faltam 10 min para virar');
ok(diaDiarias(relogio + 10 * 60000) === '2026-11-17', 'meia-noite de Brasília vira o dia');
ok(DIARIAS.lista.length === 4 && DIARIAS.lista.some((D) => D.ev === 'arvore'), '4 diárias, uma é plantar árvore');

const s = new Simulacao(MAPA_CLAREIRA); s.relogioMs = () => relogio;
const j = s.adicionarJogador('A', 'Ana', undefined, { conta: 7 });
j.criando = false; j.ciente = true;
const p = j.prog; p.nivel = 10; p.vigor = { v: 999, t: Date.now() };
const avisos = () => s.eventos.filter((e) => e.t === 'aviso' && e.para === 'A').map((e) => e.texto);
const info = () => s.diariasInfo(j);
const conta = (id) => info().l.find((d) => d.id === id);

// abaixo do nível: nada
p.nivel = 5; s.historia(j, 'matar', {}); ok(s.diariasInfo(j) === null && !p.diarias?.n?.monstros, 'Nv 5: sem diárias'); p.nivel = 10;
ok(info().l.length === 4 && info().fim === 10 * 60000, 'Nv 10: 4 diárias e o relógio');

// 1) plantar 4 árvores de verdade numa área de plantio
for (let i = 0; i < p.mochila.length && p.mochila[i]; i++);
p.mochila[p.mochila.indexOf(null)] = { k: 'semente_betula', n: 6 };
const livres = [...QUADRADOS_PLANTIO.keys()].map((k) => k.split(',').map(Number)).filter(([i, k]) => { const l = lugarNoQuadrado(i, k); return !s.pertoNaMata(l.x, l.z).some((o) => Math.hypot(o.x - l.x, o.z - l.z) < o.r + PLANTIO.folga + 3); });
let plantou = 0;
for (const [qi, qk] of livres) {
  if (plantou >= 4) break;
  const L = lugarNoQuadrado(qi, qk); j.x = L.x; j.z = L.z - 1; j.chao = true; s.eventos = [];
  const n0 = s.plantadas.size; s.plantarArvore('A', { s: 'betula', x: L.x, z: L.z }); if (s.plantadas.size > n0) plantou++;
}
ok(plantou === 4 && conta('arvores').n === 4, `plantou 4 árvores: diária ${conta('arvores').n}/4`);
ok(s.eventos.some((e) => e.t === 'diaria' && e.id === 'arvores' && e.feita), 'aviso de diária feita');

// 2) monstros: o funil da história (matar) conta, de 1 em 1
for (let i = 0; i < 25; i++) s.historia(j, 'matar', { campo: 'caca1', tipo: 'puglin' });
ok(conta('monstros').n === 20, 'derrubar monstro conta até 20 e para');
// bots não contam
const bot = s.adicionarJogador('B', 'Bot'); bot.bot = true; bot.prog.nivel = 20; s.historia(bot, 'matar', {});
ok(!bot.prog.diarias, 'NPC/bot não tem diária');

// 3) pesca: peixe dobrado conta 2
s.historia(j, 'pesca', { k: 'lambari', n: 2 }); s.historia(j, 'pesca', { k: 'lambari', n: 1 });
ok(conta('peixes').n === 3, 'pesca conta os peixes (2 + 1)');

// 4) corte/minério: batida de verdade numa árvore nativa; galho no chão não conta
{
  p.mochila[p.mochila.indexOf(null)] = { k: 'machado', n: 1 };
  const no = [...s.coletaveis.values()].find((o) => o.tipo === 'arvore' && !o.plantada);
  j.x = no.x + 1; j.z = no.z; s.proximaBatida(j, no); s.batidaColeta(j);
  ok(conta('coleta').n === 1, 'uma machadada numa árvore conta 1');
  s.contarDiaria(j, 'coleta', { tipo: 'galho' });
  ok(conta('coleta').n === 1, 'galho no chão não conta');
}

// Receber
const ouro0 = p.ouro, pr = premioDiaria(p.nivel);
s.eventos = []; s.diaria('A', { acao: 'receber', id: 'peixes' });
ok(p.ouro === ouro0 && avisos().some((t) => /Falta/.test(t)), 'não recebe a que falta: ' + avisos());
s.eventos = []; s.diaria('A', { acao: 'receber', id: 'arvores' });
ok(p.ouro === ouro0 + pr.ouro && conta('arvores').r, `recebeu ${pr.ouro} ouro (Nv 10) + ${pr.xp} XP: ${avisos()}`);
ok(pr.ouro === 60, 'Nv 10 paga 60 de ouro, como na proposta');
s.diaria('A', { acao: 'receber', id: 'arvores' });
ok(p.ouro === ouro0 + pr.ouro, 'não recebe duas vezes');
ok(s.eventos.some((e) => e.t === 'prog' && e.para === 'A' && e.di?.l?.length === 4), 'o progresso leva o resumo das diárias para o app');

// as 4 = bônus
s.historia(j, 'pesca', { k: 'lambari', n: 5 });
for (let i = 0; i < 20; i++) s.contarDiaria(j, 'coleta', { tipo: 'pedra' });
for (const id of ['monstros', 'peixes']) s.diaria('A', { acao: 'receber', id });
const ouro1 = p.ouro; s.diaria('A', { acao: 'receber', id: 'coleta' });
ok(p.ouro === ouro1 + premioDiaria(p.nivel).ouro + DIARIAS.bonus && info().b, 'as 4 recebidas: bônus de 100');

// a conta guarda (servidor reinicia) e o dia de antes não volta
const salvo = JSON.parse(JSON.stringify(p));
const v = progressoValido(salvo);
ok(v.diarias?.d === '2026-11-16' && v.diarias.r.length === 4 && v.diarias.b === 1, 'progressoValido guarda as diárias de hoje');
ok(progressoValido({ ...salvo, diarias: { d: 'lixo', n: { x: 9 } } }).diarias === undefined, 'diárias ruins somem');

// vira o dia
relogio += 11 * 60000;
ok(info().l.every((d) => d.n === 0 && !d.r) && !info().b && p.diarias.d === '2026-11-17', 'meia-noite: as 4 zeram');

// Ir de cada uma
for (const D of DIARIAS.lista) {
  s.eventos = []; j.x = 0; j.z = 0; s.diaria('A', { acao: 'ir', id: D.id });
  const e = s.eventos.find((x) => x.t === 'diaria_ir');
  ok(e && Number.isFinite(e.alvo.x) && Number.isFinite(e.alvo.z) && e.alvo.nome, `Ir de "${D.txt}" leva a ${e?.alvo?.nome} (${e?.alvo?.x}, ${e?.alvo?.z})`);
}
{ const e = (s.eventos = [], s.diaria('A', { acao: 'ir', id: 'arvores' }), s.eventos.find((x) => x.t === 'diaria_ir')); const [i, k] = [Math.floor(e.alvo.x / PLANTIO.quadrado), Math.floor(e.alvo.z / PLANTIO.quadrado)];
  ok(QUADRADOS_PLANTIO.has(i + ',' + k), 'o Ir do plantio cai dentro de uma área de plantio'); }

// história: "Tarefas do dia" (Rosa) logo depois de "Mercadoria salva"
{
  const i = HISTORIA.findIndex((M) => M.id === 'd1');
  ok(i > 0 && HISTORIA[i - 1].id === 'a14' && HISTORIA[i].npc === 'comerciante', 'missão da Rosa depois de "Mercadoria salva"');
  // conta que estava no meio da a15 antes da d1 entrar (u = a14, sem at): começa a d1 do zero, sem herdar a etapa
  const h = histValida({ v: 2, p: i, ac: true, e: 1, n: 1, m: 0, u: 'a14' }, 12);
  ok(h.p === i && h.ac === false && h.e === 0, 'quem estava na a15 não herda a etapa na missão nova');
  const ia = HISTORIA.findIndex((M) => M.id === 'a15'); // depois da d1 vem a k1 (Ato do Clã, 2026-11-24) e então a a15
  const h2 = histValida({ v: 2, p: ia, ac: true, e: 1, n: 0, m: 0, u: HISTORIA[ia - 1].id, at: 'a15' }, 12);
  ok(h2.ac && h2.e === 1 && h2.at === 'a15', 'missão aceita com at continua');
  // joga: aceita com a Rosa, abre a aba, faz uma diária, volta
  const t = new Simulacao(MAPA_CLAREIRA); t.relogioMs = () => relogio;
  const r = t.adicionarJogador('R', 'Rui', undefined, { conta: 8 }); r.criando = false;
  r.prog.nivel = 12; r.prog.hist = { v: 2, p: i, ac: false, e: 0, n: 0, m: 0, u: 'a14' };
  const rosa = MAPA_CLAREIRA.npcs.find((n) => n.id === 'comerciante');
  t.falaHistoria(r, rosa, () => {}, true);
  ok(r.prog.hist.ac && r.prog.hist.at === 'd1' && contar(r.prog.mochila, 'semente_betula') === 4, 'aceitou e ganhou 4 sementes de bétula');
  t.historia(r, 'matar', {}); ok(r.prog.hist.e === 0, 'matar não abre a aba');
  t.diaria('R', { acao: 'ver' }); ok(r.prog.hist.e === 1, 'abrir a aba Diárias conta');
  for (let k = 0; k < 4; k++) t.historia(r, 'arvore', {});
  ok(r.prog.hist.e === 2, 'terminar 1 diária conta');
  t.falaHistoria(r, rosa, () => {}, true);
  ok(r.prog.hist.p === i + 1, 'entregou para a Rosa');
  // já tinha feito uma diária hoje antes de aceitar: abrir a aba já passa as duas etapas
  const r2 = t.adicionarJogador('R2', 'Lia', undefined, { conta: 9 }); r2.criando = false;
  r2.prog.nivel = 12; r2.prog.hist = { v: 2, p: i, ac: false, e: 0, n: 0, m: 0, u: 'a14' };
  for (let k = 0; k < 5; k++) t.historia(r2, 'pesca', { n: 1 });
  t.falaHistoria(r2, rosa, () => {}, true); t.diaria('R2', { acao: 'ver' });
  ok(r2.prog.hist.e === 2, 'diária feita antes de aceitar: a etapa já conta ao abrir a aba');
}

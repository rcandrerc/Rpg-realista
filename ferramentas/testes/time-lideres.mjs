// Time entre líderes de clã (André 2026-11-27: "dar time pros líderes de clã da mesma raça ... o Dário, se ele tiver
// afim ... minha filha ou meu irmão"; cada líder com os recrutas dele; a barra agrupa por clã). shared/time-clas.js
// Uso: node ferramentas/testes/time-lideres.mjs
import { Simulacao, MAPA_CLAREIRA, CLAS_NPC, CLA, TIME } from '../../shared/index.js';
import { sortearRecruta } from '../../shared/cla.js';
import './_relogio-fixo.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

const s = new Simulacao(MAPA_CLAREIRA);
const rec = s.mapa.npcs.find((n) => n.funcao === 'recrutador');
const lider = (id, nome, conta, cla) => {
  const j = s.adicionarJogador(id, nome, undefined, { conta }); j.criando = false; j.ciente = true;
  j.prog.nivel = 20; j.prog.ouro = 90000; j.x = rec.x + 1; j.z = rec.z;
  s.cla(id, { acao: 'fundar', nome: cla }); j.prog.cla.nv = 6;
  return j;
};
const A = lider('A', 'Yukmei', 501, 'Brasil'), F = lider('F', 'Filha', 502, 'Rosas');
for (const j of [A, F]) for (let i = 0; i < 2; i++) s.cla(j.id, { acao: 'recrutar', tier: 'veterano' });
A.amigos.set(F.conta, F.nome); F.amigos.set(A.conta, A.nome);
const meus = (j) => s.recrutasNoMundo(j).filter((x) => x.amiga);
const juntar = (j) => { for (const x of meus(j)) { x.amiga.x = j.x + 1; x.amiga.z = j.z; s.time(j.id, { acao: 'convidar', com: x.amiga.id }); } };
juntar(A); juntar(F);
ok(meus(A).length === 2 && meus(F).length === 2, 'cada líder com 2 recrutas');
ok(A.time && A.time.membros.length === 3 && F.time && F.time.membros.length === 3 && A.time !== F.time, 'dois times, cada um do seu clã');
ok(s.timeSoDoCla(F) && s.timeSoDoCla(A), 'time só do clã: pode levar todos');

// 1) a filha entra no time do André levando os recrutas
const avisos = (f) => { s.eventos = []; f(); return s.eventos.filter((e) => e.t === 'aviso').map((e) => e.texto); };
avisos(() => s.time('A', { acao: 'convidar', com: F.id }));
ok(F.conviteTime?.de === 'A', 'convite chegou para a líder que já tem time com os recrutas');
const av1 = avisos(() => s.time('F', { acao: 'aceitar', com: A.id }));
const T = A.time;
ok(T && F.time === T && T.membros.length === 6 && meus(F).every((x) => x.amiga.time === T), `ela entrou com os 2 recrutas (${av1.join(' | ')})`);
ok(s.times.size === 1, 'o time velho dela some');
const gs = s.gruposDoTime(T);
ok(gs.size === 2 && gs.get('c:' + A.conta) === 3 && gs.get('c:' + F.conta) === 3, `um grupo por clã: ${JSON.stringify([...gs])}`);
s.eventos = []; s.enviarTime(T);
const est = s.eventos.find((e) => e.t === 'time' && e.fase === 'estado' && e.para === 'A');
ok(est?.grupos?.length === 2 && est.grupos.some((g) => g.g === 'c:' + F.conta && g.nome === 'Filha' && g.cla === 'Rosas' && g.lid === 'F'), `barra recebe os grupos: ${JSON.stringify(est?.grupos)}`);
ok(est.membros.every((t) => t.g === 'c:' + A.conta || t.g === 'c:' + F.conta), 'cada membro com o grupo dele');
// recrutas dela seguem ela (o dono está no time): continuam no time depois de alguns passos
for (let i = 0; i < 20; i++) s.passo(0.1);
ok(meus(F).every((x) => x.amiga.time === T) && meus(A).every((x) => x.amiga.time === T), 'depois de andar, todo mundo continua no time');

// 2) limite por clã (TIME.max cada): o André chega a 5 do clã dele, o 6º não entra
for (let i = 0; i < 3; i++) s.cla('A', { acao: 'recrutar', tier: 'veterano' });
const sobra = meus(A).filter((x) => x.amiga.time !== T);
const avL = [];
for (const x of sobra) { x.amiga.x = A.x + 1; x.amiga.z = A.z; avL.push(...avisos(() => s.time('A', { acao: 'convidar', com: x.amiga.id }))); }
ok(s.gruposDoTime(T).get('c:' + A.conta) === TIME.max && avL.some((t) => t === `Cada clã leva até ${TIME.max} no time`), `5 do clã dele, o resto fica fora: ${avL.at(-1)}`);

// 3) "Time todo" do André: os recrutas da filha não obedecem (só o líder deles manda)
for (const x of [...meus(A), ...meus(F)]) x.amiga.ia.ordem = null;
s.tempo += 10; s.comandoTime('A', { para: '*', c: 'espera' });
ok(meus(A).filter((x) => x.amiga.time === T).every((x) => x.amiga.ia.ordem?.tipo === 'espera') && meus(F).every((x) => !x.amiga.ia.ordem), 'Time todo: só os recrutas dele');
const fx = meus(F)[0].amiga; s.tempo += 10;
const avC = avisos(() => s.comandoTime('A', { para: fx.id, c: 'espera' }));
ok(!fx.ia.ordem && avC.some((t) => t.endsWith('obedece só ao líder do clã dele')), `comando no recruta dela: ${avC.join(' | ')}`);

// 4) a filha sai: os recrutas saem junto, num time com ela; o do André continua
avisos(() => s.time('F', { acao: 'sair' }));
ok(F.time && F.time !== T && F.time.membros.length === 3 && meus(F).every((x) => x.amiga.time === F.time), 'ela saiu levando os recrutas');
ok(A.time === T && T.membros.every((k) => s.grupoTime(s.jogadores.get(k)) === 'c:' + A.conta), 'o time do André fica só com o clã dele');

// 5) XP: o bônus do time para em +40% (o de 5 pessoas), por maior que fique
ok(TIME.bonusMax === 4 && TIME.bonus * Math.min(TIME.bonusMax, 9) === TIME.bonus * 4, 'bônus de XP com teto de 4 colegas');

// 6) o Dario (líder de clã bot da Chama): topa com líder de clã; sem clã, recusa dizendo o motivo
s.carregarClasNpc(null);
for (const ctx of s.amigosIa) ctx.amigaEntrar?.('A', false);
const dario = s.amigosIa.find((x) => x.AMIGA.id === 'dario'), d = dario.amiga;
const Q = s.adicionarJogador('Q', 'Quim', undefined, { conta: 503 }); Q.criando = false; Q.x = d.x + 1; Q.z = d.z;
const avQ = avisos(() => s.time('Q', { acao: 'convidar', com: d.id }));
ok(!d.time && avQ.some((t) => t.startsWith('Dario só faz time com líder de clã')), `sem clã: ${avQ.join(' | ')}`);
ok(!dario.semTimeAmiga(), 'o botão de time do Dario volta');
F.x = d.x + 1; F.z = d.z; for (const x of meus(F)) { x.amiga.x = d.x + 2; x.amiga.z = d.z; }
const avD = avisos(() => s.time('F', { acao: 'convidar', com: d.id }));
ok(d.time && d.time === F.time && s.grupoTime(d) === 'b:dario', `líder de clã: o Dario entra (${avD.join(' | ')})`);
// escolta: os recrutas do clã dele que protegem ele aparecem no grupo dele (sem virar membro)
const C = CLAS_NPC.find((K) => K.id === 'chama'), E = s.clasNpc.chama;
for (let i = 0; i < 2; i++) { const m = sortearRecruta(Math.random, CLA.tiers[0], 10, Date.now()); E.m.push(m); s.criarRecrutaNpc(C, m, true); }
for (const m of E.m) { m.fn = { k: 'proteger', p: 'lider' }; const b = s.amigosIa.find((x) => x.AMIGA.id === m.id)?.amiga; if (b) { b.x = d.x + 1; b.z = d.z + 1; } }
s.eventos = []; s.enviarTime(F.time);
const eD = s.eventos.find((e) => e.t === 'time' && e.fase === 'estado' && e.para === 'F');
const esc = eD.membros.filter((t) => t.esc);
ok(esc.length >= 1 && esc.length <= TIME.max - 1 && esc.every((t) => t.g === 'b:dario'), `escolta do Dario no grupo dele: ${esc.length}`);
ok(eD.grupos?.some((g) => g.g === 'b:dario' && g.cla === 'Guarda da Chama'), 'grupo do Dario com o nome do clã');
ok(F.time.membros.length === 4, 'escolta não conta como membro');
const escB = s.amigosIa.find((x) => x.amiga && x.AMIGA.clanpc === 'chama')?.amiga;
ok(escB && s.timeDaEscolta(escB) === F.time, 'escolta ganha XP como o time dele');
// as ordens do líder bot: no time, até TIME.max - 1 recrutas vão proteger ele
for (const m of E.m) m.fn = { k: 'grind' };
const ctxs = s.amigosIa.filter((x) => x.amiga && x.AMIGA.clanpc === 'chama');
s.ordensLiderNpc(C, E, d, ctxs, false, () => 0.5);
ok(E.m.filter((m) => m.fn?.k === 'proteger' && m.fn.p === 'lider').length === Math.min(E.m.length, TIME.max - 1), 'no time, o Dario chama os recrutas para protegê-lo');

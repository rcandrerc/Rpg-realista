// Soldado de outro líder nunca entra no time do jogador (André 2026-11-22, NPC_SOLDADO) e diz o motivo certo (André
// 2026-11-25, "não no mesmo time"). Na ronda de 25/11 o Dario recusou duas vezes e, depois de um "por favor", disse
// "Desse jeito não tem como negar. Bora, manda o time.": o apelo somava 45% de chance em cima da vontade 0 do soldado, o
// combinado valia, e o botão Time punha o Dario no time. E o recruta de clã bot quebrava ao recusar pelo chat (as falas
// dele são só o nome de quem ele copia na guerra).
// Uso: node ferramentas/testes/soldado-time.mjs
import { Simulacao, MAPA_CLAREIRA, CLAS_NPC, CLA, HISTORIA, NPC_SOLDADO } from '../../shared/index.js';
import { sortearRecruta } from '../../shared/cla.js';
import { humorTime } from '../../server/ia-amiga.js';
import './_relogio-fixo.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

ok(NPC_SOLDADO.ligado, 'modo soldado ligado (o padrão do jogo)');
const s = new Simulacao(MAPA_CLAREIRA);
const q = s.adicionarJogador('Q', 'Quim', undefined, { conta: 12 }); q.criando = false;
s.carregarClasNpc(null);
for (const ctx of s.amigosIa) ctx.amigaEntrar('Q', false);
const ctxDe = (id) => s.amigosIa.find((x) => x.AMIGA.id === id);
const dario = ctxDe('dario'), a = dario.amiga;
const perto = (o) => Object.assign(q, { x: o.x + 1, z: o.z });
const noTime = (x) => !!(x.time && x.time === q.time);
const avisos = (f) => { s.eventos = []; f(); return s.eventos.filter((e) => e.t === 'aviso' && e.para === 'Q').map((e) => e.texto); };
const fala = (x, f) => { const b = x.amiga; b.ia.captura = []; try { f(); return b.ia.captura.join(' '); } finally { b.ia.captura = null; } };
perto(a);

// 1) pelo chat: recusa dizendo que é líder do clã, e a fala é a do jogo (a da IA prometia o time)
const t1 = fala(dario, () => dario.respostaAmiga('Q', { assunto: 'time', fala: 'Bora, manda o time.' }));
ok(/líder do clã Guarda da Chama/.test(t1) && !/manda o time/i.test(t1), `Dario recusa o time dizendo o motivo: "${t1}"`);
ok(dario.vontadeAmiga(a, q).p === 0 && dario.vontadeAmiga(a, q).motivo === 'lider', 'vontade 0, motivo "lider"');

// 2) "por favor" depois do não, com toda a sorte do mundo: continua não, e nada fica combinado
dario.chatDeAmiga(q).push({ de: 'ele', texto: 'por favor, preciso da sua ajuda' });
const rnd = Math.random; Math.random = () => 0;
const t2 = fala(dario, () => dario.respostaAmiga('Q', { assunto: 'conversa', fala: 'Tá bom, bora.' }));
ok(!dario.combinouAmiga(a) && /líder do clã Guarda da Chama/.test(t2), `"por favor" não combina o time e ele repete o motivo: "${t2}"`);
ok(!dario.apeloAmiga(a, q), 'um apelo por recusa: o próximo "por favor" segue a conversa normal');
// 3) o botão Time: aviso com o motivo, e ele não entra (nem com combinado de antes da regra)
a.ia.combinado = s.tempo + 300;
const av3 = avisos(() => s.time('Q', { acao: 'convidar', com: a.id }));
ok(!noTime(a) && av3.some((t) => t === 'Dario é líder do clã Guarda da Chama e não entra no time de ninguém'), `botão Time: ${av3.join(' | ')}`);
// 4) pescar junto é entrar no time
const t4 = fala(dario, () => dario.respostaAmiga('Q', { assunto: 'pescar' }));
ok(!noTime(a) && !q.conviteTime && /líder do clã/.test(t4), `pescar junto também não: "${t4}"`);
// 5) conversa por opções (botão "Entra no meu time?")
s.eventos = []; dario.conversaAmiga('Q', { acao: 'time', deLonge: true });
const t5 = s.eventos.filter((e) => e.t === 'fala' && e.para === 'Q').map((e) => e.texto).join(' ');
ok(!noTime(a) && /líder do clã Guarda da Chama/.test(t5), `opção "Entra no meu time?": "${t5}"`);
// 6) na etapa de time da história ("Chame o Dario (ou um jogador) para o time") ele também não entra; o aviso diz o que fazer
const iM = HISTORIA.findIndex((M) => M.id === 'c5'), eT = HISTORIA[iM].etapas.findIndex((E) => E.ev === 'time');
q.prog.hist = { ...(q.prog.hist || {}), p: iM, e: eT, ac: true };
const av6 = avisos(() => s.time('Q', { acao: 'convidar', com: a.id }));
ok(!noTime(a) && av6.some((t) => t.endsWith('Para a missão, chame um recruta seu ou um amigo')), `etapa de time da história: ${av6.join(' | ')}`);
Math.random = rnd;
// 7) a ficha da IA: nunca entra, com o motivo de verdade (antes o combinado dizia "falta mandar o convite")
const h = dario.contextoAmiga('Q').humor;
ok(h && h.aceita === false && h.sempre && h.motivo === 'lider' && h.cla === 'Guarda da Chama', `ficha da IA: ${JSON.stringify(h)}`);
const tIa = humorTime({ humor: h, amigo: 'Quim', genero: 'm' });
ok(/NUNCA entra no time de Quim/.test(tIa) && /líder do clã Guarda da Chama/.test(tIa) && !/motivo diferente/.test(tIa), 'a IA recusa com esse motivo, sem inventar outro');

// 8) membro fixo do clã (Lia) e recruta do clã bot: motivo "cla", sem quebrar
const lia = ctxDe('lia');
if (lia?.amiga) {
  perto(lia.amiga);
  const t8 = fala(lia, () => lia.respostaAmiga('Q', { assunto: 'time' }));
  ok(lia.foraDoTimeAmiga(q) === 'cla' && /Sou do clã Guarda da Chama/.test(t8), `Lia (membro fixo): "${t8}"`);
}
const C = CLAS_NPC.find((K) => K.id === 'chama'), E = s.clasNpc.chama;
const m = sortearRecruta(Math.random, CLA.tiers[0], 10, Date.now()); E.m.push(m); s.criarRecrutaNpc(C, m, true);
const rx = s.amigosIa.find((x) => x.AMIGA.clanpc === 'chama' && x.amiga);
ok(rx && typeof rx.AMIGA.falas === 'string', 'recruta do clã bot (falas = nome de quem copia na guerra)');
perto(rx.amiga);
let t9 = '', erro = '';
try { t9 = fala(rx, () => rx.respostaAmiga('Q', { assunto: 'time' })); } catch (e) { erro = e.message; }
ok(!erro && /Sou do clã Guarda da Chama/.test(t9), `recruta do clã bot recusa sem quebrar: "${t9 || erro}"`);
const av9 = avisos(() => s.time('Q', { acao: 'convidar', com: rx.amiga.id }));
ok(!noTime(rx.amiga) && av9.some((t) => t.startsWith(`${rx.AMIGA.nome} é do clã Guarda da Chama e só anda com o clã`)), `botão Time no recruta do clã bot: ${av9.join(' | ')}`);

// 9) o recruta do próprio jogador continua entrando no time dele
{
  const s2 = new Simulacao(MAPA_CLAREIRA);
  const L = s2.adicionarJogador('L', 'Lia Líder', undefined, { conta: 20 }); L.criando = false; L.ciente = true;
  L.prog.nivel = 20; L.prog.ouro = 50000;
  const r = s2.mapa.npcs.find((n) => n.funcao === 'recrutador'); L.x = r.x + 1; L.z = r.z;
  s2.cla('L', { acao: 'fundar', nome: 'Teste Time' }); L.prog.cla.nv = 6;
  s2.cla('L', { acao: 'recrutar', tier: 'veterano' });
  const x = s2.recrutasNoMundo(L)[0];
  ok(x && x.foraDoTimeAmiga(L) === '' && x.vontadeAmiga(x.amiga, L).p === 1, 'recruta do jogador: pode entrar no time do líder');
  x.amiga.x = L.x + 1; x.amiga.z = L.z;
  s2.time('L', { acao: 'convidar', com: x.amiga.id });
  ok(x.amiga.time && x.amiga.time === L.time, 'recruta entra no time do líder pelo botão');
}

// 10) a ajuda na missão dele (André 2026-11-21, "eu poder me oferecer pra ajudar") continua: ele chama o jogador para o
// time dele enquanto dura a ajuda; acabou a ajuda, a regra do clã volta
a.ia.missaoJunto = { id: 'Q', ate: s.tempo + 60, p: null };
ok(dario.foraDoTimeAmiga(q) === '', 'ajudando a missão dele: o time da ajuda vale');
a.ia.missaoJunto = { id: 'Q', ate: s.tempo - 1, p: null };
ok(dario.foraDoTimeAmiga(q) === 'lider', 'a ajuda acabou: volta a recusar');
a.ia.missaoJunto = { id: 'outro', ate: s.tempo + 60, p: null };
ok(dario.foraDoTimeAmiga(q) === 'lider', 'ajuda combinada com outro jogador não abre o time para este');
a.ia.missaoJunto = null;

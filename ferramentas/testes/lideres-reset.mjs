// Dois clãs da Geada (Gael e Kael) + botão "Resetar líderes" (André 2026-11-23, LIDERES_CLA em shared/dados.js): só a
// conta do André reseta; ele, Dario, Gael e Kael vão ao nível 1; itens e ouro ficam; líder não sai quando a IA acaba.
// Uso: node ferramentas/testes/lideres-reset.mjs
import { Simulacao, MAPA_CLAREIRA, CLAS_NPC, LIDERES_CLA } from '../../shared/index.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

const geada = CLAS_NPC.filter((C) => C.raca === 'geada');
ok(geada.length === 2 && geada.some((C) => C.lider === 'gael') && geada.some((C) => C.lider === 'kael'), 'dois clãs da Geada: Gael e Kael');
ok(CLAS_NPC.some((C) => C.lider === 'dario'), 'Chama continua com o Dario');
ok(['dario', 'gael', 'kael'].every((id) => LIDERES_CLA.ids().includes(id)), 'líderes: Dario, Gael, Kael');

const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'André', undefined, { conta: 5, testador: true }); a.criando = false;
const p = s.adicionarJogador('P', 'Pedro', undefined, { conta: 11 }); p.criando = false;
s.carregarClasNpc(null);
for (const ctx of s.amigosIa) ctx.amigaEntrar('A', false);
const kael = s.amigosIa.find((x) => x.AMIGA.id === 'kael');
ok(kael?.amiga && kael.amiga.prog.nivel > 1, `Kael no mundo (nível ${kael?.amiga?.prog.nivel})`);
ok(kael.AMIGA.raca === 'geada', 'Kael é da Geada');

// conta comum não reseta
a.prog.nivel = 30; a.prog.ouro = 777;
ok(s.resetLideres('P') === false && a.prog.nivel === 30, 'outra conta não consegue resetar');

// Dario fora da sala (save): também volta ao 1
const dario = s.amigosIa.find((x) => x.AMIGA.id === 'dario');
if (dario.amiga) { dario.amiga.prog.nivel = 50; }
s.amigosIa.find((x) => x.AMIGA.id === 'gael').amiga.prog.nivel = 60;
kael.amiga.prog.nivel = 55;
ok(s.resetLideres('A') === true, 'André reseta');
ok(a.prog.nivel === 1 && a.prog.xp === 0 && a.prog.ouro === 777, 'André no nível 1, ouro fica');
for (const id of ['dario', 'gael', 'kael']) {
  const x = s.amigosIa.find((o) => o.AMIGA.id === id), nv = x.amiga ? x.amiga.prog.nivel : s.npcSalvos.get(id)?.prog?.nivel;
  ok(nv === 1, `${id} no nível 1 (${nv})`);
}
const kira = s.amigosIa.find((x) => x.AMIGA.id === 'kira');
ok(!kira.amiga || kira.amiga.prog.nivel > 1, 'Kira (não é líder) não muda');

// líder não sai quando a IA acaba; a Cecília sai como antes
dario.iaAcabouAte = Date.now() + 3600e3;
ok(!dario.iaForaAmiga(), 'Dario não sai do jogo quando a IA acaba');
const cec = s.amigosIa.find((x) => x.AMIGA.id === 'cecilia'); cec.iaAcabouAte = Date.now() + 3600e3;
ok(cec.iaForaAmiga(), 'Cecília continua saindo quando a IA acaba');

// ---------- Resetar partida (André 2026-11-24: "começar tudo do zero... clã volta pro nível 1 sem recruta nenhum"; "Zera tudo") ----------
{
  const { CLA } = await import('../../shared/index.js');
  const { sortearRecruta } = await import('../../shared/cla.js');
  const { progressoValido } = await import('../../shared/progresso.js');
  const s = new Simulacao(MAPA_CLAREIRA);
  const a = s.adicionarJogador('A', 'André', undefined, { conta: 5, testador: true }); a.criando = false;
  const p = s.adicionarJogador('P', 'Pedro', undefined, { conta: 11 }); p.criando = false;
  s.carregarClasNpc(null);
  for (const ctx of s.amigosIa) ctx.amigaEntrar('A', false);
  a.prog.nivel = 40; a.prog.ouro = 5000; a.prog.hist.p = 7;
  a.prog.cla = { n: 'Brasa', c: Date.now(), cofre: 900, sem: Date.now() + CLA.semana, m: [], log: [], nv: 4 };
  const T = CLA.tiers[0];
  for (let i = 0; i < 2; i++) { const r = sortearRecruta(Math.random, T, 10, Date.now()); a.prog.cla.m.push(r); s.entrarRecrutas(a, r.id); }
  const C = CLAS_NPC.find((K) => K.id === 'geada'), E = s.clasNpc.geada; E.nv = 5;
  for (let i = 0; i < 2; i++) { const r = sortearRecruta(Math.random, T, 10, Date.now()); E.m.push(r); s.criarRecrutaNpc(C, r, true); }
  s.basesCla ||= {}; s.basesCla.ngeada = { k: 'ngeada', x: 546, z: 43, raca: 'geada', n: C.n, dono: 'npc:gael', nomeDono: 'Gael', nv: 5, taxa: Date.now(), c: Date.now(), donos: {} };
  const gael = s.amigosIa.find((x) => x.AMIGA.id === 'gael').amiga; gael.prog.nivel = 70; gael.prog.ouro = 9999; gael.prog.hist.p = 9;
  ok(s.resetPartida('P') === false, 'outra conta não reseta a partida');
  ok(s.resetPartida('A') === true, 'André reseta a partida');
  ok(a.prog.nivel === 1 && a.prog.ouro <= 20 && JSON.stringify(a.prog.mochila) === JSON.stringify(progressoValido(null).mochila), `André: nível 1, ouro e mochila do começo (${a.prog.ouro})`);
  ok(a.prog.hist.p === 7, 'as missões do André ficam (outro botão)');
  ok(a.prog.cla && a.prog.cla.nv === 1 && a.prog.cla.m.length === 0 && a.prog.cla.cofre === 0, 'clã do André no nível 1, sem recrutas, cofre vazio');
  ok(!s.amigosIa.some((x) => x.AMIGA.recruta), 'nenhum recruta no mundo (dele e dos bots)');
  ok(CLAS_NPC.every((K) => s.clasNpc[K.id].nv === 1 && s.clasNpc[K.id].m.length === 0), 'clãs bot no nível 1, sem recrutas');
  ok(!s.basesCla.ngeada, 'a base do clã bot sumiu');
  ok(gael.prog.nivel === 1 && gael.prog.ouro <= 20 && gael.prog.hist.p === 9 && gael.prog.equip.corpo?.k === 'peitoral', `Gael: nível 1, ouro do começo, roupa do começo, história fica (${gael.prog.ouro})`);
  ok(s.amigosIa.find((x) => x.AMIGA.id === 'kira')?.amiga?.prog.nivel > 1, 'Kira (membro fixo) não muda');
  s.passoBasesNpc?.(); ok(true, 'passo das bases depois do reset sem erro');
}

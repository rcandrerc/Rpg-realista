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

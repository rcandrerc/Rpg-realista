// Teto da Geada e ritmo só com gente de verdade (Presidente 2026-11-19: "em 24 h a Kira foi do 45 ao 55 e a Lis do 43
// ao 56... elas sobem junto com o robô de testes"). Ninguém desce de nível. Uso: node ferramentas/testes/geada-teto.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Simulacao, MAPA_CLAREIRA, RIVAIS, xpProximo } from '../../shared/index.js';
import { Contas } from '../../server/contas.js';
let falhas = 0;
const ok = (c, m) => { if (!c) { falhas++; console.error('FALHOU', m); } else console.log('ok', m); };
const sala = (quem) => {
  const s = new Simulacao(MAPA_CLAREIRA);
  const j = s.adicionarJogador('p', 'P', 'ruiva', { conta: 9, ...quem });
  for (const x of s.amigosIa) x.amigaEntrar('p', false);
  const npc = (id) => s.amigosIa.find((x) => x.AMIGA.id === id)?.amiga;
  return { s, j, npc };
};
const quaseSubindo = (a) => { a.prog.xp = xpProximo(a.prog.nivel) - 5; };

// 1) a Geada para no jogador de verdade mais alto (antes não tinha teto nenhum)
{
  const { s, npc } = sala();
  const kira = npc('kira'), cec = npc('cecilia'), nv = kira.prog.nivel;
  s.nivelTetoNpc = nv; quaseSubindo(kira); s.ganharXP(kira, 100);
  ok(kira.prog.nivel === nv && kira.prog.xp < xpProximo(nv), `Kira no teto (${nv}) não sobe`);
  s.nivelTetoNpc = nv + 1; s.ganharXP(kira, 100);
  ok(kira.prog.nivel === nv + 1, 'o jogador de verdade subiu: ela pode subir até ele');
  for (const d of RIVAIS) { const a = npc(d.id); if (a) ok(a.tetoReal === true, `${d.nome} tem o teto`); }
  // acima do teto (o que já subiu): ninguém desce
  s.nivelTetoNpc = 10; const antes = kira.prog.nivel; s.ganharXP(kira, 100); s.passo(0.1);
  ok(kira.prog.nivel === antes, `acima do teto ela fica onde está (${antes}), não desce nem sobe`);
  // Cecília continua como era (o ritmo dela vem da história)
  const c0 = cec.prog.nivel; quaseSubindo(cec); s.ganharXP(cec, 100);
  ok(cec.prog.nivel > c0, 'a Cecília continua sem esse teto');
}
// 2) só o robô na sala: Cecília, Dario e a Geada não ganham XP
{
  const { s, npc } = sala({ robo: true });
  for (const id of ['cecilia', 'dario', 'kira', 'lis']) {
    const a = npc(id); if (!a) continue; const n0 = a.prog.nivel; quaseSubindo(a); s.ganharXP(a, 100);
    ok(a.prog.nivel === n0, `só o robô na sala: ${id} não sobe`);
  }
  // o tempo fora (offlineAmiga) continua valendo, devagar
  const ctx = s.amigosIa.find((x) => x.AMIGA.id === 'cecilia'), a = ctx.amiga, x0 = a.prog.xp + a.prog.nivel * 1e9;
  ctx.offlineAmiga(a, Date.now() - 48 * 3600e3);
  ok(a.prog.xp + a.prog.nivel * 1e9 > x0, 'o XP do tempo fora não depende de quem está na sala');
}
// 3) com gente (até a conta de teste do André) eles sobem
{
  const { s, npc } = sala({ testador: true });
  const a = npc('cecilia'), n0 = a.prog.nivel; quaseSubindo(a); s.ganharXP(a, 100);
  ok(a.prog.nivel > n0, 'André jogando (conta de teste): a Cecília sobe');
}
// 4) robô e conta de teste não puxam o teto
{
  const s = new Simulacao(MAPA_CLAREIRA); s.nivelTetoNpc = 20;
  const r = s.adicionarJogador('r', 'R', 'ruiva', { conta: 1, robo: true }), t = s.adicionarJogador('t', 'T', 'ruiva', { conta: 2, testador: true });
  const g = s.adicionarJogador('g', 'G', 'ruiva', { conta: 3 });
  for (const j of [r, t, g]) { j.prog.nivel = 30; j.prog.xp = xpProximo(30) - 5; }
  s.ganharXP(r, 100); s.ganharXP(t, 100);
  ok(s.nivelTetoNpc === 20, 'robô e conta de teste subindo não mexem no teto');
  s.ganharXP(g, 100);
  ok(s.nivelTetoNpc === 31, 'jogador de verdade subindo leva o teto junto');
}
// 5) no banco: o mais alto sem robô e sem a conta de teste
{
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'teto-'));
  let email = 'gente@x.invalid';
  const contas = new Contas({ pasta, verificar: async () => ({ sub: email, email, given_name: 'G' }), ehTestador: (e) => e === 'andre@x.invalid' });
  const g = await contas.entrar('x', 'criar'); email = 'andre@x.invalid'; const t = await contas.entrar('y', 'criar');
  const r = contas.entrarRobo();
  contas.salvarProgresso(g.conta.id, { nivel: 12 }); contas.salvarProgresso(t.conta.id, { nivel: 90 }); contas.salvarProgresso(r.conta.id, { nivel: 70 });
  ok(contas.nivelMaisAlto() === 12, `banco: o teto é o jogador de verdade (${contas.nivelMaisAlto()}), não o robô (70) nem a conta de teste (90)`);
  fs.rmSync(pasta, { recursive: true, force: true });
}
if (falhas) { console.error(`${falhas} falha(s)`); process.exit(1); }
console.log('teto da Geada: tudo certo');

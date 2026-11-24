// Recruta protegendo outro recruta conta como time no XP (André 2026-11-24: "contrato 3 nível 1, boto 90 para proteger,
// eles vão upar na velocidade do capiroto"). Fora do time, o protegido de Nv 1 perto do Nv 90 que mata leva o desconto
// de time (TIME_XP); sem a ordem de proteger, cada um segue sozinho como antes.
// Uso: node ferramentas/testes/xp-proteger-recruta.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const rodada = (protege) => {
  const s = new Simulacao(MAPA_CLAREIRA);
  s.adicionarJogador('andre', 'André', 'ruiva', {});
  for (const x of s.amigosIa) x.amigaEntrar('andre', false);
  const [cf, cp] = s.amigosIa.filter((x) => x.amiga && !x.amiga.time), forte = cf.amiga, fraco = cp.amiga;
  forte.prog.nivel = 90; fraco.prog.nivel = 1; fraco.prog.xp = 0; forte.prog.xp = 0;
  forte.ia.funcao = protege ? { k: 'proteger', p: cp.AMIGA.id } : null; fraco.ia.funcao = null;
  const e = s.inimigos.find((o) => !o.treino && !o.morto); e.nivel = 1;
  Object.assign(forte, { x: e.x + 1, z: e.z, lutouT: s.tempo }); Object.assign(fraco, { x: e.x - 2, z: e.z });
  for (const j of s.jogadores.values()) if (j !== forte && j !== fraco && Math.hypot(j.x - e.x, j.z - e.z) < 30) Object.assign(j, { x: e.x + 200, z: e.z + 200 });
  e.atacantes = new Set([forte.id]);
  s.ferir(e, 1e9, forte);
  return { xp: fraco.prog.xp + (fraco.prog.nivel - 1) * 1e6, bot: !!fraco.bot && !!forte.bot };
};
const sem = rodada(false), com = rodada(true);
ok(sem.bot, 'recrutas são bots (todos os clãs na mesma regra)');
ok(sem.xp > 0, `sem proteger: o Nv 1 perto da morte ganha XP sozinho (${sem.xp})`);
ok(com.xp === 0, `protegido pelo Nv 90: desconto de time, 89 níveis abaixo não ganha XP (${com.xp})`);

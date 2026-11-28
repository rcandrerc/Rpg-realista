// Só quem bateu ganha XP e drop do monstro (André 2026-11-28: "mesmo que sejam do mesmo nível, se não tiver em time, não
// deveria ganhar XP"). Quem só estava a até 14 m fica sem XP; o protegido (ordem Proteger) segue como time.
// Uso: node ferramentas/testes/xp-so-quem-bate.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const rodada = ({ bateFraco = false, protege = false, nvForte = 5 } = {}) => {
  const s = new Simulacao(MAPA_CLAREIRA);
  s.adicionarJogador('andre', 'André', 'ruiva', {});
  for (const x of s.amigosIa) x.amigaEntrar('andre', false);
  const [cf, cp] = s.amigosIa.filter((x) => x.amiga && !x.amiga.time), forte = cf.amiga, fraco = cp.amiga;
  forte.prog.nivel = nvForte; fraco.prog.nivel = 5; fraco.prog.xp = 0; forte.prog.xp = 0;
  forte.ia.funcao = protege ? { k: 'proteger', p: cp.AMIGA.id } : null; fraco.ia.funcao = null;
  const e = s.inimigos.find((o) => !o.treino && !o.morto); e.nivel = 5;
  Object.assign(forte, { x: e.x + 1, z: e.z, lutouT: s.tempo }); Object.assign(fraco, { x: e.x - 2, z: e.z, lutouT: s.tempo });
  for (const j of s.jogadores.values()) if (j !== forte && j !== fraco && Math.hypot(j.x - e.x, j.z - e.z) < 30) Object.assign(j, { x: e.x + 200, z: e.z + 200 });
  e.atacantes = new Set(bateFraco ? [forte.id, fraco.id] : [forte.id]);
  s.ferir(e, 1e9, forte);
  return { fraco: fraco.prog.xp + (fraco.prog.nivel - 5) * 1e6, forte: forte.prog.xp + (forte.prog.nivel - nvForte) * 1e6 };
};
const so = rodada(), bateu = rodada({ bateFraco: true }), prot = rodada({ protege: true });
ok(so.forte > 0, `quem matou ganha XP (${so.forte})`);
ok(so.fraco === 0, `mesmo nível, sem time, só perto: sem XP (${so.fraco})`);
ok(bateu.fraco > 0, `quem também bateu ganha XP (${bateu.fraco})`);
ok(prot.fraco > 0, `protegido perto de quem bateu ganha como time (${prot.fraco})`);

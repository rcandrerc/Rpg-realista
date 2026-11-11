// Nerf de XP no time (André 2026-11-11): quem está muito abaixo do mais alto do time ganha menos XP (jogador ou NPC).
// Uso: node ferramentas/testes/xp-time.mjs
import { Simulacao, MAPA_CLAREIRA, fatorXpTime, TIME_XP } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
ok(fatorXpTime(10, 15) === 1 && fatorXpTime(10, 10) === 1 && fatorXpTime(20, 10) === 1, `até ${TIME_XP.nerfLivre} níveis abaixo (ou acima): XP normal`);
ok(Math.abs(fatorXpTime(5, 15) - 0.5) < 1e-9 && fatorXpTime(5, 20) === 0 && fatorXpTime(1, 40) === 0, '10 abaixo: metade; 15 ou mais: nada');
// na simulação: Nv 5 com Nv 20 no time matando o mesmo monstro
const xpDe = (nivelOutro) => {
  const s = new Simulacao(MAPA_CLAREIRA);
  const a = s.adicionarJogador('a', 'A', 'ruiva', {}), b = s.adicionarJogador('b', 'B', 'ruiva', {});
  a.prog.nivel = 5; b.prog.nivel = nivelOutro; a.prog.xp = 0;
  const T = { lider: a.id, membros: [a.id, b.id] }; a.time = b.time = T; (s.times ||= new Set()).add(T);
  const e = s.inimigos.find((o) => !o.treino && !o.morto); e.nivel = 5;
  Object.assign(a, { x: e.x + 1, z: e.z, lutouT: s.tempo }); Object.assign(b, { x: e.x - 1, z: e.z, lutouT: s.tempo });
  e.atacantes = new Set([a.id, b.id]);
  s.ferir(e, 1e9, a);
  return a.prog.xp + (a.prog.nivel - 5) * 1e6;
};
const igual = xpDe(5), longe = xpDe(20);
ok(igual > 0 && longe === 0, `Nv 5 com Nv 5 no time: ${igual} XP; com Nv 20: ${longe} XP`);

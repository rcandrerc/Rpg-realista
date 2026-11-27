// Jogo leve: o mundo de perto (André 2026-11-27: "um 2D bem próximo... como se eu estivesse dentro do jogo"). A cena em
// volta do herói (cenaLeve) traz o chão inteiro, as estradas, as árvores, as pedras, as casas e os veios de perto.
// Uso: node ferramentas/testes/leve-cena.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const c = s.cenaLeve({ x: 0, z: 0, y: 0 });
ok(c.t.length === c.n * c.n && c.l.length === c.n * c.n, `chão completo (${c.n}x${c.n} de ${c.p} m)`);
ok(/^[garwW]+$/.test(c.t) && /^[0-9]+$/.test(c.l), 'chão só com tipos e luz conhecidos');
ok(c.e.length > 0 && c.e.every((l) => l.length >= 6 && l[0] > 0), `estradas da vila com largura (${c.e.length})`);
ok(c.ar.length > 10, `árvores perto (${c.ar.length})`);
ok(c.ca.some((o) => o[6] === 0), 'casas da vila');
ok(c.pr, 'a praça');
const v = s.cenaLeve({ x: 46, z: -11.5, y: 0 });
ok(v.ve.some((o) => o[3] === 'cobre'), 'o veio de cobre');
ok(JSON.stringify(c).length < 15000, `pequena (${JSON.stringify(c).length} bytes)`);

// Jogo leve: joystick (André 2026-11-27: "um joystick virtual do lado esquerdo pra mover o personagem"). leveMover anda na
// direção do dedo, cancela o caminho automático e para ao soltar ou sem notícia por LEVE.joySolto s.
// Uso: node ferramentas/testes/leve-joystick.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.ciente = true; a.leve = true; s.inimigos.length = 0;
const passos = (n) => { for (let i = 0; i < n; i++) s.passo(1 / 20); };
passos(5);
s.leveIr('A', { x: a.x - 30, z: a.z, nome: 'longe' }); passos(2); ok(a.leveRota, 'caminho automático andando');
const x0 = a.x, z0 = a.z;
for (let k = 0; k < 6; k++) { s.leveMover('A', { mx: 0, mz: 1 }); passos(4); }
ok(!a.leveRota, 'o joystick cancela o caminho');
ok(a.z - z0 > 2 && Math.abs(a.x - x0) < 1.5, `andou para onde o dedo mandou (${(a.z - z0).toFixed(1)} m)`);
s.leveMover('A', { mx: 0, mz: 0 }); const z1 = a.z; passos(10);
ok(Math.abs(a.z - z1) < 0.6, 'soltou: parou');
s.leveMover('A', { mx: 1, mz: 0 }); passos(30); const x2 = a.x; passos(20);
ok(Math.abs(a.x - x2) < 0.6, 'sem notícia do joystick: parou sozinho');
s.leveMover('A', { mx: 1e9, mz: 'x' }); ok(Math.hypot(a.leveJoy.mx, a.leveJoy.mz) <= 1.0001, 'entrada maluca vira no máximo 1');

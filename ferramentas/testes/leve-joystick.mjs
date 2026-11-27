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
// velocidade do joystick igual ao jogo (andar.gd vel_joystick, André 2026-11-27: "quero tudo idêntico"): sem Disparada
// vai no máximo ao trote (3,78 m/s, sem gastar estamina); com a Disparada corre a 5,4 m/s e gasta estamina
{
  const vel = (mx, n = 40) => { const x0 = a.x, z0 = a.z; for (let i = 0; i < n; i++) { s.leveMover('A', { mx, mz: 0 }); s.passo(1 / 20); } return Math.hypot(a.x - x0, a.z - z0) / (n / 20); };
  a.leveRota = null; a.sta = a.staMax; a.semFolego = false; a.montado = null; a.x = 0; a.z = 0;
  const trote = vel(1), sta0 = a.sta;
  ok(trote > 3.4 && trote < 4.1 && a.sta === sta0, `joystick no máximo: trote ${trote.toFixed(2)} m/s, sem gastar estamina`);
  const anda = vel(0.4); ok(anda > 1.2 && anda < 2, `joystick pela metade: anda (${anda.toFixed(2)} m/s)`);
  s.leveDisparada('A', true); const corre = vel(1);
  ok(corre > 5 && corre < 5.8 && a.sta < sta0, `Disparada: corre ${corre.toFixed(2)} m/s e gasta estamina (${Math.round(sta0)} → ${Math.round(a.sta)})`);
  ok(s.fotoLeve(a).ds === 1 && s.fotoLeve(a).sa?.[1] > 0, 'a página sabe da Disparada e da estamina');
  a.sta = 0.5; vel(1, 20); ok(a.semFolego && !a.leveDisp, 'sem fôlego: a Disparada desliga sozinha');
}

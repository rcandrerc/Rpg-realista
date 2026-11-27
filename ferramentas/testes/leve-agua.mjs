// Jogo leve: perto da água aparece Pescar (com a vara) e Usar barquinho (com o barquinho na mochila), com as mesmas contas
// do jogo (pesca.gd e transporte.gd _estado_botao); no barco, Descer (André 2026-11-27)
// Uso: node ferramentas/testes/leve-agua.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { fundoAgua } from '../../shared/transporte.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.ciente = true; a.leve = true;
for (let t = 0; t < 5; t++) s.passo(1 / 20);
let beira = null; // um ponto em terra com água funda a 2 m na frente
for (let r = 4; r < 900 && !beira; r += 4) for (let i = 0; i < 64 && !beira; i++) {
  const g = (i / 64) * Math.PI * 2, x = Math.sin(g) * r, z = Math.cos(g) * r;
  if (fundoAgua(x, z) === 0 && fundoAgua(x + Math.sin(g) * 2, z + Math.cos(g) * 2) >= 0.6) beira = { x, z, ry: g };
}
ok(beira, `achei a beira ${JSON.stringify(beira)}`);
a.x = beira.x; a.z = beira.z; a.ry = beira.ry;
ok(!s.fotoLeve(a).ag && !s.fotoLeve(a).bq, 'sem vara nem barquinho: nada');
const m = a.prog.mochila; m[m.indexOf(null)] = { k: 'vara', n: 1 }; m[m.indexOf(null)] = { k: 'barquinho', n: 1 };
const f = s.fotoLeve(a); ok(f.ag === 1 && f.bq === 1, `na beira: pescar e barquinho (${f.ag}, ${f.bq})`);
s.veiculo('A', { acao: 'colocar', k: 'barquinho' });
ok(a.veiculo === 'barquinho' && s.fotoLeve(a).vc === 'b', 'no barquinho: o balão vira Descer');
a.x += 300; a.veiculo = null; ok(!s.fotoLeve(a).ag && !s.fotoLeve(a).bq, 'longe da água: nada');
// no barquinho o joystick rema (a mesma entrada do jogo)
a.x -= 300; a.veiculo = 'barquinho'; const x0 = a.x, z0 = a.z;
s.leveMover('A', { mx: Math.sin(beira.ry), mz: Math.cos(beira.ry) }); for (let t = 0; t < 40; t++) { s.leveMover('A', { mx: Math.sin(beira.ry), mz: Math.cos(beira.ry) }); s.passo(1 / 20); }
ok(Math.hypot(a.x - x0, a.z - z0) > 0.5, `o joystick move o barquinho (${Math.hypot(a.x - x0, a.z - z0).toFixed(1)} m)`);
// montado no lobo entrando na água: desce sozinho e vai devagar (nadando), como pedido (André 2026-11-27)
a.veiculo = null; a.x = beira.x; a.z = beira.z; a.y = s.terreno.altura(a.x, a.z); a.montado = 'lobo';
const dx = Math.sin(beira.ry), dz = Math.cos(beira.ry); let t = 0;
while (a.montado && t < 200) { s.leveMover('A', { mx: dx, mz: dz }); s.passo(1 / 20); t++; }
ok(!a.montado && t < 200, `desceu do lobo ao entrar na água (${(t / 20).toFixed(1)} s)`);
for (let i = 0; i < 40; i++) { s.leveMover('A', { mx: dx, mz: dz }); s.passo(1 / 20); }
const x1 = a.x, z1 = a.z; for (let i = 0; i < 20; i++) { s.leveMover('A', { mx: dx, mz: dz }); s.passo(1 / 20); }
const vel = Math.hypot(a.x - x1, a.z - z1);
ok(vel > 0.3 && vel < 3.5, `na água anda devagar (${vel.toFixed(2)} m/s; o lobo galopa a mais de 8)`);

// Teste (André 2026-11-05): parede de casa não se escala mais; pedra continua escalando.
// Uso: node ferramentas/testes/escalada-casa.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
// anda até o sólido r de todos os lados (de fora, vindo de 2 m) e empurra 3 s; diz se agarrou em algum
function empurra(r, correr) {
  const s = new Simulacao(MAPA_CLAREIRA);
  const j = s.adicionarJogador('A', 'Ana'); j.criando = false;
  const T = s.terreno;
  for (let a = 0; a < Math.PI * 2; a += 0.2) {
    const fx = Math.sin(a), fz = Math.cos(a);
    // ponto de fora: sai do centro até o chão ficar livre, mais 2 m
    let d = 0; while (d < 20 && T.rochaEm(r.x + fx * d, r.z + fz * d, 0)) d += 0.1;
    if (d >= 20) continue;
    j.x = r.x + fx * (d + 2); j.z = r.z + fz * (d + 2); j.y = T.altura(j.x, j.z, 0); j.chao = true; j.esc = null; j.vy = 0;
    if (j.y > 0.3 || T.teto(j.x, j.z, j.y) < Infinity) continue;
    j.entrada = { ...(j.entrada || {}), mx: -fx, mz: -fz, correr: !!correr };
    j.ry = Math.atan2(-fx, -fz);
    for (let i = 0; i < 60; i++) { s.passo(1 / 20); if (j.esc) { return true; } }
  }
  return false;
}
const s0 = new Simulacao(MAPA_CLAREIRA);
const casa = s0.terreno.solidos.find((r) => r.casa && r.y1 - (r.base || 0) > 2.5) || s0.terreno.solidos.find((r) => r.casa);
const alto = (r) => { let h = 0; for (let dx = -1; dx <= 1; dx += 0.25) for (let dz = -1; dz <= 1; dz += 0.25) h = Math.max(h, s0.terreno.altura(r.x + dx, r.z + dz, 0)); return h; };
const pedra = s0.terreno.solidos.filter((r) => !r.casa).sort((a, b) => alto(b) - alto(a))[0];
console.log('pedra', pedra?.modelo, alto(pedra).toFixed(2), 'm');
ok(casa, 'achou casa da vila'); ok(pedra, 'achou pedra alta');
ok(!empurra(casa, false), 'empurrando a parede da casa: não agarra');
ok(!empurra(casa, true), 'correndo contra a casa: não corre na parede');
ok(empurra(pedra, false), 'empurrando a pedra alta: agarra e escala como antes');

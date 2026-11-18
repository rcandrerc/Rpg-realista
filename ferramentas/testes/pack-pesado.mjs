// Pack nas costas pesa (André 2026-11-18): anda a 50% da corrida (2,7 m/s), não corre e não monta; só o carrinho leva.
// O servidor confere a velocidade (Simulacao.posicaoCliente). Uso: node ferramentas/testes/pack-pesado.mjs
import { Simulacao, MAPA_CLAREIRA, HEROI, ESTAMINA } from '../../shared/index.js';
import { PACK_REGRAS } from '../../shared/dados.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const TICK = 1 / 20;
function andar(vel, pack, seg = 6) {
  const s = new Simulacao(MAPA_CLAREIRA);
  const j = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
  j.criando = false; j.x = 0; j.z = 0; j.y = s.terreno.altura(0, 0, 10);
  if (pack) j.prog.pack = { k: 'lenha', ox: 50, oz: 50 };
  s.passo(TICK); s.eventos = [];
  let z = 0, corr = 0;
  for (let t = 0; t < seg; t += TICK) {
    s.passo(TICK);
    z += vel * TICK;
    s.posicaoCliente('A', { x: 0, y: s.terreno.altura(0, z, 10), z, ry: 0, e: 1 });
    corr += s.eventos.filter((e) => e.t === 'corrigir').length;
    s.eventos = [];
  }
  return { corr, s, j };
}
const vPack = HEROI.correr * PACK_REGRAS.costas.vel;
ok(Math.abs(vPack - 2.7) < 0.01, `com pack: ${vPack.toFixed(2)} m/s (corrida ${HEROI.correr}, trote ${(HEROI.correr * ESTAMINA.trote).toFixed(2)})`);
ok(andar(vPack, true).corr === 0, 'com pack andando a 2,7 m/s: o servidor aceita');
ok(andar(HEROI.correr * ESTAMINA.trote, true, 60).corr > 0, "com pack no trote (3,78 m/s) por 60 s: o servidor corrige");
ok(andar(HEROI.correr, true).corr > 0, 'com pack correndo (5,4 m/s): o servidor corrige');
ok(andar(HEROI.correr, false).corr === 0, 'sem pack correndo: normal');
{ const { s, j } = andar(0, true); s.montar('A'); ok(!j.montado, 'com pack não monta'); }

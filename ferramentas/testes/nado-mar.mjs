// Nado no mar igual aos lagos, com gasto de estamina e nado mais lento (André 2026-11-18).
// Uso: node ferramentas/testes/nado-mar.mjs
import { Simulacao, MAPA_CLAREIRA, ESTAMINA, AGUA } from '../../shared/index.js';
import { gradeDoMundo, marNadavel, MAR_BORDA, noLago, LAGOS } from '../../shared/relevo.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const TICK = 1 / 20;
const G = gradeDoMundo();
ok(!!G, 'mundo grande carregado');
// um ponto de mar fundo, longe da borda da grade, com 20 m de mar em linha reta para +x
let P = null;
for (let j = 40; j < G.nz - 40 && !P; j += 7) for (let i = 40; i < G.nx - 40 && !P; i += 7) {
  const x = G.x0 + i * G.passo, z = G.z0 + j * G.passo;
  let todo = true; for (let d = 0; d <= 20; d += 1) if (!marNadavel(x + d, z) || (noLago(x + d, z)?.fundo || 0) < 3) { todo = false; break; }
  if (todo) P = { x, z };
}
ok(!!P, `achou mar fundo em ${P && P.x.toFixed(0)}, ${P && P.z.toFixed(0)}`);

function nadar(px, pz, vel, seg, mergulho = 0) {
  const s = new Simulacao(MAPA_CLAREIRA);
  const j = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
  const y = AGUA.nivel - AGUA.peito - mergulho;
  j.criando = false; j.x = px; j.z = pz; j.y = y;
  s.passo(TICK); s.eventos = [];
  const cheia = j.sta;
  let x = px, corr = 0;
  for (let t = 0; t < seg; t += TICK) {
    s.passo(TICK);
    x += vel * TICK;
    if (!s.posicaoCliente('A', { x, y, z: pz, ry: 1.57, e: 1 })) corr++;
    s.eventos = [];
  }
  return { s, j, cheia, gasto: cheia - j.sta, corr };
}
const sup = nadar(P.x, P.z, AGUA.nado, 6);
ok(sup.corr === 0, `no mar o servidor aceita o nado (${sup.corr} recusas)`);
ok(Math.abs(sup.gasto - ESTAMINA.nado * 6) < ESTAMINA.nado * 1.2, `nado na superfície gasta ~${ESTAMINA.nado}/s (gastou ${sup.gasto.toFixed(1)} em 6 s)`);
const fundo = nadar(P.x, P.z, AGUA.nadoFundo, 6, 1.5);
ok(fundo.corr === 0, `submerso no mar também (${fundo.corr} recusas)`);
ok(fundo.gasto > sup.gasto * 1.2, `submerso gasta mais (${fundo.gasto.toFixed(1)} x ${sup.gasto.toFixed(1)})`);
ok(AGUA.nado < 1.7 && AGUA.nadoFundo < AGUA.nado, `nado mais lento: ${AGUA.nado} m/s, submerso ${AGUA.nadoFundo} m/s`);
// boiando parado: não gasta, e volta devagar
{
  const { s, j } = sup;
  const antes = j.sta, y = AGUA.nivel - AGUA.peito;
  for (let t = 0; t < 3; t += TICK) { s.passo(TICK); s.posicaoCliente('A', { x: j.x, y, z: j.z, ry: 0, e: 1 }); s.eventos = []; }
  const ganhoAgua = j.sta - antes;
  ok(ganhoAgua >= 0, `boiando parado não gasta (+${ganhoAgua.toFixed(1)})`);
  ok(ganhoAgua < j.staMax * ESTAMINA.volta * 3 * 0.6, `na água a estamina volta devagar (+${ganhoAgua.toFixed(1)} em 3 s)`);
}
// lago fundo também gasta
{
  const L = LAGOS.find((l) => l.fundo > 4);
  const r = nadar(L.x - 3, L.z, AGUA.nado, 4);
  ok(r.corr === 0 && r.gasto > ESTAMINA.nado * 2, `lago fundo: nado gasta (${r.gasto.toFixed(1)} em 4 s)`);
}
// fora da grade do mundo (mar sem fim): não passa
{
  const x = G.x0 + (MAR_BORDA - 5), z = G.z0 + G.passo * G.nz / 2;
  ok(!marNadavel(x, z), 'perto da borda da grade não dá para nadar');
  ok(!marNadavel(G.x0 - 50, z), 'fora da grade não dá para nadar');
}

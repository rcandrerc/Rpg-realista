// Bot usa os totens como um jogador (André 2026-11-24: "ele se aproxima de um totem, teleporta para outro totem, em vez
// de correr o mapa inteiro"; nunca teleporta de qualquer lugar). Aventureiro na Vila da Clareira indo caçar perto do
// Juncal (~550 m de estrada): com os dois totens descobertos e ouro, vai até a pedra da Clareira, canaliza, paga e sai
// no Juncal. Sem o totem do Juncal descoberto, vai de lobo pela estrada (nada de teleporte).
// Uso: node ferramentas/testes/bot-totem.mjs
import { Simulacao, MAPA_CLAREIRA, NPC_VIDA } from '../../shared/index.js';
import { NPCS_NO_MUNDO, TOTENS, taxaTotem } from '../../shared/dados.js'; NPCS_NO_MUNDO.aventureiros = null;
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const T = (id) => TOTENS.lista.find((t) => t.id === id), CL = T('clareira'), JU = T('juncos');
const montar = (totens) => {
  const s = new Simulacao(MAPA_CLAREIRA); s.nivelTetoNpc = 99;
  s.adicionarJogador('andre', 'André', 'ruiva', {});
  for (const x of s.amigosIa) x.amigaEntrar('andre', false);
  const ctx = s.amigosIa.find((x) => x.AMIGA.id === 'maya'), b = ctx.amiga;
  const R = ctx.rotinaAmiga(), dia = () => { b.prog.dia = { h: (R.saiDe + 1) % 24, t: Date.now() }; }; dia(); ctx.grindAcabouAmiga = () => false;
  b.prog.nivel = 50; s.aplicarStatus(b); b.vida = b.vidaMax; b.prog.ouro = 5000; b.prog.totens = totens;
  Object.assign(b, { x: CL.x + 30, z: CL.z + 6, y: s.terreno.altura(CL.x + 30, CL.z + 6) });
  NPC_VIDA.aventura.cacar = [9999, 9999];
  const c = { id: 'teste_juncal', nome: 'perto do Juncal', x: JU.x + 25, z: JU.z + 25, r: 12 };
  const ir = () => { if (b.ia.av?.fase !== 'ir') { b.ia.av = { fase: 'ir', c, coleta: null, ate: s.tempo + 9999 }; } };
  return { s, b, dia, ir, c, ctx };
};
// 1) com os totens: vai pela pedra da Clareira e sai no Juncal
{
  const { s, b, dia, ir, c } = montar(['clareira', 'juncos']);
  b.ia.viagem = null; ir();
  let pulo = null, maxPasso = 0, ouro0 = b.prog.ouro, usouPlano = false;
  for (let i = 0; i < 20 * 240 && !pulo; i++) {
    dia(); ir(); const x0 = b.x, z0 = b.z; s.passo(0.05);
    if (b.morto) { b.morto = false; b.vida = b.vidaMax; }
    if (b.ia.viagem?.totem) usouPlano = true;
    const p = Math.hypot(b.x - x0, b.z - z0);
    if (p > 20) pulo = { de: { x: x0, z: z0 }, para: { x: b.x, z: b.z } }; else maxPasso = Math.max(maxPasso, p);
  }
  ok(usouPlano, 'planejou a viagem pelo totem');
  ok(pulo && Math.hypot(pulo.de.x - CL.x, pulo.de.z - CL.z) < TOTENS.usar + 0.5, `teleportou só de perto da pedra da Clareira (${pulo && Math.round(Math.hypot(pulo.de.x - CL.x, pulo.de.z - CL.z) * 10) / 10} m)`);
  ok(pulo && Math.hypot(pulo.para.x - JU.x, pulo.para.z - JU.z) < 6, 'saiu do lado do totem do Juncal');
  ok(b.prog.ouro === ouro0 - taxaTotem(JU), `pagou a taxa (${ouro0 - b.prog.ouro} de ouro)`);
  let chegou = false;
  for (let i = 0; i < 20 * 60 && !chegou; i++) { dia(); ir(); s.passo(0.05); if (b.morto) { b.morto = false; b.vida = b.vidaMax; } if (Math.hypot(b.x - c.x, b.z - c.z) < 14) chegou = true; }
  ok(chegou, 'do totem do Juncal andou até o campo');
}
// 2) sem o totem do Juncal descoberto: estrada, sem teleporte
{
  const { s, b, dia, ir, ctx } = montar(['clareira']);
  b.ia.viagem = null; ir();
  let pulo = false, plano = false;
  for (let i = 0; i < 20 * 60; i++) { dia(); ir(); const x0 = b.x, z0 = b.z, tp = ctx.teleportes | 0; s.passo(0.05); if ((ctx.teleportes | 0) > tp) continue; if (b.morto) { b.morto = false; b.vida = b.vidaMax; } if (b.ia.viagem?.totem) plano = true; if (Math.hypot(b.x - x0, b.z - z0) > 20) pulo = true; }
  ok(!plano && !pulo, 'sem o totem do destino: vai pela estrada');
}
// 3) sem ouro: estrada
{
  const { s, b, dia, ir, ctx } = montar(['clareira', 'juncos']);
  b.prog.ouro = 10; b.ia.viagem = null; ir();
  let pulo = false, plano = false;
  for (let i = 0; i < 20 * 60; i++) { dia(); ir(); b.prog.ouro = 10; const x0 = b.x, z0 = b.z, tp = ctx.teleportes | 0; s.passo(0.05); if ((ctx.teleportes | 0) > tp) continue; if (b.morto) { b.morto = false; b.vida = b.vidaMax; } if (b.ia.viagem?.totem) plano = true; if (Math.hypot(b.x - x0, b.z - z0) > 20) pulo = true; }
  ok(!plano && !pulo, `sem ouro para a taxa: vai pela estrada (plano ${plano}, pulo ${pulo})`);
}

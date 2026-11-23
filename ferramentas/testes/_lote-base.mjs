// Casa dos bots na base do clã (André 2026-11-22/23, NPC_CASA_BASE): a Cecília, o Dario e a Lia só têm lote na base da
// Guarda da Chama. Nos testes da casa, da horta e do baú: funda as bases dos clãs bot com nível alto (lote para todos os
// membros, sem depender do sorteio dos lotes) e devolve o lote do bot.
export function loteNaBase(s, ctx = s) {
  s.passoClasNpc();
  for (const E of Object.values(s.clasNpc || {})) E.nv = 6;
  s.passoBasesNpc();
  return ctx.loteDaAmiga(true);
}

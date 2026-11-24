// Bot sozinho vai de barquinho ao campo do nível em outra terra (André 2026-11-22: "quando chegar a hora eles vão pra
// ilha do meio e outro continente?"). Aventureiro Nv 58 com barquinho, na Vila da Clareira: o campo do nível fica na
// Ilha do Meio; ele rema até lá e desce na margem.
// Uso: node ferramentas/testes/bot-outra-terra.mjs
import { Simulacao, MAPA_CLAREIRA, NPC_VIDA } from '../../shared/index.js';
import { NPCS_NO_MUNDO } from '../../shared/dados.js'; NPCS_NO_MUNDO.aventureiros = null;
import { terraId } from '../../shared/rota.js';
import { guardar } from '../../shared/progresso.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA); s.nivelTetoNpc = 99;
s.adicionarJogador('andre', 'André', 'ruiva', {});
for (const x of s.amigosIa) x.amigaEntrar('andre', false);
const ctx = s.amigosIa.find((x) => x.AMIGA.id === 'maya'), b = ctx.amiga; // rotina.campo 'alto'
const R = ctx.rotinaAmiga(), dia = () => { b.prog.dia = { h: (R.saiDe + 1) % 24, t: Date.now() }; }; dia(); ctx.grindAcabouAmiga = () => false; // sempre de dia, sem limite de grind
b.prog.nivel = 58; s.aplicarStatus(b); b.vida = b.vidaMax;
// o teste é do caminho de barco, não do combate: se cair, levanta no mesmo lugar (antes o renascer agendado o mandava
// de volta para a vila no meio da viagem e o teste falhava por sorte, ~1 em 10)
const morrer = s.morrer.bind(s); s.morrer = (c, de) => { if (c === b) { b.vida = b.vidaMax; return; } return morrer(c, de); };
for (let i = 0; i < 5; i++) guardar(b.prog.mochila, { k: 'pocao', n: 5 });
let c = null; for (let i = 0; i < 20 && !(c && terraId(c.x, c.z) === 2); i++) c = ctx.campoAmiga(b);
ok(c && terraId(c.x, c.z) === 2, `o campo do nível dele é na Ilha do Meio: ${c?.nome}`);
// sem barquinho e sem material: escolhe outro campo (no continente)
const semBarco = () => { b.ia.av = { fase: 'ir', c, coleta: null, ate: s.tempo + 9999 }; b.ia.viagem = null; };
semBarco(); let foi = false;
for (let i = 0; i < 20 * 120 && !foi; i++) { dia(); s.passo(0.05); if (b.ia.av?.fora?.has(c.id)) foi = true; }
ok(foi, 'sem barquinho: desiste do campo da ilha');
// com barquinho: vai
guardar(b.prog.mochila, { k: 'barquinho', n: 1 });
b.ia.av = { fase: 'ir', c, coleta: null, ate: s.tempo + 9999 }; b.ia.viagem = null;
NPC_VIDA.aventura.cacar = [9999, 9999];
let remou = false, chegou = false;
for (let i = 0; i < 20 * 900 && !chegou; i++) {
  dia(); s.passo(0.05); if (b.veiculo === 'barquinho') remou = true;
  if (b.morto) { b.morto = false; b.vida = b.vidaMax; }
  if (terraId(b.x, b.z) === 2 && b.veiculo !== 'barquinho') chegou = true;
  if (b.ia.av?.fase !== 'ir' && b.ia.av?.fase !== 'cacar') b.ia.av = { fase: 'ir', c, coleta: null, ate: s.tempo + 9999 };
}
ok(remou, 'entrou no barquinho');
ok(chegou, `desceu na Ilha do Meio (${Math.round(b.x)}, ${Math.round(b.z)}; campo ${Math.round(c.x)}, ${Math.round(c.z)})`);
let noCampo = false;
for (let i = 0; i < 20 * 300 && !noCampo; i++) {
  dia(); s.passo(0.05); if (b.morto) { b.morto = false; b.vida = b.vidaMax; }
  if (Math.hypot(b.x - c.x, b.z - c.z) < (c.r || 12) + 16) noCampo = true;
  if (b.ia.av?.fase !== 'ir' && b.ia.av?.fase !== 'cacar') b.ia.av = { fase: 'ir', c, coleta: null, ate: s.tempo + 9999 };
}
ok(noCampo, 'chegou ao campo da ilha');
// volta para a vila (outra terra) de barquinho
b.ia.av = { fase: 'voltar', c: null, coleta: null }; b.ia.viagem = null;
let casa = false;
for (let i = 0; i < 20 * 900 && !casa; i++) {
  dia(); s.passo(0.05); if (b.morto) { b.morto = false; b.vida = b.vidaMax; }
  if (b.ia.av?.fase !== 'voltar') casa = true;
}
ok(casa && terraId(b.x, b.z) === 1, `voltou para a vila no continente (${Math.round(b.x)}, ${Math.round(b.z)})`);

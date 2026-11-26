// Recruta do jogador grindando com o líder offline (André 2026-11-24, Jeito B): cada hora fora dá o XP de CLA.fora.mobsHora
// monstros do nível dele (não mais níveis fixos por hora), nunca passa do nível do líder. Com a curva nova depois do Nv50
// (XP_ESCALA em shared/progresso.js) ele vai ficando cada vez mais lento.
// Uso: node ferramentas/testes/recruta-fora-xp.mjs
import { Simulacao, MAPA_CLAREIRA, CLAS_NPC, CLAS_NPC_ORDENS, CLA, NIVEL_INIMIGO } from '../../shared/index.js';
import { sortearRecruta } from '../../shared/cla.js';
import { xpProximo, xpDoInimigo } from '../../shared/progresso.js';
import './_tudo-aberto.mjs';
import { MORAL as MORAL_REGRA } from '../../shared/dados.js'; MORAL_REGRA.nova = false; // a regra antiga da moral (faixas, Livre, cota de horas) continua atrás de MORAL.nova; a nova: moral-nova.mjs
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

ok(xpProximo(50) === 11723 && xpProximo(20) === 1478, 'até o Nv50 a curva é a mesma');
ok(Math.abs(xpProximo(75) / 36597 - 4) < 0.01 && Math.abs(xpProximo(100) / 85406 - 9) < 0.02, 'depois do 50: x4 no 75, x9 no 100');

const s = new Simulacao(MAPA_CLAREIRA);
const p = s.adicionarJogador('P', 'Pedro', undefined, { conta: 11 }); p.criando = false;
s.carregarClasNpc(null);
for (const ctx of s.amigosIa) ctx.amigaEntrar('P', false);
const C = CLAS_NPC.find((K) => K.id === 'geada'), E = s.clasNpc.geada;
const m = sortearRecruta(Math.random, CLA.tiers[0], 10, Date.now()); m.fn = { k: 'grind' }; E.m.push(m); s.criarRecrutaNpc(C, m, true);
const x = s.amigosIa.find((c) => c.AMIGA.id === m.id);
CLAS_NPC_ORDENS.ligado = false; // caminho do recruta do jogador (o do clã bot é grindForaBot)
const porHora = (nv) => CLA.fora.mobsHora * xpDoInimigo('puglin', nv, nv, NIVEL_INIMIGO);
const fora = (nv, h, lider = 200) => { x.amiga.prog.nivel = nv; x.amiga.prog.xp = 0; s.trabalhoFora(x, m, h, lider); return x.amiga.prog; };

let q = fora(20, 1); ok(q.nivel === 20 && q.xp === porHora(20), `Nv 20, 1 h: +${q.xp} XP (${(porHora(20) / xpProximo(20)).toFixed(2)} nível/h)`);
q = fora(20, 12); ok(q.nivel === 22 || q.nivel === 23, `Nv 20, 12 h: Nv ${q.nivel}`);
q = fora(75, 12); ok(q.nivel === 75 && q.xp === 12 * porHora(75), `Nv 75, 12 h: +${q.xp} de ${xpProximo(75)} XP`);
q = fora(8, 12, 10); ok(q.nivel === 10 && q.xp === 0, 'não passa do nível do líder e não guarda sobra');
q = fora(10, 3, 10); ok(q.nivel === 10 && q.xp === 0, 'já no nível do líder: nada');

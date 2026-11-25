// Kira, Rufo e Lis evoluem como a Cecília (plano de lançamento 2026-11-19, pedido do André): sobem de nível caçando,
// ganham o próprio ouro, reforçam o equipamento com ele e cada passo vai para o diário de evolução (/npcs.json, relatório
// das 10h). Sem rede. Uso: node ferramentas/testes/geada-evolui.mjs
import { readFileSync } from 'node:fs';
import { Simulacao, MAPA_CLAREIRA, RIVAIS, NPC_VIDA, xpProximo } from '../../shared/index.js';
import { CLAS_NPC_ORDENS } from '../../shared/dados.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA); s.adicionarJogador('p', 'P', 'ruiva', { conta: 9 });
for (const x of s.amigosIa) x.amigaEntrar('p', false);
const G = s.amigosIa.filter((x) => RIVAIS.some((d) => d.id === x.AMIGA.id));
ok(G.length === RIVAIS.length && G.length === 6 && G.every((g) => g.amiga), 'os seis da Geada (com Gael, Kael e Varek) entram no mundo');
const ini = new Map(G.map((g) => [g.AMIGA.id, { nv: g.amiga.prog.nivel, ouro: g.amiga.prog.ouro }]));
for (const g of G) { g.amiga.prog.xp = xpProximo(g.amiga.prog.nivel) - 30; g.amiga.ia.av = { fase: 'escolher' }; g.amiga.prog.dia = { h: ((NPC_VIDA.rotina[g.AMIGA.id] || NPC_VIDA.rotina.padrao).sai + 3) % 24, t: Date.now() }; /* no horário dele (o Gael caça de noite) */ g.amiga.missaoDia = { dia: new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10), seg: 1e9 }; g.amiga.ia.diariaFalhou = Infinity; } // aqui é a caça: missão da história (André 2026-11-21, a Geada também faz) e diárias já deram o tempo do dia // perto de subir, já saindo para caçar
// André 2026-11-23: Kira, Rufo e Lis obedecem ao Gael; aqui o Gael manda todos caçarem (a escolha da ordem tem teste próprio em cla-ordens.mjs)
s.passo(0.1);
{ const E = s.clasNpc?.geada; CLAS_NPC_ORDENS.ligado = false; if (E) { E.ordensT = Infinity; for (const f of Object.values(E.fx || {})) f.fn = { k: 'grind' }; for (const m of E.m || []) m.fn = { k: 'grind' }; } }
for (let i = 0; i < 25 * 60 * 10; i++) s.passo(0.1);
for (const g of G) {
  const a = g.amiga, n = g.AMIGA.nome, i0 = ini.get(g.AMIGA.id);
  ok(a.semTeto, `${n}: sobe sem o teto do jogador mais alto`);
  ok(a.prog.nivel > i0.nv, `${n}: subiu caçando (${i0.nv} -> ${a.prog.nivel})`);
  ok(a.evolucao.some((e) => e.o === 'nivel'), `${n}: a subida foi para o diário de evolução`);
  // André 2026-11-23: Kira, Rufo e Lis viraram recrutas do Gael (CLAS_NPC_ORDENS): farmando para o Baú do Clã o ouro
  // pode não mexer nesses 25 min; o ouro continua sendo dele
  const fx = s.clasNpc?.geada?.fx?.[g.AMIGA.id]?.fn;
  ok(a.prog.ouro !== i0.ouro || (fx && fx.k !== 'grind'), `${n}: o ouro é dele e mexeu (${i0.ouro} -> ${a.prog.ouro}${fx ? ', ordem do Gael: ' + fx.k + (fx.r ? ' ' + fx.r : '') : ''})`);
}
// reforço com o próprio ouro, como a Cecília
{
  const g = G[0], a = g.amiga; a.prog.ouro = 50000; a.evolucao.length = 0;
  for (const k of Object.keys(a.prog.atr)) a.prog.atr[k] = 999;
  a.prog.equip.espada = { k: 'espada', r: 2 }; // peça que ganhou caçando (Comum não tem reforço)
  const n = g.reforcoAmiga(a);
  ok(n > 0 && a.evolucao.some((e) => e.o === 'reforco') && a.prog.ouro < 50000, `${g.AMIGA.nome}: reforça o equipamento pagando (${n} tentativas, ouro ${a.prog.ouro})`);
}
// o relatório das 10h (/npcs.json) lista a Geada junto da Cecília e do Dário
const srv = readFileSync(new URL('../../server/index.js', import.meta.url), 'utf8');
ok(/for \(const D of \[\.\.\.AMIGOS_VIRTUAIS, \.\.\.RIVAIS\]\)/.test(srv), '/npcs.json lista Kira, Rufo e Lis');

// Kira, Rufo e Lis evoluem como a Cecília (plano de lançamento 2026-11-19, pedido do André): sobem de nível caçando,
// ganham o próprio ouro, reforçam o equipamento com ele e cada passo vai para o diário de evolução (/npcs.json, relatório
// das 10h). Sem rede. Uso: node ferramentas/testes/geada-evolui.mjs
import { readFileSync } from 'node:fs';
import { Simulacao, MAPA_CLAREIRA, RIVAIS, xpProximo } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA); s.adicionarJogador('p', 'P', 'ruiva', { conta: 9 });
for (const x of s.amigosIa) x.amigaEntrar('p', false);
const G = s.amigosIa.filter((x) => RIVAIS.some((d) => d.id === x.AMIGA.id));
ok(G.length === 3 && G.every((g) => g.amiga), 'os três da Geada entram no mundo');
const ini = new Map(G.map((g) => [g.AMIGA.id, { nv: g.amiga.prog.nivel, ouro: g.amiga.prog.ouro }]));
for (const g of G) { g.amiga.prog.xp = xpProximo(g.amiga.prog.nivel) - 30; g.amiga.ia.av = { fase: 'escolher' }; g.amiga.prog.dia = { h: 10, t: Date.now() }; g.amiga.missaoDia = { dia: new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10), seg: 1e9 }; g.amiga.ia.diariaFalhou = Infinity; } // aqui é a caça: missão da história (André 2026-11-21, a Geada também faz) e diárias já deram o tempo do dia // perto de subir, já saindo para caçar
for (let i = 0; i < 25 * 60 * 10; i++) s.passo(0.1);
for (const g of G) {
  const a = g.amiga, n = g.AMIGA.nome, i0 = ini.get(g.AMIGA.id);
  ok(a.semTeto, `${n}: sobe sem o teto do jogador mais alto`);
  ok(a.prog.nivel > i0.nv, `${n}: subiu caçando (${i0.nv} -> ${a.prog.nivel})`);
  ok(a.evolucao.some((e) => e.o === 'nivel'), `${n}: a subida foi para o diário de evolução`);
  ok(a.prog.ouro !== i0.ouro, `${n}: o ouro é dele e mexeu (${i0.ouro} -> ${a.prog.ouro})`);
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

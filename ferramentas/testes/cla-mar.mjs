// Recrutas no mar (André 2026-11-23: "quando eles estão no mar, eles somem do mapa... saem do meu time"; "nadando, de
// barco, de navio"). Uso: node ferramentas/testes/cla-mar.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { AGUA } from '../../shared/relevo.js';
import { fundoAgua } from '../../shared/transporte.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const L = s.adicionarJogador('L', 'Chefe', undefined, { conta: 51 }); L.criando = false; L.ciente = true; L.prog.nivel = 40; L.prog.ouro = 90000;
const r = s.mapa.npcs.find((n) => n.funcao === 'recrutador'); L.x = r.x + 1; L.z = r.z;
s.cla('L', { acao: 'fundar', nome: 'Teste Mar' }); L.prog.cla.nv = 6;
s.cla('L', { acao: 'recrutar', tier: 'recruta' }); s.cla('L', { acao: 'recrutar', tier: 'recruta' });
for (const m of L.prog.cla.m) s.cla('L', { acao: 'funcao', id: m.id, fn: { k: 'seguir' } });
const xs = s.recrutasNoMundo(L), as = xs.map((x) => x.amiga);
for (let i = 0; i < 20; i++) s.passo(0.05);
ok(as.every((a) => a.time && a.time === L.time), 'recrutas no time');
const por = (o, x, z) => { o.x = x; o.z = z; o.y = fundoAgua(x, z) > 0.05 ? AGUA.nivel : s.terreno.altura(x, z); o.vy = 0; o.chao = true; o.montado = null; o.veiculo = null; o.bordo = null; };
const cais = { x: 101.3, z: 454 };
por(L, cais.x, cais.z); L.y = 0.6;
as.forEach((a, i) => por(a, cais.x - 4 - i, cais.z - 4));
L.prog.mochila[L.prog.mochila.indexOf(null)] = { k: 'navio', n: 1 };
s.veiculo('L', { acao: 'colocar', k: 'navio' }); s.veiculo('L', { acao: 'subir', k: 'navio' });
ok(L.veiculo === 'navio', 'líder no leme');
for (let i = 0; i < 20 * 20 && !as.every((a) => a.bordo); i++) s.passo(0.05);
ok(as.every((a) => a.bordo), 'subiram no navio');
const log = [];
for (let i = 0; i < 20 * 120; i++) {
  L.x += 0.4; L.z += 0.25; s.passo(0.05);
  as.forEach((a, k) => { if (!(a.time && a.time === L.time) && !log[k]) log[k] = `t=${(i * 0.05).toFixed(1)} ${xs[k].AMIGA.nome} saiu: bordo=${!!a.bordo} morto=${a.morto} mundo=${s.jogadores.has(a.id)} x=${a.x.toFixed(0)},${a.z.toFixed(0)} fn=${JSON.stringify(a.ia.funcao)}`; });
}
if (log.length) console.log(log.filter(Boolean).join('\n'));
ok(as.every((a) => a.time && a.time === L.time && s.jogadores.has(a.id)), 'navegando 2 min: continuam no time e no mundo');
ok(as.every((a) => Math.hypot(a.x - L.x, a.z - L.z) < 15), `vão junto (${as.map((a) => Math.hypot(a.x - L.x, a.z - L.z).toFixed(0)).join(', ')} m)`);

// o app caiu no meio do mar (ou o servidor reiniciou), com eles no time pela conversa (função Livre): o líder volta e eles
// voltam para o time e para o lado dele (antes: saíam do time e iam para onde a função mandava)
for (const m of L.prog.cla.m) s.cla('L', { acao: 'funcao', id: m.id, fn: { k: 'livre' } });
for (const x of xs) if (!(x.amiga.time && x.amiga.time === L.time)) x.entrarTimeAmiga(x.amiga, L);
ok(as.every((a) => a.time && a.time === L.time), 'no time pela conversa, função Livre');
s.sairRecrutas(L); // a ordem do servidor (server/index.js onLeave)
for (const ctx of s.amigosIa) ctx.amigaSair('L');
ok(as.every((a) => !s.jogadores.has(a.id)), 'a conexão caiu: saíram do mundo junto');
s.entrarRecrutas(L);
const as2 = s.recrutasNoMundo(L).map((x) => x.amiga);
ok(as2.length === 2 && as2.every((a) => a.time && a.time === L.time), 'voltou: eles voltam para o time');
ok(as2.every((a) => Math.hypot(a.x - L.x, a.z - L.z) < 5), `e do lado dele (${as2.map((a) => Math.hypot(a.x - L.x, a.z - L.z).toFixed(1)).join(', ')} m)`);
for (let i = 0; i < 20 * 30; i++) { L.x += 0.4; L.z += 0.25; s.passo(0.05); }
ok(as2.every((a) => a.time === L.time && s.jogadores.has(a.id) && Math.hypot(a.x - L.x, a.z - L.z) < 15), `30 s depois, no navio com ele (${as2.map((a) => `${Math.hypot(a.x - L.x, a.z - L.z).toFixed(0)} m${a.bordo ? ' a bordo' : ''}`).join(', ')})`);
// saiu de vez (mais que CLA.voltaTime): a ordem de time acaba, vale a função do painel
s.sairRecrutas(L); // a ordem do servidor (server/index.js onLeave)
for (const ctx of s.amigosIa) ctx.amigaSair('L');
for (const m of L.prog.cla.m) m.time -= 3600e3;
s.entrarRecrutas(L);
ok(s.recrutasNoMundo(L).every((x) => !(x.amiga.time && x.amiga.time === L.time)), 'voltou 1 h depois: segue a função do painel (fora do time)');
// com outro jogador online eles ficam no mundo (a função do painel); o líder voltando logo, voltam para o time
{
  const O = s.adicionarJogador('O', 'Outro', undefined, { conta: 52 }); O.criando = false;
  for (const x of s.recrutasNoMundo(L)) if (!(x.amiga.time && x.amiga.time === L.time)) x.entrarTimeAmiga(x.amiga, L);
  s.cobrarCla(L); // a marca de minuto em minuto (servidor reiniciando não passa pelo onLeave)
  ok(L.prog.cla.m.every((m) => m.time > 0), 'marca de minuto: estão no time');
  s.sairRecrutas(L); for (const ctx of s.amigosIa) ctx.amigaSair('L');
  const xs3 = s.recrutasNoMundo(L);
  ok(xs3.length === 2 && xs3.every((x) => x.amiga && !x.amiga.time), 'outro jogador online: ficam no mundo, fora do time');
  s.cobrarCla(L); s.entrarRecrutas(L);
  ok(xs3.every((x) => x.amiga.time && x.amiga.time === L.time), 'o líder voltou: de volta ao time');
}

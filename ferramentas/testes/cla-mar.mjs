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
// "Proteger mercante" com eles no time (André 2026-11-23: "larguei eles no mercante, eles já saíram do meu time"):
// continuam no time e protegem o navio
{
  const s2 = new Simulacao(MAPA_CLAREIRA);
  const L2 = s2.adicionarJogador('L2', 'Chefe', undefined, { conta: 61 }); L2.criando = false; L2.ciente = true; L2.prog.nivel = 40; L2.prog.ouro = 90000;
  const r2 = s2.mapa.npcs.find((n) => n.funcao === 'recrutador'); L2.x = r2.x + 1; L2.z = r2.z;
  s2.cla('L2', { acao: 'fundar', nome: 'Teste Merc' }); L2.prog.cla.nv = 6;
  s2.cla('L2', { acao: 'recrutar', tier: 'recruta' }); s2.cla('L2', { acao: 'recrutar', tier: 'recruta' });
  for (const m of L2.prog.cla.m) s2.cla('L2', { acao: 'funcao', id: m.id, fn: { k: 'seguir' } });
  const bs = s2.recrutasNoMundo(L2).map((x) => x.amiga);
  const p2 = (o, x, z) => { o.x = x; o.z = z; o.y = fundoAgua(x, z) > 0.05 ? AGUA.nivel : s2.terreno.altura(x, z); o.vy = 0; o.chao = true; o.montado = null; o.veiculo = null; o.bordo = null; };
  p2(L2, 101.3, 454); L2.y = 0.6; bs.forEach((a, i) => p2(a, 98 - i, 451));
  L2.prog.mochila[L2.prog.mochila.indexOf(null)] = { k: 'navio', n: 1 };
  s2.veiculo('L2', { acao: 'colocar', k: 'navio' });
  for (const m of L2.prog.cla.m) s2.cla('L2', { acao: 'funcao', id: m.id, fn: { k: 'proteger', p: 'mercante' } });
  ok(bs.every((a) => a.time && a.time === L2.time), 'Proteger mercante: continuam no time');
  s2.veiculo('L2', { acao: 'subir', k: 'navio' });
  for (let i = 0; i < 20 * 10; i++) s2.passo(0.05);
  for (let i = 0; i < 20 * 20; i++) { L2.x += 0.2; s2.passo(0.05); }
  ok(bs.every((a) => a.time && a.time === L2.time && a.bordo), `no mar: no time e no convés (${bs.map((a) => Math.hypot(a.x - L2.x, a.z - L2.z).toFixed(0)).join(', ')} m)`);
  for (const m of L2.prog.cla.m) s2.cla('L2', { acao: 'funcao', id: m.id, fn: { k: 'grind' } });
  ok(bs.every((a) => !a.time), 'Grind: saem do time para trabalhar (como antes)');
}
// nadando com pack nas costas (mais devagar): o líder chega do outro lado e eles não ficam parados no meio do mar
{
  const s3 = new Simulacao(MAPA_CLAREIRA);
  const L3 = s3.adicionarJogador('L3', 'Chefe', undefined, { conta: 71 }); L3.criando = false; L3.ciente = true; L3.prog.nivel = 40; L3.prog.ouro = 90000;
  const r3 = s3.mapa.npcs.find((n) => n.funcao === 'recrutador'); L3.x = r3.x + 1; L3.z = r3.z;
  s3.cla('L3', { acao: 'fundar', nome: 'Teste Nado' }); L3.prog.cla.nv = 6;
  s3.cla('L3', { acao: 'recrutar', tier: 'recruta' }); s3.cla('L3', { acao: 'recrutar', tier: 'recruta' });
  for (const m of L3.prog.cla.m) s3.cla('L3', { acao: 'funcao', id: m.id, fn: { k: 'seguir' } });
  const cs = s3.recrutasNoMundo(L3).map((x) => x.amiga);
  const p3 = (o, x, z) => { o.x = x; o.z = z; o.y = fundoAgua(x, z) > 0.05 ? AGUA.nivel : s3.terreno.altura(x, z); o.vy = 0; o.chao = true; o.montado = null; o.veiculo = null; o.bordo = null; };
  p3(L3, 101.3, 454); cs.forEach((a, i) => { p3(a, 97 - i, 450); a.prog.pack = { k: 'lenha', ox: 0, oz: 0, t: Date.now() }; });
  for (let i = 0; i < 20 * 40; i++) { if (i < 20 * 37) { L3.x += 0.2; L3.z += 0.15; L3.y = fundoAgua(L3.x, L3.z) > 0.05 ? AGUA.nivel : s3.terreno.altura(L3.x, L3.z); } s3.passo(0.05); }
  for (let i = 0; i < 20 * 60; i++) s3.passo(0.05);
  ok(cs.every((a) => a.time && a.time === L3.time && Math.hypot(a.x - L3.x, a.z - L3.z) < 8), `com pack, nadaram até ele (${cs.map((a) => Math.hypot(a.x - L3.x, a.z - L3.z).toFixed(0)).join(', ')} m)`);
}
// outra terra sem barco (André 2026-11-23, print: "Você tá em outra terra. Sem barco não chego, te espero por aqui"):
// vão até a praia e nadam até o líder
{
  const { terraId } = await import('../../shared/rota.js');
  const s4 = new Simulacao(MAPA_CLAREIRA);
  const L4 = s4.adicionarJogador('L4', 'Chefe', undefined, { conta: 81 }); L4.criando = false; L4.ciente = true; L4.prog.nivel = 40; L4.prog.ouro = 90000;
  const r4 = s4.mapa.npcs.find((n) => n.funcao === 'recrutador'); L4.x = r4.x + 1; L4.z = r4.z;
  s4.cla('L4', { acao: 'fundar', nome: 'Teste Ilha' }); L4.prog.cla.nv = 6;
  s4.cla('L4', { acao: 'recrutar', tier: 'recruta' }); s4.cla('L4', { acao: 'recrutar', tier: 'recruta' });
  for (const m of L4.prog.cla.m) s4.cla('L4', { acao: 'funcao', id: m.id, fn: { k: 'seguir' } });
  const ds = s4.recrutasNoMundo(L4).map((x) => x.amiga);
  const p4 = (o, x, z) => { o.x = x; o.z = z; o.y = fundoAgua(x, z) > 0.05 ? AGUA.nivel : s4.terreno.altura(x, z); o.vy = 0; o.chao = true; o.montado = null; o.veiculo = null; o.bordo = null; };
  p4(L4, 241, 624); ds.forEach((a, i) => p4(a, 80 - i * 2, 440));
  ok(ds.every((a) => terraId(a.x, a.z) > 0 && terraId(a.x, a.z) !== terraId(L4.x, L4.z) && !a.prog.mochila.some((o) => o?.k === 'barquinho')), 'em outra terra, sem barquinho');
  const falas = []; const ev = s4.evento.bind(s4); s4.evento = (e) => { if (e.t === 'chat' || e.texto) falas.push(e.texto || e.msg || ''); return ev(e); };
  let nadou = false;
  for (let i = 0; i < 20 * 240 && !ds.every((a) => Math.hypot(a.x - L4.x, a.z - L4.z) < 8); i++) { s4.passo(0.05); if (ds.some((a) => terraId(a.x, a.z) === 0 || fundoAgua(a.x, a.z) > 1)) nadou = true; }
  ok(nadou, 'entraram no mar nadando');
  ok(ds.every((a) => a.time === L4.time && Math.hypot(a.x - L4.x, a.z - L4.z) < 8), `chegaram nele na outra terra (${ds.map((a) => Math.hypot(a.x - L4.x, a.z - L4.z).toFixed(0)).join(', ')} m)`);
  ok(!falas.some((t) => /Sem barco/.test(String(t))), 'ninguém fala "sem barco não chego"');
}
// Proteger mercante com o navio do outro lado do mar: vão nadando e sobem no convés
{
  const { terraId } = await import('../../shared/rota.js');
  const s5 = new Simulacao(MAPA_CLAREIRA);
  const L5 = s5.adicionarJogador('L5', 'Chefe', undefined, { conta: 91 }); L5.criando = false; L5.ciente = true; L5.prog.nivel = 40; L5.prog.ouro = 90000;
  const r5 = s5.mapa.npcs.find((n) => n.funcao === 'recrutador'); L5.x = r5.x + 1; L5.z = r5.z;
  s5.cla('L5', { acao: 'fundar', nome: 'Teste Merc2' }); L5.prog.cla.nv = 6;
  s5.cla('L5', { acao: 'recrutar', tier: 'recruta' });
  const e = s5.recrutasNoMundo(L5)[0].amiga, m = L5.prog.cla.m[0];
  const p5 = (o, x, z) => { o.x = x; o.z = z; o.y = fundoAgua(x, z) > 0.05 ? AGUA.nivel : s5.terreno.altura(x, z); o.vy = 0; o.chao = true; o.montado = null; o.veiculo = null; o.bordo = null; };
  p5(L5, 101.3, 454); L5.y = 0.6;
  L5.prog.mochila[L5.prog.mochila.indexOf(null)] = { k: 'navio', n: 1 };
  s5.veiculo('L5', { acao: 'colocar', k: 'navio' });
  p5(L5, 103, 450);
  s5.cla('L5', { acao: 'funcao', id: m.id, fn: { k: 'proteger', p: 'mercante' } });
  p5(e, 241, 624);
  ok(terraId(e.x, e.z) > 0 && terraId(e.x, e.z) !== terraId(L5.x, L5.z), 'recruta na outra terra');
  for (let i = 0; i < 20 * 240 && !e.bordo; i++) s5.passo(0.05);
  ok(!!e.bordo, `Proteger mercante: foi nadando e subiu no navio (${Math.hypot(e.x - L5.prog.navio.chao.x, e.z - L5.prog.navio.chao.z).toFixed(0)} m do navio)`);
}

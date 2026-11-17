// Árvores plantadas (André 2026-11-16, entrega 3): semente da Rosa, área de plantio ou terreno, quadrado de 4 m, muda e
// jovem ninguém corta, a adulta dá o que o tipo promete e some, limite de mudas, XP na hora, banco e foto só de perto.
// Uso: node ferramentas/testes/plantio.mjs
import { Simulacao, MAPA_CLAREIRA, ARVORES_PLANTIO, PLANTIO, LOJA, ITENS, QUADRADOS_PLANTIO, lugarNoQuadrado, contar } from '../../shared/index.js';
import { Visao } from '../../server/visao.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

let relogio = 1_000_000_000_000;
const s = new Simulacao(MAPA_CLAREIRA); s.relogioMs = () => relogio;
for (const e of s.inimigos) { e.x += 1e5; e.z += 1e5; }
const a = s.adicionarJogador('A', 'Ana'), b = s.adicionarJogador('B', 'Beto');
for (const j of [a, b]) { j.ciente = true; j.prog.vigor = { v: 999, t: Date.now() }; j.prog.mochila[j.prog.mochila.indexOf(null)] = { k: 'machado', n: 1 }; }
const dar = (j, k, n) => { j.prog.mochila[j.prog.mochila.indexOf(null)] = { k, n }; };
const avisos = (evs, para) => evs.filter((e) => e.t === 'aviso' && e.para === para).map((e) => e.texto);
const ir = (j, x, z) => { j.x = x; j.z = z; s.passo(0.05); j.x = x; j.z = z; };

// dados: 6 tipos, sementes na loja, áreas do mapa v6
ok(Object.keys(ARVORES_PLANTIO).length === 6, '6 tipos de árvore');
ok(Object.keys(ARVORES_PLANTIO).every((k) => LOJA.some((l) => l.k === 'semente_' + k) && ITENS['semente_' + k]), 'as 6 sementes estão na loja da Rosa');
ok(PLANTIO.areas.length >= 130 && QUADRADOS_PLANTIO.size > 11500, `${PLANTIO.areas.length} áreas de plantio, ${QUADRADOS_PLANTIO.size} quadrados de 4 m`);
// nenhum quadrado em cima de árvore nativa ou pedra (o plantio nunca fica impossível de cara em muitos lugares)
{
  let presos = 0;
  for (const key of QUADRADOS_PLANTIO.keys()) { const [i, k] = key.split(',').map(Number), l = lugarNoQuadrado(i, k); if (s.pertoNaMata(l.x, l.z).some((o) => Math.hypot(o.x - l.x, o.z - l.z) < o.r + PLANTIO.folga)) presos++; }
  ok(presos < QUADRADOS_PLANTIO.size * 0.05, `poucos quadrados presos por árvore nativa ou pedra (${presos})`);
}
// um quadrado livre de uma área
const livre = [...QUADRADOS_PLANTIO.keys()].map((k) => k.split(',').map(Number)).find(([i, k]) => { const l = lugarNoQuadrado(i, k); return !s.pertoNaMata(l.x, l.z).some((o) => Math.hypot(o.x - l.x, o.z - l.z) < o.r + PLANTIO.folga + 3); });
const [qi, qk] = livre, L = lugarNoQuadrado(qi, qk);

// fora da área: não planta
dar(a, 'semente_betula', 20);
ir(a, 0, 0); s.eventos = [];
s.plantarArvore('A', { s: 'betula', x: 0, z: 0 });
ok(avisos(s.eventos, 'A').some((t) => /área de plantio/.test(t)) && s.plantadas.size === 0, 'na vila não planta: ' + avisos(s.eventos, 'A'));

// na área: planta, paga XP, gasta semente
ir(a, L.x, L.z - 1.5); s.eventos = [];
const xp0 = a.prog.xp, len0 = a.prog.prof.len || 0, sem0 = contar(a.prog.mochila, 'semente_betula');
s.plantarArvore('A', { s: 'betula', x: L.x, z: L.z });
const P = [...s.plantadas.values()][0];
ok(P && Math.abs(P.x - L.x) < 0.01 && Math.abs(P.z - L.z) < 0.01, 'plantou no quadrado, no lugar sorteado: ' + JSON.stringify(P));
ok(contar(a.prog.mochila, 'semente_betula') === sem0 - 1, 'gastou 1 semente');
ok((a.prog.prof.len || 0) > len0 && (a.prog.xp !== xp0 || a.prog.nivel > 1), 'ganhou Lenhador e XP na hora');
ok(s.coletaveis.get(P.id)?.plantada, 'virou árvore de cortar (coletável)');
// mesmo quadrado: vai para o vizinho mais perto
s.plantarArvore('A', { s: 'betula', x: L.x, z: L.z });
const P2 = [...s.plantadas.values()][1];
ok(P2 && Math.hypot(P2.x - P.x, P2.z - P.z) >= 2.4 - 1e-6, 'o mesmo quadrado não repete: vai para o vizinho, com 2,4 m ou mais entre troncos');

// muda não se corta
ir(b, P.x + 1, P.z); s.eventos = [];
s.coletar('B', { no: P.id });
ok(!b.coleta && avisos(s.eventos, 'B').some((t) => /crescendo/.test(t)), 'muda ninguém corta: ' + avisos(s.eventos, 'B'));

// a foto só leva de perto, uma vez, com o tempo para ficar adulta
const v = new Visao((id) => s.coletaveis.get(id));
let f = JSON.parse(v.paraJogador(v.preparar(s.foto(), []), 'B')).foto.plantadas;
ok(f.length === 2 && f[0][1] === 'betula' && Math.abs(f[0][6] - ARVORES_PLANTIO.betula.h * 3600) < 2, 'quem está perto recebe [id, tipo, x, z, ry, escala, s para adulta]: ' + JSON.stringify(f[0]));
f = JSON.parse(v.paraJogador(v.preparar(s.foto(), []), 'B')).foto.plantadas;
ok(f.length === 0, 'na foto seguinte não vai de novo');
b.x = 1e5; s.passo(0.05);
ok(JSON.parse(v.paraJogador(v.preparar(s.foto(), []), 'B')).foto.plantadas.length === 0, 'longe: nada');

// cresceu: B corta e ganha o que a bétula dá; ela some e o quadrado fica livre
relogio += ARVORES_PLANTIO.betula.h * 3600 * 1000 + 1000;
ir(b, P.x + 1, P.z); s.eventos = [];
const lenha0 = contar(b.prog.mochila, 'lenha');
s.coletar('B', { no: P.id });
ok(b.coleta, 'adulta: B começou a cortar');
let caiu = null;
for (let t = 0; t < 400 && !caiu; t++) caiu = s.passo(0.05).find((e) => e.t === 'veio' && e.no === P.id && e.cargas === 0);
ok(caiu, 'a árvore plantada cai para todos');
const ganhou = contar(b.prog.mochila, 'lenha') - lenha0;
ok(ganhou >= ARVORES_PLANTIO.betula.lenha, `deu ${ganhou} lenha (bétula: ${ARVORES_PLANTIO.betula.lenha})`);
ok(!s.plantadas.has(P.id) && !s.coletaveis.has(P.id) && !s.plantioQ.has(qi + ',' + qk), 'sumiu e o quadrado ficou livre');
// quem já tinha recebido fica sabendo que sumiu
for (let i = 0; i < 20; i++) f = JSON.parse(v.paraJogador(v.preparar(s.foto(), []), 'B')).foto.plantadas.concat(f || []);
ok(f.some((x) => x.length === 1 && x[0] === P.id), 'quem tinha recebido recebe [id] (sumiu)');

// limite de mudas nas áreas
{
  const c = s.adicionarJogador('C', 'Caio'); c.ciente = true; c.prog.vigor = { v: 999, t: Date.now() }; dar(c, 'semente_carvalho', 40);
  const area = PLANTIO.areas.find((A) => A.id === 'f1');
  const qs = [...QUADRADOS_PLANTIO].filter(([, id]) => id === area.id).map(([k]) => k.split(',').map(Number));
  let plantou = 0;
  for (const [i, k] of qs) { if (plantou > PLANTIO.mudasMax + 2) break; const l = lugarNoQuadrado(i, k); const n0 = s.plantadas.size; ir(c, l.x, l.z); s.plantarArvore('C', { s: 'carvalho', x: l.x, z: l.z }); if (s.plantadas.size > n0) plantou++; else if (avisos(s.eventos, 'C').some((t) => /mudas crescendo/.test(t))) break; }
  ok(plantou === PLANTIO.mudasMax, `para em ${PLANTIO.mudasMax} mudas crescendo (plantou ${plantou})`);
}
// árvore antiga ocupa 2 x 2
{
  const d = s.adicionarJogador('D', 'Davi'); d.ciente = true; d.prog.vigor = { v: 999, t: Date.now() }; dar(d, 'semente_antiga', 2);
  const k2 = [...QUADRADOS_PLANTIO.keys()].map((k) => k.split(',').map(Number)).find(([i, k]) => [[0, 0], [1, 0], [0, 1], [1, 1]].every(([di, dk]) => QUADRADOS_PLANTIO.has(i + di + ',' + (k + dk)) && !s.plantioQ.has(i + di + ',' + (k + dk))) && (() => { const l = lugarNoQuadrado(i, k, true); return !s.pertoNaMata(l.x, l.z).some((o) => Math.hypot(o.x - l.x, o.z - l.z) < o.r + 4); })());
  const l = lugarNoQuadrado(k2[0], k2[1], true);
  ir(d, l.x, l.z); s.plantarArvore('D', { s: 'antiga', x: l.x, z: l.z });
  const T = [...s.plantadas.values()].find((p) => p.s === 'antiga');
  ok(T && [[0, 0], [1, 0], [0, 1], [1, 1]].every(([di, dk]) => s.plantioQ.get(k2[0] + di + ',' + (k2[1] + dk)) === T.id), 'a árvore antiga ocupa 2 x 2 quadrados');
}

// banco: grava, reinicia, continua crescendo do mesmo ponto
{
  const salvo = s.plantioParaSalvar();
  ok(Array.isArray(salvo) && salvo.length === s.plantadas.size, `grava ${salvo.length} árvores`);
  ok(s.plantioParaSalvar() === null, 'nada mudou: não grava de novo');
  const s2 = new Simulacao(MAPA_CLAREIRA); s2.relogioMs = () => relogio + 3600 * 1000;
  s2.carregarPlantio(JSON.parse(JSON.stringify(salvo)));
  ok(s2.plantadas.size === s.plantadas.size && [...s.plantioQ.keys()].every((k) => s2.plantioQ.has(k)), 'depois do reinício: as mesmas árvores nos mesmos quadrados');
  const P3 = [...s.plantadas.values()].find((p) => p.s === 'carvalho');
  ok(s2.adultaEm(s2.plantadas.get(P3.id)) === s.adultaEm(P3), 'a hora de ficar adulta continua a mesma');
  ok(s2.plantioProx > Math.max(...[...s.plantadas.keys()].map((k) => +k.slice(1))), 'o próximo id não repete');
  s2.carregarPlantio([[99, 'nada', 0, 0], [100, 'betula', P3.x, P3.z]]);
  ok(!s2.plantadas.has('p99') && !s2.plantadas.has('p100'), 'ignora tipo que não existe e quadrado já ocupado');
}

// modo plantio do app (André 2026-11-16 14:04): o quadrado tocado, exato; ocupado não vai para o vizinho
{
  const e = s.adicionarJogador('E', 'Edu'); e.ciente = true; e.prog.vigor = { v: 999, t: Date.now() }; dar(e, 'semente_betula', 5);
  const area = PLANTIO.areas.find((A) => A.id === 'f20') || PLANTIO.areas[PLANTIO.areas.length - 1];
  const livres = [...QUADRADOS_PLANTIO].filter(([k, id]) => id === area.id && !s.plantioQ.has(k)).map(([k]) => k.split(',').map(Number))
    .filter(([i, k]) => { const l = lugarNoQuadrado(i, k); return !s.pertoNaMata(l.x, l.z).some((o) => Math.hypot(o.x - l.x, o.z - l.z) < o.r + PLANTIO.folga + 1); });
  const [i, k] = livres[0], cx = i * 4 + 2, cz = k * 4 + 2;
  ir(e, cx + 1, cz); s.eventos = [];
  s.plantarArvore('E', { s: 'betula', x: cx, z: cz, q: 1 });
  ok(s.plantioQ.has(i + ',' + k), 'modo plantio: planta no quadrado tocado (área nova ' + area.id + ')');
  const n0 = s.plantadas.size; s.eventos = [];
  s.plantarArvore('E', { s: 'betula', x: cx, z: cz, q: 1 });
  ok(s.plantadas.size === n0 && avisos(s.eventos, 'E').some((t) => /Já tem árvore/.test(t)), 'quadrado tocado ocupado: não planta no vizinho');
}

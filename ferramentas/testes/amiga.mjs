// Cecília, a amiga (shared/amiga.js, André 2026-11-09): entra com o dono, levanta a casa inteira, cuida da horta,
// só o dono conversa, pede ajuda e paga de volta, guarda tudo no terreno e não ocupa vaga nas Terras.
// Uso: node ferramentas/testes/amiga.mjs
import { Simulacao, MAPA_CLAREIRA, AMIGA, ITENS } from '../../shared/index.js';
import { contar } from '../../shared/progresso.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
s.adicionarJogador('andre', 'André', 'ruiva', {});
s.adicionarJogador('outro', 'Outro', 'ruiva', {});
s.amigaEntrar('andre');
const a = s.amiga, L = s.loteDaAmiga();
ok(a && a.bot && L && L.dono === AMIGA.conta, `ela entrou com terreno ${L?.def.x0},${L?.def.z0} a ${L?.def.x1},${L?.def.z1}`);
ok(s.eventos.some((e) => e.t === 'amiga' && e.para === 'andre'), 'só o dono recebe o aviso de quem ela é');
for (let i = 0; i < 20 * 900; i++) s.passo(0.05);
ok(L.pecas.length === AMIGA.casa.length, `casa inteira: ${L.pecas.length} de ${AMIGA.casa.length} peças`);
ok(Object.keys(L.horta).length === AMIGA.horta.w * AMIGA.horta.d && Object.values(L.horta).every((t) => t.c), `horta: ${Object.keys(L.horta).length} canteiros plantados`);
const f = s.foto().jogadores.find((j) => j.id === AMIGA.id);
ok(f && f.bot === 1 && f.roupa.includes('capa2') && f.visual === 'victoria', 'na foto: bot, corpo victoria e capa');
ok(!s.inimigosDe(s.inimigos[0] || { tipo: 'lobo' }).includes(a), 'monstro não mira nela');
// conversa: o outro não recebe nada; o dono recebe
const perto = (id) => Object.assign(s.jogadores.get(id), { x: a.x + 1, z: a.z });
perto('outro'); s.eventos = []; s.conversaAmiga('outro', { acao: 'oi' });
ok(!s.eventos.some((e) => e.t === 'fala'), 'o outro jogador não conversa com ela');
perto('andre'); s.eventos = []; s.conversaAmiga('andre', { acao: 'oi' });
ok(s.eventos.some((e) => e.t === 'fala' && e.para === 'andre' && e.npc === AMIGA.id), 'o dono conversa');
// pedido e o Dar: tira da mochila do André, ela paga de volta e a amizade sobe
a.pedido = { k: 'lenha', n: 5 };
const dono = s.jogadores.get('andre');
dono.prog.mochila[0] = { k: 'lenha', n: 7 };
const ouro0 = dono.prog.ouro, amz0 = a.amizade;
s.eventos = []; s.conversaAmiga('andre', { acao: 'dar' });
const sobrou = dono.prog.mochila.filter((o) => o?.k === 'lenha').reduce((t, o) => t + o.n, 0);
ok(sobrou === 2 && a.pedido === null && a.amizade === amz0 + 1, 'Dar: 5 lenha saíram, pedido cumprido, amizade +1');
ok(dono.prog.ouro > ouro0 || dono.prog.mochila.some((o) => o && AMIGA.plantas.includes(o.k)), 'ela pagou de volta (ouro ou colheita)');
// troca e time com ela são ignorados (fases 2 e 3)
s.troca('andre', { acao: 'pedir', com: AMIGA.id });
ok(!a.pedidoTroca && !s.eventos.some((e) => e.t === 'troca' && e.para === AMIGA.id), 'pedido de troca com ela é ignorado');
// guarda no terreno e o terreno dela não conta na vaga das Terras
s.guardarAmiga();
const salvo = s.lotesParaSalvar().find((l) => l.id === L.def.id);
ok(salvo?.dados?.amiga?.prog && salvo.dados.amiga.amizade === a.amizade, 'bolsa e amizade vão junto com o terreno');
s.amigaSair('outro');
ok(s.amiga === a, 'sair de outro jogador não tira ela');
s.amigaSair('andre');
ok(!s.amiga && !s.jogadores.has(AMIGA.id), 'sai junto com o dono');
// volta com o que tinha
const s2 = new Simulacao(MAPA_CLAREIRA);
s2.carregarLotes([salvo]);
s2.adicionarJogador('andre', 'André', 'ruiva', {});
s2.amigaEntrar('andre');
ok(s2.loteDaAmiga()?.pecas.length === AMIGA.casa.length && s2.amiga.amizade === a.amizade, 'volta com a casa e a amizade');
ok(ITENS.lenha, 'itens');

// ---------- fase 2: time e combate ----------
{
  const s3 = new Simulacao(MAPA_CLAREIRA);
  const d = s3.adicionarJogador('andre', 'André', 'ruiva', {});
  s3.amigaEntrar('andre');
  const c = s3.amiga;
  const rnd = Math.random;
  // recusa (sorteio alto) com o motivo, e espera para chamar de novo
  Math.random = () => 0.999;
  Object.assign(d, { x: c.x + 1, z: c.z }); s3.eventos = []; s3.conversaAmiga('andre', { acao: 'time' });
  ok(!c.time && s3.eventos.some((e) => e.t === 'fala' && e.npc === AMIGA.id), 'recusou o time com um motivo');
  Math.random = () => 0; s3.eventos = []; s3.conversaAmiga('andre', { acao: 'time' });
  ok(!c.time && s3.eventos.some((e) => e.texto === AMIGA.falas.recusa.jaFalei), 'chamou de novo logo: "já te falei"');
  c.ia.recusaAte = 0; s3.conversaAmiga('andre', { acao: 'time' });
  Math.random = rnd;
  ok(c.time && d.time === c.time && c.time.membros.length === 2, 'aceitou e entrou no time do dono');
  // vontade: amizade sobe a chance, nível muito acima baixa e diz o motivo
  c.amizade = 0; const v0 = s3.vontadeAmiga(c, d).p; c.amizade = 4; const v1 = s3.vontadeAmiga(c, d).p;
  d.prog.nivel = 40; const v2 = s3.vontadeAmiga(c, d); d.prog.nivel = 1;
  ok(v1 > v0 && v2.p < v1 && v2.motivo === 'perigo', `vontade: ${v0.toFixed(2)} sem amizade, ${v1.toFixed(2)} com amizade, ${v2.p.toFixed(2)} com o dono 39 níveis acima (${v2.motivo})`);
  // segue o dono
  Object.assign(d, { x: -1, z: 12, y: s3.terreno.altura(-1, 12), ry: 0 });
  for (let i = 0; i < 20 * 30; i++) s3.passo(0.05);
  ok(Math.hypot(c.x - d.x, c.z - d.z) < 5, `segue o dono (a ${Math.hypot(c.x - d.x, c.z - d.z).toFixed(1)} m)`);
  // luta: o dono para perto de um monstro e entra em combate; ela bate e ganha XP
  for (let i = 0; i < 20 * 5; i++) s3.passo(0.05);
  const m = s3.inimigos.find((e) => !e.morto && !e.treino && !e.sub);
  Object.assign(d, { x: m.x + 2, z: m.z + 2, y: m.y, vida: 1e6, vidaMax: 1e6 });
  Object.assign(c, { x: d.x + 1, z: d.z, y: d.y });
  const xp0 = c.prog.xp, nv0 = c.prog.nivel; let bateu = 0;
  const ferir = s3.ferir.bind(s3); s3.ferir = (alvo, n, de, h) => { if (de === c) bateu++; return ferir(alvo, n, de, h); };
  for (let i = 0; i < 20 * 40; i++) { d.combateAte = s3.tempo + 5; d.vida = 1e6; s3.passo(0.05); }
  ok(bateu > 3, `ela lutou: ${bateu} golpes nos monstros`);
  ok(c.prog.xp > xp0 || c.prog.nivel > nv0, `ganhou XP no time (nível ${c.prog.nivel}, XP ${c.prog.xp})`);
  // pouca vida: bebe poção
  const p0 = contar(c.prog.mochila, 'pocao'); c.vida = c.vidaMax * 0.2; c.ia.pocaoT = 0; c.pocaoAte = {}; // sem a recarga de uma poção que ela já bebeu na luta
  for (let i = 0; i < 20 && c.ia.pocaoT === 0; i++) { c.vida = c.vidaMax * 0.2; s3.passo(0.05); } // espera o golpe em andamento acabar
  ok(contar(c.prog.mochila, 'pocao') === p0 - 1, 'bebeu poção com pouca vida');
  // o dono tira ela do time pela conversa
  Object.assign(d, { x: c.x + 1, z: c.z }); s3.conversaAmiga('andre', { acao: 'sair' });
  for (let i = 0; i < 20; i++) s3.passo(0.05);
  ok(!c.time && !d.time, 'saiu do time e o time acabou');
  // um monstro não mira nela fora do time
  ok(!s3.inimigosDe(m).includes(c), 'fora do time os monstros não miram nela');
}

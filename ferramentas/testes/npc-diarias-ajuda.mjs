// Bots fazendo diárias e missões da história (André 2026-11-21: "quero que eles façam as missões diárias e também as
// missões de história principais e que se eu perguntar eles me falem qual missão estão fazendo e eu poder me oferecer
// pra ajudar"). Sem rede. Uso: node ferramentas/testes/npc-diarias-ajuda.mjs
let agora = Date.parse('2026-11-21T13:00:00Z'); Date.now = () => agora; // 10h de Brasília, hora de sair
// sorte com semente (mulberry32, como em _relogio-fixo.mjs): o mesmo resultado no CI e aqui. SEMENTE=n troca
{ let x = (Number(process.env.SEMENTE ?? 1) >>> 0) || 1; Math.random = () => { x = (x + 0x6d2b79f5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const { Simulacao, MAPA_CLAREIRA, NPC_VIDA, DESPENSA } = await import('../../shared/index.js');
// este teste é das diárias: a despensa do clã (DESPENSA, testada em cla-despensa.mjs) mudaria as ordens do líder bot
DESPENSA.ligado = false;
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA), p = s.adicionarJogador('andre', 'Ruiva', 'ruiva', { conta: 7 });
p.prog.nivel = 60;
for (const x of s.amigosIa) x.amigaEntrar?.('andre', true);
const bots = s.amigosIa.filter((x) => x.amiga), por = (id) => bots.find((x) => x.AMIGA.id === id);
const passo = (seg) => { for (let i = 0; i < seg * 10; i++) { s.passo(0.1); agora += 100; } };
ok(['cecilia', 'dario', 'kira', 'rufo', 'lis'].every((id) => por(id)?.amiga?.semTeto), 'os cinco bots estão no mundo');
// a Geada faz a história de verdade (antes entrava com tudo feito)
for (const id of ['kira', 'rufo', 'lis']) ok((por(id).amiga.prog.hist.p | 0) === 0, `${id}: começa a história do zero`);

// dias sem ninguém no servidor: planta as árvores da diária daqueles dias e recebe os prêmios
const k = por('kira'), n0 = s.plantadas.size, ouro0 = k.amiga.prog.ouro = 2000;
const plantou = k.diariasOfflineAmiga(k.amiga, agora - 2.5 * 86400e3);
ok(plantou >= 8 && s.plantadas.size - n0 === plantou, `Kira: plantou as árvores dos dias sem ninguém (${plantou})`);
ok([...s.plantadas.values()].filter((P) => P.dono === k.amiga.conta).every((P) => P.quando < agora - 3600e3), 'as árvores dos dias passados já nasceram com a hora daquele dia');
ok(k.amiga.prog.ouro !== ouro0, `Kira: pagou as sementes e recebeu os prêmios (${ouro0} -> ${k.amiga.prog.ouro})`);

// já caçou os 30 min do dia: mesmo assim sai para as diárias e a missão
for (const x of bots) { const j = x.amiga; j.prog.nivel = Math.max(20, j.prog.nivel); j.prog.ouro = 2000; j.grind = { dia: '2026-11-21', seg: 1e9 }; }
passo(5400); // a missão do dia (até 1 h) e as diárias
const c = por('cecilia'), d = por('dario');
ok([c, d].some((x) => (x.amiga.prog.diarias?.n?.arvores || 0) >= 4), 'Cecília e Dario: plantam as árvores da diária mesmo com a caça do dia feita');
for (const x of [c, d]) {
  const j = x.amiga;
  ok((j.missaoDia?.seg || 0) > 0 || j.prog.hist.ac, `${x.AMIGA.nome}: fez missão da história mesmo com a caça do dia feita`);
}

// pergunta qual missão: ela conta a missão e as diárias
const ce = c.amiga, falas = [], dizer = c.dizerAmiga.bind(c);
c.dizerAmiga = (t, ...r) => { falas.push(t); return dizer(t, ...r); };
ok(c.assuntoAmiga('qual missão você tá fazendo?') === 'missaoDela', '"qual missão você tá fazendo?" é a missão dela');
ok(c.assuntoAmiga('fez suas diárias?') === 'missaoDela', '"fez suas diárias?" também');
ok(c.assuntoAmiga('qual a minha missão?') === 'missao', '"qual a minha missão?" continua sendo a dele');
ok(c.assuntoAmiga('te ajudo na sua missão') === 'ajudarMissao', '"te ajudo na sua missão" é oferecer ajuda');
ok(c.assuntoAmiga('me ajuda na minha missão') !== 'ajudarMissao', '"me ajuda na minha missão" não é ajudar a dela');
c.respostaAmiga('andre', { assunto: 'missaoDela' });
ok(/miss/i.test(falas.at(-1) || '') && /diárias/.test(falas.at(-1) || ''), `ela responde a missão e as diárias: "${falas.at(-1)}"`);

// ele se oferece: ela manda o time, vai na frente e faz as etapas com ele junto até entregar
ce.prog.hist = { v: 2, p: 0, ac: false, e: 0, n: 0, m: 0 }; ce.ia.av = null;
c.respostaAmiga('andre', { assunto: 'ajudarMissao' });
ok(p.conviteTime?.de === ce.id && ce.ia.missaoJunto?.id === 'andre', 'ela manda o convite do time para a missão');
p.x = ce.x + 2; p.z = ce.z;
c.aceitouConviteAmiga('andre');
ok(ce.time && ce.ia.seguido?.c?.missao, 'no time, ela vai na frente até a etapa (Seguir)');
// até 1.700 s (a ajuda dura NPC_VIDA.missao.juntoSeg): no caminho ela pode parar para brigar com monstro (com a Mesa do
// Clã nas bases, 2026-11-25, a semente 1 cai nesse caso e ela entrega a missão em ~1.000 s)
for (let t = 0; t < 1700 && ce.prog.hist.p === 0; t += 0.1) { s.passo(0.1); agora += 100; p.x = ce.x + 2; p.z = ce.z + 1; p.y = ce.y; }
ok(ce.prog.hist.p === 1, `com ajuda, a missão foi entregue (${JSON.stringify(ce.prog.hist)})`);
ok(falas.some((f) => /Valeu demais pela ajuda/.test(f)), 'ela agradece a ajuda');
ok(!ce.ia.missaoJunto, 'a ajuda acaba quando a missão é entregue');
ok(NPC_VIDA.missao.junto < 1, 'com ajuda cada etapa é mais rápida');

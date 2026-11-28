// Missões desligadas (André 2026-11-27: "vou remover todas as missões... depois eu queria adicionar missões de novo e
// eles fazerem"). MISSOES_LIGA em shared/dados.js: ninguém pega missão, a névoa abre pelo nível e os bots (Geada e Chama,
// líderes e recrutas) usam o tempo livre no resto da rotina (grind, coleta, horta/árvores, ronda de guerra), nunca em
// missão. Sem rede. Uso: node ferramentas/testes/missoes-desligadas.mjs
let agora = Date.parse('2026-11-27T13:00:00Z'); Date.now = () => agora; // 10h de Brasília, hora de sair
{ let x = (Number(process.env.SEMENTE ?? 1) >>> 0) || 1; Math.random = () => { x = (x + 0x6d2b79f5) >>> 0; let t = x; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const { Simulacao, MAPA_CLAREIRA, MISSOES_LIGA, HISTORIA, DESPENSA } = await import('../../shared/index.js');
const { liberado, missaoAtual, zonaFechadaEm, ZONAS_GEO, textoNevoa } = await import('../../shared/historia.js');
DESPENSA.ligado = false;
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

ok(Object.values(MISSOES_LIGA).every((v) => v === false), 'as missões estão desligadas (história, diárias, guilda, escolta, Aldo)');
ok(HISTORIA.length > 50, `as missões continuam nos dados para voltar (${HISTORIA.length})`);

const s = new Simulacao(MAPA_CLAREIRA), p = s.adicionarJogador('andre', 'Ruiva', 'ruiva', { conta: 7 });
const P = p.prog; P.nivel = 1; P.hist = { v: 2, p: 0, ac: false, e: 0, n: 0, m: 0 };
ok(missaoAtual(P) === null && s.histInfo(p) === null, 'o jogador não tem missão (nem cartão, nem botão no NPC)');
ok(!liberado(P, 'pesca') && !liberado(P, 'lobo'), 'Nv 1: pesca e lobo ainda fechados');
ok(/Chegue no nível 8 para liberar/.test(textoNevoa(P, 'pesca')), `o aviso fala do nível, não de missão ("${textoNevoa(P, 'pesca')}")`);
P.nivel = 8; ok(liberado(P, 'pesca') && liberado(P, 'lobo') && liberado(P, 'forja'), 'Nv 8: pesca, lobo e forja abertos pelo nível');
P.nivel = 100; ok(ZONAS_GEO.filter((Z) => !Z.selo).every((Z) => liberado(P, Z.id)), 'Nv 100: todas as regiões abertas');
const Q = { nivel: 1, hist: { v: 2, p: HISTORIA.length, ac: false, e: 0, n: 0, m: 0 } };
ok(ZONAS_GEO.every((Z) => liberado(Q, Z.id)), 'quem já tinha feito as missões não perde nada que abriu');
P.nivel = 1;
const vila = MAPA_CLAREIRA.npcs.find((n) => n.id === HISTORIA[0].npc);
ok(!s.falaHistoria(p, vila, () => {}, true), 'falar com o NPC da 1ª missão não dá missão');
ok(s.diariasInfo(p) === null && s.guildaInfo(p) === null, 'Diárias e Guilda somem do jogador');
const av = []; const ev0 = s.evento.bind(s); s.evento = (e) => { if (e.t === 'aviso') av.push(e.texto); return ev0(e); };
P.nivel = 40; s.guilda(p.id, { acao: 'ver' });
ok(av.some((t) => /Guilda está fechada/.test(t)), 'a Guilda avisa que está fechada');
s.iniciarMissaoCla(p, (t) => av.push(t), { k: 'x', x: 0, z: 0 }, []); ok(av.some((t) => /Escolta do Clã está desligada/.test(t)), 'a Escolta do Clã não começa');
ok(s.missaoInfo({ k: 'x' }) === null, 'o cartão da Escolta some do menu do clã');
// subir de nível (André 2026-11-28: "aparece... vá até Vael"): sem recado de missão (rumor), e avisa a região que abriu
{ const evs = []; const ev1 = s.evento; s.evento = (e) => { evs.push(e); return ev1(e); };
  P.nivel = 37; P.xp = 0; P.hist = { v: 2, p: 37, ac: false, e: 0, n: 0, m: 0 }; // já tinha feito capítulos (recados guardados)
  for (let i = 0; i < 5000 && P.nivel < 42; i++) s.ganharXP(p, 200);
  ok(P.nivel === 42, `subiu do 37 para o ${P.nivel}`);
  ok(!evs.some((e) => e.t === 'rumor'), `nenhum recado de missão ao subir (${evs.filter((e) => e.t === 'rumor').map((e) => e.texto).join(' | ')})`);
  ok(!evs.some((e) => e.t === 'aviso' && /Missão nova|fale com/.test(e.texto)), 'nenhum aviso de missão ao subir');
  const lib = evs.filter((e) => e.t === 'aviso' && /^Liberado:/.test(e.texto)).map((e) => e.texto).join(' | ');
  ok(/Leste de Vael/.test(lib) && !/Norte de Vael/.test(lib), `o aviso diz a região que abriu no nível ("${lib.slice(0, 160)}")`);
  s.evento = ev1; P.nivel = 40; P.hist = { v: 2, p: 0, ac: false, e: 0, n: 0, m: 0 }; }

// os bots: 10 min de jogo sem ninguém entrar em missão; seguem a rotina (caçar, coletar, plantar, guerra)
for (const x of s.amigosIa) x.amigaEntrar?.('andre', true);
const bots = s.amigosIa.filter((x) => x.amiga);
for (const x of bots) { const j = x.amiga; j.prog.nivel = Math.max(20, j.prog.nivel); j.prog.ouro = 2000; }
ok(bots.every((x) => !x.querMissaoAmiga(x.amiga)), `nenhum bot quer missão (${bots.length} bots)`);
const fases = {}; let missao = 0;
for (let i = 0; i < 600 * 10; i++) { // 10 min de jogo (o CI tem 30 min para todos os testes)
  s.passo(0.1); agora += 100;
  if (i % 50) continue;
  for (const x of bots) { const f = x.amiga?.ia?.av?.fase; if (!f) continue; fases[f] = (fases[f] || 0) + 1; if (f === 'missao') missao++; }
}
ok(missao === 0, 'em 10 min nenhum bot entrou na fase de missão');
ok(bots.every((x) => !x.amiga?.prog?.hist?.ac), 'nenhum bot aceitou missão');
ok(bots.every((x) => !(x.amiga?.missaoDia?.seg > 0)), 'nenhum bot gastou tempo com missão');
const outras = Object.keys(fases).filter((f) => f !== 'missao');
ok(outras.length >= 2, `o tempo livre vai para a rotina de sempre (${Object.entries(fases).map(([k, v]) => k + ' ' + v).join(', ')})`);
ok(bots.some((x) => Object.keys(x.amiga?.prog?.diarias?.n || {}).length > 0) || (fases.plantar || 0) > 0 || (fases.ir || 0) > 0, 'bots seguem plantando/coletando/caçando');
if (process.exitCode) console.error('missoes-desligadas: FALHOU'); else console.log('missoes-desligadas: tudo certo');

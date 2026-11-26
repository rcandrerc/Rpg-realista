// Cecília e Dario reforçam e evoluem o equipamento sozinhos (André 2026-11-17: "quero que ela tenha autonomia para fazer
// reforço de equipamento e fazer upgrade de equipamento... Se ela tiver o material e o dinheiro e o equipamento, ela vai
// lá e faz upgrade"). Mesmas regras do herói: paga com o ouro dela e guarda reserva para poção.
// Uso: node ferramentas/testes/npc-reforco.mjs
import { Simulacao, MAPA_CLAREIRA, NPC_VIDA, HISTORIA, CATALISADOR } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const novo = () => {
  const s = new Simulacao(MAPA_CLAREIRA); s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
  for (const x of s.amigosIa) x.amigaEntrar('andre', true); s.passo(0.05);
  const c = s.amigosIa.find((x) => x.AMIGA.id === 'cecilia'), a = c.amiga;
  a.prog.hist = { v: 2, p: HISTORIA.length, ac: false, e: 0, n: 0, m: 0 }; // história feita: forja e reforço liberados
  a.prog.nivel = 60; a.prog.atr = { ...(a.prog.atr || {}), for: 200, int: 10 }; a.prog.dia = { h: 10, t: Date.now() };
  a.prog.mochila.fill(null);
  return { s, c, a };
};
// reforço: com ouro sobrando reforça as peças do corpo, guardando a reserva
{
  const { c, a } = novo();
  a.prog.equip.espada = { k: 'espada', r: 2 }; a.prog.equip.cajado = null;
  a.prog.ouro = 5000;
  const reserva = c.reservaAmiga(a), rr = Math.random; Math.random = () => 0; // sorte boa: toda tentativa sobe
  const n = c.reforcoAmiga(a); Math.random = rr;
  ok(n > 0 && (a.prog.equip.espada.e | 0) === n, `reforçou a espada sozinha: +${a.prog.equip.espada.e} em ${n} tentativas`);
  ok(n <= NPC_VIDA.reforco.tentativas, 'no máximo as tentativas da volta na vila');
  ok(a.prog.ouro >= reserva, `guardou a reserva (${a.prog.ouro} >= ${reserva})`);
  a.prog.ouro = reserva; ok(c.reforcoAmiga(a) === 0, 'sem ouro além da reserva: não reforça');
}
// peça que não é arma gasta tecido: sem tecido não reforça; com tecido reforça
{
  const { c, a } = novo();
  for (const l of Object.keys(a.prog.equip)) a.prog.equip[l] = null;
  a.prog.equip.corpo = { k: 'peitoral', r: 1, e: 3 }; a.prog.ouro = 5000;
  ok(c.reforcoAmiga(a) === 0, 'peitoral sem Tecido dos Imps: não reforça');
  a.prog.mochila[0] = { k: 'tecido', n: 20 };
  const rr = Math.random; Math.random = () => 0; const n = c.reforcoAmiga(a); Math.random = rr;
  ok(n > 0 && a.prog.equip.corpo.e > 3, `com tecido reforçou o peitoral (+${a.prog.equip.corpo.e})`);
}
// história ainda não libera o reforço: não reforça
{
  const { c, a } = novo();
  a.prog.hist = { v: 2, p: 0, ac: false, e: 0, n: 0, m: 0 }; a.prog.nivel = 5;
  a.prog.equip.espada = { k: 'espada', r: 2 }; a.prog.ouro = 5000;
  ok(c.reforcoAmiga(a) === 0, 'reforço ainda fechado na progressão: não reforça');
}
// evoluir: com runa e material vai até a bigorna, evolui a espada e veste de novo
{
  const { s, c, a } = novo();
  for (const l of Object.keys(a.prog.equip)) a.prog.equip[l] = null;
  a.prog.equip.espada = { k: 'espada', r: 1, e: 5 }; a.prog.ouro = 150;
  ok(!c.evoluirQualAmiga(a), 'sem runa: não evolui');
  const R = s.receitaEvoluir(a.prog.equip.espada);
  let i = 0; for (const [k, n] of Object.entries(R.usa)) a.prog.mochila[i++] = { k, n };
  const evo = c.evoluirQualAmiga(a);
  ok(evo && evo.l === 'espada', 'com runa e material: quer evoluir a espada');
  const rr = Math.random; Math.random = () => 0.5; // sem falha nem pulo
  a.ia.av = { fase: 'evoluir', evo, ate: s.tempo + 600 }; a.morto = false;
  let t = 0;
  for (; t < 20 * 400 && a.ia.av.fase === 'evoluir'; t++) { c.passoSozinhoAmiga(a, 0.05); s.passo(0.05); }
  Math.random = rr;
  const e = a.prog.equip.espada;
  ok(e && e.r === 2, `evoluiu a espada para ${['Comum', 'Rara', 'Épica'][e?.r]} e vestiu de novo (${(t * 0.05).toFixed(0)} s)`);
  ok(!a.prog.mochila.some((o) => o && o.k === CATALISADOR.arma[0]), 'gastou a runa');
}
// diário de evolução (André 2026-11-17: "ir me passando... se morrer... Cada nível, se eles bugarem alguma missão")
{
  const { s, c, a } = novo();
  a.prog.equip.espada = { k: 'espada', r: 2 }; a.prog.ouro = 5000;
  const rr = Math.random; Math.random = () => 0; c.reforcoAmiga(a); Math.random = rr;
  ok(a.evolucao.some((x) => x.o === 'reforco'), 'reforço entra no diário');
  a.ia.nvVisto = null; c.vigiarEvolucaoAmiga(a); a.prog.nivel = 61; c.vigiarEvolucaoAmiga(a);
  ok(a.evolucao.some((x) => x.o === 'nivel' && x.txt === '60 -> 61'), 'subir de nível entra no diário');
  a.prog.hist = { v: 2, p: 3, ac: true, e: 0, n: 0, m: 0 }; a.ia.missaoVista = 2; a.missaoDia = { dia: 'x', seg: 0 };
  c.vigiarEvolucaoAmiga(a);
  ok(a.evolucao.some((x) => x.o === 'missao' && x.txt.startsWith('3.')), 'missão entregue entra no diário');
  a.missaoDia.seg = NPC_VIDA.evolucao.travou + 10; c.vigiarEvolucaoAmiga(a); c.vigiarEvolucaoAmiga(a);
  ok(a.evolucao.filter((x) => x.o === 'travou').length === 1, 'etapa parada tempo demais: avisa "travou" uma vez');
  a.morto = true; a.ia.caiu = false; c.cabecaAmiga(0.05);
  ok(a.evolucao.some((x) => x.o === 'morreu'), 'queda entra no diário');
  ok(a.evolucao.some((x) => x.o === 'morreu' && x.txt.includes('por sem golpe') && x.txt.includes(`em ${Math.round(a.x)},${Math.round(a.z)}`)), 'queda sem golpe: o diário diz "sem golpe" e onde caiu');
  void s;
}
// a queda no diário diz quem deu o golpe final (ronda 26/11: as 37 quedas do Gael no Juncal não diziam de quê)
{
  const { s, c, a } = novo();
  a.vida = 1; s.morrer(a, { tipo: 'lobo', nivel: 47 }); c.cabecaAmiga(0.05);
  const m1 = a.evolucao.filter((x) => x.o === 'morreu').pop();
  ok(m1 && m1.txt.includes('por Lobo Nv 47'), `golpe de monstro: "${m1?.txt}"`);
  ok(a.quedaDe == null, 'o golpe anotado some depois de ir para o diário');
  a.morto = false; a.ia.caiu = false; c.cabecaAmiga(0.05);
  const bot = { tipo: 'jogador', bot: true, nome: 'Gael Lobo', nivel: 44 };
  s.morrer(a, bot); c.cabecaAmiga(0.05);
  ok(a.evolucao.filter((x) => x.o === 'morreu').pop()?.txt.includes('por Gael Lobo'), 'golpe de bot: sai o nome do bot');
  a.morto = false; a.ia.caiu = false; c.cabecaAmiga(0.05);
  s.morrer(a, { tipo: 'jogador', nome: 'André', nivel: 62 }); c.cabecaAmiga(0.05);
  const m3 = a.evolucao.filter((x) => x.o === 'morreu').pop();
  ok(m3?.txt.includes('por um jogador') && !m3.txt.includes('André'), 'golpe de jogador de verdade: sem o nome dele');
  c.guardarAmiga(); const L = c.loteDaAmiga();
  ok(!L || L.amiga.evolucao?.length >= 4, 'o diário fica salvo');
  void s;
}

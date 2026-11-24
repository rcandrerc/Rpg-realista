// Cecília (André 2026-11-17): "se eu falar vamos fazer alguma coisa, escolhe aí, ela escolhe... e eu falar bora pra isso aí
// mesmo" e "tá fazendo o quê? tô indo fazer os imps nível 36. Posso ir com você? Claro, vem. Me dá time. Aí eu aceito".
// Sem rede (a resposta da IA é simulada). Uso: node ferramentas/testes/cecilia-escolhe.mjs
import { Simulacao, MAPA_CLAREIRA, DARIO, TIME } from '../../shared/index.js';
import './_amizade-antiga.mjs'; // o time com a Cecília e o Dario é do jeito antigo (antes do soldado de 2026-11-22)
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const novo = (quem = 'cecilia') => {
  const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
  for (const x of s.amigosIa) x.amigaEntrar('andre', true); s.passo(0.05);
  const c = s.amigosIa.find((x) => x.AMIGA.id === quem), a = c.amiga;
  a.amigosDe = { 7: 1 }; j.x = a.x + 3; j.z = a.z; a.prog.dia = { h: 10, t: Date.now() }; j.prog.dia = a.prog.dia;
  const ev = []; const e0 = s.evento.bind(s); s.evento = (e) => { ev.push(e); return e0(e); };
  return { s, j, c, a, ev };
};
// 1) "escolhe aí": ela propõe caçar num campo (sugere) -> vira chamado dela; "bora" -> ela manda o convite do time
{
  const { s, j, c, a, ev } = novo();
  c.ouvirAmiga('andre', 'vamos fazer alguma coisa, escolhe aí');
  c.respostaAmiga('andre', { assunto: 'conversa', iaAssunto: 'conversa', sugere: 'time', lugar: 'Clareira dos Puglins', fala: 'Bora farmar na Clareira dos Puglins?' });
  ok(c.chamouAmiga('time') && a.ia.chamado.c?.nome?.includes('Puglins'), `o que ela sugeriu vira chamado dela (${a.ia.chamado?.c?.nome})`);
  ok(!j.conviteTime, 'só propor não manda convite ainda');
  c.ouvirAmiga('andre', 'bora pra isso aí mesmo');
  c.respostaAmiga('andre', { assunto: 'sim', iaAssunto: 'sim', fala: 'Bora! Te mandei o time.' });
  const cv = ev.find((e) => e.t === 'time' && e.fase === 'convite' && e.para === 'andre');
  ok(cv && cv.de === a.id && j.conviteTime?.de === a.id, '"bora" aceita o chamado: ELA manda o convite do time (cartão Entrar/Recusar)');
  s.time('andre', { acao: 'aceitar', com: a.id });
  ok(a.time && a.time === j.time, 'ele toca Entrar: os dois no time');
  const sg = ev.find((e) => e.t === 'seguir' && e.para === 'andre');
  ok(a.ia.seguido?.c?.nome?.includes('Puglins') && sg?.lugar?.includes('Puglins'), 'ela vai na frente até o campo que escolheu e o app dele segue ela');
}
// 2) "escolhe aí" -> pescar; "bora" -> convite; entrar -> pescam juntos
{
  const { s, j, c, a } = novo();
  c.respostaAmiga('andre', { assunto: 'conversa', iaAssunto: 'conversa', sugere: 'pescar', fala: 'Bora pescar?' });
  c.respostaAmiga('andre', { assunto: 'sim', iaAssunto: 'sim', fala: 'Bora!' });
  ok(j.conviteTime?.de === a.id, 'pescar: "bora" manda o convite');
  s.time('andre', { acao: 'aceitar', com: a.id });
  ok(a.time === j.time && a.ia.atividade === 'pescar', 'entrou no time e começou a pescar junto');
}
// 3) "tá fazendo o quê?" -> o campo e o nível; "posso ir com você?" -> claro, convite, vai na frente
{
  const { s, j, c, a } = novo();
  a.prog.hist = { v: 2, p: 999, ac: false, e: 0, n: 0, m: 0 }; a.prog.nivel = 36; j.prog.nivel = 36;
  j.prog.hist = { v: 2, p: 999, ac: false, e: 0, n: 0, m: 0 }; // ele já liberou tudo
  const v = c.sairCacarAmiga(a, j, 'imps');
  ok(v.ok, 'ela saiu para caçar sozinha');
  const ctx = c.contextoAmiga('andre');
  ok(/nível \d+ em /.test(ctx.fazendo) && ctx.fazendo.includes(v.c.nome.replace(/ \(.*\)$/, '')), `"fazendo" tem o campo e o nível: ${ctx.fazendo}`);
  ok(ctx.convida === true, 'a ficha diz que ela mesma manda o convite');
  const rr = Math.random; Math.random = () => 0.999; // sorteio de vontade bem ruim: mesmo assim aceita (ele quer ir junto na caçada dela)
  c.respostaAmiga('andre', { assunto: 'time', iaAssunto: 'time', fala: 'Claro, vem! Te mandei o time.' });
  Math.random = rr;
  ok(j.conviteTime?.de === a.id, '"posso ir com você?" enquanto ela caça: ela aceita e manda o convite');
  s.time('andre', { acao: 'aceitar', com: a.id });
  ok(a.time === j.time && a.ia.seguido?.c === v.c, `no time, ela leva ele para o campo dela (${v.c.nome})`);
}
// 4) recusar e expirar
{
  const { s, j, c, a } = novo();
  c.respostaAmiga('andre', { assunto: 'conversa', sugere: 'time', fala: 'Bora caçar?' });
  c.respostaAmiga('andre', { assunto: 'sim', fala: 'Bora!' });
  s.time('andre', { acao: 'recusar', com: a.id });
  ok(!j.conviteTime && !a.ia.convidou && !a.time, 'Recusar limpa o convite');
  c.respostaAmiga('andre', { assunto: 'time', fala: 'Bora!' });
  s.tempo += TIME.convite + 1;
  s.time('andre', { acao: 'aceitar', com: a.id });
  ok(!a.time, 'convite vencido não entra');
}
// 5) Dario igual à Cecília (André 2026-11-19): ele também manda o convite
{
  const { s, j } = novo();
  const d = s.amigoIaDe(DARIO.id);
  for (const x of s.amigosIa) if (x !== d) x.amiga && (x.amiga.time = null);
  d.amigaEntrar?.('andre', true);
  ok(DARIO.convida === true, 'Dario também manda convite (igual à Cecília)');
}
// 6) André 2026-11-17: "e se o lugar não tiver sido destravado por mim ele teria como avisar? pois já aconteceu comigo"
{
  const { s, j, c, a } = novo();
  a.prog.hist = { v: 2, p: 999, ac: false, e: 0, n: 0, m: 0 }; a.prog.nivel = 36; j.prog.nivel = 36;
  j.prog.hist = { v: 2, p: 0, ac: false, e: 0, n: 0, m: 0 }; // ele ainda está na primeira missão
  const v = c.sairCacarAmiga(a, j, 'imps');
  const { zonaFechadaEm } = await import('../../shared/historia.js');
  ok(v.ok && zonaFechadaEm(j.prog, v.c.x, v.c.z), `ela caça num campo que ele ainda não liberou (${v.c.nome})`);
  const ctx = c.contextoAmiga('andre');
  ok(ctx.fechadoDele && !/miss/.test(ctx.fechadoDele), `a ficha diz à IA só qual campo não dá pra ele: ${ctx.fechadoDele}`);
  ok(ctx.camposJuntos && !ctx.camposJuntos.includes(`(nível ${v.c.nivel},`), `campos para os dois só os abertos para ele: ${ctx.camposJuntos}`);
  a.ia.chatFila = [];
  c.respostaAmiga('andre', { assunto: 'time', iaAssunto: 'time', fala: 'Claro, vem! Te mandei o time.' });
  const dito = a.ia.chatFila.at(-1)?.texto || '';
  ok(dito.startsWith('Lá ainda não dá pra você') && !/miss[aã]o|liber/i.test(dito), `ela avisa curto, sem explicar: "${dito}"`);
  s.time('andre', { acao: 'aceitar', com: a.id });
  const L = a.ia.seguido?.c;
  ok(a.time === j.time && L && !zonaFechadaEm(j.prog, L.x, L.z) && !zonaFechadaEm(a.prog, L.x, L.z), `leva ele para um campo que os dois podem ir (${L?.nome})`);
}
// 7) André 2026-11-19: "eu quero que deixe igualzinho... vamos, eu te sigo. Aí ele escolhe o que ele quer fazer. E se ele me
// chamar, bora caçar monstro, eu falar bora, ele entender e ele ir, e eu sigo ele e ele me leva. Não ficar 'bora, pra onde?'"
for (const quem of ['cecilia', 'dario']) {
  const N = quem === 'cecilia' ? 'Cecília' : 'Dario';
  const fala = (a) => a.ia.chatFila.at(-1)?.texto || '';
  {
    const { c } = novo(quem);
    for (const t of ['vamos, eu te sigo', 'pô, vamos, eu te sigo', 'vai na frente que eu vou', 'me leva', 'escolhe você, eu vou atrás de você'])
      ok(c.assuntoAmiga(t) === 'liderar', `${N}: "${t}" é ela/ele escolher e ir na frente`);
    ok(c.assuntoAmiga('não te sigo não') !== 'liderar', `${N}: "não te sigo" não é`);
    ok(c.regraValeSobreIaAmiga('andre', 'liderar', 'vamos, eu te sigo', 'conversa'), `${N}: "te sigo" vale sobre a IA (que podia perguntar "pra onde?")`);
  }
  // o "escolhe aí" -> proposta -> "bora" do caso 1, agora com os dois
  {
    const { s, j, c, a, ev } = novo(quem);
    c.respostaAmiga('andre', { assunto: 'conversa', iaAssunto: 'conversa', sugere: 'time', lugar: 'Clareira dos Puglins', fala: 'Bora caçar na Clareira dos Puglins?' });
    c.respostaAmiga('andre', { assunto: c.assuntoAmiga('bora'), iaAssunto: 'sim', fala: 'Bora!' });
    ok(j.conviteTime?.de === a.id, `${N}: propôs caçar, ele disse "bora": manda o convite`);
    s.time('andre', { acao: 'aceitar', com: a.id });
    ok(a.time === j.time && a.ia.seguido?.c?.nome?.includes('Puglins') && ev.some((e) => e.t === 'seguir' && e.npc === a.id), `${N}: entrou no time e leva ele até a Clareira dos Puglins`);
  }
  // "vamos fazer alguma coisa" -> propôs -> "vamos, eu te sigo": topa e leva para o que propôs
  {
    const { s, j, c, a } = novo(quem);
    c.respostaAmiga('andre', { assunto: 'conversa', iaAssunto: 'conversa', sugere: 'time', lugar: 'Clareira dos Puglins', fala: 'Bora caçar na Clareira dos Puglins?' });
    const rr = Math.random; Math.random = () => 0.999; // vontade ruim: mesmo assim, foi ela que chamou
    c.respostaAmiga('andre', { assunto: c.assuntoAmiga('vamos, eu te sigo'), iaAssunto: 'conversa', fala: 'Bora! Pra onde a gente vai?' });
    Math.random = rr;
    ok(j.conviteTime?.de === a.id && !/pra onde[^:]*\?/i.test(fala(a)), `${N}: "te sigo" depois da proposta: manda o convite e não pergunta pra onde ("${fala(a)}")`);
    s.time('andre', { acao: 'aceitar', com: a.id });
    ok(a.time === j.time && a.ia.seguido?.c?.nome?.includes('Puglins'), `${N}: e vai na frente até lá`);
  }
  // sem proposta antes: "vai na frente que eu vou" -> escolhe o campo, diz qual, manda o convite e leva
  {
    const { s, j, c, a } = novo(quem);
    const rr = Math.random; Math.random = () => 0.01; // vontade boa
    c.respostaAmiga('andre', { assunto: c.assuntoAmiga('vai na frente que eu vou'), iaAssunto: 'conversa', fala: 'Tá, mas pra onde?' });
    Math.random = rr;
    const C = a.ia.convidou?.c;
    ok(j.conviteTime?.de === a.id && C, `${N}: escolheu sozinho o campo (${C?.nome}) e mandou o convite`);
    ok(C && fala(a).includes(C.nome.replace(/ \(.*\)$/, '').split(' ').at(-1)) && !/pra onde[^:]*\?/i.test(fala(a)), `${N}: diz para onde vai: "${fala(a)}"`);
    s.time('andre', { acao: 'aceitar', com: a.id });
    ok(a.time === j.time && a.ia.seguido?.c === C, `${N}: entrou no time e leva ele até ${C?.nome}`);
  }
  // já no time: "te sigo" -> escolhe o campo e vai na frente (como o botão Seguir), mesmo de longe
  {
    const { s, j, c, a, ev } = novo(quem);
    c.respostaAmiga('andre', { assunto: 'conversa', sugere: 'time', fala: 'Bora caçar?' });
    c.respostaAmiga('andre', { assunto: 'sim', fala: 'Bora!' });
    s.time('andre', { acao: 'aceitar', com: a.id });
    a.ia.seguido = null; j.x = a.x + 30;
    c.respostaAmiga('andre', { assunto: c.assuntoAmiga('vamos, eu te sigo'), iaAssunto: 'conversa', fala: 'Pra onde?' });
    const sg = ev.filter((e) => e.t === 'seguir' && e.npc === a.id).at(-1);
    ok(a.ia.seguido?.id === 'andre' && a.ia.seguido.c && sg?.lugar, `${N}: no time, escolhe (${sg?.lugar}) e vai na frente; o app dele segue`);
    ok(!/pra onde[^:]*\?/i.test(fala(a)), `${N}: sem "pra onde?" ("${fala(a)}")`);
  }
  // chamou para pescar -> "te sigo" = topar a pesca
  {
    const { s, j, c, a } = novo(quem);
    c.respostaAmiga('andre', { assunto: 'conversa', sugere: 'pescar', fala: 'Bora pescar?' });
    c.respostaAmiga('andre', { assunto: c.assuntoAmiga('vai na frente, te sigo'), fala: '' });
    ok(j.conviteTime?.de === a.id, `${N}: chamou para pescar, "te sigo" manda o convite`);
    s.time('andre', { acao: 'aceitar', com: a.id });
    ok(a.ia.atividade === 'pescar', `${N}: e pescam juntos`);
  }
}

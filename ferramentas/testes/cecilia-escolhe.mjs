// Cecília (André 2026-11-17): "se eu falar vamos fazer alguma coisa, escolhe aí, ela escolhe... e eu falar bora pra isso aí
// mesmo" e "tá fazendo o quê? tô indo fazer os imps nível 36. Posso ir com você? Claro, vem. Me dá time. Aí eu aceito".
// Sem rede (a resposta da IA é simulada). Uso: node ferramentas/testes/cecilia-escolhe.mjs
import { Simulacao, MAPA_CLAREIRA, DARIO, TIME } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const novo = () => {
  const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
  for (const x of s.amigosIa) x.amigaEntrar('andre', true); s.passo(0.05);
  const c = s.amigosIa.find((x) => x.AMIGA.id === 'cecilia'), a = c.amiga;
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
// 5) Dario fica como estava: não manda convite (ele dá o time pelo botão)
{
  const { s, j } = novo();
  const d = s.amigoIaDe(DARIO.id);
  for (const x of s.amigosIa) if (x !== d) x.amiga && (x.amiga.time = null);
  d.amigaEntrar?.('andre', true);
  ok(DARIO.convida === false && !d.convidarTimeAmiga(d.amiga, j, null), 'Dario não manda convite');
}

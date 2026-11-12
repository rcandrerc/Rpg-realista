// Queda curta não desfaz nada (André 2026-11-12: "se a internet cair por alguns segundos... ele vai voltar"): o jogo
// entra de novo com outra sessão e o herói novo fica com o time, a Cecília e o Dario e as mensagens deles na fila.
// Segue a ordem do servidor (server/index.js onJoin/onLeave): entra o novo, os amigos entram, trocarSessao, sai o antigo.
// Uso: node ferramentas/testes/queda-time.mjs
import { Simulacao, MAPA_CLAREIRA, AMIGA, DARIO } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

function montar() {
  const s = new Simulacao(MAPA_CLAREIRA);
  const d = s.adicionarJogador('s1', 'André', 'ruiva', { conta: 1 }); d.conta = 'c1'; d.criando = false;
  const irmao = s.adicionarJogador('b1', 'Irmão', 'ruiva', { conta: 2 }); irmao.conta = 'c2'; irmao.criando = false;
  const dario = s.amigoIaDe(DARIO.id);
  for (const x of s.amigosIa) x.amigaEntrar('s1');
  const a = s.amiga, b = dario.amiga;
  const rnd = Math.random; Math.random = () => 0;
  Object.assign(d, { x: a.x + 1, z: a.z }); s.conversaAmiga('s1', { acao: 'time' });
  Object.assign(d, { x: b.x + 1, z: b.z }); dario.conversaAmiga('s1', { acao: 'time' });
  Math.random = rnd;
  d.time.membros.push('b1'); irmao.time = d.time; // o irmão também está no time (o convite pede amizade: atalho)
  return { s, d, irmao, a, b, dario };
}
// o servidor: herói novo, os amigos entram para ele, trocarSessao, e o antigo sai do mundo
function voltar(s, velho, novo) {
  const n = s.adicionarJogador(novo, 'André', 'ruiva', { conta: 1 }); n.conta = 'c1'; n.criando = false;
  for (const x of s.amigosIa) x.amigaEntrar(novo);
  s.trocarSessao(velho, novo);
  return n;
}

{ // caiu e voltou (o antigo sai na hora, como o fantasma no onJoin)
  const { s, irmao, a, b, dario } = montar();
  const T = irmao.time;
  ok(T && T.membros.length === 4 && T.lider === 's1', `time montado: ${T?.membros.join(', ')}`);
  dario.dizerAmiga('oi', false, 's1'); s.dizerAmiga('oi', false, 's1');
  s.eventos = [];
  const n = voltar(s, 's1', 's2');
  s.removerJogador('s1');
  const fila = [...a.ia.chatFila, ...b.ia.chatFila].map((e) => e.para);
  const avisos = s.eventos.filter((e) => e.t === 'aviso');
  const recebeu = s.eventos.some((e) => e.t === 'time' && e.fase === 'estado' && e.para === 's2');
  for (let i = 0; i < 20; i++) s.passo(0.05);
  ok(n.time === T && T.membros.includes('s2') && !T.membros.includes('s1') && T.membros.length === 4, `voltou no mesmo time: ${T.membros.join(', ')}`);
  ok(T.lider === 's2', 'continua o líder');
  ok(a.time === T && b.time === T && irmao.time === T, 'Cecília, Dario e o irmão continuam no time');
  ok(s.amigaDono === 's2' && dario.amigaDono === 's2', 'a Cecília e o Dario acompanham o herói novo');
  ok(s.amigaFalam.has('s2') && !s.amigaFalam.has('s1') && dario.amigaFalam.has('s2'), 'dá para conversar com eles na sessão nova');
  ok(!avisos.some((e) => /saiu/.test(e.texto || '')), 'ninguém recebe "saiu do jogo" nem "o time acabou"');
  ok(recebeu, 'o celular recebe o time de novo');
  ok(fila.length === 2 && fila.every((p) => p === 's2'), `mensagens na fila vão para a sessão nova (${fila.join(', ')})`);
  // e o allowReconnection do antigo vence 20 s depois (onLeave): nada muda
  for (const ctx of s.amigosIa) ctx.amigaSair('s1');
  s.removerJogador('s1');
  ok(n.time === T && T.membros.length === 4 && s.amigaDono === 's2' && dario.amigaDono === 's2', 'o fim da espera do antigo não desfaz nada');
}
{ // abriu de novo enquanto o antigo ainda estava ligado (substituído: sai depois, pelo onLeave)
  const { s, irmao, a } = montar();
  const T = irmao.time;
  s.eventos = [];
  const n = voltar(s, 's1', 's3');
  for (const ctx of s.amigosIa) ctx.amigaSair('s1');
  s.removerJogador('s1');
  ok(n.time === T && T.membros.includes('s3') && a.time === T && s.amigaDono === 's3', 'substituído: time e Cecília com o novo');
  ok(!s.eventos.some((e) => e.t === 'aviso' && /saiu/.test(e.texto || '')), 'substituído: ninguém recebe "saiu do jogo"');
}
{ // queda de verdade (não voltou): o time continua acabando como antes
  const { s, irmao } = montar();
  for (const ctx of s.amigosIa) ctx.amigaSair('s1');
  s.removerJogador('s1');
  ok(!irmao.time?.membros.includes('s1') && !s.jogadores.has('s1'), 'saiu de vez (não voltou): sai do time como antes');
}

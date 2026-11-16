// Etapa "chame alguém para o time" nunca trava (André 2026-11-16: "se a pessoa não tiver ninguém, ela pode fazer
// sozinha, só vai sofrer mais"). O app ensina pela tela de amigos; quem fecha a tela sem time manda time/sozinho.
// Uso: node ferramentas/testes/time-sozinho.mjs
import { Simulacao, MAPA_CLAREIRA, HISTORIA } from '../../shared/index.js';
import { etapasDe } from '../../shared/historia.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
let n = 0;
const novo = (i, e) => {
  const j = s.adicionarJogador('S' + ++n, 'Solo' + n), p = j.prog;
  p.nivel = Math.max(p.nivel, HISTORIA[i].nv); p.hist = { v: 2, p: i, ac: true, e, n: 0, m: 0 };
  return j;
};
let total = 0;
HISTORIA.forEach((M, i) => etapasDe(M).forEach((E, e) => {
  if (E.ev !== 'time') return;
  total++;
  const j = novo(i, e);
  s.passo(0.6); // sozinho, a etapa não anda sozinha
  ok(j.prog.hist.p === i && j.prog.hist.e === e, `${M.id} etapa ${e + 1}: sem time, espera`);
  s.eventos = [];
  s.time(j.id, { acao: 'sozinho' });
  const h = j.prog.hist;
  ok(h.p !== i || h.e > e, `${M.id} etapa ${e + 1}: fechou a tela, segue sozinho`);
  ok(s.eventos.some((x) => x.t === 'aviso' && x.para === j.id && /mais difícil/.test(x.texto)), `${M.id}: avisa que vai ser mais difícil`);
}));
ok(total >= 5, `${total} etapas de time conferidas`);
// fora da etapa de time, "sozinho" não pula nada
{
  const i = HISTORIA.findIndex((M) => etapasDe(M).some((E) => E.ev === 'time'));
  const e = etapasDe(HISTORIA[i]).findIndex((E) => E.ev !== 'time');
  const j = novo(i, e);
  s.time(j.id, { acao: 'sozinho' });
  ok(j.prog.hist.p === i && j.prog.hist.e === e, `${HISTORIA[i].id} etapa ${e + 1} (não é de time): sozinho não pula`);
  j.prog.hist.ac = false; j.prog.hist.e = etapasDe(HISTORIA[i]).findIndex((E) => E.ev === 'time');
  s.time(j.id, { acao: 'sozinho' });
  ok(j.prog.hist.e === etapasDe(HISTORIA[i]).findIndex((E) => E.ev === 'time'), 'missão não aceita: sozinho não pula');
}

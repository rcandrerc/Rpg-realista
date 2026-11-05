// Teste dos veios de pedra e de ferro (André 2026-11-05): existem, a pedra é maior que a de cobre e a de ferro menor,
// ficam longe uma zona da outra, sem árvore em cima, e minerar dá o item certo. Uso: node ferramentas/testes/veios.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const M = MAPA_CLAREIRA, s = new Simulacao(M);
const zona = (id) => M.mina.find((z) => z.id === id);
const veios = (tipo) => [...s.coletaveis.values()].filter((c) => c.tipo === tipo);
ok(zona('cobre1') && zona('pedra1') && zona('ferro1'), 'as três zonas existem (cobre continua)');
ok(veios('cobre').length === 6 && veios('pedra').length === 7 && veios('ferro').length === 5, 'quantidade de pedras por zona');
ok(veios('pedra')[0].r > veios('cobre')[0].r && veios('ferro')[0].r < veios('cobre')[0].r, 'pedra > cobre > ferro');
const zs = M.mina;
for (let i = 0; i < zs.length; i++) for (let k = i + 1; k < zs.length; k++) ok(Math.hypot(zs[i].x - zs[k].x, zs[i].z - zs[k].z) > 40, `espaçadas: ${zs[i].id} x ${zs[k].id}`);
for (const z of zs) ok(!M.mata.some((a) => Math.hypot(a.x - z.x, a.z - z.z) < z.r + 1.5), `sem árvore dentro de ${z.id}`);
// minerar: Minerador Nv 1 minera pedra mas não ferro (Nv 5)
const j = s.adicionarJogador('A', 'Ana');
const minerar = (no) => {
  j.x = no.x + no.r + 1; j.z = no.z; j.chao = true; j.trava = 0; s.eventos = [];
  s.coletar('A', { no: no.id });
  const todos = [...s.eventos];
  for (let t = 0; t < 400 && j.coleta; t++) { j.x = no.x + no.r + 1; j.z = no.z; j.chao = true; todos.push(...s.passo(0.05)); }
  return todos;
};
const ev = minerar(veios('pedra')[0]);
const pedra = j.prog.mochila.filter((o) => o?.k === 'pedra').reduce((n, o) => n + o.n, 0);
ok(pedra >= 8, 'veio de pedra deu ' + pedra + ' pedras');
ok(ev.some((e) => e.t === 'veio' && e.cargas === 0), 'a pedra esgota para todo mundo');
const av = minerar(veios('ferro')[0]).filter((e) => e.t === 'aviso').map((e) => e.texto);
ok(av.some((t) => /Minerador Nv 5/.test(t)), 'ferro pede Minerador Nv 5: ' + av.join(' | '));

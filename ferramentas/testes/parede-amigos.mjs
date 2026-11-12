// Cecília e Dario não ficam andando parados contra a parede (André 2026-11-12: "ficam caminhando sem sair do lugar o
// tempo todo, batendo na parede lá da casa deles... ou ficam parados, ou andando de verdade"). Roda um dia inteiro de
// jogo e mede o tempo em que eles têm vontade de andar (entrada) mas não saem do lugar.
// Uso: node ferramentas/testes/parede-amigos.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { pecaDaCasa, mesmaPeca } from '../../shared/amiga.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
s.adicionarJogador('andre', 'André', 'ruiva', {});
const amigos = s.amigosIa.filter((x) => x.AMIGA.terreno);
for (const x of amigos) x.amigaEntrar('andre', false);
// como no jogo: casa pronta, horta cuidada, nível 19 (sai para caçar sozinho)
for (const x of amigos) {
  const L = x.loteDaAmiga();
  for (const c of x.AMIGA.casa) { const f = pecaDaCasa(L.def, c); if (!L.pecas.some((o) => mesmaPeca(o, f))) x.colocarPeca(L, f); }
  x.amiga.prog.nivel = 19;
}
const dt = 0.05, H0 = Number(process.argv[2] ?? 12), horas = Number(process.argv[3] ?? 24), passos = Math.round(horas * 30 / dt);
const soma = new Map(), preso = new Map(), pior = new Map(), ant = new Map();
for (let i = 0; i < passos; i++) {
  const h = H0 + (i * dt) / 30, dia = { h: h % 24, t: Date.now() };
  for (const x of amigos) if (x.amiga) x.amiga.prog.dia = dia;
  s.passo(dt);
  if (i % 10) continue; // a cada 0,5 s
  for (const x of amigos) {
    const j = x.amiga, id = x.AMIGA.id, e = j.entrada || {}, quer = Math.hypot(e.mx || 0, e.mz || 0) > 0.1;
    const a = ant.get(id), andou = a ? Math.hypot(j.x - a.x, j.z - a.z) : 1;
    ant.set(id, { x: j.x, z: j.z });
    if (quer && andou < 0.25) { const k = id + ':' + (j.ia.av ? 'av.' + j.ia.av.fase : j.ia.fase); soma.set(k, (soma.get(k) || 0) + 0.5); }
    const p = quer && andou < 0.25 ? (preso.get(id) || 0) + 0.5 : 0;
    preso.set(id, p);
    if (p > (pior.get(id)?.s || 0)) pior.set(id, { s: p, h: h % 24, fase: j.ia.av?.fase || j.ia.fase });
  }
}
console.log('tempo total andando sem sair do lugar (s):', JSON.stringify(Object.fromEntries(soma)));
for (const x of amigos) {
  const p = pior.get(x.AMIGA.id) || { s: 0 };
  console.log(x.AMIGA.nome, 'maior tempo andando parado:', p.s.toFixed(1), 's', p.fase ? `(fase ${p.fase}, ${p.h.toFixed(1)}h)` : '');
  ok(p.s <= 4, `${x.AMIGA.nome} não fica mais de 4 s andando sem sair do lugar`);
}

// casos de propósito: atrás da casa, com o ponto do outro lado da parede (passeio de noite e voltando para a porta)
const presoMax = (x, prep, seg) => {
  const j = x.amiga, L = x.loteDaAmiga(), [a0, b0, a1, b1] = x.AMIGA.dentro;
  Object.assign(j, { x: L.def.x0 + (a0 + a1) / 2, z: L.def.z0 + b0 - 0.6, montado: null, time: null });
  j.y = s.terreno.altura(j.x, j.z);
  prep(j, L);
  let p = 0, m = 0, a = { x: j.x, z: j.z }, inicio = { x: j.x, z: j.z };
  for (let i = 0; i < seg / dt; i++) {
    for (const y of amigos) y.amiga.prog.dia = { h: 22, t: Date.now() };
    s.passo(dt);
    if (i % 10) continue;
    const e = j.entrada || {}, quer = Math.hypot(e.mx || 0, e.mz || 0) > 0.1, andou = Math.hypot(j.x - a.x, j.z - a.z);
    a = { x: j.x, z: j.z };
    p = quer && andou < 0.25 ? p + 0.5 : 0; m = Math.max(m, p);
    if (process.env.DBG && i % 40 == 0) console.log('dbg', j.x.toFixed(2), j.z.toFixed(2), j.y.toFixed(2), JSON.stringify(j.entrada), !!j.esc, j.ia.fase, j.ia.av?.fase, !!j.ia.av?.passeio, j.ia.parede, j.trava, !!j.time, j.ia.conversaAte, s.tempo);
  }
  return { m, saiu: Math.hypot(j.x - inicio.x, j.z - inicio.z) };
};
for (const x of amigos) {
  const r1 = presoMax(x, (j, L) => { j.ia.fase = 'pensar'; j.ia.av = { fase: 'descansar', ate: s.tempo + 999, passeio: { x: L.def.x0 + x.AMIGA.porta[0], z: L.def.z0 + x.AMIGA.porta[1] + 1 } }; }, 30);
  console.log(x.AMIGA.nome, 'passeio do outro lado da parede: maior tempo andando parado', r1.m, 's');
  ok(r1.m <= 3, `${x.AMIGA.nome}: passeio contra a parede vira ficar parado`);
  const r2 = presoMax(x, (j) => { j.ia.fase = 'pensar'; j.ia.av = { fase: 'voltar' }; j.ia.viagem = null; }, 40);
  console.log(x.AMIGA.nome, 'voltando para a porta por trás da casa: maior tempo andando parado', r2.m, 's, andou', r2.saiu.toFixed(1), 'm');
  ok(r2.m <= 3 && x.amiga.ia.av?.fase !== 'voltar', `${x.AMIGA.nome}: atrás da casa dá a volta e chega na porta`);
}

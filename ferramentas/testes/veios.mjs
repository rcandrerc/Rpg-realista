// Teste dos veios de pedra e de ferro (André 2026-11-05): existem, a pedra é maior que a de cobre e a de ferro menor,
// ficam longe uma zona da outra, sem árvore em cima, e minerar dá o item certo. Uso: node ferramentas/testes/veios.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const M = MAPA_CLAREIRA, s = new Simulacao(M);
const zona = (id) => M.mina.find((z) => z.id === id);
const veios = (tipo) => [...s.coletaveis.values()].filter((c) => c.tipo === tipo && !zona(c.mina)?.pequeno); // as 3 zonas grandes (os spots pequenos da FASE 2 têm teste próprio no fim)
ok(zona('cobre1') && zona('pedra1') && zona('ferro1'), 'as três zonas existem (cobre continua)');
ok(veios('cobre').length === 6 && veios('pedra').length === 7 && veios('ferro').length === 5, 'quantidade de pedras por zona');
ok(veios('pedra')[0].r > veios('cobre')[0].r && veios('ferro')[0].r < veios('cobre')[0].r, 'pedra > cobre > ferro');
const zs = M.mina.filter((z) => !z.pequeno);
for (let i = 0; i < zs.length; i++) for (let k = i + 1; k < zs.length; k++) ok(Math.hypot(zs[i].x - zs[k].x, zs[i].z - zs[k].z) > 40, `espaçadas: ${zs[i].id} x ${zs[k].id}`);
for (const z of zs) ok(!M.mata.some((a) => Math.hypot(a.x - z.x, a.z - z.z) < z.r + 1.5), `sem árvore dentro de ${z.id}`);
// minerar: Minerador Nv 1 minera pedra mas não ferro (Nv 5)
const j = s.adicionarJogador('A', 'Ana');
j.prog.mochila[j.prog.mochila.indexOf(null)] = { k: 'picareta', n: 1 }; // minerar pede a picareta de pedra (André 2026-11-07)
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

// Caminho até os veios (André 2026-11-05: "o jogador não consegue chegar"): o herói do Godot fica a 2,2 m da borda do
// mapa (andar.gd limitar_ao_mapa). Trilha de terra até cada zona nova, sem nada sólido nem árvore em cima, e o
// mapa andável (com a folga) liga a vila a cada zona por um caminho curto.
import { dentroDoMapa } from '../../shared/mapa.js';
const solidos = [...s.obstaculos.filter((o) => ![...s.coletaveis.values()].some((c) => c.x === o.x && c.z === o.z)), ...M.cenario.solidos];
const casas = M.vila.casas.map((c) => ({ x: c.x, z: c.z, r: Math.hypot(c.w, c.d) / 2 }));
for (const z of ['pedra1', 'ferro1'].map(zona)) {
  const t = M.vila.caminhos.find((c) => { const [x, zz] = c.pontos.at(-1); return Math.hypot(x - z.x, zz - z.z) < z.r + 3; });
  ok(t, 'tem trilha até ' + z.id);
  if (!t) continue;
  let livre = true;
  for (let i = 1; i < t.pontos.length; i++) {
    const [ax, az] = t.pontos[i - 1], [bx, bz] = t.pontos[i], L = Math.hypot(bx - ax, bz - az);
    for (let d = 0; d <= L; d += 0.5) {
      const x = ax + (bx - ax) * d / L, zz = az + (bz - az) * d / L;
      if (!dentroDoMapa(M, x, zz, 2.2) || [...solidos, ...casas].some((o) => Math.hypot(o.x - x, o.z - zz) < o.r + 0.4)
        || M.mata.some((a) => Math.hypot(a.x - x, a.z - zz) < 1.5)) { livre = false; console.log('  trava em', x.toFixed(1), zz.toFixed(1)); break; }
    }
  }
  ok(livre, 'trilha de ' + z.id + ' livre');
}
// busca na grade (0,5 m), do lugar onde o herói nasce até a borda de cada zona, com a folga da borda e os sólidos
const andavel = (x, z) => dentroDoMapa(M, x, z, 2.2) && ![...s.obstaculos, ...s.pertoNaMata(x, z)].some((o) => Math.hypot(o.x - x, o.z - z) < o.r + 0.35);
const chegar = (alvo) => {
  const K = (i, j) => i * 100003 + j, vistos = new Set([K(0, 2)]), fila = [[0, 2, 0]];
  for (let h = 0; h < fila.length; h++) {
    const [i, j, n] = fila[h];
    if (Math.hypot(i * 0.5 - alvo.x, j * 0.5 - alvo.z) < alvo.r + 1.5) return n * 0.5;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const k = K(i + a, j + b); if (vistos.has(k)) continue; vistos.add(k);
      if (andavel((i + a) * 0.5, (j + b) * 0.5)) fila.push([i + a, j + b, n + 1]);
    }
  }
  return Infinity;
};
const dp = chegar(zona('pedra1'));
ok(dp < 70, `da vila até o veio de pedra andando: ${dp} m (antes a parede invisível obrigava a dar a volta)`);
ok(chegar(zona('ferro1')) < Infinity, 'dá para chegar no veio de ferro');
// a emenda não abre chão novo: tudo nela já era andável
const semEmenda = { ...M, areas: M.areas.slice(0, -1) };
let dentro = true;
for (let a = 0; a < 6.283; a += 0.1) for (let r = 0; r <= 12; r += 1) dentro &&= dentroDoMapa(semEmenda, 6 + Math.cos(a) * r, -36 + Math.sin(a) * r, 0);
ok(dentro, 'a emenda fica dentro do mapa de antes');

// Veio esgotado não é barreira invisível (André 2026-11-06): sem a pedra, passa-se por cima; quando volta, bloqueia de novo
{
  const s2 = new Simulacao(M), b = s2.adicionarJogador('B', 'Bia');
  const no = [...s2.coletaveis.values()].find((c) => c.tipo === 'cobre');
  const empurra = () => { b.x = no.x + 0.1; b.z = no.z; b.y = s2.terreno.altura(b.x, b.z); s2.colidir(b); return Math.hypot(b.x - no.x, b.z - no.z); };
  ok(empurra() > no.r, 'veio cheio bloqueia');
  s2.veiosComuns.set(no.id, { n: 0, volta: s2.tempo + 100 });
  ok(empurra() < 0.2, 'veio esgotado deixa passar');
  ok(s2.livreParaHeroi(b, no.x, no.z), 'dá para parar em cima do veio esgotado');
  s2.veiosComuns.set(no.id, { n: 0, volta: s2.tempo - 1 });
  ok(empurra() > no.r, 'veio que voltou bloqueia de novo');
}

// FASE 2 (André 2026-11-08): spots pequenos de pedra, cobre, ferro e cristal espalhados, em chão plano, sem árvore
// dentro, longe dos campos de caça; de qualquer campo de caça tem pedra e cobre por perto.
import { relevo } from '../../shared/relevo.js';
const pq = M.mina.filter((z) => z.pequeno && !z.tunel); // os de dentro das cavernas: ferramentas/testes/cavernas-mundo.mjs
ok(['pedra', 'cobre', 'ferro', 'cristal'].every((t) => pq.filter((z) => z.tipo === t).length >= 3), 'pelo menos 3 spots pequenos de cada minério (com cristal)');
for (const z of pq) {
  const n = [...s.coletaveis.values()].filter((c) => c.mina === z.id).length;
  let plano = 0; for (let a = 0; a < 6.28; a += 0.4) plano = Math.max(plano, Math.abs(relevo(z.x + Math.cos(a) * (z.r + 1), z.z + Math.sin(a) * (z.r + 1)) - relevo(z.x, z.z)));
  ok(n === 3 && plano < 0.2 && !M.mata.some((a) => Math.hypot(a.x - z.x, a.z - z.z) < z.r + 1.2)
    && !M.caca.some((c) => Math.hypot(c.x - z.x, c.z - z.z) < c.r + 6) && dentroDoMapa(M, z.x, z.z, z.r + 2), `${z.id}: 3 pedras, plano, sem árvore, fora da caça, dentro do mapa`);
  ok(M.mina.every((o) => o === z || Math.hypot(o.x - z.x, o.z - z.z) > 15), `${z.id} longe dos outros veios`);
}
for (const c of M.caca.filter((c) => !c.tunel && !c.boss)) for (const t of ['pedra', 'cobre']) { // boss de mundo não tem veio; covil de caverna tem o minério dele lá dentro
  const d = Math.min(...M.mina.filter((z) => z.tipo === t).map((z) => Math.hypot(z.x - c.x, z.z - c.z)));
  ok(d < 75, `${c.id}: ${t} a ${Math.round(d)} m`);
}

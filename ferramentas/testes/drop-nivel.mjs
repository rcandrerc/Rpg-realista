// Drop menor em bicho muito abaixo do herói (André 2026-11-24, opção C, DROP_NIVEL em shared/dados.js).
// Uso: node ferramentas/testes/drop-nivel.mjs
import { Simulacao, MAPA_CLAREIRA, fatorDropNivel, DROP_NIVEL as D, DROPS } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const f = (nh, v) => fatorDropNivel(1, nh, v, D);
ok(f(1) === 1 && f(6) === 1 && f(1, true) === 1 && f(6, true) === 1, 'até 5 níveis acima: chance cheia (comum e valioso)');
ok(f(7) === 0.7 && f(11) === 0.7 && f(12) === 0.4 && f(16) === 0.4 && f(17) === 0.25 && f(76) === 0.25, 'comum: 6-10 acima 70%, 11-15 40%, 16+ 25%');
ok(f(11, true) === 0.7 && f(12, true) === 0 && f(76, true) === 0, 'valioso: some com mais de 10 níveis acima');
ok(fatorDropNivel(40, 10, true, D) === 1, 'bicho acima do herói: chance cheia');
// na simulação: conta couro e fragmento de 3000 puglins Nv 1
const contar = (nivel) => {
  const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('a', 'A', 'ruiva', {});
  j.prog.nivel = nivel; const vazia = structuredClone(j.prog.mochila); const c = { tipo: 'puglin', nivel: 1, x: 0, z: 0 }; let couro = 0, frag = 0;
  const mat = DROPS.puglin.mat; DROPS.puglin.mat = { ...mat, fragmento: [1, 1] };
  try {
    for (let i = 0; i < 3000; i++) { j.prog.mochila = structuredClone(vazia); s.eventos = []; s.soltarDrops(c, j); for (const e of s.eventos) if (e.t === 'drop') for (const it of e.itens) { if (/couro/i.test(it.nome)) couro++; if (/fragmento/i.test(it.nome)) frag++; } }
  } finally { DROPS.puglin.mat = mat; }
  return { couro, frag };
};
const n3 = contar(3), n20 = contar(20), r = n20.couro / n3.couro;
ok(n3.frag > 2900 && n20.frag === 0, `fragmento: Nv 3 ${n3.frag}, Nv 20 ${n20.frag}`);
ok(r > 0.18 && r < 0.32, `couro do Nv 20 é ~25% do Nv 3 (${n3.couro} -> ${n20.couro}, ${(r * 100).toFixed(0)}%)`);

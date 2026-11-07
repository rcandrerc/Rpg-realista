// Teste do mapa todo andável, dos lagos e da montanha (André 2026-11-05: "onde der pra ir, tem que poder ir"; "uns
// lagos rasos e outros fundos"; "uma montanha realista"). Uso: node ferramentas/testes/relevo.mjs
import { Simulacao, MAPA_CLAREIRA, LAGOS, AGUA } from '../../shared/index.js';
import { dentroDoMapa, VOLTA_FOLGA } from '../../shared/mapa.js';
import { noLago, chaoDoRelevo, MERGULHO_MAX, alturaMontanha, GRADE_MONTANHA, INGREME, BOCA_CAVERNA } from '../../shared/relevo.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const M = MAPA_CLAREIRA, s = new Simulacao(M), T = s.terreno, F = 2.2;

// 1) sem parede invisível no meio: todo ponto com 2,2 m de mapa em volta vale (antes a folga era de cada área)
let paredes = 0, dentro = 0;
const { x0, z0, tam } = M.minimapa;
for (let x = x0; x < x0 + tam; x += 1.3) for (let z = z0; z < z0 + tam; z += 1.3) {
  if (!dentroDoMapa(M, x, z, 0)) continue;
  const folga = VOLTA_FOLGA.every(([a, b]) => dentroDoMapa(M, x + a * F, z + b * F, 0) && dentroDoMapa(M, x + a * F * 0.5, z + b * F * 0.5, 0));
  if (folga) { dentro++; if (!dentroDoMapa(M, x, z, F)) paredes++; }
}
ok(paredes === 0, `nenhuma parede invisível no meio do mapa (${dentro} pontos conferidos)`);

// 2) sem buraco fechado: todo pedaço fora do mapa chega na borda do quadrado do minimapa
{
  const st = 1.5, n = Math.ceil(tam / st), fora = new Uint8Array(n * n), visto = new Uint8Array(n * n), fila = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) fora[j * n + i] = dentroDoMapa(M, x0 + i * st, z0 + j * st, 0) ? 0 : 1;
  for (let i = 0; i < n; i++) for (const k of [i, (n - 1) * n + i, i * n, i * n + n - 1]) if (fora[k] && !visto[k]) { visto[k] = 1; fila.push(k); }
  while (fila.length) { const k = fila.pop(), i = k % n, j = (k / n) | 0; for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= n || jj >= n) continue; const q = jj * n + ii; if (fora[q] && !visto[q]) { visto[q] = 1; fila.push(q); } } }
  let buracos = 0; for (let k = 0; k < n * n; k++) if (fora[k] && !visto[k]) { buracos++; if (buracos < 4) console.log('  buraco em', x0 + (k % n) * st, z0 + ((k / n) | 0) * st); }
  ok(buracos === 0, 'nenhum buraco fechado dentro da mata andável');
}

// 3) lagos: rasos e fundos, dentro do mapa, sem árvore, mato ou pedra dentro, e o chão dos pés no lugar certo
ok(LAGOS.filter((l) => l.fundo < 1).length >= 2 && LAGOS.filter((l) => l.fundo > 3).length >= 2, 'tem lagos rasos e fundos');
for (const L of LAGOS) {
  ok(dentroDoMapa(M, L.x, L.z, 4), `${L.nome} fica dentro do mapa andável`);
  ok(!M.mata.some((a) => noLago(a.x, a.z)), `nenhuma árvore dentro do ${L.nome}`);
  ok(!M.cenario.enfeites.some((e) => noLago(e.x, e.z) && !/^rocha/.test(e.m)) && !M.cenario.solidos.some((e) => noLago(e.x, e.z)), `nenhum mato ou pedra dentro do ${L.nome}`);
  ok(!M.caca.some((c) => Math.hypot(c.x - L.x, c.z - L.z) < c.r + Math.max(L.rx, L.rz) + 3), `${L.nome} longe dos campos de caça`);
  const meio = T.altura(L.x, L.z, 5);
  if (L.fundo < 1) ok(Math.abs(meio + L.fundo) < 0.01, `${L.nome}: anda no fundo (${meio.toFixed(2)} m, água pelo joelho)`);
  else ok(Math.abs(meio - (AGUA.nivel - AGUA.peito)) < 0.01, `${L.nome}: boia com a água no peito (${meio.toFixed(2)} m; leito a ${L.fundo} m)`);
}
// o servidor aceita o herói dentro do lago fundo (boiando) e no raso
{
  const j = s.adicionarJogador('L', 'Lia'), fundo = LAGOS.find((l) => l.fundo > 3), raso = LAGOS.find((l) => l.fundo < 1);
  for (const L of [raso, fundo]) {
    j.x = L.x - 0.3; j.z = L.z; j.y = chaoDoRelevo(j.x, j.z); j.morto = false; j.criando = false; j.orc = 10; j.orcT = s.tempo;
    ok(s.posicaoCliente('L', { x: L.x, y: chaoDoRelevo(L.x, L.z), z: L.z, ry: 0 }) !== false, `servidor aceita o herói no ${L.nome}`);
  }
  // mergulho (André 2026-11-06): no fundo dá para afundar até MERGULHO_MAX abaixo da linha em que boia, não mais
  const b = chaoDoRelevo(fundo.x, fundo.z);
  j.x = fundo.x; j.z = fundo.z; j.y = b; j.orc = 10; j.orcT = s.tempo;
  ok(s.posicaoCliente('L', { x: fundo.x, y: b - MERGULHO_MAX + 0.1, z: fundo.z, ry: 0 }) !== false, `servidor aceita o herói mergulhado no ${fundo.nome}`);
  j.x = fundo.x; j.z = fundo.z; j.y = b; j.orc = 10; j.orcT = s.tempo;
  ok(s.posicaoCliente('L', { x: fundo.x, y: b - MERGULHO_MAX - 0.8, z: fundo.z, ry: 0 }) === false, `servidor recusa mergulho fundo demais no ${fundo.nome}`);
}

// 4) montanha: alta, sem agulha, e dá para chegar ao alto andando (encosta até 45 graus) saindo do mapa de antes
{
  const G = GRADE_MONTANHA, n = G.n, h = G.h;
  let alto = 0; for (const v of h) alto = Math.max(alto, v);
  ok(alto > 35, `montanha com ${alto.toFixed(0)} m`);
  let agulha = 0;
  // a boca da Caverna da Montanha (BOCA_CAVERNA, 2026-11-06) é um paredão de propósito: fica de fora da conta
  const B = BOCA_CAVERNA, naBoca = (x, z) => { const ux = x - B.x, uz = z - B.z, d = ux * B.dx + uz * B.dz; return d > -3 && d < B.fundo + 5 && Math.abs(-ux * B.dz + uz * B.dx) < B.larg + B.ombro + 2; };
  for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) { const k = j * n + i; if (naBoca(G.x0 + i * G.passo, G.z0 + j * G.passo)) continue; if (Math.hypot(h[k + 1] - h[k - 1], h[k + n] - h[k - n]) / (2 * G.passo) > 3) agulha++; }
  ok(agulha === 0, 'sem agulha nem pedaço torto (nenhuma encosta acima de 72 graus, fora a boca da caverna)');
  const visto = new Uint8Array(n * n), fila = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) { const x = G.x0 + i * G.passo, z = G.z0 + j * G.passo; if (h[j * n + i] === 0 && dentroDoMapa(M, x, z, F)) { visto[j * n + i] = 1; fila.push(j * n + i); } }
  while (fila.length) {
    const k = fila.pop(), i = k % n, j = (k / n) | 0;
    for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const ii = i + a, jj = j + b, q = jj * n + ii;
      if (ii < 0 || jj < 0 || ii >= n || jj >= n || visto[q]) continue;
      if (h[q] - h[k] > G.passo * Math.hypot(a, b) * INGREME || !dentroDoMapa(M, G.x0 + ii * G.passo, G.z0 + jj * G.passo, F)) continue;
      visto[q] = 1; fila.push(q);
    }
  }
  let topo = 0; for (let k = 0; k < n * n; k++) if (visto[k]) topo = Math.max(topo, h[k]);
  ok(topo > alto - 1, `dá para subir andando até ${topo.toFixed(1)} m (topo ${alto.toFixed(1)} m)`);
  ok(!M.caca.some((c) => alturaMontanha(c.x, c.z) > 0 || alturaMontanha(c.x + c.r, c.z) > 0), 'campo de caça nenhum em cima da montanha');
}

// 2026-11-07 (André: "não quero nenhuma barreira invisível nesse mapa"): do terreno nas Terras da Estrada dá para
// cortar pela mata até a trilha dos Lobos Nv10, sem estrada (antes parava numa parede invisível em x ≈ 20)
for (const z of [85, 100, 115]) {
  let livre = true; for (let x = 5; x <= 60; x += 0.25) livre &&= dentroDoMapa(M, x, z, F);
  ok(livre, `das Terras da Estrada até a trilha dos Lobos Nv10 pela mata (z ${z})`);
}

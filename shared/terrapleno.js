// Chão das bases dos clãs (André 2026-11-23: "quando você puder colocar essa base, nivelar-se um pouco o terreno. Pode
// até deixar um pouco irregular para ficar natural"; "sempre a gente botar a base e uma estrada criada automaticamente
// para a estrada mais próxima"; "se for uma montanha muito alta, ela deve suavizar até chegar a uma estrada").
// 1) Platô: o quadrado da base no Nv 6 (centro e os 6 lotes, TERRAPLENO.meio m para cada lado) fica na altura do meio
//    (mediana do chão de antes), com uma ondinha de até ~30 cm; em volta o chão desce (ou sobe) devagar até o de antes
//    (rampa de no máximo TERRAPLENO.rampa de inclinação média), sem passar dos lugares protegidos (vila, totem...).
// 2) Estrada: do portão da base (frente, +z) até a estrada mais perto, pelo caminho menos íngreme (Dijkstra na grade de
//    4 m do mundo, desviando dos lotes, da água e das outras bases), com o perfil alisado e o chão cortado/aterrado nos
//    dois lados.
// Tudo sai da grade de antes (relevo.js alturaOrigGrade), na mesma ordem (chave da base), então mudar a base de lugar
// devolve o chão velho como era. O app recebe o y do platô, o wmax e os pontos da estrada e faz a mesma conta
// (godot-prototipo/base_cla.gd _chao_das_bases).
import { CLA } from './dados.js';
import { gradeDoMundo, alturaOrigGrade, aplicarChaoBases } from './relevo.js';

export const TERRAPLENO = { meio: 33, rampa: 0.25, wMin: 6, wMax: 90, yMin: 1.8, portao: 19, larg: 5.6, borda: 11, busca: 420, subida: 0.12, aterro: 5 };

const sv = (t) => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };
export const ruidoChao = (x, z) => 0.6 * Math.sin(x * 0.21 + z * 0.13) + 0.4 * Math.sin(z * 0.29 - x * 0.17);

// o y do platô e até onde a rampa pode ir (wmax: não chega nos círculos protegidos)
export function nivelDaBase(B, protegidos = []) {
  const G = gradeDoMundo(), T = TERRAPLENO; if (!G) return null;
  const hs = [];
  let tot = 0;
  const i0 = Math.ceil((B.x - T.meio - G.x0) / G.passo), i1 = Math.floor((B.x + T.meio - G.x0) / G.passo);
  const j0 = Math.ceil((B.z - T.meio - G.z0) / G.passo), j1 = Math.floor((B.z + T.meio - G.z0) / G.passo);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (i < 0 || j < 0 || i >= G.nx || j >= G.nz) continue;
    // André 2026-11-23 (base perto da praia, v2971: "a estrada continua sem aparecer"): antes qualquer ponto baixo
    // (areia da beira) cancelava o nivelamento e a estrada da base inteira. Agora só o mapa de hoje (grade 0) cancela;
    // areia e mar ficam fora da conta do meio (a areia sobe junto no platô; o mar não muda).
    const o = alturaOrigGrade(j * G.nx + i); if (Math.abs(o) < 0.02) return null; // mapa de hoje: não nivela (base.js desnivelFixo)
    tot++;
    if (o >= 0.6) hs.push(o);
  }
  if (!hs.length || hs.length < tot * 0.6) return null;
  hs.sort((a, b) => a - b);
  const y = Math.max(T.yMin, hs[hs.length >> 1]);
  let wmax = T.wMax;
  for (const c of protegidos) {
    const ex = Math.max(Math.abs(c.x - B.x) - T.meio, 0), ez = Math.max(Math.abs(c.z - B.z) - T.meio, 0);
    wmax = Math.min(wmax, Math.hypot(ex, ez) - c.r);
  }
  return { y: +y.toFixed(2), wmax: +Math.max(0, wmax).toFixed(1) };
}

const AREIA = 0.1; // m: grade acima disso é terra (a areia da praia fica entre 0,1 e 0,6)
// o platô de uma base nas alturas de trabalho (ed: Map k -> h)
export function aplainar(G, ed, x, z, y, wmax) {
  const T = TERRAPLENO, R = T.meio + wmax;
  const i0 = Math.max(0, Math.ceil((x - R - G.x0) / G.passo)), i1 = Math.min(G.nx - 1, Math.floor((x + R - G.x0) / G.passo));
  const j0 = Math.max(0, Math.ceil((z - R - G.z0) / G.passo)), j1 = Math.min(G.nz - 1, Math.floor((z + R - G.z0) / G.passo));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * G.nx + i, o = alturaOrigGrade(k);
    if (o < AREIA || (G.rio && G.rio[k] > 0)) continue; // o mar não muda (a areia da beira sobe junto)
    const px = G.x0 + i * G.passo, pz = G.z0 + j * G.passo, dx = Math.abs(px - x), dz = Math.abs(pz - z);
    const d = Math.hypot(Math.max(dx - T.meio, 0), Math.max(dz - T.meio, 0)), n = ruidoChao(px, pz);
    if (d <= 0) { ed.set(k, y); continue; } // dentro: plano de verdade (André 2026-11-23: a grama furava a terra arada); a ondinha fica na rampa
    const cur = ed.has(k) ? ed.get(k) : o, diff = cur - y, W = Math.min(wmax, Math.max(T.wMin, Math.min(T.wMax, Math.abs(diff) / T.rampa)));
    if (d >= W) continue;
    const s = sv(d / W);
    ed.set(k, y + n * 0.3 * s * (1 - s) * 4 + diff * s); // ondinha só no meio da rampa (zero na beira do platô)
  }
}

// a estrada (pontos [x, z, y]) corta e aterra o chão em volta
export function cortarEstrada(G, ed, pts, bases = []) {
  const T = TERRAPLENO;
  if (!pts || pts.length < 2) return;
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const p of pts) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
  const i0 = Math.max(0, Math.ceil((x0 - T.borda - G.x0) / G.passo)), i1 = Math.min(G.nx - 1, Math.floor((x1 + T.borda - G.x0) / G.passo));
  const j0 = Math.max(0, Math.ceil((z0 - T.borda - G.z0) / G.passo)), j1 = Math.min(G.nz - 1, Math.floor((z1 + T.borda - G.z0) / G.passo));
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const k = j * G.nx + i, o = alturaOrigGrade(k);
    if (o < AREIA || (G.rio && G.rio[k] > 0)) continue;
    const px = G.x0 + i * G.passo, pz = G.z0 + j * G.passo;
    if (bases.some((b) => Math.abs(px - b[0]) <= T.meio && Math.abs(pz - b[1]) <= T.meio)) continue; // dentro do platô
    let best = Infinity, by = 0;
    for (let s = 1; s < pts.length; s++) {
      const a = pts[s - 1], b = pts[s], vx = b[0] - a[0], vz = b[1] - a[1], L = vx * vx + vz * vz;
      const t = L ? Math.max(0, Math.min(1, ((px - a[0]) * vx + (pz - a[1]) * vz) / L)) : 0;
      const d = Math.hypot(px - a[0] - t * vx, pz - a[1] - t * vz);
      if (d < best) { best = d; by = a[2] + (b[2] - a[2]) * t; }
    }
    if (best >= T.borda) continue;
    const w = best <= T.larg ? 1 : 1 - sv((best - T.larg) / (T.borda - T.larg)), cur = ed.has(k) ? ed.get(k) : o;
    ed.set(k, cur + (by - 0.05 - cur) * w);
  }
}

// o caminho do portão até a estrada mais perto: [[x, z, y], ...] (vazio se não achou)
export function caminhoDaBase(B, y, outras = []) {
  const G = gradeDoMundo(), T = TERRAPLENO, P = CLA.base; if (!G || !G.estrada) return [];
  const nx = G.nx, ci = Math.round((B.x - G.x0) / G.passo), cj = Math.round((B.z - G.z0) / G.passo), r = Math.round(T.busca / G.passo);
  const ia = Math.max(0, ci - r), ib = Math.min(nx - 1, ci + r), ja = Math.max(0, cj - r), jb = Math.min(G.nz - 1, cj + r), w = ib - ia + 1, hgt = jb - ja + 1;
  const hc = P.niveis[P.niveis.length - 1].centro / 2, hl = P.lote / 2;
  const rets = [[B.x - hc, B.z - hc, B.x + hc, B.z + hc], ...P.lugares.map(([dx, dz]) => [B.x + dx - hl, B.z + dz - hl, B.x + dx + hl, B.z + dz + hl])];
  const altura = (k, px, pz) => (Math.abs(px - B.x) <= T.meio && Math.abs(pz - B.z) <= T.meio ? y : G.h[k]);
  const pode = (k, px, pz) => {
    if (!G.terra[k] || G.h[k] < 0.8 || (G.rio && G.rio[k] > 0 && G.estrada[k] < 5)) return false;
    if (rets.some((R) => px > R[0] && px < R[2] && pz > R[1] && pz < R[3])) return false;
    return !outras.some((o) => Math.abs(px - o.x) <= T.meio + 2 && Math.abs(pz - o.z) <= T.meio + 2);
  };
  const gi = Math.round((B.x - G.x0) / G.passo), gj = Math.round((B.z + T.portao - G.z0) / G.passo);
  if (gi < ia || gi > ib || gj < ja || gj > jb) return [];
  const dist = new Float64Array(w * hgt).fill(Infinity), de = new Int32Array(w * hgt).fill(-1), feito = new Uint8Array(w * hgt);
  const heap = []; // [custo, n]
  const push = (c, n) => { heap.push([c, n]); let i = heap.length - 1; while (i) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const t = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let m = i; if (a < heap.length && heap[a][0] < heap[m][0]) m = a; if (b < heap.length && heap[b][0] < heap[m][0]) m = b; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return t; };
  const s0 = (gj - ja) * w + (gi - ia); dist[s0] = 0; push(0, s0);
  const viz = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let fim = -1;
  while (heap.length) {
    const [c, n] = pop(); if (feito[n]) continue; feito[n] = 1;
    const li = n % w, lj = (n / w) | 0, i = li + ia, j = lj + ja, k = j * nx + i, px = G.x0 + i * G.passo, pz = G.z0 + j * G.passo;
    if (G.estrada[k] >= 5 && !(Math.abs(px - B.x) <= T.meio && Math.abs(pz - B.z) <= T.meio)) { fim = n; break; }
    const h0 = altura(k, px, pz);
    for (const [a, b] of viz) {
      const ni = li + a, nj = lj + b; if (ni < 0 || nj < 0 || ni >= w || nj >= hgt) continue;
      const m = nj * w + ni; if (feito[m]) continue;
      const kk = (nj + ja) * nx + ni + ia, qx = G.x0 + (ni + ia) * G.passo, qz = G.z0 + (nj + ja) * G.passo;
      if (!pode(kk, qx, qz)) continue;
      const L = G.passo * (a && b ? Math.SQRT2 : 1), sl = Math.abs(altura(kk, qx, qz) - h0) / L;
      const nc = c + L * (1 + 4 * sl + 60 * Math.max(0, sl - 0.1));
      if (nc < dist[m]) { dist[m] = nc; de[m] = n; push(nc, m); }
    }
  }
  if (fim < 0) return [];
  let cam = [];
  for (let n = fim; n >= 0; n = de[n]) { const i = n % w + ia, j = ((n / w) | 0) + ja; cam.push([G.x0 + i * G.passo, G.z0 + j * G.passo]); }
  cam.reverse();
  cam[0] = [B.x, B.z + T.portao - 2]; // começa no portão
  // curva macia (Chaikin, 2 vezes; as pontas ficam)
  for (let v = 0; v < 2; v++) {
    const n = [cam[0]];
    for (let s = 0; s < cam.length - 1; s++) { const a = cam[s], b = cam[s + 1]; n.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]); }
    n.push(cam[cam.length - 1]); cam = n;
  }
  // perfil: a altura do chão (com o platô), alisada (as pontas ficam)
  const hAt = (x, z) => {
    if (Math.abs(x - B.x) <= T.meio + 2 && Math.abs(z - B.z) <= T.meio + 2) return y;
    const fx = (x - G.x0) / G.passo, fz = (z - G.z0) / G.passo, ix = Math.floor(fx), iz = Math.floor(fz), ax = fx - ix, az = fz - iz, k = iz * nx + ix, h = G.h;
    return (h[k] * (1 - ax) + h[k + 1] * ax) * (1 - az) + (h[k + nx] * (1 - ax) + h[k + nx + 1] * ax) * az;
  };
  let ys = cam.map(([x, z]) => hAt(x, z));
  // dentro do platô a estrada fica na altura dele (a rampa começa na beira)
  const fixo = cam.map(([x, z], i) => i === 0 || i === cam.length - 1 || (Math.abs(x - B.x) <= T.meio + 2 && Math.abs(z - B.z) <= T.meio + 2));
  const alisar = (l) => l.map((q, i) => (fixo[i] ? q : (l[i - 1] + 2 * q + l[i + 1]) / 4));
  for (let v = 0; v < 40; v++) ys = alisar(ys);
  // rampa de no máximo TERRAPLENO.subida (ou o mínimo que dá para chegar lá): o chão é cortado ou aterrado embaixo
  const ds = [0]; for (let i = 1; i < cam.length; i++) ds.push(ds[i - 1] + Math.hypot(cam[i][0] - cam[i - 1][0], cam[i][1] - cam[i - 1][1]));
  let Lt = 0; for (let i = 1; i < cam.length; i++) if (!(fixo[i] && fixo[i - 1])) Lt += ds[i] - ds[i - 1];
  const n1 = ys.length - 1, sub = Math.max(T.subida, (1.2 * Math.abs(ys[n1] - ys[0])) / Math.max(1, Lt));
  for (let v = 0; v < 12; v++) {
    for (let i = 1; i < n1; i++) if (!fixo[i]) { const d = (ds[i] - ds[i - 1]) * sub; ys[i] = Math.max(ys[i - 1] - d, Math.min(ys[i - 1] + d, ys[i])); }
    for (let i = n1 - 1; i > 0; i--) if (!fixo[i]) { const d = (ds[i + 1] - ds[i]) * sub; ys[i] = Math.max(ys[i + 1] - d, Math.min(ys[i + 1] + d, ys[i])); }
  }
  // sem aterro nem corte de mais de TERRAPLENO.aterro m (morro muito alto: a estrada fica mais inclinada, sem virar muralha)
  const h0s = cam.map(([x, z]) => hAt(x, z));
  ys = ys.map((q, i) => (fixo[i] ? q : Math.max(h0s[i] - T.aterro, Math.min(h0s[i] + T.aterro, q))));
  for (let v = 0; v < 6; v++) ys = alisar(ys);
  return cam.map(([x, z], i) => [+x.toFixed(1), +z.toFixed(1), +Math.max(0.6, ys[i]).toFixed(2)]).filter((_, i, l) => i % 2 === 0 || i === l.length - 1); // um ponto a cada ~2 m
}

// o chão de todas as bases: lista [{ k, x, z, y, wmax, estrada }] na ordem da chave. Aplica na grade e devolve as edições
export function chaoDasBases(lista) {
  const G = gradeDoMundo(); if (!G) return null;
  const ed = new Map(), ord = [...lista].sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0)), centros = ord.map((b) => [b.x, b.z]);
  for (const b of ord) if (b.y != null) aplainar(G, ed, b.x, b.z, b.y, b.wmax);
  for (const b of ord) if (b.estrada?.length) cortarEstrada(G, ed, b.estrada, centros);
  aplicarChaoBases(ed);
  return ed;
}

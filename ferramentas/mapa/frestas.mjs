// Frestas do mapa (André 2026-11-07: "não quero nenhuma barreira invisível nesse mapa... a única barreira é quando o
// mapa acabar"). Acha as baías de mata entre as áreas andáveis (onde se via a estrada do outro lado e não dava para
// passar) e cobre cada uma com círculos. Conta: fechamento morfológico de raio R (engorda o mapa R metros e emagrece
// de volta): o que ficou dentro e não era andável é fresta. Os círculos saem do mais largo para o mais estreito.
// Uso: node ferramentas/mapa/frestas.mjs  -> imprime a lista FRESTAS para shared/dados.js
import { MAPA_CLAREIRA } from '../../shared/index.js';
import { dentroDoMapa } from '../../shared/mapa.js';

const R = 30, P = R + 4, MIN = 2.5, MAX = 14;
const M = { areas: MAPA_CLAREIRA.areas.filter((a) => !a.fresta), corredores: MAPA_CLAREIRA.corredores };
const X0 = MAPA_CLAREIRA.minimapa.x0 - P, Z0 = MAPA_CLAREIRA.minimapa.z0 - P, n = MAPA_CLAREIRA.minimapa.tam + 2 * P;
const W = new Uint8Array(n * n);
for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) W[j * n + i] = dentroDoMapa(M, X0 + i + 0.5, Z0 + j + 0.5, 0) ? 1 : 0;

// distância euclidiana ao quadrado (Felzenszwalb) até a célula marcada mais perto
function edt1(f) {
  const d = new Float64Array(n), v = new Int32Array(n), z = new Float64Array(n + 1); let k = 0; v[0] = 0; z[0] = -Infinity; z[1] = Infinity;
  for (let q = 1; q < n; q++) {
    let s; for (;;) { s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); if (s <= z[k]) k--; else break; }
    k++; v[k] = q; z[k] = s; z[k + 1] = Infinity;
  }
  k = 0; for (let q = 0; q < n; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) ** 2 + f[v[k]]; }
  return d;
}
function dist2(marca) {
  const g = new Float64Array(n * n), f = new Float64Array(n);
  for (let i = 0; i < n; i++) { for (let j = 0; j < n; j++) f[j] = marca(j * n + i) ? 0 : 1e12; const d = edt1(f); for (let j = 0; j < n; j++) g[j * n + i] = d[j]; }
  for (let j = 0; j < n; j++) g.set(edt1(g.subarray(j * n, j * n + n)), j * n);
  return g;
}
const d1 = dist2((k) => W[k]);
const d2 = dist2((k) => d1[k] > R * R); // até fora do mapa engordado
const C = new Uint8Array(n * n); for (let k = 0; k < n * n; k++) C[k] = d2[k] > R * R ? 1 : 0;
const d3 = dist2((k) => !C[k]); // até fora do fechamento: o raio que cabe

const cob = new Uint8Array(n * n), lista = [];
for (;;) {
  let bk = -1, br = -1;
  for (let k = 0; k < n * n; k++) if (C[k] && !W[k] && !cob[k] && d3[k] > br) { br = d3[k]; bk = k; }
  if (bk < 0) break;
  const r = Math.min(Math.sqrt(br) - 0.7, MAX);
  if (r < MIN) { cob[bk] = 1; continue; }
  const ci = bk % n, cj = (bk / n) | 0, rr = Math.ceil(r);
  lista.push([+(X0 + ci + 0.5).toFixed(1), +(Z0 + cj + 0.5).toFixed(1), +r.toFixed(1)]);
  for (let b = -rr; b <= rr; b++) for (let a = -rr; a <= rr; a++) { const i = ci + a, j = cj + b; if (i >= 0 && j >= 0 && i < n && j < n && a * a + b * b <= r * r) cob[j * n + i] = 1; }
}
console.log(`// ${lista.length} círculos (ferramentas/mapa/frestas.mjs, R ${R} m)`);
console.log('const FRESTAS = [' + lista.map((c) => `[${c.join(', ')}]`).join(', ') + ']');

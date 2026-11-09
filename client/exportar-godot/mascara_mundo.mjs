// Ferramenta (chamada pelo mundo.mjs): grava godot-prototipo/relevo/mundo_mascara.png, 1 pixel por metro do mundo grande.
// 2026-11-09 (André: "do lado direito a transição certinha, terra, grama; do lado esquerdo uma brutalidade reta" e "um
// quadrado perfeito que era o mapa antigo"):
// R = estradas e trilhas do mundo, com a borda macia dos dois lados (antes era a cor do vértice da grade de 4 m: a borda
//     caía conforme a grade, macia de um lado e reta do outro). terreno_mundo.gdshader e chao.gdshader leem daqui.
// G = o mapa andável de hoje (borda macia de 4 m): o minimapa só desenha o minimapa.png de hoje aí dentro.
// B = onde a grade do mundo é o mapa de hoje (altura 0): o chão plano (chao.gdshader) só existe aí; fora, o chão do
//     mundo (sem o quadrado do chão antigo).
import { dentroDoMapa } from '../../shared/mapa.js';
import { png } from './longe.mjs';

// 2026-11-09 (André: "um lado com transição, do outro uma coisa reta horrível, e no mapa nem existe"): a areia da praia
// só vale perto do mar. Antes era só pela altura (abaixo de 1,1 m), então o chão baixo encostado no mapa de hoje virava
// uma faixa de terra que parecia estrada, macia de um lado e cortada reta pelo chão plano do outro.
// Devolve, por ponto da grade, 0-9: 9 até 10 m do mar (terra 0), caindo até 0 aos 22 m. terreno_mundo.gdshader (cor B).
export function praiaDaGrade(G) {
  const nx = G.nx, nz = G.nz, p = G.passo, d2 = p * Math.SQRT2, dm = new Float32Array(nx * nz);
  for (let k = 0; k < dm.length; k++) dm[k] = G.terra[k] === 0 ? 0 : 1e9;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; let v = dm[k];
    if (i > 0) v = Math.min(v, dm[k - 1] + p); if (j > 0) v = Math.min(v, dm[k - nx] + p);
    if (i > 0 && j > 0) v = Math.min(v, dm[k - nx - 1] + d2); if (i < nx - 1 && j > 0) v = Math.min(v, dm[k - nx + 1] + d2);
    dm[k] = v;
  }
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i; let v = dm[k];
    if (i < nx - 1) v = Math.min(v, dm[k + 1] + p); if (j < nz - 1) v = Math.min(v, dm[k + nx] + p);
    if (i < nx - 1 && j < nz - 1) v = Math.min(v, dm[k + nx + 1] + d2); if (i > 0 && j < nz - 1) v = Math.min(v, dm[k + nx - 1] + d2);
    dm[k] = v;
  }
  let s = '';
  for (let k = 0; k < dm.length; k++) { const t = Math.min(1, Math.max(0, (dm[k] - 10) / 12)); s += Math.round((1 - t * t * (3 - 2 * t)) * 9); }
  return s;
}

export function gerarMascaraMundo(G, estradas, M) {
  const hoje = { areas: M.areas, corredores: M.corredores, raio: M.raio };
  const W = Math.round((G.nx - 1) * G.passo) + 1, H = Math.round((G.nz - 1) * G.passo) + 1;
  const R = new Float32Array(W * H), Gc = new Float32Array(W * H), B = new Float32Array(W * H);
  // B: altura 0 da grade, bilinear (o limiar 0,5 no shader cai entre o ponto 0 e o vizinho)
  const zero = (i, j) => (G.h[Math.min(G.nz - 1, j) * G.nx + Math.min(G.nx - 1, i)] === 0 ? 1 : 0);
  let x0 = W, x1 = 0, z0 = H, z1 = 0;
  for (let pz = 0; pz < H; pz++) for (let px = 0; px < W; px++) {
    const fx = px / G.passo, fz = pz / G.passo, i = Math.floor(fx), j = Math.floor(fz), ax = fx - i, az = fz - j;
    const v = (zero(i, j) * (1 - ax) + zero(i + 1, j) * ax) * (1 - az) + (zero(i, j + 1) * (1 - ax) + zero(i + 1, j + 1) * ax) * az;
    B[pz * W + px] = v;
    if (v > 0) { x0 = Math.min(x0, px); x1 = Math.max(x1, px); z0 = Math.min(z0, pz); z1 = Math.max(z1, pz); }
  }
  // G: dentro do mapa andável de hoje, com 4 m de passagem macia
  for (let pz = z0; pz <= z1; pz++) for (let px = x0; px <= x1; px++) {
    if (B[pz * W + px] <= 0) continue;
    const x = G.x0 + px, z = G.z0 + pz;
    Gc[pz * W + px] = dentroDoMapa(hoje, x, z, 2) ? 1 : dentroDoMapa(hoje, x, z, 0) ? 0.66 : dentroDoMapa(hoje, x, z, -2) ? 0.33 : 0;
  }
  // R: cada estrada (4 m) e trilha (2,6 m) pela curva, com 1,6 m de borda macia dos dois lados
  for (const E of estradas) {
    const meia = (E.larg || 4) / 2, borda = 1.6, alc = meia + borda;
    for (const [cx, cz] of E.curva) {
      const ci = cx - G.x0, cj = cz - G.z0;
      for (let pz = Math.max(0, Math.floor(cj - alc)); pz <= Math.min(H - 1, Math.ceil(cj + alc)); pz++)
        for (let px = Math.max(0, Math.floor(ci - alc)); px <= Math.min(W - 1, Math.ceil(ci + alc)); px++) {
          const d = Math.hypot(px - ci, pz - cj), t = Math.min(1, Math.max(0, (d - meia + borda * 0.5) / borda)), v = 1 - t * t * (3 - 2 * t);
          const k = pz * W + px; if (v > R[k]) R[k] = v;
        }
    }
  }
  const linhas = Buffer.alloc(H * (W * 4 + 1));
  for (let j = 0; j < H; j++) {
    linhas[j * (W * 4 + 1)] = 0;
    for (let i = 0; i < W; i++) { const o = j * (W * 4 + 1) + 1 + i * 4, k = j * W + i; linhas[o] = Math.round(R[k] * 255); linhas[o + 1] = Math.round(Gc[k] * 255); linhas[o + 2] = Math.round(B[k] * 255); linhas[o + 3] = 255; }
  }
  return { png: png(W, H, linhas), x0: G.x0, z0: G.z0, w: W - 1, h: H - 1 };
}

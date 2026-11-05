// Ferramenta: grava godot-prototipo/relevo/longe.png, a máscara do chão visto de longe (vista do alto da montanha).
// Direção de arte 2026-11-05: nada de desenho do minimapa colado no chão. O chão de longe é a mesma grama de perto;
// esta máscara só diz onde tem mata (R: copa vista de cima, 1 fora do mapa andável = a mata continua) e onde tem
// trilha (G: terra, o chao.gdshader usa a 50%). Uso: node client/exportar-godot/longe.mjs (o mundo.mjs já chama).
import fs from 'node:fs';
import zlib from 'node:zlib';
import { MAPA_CLAREIRA } from '@rpg/shared';
import { dentroDoMapa } from '../../shared/mapa.js';

export const LONGE = { x0: -64, z0: -146, tam: 412, px: 512 };

// copas da mata de fora (fora do mapa andável, dentro do quadrado): do alto elas viram copas simples como as da mata
// de dentro, então a borda do mapa não fica uma mata chapada. [x, z, tamanho, tipo], a cada ~8 m com sorteio fixo.
export function copasDeFora(M = MAPA_CLAREIRA) {
  const { x0, z0, tam } = LONGE, out = [], passo = 8;
  let sem = 12345; const rnd = () => ((sem = (sem * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let z = z0 + passo / 2; z < z0 + tam; z += passo) for (let x = x0 + passo / 2; x < x0 + tam; x += passo) {
    const px = x + (rnd() - 0.5) * passo * 0.8, pz = z + (rnd() - 0.5) * passo * 0.8, s = 0.95 + rnd() * 0.4, v = Math.floor(rnd() * 3);
    if (dentroDoMapa(M, px, pz, -3)) continue;
    out.push([Math.round(px * 10) / 10, Math.round(pz * 10) / 10, Math.round(s * 100) / 100, v]);
  }
  return out;
}

export function gerarLonge(M = MAPA_CLAREIRA) {
  const { x0, z0, tam, px } = LONGE, st = tam / px;
  const R = new Float32Array(px * px), G = new Float32Array(px * px);
  // fora do mapa andável: mata fechada (a mesma borda que para o herói)
  for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) if (!dentroDoMapa(M, x0 + (i + 0.5) * st, z0 + (j + 0.5) * st, 0)) R[j * px + i] = 1;
  // cada árvore escurece o chão embaixo da copa (sombra de mata), com borda macia
  for (const a of M.mata) {
    const r = 3.2 * (a.s || 1), ci = (a.x - x0) / st, cj = (a.z - z0) / st, rp = r / st;
    for (let j = Math.floor(cj - rp); j <= Math.ceil(cj + rp); j++) for (let i = Math.floor(ci - rp); i <= Math.ceil(ci + rp); i++) {
      if (i < 0 || j < 0 || i >= px || j >= px) continue;
      const d = Math.hypot(i - ci, j - cj) / rp; if (d >= 1) continue;
      const k = j * px + i; R[k] = Math.max(R[k], 0.75 * (1 - d * d));
    }
  }
  // trilhas e a estrada: terra
  const linha = (pts, larg) => {
    for (let n = 0; n + 1 < pts.length; n++) {
      const [ax, az] = pts[n], [bx, bz] = pts[n + 1], L = Math.hypot(bx - ax, bz - az) || 1;
      for (let t = 0; t <= L; t += st * 0.5) {
        const x = ax + (bx - ax) * t / L, z = az + (bz - az) * t / L, rp = larg / 2 / st + 1;
        const ci = (x - x0) / st, cj = (z - z0) / st;
        for (let j = Math.floor(cj - rp); j <= Math.ceil(cj + rp); j++) for (let i = Math.floor(ci - rp); i <= Math.ceil(ci + rp); i++) {
          if (i < 0 || j < 0 || i >= px || j >= px) continue;
          const d = Math.hypot(i - ci, j - cj) / rp; if (d >= 1) continue;
          const k = j * px + i; G[k] = Math.max(G[k], Math.min(1, (1 - d) * 2)); R[k] *= 0.3;
        }
      }
    }
  };
  for (const c of M.vila?.caminhos || []) linha(c.pontos, c.largura || 2.4);
  if (M.estrada?.length) linha(M.estrada, 3.2);
  // um desfoque leve: de longe nada tem borda dura
  const borrar = (A) => { const B = new Float32Array(A.length); for (let j = 0; j < px; j++) for (let i = 0; i < px; i++) { let s = 0, w = 0; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const ii = i + a, jj = j + b; if (ii < 0 || jj < 0 || ii >= px || jj >= px) continue; s += A[jj * px + ii]; w++; } B[j * px + i] = s / w; } return B; };
  const r = borrar(R), g = borrar(G);
  const linhas = Buffer.alloc(px * (px * 4 + 1));
  for (let j = 0; j < px; j++) {
    linhas[j * (px * 4 + 1)] = 0;
    for (let i = 0; i < px; i++) { const o = j * (px * 4 + 1) + 1 + i * 4, k = j * px + i; linhas[o] = Math.round(r[k] * 255); linhas[o + 1] = Math.round(g[k] * 255); linhas[o + 2] = 0; linhas[o + 3] = 255; }
  }
  return png(px, px, linhas);
}

function png(w, h, dados) {
  const crc = (b) => { let c = ~0; for (const x of b) { c ^= x; for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1)); } return ~c >>> 0; };
  const bloco = (tipo, d) => { const t = Buffer.from(tipo), n = Buffer.alloc(4), c = Buffer.alloc(4); n.writeUInt32BE(d.length); c.writeUInt32BE(crc(Buffer.concat([t, d]))); return Buffer.concat([n, t, d, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), bloco('IHDR', ihdr), bloco('IDAT', zlib.deflateSync(dados, { level: 9 })), bloco('IEND', Buffer.alloc(0))]);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fs.writeFileSync(new URL('../../godot-prototipo/relevo/longe.png', import.meta.url), gerarLonge());
  console.log('longe.png gravado');
}

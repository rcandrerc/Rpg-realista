// Chão com pedras: a altura em cada ponto vem da forma real dos modelos (grade em shared/rochas.js).
// O herói não atravessa pedra: degrau baixo ele sobe andando, mais alto ele escala.
import { GRADES } from './rochas.js';

// Telhado das casas da vila (o cliente desenha com os mesmos números em client/src/vila.js)
export const TELHADO = { inclinacao: 0.82, esp: 0.3, beiral: 0.5, pontas: 0.38 };

export class Terreno {
  constructor(mapa) {
    this.rochas = (mapa.rochas || []).map((r) => {
      const g = GRADES[r.modelo];
      const xa = Math.max(Math.abs(g.x0), Math.abs(g.x0 + (g.nx - 1) * g.passo)), za = Math.max(Math.abs(g.z0), Math.abs(g.z0 + (g.nz - 1) * g.passo));
      return { ...r, g, y0: r.y || 0, cos: Math.cos(r.ry), sen: Math.sin(r.ry), R: Math.hypot(xa, za) * r.s };
    });
    // casas: paredes retas (dá para escalar) e telhado de duas águas (dá para andar em cima)
    this.casas = (mapa.vila?.casas || []).map((c) => {
      const sobe = (c.d / 2) * TELHADO.inclinacao;
      return { casa: true, x: c.x, z: c.z, cos: Math.cos(c.ry), sen: Math.sin(c.ry), hw: c.w / 2, hd: c.d / 2, sobe,
        y1: (c.aberta ? 0.22 : 0.42) + c.h + TELHADO.esp / Math.cos(Math.atan2(sobe, c.d / 2)), R: Math.hypot(c.w / 2, c.d / 2) };
    });
    this.solidos = [...this.rochas, ...this.casas];
  }
  // altura do telhado de uma casa num ponto (ou -1 se fora dela)
  alturaCasa(c, x, z) {
    const dx = x - c.x, dz = z - c.z;
    if (dx * dx + dz * dz > c.R * c.R) return -1;
    const lx = dx * c.cos - dz * c.sen, lz = dx * c.sen + dz * c.cos;
    if (Math.abs(lx) > c.hw || Math.abs(lz) > c.hd) return -1;
    return c.y1 + c.sobe * (1 - Math.abs(lz) / c.hd);
  }
  // para onde olhar ao agarrar a parede de uma casa (de frente para a parede mais perto)
  deFrentePara(c, x, z) {
    const dx = x - c.x, dz = z - c.z, lx = dx * c.cos - dz * c.sen, lz = dx * c.sen + dz * c.cos;
    const [nx, nz] = Math.abs(lx) / c.hw > Math.abs(lz) / c.hd ? [-Math.sign(lx), 0] : [0, -Math.sign(lz)];
    return Math.atan2(nx * c.cos + nz * c.sen, -nx * c.sen + nz * c.cos);
  }
  // altura da pedra de uma rocha num ponto do mundo (ou -1 se fora dela)
  alturaNa(r, x, z) {
    if (r.casa) return this.alturaCasa(r, x, z);
    const dx = x - r.x, dz = z - r.z;
    if (dx * dx + dz * dz > r.R * r.R) return -1;
    const g = r.g, lx = (dx * r.cos - dz * r.sen) / r.s, lz = (dx * r.sen + dz * r.cos) / r.s; // mundo -> espaço do modelo (giro em Y)
    const fx = (lx - g.x0) / g.passo, fz = (lz - g.z0) / g.passo;
    if (fx < 0 || fz < 0 || fx > g.nx - 1 || fz > g.nz - 1) return -1;
    const ix = Math.min(g.nx - 2, Math.floor(fx)), iz = Math.min(g.nz - 2, Math.floor(fz)), ax = fx - ix, az = fz - iz, h = g.h, n = g.nx;
    const v = (h[iz * n + ix] * (1 - ax) + h[iz * n + ix + 1] * ax) * (1 - az) + (h[(iz + 1) * n + ix] * (1 - ax) + h[(iz + 1) * n + ix + 1] * ax) * az;
    return v / 100 * r.s + r.y0;
  }
  // altura do chão (0) ou da pedra (ou telhado) mais alto naquele ponto
  altura(x, z) {
    let h = 0;
    for (const r of this.solidos) { const a = this.alturaNa(r, x, z); if (a > h) h = a; }
    return h;
  }
  // qual rocha está mais alta naquele ponto
  rochaEm(x, z) {
    let melhor = null, h = 0.05;
    for (const r of this.solidos) { const a = this.alturaNa(r, x, z); if (a > h) { h = a; melhor = r; } }
    return melhor;
  }
  // O que tem à frente (direção ry): a maior altura até "ate" metros e a distância até a pedra passar de "acima"
  frente(x, z, ry, ate, acima) {
    const fx = Math.sin(ry), fz = Math.cos(ry);
    let topo = 0, dist = -1;
    for (let d = 0.1; d <= ate; d += 0.1) {
      const h = this.altura(x + fx * d, z + fz * d);
      if (h > topo) topo = h;
      if (dist < 0 && acima != null && h > acima) dist = d;
    }
    return { topo, dist };
  }
}

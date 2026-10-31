// Chão com pedras: a altura em cada ponto vem da forma real dos modelos (grade em shared/rochas.js).
// O herói não atravessa pedra: degrau baixo ele sobe andando, mais alto ele escala.
import { GRADES } from './rochas.js';

// Telhado das casas da vila (o cliente desenha com os mesmos números em client/src/vila.js)
export const TELHADO = { inclinacao: 0.82, esp: 0.3, beiral: 0.5, pontas: 0.38 };
const ACIMA = 0.5; // peça suspensa vira chão quando a base dela está até isso acima dos pés

export class Terreno {
  constructor(mapa) {
    this.rochas = (mapa.rochas || []).map((r) => {
      const g = GRADES[r.modelo];
      const xa = Math.max(Math.abs(g.x0), Math.abs(g.x0 + (g.nx - 1) * g.passo)), za = Math.max(Math.abs(g.z0), Math.abs(g.z0 + (g.nz - 1) * g.passo));
      return { ...r, g, y0: r.y || 0, cos: Math.cos(r.ry), sen: Math.sin(r.ry), R: Math.hypot(xa, za) * r.s };
    });
    // casas: paredes retas (dá para escalar) e telhado de duas águas (dá para andar em cima).
    // Casa aberta (ferraria) não é um bloco: só o piso, o muro do fundo, os muretas, a forja e o telhado lá no alto.
    // Peça com "base" fica suspensa: só conta como chão para quem está perto dela (debaixo dela é teto, dá para passar).
    this.casas = [];
    this.postes = []; // círculos sólidos (esteio, bigorna...): entram nos obstáculos da simulação
    for (const c of mapa.vila?.casas || []) {
      const sobe = (c.d / 2) * TELHADO.inclinacao, Y0 = c.aberta ? 0.22 : 0.42, Y1 = Y0 + c.h;
      const y1 = Y1 + TELHADO.esp / Math.cos(Math.atan2(sobe, c.d / 2));
      const cos = Math.cos(c.ry), sen = Math.sin(c.ry);
      // peça retangular no espaço da casa: centro (lx, lz), meia largura/fundo, altura do topo, quanto o telhado sobe, base
      const peca = (lx, lz, hw, hd, topo, s = 0, base = 0) => ({ casa: true, x: c.x + lx * cos + lz * sen, z: c.z - lx * sen + lz * cos, cos, sen,
        hw, hd, sobe: s, y1: topo, base, R: Math.hypot(hw, hd) });
      if (!c.aberta) { this.casas.push(peca(0, 0, c.w / 2, c.d / 2, y1, sobe)); continue; }
      const { w, d } = c, fx = -w / 2 + 1.0;
      this.casas.push(
        peca(0, 0, w / 2, d / 2, y1, sobe, Y1 - 0.1), // telhado (suspenso)
        peca(0, 0, w / 2 + 0.15, d / 2 + 0.15, Y0), // piso de pedra
        peca(0, -d / 2 + 0.225, w / 2 - 0.1, 0.225, y1), // muro do fundo, até o beiral (por fora se escala até o telhado)
        ...[-1, 1].map((s) => peca(s * (w / 2 - 0.22), -d * 0.2, 0.175, d * 0.25, Y0 + 1.05)), // muretas dos lados
        peca(fx, -d / 2 + 0.95, 0.7, 0.55, Y0 + 0.85), // forja
        peca(fx, -d / 2 + 0.41, 0.4, 0.41, (Y1 + sobe) + 1.1), // chaminé (atravessa o telhado; rente ao muro do fundo, por fora sobe direto até o alto dela)
      );
      // esteios de madeira (cantos e meio da frente), bigorna e tina: só um círculo que não deixa passar (não se escala)
      // (alto: acima disso não bate, quem anda no telhado passa por cima)
      const cantos = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => [a * (w / 2 - 0.12), b * (d / 2 - 0.12), 0.13, Y1]);
      for (const [lx, lz, r, alto] of [...cantos, [0, d / 2 - 0.12, 0.13, Y1], [0.55, 0.15, 0.32, Y0 + 0.84], [w / 2 - 0.75, -d / 2 + 0.85, 0.3, Y0 + 0.6]])
        this.postes.push({ x: c.x + lx * cos + lz * sen, z: c.z - lx * sen + lz * cos, r, alto });
    }
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
  // y = altura dos pés de quem pergunta: peça suspensa bem acima dele não conta (ele passa por baixo)
  alturaNa(r, x, z, y = Infinity) {
    if (r.base > y + ACIMA) return -1;
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
  altura(x, z, y) {
    let h = 0;
    for (const r of this.solidos) { const a = this.alturaNa(r, x, z, y); if (a > h) h = a; }
    return h;
  }
  // teto: a parte de baixo da peça suspensa mais baixa acima de quem está em (x, y, z) (Infinity se céu aberto)
  teto(x, z, y) {
    let t = Infinity;
    for (const r of this.casas) if (r.base > y + ACIMA && r.base < t && this.alturaCasa(r, x, z) >= 0) t = r.base;
    return t;
  }
  // qual rocha está mais alta naquele ponto
  rochaEm(x, z, y) {
    let melhor = null, h = 0.05;
    for (const r of this.solidos) { const a = this.alturaNa(r, x, z, y); if (a > h) { h = a; melhor = r; } }
    return melhor;
  }
  // O que tem à frente (direção ry): a maior altura até "ate" metros e a distância até a pedra passar de "acima"
  frente(x, z, ry, ate, acima, y) {
    const fx = Math.sin(ry), fz = Math.cos(ry);
    let topo = 0, dist = -1;
    for (let d = 0.1; d <= ate; d += 0.1) {
      const h = this.altura(x + fx * d, z + fz * d, y);
      if (h > topo) topo = h;
      if (dist < 0 && acima != null && h > acima) dist = d;
    }
    return { topo, dist };
  }
}

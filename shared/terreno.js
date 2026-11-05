// Chão com pedras: a altura em cada ponto vem da forma real dos modelos (grade em shared/rochas.js).
// O herói não atravessa pedra: degrau baixo ele sobe andando, mais alto ele escala.
import { GRADES } from './rochas.js';
import { chaoDoRelevo } from './relevo.js';

// Telhado das casas da vila (o cliente desenha com os mesmos números em client/src/vila.js)
export const TELHADO = { inclinacao: 0.82, esp: 0.3, beiral: 0.5, pontas: 0.38 };
const ACIMA = 0.5; // peça suspensa vira chão quando a base dela está até isso acima dos pés

// telhado das casas do jogador: quadrados de 2 m juntos; a altura sobe com a distância até a borda de fora (quatro águas
// que se ajeitam a qualquer formato), com beiral. c = { cel: [[x, z]], seg: [[ax, az, bx, bz]], g (meio quadrado), base,
// beiral, inclina, max, x0, z0, x1, z1 }. A mesma conta no godot-prototipo/construcao.gd (_malha_telhado) e terreno.gd.
export function alturaTelhado(c, x, z) {
  if (x < c.x0 || x > c.x1 || z < c.z0 || z > c.z1) return -1;
  if (c.rampa) return alturaRampa(c, x, z);
  let d = Infinity;
  for (const [ax, az, bx, bz] of c.seg) {
    const vx = bx - ax, vz = bz - az, t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / (vx * vx + vz * vz)));
    d = Math.min(d, Math.hypot(x - ax - vx * t, z - az - vz * t));
  }
  let dentro = false;
  for (const [cx, cz] of c.cel) if (Math.abs(x - cx) <= c.g + 0.001 && Math.abs(z - cz) <= c.g + 0.001) { dentro = true; break; }
  if (!dentro) { if (d > c.beiral) return -1; d = -d; }
  return c.base + 0.2 + c.inclina * Math.min(d, c.max / c.inclina);
}

// Telhado em rampa (André 2026-11-05, o esquema do Quimera): cada quadrado de telhado tem uma direção (r, botão Girar)
// e sobe `sobe` m por quadrado seguido na mesma direção: o primeiro mais baixo, o seguinte mais alto. Quando a rampa
// encontra outra virada para ela, as duas fecham numa ponta no meio do vão (sempre triângulo, nunca reto em cima).
// cel = [[x, z, r]], passo = tamanho do quadrado. Devolve [{ x, z, r, dx, dz, h0, h1, hm, plano, atras, frente, esq, dir }]
// (h0 = altura na beira de baixo, hm = no meio, h1 = na de cima, a partir da base; atras/frente/esq/dir = tem telhado vizinho ali).
// A mesma conta no app: godot-prototipo/terreno.gd rampas_telhado.
export const DIR_TELHADO = [[0, 1], [1, 0], [0, -1], [-1, 0]];
export function rampasTelhado(cel, passo, sobe) {
  const k = (x, z) => Math.round(x * 100) + ',' + Math.round(z * 100);
  const mapa = new Map(cel.map(([x, z, r]) => [k(x, z), r & 3]));
  const seguidos = (x, z, r) => {
    const [dx, dz] = DIR_TELHADO[r];
    let n = 0;
    for (let i = 1; i < 40; i++) { if (mapa.get(k(x - dx * passo * i, z - dz * passo * i)) === r) n++; else break; }
    return n;
  };
  return cel.map(([x, z, r0]) => {
    const r = r0 & 3, [dx, dz] = DIR_TELHADO[r], n = seguidos(x, z, r);
    let h0 = n * sobe, h1 = h0 + sobe, hm = h0 + sobe / 2;
    const rf = mapa.get(k(x + dx * passo, z + dz * passo));
    // Sempre pontudo (André 2026-11-05: "queria q ficasse sempre em triângulo"): quando a rampa encontra outra virada
    // para ela, as duas viram um telhado de duas águas só, com a ponta no meio do vão inteiro (mesma inclinação).
    // Vão com número ímpar de quadrados: a ponta fica no meio do quadrado do meio (hm), nunca mais reto em cima.
    let f = 0;
    while (f < 40 && mapa.get(k(x + dx * passo * (f + 1), z + dz * passo * (f + 1))) === r) f++;
    const xo = x + dx * passo * (f + 1), zo = z + dz * passo * (f + 1), ro = mapa.get(k(xo, zo));
    if (ro === ((r + 2) & 3)) {
      const S = (n + 1 + f + 1 + seguidos(xo, zo, ro)) * passo, i = sobe / passo; // vão todo (m) e quanto sobe por metro
      const alt = (t) => i * Math.min(t, S - t), t0 = n * passo;
      h0 = alt(t0); h1 = alt(t0 + passo); hm = Math.abs(t0 + passo / 2 - S / 2) < passo / 2 - 1e-6 ? i * S / 2 : (h0 + h1) / 2;
    }
    const plano = Math.abs(h1 - h0) < 0.01 && Math.abs(hm - h0) < 0.01;
    return { x, z, r, dx, dz, h0, h1, hm, plano, atras: mapa.has(k(x - dx * passo, z - dz * passo)), frente: rf !== undefined,
      esq: mapa.has(k(x - dz * passo, z + dx * passo)), dir: mapa.has(k(x + dz * passo, z - dx * passo)) };
  });
}
// altura da rampa a u metros do meio do quadrado (h0 na beira de baixo, hm no meio, h1 na de cima; beiral segue a reta)
export const alturaNaRampa = (q, u, g) => (u < 0 ? q.h0 + (q.hm - q.h0) * (u + g) / g : q.hm + (q.h1 - q.hm) * Math.min(u, g) / g);
// altura do telhado em rampa num ponto (-1 = fora). Beiral para fora onde não tem vizinho (na beira de cima, menor).
function alturaRampa(c, x, z) {
  let h = -1;
  const g = c.g, b = c.beiral;
  for (const q of c.rampa) {
    const ox = x - q.x, oz = z - q.z, u = ox * q.dx + oz * q.dz, v = ox * q.dz - oz * q.dx; // u: subindo, v: de lado (+ = dir)
    if (u < -g - (q.atras ? 0 : b) - 1e-3 || u > g + (q.frente ? 0 : b * 0.6) + 1e-3) continue;
    if (v > g + (q.dir ? 0 : b) + 1e-3 || v < -g - (q.esq ? 0 : b) - 1e-3) continue;
    const a = c.base + 0.2 + alturaNaRampa(q, u, g);
    if (a > h) h = a;
  }
  return h;
}

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
    this.doJogador = []; // casas que os jogadores constroem nos terrenos (pecasCasaSolidas): mudam com o jogo
    this.tampos = new Map(); // topo dos obstáculos baixos (porTampos): grade de 6 m
  }
  // Obstáculos baixos com tampo (André 2026-11-05: "pular sobre as mesas de craft"): bancada, bigorna, baú, mesa da Rosa,
  // tronco caído, pedra pequena... Um círculo { x, z, r, alto } vira chão na altura alto: o herói pula e fica em cima.
  // Só conta quem tem alto entre SUBIDA.tampoMin e tampoMax (fogueira e esteio não). Mesma conta no app (terreno.gd).
  porTampos(l, min, max) {
    this.tampos = new Map();
    for (const k of l) {
      if (k.alto == null || k.semTopo || k.alto < min || k.alto > max) continue;
      for (let i = Math.floor((k.x - k.r) / 6); i <= Math.floor((k.x + k.r) / 6); i++) {
        for (let j = Math.floor((k.z - k.r) / 6); j <= Math.floor((k.z + k.r) / 6); j++) {
          const c = i * 10007 + j;
          if (!this.tampos.has(c)) this.tampos.set(c, []);
          this.tampos.get(c).push(k);
        }
      }
    }
  }
  tampoEm(x, z) {
    let h = -Infinity;
    for (const k of this.tampos.get(Math.floor(x / 6) * 10007 + Math.floor(z / 6)) || []) {
      const dx = x - k.x, dz = z - k.z;
      if (k.alto > h && dx * dx + dz * dz <= k.r * k.r) h = k.alto;
    }
    return h;
  }
  // troca as peças sólidas das casas dos jogadores (fundação vira chão, parede se escala, telhado se anda em cima)
  porCasasDosJogadores(l) {
    this.doJogador = l;
    this.solidos = [...this.rochas, ...this.casas, ...l];
  }
  // altura do telhado de uma casa num ponto (ou -1 se fora dela)
  alturaCasa(c, x, z) {
    if (c.cel) return alturaTelhado(c, x, z);
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
  // altura do chão (0, ou o relevo: montanha e lagos, shared/relevo.js) ou da pedra (ou telhado) mais alto naquele ponto
  altura(x, z, y) {
    let h = chaoDoRelevo(x, z);
    for (const r of this.solidos) { const a = this.alturaNa(r, x, z, y); if (a > h && a >= 0) h = a; } // -1 = fora da peça (no lago o chão fica abaixo de -1)
    if (this.tampos.size) h = Math.max(h, this.tampoEm(x, z));
    return h;
  }
  // teto: a parte de baixo da peça suspensa mais baixa acima de quem está em (x, y, z) (Infinity se céu aberto)
  teto(x, z, y) {
    let t = Infinity;
    for (const r of this.casas) if (r.base > y + ACIMA && r.base < t && this.alturaCasa(r, x, z) >= 0) t = r.base;
    for (const r of this.doJogador) if (r.base > y + ACIMA && r.base < t && this.alturaCasa(r, x, z) >= 0) t = r.base;
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

// Primeira dungeon (pedido do André 2026-11-06): uma caverna que entra na montanha grande, perto da vila.
// "Eu queria que a dungeon não fosse uma recarrega... que a passagem fosse suave, como se ela fosse uma extensão do mapa."
//
// Como funciona sem tela de carregamento: a caverna é um túnel de verdade no mesmo mundo, por baixo da montanha
// (shared/relevo.js). O túnel é uma linha (CAVERNA.linha) com largura, altura do teto e altura do chão em cada ponto.
// Dentro do túnel (e abaixo do teto dele) o chão é o da caverna; fora dele, a montanha de sempre. Por isso as paredes
// saem de graça: um passo para fora do túnel bate na rocha da montanha (alta demais para subir).
// Servidor (shared/terreno.js altura), site e Godot (godot-prototipo/terreno.gd) fazem a mesma conta; o Godot recebe as
// amostras prontas pelo mundo.json e desenha a caverna aos poucos quando o herói chega perto (godot-prototipo/caverna.gd).
//
// O conteúdo da dungeon (NPC do passe, passe, monstros de cada sala) fica em shared/dados.js (CAVERNA_DUNGEON).

// pontos do meio do túnel (x, z), de fora para dentro. l = meia largura andável (m), teto = altura do teto acima do chão.
// Entra pelo pé do paredão sudoeste (onde a encosta fica íngreme de repente) e vai para nordeste, por baixo do maciço.
export const CAVERNA = {
  id: 'caverna_montanha',
  nome: 'Caverna da Montanha',
  linha: [
    [148.75, -27.3], [153.4, -30.4], [158.6, -33.6], [164, -37], [170, -41.5], [175.5, -46.5],
    [180, -52], [185.5, -58], [191, -63.5], [195.5, -69.5], [199.5, -76.5], [201, -80],
  ],
  // salas (alargamentos do túnel): s = metros pelo túnel a partir do primeiro ponto; r = meio comprimento da sala
  salas: [
    { id: 'sala1', s: 26.5, r: 7, l: 6, teto: 6.6 },
    { id: 'sala2', s: 46.5, r: 6, l: 6.5, teto: 7 },
    { id: 'sala3', s: 68, r: 4.5, l: 7.5, teto: 8.4 }, // a do chefe, no fim
  ],
  corredor: { l: 2.1, teto: 4.2 }, // meia largura e teto do túnel entre as salas
  boca: { l: 2.6, teto: 4.6 }, // a boca é um pouco maior que o corredor
  porta: 5.5, // s da porta (portão com o selo): dali para dentro só com o passe
  // o chão: na boca (s = 0, pé do paredão) é a própria encosta, inclinada de lado como ela (incl some em 4 m); depois
  // desce devagar até o fundo. A rocha por cima da boca é BOCA_CAVERNA (shared/relevo.js).
  chao: { fundo: 1.6 },
  passo: 1, // metros entre amostras
  folga: 0.35, // a parede fica isso além da beira andável (o corpo não entra na rocha)
};

const suave = (a, b, t) => { const u = Math.max(0, Math.min(1, (t - a) / (b - a))); return u * u * (3 - 2 * u); };

// curva suave (Catmull-Rom) pela linha, amostrada a cada CAVERNA.passo metros pelo comprimento
function amostrar(alturaDoMonte) {
  const P = CAVERNA.linha, fino = [];
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < 20; k++) {
      const t = k / 20, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      fino.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  fino.push(P[P.length - 1]);
  const acum = [0];
  for (let i = 1; i < fino.length; i++) acum.push(acum[i - 1] + Math.hypot(fino[i][0] - fino[i - 1][0], fino[i][1] - fino[i - 1][1]));
  const total = acum[acum.length - 1], n = Math.floor(total / CAVERNA.passo) + 1, out = [];
  let j = 0;
  // chão na boca = a encosta ali (no meio), e quanto ela pende para o lado (incl: metros por metro, + sobe à esquerda)
  const d0 = Math.hypot(P[1][0] - P[0][0], P[1][1] - P[0][1]), ex = -(P[1][1] - P[0][1]) / d0, ez = (P[1][0] - P[0][0]) / d0;
  const y0 = alturaDoMonte(P[0][0], P[0][1]);
  const incl0 = (alturaDoMonte(P[0][0] + ex * 2.4, P[0][1] + ez * 2.4) - alturaDoMonte(P[0][0] - ex * 2.4, P[0][1] - ez * 2.4)) / 4.8;
  for (let k = 0; k < n; k++) {
    const s = k * CAVERNA.passo;
    while (j < acum.length - 2 && acum[j + 1] < s) j++;
    const u = (s - acum[j]) / ((acum[j + 1] - acum[j]) || 1);
    const x = fino[j][0] + (fino[j + 1][0] - fino[j][0]) * u, z = fino[j][1] + (fino[j + 1][1] - fino[j][1]) * u;
    // largura e teto: corredor, boca no começo e as salas (sobe e desce suave, sem degrau)
    let l = CAVERNA.corredor.l, teto = CAVERNA.corredor.teto;
    const b = 1 - suave(0, 3, s);
    l += (CAVERNA.boca.l - l) * b; teto += (CAVERNA.boca.teto - teto) * b;
    for (const S of CAVERNA.salas) {
      const k2 = 1 - suave(S.r, S.r + 5, Math.abs(s - S.s));
      l = Math.max(l, CAVERNA.corredor.l + (S.l - CAVERNA.corredor.l) * k2);
      teto = Math.max(teto, CAVERNA.corredor.teto + (S.teto - CAVERNA.corredor.teto) * k2);
    }
    // chão: na boca acompanha a encosta (sem degrau na entrada); depois desce até o fundo
    const desce = suave(3, total, s), y = y0 + (CAVERNA.chao.fundo - y0) * desce;
    out.push({ s, x, z, y, l, teto, incl: +(incl0 * (1 - suave(0, 4, s))).toFixed(4) });
  }
  // direção (tangente) de cada amostra
  for (let k = 0; k < out.length; k++) {
    const a = out[Math.max(0, k - 1)], c = out[Math.min(out.length - 1, k + 1)], d = Math.hypot(c.x - a.x, c.z - a.z) || 1;
    out[k].dx = (c.x - a.x) / d; out[k].dz = (c.z - a.z) / d;
  }
  return out;
}

// Monta as amostras e a grade de busca (4 m). alturaDoMonte(x, z) = a montanha (shared/relevo.js alturaMontanha).
export function montarCaverna(alturaDoMonte) {
  const A = amostrar(alturaDoMonte), G = 4, grade = new Map();
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (let k = 0; k < A.length - 1; k++) {
    const a = A[k], b = A[k + 1], m = Math.max(a.l, b.l) + CAVERNA.folga + 1;
    const ax = Math.min(a.x, b.x) - m, bx = Math.max(a.x, b.x) + m, az = Math.min(a.z, b.z) - m, bz = Math.max(a.z, b.z) + m;
    x0 = Math.min(x0, ax); z0 = Math.min(z0, az); x1 = Math.max(x1, bx); z1 = Math.max(z1, bz);
    for (let i = Math.floor(ax / G); i <= Math.floor(bx / G); i++) for (let j = Math.floor(az / G); j <= Math.floor(bz / G); j++) {
      const key = i * 10007 + j; if (!grade.has(key)) grade.set(key, []); grade.get(key).push(k);
    }
  }
  return { amostras: A, grade, G, caixa: [x0, z0, x1, z1], total: A[A.length - 1].s };
}

// Onde (x, z) cai no túnel: { s, y (chão), l, teto, lado (distância ao meio, com sinal), d } do trecho mais perto que
// cobre o ponto, ou null fora da caverna. extra = metros além da beira andável (0 = só onde se anda).
export function noTunel(C, x, z, extra = 0) {
  if (x < C.caixa[0] || x > C.caixa[2] || z < C.caixa[1] || z > C.caixa[3]) return null;
  const l = C.grade.get(Math.floor(x / C.G) * 10007 + Math.floor(z / C.G)); if (!l) return null;
  const A = C.amostras;
  let melhor = null, md = Infinity;
  for (const k of l) {
    const a = A[k], b = A[k + 1], vx = b.x - a.x, vz = b.z - a.z, l2 = vx * vx + vz * vz || 1;
    const t = Math.max(0, Math.min(1, ((x - a.x) * vx + (z - a.z) * vz) / l2));
    const px = a.x + vx * t, pz = a.z + vz * t, d = Math.hypot(x - px, z - pz);
    if (d < md) { md = d; melhor = { k, t, px, pz, d }; }
  }
  if (!melhor) return null;
  const a = A[melhor.k], b = A[melhor.k + 1], t = melhor.t, lm = a.l + (b.l - a.l) * t;
  // pontas do túnel: antes da primeira amostra e depois da última não tem caverna (o fundo é parede)
  if (melhor.d > lm + extra) return null;
  if ((melhor.k === 0 && t <= 0) || (melhor.k === A.length - 2 && t >= 1)) {
    const fim = melhor.k === 0 ? a : b, ux = (x - fim.x), uz = (z - fim.z);
    if (melhor.k === 0 ? ux * fim.dx + uz * fim.dz < 0 : ux * fim.dx + uz * fim.dz > 0) return null;
  }
  const lado = (x - melhor.px) * -(b.z - a.z) + (z - melhor.pz) * (b.x - a.x); // + à esquerda
  const ld = Math.sign(lado) * melhor.d, incl = a.incl + (b.incl - a.incl) * t;
  return { s: a.s + (b.s - a.s) * t, y: a.y + (b.y - a.y) * t + incl * ld, l: lm, teto: a.teto + (b.teto - a.teto) * t, d: melhor.d, lado: ld };
}

// Chão da caverna em (x, z) para quem está na altura y (pés), ou null: fora do túnel, ou bem acima do teto dele (quem
// anda por cima, na encosta da montanha, continua lá em cima). y = Infinity (sem altura) = de fora.
export function chaoDaCaverna(C, x, z, y = Infinity) {
  const c = noTunel(C, x, z); if (!c) return null;
  if (!(y < c.y + c.teto - 0.2)) return null;
  return c.y;
}
// (x, z, y) está dentro da caverna (no túnel e abaixo do teto)? Com s maior que CAVERNA.porta = passou da porta.
export function dentroDaCaverna(C, x, z, y) {
  const c = noTunel(C, x, z); if (!c || !(y < c.y + c.teto - 0.2)) return null;
  return c;
}

import { alturaMontanha } from './relevo.js';
// o túnel de verdade (amostras e grade), igual no servidor, no site e no mundo.json do Godot
export const TUNEL = montarCaverna(alturaMontanha);
// ponto do túnel a "s" metros da entrada, "lado" metros para a esquerda (+) ou direita (-) do meio, com o chão ali
export function pontoDoTunel(s, lado = 0) {
  const A = TUNEL.amostras, k = Math.max(0, Math.min(A.length - 2, Math.floor(s / CAVERNA.passo))), a = A[k], b = A[k + 1];
  const t = Math.max(0, Math.min(1, (s - a.s) / (b.s - a.s || 1)));
  const x = a.x + (b.x - a.x) * t, z = a.z + (b.z - a.z) * t, dx = a.dx + (b.dx - a.dx) * t, dz = a.dz + (b.dz - a.dz) * t, d = Math.hypot(dx, dz) || 1;
  return { x: x - (dz / d) * lado, z: z + (dx / d) * lado, y: a.y + (b.y - a.y) * t + (a.incl + (b.incl - a.incl) * t) * lado, dx: dx / d, dz: dz / d, l: a.l + (b.l - a.l) * t };
}

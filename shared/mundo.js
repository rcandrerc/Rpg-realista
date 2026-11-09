// FASE 3 (André 2026-11-08): o mundo cresce umas 4 vezes. Dois continentes grandes separados por um mar central, com
// uma ilha média no meio. O mapa de hoje (a Vila da Clareira, a mata, a montanha, os lagos e os campos Nv 1-30) fica
// inteiro, do jeito que está, no sudoeste do Continente de Vael (o primeiro); em volta dele o chão novo sobe aos poucos.
//
// Esta é a Parte 2: só a grade de alturas do mundo (sorteio fixo, igual no servidor e no app). Quem desenha e quem anda
// ainda usam o mapa de hoje; as próximas partes ligam o chão por pedaços, estradas, rios e os campos novos.
//
// Alturas em metros; o nível do mar é o mesmo da água dos lagos (AGUA.nivel, quase 0). Dentro do mapa de hoje a grade
// vale 0 (o relevo de lá continua vindo de shared/relevo.js, somado por cima).
import { dentroDoMapa } from './mapa.js';

// Continentes e ilha: elipses com borda ondulada (lobos como as áreas do mapa: [k, amplitude, fase]).
// Vael (o de hoje, Nv 1-50) a oeste, a Ilha do Meio (Nv 50-65) no mar central e Aurora (Nv 60-100) a leste.
export const TERRAS = [
  { id: 'vael', nome: 'Continente de Vael', x: 110, z: 50, rx: 290, rz: 330, lobos: [[3, 0.07, 0.4], [5, 0.05, 2.1], [9, 0.025, 1.0]], niveis: [1, 50] },
  { id: 'ilha', nome: 'Ilha do Meio', x: 565, z: 40, rx: 82, rz: 74, lobos: [[3, 0.08, 1.7], [7, 0.04, 0.3]], niveis: [50, 65] },
  { id: 'aurora', nome: 'Continente de Aurora', x: 905, z: 50, rx: 195, rz: 225, lobos: [[3, 0.07, 2.8], [5, 0.05, 0.9], [8, 0.03, 4.0]], niveis: [60, 100] },
];
// a grade cobre o mundo todo com o mar em volta
export const MUNDO = { x0: -260, z0: -320, w: 1440, h: 740, passo: 4, mar: -0.05, fundoMar: -7, praia: 26, morros: 16, transicao: 40 };

// ruído de valor suave com tabela fixa (mesmo jeito da montanha em relevo.js)
function ruido(semente) {
  let sem = semente; const rnd = () => { sem = (sem * 16807) % 2147483647; return sem / 2147483647; };
  const P = new Float32Array(256 * 256); for (let i = 0; i < P.length; i++) P[i] = rnd();
  const val = (x, z) => {
    const ix = Math.floor(x), iz = Math.floor(z), fx = x - ix, fz = z - iz, ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
    const g = (a, b) => P[((iz + b) & 255) * 256 + ((ix + a) & 255)];
    return (g(0, 0) * (1 - ux) + g(1, 0) * ux) * (1 - uz) + (g(0, 1) * (1 - ux) + g(1, 1) * ux) * uz;
  };
  return (x, z, o = 4) => { let s = 0, a = 0.5, f = 1, t = 0; for (let i = 0; i < o; i++) { s += a * val(x * f, z * f); t += a; a *= 0.5; f *= 2.03; } return s / t; };
}

// quanto (x, z) está para dentro da terra T, em metros (negativo = no mar), contando a borda ondulada
export function dentroDaTerra(T, x, z) {
  const dx = x - T.x, dz = z - T.z, ang = Math.atan2(dz, dx);
  let k = 1; for (const [n, amp, fase] of T.lobos) k *= 1 + amp * Math.sin(n * ang + fase);
  const e = Math.hypot(dx / T.rx, dz / T.rz); // 1 = na borda da elipse
  return (1 - e / k) * Math.min(T.rx, T.rz);
}

// Monta a grade. mapaHoje = o MAPA_CLAREIRA (áreas e corredores andáveis de hoje): ali a grade fica 0.
export function montarMundo(mapaHoje) {
  const M = MUNDO, nx = Math.round(M.w / M.passo) + 1, nz = Math.round(M.h / M.passo) + 1;
  const h = new Float32Array(nx * nz), terra = new Uint8Array(nx * nz);
  const fbm = ruido(424242), fbm2 = ruido(171717), costa = ruido(9091);
  // distância (m) até o mapa de hoje: 0 dentro dele; espalha pela grade (chanfro 3-4)
  const INF = 1e9, dist = new Float32Array(nx * nz).fill(INF);
  // só as áreas e corredores de hoje (sem a terra do mundo) e só dentro da caixa deles (rápido)
  const hoje = mapaHoje ? { areas: mapaHoje.areas, corredores: mapaHoje.corredores, raio: mapaHoje.raio } : null;
  let cx0 = Infinity, cx1 = -Infinity, cz0 = Infinity, cz1 = -Infinity;
  for (const a of hoje?.areas || []) { const r = Math.max(a.r || 0, a.rx || 0, a.rz || 0) * 1.3 + 14; cx0 = Math.min(cx0, a.x - r); cx1 = Math.max(cx1, a.x + r); cz0 = Math.min(cz0, a.z - r); cz1 = Math.max(cz1, a.z + r); }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = M.x0 + i * M.passo, z = M.z0 + j * M.passo;
    if (hoje && x >= cx0 && x <= cx1 && z >= cz0 && z <= cz1 && dentroDoMapa(hoje, x, z, -12)) dist[j * nx + i] = 0; // 12 m a mais: a mata fechada da borda
  }
  const p = M.passo, d2 = p * Math.SQRT2;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i; let v = dist[k];
    if (i > 0) v = Math.min(v, dist[k - 1] + p); if (j > 0) v = Math.min(v, dist[k - nx] + p);
    if (i > 0 && j > 0) v = Math.min(v, dist[k - nx - 1] + d2); if (i < nx - 1 && j > 0) v = Math.min(v, dist[k - nx + 1] + d2);
    dist[k] = v;
  }
  for (let j = nz - 1; j >= 0; j--) for (let i = nx - 1; i >= 0; i--) {
    const k = j * nx + i; let v = dist[k];
    if (i < nx - 1) v = Math.min(v, dist[k + 1] + p); if (j < nz - 1) v = Math.min(v, dist[k + nx] + p);
    if (i < nx - 1 && j < nz - 1) v = Math.min(v, dist[k + nx + 1] + d2); if (i > 0 && j < nz - 1) v = Math.min(v, dist[k + nx - 1] + d2);
    dist[k] = v;
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const k = j * nx + i, x = M.x0 + i * M.passo, z = M.z0 + j * M.passo;
    // quanto para dentro da terra mais perto (com a costa um pouco irregular)
    let s = -Infinity, qual = 0;
    TERRAS.forEach((T, t) => { const v = dentroDaTerra(T, x, z) + (costa(x / 38, z / 38, 3) - 0.5) * 18; if (v > s) { s = v; qual = t + 1; } });
    if (dist[k] < M.transicao) s = Math.max(s, M.praia * 2); // o mapa de hoje e a volta dele nunca viram mar
    if (s <= 0) { h[k] = Math.max(M.fundoMar, M.mar - 1 + s * 0.2); continue; }
    terra[k] = qual;
    const praia = Math.min(1, s / M.praia); // de 0 na água a 1 depois da praia
    // morros: ruído suave; onde o "montanhoso" é alto, viram serras (Parte 4 abre as estradas com subida suave)
    const serra = Math.max(0, fbm2(x / 260, z / 260, 2) - 0.48) * 3.2;
    let alto = 1.5 + (fbm(x / 110, z / 110, 5) - 0.35) * M.morros * (1 + serra * 4);
    alto = Math.max(0.6, alto);
    let v = M.mar + 0.25 + praia * praia * (3 - 2 * praia) * alto;
    // perto do mapa de hoje o chão novo desce até 0 (fica no mesmo plano da mata que já existe)
    const tr = Math.min(1, dist[k] / M.transicao), sm = tr * tr * (3 - 2 * tr);
    h[k] = dist[k] === 0 ? 0 : v * sm;
  }
  const G = { x0: M.x0, z0: M.z0, passo: M.passo, nx, nz, h, terra, estrada: new Uint8Array(nx * nz) };
  lugaresDeMina(G);
  aplainarLugares(G, dist);
  abrirEstradas(G, dist);
  return G;
}

// ---------- Parte 4: lugares planos e estradas de subida suave ----------
// Lugares do mundo novo (André 2026-11-08): campos de caça (Parte 5) e vilas e portos (Partes 6 e 7) ficam em chão
// estritamente plano. Cada um é um disco de raio r aplainado na altura média dele, com uma rampa de "rampa" m em volta.
// Vael (anel em volta do mapa de hoje): Nv 30-50 e o Porto de Vael (mini vila Nv 50) na costa leste. Ilha do Meio: Nv
// 50-65 e um porto de cada lado. Aurora: Nv 60-100, o porto oeste e a vila grande Nv 100 no meio (bairros, Parte 7).
export const LUGARES_MUNDO = [
  { id: 'c_v1', tipo: 'caca', terra: 'vael', nivel: 32, x: -135, z: -15, r: 14 },
  { id: 'c_v2', tipo: 'caca', terra: 'vael', nivel: 35, x: -138, z: 130, r: 14 },
  { id: 'c_v3', tipo: 'caca', terra: 'vael', nivel: 38, x: -50, z: 300, r: 14 },
  { id: 'c_v4', tipo: 'caca', terra: 'vael', nivel: 42, x: 120, z: 320, r: 14 },
  { id: 'c_v5', tipo: 'caca', terra: 'vael', nivel: 45, x: 290, z: 250, r: 14 },
  { id: 'c_v6', tipo: 'caca', terra: 'vael', nivel: 48, x: 300, z: -112, r: 14 },
  { id: 'c_v7', tipo: 'caca', terra: 'vael', nivel: 40, x: 90, z: -220, r: 14 },
  { id: 'vila_vael', tipo: 'vila', terra: 'vael', nivel: 50, nome: 'Porto de Vael', x: 350, z: 45, r: 35 },
  { id: 'porto_vael', tipo: 'porto', terra: 'vael', nome: 'Cais de Vael', x: 402, z: 45, r: 9 },
  { id: 'porto_ilha_o', tipo: 'porto', terra: 'ilha', nome: 'Cais Oeste da Ilha', x: 505, z: 40, r: 9 },
  { id: 'porto_ilha_l', tipo: 'porto', terra: 'ilha', nome: 'Cais Leste da Ilha', x: 628, z: 40, r: 9 },
  { id: 'c_i1', tipo: 'caca', terra: 'ilha', nivel: 52, x: 540, z: 10, r: 11 },
  { id: 'c_i2', tipo: 'caca', terra: 'ilha', nivel: 56, x: 590, z: 72, r: 11 },
  { id: 'c_i3', tipo: 'caca', terra: 'ilha', nivel: 60, x: 592, z: 5, r: 11 },
  { id: 'c_i4', tipo: 'caca', terra: 'ilha', nivel: 64, x: 535, z: 72, r: 11 },
  { id: 'porto_aurora', tipo: 'porto', terra: 'aurora', nome: 'Cais de Aurora', x: 736, z: 50, r: 9 },
  { id: 'vila_aurora', tipo: 'vila', terra: 'aurora', nivel: 100, nome: 'Aurora', x: 905, z: 50, r: 70 },
  { id: 'c_a1', tipo: 'caca', terra: 'aurora', nivel: 66, x: 780, z: -40, r: 14 },
  { id: 'c_a2', tipo: 'caca', terra: 'aurora', nivel: 70, x: 790, z: 150, r: 14 },
  { id: 'c_a3', tipo: 'caca', terra: 'aurora', nivel: 74, x: 860, z: -120, r: 14 },
  { id: 'c_a4', tipo: 'caca', terra: 'aurora', nivel: 78, x: 870, z: 215, r: 14 },
  { id: 'c_a5', tipo: 'caca', terra: 'aurora', nivel: 82, x: 980, z: -110, r: 14 },
  { id: 'c_a6', tipo: 'caca', terra: 'aurora', nivel: 86, x: 990, z: 190, r: 14 },
  { id: 'c_a7', tipo: 'caca', terra: 'aurora', nivel: 90, x: 1060, z: 60, r: 14 },
  { id: 'c_a8', tipo: 'caca', terra: 'aurora', nivel: 95, x: 1040, z: -60, r: 14 },
  { id: 'c_a9', tipo: 'caca', terra: 'aurora', nivel: 100, x: 1040, z: 150, r: 15 },
  // postos de troca na beira da estrada (Parte 6: mercador de pack longe da vila)
  { id: 'posto_oeste', tipo: 'posto', terra: 'vael', nome: 'Posto do Oeste', x: -138, z: 60, r: 8 },
  { id: 'posto_leste', tipo: 'posto', terra: 'aurora', nome: 'Posto do Leste', x: 1012, z: 51, r: 8 },
];
// Estradas (largura 4 m, rampa máxima de 10%: o carrinho carregado sobe sem bugar). Em Vael saem do mapa de hoje
// (das trilhas que já existem) e dão a volta pelo anel até o Porto de Vael; na ilha e em Aurora ligam o cais aos campos
// e à vila. Os pontos são o caminho grosso: a estrada faz curvas suaves entre eles.
export const ESTRADAS_MUNDO = [
  { id: 'e_leste', pontos: [[214, 140], [262, 120], [300, 90], [335, 55], [402, 45]] },
  { id: 'e_norte', pontos: [[335, 55], [345, 0], [330, -70], [300, -112], [250, -190], [160, -225], [90, -220]] },
  { id: 'e_sul', pontos: [[262, 120], [290, 190], [290, 250], [210, 300], [120, 320], [30, 320], [-50, 300]] },
  { id: 'e_oeste', pontos: [[-50, 300], [-120, 250], [-138, 130], [-150, 60], [-135, -15], [-110, -100], [-30, -190], [90, -220]] },
  { id: 'e_ilha', pontos: [[505, 40], [540, 10], [592, 5], [628, 40], [590, 72], [535, 72], [540, 10]] },
  { id: 'e_aurora', pontos: [[736, 50], [790, 50], [835, 50], [905, 50], [975, 50], [1060, 60]] },
  { id: 'e_aurora_n', pontos: [[790, 50], [780, -40], [860, -120], [930, -110], [980, -110], [1040, -60], [1060, 60]] },
  { id: 'e_aurora_s', pontos: [[790, 50], [790, 150], [870, 215], [930, 205], [990, 190], [1040, 150], [1060, 60]] },
];
export const RAMPA_MAX = 0.1;
const LARG_ESTRADA = 4, OMBRO = 7;

// Parte 6 (André 2026-11-08: "pequenos spots de minério bem diluídos... o jogador não pode precisar atravessar o mundo
// para coletar um recurso básico"): perto de cada campo novo, um veio pequeno de pedra e um de cobre (a 20-40 m) e, em
// campo sim, campo não, um de ferro (Vael) ou de cristal (ilha e Aurora). Cada um é um lugar plano pequeno (tipo mina),
// em terra firme, longe do mar, das estradas e dos outros lugares. Sorteio fixo pela ordem dos campos.
const MINAS_FEITAS = { ok: false };
function lugaresDeMina(G) {
  if (MINAS_FEITAS.ok) return;
  MINAS_FEITAS.ok = true;
  const rotas = ESTRADAS_MUNDO.map((E) => curva(E.pontos));
  const livre = (x, z, r) => {
    if (!terraEm(G, x, z)) return false;
    for (let a = 0; a < 6.28; a += 0.5) for (const d of [0, r + 12, r + 22]) if (alturaMundo(G, x + Math.cos(a) * d, z + Math.sin(a) * d) < 0.3) return false;
    if (LUGARES_MUNDO.some((l) => Math.hypot(l.x - x, l.z - z) < l.r + r + 14)) return false;
    return !rotas.some((C) => C.some(([px, pz]) => Math.hypot(px - x, pz - z) < r + 9));
  };
  const campos = LUGARES_MUNDO.filter((l) => l.tipo === 'caca');
  campos.forEach((L, n) => {
    const tipos = ['pedra', 'cobre', ...(n % 2 ? [] : [L.terra === 'vael' ? 'ferro' : 'cristal'])];
    let k = 0;
    for (const tipo of tipos) {
      const r = tipo === 'pedra' ? 4.2 : 3.4;
      for (let t = 0; t < 120; t++, k++) {
        const a = (k * 2.399) % 6.283, d = L.r + 18 + (k % 8) * 6, x = +(L.x + Math.cos(a) * d).toFixed(1), z = +(L.z + Math.sin(a) * d).toFixed(1);
        if (!livre(x, z, r)) continue;
        LUGARES_MUNDO.push({ id: `m_${L.id}_${tipo}`, tipo: 'mina', minerio: tipo, terra: L.terra, perto: L.id, x, z, r });
        break;
      }
    }
  });
}

// altura de cada lugar: a média do chão dele (nunca na areia; o cais fica rente, a 0,8 m da água). Depois as alturas
// de lugares ligados pela mesma estrada se aproximam até a rampa entre eles caber nos 10% (morro alto vira platô
// mais baixo, sem paredão na estrada).
function alturasDosLugares(G) {
  for (const L of LUGARES_MUNDO) {
    let soma = 0, n = 0;
    for (let a = 0; a < 6.28; a += 0.5) for (const f of [0, 0.5, 1]) { soma += alturaMundo(G, L.x + Math.cos(a) * L.r * f, L.z + Math.sin(a) * L.r * f); n++; }
    L.y = L.tipo === 'porto' ? 0.8 : Math.max(1.6, soma / n);
  }
  const ligados = [];
  for (const E of ESTRADAS_MUNDO) {
    const C = curva(E.pontos); let d = 0, ant = null;
    C.forEach((p, i) => {
      if (i) d += Math.hypot(p[0] - C[i - 1][0], p[1] - C[i - 1][1]);
      const L = LUGARES_MUNDO.find((l) => Math.hypot(p[0] - l.x, p[1] - l.z) <= l.r);
      if (L && L !== ant?.L) { if (ant) ligados.push([ant.L, L, d - ant.d]); ant = { L, d }; } else if (L) ant.d = d;
    });
  }
  for (let r = 0; r < 60; r++) for (const [A, B, d] of ligados) {
    const max = RAMPA_MAX * 0.6 * d, dif = B.y - A.y;
    if (Math.abs(dif) <= max) continue;
    const corr = (Math.abs(dif) - max) / 2 * Math.sign(dif);
    if (A.tipo !== 'porto') A.y += corr; else B.y -= corr;
    if (B.tipo !== 'porto') B.y -= corr; else A.y += corr;
  }
  for (const L of LUGARES_MUNDO) L.y = +Math.max(L.tipo === 'porto' ? 0.8 : 1.6, L.y).toFixed(2);
}

function aplainarLugares(G, dist) {
  alturasDosLugares(G);
  const { nx, nz, h, passo } = G, RAMPA = 16;
  const alvo = new Map(); // quadrado -> [peso, altura] do lugar que mais manda nele
  for (const L of LUGARES_MUNDO) {
    const R = L.r + RAMPA;
    for (let j = Math.max(0, Math.floor((L.z - R - G.z0) / passo)); j <= Math.min(nz - 1, Math.ceil((L.z + R - G.z0) / passo)); j++)
      for (let i = Math.max(0, Math.floor((L.x - R - G.x0) / passo)); i <= Math.min(nx - 1, Math.ceil((L.x + R - G.x0) / passo)); i++) {
        const k = j * nx + i, d = Math.hypot(G.x0 + i * passo - L.x, G.z0 + j * passo - L.z);
        if (d > R || dist[k] === 0) continue;
        if (L.tipo === 'porto' && h[k] < 0) continue; // o cais não aterra o mar
        const nucleo = L.tipo === 'mina' ? 6 : 3; // o veio pequeno ganha mais chão plano em volta (as pedras ficam inteiras no plano)
        const t = Math.min(1, Math.max(0, (d - L.r - nucleo) / (RAMPA - nucleo))), w = 1 - t * t * (3 - 2 * t);
        if (!alvo.has(k) || alvo.get(k)[0] < w) alvo.set(k, [w, L.y]);
      }
  }
  for (const [k, [w, y]] of alvo) h[k] += (y - h[k]) * w;
}
// (x, z) no miolo plano de algum lugar (até r + 3 m)
const noLugar = (x, z, folga = 3) => LUGARES_MUNDO.find((l) => Math.hypot(x - l.x, z - l.z) <= l.r + folga);

// caminho suave (Catmull-Rom) pelos pontos, de 2 em 2 m
function curva(P) {
  const out = [];
  for (let s = 0; s < P.length - 1; s++) {
    const p0 = P[Math.max(0, s - 1)], p1 = P[s], p2 = P[s + 1], p3 = P[Math.min(P.length - 1, s + 2)];
    const n = Math.max(1, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2));
    for (let k = 0; k < n; k++) {
      const t = k / n, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(P[P.length - 1]);
  return out;
}

function abrirEstradas(G, dist) {
  const { nx, nz, h, passo } = G;
  for (const E of ESTRADAS_MUNDO) {
    const C = curva(E.pontos);
    // perfil: a altura do chão por baixo, com a rampa limitada (vai e volta) e alisada
    let y = C.map(([x, z]) => Math.max(0.9, alturaMundo(G, x, z)));
    // pontos presos: dentro de um lugar plano fica na altura dele; em cima de uma estrada já aberta (cruzamento), na dela;
    // no mapa de hoje, no chão dele
    const preso = C.map(([x, z]) => {
      const L = noLugar(x, z);
      if (L) return L.y;
      const i = Math.round((x - G.x0) / passo), j = Math.round((z - G.z0) / passo), k = j * nx + i;
      if (k >= 0 && k < h.length && (G.estrada[k] >= 6 || dist[k] === 0)) return h[k];
      return null;
    });
    preso.forEach((v, i) => { if (v != null) y[i] = v; });
    const ds = C.map((p, i) => (i ? Math.hypot(p[0] - C[i - 1][0], p[1] - C[i - 1][1]) : 0));
    const g = RAMPA_MAX * 0.85;
    for (let r = 0; r < 4; r++) {
      const s = y.slice(); for (let i = 1; i < y.length - 1; i++) if (preso[i] == null) y[i] = (s[i - 1] + 2 * s[i] + s[i + 1]) / 4;
      for (let i = 1; i < y.length; i++) if (preso[i] == null) y[i] = Math.min(Math.max(y[i], y[i - 1] - g * ds[i]), y[i - 1] + g * ds[i]);
      for (let i = y.length - 2; i >= 0; i--) if (preso[i] == null) y[i] = Math.min(Math.max(y[i], y[i + 1] - g * ds[i + 1]), y[i + 1] + g * ds[i + 1]);
    }
    E.curva = C.map((p, i) => [+p[0].toFixed(2), +p[1].toFixed(2), +y[i].toFixed(2)]);
    // cada quadrado da grade perto da estrada vai para a altura do ponto mais perto dela
    const R = LARG_ESTRADA / 2 + OMBRO, melhor = new Map();
    C.forEach(([x, z], c) => {
      for (let j = Math.max(0, Math.floor((z - R - G.z0) / passo)); j <= Math.min(nz - 1, Math.ceil((z + R - G.z0) / passo)); j++)
        for (let i = Math.max(0, Math.floor((x - R - G.x0) / passo)); i <= Math.min(nx - 1, Math.ceil((x + R - G.x0) / passo)); i++) {
          const k = j * nx + i, d = Math.hypot(G.x0 + i * passo - x, G.z0 + j * passo - z);
          if (d <= R && (!melhor.has(k) || melhor.get(k)[0] > d)) melhor.set(k, [d, y[c]]);
        }
    });
    const marcas = [];
    for (const [k, [d, yy]] of melhor) {
      const t = Math.min(1, Math.max(0, (d - LARG_ESTRADA / 2) / OMBRO)), w = 1 - t * t * (3 - 2 * t);
      const cx = G.x0 + (k % nx) * passo, cz = G.z0 + Math.floor(k / nx) * passo;
      // o leito de uma estrada já aberta não muda (no cruzamento a nova chega na altura dela)
      if (dist[k] !== 0 && !noLugar(cx, cz) && G.estrada[k] < 5) h[k] = h[k] + (yy - h[k]) * w;
      marcas.push([k, Math.round(9 * Math.max(0, 1 - Math.max(0, d - LARG_ESTRADA / 2 + 1) / 2.5))]);
    }
    for (const [k, v] of marcas) G.estrada[k] = Math.max(G.estrada[k], v);
  }
}

// altura da grade em (x, z), bilinear; fora da grade é mar fundo
export function alturaMundo(G, x, z) {
  const fx = (x - G.x0) / G.passo, fz = (z - G.z0) / G.passo;
  if (fx < 0 || fz < 0 || fx >= G.nx - 1 || fz >= G.nz - 1) return MUNDO.fundoMar;
  const ix = Math.floor(fx), iz = Math.floor(fz), ax = fx - ix, az = fz - iz, k = iz * G.nx + ix, h = G.h;
  return (h[k] * (1 - ax) + h[k + 1] * ax) * (1 - az) + (h[k + G.nx] * (1 - ax) + h[k + G.nx + 1] * ax) * az;
}
// qual terra (TERRAS) fica em (x, z), ou null no mar
export function terraEm(G, x, z) {
  const i = Math.round((x - G.x0) / G.passo), j = Math.round((z - G.z0) / G.passo);
  if (i < 0 || j < 0 || i >= G.nx || j >= G.nz) return null;
  const t = G.terra[j * G.nx + i]; return t ? TERRAS[t - 1] : null;
}

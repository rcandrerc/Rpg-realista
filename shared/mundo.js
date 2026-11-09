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
  { id: 'ilha', nome: 'Ilha do Meio', x: 520, z: 40, rx: 82, rz: 74, lobos: [[3, 0.08, 1.7], [7, 0.04, 0.3]], niveis: [50, 65] },
  { id: 'aurora', nome: 'Continente de Aurora', x: 830, z: 50, rx: 195, rz: 225, lobos: [[3, 0.07, 2.8], [5, 0.05, 0.9], [8, 0.03, 4.0]], niveis: [60, 100] },
];
// a grade cobre o mundo todo com o mar em volta
export const MUNDO = { x0: -260, z0: -320, w: 1320, h: 740, passo: 4, mar: -0.05, fundoMar: -7, praia: 26, morros: 16, transicao: 40 };

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
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const x = M.x0 + i * M.passo, z = M.z0 + j * M.passo;
    if (mapaHoje && dentroDoMapa(mapaHoje, x, z, -12)) dist[j * nx + i] = 0; // 12 m a mais: a mata fechada da borda
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
  return { x0: M.x0, z0: M.z0, passo: M.passo, nx, nz, h, terra };
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

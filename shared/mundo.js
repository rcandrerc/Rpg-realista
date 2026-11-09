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

// 2026-11-09 (André, com o mapa do Quimera de exemplo: "um continente norte, um continente sul, bem grande, e uma ilha no
// meio... um mar um pouco maior... os continentes maiores, mais como continente"): o norte (Vael, Nv 1-50, com o mapa de
// hoje dentro) e o sul (Aurora, Nv 60-100) são continentes que vão de uma ponta à outra do mundo; a costa de cada um é
// uma linha ondulada (baías e pontas) e, nas bordas do mundo, cordilheiras altas fecham a terra (expansão: aumentar a
// grade e abrir uma passagem na cordilheira). No meio do mar, a Ilha do Meio (Nv 50-65), elipse de borda ondulada.
// forma 'norte': terra onde z < costa(x); 'sul': terra onde z > costa(x); costa = base + soma de ondas [período, amplitude, fase].
export const TERRAS = [
  { id: 'vael', nome: 'Continente de Vael', forma: 'norte', costa: 372, ondas: [[260, 62, 0.9], [110, 34, 2.1], [47, 11, 0.3]], niveis: [1, 50] },
  { id: 'ilha', nome: 'Ilha do Meio', x: 200, z: 662, rx: 168, rz: 106, lobos: [[3, 0.08, 1.7], [7, 0.04, 0.3]], niveis: [50, 65] },
  { id: 'aurora', nome: 'Continente de Aurora', forma: 'sul', costa: 950, ondas: [[240, 64, 2.6], [97, 32, 0.4], [43, 11, 2.5]], niveis: [60, 100] },
];
// a grade cobre o mundo todo; nas bordas (oeste, leste, o norte de Vael e o sul de Aurora) a cordilheira
export const MUNDO = { x0: -560, z0: -540, w: 1520, h: 2040, passo: 4, mar: -0.05, fundoMar: -7, praia: 26, morros: 21, transicao: 40, cordilheira: { largura: 150, alt: 78 } };
const costaEm = (T, x) => T.costa + T.ondas.reduce((s, [p, a, f]) => s + a * Math.sin(x / p + f), 0);
// distância (m) até a borda do mundo
const ateBorda = (x, z) => Math.min(x - MUNDO.x0, MUNDO.x0 + MUNDO.w - x, z - MUNDO.z0, MUNDO.z0 + MUNDO.h - z);

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
  // continente: até a costa, e o mar fechando nos últimos metros da borda do mundo (atrás da cordilheira)
  if (T.forma) return Math.min(T.forma === 'norte' ? costaEm(T, x) - z : z - costaEm(T, x), ateBorda(x, z) + 60);
  const dx = x - T.x, dz = z - T.z, ang = Math.atan2(dz, dx);
  let k = 1; for (const [n, amp, fase] of T.lobos) k *= 1 + amp * Math.sin(n * ang + fase);
  const e = Math.hypot(dx / T.rx, dz / T.rz); // 1 = na borda da elipse
  return (1 - e / k) * Math.min(T.rx, T.rz);
}

// Montanhas (André 2026-11-09: "cadê as montanhas, os rios cortando a ilha?"): serras altas de verdade, longe das
// estradas principais, dos campos e das vilas. Cada uma é um maciço (x, z, raio, altura, giro, achatamento) com cristas
// (ruído "ridged") e encosta íngreme; perto de estrada ou de lugar ela abaixa (vira passagem), nunca em cima deles.
export const MONTANHAS = [
  { id: 'serra_norte', nome: 'Serra do Norte', terra: 'vael', x: -170, z: -350, r: 85, alt: 64, giro: 0.4, ach: 0.6 },
  { id: 'pico_oeste_vael', nome: 'Pico do Oeste', terra: 'vael', x: -440, z: -120, r: 70, alt: 56, giro: 1.3, ach: 0.7 },
  { id: 'pico_juncos', nome: 'Pico dos Juncos', terra: 'vael', x: 660, z: -280, r: 85, alt: 70, giro: 1.1, ach: 0.7 },
  { id: 'morro_sul', nome: 'Morro do Sul', terra: 'vael', x: 470, z: 330, r: 55, alt: 44, giro: 0.2, ach: 0.7 },
  { id: 'morro_leste', nome: 'Morro do Leste', terra: 'vael', x: 300, z: -140, r: 55, alt: 46, giro: 0.7, ach: 0.75 },
  { id: 'pico_ilha', nome: 'Pico da Ilha', terra: 'ilha', x: 55, z: 662, r: 50, alt: 46, giro: 0, ach: 0.75 },
  { id: 'serra_aurora', nome: 'Serra de Aurora', terra: 'aurora', x: -380, z: 1300, r: 90, alt: 72, giro: 0.1, ach: 0.6 },
  { id: 'pico_aurora_oeste', nome: 'Pico da Névoa', terra: 'aurora', x: 150, z: 1400, r: 70, alt: 62, giro: 0.9, ach: 0.8 },
  { id: 'morro_veu', nome: 'Morro do Véu', terra: 'aurora', x: 620, z: 1360, r: 60, alt: 55, giro: 0.6, ach: 0.75 },
  { id: 'morro_sudoeste', nome: 'Morro das Pedras', terra: 'aurora', x: 30, z: 1020, r: 45, alt: 40, giro: 0.4, ach: 0.8 },
  { id: 'pico_leste', nome: 'Pico do Leste', terra: 'aurora', x: 860, z: 1330, r: 60, alt: 60, giro: 1.4, ach: 0.8 },
];
// o que segura a montanha baixa: os pontos das estradas principais e os lugares (sem os veios, que vêm depois)
function pertoDeQuem() {
  const pts = [];
  for (const E of ESTRADAS_MUNDO.slice(0, PRINCIPAIS)) for (const p of curva(E.pontos)) pts.push([p[0], p[1], 6]);
  for (const L of LUGARES_MUNDO) if (L.tipo !== 'mina') pts.push([L.x, L.z, L.r + 4]);
  return pts;
}
// cordilheira da borda do mundo: sobe nos últimos "largura" m até a borda, com picos e grotas (e despenca no mar atrás)
function cordilheiraEm(x, z, ruidoA, ruidoB) {
  const { largura, alt } = MUNDO.cordilheira, lg = largura * (0.4 + 0.85 * ruidoB(x / 190 + 3, z / 190 + 8, 2)), d = ateBorda(x, z);
  if (d >= lg) return 0;
  const t = 1 - Math.max(0, d) / lg, f = Math.pow(t, 1.4) * (3 - 2 * t) * 0.5 + t * t * 0.5;
  const crista = 1 - Math.abs(ruidoB(x / 27 + 2, z / 27 + 9, 4) * 2 - 1);
  return alt * f * (0.55 + 0.6 * ruidoA(x / 70 + 5, z / 70 + 1, 3)) * (0.75 + 0.4 * crista);
}
function montanhaEm(x, z, ruidoM, perto) {
  let v = 0;
  for (const m of MONTANHAS) {
    const dx = x - m.x, dz = z - m.z, c = Math.cos(m.giro), s = Math.sin(m.giro);
    const u = (dx * c + dz * s) / m.r, w = (-dx * s + dz * c) / (m.r * m.ach);
    const d = Math.hypot(u, w) * (1 + (ruidoM(x / 31 + 7, z / 31 + 3, 3) - 0.5) * 0.5);
    if (d >= 1) continue;
    const f = Math.pow(1 - d, 1.6) * (3 - 2 * (1 - d)) * 0.5 + Math.pow(1 - d, 2.2) * 0.5; // pé largo, cume pontudo
    const crista = 1 - Math.abs(ruidoM(x / 23 + 11, z / 23 + 5, 4) * 2 - 1); // cristas e grotas
    v += m.alt * f * (0.7 + 0.45 * crista);
  }
  if (v < 0.5) return 0;
  // perto de estrada ou lugar a montanha abaixa devagar (subida que o carrinho aguenta)
  let baixa = 1;
  for (const [px, pz, r] of perto) {
    const d = Math.hypot(px - x, pz - z) - r;
    if (d < 32) { const t = Math.max(0, d) / 32; baixa = Math.min(baixa, t * t * (3 - 2 * t)); }
  }
  return v * baixa;
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
  serpentear();
  const perto = pertoDeQuem();
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
    // o continente sobe devagar para dentro (até ~10 m a 350 m da costa): os rios descem da serra até o mar sem chegar
    // no nível do mar no meio do caminho
    v += Math.min(s, 350) * 0.028 * Math.min(1, s / 60);
    v += (montanhaEm(x, z, fbm2, perto) + cordilheiraEm(x, z, fbm, fbm2)) * Math.min(1, s / 12);
    // perto do mapa de hoje o chão novo desce até 0 (fica no mesmo plano da mata que já existe)
    const tr = Math.min(1, dist[k] / M.transicao), sm = tr * tr * (3 - 2 * tr);
    h[k] = dist[k] === 0 ? 0 : v * sm;
  }
  const G = { x0: M.x0, z0: M.z0, passo: M.passo, nx, nz, h, terra, estrada: new Uint8Array(nx * nz) };
  cavernasNasMontanhas(G, dist);
  caisNaCosta(G);
  lugaresDeMina(G);
  ramificar(G, dist);
  aplainarLugares(G, dist);
  abrirEstradas(G, dist);
  abrirRios(G, dist);
  cobrirCavernas(G, dist);
  return G;
}

// ---------- Parte 4: lugares planos e estradas de subida suave ----------
// Lugares do mundo novo (André 2026-11-08): campos de caça (Parte 5) e vilas e portos (Partes 6 e 7) ficam em chão
// estritamente plano. Cada um é um disco de raio r aplainado na altura média dele, com uma rampa de "rampa" m em volta.
// Vael (anel em volta do mapa de hoje): Nv 30-50 e o Porto de Vael (mini vila Nv 50) na costa leste. Ilha do Meio: Nv
// 50-65 e um porto de cada lado. Aurora: Nv 60-100, o porto oeste e a vila grande Nv 100 no meio (bairros, Parte 7).
export const LUGARES_MUNDO = [
  // Vael (o continente norte, em volta do mapa de hoje): Nv 32-50 e o Porto de Vael (mini vila Nv 50) na costa sul
  { id: 'c_v1', tipo: 'caca', terra: 'vael', nivel: 32, x: -232, z: -128, r: 14 },
  { id: 'c_v2', tipo: 'caca', terra: 'vael', nivel: 35, x: -250, z: 190, r: 14 },
  { id: 'c_v3', tipo: 'caca', terra: 'vael', nivel: 38, x: -150, z: 305, r: 14 },
  { id: 'c_v4', tipo: 'caca', terra: 'vael', nivel: 42, x: 330, z: 300, r: 14 },
  { id: 'c_v5', tipo: 'caca', terra: 'vael', nivel: 45, x: 505, z: 175, r: 14 },
  { id: 'c_v6', tipo: 'caca', terra: 'vael', nivel: 48, x: 440, z: -215, r: 14 },
  { id: 'c_v7', tipo: 'caca', terra: 'vael', nivel: 40, x: 135, z: -255, r: 14 },
  { id: 'c_v8', tipo: 'caca', terra: 'vael', nivel: 44, x: -360, z: -300, r: 14 },
  { id: 'c_v9', tipo: 'caca', terra: 'vael', nivel: 47, x: 690, z: -60, r: 14 },
  { id: 'vila_vael', tipo: 'vila', terra: 'vael', nivel: 50, nome: 'Porto de Vael', x: 92, z: 318, r: 35 },
  { id: 'porto_vael', tipo: 'porto', terra: 'vael', nome: 'Cais de Vael', x: 92, z: 372, r: 9 },
  // Ilha do Meio: um cais de frente para cada continente e os campos dos dois lados da estrada
  { id: 'porto_ilha_o', tipo: 'porto', terra: 'ilha', nome: 'Cais Norte da Ilha', x: 200, z: 559, r: 9 },
  { id: 'porto_ilha_l', tipo: 'porto', terra: 'ilha', nome: 'Cais Sul da Ilha', x: 200, z: 765, r: 9 },
  { id: 'c_i1', tipo: 'caca', terra: 'ilha', nivel: 52, x: 285, z: 620, r: 11 },
  { id: 'c_i2', tipo: 'caca', terra: 'ilha', nivel: 56, x: 120, z: 700, r: 11 },
  { id: 'c_i3', tipo: 'caca', terra: 'ilha', nivel: 60, x: 300, z: 705, r: 11 },
  { id: 'c_i4', tipo: 'caca', terra: 'ilha', nivel: 64, x: 105, z: 625, r: 11 },
  // Aurora (o continente sul): o cais na costa norte, a vila grande Nv 100 (bairros) e os campos Nv 66-100
  { id: 'porto_aurora', tipo: 'porto', terra: 'aurora', nome: 'Cais de Aurora', x: 200, z: 950, r: 9 },
  { id: 'vila_aurora', tipo: 'vila', terra: 'aurora', nivel: 100, nome: 'Aurora', x: 200, z: 1085, r: 70 },
  { id: 'c_a1', tipo: 'caca', terra: 'aurora', nivel: 66, x: -330, z: 1045, r: 14 },
  { id: 'c_a2', tipo: 'caca', terra: 'aurora', nivel: 70, x: -110, z: 1000, r: 14 },
  { id: 'c_a3', tipo: 'caca', terra: 'aurora', nivel: 74, x: -150, z: 1230, r: 14 },
  { id: 'c_a4', tipo: 'caca', terra: 'aurora', nivel: 78, x: 40, z: 1290, r: 14 },
  { id: 'c_a5', tipo: 'caca', terra: 'aurora', nivel: 82, x: 395, z: 1000, r: 14 },
  { id: 'c_a6', tipo: 'caca', terra: 'aurora', nivel: 86, x: 500, z: 1250, r: 14 },
  { id: 'c_a7', tipo: 'caca', terra: 'aurora', nivel: 90, x: 740, z: 1260, r: 14 },
  { id: 'c_a8', tipo: 'caca', terra: 'aurora', nivel: 95, x: 790, z: 1010, r: 14 },
  { id: 'c_a9', tipo: 'caca', terra: 'aurora', nivel: 100, x: 280, z: 1360, r: 15 },
  // postos de troca na beira da estrada (Parte 6: mercador de pack longe da vila)
  { id: 'posto_oeste', tipo: 'posto', terra: 'vael', nome: 'Posto do Oeste', x: -405, z: 62, r: 8 },
  { id: 'posto_leste', tipo: 'posto', terra: 'aurora', nome: 'Posto do Leste', x: 640, z: 1082, r: 8 },
];
// Estradas (largura 4 m, rampa máxima de 10%: o carrinho carregado sobe sem bugar). Em Vael saem do mapa de hoje
// (das trilhas que já existem) e dão a volta pelo anel até o Porto de Vael; na ilha e em Aurora ligam o cais aos campos
// e à vila. Os pontos são o caminho grosso: a estrada faz curvas suaves entre eles.
// 2026-11-09 (André: "era só seguir o estilo do início... uma estrada principal com vários pontos ligando aos pontos de
// caça e de mineração"; "remoção aprovada" do anel em volta das ilhas): as estradas principais (4 m) não passam por campo
// nenhum e não fecham anel; delas saem as trilhas (ramificar), que levam a cada campo de caça e a cada veio.
export const ESTRADAS_MUNDO = [
  // Vael: saem das trilhas do mapa de hoje. A do Porto (oeste do mapa de hoje até o Porto de Vael), a do Oeste (até o
  // posto), a do Norte (sai da do Oeste e sobe para as terras altas) e a do Leste (para as terras do leste)
  { id: 'e_sul', nome: 'Estrada do Porto', pontos: [[-16, 175], [-22, 228], [0, 270], [48, 300], [92, 318], [92, 372]] },
  { id: 'e_oeste', nome: 'Estrada do Oeste', pontos: [[8, -40], [-58, -70], [-140, -58], [-235, -2], [-330, 46], [-405, 62]] },
  { id: 'e_norte', nome: 'Estrada do Norte', pontos: [[-58, -70], [-62, -150], [-20, -240], [60, -320], [200, -350], [330, -330]] },
  { id: 'e_leste', nome: 'Estrada do Leste', pontos: [[214, 140], [290, 175], [380, 140], [470, 70], [580, 40], [700, 70]] },
  // Ilha do Meio: de um cais ao outro, pelo meio
  { id: 'e_ilha', nome: 'Estrada da Ilha', pontos: [[200, 559], [206, 605], [194, 662], [206, 720], [200, 765]] },
  // Aurora: do cais à vila e dela ao Posto do Leste; para o oeste e para o sul saem as outras duas
  { id: 'e_aurora', nome: 'Estrada de Aurora', pontos: [[200, 950], [200, 1010], [200, 1085], [330, 1100], [480, 1088], [640, 1082], [760, 1080], [880, 1092]] },
  { id: 'e_aurora_n', nome: 'Estrada do Oeste de Aurora', pontos: [[200, 1085], [80, 1098], [-40, 1080], [-180, 1062], [-290, 1110]] },
  { id: 'e_aurora_s', nome: 'Estrada da Serra', pontos: [[330, 1100], [380, 1170], [390, 1260], [420, 1340]] },
];
const PRINCIPAIS = ESTRADAS_MUNDO.length;
// trilhas (2,6 m): da rede (estradas e trilhas já feitas) até cada campo de caça e cada veio, a mais perto primeiro,
// com uma curva para o lado (nada de reta de régua) e sem passar por cima de outro lugar
const TRILHAS_FEITAS = { ok: false };
// (x, z) em cima da rocha de alguma caverna (o túnel e a volta dele): trilha não passa ali
const porCimaDeCaverna = (x, z) => CAVERNAS_MUNDO.some((D) => D.linha && curva(D.linha).some(([px, pz], i) => i > 0 && Math.hypot(px - x, pz - z) < 16));
function ramificar(G, dist) {
  if (TRILHAS_FEITAS.ok) return;
  TRILHAS_FEITAS.ok = true;
  const rede = []; // [x, z, peso]: a trilha nova sai de preferência da estrada principal
  const hoje = (x, z) => { const i = Math.round((x - G.x0) / G.passo), j = Math.round((z - G.z0) / G.passo); return dist[j * G.nx + i] < 6; };
  // trilha não sai de dentro do mapa de hoje (o chão dele fica preso no nível 0) nem atravessa rio (sem ponte na trilha)
  const leitos = RIOS_MUNDO.map((R) => meandro(curva(R.pontos)));
  const longeDoRio = (x, z) => leitos.every((C) => C.every((q) => Math.hypot(q[0] - x, q[1] - z) > LARG_RIO / 2 + BARRANCO + 3));
  const grossos = leitos.map((C) => C.filter((_, i) => i % 3 === 0));
  const cruzaRio = (p, L) => grossos.some((C) => C.some(([px, pz]) => { const t = Math.max(0, Math.min(1, ((px - p[0]) * (L.x - p[0]) + (pz - p[1]) * (L.z - p[1])) / ((L.x - p[0]) ** 2 + (L.z - p[1]) ** 2 || 1))); return Math.hypot(p[0] + (L.x - p[0]) * t - px, p[1] + (L.z - p[1]) * t - pz) < 10; }));
  for (const E of ESTRADAS_MUNDO) for (const p of curva(E.pontos)) if (!hoje(p[0], p[1]) && longeDoRio(p[0], p[1])) rede.push([p[0], p[1], 1]);
  const alvos = LUGARES_MUNDO.filter((l) => l.tipo === 'caca' || l.tipo === 'mina' || l.tipo === 'caverna');
  const feitos = new Set();
  while (feitos.size < alvos.length) {
    let melhor = null;
    for (const L of alvos) {
      if (feitos.has(L.id)) continue;
      const T = terraEm(G, L.x, L.z);
      for (const p of rede) {
        if (terraEm(G, p[0], p[1]) !== T) continue;
        let d = Math.hypot(p[0] - L.x, p[1] - L.z) * p[2];
        if (melhor && d >= melhor.d) continue;
        if (cruzaRio(p, L)) d *= 4; // atravessar rio só sem outro jeito
        if (!melhor || d < melhor.d) melhor = { L, p, d };
      }
    }
    if (!melhor) break;
    const { L } = melhor, p = [melhor.p[0], melhor.p[1]]; feitos.add(L.id);
    const dx = L.x - p[0], dz = L.z - p[1], d = Math.hypot(dx, dz), ux = dx / d, uz = dz / d;
    const fim = [L.x - ux * L.r * 0.4, L.z - uz * L.r * 0.4]; // entra na clareira
    const passaLonge = (C) => C.every(([x, z]) => !hoje(x, z) && longeDoRio(x, z) && !porCimaDeCaverna(x, z) && LUGARES_MUNDO.every((o) => o === L || o.tipo === 'porto' || o.tipo === 'vila' || o.tipo === 'posto' || Math.hypot(x - o.x, z - o.z) > o.r + 8));
    let escolha = null;
    // a curva para um lado ou para o outro (cada vez mais aberta) até passar longe de tudo; sem nenhuma que passe, a
    // que esbarra em menos pontos
    const sg = L.id.length % 2 ? 1 : -1;
    let menos = Infinity;
    for (const lado of [0.2, -0.2, 0.08, -0.08, 0, 0.35, -0.35, 0.5, -0.5].map((v) => v * sg)) {
      const meio = [(p[0] + fim[0]) / 2 - uz * d * lado, (p[1] + fim[1]) / 2 + ux * d * lado];
      const pts = [p, meio, fim], C = curva(pts), ruins = C.filter((q) => !passaLonge([q])).length;
      if (ruins < menos) { menos = ruins; escolha = pts; }
      if (!ruins) break;
    }
    ESTRADAS_MUNDO.push({ id: `t_${L.id}`, nome: 'Trilha', trilha: true, larg: 2.6, pontos: escolha.map(([x, z]) => [+x.toFixed(1), +z.toFixed(1)]) });
    // a trilha nova também vira rede, menos o pedaço perto do campo (trilha não sai de dentro de clareira: nada de
    // campo emendado em campo, que vira anel de novo)
    for (const q of curva(escolha)) if (longeDoRio(q[0], q[1]) && LUGARES_MUNDO.every((o) => (o.tipo !== 'caca' && o.tipo !== 'mina' && o.tipo !== 'caverna') || Math.hypot(q[0] - o.x, q[1] - o.z) > o.r + 10)) rede.push([q[0], q[1], 1.35]);
  }
}
export const RAMPA_MAX = 0.1;
const LARG_ESTRADA = 4, OMBRO = 7;

// Parte 6 (André 2026-11-08: "pequenos spots de minério bem diluídos... o jogador não pode precisar atravessar o mundo
// para coletar um recurso básico"): perto de cada campo novo, um veio pequeno de pedra e um de cobre (a 20-40 m) e, em
// campo sim, campo não, um de ferro (Vael) ou de cristal (ilha e Aurora). Cada um é um lugar plano pequeno (tipo mina),
// em terra firme, longe do mar, das estradas e dos outros lugares. Sorteio fixo pela ordem dos campos.
// cada cais vai para a beira da água de verdade (a costa é ondulada): anda da terra para o mar até a água e para ali;
// a estrada que chegava no cais vai junto
const CAIS_FEITOS = { ok: false };
function caisNaCosta(G) {
  if (CAIS_FEITOS.ok) return;
  CAIS_FEITOS.ok = true;
  for (const L of LUGARES_MUNDO.filter((l) => l.tipo === 'porto')) {
    const T = TERRAS.find((t) => t.id === L.terra), dir = T.forma === 'norte' ? 1 : T.forma === 'sul' ? -1 : L.z < T.z ? -1 : 1;
    let z = L.z - dir * 80;
    while (Math.abs(z - L.z) < 200 && alturaMundo(G, L.x, z) > 0.4) z += dir;
    const nz = +(z - dir * 2).toFixed(1);
    for (const E of ESTRADAS_MUNDO) {
      if (!E.pontos.some((p) => p[0] === L.x && p[1] === L.z)) continue;
      for (const p of E.pontos) if (p[0] === L.x && p[1] === L.z) p[1] = nz;
      // os pontos da estrada que ficaram entre o cais novo e o mar (ou rente a ele) saem: nada de vai e volta
      E.pontos = E.pontos.filter((p) => (p[0] === L.x && p[1] === nz) || (Math.hypot(p[0] - L.x, p[1] - nz) > 12 && (p[1] - nz) * dir < 0));
    }
    L.z = nz;
  }
}
const MINAS_FEITAS = { ok: false };
function lugaresDeMina(G) {
  if (MINAS_FEITAS.ok) return;
  MINAS_FEITAS.ok = true;
  const rotas = ESTRADAS_MUNDO.map((E) => curva(E.pontos));
  const livre = (x, z, r) => {
    if (!terraEm(G, x, z)) return false;
    for (let a = 0; a < 6.28; a += 0.5) for (const d of [0, r + 12, r + 22]) if (alturaMundo(G, x + Math.cos(a) * d, z + Math.sin(a) * d) < 0.3) return false;
    if (LUGARES_MUNDO.some((l) => Math.hypot(l.x - x, l.z - z) < l.r + r + 14)) return false;
    if (CAVERNAS_MUNDO.some((D) => D.linha && D.linha.some(([px, pz]) => Math.hypot(px - x, pz - z) < r + 36))) return false; // a rocha por cima do túnel
    if (RIOS_MUNDO.some((R) => meandro(curva(R.pontos)).some(([px, pz]) => Math.hypot(px - x, pz - z) < r + 34))) return false;
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
        // sem rio entre o campo e o veio (a trilha não precisa de ponte)
        if (RIOS_MUNDO.some((R) => meandro(curva(R.pontos)).some(([px, pz]) => { const t = Math.max(0, Math.min(1, ((px - L.x) * (x - L.x) + (pz - L.z) * (z - L.z)) / ((x - L.x) ** 2 + (z - L.z) ** 2))); return Math.hypot(L.x + (x - L.x) * t - px, L.z + (z - L.z) * t - pz) < 12; }))) continue;
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
// refaz o chão plano de um lugar na altura L.y (sem mexer no mapa de hoje nem nas estradas já abertas)
function aplainarUm(G, dist, L) {
  const { nx, nz, h, passo } = G, RAMPA = 16, R = L.r + RAMPA, nucleo = L.tipo === 'mina' ? 6 : 3;
  for (let j = Math.max(0, Math.floor((L.z - R - G.z0) / passo)); j <= Math.min(nz - 1, Math.ceil((L.z + R - G.z0) / passo)); j++)
    for (let i = Math.max(0, Math.floor((L.x - R - G.x0) / passo)); i <= Math.min(nx - 1, Math.ceil((L.x + R - G.x0) / passo)); i++) {
      const k = j * nx + i, d = Math.hypot(G.x0 + i * passo - L.x, G.z0 + j * passo - L.z);
      if (d > R || dist[k] === 0 || G.estrada[k] >= 5) continue;
      const t = Math.min(1, Math.max(0, (d - L.r - nucleo) / (RAMPA - nucleo))), w = 1 - t * t * (3 - 2 * t);
      h[k] += (L.y - h[k]) * w;
    }
}
// (x, z) no miolo plano de algum lugar (até r + 3 m)
const noLugar = (x, z, folga = 3) => LUGARES_MUNDO.find((l) => Math.hypot(x - l.x, z - l.z) <= l.r + folga);

// 2026-11-09 (André: "um pouco mais sinuosas, com mais curvas, respeitando que teremos que andar de carrinho"): a
// estrada principal serpenteia entre os pontos (curvas abertas, raio de uns 50 m ou mais), reta só perto das pontas, dos
// cruzamentos e dos lugares por onde passa (vila, posto, cais)
const SERPENTE = { ok: false };
function serpentear() {
  if (SERPENTE.ok) return;
  SERPENTE.ok = true;
  const pontas = ESTRADAS_MUNDO.flatMap((E) => [E.pontos[0], E.pontos[E.pontos.length - 1]]);
  ESTRADAS_MUNDO.forEach((E, n) => {
    if (E.trilha) return;
    const C = curva(E.pontos), ds = C.map((p, i) => (i ? Math.hypot(p[0] - C[i - 1][0], p[1] - C[i - 1][1]) : 0));
    const S = []; ds.reduce((a, d, i) => (S[i] = a + d), 0);
    const total = S[S.length - 1], out = [];
    for (let i = 0; i < C.length; i += 5) {
      const [x, z] = C[i], a = C[Math.max(0, i - 2)], b = C[Math.min(C.length - 1, i + 2)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      let w = Math.min(1, Math.min(S[i], total - S[i]) / 45);
      for (const q of pontas) w = Math.min(w, Math.max(0, Math.hypot(q[0] - x, q[1] - z) - 6) / 40);
      for (const L of LUGARES_MUNDO) if (L.tipo !== 'caca' && L.tipo !== 'mina') w = Math.min(w, Math.max(0, Math.hypot(L.x - x, L.z - z) - L.r - 4) / 30);
      const k = w * w * (3 - 2 * w) * (Math.sin(S[i] / 42 + n * 1.7) * 15 + Math.sin(S[i] / 19 + n) * 4);
      out.push([+(x - (b[1] - a[1]) / l * k).toFixed(1), +(z + (b[0] - a[0]) / l * k).toFixed(1)]);
    }
    const ult = E.pontos[E.pontos.length - 1];
    if (Math.hypot(out[out.length - 1][0] - ult[0], out[out.length - 1][1] - ult[1]) > 0.01) out.push(ult);
    out[0] = E.pontos[0];
    // os pontos originais por onde ela passa (cruzamentos, vila, posto) continuam sendo os mesmos objetos
    E.pontos = out.map((p) => E.pontos.find((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.01) || p);
  });
}

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

const fimDe = (E) => { const f = E.pontos[E.pontos.length - 1]; return LUGARES_MUNDO.find((l) => Math.hypot(f[0] - l.x, f[1] - l.z) <= l.r); };
function abrirEstradas(G, dist) {
  const { nx, nz, h, passo } = G;
  for (const E of ESTRADAS_MUNDO) {
    const C = curva(E.pontos);
    // trilha (2026-11-09): o campo ou o veio no fim dela desce ou sobe para perto da altura de onde ela sai (a estrada
    // ou trilha já aberta), para a subida caber; o chão plano dele é refeito na altura nova
    if (E.trilha) {
      const [fx, fz] = C[C.length - 1], L = LUGARES_MUNDO.find((l) => Math.hypot(fx - l.x, fz - l.z) <= l.r);
      if (L) {
        let len = 0; for (let i = 1; i < C.length; i++) len += Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]);
        const y0 = alturaMundo(G, C[0][0], C[0][1]), max = RAMPA_MAX * 0.7 * Math.max(0, len - L.r - 2);
        const y = +Math.max(1.6, Math.min(Math.max(L.y, y0 - max), y0 + max)).toFixed(2);
        if (Math.abs(y - L.y) > 0.05) { L.y = y; aplainarUm(G, dist, L); }
      }
    }
    // perfil: a altura do chão por baixo, com a rampa limitada (vai e volta) e alisada
    let y = C.map(([x, z]) => Math.max(0.9, alturaMundo(G, x, z)));
    // pontos presos: dentro de um lugar plano fica na altura dele; em cima de uma estrada já aberta (cruzamento), na dela;
    // no mapa de hoje, no chão dele
    const preso = C.map(([x, z], c) => {
      const L = noLugar(x, z);
      // a trilha só se prende no lugar onde ela termina (passando rente a outro, segue a rampa dela)
      if (L && (!E.trilha || L === fimDe(E) || L.tipo === 'porto' || L.tipo === 'vila' || L.tipo === 'posto')) return L.y;
      const i = Math.round((x - G.x0) / passo), j = Math.round((z - G.z0) / passo), k = j * nx + i;
      // a trilha só se prende na estrada de onde sai (no começo); cruzando outra trilha no meio, segue a rampa dela
      if (k >= 0 && k < h.length && ((G.estrada[k] >= 6 && (!E.trilha || c < 3)) || dist[k] === 0)) return h[k];
      return null;
    });
    preso.forEach((v, i) => { if (v != null) y[i] = v; });
    const ds = C.map((p, i) => (i ? Math.hypot(p[0] - C[i - 1][0], p[1] - C[i - 1][1]) : 0));
    const g = RAMPA_MAX * 0.8;
    for (let r = 0; r < 4; r++) {
      const s = y.slice(); for (let i = 1; i < y.length - 1; i++) if (preso[i] == null) y[i] = (s[i - 1] + 2 * s[i] + s[i + 1]) / 4;
      for (let i = 1; i < y.length; i++) if (preso[i] == null) y[i] = Math.min(Math.max(y[i], y[i - 1] - g * ds[i]), y[i - 1] + g * ds[i]);
      for (let i = y.length - 2; i >= 0; i--) if (preso[i] == null) y[i] = Math.min(Math.max(y[i], y[i + 1] - g * ds[i + 1]), y[i + 1] + g * ds[i + 1]);
    }
    E.curva = C.map((p, i) => [+p[0].toFixed(2), +p[1].toFixed(2), +y[i].toFixed(2)]);
    // cada quadrado da grade perto da estrada vai para a altura do ponto mais perto dela
    const LE = E.larg || LARG_ESTRADA, OM = E.trilha ? 4 : OMBRO, R = Math.max(LE / 2, 3.2) + OM, melhor = new Map();
    C.forEach(([x, z], c) => {
      for (let j = Math.max(0, Math.floor((z - R - G.z0) / passo)); j <= Math.min(nz - 1, Math.ceil((z + R - G.z0) / passo)); j++)
        for (let i = Math.max(0, Math.floor((x - R - G.x0) / passo)); i <= Math.min(nx - 1, Math.ceil((x + R - G.x0) / passo)); i++) {
          const k = j * nx + i, d = Math.hypot(G.x0 + i * passo - x, G.z0 + j * passo - z);
          if (d <= R && (!melhor.has(k) || melhor.get(k)[0] > d)) melhor.set(k, [d, y[c]]);
        }
    });
    const marcas = [];
    for (const [k, [d, yy]] of melhor) {
      // o miolo cortado é de pelo menos 3,2 m para cada lado: a grade tem 4 m e a trilha (2,6 m) ficaria pela metade
      const t = Math.min(1, Math.max(0, (d - Math.max(LE / 2, 3.2)) / OM)), w = 1 - t * t * (3 - 2 * t);
      const cx = G.x0 + (k % nx) * passo, cz = G.z0 + Math.floor(k / nx) * passo;
      // o leito de uma estrada já aberta não muda (no cruzamento a nova chega na altura dela)
      // a trilha não mexe no chão de estrada nenhuma (nem na beira dela): a estrada principal fica como estava
      if (dist[k] !== 0 && !noLugar(cx, cz) && !(noLugar(cx, cz, 6) && noLugar(cx, cz, 6) !== fimDe(E)) && G.estrada[k] < (E.trilha ? 1 : 3)) h[k] = h[k] + (yy - h[k]) * w;
      marcas.push([k, Math.round(9 * Math.max(0, 1 - Math.max(0, d - LE / 2 + 1) / 2.5))]);
    }
    for (const [k, v] of marcas) G.estrada[k] = Math.max(G.estrada[k], v);
  }
}

// ---------- Parte 4b: rios e cachoeiras (André 2026-11-08: "montanhas, rios, cachoeiras") ----------
// Cada rio desce do morro até o mar pelos pontos (nascente -> foz), num leito de LARG_RIO m com a água pela coxa (dá
// para atravessar a pé). O nível da água só desce. Na cachoeira (fração "cai" do caminho) a água despenca "altura" m e
// segue num cânion que vai se abrindo até o mar. Onde cruza uma estrada fica uma ponte de madeira (PONTES_MUNDO, o
// tablado é chão de verdade: o carrinho passa por cima). G.rio marca o leito (0-9) para o chão (pedra) e a mata.
export const RIOS_MUNDO = [
  // Vael: os dois descem da cordilheira do norte e cortam o continente até a costa sul
  { id: 'rio_claro', nome: 'Rio Claro', pontos: [[-330, -470], [-300, -380], [-318, -240], [-300, -110], [-292, 40], [-318, 170], [-330, 300], [-322, 420]], cai: 0.1, altura: 6 },
  { id: 'rio_juncos', nome: 'Rio dos Juncos', pontos: [[560, -470], [540, -380], [520, -250], [560, -120], [600, 20], [610, 160], [640, 290], [650, 420]], cai: 0.12, altura: 6 },
  // Aurora: descem da cordilheira do sul até a costa norte
  { id: 'rio_aurora', nome: 'Rio da Aurora', pontos: [[-220, 1480], [-235, 1330], [-215, 1200], [-225, 1100], [-232, 1000], [-240, 900]], cai: 0.15, altura: 6 },
  { id: 'rio_veu', nome: 'Rio do Véu', pontos: [[560, 1480], [590, 1330], [580, 1200], [590, 1110], [585, 1020], [600, 940], [610, 880]], cai: 0.14, altura: 7 },
];
export const PONTES_MUNDO = [];
const LARG_RIO = 7, BARRANCO = 5, FUNDO_RIO = 0.8;

// o rio não corre reto: serpenteia uns 25 m para cada lado entre os pontos
function meandro(C) {
  let S = 0;
  return C.map((p, i) => {
    const a = C[Math.max(0, i - 1)], b = C[Math.min(C.length - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    if (i) S += Math.hypot(p[0] - C[i - 1][0], p[1] - C[i - 1][1]);
    const k = Math.min(1, S / 60) * (Math.sin(S / 75) * 24 + Math.sin(S / 29 + 1) * 7);
    return [p[0] - (b[1] - a[1]) / l * k, p[1] + (b[0] - a[0]) / l * k];
  });
}
function abrirRios(G, dist) {
  const { nx, nz, h, passo } = G;
  G.rio = new Uint8Array(nx * nz);
  PONTES_MUNDO.length = 0;
  for (const R of RIOS_MUNDO) {
    // o rio acaba onde chega no mar (a foz): o resto da curva fica de fora
    const C0 = meandro(curva(R.pontos)), foz = C0.findIndex(([x, z]) => alturaMundo(G, x, z) < MUNDO.mar);
    const C = foz > 0 ? C0.slice(0, foz + 1) : C0, n = C.length;
    const ds = C.map((p, i) => (i ? Math.hypot(p[0] - C[i - 1][0], p[1] - C[i - 1][1]) : 0));
    const S = []; ds.reduce((a, d, i) => (S[i] = a + d), 0);
    const total = S[n - 1], ic = R.cai ? C.findIndex((_, i) => S[i] >= total * R.cai) : n; // sem "cai": rio sem cachoeira
    // nível da água: o chão (menos meio metro) e só desce; depois da cachoeira, reta até o mar no cânion
    const nivel = new Array(n);
    let run = Infinity;
    for (let i = 0; i < n; i++) {
      // o chão mais baixo do corte (meio e as duas beiras): a água nunca fica acima do barranco
      const a = C[Math.max(0, i - 1)], b = C[Math.min(n - 1, i + 1)], l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, px = -(b[1] - a[1]) / l * (LARG_RIO / 2 + 1.5), pz = (b[0] - a[0]) / l * (LARG_RIO / 2 + 1.5);
      run = Math.min(run, Math.min(alturaMundo(G, C[i][0], C[i][1]), alturaMundo(G, C[i][0] + px, C[i][1] + pz), alturaMundo(G, C[i][0] - px, C[i][1] - pz)) - 0.5);
      if (i < ic) nivel[i] = Math.max(MUNDO.mar, run);
      else { const t = (S[i] - S[ic]) / (total - S[ic]); nivel[i] = Math.max(MUNDO.mar, Math.min(run, (nivel[ic - 1] - R.altura) * (1 - t) + MUNDO.mar * t)); run = Math.min(run, nivel[i] + 0.5); }
    }
    // pontes: onde o rio cruza uma estrada, na altura da estrada antes de abrir o leito
    for (const E of ESTRADAS_MUNDO) {
      let melhor = null;
      for (const q of E.curva) for (let i = 0; i < n; i++) { const d = Math.hypot(q[0] - C[i][0], q[1] - C[i][1]); if (d < 3 && (!melhor || d < melhor.d)) melhor = { d, q, i }; }
      if (!melhor) continue;
      // trilha que cruza o rio rente à ponte da estrada usa a mesma ponte
      if (PONTES_MUNDO.some((p) => p.rio === R.id && Math.hypot(p.x - melhor.q[0], p.z - melhor.q[1]) < 25)) continue;
      const k = E.curva.indexOf(melhor.q), a = E.curva[Math.max(0, k - 3)], b = E.curva[Math.min(E.curva.length - 1, k + 3)];
      const ry = Math.atan2(b[0] - a[0], b[1] - a[1]);
      // o rio cruza torto: a ponte vai de um barranco ao outro medidos ao longo da estrada
      const ra = C[Math.max(0, melhor.i - 2)], rb = C[Math.min(n - 1, melhor.i + 2)], rr = Math.atan2(rb[0] - ra[0], rb[1] - ra[1]);
      const vao = Math.min(48, (LARG_RIO + 2 * BARRANCO) / Math.max(0.35, Math.abs(Math.sin(ry - rr))) + 9);
      // a ponte acompanha a rampa da estrada: a altura de cada ponta é a da estrada ali
      const yEm = (u) => { const px = melhor.q[0] + Math.sin(ry) * u, pz = melhor.q[1] + Math.cos(ry) * u; let m = null; for (const q of E.curva) { const d = Math.hypot(q[0] - px, q[1] - pz); if (!m || d < m[0]) m = [d, q[2]]; } return m[1]; };
      // a água passa por baixo da ponte com folga: o rio desce até 1,2 m abaixo do tablado (rio acima, uma corredeira
      // de 15% até lá; rio abaixo, nunca mais alto que isso)
      const yp = Math.min(yEm(-vao / 2), yEm(vao / 2), melhor.q[2]) + 0.1 - 1.2;
      for (let i = 0; i < n; i++) nivel[i] = Math.max(MUNDO.mar, Math.min(nivel[i], yp + Math.max(0, S[melhor.i] - S[i]) * 0.15));
      PONTES_MUNDO.push({ id: `ponte_${R.id}_${E.id}`, nome: `Ponte do ${R.nome}`, rio: R.id, x: melhor.q[0], z: melhor.q[1], ry: +ry.toFixed(4), w: 5, d: +vao.toFixed(2), y1: +(melhor.q[2] + 0.1).toFixed(2), ya: +(yEm(-vao / 2) + 0.1).toFixed(2), yb: +(yEm(vao / 2) + 0.1).toFixed(2), nivel: +nivel[melhor.i].toFixed(2) });
    }
    // leito: cada quadrado perto do rio desce até o fundo do ponto mais perto, com o barranco liso em volta
    const RR = LARG_RIO / 2 + BARRANCO, melhor = new Map();
    C.forEach(([x, z], c) => {
      for (let j = Math.max(0, Math.floor((z - RR - G.z0) / passo)); j <= Math.min(nz - 1, Math.ceil((z + RR - G.z0) / passo)); j++)
        for (let i = Math.max(0, Math.floor((x - RR - G.x0) / passo)); i <= Math.min(nx - 1, Math.ceil((x + RR - G.x0) / passo)); i++) {
          const k = j * nx + i, d = Math.hypot(G.x0 + i * passo - x, G.z0 + j * passo - z);
          if (d <= RR && (!melhor.has(k) || melhor.get(k)[0] > d)) melhor.set(k, [d, nivel[c] - FUNDO_RIO]);
        }
    });
    for (const [k, [d, fundo]] of melhor) {
      if (dist[k] === 0 || h[k] < MUNDO.mar) continue;
      const t = Math.min(1, Math.max(0, (d - LARG_RIO / 2) / BARRANCO)), w = 1 - t * t * (3 - 2 * t);
      h[k] = Math.min(h[k], fundo + (h[k] - fundo) * (1 - w));
      G.rio[k] = Math.max(G.rio[k], Math.round(9 * w));
    }
    R.curva = C.map((p, i) => [+p[0].toFixed(2), +p[1].toFixed(2), +nivel[i].toFixed(2)]);
    R.cachoeira = ic >= n - 1 || nivel[ic - 1] - nivel[ic] < 1 ? null : { i: ic, x: +C[ic][0].toFixed(2), z: +C[ic][1].toFixed(2), topo: +nivel[ic - 1].toFixed(2), pe: +nivel[ic].toFixed(2), ry: +Math.atan2(C[ic + 1][0] - C[ic - 1][0], C[ic + 1][1] - C[ic - 1][1]).toFixed(4) };
  }
}

// ---------- Parte 8: cavernas nas montanhas (André 2026-11-09: "cadê as cavernas?") ----------
// Cada caverna entra numa montanha grande (MONTANHAS) pelo pé dela: um túnel com duas salas (shared/caverna.js faz
// o chão e o teto; o resto do mundo é a montanha, então a parede sai de graça). Na frente da boca fica um lugar plano
// (tipo "caverna") com trilha da rede, igual aos campos. A boca é escolhida sozinha: o lado da montanha que sobe forte
// logo atrás dela, com rocha bastante por cima do túnel inteiro e perto do campo "perto". Depois das estradas e dos
// rios, cobrirCavernas levanta a rocha por cima do túnel (a boca vira um paredão, sem cano de túnel para fora).
export const CAVERNAS_MUNDO = [
  { id: 'cav_serra_norte', nome: 'Gruta da Serra do Norte', montanha: 'serra_norte', terra: 'vael', perto: 'c_v8', nivel: 46 },
  { id: 'cav_juncos', nome: 'Gruta dos Juncos', montanha: 'pico_juncos', terra: 'vael', perto: 'c_v9', nivel: 50 },
  { id: 'cav_ilha', nome: 'Gruta da Ilha', montanha: 'pico_ilha', terra: 'ilha', perto: 'c_i4', nivel: 62 },
  { id: 'cav_aurora', nome: 'Gruta da Serra de Aurora', montanha: 'serra_aurora', terra: 'aurora', perto: 'c_a1', nivel: 80 },
  { id: 'cav_nevoa', nome: 'Gruta da Névoa', montanha: 'pico_aurora_oeste', terra: 'aurora', perto: 'c_a9', nivel: 100 },
];
export const CAVERNA_MUNDO_FORMA = { comprimento: 58, frente: 7, desce: 2, cobre: 4,
  salas: [{ id: 'sala1', s: 22, r: 5, l: 6, teto: 6.6 }, { id: 'sala2', s: 46, r: 6, l: 7, teto: 8 }],
  corredor: { l: 2.4, teto: 4.4 }, boca: { l: 3, teto: 5 }, porta: 0, passo: 1, folga: 0.35 };
const CAVERNAS_FEITAS = { ok: false };
function cavernasNasMontanhas(G, dist) {
  if (CAVERNAS_FEITAS.ok) return;
  CAVERNAS_FEITAS.ok = true;
  const F = CAVERNA_MUNDO_FORMA, h = (x, z) => alturaMundo(G, x, z);
  const leitos = RIOS_MUNDO.map((R) => meandro(curva(R.pontos)));
  const rotas = ESTRADAS_MUNDO.map((E) => curva(E.pontos));
  const hoje = (x, z) => { const i = Math.round((x - G.x0) / G.passo), j = Math.round((z - G.z0) / G.passo); return !(dist[j * G.nx + i] > 50); };
  for (const D of CAVERNAS_MUNDO) {
    const m = MONTANHAS.find((o) => o.id === D.montanha), alvo = LUGARES_MUNDO.find((l) => l.id === D.perto);
    let melhor = null;
    for (let a = 0; a < 72; a++) {
      const ang = (a / 72) * Math.PI * 2, ux = Math.cos(ang), uz = Math.sin(ang);
      for (let d = m.r * 1.1; d > m.r * 0.3; d -= 2) {
        const px = m.x + ux * d, pz = m.z + uz * d, qx = px + ux * (F.frente + 4), qz = pz + uz * (F.frente + 4);
        if (h(px, pz) - h(qx, qz) < 6) continue; // a encosta logo atrás da boca precisa subir forte
        // a frente: terra firme, longe do mar, do mapa de hoje, dos rios, das estradas e dos outros lugares
        const yq = h(qx, qz);
        if (!terraEm(G, qx, qz) || yq < 1.5 || hoje(qx, qz)) break;
        let mar = false; for (let b = 0; b < 6.28; b += 0.2) for (let d2 = 4; d2 < F.frente + 13; d2 += 2) if (h(qx + Math.cos(b) * d2, qz + Math.sin(b) * d2) < 0) mar = true;
        if (mar) break;
        if (leitos.some((C) => C.some(([x, z]) => Math.hypot(x - qx, z - qz) < 30))) break;
        if (rotas.some((C) => C.some(([x, z]) => Math.hypot(x - qx, z - qz) < F.frente + 12))) break;
        if (LUGARES_MUNDO.some((l) => Math.hypot(l.x - qx, l.z - qz) < l.r + F.frente + 27)) break;
        let plano = 0; for (let b = 0; b < 6.28; b += 0.8) plano = Math.max(plano, Math.abs(h(qx + Math.cos(b) * F.frente, qz + Math.sin(b) * F.frente) - yq));
        // rocha por cima do túnel (e nada de rio cortando por cima)
        let falta = 0;
        for (let s = 6; s <= F.comprimento; s += 4) {
          const tx = px - ux * s, tz = pz - uz * s, cobre = h(tx, tz) - (yq - F.desce) - 13;
          if (cobre < 0) falta -= cobre;
          if (leitos.some((C) => C.some(([x, z]) => Math.hypot(x - tx, z - tz) < 14))) falta += 100;
        }
        // a boca olha para o campo (a trilha chega pela frente, nunca por cima do túnel)
        const ax = alvo.x - qx, az = alvo.z - qz, frenteAlvo = (ax * ux + az * uz) / (Math.hypot(ax, az) || 1);
        const nota = falta * 4 + plano * 3 + Math.hypot(qx - alvo.x, qz - alvo.z) * 0.15 + Math.max(0, 0.3 - frenteAlvo) * 200;
        if (!melhor || nota < melhor.nota) melhor = { nota, px, pz, qx, qz, ux, uz };
        break;
      }
    }
    if (!melhor) continue;
    const { px, pz, qx, qz, ux, uz } = melhor;
    // a linha do túnel: da boca para dentro da montanha, com uma curva leve para um lado (nada de régua)
    const sg = D.id.length % 2 ? 1 : -1, linha = [];
    for (let k = 0; k <= 6; k++) {
      const s = (k / 6) * F.comprimento, lado = Math.sin((s / F.comprimento) * Math.PI) * 6 * sg;
      linha.push([+(px - ux * s - uz * lado).toFixed(2), +(pz - uz * s + ux * lado).toFixed(2)]);
    }
    D.linha = linha; D.boca = [+px.toFixed(2), +pz.toFixed(2)]; D.dir = [+(-ux).toFixed(4), +(-uz).toFixed(4)];
    LUGARES_MUNDO.push({ id: D.id, tipo: 'caverna', terra: D.terra, nome: D.nome, nivel: D.nivel, x: +qx.toFixed(1), z: +qz.toFixed(1), r: F.frente });
  }
}
// definição do túnel de cada caverna para shared/caverna.js (montarCaverna): y0 = o chão plano da frente
export function defsDasCavernas() {
  const F = CAVERNA_MUNDO_FORMA;
  return CAVERNAS_MUNDO.filter((D) => D.linha).map((D) => ({ id: D.id, nome: D.nome, linha: D.linha, salas: F.salas, corredor: F.corredor,
    boca: F.boca, porta: F.porta, chao: { desce: F.desce }, passo: F.passo, folga: F.folga, y0: LUGARES_MUNDO.find((l) => l.id === D.id).y }));
}
function cobrirCavernas(G, dist) {
  const F = CAVERNA_MUNDO_FORMA, { nx, nz, h, passo } = G;
  for (const D of CAVERNAS_MUNDO) {
    if (!D.linha) continue;
    const L = LUGARES_MUNDO.find((l) => l.id === D.id), C = curva(D.linha), S = [0];
    for (let i = 1; i < C.length; i++) S.push(S[i - 1] + Math.hypot(C[i][0] - C[i - 1][0], C[i][1] - C[i - 1][1]));
    const total = S[S.length - 1], LARG = 9 + 14;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const [x, z] of C) { x0 = Math.min(x0, x - LARG); x1 = Math.max(x1, x + LARG); z0 = Math.min(z0, z - LARG); z1 = Math.max(z1, z + LARG); }
    for (let j = Math.max(0, Math.floor((z0 - G.z0) / passo)); j <= Math.min(nz - 1, Math.ceil((z1 - G.z0) / passo)); j++)
      for (let i = Math.max(0, Math.floor((x0 - G.x0) / passo)); i <= Math.min(nx - 1, Math.ceil((x1 - G.x0) / passo)); i++) {
        const k = j * nx + i, x = G.x0 + i * passo, z = G.z0 + j * passo;
        if (dist[k] === 0 || G.estrada[k]) continue;
        // ponto mais perto da linha: s pelo túnel e d de lado (passando do fim, d conta até a ponta: fundo arredondado)
        let md = Infinity, ms = 0;
        for (let q = 0; q < C.length - 1; q++) {
          const ax = C[q][0], az = C[q][1], vx = C[q + 1][0] - ax, vz = C[q + 1][1] - az, l2 = vx * vx + vz * vz || 1;
          const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / l2)), d = Math.hypot(x - ax - vx * t, z - az - vz * t);
          if (d < md) { md = d; ms = S[q] + (S[q + 1] - S[q]) * t; }
        }
        // s antes da boca: conta para trás (a frente da boca fica no chão plano)
        const bx = x - C[0][0], bz = z - C[0][1], frente = bx * (C[1][0] - C[0][0]) + bz * (C[1][1] - C[0][1]);
        // na frente da boca e nos primeiros metros dela: o chão desce até o plano da frente (entra-se andando, sem
        // degrau; a cara de rocha em volta da boca é o paredão que o app desenha)
        if (frente < 0 || ms < 3.5) {
          const db = Math.hypot(bx, bz), t2 = Math.min(1, Math.max(0, (db - 6) / 6)), w2 = 1 - t2 * t2 * (3 - 2 * t2);
          if (w2 > 0 && h[k] > L.y) h[k] += (L.y - h[k]) * w2;
          continue;
        }
        let larg = F.corredor.l, teto = F.corredor.teto;
        for (const Sa of F.salas) { const k2 = Math.abs(ms - Sa.s) < Sa.r + 5 ? 1 : 0; larg = Math.max(larg, k2 ? Sa.l : larg); teto = Math.max(teto, k2 ? Sa.teto : teto); }
        const chao = L.y - F.desce * Math.min(1, Math.max(0, (ms - 3) / (total - 3)));
        const alvo = chao + teto + F.cobre + Math.min(ms, 20) * 0.25;
        const lw = larg + F.folga + 2, t = Math.min(1, Math.max(0, (md - lw) / 14)), w = (1 - t * t * (3 - 2 * t)) * Math.min(1, Math.max(0, (ms - 3.5) / 2));
        if (w > 0 && h[k] < alvo) h[k] += (alvo - h[k]) * w;
      }
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

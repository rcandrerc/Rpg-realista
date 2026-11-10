// Rede de estradas no servidor (André 2026-11-10: "quando eu chamo a Cecília ela não se teleporta: entra na montaria
// e vem até mim pela estrada, como um jogador normal"). É a mesma rede do "Ir para" do app (godot-prototipo/rota.gd):
// os caminhos de terra do mapa de hoje (mapa.vila.caminhos), a estrada e as ruas das Terras da Estrada (VILA_LOTES) e
// as estradas e trilhas do mundo grande (shared/mundo.js ESTRADAS_MUNDO, .curva), picadas a cada PASSO m e ligadas nas
// junções com as mesmas regras do app (pontas, cruzamentos no meio, emendas dos pedaços soltos na mesma terra sem
// passar no mar). Monta uma vez só, na primeira viagem. A rota é o caminho mais curto POR ELAS (A*).
import { VILA_LOTES } from './dados.js';
import { ESTRADAS_MUNDO, terraEm } from './mundo.js';
import { gradeDoMundo } from './relevo.js';

const PASSO = 2, JUNTA = 3.2, CRUZA = 1.6, EMENDA = 30, CELULA = 8;
export const ROTA = { perto: 8 }; // m: destino tão perto que não vale ir até a estrada (vai direto)

const cel = (x, z) => `${Math.floor(x / CELULA)},${Math.floor(z / CELULA)}`;

// terra (TERRAS) em (x, z): 0 no mar; -1 sem o mundo grande
export function terraId(x, z) {
  const G = gradeDoMundo(); if (!G) return -1;
  const i = Math.round((x - G.x0) / G.passo), j = Math.round((z - G.z0) / G.passo);
  if (i < 0 || j < 0 || i >= G.nx || j >= G.nz) return 0;
  return G.terra[j * G.nx + i] | 0;
}
const noMar = (x, z) => { const G = gradeDoMundo(); return !!G && !terraEm(G, x, z); };

class Rede {
  constructor(mapa) {
    this.xs = []; this.zs = []; this.viz = []; this.grade = new Map();
    const linhas = [];
    for (const c of mapa?.vila?.caminhos || []) linhas.push(c.pontos);
    if (VILA_LOTES?.estrada) linhas.push(VILA_LOTES.estrada);
    for (const r of VILA_LOTES?.ruas || []) if (r.pontos) linhas.push(r.pontos);
    if (gradeDoMundo()) for (const E of ESTRADAS_MUNDO) if (E.curva) linhas.push(E.curva);
    const porLinha = [];
    for (const pts of linhas) {
      const ids = [];
      for (let k = 0; k < pts.length; k++) {
        const ax = +pts[k][0], az = +pts[k][1];
        if (k > 0) {
          const bx = +pts[k - 1][0], bz = +pts[k - 1][1], n = Math.max(1, Math.ceil(Math.hypot(ax - bx, az - bz) / PASSO));
          for (let s = 1; s < n; s++) ids.push(this.novo(bx + (ax - bx) * s / n, bz + (az - bz) * s / n));
        }
        ids.push(this.novo(ax, az));
      }
      for (let k = 1; k < ids.length; k++) this.ligar(ids[k - 1], ids[k]);
      if (ids.length) porLinha.push(ids);
    }
    this.juntar(porLinha);
  }
  novo(x, z) { const id = this.xs.length; this.xs.push(x); this.zs.push(z); this.viz.push([]); return id; }
  ligar(a, b) { if (a === b || this.viz[a].includes(b)) return; this.viz[a].push(b); this.viz[b].push(a); }
  d(a, x, z) { return Math.hypot(this.xs[a] - x, this.zs[a] - z); }
  // pontos (com a linha de cada um) até raio m de (x, z)
  vizinhos(x, z, raio, G) {
    const r = Math.ceil(raio / CELULA), cx = Math.floor(x / CELULA), cz = Math.floor(z / CELULA), out = [];
    for (let gx = cx - r; gx <= cx + r; gx++) for (let gz = cz - r; gz <= cz + r; gz++)
      for (const e of G.get(`${gx},${gz}`) || []) if (this.d(e[0], x, z) < raio) out.push(e);
    return out;
  }
  juntar(porLinha) {
    const G = new Map();
    porLinha.forEach((ids, li) => { for (const id of ids) { const k = cel(this.xs[id], this.zs[id]); if (!G.has(k)) G.set(k, []); G.get(k).push([id, li]); } });
    const pai = new Map();
    const raiz = (a) => { while ((pai.get(a) ?? a) !== a) { const p = pai.get(a); pai.set(a, pai.get(p) ?? p); a = pai.get(a); } return a; };
    const unir = (a, b) => pai.set(raiz(a), raiz(b));
    for (const ids of porLinha) for (const id of ids) pai.set(id, ids[0]);
    const maisPerto = (x, z, raio, ok) => { let m = -1, md = raio; for (const e of this.vizinhos(x, z, raio, G)) { if (!ok(e)) continue; const d = this.d(e[0], x, z); if (d < md) { md = d; m = e[0]; } } return m; };
    // 1. pontas: liga no ponto mais perto de cada outro caminho até JUNTA m
    porLinha.forEach((ids, li) => {
      for (const p of [ids[0], ids[ids.length - 1]]) {
        const x = this.xs[p], z = this.zs[p], outras = new Set(this.vizinhos(x, z, JUNTA, G).map((e) => e[1]).filter((l) => l !== li));
        for (const lj of outras) { const m = maisPerto(x, z, JUNTA, (e) => e[1] === lj); if (m >= 0 && m !== p) { this.ligar(p, m); unir(p, m); } }
      }
    });
    // 2. cruzamentos no meio
    porLinha.forEach((ids, li) => {
      for (const id of ids) { const o = maisPerto(this.xs[id], this.zs[id], CRUZA, (e) => e[1] !== li); if (o >= 0) { this.ligar(id, o); unir(id, o); } }
    });
    // 3. emendas dos pedaços soltos, menor vão primeiro, na mesma terra e sem passar no mar
    const vaos = [];
    porLinha.forEach((ids, li) => {
      for (const p of [ids[0], ids[ids.length - 1]]) {
        const x = this.xs[p], z = this.zs[p], meu = raiz(p);
        const o = maisPerto(x, z, EMENDA, (e) => e[1] !== li && raiz(e[0]) !== meu);
        if (o >= 0) vaos.push([this.d(o, x, z), p, o]);
      }
    });
    vaos.sort((a, b) => a[0] - b[0]);
    for (const [, a, b] of vaos) if (raiz(a) !== raiz(b) && this.emendaOk(a, b)) { this.ligar(a, b); unir(a, b); }
    for (let id = 0; id < this.xs.length; id++) { const k = cel(this.xs[id], this.zs[id]); if (!this.grade.has(k)) this.grade.set(k, []); this.grade.get(k).push([id, 0]); }
  }
  emendaOk(a, b) {
    if (!gradeDoMundo()) return true;
    const ax = this.xs[a], az = this.zs[a], bx = this.xs[b], bz = this.zs[b];
    if (terraId(ax, az) !== terraId(bx, bz)) return false;
    const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 2));
    for (let s = 0; s <= n; s++) if (noMar(ax + (bx - ax) * s / n, az + (bz - az) * s / n)) return false;
    return true;
  }
  // ponto da rede mais perto de (x, z): procura em anéis cada vez maiores
  maisPerto(x, z) {
    for (let raio = 16; raio <= 2048; raio *= 2) {
      let m = -1, md = Infinity;
      for (const e of this.vizinhos(x, z, raio, this.grade)) { const d = this.d(e[0], x, z); if (d < md) { md = d; m = e[0]; } }
      if (m >= 0) return m;
    }
    return -1;
  }
  // A* de a até b; lista de ids ou null
  caminho(a, b) {
    const n = this.xs.length, g = new Float64Array(n).fill(Infinity), de = new Int32Array(n).fill(-1), fechado = new Uint8Array(n);
    const h = (i) => this.d(i, this.xs[b], this.zs[b]), fila = [[h(a), a]];
    const sobe = (k) => { while (k > 0) { const p = (k - 1) >> 1; if (fila[p][0] <= fila[k][0]) break; [fila[p], fila[k]] = [fila[k], fila[p]]; k = p; } };
    const tira = () => {
      const top = fila[0], ult = fila.pop();
      if (fila.length) { fila[0] = ult; let k = 0; for (;;) { const l = 2 * k + 1, r = l + 1; let m = k; if (l < fila.length && fila[l][0] < fila[m][0]) m = l; if (r < fila.length && fila[r][0] < fila[m][0]) m = r; if (m === k) break; [fila[m], fila[k]] = [fila[k], fila[m]]; k = m; } }
      return top;
    };
    g[a] = 0;
    while (fila.length) {
      const [, u] = tira(); if (fechado[u]) continue; fechado[u] = 1;
      if (u === b) { const out = []; for (let k = b; k >= 0; k = de[k]) out.push(k); return out.reverse(); }
      for (const v of this.viz[u]) {
        if (fechado[v]) continue;
        const nv = g[u] + this.d(v, this.xs[u], this.zs[u]);
        if (nv < g[v]) { g[v] = nv; de[v] = u; fila.push([nv + h(v), v]); sobe(fila.length - 1); }
      }
    }
    return null;
  }
}

const redes = new WeakMap();
export function redeDeEstradas(mapa) {
  let R = redes.get(mapa || redes); if (!R) { R = new Rede(mapa); redes.set(mapa || redes, R); }
  return R;
}

// Rota de (de) até (ate) pela estrada: { pontos: [{x, z}...], metros } (o último ponto é o destino) ou
// { bloqueio: 'terra' | 'mar' } quando só de barco ou navio (outro continente, ou o caminho cruza o mar)
export function planejarRota(mapa, de, ate) {
  const td = terraId(de.x, de.z), ta = terraId(ate.x, ate.z);
  if (td > 0 && ta > 0 && td !== ta) return { bloqueio: 'terra' };
  const fim = { x: ate.x, z: ate.z };
  let pontos = [fim];
  if (Math.hypot(ate.x - de.x, ate.z - de.z) >= ROTA.perto) {
    const R = redeDeEstradas(mapa), a = R.maisPerto(de.x, de.z), b = R.maisPerto(ate.x, ate.z);
    const ids = a >= 0 && b >= 0 ? R.caminho(a, b) : null;
    if (ids) {
      const p = ids.map((i) => ({ x: R.xs[i], z: R.zs[i] })), dd = (q, r) => Math.hypot(q.x - r.x, q.z - r.z);
      // já está na estrada um pouco à frente: não volta; o destino fica antes do último ponto: sai da estrada antes
      if (p.length >= 2 && dd(de, p[1]) < dd(p[0], p[1])) p.shift();
      if (p.length >= 2 && dd(fim, p[p.length - 2]) < dd(p[p.length - 1], p[p.length - 2])) p.pop();
      pontos = [...p, fim];
    }
  }
  // o caminho não pode cruzar o mar (amostra a cada 3 m)
  let q = de, metros = 0;
  for (const p of pontos) {
    const d = Math.hypot(p.x - q.x, p.z - q.z), n = Math.max(1, Math.ceil(d / 3));
    for (let s = 1; s <= n; s++) if (noMar(q.x + (p.x - q.x) * s / n, q.z + (p.z - q.z) * s / n)) return { bloqueio: 'mar' };
    metros += d; q = p;
  }
  return { pontos, metros };
}

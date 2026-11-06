// Varredura das pedras flutuantes (André 2026-11-06: "várias, mais várias mesmo, pedras flutuantes"). Confere TODAS as
// peças do cenário da mata (rochedos dos marcos, pedras soltas, pedras da beira da estrada e dos lagos, troncos, ruínas...)
// com a mesma conta de godot-prototipo/cenario.gd (chao_da_peca): pega os vértices de verdade de cada modelo
// (godot-prototipo/cenario3d/*.glb), põe a peça no mundo e mede, ponto por ponto da base, a folga até o relevo.
// Falha se algum pedaço da base ficar no ar (mais de 2 cm) ou se a peça sumir enterrada.
// Também mostra quantas flutuavam com a conta antiga (terreno.altura, que soma o tampo de pulo da própria pedra).
// Uso: node ferramentas/testes/pedras-no-chao.mjs
import fs from 'node:fs';
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { relevo } from '../../shared/relevo.js';

const ENTERRA = 0.03, AFUNDA_MAX = 0.3, BASE_FAIXA = 0.12, NO_AR = 0.02; // iguais a cenario.gd
const PASTA = new URL('../../godot-prototipo/cenario3d/', import.meta.url);

// vértices do modelo (com a posição de cada nó), no espaço do modelo
function vertices(arq) {
  const b = fs.readFileSync(arq), jl = b.readUInt32LE(12), J = JSON.parse(b.subarray(20, 20 + jl).toString()), bin = b.subarray(20 + jl + 8);
  const local = (n) => {
    if (n.matrix) return n.matrix;
    const [x, y, z, w] = n.rotation || [0, 0, 0, 1], [sx, sy, sz] = n.scale || [1, 1, 1], [tx, ty, tz] = n.translation || [0, 0, 0];
    return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0,
      2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
  };
  const mul = (a, c) => { const r = new Array(16).fill(0); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) r[j * 4 + i] += a[k * 4 + i] * c[j * 4 + k]; return r; };
  const pts = [];
  const visita = (ni, P) => {
    const n = J.nodes[ni], W = mul(P, local(n));
    if (n.mesh != null) for (const pr of J.meshes[n.mesh].primitives) {
      const a = J.accessors[pr.attributes.POSITION], v = J.bufferViews[a.bufferView], off = (v.byteOffset || 0) + (a.byteOffset || 0), st = v.byteStride || 12;
      for (let i = 0; i < a.count; i++) {
        const x = bin.readFloatLE(off + i * st), y = bin.readFloatLE(off + i * st + 4), z = bin.readFloatLE(off + i * st + 8);
        pts.push([W[0] * x + W[4] * y + W[8] * z + W[12], W[1] * x + W[5] * y + W[9] * z + W[13], W[2] * x + W[6] * y + W[10] * z + W[14]]);
      }
    }
    for (const c of n.children || []) visita(c, W);
  };
  for (const r of J.scenes[J.scene || 0].nodes) visita(r, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  return pts;
}
const modelos = {};
function modelo(nome) {
  if (modelos[nome]) return modelos[nome];
  const pts = vertices(new URL(nome + '.glb', PASTA));
  const y0 = Math.min(...pts.map((p) => p[1])), y1 = Math.max(...pts.map((p) => p[1]));
  const base = pts.filter((p) => p[1] <= y0 + BASE_FAIXA);
  return (modelos[nome] = { base, y0, alto: y1 - y0, r: Math.max(...base.map((p) => Math.hypot(p[0], p[2]))) });
}
// cenario.gd chao_da_peca
function chaoDaPeca(x, z, s, M) {
  const meio = relevo(x, z); let h = meio; const r = M.r * s;
  if (r > 0.05) for (let i = 0; i < 8; i++) { const a = Math.PI * 2 * i / 8; h = Math.min(h, relevo(x + Math.cos(a) * r, z + Math.sin(a) * r)); }
  return Math.max(h, meio - AFUNDA_MAX * M.alto * s) - ENTERRA * M.alto * s - Math.max(0, M.y0) * s;
}
// Godot: Basis(UP, ry) * Basis.from_euler(rx, 0, rz) (ordem YXZ) * escala
function noMundo(p, [vx, vy, vz], Y) {
  const s = p.s ?? 1, rx = p.rx || 0, rz = p.rz || 0;
  let x = vx * s, y = vy * s, z = vz * s;
  [x, y] = [x * Math.cos(rz) - y * Math.sin(rz), x * Math.sin(rz) + y * Math.cos(rz)];
  [y, z] = [y * Math.cos(rx) - z * Math.sin(rx), y * Math.sin(rx) + z * Math.cos(rx)];
  const c = Math.cos(p.ry || 0), sn = Math.sin(p.ry || 0);
  return [p.x + x * c + z * sn, Y + y, p.z - x * sn + z * c];
}
// quanto cada ponto fica acima do chão (positivo = no ar)
const folgas = (p, lista, Y) => lista.map((v) => { const [x, y, z] = noMundo(p, v, Y); return y - relevo(x, z); });
// pedras (e o que tem base larga e chata): a base INTEIRA precisa encostar, senão aparece o vão por baixo (encosta, beira
// de lago). As outras peças (cogumelo, planta, ruína, carroça torta) só precisam tocar o chão em algum ponto.
const BASE_INTEIRA = new Set(['rocha1', 'rocha2', 'rocha3', 'toco2', 'tronco_caido', 'fogueira']);
const folga = (p, M, Y) => (BASE_INTEIRA.has(p.m) ? Math.max(...folgas(p, M.base, Y)) : Math.min(...folgas(p, M.base, Y)));

const C = MAPA_CLAREIRA.cenario, T = new Simulacao(MAPA_CLAREIRA).terreno;
const pecas = [...C.pecas.map((p) => ({ ...p, de: 'marco' })), ...C.enfeites.map((p) => ({ ...p, de: 'enfeite' }))];
let falhas = 0, antes = 0;
const porModelo = {};
for (const p of pecas) {
  const M = modelo(p.m), y = p.y ?? 0, s = p.s ?? 1;
  const k = (porModelo[p.m] ||= { n: 0, ar: 0, antes: 0, pior: -Infinity });
  if (!(y > 0.1) && folga(p, M, T.altura(p.x, p.z) + y) > NO_AR) { antes++; k.antes++; }
  const Y = chaoDaPeca(p.x, p.z, s, M) + y, f = folga(p, M, Y);
  k.n++; k.pior = Math.max(k.pior, f);
  // pedaço de cogumelo/orelha-de-pau/tronco com y: de propósito acima do chão (em cima do tronco, grudado na árvore)
  if (f > NO_AR && !(y > 0.1)) { k.ar++; falhas++; if (falhas <= 15) console.error(`NO AR: ${p.de} ${p.m} em (${p.x}, ${p.z}) s ${s}: ${(f * 100).toFixed(1)} cm`); }
  const topo = Y + (M.y0 + M.alto) * s; // a peça não pode sumir no chão
  if (topo < relevo(p.x, p.z)) { falhas++; console.error(`ENTERRADA: ${p.de} ${p.m} em (${p.x}, ${p.z})`); }
}
for (const [m, k] of Object.entries(porModelo)) console.log(m.padEnd(14), String(k.n).padStart(5), 'peças, no ar antes:', String(k.antes).padStart(3), ' agora:', k.ar, ' pior folga da base:', (k.pior * 100).toFixed(1), 'cm');
console.log(`conta antiga (terreno.altura com o tampo de pulo): ${antes} de ${pecas.length} peças flutuavam`);
if (falhas) { console.error('FALHOU:', falhas, 'peças fora do chão'); process.exitCode = 1; } else console.log('ok: todas as', pecas.length, 'peças assentadas no chão');

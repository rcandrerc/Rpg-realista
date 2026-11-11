// Progressão até o Nv 100 (André 2026-11-10): missões principais em ordem (HISTORIA), zonas fechadas pela névoa
// (ZONAS) e o que abre por nível (LIBERA_NIVEL). Os dados ficam em shared/dados.js; aqui só as contas, que o servidor
// (shared/simulacao.js) usa para decidir e o exportador manda para o app (habilidades.json, chave "historia").
import { HISTORIA, ZONAS, LIBERA_NIVEL, RECURSOS_HISTORIA, CACA, TOTENS } from './dados.js';
import { LUGARES_MUNDO, TERRAS, dentroDaTerra } from './mundo.js';

// círculos de cada zona: { x, z, r } já com a folga (os veios do mundo perto de um campo da zona entram junto)
export const ZONAS_GEO = ZONAS.map((Z) => {
  const circulos = [];
  for (const id of Z.circulos || []) {
    const c = CACA.find((k) => k.id === id && !k.mundo), L = LUGARES_MUNDO.find((l) => l.id === id), t = TOTENS.lista.find((o) => o.id === id);
    const o = c || L || (t && { x: t.x, z: t.z, r: TOTENS.seguro });
    if (!o) throw new Error(`ZONAS ${Z.id}: não achei ${id}`);
    circulos.push({ x: o.x, z: o.z, r: +(o.r + (Z.folga || 0)).toFixed(1) });
    for (const m of LUGARES_MUNDO) if (m.tipo === 'mina' && m.perto === id) circulos.push({ x: m.x, z: m.z, r: +(m.r + (Z.folga || 0)).toFixed(1) });
  }
  const T = Z.terra && TERRAS.find((t) => t.id === Z.terra);
  if (Z.terra && !T) throw new Error(`ZONAS ${Z.id}: terra ${Z.terra}?`);
  return { id: Z.id, nome: Z.nome, circulos, terra: Z.terra || null, mar: Z.mar || 0, selo: !!Z.selo };
});
const ZONA_POR_ID = Object.fromEntries(ZONAS_GEO.map((z) => [z.id, z]));
// a missão que libera cada zona ou recurso
export const QUEM_LIBERA = {};
HISTORIA.forEach((M, i) => { for (const k of M.libera) QUEM_LIBERA[k] = i; });

// estado das missões da conta: { p: quantas já foram entregues, ac: aceitou a próxima, n: quanto já fez dela }
export const histNova = () => ({ p: 0, ac: false, n: 0 });
// personagem de antes da progressão (sem hist): as missões até o nível que ele já tem contam como feitas
export const histPorNivel = (nivel) => ({ p: HISTORIA.filter((M) => M.nv <= nivel).length, ac: false, n: 0 });
export function histValida(h, nivel) {
  if (!h || typeof h !== 'object') return histPorNivel(nivel);
  const p = Number.isInteger(h.p) ? Math.max(0, Math.min(HISTORIA.length, h.p)) : 0;
  const M = HISTORIA[p], max = M ? (M.matar?.n || Object.values(M.entregar || {}).reduce((a, n) => a + n, 0) || 1) : 0;
  return { p, ac: !!M && h.ac === true, n: M && Number.isInteger(h.n) ? Math.max(0, Math.min(max, h.n)) : 0 };
}
const histDe = (p) => p.hist || histNova();
// a zona ou o recurso k já está liberado para a conta p?
export const liberado = (p, k) => QUEM_LIBERA[k] == null || histDe(p).p > QUEM_LIBERA[k];
// a missão atual (a próxima a fazer) ou null (todas feitas)
export const missaoAtual = (p) => HISTORIA[histDe(p).p] || null;
// quanto falta na missão atual
export const totalMissao = (M) => M.matar ? M.matar.n : Object.values(M.entregar || {}).reduce((a, n) => a + n, 0);

// (x, z) dentro da zona Z? (círculos ou a terra inteira com um pouco de mar em volta)
export function naZona(Z, x, z) {
  if (Z.terra) return dentroDaTerra(TERRAS.find((t) => t.id === Z.terra), x, z) > -Z.mar;
  for (const c of Z.circulos) if (Math.abs(c.x - x) < c.r && Math.abs(c.z - z) < c.r && Math.hypot(c.x - x, c.z - z) < c.r) return true;
  return false;
}
// a zona fechada (ainda na névoa) para a conta p em (x, z), ou null. A caverna (selo) o servidor confere à parte.
export function zonaFechadaEm(p, x, z) {
  for (const Z of ZONAS_GEO) if (!Z.selo && !liberado(p, Z.id) && naZona(Z, x, z)) return Z;
  return null;
}
export const zonaPorId = (id) => ZONA_POR_ID[id] || null;
// aviso de quando chega na névoa: qual missão abre e com quem
export function textoNevoa(p, k) {
  const i = QUEM_LIBERA[k], M = HISTORIA[i]; if (!M) return '';
  const nome = ZONA_POR_ID[k]?.nome || RECURSOS_HISTORIA[k] || k;
  return `${ZONA_POR_ID[k] ? 'Névoa encantada: ' : ''}${nome} abre com a missão "${M.nome}" (Nv ${M.nv})`;
}

// Por que a conta p ainda não pode (texto) ou '' se pode. tipo: 'receita' | 'obra' | 'evoluir' | 'carrinho' | 'terreno' |
// 'pack' | 'reforcar' | 'alquimia' | 'forja' | 'lobo' | 'pesca'; k: a receita, a obra ou o nível (evoluir, carrinho).
export function motivoLibera(p, tipo, k) {
  if (RECURSOS_HISTORIA[tipo]) return liberado(p, tipo) ? '' : `Ainda não liberado: ${textoNevoa(p, tipo)}`;
  const L = LIBERA_NIVEL[tipo];
  const nv = typeof L === 'number' ? L : Array.isArray(L) ? L[k] : L?.[k];
  return nv && p.nivel < nv ? `Libera no nível ${nv}` : '';
}
// o que abre ao chegar no nível nv (para a festa de subir de nível): lista de textos
export function liberaNoNivel(nv, nomes = {}) {
  const out = [], L = LIBERA_NIVEL, nome = (k) => nomes[k] || k;
  for (const [k, n] of Object.entries(L.receita)) if (n === nv) out.push(nome(k));
  for (const [k, n] of Object.entries(L.obra)) if (n === nv) out.push(nome(k));
  const RAR = ['', 'Raro', 'Épico', 'Lendário', 'Mítico'];
  L.evoluir.forEach((n, r) => { if (r && n === nv) out.push(`evoluir para ${RAR[r]}`); });
  L.carrinho.forEach((n, r) => { if (r > 1 && n === nv) out.push(`carrinho nível ${r}`); });
  for (const [k, txt] of [['terreno', 'comprar terreno'], ['pack', 'fazer packs'], ['reforcar', 'reforçar equipamento'], ['alquimia', 'a alquimista Mirela']]) if (L[k] === nv) out.push(txt);
  return out;
}
// o que vai para o app (habilidades.json): zonas com os círculos, missões e níveis
// contorno da névoa de uma zona de terra inteira (onde dentroDaTerra = -mar), para o app desenhar a parede de névoa e
// a mancha no mapa: a ilha fecha em volta; o continente é uma linha de ponta a ponta do mundo
export function contornoTerra(Z) {
  const T = TERRAS.find((t) => t.id === Z.terra), pts = [];
  if (T.forma) { for (let x = -560; x <= 960; x += 8) { let z = T.forma === 'sul' ? 700 : 600; for (let k = 0; k < 60; k++) { const d = dentroDaTerra(T, x, z) + Z.mar; z += (T.forma === 'sul' ? -d : d) * 0.9; } pts.push([x, +z.toFixed(1)]); } return pts; }
  for (let i = 0; i < 160; i++) { // raio em cada direção pela busca binária (a borda ondulada não é elipse certa)
    const a = (i / 160) * Math.PI * 2; let lo = 0, hi = Math.max(T.rx, T.rz) * 2;
    for (let k = 0; k < 30; k++) { const r = (lo + hi) / 2; if (dentroDaTerra(T, T.x + Math.cos(a) * r, T.z + Math.sin(a) * r) > -Z.mar) lo = r; else hi = r; }
    pts.push([+(T.x + Math.cos(a) * lo).toFixed(1), +(T.z + Math.sin(a) * lo).toFixed(1)]);
  }
  return pts;
}
export const historiaParaApp = () => ({
  zonas: ZONAS_GEO.map((Z) => (Z.terra ? { ...Z, contorno: contornoTerra(Z), fechado: !TERRAS.find((t) => t.id === Z.terra).forma, forma: TERRAS.find((t) => t.id === Z.terra).forma || null } : Z)), missoes: HISTORIA.map((M) => ({ id: M.id, nv: M.nv, npc: M.npc, nome: M.nome, libera: M.libera, total: totalMissao(M), matar: M.matar || null, entregar: M.entregar || null })),
  libera: LIBERA_NIVEL, recursos: RECURSOS_HISTORIA,
});

// Progressão até o Nv 100 (André 2026-11-10): missões principais em ordem (HISTORIA), zonas fechadas pela névoa
// (ZONAS) e o que abre por nível (LIBERA_NIVEL). Os dados ficam em shared/dados.js; aqui só as contas, que o servidor
// (shared/simulacao.js) usa para decidir e o exportador manda para o app (habilidades.json, chave "historia").
import { HISTORIA, ZONAS, LIBERA_NIVEL, RECURSOS_HISTORIA, MAPA_CLAREIRA } from './dados.js';
import { LUGARES_MUNDO, TERRAS, dentroDaTerra } from './mundo.js';
import { REGIOES_POLIGONOS } from './regioes.js';

// as zonas como o servidor e o app usam: região (polígono), terra inteira ou o selo da caverna
export const ZONAS_GEO = ZONAS.map((Z) => {
  const T = Z.terra && TERRAS.find((t) => t.id === Z.terra);
  if (Z.terra && !T) throw new Error(`ZONAS ${Z.id}: terra ${Z.terra}?`);
  const pol = Z.poligono || (Z.regiao ? REGIOES_POLIGONOS[Z.id] : null);
  if (!Z.terra && !Z.selo && !(pol?.length >= 3)) throw new Error(`ZONAS ${Z.id}: sem polígono (rode ferramentas/regioes/gerar.mjs)`);
  return { id: Z.id, nome: Z.nome, poligono: pol || null, terra: Z.terra || null, mar: Z.mar || 0, selo: !!Z.selo };
});
// caixa e faixas de cada polígono (as regiões redondas têm centenas de pontos e o servidor pergunta a cada passo de cada
// herói e monstro): só olha as arestas da faixa de FAIXA m onde o ponto está. Mesma resposta do noPoligono.
const FAIXA = 8;
const CAIXA = new Map(ZONAS_GEO.filter((Z) => Z.poligono).map((Z) => {
  const P = Z.poligono, xs = P.map((q) => q[0]), zs = P.map((q) => q[1]), z0 = Math.min(...zs), faixas = [];
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const a = Math.floor((Math.min(P[i][1], P[j][1]) - z0) / FAIXA), b = Math.floor((Math.max(P[i][1], P[j][1]) - z0) / FAIXA);
    for (let k = a; k <= b; k++) (faixas[k] ||= []).push(P[i][0], P[i][1], P[j][0], P[j][1]);
  }
  return [Z, { x0: Math.min(...xs), x1: Math.max(...xs), z0, z1: Math.max(...zs), faixas }];
}));
function naFaixa(c, x, z) {
  const L = c.faixas[Math.floor((z - c.z0) / FAIXA)]; if (!L) return false;
  let d = false;
  for (let k = 0; k < L.length; k += 4) { const xi = L[k], zi = L[k + 1], xj = L[k + 2], zj = L[k + 3]; if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) d = !d; }
  return d;
}
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

// (x, z) dentro do polígono P ([[x, z], ...])?
export function noPoligono(P, x, z) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
    const [xi, zi] = P[i], [xj, zj] = P[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
  }
  return c;
}
// (x, z) dentro da zona Z? (a região ou a terra inteira com um pouco de mar em volta)
export function naZona(Z, x, z) {
  if (Z.terra) return dentroDaTerra(TERRAS.find((t) => t.id === Z.terra), x, z) > -Z.mar;
  const c = CAIXA.get(Z); if (c) return x >= c.x0 && x <= c.x1 && z >= c.z0 && z <= c.z1 && naFaixa(c, x, z);
  return !!Z.poligono && noPoligono(Z.poligono, x, z);
}
// a zona fechada (ainda na névoa) para a conta p em (x, z), ou null. A caverna (selo) o servidor confere à parte.
export function zonaFechadaEm(p, x, z) {
  for (const Z of ZONAS_GEO) if (!Z.selo && !liberado(p, Z.id) && naZona(Z, x, z)) return Z;
  return null;
}
export const zonaPorId = (id) => ZONA_POR_ID[id] || null;
// aviso de quando chega na névoa: qual missão abre e com quem
// nome da região ou do recurso k (para o "Liberado: ...")
export const nomeLibera = (k) => ZONA_POR_ID[k]?.nome || RECURSOS_HISTORIA[k] || k;
export const nomeNpcHistoria = (id) => (MAPA_CLAREIRA.npcs.find((n) => n.id === id)?.nome || id).split(',')[0];
// André 2026-11-11: "quando tentar entrar numa área que não tá liberada, falar concluir tal missão para desbloquear"
export function textoNevoa(p, k) {
  const i = QUEM_LIBERA[k], M = HISTORIA[i]; if (!M) return '';
  const nome = ZONA_POR_ID[k]?.nome || RECURSOS_HISTORIA[k] || k;
  return `${ZONA_POR_ID[k] ? 'Região fechada' : 'Ainda fechado'}: ${nome}. Conclua a missão "${M.nome}" (fale com ${nomeNpcHistoria(M.npc)}, Nv ${M.nv}) para desbloquear`;
}

// Por que a conta p ainda não pode (texto) ou '' se pode. tipo: 'receita' | 'obra' | 'evoluir' | 'carrinho' | 'terreno' |
// 'pack' | 'reforcar' | 'alquimia' | 'forja' | 'lobo' | 'pesca'; k: a receita, a obra ou o nível (evoluir, carrinho).
export function motivoLibera(p, tipo, k) {
  if (RECURSOS_HISTORIA[tipo]) return liberado(p, tipo) ? '' : textoNevoa(p, tipo);
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
// o app recebe toda zona como polígono (a ilha vira o contorno da névoa no mar em volta dela)
export const historiaParaApp = () => ({
  zonas: ZONAS_GEO.map((Z) => (Z.terra ? { ...Z, poligono: contornoTerra(Z) } : Z)),
  missoes: HISTORIA.map((M) => ({ id: M.id, nv: M.nv, npc: M.npc, npcNome: nomeNpcHistoria(M.npc), nome: M.nome, libera: M.libera, total: totalMissao(M), matar: M.matar || null, entregar: M.entregar || null })),
  libera: LIBERA_NIVEL, recursos: RECURSOS_HISTORIA,
});

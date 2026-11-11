// Progressão até o Nv 100 (André 2026-11-10): missões principais em ordem (HISTORIA), zonas fechadas pela névoa
// (ZONAS) e o que abre por nível (LIBERA_NIVEL). Os dados ficam em shared/dados.js; aqui só as contas, que o servidor
// (shared/simulacao.js) usa para decidir e o exportador manda para o app (habilidades.json, chave "historia").
import { HISTORIA, ZONAS, LIBERA_NIVEL, RECURSOS_HISTORIA, MAPA_CLAREIRA, CAPITULOS } from './dados.js';
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

// ---------- missões com etapas (história v2, André 2026-11-11) ----------
// As etapas de cada missão, já com a volta ao NPC no fim (a não ser que a última etapa seja falar com alguém).
// Missão antiga de uma etapa (matar: { n, campos, tipos }) vira [matar, voltar].
const nomeCurto = (id) => (MAPA_CLAREIRA.npcs.find((n) => n.id === id)?.nome || id).split(',')[0];
const ETAPAS = new Map();
export function etapasDe(M) {
  let L = ETAPAS.get(M); if (L) return L;
  L = (M.etapas || (M.matar ? [{ ev: 'matar', ...M.matar, txt: `Derrube ${M.matar.n === 1 ? 'o chefe' : 'monstros'} nos campos pedidos` }] : [])).map((E) => ({ n: 1, ...E }));
  if (L.at(-1)?.ev !== 'falar') L.push({ ev: 'falar', npc: M.npc, n: 1, volta: true, txt: `Volte e fale com ${nomeCurto(M.npc)}` });
  ETAPAS.set(M, L);
  return L;
}
// a etapa casa com o que aconteceu? devolve quanto conta (0 = não casa). d: o que o servidor sabe da ação.
export function casaEtapa(E, ev, d = {}) {
  if (!E || E.ev !== ev) return 0;
  if (E.npc && d.npc !== E.npc) return 0;
  if (E.k && ![].concat(E.k).includes(d.k)) return 0;
  if (E.campos && !E.campos.includes(d.campo)) return 0;
  if (E.tipos && !E.tipos.includes(d.tipo)) return 0;
  if (E.hc && d.hc !== E.hc) return 0;
  if (E.de && d.de !== E.de) return 0;
  if (E.skill && !d.skill) return 0;
  if (E.barco && !d.barco) return 0;
  if (E.min != null && !(d.v >= E.min)) return 0;
  if (d.ok === false) return 0;
  return Math.max(1, d.n | 0);
}
// capítulo da missão M e se M é a primeira / a última dele
export const capituloDe = (M) => CAPITULOS.find((c) => c.n === M?.cap) || null;
export const primeiraDoCap = (i) => !!HISTORIA[i] && (i === 0 || HISTORIA[i - 1].cap !== HISTORIA[i].cap);
export const ultimaDoCap = (i) => !!HISTORIA[i] && (i === HISTORIA.length - 1 || HISTORIA[i + 1].cap !== HISTORIA[i].cap);
// o capítulo n já terminou para quem já entregou p missões?
export const capFeito = (n, p) => HISTORIA.slice(0, p).some((M) => M.cap === n) && !HISTORIA.slice(p).some((M) => M.cap === n);
// a missão que libera cada zona ou recurso
export const QUEM_LIBERA = {};
HISTORIA.forEach((M, i) => { for (const k of M.libera) QUEM_LIBERA[k] = i; });

// estado das missões da conta: { v: 2, p: quantas já foram entregues, ac: aceitou a próxima, e: etapa da vez,
// n: quanto já fez da etapa, m: pistas já vistas (bits) }
export const histNova = () => ({ v: 2, p: 0, ac: false, e: 0, n: 0, m: 0 });
// personagem de antes da progressão (sem hist): as missões até o nível que ele já tem contam como feitas
export const histPorNivel = (nivel) => ({ ...histNova(), p: HISTORIA.filter((M) => M.nv <= nivel).length });
// conta da história de antes (h1 a h15, sem v): a missão que abria a mesma coisa conta como a última feita
const ANTIGA = { h1: 'a3', h2: 'a4', h3: 'a9', h4: 'a11', h5: 'a16' };
const ANTIGAS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'h7', 'h8', 'h9', 'h10', 'h11', 'h12', 'h13', 'h14', 'h15'];
export function histValida(h, nivel) {
  if (!h || typeof h !== 'object') return histPorNivel(nivel);
  let p = Number.isInteger(h.p) ? Math.max(0, h.p) : 0;
  if (h.v !== 2) { // conta da história de antes: migra (a missão que estava fazendo começa de novo)
    const id = p > 0 ? ANTIGAS[Math.min(p, ANTIGAS.length) - 1] : null;
    p = id ? HISTORIA.findIndex((M) => M.id === (ANTIGA[id] || id)) + 1 : 0;
    return { ...histNova(), p: Math.max(0, Math.min(HISTORIA.length, p)) };
  }
  p = Math.min(HISTORIA.length, p);
  const M = HISTORIA[p], L = M ? etapasDe(M) : [], ac = !!M && h.ac === true;
  const e = ac && Number.isInteger(h.e) ? Math.max(0, Math.min(L.length - 1, h.e)) : 0, E = L[e];
  const max = E ? (E.itens ? Object.values(E.itens).reduce((a, n) => a + n, 0) : E.pontos ? E.pontos.length : E.n || 1) : 0;
  return { v: 2, p, ac, e, n: ac && Number.isInteger(h.n) ? Math.max(0, Math.min(max, h.n)) : 0, m: ac && Number.isInteger(h.m) ? h.m & 0xffff : 0 };
}
const histDe = (p) => p.hist || histNova();
// a zona ou o recurso k já está liberado para a conta p? (liberaNaEtapa: o recurso abre no meio da própria missão)
export function liberado(p, k) {
  const i = QUEM_LIBERA[k]; if (i == null) return true;
  const h = histDe(p); if (h.p > i) return true;
  const M = HISTORIA[i];
  return h.p === i && h.ac === true && M.liberaNaEtapa != null && (h.e || 0) >= M.liberaNaEtapa;
}
// a missão atual (a próxima a fazer) ou null (todas feitas)
export const missaoAtual = (p) => HISTORIA[histDe(p).p] || null;
// a etapa da vez (só com a missão aceita) ou null
export function etapaAtual(p) {
  const h = histDe(p), M = HISTORIA[h.p]; if (!M || !h.ac) return null;
  return etapasDe(M)[h.e || 0] || null;
}
// quantas etapas tem a missão (o app mostra "etapa 2 de 5")
export const totalMissao = (M) => etapasDe(M).length;
// quanto a etapa pede (para o "3/6")
export const totalEtapa = (E) => (E.itens ? Object.values(E.itens).reduce((a, n) => a + n, 0) : E.pontos ? E.pontos.length : E.n || 1);

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
  missoes: HISTORIA.map((M) => ({ id: M.id, cap: M.cap, nv: M.nv, npc: M.npc, npcNome: nomeNpcHistoria(M.npc), nome: M.nome, libera: M.libera,
    liberaNaEtapa: M.liberaNaEtapa ?? -1, total: totalMissao(M), etapas: etapasDe(M).map((E) => E.txt) })),
  capitulos: CAPITULOS.map((c) => ({ n: c.n, nome: c.nome, nv: c.nv, ato: c.ato, frase: c.frase, diario: c.diario || '', rumores: c.rumores || [] })),
  libera: LIBERA_NIVEL, recursos: RECURSOS_HISTORIA,
});

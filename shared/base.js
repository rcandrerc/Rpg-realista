// Base do clã (André 2026-11-22: "já pode implantar o lance da base aí o aluguel n vai existir e sim as taxas do clã").
// Cada clã (jogador ou bot, Geada ou Chama: as mesmas regras) tem uma base no mapa. O líder funda onde está (painel do
// Clã). No meio, o centro: o salão do clã com o Baú do Clã na porta; cresce com o nível do clã (torre de vigia, paliçada,
// forja, salão grande, castelo). Em volta, os lotes de 10 x 10 m (CLA.base.lugares): o 1 é do líder. Sem aluguel: a taxa
// do clã sai do cofre toda semana; atrasada CLA.base.taxaTrava semanas, os lotes e o Baú do Clã travam até pagar.
// Onde não pode (motivoBase): perto de totem, vila, estrada, rio, cais, campo de caça, veio, arena, NPC, na água, em
// barranco, fora do território da raça (nas terras do começo) e perto de outra base (CLA.base.distMin, contando a base
// já no Nv 6).
// Estado (tabela mundo 'bases_cla'): { [k]: { k, x, z, raca, n (nome do clã), dono (conta do líder ou 'npc:' + id),
// nomeDono, nv, taxa (ms: semanas pagas até aqui), c (ms) } }. k = 'j' + conta (jogador) ou 'n' + id (clã bot).
import { CLA, TOTENS, VILAS_MUNDO, VILAS_TERRENO, VILA_LOTES, MAPA_CLAREIRA, AREAS_BASE, AREAS_SEGURAS_BASE, CLAS_NPC, fixosNpc, RACAS, AMIGOS_VIRTUAIS, RIVAIS, precoTerreno, BAU, bauLugares, PLANTIO, NPC_CASA_BASE, JANTAR } from './dados.js';
import { guardar } from './progresso.js';
import { zonaFechadaEm } from './historia.js';
import { areaPlantio } from './plantio.js';
import { MODELOS_VILA, naPeca } from './vilas.js';
import { LUGARES_MUNDO, ESTRADAS_MUNDO, RIOS_MUNDO, ARENAS_BOSS, ARENA_PVP, terraEm } from './mundo.js';
import { alturaMontanha, alturaMontanhaOrig, gradeOrigEm, noLago, gradeDoMundo, AGUA } from './relevo.js';
import { nivelDaBase, caminhoDaBase, chaoDasBases, TERRAPLENO } from './terrapleno.js';

const B_ = () => CLA.base;
export const nivelBase = (nv) => B_().niveis[Math.max(1, Math.min(B_().niveis.length - 1, nv | 0))];
const chao = (x, z) => Math.max(0, alturaMontanha(x, z));
const r2 = (v) => +v.toFixed(2);

// de quem é o chão: 'chama' ou 'geada' nas terras do começo (Vael), 'livre' na Ilha do Meio e em Aurora, null no mar
export function territorioDe(x, z) {
  const G = gradeDoMundo(), T = G ? terraEm(G, x, z) : null;
  if (!T) return G ? null : (x < B_().divisa ? 'chama' : 'geada');
  if (T.id === 'vael') return x < B_().divisa ? 'chama' : 'geada';
  return 'livre';
}

// o que nenhuma base pode pegar: círculos (x, z, r = até onde a base não pode chegar) e linhas (estradas e rios)
let PROIBIDO = null;
function proibido() {
  if (PROIBIDO) return PROIBIDO;
  const P = B_(), circ = [];
  for (const t of TOTENS.lista) circ.push({ x: t.x, z: t.z, r: P.totem, nome: 'um totem' });
  for (const V of VILAS_MUNDO) circ.push({ x: V.x, z: V.z, r: (V.raio || 30) + P.vila, nome: V.nome || 'uma vila' });
  for (const V of VILAS_TERRENO) circ.push({ x: V.area.x, z: V.area.z, r: Math.max(V.area.rx, V.area.rz) + P.vila, nome: V.nome });
  const praca = MAPA_CLAREIRA.vila?.praca; if (praca) circ.push({ x: praca.x, z: praca.z, r: 45 + P.vila, nome: 'a Vila da Clareira' });
  for (const l of LUGARES_MUNDO) circ.push({ x: l.x, z: l.z, r: l.r + (l.tipo === 'vila' ? P.vila : P.lugar), nome: l.nome || (l.tipo === 'caca' ? 'um campo de caça' : 'um lugar do mapa') });
  for (const l of [...(MAPA_CLAREIRA.caca || []), ...(MAPA_CLAREIRA.mina || [])]) circ.push({ x: l.x, z: l.z, r: (l.r || 8) + P.lugar, nome: l.nome || 'um campo' });
  for (const l of MAPA_CLAREIRA.veios || []) circ.push({ x: l.x, z: l.z, r: 3, nome: 'um veio' });
  for (const a of [...ARENAS_BOSS, ARENA_PVP]) circ.push({ x: a.x, z: a.z, r: a.r + P.lugar, nome: 'uma arena' });
  for (const n of MAPA_CLAREIRA.npcs || []) circ.push({ x: n.x, z: n.z, r: P.npc, nome: n.nome || 'um NPC' });
  for (const c of MAPA_CLAREIRA.cais || []) circ.push({ x: c.x, z: c.z, r: c.d / 2 + P.lugar, nome: 'o cais' });
  const linhas = [
    ...ESTRADAS_MUNDO.map((e) => ({ l: e.curva || e.pontos, r: 2 + P.estrada, nome: 'a estrada' })),
    { l: MAPA_CLAREIRA.estrada || [], r: 1.5 + P.estrada, nome: 'a estrada' },
    { l: VILA_LOTES.estrada || [], r: 1.5 + P.estrada, nome: 'a estrada' },
    ...RIOS_MUNDO.map((r) => ({ l: r.curva || r.pontos, r: 8 + P.rio, nome: r.nome || 'o rio' })),
  ].filter((o) => o.l?.length);
  PROIBIDO = { circ, linhas };
  return PROIBIDO;
}
// "de um totem", "da estrada", "do Rio Claro"
const deLugar = (n) => (/^a /.test(n) ? 'da ' + n.slice(2) : /^o /.test(n) ? 'do ' + n.slice(2) : /^(Rio|Cais|Porto|Posto|Covil|Veio|Bairro) /.test(n) ? 'do ' + n : 'de ' + n);
const distSeg = (x, z, [ax, az], [bx, bz]) => {
  const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0;
  return Math.hypot(x - ax - t * dx, z - az - t * dz);
};

// os retângulos da base inteira (o centro no Nv 6 e os 6 lotes), a partir do centro
export function retangulosBase(x, z) {
  const P = B_(), hc = P.niveis[P.niveis.length - 1].centro / 2, h = P.lote / 2;
  return [{ x0: x - hc, z0: z - hc, x1: x + hc, z1: z + hc, centro: true }, ...P.lugares.map(([dx, dz]) => ({ x0: x + dx - h, z0: z + dz - h, x1: x + dx + h, z1: z + dz + h }))];
}

// por que a base não pode ficar em (x, z) ('' = pode). raca: a do líder; outras: as bases que já existem (menos a dele)
export function motivoBase(x, z, raca, outras = []) {
  const P = B_();
  const t = territorioDe(x, z);
  if (!t) return 'Aqui é água: procure terra firme';
  if (t !== 'livre' && raca && t !== raca) return `Aqui é território da ${RACAS[t]?.nome || t}. Nas terras do começo, só no território da sua raça (Ilha do Meio e Aurora são livres)`;
  for (const o of outras) { const d = Math.hypot(o.x - x, o.z - z); if (d < P.distMin) return `Muito perto da base ${o.n ? 'do clã ' + o.n : 'de outro clã'} (${Math.round(d)} m; o mínimo é ${P.distMin} m)`; }
  // a distância conta do desenho de verdade da base no Nv 6 (o centro e os 6 lotes), não de um círculo em volta dela
  // (André 2026-11-22: "n existe lugar nenhum possível"): o vão entre os lotes pode chegar perto de estrada, rio etc.
  const { circ, linhas } = proibido(), rets = retangulosBase(x, z);
  const ateRet = (px, pz) => Math.min(...rets.map((R) => Math.hypot(Math.max(R.x0 - px, 0, px - R.x1), Math.max(R.z0 - pz, 0, pz - R.z1))));
  for (const c of circ) if (Math.hypot(c.x - x, c.z - z) < c.r + P.pegada && ateRet(c.x, c.z) < c.r) return `Muito perto ${deLugar(c.nome)}`;
  for (const L of linhas) {
    for (let i = 1; i < L.l.length; i++) {
      const a = L.l[i - 1], b = L.l[i];
      if (distSeg(x, z, a, b) >= L.r + P.pegada) continue;
      const n = Math.max(1, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / 1.5));
      for (let k = 0; k <= n; k++) if (ateRet(a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n) < L.r) return `Muito perto ${deLugar(L.nome)}`;
    }
  }
  // nada em cima: pedra grande, ruína ou área de plantio. As árvores nativas de dentro saem enquanto a base existir
  // (arvoresDaBase): a base é a clareira do clã
  const dentro = (px, pz, f) => rets.some((R) => px > R.x0 - f && px < R.x1 + f && pz > R.z0 - f && pz < R.z1 + f);
  for (const r of MAPA_CLAREIRA.rochas || []) if (dentro(r.x, r.z, 2 + 2 * (r.s || 1))) return 'Tem pedra grande no meio: procure outro lugar';
  for (const o of MAPA_CLAREIRA.cenario?.solidos || []) if (Math.abs(o.x - x) < P.pegada + 3 && Math.abs(o.z - z) < P.pegada + 3 && dentro(o.x, o.z, o.r + 0.5)) return 'Tem ruína ou pedra no meio: procure outro lugar';
  // área de plantio pode (André 2026-11-22: "n existe lugar nenhum possível"): a base fica com o chão e ninguém
  // planta dentro dela (shared/plantio.js)
  // chão: terra firme (sem lago nem mar) e sem barranco no centro e em cada lote
  const G = gradeDoMundo();
  // o chão da base é nivelado (shared/terrapleno.js), menos onde a grade do mundo não mexe (mapa de hoje, morro dele e
  // a areia da beira): aí vale o desnível de antes (desnivelFixo)
  let fixo = false;
  for (let a = -TERRAPLENO.meio; a <= TERRAPLENO.meio && !fixo; a += 4) for (let b = -TERRAPLENO.meio; b <= TERRAPLENO.meio; b += 4) if (gradeOrigEm(x + a, z + b) < 0.6) { fixo = true; break; }
  const lim = fixo ? P.desnivelFixo : P.desnivel;
  for (const R of retangulosBase(x, z)) {
    let lo = Infinity, hi = -Infinity;
    for (let a = R.x0; a <= R.x1 + 0.01; a += 2) for (let b = R.z0; b <= R.z1 + 0.01; b += 2) {
      if (noLago(a, b) || (G && !terraEm(G, a, b))) return 'Tem água no meio: procure outro lugar';
      const h = alturaMontanhaOrig(a, b); // o chão de antes (o das bases é nivelado: shared/terrapleno.js)
      if (h < AGUA.nivel + 0.6) return 'Muito perto da água: procure outro lugar';
      if (h < lo) lo = h; if (h > hi) hi = h;
    }
    if (hi - lo > (R.centro ? lim.centro : lim.lote)) return `Chão muito torto ${R.centro ? 'no centro' : 'num dos lotes'} (${(hi - lo).toFixed(1)} m de desnível): procure um lugar mais plano`;
  }
  return '';
}

// procura um lugar perto de (x0, z0) (clã bot: em volta da vila da raça). Anéis de 10 m até `ate` m
export function acharLugarBase(x0, z0, raca, outras, ate = 700) {
  for (let r = 60; r <= ate; r += 10) {
    const n = Math.max(8, Math.round(2 * Math.PI * r / 14));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 2 * Math.PI, x = Math.round(x0 + Math.cos(a) * r), z = Math.round(z0 + Math.sin(a) * r);
      if (!motivoBase(x, z, raca, outras)) return { x, z };
    }
  }
  return null;
}

// o desenho da base no nível nv: as peças (modelos da vila, vilas.glb), os sólidos (como as casas das vilas), o Baú do
// Clã (ponto), a forja (ponto) e os lotes abertos. Mesma conta no servidor e no app (vai pronta no evento 'bases').
// as árvores nativas (mata) dentro da base (o centro no Nv 6 e os 6 lotes, com 1,5 m de folga): [id, x, z]
export function arvoresDaBase(x, z) {
  const P = B_(), rets = retangulosBase(x, z), l = [];
  (MAPA_CLAREIRA.mata || []).forEach((t, i) => {
    if (Math.abs(t.x - x) > P.pegada + 3 || Math.abs(t.z - z) > P.pegada + 3) return;
    if (rets.some((R) => t.x > R.x0 - 1.5 && t.x < R.x1 + 1.5 && t.z > R.z0 - 1.5 && t.z < R.z1 + 1.5)) l.push(['m' + (t.n ?? i), t.x, t.z]);
  });
  return l;
}

export function montarBase(B) {
  const P = B_(), nv = Math.max(1, Math.min(P.niveis.length - 1, B.nv | 0)), N = P.niveis[nv], h = N.centro / 2, x0 = B.x, z0 = B.z;
  const pecas = [], sol = [];
  const alto = (lx, lz, w, d) => r2(Math.max(...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => chao(x0 + lx + a * (w / 2 + 0.3), z0 + lz + b * (d / 2 + 0.3)))));
  const baixo = (lx, lz, r) => r2(Math.min(...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => chao(x0 + lx + a * r, z0 + lz + b * r))));
  const caixa = (x, z, ry, hw, hd, y1, sobe = 0) => sol.push({ casa: true, x: r2(x), z: r2(z), cos: Math.cos(ry), sen: Math.sin(ry), hw, hd, sobe, y1: r2(y1), base: 0, R: r2(Math.hypot(hw, hd)) });
  // casa (modelo da vila): o retângulo das paredes vira peça sólida, girada 90 graus como nas vilas (dados.js)
  const casa = (m, lx, lz, ry = 0) => {
    const M = MODELOS_VILA[m], y = alto(lx, lz, M.w, M.d), c = { m, x: r2(x0 + lx), z: r2(z0 + lz), ry, y };
    pecas.push(c);
    if (M.aberta) { // forja aberta: piso de pedra e muro do fundo
      const [px, pz] = naPeca(c, 0, 0), [mx, mz] = naPeca(c, 0, -M.d / 2 + 0.15);
      caixa(px, pz, ry, M.w / 2 + 0.1, M.d / 2 + 0.1, y + 0.03); caixa(mx, mz, ry, M.w / 2, 0.2, y + 3.1);
    } else if (M.portao) for (const sx of [-4, 4]) { const [px, pz] = naPeca(c, sx, 0); caixa(px, pz, ry, 1, 1, y + 6); }
    else caixa(c.x, c.z, ry + Math.PI / 2, M.d / 2, M.w / 2, y + M.alto, M.sobe || 0);
    return c;
  };
  // enfeite (barris, estandarte, fogueira...): no chão mais baixo, sólido pequeno
  const enfeite = (m, lx, lz, ry = 0, solido = true) => {
    const M = MODELOS_VILA[m], r = M.r || 0.5, y = baixo(lx, lz, r), c = { m, x: r2(x0 + lx), z: r2(z0 + lz), ry: r2(ry), y };
    pecas.push(c);
    if (solido) caixa(c.x, c.z, 0, Math.max(0.15, r * 0.75), Math.max(0.15, r * 0.75), y + (M.alto || 2.2));
    return c;
  };
  // o salão: Nv 1-2 casa de pedra, Nv 3-4 sobrado, Nv 5 salão grande (pousada de Aurora), Nv 6 castelo (paço de Aurora)
  const salao = nv >= 6 ? 'aurora_paco' : nv >= 5 ? 'aurora_pousada' : nv >= 3 ? 'sobrado_6x6' : 'pedra_6x6';
  const S = MODELOS_VILA[salao], sz = -h + 1 + S.d / 2;
  casa(salao, 0, sz);
  // o Baú do Clã na frente da porta (o app desenha o baú do clã de construcao.gd), estandartes dos lados
  // o Baú do Clã nasce na porta do salão; o líder pode recolher e pôr onde quiser (B.bauSolto: vira a peça bau_cla do
  // lote 1, André 2026-11-23: "seja possível editar o local do baú do clã"). frente = o lugar de antes (casinha, rota)
  const bz = sz + S.d / 2 + 1.4, frente = { x: r2(x0), z: r2(z0 + bz), y: r2(chao(x0, z0 + bz)) }, bau = B.bauSolto ? null : frente;
  if (bau) caixa(bau.x, bau.z, 0, 0.65, 0.4, bau.y + 0.69);
  for (const s of [-1, 1]) enfeite('estandarte', s * (S.w / 2 + 0.8), sz + S.d / 2 + 0.4);
  // a fogueira do meio saiu (André 2026-11-23: "tira essa fogueira... impede eu de construir em volta")
  enfeite('barris', S.w / 2 + 1.6, sz - S.d / 4);
  enfeite('caixotes', -(S.w / 2 + 1.7), sz - S.d / 4);
  if (nv >= 2) casa('aurora_torre', h - 3, h - 3); // torre de vigia no canto da frente (atrás não cabe com o salão)
  // a Mesa do Clã (André 2026-11-25: "aumentar aquela mesa ali do clã... bastante, pra que dê um clã inteiro"): no lugar
  // da mesinha de antes (Nv 2+), agora desde o Nv 1, à esquerda da frente do salão, com 8 lugares (JANTAR.lugares). O app
  // desenha (godot-prototipo/construcao.gd mesa_cla); só o tampo é sólido. Recolhida (Mudar de lugar, B.mesaSolta), vira a
  // peça mesa_cla do lote 1, como o Baú do Clã
  let mesa = null;
  if (!B.mesaSolta) {
    const mx = -(h - 3.3), mz = Math.min(h - 1.6, bz + 2.8);
    mesa = { x: r2(x0 + mx), z: r2(z0 + mz), ry: 0, y: baixo(mx, mz, 2.4) };
    caixa(mesa.x, mesa.z, 0, 1.8, 0.55, mesa.y + 0.78);
  }
  let forja = null;
  if (nv >= 4) {
    // André 2026-11-23 ("a bigorna está dentro da casinha"; "o fogão sumiu de novo"): a fornalha fica no fundo do galpão
    // e a bigorna na frente dele, do lado de fora (o galpão abre para +z)
    const c = casa('forja', -h + 3.2, -h + 3.2);
    forja = { x: c.x, z: r2(c.z + 3.3), fx: c.x, fz: r2(c.z - 0.7) };
    caixa(forja.x, forja.z, 0, 0.45, 0.3, chao(forja.x, forja.z) + 0.8);
    caixa(forja.fx, forja.fz, 0, 0.7, 0.6, chao(forja.fx, forja.fz) + 1.6); // a fornalha também é sólida (André 2026-11-23: "a fornalha não")
    enfeite('armas', -h + 6.4, -h + 2.2);
  }
  if (nv >= 6) { casa('aurora_torre', -(h - 3), h - 3); casa('aurora_torre', h - 3, -(h - 3)); } // castelo: mais duas torres (o canto de trás à esquerda é da forja)
  // paliçada (Nv 3+): cerca na borda do centro, com o portão na frente (Nv 6: o portão de pedra)
  if (nv >= 3) {
    const vao = nv >= 6 ? 5 : 3;
    if (nv >= 6) casa('aurora_portao', 0, h);
    for (let u = -h + 1; u <= h - 1 + 0.01; u += 2) {
      for (const [lx, lz, ry] of [[u, -h, 0], [-h, u, Math.PI / 2], [h, u, Math.PI / 2], ...(Math.abs(u) > vao ? [[u, h, 0]] : [])]) {
        const y = baixo(lx, lz, 1), c = { m: 'cerca', x: r2(x0 + lx), z: r2(z0 + lz), ry: r2(ry), y };
        pecas.push(c);
        caixa(c.x, c.z, ry, 1.03, 0.12, y + 0.9); // a cerca do vilas.glb tem 2,06 m e 0,84 m de alto
      }
    }
    for (const s of [-1, 1]) enfeite('estandarte', s * (vao + 0.8), h + 0.6);
  }
  // os lotes abertos (1 a N.lotes): retângulo inteiro (o lote do jogo usa o mesmo); os fechados não aparecem
  const lotes = P.lugares.slice(0, N.lotes).map(([dx, dz], i) => ({ i: i + 1, x0: x0 + dx - P.lote / 2, z0: z0 + dz - P.lote / 2, x1: x0 + dx + P.lote / 2, z1: z0 + dz + P.lote / 2 }));
  return { nv, centro: N.centro, raio: N.raio, pecas, sol, bau, frente, forja, lotes, mesa };
}

export const Base = {
  // ---------- estado ----------
  carregarBases(est) {
    this.basesCla = {};
    for (const [k, b] of Object.entries(est && typeof est === 'object' ? est : {})) {
      if (!b || !/^[jn][\w:.-]{1,40}$/.test(k) || !Number.isFinite(+b.x) || !Number.isFinite(+b.z)) continue;
      this.basesCla[k] = { k, x: Math.round(+b.x), z: Math.round(+b.z), raca: RACAS[b.raca] ? b.raca : 'chama', n: String(b.n || '').slice(0, 24), dono: String(b.dono || ''), nomeDono: String(b.nomeDono || '').slice(0, 24),
        nv: Math.max(1, Math.min(CLA.max, b.nv | 0)), taxa: Number.isFinite(+b.taxa) ? +b.taxa : Date.now(), c: +b.c || Date.now(), donos: {}, ...(b.sorteou ? { sorteou: 1 } : {}), ...(b.bauSolto ? { bauSolto: 1 } : {}), ...(b.mesaSolta ? { mesaSolta: 1 } : {}), ...(b.mudou > 0 ? { mudou: b.mudou | 0, mudouEm: +b.mudouEm || 0 } : {}), ...(b.livres > 0 ? { livres: Math.min(20, b.livres | 0) } : {}), ...(b.missaoEm > 0 ? { missaoEm: +b.missaoEm } : {}), ...(b.missaoOk > 0 ? { missaoOk: +b.missaoOk } : {}) };
      for (const [i, o] of Object.entries(b.donos && typeof b.donos === 'object' ? b.donos : {})) if (/^[2-9]$/.test(i) && o && typeof o.id === 'string') this.basesCla[k].donos[i] = { id: o.id.slice(0, 24), nome: String(o.nome || '').slice(0, 24) };
    }
    this.refazerBases();
    if (this.terreno) this.refazerSolidosLotes();
  },
  salvarBases() { if (this.aoBases) this.aoBases(this.basesCla); },
  // as áreas (chão de verdade nos lotes), os sólidos e o desenho de cada base
  refazerBases() {
    this.basesCla ||= {};
    AREAS_BASE.length = 0;
    AREAS_SEGURAS_BASE.length = 0;
    this.basesDesenho = {};
    this.refazerChaoBases();
    for (const B of Object.values(this.basesCla)) {
      const D = montarBase(B);
      this.basesDesenho[B.k] = D;
      AREAS_BASE.push({ x: B.x, z: B.z, r: B_().pegada + 2 });
      // área segura (igual ao totem): só o centro do nível de agora e os lotes abertos, sem raio a mais
      const hc = D.centro / 2;
      AREAS_SEGURAS_BASE.push({ k: B.k, x0: B.x - hc, z0: B.z - hc, x1: B.x + hc, z1: B.z + hc }, ...D.lotes.map((L) => ({ k: B.k, x0: L.x0, z0: L.z0, x1: L.x1, z1: L.z1 })));
    }
    this.solidosBase = Object.values(this.basesDesenho).flatMap((D) => D.sol);
    // as árvores de dentro saem (coleta e batida); volta tudo antes, para refazer do zero
    const fora = this.arvoresFora ||= new Map();
    for (const [id, o] of fora) { if (o.no) this.coletaveis?.set(id, o.no); if (o.mata && this.mata) { if (!this.mata.has(o.k)) this.mata.set(o.k, []); this.mata.get(o.k).push(o.mata); } }
    fora.clear();
    for (const B of Object.values(this.basesCla)) for (const [id, x, z] of (this.basesDesenho[B.k].arvores = arvoresDaBase(B.x, B.z))) {
      const o = { no: this.coletaveis?.get(id) || null, k: Math.floor(x / 6) * 10007 + Math.floor(z / 6), mata: null };
      if (o.no) this.coletaveis.delete(id);
      const g = this.mata?.get(o.k), i = g ? g.findIndex((a) => a.x === x && a.z === z) : -1;
      if (i >= 0) o.mata = g.splice(i, 1)[0];
      fora.set(id, o);
    }
  },
  // o chão nivelado e a estrada de cada base (shared/terrapleno.js): guardado por lugar (a estrada só é procurada de novo
  // quando a base nasce ou muda de lugar)
  refazerChaoBases() {
    const C = this.chaoBases ||= {}, lista = Object.values(this.basesCla);
    for (const k of Object.keys(C)) if (!this.basesCla[k]) delete C[k];
    for (const B of lista) {
      const c = C[B.k]; if (c && c.x === B.x && c.z === B.z) continue;
      const n = nivelDaBase(B, proibido().circ);
      C[B.k] = { k: B.k, x: B.x, z: B.z, y: n ? n.y : null, wmax: n ? n.wmax : 0, estrada: null };
    }
    const todos = Object.values(C);
    chaoDasBases(todos);
    let novo = false;
    for (const c of todos) if (c.estrada === null) { c.estrada = c.y == null ? [] : caminhoDaBase(c, c.y, lista.filter((o) => o.k !== c.k)); novo = true; }
    if (novo) chaoDasBases(todos);
  },
  chaveBase(j) { return j && !j.bot && j.conta ? 'j' + String(j.conta).replace(/[^\w]/g, '').slice(0, 30) : null; },
  baseDe(j) { const k = this.chaveBase(j); return (k && this.basesCla?.[k]) || null; },
  baseDoClaNpc(C) { return this.basesCla?.['n' + C.id] || null; },
  // o que o app recebe: todas as bases (o desenho pronto) e qual é a minha
  dadosBase(B) {
    const D = this.basesDesenho?.[B.k] || montarBase(B), N = nivelBase(B.nv);
    return { k: B.k, n: B.n, raca: B.raca, x: B.x, z: B.z, nv: B.nv, lider: B.nomeDono, centro: D.centro, raio: D.raio, pecas: D.pecas, sol: D.sol, bau: D.bau, frente: D.frente, forja: D.forja, mesa: this.mesaBase(B),
      lotes: D.lotes.map((l) => [l.i, l.x0, l.z0, l.x1, l.z1, l.i === 1 ? B.nomeDono : B.donos?.[l.i]?.nome || '']), arvores: D.arvores || [], taxa: N.taxa, atraso: this.semanasBase(B),
      chao: this.chaoBase(B) };
  },
  // o chão da base para o app (a mesma conta: base_cla.gd _chao_das_bases): y do platô, wmax e a estrada [x, z, y, ...]
  chaoBase(B) {
    const c = this.chaoBases?.[B.k]; if (!c || c.y == null) return null;
    return { y: c.y, wmax: c.wmax, estrada: (c.estrada || []).flat() };
  },
  enviarBases(id) {
    const j = this.jogadores.get(id); if (!j) return;
    this.evento({ t: 'bases', para: id, meu: this.baseDe(j)?.k || '', amigas: Object.values(this.basesCla || {}).filter((B) => B.raca === this.racaDe(j)).map((B) => B.k), lista: Object.values(this.basesCla || {}).map((B) => this.dadosBase(B)) });
    this.enviarJantares?.(id); // os jantares do clã que estão acontecendo (shared/jantar.js)
  },
  // a área da base onde o lote 1 (do líder) também constrói (shared/simulacao.js naAreaBase): dentro da paliçada (1 m de
  // folga), sem o salão, as torres e os enfeites (sol) e sem o corredor do portão (só a faixa de lado por onde o "Ir" passa, x+0,9 a x+2,5: André 2026-11-24 não conseguia pôr o baú na frente da casa, no meio)
  areaBase(L) {
    const B = L?.def?.baseK && /_1$/.test(L.def.id) && this.basesCla?.[L.def.baseK]; if (!B) return null;
    const D = this.basesDesenho?.[B.k]; if (!D) return null;
    const hc = nivelBase(B.nv).centro / 2 - 1, bz = D.frente ? D.frente.z : B.z;
    return { x0: B.x - hc, z0: B.z - hc, x1: B.x + hc, z1: B.z + hc, livre: [B.x + 0.9, bz - 1, B.x + 2.5, B.z + hc + 1], sol: D.sol || [] };
  },
  // a mesma área para o app (godot-prototipo/construcao.gd): [x0, z0, x1, z1], o corredor e as caixas [x, z, cos, sen, hw, hd]
  areaBaseApp(L) {
    const A = this.areaBase(L); if (!A) return null;
    const r = (v) => Math.round(v * 100) / 100;
    return { ret: [A.x0, A.z0, A.x1, A.z1], livre: A.livre, sol: A.sol.map((o) => [o.x, o.z, r(o.cos), r(o.sen), o.hw, o.hd]) };
  },
  avisarBases() {
    this.refazerBases();
    this.refazerSolidosLotes();
    for (const L of this.lotes.values()) if (L.def.baseK && /_1$/.test(L.def.id)) this.avisarLote(L); // a área da base muda com o nível e o lugar
    for (const j of this.jogadores.values()) if (!j.bot) this.enviarBases(j.id);
    this.salvarBases();
  },
  // ---------- taxa ----------
  semanasBase(B) { return Math.max(0, Math.floor((Date.now() - (B.taxa || Date.now())) / CLA.semana)); },
  baseTravada(B) { return !!B && this.semanasBase(B) >= B_().taxaTrava; },
  // paga as semanas que venceram com o ouro que tiver (cofre do clã do jogador, ouro do líder bot)
  pagarBase(B, pegar) {
    let n = 0;
    while (this.semanasBase(B) > 0 && pegar(nivelBase(B.nv).taxa)) { B.taxa += CLA.semana; n++; }
    if (n) this.salvarBases();
    return n;
  },
  // o lote (da base) do líder está travado pela taxa atrasada
  loteBaseTravado(L, aviso) {
    const B = L?.def?.baseK && this.basesCla?.[L.def.baseK]; if (!B || !this.baseTravada(B)) return false;
    aviso(`Taxa do clã atrasada (${this.semanasBase(B) * nivelBase(B.nv).taxa} de ouro): deposite no cofre do clã para construir e plantar`);
    return true;
  },
  // ---------- fundar (pedido do painel do Clã: { acao: 'base' }) ----------
  // onde: { x, z } escolhido no mapa (André 2026-11-22: "qd clicar criar base abre o mapa... a gente só move a marca e
  // escolhe"; longe também, mas só onde a névoa já abriu); sem: onde o líder está
  fundarBase(j, aviso, onde = null) {
    const c = j.prog.cla; if (!c) return aviso('Funde o seu clã primeiro');
    if (j.morto || j.criando) return;
    const k = this.chaveBase(j); if (!k) return;
    if (this.basesCla[k]) { const B = this.basesCla[k]; return aviso(`A base do clã ${c.n} já fica em ${B.x}, ${B.z}`); }
    const { x, z } = this.lugarPedidoBase(j, onde), raca = this.racaDe(j);
    const motivo = this.motivoLugarBase(j, x, z, raca, Object.values(this.basesCla)); if (motivo) return aviso(motivo);
    const B = { k, x, z, raca, n: c.n, dono: j.conta, nomeDono: j.nome, nv: c.nv || 1, taxa: Date.now(), c: Date.now(), donos: {} };
    this.basesCla[k] = B;
    this.distribuirLotes(B, c.m.map((m) => ({ id: m.id, nome: m.nome })));
    this.logCla(c, `Base fundada em ${x}, ${z}`);
    this.refazerBases();
    const lote = this.loteDaBase(B, 1, j.conta, j.nome);
    aviso(`Base do clã ${c.n} fundada! ${nivelBase(B.nv).tem}. ` + (lote ? 'O lote 1 é seu: toque no martelo para construir.' : 'O lote 1 fica seu quando a casa antiga for devolvida.'));
    if (lote) { this.evento({ t: 'meuLote', para: j.id, lote: lote.def.id }); this.avisarLote(lote); }
    this.avisarBases();
    this.historia?.(j, 'base'); // missão "A base do clã" (André 2026-11-23)
    this.avisarProg(j);
  },
  // a prévia (modo de escolher o lugar no app): pode fundar onde o líder está agora? (o mesmo motivoBase de fundarBase)
  verLugarBase(j, onde = null) {
    if (!j.prog.cla) return;
    const { x, z } = this.lugarPedidoBase(j, onde), k = this.chaveBase(j);
    const motivo = this.basesCla[k] && !onde?.mudar ? 'O clã já tem base' : this.motivoLugarBase(j, x, z, this.racaDe(j), Object.values(this.basesCla).filter((B) => B.k !== k));
    this.evento({ t: 'baseVer', para: j.id, x, z, ok: !motivo, motivo: motivo || '' });
  },
  // realocar a base (André 2026-11-22: "uma realocação free e as próximas uma boa quantia e cooldown pra ninguém ficar
  // explorando"): a 1ª é grátis; depois CLA.base.mudar.ouro do cofre do clã e só a cada CLA.base.mudar.dias. Tudo vai
  // junto: o salão, os lotes com as peças, a horta e os baús (só desloca; nada sai).
  moverBase(j, aviso, onde) {
    const c = j.prog.cla, B = this.baseDe(j); if (!c || !B) return aviso('O clã ainda não tem base');
    if (j.morto || j.criando) return;
    const M = B_().mudar, dia = 86400000, n = B.mudou | 0, livre = (B.livres | 0) > 0; // livres: mudanças grátis dadas à mão (André 2026-11-23, para testes: "só dessa vez")
    if (n > 0 && !livre && B.mudouEm && Date.now() - B.mudouEm < M.dias * dia) {
      const falta = M.dias * dia - (Date.now() - B.mudouEm), d = Math.floor(falta / dia), h = Math.ceil((falta % dia) / 3600000);
      return aviso(`A base só pode mudar de novo em ${d ? d + ' d ' : ''}${h} h`);
    }
    const { x, z } = this.lugarPedidoBase(j, onde);
    if (x === B.x && z === B.z) return;
    const motivo = this.motivoLugarBase(j, x, z, B.raca, Object.values(this.basesCla).filter((o) => o.k !== B.k)); if (motivo) return aviso(motivo);
    const custo = n > 0 && !livre ? M.ouro : 0;
    if (custo && (c.cofre | 0) < custo) return aviso(`Mudar a base custa ${custo} de ouro do cofre do clã (tem ${c.cofre | 0})`);
    c.cofre = (c.cofre | 0) - custo;
    const dx = x - B.x, dz = z - B.z;
    for (const L of [...this.lotes.values()]) {
      if (L.def.baseK !== B.k) continue;
      L.def.x0 += dx; L.def.x1 += dx; L.def.z0 += dz; L.def.z1 += dz;
      for (const p of L.pecas) { p.x += dx; p.z += dz; }
      const h = {}; for (const [k, t] of Object.entries(L.horta || {})) { const [i, kk] = k.split(',').map(Number); h[`${i + dx},${kk + dz}`] = t; }
      L.horta = h;
      this.evento({ t: 'lote', lote: L.def.id, dono: null }); // o app tira do lugar velho e monta no novo
      this.avisarLote(L);
    }
    B.x = x; B.z = z;
    if (n > 0 && livre) B.livres = (B.livres | 0) - 1; else { B.mudou = n + 1; B.mudouEm = Date.now(); }
    if (!B.livres) delete B.livres;
    this.logCla(c, `Base mudou para ${x}, ${z}` + (custo ? ` (${custo} de ouro)` : ' (grátis)'), custo ? -custo : 0);
    this.refazerSolidosLotes?.();
    this.avisarBases();
    aviso(`Base do clã mudou para ${x}, ${z}` + (custo ? `: ${custo} de ouro do cofre` : ': esta foi grátis') + (B.livres > 0 ? `. Ainda tem ${B.livres} grátis` : `. A próxima custa ${M.ouro} de ouro e só depois de ${M.dias} dias`));
    j.progSujo = true; this.avisarProg(j);
  },
  lugarPedidoBase(j, onde) {
    const ok = onde && Number.isFinite(+onde.x) && Number.isFinite(+onde.z) && Math.abs(+onde.x) < 5000 && Math.abs(+onde.z) < 5000;
    return ok ? { x: Math.round(+onde.x), z: Math.round(+onde.z) } : { x: Math.round(j.x), z: Math.round(j.z) };
  },
  motivoLugarBase(j, x, z, raca, outras) {
    if (zonaFechadaEm(j.prog, x, z)) return 'Essa região ainda está na névoa: abra ela pela história primeiro';
    return motivoBase(x, z, raca, outras);
  },
  // cria o lote i da base para a conta (só se ela ainda não tem terreno: um terreno por pessoa)
  loteDaBase(B, i, conta, nome) {
    if (this.loteDaConta(conta)) return null;
    const D = this.basesDesenho[B.k], l = D?.lotes.find((o) => o.i === i); if (!l) return null;
    const lid = 'q' + B.k.slice(0, 20) + '_' + i, R = { x0: l.x0, z0: l.z0, x1: l.x1, z1: l.z1 };
    if (this.aoComprarLote && !this.aoComprarLote(lid, conta, nome, R)) return null;
    const L = { def: { id: lid, nome: `Lote ${i} da base`, ...R, baseK: B.k }, dono: conta, nomeDono: nome, pecas: [], horta: {}, prox: 1, taxa: null };
    this.lotesSoltos?.delete(lid);
    this.lotes.set(lid, L);
    this.lotesMudados.add(lid);
    const j = [...this.jogadores.values()].find((o) => !o.bot && o.conta === conta);
    if (j && this.devolucoes?.[conta]) this.entregarDevolucao(j); // os baús da casa antiga vêm para cá
    return L;
  },
  // os lotes 2 em diante são dos membros (André 2026-11-22: "os lotes vão ser sempre tipo lote particular dos bots...
  // nível 2, o lote do primeiro bot que entrar"; "sorteia os terrenos lá para cada um"): quem saiu perde o lote; na
  // primeira vez os que já estavam no clã são sorteados; depois, quem entra pega o próximo lote livre, na ordem.
  // membros: [{ id, nome }] na ordem em que entraram. Devolve true se mudou.
  distribuirLotes(B, membros) {
    const N = nivelBase(B.nv), donos = B.donos ||= {}, ids = new Set(membros.map((o) => o.id));
    let mudou = false;
    for (const [i, o] of Object.entries(donos)) if (!ids.has(o.id) || +i > N.lotes) { delete donos[i]; this.soltarLoteBase?.(B, i); mudou = true; }
    const tem = new Set(Object.values(donos).map((o) => o.id));
    let fila = membros.filter((o) => !tem.has(o.id));
    if (!B.sorteou && fila.length) { fila = [...fila].sort(() => Math.random() - 0.5); B.sorteou = 1; mudou = true; }
    for (let i = 2; i <= N.lotes && fila.length; i++) if (!donos[i]) { const o = fila.shift(); donos[i] = { id: o.id, nome: o.nome }; mudou = true; }
    for (const [i, o] of Object.entries(donos)) { const m = membros.find((q) => q.id === o.id); if (m && m.nome !== o.nome) { o.nome = m.nome; mudou = true; } }
    return mudou;
  },
  // o lote i da base perdeu o dono bot (recruta dispensado, foi embora ou a base desceu de nível): a casa dele sai e o lote
  // fica livre para o próximo (André 2026-11-23: todo bot constrói a casa no lote dele, NPC_CASA_BASE)
  soltarLoteBase(B, i) {
    const L = this.lotes?.get('q' + B.k.slice(0, 20) + '_' + i);
    if (L && /^[ar]:/.test(String(L.dono))) { this.soltarLoteBot(L); this.refazerSolidosLotes?.(); }
  },
  // o clã do jogador mudou (nível, recruta entrou ou saiu): a base acompanha
  baseDoClaMudou(j) {
    const B = this.baseDe(j), c = j?.prog?.cla; if (!B || !c) return;
    let mudou = false;
    if (B.nv !== (c.nv || 1)) { B.nv = c.nv || 1; mudou = true; }
    if (B.n !== c.n) { B.n = c.n; mudou = true; }
    if (B.nomeDono !== j.nome) { B.nomeDono = j.nome; mudou = true; }
    if (this.distribuirLotes(B, c.m.map((m) => ({ id: m.id, nome: m.nome })))) mudou = true;
    if (mudou) this.avisarBases();
  },
  // o que o painel do Clã mostra da base (null: ainda não fundou)
  baseInfo(j) {
    const B = this.baseDe(j); if (!B) return null;
    const N = nivelBase(B.nv), D = this.basesDesenho?.[B.k], sem = this.semanasBase(B);
    return { x: B.x, z: B.z, nv: B.nv, tem: N.tem, taxa: N.taxa, atraso: sem, devendo: sem * N.taxa, trava: this.baseTravada(B) ? 1 : 0,
      prox: Math.max(0, B.taxa + CLA.semana - Date.now()), centro: N.centro, raio: N.raio, mudar: (B.mudou | 0) && !(B.livres > 0) ? B_().mudar.ouro : 0, livres: B.livres | 0, mudarEm: (B.mudou | 0) && !(B.livres > 0) && B.mudouEm ? Math.max(0, B.mudouEm + B_().mudar.dias * 86400000 - Date.now()) : 0,
      lotes: (D?.lotes || []).map((l) => ({ i: l.i, dono: l.i === 1 ? j.nome : B.donos?.[l.i]?.nome || '' })), missao: this.missaoInfo?.(B) || null };
  },
  // ---------- o Baú do Clã do salão e a forja ----------
  pertoBauBase(j) {
    const b = this.bauBase(this.baseDe(j));
    return !!b && Math.hypot(b.x - j.x, b.z - j.z) <= B_().bauPerto;
  },
  // onde está o Baú do Clã da base: o da porta do salão ou, depois de recolhido, a peça bau_cla que o líder pôs no lote 1
  bauBase(B) {
    const D = B && this.basesDesenho?.[B.k]; if (!D) return null;
    if (D.bau) return D.bau;
    const p = this.lotes?.get('q' + B.k.slice(0, 20) + '_1')?.pecas.find((o) => o.k === 'bau_cla');
    return p ? { x: p.x, z: p.z } : null;
  },
  // o líder recolhe o baú da porta do salão: vira a peça bau_cla na mochila (o que tem dentro fica guardado no Baú do Clã)
  recolherBauBase(j, aviso) {
    const B = this.baseDe(j), D = B && this.basesDesenho?.[B.k]; if (!D?.bau) return aviso('Esse baú já foi recolhido');
    if (Math.hypot(D.bau.x - j.x, D.bau.z - j.z) > B_().bauPerto) return aviso('Chegue perto do Baú do Clã');
    const prova = j.prog.mochila.map((o) => (o ? { ...o } : null));
    if (!guardar(prova, { k: 'obra_bau_cla', n: 1 })) return aviso('Mochila cheia: o baú não cabe');
    j.prog.mochila = prova;
    B.bauSolto = 1;
    this.refazerBases();
    if (this.terreno) this.refazerSolidosLotes();
    this.salvarBases();
    this.avisarBases();
    this.avisarProg(j);
    aviso('Baú do Clã recolhido: está na mochila. Ponha onde quiser na base (martelo, Móveis). Nada de dentro se perdeu');
  },
  // onde está a Mesa do Clã da base: a da frente do salão ou, recolhida, a peça mesa_cla do lote 1 ({ x, z, ry, y })
  mesaBase(B) {
    const D = B && this.basesDesenho?.[B.k]; if (!D) return null;
    if (D.mesa) return D.mesa;
    const p = this.lotes?.get('q' + B.k.slice(0, 20) + '_1')?.pecas.find((o) => o.k === 'mesa_cla');
    if (!p) return null;
    // y: o chão onde a mesa está, com a fundação embaixo (André 2026-11-25: "vou poder pôr a fundação por baixo da mesa"):
    // a altura do lugar da cabeceira (fora do tampo, que é sólido); o app põe a comida e os pratos em cima daí
    const ry = r2(((p.r | 0) & 3) * Math.PI / 2), cx = p.x + Math.cos(ry) * JANTAR.lugares[0][0], cz = p.z - Math.sin(ry) * JANTAR.lugares[0][0];
    return { x: p.x, z: p.z, ry, y: r2(this.terreno ? this.terreno.altura(cx, cz) : 0), peca: p.id };
  },
  // o líder recolhe a mesa da frente do salão: vira a peça mesa_cla na mochila (põe onde quiser na base, como o baú)
  recolherMesaBase(j, aviso) {
    const B = this.baseDe(j), D = B && this.basesDesenho?.[B.k]; if (!D?.mesa) return aviso('Essa mesa já foi recolhida');
    if (this.jantares?.has(B.k)) return aviso('Termine o jantar antes de mudar a mesa de lugar');
    if (Math.hypot(D.mesa.x - j.x, D.mesa.z - j.z) > JANTAR.perto) return aviso('Chegue perto da Mesa do Clã');
    const prova = j.prog.mochila.map((o) => (o ? { ...o } : null));
    if (!guardar(prova, { k: 'obra_mesa_cla', n: 1 })) return aviso('Mochila cheia: a mesa não cabe');
    j.prog.mochila = prova;
    B.mesaSolta = 1;
    this.avisarBases();
    this.avisarProg(j);
    aviso('Mesa do Clã recolhida: está na mochila. Ponha onde quiser na base (martelo, Móveis)');
  },
  fornalhaBasePerto(j) {
    const B = this.baseDe(j), D = B && this.basesDesenho?.[B.k];
    return D?.forja && Math.hypot(D.forja.fx - j.x, D.forja.fz - j.z) <= B_().forjaPerto ? { id: 'base_fornalha', k: 'fornalha', nome: 'Fornalha do clã', x: D.forja.fx, z: D.forja.fz, base: B.k } : null;
  },
  forjaBasePerto(j) {
    const B = this.baseDe(j), D = B && this.basesDesenho?.[B.k];
    return D?.forja && Math.hypot(D.forja.x - j.x, D.forja.z - j.z) <= B_().forjaPerto ? { x: D.forja.x, z: D.forja.z, k: 'bigorna', base: B.k } : null;
  },
  // ---------- as casas de antes voltam para o dono (André 2026-11-22: "Tudo pode remover as casas") ----------
  // Cada terreno de jogador fora da base sai do mapa. O dono recebe o preço do terreno em ouro e as peças na mochila
  // (obra_ de cada uma) e o que estava na fornalha; o baú particular, o Baú do Clã e o nível do baú passam para o lote 1
  // da base dele quando ela existir (até lá ficam guardados). Quem está fora do jogo recebe ao entrar (tabela mundo
  // 'devolucoes'). Os terrenos dos bots (Cecília, Dario) também saem (André 2026-11-22: "Não vai existir mais casa de bot
  // nenhum... todo mundo vai ter uma base"): o progresso deles (L.amiga) vai para a tabela mundo e a casa nasce de novo
  // no lote deles na base do clã bot.
  resetTerrenos() {
    const bots = new Set([...AMIGOS_VIRTUAIS, ...RIVAIS].map((d) => d.conta).filter(Boolean));
    let n = 0;
    for (const L of [...this.lotes.values()]) {
      if (!L.dono || L.def.baseK) continue;
      if (bots.has(L.dono) || /^[ar]:/.test(String(L.dono))) { this.soltarLoteBot(L); n++; continue; }
      this.devolverTerreno(L); n++;
    }
    if (n) this.refazerSolidosLotes();
    return n;
  },
  soltarLoteBot(L) {
    const d = [...AMIGOS_VIRTUAIS, ...RIVAIS].find((o) => o.conta === L.dono);
    if (d && L.amiga?.prog) { (this.npcSalvos ||= new Map()).set(d.id, L.amiga); (this.npcsMudados ||= new Set()).add(d.id); }
    this.lotes.delete(L.def.id); this.lotesMudados.delete(L.def.id); this.lotesSoltos.add(L.def.id);
    this.evento({ t: 'lote', lote: L.def.id, dono: null });
  },
  devolverTerreno(L) {
    const conta = L.dono, D = (this.devolucoes ||= {})[conta] ||= { ouro: 0, itens: [] };
    D.ouro += precoTerreno(L.def.x1 - L.def.x0, L.def.z1 - L.def.z0);
    for (const p of L.pecas) D.itens.push({ k: 'obra_' + p.k, n: 1 });
    for (const F of Object.values(L.fornos || {})) for (const o of [F?.comb, F?.ent, F?.sai]) if (o?.k && o.n > 0) D.itens.push({ k: o.k, n: o.n });
    const junta = (a, b) => [...(a || []), ...(b || []).filter(Boolean)];
    if (L.bau?.some(Boolean)) D.bau = junta(D.bau, L.bau);
    if (L.bauCla?.some(Boolean)) D.bauCla = junta(D.bauCla, L.bauCla);
    if (L.bauNv) D.bauNv = Math.max(D.bauNv | 0, L.bauNv);
    D.texto = 'A sua casa antiga foi devolvida (agora a casa fica na base do clã)';
    this.lotes.delete(L.def.id); this.lotesMudados.delete(L.def.id); this.lotesSoltos.add(L.def.id);
    this.evento({ t: 'lote', lote: L.def.id, dono: null });
    const j = [...this.jogadores.values()].find((o) => !o.bot && o.conta === conta);
    if (j) { this.evento({ t: 'meuLote', para: j.id, lote: '' }); this.entregarDevolucao(j); }
    this.salvarDevolucoes();
  },
  salvarDevolucoes() { if (this.aoDevolucoes) this.aoDevolucoes(this.devolucoes || {}); },
  carregarDevolucoes(est) { this.devolucoes = est && typeof est === 'object' ? est : {}; },
  // entrega o que dá: ouro e itens na mochila (o resto espera espaço); baús vão para o lote da base
  entregarDevolucao(j) {
    const D = this.devolucoes?.[j?.conta]; if (!D || j.bot) return;
    const p = j.prog, msg = [];
    if (D.ouro > 0) { p.ouro = (p.ouro | 0) + D.ouro; this.caixa?.(j, 'terrenoVolta', D.ouro); msg.push(`${D.ouro} de ouro`); D.ouro = 0; }
    const sobra = [];
    for (const o of D.itens || []) if (!guardar(p.mochila, { ...o })) sobra.push(o);
    if ((D.itens || []).length > sobra.length) msg.push('as peças na mochila');
    D.itens = sobra;
    const L = this.loteDaConta(j.conta);
    if (L?.def.baseK && (D.bau || D.bauCla || D.bauNv)) {
      if (D.bauNv) L.bauNv = Math.max(L.bauNv | 0, Math.min(BAU.niveis.length - 1, D.bauNv));
      const encher = (lista, n) => { const b = Array.from({ length: n }, (_, i) => (lista?.[i] ? { ...lista[i] } : null)); return b; };
      if (D.bau) { const b = encher(L.bau, bauLugares(L.bauNv | 0)), resto = []; for (const o of D.bau) if (!guardar(b, { ...o })) resto.push(o); L.bau = b; D.bau = resto.length ? resto : null; }
      if (D.bauCla) { const b = encher(L.bauCla, CLA.bauCla), resto = []; for (const o of D.bauCla) if (!guardar(b, { ...o })) resto.push(o); L.bauCla = b; D.bauCla = resto.length ? resto : null; }
      D.bauNv = 0; this.lotesMudados.add(L.def.id);
      msg.push('os baús no lote da base');
    }
    if (msg.length) this.evento({ t: 'aviso', para: j.id, texto: `${D.texto || 'Devolução'}: ${msg.join(', ')}` + (sobra.length ? `. Mochila cheia: ${sobra.length} peças esperam espaço` : '') + (D.bau || D.bauCla ? '. Os baús esperam o lote 1 da sua base' : '') });
    if (!D.ouro && !D.itens.length && !D.bau && !D.bauCla && !D.bauNv) delete this.devolucoes[j.conta];
    this.avisarProg(j);
    this.salvarDevolucoes();
  },
  // ---------- clãs bot: o líder funda a base em volta da vila da raça e paga a taxa ----------
  passoBasesNpc() {
    this.basesCla ||= {};
    let mudou = false;
    for (const C of CLAS_NPC) {
      const k = 'n' + C.id, E = this.clasNpc?.[C.id]; if (!E) continue;
      let B = this.basesCla[k];
      if (!B) {
        const casa = RACAS[C.raca]?.casa || (C.raca === 'chama' ? { x: -6, z: 1 } : { x: 546, z: 43 });
        const p = acharLugarBase(casa.x, casa.z, C.raca, Object.values(this.basesCla)); if (!p) continue;
        const nomeL = this.amigosIa?.find((x) => x.AMIGA.id === C.lider)?.AMIGA.nome || C.lider;
        B = this.basesCla[k] = { k, x: p.x, z: p.z, raca: C.raca, n: C.n, dono: 'npc:' + C.lider, nomeDono: nomeL, nv: E.nv || 1, taxa: Date.now(), c: Date.now(), donos: {} };
        mudou = true;
      }
      if (B.nv !== (E.nv || 1)) { B.nv = E.nv || 1; mudou = true; }
      const nome = (id) => this.amigosIa?.find((x) => x.AMIGA.id === id)?.AMIGA.nome || id;
      if (this.distribuirLotes(B, [...fixosNpc(C, E).map((id) => ({ id, nome: nome(id) })), ...E.m.map((m) => ({ id: m.id, nome: m.nome }))])) mudou = true;
      const L = this.liderNpc?.(C);
      if (L && this.pagarBase(B, (v) => { if ((L.prog.ouro | 0) < v) return false; L.prog.ouro -= v; return true; })) mudou = true;
    }
    // a casa da Cecília e do Dario no lote deles da base (cria o lote quando a base e o lugar dele existem)
    if (mudou) this.avisarBases();
    for (const a of this.amigosIa || []) if ((a.AMIGA.terreno || (NPC_CASA_BASE.ligado && a.amiga && a.fazTarefasDef?.())) && !a.loteDaAmiga()) a.loteDaAmiga(true); // e todo bot de clã no mundo (NPC_CASA_BASE)
  },
};

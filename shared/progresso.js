// Progressão do herói (ideia do Quimera): nível e XP, atributos, habilidades que sobem de nível com o uso e 6 botões
// escolhidos no menu do personagem. Quem guarda e decide é o servidor (Simulacao + conta); o app só mostra.
import { A, HORTA, ITENS, RARIDADES, LUGARES, MOCHILA, MOCHILA_PAGINAS, CONJUNTO, VENDA_EQUIP, VENDA_TOMO, ROMANO, ESTAMINA, VIGOR, PROFISSOES, PROF_MAX, MERCADOR, RARIDADE_CRIAR, VOLTA_VILA, REGEN, MORTE, DIA, CAMA, REFORCO, ORGANIZAR } from './dados.js';

// Atributos: começam em 3; cada nível dá PONTOS_POR_NIVEL para distribuir
export const ATRIBUTOS = {
  for: { nome: 'Força', desc: '+6% dano físico (espada) · +4 vida · +1 defesa' },
  des: { nome: 'Destreza', desc: '+5 estamina · +0,15% crítico · -1,3% recarga' },
  int: { nome: 'Inteligência', desc: '+6% dano mágico (cajado) · +6 mana' },
  vit: { nome: 'Vitalidade', desc: '+8 vida · regeneração' },
};
export const PONTOS_POR_NIVEL = 2;
// André 2026-11-06: nível máximo 200 (era 30). Até o Nv 30 a curva é a mesma de antes; depois aperta aos poucos
// (x2,4 no Nv 100, x4,4 no Nv 200: uns 100 monstros por nível perto do 100 e 250 perto do 200).
export const NIVEL_MAX = 200;
export const xpProximo = (nivel) => Math.round(16 * nivel ** 1.45 * (1 + Math.max(0, nivel - 30) / 50));
// XP por inimigo derrubado (vai para quem bateu nele ou estava perto)
export const XP_INIMIGO = { puglin: 6, imp: 8, chefe: 25, sombrio: 6, lider: 20, lobo: 7, golem: 9, maw: 10, warrok: 30 };
// XP de um monstro de nível nv (campos de caça) para um herói de nível nh: sobe com o nível do bicho e cai quando o
// herói passou muito dele (NIVEL_INIMIGO em shared/dados.js)
export const xpDoInimigo = (tipo, nv, nh, N) => {
  const base = (XP_INIMIGO[tipo] || 5) * (1 + N.xp * Math.max(0, (nv || 1) - 1));
  return Math.max(1, Math.round(base * xpNivel(nv, nh, N)));
};
// Diferença de nível como no Quimera (números em NIVEL_INIMIGO de shared/dados.js). d = nível do monstro - nível do herói.
export const xpNivel = (nv, nh, N) => {
  const d = (nv || 1) - (nh || 1);
  return d >= 2 ? Math.min(N.xpMax, 1 + N.xpSobe * (d - 1)) : Math.min(1, Math.max(N.xpMin, 1 - N.xpCai * (-d - 2)));
};
// monstro batendo no herói: mais forte acima, mais fraco abaixo
export const danoMonstroNivel = (nv, nh, N) => {
  const d = (nv || 1) - (nh || 1);
  return (1 + N.danoAcima * Math.max(0, d)) * (d < 0 ? Math.max(N.danoAbaixoMin, 1 - N.danoAbaixo * -d) : 1);
};
// maior pedaço da vida máxima que um golpe de monstro pode tirar
export const tetoMonstroNivel = (nv, nh, chefe, N) => {
  const d = (nv || 1) - (nh || 1);
  return (chefe ? N.tetoChefe : N.teto) * (d < 0 ? Math.max(N.danoAbaixoMin, 1 - N.danoAbaixo * -d) : 1);
};
// fração do golpe de um monstro de nível nv que a defesa do herói segura (bicho de nível alto atravessa a armadura)
export const reducaoContra = (def, nv, N) => Math.min(N.defesaMax ?? 0.8, Math.max(0, def) / (Math.max(0, def) + (N.defesaBase ?? 24) + (N.defesaNivel ?? 0) * (nv || 1)));
// herói batendo no monstro: fraco em quem está muito acima, mais forte em quem está abaixo
export const golpeHeroiNivel = (nv, nh, N) => {
  const d = (nv || 1) - (nh || 1);
  if (d > N.golpeFolga) return Math.max(N.golpeMin, 1 - N.golpeCai * (d - N.golpeFolga));
  if (d < 0) return Math.min(N.golpeMax, 1 + N.golpeSobe * -d);
  return 1;
};

// Números do herói a partir do nível, dos atributos e do equipamento (nível 1 com tudo em 3 e sem nada = vida 120, mana 100, dano 10)
export function calcularStatus(p, passivas = {}) {
  const a = p.atr, n = p.nivel, eq = bonusEquip(p.equip, a);
  const nivelK = 1 + 0.08 * (n - 1);
  const def = a.for + (passivas.pele_pedra ? 3 : 0) + eq.defesa;
  return {
    vidaMax: Math.round(84 + 8 * a.vit + 4 * a.for + 6 * (n - 1) + eq.vida),
    manaMax: Math.round((82 + 6 * a.int + 2 * (n - 1) + eq.mana) * (passivas.mente_arcana ? 1.1 : 1)),
    // fora de combate (REGEN em shared/dados.js, números do Quimera); em luta a Simulacao aplica vidaCombate/manaCombate
    regenMana: (REGEN.mana + REGEN.manaNivel * n + REGEN.manaInt * a.int + (passivas.mente_arcana ? REGEN.manaMente : 0)) * (1 + eq.regenManaK),
    regenVida: REGEN.vida + REGEN.vidaNivel * n + REGEN.vidaVit * a.vit,
    defesa: def,
    reducao: def / (def + 24), // fração do dano que a defesa segura
    danoFisico: (10 * nivelK * (1 + 0.06 * (a.for - 3)) + eq.danoFisico) * (1 + eq.danoK),
    danoMagico: (10 * nivelK * (1 + 0.06 * (a.int - 3)) + eq.danoMagico) * (1 + eq.danoK),
    critico: Math.min(1, 0.0455 + 0.0015 * a.des + (passivas.sorte_arcana ? 0.02 : 0) + eq.critico),
    recarga: Math.min(0.4, 0.0133 * a.des), // fração a menos no tempo de recarga
    areaK: eq.areaK, // área das skills a mais (conjunto de 6 peças)
    estaminaMax: Math.round(ESTAMINA.base + ESTAMINA.porNivel * n + ESTAMINA.porDes * a.des),
  };
}

// ---------- profissões e vigor (Parte 3 do Quimera; dados em shared/dados.js: PROFISSOES, COLETA, RECEITAS) ----------
export const profNivel = (pts) => Math.min(PROF_MAX, Math.floor(Math.sqrt((pts || 0) / 8)) + 1);
export const profPontos = (nv) => 8 * (nv - 1) ** 2; // pontos para chegar no nível nv
export const profRank = (nv) => (nv >= 20 ? 10 : nv >= 19 ? 9 : Math.floor((nv - 1) / 2));
// o que o rank dá: vigor a menos, rapidez, chance de +1 na coleta
export const profBonus = (pts) => { const r = profRank(profNivel(pts)); return { rank: r, menosVigor: 0.04 * r, rapidez: 1 + 0.035 * r, extra: 0.02 * r }; };
// Mercador: quanto a Rosa paga a mais e cobra a menos (0 no Nv 1 até o máximo no Nv 20)
export const mercador = (pts) => { const k = (profNivel(pts) - 1) / (PROF_MAX - 1); return { venda: MERCADOR.venda * k, compra: MERCADOR.compra * k }; };
// chance de a peça criada subir de raridade (cada degrau)
export const chanceRaridade = (pts) => RARIDADE_CRIAR.base + (RARIDADE_CRIAR.max - RARIDADE_CRIAR.base) * (profNivel(pts) - 1) / (PROF_MAX - 1);
// Vigor de agora: { v, t } guarda quanto tinha no instante t (ms); enche VIGOR.max a cada VIGOR.enche segundos
export function vigorAgora(vg, agora = Date.now()) {
  if (!vg) return VIGOR.max;
  const s = Math.max(0, agora - vg.t) / 1000;
  return Math.min(VIGOR.max, vg.v + (s / VIGOR.enche) * VIGOR.max);
}
// Ganha vigor (a cama): nunca passa do máximo nem baixa o que já tinha (igual ao mgVgAdd do Quimera)
export function ganharVigor(p, n, agora = Date.now()) {
  const v = vigorAgora(p.vigor, agora), novo = Math.max(v, Math.min(VIGOR.max, v + n));
  p.vigor = { v: Math.round(novo * 1000) / 1000, t: agora };
  return novo - v;
}
// Hora do jogo (0 a 24) no relógio da conta: dia = { h, t } (hora h no instante t, ms); sem ele, o relógio do mundo
export function horaDoJogo(dia, agora = Date.now()) {
  const h0 = dia ? dia.h : DIA.comeco, t0 = dia ? dia.t : 0;
  return (((h0 + (agora - t0) / 1000 / DIA.horaSeg) % 24) + 24) % 24;
}
export const ehNoite = (h) => h >= DIA.noite || h < DIA.manha;
// segundos até a cama dar vigor de novo (0 = pronta)
export const camaVigorEm = (p, agora = Date.now()) => Math.max(0, ((p.camaT || 0) + CAMA.cada * 1000 - agora) / 1000);
// Gasta vigor (devolve false se não tem) e grava o valor de agora
export function gastarVigor(p, n, agora = Date.now()) {
  const v = vigorAgora(p.vigor, agora);
  if (v + 1e-9 < n) return false;
  p.vigor = { v: Math.round((v - n) * 1000) / 1000, t: agora };
  return true;
}

// ---------- equipamento e mochila (dados em shared/dados.js: ITENS, RARIDADES, CONJUNTO) ----------
const ehEquip = (k) => !!ITENS[k]?.lugar;
// Quantas peças de cada raridade (ou melhor) estão no corpo: 6 lugares, a Arma conta pela melhor entre espada e cajado
export function pecasDoConjunto(equip = {}) {
  const r = (l) => (equip[l] && !quebrado(equip[l]) ? equip[l].r : -1); // peça quebrada não conta (MORTE)
  const lugares = [r('cabeca'), r('corpo'), r('pernas'), r('capa'), r('pes'), r('acessorio'), Math.max(r('espada'), r('cajado'))];
  return RARIDADES.map((_, i) => lugares.filter((x) => x >= i).length);
}
// Soma das peças e do bônus de conjunto (o melhor de 2, 3 e 6 peças)
export function bonusEquip(equip = {}, atr = null) {
  const b = { vida: 0, mana: 0, defesa: 0, critico: 0, danoFisico: 0, danoMagico: 0, danoK: 0, areaK: 0, regenManaK: 0 };
  for (const l of LUGARES) {
    const it = equip?.[l]; if (!it || !ITENS[it.k] || quebrado(it)) continue; // quebrada: sem bônus até consertar
    if (atr && !reforcoOk(it, atr)) continue; // como no Quimera: reforçada além do seu atributo não dá bônus
    const rk = reforcoK(it);
    for (const [c, v] of Object.entries(ITENS[it.k].st)) b[c] += v[it.r] * (c === 'critico' ? rk.critico : rk.st);
  }
  const n = pecasDoConjunto(equip || {});
  for (const t of [2, 3, 6]) {
    let melhor = 0;
    for (let r = 1; r < CONJUNTO.length; r++) if (n[r] >= t) melhor = r;
    if (melhor) for (const [c, v] of Object.entries(CONJUNTO[melhor][t])) b[c] += v;
  }
  return b;
}
// Item na mochila: { k, r } peça (r = raridade 0..4) · { k, n } poção · { k: 'tomo', h, nv, n } Tomo da skill h
const ANTIGOS = { manto: 'peitoral', oculos: 'colar' }; // André 2026-11-03: sem Óculos (era do Quimera); quem tinha ganha um Colar da mesma raridade
export function itemValido(it) {
  // conta antiga: o Manto virou Peitoral (uma linha só de armadura)
  if (it && typeof it === 'object' && ANTIGOS[it.k]) it = { ...it, k: ANTIGOS[it.k] };
  if (!it || typeof it !== 'object' || !ITENS[it.k]) return null;
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (ehEquip(it.k)) {
    if (!int(it.r, 0, RARIDADES.length - 1)) return null;
    const v = int(it.d, 0, MORTE.durMax - 1) ? { k: it.k, r: it.r, d: it.d } : { k: it.k, r: it.r }; // d: durabilidade gasta (sem d = inteira)
    if (int(it.e, 1, REFORCO.max[it.r] || 0)) v.e = it.e; // e: reforço (+1, +2...; sem e = +0)
    if (it.cad) v.cad = 1; // cad: cadeado (André 2026-11-07): não vende, não joga fora, não vai para troca
    return v;
  }
  const n = int(it.n, 1, ITENS[it.k].pilha) ? it.n : 1;
  const cad = it.cad ? { cad: 1 } : {};
  if (it.k === 'tomo') return HABS[it.h]?.tomo && int(it.nv, 6, SKILL_MAX) ? { k: 'tomo', h: it.h, nv: it.nv, n, ...cad } : null;
  return { k: it.k, n, ...cad };
}
// pilha com cadeado só junta com pilha com cadeado (o que chega solto não entra no cadeado e o trancado não perde o cadeado)
const mesmo = (a, b) => a && b && a.k === b.k && a.h === b.h && a.nv === b.nv && !a.cad === !b.cad;
// Põe na mochila (junta na pilha igual ou no primeiro lugar vazio). Devolve false se não coube.
export function guardar(mochila, item) {
  const it = itemValido(item); if (!it) return false;
  if (it.n) {
    for (const o of mochila) if (o && mesmo(o, it) && o.n < ITENS[it.k].pilha) {
      const cabe = Math.min(it.n, ITENS[it.k].pilha - o.n); o.n += cabe; it.n -= cabe;
      if (it.n <= 0) return true;
    }
  }
  const i = mochila.indexOf(null); if (i < 0) return false;
  mochila[i] = it; return true;
}
// ---------- filtro de coleta (André 2026-11-07: "a bag enche muito rápido") ----------
// prog.filtro = { r: [raridades desmarcadas], k: [recursos desmarcados] }. O que está desmarcado não entra na mochila:
// peça de equipamento dessa raridade ou recurso (item com mat) que cai do monstro ou sai de bônus na coleta fica no chão.
// Poção, Tomo, ouro e o recurso principal do veio ou da árvore que você está coletando sempre entram.
export function filtroValido(f) {
  if (!f || typeof f !== 'object') return null;
  const r = Array.isArray(f.r) ? [...new Set(f.r.filter((v) => Number.isInteger(v) && v >= 0 && v < RARIDADES.length))].sort() : [];
  const k = Array.isArray(f.k) ? [...new Set(f.k.filter((v) => typeof v === 'string' && ITENS[v]?.mat))].sort() : [];
  return r.length || k.length ? { r, k } : null;
}
export function filtrado(p, it) {
  const f = p?.filtro; if (!f || !it || !ITENS[it.k]) return false;
  if (ehEquip(it.k)) return f.r.includes(it.r ?? 0);
  return !!ITENS[it.k].mat && f.k.includes(it.k);
}
// ---------- organizar a mochila ou o baú (André 2026-11-07, ORGANIZAR em shared/dados.js) ----------
export function grupoItem(it) {
  const d = ITENS[it.k] || {};
  if (d.lugar) return 'equip';
  if (it.k === 'tomo') return 'tomo';
  if (d.usar) return 'consumivel';
  if (d.ferramenta) return 'ferramenta';
  if (d.obra) return 'obra';
  if (it.k.startsWith('semente_')) return 'semente';
  if (d.mat) return 'material';
  return 'outro';
}
// Devolve a lista organizada, do mesmo tamanho (vazios no fim): pilhas iguais pela metade se juntam (nenhum item some
// nem duplica), depois tipo, raridade (a melhor primeiro), reforço, nome. Não mexe na lista recebida.
export function organizar(lista) {
  const pilhas = new Map(), soltos = [];
  for (const o of lista) {
    if (!o || !ITENS[o.k]) { if (o) soltos.push(o); continue; }
    if (ehEquip(o.k) || !o.n) { soltos.push({ ...o }); continue; }
    const chave = `${o.k}|${o.h || ''}|${o.nv || ''}|${o.cad ? 1 : ''}`; // pilha com cadeado fica à parte
    const p = pilhas.get(chave);
    if (p) p.n += o.n; else pilhas.set(chave, { ...o });
  }
  const itens = [...soltos];
  for (const o of pilhas.values()) {
    const max = Math.max(1, ITENS[o.k].pilha || 1);
    for (let n = o.n; n > 0; n -= max) itens.push({ ...o, n: Math.min(n, max) });
  }
  const ordem = (it) => { const g = ORGANIZAR.indexOf(grupoItem(it)); return g < 0 ? ORGANIZAR.length : g; };
  const nome = (it) => { try { return nomeItem(it); } catch { return it.k; } };
  const lugar = (it) => { const l = LUGARES.indexOf(ITENS[it.k]?.lugar); return l < 0 ? LUGARES.length : l; };
  itens.sort((a, b) => ordem(a) - ordem(b) || lugar(a) - lugar(b) || (b.r | 0) - (a.r | 0) || (b.e | 0) - (a.e | 0)
    || nome(a).localeCompare(nome(b), 'pt-BR') || (b.nv | 0) - (a.nv | 0) || (b.n | 0) - (a.n | 0));
  const r = Array(lista.length).fill(null);
  if (itens.length > r.length) return lista.map((o) => (o ? { ...o } : null)); // não cabe (nunca deve acontecer): não mexe
  itens.forEach((o, i) => { r[i] = o; });
  return r;
}
export function nomeItem(it) {
  if (!it || !ITENS[it.k]) return '';
  if (ehEquip(it.k)) return `${ITENS[it.k].nome} ${RARIDADES[it.r].nome}${it.e ? ` +${it.e}` : ''}`;
  if (it.k === 'tomo') return `${HABS[it.h].tomo} ${ROMANO[it.nv]}`;
  return ITENS[it.k].nome;
}
// ---------- durabilidade e penalidade de morte (MORTE em shared/dados.js, André 2026-11-05) ----------
export const durab = (it) => (it && Number.isInteger(it.d) ? it.d : MORTE.durMax);
export const quebrado = (it) => !!it && ehEquip(it.k) && durab(it) <= 0;
// ouro para deixar a peça inteira de novo
export const custoConserto = (it) => (it && ehEquip(it.k) && durab(it) < MORTE.durMax
  ? Math.max(1, Math.ceil((MORTE.durMax - durab(it)) / MORTE.durMax * VENDA_EQUIP[it.r] * MORTE.conserto)) : 0);
// peças que o Tomás conserta: as do corpo e as da mochila. Devolve [{ onde: 'equip' | 'mochila', l | i, custo }]
export function pecasGastas(p) {
  const r = [];
  for (const l of LUGARES) { const c = custoConserto(p.equip?.[l]); if (c) r.push({ onde: 'equip', l, custo: c }); }
  (p.mochila || []).forEach((it, i) => { const c = custoConserto(it); if (c) r.push({ onde: 'mochila', i, custo: c }); });
  return r;
}
// consertar tudo: paga e volta a durabilidade cheia. Devolve { custo, n } ou { falta } (ouro que falta) ou null (nada gasto)
export function consertarTudo(p) {
  const lista = pecasGastas(p); if (!lista.length) return null;
  const custo = lista.reduce((s, x) => s + x.custo, 0);
  if ((p.ouro || 0) < custo) return { falta: custo - (p.ouro || 0), custo };
  p.ouro -= custo;
  for (const x of lista) delete (x.onde === 'equip' ? p.equip[x.l] : p.mochila[x.i]).d;
  return { custo, n: lista.length };
}
// caiu: perde parte do ouro e cada peça do corpo desgasta. Devolve { ouro, quebrou: [nomes das que chegaram a 0] }
export function penalidadeMorte(p) {
  const ouro = Math.floor((p.ouro || 0) * MORTE.ouro);
  p.ouro = (p.ouro || 0) - ouro;
  const quebrou = [];
  for (const l of LUGARES) {
    const it = p.equip?.[l]; if (!it || !ehEquip(it.k)) continue;
    const antes = durab(it);
    if (antes <= 0) continue;
    it.d = Math.max(0, antes - MORTE.desgaste);
    if (it.d === 0) quebrou.push(nomeItem(it));
  }
  return { ouro, quebrou };
}
// ---------- reforço de equipamento (igual ao Quimera; REFORCO em shared/dados.js, André 2026-11-07) ----------
// multiplicador dos números da peça pelo reforço (+0 = 1)
export const reforcoK = (it) => { const e = it?.e | 0; return { st: 1 + REFORCO.bonus * e, critico: 1 + REFORCO.bonusCritico * e }; };
export const reforcoMax = (it) => (it && ehEquip(it.k) ? REFORCO.max[it.r] || 0 : 0);
export const chanceReforco = (e) => REFORCO.chance[Math.min(e | 0, REFORCO.chance.length - 1)];
export const custoReforco = (it) => Math.round((REFORCO.custo.base + REFORCO.custo.porRaridade * it.r) * REFORCO.custo.sobe ** (it.e | 0));
// para onde volta quando falha (nunca abaixo do último +5, +10...)
export const reforcoFalhou = (e) => Math.max(Math.floor(e / REFORCO.seguro) * REFORCO.seguro, e - 1);
// atributo que a peça pede para chegar no reforço e: { k: 'for' | 'int' | 'maior', n } (n = 0: não pede)
export function reforcoPrecisa(it, e) {
  const n = e <= REFORCO.atributo.livre ? 0 : REFORCO.atributo.porNivel * e;
  const l = ITENS[it.k]?.lugar;
  return { k: l === 'espada' ? 'for' : l === 'cajado' ? 'int' : 'maior', n };
}
// pode usar a peça com o reforço que ela tem? (Quimera: sem o atributo não equipa e, se já está no corpo, não dá bônus)
export const reforcoOk = (it, atr) => !(it?.e > 0) || atributoDoReforco(atr, reforcoPrecisa(it, it.e).k) >= reforcoPrecisa(it, it.e).n;
export const textoReforcoPrecisa = (it, atr, e = it.e | 0) => { const pr = reforcoPrecisa(it, e); return `Precisa ${pr.n} de ${nomeAtributoReforco(pr.k)} (você tem ${atributoDoReforco(atr, pr.k)})`; };
export const atributoDoReforco = (atr, k) => (k === 'maior' ? Math.max(atr?.for | 0, atr?.int | 0) : atr?.[k] | 0);
export const nomeAtributoReforco = (k) => (k === 'for' ? 'Força' : k === 'int' ? 'Inteligência' : 'Força ou Inteligência');
// Uma tentativa (o servidor sorteia). Devolve { ok, de, e, custo } ou { erro: texto }
export function reforcar(p, it, sorte = Math.random()) {
  if (!it || !ehEquip(it.k)) return { erro: 'Só equipamento se reforça' };
  const max = reforcoMax(it), de = it.e | 0;
  if (!max) return { erro: 'Peça Comum não dá pra reforçar' };
  if (de >= max) return { erro: 'Reforço no máximo!' };
  const pr = reforcoPrecisa(it, de + 1), tem = atributoDoReforco(p.atr, pr.k);
  if (tem < pr.n) return { erro: `Você não pode reforçar mais: não tem atributo suficiente (precisa ${pr.n} de ${nomeAtributoReforco(pr.k)}, você tem ${tem})` };
  const custo = custoReforco(it);
  if ((p.ouro || 0) < custo) return { erro: `Ouro insuficiente (${p.ouro || 0}/${custo})` };
  p.ouro -= custo;
  const ok = sorte * 100 < chanceReforco(de);
  const e = ok ? de + 1 : reforcoFalhou(de);
  if (e > 0) it.e = e; else delete it.e;
  return { ok, de, e, custo };
}
// Quanto a loja paga por uma unidade
export const precoVenda = (it, merc = 0) => Math.round((ehEquip(it.k) ? VENDA_EQUIP[it.r] : it.k === 'tomo' ? VENDA_TOMO * it.nv : ITENS[it.k].venda || 1) * (1 + merc));
// Quantos de um material (ou consumível) tem na mochila, e tirar n deles
export const contar = (mochila, k) => mochila.reduce((s, o) => s + (o && o.k === k && !o.h ? o.n || 1 : 0), 0);
export function tirar(mochila, k, n) {
  for (let i = mochila.length - 1; i >= 0 && n > 0; i--) {
    const o = mochila[i]; if (!o || o.k !== k || o.h) continue;
    const t = Math.min(n, o.n || 1); n -= t;
    if ((o.n || 1) - t <= 0) mochila[i] = null; else o.n -= t;
  }
}
export const mochilaNova = (paginas = 1) => Array(MOCHILA * paginas).fill(null);
// Libera páginas da mochila até n (compra com ouro ou conta de teste): cada página são MOCHILA lugares vazios no fim
export function liberarPaginas(p, n) {
  n = Math.min(MOCHILA_PAGINAS, Math.max(1, n));
  if ((p.paginas || 1) >= n && p.mochila.length >= MOCHILA * n) return false;
  p.paginas = Math.max(p.paginas || 1, n);
  while (p.mochila.length < MOCHILA * p.paginas) p.mochila.push(null);
  return true;
}
export const equipNovo = () => Object.fromEntries(LUGARES.map((l) => [l, null]));
export { ehEquip };

// Habilidades: as do Quimera (armas/armas.js e index.html), com os mesmos números e o mesmo jeito de funcionar.
// arvore: espada (escala com Força), cajado (Inteligência) ou geral (serve com as duas). libera = nível do herói.
// tipo = como a skill funciona (cada tipo tem o seu código na Simulacao e no Godot, igual a uma função do Quimera).
// pct = dano em % do dano base (+18% por nível da skill, o Lm do Quimera); nv = quanto cada campo cresce por nível;
// dur = segundos da animação; hits = segundos em que o golpe acerta; canal = segundos concentrando antes de soltar
// (andar cancela e devolve 70% da mana); at = em que parte da animação a magia sai; empurra = metros que o inimigo voa.
export const HABS = {
  // ----- espada -----
  espada_basico: { nome: 'Ataque de espada', arvore: 'espada', tipo: 'basicoEspada', basico: true, max: 5, libera: 1, pct: 0.95, alcance: 3.2, arco: 2.2, persegue: 12,
    cd: 0.5, comboZera: 0.8, empurra: 0.55, vulneravel: { k: 0.06, dur: 4 },
    combo: [{ anim: 'combo1', dur: 0.48, hit: 0.24 }, { anim: 'combo2', dur: 0.48, hit: 0.26 }, { anim: 'combo3', dur: 0.48, hit: 0.28 }, { anim: 'combo4', dur: 0.75, hit: 0.31 }], // o 4º (o golpe forte) com tempo de terminar
    desc: 'Combo de 4 cortes. Longe do alvo (até 12 m), corre até ele. Quem leva fica Quebrado (+6% de dano recebido por 4 s).' },
  corte_duplo: { tomo: 'Manual da Lâmina Gêmea', nome: 'Corte Duplo', arvore: 'espada', tipo: 'corte', libera: 1, anim: A.cruzado, dur: 0.85, hits: [0.24, 0.66], lunge: { r: 7, para: 1.6 },
    ponto: 1.7, area: 2.2, nv: { area: 0.15 }, pct: 1.1, empurra: 0.55, mana: 10, cd: 1.1, icone: 'corte',
    desc: 'Avança até o inimigo mais perto e dá dois cortes na frente.' },
  giro: { tomo: 'Livro do Redemoinho de Aço', nome: 'Giro da Lâmina', arvore: 'espada', tipo: 'giro', libera: 1, anim: A.giro, dur: 1.2, hits: [0.52, 0.74], area: 4, nv: { area: 0.24 }, pct: 0.85, empurra: 1.1,
    mana: 22, cd: 6, icone: 'giro', desc: 'Gira a espada e corta tudo em volta, duas vezes. Dá para andar girando.' },
  golpe_esmagador: { tomo: 'Tomo do Martelo da Terra', nome: 'Golpe Esmagador', arvore: 'espada', tipo: 'esmagar', libera: 5, anim: A.jump, dur: 1.25, hits: [0.71], lunge: { r: 7, para: 1.4 },
    ponto: 1.6, area: 2.8, nv: { area: 0.15 }, pct: 3.2, empurra: 0.75, atordoa: 1.5, mana: 32, cd: 10, icone: 'salto',
    desc: 'Avança e crava a espada no chão na frente. Atordoa (chefes não).' },
  pisao_sismico: { tomo: 'Crônica do Tremor', nome: 'Pisão Sísmico', arvore: 'espada', tipo: 'pisao', libera: 8, anim: A.descendente, dur: 0.8, hits: [0.42], area: 5.1, pct: 1.1, empurra: 0.35,
    atordoa: 3.8, nv: { area: 0.26, atordoa: 0.3 }, mana: 28, cd: 12, icone: 'pisao', desc: 'A espada racha o chão em volta e atordoa todo mundo perto.' },
  investida: { tomo: 'Diário do Cavaleiro Veloz', nome: 'Investida', arvore: 'espada', tipo: 'investida', libera: 14, anim: 'investida', dur: 1.1, hits: [0.48], alcance: 9, dashT: 0.36, largura: 1.6,
    alvos: 3, nv: { alvos: 1 }, pct: 1.3, cai: 0.85, empurra: 1.45, mana: 26, cd: 7, icone: 'investida',
    desc: 'Dash atravessando os inimigos em linha até o alvo (precisa de alvo a até 9 m).' },
  // ----- cajado -----
  cajado_basico: { nome: 'Faísca', arvore: 'cajado', tipo: 'basicoMagia', basico: true, max: 5, libera: 1, pct: 0.9, alcance: 9, cd: 0.5,
    lento: { k: 0.15, dur: 2 }, nv: { alcance: 0.5, lentoK: 0.025 },
    proj: { vel: 18, cor: 0xff8a3a, tam: 0.22, estilo: 'fogo', largura: 0.8, vida: 0.9 },
    // André (2026-11-03, skills de mago novas): disparo de uma mão, alternando direita e esquerda (antes: magia1/magia2)
    combo: [{ anim: 'magiaD', dur: 0.52, hit: 0.39 }, { anim: 'magiaE', dur: 0.52, hit: 0.39 }],
    desc: 'Faísca de fogo que mira sozinha no inimigo mais perto (até 9 m) e deixa lento. Não gasta mana.' },
  // André (2026-11-03): Bola de Fogo, Meteoro e Nova de Gelo com animações novas (antes A.bolt at 0.43 canal 0.55,
  // A.rain at 0.6, A.onda at 0.45 canal 0.75)
  bola_fogo: { tomo: 'Grimório das Chamas', nome: 'Bola de Fogo', arvore: 'cajado', tipo: 'bola', libera: 1, anim: A.bolaForte, at: 0.54, canal: 0.75, alcance: 11, pct: 2.2,
    proj: { vel: 16, cor: 0xff7a2a, tam: 0.26, explosao: 2.2, estilo: 'fogo' }, nv: { explosao: 0.15 }, mana: 10, cd: 1.1, icone: 'bola',
    desc: 'Cometa de fogo no alvo (até 11 m) que explode na área.' },
  anel_chamas: { tomo: 'Livro do Círculo de Fogo', nome: 'Anel de Chamas', arvore: 'cajado', tipo: 'anel', libera: 1, anim: A.ground, at: 0.6, canal: 0.6, area: 5, nv: { area: 0.3 }, pct: 1.7, empurra: 1.45,
    mana: 22, cd: 6, icone: 'explosao', desc: 'Um pulinho e o fogo explode no chão em volta de você.' },
  meteoro: { tomo: 'Códice da Estrela Cadente', nome: 'Meteoro', arvore: 'cajado', tipo: 'meteoro', libera: 5, anim: A.meteoroCeu, at: 0.76, canal: 1.4, alcance: 12, area: 6, nv: { area: 0.3 }, queda: 1.1, pct: 3.2,
    // André (2026-11-02): bola gigante do Quimera que bate no chão, explode e pega todo mundo na área (6 m, +0,3 por nível)
    empurra: 1.5, mana: 32, cd: 10, icone: 'meteoros', desc: 'Marca o chão do alvo e uma rocha gigante em chamas cai ali e explode, pegando todo mundo em volta.' },
  nova_gelo: { tomo: 'Tomo do Inverno Eterno', nome: 'Nova de Gelo', arvore: 'cajado', tipo: 'gelo', libera: 8, anim: A.novaGelo, at: 0.58, canal: 0.8, area: 6, congela: 3.8, nv: { area: 0.3, congela: 0.3 },
    pct: 1.1, empurra: 0.55, mana: 28, cd: 12, icone: 'gelo', desc: 'Onda de gelo em volta que congela os inimigos.' },
  raio_cadeia: { tomo: 'Pergaminho da Tempestade', nome: 'Raio em Cadeia', arvore: 'cajado', tipo: 'cadeia', libera: 14, anim: A.ceu, at: 0.3, canal: 0.35, alcance: 11, pula: 5.5, alvos: 3, nv: { alvos: 1 },
    pct: 1.3, cai: 0.85, mana: 26, cd: 7, icone: 'raio', desc: 'Raio da mão no alvo que pula de inimigo em inimigo.' },
  // ----- gerais (servem com espada e cajado) -----
  salto_arcano: { tomo: 'Atlas dos Passos Arcanos', nome: 'Salto Arcano', arvore: 'geral', tipo: 'teleporte', libera: 1, distancia: 5.5, nv: { distancia: 0.6 }, mana: 14, cd: 4, icone: 'salto_arcano',
    desc: 'Some e reaparece mais à frente, para onde o joystick aponta (para na parede).' },
  cura_floresta: { tomo: 'Herbário da Floresta', nome: 'Cura da Floresta', arvore: 'geral', tipo: 'cura', libera: 6, anim: A.heal, at: 0.55, canal: 0.8, curaPct: 0.22, nv: { curaPct: 0.06 }, grupo: 8,
    mana: 30, cd: 18, icone: 'cura', desc: 'Recupera vida sua; quem estiver perto (8 m) recebe metade.' },
  escudo_arcano: { tomo: 'Tratado da Égide', nome: 'Escudo Arcano', arvore: 'geral', tipo: 'escudo', libera: 10, anim: A.block, dur: 0.6, absorve: 37, nv: { absorve: 12 }, defK: 1.5, duracao: 10,
    mana: 25, cd: 20, icone: 'escudo', desc: 'Uma bolha de luz que segura o dano por 10 s (mais forte com a Defesa).' },
  vortice: { tomo: 'Livro do Vórtice', nome: 'Abraço do Vórtice', arvore: 'geral', tipo: 'puxar', libera: 1, anim: A.vortice, at: 0.3, canal: 0.4, area: 8, nv: { area: 0.4 }, atordoa: 0.32,
    mana: 24, cd: 16, icone: 'vortice', desc: 'Puxa os inimigos em volta para perto de você (não puxa chefes). Não tira vida.' },
};
// Passivas: valem sozinhas a partir do nível do herói
export const PASSIVAS = {
  pele_pedra: { nome: 'Pele de Pedra', libera: 3, desc: 'Defesa +3' },
  mente_arcana: { nome: 'Mente Arcana', libera: 4, desc: 'Mana máx. +10% · regeneração de mana +0,3/s' },
  sorte_arcana: { nome: 'Sorte Arcana', libera: 7, desc: 'Crítico +2%' },
};
export const SKILL_MAX = 10;
export const NIVEL_SEM_TOMO = 5; // até aqui a skill sobe só usando; do 6 ao 10 precisa do Tomo (Quimera)
// Duas barras, como no Quimera: a da espada e a do cajado (Trocar mostra a outra). As gerais servem nas duas.
// Padrão: as skills de espada numa e as de magia na outra, na ordem do Quimera; dá para mudar no menu.
export const N_BOTOES = 6;
// O tiro básico do cajado sai andando, a esta fração da velocidade normal (corrida 5,4 m/s -> 3,2 m/s). André 2026-11-03: mais lento e fluido (era 0,7).
// Golpe de espada e skills plantam o pé: mexer o joystick depois do golpe corta o resto (escolha do André, 2026-11-01).
export const ANDAR_ATIRANDO = 0.6;
export const BARRAS = ['espada', 'cajado'];
export const BOTOES_PADRAO = {
  espada: ['corte_duplo', 'giro', 'golpe_esmagador', 'pisao_sismico', 'investida', 'vortice'],
  cajado: ['bola_fogo', 'anel_chamas', 'salto_arcano', 'meteoro', 'nova_gelo', 'raio_cadeia'],
};
// a skill serve nessa barra? (espada só na da espada, cajado só na do cajado, geral nas duas)
export const cabeNaBarra = (id, barra) => !!HABS[id] && !HABS[id].basico && (HABS[id].arvore === 'geral' || HABS[id].arvore === barra);

// Usos para subir a skill do nível nv para nv+1
export const usosParaSubir = (nv) => 6 + 4 * nv;

// Números da skill no nível dela, como no Quimera: dano +18% (Lm), recarga -6% e cada campo de nv somado por nível
export function habNoNivel(id, nv) {
  const h = HABS[id]; if (!h) return null;
  const k = nv - 1;
  const r = { ...h, nv, pct: (h.pct || 0) * (1 + 0.18 * k) };
  if (h.cd && !h.basico) r.cd = +(h.cd * (1 - 0.06 * k)).toFixed(3);
  for (const [c, v] of Object.entries(h.nv || {})) {
    if (c === 'explosao') r.proj = { ...h.proj, explosao: +(h.proj.explosao + v * k).toFixed(3) };
    else if (c === 'lentoK') r.lento = { ...h.lento, k: +(h.lento.k + v * k).toFixed(3) };
    else r[c] = +(h[c] + v * k).toFixed(3);
  }
  return r;
}

export function progressoNovo() {
  // começa com umas poções e um pouco de ouro (conta antiga ganha o mesmo na primeira vez)
  const mochila = mochilaNova(); mochila[0] = { k: 'pocao', n: 3 }; mochila[1] = { k: 'pocao_mana', n: 2 };
  return { nivel: 1, xp: 0, pontos: 0, atr: { for: 3, des: 3, int: 3, vit: 3 }, habs: {}, barras: barrasPadrao(), ouro: 20, mochila, paginas: 1, equip: equipNovo(),
    vigor: { v: VIGOR.max, t: Date.now() }, prof: profNovo(), semCapacete: false };
}
export const profNovo = () => Object.fromEntries(Object.keys(PROFISSOES).map((k) => [k, 0]));
// Confere o que veio da conta (ou de um cliente) e devolve um progresso válido
export function progressoValido(p) {
  const n = progressoNovo();
  if (!p || typeof p !== 'object') return n;
  const int = (v, lo, hi, d) => (Number.isInteger(v) && v >= lo && v <= hi ? v : d);
  n.nivel = int(p.nivel, 1, NIVEL_MAX, 1);
  n.xp = int(p.xp, 0, 1e9, 0);
  for (const k of Object.keys(n.atr)) n.atr[k] = int(p.atr?.[k], 3, 3 + PONTOS_POR_NIVEL * NIVEL_MAX, 3);
  const gastos = Object.values(n.atr).reduce((s, v) => s + v - 3, 0);
  n.pontos = Math.max(0, PONTOS_POR_NIVEL * (n.nivel - 1) - gastos);
  for (const [id, s] of Object.entries(p.habs || {})) if (HABS[id]) n.habs[id] = { nv: int(s?.nv, 1, HABS[id].max || SKILL_MAX, 1), uso: int(s?.uso, 0, 1e6, 0) };
  // conta antiga (uma barra só, campo botoes): começa com as barras padrão
  for (const b of BARRAS) n.barras[b] = barraValida(p.barras?.[b], b) || n.barras[b];
  // mochila e equipamento (conta de antes da mochila: fica com o começo de progressoNovo)
  if (Array.isArray(p.mochila)) {
    n.ouro = int(p.ouro, 0, 1e9, 0);
    // páginas compradas (conta de antes das páginas: 1). Nada some: item que estava num lugar que não existe mais
    // (mochila antiga maior que a de agora) vai para o primeiro lugar vazio; se não couber, a conta ganha a página.
    n.paginas = int(p.paginas, 1, MOCHILA_PAGINAS, 1);
    n.mochila = mochilaNova(n.paginas);
    const sobra = [];
    p.mochila.forEach((it, i) => { const v = itemValido(it); if (!v) return; if (i < n.mochila.length) n.mochila[i] = v; else sobra.push(v); });
    for (const v of sobra) {
      let i = n.mochila.indexOf(null);
      if (i < 0 && n.paginas < MOCHILA_PAGINAS) { liberarPaginas(n, n.paginas + 1); i = n.mochila.indexOf(null); }
      if (i < 0) { n.mochila.push(v); continue; } // última garantia: nunca joga item fora
      n.mochila[i] = v;
    }
    for (const l of LUGARES) { const it = itemValido(p.equip?.[l]); n.equip[l] = it && ITENS[it.k].lugar === l ? it : null; }
  }
  // vigor e profissões (conta de antes: vigor cheio e tudo no Nv 1)
  const agora = Date.now(), num = (v) => typeof v === 'number' && Number.isFinite(v);
  if (p.vigor && num(p.vigor.v) && num(p.vigor.t)) n.vigor = { v: Math.min(VIGOR.max, Math.max(0, p.vigor.v)), t: Math.min(agora, p.vigor.t) };
  for (const k of Object.keys(n.prof)) n.prof[k] = num(p.prof?.[k]) ? Math.min(1e7, Math.max(0, p.prof[k])) : 0;
  // capacete escondido (André 2026-11-03: opção na tela de equipamento); continua equipado e dando o bônus
  n.semCapacete = p.semCapacete === true;
  // onde o herói estava ao sair (André 2026-11-03: entra de volta no mesmo lugar; só a morte leva para a vila).
  // A Simulacao confere se o lugar ainda está dentro do mapa. Sem pos = nasce na vila.
  const q = p.pos;
  if (q && [q.x, q.y, q.z, q.ry].every((v) => num(v) && Math.abs(v) < 1e4)) n.pos = { x: q.x, y: q.y, z: q.z, ry: q.ry };
  // relógio do dia da conta (depois de dormir) e quando a cama deu vigor pela última vez (ms, relógio do servidor)
  if (p.dia && num(p.dia.h) && num(p.dia.t) && p.dia.h >= 0 && p.dia.h < 24) n.dia = { h: p.dia.h, t: Math.min(agora, p.dia.t) };
  if (num(p.camaT) && p.camaT > 0) n.camaT = Math.min(agora, p.camaT);
  const filtro = filtroValido(p.filtro); if (filtro) n.filtro = filtro; // filtro de coleta da mochila
  if (num(p.agua) && p.agua >= 0) n.agua = Math.min(Math.floor(p.agua), HORTA.agua); // água do regador (sem o campo = cheio)
  // recarga do Voltar para a vila (relógio do servidor, ms): não zera saindo e entrando
  if (num(p.vilaAte) && p.vilaAte > agora) n.vilaAte = Math.min(p.vilaAte, agora + VOLTA_VILA.cd * 1000);
  return n;
}
export const barrasPadrao = () => Object.fromEntries(BARRAS.map((b) => [b, [...BOTOES_PADRAO[b]]]));
// 6 botões: só skill que serve nessa barra, sem repetir (null = vazio). Devolve null se não for uma lista de 6.
export function barraValida(lista, barra) {
  if (!Array.isArray(lista) || lista.length !== N_BOTOES) return null;
  const vistos = new Set();
  return lista.map((k) => { if (typeof k !== 'string' || !cabeNaBarra(k, barra) || vistos.has(k)) return null; vistos.add(k); return k; });
}
export const passivasDe = (p) => Object.fromEntries(Object.entries(PASSIVAS).map(([k, v]) => [k, p.nivel >= v.libera]));

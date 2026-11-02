// Progressão do herói (ideia do Quimera): nível e XP, atributos, habilidades que sobem de nível com o uso e 6 botões
// escolhidos no menu do personagem. Quem guarda e decide é o servidor (Simulacao + conta); o app só mostra.
import { A, ITENS, RARIDADES, LUGARES, MOCHILA, CONJUNTO, VENDA_EQUIP, VENDA_TOMO, ROMANO, ESTAMINA, VIGOR, PROFISSOES, PROF_MAX, MERCADOR, RARIDADE_CRIAR } from './dados.js';

// Atributos: começam em 3; cada nível dá PONTOS_POR_NIVEL para distribuir
export const ATRIBUTOS = {
  for: { nome: 'Força', desc: '+6% dano físico (espada) · +4 vida · +1 defesa' },
  des: { nome: 'Destreza', desc: '+5 estamina · +0,15% crítico · -1,3% recarga' },
  int: { nome: 'Inteligência', desc: '+6% dano mágico (cajado) · +6 mana' },
  vit: { nome: 'Vitalidade', desc: '+8 vida · regeneração' },
};
export const PONTOS_POR_NIVEL = 2;
export const NIVEL_MAX = 30;
export const xpProximo = (nivel) => Math.round(16 * nivel ** 1.45);
// XP por inimigo derrubado (vai para quem bateu nele ou estava perto)
export const XP_INIMIGO = { puglin: 6, imp: 8, chefe: 25, sombrio: 6, lider: 20 };

// Números do herói a partir do nível, dos atributos e do equipamento (nível 1 com tudo em 3 e sem nada = vida 120, mana 100, dano 10)
export function calcularStatus(p, passivas = {}) {
  const a = p.atr, n = p.nivel, eq = bonusEquip(p.equip);
  const nivelK = 1 + 0.08 * (n - 1);
  const def = a.for + (passivas.pele_pedra ? 3 : 0) + eq.defesa;
  return {
    vidaMax: Math.round(84 + 8 * a.vit + 4 * a.for + 6 * (n - 1) + eq.vida),
    manaMax: Math.round((82 + 6 * a.int + 2 * (n - 1) + eq.mana) * (passivas.mente_arcana ? 1.1 : 1)),
    regenMana: (7 + (passivas.mente_arcana ? 0.3 : 0)) * (1 + eq.regenManaK),
    regenVida: 0.1 * a.vit,
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
  const r = (l) => (equip[l] ? equip[l].r : -1);
  const lugares = [r('cabeca'), r('corpo'), r('pernas'), r('capa'), r('pes'), r('acessorio'), Math.max(r('espada'), r('cajado'))];
  return RARIDADES.map((_, i) => lugares.filter((x) => x >= i).length);
}
// Soma das peças e do bônus de conjunto (o melhor de 2, 3 e 6 peças)
export function bonusEquip(equip = {}) {
  const b = { vida: 0, mana: 0, defesa: 0, critico: 0, danoFisico: 0, danoMagico: 0, danoK: 0, areaK: 0, regenManaK: 0 };
  for (const l of LUGARES) {
    const it = equip?.[l]; if (!it || !ITENS[it.k]) continue;
    for (const [c, v] of Object.entries(ITENS[it.k].st)) b[c] += v[it.r];
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
const ANTIGOS = { manto: 'peitoral' };
export function itemValido(it) {
  // conta antiga: o Manto virou Peitoral (uma linha só de armadura)
  if (it && typeof it === 'object' && ANTIGOS[it.k]) it = { ...it, k: ANTIGOS[it.k] };
  if (!it || typeof it !== 'object' || !ITENS[it.k]) return null;
  const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
  if (ehEquip(it.k)) return int(it.r, 0, RARIDADES.length - 1) ? { k: it.k, r: it.r } : null;
  const n = int(it.n, 1, ITENS[it.k].pilha) ? it.n : 1;
  if (it.k === 'tomo') return HABS[it.h]?.tomo && int(it.nv, 6, SKILL_MAX) ? { k: 'tomo', h: it.h, nv: it.nv, n } : null;
  return { k: it.k, n };
}
const mesmo = (a, b) => a && b && a.k === b.k && a.h === b.h && a.nv === b.nv;
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
export function nomeItem(it) {
  if (!it || !ITENS[it.k]) return '';
  if (ehEquip(it.k)) return `${ITENS[it.k].nome} ${RARIDADES[it.r].nome}`;
  if (it.k === 'tomo') return `${HABS[it.h].tomo} ${ROMANO[it.nv]}`;
  return ITENS[it.k].nome;
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
export const mochilaNova = () => Array(MOCHILA).fill(null);
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
    combo: [{ anim: 'magia1', dur: 0.58, hit: 0.17 }, { anim: 'magia2', dur: 0.58, hit: 0.17 }],
    desc: 'Faísca de fogo que mira sozinha no inimigo mais perto (até 9 m) e deixa lento. Não gasta mana.' },
  bola_fogo: { tomo: 'Grimório das Chamas', nome: 'Bola de Fogo', arvore: 'cajado', tipo: 'bola', libera: 1, anim: A.bolt, at: 0.43, canal: 0.55, alcance: 11, pct: 2.2,
    proj: { vel: 16, cor: 0xff7a2a, tam: 0.26, explosao: 2.2, estilo: 'fogo' }, nv: { explosao: 0.15 }, mana: 10, cd: 1.1, icone: 'bola',
    desc: 'Cometa de fogo no alvo (até 11 m) que explode na área.' },
  anel_chamas: { tomo: 'Livro do Círculo de Fogo', nome: 'Anel de Chamas', arvore: 'cajado', tipo: 'anel', libera: 1, anim: A.ground, at: 0.6, canal: 0.6, area: 5, nv: { area: 0.3 }, pct: 1.7, empurra: 1.45,
    mana: 22, cd: 6, icone: 'explosao', desc: 'Um pulinho e o fogo explode no chão em volta de você.' },
  meteoro: { tomo: 'Códice da Estrela Cadente', nome: 'Meteoro', arvore: 'cajado', tipo: 'meteoro', libera: 5, anim: A.rain, at: 0.6, canal: 1.4, alcance: 12, area: 5, nv: { area: 0.3 }, queda: 0.75, pct: 3.2,
    empurra: 1.1, mana: 32, cd: 10, icone: 'meteoros', desc: 'Marca o chão do alvo e uma rocha em chamas cai ali.' },
  nova_gelo: { tomo: 'Tomo do Inverno Eterno', nome: 'Nova de Gelo', arvore: 'cajado', tipo: 'gelo', libera: 8, anim: A.onda, at: 0.45, canal: 0.75, area: 6, congela: 3.8, nv: { area: 0.3, congela: 0.3 },
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
// O tiro básico do cajado sai andando, a esta fração da velocidade normal (corrida 5,4 m/s -> 3,8 m/s).
// Golpe de espada e skills plantam o pé: mexer o joystick depois do golpe corta o resto (escolha do André, 2026-11-01).
export const ANDAR_ATIRANDO = 0.7;
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
  return { nivel: 1, xp: 0, pontos: 0, atr: { for: 3, des: 3, int: 3, vit: 3 }, habs: {}, barras: barrasPadrao(), ouro: 20, mochila, equip: equipNovo(),
    vigor: { v: VIGOR.max, t: Date.now() }, prof: profNovo() };
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
    n.mochila = mochilaNova();
    p.mochila.slice(0, MOCHILA).forEach((it, i) => { n.mochila[i] = itemValido(it); });
    for (const l of LUGARES) { const it = itemValido(p.equip?.[l]); n.equip[l] = it && ITENS[it.k].lugar === l ? it : null; }
  }
  // vigor e profissões (conta de antes: vigor cheio e tudo no Nv 1)
  const agora = Date.now(), num = (v) => typeof v === 'number' && Number.isFinite(v);
  if (p.vigor && num(p.vigor.v) && num(p.vigor.t)) n.vigor = { v: Math.min(VIGOR.max, Math.max(0, p.vigor.v)), t: Math.min(agora, p.vigor.t) };
  for (const k of Object.keys(n.prof)) n.prof[k] = num(p.prof?.[k]) ? Math.min(1e7, Math.max(0, p.prof[k])) : 0;
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

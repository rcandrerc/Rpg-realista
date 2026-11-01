// Progressão do herói (ideia do Quimera): nível e XP, atributos, habilidades que sobem de nível com o uso e 6 botões
// escolhidos no menu do personagem. Quem guarda e decide é o servidor (Simulacao + conta); o app só mostra.
import { A } from './dados.js';

// Atributos: começam em 3; cada nível dá PONTOS_POR_NIVEL para distribuir
export const ATRIBUTOS = {
  for: { nome: 'Força', desc: '+6% dano físico (espada) · +4 vida · +1 defesa' },
  des: { nome: 'Destreza', desc: '+0,15% crítico · -1,3% recarga' },
  int: { nome: 'Inteligência', desc: '+6% dano mágico (cajado) · +6 mana' },
  vit: { nome: 'Vitalidade', desc: '+8 vida · regeneração' },
};
export const PONTOS_POR_NIVEL = 2;
export const NIVEL_MAX = 30;
export const xpProximo = (nivel) => Math.round(16 * nivel ** 1.45);
// XP por inimigo derrubado (vai para quem bateu nele ou estava perto)
export const XP_INIMIGO = { puglin: 6, imp: 8, chefe: 25, sombrio: 6, lider: 20 };

// Números do herói a partir do nível e dos atributos (nível 1 com tudo em 3 = vida 120, mana 100, dano 10)
export function calcularStatus(p, passivas = {}) {
  const a = p.atr, n = p.nivel;
  const nivelK = 1 + 0.08 * (n - 1);
  const def = a.for + (passivas.pele_pedra ? 3 : 0);
  return {
    vidaMax: Math.round(84 + 8 * a.vit + 4 * a.for + 6 * (n - 1)),
    manaMax: Math.round((82 + 6 * a.int + 2 * (n - 1)) * (passivas.mente_arcana ? 1.1 : 1)),
    regenMana: 7 + (passivas.mente_arcana ? 0.3 : 0),
    regenVida: 0.1 * a.vit,
    defesa: def,
    reducao: def / (def + 24), // fração do dano que a defesa segura
    danoFisico: 10 * nivelK * (1 + 0.06 * (a.for - 3)),
    danoMagico: 10 * nivelK * (1 + 0.06 * (a.int - 3)),
    critico: Math.min(1, 0.0455 + 0.0015 * a.des + (passivas.sorte_arcana ? 0.02 : 0)),
    recarga: Math.min(0.4, 0.0133 * a.des), // fração a menos no tempo de recarga
  };
}

// Habilidades. arvore: espada (escala com Força), cajado (Inteligência) ou geral. libera = nível do herói.
// pct = dano em % do dano base; max = nível máximo da skill. Os campos de efeito são os mesmos da Simulacao
// (area, alcance/arco, proj, raios, chuva, cura, hits, avanco...) e mais: atordoa, congela, lento, vulneravel, escudo, salto, cadeia.
export const HABS = {
  // ----- espada -----
  espada_basico: { nome: 'Ataque de espada', arvore: 'espada', basico: true, max: 5, libera: 1, pct: 0.95, alcance: 2.3, arco: 1.6, cd: 0.15, lamina: true,
    vulneravel: { k: 0.06, dur: 4 }, combo: [{ anim: 'combo1', ts: 1.45, at: 0.5, pct: 0.95 }, { anim: 'combo2', ts: 1.45, at: 0.53, pct: 1.0 },
      { anim: 'combo3', ts: 1.45, at: 0.58, pct: 1.05 }, { anim: 'combo4', ts: 1.35, at: 0.41, pct: 1.55 }],
    desc: 'Combo de 4 cortes. Quem leva fica vulnerável (+6% de dano recebido por 4 s).' },
  corte_duplo: { nome: 'Corte Duplo', arvore: 'espada', libera: 1, anim: A.cruzado, ts: 1.3, hits: [0.35, 0.6], pct: 1.1, alcance: 2.4, arco: 2.6, mana: 10, cd: 1.1, lamina: true, fx: true, icone: 'corte',
    desc: 'Dois cortes em cruz na frente.' },
  giro: { nome: 'Giro da Lâmina', arvore: 'espada', libera: 1, anim: A.giro, ts: 1.2, hits: [0.52, 0.74], pct: 0.85, area: 4, mana: 22, cd: 5.8, lamina: true, fx: true, icone: 'giro',
    desc: 'Salta girando e corta tudo em volta, duas vezes.' },
  golpe_esmagador: { nome: 'Golpe Esmagador', arvore: 'espada', libera: 5, anim: A.jump, ts: 1.1, at: 0.55, pct: 3.2, area: 2.8, avanco: 3.5, atordoa: 1.5, mana: 32, cd: 9.6, lamina: true, fx: true, efeito: 'salto', icone: 'salto',
    desc: 'Pula para a frente e crava a espada no chão. Atordoa.' },
  pisao_sismico: { nome: 'Pisão Sísmico', arvore: 'espada', libera: 8, anim: A.descendente, ts: 1.15, at: 0.45, pct: 1.1, area: 5.1, atordoa: 3.8, mana: 28, cd: 11.6, lamina: true, fx: true, efeito: 'pisao', icone: 'pisao',
    desc: 'A espada racha o chão em volta e atordoa todo mundo perto.' },
  investida: { nome: 'Investida', arvore: 'espada', libera: 14, anim: 'investida', ts: 1.5, hits: [0.22, 0.78], pct: 1.3, alcance: 2.8, arco: 2.4, avanco: 9, avancoT: 0.2, mana: 26, cd: 6.7, lamina: true, fx: true, dash: true, impacto: true, icone: 'investida',
    desc: 'Dash até o alvo e já crava a estocada, depois um corte.' },
  // ----- cajado -----
  cajado_basico: { nome: 'Ataque básico', arvore: 'cajado', basico: true, max: 5, libera: 1, pct: 0.9, cd: 0.15, lento: { k: 0.15, dur: 2 },
    proj: { vel: 18, cor: 0x9a6bff, tam: 0.24, estilo: 'arcano', largura: 0.8, vida: 0.5 },
    combo: [{ anim: 'magia1', ts: 1.5, at: 0.34, pct: 0.9 }, { anim: 'magia2', ts: 1.5, at: 0.44, pct: 0.95 }, { anim: 'magia3', ts: 1.35, at: 0.4, pct: 1.3 }],
    desc: 'Tiros de energia que deixam o alvo lento. Não gasta mana.' },
  bola_fogo: { nome: 'Bola de Fogo', arvore: 'cajado', libera: 1, anim: A.bolt, ts: 1.7, at: 0.43, pct: 2.2, proj: { vel: 14, cor: 0xff7a2a, tam: 0.26, explosao: 2.2, estilo: 'fogo' }, mana: 10, cd: 1.1, fx: true, icone: 'bola',
    desc: 'Cometa de fogo que explode no alvo.' },
  anel_chamas: { nome: 'Anel de Chamas', arvore: 'cajado', libera: 1, anim: A.ground, ts: 1.6, at: 0.6, pct: 1.7, area: 5, mana: 22, cd: 5.8, fx: true, efeito: 'explosao', icone: 'explosao',
    desc: 'Fogo explode no chão em volta de você.' },
  meteoro: { nome: 'Meteoro', arvore: 'cajado', libera: 5, anim: A.rain, ts: 1.2, at: 0.6, pct: 1.1, chuva: { r: 5, ondas: 3 }, mana: 32, cd: 9.6, fx: true, icone: 'meteoros',
    desc: 'Meteoros caem na área do alvo.' },
  nova_gelo: { nome: 'Nova de Gelo', arvore: 'cajado', libera: 8, anim: A.onda, ts: 1.8, at: 0.45, pct: 1.1, area: 6, congela: 3.8, mana: 28, cd: 11.6, fx: true, efeito: 'gelo', icone: 'gelo',
    desc: 'Onda de gelo em volta que congela os inimigos.' },
  raio_cadeia: { nome: 'Raio em Cadeia', arvore: 'cajado', libera: 14, anim: A.ceu, ts: 1.3, at: 0.3, pct: 1.3, raios: { n: 3, alcance: 14 }, mana: 26, cd: 6.7, fx: true, icone: 'raio',
    desc: 'Raios do céu pulam de inimigo em inimigo (3 alvos).' },
  // ----- gerais (servem com espada e cajado) -----
  salto_arcano: { nome: 'Salto Arcano', arvore: 'geral', libera: 1, anim: 'mortal', ts: 1.4, at: 0.2, salto: 5.5, mana: 14, cd: 3.9, icone: 'salto_arcano',
    desc: 'Some e reaparece mais à frente.' },
  cura_floresta: { nome: 'Cura da Floresta', arvore: 'geral', libera: 6, anim: A.heal, ts: 1.2, at: 0.55, curaPct: 0.22, grupo: { r: 8, pct: 0.11 }, mana: 30, cd: 17.4, fx: true, icone: 'cura',
    desc: 'Recupera vida sua e um pouco de quem estiver perto.' },
  escudo_arcano: { nome: 'Escudo Arcano', arvore: 'geral', libera: 10, anim: A.block, ts: 1, at: 0.3, escudo: { absorve: 42, dur: 10 }, mana: 25, cd: 19.3, fx: true, icone: 'escudo',
    desc: 'Uma bolha de luz que segura o dano por 10 s.' },
  vortice: { nome: 'Abraço do Vórtice', arvore: 'geral', libera: 1, anim: A.vortice, ts: 1.3, at: 0.3, puxa: { r: 8, de: 0.12 }, mana: 24, cd: 15.4, fx: true, icone: 'vortice',
    desc: 'Puxa os inimigos em volta para perto de você.' },
};
// Passivas: valem sozinhas a partir do nível do herói
export const PASSIVAS = {
  pele_pedra: { nome: 'Pele de Pedra', libera: 3, desc: 'Defesa +3' },
  mente_arcana: { nome: 'Mente Arcana', libera: 4, desc: 'Mana máx. +10% · regeneração de mana +0,3/s' },
  sorte_arcana: { nome: 'Sorte Arcana', libera: 7, desc: 'Crítico +2%' },
};
export const SKILL_MAX = 10;
export const BOTOES_PADRAO = ['corte_duplo', 'giro', 'bola_fogo', 'anel_chamas', 'salto_arcano', 'vortice'];
export const N_BOTOES = 6;

// Usos para subir a skill do nível nv para nv+1
export const usosParaSubir = (nv) => 6 + 4 * nv;

// Números da skill no nível dela: dano +15%, área +5% e recarga -6% por nível
export function habNoNivel(id, nv) {
  const h = HABS[id]; if (!h) return null;
  const k = nv - 1;
  const r = { ...h, nv, pct: h.pct * (1 + 0.15 * k) };
  if (h.area) r.area = +(h.area * (1 + 0.05 * k)).toFixed(2);
  if (h.cd && !h.basico) r.cd = +(h.cd * (1 - 0.06 * k)).toFixed(2);
  if (h.combo) r.combo = h.combo.map((c) => ({ ...c, pct: c.pct * (1 + 0.15 * k) }));
  if (h.escudo) r.escudo = { ...h.escudo, absorve: Math.round(h.escudo.absorve * (1 + 0.15 * k)) };
  if (h.curaPct) r.curaPct = h.curaPct * (1 + 0.08 * k);
  if (h.salto) r.salto = +(h.salto * (1 + 0.04 * k)).toFixed(2);
  return r;
}

export function progressoNovo() {
  return { nivel: 1, xp: 0, pontos: 0, atr: { for: 3, des: 3, int: 3, vit: 3 }, habs: {}, botoes: [...BOTOES_PADRAO] };
}
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
  if (Array.isArray(p.botoes) && p.botoes.length === N_BOTOES) n.botoes = p.botoes.map((b) => (HABS[b] && !HABS[b].basico ? b : null));
  return n;
}
export const passivasDe = (p) => Object.fromEntries(Object.entries(PASSIVAS).map(([k, v]) => [k, p.nivel >= v.libera]));

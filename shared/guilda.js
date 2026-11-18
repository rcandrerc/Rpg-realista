// Guilda dos Aventureiros (André 2026-11-18): o mural de contratos e a Brenda na Casa do Comércio do Rio Claro, com
// ranks de F a SS (GUILDA em shared/dados.js). Todo dia (meia-noite de Brasília, como as diárias) o mural oferece
// GUILDA.porDia contratos do rank; pega até GUILDA.ativos de uma vez (perto do mural ou da Brenda) e recebe em
// qualquer lugar (Missões > Guilda). O que conta passa pelo mesmo funil da história (Simulacao.historia chama
// contarGuilda). Subir de rank: pontos de guilda (pg) cheios + nível do próximo rank + vencer a Prova (um monstro do
// campo da sua faixa vira um elite forte quando você chega perto, como os chefes da história).
// Estado na conta: prog.guilda = { r: rank (0 = F), pg, d: 'AAAA-MM-DD', of: [{ id, k, n, a }] (ofertas do dia),
// at: { id: quanto } (pegos), f: [ids recebidos], pv: 1 (Prova aceita) }.
import { GUILDA, CATALISADOR, ITENS } from './dados.js';
import { xpProximo, NIVEL_MAX, guardar } from './progresso.js';
import { diaDiarias, fimDoDia } from './diarias.js';
import { zonaFechadaEm } from './historia.js';

const RANKS = GUILDA.ranks, ULTIMO = RANKS.length - 1;
const r2 = (n) => Math.round(n * 100) / 100;
// sorteio que dá sempre o mesmo para a mesma conta no mesmo dia (as ofertas não mudam ao sair e entrar)
function sorteio(semente) {
  let h = 2166136261;
  for (const c of String(semente)) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); h ^= h >>> 16; return (h >>> 0) / 4294967296; };
}
const nDe = (k, r) => GUILDA.tipos[k]?.n[r] | 0;
// as ofertas do dia para o rank r, herói no nível nv: a = nível mínimo do monstro na caça (a sua faixa)
export function ofertasGuilda(semente, r, nv) {
  const rnd = sorteio(semente), pode = (k) => nDe(k, r) > 0;
  const quer = ['caca', pode('elite') ? 'elite' : 'caca', rnd() < 0.5 ? 'coleta' : 'pesca', pode('pack') && rnd() < 0.5 ? 'pack' : (rnd() < 0.5 ? 'pesca' : 'coleta'), rnd() < 0.6 ? 'caca' : (pode('elite') ? 'elite' : 'coleta')];
  return quer.slice(0, GUILDA.porDia).map((k, i) => ({ id: `c${i}`, k, n: nDe(k, r), ...(k === 'caca' ? { a: Math.max(1, nv - GUILDA.faixa) } : {}) }));
}
// o texto de um contrato ("Derrube 20 monstros Nv 30+")
export const textoContrato = (O) => GUILDA.tipos[O.k].txt.replace('{n}', O.n).replace('{a}', O.a ?? 1);
// o que um contrato paga no rank r e nível nv
export function premioGuilda(r, nv) {
  const R = RANKS[r];
  return { ouro: R.ouro * nv, xp: nv >= NIVEL_MAX ? 0 : Math.max(1, Math.round(xpProximo(nv) * R.xp)), pg: R.pg1 };
}

// confere o que veio da conta (progressoValido); do dia que passou ficam o rank e os pontos
export function guildaValida(v) {
  if (!v || typeof v !== 'object') return null;
  const r = Number.isInteger(v.r) ? Math.max(0, Math.min(ULTIMO, v.r)) : 0;
  const pg = Number.isInteger(v.pg) ? Math.max(0, Math.min(RANKS[r].pg || 1e9, v.pg)) : 0;
  const g = { r, pg };
  if (typeof v.d === 'string' && /^\d{4}-\d\d-\d\d$/.test(v.d) && Array.isArray(v.of)) {
    const of = v.of.filter((O) => O && typeof O.id === 'string' && GUILDA.tipos[O.k] && Number.isInteger(O.n) && O.n > 0).slice(0, GUILDA.porDia)
      .map((O) => ({ id: O.id, k: O.k, n: O.n, ...(Number.isInteger(O.a) ? { a: O.a } : {}) }));
    const ids = new Set(of.map((O) => O.id)), at = {};
    for (const [id, q] of Object.entries(v.at || {})) if (ids.has(id) && Number.isInteger(q) && q >= 0 && Object.keys(at).length < GUILDA.ativos) at[id] = Math.min(q, of.find((O) => O.id === id).n);
    const f = Array.isArray(v.f) ? [...new Set(v.f.filter((id) => ids.has(id) && !(id in at)))] : [];
    Object.assign(g, { d: v.d, of, at, f });
  }
  if (v.pv === 1) g.pv = 1;
  return g;
}

export const Guilda = {
  temGuilda(j) { return !!j && !j.bot && (j.prog?.nivel || 0) >= GUILDA.nivel; },
  // o estado da guilda da conta (vira o dia sozinho: ofertas novas, os pegos e recebidos de ontem saem)
  guildaDe(j) {
    const p = j.prog, hoje = diaDiarias(this.agoraMs());
    const g = (p.guilda ||= { r: 0, pg: 0 });
    if (g.d !== hoje || !Array.isArray(g.of)) {
      Object.assign(g, { d: hoje, of: ofertasGuilda(`${j.conta ?? j.id}:${hoje}:${g.r}`, g.r, p.nivel), at: {}, f: [] });
      j.progSujo = true;
    }
    return g;
  },
  pertoDaGuilda(j) { return (this.mapa.npcs || []).some((n) => (n.funcao === 'guilda' || n.funcao === 'mural') && Math.hypot(n.x - j.x, n.z - j.z) < GUILDA.perto); },
  // pode fazer a Prova: pontos cheios e nível do próximo rank
  podeProva(j) { const g = j.prog.guilda; return !!g && g.r < ULTIMO && g.pg >= RANKS[g.r].pg && j.prog.nivel >= RANKS[g.r + 1].nv; },
  // algo aconteceu (o mesmo ev/d da história): conta nos contratos pegos que casam e na Prova
  contarGuilda(j, ev, d = {}) {
    if (!this.temGuilda(j)) return;
    const g = this.guildaDe(j);
    if (g.pv === 1 && ev === 'matar' && d.hc === `gp:${j.id}`) return this.subirRank(j);
    let mudou = false;
    for (const id of Object.keys(g.at)) {
      const O = g.of.find((o) => o.id === id), T = O && GUILDA.tipos[O.k];
      if (!T || T.ev !== ev || g.at[id] >= O.n) continue;
      if (O.k === 'caca' && ((d.nivel || 0) < (O.a || 1) || /^g[ep]:/.test(String(d.hc || '')))) continue; // elite da guilda não conta na caça
      if (O.k === 'elite' && !String(d.hc || '').startsWith('ge:')) continue; // a elite de qualquer um do time vale
      if (O.k === 'coleta' && !T.tipos.includes(d.tipo)) continue;
      g.at[id] = Math.min(O.n, g.at[id] + Math.max(1, d.n | 0)); mudou = true;
      if (g.at[id] >= O.n) this.evento({ t: 'aviso', para: j.id, texto: `Contrato feito: ${textoContrato(O)}! Receba em Missões > Guilda` });
    }
    if (mudou) { j.progSujo = true; this.avisarProgUmaVez(j); }
  },
  subirRank(j) {
    const g = j.prog.guilda; if (g.r >= ULTIMO) return;
    g.r++; g.pg = 0; delete g.pv; j.progSujo = true;
    const R = RANKS[g.r];
    this.evento({ t: 'aviso', para: j.id, texto: `Prova vencida! Agora você é Rank ${R.r} da Guilda` });
    this.evento({ t: 'guilda', para: j.id, rank: R.r });
    this.ganharTitulo(j, `guilda_${R.r}`);
    this.avisarProg(j);
  },
  // o resumo que o app desenha (vai junto do progresso)
  guildaInfo(j) {
    if (!this.temGuilda(j)) return null;
    const g = this.guildaDe(j), R = RANKS[g.r], P = RANKS[g.r + 1], pr = premioGuilda(g.r, j.prog.nivel), agora = this.agoraMs();
    return { rank: R.r, r: g.r, pg: g.pg, pgMax: R.pg || 0, prox: P ? { rank: P.r, nv: P.nv } : null, prova: this.podeProva(j), pv: g.pv === 1,
      perto: this.pertoDaGuilda(j), ativos: GUILDA.ativos, fim: fimDoDia(agora) - agora, ouro: pr.ouro, xp: pr.xp, pgGanha: pr.pg, cat: !!R.cat,
      l: g.of.map((O) => ({ id: O.id, txt: textoContrato(O), n: g.at[O.id] ?? 0, t: O.n, e: g.f.includes(O.id) ? 'recebido' : O.id in g.at ? (g.at[O.id] >= O.n ? 'feito' : 'ativo') : 'livre' })) };
  },
  // mensagem do app: { acao: 'aceitar' | 'desistir' | 'receber' | 'ir', id } | { acao: 'prova' } | { acao: 'ver' }
  guilda(id, m) {
    const j = this.jogadores.get(id); if (!j || j.bot || !m) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if (!this.temGuilda(j)) return aviso(`A Guilda abre no Nv ${GUILDA.nivel}, no Rio Claro`);
    const g = this.guildaDe(j);
    if (m.acao === 'ver') return this.avisarProg(j);
    if (m.acao === 'prova') {
      if (g.pv === 1) return aviso('Prova já aceita: vença o elite vermelho num campo da sua faixa');
      if (!this.podeProva(j)) return aviso(g.r >= ULTIMO ? 'Você já é Rank SS' : `Para a Prova: ${RANKS[g.r].pg} pontos e Nv ${RANKS[g.r + 1].nv}`);
      if (!this.pertoDaGuilda(j)) return aviso('Aceite a Prova no mural da Guilda (Rio Claro)');
      g.pv = 1; j.progSujo = true;
      aviso(`Prova do rank ${RANKS[g.r + 1].r} aceita! Vá a um campo da sua faixa`);
      return this.avisarProg(j);
    }
    const O = g.of.find((o) => o.id === m.id); if (!O) return;
    if (m.acao === 'aceitar') {
      if (O.id in g.at || g.f.includes(O.id)) return;
      if (!this.pertoDaGuilda(j)) return aviso('Pegue contratos no mural da Guilda (Rio Claro)');
      if (Object.keys(g.at).filter((k) => !g.f.includes(k)).length >= GUILDA.ativos) return aviso(`No máximo ${GUILDA.ativos} contratos de uma vez`);
      g.at[O.id] = 0; j.progSujo = true;
      aviso(`Contrato aceito: ${textoContrato(O)}`);
      return this.avisarProg(j);
    }
    if (m.acao === 'desistir') {
      if (!(O.id in g.at) || g.at[O.id] >= O.n) return;
      delete g.at[O.id]; j.progSujo = true; // volta para o mural (pode pegar de novo, do zero)
      return this.avisarProg(j);
    }
    if (m.acao === 'ir') {
      if (!(O.id in g.at)) return;
      const a = this.alvoGuilda(j, O);
      if (!a) return aviso('Dá para fazer aqui mesmo');
      return this.evento({ t: 'diaria_ir', para: id, id: O.id, alvo: a });
    }
    if (m.acao !== 'receber') return;
    if (!(O.id in g.at)) return;
    if (g.at[O.id] < O.n) return aviso(`Falta: ${textoContrato(O)} (${g.at[O.id]}/${O.n})`);
    const p = j.prog, R = RANKS[g.r], pr = premioGuilda(g.r, p.nivel);
    delete g.at[O.id]; g.f.push(O.id); j.progSujo = true;
    p.ouro += pr.ouro; this.caixa?.(j, 'guilda', pr.ouro);
    if (pr.xp) this.ganharXP(j, pr.xp);
    if (R.pg) g.pg = Math.min(R.pg, g.pg + pr.pg);
    let txt = `+${pr.ouro} ouro${pr.xp ? ` · +${pr.xp} XP` : ''}${R.pg ? ` · +${pr.pg} pontos` : ''}`;
    if (R.cat && Math.random() < R.cat) { // catalisador (runa ou selo), melhor nos ranks altos
      const i = Math.random() < (R.mitico || 0) ? 3 : Math.min(2, Math.floor((g.r - 3) / 2));
      const L = Math.random() < 0.5 ? CATALISADOR.arma : CATALISADOR.armadura, k = L[i];
      if (ITENS[k] && guardar(p.mochila, { k, n: 1 })) txt += ` · ${ITENS[k].nome}`;
    }
    aviso(`Contrato recebido: ${txt}`);
    if (this.podeProva(j) && g.pv !== 1) aviso(`Pontos cheios! Faça a Prova do rank ${RANKS[g.r + 1].r} no mural`);
    this.avisarProg(j);
  },
  // para onde o "Ir" de um contrato leva: { x, z, nome } ou null
  alvoGuilda(j, O) {
    if (O.k === 'coleta') return this.alvoDiaria(j, { ir: 'coleta', tipos: GUILDA.tipos.coleta.tipos });
    if (O.k === 'pesca') return this.alvoDiaria(j, { ir: 'pesca' });
    if (O.k === 'pack') {
      let b = null, md = Infinity;
      for (const n of this.mapa.npcs || []) if (n.funcao === 'pack' && !zonaFechadaEm(j.prog, n.x, n.z)) { const d = Math.hypot(n.x - j.x, n.z - j.z); if (d < md) { md = d; b = n; } }
      return b && { x: r2(b.x), z: r2(b.z), nome: b.nome.split(',')[0] };
    }
    const c = this.campoDaFaixa(j, O.k === 'caca' ? O.a : null);
    return c && { x: c.x, z: c.z, nome: c.nome || 'o campo' };
  },
  // campo de caça aberto mais perto na faixa do herói (min: nível mínimo dos monstros; senão nv - faixa)
  campoDaFaixa(j, min = null, ate = Infinity) {
    const nv = j.prog.nivel, lo = min ?? Math.max(1, nv - GUILDA.faixa);
    let b = null, md = ate;
    for (const c of this.cacas) {
      const D = c.def; if (D.boss || D.mundo || (D.nivel || 1) < lo || (D.nivel || 1) > nv + 3 || zonaFechadaEm(j.prog, D.x, D.z)) continue;
      const d = Math.hypot(D.x - j.x, D.z - j.z); if (d < md) { md = d; b = D; }
    }
    return b;
  },
  // a cada meio segundo: quem tem contrato de elite (ou a Prova) e chega perto de um campo da faixa faz o elite aparecer
  passoGuilda(dt) {
    this.guildaT = (this.guildaT || 0) - dt; if (this.guildaT > 0) return;
    this.guildaT = 0.5;
    for (const j of this.jogadores.values()) {
      if (j.bot || j.criando || j.morto || !j.prog.guilda) continue;
      const g = j.prog.guilda;
      if (g.pv === 1) this.chamarEliteGuilda(j, true);
      if (g.at && Object.keys(g.at).some((id) => { const O = g.of?.find((o) => o.id === id); return O?.k === 'elite' && g.at[id] < O.n; })) this.chamarEliteGuilda(j, false);
    }
  },
  chamarEliteGuilda(j, prova) {
    const hc = `${prova ? 'gp' : 'ge'}:${j.id}`;
    if (this.inimigos.some((e) => e.hc === hc && !e.morto)) return;
    const D = this.campoDaFaixa(j, null, 60); if (!D) return;
    const ci = this.cacas.findIndex((c) => c.def === D);
    const e = this.inimigos.find((o) => o.sp?.caca === ci && !o.morto && !o.hc && !(o.atacantes?.size)); if (!e) return;
    const E = prova ? GUILDA.prova : GUILDA.elite, g = j.prog.guilda;
    const nome = prova ? E.nome.replace('{r}', RANKS[Math.min(ULTIMO, g.r + 1)].r) : E.nome;
    Object.assign(e, { hc, nome, esc: E.escala, cor: E.cor, vidaMax: Math.round(e.vidaMax * E.vida), dano: Math.round((e.dano || 0) * E.dano) });
    e.vida = e.vidaMax;
    this.evento({ t: 'aviso', para: j.id, texto: `${nome} apareceu!` });
  },
};

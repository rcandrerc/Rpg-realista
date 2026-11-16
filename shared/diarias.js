// Missões diárias (André 2026-11-16): aba "Diárias" na janela de Missões, ao lado da "História". As 4 de DIARIAS
// (shared/dados.js) valem uma vez por dia; o dia vira à meia-noite de Brasília. O que conta passa pelo mesmo funil da
// história (Simulacao.historia chama contarDiaria). Terminou: o jogador toca em "Receber" (ouro + XP); recebendo as 4,
// ganha o bônus. O estado fica na conta (prog.diarias = { d: 'AAAA-MM-DD', n: { id: quanto }, r: [ids recebidas],
// b: 1 se já levou o bônus }) e vai para o app junto com o progresso (avisarProg manda "di", o resumo pronto).
import { DIARIAS, PLANTIO, PESCA, COLETA } from './dados.js';
import { xpProximo, NIVEL_MAX } from './progresso.js';
import { QUADRADOS_PLANTIO } from './plantio.js';
import { zonaFechadaEm } from './historia.js';

const r2 = (n) => Math.round(n * 100) / 100;
const DIA_MS = 86400000;
// o dia de Brasília do instante ms ('2026-11-16') e quando ele acaba (ms)
export const diaDiarias = (ms) => new Date(ms + DIARIAS.fuso * 3600000).toISOString().slice(0, 10);
export const fimDoDia = (ms) => { const f = DIARIAS.fuso * 3600000; return Math.floor((ms + f) / DIA_MS) * DIA_MS + DIA_MS - f; };
const DEF = Object.fromEntries(DIARIAS.lista.map((D) => [D.id, D]));
// o que a diária D paga no nível nv
export const premioDiaria = (nv) => ({ ouro: DIARIAS.ouro + DIARIAS.ouroNv * nv, xp: nv >= NIVEL_MAX ? 0 : Math.max(1, Math.round(xpProximo(nv) * DIARIAS.xp)) });

// confere o que veio da conta (progressoValido); do dia que passou não sobra nada
export function diariasValidas(v) {
  if (!v || typeof v !== 'object' || typeof v.d !== 'string' || !/^\d{4}-\d\d-\d\d$/.test(v.d)) return null;
  const n = {};
  for (const D of DIARIAS.lista) { const q = v.n?.[D.id]; if (Number.isInteger(q) && q > 0) n[D.id] = Math.min(q, D.n); }
  const r = Array.isArray(v.r) ? [...new Set(v.r.filter((id) => DEF[id] && n[id] >= DEF[id].n))] : [];
  return { d: v.d, n, r, ...(v.b === 1 && r.length === DIARIAS.lista.length ? { b: 1 } : {}) };
}

// um ponto de cada área de plantio (o quadrado do meio da lista dela): para onde o "Ir" da diária de plantar leva
const PONTOS_PLANTIO = (() => {
  const por = new Map();
  for (const [q, id] of QUADRADOS_PLANTIO) { let L = por.get(id); if (!L) por.set(id, (L = [])); L.push(q); }
  return [...por].map(([id, L]) => { const [i, k] = L[Math.floor(L.length / 2)].split(',').map(Number); return { id, x: i * PLANTIO.quadrado + PLANTIO.quadrado / 2, z: k * PLANTIO.quadrado + PLANTIO.quadrado / 2 }; });
})();

export const Diarias = {
  // as diárias de hoje da conta (vira o dia sozinho)
  diariasDe(j) {
    const p = j.prog, hoje = diaDiarias(this.agoraMs());
    if (p.diarias?.d !== hoje) { p.diarias = { d: hoje, n: {}, r: [] }; j.progSujo = true; }
    return p.diarias;
  },
  temDiarias(j) { return !!j && !j.bot && (j.prog?.nivel || 0) >= DIARIAS.nivel; },
  // algo aconteceu (o mesmo ev/d da história): conta nas diárias que casam
  contarDiaria(j, ev, d = {}) {
    if (!this.temDiarias(j)) return;
    const D = DIARIAS.lista.find((o) => o.ev === ev && (!o.tipos || o.tipos.includes(d.tipo))); if (!D) return;
    const st = this.diariasDe(j), antes = st.n[D.id] || 0; if (antes >= D.n) return;
    st.n[D.id] = Math.min(D.n, antes + Math.max(1, d.n | 0)); j.progSujo = true;
    if (st.n[D.id] >= D.n) {
      this.evento({ t: 'aviso', para: j.id, texto: `Diária feita: ${D.txt}! Receba em Missões > Diárias` });
      this.evento({ t: 'diaria', para: j.id, id: D.id, feita: true });
      this.historia(j, 'diaria'); // história: "Termine 1 diária"
    }
    this.avisarProgUmaVez(j);
  },
  // manda o progresso só se ainda não vai um neste passo (matar e coletar já mandam)
  avisarProgUmaVez(j) {
    if (!this.eventos.some((e) => e.t === 'prog' && e.para === j.id)) this.avisarProg(j);
  },
  // o resumo que o app desenha (vai junto do progresso): fim = ms até virar o dia
  diariasInfo(j) {
    if (!this.temDiarias(j)) return null;
    const st = this.diariasDe(j), pr = premioDiaria(j.prog.nivel), agora = this.agoraMs();
    return { fim: fimDoDia(agora) - agora, ouro: pr.ouro, xp: pr.xp, bonus: DIARIAS.bonus, b: st.b === 1,
      l: DIARIAS.lista.map((D) => ({ id: D.id, txt: D.txt, n: Math.min(D.n, st.n[D.id] || 0), t: D.n, r: st.r.includes(D.id) })) };
  },
  // mensagem do app: { acao: 'receber', id } | { acao: 'ir', id } | { acao: 'ver' } (abriu a aba)
  diaria(id, m) {
    const j = this.jogadores.get(id); if (!j || j.bot || !m) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if (m.acao === 'ver') {
      this.historia(j, 'diaria_vista');
      if (this.temDiarias(j)) { const st = this.diariasDe(j); if (DIARIAS.lista.some((D) => (st.n[D.id] || 0) >= D.n)) this.historia(j, 'diaria'); } // já fez uma hoje
      return;
    }
    if (!this.temDiarias(j)) return aviso(`Diárias abrem no Nv ${DIARIAS.nivel}`);
    const D = DEF[m.id]; if (!D) return;
    const st = this.diariasDe(j);
    if (m.acao === 'ir') {
      const a = this.alvoDiaria(j, D);
      if (!a) return aviso('Dá para fazer aqui mesmo');
      return this.evento({ t: 'diaria_ir', para: id, id: D.id, alvo: a });
    }
    if (m.acao !== 'receber') return;
    if ((st.n[D.id] || 0) < D.n) return aviso(`Falta: ${D.txt} (${st.n[D.id] || 0}/${D.n})`);
    if (st.r.includes(D.id)) return aviso('Já recebeu esta hoje');
    st.r.push(D.id); j.progSujo = true;
    const p = j.prog, pr = premioDiaria(p.nivel);
    p.ouro += pr.ouro; this.caixa?.(j, 'diaria', pr.ouro);
    let txt = `+${pr.ouro} ouro`;
    if (st.r.length === DIARIAS.lista.length && st.b !== 1) { st.b = 1; p.ouro += DIARIAS.bonus; this.caixa?.(j, 'diaria', DIARIAS.bonus); txt += ` · bônus das 4: +${DIARIAS.bonus} ouro`; }
    if (pr.xp) this.ganharXP(j, pr.xp);
    aviso(`Diária recebida: ${txt}${pr.xp ? ` · +${pr.xp} XP` : ''}`);
    this.evento({ t: 'diaria', para: id, id: D.id, recebeu: true });
    this.historia(j, 'diaria');
    this.avisarProg(j);
  },
  // para onde o "Ir" da diária leva: { x, z, nome } (o lugar aberto mais perto), ou null
  alvoDiaria(j, D) {
    const aberto = (x, z) => !zonaFechadaEm(j.prog, x, z), perto = (L, f) => {
      let b = null, md = Infinity;
      for (const o of L) { if (!f(o)) continue; const d = Math.hypot(o.x - j.x, o.z - j.z); if (d < md) { md = d; b = o; } }
      return b;
    };
    if (D.ir === 'plantio') {
      const b = perto(PONTOS_PLANTIO, (o) => aberto(o.x, o.z));
      return b && { x: r2(b.x), z: r2(b.z), nome: 'a área de plantio' };
    }
    if (D.ir === 'caca') {
      const nv = j.prog.nivel, ok = (c) => !c.def.boss && aberto(c.def.x, c.def.z) && (c.def.nivel || 1) <= nv + 2;
      const b = perto(this.cacas.map((c) => ({ ...c, x: c.def.x, z: c.def.z })), (c) => ok(c) && (c.def.nivel || 1) >= nv - 12) || perto(this.cacas.map((c) => ({ ...c, x: c.def.x, z: c.def.z })), ok);
      return b && { x: b.def.x, z: b.def.z, nome: b.def.nome || 'o campo' };
    }
    if (D.ir === 'pesca') {
      const b = perto(this.spots, (v) => v.ativo && v.tipo === 'comum' && aberto(v.x, v.z) && PESCA.spots[v.tipo]);
      return b ? { x: r2(b.x), z: r2(b.z), nome: 'o spot de pesca' } : { x: -3, z: 180, nome: 'o Lago Grande' };
    }
    if (D.ir === 'coleta') {
      const b = perto(this.coletaveis.values(), (no) => D.tipos.includes(no.tipo) && !no.plantada && COLETA[no.tipo] && aberto(no.x, no.z) && this.cargas(j, no) > 0);
      return b && { x: r2(b.x), z: r2(b.z), nome: COLETA[b.tipo].nome };
    }
    return null;
  },
};

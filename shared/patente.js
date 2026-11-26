// Patente de Guerra (André 2026-11-26; PATENTE, patenteDe e mesGuerra em shared/dados.js).
// Estas funções entram na Simulacao (Object.assign no fim de simulacao.js): "this" é a Simulacao.
//
// - prog.gu = { m: 'AAAA-MM' (mês da contagem), a: abates no mês, x: maior patente já pega, l: meses como Lenda,
//   u: { quem: ms do último abate que contou }, p: pontos que as mortes tiraram, v: { quem: ms da última morte que tirou } }. Jogador e bot iguais (o bot guarda no save dele).
// - abateGuerra (chamado por morteGuerra em guerra.js): conta se não é a mesma pessoa de menos de PATENTE.repete s atrás
//   nem alguém PATENTE.fraco+ níveis mais fraco. Arena não passa por aqui (shared/arena.js).
// - fecharMesPatente: virou o mês (hora de Brasília)? Entrega o prêmio da patente que pegou e volta a Recruta. Roda ao
//   entrar no jogo, a cada abate e a cada PATENTE.passo s para quem está no mundo; quem estava fora recebe ao voltar.
//   Jogador: na mochila; sem lugar, espera nas devoluções (shared/base.js). Bot: no Baú do Clã dele (sem baú, mochila).
// - this.guerraMes = { m, c: { chaveDoClã: abates }, r: { chama, geada } } (tabela mundo 'guerra_mes'): o placar do mês.
//   Virou o mês: o clã com mais abates ganha um Lendário (PATENTE.cla) no Baú do Clã.
import { PATENTE, patenteDe, pontosGuerra, mesGuerra, CLAS_NPC, ITENS } from './dados.js';
import { guardar } from './progresso.js';

const sorteia = (l) => (Array.isArray(l) ? l[Math.floor(Math.random() * l.length)] : l);
// os itens de um prêmio (PATENTE.premio[i] ou PATENTE.cla), já sorteados: [{ k, n }]
export function itensPremio(lista) {
  const r = [];
  for (const o of lista || []) {
    if (!Array.isArray(o.k)) { r.push({ k: o.k, n: o.n }); continue; }
    for (let i = 0; i < o.n; i++) { const k = sorteia(o.k), x = r.find((y) => y.k === k); if (x) x.n++; else r.push({ k, n: 1 }); }
  }
  return r.filter((o) => ITENS[o.k]);
}
// o que vai para a tela: patente do mês (0..7), 0..1 até a próxima, abates do mês e a maior já pega
export function patenteInfo(p, mes = mesGuerra()) {
  const G = p?.gu, ok = G && G.m === mes, a = ok ? G.a | 0 : 0, P = patenteDe(ok ? pontosGuerra(G) : 0);
  return { i: P.i, pct: Math.round(P.pct * 100) / 100, a, x: G?.x | 0, l: G?.l | 0 };
}
export const Patente = {
  // quem é (para o "não conta de novo"): a conta do jogador ou o id do bot
  quemGuerra(c) { return String(!c.bot && c.conta != null ? c.conta : this.amigoIaDe?.(c)?.AMIGA.id || c.id); },
  // a chave do clã de um corpo: 'j' + conta do líder (clã de jogador) ou 'n' + id (clã bot). null = sem clã
  chaveClaGuerra(j) {
    if (!j.bot) return j.prog?.cla && j.conta != null ? 'j' + j.conta : null;
    const x = this.amigoIaDe?.(j); if (!x) return null;
    if (x.AMIGA.recruta || x.AMIGA.clanpc) { const K = this.claDoRecruta?.(x); return K ? (K.bot ? 'n' + K.C.id : 'j' + K.conta) : null; }
    const C = CLAS_NPC.find((o) => o.lider === x.AMIGA.id || o.membros.includes(x.AMIGA.id));
    return C ? 'n' + C.id : null;
  },
  // abate de guerra (guerra.js morteGuerra): c caiu, k derrubou
  abateGuerra(c, k) {
    if (!c || !k || c === k || c.robo || k.robo || !k.prog || !this.outraRaca(c, k)) return;
    this.perdaGuerra(c, k);
    if ((c.prog?.nivel | 0) <= (k.prog.nivel | 0) - PATENTE.fraco) return; // muito mais fraco: não conta
    this.fecharMesPatente(k);
    const G = k.prog.gu, quem = this.quemGuerra(c), agora = Date.now();
    if (agora - (G.u[quem] ?? -Infinity) < PATENTE.repete * 1000) return; // a mesma pessoa de novo, cedo demais
    G.u[quem] = agora;
    const ks = Object.keys(G.u); if (ks.length > PATENTE.guarda) for (const q of ks.slice(0, ks.length - PATENTE.guarda)) delete G.u[q];
    const antes = patenteDe(pontosGuerra(G)).i; G.a++;
    const P = patenteDe(pontosGuerra(G)).i; k.progSujo = true;
    // o placar do mês: raça e clã
    const M = this.mesGuerraEstado(), raca = this.racaDe(k), ch = this.chaveClaGuerra(k);
    M.r[raca] = (M.r[raca] | 0) + 1; if (ch) M.c[ch] = (M.c[ch] | 0) + 1; this.salvarGuerraMes();
    if (P > antes) {
      if (P > (G.x | 0)) { G.x = P; this.ganharTitulo(k, 'pat' + P, true); }
      if (!k.bot) this.evento({ t: 'aviso', para: k.id, texto: `Patente nova: ${PATENTE.nomes[P]}` });
      if (P >= 5) this.anunciar(`${k.nome} (${this.nomeRaca(k)}) chegou a ${PATENTE.nomes[P]} na guerra`);
    }
    this.avisarProg(k);
  },
  // c morreu para k (outra raça, fora da Arena): perde PATENTE.perde do anel, sem descer de patente nem passar de 0%
  perdaGuerra(c, k) {
    if (!c.prog) return;
    this.fecharMesPatente(c);
    const G = c.prog.gu, L = PATENTE.abates, pts = pontosGuerra(G), { i } = patenteDe(pts);
    if (i + 1 >= L.length || pts <= L[i]) return; // Lenda (anel cheio) ou já em 0%
    const quem = this.quemGuerra(k), agora = Date.now();
    G.v ||= {};
    if (agora - (G.v[quem] ?? -Infinity) < PATENTE.repete * 1000) return; // a mesma pessoa de novo, cedo demais
    G.v[quem] = agora;
    const ks = Object.keys(G.v); if (ks.length > PATENTE.guarda) for (const q of ks.slice(0, ks.length - PATENTE.guarda)) delete G.v[q];
    const novo = Math.max(L[i], pts - PATENTE.perde * (L[i + 1] - L[i]));
    G.p = Math.round(((G.a | 0) - novo) * 100) / 100; c.progSujo = true;
    if (!c.bot) this.evento({ t: 'aviso', para: c.id, texto: `Patente: -${Math.round(PATENTE.perde * 100)}% (morreu para ${k.nome})` });
    this.avisarProg?.(c);
  },
  // virou o mês? Prêmio da patente do mês que fechou e volta a Recruta. Sem prog.gu: começa agora
  fecharMesPatente(j, mes = mesGuerra()) {
    const p = j?.prog; if (!p) return;
    const G = p.gu ||= { m: mes, a: 0, x: 0, l: 0, u: {} };
    G.u ||= {};
    if (G.m === mes) return;
    const P = patenteDe(pontosGuerra(G)).i;
    G.m = mes; G.a = 0; G.p = 0; G.u = {}; G.v = {}; j.progSujo = true;
    if (P < 1) return;
    if (P === PATENTE.nomes.length - 1) G.l = (G.l | 0) + 1;
    this.entregarPremioGuerra(j, itensPremio(PATENTE.premio[P]), `Prêmio do mês (${PATENTE.nomes[P]})`);
  },
  entregarPremioGuerra(j, itens, texto) {
    if (!itens.length) return;
    const nomes = itens.map((o) => `${o.n} ${ITENS[o.k].nome}`).join(', ');
    if (j.bot) {
      const x = this.amigoIaDe?.(j), K = x && (x.AMIGA.recruta || x.AMIGA.clanpc ? this.claDoRecruta?.(x) : null)
        || (x && ((C) => C && { bot: true, C, E: this.clasNpc?.[C.id], conta: this.amigosIa?.find((o) => o.AMIGA.id === C.lider)?.AMIGA.conta })(CLAS_NPC.find((o) => o.lider === x.AMIGA.id || o.membros.includes(x.AMIGA.id))));
      const B = K && this.bauDoCla?.(K);
      for (const o of itens) if (!(B && guardar(B.itens, { ...o }))) guardar(j.prog.mochila, { ...o });
      if (B) this.mexeuBau(B);
      return;
    }
    const sobra = itens.filter((o) => !guardar(j.prog.mochila, { ...o }));
    if (sobra.length) { const D = (this.devolucoes ||= {})[j.conta] ||= { ouro: 0, itens: [] }; D.itens.push(...sobra); D.texto ||= texto; this.salvarDevolucoes?.(); }
    this.evento({ t: 'aviso', para: j.id, texto: `${texto}: ${nomes}${sobra.length ? '. Mochila cheia: o resto espera espaço' : ''}` });
    this.avisarProg(j);
  },
  // o placar do mês (vira sozinho no dia 1º: o clã que mais abateu ganha um Lendário no Baú do Clã)
  mesGuerraEstado() {
    const mes = mesGuerra();
    const M = this.guerraMes ||= { m: mes, c: {}, r: {} };
    if (M.m !== mes) {
      const [ch, n] = Object.entries(M.c).sort((a, b) => b[1] - a[1])[0] || [];
      if (ch && n > 0) this.premioClaGuerra(ch);
      this.guerraMes = { m: mes, c: {}, r: {} }; this.salvarGuerraMes();
    }
    return this.guerraMes;
  },
  premioClaGuerra(ch) {
    const itens = itensPremio([{ k: PATENTE.cla, n: 1 }]); if (!itens.length) return;
    let B = null, nome = '';
    if (ch[0] === 'n') { const C = CLAS_NPC.find((o) => 'n' + o.id === ch); if (C) { B = this.bauDoCla?.({ bot: true, C, E: this.clasNpc?.[C.id] }); nome = C.n || ''; } }
    else {
      const conta = ch.slice(1); B = this.bauDoCla?.({ conta });
      const j = [...this.jogadores.values()].find((o) => !o.bot && String(o.conta) === conta); nome = j?.prog?.cla?.nome || '';
      if (!B) { const D = (this.devolucoes ||= {})[conta] ||= { ouro: 0, itens: [] }; D.itens.push(...itens); D.texto ||= 'Prêmio do clã que mais abateu no mês'; this.salvarDevolucoes?.(); }
    }
    if (B) { for (const o of itens) guardar(B.itens, { ...o }); this.mexeuBau(B); }
    this.anunciar(`O clã${nome ? ' ' + nome : ''} foi o que mais abateu na guerra este mês: ${ITENS[itens[0].k].nome} no Baú do Clã`);
  },
  salvarGuerraMes() { if (this.aoGuerraMes) this.aoGuerraMes(this.guerraMes); },
  carregarGuerraMes(est) {
    const ok = est && typeof est === 'object' && typeof est.m === 'string';
    const limpa = (o) => Object.fromEntries(Object.entries(o && typeof o === 'object' ? o : {}).filter(([k, v]) => typeof k === 'string' && k.length <= 64 && Number.isInteger(v) && v >= 0));
    this.guerraMes = ok ? { m: est.m, c: limpa(est.c), r: limpa(est.r) } : null;
  },
  // a cada PATENTE.passo s: o mês virou para quem está no mundo (e para o placar)
  passoPatente() {
    if (this.tempo < (this.patenteT ?? 0)) return;
    this.patenteT = this.tempo + PATENTE.passo;
    const mes = mesGuerra(); this.mesGuerraEstado();
    for (const j of this.jogadores.values()) if (j.prog && !j.robo && j.prog.gu?.m !== mes && (j.prog.gu || !j.bot)) this.fecharMesPatente(j, mes);
  },
  // a aba Guerra do menu do clã e do painel: placar do mês por raça, o do clã e a patente de cada um
  guerraInfo(j, membros = []) {
    const M = this.mesGuerraEstado(), ch = this.chaveClaGuerra(j);
    const um = (o) => ({ nome: o?.nome || '', ...patenteInfo(o?.prog, M.m) }); // recruta fora do mundo: o save dele (npcSalvos)
    return { mes: M.m, raca: this.racaDe(j), r: { chama: M.r.chama | 0, geada: M.r.geada | 0 }, cla: ch ? M.c[ch] | 0 : 0, eu: patenteInfo(j.prog, M.m),
      m: membros.filter(Boolean).map(um), nomes: PATENTE.nomes, ab: PATENTE.abates };
  },
};

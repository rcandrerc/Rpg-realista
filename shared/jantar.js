// Jantar do clã (André 2026-11-25): "eu podia chamar eles para comer... selecionava os que eu queria... clicando na mesa,
// aparece um slot de comida igual o que aparece nos packs... eles sentam, comem... conversam entre si... e eu estando
// presente, a moral subisse 30 a 40... uma vez por dia"; "depois de servir eu poder sentar também... ganhava um buff".
// Regras em JANTAR (shared/dados.js); conversas em shared/jantar-falas.js.
// 1) Chamar: o líder escolhe até JANTAR.convidados recrutas que estão no mundo; cada um anda (ou usa a casinha de longe)
//    até o lugar dele na Mesa do Clã (base do clã, shared/base.js mesaBase) e senta (anim kk_sentado).
// 2) Comida: perto da mesa o líder põe pratos (comida da mochila, como o slot dos packs); a comida aparece na mesa.
//    Fica reservada na mochila até servir (nada some se o jantar se desfaz).
// 3) Servir: um prato por recruta sentado. Durante JANTAR.comer s eles comem e conversam (balões, pelo jeito de cada um).
//    O líder pode sentar na cabeceira (lugar 0).
// 4) Fim: cada recruta sentado ganha JANTAR.moral de moral se o líder ficou perto (JANTAR.presenca); o líder que sentou
//    ganha o buff Banquete do clã (prog.banq). Uma vez por dia (dia de Brasília): prog.cla.jd / estado do clã bot jd.
// Clã bot: o líder faz o dele uma vez por dia, numa hora sorteada (JANTAR.bots.horas), com a comida do Baú do Clã.
import { JANTAR, CLA, ITENS, DESPENSA, CLAS_NPC, RACAS, falaJantar, comidaNaFala } from './dados.js';
import { contar, tirar } from './progresso.js';

const r2 = (v) => Math.round(v * 100) / 100;
// o dia de Brasília (UTC-3): "uma vez por dia"
export const diaJantar = (ms = Date.now()) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 10);
const horaBR = (ms = Date.now()) => new Date(ms - 3 * 3600e3).getUTCHours();
// o que pode ir para a mesa: comida (as rações da despensa e os pratos), nunca o Peixe-Dourado
export const comidaJantar = (k) => !!k && k !== 'dourado' && !!(DESPENSA.racao[k] || ITENS[k]?.comida);
// os lugares da mesa no mundo: { i, x, z, ry } (ry: virado para a mesa). M = { x, z, ry }
export function lugaresMesa(M) {
  const c = Math.cos(M.ry || 0), s = Math.sin(M.ry || 0);
  return JANTAR.lugares.map(([lx, lz], i) => {
    const fx = Math.abs(lz) < 0.01 ? -Math.sign(lx) : 0, fz = Math.abs(lz) < 0.01 ? 0 : -Math.sign(lz);
    return { i, x: r2(M.x + lx * c + lz * s), z: r2(M.z - lx * s + lz * c), ry: r2(Math.atan2(fx * c + fz * s, -fx * s + fz * c)) };
  });
}
const sorteia = (l) => l[Math.floor(Math.random() * l.length)];
const entre = ([a, b]) => a + Math.random() * (b - a);
// o jeito do recruta (índice em CLA.jeitos); bot sem jeito: um fixo pelo id
const jeitoDe = (m, id) => { const i = CLA.jeitos.indexOf(m?.jeito); if (i >= 0) return i; let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % CLA.jeitos.length; };
const primeiroNome = (n) => String(n || '').split(' ')[0];

export const Jantar = {
  // ---------- a mesa ----------
  mesaDoJantar(J) { return J.mesa; },
  // pedido do app (aba Clã e a janela da mesa): { acao: 'jantar', sub, ids, i, n, s }
  jantarAcao(j, m, aviso) {
    if (!JANTAR.ligado) return;
    const c = j.prog.cla, B = this.baseDe?.(j);
    if (!B) return aviso('Funde a base do clã primeiro: a Mesa do Clã fica nela');
    if (m.sub === 'recolher') return this.recolherMesaBase(j, aviso);
    const M = this.mesaBase(B);
    if (!M) return aviso('A Mesa do Clã está na mochila: ponha na base (martelo, Móveis)');
    this.jantares ||= new Map();
    let J = this.jantares.get(B.k);
    const perto = Math.hypot(M.x - j.x, M.z - j.z) <= JANTAR.perto;
    if (m.sub === 'info') return this.infoJantar(j);
    if (m.sub === 'chamar') {
      if (c.jd === diaJantar()) return aviso('O jantar do clã já foi hoje. Amanhã tem mais');
      if (J?.fase === 'comendo') return aviso('O jantar já está servido');
      const vivos = new Map(this.recrutasNoMundo(j).filter((x) => x.amiga && !x.amiga.morto).map((x) => [x.AMIGA.id, x]));
      const ids = (Array.isArray(m.ids) ? m.ids : []).filter((id, i, l) => typeof id === 'string' && l.indexOf(id) === i && c.m.some((o) => o.id === id));
      const fora = ids.filter((id) => !vivos.has(id));
      const vem = ids.filter((id) => vivos.has(id) && !J?.conv.has(id));
      if (!vem.length) return aviso(fora.length ? 'Quem você escolheu não está no mundo agora' : 'Escolha quem vem jantar');
      J ||= this.novoJantar(B, M, { id: j.id, conta: j.conta, nome: j.nome, raca: this.racaDe(j) });
      const livres = J.lugares.slice(1).map((P) => P.i).filter((s) => ![...J.conv.values()].some((q) => q.s === s));
      if (vem.length > livres.length) return aviso(`A mesa tem ${JANTAR.convidados} lugares para os recrutas`);
      vem.forEach((id, k) => this.convidarJantar(J, vivos.get(id), livres[k]));
      aviso(`${vem.length === 1 ? vivos.get(vem[0]).AMIGA.nome + ' está vindo' : vem.length + ' recrutas estão vindo'} para o jantar. Ponha a comida na mesa`);
      this.avisarJantar(J);
      return this.infoJantar(j);
    }
    if (!J) return aviso('Chame os recrutas primeiro (escolha quem vem)');
    if (m.sub === 'cancelar') { if (J.fase === 'comendo') return aviso('O jantar já está servido'); this.acabarJantar(J, false, 'Jantar cancelado'); return this.infoJantar(j); }
    if (m.sub === 'levantar') { if (j.mesaSent) { j.mesaSent = null; this.evento({ t: 'jantarSentar', para: j.id, sai: 1 }); } return; }
    if (m.sub === 'sentar') {
      if (!perto) return aviso('Chegue perto da Mesa do Clã');
      const P = J.lugares[0];
      j.mesaSent = { k: J.k, s: 0 };
      this.evento({ t: 'jantarSentar', para: j.id, x: P.x, z: P.z, ry: P.ry });
      return;
    }
    if (m.sub === 'comida' || m.sub === 'tirarComida') {
      if (J.fase === 'comendo') return aviso('O jantar já está servido');
      if (!perto) return aviso('Chegue perto da Mesa do Clã para pôr a comida');
      if (m.sub === 'tirarComida') { J.comida.splice(m.s | 0, 1); }
      else {
        const it = j.prog.mochila[m.i | 0]; if (!it) return;
        if (!comidaJantar(it.k)) return aviso('Na mesa só vai comida (peixe, legume, carne ou prato do fogão)');
        const tem = contar(j.prog.mochila, it.k), ja = J.comida.find((o) => o.k === it.k);
        const quer = Math.max(1, Math.min(+m.n > 0 ? Math.floor(+m.n) : it.n || 1, tem - (ja?.n || 0)));
        if (quer <= 0 || tem <= (ja?.n || 0)) return aviso('Essa comida já está toda na mesa');
        if (ja) ja.n += quer;
        else { if (J.comida.length >= JANTAR.slots) return aviso('A mesa está cheia'); J.comida.push({ k: it.k, n: quer }); }
      }
      this.avisarJantar(J);
      return this.infoJantar(j);
    }
    if (m.sub === 'servir') {
      if (J.fase === 'comendo') return aviso('O jantar já está servido');
      if (!perto) return aviso('Chegue perto da Mesa do Clã para servir');
      const sent = [...J.conv.values()].filter((q) => q.sent).length;
      if (!sent) return aviso('Ninguém sentou ainda: espere eles chegarem');
      // a comida reservada ainda está na mochila? (pode ter comido ou vendido depois de pôr na mesa)
      J.comida = J.comida.map((o) => ({ k: o.k, n: Math.min(o.n, contar(j.prog.mochila, o.k)) })).filter((o) => o.n > 0);
      const pratos = J.comida.reduce((a, o) => a + o.n, 0);
      if (pratos < sent) { this.avisarJantar(J); this.infoJantar(j); return aviso(`Falta comida: ${sent} sentados e ${pratos} prato${pratos === 1 ? '' : 's'} na mesa`); }
      // cada sentado come um prato (os mais simples primeiro); o que sobrar volta (fica na mochila)
      let falta = sent; const comeu = [];
      for (const o of [...J.comida].sort((a, b) => (DESPENSA.racao[a.k] || 3) - (DESPENSA.racao[b.k] || 3))) {
        const q = Math.min(o.n, falta); if (!q) continue;
        tirar(j.prog.mochila, o.k, q); comeu.push({ k: o.k, n: q }); falta -= q;
      }
      J.comida = comeu;
      this.servirJantar(J);
      this.avisarProg(j);
      return this.infoJantar(j);
    }
  },
  novoJantar(B, M, lider) {
    const J = { k: B.k, mesa: { x: M.x, z: M.z, ry: M.ry || 0, y: M.y || 0 }, lugares: lugaresMesa(M), conv: new Map(), comida: [], fase: 'chamando', t0: this.tempo, ate: 0, falaT: 0,
      ausente: 0, liderSentou: false, ultimo: null, ...lider };
    this.jantares.set(B.k, J);
    return J;
  },
  convidarJantar(J, x, s) {
    const a = x.amiga; if (!a) return;
    if (a.coleta) this.pararColeta(a, null);
    if (a.pesca) this.pararPesca(a, null);
    a.ia.jantar = { k: J.k, s, t: this.tempo };
    J.conv.set(x.AMIGA.id, { s, sent: false, x });
  },
  servirJantar(J) {
    // quem não chegou fica de fora (volta para o que fazia)
    for (const [id, q] of [...J.conv]) if (!q.sent) { this.soltarConvidado(q.x); J.conv.delete(id); }
    J.fase = 'comendo'; J.ate = this.tempo + JANTAR.comer; J.falaT = this.tempo + 2;
    this.avisarJantar(J);
    const L = J.bot ? null : this.jogadores.get(J.id);
    if (L) this.evento({ t: 'aviso', para: L.id, texto: `Jantar servido! Sente na cabeceira e fique perto da mesa até o fim (${Math.round(JANTAR.comer / 60)} min)` });
  },
  soltarConvidado(x) {
    const a = x?.amiga; if (!a) return;
    a.ia.jantar = null; a.mesaSent = null; a.ia.funcaoSt = null;
  },
  // o fim do jantar: ok = comeram até o fim; motivo: aviso para o líder
  acabarJantar(J, ok, motivo) {
    this.jantares?.delete(J.k);
    const L = J.bot ? this.liderNpc(J.C) : this.jogadores.get(J.id);
    const sentados = [...J.conv.entries()].filter(([, q]) => q.sent && q.x.amiga);
    for (const [, q] of J.conv) this.soltarConvidado(q.x);
    if (L?.mesaSent) { L.mesaSent = null; if (!J.bot) this.evento({ t: 'jantarSentar', para: L.id, sai: 1 }); }
    if (J.bot && J.liderX) this.soltarConvidado(J.liderX);
    let txt = motivo;
    if (ok) {
      const presente = J.ausente <= JANTAR.ausente;
      if (presente) for (const [id] of sentados) this.moralJantar(J, id, JANTAR.moral);
      if (J.bot) { const E = this.clasNpc?.[J.C.id]; if (E) { E.jd = diaJantar(); this.salvarClasNpc?.(); } }
      else if (L?.prog?.cla) { L.prog.cla.jd = diaJantar(); L.progSujo = true; }
      if (L && J.liderSentou) {
        L.prog.banq = { ate: Date.now() + JANTAR.buff.dur * 1000 }; L.progSujo = true; this.aplicarStatus(L);
        if (!J.bot) this.avisarProg(L);
      }
      txt = `Jantar do clã: ${sentados.length} recruta${sentados.length === 1 ? '' : 's'} comeu${sentados.length === 1 ? '' : 'ram'}. ` +
        (presente ? `Moral +${JANTAR.moral} para cada um` : 'Sem moral: você saiu de perto da mesa') + (J.liderSentou ? `. ${JANTAR.buff.nome}: +${Math.round(JANTAR.buff.dano * 100)}% de dano e de XP por ${Math.round(JANTAR.buff.dur / 60)} min` : '');
    }
    if (L && !J.bot) {
      if (txt) this.evento({ t: 'aviso', para: L.id, texto: txt });
      this.infoJantar(L);
      this.avisarProg(L);
    }
    // de volta ao trabalho: a função de cada um (aplicarFuncao)
    if (L) {
      const lista = J.bot ? this.clasNpc?.[J.C.id]?.m || [] : L.prog?.cla?.m || [];
      for (const [id, q] of J.conv) { const m = lista.find((o) => o.id === id); if (m && q.x.amiga) this.aplicarFuncao(L, q.x, m, true); }
    }
    this.avisarJantar(J, true);
  },
  // a moral do jantar (thread "Moral dos recrutas": somarMoral(j, id, n); clã bot: E.mo[id].mo)
  moralJantar(J, id, n) {
    if (J.bot) {
      const E = this.clasNpc?.[J.C.id]; if (!E) return null;
      if (this.somarMoralNpc) return this.somarMoralNpc(E, id, n);
      const o = E.mo?.[id]; if (o && Number.isFinite(+o.mo)) { o.mo = Math.max(0, Math.min(100, +o.mo + n)); return o.mo; }
      return null;
    }
    const j = this.jogadores.get(J.id);
    return j && this.somarMoral ? this.somarMoral(j, id, n) : null;
  },
  // ---------- a cada passo ----------
  passoJantares(dt) {
    if (!this.jantares?.size) return;
    for (const J of [...this.jantares.values()]) {
      const L = J.bot ? this.liderNpc(J.C) : this.jogadores.get(J.id);
      if (!L) { this.acabarJantar(J, false, ''); continue; }
      for (const [id, q] of [...J.conv]) if (!q.x.amiga || q.x.amiga.ia.jantar?.k !== J.k) J.conv.delete(id);
      if (L.mesaSent) { const P = J.lugares[0]; if (L.morto || Math.hypot(P.x - L.x, P.z - L.z) > 1.4) { L.mesaSent = null; if (!J.bot) this.evento({ t: 'jantarSentar', para: L.id, sai: 1 }); } }
      if (J.fase === 'chamando') {
        if (J.bot) { // o líder bot serve quando todo mundo sentou (ou passou o tempo)
          const todos = [...J.conv.values()].every((q) => q.sent) && L.mesaSent;
          if ((todos && J.conv.size) || this.tempo - J.t0 > 240) this.servirJantarNpc(J);
          else if (!J.conv.size) this.acabarJantar(J, false, '');
          continue;
        }
        if (!J.conv.size) { this.acabarJantar(J, false, 'O jantar se desfez: ninguém veio'); continue; }
        if (this.tempo - J.t0 > JANTAR.chamar) this.acabarJantar(J, false, 'O jantar se desfez: a comida não foi servida');
        continue;
      }
      if (!J.conv.size) { this.acabarJantar(J, false, 'O jantar acabou: ninguém ficou na mesa'); continue; }
      if (Math.hypot(J.mesa.x - L.x, J.mesa.z - L.z) > JANTAR.presenca) J.ausente += dt;
      if (L.mesaSent) J.liderSentou = true;
      if (this.tempo >= J.falaT) this.falaJantar(J, L);
      if (this.tempo >= J.ate) this.acabarJantar(J, true, '');
    }
  },
  // uma conversa: um recruta sentado fala (pelo jeito dele) e, às vezes, outro responde
  falaJantar(J, L) {
    J.falaT = this.tempo + entre(JANTAR.fala);
    const sent = [...J.conv.entries()].filter(([, q]) => q.sent && q.x.amiga);
    if (!sent.length) return;
    const lista = J.bot ? this.clasNpc?.[J.C.id]?.m || [] : L.prog?.cla?.m || [];
    const quem = sent.length > 1 ? sent.filter(([id]) => id !== J.ultimo) : sent;
    const [idA, qa] = sorteia(quem), outro = sent.length > 1 ? sorteia(sent.filter(([id]) => id !== idA)) : null;
    J.ultimo = idA;
    const raca = J.raca || 'chama', rival = raca === 'geada' ? 'chama' : 'geada';
    const comida = J.comida.length ? comidaNaFala(sorteia(J.comida).k, ITENS) : 'jantar';
    const nomeL = primeiroNome(J.nome);
    const base = { l: nomeL, c: comida, r: RACAS[rival]?.nome || 'Geada', eu: RACAS[raca]?.nome || 'Chama' };
    const presente = Math.hypot(J.mesa.x - L.x, J.mesa.z - L.z) <= JANTAR.presenca, sorte = Math.random();
    const tipo = presente && sorte < 0.15 ? 'lider' : sorte < 0.32 ? 'comida' : 'abre';
    const nA = qa.x.AMIGA.nome, nB = outro ? outro[1].x.AMIGA.nome : J.nome;
    const fem = (id) => lista.find((o) => o.id === id)?.g !== 'm'; // recruta sem g é moça (claValido)
    this.baloesJantar(J, qa.x.amiga, falaJantar(jeitoDe(lista.find((o) => o.id === idA), idA), tipo, { ...base, n: primeiroNome(nB) }, Math.random, fem(idA)));
    if (outro && tipo === 'abre') {
      const [idB, qb] = outro;
      this.depois(entre(JANTAR.resposta), () => { if (this.jantares?.get(J.k) === J && qb.x.amiga && qb.sent) this.baloesJantar(J, qb.x.amiga, falaJantar(jeitoDe(lista.find((o) => o.id === idB), idB), 'resp', { ...base, n: primeiroNome(nA) }, Math.random, fem(idB))); });
      J.falaT += JANTAR.resposta[1];
    }
  },
  // o balão em cima de quem falou, para quem está perto (como o chat Local; a outra raça lê embaralhado)
  baloesJantar(J, a, texto) {
    for (const o of this.jogadores.values()) {
      if (o.bot || Math.hypot(o.x - J.mesa.x, o.z - J.mesa.z) > 40) continue;
      const outra = this.outraRaca?.(o, a), r = outra ? this.racaDe(a) : null;
      this.evento({ t: 'balao', para: o.id, id: a.id, texto: outra ? this.linguaDe(texto, r) : texto, npc: 1, ...(outra ? { lingua: r } : {}) });
    }
  },
  // o desenho da mesa para quem está no mundo: a comida em cima e se está servido (godot-prototipo/jantar.gd)
  avisarJantar(J, fim = false) {
    const e = { t: 'jantar', k: J.k, x: J.mesa.x, z: J.mesa.z, y: J.mesa.y, ry: J.mesa.ry, comida: fim ? [] : J.comida.map((o) => o.k), fase: fim ? '' : J.fase, lugares: this.lugaresJantar(J) };
    for (const o of this.jogadores.values()) if (!o.bot) this.evento({ ...e, para: o.id });
  },
  // quem entra no jogo vê os jantares que estão acontecendo
  enviarJantares(id) {
    for (const J of this.jantares?.values() || []) this.evento({ t: 'jantar', para: id, k: J.k, x: J.mesa.x, z: J.mesa.z, y: J.mesa.y, ry: J.mesa.ry, comida: J.comida.map((o) => o.k), fase: J.fase, lugares: this.lugaresJantar(J) });
  },
  // os lugares com gente (o 0 é a cabeceira do líder, sempre posta)
  lugaresJantar(J) {
    return [0, ...[...J.conv.values()].map((q) => q.s)].sort((a, b) => a - b);
  },
  // a janela do jantar (o líder)
  infoJantar(j) {
    const c = j.prog?.cla, B = this.baseDe?.(j); if (!c) return;
    const M = B && this.mesaBase(B), J = B && this.jantares?.get(B.k);
    const vivos = new Map(this.recrutasNoMundo(j).filter((x) => x.amiga).map((x) => [x.AMIGA.id, x.amiga]));
    this.evento({ t: 'jantarInfo', para: j.id, feito: c.jd === diaJantar() ? 1 : 0, fase: J?.fase || '', tem: M ? 1 : 0, base: B ? 1 : 0,
      mesa: M ? { x: M.x, z: M.z } : null, perto: M && Math.hypot(M.x - j.x, M.z - j.z) <= JANTAR.perto ? 1 : 0, sent: j.mesaSent ? 1 : 0,
      falta: J?.fase === 'comendo' ? Math.max(0, Math.round(J.ate - this.tempo)) : 0, max: JANTAR.convidados, slots: JANTAR.slots, moral: JANTAR.moral,
      m: c.m.map((m) => { const a = vivos.get(m.id), q = J?.conv.get(m.id); return { id: m.id, nome: m.nome, g: m.g, on: a && !a.morto ? 1 : 0, ...(q ? { vem: 1, sent: q.sent ? 1 : 0 } : {}) }; }),
      comida: J ? J.comida.map((o) => ({ k: o.k, n: o.n })) : [] });
  },
  // o que a aba Clã mostra do jantar
  jantarResumo(j) {
    const c = j.prog?.cla, B = this.baseDe?.(j); if (!c || !B) return null;
    const J = this.jantares?.get(B.k);
    return { feito: c.jd === diaJantar() ? 1 : 0, fase: J?.fase || '', tem: this.mesaBase(B) ? 1 : 0 };
  },
  // ---------- o recruta (contexto do NPC; chamado na cabeça dele, amiga.js cabecaAmiga) ----------
  jantarAmiga(a, dt) {
    const q = a.ia.jantar;
    if (!q) { if (a.mesaSent) a.mesaSent = null; return false; }
    const J = this.jantares?.get(q.k);
    if (!J || a.morto) { a.ia.jantar = null; a.mesaSent = null; return false; }
    const P = J.lugares[q.s], d = Math.hypot(P.x - a.x, P.z - a.z), conv = J.conv.get(this.AMIGA.id);
    if (!a.mesaSent) {
      // longe: a casinha até a base (como quem leva recurso ao Baú do Clã); perto: anda; travado perto da mesa: senta
      if (d > 0.45 && !(d < 6 && this.tempo - q.t > 120)) {
        a.montado = null;
        if (!a.vila && this.recallRecruta(this, a, P, d)) { a.ia.funcaoSt = { txt: 'Indo para o jantar do clã (casinha)', ate: this.tempo + 12 }; return true; }
        if (a.vila) return true;
        if (d > 30) this.irLongeAmiga(a, P.x, P.z, dt); else this.irDireto(a, P.x, P.z, d > 6);
        a.ia.funcaoSt = { txt: 'Indo para o jantar do clã', ate: this.tempo + 5 };
        return true;
      }
      a.mesaSent = { k: J.k, s: q.s };
      if (conv) conv.sent = true;
    }
    this.pararAmiga(a);
    a.x = P.x; a.z = P.z; a.ry = P.ry;
    a.ia.funcaoSt = { txt: J.fase === 'comendo' ? 'Jantando com o clã' : 'Na mesa, esperando a comida', ate: this.tempo + 5 };
    return true;
  },
  // ---------- o jantar do clã bot (passoClasNpc, a cada minuto) ----------
  jantarNpc(C, E, ctxs) {
    if (!JANTAR.ligado || !this.genteOnline()) return;
    const hoje = diaJantar();
    if (E.jd === hoje) return;
    if (E.jhDia !== hoje) { E.jhDia = hoje; const [a, b] = JANTAR.bots.horas; E.jh = a + Math.floor(Math.random() * (b - a + 1)); }
    if (horaBR() < E.jh) return;
    const B = this.baseDoClaNpc?.(C), M = B && this.mesaBase(B); if (!M) return;
    this.jantares ||= new Map();
    if (this.jantares.has(B.k)) return;
    const Lx = this.amigosIa.find((x) => x.AMIGA.id === C.lider), L = Lx?.amiga; if (!L || L.morto) return;
    const bau = Array.isArray(E.bau) ? E.bau : [];
    const pratos = bau.reduce((s, o) => s + (o && comidaJantar(o.k) ? o.n || 1 : 0), 0);
    const conv = ctxs.filter((x) => x.AMIGA.id !== C.lider && x.amiga && !x.amiga.morto && !x.amiga.pvp && !x.amiga.duelo).slice(0, Math.min(JANTAR.convidados, pratos - 1));
    if (!conv.length) { E.jd = hoje; return; } // sem comida para o jantar hoje: fica para amanhã
    const J = this.novoJantar(B, M, { bot: true, C, nome: Lx.AMIGA.nome, raca: C.raca });
    J.liderX = Lx;
    Lx.amiga.ia.jantar = { k: J.k, s: 0, t: this.tempo };
    conv.forEach((x, i) => this.convidarJantar(J, x, i + 1));
    this.avisarJantar(J);
  },
  servirJantarNpc(J) {
    const E = this.clasNpc?.[J.C.id], bau = Array.isArray(E?.bau) ? E.bau : [];
    const sent = [...J.conv.values()].filter((q) => q.sent).length + (this.liderNpc(J.C)?.mesaSent ? 1 : 0);
    if (!sent) return this.acabarJantar(J, false, '');
    let falta = sent; const comeu = [];
    for (const o of bau.filter((o) => o && comidaJantar(o.k)).sort((a, b) => (DESPENSA.racao[a.k] || 3) - (DESPENSA.racao[b.k] || 3))) {
      const q = Math.min(contar(bau, o.k), falta); if (!q) continue;
      tirar(bau, o.k, q); comeu.push({ k: o.k, n: q }); falta -= q; if (!falta) break;
    }
    if (falta === sent) return this.acabarJantar(J, false, '');
    J.comida = comeu;
    this.servirJantar(J);
  },
};
// o clã bot pelo id (para os testes)
export const claBotJantar = (id) => CLAS_NPC.find((C) => C.id === id) || null;

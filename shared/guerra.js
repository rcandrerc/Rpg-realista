// Chama x Geada (André 2026-11-18, fase 1; plano: https://claude.ai/artifact/53pVbmJ3U39wpzRxQcXubf).
// Estas funções entram na Simulacao (Object.assign no fim de simulacao.js), então "this" é a Simulacao (ou a "janela" de
// um NPC, contextoDeAmigo em shared/amiga.js: aí this.AMIGA e this.amiga são dele).
//
// - racaDe: a raça de quem é jogador (NPC: a da definição; jogador: prog.raca, e todo mundo é da Chama na fase 1).
// - Quem pode lutar (j.guerra) é conferido a cada GUERRA.recheca s em passoGuerra: vivo, acima da Trégua (Nv 30) e fora
//   da zona segura (vila, totem, campo até Nv 30). emGuerra(a, b): os dois podem e são de raças diferentes.
// - inimigosDe (simulacao.js) põe a outra raça na lista de alvos; ferir marca a briga (pvpDe/pvpT) e morrer chama
//   morteGuerra (só desgaste, sem perder XP; fala de quem matou e de quem caiu; quem matou poupa por GUERRA.poupa s).
// - guerraAmiga: o cérebro de guerra dos NPCs com jeito de guerra (AMIGA.guerra: Kira, Rufo, Lis e o Dario).
// - falaGuerra: as falas por peças (FALAS_GUERRA), com memória de cada pessoa e sem repetir as últimas.
import { GUERRA, RACAS, RACA_PADRAO, TOTENS, VILAS_MUNDO, vilaEm, FALAS_GUERRA } from './dados.js';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const sorteia = (l) => l[Math.floor(Math.random() * l.length)];

export const Guerra = {
  racaDe(j) { return j?.raca || j?.prog?.raca || RACA_PADRAO; },
  outraRaca(a, b) { return !!a && !!b && this.racaDe(a) !== this.racaDe(b); },
  nomeRaca(j) { return RACAS[this.racaDe(j)]?.nome || ''; },
  // zona segura da guerra: toda vila (mini vilas do mundo, terrenos, a vila do começo), GUERRA.totem m em volta de cada
  // totem e todo campo de caça até o Nv GUERRA.campoAte (com GUERRA.campoFolga m de folga)
  zonaSeguraGuerra(x, z) {
    const W = GUERRA;
    for (const t of TOTENS.lista) if (Math.abs(t.x - x) < W.totem && Math.abs(t.z - z) < W.totem && Math.hypot(t.x - x, t.z - z) < W.totem) return true;
    for (const V of VILAS_MUNDO) if (Math.hypot(V.x - x, V.z - z) < (V.raio || 20) + W.vilaFolga) return true;
    if (vilaEm(x, z)) return true;
    for (const c of this.cacas || []) { const d = c.def; if ((d.nivel || 1) <= W.campoAte && Math.hypot(d.x - x, d.z - z) < (d.r || 12) + W.campoFolga) return true; }
    return false;
  },
  // pode lutar agora (o que passoGuerra deixa em j.guerra)
  podeGuerra(j) {
    return !j.morto && !j.criando && !(j.cenaAte > this.tempo) && (j.prog?.nivel | 0) > GUERRA.tregua && !this.naCaverna(j) && !this.zonaSeguraGuerra(j.x, j.z);
  },
  emGuerra(a, b) { return a !== b && a?.tipo === 'jogador' && b?.tipo === 'jogador' && !!a.guerra && !!b.guerra && this.racaDe(a) !== this.racaDe(b); },
  // a cada GUERRA.recheca s: quem pode lutar; o jogador de verdade fica sabendo quando entra ou sai da zona de guerra
  // (só quem passou da Trégua e no máximo uma vez a cada GUERRA.aviso s)
  passoGuerra() {
    const W = GUERRA;
    if (this.tempo < (this.guerraT || 0)) return;
    this.guerraT = this.tempo + W.recheca;
    for (const j of this.jogadores.values()) {
      const antes = !!j.guerra; j.guerra = this.podeGuerra(j);
      if (j.bot || j.guerra === antes || j.morto || (j.prog?.nivel | 0) <= W.tregua) continue;
      if (this.tempo < (j.guerraAvisoT ?? -1e9) + W.aviso) continue;
      j.guerraAvisoT = this.tempo;
      this.evento({ t: 'aviso', para: j.id, texto: j.guerra ? 'Zona de guerra: a outra raça pode atacar' : 'Zona segura' });
    }
    // os NPCs com falas de guerra comentam quem da outra raça apareceu perto (também no time do André)
    for (const ctx of this.amigosIa) {
      const a = ctx.amiga; if (!a || a.morto || !FALAS_GUERRA[ctx.AMIGA.id]) continue;
      for (const o of this.jogadores.values()) {
        if (o === a || o.morto || o.criando || !this.outraRaca(a, o) || (o.prog?.nivel | 0) <= W.tregua || dist(o, a) > W.ve * 0.75) continue;
        const m = ctx.memGuerra(a, o); if (this.tempo - (m.vistoT ?? -1e9) < W.avistar) continue;
        m.vistoT = this.tempo; m.n = (m.n | 0) + 1;
        ctx.falaGuerra('avista', o);
        break;
      }
    }
  },
  // ---------- memória de cada pessoa (no NPC; vai junto com o save dele) ----------
  // n: quantas vezes já se viram; v: quantas vezes o NPC derrubou a pessoa; d: quantas vezes a pessoa derrubou o NPC;
  // poupa: até quando (Date.now) ele não ataca essa pessoa de novo
  memGuerra(a, o) {
    const k = o.conta || o.nome || o.id, M = (a.guerraMem ||= {});
    return (M[k] ||= { n: 0, v: 0, d: 0 });
  },
  // ---------- falas por peças (sem IA) ----------
  // gatilho: avista, ataca, ajuda, foge, poupa, desiste, segura, mata, morre, conversa, recusa. O sufixo mais específico
  // ganha (_tregua, _rev, _fregues); abre/fecho entram às vezes nos gatilhos de conversa. para = só quem tocou nele
  // (conversa, recusa); senão todo mundo (de verdade) a até GUERRA.ouvir m ouve. Devolve o texto (ou '' se calou).
  montarFalaGuerra(gatilho, o) {
    const a = this.amiga, F = FALAS_GUERRA[this.AMIGA.id]; if (!a || !F) return '';
    const m = o ? this.memGuerra(a, o) : { n: 0, v: 0, d: 0 };
    const sufixos = [];
    if (o && (o.prog?.nivel | 0) <= GUERRA.tregua) sufixos.push('_tregua');
    if (m.d > m.v) sufixos.push('_rev');
    if (m.v > m.d) sufixos.push('_fregues');
    let lista = null;
    for (const s of sufixos) if (F[gatilho + s]?.length && Math.random() < 0.7) { lista = F[gatilho + s]; break; }
    lista ||= F[gatilho]; if (!lista?.length) return '';
    const ditas = (a.ia.ditasGuerra ||= []);
    const livres = lista.filter((f) => !ditas.includes(f));
    const nucleo = sorteia(livres.length ? livres : lista);
    ditas.push(nucleo); if (ditas.length > GUERRA.lembrar) ditas.shift();
    const conversa = gatilho === 'conversa' || gatilho === 'avista' || gatilho.startsWith('conversa');
    let txt = nucleo;
    if (conversa && F.abre?.length && Math.random() < 0.3 && !/\{nome\}/.test(nucleo)) txt = sorteia(F.abre) + ' ' + txt;
    if (conversa && F.fecho?.length && Math.random() < 0.25) txt = txt + ' ' + sorteia(F.fecho);
    return txt.replace(/\{nome\}/g, o?.nome || 'você').replace(/\{n\}/g, String(m.n | 0)).replace(/\{eu\}/g, String(m.v | 0)).replace(/\{ele\}/g, String(m.d | 0));
  },
  falaGuerra(gatilho, o, para = null) {
    const a = this.amiga; if (!a) return '';
    const ia = a.ia, forte = gatilho === 'mata' || gatilho === 'morre'; // derrubar e cair sempre têm fala
    if (!para && !forte && this.tempo < (ia.falaGuerraT ?? -1e9) + GUERRA.falaEntre) return '';
    const txt = this.montarFalaGuerra(gatilho, o); if (!txt) return '';
    if (!para) ia.falaGuerraT = this.tempo;
    const ev = { t: 'fala', npc: this.AMIGA.id, texto: `${this.AMIGA.nome}: ${txt}`, guerra: this.racaDe(a) };
    if (para) this.evento({ ...ev, para });
    else for (const j of this.jogadores.values()) if (!j.bot && dist(j, a) <= GUERRA.ouvir) this.evento({ ...ev, para: j.id });
    return txt;
  },
  // tocou nele e escolheu Conversar (o app manda 'rival'): a fala de conversa, sempre só para quem tocou
  conversaGuerra(id) {
    const a = this.amiga, j = this.jogadores.get(id); if (!a || !j || j.bot) return;
    if (dist(a, j) > 8) return this.evento({ t: 'aviso', para: id, texto: `Chegue mais perto de ${this.AMIGA.nome}` });
    this.falaGuerra('conversa', j, id);
  },
  // pediu time, troca, amizade ou duelo com alguém da outra raça: true = recusado (o NPC responde; o jogador vê o aviso)
  recusaGuerra(j, o) {
    if (!this.outraRaca(j, o)) return false;
    const ctx = o.bot ? this.amigoIaDe(o) : null;
    if (ctx && FALAS_GUERRA[ctx.AMIGA.id]) ctx.falaGuerra('recusa', j, j.id);
    else this.evento({ t: 'aviso', para: j.id, texto: `${o.nome} é da ${this.nomeRaca(o)}: não dá` });
    return true;
  },
  // a morte de guerra (simulacao.js morrer): quem matou e quem caiu falam e lembram; quem matou poupa por GUERRA.poupa s
  morteGuerra(c, k) {
    const ctxC = c.bot ? this.amigoIaDe(c) : null, ctxK = k?.bot ? this.amigoIaDe(k) : null;
    if (ctxK?.amiga) { const m = ctxK.memGuerra(k, c); m.v = (m.v | 0) + 1; m.poupa = Date.now() + GUERRA.poupa * 1000; if (k.ia?.guerra) k.ia.guerra.alvo = null; ctxK.falaGuerra('mata', c); }
    if (ctxC?.amiga && k) { const m = ctxC.memGuerra(c, k); m.d = (m.d | 0) + 1; if (c.ia) c.ia.falaGuerraT = -1e9; ctxC.falaGuerra('morre', k); }
  },
  // ---------- cérebro de guerra (NPC com AMIGA.guerra, fora do time do dono) ----------
  // A cada GUERRA.recheca s: ajudar quem é da raça dele e está brigando perto; senão o mais perto da outra raça que dá
  // para atacar (a até GUERRA.ve m). Decide pelo jeito: honra poupa quem é 10+ níveis mais fraco; a vantagem (aliados,
  // nível, vida) vezes a coragem diz se ataca; sem vantagem e com o outro chegando, foge. Paciência: espera o outro chegar
  // mais perto (ou estar ocupado lutando) antes de atacar. Persegue até GUERRA.persegue m de onde começou; quem entrou na
  // zona segura ganha uma fala e fica em paz. Com pouca vida (GUERRA.desisteVida) foge para casa por GUERRA.foge s.
  // true = cuidou do passo (a rotina de caça espera).
  guerraAmiga(j, dt) {
    const G = this.AMIGA.guerra, W = GUERRA, t = this.tempo; if (!G || j.time || j.troca || j.duelo || j.morto) return false;
    const g = (j.ia.guerra ||= { alvo: null, t: 0, de: null, foge: 0 });
    if (g.foge > t) { // fugindo para casa (ou para a vila dele)
      const M = this.moradiaAmiga(j);
      if (!j.guerra || this.irLongeAmiga(j, M.x, M.z, dt)) g.foge = 0;
      return g.foge > t;
    }
    if (t >= g.t) {
      g.t = t + W.recheca;
      let alvo = g.alvo && this.jogadores.get(g.alvo);
      if (alvo && (alvo.morto || !this.emGuerra(j, alvo) || dist(alvo, g.de) > W.persegue)) {
        if (!alvo.morto && alvo.guerra === false && this.outraRaca(j, alvo)) this.falaGuerra('segura', alvo);
        else if (!alvo.morto && j.guerra) this.falaGuerra('desiste', alvo);
        g.alvo = null; alvo = null;
      }
      if (!alvo && j.guerra) {
        const nv = j.prog.nivel | 0, agora = Date.now();
        const aliados = [...this.jogadores.values()].filter((o) => o !== j && !o.morto && !this.outraRaca(j, o) && o.guerra && dist(o, j) < W.ve);
        // ajudar: alguém da raça dele está brigando com a outra raça perto
        for (const o of aliados) {
          const e = o.pvpDe && this.jogadores.get(o.pvpDe);
          if (e && t - o.pvpT < 3 && this.emGuerra(j, e) && dist(e, j) < W.ve) { alvo = e; this.falaGuerra('ajuda', e); break; }
        }
        if (!alvo) {
          let melhor = null, md = W.ve;
          for (const o of this.jogadores.values()) {
            if (!this.emGuerra(j, o)) continue;
            const d = dist(o, j); if (d >= md) continue;
            const m = this.memGuerra(j, o); if ((m.poupa || 0) > agora) continue;
            md = d; melhor = o;
          }
          if (melhor) {
            const o = melhor, m = this.memGuerra(j, o), dif = (o.prog.nivel | 0) - nv;
            if (dif <= -10 && Math.random() < G.honra) { m.poupa = agora + 120000; this.falaGuerra('poupa', o); }
            else {
              const deles = [...this.jogadores.values()].filter((x) => !x.morto && x.guerra && this.racaDe(x) === this.racaDe(o) && dist(x, o) < 15).length;
              const vantagem = (aliados.filter((x) => dist(x, j) < 15).length + 1) / Math.max(1, deles) * Math.max(0.3, 1 - dif * 0.06) * (j.vida / j.vidaMax);
              const quer = vantagem * (0.5 + G.coragem) >= 1;
              const espera = G.paciencia > 0.5 && md > W.ve * (1 - G.paciencia) && !(t - (o.pvpT ?? -1e9) < 3) && !(o.combateAte > t);
              if (quer && !espera) { alvo = o; this.falaGuerra('ataca', o); }
              else if (!quer && md < 14 && Math.hypot(o.entrada?.mx || 0, o.entrada?.mz || 0) > 0.1) { g.foge = t + W.foge; this.falaGuerra('foge', o); this.pararColetaGuerra(j); return true; }
            }
          }
        }
        if (alvo) { g.alvo = alvo.id; g.de = { x: j.x, z: j.z }; }
      }
    }
    const alvo = g.alvo && this.jogadores.get(g.alvo);
    if (!alvo) return false;
    if (j.vida / j.vidaMax < W.desisteVida && !j.prog.mochila.some((o) => o?.k === 'pocao')) { g.alvo = null; g.foge = t + W.foge; this.falaGuerra('foge', alvo); return true; }
    this.pararColetaGuerra(j);
    j.montado = null;
    if (this.cerebroAmiga(j, j, alvo)) return true;
    if (j.ia.cer?.faca === 'fugir') { g.alvo = null; g.foge = t + W.foge; this.falaGuerra('foge', alvo); return true; }
    this.irDireto(j, alvo.x, alvo.z, true);
    return true;
  },
  pararColetaGuerra(j) { if (j.coleta) this.pararColeta(j, null); if (j.pesca) this.pararPesca(j, null); },
};

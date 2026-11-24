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
import { GUERRA, RACAS, RACA_PADRAO, TOTENS, FALAS_GUERRA, CHAT, ASSUNTOS_GUERRA, DUPLAS_GUERRA, PACKS, PACK_REGRAS, VEICULOS } from './dados.js';
import { packValido, precoPack, centroNavio, lugarDoVeiculo, acharPonto, fundoAgua } from './transporte.js';
import { AGUA } from './relevo.js';
// as falas de guerra do bot: o recruta de clã bot usa as de quem ele imita (falas: 'kira'); os outros, as do próprio id.
// AMIGA.falas dos amigos virtuais é o repertório (objeto): sem este cuidado a Geada ficava muda na guerra.
const chaveGuerra = (A) => (typeof A?.falas === 'string' ? A.falas : A?.id);

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const hashId = (id) => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };
const sorteia = (l) => l[Math.floor(Math.random() * l.length)];

export const Guerra = {
  racaDe(j) { return j?.raca || j?.prog?.raca || RACA_PADRAO; },
  outraRaca(a, b) { return !!a && !!b && this.racaDe(a) !== this.racaDe(b); },
  nomeRaca(j) { return RACAS[this.racaDe(j)]?.nome || ''; },
  // zona segura da guerra (André 2026-11-22: "Remover as zonas de segurança da Villa somente área em volta do totem mesmo e
  // terreno"): GUERRA.totem m em volta de cada totem, o terreno do próprio jogador (j), mercador de pack, cais e campo de
  // caça até o Nv GUERRA.campoAte. Dentro das vilas (fora do totem) pode atacar e ser atacado
  zonaSeguraGuerra(x, z, j = null) {
    const W = GUERRA;
    for (const t of TOTENS.lista) if (Math.abs(t.x - x) < W.totem && Math.abs(t.z - z) < W.totem && Math.hypot(t.x - x, t.z - z) < W.totem) return true;
    if (j?.conta) for (const L of this.lotes?.values?.() || []) { const d = L.def; if (L.dono === j.conta && d && x >= d.x0 && x <= d.x1 && z >= d.z0 && z <= d.z1) return true; }
    // mercador de pack e cais de embarque (André 2026-11-21): ponto de carga e descarga é seguro; saiu dali, é combate
    for (const n of this.mapa?.npcs || []) if (n.funcao === 'pack' && Math.abs(n.x - x) < W.mercador && Math.abs(n.z - z) < W.mercador && Math.hypot(n.x - x, n.z - z) < W.mercador) return true;
    for (const c of this.mapa?.cais || []) if (Math.hypot(c.x - x, c.z - z) < W.cais) return true;
    for (const c of this.cacas || []) { const d = c.def; if ((d.nivel || 1) <= W.campoAte && Math.hypot(d.x - x, d.z - z) < (d.r || 12) + W.campoFolga) return true; }
    return false;
  },
  // pode lutar agora (o que passoGuerra deixa em j.guerra)
  podeGuerra(j) {
    return !j.pvp && !j.morto && !j.criando && !(j.cenaAte > this.tempo) && (j.prog?.nivel | 0) > GUERRA.tregua && !this.naCaverna(j) && !this.zonaSeguraGuerra(j.x, j.z, j);
  },
  // protegido (GUERRA.protecao s depois de levantar da queda): ninguém ataca ele. eu = quem quer bater: a proteção dele
  // não impede (bater acaba com ela, em ferir)
  protegido(a) { return a?.protGuerraAte > this.tempo; },
  // robô de testes (contas 'robo:', j.robo) fica fora da guerra (André 2026-11-24: "se quiser deixar um bot imune a PVP,
  // pode ser também... ele vai morrer o tempo todo"): ninguém da outra raça ataca ele e ele não ataca ninguém. A zona de
  // guerra (j.guerra) continua valendo para ele nas etapas da história; monstro continua batendo nele
  emGuerra(a, b, eu = false) { return a !== b && a?.tipo === 'jogador' && b?.tipo === 'jogador' && !a.robo && !b.robo && !!a.guerra && !!b.guerra && this.racaDe(a) !== this.racaDe(b) && (eu || !this.protegido(a)) && !this.protegido(b); },
  // a cada GUERRA.recheca s: quem pode lutar; o jogador de verdade fica sabendo quando entra ou sai da zona de guerra
  // (só quem passou da Trégua e no máximo uma vez a cada GUERRA.aviso s)
  passoGuerra() {
    const W = GUERRA;
    if (this.tempo < (this.guerraT || 0)) return;
    this.guerraT = this.tempo + W.recheca;
    for (const j of this.jogadores.values()) {
      j.guerra = this.podeGuerra(j);
      // compara com o último aviso mandado (revisão 2026-11-19): a mudança que caiu dentro dos GUERRA.aviso s sai depois, não some
      if (j.bot || j.guerra === !!j.guerraAvisado || j.morto || (j.prog?.nivel | 0) <= W.tregua) continue;
      if (this.tempo < (j.guerraAvisoT ?? -1e9) + W.aviso) continue;
      j.guerraAvisoT = this.tempo; j.guerraAvisado = j.guerra;
      this.evento({ t: 'aviso', para: j.id, texto: j.guerra ? 'Zona de guerra: a outra raça pode atacar' : 'Zona segura' });
    }
    // alerta (André 2026-11-21: "se deu 20 ou 25 metros de uma raça oposta, acende um alerta para o jogador"): a até
    // GUERRA.alerta m, no máximo um aviso por pessoa a cada GUERRA.alertaEntre s
    for (const j of this.jogadores.values()) {
      if (j.bot || j.morto || j.criando || !j.guerra) continue;
      const A = (j.alertaGuerra ||= {});
      for (const o of this.jogadores.values()) {
        // o outro pode estar dentro da vila (André 2026-11-22: "o Rufo estava na vila e eu passei fora, não acionou
        // alarme"): avisa de quem é da outra raça e passou da Trégua, mesmo na zona segura dele
        if (o === j || o.tipo !== 'jogador' || !this.outraRaca(o, j) || (o.prog?.nivel | 0) <= W.tregua || o.morto || o.criando || o.pvp || this.naCaverna(o)) continue;
        const d = dist(o, j); if (d > W.alerta) continue;
        const k = o.conta || o.id; if (this.tempo < (A[k] ?? -1e9) + W.alertaEntre) continue;
        A[k] = this.tempo;
        this.evento({ t: 'aviso', para: j.id, texto: `⚠ ${o.nome} (${this.nomeRaca(o)}) a ${Math.round(d)} m!` });
      }
    }
    this.passoEmboscadas(); this.passoRondas();
    // os NPCs com falas de guerra comentam quem da outra raça apareceu perto (também no time do André)
    for (const ctx of this.amigosIa) {
      const a = ctx.amiga; if (!a || a.morto || !FALAS_GUERRA[chaveGuerra(ctx.AMIGA)]) continue;
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
    const a = this.amiga, F = FALAS_GUERRA[chaveGuerra(this.AMIGA)]; if (!a || !F) return '';
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
    if (para) this.evento({ t: 'fala', npc: this.AMIGA.id, texto: `${this.AMIGA.nome}: ${txt}`, guerra: this.racaDe(a), para });
    else this.falaLocal(a, this.AMIGA.conta, txt); // André 2026-11-18: no chat Local, com balão em cima da cabeça
    return txt;
  },
  // ---------- chat Local (André 2026-11-18: "conversa local", balão em cima da cabeça) ----------
  // quem (de verdade) está a até CHAT.local m de c: as contas que leem a mensagem
  ouvemLocal(c) { return [...this.jogadores.values()].filter((o) => !o.bot && !o.criando && o.conta && dist(o, c) <= CHAT.local).map((o) => o.conta); },
  // um NPC fala no Local (o mesmo caminho da mensagem de um jogador: receberChat entrega e põe o balão)
  falaLocal(corpo, conta, texto) {
    const ouvem = this.ouvemLocal(corpo); if (!ouvem.length) return null;
    const msg = { canal: 'local', c: conta, nome: corpo.nome, texto: String(texto).slice(0, CHAT.max), hora: Date.now(), id: corpo.id, ouvem };
    this.receberChat(msg);
    return msg;
  },
  // a língua da raça (RACAS[r].lingua, André 2026-11-18 "igual no ArcheAge"): cada palavra vira sílabas da língua de quem
  // falou, sempre as mesmas para a mesma palavra; pontuação e maiúscula ficam
  linguaDe(texto, raca) {
    const S = RACAS[raca]?.lingua; if (!S?.length) return String(texto);
    return String(texto).replace(/[\p{L}\p{N}]+/gu, (w) => {
      let h = 2166136261 ^ raca.length;
      for (const ch of w.toLowerCase()) h = Math.imul(h ^ ch.codePointAt(0), 16777619) >>> 0;
      let s = '';
      for (let i = Math.max(1, Math.round(w.length / 3)); i > 0; i--) { s += S[h % S.length]; h = Math.imul(h ^ (i * 31 + 7), 16777619) >>> 0; }
      return w[0] !== w[0].toLowerCase() ? s[0].toUpperCase() + s.slice(1) : s;
    });
  },
  // alguém escreveu no Local. NPC de guerra da outra raça que está perto não entende a língua: responde com 'lingua'.
  // Da mesma raça entende: só responde se falaram do Kael. Depois de uns segundos, no máximo uma vez a cada GUERRA.falaEntre s
  ouvirLocal(id, texto) {
    const j = this.jogadores.get(id); if (!j || j.bot) return;
    const t = String(texto || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const assunto = ASSUNTOS_GUERRA.find(([, re]) => re.test(t))?.[0] || 'conversa';
    for (const ctx of this.amigosIa) {
      const a = ctx.amiga; if (!a || a.morto || !FALAS_GUERRA[chaveGuerra(ctx.AMIGA)] || dist(a, j) > CHAT.local) continue;
      const outra = this.outraRaca(j, a);
      if (!outra && !(assunto === 'kael' && FALAS_GUERRA[chaveGuerra(ctx.AMIGA)].kael)) continue;
      if (this.tempo < (a.ia.respLocalT ?? -1e9) + GUERRA.falaEntre) continue;
      a.ia.respLocalT = this.tempo;
      const [d0, d1] = GUERRA.resposta;
      const qual = outra ? 'lingua' : assunto;
      this.depois(d0 + Math.random() * (d1 - d0), () => {
        if (!ctx.amiga || ctx.amiga.morto || !this.jogadores.has(j.id)) return;
        const F = FALAS_GUERRA[chaveGuerra(ctx.AMIGA)];
        const txt = ctx.montarFalaGuerra(F[qual] ? qual : F.conversa ? 'conversa' : 'avista', j);
        if (txt) ctx.falaLocal(ctx.amiga, ctx.AMIGA.conta, txt);
      });
    }
  },
  // dois da mesma raça perto um do outro (e alguém de verdade ouvindo) conversam de vez em quando (DUPLAS_GUERRA)
  passoDuplasGuerra() {
    const W = GUERRA;
    if (this.tempo < (this.duplaT ??= this.tempo + W.dupla[0] * Math.random())) return;
    this.duplaT = this.tempo + W.dupla[0] + Math.random() * (W.dupla[1] - W.dupla[0]);
    const corpo = (id) => { const x = this.amigoIaDe(id); return x?.amiga && !x.amiga.morto && !x.amiga.ia?.guerra?.alvo ? x : null; };
    const ok = DUPLAS_GUERRA.filter(([[a], [b]]) => { const A = corpo(a), B = corpo(b); return A && B && dist(A.amiga, B.amiga) <= W.duplaPerto && this.ouvemLocal(A.amiga).length; });
    if (!ok.length) return;
    const D = sorteia(ok);
    D.forEach(([id, txt], i) => this.depois(i * 3, () => { const x = corpo(id); if (x) x.falaLocal(x.amiga, x.AMIGA.conta, txt); }));
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
    if (ctx && FALAS_GUERRA[chaveGuerra(ctx.AMIGA)]) ctx.falaGuerra('recusa', j, j.id);
    else this.evento({ t: 'aviso', para: j.id, texto: `${o.nome} é da ${this.nomeRaca(o)}: não dá` });
    return true;
  },
  // a morte de guerra (simulacao.js morrer): quem matou e quem caiu falam e lembram; quem matou poupa por GUERRA.poupa s
  morteGuerra(c, k) {
    this.fragmentoGuerra?.(c, k); // Fragmento de Alma da raça de quem caiu (níveis do clã, shared/cla.js)
    if (k && !k.bot && k !== c) this.historia?.(k, 'guerra_matar'); // Ato do Clã: o fim da Trégua
    const ctxC = c.bot ? this.amigoIaDe(c) : null, ctxK = k?.bot ? this.amigoIaDe(k) : null;
    if (ctxK?.amiga) { const m = ctxK.memGuerra(k, c); m.v = (m.v | 0) + 1; m.poupa = Date.now() + GUERRA.poupa * 1000; if (k.ia?.guerra) k.ia.guerra.alvo = null; ctxK.falaGuerra('mata', c); }
    if (ctxC?.amiga && k) { const m = ctxC.memGuerra(c, k); m.d = (m.d | 0) + 1; if (c.ia) c.ia.falaGuerraT = -1e9; ctxC.falaGuerra('morre', k); }
    // o feito vai para o Geral (André 2026-11-18: "só os feitos grandes"), no máximo um a cada GUERRA.feito s
    if (k && this.tempo >= (this.feitoGuerraT ?? -1e9) + GUERRA.feito) { this.feitoGuerraT = this.tempo; this.anunciar(`${k.nome} (${this.nomeRaca(k)}) derrubou ${c.nome} (${this.nomeRaca(c)})`); }
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
    if (!j.prog.pack) j.ia.packRoubo = null;
    if (j.ia.packRoubo) return this.levarRoubadoAmiga(j, dt); // pegou um pack na emboscada: foge para casa com ele
    if (g.foge > t) { // fugindo para casa (ou para a vila dele)
      const M = this.moradiaAmiga(j);
      if (!j.guerra || this.irLongeAmiga(j, M.x, M.z, dt)) g.foge = 0;
      if (this.emCombateGuerra(j)) j.montado = null; // a mesma regra do jogador: em combate, nada de lobo (GUERRA.montaria s)
      return g.foge > t;
    }
    if (g.emb && this.passoEmboscadaAmiga(j, g, dt)) return true; // emboscada (André 2026-11-21)
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
        // André 2026-11-21: viu alguém da outra raça a até GUERRA.agro m, parte pro ataque (sem esperar, sem poupar fraco;
        // GUERRA.poupaFraco liga de novo a honra de poupar quem é 10+ níveis mais fraco)
        if (!alvo) {
          let melhor = null, md = W.agro;
          for (const o of this.jogadores.values()) {
            if (!this.emGuerra(j, o)) continue;
            const d = dist(o, j); if (d >= md) continue;
            const m = this.memGuerra(j, o); if ((m.poupa || 0) > agora) continue;
            md = d; melhor = o;
          }
          if (melhor) {
            const o = melhor, m = this.memGuerra(j, o), dif = (o.prog.nivel | 0) - nv;
            if (W.poupaFraco && dif <= -10 && Math.random() < G.honra) { m.poupa = agora + 120000; this.falaGuerra('poupa', o); }
            else { alvo = o; this.falaGuerra('ataca', o); }
          }
        }
        if (alvo) { g.alvo = alvo.id; g.de = { x: j.x, z: j.z }; }
      }
    }
    const alvo = g.alvo && this.jogadores.get(g.alvo);
    if (!alvo) return this.passoRondaAmiga(j, dt); // sem briga: a ronda da raça (se ele foi chamado)
    if (this.fogeOuTerminaAmiga(j, alvo)) { g.alvo = null; g.foge = t + W.foge; this.falaGuerra('foge', alvo); this.pararColetaGuerra(j); return true; }
    this.pararColetaGuerra(j);
    j.montado = null;
    if (this.cerebroAmiga(j, j, alvo)) return true;
    if (j.ia.cer?.faca === 'fugir') { g.alvo = null; g.foge = t + W.foge; this.falaGuerra('foge', alvo); return true; }
    this.irDireto(j, alvo.x, alvo.z, true);
    return true;
  },
  // André 2026-11-21: com menos de GUERRA.vidaFoge de vida o bot olha o inimigo. Ele com menos vida (proporção) que eu:
  // tento terminar. Ele com mais de GUERRA.inimigoFoge: fujo. Entre os dois: continuo. true = foge
  fogeOuTerminaAmiga(j, e) {
    const W = GUERRA, eu = j.vida / (j.vidaMax || 1); if (eu >= W.vidaFoge) return false;
    const ele = e ? e.vida / (e.vidaMax || 1) : 1;
    if (ele < eu) return false;
    return ele > W.inimigoFoge;
  },
  // ---------- ronda (André 2026-11-21: "uma rota que eles fazem... para existir a possibilidade de encontro") ----------
  // A cada GUERRA.ronda.entre s (sorteado), cada raça manda um grupo de até ronda.quantos bots com jeito de guerra (os que
  // estão livres: fora de time, troca, duelo, arena e tarefa) pela rota dela (ronda.rotas): de ponto em ponto, parando
  // ronda.parada s em cada um. No caminho vale tudo da guerra (veem a outra raça a GUERRA.agro m e atacam). Acabou a rota
  // ou ronda.dura s, cada um volta à vida normal. Vale para qualquer bot novo com AMIGA.guerra e raça.
  passoRondas() {
    const R = GUERRA.ronda, t = this.tempo; if (!R) return;
    const T = (this.rondaT ||= {});
    for (const raca of Object.keys(R.rotas)) {
      if (T[raca] == null) { T[raca] = t + R.entre[0] * 0.25 + Math.random() * (R.entre[1] - R.entre[0]) * 0.5; continue; } // a primeira sai mais cedo
      if (t < T[raca]) continue;
      T[raca] = t + R.entre[0] + Math.random() * (R.entre[1] - R.entre[0]);
      if (![...this.jogadores.values()].some((o) => !o.bot && !o.criando)) continue; // ninguém de verdade no mundo: nem sai
      const livres = this.botsDeGuerraLivres(raca).sort(() => Math.random() - 0.5).slice(0, R.quantos);
      if (!livres.length) continue;
      const id = 'r' + Math.round(t);
      for (const ctx of livres) Object.assign(ctx.amiga.ia.guerra ||= { alvo: null, t: 0, de: null, foge: 0 }, { ronda: { id, i: 0, ate: t + R.dura, para: 0, rota: R.rotas[raca] } });
    }
  },
  // os bots com jeito de guerra dessa raça que podem sair agora (ronda e emboscada)
  botsDeGuerraLivres(raca) {
    return (this.amigosIa || []).filter((ctx) => {
      const a = ctx.amiga; if (!a || !ctx.AMIGA.guerra || (ctx.AMIGA.recruta && !ctx.AMIGA.clanpc) || a.morto || a.criando || this.racaDe(a) !== raca) return false;
      return !a.time && !a.troca && !a.duelo && !a.pvp && !a.ia?.packTarefa && !a.ia?.encomenda && !a.ia?.packRoubo && !a.ia?.guerra?.emb && !a.ia?.guerra?.ronda && (a.prog?.nivel | 0) > GUERRA.tregua;
    });
  },
  passoRondaAmiga(j, dt) {
    const g = j.ia.guerra, r = g?.ronda; if (!r) return false;
    const t = this.tempo;
    if (t > r.ate || r.i >= r.rota.length) { g.ronda = null; j.ia.av = null; return false; }
    if (r.i === 0 && Math.hypot(r.rota[0][0] - j.x, r.rota[0][1] - j.z) < 30) r.i = 1; // já está em casa (o ponto 0): segue
    const [x, z] = r.rota[r.i];
    if (r.para) { if (t >= r.para) { r.para = 0; r.i++; } else { this.pararAmiga(j); j.montado = null; } return true; }
    // perto do ponto (o grupo se espalha um pouco): para e olha em volta
    if (Math.hypot(x - j.x, z - j.z) < 8 || this.irLongeAmiga(j, x + (hashId(j.id) % 7) - 3, z + ((hashId(j.id) >> 3) % 7) - 3, dt)) { if (r.i >= r.rota.length - 1) { r.i++; return true; } r.para = t + GUERRA.ronda.parada * (0.7 + Math.random() * 0.6); this.pararAmiga(j); }
    return true;
  },
  // ---------- emboscada (André 2026-11-21) ----------
  // o que o jogador leva agora: 'navio' (no leme com o porão), 'carrinho' (dirigindo com packs) ou 'costas'; null = nada
  cargaGuerra(j) {
    const p = j.prog;
    if (j.veiculo === 'navio' && p.navio?.porao?.length) return 'navio';
    if (j.veiculo === 'carrinho' && p.carrinho?.packs?.length) return 'carrinho';
    if (p.pack) return 'costas';
    return null;
  },
  // A cada passoGuerra: quem saiu da zona segura levando pack sorteia uma vez por viagem (GUERRA.emboscada.chance). Deu:
  // depois de atraso s de viagem (se ainda leva o pack fora da zona segura) chegam os bots da outra raça. No máximo uma a
  // cada emboscada.entre s por jogador (vale a conta, para sair e entrar não zerar).
  passoEmboscadas() {
    const E = GUERRA.emboscada, t = this.tempo, agora = Date.now(), ultima = (this.emboscadaT ||= new Map());
    for (const j of this.jogadores.values()) {
      if (j.bot || j.robo || j.criando || j.morto) continue;
      const carga = this.cargaGuerra(j);
      // André 2026-11-22 ("carrinho pode ser atacado"): o carrinho é alvo fora da zona segura mesmo com o dono no Nv 30 ou
      // menos; o dono continua na Trégua (ninguém bate nele) e o pack nas costas dele também continua protegido
      const tregua = (j.prog?.nivel | 0) <= GUERRA.tregua;
      const alvo = tregua ? carga === 'carrinho' && !j.pvp && !this.naCaverna(j) && !this.zonaSeguraGuerra(j.x, j.z, j) : j.guerra;
      if (!carga || !alvo) { j.embViagem = false; j.embQuando = null; continue; }
      if (!j.embViagem) {
        j.embViagem = true;
        if (agora >= (ultima.get(j.conta) || 0) && Math.random() < E.chance) j.embQuando = t + E.atraso[0] + Math.random() * (E.atraso[1] - E.atraso[0]);
      }
      if (j.embQuando && t >= j.embQuando) { j.embQuando = null; if (this.iniciarEmboscada(j, carga)) ultima.set(j.conta, agora + E.entre * 1000); }
    }
  },
  iniciarEmboscada(j, carga) {
    const E = GUERRA.emboscada, t = this.tempo;
    const outra = Object.keys(RACAS).find((r) => r !== this.racaDe(j)); if (!outra) return false;
    const n = E.quantos[0] + Math.floor(Math.random() * (E.quantos[1] - E.quantos[0] + 1));
    const bots = this.botsDeGuerraLivres(outra).sort(() => Math.random() - 0.5).slice(0, n);
    if (!bots.length) return false;
    const S = VEICULOS.navio.solido;
    bots.forEach((ctx, i) => {
      const a = ctx.amiga, g = (a.ia.guerra ||= { alvo: null, t: 0, de: null, foge: 0 });
      let q = null, lx = 0, lz = 0;
      if (carga === 'navio') { const b = S.bordo[(i * 3 + 1) % S.bordo.length]; lx = b[0]; lz = b[1]; } // sobem pela escada de corda
      else { // de longe (E.longe m), em terra, fora da zona segura; de preferência de lado ou de trás
        for (let k = 0; k < 24 && !q; k++) {
          const ang = (j.ry || 0) + Math.PI + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.35 + i * 0.6;
          const x = j.x + Math.sin(ang) * E.longe, z = j.z + Math.cos(ang) * E.longe;
          if (lugarDoVeiculo('carrinho', x, z) && fundoAgua(x, z) <= 0.05 && !this.zonaSeguraGuerra(x, z) && this.terreno.altura(x, z) < j.y + 6) q = { x, z };
        }
        if (!q) return;
        Object.assign(a, { x: q.x, z: q.z, y: this.terreno.altura(q.x, q.z), vy: 0, chao: true });
      }
      if (a.coleta) this.pararColeta(a, null); if (a.pesca) this.pararPesca(a, null);
      a.montado = null; a.bordo = null; a.ia.av = null; a.ia.viagem = null; a.ia.atividade = null;
      Object.assign(g, { alvo: null, foge: 0, ronda: null, emb: { dono: j.id, conta: j.conta, k: carga, ate: t + E.dura, x: j.x, z: j.z, lx, lz, golpeT: t + 1 + Math.random(), saque: 0 } });
      this.corrigir?.(a);
    });
    const vieram = bots.filter((ctx) => ctx.amiga.ia.guerra.emb?.dono === j.id);
    if (!vieram.length) return false;
    j.embAte = t + E.dura;
    const nomes = vieram.map((x) => x.AMIGA.nome), lista = nomes.length > 1 ? nomes.slice(0, -1).join(', ') + ' e ' + nomes[nomes.length - 1] : nomes[0];
    const oQue = carga === 'navio' ? 'abordaram seu navio' : carga === 'carrinho' ? 'vão atrás do seu carrinho' : 'vão atrás do seu pack';
    this.evento({ t: 'aviso', para: j.id, texto: `⚔ Emboscada! ${lista} (${RACAS[outra].nome}) ${oQue}!` });
    const ctx0 = vieram[0]; ctx0.falaGuerra?.('ataca', j);
    return true;
  },
  // onde está o veículo do dono da emboscada agora: { x, z, ry, k, v (o prog dele) } ou null (guardado, sumiu)
  veiculoDaEmboscada(dono, k) {
    if (!dono) return null;
    if (k === 'navio') { const n = dono.prog.navio; if (!n) return null; const q = dono.veiculo === 'navio' ? centroNavio(dono) : n.chao; return q ? { ...q, k, v: n } : null; }
    if (k === 'carrinho') { const c = dono.prog.carrinho; if (!c) return null; const q = dono.veiculo === 'carrinho' ? dono : c.chao; return q ? { x: q.x, z: q.z, ry: q.ry || 0, k, v: c } : null; }
    return null;
  },
  // um bot da emboscada: bate no carrinho/navio até quebrar, pega os packs que caíram e foge; quem bate nele de perto
  // apanha de volta. true = cuidou do passo
  passoEmboscadaAmiga(j, g, dt) {
    const E = g.emb, W = GUERRA, t = this.tempo, dono = this.jogadores.get(E.dono);
    const fim = () => { g.emb = null; j.bordo = null; j.ia.av = null; return false; };
    if (t > E.ate || !dono || dono.conta !== E.conta) return fim();
    if (this.fogeOuTerminaAmiga(j, dono)) { this.falaGuerra('foge', dono); fim(); g.foge = t + W.foge; this.pularDoNavioAmiga(j); return true; }
    const veic = this.veiculoDaEmboscada(dono, E.k);
    if (veic) { E.x = veic.x; E.z = veic.z; }
    else if (!dono.morto && E.k === 'costas') { E.x = dono.x; E.z = dono.z; }
    // no navio: fica no convés (anda com ele) batendo no casco; avariado, tira um pack do porão (E.saque s) e pula no mar
    if (E.k === 'navio') {
      if (!veic) return fim();
      const n = veic.v;
      this.noConvesAmiga(j, veic, E, dt);
      if (!n.quebrado) { this.golpeEmboscadaAmiga(j, E, veic, dono); return true; }
      if (!n.porao.length || j.prog.pack) { this.pularDoNavioAmiga(j); return fim(); }
      if ((E.saque += dt) >= W.emboscada.saque) {
        const pk = n.porao.pop(); dono.progSujo = true; this.avisarProg?.(dono);
        this.pegarRoubadoAmiga(j, pk, dono);
        this.pularDoNavioAmiga(j);
        return fim() || true;
      }
      return true;
    }
    // em terra: pack no chão perto (caiu do carrinho quebrado ou de quem morreu)? pega e foge
    if (!j.prog.pack) {
      let pg = null, pd = 22;
      for (const o of this.packsChao || []) { if (o.fica) continue; const d = Math.hypot(o.x - E.x, o.z - E.z); if (d < pd) { pd = d; pg = o; } } // palete: só o clã dono
      if (pg) {
        const d = Math.hypot(pg.x - j.x, pg.z - j.z);
        if (d > PACK_REGRAS.pegar - 0.3) { j.montado = null; this.irDireto(j, pg.x, pg.z, true); return true; }
        this.packsChao.splice(this.packsChao.indexOf(pg), 1);
        this.pegarRoubadoAmiga(j, pg, dono);
        return fim() || true;
      }
    }
    // o dono bateu nele agora há pouco e está perto: apanha de volta (a briga normal)
    const bateu = j.pvpDe === dono.id && t - (j.pvpT ?? -1e9) < 3 && !dono.morto && this.emGuerra(j, dono) && dist(dono, j) < 6;
    if ((bateu || E.k === 'costas' || (veic && veic.v.quebrado)) && !dono.morto && this.emGuerra(j, dono)) {
      j.montado = null;
      if (this.cerebroAmiga(j, j, dono)) return true;
      this.irDireto(j, dono.x, dono.z, true); return true;
    }
    if (veic && !veic.v.quebrado) {
      const d = Math.hypot(veic.x - j.x, veic.z - j.z);
      if (d > 2.4) { j.montado = null; this.irDireto(j, veic.x, veic.z, true); return true; }
      this.pararAmiga(j); this.golpeEmboscadaAmiga(j, E, veic, dono); return true;
    }
    // nada mais para pegar e o dono longe (ou protegido, ou na zona segura): desiste
    return fim();
  },
  // um golpe no veículo a cada emboscada.golpeEntre s (a animação do golpe de espada, virado para ele)
  golpeEmboscadaAmiga(j, E, veic, dono) {
    const W = GUERRA.emboscada, t = this.tempo;
    if (t < E.golpeT || j.trava > 0) return;
    E.golpeT = t + W.golpeEntre * (0.85 + Math.random() * 0.3);
    j.ry = Math.atan2(veic.x - j.x, veic.z - j.z);
    this.usarHabilidade(j.id, 0);
    this.danoVeiculo(dono, veic.k, W.golpe, j);
  },
  // bot no convés do navio da emboscada: anda até o meio (perto do porão) e fica de frente para ele
  noConvesAmiga(j, veic, E, dt) {
    const S = VEICULOS.navio.solido, alvo = [E.lx > 0 ? 0.5 : -0.5, 0.4], dx = alvo[0] - E.lx, dz = alvo[1] - E.lz, d = Math.hypot(dx, dz), passo = Math.min(d, 2.2 * dt);
    if (d > 0.05) { E.lx += dx / d * passo; E.lz += dz / d * passo; }
    const s = Math.sin(veic.ry || 0), c = Math.cos(veic.ry || 0);
    j.x = veic.x + E.lx * c + E.lz * s; j.z = veic.z - E.lx * s + E.lz * c;
    j.y = AGUA.nivel + S.conves; j.vy = 0; j.chao = true; j.montado = null;
    j.entrada = { mx: 0, mz: 0, correr: false }; j.bordoT = this.tempo; j.emboscadaNavio = true;
    j.bordo = { dono: E.dono, lx: E.lx, lz: E.lz, i: 0, troca: Infinity, emb: 1 }; // a física deixa o navio levar ele (simulacao.js passoJogador)
    if (d > 0.05) { j.ry = (veic.ry || 0) + Math.atan2(dx, dz); j.anim = 'Run'; }
  },
  // sai do convés: "pula no mar" e aparece nadando na terra firme mais perto (até 120 m), de onde foge para casa
  pularDoNavioAmiga(j) {
    if (!j.emboscadaNavio) return;
    j.emboscadaNavio = false; j.bordo = null;
    const q = acharPonto({ x: j.x, z: j.z, ry: j.ry || 0 }, (a, b) => fundoAgua(a, b) <= 0.05 && lugarDoVeiculo('carrinho', a, b), 120);
    if (q) Object.assign(j, { x: q.x, z: q.z, y: this.terreno.altura(q.x, q.z), vy: 0, chao: true });
    this.corrigir?.(j);
  },
  // pegou um pack da outra raça: vai nas costas e é roubado (vale o bônus de quem entregar)
  pegarRoubadoAmiga(j, pk, dono) {
    const p = packValido(pk); if (!p) return;
    if (this.racaDe(j) !== (pk.ra || RACA_PADRAO)) p.rb = 1;
    j.prog.pack = p; j.montado = null; j.ia.packRoubo = { de: dono?.conta || null, nome: dono?.nome || '' }; j.progSujo = true;
    if (dono) this.evento({ t: 'aviso', para: dono.id, texto: `${j.nome} pegou um ${(PACKS[p.k]?.nome || 'pack').toLowerCase()} e está fugindo! Derrube antes que chegue em casa.` });
    this.falaGuerra('mata', dono);
  },
  // com o pack roubado nas costas: foge para casa (a pé, devagar); chegou, vende (com o bônus de roubado) e volta à vida
  levarRoubadoAmiga(j, dt) {
    const M = this.moradiaAmiga(j), pk = j.prog.pack; if (!pk) { j.ia.packRoubo = null; return false; }
    j.montado = null;
    if (Math.hypot(M.x - j.x, M.z - j.z) > 6 && !this.irLongeAmiga(j, M.x, M.z, dt)) return true;
    const preco = Math.max(1, Math.round(precoPack(pk, M) * (pk.rb ? 1 + GUERRA.roubado : 1)));
    j.prog.ouro = (j.prog.ouro || 0) + preco; j.prog.pack = null;
    const R = j.ia.packRoubo; j.ia.packRoubo = null; j.progSujo = true;
    const vitima = R?.de && [...this.jogadores.values()].find((o) => o.conta === R.de);
    if (vitima) this.evento({ t: 'aviso', para: vitima.id, texto: `${j.nome} chegou em casa com o seu pack. Perdeu esse.` });
    this.pararAmiga(j);
    return true;
  },
  // algum bot da emboscada ainda atrás de j?
  emboscadaAtiva(j) { return (this.amigosIa || []).some((x) => x.amiga && !x.amiga.morto && x.amiga.ia?.guerra?.emb?.dono === j.id); },
  // brigou com a outra raça ou o veículo v apanhou há menos de GUERRA.montaria s (conserto espera)
  emCombateGuerra(j, v = null) { const t = this.tempo, W = GUERRA.montaria; return t - (j.pvpT ?? -1e9) < W || (v?.danoT != null && t - v.danoT < W); },
  pararColetaGuerra(j) { if (j.coleta) this.pararColeta(j, null); if (j.pesca) this.pararPesca(j, null); },
};

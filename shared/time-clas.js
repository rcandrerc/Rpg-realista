// Time entre líderes de clã (André 2026-11-27: "dar time pros líderes de clã da mesma raça ... tanto pro bot como o
// Dário, se ele tiver afim ... pra minha filha ou pro meu irmão"). Cada líder entra com os recrutas dele: o time vira
// grupos, um por clã (TIME.max cada, até TIME.clas grupos). A barra do time (godot-prototipo/amigos.gd) mostra cada grupo
// com o nome do líder e deixa minimizar (só o líder) ou abrir (líder + recrutas), o do próprio jogador também.
// O Dario (líder de clã bot da mesma raça) entra quando topa (liderTopaTimeAmiga); os recrutas dele não viram membros:
// vêm protegendo ele (função proteger líder) e aparecem no grupo dele como escolta, ganhando XP como o time.
import { TIME, CLAS_NPC } from './dados.js';

export const TimeClas = {
  // quem lidera o membro no time: 'c:<conta>' (jogador e os recrutas dele) ou 'b:<id>' (clã bot: o líder e os dele)
  grupoTime(o) {
    if (!o) return '';
    if (!o.bot) return 'c:' + o.conta;
    const x = this.amigoIaDe?.(o), A = x?.AMIGA; if (!A) return 'b:' + o.id;
    if (A.recruta && !A.clanpc && A.lider != null) return 'c:' + A.lider;
    const C = x.claBotAmiga?.(); return 'b:' + (C ? C.lider : A.id);
  },
  // quantos de cada grupo há no time
  gruposDoTime(T) {
    const gs = new Map();
    for (const k of T?.membros || []) { const g = this.grupoTime(this.jogadores.get(k)); if (g) gs.set(g, (gs.get(g) || 0) + 1); }
    return gs;
  },
  // cabem mais n do grupo g no time T? '' = cabe; senão o aviso
  cabeNoTime(T, g, n = 1) {
    if (!T) return n > TIME.max ? `O time já tem ${TIME.max} pessoas` : '';
    const gs = this.gruposDoTime(T);
    if ((gs.get(g) || 0) + n > TIME.max) return gs.size <= 1 ? `O time já tem ${TIME.max} pessoas` : `Cada clã leva até ${TIME.max} no time`;
    if (!gs.has(g) && gs.size >= TIME.clas) return `O time já tem ${TIME.clas} clãs`;
    return '';
  },
  // o time de j é só dele e dos recrutas dele (ele é o líder): pode levar todos para o time de outro líder
  timeSoDoCla(j) {
    const T = j?.time; if (!T || T.lider !== j.id) return false;
    const g = this.grupoTime(j);
    return T.membros.every((k) => k === j.id || (this.jogadores.get(k)?.bot && this.grupoTime(this.jogadores.get(k)) === g));
  },
  // j (com o time só do clã dele, ou sozinho) entra no time T, levando os recrutas. '' = entrou; senão o aviso
  levarClaParaTime(j, T) {
    const V = j.time && j.time !== T ? j.time : null, leva = V ? V.membros.filter((k) => k !== j.id) : [];
    const erro = this.cabeNoTime(T, this.grupoTime(j), 1 + leva.length); if (erro) return erro;
    if (V) { this.times?.delete(V); for (const k of V.membros) { const o = this.jogadores.get(k); if (o) o.time = null; } }
    for (const k of [j.id, ...leva]) { const o = this.jogadores.get(k); if (!o) continue; T.membros.push(k); o.time = T; }
    return '';
  },
  // j sai de um time de vários clãs: os recrutas dele saem junto e continuam num time com ele. true = fez isso
  sairComOCla(j, texto) {
    const T = j.time; if (!T || j.bot) return false;
    const g = this.grupoTime(j);
    const leva = T.membros.filter((k) => { const o = this.jogadores.get(k); return k !== j.id && o?.bot && this.grupoTime(o) === g; });
    const fica = T.membros.filter((k) => k !== j.id && !leva.includes(k));
    if (!leva.length || !fica.length) return false;
    T.membros = fica;
    const V = { lider: j.id, membros: [j.id, ...leva] }; (this.times ||= new Set()).add(V);
    for (const k of V.membros) { const o = this.jogadores.get(k); if (o) o.time = V; }
    if (!fica.includes(T.lider)) T.lider = fica.find((k) => !this.jogadores.get(k)?.bot) || fica[0];
    if (fica.length <= 1) { // sobrou um: o time de lá acaba
      this.times?.delete(T);
      for (const k of fica) { const o = this.jogadores.get(k); if (o) { o.time = null; this.evento({ t: 'time', para: k, fase: 'fim' }); this.evento({ t: 'aviso', para: k, texto: texto + ': o time acabou' }); } }
    } else { for (const k of fica) this.evento({ t: 'aviso', para: k, texto }); this.mudouTime(T); }
    this.mudouTime(V);
    return true;
  },
  // o nome do grupo na barra: "[clã] Líder" (o líder do grupo, mesmo fora da sala: o nome salvo do clã)
  nomeGrupoTime(g, T) {
    const tipo = g.slice(0, 2), id = g.slice(2);
    let corpo = null, nome = '', cla = '';
    if (tipo === 'c:') { corpo = this.porConta(id); nome = corpo?.nome || ''; cla = corpo?.prog?.cla?.n || this.clasFora?.get?.(id)?.n || ''; }
    else { const x = this.amigosIa?.find((o) => o.AMIGA.id === id); corpo = x?.amiga || null; nome = x?.AMIGA.nome || ''; cla = CLAS_NPC.find((C) => C.lider === id)?.n || ''; }
    if (!nome) for (const k of T.membros) { const o = this.jogadores.get(k); if (o && this.grupoTime(o) === g) { nome = o.nome; break; } }
    return { nome: String(nome || '').split(',')[0], cla: String(cla || '').slice(0, 24), lid: corpo?.id ?? null };
  },
  // escolta do líder bot no time: os recrutas do clã dele que estão protegendo ele, perto (até TIME.max - 1)
  escoltaTime(o) {
    const x = this.amigoIaDe?.(o); if (!x) return [];
    const C = CLAS_NPC.find((K) => K.lider === x.AMIGA.id), E = C && this.clasNpc?.[C.id]; if (!E) return [];
    const r = [];
    for (const m of E.m) {
      if (r.length >= TIME.max - 1) break;
      if (m.fn?.k !== 'proteger' || m.fn.p !== 'lider') continue;
      const a = this.amigosIa.find((y) => y.AMIGA.id === m.id)?.amiga;
      if (a && !a.morto && !a.time && Math.hypot(a.x - o.x, a.z - o.z) < TIME.perto) r.push(a);
    }
    return r;
  },
  // o time do líder bot que esse recruta escolta (XP como time), ou null
  timeDaEscolta(j) {
    if (!j?.bot || j.time) return null;
    const x = this.amigoIaDe?.(j), cid = x?.AMIGA.clanpc; if (!cid) return null;
    const C = CLAS_NPC.find((K) => K.id === cid), m = C && this.clasNpc?.[C.id]?.m.find((o) => o.id === x.AMIGA.id);
    if (m?.fn?.k !== 'proteger' || m.fn.p !== 'lider') return null;
    const L = this.amigosIa.find((y) => y.AMIGA.id === C.lider)?.amiga;
    return L?.time && Math.hypot(L.x - j.x, L.z - j.z) < TIME.perto ? L.time : null;
  },
  // o líder de clã bot (o Dario) topa entrar no time de j? '' = topa; senão o motivo ('semCla', 'base', 'outraRaca')
  liderTopaTimeAmiga(j) {
    if (!TIME.liderBot || !j || j.bot || !this.amiga) return 'lider';
    if (this.outraRaca?.(j, this.amiga)) return 'outraRaca';
    const C = this.claBotAmiga?.(); if (!C || C.lider !== this.AMIGA.id) return 'lider';
    if (!j.prog?.cla?.n) return 'semCla'; // só entre líderes de clã
    if (this.ameacaClaNpc?.(C, this.amiga)) return 'base'; // a base dele está sendo atacada: vai defender
    return '';
  },
};

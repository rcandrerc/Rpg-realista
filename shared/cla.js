// Clã e recrutas (André 2026-11-22: "o jogo vai mudar"). Fase 1.
// - Todo jogador funda um clã (nome) e é o líder. Conta antiga: nada some, só aparece a janela do nome do clã.
// - Painel do clã (aba Clã do menu): membros, cofre (ouro), recursos (somados das bolsas dos recrutas), a semana e o
//   histórico de gastos.
// - O Recrutador (Sargento Bruno na Clareira, Sargenta Hela no Juncal) vende recrutas em 3 níveis (CLA.tiers em
//   shared/dados.js). Nome, cara e jeito sorteados. O recruta é um NPC igual aos aventureiros por dentro (todos os
//   comandos de sempre: minerar, cortar lenha, seguir, time, missão, encomenda, barco, pack) com dono: só o líder
//   conversa e manda nele, e ele só tem corpo com o líder no jogo (como os bots de hoje com a sala).
// - Toda semana o cofre paga a soma das semanas (sobe com o nível de cada um e +10% por recruta depois do 3º). Sem
//   dinheiro no cofre, o recruta fica devendo; 7 dias sem receber, vai embora.
// Estado na conta: prog.cla = { n: nome, c: ms (fundado), cofre: ouro, sem: ms (próxima cobrança), m: [membros],
//   log: [{ t, txt, v }] }. Membro: { id, nome, g, ap, jeito, gosto, tier, nv0, nv, desde, dev: ms (devendo desde) }.
// O save de cada recruta (nível, bolsa, peças) fica na tabela mundo como o dos aventureiros ('npc:' + id).
import { CLA, ENCOMENDA, VIGOR, COLETA, defRecruta, nomeValido, CLAS_NPC, CLAS_NPC_REGRAS, vagasClaNpc, defRecrutaNpc, AMIGOS_VIRTUAIS, RIVAIS, RACAS } from './dados.js';
import { contextoDeAmigo } from './amiga.js';
import { guardar, xpProximo } from './progresso.js'; // só usadas em tempo de jogo (progresso.js também importa daqui)

const sorteia = (l, r) => l[Math.floor(r() * l.length)];
const int = (v, a, b, d) => (Number.isFinite(+v) ? Math.max(a, Math.min(b, Math.round(+v))) : d);
// vigor de agora (igual ao vigorAgora de progresso.js; aqui sem importar para não dar laço)
const vigorDe = (vg) => (vg ? Math.min(VIGOR.max, vg.v + (Math.max(0, Date.now() - vg.t) / 1000 / VIGOR.enche) * VIGOR.max) : VIGOR.max);
// função do recruta (painel): { k, r?: recurso, p?: 'lider' | id de outro recruta }
export function funcaoValida(fn) {
  if (!fn || typeof fn !== 'object' || !CLA.funcoes.some((F) => F.id === fn.k) || fn.k === 'livre') return null;
  if (fn.k === 'recurso') return Object.hasOwn(ENCOMENDA.recursos, fn.r) ? { k: 'recurso', r: fn.r } : null;
  if (fn.k === 'proteger') return fn.p === 'lider' || (typeof fn.p === 'string' && /^rc[a-z0-9]{4,16}$/.test(fn.p)) ? { k: 'proteger', p: fn.p } : null;
  return { k: fn.k };
}
const cor = (v) => (Number.isInteger(v) && v >= 0 && v <= 0xffffff ? v : 0x888888);

// confere o que veio da conta (progressoValido)
export function claValido(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  const n = nomeCla(c.n); if (!n) return null;
  const P = CLA.penteados, out = { ...(Number.isFinite(+c.saiu) && +c.saiu > 0 ? { saiu: Math.round(+c.saiu) } : {}), n, c: int(c.c, 0, 9e15, Date.now()), cofre: int(c.cofre, 0, 1e9, 0), sem: int(c.sem, 0, 9e15, 0), m: [], log: [] };
  for (const m of Array.isArray(c.m) ? c.m.slice(0, CLA.max) : []) {
    if (!m || typeof m.id !== 'string' || !/^rc[a-z0-9]{4,16}$/.test(m.id) || out.m.some((o) => o.id === m.id)) continue;
    const g = m.g === 'm' ? 'm' : 'f', ap = m.ap && typeof m.ap === 'object' ? m.ap : {};
    out.m.push({ id: m.id, nome: nomeValido(m.nome) || 'Recruta', g, tier: CLA.tiers.some((T) => T.id === m.tier) ? m.tier : 'recruta',
      ap: { cabelo: cor(ap.cabelo), olhos: cor(ap.olhos), pele: cor(ap.pele), roupa: cor(ap.roupa), calca: cor(ap.calca),
        altura: Math.max(CLA.altura[0], Math.min(CLA.altura[1], +ap.altura || 1)), penteado: P[g].includes(ap.penteado) ? ap.penteado : null },
      jeito: CLA.jeitos.includes(m.jeito) ? m.jeito : CLA.jeitos[0], gosto: CLA.gostos.includes(m.gosto) ? m.gosto : 'cacar',
      nv0: int(m.nv0, 1, 200, 1), nv: int(m.nv, 1, 200, 1), desde: int(m.desde, 0, 9e15, 0), ...(Number.isFinite(+m.dev) && +m.dev > 0 ? { dev: Math.round(+m.dev) } : {}), ...(funcaoValida(m.fn) ? { fn: funcaoValida(m.fn) } : {}) });
  }
  for (const L of Array.isArray(c.log) ? c.log.slice(-CLA.log) : []) if (L && typeof L.txt === 'string') out.log.push({ t: int(L.t, 0, 9e15, 0), txt: L.txt.slice(0, 80), v: int(L.v, -1e9, 1e9, 0) });
  return out;
}
export function nomeCla(n) {
  if (typeof n !== 'string') return null;
  const s = n.normalize('NFC').replace(/\s+/g, ' ').trim();
  return s.length >= CLA.nome.min && s.length <= CLA.nome.max && /^[\p{L}\p{N} '-]+$/u.test(s) ? s : null;
}
// nível que o recruta do tier T teria para um líder no nível nv
export function nivelTier(T, nv) { return T.nivel === 'igual' ? Math.max(1, nv | 0) : T.nivel === 'metade' ? Math.max(1, Math.floor((nv | 0) / 2)) : 1; }
export const precoTier = (T, nvR) => T.preco + T.porNivel * nvR;
export const semanaDe = (T, nvR) => T.semana + T.semanaNivel * nvR;
const tierDe = (id) => CLA.tiers.find((T) => T.id === id) || CLA.tiers[0];
// a semana do clã inteiro: a soma de cada um, +10% por recruta depois do 3º
export function semanaCla(c) {
  const fator = 1 + Math.max(0, c.m.length - CLA.extra.de) * CLA.extra.por; // igual à cobrança (cada um arredondado)
  return c.m.reduce((s, m) => s + Math.round(semanaDe(tierDe(m.tier), m.nv) * fator), 0);
}
// recruta sorteado (rnd: () => 0..1)
export function sortearRecruta(rnd, T, nvLider, agora) {
  const g = rnd() < 0.5 ? 'f' : 'm', C = CLA.cores, nv = nivelTier(T, nvLider);
  let id = 'rc'; for (let i = 0; i < 10; i++) id += 'abcdefghijklmnopqrstuvwxyz0123456789'[Math.floor(rnd() * 36)];
  return { id, nome: `${sorteia(CLA.nomes[g], rnd)} ${sorteia(CLA.sobrenomes, rnd)}`, g, tier: T.id,
    ap: { cabelo: sorteia(C.cabelo, rnd), olhos: sorteia(C.olhos, rnd), pele: sorteia(C.pele, rnd), roupa: sorteia(C.roupa, rnd), calca: sorteia(C.calca, rnd),
      altura: +(CLA.altura[0] + rnd() * (CLA.altura[1] - CLA.altura[0])).toFixed(2), penteado: sorteia(CLA.penteados[g], rnd) },
    jeito: sorteia(CLA.jeitos, rnd), gosto: sorteia(CLA.gostos, rnd), nv0: nv, nv, desde: agora };
}

export const Cla = {
  temCla(j) { return !!j && !j.bot && !!j.conta && !!j.prog?.cla; },
  pertoRecrutador(j) { return (this.mapa.npcs || []).some((n) => n.funcao === 'recrutador' && Math.hypot(n.x - j.x, n.z - j.z) < CLA.perto); },
  logCla(c, txt, v = 0) { c.log.push({ t: Date.now(), txt, v }); if (c.log.length > CLA.log) c.log.splice(0, c.log.length - CLA.log); },
  // o contexto (NPC) de cada recruta deste líder que está no mundo
  recrutasNoMundo(j) { return (this.amigosIa || []).filter((x) => x.AMIGA.recruta && !x.AMIGA.clanpc && x.AMIGA.lider === j.conta); },
  // o que o app desenha (vai junto do progresso: "cl")
  claInfo(j) {
    if (!j || j.bot || !j.conta) return null;
    const c = j.prog.cla; if (!c) return { sem: 1 };
    const vivos = new Map(this.recrutasNoMundo(j).filter((x) => x.amiga).map((x) => [x.AMIGA.id, x.amiga]));
    const rec = {};
    for (const a of vivos.values()) for (const it of a.prog.mochila || []) if (it && CLA.recursos.includes(it.k)) rec[it.k] = (rec[it.k] | 0) + (it.n | 0);
    const nv = j.prog.nivel | 0;
    // status de cada um (André 2026-11-22: "eu consigo ver nível Hp mana e vigor"): vida, mana e vigor (0 a 100)
    const st = (o, prog) => ({ hp: Math.round(o.vida) | 0, hpM: Math.round(o.vidaMax) | 0, mp: Math.round(o.mana) | 0, mpM: Math.round(o.manaMax) | 0, vg: Math.floor(vigorDe(prog.vigor)), vgM: VIGOR.max, morto: o.morto ? 1 : 0 });
    return { n: c.n, cofre: c.cofre, semana: semanaCla(c), prox: Math.max(0, c.sem - Date.now()), max: CLA.max, perto: this.pertoRecrutador(j),
      eu: { nome: j.nome, nv, ...st(j, j.prog) },
      m: c.m.map((m) => { const a = vivos.get(m.id); return { id: m.id, nome: m.nome, tier: tierDe(m.tier).nome, nv: a ? a.prog.nivel | 0 : m.nv, sem: semanaDe(tierDe(m.tier), a ? a.prog.nivel | 0 : m.nv), on: a ? 1 : 0, ...(m.dev ? { dev: m.dev } : {}), g: m.g,
        fn: m.fn || { k: 'livre' }, ...(a ? { ...st(a, a.prog), fz: this.fazendoRecruta(a, j) } : {}) }; }),
      funcoes: CLA.funcoes, recursos: Object.entries(ENCOMENDA.recursos).map(([k, R]) => ({ k, nome: R.nome })),
      tiers: CLA.tiers.map((T) => { const n2 = nivelTier(T, nv); return { id: T.id, nome: T.nome, nv: n2, preco: precoTier(T, n2), sem: semanaDe(T, n2) }; }),
      rec, log: c.log.slice(-10).reverse(), dep: CLA.deposito, clas: this.clasNpcInfo(j) };
  },
  // pedido do app: { acao: 'fundar' | 'recrutar' | 'dispensar' | 'depositar' | 'sacar' | 'ver' | 'funcao', nome, tier, id, ouro, fn }
  cla(id, m) {
    const j = this.jogadores.get(id); if (!j || j.bot || !j.conta || !m) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    const c = j.prog.cla, agora = Date.now();
    if (m.acao === 'fundar') {
      if (c) return aviso(`Você já lidera o clã ${c.n}`);
      const n = nomeCla(m.nome); if (!n) return aviso(`Nome do clã: de ${CLA.nome.min} a ${CLA.nome.max} letras`);
      j.prog.cla = { n, c: agora, cofre: 0, sem: agora + CLA.semana, m: [], log: [] };
      this.logCla(j.prog.cla, `Clã ${n} fundado`);
      aviso(`Clã ${n} fundado! Você é o líder. Fale com o Recrutador para contratar soldados.`);
      return this.avisarProg(j);
    }
    if (!c) return aviso('Funde o seu clã primeiro');
    this.cobrarCla(j);
    if (m.acao === 'recrutar') {
      const T = CLA.tiers.find((x) => x.id === m.tier); if (!T) return;
      if (!this.pertoRecrutador(j)) return aviso('Fale com o Recrutador (Clareira ou Juncal)');
      if (c.m.length >= CLA.max) return aviso(`O clã já tem ${CLA.max} recrutas (o máximo por enquanto)`);
      const r = sortearRecruta(Math.random, T, j.prog.nivel, agora), preco = precoTier(T, r.nv);
      if ((j.prog.ouro | 0) < preco) return aviso(`Falta ouro: ${T.nome} custa ${preco}`);
      j.prog.ouro -= preco;
      c.m.push(r);
      this.logCla(c, `Contratou ${r.nome} (${T.nome} Nv ${r.nv})`, -preco);
      aviso(`${r.nome} entrou no clã! ${T.nome} Nv ${r.nv}. Semana: ${semanaDe(T, r.nv)} de ouro`);
      this.entrarRecrutas(j);
      return this.avisarProg(j);
    }
    if (m.acao === 'dispensar') {
      const i = c.m.findIndex((o) => o.id === m.id); if (i < 0) return;
      const [r] = c.m.splice(i, 1);
      this.tirarRecruta(r.id, j);
      this.logCla(c, `Dispensou ${r.nome}`);
      aviso(`${r.nome} saiu do clã`);
      return this.avisarProg(j);
    }
    if (m.acao === 'depositar' || m.acao === 'sacar') {
      const v = Math.floor(+m.ouro); if (!Number.isFinite(v) || v <= 0) return;
      const dep = m.acao === 'depositar', q = Math.min(v, dep ? j.prog.ouro | 0 : c.cofre);
      if (q <= 0) return aviso(dep ? 'Sem ouro na bolsa' : 'O cofre está vazio');
      if (dep) { j.prog.ouro -= q; c.cofre += q; } else { c.cofre -= q; j.prog.ouro += q; }
      this.logCla(c, dep ? 'Depósito no cofre' : 'Saque do cofre', dep ? q : -q);
      this.pagarDevendo(j);
      return this.avisarProg(j);
    }
    if (m.acao === 'funcao') {
      const r = c.m.find((o) => o.id === m.id); if (!r) return;
      const fn = funcaoValida(m.fn);
      if (fn?.k === 'proteger' && fn.p !== 'lider' && (fn.p === r.id || !c.m.some((o) => o.id === fn.p))) return aviso('Escolha você ou outro membro do clã');
      if (fn) r.fn = fn; else delete r.fn;
      j.progSujo = true;
      const x = this.recrutasNoMundo(j).find((o) => o.AMIGA.id === r.id);
      if (x?.amiga) this.aplicarFuncao(j, x, r, true);
      const F = CLA.funcoes.find((o) => o.id === (fn?.k || 'livre'));
      aviso(`${r.nome}: ${F.nome}${fn?.k === 'recurso' ? ` (${ENCOMENDA.recursos[fn.r].nome})` : fn?.k === 'proteger' ? ` ${fn.p === 'lider' ? 'você' : c.m.find((o) => o.id === fn.p).nome}` : ''}`);
      return this.avisarProg(j);
    }
    if (m.acao === 'ver') return this.avisarProg(j);
  },
  // ---------- funções (André 2026-11-22) ----------
  // o que ele está fazendo agora (linha curta no painel)
  fazendoRecruta(a, j) {
    const ia = a.ia;
    if (a.morto) return 'Caído';
    if (ia.funcaoSt && ia.funcaoSt.ate > this.tempo) return ia.funcaoSt.txt;
    if (a.time && a.time === j.time) return 'No seu time';
    if (ia.funcao?.k === 'proteger') return 'Protegendo';
    if (ia.encomenda && !ia.encomenda.pronta) return `Coletando ${ENCOMENDA.recursos[ia.encomenda.rec]?.nome || ''}`.trim();
    if (ia.av) return ia.av.fase === 'voltar' ? 'Voltando' : ia.av.coleta ? 'Coletando' : 'Caçando';
    return 'Parado';
  },
  // aplica a função de cada recruta no mundo (a cada minuto e ao entrar)
  aplicarFuncoes(j) {
    const c = j?.prog?.cla; if (!c) return;
    for (const x of this.recrutasNoMundo(j)) { const m = x.amiga && c.m.find((o) => o.id === x.AMIGA.id); if (m) this.aplicarFuncao(j, x, m, false); }
  },
  // novo = acabou de trocar no painel: larga o que fazia antes
  aplicarFuncao(j, x, m, novo) {
    const a = x.amiga, ia = a.ia, fn = m.fn || { k: 'livre' }, noTime = !!(a.time && a.time === j.time);
    const avisa = (txt) => { ia.funcaoSt = { txt, ate: this.tempo + 90 }; };
    ia.funcao = fn.k === 'proteger' ? fn : null;
    if (novo) {
      ia.funcaoSt = null;
      if (fn.k !== 'seguir' && noTime) x.sairTimeAmiga(j.id);
      if (a.coleta) this.pararColeta(a, null); if (a.pesca) this.pararPesca(a, null);
      if (ia.atividade) x.fimAtividadeAmiga(a, true);
      if (ia.encomenda && !ia.encomenda.pronta) ia.encomenda = null;
      ia.av = null; ia.viagem = null; ia.vir = null; ia.fase = 'pensar';
    }
    if (a.morto) return;
    if (fn.k === 'seguir') {
      if (a.time === j.time && a.time) return;
      if (a.time) this.sairDoTime(a, `${x.AMIGA.nome} saiu do time`);
      if (!x.entrarTimeAmiga(a, j)) avisa('Time cheio');
      return;
    }
    if (a.time && a.time === j.time) return; // você pôs no time pela conversa: fica até tirar
    if (fn.k === 'grind') {
      if (ia.av && !ia.av.encomenda && ia.av.fase !== 'voltar') return;
      const v = x.sairCacarAmiga(a, j);
      if (!v.ok && !v.ja) avisa(v.fala ? v.fala[0].toUpperCase() + v.fala.slice(1) : 'Não consegue sair agora');
      return;
    }
    if (fn.k === 'recurso') {
      const R = ENCOMENDA.recursos[fn.r]; if (!R) return;
      if (ia.encomenda && !ia.encomenda.pronta && ia.av?.encomenda) return;
      if (ia.encomenda?.pronta) ia.encomenda = null; // o que juntou fica na bolsa dele (recursos do clã)
      const verbo = R.coleta === 'pescar' ? 'pesca' : R.coleta === 'lenha' ? 'corta' : 'minera';
      const fala = x.encomendaAmiga(a, j, `${verbo} ${CLA.farmar} ${R.palavras[0]} pra mim`);
      if (!(ia.encomenda && !ia.encomenda.pronta)) avisa(String(fala || 'Não dá agora').replace(/^[^:]*: /, '').slice(0, 60));
    }
  },
  // a semana: cobra cada semana vencida do cofre; sem dinheiro, o recruta fica devendo; 7 dias devendo, vai embora
  cobrarCla(j) {
    const c = j?.prog?.cla; if (!c) return;
    const agora = Date.now();
    for (const x of this.recrutasNoMundo(j)) { const m = x.amiga && c.m.find((o) => o.id === x.AMIGA.id); if (m) m.nv = x.amiga.prog.nivel | 0; }
    let mudou = false;
    for (let k = 0; c.sem <= agora && k < 60; k++) {
      c.sem += CLA.semana; mudou = true;
      if (!c.m.length) continue;
      const fator = 1 + Math.max(0, c.m.length - CLA.extra.de) * CLA.extra.por;
      for (const m of c.m) {
        const v = Math.round(semanaDe(tierDe(m.tier), m.nv) * fator);
        if (c.cofre >= v) { c.cofre -= v; this.logCla(c, `Semana de ${m.nome}`, -v); if (m.dev) delete m.dev; }
        else if (!m.dev) { m.dev = c.sem - CLA.semana; this.logCla(c, `${m.nome} sem pagamento`); }
      }
    }
    for (const m of [...c.m]) if (m.dev && agora - m.dev >= CLA.calote) {
      c.m.splice(c.m.indexOf(m), 1); this.tirarRecruta(m.id, j); mudou = true;
      this.logCla(c, `${m.nome} foi embora sem pagamento`);
      this.evento({ t: 'aviso', para: j.id, texto: `${m.nome} foi embora do clã: 7 dias sem pagamento` });
    }
    if (mudou) j.progSujo = true;
    this.aplicarFuncoes(j);
  },
  // depósito novo: paga quem estava devendo (a semana inteira dele)
  pagarDevendo(j) {
    const c = j.prog.cla, fator = 1 + Math.max(0, c.m.length - CLA.extra.de) * CLA.extra.por;
    for (const m of c.m) {
      if (!m.dev) continue;
      const v = Math.round(semanaDe(tierDe(m.tier), m.nv) * fator); if (c.cofre < v) continue;
      c.cofre -= v; delete m.dev; this.logCla(c, `Semana atrasada de ${m.nome}`, -v);
    }
  },
  // o líder entrou (ou contratou): os recrutas dele ganham corpo perto dele
  entrarRecrutas(j) {
    const c = j?.prog?.cla; if (!c || !j.conta) return;
    for (const m of c.m) {
      if (this.amigosIa.some((x) => x.AMIGA.id === m.id)) continue;
      if (this.lerNpc && !this.npcSalvos?.has(m.id)) this.carregarNpc(m.id, this.lerNpc(m.id));
      const ctx = contextoDeAmigo(this, defRecruta(m, j.conta, c.n, this.racaDe(j)));
      this.amigosIa.push(ctx);
      ctx.amigaEntrar(j.id, true);
      const a = ctx.amiga; if (!a) continue;
      a.amigosDe[j.conta] = 1; // soldado do clã: já é amigo do líder (todos os comandos valem)
      if ((a.amizade | 0) < 60) a.amizade = 60;
      const ang = Math.random() * Math.PI * 2, x = j.x + Math.sin(ang) * 2.5, z = j.z + Math.cos(ang) * 2.5;
      Object.assign(a, { x, z, y: this.terreno.altura(x, z), chao: true });
    }
    this.foraRecrutas(j);
    this.aplicarFuncoes(j); // a função que ficou escolhida no painel
  },
  // o tempo que o líder ficou fora: cada recruta entrega o que a função dele daria (CLA.fora)
  foraRecrutas(j) {
    const c = j.prog.cla, F = CLA.fora; if (!c?.saiu) return;
    const ms = Math.min(F.max, Date.now() - c.saiu); delete c.saiu; j.progSujo = true;
    if (!(ms >= F.minimo)) return;
    const h = ms / 3600e3, feitos = [];
    for (const x of this.recrutasNoMundo(j)) {
      const a = x.amiga, m = a && c.m.find((o) => o.id === x.AMIGA.id); if (!m?.fn || m.dev) continue; // devendo não trabalha
      if (m.fn.k === 'grind') {
        const teto = Math.max(1, j.prog.nivel | 0), antes = a.prog.nivel | 0; if (antes >= teto) continue;
        let n = F.nivelHora * h, xp = 0, nv = antes, resto = a.prog.xp | 0;
        while (n > 0 && nv < teto) { const prox = xpProximo(nv), falta = prox - resto, q = Math.min(n, falta / prox); xp += Math.round(q * prox); n -= q; resto = 0; nv++; }
        if (xp > 0) { this.ganharXP(a, xp); if ((a.prog.nivel | 0) > teto) a.prog.nivel = teto; m.nv = a.prog.nivel | 0; feitos.push(`${m.nome} caçou e foi do Nv ${antes} ao ${a.prog.nivel}`); }
      } else if (m.fn.k === 'recurso') {
        const R = ENCOMENDA.recursos[m.fn.r]; if (!R) continue;
        const C = R.no && COLETA[R.no], item = R.item === 'peixe' ? F.peixe : R.item;
        const custo = C ? C.vigor / (C.da[R.item] || 1) : 1; // vigor por unidade
        const vg = vigorDe(a.prog.vigor) + (h * 3600 / VIGOR.enche) * VIGOR.max; // o que tinha + o que encheu fora
        let n = Math.floor(vg / custo), dado = 0;
        for (let passo = 50; n > 0 && passo >= 1; passo = Math.floor(passo / 2)) while (n >= passo && guardar(a.prog.mochila, { k: item, n: passo })) { n -= passo; dado += passo; }
        a.prog.vigor = { v: Math.max(0, Math.min(VIGOR.max, vg - dado * custo)), t: Date.now() };
        if (dado) feitos.push(`${m.nome} juntou ${dado} de ${R.nome}`); else feitos.push(`${m.nome} não juntou nada (bolsa cheia)`);
      }
      x.guardarAmiga?.();
    }
    if (!feitos.length) return;
    const horas = h >= 1 ? `${Math.floor(h)} h` : `${Math.round(h * 60)} min`;
    for (const f of feitos) this.logCla(c, `Fora (${horas}): ${f}`);
    this.evento({ t: 'aviso', para: j.id, texto: `Enquanto você esteve fora (${horas}): ${feitos.join('; ')}` });
  },
  // tira o corpo de um recruta (dispensado ou foi embora)
  tirarRecruta(rid, j) {
    const i = this.amigosIa.findIndex((x) => x.AMIGA.id === rid); if (i < 0) return;
    const ctx = this.amigosIa[i];
    if (ctx.amiga && ctx.AMIGA.clanpc) { ctx.guardarAmiga(); if (ctx.amiga.time) this.sairDoTime(ctx.amiga, `${ctx.AMIGA.nome} saiu do jogo`); this.jogadores.delete(ctx.amiga.id); ctx.amiga = null; ctx.amigaDono = null; }
    else if (ctx.amiga) ctx.amigaSair(j?.id, true);
    this.amigosIa.splice(i, 1);
  },
  // o líder saiu: os recrutas dele guardam tudo e saem junto
  sairRecrutas(j) {
    if (j?.prog?.cla) { j.prog.cla.saiu = Date.now(); j.progSujo = true; } // a conta do tempo fora (foraRecrutas)
    for (const ctx of this.recrutasNoMundo(j)) ctx.amigaSair(j.id, true);
    this.amigosIa = this.amigosIa.filter((x) => !(x.AMIGA.recruta && !x.AMIGA.clanpc && x.AMIGA.lider === j.conta));
  },

  // ---------- clãs bot (André 2026-11-22: Kira, Rufo, Lis e Gael são o clã inimigo; nada de gente solta) ----------
  // estado: this.clasNpc = { [id]: { m: [membros sorteados como os do jogador], prox: ms (próxima contratação), sem: ms } }
  carregarClasNpc(est) {
    this.clasNpc = {};
    for (const C of CLAS_NPC) {
      const e = est?.[C.id], v = claValido({ n: C.n, m: Array.isArray(e?.m) ? e.m : [], sem: e?.sem, cofre: 0 });
      this.clasNpc[C.id] = { m: v?.m.slice(0, vagasClaNpc(C)) || [], prox: Number.isFinite(+e?.prox) ? +e.prox : Date.now() + CLAS_NPC_REGRAS.primeiro * 3600e3, sem: v?.sem || Date.now() + CLA.semana };
    }
    for (const C of CLAS_NPC) for (const m of this.clasNpc[C.id].m) this.criarRecrutaNpc(C, m, false);
  },
  salvarClasNpc() { if (this.aoClasNpc) this.aoClasNpc(this.clasNpc); },
  criarRecrutaNpc(C, m, entrar) {
    if (this.amigosIa.some((x) => x.AMIGA.id === m.id)) return null;
    if (this.lerNpc && !this.npcSalvos?.has(m.id)) this.carregarNpc(m.id, this.lerNpc(m.id));
    const ctx = contextoDeAmigo(this, defRecrutaNpc(m, C));
    this.amigosIa.push(ctx);
    if (entrar) { const o = [...this.jogadores.values()].find((x) => !x.bot); if (o) ctx.amigaEntrar(o.id, false); }
    return ctx;
  },
  liderNpc(C) { return this.amigosIa.find((x) => x.AMIGA.id === C.lider)?.amiga || null; },
  // a cada minuto (passo): o líder contrata quando pode e paga a semana
  passoClasNpc() {
    if (!this.clasNpc) this.carregarClasNpc(null);
    if (![...this.jogadores.values()].some((o) => !o.bot)) return; // sem ninguém no mundo, o líder não tem corpo
    const agora = Date.now(), R = CLAS_NPC_REGRAS;
    for (const C of CLAS_NPC) {
      const E = this.clasNpc[C.id], L = this.liderNpc(C); if (!L) continue;
      let mudou = false;
      for (const x of this.amigosIa) { const m = x.AMIGA.clanpc === C.id && x.amiga && E.m.find((o) => o.id === x.AMIGA.id); if (m && m.nv !== (x.amiga.prog.nivel | 0)) { m.nv = x.amiga.prog.nivel | 0; mudou = true; } }
      // a semana: sai do ouro do líder; sem ouro, o mais caro vai embora
      for (let k = 0; E.sem <= agora && k < 60; k++) {
        E.sem += CLA.semana; mudou = true;
        const fator = 1 + Math.max(0, E.m.length - CLA.extra.de) * CLA.extra.por;
        for (const m of [...E.m].sort((a, b) => semanaDe(tierDe(a.tier), a.nv) - semanaDe(tierDe(b.tier), b.nv))) {
          const v = Math.round(semanaDe(tierDe(m.tier), m.nv) * fator);
          if ((L.prog.ouro | 0) >= v) L.prog.ouro -= v; else { E.m.splice(E.m.indexOf(m), 1); this.tirarRecruta(m.id, null); }
        }
      }
      // liderança: contrata o melhor que o ouro paga (deixa a reserva)
      if (agora >= E.prox && E.m.length < vagasClaNpc(C)) {
        E.prox = agora + R.entre * 3600e3; mudou = true;
        const nv = L.prog.nivel | 0, livre = (L.prog.ouro | 0) - R.reserva;
        const T = [...CLA.tiers].reverse().find((T) => precoTier(T, nivelTier(T, nv)) <= livre);
        if (T) {
          const m = sortearRecruta(Math.random, T, nv, agora);
          L.prog.ouro -= precoTier(T, m.nv); E.m.push(m);
          this.criarRecrutaNpc(C, m, true);
          for (const o of this.jogadores.values()) if (!o.bot && this.racaDe(o) !== C.raca) this.evento({ t: 'aviso', para: o.id, texto: `${this.amigosIa.find((x) => x.AMIGA.id === C.lider)?.AMIGA.nome || 'O líder'} recrutou ${m.nome} para os ${C.n}` });
        }
      }
      if (mudou) this.salvarClasNpc();
    }
  },
  // os clãs bot que o app mostra no painel (o inimigo e o aliado)
  clasNpcInfo(j) {
    if (!this.clasNpc) this.carregarClasNpc(null);
    const nome = (id) => [...AMIGOS_VIRTUAIS, ...RIVAIS].find((d) => d.id === id)?.nome || id;
    // relação (André 2026-11-22): outra raça = inimigo; mesma raça = neutro (aliança fica para depois)
    return CLAS_NPC.map((C) => ({ n: C.n, lider: nome(C.lider), inimigo: this.racaDe(j) !== C.raca ? 1 : 0, raca: RACAS[C.raca]?.nome || C.raca, recrutas: C.membros.filter((id) => id !== C.lider).length + this.clasNpc[C.id].m.length, // os fixos contam (André 2026-11-22)
      membros: [...C.membros.filter((id) => id !== C.lider).map(nome), ...this.clasNpc[C.id].m.map((m) => `${m.nome} (${tierDe(m.tier).nome} Nv ${m.nv})`)] }));
  },
};

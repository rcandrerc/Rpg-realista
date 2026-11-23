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
import { CLA, ENCOMENDA, VIGOR, COLETA, PLANTAS, HORTA, ITENS, LOJA, fasePlanta, defRecruta, nomeValido, CLAS_NPC, CLAS_NPC_REGRAS, vagasClaNpc, almaDe, defRecrutaNpc, AMIGOS_VIRTUAIS, RIVAIS, RACAS } from './dados.js';
import { contextoDeAmigo } from './amiga.js';
import { guardar, guardarQueCabe, xpProximo, contar, tirar, organizar } from './progresso.js';
import { crescerPlanta } from './simulacao.js'; // só usadas em tempo de jogo (progresso.js também importa daqui)

const sorteia = (l, r) => l[Math.floor(r() * l.length)];
const int = (v, a, b, d) => (Number.isFinite(+v) ? Math.max(a, Math.min(b, Math.round(+v))) : d);
// vigor de agora (igual ao vigorAgora de progresso.js; aqui sem importar para não dar laço)
const vigorDe = (vg) => (vg ? Math.min(VIGOR.max, vg.v + (Math.max(0, Date.now() - vg.t) / 1000 / VIGOR.enche) * VIGOR.max) : VIGOR.max);
// função do recruta (painel): { k, r?: recurso, p?: 'lider' | id de outro recruta }
export function funcaoValida(fn) {
  if (!fn || typeof fn !== 'object' || !CLA.funcoes.some((F) => F.id === fn.k) || fn.k === 'livre') return null;
  if (fn.k === 'recurso') return Object.hasOwn(ENCOMENDA.recursos, fn.r) ? { k: 'recurso', r: fn.r } : null;
  if (fn.k === 'fazenda') return { k: 'fazenda', ...(PLANTAS[fn.s] ? { s: fn.s } : {}) };
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
  // nível do clã (vagas): clã de antes começa no nível que cabe quem ele já tem (nada some)
  out.nv = Math.max(int(c.nv, 1, CLA.max, 1), Math.min(CLA.max, out.m.length), 1);
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
    // o Baú do Clã (base no seu terreno): o que tem dentro
    const Lb = this.loteDaConta(j.conta), Bs = this.baseDe?.(j), temBau = !!Lb && (Lb.pecas.some((o) => o.k === 'bau_cla') || !!Bs), bau = {};
    if (temBau) for (const it of Lb.bauCla || []) if (it) bau[it.k] = (bau[it.k] | 0) + (it.n || 1);
    const nv = j.prog.nivel | 0;
    // status de cada um (André 2026-11-22: "eu consigo ver nível Hp mana e vigor"): vida, mana e vigor (0 a 100)
    const st = (o, prog) => ({ hp: Math.round(o.vida) | 0, hpM: Math.round(o.vidaMax) | 0, mp: Math.round(o.mana) | 0, mpM: Math.round(o.manaMax) | 0, vg: Math.floor(vigorDe(prog.vigor)), vgM: VIGOR.max, morto: o.morto ? 1 : 0 });
    return { n: c.n, cofre: c.cofre, semana: semanaCla(c), prox: Math.max(0, c.sem - Date.now()), max: c.nv || 1, nv: c.nv || 1, sobe: this.subirInfo(j), perto: this.pertoRecrutador(j),
      eu: { nome: j.nome, nv, ...st(j, j.prog) },
      m: c.m.map((m) => { const a = vivos.get(m.id); return { id: m.id, nome: m.nome, tier: tierDe(m.tier).nome, nv: a ? a.prog.nivel | 0 : m.nv, sem: semanaDe(tierDe(m.tier), a ? a.prog.nivel | 0 : m.nv), on: a ? 1 : 0, ...(m.dev ? { dev: m.dev } : {}), g: m.g,
        fn: m.fn || { k: 'livre' }, ...(a ? { ...st(a, a.prog), fz: this.fazendoRecruta(a, j) } : {}) }; }),
      bauCla: temBau ? bau : null, plantas: Object.entries(PLANTAS).map(([k, P]) => ({ k, nome: P.nome })),
      funcoes: CLA.funcoes, recursos: Object.entries(ENCOMENDA.recursos).map(([k, R]) => ({ k, nome: R.nome })),
      tiers: CLA.tiers.map((T) => { const n2 = nivelTier(T, nv); return { id: T.id, nome: T.nome, nv: n2, preco: precoTier(T, n2), sem: semanaDe(T, n2), claNv: T.claNv || 1 }; }),
      rec, log: c.log.slice(-10).reverse(), dep: CLA.deposito, clas: this.clasNpcInfo(j), base: this.baseInfo?.(j) || null,
      baseNiveis: CLA.base.niveis.slice(1).map((N, i) => ({ nv: i + 1, centro: N.centro, lotes: N.lotes, raio: N.raio, taxa: N.taxa, tem: N.tem })) };
  },
  // pedido do app: { acao: 'fundar' | 'recrutar' | 'dispensar' | 'depositar' | 'sacar' | 'ver' | 'funcao', nome, tier, id, ouro, fn }
  cla(id, m) {
    const j = this.jogadores.get(id); if (!j || j.bot || !j.conta || !m) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    const c = j.prog.cla, agora = Date.now();
    if (m.acao === 'fundar') {
      if (c) return aviso(`Você já lidera o clã ${c.n}`);
      const n = nomeCla(m.nome); if (!n) return aviso(`Nome do clã: de ${CLA.nome.min} a ${CLA.nome.max} letras`);
      j.prog.cla = { n, c: agora, cofre: 0, sem: agora + CLA.semana, m: [], log: [], nv: 1 };
      this.logCla(j.prog.cla, `Clã ${n} fundado`);
      aviso(`Clã ${n} fundado! Você é o líder. Fale com o Recrutador para contratar soldados.`);
      return this.avisarProg(j);
    }
    if (!c) return aviso('Funde o seu clã primeiro');
    this.cobrarCla(j);
    if (m.acao === 'recrutar') {
      const T = CLA.tiers.find((x) => x.id === m.tier); if (!T) return;
      if (!this.pertoRecrutador(j)) return aviso('Fale com o Recrutador (Clareira ou Juncal)');
      if (c.m.length >= (c.nv || 1)) return aviso(c.nv >= CLA.max ? `O clã já tem ${CLA.max} recrutas (o máximo)` : `Clã Nv ${c.nv}: ${c.nv} vaga${c.nv > 1 ? 's' : ''}. Melhore o clã para abrir outra`);
      if ((T.claNv || 1) > (c.nv || 1)) return aviso(`${T.nome} só no clã Nv ${T.claNv}`);
      const r = sortearRecruta(Math.random, T, j.prog.nivel, agora), preco = precoTier(T, r.nv);
      if ((j.prog.ouro | 0) < preco) return aviso(`Falta ouro: ${T.nome} custa ${preco}`);
      j.prog.ouro -= preco;
      c.m.push(r);
      this.logCla(c, `Contratou ${r.nome} (${T.nome} Nv ${r.nv})`, -preco);
      aviso(`${r.nome} entrou no clã! ${T.nome} Nv ${r.nv}. Semana: ${semanaDe(T, r.nv)} de ouro`);
      this.entrarRecrutas(j);
      this.baseDoClaMudou(j); // o próximo lote livre da base é dele (shared/base.js)
      return this.avisarProg(j);
    }
    if (m.acao === 'dispensar') {
      const i = c.m.findIndex((o) => o.id === m.id); if (i < 0) return;
      const [r] = c.m.splice(i, 1);
      this.tirarRecruta(r.id, j);
      this.logCla(c, `Dispensou ${r.nome}`);
      aviso(`${r.nome} saiu do clã`);
      this.baseDoClaMudou(j);
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
      aviso(`${r.nome}: ${F.nome}${fn?.k === 'fazenda' ? (fn.s ? ` (plantar ${PLANTAS[fn.s].nome.toLowerCase()})` : ' (só colhe e rega)') : fn?.k === 'recurso' ? ` (${ENCOMENDA.recursos[fn.r].nome})` : fn?.k === 'proteger' ? ` ${fn.p === 'lider' ? 'você' : c.m.find((o) => o.id === fn.p).nome}` : ''}`);
      return this.avisarProg(j);
    }
    if (m.acao === 'melhorar') {
      const r = this.subirCla({ nv: c.nv || 1, nvLider: j.prog.nivel | 0, raca: this.racaDe(j), ouro: c.cofre, fontes: [this.bauDoCla({ conta: j.conta })?.itens, j.prog.mochila].filter(Boolean) });
      if (r.falta) return aviso(r.falta);
      c.cofre -= r.N.ouro; r.tirar();
      const B = this.bauDoCla({ conta: j.conta }); if (B) this.mexeuBau(B);
      c.nv = r.N.nv; j.progSujo = true;
      this.logCla(c, `Clã subiu para o Nv ${c.nv}`, -r.N.ouro);
      aviso(`Clã ${c.n} agora é Nv ${c.nv}: ${c.nv} vagas!`);
      this.baseDoClaMudou(j); // a base cresce junto (shared/base.js)
      return this.avisarProg(j);
    }
    if (m.acao === 'base') return this.fundarBase(j, aviso, m.x != null ? { x: m.x, z: m.z } : null); // funda a base do clã onde o líder está (shared/base.js)
    if (m.acao === 'mudarBase') return this.moverBase(j, aviso, m.x != null ? { x: m.x, z: m.z } : null); // realocar (shared/base.js)
    if (m.acao === 'baseVer') return this.verLugarBase(j, m.x != null ? { x: m.x, z: m.z, mudar: !!m.mudar } : null); // a prévia da base (André 2026-11-22: "pode escolher exatamente onde")
    if (m.acao === 'missao') { const r = this.iniciarMissaoCla(j, aviso, this.baseDe?.(j), this.recrutasNoMundo(j)); if (r) this.avisarProg(j); return; } // Escolta do Clã (shared/missao-cla.js)
    if (m.acao === 'ver') return this.avisarProg(j);
  },
  // ---------- nível do clã (André 2026-11-22) ----------
  // o bônus do nível do clã para quem está nele (líder, recruta, fixo ou líder de clã bot): +2% por nível acima do 1
  nivelClaDe(j) {
    if (!j) return 0;
    if (!j.bot) return j.prog?.cla?.nv || 0;
    const x = this.amigoIaDe?.(j); if (!x) return 0;
    if (x.AMIGA.recruta && !x.AMIGA.clanpc) return [...this.jogadores.values()].find((o) => !o.bot && o.conta === x.AMIGA.lider)?.prog?.cla?.nv || 0;
    const C = x.AMIGA.clanpc ? CLAS_NPC.find((o) => o.id === x.AMIGA.clanpc) : CLAS_NPC.find((o) => o.membros.includes(x.AMIGA.id));
    return (C && this.clasNpc?.[C.id]?.nv) || 0;
  },
  bonusCla(j) { return Math.max(0, this.nivelClaDe(j) - 1) * CLA.bonusNivel; },
  // confere o próximo nível: { N, falta: texto | null, tirar(): tira os materiais e as almas das fontes }
  subirCla({ nv, nvLider, raca, ouro, fontes }) {
    const N = CLA.niveis[nv + 1]; if (!N) return { falta: 'O clã já está no nível máximo' };
    const alma = almaDe(raca), precisa = { ...N.mat, [alma]: N.alma }, tem = (k) => fontes.reduce((s, f) => s + contar(f, k), 0);
    const falta = [];
    if (nvLider < N.lider) falta.push(`líder Nv ${N.lider}`);
    if (ouro < N.ouro) falta.push(`${N.ouro - ouro} de ouro no cofre`);
    for (const [k, n] of Object.entries(precisa)) if (tem(k) < n) falta.push(`${n - tem(k)} ${ITENS[k]?.nome.toLowerCase() || k}`);
    return { N, falta: falta.length ? `Para o clã Nv ${N.nv} falta: ${falta.join(', ')}` : null,
      tirar: () => { for (const [k, n0] of Object.entries(precisa)) { let n = n0; for (const f of fontes) { const q = Math.min(n, contar(f, k)); if (q) { tirar(f, k, q); n -= q; } } } } };
  },
  // o que o painel mostra do próximo nível: pede e tem
  subirInfo(j) {
    const c = j.prog.cla, N = CLA.niveis[(c?.nv || 1) + 1]; if (!N) return null;
    const alma = almaDe(this.racaDe(j)), fontes = [this.bauDoCla({ conta: j.conta })?.itens, j.prog.mochila].filter(Boolean), tem = (k) => fontes.reduce((s, f) => s + contar(f, k), 0);
    const itens = Object.entries({ ...N.mat, [alma]: N.alma }).map(([k, n]) => ({ k, nome: ITENS[k]?.nome || k, n, tem: tem(k) }));
    return { nv: N.nv, lider: N.lider, ouro: N.ouro, itens };
  },
  // derrubou alguém da outra raça (guerra.js morteGuerra): 1 Fragmento de Alma da raça de quem caiu. Jogador: na mochila;
  // recruta de jogador: no Baú do Clã do líder; bot de clã (líder, fixo ou recruta): no Baú do Clã do clã bot
  fragmentoGuerra(c, k) {
    if (!c || !k || c === k) return;
    const rc = this.racaDe(c), rk = this.racaDe(k); if (!rc || !rk || rc === rk) return;
    const item = { k: 'alma_' + rc, n: 1 };
    if (!k.bot) { if (guardarQueCabe(k.prog.mochila, item)) { this.evento({ t: 'aviso', para: k.id, texto: `+1 ${ITENS[item.k].nome}` }); k.progSujo = true; this.avisarProg(k); } return; }
    const x = this.amigoIaDe(k); if (!x) return;
    let K = null;
    if (x.AMIGA.recruta) K = this.claDoRecruta(x);
    else { const C = CLAS_NPC.find((o) => o.membros.includes(x.AMIGA.id)); if (C) K = { bot: true, C, E: this.clasNpc?.[C.id], conta: this.amigosIa.find((o) => o.AMIGA.id === C.lider)?.AMIGA.conta }; }
    const B = this.bauDoCla(K); if (B && guardarQueCabe(B.itens, item)) this.mexeuBau(B);
  },
  // ---------- funções (André 2026-11-22) ----------
  // o que ele está fazendo agora (linha curta no painel)
  fazendoRecruta(a, j) {
    const ia = a.ia;
    if (a.morto) return 'Caído';
    if (ia.funcaoSt && ia.funcaoSt.ate > this.tempo) return ia.funcaoSt.txt;
    if (a.time && a.time === j.time) return 'No seu time';
    if (ia.funcao?.k === 'proteger') return 'Protegendo';
    if (ia.funcao?.k === 'fazenda') return 'Na fazenda';
    if (ia.encomenda && !ia.encomenda.pronta) return `Coletando ${ENCOMENDA.recursos[ia.encomenda.rec]?.nome || ''}`.trim();
    if (ia.av) return ia.av.fase === 'voltar' ? 'Voltando' : ia.av.coleta ? 'Coletando' : 'Caçando';
    return 'Parado';
  },
  // aplica a função de cada recruta no mundo (a cada minuto e ao entrar)
  aplicarFuncoes(j) {
    const c = j?.prog?.cla; if (!c) return;
    for (const x of this.recrutasNoMundo(j)) { const m = x.amiga && c.m.find((o) => o.id === x.AMIGA.id); if (m) this.aplicarFuncao(j, x, m, false); }
  },
  // novo = acabou de trocar no painel: larga o que fazia antes. j = o corpo do líder (jogador ou líder bot: tudo igual,
  // André 2026-11-22: "vai funcionar com todos os clãs")
  aplicarFuncao(j, x, m, novo) {
    const a = x.amiga, ia = a.ia, fn = m.fn || { k: 'livre' }, noTime = !!(a.time && a.time === j.time);
    const avisa = (txt) => { ia.funcaoSt = { txt, ate: this.tempo + 90 }; };
    ia.funcao = fn.k === 'proteger' || fn.k === 'fazenda' ? fn : null;
    if (novo) {
      ia.funcaoSt = null; ia.faz = null;
      if (fn.k !== 'seguir' && noTime && !j.bot) x.sairTimeAmiga(j.id);
      if (a.coleta) this.pararColeta(a, null); if (a.pesca) this.pararPesca(a, null);
      if (ia.atividade) x.fimAtividadeAmiga(a, true);
      if (ia.encomenda && !ia.encomenda.pronta) ia.encomenda = null;
      ia.av = null; ia.viagem = null; ia.vir = null; ia.fase = 'pensar';
    }
    this.depositarRecruta(x); // o que juntou (farm, fazenda) vai para o Baú do Clã
    if (a.morto) return;
    if (fn.k === 'seguir') {
      if (j.bot) { ia.funcao = { k: 'proteger', p: 'lider' }; return; } // líder bot: "me seguir" = andar junto e proteger
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
      if (ia.encomenda?.pronta) ia.encomenda = null; // o que juntou já foi para o baú (ou fica na bolsa dele)
      const verbo = R.coleta === 'pescar' ? 'pesca' : R.coleta === 'lenha' ? 'corta' : 'minera';
      const fala = x.encomendaAmiga(a, j, `${verbo} ${CLA.farmar} ${R.palavras[0]} pra mim`);
      if (!(ia.encomenda && !ia.encomenda.pronta)) avisa(String(fala || 'Não dá agora').replace(/^[^:]*: /, '').slice(0, 60));
    }
  },
  // ---------- base do clã: o terreno do líder e o Baú do Clã (André 2026-11-22) ----------
  // o clã de um recruta (jogador ou bot): quem lidera, a conta (dono do terreno), a lista de membros e o cofre
  claDoRecruta(x) {
    const A = x.AMIGA;
    if (A.clanpc) {
      const C = CLAS_NPC.find((o) => o.id === A.clanpc); if (!C) return null;
      const L = this.amigosIa.find((o) => o.AMIGA.id === C.lider);
      return { bot: true, C, corpo: L?.amiga || null, conta: L?.AMIGA.conta, m: this.clasNpc?.[C.id]?.m || [], E: this.clasNpc?.[C.id] };
    }
    const j = [...this.jogadores.values()].find((o) => !o.bot && o.conta === A.lider);
    return { bot: false, corpo: j || null, conta: A.lider, m: j?.prog?.cla?.m || [], c: j?.prog?.cla };
  },
  corpoLiderDe(x) { return this.claDoRecruta(x)?.corpo || null; },
  loteDaConta(conta) { if (conta == null) return null; for (const L of this.lotes.values()) if (L.dono === conta) return L; return null; },
  // o Baú do Clã: o do terreno do líder (peça bau_cla); clã bot ganha o dele sozinho (guardado no estado do clã)
  bauDoCla(K) {
    if (!K) return null;
    const L = this.loteDaConta(K.conta);
    if (L && (L.pecas.some((o) => o.k === 'bau_cla') || this.basesCla?.['j' + String(K.conta).replace(/[^\w]/g, '').slice(0, 30)])) { // a peça ou o baú do salão da base
      if (!Array.isArray(L.bauCla)) L.bauCla = Array(CLA.bauCla).fill(null); return { itens: L.bauCla, L }; }
    if (K.bot && K.E) { if (!Array.isArray(K.E.bau)) K.E.bau = Array(CLA.bauCla).fill(null); return { itens: K.E.bau, E: K.E }; }
    return null;
  },
  mexeuBau(B) { if (B?.L) this.lotesMudados.add(B.L.def.id); else if (B?.E) this.salvarClasNpc(); },
  // o recruta deixa no Baú do Clã os recursos e a colheita que carrega (encomenda pronta ou fazenda)
  depositarRecruta(x) {
    const a = x.amiga; if (!a) return 0;
    const ia = a.ia; if (ia.encomenda && !ia.encomenda.pronta) return 0; // ainda coletando
    const B = this.bauDoCla(this.claDoRecruta(x)); if (!B) return 0;
    let n = 0;
    for (let i = 0; i < a.prog.mochila.length; i++) {
      const o = a.prog.mochila[i]; if (!o || o.h || !(CLA.recursos.includes(o.k) || PLANTAS[o.k] || o.k === CLA.fora.peixe || ITENS[o.k]?.peixe || o.k === 'couro' || o.k.startsWith('alma_'))) continue;
      const q = guardarQueCabe(B.itens, { ...o }); if (!q) continue;
      n += q; if (q >= (o.n || 1)) a.prog.mochila[i] = null; else o.n -= q;
    }
    if (n) { if (ia.encomenda?.pronta) ia.encomenda = null; this.mexeuBau(B); x.guardarAmiga?.(); }
    return n;
  },
  // o líder abre o Baú do Clã (perto da peça no terreno dele): guardar, tirar e organizar, como o baú particular
  bauCla(j, L, m, aviso) {
    if (!j.prog.cla) return aviso('Funde o seu clã primeiro (aba Clã)');
    if (!L.pecas.some((o) => o.k === 'bau_cla' && Math.hypot(o.x - j.x, o.z - j.z) <= 2.6) && !this.pertoBauBase?.(j)) return aviso('Chegue perto do Baú do Clã');
    const Bb = this.baseDe?.(j); if (Bb && this.baseTravada(Bb)) return aviso('Taxa do clã atrasada: deposite no cofre do clã para usar o Baú do Clã');
    if (!Array.isArray(L.bauCla)) L.bauCla = Array(CLA.bauCla).fill(null);
    const p = j.prog, i = m.i | 0;
    if (m.acao === 'guardar') {
      const o = p.mochila[i]; if (!o) return;
      if (o.h && o.k !== 'tomo') return aviso('Tire o item do lugar rápido antes de guardar');
      const tem = o.n || 1, n = o.n && Number.isInteger(m.n) && m.n > 0 ? Math.min(m.n, tem) : tem;
      const bau = L.bauCla.map((q) => (q ? { ...q } : null));
      if (!guardar(bau, o.n ? { ...o, n } : { ...o })) return aviso('O Baú do Clã está cheio');
      L.bauCla = bau; p.mochila[i] = n < tem ? { ...o, n: tem - n } : null;
    } else if (m.acao === 'tirar') {
      const o = L.bauCla[i]; if (!o) return;
      const tem = o.n || 1, n = o.n && Number.isInteger(m.n) && m.n > 0 ? Math.min(m.n, tem) : tem;
      const prova = p.mochila.map((q) => (q ? { ...q } : null));
      if (!guardar(prova, o.n ? { ...o, n } : { ...o })) return aviso('Mochila cheia');
      p.mochila = prova; L.bauCla[i] = n < tem ? { ...o, n: tem - n } : null;
    } else if (m.acao === 'organizar') L.bauCla = organizar(L.bauCla);
    else if (m.acao !== 'abrir') return aviso('O Baú do Clã tem tamanho fixo');
    this.lotesMudados.add(L.def.id);
    this.evento({ t: 'bau', para: j.id, cla: 1, itens: L.bauCla, abrir: m.acao === 'abrir', slots: L.bauCla.length, prox: null, proxSlots: 0 });
    if (m.acao !== 'abrir') this.avisarProg(j);
  },
  // ---------- Fazenda (função do painel): cuida dos canteiros arados da base ----------
  // chamado a cada passo do recruta (amiga.js fazendaAmiga); true = ocupou o passo
  passoFazendaRecruta(x, j, dt) {
    const fn = j.ia.funcao; if (!fn || fn.k !== 'fazenda' || (j.time && j.time.membros.length > 1)) return false;
    const K = this.claDoRecruta(x), L = this.loteDaConta(K?.conta), ia = j.ia, F = CLA.fazenda;
    const avisa = (txt) => { ia.funcaoSt = { txt, ate: this.tempo + 8 }; };
    if (!L) { avisa(K?.bot ? 'O líder não tem terreno' : 'Você não tem terreno'); return false; }
    if (j.trava > 0) { x.pararAmiga(j); return true; }
    const agora = Date.now(), f = (ia.faz ||= {});
    if (vigorDe(j.prog.vigor) < HORTA.vigor) { avisa('Estou sem vigor, no momento não posso.'); x.pararAmiga(j); return true; }
    if (!f.c || !L.horta[f.c] || this.tempo > (f.ate || 0)) { f.c = this.canteiroDaFazenda(L, fn.s, j); f.ate = this.tempo + 60; }
    if (!f.c) { // tudo em ordem: espera perto do baú (ou no meio do terreno)
      avisa(Object.keys(L.horta).length ? 'Fazenda em dia' : 'Sem canteiro arado no terreno');
      const b = L.pecas.find((o) => o.k === 'bau_cla'), px = b ? b.x + 1.2 : (L.def.x0 + L.def.x1) / 2, pz = b ? b.z + 1.2 : (L.def.z0 + L.def.z1) / 2, d = Math.hypot(px - j.x, pz - j.z);
      if (d < 1.5) x.pararAmiga(j); else if (d > 30) x.irLongeAmiga(j, px, pz, dt); else this.irDireto(j, px, pz, d > 6);
      return true;
    }
    const [ci, cj] = f.c.split(',').map(Number), cx = ci + 0.5, cz = cj + 0.5, d = Math.hypot(cx - j.x, cz - j.z);
    if (d > F.perto) { if (d > 30) x.irLongeAmiga(j, cx, cz, dt); else this.irDireto(j, cx, cz, d > 6); return true; }
    x.pararAmiga(j); j.ry = Math.atan2(cx - j.x, cz - j.z);
    if (this.tempo < (f.t || 0)) return true;
    f.t = this.tempo + F.passo;
    const r = this.cuidarCanteiroCla(x, j, L, f.c, fn.s, K, agora); f.c = null;
    if (r) avisa(r);
    return true;
  },
  // o canteiro mais urgente: maduro (colher) > seco com planta (regar) > vazio (plantar a semente pedida); o mais perto
  canteiroDaFazenda(L, s, j) {
    const agora = Date.now(); let melhor = null, mp = -1, md = Infinity;
    for (const [c, t] of Object.entries(L.horta)) {
      if (!t) continue;
      crescerPlanta(t, agora);
      const P = t.c && PLANTAS[t.c];
      const pr = P && fasePlanta(t.g / P.G) >= 4 ? 3 : P && !(t.w && agora < t.w + HORTA.rega * 3600e3) ? 2 : !t.c && PLANTAS[s] ? 1 : 0;
      if (!pr) continue;
      const [ci, cj] = c.split(',').map(Number), d = Math.hypot(ci + 0.5 - j.x, cj + 0.5 - j.z);
      if (pr > mp || (pr === mp && d < md)) { mp = pr; md = d; melhor = c; }
    }
    return melhor;
  },
  cuidarCanteiroCla(x, j, L, c, s, K, agora) {
    const t = L.horta[c]; if (!t) return null;
    crescerPlanta(t, agora);
    const p = j.prog, gasta = () => { p.vigor = { v: Math.max(0, vigorDe(p.vigor) - HORTA.vigor), t: Date.now() }; };
    let txt = null;
    if (t.c && fasePlanta(t.g / PLANTAS[t.c].G) >= 4) { // colher: vai para o Baú do Clã (sem baú, a bolsa dele)
      const P = PLANTAS[t.c], n = P.y[0] + Math.floor(Math.random() * (P.y[1] - P.y[0] + 1)), B = this.bauDoCla(K);
      const q = guardarQueCabe(B ? B.itens : p.mochila, { k: t.c, n }); if (!q) return B ? 'O Baú do Clã está cheio' : 'Bolsa cheia';
      if (B) this.mexeuBau(B);
      Object.assign(t, { c: '', g: 0, u: agora }); delete t.mi; delete t.mf;
      gasta(); this.ganharXP(j, 1); txt = `Colheu ${q} ${P.nome.toLowerCase()}`;
    } else if (t.c) { t.w = agora; t.u = agora; gasta(); txt = 'Regando'; }
    else {
      const P = PLANTAS[s]; if (!P) return null;
      const B = this.bauDoCla(K), sk = 'semente_' + s;
      if (B && contar(B.itens, sk) > 0) { tirar(B.itens, sk, 1); this.mexeuBau(B); }
      else if (contar(p.mochila, sk) > 0) tirar(p.mochila, sk, 1);
      else { // compra na Rosa com o cofre do clã (clã bot: o ouro do líder)
        const preco = LOJA.find((o) => o.k === sk)?.preco || P.semente;
        if (K.bot) { if (!K.corpo || (K.corpo.prog.ouro | 0) < preco) return 'Sem ouro para semente'; K.corpo.prog.ouro -= preco; }
        else { if (!K.c || K.c.cofre < preco) return 'Cofre sem ouro para semente'; K.c.cofre -= preco; this.logCla(K.c, `Semente de ${P.nome.toLowerCase()} (fazenda)`, -preco); if (K.corpo) K.corpo.progSujo = true; }
      }
      Object.assign(t, { c: s, g: 0, u: agora, w: agora }); delete t.mi; delete t.mf;
      gasta(); txt = `Plantou ${P.nome.toLowerCase()}`;
    }
    this.avisarLote(L); this.lotesMudados.add(L.def.id); x.guardarAmiga?.();
    return txt;
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
    // a taxa da base (shared/base.js): sai do cofre a cada semana vencida
    const B = this.baseDe?.(j);
    if (B && this.pagarBase(B, (v) => { if (c.cofre < v) return false; c.cofre -= v; this.logCla(c, 'Taxa da base', -v); return true; })) mudou = true;
    if (B) this.baseDoClaMudou(j);
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
    // e a taxa da base atrasada (shared/base.js)
    const B = this.baseDe?.(j);
    if (B) this.pagarBase(B, (v) => { if (c.cofre < v) return false; c.cofre -= v; this.logCla(c, 'Taxa da base atrasada', -v); return true; });
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
      const m = x.amiga && c.m.find((o) => o.id === x.AMIGA.id); if (!m?.fn || m.dev) continue; // devendo não trabalha
      const f = this.trabalhoFora(x, m, h, j.prog.nivel | 0); if (f) feitos.push(f);
    }
    if (!feitos.length) return;
    const horas = h >= 1 ? `${Math.floor(h)} h` : `${Math.round(h * 60)} min`;
    for (const f of feitos) this.logCla(c, `Fora (${horas}): ${f}`);
    // um recruta por linha (André 2026-11-22: "podia descrever por coluna... Gael fez isso, João fez tal"); o aviso (hud.gd) quebra no \n
    this.evento({ t: 'aviso', para: j.id, texto: `Enquanto você esteve fora (${horas}):\n${feitos.join('\n')}` });
  },
  // o que um recruta fez em h horas fora (grind: XP até o nível do líder; farm: o que o vigor paga, direto no Baú do
  // Clã; fazenda: os canteiros crescem sozinhos e ele colhe e replanta quando o líder volta). Texto ou null.
  trabalhoFora(x, m, h, nvLider) {
    const a = x.amiga, F = CLA.fora; if (!a) return null;
    let txt = null;
    if (m.fn.k === 'grind') {
      const teto = Math.max(1, nvLider), antes = a.prog.nivel | 0; if (antes >= teto) return null;
      let n = F.nivelHora * h, xp = 0, nv = antes, resto = a.prog.xp | 0;
      while (n > 0 && nv < teto) { const prox = xpProximo(nv), falta = prox - resto, q = Math.min(n, falta / prox); xp += Math.round(q * prox); n -= q; resto = 0; nv++; }
      if (xp > 0) { this.ganharXP(a, xp); if ((a.prog.nivel | 0) > teto) a.prog.nivel = teto; m.nv = a.prog.nivel | 0; txt = `${m.nome}: caçou e foi do Nv ${antes} ao ${a.prog.nivel}`; }
    } else if (m.fn.k === 'recurso') {
      const R = ENCOMENDA.recursos[m.fn.r]; if (!R) return null;
      const C = R.no && COLETA[R.no], item = R.item === 'peixe' ? F.peixe : R.item;
      const custo = C ? C.vigor / (C.da[R.item] || 1) : 1; // vigor por unidade
      const vg = vigorDe(a.prog.vigor) + (h * 3600 / VIGOR.enche) * VIGOR.max; // o que tinha + o que encheu fora
      const B = this.bauDoCla(this.claDoRecruta(x)), onde = B ? B.itens : a.prog.mochila;
      let n = Math.floor(vg / custo), dado = 0;
      for (let passo = 50; n > 0 && passo >= 1; passo = Math.floor(passo / 2)) while (n >= passo && guardar(onde, { k: item, n: passo })) { n -= passo; dado += passo; }
      a.prog.vigor = { v: Math.max(0, Math.min(VIGOR.max, vg - dado * custo)), t: Date.now() };
      if (B && dado) this.mexeuBau(B);
      txt = dado ? `${m.nome}: juntou ${dado} de ${R.nome}${B ? ' (no Baú do Clã)' : ''}` : `${m.nome}: não juntou nada (${B ? 'Baú do Clã' : 'bolsa'} cheio)`;
    }
    x.guardarAmiga?.();
    return txt;
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
      const bau = Array.isArray(e?.bau) ? Array.from({ length: CLA.bauCla }, (_, i) => (e.bau[i] && typeof e.bau[i].k === 'string' && ITENS[e.bau[i].k] ? { k: e.bau[i].k, n: Math.max(1, e.bau[i].n | 0) } : null)) : null;
      const fixos = C.membros.filter((id) => id !== C.lider).length, nvC = Math.max(1, Math.min(CLA.max, Math.max(e?.nv | 0, fixos + (v?.m.length || 0))));
      this.clasNpc[C.id] = { nv: nvC, m: v?.m.slice(0, vagasClaNpc(C, nvC)) || [], prox: Number.isFinite(+e?.prox) ? +e.prox : Date.now() + CLAS_NPC_REGRAS.primeiro * 3600e3, sem: v?.sem || Date.now() + CLA.semana,
        ...(bau ? { bau } : {}), ...(Number.isFinite(+e?.visto) && +e.visto > 0 ? { visto: +e.visto } : {}) };
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
      // o líder bot comanda como um jogador (André 2026-11-22: "como se fosse um ser humano"): dá função a quem está sem,
      // aplica as funções, recolhe o que farmaram no Baú do Clã e, na volta do mundo vazio, conta o tempo fora
      const ctxs = this.amigosIa.filter((x) => x.AMIGA.clanpc === C.id && x.amiga);
      const temLote = !!this.loteDaConta(this.amigosIa.find((x) => x.AMIGA.id === C.lider)?.AMIGA.conta);
      E.m.forEach((m, i) => { if (!m.fn) { m.fn = this.funcaoBotCla(i, temLote); mudou = true; } });
      if (E.visto && !E.foraFeito) {
        E.foraFeito = true;
        const ms = Math.min(CLA.fora.max, agora - E.visto);
        if (ms >= CLA.fora.minimo) for (const x of ctxs) { const m = E.m.find((o) => o.id === x.AMIGA.id); if (m?.fn) this.trabalhoFora(x, m, ms / 3600e3, L.prog.nivel | 0); }
      }
      E.foraFeito = true;
      if (!E.visto || agora - E.visto > 600e3) { E.visto = agora; mudou = true; }
      for (const x of ctxs) { const m = E.m.find((o) => o.id === x.AMIGA.id); if (m) this.aplicarFuncao(L, x, m, false); }
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
      // liderança: clã cheio, sobe de nível quando dá (as mesmas regras do jogador; o ouro é o do líder, com a reserva)
      if (E.m.length >= vagasClaNpc(C, E.nv) && CLA.niveis[(E.nv || 1) + 1]) {
        this.fundirBauNpc(E);
        const r = this.subirCla({ nv: E.nv || 1, nvLider: L.prog.nivel | 0, raca: C.raca, ouro: (L.prog.ouro | 0) - R.reserva, fontes: [E.bau || []] });
        if (!r.falta) { L.prog.ouro -= r.N.ouro; r.tirar(); E.nv = r.N.nv; mudou = true;
          for (const o of this.jogadores.values()) if (!o.bot) this.evento({ t: 'aviso', para: o.id, texto: `${C.n} subiu para o Nv ${E.nv}` }); }
      }
      if (agora >= E.prox && E.m.length < vagasClaNpc(C, E.nv)) {
        E.prox = agora + R.entre * 3600e3; mudou = true;
        const nv = L.prog.nivel | 0, livre = (L.prog.ouro | 0) - R.reserva;
        const T = [...CLA.tiers].reverse().find((T) => (T.claNv || 1) <= (E.nv || 1) && precoTier(T, nivelTier(T, nv)) <= livre);
        if (T) {
          const m = sortearRecruta(Math.random, T, nv, agora);
          m.fn = this.funcaoBotCla(E.m.length, temLote); // o líder já diz o que ele vai fazer
          L.prog.ouro -= precoTier(T, m.nv); E.m.push(m);
          this.criarRecrutaNpc(C, m, true);
          for (const o of this.jogadores.values()) if (!o.bot && this.racaDe(o) !== C.raca) this.evento({ t: 'aviso', para: o.id, texto: `${this.amigosIa.find((x) => x.AMIGA.id === C.lider)?.AMIGA.nome || 'O líder'} recrutou ${m.nome} para os ${C.n}` });
        }
      }
      if (mudou) this.salvarClasNpc();
    }
    this.passoBasesNpc?.(); // as bases dos clãs bot (shared/base.js)
  },
  // o líder bot faz o que o jogador faria na fornalha: 3 minérios de ferro viram 1 barra, 2 barras viram 1 de aço
  fundirBauNpc(E) {
    const b = E.bau; if (!b) return;
    const f = Math.floor(contar(b, 'minerio_ferro') / 3); if (f) { tirar(b, 'minerio_ferro', f * 3); guardarQueCabe(b, { k: 'barra_ferro', n: f }); }
    const a = Math.floor(Math.max(0, contar(b, 'barra_ferro') - 30) / 2); if (a) { tirar(b, 'barra_ferro', a * 2); guardarQueCabe(b, { k: 'barra_aco', n: a }); }
  },
  // a função que o líder bot dá para o recruta i (como um jogador faria: metade caça, uns farmam, um guarda o líder e,
  // com terreno, um cuida da fazenda)
  funcaoBotCla(i, temLote) {
    const L = [{ k: 'grind' }, { k: 'recurso', r: 'ferro' }, { k: 'recurso', r: 'lenha' }, { k: 'proteger', p: 'lider' }, temLote ? { k: 'fazenda', s: 'cenoura' } : { k: 'recurso', r: 'pedra' }, { k: 'recurso', r: 'cristal' }];
    return L[i % L.length];
  },
  // os clãs bot que o app mostra no painel (o inimigo e o aliado)
  clasNpcInfo(j) {
    if (!this.clasNpc) this.carregarClasNpc(null);
    const nome = (id) => [...AMIGOS_VIRTUAIS, ...RIVAIS].find((d) => d.id === id)?.nome || id;
    // relação (André 2026-11-22): outra raça = inimigo; mesma raça = neutro (aliança fica para depois)
    return CLAS_NPC.map((C) => ({ n: C.n, nv: this.clasNpc[C.id].nv || 1, lider: nome(C.lider), inimigo: this.racaDe(j) !== C.raca ? 1 : 0, raca: RACAS[C.raca]?.nome || C.raca, recrutas: C.membros.filter((id) => id !== C.lider).length + this.clasNpc[C.id].m.length, // os fixos contam (André 2026-11-22)
      membros: [...C.membros.filter((id) => id !== C.lider).map(nome), ...this.clasNpc[C.id].m.map((m) => `${m.nome} (${tierDe(m.tier).nome} Nv ${m.nv}${m.fn ? ' · ' + (CLA.funcoes.find((F) => F.id === m.fn.k)?.nome || '') : ''})`)] }));
  },
};

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
import { LIDERES_CLA, CLA, ENCOMENDA, FERRAMENTAS_FAZENDA, VIGOR, COLETA, PLANTAS, HORTA, ITENS, LOJA, fasePlanta, defRecruta, nomeValido, CLAS_NPC, CLAS_NPC_REGRAS, CLAS_NPC_ORDENS, vagasClaNpc, fixosNpc, almaDe, defRecrutaNpc, FICHA_RECRUTA, sortearLuta, fichaLuta, fichaInfo, AMIGOS_VIRTUAIS, RIVAIS, RACAS, DROPS, NPC_VIDA, NIVEL_INIMIGO, AMIGOS } from './dados.js';
import { contextoDeAmigo } from './amiga.js';
import { guardar, guardarQueCabe, xpProximo, xpDoInimigo, contar, tirar, organizar, progressoValido, liberarPaginas, calcularStatus, passivasDe } from './progresso.js';
import { fundoAgua } from './transporte.js';
import { crescerPlanta } from './simulacao.js'; // só usadas em tempo de jogo (progresso.js também importa daqui)

// o que dá para mandar farmar (painel "Farmar recurso"): os da encomenda e o couro (caça e tira o couro). André
// 2026-11-23: "somente qd eu solicitar em comando tipo preciso de ferro couro ou madeira aí ele trará"
// André 2026-11-23 ("acrescente a carne crua e tudo que tem no mapa lá de recursos... qualquer recurso útil e dropável
// de monstros e coletáveis do mundo"): os materiais que os monstros de caça soltam (DROPS.mat) entram também; o recruta
// caça no campo cujos monstros soltam aquele material (campoDoDrop)
const DROP_NOMES = { couro: 'couro', carne: 'carne crua', tecido: 'tecido', fragmento: 'fragmento rúnico' };
export const RECURSOS_CLA = { ...ENCOMENDA.recursos,
  ...Object.fromEntries(Object.entries(DROP_NOMES).map(([k, nome]) => [k, { palavras: [k], coleta: 'cacar', no: null, item: k, nome }])),
  // o Fragmento de Alma da outra raça: caça Geada (ou Chama, para a Geada); cai direto no Baú do Clã (fragmentoGuerra)
  alma: { palavras: ['alma', 'fragmento de alma'], coleta: 'guerra', no: null, item: null, nome: 'fragmento de alma' } };
const sorteia = (l, r) => l[Math.floor(r() * l.length)];
const int = (v, a, b, d) => (Number.isFinite(+v) ? Math.max(a, Math.min(b, Math.round(+v))) : d);
// vigor de agora (igual ao vigorAgora de progresso.js; aqui sem importar para não dar laço)
const vigorDe = (vg) => (vg ? Math.min(vg.m || VIGOR.max, vg.v + (Math.max(0, Date.now() - vg.t) / 1000 / VIGOR.enche) * VIGOR.max) : VIGOR.max); // m: máximo pelo nível (André 2026-11-24)
// função do recruta (painel): { k, r?: recurso, p?: 'lider' | id de outro recruta }
export function funcaoValida(fn) {
  if (!fn || typeof fn !== 'object' || !CLA.funcoes.some((F) => F.id === fn.k) || fn.k === 'livre') return null;
  if (fn.k === 'recurso') return Object.hasOwn(RECURSOS_CLA, fn.r) ? { k: 'recurso', r: fn.r } : null;
  if (fn.k === 'fazenda') return { k: 'fazenda', ...(PLANTAS[fn.s] ? { s: fn.s } : {}) };
  if (fn.k === 'proteger') return fn.p === 'lider' || fn.p === 'carrinho' || fn.p === 'mercante' || (typeof fn.p === 'string' && /^rc[a-z0-9]{4,16}$/.test(fn.p)) ? { k: 'proteger', p: fn.p } : null;
  return { k: fn.k };
}
// Proteger carrinho / mercante (André 2026-11-23): o nome que aparece no aviso e no painel
const VEIC_PROTEGE = { carrinho: 'o carrinho', mercante: 'o mercante' };
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
      lu: fichaLuta(m), // a ficha (FICHA_RECRUTA); recruta de antes ganha a sorteada pelo id
      nv0: int(m.nv0, 1, 200, 1), nv: int(m.nv, 1, 200, 1), desde: int(m.desde, 0, 9e15, 0), ...(Number.isFinite(+m.dev) && +m.dev > 0 ? { dev: Math.round(+m.dev) } : {}), ...(funcaoValida(m.fn) ? { fn: funcaoValida(m.fn) } : {}),
      ...(m.pos && Number.isFinite(+m.pos.x) && Number.isFinite(+m.pos.z) && Math.abs(+m.pos.x) < 1e5 && Math.abs(+m.pos.z) < 1e5 ? { pos: { x: +m.pos.x, z: +m.pos.z } } : {}) }); // onde estava quando o líder saiu
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
// o recruta com a ficha (FICHA_RECRUTA): o sorteio de antes e, por cima, coragem, cuidado e gosto pelo cajado
export function sortearComFicha(rnd, T, nvLider, agora) { const r = sortearRecruta(rnd, T, nvLider, agora); r.lu = sortearLuta(rnd, r.jeito); return r; }
// o que o app mostra de um candidato
// ---------- a regra única de recrutar (André 2026-11-24: "os bots seguem a mesma lógica do jogador comum... quando eu mudar
// um, muda para todos"): o jogador (Recrutador) e o líder bot (passoClasNpc) passam por aqui ----------
// pode contratar no tier T? ocupadas = quem já ocupa vaga (clã bot: recrutas + fixos no clã). Texto do motivo ou null.
export function regraRecrutar(nvCla, ocupadas, T) {
  const nv = nvCla || 1;
  if (ocupadas >= nv) return nv >= CLA.max ? `O clã já tem ${CLA.max} recrutas (o máximo)` : `Clã Nv ${nv}: ${nv} vaga${nv > 1 ? 's' : ''}. Melhore o clã para abrir outra`;
  if ((T.claNv || 1) > nv) return `${T.nome} só no clã Nv ${T.claNv}`;
  return null;
}
// os candidatos que o Recrutador mostra (FICHA_RECRUTA.candidatos), no nível do tier pelo nível do líder
export function candidatosRecrutar(T, nvLider, agora, rnd = Math.random) { return Array.from({ length: FICHA_RECRUTA.candidatos }, () => sortearComFicha(rnd, T, nvLider, agora)); }
const candidatoInfo = (r, T) => ({ nome: r.nome, g: r.g, nv: r.nv, preco: precoTier(T, r.nv), sem: semanaDe(T, r.nv), ap: r.ap, ficha: fichaInfo(r.lu, r.jeito, r.gosto, r.g) });

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
    const st = (o, prog) => ({ hp: Math.round(o.vida) | 0, hpM: Math.round(o.vidaMax) | 0, mp: Math.round(o.mana) | 0, mpM: Math.round(o.manaMax) | 0, vg: Math.floor(vigorDe(prog.vigor)), vgM: prog.vigor?.m || VIGOR.max, morto: o.morto ? 1 : 0 });
    return { n: c.n, cofre: c.cofre, semana: semanaCla(c), prox: Math.max(0, c.sem - Date.now()), max: c.nv || 1, nv: c.nv || 1, sobe: this.subirInfo(j), perto: this.pertoRecrutador(j),
      eu: { nome: j.nome, nv, ...st(j, j.prog) },
      m: c.m.map((m) => { const a = vivos.get(m.id); return { id: m.id, nome: m.nome, tier: tierDe(m.tier).nome, nv: a ? a.prog.nivel | 0 : m.nv, sem: semanaDe(tierDe(m.tier), a ? a.prog.nivel | 0 : m.nv), on: a ? 1 : 0, ...(m.dev ? { dev: m.dev } : {}), g: m.g,
        fn: m.fn || { k: 'livre' }, c: 'r:' + m.id, ...(a ? { ...st(a, a.prog), fz: this.fazendoRecruta(a, j), x: Math.round(a.x), z: Math.round(a.z), bid: a.id, ...(a.time && a.time === j.time ? { time: 1 } : {}) } : {}) }; }), // x, z: "Ver no mapa"; c: conta (Mensagem), bid: o corpo (Time)
      bauCla: temBau ? bau : null, plantas: Object.entries(PLANTAS).map(([k, P]) => ({ k, nome: P.nome })),
      veic: { carrinho: this.carrinhoFora(j, { k: 'carrinho' }) ? 1 : 0, mercante: this.navioFora(j) ? 1 : 0 }, // Proteger carrinho / mercante: apagado se não está no mundo
      funcoes: CLA.funcoes, recursos: Object.entries(RECURSOS_CLA).map(([k, R]) => ({ k, nome: R.nome })),
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
    // 'candidatos' (André 2026-11-23: "aparecem 3 recrutas... e eu escolho entre 3"): o Recrutador mostra
    // FICHA_RECRUTA.candidatos com ficha; 'recrutar' com esc (0, 1, 2) contrata o escolhido. Sem esc: sorteia um (como antes)
    if (m.acao === 'recrutar' || m.acao === 'candidatos') {
      const T = CLA.tiers.find((x) => x.id === m.tier); if (!T) return;
      if (!this.pertoRecrutador(j)) return aviso('Fale com o Recrutador (Clareira ou Juncal)');
      { const nao = regraRecrutar(c.nv, c.m.length, T); if (nao) return aviso(nao); }
      if (m.acao === 'candidatos') {
        const l = candidatosRecrutar(T, j.prog.nivel, agora);
        j.candidatosCla = { tier: T.id, l, ate: agora + FICHA_RECRUTA.validade };
        return this.evento({ t: 'claCandidatos', para: id, tier: T.id, nome: T.nome, l: l.map((r) => candidatoInfo(r, T)) });
      }
      const esc = Number.isInteger(m.esc) ? m.esc : -1, K = j.candidatosCla;
      if (esc >= 0 && !(K && K.tier === T.id && K.ate >= agora && K.l[esc])) return aviso('Os candidatos já foram embora. Peça de novo ao Recrutador');
      const r = esc >= 0 ? K.l[esc] : sortearComFicha(Math.random, T, j.prog.nivel, agora), preco = precoTier(T, r.nv);
      if ((j.prog.ouro | 0) < preco) return aviso(`Falta ouro: ${T.nome} custa ${preco}`);
      j.prog.ouro -= preco; j.candidatosCla = null;
      c.m.push(r);
      this.logCla(c, `Contratou ${r.nome} (${T.nome} Nv ${r.nv})`, -preco);
      aviso(`${r.nome} entrou no clã! ${T.nome} Nv ${r.nv}. Semana: ${semanaDe(T, r.nv)} de ouro`);
      this.entrarRecrutas(j, r.id); // o novo aparece do lado do líder, no Recrutador
      this.baseDoClaMudou(j); // o próximo lote livre da base é dele (shared/base.js)
      this.historia?.(j, 'recrutar', { v: c.m.length }); // Ato do Clã: "Soldados da Chama" e "Um clã que cresce"
      return this.avisarProg(j);
    }
    // "Ver" no painel (André 2026-11-23: "não vou controlar eles, mas eu consigo ver"): a visão do servidor (server/visao.js)
    // passa a ser em volta do recruta; id vazio volta para o herói
    if (m.acao === 'espiar') {
      if (!m.id) { j.espia = null; return; }
      const x = c.m.some((o) => o.id === m.id) && this.recrutasNoMundo(j).find((o) => o.AMIGA.id === m.id);
      if (!x?.amiga) return aviso('Esse recruta está fora do mundo agora');
      j.espia = x.amiga.id;
      return;
    }
    // "Ver" > menu do recruta (André 2026-11-24: "ter acesso a toda sua interface... não vou poder editar nada, somente
    // visual... consigo ver o que ele precisa upar"): manda ao líder o progresso inteiro do recruta (status, mochila,
    // equipamento, profissões, habilidades, Tomos) só para olhar; nada volta. No mundo: o corpo de agora; fora: o save
    if (m.acao === 'fichaVer') {
      const r = c.m.find((o) => o.id === m.id); if (!r) return aviso('Esse recruta não está no seu clã');
      const ctx = this.recrutasNoMundo(j).find((o) => o.AMIGA.id === r.id), b = ctx?.amiga;
      if (!b && this.lerNpc && !this.npcSalvos?.has(r.id)) this.carregarNpc(r.id, this.lerNpc(r.id));
      const prog = b?.prog || this.npcSalvos?.get(r.id)?.prog;
      if (!prog) return aviso(`${r.nome} ainda não tem ficha salva`);
      let st = b?.st;
      if (!st) { try { st = calcularStatus(prog, passivasDe(prog)); } catch { st = {}; } }
      const def = ctx?.AMIGA || defRecruta(r, j.conta, c.n, this.racaDe(j));
      return this.evento({ t: 'claFicha', para: id, rid: r.id, nome: r.nome, g: r.g, visual: b?.visual || def.visual, aparencia: b?.aparencia || def.aparencia,
        prog, st: Object.fromEntries(Object.entries(st || {}).map(([k, v]) => [k, Math.round(v * 1e4) / 1e4])), xpProx: xpProximo(prog.nivel | 0 || 1), agora, mundo: !!b });
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
      if (dep) this.historia?.(j, 'cofre', { v: c.cofre }); // missão "Uma base que aguenta": a taxa da semana no cofre
      return this.avisarProg(j);
    }
    if (m.acao === 'funcao') {
      const r = c.m.find((o) => o.id === m.id); if (!r) return;
      const fn = funcaoValida(m.fn);
      if (fn?.k === 'proteger' && fn.p === 'carrinho' && !this.carrinhoFora(j, { k: 'carrinho' })) return aviso('Coloque o carrinho no mundo primeiro');
      if (fn?.k === 'proteger' && fn.p === 'mercante' && !this.navioFora(j)) return aviso('Coloque o navio mercante na água primeiro');
      if (fn?.k === 'proteger' && !VEIC_PROTEGE[fn.p] && fn.p !== 'lider' && (fn.p === r.id || !c.m.some((o) => o.id === fn.p))) return aviso('Escolha você ou outro membro do clã');
      if (fn) r.fn = fn; else delete r.fn;
      j.progSujo = true;
      const x = this.recrutasNoMundo(j).find((o) => o.AMIGA.id === r.id);
      if (x?.amiga) this.aplicarFuncao(j, x, r, true);
      const F = CLA.funcoes.find((o) => o.id === (fn?.k || 'livre'));
      aviso(`${r.nome}: ${F.nome}${fn?.k === 'fazenda' ? (fn.s ? ` (plantar ${PLANTAS[fn.s].nome.toLowerCase()})` : ' (só colhe e rega)') : fn?.k === 'recurso' ? ` (${RECURSOS_CLA[fn.r].nome})` : fn?.k === 'proteger' ? ` ${fn.p === 'lider' ? 'você' : VEIC_PROTEGE[fn.p] || c.m.find((o) => o.id === fn.p).nome}` : ''}`);
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
      this.historia?.(j, 'cla_nivel', { v: c.nv }); // Ato do Clã: "Um clã que cresce"
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
    const alma = almaDe(raca), precisa = { ...N.mat, ...(N.alma ? { [alma]: N.alma } : {}) }, tem = (k) => fontes.reduce((s, f) => s + contar(f, k), 0);
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
    const itens = Object.entries({ ...N.mat, ...(N.alma ? { [alma]: N.alma } : {}) }).map(([k, n]) => ({ k, nome: ITENS[k]?.nome || k, n, tem: tem(k) }));
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
    if (this.levandoRecruta(a)) return `Levando ${ia.levar.nome} ao Baú do Clã`;
    if (ia.funcaoSt && ia.funcaoSt.ate > this.tempo) return ia.funcaoSt.txt;
    if (a.time && a.time === j.time) return 'No seu time';
    if (ia.funcao?.k === 'proteger') return VEIC_PROTEGE[ia.funcao.p] ? (ia.pv?.sem ? `Esperando ${VEIC_PROTEGE[ia.funcao.p]}` : `Protegendo ${VEIC_PROTEGE[ia.funcao.p]}`) : 'Protegendo';
    if (ia.funcao?.k === 'fazenda') return 'Na fazenda';
    if (ia.funcao?.k === 'alma') return !a.guerra ? 'Fragmento de Alma: só acima do Nv 30 e fora da zona segura' : ia.alma?.alvo ? 'Caçando a outra raça' : 'Procurando a outra raça';
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
    // só o recurso pedido vai para o Baú do Clã, e ele leva andando (André 2026-11-23: "n quero q vá nada somente qd eu
    // solicitar... queria q ele trouxesse n q fosse direto pro baú auto"). O resto fica na bolsa dele.
    ia.levar = fn.k === 'recurso' && RECURSOS_CLA[fn.r]?.item ? { r: fn.r, item: RECURSOS_CLA[fn.r].item, nome: RECURSOS_CLA[fn.r].nome } : null;
    if (novo) {
      ia.funcaoSt = null; ia.faz = null; ia.fazFer = null;
      // proteger você, o carrinho ou o mercante: continua no time (André 2026-11-23: "larguei eles no mercante, eles já
      // saíram do meu time"); as outras funções tiram do time para trabalhar sozinhos
      const fica = fn.k === 'seguir' || (fn.k === 'proteger' && ['lider', 'carrinho', 'mercante'].includes(fn.p));
      if (!fica && noTime && !j.bot) x.sairTimeAmiga(j.id);
      if (a.coleta) this.pararColeta(a, null); if (a.pesca) this.pararPesca(a, null);
      if (ia.atividade) x.fimAtividadeAmiga(a, true);
      if (ia.encomenda && !ia.encomenda.pronta) ia.encomenda = null;
      if (!(ia.levar && ia.av?.fase === 'voltar' && this.temLevar(a))) ia.av = null; // indo deixar no baú: termina a entrega ia.viagem = null; ia.vir = null; ia.fase = 'pensar';
    }
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
      const R = RECURSOS_CLA[fn.r]; if (!R) return;
      if (R.coleta === 'guerra') { ia.funcao = { k: 'alma' }; ia.levar = null; if (novo) ia.av = null; return; } // caça a outra raça (almaAmiga)
      if (this.levandoRecruta(a)) return; // indo deixar no Baú do Clã
      if (R.coleta === 'cacar') { // couro, carne, tecido...: caça no campo que solta, e a volta é para o Baú do Clã
        if (ia.av && !ia.av.encomenda && ia.av.fase !== 'voltar') return;
        const v = this.cacarDrop(x, a, j, R.item);
        if (!v.ok && !v.ja) avisa(v.fala ? v.fala[0].toUpperCase() + v.fala.slice(1) : 'Não consegue sair agora');
        return;
      }
      if (ia.encomenda && !ia.encomenda.pronta && ia.av?.encomenda) return;
      if (ia.encomenda?.pronta) ia.encomenda = null; // o que juntou já foi para o baú (ou fica na bolsa dele)
      // clã bot: o líder dá a ferramenta simples para quem ele manda farmar (o jogador compra a dele na loja)
      const fer = j.bot && x.AMIGA.atividades?.[R.coleta]?.ferramenta; if (fer && ITENS[fer] && contar(a.prog.mochila, fer) < 1) guardarQueCabe(a.prog.mochila, { k: fer, n: 1 });
      if (this.precisaFerRecruta(x, a, R)) return; // sem a ferramenta: pega no Baú do Clã ou faz (ferramentaRecruta)
      const verbo = R.coleta === 'pescar' ? 'pesca' : R.coleta === 'lenha' ? 'corta' : 'minera';
      const fala = x.encomendaAmiga(a, j, `${verbo} ${CLA.farmar} ${R.palavras[0]} pra mim`);
      if (!(ia.encomenda && !ia.encomenda.pronta)) avisa(String(fala || 'Não dá agora').replace(/^[^:]*: /, '').slice(0, 60));
    }
  },
  // ---------- base do clã: o terreno do líder e o Baú do Clã (André 2026-11-22) ----------
  // o clã de um recruta (jogador ou bot): quem lidera, a conta (dono do terreno), a lista de membros e o cofre
  claDoRecruta(x) {
    const A = x.AMIGA;
    if (A.clanpc || this.fixoClaNpc(x)) {
      const C = this.claBotDe(x); if (!C) return null;
      const L = this.amigosIa.find((o) => o.AMIGA.id === C.lider);
      return { bot: true, C, corpo: L?.amiga || null, conta: L?.AMIGA.conta, m: this.clasNpc?.[C.id]?.m || [], E: this.clasNpc?.[C.id] };
    }
    const j = [...this.jogadores.values()].find((o) => !o.bot && o.conta === A.lider);
    return { bot: false, corpo: j || null, conta: A.lider, m: j?.prog?.cla?.m || this.clasFora?.get(A.lider)?.m || [], c: j?.prog?.cla };
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
  // ---------- entrega no Baú do Clã (André 2026-11-23) ----------
  // ele carrega o recurso pedido (ia.levar)? peixe conta todo peixe
  ehDoLevar(o, L) { return !!o && !o.h && (o.k === L.item || (L.item === 'peixe' && (o.k === CLA.fora.peixe || !!ITENS[o.k]?.peixe))); },
  temLevar(a) { const L = a?.ia?.levar; return !!L && a.prog.mochila.some((o) => this.ehDoLevar(o, L)); },
  levandoRecruta(a) { return !!a?.ia?.levar && a.ia.av?.fase === 'voltar' && this.temLevar(a); },
  // onde fica o Baú do Clã de verdade: o do salão da base (jogador ou clã bot) ou a peça no terreno do líder; null = sem
  // baú no mapa (clã bot sem base)
  lugarBauCla(K) {
    if (!K) return null;
    const B = K.bot ? this.baseDoClaNpc?.(K.C) : this.basesCla?.['j' + String(K.conta).replace(/[^\w]/g, '').slice(0, 30)];
    const D = B && this.basesDesenho?.[B.k];
    if (D?.bau) return { x: D.bau.x, z: D.bau.z };
    const p = this.loteDaConta(K.conta)?.pecas.find((o) => o.k === 'bau_cla');
    return p ? { x: p.x, z: p.z } : null;
  },
  // fase "voltar" de um recruta com recurso pedido: anda até o Baú do Clã e deixa só o que foi pedido; depois a função
  // manda de novo (até o líder pedir outra coisa). true = ocupou o passo. x = o contexto dele, a = o corpo
  levarBauRecruta(x, a, dt) {
    if (!this.levandoRecruta(a)) return false;
    const K = this.claDoRecruta(x), B = this.bauDoCla(K); if (!B) return false; // sem Baú do Clã: fica na bolsa dele
    const P = this.lugarBauCla(K);
    if (P) {
      const d = Math.hypot(P.x - a.x, P.z - a.z);
      if (d > CLA.entrega.perto) {
        if (d > 30) x.irLongeAmiga(a, P.x, P.z, dt); else this.irDireto(a, P.x, P.z, d > 6);
        return true;
      }
      x.pararAmiga(a);
    } // sem baú no mapa (clã bot sem base): o baú dele é só o estado do clã, guarda ali mesmo
    const n = this.depositarRecruta(x);
    a.ia.av = null; a.ia.fase = 'pensar'; a.ia.encomenda = null;
    if (n) a.ia.funcaoSt = { txt: `Deixou ${n} de ${a.ia.levar.nome} no Baú do Clã`, ate: this.tempo + 20 };
    else if (this.temLevar(a)) a.ia.funcaoSt = { txt: 'O Baú do Clã está cheio', ate: this.tempo + 90 };
    const mm = K.m?.find((o) => o.id === x.AMIGA.id); if (n && K.corpo && mm) this.aplicarFuncao(K.corpo, x, mm, false); // já volta a farmar
    else if (n && !K.corpo && !K.bot && mm) this.funcaoSemLider(x, a, mm.fn || { k: 'livre' }, { id: null, conta: K.conta, bot: false, time: null, prog: { cla: { m: K.m } } }); // líder fora: também
    return true;
  },
  // ---------- a ferramenta da ordem (André 2026-11-24: "se tiver no baú do clã ele pega, se não tiver ele pega as pedras
  // e madeira no chão e fabrica"; nada de comprar pronto). Antes, sem machado, a ordem falhava e ele ia cuidar da casa.
  // true = falta a ferramenta: marca ia.fazFer e o ferramentaRecruta (no passo dele) cuida até ter
  precisaFerRecruta(x, a, R) {
    const k = x.AMIGA.atividades?.[R?.coleta]?.ferramenta;
    if (!k || !ITENS[k] || !FERRAMENTAS_FAZENDA[k] || contar(a.prog.mochila, k) > 0) { a.ia.fazFer = null; return false; }
    if (a.ia.fazFer?.k !== k) { a.ia.fazFer = { k }; a.ia.funcaoSt = { txt: `Sem ${ITENS[k].nome.toLowerCase()}: vou pegar no Baú do Clã ou fazer`, ate: this.tempo + 30 }; }
    a.ia.av = null; return true;
  },
  // 1) Baú do Clã: anda até ele e pega; 2) tem o material: fabrica; 3) pedra e galho soltos no chão (mão); 4) não achou:
  // espera e diz o que falta (a função tenta de novo a cada minuto). true = ocupou o passo
  ferramentaRecruta(x, a, dt) {
    const ia = a.ia, F = ia?.fazFer; if (!F || a.morto) return false;
    const nome = ITENS[F.k].nome.toLowerCase(), st = (txt) => { ia.funcaoSt = { txt, ate: this.tempo + 30 }; };
    const ir = (P, perto) => { const d = Math.hypot(P.x - a.x, P.z - a.z); if (d <= perto) { x.pararAmiga(a); return false; } if (d > 30) x.irLongeAmiga(a, P.x, P.z, dt); else this.irDireto(a, P.x, P.z, d > 6); return true; };
    const seguir = () => { // tem a ferramenta: volta para a ordem
      ia.fazFer = null; ia.fase = 'pensar';
      const K = this.claDoRecruta(x), mm = K?.m?.find((o) => o.id === x.AMIGA.id); if (!mm) return;
      if (K.corpo) this.aplicarFuncao(K.corpo, x, mm, false);
      else if (!K.bot) this.funcaoSemLider(x, a, mm.fn || { k: 'livre' }, { id: null, conta: K.conta, bot: false, time: null, prog: { cla: { m: K.m } } });
    };
    if (a.fabrica) return true; // criando (a barrinha)
    if (contar(a.prog.mochila, F.k) > 0) { seguir(); return true; }
    const K = this.claDoRecruta(x), B = this.bauDoCla(K);
    const i = B && !F.semBau ? B.itens.findIndex((o) => o?.k === F.k) : -1;
    if (i >= 0) {
      const P = this.lugarBauCla(K);
      if (P && ir(P, CLA.entrega.perto)) { st(`Indo pegar ${nome} no Baú do Clã`); return true; }
      const o = B.itens[i];
      if (guardarQueCabe(a.prog.mochila, { ...o, n: 1 })) { if ((o.n || 1) > 1) o.n--; else B.itens[i] = null; this.mexeuBau(B); st(`Pegou ${nome} no Baú do Clã`); seguir(); return true; }
      F.semBau = true; // mochila cheia: tenta fazer
    }
    const falta = Object.entries(FERRAMENTAS_FAZENDA[F.k].custo).map(([c, n]) => [c, n - contar(a.prog.mochila, c)]).filter(([, n]) => n > 0);
    if (!falta.length) {
      x.pararAmiga(a); this.fabricar(a.id, { k: F.k });
      if (a.fabrica) { st(`Fazendo ${nome}`); return true; }
      ia.fazFer = null; return false; // não deu para criar (bancada, mochila...): a função tenta de novo daqui a pouco
    }
    if ((F.espera || 0) > this.tempo) return x.pararAmiga(a), true;
    const serve = (no) => { const C = no && COLETA[no.tipo]; return !!C?.mao && falta.some(([c]) => C.da?.[c]) && this.cargas(a, no) > 0 && !F.ruins?.has(no.id); };
    let solto = this.coletaveis.get(F.no);
    if (!serve(solto)) { // procura uma vez (não a cada passo): o solto mais perto que dá o que falta
      solto = null; let md = Infinity;
      for (const no of this.coletaveis.values()) { if (!serve(no)) continue; const d = Math.hypot(no.x - a.x, no.z - a.z); if (d < md) { md = d; solto = no; } }
      F.no = solto?.id || null;
    }
    if (solto) {
      if (ir(solto, solto.r + 1.2)) { st(`Sem ${nome}: catando ${falta.map(([c]) => ITENS[c].nome.toLowerCase()).join(' e ')} no chão`); return true; }
      this.coletar(a.id, { no: solto.id });
      if (this.cargas(a, solto) > 0) (F.ruins ||= new Set()).add(solto.id); // não deu para pegar esse: outro
      F.no = null; return true;
    }
    F.espera = this.tempo + 15; x.pararAmiga(a);
    st(`Sem ${nome}: falta ${falta.map(([c, n]) => `${n} ${ITENS[c].nome.toLowerCase()}`).join(' e ')} (pode pôr no Baú do Clã)`);
    return true;
  },
  // deixa no Baú do Clã só o recurso pedido que ele carrega (chamado ao chegar no baú)
  depositarRecruta(x) {
    const a = x.amiga, L = a?.ia?.levar; if (!L) return 0;
    const B = this.bauDoCla(this.claDoRecruta(x)); if (!B) return 0;
    let n = 0;
    for (let i = 0; i < a.prog.mochila.length; i++) {
      const o = a.prog.mochila[i]; if (!this.ehDoLevar(o, L)) continue;
      const q = guardarQueCabe(B.itens, { ...o }); if (!q) continue;
      n += q; if (q >= (o.n || 1)) a.prog.mochila[i] = null; else o.n -= q;
    }
    if (n) { this.mexeuBau(B); x.guardarAmiga?.(); }
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
    const p = j.prog, gasta = () => { p.vigor = { v: Math.max(0, vigorDe(p.vigor) - HORTA.vigor), t: Date.now(), m: p.vigor?.m || VIGOR.max }; };
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
  // quem está no time do líder agora (m.time = hora): se a conexão cair (ou o servidor reiniciar) no meio do mar, eles
  // voltam para o time e para o lado dele (entrarRecrutas). Só depois de os recrutas já terem entrado com ele (j.recrutasOk)
  marcarTimeRecrutas(j) {
    const c = j?.prog?.cla; if (!c || !j.recrutasOk) return;
    const agora = Date.now();
    for (const x of this.recrutasNoMundo(j)) {
      const m = c.m.find((o) => o.id === x.AMIGA.id); if (!m || !x.amiga) continue;
      if (x.amiga.time && x.amiga.time === j.time) m.time = agora; else delete m.time;
    }
  },
  cobrarCla(j) {
    const c = j?.prog?.cla; if (!c) return;
    const agora = Date.now();
    this.marcarTimeRecrutas(j);
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
  entrarRecrutas(j, contratado = null) {
    const c = j?.prog?.cla; if (!c || !j.conta) return;
    this.clasFora?.delete(j.conta);
    const novos = new Set(); // os que estavam fora do mundo (os que ficaram jogando de verdade não ganham o "tempo fora")
    for (const m of c.m) {
      const ja = this.amigosIa.find((x) => x.AMIGA.id === m.id);
      if (ja?.amiga) { // ficou no mundo enquanto o líder estava fora (tinha gente online): volta a obedecer a ele
        ja.amigaFalam ||= new Set(); ja.amigaFalam.add(j.id); ja.mudarDonoAmiga(j.id);
        ja.amiga.amigosDe[j.conta] = 1; if ((ja.amiga.amizade | 0) < 60) ja.amiga.amizade = 60;
        continue;
      }
      if (ja) this.amigosIa.splice(this.amigosIa.indexOf(ja), 1); // saiu quando o servidor esvaziou: corpo novo
      novos.add(m.id);
      const foraDesde = ja?.foraDesde;
      if (this.lerNpc && !this.npcSalvos?.has(m.id)) this.carregarNpc(m.id, this.lerNpc(m.id));
      const ctx = contextoDeAmigo(this, defRecruta(m, j.conta, c.n, this.racaDe(j)));
      if (foraDesde) ctx.foraDesde = foraDesde;
      this.amigosIa.push(ctx);
      ctx.amigaEntrar(j.id, true);
      const a = ctx.amiga; if (!a) continue;
      a.amigosDe[j.conta] = 1; // soldado do clã: já é amigo do líder (todos os comandos valem)
      if ((a.amizade | 0) < 60) a.amizade = 60;
      const ang = Math.random() * Math.PI * 2, x = j.x + Math.sin(ang) * 2.5, z = j.z + Math.cos(ang) * 2.5;
      Object.assign(a, { x, z, y: this.terreno.altura(x, z), chao: true });
    }
    this.foraRecrutas(j, novos);
    this.aplicarFuncoes(j); // a função que ficou escolhida no painel
    for (const x of this.recrutasNoMundo(j)) { const m = c.m.find((o) => o.id === x.AMIGA.id); if (m && x.amiga && novos.has(m.id) && m.id !== contratado) this.lugarRecrutaAoEntrar(j, x, m); }
    // estavam no time quando a conexão caiu (no mar, no navio, em qualquer lugar): voltam para o time e para o lado dele
    const agora = Date.now();
    for (const x of this.recrutasNoMundo(j)) {
      const m = c.m.find((o) => o.id === x.AMIGA.id), a = x.amiga; if (!m || !a) continue;
      const volta = m.time && agora - m.time < CLA.voltaTime * 1000; delete m.time;
      if (!volta || a.morto) continue;
      if (!(a.time && a.time === j.time)) { if (a.time) this.sairDoTime(a, `${x.AMIGA.nome} saiu do time`); if (!x.entrarTimeAmiga(a, j)) continue; }
      if (novos.has(m.id) || Math.hypot(a.x - j.x, a.z - j.z) > 40) {
        const ang = Math.random() * Math.PI * 2, X = j.x + Math.sin(ang) * 2.5, Z = j.z + Math.cos(ang) * 2.5;
        Object.assign(a, { x: X, z: Z, y: fundoAgua(X, Z) > 0.05 ? Math.max(this.terreno.altura(X, Z), j.y) : this.terreno.altura(X, Z), vx: 0, vz: 0, vy: 0, bordo: null });
      }
    }
    j.recrutasOk = true;
  },
  // os recrutas de quem está fora do jogo (André 2026-11-23: "todos online, se tiver algum jogador online... sempre, sem
  // exceção"): com qualquer jogador no servidor eles ganham corpo e fazem a função; quando o servidor esvazia, saem
  // (amigaSair) e viram simulação; o líder entrando assume os que já estão no mundo (entrarRecrutas). lista = [{ conta, cla, raca }]
  entrarRecrutasSemLider(lista, quemId) {
    const online = new Set([...this.jogadores.values()].filter((o) => !o.bot).map((o) => o.conta));
    for (const { conta, cla: c, raca } of lista || []) {
      if (conta == null || online.has(conta) || !c?.m?.length) continue;
      this.clasFora ||= new Map(); if (!this.clasFora.has(conta)) this.clasFora.set(conta, c);
      const L = { id: null, conta, bot: false, time: null, raca, prog: { cla: c, nivel: 1 }, x: 0, z: 0 }; // o líder de mentira (só para o lugar)
      for (const m of c.m) {
        if (m.dev) continue; // devendo não trabalha
        const ja = this.amigosIa.find((x) => x.AMIGA.id === m.id); if (ja?.amiga) continue;
        if (ja) this.amigosIa.splice(this.amigosIa.indexOf(ja), 1);
        if (this.lerNpc && !this.npcSalvos?.has(m.id)) this.carregarNpc(m.id, this.lerNpc(m.id));
        const ctx = contextoDeAmigo(this, defRecruta(m, conta, c.n, raca || this.racaDe(L)));
        if (ja?.foraDesde) ctx.foraDesde = ja.foraDesde;
        ctx.semLider = true; ctx.amigaEntrar(quemId, false); ctx.semLider = false;
        const a = ctx.amiga; if (!a) continue;
        this.amigosIa.push(ctx);
        a.amigosDe[conta] = 1;
        const fn = m.fn || { k: 'livre' };
        this.funcaoSemLider(ctx, a, fn, L);
        this.lugarRecrutaAoEntrar(L, ctx, { ...m, fn: fn.k === 'seguir' || fn.k === 'proteger' ? { k: 'livre' } : fn }); // seguir/proteger: onde estava
      }
    }
  },
  // o campo de caça para o material pedido: os monstros dali soltam ele (DROPS.mat; o chefe da clareira não conta) e o
  // nível cabe no recruta; o mais forte que ele aguenta, senão o mais fraco que solta. null: o campo dele (qualquer um)
  campoDoDrop(a, item) {
    if (!item) return null;
    const A = NPC_VIDA.aventura, teto = (a.prog.nivel | 0) + A.campoAcima - (a.licoes?.acima || 0);
    const l = this.cacas.map((x) => x.def).filter((c) => !c.boss && !c.tunel && (c.tipos || [c.bicho]).some((t) => !['chefe', 'lider'].includes(t) && DROPS[t]?.mat?.[item]));
    if (!l.length) return null;
    l.sort((x, y) => (x.nivel || 1) - (y.nivel || 1));
    const cabe = l.filter((c) => (c.nivel || 1) <= teto);
    return cabe.length ? cabe[cabe.length - 1] : l[0];
  },
  // caçar para o material: sai como o Grind e vai ao campo que solta ele
  cacarDrop(ctx, a, L, item) {
    const v = ctx.sairCacarAmiga?.(a, L);
    if (v?.ok && a.ia.av?.fase === 'ir') { const c = this.campoDoDrop(a, item); if (c) a.ia.av.c = c; }
    return v;
  },
  // a função do painel com o líder fora do jogo (André 2026-11-23: "aquilo ali é literalmente o que ele vai fazer quando
  // ele estiver no modo sozinho"). Livre: a vida dele (missões, plantar, grindar...). Grind/couro: caça. Farmar: vai ao
  // veio, árvore ou pesqueiro e leva ao Baú do Clã. Fazenda: a horta da base. Proteger outro recruta: protege.
  // Me seguir / Proteger você: espera o líder onde está, se defendendo (protegerAmiga). L = corpo do líder (ou de mentira).
  funcaoSemLider(ctx, a, fn, L) {
    const ia = a.ia; if (!ia) return;
    if (ia.atividade) ctx.fimAtividadeAmiga?.(a, true);
    Object.assign(ia, { vir: null, chamado: null, viagem: null, fase: 'pensar' });
    if (ia.encomenda && !ia.encomenda.pronta) ia.encomenda = null;
    ia.funcao = fn.k === 'fazenda' || fn.k === 'proteger' ? fn : fn.k === 'seguir' ? { k: 'proteger', p: 'lider' } : null;
    ia.levar = fn.k === 'recurso' && RECURSOS_CLA[fn.r]?.item ? { r: fn.r, item: RECURSOS_CLA[fn.r].item, nome: RECURSOS_CLA[fn.r].nome } : null;
    if (fn.k === 'recurso' && RECURSOS_CLA[fn.r]?.coleta === 'guerra') { ia.funcao = { k: 'alma' }; ia.av = null; return; }
    if (!(ia.levar && this.levandoRecruta(a))) ia.av = null;
    if (ia.av) return; // indo deixar no Baú do Clã: termina a entrega
    const R = fn.k === 'recurso' ? RECURSOS_CLA[fn.r] : null;
    if (R && R.coleta !== 'cacar' && this.precisaFerRecruta(ctx, a, R)) return;
    if (R && R.coleta !== 'cacar') { const cc = ctx.lugarColetaAmiga?.(a, R.coleta); if (cc) ia.av = { fase: 'ir', c: cc, coleta: R.coleta, ate: this.tempo + 900 }; }
    else if (R) { const v = this.cacarDrop(ctx, a, L, R.item); if (v && !v.ok) ia.av = null; }
    else if (fn.k === 'grind') { const v = ctx.sairCacarAmiga?.(a, L); if (v && !v.ok) ia.av = null; }
  },
  // a cada minuto (como o aplicarFuncoes do cobrarCla com o líder no jogo): quem terminou a caçada ou a coleta volta
  // para a função do painel
  passoRecrutasSemLider() {
    if (!this.clasFora?.size) return;
    const online = new Set([...this.jogadores.values()].filter((o) => !o.bot).map((o) => o.conta));
    for (const [conta, c] of this.clasFora) {
      if (online.has(conta)) { this.clasFora.delete(conta); continue; }
      const L = { id: null, conta, bot: false, time: null, prog: { cla: c } };
      for (const x of this.recrutasNoMundo(L)) {
        const a = x.amiga, m = a && c.m.find((o) => o.id === x.AMIGA.id); if (!m || a.morto || a.ia?.av || a.time) continue;
        if (['grind', 'recurso'].includes(m.fn?.k) && a.ia?.funcao?.k !== 'alma') this.funcaoSemLider(x, a, m.fn, L);
      }
    }
  },
  // onde o recruta aparece quando o líder entra (André 2026-11-23: "toda vez que eu logo, todos eles entram, ficam do meu
  // lado... queria que eles ficassem espalhados aí... continuassem fazendo o que estavam fazendo antes"): no trabalho da
  // função dele (Grind e couro no campo de caça, Fazenda na base, Farmar onde estava ou na base); só "Me seguir" e
  // "Proteger você" nascem do lado do líder. Sem lugar conhecido, fica do lado (como antes).
  lugarRecrutaAoEntrar(j, x, m) {
    const a = x.amiga, fn = m.fn || { k: 'livre' };
    if (fn.k === 'seguir' || (fn.k === 'proteger' && fn.p === 'lider') || (a.time && a.time === j.time)) return;
    let p = null, r = 3;
    const av = a.ia?.av;
    if (av?.fase === 'escolher' && (fn.k === 'grind' || fn.k === 'recurso')) { // caçando: o campo dele já escolhido, para nascer lá
      const cc = x.campoAmiga?.(a); if (cc) Object.assign(av, { fase: 'ir', c: cc, coleta: null, ate: this.tempo + 900 });
    }
    const c = av?.c;
    if (c && Number.isFinite(c.x) && Number.isFinite(c.z)) { p = { x: c.x, z: c.z }; r = Math.min(8, (c.r || 12) * 0.5); } // caçando: já no campo
    else if (m.pos && Number.isFinite(m.pos.x) && Number.isFinite(m.pos.z) && fn.k !== 'fazenda') p = m.pos; // onde estava quando o líder saiu
    else { const B = this.baseDe?.(j), D = B && this.basesDesenho?.[B.k]; const q = B && (this.bauBase?.(B) || D?.frente || B); if (q) p = { x: q.x, z: q.z }; }
    if (!p) return;
    for (let k = 0; k < 8; k++) {
      const ang = Math.random() * Math.PI * 2, d = k < 7 ? 1 + Math.random() * r : 0, X = p.x + Math.sin(ang) * d, Z = p.z + Math.cos(ang) * d;
      if (fundoAgua(X, Z) > 0.05 && k < 7) continue;
      Object.assign(a, { x: X, z: Z, y: this.terreno.altura(X, Z), chao: true, vx: 0, vz: 0 });
      return;
    }
  },
  // o tempo que o líder ficou fora: cada recruta entrega o que a função dele daria (CLA.fora)
  // André 2026-11-23 ("todos online, se tiver algum jogador online... quando todo mundo sai do servidor, eles viram
  // simulação"): só conta o tempo em que o recruta ficou fora do mundo (desde que saiu: com o líder ou quando o servidor
  // esvaziou). novos = ids que acabaram de ganhar corpo (sem a lista: todos, como antes).
  foraRecrutas(j, novos = null) {
    const c = j.prog.cla, F = CLA.fora; if (!c?.saiu) return;
    const saiu = c.saiu; delete c.saiu; j.progSujo = true;
    const feitos = []; let hMax = 0;
    for (const x of this.recrutasNoMundo(j)) {
      if (novos && !novos.has(x.AMIGA.id)) continue;
      const m = x.amiga && c.m.find((o) => o.id === x.AMIGA.id); if (!m?.fn || m.dev) continue; // devendo não trabalha
      const t0 = Math.max(saiu, +x.foraDesde || 0), ms = Math.min(F.max, Date.now() - t0); if (!(ms >= F.minimo)) continue;
      const h = ms / 3600e3; hMax = Math.max(hMax, h);
      const f = this.trabalhoFora(x, m, h, j.prog.nivel | 0); if (f) feitos.push(f);
    }
    if (!feitos.length) return;
    const horas = hMax >= 1 ? `${Math.floor(hMax)} h` : `${Math.round(hMax * 60)} min`;
    for (const f of feitos) this.logCla(c, `Fora (${horas}): ${f}`);
    // um recruta por linha (André 2026-11-22: "podia descrever por coluna... Gael fez isso, João fez tal"); o aviso (hud.gd) quebra no \n
    this.evento({ t: 'aviso', para: j.id, texto: `Enquanto você esteve fora:\n${feitos.join('\n')}` });
  },
  // o que um recruta fez em h horas fora (grind: XP até o nível do líder; farm: o que o vigor paga, direto no Baú do
  // Clã; fazenda: os canteiros crescem sozinhos e ele colhe e replanta quando o líder volta). Texto ou null.
  trabalhoFora(x, m, h, nvLider) {
    const a = x.amiga, F = CLA.fora; if (!a) return null;
    let txt = null;
    if (m.fn.k === 'grind') {
      const teto = Math.max(1, nvLider), antes = a.prog.nivel | 0; if (antes >= teto) return null;
      let n = F.nivelHora * h, xp = 0, nv = antes, resto = a.prog.xp | 0;
      if ((x.AMIGA.clanpc || this.fixoClaNpc(x)) && CLAS_NPC_ORDENS.ligado) return this.grindForaBot(x, m, h, teto);
      while (n > 0 && nv < teto) { const prox = xpProximo(nv), falta = prox - resto, q = Math.min(n, falta / prox); xp += Math.round(q * prox); n -= q; resto = 0; nv++; }
      if (xp > 0) { this.ganharXP(a, xp); if ((a.prog.nivel | 0) > teto) a.prog.nivel = teto; m.nv = a.prog.nivel | 0; txt = `${m.nome}: caçou e foi do Nv ${antes} ao ${a.prog.nivel}`; }
    } else if (m.fn.k === 'recurso') {
      const R = RECURSOS_CLA[m.fn.r]; if (!R?.item) return null; // Fragmento de Alma: só lutando de verdade
      const C = R.no && COLETA[R.no], item = R.item === 'peixe' ? F.peixe : R.item;
      const custo = C ? C.vigor / (C.da[R.item] || 1) : R.coleta === 'cacar' ? F.couroVigor : 1; // vigor por unidade
      const vg = vigorDe(a.prog.vigor) + (h * 3600 / VIGOR.enche) * VIGOR.max; // o que tinha + o que encheu fora
      const B = this.bauDoCla(this.claDoRecruta(x)), onde = B ? B.itens : a.prog.mochila;
      let n = Math.floor(vg / custo), dado = 0;
      for (let passo = 50; n > 0 && passo >= 1; passo = Math.floor(passo / 2)) while (n >= passo && guardar(onde, { k: item, n: passo })) { n -= passo; dado += passo; }
      a.prog.vigor = { v: Math.max(0, Math.min(a.prog.vigor?.m || VIGOR.max, vg - dado * custo)), t: Date.now(), m: a.prog.vigor?.m || VIGOR.max };
      if (B && dado) this.mexeuBau(B);
      txt = dado ? `${m.nome}: juntou ${dado} de ${R.nome}${B ? ' (no Baú do Clã)' : ''}` : `${m.nome}: não juntou nada (${B ? 'Baú do Clã' : 'bolsa'} cheio)`;
    }
    x.guardarAmiga?.();
    return txt;
  },
  // Botão "Resetar partida" (André 2026-11-24: "é pra começar tudo do zero, clã volta pro nível 1 sem recruta nenhum, é
  // como se fosse um reset da partida"; no cartão: "Zera tudo"). Só a conta do André (j.testador, LIDERES_CLA.reset). Ele e
  // os líderes (Dario, Gael, Kael) voltam a um personagem novo (nível 1, ouro e itens do começo); os clãs dele e dos bots
  // voltam ao nível 1, sem recruta nenhum, com o cofre e o Baú do Clã vazios; as bases e os lotes deles somem (o líder bot
  // funda de novo, passoBasesNpc). As missões ficam (o reset delas é outro botão: missaoTeste 'zerar'). Os membros fixos
  // (Kira, Rufo, Lis, Cecília, Lia) e os outros jogadores não mudam.
  // André 2026-11-24 (2º pedido: "eu e os bots, os líderes, todo mundo é resetado... pro zero mesmo... o nível do clã dos
  // inimigos... e também dos neutros não tá resetando, é pra resetar tudo"): os membros fixos também voltam a um personagem
  // novo (seguem no clã, nível 1); o nível salvo do clã bot vale ao religar o servidor (carregarClasNpc não sobe mais para
  // o número de fixos); as funções dos fixos (E.fx) e a Escolta do Clã em andamento acabam; o save de cada recruta que saiu
  // ('npc:' + id na tabela mundo) é apagado (npcsApagados; o servidor também limpa os órfãos: limparRecrutasOrfaos).
  // Os outros jogadores (gente de verdade) continuam sem mudar.
  resetPartida(id) {
    const j = this.jogadores.get(id); if (!j || j.bot || !j.testador || !LIDERES_CLA.reset) return false;
    const novoProg = (p, fica) => { // troca por dentro (o mesmo objeto): quem guarda j.prog continua certo
      const n = progressoValido(null), guarda = Object.fromEntries(fica.filter((k) => p[k] !== undefined).map((k) => [k, p[k]]));
      for (const k of Object.keys(p)) delete p[k];
      Object.assign(p, n, guarda);
    };
    const agora = Date.now(), bases = new Set(), nomes = [];
    // você: recrutas fora, clã no 1, personagem novo
    const c = j.prog.cla, foram = new Set();
    if (c) for (const r of c.m) { this.tirarRecruta(r.id, j); foram.add(r.id); }
    this.clasFora?.delete(j.conta);
    novoProg(j.prog, ['hist', 'cla', 'devPag', 'rgDado']);
    if (c) { c.m = []; c.nv = 1; c.cofre = 0; c.sem = agora + CLA.semana; delete c.saiu; this.logCla(c, 'Partida resetada: clã de volta ao nível 1'); }
    const kj = this.chaveBase?.(j); if (kj) bases.add(kj);
    // os clãs bot: sem recrutas, nível 1, baú vazio, primeira contratação como num servidor novo
    for (const C of CLAS_NPC) {
      const E = this.clasNpc?.[C.id]; bases.add('n' + C.id); if (!E) continue;
      for (const m of E.m) { this.tirarRecruta(m.id, j); foram.add(m.id); }
      E.m = []; E.nv = 1; delete E.bau; delete E.ordensT; delete E.visto; delete E.foraFeito; delete E.fx;
      E.fora = C.membros.filter((id) => id !== C.lider); if (!E.fora.length) delete E.fora; // os fixos saem: o líder recruta como um jogador
      E.prox = agora + CLAS_NPC_REGRAS.primeiro * 3600e3; E.sem = agora + CLA.semana;
    }
    // o save de quem saiu some do banco (antes ficava 'npc:' + id para sempre na tabela mundo)
    for (const rid of foram) { this.npcSalvos?.delete(rid); this.npcsMudados?.delete(rid); (this.npcsApagados ||= new Set()).add(rid); }
    // os líderes e os membros fixos (Kira, Rufo, Lis, Cecília, Lia): personagem novo (a história deles fica), roupa do começo
    for (const lid of new Set([...LIDERES_CLA.ids(), ...CLAS_NPC.flatMap((C) => C.membros)])) {
      const ctx = this.amigosIa.find((x) => x.AMIGA.id === lid); if (!ctx) continue;
      if (LIDERES_CLA.ids().includes(lid)) nomes.push(ctx.AMIGA.nome);
      const A = ctx.AMIGA, a = ctx.amiga;
      const vestir = (p) => { for (const [l, it] of Object.entries(A.equip || {})) p.equip[l] = { k: it.k, r: A.justa?.raridade ?? 0 }; if (A.mochila?.paginas) liberarPaginas(p, A.mochila.paginas); };
      if (a) {
        novoProg(a.prog, ['hist']); vestir(a.prog); a.zerado = 1; a.progSujo = true; this.aplicarStatus(a, true); this.evento({ t: 'nivel', id: a.id, nivel: 1 }); ctx.guardarAmiga?.();
        if (this.fixoForaNpc(lid)) { if (a.time) this.sairDoTime(a, `${A.nome} saiu do clã`); ctx.amigaSair(null, true); if (ctx.amiga) { this.jogadores.delete(ctx.amiga.id); ctx.amiga = null; ctx.amigaDono = null; } }
        continue;
      }
      const salvo = this.npcSalvos?.get(lid) || (this.lerNpc ? this.lerNpc(lid) : null) || {};
      const prog = progressoValido(null); if (salvo.prog?.hist) prog.hist = salvo.prog.hist; vestir(prog);
      (this.npcSalvos ||= new Map()).set(lid, { ...salvo, prog, zerado: 1, t: agora, ...this.marcasRecomeco(ctx.AMIGA) }); (this.npcsMudados ||= new Set()).add(lid);
    }
    // as bases (sua e dos clãs bot) e os seus terrenos somem
    for (const [lid, L] of [...(this.lotes || new Map())]) {
      if (!(bases.has(L.def?.baseK) || L.dono === j.conta)) continue;
      if (/^[ar]:/.test(String(L.dono))) { this.soltarLoteBot?.(L); continue; }
      this.lotes.delete(lid); this.lotesMudados?.delete(lid); this.lotesSoltos?.add(lid);
      this.evento({ t: 'lote', lote: lid, dono: null });
    }
    for (const M of [...(this.missoesCla?.values() || [])]) if (bases.has(M.k)) this.fimMissaoCla?.(M, false, 'partida resetada');
    if (this.basesCla) for (const k of bases) { delete this.basesCla[k]; if (this.basesDesenho) delete this.basesDesenho[k]; }
    this.evento({ t: 'meuLote', para: j.id, lote: '' });
    this.refazerSolidosLotes?.(); this.avisarBases?.();
    this.salvarClasNpc();
    j.progSujo = true; this.aplicarStatus(j, true); this.evento({ t: 'nivel', id: j.id, nivel: 1 }); this.avisarProg(j);
    this.evento({ t: 'aviso', para: id, texto: `Partida resetada: você, ${nomes.join(', ')} e os membros dos clãs no nível 1; todos os clãs (inimigos e neutros) no nível 1 sem recrutas` });
    return true;
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
    if (j?.prog?.cla) { // a conta do tempo fora (foraRecrutas) e onde cada recruta estava (lugarRecrutaAoEntrar)
      this.marcarTimeRecrutas(j); j.recrutasOk = false;
      j.prog.cla.saiu = Date.now(); j.progSujo = true;
      for (const x of this.recrutasNoMundo(j)) { const a = x.amiga, m = a && j.prog.cla.m.find((o) => o.id === x.AMIGA.id); if (m && !a.morto) m.pos = { x: Math.round(a.x * 10) / 10, z: Math.round(a.z * 10) / 10 }; }
    }
    // tem outro jogador online: eles ficam no mundo de verdade, fazendo a função (André 2026-11-23: "todos iguais", como os
    // recrutas dos clãs bot); saem só quando o servidor esvaziar (amigaSair do último jogador, shared/amiga.js)
    if (j?.prog?.cla && [...this.jogadores.values()].some((o) => !o.bot && o.id !== j.id)) {
      (this.clasFora ||= new Map()).set(j.conta, j.prog.cla); // a lista e as funções, para quem ficou (claDoRecruta)
      for (const ctx of this.recrutasNoMundo(j)) {
        const a = ctx.amiga; if (!a) continue;
        if (a.time) this.sairDoTime(a, `${ctx.AMIGA.nome} saiu do time`);
        ctx.amigaFalam?.delete(j.id); ctx.amigaDono = null;
        // volta para a função marcada no painel (André 2026-11-23: "eu dei time pra ele, vamos lá grindar... eu desloguei,
        // ele volta pro que eu tinha pedido pra ele fazer"); a ordem de voz ou de time vale só com o líder no jogo
        const m = j.prog.cla.m.find((o) => o.id === ctx.AMIGA.id);
        if (m && !a.morto) this.funcaoSemLider(ctx, a, m.fn || { k: 'livre' }, j);
      }
      return;
    }
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
      // o nível salvo vale (André 2026-11-24: depois do "Resetar partida" o clã ficava no Nv dos fixos ao religar o servidor);
      // save sem nível (antigo): conta os fixos e os recrutas, como antes
      const fora = Array.isArray(e?.fora) ? [...new Set(e.fora.filter((id) => C.membros.includes(id) && id !== C.lider))] : [];
      const fixos = fixosNpc(C, { fora }).length, nvC = Math.max(1, Math.min(CLA.max, (e?.nv | 0) || fixos + (v?.m.length || 0)));
      this.clasNpc[C.id] = { nv: nvC, m: v?.m.slice(0, vagasClaNpc(C, nvC, { fora })) || [], ...(fora.length ? { fora } : {}), prox: Number.isFinite(+e?.prox) ? +e.prox : Date.now() + CLAS_NPC_REGRAS.primeiro * 3600e3, sem: v?.sem || Date.now() + CLA.semana,
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
      const ctxs = this.amigosIa.filter((x) => x.amiga && (x.AMIGA.clanpc === C.id || (this.fixoClaNpc(x) && C.membros.includes(x.AMIGA.id))));
      const todos = [...E.m, ...this.membrosFixosNpc(C, E)], doM = (x) => todos.find((o) => o.id === x.AMIGA.id); // recrutas + membros antigos
      const temLote = !!this.loteDaConta(this.amigosIa.find((x) => x.AMIGA.id === C.lider)?.AMIGA.conta);
      E.m.forEach((m, i) => { if (!m.fn) { m.fn = this.funcaoBotCla(i, temLote); mudou = true; } });
      // o líder olha o clã e reparte as ordens pelo que falta (CLAS_NPC_ORDENS); quem mudou de ordem larga o que fazia
      const trocou = new Set();
      const cansou = ctxs.some((x) => doM(x)?.fn?.k === 'grind' && this.grindSobraBot(x, x.amiga) <= 0); // acabou a caça do dia: nova ordem já
      if (CLAS_NPC_ORDENS.ligado && (cansou || !(agora < (E.ordensT || 0)))) { E.ordensT = agora + CLAS_NPC_ORDENS.cada * 1000; for (const id of this.ordensLiderNpc(C, E, L, ctxs, temLote)) trocou.add(id); if (trocou.size) mudou = true; if (this.exigirRecursosNpc(C, E, L, ctxs)) mudou = true; }
      if (E.visto && !E.foraFeito) {
        E.foraFeito = true;
        const ms = Math.min(CLA.fora.max, agora - E.visto);
        if (ms >= CLA.fora.minimo) for (const x of ctxs) { const m = doM(x); if (m?.fn) this.trabalhoFora(x, m, ms / 3600e3, L.prog.nivel | 0); }
      }
      E.foraFeito = true;
      if (!E.visto || agora - E.visto > 600e3) { E.visto = agora; mudou = true; }
      for (const x of ctxs) { const m = doM(x); if (m?.fn) this.aplicarFuncao(L, x, m, trocou.has(m.id)); }
      this.missaoClaNpc?.(C, L, ctxs); // Escolta do Clã: o clã bot faz a dele também (shared/missao-cla.js)
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
      if (E.m.length >= vagasClaNpc(C, E.nv, E) && CLA.niveis[(E.nv || 1) + 1]) {
        this.fundirBauNpc(E);
        const r = this.subirCla({ nv: E.nv || 1, nvLider: L.prog.nivel | 0, raca: C.raca, ouro: (L.prog.ouro | 0) - R.reserva, fontes: [E.bau || [], L.prog.mochila] }); // e a mochila do líder, como no clã do jogador (André 2026-11-23)
        if (!r.falta) { L.prog.ouro -= r.N.ouro; r.tirar(); E.nv = r.N.nv; mudou = true;
          for (const o of this.jogadores.values()) if (!o.bot) this.evento({ t: 'aviso', para: o.id, texto: `${C.n} subiu para o Nv ${E.nv}` }); }
      }
      // a mesma regra do jogador (regraRecrutar, candidatosRecrutar): o que é só do bot é a decisão (quando: a cada R.entre h;
      // quanto guarda: R.reserva; qual tier: o melhor que o ouro paga; qual candidato: escolhaLider)
      const ocupadas = E.m.length + fixosNpc(C, E).length;
      if (agora >= E.prox && !regraRecrutar(E.nv, ocupadas, CLA.tiers[0])) {
        E.prox = agora + R.entre * 3600e3; mudou = true;
        const nv = L.prog.nivel | 0, livre = (L.prog.ouro | 0) - R.reserva;
        const T = [...CLA.tiers].reverse().find((T) => !regraRecrutar(E.nv, ocupadas, T) && precoTier(T, nivelTier(T, nv)) <= livre);
        if (T) {
          // o líder bot também vê FICHA_RECRUTA.candidatos e escolhe pelo jeito dele (escolhaLider); outro líder: sorteio
          const l = candidatosRecrutar(T, nv, agora), q = FICHA_RECRUTA.escolhaLider[C.lider];
          const m = q ? l.reduce((b, r) => (r.lu[q] > b.lu[q] ? r : b)) : l[Math.floor(Math.random() * l.length)];
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
  // as marcas de recomeço do bot no save novo (sem elas, amigaEntrar acharia que o recomeço não foi feito e zeraria o save)
  marcasRecomeco(A) { return { ...(A?.recomeco ? { recomeco: A.recomeco } : {}), ...(A?.recomecoJogo ? { recomecoJogo: A.recomecoJogo } : {}) }; },
  // o líder bot faz o que o jogador faria na fornalha: 3 minérios de ferro viram 1 barra, 2 barras viram 1 de aço
  fundirBauNpc(E) {
    const b = E.bau; if (!b) return;
    const f = Math.floor(contar(b, 'minerio_ferro') / 3); if (f) { tirar(b, 'minerio_ferro', f * 3); guardarQueCabe(b, { k: 'barra_ferro', n: f }); }
    const a = Math.floor(Math.max(0, contar(b, 'barra_ferro') - 30) / 2); if (a) { tirar(b, 'barra_ferro', a * 2); guardarQueCabe(b, { k: 'barra_aco', n: a }); }
  },
  // o líder bot exige os recursos (André 2026-11-24: "o líder pode e deve exigir recursos e vender para obter ouro o que
  // não precisar para upgrade, mas não pedir ouro direto dos recrutas"). A cada rodada de ordens ele recolhe das bolsas dos
  // membros os materiais de clã (CLAS_NPC_ORDENS.exigir.itens e o Fragmento de Alma que o clã usa) para o Baú do Clã; o
  // ouro deles fica com eles. Do baú, guarda o que os próximos `niveis` níveis do clã pedem e vende o resto: o ouro vai
  // para o líder (que paga as semanas, contrata e sobe o clã). Devolve true se mexeu.
  exigirRecursosNpc(C, E, L, ctxs) {
    const X = CLAS_NPC_ORDENS.exigir; if (!X?.ligado || !L) return false;
    const b = (Array.isArray(E.bau) ? E.bau : (E.bau = Array(CLA.bauCla).fill(null))), alma = almaDe(C.raca);
    const pega = new Set([...X.itens, alma]);
    let mexeu = false;
    for (const x of ctxs) {
      const a = x.amiga; if (!a || a.morto || x.AMIGA.id === C.lider) continue;
      const mo = a.prog?.mochila || []; let deu = false;
      for (let i = 0; i < mo.length; i++) {
        const o = mo[i]; if (!o || o.h || !pega.has(o.k)) continue; // o.h: travado (cadeado), como em contar/tirar
        const n = o.n || 1, q = guardarQueCabe(b, { k: o.k, n }); if (!q) continue; // baú cheio: fica com ele
        mo[i] = q >= n ? null : { ...o, n: n - q }; deu = true;
      }
      if (deu) { mexeu = true; x.guardarAmiga?.(); }
    }
    // o que guardar: o maior pedido de cada material nos próximos níveis (aço conta também como barra e minério de ferro,
    // que a fornalha do líder transforma: fundirBauNpc). Alma nunca vende (não tem preço e o clã sempre precisa).
    const fica = { [alma]: Infinity }, nv = E.nv || 1, max = (k, q) => { fica[k] = Math.max(fica[k] || 0, q); };
    for (let n = nv + 1; n <= nv + X.niveis; n++) {
      const N = CLA.niveis[n]; if (!N) break;
      for (const [k, q] of Object.entries(N.mat || {})) {
        max(k, q);
        if (k === 'barra_ferro') max('minerio_ferro', q * 3);
        if (k === 'barra_aco') { max('barra_ferro', 30 + q * 2); max('minerio_ferro', (30 + q * 2) * 3); }
      }
    }
    let ouro = 0;
    for (const k of pega) {
      const sobra = contar(b, k) - (fica[k] || 0), preco = ITENS[k]?.venda | 0;
      if (!(sobra > 0) || !(preco > 0)) continue;
      tirar(b, k, sobra); ouro += sobra * preco; mexeu = true;
    }
    if (ouro > 0) L.prog.ouro = (L.prog.ouro | 0) + ouro;
    return mexeu;
  },
  // ---------- o líder bot comanda (André 2026-11-23, CLAS_NPC_ORDENS) ----------
  // André 2026-11-23 ("existisse um líder e os outros fossem considerados recrutas também... não é para ser fixo"): os
  // membros antigos (Kira, Rufo, Lis; Cecília, Lia) obedecem ao líder como os recrutas. Guardam nome, nível, itens e jeito.
  // dá para ter esse bot na lista de amigos? (AMIGOS.soLideres: só o líder de clã bot da raça do jogador)
  amigoBotOk(x, j) { return !AMIGOS.soLideres || CLAS_NPC.some((C) => C.lider === x?.AMIGA?.id && C.raca === this.racaDe(j)); },
  fixoClaNpc(x) { const A = x?.AMIGA; return !!A && !A.recruta && CLAS_NPC_ORDENS.ligado && CLAS_NPC.some((C) => C.lider !== A.id && C.membros.includes(A.id)) && !this.fixoForaNpc(A.id); },
  // membro fixo fora do clã (depois do "Resetar partida", até o líder recrutar de novo): sem corpo no mundo
  fixoForaNpc(id) { return CLAS_NPC.some((C) => this.clasNpc?.[C.id]?.fora?.includes(id)); },
  claBotDe(x) { const A = x?.AMIGA; if (!A) return null; if (A.clanpc) return CLAS_NPC.find((o) => o.id === A.clanpc) || null; return this.fixoClaNpc(x) ? CLAS_NPC.find((C) => C.membros.includes(A.id)) : null; },
  // o registro de cada membro antigo no clã (função dada pelo líder), como o de um recruta (E.m); guardado em E.fx
  membrosFixosNpc(C, E) {
    if (!CLAS_NPC_ORDENS.ligado) return [];
    const fx = (E.fx ||= {}), nome = (id) => [...AMIGOS_VIRTUAIS, ...RIVAIS].find((d) => d.id === id)?.nome || id;
    return fixosNpc(C, E).map((id) => (fx[id] ||= { id, nome: nome(id), fixo: 1 }));
  },
  // grind de clã bot com o mundo vazio: as horas que sobram da caça do dia (horasDia), abatesHora x o XP real de um bicho
  // do campo que ele escolheria (a curva do jogo: no Nv alto quase nada), sem passar do nível do líder
  grindForaBot(x, m, h, teto) {
    const a = x.amiga, nv = a.prog.nivel | 0, tipoDe = (c) => (c.tipos || []).find((t) => t !== 'chefe' && t !== 'warrok') || c.bicho || 'lobo';
    const xpDe = (c) => xpDoInimigo(tipoDe(c), c.nivel || 1, nv, NIVEL_INIMIGO);
    // o campo sai sorteado como no mundo (campoAmiga); das 3 tentativas, o que dá mais XP (ele escolheria o melhor)
    const c = [0, 1, 2].map(() => x.campoAmiga?.(a)).filter(Boolean).sort((p, q) => xpDe(q) - xpDe(p))[0]; if (!c) return null;
    const horas = Math.min(h, this.grindSobraBot(x, a) / 3600); if (!(horas > 0)) return null;
    a.grind.seg += horas * 3600;
    const antes = nv, tipo = tipoDe(c);
    for (let n = Math.round(CLAS_NPC_ORDENS.abatesHora * horas); n > 0 && (a.prog.nivel | 0) < teto; n -= 10)
      this.ganharXP(a, Math.min(n, 10) * xpDoInimigo(tipo, c.nivel || 1, a.prog.nivel | 0, NIVEL_INIMIGO));
    if ((a.prog.nivel | 0) > teto) a.prog.nivel = teto;
    m.nv = a.prog.nivel | 0; x.guardarAmiga?.();
    return a.prog.nivel > antes ? `${m.nome}: caçou e foi do Nv ${antes} ao ${a.prog.nivel}` : null;
  },
  // segundos de caça que ainda sobram hoje para um recruta de clã bot (o mesmo contador do grind: grindHojeAmiga)
  grindSobraBot(x, a) { return Math.max(0, CLAS_NPC_ORDENS.horasDia * 3600 - x.grindHojeAmiga(a)); },
  // o que falta para o próximo nível do clã: { recurso: fração que falta (0..1) }, alma inclusive
  faltaClaNpc(C, E, L) {
    const N = CLA.niveis[(E.nv || 1) + 1], f = {}; if (!N) return f;
    const tem = (k) => contar(E.bau || [], k) + contar(L?.prog?.mochila || [], k);
    for (const [k, q] of Object.entries(N.mat || {})) {
      const r = CLAS_NPC_ORDENS.mat[k]; if (!r || !RECURSOS_CLA[r]) continue;
      let t = tem(k); if (k === 'barra_ferro') t += tem('minerio_ferro') / 3; if (k === 'barra_aco') t += tem('barra_ferro') / 2 + tem('minerio_ferro') / 6;
      const fr = Math.max(0, 1 - t / q); if (fr > 0) f[r] = Math.max(f[r] || 0, fr);
    }
    if (N.alma) { const fr = Math.max(0, 1 - tem(almaDe(C.raca)) / N.alma); if (fr > 0) f.alma = fr; }
    return f;
  },
  // inimigo da outra raça perto da base do clã (ou do líder, sem base)
  ameacaClaNpc(C, L) {
    const B = this.baseDoClaNpc?.(C) || L; if (!B) return false;
    for (const o of this.jogadores.values()) if (!o.morto && !o.criando && this.racaDe(o) && this.racaDe(o) !== C.raca && Math.hypot(o.x - B.x, o.z - B.z) < CLAS_NPC_ORDENS.raioBase) return true;
    return false;
  },
  // reparte as ordens: para cada recruta, a função de maior peso (necessidade x personalidade x sorte). Devolve os ids
  // que mudaram de função. rnd: para os testes
  ordensLiderNpc(C, E, L, ctxs, temLote, rnd = Math.random) {
    const O = CLAS_NPC_ORDENS, P = { grind: 1, alma: 1, recurso: 1, fazenda: 1, proteger: 1, ...(O.pesos[C.lider] || {}) };
    const falta = this.faltaClaNpc(C, E, L), ameaca = this.ameacaClaNpc(C, L), nvL = L.prog.nivel | 0, mudou = [];
    const sorte = () => 1 + (rnd() * 2 - 1) * O.sorte;
    let fazenda = false, protege = 0;
    for (const m of [...E.m, ...this.membrosFixosNpc(C, E)]) {
      const x = ctxs.find((o) => o.AMIGA.id === m.id), a = x?.amiga; if (!a || a.morto) continue;
      const cota = this.grindSobraBot(x, a) > 0, fraco = (a.prog.nivel | 0) <= nvL - O.abaixo, vigor = vigorDe(a.prog.vigor) >= 1;
      const op = [];
      if (cota) op.push([{ k: 'grind' }, (fraco ? 1 : 0.35) * P.grind]);
      for (const [r, fr] of Object.entries(falta)) {
        if (r === 'alma') { op.push([{ k: 'recurso', r: 'alma' }, fr * P.alma]); continue; }
        if (vigor) op.push([{ k: 'recurso', r }, fr * P.recurso]);
      }
      op.push([{ k: 'proteger', p: 'lider' }, (ameaca ? 1.5 / (1 + protege) : 0.1) * P.proteger]);
      if (temLote && !fazenda) op.push([{ k: 'fazenda', s: 'cenoura' }, 0.4 * P.fazenda]);
      let best = null, bp = -1;
      for (const [fn, p] of op) { const v = p * sorte(); if (v > bp) { bp = v; best = fn; } }
      if (!best) continue;
      if (best.k === 'fazenda') fazenda = true;
      if (best.k === 'proteger') protege++;
      if (best.k === 'recurso' && falta[best.r]) falta[best.r] *= 0.5; // o próximo vê que esse já tem gente
      if (JSON.stringify(best) !== JSON.stringify(m.fn || null)) { m.fn = best; mudou.push(m.id); }
    }
    return mudou;
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
    return CLAS_NPC.map((C) => ({ n: C.n, nv: this.clasNpc[C.id].nv || 1, lider: nome(C.lider), inimigo: this.racaDe(j) !== C.raca ? 1 : 0, raca: RACAS[C.raca]?.nome || C.raca, recrutas: fixosNpc(C, this.clasNpc[C.id]).length + this.clasNpc[C.id].m.length, // os fixos contam (André 2026-11-22), os de fora não
      membros: [...fixosNpc(C, this.clasNpc[C.id]).map(nome), ...this.clasNpc[C.id].m.map((m) => `${m.nome} (${tierDe(m.tier).nome} Nv ${m.nv}${m.fn ? ' · ' + (CLA.funcoes.find((F) => F.id === m.fn.k)?.nome || '') : ''})`)] }));
  },
};

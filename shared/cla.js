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
import { ARVORES_PLANTIO, PLANTIO, naBaseCla, VOLTA_VILA, LIDERES_CLA, CLA, ENCOMENDA, FERRAMENTAS_FAZENDA, PROFISSOES, VIGOR, COLETA, PLANTAS, HORTA, ITENS, LOJA, fasePlanta, defRecruta, nomeValido, CLAS_NPC, CLAS_NPC_REGRAS, CLAS_NPC_ORDENS, LEILAO_BOT, vagasClaNpc, fixosNpc, almaDe, defRecrutaNpc, FICHA_RECRUTA, sortearLuta, fichaLuta, fichaInfo, AMIGOS_VIRTUAIS, RIVAIS, RACAS, DROPS, NPC_VIDA, NIVEL_INIMIGO, AMIGOS, DESPENSA, BASES_FRIAS, MORAL, PESCA, CASA_OBRA } from './dados.js';
import { contextoDeAmigo, pecaDaCasa, mesmaPeca } from './amiga.js';
import { profNivel, guardar, guardarQueCabe, moverQtd, profBonus, bonusTituloProf, xpProximo, xpDoInimigo, contar, tirar, organizar, progressoValido, liberarPaginas, calcularStatus, passivasDe } from './progresso.js';
import { fundoAgua } from './transporte.js';
import { liberado, motivoLibera } from './historia.js';
import { LUGARES_MUNDO } from './mundo.js';
import { lugarNoQuadrado, areaPlantio, QUADRADOS_PLANTIO } from './plantio.js'; // Fazenda > árvores (só as contas da grade)
import { crescerPlanta } from './simulacao.js'; // só usadas em tempo de jogo (progresso.js também importa daqui)
// lugares ocupados/total de uma mochila ou baú (André 2026-11-24: "40/60 lá no site")
const lugares = (l) => [l.filter(Boolean).length, l.length];

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
  if (fn.k === 'arvores') return { k: 'arvores', s: ARVORES_PLANTIO[fn.s] ? fn.s : 'betula' }; // Plantar árvores (André 2026-11-25)
  if (fn.k === 'proteger') return fn.p === 'lider' || fn.p === 'carrinho' || fn.p === 'mercante' || (typeof fn.p === 'string' && /^rc[a-z0-9]{4,16}$/.test(fn.p)) ? { k: 'proteger', p: fn.p } : null;
  return { k: fn.k };
}
// Proteger carrinho / mercante (André 2026-11-23): o nome que aparece no aviso e no painel
const VEIC_PROTEGE = { carrinho: 'o carrinho', mercante: 'o mercante' };
// nome do que a Fazenda planta: planta da horta ou árvore (André 2026-11-25)
// as sementes da Fazenda (horta) e as do Plantar árvores, para o menu do clã e o painel
const plantasFazenda = () => Object.entries(PLANTAS).map(([k, P]) => ({ k, nome: P.nome }));
const arvoresCla = () => Object.entries(ARVORES_PLANTIO).map(([k, T]) => ({ k, nome: T.nome, h: T.h }));
const nomeFazenda = (s) => (PLANTAS[s] || ARVORES_PLANTIO[s])?.nome?.toLowerCase() || '';
const cor = (v) => (Number.isInteger(v) && v >= 0 && v <= 0xffffff ? v : 0x888888);

// confere o que veio da conta (progressoValido)
export function claValido(c) {
  if (!c || typeof c !== 'object' || Array.isArray(c)) return null;
  const n = nomeCla(c.n); if (!n) return null;
  const out = { ...(Number.isFinite(+c.saiu) && +c.saiu > 0 ? { saiu: Math.round(+c.saiu) } : {}), n, c: int(c.c, 0, 9e15, Date.now()), cofre: int(c.cofre, 0, 1e9, 0), sem: int(c.sem, 0, 9e15, 0), m: [], log: [] };
  for (const m of Array.isArray(c.m) ? c.m.slice(0, CLA.max) : []) {
    if (!m || typeof m.id !== 'string' || !/^rc[a-z0-9]{4,16}$/.test(m.id) || out.m.some((o) => o.id === m.id)) continue;
    out.m.push(membroValido(m));
  }
  // dispensados há pouco (André 2026-11-24: "você tem até 10 minutos para chamar ele de volta pagando uma taxa"): o
  // registro inteiro fica guardado até 'ate'; depois disso some
  const agoraD = Date.now(), disp = [];
  for (const d of Array.isArray(c.disp) ? c.disp.slice(-CLA.max) : []) {
    const m = d?.r, ate = +d?.ate;
    if (!m || typeof m.id !== 'string' || !/^rc[a-z0-9]{4,16}$/.test(m.id) || !(ate > agoraD) || out.m.some((o) => o.id === m.id) || disp.some((o) => o.r.id === m.id)) continue;
    disp.push({ r: membroValido(m), ate: Math.round(ate) });
  }
  if (disp.length) out.disp = disp;
  for (const L of Array.isArray(c.log) ? c.log.slice(-CLA.log) : []) if (L && typeof L.txt === 'string') out.log.push({ t: int(L.t, 0, 9e15, 0), txt: L.txt.slice(0, 80), v: int(L.v, -1e9, 1e9, 0) });
  // nível do clã (vagas): clã de antes começa no nível que cabe quem ele já tem (nada some)
  out.nv = Math.max(int(c.nv, 1, CLA.max, 1), Math.min(CLA.max, out.m.length), 1);
  const dsp = despensaValida(c.dsp); if (dsp) out.dsp = dsp; // Despensa e lenha (DESPENSA)
  if (typeof c.jd === 'string' && /^\d{4}-\d\d-\d\d$/.test(c.jd)) out.jd = c.jd; // o dia (Brasília) do último jantar do clã (shared/jantar.js)
  if (Number.isFinite(+c.vis) && +c.vis > 0 && +c.vis < 9e15) out.vis = Math.round(+c.vis); // a última vez do líder no jogo (MORAL)
  return out;
}
// o estado da despensa salvo no clã: t: ms da última hora contada; d: rações devendo (ou de sobra, negativo); fome: ms
// em que a comida acabou; l: ms da próxima lenha da semana; lf: lenha devendo; frio: ms em que a lenha faltou
export function despensaValida(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return null;
  const ms = (v) => (Number.isFinite(+v) && +v > 0 && +v < 9e15 ? Math.round(+v) : 0);
  const o = { t: ms(d.t), d: Number.isFinite(+d.d) ? Math.max(-50, Math.min(9999, +d.d)) : 0 };
  if (ms(d.fome)) o.fome = ms(d.fome);
  if (ms(d.l)) o.l = ms(d.l);
  if (Number.isFinite(+d.lf) && +d.lf > 0) o.lf = Math.min(9999, Math.round(+d.lf));
  if (ms(d.frio)) o.frio = ms(d.frio);
  return o;
}
// rações por dia de um clã com n moradores (DESPENSA.porDia, +extra.por cada um depois do extra.de)
export const racoesDia = (n) => n * DESPENSA.porDia * (1 + Math.max(0, n - DESPENSA.extra.de) * DESPENSA.extra.por);
// o que a despensa (o Baú do Clã) tem de comida: { racoes, tipos, k: { item: n } }
export function estoqueDespensa(itens) {
  const k = {}; let racoes = 0;
  for (const o of itens || []) { const r = o && !o.h && DESPENSA.racao[o.k]; if (!r) continue; k[o.k] = (k[o.k] | 0) + (o.n || 1); racoes += r * (o.n || 1); }
  return { racoes, tipos: Object.keys(k).length, k };
}
// lenha da semana da base no nível nv
export const lenhaSemana = (nv) => DESPENSA.lenha[Math.max(0, Math.min(DESPENSA.lenha.length - 1, nv | 0))] | 0;
function membroValido(m) {
  const P = CLA.penteados;
  const g = m.g === 'm' ? 'm' : 'f', ap = m.ap && typeof m.ap === 'object' ? m.ap : {};
    return { id: m.id, nome: nomeValido(m.nome) || 'Recruta', g, tier: CLA.tiers.some((T) => T.id === m.tier) ? m.tier : 'recruta',
      ap: { cabelo: cor(ap.cabelo), olhos: cor(ap.olhos), pele: cor(ap.pele), roupa: cor(ap.roupa), calca: cor(ap.calca),
        altura: Math.max(CLA.altura[0], Math.min(CLA.altura[1], +ap.altura || 1)), penteado: P[g].includes(ap.penteado) ? ap.penteado : null },
      jeito: CLA.jeitos.includes(m.jeito) ? m.jeito : CLA.jeitos[0], gosto: CLA.gostos.includes(m.gosto) ? m.gosto : 'cacar',
      lu: fichaLuta(m), // a ficha (FICHA_RECRUTA); recruta de antes ganha a sorteada pelo id
      nv0: int(m.nv0, 1, 200, 1), nv: int(m.nv, 1, 200, 1), desde: int(m.desde, 0, 9e15, 0), ...(Number.isFinite(+m.dev) && +m.dev > 0 ? { dev: Math.round(+m.dev) } : {}), ...(funcaoValida(m.fn) ? { fn: funcaoValida(m.fn) } : {}),
      ...(m.pos && Number.isFinite(+m.pos.x) && Number.isFinite(+m.pos.z) && Math.abs(+m.pos.x) < 1e5 && Math.abs(+m.pos.z) < 1e5 ? { pos: { x: +m.pos.x, z: +m.pos.z } } : {}), // onde estava quando o líder saiu
      ...moralValida(m) }; // moral (MORAL)
}
// a moral salva no membro: mo (0 a 100), mt: ms da última conta, ot: ms em que começou a trabalhar sem descanso, el: último elogio
export function moralValida(m) {
  const ms = (v) => (Number.isFinite(+v) && +v > 0 && +v < 9e15 ? Math.round(+v) : 0), o = {};
  if (Number.isFinite(+m?.mo)) o.mo = Math.max(0, Math.min(100, Math.round(+m.mo * 100) / 100));
  for (const k of ['mt', 'ot', 'el', 'desc']) if (ms(m?.[k])) o[k] = ms(m[k]); // desc: clã bot, descansando até
  return o;
}
// ---------- moral dos recrutas (MORAL, André 2026-11-25) ----------
// a moral de agora sem mexer em nada: o que passou desde m.mt (Livre sobe; 3 h seguidas trabalhando e 12 h sem o líder
// no jogo descem). vis: ms da última vez que o líder esteve no jogo (null: não conta). fn: a ordem (m.fn).
export function moralAgora(m, vis, agora = Date.now()) {
  const M = MORAL, H = 3600e3, t0 = m?.mt || agora;
  let v = Number.isFinite(m?.mo) ? m.mo : M.inicio;
  if (!M.ligado || agora <= t0) return v;
  if (!m.fn || m.fn.k === 'livre') v += M.livreH * (agora - t0) / H;
  else if (m.fn.k !== 'seguir') { const s = Math.max(t0, (m.ot || t0) + M.cansaH * H); if (agora > s) v -= M.cansaPorH * (agora - s) / H; }
  if (vis) { const s = Math.max(t0, vis + M.graca * H); if (agora > s) v -= M.semLiderH * (agora - s) / H; }
  return Math.max(0, Math.min(100, v));
}
// a faixa da moral: { nome, rende, seta, cor }
export function faixaMoral(v) { return MORAL.faixas.find((F) => v >= F.de) || MORAL.faixas[MORAL.faixas.length - 1]; }
// conta a moral até agora e guarda (perto: o líder no jogo perto dele nesse tempo; extra: elogio)
export function passarMoral(m, vis, perto, agora = Date.now(), extra = 0) {
  if (!MORAL.ligado) return m.mo ?? MORAL.inicio;
  const dt = Math.min(180e3, Math.max(0, agora - (m.mt || agora))); // o perto só conta o passo (a volta de 1 min), nunca horas
  // os ganhos não somam (André 2026-11-25: "deixei ele livre e dei time para ele... não vai se sobrepor os dois bônus"):
  // perto do líder vale o maior (perto), no lugar do Livre
  const livre = !m.fn || m.fn.k === 'livre';
  let v = moralAgora(m, vis, agora) + (perto ? (MORAL.pertoH - (livre ? MORAL.livreH : 0)) * dt / 3600e3 : 0) + extra;
  m.mo = Math.round(Math.max(0, Math.min(100, v)) * 100) / 100; m.mt = agora;
  // trocar de ordem não é descanso: só o Livre zera. Me seguir (está com o líder) não cansa
  if (livre || m.fn.k === 'seguir') delete m.ot; else m.ot ||= agora;
  return m.mo;
}
const COLETA_ORDEM = ['minerar', 'lenha', 'pescar']; // ordens que gastam vigor (sem vigor: Livre até voltar)
// produção da ordem por hora (MORAL.prod): o que entrou na mochila (recurso) ou monstros mortos (grind), medido a cada minuto
const contarRecProd = (l, item) => (item === 'peixe' ? (l || []).reduce((s, o) => s + (o && ITENS[o.k]?.peixe && !o.cad ? o.n || 1 : 0), 0) : contar(l || [], item));
export function iconeProd(fn) { const R = fn?.k === 'recurso' && RECURSOS_CLA[fn.r]; return fn?.k === 'grind' ? 'espada' : R?.item ? (R.item === 'peixe' ? 'tilapia' : R.item) : null; }
// a taxa para chamar de volta um dispensado (metade do preço de contratar de novo no nível de agora, mínimo 50)
export function taxaVolta(m, nv) { const T = tierDe(m.tier); return Math.max(CLA.volta.min, Math.round(precoTier(T, nv || m.nv || 1) * CLA.volta.parte)); }
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
  // tem gente de verdade no servidor (fora exceto): um jogador com corpo ou um painel do clã aberto (página leve, André
  // 2026-11-24: "quando eu deixasse ele aberto, os meus bots contariam como se eu estivesse online")
  genteOnline(exceto = null) {
    for (const o of this.jogadores.values()) if (!o.bot && o.id !== exceto) return true;
    for (const k of this.paineis?.keys() || []) if (k !== exceto) return true;
    return false;
  },
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
    const nv = j.prog.nivel | 0, eM = this.estadoDespensa(c.dsp, this.bauDoCla({ conta: j.conta })?.itens || null, 1 + c.m.length);
    // status de cada um (André 2026-11-22: "eu consigo ver nível Hp mana e vigor"): vida, mana e vigor (0 a 100)
    const st = (o, prog) => ({ hp: Math.round(o.vida) | 0, hpM: Math.round(o.vidaMax) | 0, mp: Math.round(o.mana) | 0, mpM: Math.round(o.manaMax) | 0, vg: Math.floor(vigorDe(prog.vigor)), vgM: prog.vigor?.m || VIGOR.max, morto: o.morto ? 1 : 0 });
    return { n: c.n, cofre: c.cofre, semana: semanaCla(c), prox: Math.max(0, c.sem - Date.now()), max: c.nv || 1, nv: c.nv || 1, sobe: this.subirInfo(j), perto: this.pertoRecrutador(j),
      eu: { nome: j.nome, nv, ...st(j, j.prog) },
      m: c.m.map((m) => { const a = vivos.get(m.id); return { id: m.id, nome: m.nome, tier: tierDe(m.tier).nome, nv: a ? a.prog.nivel | 0 : m.nv, sem: semanaDe(tierDe(m.tier), a ? a.prog.nivel | 0 : m.nv), on: a ? 1 : 0, ...(m.dev ? { dev: m.dev } : {}), g: m.g,
        ...this.moralInfo(m, c.vis, eM, a, j), // moral e produção (MORAL): seta + % e ~N/h
        fn: m.fn || { k: 'livre' }, c: 'r:' + m.id, ...(a ? { ...st(a, a.prog), ...this.fzRecruta(a, j), x: Math.round(a.x), z: Math.round(a.z), bid: a.id, ...(a.time && a.time === j.time ? { time: 1 } : {}) } : {}) }; }), // x, z: "Ver no mapa"; c: conta (Mensagem), bid: o corpo (Time)
      bauCla: temBau ? bau : null, plantas: plantasFazenda(), arvores: arvoresCla(),
      veic: { carrinho: this.carrinhoFora(j, { k: 'carrinho' }) ? 1 : 0, mercante: this.navioFora(j) ? 1 : 0 }, // Proteger carrinho / mercante: apagado se não está no mundo
      funcoes: CLA.funcoes, recursos: Object.entries(RECURSOS_CLA).map(([k, R]) => ({ k, nome: R.nome })),
      tiers: CLA.tiers.map((T) => { const n2 = nivelTier(T, nv); return { id: T.id, nome: T.nome, nv: n2, preco: precoTier(T, n2), sem: semanaDe(T, n2), claNv: T.claNv || 1 }; }),
      ...(c.disp?.some((d) => d.ate > Date.now()) ? { disp: c.disp.filter((d) => d.ate > Date.now()).map((d) => ({ id: d.r.id, nome: d.r.nome, nv: d.r.nv, taxa: taxaVolta(d.r) })) } : {}), // chamar de volta (10 min)
      dsp: this.despensaInfo(c.dsp, this.bauDoCla({ conta: j.conta })?.itens || null, 1 + c.m.length, Bs), // Despensa e lenha (DESPENSA)
      gu: this.guerraInfo?.(j, c.m.map((m) => vivos.get(m.id) || { nome: m.nome, prog: this.npcSalvos?.get(m.id)?.prog || null })) || null, // Patente de Guerra: aba Guerra (shared/patente.js)
      rec, log: c.log.slice(-10).reverse(), dep: CLA.deposito, clas: this.clasNpcInfo(j), base: this.baseInfo?.(j) || null, jantar: this.jantarResumo?.(j) || null,
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
    if (m.acao === 'elogiar') return this.elogiarRecruta(j, String(m.id || '')); // moral (MORAL)
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
      const b = this.recrutasNoMundo(j).find((o) => o.AMIGA.id === r.id)?.amiga; if (b?.prog) r.nv = b.prog.nivel | 0 || r.nv; // o nível de agora (a taxa)
      this.tirarRecruta(r.id, j);
      // André 2026-11-24: 10 minutos para chamar de volta pagando uma taxa (o save dele, 'npc:' + id, fica como estava)
      c.disp = [...(c.disp || []).filter((d) => d.ate > agora && d.r.id !== r.id), { r, ate: agora + CLA.volta.min10 * 60e3 }].slice(-CLA.max);
      this.logCla(c, `Dispensou ${r.nome}`);
      aviso(`${r.nome} saiu do clã. Você tem ${CLA.volta.min10} minutos para chamar de volta (${taxaVolta(r)} de ouro)`);
      this.baseDoClaMudou(j);
      return this.avisarProg(j);
    }
    // chamar de volta quem foi dispensado há menos de 10 minutos (André 2026-11-24), pagando a taxa da bolsa
    if (m.acao === 'chamarVolta') {
      c.disp = (c.disp || []).filter((d) => d.ate > agora);
      const k = c.disp.findIndex((d) => d.r.id === m.id);
      if (k < 0) { j.progSujo = true; aviso('Passou o tempo: esse recruta já foi embora'); return this.avisarProg(j); }
      const r = c.disp[k].r, taxa = taxaVolta(r);
      if (c.m.length >= (c.nv || 1)) return aviso('O clã está sem vaga: dispense outro ou melhore o clã');
      if ((j.prog.ouro | 0) < taxa) return aviso(`Falta ouro: chamar ${r.nome} de volta custa ${taxa}`);
      j.prog.ouro -= taxa; c.disp.splice(k, 1); if (!c.disp.length) delete c.disp;
      delete r.pos; c.m.push(r); j.progSujo = true;
      this.logCla(c, `Chamou ${r.nome} de volta`, -taxa);
      aviso(`${r.nome} voltou para o clã!`);
      this.entrarRecrutas(j, r.id);
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
      aviso(`${r.nome}: ${F.nome}${fn?.k === 'fazenda' ? (fn.s ? ` (plantar ${nomeFazenda(fn.s)})` : ' (só colhe e rega)') : fn?.k === 'arvores' ? ` (${nomeFazenda(fn.s)})` : fn?.k === 'recurso' ? ` (${RECURSOS_CLA[fn.r].nome})` : fn?.k === 'proteger' ? ` ${fn.p === 'lider' ? 'você' : VEIC_PROTEGE[fn.p] || c.m.find((o) => o.id === fn.p).nome}` : ''}`);
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
    if (m.acao === 'jantar') return this.jantarAcao(j, m, aviso); // jantar do clã na Mesa do Clã (shared/jantar.js)
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
  // a linha do que ele faz + desde quando (André 2026-11-26: "adiciona nas msg a qtd minutos/hrs"): fzT = ms de quando a
  // linha mudou pela última vez (o app mostra "há 5 min")
  fzRecruta(a, j) {
    const fz = this.fazendoRecruta(a, j);
    if (a._fz !== fz) { a._fz = fz; a._fzT = Date.now(); }
    return { fz, fzT: a._fzT };
  },
  // o que ele está fazendo agora (linha curta no painel)
  fazendoRecruta(a, j) {
    const ia = a.ia;
    if (a.morto) return 'Caído';
    if (this.levandoRecruta(a)) return `Levando ${ia.levar.nome} ao Baú do Clã`;
    if (ia.funcaoSt && ia.funcaoSt.ate > this.tempo) return ia.funcaoSt.txt;
    if (a.time && a.time === j.time) return 'No seu time';
    if (ia.funcao?.k === 'proteger') return VEIC_PROTEGE[ia.funcao.p] ? (ia.pv?.sem ? `Esperando ${VEIC_PROTEGE[ia.funcao.p]}` : `Protegendo ${VEIC_PROTEGE[ia.funcao.p]}`) : 'Protegendo';
    if (ia.funcao?.k === 'fazenda') return 'Na fazenda';
    if (ia.funcao?.k === 'arvores') return 'Plantando árvores';
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
    ia.funcao = fn.k === 'proteger' || fn.k === 'fazenda' || fn.k === 'arvores' ? fn : null;
    if (novo) ia.arv = null;
    // só o recurso pedido vai para o Baú do Clã, e ele leva andando (André 2026-11-23: "n quero q vá nada somente qd eu
    // solicitar... queria q ele trouxesse n q fosse direto pro baú auto"). O resto fica na bolsa dele.
    ia.levar = fn.k === 'recurso' && RECURSOS_CLA[fn.r]?.item ? { r: fn.r, item: RECURSOS_CLA[fn.r].item, nome: RECURSOS_CLA[fn.r].nome } : null;
    const treino = fn.k === 'recurso' && !j.bot && this.treinoRecruta(a, fn.r); // sem nível para o pedido: treina no que já dá (só clã de jogador; os clãs bot seguem como estão)
    if (treino) ia.levar = { r: treino, item: RECURSOS_CLA[treino].item, nome: RECURSOS_CLA[treino].nome };
    if (novo) {
      ia.funcaoSt = null; ia.faz = null; ia.fazFer = null; ia.avisou = null;
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
      if (!j.bot && ['minerar', 'lenha', 'pescar'].includes(R.coleta) && vigorDe(a.prog.vigor) < 1) { // sem vigor: modo livre até voltar (André 2026-11-24)
        this.avisarLiderRecruta(x, j, 'vigor', 'Acabou meu vigor. Vou fazer minhas coisas e, quando ele voltar, volto pro trabalho.');
        if (!a.ia.av || a.ia.av.encomenda) avisa('Sem vigor: no modo livre até o vigor voltar');
        return;
      }
      if (ia.avisou === 'vigor') ia.avisou = null;
      { const fp = this.semPescaRecruta(a, R); if (fp) { this.avisarLiderRecruta(x, j, 'pesca', `Ainda não posso pescar. ${fp}`); if (!a.ia.av || a.ia.av.encomenda) avisa(fp.slice(0, 60)); return; } }
      if (!treino && ia.avisou?.startsWith('treino:') && R.no) this.avisarLiderRecruta(x, j, `nivel:${fn.r}`, `Cheguei no nível! Agora vou pro ${R.palavras[0]}.`);
      if (this.precisaFerRecruta(x, a, R)) { const k = x.AMIGA.atividades[R.coleta].ferramenta; this.avisarLiderRecruta(x, j, `fer:${k}`, `Tô sem ${ITENS[k].nome.toLowerCase()}. Vou pegar no Baú do Clã ou catar galho e pedra no chão pra fazer um.`); return; } // sem a ferramenta: pega no Baú do Clã ou faz (ferramentaRecruta)
      const Rx = treino ? RECURSOS_CLA[treino] : R;
      const verbo = Rx.coleta === 'pescar' ? 'pesca' : Rx.coleta === 'lenha' ? 'corta' : 'minera';
      const fala = x.encomendaAmiga(a, j, `${verbo} ${CLA.farmar} ${Rx.palavras[0]} pra mim`);
      if (!(ia.encomenda && !ia.encomenda.pronta)) avisa(String(fala || 'Não dá agora').replace(/^[^:]*: /, '').slice(0, 60));
      else if (treino) { const K = COLETA[R.no]; this.avisarLiderRecruta(x, j, `treino:${fn.r}`, `Ainda não tenho nível pra ${R.palavras[0]}: preciso de ${PROFISSOES[K.prof]?.nome || K.prof} Nv ${K.nivel} e tô no ${profNivel(a.prog.prof[K.prof])}. Vou minerar ${Object.keys(RECURSOS_CLA).filter((q) => { const C = COLETA[RECURSOS_CLA[q].no]; return C && !C.mao && C.prof === K.prof && (C.nivel || 1) <= profNivel(a.prog.prof[K.prof]); }).map((q) => RECURSOS_CLA[q].palavras[0]).join(' e ')} pra treinar e depois vou pro ${R.palavras[0]}.`); avisa(`Treinando ${PROFISSOES[K.prof]?.nome || K.prof} (Nv ${profNivel(a.prog.prof[K.prof])}/${K.nivel}): ${Rx.nome}`); }
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
  // o nome do clã de um corpo (André 2026-11-26: "coloca o nome do clã na cabeça"): vai na foto (cn). Guardado por 5 s
  nomeClaFoto(j) {
    if (j._cnT > this.tempo) return j._cn;
    let n = '';
    if (!j.bot) n = j.prog?.cla?.n || '';
    else {
      const x = this.amigoIaDe?.(j);
      if (x && (x.AMIGA.recruta || x.AMIGA.clanpc)) { const K = this.claDoRecruta(x); n = K ? (K.bot ? K.C.n : K.c?.n || this.clasFora?.get(K.conta)?.n || '') : ''; }
      else if (x) n = CLAS_NPC.find((o) => o.lider === x.AMIGA.id || o.membros.includes(x.AMIGA.id))?.n || '';
    }
    j._cn = String(n || '').slice(0, 24); j._cnT = this.tempo + 5;
    return j._cn;
  },
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
  // está fazendo a ordem de coleta (indo, coletando ou levando ao Baú do Clã)? false = está no Livre (caçando, descansando...)
  // pesca ainda fechada pela história dele ("A primeira vara", igual ao jogador): o motivo, ou '' se pode pescar. Sem isto a
  // ordem Farmar peixe ficava indo de spot em spot sem conseguir lançar (André 2026-11-26)
  semPescaRecruta(a, R) { return R?.coleta === 'pescar' && !liberado(a.prog, 'pesca') ? motivoLibera(a.prog, 'pesca') : ''; },
  naOrdemColeta(a, R) { const av = a.ia?.av; return !!av && (av.coleta === R.coleta || !!av.encomenda || this.levandoRecruta(a)); },
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
  // recall até o Baú do Clã (CLA.recall): o mesmo canal e a mesma recarga da casinha do jogador (voltarVila); true = ocupou o
  // passo (canalizando ou começou agora). Sem recarga pronta, com carga ou perto: false (vai andando ou pelo totem)
  recallRecruta(x, a, P, d) {
    if (a.vila) { if (!a.vila.para) return false; a.montado = null; x.pararAmiga(a); return true; }
    if (d < CLA.recall.min || (a.prog.vilaAte || 0) > Date.now() || a.morto || a.esc || !a.chao || a.veiculo || a.prog.pack || this.motivoCarga(a)) return false;
    if (a.coleta) this.pararColeta(a, null);
    if (a.pesca) this.pararPesca(a, null);
    if (a.canal) this.cancelarCanal(a);
    a.montado = null; x.pararAmiga(a); a.ia.viagem = null;
    const v = a.vila = { x: a.x, z: a.z, para: { x: P.x, z: P.z + 2.5, base: true } };
    this.evento({ t: 'vila', id: a.id, fase: 'comeca', dur: VOLTA_VILA.canal });
    this.depois(VOLTA_VILA.canal, () => { if (a.vila === v && !a.morto && this.jogadores.get(a.id) === a) this.chegarNaVila(a); });
    a.ia.funcaoSt = { txt: 'Voltando ao Baú do Clã (casinha)', ate: this.tempo + VOLTA_VILA.canal + 2 };
    return true;
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
        if (this.recallRecruta(x, a, P, d)) return true; // longe: a casinha até o baú, como o jogador
        if (d > 30) x.irLongeAmiga(a, P.x, P.z, dt); else this.irDireto(a, P.x, P.z, d > 6);
        return true;
      }
      x.pararAmiga(a);
    } // sem baú no mapa (clã bot sem base): o baú dele é só o estado do clã, guarda ali mesmo
    const n = this.depositarRecruta(x);
    x.arrumarMochilaAmiga(a); // na base: vende o que não usa, como na volta para a vila (André 2026-11-24: a mochila enchia de peça no farm)
    a.ia.av = null; a.ia.fase = 'pensar'; a.ia.encomenda = null;
    if (n) a.ia.funcaoSt = { txt: `Deixou ${n} de ${a.ia.levar.nome} no Baú do Clã`, ate: this.tempo + 20 };
    else if (this.temLevar(a)) a.ia.funcaoSt = { txt: 'O Baú do Clã está cheio', ate: this.tempo + 90 };
    const mm = K.m?.find((o) => o.id === x.AMIGA.id); if (n && K.corpo && mm) this.aplicarFuncao(K.corpo, x, mm, false); // já volta a farmar
    else if (n && !K.corpo && !K.bot && mm) this.funcaoSemLider(x, a, mm.fn || { k: 'livre' }, { id: null, conta: K.conta, bot: false, time: null, prog: { cla: { m: K.m } } }); // líder fora: também
    return true;
  },
  // avisa o líder (jogador) no chat, uma vez por motivo (André 2026-11-24: "avisar no chat também")
  avisarLiderRecruta(x, j, chave, texto) {
    const ia = x.amiga?.ia; if (!ia || ia.avisou === chave) return;
    ia.avisou = chave;
    if (j && !j.bot && j.id != null) x.dizerAmiga(texto, false, j.id);
  },
  // sem nível de profissão para o recurso pedido (ferro e cristal pedem Mineração 5 e 8): o recurso da mesma profissão
  // que ele já consegue, para subir de nível; quando chega no nível, volta sozinho ao pedido (André 2026-11-24: "treina
  // minerando pedra e cobre"). Mantém o que já está coletando para não trocar no meio. null = já tem o nível
  treinoRecruta(a, r) {
    const R = RECURSOS_CLA[r], K = R?.no && COLETA[R.no]; if (!K) return null;
    const meu = profNivel(a.prog.prof?.[K.prof]); if (meu >= (K.nivel || 1)) return null;
    const ok = Object.keys(RECURSOS_CLA).filter((q) => { const Q = RECURSOS_CLA[q], C = Q.no && COLETA[Q.no]; return C && !C.mao && Q.coleta === R.coleta && C.prof === K.prof && (C.nivel || 1) <= meu; });
    if (!ok.length) return null;
    const ja = a.ia?.encomenda && !a.ia.encomenda.pronta ? a.ia.encomenda.rec : a.ia?.levar?.r;
    return ok.includes(ja) ? ja : ok[Math.floor(Math.random() * ok.length)];
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
    if (n) { this.mexeuBau(B); x.guardarAmiga?.(); a.prodDep = (a.prodDep || 0) + n; } // prodDep: o que já foi para o baú (MORAL.prod conta junto)
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
      const o = p.mochila[i]; if (!o && !Array.isArray(m.lista)) return;
      if (o && !Array.isArray(m.lista) && o.h && o.k !== 'tomo') return aviso('Tire o item do lugar rápido antes de guardar');
      // André 2026-11-25: n maior que a pilha puxa das pilhas iguais; lista = várias pilhas inteiras (os botões de tipo)
      let foi = 0;
      for (const x of Array.isArray(m.lista) ? [...new Set(m.lista.slice(0, 400))].filter((x) => Number.isInteger(x) && p.mochila[x] && !(p.mochila[x].h && p.mochila[x].k !== 'tomo')) : [i]) {
        const r = moverQtd(p.mochila, L.bauCla, x, Array.isArray(m.lista) ? undefined : m.n); if (!r) break;
        p.mochila = r.de; L.bauCla = r.para; foi += r.n;
      }
      if (!foi) return aviso('O Baú do Clã está cheio');
    } else if (m.acao === 'tirar') {
      let foi = 0;
      for (const x of Array.isArray(m.lista) ? [...new Set(m.lista.slice(0, 400))].filter((x) => Number.isInteger(x) && L.bauCla[x]) : [i]) {
        const r = moverQtd(L.bauCla, p.mochila, x, Array.isArray(m.lista) ? undefined : m.n); if (!r) break;
        L.bauCla = r.de; p.mochila = r.para; foi += r.n;
      }
      if (!foi) return aviso('Mochila cheia');
    } else if (m.acao === 'organizar') L.bauCla = organizar(L.bauCla);
    else if (m.acao !== 'abrir') return aviso('O Baú do Clã tem tamanho fixo');
    this.lotesMudados.add(L.def.id);
    this.evento({ t: 'bau', para: j.id, cla: 1, itens: L.bauCla, abrir: m.acao === 'abrir', slots: L.bauCla.length, prox: null, proxSlots: 0 });
    if (m.acao !== 'abrir') this.avisarProg(j);
  },
  // ---------- Fazenda (função do painel): cuida dos canteiros arados da base ----------
  // chamado a cada passo do recruta (amiga.js fazendaAmiga); true = ocupou o passo
  passoFazendaRecruta(x, j, dt) {
    const fn = j.ia.funcao; if (!fn || (fn.k !== 'fazenda' && fn.k !== 'arvores') || (j.time && j.time.membros.length > 1)) return false;
    const K = this.claDoRecruta(x), ia = j.ia, F = CLA.fazenda;
    if (fn.k === 'arvores') return K ? this.passoArvoresRecruta(x, j, dt, fn.s, K) : false; // Plantar árvores: nas áreas de plantio do mapa
    const L = this.loteDaConta(K?.conta);
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
      const sem = this.sementeFazenda(K, p, s, P); if (sem) return sem;
      Object.assign(t, { c: s, g: 0, u: agora, w: agora }); delete t.mi; delete t.mf;
      gasta(); txt = `Plantou ${P.nome.toLowerCase()}`;
    }
    this.avisarLote(L); this.lotesMudados.add(L.def.id); x.guardarAmiga?.();
    return txt;
  },
  // a semente da Fazenda: do Baú do Clã, senão da bolsa dele, senão compra na Rosa com o cofre do clã (clã bot: o ouro
  // do líder). '' = pegou; texto = o motivo de não ter
  sementeFazenda(K, p, s, P) {
    const B = this.bauDoCla(K), sk = 'semente_' + s;
    if (B && contar(B.itens, sk) > 0) { tirar(B.itens, sk, 1); this.mexeuBau(B); return ''; }
    if (contar(p.mochila, sk) > 0) { tirar(p.mochila, sk, 1); return ''; }
    const preco = LOJA.find((o) => o.k === sk)?.preco || P.semente;
    if (K.bot) { if (!K.corpo || (K.corpo.prog.ouro | 0) < preco) return 'Sem ouro para semente'; K.corpo.prog.ouro -= preco; }
    else { if (!K.c || K.c.cofre < preco) return 'Cofre sem ouro para semente'; K.c.cofre -= preco; this.logCla(K.c, `Semente de ${P.nome.toLowerCase()} (fazenda)`, -preco); if (K.corpo) K.corpo.progSujo = true; }
    return '';
  },
  // ---------- Plantar árvores (André 2026-11-25: "o comando de plantar árvore só planta árvore"; clãs bot também) ----------
  // Planta a árvore escolhida nas áreas de plantio do mapa (PLANTIO.areas), da mais perto do Baú do Clã para longe, até
  // ter PLANTIO.mudasMax mudas dele crescendo (o mesmo limite do jogador). Aí avisa no chat e volta sozinho ao Livre;
  // mandado de novo antes de crescerem, diz que atingiu o limite e volta ao Livre. Não corta: cortar é o Farmar recurso >
  // Lenha (a adulta qualquer um corta, área pública). A semente sai do Baú do Clã, da bolsa ou do cofre, como na horta.
  mudasRecruta(id) { let n = 0; const agora = this.agoraMs(); for (const P of this.plantadas?.values() || []) if (P.rc === id && !P.lote && agora < this.adultaEm(P)) n++; return n; },
  passoArvoresRecruta(x, j, dt, s, K) {
    if (!this.plantadas || !this.botarPlantada) return false;
    const ia = j.ia, F = CLA.fazenda, id = x.AMIGA.id, f = (ia.arv ||= { n: 0 }), p = j.prog, max = PLANTIO.mudasMax;
    const avisa = (txt) => { ia.funcaoSt = { txt, ate: this.tempo + 8 }; };
    const livre = (fala) => { // terminou (ou não pode): avisa o líder no chat e volta ao Livre
      const mm = K.m?.find((o) => o.id === id); ia.arv = null; ia.funcao = null;
      if (K.corpo) this.avisarLiderRecruta(x, K.corpo, 'arv:' + this.tempo, fala);
      if (mm) { mm.fn = { k: 'livre' }; if (K.corpo) { K.corpo.progSujo = true; this.aplicarFuncao(K.corpo, x, mm, true); } }
      ia.funcaoSt = { txt: fala, ate: this.tempo + 30 };
      x.guardarAmiga?.(); return true;
    };
    const n = this.mudasRecruta(id);
    if (n >= max) return livre(f.n ? `Plantei ${f.n} árvore${f.n > 1 ? 's' : ''} lá. Vou fazer minhas coisas, qualquer coisa me chama.` : `As ${max} árvores que plantei ainda não cresceram, atingi o limite. Vou fazer minhas coisas, qualquer coisa me chama.`);
    if (this.plantadasNasAreas() >= PLANTIO.maxMundo) return livre('As áreas de plantio do mundo estão cheias. Voltei pro modo livre.');
    if (f.alvo && (this.tempo > (f.ate || 0))) f.alvo = null;
    if (!f.alvo) { const q = this.quadradoArvoreArea(s, this.lugarBauCla(K) || j); if (!q) return livre('Não achei lugar livre nas áreas de plantio. Voltei pro modo livre.'); f.alvo = q; f.ate = this.tempo + 120; }
    const T = f.alvo, d = Math.hypot(T.x - j.x, T.z - j.z);
    if (d > 0.6 + F.perto) { if (d > 30) x.irLongeAmiga(j, T.x, T.z, dt); else this.irDireto(j, T.x, T.z, d > 6); avisa(`Indo plantar (${n}/${max})`); return true; }
    x.pararAmiga(j); j.ry = Math.atan2(T.x - j.x, T.z - j.z);
    if (this.tempo < (f.t || 0)) return true;
    f.t = this.tempo + F.passo;
    if (vigorDe(p.vigor) < PLANTIO.vigor) return livre('Acabou meu vigor. Voltei pro modo livre.');
    const D = ARVORES_PLANTIO[s]; f.alvo = null;
    if (!this.quadradoArvoreLivre(T.i, T.k, !!D.grande)) return true; // alguém plantou antes: procura outro
    const sem = this.sementeFazenda(K, p, s, D); if (sem) return livre(`${sem}. Voltei pro modo livre.`);
    const Lq = lugarNoQuadrado(T.i, T.k, !!D.grande), r2 = (v) => Math.round(v * 100) / 100;
    this.botarPlantada({ id: 'p' + this.plantioProx++, s, x: r2(Lq.x), z: r2(Lq.z), ry: r2(Lq.ry), sc: r2(Lq.sc * (D.s || 1)), dono: K.conta, nome: j.nome, quando: this.agoraMs(), rc: id });
    p.vigor = { v: Math.max(0, vigorDe(p.vigor) - PLANTIO.vigor), t: Date.now(), m: p.vigor?.m || VIGOR.max };
    this.pontosProf(j, 'len', PLANTIO.len); this.ganharXP(j, PLANTIO.xp); f.n++;
    avisa(`Plantou ${D.nome.toLowerCase()} (${n + 1}/${max})`);
    x.guardarAmiga?.(); return true;
  },
  // o quadrado (i, k) serve para uma árvore? (as mesmas travas do jogador: tudo na mesma área de plantio, sem árvore,
  // fora da base de clã, longe de árvore nativa e pedra)
  quadradoArvoreLivre(i, k, grande) {
    const Q = PLANTIO.quadrado, qs = grande ? [[i, k], [i + 1, k], [i, k + 1], [i + 1, k + 1]] : [[i, k]], a0 = areaPlantio(i, k);
    if (!a0 || qs.some(([a, b]) => areaPlantio(a, b) !== a0 || this.plantioQ.has(a + ',' + b) || naBaseCla((a + 0.5) * Q, (b + 0.5) * Q))) return false;
    const l = lugarNoQuadrado(i, k, grande);
    return !this.pertoNaMata?.(l.x, l.z).some((o) => Math.hypot(o.x - l.x, o.z - l.z) < o.r + PLANTIO.folga);
  },
  // o quadrado livre de área de plantio mais perto de c ({ x, z }: o Baú do Clã), ou null. A ordem dos quadrados por
  // distância fica guardada por lugar (8 mil quadrados: ordena uma vez)
  quadradoArvoreArea(s, c) {
    const D = ARVORES_PLANTIO[s]; if (!D) return null;
    const Q = PLANTIO.quadrado, chave = Math.round(c.x / 50) + ',' + Math.round(c.z / 50), cache = (this.arvOrdem ||= new Map());
    let ordem = cache.get(chave);
    if (!ordem) {
      const cx = Math.round(c.x / 50) * 50, cz = Math.round(c.z / 50) * 50;
      ordem = [...QUADRADOS_PLANTIO.keys()].map((q) => { const [i, k] = q.split(',').map(Number); return [i, k, Math.hypot((i + 0.5) * Q - cx, (k + 0.5) * Q - cz)]; }).sort((a, b) => a[2] - b[2]);
      if (cache.size > 40) cache.clear();
      cache.set(chave, ordem);
    }
    for (const [i, k] of ordem) if (this.quadradoArvoreLivre(i, k, !!D.grande)) { const l = lugarNoQuadrado(i, k, !!D.grande); return { i, k, x: l.x, z: l.z }; }
    return null;
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
      this.aoAvisoCla?.(j.conta, `${m.nome} foi embora do clã: 7 dias sem pagamento`);
      this.evento({ t: 'aviso', para: j.id, texto: `${m.nome} foi embora do clã: 7 dias sem pagamento` });
    }
    // a taxa da base (shared/base.js): sai do cofre a cada semana vencida
    const B = this.baseDe?.(j);
    if (B && this.pagarBase(B, (v) => { if (c.cofre < v) return false; c.cofre -= v; this.logCla(c, 'Taxa da base', -v); return true; })) mudou = true;
    // Despensa e lenha (DESPENSA, André 2026-11-24): a comida e a lenha saem do Baú do Clã
    const Bd = this.bauDoCla({ conta: j.conta }), D = (c.dsp ||= {}), nD = 1 + c.m.length;
    const rD = this.passoDespensa(D, Bd?.itens || null, nD, B);
    if (rD.mudou) mudou = true;
    if (rD.comeu && Bd) this.mexeuBau(Bd);
    const eD = this.estadoDespensa(D, Bd?.itens || null, nD);
    if (eD.nome !== (j.dspNome ?? eD.nome) || (D.frio ? 1 : 0) !== (j.dspFrio ?? (D.frio ? 1 : 0))) {
      const txt = eD.fome ? `Os recrutas estão ${eD.nome.toLowerCase()}: ponha comida no Baú do Clã` : D.frio && !j.dspFrio ? 'A base está sem lenha: deixou de ser área segura. Ponha lenha no Baú do Clã'
        : eD.bem ? 'Despensa cheia: os recrutas estão bem alimentados' : !D.frio && j.dspFrio ? 'A base tem lenha de novo' : 'Os recrutas comeram';
      this.evento({ t: 'aviso', para: j.id, texto: txt });
    }
    j.dspNome = eD.nome; j.dspFrio = D.frio ? 1 : 0;
    this.passoMoralCla(j, agora);
    this.mesaRecrutas(this.recrutasNoMundo(j), eD, agora, (x) => { const m = c.m.find((o) => o.id === x.AMIGA.id); return m ? faixaMoral(m.mo ?? MORAL.inicio).rende : 1; });
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
  // ---------- painel do clã (página leve, André 2026-11-24) ----------
  // "um app só para administrar o clã... quando eu não pudesse logar, só para determinar o que os meus bonequinhos vão
  // fazer, ver o funcionamento dos bots... no máximo um mapinha". Sem corpo no mundo: o servidor (server/index.js) lê o
  // clã da conta, e estes métodos montam o que a página mostra e aplicam a ordem nos recrutas que estão no mundo.
  // O líder de mentira (sem corpo): só o lugar e a conta, como o de entrarRecrutasSemLider
  liderPainel(conta, c, raca) { return { id: null, conta, bot: false, time: null, raca, prog: { cla: c, nivel: 1 }, x: 0, z: 0 }; },
  // o que a página desenha. heroi: o corpo do líder quando ele está no jogo (aí as ordens vão pelo cla() de sempre)
  painelInfo(conta, c, raca, heroi = null, prog = null) {
    if (!c) return { sem: 1 };
    const L = heroi || this.liderPainel(conta, c, raca);
    const vivos = new Map(this.recrutasNoMundo(L).filter((x) => x.amiga).map((x) => [x.AMIGA.id, x.amiga]));
    const st = (o, prog) => ({ hp: Math.round(o.vida) | 0, hpM: Math.round(o.vidaMax) | 0, vg: Math.floor(vigorDe(prog.vigor)), vgM: prog.vigor?.m || VIGOR.max, morto: o.morto ? 1 : 0 });
    const pos = (o) => ({ x: Math.round(o.x), z: Math.round(o.z) });
    const eM = this.estadoDespensa(c.dsp, this.bauDoCla({ conta })?.itens || null, 1 + c.m.length);
    // lugar do líder: da sua raça (aliado, ex. Dário) de qualquer distância; o da outra raça (Geada) só com a regra do
    // minimapa do jogo (André 2026-11-25: "os geadas só aparecem se estiver na proximidade. O Dário pode aparecer de
    // longe"): perto de você (no jogo) ou de um recruta seu no mundo. Longe, nem sai do servidor
    const olhos = [...(heroi && !heroi.morto ? [heroi] : []), ...this.recrutasNoMundo(L).map((x) => x.amiga).filter((o) => o && !o.morto)];
    const perto = (B) => olhos.some((o) => Math.hypot(o.x - B.x, o.z - B.z) <= CLA.painelVer);
    const clas = CLAS_NPC.map((C) => { const B = this.liderNpc(C); return B && !B.morto ? { ...(C.raca === (raca || this.racaDe(L)) || perto(B) ? pos(B) : {}), fz: this.fazendoBotPainel(B) } : {}; });
    return { n: c.n, nv: c.nv || 1, cofre: c.cofre | 0, semana: semanaCla(c), jogo: heroi ? 1 : 0, ...(!heroi && c.sem <= Date.now() ? { vencida: 1 } : {}), ...(heroi ? { eu: pos(heroi) } : {}),
      m: c.m.map((m) => { const a = vivos.get(m.id); return { id: m.id, nome: m.nome, tier: tierDe(m.tier).nome, nv: a ? a.prog.nivel | 0 : m.nv, on: a ? 1 : 0, ...(m.dev ? { dev: 1 } : {}),
        ...this.moralInfo(m, c.vis, eM, a), // moral e produção (MORAL), igual ao menu do clã do jogo
        fn: m.fn || { k: 'livre' }, ...(a ? { ...st(a, a.prog), ...this.fzRecruta(a, L), ...pos(a), ...(Array.isArray(a.prog.mochila) && a.prog.mochila.length && !a.prog.mochila.some((o) => !o) ? { cheia: 1 } : {}), ...(Array.isArray(a.prog.mochila) && a.prog.mochila.length ? { mo: lugares(a.prog.mochila) } : {}) } : {}) }; }),
      log: (c.log || []).slice(-10).reverse(), funcoes: CLA.funcoes.filter((F) => heroi || F.id !== 'seguir'),
      recursos: Object.entries(RECURSOS_CLA).map(([k, R]) => ({ k, nome: R.nome })), plantas: plantasFazenda(), arvores: arvoresCla(),
      // o que pede o próximo nível do clã e o que já tem (Baú do Clã + mochila do líder), igual ao Melhorar clã do jogo
      sobe: this.subirPainel(conta, c, raca, heroi, prog),
      bau: this.bauPainel(conta), ...(this.cheiosCla(conta).bau ? { bauCheio: 1 } : {}), // o que tem no Baú do Clã (André 2026-11-24: "mostrar inventário do clã"), em ícones
      ...(this.bauDoCla({ conta })?.itens ? { bauLug: lugares(this.bauDoCla({ conta }).itens) } : {}), // ocupado/total, como o jogo (40/60)
      ...(this.baseDe?.(L) ? { base: { x: Math.round(this.baseDe(L).x), z: Math.round(this.baseDe(L).z), nv: this.baseDe(L).nv | 0, n: this.baseDe(L).n || c.n, raca: this.baseDe(L).raca || '' } } : {}), // a base do clã no mapa do painel
      ...(this.basesCla ? { bases: Object.values(this.basesCla).filter((B) => B.raca === (raca || this.racaDe(L)) && B.k !== this.baseDe?.(L)?.k).map((B) => ({ x: Math.round(B.x), z: Math.round(B.z), n: B.n || '', raca: B.raca })) } : {}), // as bases aliadas (mesma facção); da facção inimiga nada vai
      gu: this.guerraInfo?.({ ...L, prog: heroi?.prog || prog || L.prog }, c.m.map((m) => vivos.get(m.id) || { nome: m.nome, prog: this.npcSalvos?.get(m.id)?.prog || null })) || null, // Patente de Guerra: aba Guerra, igual ao jogo
      clas: this.clasNpcInfo(L).map((o, i) => ({ ...o, ...clas[i] })), lugares: (this.lugaresPainel ||= [{ nome: this.mapa.nome || 'Vila', x: 0, z: 0 }, ...LUGARES_MUNDO.filter((o) => o.nome && o.tipo !== 'porto').map((o) => ({ nome: o.nome, x: o.x, z: o.z }))]) };
  },
  // o que está cheio no clã (André 2026-11-24: "quando ficar cheio... ficar vermelho... e notificação"): recruta com a
  // mochila sem lugar livre e o Baú do Clã sem lugar livre. { recrutas: [nome], bau: bool }
  cheiosCla(conta) {
    const semLugar = (l) => Array.isArray(l) && l.length > 0 && !l.some((o) => !o);
    const recrutas = this.recrutasNoMundo({ conta }).filter((x) => x.amiga && semLugar(x.amiga.prog.mochila)).map((x) => x.AMIGA.nome);
    return { recrutas, bau: semLugar(this.bauDoCla({ conta })?.itens) };
  },
  bauPainel(conta) {
    const B = this.bauDoCla({ conta }); if (!B) return null;
    const soma = {}; for (const it of B.itens) if (it) soma[it.k] = (soma[it.k] | 0) + (it.n || 1);
    return Object.entries(soma).map(([k, n]) => ({ k, n, nome: ITENS[k]?.nome || k, ...(ITENS[k]?.cor ? { cor: ITENS[k].cor } : {}) }));
  },
  subirPainel(conta, c, raca, heroi, prog) {
    const j = heroi || { conta, bot: false, raca, prog: { cla: c, mochila: prog?.mochila, nivel: prog?.nivel | 0 } };
    const S = this.subirInfo(j); if (!S) return null;
    return { ...S, nvLider: j.prog.nivel | 0, cofre: c.cofre | 0 };
  },
  // o que o líder de um clã bot está fazendo (linha curta, igual ao fazendoRecruta)
  fazendoBotPainel(B) {
    const ia = B.ia || {};
    if (ia.atividade) return 'Trabalhando';
    if (ia.av) return ia.av.fase === 'voltar' ? 'Voltando' : ia.av.coleta ? 'Coletando' : 'Caçando';
    if (B.guerra || ia.alma?.alvo) return 'Na guerra';
    return 'Na base';
  },
  // ordem pela página com o líder fora do jogo: confere como o cla() 'funcao' e aplica no recruta do mundo (funcaoSemLider).
  // Proteger carrinho / mercante / você e "Me seguir" pedem o líder no jogo. Devolve { texto, ok }. Muda c (o servidor grava)
  painelFuncao(conta, c, raca, id, fnBruto) {
    const r = c?.m?.find((o) => o.id === id); if (!r) return { texto: 'Esse recruta não está no seu clã' };
    if (c.sem <= Date.now()) return { texto: 'A semana dos recrutas venceu: entre no jogo para pagar' }; // a cobrança é no jogo (cobrarCla)
    const fn = funcaoValida(fnBruto);
    if (fnBruto?.k === 'seguir' || (fn?.k === 'proteger' && (fn.p === 'lider' || VEIC_PROTEGE[fn.p]))) return { texto: 'Essa ordem só dá com você no jogo' };
    if (fnBruto?.k && fnBruto.k !== 'livre' && !fn) return { texto: 'Ordem inválida' };
    if (fn?.k === 'proteger' && (fn.p === r.id || !c.m.some((o) => o.id === fn.p))) return { texto: 'Escolha outro membro do clã' };
    if (fn) r.fn = fn; else delete r.fn;
    (this.clasFora ||= new Map()).set(conta, c);
    const L = this.liderPainel(conta, c, raca), x = this.recrutasNoMundo(L).find((o) => o.AMIGA.id === r.id);
    if (x?.amiga && !x.amiga.morto) this.funcaoSemLider(x, x.amiga, fn || { k: 'livre' }, L);
    const F = CLA.funcoes.find((o) => o.id === (fn?.k || 'livre'));
    return { ok: true, texto: `${r.nome}: ${F.nome}${fn?.k === 'recurso' ? ` (${RECURSOS_CLA[fn.r].nome})` : (fn?.k === 'fazenda' || fn?.k === 'arvores') && fn.s ? ` (plantar ${nomeFazenda(fn.s)})` : fn?.k === 'proteger' ? ` ${c.m.find((o) => o.id === fn.p)?.nome || ''}` : ''}` };
  },
  // a página abriu com o líder fora do jogo: os recrutas que acabaram de ganhar corpo entregam o tempo fora (foraRecrutas,
  // anotado no registro do clã) e o tempo fora para de contar. novos: ids que ganharam corpo agora
  painelEntrou(conta, c, nivel, novos) {
    if (!c) return;
    (this.clasFora ||= new Map()).set(conta, c);
    if (c.saiu) this.foraRecrutas({ id: null, conta, prog: { cla: c, nivel }, semAviso: true }, novos);
  },
  // a página fechou com o líder fora do jogo: o tempo fora volta a contar daqui; o nível de quem está no mundo vai junto
  painelSaiu(conta, c) {
    if (!c) return;
    for (const x of this.recrutasNoMundo({ conta })) { const m = x.amiga && c.m.find((o) => o.id === x.AMIGA.id); if (m) m.nv = x.amiga.prog.nivel | 0 || m.nv; }
    c.saiu = Date.now();
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
    ia.funcao = fn.k === 'fazenda' || fn.k === 'proteger' || fn.k === 'arvores' ? fn : fn.k === 'seguir' ? { k: 'proteger', p: 'lider' } : null;
    ia.levar = fn.k === 'recurso' && RECURSOS_CLA[fn.r]?.item ? { r: fn.r, item: RECURSOS_CLA[fn.r].item, nome: RECURSOS_CLA[fn.r].nome } : null;
    if (fn.k === 'recurso' && RECURSOS_CLA[fn.r]?.coleta === 'guerra') { ia.funcao = { k: 'alma' }; ia.av = null; return; }
    if (!(ia.levar && this.levandoRecruta(a))) ia.av = null;
    if (ia.av) return; // indo deixar no Baú do Clã: termina a entrega
    const R = fn.k === 'recurso' ? RECURSOS_CLA[fn.r] : null;
    if (R && COLETA_ORDEM.includes(R.coleta) && vigorDe(a.prog.vigor) < 1) { ia.funcaoSt = { txt: 'Sem vigor: no modo livre até o vigor voltar', ate: this.tempo + 90 }; return; } // igual ao líder no jogo
    const fp = this.semPescaRecruta(a, R); if (fp) { ia.funcaoSt = { txt: fp.slice(0, 90), ate: this.tempo + 90 }; return; }
    if (R && R.coleta !== 'cacar' && this.precisaFerRecruta(ctx, a, R)) return;
    const treino = R && this.treinoRecruta(a, fn.r); // sem nível para o pedido: treina no que já dá (André 2026-11-24)
    if (treino) { const Rt = RECURSOS_CLA[treino]; ia.levar = { r: treino, item: Rt.item, nome: Rt.nome }; const cc = ctx.lugarRecursoAmiga?.(a, Rt); if (cc) ia.av = { fase: 'ir', c: cc, coleta: Rt.coleta, noTipo: Rt.no, ate: this.tempo + 900 }; }
    // o veio/árvore/pesqueiro DO RECURSO PEDIDO, igual ao líder no jogo (André 2026-11-26: painel com todos em ~0/h no ferro).
    // Antes ia a qualquer lugar de minerar perto da casa dele (pedra, cobre...) ou, sem nenhum, caía no Livre e ia caçar
    else if (R && R.coleta !== 'cacar') { const cc = ctx.lugarRecursoAmiga?.(a, R); if (cc) ia.av = { fase: 'ir', c: cc, coleta: R.coleta, noTipo: R.no, ate: this.tempo + 900 }; }
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
      // a moral e a mesa sem o líder (MORAL: só conta, não guarda; quem guarda é o cobrarCla com ele no jogo)
      const bauF = this.bauDoCla({ conta })?.itens || null, agoraF = Date.now();
      this.mesaRecrutas(this.recrutasNoMundo(L), this.estadoDespensa(c.dsp, bauF, 1 + c.m.length, agoraF), agoraF, (x) => { const m = c.m.find((o) => o.id === x.AMIGA.id); return m ? faixaMoral(moralAgora(m, c.vis, agoraF)).rende : 1; });
      for (const x of this.recrutasNoMundo(L)) {
        const a = x.amiga, m = a && c.m.find((o) => o.id === x.AMIGA.id); if (!m || a.morto || a.time) continue;
        // ordem de coleta (minério, lenha, peixe): caiu no Livre (acabou o vigor) e foi caçar? Com o vigor de volta, larga e
        // volta à ordem (André 2026-11-26: "todos estão zero mineração/hora"; antes a caçada do Livre segurava ele para sempre)
        const R = m.fn?.k === 'recurso' && RECURSOS_CLA[m.fn.r];
        if (R && COLETA_ORDEM.includes(R.coleta) && a.ia?.av && !this.naOrdemColeta(a, R) && !this.semPescaRecruta(a, R)) {
          const vg = a.prog.vigor; if (vigorDe(vg) < Math.max(1, CLA.livreVigor.retoma * (vg?.m || VIGOR.max))) continue;
          this.funcaoSemLider(x, a, m.fn, L); continue;
        }
        if (a.ia?.av) continue;
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
      const m = x.amiga && c.m.find((o) => o.id === x.AMIGA.id); if (!m || m.dev) continue; // devendo não trabalha
      const t0 = Math.max(saiu, +x.foraDesde || 0), ms = Math.min(F.max, Date.now() - t0); if (!(ms >= F.minimo)) continue;
      const h = ms / 3600e3;
      // modo Livre fora do jogo (André 2026-11-25: "deixei em modo livre por muito tempo e o telhado não foi construído...
      // eu estava off"): ele levanta a casa dele no lote, uma peça a cada passo.obra s (como no jogo), até acabar
      if (!m.fn || m.fn.k === 'livre') { const f = this.casaFora(x, ms / 1000); if (f) { hMax = Math.max(hMax, h); feitos.push(f); } continue; }
      hMax = Math.max(hMax, h);
      const f = this.trabalhoFora(x, m, h, j.prog.nivel | 0); if (f) feitos.push(f);
    }
    if (!feitos.length) return;
    const horas = hMax >= 1 ? `${Math.floor(hMax)} h` : `${Math.round(hMax * 60)} min`;
    for (const f of feitos) this.logCla(c, `Fora (${horas}): ${f}`);
    // um recruta por linha (André 2026-11-22: "podia descrever por coluna... Gael fez isso, João fez tal"); o aviso (hud.gd) quebra no \n
    if (!j.semAviso) this.evento({ t: 'aviso', para: j.id, texto: `Enquanto você esteve fora:\n${feitos.join('\n')}` }); // painel do clã: só o registro
  },
  // peças da casa que o recruta em modo Livre põe em seg segundos fora do jogo (a ordem de construir é a mesma do jogo)
  casaFora(x, seg) {
    const L = x.loteDaAmiga?.(); if (!L || !x.amiga) return null;
    let n = Math.floor(seg / (x.AMIGA.passo.obra * 1.3)), feitas = 0;
    const A = x.AMIGA;
    while (n-- > 0) {
      const mov = x.movelForaAmiga(L); if (mov) { x.moverMovelAmiga(L, mov); continue; }
      const falta = A.casa.map((q) => pecaDaCasa(L.def, q)).find((q) => !L.pecas.some((o) => mesmaPeca(o, q)) && !x.amiga.ia.pulas?.has(`${q.k}:${q.x},${q.z}`));
      if (!falta) break;
      const antes = L.pecas.length; x.colocarPeca(L, falta); if (L.pecas.length > antes) feitas++;
    }
    if (!feitas) return null;
    x.guardarAmiga?.();
    return `${x.AMIGA.nome}: construiu ${feitas} peça${feitas > 1 ? 's' : ''} da casa`;
  },
  // a casa do lote fica pronta mesmo com o bot ocupado (André 2026-11-26: "todas as casas de bot estão sem telhado... já
  // se passou quase 1 dia... mesmo no modo livre"): o bot só construía entre uma tarefa e outra (e o recruta com ordem do
  // líder quase nunca para), e o tempo fora do clã bot só contava depois do servidor ficar vazio. Agora, a cada minuto,
  // todo bot com lote na base (líder, membro fixo e recruta de todos os clãs; recruta do jogador no modo Livre) põe as peças que faltam no
  // mesmo ritmo do tempo fora (casaFora: uma peça a cada passo.obra x1,3 s), sem largar o que está fazendo. As peças que
  // não couberam (pulas) valiam até o servidor reiniciar; agora ele tenta de novo a cada CASA_OBRA.esquece s.
  passoObraCasas(seg = 60) {
    for (const x of this.amigosIa || []) {
      const a = x.amiga; if (!a || a.morto) continue;
      const L = x.loteDaAmiga?.(); if (!L) continue;
      if (a.ia.pulas?.size && !(this.tempo < (a.ia.pulasT ??= this.tempo + CASA_OBRA.esquece))) { a.ia.pulas = null; a.ia.pulasT = null; }
      // recruta do jogador com ordem no painel não mexe na casa (André 2026-11-24: "só no modo livre"); clã bot: sempre
      if (x.modoLivreAmiga?.() && x.casaFaltaAmiga?.(a, L)) x.casaFora(x, seg);
    }
  },
  // o que um recruta fez em h horas fora (grind: XP até o nível do líder; farm: o que o vigor paga, direto no Baú do
  // Clã; fazenda: os canteiros crescem sozinhos e ele colhe e replanta quando o líder volta). Texto ou null.
  trabalhoFora(x, m, h, nvLider) {
    const a = x.amiga, F = CLA.fora; if (!a) return null;
    let txt = null;
    // a moral (MORAL) conta no tempo fora também: o recruta desanimado rende menos
    const rM = MORAL.ligado ? faixaMoral(m.mo ?? this.clasNpc?.[x.AMIGA.clanpc]?.mo?.[m.id]?.mo ?? MORAL.inicio).rende : 1;
    if (m.fn.k === 'grind') {
      const teto = Math.max(1, nvLider), antes = a.prog.nivel | 0; if (antes >= teto) return null;
      if ((x.AMIGA.clanpc || this.fixoClaNpc(x)) && CLAS_NPC_ORDENS.ligado) return this.grindForaBot(x, m, h, teto);
      // André 2026-11-24 (Jeito B): em vez de F.nivelHora níveis por hora, cada hora fora dá o XP de F.mobsHora monstros do
      // nível em que ele está (puglin do mesmo nível); com a curva nova depois do Nv50 ele vai ficando cada vez mais lento.
      let xp = 0, nv = antes, resto = a.prog.xp | 0;
      for (let t = h; t > 0 && nv < teto; t -= 1) {
        resto += Math.round(Math.min(1, t) * F.mobsHora * rM * xpDoInimigo('puglin', nv, nv, NIVEL_INIMIGO));
        while (nv < teto && resto >= xpProximo(nv)) { resto -= xpProximo(nv); nv++; }
      }
      xp = (nv < teto ? resto : 0) - (a.prog.xp | 0); for (let k = antes; k < nv; k++) xp += xpProximo(k); // no teto não guarda sobra
      if (xp > 0) { this.ganharXP(a, xp); if ((a.prog.nivel | 0) > teto) a.prog.nivel = teto; m.nv = a.prog.nivel | 0; txt = `${m.nome}: caçou e foi do Nv ${antes} ao ${a.prog.nivel}`; this.contarOrdem(x, m, { n: Math.round(h * F.mobsHora * rM), xp, xpx: rM !== 1 ? xp - xp / rM : 0 }); } // contador da ordem: o tempo fora conta
    } else if (m.fn.k === 'recurso') {
      const R = RECURSOS_CLA[m.fn.r]; if (!R?.item) return null; // Fragmento de Alma: só lutando de verdade
      // a mesma conta do jogo (André 2026-11-25: "o consumo e a quantidade de recurso seguem a regra exata"): vigor da batida
      // com o desconto do rank da profissão (custoVigor), o que a batida dá (COLETA.da) com a chance de +1 do rank e do título
      // (batidaColeta) e a pesca peixe a peixe da lista do lago (pegarPeixe); a moral (rM) vale como no tempo online
      const C = R.no && COLETA[R.no], pf = C ? C.prof : R.coleta === 'pescar' ? 'pes' : null, b = pf ? profBonus(a.prog.prof?.[pf]) : { menosVigor: 0, extra: 0, rank: 0 };
      const extra = pf ? b.extra + bonusTituloProf(a.prog, pf, 'extra') : 0;
      const vg = vigorDe(a.prog.vigor) + (h * 3600 / VIGOR.enche) * VIGOR.max; // o que tinha + o que encheu fora
      const B = this.bauDoCla(this.claDoRecruta(x)), onde = B ? B.itens : a.prog.mochila;
      let resto = vg, dado = 0, cheio = false; const por = {};
      const dar = (k, n) => { n = Math.round(n * rM); if (n < 1) return; for (let passo = Math.min(50, n); n > 0 && passo >= 1; passo = Math.floor(passo / 2)) while (n >= passo && guardar(onde, { k, n: passo })) { n -= passo; dado += passo; por[k] = (por[k] || 0) + passo; } if (n > 0) cheio = true; };
      if (R.coleta === 'pescar') { // lago comum de água doce (o spot de todo dia), um peixe de cada vez
        const lista = PESCA.spots.comum.peixes.doce, tot = lista.reduce((q, [, w]) => q + w, 0), dobro = PESCA.dobro * b.rank + bonusTituloProf(a.prog, 'pes', 'extra');
        for (let n = 0; n < 3000 && !cheio; n++) {
          let r = Math.random() * tot, k = lista[0][0]; for (const [q, w] of lista) { r -= w; if (r <= 0) { k = q; break; } }
          const custo = PESCA.vigor[k] * (1 - b.menosVigor); if (resto < custo) break;
          resto -= custo; dar(k, 1 + (Math.random() < dobro ? 1 : 0));
        }
      } else if (C) {
        const custo = C.vigor * (1 - b.menosVigor), batidas = Math.floor(resto / custo);
        const q = Math.floor(batidas * (C.da[R.item] || 1)); // por batida: da (+1 com chance extra)
        let mais = 0; for (let i = 0; i < batidas && extra > 0; i++) if (Math.random() < extra) mais++;
        resto -= batidas * custo; dar(R.item, q + mais);
        if (q + mais > dado && q + mais > 0) resto += batidas * custo * (1 - dado / (q + mais / rM || 1)); // o que não coube no baú não gasta vigor
      } else { // caça (couro, carne...): sem vigor (André 2026-11-26), F.couroHora por hora fora
        const q = h * F.couroHora; dar(R.item, Math.floor(q) + (Math.random() < q % 1 ? 1 : 0)); // o vigor só enche (resto = vg)
      }
      a.prog.vigor = { v: Math.max(0, Math.min(a.prog.vigor?.m || VIGOR.max, resto)), t: Date.now(), m: a.prog.vigor?.m || VIGOR.max };
      if (B && dado) this.mexeuBau(B);
      if (dado) this.contarOrdem(x, m, { n: dado, x: rM !== 1 ? dado - dado / rM : 0 }); // contador da ordem: o tempo fora conta
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
    if (j?.prog?.cla && this.genteOnline(j.id)) { // painel do clã aberto conta (André 2026-11-24)
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

  // ---------- Despensa e lenha do clã (André 2026-11-24, DESPENSA em shared/dados.js) ----------
  // come da despensa (o Baú do Clã) até pagar o que deve (D.d); come primeiro o mais simples (menos rações: peixe cru,
  // horta) e guarda os pratos do fogão.
  // true = comeu alguma coisa
  comerDespensa(D, itens) {
    if (!itens || !(D.d > 0)) return false;
    const R = DESPENSA.racao, ordem = Object.keys(R).filter((k) => ITENS[k] && contar(itens, k) > 0).sort((a, b) => R[a] - R[b] || ITENS[a].venda - ITENS[b].venda);
    let comeu = false;
    for (const k of ordem) {
      if (!(D.d > 0)) break;
      const n = Math.min(contar(itens, k), Math.ceil(D.d / R[k])); if (!n) continue;
      tirar(itens, k, n); D.d -= n * R[k]; comeu = true;
    }
    return comeu;
  },
  // a cada minuto (cobrarCla, passoClasNpc): conta as horas que passaram, come, marca a fome e cobra a lenha da semana.
  // D: o estado (c.dsp, E.dsp); itens: o Baú do Clã (null = sem baú: sem despensa); n: moradores; B: a base (ou null).
  passoDespensa(D, itens, n, B, agora = Date.now()) {
    const r = { mudou: false, comeu: false }; if (!DESPENSA.ligado || !D) return r;
    const H = 3600e3, dia = racoesDia(n);
    if (!itens) { if (D.fome || D.d) { delete D.fome; D.d = 0; r.mudou = true; } D.t = agora; } // sem Baú do Clã: sem despensa
    else {
      if (!D.t) { D.t = agora; r.mudou = true; }
      if (agora - D.t > 14 * 24 * H) D.t = agora - 14 * 24 * H;
      while (D.t + H <= agora) {
        D.t += H; r.mudou = true;
        D.d = Math.min(dia, (D.d || 0) + dia / 24); // a fome guardada não passa de um dia: a comida nova não some toda
        if (this.comerDespensa(D, itens)) r.comeu = true;
        if (D.d > 0) { if (!D.fome) D.fome = D.t; } else if (D.fome) delete D.fome;
      }
      // chegou comida com o clã com fome: come na hora e a fome passa
      if (D.fome && this.comerDespensa(D, itens)) { r.comeu = r.mudou = true; if (!(D.d > 0)) delete D.fome; }
    }
    if (B) { // a lenha da semana da base
      const q = lenhaSemana(B.nv);
      if (!D.l) { D.l = agora + CLA.semana; r.mudou = true; }
      for (let k = 0; D.l <= agora && k < 60; k++) { D.l += CLA.semana; D.lf = Math.min(q * 2, (D.lf | 0) + q); r.mudou = true; }
      if (D.lf > 0 && itens) { const t = Math.min(D.lf, contar(itens, 'lenha')); if (t > 0) { tirar(itens, 'lenha', t); D.lf -= t; r.comeu = r.mudou = true; } }
      if (D.lf > 0) { if (!D.frio) { D.frio = agora; r.mudou = true; } }
      else { delete D.lf; if (D.frio) { delete D.frio; r.mudou = true; } }
      if (D.frio) BASES_FRIAS.add(B.k); else BASES_FRIAS.delete(B.k);
    }
    return r;
  },
  // como o clã está de comida: { mult (dano e XP), nome, vigor (fração da volta do vigor), fome?, bem? }
  estadoDespensa(D, itens, n, agora = Date.now()) {
    const nada = { mult: 0, nome: '', vigor: 1 };
    if (!DESPENSA.ligado || !D || !itens) return nada;
    if (D.fome) { const h = (agora - D.fome) / 3600e3; let F = DESPENSA.fome[0]; for (const f of DESPENSA.fome) if (h >= f.h) F = f; return { mult: F.mult, nome: F.nome, vigor: F.vigor ?? 1, fome: 1 }; }
    const e = estoqueDespensa(itens), Bm = DESPENSA.bem;
    return e.racoes >= Bm.dias * racoesDia(n) && e.tipos >= Bm.tipos ? { mult: Bm.mult, nome: Bm.nome, vigor: 1, bem: 1 } : nada;
  },
  // ---------- moral (MORAL, André 2026-11-25) ----------
  // a cada minuto com o líder no jogo: conta a moral de cada recruta (perto dele: +; Livre: +; cansado e sem líder: -)
  passoMoralCla(j, agora = Date.now()) {
    const c = j.prog?.cla; if (!c || !MORAL.ligado) return;
    const vis = c.vis || agora, corpos = new Map(this.recrutasNoMundo(j).filter((x) => x.amiga).map((x) => [x.AMIGA.id, x.amiga]));
    for (const m of c.m) {
      const a = corpos.get(m.id), perto = !!a && !a.morto && !j.morto && (Math.hypot(a.x - j.x, a.z - j.z) <= MORAL.perto || (!!a.time && a.time === j.time)); // perto ou no time dele
      passarMoral(m, vis, perto, agora);
    }
    c.vis = agora; j.progSujo = true;
  },
  // clã bot: as mesmas regras; o líder bot está sempre no jogo e elogia quem está perto e abaixo de 90 (1 vez a cada 8 h)
  passoMoralNpc(E, L, ctxs, doM, agora = Date.now()) {
    if (!MORAL.ligado) return;
    const mo = (E.mo ||= {});
    for (const x of ctxs) {
      const a = x.amiga, M = doM(x); if (!a || !M) continue;
      const o = (mo[x.AMIGA.id] ||= {}); o.fn = M.fn;
      const perto = !a.morto && !L.morto && Math.hypot(a.x - L.x, a.z - L.z) <= MORAL.perto;
      const elogia = perto && moralAgora(o, null, agora) < 90 && !(agora - (o.el || 0) < MORAL.elogioH * 3600e3);
      if (elogia) o.el = agora;
      passarMoral(o, null, perto, agora, elogia ? MORAL.elogio : 0);
    }
    for (const id of Object.keys(mo)) if (!ctxs.some((x) => x.AMIGA.id === id) && !doM({ AMIGA: { id } })) delete mo[id]; // saiu do clã
  },
  // soma n de moral num recruta do clã do jogador j (id do membro; para outras regras, ex. Jantar do clã). Teto 100, piso 0.
  // A moral fica no membro (c.m[i].mo, 0 a 100, com mt/ot/el). Devolve a moral nova ou null.
  somarMoral(j, id, n) {
    const c = j?.prog?.cla, m = c?.m.find((o) => o.id === id); if (!m || !MORAL.ligado || !Number.isFinite(+n)) return null;
    const agora = Date.now(); passarMoral(m, c.vis || agora, false, agora, +n); j.progSujo = true; return m.mo;
  },
  // botão Elogiar (no jogo, perto dele, 1 vez a cada MORAL.elogioH h): + MORAL.elogio
  elogiarRecruta(j, id) {
    const c = j.prog?.cla, m = c?.m.find((o) => o.id === id), aviso = (texto) => this.evento({ t: 'aviso', para: j.id, texto });
    if (!m) return aviso('Esse recruta não é do seu clã');
    const a = this.recrutasNoMundo(j).find((x) => x.AMIGA.id === id)?.amiga, agora = Date.now();
    if (!a || a.morto || Math.hypot(a.x - j.x, a.z - j.z) > MORAL.elogioPerto) return aviso(`Chegue perto de ${m.nome} para elogiar`);
    const falta = (m.el || 0) + MORAL.elogioH * 3600e3 - agora;
    if (falta > 0) return aviso(`${m.nome} já foi elogiado: de novo em ${Math.ceil(falta / 3600e3)} h`);
    m.el = agora; passarMoral(m, c.vis || agora, true, agora, MORAL.elogio); c.vis = agora; j.progSujo = true;
    aviso(`${m.nome}: "Valeu, chefe!" (+${MORAL.elogio} de moral)`);
    this.avisarProg(j);
  },
  // o que o menu do clã mostra da moral e da produção (jogo e painel): ml (0 a 100; mo já é a mochila no painel), re (% que rende, com a mesa),
  // seta, cor, ph ({ i: ícone, n: ~por hora }), el (pode elogiar agora: perto e sem espera)
  moralInfo(m, vis, est, a, j = null, agora = Date.now()) {
    if (!MORAL.ligado) return {};
    const v = moralAgora(m, vis, agora), F = faixaMoral(v), re = Math.round(F.rende * (1 + (est?.mult || 0)) * 100);
    const P = a?.prodH, w = P ? Math.min(MORAL.prod.janelaH * 3600e3, agora - P.t0) : 0, i = iconeProd(m.fn);
    const tot = P ? P.ev.reduce((s, e) => s + e[1], 0) : 0;
    const ph = P && i && w >= MORAL.prod.minMin * 60e3 ? { i, n: Math.round(tot / (w / 3600e3)) } : null;
    // pt: a quantidade exata que ele pegou na ordem (nas últimas janelaH h ou desde que mudou a ordem), desde o 1º minuto
    // (André 2026-11-26: "bota a quantidade exata que eles estão catando"); m = minutos medidos. Só o painel usa
    const el = j && a && !a.morto && !j.morto && Math.hypot(a.x - j.x, a.z - j.z) <= MORAL.elogioPerto && !((m.el || 0) + MORAL.elogioH * 3600e3 > agora);
    // fm: o que a Despensa tira ou põe no rende (%); tr: quanto a moral anda por hora agora (André 2026-11-25: "estavam com
    // 100% agora estão com 90%" no Livre: era a fome, não a moral; o menu mostra a comida e o tocar diz os dois)
    const fm = Math.round((est?.mult || 0) * 100), livre = !m.fn || m.fn.k === 'livre';
    const perto = !!(j && a && !a.morto && !j.morto && (Math.hypot(a.x - j.x, a.z - j.z) <= MORAL.perto || (!!a.time && a.time === j.time)));
    const tr = (perto ? MORAL.pertoH : livre ? MORAL.livreH : 0) - (!livre && m.fn.k !== 'seguir' && m.ot && agora - m.ot >= MORAL.cansaH * 3600e3 ? MORAL.cansaPorH : 0)
      - (vis && agora - vis >= MORAL.graca * 3600e3 ? MORAL.semLiderH : 0);
    // pt: o contador da ordem (m.oc, desde que a ordem foi dada; salvo); sem ele, as últimas janelaH h de antes
    const oc = m.oc && m.oc.k === this.chaveOrdem(m.fn) ? m.oc : null;
    const pt = oc && i ? { i, t: oc.n, m: Math.round((agora - oc.t0) / 60e3), desde: 1, ...(Math.round(oc.x) ? { x: Math.round(oc.x) } : {}), ...(oc.xp ? { xp: oc.xp, ...(Math.round(oc.xpx) ? { xpx: Math.round(oc.xpx) } : {}) } : {}) }
      : P && i ? { i, t: tot, m: Math.round(w / 60e3), ...(this.rendeNaColeta(m.fn) && re !== 100 ? { x: Math.round(tot - tot * 100 / re) } : {}) } : null;
    return { ml: Math.round(v), re, seta: F.seta, cor: F.cor, tr: v >= 100 && tr > 0 ? 0 : tr, ...(fm ? { fm, fn2: est.nome } : {}), ...(ph ? { ph } : {}), ...(pt ? { pt } : {}), ...(el ? { el: 1 } : {}) };
  },
  // o rende mexe na quantidade desta ordem? (minério, lenha, peixe: batidaColeta/pegarPeixe). x do pt: quanto veio a mais
  // (ou a menos) por causa do rende, para o painel mostrar "Coletou 120 (+20 pela moral)" (André 2026-11-26)
  rendeNaColeta(fn) { const R = fn?.k === 'recurso' && RECURSOS_CLA[fn.r]; return !!R && COLETA_ORDEM.includes(R.coleta); },
  // a cada minuto: o que cada recruta no mundo produziu na ordem (MORAL.prod). Grind: monstros (a.mortesProd, contados
  // em simulacao.js historia); recurso: o que entrou na mochila
  passoProdRecrutas(agora = Date.now()) {
    const J = MORAL.prod.janelaH * 3600e3;
    for (const x of this.amigosIa || []) {
      const a = x.amiga; if (!a) continue;
      const o = a.ia?.funcao?.k === 'alma' ? null : this.ordemDoRecruta(x), fn = o?.k === 'recurso' && a.ia?.levar ? { k: 'recurso', r: a.ia.levar.r } : o; // treinando: o que ele junta de verdade
      const i = iconeProd(fn); if (!i) { delete a.prodH; continue; }
      const k = fn.k === 'grind' ? 'grind' : 'r:' + fn.r;
      let P = a.prodH; if (!P || P.k !== k) P = a.prodH = { k, t0: agora, ev: [], ult: null };
      const n = k === 'grind' ? a.mortesProd | 0 : contarRecProd(a.prog.mochila, RECURSOS_CLA[fn.r].item) + (a.prodDep || 0); // a bolsa + o que já deixou no Baú do Clã
      if (P.ult != null && n > P.ult) P.ev.push([agora, n - P.ult]);
      const dn = P.ult != null && n > P.ult ? n - P.ult : 0;
      P.ult = n; P.ev = P.ev.filter((e) => agora - e[0] <= J);
      // o contador da ordem (André 2026-11-26): fica no membro (salvo), zera só quando a ordem muda
      const dxp = (a.xpProd || 0) - (P.xpUlt ?? (a.xpProd || 0)), dxx = (a.xpProdX || 0) - (P.xxUlt ?? (a.xpProdX || 0));
      P.xpUlt = a.xpProd || 0; P.xxUlt = a.xpProdX || 0;
      const re = a.rende || 1, m = this.membroDoRecruta(x);
      if (m) this.contarOrdem(x, m, { n: dn, x: o?.k === 'recurso' && this.rendeNaColeta(fn) && re !== 1 ? dn - dn / re : 0, xp: k === 'grind' ? dxp : 0, xpx: k === 'grind' ? dxx : 0 }, agora);
    }
  },
  // o membro (c.m / E.m) do recruta: onde fica o que é salvo dele (ordem, moral, contador)
  membroDoRecruta(x) {
    const K = this.claDoRecruta?.(x); if (!K) return null;
    const l = K.bot && K.E ? [...K.m, ...this.membrosFixosNpc(K.C, K.E)] : K.m;
    return l.find((o) => o.id === x.AMIGA.id) || null;
  },
  // contador da ordem (André 2026-11-26: "a partir do momento que eu mando até eu parar ... mesmo que eu deslogue e
  // volte, e mesmo que o servidor resete"): m.oc = { k, t0, n (monstros ou itens), x (a mais/menos pela moral e comida),
  // xp, xpx }. Fica no membro, que vai no save do líder (jogador) ou do clã bot. Zera quando a ordem (m.fn) muda.
  chaveOrdem(fn) { return fn?.k === 'grind' ? 'grind' : fn?.k === 'recurso' && fn.r && fn.r !== 'alma' ? 'r:' + fn.r : null; },
  contarOrdem(x, m, d, agora = Date.now()) {
    const k = this.chaveOrdem(m.fn);
    if (!k) { if (m.oc) { delete m.oc; this.sujarMembro(x); } return; }
    if (!m.oc || m.oc.k !== k) { m.oc = { k, t0: agora, n: 0, x: 0, xp: 0, xpx: 0 }; this.sujarMembro(x); }
    if (!(d.n || d.xp)) return;
    const o = m.oc; o.n += d.n | 0; o.x += d.x || 0; o.xp += Math.round(d.xp || 0); o.xpx += d.xpx || 0;
    this.sujarMembro(x);
  },
  sujarMembro(x) { const K = this.claDoRecruta?.(x); if (K?.corpo && !K.bot) K.corpo.progSujo = true; },
  // a ordem de um recruta (do clã do jogador ou do clã bot)
  ordemDoRecruta(x) {
    const K = this.claDoRecruta?.(x); if (!K) return null;
    const l = K.bot && K.E ? [...K.m, ...this.membrosFixosNpc(K.C, K.E)] : K.m;
    return l.find((o) => o.id === x.AMIGA.id)?.fn || null;
  },
  // o efeito da mesa no corpo de cada recruta: dano e XP (a.mesa: aplicarStatus e ganharXP em simulacao.js) e, faminto,
  // o vigor volta mais devagar
  // rendeDe(x): o rende da moral dele (MORAL); o total (moral x mesa) vai no a.mesa (dano e XP) e no a.rende (coleta)
  mesaRecrutas(ctxs, est, agora = Date.now(), rendeDe = null) {
    for (const x of ctxs) {
      const a = x.amiga; if (!a) continue;
      const r = (1 + (est.mult || 0)) * (rendeDe?.(x) ?? 1), mult = Math.round((r - 1) * 1000) / 1000;
      if (r !== 1) a.rende = r; else delete a.rende;
      if ((a.mesa || 0) !== mult) { if (mult) a.mesa = mult; else delete a.mesa; this.aplicarStatus?.(a); }
      const vg = a.prog?.vigor;
      if (est.vigor < 1 && vg && a.mesaT && agora > a.mesaT) {
        const m = vg.m || VIGOR.max, v = vigorDe(vg);
        if (v < m) a.prog.vigor = { ...vg, v: Math.max(0, v - (1 - est.vigor) * VIGOR.max * ((agora - a.mesaT) / 1000) / VIGOR.enche), t: agora };
      }
      a.mesaT = agora;
    }
  },
  // o que o app mostra na Despensa (painel do clã)
  despensaInfo(D, itens, n, B) {
    if (!DESPENSA.ligado) return null;
    const e = estoqueDespensa(itens), est = this.estadoDespensa(D, itens, n);
    return { bau: itens ? 1 : 0, n, dia: Math.ceil(racoesDia(n)), bem: Math.ceil(DESPENSA.bem.dias * racoesDia(n)), tem: e.racoes, tipos: e.tipos, tiposBem: DESPENSA.bem.tipos,
      k: e.k, racao: DESPENSA.racao, estado: est.nome, mult: est.mult, ...(est.fome ? { fome: 1 } : {}), ...(est.bem ? { bemOk: 1 } : {}),
      ...(B ? { lenha: { semana: lenhaSemana(B.nv), tem: contar(itens || [], 'lenha'), deve: D?.lf | 0, frio: D?.frio ? 1 : 0 } } : {}) }; // sem tempo que anda: o painel só refaz quando algo muda
  },
  // clã bot: quantos moram (líder + fixos + recrutas)
  moradoresNpc(C, E) { return 1 + E.m.length + fixosNpc(C, E).length; },
  // clã bot: o que falta na despensa e na lenha ({ peixe, lenha: 0..1 }) para o líder mandar buscar. Às vezes ele
  // esquece (DESPENSA.bots.esquece), nunca com o clã com fome ou a base fria
  faltaDespensaNpc(C, E, rnd = Math.random) {
    const f = {}; if (!DESPENSA.ligado || !E.dsp) return f;
    const X = DESPENSA.bots, D = E.dsp;
    if (!D.fome && !D.frio && rnd() < X.esquece) return f;
    const alvo = X.dias * racoesDia(this.moradoresNpc(C, E)), tem = estoqueDespensa(E.bau).racoes;
    if (tem < alvo) f.peixe = D.fome ? 1 : 1 - tem / alvo;
    const B = this.baseDoClaNpc?.(C);
    if (B) { const q = lenhaSemana(B.nv) + (D.lf | 0), t = contar(E.bau || [], 'lenha'); if (q > 0 && t < q) f.lenha = D.frio ? 1 : 1 - t / q; }
    return f;
  },
  // clã bot com fome ou frio há DESPENSA.bots.compraH horas: o líder compra com o ouro dele (o clã nunca trava)
  comprarDespensaNpc(E, L, n, agora = Date.now()) {
    const X = DESPENSA.bots, D = E.dsp, b = E.bau; if (!D || !b || !L) return false;
    const H = X.compraH * 3600e3; let mexeu = false;
    const compra = (k, q) => {
      const preco = Math.max(1, (ITENS[k]?.venda | 0) * X.compraK), pode = Math.min(q, Math.floor((L.prog.ouro | 0) / preco));
      const g = pode > 0 ? guardarQueCabe(b, { k, n: pode }) : 0;
      if (g) { L.prog.ouro -= g * preco; mexeu = true; }
    };
    if (D.fome && agora - D.fome >= H) compra(X.comida, Math.ceil(racoesDia(n) / DESPENSA.racao[X.comida]));
    if (D.frio && agora - D.frio >= H && D.lf > 0) compra('lenha', D.lf);
    return mexeu;
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
        ...(bau ? { bau } : {}), ...(despensaValida(e?.dsp) ? { dsp: despensaValida(e.dsp) } : {}), ...(Number.isFinite(+e?.visto) && +e.visto > 0 ? { visto: +e.visto } : {}),
        ...(e?.mo && typeof e.mo === 'object' ? { mo: Object.fromEntries(Object.entries(e.mo).slice(0, 40).filter(([id]) => /^[a-z0-9_]{2,24}$/i.test(id)).map(([id, o]) => [id, moralValida(o)])) } : {}), ...(typeof e?.jd === 'string' && /^\d{4}-\d\d-\d\d$/.test(e.jd) ? { jd: e.jd } : {}) }; // moral (MORAL)
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
    if (!this.genteOnline()) return; // sem ninguém no mundo (nem painel do clã aberto), o líder não tem corpo
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
        if (ms >= CLA.fora.minimo) for (const x of ctxs) {
          const m = doM(x); if (m?.fn) this.trabalhoFora(x, m, ms / 3600e3, L.prog.nivel | 0);
          // a casa do lote (André 2026-11-25: "até agora não fizeram os telhados os bots"): o bot só constrói no mundo, nos
          // intervalos entre uma tarefa e outra; o tempo fora conta a metade (ele também estaria trabalhando)
          this.casaFora(x, ms / 2000);
        }
      }
      E.foraFeito = true;
      if (!E.visto || agora - E.visto > 600e3) { E.visto = agora; mudou = true; }
      for (const x of ctxs) { const m = doM(x); if (m?.fn) this.aplicarFuncao(L, x, m, trocou.has(m.id)); }
      this.missaoClaNpc?.(C, L, ctxs); // Escolta do Clã: o clã bot faz a dele também (shared/missao-cla.js)
      this.jantarNpc?.(C, E, ctxs); // jantar do clã, uma vez por dia (shared/jantar.js)
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
      // Despensa e lenha (DESPENSA, André 2026-11-24: "eles têm que botar"): o clã bot come e queima lenha como o do jogador
      if (DESPENSA.ligado) {
        const D = (E.dsp ||= {}), n = this.moradoresNpc(C, E), b = Array.isArray(E.bau) ? E.bau : (E.bau = Array(CLA.bauCla).fill(null));
        if (this.comprarDespensaNpc(E, L, n)) mudou = true;
        if (this.passoDespensa(D, b, n, this.baseDoClaNpc?.(C)).mudou) mudou = true;
        this.passoMoralNpc(E, L, ctxs.filter((x) => x.AMIGA.id !== C.lider), doM, agora);
        this.mesaRecrutas(ctxs.filter((x) => x.AMIGA.id !== C.lider), this.estadoDespensa(D, b, n), agora, (x) => faixaMoral(E.mo?.[x.AMIGA.id]?.mo ?? MORAL.inicio).rende);
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
    const pega = new Set([...X.itens, alma, ...(DESPENSA.ligado ? Object.keys(DESPENSA.racao) : [])]); // a comida vai para a despensa (DESPENSA)
    let mexeu = false;
    for (const x of ctxs) {
      const a = x.amiga; if (!a || a.morto || x.AMIGA.id === C.lider) continue;
      // André 2026-11-24 ("o que o líder pede, eles fazem e vai para o clã; o que fazem no tempo livre fica para eles e eles
      // podem vender"): só o recurso da ordem dele (ia.levar) e a Alma; o resto da bolsa é dele
      const lv = a.ia?.levar, daOrdem = (o) => o.k === alma || (lv && this.ehDoLevar(o, lv));
      const mo = a.prog?.mochila || []; let deu = false;
      for (let i = 0; i < mo.length; i++) {
        const o = mo[i]; if (!o || o.h || !pega.has(o.k) || !daOrdem(o)) continue; // o.h: travado (cadeado), como em contar/tirar
        const n = o.n || 1, q = guardarQueCabe(b, { k: o.k, n }); if (!q) continue; // baú cheio: fica com ele
        mo[i] = q >= n ? null : { ...o, n: n - q }; deu = true;
      }
      if (deu) { mexeu = true; x.guardarAmiga?.(); }
    }
    // o que guardar: o maior pedido de cada material nos próximos níveis (aço conta também como barra e minério de ferro,
    // que a fornalha do líder transforma: fundirBauNpc). Alma nunca vende (não tem preço e o clã sempre precisa).
    const fica = { [alma]: Infinity }, nv = E.nv || 1, max = (k, q) => { fica[k] = Math.max(fica[k] || 0, q); };
    if (DESPENSA.ligado) { for (const k of Object.keys(DESPENSA.racao)) fica[k] = Infinity; const Bb = this.baseDoClaNpc?.(C); if (Bb) max('lenha', lenhaSemana(Bb.nv) * 2 + (E.dsp?.lf | 0)); } // comida nunca vende; lenha de 2 semanas da base
    for (let n = nv + 1; n <= nv + X.niveis; n++) {
      const N = CLA.niveis[n]; if (!N) break;
      for (const [k, q] of Object.entries(N.mat || {})) {
        max(k, q);
        if (k === 'barra_ferro') max('minerio_ferro', q * 3);
        if (k === 'barra_aco') { max('barra_ferro', 30 + q * 2); max('minerio_ferro', (30 + q * 2) * 3); }
      }
    }
    // a sobra: com pouco anúncio do item no leilão, o líder anuncia lá (André 2026-11-24); senão vende na loja
    let ouro = 0;
    const Lei = this.leilao, ctxL = this.amigosIa.find((x) => x.AMIGA.id === C.lider), conta = ctxL?.AMIGA.conta ?? L.conta, agora = Date.now();
    for (const k of pega) {
      const sobra = contar(b, k) - (fica[k] || 0), preco = ITENS[k]?.venda | 0;
      if (!(sobra > 0) || !(preco > 0)) continue;
      if (Lei && conta != null && Lei.anunciosDe(k, agora) < LEILAO_BOT.pouco && Lei.meus(conta).length < LEILAO_BOT.maxAnuncios) {
        const n = Math.min(sobra, ITENS[k].pilha || 50), total = Math.max(1, Math.round(Lei.precoMercado({ k, n: 1 }, agora) * 1.1 * n)), taxa = Lei.taxaAnuncio(total);
        if ((L.prog.ouro | 0) >= taxa && typeof Lei.anunciar(conta, ctxL?.AMIGA.nome || 'Líder', { k, n }, total, LEILAO_BOT.horas, agora) !== 'string') {
          L.prog.ouro -= taxa; tirar(b, k, n); mexeu = true; this.aoLeilao?.(Lei);
          if (sobra - n > 0) { tirar(b, k, sobra - n); ouro += (sobra - n) * preco; }
          continue;
        }
      }
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
    for (const [r, fr] of Object.entries(this.faltaDespensaNpc(C, E, rnd))) falta[r] = Math.max(falta[r] || 0, fr); // comida e lenha (DESPENSA)
    let fazenda = false, arvores = false, protege = 0;
    for (const m of [...E.m, ...this.membrosFixosNpc(C, E)]) {
      const x = ctxs.find((o) => o.AMIGA.id === m.id), a = x?.amiga; if (!a || a.morto) continue;
      if (this.descansoNpc(E, m, rnd)) { if (m.fn?.k !== 'livre') { m.fn = { k: 'livre' }; mudou.push(m.id); } continue; } // moral (MORAL.bots)
      const cota = this.grindSobraBot(x, a) > 0, fraco = (a.prog.nivel | 0) <= nvL - O.abaixo, vigor = vigorDe(a.prog.vigor) >= 1;
      const op = [];
      if (cota) op.push([{ k: 'grind' }, (fraco ? 1 : 0.35) * P.grind]);
      for (const [r, fr] of Object.entries(falta)) {
        if (r === 'alma') { op.push([{ k: 'recurso', r: 'alma' }, fr * P.alma]); continue; }
        if (vigor || !COLETA_ORDEM.includes(RECURSOS_CLA[r]?.coleta)) op.push([{ k: 'recurso', r }, fr * P.recurso]); // caça (carne, couro) não pede vigor (André 2026-11-26)
      }
      op.push([{ k: 'proteger', p: 'lider' }, (ameaca ? 1.5 / (1 + protege) : 0.1) * P.proteger]);
      if (temLote && !fazenda) op.push([{ k: 'fazenda', s: 'cenoura' }, 0.4 * P.fazenda]);
      // Plantar árvores (André 2026-11-25: "clãs bot fazendo também, pra aumentar o número de árvores no mundo"): um por
      // clã, só quem ainda não tem as mudas do limite crescendo; pesa mais quando falta lenha
      if (!arvores && CLA.arvores.bots && this.mudasRecruta(m.id) < PLANTIO.mudasMax) op.push([{ k: 'arvores', s: ARVORES_PLANTIO[m.fn?.s] ? m.fn.s : CLA.arvores.bots[Math.floor(rnd() * CLA.arvores.bots.length)] }, (0.25 + (falta.lenha || 0) * 0.5) * P.fazenda]);
      let best = null, bp = -1;
      for (const [fn, p] of op) { const v = p * sorte(); if (v > bp) { bp = v; best = fn; } }
      if (!best) continue;
      if (best.k === 'fazenda') fazenda = true;
      if (best.k === 'arvores') arvores = true;
      if (best.k === 'proteger') protege++;
      if (best.k === 'recurso' && falta[best.r]) falta[best.r] *= 0.5; // o próximo vê que esse já tem gente
      if (JSON.stringify(best) !== JSON.stringify(m.fn || null)) { m.fn = best; mudou.push(m.id); }
    }
    return mudou;
  },
  // o líder bot dá descanso (Livre) a quem está cansado ou com a moral baixa (MORAL.bots). true: descansa agora
  descansoNpc(E, m, rnd = Math.random, agora = Date.now()) {
    const B = MORAL.bots, o = E.mo?.[m.id]; if (!MORAL.ligado || !o) return false;
    if (o.desc > agora) return true;
    const cansado = o.ot && agora - o.ot >= MORAL.cansaH * 3600e3, baixo = moralAgora({ ...o, fn: m.fn }, null, agora) < B.abaixo;
    if (!(cansado || baixo) || rnd() < B.esquece) return false;
    o.desc = agora + B.descansoH * 3600e3; return true;
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
    // nível de um bot (André 2026-11-24: "aparecendo o nível do líder", não só o dos recrutas): o corpo no mundo, senão o salvo
    const nvBot = (id) => (this.amigosIa?.find((x) => x.AMIGA.id === id)?.amiga?.prog?.nivel | 0) || (this.npcSalvos?.get(id)?.prog?.nivel | 0) || 0;
    const comNv = (id) => { const v = nvBot(id); return v ? `${nome(id)} (Nv ${v})` : nome(id); };
    return CLAS_NPC.map((C) => ({ n: C.n, nv: this.clasNpc[C.id].nv || 1, lider: nome(C.lider), nvLider: nvBot(C.lider), inimigo: this.racaDe(j) !== C.raca ? 1 : 0, raca: RACAS[C.raca]?.nome || C.raca, recrutas: fixosNpc(C, this.clasNpc[C.id]).length + this.clasNpc[C.id].m.length, // os fixos contam (André 2026-11-22), os de fora não
      membros: [...fixosNpc(C, this.clasNpc[C.id]).map(comNv), ...this.clasNpc[C.id].m.map((m) => `${m.nome} (${tierDe(m.tier).nome} Nv ${m.nv}${m.fn ? ' · ' + (CLA.funcoes.find((F) => F.id === m.fn.k)?.nome || '') : ''})`)] }));
  },
};

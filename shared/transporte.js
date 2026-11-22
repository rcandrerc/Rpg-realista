// FASE 1 (André 2026-11-08/09): packs e transportes, cópia do Quimera. Números em shared/dados.js (PACKS, PACK_REGRAS,
// VEICULOS, MERCADORES_PACK). Quem decide é o servidor: o celular só pede ("pack" e "veiculo") e mostra.
// Estas funções entram na Simulacao (Object.assign no fim de simulacao.js), então "this" é a Simulacao.
//
// Onde fica cada coisa:
// - j.prog.pack: o pack nas costas { k, ox, oz, mo, nav } (k = tipo, ox/oz = onde foi feito, mo = mercador, nav = metros
//   que andou no porão de um navio). Fica na conta: sai do jogo com pack, volta com ele.
// - j.prog.carrinho: { lv, comb, vida, quebrado, packs: [], chao: {x, z, ry} | null } (chao null = está na mochila).
// - j.prog.navio: { porao: [], chao: {x, z, ry} | null }. O barquinho não fica no mundo: desceu, volta para a mochila.
// - j.veiculo: 'carrinho' | 'barquinho' | 'navio' | null (dirigindo agora; não vai para a conta).
// - this.packsChao: packs largados no chão (qualquer um pega; somem depois de PACK_CHAO_DURA s).
import { PACKS, PACK_REGRAS as PR, VEICULOS as V, ITENS, CACA, PROF_MAX, tempoCriar, GUERRA } from './dados.js';
import { contar, tirar, guardar, gastarVigor, vigorAgora, profNivel } from './progresso.js';
import { noLago, AGUA } from './relevo.js';
import { motivoLibera, missaoAtual, etapasDe } from './historia.js'; // progressão (André 2026-11-10)

const r2 = (n) => Math.round(n * 100) / 100;
const PACK_CHAO_DURA = 1800; // s: pack esquecido no chão some depois de meia hora
const MAX_CHAO = 200;

// ---------- carrinho sólido (André 2026-11-13: "não quero passar por dentro dele"; "pular em cima dele") ----------
// As caixas do carrinho de nível nv: { trator: [...], carreta: [...] }, cada uma [xmin, xmax, zmin, zmax, topo] (m).
// trator no espaço do carrinho, carreta no espaço do engate (ela gira na curva). Mesma conta no app (transporte.gd caixas).
export function caixasCarrinho(nv) {
  const S = V.carrinho.solido, K = S.cacamba, fileiras = nv <= 1 ? 1 : 2;
  const fundo = K.frente - fileiras * K.fileira - 2 * K.folga;
  const carreta = [S.lanca.slice(), [S.rodas[0], S.rodas[1], fundo, K.frente, S.rodas[2]]];
  for (let f = 0; f < fileiras; f++) {
    const andar2 = (nv >= 3 && f === 0) || (nv >= 4 && f === 1);
    carreta.push([-K.meia, K.meia, f === fileiras - 1 ? fundo : K.frente - K.folga - (f + 1) * K.fileira,
      f === 0 ? K.frente : K.frente - K.folga - f * K.fileira, K.topo + (andar2 ? K.andar2 : 0)]);
  }
  return { trator: S.trator, carreta };
}
// topo do carrinho mais alto embaixo de (x, z) (-Infinity = nenhum). O servidor não sabe o giro da carreta: conta ela
// reta atrás do trator, com 0,3 m de folga (só serve para saber se quem está em cima pisa no chão).
const _caixas = new Map();
export function topoCarrinho(carrinhos, x, z) {
  let h = -Infinity;
  for (const c of carrinhos) {
    const dx = x - c.x, dz = z - c.z;
    if (dx * dx + dz * dz > 16) continue;
    const co = Math.cos(c.ry), si = Math.sin(c.ry), lx = dx * co - dz * si, lz = dx * si + dz * co;
    let cx = _caixas.get(c.lv); if (!cx) _caixas.set(c.lv, cx = caixasCarrinho(c.lv));
    const ez = V.carrinho.solido.engate[2], ey = V.carrinho.solido.engate[1];
    for (const b of cx.trator) if (lx >= b[0] && lx <= b[1] && lz >= b[2] && lz <= b[3]) h = Math.max(h, c.y + b[4]);
    for (const b of cx.carreta) if (lx >= b[0] - 0.3 && lx <= b[1] + 0.3 && lz - ez >= b[2] - 0.3 && lz - ez <= b[3] + 0.3) h = Math.max(h, c.y + ey + b[4]);
  }
  return h;
}

// ---------- conta do preço (Quimera UK/VK) ----------
export function fatorDistancia(d) {
  const D = PR.dist;
  if (d <= D.curto) return Math.min(D.maxCurto, Math.max(D.a, D.a + d * D.porM));
  return Math.min(D.max, D.maxCurto + (d - D.curto) * D.porMLongo);
}
// fator da área: nível do campo de caça mais perto (até PR.areas.raio m); longe de todos = 1
// André 2026-11-16 (estudo da economia): com areas.forte, vale o campo mais forte a até forte m (Aurora pagava área 1)
export function fatorArea(x, z) {
  let melhor = null, dm = PR.areas.raio, forte = 0;
  for (const c of CACA) { const d = Math.hypot(c.x - x, c.z - z); if (d < dm) { dm = d; melhor = c; } if (PR.areas.forte && d < PR.areas.forte) forte = Math.max(forte, c.nivel || 1); }
  const nv = PR.areas.forte ? forte || 1 : melhor ? melhor.nivel || 1 : 1, A = PR.areas;
  let f = 1; for (let i = 0; i < A.niveis.length; i++) if (nv >= A.niveis[i]) f = A.fator[i];
  return f;
}
// Mercador (profissão): Nv 1 = nada, Nv 20 = -15% de material e +25% no preço
export const kMercador = (pts) => (profNivel(pts) - 1) / (PROF_MAX - 1);
export const custoPack = (k, pts = 0) => Object.fromEntries(Object.entries(PACKS[k].custo).map(([c, n]) => [c, Math.max(1, Math.round(n * (1 - PR.mercador.material * kMercador(pts))))]));
// quanto o mercador "para" paga pelo pack (sem o mercado cheio, que depende de quem entrega)
export function precoPack(pack, para, pts = 0) {
  const P = PACKS[pack.k]; if (!P) return 0;
  const d = Math.hypot(para.x - pack.ox, para.z - pack.oz);
  const area = Math.max(fatorArea(pack.ox, pack.oz), fatorArea(para.x, para.z));
  const navio = (pack.nav || 0) >= PR.navioMin ? PR.navio : 1;
  return Math.round(P.base * fatorDistancia(d) * PR.k * (1 + PR.mercador.preco * kMercador(pts)) * area * PR.extra * navio);
}
// mercado cheio (Quimera mgPkDm): por mercador e tipo de pack, guardado na conta (p.pkD = { 'npc:k': [n, ms] })
const mercadoN = (p, chave, agora) => { const e = p.pkD?.[chave]; if (!e) return 0; const s = e[0] - Math.max(0, agora - e[1]) / (PR.mercado.volta * 1000); return s > 0 ? s : 0; };
export const mercadoK = (p, npc, k, agora = Date.now()) => Math.max(PR.mercado.minimo, 1 - PR.mercado.cai * Math.max(0, mercadoN(p, npc + ':' + k, agora) - PR.mercado.livres));
export function mercadoConta(p, npc, k, agora = Date.now()) {
  const D = p.pkD ||= {};
  for (const q of Object.keys(D)) if (mercadoN(p, q, agora) <= 0) delete D[q];
  D[npc + ':' + k] = [mercadoN(p, npc + ':' + k, agora) + 1, agora];
}
// valida o que vem da conta (progressoValido chama)
export function packValido(o) {
  if (!o || typeof o !== 'object' || !PACKS[o.k]) return null;
  const num = (v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e5;
  if (!num(o.ox) || !num(o.oz)) return null;
  const r = { k: o.k, ox: Math.round(o.ox), oz: Math.round(o.oz) };
  if (typeof o.mo === 'string' && o.mo.length < 24) r.mo = o.mo;
  if (num(o.nav) && o.nav > 0) r.nav = Math.round(o.nav);
  if (o.ra === 'chama' || o.ra === 'geada') r.ra = o.ra;
  if (o.rb === 1) r.rb = 1; // roubado da outra raça (GUERRA.roubado: paga mais)
  return r;
}
const lugarValido = (q) => (q && [q.x, q.z, q.ry].every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e4) ? { x: r2(q.x), z: r2(q.z), ry: r2(q.ry) } : null);
export const carrinhoNovo = () => ({ lv: 1, comb: 0, vida: V.carrinho.vida, vm: V.carrinho.vida, quebrado: false, packs: [], chao: null });
export function carrinhoValido(c) {
  if (!c || typeof c !== 'object') return null;
  const C = V.carrinho, n = carrinhoNovo();
  n.lv = Math.min(C.nivelMax, Math.max(1, c.lv | 0 || 1));
  n.comb = Math.min(C.galao * C.tanque, Math.max(0, +c.comb || 0));
  // vm: a vida máxima de quando gravou (André 2026-11-21: 400 -> 2500); mudou, a vida vai na mesma proporção
  const vm = +c.vm > 0 ? +c.vm : 400;
  n.vida = Math.min(C.vida, Math.max(0, Math.round((+c.vida || 0) * C.vida / vm)));
  n.quebrado = !!c.quebrado || n.vida <= 0;
  n.packs = (Array.isArray(c.packs) ? c.packs : []).map(packValido).filter(Boolean).slice(0, C.capacidade * C.nivelMax);
  n.chao = lugarValido(c.chao);
  return n;
}
export function navioValido(c) {
  if (!c || typeof c !== 'object') return null;
  const N = V.navio, vida = c.vida == null ? N.vida : Math.min(N.vida, Math.max(0, +c.vida || 0)); // casco (André 2026-11-21)
  return { porao: (Array.isArray(c.porao) ? c.porao : []).map(packValido).filter(Boolean).slice(0, N.porao), chao: lugarValido(c.chao), vida, quebrado: !!c.quebrado || vida <= 0 };
}
export const capacidadeCarrinho = (c) => V.carrinho.capacidade * Math.min(V.carrinho.nivelMax, Math.max(1, c?.lv | 0 || 1));
export const velCarrinho = (c) => V.carrinho.vel - V.carrinho.perdePorPack * Math.max(0, (c?.packs?.length || 0) - V.carrinho.packsLivres);
// água funda o bastante em (x, z)? (lago hoje; o mar entra na FASE 3)
export const fundoAgua = (x, z) => noLago(x, z)?.fundo || 0;
// o veículo k pode estar em (x, z)? carrinho fora da água; barquinho e navio só na água funda (a mesma conta do andouVeiculo)
export function lugarDoVeiculo(k, x, z) {
  const f = fundoAgua(x, z);
  if (k === 'carrinho') return f <= 0.3;
  if (k === 'barquinho') return f >= V.barquinho.fundo * 0.5;
  if (k === 'navio') return f >= V.navio.fundo * 0.5;
  return true;
}
// navio novo (André 2026-11-21, escuna de dois mastros de 12,8 m): quem pilota fica de pé atrás da roda do leme, a
// V.navio.leme m do meio do navio (o celular manda a posição do herói, não a do meio). O meio do navio é esta conta;
// ancorar, sair do jogo, morrer e a foto usam o meio (antes o navio ancorado pulava para onde o herói estava)
export function centroNavio(j) {
  const L = V.navio.leme || 0;
  return { x: r2(j.x - Math.sin(j.ry || 0) * L), z: r2(j.z - Math.cos(j.ry || 0) * L), ry: r2(j.ry || 0) };
}
// meia largura do convés do navio em z (local; -1 = fora dele, na frente da proa ou atrás da popa)
export function bocaNavio(lz) {
  const B = V.navio.solido.boca;
  if (lz < B[0][0] || lz > B[B.length - 1][0]) return -1;
  for (let i = 1; i < B.length; i++) if (lz <= B[i][0]) { const a = B[i - 1], b = B[i], t = (lz - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * t; }
  return -1;
}
// (x, z) no convés de um destes navios ({x, z, ry} = o meio de cada um)? devolve { n, lx, lz } ou null
export function noConves(navios, x, z) {
  for (const n of navios) {
    const dx = x - n.x, dz = z - n.z; if (dx * dx + dz * dz > 49) continue;
    const s = Math.sin(n.ry || 0), c = Math.cos(n.ry || 0), lx = dx * c - dz * s, lz = dx * s + dz * c;
    const w = bocaNavio(lz); if (w >= 0 && Math.abs(lx) <= w + 0.15) return { n, lx, lz };
  }
  return null;
}
// André 2026-11-21 ("barcos e navios mercantes... surgem no meio do continente"): a água mais perto de (x, z) onde o
// veículo k cabe (anéis de 1 m até 20 m, depois de 3 m até raio). null = nenhuma
export function aguaMaisPerto(k, x, z, raio = 400) {
  if (lugarDoVeiculo(k, x, z)) return { x, z };
  for (let r = 1; r <= raio; r += r < 20 ? 1 : 3) {
    const n = Math.max(16, Math.min(96, Math.round(r * 2)));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
      if (lugarDoVeiculo(k, px, pz)) return { x: r2(px), z: r2(pz) };
    }
  }
  return null;
}
// barquinho de volta para a mochila; cheia, fica guardado à parte (prog.barcoFora) e volta quando abrir lugar
// cadeado (André 2026-11-15: "travei ele... e sumiu da bag"): o barquinho e o navio saem da mochila quando vão para a água e
// voltavam sem o cadeado; aí o Selecionar tudo / Vender vários pegava junto. prog.vcad lembra quem estava trancado.
export function tirarVeiculo(p, k) {
  for (let i = p.mochila.length - 1; i >= 0; i--) {
    const o = p.mochila[i]; if (!o || o.k !== k) continue;
    if (o.cad) (p.vcad ||= {})[k] = 1; else if (p.vcad) delete p.vcad[k];
    p.mochila[i] = null; return true;
  }
  return false;
}
export function guardarVeiculo(p, k) {
  if (!guardar(p.mochila, { k, n: 1, ...(p.vcad?.[k] ? { cad: 1 } : {}) })) return false;
  if (p.vcad) { delete p.vcad[k]; if (!Object.keys(p.vcad).length) delete p.vcad; }
  return true;
}
export function devolverBarquinho(p) { if (!guardarVeiculo(p, 'barquinho')) p.barcoFora = 1; }
// o ponto mais perto do herói (anéis de 0,5 m, 24 direções, a da frente primeiro) que passa em ok(x, z)
export function acharPonto(j, ok, raio) {
  for (let r = 0.5; r <= raio + 0.01; r += 0.5) for (let i = 0; i < 24; i++) {
    const a = j.ry + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 12), x = j.x + Math.sin(a) * r, z = j.z + Math.cos(a) * r;
    if (ok(x, z)) return { x: r2(x), z: r2(z) };
  }
  return null;
}

export const Transporte = {
  // ---------- packs ----------
  mercadorPack(j, npcId) {
    const n = (this.mapa.npcs || []).find((o) => o.id === npcId && o.funcao === 'pack');
    return n && Math.hypot(n.x - j.x, n.z - j.z) <= PR.falar + 0.5 ? n : null;
  },
  // pode pôr no carrinho (parado, perto, com lugar)?
  carrinhoPerto(j, metros) {
    const c = j.prog.carrinho;
    if (!c || c.quebrado) return null;
    const pos = j.veiculo === 'carrinho' ? { x: j.x, z: j.z } : c.chao;
    return pos && Math.hypot(pos.x - j.x, pos.z - j.z) <= metros ? c : null;
  },
  navioPerto(j, metros = V.navio.perto) {
    const n = j.prog.navio;
    if (!n) return null;
    const pos = j.veiculo === 'navio' ? { x: j.x, z: j.z } : n.chao;
    return pos && Math.hypot(pos.x - j.x, pos.z - j.z) <= metros ? n : null;
  },
  // pode fazer o pack nesse mercador agora? { motivo } ou { n, custo, cart }
  conferirPack(j, npcId) {
    const p = j.prog;
    const n = this.mercadorPack(j, npcId); if (!n) return { motivo: 'Chegue perto do mercador' };
    { const lib = motivoLibera(p, 'pack'); if (lib) return { motivo: `Packs: ${lib.toLowerCase()}` }; } // progressão (André 2026-11-10)
    const custo = custoPack(n.merch, p.prof.mer);
    const falta = Object.entries(custo).filter(([k, q]) => contar(p.mochila, k) < q);
    if (falta.length) return { motivo: 'Falta material: ' + falta.map(([k, q]) => `${ITENS[k].nome} ${contar(p.mochila, k)}/${q}`).join(', ') };
    const cart = p.pack ? this.carrinhoPerto(j, V.carrinho.carregar) : null;
    if (p.pack && !(cart && j.veiculo !== 'carrinho' && cart.packs.length < capacidadeCarrinho(cart))) return { motivo: 'Suas costas já têm um pack. Ponha no carrinho ou entregue primeiro.' };
    if (vigorAgora(p.vigor) < PR.vigor) return { motivo: `Sem vigor: fazer um pack gasta ${PR.vigor}` };
    return { n, custo, cart };
  },
  // a barrinha encheu: confere de novo, gasta e põe o pack nas costas (ou no carrinho). Devolve o motivo se não deu.
  fazerPackUm(j, npcId) {
    const id = j.id, p = j.prog, aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    const r = this.conferirPack(j, npcId); if (r.motivo) return r.motivo;
    const { n, custo, cart } = r, P = PACKS[n.merch];
    const novo = { k: n.merch, ox: Math.round(n.x), oz: Math.round(n.z), mo: n.id, ra: this.racaDe?.(j) || 'chama' }; // ra: a raça de quem fez (pack roubado, André 2026-11-21)
    gastarVigor(p, PR.vigor);
    for (const [k, q] of Object.entries(custo)) tirar(p.mochila, k, q);
    if (p.pack) { cart.packs.push(novo); aviso('Pack feito e colocado no carrinho!'); } else { p.pack = novo; j.montado = null; aviso(`${P.nome} nas costas! Leve pra outro mercador.`); }
    this.pontosProf(j, 'mer', PR.vigor / 2);
    this.evento({ t: 'pack', para: id, acao: 'fez', k: n.merch });
    this.historia(j, 'pack_fez', { k: n.merch });
    j.progSujo = true; this.avisarProg(j);
    return '';
  },
  // o pack do tipo k é da missão (uma etapa daqui pra frente leva esse pack a outro NPC) e entregar em npcId deixaria a
  // missão sem ele? Devolve o NPC da missão, ou ''. André 2026-11-17: ficou só com o carrinho na etapa do Pedrão.
  packDaMissao(j, k, npcId) {
    const p = j.prog, h = p.hist; if (!h?.ac || j.bot) return '';
    const M = missaoAtual(p); if (!M) return '';
    const E = etapasDe(M).slice(h.e || 0).find((o) => o.ev === 'pack' && o.k === k);
    if (!E || E.npc === npcId) return '';
    const ok = (o) => o?.k === k, tem = (ok(p.pack) ? 1 : 0) + (p.carrinho?.packs || []).filter(ok).length + (p.navio?.porao || []).filter(ok).length;
    const precisa = (E.n || 1) - (etapasDe(M)[h.e || 0] === E ? h.n || 0 : 0);
    return tem <= precisa ? E.npc : '';
  },
  // m = { acao, npc, de, i, g }
  pack(id, m) {
    const j = this.jogadores.get(id); if (!j || j.morto || j.criando || !m) return;
    const p = j.prog, aviso = (texto) => this.evento({ t: 'aviso', para: id, texto }), agora = Date.now();
    const pronto = () => { j.progSujo = true; this.avisarProg(j); };
    // fazer: a barrinha de criar (j.fabrica, igual a qualquer criação, André 2026-11-12) carrega e o pack sai no fim
    // (passoFabrica chama fazerPackUm, que confere tudo de novo). "Parar" na barrinha cancela sem gastar nada.
    if (m.acao === 'fazer') {
      if (j.fabrica) return aviso('Já está criando: espere terminar ou pare');
      const r = this.conferirPack(j, m.npc); if (r.motivo) return aviso(r.motivo);
      const nome = PACKS[r.n.merch].nome, dur = tempoCriar({ custo: r.custo });
      j.fabrica = { pk: true, npc: r.n.id, k: 'pack', nome, n: 1, feito: 0, dur, fim: this.tempo + dur };
      this.evento({ t: 'fabricando', para: id, k: 'pack', nome, v: 'Fazendo', n: 1, feito: 0, dur });
      return;
    }
    if (m.acao === 'entregar') {
      const n = this.mercadorPack(j, m.npc); if (!n) return aviso('Chegue perto do mercador');
      let lista = null, i = m.i | 0;
      if (m.de === 'costas') { if (!p.pack) return aviso('Você não está com pack nas costas'); }
      else if (m.de === 'carrinho') { const c = this.carrinhoPerto(j, V.carrinho.entregar); if (!c) return aviso('O carrinho precisa estar perto do mercador'); lista = c.packs; }
      else if (m.de === 'porao') { const nv = this.navioPerto(j, V.navio.perto); if (!nv) return aviso('O navio precisa estar perto do mercador'); lista = nv.porao; }
      else return;
      const pk = lista ? lista[i] : p.pack; if (!pk) return;
      if (Math.hypot(n.x - pk.ox, n.z - pk.oz) < PR.perto) return aviso('Esse pack foi feito aqui. Leve pra outro mercador: quanto mais longe, mais paga!');
      { const dono = this.packDaMissao(j, pk.k, n.id); if (dono) return aviso(`Esse pack é da missão: leve até ${this.nomeNpc ? this.nomeNpc(dono) : dono}`); }
      const k = mercadoK(p, n.id, pk.k, agora), preco = Math.max(1, Math.round(precoPack(pk, n, p.prof.mer) * k * (1 + (this.vantagensDe?.(j).pack || 0)) * (pk.rb ? 1 + GUERRA.roubado : 1))); // vantagem S da Guilda: +5%; roubado: +25%
      if (lista) lista.splice(i, 1); else p.pack = null;
      mercadoConta(p, n.id, pk.k, agora);
      p.ouro = (p.ouro || 0) + preco; this.caixa?.(j, 'pack', preco);
      this.pontosProf(j, 'mer', preco / 10);
      this.evento({ t: 'pack', para: id, acao: 'entregou', k: pk.k, ouro: preco, navio: (pk.nav || 0) >= PR.navioMin });
      this.historia(j, 'pack', { k: pk.k, npc: n.id, de: m.de });
      aviso(`Pack entregue! +${preco} de ouro` + (pk.rb ? ' (roubado: +25%)' : '') + ((pk.nav || 0) >= PR.navioMin ? ' (veio de navio!)' : '') + (k < 0.995 ? ` · mercado cheio: ${Math.round(k * 100)}%` : ''));
      return pronto();
    }
    if (m.acao === 'largar') {
      if (!p.pack) return;
      this.packNoChao(p.pack, j.x - Math.sin(j.ry) * 0.7, j.z - Math.cos(j.ry) * 0.7);
      p.pack = null; aviso('Pack largado no chão');
      return pronto();
    }
    if (m.acao === 'pegar') {
      if (p.pack) return aviso('Suas costas já estão ocupadas');
      if (j.veiculo === 'carrinho') return aviso('Desça do carrinho primeiro');
      const g = this.packsChao.find((o) => o.g === m.g); if (!g || Math.hypot(g.x - j.x, g.z - j.z) > PR.pegar + 0.5) return;
      this.packsChao.splice(this.packsChao.indexOf(g), 1);
      p.pack = packValido(g); j.montado = null;
      // pack da outra raça (caiu de um bot da emboscada ou de um inimigo): roubado, paga mais; o seu de volta não é
      if (p.pack) { if ((g.ra || 'chama') !== (this.racaDe?.(j) || 'chama')) p.pack.rb = 1; else delete p.pack.rb; }
      aviso('Pegou: ' + PACKS[g.k].nome + (p.pack?.rb ? ' (roubado: vale mais!)' : ''));
      return pronto();
    }
    // costas <-> carrinho <-> porão do navio
    if (m.acao === 'por_carrinho' || m.acao === 'tirar_carrinho') {
      const c = this.carrinhoPerto(j, V.carrinho.carregar); if (!c) return aviso('Chegue perto do carrinho');
      if (m.acao === 'por_carrinho') {
        if (!p.pack) return; if (c.packs.length >= capacidadeCarrinho(c)) return aviso(`Carrinho cheio (${c.packs.length}/${capacidadeCarrinho(c)})`);
        c.packs.push(p.pack); p.pack = null;
      } else {
        if (p.pack) return aviso('Suas costas já estão ocupadas'); const pk = c.packs[m.i | 0]; if (!pk) return;
        c.packs.splice(m.i | 0, 1); p.pack = pk;
      }
      return pronto();
    }
    if (m.acao === 'por_porao' || m.acao === 'tirar_porao' || m.acao === 'carrinho_porao' || m.acao === 'porao_carrinho') {
      const nv = this.navioPerto(j, V.navio.perto); if (!nv || !nv.chao && j.veiculo !== 'navio') return aviso('Chegue perto do navio');
      const cap = V.navio.porao;
      if (m.acao === 'por_porao') { if (!p.pack) return; if (nv.porao.length >= cap) return aviso('Porão cheio'); nv.porao.push(p.pack); p.pack = null; }
      else if (m.acao === 'tirar_porao') { if (p.pack) return aviso('Suas costas já estão ocupadas'); const pk = nv.porao[m.i | 0]; if (!pk) return; nv.porao.splice(m.i | 0, 1); p.pack = pk; }
      else {
        const c = this.carrinhoPerto(j, V.navio.perto + 7); if (!c) return aviso('Traga o carrinho pra perto do navio');
        if (m.acao === 'carrinho_porao') while (c.packs.length && nv.porao.length < cap) nv.porao.push(c.packs.shift());
        else while (nv.porao.length && c.packs.length < capacidadeCarrinho(c)) c.packs.push(nv.porao.shift());
      }
      return pronto();
    }
  },
  packNoChao(pk, x, z) {
    this.packsChao ||= [];
    if (this.packsChao.length >= MAX_CHAO) this.packsChao.shift();
    this.packsChao.push({ ...pk, g: 'g' + (this.proxPack = (this.proxPack || 0) + 1), x: r2(x), z: r2(z), fim: this.tempo + PACK_CHAO_DURA });
  },
  // ---------- veículos ----------
  // o carrinho está no mundo (no chão ou dirigindo): na mochila ele fica travado (não vende, não joga fora, não troca)
  // André 2026-11-21: o navio também ("igual ao carrinho na bag"): na água ou no leme, fica travado na mochila
  carrinhoFora(j, it) {
    if (it?.k === 'navio') return this.navioFora(j);
    if (it && it.k !== 'carrinho') return false;
    return !!(j.prog.carrinho?.chao || j.veiculo === 'carrinho');
  },
  navioFora(j) { return !!(j.prog.navio?.chao || j.veiculo === 'navio'); },
  // m = { acao: 'colocar'|'subir'|'descer'|'guardar'|'abastecer'|'consertar'|'melhorar', k, x, z, ry }
  veiculo(id, m) {
    const j = this.jogadores.get(id); if (!j || j.morto || j.criando || !m) return;
    const p = j.prog, aviso = (texto) => this.evento({ t: 'aviso', para: id, texto }), C = V.carrinho;
    const pronto = () => { j.progSujo = true; this.avisarProg(j); };
    const num = (v) => typeof v === 'number' && Number.isFinite(v);
    if (m.acao === 'colocar') {
      const k = m.k; if (!V[k] || contar(p.mochila, k) < 1) return;
      if (k === 'carrinho' && this.carrinhoFora(j)) return this.veiculo(id, { acao: 'recolher' }); // o travado na mochila: volta
      if (k === 'navio' && this.navioFora(j)) return this.veiculo(id, { acao: 'recolher_navio' });
      if (j.veiculo) return aviso('Desça primeiro');
      // sem lugar escolhido: o carrinho vai na frente do herói; barco e navio na água funda mais perto (até 6 m)
      const precisa = k === 'carrinho' ? null : V[k].fundo, q = num(m.x) && num(m.z) ? { x: m.x, z: m.z }
        : precisa == null ? { x: j.x + Math.sin(j.ry) * 1.6, z: j.z + Math.cos(j.ry) * 1.6 } : acharPonto(j, (a, b) => fundoAgua(a, b) >= precisa, 6);
      if (!q) return aviso(k === 'navio' ? 'Chegue na beira de água funda pra colocar o navio' : 'Chegue na beira da água pra usar o barquinho');
      const x = q.x, z = q.z, ry = num(m.ry) ? m.ry : j.ry;
      if (Math.hypot(x - j.x, z - j.z) > 6.5) return;
      if (k === 'carrinho') {
        // Quimera (André 2026-11-09): o carrinho fica na mochila, travado e com outro ícone, enquanto está no mundo
        if (fundoAgua(x, z) > 0.05) return aviso('O carrinho não entra na água.');
        p.carrinho ||= carrinhoNovo(); p.carrinho.chao = { x: r2(x), z: r2(z), ry: r2(ry) };
        aviso('Carrinho no chão! Toque nele pra dirigir, abastecer e carregar. Pra guardar, toque nele na mochila (de qualquer distância).');
      } else if (k === 'barquinho') {
        if (fundoAgua(x, z) < V.barquinho.fundo) return aviso('Chegue na beira da água pra usar o barquinho');
        tirarVeiculo(p, 'barquinho'); j.veiculo = 'barquinho'; j.montado = null; j.x = x; j.z = z; j.y = AGUA.nivel;
        this.evento({ t: 'veiculo', para: id, acao: 'subiu', k, x: r2(x), z: r2(z), ry: r2(ry) });
        aviso('No barquinho! Pra descer, chegue na margem e toque no botão do barco.');
      } else if (k === 'navio') {
        if (p.navio?.chao) return aviso('Você já tem um navio na água');
        if (fundoAgua(x, z) < V.navio.fundo) return aviso('Chegue na beira de água funda pra colocar o navio');
        p.navio ||= { porao: [], chao: null, vida: V.navio.vida, quebrado: false }; p.navio.chao = { x: r2(x), z: r2(z), ry: r2(ry) };
        aviso('Navio na água! Toque nele pra carregar, descarregar e zarpar. Pra guardar, toque nele na mochila (de qualquer distância).');
      }
      return pronto();
    }
    if (m.acao === 'subir') {
      if (j.veiculo) return;
      if (m.k === 'carrinho') {
        const c = p.carrinho; if (!c?.chao || Math.hypot(c.chao.x - j.x, c.chao.z - j.z) > C.perto + 0.5) return aviso('Chegue perto do carrinho');
        if (c.quebrado) return aviso('O carrinho está quebrado. Toque nele pra consertar.');
        j.veiculo = 'carrinho'; j.montado = null; j.x = c.chao.x; j.z = c.chao.z; j.ry = c.chao.ry; c.chao = null;
        if (c.comb <= 0) aviso('Sem combustível! Abasteça (toque no carrinho).');
      } else if (m.k === 'navio') {
        const n = p.navio; if (!n?.chao || Math.hypot(n.chao.x - j.x, n.chao.z - j.z) > V.navio.perto + 0.5) return aviso('Chegue perto do navio e toque de novo');
        if (n.quebrado) return aviso('O navio está avariado. Conserte antes de zarpar (toque no navio).');
        if (p.carrinho?.chao && Math.hypot(p.carrinho.chao.x - j.x, p.carrinho.chao.z - j.z) < 25) {
          if (p.carrinho.packs.length) return aviso(`Tire os packs do carrinho antes (o porão tem ${V.navio.porao - n.porao.length} lugares livres).`);
          if (contar(p.mochila, 'carrinho') > 0 || guardar(p.mochila, { k: 'carrinho', n: 1 })) { p.carrinho.chao = null; aviso('Carrinho guardado na mochila: ele vai junto.'); }
        }
        j.veiculo = 'navio'; j.montado = null; j.x = n.chao.x; j.z = n.chao.z; j.ry = n.chao.ry; j.y = AGUA.nivel; j.navioAndou = 0; n.chao = null;
        aviso('Você está no leme! Pra descer, chegue devagar perto da margem e toque no botão do barco.');
      } else return;
      this.evento({ t: 'veiculo', para: id, acao: 'subiu', k: m.k, x: r2(j.x), z: r2(j.z), ry: r2(j.ry) });
      return pronto();
    }
    // largar o leme no meio da água (André 2026-11-21, navio sólido): o navio fica ancorado ali e o herói fica de pé no
    // convés, atrás da roda do leme (anda pelo navio, pula na água ou pega o leme de novo pela janela do navio)
    if (m.acao === 'largar_leme') {
      if (j.veiculo !== 'navio') return;
      p.navio.chao = centroNavio(j); j.veiculo = null; j.y = AGUA.nivel + V.navio.solido.conves;
      aviso('Navio parado aqui. Ande pelo convés; pra navegar de novo, toque no navio.');
      this.evento({ t: 'veiculo', para: id, acao: 'desceu', k: 'navio', x: r2(j.x), z: r2(j.z), leme: 1 });
      return pronto();
    }
    if (m.acao === 'descer') {
      const k = j.veiculo; if (!k) return;
      // onde o herói pisa depois (o celular acha a margem; aqui só conferimos que é terra perto)
      let sx = num(m.x) ? m.x : j.x, sz = num(m.z) ? m.z : j.z;
      if (k !== 'carrinho' && !(num(m.x) && num(m.z))) { // a margem mais perto (terra firme)
        const q = acharPonto(j, (a, b) => fundoAgua(a, b) <= 0.05, k === 'navio' ? V.navio.cabe + 3 : 4);
        if (!q) return aviso('Chegue mais perto da margem pra descer');
        sx = q.x; sz = q.z;
      }
      if (k !== 'carrinho') {
        if (Math.hypot(sx - j.x, sz - j.z) > (k === 'navio' ? V.navio.cabe + 3 : 4)) return aviso('Chegue mais perto da margem pra descer');
        if (fundoAgua(sx, sz) > AGUA.peito - 0.3) return aviso('Chegue mais perto da margem pra descer');
      }
      if (k === 'barquinho' && p.mochila.indexOf(null) < 0) return aviso('Mochila cheia: libere um lugar pra guardar o barquinho');
      if (k === 'carrinho') p.carrinho.chao = { x: r2(j.x), z: r2(j.z), ry: r2(j.ry) };
      else if (k === 'navio') { p.navio.chao = centroNavio(j); aviso('Navio ancorado. Ele fica aqui até você voltar.'); }
      else if (k === 'barquinho') guardarVeiculo(p, 'barquinho');
      j.veiculo = null;
      if (k !== 'carrinho') { j.x = sx; j.z = sz; }
      this.evento({ t: 'veiculo', para: id, acao: 'desceu', k, x: r2(j.x), z: r2(j.z) });
      return pronto();
    }
    // recolher (Quimera, André 2026-11-09): tocar no carrinho travado na mochila traz ele de volta de qualquer distância;
    // dirigindo, você desce. Os packs que estavam nele ficam no chão onde ele estava.
    if (['recolher', 'recolher_navio', 'guardar'].includes(m.acao) && j.embAte > this.tempo && this.emboscadaAtiva?.(j)) return aviso('Em emboscada! Não dá pra guardar agora: defenda a carga ou fuja.');
    if (m.acao === 'consertar_navio') return this.consertarNavio(j);
    if (m.acao === 'recolher') {
      const c = p.carrinho; if (!this.carrinhoFora(j)) return;
      if (contar(p.mochila, 'carrinho') < 1 && !guardar(p.mochila, { k: 'carrinho', n: 1 })) return aviso('Mochila cheia');
      if (j.veiculo === 'carrinho') {
        c.chao = { x: r2(j.x), z: r2(j.z), ry: r2(j.ry) }; j.veiculo = null;
        this.evento({ t: 'veiculo', para: id, acao: 'desceu', k: 'carrinho', x: r2(j.x), z: r2(j.z) });
      }
      c.packs.forEach((pk, i) => this.packNoChao(pk, c.chao.x + (i % 2 ? 1 : -1) * 1.2, c.chao.z + 0.8 + Math.floor(i / 2) * 0.7));
      aviso(c.packs.length ? 'Carrinho de volta na mochila. Os packs ficaram no chão onde ele estava.' : 'Carrinho de volta na mochila');
      c.packs = []; c.chao = null;
      return pronto();
    }
    // o navio travado na mochila (André 2026-11-21): tocar nele guarda de qualquer distância. No leme, o herói fica na
    // água onde o navio estava. Os packs do porão vão para a margem mais perto do navio (como o carrinho deixa no chão).
    if (m.acao === 'recolher_navio') {
      const n = p.navio; if (!this.navioFora(j)) return;
      if (contar(p.mochila, 'navio') < 1 && !guardarVeiculo(p, 'navio')) return aviso('Mochila cheia');
      const meio = j.veiculo === 'navio' ? centroNavio(j) : n.chao;
      if (j.veiculo === 'navio') {
        j.veiculo = null; j.y = AGUA.nivel;
        this.evento({ t: 'veiculo', para: id, acao: 'desceu', k: 'navio', x: r2(j.x), z: r2(j.z), nado: 1 });
      }
      if (n.porao.length) {
        const q = acharPonto({ x: meio.x, z: meio.z, ry: 0 }, (a, b) => fundoAgua(a, b) <= 0.05, 40) || meio;
        n.porao.forEach((pk, i) => this.packNoChao(pk, q.x + (i % 4 - 1.5) * 1.1, q.z + Math.floor(i / 4) * 0.9));
      }
      aviso(n.porao.length ? 'Navio de volta na mochila. Os packs do porão ficaram na margem mais perto dele.' : 'Navio de volta na mochila');
      n.porao = []; n.chao = null;
      return pronto();
    }
    if (m.acao === 'guardar') {
      if (m.k === 'carrinho') {
        const c = p.carrinho; if (!c?.chao || Math.hypot(c.chao.x - j.x, c.chao.z - j.z) > C.perto + 0.5) return aviso('Chegue perto do carrinho');
        if (contar(p.mochila, 'carrinho') < 1 && !guardar(p.mochila, { k: 'carrinho', n: 1 })) return aviso('Mochila cheia');
        c.packs.forEach((pk, i) => this.packNoChao(pk, c.chao.x + (i % 2 ? 1 : -1) * 1.2, c.chao.z + 0.8 + Math.floor(i / 2) * 0.7));
        if (c.packs.length) aviso('Os packs do carrinho ficaram no chão');
        c.packs = []; c.chao = null;
      } else if (m.k === 'navio') {
        const n = p.navio; if (!n?.chao || Math.hypot(n.chao.x - j.x, n.chao.z - j.z) > V.navio.perto + 0.5) return aviso('Chegue perto do navio e toque de novo');
        if (contar(p.mochila, 'navio') < 1 && !guardarVeiculo(p, 'navio')) return aviso('Mochila cheia');
        n.porao.forEach((pk, i) => this.packNoChao(pk, j.x + (i % 4 - 1.5) * 1.1, j.z + Math.floor(i / 4) * 0.9));
        aviso(n.porao.length ? 'Navio de volta na mochila. Os packs ficaram na margem.' : 'Navio guardado na mochila');
        n.porao = []; n.chao = null;
      } else return;
      return pronto();
    }
    // o resto é no carrinho (parado, perto)
    const c = p.carrinho;
    if (!c || (!c.chao && j.veiculo !== 'carrinho')) return aviso('Seu carrinho está na mochila');
    const pos = c.chao || j; if (Math.hypot(pos.x - j.x, pos.z - j.z) > C.perto + 0.5) return aviso('Chegue perto do carrinho');
    if (m.acao === 'abastecer') {
      const max = C.galao * C.tanque; if (c.comb >= max - 1) return aviso('Tanque cheio');
      if (contar(p.mochila, 'galao') < 1) return aviso('Sem combustível na mochila (crie na bancada: 2 carvão + 1 tecido)');
      // n = quantos galões pôr de uma vez (o lugar do combustível na janela do carrinho: "Encher" põe até lotar)
      let n = Math.max(1, Math.min(C.tanque, Math.floor(+m.n) || 1));
      n = Math.min(n, contar(p.mochila, 'galao'), Math.ceil((max - c.comb) / C.galao));
      tirar(p.mochila, 'galao', n); c.comb = Math.min(max, c.comb + C.galao * n);
      this.evento({ t: 'veiculo', para: id, acao: 'abasteceu' });
      this.historia(j, 'veiculo', { k: 'abastecer' });
      return pronto();
    }
    if (m.acao === 'consertar') {
      if (c.vida >= C.vida && !c.quebrado) return;
      if (this.emCombateGuerra?.(j, c)) return aviso('Em combate não dá pra consertar. Afaste os inimigos primeiro.');
      const custo = c.quebrado ? C.consertoQuebrado : C.consertoParcial;
      const falta = Object.entries(custo).filter(([k, q]) => contar(p.mochila, k) < q);
      if (falta.length) return aviso('Pra consertar: ' + Object.entries(custo).map(([k, q]) => `${q} ${ITENS[k].nome}`).join(' + '));
      for (const [k, q] of Object.entries(custo)) tirar(p.mochila, k, q);
      c.quebrado = false; c.vida = C.vida; aviso('Carrinho consertado!');
      this.historia(j, 'veiculo', { k: 'consertar' });
      return pronto();
    }
    if (m.acao === 'melhorar') {
      if (c.quebrado) return;
      const n = c.lv + 1, custo = C.melhorar[n]; if (!custo) return aviso('O carrinho já está no nível máximo');
      { const lib = motivoLibera(p, 'carrinho', n); if (lib) return aviso(`Carrinho nível ${n}: ${lib.toLowerCase()}`); } // progressão (André 2026-11-10)
      if (!this.bancadaPerto(j)) return aviso('Melhore perto de uma bancada de trabalho');
      const tem = (k) => (k === 'ouro' ? p.ouro || 0 : contar(p.mochila, k));
      const falta = Object.entries(custo).filter(([k, q]) => tem(k) < q);
      if (falta.length) return aviso('Falta: ' + falta.map(([k, q]) => `${k === 'ouro' ? 'ouro' : ITENS[k].nome} ${tem(k)}/${q}`).join(', '));
      for (const [k, q] of Object.entries(custo)) if (k === 'ouro') { p.ouro -= q; this.caixa?.(j, 'carrinho', -q); } else tirar(p.mochila, k, q);
      c.lv = n; aviso(`Carrinho Nv ${n}! Agora leva ${capacidadeCarrinho(c)} packs.`);
      this.historia(j, 'veiculo', { k: 'melhorar', v: n });
      return pronto();
    }
  },
  // velocidade máxima (m/s) para conferir a posição que o celular manda; null = a de sempre
  velVeiculo(j) {
    if (j.veiculo === 'carrinho') return (j.prog.carrinho?.comb > 0 ? velCarrinho(j.prog.carrinho) : 0.4);
    if (j.veiculo === 'barquinho') return V.barquinho.vel;
    if (j.veiculo === 'navio') return V.navio.vel;
    return null;
  },
  // o celular mandou a posição nova (já conferida a velocidade): água/terra, combustível e o porão andando
  andouVeiculo(j, x, z, d) {
    const k = j.veiculo; if (!k) return true;
    if (!lugarDoVeiculo(k, x, z)) return false; // carrinho não entra na água; barquinho e navio não saem dela
    if (k === 'carrinho') {
      const c = j.prog.carrinho; c.comb = Math.max(0, c.comb - d);
    } else if (k === 'navio') {
      for (const pk of j.prog.navio.porao) pk.nav = (pk.nav || 0) + d;
      if (j.prog.pack) j.prog.pack.nav = (j.prog.pack.nav || 0) + d; // o pack das costas também atravessou de navio
    }
    j.progSujo = true;
    return true;
  },
  // apanhou dentro do carrinho (Quimera): o carrinho leva 110% e o herói 20%
  golpeNoCarrinho(j, n) {
    if (j.veiculo !== 'carrinho') return n;
    const c = j.prog.carrinho, C = V.carrinho;
    c.vida = Math.max(0, c.vida - Math.round(n * C.golpe));
    this.evento({ t: 'veiculo', para: j.id, acao: 'dano', n: Math.round(n * C.golpe), vida: Math.round(c.vida) });
    if (c.vida <= 0) this.quebrarCarrinho(j);
    return Math.max(1, Math.round(n * C.heroi));
  },
  quebrarCarrinho(j) {
    const c = j.prog.carrinho, q = j.veiculo === 'carrinho' || !c.chao ? j : c.chao; // parado (emboscada): quebra onde está
    c.quebrado = true; c.vida = 0; c.chao = { x: r2(q.x), z: r2(q.z), ry: r2(q.ry || 0) };
    c.packs.forEach((pk, i) => this.packNoChao(pk, q.x + (i % 2 ? 1 : -1) * 1.2, q.z + 0.8 + Math.floor(i / 2) * 0.7));
    c.packs = []; if (j.veiculo === 'carrinho') j.veiculo = null;
    this.evento({ t: 'veiculo', para: j.id, acao: 'quebrou', x: r2(q.x), z: r2(q.z) });
    this.evento({ t: 'aviso', para: j.id, texto: 'O carrinho quebrou! Os packs caíram no chão. Toque nele pra consertar (8 lenha + 1 barra de ferro).' });
    j.progSujo = true; this.avisarProg(j);
  },
  // ---------- emboscada (André 2026-11-21, shared/guerra.js): bots batem no carrinho ou no navio ----------
  // n de dano no veículo k de j (parado ou com ele dirigindo); zerou, quebra (carrinho) ou fica avariado (navio)
  danoVeiculo(j, k, n, de = null) {
    const v = k === 'navio' ? j.prog.navio : j.prog.carrinho; if (!v || v.quebrado) return;
    const max = k === 'navio' ? V.navio.vida : V.carrinho.vida;
    v.vida = Math.max(0, Math.min(max, v.vida ?? max) - Math.round(n)); v.danoT = this.tempo; j.progSujo = true;
    this.evento({ t: 'veiculo', para: j.id, acao: 'dano', k, n: Math.round(n), vida: Math.round(v.vida), max });
    if (v.vida > 0) { if (((this._avisoVeic ||= new Map()).get(j.id) || 0) < this.tempo) { this._avisoVeic.set(j.id, this.tempo + 8); this.avisarProg(j); } return; }
    if (k === 'carrinho') return this.quebrarCarrinho(j);
    // navio avariado: fica parado onde está (quem estava no leme fica no convés) até consertar
    v.quebrado = true;
    if (j.veiculo === 'navio') {
      v.chao = centroNavio(j); j.veiculo = null; j.y = AGUA.nivel + V.navio.solido.conves;
      this.evento({ t: 'veiculo', para: j.id, acao: 'desceu', k: 'navio', x: r2(j.x), z: r2(j.z), leme: 1 });
    }
    this.evento({ t: 'aviso', para: j.id, texto: `O navio foi avariado${de ? ' por ' + de.nome : ''}! Eles vão saquear o porão. Conserte (toque no navio) pra navegar de novo.` });
    this.avisarProg(j);
  },
  // conserto do casco (perto do navio, fora de combate): avariado = consertoQuebrado; só arranhado = consertoParcial
  consertarNavio(j) {
    const p = j.prog, n = p.navio, N = V.navio, aviso = (texto) => this.evento({ t: 'aviso', para: j.id, texto });
    const q = n && (n.chao || (j.veiculo === 'navio' ? centroNavio(j) : null)); if (!q || Math.hypot(q.x - j.x, q.z - j.z) > N.perto + 0.5) return aviso('Chegue perto do navio');
    if ((n.vida ?? N.vida) >= N.vida && !n.quebrado) return;
    if (this.emCombateGuerra?.(j, n)) return aviso('Em combate não dá pra consertar. Afaste os inimigos primeiro.');
    const custo = n.quebrado ? N.consertoQuebrado : N.consertoParcial;
    if (Object.entries(custo).some(([k, x]) => contar(p.mochila, k) < x)) return aviso('Pra consertar o navio: ' + Object.entries(custo).map(([k, x]) => `${x} ${ITENS[k].nome}`).join(' + '));
    for (const [k, x] of Object.entries(custo)) tirar(p.mochila, k, x);
    n.quebrado = false; n.vida = N.vida; aviso('Navio consertado!');
    j.progSujo = true; this.avisarProg(j);
  },
  // morreu: o pack das costas cai; o veículo fica onde estava (o barquinho volta para a mochila)
  morreuComCarga(j) {
    const p = j.prog;
    if (p.pack) { this.packNoChao(p.pack, j.x, j.z); p.pack = null; }
    if (j.veiculo === 'carrinho') p.carrinho.chao = { x: r2(j.x), z: r2(j.z), ry: r2(j.ry) };
    else if (j.veiculo === 'navio') p.navio.chao = centroNavio(j);
    else if (j.veiculo === 'barquinho') devolverBarquinho(p);
    j.veiculo = null;
  },
  // saiu do jogo dirigindo: o veículo fica onde ele está
  saiuComVeiculo(j) {
    if (!j?.veiculo) return;
    const p = j.prog;
    if (j.veiculo === 'carrinho') p.carrinho.chao = { x: r2(j.x), z: r2(j.z), ry: r2(j.ry) };
    else if (j.veiculo === 'navio') p.navio.chao = centroNavio(j);
    else if (j.veiculo === 'barquinho') devolverBarquinho(p);
    j.veiculo = null; j.progSujo = true;
  },
  // o que vai para a conta enquanto ele dirige (auditoria 2026-11-13): o veículo entra estacionado onde ele está, como se
  // tivesse saído agora. Sem isso, um reinício do servidor (todo merge) ou uma sessão nova no leme gravava o navio com
  // chao = null e fora da mochila: o navio sumia. O herói continua dirigindo; só a cópia gravada muda.
  progParaSalvar(j) {
    const p = j.prog; if (!j.veiculo) return p;
    const s = { ...p }, aqui = { x: r2(j.x), z: r2(j.z), ry: r2(j.ry) };
    if (j.veiculo === 'navio') s.navio = { ...(p.navio || { porao: [] }), chao: centroNavio(j) };
    else if (j.veiculo === 'carrinho') s.carrinho = { ...p.carrinho, chao: aqui };
    else if (j.veiculo === 'barquinho') { s.mochila = p.mochila.slice(); if (p.vcad) s.vcad = { ...p.vcad }; devolverBarquinho(s); } // cópia: o cadeado volta só na gravada
    return s;
  },
  // barquinho que ficou fora da mochila cheia: volta assim que abrir um lugar (chamado a cada gravação)
  voltarBarquinho(j) {
    const p = j.prog;
    // navio que foi para a água antes de ficar travado na mochila (André 2026-11-21): volta para ela, travado
    if (this.navioFora(j) && contar(p.mochila, 'navio') < 1 && guardarVeiculo(p, 'navio')) { j.progSujo = true; this.avisarProg(j); }
    if (p.barcoFora !== 1 || j.veiculo) return;
    if (guardarVeiculo(p, 'barquinho')) { delete p.barcoFora; j.progSujo = true; this.avisarProg(j); this.evento({ t: 'aviso', para: j.id, texto: 'O barquinho voltou para a mochila' }); }
  },
  // por que não pode teleportar / montar agora ('' = pode)
  motivoCarga(j) {
    if (j.prog.pack) return 'Com pack nas costas não dá. Leve ele andando (ou no carrinho).';
    if (j.veiculo) return 'Desça primeiro';
    return '';
  },
  // barco ou navio em terra (André 2026-11-21: "barcos e navios mercantes... surgem no meio do continente"). Antes do
  // conserto do moverJogador, quando o servidor recusava a posição do celular (barco batendo na margem) ele mesmo andava
  // o herói pelo joystick, a pé, sem olhar o veículo: o barco subia na terra e ia continente adentro (e ficava ancorado
  // lá). Uma vez por segundo: quem está no barco em terra volta para a água mais perto; navio ancorado em terra também.
  passoVeiculos() {
    if ((this.tempo || 0) < (this._veicT || 0)) return;
    this._veicT = (this.tempo || 0) + 1;
    for (const j of this.jogadores.values()) {
      if (j.criando || !j.prog) continue;
      const k = j.veiculo;
      if ((k === 'barquinho' || k === 'navio') && !j.morto && !lugarDoVeiculo(k, j.x, j.z)) {
        const q = aguaMaisPerto(k, j.x, j.z);
        if (q) { j.x = q.x; j.z = q.z; j.y = AGUA.nivel; j.cliente = null; this.corrigir(j); j.progSujo = true; }
      }
      const n = j.prog.navio;
      if (n?.chao && !(this._semAgua ||= new WeakSet()).has(n.chao) && !lugarDoVeiculo('navio', n.chao.x, n.chao.z)) {
        const q = aguaMaisPerto('navio', n.chao.x, n.chao.z);
        if (q) { n.chao = { x: q.x, z: q.z, ry: n.chao.ry }; j.progSujo = true; } else this._semAgua.add(n.chao); // sem mar por perto: não procura de novo
      }
    }
  },
  passoPacks() {
    if (!this.packsChao?.length) return;
    for (let i = this.packsChao.length - 1; i >= 0; i--) if (this.packsChao[i].fim <= this.tempo) this.packsChao.splice(i, 1);
  },
  // carrinhos no mundo (parados ou com alguém dirigindo) para o topoCarrinho: { x, z, ry, y, lv }. sem: quem não conta
  // (o motorista não pisa no próprio carrinho; ele vai sentado)
  carrinhosNoMundo(sem) {
    const l = [];
    for (const j of this.jogadores.values()) {
      const c = j.prog?.carrinho; if (j === sem || j.criando || !c) continue;
      const q = c.chao || (j.veiculo === 'carrinho' ? j : null); if (!q) continue;
      l.push({ x: q.x, z: q.z, ry: q.ry || 0, y: this.terreno.altura(q.x, q.z), lv: c.lv || 1 });
    }
    return l;
  },
  // navios no mundo (ancorados ou com alguém no leme): { x, z, ry, dono } com o meio do navio
  naviosNoMundo() {
    const l = [];
    for (const j of this.jogadores.values()) {
      const n = j.prog?.navio; if (j.criando || !n) continue;
      if (n.chao) l.push({ ...n.chao, dono: j.id }); else if (j.veiculo === 'navio') l.push({ ...centroNavio(j), dono: j.id });
    }
    return l;
  },
  // em pé no convés de algum navio (André 2026-11-21: "outras pessoas podem subir e ir comigo"): { n, lx, lz } ou null.
  // O navio é chão (o celular manda o herói na altura do convés, longe do fundo) e fica no mapa até no mar aberto.
  aBordo(x, z, y = null) {
    const q = noConves(this.naviosNoMundo(), x, z);
    if (!q || (y != null && Math.abs(y - (AGUA.nivel + V.navio.solido.conves)) > 2.6)) return null;
    return q;
  },
  // Bots do time a bordo (André 2026-11-21: "se eu quiser ir com os bots podem ficar em cima passeando"): o dono no leme
  // ou no convés de um navio e o bot do time a até solido.perto m: ele sobe e fica passeando pelo convés (de um lugar
  // de "bordo" para outro, andando), indo junto com o navio. O dono saiu do navio: ele desce do lado dele.
  // true = o bot está a bordo (a amiga não faz mais nada neste passo).
  bordoBot(j, dono, dt) {
    const S = V.navio.solido;
    let nav = null;
    if (dono && !dono.morto) {
      if (dono.veiculo === 'navio') nav = { ...centroNavio(dono), dono: dono.id };
      else { const q = this.aBordo(dono.x, dono.z, dono.y); if (q) nav = q.n; }
    }
    const B = j.bordo;
    if (!nav) {
      if (B) { // desce junto: do lado do dono (em terra ou no cais)
        j.bordo = null;
        const a = [...String(j.id)].reduce((q, ch) => q + ch.charCodeAt(0), 0) * 1.7;
        j.x = dono ? dono.x + Math.sin(a) * 1.2 : j.x; j.z = dono ? dono.z + Math.cos(a) * 1.2 : j.z;
        j.y = this.terreno.altura(j.x, j.z); j.vy = 0; j.chao = true;
      }
      return false;
    }
    if (!B) {
      // André 2026-11-21 ("quando eu estiver no leme do navio em time com eles, eles sobem no navio"): o bot do time que
      // vinha atrás (no cais, nadando ou no barquinho dele) sobe até S.pertoTime m; o barquinho volta para a mochila
      if (j.morto || j.esc || Math.hypot(nav.x - j.x, nav.z - j.z) > (S.pertoTime || S.perto)) return false;
      if (j.veiculo === 'barquinho') { j.veiculo = null; devolverBarquinho(j.prog); j.progSujo = true; }
      const i = [...String(j.id)].reduce((a, ch) => a + ch.charCodeAt(0), 0) % S.bordo.length; // cada bot num lugar
      j.bordo = { dono: nav.dono, lx: S.bordo[i][0], lz: S.bordo[i][1], i, troca: this.tempo + 4 + Math.random() * 6 };
      if (j.coleta) this.pararColeta(j, null); if (j.pesca) this.pararPesca(j, null);
    }
    const b = j.bordo;
    if (b.dono !== nav.dono) { b.dono = nav.dono; }
    if (this.tempo > b.troca) { b.i = (b.i + 1 + Math.floor(Math.random() * (S.bordo.length - 1))) % S.bordo.length; b.troca = this.tempo + 6 + Math.random() * 8; }
    const alvo = S.bordo[b.i], dx = alvo[0] - b.lx, dz = alvo[1] - b.lz, d = Math.hypot(dx, dz), passo = Math.min(d, 1.3 * dt);
    if (d > 0.05) { b.lx += dx / d * passo; b.lz += dz / d * passo; }
    const s = Math.sin(nav.ry || 0), c = Math.cos(nav.ry || 0);
    j.x = nav.x + b.lx * c + b.lz * s; j.z = nav.z - b.lx * s + b.lz * c;
    j.y = AGUA.nivel + S.conves; j.vy = 0; j.chao = true;
    j.ry = d > 0.05 ? (nav.ry || 0) + Math.atan2(dx, dz) : (nav.ry || 0) + (b.i % 2 ? 1.2 : -1.2); // parado: olha o mar
    j.anim = d > 0.05 ? 'Walk' : 'Idle';
    j.montado = null; j.entrada = { mx: 0, mz: 0, correr: false }; j.bordoT = this.tempo;
    return true;
  },
  // o que vai na foto: packs no chão, carrinhos e navios no mundo (de quem está no jogo)
  fotoCarga() {
    const veic = [];
    for (const j of this.jogadores.values()) {
      if (j.criando) continue;
      const c = j.prog.carrinho, n = j.prog.navio, eu = j.veiculo;
      if (c && (c.chao || eu === 'carrinho')) { const q = c.chao || j; veic.push(['c', j.id, r2(q.x), r2(q.z), r2(q.ry), c.lv, c.packs.map((o) => o.k), c.quebrado ? 1 : 0, eu === 'carrinho' ? 1 : 0]); }
      if (n && (n.chao || eu === 'navio')) { const q = n.chao || centroNavio(j); veic.push(['n', j.id, r2(q.x), r2(q.z), r2(q.ry), 1, n.porao.map((o) => o.k), 0, eu === 'navio' ? 1 : 0]); }
      if (eu === 'barquinho') veic.push(['b', j.id, r2(j.x), r2(j.z), r2(j.ry), 1, [], 0, 1]);
    }
    return { packs: (this.packsChao || []).map((o) => [o.g, o.k, o.x, o.z]), veic };
  },
};

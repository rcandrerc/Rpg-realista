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
import { PACKS, PACK_REGRAS as PR, VEICULOS as V, ITENS, CACA, PROF_MAX, tempoCriar } from './dados.js';
import { contar, tirar, guardar, gastarVigor, vigorAgora, profNivel } from './progresso.js';
import { noLago, AGUA } from './relevo.js';
import { motivoLibera } from './historia.js'; // progressão (André 2026-11-10)

const r2 = (n) => Math.round(n * 100) / 100;
const PACK_CHAO_DURA = 1800; // s: pack esquecido no chão some depois de meia hora
const MAX_CHAO = 200;

// ---------- conta do preço (Quimera UK/VK) ----------
export function fatorDistancia(d) {
  const D = PR.dist;
  if (d <= D.curto) return Math.min(D.maxCurto, Math.max(D.a, D.a + d * D.porM));
  return Math.min(D.max, D.maxCurto + (d - D.curto) * D.porMLongo);
}
// fator da área: nível do campo de caça mais perto (até PR.areas.raio m); longe de todos = 1
export function fatorArea(x, z) {
  let melhor = null, dm = PR.areas.raio;
  for (const c of CACA) { const d = Math.hypot(c.x - x, c.z - z); if (d < dm) { dm = d; melhor = c; } }
  const nv = melhor ? melhor.nivel || 1 : 1, A = PR.areas;
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
function mercadoConta(p, npc, k, agora = Date.now()) {
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
  return r;
}
const lugarValido = (q) => (q && [q.x, q.z, q.ry].every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 1e4) ? { x: r2(q.x), z: r2(q.z), ry: r2(q.ry) } : null);
export const carrinhoNovo = () => ({ lv: 1, comb: 0, vida: V.carrinho.vida, quebrado: false, packs: [], chao: null });
export function carrinhoValido(c) {
  if (!c || typeof c !== 'object') return null;
  const C = V.carrinho, n = carrinhoNovo();
  n.lv = Math.min(C.nivelMax, Math.max(1, c.lv | 0 || 1));
  n.comb = Math.min(C.galao * C.tanque, Math.max(0, +c.comb || 0));
  n.vida = Math.min(C.vida, Math.max(0, +c.vida || 0));
  n.quebrado = !!c.quebrado || n.vida <= 0;
  n.packs = (Array.isArray(c.packs) ? c.packs : []).map(packValido).filter(Boolean).slice(0, C.capacidade * C.nivelMax);
  n.chao = lugarValido(c.chao);
  return n;
}
export function navioValido(c) {
  if (!c || typeof c !== 'object') return null;
  return { porao: (Array.isArray(c.porao) ? c.porao : []).map(packValido).filter(Boolean).slice(0, V.navio.porao), chao: lugarValido(c.chao) };
}
export const capacidadeCarrinho = (c) => V.carrinho.capacidade * Math.min(V.carrinho.nivelMax, Math.max(1, c?.lv | 0 || 1));
export const velCarrinho = (c) => V.carrinho.vel - V.carrinho.perdePorPack * Math.max(0, (c?.packs?.length || 0) - V.carrinho.packsLivres);
// água funda o bastante em (x, z)? (lago hoje; o mar entra na FASE 3)
export const fundoAgua = (x, z) => noLago(x, z)?.fundo || 0;
// barquinho de volta para a mochila; cheia, fica guardado à parte (prog.barcoFora) e volta quando abrir lugar
export function devolverBarquinho(p) { if (!guardar(p.mochila, { k: 'barquinho', n: 1 })) p.barcoFora = 1; }
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
    const novo = { k: n.merch, ox: Math.round(n.x), oz: Math.round(n.z), mo: n.id };
    gastarVigor(p, PR.vigor);
    for (const [k, q] of Object.entries(custo)) tirar(p.mochila, k, q);
    if (p.pack) { cart.packs.push(novo); aviso('Pack feito e colocado no carrinho!'); } else { p.pack = novo; j.montado = null; aviso(`${P.nome} nas costas! Leve pra outro mercador.`); }
    this.pontosProf(j, 'mer', PR.vigor / 2);
    this.evento({ t: 'pack', para: id, acao: 'fez', k: n.merch });
    this.historia(j, 'pack_fez', { k: n.merch });
    j.progSujo = true; this.avisarProg(j);
    return '';
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
      const k = mercadoK(p, n.id, pk.k, agora), preco = Math.max(1, Math.round(precoPack(pk, n, p.prof.mer) * k));
      if (lista) lista.splice(i, 1); else p.pack = null;
      mercadoConta(p, n.id, pk.k, agora);
      p.ouro = (p.ouro || 0) + preco;
      this.pontosProf(j, 'mer', preco / 10);
      this.evento({ t: 'pack', para: id, acao: 'entregou', k: pk.k, ouro: preco, navio: (pk.nav || 0) >= PR.navioMin });
      this.historia(j, 'pack', { k: pk.k, npc: n.id, de: m.de });
      aviso(`Pack entregue! +${preco} de ouro` + ((pk.nav || 0) >= PR.navioMin ? ' (veio de navio!)' : '') + (k < 0.995 ? ` · mercado cheio: ${Math.round(k * 100)}%` : ''));
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
      aviso('Pegou: ' + PACKS[g.k].nome);
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
  carrinhoFora(j, it) {
    if (it && it.k !== 'carrinho') return false;
    return !!(j.prog.carrinho?.chao || j.veiculo === 'carrinho');
  },
  // m = { acao: 'colocar'|'subir'|'descer'|'guardar'|'abastecer'|'consertar'|'melhorar', k, x, z, ry }
  veiculo(id, m) {
    const j = this.jogadores.get(id); if (!j || j.morto || j.criando || !m) return;
    const p = j.prog, aviso = (texto) => this.evento({ t: 'aviso', para: id, texto }), C = V.carrinho;
    const pronto = () => { j.progSujo = true; this.avisarProg(j); };
    const num = (v) => typeof v === 'number' && Number.isFinite(v);
    if (m.acao === 'colocar') {
      const k = m.k; if (!V[k] || contar(p.mochila, k) < 1) return;
      if (k === 'carrinho' && this.carrinhoFora(j)) return this.veiculo(id, { acao: 'recolher' }); // o travado na mochila: volta
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
        tirar(p.mochila, 'barquinho', 1); j.veiculo = 'barquinho'; j.montado = null; j.x = x; j.z = z; j.y = AGUA.nivel;
        this.evento({ t: 'veiculo', para: id, acao: 'subiu', k, x: r2(x), z: r2(z), ry: r2(ry) });
        aviso('No barquinho! Pra descer, chegue na margem e toque no botão do barco.');
      } else if (k === 'navio') {
        if (p.navio?.chao) return aviso('Você já tem um navio na água');
        if (fundoAgua(x, z) < V.navio.fundo) return aviso('Chegue na beira de água funda pra colocar o navio');
        p.navio ||= { porao: [], chao: null }; p.navio.chao = { x: r2(x), z: r2(z), ry: r2(ry) };
        tirar(p.mochila, 'navio', 1); aviso('Navio na água! Toque nele pra carregar, descarregar e zarpar.');
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
      else if (k === 'navio') { p.navio.chao = { x: r2(j.x), z: r2(j.z), ry: r2(j.ry) }; aviso('Navio ancorado. Ele fica aqui até você voltar.'); }
      else if (k === 'barquinho') guardar(p.mochila, { k: 'barquinho', n: 1 });
      j.veiculo = null;
      if (k !== 'carrinho') { j.x = sx; j.z = sz; }
      this.evento({ t: 'veiculo', para: id, acao: 'desceu', k, x: r2(j.x), z: r2(j.z) });
      return pronto();
    }
    // recolher (Quimera, André 2026-11-09): tocar no carrinho travado na mochila traz ele de volta de qualquer distância;
    // dirigindo, você desce. Os packs que estavam nele ficam no chão onde ele estava.
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
    if (m.acao === 'guardar') {
      if (m.k === 'carrinho') {
        const c = p.carrinho; if (!c?.chao || Math.hypot(c.chao.x - j.x, c.chao.z - j.z) > C.perto + 0.5) return aviso('Chegue perto do carrinho');
        if (contar(p.mochila, 'carrinho') < 1 && !guardar(p.mochila, { k: 'carrinho', n: 1 })) return aviso('Mochila cheia');
        c.packs.forEach((pk, i) => this.packNoChao(pk, c.chao.x + (i % 2 ? 1 : -1) * 1.2, c.chao.z + 0.8 + Math.floor(i / 2) * 0.7));
        if (c.packs.length) aviso('Os packs do carrinho ficaram no chão');
        c.packs = []; c.chao = null;
      } else if (m.k === 'navio') {
        const n = p.navio; if (!n?.chao || Math.hypot(n.chao.x - j.x, n.chao.z - j.z) > V.navio.perto + 0.5) return aviso('Chegue perto do navio e toque de novo');
        if (!guardar(p.mochila, { k: 'navio', n: 1 })) return aviso('Mochila cheia');
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
      for (const [k, q] of Object.entries(custo)) if (k === 'ouro') p.ouro -= q; else tirar(p.mochila, k, q);
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
    const fundo = fundoAgua(x, z);
    if (k === 'carrinho') {
      if (fundo > 0.3) return false; // carrinho não entra na água
      const c = j.prog.carrinho; c.comb = Math.max(0, c.comb - d);
    } else if (k === 'barquinho') { if (fundo < V.barquinho.fundo * 0.5) return false; }
    else if (k === 'navio') {
      if (fundo < V.navio.fundo * 0.5) return false;
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
    const c = j.prog.carrinho;
    c.quebrado = true; c.vida = 0; c.chao = { x: r2(j.x), z: r2(j.z), ry: r2(j.ry) };
    c.packs.forEach((pk, i) => this.packNoChao(pk, j.x + (i % 2 ? 1 : -1) * 1.2, j.z + 0.8 + Math.floor(i / 2) * 0.7));
    c.packs = []; j.veiculo = null;
    this.evento({ t: 'veiculo', para: j.id, acao: 'quebrou', x: r2(j.x), z: r2(j.z) });
    this.evento({ t: 'aviso', para: j.id, texto: 'O carrinho quebrou! Os packs caíram no chão. Toque nele pra consertar (8 lenha + 1 barra de ferro).' });
    j.progSujo = true; this.avisarProg(j);
  },
  // morreu: o pack das costas cai; o veículo fica onde estava (o barquinho volta para a mochila)
  morreuComCarga(j) {
    const p = j.prog;
    if (p.pack) { this.packNoChao(p.pack, j.x, j.z); p.pack = null; }
    if (j.veiculo === 'carrinho') p.carrinho.chao = { x: r2(j.x), z: r2(j.z), ry: r2(j.ry) };
    else if (j.veiculo === 'navio') p.navio.chao = { x: r2(j.x), z: r2(j.z), ry: r2(j.ry) };
    else if (j.veiculo === 'barquinho') devolverBarquinho(p);
    j.veiculo = null;
  },
  // saiu do jogo dirigindo: o veículo fica onde ele está
  saiuComVeiculo(j) {
    if (!j?.veiculo) return;
    const p = j.prog;
    if (j.veiculo === 'carrinho') p.carrinho.chao = { x: r2(j.x), z: r2(j.z), ry: r2(j.ry) };
    else if (j.veiculo === 'navio') p.navio.chao = { x: r2(j.x), z: r2(j.z), ry: r2(j.ry) };
    else if (j.veiculo === 'barquinho') devolverBarquinho(p);
    j.veiculo = null; j.progSujo = true;
  },
  // o que vai para a conta enquanto ele dirige (auditoria 2026-11-13): o veículo entra estacionado onde ele está, como se
  // tivesse saído agora. Sem isso, um reinício do servidor (todo merge) ou uma sessão nova no leme gravava o navio com
  // chao = null e fora da mochila: o navio sumia. O herói continua dirigindo; só a cópia gravada muda.
  progParaSalvar(j) {
    const p = j.prog; if (!j.veiculo) return p;
    const s = { ...p }, aqui = { x: r2(j.x), z: r2(j.z), ry: r2(j.ry) };
    if (j.veiculo === 'navio') s.navio = { ...(p.navio || { porao: [] }), chao: aqui };
    else if (j.veiculo === 'carrinho') s.carrinho = { ...p.carrinho, chao: aqui };
    else if (j.veiculo === 'barquinho') { s.mochila = p.mochila.slice(); devolverBarquinho(s); }
    return s;
  },
  // barquinho que ficou fora da mochila cheia: volta assim que abrir um lugar (chamado a cada gravação)
  voltarBarquinho(j) {
    const p = j.prog; if (p.barcoFora !== 1 || j.veiculo) return;
    if (guardar(p.mochila, { k: 'barquinho', n: 1 })) { delete p.barcoFora; j.progSujo = true; this.avisarProg(j); this.evento({ t: 'aviso', para: j.id, texto: 'O barquinho voltou para a mochila' }); }
  },
  // por que não pode teleportar / montar agora ('' = pode)
  motivoCarga(j) {
    if (j.prog.pack) return 'Com pack nas costas não dá. Leve ele andando (ou no carrinho).';
    if (j.veiculo) return 'Desça primeiro';
    return '';
  },
  passoPacks() {
    if (!this.packsChao?.length) return;
    for (let i = this.packsChao.length - 1; i >= 0; i--) if (this.packsChao[i].fim <= this.tempo) this.packsChao.splice(i, 1);
  },
  // o que vai na foto: packs no chão, carrinhos e navios no mundo (de quem está no jogo)
  fotoCarga() {
    const veic = [];
    for (const j of this.jogadores.values()) {
      if (j.criando) continue;
      const c = j.prog.carrinho, n = j.prog.navio, eu = j.veiculo;
      if (c && (c.chao || eu === 'carrinho')) { const q = c.chao || j; veic.push(['c', j.id, r2(q.x), r2(q.z), r2(q.ry), c.lv, c.packs.map((o) => o.k), c.quebrado ? 1 : 0, eu === 'carrinho' ? 1 : 0]); }
      if (n && (n.chao || eu === 'navio')) { const q = n.chao || j; veic.push(['n', j.id, r2(q.x), r2(q.z), r2(q.ry), 1, n.porao.map((o) => o.k), 0, eu === 'navio' ? 1 : 0]); }
      if (eu === 'barquinho') veic.push(['b', j.id, r2(j.x), r2(j.z), r2(j.ry), 1, [], 0, 1]);
    }
    return { packs: (this.packsChao || []).map((o) => [o.g, o.k, o.x, o.z]), veic };
  },
};

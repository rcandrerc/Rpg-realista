// Modo leve (André 2026-11-25: "uma interface meio que pra eu logar no jogo... só um mapa, eu clico e vai... ir na
// action house, fazer algumas tarefas básicas, vender itens... que rode num celular muito vagabundo"). A aba Jogar do
// painel do clã (client/painel.html) entra na sala como um jogador de verdade: o herói tem corpo no mundo, os outros
// veem, a Geada pode atacar. A página não manda posição: manda o destino (leveIr) e o SERVIDOR anda o herói pela
// estrada (shared/rota.js, a mesma dos recrutas), na velocidade normal a pé. Não existe teleporte: totem só do jeito
// pago de sempre. Loja, leilão e baú usam as mesmas mensagens do jogo (item, leilao, bau), com as mesmas regras de
// distância. Para o celular fraco: a cada LEVE.envio s vai uma foto pequena só do que está perto (fotoLeve).
import { planejarRota, terraId } from './rota.js';
import { TUNEL } from './caverna.js';
import { LUGARES_MUNDO } from './mundo.js';
import { ITENS, RARIDADES, TOTENS, LOJA, taxaTotem, HEROI, PACK_REGRAS, PACKS, VEICULOS, GUERRA, MONTARIAS, CACA, TUNEIS_MUNDO } from './dados.js';
import { nomeItem, precoVenda, mercador, bonusTitulo, contar } from './progresso.js';
import { precoPack, mercadoK, custoPack, capacidadeCarrinho } from './transporte.js';
import { liberado } from './historia.js';

export const LEVE = {
  envio: 0.5, // s entre as fotos para a página
  chega: 1.3, // m do destino: chegou
  meio: 2.5, // m de um ponto do caminho: passa para o próximo
  olhar: 2, // s entre as conferidas de "preso"
  preso: 0.8, // m: andou menos que isso em LEVE.olhar s = preso
  desiste: 4, // conferidas presas seguidas: para e avisa
  quase: 4, // m do destino: preso aqui conta como chegou (NPC, totem e baú ocupam o lugar exato)
  gente: 60, // m: jogadores e bots que aparecem
  bichos: 40, // m: monstros que aparecem
  max: 40, // no máximo tantos de cada na foto
  leilao: 60, // anúncios na lista do leilão
  intervalo: 0.5, // s entre dois destinos
  chat: 30, // mensagens do chat que a página guarda
  longe: 2500, // m: destino mais longe que isso não vale
  packsChao: 20, // m: packs no chão que aparecem (pegar)
  montaDe: 25, // m de caminho: daqui pra cima o "Ir para" sobe no lobo sozinho (como no jogo)
};
// quem a página mostra como lugar no mapa (as janelas do jogo de cada um)
const FUNCOES = new Set(['loja', 'leilao', 'pack', 'ferreiro', 'habilidades', 'alquimia']);
const cor = (n) => '#' + (n >>> 0).toString(16).padStart(6, '0');
const r1 = (n) => Math.round(n * 10) / 10;
// a cor do item: a da raridade (equipamento) ou a do próprio item (alma, semente)
const corDe = (o) => (o.r != null && RARIDADES[o.r] ? cor(RARIDADES[o.r].cor) : ITENS[o.k]?.cor != null ? (typeof ITENS[o.k].cor === 'number' ? cor(ITENS[o.k].cor) : ITENS[o.k].cor) : null);
// lugares com item: [lugar, k, n, nome, cor]
const listaLeve = (itens) => { const r = []; (itens || []).forEach((o, i) => { if (o && ITENS[o.k]) r.push([i, o.k, o.n || 1, nomeItem(o), corDe(o)]); }); return r; };

export const Leve = {
  // a página tocou no mapa: o herói vai até lá pela estrada
  leveIr(id, m) {
    const j = this.jogadores.get(id); if (!j || !j.leve || j.criando) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    const x = Number(m?.x), z = Number(m?.z);
    if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 5000 || Math.abs(z) > 5000) return;
    if (j.morto) return aviso('Você caiu: espere renascer');
    if (j.veiculo && j.veiculo !== 'carrinho') return aviso('No barco ou no navio: só pelo jogo');
    // revisão de segurança 2026-11-25: destino na água ou longe demais custa caro na busca da estrada; e no máximo 2 por s
    if (this.tempo - (j.leveIrT ?? -9) < LEVE.intervalo) return;
    j.leveIrT = this.tempo;
    if (Math.hypot(x - j.x, z - j.z) > LEVE.longe || terraId(x, z) === 0) return aviso('Toque em terra, mais perto');
    const r = planejarRota(this.mapa, j, { x, z });
    if (r.bloqueio) { this.leveParar(id, null); return aviso(r.bloqueio === 'terra' ? 'Isso fica em outra terra: só de barco ou navio, no jogo' : 'O caminho cruza a água: só de barco, no jogo'); }
    if (j.vila) this.cancelarVila(j, null);
    if (j.coleta) this.pararColeta(j, null);
    if (j.pesca) this.pararPesca(j, null);
    j.leveRota = { pontos: r.pontos, i: 0, t: 0, ux: j.x, uz: j.z, presas: 0, nome: typeof m.nome === 'string' ? m.nome.slice(0, 40) : '' };
    // como o "Ir para" do mapa do jogo (rota.gd, André 2026-11-09: "sempre que eu usar o autopath já entra na montaria"):
    // viagem de verdade sobe no lobo sozinho, só quando o jogo deixaria (montar: sem pack, fora de combate, lobo liberado).
    // Desceu do lobo no meio do caminho: segue a pé até o próximo destino.
    let tam = 0, q = j; for (const p of r.pontos) { tam += Math.hypot(p.x - q.x, p.z - q.z); q = p; }
    if (tam > LEVE.montaDe && !j.montado && !j.veiculo && !this.motivoCarga?.(j) && liberado(j.prog, 'lobo') && !((j.pvpT ?? -1e9) + GUERRA.montaria > this.tempo && !j.pvp) && !(j.trava > 0) && !j.esc) { j.montado = 'lobo'; this.historia?.(j, 'montar'); }
    this.evento({ t: 'leveRota', para: id, pontos: r.pontos.map((p) => [Math.round(p.x), Math.round(p.z)]), nome: j.leveRota.nome });
  },
  leveParar(id, texto = 'Parou') {
    const j = this.jogadores.get(id); if (!j) return;
    const tinha = !!j.leveRota;
    j.leveRota = null; j.entrada = { mx: 0, mz: 0, correr: false };
    if (tinha) this.evento({ t: 'leveRota', para: id, pontos: [], ...(texto ? { texto } : {}) });
  },
  // um passo do herói do modo leve (antes do passoJogador): vira o "joystick" que leva ao próximo ponto do caminho
  passoLeve(j, dt) {
    const R = j.leveRota; if (!R) return;
    if (j.morto) return this.leveParar(j.id, null);
    const parado = { mx: 0, mz: 0, correr: false };
    // recall (casinha) ou totem: a caminhada acaba aqui; senão, ao chegar na base ele voltava a andar até o destino antigo
    // (André 2026-11-25: "o botão voltar pra base tá indo pra casinha antiga")
    if (j.vila) return this.leveParar(j.id, null);
    if (j.trava > 0 || j.canal) { j.entrada = parado; return; } // canalizando: espera
    const P = R.pontos, ult = P.length - 1;
    while (R.i <= ult && Math.hypot(P[R.i].x - j.x, P[R.i].z - j.z) < (R.i === ult ? LEVE.chega : LEVE.meio)) R.i++;
    if (R.i > ult) return this.leveChegou(j);
    const a = P[R.i], dx = a.x - j.x, dz = a.z - j.z, d = Math.hypot(dx, dz) || 1;
    j.entrada = { mx: dx / d, mz: dz / d, correr: !j.semFolego && !j.veiculo }; // com pack: a corrida vira x0,5 (PACK_REGRAS.costas), como no jogo (2,7 m/s)
    R.t += dt;
    if (R.t >= LEVE.olhar) { // preso (pedra, árvore, gente na frente)?
      const andou = Math.hypot(j.x - R.ux, j.z - R.uz);
      R.t = 0; R.ux = j.x; R.uz = j.z;
      if (andou >= LEVE.preso) { R.presas = 0; return; }
      const fim = P[ult];
      if (Math.hypot(fim.x - j.x, fim.z - j.z) < LEVE.quase) return this.leveChegou(j);
      if (++R.presas >= LEVE.desiste) return this.leveParar(j.id, 'Caminho bloqueado: toque em outro lugar');
      if (R.i < ult) R.i++; // tenta o ponto seguinte (contorna)
    }
  },
  leveChegou(j) {
    const nome = j.leveRota?.nome;
    j.leveRota = null; j.entrada = { mx: 0, mz: 0, correr: false };
    this.evento({ t: 'leveRota', para: j.id, pontos: [], chegou: 1, texto: nome ? `Chegou: ${nome}` : 'Chegou' });
  },
  // o que não muda (ou muda pouco): os lugares com janela, os totens, a loja e os baús. Vai ao entrar e de tempos em tempos
  leveMapa(j) {
    const p = j.prog, dsc = new Set(p.totens || []);
    const npcs = (this.mapa.npcs || []).filter((n) => FUNCOES.has(n.funcao) || (n.acoes || []).includes('vender'))
      .map((n) => ({ n: n.nome, f: FUNCOES.has(n.funcao) ? n.funcao : 'compra', x: r1(n.x), z: r1(n.z), ...((n.acoes || []).includes('vender') ? { v: 1 } : {}),
        // mercador de pack (PR 2 do modo leve): o id, o pack que ele faz e o material (a página mostra tenho/preciso)
        ...(n.funcao === 'pack' && PACKS[n.merch] ? { id: n.id, pk: PACKS[n.merch].nome, custo: Object.entries(custoPack(n.merch, p.prof?.mer)).map(([k, q]) => [k, ITENS[k]?.nome || k, q]) } : {}) }));
    const totens = TOTENS.lista.map((t) => ({ id: t.id, n: t.nome, x: r1(t.x), z: r1(t.z), d: dsc.has(t.id) ? 1 : 0, taxa: taxaTotem(t) }));
    const loja = LOJA.map((o, i) => ({ i, k: o.k, n: ITENS[o.k]?.nome || o.k, preco: this.precoCompra(j, o) }));
    const baus = [];
    const L = this.loteDe?.(j);
    if (L) for (const o of L.pecas || []) if (o.k === 'bau' || o.k === 'bau_cla') baus.push({ cla: o.k === 'bau_cla' ? 1 : 0, x: r1(o.x), z: r1(o.z) });
    const bb = this.bauBase?.(this.baseDe?.(j)); if (bb) baus.push({ cla: 1, x: r1(bb.x), z: r1(bb.z) });
    return { npcs, totens, loja, baus, lug: this.leveLugares(j) };
  },
  // a lista "Lugares" do mapa (André 2026-11-25: "menu igual do jogo real com todos os NPCs, recursos, mercadores, e
  // sanfonado, que pudesse clicar ir para"): as mesmas seções do mapa do jogo (minimapa.gd SECOES). [seção, nome, x, z].
  // Recursos: o mais perto de cada tipo (veio, árvore, galho, pedra solta), como no jogo; vai a cada minuto com o mapa.
  leveLugares(j) {
    const L = [], M = this.mapa, por = (sec, nome, x, z) => { if (Number.isFinite(x) && Number.isFinite(z)) L.push([sec, nome, r1(x), r1(z)]); };
    const B = this.baseDe?.(j); if (B) por('vilas', 'Base do clã', B.x, B.z);
    const lt = this.loteDe?.(j)?.def; if (lt) por('vilas', 'Sua casa', lt.x ?? (lt.x0 + lt.x1) / 2, lt.z ?? (lt.z0 + lt.z1) / 2);
    por('vilas', 'Vila da Clareira', M.nascimento?.x, M.nascimento?.z);
    for (const o of LUGARES_MUNDO) if (o.tipo === 'vila' || o.tipo === 'porto' || o.tipo === 'posto') por('vilas', o.nome, o.x, o.z);
    for (const t of TOTENS.lista) por('totens', 'Totem: ' + t.nome, t.x, t.z);
    for (const c of [...CACA].sort((a, b) => (a.nivel | 0) - (b.nivel | 0))) if (!c.tunel) por(c.boss ? 'boss' : 'caca', `${c.boss ? 'Boss ' : ''}Nv ${c.nivel | 0} ${c.nome || ''}`.trim(), c.x, c.z);
    const boca = TUNEL?.amostras?.[0]; if (boca) por('dungeon', TUNEL.def?.nome || 'Caverna', boca.x, boca.z);
    for (const T of TUNEIS_MUNDO) { const a = T.amostras?.[0]; if (a) por('dungeon', T.def?.nome || 'Gruta', a.x, a.z); }
    const perto = new Map(), ver = (k, nome, o) => { const d = Math.hypot(o.x - j.x, o.z - j.z), q = perto.get(k); if (!q || d < q[0]) perto.set(k, [d, nome, o]); };
    for (const o of M.mina || []) ver('mina_' + o.tipo, { pedra: 'Veio de pedra', cobre: 'Veio de cobre', ferro: 'Veio de ferro', cristal: 'Veio de cristal' }[o.tipo] || o.nome, o);
    for (const o of M.mata || []) ver('arvore', 'Árvore, madeira', o);
    for (const o of M.soltos || []) if (o.tipo === 'galho' || o.tipo === 'pedrinha') ver(o.tipo, o.tipo === 'galho' ? 'Galho no chão' : 'Pedra solta', o);
    for (const [, nome, o] of perto.values()) por('recursos', nome + ' (mais perto)', o.x, o.z);
    for (const o of M.lagos || []) if (o.pesca) por('pesca', o.nome, o.chegada?.[0] ?? o.x, o.chegada?.[1] ?? o.z);
    for (const o of M.estacoes || []) por('oficinas', o.nome, o.x, o.z);
    for (const n of M.npcs || []) por(n.funcao === 'pack' ? 'mercadores' : 'npcs', n.nome, n.x, n.z);
    return L;
  },
  // os avisos que a página usa, mais leves e já com o nome de cada item (a página não carrega a tabela de itens)
  leveEvento(e) {
    if (e.t === 'leilao') {
      const um = (a) => ({ id: a.id, k: a.item.k, n: a.item.n || 1, nome: nomeItem(a.item), c: corDe(a.item), preco: a.preco, ...(a.casa ? { casa: 1 } : { v: a.vendedor, ate: a.ate }) });
      return { t: 'leilao', lista: (e.lista || []).slice(0, LEVE.leilao).map(um), meus: (e.meus || []).map(um), caixa: { ouro: e.caixa?.ouro | 0, n: e.caixa?.itens?.length | 0 }, horas: e.horas, taxaAnuncio: e.taxaAnuncio, agora: e.agora };
    }
    // chat: só o texto (a página mostra as últimas LEVE.chat)
    if (e.t === 'chat') return { t: 'chat', k: e.canal, n: e.nome, x: e.texto, ...(e.meu ? { meu: 1 } : {}) };
    if (e.t === 'chatHist') return { t: 'chatHist', l: (e.lista || []).slice(-LEVE.chat).map((m) => ({ k: m.canal, n: m.nome, x: m.texto, ...(m.meu ? { meu: 1 } : {}) })) };
    if (e.t === 'vila') return { t: 'vila', fase: e.fase, ...(e.dur ? { dur: e.dur } : {}) }; // recall ou totem: só a fase (o painel mostra a contagem)
    if (e.t === 'fabricando') return { t: 'fabricando', nome: e.nome || ITENS[e.k]?.nome || '', dur: e.dur, ...(e.fim ? { fim: 1 } : {}) };
    if (e.t === 'bau') return { t: 'bau', cla: e.cla ? 1 : 0, l: (e.itens || []).length, it: listaLeve(e.itens) };
    return e;
  },
  // quanto o mercador n paga pelo pack pk agora (a mesma conta do Transporte.pack 'entregar'); 0 = ele não compra
  precoEntregaLeve(j, pk, n) {
    if (!pk || Math.hypot(n.x - pk.ox, n.z - pk.oz) < PACK_REGRAS.perto) return 0;
    const p = j.prog;
    return Math.max(1, Math.round(precoPack(pk, n, p.prof?.mer) * mercadoK(p, n.id, pk.k) * (1 + (this.vantagensDe?.(j).pack || 0)) * (pk.rb ? 1 + GUERRA.roubado : 1)));
  },
  // packs e carrinho como a página mostra (PR 2 do modo leve, André 2026-11-25: "mais que combate quero fazer pack"):
  // c = o pack das costas [k, nome, roubado]; car = o carrinho; e = onde entregar [id, nome, x, z, paga costas, paga carrinho];
  // ch = packs no chão perto [g, k, nome, x, z]; tb = tem bot no time (ordens de pack do time). Vai só quando muda.
  packLeve(j) {
    const p = j.prog, pk = p.pack, C = VEICULOS.carrinho, c = p.carrinho;
    const nomePk = (o) => PACKS[o.k]?.nome || o.k;
    const r = { c: pk ? [pk.k, nomePk(pk), pk.rb ? 1 : 0] : 0, tem: contar(p.mochila, 'carrinho') > 0 ? 1 : 0, gal: contar(p.mochila, 'galao') };
    if (c) {
      const pos = j.veiculo === 'carrinho' ? j : c.chao;
      r.car = { lv: c.lv, comb: Math.round(c.comb), tq: C.galao * C.tanque, vida: Math.round(c.vida), vm: C.vida, q: c.quebrado ? 1 : 0, cap: capacidadeCarrinho(c),
        n: c.packs.map((o) => [o.k, nomePk(o)]), onde: j.veiculo === 'carrinho' ? 2 : c.chao ? 1 : 0, ...(pos ? { x: r1(pos.x), z: r1(pos.z) } : {}) };
    }
    if (pk || c?.packs?.length) {
      r.e = [];
      for (const n of this.mapa.npcs || []) {
        if (n.funcao !== 'pack') continue;
        const a = this.precoEntregaLeve(j, pk, n);
        let b = 0; for (const o of c?.packs || []) b += this.precoEntregaLeve(j, o, n);
        if (a || b) r.e.push([n.id, n.nome.split(',')[0], r1(n.x), r1(n.z), a, b]);
      }
    }
    r.ch = [];
    for (const g of this.packsChao || []) {
      if (Math.hypot(g.x - j.x, g.z - j.z) > LEVE.packsChao) continue;
      r.ch.push([g.g, g.k, PACKS[g.k]?.nome || g.k, r1(g.x), r1(g.z)]);
      if (r.ch.length >= 12) break;
    }
    if (j.time?.membros?.some((k) => this.jogadores.get(k)?.bot)) r.tb = 1;
    return r;
  },
  // dirigindo o carrinho pelo modo leve: o servidor andou o herói (passoJogador); aqui vale o que o celular confere no
  // jogo (Simulacao.posicaoCliente -> andouVeiculo): gasta combustível e não entra na água
  leveAndouVeiculo(j, x0, z0) {
    const d = Math.hypot(j.x - x0, j.z - z0); if (d < 1e-4) return;
    if (!this.andouVeiculo(j, j.x, j.z, d)) { j.x = x0; j.z = z0; this.leveParar(j.id, 'O carrinho não entra na água'); }
  },
  // a mochila como a página mostra: só os lugares com item (i = o lugar de verdade), nome, cor da raridade e preço de venda
  mochilaLeve(j) {
    const p = j.prog, merc = mercador(p.prof?.mer).venda + (bonusTitulo(p).venda || 0), r = [];
    (p.mochila || []).forEach((o, i) => {
      if (!o || !ITENS[o.k]) return;
      r.push([i, o.k, o.n || 1, nomeItem(o), corDe(o), precoVenda(o, merc), o.cad ? 1 : 0]);
    });
    return { l: (p.mochila || []).length, it: r };
  },
  // a foto pequena da página: eu, o caminho que falta, e só quem está perto
  fotoLeve(j) {
    const R = j.leveRota;
    let falta = 0;
    if (R) { let q = j; for (let i = R.i; i < R.pontos.length; i++) { const a = R.pontos[i]; falta += Math.hypot(a.x - q.x, a.z - q.z); q = a; } }
    const v = j.veiculo ? this.velVeiculo(j) || HEROI.andar : MONTARIAS[j.montado] ? MONTARIAS[j.montado].correr : j.prog.pack ? HEROI.correr * PACK_REGRAS.costas.vel : HEROI.correr;
    const g = [];
    for (const o of this.jogadores.values()) {
      if (o === j || o.criando || o.caverna || Math.hypot(o.x - j.x, o.z - j.z) > LEVE.gente) continue;
      g.push([o.nome, r1(o.x), r1(o.z), this.racaDe(o) === 'Geada' ? 1 : 0, o.bot ? 1 : 0, o.prog?.nivel | 0, o.morto ? 1 : 0]);
      if (g.length >= LEVE.max) break;
    }
    const m = [];
    for (const e of this.inimigos) {
      if (e.morto || Math.hypot(e.x - j.x, e.z - j.z) > LEVE.bichos) continue;
      m.push([r1(e.x), r1(e.z), e.nivel | 0, Math.round((e.vida / (e.vidaMax || 1)) * 100)]);
      if (m.length >= LEVE.max) break;
    }
    return {
      eu: [r1(j.x), r1(j.z), Math.round(j.vida), Math.round(j.vidaMax), Math.round(j.mana), Math.round(j.manaMax), j.morto ? 1 : 0, j.prog.ouro | 0, j.prog.nivel | 0, j.prog.pack ? 1 : 0, j.montado ? 1 : 0], // montado: o lobo (botão Montar, a mesma mensagem e regra do jogo)
      ...(R ? { r: [Math.round(falta), Math.round(falta / (v || 1))] } : {}),
      g, m,
    };
  },
};

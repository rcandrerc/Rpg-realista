// Modo leve (André 2026-11-25: "uma interface meio que pra eu logar no jogo... só um mapa, eu clico e vai... ir na
// action house, fazer algumas tarefas básicas, vender itens... que rode num celular muito vagabundo"). A aba Jogar do
// painel do clã (client/painel.html) entra na sala como um jogador de verdade: o herói tem corpo no mundo, os outros
// veem, a Geada pode atacar. A página não manda posição: manda o destino (leveIr) e o SERVIDOR anda o herói pela
// estrada (shared/rota.js, a mesma dos recrutas), na velocidade normal a pé. Não existe teleporte: totem só do jeito
// pago de sempre. Loja, leilão e baú usam as mesmas mensagens do jogo (item, leilao, bau), com as mesmas regras de
// distância. Para o celular fraco: a cada LEVE.envio s vai uma foto pequena só do que está perto (fotoLeve).
import { planejarRota, terraId } from './rota.js';
import { ITENS, RARIDADES, TOTENS, LOJA, taxaTotem, HEROI, PACK_REGRAS } from './dados.js';
import { nomeItem, precoVenda, mercador, bonusTitulo } from './progresso.js';

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
    if (j.trava > 0 || j.canal || j.vila) { j.entrada = parado; return; } // canalizando (totem, casinha): espera
    const P = R.pontos, ult = P.length - 1;
    while (R.i <= ult && Math.hypot(P[R.i].x - j.x, P[R.i].z - j.z) < (R.i === ult ? LEVE.chega : LEVE.meio)) R.i++;
    if (R.i > ult) return this.leveChegou(j);
    const a = P[R.i], dx = a.x - j.x, dz = a.z - j.z, d = Math.hypot(dx, dz) || 1;
    j.entrada = { mx: dx / d, mz: dz / d, correr: !j.prog.pack && !j.semFolego && !j.veiculo };
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
      .map((n) => ({ n: n.nome, f: FUNCOES.has(n.funcao) ? n.funcao : 'compra', x: r1(n.x), z: r1(n.z), ...((n.acoes || []).includes('vender') ? { v: 1 } : {}) }));
    const totens = TOTENS.lista.map((t) => ({ id: t.id, n: t.nome, x: r1(t.x), z: r1(t.z), d: dsc.has(t.id) ? 1 : 0, taxa: taxaTotem(t) }));
    const loja = LOJA.map((o, i) => ({ i, k: o.k, n: ITENS[o.k]?.nome || o.k, preco: this.precoCompra(j, o) }));
    const baus = [];
    const L = this.loteDe?.(j);
    if (L) for (const o of L.pecas || []) if (o.k === 'bau' || o.k === 'bau_cla') baus.push({ cla: o.k === 'bau_cla' ? 1 : 0, x: r1(o.x), z: r1(o.z) });
    const bb = this.bauBase?.(this.baseDe?.(j)); if (bb) baus.push({ cla: 1, x: r1(bb.x), z: r1(bb.z) });
    return { npcs, totens, loja, baus };
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
    if (e.t === 'bau') return { t: 'bau', cla: e.cla ? 1 : 0, l: (e.itens || []).length, it: listaLeve(e.itens) };
    return e;
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
    const v = j.veiculo ? this.velVeiculo(j) || HEROI.andar : j.prog.pack ? HEROI.correr * PACK_REGRAS.costas.vel : HEROI.correr;
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
      eu: [r1(j.x), r1(j.z), Math.round(j.vida), Math.round(j.vidaMax), Math.round(j.mana), Math.round(j.manaMax), j.morto ? 1 : 0, j.prog.ouro | 0, j.prog.nivel | 0, j.prog.pack ? 1 : 0],
      ...(R ? { r: [Math.round(falta), Math.round(falta / (v || 1))] } : {}),
      g, m,
    };
  },
};

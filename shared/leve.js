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
import { LUGARES, TITULOS, BUILD_PADRAO, RECEITAS, CRIAR_OBRA, COLETA, COLETA_DISTANCIA, BASICO, BASICO_MAGIA, CURA, HABILIDADES, ESPACOS_ESPADA, tempoCriar, RECEITA_ESTACAO, CONSTRUCOES, ITENS, RARIDADES, TOTENS, LOJA, taxaTotem, HEROI, PACK_REGRAS, PACKS, VEICULOS, GUERRA, MONTARIAS, CACA, TUNEIS_MUNDO } from './dados.js';
import { nomeItem, precoVenda, mercador, bonusTitulo, contar, vigorAgora, vigorMax, ATRIBUTOS, xpProximo } from './progresso.js';
import { precoPack, mercadoK, custoPack, capacidadeCarrinho } from './transporte.js';
import { liberado, missaoAtual } from './historia.js';
import { noLago } from './relevo.js';
import { aguaRegador, pertoDeAgua, distRet, crescerPlanta, retPeca, semParede } from './simulacao.js'; // fazenda e cama (etapa 6); só usadas na hora, depois que tudo carregou
import { PESCA, PLANTAS, HORTA, LOTE, fasePlanta } from './dados.js';
import { horaDoJogo, ehNoite } from './progresso.js';

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
  coleta: 12, // m: veios, árvores e soltos que aparecem no Aqui (Minerar, Cortar, Pegar)
  reto: 30, // m do monstro: o Atacar deixa a estrada e vai reto até ele
  encosta: 2, // m do monstro: o Atacar para aqui (alcance do golpe é 2,3 m)
  spotVe: 40, // m: spot de pesca que aparece sem o Radar (a água borbulhando, como no jogo); com o Radar ligado, qualquer um
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

// o que a peça dá, curto ("Defesa 10 · Vida 22"); comida e poção: o que cura
const NOME_ST = { vida: 'Vida', mana: 'Mana', defesa: 'Defesa', critico: 'Crítico %', danoCritico: 'Dano crítico %', danoFisico: 'Dano físico', danoMagico: 'Dano mágico', danoK: 'Dano %', regenManaK: 'Volta de mana %' };
function textoPeca(o) {
  const I = ITENS[o.k]; if (!I) return '';
  if (I.st && o.r != null) return Object.entries(I.st).map(([c, v]) => `${NOME_ST[c] || c} ${Math.round(((v[o.r] ?? 0) * (c.endsWith('K') ? 100 : 1)) * 10) / 10}`).join(' · ');
  const u = I.usar; if (!u) return '';
  return [u.vida && `Vida +${Math.round(u.vida * 100)}%`, u.mana && `Mana +${Math.round(u.mana * 100)}%`, u.vigor && `Vigor +${u.vigor}`].filter(Boolean).join(' · ');
}

// a rota do jogo leve: a das estradas (planejarRota), mas saindo e entrando nas bases do clã pelo portão (saidaDaBase)
function rotaLeve(sim, de, ate) {
  const sai = sim.saidaDaBase?.(de), entra = sim.saidaDaBase?.(ate);
  if (sai && entra && sai.k === entra.k) return planejarRota(sim.mapa, de, ate); // dentro da mesma base: vai direto
  const ini = sai ? sai.pontos[sai.pontos.length - 1] : de, volta = entra ? [...entra.pontos].reverse() : [];
  const r = planejarRota(sim.mapa, ini, entra ? volta[0] : ate); if (r.bloqueio) return r;
  const pontos = [...(sai ? sai.pontos : []), ...r.pontos, ...volta.slice(1), ...(entra ? [{ x: ate.x, z: ate.z }] : [])];
  let q = de, metros = 0; for (const p of pontos) { metros += Math.hypot(p.x - q.x, p.z - q.z); q = p; }
  return { pontos, metros };
}

// pesca do leve: onde a boia cai. O jogo aceita de 1,5 a 5,2 m do herói, na água e dentro do spot (raioSpot + 0,4).
// Procura na direção do spot e para os lados (o jogador mira a boia com o dedo; aqui o servidor acha o mesmo lugar válido)
function pontoLancar(j, sp) {
  const ok = (x, z) => Math.hypot(x - sp.x, z - sp.z) <= PESCA.raioSpot + 0.3 && (noLago(x, z)?.fundo || 0) > 0.15;
  const d = Math.hypot(sp.x - j.x, sp.z - j.z) || 1, a0 = Math.atan2(sp.z - j.z, sp.x - j.x);
  for (const da of [0, 0.3, -0.3, 0.6, -0.6, 0.9, -0.9, 1.2, -1.2]) for (const r of [4.8, 4, 3, 2]) {
    const x = j.x + Math.cos(a0 + da) * r, z = j.z + Math.sin(a0 + da) * r; if (ok(x, z)) return { x, z };
  }
  return d >= 1.6 && d <= 5 && ok(sp.x, sp.z) ? { x: sp.x, z: sp.z } : null;
}
// a beira mais perto do herói de onde a linha alcança o spot (terra seca, com um ponto de lançar válido)
function beiraDoSpot(j, sp) {
  let b = null, md = Infinity;
  for (let k = 0; k < 32; k++) {
    const a = (k / 32) * Math.PI * 2;
    for (let r = PESCA.raioSpot + 1; r <= PESCA.raioSpot + 9; r += 1) {
      const x = sp.x + Math.cos(a) * r, z = sp.z + Math.sin(a) * r;
      if ((noLago(x, z)?.fundo || 0) > 0 || terraId(x, z) === 0) continue;
      if (!pontoLancar({ x, z }, sp)) break; // a primeira terra seca desse lado não alcança: lado ruim
      const q = Math.hypot(x - j.x, z - j.z); if (q < md) { md = q; b = { x, z }; }
      break;
    }
  }
  return b;
}
export const Leve = {
  // o monstro escolhido no mapa (Atacar), se ainda vivo e a até 22 m (o alcance do maisPerto): os golpes viram para ele,
  // como o botão Trocar alvo do jogo. André 2026-11-27: "mostrar qual mob que eu tô atacando"
  alvoLeve(j) {
    if (!j.leveMira) return null;
    const e = this.inimigos.find((o) => o.id === j.leveMira);
    if (!e || e.morto || Math.hypot(e.x - j.x, e.z - j.z) > 22) { j.leveMira = null; return null; }
    return e;
  },
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
    const r = rotaLeve(this, j, { x, z });
    if (r.bloqueio) { this.leveParar(id, null); return aviso(r.bloqueio === 'terra' ? 'Isso fica em outra terra: só de barco ou navio, no jogo' : 'O caminho cruza a água: só de barco, no jogo'); }
    if (j.vila) this.cancelarVila(j, null);
    if (j.coleta) this.pararColeta(j, null);
    if (j.pesca) this.pararPesca(j, null);
    j.leveRota = { pontos: r.pontos, i: 0, t: 0, ux: j.x, uz: j.z, presas: 0, nome: typeof m.nome === 'string' ? m.nome.slice(0, 40) : '' };
    // Atacar (André 2026-11-25: "combate... sem automático"): só anda até o monstro e para do lado; cada golpe é um toque
    if (typeof m.alvo === 'string') { j.leveRota.alvo = m.alvo; j.leveMira = m.alvo; } // leveMira: os golpes viram para ele (alvoLeve), como o Trocar alvo do jogo
    // como o "Ir para" do mapa do jogo (rota.gd, André 2026-11-09: "sempre que eu usar o autopath já entra na montaria"):
    // viagem de verdade sobe no lobo sozinho, só quando o jogo deixaria (montar: sem pack, fora de combate, lobo liberado).
    // Desceu do lobo no meio do caminho: segue a pé até o próximo destino.
    let tam = 0, q = j; for (const p of r.pontos) { tam += Math.hypot(p.x - q.x, p.z - q.z); q = p; }
    if (tam > LEVE.montaDe && !j.montado && !j.veiculo && !this.motivoCarga?.(j) && liberado(j.prog, 'lobo') && !((j.pvpT ?? -1e9) + GUERRA.montaria > this.tempo && !j.pvp) && !(j.trava > 0) && !j.esc) { j.montado = 'lobo'; this.historia?.(j, 'montar'); }
    this.evento({ t: 'leveRota', para: id, pontos: r.pontos.map((p) => [Math.round(p.x), Math.round(p.z)]), nome: j.leveRota.nome });
  },
  // Recursos > "Veio de ferro (mais perto)" (André 2026-11-25: "já me direciona pro mais próximo que não esteja esgotado...
  // se o mais próximo tiver esgotado me joga pra outro"): o mais perto DESSE tipo com carga para você, na hora do toque.
  // Só leva; minerar continua no toque do Minerar
  leveIrRecurso(id, m) {
    const j = this.jogadores.get(id); if (!j || !j.leve || j.criando || j.morto) return;
    const t = String(m?.t || ''); if (!COLETA[t]) return;
    let melhor = null, md = LEVE.longe;
    for (const no of this.coletaveis.values()) {
      if (no.tipo !== t || (no.y != null && Math.abs((j.y || 0) - no.y) > 2.5)) continue;
      const d = Math.hypot(no.x - j.x, no.z - j.z); if (d >= md || this.cargas(j, no) <= 0) continue;
      md = d; melhor = no;
    }
    if (!melhor) return this.evento({ t: 'aviso', para: id, texto: `${COLETA[t].nome}: todos esgotados por perto, volte mais tarde` });
    this.leveIr(id, { x: melhor.x, z: melhor.z, nome: COLETA[t].nome });
  },
  // Minerar / Cortar / Pegar pelo modo leve: perto, coleta na hora; longe, anda até a borda e coleta ao chegar
  leveColetar(id, m) {
    const j = this.jogadores.get(id); if (!j || !j.leve || j.criando || j.morto) return;
    const no = this.coletaveis.get(String(m?.no || '')); if (!no) return;
    if (m.parar || j.coleta) return this.coletar(id, { no: no.id, parar: true });
    if (Math.hypot(no.x - j.x, no.z - j.z) - no.r < COLETA_DISTANCIA - 0.2) { this.leveParar(id, null); return this.coletar(id, { no: no.id }); }
    this.leveIr(id, { x: no.x, z: no.z, nome: COLETA[no.tipo]?.nome || '' });
    if (j.leveRota) j.leveRota.no = no.id;
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
    if (R.no != null) { // indo minerar/cortar/pegar (André 2026-11-25): chega na borda e começa sozinho (o mesmo 'coletar' do jogo)
      const no = this.coletaveis.get(R.no); if (!no) return this.leveParar(j.id, null);
      const d = Math.hypot(no.x - j.x, no.z - j.z) - no.r;
      if (d < COLETA_DISTANCIA - 0.4) { const k = R.no; this.leveParar(j.id, null); j.montado = null; return this.coletar(j.id, { no: k }); }
      if (d < LEVE.quase + 2) { j.entrada = { mx: (no.x - j.x) / (d + no.r), mz: (no.z - j.z) / (d + no.r), correr: false }; return; } // perto: reto até a borda
    }
    if (R.spot != null) { // indo pescar (etapa 6): chegou na beira, lança a linha no spot (o mesmo 'pescar' do jogo)
      const sp = this.spots.find((v) => v.ativo && v.id === R.spot); if (!sp) return this.leveParar(j.id, 'O spot sumiu');
      const q = (noLago(j.x, j.z)?.fundo || 0) < 0.3 && pontoLancar(j, sp); // passando pela água rasa: só lança depois de sair dela
      if (q) { this.leveParar(j.id, null); j.montado = null; return this.pescar(j.id, { acao: 'lancar', x: q.x, z: q.z }); }
      const fim = R.pontos[R.pontos.length - 1];
      if (R.beira != null || Math.hypot(fim.x - j.x, fim.z - j.z) < LEVE.chega + 0.5) { // na beira e a linha não alcança: uns passos retos para a água (como o joystick)
        R.beira = (R.beira || 0) + dt;
        if (R.beira > 4 || (noLago(j.x, j.z)?.fundo || 0) > 0.6) { this.leveParar(j.id, null); return this.evento({ t: 'aviso', para: j.id, texto: 'Chegue mais perto da água' }); }
        const d = Math.hypot(sp.x - j.x, sp.z - j.z) || 1; j.entrada = { mx: (sp.x - j.x) / d, mz: (sp.z - j.z) / d, correr: false }; return;
      }
    }
    if (R.alvo != null) { // indo atacar: segue o monstro (ele anda) e para a LEVE.encosta m dele
      const e = this.inimigos.find((o) => o.id === R.alvo);
      if (!e || e.morto) return this.leveParar(j.id, 'O alvo sumiu');
      const de = Math.hypot(e.x - j.x, e.z - j.z);
      if (de < LEVE.encosta) { j.montado = null; return this.leveChegou(j); }
      // perto (a estrada acaba antes do mato onde ele está): vai reto até ele, como o jogador no joystick
      if (de < LEVE.reto) { j.entrada = { mx: (e.x - j.x) / de, mz: (e.z - j.z) / de, correr: !j.semFolego && !j.veiculo }; return; }
      const fim = R.pontos[R.pontos.length - 1];
      if (Math.hypot(e.x - fim.x, e.z - fim.z) > 3 && this.tempo - (R.refez ?? -9) > 1) {
        const r = rotaLeve(this, j, { x: e.x, z: e.z }); R.refez = this.tempo;
        if (!r.bloqueio && r.pontos.length) { R.pontos = r.pontos; R.i = 0; this.evento({ t: 'leveRota', para: j.id, pontos: r.pontos.map((p) => [Math.round(p.x), Math.round(p.z)]), nome: R.nome }); }
      }
    }
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
    if (j.leveRota?.spot != null) { const sp = this.spots.find((v) => v.ativo && v.id === j.leveRota.spot), q = sp && pontoLancar(j, sp); this.leveParar(j.id, null); if (q) { j.montado = null; return this.pescar(j.id, { acao: 'lancar', x: q.x, z: q.z }); } return this.evento({ t: 'aviso', para: j.id, texto: 'Chegue mais perto da água' }); }
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
    // no mapa, como o minimapa do jogo (minimapa.gd, André 2026-11-26: "todos os recursos, spots aparecendo no próprio mapa"):
    // as clareiras de caça [x, z, nível, bicho, boss] e as zonas de mineração [x, z, tipo]
    const cc = CACA.filter((c) => !c.tunel && Number.isFinite(c.x)).map((c) => [r1(c.x), r1(c.z), c.nivel | 0, c.bicho || '', c.boss ? 1 : 0]);
    const mn = (this.mapa.mina || []).map((o) => [r1(o.x), r1(o.z), o.tipo || '']);
    return { npcs, totens, loja, baus, lug: this.leveLugares(j), cc, mn };
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
    for (const [k, [, nome, o]] of perto) { por('recursos', nome + ' (mais perto)', o.x, o.z); L[L.length - 1]?.push(k.startsWith('mina_') ? k.slice(5) : k); } // 5º: o tipo (leveIrRecurso escolhe o que não está esgotado)
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
    if (e.t === 'chat') return { t: 'chat', k: e.canal, n: e.nome, x: e.texto, ...(e.hora ? { h: e.hora } : {}), ...(e.meu ? { meu: 1 } : {}) }; // h: o app mostra "há 5 min"
    if (e.t === 'chatHist') return { t: 'chatHist', l: (e.lista || []).slice(-LEVE.chat).map((m) => ({ k: m.canal, n: m.nome, x: m.texto, ...(m.hora ? { h: m.hora } : {}), ...(m.meu ? { meu: 1 } : {}) })) };
    if (e.t === 'vila') return { t: 'vila', fase: e.fase, ...(e.dur ? { dur: e.dur } : {}) }; // recall ou totem: só a fase (o painel mostra a contagem)
    if (e.t === 'fabricando') return { t: 'fabricando', nome: e.nome || ITENS[e.k]?.nome || '', dur: e.dur, ...(e.fim ? { fim: 1 } : {}) };
    // coleta (André 2026-11-26): o painel mostra "Minerando…", a barra até a próxima batida e quanto já pegou
    if (e.t === 'coleta') return { t: 'coleta', no: e.no, dur: e.dur, prof: e.prof || '' };
    if (e.t === 'coletou') return { t: 'coletou', no: e.no, itens: (e.itens || []).map((o) => ({ nome: o.nome, n: o.n })), cargas: e.cargas };
    if (e.t === 'fala') return { t: 'fala', npc: (this.mapa.npcs || []).find((n) => n.id === e.npc)?.nome?.split(',')[0] || '', texto: e.texto }; // o que o NPC disse (missão)
    // troca (etapa 5): os itens com nome e cor (a página não tem a tabela de itens)
    if (e.t === 'troca' && e.fase === 'estado') { const of = (o) => ({ ouro: o.ouro, tranca: o.tranca ? 1 : 0, ok: o.ok ? 1 : 0, itens: o.itens.map((x) => ({ ...(x.i != null ? { i: x.i } : {}), n: x.n, k: x.it?.k, nome: x.it ? nomeItem(x.it) : '?', c: x.it ? corDe(x.it) : null })) }); return { t: 'troca', fase: 'estado', com: e.com, nome: e.nome, eu: of(e.eu), ele: of(e.ele) }; }
    if (e.t === 'pvp' && e.fase === 'info') { const { loja, ...r } = e; return r; } // a loja de Insígnias fica no jogo
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
  // etapa 2 (André 2026-11-26, versão leve completa): [7] o que dá para fazer ('e' = vestir no lugar [8], 'u' = usar,
  // '' = nada), [9] o que a peça dá; eq = o que está vestido [lugar, k, nome, cor, o que dá]. Equipar, tirar e usar são
  // as mesmas mensagens do jogo ('item' equipar/tirar/usar): o servidor confere tudo.
  mochilaLeve(j) {
    const p = j.prog, merc = mercador(p.prof?.mer).venda + (bonusTitulo(p).venda || 0), r = [];
    (p.mochila || []).forEach((o, i) => {
      if (!o || !ITENS[o.k]) return;
      const I = ITENS[o.k], tipo = I.lugar ? 'e' : (I.usar && !I.usar.veiculo) || o.k === 'tomo' ? 'u' : '';
      r.push([i, o.k, o.n || 1, nomeItem(o), corDe(o), precoVenda(o, merc), o.cad ? 1 : 0, tipo, I.lugar || '', textoPeca(o)]);
    });
    const eq = LUGARES.filter((l) => p.equip?.[l] && ITENS[p.equip[l].k]).map((l) => { const o = p.equip[l]; return [l, o.k, nomeItem(o), corDe(o), textoPeca(o)]; });
    return { l: (p.mochila || []).length, it: r, eq };
  },
  // Criar (André 2026-11-25): as MESMAS receitas e regras do jogo (RECEITAS, motivoReceita, `criar`); aqui só se lista.
  // [receita, nome, [[k, nome, qtd]], estação, nome da estação, perto dela (1/0), motivo (sem contar a estação), segundos]
  leveReceitas(j) {
    // onde ficam as estações (as públicas da vila e as do próprio terreno): a página leva o herói até a mais perto
    const est = (this.mapa.estacoes || []).map((E) => [E.k, E.nome, r1(E.x), r1(E.z)]);
    const L = this.loteDe?.(j); if (L) for (const o of L.pecas || []) if (CONSTRUCOES[o.k]?.estacao && ['bancada', 'bigorna', 'fornalha', 'fogao'].includes(o.k)) est.push([o.k, 'Seu terreno', r1(o.x), r1(o.z)]);
    return {
      est,
      max: CRIAR_OBRA.maxFila,
      r: Object.entries(RECEITAS).filter(([, R]) => RECEITA_ESTACAO(R) !== 'fornalha').map(([r, R]) => { // carvão e barras só na fornalha (André 2026-11-26)
        const e = RECEITA_ESTACAO(R);
        return [r, ITENS[R.faz].nome, Object.entries(R.usa).map(([k, q]) => [k, ITENS[k]?.nome || k, q]), e, e === 'fogao' ? 'Fogão' : CONSTRUCOES[e]?.nome || e,
          this.estacaoPerto(j, R) ? 1 : 0, this.motivoReceitaSem(j, R).motivo, Math.round(tempoCriar(R))];
      }),
    };
  },
  // Missões (etapa 3, André 2026-11-26): a aba Missões da página. Só vai com a aba aberta (leveMissoes ver) e só quando muda.
  // hi = a história como no jogo (histInfo) com o NPC dela; di = diárias; gu = guilda; mc = Escolta do Clã. Os botões
  // usam as mesmas mensagens do jogo ('falar' com missao, 'diaria', 'guilda', 'cla' missao); o servidor confere tudo.
  leveMissoes(j) {
    const H = this.histInfo(j), npcDe = (id) => (this.mapa.npcs || []).find((n) => n.id === id);
    let hi = null;
    if (H) {
      const N = H.npc ? npcDe(H.npc) : null, a = H.alvo;
      hi = { nome: H.nome, txt: H.txt, ac: H.e >= 0 ? 1 : 0, nv: missaoAtual(j.prog)?.nv | 0, ...(H.titulo ? { tit: H.titulo } : {}),
        ...(N ? { npc: N.id, nn: N.nome.split(',')[0], nx: r1(N.x), nz: r1(N.z), np: Math.hypot(N.x - j.x, N.z - j.z) <= 4 ? 1 : 0 } : {}), // np: perto para falar (FALAR_JANELA); a distância a página calcula
        ...(a && Number.isFinite(a.x) ? { ax: r1(a.x), az: r1(a.z), an: a.nome || '' } : {}) };
    }
    const G = this.guildaInfo(j), B = this.baseDe?.(j);
    return { hi, di: this.diariasInfo(j), gu: G && { rank: G.rank, pg: G.pg, pgMax: G.pgMax, prova: G.prova ? 1 : 0, pv: G.pv ? 1 : 0, perto: G.perto ? 1 : 0, ativos: G.ativos, l: G.l },
      mc: j.prog.cla && B ? this.missaoInfo(B) : null, pe: this.personagemLeve(j) };
  },
  // Personagem (etapa 4, André 2026-11-26): status, atributos (+ e Confirmar = msg 'atributos'), golpes (a build de 8 do
  // jogo = msg 'build') e títulos (msg 'item' titulo). Tudo o servidor confere, como no menu do jogo.
  personagemLeve(j) {
    const p = j.prog, st = j.st || {}, pc = (v) => Math.round((v || 0) * 1000) / 10;
    const b = (o) => Object.entries(o || {}).map(([k, v]) => `+${pc(v)}% ${({ dano: 'dano', vida: 'vida', critico: 'crítico', defesa: 'defesa', xp: 'XP', venda: 'venda' })[k] || k}`).join(' · ');
    return { nv: p.nivel | 0, xp: Math.floor(p.xp || 0), xpM: xpProximo(p.nivel), pts: p.pontos | 0, atr: p.atr,
      an: Object.fromEntries(Object.entries(ATRIBUTOS).map(([k, A]) => [k, [A.nome, A.desc]])),
      st: [['Vida', Math.round(j.vidaMax)], ['Mana', Math.round(j.manaMax)], ['Defesa', Math.round(st.defesa || 0)], ['Dano físico', Math.round(st.danoFisico || 0)], ['Dano mágico', Math.round(st.danoMagico || 0)], ['Crítico', pc(st.critico) + '%']],
      bd: j.build || BUILD_PADRAO, hs: Object.entries(HABILIDADES).filter(([, H]) => H.tipo === 'Espada' || H.tipo === 'Magia').map(([k, H]) => [k, H.nome, H.tipo === 'Espada' ? 0 : 1, H.desc || '']),
      tit: p.tit?.uso || '', tits: (p.tit?.tem || []).filter((k) => TITULOS[k]).map((k) => [k, TITULOS[k].nome, `${TITULOS[k].como}${TITULOS[k].b ? ' · ' + b(TITULOS[k].b) : ''}`]) };
  },
  // a foto pequena da página: eu, o caminho que falta, e só quem está perto
  // ---------- pesca (etapa 6, André 2026-11-26): o mesmo 'pescar' do jogo. Lançar = no spot que ele vê (40 m, ou o mapa
  // todo com o Radar de pesca ligado). Longe: anda até a beira e lança ao chegar. Puxar/parar: msg 'pescar' direto.
  spotsLeve(j) {
    const radar = j.radarAte > this.tempo, r = [];
    for (const v of this.spots) { if (!v.ativo) continue; const d = Math.hypot(v.x - j.x, v.z - j.z); if (radar || d <= LEVE.spotVe) r.push([v, d]); }
    return r.sort((a, b) => a[1] - b[1]);
  },
  levePescar(id) {
    const j = this.jogadores.get(id); if (!j || !j.leve || j.criando || j.morto || j.pesca) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if (!liberado(j.prog, 'pesca')) return this.pescar(id, { acao: 'lancar' }); // o motivo do jogo
    if (contar(j.prog.mochila, 'vara') < 1) return aviso('Você precisa de uma vara de pescar (crie na mochila: Criar > Ferramentas)');
    const sp = this.spotsLeve(j)[0]?.[0];
    if (!sp) return aviso('Nenhum spot de pesca à vista. Use o Radar de pesca ou procure a água borbulhando');
    const q = pontoLancar(j, sp); if (q) { this.leveParar(id, null); return this.pescar(id, { acao: 'lancar', x: q.x, z: q.z }); }
    const b = beiraDoSpot(j, sp); if (!b) return aviso('Não achei beira para esse spot');
    this.leveIr(id, { x: b.x, z: b.z, nome: 'Spot de pesca' });
    if (j.leveRota) j.leveRota.spot = sp.id;
  },
  // ---------- fazenda, base e cama (etapa 6): o terreno/base do jogador numa grade; as ações são as do jogo (horta,
  // construir, desmontar, regador, dormir), com as mesmas regras (perto do terreno, vigor, ferramentas)
  fazendaLeve(j) {
    const L = this.loteDe(j); if (!L) return { sem: 1 };
    const A = this.areaBase?.(L), d = L.def, p = j.prog, agora = Date.now();
    const R = A ? [Math.min(d.x0, A.x0), Math.min(d.z0, A.z0), Math.max(d.x1, A.x1), Math.max(d.z1, A.z1)] : [d.x0, d.z0, d.x1, d.z1];
    const perto = distRet(d, j.x, j.z) <= LOTE.alcance + 0.5 || !!(A && distRet(A, j.x, j.z) <= LOTE.alcance + 0.5);
    const h = [];
    for (const [c, t0] of Object.entries(L.horta || {})) {
      const t = { ...t0 }; crescerPlanta(t, agora); const P = PLANTAS[t.c];
      h.push([c, t.c || '', P ? fasePlanta(t.g / P.G) : -1, t.w && agora < t.w + HORTA.rega * 3600000 ? 1 : 0]);
    }
    let cama = null, dc = Infinity;
    for (const o of L.pecas) if (o.k === 'cama') { const q = Math.hypot(o.x - j.x, o.z - j.z); if (q < dc) { dc = q; cama = o; } }
    const custo = (C) => Object.entries(C.custo || {}).map(([k, n]) => `${n} ${ITENS[k]?.nome || k}`).join(', ');
    const pode = (C) => Object.entries(C.custo || {}).every(([k, n]) => contar(p.mochila, k) >= n);
    const hr = horaDoJogo(p.dia, agora);
    return {
      ret: R.map(r1), lote: [d.x0, d.z0, d.x1, d.z1].map(r1), ...(A ? { base: [A.x0, A.z0, A.x1, A.z1].map(r1) } : {}),
      eu: [r1(j.x), r1(j.z)], perto: perto ? 1 : 0, h,
      pc: L.pecas.map((o) => [o.id, o.k, ...retPeca(o).map(r1), CONSTRUCOES[o.k]?.nome || o.k]),
      se: Object.keys(PLANTAS).map((s) => [s, PLANTAS[s].nome, contar(p.mochila, 'semente_' + s)]).filter((x) => x[2] > 0),
      en: contar(p.mochila, 'enxada'), rg: contar(p.mochila, 'regador'), ag: aguaRegador(p), aguaMax: HORTA.agua, poco: pertoDeAgua(j.x, j.z) ? 1 : 0,
      ...(cama ? { cama: [r1(cama.x), r1(cama.z), dc <= LOTE.estacaoDist + 0.6 && semParede(this.lotes.values(), j, cama) ? 1 : 0] } : {}),
      hora: `${String(Math.floor(hr)).padStart(2, '0')}:${String(Math.floor((hr % 1) * 6) * 10).padStart(2, '0')}`, noite: ehNoite(hr) ? 1 : 0,
      cons: Object.entries(CONSTRUCOES).map(([k, C]) => [k, C.nome, C.w, C.d, custo(C), pode(C) ? 1 : 0]),
    };
  },
  fotoLeve(j) {
    const R = j.leveRota;
    let falta = 0;
    if (R) { let q = j; for (let i = R.i; i < R.pontos.length; i++) { const a = R.pontos[i]; falta += Math.hypot(a.x - q.x, a.z - q.z); q = a; } }
    const v = j.veiculo ? this.velVeiculo(j) || HEROI.andar : MONTARIAS[j.montado] ? MONTARIAS[j.montado].correr : j.prog.pack ? HEROI.correr * PACK_REGRAS.costas.vel : HEROI.correr;
    const g = [];
    for (const o of this.jogadores.values()) {
      if (o === j || o.criando || o.caverna || Math.hypot(o.x - j.x, o.z - j.z) > LEVE.gente) continue;
      g.push([o.nome, r1(o.x), r1(o.z), this.racaDe(o) === 'Geada' ? 1 : 0, o.bot ? 1 : 0, o.prog?.nivel | 0, o.morto ? 1 : 0, o.id]); // [7] id: grupo, duelo, troca e amizade (etapa 5)
      if (g.length >= LEVE.max) break;
    }
    const m = [];
    for (const e of this.inimigos) {
      if (e.morto || Math.hypot(e.x - j.x, e.z - j.z) > LEVE.bichos) continue;
      m.push([r1(e.x), r1(e.z), e.nivel | 0, Math.round((e.vida / (e.vidaMax || 1)) * 100), e.id, e.nome || '']);
      if (m.length >= LEVE.max) break;
    }
    return {
      eu: [r1(j.x), r1(j.z), Math.round(j.vida), Math.round(j.vidaMax), Math.round(j.mana), Math.round(j.manaMax), j.morto ? 1 : 0, j.prog.ouro | 0, j.prog.nivel | 0, j.prog.pack ? 1 : 0, j.montado ? 1 : 0, Math.floor(Math.min(vigorAgora(j.prog.vigor), vigorMax(j.prog))), vigorMax(j.prog), Math.round((j.ry || 0) * 100) / 100], // vigor (André 2026-11-25: "adiciona a barra de vigor"): agora e máximo; montado: o lobo (botão Montar, a mesma mensagem e regra do jogo)
      ...(R ? { r: [Math.round(falta), Math.round(falta / (v || 1))] } : {}),
      g, m, hb: this.habLeve(j), c: this.coletaLeve(j), ...(j.coleta ? { co: [j.coleta.no, COLETA[this.coletaveis.get(j.coleta.no)?.tipo]?.nome || ''] } : {}),
      ...(j.pesca ? { pe: [j.pesca.st, j.pesca.st === 'briga' ? Math.round(j.pesca.prog * 100) : 0] } : {}), // pescando (etapa 6): o estado e a barra da briga
      ...((() => { const l = this.spotsLeve(j); return l.length ? { sp: Math.round(l[0][1]), ss: l.slice(0, 12).map(([v]) => [r1(v.x), r1(v.z)]) } : {}; })()), // metros até o spot de pesca à vista; ss: os spots no mapa (à vista ou com o Radar, como no jogo)
      ...((() => { const a = this.alvoLeve(j) || this.maisPerto(j); return a && a.id && m.some((o) => o[4] === a.id) ? { al: a.id } : {}; })()), // al: o monstro que o próximo golpe pega (André 2026-11-27: círculo vermelho nele)
      ...(this.emCombate(j) ? { lu: 1 } : {}), // em luta (bateu ou apanhou nos últimos ESTAMINA.combate s): o cartão de baixo vira "Em luta" (André 2026-11-26)
    };
  },
  // o que dá para coletar perto (veio, árvore, pedra e galho soltos): [no, nome, metros, profissão ('min', 'len' ou '' = mão)]
  coletaLeve(j) {
    const r = [];
    for (const no of this.coletaveis.values()) {
      const dx = no.x - j.x, dz = no.z - j.z; if (dx * dx + dz * dz > LEVE.coleta * LEVE.coleta) continue;
      if (no.y != null && Math.abs((j.y || 0) - no.y) > 2.5) continue; // veio de caverna
      const C = COLETA[no.tipo]; if (!C) continue;
      r.push([no.id, C.nome, Math.max(0, Math.round(Math.hypot(dx, dz) - no.r)), C.mao ? '' : C.prof || '']);
    }
    return r.sort((a, b) => a[2] - b[2]).slice(0, 4);
  },
  // os botões de luta do modo leve (André 2026-11-25): os mesmos do jogo, do modo da arma (Espada: golpe + 4 de espada;
  // Magia: disparo + 4 de magia) e a cura. [i da mensagem 'habilidade', nome, recarga que falta (s), mana]
  habLeve(j) {
    const mg = j.modo === 'Magia', l = [], um = (i, chave, h) => { if (h) l.push([i, h.nome, Math.max(0, Math.ceil((j.cds[chave] || 0) - this.tempo)), h.mana || 0]); };
    um(mg ? 10 : 0, mg ? 'magia' : 'basico', mg ? BASICO_MAGIA : BASICO);
    for (let k = 0; k < ESPACOS_ESPADA; k++) { const i = (mg ? ESPACOS_ESPADA : 0) + k + 1, c = j.build?.[i - 1]; if (c) um(i, c, HABILIDADES[c]); }
    um(9, 'cura', CURA);
    // poções (André 2026-11-26): [k, lugar da 1ª pilha na mochila (-1 = nenhuma), quantas ao todo, recarga s]; usa a msg 'item' do jogo
    const po = ['pocao', 'pocao_mana'].map((k) => {
      let i = -1, n = 0; (j.prog?.mochila || []).forEach((it, q) => { if (it?.k === k) { if (i < 0) i = q; n += it.n || 1; } });
      return [k, i, n, Math.max(0, Math.ceil((j.pocaoAte?.[k] || 0) - this.tempo))];
    });
    return { mg: mg ? 1 : 0, l, po };
  },
};

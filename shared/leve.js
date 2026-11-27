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
import { LUGARES, TITULOS, RECEITAS, CRIAR_OBRA, COLETA, COLETA_DISTANCIA, BASICO, BASICO_MAGIA, CURA, ESPACOS_ESPADA, tempoCriar, RECEITA_ESTACAO, CONSTRUCOES, ITENS, RARIDADES, TOTENS, LOJA, taxaTotem, HEROI, PACK_REGRAS, PACKS, VEICULOS, GUERRA, MONTARIAS, CACA, TUNEIS_MUNDO, ESTAMINA } from './dados.js';
import { nomeItem, precoVenda, mercador, bonusTitulo, contar, vigorAgora, vigorMax, ATRIBUTOS, xpProximo } from './progresso.js';
import { precoPack, mercadoK, custoPack, capacidadeCarrinho, acharPonto, fundoAgua } from './transporte.js';
import { liberado, missaoAtual } from './historia.js';
import { noLago, relevo, AGUA } from './relevo.js';
import { ESTRADAS_MUNDO } from './mundo.js';
import { VILAS_MUNDO } from './dados.js';
import { aguaRegador, pertoDeAgua, distRet, crescerPlanta, retPeca, semParede } from './simulacao.js'; // fazenda e cama (etapa 6); só usadas na hora, depois que tudo carregou
import { PESCA, PLANTAS, HORTA, LOTE, fasePlanta } from './dados.js';
import { horaDoJogo, ehNoite, HABS, BARRAS, cabeNaBarra, ANDAR_ATIRANDO, calcularStatus, reforcoK, reforcoMax, durab, custoConserto, pecasGastas, comDesconto, consertoGratis } from './progresso.js';
import { npcApareceu } from './historia.js';
import { CATALISADOR } from './dados.js';
import { MORTE } from './dados.js';

export const LEVE = {
  envio: 0.5, // s entre as fotos para a página
  envioJoy: 0.25, // s entre as fotos com o joystick na mão (André 2026-11-27: "movimentação travada")
  fxR: 40, // m: efeitos da luta perto do herói que vão para a página (fxLeve)
  chega: 1.3, // m do destino: chegou
  meio: 2.5, // m de um ponto do caminho: passa para o próximo
  olhar: 2, // s entre as conferidas de "preso"
  preso: 0.8, // m: andou menos que isso em LEVE.olhar s = preso
  desiste: 4, // conferidas presas seguidas: para e avisa
  desvio: 0.6, // s de passo de lado a cada conferida presa (o dobro na segunda, ...)
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
  joySolto: 0.7, // s sem notícia do joystick: para
  cena: 40, // m: meia largura do mundo de perto (cenaLeve): chão, estradas, árvores, pedras, casas e veios
  cenaPasso: 2, // m por quadradinho do chão da cena
  montaDe: 25, // m de caminho: daqui pra cima o "Ir para" sobe no lobo sozinho (como no jogo)
};
// quem a página mostra como lugar no mapa (as janelas do jogo de cada um)
const FUNCOES = new Set(['loja', 'leilao', 'pack', 'ferreiro', 'habilidades', 'alquimia']);
const ACOES_NPC = new Set(['comprar', 'vender', 'consertar', 'habilidades', 'missao', 'cura', 'resetar', 'passe', 'pack', 'alquimia', 'leilao', 'guilda', 'recrutar']);
// Mirela (conversa.gd _lista_alquimia): cada catalisador que ela faz [k, nome, de (k), nome de, quantos, ouro, raridade]
function sintesesLeve() {
  const S = CATALISADOR.sintese, r = [];
  for (const t of ['armadura', 'arma']) CATALISADOR[t].forEach((k, i) => { const C = S.custo[i + 1]; if (i >= 1 && i + 1 <= S.ate && C && ITENS[k]) { const de = CATALISADOR[t][i - 1]; r.push([k, ITENS[k].nome, de, ITENS[de]?.nome || de, C.n, C.ouro, i + 1]); } });
  return r;
}
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

// comparar peças como a janela do medalhão do jogo (menu.gd st_item/diferenca/nota/veredito): os números da peça com o
// reforço, a diferença para a vestida e a nota pelos pesos do jogo (PESO_ST)
const PESO_ST = { vida: 1 / 20, mana: 1 / 20, defesa: 1 / 5, danoFisico: 1 / 5, danoMagico: 1 / 5, critico: 1 / 0.01, danoCritico: 1 / 5, danoK: 1 / 0.05, areaK: 1 / 0.05, regenManaK: 1 / 0.05 };
function stPeca(o) {
  const I = o && ITENS[o.k], r = {}; if (!I?.st || o.r == null) return r;
  const rk = reforcoK(o); for (const [c, v] of Object.entries(I.st)) r[c] = (v[o.r] ?? 0) * (c === 'critico' || c === 'danoCritico' ? rk.critico : rk.st);
  return r;
}
// [veredito, nota, o que muda] veredito: m melhor, p pior, x melhor em parte, '' igual
function compararPeca(novo, atual) {
  const a = stPeca(atual), n = stPeca(novo), d = {};
  for (const c of new Set([...Object.keys(n), ...Object.keys(a)])) { const v = (n[c] || 0) - (a[c] || 0); if (Math.abs(v) > 1e-5) d[c] = v; }
  const vs = Object.values(d), ganha = vs.some((v) => v > 0), perde = vs.some((v) => v < 0);
  const nota = Object.entries(d).reduce((t, [c, v]) => t + v * (PESO_ST[c] ?? 1), 0);
  const txt = Object.entries(d).map(([c, v]) => `${v > 0 ? '+' : '−'}${Math.round(Math.abs(v) * (c.endsWith('K') || c === 'critico' ? 100 : 1) * 10) / 10} ${NOME_ST[c] || c}`).join(' · ');
  return [ganha && !perde ? 'm' : perde && !ganha ? 'p' : ganha ? 'x' : '', Math.round(nota * 100) / 100, txt];
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
  // joystick (André 2026-11-27: "um joystick virtual no canto esquerdo pra mover o personagem"): a mesma entrada do jogo
  // (mx, mz até 1; empurrado até o fim corre). A página repete a cada ~0,2 s enquanto segura; sem notícia por
  // LEVE.joySolto s, o herói para (dedo caiu, internet travou). Mexer no joystick cancela o caminho automático.
  leveMover(id, m) {
    const j = this.jogadores.get(id); if (!j || !j.leve || j.criando) return;
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    let mx = num(m?.mx), mz = num(m?.mz); const f = Math.hypot(mx, mz);
    if (f < 0.15 || j.morto) { const tinha = !!j.leveJoy; j.leveJoy = null; if (tinha) j.entrada = { mx: 0, mz: 0, correr: false }; return; }
    if (f > 1) { mx /= f; mz /= f; }
    if (j.leveRota) this.leveParar(id, null);
    if (j.coleta) this.pararColeta(j, null);
    if (j.pesca) this.pararPesca(j, null);
    if (j.vila) this.cancelarVila(j, null);
    j.leveJoy = { mx, mz, correr: f > 0.6, t: this.tempo };
  },
  // Trocar alvo (o botão do jogo, 2026-11-23): escolhe o monstro que os golpes pegam, sem andar nem parar o golpe
  leveMirar(id, alvo) {
    const j = this.jogadores.get(id); if (!j || !j.leve) return;
    const e = typeof alvo === 'string' ? this.inimigos.find((o) => o.id === alvo && !o.morto && Math.hypot(o.x - j.x, o.z - j.z) <= 22) : null;
    j.leveMira = e ? e.id : null;
  },
  // Disparada (o botão do jogo, main.gd ligar_disparada): liga a corrida; sem fôlego ou com pack nas costas não liga
  leveDisparada(id, on) {
    const j = this.jogadores.get(id); if (!j || !j.leve) return;
    if (on && !j.montado && j.semFolego) return this.evento({ t: 'aviso', para: id, texto: 'Sem fôlego!' });
    if (on && !j.montado && j.prog.pack) return this.evento({ t: 'aviso', para: id, texto: 'Com pack nas costas não dá pra correr' });
    j.leveDisp = !!on;
  },
  // golpe do leve (habLeve): a mesma msg 'habQ' do jogo, mirando no monstro escolhido (Atacar ou o círculo vermelho, como o
  // botão Trocar alvo do jogo) e, nas de direção (Salto Arcano), para onde o joystick ou a frente apontam
  leveHab(id, k) {
    const j = this.jogadores.get(id); if (!j || !j.leve || !HABS[k]) return;
    this.leveParar(id, null);
    const e = this.alvoLeve(j) || this.maisPerto(j, 30), d = j.leveJoy ? [j.leveJoy.mx, j.leveJoy.mz] : [Math.sin(j.ry || 0), Math.cos(j.ry || 0)];
    const seq = j.acaoSeq;
    this.usarHabQ(id, { id: k, dx: d[0], dz: d[1], ...(e && Number.isInteger(e.v) ? { v: e.v, b: true } : {}) });
    if (HABS[k].tipo === 'basicoMagia' && j.acao && j.acaoSeq !== seq) j.acao.livre = true; // o tiro do cajado anda junto (passoLeve)
  },
  leveParar(id, texto = 'Parou') {
    const j = this.jogadores.get(id); if (!j) return;
    const tinha = !!j.leveRota;
    j.leveRota = null; j.entrada = { mx: 0, mz: 0, correr: false };
    if (tinha) this.evento({ t: 'leveRota', para: id, pontos: [], ...(texto ? { texto } : {}) });
  },
  // um passo do herói do modo leve (antes do passoJogador): vira o "joystick" que leva ao próximo ponto do caminho
  // na água (André 2026-11-27: "dá pra andar de montaria na água super rápido; encostou na água já desmonta e começa a
  // nadar"): encostou na água (mais de 0,2 m no corpo), desce do lobo; anda devagar como o na_agua do jogo (andar.gd) e,
  // boiando, na braçada (AGUA.nado, mais lento sem fôlego). Só no leve: o jogo 3D é do irmão do André
  passoLeve(j, dt) {
    this.passoLeve0(j, dt);
    // tiro do cajado andando (varredura das skills, André 2026-11-27: "não consigo usar o ataque básico e andar ao mesmo
    // tempo"): no jogo o tiro básico do cajado é livre (main.gd acao.livre) e o herói anda a ANDAR_ATIRANDO; o passoJogador
    // para tudo enquanto trava, então o leve dá esse passo aqui, sem virar (ele segue olhando o alvo)
    if (j.trava > 0 && j.acao?.livre && j.leveJoy && !j.morto && !j.canal && !j.arrancada) {
      const e = j.entrada, v = (e.correr ? HEROI.correr : HEROI.andar) * ANDAR_ATIRANDO;
      if (Math.hypot(e.mx, e.mz) > 0.15) this.mover(j, e.mx * v * dt, e.mz * v * dt);
    }
    if (j.veiculo || j.morto || !noLago(j.x, j.z)) return;
    const a = AGUA.nivel - this.terreno.altura(j.x, j.z, j.y); if (!(a > 0.2)) return;
    if (j.montado) { j.montado = null; this.evento({ t: 'aviso', para: j.id, texto: 'Você desceu do lobo na água' }); }
    const e = j.entrada; if (!e || e === j._entAgua || Math.hypot(e.mx, e.mz) < 0.15) return; // já ajustada neste passo
    const base = e.correr ? HEROI.correr : HEROI.andar, boia = a >= AGUA.peito - 0.12;
    const k = boia ? Math.min(1, (AGUA.nado * (j.semFolego ? ESTAMINA.nadoCansado : 1)) / base) : AGUA.raso + (AGUA.lento - AGUA.raso) * Math.min(1, Math.max(0, (a - 0.2) / 0.8));
    j.entrada = j._entAgua = { mx: e.mx * k, mz: e.mz * k, correr: e.correr && !boia };
  },
  passoLeve0(j, dt) {
    if (j.leveJoy) { // joystick: anda na direção do dedo até soltar
      const J = j.leveJoy;
      if (j.morto || this.tempo - J.t > LEVE.joySolto) { j.leveJoy = null; j.entrada = { mx: 0, mz: 0, correr: false }; return; }
      // a velocidade do joystick do jogo (andar.gd vel_joystick): até a metade anda (55% a 100% do andar), daí até o fim
      // vai ao trote (sem gastar estamina); correr de verdade só com a Disparada ligada (gasta estamina, como no jogo).
      // Montado, no carrinho ou no barco quem decide a velocidade é a montaria/veículo (passoJogador)
      const f = Math.hypot(J.mx, J.mz) || 1, dx = J.mx / f, dz = J.mz / f;
      if (j.montado || j.veiculo) { j.entrada = { mx: dx, mz: dz, correr: !j.veiculo }; return; }
      const disp = !!j.leveDisp && !j.semFolego && !j.prog.pack && f >= 0.3;
      const ss = (t) => t * t * (3 - 2 * t), trote = HEROI.correr * ESTAMINA.trote;
      const v = disp ? HEROI.correr : f < 0.5 ? HEROI.andar * (0.55 + 0.45 * (f - 0.15) / 0.35) : HEROI.andar + (trote - HEROI.andar) * ss(Math.min(1, Math.max(0, (f - 0.5) / 0.4)));
      const corre = v > HEROI.andar * 1.2, base = corre ? HEROI.correr : HEROI.andar;
      j.entrada = { mx: dx * (v / base), mz: dz * (v / base), correr: corre };
      if (disp && !j.morto && !(j.trava > 0)) this.correndo(j, dt); // a Disparada gasta estamina como a corrida do jogo
      if (j.leveDisp && (j.semFolego || j.prog.pack)) { j.leveDisp = false; this.evento({ t: 'aviso', para: j.id, texto: j.prog.pack ? 'Com pack nas costas não dá pra correr' : 'Sem fôlego!' }); }
      return;
    }
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
    j.entrada = { mx: dx / d, mz: dz / d, correr: !j.semFolego && !j.veiculo };
    // preso de frente (balcão, árvore, pedra no meio da estrada): uns passos de lado, como o jogador faz no joystick
    if (R.desvio > this.tempo) { const k = R.lado || 1; j.entrada = { mx: (dx / d) * 0.35 - k * (dz / d), mz: (dz / d) * 0.35 + k * (dx / d), correr: j.entrada.correr }; } // com pack: a corrida vira x0,5 (PACK_REGRAS.costas), como no jogo (2,7 m/s)
    R.t += dt;
    if (R.t >= LEVE.olhar) { // preso (pedra, árvore, gente na frente)?
      const andou = Math.hypot(j.x - R.ux, j.z - R.uz);
      R.t = 0; R.ux = j.x; R.uz = j.z;
      if (andou >= LEVE.preso) { R.presas = 0; return; }
      const fim = P[ult];
      if (Math.hypot(fim.x - j.x, fim.z - j.z) < LEVE.quase) return this.leveChegou(j);
      if (++R.presas >= LEVE.desiste) return this.leveParar(j.id, 'Caminho bloqueado: toque em outro lugar');
      if (R.i < ult) R.i++; // tenta o ponto seguinte (contorna)
      R.lado = R.presas % 2 ? 1 : -1; R.desvio = this.tempo + LEVE.desvio * R.presas; // um lado, depois o outro, cada vez mais
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
    // todos os NPCs, como no jogo (André 2026-11-27: "quero tudo idêntico"): id e as ações da janela dele (conversa.gd
    // ACOES). Os que antes não tinham janela no leve (dica, cura, missão, passe, instrutor, recrutador, guilda) vêm com
    // x: 1 (o mapa não desenha o quadradinho deles, para não encher). Quem só aparece depois de uma missão segue a regra do falar
    const ve = (n) => (!n.depois || npcApareceu(p, n.depois)) && (!n.ate || !npcApareceu(p, n.ate));
    const npcs = (this.mapa.npcs || []).filter(ve)
      .map((n) => ({ n: n.nome, id: n.id, a: (n.acoes || []).filter((a) => ACOES_NPC.has(a)), f: FUNCOES.has(n.funcao) ? n.funcao : (n.acoes || []).includes('vender') ? 'compra' : n.funcao || 'dica', ...(FUNCOES.has(n.funcao) || (n.acoes || []).includes('vender') ? {} : { x0: 1 }), x: r1(n.x), z: r1(n.z), ...((n.acoes || []).includes('vender') ? { v: 1 } : {}),
        ...(n.funcao === 'passe' && this.dungeon?.def?.passe ? { ps: Object.entries(this.dungeon.def.passe).map(([k, q]) => [k, ITENS[k]?.nome || k, q]) } : {}), // Gaspar: o material do passe (tem/precisa na página)
        ...(n.id === CATALISADOR.sintese.npc ? { al: sintesesLeve() } : {}), // Mirela: o que ela sintetiza
        // mercador de pack (PR 2 do modo leve): o id, o pack que ele faz e o material (a página mostra tenho/preciso)
        ...(n.funcao === 'pack' && PACKS[n.merch] ? { id: n.id, pk: PACKS[n.merch].nome, custo: Object.entries(custoPack(n.merch, p.prof?.mer)).map(([k, q]) => [k, ITENS[k]?.nome || k, q]) } : {}) }));
    const totens = TOTENS.lista.map((t) => ({ id: t.id, n: t.nome, x: r1(t.x), z: r1(t.z), d: dsc.has(t.id) ? 1 : 0, taxa: taxaTotem(t) }));
    const loja = LOJA.map((o, i) => ({ i, k: o.k, n: ITENS[o.k]?.nome || o.k, preco: this.precoCompra(j, o) }));
    const baus = [];
    const L = this.loteDe?.(j);
    if (L) for (const o of L.pecas || []) if (o.k === 'bau' || o.k === 'bau_cla') baus.push({ cla: o.k === 'bau_cla' ? 1 : 0, x: r1(o.x), z: r1(o.z), ...(o.k === 'bau' ? { p: o.id, ...(L.baus?.[o.id]?.nome ? { nome: L.baus[o.id].nome } : {}) } : {}) });
    const bb = this.bauBase?.(this.baseDe?.(j)); if (bb) baus.push({ cla: 1, x: r1(bb.x), z: r1(bb.z) });
    // no mapa, como o minimapa do jogo (minimapa.gd, André 2026-11-26: "todos os recursos, spots aparecendo no próprio mapa"):
    // as clareiras de caça [x, z, nível, bicho, boss] e as zonas de mineração [x, z, tipo]
    const cc = CACA.filter((c) => !c.tunel && Number.isFinite(c.x)).map((c) => [r1(c.x), r1(c.z), c.nivel | 0, c.bicho || '', c.boss ? 1 : 0]);
    const mn = (this.mapa.mina || []).map((o) => [r1(o.x), r1(o.z), o.tipo || '']);
    const hq = Object.fromEntries(Object.entries(HABS).map(([k, H]) => [k, [H.nome, H.icone || (H.arvore === 'cajado' ? 'magia' : 'basico')]])); // nome e ícone das skills do jogo (habLeve)
    return { npcs, totens, loja, baus, lug: this.leveLugares(j), cc, mn, hq };
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
  // efeitos da luta para o leve (André 2026-11-27: "mostrar as skills acertando os bichos... não precisa ser bonito"):
  // os mesmos eventos que o jogo 3D desenha, num formato curto, só os perto do herói (LEVE.fxR m).
  // ['d', x, z, dano, crit (1), em mim (1)] · ['c', x, z, cura] · ['a', x, z, raio, tipo] (área: explosão, meteoro, anel,
  // vórtice) · ['i', x, z] (impacto, raio) · ['p', x, z, vx, vz, s, cor, id] (projétil: velocidade m/s e vida s) ·
  // ['x', x, z, id, explosão] (fim do projétil) · ['e', x, z] (esquiva)
  fxLeve(j, e) {
    const pos = (id) => this.jogadores.get(id) || this.inimigos.find((o) => o.id === id), r1 = (v) => Math.round(v * 10) / 10;
    let f = null;
    if (e.t === 'dano' || e.t === 'cura') { const o = pos(e.alvo); if (o && !(e.n === 0 && !e.escudo)) f = e.t === 'dano' ? ['d', r1(o.x), r1(o.z), e.n | 0, e.crit ? 1 : 0, o === j ? 1 : 0] : ['c', r1(o.x), r1(o.z), e.n | 0]; }
    else if (e.t === 'explosao' || e.t === 'anel' || e.t === 'vortice' || e.t === 'meteoro') f = ['a', r1(e.x), r1(e.z), r1(e.r || 2), e.t === 'meteoro' ? 'meteoro' : e.t === 'explosao' ? (e.fx || 'explosao') : e.t];
    else if (e.t === 'impacto' || e.t === 'raio') f = ['i', r1(e.x), r1(e.z)];
    else if (e.t === 'proj') { const v = e.vel || 16, n = Math.hypot(e.dx, e.dz) || 1; f = ['p', r1(e.x), r1(e.z), r1((e.dx / n) * v), r1((e.dz / n) * v), r1(e.vida || 2.2), e.cor ?? 0xffaa44, e.id]; }
    else if (e.t === 'projFim') f = ['x', r1(e.x), r1(e.z), e.id, r1(e.explosao || 0)]; // fim do projétil e.id (a página para a bolinha ali)
    else if (e.t === 'esquiva') { const o = pos(e.id); if (o) f = ['e', r1(o.x), r1(o.z)]; }
    // efeitos simples de cada skill (André 2026-11-27: "qd usar raio sair um raio... efeito a todas as skills, sem exagero")
    else if (e.t === 'cadeia') f = ['r', r1(e.x), r1(e.z), r1(e.x0), r1(e.z0)]; // Raio em Cadeia: o risco de um bicho ao outro
    else if (e.t === 'teleporte') f = ['t', r1(e.x), r1(e.z), r1(e.x0), r1(e.z0)]; // Salto Arcano: some num ponto, aparece no outro
    else if (e.t === 'escudo') { const o = pos(e.id); if (o) f = ['a', r1(o.x), r1(o.z), 1.3, 'escudo']; } // Escudo Arcano: bolha azul
    return f && Math.hypot(f[1] - j.x, f[2] - j.z) <= LEVE.fxR ? f : null;
  },
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
    if (e.t === 'fala') return { t: 'fala', npc: (this.mapa.npcs || []).find((n) => n.id === e.npc)?.nome?.split(',')[0] || '', id: e.npc, texto: e.texto, ...(e.abrir ? { abrir: e.abrir } : {}), ...(e.custo != null ? { custo: e.custo } : {}) }; // o que o NPC disse; abrir/custo: o instrutor pergunta se reseta
    // troca (etapa 5): os itens com nome e cor (a página não tem a tabela de itens)
    if (e.t === 'troca' && e.fase === 'estado') { const of = (o) => ({ ouro: o.ouro, tranca: o.tranca ? 1 : 0, ok: o.ok ? 1 : 0, itens: o.itens.map((x) => ({ ...(x.i != null ? { i: x.i } : {}), n: x.n, k: x.it?.k, nome: x.it ? nomeItem(x.it) : '?', c: x.it ? corDe(x.it) : null })) }); return { t: 'troca', fase: 'estado', com: e.com, nome: e.nome, eu: of(e.eu), ele: of(e.ele) }; }
    if (e.t === 'pvp' && e.fase === 'info') { const { loja, ...r } = e; return r; } // a loja de Insígnias fica no jogo
    if (e.t === 'bau') return { t: 'bau', cla: e.cla ? 1 : 0, l: (e.itens || []).length, it: listaLeve(e.itens), ...(e.p ? { p: e.p, nome: e.nome || '' } : {}) }; // p/nome: cada baú tem o seu estoque (2026-11-27)
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
      // carrinho (André 2026-11-27: "tocar no carrinho na bag e abrir pra sumonar ou desmontar"): o mesmo botão do jogo
      // (menu.gd): "Colocar no chão" ou, no mundo, "Guardar carrinho"; navio só "Guardar navio" quando está na água. [10] = rótulo
      const vb = o.k === 'carrinho' ? (this.carrinhoFora(j) ? 'Guardar carrinho' : 'Colocar no chão') : o.k === 'navio' && this.navioFora(j) ? 'Guardar navio' : '';
      const I = ITENS[o.k], tipo = I.lugar ? 'e' : (I.usar && !I.usar.veiculo) || o.k === 'tomo' || vb ? 'u' : '';
      r.push([i, o.k, o.n || 1, nomeItem(o), corDe(o), precoVenda(o, merc), o.cad ? 1 : 0, tipo, I.lugar || '', textoPeca(o), vb || '', ...(tipo === 'e' ? [compararPeca(o, p.equip?.[I.lugar])] : [])]); // [11] peça: comparada com a vestida (como a janela do medalhão)
    });
    const eq = LUGARES.filter((l) => p.equip?.[l] && ITENS[p.equip[l].k]).map((l) => { const o = p.equip[l]; return [l, o.k, nomeItem(o), corDe(o), textoPeca(o), durab(o), MORTE.durMax, o.e | 0, reforcoMax(o), custoConserto(o)]; }); // [5..9] durabilidade, máx, reforço, reforço máx, conserto
    // conserto (Tomás e os ferreiros, a janela do conserto do jogo): as peças gastas, no corpo (l) ou na mochila (i), com o
    // preço de cada uma; cs.t = tudo junto (com o desconto da Guilda, como o servidor cobra)
    const dc = this.vantagensDe?.(j)?.conserto || 0, gr = consertoGratis(p);
    const cs = pecasGastas(p).map((x) => { const o = x.onde === 'equip' ? p.equip[x.l] : p.mochila[x.i]; return [x.onde === 'equip' ? 'l' : 'i', x.onde === 'equip' ? x.l : x.i, nomeItem(o), durab(o), gr ? 0 : comDesconto(x.custo, dc)]; });
    return { l: (p.mochila || []).length, it: r, eq, cs, ...(cs.length ? { ct: gr ? 0 : comDesconto(pecasGastas(p).reduce((t, x) => t + x.custo, 0), dc) } : {}) };
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
  // Personagem (etapa 4, André 2026-11-26): status, atributos (+ e Confirmar = msg 'atributos'), golpes (as barras do
  // jogo = msg 'barra') e títulos (msg 'item' titulo). Tudo o servidor confere, como no menu do jogo.
  personagemLeve(j) {
    const p = j.prog, st = j.st || {}, pc = (v) => Math.round((v || 0) * 1000) / 10;
    const b = (o) => Object.entries(o || {}).map(([k, v]) => `+${pc(v)}% ${({ dano: 'dano', vida: 'vida', critico: 'crítico', defesa: 'defesa', xp: 'XP', venda: 'venda' })[k] || k}`).join(' · ');
    return { nv: p.nivel | 0, xp: Math.floor(p.xp || 0), xpM: xpProximo(p.nivel), pts: p.pontos | 0, atr: p.atr,
      an: Object.fromEntries(Object.entries(ATRIBUTOS).map(([k, A]) => [k, [A.nome, A.desc]])),
      st: [['Vida', Math.round(j.vidaMax)], ['Mana', Math.round(j.manaMax)], ['Defesa', Math.round(st.defesa || 0)], ['Dano físico', Math.round(st.danoFisico || 0)], ['Dano mágico', Math.round(st.danoMagico || 0)], ['Crítico', pc(st.critico) + '%']],
      // Herói (André 2026-11-27: "tudo igual ao modo 3D"): as mesmas linhas da aba Status do jogo (menu.gd montar_status)
      he: [['Vida', `${Math.ceil(j.vida)} / ${Math.round(j.vidaMax)}`], ['Mana', `${Math.floor(j.mana)} / ${Math.round(j.manaMax)}`],
        ['Defesa', `${Math.round(st.defesa || 0)} (-${Math.round((st.reducao || 0) * 100)}% de dano)`], ['Crítico', `${pc(st.critico)}%`],
        ['Dano crítico', `+${Math.round(st.danoCritico || 0)}`], ['Dano físico', `${pc((st.danoFisico || 0) / 100)}`], ['Dano mágico', `${pc((st.danoMagico || 0) / 100)}`],
        ['Recarga', `-${Math.round((st.recarga || 0) * 100)}%`], ['Regeneração', `${pc((st.regenVida || 0) / 100)} vida/s · ${pc((st.regenMana || 0) / 100)} mana/s (fora de luta)`],
        ['Estamina', `${Math.floor(j.sta ?? 0)} / ${Math.round(j.staMax ?? st.estaminaMax ?? 0)}`], ['Vigor', `${Math.floor(Math.min(vigorAgora(p.vigor), vigorMax(p)))} / ${vigorMax(p)}`], ['Ouro', String(p.ouro | 0)]],
      // +1 ponto em cada atributo: quanto muda (a página mostra "→ novo" em verde enquanto não confirma, como o jogo)
      dp: Object.fromEntries(Object.keys(ATRIBUTOS).map((k) => { const s2 = calcularStatus({ ...p, atr: { ...p.atr, [k]: (p.atr?.[k] | 0) + 1 } }, j.pas); return [k, { Vida: s2.vidaMax - st.vidaMax, Mana: s2.manaMax - st.manaMax, Defesa: s2.defesa - st.defesa, 'Crítico': s2.critico - st.critico, 'Dano físico': s2.danoFisico - st.danoFisico, 'Dano mágico': s2.danoMagico - st.danoMagico, Recarga: s2.recarga - st.recarga }]; })),
      ba0: { Vida: st.vidaMax, Mana: st.manaMax, Defesa: st.defesa, 'Crítico': st.critico, 'Dano físico': st.danoFisico, 'Dano mágico': st.danoMagico, Recarga: st.recarga },
      // golpes = as barras do jogo (André 2026-11-27: "igual ao jogo"): prog.barras e msg 'barra' {barra, lista}, como a aba Habilidades do jogo
      ba: Object.fromEntries(BARRAS.map((b) => [b, [...(p.barras?.[b] || [])]])),
      hs: Object.entries(HABS).filter(([k]) => BARRAS.some((b) => cabeNaBarra(k, b))).map(([k, H]) => [k, H.nome, H.arvore, H.desc || '', H.libera || 1, p.habs?.[k]?.nv || 1]),
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
  // o mundo de perto (André 2026-11-27: "um 2D bem próximo... como se eu estivesse dentro do jogo"): o chão em volta do
  // herói (grama, areia, pedra, água e a luz das encostas), as estradas na largura de verdade, árvores, pedras, casas,
  // paredes das bases, peças dos terrenos e veios. Vai só quando muda (server/index.js); a página desenha em escala.
  cenaLeve(j) {
    const R = LEVE.cena, P = LEVE.cenaPasso, cx = Math.round(j.x / 8) * 8, cz = Math.round(j.z / 8) * 8, x0 = cx - R, z0 = cz - R, n = (2 * R) / P;
    const dentro = (x, z, m = 0) => x > x0 - m && x < x0 + 2 * R + m && z > z0 - m && z < z0 + 2 * R + m;
    // chão: t = tipo por quadradinho (g grama, a areia, r pedra, w água rasa, W funda), l = luz da encosta (0 a 9)
    const N = n + 2, h = new Float32Array(N * N), ag = new Array(N * N);
    for (let b = 0; b < N; b++) for (let a = 0; a < N; a++) { const x = x0 + (a - 0.5) * P, z = z0 + (b - 0.5) * P, L = noLago(x, z); ag[b * N + a] = L; h[b * N + a] = L ? 0 : relevo(x, z); }
    let t = '', l = '';
    for (let b = 1; b <= n; b++) for (let a = 1; a <= n; a++) {
      const k = b * N + a, L = ag[k];
      if (L) { t += L.fundo > 1 ? 'W' : 'w'; l += '5'; continue; }
      const gx = (h[k + 1] - h[k - 1]) / (2 * P), gz = (h[k + N] - h[k - N]) / (2 * P), incl = Math.hypot(gx, gz);
      const beira = ag[k + 1] || ag[k - 1] || ag[k + N] || ag[k - N];
      t += incl > 0.75 ? 'r' : beira && (beira.lago?.mar || beira.mar) && h[k] < 1.5 ? 'a' : 'g';
      l += String(Math.max(0, Math.min(9, Math.round((0.95 - (gx + gz) * 0.4 - 0.68) / 0.52 * 9))));
    }
    // estradas: [largura, pedra (1) ou terra (0), x, z, x, z...] só o pedaço que passa aqui
    const e = [], linha = (pts, lg, pedra) => {
      let cur = null;
      for (let k = 0; k < pts.length; k++) {
        const [x, z] = pts[k], perto = dentro(x, z, 12) || (k > 0 && dentro((x + pts[k - 1][0]) / 2, (z + pts[k - 1][1]) / 2, 12));
        if (perto) { if (!cur) { cur = [lg, pedra]; if (k > 0) cur.push(r1(pts[k - 1][0]), r1(pts[k - 1][1])); e.push(cur); } cur.push(r1(x), r1(z)); }
        else if (cur) { cur.push(r1(x), r1(z)); cur = null; }
      }
    };
    for (const c of this.mapa.vila?.caminhos || []) linha(c.pontos, c.largura || 2.2, 0);
    for (const E of ESTRADAS_MUNDO) if (E.curva) linha(E.curva, String(E.id).startsWith('t_') ? 2.2 : 4, 0);
    for (const V of VILAS_MUNDO || []) if (V.cidade) for (const r of V.ruas || []) linha(r, 3, 1);
    const pr = this.mapa.vila?.praca;
    // árvores [x, z, tamanho], veios [x, z, raio, tipo, vazio], soltos [x, z, tipo]
    const ar = [], ve = [], so = [];
    for (const o of this.coletaveis.values()) {
      if (!dentro(o.x, o.z, 3)) continue;
      if (o.tipo === 'arvore') ar.push([r1(o.x), r1(o.z), r1(o.r / 0.32)]);
      else if (o.solto) so.push([r1(o.x), r1(o.z), o.tipo]);
      else ve.push([r1(o.x), r1(o.z), r1(o.r), o.tipo, this.veioVazio?.(o.id, j) ? 1 : 0]);
    }
    // pedras, ruínas e troncos (círculos sólidos) e casas, paredes e peças (retângulos girados [x, z, cos, sen, meia larg., meia fundura, tipo])
    const pe = [], ca = [], r2 = (v) => Math.round(v * 100) / 100;
    for (const o of [...this.mapa.obstaculos, ...this.obstaculosRocha, ...(this.mapa.cenario?.solidos || [])]) if (dentro(o.x, o.z, 3) && !o.gente) pe.push([r1(o.x), r1(o.z), r1(o.r)]);
    for (const c of this.casas) if (dentro(c.x, c.z, 8)) ca.push([r1(c.x), r1(c.z), r2(c.cos), r2(c.sin), r1(c.hw - 0.35), r1(c.hd - 0.35), 0]);
    for (const o of this.solidosBase || []) if (dentro(o.x, o.z, 6)) ca.push([r1(o.x), r1(o.z), r2(o.cos), r2(o.sen), r1(o.hw), r1(o.hd), 1]);
    for (const L of this.lotes.values()) for (const o of L.pecas) if (dentro(o.x, o.z, 4)) { const [a, b, c, d] = retPeca(o); ca.push([r1((a + c) / 2), r1((b + d) / 2), 1, 0, r1((c - a) / 2), r1((d - b) / 2), 2]); }
    return { x0, z0, p: P, n, t, l, e, ...(pr && dentro(pr.x, pr.z, pr.r) ? { pr: [pr.x, pr.z, pr.r] } : {}), ar, ve, so, pe, ca };
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
      m.push([r1(e.x), r1(e.z), e.nivel | 0, Math.round((e.vida / (e.vidaMax || 1)) * 100), e.id, e.nome || '', e.parado > this.tempo ? (e.ef === 'congelado' ? 'g' : 'a') : e.lento?.ate > this.tempo ? 'l' : 0]); // [6] g congelado (branco), a atordoado, l lento
      if (m.length >= LEVE.max) break;
    }
    return {
      eu: [r1(j.x), r1(j.z), Math.round(j.vida), Math.round(j.vidaMax), Math.round(j.mana), Math.round(j.manaMax), j.morto ? 1 : 0, j.prog.ouro | 0, j.prog.nivel | 0, j.prog.pack ? 1 : 0, j.montado ? 1 : 0, Math.floor(Math.min(vigorAgora(j.prog.vigor), vigorMax(j.prog))), vigorMax(j.prog), Math.round((j.ry || 0) * 100) / 100], // vigor (André 2026-11-25: "adiciona a barra de vigor"): agora e máximo; montado: o lobo (botão Montar, a mesma mensagem e regra do jogo)
      ...(R ? { r: [Math.round(falta), Math.round(falta / (v || 1))] } : {}),
      g, m, hb: this.habLeve(j), c: this.coletaLeve(j), ...(j.coleta ? { co: [j.coleta.no, COLETA[this.coletaveis.get(j.coleta.no)?.tipo]?.nome || ''] } : {}),
      ...(j.pesca ? { pe: [j.pesca.st, j.pesca.st === 'briga' ? Math.round(j.pesca.prog * 100) : 0] } : {}), // pescando (etapa 6): o estado e a barra da briga
      ...((() => { const l = this.spotsLeve(j); return l.length ? { sp: Math.round(l[0][1]), ss: l.slice(0, 12).map(([v]) => [r1(v.x), r1(v.z)]) } : {}; })()), // metros até o spot de pesca à vista; ss: os spots no mapa (à vista ou com o Radar, como no jogo)
      ...((() => { const a = this.alvoLeve(j) || this.maisPerto(j); return a && a.id && m.some((o) => o[4] === a.id) ? { al: a.id } : {}; })()),
      ...((() => { const H = this.histInfo(j); return H?.npc ? { hn: H.npc, hm: H.nome } : {}; })()),
      ...(j.leveDisp ? { ds: 1 } : {}), ...(j.sta < j.staMax ? { sa: [Math.floor(j.sta), Math.round(j.staMax), j.semFolego ? 1 : 0] } : {}), // Disparada ligada; estamina (só quando gastou), como a barrinha do jogo // o NPC da missão principal agora: a janela dele ganha o botão "Missão: …" (conversa.gd _quer_missao) // al: o monstro que o próximo golpe pega (André 2026-11-27: círculo vermelho nele)
      ...((() => { const b = this.bfLeve(this.bfJogador(j)), a = this.alvoLeve(j), ba = a && !a.morto && this.bfInimigo ? this.bfLeve(this.bfInimigo(a)) : []; return { ...(b.length ? { bf: b } : {}), ...(ba.length ? { ba } : {}) }; })()), // buffs e debuffs (André 2026-11-27: "ícones de buff" iguais ao jogo, buffs.gd): os meus e os do alvo
      // perto da água (André 2026-11-27: "aparecer opção de pescar e usar o barquinho se eu tiver na bag"), as mesmas contas do
      // jogo: ag = com a vara e água a até 4,4 m (pesca.gd: o botão Pescar); bq = barquinho na mochila e água funda a até 4 m
      // (transporte.gd _estado_botao); vc 'b' = no barquinho (o botão vira Descer)
      ...(j.veiculo === 'barquinho' ? { vc: 'b' } : (() => { const o = {}; if (!j.pesca && !j.veiculo && contar(j.prog.mochila, 'vara') > 0 && acharPonto(j, (a, b) => fundoAgua(a, b) > 0.05, 4.4)) o.ag = 1; if (!j.veiculo && contar(j.prog.mochila, 'barquinho') > 0 && acharPonto(j, (a, b) => fundoAgua(a, b) >= VEICULOS.barquinho.fundo, 4)) o.bq = 1; return o; })()),
      ...(this.emCombate(j) ? { lu: 1, as: j.acaoSeq | 0 } : {}), // as: conta os golpes do herói (a página desenha o corte quando muda) // em luta (bateu ou apanhou nos últimos ESTAMINA.combate s): o cartão de baixo vira "Em luta" (André 2026-11-26)
    };
  },
  // buffs e debuffs da foto do jogo (bfJogador/bfInimigo: [código, fim, valor, extra]) com o fim virado em segundos que
  // faltam (-1 = enquanto durar), que a página só conta; a comida leva o nome e o que dá (o leve não tem a lista de itens)
  bfLeve(l) {
    const t = this.tempo, ms = Date.now(), r = [];
    for (const [k, fim, v, x] of l || []) {
      const falta = !(fim > 0) ? -1 : Math.round(((k === 'co' || k === 'banq') ? (fim - ms) / 1000 : fim - t) * 10) / 10;
      if (fim > 0 && falta <= 0) continue;
      if (k === 'co') { const B = ITENS[v]?.buff?.b || {}; r.push([k, falta, ITENS[v]?.nome || 'Comida', Object.entries(B).map(([b, n]) => `+${Math.round(n * 100)}% ${({ dano: 'dano', defesa: 'defesa', critico: 'crítico', regenMana: 'volta da mana' })[b] || b}`).join(', '), v]); continue; }
      r.push(x === undefined ? [k, falta, v] : [k, falta, v, x]);
    }
    return r;
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
  // [.., chave]: o ícone do jogo (godot-prototipo/icones/<chave>.svg, André 2026-11-27)
  habLeve(j) {
    // 2026-11-27 (André: "uso o meteoro e os bichos continuam lá... no jogo normal evaporo"): o leve usava as skills antigas
    // (msg 'habilidade', dano fixo pequeno); o jogo usa as do Quimera (msg 'habQ': HABS, barras da espada e do cajado, dano
    // pelo status e pelo nível da skill). Agora são as MESMAS do jogo: [id, recarga s, mana] por barra.
    const mg = j.modo === 'Magia', l = [], um = (i, chave, h) => { if (h) l.push([i, h.nome, Math.max(0, Math.ceil((j.cds[chave] || 0) - this.tempo)), h.mana || 0, chave]); };
    const q = (id) => { const H = HABS[id]; return H && (H.libera || 1) <= (j.prog.nivel | 0) ? [id, Math.max(0, Math.ceil(((j.cds[id] || 0) - this.tempo) * 10) / 10), H.mana || 0] : null; }; // nome e ícone vão uma vez só no leveMapa (hq): a foto fica pequena
    const bs = q(mg ? 'cajado_basico' : 'espada_basico');
    const visto = new Set(), barra = (b) => (j.prog.barras?.[b] || []).filter((id) => id && !visto.has(id) && visto.add(id)).map(q).filter(Boolean);
    const [e, c] = BARRAS.map(barra);
    um(9, 'cura', CURA);
    // poções (André 2026-11-26): [k, lugar da 1ª pilha na mochila (-1 = nenhuma), quantas ao todo, recarga s]; usa a msg 'item' do jogo
    const po = ['pocao', 'pocao_mana'].map((k) => {
      let i = -1, n = 0; (j.prog?.mochila || []).forEach((it, q) => { if (it?.k === k) { if (i < 0) i = q; n += it.n || 1; } });
      return [k, i, n, Math.max(0, Math.ceil((j.pocaoAte?.[k] || 0) - this.tempo))];
    });
    const mv = [['rolar', Math.max(0, Math.ceil(((j.cds.rolar || 0) - this.tempo) * 10) / 10)], ['dash', Math.max(0, Math.ceil(((j.cds.dash || 0) - this.tempo) * 10) / 10)]];
    return { mg: mg ? 1 : 0, bs, e, c, l, po, mv };
  },
};

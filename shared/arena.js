// Arena PvP 3x3 Geada x Chama (André 2026-11-21). Estas funções entram na Simulacao (Object.assign no fim de
// simulacao.js), então "this" é a Simulacao (ou a "janela" de um NPC, contextoDeAmigo em shared/amiga.js).
//
// - Entrada: botão PvP no menu do topo (godot-prototipo/arena_pvp.gd) manda { acao: 'fila' | 'sair' | 'info' | 'comprar' }.
// - Fila: com PVP.time * 2 pessoas de verdade começa na hora; senão, depois de PVP.espera s os NPCs completam os times
//   (Cecília, Dario e os aventureiros na Chama; Kira, Rufo e Lis na Geada). Uma partida por vez (a arena é uma só).
// - Quem é de verdade vai para o time da raça dele se tiver vaga (na fase 1 todo mundo é da Chama), senão para o outro.
// - A partida leva todo mundo para a arena (shared/mundo.js ARENA_PVP: disco plano dentro da névoa, ninguém chega a pé),
//   cada time na sua base. Contagem de PVP.contagem s e PVP.duracao s de luta. Lá dentro só os dois times se acertam
//   (inimigosDe e ferir em simulacao.js); a névoa e a guerra de fora não valem.
// - Ninguém morre de verdade: quem zera a vida cai (abate para o outro time) e levanta na base em PVP.renascer s, sem
//   perder XP nem desgastar. Vence o time com mais abates no fim do tempo (André: "o time que matar mais nesse tempo
//   vence"); empate vale empate. No fim, a janela com os abates de cada um e quem venceu; depois todo mundo volta para
//   onde estava, com a vida e a mana de antes (a arena não serve de cura).
// - Moeda: Insígnias da Arena (prog.pvp.pts), para a Loja da Arena (LOJA_PVP, preço fixo).
import { PVP, LOJA_PVP, ITENS, TITULOS, A } from './dados.js';
import { guardar, contar, nomeItem } from './progresso.js';

const r2 = (v) => Math.round(v * 100) / 100;
const OUTRO = { chama: 'geada', geada: 'chama' };

export const Arena = {
  // ---------- regras de quem pode entrar ----------
  motivoSemPvp(j) {
    if (!j || j.morto || j.criando || j.cenaAte > this.tempo) return 'Você não pode entrar na arena agora';
    if (j.pvp) return 'Você já está numa partida';
    if (j.duelo) return 'Você está num duelo';
    if (j.troca) return 'Você está numa troca';
    if (j.veiculo) return 'Desça do veículo para entrar na arena';
    if (this.naCaverna(j)) return 'Saia da caverna para entrar na arena';
    if (this.motivoCarga?.(j)) return this.motivoCarga(j);
    if (this.emCombate(j)) return 'Você está em combate';
    return '';
  },
  // os dois estão na mesma partida, em times diferentes, com a luta valendo
  rivaisArena(a, b) {
    const P = a?.pvp, Q = b?.pvp;
    return !!P && !!Q && P.M === Q.M && P.M.fase === 'luta' && P.time !== Q.time;
  },
  // os inimigos de c na arena (para inimigosDe)
  inimigosArena(c) {
    const P = c.pvp; if (!P || P.M.fase !== 'luta') return [];
    const l = [];
    for (const id of P.M.ids) { const o = this.jogadores.get(id); if (o && o !== c && o.pvp?.M === P.M && o.pvp.time !== P.time && !o.morto) l.push(o); }
    return l;
  },
  naArenaPvp(x, z, folga = 0) { const A = PVP.arena; return Math.hypot(x - A.x, z - A.z) <= A.r + folga; },

  // ---------- comando do celular ----------
  arenaPvp(id, m) {
    const j = this.jogadores.get(id); if (!j || !m || typeof m !== 'object') return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    const fila = (this.filaPvp ||= []);
    if (m.acao === 'info') return this.infoPvp(j);
    if (m.acao === 'fila') {
      if (fila.some((f) => f.id === id)) return this.infoPvp(j);
      const mo = this.motivoSemPvp(j); if (mo) return aviso(mo);
      fila.push({ id, t: this.tempo });
      aviso(this.partidaPvp ? 'Na fila da Arena: a partida de agora termina e a sua começa' : `Na fila da Arena ${PVP.time}x${PVP.time}: procurando jogadores`);
      return this.avisarFilaPvp();
    }
    if (m.acao === 'sair') {
      const i = fila.findIndex((f) => f.id === id);
      if (i >= 0) { fila.splice(i, 1); aviso('Você saiu da fila da Arena'); this.avisarFilaPvp(); return this.infoPvp(j); }
      if (j.pvp) { this.sairArena(j, 'saiu'); aviso('Você saiu da partida (sem Insígnias)'); }
      return;
    }
    if (m.acao === 'comprar') return this.comprarPvp(j, String(m.id || ''));
  },
  // pontos, placar, fila e a loja (a janela do app)
  infoPvp(j) {
    const p = j.prog.pvp || {}, fila = this.filaPvp || [];
    const loja = LOJA_PVP.map((o) => ({ id: o.id, preco: o.preco, ...(o.t ? { t: o.t, nome: `Título: ${TITULOS[o.t]?.nome}`, txt: TITULOS[o.t]?.txt || '', tem: !!j.prog.tit?.tem?.includes(o.t) }
      : { k: o.k, n: o.n, nome: `${o.n}x ${nomeItem({ k: o.k, n: o.n })}`, txt: ITENS[o.k]?.desc || '' }) }));
    this.evento({ t: 'pvp', para: j.id, fase: 'info', pts: p.pts | 0, v: p.v | 0, d: p.d | 0, e: p.e | 0, k: p.k | 0, m: p.m | 0,
      naFila: fila.some((f) => f.id === j.id), fila: fila.length, partida: !!this.partidaPvp, moeda: PVP.nomeMoeda, tam: PVP.time, loja });
  },
  avisarFilaPvp() {
    const fila = this.filaPvp || [];
    for (const f of fila) {
      const falta = this.partidaPvp ? -1 : Math.max(0, Math.ceil(fila[0].t + PVP.espera - this.tempo));
      this.evento({ t: 'pvp', para: f.id, fase: 'fila', na: true, n: fila.length, falta });
    }
  },
  comprarPvp(j, id) {
    const o = LOJA_PVP.find((x) => x.id === id), aviso = (texto) => this.evento({ t: 'aviso', para: j.id, texto }); if (!o) return;
    const p = j.prog, P = (p.pvp ||= { pts: 0, v: 0, d: 0, e: 0, k: 0, m: 0 });
    if ((P.pts | 0) < o.preco) return aviso(`Faltam ${o.preco - (P.pts | 0)} ${PVP.nomeMoeda}`);
    if (o.t) {
      if (p.tit.tem.includes(o.t)) return aviso('Você já tem esse título');
      P.pts -= o.preco; this.ganharTitulo(j, o.t);
    } else {
      const antes = contar(p.mochila, o.k);
      if (!guardar(p.mochila, { k: o.k, n: o.n })) return aviso('Mochila cheia');
      P.pts -= o.preco;
      this.evento({ t: 'compra', para: j.id, i: -1, k: o.k, r: -1, n: contar(p.mochila, o.k) - antes, ouro: 0 });
      aviso(`Comprou ${o.n}x ${nomeItem({ k: o.k, n: o.n })} por ${o.preco} ${PVP.nomeMoeda}`);
    }
    j.progSujo = true; this.avisarProg(j); this.infoPvp(j);
  },

  // ---------- a cada passo ----------
  passoArena(dt) {
    const fila = this.filaPvp;
    if (fila?.length) {
      // quem saiu do jogo, entrou em duelo, morreu... sai da fila
      for (let i = fila.length - 1; i >= 0; i--) { const j = this.jogadores.get(fila[i].id); if (!j || this.motivoSemPvp(j)) { fila.splice(i, 1); if (j && !j.pvp) this.evento({ t: 'pvp', para: j.id, fase: 'fila', na: false }); } }
      if (!this.partidaPvp && fila.length && (fila.length >= PVP.time * 2 || this.tempo >= fila[0].t + PVP.espera)) this.comecarPvp();
      else if (fila.length && this.tempo >= (this.filaPvpT || 0)) { this.filaPvpT = this.tempo + 1; this.avisarFilaPvp(); }
    }
    const M = this.partidaPvp; if (!M) return;
    // quem saiu do jogo (ou caiu da conexão) sai da partida; o placar dele fica na janela do fim
    M.ids = M.ids.filter((id) => this.jogadores.get(id)?.pvp?.M === M);
    if (M.fase === 'fim') return;
    if (!M.ids.some((id) => this.jogadores.get(id).pvp.time === 'chama') || !M.ids.some((id) => this.jogadores.get(id).pvp.time === 'geada')) return this.fimPvp(M);
    if (M.fase === 'contagem' && this.tempo >= M.luta) { M.fase = 'luta'; this.eventoPartida(M, { fase: 'luta', fimEm: Math.round(PVP.duracao) }); }
    if (M.fase === 'luta' && this.tempo >= M.fim) return this.fimPvp(M);
    const A = PVP.arena;
    for (const id of M.ids) {
      const j = this.jogadores.get(id);
      if (j.morto && this.tempo >= (j.pvp.volta || 0)) this.renascerPvp(j);
      else if (!j.morto && Math.hypot(j.x - A.x, j.z - A.z) > A.r + PVP.borda) { // saiu pela borda: volta para dentro
        const d = Math.hypot(j.x - A.x, j.z - A.z) || 1, k = (A.r - 1) / d;
        this.colocarPvp(j, A.x + (j.x - A.x) * k, A.z + (j.z - A.z) * k);
      }
    }
  },
  eventoPartida(M, ev) { for (const id of M.ids) this.evento({ t: 'pvp', para: id, ...ev }); },
  // põe o corpo em (x, z) no chão: o celular de quem é de verdade recebe o "corrigir"; os outros veem o pulo (sem deslizar)
  colocarPvp(j, x, z, ry = null, yRef = undefined) {
    const y = yRef != null ? this.terreno.altura(x, z, yRef) : this.terreno.altura(x, z);
    Object.assign(j, { x, y, z, vy: 0, chao: true, dash: null, arrancada: null, esc: null, acao: null, canal: null, ...(ry != null ? { ry } : {}) });
    j.cliente = null; j.orcT = null;
    if (!j.bot) this.corrigir(j);
    this.evento({ t: 'pvp', fase: 'pulo', id: j.id, x: r2(x), y: r2(y), z: r2(z) });
  },
  baseDoTime(time, i = 0) {
    const A = PVP.arena, lado = time === 'chama' ? -1 : 1, dz = (i - (PVP.time - 1) / 2) * 2; // lado a lado, centrados (4x4 desde 2026-11-22)
    return { x: A.x + lado * PVP.base, z: A.z + dz, ry: lado < 0 ? Math.PI / 2 : -Math.PI / 2 }; // de frente para o meio
  },

  // ---------- começo ----------
  comecarPvp() {
    const fila = this.filaPvp, times = { chama: [], geada: [] };
    const humanos = fila.splice(0, PVP.time * 2).map((f) => this.jogadores.get(f.id)).filter(Boolean);
    for (const j of humanos) { const r = this.racaDe(j) === 'geada' ? 'geada' : 'chama'; (times[r].length < PVP.time ? times[r] : times[OUTRO[r]]).push(j); }
    // os NPCs completam (só quem está no mundo, livre)
    const livre = (ctx) => { const a = ctx?.amiga; return a && !a.morto && !a.pvp && !a.duelo && !a.troca && !a.veiculo && !a.criando && !this.naCaverna(a) ? a : null; };
    for (const t of ['chama', 'geada']) {
      const lista = PVP.npcs[t].map((id) => this.amigosIa.find((c) => c.AMIGA?.id === id));
      if (t === 'chama') lista.push(...this.amigosIa.filter((c) => c.AMIGA && !c.AMIGA.raca && !c.AMIGA.recruta && !PVP.npcs.chama.includes(c.AMIGA.id))); // depois, qualquer aventureiro
      for (const ctx of lista) { if (times[t].length >= PVP.time) break; const a = livre(ctx); if (a && !times.chama.includes(a) && !times.geada.includes(a)) times[t].push(a); }
    }
    if (!times.chama.length || !times.geada.length) {
      for (const j of humanos) { fila.push({ id: j.id, t: this.tempo }); this.evento({ t: 'aviso', para: j.id, texto: 'Arena: faltou gente para os dois times, tentando de novo' }); }
      return;
    }
    const M = this.partidaPvp = { ids: [], fase: 'contagem', luta: this.tempo + PVP.contagem, fim: this.tempo + PVP.contagem + PVP.duracao, inicio: this.tempo,
      placar: { chama: 0, geada: 0 }, stats: {} };
    for (const t of ['chama', 'geada']) times[t].forEach((j, i) => {
      j.pvp = { M, time: t, de: { x: j.x, y: j.y, z: j.z, ry: j.ry, vida: j.vida, mana: j.mana }, volta: 0, desde: this.tempo };
      M.ids.push(j.id); M.stats[j.id] = { nome: j.nome, time: t, k: 0, m: 0, bot: !!j.bot };
      j.montado = null; j.pedidoDuelo = null;
      if (j.coleta) this.pararColeta(j, null);
      if (j.pesca) this.pararPesca(j, null);
      this.cancelarVila(j, null);
      if (j.canal) this.cancelarCanal?.(j);
      j.vida = j.vidaMax; j.mana = j.manaMax ?? j.mana; j.vuln = null; j.lentoH = null; j.escudo = null; // todo mundo começa inteiro
      const b = this.baseDoTime(t, i);
      this.colocarPvp(j, b.x, b.z, b.ry);
      if (j.bot) this.amigoIaDe(j)?.pararAmiga(j);
    });
    const A = PVP.arena, lista = M.ids.map((id) => ({ id, nome: M.stats[id].nome, time: M.stats[id].time }));
    for (const id of M.ids) this.evento({ t: 'pvp', para: id, fase: 'inicio', time: M.stats[id].time, arena: { x: A.x, z: A.z, r: A.r },
      bases: { chama: this.baseDoTime('chama', (PVP.time - 1) / 2), geada: this.baseDoTime('geada', (PVP.time - 1) / 2) }, jogadores: lista, conta: PVP.contagem, dur: PVP.duracao });
  },

  // ---------- luta ----------
  // golpe de um time no outro (ferir): zerou a vida, cai e conta o abate. true = caiu
  golpeArena(alvo, de, h) {
    if (alvo.vida > 0) { if (h) this.efeitoDuelo(alvo, h); return false; }
    const M = alvo.pvp.M;
    alvo.vida = 0; alvo.morto = true; alvo.dash = null; alvo.arrancada = null; alvo.esc = null; alvo.acao = null; alvo.canal = null;
    this.tocar(alvo, A.death, 1);
    alvo.trava = Infinity; alvo.pvp.volta = this.tempo + PVP.renascer;
    M.placar[de.pvp.time]++;
    if (M.stats[de.id]) M.stats[de.id].k++;
    if (M.stats[alvo.id]) M.stats[alvo.id].m++;
    this.eventoPartida(M, { fase: 'abate', de: de.id, alvo: alvo.id, deNome: de.nome, alvoNome: alvo.nome, time: de.pvp.time, placar: { ...M.placar }, volta: PVP.renascer });
    return true;
  },
  renascerPvp(j) {
    const M = j.pvp.M, i = M.ids.filter((id) => this.jogadores.get(id)?.pvp?.time === j.pvp.time).indexOf(j.id);
    Object.assign(j, { morto: false, vida: j.vidaMax, mana: j.manaMax ?? j.mana, trava: 0, acao: null, vuln: null, lentoH: null });
    const b = this.baseDoTime(j.pvp.time, Math.max(0, i) % PVP.time);
    this.colocarPvp(j, b.x, b.z, b.ry);
  },

  // ---------- fim ----------
  fimPvp(M) {
    if (M.fase === 'fim') return;
    M.fase = 'fim';
    const pc = M.placar, venc = pc.chama > pc.geada ? 'chama' : pc.geada > pc.chama ? 'geada' : '';
    const stats = Object.entries(M.stats).map(([id, s]) => ({ id, nome: s.nome, time: s.time, k: s.k, m: s.m, bot: s.bot ? 1 : 0 }))
      .sort((a, b) => b.k - a.k || a.m - b.m);
    const G = PVP.moeda;
    for (const id of M.ids) {
      const j = this.jogadores.get(id), t = j.pvp.time, s = M.stats[id];
      if (j.morto) Object.assign(j, { morto: false, trava: 0, acao: null }); // levanta para ver a janela (e voltar)
      j.trava = 0;
      const ficou = this.tempo - j.pvp.desde >= Math.min(G.minimo, PVP.duracao * 0.2);
      const P = (j.prog.pvp ||= { pts: 0, v: 0, d: 0, e: 0, k: 0, m: 0 });
      const res = !venc ? 'e' : venc === t ? 'v' : 'd';
      let ganhou = 0;
      if (ficou) {
        ganhou = (res === 'v' ? G.vitoria : res === 'd' ? G.derrota : G.empate) + Math.min(G.abateMax, s.k * G.abate);
        P.pts = (P.pts | 0) + ganhou; P[res] = (P[res] | 0) + 1;
      }
      P.k = (P.k | 0) + s.k; P.m = (P.m | 0) + s.m;
      j.progSujo = true; this.conferirTitulos(j);
      this.evento({ t: 'pvp', para: id, fase: 'fim', vencedor: venc, time: t, resultado: res, placar: { ...pc }, stats, ganhou, pts: P.pts | 0, moeda: PVP.nomeMoeda, volta: 4 });
    }
    // 4 s na arena com a janela aberta; depois cada um volta para onde estava
    this.depois(4, () => {
      for (const id of [...M.ids]) { const j = this.jogadores.get(id); if (j?.pvp?.M === M) this.sairArena(j, 'fim'); }
      if (this.partidaPvp === M) this.partidaPvp = null;
      this.avisarFilaPvp();
    });
  },
  // tira j da partida e devolve onde ele estava, com a vida e a mana de antes (motivo: fim, saiu, caiu)
  sairArena(j, motivo = 'saiu') {
    const P = j?.pvp; if (!P) return;
    const M = P.M;
    j.pvp = null;
    M.ids = M.ids.filter((id) => id !== j.id);
    if (motivo !== 'caiu') {
      const d = P.de;
      Object.assign(j, { morto: false, trava: 0, acao: null, vida: Math.max(1, Math.min(j.vidaMax, d.vida)), mana: Math.min(j.manaMax ?? d.mana, d.mana), vuln: null, lentoH: null });
      this.colocarPvp(j, d.x, d.z, d.ry, d.y); // d.y: em cima de uma pedra, telhado ou dentro da caverna, volta no mesmo andar
    }
    if (j.bot) { const ctx = this.amigoIaDe(j); ctx?.pararAmiga(j); if (j.ia) j.ia.cer = null; }
    this.evento({ t: 'pvp', para: j.id, fase: 'saiu', motivo });
    if (M.fase !== 'fim' && this.partidaPvp === M) this.eventoPartida(M, { fase: 'saiuOutro', nome: j.nome });
  },
  // a posição que vai para a conta enquanto está na arena: a de antes (sair do jogo lá dentro volta para lá)
  posicaoForaDaArena(j) { return j.pvp?.de || null; },
};

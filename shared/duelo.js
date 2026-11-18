// Duelo (André 2026-11-17: "opção pra chamar duelo tanto contra Dario e Cecília qt contra jogadores").
// Estas funções entram na Simulacao (Object.assign no fim de simulacao.js), então "this" é a Simulacao.
//
// Como funciona (esboço aprovado em /mnt/project-files/duelo/1-esboco-duelo.png):
// - Tocar no outro (de perto, DUELO.perto m) mostra "Duelo"; quem recebe tem DUELO.pedido s para Aceitar ou Recusar.
//   A Cecília e o Dario decidem na hora pelo humor (shared/amiga.js pedidoDueloAmiga).
// - Contagem (DUELO.contagem s) e luta dentro de um círculo de DUELO.raio m: sair dele = perde.
// - Só os dois se batem (inimigosDe põe o outro na lista de alvos). Monstros continuam valendo como sempre.
// - Acaba quando um chega a DUELO.fim da vida (ninguém morre), quando alguém sai, cai para um monstro ou desiste;
//   sem limite de tempo (André 2026-11-17: "quem quiser encerrar só sai do círculo").
// - Sem castigo: não perde ouro, item nem XP, e o equipamento não desgasta (só a morte desgasta, e no duelo ninguém morre).
//   Não dá XP nem drop. O placar (prog.duelos) fica na conta.
// - André 2026-11-18 (conselho, opção 2: "duelo não começa em combate e quando termina não deveria encher, a pessoa tem que
//   se recuperar por conta própria com poções e cura"): não começa com nenhum dos dois em combate, e no fim cada um sai
//   com a vida e a mana que tinha (antes voltavam cheias; dava para usar o duelo como cura de graça no meio da luta).
import { DUELO } from './dados.js';

const longe = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

export const Duelo = {
  // por que este não pode duelar agora ('' = pode). eu = true: "Você ..."; senão "Cecília ..." (frases inteiras: inglês)
  motivoSemDuelo(j, eu = false) {
    const f = (voce, ele) => (eu ? voce : ele);
    const n = j?.nome;
    if (!j || j.morto || j.criando || j.cenaAte > this.tempo) return f('Você não pode duelar agora', `${n} não pode duelar agora`);
    if (j.duelo) return f('Você já está num duelo', `${n} já está num duelo`);
    if (j.troca) return f('Você está numa troca', `${n} está numa troca`);
    if (j.veiculo === 'barquinho' || j.veiculo === 'navio') return f('Você está no barco', `${n} está no barco`);
    if (j.veiculo) return f('Você está no carrinho', `${n} está no carrinho`);
    if (this.naCaverna(j)) return f('Você está na caverna', `${n} está na caverna`);
    if (this.emCombate(j)) return f('Você está em combate', `${n} está em combate`);
    if (this.inimigos.some((b) => b.bm && !b.morto && b.arena && this.naArena(b, j, 10))) return f('Você está perto de um chefe', `${n} está perto de um chefe`);
    return '';
  },
  oponenteDuelo(j) {
    const D = j?.duelo; if (!D) return null;
    const o = this.jogadores.get(D.a === j.id ? D.b : D.a);
    return o && o.duelo === D ? o : null;
  },
  // os dois estão lutando um contra o outro agora (contagem já acabou)
  duelando(a, b) { return !!(a?.duelo && a.duelo === b?.duelo && a.duelo.luta); },

  // comando do celular: { acao: 'pedir' | 'aceitar' | 'recusar' | 'desistir', com: id }
  duelo(id, m) {
    const j = this.jogadores.get(id); if (!j || !m || typeof m !== 'object') return;
    const aviso = (texto, para = id) => this.evento({ t: 'aviso', para, texto });
    if (m.acao === 'desistir') { if (j.duelo) this.fimDuelo(j.duelo, this.oponenteDuelo(j), 'desistiu'); return; }
    if (m.acao === 'recusar') {
      const p = j.pedidoDuelo; if (!p || p.de !== String(m.com)) return;
      j.pedidoDuelo = null;
      if (this.jogadores.has(p.de)) aviso(`${j.nome} recusou o duelo`, p.de);
      return;
    }
    if (m.acao !== 'pedir' && m.acao !== 'aceitar') return;
    const o = this.jogadores.get(String(m.com));
    if (!o || o === j) return;
    const eu = this.motivoSemDuelo(j, true); if (eu) return aviso(eu);
    const ele = this.motivoSemDuelo(o); if (ele) return aviso(ele);
    if (this.recusaGuerra(j, o)) return; // Chama x Geada (André 2026-11-18): com a outra raça é guerra, não duelo
    if (longe(j, o) > DUELO.perto) return aviso(`Chegue mais perto de ${o.nome} pra duelar`);
    if (o.bot) { // a Cecília ou o Dario: decide na hora (sem cartão)
      const ctx = this.amigoIaDe(o);
      if (!ctx) return aviso(`${o.nome} não duela`);
      if ((j.dueloPedidoT ?? -99) > this.tempo - DUELO.entrePedidos) return aviso('Espere um pouquinho para chamar de novo');
      j.dueloPedidoT = this.tempo;
      if (ctx.pedidoDueloAmiga(j)) this.comecarDuelo(j, o);
      return;
    }
    const veio = j.pedidoDuelo && j.pedidoDuelo.de === o.id && j.pedidoDuelo.ate >= this.tempo;
    if (m.acao === 'aceitar' || veio) { // aceitou (ou os dois chamaram um ao outro)
      if (!veio) return aviso('O pedido de duelo já expirou');
      j.pedidoDuelo = null; o.pedidoDuelo = null;
      return this.comecarDuelo(o, j);
    }
    if ((j.dueloPedidoT ?? -99) > this.tempo - DUELO.entrePedidos) return aviso('Espere um pouquinho para chamar de novo');
    j.dueloPedidoT = this.tempo;
    o.pedidoDuelo = { de: j.id, ate: this.tempo + DUELO.pedido };
    this.evento({ t: 'duelo', para: o.id, fase: 'pedido', de: j.id, nome: j.nome, dur: DUELO.pedido });
    return aviso(`Duelo: chamado enviado para ${o.nome}`);
  },

  comecarDuelo(a, b) {
    const D = { a: a.id, b: b.id, x: (a.x + b.x) / 2, z: (a.z + b.z) / 2, inicio: this.tempo + DUELO.contagem, luta: false };
    a.duelo = b.duelo = D;
    (this.duelos ||= new Set()).add(D);
    for (const j of [a, b]) {
      j.pedidoDuelo = null; j.montado = null;
      if (j.coleta) this.pararColeta(j, null);
      if (j.pesca) this.pararPesca(j, null);
      this.cancelarVila(j, null);
      const o = j === a ? b : a;
      this.evento({ t: 'duelo', para: j.id, fase: 'inicio', com: o.id, nome: o.nome, x: Math.round(D.x * 100) / 100, z: Math.round(D.z * 100) / 100, r: DUELO.raio, conta: DUELO.contagem });
    }
  },

  // a cada passo: contagem, quem saiu do círculo, quem caiu, o tempo
  passoDuelos() {
    if (!this.duelos?.size) return;
    for (const D of [...this.duelos]) {
      const a = this.jogadores.get(D.a), b = this.jogadores.get(D.b);
      const okA = a && a.duelo === D, okB = b && b.duelo === D;
      if (!okA || !okB) { this.fimDuelo(D, okA ? a : okB ? b : null, 'saiu'); continue; }
      if (a.morto || b.morto) { this.fimDuelo(D, a.morto ? (b.morto ? null : b) : a, 'caiu'); continue; }
      const foraA = Math.hypot(a.x - D.x, a.z - D.z) > DUELO.raio, foraB = Math.hypot(b.x - D.x, b.z - D.z) > DUELO.raio;
      if (foraA || foraB) { this.fimDuelo(D, foraA && foraB ? null : foraA ? b : a, 'fora'); continue; }
      if (!D.luta && this.tempo >= D.inicio) {
        D.luta = true;
        for (const j of [a, b]) this.evento({ t: 'duelo', para: j.id, fase: 'luta' });
      }
    }
  },

  // golpe de um duelista no outro (ferir): a vida não passa de DUELO.fim; chegou lá, acaba. true = o duelo acabou.
  golpeDuelo(alvo, de) {
    const lim = Math.max(1, Math.round(alvo.vidaMax * DUELO.fim));
    if (alvo.vida > lim) return false;
    alvo.vida = lim;
    this.fimDuelo(alvo.duelo, de, 'vida');
    return true;
  },
  // atordoar, congelar, lentidão e Quebrado de um jogador no outro: valem como no herói (efeitoNoHeroi), com o tempo
  // de travar cortado (DUELO.travar), como no chefe
  efeitoDuelo(alvo, h) {
    const k = DUELO.travar;
    if (h.atordoa) this.efeitoNoHeroi(alvo, { atordoa: h.atordoa * k });
    if (h.congela) this.efeitoNoHeroi(alvo, { congela: h.congela * k });
    if (h.lento) this.efeitoNoHeroi(alvo, { lento: { k: h.lento.k * k, dur: h.lento.dur } });
    if (h.vulneravel) alvo.vuln = { k: h.vulneravel.k * k, ate: this.tempo + h.vulneravel.dur };
  },

  // vencedor: corpo ou null (empate / ninguém). motivo: vida, fora, caiu, saiu, desistiu
  fimDuelo(D, vencedor, motivo) {
    if (!D || !this.duelos?.has(D)) return;
    this.duelos.delete(D);
    const js = [D.a, D.b].map((k) => this.jogadores.get(k)).filter((j) => j && j.duelo === D);
    const nomeV = vencedor?.nome || '';
    for (const j of js) {
      j.duelo = null;
      if (!j.morto) { // sem castigo, mas sem cura: a vida e a mana ficam como estão (André 2026-11-18)
        j.vida = Math.max(1, j.vida); // o duelo nunca mata (DUELO.fim)
        j.vuln = null; j.lentoH = null;
        if (j.presoAte > this.tempo) { j.presoAte = 0; if (j.trava !== Infinity) j.trava = 0; }
      }
      if (vencedor && js.length === 2) {
        const p = j.prog, d = (p.duelos ||= { v: 0, d: 0 });
        if (j === vencedor) d.v++; else d.d++;
        j.progSujo = true;
      }
    }
    for (const j of js) {
      const o = this.jogadores.get(j.id === D.a ? D.b : D.a);
      const ganhou = vencedor ? vencedor === j : null;
      this.evento({ t: 'duelo', para: j.id, fase: 'fim', com: o?.id ?? null, ganhou, vencedor: nomeV, motivo, placar: j.prog.duelos || { v: 0, d: 0 } });
      if (j.bot) this.amigoIaDe(j)?.fimDueloAmiga(j);
    }
  },
};


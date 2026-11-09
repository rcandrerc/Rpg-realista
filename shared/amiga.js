// Cecília, a amiga (André 2026-11-07 e 2026-11-09): uma "jogadora" que vive no servidor, sem celular por trás.
// Estas funções entram na Simulacao (Object.assign no fim de simulacao.js), então "this" é a Simulacao.
//
// Fase 1: ela tem um terreno nas Terras da Estrada, levanta a casa peça por peça (AMIGA.casa), cuida da horta
// (arar, plantar, regar, colher) e passeia pela vila. Só o dono (a conta de teste do André) conversa com ela; os outros
// jogadores veem o corpo, as animações e a casa, mas tocar nela não abre nada (o servidor só responde ao dono).
// Ela é amiga de igual para igual: às vezes pede coisas, e quem ajuda ganha a amizade dela (e um presente de volta).
//
// Onde fica cada coisa:
// - this.amiga: o corpo dela (um jogador com bot: true) ou null quando o dono não está na sala.
// - this.amigaDono: id da sessão do dono (quem pode conversar).
// - L.amiga (o terreno dela): { prog, amizade, pedido } guardado junto com o terreno no banco (server/contas.js).
// - j.ia: o que ela está fazendo agora { fase, alvo, rota, ate, ... } (não vai para o banco).
import { AMIGA, CONSTRUCOES, PLANTAS, HORTA, VILA_LOTES, CASA, ITENS, TIME, MONTARIAS, fasePlanta } from './dados.js';
import { guardar, contar, tirar, horaDoJogo, ehNoite, liberarPaginas, precoVenda, ehEquip, itemValido, reforcoOk, nomeItem as nomeDoItem } from './progresso.js';
import { motivoPeca, motivoTerreno, crescerPlanta, retPeca } from './simulacao.js';

const sorteia = (l) => l[Math.floor(Math.random() * l.length)];
const PASSEIOS = [[-6, -10.5], [-8.6, -9.4], [-2.5, -6], [1, 0.5], [-4, 2], [-1, 12]]; // praça, Rosa, ferraria, entrada
const REGA_MS = HORTA.rega * 3600000;

// peça da casa da lista AMIGA.casa no mundo (o terreno começa em x0, z0)
function pecaDaCasa(def, c) {
  const [k, dx, dz, lado] = c, T = CONSTRUCOES[k]?.tipo;
  let x = def.x0 + dx, z = def.z0 + dz, r = 0;
  if (T === 'borda') {
    const g = CASA.grade / 2;
    if (lado === 'n') z -= g; else if (lado === 's') z += g; else if (lado === 'o') { x -= g; r = 1; } else { x += g; r = 1; }
  } else r = (lado | 0) & 3;
  return { k, x, z, r };
}
const chavePeca = (p) => `${p.k}:${p.x},${p.z}`;
const mesmaPeca = (a, b) => a.k === b.k && Math.abs(a.x - b.x) < 0.01 && Math.abs(a.z - b.z) < 0.01 && (a.r & 1) === (b.r & 1);

export const Amiga = {
  // ---------- entra e sai junto com o dono ----------
  // o servidor chama quando o dono entra na sala (contas de teste do André; sem contas, o primeiro que entra)
  amigaEntrar(donoId) {
    this.amigaDono = donoId;
    if (!this.amiga) {
      const L = this.loteDaAmiga(true);
      const salvo = L?.amiga || {};
      const j = this.adicionarJogador(AMIGA.id, AMIGA.nome, AMIGA.visual, { aparencia: AMIGA.aparencia, progresso: salvo.prog || null });
      j.conta = AMIGA.conta; j.bot = true;
      delete j.prog.pos;
      // a roupa dela (look B) na primeira vez; depois ela veste o que achar melhor (fase 3) e isso fica salvo
      for (const [l, it] of Object.entries(AMIGA.equip)) if (!salvo.prog || !j.prog.equip[l]) j.prog.equip[l] = { ...it };
      liberarPaginas(j.prog, AMIGA.mochila.paginas); // fase 3: 4 páginas, como a mochila do André
      this.aplicarStatus(j, true);
      j.amizade = salvo.amizade | 0;
      j.pedido = salvo.pedido && ITENS[salvo.pedido.k] ? { k: salvo.pedido.k, n: salvo.pedido.n | 0 } : null;
      j.ia = { fase: 'pensar', ate: 0 };
      this.pocoesAmiga(j);
      // aparece na porta de casa (ou no canto do terreno, se a casa ainda não existe)
      const def = L?.def, x = def ? def.x0 + AMIGA.porta[0] : this.mapa.nascimento.x + 2, z = def ? def.z0 + AMIGA.porta[1] : this.mapa.nascimento.z + 2;
      Object.assign(j, { x, z, y: this.terreno.altura(x, z), ry: Math.PI, chao: true });
      this.amiga = j;
    }
    this.evento({ t: 'amiga', para: donoId, id: AMIGA.id, nome: AMIGA.nome, lote: this.loteDaAmiga()?.def.id || null });
    const dono = this.jogadores.get(donoId); if (dono?.amigos) this.enviarAmigos(dono); // ela aparece em "Amigos virtuais"
  },
  // o dono saiu: ela guarda o que tem e sai junto (parada, sem gastar servidor)
  amigaSair(donoId) {
    if (!this.amiga || (donoId != null && donoId !== this.amigaDono)) return;
    if (this.amiga.time) this.sairDoTime(this.amiga, `${AMIGA.nome} saiu do jogo`);
    this.guardarAmiga();
    this.jogadores.delete(this.amiga.id);
    this.amiga = null; this.amigaDono = null;
  },
  ehAmiga(o) { return !!o?.bot; },
  // ---------- o terreno dela ----------
  // o terreno da Cecília; com criar, procura um lugar livre nas Terras da Estrada perto da entrada e reserva no banco
  loteDaAmiga(criar = false) {
    for (const L of this.lotes.values()) if (L.dono === AMIGA.conta) return L;
    if (!criar) return null;
    const outros = [...this.lotes.values()].filter((L) => L.dono).map((L) => L.def);
    const { w, d } = AMIGA.terreno, entrada = VILA_LOTES.estrada[VILA_LOTES.estrada.length - 1];
    const lugares = [];
    for (let x0 = -38; x0 <= 10; x0 += 2) for (let z0 = 48; z0 <= 130; z0 += 2) lugares.push({ x0, z0, x1: x0 + w, z1: z0 + d });
    lugares.sort((a, b) => Math.hypot(a.x0 + w / 2 - entrada[0], a.z0 + d / 2 - entrada[1] - 6) - Math.hypot(b.x0 + w / 2 - entrada[0], b.z0 + d / 2 - entrada[1] - 6));
    const R = lugares.find((R) => !motivoTerreno(R, outros));
    if (!R) return null;
    const lid = 't' + AMIGA.id;
    if (this.aoComprarLote && !this.aoComprarLote(lid, AMIGA.conta, AMIGA.nome, R)) return null;
    const L = { def: { id: lid, nome: 'Terreno', ...R }, dono: AMIGA.conta, nomeDono: AMIGA.nome, pecas: [], horta: {}, prox: 1, taxa: Date.now(), amiga: {} };
    this.lotesSoltos.delete(lid);
    this.lotes.set(lid, L);
    this.avisarLote(L);
    return L;
  },
  // guarda o progresso dela dentro do terreno (vai para o banco em lotesParaSalvar)
  guardarAmiga() {
    const j = this.amiga, L = this.loteDaAmiga(); if (!j || !L) return;
    L.amiga = { prog: j.prog, amizade: j.amizade | 0, pedido: j.pedido || null };
    this.lotesMudados.add(L.def.id);
  },
  // ---------- a cabeça dela (a cada passo da simulação) ----------
  passoAmiga(dt) {
    const j = this.amiga; if (!j) return;
    const ia = j.ia, L = this.loteDaAmiga();
    this.passoChatAmiga(j); // mensagens dela no chat (respostas "digitando" e quando ela chama o André)
    if (j.troca) return this.passoTrocaAmiga(j); // trocando (fase 3): fica parada olhando para ele e negocia
    // caiu lutando: sai do time e renasce em casa (a cama dela), como qualquer jogador
    if (j.morto) { if (j.time) { this.falarAmiga(AMIGA.falas.caiu); this.sairDoTime(j, `${AMIGA.nome} caiu`); } ia.fase = 'pensar'; return; }
    // subiu de nível: põe os pontos metade em força e metade em vitalidade (guerreira)
    while (j.prog.pontos > 0) this.distribuirAtributo(j.id, j.prog.atr.for <= j.prog.atr.vit ? 'for' : 'vit');
    // conversando: fica parada olhando para o dono
    const dono = this.jogadores.get(this.amigaDono);
    if (ia.conversaAte > this.tempo && dono) {
      this.pararAmiga(j);
      j.ry = Math.atan2(dono.x - j.x, dono.z - j.z);
      return;
    }
    // o André chamou pelo chat ("vem cá"): ela vai até ele (fora do time; no time ela já segue)
    if (ia.vir && dono && !j.time) { if (this.virAmiga(j, dono, dt)) return; }
    // o amigo chegou perto enquanto ela andava: para e espera um pouco (uma vez por chegada; ele saiu para longe, vale de novo)
    if (dono) {
      const d = Math.hypot(dono.x - j.x, dono.z - j.z);
      if (d > 6) ia.viu = false;
      else if (d < 3 && !ia.viu && ia.fase === 'andar') { ia.viu = true; ia.conversaAte = this.tempo + 4; return; }
    }
    // no time do dono: segue, luta e cuida da vida (fase 2); saiu do time: volta para a vida dela
    if (j.time && dono && j.time.membros.includes(dono.id)) { ia.noTime = true; return this.passoTimeAmiga(j, dono, dt); }
    if (j.time) this.sairDoTime(j, `${AMIGA.nome} saiu do time`); // o dono saiu da sala ou do time: ela não fica com outros
    if (ia.noTime) { ia.noTime = false; j.montado = null; this.pararAmiga(j); ia.fase = 'pensar'; ia.ate = this.tempo + 1; if (dono) this.falarAmiga(AMIGA.falas.voltou); this.pocoesAmiga(j); }
    if (ia.fase === 'andar') return this.andarAmiga(j, dt);
    if (ia.fase === 'trabalhar') {
      if (this.tempo >= ia.golpe) { ia.golpe = this.tempo + ia.ritmo; j.acao = { nome: ia.anim, ts: 1 }; j.acaoSeq++; }
      if (this.tempo >= ia.ate) { const fim = ia.fim; ia.fase = 'pensar'; ia.ate = this.tempo + 0.5; j.acao = null; fim?.(); }
      return;
    }
    if (ia.fase === 'parada') { if (this.tempo >= ia.ate) ia.fase = 'pensar'; return; }
    if (this.tempo < ia.ate || !L) return;
    if (this.tempo >= (ia.arrumaT || 0)) { ia.arrumaT = this.tempo + AMIGA.mochila.arrumar; this.arrumarMochilaAmiga(j); }
    // 1) a casa: a próxima peça que falta
    const falta = AMIGA.casa.map((c) => pecaDaCasa(L.def, c)).find((p) => !L.pecas.some((o) => mesmaPeca(o, p)) && !ia.pulas?.has(chavePeca(p)));
    if (falta) return this.irTrabalhar(j, L, this.ondeFicar(L, falta), AMIGA.passo.obra, 'golpe1', 1.1, () => this.colocarPeca(L, falta));
    // 2) a horta: o canteiro que precisa de alguma coisa
    const H = AMIGA.horta, agora = Date.now();
    for (let dz = 0; dz < H.d; dz++) for (let dx = 0; dx < H.w; dx++) {
      const ci = L.def.x0 + H.x + dx, cj = L.def.z0 + H.z + dz, c = ci + ',' + cj, t = L.horta[c];
      if (t) crescerPlanta(t, agora);
      const madura = t?.c && fasePlanta(t.g / PLANTAS[t.c].G) >= 4;
      const seca = t?.c && !(t.w && agora < t.w + REGA_MS);
      if (t && t.c && !madura && !seca) continue;
      return this.irTrabalhar(j, L, { x: ci + 0.5, z: cj + 1.1 }, AMIGA.passo.canteiro, 'pouso', 1.6, () => this.cuidarCanteiro(L, c));
    }
    // 3) tudo em ordem: passeia pela vila (às vezes) ou descansa na porta de casa
    if (Math.random() < 0.5) {
      const [x, z] = sorteia(PASSEIOS);
      this.irPara(j, L, { x: x + Math.random() - 0.5, z: z + Math.random() - 0.5 }, () => { ia.fase = 'parada'; ia.ate = this.tempo + AMIGA.passo.passeio * (0.5 + Math.random()); });
    } else this.irPara(j, L, { x: L.def.x0 + AMIGA.porta[0] + Math.random() * 2 - 1, z: L.def.z0 + AMIGA.porta[1] }, () => { ia.fase = 'parada'; ia.ate = this.tempo + AMIGA.passo.passeio; j.ry = 0; });
  },
  pararAmiga(j) { j.entrada = { mx: 0, mz: 0, correr: false }; },
  // onde ela fica em pé para pôr a peça: do lado de dentro da casa (a parede da frente, pelo lado de fora)
  ondeFicar(L, p) {
    const T = CONSTRUCOES[p.k].tipo, [a0, b0, a1, b1] = AMIGA.dentro, cx = L.def.x0 + (a0 + a1) / 2, cz = L.def.z0 + (b0 + b1) / 2;
    if (T === 'fundacao' || T === 'telhado') return { x: p.x, z: L.def.z0 + AMIGA.porta[1] };
    if (T === 'borda') {
      if (p.r & 1) return { x: p.x + Math.sign(cx - p.x) * 1.1, z: p.z };
      return p.z > cz ? { x: p.x, z: p.z + 1.2 } : { x: p.x, z: p.z + 1.1 };
    }
    const R = retPeca(p);
    return { x: p.x, z: Math.min(L.def.z1 - 0.4, R[3] + 0.7) };
  },
  colocarPeca(L, falta) {
    const p = { id: 'p' + L.prox, ...falta, lote: L.def.id };
    const motivo = motivoPeca(L, p, null);
    if (motivo) { // não cabe (alguém mudou o mapa): pula esta peça para sempre nesta sala
      (this.amiga.ia.pulas ||= new Set()).add(chavePeca(falta));
      console.warn(`Cecília: ${falta.k} em ${falta.x}, ${falta.z} não coube (${motivo})`);
      return;
    }
    L.prox++;
    L.pecas.push(p);
    this.refazerSolidosLotes();
    this.avisarLote(L);
    // ficou presa dentro de uma parede? sai para o lado de fora da porta
    if (!this.livreParaHeroi(this.amiga, this.amiga.x, this.amiga.z)) Object.assign(this.amiga, { x: L.def.x0 + AMIGA.porta[0], z: L.def.z0 + AMIGA.porta[1] });
  },
  // arar, plantar, regar ou colher o canteiro c (sem enxada, regador nem vigor: ela é da casa)
  cuidarCanteiro(L, c) {
    const j = this.amiga, agora = Date.now(), t = L.horta[c];
    if (!t) L.horta[c] = { c: '', g: 0, w: 0, u: agora };
    else if (!t.c) {
      const s = AMIGA.plantas.find((s) => contar(j.prog.mochila, 'semente_' + s) > 0) || sorteia(AMIGA.plantas);
      if (contar(j.prog.mochila, 'semente_' + s) > 0) tirar(j.prog.mochila, 'semente_' + s, 1);
      Object.assign(t, { c: s, g: 0, u: agora, w: agora });
    } else if (fasePlanta(t.g / PLANTAS[t.c].G) >= 4) {
      const P = PLANTAS[t.c], n = P.y[0] + Math.floor(Math.random() * (P.y[1] - P.y[0] + 1));
      guardar(j.prog.mochila, { k: t.c, n });
      Object.assign(t, { c: '', g: 0, u: agora, w: 0 });
      this.guardarAmiga();
    } else { t.w = agora; t.u = agora; }
    this.avisarLote(L);
  },
  // ---------- andar ----------
  irTrabalhar(j, L, onde, dur, anim, ritmo, fim) {
    this.irPara(j, L, onde, () => {
      Object.assign(j.ia, { fase: 'trabalhar', ate: this.tempo + dur, golpe: this.tempo, anim, ritmo, fim });
      if (onde.olhar) j.ry = onde.olhar;
    });
  },
  // anda até o ponto; entre o terreno dela e a vila vai pela estrada (VILA_LOTES.estrada)
  irPara(j, L, alvo, chegou) {
    const rota = [], dentroTerras = (p) => p.z > VILA_LOTES.estrada[VILA_LOTES.estrada.length - 1][1] - 2;
    const estrada = VILA_LOTES.estrada.map(([x, z]) => ({ x, z })), fim = estrada[estrada.length - 1];
    const ruaX = VILA_LOTES.ruas[0].pontos[0][0];
    if (dentroTerras(j) && !dentroTerras(alvo)) { rota.push({ x: ruaX, z: j.z }, fim, ...estrada.slice().reverse()); }
    else if (!dentroTerras(j) && dentroTerras(alvo)) { rota.push(...estrada, { x: ruaX, z: alvo.z }); }
    // casa com parede na frente: entra e sai pela porta
    if (L && this.dentroDaCasa(L, j) !== this.dentroDaCasa(L, alvo) && L.pecas.some((p) => p.k === 'porta')) {
      const [px, pz] = AMIGA.porta, porta = [{ x: L.def.x0 + px, z: L.def.z0 + pz }, { x: L.def.x0 + px, z: L.def.z0 + pz - 1.8 }];
      if (this.dentroDaCasa(L, j)) rota.unshift(...porta.slice().reverse()); else rota.push(...porta);
    }
    rota.push(alvo);
    Object.assign(j.ia, { fase: 'andar', rota, chegou, preso: 0, longe: Infinity });
  },
  dentroDaCasa(L, p) { const [a0, b0, a1, b1] = AMIGA.dentro; return p.x > L.def.x0 + a0 + 0.2 && p.x < L.def.x0 + a1 - 0.2 && p.z > L.def.z0 + b0 + 0.2 && p.z < L.def.z0 + b1 - 0.2; },
  andarAmiga(j, dt) {
    const ia = j.ia, alvo = ia.rota[0];
    if (!alvo) { this.pararAmiga(j); ia.fase = 'pensar'; ia.ate = this.tempo + 0.3; const f = ia.chegou; ia.chegou = null; f?.(); return; }
    const dx = alvo.x - j.x, dz = alvo.z - j.z, d = Math.hypot(dx, dz);
    if (d < (ia.rota.length > 1 ? 1.2 : 0.35)) { ia.rota.shift(); ia.preso = 0; ia.longe = Infinity; return; }
    // não chega mais perto (algo no caminho): depois de 3 s aparece no ponto (melhor que ficar empurrando a parede)
    if (d < ia.longe - 0.05) { ia.longe = d; ia.preso = 0; } else if ((ia.preso += dt) > 3) { this.teleportes = (this.teleportes | 0) + 1; Object.assign(j, { x: alvo.x, z: alvo.z, y: this.terreno.altura(alvo.x, alvo.z) }); ia.rota.shift(); ia.preso = 0; ia.longe = Infinity; return; }
    const corre = d + ia.rota.length * 8 > 14;
    j.entrada = { mx: dx / d * (d < 1 ? Math.max(0.4, d) : 1), mz: dz / d * (d < 1 ? Math.max(0.4, d) : 1), correr: corre };
  },
  // ---------- conversa (só o dono) ----------
  // m = { acao: 'oi' | 'casa' | 'ajuda' | 'dar' | 'time' | 'dungeon' | 'troca' | 'tchau' }
  conversaAmiga(id, m) {
    const j = this.jogadores.get(id), a = this.amiga;
    if (!j || !a || id !== this.amigaDono || !m || typeof m.acao !== 'string') return;
    if (Math.hypot(a.x - j.x, a.z - j.z) > 4.5) return this.evento({ t: 'aviso', para: id, texto: `Chegue mais perto de ${AMIGA.nome}` });
    const F = AMIGA.falas, diga = (texto, extra = {}) => this.evento({ t: 'fala', para: id, npc: AMIGA.id, texto, pedido: a.pedido ? { k: a.pedido.k, n: a.pedido.n, nome: ITENS[a.pedido.k].nome } : null, amizade: a.amizade | 0, noTime: !!(a.time && a.time === j.time), ...extra });
    const nomeItem = (p) => `${p.n} ${ITENS[p.k].nome.toLowerCase()}`;
    a.ia.conversaAte = m.acao === 'tchau' ? 0 : this.tempo + AMIGA.conversa;
    if (a.ia.fase === 'trabalhar') { a.ia.ate = Math.max(a.ia.ate, this.tempo); } // larga o trabalho na hora e volta depois
    const L = this.loteDaAmiga(), pronta = L && AMIGA.casa.every((c) => L.pecas.some((o) => mesmaPeca(o, pecaDaCasa(L.def, c))));
    switch (m.acao) {
      case 'oi': return diga(sorteia(F.oi));
      case 'casa': return diga(pronta ? sorteia(F.pronta) : sorteia(F.obra));
      case 'horta': return diga(sorteia(F.horta));
      case 'time': {
        if (a.time && a.time === j.time) return diga(sorteia(F.jaNoTime));
        if ((a.ia.recusaAte || 0) > this.tempo) return diga(F.recusa.jaFalei);
        const v = this.vontadeAmiga(a, j);
        if (Math.random() >= v.p) { a.ia.recusaAte = this.tempo + AMIGA.time.esperaRecusa; return diga(F.recusa[v.motivo] || F.recusa.vontade); }
        if (!this.entrarTimeAmiga(a, j)) { a.ia.recusaAte = this.tempo + 5; return diga(F.recusa.cheio); }
        a.ia.conversaAte = this.tempo + 2;
        return diga(sorteia(F.time), { time: true });
      }
      case 'dungeon': return diga(sorteia(F.dungeon));
      case 'troca': { const r = this.abrirTrocaAmiga(j); return diga(r === true ? sorteia(AMIGA.falasTroca.abre) : r); }
      case 'tchau': return diga(sorteia(F.tchau));
      case 'sair': { // o dono tira ela do time pela conversa
        if (a.time && a.time === j.time) { a.ia.noTime = false; this.sairDoTime(a, `${AMIGA.nome} saiu do time`); a.ia.fase = 'pensar'; this.pocoesAmiga(a); }
        return diga(F.voltou);
      }
      case 'ajuda': {
        if (!a.pedido && Math.random() < 0.7) { const p = sorteia(AMIGA.pedidos); a.pedido = { k: p.k, n: p.n }; this.guardarAmiga(); }
        return diga(a.pedido ? sorteia(F.pedido).replace('{item}', nomeItem(a.pedido)) : sorteia(F.semPedido));
      }
      case 'dar': {
        const p = a.pedido; if (!p) return diga(sorteia(F.semPedido));
        if (contar(j.prog.mochila, p.k) < p.n) return diga(sorteia(F.falta).replace('{item}', nomeItem(p)));
        tirar(j.prog.mochila, p.k, p.n);
        guardar(a.prog.mochila, { k: p.k, n: p.n });
        // paga com o que colheu (o que tiver mais) ou em ouro
        let paga = '';
        const colheita = AMIGA.plantas.map((k) => [k, contar(a.prog.mochila, k)]).sort((x, y) => y[1] - x[1])[0];
        if (colheita && colheita[1] > 0) {
          const n = Math.min(colheita[1], 4), prova = j.prog.mochila.map((o) => (o ? { ...o } : null));
          if (guardar(prova, { k: colheita[0], n })) { j.prog.mochila = prova; tirar(a.prog.mochila, colheita[0], n); paga = `${n} ${ITENS[colheita[0]].nome.toLowerCase()}`; }
        }
        if (!paga) { const ouro = Math.max(5, (ITENS[p.k].venda || 2) * p.n * 2); j.prog.ouro += ouro; paga = `${ouro} de ouro`; }
        a.amizade = (a.amizade | 0) + 1; a.pedido = null;
        this.guardarAmiga();
        this.avisarProg(j);
        return diga(sorteia(F.obrigada).replace('{paga}', paga));
      }
    }
  },
  // ---------- fase 2: time e combate (André 2026-11-09) ----------
  // fala dela que aparece para o dono mesmo sem a janela aberta (aviso no topo)
  falarAmiga(texto) { if (this.amigaDono) this.evento({ t: 'fala', para: this.amigaDono, npc: AMIGA.id, texto: `${AMIGA.nome}: ${texto}` }); },
  // completa as poções dela até AMIGA.time.pocoes (ela passa na Rosa quando volta para casa)
  pocoesAmiga(j) {
    const falta = AMIGA.time.pocoes - contar(j.prog.mochila, 'pocao');
    if (falta > 0) guardar(j.prog.mochila, { k: 'pocao', n: falta });
  },
  // vontade de entrar no time (0 a 1) e o motivo mais forte contra. Regras com sorteio, sem IA paga.
  vontadeAmiga(a, dono) {
    const R = AMIGA.time, contra = [];
    let p = R.base + Math.min(R.amizadeMax, (a.amizade | 0) * R.porAmizade);
    if (a.vida < a.vidaMax * 0.5) contra.push(['cansada', R.cansada]);
    const L = this.loteDaAmiga(), agora = Date.now();
    if (L && Object.values(L.horta).some((t) => { if (!t.c) return false; crescerPlanta(t, agora); return fasePlanta(t.g / PLANTAS[t.c].G) >= 4 || !(t.w && agora < t.w + REGA_MS); })) contra.push(['horta', R.horta]);
    if (ehNoite(horaDoJogo(dono.prog.dia))) contra.push(['noite', R.noite]);
    const dif = (dono.prog.nivel | 0) - (a.prog.nivel | 0) - R.nivelLivre;
    if (dif > 0 && R.perigoMax > 0) contra.push(['perigo', Math.min(R.perigoMax, dif * R.porNivel)]);
    for (const [, n] of contra) p -= n;
    contra.sort((x, y) => y[1] - x[1]);
    return { p: Math.max(R.min, Math.min(R.max, p)), motivo: contra[0]?.[0] || 'vontade' };
  },
  // entra no time do dono (o mesmo time de jogadores: XP dividido, barras e pontos no minimapa). false = não coube
  entrarTimeAmiga(a, dono) {
    let T = dono.time;
    if (!T) { T = { lider: dono.id, membros: [dono.id] }; dono.time = T; (this.times ||= new Set()).add(T); }
    if (T.membros.length >= TIME.max) return false;
    T.membros.push(a.id); a.time = T;
    for (const k of T.membros) if (k !== a.id) this.evento({ t: 'aviso', para: k, texto: `${AMIGA.nome} entrou no time` });
    Object.assign(a.ia, { fase: 'seguir', chegou: null, preso: 0, noTime: true });
    this.mudouTime(T);
    return true;
  },
  // o monstro que ela vai bater: o mais perto dela entre os que estão perto do dono, quando alguém do time está lutando
  alvoAmiga(j, dono) {
    if (!this.emCombate(dono) && !this.emCombate(j)) return null;
    let melhor = null, md = Infinity;
    for (const e of this.inimigosDe(j)) {
      if (e.treino || Math.hypot(e.x - dono.x, e.z - dono.z) > AMIGA.time.ajudar) continue;
      const d = Math.hypot(e.x - j.x, e.z - j.z); if (d < md) { md = d; melhor = e; }
    }
    return melhor;
  },
  passoTimeAmiga(j, dono, dt) {
    const R = AMIGA.time, ia = j.ia, d = Math.hypot(dono.x - j.x, dono.z - j.z);
    // ficou muito para trás (o dono voltou para a vila, disparou no lobo...): chega correndo atrás dele
    if (d > R.longe || (dono.caverna && !j.caverna && d > 8)) {
      const ang = dono.ry + Math.PI + 0.6, x = dono.x + Math.sin(ang) * 2, z = dono.z + Math.cos(ang) * 2;
      Object.assign(j, { x, z, y: dono.y, vy: 0, chao: true, caverna: dono.caverna ? { desde: this.tempo } : j.caverna });
      return this.pararAmiga(j);
    }
    if (j.trava > 0) return this.pararAmiga(j);
    const alvo = this.alvoAmiga(j, dono);
    // montaria: monta quando o dono monta (e desce para lutar)
    const monta = !!dono.montado && !alvo;
    if (monta !== !!j.montado) j.montado = monta ? (MONTARIAS[dono.montado] ? dono.montado : 'lobo') : null;
    // vida baixa: poção (a recarga é a do jogo); sem poção e quase caindo, foge para perto do dono
    if (j.vida < j.vidaMax * R.pocao && (ia.pocaoT || 0) <= this.tempo && (j.pocaoAte?.pocao || 0) <= this.tempo) {
      const i = j.prog.mochila.findIndex((o) => o?.k === 'pocao');
      if (i >= 0) { ia.pocaoT = this.tempo + 2; this.item(j.id, { acao: 'usar', i }); }
    }
    const semPocao = !j.prog.mochila.some((o) => o?.k === 'pocao');
    if (alvo && !(semPocao && j.vida < j.vidaMax * R.fugir)) {
      const da = Math.hypot(alvo.x - j.x, alvo.z - j.z);
      if (da > 1.9) return this.irDireto(j, alvo.x, alvo.z, da > 4);
      this.pararAmiga(j);
      j.ry = Math.atan2(alvo.x - j.x, alvo.z - j.z);
      // de vez em quando uma skill de espada da barra dela (1 a 4); no resto, o combo do golpe
      if (this.tempo >= (ia.skillT || 0)) {
        ia.skillT = this.tempo + R.skill * (0.7 + Math.random() * 0.6);
        const k = 1 + Math.floor(Math.random() * 4), h = j.build[k - 1];
        if (h && (j.cds[h] || 0) <= this.tempo) return this.usarHabilidade(j.id, k);
      }
      return this.usarHabilidade(j.id, 0);
    }
    // seguindo: fica um pouco atrás e do lado dele
    const ang = dono.ry + Math.PI + 0.7, px = dono.x + Math.sin(ang) * R.seguir, pz = dono.z + Math.cos(ang) * R.seguir;
    const dp = Math.hypot(px - j.x, pz - j.z);
    if (dp < 0.6 || (d < R.seguir + 0.8 && !dono.montado)) return this.pararAmiga(j);
    this.irDireto(j, px, pz, dp > R.correr || !!dono.montado);
  },
  irDireto(j, x, z, correr) {
    const dx = x - j.x, dz = z - j.z, d = Math.hypot(dx, dz) || 1;
    j.entrada = { mx: dx / d, mz: dz / d, correr };
  },
  // ---------- chat de longe (André 2026-11-09): mensagem privada como uma pessoa, ela chama o André também ----------
  // O servidor (server/index.js) entrega a mensagem do André e escolhe quem pensa a resposta: a IA grátis (server/ia-amiga.js,
  // quando tem chave) ou as regras daqui (assuntoAmiga). Os dois caminhos acabam em respostaAmiga, que faz a ação e manda
  // a fala depois de um tempinho "digitando". Ela só fala com o dono.
  assuntoAmiga(texto) {
    const t = ' ' + String(texto).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    const A = AMIGA.chat.assuntos, tem = (k) => A[k].some((w) => t.includes(' ' + w.trim() + ' ') || (w.includes(' ') && t.includes(w.trim())));
    const ia = this.amiga?.ia;
    if (this.amiga?.troca) { if (tem('presente')) return 'presente'; if (tem('pedirItem')) return 'pedirItem'; } // janela de troca aberta (fase 3)
    for (const k of ['sairTime', 'vir', 'time']) if (tem(k)) return k;
    if (ia?.chamado && ia.chamado.ate > this.tempo) { if (tem('nao')) return 'nao'; if (tem('sim')) return 'sim'; } // resposta ao chamado dela
    for (const k of ['tchau', 'comoVai', 'ajuda', 'dungeon', 'piada', 'obrigado', 'elogio', 'casa', 'horta', 'troca', 'oi']) if (tem(k)) return k;
    return 'naoEntendi';
  },
  // o que a IA precisa saber dela agora (vai no pedido para a IA, junto com as últimas mensagens)
  contextoAmiga(id) {
    const a = this.amiga, j = this.jogadores.get(id); if (!a || !j || id !== this.amigaDono) return null;
    const L = this.loteDaAmiga(), pronta = L && AMIGA.casa.every((c) => L.pecas.some((o) => mesmaPeca(o, pecaDaCasa(L.def, c))));
    return {
      nome: AMIGA.nome, amigo: j.nome, amizade: a.amizade | 0, nivel: a.prog.nivel, nivelAmigo: j.prog.nivel,
      noTime: !!(a.time && a.time === j.time), distancia: Math.round(Math.hypot(a.x - j.x, a.z - j.z)),
      fazendo: a.time ? 'caçando no time com ele' : a.ia.fase === 'trabalhar' ? (a.ia.anim === 'construir' ? 'construindo a casa' : 'cuidando da horta') : a.ia.fase === 'andar' ? 'passeando pela vila' : 'descansando na porta de casa',
      casaPronta: !!pronta, noite: ehNoite(horaDoJogo(j.prog.dia)), pedido: a.pedido ? `${a.pedido.n} ${ITENS[a.pedido.k].nome}` : null,
      chamou: a.ia.chamado && a.ia.chamado.ate > this.tempo ? a.ia.chamado.quer : null,
      ouro: a.prog.ouro | 0,
      mochila: Object.entries(a.prog.mochila.reduce((m, o) => { if (o) m[ITENS[o.k]?.nome || o.k] = (m[ITENS[o.k]?.nome || o.k] || 0) + (o.n || 1); return m; }, {})).slice(0, 15).map(([k, n]) => `${n} ${k}`).join(', '),
      conversa: (a.ia.conversaChat || []).slice(-8),
    };
  },
  // a resposta: r = { assunto } (regras) ou { assunto: ação da IA, fala } (IA). Faz a ação e responde.
  respostaAmiga(id, r) {
    const a = this.amiga, j = this.jogadores.get(id); if (!a || !j || id !== this.amigaDono || !r) return;
    const F = AMIGA.chat.falas, FA = AMIGA.falas, ia = a.ia, noTime = !!(a.time && a.time === j.time);
    const perto = Math.hypot(a.x - j.x, a.z - j.z) < 6;
    const chamado = ia.chamado && ia.chamado.ate > this.tempo ? ia.chamado : null;
    let fala = '';
    switch (r.assunto) {
      case 'time': {
        if (noTime) { fala = sorteia(FA.jaNoTime); break; }
        if (a.morto) { fala = FA.caiu; break; }
        const pediu = chamado?.quer === 'time'; // ela que chamou: aceita sem sorteio
        if (!pediu && (ia.recusaAte || 0) > this.tempo) { fala = FA.recusa.jaFalei; break; }
        const v = this.vontadeAmiga(a, j);
        if (!pediu && Math.random() >= v.p) { ia.recusaAte = this.tempo + AMIGA.time.esperaRecusa; fala = FA.recusa[v.motivo] || FA.recusa.vontade; break; }
        if (!this.entrarTimeAmiga(a, j)) { fala = FA.recusa.cheio; break; }
        ia.chamado = null; ia.vir = null;
        fala = sorteia(FA.time) + (perto ? '' : ' Tô indo aí!');
        break;
      }
      case 'sairTime':
        if (noTime) { ia.noTime = false; this.sairDoTime(a, `${AMIGA.nome} saiu do time`); ia.fase = 'pensar'; this.pocoesAmiga(a); fala = FA.voltou; }
        else fala = 'Ué, eu nem tô no seu time! Quer que eu entre?';
        break;
      case 'vir': {
        if (noTime || perto) { fala = sorteia(F.perto); break; }
        if (a.morto) { fala = FA.caiu; break; }
        const pediu = chamado && chamado.quer !== 'time';
        if (!pediu && Math.random() >= Math.min(0.95, this.vontadeAmiga(a, j).p + 0.2)) { fala = sorteia(F.naoVir); break; }
        ia.vir = { ate: this.tempo + 120, longe: this.tempo + 4 }; ia.chamado = null; ia.conversaAte = 0;
        fala = sorteia(F.vir);
        break;
      }
      case 'sim':
        if (chamado?.quer === 'time') return this.respostaAmiga(id, { assunto: 'time', fala: r.fala });
        if (chamado?.quer === 'ajuda') { ia.chamado = null; return this.respostaAmiga(id, { assunto: 'ajuda', fala: r.fala }); }
        ia.chamado = null; fala = chamado?.quer === 'vir' ? 'Oba! Te espero aqui na horta.' : sorteia(F.chamaRespostaSim);
        break;
      case 'nao': ia.chamado = null; fala = sorteia(F.chamaRespostaNao); break;
      case 'ajuda':
        if (!a.pedido && Math.random() < 0.7) { const p = sorteia(AMIGA.pedidos); a.pedido = { k: p.k, n: p.n }; this.guardarAmiga(); }
        fala = a.pedido ? sorteia(FA.pedido).replace('{item}', `${a.pedido.n} ${ITENS[a.pedido.k].nome.toLowerCase()}`) + ' Me entrega quando passar aqui!' : sorteia(FA.semPedido);
        break;
      case 'casa': { const L = this.loteDaAmiga(), pronta = L && AMIGA.casa.every((c) => L.pecas.some((o) => mesmaPeca(o, pecaDaCasa(L.def, c)))); fala = sorteia(pronta ? FA.pronta : FA.obra); break; }
      case 'troca': { const t = this.abrirTrocaAmiga(j); fala = t === true ? sorteia(AMIGA.falasTroca.abre) : t; r = { ...r, fala: '' }; break; }
      case 'presente': case 'pedirItem': { const ult = [...(ia.conversaChat || [])].reverse().find((c) => c.de === 'ele'); fala = this.pedidoTrocaAmiga(r.assunto, ult?.texto || ''); r = { ...r, fala: '' }; break; }
      case 'horta': case 'dungeon': fala = sorteia(FA[r.assunto]); break;
      default: fala = sorteia(F[r.assunto] || F.naoEntendi);
    }
    // a IA escreve a fala dela; a ação continua sendo decidida aqui (ela pode recusar mesmo que a IA queira aceitar)
    const recusou = (r.assunto === 'time' && !(a.time && a.time === j.time)) || (r.assunto === 'vir' && !ia.vir && !perto && !noTime);
    if (r.fala && !recusou) fala = r.fala;
    this.dizerAmiga(fala);
  },
  // manda a mensagem dela no chat privado depois de uns segundos (fila em ia.chatFila)
  dizerAmiga(texto, agora = false) {
    const a = this.amiga; if (!a || !texto) return;
    const [d0, d1] = AMIGA.chat.digitando, ultimo = (a.ia.chatFila || []).reduce((m, x) => Math.max(m, x.t), this.tempo);
    (a.ia.chatFila ||= []).push({ t: agora ? this.tempo : ultimo + d0 + Math.random() * (d1 - d0) + Math.min(2, texto.length / 60), texto: String(texto).slice(0, 300) });
  },
  // o André escreveu para ela (o servidor chama depois de entregar a mensagem dele)
  ouvirAmiga(id, texto) {
    const a = this.amiga; if (!a || id !== this.amigaDono) return;
    const c = (a.ia.conversaChat ||= []); c.push({ de: 'ele', texto: String(texto).slice(0, 200) }); if (c.length > 12) c.shift();
  },
  passoChatAmiga(a) {
    const ia = a.ia, dono = this.jogadores.get(this.amigaDono); if (!dono) return;
    // as respostas na hora certa
    while (ia.chatFila?.length && ia.chatFila[0].t <= this.tempo) {
      const { texto } = ia.chatFila.shift();
      const msg = { canal: 'pm', c: AMIGA.conta, nome: AMIGA.nome, texto, hora: Date.now(), alvo: dono.conta, alvoNome: dono.nome };
      const c = (ia.conversaChat ||= []); c.push({ de: 'ela', texto }); if (c.length > 12) c.shift();
      if (this.aoChatAmiga) this.aoChatAmiga(msg); else this.receberChat(msg);
    }
    // ela chama o André de vez em quando (longe, fora do time, viva, sem conversa esperando)
    const C = AMIGA.chat.chamar, sorte = ([x, y]) => x + Math.random() * (y - x);
    if (ia.chamaEm == null) ia.chamaEm = this.tempo + sorte(C.primeiro);
    if (this.tempo < ia.chamaEm) return;
    ia.chamaEm = this.tempo + sorte(C.entre);
    if (a.morto || a.time || ia.vir || (ia.chamado && ia.chamado.ate > this.tempo) || Math.hypot(a.x - dono.x, a.z - dono.z) < C.longe) return;
    if (dono.morto || dono.criando) return;
    const ch = sorteia(AMIGA.chat.falas.chama);
    ia.chamado = { quer: ch.quer, ate: this.tempo + C.espera };
    this.dizerAmiga(ch.texto, true);
  },
  // indo até o André: perto anda/corre; muito longe (outra parte do mapa) chega correndo depois de uns segundos, como no time
  virAmiga(j, dono, dt) {
    const ia = j.ia, v = ia.vir, d = Math.hypot(dono.x - j.x, dono.z - j.z);
    if (this.tempo > v.ate || dono.morto) { ia.vir = null; this.pararAmiga(j); ia.fase = 'pensar'; return false; }
    if (d < 2.8) {
      ia.vir = null; this.pararAmiga(j); ia.fase = 'pensar'; ia.viu = true;
      ia.conversaAte = this.tempo + AMIGA.conversa; j.ry = Math.atan2(dono.x - j.x, dono.z - j.z);
      this.dizerAmiga(sorteia(AMIGA.chat.falas.chegou));
      return true;
    }
    if ((d > AMIGA.time.longe || (dono.caverna && !j.caverna)) && this.tempo >= v.longe) {
      const ang = dono.ry + Math.PI + 0.6, x = dono.x + Math.sin(ang) * 3, z = dono.z + Math.cos(ang) * 3;
      Object.assign(j, { x, z, y: dono.y, vy: 0, chao: true, caverna: dono.caverna ? { desde: this.tempo } : j.caverna });
      return true;
    }
    ia.fase = 'vir';
    this.irDireto(j, dono.x, dono.z, d > 5);
    return true;
  },
  // ---------- fase 3: mochila, ouro e troca (André 2026-11-09) ----------
  // arruma a mochila: veste a peça melhor, guarda o que serve e vende o resto (ela passa na Rosa: preço normal de venda)
  arrumarMochilaAmiga(j) {
    const p = j.prog, nota = (it) => (it ? it.r * 100 + (it.e || 0) * 10 - (it.d || 0) : -1);
    for (let i = 0; i < p.mochila.length; i++) {
      const it = itemValido(p.mochila[i]); if (!it || !ehEquip(it.k)) continue;
      const l = ITENS[it.k].lugar;
      if (l === 'cajado' || !Object.hasOwn(p.equip, l) || !reforcoOk(it, p.atr)) continue;
      if (nota(it) > nota(p.equip[l])) this.item(j.id, { acao: 'equipar', i }); // a peça velha volta pra mochila e é vendida abaixo
    }
    const guarda = (it) => it.cad || it.k === 'pocao' || it.k.startsWith('semente_') || AMIGA.plantas.includes(it.k) || AMIGA.pedidos.some((o) => o.k === it.k) || ITENS[it.k].comida;
    let ouro = 0, vendeu = 0;
    for (let i = 0; i < p.mochila.length; i++) {
      const it = itemValido(p.mochila[i]); if (!it) continue;
      if (it.k === 'tomo') { this.item(j.id, { acao: 'usar', i }); if (!p.mochila[i]) continue; } // tomo de espada que ela pode ler
      if (it.k === 'pocao' && it.n > AMIGA.mochila.pocoes) { const n = it.n - AMIGA.mochila.pocoes; ouro += precoVenda(it) * n; p.mochila[i].n -= n; vendeu++; continue; }
      if (guarda(it) || ITENS[it.k].usar?.veiculo) continue;
      ouro += precoVenda(it) * (it.n || 1); p.mochila[i] = null; vendeu++;
    }
    if (vendeu) { p.ouro += ouro; this.aplicarStatus(j); }
    this.guardarAmiga();
    return { vendeu, ouro };
  },
  // o dono quer trocar: abre a janela normal de troca. true = abriu; senão a fala do porquê
  abrirTrocaAmiga(dono) {
    const a = this.amiga, F = AMIGA.falasTroca;
    if (!a || !dono || dono.id !== this.amigaDono) return F.ocupada;
    if (a.troca && a.troca === dono.troca) return true;
    if (a.morto || a.troca || dono.troca || dono.morto || dono.criando || this.emCombate(a) || this.emCombate(dono)) return F.ocupada;
    if (Math.hypot(a.x - dono.x, a.z - dono.z) > AMIGA.troca.longe) return F.longe;
    this.pararAmiga(a);
    Object.assign(a.ia, { trocaT: this.tempo + AMIGA.troca.pensar, trocaPresente: false, trocaDisse: '' });
    this.abrirTroca(dono, a);
    return true;
  },
  // o servidor mexeu na troca dela (enviarTroca): pensa de novo daqui a pouco
  mexeuTrocaAmiga() { const a = this.amiga; if (a?.troca && a.ia.trocaT == null) a.ia.trocaT = this.tempo + AMIGA.troca.pensar; },
  // valor de venda do que está na mesa (itens) de um lado
  valorMesa(of) { return of.itens.reduce((s, e) => { const it = itemValido(JSON.parse(e.chave)); return s + (it ? precoVenda(it) * e.n : 0); }, 0); },
  passoTrocaAmiga(a) {
    const T = a.troca, ia = a.ia, dono = this.jogadores.get(T.a === a.id ? T.b : T.a);
    this.pararAmiga(a);
    if (dono) a.ry = Math.atan2(dono.x - a.x, dono.z - a.z);
    if (!dono || ia.trocaT == null || this.tempo < ia.trocaT) return;
    ia.trocaT = null; // o que ela mexer agora (enviarTroca) marca outra pensada
    const R = AMIGA.troca, F = AMIGA.falasTroca, eu = T.of[a.id], ele = T.of[dono.id];
    const margem = Math.max(R.margemMin, R.margem - (a.amizade | 0) * R.porAmizade);
    const pede = Math.ceil(this.valorMesa(eu) * margem), traz = this.valorMesa(ele) + ele.ouro;
    const dizer = (t) => { if (t && t !== ia.trocaDisse) { ia.trocaDisse = t; this.falarAmiga(t); } };
    // o ouro dela: paga pelo que ele trouxe (menos o que ele já deve pelo que pegou); presente = não paga nada
    const ouro = ia.trocaPresente ? 0 : Math.max(0, Math.min(a.prog.ouro, Math.floor(traz - pede)));
    if (eu.tranca && eu.ouro === ouro) {
      // já trancou: confirma quando ele também trancar
      if (ele.tranca && !eu.ok) {
        this.troca(a.id, { acao: 'confirmar' }); // se ele já confirmou, fecha aqui (trocaFeitaAmiga)
      }
      return;
    }
    if (eu.tranca) this.troca(a.id, { acao: 'trancar', v: false });
    if (eu.ouro !== ouro) { this.troca(a.id, { acao: 'ouro', n: ouro }); if (ouro > 0) dizer(F.pago.replace('{ouro}', ouro)); }
    if (!pede && !traz) return; // mesa vazia: espera
    if (traz < pede) return dizer(F.falta.replace('{falta}', pede - traz));
    if (ia.trocaPresente && traz > 0 && !pede) dizer(F.presente);
    this.troca(a.id, { acao: 'trancar', v: true });
  },
  // a troca com ela fechou (concluirTroca): presente sobe a amizade; guarda o que ela tem
  trocaFeitaAmiga(T) {
    const a = this.amiga, eu = T.of[a.id], ele = T.of[T.a === a.id ? T.b : T.a];
    const presente = !eu.itens.length && !eu.ouro && (ele.itens.length || ele.ouro);
    if (presente) { a.amizade = (a.amizade | 0) + 1; this.falarAmiga(AMIGA.falasTroca.obrigada); } else this.falarAmiga(sorteia(AMIGA.falasTroca.feita));
    a.ia.trocaT = null;
    this.guardarAmiga();
  },
  // pelo chat com a troca aberta: "quero 3 cenouras" (ela põe na mesa) ou "é presente" (ela não paga)
  pedidoTrocaAmiga(assunto, texto) {
    const a = this.amiga, F = AMIGA.falasTroca; if (!a?.troca) return sorteia(AMIGA.falas.troca);
    if (assunto === 'presente') { a.ia.trocaPresente = true; a.ia.trocaT = this.tempo + 0.3; return F.presente; }
    const norm = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
    const t = ' ' + norm(texto) + ' ', num = Number((t.match(/ (\d{1,3}) /) || [])[1]) || 0;
    const p = a.prog.mochila, achados = [];
    for (let i = 0; i < p.length; i++) {
      const it = itemValido(p[i]); if (!it || it.cad) continue;
      const nome = norm(ehEquip(it.k) ? ITENS[it.k].nome : nomeDoItem(it)), base = nome.replace(/s$/, '');
      if (t.includes(' ' + base) && !achados.some((x) => x.k === it.k)) achados.push({ i, k: it.k, it });
    }
    if (!achados.length) return F.naoTenho;
    const postos = [];
    for (const { i, it } of achados) {
      const n = Math.min(it.n || 1, num || it.n || 1);
      this.troca(a.id, { acao: 'por', i, n });
      postos.push(`${n} ${nomeDoItem(it).toLowerCase()}`);
    }
    const preco = Math.ceil(this.valorMesa(a.troca.of[a.id]) * Math.max(AMIGA.troca.margemMin, AMIGA.troca.margem - (a.amizade | 0) * AMIGA.troca.porAmizade));
    a.ia.trocaT = this.tempo + AMIGA.troca.pensar;
    return F.pus.replace('{item}', postos.join(', ')).replace('{preco}', preco);
  },
};

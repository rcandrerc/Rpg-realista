// Missão do Clã: Escolta (André 2026-11-23). Os recrutas de nível baixo não ganham quase XP caçando junto com o líder
// ("a diferença é grande"); bônus parado ele não quis ("queria algo mais ativo e difícil") e o líder bater menos também
// não ("não faz sentido"): "poderia ser uma missão de escolta ou farm, que aí meu nível não influenciaria tanto".
//
// O líder abre no Baú do Clã (a cada CLA.missao.entre). Os recrutas que estão perto precisam chegar vivos ao totem
// mais perto que fica a pelo menos destMin m da base, em até dura s. No caminho, emboscadas (em pontos da viagem) com
// monstros no nível do líder que vão PRIMEIRO nos recrutas; o líder bate normal, e o monstro que ele acerta passa a ir
// nele por provoca s (segurar o monstro). Recruta que cai sai sem prêmio; todos caídos ou o tempo acabou: falhou.
// Chegou: cada recruta de pé ganha CLA.missao.xp do XP do nível dele (não importa quem matou), o cofre ganha ouro e o
// líder ganha Fragmento de Alma. Igual para todos os clãs: o líder bot abre a escolta dele também (missaoClaNpc).
import { CLA, TOTENS, TIPOS_INIMIGO, almaDe } from './dados.js';
import { guardar, xpProximo } from './progresso.js';
import { fundoAgua } from './transporte.js';

const M_ = () => CLA.missao;
const r2 = (v) => Math.round(v * 100) / 100;

export const MissaoCla = {
  // a missão de que o monstro é (null: monstro comum)
  missaoDoMob(c) { return c?.sp?.missao ? this.missoesCla?.get(c.sp.missao) || null : null; },
  // quem o monstro da escolta enxerga: os recrutas; o líder só se acabou de bater nele (segurou o monstro)
  alvosMissao(M, b) {
    const L = this.jogadores.get(M.lider);
    if (L && !L.morto && b && (b.provocaAte || 0) > this.tempo) return [L];
    const l = [];
    for (const id of M.rec) { const a = this.jogadores.get(id); if (a && !a.morto) l.push(a); }
    if (!l.length && L && !L.morto) l.push(L);
    return l;
  },
  // o líder acertou um monstro da escolta: ele vira para o líder por um tempo
  provocouMissao(alvo, de) {
    const M = this.missaoDoMob(alvo); if (M && de && de.id === M.lider) alvo.provocaAte = this.tempo + M_().provoca;
  },
  // falta quanto para poder abrir de novo (ms, 0 = pode)
  esperaMissaoCla(B) { return Math.max(0, (B?.missaoOk || 0) + M_().entre - Date.now()); }, // só a escolta cumprida conta as 6 h (André 2026-11-23: falhou, tenta de novo na hora)
  // o que o painel do clã mostra
  missaoInfo(B) {
    if (!B) return null;
    const M = this.missoesCla?.get(B.k);
    return M ? { ativa: 1, dest: M.dest.nome, x: M.dest.x, z: M.dest.z, emb: M.emb, embs: M_().emboscadas.length, falta: Math.max(0, Math.round(M.ate - this.tempo)), rec: M.rec.size }
      : { ativa: 0, espera: this.esperaMissaoCla(B) };
  },
  // o destino: o totem mais perto que fica a pelo menos destMin m da base
  destinoMissao(B) {
    let melhor = null, md = Infinity;
    for (const T of TOTENS.lista) { const d = Math.hypot(T.x - B.x, T.z - B.z); if (d >= M_().destMin && d < md) { md = d; melhor = T; } }
    return melhor && { x: melhor.x, z: melhor.z, nome: melhor.nome, d: md };
  },
  // pedido do app (cla { acao: 'missao' }) ou do líder bot
  iniciarMissaoCla(j, aviso, B, ctxs) {
    const Mc = M_();
    if (!B) return aviso('Funde a base do clã primeiro: a escolta sai do Baú do Clã');
    this.missoesCla ||= new Map();
    if (this.missoesCla.has(B.k)) return aviso('A escolta do clã já está acontecendo');
    if (this.baseTravada?.(B)) return aviso('Pague a taxa da base primeiro');
    const bau = this.bauBase?.(B) || B;
    if (Math.hypot(j.x - bau.x, j.z - bau.z) > Mc.abrir) return aviso('Abra a escolta no Baú do Clã, na base');
    const espera = this.esperaMissaoCla(B);
    if (espera > 0) { const h = Math.floor(espera / 3600e3), m = Math.ceil((espera % 3600e3) / 60e3); return aviso(`A próxima missão do clã abre em ${h ? h + ' h ' : ''}${m} min`); }
    const rec = ctxs.map((x) => x.amiga).filter((a) => a && !a.morto && Math.hypot(a.x - j.x, a.z - j.z) <= Mc.perto).slice(0, Mc.maxRec);
    if (!rec.length) return aviso(`Traga os recrutas: a escolta precisa de pelo menos 1 recruta a até ${Mc.perto} m`);
    const dest = this.destinoMissao(B); if (!dest) return aviso('Nenhum totem longe o bastante para a escolta');
    const M = { k: B.k, lider: j.id, x0: B.x, z0: B.z, dest, nv: Math.max(1, j.prog.nivel | 0), emb: 0, rec: new Set(rec.map((a) => a.id)), mobs: new Set(), ate: this.tempo + Mc.dura };
    this.missoesCla.set(B.k, M);
    B.missaoEm = Date.now(); this.salvarBases?.();
    // os recrutas andam junto com o líder (jogador: entram no time dele; bot: protegem o líder)
    for (const x of ctxs) {
      const a = x.amiga; if (!a || !M.rec.has(a.id)) continue;
      if (j.bot) { if (a.ia) a.ia.funcao = { k: 'proteger', p: 'lider' }; }
      else if (!(a.time && a.time === j.time)) { if (a.time) this.sairDoTime?.(a, ''); x.entrarTimeAmiga?.(a, j); }
    }
    this.avisoMissao(M, `Escolta do Clã: leve os recrutas vivos até ${dest.nome} (${Math.round(dest.d)} m) em ${Math.round(Mc.dura / 60)} min. Vai ter emboscada, e os monstros vão primeiro neles!`);
    if (!j.bot) this.evento({ t: 'missaoCla', para: j.id, x: dest.x, z: dest.z, nome: dest.nome, emb: 0, embs: Mc.emboscadas.length, falta: Mc.dura });
    return M;
  },
  // o contador da onda na tela (André 2026-11-23: "apareceu um contador na tela... 0/12... 12/12"): para o líder e
  // os jogadores da escolta, ao nascer a onda e a cada monstro que cai
  placarMissao(M) {
    const ev = { emb: M.emb, embs: M_().emboscadas.length, mortos: M.onda.mortos, n: M.onda.n, x: M.dest.x, z: M.dest.z, nome: M.dest.nome, falta: Math.max(0, Math.round(M.ate - this.tempo)) };
    for (const id of [M.lider, ...M.rec]) { const o = this.jogadores.get(id); if (o && !o.bot) this.evento({ t: 'missaoCla', para: id, ...ev }); }
  },
  avisoMissao(M, texto) {
    for (const id of [M.lider, ...M.rec]) { const o = this.jogadores.get(id); if (o && !o.bot) this.evento({ t: 'aviso', para: id, texto }); }
  },
  // o meio dos recrutas que ainda estão na escolta
  meioRecrutas(M) {
    let x = 0, z = 0, n = 0;
    for (const id of M.rec) { const a = this.jogadores.get(id); if (a && !a.morto) { x += a.x; z += a.z; n++; } }
    return n ? { x: x / n, z: z / n } : null;
  },
  // uma emboscada: os monstros nascem à frente e dos lados dos recrutas, a "longe" m
  emboscadaMissao(M, P) {
    const Mc = M_(), O = Mc.emboscadas[M.emb], ult = M.emb === Mc.emboscadas.length - 1;
    const rumo = Math.atan2(M.dest.x - P.x, M.dest.z - P.z);
    const lista = [...Array(O.n)].map((_, i) => O.tipos[i % O.tipos.length]);
    if (ult) lista.push(Mc.chefe.tipo);
    lista.forEach((tipo, i) => {
      const chefe = ult && i === lista.length - 1;
      let q = null;
      for (let k = 0; k < 12 && !q; k++) {
        const a = rumo + (i - (lista.length - 1) / 2) * 0.5 + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * 0.35, x = P.x + Math.sin(a) * Mc.longe, z = P.z + Math.cos(a) * Mc.longe;
        if (fundoAgua(x, z) <= 0.05) q = { x: r2(x), z: r2(z) };
      }
      if (!q) q = { x: r2(P.x + Math.sin(rumo) * Mc.longe), z: r2(P.z + Math.cos(rumo) * Mc.longe) };
      const e = this.criarInimigo({ tipo, nivel: M.nv + (chefe ? Mc.chefe.nv : 0), x: q.x, z: q.z, missao: M.k, v: this.vagaMissao() });
      const f = chefe ? Mc.chefe : Mc;
      e.vidaMax = Math.round(e.vidaMax * f.vida); e.vida = e.vidaMax; e.dano = Math.round((e.dano || TIPOS_INIMIGO[tipo].dano) * f.dano);
      if (chefe) Object.assign(e, { nome: Mc.chefe.nome, esc: Mc.chefe.escala });
      M.mobs.add(e);
    });
    M.emb++;
    M.onda = { n: M.mobs.size, mortos: 0 };
    this.placarMissao(M);
    this.avisoMissao(M, ult ? `Emboscada! ${Mc.chefe.nome} veio junto. Protejam os recrutas!` : `Emboscada ${M.emb} de ${Mc.emboscadas.length}! Protejam os recrutas!`);
  },
  // um lugar v livre para o monstro da emboscada (o app desenha por ele); todos ocupados: -1 (só no servidor)
  vagaMissao() {
    const v0 = this.vMissao ?? -1; if (v0 < 0) return -1;
    const usados = new Set(this.inimigos.map((e) => e.v));
    for (let v = v0; v < v0 + M_().vagas; v++) if (!usados.has(v)) return v;
    return -1;
  },
  // o monstro da escolta caiu: o corpo some (não volta)
  mobMissaoMorreu(c) {
    const M = this.missaoDoMob(c); if (M) { M.mobs.delete(c); if (M.onda) { M.onda.mortos++; this.placarMissao(M); } }
    this.depois(3, () => { const i = this.inimigos.indexOf(c); if (i >= 0) this.inimigos.splice(i, 1); });
  },
  fimMissaoCla(M, venceu, porque = '') {
    const Mc = M_();
    this.missoesCla.delete(M.k);
    for (const e of M.mobs) { const i = this.inimigos.indexOf(e); if (i >= 0) this.inimigos.splice(i, 1); this.evento({ t: 'nevoa_some', x: r2(e.x), y: r2(e.y || 0), z: r2(e.z) }); }
    const L = this.jogadores.get(M.lider);
    if (L && !L.bot && !venceu) this.evento({ t: 'missaoCla', para: L.id, fim: 1 });
    if (!venceu) return this.avisoMissao(M, `Escolta do Clã falhou${porque ? ': ' + porque : ''}. Pode tentar de novo agora, no Baú do Clã.`);
    const Bk = this.basesCla?.[M.k]; if (Bk) { Bk.missaoOk = Date.now(); this.salvarBases?.(); }
    const nomes = [], subiu = [];
    for (const id of M.rec) {
      const a = this.jogadores.get(id); if (!a || a.morto) continue;
      const nv0 = a.prog.nivel | 0;
      this.ganharXP(a, Math.round(xpProximo(nv0) * Mc.xp)); nomes.push(a.nome);
      subiu.push({ nome: a.nome, de: nv0, nv: a.prog.nivel | 0 });
    }
    const ouro = Mc.cofre * nomes.length * Math.max(1, Math.round(M.nv / 10));
    if (L && !L.bot && L.prog.cla) { L.prog.cla.cofre = (L.prog.cla.cofre | 0) + ouro; this.logCla?.(L.prog.cla, 'Escolta do Clã', ouro); L.progSujo = true; }
    else if (L) L.prog.ouro = (L.prog.ouro | 0) + ouro;
    let alma = '';
    if (L) { const k = almaDe(this.racaDe?.(L)); if (guardar(L.prog.mochila, { k, n: Mc.alma })) alma = ` e ${Mc.alma} Fragmento de Alma para o líder`; L.progSujo = true; }
    // a tela de missão concluída do app, igual às outras missões (André 2026-11-23: "mostrar a tela de recompensa...
    // todos que estiverem no time ganharam um nível, parabéns"): cada recruta pelo nome
    if (L && !L.bot) this.evento({ t: 'missaoCla', para: L.id, fim: 1, ok: 1, nome: M.dest.nome, subiu, ouro, alma: alma ? Mc.alma : 0 });
    this.avisoMissao(M, `Escolta do Clã cumprida! ${nomes.join(', ')} ganharam 1 nível de XP; +${ouro} de ouro no cofre${alma}.`);
    if (L && !L.bot) this.historia?.(L, 'escolta'); // Ato do Clã: "A primeira escolta"
    if (L && !L.bot) this.avisarProg(L);
  },
  // Clãs bot (regra do André: todo recurso de clã é igual para jogador e bot): a cada CLA.missao.entre o líder bot faz a
  // escolta dele com os recrutas que estão no mundo. Perto de um jogador (botVista m) ela acontece de verdade, com as
  // emboscadas (o líder e os recrutas lutam como sempre); longe de todo mundo, a viagem é contada (como o trabalho fora
  // dos recrutas): cada recruta chega vivo com botChega de chance, e o prêmio é o mesmo do jogador.
  missaoClaNpc(C, L, ctxs) {
    const Mc = M_(), B = this.basesCla?.['n' + C.id];
    if (!B || !L || L.morto || this.missoesCla?.has(B.k) || this.esperaMissaoCla(B) > 0 || this.baseTravada?.(B)) return;
    const rec = ctxs.map((x) => x.amiga).filter((a) => a && !a.morto);
    if (!rec.length) return;
    const dest = this.destinoMissao(B); if (!dest) return;
    // todos iguais (André 2026-11-23: "todos online, se tiver algum jogador online"): com jogador no servidor, a escolta é
    // de verdade em qualquer lugar do mapa; contada só sem ninguém (aí nem passo tem)
    const visto = this.genteOnline(); // jogador ou painel do clã aberto (André 2026-11-24)
    if (visto) { // de verdade: o líder vai para o Baú do Clã e abre como um jogador
      const bau = this.bauBase?.(B) || B;
      if (Math.hypot(L.x - bau.x, L.z - bau.z) <= Mc.abrir) this.iniciarMissaoCla(L, () => {}, B, ctxs);
      return;
    }
    this.missoesCla ||= new Map();
    B.missaoEm = Date.now(); this.salvarBases?.();
    const M = { k: B.k, lider: L.id, x0: B.x, z0: B.z, dest, nv: L.prog.nivel | 0, emb: Mc.emboscadas.length, rec: new Set(rec.filter(() => Math.random() < Mc.botChega).map((a) => a.id)), mobs: new Set(), ate: 0 };
    this.missoesCla.set(B.k, M);
    this.fimMissaoCla(M, M.rec.size > 0, 'nenhum recruta chegou');
  },
  // a cada passo (barato: quase sempre não tem missão)
  passoMissoesCla() {
    if (!this.missoesCla?.size) return;
    const Mc = M_();
    for (const M of [...this.missoesCla.values()]) {
      const L = this.jogadores.get(M.lider);
      if (!L) { this.fimMissaoCla(M, false, 'o líder saiu'); continue; }
      for (const id of [...M.rec]) {
        const a = this.jogadores.get(id);
        if (!a || a.morto) { M.rec.delete(id); this.avisoMissao(M, `${a?.nome || 'Um recruta'} caiu e saiu da escolta`); }
        else if (Math.hypot(a.x - L.x, a.z - L.z) > Mc.fugiu) { M.rec.delete(id); this.avisoMissao(M, `${a.nome} ficou longe do líder e saiu da escolta`); }
      }
      if (!M.rec.size) { this.fimMissaoCla(M, false, 'nenhum recruta chegou'); continue; }
      if (this.tempo > M.ate) { this.fimMissaoCla(M, false, 'o tempo acabou'); continue; }
      for (const e of [...M.mobs]) if (!this.inimigos.includes(e)) M.mobs.delete(e);
      const P = this.meioRecrutas(M); if (!P) continue;
      // chegou: todos os recrutas que sobraram perto do totem (com a emboscada da vez já vencida)
      const vivos = [...M.rec].map((id) => this.jogadores.get(id));
      if (!M.mobs.size && M.emb >= Mc.emboscadas.length && vivos.every((a) => Math.hypot(a.x - M.dest.x, a.z - M.dest.z) <= Mc.chegou)) { this.fimMissaoCla(M, true); continue; }
      // emboscadas pelo caminho: cada uma quando os recrutas passam do pedaço dela da viagem
      const tot = Math.hypot(M.dest.x - M.x0, M.dest.z - M.z0), feito = 1 - Math.hypot(M.dest.x - P.x, M.dest.z - P.z) / tot;
      if (M.emb < Mc.emboscadas.length && !M.mobs.size && feito >= Mc.emboscadas[M.emb].em) this.emboscadaMissao(M, P);
    }
  },
};

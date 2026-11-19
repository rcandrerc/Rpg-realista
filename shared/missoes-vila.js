// Missões das vilas (plano v3 do Presidente, 19/11/2026; texto aprovado no doc "Ato VII e missões das vilas"): 3 por
// vila (MISSOES_VILA em shared/dados.js), com etapas iguais às da história (shared/historia.js: etapasDe, casaEtapa,
// totalEtapa). Uma missão de vila por vez, além da história. A missão aparece quando o herói tem o nível dela e a
// região da vila já abriu (VILAS_MISSAO[vila].zona, a névoa da história); em cada vila, uma depois da outra.
// NASCE DESLIGADO: liga sozinho em MISSOES_VILA_LIGA.desde (o lançamento); a conta de teste (CONTA_TESTE.missoes) e o
// robô de testes veem antes. A 3ª do Rio Claro (liga: 'bandeiras') liga junto com as Bandeiras da guerra
// (bandeirasLigadas em shared/guerra.js, frente 4), não por data. Feitas as 3 de uma vila: título "Amigo do/da ..."
// (+2% na venda, nada de combate). Kira, Rufo e Lis (Geada, NPCs) fazem sozinhos as da faixa deles, menos as do Rio Claro.
// Estado na conta: prog.vila = { f: [ids feitas], at: id aceita, e: etapa da vez, n: quanto já fez dela, m: pistas
// vistas (bits), s: { id: etapa } das que o herói deixou no meio (pega de novo dali) }.
// O app (online.gd, missao_vila.gd, menu.gd aba Vilas) recebe o resumo em prog.vi (vilaInfo) e manda 'missao_vila'
// ({ acao: 'ver' | 'ir' | 'desistir' }) e 'falar' com { npc, vila: true } (o botão "Vila: ..." na janela do NPC).
import { MISSOES_VILA, VILAS_MISSAO, MISSOES_VILA_LIGA, HISTORIA_PREMIO, CONTA_TESTE, ITENS, TOTENS, COLETA, CHEFES_HISTORIA, TITULOS, LOJA_DISTANCIA } from './dados.js';
import { etapasDe, casaEtapa, totalEtapa, liberado, zonaFechadaEm } from './historia.js';
import { xpProximo, contar, tirar, horaDoJogo, ehNoite, guardarQueCabe } from './progresso.js';
import * as G from './guerra.js'; // bandeirasLigadas (frente 4): enquanto não existe, a 3ª do Rio Claro fica desligada

const r2 = (n) => Math.round(n * 100) / 100;
const LIGA_MS = Date.parse(MISSOES_VILA_LIGA.desde);
export const MISSAO_VILA = new Map(MISSOES_VILA.map((M) => [M.id, M]));
// em cada vila, na ordem do nível (a 2ª só depois da 1ª)
export const MISSOES_DA_VILA = {};
for (const M of MISSOES_VILA) (MISSOES_DA_VILA[M.vila] ||= []).push(M);
for (const L of Object.values(MISSOES_DA_VILA)) L.sort((a, b) => a.nv - b.nv);

// as 3 da vila já feitas? (título "Amigo do/da ..."; progresso.js titulosNovos também usa)
export const vilaCompleta = (p, vila) => !!MISSOES_DA_VILA[vila]?.length && MISSOES_DA_VILA[vila].every((M) => p?.vila?.f?.includes(M.id));

// confere o que veio da conta (progressoValido): só ids que existem, sem repetir; a aceita não pode estar feita
export function vilaValida(v) {
  if (!v || typeof v !== 'object') return null;
  const f = Array.isArray(v.f) ? [...new Set(v.f.filter((id) => typeof id === 'string' && MISSAO_VILA.has(id)))] : [];
  const r = { f };
  if (typeof v.at === 'string' && MISSAO_VILA.has(v.at) && !f.includes(v.at)) {
    const L = etapasDe(MISSAO_VILA.get(v.at)), e = Number.isInteger(v.e) ? Math.max(0, Math.min(L.length - 1, v.e)) : 0;
    Object.assign(r, { at: v.at, e, n: Number.isInteger(v.n) ? Math.max(0, Math.min(totalEtapa(L[e]), v.n)) : 0, m: Number.isInteger(v.m) ? v.m & 0xffff : 0 });
  }
  if (v.s && typeof v.s === 'object') {
    const s = {};
    for (const [id, e] of Object.entries(v.s)) if (MISSAO_VILA.has(id) && !f.includes(id) && id !== r.at && Number.isInteger(e) && e > 0) s[id] = Math.min(e, etapasDe(MISSAO_VILA.get(id)).length - 1);
    if (Object.keys(s).length) r.s = s;
  }
  return f.length || r.at || r.s ? r : null;
}

// o que vai para o app (habilidades.json, chave "vilas"): as vilas com missão e as missões com as etapas (aba Vilas)
export const missoesVilaParaApp = () => ({
  vilas: Object.keys(MISSOES_DA_VILA).map((id) => { const V = VILAS_MISSAO[id]; return { id, nome: V.nome, zona: V.zona, titulo: V.titulo }; }),
  missoes: MISSOES_VILA.map((M) => ({ id: M.id, vila: M.vila, nv: M.nv, npc: M.npc, nome: M.nome, total: etapasDe(M).length, etapas: etapasDe(M).map((E) => E.txt) })),
});

const fimDaMissao = (v) => { delete v.at; delete v.e; delete v.n; delete v.m; };
// a fala de quando entrega: a da última etapa (se tiver) e o "pronto" da missão (o inglês tem a frase inteira)
export const falaFimVila = (M, Efim = etapasDe(M).at(-1)) => [Efim?.fala, M.pronto].filter(Boolean).join(' ');

export const MissoesVila = {
  // conta de teste do André e robô de testes: veem as missões de vila antes do lançamento (e as que esperam evento)
  vilaAntes(j) { return !!j && ((j.testador && CONTA_TESTE.missoes) || !!j.robo); },
  // as missões de vila estão ligadas para j?
  temVilas(j) { return !!j?.prog && (this.vilaAntes(j) || this.agoraMs() >= LIGA_MS); },
  // a missão M já pode sair? (a 3ª do Rio Claro espera as Bandeiras da guerra)
  missaoVilaLigada(j, M) {
    if (M.liga !== 'bandeiras') return true;
    return this.vilaAntes(j) || (typeof G.bandeirasLigadas === 'function' && !!G.bandeirasLigadas(this.agoraMs()));
  },
  // como está a missão M para j: f feita, a aceita, p pode pegar, o antes vem outra da mesma vila, z região fechada,
  // n falta nível, e esperando o evento (Bandeiras). A aba Vilas mostra uma letra por missão (vilaInfo.s).
  estadoVila(j, M) {
    const p = j.prog, v = p.vila;
    if (v?.f?.includes(M.id)) return 'f';
    if (v?.at === M.id) return 'a';
    const L = MISSOES_DA_VILA[M.vila], i = L.indexOf(M);
    if (i > 0 && !v?.f?.includes(L[i - 1].id)) return 'o';
    if (!liberado(p, VILAS_MISSAO[M.vila].zona)) return 'z';
    if ((p.nivel | 0) < M.nv) return 'n';
    if (!this.missaoVilaLigada(j, M)) return 'e';
    return 'p';
  },
  missaoVilaDe(j) { const at = j?.prog?.vila?.at; return at ? MISSAO_VILA.get(at) || null : null; },
  etapaVila(j) { const M = this.missaoVilaDe(j); return M ? etapasDe(M)[j.prog.vila.e | 0] || null : null; },
  // Tocou em "Vila: ..." na janela do NPC (falar com m.vila): pegar a missão dele, cumprir a etapa de falar (com a fala
  // e os itens que ele pega), entregar ou lembrar o que falta. Devolve true se o NPC falou de missão de vila.
  falaVila(j, npc, diga) {
    if (!this.temVilas(j) || j.bot) return false;
    const p = j.prog, v = (p.vila ||= { f: [] }), M = this.missaoVilaDe(j);
    if (M) {
      const L = etapasDe(M), E = L[v.e | 0], ex = { missao: 'vila:' + M.id };
      if (E?.ev === 'falar' && E.npc === npc.id) {
        if (E.entregar) {
          const falta = Object.entries(E.entregar).filter(([k, n]) => contar(p.mochila, k) < n);
          if (falta.length) { diga(this.lembraHistoria(M, E, `Ainda falta: ${falta.map(([k, n]) => `${ITENS[k].nome} ${contar(p.mochila, k)}/${n}`).join(', ')}.`), ex); return true; }
          for (const [k, n] of Object.entries(E.entregar)) tirar(p.mochila, k, n);
          j.progSujo = true;
        }
        if ((v.e | 0) >= L.length - 1) { this.concluirVila(j, M, diga, E); return true; }
        if (E.fala) diga(E.fala, ex);
        this.proximaEtapaVila(j);
        return true;
      }
      if (M.npc !== npc.id) return false;
      diga(this.lembraHistoria(M, E, `Falta: ${this.textoEtapaVila(j)}.`), ex); // quem deu a missão lembra o porquê e o que falta
      return true;
    }
    // sem missão de vila aceita: o NPC dá a dele (a que já pode sair)
    const N = MISSOES_VILA.find((o) => o.npc === npc.id && this.estadoVila(j, o) === 'p');
    if (!N) return false;
    const e0 = v.s?.[N.id] | 0; // deixou no meio antes: pega de novo da etapa onde parou (o que já entregou fica entregue)
    if (v.s) { delete v.s[N.id]; if (!Object.keys(v.s).length) delete v.s; }
    Object.assign(v, { at: N.id, e: Math.min(e0, etapasDe(N).length - 1), n: 0, m: 0 }); j.progSujo = true;
    this.evento({ t: 'aviso', para: j.id, texto: 'Missão de vila: ' + N.nome });
    diga(N.pedido, { missao: 'vila:' + N.id });
    if (!this.checarVila(j)) this.avisarProg(j);
    return true;
  },
  // algo aconteceu com j (o mesmo ev/d da história, Simulacao.historia): conta na etapa da missão de vila se casar
  contarVila(j, ev, d = {}) {
    if (!j?.prog?.vila?.at || j.bot || !this.temVilas(j)) return;
    const v = j.prog.vila, E = this.etapaVila(j); if (!E || E.ev === 'falar') return;
    let add = casaEtapa(E, ev, d);
    // vender vários de uma vez: vale se um dos itens vendidos é o pedido
    if (!add && E.ev === 'vender' && ev === 'vender' && E.k && Array.isArray(d.ks) && d.ks.some((k) => [].concat(E.k).includes(k))) add = 1;
    if (!add) return;
    // "Venda um peixe para o Zeca": a venda conta só perto de quem a etapa pede (alvo 'npc:...')
    if (E.ev === 'vender' && typeof E.alvo === 'string' && E.alvo.startsWith('npc:')) {
      const n = (this.mapa.npcs || []).find((o) => o.id === E.alvo.slice(4));
      if (n && Math.hypot(n.x - j.x, n.z - j.z) > LOJA_DISTANCIA + 1.5) return;
    }
    const t = totalEtapa(E);
    v.n = Math.min(t, (v.n | 0) + add); j.progSujo = true;
    if (v.n >= t) return this.proximaEtapaVila(j);
    this.evento({ t: 'aviso', para: j.id, texto: `${E.txt} (${v.n}/${t})` });
    this.avisarProg(j);
  },
  proximaEtapaVila(j) {
    const v = j.prog.vila, M = this.missaoVilaDe(j); if (!M) return;
    const L = etapasDe(M), E = L[v.e | 0];
    if (E?.diz) this.evento({ t: 'aviso', para: j.id, texto: E.diz });
    v.e = (v.e | 0) + 1; v.n = 0; v.m = 0; j.progSujo = true;
    const N = L[v.e];
    if (!N) return this.concluirVila(j, M, null);
    this.evento({ t: 'etapa_vila', para: j.id, id: M.id, txt: N.txt, e: v.e, total: L.length });
    if (!this.checarVila(j)) this.avisarProg(j);
  },
  // a etapa da vez já está feita? (itens na mochila, noite, lugar, pistas). Avança se sim.
  checarVila(j) {
    const p = j.prog, v = p.vila, E = this.etapaVila(j); if (!E) return false;
    let feito = false;
    if (E.ev === 'ter') {
      const n = Object.entries(E.itens).reduce((a, [k, q]) => a + Math.min(q, contar(p.mochila, k)), 0);
      if (n !== v.n) { v.n = n; j.progSujo = true; this.avisarProg(j); }
      feito = n >= totalEtapa(E);
    } else if (E.ev === 'noite') feito = ehNoite(horaDoJogo(p.dia));
    else if (E.ev === 'pos' && !j.morto) {
      const [x, z, r] = E.pos;
      if (Math.hypot(j.x - x, j.z - z) <= r) {
        const falta = Object.entries(E.gasta || {}).filter(([k, n]) => contar(p.mochila, k) < n);
        if (!falta.length) { for (const [k, n] of Object.entries(E.gasta || {})) tirar(p.mochila, k, n); feito = true; }
        else if (!(j.vilaFaltaT > this.tempo)) { // chegou sem o que a etapa gasta (a lenha da fogueira): avisa de vez em quando
          j.vilaFaltaT = this.tempo + 6;
          this.evento({ t: 'aviso', para: j.id, texto: `Falta: ${falta.map(([k, n]) => `${ITENS[k].nome} ${contar(p.mochila, k)}/${n}`).join(', ')}.` });
        }
      }
    } else if (E.ev === 'pistas' && !j.morto) {
      E.pontos.forEach(([x, z, nome], i) => {
        if (v.m & (1 << i) || Math.hypot(j.x - x, j.z - z) > 3.5) return;
        v.m |= 1 << i; v.n = Math.min(E.pontos.length, (v.n | 0) + 1); j.progSujo = true;
        this.evento({ t: 'aviso', para: j.id, texto: `Pista: ${nome} (${v.n}/${E.pontos.length})` });
        this.avisarProg(j);
      });
      feito = v.n >= E.pontos.length;
    }
    if (feito) this.proximaEtapaVila(j);
    return feito;
  },
  // missão de vila entregue: ouro e XP como uma missão comum da história (HISTORIA_PREMIO), o presente, a fala do fim
  // (a da última etapa e o "pronto" juntos, numa fala só: na janela da missão a linha depois do \n é a do "falta") e,
  // com as 3 da vila, o título "Amigo do/da ..."
  concluirVila(j, M, diga, Efim = null) {
    const p = j.prog, v = p.vila;
    if (!v.f.includes(M.id)) v.f.push(M.id);
    fimDaMissao(v); j.progSujo = true;
    const P = HISTORIA_PREMIO, ouro = P.ouroEtapa * M.nv;
    p.ouro = (p.ouro || 0) + ouro; this.caixa?.(j, 'missao', ouro);
    this.evento({ t: 'aviso', para: j.id, texto: `Missão de vila cumprida: ${M.nome} (+${ouro} de ouro)` });
    if (M.presente) this.darItens(j, M.presente);
    const fim = falaFimVila(M, Efim);
    if (diga && fim) diga(fim, { missao: 'vila:' + M.id });
    else if (M.pronto) this.evento({ t: 'aviso', para: j.id, texto: `${this.nomeNpc(M.npc)}: ${M.pronto}` });
    this.evento({ t: 'vila_feita', para: j.id, id: M.id, vila: M.vila });
    const V = VILAS_MISSAO[M.vila];
    if (V && TITULOS[V.titulo] && vilaCompleta(p, M.vila)) this.ganharTitulo(j, V.titulo);
    this.ganharXP(j, Math.round(xpProximo(M.nv) * P.xpEtapa));
    const N = MISSOES_VILA.find((o) => this.estadoVila(j, o) === 'p');
    if (N) this.evento({ t: 'aviso', para: j.id, texto: `Próxima missão de vila: fale com ${this.nomeNpc(N.npc)}` });
    this.avisarProg(j);
  },
  // texto da etapa da vez com o andamento ("Pesque 3 peixes para a banca (1/3)")
  textoEtapaVila(j) {
    const v = j.prog.vila, E = this.etapaVila(j); if (!E) return '';
    let txt = `${E.txt} (${v.n | 0}/${totalEtapa(E)})`;
    if (E.ev === 'noite') { const hr = horaDoJogo(j.prog.dia); txt += ` · agora são ${String(Math.floor(hr)).padStart(2, '0')}h`; }
    return txt;
  },
  // para onde o "Ir" da missão de vila leva: { x, z, nome, npc } ou null. caro = false: sem procurar recurso e spot (o
  // resumo que vai a cada progresso); o "Ir" de verdade (acao 'ir') procura.
  alvoVila(j, caro = true) {
    const p = j.prog, v = p.vila, E = this.etapaVila(j); if (!E) return null;
    const aberto = (x, z) => !zonaFechadaEm(p, x, z);
    const npcEm = (id) => { const n = (this.mapa.npcs || []).find((o) => o.id === id); return n ? { x: r2(n.x), z: r2(n.z), nome: n.nome.split(',')[0], npc: n.id } : null; };
    if (E.ev === 'falar') return npcEm(E.npc);
    if (E.ev === 'pistas') { const i = E.pontos.findIndex((q, k) => !(v.m & (1 << k))); const q = E.pontos[Math.max(0, i)]; return { x: q[0], z: q[1], nome: q[2], npc: '' }; }
    if (E.ev === 'pos') return { x: E.pos[0], z: E.pos[1], nome: E.txt, npc: '' };
    if (E.hc) {
      const C = CHEFES_HISTORIA[E.hc], b = this.inimigos.find((o) => o.hc === E.hc && !o.morto);
      if (b) return { x: r2(b.x), z: r2(b.z), nome: C.nome, npc: '' };
      const c = this.cacaDef(C?.campo); return c ? { x: c.x, z: c.z, nome: c.nome || C.nome, npc: '' } : null;
    }
    let a = E.alvo;
    if (a && typeof a === 'object') { const k = Object.keys(a).find((q) => contar(p.mochila, q) < (E.itens?.[q] || 1)); a = a[k || Object.keys(a)[0]]; }
    if (typeof a !== 'string') return null;
    if (a === 'spot') {
      if (!caro) return null;
      let b = null, md = Infinity, L = null, mdL = Infinity;
      const barco = j.veiculo === 'barquinho' || j.veiculo === 'navio';
      for (const s of this.spots || []) {
        if (s.tipo !== 'comum' || (!s.lago && !barco)) continue; // o do mar fica longe da margem: só de barco
        if (s.lago && aberto(s.lago.x, s.lago.z)) { const d = Math.hypot(s.lago.x - j.x, s.lago.z - j.z); if (d < mdL) { mdL = d; L = s.lago; } }
        if (!s.ativo || !aberto(s.x, s.z)) continue;
        const d = Math.hypot(s.x - j.x, s.z - j.z); if (d < md) { md = d; b = s; }
      }
      if (b) return { x: r2(b.x), z: r2(b.z), nome: 'o spot de pesca', npc: '' };
      return L ? { x: r2(L.x), z: r2(L.z), nome: 'a água', npc: '' } : null; // nenhum spot aceso agora: a água mais perto (acende logo)
    }
    const [tipo, id] = a.split(':');
    if (tipo === 'npc') return npcEm(id);
    if (tipo === 'totem') { const t = TOTENS.lista.find((o) => o.id === id); return t ? { x: t.x, z: t.z, nome: 'o totem de ' + t.nome, npc: '' } : null; }
    if (tipo === 'estacao') { const S = (this.mapa.estacoes || []).find((o) => o.id === id); return S ? { x: r2(S.x), z: r2(S.z), nome: S.nome, npc: '', estacao: S.id } : null; }
    if (tipo === 'caca') { const c = this.cacaDef(id); return c ? { x: c.x, z: c.z, nome: c.nome || 'o campo', npc: '' } : null; }
    if (tipo === 'veio' && caro) {
      let b = null, md = Infinity;
      for (const no of this.coletaveis.values()) {
        if (no.tipo !== id || !aberto(no.x, no.z)) continue;
        const d = Math.hypot(no.x - j.x, no.z - j.z); if (d < md && this.cargas(j, no) > 0) { md = d; b = no; }
      }
      return b ? { x: r2(b.x), z: r2(b.z), nome: COLETA[b.tipo]?.nome || 'o recurso', npc: '' } : null;
    }
    return null;
  },
  // o que o app mostra (vai junto do progresso, prog.vi): s = uma letra por missão de MISSOES_VILA (estadoVila); a = a
  // aceita (cartão âmbar e o "Ir"); dar = quem tem missão de vila para dar agora (npc -> nome, o botão "Vila: ...")
  vilaInfo(j) {
    if (j.bot || !this.temVilas(j)) return null;
    const v = j.prog.vila, M = this.missaoVilaDe(j), s = MISSOES_VILA.map((o) => this.estadoVila(j, o)).join('');
    if (!M) return { s, a: null, dar: Object.fromEntries(MISSOES_VILA.filter((o, i) => s[i] === 'p').map((o) => [o.npc, o.nome])) };
    const L = etapasDe(M), E = L[v.e | 0];
    return { s, dar: {}, a: { id: M.id, nome: M.nome, vila: M.vila, txt: this.textoEtapaVila(j), e: v.e | 0, total: L.length, dono: M.npc,
      npc: E?.ev === 'falar' ? E.npc : '', alvo: this.alvoVila(j, false), marca: !!E?.marca || E?.ev === 'pistas' } };
  },
  // mensagem do app: { acao: 'ver' | 'ir' | 'desistir' }; só a conta de teste e o robô: 'zerar' (todas do começo) e,
  // só o robô, 'pular' (a da vez fica feita, sem prêmio)
  missaoVila(id, m) {
    const j = this.jogadores.get(id); if (!j || j.bot || !m || !this.temVilas(j)) return;
    const p = j.prog, v = (p.vila ||= { f: [] }), aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if (m.acao === 'ver') return this.avisarProg(j);
    if (m.acao === 'ir') {
      if (!v.at) return;
      const a = this.alvoVila(j, true);
      if (!a) return aviso('Dá para fazer aqui mesmo');
      return this.evento({ t: 'vila_ir', para: id, id: v.at, alvo: a });
    }
    if (m.acao === 'desistir') {
      const M = this.missaoVilaDe(j); if (!M) return;
      if ((v.e | 0) > 0) (v.s ||= {})[M.id] = v.e | 0; // pegando de novo, volta desta etapa
      fimDaMissao(v); j.progSujo = true;
      aviso(`Missão de vila deixada: ${M.nome}. Para voltar, fale com ${this.nomeNpc(M.npc)}`);
      return this.avisarProg(j);
    }
    if (!this.vilaAntes(j)) return;
    if (m.acao === 'zerar') { p.vila = { f: [] }; j.progSujo = true; aviso('Teste: missões de vila zeradas'); return this.avisarProg(j); }
    if (m.acao === 'pular' && j.robo && v.at) { v.f.push(v.at); fimDaMissao(v); j.progSujo = true; return this.avisarProg(j); }
  },
  // a cada meio segundo: etapas de lugar, noite e mochila; o chefe da missão de vila aparece para quem chega no campo
  // dele; e os NPCs da Geada conferem as missões da faixa deles (a cada 30 s)
  passoVila(dt) {
    this.vilaT = (this.vilaT || 0) - dt; if (this.vilaT > 0) return;
    this.vilaT = 0.5;
    for (const j of this.jogadores.values()) {
      if (j.criando || !j.prog) continue;
      if (j.bot) { if (!(j.vilaNpcT > this.tempo)) { j.vilaNpcT = this.tempo + 30; this.vilaNpc(j); } continue; }
      if (!j.prog.vila?.at || !this.temVilas(j)) continue;
      const E = this.etapaVila(j); if (!E) continue;
      if (E.ev === 'ter' || E.ev === 'noite' || E.ev === 'pos' || E.ev === 'pistas') this.checarVila(j);
      if (E.hc) this.chamarChefe(j, E.hc);
    }
  },
  // Kira, Rufo e Lis (Geada; Presidente 19/11): fazem sozinhos as missões de vila da faixa deles, menos as do Rio Claro,
  // na ordem de cada vila, quando o nível chega. Ouro, presente e título entram quietos; o XP de todas vem de uma vez
  // (sem entrar aqui de novo pelo ganharXP). Chamado ao subir de nível (ganharXP) e a cada 30 s (passoVila). Devolve
  // quantas fez.
  vilaNpc(j) {
    if (!j?.bot || j.vilaNpcAndando || this.racaDe(j) !== 'geada' || !(this.agoraMs() >= LIGA_MS)) return 0;
    const p = j.prog; if (!p) return 0;
    const v = (p.vila ||= { f: [] }), P = HISTORIA_PREMIO;
    let xp = 0, n = 0;
    for (const [vila, L] of Object.entries(MISSOES_DA_VILA)) {
      if (vila === 'rio_claro') continue; // as do Rio Claro são da Chama (o Pacto, a rede, a bandeira)
      for (const M of L) {
        if (v.f.includes(M.id)) continue;
        if ((p.nivel | 0) < M.nv) break; // em ordem: a próxima desta vila espera o nível
        v.f.push(M.id); n++;
        const ouro = P.ouroEtapa * M.nv; p.ouro = (p.ouro || 0) + ouro; this.caixa?.(j, 'missao', ouro);
        for (const [k, q] of Object.entries(M.presente || {})) if (ITENS[k] && p.mochila) guardarQueCabe(p.mochila, typeof q === 'object' ? { k, r: q.r ?? 0 } : { k, n: q });
        xp += Math.round(xpProximo(M.nv) * P.xpEtapa);
      }
      const V = VILAS_MISSAO[vila];
      if (V && TITULOS[V.titulo] && vilaCompleta(p, vila)) this.ganharTitulo(j, V.titulo, true);
    }
    if (!n) return 0;
    j.progSujo = true;
    j.vilaNpcAndando = true;
    try { if (xp) this.ganharXP(j, xp); } finally { j.vilaNpcAndando = false; }
    return n;
  },
};

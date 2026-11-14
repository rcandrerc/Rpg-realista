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
// - this.amigaDono: id da sessão de quem ela acompanha agora (time, coleta, troca, "vem cá").
// - this.amigaFalam: quem pode conversar com ela (André 2026-11-10: quem colou a chave Groq no jogo e as contas de teste).
//   Ela não é de ninguém: livre, passa a acompanhar quem falar com ela; ocupada, diz que está com outro amigo.
//   A amizade é de cada um (j.amizades[conta]); j.amizade é a de quem ela acompanha agora.
// - L.amiga (o terreno dela): { prog, amizade, pedido } guardado junto com o terreno no banco (server/contas.js).
// - j.ia: o que ela está fazendo agora { fase, alvo, rota, ate, ... } (não vai para o banco).
import { CEREBRO, NPC_VIDA, HEROI, HABILIDADES, CURA, CONSTRUCOES, PLANTAS, HORTA, VILA_LOTES, CASA, ITENS, TIME, MONTARIAS, fasePlanta, COLETA, PESCA, FERRAMENTAS_FAZENDA, TIPOS_INIMIGO } from './dados.js';
import { noLago, AGUA } from './relevo.js';
import { planejarRota } from './rota.js';
import { decidir, ordenarRegras, limites, escolherArma, validarRegra, juntarDica } from './cerebro.js';
import { HISTORIA } from './dados.js';
import { HABS, barraValida, PONTOS_POR_NIVEL, xpProximo, guardar, contar, tirar, horaDoJogo, ehNoite, liberarPaginas, vigorAgora, profNivel, precoVenda, ehEquip, itemValido, reforcoOk, nomeItem as nomeDoItem, pecasGastas, durab as durabilidade } from './progresso.js';
import { motivoPeca, motivoTerreno, crescerPlanta, retPeca } from './simulacao.js';

const sorteia = (l) => l[Math.floor(Math.random() * l.length)];
const normAmiga = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const PASSEIOS = [[-6, -10.5], [-8.6, -9.4], [-2.5, -6], [1, 0.5], [-4, 2], [-1, 12]]; // praça, Rosa, ferraria, entrada
const REGA_MS = HORTA.rega * 3600000;

// peça da casa da lista AMIGA.casa no mundo (o terreno começa em x0, z0)
export function pecaDaCasa(def, c) {
  const [k, dx, dz, lado] = c, T = CONSTRUCOES[k]?.tipo;
  let x = def.x0 + dx, z = def.z0 + dz, r = 0;
  if (T === 'borda') {
    const g = CASA.grade / 2;
    if (lado === 'n') z -= g; else if (lado === 's') z += g; else if (lado === 'o') { x -= g; r = 1; } else { x += g; r = 1; }
  } else r = (lado | 0) & 3;
  return { k, x, z, r };
}
const chavePeca = (p) => `${p.k}:${p.x},${p.z}`;
export const mesmaPeca = (a, b) => a.k === b.k && Math.abs(a.x - b.x) < 0.01 && Math.abs(a.z - b.z) < 0.01 && (a.r & 1) === (b.r & 1);

// número fixo de cada NPC (do id): o atraso, o lugar na vila e o sorteio do campo saem dele, sempre iguais para o mesmo NPC
export function hashNpc(id) { let h = 2166136261; for (const c of String(id)) h = Math.imul(h ^ c.charCodeAt(0), 16777619) >>> 0; return h; }
// a rotina dele (NPC_VIDA.rotina) com o atraso só dele (até NPC_VIDA.atraso h depois do horário)
export function rotinaDe(id) {
  const R = { ...NPC_VIDA.rotina.padrao, ...(NPC_VIDA.rotina[id] || {}) }, h = hashNpc(id);
  R.saiDe = (R.sai + ((h % 1000) / 1000) * NPC_VIDA.atraso) % 24;
  R.voltaDe = (R.volta + (((h >> 10) % 1000) / 1000) * NPC_VIDA.atraso * 0.6) % 24;
  return R;
}
// a hora do jogo está dentro do horário dele? (volta antes de sai = caça de noite, vira a meia-noite)
export function naHoraDe(R, hora) { return R.saiDe < R.voltaDe ? hora >= R.saiDe && hora < R.voltaDe : hora >= R.saiDe || hora < R.voltaDe; }

// Progresso do aventureiro que não está no mundo (André 2026-11-12: "só deixa eles independentes quando eu estiver
// offline"): o mesmo XP lento do offlineAmiga (NPC_VIDA.offline), direto no save, sem corpo no servidor. Nunca passa do
// teto (o jogador mais alto). Devolve quantos níveis subiu.
export function xpOfflineNpc(prog, desde, teto = null, agora = Date.now()) {
  const O = NPC_VIDA.offline; if (!prog || !Number.isFinite(desde)) return 0;
  const cap = teto ?? Infinity, n0 = prog.nivel | 0;
  prog.nivel = Math.max(1, prog.nivel | 0); prog.xp = Math.max(0, +prog.xp || 0); prog.pontos = prog.pontos | 0;
  const horas = Math.min(O.maxDias * 24, Math.max(0, (agora - desde) / 3600000)) * O.horasPorDia / 24;
  for (let h = horas; h > 0 && prog.nivel < cap; h -= 1) {
    prog.xp += Math.round(xpProximo(prog.nivel) * O.porHora * Math.min(1, h) / (1 + prog.nivel / O.meio));
    while (prog.nivel < cap && prog.xp >= xpProximo(prog.nivel)) { prog.xp -= xpProximo(prog.nivel); prog.nivel++; prog.pontos += PONTOS_POR_NIVEL; }
  }
  if (prog.nivel >= cap) prog.xp = Math.min(prog.xp, xpProximo(prog.nivel) - 1);
  return prog.nivel - n0;
}

// lições da morte vindas do banco: só números dentro do máximo (CEREBRO.morte.max)
export function licoesValidas(o) {
  const M = CEREBRO.morte, L = {};
  if (!o || typeof o !== 'object') return L;
  for (const q of Object.keys(M.max)) if (Number.isFinite(o[q]) && o[q] > 0) L[q] = Math.min(M.max[q], o[q]);
  if (Number.isFinite(o.mortes) && o.mortes > 0) L.mortes = o.mortes | 0;
  if (o.ultima && typeof o.ultima === 'object') L.ultima = { de: String(o.ultima.de || '').slice(0, 40), nivel: +o.ultima.nivel || 0, t: +o.ultima.t || 0 };
  return L;
}

// as lições em frases curtas (vão na ficha da conversa: o NPC sabe dizer o que aprendeu caindo)
export function textoLicoes(L) {
  if (!L) return [];
  const t = [];
  if (L.pocao) t.push('aprendi caindo: beber poção mais cedo');
  if (L.pocoes) t.push(`aprendi caindo: levar ${L.pocoes} poção a mais`);
  if (L.acima) t.push(`aprendi caindo: caçar monstro até ${L.acima} nível mais baixo que antes`);
  if (L.fugir) t.push('aprendi caindo: sair antes de ficar cercado');
  if (L.recuar) t.push('aprendi caindo: recuar mais cedo do golpe carregado e da marca no chão');
  return t;
}

export const Amiga = {
  // ---------- entra e sai junto com o dono ----------
  // o servidor chama quando o dono entra na sala (contas de teste do André; sem contas, o primeiro que entra)
  // fala: quem entrou pode conversar com ele (chave de IA ou conta de teste). André 2026-11-11 ("quero que eles andem
  // sozinhos"): o NPC fica no mundo para todo mundo da sala; só quem pode conversar vira o "dono" que ele acompanha.
  amigaEntrar(donoId, fala = true) {
    if (fala) (this.amigaFalam ||= new Set()).add(donoId); else this.amigaFalam ||= new Set();
    if (!this.amiga) {
      const L = this.loteDaAmiga(true);
      let salvo = L?.amiga || (!this.AMIGA.terreno && this.npcSalvos?.get(this.AMIGA.id)) || {};
      // recomeço (André 2026-11-11): tudo o que ela jogou volta ao zero (nível, peças, ouro, bolsa, amizades, diário);
      // o jeito dela (código) fica. O save antigo fica guardado em 'antes' para dar para voltar se ele pedir.
      let antes = salvo.antes || null;
      if (this.AMIGA.recomeco && salvo.recomeco !== this.AMIGA.recomeco) {
        if (salvo.prog) { const { antes: _velho, ...resto } = salvo; antes = { ...resto, guardado: this.AMIGA.recomeco }; }
        salvo = {};
      }
      const j = this.adicionarJogador(this.AMIGA.id, this.AMIGA.nome, this.AMIGA.visual, { aparencia: this.AMIGA.aparencia, progresso: salvo.prog || null });
      j.conta = this.AMIGA.conta; j.bot = true;
      j.prog.hist = { v: 2, p: HISTORIA.length, ac: false, e: 0, n: 0, m: 0 }; // progressão (André 2026-11-10): ela mora no mundo, nada fica na névoa para ela
      delete j.prog.pos;
      // a roupa dela (look B) na primeira vez; depois ela veste o que achar melhor (fase 3) e isso fica salvo
      // a roupa do look B é só aparência (roupaFixa); as peças de verdade começam Comuns, como um jogador novo (André 2026-11-09)
      j.roupaFixa = Object.fromEntries(Object.entries(this.AMIGA.equip).map(([l, it]) => [l, { ...it }]));
      for (const [l, it] of Object.entries(this.AMIGA.equip)) {
        const atual = j.prog.equip[l], doLook = atual && atual.k === it.k && atual.r === it.r && !atual.e;
        if (!salvo.prog || !atual || (!salvo.justa && doLook)) j.prog.equip[l] = { k: it.k, r: this.AMIGA.justa.raridade };
      }
      liberarPaginas(j.prog, this.AMIGA.mochila.paginas); // fase 3: 4 páginas, como a mochila do André
      // aventureiro novo (André 2026-11-11): começa no nível da lista, mas nunca acima do jogador mais alto do servidor
      if (!salvo.prog && this.AMIGA.nivelInicial > 1) {
        const n = Math.max(1, Math.min(this.AMIGA.nivelInicial, this.nivelTetoNpc ?? Infinity));
        j.prog.pontos += (n - j.prog.nivel) * PONTOS_POR_NIVEL; j.prog.nivel = n; j.prog.xp = 0; j.prog.ouro += 25 * n;
      }
      if (!j.prog.equip.cajado) j.prog.equip.cajado = { k: 'cajado', r: this.AMIGA.justa.raridade }; // espada E cajado, como todo herói
      for (const b of ['espada', 'cajado']) j.prog.barras[b] = barraValida(CEREBRO.barras[b], b) || j.prog.barras[b]; // as skills novas, como o jogador
      const ferr = this.AMIGA.atividades?.[this.AMIGA.gosto]?.ferramenta; // quem gosta de pescar/minerar/lenha já tem a ferramenta
      if (!this.AMIGA.terreno && ferr && rotinaDe(this.AMIGA.id).coleta > 0 && contar(j.prog.mochila, ferr) < 1) guardar(j.prog.mochila, { k: ferr, n: 1 });
      this.offlineAmiga(j, salvo.t); // o tempo em que ninguém estava no jogo (devagar, sem passar do jogador mais alto)
      this.aplicarStatus(j, true);
      j.amizade = salvo.amizade | 0;
      j.amizades = salvo.amizades && typeof salvo.amizades === 'object' ? { ...salvo.amizades } : {};
      j.donoConta = null;
      j.amizadeDia = salvo.amizadeDia && typeof salvo.amizadeDia === 'object' ? { ...salvo.amizadeDia } : {}; // conta -> [dia, quanto subiu hoje]
      // memória de cada pessoa (conta -> lista), dicas que viraram regra (conta -> { curaCedo: true }) e o que fazem juntos
      const porConta = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
      j.memorias = porConta(salvo.memorias); j.regras = porConta(salvo.regras); j.gostos = porConta(salvo.gostos);
      // dicas que viraram regra do cérebro (entrega 2, André 2026-11-11): valem para todo mundo; o banco é conferido de novo
      j.dicas = Array.isArray(salvo.dicas) ? salvo.dicas.map((d) => validarRegra(d, CEREBRO)).filter(Boolean).slice(-CEREBRO.dicas.max) : [];
      j.licoes = licoesValidas(salvo.licoes); // o que aprendeu caindo (entrega 4)
      j.amizadeAntiga = salvo.amizades ? salvo.antiga ?? null : salvo.amizade | 0; // save de antes de 2026-11-10: a amizade era do André (conta de teste)
      j.pedido = salvo.pedido && ITENS[salvo.pedido.k] ? { k: salvo.pedido.k, n: salvo.pedido.n | 0 } : null;
      j.amigaAntes = antes;
      j.ia = { fase: 'pensar', ate: 0 };
      this.pocoesAmiga(j);
      // aparece na porta de casa (ou no canto do terreno, se a casa ainda não existe); sem casa, na vila do nível dele
      const def = L?.def, M = !def && this.moradiaAmiga(j), x = def ? def.x0 + this.AMIGA.porta[0] : M ? M.x : this.mapa.nascimento.x + 2, z = def ? def.z0 + this.AMIGA.porta[1] : M ? M.z : this.mapa.nascimento.z + 2;
      Object.assign(j, { x, z, y: this.terreno.altura(x, z), ry: Math.PI, chao: true });
      this.amiga = j;
      this.amigaDono = null;
    }
    if (!fala) return; // só passeia no mundo dele; conversar, só quem tem a chave
    if (!this.jogadores.has(this.amigaDono)) this.mudarDonoAmiga(donoId); // ninguém com ela: acompanha quem chegou
    this.evento({ t: 'amiga', para: donoId, id: this.AMIGA.id, nome: this.AMIGA.nome, papel: this.AMIGA.papel, lote: this.loteDaAmiga()?.def.id || null });
    this.avisarVirtuaisAmiga(); // ela aparece em "Amigos virtuais" (para todos; quem não tem chave vê o botão de ativar)
  },
  // ---------- vários amigos (André 2026-11-10: irmão e irmã com a chave de cada um) ----------
  podeAmiga(id) { return !!this.amiga && id != null && (id === this.amigaDono || !!this.amigaFalam?.has(id)); },
  // ocupada com quem ela acompanha agora: no time dele, coletando junto, trocando ou indo até ele
  ocupadaAmiga() {
    const a = this.amiga, dono = this.jogadores.get(this.amigaDono); if (!a || !dono) return false;
    return !!((a.time && a.time.membros.includes(dono.id)) || a.ia.atividade || a.troca || (a.ia.vir && a.ia.vir.ate > this.tempo));
  },
  // quem fala com ela passa a ser acompanhado, se ela estiver livre. false = está com outro amigo
  trocarDonoAmiga(id) {
    if (!this.podeAmiga(id) || !this.jogadores.has(id)) return false;
    if (id === this.amigaDono) return true;
    if (this.ocupadaAmiga()) return false;
    this.mudarDonoAmiga(id);
    return true;
  },
  // a amizade de cada conta (a de quem ela acompanha fica em a.amizade, que o resto do código já usa)
  amizadeAmiga(j) {
    const a = this.amiga; if (!a || !j) return 0;
    if (j.conta === a.donoConta) return a.amizade | 0;
    if (a.amizades?.[j.conta] != null) return a.amizades[j.conta] | 0;
    return a.amizadeAntiga != null && j.testador ? a.amizadeAntiga | 0 : 0;
  },
  // sobe a amizade de quem está na sala (André 2026-11-14: "subir interagindo de qq forma"). Teto AMIGA.amizade.max (quem já
  // passou do teto não perde nada). diario = conta no limite do dia (conversa, caça, coleta, chefe); presente e pedido não.
  // Devolve quanto subiu.
  ganharAmizadeAmiga(j, n, diario = true) {
    const a = this.amiga, Z = this.AMIGA.amizade; if (!a || !j || j.bot || !j.conta || n <= 0) return 0;
    const atual = this.amizadeAmiga(j);
    if (diario) {
      const dia = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10), m = (a.amizadeDia ||= {});
      const hoje = m[j.conta]?.[0] === dia ? m[j.conta][1] | 0 : 0;
      n = Math.min(n, Z.porDia - hoje);
      if (n <= 0) return 0;
      m[j.conta] = [dia, hoje + n];
    }
    const novo = Math.max(atual, Math.min(Z.max, atual + n)), subiu = novo - atual;
    if (!subiu) return 0;
    if (j.conta === a.donoConta) a.amizade = novo; else (a.amizades ||= {})[j.conta] = novo;
    if (j.testador && j.conta !== a.donoConta) a.amizadeAntiga = null; // a antiga (do André) já foi para a conta dele
    this.evento({ t: 'aviso', para: j.id, texto: Z.aviso.replace('{nome}', this.AMIGA.nome).replace('{n}', subiu) });
    this.guardarAmiga();
    return subiu;
  },
  // monstro morto (simulacao.js): quem do time dela estava junto conta para a amizade (AMIGA.amizade.caca e .chefe)
  cacaJuntosAmiga(ganham, c) {
    const a = this.amiga, Z = this.AMIGA.amizade; if (!a || !a.time || !ganham.has(a)) return;
    const chefe = c.tipo === 'chefe' || !!TIPOS_INIMIGO[c.tipo]?.chefe || !!c.bm, cont = (a.ia.cacaJuntos ||= {});
    for (const j of ganham) {
      if (j === a || j.bot || !j.conta || j.time !== a.time) continue;
      if (chefe) { this.ganharAmizadeAmiga(j, Z.chefe); continue; }
      cont[j.conta] = (cont[j.conta] || 0) + 1;
      if (cont[j.conta] >= Z.caca) { cont[j.conta] = 0; this.ganharAmizadeAmiga(j, 1); }
    }
  },
  mudarDonoAmiga(id) {
    const a = this.amiga, j = this.jogadores.get(id); if (!a || !j) return;
    const amizade = this.amizadeAmiga(j);
    if (a.donoConta) a.amizades[a.donoConta] = a.amizade | 0;
    if (j.testador) a.amizadeAntiga = null; // a amizade antiga (do André) agora é dele, por conta
    a.donoConta = j.conta; a.amizade = amizade;
    this.amigaDono = id;
    Object.assign(a.ia, { chamado: null, vir: null, combinado: 0, recusaAte: 0, reserva: null, chamaEm: null }); // o combinado era com o outro
  },
  avisarVirtuaisAmiga() { for (const o of this.jogadores.values()) if (!o.bot && o.amigos) this.enviarAmigos(o); },
  // o dono saiu: ela guarda o que tem e sai junto (parada, sem gastar servidor)
  amigaSair(donoId) {
    if (!this.amiga) return;
    { const sai = this.jogadores.get(donoId); if (sai) this.diarioAmiga(sai.conta); } // quem saiu: o diário da conversa de hoje
    if (donoId != null) this.amigaFalam?.delete(donoId);
    // André 2026-11-11: ele vive no mundo enquanto tiver gente na sala (com ou sem chave); só sai com o último jogador
    const fica = [...this.jogadores.values()].some((o) => !o.bot && o.id !== donoId);
    if (fica && donoId != null && donoId !== this.amigaDono) return this.avisarVirtuaisAmiga(); // saiu outro: ela fica com quem está
    const prox = [...(this.amigaFalam || [])].find((k) => k !== donoId && this.jogadores.has(k));
    if (prox) { // quem ela acompanhava saiu, mas tem outro amigo com chave aqui: ela fica e passa a acompanhar ele
      const a = this.amiga;
      if (a.ia.atividade) this.fimAtividadeAmiga(a, true);
      if (a.time) this.sairDoTime(a, `${this.AMIGA.nome} saiu do time`);
      a.ia.fase = 'pensar'; a.ia.chatFila = (a.ia.chatFila || []).filter((e) => e.para !== donoId);
      this.mudarDonoAmiga(prox);
      this.guardarAmiga();
      return this.avisarVirtuaisAmiga();
    }
    if (fica) { // ninguém com chave por aqui: segue a vida dele sozinho (caça, vila), sem dono
      const a = this.amiga;
      if (a.ia.atividade) this.fimAtividadeAmiga(a, true);
      if (a.time) this.sairDoTime(a, `${this.AMIGA.nome} saiu do time`);
      if (a.donoConta) a.amizades[a.donoConta] = a.amizade | 0;
      a.donoConta = null; a.amizade = 0; this.amigaDono = null;
      Object.assign(a.ia, { chamado: null, vir: null, combinado: 0, reserva: null, chamaEm: null, fase: 'pensar' });
      a.ia.chatFila = (a.ia.chatFila || []).filter((e) => e.para !== donoId);
      this.guardarAmiga();
      return this.avisarVirtuaisAmiga();
    }
    this.amigaFalam?.clear();
    if (this.amiga.time) this.sairDoTime(this.amiga, `${this.AMIGA.nome} saiu do jogo`);
    this.guardarAmiga();
    this.jogadores.delete(this.amiga.id);
    this.amiga = null; this.amigaDono = null;
  },
  ehAmiga(o) { return !!o?.bot; },
  // ---------- o terreno dela ----------
  // o terreno da Cecília; com criar, procura um lugar livre nas Terras da Estrada perto da entrada e reserva no banco
  loteDaAmiga(criar = false) {
    if (!this.AMIGA.terreno) return null; // aventureiro sem casa (André 2026-11-11): mora na vila do nível dele
    for (const L of this.lotes.values()) if (L.dono === this.AMIGA.conta) return L;
    if (!criar) return null;
    const outros = [...this.lotes.values()].filter((L) => L.dono).map((L) => L.def);
    const { w, d } = this.AMIGA.terreno, entrada = VILA_LOTES.estrada[VILA_LOTES.estrada.length - 1];
    const lugares = [];
    for (let x0 = -38; x0 <= 10; x0 += 2) for (let z0 = 48; z0 <= 130; z0 += 2) lugares.push({ x0, z0, x1: x0 + w, z1: z0 + d });
    lugares.sort((a, b) => Math.hypot(a.x0 + w / 2 - entrada[0], a.z0 + d / 2 - entrada[1] - 6) - Math.hypot(b.x0 + w / 2 - entrada[0], b.z0 + d / 2 - entrada[1] - 6));
    const R = lugares.find((R) => !motivoTerreno(R, outros));
    if (!R) return null;
    const lid = 't' + this.AMIGA.id;
    if (this.aoComprarLote && !this.aoComprarLote(lid, this.AMIGA.conta, this.AMIGA.nome, R)) return null;
    const L = { def: { id: lid, nome: 'Terreno', ...R }, dono: this.AMIGA.conta, nomeDono: this.AMIGA.nome, pecas: [], horta: {}, prox: 1, taxa: Date.now(), amiga: {} };
    this.lotesSoltos.delete(lid);
    this.lotes.set(lid, L);
    this.avisarLote(L);
    return L;
  },
  // guarda o progresso dela dentro do terreno (vai para o banco em lotesParaSalvar)
  guardarAmiga() {
    const j = this.amiga, L = this.loteDaAmiga(); if (!j || (!L && this.AMIGA.terreno)) return;
    const amizades = { ...(j.amizades || {}) }; if (j.donoConta) amizades[j.donoConta] = j.amizade | 0;
    const dados = { t: Date.now(), prog: j.prog, amizade: j.amizade | 0, amizades, amizadeDia: j.amizadeDia || {}, ...(j.amizadeAntiga != null ? { antiga: j.amizadeAntiga } : {}), memorias: j.memorias || {}, regras: j.regras || {}, dicas: j.dicas || [], licoes: j.licoes || {}, gostos: j.gostos || {}, pedido: j.pedido || null, justa: 1, ...(this.AMIGA.recomeco ? { recomeco: this.AMIGA.recomeco } : {}), ...(j.amigaAntes ? { antes: j.amigaAntes } : {}) };
    if (!L) { (this.npcSalvos ||= new Map()).set(this.AMIGA.id, dados); (this.npcsMudados ||= new Set()).add(this.AMIGA.id); return; } // sem casa: tabela mundo do banco
    L.amiga = dados;
    this.lotesMudados.add(L.def.id);
  },
  // ---------- a cabeça dela (a cada passo da simulação) ----------
  // Em volta da cabeça: confere se o passo anterior saiu do lugar (André 2026-11-12: "ficam caminhando sem sair do lugar
  // o tempo todo, batendo na parede lá da casa deles... ou ficam parados, ou ficam andando de verdade"). AMIGA.parede.
  passoAmiga(dt) {
    const j = this.amiga; if (!j) return;
    this.paredeAmiga(j, dt);
    j.ia.mira = null; j.ia.naEstrada = false;
    this.cabecaAmiga(dt);
    const ia = j.ia, e = j.entrada, dv = ia.desvioParede;
    if (dv && this.tempo < dv.ate && e && Math.hypot(e.mx, e.mz) > 0.15) { // desviando: anda de lado (um pouco para a frente)
      let mx = e.mx * 0.3 + e.mz * dv.lado, mz = e.mz * 0.3 - e.mx * dv.lado; const n = Math.hypot(mx, mz) || 1;
      j.entrada = { mx: mx / n, mz: mz / n, correr: e.correr };
    }
  },
  // quer andar e não sai do lugar (parede, cerca, pedra): larga o passeio, desvia ou, no último caso, aparece no ponto
  paredeAmiga(j, dt) {
    const ia = j.ia, P = this.AMIGA.parede, e = j.entrada, u = ia.passoAntes;
    ia.passoAntes = { x: j.x, z: j.z };
    const m = e ? Math.hypot(e.mx, e.mz) : 0;
    // na estrada o longeAmiga já desvia sozinho
    if (!P || !u || m <= 0.15 || ia.naEstrada || j.morto || j.esc || j.trava > 0 || j.arrancada || j.troca || !(dt > 0)) { ia.parede = 0; return; }
    const v = MONTARIAS[j.montado]?.correr || (e.correr ? HEROI.correr : HEROI.andar), andou = Math.hypot(j.x - u.x, j.z - u.z);
    if (andou >= v * Math.min(1, m) * dt * P.minimo) { ia.parede = Math.max(0, (ia.parede || 0) - dt); if (!ia.parede && this.tempo >= (ia.desvioParede?.ate || 0) + P.preso * 2) ia.tentaParede = 0; return; }
    if ((ia.parede = (ia.parede || 0) + dt) < P.preso) return;
    ia.parede = 0;
    const av = ia.av;
    if (av?.passeio) { av.passeio = null; this.pararAmiga(j); return; } // passeio à toa: fica parado e depois escolhe outro canto
    const alvo = ia.fase === 'andar' && !av && !ia.noTime ? ia.rota?.[0] : ia.mira;
    if ((ia.tentaParede = (ia.tentaParede || 0) + 1) > P.desvios && !j.time && alvo && Math.hypot(alvo.x - j.x, alvo.z - j.z) < P.salto && !j.montado) {
      this.teleportes = (this.teleportes | 0) + 1; ia.tentaParede = 0; ia.desvioParede = null;
      Object.assign(j, { x: alvo.x, z: alvo.z, y: this.terreno.altura(alvo.x, alvo.z) });
      if (ia.fase === 'andar' && !av && ia.rota?.[0] === alvo) { ia.rota.shift(); ia.preso = 0; ia.longe = Infinity; }
      return;
    }
    ia.desvioParede = { ate: this.tempo + P.desvio, lado: ia.desvioParede?.lado === 1 ? -1 : 1 };
  },
  cabecaAmiga(dt) {
    const j = this.amiga; if (!j) return;
    const ia = j.ia, L = this.loteDaAmiga();
    if (this.tempo >= (ia.diarioT || 0)) { ia.diarioT = this.tempo + 5; this.diarioAmiga(); } // memória: conversas que terminaram
    this.passoChatAmiga(j); // mensagens dela no chat (respostas "digitando" e quando ela chama o André)
    if (j.troca) return this.passoTrocaAmiga(j); // trocando (fase 3): fica parada olhando para ele e negocia
    // caiu lutando: renasce em casa (a cama dela), como qualquer jogador, e CONTINUA no time (André 2026-11-11: "quando o bot
    // morre, ele sai do meu time. Eu não quero"). Uma vez por queda: avisa, conserta no Tomás e repõe as poções na Rosa com o
    // ouro dela; ao levantar, o passoTimeAmiga a traz de volta até o dono pela estrada (montada).
    if (j.morto) { if (!ia.caiu) { ia.caiu = true; const f = this.aprenderMorteAmiga(j); if (j.time) this.falarAmiga(`${this.AMIGA.falas.caiu} ${f}`); this.pocoesAmiga(j); } ia.fase = 'pensar'; ia.av = null; ia.viagem = null; return; }
    ia.caiu = false;
    // subiu de nível: os pontos vão pelo jeito dele (André 2026-11-11): quem gosta de cajado põe em Inteligência, o resto
    // em Força, e todos em Vitalidade (antes era só metade Força e metade Vitalidade)
    if (j.prog.pontos > 0) this.pontosAmiga(j);
    if ((j.prog.nivel | 0) > (ia.nivelVisto ??= j.prog.nivel | 0)) { this.esquecerMorteAmiga(j, (j.prog.nivel | 0) - ia.nivelVisto); ia.nivelVisto = j.prog.nivel | 0; }
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
    if (ia.atividade && !(j.time && dono && j.time.membros.includes(dono.id))) this.fimAtividadeAmiga(j); // saiu do time: a coleta junto acaba (divide o que pegou)
    // no time do dono: segue, luta e cuida da vida (fase 2); saiu do time: volta para a vida dela
    if (j.time && dono && j.time.membros.includes(dono.id)) { ia.noTime = true; return this.passoTimeAmiga(j, dono, dt); }
    if (j.time) this.sairDoTime(j, `${this.AMIGA.nome} saiu do time`); // o dono saiu da sala ou do time: ela não fica com outros
    if (ia.noTime) { ia.noTime = false; ia.viagem = null; j.montado = null; this.pararAmiga(j); ia.fase = 'pensar'; ia.ate = this.tempo + 1; if (dono) this.falarAmiga(this.AMIGA.falas.voltou); this.pocoesAmiga(j); }
    // vida própria (André 2026-11-11): saiu para caçar ou mora sem casa: caça, volta para a vila, descansa
    if (ia.av || !L) return this.passoSozinhoAmiga(j, dt);
    if (ia.fase === 'andar') return this.andarAmiga(j, dt);
    if (ia.fase === 'trabalhar') {
      if (this.tempo >= ia.golpe) { ia.golpe = this.tempo + ia.ritmo; j.acao = { nome: ia.anim, ts: 1 }; j.acaoSeq++; }
      if (this.tempo >= ia.ate) { const fim = ia.fim; ia.fase = 'pensar'; ia.ate = this.tempo + 0.5; j.acao = null; fim?.(); }
      return;
    }
    if (ia.fase === 'parada') { if (this.tempo >= ia.ate) ia.fase = 'pensar'; return; }
    if (this.tempo < ia.ate || !L) return;
    if (this.tempo >= (ia.arrumaT || 0)) { ia.arrumaT = this.tempo + this.AMIGA.mochila.arrumar; this.arrumarMochilaAmiga(j); }
    // 1) a casa: a próxima peça que falta
    const falta = this.AMIGA.casa.map((c) => pecaDaCasa(L.def, c)).find((p) => !L.pecas.some((o) => mesmaPeca(o, p)) && !ia.pulas?.has(chavePeca(p)));
    if (falta) return this.irTrabalhar(j, L, this.ondeFicar(L, falta), this.AMIGA.passo.obra, 'golpe1', 1.1, () => this.colocarPeca(L, falta));
    // 2) a horta: o canteiro que precisa de alguma coisa
    const H = this.AMIGA.horta, agora = Date.now();
    for (let dz = 0; dz < H.d; dz++) for (let dx = 0; dx < H.w; dx++) {
      const ci = L.def.x0 + H.x + dx, cj = L.def.z0 + H.z + dz, c = ci + ',' + cj, t = L.horta[c];
      if (t) crescerPlanta(t, agora);
      const madura = t?.c && fasePlanta(t.g / PLANTAS[t.c].G) >= 4;
      const seca = t?.c && !(t.w && agora < t.w + REGA_MS);
      if (t && t.c && !madura && !seca) continue;
      return this.irTrabalhar(j, L, { x: ci + 0.5, z: cj + 1.1 }, this.AMIGA.passo.canteiro, 'pouso', 1.6, () => this.cuidarCanteiro(L, c));
    }
    // 3) tudo em ordem: sai para caçar (vida própria, André 2026-11-11), passeia pela vila ou descansa na porta de casa
    if (Math.random() < NPC_VIDA.aventura.chance && naHoraDe(this.rotinaAmiga(), horaDoJogo(j.prog.dia))) { ia.av = { fase: 'escolher' }; return; }
    if (Math.random() < 0.5) {
      const [x, z] = sorteia(PASSEIOS);
      this.irPara(j, L, { x: x + Math.random() - 0.5, z: z + Math.random() - 0.5 }, () => { ia.fase = 'parada'; ia.ate = this.tempo + this.AMIGA.passo.passeio * (0.5 + Math.random()); });
    } else this.irPara(j, L, { x: L.def.x0 + this.AMIGA.porta[0] + Math.random() * 2 - 1, z: L.def.z0 + this.AMIGA.porta[1] }, () => { ia.fase = 'parada'; ia.ate = this.tempo + this.AMIGA.passo.passeio; j.ry = 0; });
  },
  // ---------- vida própria (André 2026-11-11: "quero que eles andem sozinhos"; os 22 iguais) ----------
  // a vila onde ele mora agora (muda com o nível: NPC_VIDA.moradia); o ponto é espalhado por NPC para não juntar todos
  moradiaAmiga(j) {
    let M = NPC_VIDA.moradia[0];
    for (const m of NPC_VIDA.moradia) if ((j.prog.nivel | 0) >= m.nivel) M = m;
    let h = 0; for (const c of this.AMIGA.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const a = (h % 360) * Math.PI / 180, r = M.r * (0.35 + ((h >> 9) % 60) / 100);
    return { ...M, x: M.x + Math.cos(a) * r, z: M.z + Math.sin(a) * r };
  },
  // pontos de atributo pelo jeito (gosto pelo cajado): Força, Inteligência e Vitalidade na proporção dele
  pontosAmiga(j) {
    const J = CEREBRO.jeitos[this.AMIGA.id] || CEREBRO.jeitos.padrao, peso = { for: Math.max(0.05, 1 - J.cajado), int: Math.max(0.05, J.cajado), vit: 0.8 };
    for (let n = 0; j.prog.pontos > 0 && n < 400; n++) {
      const k = Object.keys(peso).reduce((m, k) => (j.prog.atr[k] / peso[k] < j.prog.atr[m] / peso[m] ? k : m), 'vit');
      const antes = j.prog.pontos; this.distribuirAtributo(j.id, k); if (j.prog.pontos === antes) break;
    }
  },
  // o tempo em que ninguém jogou: ganha XP devagar (NPC_VIDA.offline), nunca acima do jogador mais alto do servidor
  offlineAmiga(j, desde) {
    const O = NPC_VIDA.offline; if (!Number.isFinite(desde)) return 0;
    const horas = Math.min(O.maxDias * 24, Math.max(0, (Date.now() - desde) / 3600000)) * O.horasPorDia / 24;
    const n0 = j.prog.nivel;
    for (let h = horas; h > 0; h -= 1) this.ganharXP(j, Math.round(xpProximo(j.prog.nivel) * O.porHora * Math.min(1, h) / (1 + j.prog.nivel / O.meio)));
    return j.prog.nivel - n0;
  },
  // o campo de caça para o nível dele: entre os que não passam de campoAcima níveis acima, um dos 3 mais altos (sem
  // boss, sem covil de caverna); sorteado para os NPCs se espalharem
  campoAmiga(j, fora = null) {
    const A = NPC_VIDA.aventura, n = j.prog.nivel | 0;
    const ok = this.cacas.map((c) => c.def).filter((c) => !c.boss && !c.tunel && (c.nivel || 1) <= n + A.campoAcima - (j.licoes?.acima || 0) && !(fora && fora.has(c.id)));
    ok.sort((a, b) => (b.nivel || 1) - (a.nivel || 1) || Math.hypot(a.x - j.x, a.z - j.z) - Math.hypot(b.x - j.x, b.z - j.z));
    // a faixa que ele prefere (rotina.campo): alto = os 3 mais fortes; medio = do 2º ao 4º; baixo = do 3º ao 6º (mais
    // seguro); longe = qualquer um, de preferência longe da vila. Dentro da faixa, o que tem menos NPC (cada NPC lá pesa 2)
    const R = this.rotinaAmiga(), faixa = { alto: [0, 3], medio: [1, 4], baixo: [2, 6], longe: [0, 99] }[R.campo] || [0, 3];
    let lista = ok.slice(faixa[0], faixa[1]); if (!lista.length) lista = ok.slice(-3);
    const n0 = (c) => this.amigosIa.filter((x) => x.amiga && x.amiga !== j && x.amiga.ia?.av?.c?.id === c.id).length;
    const M = this.moradiaAmiga(j), longe = (c) => (R.campo === 'longe' ? -Math.hypot(c.x - M.x, c.z - M.z) / 150 : 0);
    const top = lista.map((c) => [c, n0(c) * 2 + longe(c) + Math.random() * 0.9]).sort((a, b) => a[1] - b[1]);
    return top.length ? top[0][0] : null;
  },
  // o monstro que ele ataca sozinho no campo: o mais perto dele, sem chefe nem boss, até mobAcima níveis acima
  alvoSozinhoAmiga(j, c) {
    const A = NPC_VIDA.aventura; let melhor = null, md = Infinity;
    for (const e of this.inimigosDe(j)) {
      if (e.treino || e.bm || e.hc || e.tipo === 'chefe' || TIPOS_INIMIGO[e.tipo]?.chefe) continue;
      if ((e.nivel || 1) > (j.prog.nivel | 0) + A.mobAcima - (j.licoes?.acima || 0) || Math.hypot(e.x - c.x, e.z - c.z) > (c.r || 12) + A.raio) continue;
      const d = Math.hypot(e.x - j.x, e.z - j.z); if (d < md) { md = d; melhor = e; }
    }
    return melhor;
  },
  // vai até o ponto (estrada e lobo de longe, como quando vem até o dono); true = chegou
  irLongeAmiga(j, x, z, dt) {
    const d = Math.hypot(x - j.x, z - j.z);
    if (this.longeAmiga(j, { x, z, solo: true, montado: null }, d, dt)) return false;
    if (d > 2) { j.montado = null; this.irDireto(j, x, z, d > 5); return false; }
    this.pararAmiga(j); j.montado = null; return true;
  },
  // A rotina sozinho: escolher -> ir ao campo -> caçar -> voltar para a vila -> vender/consertar/poção -> descansar.
  // De noite fica na vila. Mochila cheia, sem poção ou fugindo: volta. Quem tem casa (Cecília, Dario) volta para ela.
  passoSozinhoAmiga(j, dt) {
    const ia = j.ia, A = NPC_VIDA.aventura, t = this.tempo, R = this.rotinaAmiga(), sorte = ([a, b], k = 1) => (a + Math.random() * (b - a)) * k;
    // primeira vez na sala: cada um espera um pouco antes de sair (ninguém sai junto)
    if (!ia.av) { ia.av = ia.jaSaiu ? { fase: 'escolher' } : { fase: 'descansar', ate: t + ((hashNpc(this.AMIGA.id) >> 4) % 1000) / 1000 * 240 }; ia.jaSaiu = true; }
    const av = ia.av;
    if (j.trava > 0) return this.pararAmiga(j);
    const noite = !naHoraDe(R, horaDoJogo(j.prog.dia)); // fora do horário dele (cada um tem o seu)
    const livres = j.prog.mochila.filter((o) => !o).length, temPocao = j.prog.mochila.some((o) => o?.k === 'pocao');
    const voltar = () => { if (j.coleta) this.pararColeta(j, null); if (j.pesca) this.pararPesca(j, null); Object.assign(av, { fase: 'voltar', c: null, coleta: null }); ia.viagem = null; };
    if (av.fase === 'escolher') {
      if (noite || livres < A.mochilaLivre) return voltar();
      // quem gosta de pescar, minerar ou cortar lenha vai fazer isso (com vigor); senão, caça
      const gosto = this.AMIGA.gosto, Ativ = this.AMIGA.atividades?.[gosto];
      if (Ativ && !av.semColeta && Math.random() < R.coleta && vigorAgora(j.prog.vigor) >= 1 && contar(j.prog.mochila, Ativ.ferramenta) > 0) {
        const c = this.lugarColetaAmiga(j, gosto);
        if (c) { Object.assign(av, { fase: 'ir', c, coleta: gosto, ate: t + sorte(A.cacar, R.caca) }); ia.viagem = null; ia.alvoColeta = null; return; }
      }
      av.semColeta = false;
      if (!temPocao) return voltar();
      const c = this.campoAmiga(j, av.fora);
      if (!c) return voltar();
      Object.assign(av, { fase: 'ir', c, coleta: null, ate: t + sorte(A.cacar, R.caca) });
      ia.viagem = null;
      return;
    }
    if (av.coleta && (av.fase === 'ir' || av.fase === 'cacar')) return this.coletaSozinhoAmiga(j, av, noite, livres, voltar, dt);
    if (av.fase === 'ir' || av.fase === 'cacar') {
      const c = av.c;
      if (ia.viagem?.bloqueio) { (av.fora ||= new Set()).add(c.id); ia.viagem = null; av.fase = 'escolher'; return; } // outra terra: outro campo
      if (noite || livres < A.mochilaLivre || t >= av.ate) return voltar();
      const alvo = this.alvoSozinhoAmiga(j, c);
      if (av.fase === 'ir') {
        if (alvo && Math.hypot(alvo.x - j.x, alvo.z - j.z) < 10) av.fase = 'cacar'; // monstro no caminho do campo: briga
        else { if (this.irLongeAmiga(j, c.x, c.z, dt)) av.fase = 'cacar'; return; }
      }
      if (!alvo) { // campo vazio: anda um pouco pelo campo esperando os monstros voltarem
        if (!av.passeio || Math.hypot(av.passeio.x - j.x, av.passeio.z - j.z) < 1.5) { const a = Math.random() * Math.PI * 2, r = Math.random() * (c.r || 10); av.passeio = { x: c.x + Math.cos(a) * r, z: c.z + Math.sin(a) * r }; }
        return this.irDireto(j, av.passeio.x, av.passeio.z, false);
      }
      j.montado = null;
      if (this.cerebroAmiga(j, j, alvo)) return;
      if (ia.cer?.faca === 'fugir') return voltar(); // quase caindo e sem poção: volta para a vila
      return this.pararAmiga(j);
    }
    if (av.fase === 'voltar') {
      const M = this.pontoVilaAmiga(j), L = this.loteDaAmiga();
      const casa = L ? { x: L.def.x0 + this.AMIGA.porta[0], z: L.def.z0 + this.AMIGA.porta[1] } : M;
      const canto = L && Math.hypot(casa.x - j.x, casa.z - j.z) < 15 && this.contornoCasa(L, j, casa);
      if (canto) { j.montado = null; this.irDireto(j, canto.x, canto.z, false); return; } // atrás da casa: dá a volta
      if (!this.irLongeAmiga(j, casa.x, casa.z, dt)) return;
      // na vila: vende o que não usa, conserta no Tomás e compra poção na Rosa (com o ouro dele)
      this.arrumarMochilaAmiga(j); this.pocoesAmiga(j);
      Object.assign(av, { fase: 'descansar', ate: t + sorte(A.descanso, R.pausa) });
      return;
    }
    if (av.fase === 'descansar') {
      if (noite) av.ate = t + (av.espera ??= Math.random() * NPC_VIDA.esperaManha); // abriu o horário: ainda espera um tanto só dele
      if (t < av.ate || noite) { // passeia devagar pela vila, no canto dele (fora do horário fica por ali)
        // quem tem casa (Cecília, Dario) voltou para ela: passeia na frente da porta, não vai em linha reta até a vila
        // atravessando a própria casa (era o "andando sem sair do lugar" atrás da casa)
        const Lc = this.loteDaAmiga(), M = Lc ? { x: Lc.def.x0 + this.AMIGA.porta[0], z: Lc.def.z0 + this.AMIGA.porta[1] + 1.6, r: 2.5 } : this.pontoVilaAmiga(j);
        if (!av.passeio || Math.hypot(av.passeio.x - j.x, av.passeio.z - j.z) < 1) {
          if (Math.random() < 0.02) { const a = Math.random() * Math.PI * 2, r = Math.random() * M.r * 0.6; av.passeio = { x: M.x + Math.cos(a) * r, z: M.z + Math.sin(a) * r }; }
          return this.pararAmiga(j);
        }
        const canto = Lc && this.contornoCasa(Lc, j, av.passeio); // atrás da casa: dá a volta até a frente
        return canto ? this.irDireto(j, canto.x, canto.z, false) : this.irDireto(j, av.passeio.x, av.passeio.z, false);
      }
      if (this.loteDaAmiga()) { ia.av = null; ia.fase = 'pensar'; return; } // quem tem casa volta para a rotina dela
      ia.av = { fase: 'escolher', fora: av.fora, semColeta: av.semColeta };
    }
  },
  rotinaAmiga() { return (this._rotina ||= new Map()).get(this.AMIGA.id) || this._rotina.set(this.AMIGA.id, rotinaDe(this.AMIGA.id)).get(this.AMIGA.id); },
  // o canto dele na vila: perto do NPC que ele gosta (rotina.ponto) na vila inicial; nas outras, o ponto espalhado
  pontoVilaAmiga(j) {
    const M = this.moradiaAmiga(j), R = this.rotinaAmiga();
    const n = R.ponto && M.nivel === NPC_VIDA.moradia[0].nivel && (this.mapa.npcs || []).find((o) => o.id === R.ponto && !o.mundo); // quem mudou para uma vila do mundo grande (a Mirela) não conta
    if (!n) return M;
    const a = (hashNpc(this.AMIGA.id) % 628) / 100, r = 2.5 + (hashNpc(this.AMIGA.id + 'r') % 150) / 100;
    return { ...M, x: n.x + Math.cos(a) * r, z: n.z + Math.sin(a) * r, r: 4 };
  },
  // onde vai coletar sozinho: entre os NPC_VIDA.coleta.opcoes lugares mais perto da vila dele (até raio m), o que tem
  // menos NPC coletando por perto. { id, x, z, y } ou null
  lugarColetaAmiga(j, tipo) {
    const NC = NPC_VIDA.coleta, M = this.moradiaAmiga(j), cand = [];
    if (tipo === 'pescar') { for (const v of this.spots || []) if (v.ativo && Math.hypot(v.x - M.x, v.z - M.z) <= NC.raio) cand.push({ id: v.id, x: v.x, z: v.z, y: 0 }); }
    else for (const no of this.coletaveis.values()) {
      const K = COLETA[no.tipo]; if (!K || K.mao) continue;
      if (tipo === 'lenha' ? no.tipo !== 'arvore' : K.prof !== 'min') continue;
      if (profNivel(j.prog.prof[K.prof]) < (K.nivel || 1) || this.cargas(j, no) <= 0) continue;
      if (Math.hypot(no.x - M.x, no.z - M.z) <= NC.raio) cand.push({ id: no.id, x: no.x, z: no.z, y: no.y ?? null });
    }
    if (!cand.length) return null;
    cand.sort((a, b) => Math.hypot(a.x - M.x, a.z - M.z) - Math.hypot(b.x - M.x, b.z - M.z));
    const perto = (c) => this.amigosIa.filter((x) => x.amiga && x.amiga !== j && x.amiga.ia?.av?.c && Math.hypot(x.amiga.ia.av.c.x - c.x, x.amiga.ia.av.c.z - c.z) < 20).length;
    const l = cand.slice(0, NC.opcoes * 3).filter((_, i) => i % 3 === 0 || cand.length < NC.opcoes * 2).slice(0, NC.opcoes); // espalhados, não 6 árvores vizinhas
    return l.map((c) => [c, perto(c) * 2 + Math.random()]).sort((a, b) => a[1] - b[1])[0][0];
  },
  // coletando sozinho (pesca, minério, lenha): vai até o lugar, coleta o que der (fica com tudo, vende na vila), briga se
  // um monstro vier nele. Sem lugar ou sem vigor: volta (e da próxima vez caça).
  coletaSozinhoAmiga(j, av, foraDeHora, livres, voltar, dt) {
    const ia = j.ia, t = this.tempo, c = av.c, A = NPC_VIDA.aventura;
    if (foraDeHora || livres < A.mochilaLivre || t >= av.ate) return voltar();
    const bate = this.inimigosDe(j).find((e) => !e.morto && !e.treino && e.vez === j.id && Math.hypot(e.x - j.x, e.z - j.z) < 6);
    if (bate) { if (j.coleta) this.pararColeta(j, null); if (j.pesca) this.pararPesca(j, null); if (!this.cerebroAmiga(j, j, bate)) this.pararAmiga(j); if (ia.cer?.faca === 'fugir') voltar(); return; }
    if (j.pesca) return this.pescandoAmiga(j);
    if (j.coleta || j.fabrica) return this.pararAmiga(j);
    if (av.fase === 'ir') { if (this.irLongeAmiga(j, c.x, c.z, dt)) av.fase = 'cacar'; return; }
    ia.ruins ||= new Map();
    if (!ia.alvoColeta || t > ia.alvoColetaT) { ia.alvoColeta = this.acharColetaAmiga(j, { x: c.x, z: c.z, y: c.y ?? j.y }, av.coleta); ia.alvoColetaT = t + NPC_VIDA.coleta.cada; }
    const al = ia.alvoColeta;
    if (!al) { av.semColeta = true; av.fase = 'escolher'; av.coleta = null; return; } // acabou o lugar: vai caçar
    const d = Math.hypot(al.x - j.x, al.z - j.z);
    if (d > al.perto) return this.irDireto(j, al.x, al.z, d > 6);
    this.pararAmiga(j);
    if (av.coleta === 'pescar') { j.ry = Math.atan2(al.sx - j.x, al.sz - j.z); this.pescar(j.id, { acao: 'lancar', x: al.sx, z: al.sz }); }
    else this.coletar(j.id, { no: al.no });
    if (j.coleta || j.pesca) return;
    if (vigorAgora(j.prog.vigor) < 1) { av.semColeta = true; return voltar(); } // cansou: volta, e na próxima caça
    ia.ruins.set(al.id, t + 60); ia.alvoColeta = null;
  },
  pararAmiga(j) { j.entrada = { mx: 0, mz: 0, correr: false }; },
  // onde ela fica em pé para pôr a peça: do lado de dentro da casa (a parede da frente, pelo lado de fora)
  ondeFicar(L, p) {
    const T = CONSTRUCOES[p.k].tipo, [a0, b0, a1, b1] = this.AMIGA.dentro, cx = L.def.x0 + (a0 + a1) / 2, cz = L.def.z0 + (b0 + b1) / 2;
    if (T === 'fundacao' || T === 'telhado') return { x: p.x, z: L.def.z0 + this.AMIGA.porta[1] };
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
      console.warn(`${this.AMIGA.nome}: ${falta.k} em ${falta.x}, ${falta.z} não coube (${motivo})`);
      return;
    }
    L.prox++;
    L.pecas.push(p);
    this.refazerSolidosLotes();
    this.avisarLote(L);
    // ficou presa dentro de uma parede? sai para o lado de fora da porta
    if (!this.livreParaHeroi(this.amiga, this.amiga.x, this.amiga.z)) Object.assign(this.amiga, { x: L.def.x0 + this.AMIGA.porta[0], z: L.def.z0 + this.AMIGA.porta[1] });
  },
  // arar, plantar, regar ou colher o canteiro c (sem enxada, regador nem vigor: ela é da casa)
  cuidarCanteiro(L, c) {
    const j = this.amiga, agora = Date.now(), t = L.horta[c];
    if (!t) L.horta[c] = { c: '', g: 0, w: 0, u: agora };
    else if (!t.c) {
      const s = this.AMIGA.plantas.find((s) => contar(j.prog.mochila, 'semente_' + s) > 0) || sorteia(this.AMIGA.plantas);
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
      const [px, pz] = this.AMIGA.porta, porta = [{ x: L.def.x0 + px, z: L.def.z0 + pz }, { x: L.def.x0 + px, z: L.def.z0 + pz - 1.8 }];
      if (this.dentroDaCasa(L, j)) rota.unshift(...porta.slice().reverse()); else rota.push(...porta);
    }
    rota.push(alvo);
    Object.assign(j.ia, { fase: 'andar', rota, chegou, preso: 0, longe: Infinity });
  },
  dentroDaCasa(L, p) { const [a0, b0, a1, b1] = this.AMIGA.dentro; return p.x > L.def.x0 + a0 + 0.2 && p.x < L.def.x0 + a1 - 0.2 && p.z > L.def.z0 + b0 + 0.2 && p.z < L.def.z0 + b1 - 0.2; },
  // De fora para fora, a linha reta passa pela casa (ela está atrás ou do lado): o canto por onde dá a volta, ou null.
  // Atrás: primeiro o canto de trás do lado mais perto, depois o da frente; dali a porta fica à vista (André 2026-11-12,
  // "ficam caminhando sem sair do lugar... batendo na parede lá da casa deles").
  contornoCasa(L, de, ate) {
    if (!L?.pecas.some((p) => p.k === 'parede')) return null;
    const [a0, b0, a1, b1] = this.AMIGA.dentro, M = 0.9, f = 0.3;
    const X0 = L.def.x0 + a0, X1 = L.def.x0 + a1, Z0 = L.def.z0 + b0, Z1 = L.def.z0 + b1;
    const naCasa = (x, z) => x > X0 - f && x < X1 + f && z > Z0 - f && z < Z1 + f;
    if (naCasa(de.x, de.z) || naCasa(ate.x, ate.z)) return null; // entrar e sair é pela porta (irPara)
    let corta = false;
    for (let k = 1; k < 24 && !corta; k++) corta = naCasa(de.x + (ate.x - de.x) * k / 24, de.z + (ate.z - de.z) * k / 24);
    if (!corta) return null;
    const lado = de.x < (X0 + X1) / 2 ? X0 - M : X1 + M;
    if (de.z < Z0 && Math.abs(de.x - lado) > 0.4) return { x: lado, z: Z0 - M }; // atrás da casa: o canto de trás
    if (de.z > Z1) return { x: lado, z: Z1 + M }; // na frente (indo para trás): o canto da frente
    return ate.z > Z1 ? { x: lado, z: Z1 + M } : { x: lado, z: Z0 - M }; // do lado: o canto do lado de onde quer chegar
  },
  andarAmiga(j, dt) {
    const ia = j.ia;
    { const c = ia.rota[0] && this.contornoCasa(this.loteDaAmiga(), j, ia.rota[0]); if (c) { ia.rota.unshift(c); ia.preso = 0; ia.longe = Infinity; } } // a casa no caminho: dá a volta
    const alvo = ia.rota[0];
    if (!alvo) { this.pararAmiga(j); ia.fase = 'pensar'; ia.ate = this.tempo + 0.3; const f = ia.chegou; ia.chegou = null; f?.(); return; }
    const dx = alvo.x - j.x, dz = alvo.z - j.z, d = Math.hypot(dx, dz);
    if (d < (ia.rota.length > 1 ? 1.2 : 0.35)) { ia.rota.shift(); ia.preso = 0; ia.longe = Infinity; return; }
    // a um passo do ponto e sem chegar mais perto (tocha, banco, gente em cima dele): já chegou, não fica rodando em volta
    if (ia.rota.length === 1 && d < 1 && ia.preso > 0.8) { ia.rota.shift(); ia.preso = 0; ia.longe = Infinity; return; }
    // não chega mais perto (algo no caminho): depois de 3 s aparece no ponto (melhor que ficar empurrando a parede)
    if (d < ia.longe - 0.05) { ia.longe = d; ia.preso = 0; } else if ((ia.preso += dt) > 3) { this.teleportes = (this.teleportes | 0) + 1; Object.assign(j, { x: alvo.x, z: alvo.z, y: this.terreno.altura(alvo.x, alvo.z) }); ia.rota.shift(); ia.preso = 0; ia.longe = Infinity; return; }
    const corre = d + ia.rota.length * 8 > 14;
    j.entrada = { mx: dx / d * (d < 1 ? Math.max(0.4, d) : 1), mz: dz / d * (d < 1 ? Math.max(0.4, d) : 1), correr: corre };
  },
  // ---------- conversa (só o dono) ----------
  // m = { acao: 'oi' | 'casa' | 'ajuda' | 'dar' | 'time' | 'dungeon' | 'troca' | 'tchau' }
  conversaAmiga(id, m) {
    const j = this.jogadores.get(id), a = this.amiga;
    if (!j || !a || !this.podeAmiga(id) || !m || typeof m.acao !== 'string') return;
    if (Math.hypot(a.x - j.x, a.z - j.z) > 4.5) return this.evento({ t: 'aviso', para: id, texto: `Chegue mais perto de ${this.AMIGA.nome}` });
    const F = this.AMIGA.falas, diga = (texto, extra = {}) => this.evento({ t: 'fala', para: id, npc: this.AMIGA.id, texto, pedido: a.pedido ? { k: a.pedido.k, n: a.pedido.n, nome: ITENS[a.pedido.k].nome } : null, amizade: this.amizadeAmiga(j), noTime: !!(a.time && a.time === j.time), ...extra });
    if (!this.trocarDonoAmiga(id) && !['oi', 'casa', 'horta', 'dungeon', 'tchau', 'ajuda'].includes(m.acao)) return diga(this.comOutroAmiga());
    const nomeItem = (p) => `${p.n} ${ITENS[p.k].nome.toLowerCase()}`;
    a.ia.conversaAte = m.acao === 'tchau' ? 0 : this.tempo + this.AMIGA.conversa;
    if (a.ia.fase === 'trabalhar') { a.ia.ate = Math.max(a.ia.ate, this.tempo); } // larga o trabalho na hora e volta depois
    const L = this.loteDaAmiga(), pronta = L && this.AMIGA.casa.every((c) => L.pecas.some((o) => mesmaPeca(o, pecaDaCasa(L.def, c))));
    switch (m.acao) {
      case 'oi': return diga(sorteia(F.oi));
      case 'casa': return diga(pronta ? sorteia(F.pronta) : sorteia(F.obra));
      case 'horta': return diga(sorteia(F.horta));
      case 'time': {
        if (a.time && a.time === j.time) return diga(sorteia(F.jaNoTime));
        const topou = this.combinouAmiga(a) || (a.ia.chamado?.quer === 'time' && a.ia.chamado.ate > this.tempo);
        if (!topou && (a.ia.recusaAte || 0) > this.tempo) return diga(F.recusa.jaFalei);
        const v = this.decisaoTimeAmiga(a, j);
        if (!topou && !v.aceita) { this.recusarTimeAmiga(a, j, v.motivo); return diga(F.recusa[v.motivo] || F.recusa.vontade); }
        if (!this.entrarTimeAmiga(a, j)) { a.ia.recusaAte = this.tempo + 5; return diga(F.recusa.cheio); }
        a.ia.conversaAte = this.tempo + 2;
        return diga(sorteia(F.time), { time: true });
      }
      case 'dungeon': return diga(sorteia(F.dungeon));
      case 'troca': { const r = this.abrirTrocaAmiga(j); return diga(r === true ? sorteia(this.AMIGA.falasTroca.abre) : r); }
      case 'tchau': return diga(sorteia(F.tchau));
      case 'sair': { // o dono tira ela do time pela conversa
        if (a.time && a.time === j.time) { a.ia.noTime = false; this.sairDoTime(a, `${this.AMIGA.nome} saiu do time`); a.ia.fase = 'pensar'; this.pocoesAmiga(a); }
        return diga(F.voltou);
      }
      case 'ajuda': {
        if (!a.pedido && Math.random() < this.AMIGA.equipInteresse.pedir && this.pecaFracaAmiga()) return diga(this.pedeEquipAmiga());
        if (!a.pedido && Math.random() < 0.7) { const p = sorteia(this.AMIGA.pedidos); a.pedido = { k: p.k, n: p.n }; this.guardarAmiga(); }
        return diga(a.pedido ? sorteia(F.pedido).replace('{item}', nomeItem(a.pedido)) : sorteia(F.semPedido));
      }
      case 'dar': {
        const p = a.pedido; if (!p) return diga(sorteia(F.semPedido));
        if (contar(j.prog.mochila, p.k) < p.n) return diga(sorteia(F.falta).replace('{item}', nomeItem(p)));
        tirar(j.prog.mochila, p.k, p.n);
        guardar(a.prog.mochila, { k: p.k, n: p.n });
        // paga com o que colheu (o que tiver mais) ou em ouro
        let paga = '';
        const colheita = this.AMIGA.plantas.map((k) => [k, contar(a.prog.mochila, k)]).sort((x, y) => y[1] - x[1])[0];
        if (colheita && colheita[1] > 0) {
          const n = Math.min(colheita[1], 4), prova = j.prog.mochila.map((o) => (o ? { ...o } : null));
          if (guardar(prova, { k: colheita[0], n })) { j.prog.mochila = prova; tirar(a.prog.mochila, colheita[0], n); paga = `${n} ${ITENS[colheita[0]].nome.toLowerCase()}`; }
        }
        if (!paga) { const ouro = Math.max(5, (ITENS[p.k].venda || 2) * p.n * 2); j.prog.ouro += ouro; paga = `${ouro} de ouro`; }
        a.pedido = null;
        this.ganharAmizadeAmiga(j, 1, false);
        this.guardarAmiga();
        this.avisarProg(j);
        return diga(sorteia(F.obrigada).replace('{paga}', paga));
      }
    }
  },
  // ---------- fase 2: time e combate (André 2026-11-09) ----------
  // fala dela que aparece para o dono mesmo sem a janela aberta (aviso no topo)
  comOutroAmiga() { return sorteia(this.AMIGA.chat.falas.comOutro).replace('{nome}', this.jogadores.get(this.amigaDono)?.nome || 'outro amigo'); },
  falarAmiga(texto) { if (this.amigaDono) this.evento({ t: 'fala', para: this.amigaDono, npc: this.AMIGA.id, texto: `${this.AMIGA.nome}: ${texto}` }); },
  // completa as poções dela até this.AMIGA.time.pocoes (ela passa na Rosa quando volta para casa)
  pocoesAmiga(j) { // compra na Rosa com o ouro dela, pelo preço da loja (André 2026-11-09: nada de poção de graça)
    this.consertoAmiga(j); // antes da poção: equipamento gasto passa no Tomás
    const preco = ITENS.pocao.preco || 15;
    const falta = Math.min(this.AMIGA.time.pocoes + (j.licoes?.pocoes || 0) - contar(j.prog.mochila, 'pocao'), Math.floor(j.prog.ouro / preco));
    if (falta > 0 && guardar(j.prog.mochila, { k: 'pocao', n: falta })) j.prog.ouro -= falta * preco;
  },
  // conserto (André 2026-11-11: "reparar sozinho com gold deles"): quando volta para casa ou cai, leva o que está gasto ao
  // Tomás e paga o preço normal do conserto (custoConserto) com o próprio ouro. Primeiro as peças do corpo, a mais gasta
  // antes; sem ouro para tudo, conserta só o que dá. Devolve quantas consertou.
  consertoAmiga(j) {
    const p = j.prog, gastas = pecasGastas(p).filter((x) => x.onde === 'equip')
      .sort((a, b) => durabilidade(p.equip[a.l]) - durabilidade(p.equip[b.l]));
    let n = 0;
    for (const x of gastas) {
      if ((p.ouro || 0) < x.custo) continue;
      p.ouro -= x.custo; delete p.equip[x.l].d; n++;
    }
    if (n) { this.aplicarStatus(j); j.progSujo = true; }
    return n;
  },
  // vontade de entrar no time (0 a 1) e o motivo mais forte contra. Regras com sorteio, sem IA paga.
  vontadeAmiga(a, dono) {
    const R = this.AMIGA.time, contra = [];
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
  // André 2026-11-13 ("acabou de me negar e duas falas depois me chama pra caçar"): a vontade de caçar é sorteada UMA vez e
  // vale por um tempo (AMIGA.time.humor s). A IA fica sabendo antes de falar (contextoAmiga.humor) e o jogo usa o mesmo
  // sorteio quando ele chama: o que ela fala e o que ela faz batem, e ela não muda de ideia a cada mensagem.
  decisaoTimeAmiga(a, j, guardar = false) {
    const ia = a.ia, h = ia.humor;
    // um não dado vale enquanto durar a recusa; o sorteio contado à IA (guardar, de contextoAmiga) vale 'humor' s
    if (h && h.conta === j.conta && (h.recusa ? (ia.recusaAte || 0) > this.tempo : h.ate > this.tempo)) return h;
    const v = this.vontadeAmiga(a, j), novo = { ate: this.tempo + (this.AMIGA.time.humor ?? 90), conta: j.conta, aceita: Math.random() < v.p, motivo: v.motivo };
    if (guardar) ia.humor = novo;
    return novo;
  },
  // recusou: fica recusando por uns minutos (AMIGA.time.humorRecusa), como gente que disse não e não muda a cada fala
  recusarTimeAmiga(a, j, motivo) {
    const T = this.AMIGA.time; a.ia.recusaAte = this.tempo + Math.max(T.esperaRecusa, T.humorRecusa ?? 180);
    a.ia.humor = { ate: a.ia.recusaAte, conta: j.conta, aceita: false, motivo: motivo || a.ia.humor?.motivo || 'vontade', recusa: true };
  },
  timeCheioAmiga(j) { return !!(j.time && j.time.membros.length >= TIME.max); },
  // André 2026-11-13 ("como se fosse um jogador real"): o botão de time só convida, sem fala nenhuma no chat.
  // Combinou pelo chat (ou ela chamou para o time): entra. Sem combinar: decide como sempre (pode recusar).
  conviteTimeAmiga(id) {
    const a = this.amiga, j = this.jogadores.get(id), nome = this.AMIGA.nome; if (!a || !j) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if (!this.podeAmiga(id)) return aviso(`${nome} não pode entrar no seu time agora`);
    if (a.time && a.time === j.time) return aviso(`${nome} já está no seu time`);
    if (a.time) return aviso(`${nome} já está em outro time`);
    if (this.timeCheioAmiga(j)) return aviso(`O time já tem ${TIME.max} pessoas`);
    if (!this.trocarDonoAmiga(id)) return aviso(`${nome} está com outra pessoa agora`);
    const ia = a.ia, recusa = () => aviso(`${nome} recusou o convite para o time`);
    if (a.morto) return recusa();
    const topou = this.combinouAmiga(a) || (ia.chamado?.quer === 'time' && ia.chamado.ate > this.tempo);
    if (!topou && (ia.recusaAte || 0) > this.tempo) return recusa();
    const dv = this.decisaoTimeAmiga(a, j);
    if (!topou && !dv.aceita) { this.recusarTimeAmiga(a, j, dv.motivo); return recusa(); }
    if (!this.entrarTimeAmiga(a, j)) return aviso(`O time já tem ${TIME.max} pessoas`);
    const plano = this.AMIGA.atividades[ia.plano] ? ia.plano : null;
    ia.chamado = null; ia.vir = null; ia.plano = null;
    this.gostoAmiga(j, plano || 'time');
    if (plano) { if (ia.atividade && ia.atividade !== plano) this.fimAtividadeAmiga(a, true); this.comecarAtividadeAmiga(a, plano); }
  },
  sairTimeAmiga(id) { // tirar do time pelo botão (sem fala)
    const a = this.amiga, j = this.jogadores.get(id); if (!a || !j || !(a.time && a.time === j.time)) return;
    a.ia.noTime = false; this.sairDoTime(a, `${this.AMIGA.nome} saiu do time`); a.ia.fase = 'pensar'; this.pocoesAmiga(a);
  },
  // entra no time do dono (o mesmo time de jogadores: XP dividido, barras e pontos no minimapa). false = não coube
  entrarTimeAmiga(a, dono) {
    let T = dono.time;
    if (!T) { T = { lider: dono.id, membros: [dono.id] }; dono.time = T; (this.times ||= new Set()).add(T); }
    if (T.membros.length >= TIME.max) return false;
    T.membros.push(a.id); a.time = T;
    for (const k of T.membros) if (k !== a.id) this.evento({ t: 'aviso', para: k, texto: `${this.AMIGA.nome} entrou no time` });
    Object.assign(a.ia, { fase: 'seguir', chegou: null, preso: 0, noTime: true, av: null, viagem: null });
    this.mudouTime(T);
    return true;
  },
  // o monstro que ela vai bater: o mais perto dela entre os que estão perto do dono, quando alguém do time está lutando
  alvoAmiga(j, dono) {
    if (!this.emCombate(dono) && !this.emCombate(j)) return null;
    let melhor = null, md = Infinity;
    for (const e of this.inimigosDe(j)) {
      if (e.treino || Math.hypot(e.x - dono.x, e.z - dono.z) > this.AMIGA.time.ajudar) continue;
      if (this.regraAmiga('naoChefe') && (e.tipo === 'chefe' || TIPOS_INIMIGO[e.tipo]?.chefe) && !(e.alvo === j.id)) continue; // ele ensinou: chefe só se vier nela
      const d = Math.hypot(e.x - j.x, e.z - j.z); if (d < md) { md = d; melhor = e; }
    }
    return melhor;
  },
  passoTimeAmiga(j, dono, dt) {
    const R = this.AMIGA.time, ia = j.ia, d = Math.hypot(dono.x - j.x, dono.z - j.z);
    // ficou muito para trás (o dono voltou para a vila, disparou no lobo...): monta no lobo e vem pela estrada até ele
    // (André 2026-11-10: nada de aparecer do lado; antes, de R.longe m para lá, ela surgia atrás dele)
    this.cavernaAmiga(j, dono);
    if (this.longeAmiga(j, dono, d, dt)) return;
    if (j.trava > 0) return this.pararAmiga(j);
    const alvo = this.alvoAmiga(j, dono);
    // montaria: monta quando o dono monta (e desce para lutar)
    const monta = !!dono.montado && !alvo && !ia.atividade; // coletando: a pé
    if (monta !== !!j.montado) j.montado = monta ? (MONTARIAS[dono.montado] ? dono.montado : 'lobo') : null;
    // combate pelo cérebro por regras (André 2026-11-11, shared/cerebro.js + CEREBRO em dados.js): poção, Cura (nela e
    // em quem do time está mal), fugir sem poção, recuar do golpe carregado, proteger aliado, atacar de espada ou cajado
    if (this.cerebroAmiga(j, dono, alvo)) return;
    if (alvo && (j.coleta || j.pesca)) { this.pararColeta(j, null); if (j.pesca) this.pararPesca(j, null); } // monstro: larga a coleta
    if (!alvo && ia.atividade && this.passoAtividadeAmiga(j, dono)) return; // coletando junto (pesca, minério, lenha)
    // seguindo: fica um pouco atrás e do lado dele
    const seguir = this.regraAmiga('seguir') ?? R.seguir; // "anda mais perto de mim" (memória)
    const ang = dono.ry + Math.PI + 0.7, px = dono.x + Math.sin(ang) * seguir, pz = dono.z + Math.cos(ang) * seguir;
    const dp = Math.hypot(px - j.x, pz - j.z);
    if (dp < 0.6 || (d < seguir + 0.8 && !dono.montado)) return this.pararAmiga(j);
    this.irDireto(j, px, pz, dp > R.correr || !!dono.montado);
  },
  // ---------- cérebro por regras (André 2026-11-11: "eles agem muito robozão"; estilo bots do WoW) ----------
  // ---------- aprender com a morte (entrega 4, André 2026-11-11; sem IA) ----------
  // Caiu: olha o que viu na última decisão (ia.cer.s) e quem deu o último golpe (j.golpeDe) e mexe nos próprios limites
  // (CEREBRO.morte). Devolve a frase do que aprendeu (ela fala se estiver no time).
  aprenderMorteAmiga(j) {
    const M = CEREBRO.morte, L = (j.licoes ||= {}), s = j.ia.ultS || {}, k = j.golpeDe, n = j.prog.nivel | 0;
    const soma = (q) => { const v = Math.min(M.max[q], (L[q] || 0) + M.passo[q]); const mudou = v > (L[q] || 0); L[q] = Math.round(v * 100) / 100; return mudou; };
    const chefe = !!k && !!(k.tipo === 'chefe' || TIPOS_INIMIGO[k.tipo]?.chefe || k.hc || k.bm);
    const aprendeu = [];
    if (contar(j.prog.mochila, 'pocao') > 0) { if (soma('pocao')) aprendeu.push('pocao'); } // morreu com poção sobrando
    else if (soma('pocoes')) aprendeu.push('pocoes'); // acabou a poção: leva mais
    if (k && !chefe && (k.nivel || 1) - n >= M.acima && soma('acima')) aprendeu.push('acima');
    if ((s.pertoDeMim || 0) >= M.cercado && soma('fugir')) aprendeu.push('fugir');
    if ((chefe || s.preparoChefe || s.naAreaDePerigo) && soma('recuar')) aprendeu.push('recuar');
    L.mortes = (L.mortes | 0) + 1;
    L.ultima = { de: k ? String(TIPOS_INIMIGO[k.tipo]?.nome || k.tipo || '') : '', nivel: k?.nivel || 0, t: Date.now() };
    j.golpeDe = null; j.ia.regrasOrd = null;
    // a lição que mais pesou primeiro (o golpe de chefe e o monstro forte explicam mais que a poção)
    const ordem = ['acima', 'recuar', 'fugir', 'pocoes', 'pocao'], f = ordem.find((q) => aprendeu.includes(q));
    return M.falas[f || 'nada'];
  },
  // subiu de nível: a lição perde um pedaço (CEREBRO.morte.esquece por nível); o 'acima' volta um nível por vez
  esquecerMorteAmiga(j, niveis = 1) {
    const M = CEREBRO.morte, L = j.licoes; if (!L) return;
    for (let i = 0; i < niveis; i++) for (const q of Object.keys(M.max)) {
      if (!L[q]) continue;
      L[q] = q === 'acima' || q === 'pocoes' ? Math.max(0, L[q] - 1) : Math.floor(L[q] * (1 - M.esquece) * 100) / 100;
      if (L[q] < 0.01) delete L[q];
    }
  },
  // O que ela enxerga agora (os sentidos que as regras de CEREBRO.regras leem). alvo = o monstro do alvoAmiga.
  sentidosAmiga(j, dono, alvo) {
    const C = CEREBRO, R = this.AMIGA.time, J = this.AMIGA.justa, ia = j.ia, t = this.tempo;
    const jeito = C.jeitos[this.AMIGA.id] || C.jeitos.padrao;
    const Li = j.licoes || {}; // o que aprendeu caindo: bebe, foge e recua mais cedo
    const s = limites(jeito, { pocao: Math.min(0.95, (this.regraAmiga('pocao') ?? R.pocao) + (Li.pocao || 0)), curaDono: this.regraAmiga('curaDono') ?? J.curaDono, curaVida: J.curaVida, fugir: Math.min(0.9, R.fugir + (Li.fugir || 0)) });
    s.limRecuar = Math.min(0.95, s.limRecuar + (Li.recuar || 0));
    s.vida = j.vida / j.vidaMax; s.mana = j.mana / (j.manaMax || 1);
    s.temPocao = j.prog.mochila.some((o) => o?.k === 'pocao');
    s.pocaoPronta = (ia.pocaoT || 0) <= t && (j.pocaoAte?.pocao || 0) <= t;
    s.curaPronta = this.habOkAmiga(j, 'cura_floresta') && !(j.trava > 0); // Cura da Floresta (a do jogador, libera no Nv 6)
    const inimigos = this.inimigosDe(j);
    // aliados do time (o dono e os outros amigos): o mais machucado e quem está apanhando
    const aliados = (j.time?.membros || [dono.id]).filter((k) => k !== j.id).map((k) => this.jogadores.get(k)).filter((o) => o && !o.morto);
    let mal = null, bate = null, bateEm = null;
    for (const o of aliados) {
      if (!mal || o.vida / o.vidaMax < mal.vida / mal.vidaMax) mal = o;
      const e = inimigos.find((e) => !e.treino && e.vez === o.id && Math.hypot(e.x - j.x, e.z - j.z) < R.ajudar);
      if (e && (!bateEm || o.vida / o.vidaMax < bateEm.vida / bateEm.vidaMax)) { bate = e; bateEm = o; }
    }
    s.aliadoVida = mal ? mal.vida / mal.vidaMax : 1; s.aliadoPerto = !!mal && Math.hypot(mal.x - j.x, mal.z - j.z) < R.ajudar;
    s.aliadoApanhando = !!bate; s.apanhandoVida = bateEm ? bateEm.vida / bateEm.vidaMax : 1;
    // monstro com o braço levantado (preparo do golpe) vindo nela
    const prep = inimigos.find((e) => e.preparoAte > t && e.vez === j.id && Math.hypot(e.x - j.x, e.z - j.z) < C.preparoPerto);
    s.preparando = !!prep; s.preparoChefe = !!prep && !!(prep.tipo === 'chefe' || TIPOS_INIMIGO[prep.tipo]?.chefe || prep.hc || prep.bm);
    // área marcada no chão (skill de boss de mundo com aviso, ou poça que fica): sai dela como um jogador atento
    let area = null;
    for (const e of inimigos) if (e.perigo?.ate > t) { const F = e.perigo.formas.find((F) => this.dentroDaForma(F, j)); if (F) { area = { F, bx: e.x, bz: e.z }; break; } }
    if (!area) for (const f of this.camposBoss || []) if (Math.hypot(f.x - j.x, f.z - j.z) <= f.r + 0.3) { area = { F: { f: 'c', x: f.x, z: f.z, r: f.r } }; break; }
    s.naAreaDePerigo = !!area;
    s.alvoChefe = !!alvo && !!(alvo.tipo === 'chefe' || TIPOS_INIMIGO[alvo.tipo]?.chefe || alvo.hc || alvo.bm);
    s.alvoAcima = alvo ? (alvo.nivel || 1) - (j.prog.nivel | 0) : 0;
    s.arma = j.modo === 'Magia' ? 'Magia' : 'Espada';
    s.temAlvo = !!alvo; s.distAlvo = alvo ? Math.hypot(alvo.x - j.x, alvo.z - j.z) : 99;
    s.pertoDeMim = 0; s.agrupados = 0;
    for (const e of inimigos) {
      if (e.treino) continue;
      if (Math.hypot(e.x - j.x, e.z - j.z) < 3) s.pertoDeMim++;
      if (alvo && Math.hypot(e.x - alvo.x, e.z - alvo.z) < C.agrupados) s.agrupados++;
    }
    return { s, jeito, mal, bate, prep, area };
  },
  // Decide (CEREBRO.pensar vezes por segundo) e executa. true = já cuidou do passo; false = segue o resto (coleta, seguir).
  cerebroAmiga(j, dono, alvo) {
    const C = CEREBRO, ia = j.ia, t = this.tempo;
    if (ia.cerT == null) ia.cerT = t + Math.random() / C.pensar; // cada NPC pensa num tick diferente
    let c = ia.cer;
    if (t >= ia.cerT && !(c && c.ate > t)) {
      ia.cerT = t + 1 / C.pensar;
      const v = this.sentidosAmiga(j, dono, alvo); ia.ultS = v.s; const r = decidir(v.s, ia.regrasOrd ||= ordenarRegras([...C.regras, ...(j.dicas || [])]));
      c = ia.cer = r ? { faca: r.faca, id: r.id, ate: 0, s: v.s, jeito: v.jeito, aliado: v.mal?.id, alvo: (r.faca === 'proteger' ? v.bate : alvo)?.id, de: v.prep?.id, area: v.area } : null;
      if (c?.faca === 'recuar') { c.ate = t + (r.pri === undefined || !r.id.startsWith('dica') ? C.recuar : r.por); if (!c.de && alvo) c.de = alvo.id; } // dica: recua do alvo pelo tempo dela
      if (c?.faca === 'usarCajado' || c?.faca === 'usarEspada') { ia.armaForcada = { modo: c.faca === 'usarCajado' ? 'Magia' : 'Espada', ate: t + Math.max(r.por || 0, C.trocaMin) }; c.faca = 'atacar'; }
      if (c?.faca === 'pocao') { // uma vez: bebe e pensa de novo no próximo tick
        const i = j.prog.mochila.findIndex((o) => o?.k === 'pocao');
        if (i >= 0) { ia.pocaoT = t + 2; this.item(j.id, { acao: 'usar', i }); }
        ia.cer = null; ia.cerT = t; return false;
      }
      if (c?.faca === 'curarSi') { ia.cer = null; this.pararAmiga(j); this.usarHabQ(j.id, 'cura_floresta'); return true; }
    }
    if (!c) return false;
    const achar = (id) => this.inimigos.find((e) => e.id === id && !e.morto);
    if (c.faca === 'curarAliado') {
      const o = this.jogadores.get(c.aliado);
      if (!o || o.morto || !this.habOkAmiga(j, 'cura_floresta')) { ia.cer = null; return false; }
      const d = Math.hypot(o.x - j.x, o.z - j.z);
      if (d > (HABS.cura_floresta.grupo || 8) - 1) return this.irDireto(j, o.x, o.z, true), true;
      this.pararAmiga(j); ia.cer = null; this.usarHabQ(j.id, 'cura_floresta'); return true;
    }
    if (c.faca === 'fugir' || c.faca === 'naoAtacar') return false; // o seguir leva para perto do dono
    if (c.faca === 'recuar') {
      const e = achar(c.de); if (!e || c.ate <= t) { ia.cer = null; return !!e; }
      const dx = j.x - e.x, dz = j.z - e.z, d = Math.hypot(dx, dz) || 1;
      j.entrada = { mx: dx / d, mz: dz / d, correr: true }; return true;
    }
    if (c.faca === 'sairDaArea') { // corre para fora: círculo = para longe do meio; linha = para o lado; cone = para longe do boss
      const { F, bx, bz } = c.area;
      if (!this.dentroDaForma(F, j)) { c.fora = (c.fora || 0) + 1; if (c.fora > 6) { ia.cer = null; return false; } } // um passinho a mais e pensa de novo
      let mx, mz;
      if (F.f === 'l') { const fx = Math.sin(F.ry), fz = Math.cos(F.ry), lado = (j.x - F.x) * fz - (j.z - F.z) * fx >= 0 ? 1 : -1; mx = fz * lado; mz = -fx * lado; }
      else { const cx = F.f === 'v' ? bx ?? F.x : F.x, cz = F.f === 'v' ? bz ?? F.z : F.z, dx = j.x - cx, dz = j.z - cz, d = Math.hypot(dx, dz); if (d < 0.1) { mx = Math.sin(j.ry + Math.PI / 2); mz = Math.cos(j.ry + Math.PI / 2); } else { mx = dx / d; mz = dz / d; } }
      c.ate = t + 0.5; j.entrada = { mx, mz, correr: true }; return true;
    }
    const e = c.faca === 'proteger' ? achar(c.alvo) || alvo : alvo;
    if (!e) { ia.cer = null; return false; }
    return this.atacarAmiga(j, e, c);
  },
  // ---------- dica vira regra (entrega 2, André 2026-11-11) ----------
  // O que a mensagem é: 'dica' (vira regra pela IA, uma chamada), 'esquecer' / 'listar' (pelas regras) ou null (conversa).
  tipoDicaAmiga(texto) {
    const t = ' ' + normAmiga(texto) + ' ';
    if (/ (esquece|esqueca|apaga|desaprende)\w* (a |as |essa |essas |aquela |todas as |tudo |a ultima |as suas )?(dica|dicas|regra|regras|tudo|ultima)/.test(t)) return 'esquecer';
    if (/ (o que|quais|que) (voce |vc )?(aprendeu|sabe fazer|dicas)| suas dicas | lista de dicas /.test(t)) return 'listar';
    const quando = / (quando|se|sempre|nunca|toda vez|cuidado|evita|evite|prefere|prefira|antes de|depois de|com pouca|com menos|contra) /.test(t);
    const faz = / (recu|fug|foge|cur|poc|bebe|beba|troc|cajad|espad|magia|proteg|ajud|ataca|ataque|bate|sai |sair|afast|chega|longe|perto|distanc)/.test(t);
    return quando && faz ? 'dica' : null;
  },
  // a IA devolveu a regra (ou null, se não deu): confere, guarda no NPC (vale para todos) e responde
  aprenderDicaAmiga(id, regra, texto) {
    const a = this.amiga, j = this.jogadores.get(id); if (!a || !j) return false;
    const r = regra && validarRegra({ ...regra, id: 'dica' + Date.now().toString(36), autor: j.conta || j.nome, t: Date.now() }, CEREBRO);
    if (!r) return false; // o servidor responde como conversa normal (CEREBRO.falas.naoEntendi fica para quem chamar sem IA)
    const { lista, trocou } = juntarDica(a.dicas || [], r, CEREBRO.dicas.max);
    a.dicas = lista; a.ia.regrasOrd = null; // o cérebro pega a lista nova na próxima decisão
    this.guardarAmiga();
    this.dizerAmiga((trocou ? CEREBRO.falas.trocou : CEREBRO.falas.aprendeu).replace('{regra}', r.texto), false, id);
    return true;
  },
  comandoDicaAmiga(id, tipo, texto) {
    const a = this.amiga; if (!a) return;
    const l = a.dicas || [];
    if (tipo === 'listar') return this.dizerAmiga(l.length ? CEREBRO.falas.lista.replace('{lista}', l.map((d, i) => `${i + 1}) ${d.texto}`).join('; ')) : CEREBRO.falas.nenhuma, false, id);
    if (!l.length) return this.dizerAmiga(CEREBRO.falas.nenhuma, false, id);
    const t = normAmiga(texto), num = t.match(/\b(\d{1,2})\b/);
    if (/todas|tudo/.test(t)) a.dicas = [];
    else if (num && +num[1] >= 1 && +num[1] <= l.length) a.dicas = l.filter((_, i) => i !== +num[1] - 1);
    else a.dicas = l.slice(0, -1); // "esquece a última dica" (ou sem dizer qual)
    a.ia.regrasOrd = null; this.guardarAmiga();
    this.dizerAmiga(CEREBRO.falas.esqueci, false, id);
  },
  // a skill nova (HABS) dá para usar agora? nível, barra, recarga e mana, igual ao botão do jogador
  habOkAmiga(j, hid) {
    const B = HABS[hid]; if (!B || B.libera > (j.prog.nivel | 0) || j.canal) return false;
    if (!B.basico && !['espada', 'cajado'].some((b) => j.prog.barras?.[b]?.includes(hid))) return false;
    if ((j.cds[hid] || 0) > this.tempo) return false;
    const h = this.habPronta(j, hid); return !(h.mana && j.mana < h.mana);
  },
  // a skill da barra da arma na mão que combina com a situação (área quando tem vários perto; avanço quando está longe)
  escolherSkillAmiga(j, alvo, da, c) {
    const barra = j.modo === 'Magia' ? 'cajado' : 'espada', perto = c?.s?.pertoDeMim || 0, juntos = c?.s?.agrupados || 0;
    const peso = { corte_duplo: 2, giro: perto >= 2 ? 4 : 0.5, golpe_esmagador: 2, pisao_sismico: perto >= 2 ? 4 : 0.5, investida: da > 3 && da < 9 ? 4 : 0.3,
      bola_fogo: 3, anel_chamas: da < 4.5 || perto >= 2 ? 4 : 0, meteoro: juntos >= 2 ? 4 : 1.5, nova_gelo: da < 5.5 ? (perto >= 2 ? 4 : 1) : 0, raio_cadeia: juntos >= 2 ? 4 : 1 };
    const l = (j.prog.barras?.[barra] || []).filter((k) => k && peso[k] > 0 && this.habOkAmiga(j, k));
    let soma = l.reduce((a, k) => a + peso[k], 0), r = Math.random() * soma;
    for (const k of l) { r -= peso[k]; if (r <= 0) return k; }
    return null;
  },
  // ataque com a arma da situação (sem classe: o estilo é a arma). Usa as skills novas do jogador (HABS: Ataque de espada,
  // Faísca, Bola de Fogo, Meteoro...), com o mesmo efeito e o mesmo som. Espada: colada no monstro. Cajado: fica a
  // CEREBRO.magia m, se afasta quando ele chega perto, Faísca e as skills da barra do cajado quando tem mana.
  atacarAmiga(j, alvo, c) {
    const C = CEREBRO, R = this.AMIGA.time, ia = j.ia, t = this.tempo;
    if (j.canal) return this.pararAmiga(j), true; // concentrando a magia: fica parado até sair
    const da = Math.hypot(alvo.x - j.x, alvo.z - j.z);
    const forcada = ia.armaForcada?.ate > t ? ia.armaForcada.modo : null; // dica: "usa o cajado no chefe"
    if (forcada) { if (j.modo !== forcada) { this.trocarModo(j.id, forcada); ia.armaT = t + C.trocaMin; } }
    else if (t >= (ia.armaT || 0)) {
      const s = { ...c.s, distAlvo: da, vida: j.vida / j.vidaMax, mana: j.mana / (j.manaMax || 1) };
      const quer = escolherArma(s, c.jeito, j.modo, C);
      if (quer !== j.modo) { this.trocarModo(j.id, quer); ia.armaT = t + C.trocaMin; }
    }
    const skill = () => { // de vez em quando uma skill da barra da arma; false = nenhuma pronta agora
      if (t < (ia.skillT || 0)) return false;
      ia.skillT = t + R.skill * (0.7 + Math.random() * 0.6);
      const k = this.escolherSkillAmiga(j, alvo, Math.hypot(alvo.x - j.x, alvo.z - j.z), c);
      if (!k) return false;
      this.usarHabQ(j.id, k); return true;
    };
    if (j.modo === 'Magia') {
      const [min, , max] = C.magia;
      j.ry = Math.atan2(alvo.x - j.x, alvo.z - j.z);
      if (da < min && !(j.trava > 0)) { const d = da || 1; j.entrada = { mx: (j.x - alvo.x) / d, mz: (j.z - alvo.z) / d, correr: true }; return true; }
      if (da > max) return this.irDireto(j, alvo.x, alvo.z, true), true;
      this.pararAmiga(j);
      if (!skill() && t >= (ia.basicoT || 0)) { ia.basicoT = t + C.basicoCd; this.usarHabQ(j.id, 'cajado_basico'); }
      return true;
    }
    if (da > 1.9) return this.irDireto(j, alvo.x, alvo.z, da > 4), true;
    this.pararAmiga(j);
    j.ry = Math.atan2(alvo.x - j.x, alvo.z - j.z);
    if (!skill() && t >= (ia.basicoT || 0)) { ia.basicoT = t + C.basicoCd; this.usarHabQ(j.id, 'espada_basico'); }
    return true;
  },
  // ---------- viagem até o dono (André 2026-11-10: "ela entra na montaria e vem até mim, não se teleporta; eu vejo ela
  // no mapa vindo na minha direção, como um jogador normal"; "vai pelas estradas para não travar") ----------
  // true = está viajando (já cuidou do passo). Longe do dono: monta no lobo e segue a rota pela estrada (shared/rota.js);
  // água no caminho desce do lobo e atravessa (sobe de novo no seco); preso desvia de lado. Perto (V.chega m): larga a
  // estrada e o resto (seguir, chegar, lutar) é o de sempre. Em outra terra (só de barco): avisa uma vez e espera.
  longeAmiga(j, dono, d, dt) {
    const V = this.AMIGA.viagem, ia = j.ia;
    if (!(ia.viagem ? d > V.chega : d > V.estrada)) { ia.viagem = null; return false; }
    let v = ia.viagem;
    if (!v || (this.tempo >= v.novaEm && Math.hypot(v.fx - dono.x, v.fz - dono.z) > (v.bloqueio ? 2 : V.replanejar))) {
      const r = planejarRota(this.mapa, j, dono), aviso = !v && !!dono && this.tempo >= (ia.avisoViagem || 0);
      if (r.bloqueio) {
        if (!v?.bloqueio && !dono.solo) this.dizerAmiga(sorteia(this.AMIGA.chat.falas.outraTerra));
        ia.viagem = { bloqueio: r.bloqueio, fx: dono.x, fz: dono.z, novaEm: this.tempo + 5 };
        j.montado = null; this.pararAmiga(j); return true;
      }
      if (aviso && !dono.solo && !ia.vir && d > V.estrada * 3) { ia.avisoViagem = this.tempo + 120; this.dizerAmiga(sorteia(this.AMIGA.chat.falas.aCaminho)); }
      v = ia.viagem = { rota: r.pontos, i: 0, fx: dono.x, fz: dono.z, novaEm: this.tempo + V.novaEm, seco: v?.seco ?? V.seco, t: 0, x0: j.x, z0: j.z, desvio: 0, lado: 1, falhas: 0, iFalha: -1 };
      // a chamada pelo chat espera o tempo da viagem (lobo no galope + folga)
      if (ia.vir) ia.vir.ate = Math.max(ia.vir.ate, this.tempo + r.metros / MONTARIAS.lobo.correr * V.folga + V.extra);
    }
    if (v.bloqueio) { j.montado = null; this.pararAmiga(j); return true; }
    if (j.trava > 0) return this.pararAmiga(j), true;
    if (j.coleta) this.pararColeta(j, null);
    if (j.pesca) this.pararPesca(j, null);
    const P = v.rota, ult = P.length - 1;
    while (v.i < ult && Math.hypot(P[v.i].x - j.x, P[v.i].z - j.z) < V.olha) v.i++;
    const alvo = P[v.i], dx = alvo.x - j.x, dz = alvo.z - j.z, da = Math.hypot(dx, dz) || 1;
    // montaria: água logo à frente desce do lobo; no seco de novo, sobe (como o "Ir para" do app)
    const funda = (x, z) => (noLago(x, z)?.fundo || 0) > V.agua, f = Math.min(V.frente, da);
    const agua = funda(j.x, j.z) || funda(j.x + dx / da * f, j.z + dz / da * f);
    if (agua) { v.seco = 0; if (j.montado) j.montado = null; }
    else if (!j.montado) { v.seco += dt; if (v.seco >= V.seco && j.chao && !j.esc) j.montado = MONTARIAS[dono.montado] ? dono.montado : 'lobo'; }
    // preso (árvore, pedra, gente): desvia de lado um pouco; no mesmo ponto 3 vezes, pula para o próximo
    v.t += dt;
    if (v.desvio > 0) v.desvio -= dt;
    else if (v.t >= V.preso) {
      if (Math.hypot(j.x - v.x0, j.z - v.z0) < 0.8) {
        v.desvio = V.desvio; v.lado = -v.lado;
        if (v.iFalha === v.i) { if (++v.falhas >= 3 && v.i < ult) { v.i++; v.falhas = 0; } } else { v.iFalha = v.i; v.falhas = 1; }
      }
      v.t = 0; v.x0 = j.x; v.z0 = j.z;
    }
    let mx = dx / da, mz = dz / da;
    if (v.desvio > 0) { const l = v.lado; [mx, mz] = [mx * 0.3 + mz * l, mz * 0.3 - mx * l]; const n = Math.hypot(mx, mz); mx /= n; mz /= n; }
    j.entrada = { mx, mz, correr: true }; ia.naEstrada = true;
    return true;
  },
  // o dono entrou na caverna (já com o selo aberto): chegando lá dentro andando, ela entra junto (passe do time)
  cavernaAmiga(j, dono) {
    if (dono.caverna && !j.caverna && this.naCaverna(j)) j.caverna = { desde: this.tempo };
  },
  irDireto(j, x, z, correr) {
    j.ia.mira = { x, z }; // para onde está indo (paredeAmiga: aparece aqui se não conseguir passar)
    const dx = x - j.x, dz = z - j.z, d = Math.hypot(dx, dz) || 1;
    j.entrada = { mx: dx / d, mz: dz / d, correr };
  },
  // ---------- chat de longe (André 2026-11-09): mensagem privada como uma pessoa, ela chama o André também ----------
  // O servidor (server/index.js) entrega a mensagem do André e escolhe quem pensa a resposta: a IA grátis (server/ia-amiga.js,
  // quando tem chave) ou as regras daqui (assuntoAmiga). Os dois caminhos acabam em respostaAmiga, que faz a ação e manda
  // a fala depois de um tempinho "digitando". Ela só fala com o dono.
  assuntoAmiga(texto) {
    const t = ' ' + String(texto).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[,.!?;:]+/g, ' . ').replace(/[^a-z0-9. ]+/g, ' ').replace(/\s+/g, ' ').trim() + ' '; // a pontuação vira " . ": "não, vamos caçar" não é negação
    const A = this.AMIGA.chat.assuntos, tem = (k) => A[k].some((w) => t.includes(' ' + w.trim() + ' ') || (w.includes(' ') && t.includes(w.trim())));
    // André 2026-11-11: "não vamos caçar" não é convite. Um "não/nem/nunca" até 3 palavras antes do pedido cancela a ação
    // (com IA ou sem IA: a ação sempre sai das regras). negado(k): só achou a palavra com negação antes
    const NEG = /(^| )(nao|nem|nunca)( [a-z0-9]+){0,3} $/;
    const achaSemNao = (k) => A[k].some((w) => { const p = ' ' + w.trim() + ' '; let i = t.indexOf(p); while (i >= 0) { if (!NEG.test(t.slice(0, i + 1))) return true; i = t.indexOf(p, i + 1); } return false; });
    const negado = (k) => tem(k) && !achaSemNao(k);
    const ia = this.amiga?.ia;
    if (this.amiga?.troca) { if (tem('presente')) return 'presente'; if (tem('pedirItem')) return 'pedirItem'; } // janela de troca aberta (fase 3)
    else if (this.amiga && tem('pedirItem') && this.itensNoTextoAmiga(t).length) return 'pedirItem'; // "tem cenoura?" e ela tem: oferece
    if (ia?.atividade && tem('pararAtividade')) return 'pararAtividade';
    let negou = false;
    for (const k of ['pescar', 'minerar', 'lenha']) if (tem(k)) { if (!negado(k)) return k; negou = true; } // "vamos pescar" é pescar, não caçar
    if (tem('equip')) return 'equip'; // "o que você tá usando?" (André 2026-11-10)
    for (const k of ['sairTime', 'vir', 'time']) if (tem(k)) { if (!negado(k)) return k; negou = true; }
    if (negou) return 'naoAcao'; // "não vamos caçar", "nem vem": não faz nada
    if (ia?.chamado && ia.chamado.ate > this.tempo) { if (tem('nao')) return 'nao'; if (tem('sim')) return 'sim'; } // resposta ao chamado dela
    for (const k of ['tchau', 'comoVai', 'ajuda', 'dungeon', 'piada', 'obrigado', 'elogio', 'casa', 'horta', 'troca', 'oi']) if (tem(k)) return k;
    return 'naoEntendi';
  },
  // André 2026-11-12 ("tá respondendo coisa sem sentido"): a ação das regras só passa por cima da fala da IA quando é um
  // pedido de verdade. Não vale quando não muda nada (chamar para o time quem já está no time, mandar sair quem nem está)
  // nem quando a IA leu como conversa uma frase comprida ("como foi a missão de ontem lá na caverna?" tem "missao" mas
  // não é convite). Pedido curto e direto ("bora caçar", "vem cá") continua valendo pelas regras.
  acaoSemEfeitoAmiga(id, assunto) {
    const a = this.amiga, j = this.jogadores.get(id); if (!a || !j) return false;
    const noTime = !!(a.time && a.time === j.time);
    return (assunto === 'time' && noTime) || (assunto === 'sairTime' && !noTime);
  },
  // "me chama de fofinha" é apelido (André 2026-11-13, print: a Cecília respondeu "Bora, já vou aí!" e foi até ele)
  apelidoAmiga(texto) { return /\b(cham\w*|cahm\w*|caham\w*)\s+(de|d)\s+\S/.test(normAmiga(texto)); },
  regraValeSobreIaAmiga(id, assunto, texto, assuntoIa) {
    if (this.acaoSemEfeitoAmiga(id, assunto)) return false;
    if (assuntoIa === 'conversa' && ['time', 'vir', 'sairTime', 'pescar', 'minerar', 'lenha'].includes(assunto)) {
      const palavras = normAmiga(texto).split(' ').filter(Boolean).length;
      if (palavras > this.AMIGA.chat.pedidoCurto) return false;
      // André 2026-11-13: pergunta que a IA leu como conversa ("onde você vai caçar hoje?", "você gosta de pescar?") não é pedido:
      // antes ela ia até ele ou sorteava "hoje não tô no clima" no lugar da resposta. "bora caçar?" a IA já marca como time.
      if (/\?\s*$/.test(String(texto)) && !/^\s*(bora|vamos|vem|partiu|simbora)\b/i.test(normAmiga(texto))) return false;
    }
    return true;
  },
  // o que a IA precisa saber dela agora (vai no pedido para a IA, junto com as últimas mensagens)
  contextoAmiga(id) {
    const a = this.amiga, j = this.jogadores.get(id); if (!a || !j || !this.podeAmiga(id)) return null;
    const L = this.loteDaAmiga(), pronta = L && this.AMIGA.casa.every((c) => L.pecas.some((o) => mesmaPeca(o, pecaDaCasa(L.def, c))));
    // ficha curta (entrega 5): o que ele está fazendo sozinho e onde mora (os aventureiros não têm casa)
    const av = a.ia.av, bicho = av?.c ? TIPOS_INIMIGO[av.c.tipo]?.nome || 'monstros' : '';
    const so = this.AMIGA.genero === 'm' ? 'sozinho' : 'sozinha';
    const col = av?.coleta && { pescar: 'pescar', minerar: 'minerar', lenha: 'cortar lenha' }[av.coleta], colG = av?.coleta && { pescar: 'pescando', minerar: 'minerando', lenha: 'cortando lenha' }[av.coleta];
    const sozinho = av && { escolher: 'escolhendo onde caçar', ir: col ? `indo ${col} ${so}` : `indo caçar ${bicho} ${so}`, cacar: col ? `${colG} ${so}` : `caçando ${bicho} ${so}`, voltar: 'voltando para a vila vender, consertar e comprar poção', descansar: 'descansando na vila depois da caçada' }[av.fase];
    return {
      semCasa: !this.AMIGA.terreno, mora: !this.AMIGA.terreno ? this.moradiaAmiga(a)?.nome || 'a vila' : null,
      nome: this.AMIGA.nome, persona: this.AMIGA.persona || null, genero: this.AMIGA.genero || 'f', amigo: j.nome, amizade: this.amizadeAmiga(j),
      comOutro: id !== this.amigaDono && this.ocupadaAmiga() ? this.jogadores.get(this.amigaDono)?.nome || null : null, nivel: a.prog.nivel, nivelAmigo: j.prog.nivel,
      noTime: !!(a.time && a.time === j.time), distancia: Math.round(Math.hypot(a.x - j.x, a.z - j.z)),
      fazendo: sozinho ? sozinho : a.ia.atividade ? `${this.AMIGA.atividades[a.ia.atividade].nome} junto com ele` : a.time ? 'caçando no time com ele' : a.ia.fase === 'trabalhar' ? (a.ia.anim === 'construir' ? 'construindo a casa' : 'cuidando da horta') : a.ia.fase === 'andar' ? 'passeando pela vila' : (this.AMIGA.terreno ? 'descansando na porta de casa' : 'passeando pela vila'),
      casaPronta: !!pronta, noite: ehNoite(horaDoJogo(j.prog.dia)), pedido: a.pedido ? `${a.pedido.n} ${ITENS[a.pedido.k].nome}` : null,
      chamou: id === this.amigaDono && a.ia.chamado && a.ia.chamado.ate > this.tempo ? a.ia.chamado.quer : null,
      humor: (() => { // o que ela decidiu sobre caçar/time agora (decisaoTimeAmiga); o mesmo sorteio vale quando ele chamar
        if (a.time && a.time === j.time) return null;
        const topou = this.combinouAmiga(a) || (a.ia.chamado?.quer === 'time' && a.ia.chamado.ate > this.tempo);
        if (topou) return { aceita: true, combinado: true };
        const h = this.decisaoTimeAmiga(a, j, true);
        return { aceita: h.aceita, motivo: h.motivo, recusou: (a.ia.recusaAte || 0) > this.tempo, min: Math.max(1, Math.ceil((Math.max(a.ia.recusaAte || 0, h.ate) - this.tempo) / 60)) };
      })(),
      ouro: a.prog.ouro | 0,
      mochila: Object.entries(a.prog.mochila.reduce((m, o) => { if (o) m[ITENS[o.k]?.nome || o.k] = (m[ITENS[o.k]?.nome || o.k] || 0) + (o.n || 1); return m; }, {})).slice(0, 8).map(([k, n]) => `${n} ${k}`).join(', '),
      conversa: this.chatDeAmiga(j).slice(-12), // as 12 guardadas (André 2026-11-13: com menos ela perdia o fio da conversa)
      memoria: (a.memorias?.[j.conta] || []).slice(0, this.AMIGA.memoria.max),
      equip: this.listaEquipAmiga(), pecaFraca: this.pecaFracaAmiga() ? nomeDoItem(this.pecaFracaAmiga().it) : null,
      regras: [...Object.keys(a.regras?.[j.conta] || {}).filter((k) => a.regras[j.conta][k] && this.AMIGA.memoria.regras[k]).map((k) => this.AMIGA.memoria.regras[k].texto), ...(a.dicas || []).map((d) => d.texto), ...textoLicoes(a.licoes)],
    };
  },
  // a resposta: r = { assunto } (regras) ou { assunto: ação da IA, fala } (IA). Faz a ação e responde.
  respostaAmiga(id, r) {
    const a = this.amiga, j = this.jogadores.get(id); if (!a || !j || !this.podeAmiga(id) || !r) return;
    // livre: passa a acompanhar quem falou; com outro amigo: conversa, mas ação só depois (André 2026-11-10)
    const mesmoTime = !!(a.time && a.time === j.time) && ['time', 'vir'].includes(r.assunto); // no time de todos: "bora pro time" e "vem cá" valem
    if (!this.trocarDonoAmiga(id) && !mesmoTime && ['time', 'pescar', 'minerar', 'lenha', 'pararAtividade', 'sairTime', 'vir', 'sim', 'nao', 'troca', 'presente', 'pedirItem'].includes(r.assunto)) return this.dizerAmiga(this.comOutroAmiga(), false, id);
    const F = this.AMIGA.chat.falas, FA = this.AMIGA.falas, ia = a.ia, noTime = !!(a.time && a.time === j.time);
    const perto = Math.hypot(a.x - j.x, a.z - j.z) < 6;
    const chamado = ia.chamado && ia.chamado.ate > this.tempo ? ia.chamado : null;
    let fala = '';
    switch (r.assunto) {
      case 'time': {
        if (noTime) { fala = sorteia(FA.jaNoTime); break; }
        if (a.morto) { fala = FA.caiu; break; }
        const pediu = chamado?.quer === 'time' || this.combinouAmiga(a); // ela que chamou ou já topou: aceita sem sorteio
        if (!pediu && (ia.recusaAte || 0) > this.tempo) { fala = FA.recusa.jaFalei; break; }
        const v = this.decisaoTimeAmiga(a, j);
        if (!pediu && !v.aceita) { this.recusarTimeAmiga(a, j, v.motivo); fala = FA.recusa[v.motivo] || FA.recusa.vontade; break; }
        // André 2026-11-13 ("como se fosse um jogador real"): pelo chat ela só topa; ele dá o time no botão (conviteTimeAmiga)
        if (this.timeCheioAmiga(j)) { fala = FA.recusa.cheio; break; }
        ia.chamado = null; ia.vir = null; ia.plano = null;
        this.combinarAmiga(a);
        fala = sorteia(FA.timeCombinado);
        break;
      }
      case 'pescar': case 'minerar': case 'lenha': {
        if (a.morto) { fala = FA.caiu; break; }
        if (!noTime) {
          const pediu = chamado?.quer === 'time' || chamado?.quer === r.assunto || this.combinouAmiga(a);
          if (!pediu && (ia.recusaAte || 0) > this.tempo) { fala = FA.recusa.jaFalei; break; }
          const v = this.decisaoTimeAmiga(a, j);
          if (!pediu && !v.aceita) { this.recusarTimeAmiga(a, j, v.motivo); fala = FA.recusa[v.motivo] || FA.recusa.vontade; break; }
          // fora do time: topa e combina; a coleta começa quando ele der o time (André 2026-11-13)
          if (this.timeCheioAmiga(j)) { fala = FA.recusa.cheio; break; }
          ia.chamado = null; ia.vir = null; ia.plano = r.assunto; this.combinarAmiga(a);
          fala = sorteia(FA.timeCombinado);
          break;
        }
        this.gostoAmiga(j, r.assunto);
        if (ia.atividade && ia.atividade !== r.assunto) this.fimAtividadeAmiga(a, true);
        this.comecarAtividadeAmiga(a, r.assunto);
        ia.chamado = null; ia.vir = null; this.combinarAmiga(a);
        fala = sorteia(this.AMIGA.falasColeta.aceita).replace('{o}', this.AMIGA.atividades[r.assunto].nome) + (perto ? '' : ' Tô indo aí!');
        break;
      }
      case 'pararAtividade': fala = this.fimAtividadeAmiga(a, true) || this.AMIGA.falasColeta.fim; r = { ...r, fala: '' }; break;
      case 'sairTime':
        if (noTime) { ia.noTime = false; this.sairDoTime(a, `${this.AMIGA.nome} saiu do time`); ia.fase = 'pensar'; this.pocoesAmiga(a); fala = FA.voltou; }
        else fala = 'Ué, eu nem tô no seu time! Quer que eu entre?';
        break;
      case 'vir': {
        if (noTime || perto) { fala = sorteia(F.perto); break; }
        if (a.morto) { fala = FA.caiu; break; }
        const pediu = chamado && chamado.quer !== 'time';
        if (!pediu && Math.random() >= Math.min(0.95, this.vontadeAmiga(a, j).p + 0.2)) { fala = sorteia(F.naoVir); break; }
        ia.vir = { ate: this.tempo + 120, longe: this.tempo + 4 }; ia.chamado = null; ia.conversaAte = 0;
        this.combinarAmiga(a); // topou vir: está disponível, então não recusa o time logo depois
        fala = sorteia(F.vir);
        break;
      }
      case 'sim':
        if (chamado?.quer === 'time') return this.respostaAmiga(id, { assunto: 'time', fala: r.fala });
        if (this.AMIGA.atividades[chamado?.quer]) return this.respostaAmiga(id, { assunto: chamado.quer, fala: r.fala }); // ela chamou para pescar/minerar/lenha
        if (chamado?.quer === 'ajuda') { ia.chamado = null; return this.respostaAmiga(id, { assunto: 'ajuda', fala: r.fala }); }
        ia.chamado = null; fala = chamado?.quer === 'vir' ? 'Oba! Te espero aqui na horta.' : sorteia(F.chamaRespostaSim);
        break;
      case 'nao': case 'naoAcao': ia.chamado = null; fala = sorteia(F.chamaRespostaNao); break; // naoAcao: "não vamos caçar" (André 2026-11-11)
      case 'ajuda':
        if (!a.pedido && Math.random() < this.AMIGA.equipInteresse.pedir && this.pecaFracaAmiga()) { fala = this.pedeEquipAmiga(); break; } // às vezes é a peça mais fraca
        if (!a.pedido && Math.random() < 0.7) { const p = sorteia(this.AMIGA.pedidos); a.pedido = { k: p.k, n: p.n }; this.guardarAmiga(); }
        fala = a.pedido ? sorteia(FA.pedido).replace('{item}', `${a.pedido.n} ${ITENS[a.pedido.k].nome.toLowerCase()}`) + ' Me entrega quando passar aqui!' : sorteia(FA.semPedido);
        break;
      case 'casa': { const L = this.loteDaAmiga(), pronta = L && this.AMIGA.casa.every((c) => L.pecas.some((o) => mesmaPeca(o, pecaDaCasa(L.def, c)))); fala = sorteia(pronta ? FA.pronta : FA.obra); break; }
      case 'troca': fala = a.troca ? sorteia(this.AMIGA.falasTroca.abre) : sorteia(this.AMIGA.falasTroca.topa); break; // só topa: a troca ele abre (André 2026-11-13)
      case 'presente': case 'pedirItem': { const ult = [...this.chatDeAmiga(j)].reverse().find((c) => c.de === 'ele'); fala = this.pedidoTrocaAmiga(r.assunto, ult?.texto || ''); r = { ...r, fala: '' }; break; }
      case 'equip': fala = this.falaEquipAmiga(); break;
      case 'horta': case 'dungeon': fala = sorteia(FA[r.assunto]); break;
      default: fala = sorteia(F[r.assunto] || F.naoEntendi);
    }
    // a IA escreve a fala dela; a ação continua sendo decidida aqui (ela pode recusar mesmo que a IA queira aceitar)
    const recusou = (r.assunto === 'time' && !(a.time && a.time === j.time) && !this.combinouAmiga(a)) || (r.assunto === 'vir' && !ia.vir && !perto && !noTime);
    // a IA já sabia que ia recusar (humor na ficha) e escreveu a recusa do jeito dela: vale a fala dela
    if (r.fala && (!recusou || r.iaAssunto === 'conversa' || r.iaAssunto === 'nao')) fala = r.fala;
    this.dizerAmiga(fala, false, id);
  },
  // manda a mensagem dela no chat privado depois de uns segundos (fila em ia.chatFila)
  dizerAmiga(texto, agora = false, para = null) {
    const a = this.amiga; if (!a || !texto) return;
    para ??= this.amigaDono;
    const [d0, d1] = this.AMIGA.chat.digitando, ultimo = (a.ia.chatFila || []).reduce((m, x) => Math.max(m, x.t), this.tempo);
    (a.ia.chatFila ||= []).push({ t: agora ? this.tempo : ultimo + d0 + Math.random() * (d1 - d0) + Math.min(2, texto.length / 60), texto: String(texto).slice(0, 300), para });
  },
  // a conversa do chat com cada amigo fica separada (a IA lê só a de quem está falando)
  chatDeAmiga(j) { const c = (this.amiga.ia.conversas ||= {}); return (c[j.conta] ||= []); },
  // ---------- memória (André 2026-11-10: ela aprende com o dia a dia, cada pessoa tem a sua história com ela) ----------
  // dica que quem ela acompanha ensinou (this.AMIGA.memoria.regras); undefined = o normal
  regraAmiga(campo) {
    const a = this.amiga, r = a?.regras?.[a.donoConta]; if (!r) return undefined;
    for (const [k, def] of Object.entries(this.AMIGA.memoria.regras)) if (r[k] && def[campo] !== undefined) return def[campo];
    return undefined;
  },
  gostoAmiga(j, k) { const a = this.amiga, g = ((a.gostos ||= {})[j.conta] ||= {}); g[k] = (g[k] | 0) + 1; },
  gostoTopoAmiga(j) {
    const g = this.amiga?.gostos?.[j.conta]; if (!g) return null;
    const [k, n] = Object.entries(g).sort((x, y) => y[1] - x[1])[0] || [];
    return n >= this.AMIGA.memoria.gostoMin && this.AMIGA.chat.falas.chamaGosto[k] ? k : null;
  },
  // conversas que terminaram (pausa sem mensagem, conversa longa ou a pessoa saiu): o servidor pede o diário à IA (aoDiarioAmiga)
  diarioAmiga(forcar = null) {
    const a = this.amiga, M = this.AMIGA.memoria; if (!a?.ia.diario) return;
    for (const [conta, d] of Object.entries(a.ia.diario)) {
      const pronto = d.novas >= M.minimo && (conta === forcar || d.novas >= M.cheia || this.tempo - d.ultima >= M.pausa);
      if (!pronto || d.pensando) continue;
      if ((d.falas | 0) >= this.AMIGA.amizade.conversa) this.ganharAmizadeAmiga(this.jogadores.get(d.id), 1); // uma conversa de verdade
      d.falas = 0;
      d.novas = 0; d.pensando = true;
      const dados = { amigo: this.AMIGA.id, nomeAmigo: this.AMIGA.nome, genero: this.AMIGA.genero || 'f', conta, nome: d.nome, memoria: [...(a.memorias?.[conta] || [])], regras: { ...(a.regras?.[conta] || {}) }, conversa: [...((a.ia.conversas || {})[conta] || [])] };
      if (!this.aoDiarioAmiga) { d.pensando = false; continue; }
      this.aoDiarioAmiga(dados).then((r) => { d.pensando = false; if (r) this.anotarAmiga(conta, r); }, () => { d.pensando = false; });
    }
  },
  // r = { memorias: [texto], regras: { curaCedo: true } } (da IA): troca a lista dela sobre a pessoa e as dicas
  anotarAmiga(conta, r) {
    const M = this.AMIGA.memoria, L = this.loteDaAmiga(), a = this.amiga || L?.amiga; if (!a || !r) return; // ela já saiu da sala: grava no terreno
    if (Array.isArray(r.memorias)) {
      const lista = r.memorias.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.replace(/\s+/g, ' ').trim().slice(0, M.tamanho)).slice(0, M.max);
      if (lista.length) (a.memorias ||= {})[conta] = lista;
    }
    if (r.regras && typeof r.regras === 'object') {
      const atual = ((a.regras ||= {})[conta] ||= {});
      for (const k of Object.keys(M.regras)) if (typeof r.regras[k] === 'boolean') { if (r.regras[k]) atual[k] = true; else delete atual[k]; }
    }
    if (this.amiga) this.guardarAmiga(); else if (L) this.lotesMudados.add(L.def.id);
  },
  // o André escreveu para ela (o servidor chama depois de entregar a mensagem dele)
  ouvirAmiga(id, texto) {
    const a = this.amiga, j = this.jogadores.get(id); if (!a || !j || !this.podeAmiga(id)) return;
    const c = this.chatDeAmiga(j); c.push({ de: 'ele', texto: String(texto).slice(0, 200) }); if (c.length > 12) c.shift();
    const d = ((a.ia.diario ||= {})[j.conta] ||= { novas: 0, ultima: 0, id }); d.novas++; d.falas = (d.falas | 0) + 1; d.ultima = this.tempo; d.id = id; d.nome = j.nome;
  },
  passoChatAmiga(a) {
    const ia = a.ia, dono = this.jogadores.get(this.amigaDono); if (!dono) return;
    // as respostas na hora certa
    while (ia.chatFila?.length && ia.chatFila[0].t <= this.tempo) {
      const { texto, para } = ia.chatFila.shift(), quem = this.jogadores.get(para ?? this.amigaDono); if (!quem) continue;
      // falaram com ela no chat de time (André 2026-11-11): a resposta vai para o time todo, não para o privado
      const T = ia.viaTime > this.tempo && a.time && quem.time === a.time ? a.time : null;
      const msg = T ? { canal: 'time', c: this.AMIGA.conta, nome: this.AMIGA.nome, texto, hora: Date.now(), membros: this.contasDoTime(T) } : { canal: 'pm', c: this.AMIGA.conta, nome: this.AMIGA.nome, texto, hora: Date.now(), alvo: quem.conta, alvoNome: quem.nome };
      const c = this.chatDeAmiga(quem); c.push({ de: 'ela', texto }); if (c.length > 12) c.shift();
      // no time, os outros NPCs leem o que ela disse (André 2026-11-13: cada um respondia sem saber do outro)
      if (T) for (const x of this.amigosIa) if (x !== this && x.amiga && x.amiga.time === T && x.podeAmiga(quem.id)) { const h = x.chatDeAmiga(quem); h.push({ de: 'outro', nome: this.AMIGA.nome, texto }); if (h.length > 12) h.shift(); }
      if (this.aoChatAmiga) this.aoChatAmiga(msg); else this.receberChat(msg);
    }
    // ela chama o André de vez em quando (longe, fora do time, viva, sem conversa esperando)
    const C = this.AMIGA.chat.chamar, sorte = ([x, y]) => x + Math.random() * (y - x);
    if (ia.chamaEm == null) ia.chamaEm = this.tempo + sorte(C.primeiro);
    if (this.tempo < ia.chamaEm) return;
    ia.chamaEm = this.tempo + sorte(C.entre);
    if (a.morto || a.time || ia.vir || (ia.chamado && ia.chamado.ate > this.tempo) || Math.hypot(a.x - dono.x, a.z - dono.z) < C.longe) return;
    if (dono.morto || dono.criando) return;
    const g = this.gostoTopoAmiga(dono), M = this.AMIGA.memoria;
    const ch = g && Math.random() < M.gostoChance ? { texto: this.AMIGA.chat.falas.chamaGosto[g], quer: g } : sorteia(this.AMIGA.chat.falas.chama); // o que vocês mais fazem juntos
    ia.chamado = { quer: ch.quer, ate: this.tempo + C.espera };
    this.dizerAmiga(ch.texto, true);
  },
  // indo até o André: perto anda/corre; longe vem de lobo pela estrada (longeAmiga), como no time
  virAmiga(j, dono, dt) {
    const ia = j.ia, v = ia.vir, d = Math.hypot(dono.x - j.x, dono.z - j.z);
    if (this.tempo > v.ate || dono.morto) { ia.vir = null; ia.viagem = null; j.montado = null; this.pararAmiga(j); ia.fase = 'pensar'; return false; }
    if (d < 2.8) {
      ia.vir = null; this.pararAmiga(j); ia.fase = 'pensar'; ia.viu = true;
      ia.conversaAte = this.tempo + this.AMIGA.conversa; j.ry = Math.atan2(dono.x - j.x, dono.z - j.z);
      this.dizerAmiga(sorteia(this.AMIGA.chat.falas.chegou) + ' ' + sorteia(this.AMIGA.chat.falas.chegouPergunta));
      ia.chamado = { quer: 'time', ate: this.tempo + this.AMIGA.chat.chamar.espera }; // "bora"/"sim"/Time agora entram sem sorteio
      this.combinarAmiga(j);
      return true;
    }
    // longe: monta no lobo e vem pela estrada (André 2026-11-10: antes, muito longe, ela aparecia do lado dele)
    ia.fase = 'vir';
    this.cavernaAmiga(j, dono);
    if (this.longeAmiga(j, dono, d, dt)) return true;
    if (j.montado) j.montado = null; // perto: desce do lobo e chega a pé
    this.irDireto(j, dono.x, dono.z, d > 5);
    return true;
  },
  // ---------- fase 3: mochila, ouro e troca (André 2026-11-09) ----------
  // arruma a mochila: veste a peça melhor, guarda o que serve e vende o resto (ela passa na Rosa: preço normal de venda)
  // ---------- equipamento (André 2026-11-10: ela liga para as peças, pede a mais fraca e veste a melhor que ganhar) ----------
  notaEquipAmiga(it) { return it ? it.r * 100 + (it.e || 0) * 10 - (it.d || 0) : -1; },
  listaEquipAmiga() {
    const e = this.amiga?.prog.equip || {};
    return Object.entries(e).filter(([l, it]) => it && l !== 'cajado').map(([, it]) => nomeDoItem(it)).join(', ');
  },
  // a peça mais fraca dela (que ainda dá para melhorar): { l, it }
  pecaFracaAmiga() {
    const e = this.amiga?.prog.equip || {}; let f = null;
    for (const [l, it] of Object.entries(e)) if (it && l !== 'cajado' && (it.r | 0) < this.AMIGA.equipInteresse.rarMax && (!f || this.notaEquipAmiga(it) < this.notaEquipAmiga(f.it))) f = { l, it };
    return f;
  },
  falaEquipAmiga() { const f = this.pecaFracaAmiga(); return this.AMIGA.falasEquip.lista.replace('{lista}', this.listaEquipAmiga() || 'nada').replace('{fraca}', f ? nomeDoItem(f.it) : 'nenhuma, tô bem equipada'); },
  pedeEquipAmiga() {
    const f = this.pecaFracaAmiga();
    return sorteia(this.AMIGA.falasEquip.pede).replace('{meu}', `minha peça ${nomeDoItem(f.it)}`);
  },
  // peça que ela usaria no lugar da dela (melhor e que ela consegue vestir)
  melhorPecaAmiga(it) {
    const p = this.amiga?.prog; if (!p || !it || !ehEquip(it.k)) return false;
    const l = ITENS[it.k].lugar;
    return l !== 'cajado' && Object.hasOwn(p.equip, l) && reforcoOk(it, p.atr) && this.notaEquipAmiga(it) > this.notaEquipAmiga(p.equip[l]);
  },
  // veste na hora o que for melhor na mochila (depois da troca); devolve os nomes
  vestirMelhorAmiga(j) {
    const p = j.prog, vestiu = [];
    for (let i = 0; i < p.mochila.length; i++) {
      const it = itemValido(p.mochila[i]); if (!it || !this.melhorPecaAmiga(it)) continue;
      this.item(j.id, { acao: 'equipar', i }); vestiu.push(nomeDoItem(it));
    }
    return vestiu;
  },
  arrumarMochilaAmiga(j) {
    const p = j.prog, nota = (it) => (it ? it.r * 100 + (it.e || 0) * 10 - (it.d || 0) : -1);
    for (let i = 0; i < p.mochila.length; i++) {
      const it = itemValido(p.mochila[i]); if (!it || !ehEquip(it.k)) continue;
      const l = ITENS[it.k].lugar;
      if (l === 'cajado' || !Object.hasOwn(p.equip, l) || !reforcoOk(it, p.atr)) continue;
      if (nota(it) > nota(p.equip[l])) this.item(j.id, { acao: 'equipar', i }); // a peça velha volta pra mochila e é vendida abaixo
    }
    const guarda = (it) => it.cad || it.k === 'pocao' || it.k.startsWith('semente_') || this.AMIGA.plantas.includes(it.k) || this.AMIGA.pedidos.some((o) => o.k === it.k) || ITENS[it.k].comida;
    let ouro = 0, vendeu = 0;
    for (let i = 0; i < p.mochila.length; i++) {
      const it = itemValido(p.mochila[i]); if (!it) continue;
      if (it.k === 'tomo') { this.item(j.id, { acao: 'usar', i }); if (!p.mochila[i]) continue; } // tomo de espada que ela pode ler
      if (it.k === 'pocao' && it.n > this.AMIGA.mochila.pocoes) { const n = it.n - this.AMIGA.mochila.pocoes; ouro += precoVenda(it) * n; p.mochila[i].n -= n; vendeu++; continue; }
      if (guarda(it) || ITENS[it.k].usar?.veiculo) continue;
      ouro += precoVenda(it) * (it.n || 1); p.mochila[i] = null; vendeu++;
    }
    if (vendeu) { p.ouro += ouro; this.aplicarStatus(j); }
    this.guardarAmiga();
    return { vendeu, ouro };
  },
  // o dono quer trocar: abre a janela normal de troca. true = abriu; senão a fala do porquê
  abrirTrocaAmiga(dono) {
    const a = this.amiga, F = this.AMIGA.falasTroca;
    if (!a || !dono || !this.trocarDonoAmiga(dono.id)) return a && this.podeAmiga(dono?.id) ? this.comOutroAmiga() : F.ocupada;
    if (a.troca && a.troca === dono.troca) return true;
    if (a.morto || a.troca || dono.troca || dono.morto || dono.criando || this.emCombate(a) || this.emCombate(dono)) return F.ocupada;
    if (Math.hypot(a.x - dono.x, a.z - dono.z) > this.AMIGA.troca.longe) return F.longe;
    this.pararAmiga(a);
    Object.assign(a.ia, { trocaT: this.tempo + this.AMIGA.troca.pensar, trocaPresente: false, trocaDisse: '' });
    this.abrirTroca(dono, a);
    for (const r of a.ia.reserva || []) { const i = a.prog.mochila.findIndex((o) => o?.k === r.k && !o.cad); if (i >= 0) this.troca(a.id, { acao: 'por', i, n: Math.min(r.n, a.prog.mochila[i].n || 1) }); }
    a.ia.reserva = null; // o que ela ofereceu no chat já vai pra mesa
    return true;
  },
  // o servidor mexeu na troca dela (enviarTroca): pensa de novo daqui a pouco
  mexeuTrocaAmiga() { const a = this.amiga; if (a?.troca && a.ia.trocaT == null) a.ia.trocaT = this.tempo + this.AMIGA.troca.pensar; },
  // valor de venda do que está na mesa (itens) de um lado
  valorMesa(of) { return of.itens.reduce((s, e) => { const it = itemValido(JSON.parse(e.chave)); return s + (it ? precoVenda(it) * e.n : 0); }, 0); },
  passoTrocaAmiga(a) {
    const T = a.troca, ia = a.ia, dono = this.jogadores.get(T.a === a.id ? T.b : T.a);
    this.pararAmiga(a);
    if (dono) a.ry = Math.atan2(dono.x - a.x, dono.z - a.z);
    if (!dono || ia.trocaT == null || this.tempo < ia.trocaT) return;
    ia.trocaT = null; // o que ela mexer agora (enviarTroca) marca outra pensada
    const R = this.AMIGA.troca, F = this.AMIGA.falasTroca, eu = T.of[a.id], ele = T.of[dono.id];
    const margem = this.margemAmiga(a);
    const dizer = (t) => { if (t && t !== ia.trocaDisse) { ia.trocaDisse = t; this.falarAmiga(t); } };
    // peças de equipamento que ele pôs (André 2026-11-10): melhor que a dela, ela quer; pior, ela não paga
    let naoServe = 0;
    for (const e of ele.itens) {
      const it = itemValido(JSON.parse(e.chave)); if (!it || !ehEquip(it.k)) continue;
      if (this.melhorPecaAmiga(it)) { if (!(ia.trocaViu ||= new Set()).has(e.chave)) { ia.trocaViu.add(e.chave); dizer(this.AMIGA.falasEquip.melhor.replace('{item}', nomeDoItem(it))); } }
      else { naoServe += precoVenda(it) * e.n; if (!(ia.trocaViu ||= new Set()).has(e.chave)) { ia.trocaViu.add(e.chave); dizer(this.AMIGA.falasEquip.pior.replace('{item}', nomeDoItem(it))); } }
    }
    const pede = Math.ceil(this.valorMesa(eu) * margem), traz = this.valorMesa(ele) - (ia.trocaPresente ? 0 : naoServe) + ele.ouro;
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
    // o que ela pediu chegou pela troca (André 2026-11-13: sem botão Dar, entrega como para um jogador)
    const p = a.pedido, veio = p ? ele.itens.reduce((s, e) => { const it = itemValido(JSON.parse(e.chave)); return s + (it?.k === p.k ? e.n : 0); }, 0) : 0;
    const quem = this.jogadores.get(T.a === a.id ? T.b : T.a);
    if (p && veio >= p.n) { a.pedido = null; this.ganharAmizadeAmiga(quem, 1, false); }
    if (presente) { this.ganharAmizadeAmiga(quem, 1, false); this.falarAmiga(this.AMIGA.falasTroca.obrigada); } else this.falarAmiga(sorteia(this.AMIGA.falasTroca.feita));
    a.ia.trocaT = null; a.ia.trocaViu = null;
    const vestiu = this.vestirMelhorAmiga(a); // ganhou peça melhor: veste na hora
    if (vestiu.length) { this.aplicarStatus(a); this.falarAmiga(this.AMIGA.falasEquip.vestiu.replace('{item}', vestiu.join(' e '))); }
    this.guardarAmiga();
  },
  // o que ela topou fica combinado um tempo (André 2026-11-09: falou que vem/que caça, não recusa o time em seguida)
  combinarAmiga(a) { a.ia.combinado = this.tempo + (this.AMIGA.chat.combinado ?? this.AMIGA.chat.chamar.combinado ?? 300); a.ia.recusaAte = 0; }, // 'combinado' fica em chat (antes lia chat.chamar e dava NaN: nunca valia)
  combinouAmiga(a) { return (a.ia.combinado || 0) > this.tempo; },
  // pelo chat com a troca aberta: "quero 3 cenouras" (ela põe na mesa) ou "é presente" (ela não paga)
  pedidoTrocaAmiga(assunto, texto) {
    const a = this.amiga, F = this.AMIGA.falasTroca; if (!a) return '';
    if (assunto === 'presente') { if (!a.troca) return sorteia(this.AMIGA.chat.falas.obrigado); a.ia.trocaPresente = true; a.ia.trocaT = this.tempo + 0.3; return F.presente; }
    const t = ' ' + normAmiga(texto) + ' ', num = Number((t.match(/ (\d{1,3}) /) || [])[1]) || 0;
    const achados = this.itensNoTextoAmiga(t);
    if (!achados.length) return F.naoTenho;
    const precisa = achados.filter((x) => a.pedido?.k === x.k);
    const vende = achados.filter((x) => a.pedido?.k !== x.k);
    if (!vende.length) return F.preciso.replace('{item}', nomeDoItem(precisa[0].it).toLowerCase());
    const lista = vende.map(({ i, it }) => ({ i, k: it.k, n: Math.min(it.n || 1, num || it.n || 1), it }));
    const texto2 = lista.map((x) => `${x.n} ${nomeDoItem(x.it).toLowerCase()}`).join(', ');
    const preco = Math.ceil(lista.reduce((s2, x) => s2 + precoVenda(x.it) * x.n, 0) * this.margemAmiga(a));
    if (!a.troca) { // fora da troca: oferece e guarda reservado; quando ele abrir a troca, já vai pra mesa
      a.ia.reserva = lista.map(({ k, n }) => ({ k, n })); // a troca ele abre (André 2026-11-13); o reservado já vai pra mesa
      return F.oferta.replace('{item}', texto2).replace('{preco}', preco);
    }
    for (const x of lista) this.troca(a.id, { acao: 'por', i: x.i, n: x.n });
    a.ia.trocaT = this.tempo + this.AMIGA.troca.pensar;
    return F.pus.replace('{item}', texto2).replace('{preco}', preco);
  },
  margemAmiga(a) { return Math.max(this.AMIGA.troca.margemMin, this.AMIGA.troca.margem - (a.amizade | 0) * this.AMIGA.troca.porAmizade); },
  // itens da mochila dela citados no texto (já normalizado com espaços nas pontas): "cenoura(s)", "tomo", "espada"
  itensNoTextoAmiga(t) {
    const p = this.amiga.prog.mochila, achados = [];
    for (let i = 0; i < p.length; i++) {
      const it = itemValido(p[i]); if (!it || it.cad) continue;
      const nome = normAmiga(ehEquip(it.k) ? ITENS[it.k].nome : nomeDoItem(it)), base = nome.replace(/s$/, '');
      const curto = normAmiga(ITENS[it.k].nome).replace(/s$/, '');
      if ((t.includes(' ' + base) || t.includes(' ' + curto)) && !achados.some((x) => x.k === it.k && (it.k !== 'tomo' || x.it.h === it.h))) achados.push({ i, k: it.k, it });
    }
    return achados;
  },
  // o que vai na janela do dono: quanto ela cobra pelos itens dela e quanto ele precisa pôr de ouro (sugestão)
  sugestaoTrocaAmiga(T) {
    const a = this.amiga, eu = T.of[a.id], ele = T.of[T.a === a.id ? T.b : T.a];
    const pede = Math.ceil(this.valorMesa(eu) * this.margemAmiga(a)), dele = this.valorMesa(ele);
    const sugerido = Math.max(0, pede - dele);
    let texto = '';
    if (pede) texto = `${this.AMIGA.nome} cobra ${pede} de ouro pelo que pôs na mesa` + (dele ? ` (seus itens valem ${dele} pra ela)` : '') + `. Ponha ${sugerido} de ouro.`;
    else if (dele) texto = a.ia.trocaPresente ? 'Presente: ela não vai pagar nada.' : `${this.AMIGA.nome} paga ${Math.min(a.prog.ouro, dele)} de ouro pelo que você pôs.`;
    else texto = 'Peça no chat o que quer dela ("quero 3 cenouras") ou ponha o que tem pra ela.';
    return { sugerido, texto };
  },

  // ---------- coleta junto (André 2026-11-09): pesca, minério e lenha, dividindo o que pegou ----------
  // itens que contam como "o que a gente coletou" (o que sai dos veios, das árvores e da água)
  itensDeColetaAmiga() {
    if (!this._itensColeta) {
      const S = new Set(Object.keys(PESCA.tier));
      for (const C of Object.values(COLETA)) { for (const k of Object.keys(C.da || {})) S.add(k); for (const k of Object.keys(C.raro || {})) S.add(k); }
      this._itensColeta = S;
    }
    return this._itensColeta;
  },
  contagemColetaAmiga(a) { const m = {}; for (const k of this.itensDeColetaAmiga()) { const n = contar(a.prog.mochila, k); if (n) m[k] = n; } return m; },
  comecarAtividadeAmiga(a, tipo) {
    Object.assign(a.ia, { atividade: tipo, alvoColeta: null, alvoColetaT: 0, coletaBase: this.contagemColetaAmiga(a), coletaResto: {}, ruins: new Map(), disseSemLugar: false, faltaDitaT: -999, falhas: 0 });
  },
  // o que ela pegou desde a última divisão: { k: n }
  ganhoColetaAmiga(a) {
    const agora = this.contagemColetaAmiga(a), base = a.ia.coletaBase || {}, g = {};
    for (const [k, n] of Object.entries(agora)) if (n > (base[k] || 0)) g[k] = n - (base[k] || 0);
    return g;
  },
  // dá a parte dele (direto na mochila dele) e guarda o resto para vender; devolve a fala ou ''
  dividirColetaAmiga(a, fim = false) {
    const ia = a.ia, C = this.AMIGA.coleta, F = this.AMIGA.falasColeta, dono = this.jogadores.get(this.amigaDono);
    const g = this.ganhoColetaAmiga(a), pct = Math.min(C.presenteMax, C.presente + (a.amizade | 0) * C.porAmizade), dados = [];
    if (dono && Object.values(g).reduce((t, n) => t + n, 0) >= C.dividir) this.ganharAmizadeAmiga(dono, 1); // uma rodada de coleta juntos
    for (const [k, n] of Object.entries(g)) {
      let dar = Math.round(n * pct);
      if (dono && dar > 0) {
        const prova = dono.prog.mochila.map((o) => (o ? { ...o } : null));
        if (guardar(prova, { k, n: dar })) { dono.prog.mochila = prova; tirar(a.prog.mochila, k, dar); dados.push(`${dar} ${ITENS[k].nome.toLowerCase()}`); } else dar = 0;
      } else dar = 0;
      if (n - dar > 0) ia.coletaResto[k] = (ia.coletaResto[k] || 0) + n - dar;
    }
    ia.coletaBase = this.contagemColetaAmiga(a);
    if (dados.length && dono) { this.aplicarStatus(dono); this.avisarProg(dono); }
    let fala = dados.length ? F.parte.replace('{itens}', dados.join(', ')) : '';
    if (fim) {
      const resto = Object.entries(ia.coletaResto).map(([k, n]) => ({ k, n: Math.min(n, contar(a.prog.mochila, k)) })).filter((x) => x.n > 0);
      if (resto.length) {
        const preco = Math.ceil(resto.reduce((t, x) => t + (ITENS[x.k].venda || 1) * x.n, 0) * this.margemAmiga(a));
        a.ia.reserva = resto; // abrindo a troca, já vai pra mesa
        fala = (fala ? fala + ' ' : '') + F.resto.replace('{itens}', resto.map((x) => `${x.n} ${ITENS[x.k].nome.toLowerCase()}`).join(', ')).replace('{preco}', preco);
      } else if (!fala) fala = F.nada;
    }
    if (dados.length) this.guardarAmiga();
    return fala;
  },
  fimAtividadeAmiga(a, falar = false) {
    const ia = a.ia; if (!ia.atividade) return '';
    if (a.coleta) this.pararColeta(a, null);
    if (a.pesca) this.pararPesca(a, null);
    const fala = this.dividirColetaAmiga(a, true);
    ia.atividade = null; ia.alvoColeta = null;
    if (falar) return fala;
    this.falarAmiga(fala); this.dizerAmiga(fala);
    return fala;
  },
  // a cada passo coletando: true = ela está cuidando disso (não segue o dono agora)
  passoAtividadeAmiga(j, dono) {
    const ia = j.ia, A = this.AMIGA.atividades[ia.atividade], C = this.AMIGA.coleta, F = this.AMIGA.falasColeta;
    // dividiu o bastante? dá a parte dele
    if (Object.values(this.ganhoColetaAmiga(j)).reduce((t, n) => t + n, 0) >= C.dividir) { const f = this.dividirColetaAmiga(j); if (f) this.falarAmiga(f); }
    if (j.fabrica) return this.pararAmiga(j), true;
    if (j.coleta) return this.pararAmiga(j), true;
    if (j.pesca) return this.pescandoAmiga(j), true;
    if (j.trava > 0) return this.pararAmiga(j), true;
    // ferramenta: faz na mochila (como um jogador); falta material: pega solto no chão ou pede pro André
    if (contar(j.prog.mochila, A.ferramenta) < 1) return this.ferramentaAmiga(j, dono, A.ferramenta);
    if (!ia.alvoColeta || this.tempo > ia.alvoColetaT) { ia.alvoColeta = this.acharColetaAmiga(j, dono, ia.atividade); ia.alvoColetaT = this.tempo + 5; }
    const al = ia.alvoColeta;
    if (!al) {
      if (!ia.disseSemLugar) { ia.disseSemLugar = true; this.falarAmiga(F.semLugar.replace('{lugar}', A.lugar)); }
      return false; // segue o André até achar
    }
    ia.disseSemLugar = false;
    const d = Math.hypot(al.x - j.x, al.z - j.z);
    if (d > al.perto) { this.irDireto(j, al.x, al.z, d > 6); return true; }
    this.pararAmiga(j);
    if (ia.atividade === 'pescar') { j.ry = Math.atan2(al.sx - j.x, al.sz - j.z); this.pescar(j.id, { acao: 'lancar', x: al.sx, z: al.sz }); }
    else this.coletar(j.id, { no: al.no });
    if (j.coleta || j.pesca) { ia.falhas = 0; return true; }
    // não deu: sem vigor para tudo; outro motivo: esquece esse lugar por um tempo
    if (vigorAgora(j.prog.vigor) < 1) { const f = this.fimAtividadeAmiga(j, true); this.falarAmiga(F.cansada + (f ? ' ' + f : '')); return false; }
    ia.ruins.set(al.id, this.tempo + 60); ia.alvoColeta = null;
    return true;
  },
  // pesca como gente: puxa depois de um tempinho de reação; peixe grande, toca rápido (sem passar do limite de toques)
  pescandoAmiga(j) {
    const ia = j.ia, f = j.pesca, C = this.AMIGA.coleta, sorte = ([x, y]) => x + Math.random() * (y - x);
    this.pararAmiga(j);
    if (f.st === 'fisgou') {
      if (!ia.puxarT) ia.puxarT = this.tempo + sorte(C.reacao);
      if (this.tempo >= ia.puxarT) { ia.puxarT = 0; this.pescar(j.id, { acao: 'puxar' }); }
    } else if (f.st === 'briga') {
      if (this.tempo >= (ia.toqueT || 0)) { ia.toqueT = this.tempo + 1 / (PESCA.briga.toquesSeg * C.toquesK); this.pescar(j.id, { acao: 'puxar' }); }
    } else ia.puxarT = 0;
  },
  // o lugar de coleta mais perto dela, perto do André: { id, x, z, perto, no | sx, sz }
  acharColetaAmiga(j, dono, tipo) {
    const C = this.AMIGA.coleta, ia = j.ia, ruim = (id) => (ia.ruins.get(id) || 0) > this.tempo;
    let melhor = null, md = Infinity;
    if (tipo === 'pescar') {
      for (const v of this.spots) {
        if (!v.ativo || ruim(v.id) || Math.hypot(v.x - dono.x, v.z - dono.z) > C.raio) continue;
        // um lugar em terra firme a 1,6-5 m do spot (a boia alcança): procura em volta, o mais perto dela
        for (let k = 0; k < 24; k++) {
          const ang = (k / 24) * Math.PI * 2, ux = Math.sin(ang), uz = Math.cos(ang);
          for (let r = 2; r <= 4.9; r += 0.2) {
            const x = v.x + ux * r, z = v.z + uz * r;
            if ((noLago(x, z)?.fundo || 0) > AGUA.peito - 0.5) continue; // fundo demais pra pescar daqui (a beira rasa serve)
            const dj = Math.hypot(x - j.x, z - j.z); if (dj < md) { md = dj; melhor = { id: v.id, x, z, sx: v.x, sz: v.z, perto: 0.35 }; }
            break;
          }
        }
      }
      return melhor;
    }
    for (const no of this.coletaveis.values()) {
      const K = COLETA[no.tipo]; if (!K || K.mao || ruim(no.id)) continue;
      if (tipo === 'lenha' ? no.tipo !== 'arvore' : K.prof !== 'min') continue;
      if (Math.hypot(no.x - dono.x, no.z - dono.z) > C.raio || (no.y != null && Math.abs((dono.y || 0) - no.y) > 2.5)) continue;
      if (profNivel(j.prog.prof[K.prof]) < (K.nivel || 1) || this.cargas(j, no) <= 0) continue;
      if (dono.coleta?.no === no.id) continue; // não pega o mesmo que ele
      const dj = Math.hypot(no.x - j.x, no.z - j.z) - no.r; if (dj < md) { md = dj; melhor = { id: no.id, no: no.id, x: no.x, z: no.z, perto: no.r + 1.6 }; }
    }
    return melhor;
  },
  // sem a ferramenta: faz; falta material: pedra/galho solto perto, senão pede pro André (de vez em quando)
  ferramentaAmiga(j, dono, k) {
    const ia = j.ia, F = this.AMIGA.falasColeta, R = FERRAMENTAS_FAZENDA[k], nome = ITENS[k].nome.toLowerCase();
    const falta = Object.entries(R.custo).map(([c, n]) => [c, n - contar(j.prog.mochila, c)]).filter(([, n]) => n > 0);
    if (!falta.length) { this.pararAmiga(j); this.falarAmiga(F.fazendo.replace('{item}', nome)); this.fabricar(j.id, { k }); return !!j.fabrica || true; }
    // pedra e galho soltos (pega com a mão, como qualquer um)
    let solto = null, md = Infinity;
    for (const no of this.coletaveis.values()) {
      const K = COLETA[no.tipo]; if (!K?.mao || !falta.some(([c]) => K.da?.[c]) || this.cargas(j, no) <= 0) continue;
      if (Math.hypot(no.x - dono.x, no.z - dono.z) > this.AMIGA.coleta.raio) continue;
      const dj = Math.hypot(no.x - j.x, no.z - j.z); if (dj < md) { md = dj; solto = no; }
    }
    if (solto) {
      if (md > solto.r + 1.6) { this.irDireto(j, solto.x, solto.z, md > 6); return true; }
      this.pararAmiga(j); this.coletar(j.id, { no: solto.id }); return true;
    }
    if (this.tempo - ia.faltaDitaT > this.AMIGA.coleta.pedirDeNovo) {
      ia.faltaDitaT = this.tempo;
      const txt = F.falta.replace('{item}', nome).replace('{falta}', falta.map(([c, n]) => `${n} ${ITENS[c].nome.toLowerCase()}`).join(' e '));
      this.falarAmiga(txt); this.dizerAmiga(txt);
    }
    return false; // segue o André enquanto espera
  },
};

// ---------- mais de um amigo virtual (André 2026-11-11: o Dario, "idêntico" à Cecília) ----------
// A Cecília é a própria Simulacao (this.amiga, this.amigaDono, this.amigaFalam, this.AMIGA). Cada outro amigo é uma
// "janela" para a mesma Simulacao com só estes campos próprios: as funções acima rodam iguais, com o corpo, o dono, quem
// fala e a definição (dados.js) dele. Tudo o mais (jogadores, lotes, times, eventos) é o mesmo mundo.
const PROPRIOS = ['AMIGA', 'amiga', 'amigaDono', 'amigaFalam'];
export function contextoDeAmigo(sim, def) {
  const own = { AMIGA: def, amiga: null, amigaDono: null, amigaFalam: new Set() };
  return new Proxy(sim, {
    get: (t, k) => (PROPRIOS.includes(k) ? own[k] : Reflect.get(t, k)),
    set: (t, k, v) => { if (PROPRIOS.includes(k)) own[k] = v; else t[k] = v; return true; },
    has: (t, k) => PROPRIOS.includes(k) || k in t,
  });
}

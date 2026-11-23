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
import { DIARIAS, DUELO, PVP, IA_CONVERSA, DIALOGO, REACOES, COMANDOS_TIME, NPC_SOLDADO, CLA, CLAS_NPC_ORDENS } from './dados.js';
import { CEREBRO, NPC_VIDA, NPC_SEM_NEVOA, HEROI, HABILIDADES, CURA, CONSTRUCOES, PLANTAS, HORTA, VILA_LOTES, CASA, ITENS, TIME, MONTARIAS, fasePlanta, COLETA, PESCA, FERRAMENTAS_FAZENDA, TIPOS_INIMIGO, VEICULOS } from './dados.js';
import { noLago, AGUA } from './relevo.js';
import { planejarRota, terraId } from './rota.js';
import { lugarDoVeiculo, fundoAgua, devolverBarquinho, centroNavio, packValido, precoPack, mercadoK, mercadoConta, capacidadeCarrinho } from './transporte.js';
import { decidir, ordenarRegras, limites, escolherArma, validarRegra, juntarDica } from './cerebro.js';
import { HISTORIA } from './dados.js';
import { LOJA, precoLoja, PLANTIO, RECEITA_ESTACAO, CATALISADOR, LUGARES } from './dados.js';
import { QUADRADOS_PLANTIO, lugarNoQuadrado } from './plantio.js';
import { diaDiarias, premioDiaria } from './diarias.js';
import { ARVORES_PLANTIO, ENCOMENDA, PROFISSOES, MINA, PACK_BOT, PACKS, PACK_REGRAS, GUERRA } from './dados.js'; // poção da Cecília e do Dario pelo preço da Rosa (André 2026-11-16)
import { etapaAtual, missaoAtual, zonaFechadaEm, motivoLibera, QUEM_LIBERA, SEM_NEVOA } from './historia.js';
import { HABS, barraValida, PONTOS_POR_NIVEL, xpProximo, guardar, guardarQueCabe, contar, tirar, horaDoJogo, ehNoite, liberarPaginas, vigorAgora, profNivel, precoVenda, ehEquip, itemValido, reforcoOk, nomeItem as nomeDoItem, pecasGastas, durab as durabilidade, reforcar, reforcoMax, custoReforco, materialReforco, reforcoPrecisa, atributoDoReforco } from './progresso.js';
import { motivoPeca, motivoTerreno, crescerPlanta, retPeca } from './simulacao.js';

// sorteia sem repetir a última da mesma lista (André 2026-11-15: as respostas prontas pareciam de robô)
const ULTIMA = new WeakMap();
const FALOU_SOZINHA = new Map(); // jogador -> tempo da última fala por conta própria de qualquer NPC (vezDeFalarSozinha)
const REAGIU = new Map(); // `${jogador}:${fato}` -> tempo: o primeiro NPC que reagiu a esse fato (reagirAmiga)
// a única recusa do soldado (André 2026-11-22)
const SEM_VIGOR = 'Estou sem vigor, no momento não posso.';
const sorteia = (l) => {
  if (!Array.isArray(l) || l.length < 2) return Array.isArray(l) ? l[0] : l;
  const u = ULTIMA.get(l);
  let i = Math.floor(Math.random() * (u == null ? l.length : l.length - 1));
  if (u != null && i >= u) i++;
  ULTIMA.set(l, i);
  return l[i];
};
const normAmiga = (t) => String(t).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
// André 2026-11-21 ("não fala que tá fazendo do nada e fico esperando uma hora e nada acontece"): pedido de coisa do jogo
// que o chat não faz (carrinho, construir, forjar, buscar item, a missão dele...) e a IA respondeu prometendo. Se a ação
// que o jogo fez de verdade não é a prometida, a fala vira um "não consigo" sincero (respostaAmiga).
const PEDIDO_FAZER = /\b(faz|faca|fazer|faria|cria|criar|crie|constroi|construir|construa|monta|montar|monte|forja|forjar|crafta|craftar|fabrica|fabricar|pega|pegar|busca|buscar|traz|trazer|traga|me da|me de|me manda|me envia|entrega|entregar|termina|terminar|completa|completar|conclui|concluir|junta|juntar|coleta|coletar|compra|comprar|vende|vender|planta|plantar|colhe|colher|ergue|levanta|forma|formar|prepara|preparar|cozinha|cozinhar|consegue|conseguiria|pode|poderia|da pra|tem como)\b/;
const PROMESSA = /\b((to|tou|estou|ja to|ja estou) (fazendo|criando|construindo|montando|forjando|craftando|fabricando|terminando|juntando|coletando|buscando|pegando|preparando|cozinhando|formando|erguendo|plantando|colhendo|trabalhando nisso|indo fazer|indo buscar|indo pegar|providenciando|resolvendo)|(vou|ja vou|vou ja|eu vou|deixa que eu|ja ja eu|daqui a pouco eu|depois eu) (fazer|criar|construir|montar|forjar|craftar|fabricar|terminar|juntar|coletar|buscar|pegar|preparar|cozinhar|formar|erguer|plantar|colher|providenciar|resolver|te mandar|te dar|te entregar|mandar|entregar|comecar|começar|ja)|(ja )?(fiz|criei|construi|montei|forjei|crafte|crafitei|fabriquei|terminei|juntei|coletei|peguei|preparei|cozinhei|formei|ergui|plantei|colhi|te mandei|te dei|te entreguei|mandei pra voce|comecei)|deixa comigo|pode deixar|ja ta saindo|ta saindo|em andamento|ja ja fica pronto|ja ja ta pronto|fica pronto em|daqui a pouco fica)\b/;
export function promessaSemAcaoAmiga(pedido, fala) { return PEDIDO_FAZER.test(normAmiga(pedido)) && PROMESSA.test(normAmiga(fala)); }
// encomenda (André 2026-11-21): quantos do recurso ela tem (peixe: qualquer peixe)
const contarRec = (mochila, item) => (item === 'peixe' ? mochila.reduce((s, o) => s + (o && ITENS[o.k]?.peixe && !o.cad ? o.n || 1 : 0), 0) : contar(mochila, item));
// "minera 20 de ferro pra mim", "corta lenha pra mim que eu compro": { rec, n } ou null (convite "bora minerar" não é)
// André 2026-11-21 (2ª parte): "pega umas madeiras", "coleta um ferro" também é encomenda (sem "pra mim"), até na pt;
// "bora minerar" / "minera comigo" continua sendo junto. n = 0: ele não disse quantos (ela pergunta).
export function encomendaDoTexto(texto) {
  const t = ' ' + normAmiga(texto) + ' ', E = ENCOMENDA, tem = (l) => l.some((w) => t.includes(' ' + w + ' '));
  const rec = Object.keys(E.recursos).find((k) => tem(E.recursos[k].palavras)), pra = tem(E.praMim);
  if (!pra && (!rec || tem(E.junto))) return null;
  if (!tem(E.verbos) && !(rec && /\b(quero|preciso|vende|compro)\b/.test(t))) return null;
  const n = Number((t.match(/ (\d{1,3}) /) || [])[1]) || 0;
  return { rec: rec || '', n: n ? Math.min(E.max, n) : 0 };
}
// resposta à pergunta dela ("quantos?" / "qual recurso?"): "20", "uns 15", "tanto faz", "ferro"
export function respostaEncomenda(texto) {
  const t = ' ' + normAmiga(texto) + ' ', E = ENCOMENDA, n = Number((t.match(/ (\d{1,3}) /) || [])[1]) || 0;
  const rec = Object.keys(E.recursos).find((k) => E.recursos[k].palavras.some((w) => t.includes(' ' + w + ' '))) || '';
  const qualquer = E.tantoFaz.some((w) => t.includes(' ' + w + ' '));
  return n || rec || qualquer ? { rec, n: n ? Math.min(E.max, n) : qualquer ? E.padrao : 0 } : null;
}
// ações em que o jogo faz de verdade o que ele pediu (a fala pode dizer que está indo/fazendo)
const ACOES_DE_VERDADE = new Set(['time', 'vir', 'cacar', 'voltar', 'pescar', 'minerar', 'lenha', 'pararAtividade', 'sairTime', 'barco', 'ajudarMissao', 'liderar', 'troca', 'amigo', 'encomenda', 'pack']);
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

// André 2026-11-17 (print): "Destino: Campo dos Lobos e Golens (Vael)" soava robô: o nome sai sem a região entre parênteses
export function nomeLugarAmiga(nome) { return String(nome || '').replace(/\s*\([^)]*\)\s*$/, ''); }
// André 2026-11-18 ("parece que está travada com informações antigas"): o diário guardava estado do jogo como lembrança
// ("preciso de 2 couros e um capacete melhor", "estou na porta da casa cuidando da horta", "combinamos caçar amanhã cedo")
// e ela repetia isso dias depois, contra a ficha (bota era a peça pior; ela usa cajado). Estado do jogo vem da ficha, na hora:
// lembrança assim não vai para a IA nem entra no diário (o que está guardado fica no banco, só não é lido).
const ESTADO_DO_JOGO = /capacete|casco|bota|luva|couro|pe[cç]a|equip|cajado|espada|\barma\b|n[ií]vel|level|\blvl\b|\bup(ar|ei|ou)?\b|miss[aã]o|quest|horta|milho|planta|colh|boost|upgrade|reset|preciso|precis(o|ando)|estou (na|no|em)|t[oô] (na|no|em)|vindo|amanh[aã]/i;
export function lembrancaBoa(t) { return typeof t === 'string' && !!t.trim() && !ESTADO_DO_JOGO.test(t); }
// a fala da IA no gênero de quem fala (ela: "tô pronta"; ele: "tô pronto"), só nos jeitos de falar de si mesmo
const ADJ_GENERO = ['pronto', 'cansado', 'sozinho', 'ocupado', 'animado', 'preparado', 'acostumado', 'cansadão', 'atrasado', 'perdido', 'preocupado', 'empolgado', 'ligado', 'focado', 'liberado', 'parado', 'quebrado', 'morto', 'feliz'];
export function generoFala(fala, genero = 'f') {
  const de = genero === 'm' ? 'a' : 'o', para = genero === 'm' ? 'o' : 'a';
  const adj = ADJ_GENERO.filter((w) => w.endsWith('o') || w.endsWith('ão')).map((w) => (w.endsWith('ão') ? w.slice(0, -2) + (de === 'o' ? 'ão' : 'ona') : w.slice(0, -1) + de));
  const re = new RegExp(`\\b((?:t[oô]|estou|fiquei|fico|ando|sou)\\s+(?:meio\\s+|muito\\s+|bem\\s+|super\\s+)?)(${adj.join('|')})\\b`, 'gi');
  return String(fala).replace(re, (m, a, w) => a + (w.endsWith('ona') ? w.slice(0, -3) + 'ão' : w.endsWith('ão') ? w.slice(0, -2) + 'ona' : w.slice(0, -1) + para));
}
// repertório único (André 2026-11-18): {feminino|masculino} pelo gênero de quem fala
export function vozAmiga(texto, genero = 'f') { return String(texto).replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (m, f, mm) => (genero === 'm' ? mm : f)); }
export const Amiga = {
  // ---------- entra e sai junto com o dono ----------
  // o servidor chama quando o dono entra na sala (contas de teste do André; sem contas, o primeiro que entra)
  // fala: quem entrou pode conversar com ele (chave de IA ou conta de teste). André 2026-11-11 ("quero que eles andem
  // sozinhos"): o NPC fica no mundo para todo mundo da sala; só quem pode conversar vira o "dono" que ele acompanha.
  amigaEntrar(donoId, fala = true) {
    if (this.AMIGA.recruta && !this.AMIGA.clanpc && !this.semLider && this.jogadores.get(donoId)?.conta !== this.AMIGA.lider) return; // recruta do clã (shared/cla.js): só com o líder (ou entrando sem ele: entrarRecrutasSemLider)
    if (fala) (this.amigaFalam ||= new Set()).add(donoId); else this.amigaFalam ||= new Set();
    if (!this.amiga && this.iaForaAmiga()) { this.amigaFora ||= { t: this.tempo }; return; } // deslogado até a IA voltar
    if (!this.amiga) {
      const L = this.loteDaAmiga(true);
      let salvo = this.npcSalvos?.get(this.AMIGA.id) || L?.amiga || {}; // André 2026-11-22: sem casa na vila; o save de todos fica na tabela mundo
      // recomeço (André 2026-11-11): tudo o que ela jogou volta ao zero (nível, peças, ouro, bolsa, amizades, diário);
      // o jeito dela (código) fica. O save antigo fica guardado em 'antes' para dar para voltar se ele pedir.
      let antes = salvo.antes || null;
      if (this.AMIGA.recomeco && salvo.recomeco !== this.AMIGA.recomeco) {
        if (salvo.prog) { const { antes: _velho, ...resto } = salvo; antes = { ...resto, guardado: this.AMIGA.recomeco }; }
        salvo = {};
      }
      // recomeço só do jogo (André 2026-11-17: "reseta tudo, reseta nível... quero ver como eles vão sair e acompanhar a
      // evolução"): nível, peças, ouro, bolsa, história, grind e lições voltam ao zero; o que ela sabe de cada pessoa
      // (amizade, lista de amigos, lembranças, fatos, conversa) fica. O jogo antigo fica em 'antesJogo'.
      let antesJogo = salvo.antesJogo || null;
      if (this.AMIGA.recomecoJogo && salvo.prog && salvo.recomecoJogo !== this.AMIGA.recomecoJogo) {
        const { prog, grind, missaoDia, licoes, pedido, t } = salvo;
        antesJogo = { prog, grind, missaoDia, licoes, pedido, t, guardado: this.AMIGA.recomecoJogo };
        salvo = { ...salvo, prog: null, grind: null, missaoDia: null, licoes: {}, pedido: null, evolucao: null, t: Date.now(), histReal: 1 };
      }
      const j = this.adicionarJogador(this.AMIGA.id, this.AMIGA.nome, this.AMIGA.visual, { aparencia: this.AMIGA.aparencia, progresso: salvo.prog || null });
      j.conta = this.AMIGA.conta; j.bot = true;
      // progressão (André 2026-11-10): quem mora no mundo sem casa (aventureiros) já tem tudo aberto. Cecília e Dario (com
      // terreno) fazem a história de verdade (André 2026-11-16, #569); até 2026-11-17 esta linha marcava a história deles
      // como toda feita a cada entrada (bug: "como fizeram todas as missões?"). Save sem histReal: começa do zero uma vez.
      // André 2026-11-21 ("quero que eles façam... as missões de história principais"): a Geada (Kira, Rufo, Lis) também
      // faz a história de verdade, como a Cecília e o Dario; antes ela entrava com tudo feito. Começa do zero uma vez.
      if (!this.AMIGA.terreno && !this.AMIGA.rival) j.prog.hist = { v: 2, p: HISTORIA.length, ac: false, e: 0, n: 0, m: 0 };
      else if (!salvo.histReal || !j.prog.hist) j.prog.hist = { v: 2, p: 0, ac: false, e: 0, n: 0, m: 0 };
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
        const n = Math.max(1, Math.min(this.AMIGA.nivelInicial, this.AMIGA.rival ? Infinity : this.nivelTetoNpc ?? Infinity)); // a Geada começa acima da Trégua
        j.prog.pontos += (n - j.prog.nivel) * PONTOS_POR_NIVEL; j.prog.nivel = n; j.prog.xp = 0; j.prog.ouro += 25 * n;
      }
      // a Geada (rival) nunca fica abaixo do nível com que foi criada (André 2026-11-22: o Gael veio do save de aventureiro no
      // Nv 20, preso ao teto do servidor; o nível dele é o 44 da lista)
      if (this.AMIGA.rival && (j.prog.nivel | 0) < this.AMIGA.nivelInicial) { const n = this.AMIGA.nivelInicial; j.prog.pontos += (n - j.prog.nivel) * PONTOS_POR_NIVEL; j.prog.nivel = n; j.prog.xp = 0; }
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
      // quem a adicionou na lista de amigos e ela aceitou (André 2026-11-16: "eu queria ter que adicionar ele"): conta -> 1
      j.missaoDia = salvo.missaoDia && typeof salvo.missaoDia.dia === 'string' ? { dia: salvo.missaoDia.dia, seg: Math.max(0, +salvo.missaoDia.seg || 0) } : null;
      j.evolucao = Array.isArray(salvo.evolucao) ? salvo.evolucao.slice(-NPC_VIDA.evolucao.max) : []; // diário de evolução (/npcs.json)
      j.grind = salvo.grind && typeof salvo.grind.dia === 'string' ? { dia: salvo.grind.dia, seg: Math.max(0, +salvo.grind.seg || 0) } : null;
      j.amigosDe = salvo.amigosDe && typeof salvo.amigosDe === 'object' ? Object.fromEntries(Object.keys(salvo.amigosDe).slice(0, 500).map((k) => [k, 1])) : {};
      // memória de cada pessoa (conta -> lista), dicas que viraram regra (conta -> { curaCedo: true }) e o que fazem juntos
      const porConta = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
      j.memorias = porConta(salvo.memorias); j.regras = porConta(salvo.regras); j.gostos = porConta(salvo.gostos);
      j.fatos = porConta(salvo.fatos); j.semIa = porConta(salvo.semIa); j.conversasSalvas = porConta(salvo.conversas); // André 2026-11-17: fatos e a conversa recente
      j.registro = porConta(salvo.registro); // André 2026-11-18: a conversa do dia inteiro (hoje e ontem) para a ronda
      // dicas que viraram regra do cérebro (entrega 2, André 2026-11-11): valem para todo mundo; o banco é conferido de novo
      j.dicas = Array.isArray(salvo.dicas) ? salvo.dicas.map((d) => validarRegra(d, CEREBRO)).filter(Boolean).slice(-CEREBRO.dicas.max) : [];
      j.licoes = licoesValidas(salvo.licoes); // o que aprendeu caindo (entrega 4)
      j.amizadeAntiga = salvo.amizades ? salvo.antiga ?? null : salvo.amizade | 0; // save de antes de 2026-11-10: a amizade era do André (conta de teste)
      j.pedido = salvo.pedido && ITENS[salvo.pedido.k] ? { k: salvo.pedido.k, n: salvo.pedido.n | 0 } : null;
      j.amigaAntes = antes; j.amigaAntesJogo = antesJogo;
      j.ia = { fase: 'pensar', ate: 0 };
      j.semTeto = !!this.AMIGA.terreno || !!this.AMIGA.rival; // Cecília e Dario sobem sem o teto do jogador mais alto (André 2026-11-16); a Geada também
      // André 2026-11-21: enquanto eles grindam, sem a trava da névoa (nada de missão para abrir); desligue em NPC_SEM_NEVOA (shared/dados.js)
      if (NPC_SEM_NEVOA && j.semTeto) SEM_NEVOA.add(j.prog); else SEM_NEVOA.delete(j.prog);
      if (j.semTeto) this.diariasOfflineAmiga(j, salvo.t); // os dias em que ninguém jogou: as diárias dele também (André 2026-11-21)
      if (this.AMIGA.raca) j.raca = this.AMIGA.raca; // Chama x Geada (shared/guerra.js): sem raça = Chama
      j.guerraMem = salvo.guerra && typeof salvo.guerra === 'object' && !Array.isArray(salvo.guerra) ? Object.fromEntries(Object.entries(salvo.guerra).slice(-300)) : {}; // quem ele já viu e o placar
      this.pocoesAmiga(j);
      // o leilão (André 2026-11-21): poupança para a meta, o ouro visto na última olhada e os últimos negócios
      const lbS = salvo.leilao && typeof salvo.leilao === 'object' && !Array.isArray(salvo.leilao) ? salvo.leilao : null;
      j.leilaoBot = lbS ? { poupado: Math.max(0, +lbS.poupado || 0), visto: Number.isFinite(+lbS.visto) ? +lbS.visto : j.prog.ouro | 0, log: Array.isArray(lbS.log) ? lbS.log.slice(-12) : [], meta: lbS.meta || null, t: lbS.t || 0 } : null;
      // aparece na porta de casa (ou no canto do terreno, se a casa ainda não existe); sem casa, na vila do nível dele
      const def = L?.def, M = !def && this.moradiaAmiga(j), x = def ? def.x0 + this.AMIGA.porta[0] : M ? M.x : this.mapa.nascimento.x + 2, z = def ? def.z0 + this.AMIGA.porta[1] : M ? M.z : this.mapa.nascimento.z + 2;
      Object.assign(j, { x, z, y: this.terreno.altura(x, z), ry: Math.PI, chao: true });
      this.amiga = j;
      this.amigaDono = null;
    }
    if (this.semLider) { this.semLider = false; return; } // recruta com o líder fora: só ganha corpo (ninguém acompanha)
    // André 2026-11-15: com ou sem chave, todo mundo toca nele e vê Mensagem/Time (a chave só troca a resposta pela IA).
    // Acompanhar quem chegou na hora de entrar: só quem tem a chave (sem chave, passa a acompanhar quando falar com ele)
    const outra = this.outraRaca(this.jogadores.get(donoId), this.amiga); // Chama x Geada (André 2026-11-18): da outra raça é "monstro", da mesma é igual ao Dario
    if (outra) fala = false;
    if (fala && !this.jogadores.has(this.amigaDono)) this.mudarDonoAmiga(donoId); // ninguém com ela: acompanha quem chegou
    if (outra) return; // da outra raça não vira amigo virtual de quem entrou
    this.evento({ t: 'amiga', para: donoId, id: this.AMIGA.id, nome: this.AMIGA.nome, papel: this.AMIGA.papel, lote: this.loteDaAmiga()?.def.id || null, segue: !!this.AMIGA.seguivel });
    this.avisarVirtuaisAmiga(); // ela aparece em "Amigos virtuais" (para todos; quem não tem chave vê o botão de ativar)
  },
  // ---------- vários amigos (André 2026-11-10: irmão e irmã com a chave de cada um) ----------
  // André 2026-11-14 ("qualquer um pode interagir, só que o único que tem resposta de IA sou eu"): todo jogador da sala
  // conversa (respostas prontas, das regras), chama para o time e troca. A resposta da IA é só de quem tem a chave
  // (amigaFalam: quem colou a chave Groq e as contas de teste), ver iaAmiga e server/index.js falarComAmigoIa.
  // recruta de jogador com o modo soldado: obedece sempre ao líder (André 2026-11-22)
  soldadoAmiga() { return NPC_SOLDADO.ligado && !!this.AMIGA.recruta && !this.AMIGA.clanpc; },
  podeAmiga(id) { const j = id != null && this.jogadores.get(id); return !!this.amiga && !!j && !j.bot && (!this.AMIGA.recruta || !!this.AMIGA.clanpc || j.conta === this.AMIGA.lider); }, // recruta: só o líder
  // André 2026-11-19: a IA vale para todo jogador (sem precisar de chave própria), só nos da Chama (a Geada é só código)
  iaAmiga(id) { return IA_CONVERSA.ligada && !!this.amiga && (IA_CONVERSA.quem.includes(this.AMIGA.id) || (!!this.AMIGA.recruta && !this.AMIGA.clanpc)) && id != null && this.podeAmiga(id); },
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
  // ---------- amizade conquistada (André 2026-11-16) ----------
  // "Eu queria ter que adicionar ele na lista de amigos, não que ele aparecesse na minha lista como já aparece... se eles
  // não quiserem, eles vivem a vida deles e eu chamo quando precisa". Ela só entra na lista (Amigos virtuais, com o ♥ da
  // amizade) depois que a pessoa pede (tocando nela ou pela busca do nome) e ela aceita. Pode recusar: ocupada (caçando
  // longe, lutando, com outra pessoa) diz para pedir depois; sem conhecer a pessoa, às vezes quer conversar antes.
  // soldado (André 2026-11-22): recruta do jogador só com o líder dele; os outros, todo mundo da raça (conversar)
  ehAmigoAmiga(j) { if (NPC_SOLDADO.ligado && j && !j.bot && this.amiga) return this.AMIGA.recruta && !this.AMIGA.clanpc ? j.conta === this.AMIGA.lider : !this.outraRaca(j, this.amiga); return !!(j && this.amiga?.amigosDe?.[j.conta]); }, // soldado: todo mundo da raça dele
  pedidoAmizadeAmiga(id, viaChat = false) {
    const a = this.amiga, j = this.jogadores.get(id), P = this.AMIGA.amigoLista; if (!a || !j || j.bot || !j.conta) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto }), nome = this.AMIGA.nome;
    if (!this.amigoBotOk(this, j)) return aviso(`${nome} não é líder de clã: só dá para adicionar líder de clã`); // AMIGOS.soLideres (André 2026-11-23)
    if (this.ehAmigoAmiga(j)) return aviso(`${nome} já é seu amigo`);
    if ((a.ia.amigoNao?.[j.conta] || 0) > this.tempo) return aviso(`${nome} pediu para você esperar um pouco`);
    const fala = (t) => (viaChat ? this.dizerAmiga(t, false, id) : this.evento({ t: 'fala', para: id, npc: this.AMIGA.id, texto: `${nome}: ${t}` }));
    const nao = (t, s) => { (a.ia.amigoNao ||= {})[j.conta] = this.tempo + s; fala(t); };
    // ocupada: caçando sozinha, lutando, no time de outra pessoa ou caída
    const lutando = a.ia.cer?.alvo || (a.ia.av && a.ia.av.fase === 'cacar'), outro = a.time && a.time !== j.time;
    if (a.morto || lutando || outro) return nao(sorteia(P.ocupada).replace('{o}', this.AMIGA.genero === 'm' ? 'o' : 'a'), P.esperaOcupada);
    const amz = this.amizadeAmiga(j), chance = Math.min(1, P.base + amz * P.porAmizade);
    if (Math.random() >= chance) return nao(sorteia(P.antes), P.esperaRecusa);
    (a.amigosDe ||= {})[j.conta] = 1;
    this.guardarAmiga();
    fala(sorteia(P.aceita));
    aviso(`${nome} agora é seu amigo!`);
    this.enviarAmigos(j);
  },
  desfazerAmizadeAmiga(j) {
    const a = this.amiga; if (!a || !this.ehAmigoAmiga(j)) return false;
    delete a.amigosDe[j.conta]; this.guardarAmiga(); return true;
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
  amigaSair(donoId, forcar = false) {
    if (!this.amiga) return;
    if (this.AMIGA.recruta && !this.AMIGA.clanpc) { // recruta do clã (shared/cla.js): sai junto com o líder (ou dispensado), nunca fica sem ele
      // fica no mundo enquanto tiver jogador online, com ou sem o líder (André 2026-11-23: "todos iguais"); sai com o último
      if (!forcar && [...this.jogadores.values()].some((o) => !o.bot && o.id !== donoId)) return;
      if (!forcar) this.foraDesde = Date.now(); // ficou sem o líder e saiu com o servidor vazio: o tempo fora (shared/cla.js foraRecrutas) conta daqui
      this.amigaFalam?.clear();
      if (this.amiga.ia?.atividade) this.fimAtividadeAmiga(this.amiga, false);
      if (this.amiga.time) this.sairDoTime(this.amiga, `${this.AMIGA.nome} saiu do jogo`);
      this.guardarAmiga();
      this.jogadores.delete(this.amiga.id);
      this.amiga = null; this.amigaDono = null;
      return;
    }
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
  // André 2026-11-22 ("Não vai existir mais casa de bot nenhum... todo mundo vai ter uma base"): a casa da Cecília e do
  // Dario fica no lote deles na base do clã (shared/base.js); sem base ainda, ficam sem casa (moram na vila).
  loteDaAmiga(criar = false) {
    if (!this.AMIGA.terreno) return null; // aventureiro sem casa (André 2026-11-11): mora na vila do nível dele
    for (const L of this.lotes.values()) if (L.dono === this.AMIGA.conta && L.def.baseK) return L;
    if (!criar) return null;
    const id = this.AMIGA.id;
    for (const B of Object.values(this.basesCla || {})) {
      const i = B.dono === 'npc:' + id ? 1 : +(Object.keys(B.donos || {}).find((k) => B.donos[k].id === id) || 0);
      if (!i) continue;
      const L = this.loteDaBase?.(B, i, this.AMIGA.conta, this.AMIGA.nome);
      if (L) this.avisarLote(L);
      return L || null;
    }
    return null;
  },
  // guarda o progresso dela dentro do terreno (vai para o banco em lotesParaSalvar)
  guardarAmiga() {
    const j = this.amiga; if (!j) return;
    const amizades = { ...(j.amizades || {}) }; if (j.donoConta) amizades[j.donoConta] = j.amizade | 0;
    const dados = { t: Date.now(), prog: j.prog, amizade: j.amizade | 0, amizades, amizadeDia: j.amizadeDia || {}, amigosDe: j.amigosDe || {}, grind: j.grind || null, missaoDia: j.missaoDia || null, evolucao: j.evolucao || [], ...(this.AMIGA.terreno || this.AMIGA.rival ? { histReal: 1 } : {}), ...(j.amizadeAntiga != null ? { antiga: j.amizadeAntiga } : {}), guerra: j.guerraMem || {}, leilao: j.leilaoBot || null, memorias: j.memorias || {}, fatos: j.fatos || {}, semIa: j.semIa || {}, conversas: this.conversasParaSalvarAmiga(j), registro: j.registro || {}, regras: j.regras || {}, dicas: j.dicas || [], licoes: j.licoes || {}, gostos: j.gostos || {}, pedido: j.pedido || null, justa: 1, ...(this.AMIGA.recomeco ? { recomeco: this.AMIGA.recomeco } : {}), ...(this.AMIGA.recomecoJogo ? { recomecoJogo: this.AMIGA.recomecoJogo } : {}), ...(j.amigaAntesJogo ? { antesJogo: j.amigaAntesJogo } : {}), ...(j.amigaAntes ? { antes: j.amigaAntes } : {}) };
    (this.npcSalvos ||= new Map()).set(this.AMIGA.id, dados); (this.npcsMudados ||= new Set()).add(this.AMIGA.id); // tabela mundo do banco (todos, desde 2026-11-22)
  },
  // ---------- a cabeça dela (a cada passo da simulação) ----------
  // Em volta da cabeça: confere se o passo anterior saiu do lugar (André 2026-11-12: "ficam caminhando sem sair do lugar
  // o tempo todo, batendo na parede lá da casa deles... ou ficam parados, ou ficam andando de verdade"). AMIGA.parede.
  passoAmiga(dt) {
    if (this.passoLogAmiga()) return; // a IA do dia acabou: despede, desloga e volta depois (André 2026-11-19)
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
    if (this.tempo >= (ia.diarioT || 0)) { ia.diarioT = this.tempo + 5; this.diarioAmiga(); this.vigiarEvolucaoAmiga(j); } // memória: conversas que terminaram
    this.passoChatAmiga(j); // mensagens dela no chat (respostas "digitando" e quando ela chama o André)
    if (j.pvp) return this.passoArenaAmiga(j); // Arena PvP (shared/arena.js): luta pelo time dela até a partida acabar
    if (j.troca) return this.passoTrocaAmiga(j); // trocando (fase 3): fica parada olhando para ele e negocia
    // caiu lutando: renasce em casa (a cama dela), como qualquer jogador, e CONTINUA no time (André 2026-11-11: "quando o bot
    // morre, ele sai do meu time. Eu não quero"). Uma vez por queda: avisa, conserta no Tomás e repõe as poções na Rosa com o
    // ouro dela; ao levantar, o passoTimeAmiga a traz de volta até o dono pela estrada (montada).
    if (j.morto) { if (!ia.caiu) { ia.caiu = true; ia.caiuT = this.tempo; this.evolucaoAmiga(j, 'morreu', ia.av?.c?.nome || (j.time ? 'no time' : '')); const f = this.aprenderMorteAmiga(j); if (j.time) this.falarAmiga(`${this.AMIGA.falas.caiu} ${f}`); this.pocoesAmiga(j); if (ia.encomenda && !ia.encomenda.pronta) this.fimEncomendaAmiga(j, 'luta'); } ia.fase = 'pensar'; ia.av = null; ia.viagem = null; return; }
    ia.caiu = false;
    if (j.duelo) return this.passoDueloAmiga(j); // duelando (shared/duelo.js): só luta contra quem chamou
    if (this.protegerVeiculoAmiga(j, dt)) return; // "Proteger carrinho / mercante" (painel do clã): antes da guerra, para não perseguir
    if (this.guerraAmiga(j, dt)) return; // Chama x Geada (shared/guerra.js): atacar, ajudar, fugir ou poupar a outra raça
    if (this.protegerAmiga(j, dt)) return; // função "Proteger" do painel do clã (shared/cla.js)
    if (this.almaAmiga(j, dt)) return; // função "Farmar recurso: Fragmento de Alma": caça a outra raça
    if ((this.AMIGA.recruta || this.fixoClaNpc?.(this)) && this.passoFazendaRecruta(this, j, dt)) return; // função "Fazenda": canteiros da base do clã
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
    if (ia.packTarefa && this.passoPackAmiga(j, dt)) return; // levando o pack dele (André 2026-11-21)
    // encomenda na pt (André 2026-11-21: "mesmo em time, vai no spot mais próximo"): coleta sozinh@ e depois volta pro time
    if (j.time && ia.av?.encomenda && ia.encomenda && !ia.encomenda.pronta) { ia.noTime = true; return this.passoSozinhoAmiga(j, dt); }
    if (j.time && ia.av?.encomenda) ia.av = null; // terminou: o time traz de volta
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
    // André 2026-11-21 ("quero que eles façam as diárias e as missões da história"): os 30 min de caça do dia acabaram,
    // mas ainda tem missão ou diária para fazer: sai do mesmo jeito (o escolher não deixa caçar além do limite)
    if (Math.random() < NPC_VIDA.aventura.chance && naHoraDe(this.rotinaAmiga(), horaDoJogo(j.prog.dia)) && (!this.grindAcabouAmiga(j) || this.temTarefaAmiga(j))) { ia.av = { fase: 'escolher' }; return; }
    if (Math.random() < 0.5) {
      const [x, z] = sorteia(PASSEIOS);
      this.irPara(j, L, { x: x + Math.random() - 0.5, z: z + Math.random() - 0.5 }, () => { ia.fase = 'parada'; ia.ate = this.tempo + this.AMIGA.passo.passeio * (0.5 + Math.random()); });
    } else this.irPara(j, L, { x: L.def.x0 + this.AMIGA.porta[0] + Math.random() * 2 - 1, z: L.def.z0 + this.AMIGA.porta[1] }, () => { ia.fase = 'parada'; ia.ate = this.tempo + this.AMIGA.passo.passeio; j.ry = 0; });
  },
  // ---------- vida própria (André 2026-11-11: "quero que eles andem sozinhos"; os 22 iguais) ----------
  // a vila onde ele mora agora (muda com o nível: NPC_VIDA.moradia); o ponto é espalhado por NPC para não juntar todos
  moradiaAmiga(j) {
    if (this.AMIGA.lar) { const C = this.AMIGA.lar, h = hashNpc(this.AMIGA.id), a = (h % 360) * Math.PI / 180; return { ...C, x: C.x + Math.cos(a) * C.r * 0.6, z: C.z + Math.sin(a) * C.r * 0.6 }; } // a Geada mora no Juncal
    let M = NPC_VIDA.moradia[0];
    for (const m of NPC_VIDA.moradia) if ((j.prog.nivel | 0) >= m.nivel) M = m;
    let h = 0; for (const c of this.AMIGA.id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    const a = (h % 360) * Math.PI / 180, r = M.r * (0.35 + ((h >> 9) % 60) / 100);
    return { ...M, x: M.x + Math.cos(a) * r, z: M.z + Math.sin(a) * r };
  },
  // pontos de atributo pelo jeito (gosto pelo cajado): Força, Inteligência e Vitalidade na proporção dele
  pontosAmiga(j) {
    const J = CEREBRO.jeitos[this.AMIGA.id] || this.AMIGA.luta || CEREBRO.jeitos.padrao, peso = { for: Math.max(0.05, 1 - J.cajado), int: Math.max(0.05, J.cajado), vit: 0.8 };
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
    // André 2026-11-16: Cecília e Dario só caçam onde a história deles já abriu (como o jogador)
    const ok = this.cacas.map((c) => c.def).filter((c) => !c.boss && !c.tunel && (c.nivel || 1) <= n + A.campoAcima - (j.licoes?.acima || 0) && !(fora && fora.has(c.id)) && !(j.semTeto && zonaFechadaEm(j.prog, c.x, c.z)));
    ok.sort((a, b) => (b.nivel || 1) - (a.nivel || 1) || Math.hypot(a.x - j.x, a.z - j.z) - Math.hypot(b.x - j.x, b.z - j.z));
    // a Geada caça perto de casa (os campos do leste, em volta do Juncal); sem campo do nível por lá, vale o de sempre
    if (this.AMIGA.lar) { const C = this.AMIGA.lar, l = ok.filter((c) => Math.hypot(c.x - C.x, c.z - C.z) < 360); if (l.length) ok.splice(0, ok.length, ...l); }
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
      if (e.tipo === 'jogador' || e.treino || e.bm || e.hc || e.tipo === 'chefe' || TIPOS_INIMIGO[e.tipo]?.chefe) continue; // a outra raça: quem decide é o cérebro de guerra (shared/guerra.js)
      if ((e.nivel || 1) > (j.prog.nivel | 0) + A.mobAcima - (j.licoes?.acima || 0) || Math.hypot(e.x - c.x, e.z - c.z) > (c.r || 12) + A.raio) continue;
      const d = Math.hypot(e.x - j.x, e.z - j.z); if (d < md) { md = d; melhor = e; }
    }
    return melhor;
  },
  // vai até o ponto (estrada e lobo de longe, como quando vem até o dono); true = chegou
  irLongeAmiga(j, x, z, dt) {
    const d = Math.hypot(x - j.x, z - j.z);
    if (this.marAmiga(j, x, z, dt)) return false;
    if (this.longeAmiga(j, { x, z, solo: true, montado: null }, d, dt)) return false;
    if (d > 2) { j.montado = null; this.irDireto(j, x, z, d > 5); return false; }
    this.pararAmiga(j); j.montado = null; return true;
  },
  // outra terra sozinho (André 2026-11-22: "quando chegar a hora eles vão pra ilha do meio e outro continente?"): o campo
  // do nível (ou a vila, na volta) fica do outro lado do mar e ele tem o barquinho: vai reto até lá, entra no barco na
  // beira (barcoAmiga), rema e desce na margem. true = cuidou do passo
  marAmiga(j, x, z, dt) {
    const tj = terraId(j.x, j.z), tx = terraId(x, z);
    const remando = j.veiculo === 'barquinho';
    if (!remando && !(tx > 0 && tj !== tx && contar(j.prog.mochila, 'barquinho') > 0)) return false;
    if (remando && tx > 0 && tj === tx && Math.hypot(x - j.x, z - j.z) < 2) return false;
    const ia = j.ia; ia.viagem = null; j.montado = null;
    ia.outraTerra = !remando; // na terra: procura a água; remando: desce na primeira margem que der (a do outro lado)
    this.barcoAmiga(j, { x, z, y: this.terreno.altura(x, z) }, dt);
    this.irDireto(j, x, z, true);
    return true;
  },
  // A rotina sozinho: escolher -> ir ao campo -> caçar -> voltar para a vila -> vender/consertar/poção -> descansar.
  // De noite fica na vila. Mochila cheia, sem poção ou fugindo: volta. Quem tem casa (Cecília, Dario) volta para ela.
  passoSozinhoAmiga(j, dt) {
    const ia = j.ia, A = NPC_VIDA.aventura, t = this.tempo, R = this.rotinaAmiga(), sorte = ([a, b], k = 1) => (a + Math.random() * (b - a)) * k;
    // primeira vez na sala: cada um espera um pouco antes de sair (ninguém sai junto)
    if (!ia.av) { ia.av = ia.jaSaiu ? { fase: 'escolher' } : { fase: 'descansar', ate: t + ((hashNpc(this.AMIGA.id) >> 4) % 1000) / 1000 * 240 }; ia.jaSaiu = true; }
    const av = ia.av;
    if (j.trava > 0) return this.pararAmiga(j);
    const sold = this.soldadoAmiga(); // soldado do jogador: sem horário nem limite de grind (André 2026-11-22)
    const noite = !sold && !naHoraDe(R, horaDoJogo(j.prog.dia)); // fora do horário dele (cada um tem o seu)
    const livres = j.prog.mochila.filter((o) => !o).length, temPocao = j.prog.mochila.some((o) => o?.k === 'pocao');
    const voltar = () => { if (j.coleta) this.pararColeta(j, null); if (j.pesca) this.pararPesca(j, null); Object.assign(av, { fase: 'voltar', c: null, coleta: null }); ia.viagem = null; };
    if (av.fase === 'escolher') {
      if (noite || livres < A.mochilaLivre) return voltar();
      // André 2026-11-16: grind sozinho limitado por dia real; soldado do clã não tem limite (André 2026-11-22, como no 'ir'
      // logo abaixo). Antes ele passava dos 30 min, escolhia, voltava para a vila e ficava em volta dela o dia todo (23/11).
      const cansouGrind = !sold && this.grindAcabouAmiga(j);
      // missão da história (André 2026-11-16: "pra liberar o mapa ele tem que fazer missão, igual a gente")
      if (this.querMissaoAmiga(j)) { Object.assign(av, { fase: 'missao', c: null, coleta: null, alvo: null }); ia.viagem = null; return; }
      // diárias (André 2026-11-17: "tanto ela quanto o Dario façam as missões diárias... até pra gente ter gente pra
      // reflorestar esse mapa"): plantar árvore numa área de plantio, pescar ou cortar/minerar quando faltar a diária
      const dia = this.diariaQueFaltaAmiga(j);
      if (dia === 'plantar') { Object.assign(av, { fase: 'plantar', c: null, coleta: null, alvo: null, n: 0, tentou: 0 }); ia.viagem = null; return; }
      if (dia) {
        const c = this.lugarColetaAmiga(j, dia);
        if (c) { Object.assign(av, { fase: 'ir', c, coleta: dia, ate: t + sorte(A.cacar, R.caca) }); ia.viagem = null; ia.alvoColeta = null; return; }
      }
      // quem gosta de pescar, minerar ou cortar lenha vai fazer isso (com vigor); senão, caça
      const gosto = this.AMIGA.gosto, Ativ = this.AMIGA.atividades?.[gosto];
      if (Ativ && !av.semColeta && Math.random() < R.coleta && vigorAgora(j.prog.vigor) >= 1 && contar(j.prog.mochila, Ativ.ferramenta) > 0) {
        const c = this.lugarColetaAmiga(j, gosto);
        if (c) { Object.assign(av, { fase: 'ir', c, coleta: gosto, ate: t + sorte(A.cacar, R.caca) }); ia.viagem = null; ia.alvoColeta = null; return; }
      }
      av.semColeta = false;
      if (cansouGrind || !temPocao) return voltar();
      const c = this.campoAmiga(j, av.fora);
      if (!c) return voltar();
      Object.assign(av, { fase: 'ir', c, coleta: null, ate: t + sorte(A.cacar, R.caca) });
      ia.viagem = null;
      return;
    }
    if (av.fase === 'missao') return this.missaoSozinhoAmiga(j, av, noite, voltar, dt);
    if (av.fase === 'plantar') return this.plantarSozinhoAmiga(j, av, noite, voltar, dt);
    if (av.coleta && (av.fase === 'ir' || av.fase === 'cacar')) return this.coletaSozinhoAmiga(j, av, noite, livres, voltar, dt);
    if (av.fase === 'ir' || av.fase === 'cacar') {
      const c = av.c;
      // outra terra: sem barquinho, faz um se tiver o material (e vai de barco); senão, outro campo
      if (ia.viagem?.bloqueio) { if (!av.coleta && contar(j.prog.mochila, 'barquinho') < 1) this.barcoPedidoAmiga(j); if (contar(j.prog.mochila, 'barquinho') < 1) (av.fora ||= new Set()).add(c.id); ia.viagem = null; if (!contar(j.prog.mochila, 'barquinho')) av.fase = 'escolher'; return; }
      if (noite || livres < A.mochilaLivre || t >= av.ate || (!sold && this.grindAcabouAmiga(j))) return voltar();
      if (av.fase === 'cacar' && dt > 0) { this.grindHojeAmiga(j); const m0 = Math.floor(j.grind.seg / 60); j.grind.seg += dt; if (Math.floor(j.grind.seg / 60) !== m0) this.guardarAmiga(); } // conta o grind sozinho (grava a cada minuto)
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
      if (ia.levar && this.levarBauRecruta?.(this, j, dt)) return; // recruta com recurso pedido: leva ao Baú do Clã (cla.js)
      const M = this.pontoVilaAmiga(j), L = this.loteDaAmiga();
      const casa = L ? { x: L.def.x0 + this.AMIGA.porta[0], z: L.def.z0 + this.AMIGA.porta[1] } : M;
      const canto = L && Math.hypot(casa.x - j.x, casa.z - j.z) < 15 && this.contornoCasa(L, j, casa);
      if (canto) { j.montado = null; this.irDireto(j, canto.x, canto.z, false); return; } // atrás da casa: dá a volta
      if (!this.irLongeAmiga(j, casa.x, casa.z, dt)) return;
      // na vila: vende o que não usa, conserta no Tomás e compra poção na Rosa (com o ouro dele)
      this.arrumarMochilaAmiga(j); this.pocoesAmiga(j); this.diariasAmiga(j);
      // André 2026-11-17: "se ela tiver o material e o dinheiro e o equipamento, ela vai lá e faz upgrade" e reforça sozinha.
      // Primeiro evolui (evoluir zera o reforço da peça), depois reforça com o ouro que sobra.
      const evo = !noite && this.evoluirQualAmiga(j);
      if (evo) { Object.assign(av, { fase: 'evoluir', evo, ate: t + 120 }); return; }
      this.reforcoAmiga(j);
      Object.assign(av, { fase: 'descansar', ate: t + sorte(A.descanso, R.pausa) });
      return;
    }
    if (av.fase === 'evoluir') {
      if (this.evoluirSozinhoAmiga(j, av, dt)) { this.reforcoAmiga(j); Object.assign(av, { fase: 'descansar', ate: t + sorte(A.descanso, R.pausa) }); }
      return;
    }
    if (av.fase === 'descansar') {
      this.leilaoTalvezAmiga?.(j); // descansando na vila: olha o leilão se já deu a hora (André 2026-11-21)
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
      if (j.semTeto && zonaFechadaEm(j.prog, no.x, no.z)) continue; // região que a história dele ainda não abriu
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
  coletaSozinhoAmiga(j, av, foraDeHora, livres, voltar0, dt) {
    const ia = j.ia, t = this.tempo, c = av.c, A = NPC_VIDA.aventura;
    // encomenda (André 2026-11-21): ao parar por qualquer motivo, avisa ele de verdade do que conseguiu
    const enc = av.encomenda ? ia.encomenda : null, voltar = (m) => { if (enc && !enc.pronta) this.fimEncomendaAmiga(j, m); voltar0(); };
    if (enc && !enc.pronta && contarRec(j.prog.mochila, enc.item) - enc.base >= enc.n) return voltar(); // juntou tudo
    if (foraDeHora || livres < A.mochilaLivre || t >= av.ate) return voltar(foraDeHora ? 'hora' : livres < A.mochilaLivre ? 'mochila' : 'tempo');
    const bate = this.inimigosDe(j).find((e) => !e.morto && !e.treino && e.vez === j.id && Math.hypot(e.x - j.x, e.z - j.z) < 6);
    if (bate) { if (j.coleta) this.pararColeta(j, null); if (j.pesca) this.pararPesca(j, null); if (!this.cerebroAmiga(j, j, bate)) this.pararAmiga(j); if (ia.cer?.faca === 'fugir') voltar('luta'); return; }
    if (j.pesca) return this.pescandoAmiga(j);
    if (j.coleta || j.fabrica) return this.pararAmiga(j);
    if (av.fase === 'ir') { if (this.irLongeAmiga(j, c.x, c.z, dt)) av.fase = 'cacar'; return; }
    ia.ruins ||= new Map();
    if (!ia.alvoColeta || t > ia.alvoColetaT) { ia.alvoColeta = this.acharColetaAmiga(j, { x: c.x, z: c.z, y: c.y ?? j.y }, av.coleta, av.noTipo); ia.alvoColetaT = t + NPC_VIDA.coleta.cada; }
    const al = ia.alvoColeta;
    if (!al && enc) { // acabou o veio dela: tenta o próximo lugar com o recurso; senão traz o que tem
      const outro = this.lugarRecursoAmiga(j, ENCOMENDA.recursos[enc.rec], c);
      if (outro) { Object.assign(av, { fase: 'ir', c: outro }); ia.viagem = null; return; }
      return voltar('acabou');
    }
    if (!al) { av.semColeta = true; av.fase = 'escolher'; av.coleta = null; return; } // acabou o lugar: vai caçar
    const d = Math.hypot(al.x - j.x, al.z - j.z);
    if (d > al.perto) return this.irDireto(j, al.x, al.z, d > 6);
    this.pararAmiga(j);
    if (av.coleta === 'pescar') { j.ry = Math.atan2(al.sx - j.x, al.sz - j.z); this.pescar(j.id, { acao: 'lancar', x: al.sx, z: al.sz }); }
    else this.coletar(j.id, { no: al.no });
    if (j.coleta || j.pesca) return;
    if (vigorAgora(j.prog.vigor) < 1) { av.semColeta = true; return voltar('vigor'); } // cansou: volta, e na próxima caça
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
    const motivo = motivoPeca(L, p, null, this.areaBase?.(L));
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
      guardarQueCabe(j.prog.mochila, { k: t.c, n }); // o que couber (antes da revisão de 2026-11-19 entrava meia pilha)
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
    if (j && a && m && !j.bot && this.outraRaca(j, a)) return this.recusaGuerra(j, a); // Chama x Geada: da outra raça é guerra (time, troca, duelo e amizade não)
    if (!j || !a || !this.podeAmiga(id) || !m || typeof m.acao !== 'string') return;
    if (m.acao === 'seguir' || m.acao === 'naoSegue') return this.seguirAmiga(id, m.acao === 'seguir');
    if (m.acao === 'menu' || m.acao === 'op') return this.opcaoAmiga(id, m); // conversa por opções (André 2026-11-19)
    if (!m.deLonge && Math.hypot(a.x - j.x, a.z - j.z) > 4.5) return this.evento({ t: 'aviso', para: id, texto: `Chegue mais perto de ${this.AMIGA.nome}` });
    const F = this.AMIGA.falas, diga = (texto, extra = {}) => a.ia.capturaFala ? void a.ia.capturaFala.push(texto) : this.evento({ t: 'fala', para: id, npc: this.AMIGA.id, texto, pedido: a.pedido ? { k: a.pedido.k, n: a.pedido.n, nome: ITENS[a.pedido.k].nome } : null, amizade: this.amizadeAmiga(j), noTime: !!(a.time && a.time === j.time), ...extra });
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
        guardarQueCabe(a.prog.mochila, { k: p.k, n: p.n });
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
  // ---------- Seguir (André 2026-11-17: "um botão seguir quando eu estiver perto dela... ela escolhe pra onde vai, eu aperto
  // Seguir e meu personagem segue ela automaticamente") ----------
  // O herói anda sozinho atrás dela no app (godot-prototipo/seguir.gd). Aqui ela só decide para onde vai: no time, escolhe
  // um campo de caça e vai na frente (passoTimeAmiga), esperando quando ele fica para trás; fora do time segue a rotina
  // dela (o campo, a coleta ou a casa) e só diz para onde está indo. liga = false: ele parou de seguir.
  seguirAmiga(id, liga, op = {}) { // op.c: o campo já escolhido; op.longe: pediu pelo chat ("te sigo"), vale de longe
    const j = this.jogadores.get(id), a = this.amiga; if (!j || !a) return;
    const ia = a.ia, LA = this.AMIGA.lidera;
    if (!liga) { if (ia.seguido?.id === id) { ia.seguido = null; ia.viagemSeguida = null; } return; }
    if (!this.AMIGA.seguivel || !LA) return;
    if (a.morto || j.morto) return;
    if (!op.longe && Math.hypot(a.x - j.x, a.z - j.z) > LA.perto) return this.evento({ t: 'aviso', para: id, texto: `Chegue mais perto de ${this.AMIGA.nome}` });
    if (!this.trocarDonoAmiga(id)) return this.evento({ t: 'aviso', para: id, texto: this.comOutroAmiga() });
    const F = this.AMIGA.falasLeva, noTime = !!(a.time && a.time === j.time), av = ia.av;
    let c = null, fala;
    if (noTime) {
      c = op.c || (ia.seguido?.id === id && ia.seguido.c ? ia.seguido.c : ia.atividade ? null : this.campoAmiga(a));
      if (c && this.fechadoParaAmiga(j, c)) c = this.campoJuntoAmiga(a, j); // ela não leva ele para onde a névoa barra
      // ronda 2026-11-18: tocando Seguir três vezes, ela disse "Vem comigo, sei onde tem bicho bom" duas vezes: outra frase
      const ult = this.ultimaFalaAmiga(j), opc = F.campo.filter((f) => f.replace('{lugar}', nomeLugarAmiga(c?.nome || '')) !== ult);
      fala = c ? sorteia(opc.length ? opc : F.campo).replace('{lugar}', nomeLugarAmiga(c.nome)) : sorteia(F.junto);
    } else if (av && ['ir', 'cacar', 'missao'].includes(av.fase) && av.c?.nome) fala = sorteia(F.solo).replace('{lugar}', nomeLugarAmiga(av.c.nome));
    else if (av && ['voltar', 'descansar'].includes(av.fase) && this.AMIGA.terreno) fala = sorteia(F.casa);
    else fala = sorteia(F.junto);
    ia.seguido = { id, c, chegou: false, ate: this.tempo + LA.ate };
    ia.viagemSeguida = null;
    this.dizerAmiga(fala, true, id);
    this.evento({ t: 'seguir', para: id, npc: a.id, nome: this.AMIGA.nome, lugar: c ? nomeLugarAmiga(c.nome) : '' }); // o app começa a seguir
  },
  // no time e com ele seguindo: vai na frente até o campo. true = cuidou do passo
  levarAmiga(j, dono, S, d, dt) {
    if (d > this.AMIGA.lidera.espera) { // ficou para trás: espera olhando para ele
      this.pararAmiga(j); j.montado = null; j.ry = Math.atan2(dono.x - j.x, dono.z - j.z); return true;
    }
    const c = S.c, dc = Math.hypot(c.x - j.x, c.z - j.z);
    if (dc <= Math.max(3, (c.r || 12) * 0.5)) { S.chegou = true; this.pararAmiga(j); j.montado = null; return true; }
    // a viagem até o campo fica separada da de vir até ele (ia.viagem): as duas usam longeAmiga
    const ia = j.ia, vg = ia.viagem; ia.viagem = ia.viagemSeguida || null;
    if (this.irLongeAmiga(j, c.x, c.z, dt)) S.chegou = true;
    ia.viagemSeguida = ia.viagem; ia.viagem = vg;
    return true;
  },
  // ---------- fase 2: time e combate (André 2026-11-09) ----------
  // fala dela que aparece para o dono mesmo sem a janela aberta (aviso no topo)
  comOutroAmiga() { return sorteia(this.AMIGA.chat.falas.comOutro).replace('{nome}', this.jogadores.get(this.amigaDono)?.nome || 'outro amigo'); },
  falarAmiga(texto) { if (this.amigaDono) this.evento({ t: 'fala', para: this.amigaDono, npc: this.AMIGA.id, texto: `${this.AMIGA.nome}: ${texto}` }); },
  // completa as poções dela até this.AMIGA.time.pocoes (ela passa na Rosa quando volta para casa)
  pocoesAmiga(j) { // compra na Rosa com o ouro dela, pelo preço da loja (André 2026-11-09: nada de poção de graça)
    this.consertoAmiga(j); // antes da poção: equipamento gasto passa no Tomás
    const preco = precoLoja(LOJA.find((o) => o.k === 'pocao'), j.prog.nivel) || ITENS.pocao.preco || 15; // mesmo preço da Rosa (sobe com o nível)
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
  // ---------- diário de evolução (André 2026-11-17: "ir me passando, se eles tiverem facilidade, se morrer... Cada nível,
  // se eles bugarem alguma missão") ----------
  // Só números do jogo, nada de conversa: { t, nv, o: 'nivel'|'missao'|'morreu'|'travou'|'reforco'|'evoluir', txt }.
  // Sai em /npcs.json (server/index.js) para a ronda diária contar ao André.
  evolucaoAmiga(j, o, txt = '') {
    (j.evolucao ||= []).push({ t: Date.now(), nv: j.prog.nivel | 0, o, txt: String(txt).slice(0, 120) });
    if (j.evolucao.length > NPC_VIDA.evolucao.max) j.evolucao.splice(0, j.evolucao.length - NPC_VIDA.evolucao.max);
  },
  // a cada 5 s: subiu de nível? entregou missão? ficou tempo demais na mesma etapa (travou)?
  vigiarEvolucaoAmiga(j) {
    if (!j.semTeto) return;
    const ia = j.ia, p = j.prog, h = p.hist || {};
    if (ia.nvVisto == null) { ia.nvVisto = p.nivel | 0; ia.missaoVista = h.p | 0; }
    if ((p.nivel | 0) > ia.nvVisto) { this.evolucaoAmiga(j, 'nivel', `${ia.nvVisto} -> ${p.nivel | 0}`); ia.nvVisto = p.nivel | 0; }
    if ((h.p | 0) > ia.missaoVista) {
      for (let i = ia.missaoVista; i < (h.p | 0); i++) this.evolucaoAmiga(j, 'missao', `${i + 1}. ${HISTORIA[i]?.nome || ''}`);
      ia.missaoVista = h.p | 0;
    }
    // travou: a mesma etapa aceita há mais de NPC_VIDA.evolucao.travou s de missão (conta só o tempo em que estava nela)
    const chave = h.ac ? `${h.p}.${h.e}` : '', seg = j.missaoDia?.seg || 0;
    if (ia.etapaVista?.chave !== chave || seg < ia.etapaVista.seg0) ia.etapaVista = { chave, seg0: seg, avisou: false };
    else if (chave && !ia.etapaVista.avisou && seg - ia.etapaVista.seg0 > NPC_VIDA.evolucao.travou) {
      ia.etapaVista.avisou = true;
      const E = etapaAtual(p);
      this.evolucaoAmiga(j, 'travou', `missão ${(h.p | 0) + 1}, etapa ${(h.e | 0) + 1}: ${E?.txt || E?.ev || ''}`);
    }
  },
  // ---------- reforço e evolução sozinha (André 2026-11-17) ----------
  // "quero que ela tenha autonomia para fazer reforço de equipamento e fazer upgrade de equipamento... Se ela tiver o
  // material e o dinheiro e o equipamento, ela vai lá e faz upgrade". Mesmas regras e preços do herói (reforcar em
  // shared/progresso.js, evoluir em comecarCatalisador): paga com o próprio ouro e guarda uma reserva para poção e conserto.
  reservaAmiga(j) {
    const preco = precoLoja(LOJA.find((o) => o.k === 'pocao'), j.prog.nivel) || 15;
    return NPC_VIDA.reforco.reserva + preco * this.AMIGA.time.pocoes + (j.leilaoBot?.poupado | 0); // a poupança da meta (leilão, André 2026-11-21) não vai para reforço
  },
  // tenta reforçar as peças do corpo (a de reforço mais baixo antes), até NPC_VIDA.reforco.tentativas por volta na vila.
  // Devolve quantas tentativas fez.
  reforcoAmiga(j) {
    const p = j.prog, C = NPC_VIDA.reforco;
    if (!j.semTeto || motivoLibera(p, 'reforcar')) return 0;
    let n = 0, mudou = false;
    while (n < C.tentativas) {
      const Eh = p.hist?.ac ? etapaAtual(p) : null, gratis = !!(Eh?.ev === 'reforcar' && Eh.gratis);
      const pode = LUGARES.map((l) => p.equip[l]).filter((it) => {
        if (!it || !ehEquip(it.k) || (it.e | 0) >= Math.min(reforcoMax(it), C.max)) return false;
        const pr = reforcoPrecisa(it, (it.e | 0) + 1); if (atributoDoReforco(p.atr, pr.k) < pr.n) return false;
        if (gratis) return true;
        const m = materialReforco(it);
        return (p.ouro || 0) - custoReforco(it) >= this.reservaAmiga(j) && (!m || contar(p.mochila, m.k) >= m.n);
      }).sort((a, b) => (a.e | 0) - (b.e | 0));
      if (!pode.length) break;
      const r = reforcar(p, pode[0], Math.random(), gratis); n++;
      if (r.erro) break;
      mudou = true;
      if (r.custo) this.caixa(j, 'reforco', -r.custo);
      if (r.ok) this.historia(j, 'reforcar', { v: r.e });
      this.evolucaoAmiga(j, 'reforco', `${nomeDoItem(pode[0])} ${r.ok ? 'subiu' : 'falhou'} (${r.de} -> ${r.e}, ${r.custo} de ouro)`);
    }
    if (mudou) { this.aplicarStatus(j); j.progSujo = true; this.guardarAmiga(); }
    return n;
  },
  // receita de evoluir (receitaEvoluir) que ela já pode pagar, sem contar a estação: material, vigor e o que a
  // história libera. Mesmo que motivoReceita, menos o "perto da bigorna".
  motivoEvoluirAmiga(j, R) {
    const p = j.prog;
    if (profNivel(p.prof?.[R.prof]) < R.nivel) return 'nivel';
    if (motivoLibera(p, 'forja') || motivoLibera(p, 'evoluir', R.r)) return 'libera';
    for (const [k, n] of Object.entries(R.usa)) if (contar(p.mochila, k) < n) return 'material';
    if (vigorAgora(p.vigor) < R.vigor) return 'vigor';
    return '';
  },
  // qual peça do corpo dá para evoluir agora e em qual estação pública: { l, x, z, k } ou null
  evoluirQualAmiga(j) {
    const p = j.prog;
    if (!j.semTeto || (j.ia.evoFalhou || 0) > this.tempo || p.mochila.indexOf(null) < 0) return null;
    for (const l of LUGARES) {
      const it = p.equip[l]; if (!it || !ehEquip(it.k)) continue;
      const R = this.receitaEvoluir(it); if (!R || this.motivoEvoluirAmiga(j, R)) continue;
      const k = RECEITA_ESTACAO(R);
      let E = null, md = Infinity;
      for (const o of this.mapa.estacoes || []) if (o.k === k && !zonaFechadaEm(p, o.x, o.z)) { const d = Math.hypot(o.x - j.x, o.z - j.z); if (d < md) { md = d; E = o; } }
      if (E) return { l, k: it.k, r: it.r, x: E.x, z: E.z }; // vai até ela como o "Ir" do herói
    }
    return null;
  },
  // anda até a estação, tira a peça do corpo, evolui e veste de novo. true = terminou (deu certo ou não)
  evoluirSozinhoAmiga(j, av, dt) {
    const p = j.prog, ev = av.evo, fim = (ok) => {
      if (!ok) j.ia.evoFalhou = this.tempo + 1800; // não deu: tenta de novo daqui a meia hora
      this.evolucaoAmiga(j, 'evoluir', ok ? `${nomeDoItem(p.mochila[ev.i] || p.equip[ev.l] || ev)}` : 'não deu');
      if (ev.i != null) { // veste de volta o que estiver no lugar (evoluída ou igual, se falhou)
        const it = p.mochila[ev.i];
        if (it && it.k === ev.k && !p.equip[ev.l]) { p.equip[ev.l] = it; p.mochila[ev.i] = null; }
        ev.i = null;
      }
      this.aplicarStatus(j); j.progSujo = true; this.guardarAmiga();
      return true;
    };
    if (ev.i != null) { // esperando a barrinha de evoluir (passoEvoluir)
      if (j.fabrica && this.tempo < av.ate) return false;
      return fim(!j.fabrica);
    }
    if (this.tempo > av.ate) return fim(false);
    const it = p.equip[ev.l], R = it && this.receitaEvoluir(it);
    if (!R) return fim(false);
    if (!this.estacaoPerto(j, R) && !this.chegouMissaoAmiga(j, ev.x, ev.z, dt)) return false;
    this.pararAmiga(j);
    const i = p.mochila.indexOf(null);
    if (!it || it.k !== ev.k || it.r !== ev.r || i < 0 || j.fabrica) return fim(false);
    p.equip[ev.l] = null; p.mochila[i] = it; ev.i = i;
    let erro = '';
    this.comecarCatalisador(j, { acao: 'evoluir' }, i, it, (texto) => { erro = texto; });
    if (erro || !j.fabrica) return fim(false);
    av.ate = this.tempo + CATALISADOR.tempoEvoluir + 5;
    return false;
  },
  // vontade de entrar no time (0 a 1) e o motivo mais forte contra. Regras com sorteio, sem IA paga.
  vontadeAmiga(a, dono) {
    // soldado obedece só ao líder do clã dele (André 2026-11-22). Clã bot (Guarda da Chama, Lobos da Geada) é neutro ou
    // inimigo: não entra no time de jogador nenhum
    if (NPC_SOLDADO.ligado) return this.AMIGA.recruta && !this.AMIGA.clanpc && dono?.conta === this.AMIGA.lider ? { p: 1, motivo: 'vontade' } : { p: 0, motivo: 'ocupada' };
    const R = this.AMIGA.time, A = this.AMIGA, contra = [];
    // André 2026-11-16: amizade até 4 = base (60%), de 4 a 10 sobe até 100%; cada 5 níveis ACIMA de quem chama tira 5%
    const amz = this.amizadeAmiga(dono), b = A.amizadeBase ?? 4, topo = A.amizade?.max || 10;
    let p = A.amizadeBase != null ? R.base + Math.max(0, Math.min(topo, amz) - b) * (1 - R.base) / Math.max(1, topo - b) : R.base + Math.min(R.amizadeMax, (a.amizade | 0) * R.porAmizade);
    const acima = (a.prog.nivel | 0) - (dono.prog.nivel | 0);
    if (A.acimaCada && acima >= A.acimaCada) contra.push(['fraco', Math.floor(acima / A.acimaCada) * A.acimaTira]);
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
    if (this.semIaAmiga(a, j) && !this.soldadoAmiga()) return { ate: this.tempo + 300, conta: j.conta, aceita: false, motivo: 'ocupada' }; // a IA dela acabou hoje: "tô meio ocupada"
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
  // entrou no time com alguém bem mais fraco: comenta de leve, como amigo (André 2026-11-16)
  falaNivelBaixoAmiga(a, j) {
    const n = (a.prog.nivel | 0) - (j.prog.nivel | 0), F = this.AMIGA.falas.nivelBaixo;
    if (!F || n < (this.AMIGA.acimaFala ?? 5)) return false;
    this.dizerAmiga(sorteia(F).replace('{n}', n), false, j.id); return true;
  },
  timeCheioAmiga(j) { return !!(j.time && j.time.membros.length >= TIME.max); },
  // o campo c ainda está fechado na história de j? texto curto com a missão que abre, ou '' (aberto)
  fechadoParaAmiga(j, c) {
    const Z = c && !j.bot && zonaFechadaEm(j.prog, c.x, c.z); if (!Z) return '';
    const M = HISTORIA[QUEM_LIBERA[Z.id]];
    return `a ${nomeLugarAmiga(c.nome)} nível ${c.nivel || 1} você ainda não liberou${M ? ` (falta a missão "${M.nome}")` : ''}`;
  },
  // campo para caçar junto: aberto para os dois e no nível do mais fraco (o mais forte que cabe), ou null
  campoJuntoAmiga(a, j) {
    const n = Math.min(a.prog.nivel | 0, j.prog.nivel | 0) + NPC_VIDA.aventura.campoAcima;
    const l = this.cacas.map((x) => x.def).filter((c) => !c.boss && !c.tunel && !zonaFechadaEm(a.prog, c.x, c.z) && !zonaFechadaEm(j.prog, c.x, c.z))
      .sort((x, y) => (x.nivel || 1) - (y.nivel || 1) || Math.hypot(x.x - j.x, x.z - j.z) - Math.hypot(y.x - j.x, y.z - j.z));
    return l.filter((c) => (c.nivel || 1) <= n).at(-1) || l[0] || null;
  },
  // ela está esperando resposta de um chamado dela para isso (time, pescar...)? (o "bora" dele é aceitar)
  chamouAmiga(quer) { const c = this.amiga?.ia.chamado; return !!(c && c.ate > this.tempo && c.quer === quer); },
  // campo de caça pelo nome que ela ou ele disse (o mais forte do nome que cabe no nível dela) ou null
  campoPorNomeAmiga(a, lugar) {
    const n = normAmiga(lugar || '').replace(/^(a|o|na|no|da|do|para|pra|em) /, ''); if (n.length < 4) return null;
    const l = this.cacas.map((x) => x.def).filter((x) => !x.boss && !x.tunel && normAmiga(x.nome).includes(n) && !zonaFechadaEm(a.prog, x.x, x.z)).sort((x, y) => (x.nivel || 1) - (y.nivel || 1));
    const cabe = l.filter((x) => (x.nivel || 1) <= (a.prog.nivel | 0) + NPC_VIDA.aventura.campoAcima);
    return cabe.at(-1) || l[0] || null;
  },
  // André 2026-11-17 ("posso ir com você? Ela: claro, vem. Me dá time. Aí eu aceito"): topou pelo chat, ela manda o convite
  // do time como um jogador (cartão Entrar/Recusar, simulacao.time). c: o campo para onde ela vai levar (o dela, se está
  // caçando). true = mandou.
  convidarTimeAmiga(a, j, c) {
    if (!this.AMIGA.convida || j.bot || a.morto || (a.time && a.time === j.time) || this.timeCheioAmiga(j)) return false;
    const av = a.ia.av;
    c ||= av && ['ir', 'cacar'].includes(av.fase) && !av.coleta ? av.c : null;
    // André 2026-11-17: campo que ele ainda não liberou: avisa e leva num que os dois podem ir
    const fechado = this.fechadoParaAmiga(j, c);
    // André 2026-11-17 ("não precisa explicar tanto, dá aspecto de bot"): curto e natural, sem citar missão
    if (fechado) {
      const outro = this.campoJuntoAmiga(a, j); const mesmo = outro && c && nomeLugarAmiga(outro.nome) === nomeLugarAmiga(c.nome); // dois campos com o mesmo nome: diz o nível
      a.ia.avisoFechado = outro ? `Lá ainda não dá pra você, bora na ${nomeLugarAmiga(outro.nome)}${mesmo ? ` de nível ${outro.nivel || 1}` : ''}? Te mandei o time.` : 'Lá ainda não dá pra você. Te mandei o time.'; c = outro; }
    j.conviteTime = { de: a.id, ate: this.tempo + TIME.convite };
    a.ia.convidou = { id: j.id, c: c || null, ate: this.tempo + TIME.convite };
    this.evento({ t: 'time', para: j.id, fase: 'convite', de: a.id, nome: this.AMIGA.nome, dur: TIME.convite });
    return true;
  },
  // ele tocou Entrar no convite dela: entra no time e, se ela ia para um campo, ela vai na frente e ele vai atrás (Seguir)
  aceitouConviteAmiga(id) {
    const a = this.amiga, j = this.jogadores.get(id); if (!a || !j) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto }), C = a.ia.convidou;
    const p = j.conviteTime; if (!p || p.de !== a.id || p.ate < this.tempo || !C || C.id !== id) return aviso('O convite para o time já expirou');
    j.conviteTime = null; a.ia.convidou = null;
    if (a.time && a.time !== j.time) return aviso(`${this.AMIGA.nome} já está em outro time`);
    if (!(a.time && a.time === j.time)) {
      if (!this.trocarDonoAmiga(id)) return aviso(this.comOutroAmiga());
      if (!this.entrarTimeAmiga(a, j)) return aviso(`O time já tem ${TIME.max} pessoas`);
    }
    const ia = a.ia, plano = this.AMIGA.atividades[ia.plano] ? ia.plano : null;
    ia.chamado = null; ia.vir = null; ia.plano = null;
    this.gostoAmiga(j, plano || 'time');
    if (plano) { if (ia.atividade && ia.atividade !== plano) this.fimAtividadeAmiga(a, true); this.comecarAtividadeAmiga(a, plano); return; }
    if (ia.missaoJunto?.id === id) { ia.missaoJunto.ate = this.tempo + NPC_VIDA.missao.juntoSeg; this.alvoMissaoJuntoAmiga(a, j, true); return; } // ele se ofereceu para a missão dela: vai na frente até a etapa
    let c = C.c || this.campoAmiga(a);
    if (this.fechadoParaAmiga(j, c)) c = this.campoJuntoAmiga(a, j); // ela não leva ele para onde a névoa barra
    if (c && this.AMIGA.seguivel && this.AMIGA.lidera) { // ela vai na frente até o campo e o app dele segue ela
      ia.seguido = { id, c, chegou: false, ate: this.tempo + this.AMIGA.lidera.ate }; ia.viagemSeguida = null;
      this.evento({ t: 'seguir', para: id, npc: a.id, nome: this.AMIGA.nome, lugar: nomeLugarAmiga(c.nome) });
    }
  },
  recusouConviteAmiga(id) { const a = this.amiga, j = this.jogadores.get(id); if (!a || !j) return; if (j.conviteTime?.de === a.id) j.conviteTime = null; if (a.ia.convidou?.id === id) a.ia.convidou = null; },
  // André 2026-11-13 ("como se fosse um jogador real"): o botão de time só convida, sem fala nenhuma no chat.
  // Combinou pelo chat (ou ela chamou para o time): entra. Sem combinar: decide como sempre (pode recusar).
  // André 2026-11-14 ("só na missão ela não nega"): na etapa da história que pede time, ela sempre aceita, e quem não
  // jogador também. Fora dessa etapa, tudo igual: pode recusar.
  conviteTimeAmiga(id) {
    const a = this.amiga, j = this.jogadores.get(id), nome = this.AMIGA.nome; if (!a || !j) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    const missao = !j.bot && etapaAtual(j.prog)?.ev === 'time';
    if (!this.podeAmiga(id)) return aviso(`${nome} não pode entrar no seu time agora`);
    if (a.time && a.time === j.time) return aviso(`${nome} já está no seu time`);
    if (a.time) return aviso(`${nome} já está em outro time`);
    if (this.timeCheioAmiga(j)) return aviso(`O time já tem ${TIME.max} pessoas`);
    if (!this.trocarDonoAmiga(id)) return aviso(`${nome} está com outra pessoa agora`);
    const ia = a.ia, recusa = () => aviso(`${nome} recusou o convite para o time`);
    if (a.morto) return recusa();
    if (this.semIaAmiga(a, j)) { this.dizerAmiga(this.AMIGA.falas.recusa.ocupada, false, id); return recusa(); } // a IA dela acabou hoje (André 2026-11-17)
    const topou = missao || this.combinouAmiga(a) || (ia.chamado?.quer === 'time' && ia.chamado.ate > this.tempo);
    if (!topou && (ia.recusaAte || 0) > this.tempo) return recusa();
    const dv = this.decisaoTimeAmiga(a, j);
    if (!topou && !dv.aceita) { this.recusarTimeAmiga(a, j, dv.motivo); return recusa(); }
    if (!this.entrarTimeAmiga(a, j)) return aviso(`O time já tem ${TIME.max} pessoas`);
    this.falaNivelBaixoAmiga(a, j);
    const plano = this.AMIGA.atividades[ia.plano] ? ia.plano : null;
    ia.chamado = null; ia.vir = null; ia.plano = null;
    this.gostoAmiga(j, plano || 'time');
    if (plano) { if (ia.atividade && ia.atividade !== plano) this.fimAtividadeAmiga(a, true); this.comecarAtividadeAmiga(a, plano); }
  },
  // ---------- duelo (André 2026-11-17: "chamar duelo tanto contra Dario e Cecília qt contra jogadores") ----------
  // Chamou pelo botão "Duelo": aceita ou recusa na hora, como um jogador (André: "o botão de aceitar e recusar, sem chat
  // pronto"). Decide pelo humor (sorteio que vale DUELO.npc.humor s para essa pessoa), pela vida, pela noite e pela IA
  // do dia (acabou = recusa). true = aceitou (a Simulacao começa o duelo).
  pedidoDueloAmiga(j) {
    const a = this.amiga, N = DUELO.npc; if (!a || !j) return false;
    const nao = () => { this.evento({ t: 'aviso', para: j.id, texto: `${this.AMIGA.nome} recusou o duelo` }); return false; };
    if (this.semIaAmiga(a, j) || a.troca || (a.time && !a.time.membros.includes(j.id) && this.emCombate(a))) return nao();
    const ia = a.ia, h = ia.dueloHumor;
    if (h && h.conta === j.conta && h.ate > this.tempo && !h.aceita) return nao();
    let p = N.base + Math.min(10, this.amizadeAmiga(j) || 0) * N.porAmizade;
    if (a.vida < a.vidaMax * 0.5) p -= N.cansada;
    if (ehNoite(horaDoJogo(j.prog.dia))) p -= N.noite;
    const aceita = Math.random() < Math.max(N.min, Math.min(N.max, p));
    ia.dueloHumor = aceita ? null : { ate: this.tempo + N.humor, conta: j.conta, aceita: false };
    if (!aceita) return nao();
    ia.cer = null; ia.viagem = null;
    return true;
  },
  // no duelo: para na contagem olhando para ele; depois luta com a arma e as skills dela (atacarAmiga), cura com pouca
  // vida e não sai do círculo
  passoDueloAmiga(j) {
    const o = this.oponenteDuelo(j), D = j.duelo; if (!o || !D) return this.pararAmiga(j);
    j.montado = null;
    j.ry = Math.atan2(o.x - j.x, o.z - j.z);
    if (!D.luta || j.trava > 0) return this.pararAmiga(j);
    if (j.vida < j.vidaMax * 0.45 && this.habOkAmiga(j, 'cura_floresta')) { this.pararAmiga(j); return this.usarHabQ(j.id, 'cura_floresta'); }
    if (Math.hypot(j.x - D.x, j.z - D.z) > DUELO.raio - 3) return this.irDireto(j, D.x, D.z, true); // perto da borda: volta pro meio
    const c = { s: { pertoDeMim: 1, agrupados: 0 }, jeito: CEREBRO.jeitos[this.AMIGA.id] || this.AMIGA.luta || CEREBRO.jeitos.padrao };
    this.atacarAmiga(j, o, c);
  },
  // Arena PvP 3x3 (André 2026-11-21, shared/arena.js): caída, espera levantar; na contagem, parada olhando para o meio;
  // na luta vai no inimigo mais perto (o que bateu nela por último, se ainda estiver de pé), cura com pouca vida e não sai
  // da arena
  passoArenaAmiga(j) {
    const P = j.pvp, A = PVP.arena; j.montado = null;
    if (j.morto || P.M.fase !== 'luta' || j.trava > 0) { if (!j.morto) j.ry = Math.atan2(A.x - j.x, A.z - j.z); return this.pararAmiga(j); }
    const l = this.inimigosArena(j); if (!l.length) return this.irDireto(j, A.x, A.z, true);
    let o = l.find((x) => x.id === j.ia.pvpAlvo && Math.hypot(x.x - j.x, x.z - j.z) < 12);
    if (!o) { o = l[0]; for (const x of l) if (Math.hypot(x.x - j.x, x.z - j.z) < Math.hypot(o.x - j.x, o.z - j.z)) o = x; }
    j.ia.pvpAlvo = o.id;
    if (j.vida < j.vidaMax * 0.4 && this.habOkAmiga(j, 'cura_floresta')) { this.pararAmiga(j); return this.usarHabQ(j.id, 'cura_floresta'); }
    if (Math.hypot(j.x - A.x, j.z - A.z) > A.r - 1.5) return this.irDireto(j, A.x, A.z, true); // na borda: volta pro meio
    // muro, pilar ou rocha entre ela e o alvo (os obstáculos da arena são sólidos): contorna pelo lado, sempre o mesmo
    // até a linha abrir (troca de lado se ficar presa uns segundos); flecha e magia também param no obstáculo
    const k = this.bloqueioArena(j, o);
    if (k) return this.contornarAmiga(j, o, k);
    j.ia.pvpLado = 0;
    const c = { s: { pertoDeMim: l.filter((x) => Math.hypot(x.x - j.x, x.z - j.z) < 6).length, agrupados: 0 }, jeito: CEREBRO.jeitos[this.AMIGA.id] || this.AMIGA.luta || CEREBRO.jeitos.padrao };
    this.atacarAmiga(j, o, c);
  },
  // anda de lado do obstáculo k que tapa o alvo o, sempre pelo mesmo lado até a linha abrir (troca se ficar presa 4 s)
  contornarAmiga(j, o, k) {
    const dx = o.x - j.x, dz = o.z - j.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    if (!j.ia.pvpLado) { j.ia.pvpLado = (k.x - j.x) * uz - (k.z - j.z) * ux > 0 ? 1 : -1; j.ia.pvpLadoT = this.tempo; }
    if (this.tempo - j.ia.pvpLadoT > 4) { j.ia.pvpLado *= -1; j.ia.pvpLadoT = this.tempo; }
    const lado = j.ia.pvpLado;
    return this.irDireto(j, j.x - uz * lado * 3 + ux * 0.6, j.z + ux * lado * 3 + uz * 0.6, true);
  },
  // o primeiro sólido (círculo) do mundo na linha dela até o alvo, ou null (a magia não passa: visaoLivre)
  bloqueioVisao(j, o) {
    const dx = o.x - j.x, dz = o.z - j.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    let achou = null, ate = d;
    const l = new Set(this.obstaculos); for (let s = 0; s <= d + 6; s += 6) for (const k of this.pertoNaMata(j.x + ux * Math.min(s, d), j.z + uz * Math.min(s, d))) l.add(k);
    for (const k of l) {
      if (k.gente || k.semTopo || (k.alto != null && (j.y || 0) + 1.2 > k.alto)) continue;
      const t = (k.x - j.x) * ux + (k.z - j.z) * uz;
      if (t < 0 || t > ate) continue;
      if (Math.hypot(j.x + ux * t - k.x, j.z + uz * t - k.z) < k.r + 0.45) { ate = t; achou = k; }
    }
    return achou;
  },
  // o primeiro obstáculo sólido da arena PvP na linha dela até o alvo (até 10 m), ou null
  bloqueioArena(j, o) {
    const dx = o.x - j.x, dz = o.z - j.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
    let achou = null, ate = Math.min(d, 10);
    for (const k of this.pertoNaMata(j.x, j.z)) {
      if (!k.arena || (j.y || 0) > k.alto - 0.05) continue;
      const t = (k.x - j.x) * ux + (k.z - j.z) * uz;
      if (t < 0 || t > ate) continue;
      if (Math.hypot(j.x + ux * t - k.x, j.z + uz * t - k.z) < k.r + 0.45) { ate = t; achou = k; }
    }
    return achou;
  },
  // "Farmar recurso: Fragmento de Alma" (André 2026-11-23: "eles vão caçar geadas para matar"): o recruta caça quem é da
  // outra raça (as regras da guerra: acima da Trégua, fora da zona segura); o fragmento vai direto ao Baú do Clã
  // (fragmentoGuerra). Ninguém perto: anda pela rota da ronda da outra raça (onde ela costuma passar). No time, manda o time.
  almaAmiga(j, dt) {
    const fn = j.ia.funcao; if (!fn || fn.k !== 'alma' || !(this.AMIGA.recruta || this.fixoClaNpc?.(this)) || (j.time && j.time.membros.length > 1)) return false;
    if (!j.guerra) return false; // na Trégua (Nv 30) ou na zona segura: segue a vida
    const g = (j.ia.alma ||= { alvo: null, t: 0, i: 0 });
    let alvo = g.alvo && this.jogadores.get(g.alvo);
    if (alvo && (alvo.morto || !this.emGuerra(j, alvo, true))) { alvo = null; g.alvo = null; }
    if (!alvo && this.tempo >= g.t) {
      g.t = this.tempo + 2;
      let md = 140;
      for (const o of this.jogadores.values()) { if (!this.emGuerra(j, o, true)) continue; const d = Math.hypot(o.x - j.x, o.z - j.z); if (d < md) { md = d; alvo = o; } }
      g.alvo = alvo?.id || null;
    }
    if (alvo) { j.montado = null; if (this.cerebroAmiga(j, j, alvo)) return true; this.irDireto(j, alvo.x, alvo.z, true); return true; }
    const rota = GUERRA.ronda?.rotas?.[this.racaDe(j) === 'geada' ? 'chama' : 'geada']; if (!rota?.length) return false;
    const p = rota[g.i % rota.length];
    if (Math.hypot(p[0] - j.x, p[1] - j.z) < 10) g.i++;
    else this.irLongeAmiga(j, p[0], p[1], dt);
    return true;
  },
  // função "Proteger" (painel do clã, André 2026-11-22): fica perto de quem protege (o líder ou outro recruta) e ataca o
  // que chegar perto dele. No time, quem manda é o time.
  protegerAmiga(j, dt, fn = j.ia.funcao) {
    if (!fn || fn.k !== 'proteger' || !(this.AMIGA.recruta || this.fixoClaNpc?.(this)) || (j.time && j.time.membros.length > 1)) return false;
    const lider = this.corpoLiderDe(this); // jogador ou líder bot (todos os clãs iguais)
    // líder fora do jogo (André 2026-11-23: "a função que prevalece é a função que tiver marcada lá no clã"): quem protege
    // ou segue o líder espera ele onde está (se defende se atacarem); quem protege outro recruta continua protegendo
    if (!lider && fn.p === 'lider') {
      let e0 = null, m0 = Infinity;
      for (const e of this.inimigosDe(j)) { if (e.morto || e.treino) continue; const de = Math.hypot(e.x - j.x, e.z - j.z); if (de < CLA.protegeRaio && de < m0) { m0 = de; e0 = e; } }
      if (e0 && j.trava <= 0 && this.cerebroAmiga(j, j, e0)) return true;
      this.pararAmiga(j); return true;
    }
    const P = fn.p === 'lider' ? lider : this.amigosIa.find((x) => x.AMIGA.id === fn.p)?.amiga;
    if (!P || P === j || P.morto) return false;
    if (j.trava > 0) { this.pararAmiga(j); return true; }
    const raio = CLA.protegeRaio, d = Math.hypot(P.x - j.x, P.z - j.z);
    let alvo = null, md = Infinity;
    for (const e of this.inimigosDe(j)) { if (e.morto || e.treino) continue; const de = Math.hypot(e.x - P.x, e.z - P.z); if (de < raio && de < md) { md = de; alvo = e; } }
    if (alvo) { j.montado = null; if (this.cerebroAmiga(j, lider || P, alvo)) return true; }
    if (d > 40) { this.irLongeAmiga(j, P.x, P.z, dt); return true; }
    const ang = (P.ry || 0) + Math.PI - 0.7, px = P.x + Math.sin(ang) * 2.2, pz = P.z + Math.cos(ang) * 2.2, dp = Math.hypot(px - j.x, pz - j.z);
    if (dp < 0.7) { this.pararAmiga(j); return true; }
    this.irDireto(j, px, pz, dp > this.AMIGA.time.correr);
    return true;
  },
  // "Proteger carrinho" / "Proteger mercante" (painel do clã, André 2026-11-23: "proteger meu carrinho... quando eu
  // estiver fazendo viagem de mercante, ou quando eu estiver abastecendo mercante, proteger meu mercante"; "se esse bicho
  // se afastando, ele não correr atrás. A função dele é só defender o mercante"). Acha sozinho o carrinho ou o navio do
  // líder (no chão/água ou com ele dirigindo). Inimigo a até CLA.protegeVeiculo.raio m dele: ataca sem esperar apanhar;
  // o inimigo passou da coleira: larga e volta (nunca persegue). Sem nada para bater, fica numa roda em volta do
  // carrinho. No mercante ("ele não sai do mercante enquanto estiver protegendo"): sobe no convés e fica lá (o navio leva
  // ele), batendo só no que alcança de lá. Carrinho ou navio fora do mundo: protege o líder até ele voltar.
  protegerVeiculoAmiga(j, dt) {
    const ia = j.ia, fn = ia.funcao, PV = CLA.protegeVeiculo;
    const veic = fn?.k === 'proteger' && (fn.p === 'carrinho' || fn.p === 'mercante') && (this.AMIGA.recruta || this.fixoClaNpc?.(this)) && !(j.time && j.time.membros.length > 1) && !j.duelo;
    if (!veic) { if (ia.pv) { ia.pv = null; this.descerConvesAmiga(j); } return false; }
    ia.pv ||= { alvo: null, sem: false };
    const lider = this.corpoLiderDe(this), p = lider?.prog;
    let V = null;
    if (p && fn.p === 'carrinho' && p.carrinho) V = lider.veiculo === 'carrinho' ? { x: lider.x, z: lider.z, ry: lider.ry || 0 } : p.carrinho.chao;
    if (p && fn.p === 'mercante' && p.navio) V = lider.veiculo === 'navio' ? centroNavio(lider) : p.navio.chao;
    if (!V) { ia.pv.sem = true; ia.pv.alvo = null; this.descerConvesAmiga(j, lider); return this.protegerAmiga(j, dt, { k: 'proteger', p: 'lider' }); }
    ia.pv.sem = false;
    // o alvo: o que já estava, enquanto não passar da coleira; senão o mais perto do carrinho dentro do raio
    const doV = (e) => Math.hypot(e.x - V.x, e.z - V.z);
    let alvo = ia.pv.alvo != null ? this.inimigosDe(j).find((e) => e.id === ia.pv.alvo && !e.morto) : null;
    if (alvo && doV(alvo) > PV.coleira) alvo = null; // fugiu: larga, não corre atrás
    if (!alvo) { let md = Infinity; for (const e of this.inimigosDe(j)) { if (e.morto || e.treino) continue; const de = doV(e); if (de < PV.raio && de < md) { md = de; alvo = e; } } }
    if (ia.pv.alvo !== (alvo?.id ?? null)) ia.cer = null; // trocou (ou largou): pensa de novo
    ia.pv.alvo = alvo?.id ?? null;
    const h = [...String(j.id)].reduce((q, ch) => q + ch.charCodeAt(0), 0);
    if (fn.p === 'mercante') return this.convesProtegerAmiga(j, V, lider, alvo, h, dt);
    if (j.bordo?.pv) this.descerConvesAmiga(j, lider);
    const dj = Math.hypot(V.x - j.x, V.z - j.z);
    if (dj > 40) { ia.cer = null; this.irLongeAmiga(j, V.x, V.z, dt); return true; }
    if (j.trava > 0) { this.pararAmiga(j); return true; }
    // bate no alvo sem se afastar demais do carrinho (a coleira + o alcance da magia)
    if (alvo && dj <= PV.coleira + CEREBRO.magia[2]) { j.montado = null; if (this.cerebroAmiga(j, lider || j, alvo)) return true; }
    else if (alvo) ia.cer = null;
    // a roda: cada recruta num lugar em volta do carrinho (gira junto com ele), olhando para fora
    const ang = (V.ry || 0) + h * 2.39996, px = V.x + Math.sin(ang) * PV.roda, pz = V.z + Math.cos(ang) * PV.roda, dp = Math.hypot(px - j.x, pz - j.z);
    j.montado = null;
    if (dp < 0.7) { this.pararAmiga(j); j.ry = ang; return true; }
    this.irDireto(j, px, pz, dp > this.AMIGA.time.correr * 0.5);
    return true;
  },
  // no convés do mercante (protegendo): sobe (de até solido.pertoTime m, como o bot do time) e fica num lugar do convés;
  // o navio leva ele. De lá, ataca o alvo se alcança; nunca desce para correr atrás.
  convesProtegerAmiga(j, N, lider, alvo, h, dt) {
    const ia = j.ia, S = VEICULOS.navio.solido;
    if (!j.bordo?.pv) {
      if (j.esc) return false;
      if (Math.hypot(N.x - j.x, N.z - j.z) > (S.pertoTime || S.perto)) { ia.cer = null; this.irLongeAmiga(j, N.x, N.z, dt); return true; }
      if (j.veiculo === 'barquinho') { j.veiculo = null; devolverBarquinho(j.prog); j.progSujo = true; }
      if (j.coleta) this.pararColeta(j, null); if (j.pesca) this.pararPesca(j, null);
      const i = h % S.bordo.length;
      j.bordo = { pv: 1, dono: lider?.id ?? null, lx: S.bordo[i][0], lz: S.bordo[i][1], i, troca: Infinity };
    }
    const b = j.bordo, s = Math.sin(N.ry || 0), c = Math.cos(N.ry || 0);
    const noLugar = () => {
      j.x = N.x + b.lx * c + b.lz * s; j.z = N.z - b.lx * s + b.lz * c; j.y = AGUA.nivel + S.conves; j.vy = 0; j.chao = true;
      j.montado = null; j.entrada = { mx: 0, mz: 0, correr: false }; j.bordoT = this.tempo; // a física deixa o navio levar ele (simulacao.js)
    };
    noLugar();
    if (alvo && !(j.trava > 0)) this.cerebroAmiga(j, lider || j, alvo); // bate no que alcança; andar não anda (fica no lugar)
    noLugar();
    j.anim = 'Idle';
    if (!alvo) j.ry = (N.ry || 0) + (b.i % 2 ? 1.2 : -1.2); // olha o mar
    return true;
  },
  // saiu da função (ou o navio voltou para a mochila) com ele no convés: desce do lado do líder; sem líder, a física
  // solta ele ali (nadando, como quem pula do navio)
  descerConvesAmiga(j, lider = this.corpoLiderDe(this)) {
    if (!j.bordo?.pv) return;
    j.bordo = null;
    if (lider && !lider.morto && !lider.veiculo) {
      const a = [...String(j.id)].reduce((q, ch) => q + ch.charCodeAt(0), 0) * 1.7;
      j.x = lider.x + Math.sin(a) * 1.2; j.z = lider.z + Math.cos(a) * 1.2; j.y = this.terreno.altura(j.x, j.z); j.vy = 0; j.chao = true;
    }
  },
  // o duelo acabou: para e volta para o que fazia (sem fala pronta)
  fimDueloAmiga(j) { this.pararAmiga(j); j.ia.cer = null; },
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
    // ordem do time pela conversa por opções (André 2026-11-19): recua, fica atrás (só entra quando ele ataca), foco no alvo dele
    const O = j.ia.ordem && j.ia.ordem.ate > this.tempo ? j.ia.ordem.tipo : null;
    if (O === 'recua') return null;
    if (O === 'atras' && !this.emCombate(dono)) return null;
    if (O === 'foco' && dono.bateuEm && this.tempo - dono.bateuEm.t < 8) { const e = this.inimigosDe(j).find((x) => x.id === dono.bateuEm.id); if (e) return e; }
    if (O === 'foco' && j.ia.ordem.alvo) { const e = this.inimigosDe(j).find((x) => x.id === j.ia.ordem.alvo && !x.morto); if (e) return e; } // "Ataca meu alvo" (comando do time)
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
    // ele está seguindo ela (botão Seguir): ela vai na frente até o campo (levarAmiga)
    if (ia.seguido && (ia.seguido.id !== dono.id || this.tempo > ia.seguido.ate)) { ia.seguido = null; ia.viagemSeguida = null; }
    const S = ia.seguido?.c ? ia.seguido : null, leva = S && !S.chegou && d <= this.AMIGA.viagem.estrada;
    // navio (André 2026-11-21: "se eu quiser ir com os bots podem ficar em cima passeando"): o dono no leme ou no convés
    // e ela perto: sobe e passeia no convés até ele descer (shared/transporte.js bordoBot)
    if (this.bordoBot(j, dono, dt)) return;
    this.barcoAmiga(j, dono, dt); // água: entra no barquinho dela (se tiver) e desce na margem
    // ficou muito para trás (o dono voltou para a vila, disparou no lobo...): monta no lobo e vem pela estrada até ele
    // (André 2026-11-10: nada de aparecer do lado; antes, de R.longe m para lá, ela surgia atrás dele)
    this.cavernaAmiga(j, dono);
    // "Espera aqui" (comando do time, André 2026-11-19): fica onde estava e só luta com o que chegar perto dela
    const E = ia.ordem && ia.ordem.ate > this.tempo && ia.ordem.tipo === 'espera' ? ia.ordem : null;
    if (E) {
      if (j.trava > 0) return this.pararAmiga(j);
      j.montado = null;
      const perto = this.inimigosDe(j).find((e) => !e.morto && !e.treino && Math.hypot(e.x - j.x, e.z - j.z) < 7) || null;
      if (this.cerebroAmiga(j, dono, perto)) return;
      const dp = Math.hypot(E.x - j.x, E.z - j.z);
      return dp < 0.8 ? this.pararAmiga(j) : this.irDireto(j, E.x, E.z, dp > R.correr);
    }
    if (!leva && this.travessiaAmiga(j, dono, d)) return; // navio, barquinho, cais e outra terra (André 2026-11-21)
    if (leva) ia.viagem = null; // levando: a viagem até o campo é outra (ia.viagemSeguida)
    else if (this.longeAmiga(j, dono, d, dt)) return;
    if (j.trava > 0) return this.pararAmiga(j);
    let alvo = this.alvoAmiga(j, dono);
    if (!alvo && S?.chegou && d <= this.AMIGA.lidera.espera) alvo = this.alvoSozinhoAmiga(j, S.c); // no campo: ela puxa os monstros
    // montaria: monta quando o dono monta (e desce para lutar); levando, quem decide é a viagem dela
    const monta = !!dono.montado && !alvo && !ia.atividade && !j.prog.pack; // coletando ou com pack nas costas: a pé
    if (!leva && !j.veiculo && monta !== !!j.montado) j.montado = monta ? (MONTARIAS[dono.montado] ? dono.montado : 'lobo') : null;
    // combate pelo cérebro por regras (André 2026-11-11, shared/cerebro.js + CEREBRO em dados.js): poção, Cura (nela e
    // em quem do time está mal), fugir sem poção, recuar do golpe carregado, proteger aliado, atacar de espada ou cajado
    if (this.cerebroAmiga(j, dono, alvo)) return;
    if (!alvo && ia.missaoJunto && this.passoMissaoJuntoAmiga(j, dono, d, dt)) return; // ajudando na missão dela (André 2026-11-21)
    if (leva && !alvo && this.levarAmiga(j, dono, S, d, dt)) return;
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
    const jeito = C.jeitos[this.AMIGA.id] || this.AMIGA.luta || C.jeitos.padrao // recruta: a ficha dele (FICHA_RECRUTA);
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
    s.alvoAcima = alvo ? (alvo.nivel || alvo.prog?.nivel || 1) - (j.prog.nivel | 0) : 0; // alvo jogador (guerra): o nível dele
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
      // pedra, muro, árvore ou casa no meio (André 2026-11-21: magia não passa; a regra é a mesma do jogador): contorna
      // pelo lado até enxergar; o que não é círculo (relevo, casa) ela vai chegando perto
      if (!this.visaoLivre(j, alvo)) { const k = this.bloqueioVisao(j, alvo); return (k ? this.contornarAmiga(j, alvo, k) : this.irDireto(j, alvo.x, alvo.z, true)), true; }
      j.ia.pvpLado = 0;
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
      if (aviso && !dono.solo && !ia.vir && d > V.estrada * 3) { ia.avisoViagem = this.tempo + 120; if (this.tempo - (ia.aCaminhoT ?? -1e9) > 600) { ia.aCaminhoT = this.tempo; const L = this.AMIGA.chat.falas.aCaminho, t = sorteia(L.length > 1 ? L.filter((x) => x !== ia.aCaminhoUlt) : L); ia.aCaminhoUlt = t; this.dizerAmiga(t); } } // André 2026-11-17 (ronda): "Tô montando no lobo" 3x: no máximo 1 vez a cada 10 min e nunca a mesma seguida
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
    else if (!j.montado && !j.veiculo && !j.prog.pack) { v.seco += dt; if (v.seco >= V.seco && j.chao && !j.esc) j.montado = MONTARIAS[dono.montado] ? dono.montado : 'lobo'; }
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
  // ---------- barquinho (André 2026-11-21: "pedi pra fazerem o barquinho... fui pro lago, ele nadou atrás de mim e não
  // usou; quando perguntei ele disse que estava de barco") ----------
  // Com o barquinho na mochila, o bot do time entra nele (a mesma ação do jogador: veiculo 'colocar') quando o dono está
  // na água (nadando ou de barco) e a água ali ou logo à frente dá para o barco. Desce na margem (veiculo 'descer')
  // quando o dono sai da água; preso na beira sem conseguir descer, guarda o barco e sai a pé.
  barcoAmiga(j, dono, dt) {
    const ia = j.ia, B = this.AMIGA.barco || { olha: 1.8, perto: 2.5, preso: 4 };
    if (j.morto || j.esc || j.trava > 0 || this.tempo < (ia.barcoT || 0)) return;
    // outra terra (ia.outraTerra, travessiaAmiga): também vai de barquinho, mesmo com o dono já em terra do outro lado
    // no navio (leme ou convés) não: o bot vem a pé ou nadando e sobe no navio (André 2026-11-21: "no leme do navio quero
    // que eles venham comigo dentro do navio"; de barquinho, cada um no seu)
    const noNavio = dono.veiculo === 'navio' || !!this.aBordo(dono.x, dono.z, dono.y);
    const donoNaAgua = !noNavio && (dono.veiculo === 'barquinho' || fundoAgua(dono.x, dono.z) > AGUA.peito - 0.3 || !!ia.outraTerra);
    const dx = dono.x - j.x, dz = dono.z - j.z, d = Math.hypot(dx, dz) || 1;
    if (j.veiculo === 'barquinho') {
      ia.barcoPreso = j.bloqueado ? (ia.barcoPreso || 0) + dt : 0;
      const frente = lugarDoVeiculo('barquinho', j.x + dx / d * B.olha, j.z + dz / d * B.olha);
      if ((!donoNaAgua && (!frente || d < B.perto)) || ia.barcoPreso > B.preso) {
        ia.barcoT = this.tempo + 1;
        this.veiculo(j.id, { acao: 'descer' });
        if (j.veiculo === 'barquinho' && (ia.barcoPreso > B.preso * 2 || (!donoNaAgua && ia.barcoPreso > B.preso))) { // margem longe ou mochila cheia: guarda e sai nadando
          j.veiculo = null; devolverBarquinho(j.prog); j.progSujo = true; ia.barcoPreso = 0;
        }
      }
      return;
    }
    ia.barcoPreso = 0;
    if (j.veiculo || !donoNaAgua || d < B.perto || contar(j.prog.mochila, 'barquinho') < 1) return;
    if (Math.max(fundoAgua(j.x, j.z), fundoAgua(j.x + dx / d * B.olha, j.z + dz / d * B.olha)) < VEICULOS.barquinho.fundo) return;
    ia.barcoT = this.tempo + 2; // não tenta de novo a cada passo
    if (j.coleta) this.pararColeta(j, null);
    if (j.pesca) this.pararPesca(j, null);
    this.veiculo(j.id, { acao: 'colocar', k: 'barquinho' });
  },
  // ---------- travessia (André 2026-11-21: "estavam me seguindo; quando cheguei no cais pra pôr o navio, voltaram pra
  // cidade"; "podem ir pra ilha e pro outro continente... de barquinho, claro"; "no leme do navio, eles sobem") ----------
  // Com o dono no cais, na água, no navio ou em outra terra, a rota pelas estradas levava o bot de volta pela cidade ou
  // travava ("só de barco"). Aqui ele vai reto até o dono: a pé até a beira, nadando até o navio (sobe a 60 m, bordoBot)
  // ou de barquinho (barcoAmiga entra na água e desce na margem do outro lado). true = já cuidou do passo.
  travessiaAmiga(j, dono, d) {
    const ia = j.ia, T = this.AMIGA.travessia || { agua: 90, navio: 200 };
    if (j.veiculo === 'barquinho') { // remando: reto até o dono (na margem, o barcoAmiga desce)
      ia.viagem = null; j.montado = null; ia.outraTerra = false; // já no mar: desce na margem onde o dono está
      if (d < (this.regraAmiga('seguir') ?? this.AMIGA.time.seguir) + 1) return this.pararAmiga(j), true;
      return this.irDireto(j, dono.x, dono.z, true), true;
    }
    const nav = dono.veiculo === 'navio' || this.aBordo(dono.x, dono.z, dono.y);
    // na água: nadando, de barquinho ou no mar (o cais fica sobre o mar); a beira do lago (pescando) não conta
    const naAgua = !ia.atividade && (dono.veiculo === 'barquinho' || fundoAgua(dono.x, dono.z) > AGUA.peito - 0.3 || terraId(dono.x, dono.z) === 0);
    const tj = terraId(j.x, j.z), td = terraId(dono.x, dono.z);
    const outra = !nav && !naAgua && tj > 0 && td > 0 && tj !== td && contar(j.prog.mochila, 'barquinho') > 0;
    ia.outraTerra = outra;
    if (!(nav && d < T.navio) && !(naAgua && d < T.agua) && !outra) return false;
    ia.viagem = null;
    if (j.trava > 0) return this.pararAmiga(j), true;
    if (j.coleta) this.pararColeta(j, null);
    if (j.pesca) this.pararPesca(j, null);
    if (fundoAgua(j.x, j.z) > 0.3) j.montado = null;
    if (d < (this.regraAmiga('seguir') ?? this.AMIGA.time.seguir) + 0.8 && !nav) return this.pararAmiga(j), true;
    return this.irDireto(j, dono.x, dono.z, true), true;
  },
  // pediu o barquinho pelo chat: faz de verdade (com o material da mochila) ou diz o que falta; a fala é sempre o que
  // aconteceu no jogo (a IA dizia "já fiz" e "tô de barco" sem ter feito)
  barcoPedidoAmiga(a) {
    const P = this.AMIGA.barcoFalas || {};
    if (a.veiculo === 'barquinho') return P.nele || 'Tô no barquinho agora, remando atrás de você!';
    if (contar(a.prog.mochila, 'barquinho') > 0) return P.tem || 'Já tenho um barquinho na mochila. Quando você entrar na água, eu vou de barco atrás.';
    const custo = FERRAMENTAS_FAZENDA.barquinho.custo, nome = (k) => ITENS[k].nome.toLowerCase();
    const faltam = Object.entries(custo).filter(([k, n]) => contar(a.prog.mochila, k) < n).map(([k, n]) => `${n - contar(a.prog.mochila, k)} ${nome(k)}`);
    if (faltam.length) return `Ainda não dá pra fazer o barquinho: falta ${faltam.join(' e ')} (precisa de ${Object.entries(custo).map(([k, n]) => `${n} ${nome(k)}`).join(' e ')}).`;
    const prova = a.prog.mochila.map((o) => (o ? { ...o } : null));
    for (const [k, n] of Object.entries(custo)) tirar(prova, k, n);
    if (!guardar(prova, { k: 'barquinho', n: 1 })) return 'Tenho o material, mas a mochila tá cheia: não deu pra fazer agora. Se abrir espaço, me pede de novo.';
    a.prog.mochila = prova; a.progSujo = true; this.avisarProg(a);
    return P.fez || 'Pronto, fiz o barquinho! Quando você entrar na água, eu vou de barco junto.';
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
    if (this.amiga && / packs? /.test(t)) return 'pack'; // "pega o pack pra mim", "põe no carrinho" (André 2026-11-21)
    if (this.amiga && encomendaDoTexto(texto)) return 'encomenda'; // "minera ferro pra mim, eu compro" (André 2026-11-21)
    const pq = ia?.encPergunta; // ela perguntou "quantos?" e ele respondeu "20"
    if (pq && pq.ate > this.tempo && respostaEncomenda(texto)) return 'encomenda';
    let negou = false;
    for (const k of ['pescar', 'minerar', 'lenha']) if (tem(k)) { if (!negado(k)) return k; negou = true; } // "vamos pescar" é pescar, não caçar
    if (tem('equip')) return 'equip';
    if (A.barco && tem('barco') && !negado('barco')) return 'barco'; // "faz o barquinho" (antes de "vamos" = time) // "o que você tá usando?" (André 2026-11-10)
    // André 2026-11-21: "te ajudo na sua missão" (vem antes de "ajuda" e de "missão" = time) e "qual missão você tá fazendo?"
    if (A.ajudarMissao && tem('ajudarMissao') && !negado('ajudarMissao') && !/ minha missao | me ajud/.test(t)) return 'ajudarMissao';
    if (A.missaoDela && tem('missaoDela') && !/ minha missao /.test(t)) return 'missaoDela';
    for (const k of ['ondeUpar', 'nivel', 'missao']) if (A[k] && tem(k)) return k; // perguntas com resposta de verdade (André 2026-11-16), antes de "upar/missão" = time
    // André 2026-11-19 ("vamos, eu te sigo... aí ele escolhe o que quer fazer"): ela escolhe e vai na frente, sem "pra onde?"
    if (A.liderar && tem('liderar') && !negado('liderar')) return 'liderar';
    for (const k of ['sairTime', 'vir', 'time']) if (tem(k)) { if (!negado(k)) return k; negou = true; }
    if (negou) return 'naoAcao'; // "não vamos caçar", "nem vem": não faz nada
    if (ia?.chamado && ia.chamado.ate > this.tempo) { if (tem('nao')) return 'nao'; if (tem('sim')) return 'sim'; } // resposta ao chamado dela
    if (A.fazendo && tem('fazendo')) return 'fazendo'; // "tá fazendo o quê?" (repertório 2026-11-18)
    if (t.trim().split(' ').every((w) => /^(k{2,}|(ha){2,}h?|(rs){2,}|\.)$/.test(w))) return 'risada'; // só risada ("kkkk"); "te amo kkk" é carinho
    for (const k of ['tchau', 'comoVai', 'ajuda', 'dungeon', 'piada', 'obrigado', 'carinho', 'elogio', 'desabafo', 'casa', 'horta', 'troca', 'oi']) if (A[k] && tem(k)) return k;
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
    if (assunto === 'liderar') return true; // "eu te sigo": ela escolhe e vai, nunca "pra onde?" (André 2026-11-19)
    // André 2026-11-16: "vai lá caçar sozinha" tem "caçar" (regra = time), mas a IA entendeu que é para ir sem ele
    if (['cacar', 'voltar'].includes(assuntoIa) && ['time', 'vir', 'sairTime'].includes(assunto)) return false;
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
    const av = a.ia.av, bicho = av?.c ? `${TIPOS_INIMIGO[av.c.tipo]?.nome || 'monstros'} nível ${av.c.nivel || 1} em ${nomeLugarAmiga(av.c.nome)}` : ''; // André 2026-11-17: "tô indo fazer os imps nível 36"
    const so = this.AMIGA.genero === 'm' ? 'sozinho' : 'sozinha';
    const col = av?.coleta && { pescar: 'pescar', minerar: 'minerar', lenha: 'cortar lenha' }[av.coleta], colG = av?.coleta && { pescar: 'pescando', minerar: 'minerando', lenha: 'cortando lenha' }[av.coleta];
    const encR = av?.encomenda && a.ia.encomenda && !a.ia.encomenda.pronta ? ENCOMENDA.recursos[a.ia.encomenda.rec] : null; // André 2026-11-21: a encomenda dele
    const sozinho = av && encR && ['ir', 'cacar'].includes(av.fase) ? `${av.fase === 'ir' ? 'indo pegar' : 'pegando'} ${encR.nome} da encomenda que ${j.nome} pediu (${Math.max(0, contarRec(a.prog.mochila, a.ia.encomenda.item) - a.ia.encomenda.base)} de ${a.ia.encomenda.n}), ${a.ia.encomenda.lugar}` : av && { escolher: 'escolhendo onde caçar', ir: col ? `indo ${col} ${so}` : `indo caçar ${bicho} ${so}`, cacar: col ? `${colG} ${so}` : `caçando ${bicho} ${so}`, voltar: 'voltando para a vila vender, consertar e comprar poção', descansar: 'descansando na vila depois da caçada', missao: `fazendo a missão da história ${so}`, plantar: `plantando árvores da diária ${so}`, evoluir: 'evoluindo um equipamento na vila' }[av.fase];
    return {
      semCasa: !this.AMIGA.terreno, mora: !this.AMIGA.terreno ? this.moradiaAmiga(a)?.nome || 'a vila' : null,
      nome: this.AMIGA.nome, persona: this.AMIGA.persona || null, genero: this.AMIGA.genero || 'f', amigo: j.nome, amizade: this.amizadeAmiga(j),
      comOutro: id !== this.amigaDono && this.ocupadaAmiga() ? this.jogadores.get(this.amigaDono)?.nome || null : null, nivel: a.prog.nivel, nivelAmigo: j.prog.nivel,
      noTime: !!(a.time && a.time === j.time), distancia: Math.round(Math.hypot(a.x - j.x, a.z - j.z)),
      fazendo: sozinho ? sozinho : a.ia.atividade ? `${this.AMIGA.atividades[a.ia.atividade].nome} junto com ele` : a.time ? 'caçando no time com ele' : a.ia.fase === 'trabalhar' ? (a.ia.anim === 'construir' ? 'construindo a casa' : 'cuidando da horta') : a.ia.fase === 'andar' ? 'passeando pela vila' : (this.AMIGA.terreno ? 'descansando na porta de casa' : 'passeando pela vila'),
      // André 2026-11-17 (ronda): "morreu também?" e ela "não, ainda tô de pé" (a ficha não dizia que ela tinha caído)
      encomenda: (() => { const e = this.encomendaProntaAmiga(a, j); return e ? `${e.tem} de ${ENCOMENDA.recursos[e.rec].nome} separados pra ${j.nome} (encomenda dele); se ele pedir pra você vir, você leva e põe na troca` : null; })(),
      morta: !!a.morto, caiuHa: a.ia.caiuT != null && this.tempo - a.ia.caiuT < 1800 ? Math.round((this.tempo - a.ia.caiuT) / 60) : null,
      // "o barquinho você pode fazer" e ela disse 3 vezes que não conseguia: ela sabe a receita e o que tem
      // André 2026-11-21: ele disse "tô de barco" nadando. Agora a ficha diz onde ele está de verdade
      barco: a.veiculo === 'barquinho' ? 'você está NO barquinho agora, remando' : contar(a.prog.mochila, 'barquinho') ? `você tem um na mochila, mas NÃO está nele agora${fundoAgua(a.x, a.z) > AGUA.peito - 0.3 ? ' (está nadando)' : ''}; entra nele sozinh${this.AMIGA.genero === 'm' ? 'o' : 'a'} quando ${j.nome} estiver na água e você no time` : `você não tem; dá para fazer com ${Object.entries(FERRAMENTAS_FAZENDA.barquinho.custo).map(([k, n]) => `${n} ${ITENS[k].nome.toLowerCase()}`).join(' e ')} (você tem ${Object.keys(FERRAMENTAS_FAZENDA.barquinho.custo).map((k) => `${contar(a.prog.mochila, k)} ${ITENS[k].nome.toLowerCase()}`).join(' e ')})`,
      casaPronta: !!pronta, noite: ehNoite(horaDoJogo(j.prog.dia)), pedido: a.pedido ? `${a.pedido.n} ${ITENS[a.pedido.k].nome}` : null,
      chamou: id === this.amigaDono && a.ia.chamado && a.ia.chamado.ate > this.tempo ? a.ia.chamado.quer : null,
      humor: (() => { // o que ela decidiu sobre caçar/time agora (decisaoTimeAmiga); o mesmo sorteio vale quando ele chamar
        if (a.time && a.time === j.time) return null;
        const topou = this.combinouAmiga(a) || (a.ia.chamado?.quer === 'time' && a.ia.chamado.ate > this.tempo);
        if (topou) return { aceita: true, combinado: true };
        const h = this.decisaoTimeAmiga(a, j, true);
        return { aceita: h.aceita, motivo: h.motivo, recusou: (a.ia.recusaAte || 0) > this.tempo, min: Math.max(1, Math.ceil((Math.max(a.ia.recusaAte || 0, h.ate) - this.tempo) / 60)) };
      })(),
      ouro: a.prog.ouro | 0, leilao: this.fichaLeilaoAmiga?.(a) || null,
      mochila: Object.entries(a.prog.mochila.reduce((m, o) => { if (o) m[ITENS[o.k]?.nome || o.k] = (m[ITENS[o.k]?.nome || o.k] || 0) + (o.n || 1); return m; }, {})).slice(0, 8).map(([k, n]) => `${n} ${k}`).join(', '),
      conversa: this.chatDeAmiga(j).slice(-this.histAmiga()), // André 2026-11-13: com menos ela perdia o fio; 2026-11-17: 40 e salvas no banco
      memoria: (a.memorias?.[j.conta] || []).filter(lembrancaBoa).slice(0, this.AMIGA.memoria.max),
      fatos: (a.fatos?.[j.conta] || []).filter((f) => !/miss[aã]o|quest/i.test(f) || HISTORIA.some((M) => f.toLowerCase().includes(M.nome.toLowerCase()))).slice(-this.AMIGA.fatos.max), esforco: this.AMIGA.puxaAssunto ? this.AMIGA.chat.esforco || null : null, // só a Cecília pensa mais (André 2026-11-17)
      // ela puxou conversa e ele demorou para responder (naoInsiste): retoma numa boa, sem cobrar (André 2026-11-17)
      ignorada: this.esperandoAmiga(a, j) && this.tempo - a.ia.espera[j.conta].t > 90,
      temas: this.AMIGA.puxaAssunto ? (a.ia.temas ||= []) : null, // os últimos assuntos que ela puxou (server/ia-amiga.js puxarAssunto não repete)
      convida: !!this.AMIGA.convida, // ela manda o convite do time (André 2026-11-17)
      seguindo: !!(a.ia.seguido && a.ia.seguido.id === id && this.tempo < a.ia.seguido.ate), // ele aperta Seguir e vai atrás dela
      seguindoPara: a.ia.seguido?.id === id && a.ia.seguido.c ? nomeLugarAmiga(a.ia.seguido.c.nome) : null,
      equip: this.listaEquipAmiga(), pecaFraca: this.pecaFracaAmiga() ? nomeDoItem(this.pecaFracaAmiga().it) : null,
      ...this.saberAmiga(a, j), acima: (a.prog.nivel | 0) - (j.prog.nivel | 0), grindAcabou: this.grindAcabouAmiga(a), // André 2026-11-16 ("eles são muito burros"): o que ela sabe do jogo de verdade, para não inventar
      regras: [...Object.keys(a.regras?.[j.conta] || {}).filter((k) => a.regras[j.conta][k] && this.AMIGA.memoria.regras[k]).map((k) => this.AMIGA.memoria.regras[k].texto), ...(a.dicas || []).map((d) => d.texto), ...textoLicoes(a.licoes)],
    };
  },
  // ---------- o que ela sabe (André 2026-11-16: "eles estão muito limitados para um NPC que usa IA") ----------
  // Ao vivo ela inventava ("campo de treinos perto da floresta", "poção a 12") e não sabia a missão dele. Agora a ficha leva
  // dados reais do jogo: campos de caça bons para o nível dela e o dele, preço da loja, a missão dele, a vida e as poções
  // dela, e se ela pode sair para caçar sozinha agora (o mesmo que o passoSozinhoAmiga confere).
  saberAmiga(a, j) {
    // André 2026-11-17 ("e se o lugar não tiver sido destravado por mim?"): só entra campo aberto na história de quem vai
    const aberto = (c, ...ps) => ps.every((p) => !zonaFechadaEm(p, c.x, c.z));
    const campos = (n, ...ps) => this.cacas.map((c) => c.def).filter((c) => !c.boss && !c.tunel && (c.nivel || 1) <= n + 2 && aberto(c, ...ps))
      .sort((x, y) => (y.nivel || 1) - (x.nivel || 1)).slice(0, 3)
      .map((c) => `${c.nome} (nível ${c.nivel || 1}, ${Math.round(Math.hypot(c.x - a.x, c.z - a.z))} m de você)`).join('; ');
    const preco = (k, nv = j.prog.nivel) => precoLoja(LOJA.find((o) => o.k === k && !o.r), nv) || ITENS[k]?.preco; // sobe com o nível de quem compra (economia 2026-11-16)
    const E = !j.bot && etapaAtual(j.prog), M = !j.bot && missaoAtual(j.prog);
    const vida = Math.round(100 * (a.vida || 0) / Math.max(1, a.vidaMax || 1));
    return {
      camposDela: campos(a.prog.nivel | 0, a.prog), camposDele: campos(j.prog.nivel | 0, j.prog), mapa: this.mapaAmiga(),
      camposJuntos: j.bot ? null : campos(Math.min(a.prog.nivel | 0, j.prog.nivel | 0), a.prog, j.prog),
      // o campo onde ela está caçando ainda fechado para ele (a missão que abre)
      fechadoDele: !j.bot && a.ia.av?.c && ['ir', 'cacar'].includes(a.ia.av.fase) && this.fechadoParaAmiga(j, a.ia.av.c) ? nomeLugarAmiga(a.ia.av.c.nome) : null, // só o nome: ela não explica (André 2026-11-17)
      loja: `para ${j.nome} (nível ${j.prog.nivel}): poção de vida ${preco('pocao')} de ouro e de mana ${preco('pocao_mana')} na Rosa (para você, ${preco('pocao', a.prog.nivel)}); peça de armadura comum ${precoLoja(LOJA.find((o) => o.r === 0), j.prog.nivel) || 60} e rara ${precoLoja(LOJA.find((o) => o.r === 1), j.prog.nivel) || 240}; o preço sobe com o nível de quem compra; conserto no Tomás (ferreiro)`,
      missaoDele: M ? `${M.nome}${E ? ` (agora: ${E.txt})` : ' (ainda não aceitou: fala com o NPC da missão)'}` : null,
      vida, pocoes: contar(a.prog.mochila, 'pocao'), arma: `espada e cajado (troca entre os dois na luta; agora: ${a.modo === 'Magia' ? 'cajado' : 'espada'})`, // André 2026-11-18: ela dizia que não usa cajado
      sozinha: this.podeSairAmiga(a, j), naLista: this.ehAmigoAmiga(j),
      diariasDela: a.semTeto ? this.diariasTextoAmiga(a) : null, missaoJunto: a.ia.missaoJunto?.id === j.id,
      missaoDela: a.semTeto && missaoAtual(a.prog) ? `${missaoAtual(a.prog).nome}${a.prog.hist?.ac && etapaAtual(a.prog) ? ` (agora: ${etapaAtual(a.prog).txt})` : ''}` : null,
    };
  },
  // todos os campos de caça e chefes, curtinho (mesmo nome junta os níveis): "onde upar no 10?" tem resposta certa
  mapaAmiga() {
    if (this._mapaAmiga) return this._mapaAmiga;
    const g = new Map(), defs = this.cacas.map((c) => c.def);
    for (const c of defs.filter((c) => !c.boss)) { const k = c.nome.replace(/ \((.*)\)$/, ' em $1'); const v = g.get(k) || { n: [] }; v.n.push(c.nivel || 1); g.set(k, v); }
    const campos = [...g].sort((x, y) => Math.min(...x[1].n) - Math.min(...y[1].n)).map(([k, v]) => `${k} nv ${[...new Set(v.n)].sort((a, b) => a - b).join('/')}`).join('; ');
    const chefes = defs.filter((c) => c.boss).map((c) => `${c.nome} nv ${c.nivel}`).join('; ');
    return (this._mapaAmiga = `Campos (nível dos monstros): ${campos}. Clareiras ficam perto da vila inicial; Vael, Ilha do Meio e Aurora são outras terras (barco). Chefes do mundo: ${chefes}.`);
  },
  // dá para sair caçar sozinha agora? { ok, motivo } (fora do time, viva, no horário dela, com poção ou ouro para comprar)
  podeSairAmiga(a, j) {
    if (a.morto) return { ok: false, motivo: 'você caiu e está renascendo', fala: 'acabei de cair, tô renascendo' };
    if (a.time && a.time === j.time) return { ok: false, motivo: 'você está no time dele caçando junto', fala: 'tô no seu time, bora caçar junto' };
    if (a.ia.av && ['ir', 'cacar'].includes(a.ia.av.fase)) return { ok: false, motivo: 'você já está caçando', ja: true };
    // soldado do clã (André 2026-11-22: "ele só obedece minhas regras e acabou. Só se ele tiver sem vigor"): sem horário,
    // sem limite do dia, sem desculpa; só o vigor zerado
    if (this.soldadoAmiga()) return vigorAgora(a.prog.vigor) < 1 ? { ok: false, motivo: 'você está sem vigor', fala: SEM_VIGOR, semVigor: true } : { ok: true };
    if (!naHoraDe(this.rotinaAmiga(), horaDoJogo(a.prog.dia))) { // André 2026-11-18 (ronda): "ainda é dia, temos que ficar até a noite" (inventou): o horário de verdade
      const R = this.rotinaAmiga(), hh = (h) => `${Math.floor(h)}h`;
      return { ok: false, motivo: `está fora do seu horário de caçar ${this.AMIGA.genero === "m" ? "sozinho" : "sozinha"} (você sai das ${hh(R.saiDe)} às ${hh(R.voltaDe)}; agora são ${hh(horaDoJogo(a.prog.dia))})`, fala: ehNoite(horaDoJogo(a.prog.dia)) ? 'de noite eu não saio, só quando amanhecer' : 'agora não é meu horário de sair, mais tarde eu vou' };
    }
    if (this.grindAcabouAmiga(a)) return { ok: false, motivo: 'você já caçou o bastante hoje (só amanhã de novo; pode pescar, minerar ou ficar na vila)', fala: 'já farmei demais hoje, amanhã eu volto pro grind' };
    if (!contar(a.prog.mochila, 'pocao') && a.prog.ouro < (precoLoja(LOJA.find((o) => o.k === 'pocao'), a.prog.nivel) || 15)) return { ok: false, motivo: 'você está sem poção e sem ouro', fala: 'tô sem poção e sem ouro' };
    return { ok: true };
  },
  // ---------- missões (André 2026-11-16: "Dário e Cecília também façam missões... e as diárias também") ----------
  // História: vai até o NPC da missão e aceita (falaHistoria, a mesma do jogador); cada etapa: vai até o lugar dela
  // (alvoHistoria, o mesmo "Ir" do guia) e trabalha lá NPC_VIDA.missao.porEtapa s; aí a etapa passa (proximaEtapa) e, na
  // última, a missão é entregue com o prêmio e o que ela libera (concluirMissao). Até NPC_VIDA.missao.segPorDia s por dia
  // real (fora o grind). Enquanto não abre a região, ele não caça nem coleta lá (campoAmiga, lugarColetaAmiga).
  missaoHojeAmiga(a) { const dia = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10); if (a.missaoDia?.dia !== dia) a.missaoDia = { dia, seg: 0 }; return a.missaoDia.seg; },
  // segundos de missão por dia: atrasado na história (a missão de agora pede bem menos que o nível dele), mais tempo até
  // alcançar (André 2026-11-17)
  limiteMissaoAmiga(a) {
    const MS = NPC_VIDA.missao, M = missaoAtual(a.prog), At = MS.atrasado;
    return M && At && (a.prog.nivel | 0) - M.nv >= At.niveis ? MS.segPorDia * At.x : MS.segPorDia;
  },
  querMissaoAmiga(a) {
    const MS = NPC_VIDA.missao, M = a.semTeto && missaoAtual(a.prog);
    return !!M && M.nv <= (a.prog.nivel | 0) && this.missaoHojeAmiga(a) < this.limiteMissaoAmiga(a) && Math.random() < MS.chance;
  },
  missaoSozinhoAmiga(j, av, noite, voltar, dt) {
    const MS = NPC_VIDA.missao, M = missaoAtual(j.prog), h = j.prog.hist;
    if (noite || !M || M.nv > (j.prog.nivel | 0) || this.missaoHojeAmiga(j) >= this.limiteMissaoAmiga(j)) return voltar();
    if (dt > 0) j.missaoDia.seg += dt;
    if (!h?.ac) { // aceitar com o NPC da missão
      const n = (this.mapa.npcs || []).find((o) => o.id === M.npc); if (!n) return voltar();
      if (!this.chegouMissaoAmiga(j, n.x, n.z, dt)) return;
      j.ry = Math.atan2(n.x - j.x, n.z - j.z);
      if (!this.falaHistoria(j, n, () => {}, true)) return voltar();
      av.alvo = null; this.guardarAmiga(); return;
    }
    if (!av.alvo || av.e !== h.e || av.p !== h.p) { // etapa nova: para onde ir e quanto tempo leva
      const al = this.alvoHistoria(j);
      av.alvo = al ? { x: al.x, z: al.z } : { x: j.x, z: j.z }; av.e = h.e; av.p = h.p; av.ate = null;
    }
    if (av.ate == null) { if (!this.chegouMissaoAmiga(j, av.alvo.x, av.alvo.z, dt)) return; av.ate = this.tempo + MS.porEtapa * (0.6 + Math.random() * 0.8); }
    this.pararAmiga(j);
    if (this.tempo >= (av.golpe || 0)) { av.golpe = this.tempo + 1.4; j.acao = { nome: 'pouso', ts: 1 }; j.acaoSeq = (j.acaoSeq | 0) + 1; } // trabalhando na etapa
    if (this.tempo < av.ate) return;
    j.acao = null; const p0 = h.p;
    this.proximaEtapa(j);
    av.alvo = null;
    if (j.prog.hist.p !== p0) { this.guardarAmiga(); if (!this.querMissaoAmiga(j)) return voltar(); } // missão entregue
  },
  // ---------- contar a missão e aceitar ajuda (André 2026-11-21: "se eu perguntar eles me falem qual missão estão
  // fazendo e eu poder me oferecer pra ajudar") ----------
  // as diárias dela hoje, em texto: "faltam: Plante 4 árvores (2/4)..." ou "já fiz todas hoje"
  diariasTextoAmiga(a) {
    if (!this.temDiarias?.(a)) return '';
    const st = this.diariasDe(a), falta = DIARIAS.lista.filter((D) => (st.n[D.id] || 0) < D.n);
    return falta.length ? `falta: ${falta.map((D) => `${D.txt.toLowerCase()} (${st.n[D.id] || 0}/${D.n})`).join(', ')}` : 'já fiz todas hoje';
  },
  // a missão da história dela agora (nome e etapa) ou null
  missaoDelaAmiga(a) {
    const M = a.semTeto && missaoAtual(a.prog); if (!M) return null;
    const E = a.prog.hist?.ac && etapaAtual(a.prog), npc = (this.mapa.npcs || []).find((o) => o.id === M.npc);
    return { M, txt: `${M.nome}${E ? ` (agora: ${E.txt})` : npc ? ` (falta aceitar com ${npc.nome.split(',')[0]})` : ''}`, cedo: M.nv > (a.prog.nivel | 0) };
  },
  falaMissaoDelaAmiga(a) {
    const m = this.missaoDelaAmiga(a), di = this.diariasTextoAmiga(a);
    const mis = !m ? 'Missão da história eu já fiz todas.' : m.cedo ? `A próxima missão é ${m.M.nome}, mas pede nível ${m.M.nv}.` : `Tô na missão ${m.txt}.`;
    const junto = m && !m.cedo ? ' Quer me ajudar? É só falar "te ajudo na missão".' : '';
    return `${mis}${di ? ` Das diárias, ${di}.` : ''}${junto}`;
  },
  // ele se ofereceu: no time, ela já vai na frente até a etapa; fora, manda o convite (ela sempre topa ajuda na missão)
  ajudaMissaoAmiga(a, j) {
    const m = this.missaoDelaAmiga(a), noTime = !!(a.time && a.time === j.time), FA = this.AMIGA.falas;
    if (!m) return { ok: false, fala: `Valeu! Mas missão da história eu já fiz todas.${this.diariasTextoAmiga(a) ? ` Das diárias, ${this.diariasTextoAmiga(a)}.` : ''}` };
    if (m.cedo) return { ok: false, fala: `Valeu! Mas a próxima (${m.M.nome}) pede nível ${m.M.nv}, ainda não dá.` };
    if (a.morto) return { ok: false, fala: FA.caiu };
    if (j.morto) return { ok: false, fala: 'Levanta primeiro, aí a gente vai!' };
    if (!noTime && this.timeCheioAmiga(j)) return { ok: false, fala: FA.recusa.cheio };
    a.ia.missaoJunto = { id: j.id, ate: this.tempo + NPC_VIDA.missao.juntoSeg, p: null };
    a.ia.chamado = null; a.ia.vir = null; a.ia.plano = null;
    if (noTime) { this.alvoMissaoJuntoAmiga(a, j, true); return { ok: true, fala: `Bora! Missão ${m.txt}. Cola em mim!` }; }
    this.combinarAmiga(a);
    const mandou = this.convidarTimeAmiga(a, j, null);
    return { ok: true, fala: mandou ? `Opa, ajuda é sempre bem-vinda! Tô na missão ${m.txt}. Te mandei o time, aceita e cola em mim.` : `Fechou! Tô na missão ${m.txt}. Me chama no time que a gente vai.` };
  },
  // para onde a etapa de agora leva (o NPC para aceitar ou o lugar da etapa); muda de etapa: ela avisa e o app segue de novo
  alvoMissaoJuntoAmiga(a, dono, forca = false) {
    const MJ = a.ia.missaoJunto, h = a.prog.hist || {}, chave = `${h.p}.${h.ac ? h.e : 'ac'}`;
    if (!forca && MJ.p === chave && a.ia.seguido?.id === dono.id) return a.ia.seguido;
    const al = this.alvoHistoria(a); if (!al) return null;
    MJ.p = chave; MJ.fim = null;
    const c = { nome: al.nome || 'a missão', x: al.x, z: al.z, r: 6, missao: true };
    a.ia.seguido = { id: dono.id, c, chegou: false, ate: this.tempo + this.AMIGA.lidera.ate }; a.ia.viagemSeguida = null;
    this.evento({ t: 'seguir', para: dono.id, npc: a.id, nome: this.AMIGA.nome, lugar: nomeLugarAmiga(c.nome) });
    return a.ia.seguido;
  },
  // no time com quem se ofereceu: vai na frente até a etapa; lá, com ele perto, faz a etapa (mais rápido que sozinha) e
  // segue para a próxima até entregar a missão. true = cuidou do passo
  passoMissaoJuntoAmiga(j, dono, d, dt) {
    const ia = j.ia, MJ = ia.missaoJunto, MS = NPC_VIDA.missao, M = missaoAtual(j.prog);
    if (MJ.id !== dono.id || this.tempo > MJ.ate || !M || M.nv > (j.prog.nivel | 0)) { ia.missaoJunto = null; if (ia.seguido?.c?.missao) ia.seguido = null; return false; }
    const S = this.alvoMissaoJuntoAmiga(j, dono); if (!S) { ia.missaoJunto = null; return false; }
    S.ate = this.tempo + this.AMIGA.lidera.ate;
    if (!S.chegou) return this.levarAmiga(j, dono, S, d, dt);
    this.pararAmiga(j); j.montado = null;
    const h = j.prog.hist;
    if (!h?.ac) { // chegou no NPC: aceita a missão
      const n = (this.mapa.npcs || []).find((o) => o.id === M.npc);
      j.ry = n ? Math.atan2(n.x - j.x, n.z - j.z) : j.ry;
      if (!n || !this.falaHistoria(j, n, () => {}, true)) { ia.missaoJunto = null; ia.seguido = null; return false; }
      this.guardarAmiga(); return true;
    }
    if (d > this.AMIGA.lidera.espera) { j.ry = Math.atan2(dono.x - j.x, dono.z - j.z); return true; } // espera ele chegar
    if (MJ.fim == null) MJ.fim = this.tempo + MS.porEtapa * MS.junto * (0.6 + Math.random() * 0.8);
    if (this.tempo >= (MJ.golpe || 0)) { MJ.golpe = this.tempo + 1.4; j.acao = { nome: 'pouso', ts: 1 }; j.acaoSeq = (j.acaoSeq | 0) + 1; }
    if (this.tempo < MJ.fim) return true;
    j.acao = null; const p0 = h.p;
    this.proximaEtapa(j);
    if (j.prog.hist.p !== p0) { // missão entregue
      ia.missaoJunto = null; ia.seguido = null; this.guardarAmiga();
      this.dizerAmiga(`Missão entregue! Valeu demais pela ajuda, ${dono.nome}!`, true, dono.id);
      return true;
    }
    const E = etapaAtual(j.prog);
    if (E) this.dizerAmiga(`Feito! Agora: ${E.txt}. Bora!`, true, dono.id);
    this.alvoMissaoJuntoAmiga(j, dono, true);
    return true;
  },
  // vai até (x, z) pela estrada; outra terra sem barco ou preso: vale como chegou (faz a etapa por ali)
  chegouMissaoAmiga(j, x, z, dt) {
    if (j.ia.viagem?.bloqueio) { j.ia.viagem = null; return true; }
    return this.irLongeAmiga(j, x, z, dt);
  },
  // a diária que falta e que ele sabe fazer agora: 'plantar' | 'pescar' | 'lenha' | 'minerar' | null (caçar conta sozinho)
  diariaQueFaltaAmiga(j) {
    const op = this.diariasQueFaltamAmiga(j);
    return op.length && Math.random() < NPC_VIDA.diaria.chance ? sorteia(op) : null;
  },
  // as diárias que faltam e que ele sabe fazer agora (sem sorteio)
  diariasQueFaltamAmiga(j) {
    if (!j.semTeto || !this.temDiarias?.(j) || vigorAgora(j.prog.vigor) < 1 || (j.ia.diariaFalhou || 0) > this.tempo) return [];
    const st = this.diariasDe(j), falta = (id) => { const D = DIARIAS.lista.find((x) => x.id === id); return D && (st.n[id] || 0) < D.n; };
    const tem = (f) => contar(j.prog.mochila, f) > 0;
    const op = [];
    if (falta('arvores') && (this.sementePlantioAmiga(j) || j.prog.ouro >= this.precoSementeAmiga() * 4)) op.push('plantar');
    if (falta('peixes') && tem('vara')) op.push('pescar');
    if (falta('coleta')) { if (tem('machado')) op.push('lenha'); else if (tem('picareta')) op.push('minerar'); }
    return op;
  },
  // tem missão da história (dentro do tempo do dia) ou diária para fazer agora?
  temTarefaAmiga(j) {
    const M = j.semTeto && missaoAtual(j.prog);
    return (!!M && M.nv <= (j.prog.nivel | 0) && this.missaoHojeAmiga(j) < this.limiteMissaoAmiga(j)) || this.diariasQueFaltamAmiga(j).length > 0;
  },
  sementePlantioAmiga(j) { return NPC_VIDA.diaria.arvores.find((s) => contar(j.prog.mochila, 'semente_' + s) > 0) || null; },
  precoSementeAmiga() { const s = NPC_VIDA.diaria.arvores[0]; return precoLoja(LOJA.find((o) => o.k === 'semente_' + s), 1) || 10; },
  // um quadrado livre de área de plantio perto da casa dele (fora da névoa da história dele), ou null
  quadradoPlantioAmiga(j, ruins) {
    const M = this.moradiaAmiga(j), Q = PLANTIO.quadrado; let melhor = null, md = Infinity;
    for (const key of QUADRADOS_PLANTIO.keys()) {
      if (this.plantioQ?.has(key) || ruins?.has(key)) continue;
      const [i, k] = key.split(',').map(Number), x = i * Q + Q / 2, z = k * Q + Q / 2, d = Math.hypot(x - M.x, z - M.z);
      if (d >= md || d > NPC_VIDA.diaria.raio) continue;
      if (j.semTeto && zonaFechadaEm(j.prog, x, z)) continue;
      md = d; melhor = { key, i, k, ...lugarNoQuadrado(i, k) };
    }
    return melhor;
  },
  // planta as árvores da diária: compra semente na Rosa se não tem, vai até um quadrado livre e planta (o mesmo
  // plantarArvore do jogador: gasta vigor, conta a diária, cresce no mapa para todo mundo)
  plantarSozinhoAmiga(j, av, noite, voltar, dt) {
    const D = DIARIAS.lista.find((x) => x.id === 'arvores'), st = this.diariasDe(j);
    if (noite || !D || (st.n.arvores || 0) >= D.n || vigorAgora(j.prog.vigor) < 1 || av.tentou > 12) {
      if (av.tentou > 12) j.ia.diariaFalhou = this.tempo + 1800; // não deu: tenta outra coisa por meia hora
      return voltar();
    }
    let s = this.sementePlantioAmiga(j);
    if (!s) { // passa na Rosa: o que falta da diária, pelo preço da loja
      const n = D.n - (st.n.arvores || 0), preco = this.precoSementeAmiga();
      if (j.prog.ouro < preco * n || !guardar(j.prog.mochila, { k: 'semente_' + NPC_VIDA.diaria.arvores[0], n })) { j.ia.diariaFalhou = this.tempo + 1800; return voltar(); }
      j.prog.ouro -= preco * n; s = NPC_VIDA.diaria.arvores[0];
    }
    if (!av.alvo) { av.alvo = this.quadradoPlantioAmiga(j, (av.ruins ||= new Set())); if (!av.alvo) { j.ia.diariaFalhou = this.tempo + 1800; return voltar(); } }
    if (!this.chegouMissaoAmiga(j, av.alvo.x, av.alvo.z, dt)) return;
    this.pararAmiga(j);
    const n0 = st.n.arvores || 0; av.tentou++;
    this.plantarArvore(j.id, { s, x: av.alvo.x, z: av.alvo.z, q: true });
    if ((this.diariasDe(j).n.arvores || 0) > n0) av.n++; else av.ruins.add(av.alvo.key);
    av.alvo = null; this.guardarAmiga();
  },
  // Dias em que ninguém jogou (André 2026-11-21: "as árvores do mundo não estão aumentando"): o NPC só tem corpo com
  // gente na sala, então nesses dias ele não plantava nem fazia diária. Ao voltar, cada dia inteiro que passou (até
  // NPC_VIDA.offline.maxDias) conta como feito: planta as 4 árvores da diária nas áreas de plantio perto de onde mora
  // (comprando a semente na Rosa, com a hora daquele dia, então já crescem), e recebe o prêmio dela e o da caça (o XP
  // da caça já vem do offlineAmiga). Mesmas travas do jogador: quadrado livre, longe de árvore e pedra, limite do mundo.
  diariasOfflineAmiga(j, desde) {
    if (!Number.isFinite(desde) || !this.plantarArvore || !this.temDiarias?.(j)) return 0;
    const hoje = diaDiarias(this.agoraMs()), D = DIARIAS.lista.find((x) => x.id === 'arvores'); if (!D) return 0;
    const dias = []; let d = diaDiarias(desde);
    for (let n = 0; d < hoje && n < 60; n++) { dias.push(d); d = new Date(Date.parse(d + 'T12:00:00Z') + 86400000).toISOString().slice(0, 10); }
    const ult = dias.slice(-NPC_VIDA.offline.maxDias), st0 = j.prog.diarias;
    let plantou = 0;
    for (const dia of ult) {
      const ja = st0?.d === dia ? st0 : null, falta = D.n - Math.min(D.n, ja?.n?.arvores || 0);
      const pr = premioDiaria(j.prog.nivel), quando = Date.parse(dia + 'T18:00:00Z'), preco = this.precoSementeAmiga();
      let n = 0;
      for (const ruins = new Set(); n < falta && j.prog.ouro >= preco;) {
        if (this.plantadasNasAreas() >= PLANTIO.maxMundo) break;
        const q = this.quadradoPlantioAmiga(j, ruins); if (!q) break;
        ruins.add(q.key);
        if (this.pertoNaMata(q.x, q.z).some((o) => Math.hypot(o.x - q.x, o.z - q.z) < o.r + PLANTIO.folga)) continue;
        const s = sorteia(NPC_VIDA.diaria.arvores), T = ARVORES_PLANTIO[s]; if (!T || T.grande) continue;
        j.prog.ouro -= preco;
        this.botarPlantada({ id: 'p' + this.plantioProx++, s, x: Math.round(q.x * 100) / 100, z: Math.round(q.z * 100) / 100, ry: Math.round(q.ry * 100) / 100, sc: Math.round(q.sc * (T.s || 1) * 100) / 100, dono: j.conta || j.id, nome: j.nome, quando });
        n++;
      }
      plantou += n;
      const recebe = (id) => !(ja?.r || []).includes(id);
      if (n + (ja?.n?.arvores || 0) >= D.n && recebe('arvores')) { j.prog.ouro += pr.ouro; if (pr.xp) this.ganharXP(j, pr.xp); }
      if (recebe('monstros')) { j.prog.ouro += pr.ouro; if (pr.xp) this.ganharXP(j, pr.xp); } // caçou nesse dia (o offline)
    }
    if (ult.length) this.evolucaoAmiga?.(j, 'diaria', `${ult.length} dia(s) sem ninguém: ${plantou} árvore(s) plantada(s)`);
    return plantou;
  },
  // diárias (shared/diarias.js): caçando, pescando e coletando sozinho elas contam; na vila recebe o que terminou
  diariasAmiga(j) {
    if (!j.semTeto || !this.temDiarias?.(j)) return 0;
    const st = this.diariasDe(j); let n = 0;
    for (const D of DIARIAS.lista) if ((st.n[D.id] || 0) >= D.n && !st.r.includes(D.id)) { this.diaria(j.id, { acao: 'receber', id: D.id }); n++; }
    if (n) this.guardarAmiga();
    return n;
  },
  // ---------- limite de grind sozinho (André 2026-11-16) ----------
  // segundos caçando sozinha hoje (dia real que vira às 3h de Brasília); no time com alguém não conta
  grindHojeAmiga(a) { const dia = new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10); if (a.grind?.dia !== dia) a.grind = { dia, seg: 0 }; return a.grind.seg; },
  // recruta de clã bot (André 2026-11-23): no lugar dos 30 min, CLAS_NPC_ORDENS.horasDia de caça por dia real
  grindAcabouAmiga(a) { return this.grindHojeAmiga(a) >= ((this.AMIGA.clanpc || this.fixoClaNpc?.(this)) && CLAS_NPC_ORDENS.ligado ? CLAS_NPC_ORDENS.horasDia * 3600 : NPC_VIDA.grind.segPorDia); },
  // a IA decidiu que ela vai caçar sozinha (ele pediu ou ela quis): sai agora; lugar = nome do campo que ela disse, se der
  sairCacarAmiga(a, j, lugar) {
    const v = this.podeSairAmiga(a, j); if (!v.ok) return v;
    const n = normAmiga(lugar || '').replace(/^(a|o|na|no|da|do|para|pra) /, ''), A = NPC_VIDA.aventura;
    const pedido = n.length >= 4 && this.cacas.map((x) => x.def).filter((x) => !x.boss && !x.tunel && normAmiga(x.nome).includes(n)).sort((x, y) => (x.nivel || 1) - (y.nivel || 1));
    // o campo pedido no nível dela (o mais forte que ela aguenta); pesado demais: vai no campo dela e avisa
    const cabe = pedido && pedido.filter((x) => (x.nivel || 1) <= (a.prog.nivel | 0) + A.campoAcima - (a.licoes?.acima || 0));
    let c = cabe?.length ? cabe[cabe.length - 1] : null, forte = null;
    if (!c && pedido?.length) { forte = pedido[0].nome; c = this.campoAmiga(a); }
    if (a.ia.fase === 'trabalhar') { a.ia.fase = 'pensar'; a.acao = null; }
    a.ia.conversaAte = this.tempo + 2; a.ia.vir = null;
    a.ia.av = c ? { fase: 'ir', c, coleta: null, ate: this.tempo + (A.cacar[0] + Math.random() * (A.cacar[1] - A.cacar[0])) * this.rotinaAmiga().caca } : { fase: 'escolher' };
    if (!contar(a.prog.mochila, 'pocao')) this.pocoesAmiga(a); // passa na Rosa antes
    a.ia.viagem = null;
    return { ok: true, c, forte };
  },
  // a resposta: r = { assunto } (regras) ou { assunto: ação da IA, fala } (IA). Faz a ação e responde.
  respostaAmiga(id, r) {
    const a = this.amiga, j = this.jogadores.get(id); if (!a || !j || !this.podeAmiga(id) || !r) return;
    if (r.fala) r = { ...r, fala: generoFala(r.fala, this.AMIGA.genero || 'f') }; // a IA às vezes erra ("tô pronto" na Cecília)
    if (r.assunto !== 'time' && this.apeloAmiga(a, j)) r = { ...r, assunto: 'time', fala: '' }; // pediu com jeito depois do não: ela reconsidera
    // livre: passa a acompanhar quem falou; com outro amigo: conversa, mas ação só depois (André 2026-11-10)
    const mesmoTime = !!(a.time && a.time === j.time) && ['time', 'vir'].includes(r.assunto); // no time de todos: "bora pro time" e "vem cá" valem
    if (!this.trocarDonoAmiga(id) && !mesmoTime && ['time', 'pescar', 'minerar', 'lenha', 'pararAtividade', 'sairTime', 'vir', 'sim', 'nao', 'troca', 'presente', 'pedirItem', 'cacar', 'voltar', 'liderar', 'ajudarMissao', 'encomenda', 'pack'].includes(r.assunto)) return this.dizerAmiga(this.comOutroAmiga(), false, id);
    const F = this.AMIGA.chat.falas, FA = this.AMIGA.falas, ia = a.ia, noTime = !!(a.time && a.time === j.time);
    const perto = Math.hypot(a.x - j.x, a.z - j.z) < 6;
    // André 2026-11-17: "vamos fazer alguma coisa, escolhe aí", ela escolhe, e ele "bora pra isso aí mesmo": o que ela
    // sugeriu na fala (sugere da IA) vira um chamado dela, e o "bora" seguinte é aceitar esse chamado
    if (r.sugere && ['time', 'pescar', 'minerar', 'lenha'].includes(r.sugere) && ['conversa', 'nada'].includes(r.assunto) && !(r.sugere === 'time' && noTime)) {
      ia.chamado = { quer: r.sugere, ate: this.tempo + this.AMIGA.chat.chamar.espera, c: r.sugere === 'time' ? this.campoPorNomeAmiga(a, r.lugar) : null };
    }
    const chamado = ia.chamado && ia.chamado.ate > this.tempo ? ia.chamado : null;
    let fala = '';
    // "eu te sigo" / "vai na frente": ela já tinha chamado para pescar/minerar/lenha, é topar isso; no time, ela escolhe o
    // campo e vai na frente (como o botão Seguir); fora do time, escolhe o campo, manda o convite e leva ele (André 2026-11-19)
    if (r.assunto === 'liderar') {
      if (this.AMIGA.atividades[chamado?.quer]) return this.respostaAmiga(id, { ...r, assunto: chamado.quer });
      if (noTime && !a.morto && !j.morto && this.AMIGA.seguivel && this.AMIGA.lidera) { ia.chamado = null; return this.seguirAmiga(id, true, { c: chamado?.c, longe: true }); }
      r = { ...r, assunto: 'time', lidera: true, fala: '' }; // a fala sai daqui, com o lugar que ela escolheu (a da IA podia perguntar "pra onde?")
    }
    switch (r.assunto) {
      case 'time': {
        if (noTime) { fala = sorteia(FA.jaNoTime); break; }
        if (a.morto) { fala = FA.caiu; break; }
        // ela que chamou, já topou ou ele pediu para ir junto na caçada que ela já está fazendo (André 2026-11-17: "posso ir
        // com você? Ela: claro, vem"): aceita sem sorteio
        const cacando = this.AMIGA.convida && ia.av && ['ir', 'cacar'].includes(ia.av.fase) && !ia.av.coleta;
        const pediu = chamado?.quer === 'time' || this.combinouAmiga(a) || cacando || (r.lidera && !!chamado); // "te sigo" depois do chamado dela é topar
        // André 2026-11-17: "se eu pedisse tipo 'por favor, preciso da sua ajuda, é importante' ela reconsiderasse; mas se eu
        // só pedir de novo ela responde igual". Uma vez por recusa: sorteia de novo com bem mais chance (AMIGA.time.apelo)
        if (!pediu && (ia.recusaAte || 0) > this.tempo && this.apeloAmiga(a, j)) {
          const A = this.AMIGA.time.apelo, p = Math.min(A.max, this.vontadeAmiga(a, j).p + A.soma);
          ia.apelou = ia.recusaAte;
          if (this.semIaAmiga(a, j) || Math.random() >= p) { fala = sorteia(FA.apeloNao); break; }
          ia.recusaAte = 0; ia.humor = null;
          if (this.timeCheioAmiga(j)) { fala = FA.recusa.cheio; break; }
          ia.chamado = null; ia.vir = null; ia.plano = null;
          this.combinarAmiga(a); fala = sorteia(FA.apeloSim); break;
        }
        if (!pediu && (ia.recusaAte || 0) > this.tempo) { fala = FA.recusa.jaFalei; break; }
        const v = this.decisaoTimeAmiga(a, j);
        if (!pediu && !v.aceita) { this.recusarTimeAmiga(a, j, v.motivo); fala = FA.recusa[v.motivo] || FA.recusa.vontade; break; }
        // André 2026-11-13 ("como se fosse um jogador real"): pelo chat ela só topa; ele dá o time no botão (conviteTimeAmiga)
        if (this.timeCheioAmiga(j)) { fala = FA.recusa.cheio; break; }
        let campo = chamado?.c || (r.lugar && this.campoPorNomeAmiga(a, r.lugar)) || null;
        if (r.lidera && !campo) campo = this.campoAmiga(a) || this.campoJuntoAmiga(a, j); // "te sigo": ela escolhe para onde
        if (r.lidera && campo && this.fechadoParaAmiga(j, campo)) campo = this.campoJuntoAmiga(a, j);
        ia.chamado = null; ia.vir = null; ia.plano = null;
        this.combinarAmiga(a);
        const mandou = this.convidarTimeAmiga(a, j, campo);
        fala = mandou && r.lidera && campo && FA.liderar ? sorteia(FA.liderar).replace('{lugar}', nomeLugarAmiga(campo.nome)) : mandou ? sorteia(FA.timeConvidou) : sorteia(FA.timeCombinado);
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
          fala = this.convidarTimeAmiga(a, j, null) ? sorteia(FA.timeConvidou) : sorteia(FA.timeCombinado);
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
        // encomenda pronta pra ele: vem sempre, com tempo de atravessar o mapa (André 2026-11-21)
        if (this.encomendaProntaAmiga(a, j)) { this.levarEncomendaAmiga(a, j); fala = 'Tô indo aí levar sua encomenda!'; r = { ...r, fala: '' }; break; }
        const pediu = chamado && chamado.quer !== 'time';
        if (!pediu && !this.soldadoAmiga() && Math.random() >= Math.min(0.95, this.vontadeAmiga(a, j).p + 0.2)) { fala = sorteia(F.naoVir); break; }
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
        if (!a.pedido && Math.random() < this.AMIGA.equipInteresse.pedir && this.pecaFracaAmiga()) { fala = this.pedeEquipAmiga(); r = { ...r, fala: '' }; break; } // às vezes é a peça mais fraca
        // pedido novo agora: a IA não sabia dele e podia pedir outra coisa; vale a fala do jogo (André 2026-11-21, bots sinceros)
        if (!a.pedido && Math.random() < 0.7) { const p = sorteia(this.AMIGA.pedidos); a.pedido = { k: p.k, n: p.n }; this.guardarAmiga(); r = { ...r, fala: '' }; }
        fala = a.pedido ? sorteia(FA.pedido).replace('{item}', `${a.pedido.n} ${ITENS[a.pedido.k].nome.toLowerCase()}`) + ' Me entrega quando passar aqui!' : sorteia(FA.semPedido);
        break;
      case 'casa': { const L = this.loteDaAmiga(), pronta = L && this.AMIGA.casa.every((c) => L.pecas.some((o) => mesmaPeca(o, pecaDaCasa(L.def, c)))); fala = sorteia(pronta ? FA.pronta : FA.obra); break; }
      case 'troca': // "vem aqui que vou trocar" com a encomenda pronta e ela longe: vem até ele
        if (!a.troca && !perto && !a.morto && this.encomendaProntaAmiga(a, j)) { this.levarEncomendaAmiga(a, j); fala = 'Tô indo aí levar sua encomenda!'; r = { ...r, fala: '' }; break; }
        fala = a.troca ? sorteia(this.AMIGA.falasTroca.abre) : sorteia(this.AMIGA.falasTroca.topa); break; // só topa: a troca ele abre (André 2026-11-13)
      case 'presente': case 'pedirItem': { const ult = [...this.chatDeAmiga(j)].reverse().find((c) => c.de === 'ele'); fala = this.pedidoTrocaAmiga(r.assunto, ult?.texto || ''); r = { ...r, fala: '' }; break; }
      case 'equip': fala = this.falaEquipAmiga(); break;
      case 'barco': fala = this.barcoPedidoAmiga(a); r = { ...r, fala: '' }; break; // o que aconteceu de verdade, nunca a fala da IA
      // chat básico (sem IA) com resposta de verdade (André 2026-11-16): nível, onde upar, a missão dele
      case 'nivel': { const S = this.saberAmiga(a, j); fala = `Tô nível ${a.prog.nivel}, de ${S.arma}. E você tá no ${j.prog.nivel}, né?`; break; }
      case 'ondeUpar': { const S = this.saberAmiga(a, j); fala = S.camposDele ? `Pro seu nível: ${S.camposDele.split('; ').slice(0, 2).map((x) => x.replace(/,.*$/, ')')).join(' ou ')}.` : 'Sei não, pergunta na vila!'; break; }
      case 'missao': { const S = this.saberAmiga(a, j); fala = S.missaoDele ? `Sua missão: ${S.missaoDele}.` : 'Acho que você já fez todas, monstro!'; break; }
      case 'missaoDela': fala = this.falaMissaoDelaAmiga(a); break; // André 2026-11-21: a missão e as diárias dela
      case 'ajudarMissao': { // André 2026-11-21: ele se oferece para ajudar na missão dela: ela leva ele até a etapa
        const v = this.ajudaMissaoAmiga(a, j);
        fala = v.fala; r = { ...r, fala: '' }; // a fala sai daqui (a da IA podia não bater com o que ela fez)
        break;
      }
      case 'amigo': { // "me adiciona?" pelo chat: o mesmo pedido de tocar nela (ela decide e avisa)
        this.pedidoAmizadeAmiga(id, true); return;
      }
      case 'pack': { // André 2026-11-21: pega o pack do chão, carrinho, navio, entrega (ouro pra ele), passa ou larga
        const ult = [...this.chatDeAmiga(j)].reverse().find((c) => c.de === 'ele');
        fala = this.packAmiga(a, j, ult?.texto || ''); r = { ...r, fala: '' };
        break;
      }
      case 'encomenda': { // André 2026-11-21: "minera ferro pra mim, eu compro": vai e coleta de verdade, ou diz por que não
        const ult = [...this.chatDeAmiga(j)].reverse().find((c) => c.de === 'ele');
        fala = this.encomendaAmiga(a, j, ult?.texto || ''); r = { ...r, fala: '' };
        break;
      }
      case 'cacar': { // André 2026-11-16: "vai lá caçar sozinha" agora é feito de verdade
        const v = this.sairCacarAmiga(a, j, r.lugar);
        if (!v.ok && v.semVigor) { fala = SEM_VIGOR; r = { ...r, fala: '' }; }
        else if (!v.ok) { fala = v.ja ? 'Já tô caçando, kkk. Depois te conto!' : `Agora não dá, ${v.fala}.`; r = { ...r, fala: v.ja ? r.fala : '' }; }
        else if (v.forte) { fala = `${v.forte} é pesado pra mim ainda, vou na ${v.c?.nome || 'clareira do meu nível'}. Depois te conto!`; r = { ...r, fala: '' }; }
        else fala = v.c ? `Partiu ${v.c.nome}! Depois te conto.` : 'Partiu caçar! Depois te conto como foi.';
        break;
      }
      case 'voltar': { // volta para a vila (ou para casa) e larga a caçada sozinha
        if (noTime) { fala = 'Tô no seu time! Se quiser que eu vá, me tira do time.'; r = { ...r, fala: '' }; break; }
        if (ia.av && ['ir', 'cacar', 'escolher'].includes(ia.av.fase)) { if (a.coleta) this.pararColeta(a, null); if (a.pesca) this.pararPesca(a, null); Object.assign(ia.av, { fase: 'voltar', c: null, coleta: null }); ia.viagem = null; }
        fala = 'Beleza, tô voltando pra vila.';
        break;
      }
      case 'horta': case 'dungeon': fala = sorteia(FA[r.assunto]); break;
      case 'fazendo': { const ag = this.contextoAmiga(id)?.fazendo || 'de boa por aqui'; fala = sorteia(F.fazendo).replace('{agora}', ag).replace('{Agora}', ag[0].toUpperCase() + ag.slice(1)); break; }
      default: fala = sorteia(F[r.assunto] || F.naoEntendi);
    }
    // a IA escreve a fala dela; a ação continua sendo decidida aqui (ela pode recusar mesmo que a IA queira aceitar)
    const recusou = (r.assunto === 'time' && !(a.time && a.time === j.time) && !this.combinouAmiga(a)) || (r.assunto === 'vir' && !ia.vir && !perto && !noTime);
    // a IA já sabia que ia recusar (humor na ficha) e escreveu a recusa do jeito dela: vale a fala dela
    if (r.fala && (!recusou || r.iaAssunto === 'conversa' || r.iaAssunto === 'nao')) fala = r.fala;
    // a IA prometeu fazer (ou disse que fez) algo que o jogo não fez: fala sincera no lugar (André 2026-11-21)
    if (r.fala && fala === r.fala && !ACOES_DE_VERDADE.has(r.assunto)) {
      const ult = [...this.chatDeAmiga(j)].reverse().find((c) => c.de === 'ele');
      if (ult && promessaSemAcaoAmiga(ult.texto, fala)) fala = sorteia(F.naoConsigo || ['Isso eu não consigo fazer por aqui, foi mal.']);
    }
    // o campo que ela ia levar está fechado para ele: avisa (se a IA já não avisou do jeito dela)
    if (ia.avisoFechado) { if (!/liber|n[eé]voa|miss[aã]o|n[aã]o d[aá] pra voc/i.test(fala)) fala = ia.avisoFechado; ia.avisoFechado = null; }
    this.dizerAmiga(fala, false, id);
  },
  // ---------- conversa por opções (André 2026-11-19: "vamos reduzir as expectativas e trabalhar com botões") ----------
  // As opções que fazem sentido agora para quem está falando (DIALOGO em dados.js): [{ id, t }]
  opcoesAmiga(id, menu = 'inicio') {
    const a = this.amiga, j = this.jogadores.get(id); if (!a || !j) return [];
    const D = DIALOGO, noTime = !!(a.time && a.time === j.time), av = a.ia.av, g = this.AMIGA.genero || 'f';
    const ok = { noTime, foraTime: !noTime, atividade: !!a.ia.atividade, pedido: !!a.pedido, semPedido: !a.pedido, caçando: !noTime && !!(av && ['ir', 'cacar', 'escolher'].includes(av.fase)) };
    return (Object.hasOwn(D.menus, menu) ? D.menus[menu] : D.menus.inicio).filter((k) => { const o = D.opcoes[k]; return o && (!o.quando || ok[o.quando]) && !(k === 'seguir' && !this.AMIGA.seguivel); }).map((k) => ({ id: k, t: vozAmiga(D.opcoes[k].t, g) }));
  },
  // abriu a janela (acao 'menu') ou tocou numa opção (acao 'op', m.op, m.menu = o menu que estava na tela). De perto, ou de
  // qualquer lugar se estiver no time dele (tocando no nome no painel do time). A fala dele vai na janela com as próximas opções.
  opcaoAmiga(id, m) {
    const a = this.amiga, j = this.jogadores.get(id), D = DIALOGO, g = this.AMIGA.genero || 'f'; if (!a || !j) return;
    const noTime = () => !!(a.time && a.time === j.time), perto = Math.hypot(a.x - j.x, a.z - j.z) <= 4.5;
    if (!perto && !noTime()) return this.evento({ t: 'aviso', para: id, texto: `Chegue mais perto de ${this.AMIGA.nome}` });
    const manda = (texto, menu, extra = {}) => {
      if (texto) { texto = vozAmiga(texto, g); const c = this.chatDeAmiga(j); c.push({ de: 'ela', texto }); if (c.length > this.histAmiga()) c.shift(); this.registrarAmiga(a, j.conta, 'ela', texto); }
      this.evento({ t: 'fala', para: id, npc: this.AMIGA.id, quem: a.id, texto: texto || '', opcoes: menu ? this.opcoesAmiga(id, menu) : [], menu: menu || '', noTime: noTime(), amizade: this.amizadeAmiga(j), ...extra });
    };
    if (perto) a.ia.conversaAte = this.tempo + this.AMIGA.conversa; // de perto: para e conversa
    if (m.acao === 'menu') return manda(perto ? sorteia(this.AMIGA.falas.oi) : sorteia(D.falas.longe), 'inicio');
    const k = typeof m.op === 'string' && Object.hasOwn(D.opcoes, m.op) ? m.op : '', o = k ? D.opcoes[k] : null, menu = Object.hasOwn(D.menus, m.menu) ? m.menu : 'inicio';
    if (!o || o.app) return;
    if (!this.opcoesAmiga(id, menu).some((x) => x.id === k)) return manda('', menu); // a opção já não vale (saiu do time...): opções novas
    if (o.calado) return manda('', o.menu || menu); // navegar (Voltar, Ordens): sem fala
    this.ouvirAmiga(id, vozAmiga(o.t, g)); // o que ele "falou" fica no histórico e no registro do dia (revisão das 9h)
    let texto = '';
    if (o.menu) texto = sorteia(D.falas[o.menu] || D.falas.comandos);
    else if (o.ordem) {
      if (!noTime()) return manda('Ué, eu nem tô no seu time!', 'inicio');
      a.ia.ordem = o.ordem === 'livre' ? null : { tipo: o.ordem, ate: this.tempo + D.ordemDura };
      texto = sorteia(D.falas[o.ordem]);
    } else if (o.acao) {
      a.ia.capturaFala = [];
      try { this.conversaAmiga(id, { acao: o.acao, deLonge: true }); } finally { texto = a.ia.capturaFala.join(' '); a.ia.capturaFala = null; }
    } else if (o.a) {
      a.ia.captura = [];
      try { this.respostaAmiga(id, { assunto: o.a }); } finally { texto = a.ia.captura.join(' '); a.ia.captura = null; }
    }
    manda(texto || sorteia(this.AMIGA.chat.falas.naoEntendi), o.fecha ? '' : (o.menu || menu), o.fecha ? { fecha: true } : {});
  },
  // ---------- sem IA, desloga (André 2026-11-19: "estourou o limite, eles deslogam. E só voltam a logar quando o limite da IA
  // volta") ----------
  // O servidor marca this.iaAcabouAte (server/ia-amiga.js iaVoltaEm): acabaram o Gemini e o Groq. Os da Chama (Cecília e
  // Dario) dão uma desculpa (AMIGA.desculpas; de saco cheio quando a amizade está baixa ou ela vem de recusa) e saem do jogo
  // como um jogador: somem do mapa e da sala, ficam "fora" na lista. A Geada não tem IA e não sai.
  iaForaAmiga() { return IA_CONVERSA.ligada && IA_CONVERSA.quem.includes(this.AMIGA.id) && (this.iaAcabouAte || 0) > Date.now(); },
  passoLogAmiga() {
    const a = this.amiga;
    if (!a) { // fora: volta quando a IA volta e tem alguém de verdade na sala
      const F = this.amigaFora; if (!F || this.iaForaAmiga() || this.tempo < (F.chk || 0)) return !!F;
      F.chk = this.tempo + 10;
      const gente = [...this.jogadores.values()].filter((o) => !o.bot && !o.criando);
      if (!gente.length) return true;
      this.amigaFora = null;
      const falam = [...(this.amigaFalam || [])].filter((k) => this.jogadores.has(k));
      for (const k of falam.length ? falam : [gente[0].id]) this.amigaEntrar(k, true);
      this.avisarVirtuaisAmiga();
      return true;
    }
    const ia = a.ia;
    if (ia.saindoIa != null) {
      if (this.tempo < ia.saindoIa) return false; // a desculpa ainda está "digitando"
      this.passoChatAmiga(a); // o que ainda estava na fila sai agora
      if (ia.atividade) this.fimAtividadeAmiga(a, true);
      if (a.troca) this.fecharTroca(a.troca, `${this.AMIGA.nome} saiu do jogo`);
      if (a.time) this.sairDoTime(a, `${this.AMIGA.nome} saiu do jogo`);
      this.guardarAmiga();
      this.jogadores.delete(a.id);
      this.amiga = null; this.amigaDono = null;
      this.amigaFora = { t: this.tempo, chk: this.tempo + 30 };
      this.avisarVirtuaisAmiga();
      return true;
    }
    if (!this.iaForaAmiga() || this.tempo < (this.amigaChkIa || 0)) return false;
    // espalha a saída (os dois não saem no mesmo segundo) e não sai no meio de um golpe
    if (!ia.saiEm) ia.saiEm = this.tempo + 3 + Math.random() * 25;
    if (this.tempo < ia.saiEm || (this.emCombate(a) && this.tempo < ia.saiEm + 40)) return false;
    const dono = this.jogadores.get(this.amigaDono), D = this.AMIGA.desculpas || { normal: ["Preciso sair agora. Até mais!"] };
    const cheio = dono && (this.amizadeAmiga(dono) < 2 || (ia.recusaAte || 0) > this.tempo) && Math.random() < 0.6;
    if (dono) {
      if (a.time && a.time === dono.time) ia.viaTime = this.tempo + 30;
      this.dizerAmiga(sorteia(cheio && D.cheio?.length ? D.cheio : D.normal), true, dono.id);
    }
    ia.saindoIa = this.tempo + 4;
    return false;
  },
  // ---------- comando rápido do time (André 2026-11-19, COMANDOS_TIME em dados.js) ----------
  // deId mandou c ('espera' | 'segue' | 'ataca' | 'recua'). Quem está no mesmo time manda; ela obedece e responde no time.
  comandoAmiga(deId, c) {
    const a = this.amiga, de = this.jogadores.get(deId), C = COMANDOS_TIME; if (!a || !de || !Object.hasOwn(C.pedido, c)) return false;
    if (!a.time || a.time !== de.time) { this.dizerAmiga(sorteia(C.falas.fora), false, deId); return false; }
    let fala = C.falas[c];
    if (c === 'segue') { a.ia.ordem = null; a.ia.atividade = null; if (a.coleta) this.pararColeta(a, null); if (a.pesca) this.pararPesca(a, null); }
    else if (c === 'espera') a.ia.ordem = { tipo: 'espera', ate: this.tempo + C.dura.espera, x: a.x, z: a.z };
    else if (c === 'recua') a.ia.ordem = { tipo: 'recua', ate: this.tempo + C.dura.recua };
    else if (c === 'ataca') {
      const b = de.bateuEm && this.tempo - de.bateuEm.t < C.alvo ? de.bateuEm.id : null;
      const e = b != null && this.inimigosDe(a).find((x) => x.id === b && !x.morto);
      if (e) a.ia.ordem = { tipo: 'foco', ate: this.tempo + C.dura.ataca, alvo: e.id }; else fala = C.falas.semAlvo;
    }
    a.ia.viaTime = this.tempo + 30; // a resposta vai para o chat do time
    this.dizerAmiga(sorteia(fala), false, deId);
    return true;
  },
  // ---------- fala sozinho (André 2026-11-19: "um lance quase que de NPC natural"; sem IA) ----------
  // Reage ao que acontece de verdade com as falas prontas (REACOES em dados.js). No time vai para o chat do time; fora
  // dele só os grandes momentos (subiu, caiu, voltou) vão para o privado. Dois NPCs não reagem ao mesmo fato juntos.
  reagirAmiga(a, dono) {
    const R = REACOES, ia = a.ia, t = this.tempo; if (!R || !dono || dono.bot || dono.criando || ia.saindoIa != null || !this.ehAmigoAmiga(dono)) return; // já se despediu: não fala mais nada
    const r = (ia.reage ||= { t: -1e9, ult: {}, id: null, nv: null, meu: null, morto: false, vidaOk: true, vidaMinha: true, noite: null, chk: 0 });
    const noTime = !!(a.time && a.time === dono.time), nv = dono.prog.nivel | 0, meu = a.prog.nivel | 0;
    let ev = null;
    if (r.id !== dono.id) { if (t - (dono.entrouT ?? -1e9) < 90) ev = 'voltou'; r.id = dono.id; r.nv = nv; r.morto = !!dono.morto; } // acabou de entrar (ou relogou)
    if (r.nv != null && nv > r.nv) ev = 'subiu'; r.nv = nv;
    if (r.meu != null && meu > r.meu) ev ||= 'euSubi'; r.meu = meu;
    if (dono.morto && !r.morto) ev = 'caiu'; r.morto = !!dono.morto;
    if (noTime && !ev && t >= r.chk) {
      r.chk = t + 2;
      const baixa = !dono.morto && dono.vida < dono.vidaMax * 0.3; if (baixa && r.vidaOk) ev = 'vidaBaixa'; r.vidaOk = !baixa;
      const minha = a.vida >= a.vidaMax * 0.6; if (minha && !r.vidaMinha && !ev) ev = 'curou'; if (a.vida < a.vidaMax * 0.3) r.vidaMinha = false; else if (minha) r.vidaMinha = true;
      if (!ev && this.outraRaca) for (const o of this.jogadores.values()) if (o !== a && !o.morto && o.guerra && this.outraRaca(a, o) && Math.hypot(o.x - a.x, o.z - a.z) < 40) { ev = 'geada'; break; }
      if (!ev) for (const e of this.inimigos || []) if (!e.morto && !e.treino && (e.tipo === 'chefe' || TIPOS_INIMIGO[e.tipo]?.chefe) && Math.hypot(e.x - a.x, e.z - a.z) < 25) { ev = 'chefe'; break; }
      const noite = ehNoite(horaDoJogo(dono.prog.dia)); if (!ev && r.noite != null && noite !== r.noite) ev = noite ? 'noite' : 'dia'; r.noite = noite;
      if (!ev && t - Math.max(r.t, ia.ultimaFala || 0, a.ia.diario?.[dono.conta]?.ultima || 0) > R.cada.quieto) ev = 'quieto';
    }
    if (!ev || !R.falas[ev]) return;
    if (!['subiu', 'caiu'].includes(ev) && t - r.t < R.entre) return;
    if (t - (r.ult[ev] ?? -1e9) < (R.cada[ev] || 60)) return;
    if (!noTime && !['subiu', 'caiu', 'voltou', 'euSubi'].includes(ev)) return;
    if (ev === 'voltou' && (noTime || this.esperandoAmiga(a, dono) || Math.max(ia.ultimaFala || -1e9, ia.diario?.[dono.conta]?.ultima ?? -1e9) >= (dono.entrouT ?? 0))) return; // já se falaram desde que ele entrou
    const k = `${dono.id}:${ev}`, outro = REAGIU.get(k); // o outro NPC já reagiu a isso agorinha: deixa pra lá
    r.ult[ev] = t;
    if (outro != null && t - outro < 10 && t >= outro) return;
    if (ev === 'voltou' && Math.random() >= (REACOES.sozinha?.chanceVoltou ?? 1)) return; // André 2026-11-22: com 4 por raça, todos mandavam "voltou" no login; agora sorteia (uma vez só por login, r.ult já marcou)
    if (!['subiu', 'caiu'].includes(ev) && !this.vezDeFalarSozinha(dono)) return;
    REAGIU.set(k, t); r.t = t;
    if (noTime) ia.viaTime = t + 30; // no time: a fala vai para o chat do time
    this.dizerAmiga(sorteia(R.falas[ev]).replace('{nome}', dono.nome).replace('{nv}', String(ev === 'euSubi' ? meu : nv)), false, dono.id);
  },
  // manda a mensagem dela no chat privado depois de uns segundos (fila em ia.chatFila)
  dizerAmiga(texto, agora = false, para = null) {
    const a = this.amiga; if (!a || !texto) return;
    para ??= this.amigaDono; texto = vozAmiga(texto, this.AMIGA.genero || 'f');
    if (a.ia.captura) { a.ia.captura.push(texto); return; } // conversa por opções: a resposta vai na janela (opcaoAmiga)
    const [d0, d1] = this.AMIGA.chat.digitando, ultimo = (a.ia.chatFila || []).reduce((m, x) => Math.max(m, x.t), this.tempo);
    (a.ia.chatFila ||= []).push({ t: agora ? this.tempo : ultimo + d0 + Math.random() * (d1 - d0) + Math.min(2, texto.length / 60), texto: String(texto).slice(0, 300), para });
  },
  // a conversa do chat com cada amigo fica separada (a IA lê só a de quem está falando)
  chatDeAmiga(j) { const a = this.amiga, c = (a.ia.conversas ||= {}); return (c[j.conta] ||= (a.conversasSalvas?.[j.conta] || []).slice(-this.histAmiga())); },
  ultimaFalaAmiga(j) { const l = j ? this.chatDeAmiga(j) : []; for (let i = l.length - 1; i >= 0; i--) if (l[i].de === 'ela') return l[i].texto; return ''; },
  histAmiga() { return this.AMIGA.chat.historico || 12; },
  // ---------- registro do dia (André 2026-11-18: "eu vou ficar todo dia jogando conversa fora com o Dário ... e você vai
  // adicionando mais opções de resposta"): a conversa de cima guarda só as últimas falas (o fio da IA); este guarda o dia
  // inteiro, hoje e ontem (horário de Brasília), para a ronda das 9h ler tudo. Não vai para a IA.
  registrarAmiga(a, conta, de, texto, nome) {
    if (!a || conta == null) return;
    const R = this.AMIGA.chat.registro || { max: 600 }, dia = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
    const reg = (a.registro ||= {}); for (const d of Object.keys(reg)) if (d < new Date(Date.now() - 27 * 3600e3).toISOString().slice(0, 10)) delete reg[d];
    const l = ((reg[dia] ||= {})[conta] ||= []); // qual IA escreveu a fala dela (André 2026-11-19: a ronda das 9h ajusta o Gemini primeiro); sem marca = falas prontas
    const F = de === 'ela' && a.ia?.fonte && this.tempo - a.ia.fonte.t < 20 ? a.ia.fonte.ia : ''; if (F) a.ia.fonte = null;
    l.push({ de, texto: String(texto).slice(0, 300), h: new Date(Date.now() - 3 * 3600e3).toISOString().slice(11, 16), ...(nome ? { nome } : {}), ...(F ? { ia: F } : {}) });
    if (l.length > R.max) l.splice(0, l.length - R.max);
  },
  // a conversa recente de cada pessoa vai para o banco junto com ela (voltar ao jogo amanhã: ela lembra do fio)
  conversasParaSalvarAmiga(j) {
    const r = { ...(j.conversasSalvas || {}) }, n = this.histAmiga();
    for (const [k, l] of Object.entries(j.ia?.conversas || {})) if (Array.isArray(l) && l.length) r[k] = l.slice(-n).map((m) => ({ de: m.de, texto: String(m.texto).slice(0, 300), ...(m.nome ? { nome: m.nome } : {}) }));
    j.conversasSalvas = r; return r;
  },
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
      const dados = { amigo: this.AMIGA.id, nomeAmigo: this.AMIGA.nome, genero: this.AMIGA.genero || 'f', conta, nome: d.nome, memoria: [...(a.memorias?.[conta] || [])], fatos: [...(a.fatos?.[conta] || [])], regras: { ...(a.regras?.[conta] || {}) }, conversa: [...((a.ia.conversas || {})[conta] || [])] };
      if (!this.aoDiarioAmiga || !IA_CONVERSA.ligada || (d.id != null && this.jogadores.has(d.id) && !this.iaAmiga(d.id))) { d.pensando = false; continue; } // sem chave: sem IA, sem diário. IA desligada (André 2026-11-18): nunca chama a IA, nem depois que a pessoa sai (revisão 2026-11-19)
      this.aoDiarioAmiga(dados).then((r) => { d.pensando = false; if (r) this.anotarAmiga(conta, r); }, () => { d.pensando = false; });
    }
  },
  // r = { memorias: [texto], regras: { curaCedo: true } } (da IA): troca a lista dela sobre a pessoa e as dicas
  anotarAmiga(conta, r) {
    const M = this.AMIGA.memoria, L = this.loteDaAmiga(), a = this.amiga || L?.amiga; if (!a || !r) return; // ela já saiu da sala: grava no terreno
    if (Array.isArray(r.memorias)) {
      const lista = r.memorias.filter(lembrancaBoa).map((t) => t.replace(/\s+/g, ' ').trim().slice(0, M.tamanho)).slice(0, M.max);
      if (lista.length) (a.memorias ||= {})[conta] = lista;
    }
    // fatos novos (André 2026-11-17): só somam; o mesmo fato (sem acento e caixa) não entra de novo; cheio sai o mais velho
    if (Array.isArray(r.fatos)) {
      const F = this.AMIGA.fatos, l = ((a.fatos ||= {})[conta] ||= []), chave = (t) => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
      const tem = new Set(l.map(chave));
      for (const t of r.fatos) { if (typeof t !== 'string') continue; const f = t.replace(/\s+/g, ' ').trim().slice(0, F.tamanho), k = chave(f); if (k.length < 4 || tem.has(k)) continue;
        // André 2026-11-17 (ronda): "ele está na missão desgrama" (gíria virou missão): fato de missão só com nome de missão de verdade
        if (/miss[aã]o|quest/i.test(f) && !HISTORIA.some((M) => k.includes(chave(M.nome)))) continue; tem.add(k); l.push(f); }
      if (l.length > F.max) l.splice(0, l.length - F.max);
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
    const c = this.chatDeAmiga(j); c.push({ de: 'ele', texto: String(texto).slice(0, 200) }); if (c.length > this.histAmiga()) c.shift();
    this.registrarAmiga(a, j.conta, 'ele', texto);
    const d = ((a.ia.diario ||= {})[j.conta] ||= { novas: 0, ultima: 0, id }); d.novas++; d.falas = (d.falas | 0) + 1; d.ultima = this.tempo; d.id = id; d.nome = j.nome;
    if (a.ia.espera) delete a.ia.espera[j.conta]; // ele respondeu: ela volta a puxar assunto quando quiser
  },
  // ---------- não insistir (André 2026-11-17: "Oi, vamos caçar, se eu não responder ela não manda mais mensagem até eu
  // falar com ela ou relogar; quando eu voltar, desculpa tava ocupado, ela continua normal") ----------
  // ia.espera[conta] = { id, t }: ela puxou conversa com essa pessoa e ainda não veio resposta. Relogar troca o id da
  // sessão e libera. Só quem tem AMIGA.naoInsiste (a Cecília); o Dario segue como antes.
  esperandoAmiga(a, j) {
    if (!this.AMIGA.naoInsiste || !a || !j) return false;
    const e = a.ia.espera?.[j.conta]; if (!e) return false;
    if (e.id !== j.id) { delete a.ia.espera[j.conta]; return false; } // relogou
    return true;
  },
  puxouAmiga(a, j) { if (this.AMIGA.naoInsiste && a && j) (a.ia.espera ||= {})[j.conta] = { id: j.id, t: this.tempo }; },
  passoChatAmiga(a) {
    const ia = a.ia, dono = this.jogadores.get(this.amigaDono); if (!dono) return;
    // as respostas na hora certa
    while (ia.chatFila?.length && ia.chatFila[0].t <= this.tempo) {
      const { texto, para } = ia.chatFila.shift(), quem = this.jogadores.get(para ?? this.amigaDono); if (!quem) continue;
      // falaram com ela no chat de time (André 2026-11-11): a resposta vai para o time todo, não para o privado
      const T = ia.viaTime > this.tempo && a.time && quem.time === a.time ? a.time : null;
      const msg = T ? { canal: 'time', c: this.AMIGA.conta, nome: this.AMIGA.nome, texto, hora: Date.now(), membros: this.contasDoTime(T) } : { canal: 'pm', c: this.AMIGA.conta, nome: this.AMIGA.nome, texto, hora: Date.now(), alvo: quem.conta, alvoNome: quem.nome };
      ia.ultimaFala = this.tempo;
      const c = this.chatDeAmiga(quem); c.push({ de: 'ela', texto }); if (c.length > this.histAmiga()) c.shift();
      this.registrarAmiga(a, quem.conta, 'ela', texto);
      // no time, os outros NPCs leem o que ela disse (André 2026-11-13: cada um respondia sem saber do outro)
      if (T) for (const x of this.amigosIa) if (x !== this && x.amiga && x.amiga.time === T && x.podeAmiga(quem.id)) { const h = x.chatDeAmiga(quem); h.push({ de: 'outro', nome: this.AMIGA.nome, texto }); if (h.length > x.histAmiga()) h.shift(); }
      if (this.aoChatAmiga) this.aoChatAmiga(msg); else this.receberChat(msg);
    }
    if (NPC_SOLDADO.ligado) return; // soldado não puxa assunto, não chama e não reage sozinho (André 2026-11-22)
    this.reagirAmiga(a, dono); // fala sozinho com as falas prontas (André 2026-11-19, sem IA)
    if (this.esperandoAmiga(a, dono)) return; // puxou conversa e ele não respondeu: fica quieta (naoInsiste)
    if (this.puxarAssuntoAmiga(a, dono)) return;
    // ela chama o André de vez em quando (longe, fora do time, viva, sem conversa esperando)
    const C = this.AMIGA.chat.chamar, sorte = ([x, y]) => x + Math.random() * (y - x);
    if (ia.chamaEm == null) ia.chamaEm = this.tempo + sorte(C.primeiro);
    if (this.tempo < ia.chamaEm) return;
    ia.chamaEm = this.tempo + sorte(C.entre);
    if (!this.ehAmigoAmiga(dono)) return; // só chama quem é amigo dela de verdade (André 2026-11-16)
    if (a.morto || a.time || ia.vir || (ia.chamado && ia.chamado.ate > this.tempo) || Math.hypot(a.x - dono.x, a.z - dono.z) < C.longe) return;
    if (dono.morto || dono.criando) return;
    if (!this.vezDeFalarSozinha(dono)) return; // outro NPC falou há pouco (André 2026-11-22)
    const g = this.gostoTopoAmiga(dono), M = this.AMIGA.memoria;
    // André 2026-11-17 ("mais variado"): nunca a mesma chamada duas vezes seguidas
    // ronda 2026-11-18: o servidor reinicia com cada atualização e ia.ultimaChama se perdia; ela mandava "Bora caçar de novo?"
    // duas vezes seguidas. Com naoInsiste (a Cecília), a última fala dela no chat com ele também conta
    if (this.AMIGA.naoInsiste && !ia.ultimaChama) ia.ultimaChama = this.ultimaFalaAmiga(dono);
    const lista = this.AMIGA.chat.falas.chama, livres = lista.length > 1 ? lista.filter((x) => x.texto !== ia.ultimaChama) : lista;
    const ch = g && Math.random() < M.gostoChance && this.AMIGA.chat.falas.chamaGosto[g] !== ia.ultimaChama ? { texto: this.AMIGA.chat.falas.chamaGosto[g], quer: g } : sorteia(livres); // o que vocês mais fazem juntos
    ia.chamado = { quer: ch.quer, ate: this.tempo + C.espera }; ia.ultimaChama = ch.texto;
    this.dizerAmiga(ch.texto, true);
    this.puxouAmiga(a, dono);
  },
  // ---------- a IA de quem conversa acabou no dia (André 2026-11-17: "ela dizer que não tá mais a fim no momento, que vai
  // descansar, que já jogou demais... pode continuar jogando solo, mas não aceita mais jogar comigo, só diz que tá meio ocupada")
  // Fica chat.semIa s (tempo de verdade) assim com essa pessoa: a primeira vez avisa; depois responde "tô ocupada" e recusa o time.
  // a última mensagem dele é um pedido sincero ("por favor", "preciso muito", "é importante") e ela recusou há pouco (e
  // ainda não reconsiderou essa recusa)
  apeloAmiga(a, j) {
    if (!a || !j || !((a.ia.recusaAte || 0) > this.tempo) || a.ia.apelou === a.ia.recusaAte || (a.ia.humor && a.ia.humor.conta !== j.conta)) return false;
    const ult = [...this.chatDeAmiga(j)].reverse().find((m) => m.de === 'ele'); if (!ult) return false;
    const t = ' ' + normAmiga(ult.texto) + ' ';
    return this.AMIGA.time.apelo.palavras.some((w) => t.includes(' ' + w + ' '));
  },
  semIaAmiga(a, j) { const t = a?.semIa?.[j?.conta]; return !!t && Date.now() < t; },
  cansouIaAmiga(id, regra = 'conversa') {
    const a = this.amiga, j = this.jogadores.get(id); if (!a || !j) return;
    if (regra === 'barco') return this.respostaAmiga(id, { assunto: 'barco' }); // o barquinho sai mesmo sem a IA (André 2026-11-21)
    const FA = this.AMIGA.falas, ja = this.semIaAmiga(a, j);
    if (!ja) (a.semIa ||= {})[j.conta] = Date.now() + (this.AMIGA.chat.semIa || 10800) * 1000;
    const pedido = ['time', 'vir', 'pescar', 'minerar', 'lenha', 'troca', 'cacar', 'sim'].includes(regra);
    this.dizerAmiga(!ja ? sorteia(FA.cansouIa) : pedido ? FA.recusa.ocupada : sorteia(FA.ocupadaIa), false, id);
  },
  // ---------- ela puxa assunto pela IA (André 2026-11-17: "ela mesmo reclamar de coisas, perguntar coisas pessoais pra mim
  // no meio da conversa"; "não quero que ela fique me pentelhando toda hora") ----------
  // Só a Cecília (AMIGA.puxaAssunto), só com quem tem a IA e é amigo dela, sem ninguém falar há chat.puxar.quieto s, e no
  // máximo uma vez a cada chat.puxar.entre s. Depois de ele subir de nível ou cair, comenta disso (evento). true = puxou.
  // André 2026-11-22 ("agora com 4 tá ficando chato qd eu logo todo mundo me mandando msg aleatória"): espera global entre as
  // falas por conta própria (voltou, puxar assunto, chamar) de TODOS os NPCs para o mesmo jogador. REACOES.sozinha.global s.
  vezDeFalarSozinha(dono, gravar = true) {
    const G = REACOES.sozinha?.global ?? 0, t = this.tempo, u = FALOU_SOZINHA.get(dono.id);
    if (u != null && t >= u && t - u < G) return false;
    if (gravar) FALOU_SOZINHA.set(dono.id, t);
    return true;
  },
  puxarAssuntoAmiga(a, dono) {
    const P = this.AMIGA.chat.puxar, ia = a.ia; if (!this.AMIGA.puxaAssunto || !P || !this.aoPuxarAmiga || this.esperandoAmiga(a, dono)) return false;
    if (!this.iaAmiga(dono.id) || !this.ehAmigoAmiga(dono) || dono.criando || this.semIaAmiga(a, dono)) return false;
    const sorte = ([x, y]) => x + Math.random() * (y - x), nv = dono.prog.nivel | 0;
    // o que aconteceu com ele (vira assunto)
    if (ia.nivelVisto != null && nv > ia.nivelVisto) ia.evento = { txt: `${dono.nome} acabou de subir para o nível ${nv}`, t: this.tempo + sorte(P.evento) };
    ia.nivelVisto = nv;
    if (dono.morto && !ia.viuMorto) ia.evento = { txt: `${dono.nome} acabou de morrer${dono.matouNome ? ` para ${dono.matouNome}` : ''}`, t: this.tempo + sorte(P.evento) };
    ia.viuMorto = !!dono.morto;
    if (ia.puxaEm == null) ia.puxaEm = this.tempo + sorte(P.entre) * 0.5;
    if (ia.pensandoPuxar || ia.chatFila?.length) return false;
    const d = a.ia.diario?.[dono.conta], quieto = this.tempo - Math.max(d?.ultima || 0, ia.ultimaFala || 0);
    const ev = ia.evento && this.tempo >= ia.evento.t && this.tempo - (ia.puxou || -1e9) >= P.eventoMin ? ia.evento : null;
    if (ia.evento && this.tempo - ia.evento.t > 600) ia.evento = null; // velho: perdeu a graça
    if (!ev && (this.tempo < ia.puxaEm || quieto < P.quieto)) return false;
    if (!this.vezDeFalarSozinha(dono)) { ia.puxaEm = this.tempo + 60; return false; } // outro NPC falou há pouco: tenta de novo daqui a 1 min
    ia.evento = null; ia.puxou = this.tempo; ia.puxaEm = this.tempo + sorte(P.entre);
    ia.chamaEm = Math.max(ia.chamaEm || 0, this.tempo + 600); // a chamada pronta não vem logo atrás
    ia.pensandoPuxar = true;
    this.puxouAmiga(a, dono); // agora espera ele responder (naoInsiste)
    Promise.resolve(this.aoPuxarAmiga(dono.id, ev?.txt || null, this)).finally(() => { ia.pensandoPuxar = false; });
    return true;
  },
  // indo até o André: perto anda/corre; longe vem de lobo pela estrada (longeAmiga), como no time
  virAmiga(j, dono, dt) {
    const ia = j.ia, v = ia.vir, d = Math.hypot(dono.x - j.x, dono.z - j.z);
    if (this.tempo > v.ate || dono.morto) { ia.vir = null; ia.viagem = null; j.montado = null; this.pararAmiga(j); ia.fase = 'pensar'; return false; }
    if (d < 2.8) {
      ia.vir = null; this.pararAmiga(j); ia.fase = 'pensar'; ia.viu = true;
      ia.conversaAte = this.tempo + this.AMIGA.conversa; j.ry = Math.atan2(dono.x - j.x, dono.z - j.z);
      const enc = this.encomendaProntaAmiga(j, dono);
      if (enc) { ia.conversaAte = this.tempo + 20; this.dizerAmiga(this.falaEncAmiga(sorteia(ENCOMENDA.falas.chegou), enc, j)); return true; } // trouxe a encomenda: espera ele abrir a troca
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
    return Object.entries(e).filter(([, it]) => it).map(([, it]) => nomeDoItem(it)).join(', '); // com o cajado: ela usa os dois (André 2026-11-18)
  },
  // a peça mais fraca dela (que ainda dá para melhorar): { l, it }
  pecaFracaAmiga() {
    const e = this.amiga?.prog.equip || {}; let f = null;
    for (const [l, it] of Object.entries(e)) if (it && (it.r | 0) < this.AMIGA.equipInteresse.rarMax && (!f || this.notaEquipAmiga(it) < this.notaEquipAmiga(f.it))) f = { l, it };
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
    return Object.hasOwn(p.equip, l) && reforcoOk(it, p.atr) && this.notaEquipAmiga(it) > this.notaEquipAmiga(p.equip[l]);
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
      if (!Object.hasOwn(p.equip, l) || !reforcoOk(it, p.atr)) continue;
      if (nota(it) > nota(p.equip[l])) this.item(j.id, { acao: 'equipar', i }); // a peça velha volta pra mochila e é vendida abaixo
    }
    const enc = j.ia?.encomenda, daEnc = (it) => enc && (enc.item === 'peixe' ? ITENS[it.k]?.peixe : it.k === enc.item); // encomenda: não vende
    // André 2026-11-21 (bots no leilão, shared/leilao-bots.js): antes da loja, olha o leilão (na hora dele) e guarda o que
    // vale anunciar (peça Rara+, Tomo, material) enquanto houver espaço na mochila
    this.leilaoTalvezAmiga?.(j);
    const livresL = p.mochila.filter((o) => !o).length;
    const guarda = (it) => daEnc(it) || it.cad || it.k === 'pocao' || it.k.startsWith('semente_') || this.AMIGA.plantas.includes(it.k) || this.AMIGA.pedidos.some((o) => o.k === it.k) || ITENS[it.k].comida || !!this.guardaLeilaoAmiga?.(j, it, livresL);
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
    const enc = this.encomendaProntaAmiga(a, dono); // a encomenda dele vai pra mesa (André 2026-11-21)
    if (enc) {
      let falta = Math.min(enc.tem, contarRec(a.prog.mochila, enc.item));
      for (let i = 0; i < a.prog.mochila.length && falta > 0; i++) {
        const o = a.prog.mochila[i]; if (!o || o.cad || !(enc.item === 'peixe' ? ITENS[o.k]?.peixe : o.k === enc.item)) continue;
        const n = Math.min(falta, o.n || 1); this.troca(a.id, { acao: 'por', i, n }); falta -= n;
      }
      this.falarAmiga(this.falaEncAmiga(ENCOMENDA.falas.naMesa, enc, a));
    }
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
    const ouro = ia.trocaPresente || this.soldadoAmiga() ? 0 : Math.max(0, Math.min(a.prog.ouro, Math.floor(traz - pede)));
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
    if (a.ia.encomenda?.pronta && quem && a.ia.encomenda.conta === quem.conta && eu.itens.length) a.ia.encomenda = null; // entregue
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
  // soldado com o líder (André 2026-11-22: "ele n cobra mais, é só vigor mesmo"): não cobra nada; a semana do clã já paga
  margemAmiga(a) { if (this.soldadoAmiga()) return 0; return Math.max(this.AMIGA.troca.margemMin, this.AMIGA.troca.margem - (a.amizade | 0) * this.AMIGA.troca.porAmizade); },
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
    else if (dele && this.soldadoAmiga()) texto = 'Soldado do clã: tudo de graça, ninguém paga nada.';
    else if (!pede && this.soldadoAmiga() && eu.itens.length) texto = 'Soldado do clã: de graça.';
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
  // ---------- pack com o bot (André 2026-11-21: "pega pack pra mim... abastecer o navio/carrinho ou levar nas costas") ----------
  // O pedido: confere de verdade e marca a tarefa (o passoPackAmiga anda até lá e faz). Só na pt dele. Devolve a fala.
  packAmiga(a, j, texto) {
    const P = PACK_BOT, F = P.falas, t = ' ' + normAmiga(texto) + ' ', tem = (k) => P.palavras[k].some((w) => t.includes(' ' + normAmiga(w) + ' '));
    const nomePack = (pk) => (PACKS[pk?.k]?.nome || 'pack').toLowerCase();
    if (tem('fazer') && !tem('carrinho') && !tem('navio')) return F.naoFaco; // honesto: o bot não faz pack
    if (!(a.time && a.time === j.time)) return F.semPt;
    if (a.morto) return this.AMIGA.falas.caiu;
    const pk = a.prog.pack, nova = (tipo, extra = {}) => { a.ia.packTarefa = { tipo, para: j.id, conta: j.conta, ate: this.tempo + P.tempo, ...extra }; };
    if (tem('largar')) {
      if (!pk) return F.semPack;
      this.packNoChao(pk, a.x - Math.sin(a.ry) * 0.7, a.z - Math.cos(a.ry) * 0.7); a.prog.pack = null; a.ia.packDe = null; a.ia.packTarefa = null; a.progSujo = true;
      return F.largou;
    }
    if (tem('dar')) {
      if (!pk) return F.semPack;
      if (j.prog.pack) return F.costasCheias;
      nova('dar'); return F.indoDar;
    }
    if (tem('carrinho')) {
      if (!pk) return F.semPack;
      const c = j.prog.carrinho, onde = c && !c.quebrado && (j.veiculo === 'carrinho' || c.chao);
      if (!onde) return F.semCarrinho;
      if (c.packs.length >= capacidadeCarrinho(c)) return F.carrinhoCheio.replace('{n}', c.packs.length).replace('{cap}', capacidadeCarrinho(c));
      nova('carrinho'); return F.indoCarrinho;
    }
    if (tem('navio')) {
      if (!pk) return F.semPack;
      const n = j.prog.navio; if (!n || !(j.veiculo === 'navio' || n.chao)) return F.semNavio;
      if ((n.porao || []).length >= VEICULOS.navio.porao) return F.naviocheio;
      nova('navio'); return F.indoNavio;
    }
    if (tem('entregar')) {
      if (!pk) return F.semPack;
      let m = null, md = 40;
      for (const o of this.mapa.npcs || []) if (o.funcao === 'pack') { const d = Math.hypot(o.x - j.x, o.z - j.z); if (d < md) { md = d; m = o; } }
      if (!m) return F.semMercador;
      if (Math.hypot(m.x - pk.ox, m.z - pk.oz) < PACK_REGRAS.perto) return F.feitoAqui;
      const dm = this.packDaMissao(j, pk.k, m.id); if (dm) return F.daMissao.replace('{npc}', this.nomeNpc ? this.nomeNpc(dm) : dm);
      nova('entregar', { npc: m.id }); return F.indoEntregar.replace('{npc}', nomeLugarAmiga(String(m.nome || '').replace(/, mercador$/, '')));
    }
    // "pega o pack", "carrega o pack", "leva o pack": do chão perto dele
    if (pk) return F.oQue.replace('{pack}', nomePack(pk));
    let g = null, gd = P.raio;
    for (const o of this.packsChao || []) { if (!this.podePegarPack(j, o)) continue; const d = Math.hypot(o.x - j.x, o.z - j.z); if (d < gd) { gd = d; g = o; } }
    if (!g) return F.semChao;
    nova('pegar', { g: g.g }); return F.indoPegar;
  },
  // anda até o alvo da tarefa e faz de verdade; true = cuidou do passo
  passoPackAmiga(j, dt) {
    const ia = j.ia, T = ia.packTarefa, F = PACK_BOT.falas, dono = this.jogadores.get(T.para);
    const fim = (fala) => { ia.packTarefa = null; this.pararAmiga(j); if (fala) this.dizerAmiga(fala, false, T.para); return true; };
    if (!dono || dono.conta !== T.conta || j.morto) { ia.packTarefa = null; return false; }
    if (j.trava > 0) { this.pararAmiga(j); return true; }
    let alvo = null, alcance = 2;
    if (T.tipo === 'pegar') { const g = (this.packsChao || []).find((o) => o.g === T.g && this.podePegarPack(j, o)); if (!g) return fim(F.sumiu); alvo = g; alcance = PACK_REGRAS.pegar; }
    else if (!j.prog.pack) return fim(F.semPack);
    else if (T.tipo === 'carrinho') { const c = dono.prog.carrinho; alvo = c && !c.quebrado ? (dono.veiculo === 'carrinho' ? dono : c.chao) : null; alcance = VEICULOS.carrinho.carregar - 1; if (!alvo) return fim(F.semCarrinho); }
    else if (T.tipo === 'navio') { const n = dono.prog.navio; alvo = n ? (dono.veiculo === 'navio' ? dono : n.chao) : null; alcance = VEICULOS.navio.perto - 1; if (!alvo) return fim(F.semNavio); }
    else if (T.tipo === 'entregar') { alvo = (this.mapa.npcs || []).find((o) => o.id === T.npc); alcance = PACK_REGRAS.falar - 0.5; }
    else if (T.tipo === 'dar') { alvo = dono; alcance = 2.5; }
    if (!alvo) return fim('');
    const d = Math.hypot(alvo.x - j.x, alvo.z - j.z);
    if (d > alcance) {
      if (this.tempo > T.ate) return fim(T.tipo === 'pegar' ? F.naoChegueiPegar : F.naoCheguei.replace('{onde}', { carrinho: 'no carrinho', navio: 'perto do navio', entregar: 'no mercador', dar: 'perto de você' }[T.tipo]));
      j.montado = null; this.irDireto(j, alvo.x, alvo.z, d > 5 && T.tipo === 'pegar'); return true;
    }
    const p = j.prog, nomePack = (pk) => (PACKS[pk?.k]?.nome || 'pack').toLowerCase();
    if (T.tipo === 'pegar') {
      if (p.pack) return fim(F.jaTenho);
      const g = this.packsChao.find((o) => o.g === T.g); this.packsChao.splice(this.packsChao.indexOf(g), 1);
      p.pack = packValido(g); j.montado = null; ia.packDe = T.conta; j.progSujo = true;
      return fim(F.pegou.replace('{pack}', nomePack(p.pack)));
    }
    if (T.tipo === 'carrinho') {
      const c = dono.prog.carrinho, cap = capacidadeCarrinho(c);
      if (c.packs.length >= cap) return fim(F.carrinhoCheio.replace('{n}', c.packs.length).replace('{cap}', cap));
      c.packs.push(p.pack); p.pack = null; ia.packDe = null; j.progSujo = true; dono.progSujo = true; this.avisarProg(dono);
      return fim(F.noCarrinho.replace('{n}', c.packs.length).replace('{cap}', cap));
    }
    if (T.tipo === 'navio') {
      const n = dono.prog.navio, cap = VEICULOS.navio.porao; n.porao ||= [];
      if (n.porao.length >= cap) return fim(F.naviocheio);
      n.porao.push(p.pack); p.pack = null; ia.packDe = null; j.progSujo = true; dono.progSujo = true; this.avisarProg(dono);
      return fim(F.noNavio.replace('{n}', n.porao.length).replace('{cap}', cap));
    }
    if (T.tipo === 'dar') {
      if (dono.prog.pack) return fim(F.costasCheias);
      dono.prog.pack = p.pack; dono.montado = null; p.pack = null; ia.packDe = null; j.progSujo = true; dono.progSujo = true; this.avisarProg(dono);
      return fim(F.deu);
    }
    if (T.tipo === 'entregar') { // o pack é dele: preço, mercado, pontos de Mercador e missão contam pra ele
      const n = alvo, pk = p.pack, dp = dono.prog, agora = Date.now();
      if (Math.hypot(n.x - pk.ox, n.z - pk.oz) < PACK_REGRAS.perto) return fim(F.feitoAqui);
      const k = mercadoK(dp, n.id, pk.k, agora), preco = Math.max(1, Math.round(precoPack(pk, n, dp.prof.mer) * k * (1 + (this.vantagensDe?.(dono).pack || 0))));
      p.pack = null; ia.packDe = null; j.progSujo = true;
      mercadoConta(dp, n.id, pk.k, agora);
      dp.ouro = (dp.ouro || 0) + preco; this.caixa?.(dono, 'pack', preco);
      this.pontosProf(dono, 'mer', preco / 10);
      this.evento({ t: 'pack', para: dono.id, acao: 'entregou', k: pk.k, ouro: preco, navio: (pk.nav || 0) >= PACK_REGRAS.navioMin });
      this.historia(dono, 'pack', { k: pk.k, npc: n.id, de: 'costas' });
      dono.progSujo = true; this.avisarProg(dono);
      return fim(F.entregou.replace('{ouro}', preco));
    }
    return fim('');
  },
  // ---------- encomenda pelo chat (André 2026-11-21: "minera um pouco de ferro pra mim, eu compro") ----------
  // o lugar com o recurso mais perto DELA (mesmo longe dele), fora de região que a história dela ainda não abriu
  lugarRecursoAmiga(j, R, menos = null) {
    let melhor = null, md = Infinity;
    const ok = (x, z) => !(menos && Math.hypot(x - menos.x, z - menos.z) < 12) && !(j.semTeto && zonaFechadaEm(j.prog, x, z));
    if (R.coleta === 'pescar') { for (const v of this.spots || []) if (v.ativo && ok(v.x, v.z)) { const d = Math.hypot(v.x - j.x, v.z - j.z); if (d < md) { md = d; melhor = { id: v.id, x: v.x, z: v.z, y: 0 }; } } return melhor; }
    for (const no of this.coletaveis.values()) {
      if (no.tipo !== R.no || this.cargas(j, no) <= 0 || !ok(no.x, no.z)) continue;
      const d = Math.hypot(no.x - j.x, no.z - j.z); if (d < md) { md = d; melhor = { id: no.id, x: no.x, z: no.z, y: no.y ?? null }; }
    }
    return melhor;
  },
  // nome de verdade do lugar: a mina, o campo de caça perto, ou a distância
  ondeFicaAmiga(a, c) {
    const no = this.coletaveis.get(c.id), mina = no?.mina && MINA.find((m) => m.id === no.mina);
    if (mina?.nome) return `no ${nomeLugarAmiga(mina.nome)}`;
    let perto = null, md = 70;
    for (const k of this.cacas || []) { const d = k.def; if (d?.nome && !d.boss && !d.tunel && Math.hypot(d.x - c.x, d.z - c.z) < md) { md = Math.hypot(d.x - c.x, d.z - c.z); perto = d.nome; } }
    if (perto) return `perto de ${nomeLugarAmiga(perto)}`;
    return `num lugar a ${Math.round(Math.hypot(c.x - a.x, c.z - a.z))} m daqui`;
  },
  falaEncAmiga(f, enc, j, extra = {}) {
    const R = ENCOMENDA.recursos[enc.rec], v = { n: enc.n, tem: enc.tem ?? Math.max(0, contarRec(j.prog.mochila, enc.item) - enc.base), item: R.nome, lugar: enc.lugar || 'lá', coleta: this.AMIGA.atividades[R.coleta]?.nome || R.coleta, ...extra };
    return String(f).replace(/\{(\w+)\}/g, (m, k) => (v[k] ?? m));
  },
  // a encomenda pronta para esse jogador (null se não tem)
  encomendaProntaAmiga(a, j) { const e = a?.ia?.encomenda; return e && e.pronta && j && e.conta === j.conta && e.tem > 0 ? e : null; },
  levarEncomendaAmiga(a, j) {
    if (a.ia.av && ['ir', 'cacar', 'escolher'].includes(a.ia.av.fase)) { if (a.coleta) this.pararColeta(a, null); if (a.pesca) this.pararPesca(a, null); Object.assign(a.ia.av, { fase: 'voltar', c: null, coleta: null }); }
    a.ia.vir = { ate: this.tempo + ENCOMENDA.vir, longe: this.tempo + 4 }; a.ia.chamado = null; a.ia.conversaAte = 0; a.ia.viagem = null;
  },
  // pediu pelo chat: confere tudo de verdade; se dá, sai agora para o lugar mais perto dela. Devolve a fala (sincera)
  encomendaAmiga(a, j, texto) {
    const E = ENCOMENDA, F = E.falas, ia = a.ia;
    let pedido = encomendaDoTexto(texto);
    const pq = ia.encPergunta && ia.encPergunta.ate > this.tempo && ia.encPergunta.conta === j.conta ? ia.encPergunta : null;
    ia.encPergunta = null;
    if (pq) { const r = respostaEncomenda(texto) || {}; pedido = { rec: pedido?.rec || r.rec || pq.rec, n: pedido?.n || r.n || pq.n || 0 }; }
    pedido ||= { rec: '', n: 0 };
    const pergunta = (f) => { ia.encPergunta = { rec: pedido.rec, n: pedido.n, conta: j.conta, ate: this.tempo + E.pergunta }; return f; };
    const atual = ia.encomenda;
    if (atual && atual.conta === j.conta && !atual.pronta && ia.av?.encomenda) return this.falaEncAmiga(sorteia(F.progresso), atual, a);
    if (atual && this.encomendaProntaAmiga(a, j)) return this.falaEncAmiga(sorteia(F.pronta), atual, a);
    if (!pedido.rec) return pergunta(F.qual);
    const R = E.recursos[pedido.rec], Ativ = this.AMIGA.atividades[R.coleta], base = { rec: pedido.rec, n: pedido.n, item: R.item };
    const diz = (f, x = {}) => this.falaEncAmiga(f, { ...base, tem: 0 }, a, x);
    if (a.morto) return F.caiu;
    if (!this.soldadoAmiga() && !naHoraDe(this.rotinaAmiga(), horaDoJogo(a.prog.dia))) return F.hora;
    if (contar(a.prog.mochila, Ativ.ferramenta) <= 0) return diz(F.semFerramenta, { ferramenta: ITENS[Ativ.ferramenta]?.nome.toLowerCase() || Ativ.ferramenta });
    const K = R.no && COLETA[R.no];
    if (K && profNivel(a.prog.prof[K.prof]) < (K.nivel || 1)) return diz(F.nivel, { prof: PROFISSOES[K.prof]?.nome || K.prof, nivel: K.nivel, meu: profNivel(a.prog.prof[K.prof]) });
    if (vigorAgora(a.prog.vigor) < 1) return this.soldadoAmiga() ? SEM_VIGOR : diz(F.vigor);
    if (a.prog.mochila.filter((o) => !o).length < NPC_VIDA.aventura.mochilaLivre) return F.mochila;
    const c = this.lugarRecursoAmiga(a, R);
    if (!c) return diz(F.semLugar);
    if (!pedido.n) return pergunta(this.falaEncAmiga(sorteia(F.quantos), { ...base, n: E.max }, a)); // André: "ela pergunta quantos"
    const naPt = !!(a.time && a.time === j.time); // na pt dele: vai sozinh@ e volta pra ele (André 2026-11-21)

    if (a.ia.fase === 'trabalhar') { a.ia.fase = 'pensar'; a.acao = null; }
    if (ia.atividade) this.fimAtividadeAmiga(a, true);
    if (a.coleta) this.pararColeta(a, null); if (a.pesca) this.pararPesca(a, null);
    ia.encomenda = { ...base, base: contarRec(a.prog.mochila, R.item), conta: j.conta, pronta: false, naPt, lugar: this.ondeFicaAmiga(a, c) };
    ia.av = { fase: 'ir', c, coleta: R.coleta, noTipo: R.no, encomenda: true, ate: this.tempo + E.tempo };
    ia.viagem = null; ia.vir = null; ia.alvoColeta = null; ia.conversaAte = this.tempo + 2;
    return this.falaEncAmiga(sorteia(naPt ? F.aceitaPt : F.aceita), ia.encomenda, a);
  },
  // acabou (juntou tudo ou parou): separa o que pegou e avisa ele, se estiver na sala
  fimEncomendaAmiga(j, motivo) {
    const enc = j.ia.encomenda; if (!enc || enc.pronta) return;
    enc.tem = Math.min(enc.n, Math.max(0, contarRec(j.prog.mochila, enc.item) - enc.base)); enc.pronta = true;
    const F = ENCOMENDA.falas, m = F.motivos[motivo] || '';
    const pt = !!j.time; // na pt: volta seguindo ele, e a troca é ali do lado
    const fala = enc.tem >= enc.n ? sorteia(pt ? F.prontaPt : F.pronta) : enc.tem > 0 ? (pt ? F.parcialPt : F.parcial)[0] : F.nada[0];
    if (pt) j.ia.av = null;
    if (!enc.tem) j.ia.encomenda = null;
    const ele = [...this.jogadores.values()].find((p) => !p.bot && p.conta === enc.conta);
    if (ele && !j.ia.levar) this.dizerAmiga(this.falaEncAmiga(fala, enc, j, { motivo: m }), false, ele.id); // recruta com recurso pedido: leva ao Baú do Clã, sem "me chama"
  },
  acharColetaAmiga(j, dono, tipo, noTipo = null) {
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
      if (noTipo && no.tipo !== noTipo) continue; // encomenda: só o recurso pedido
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
const PROPRIOS = ['AMIGA', 'amiga', 'amigaDono', 'amigaFalam', 'amigaFora'];
export function contextoDeAmigo(sim, def) {
  const own = { AMIGA: def, amiga: null, amigaDono: null, amigaFalam: new Set(), amigaFora: null };
  return new Proxy(sim, {
    get: (t, k) => (PROPRIOS.includes(k) ? own[k] : Reflect.get(t, k)),
    set: (t, k, v) => { if (PROPRIOS.includes(k)) own[k] = v; else t[k] = v; return true; },
    has: (t, k) => PROPRIOS.includes(k) || k in t,
  });
}

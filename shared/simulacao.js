// Regras do jogo, sem gráficos. O servidor roda esta simulação e manda o resultado aos jogadores.
// O cliente também consegue rodá-la sozinho (modo solo) quando não há servidor.
import { Terreno, rampasTelhado } from './terreno.js';
import { dentroDoMapa, limitarAoMapa, raioNaDirecao } from './mapa.js';
import { HABS, ATRIBUTOS, XP_INIMIGO, NIVEL_MAX, PONTOS_POR_NIVEL, BARRAS, barraValida, xpProximo, calcularStatus, habNoNivel, progressoValido, passivasDe, usosParaSubir, SKILL_MAX, NIVEL_SEM_TOMO, guardar, nomeItem, precoVenda, ehEquip, profNivel, profBonus, mercador, chanceRaridade, vigorAgora, gastarVigor, ganharVigor, horaDoJogo, ehNoite, camaVigorEm, contar, tirar, xpDoInimigo, liberarPaginas, devolverPaginas, danoMonstroNivel, tetoMonstroNivel, golpeHeroiNivel, reducaoContra, itemValido, penalidadeMorte, consertarTudo, reforcar, reforcoOk, textoReforcoPrecisa, organizar, filtroValido, filtrado } from './progresso.js';
import { LUGARES, ORCAMENTO, A, DURACAO, ARMA, BASICO, BASICO_MAGIA, CURA, ESCALADA, PARADO_PAREDE, SUBIDA, HABILIDADES, BUILD_PADRAO, buildValida, HEROI, MOVIMENTO, MISSOES, MONTARIAS, aparenciaValida, visualValido, nomeValido, TIPOS_INIMIGO, COMBATE_INIMIGO, PERSONAGENS, PERSONAGEM_PADRAO, ITENS, LOJA, LOJA_DISTANCIA, LOJA_MAX, DROPS, ROMANO, MOCHILA, MOCHILA_PAGINAS, PAGINA_PRECO, ESTAMINA, PROFISSOES, MERCADOR, COLETA, COLETA_DISTANCIA, VEIO_RAIO, TAMANHO_VEIO, RECEITAS, OFICINA, OFICINA_DISTANCIA, RARIDADE_CRIAR, RESET_BUILD, TREINO, NIVEL_INIMIGO, statusInimigo, LOTE, CONSTRUCOES, PLANTAS, HORTA, fasePlanta, VOLTA_VILA, RECEITA_ESTACAO, REGEN, VILA_LOTES, VILAS_TERRENO, vilaEm, chaoDaVila, LOTES_ANTIGOS, precoTerreno, maxPecasTerreno, vendaTerreno, contaTerreno, TROCA, CASA, FERRAMENTAS_FAZENDA, BAU, FORNALHA, CRIAR_OBRA, tempoCriar, AMIGOS, TIME, TIME_XP, fatorXpTime, CHAT, CAVERNA, POCAO_RECARGA, DIA, CAMA, REFORCO, VIGOR, CATALISADOR, RARIDADES, PROF_MAX, FOGAO, bauLugares, PESCA, NOME, TOTENS, taxaTotem, totemPerto, naAreaSegura } from './dados.js';
import { TUNEL, TUNEIS, noTunel, dentroDaCaverna } from './caverna.js';
import { noLago, relevo, AGUA, MERGULHO_MAX, LAGOS } from './relevo.js';
import { Transporte, carrinhoNovo } from './transporte.js'; // FASE 1: packs e transportes do Quimera (André 2026-11-09)
import { PACK_REGRAS, AMIGA, AMIGOS_VIRTUAIS, CONTA_TESTE, npcNoMundo } from './dados.js';
import { HISTORIA, HISTORIA_PREMIO, LIBERA_NIVEL, CHEFES_HISTORIA, CAPITULOS, CENAS, VEICULOS } from './dados.js';
import { zonaFechadaEm, textoNevoa, nomeLibera, liberado, motivoLibera, missaoAtual, liberaNoNivel, histNova, etapasDe, etapaAtual, casaEtapa, totalEtapa, capituloDe, primeiraDoCap, ultimaDoCap, capFeito, npcApareceu } from './historia.js'; // progressão (André 2026-11-10)
import { BOSSES_MUNDO, COMBATE_BOSS, DROP_BOSS } from './dados.js'; // bosses de mundo (André 2026-11-11)
import { Amiga, contextoDeAmigo } from './amiga.js'; // Cecília, a amiga que vive no servidor (André 2026-11-09)
import { Leilao, LEILAO, TIPOS_LEILAO, anuncioParaApp } from './leilao.js'; // a Casa do Comércio (história v2, Entrega 3)

const TAU = Math.PI * 2;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const FALAR_JANELA = 4.8; // m: toque num botão da janela do NPC (o app fecha a janela a 4,5 m; folga da rede)
const angDif = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
const r2 = (n) => Math.round(n * 100) / 100;
const ehArma = (k) => ['espada', 'cajado'].includes(ITENS[k]?.lugar); // catalisador de arma (Runa) ou de armadura (Selo)
// ---------- Fornalha (shared/dados.js FORNALHA): queima sozinha pelo relógio, mesmo com o dono fora do jogo ----------
// F = { comb, ent, sai: {k, n} | null, fogo: s de fogo que sobra da unidade acesa, fogoK: o que está queimando,
// prog: s do que está saindo agora, t: última conta (ms) }. Só faz a conta quando alguém olha (abre, põe, tira, salva).
export function fornoVazio() { return { comb: null, ent: null, sai: null, fogo: 0, fogoK: '', prog: 0, t: Date.now() }; }
export function fornoValido(d) {
  const F = fornoVazio();
  if (!d || typeof d !== 'object') return F;
  for (const c of ['comb', 'ent', 'sai']) {
    const o = d[c];
    if (o && ITENS[o.k] && (o.n | 0) > 0) F[c] = { k: o.k, n: Math.min(o.n | 0, ITENS[o.k].pilha || 50) };
  }
  F.fogo = Math.max(0, +d.fogo || 0); F.fogoK = FORNALHA.combustivel[d.fogoK] ? d.fogoK : '';
  F.prog = Math.max(0, +d.prog || 0); F.t = Number(d.t) > 0 ? Number(d.t) : Date.now();
  return F;
}
// a receita do material posto, ou null. C = FORNALHA ou FOGAO (o fogão usa a mesma conta, André 2026-11-07)
export const receitaForno = (F, C = FORNALHA) => (F.ent ? C.receitas[F.ent.k] || null : null);
// a regra da peça: fogão ou fornalha
export const regraForno = (k) => (k === 'fogao' ? FOGAO : FORNALHA);
// dá para seguir agora? (material bastante e cabe na saída)
function fornoPodeSeguir(F, R) {
  if (!R || !F.ent || F.ent.n < R.usa) return false;
  return !F.sai || (F.sai.k === R.faz && F.sai.n < (ITENS[R.faz].pilha || 50));
}
// anda o relógio da fornalha até agora; devolve true se mudou alguma coisa
const fornoTemCoisa = (F) => !!(F && (F.comb || F.ent || F.sai));
export function avancarForno(F, agora = Date.now(), C = FORNALHA) {
  let dt = Math.max(0, (agora - F.t) / 1000), mudou = false;
  F.t = agora;
  for (let volta = 0; dt > 1e-6 && volta < 400; volta++) {
    const R = receitaForno(F, C);
    if (!fornoPodeSeguir(F, R)) break; // parada: o fogo que sobra fica guardado (não gasta à toa)
    if (R.fogo && F.fogo > 0 && F.fogoK !== R.fogo) { F.fogo = 0; mudou = true; } // aço só com carvão: apaga a lenha
    if (F.fogo <= 1e-6) {
      const c = F.comb;
      if (!c || (R.fogo && c.k !== R.fogo) || !C.combustivel[c.k]) { F.fogo = 0; break; }
      F.fogo = C.combustivel[c.k]; F.fogoK = c.k;
      if (--c.n <= 0) F.comb = null;
      mudou = true;
    }
    const passo = Math.min(dt, F.fogo, R.dur - F.prog);
    F.prog += passo; F.fogo -= passo; dt -= passo;
    if (F.prog >= R.dur - 1e-6) {
      F.prog = 0; F.ent.n -= R.usa; if (F.ent.n <= 0) F.ent = null;
      if (F.sai) F.sai.n++; else F.sai = { k: R.faz, n: 1 };
      mudou = true;
    }
  }
  if (!fornoPodeSeguir(F, receitaForno(F, C))) F.prog = 0; // trocou o material: começa do zero
  if (F.fogo <= 1e-6) { F.fogo = 0; if (!F.comb) F.fogoK = ''; }
  return mudou;
}

// ---------- Vila dos Lotes: contas da construção e da horta (godot-prototipo/construcao.gd repete as mesmas) ----------
// água do regador (conta sem o campo = cheio) e se (x, z) está perto do poço da praça ou na beira/dentro de um lago
const aguaRegador = (p) => (typeof p.agua === 'number' ? p.agua : HORTA.agua);
function pertoDeAgua(x, z) {
  if (Math.hypot(x - HORTA.poco.x, z - HORTA.poco.z) <= HORTA.poco.r) return true;
  const b = HORTA.beira;
  return [[0, 0], [b, 0], [-b, 0], [0, b], [0, -b], [b * 0.7, b * 0.7], [-b * 0.7, b * 0.7], [b * 0.7, -b * 0.7], [-b * 0.7, -b * 0.7]].some(([ox, oz]) => noLago(x + ox, z + oz));
}
// Planta cresce só enquanto a terra está molhada (HORTA.rega horas depois de regar), em horas de relógio de verdade
// (Quimera UJ): g = horas de rega acumuladas; madura quando g >= PLANTAS[c].G. u = última conta (ms).
export function crescerPlanta(t, agora) {
  if (!t || !t.c) return;
  const ini = Math.max(t.u || agora, t.w || 0), fim = Math.min(agora, (t.w || 0) + HORTA.rega * 3600000);
  if (fim > ini) t.g = (t.g || 0) + (fim - ini) / 3600000;
  t.u = agora;
}
// retângulo da peça no chão [x0, z0, x1, z1]; r = giro de 90 em 90 graus (o modelo gira r x 90° no eixo y)
export function retPeca(p) {
  const C = CONSTRUCOES[p.k], g = p.r & 1, hw = (g ? C.d : C.w) / 2, hd = (g ? C.w : C.d) / 2;
  return [p.x - hw, p.z - hd, p.x + hw, p.z + hd];
}
// círculos sólidos da peça no mundo (giro do Godot no eixo y: x' = x cos + z sen, z' = -x sen + z cos)
// base = altura do chão embaixo dela: com CONSTRUCOES.alto, o círculo ganha o topo (alto) e o herói pula e fica em cima
export function solidosPeca(p, base = null) {
  const a = (p.r & 3) * Math.PI / 2, c = Math.round(Math.cos(a)), s = Math.round(Math.sin(a)), C = CONSTRUCOES[p.k];
  const topo = base != null && C.alto ? { alto: base + C.alto } : {};
  return C.circulos.map(([dx, dz, r]) => ({ x: p.x + dx * c + dz * s, z: p.z - dx * s + dz * c, r, peca: p.id, ...topo }));
}
// parede, janela ou batente de porta entre os dois pontos? (André 2026-11-07: do lado de fora da casa não abre o baú)
// Mesma conta no godot-prototipo/construcao.gd sem_parede.
export function semParede(lotes, a, b) {
  const dx = b.x - a.x, dz = b.z - a.z, l2 = dx * dx + dz * dz;
  for (const L of lotes) for (const p of L.pecas) {
    if (tipoPeca(p.k) !== 'borda') continue;
    for (const o of solidosPeca(p)) {
      const t = l2 > 0 ? Math.max(0, Math.min(1, ((o.x - a.x) * dx + (o.z - a.z) * dz) / l2)) : 0;
      if (Math.hypot(a.x + dx * t - o.x, a.z + dz * t - o.z) < o.r * 0.9) return false;
    }
  }
  return true;
}
const cruza = (a, b) => a[0] < b[2] - 0.01 && b[0] < a[2] - 0.01 && a[1] < b[3] - 0.01 && b[1] < a[3] - 0.01;
const foraDoLote = (R, d) => R[0] < d.x0 - 0.01 || R[2] > d.x1 + 0.01 || R[1] < d.z0 - 0.01 || R[3] > d.z1 + 0.01;
// ---------- Terras: o terreno que o jogador escolhe (toca num canto e arrasta até o outro) ----------
// R = { x0, z0, x1, z1 } em metros inteiros. Mesma conta no godot-prototipo/construcao.gd (motivo_terreno).
const ESTRADAS_TERRAS = [VILA_LOTES.estrada, ...VILA_LOTES.ruas.map((r) => r.pontos)];
const LARG_TERRAS = [2.4, ...VILA_LOTES.ruas.map((r) => r.largura)];
// distância de um ponto até o retângulo (0 dentro)
const distRet = (R, x, z) => Math.hypot(Math.max(R.x0 - x, 0, x - R.x1), Math.max(R.z0 - z, 0, z - R.z1));
export function retTerreno(m) {
  if (!m) return null;
  const v = [m.x0, m.z0, m.x1, m.z1].map((n) => Math.round(Number(n)));
  if (v.some((n) => !Number.isFinite(n) || Math.abs(n) > 2000)) return null;
  return { x0: Math.min(v[0], v[2]), z0: Math.min(v[1], v[3]), x1: Math.max(v[0], v[2]), z1: Math.max(v[1], v[3]) };
}
const cruzaTerreno = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
export function motivoTerreno(R, outros = []) {
  const w = R.x1 - R.x0, d = R.z1 - R.z0;
  if (w < LOTE.ladoMin || d < LOTE.ladoMin) return `O terreno precisa de pelo menos ${LOTE.ladoMin} x ${LOTE.ladoMin} m`;
  if (w > LOTE.ladoMax || d > LOTE.ladoMax) return `Cada lado vai até ${LOTE.ladoMax} m`;
  if (w * d > LOTE.areaMax) return `No máximo ${LOTE.areaMax} blocos (este tem ${w * d})`;
  // FASE 3: a vila do terreno (o meio dele); as Terras da Estrada continuam com as estradas de sempre
  const V = vilaEm((R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2) || VILAS_TERRENO[0], A = V.area;
  const ruas = V === VILAS_TERRENO[0] ? ESTRADAS_TERRAS : V.estradas.map((e) => e.pontos), largs = V === VILAS_TERRENO[0] ? LARG_TERRAS : V.estradas.map((e) => e.largura);
  for (let t = 0; t <= 2 * (w + d); t += 1) { // a borda inteira dentro das terras, longe das árvores
    const x = t <= w ? R.x0 + t : t <= w + d ? R.x1 : t <= 2 * w + d ? R.x1 - (t - w - d) : R.x0;
    const z = t <= w ? R.z0 : t <= w + d ? R.z0 + (t - w) : t <= 2 * w + d ? R.z1 : R.z1 - (t - 2 * w - d);
    if (Math.hypot(x - A.x, z - A.z) > raioNaDirecao(A, Math.atan2(z - A.z, x - A.x)) - LOTE.folgaBorda) return 'Passa da borda das terras';
  }
  for (let k = 0; k < ruas.length; k++) { // não pega a estrada
    const L = ruas[k], meia = largs[k] / 2 + LOTE.folgaRua;
    for (let i = 1; i < L.length; i++) {
      const [ax, az] = L[i - 1], [bx, bz] = L[i], n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5);
      for (let q = 0; q <= n; q++) if (distRet(R, ax + (bx - ax) * q / n, az + (bz - az) * q / n) < meia) return 'Não pode pegar a estrada';
    }
  }
  for (const o of outros) if (cruzaTerreno(R, o)) return 'Encosta no terreno de outra pessoa';
  // sem frestinha (André 2026-11-05: "livre, mas não bagunçado"): lado a lado com um vizinho, ou encosta (0 m) ou deixa
  // pelo menos LOTE.fresta m, que vira caminho ou terreno de outro. Fresta menor que isso é chão perdido.
  for (const o of outros) {
    const lado = (a0, a1, b0, b1) => Math.max(a0, b0) < Math.min(a1, b1); // as faixas se cruzam (ficam de frente)
    const vao = lado(R.x0, R.x1, o.x0, o.x1) ? Math.max(o.z0 - R.z1, R.z0 - o.z1) : lado(R.z0, R.z1, o.z0, o.z1) ? Math.max(o.x0 - R.x1, R.x0 - o.x1) : 0;
    if (vao > 0.01 && vao < LOTE.fresta - 0.01) return `Encoste no vizinho ou deixe ${LOTE.fresta} m de caminho (está com ${Math.round(vao)} m)`;
  }
  return '';
}

// ---------- casa (grade de CASA.grade m, como no Quimera): fundação no quadrado, parede/porta/janela na borda, telhado em cima ----------
const GC = CASA.grade;
const tipoPeca = (k) => CONSTRUCOES[k]?.tipo || 'movel';
const inteiro = (v) => Math.abs(v - Math.round(v)) < 1e-6;
export const noMeioDaGrade = (v) => inteiro((v - GC / 2) / GC); // centro de um quadrado da casa
export const naLinhaDaGrade = (v) => inteiro(v / GC); // borda entre dois quadrados
const mesmoLugar = (a, x, z) => Math.abs(a.x - x) < 0.01 && Math.abs(a.z - z) < 0.01;
export const fundacaoEm = (L, x, z) => L.pecas.some((o) => tipoPeca(o.k) === 'fundacao' && mesmoLugar(o, x, z));
// os dois quadrados dos lados de uma parede (r par = parede no eixo x, borda norte/sul; r ímpar = eixo z)
export const ladosDaBorda = (p) => ((p.r & 1) ? [[p.x - GC / 2, p.z], [p.x + GC / 2, p.z]] : [[p.x, p.z - GC / 2], [p.x, p.z + GC / 2]]);
// as quatro bordas de um quadrado da casa: [x, z, eixo (0 = x, 1 = z)]
export const bordasDoQuadrado = (x, z) => [[x, z - GC / 2, 0], [x, z + GC / 2, 0], [x - GC / 2, z, 1], [x + GC / 2, z, 1]];
const bordaEm = (L, x, z, eixo) => L.pecas.find((o) => tipoPeca(o.k) === 'borda' && (o.r & 1) === eixo && mesmoLugar(o, x, z));
const telhadoEm = (L, x, z) => L.pecas.some((o) => tipoPeca(o.k) === 'telhado' && mesmoLugar(o, x, z));
// por que a peça não pode ficar ali ('' = pode): dentro do lote, sem encostar em outra peça nem na horta, fora do herói
// Casa (2026-11-04): a fundação aceita móveis em cima; parede e telhado precisam de fundação (regras do Quimera).
export function motivoPeca(L, p, j) {
  const R = retPeca(p), T = tipoPeca(p.k);
  if (foraDoLote(R, L.def)) return 'Só dá para construir dentro do seu terreno';
  const naHorta = () => Object.keys(L.horta).some((c) => { const [i, k] = c.split(',').map(Number); return cruza(R, [i, k, i + 1, k + 1]); });
  const emCima = () => j && j.x > R[0] - 0.35 && j.x < R[2] + 0.35 && j.z > R[1] - 0.35 && j.z < R[3] + 0.35;
  if (T === 'fundacao') {
    if (!noMeioDaGrade(p.x) || !noMeioDaGrade(p.z)) return 'Fora da grade da casa';
    if (fundacaoEm(L, p.x, p.z)) return 'Já tem fundação aqui';
    for (const o of L.pecas) if (tipoPeca(o.k) === 'movel' && cruza(R, retPeca(o))) return 'Lugar ocupado';
    if (naHorta()) return 'Tem horta aí';
    return '';
  }
  if (T === 'borda') {
    const eixo = p.r & 1;
    if (eixo ? !(naLinhaDaGrade(p.x) && noMeioDaGrade(p.z)) : !(noMeioDaGrade(p.x) && naLinhaDaGrade(p.z))) return 'Fora da grade da casa';
    if (!ladosDaBorda(p).some(([x, z]) => fundacaoEm(L, x, z))) return `${CONSTRUCOES[p.k].nome} vai na borda de uma fundação`;
    if (bordaEm(L, p.x, p.z, eixo)) return 'Já tem parede aqui';
    for (const o of L.pecas) if (tipoPeca(o.k) === 'movel' && cruza(R, retPeca(o))) return 'Lugar ocupado';
    if (emCima()) return 'Saia de cima do lugar';
    return '';
  }
  if (T === 'telhado') {
    if (!noMeioDaGrade(p.x) || !noMeioDaGrade(p.z)) return 'Fora da grade da casa';
    if (!fundacaoEm(L, p.x, p.z)) return 'O telhado vai em cima de uma fundação';
    if (telhadoEm(L, p.x, p.z)) return 'Já tem telhado aqui';
    const apoio = bordasDoQuadrado(p.x, p.z).some(([x, z, e]) => bordaEm(L, x, z, e))
      || [[GC, 0], [-GC, 0], [0, GC], [0, -GC]].some(([dx, dz]) => telhadoEm(L, p.x + dx, p.z + dz));
    if (!apoio) return 'Precisa de parede em volta (ou outro telhado do lado)';
    return '';
  }
  for (const o of L.pecas) if (o.id !== p.id && tipoPeca(o.k) !== 'fundacao' && tipoPeca(o.k) !== 'telhado' && cruza(R, retPeca(o))) return 'Lugar ocupado';
  if (naHorta()) return 'Tem horta aí';
  if (emCima()) return 'Saia de cima do lugar';
  return '';
}
// Peças sólidas da casa no terreno (shared/terreno.js, 2026-11-04): a fundação vira chão, parede e janela se escalam
// até o topo, a porta tem os batentes e a verga por cima (passa-se por baixo), e os telhados juntos viram um telhado
// só onde dá para ficar em pé. chao(x, z) = altura do chão sem as casas dos jogadores. Mesma conta no app (construcao.gd).
export function pecasCasaSolidas(L, chao) {
  const g = GC / 2, l = [], peca = (x, z, hw, hd, y1, base) => ({ casa: true, x, z, cos: 1, sen: 0, hw, hd, sobe: 0, y1, base, R: Math.hypot(hw, hd) });
  const piso = (x, z) => chao(x, z) + (L.pecas.some((o) => tipoPeca(o.k) === 'fundacao' && Math.abs(o.x - x) < g && Math.abs(o.z - z) < g) ? CASA.fundacao : 0);
  const cel = [];
  let topo = -Infinity;
  for (const p of L.pecas) {
    const T = tipoPeca(p.k);
    if (T === 'fundacao') l.push(peca(p.x, p.z, g, g, chao(p.x, p.z) + CASA.fundacao, chao(p.x, p.z)));
    else if (T === 'borda') {
      const eixo = p.r & 1, y0 = chao(p.x, p.z), y1 = Math.max(...ladosDaBorda(p).map(([x, z]) => piso(x, z))) + CASA.parede, e = CASA.espessura / 2 + 0.02;
      const ret = (u, hu, base, alto) => (eixo ? peca(p.x, p.z + u, e, hu, alto, base) : peca(p.x + u, p.z, hu, e, alto, base));
      if (p.k === 'porta') l.push(ret(-0.85, 0.3, y0, y1), ret(0.85, 0.3, y0, y1), ret(0, g + 0.15, y1 - CASA.parede + CASA.porta, y1));
      else l.push(ret(0, g + 0.15, y0, y1));
    } else if (T === 'telhado') { cel.push([p.x, p.z, p.r | 0]); topo = Math.max(topo, piso(p.x, p.z) + CASA.parede); }
  }
  if (cel.length) {
    const tem = new Set(cel.map(([x, z]) => x + ',' + z)), seg = [];
    let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
    for (const [x, z] of cel) {
      if (!tem.has((x - 2 * g) + ',' + z)) seg.push([x - g, z - g, x - g, z + g]);
      if (!tem.has((x + 2 * g) + ',' + z)) seg.push([x + g, z - g, x + g, z + g]);
      if (!tem.has(x + ',' + (z - 2 * g))) seg.push([x - g, z - g, x + g, z - g]);
      if (!tem.has(x + ',' + (z + 2 * g))) seg.push([x - g, z + g, x + g, z + g]);
      x0 = Math.min(x0, x - g - CASA.beiral); x1 = Math.max(x1, x + g + CASA.beiral);
      z0 = Math.min(z0, z - g - CASA.beiral); z1 = Math.max(z1, z + g + CASA.beiral);
    }
    l.push({ casa: true, cel, seg, g, base: topo, beiral: CASA.beiral, inclina: CASA.inclina, max: CASA.telhaMax, x0, z0, x1, z1,
      x: (x0 + x1) / 2, z: (z0 + z1) / 2, cos: 1, sen: 0, hw: (x1 - x0) / 2, hd: (z1 - z0) / 2, sobe: 0, y1: topo, R: Math.hypot(x1 - x0, z1 - z0) / 2,
      rampa: rampasTelhado(cel, 2 * g, CASA.telhaSobe) }); // telhado em rampa (2026-11-05): alturaTelhado usa as rampas
  }
  return l;
}
// o que impede desmontar a peça ('' = pode): fundação com parede ou telhado em cima
export function motivoDesmontar(L, p) {
  if (tipoPeca(p.k) !== 'fundacao') return '';
  if (telhadoEm(L, p.x, p.z)) return 'Tire o telhado de cima primeiro';
  for (const [x, z, e] of bordasDoQuadrado(p.x, p.z)) {
    const b = bordaEm(L, x, z, e); if (!b) continue;
    if (!ladosDaBorda(b).some(([qx, qz]) => !mesmoLugar(p, qx, qz) && fundacaoEm(L, qx, qz))) return 'Tire as paredes de cima primeiro';
  }
  return '';
}
// por que não dá para arar o quadrado (i, k) de 1 m ('' = dá)
export function motivoHorta(L, i, k) {
  const R = [i, k, i + 1, k + 1];
  if (foraDoLote(R, L.def)) return 'Só dá para plantar dentro do seu terreno';
  for (const o of L.pecas) if (cruza(R, retPeca(o))) return 'Lugar ocupado';
  return '';
}

// troca: o item sem a quantidade, em texto (para conferir se ainda é o mesmo) e de volta com n unidades
const chaveItem = (it) => JSON.stringify({ ...it, n: undefined });
function itemDaChave(chave, n) { const it = JSON.parse(chave); return ehEquip(it.k) ? it : { ...it, n }; }

// o que a morte custou, para o aviso de quando levanta (MORTE)
export const textoPenalidade = (pen) => (pen.ouro ? `. Perdeu ${pen.ouro} de ouro` : '') + (pen.xp ? `. Perdeu ${pen.xp} de XP` : '') + '. O equipamento desgastou'
  + (pen.quebrou.length ? `; quebrou: ${pen.quebrou.join(', ')} (o Tomás conserta)` : '');

// FASE 3, Parte 7b: em cima de um cais de madeira (mapa.cais) também se anda, mesmo por cima do mar
export function naCais(mapa, x, z) {
  for (const c of mapa.cais || []) {
    const ox = x - c.x, oz = z - c.z, u = ox * Math.sin(c.ry) + oz * Math.cos(c.ry), v = ox * Math.cos(c.ry) - oz * Math.sin(c.ry);
    if (Math.abs(u) <= c.d / 2 + 0.3 && Math.abs(v) <= c.w / 2 + 0.3) return c;
  }
  return null;
}

// quem bateu no NPC por último (aprender com a morte, shared/amiga.js): só o que importa, sem segurar o monstro
const golpeDe = (e) => ({ tipo: e.tipo, nivel: e.nivel || 1, hc: e.hc || null, bm: !!e.bm });

export class Simulacao {
  constructor(mapa) {
    this.mapa = mapa;
    this.tempo = 0;
    this.jogadores = new Map();
    this.amiga = null; this.amigaDono = null; this.amigaFalam = new Set(); // Cecília (shared/amiga.js): o corpo dela, quem ela acompanha e quem pode conversar
    this.AMIGA = AMIGA; // a definição dela (dados.js); os outros amigos virtuais (Dario, André 2026-11-11) são contextos com os próprios campos
    this.amigosIa = [this, ...AMIGOS_VIRTUAIS.filter((d) => d !== AMIGA && npcNoMundo(d)).map((d) => contextoDeAmigo(this, d))];
    this.inimigos = [];
    this.projeteis = [];
    this.campos = [];
    this.timers = [];
    this.eventos = [];
    this.proxId = 1;
    this.ator = null; // quem está agindo agora: vai junto nos eventos (campo "de"), para o celular não repetir o efeito que ele já mostrou
    // pedras: o herói usa a altura de verdade (pode subir); os inimigos só contornam um círculo
    this.terreno = new Terreno(mapa);
    const vila = mapa.vila || { casas: [], arvores: [] };
    // onde se coleta (Parte 3): veios do Minerador (v0, v1...) e as árvores do Lenhador (a0, a1...)
    this.coletaveis = new Map([
      ...(mapa.veios || []).map((v, i) => ['v' + i, { id: 'v' + i, tipo: v.tipo, x: v.x, z: v.z, r: VEIO_RAIO * (TAMANHO_VEIO[v.tipo] ?? 1), ...(v.mina ? { mina: v.mina } : {}), ...(v.y != null ? { y: v.y } : {}) }]),
      ...vila.arvores.map((a, i) => ['a' + i, { id: 'a' + i, tipo: 'arvore', x: a.x, z: a.z, r: 0.32 * a.s }]),
      // todas as árvores da mata também dão lenha (pedido do André 2026-11-03): m0, m1...
      ...(mapa.mata || []).map((a, i) => ['m' + i, { id: 'm' + i, tipo: 'arvore', x: a.x, z: a.z, r: 0.32 * a.s }]),
      // pedras e galhos soltos no chão (André 2026-11-07): pega com a mão; não são sólidos (s0, s1...)
      ...(mapa.soltos || []).map((o, i) => ['s' + i, { id: 's' + i, tipo: o.tipo, x: o.x, z: o.z, r: 0.35, ry: o.ry, solto: true }]),
    ]);
    this.obstaculos = [...mapa.obstaculos, ...vila.arvores.map((a) => ({ x: a.x, z: a.z, r: 0.32 * a.s })), ...(mapa.veios || []).map((v, i) => ({ x: v.x, z: v.z, r: VEIO_RAIO * (TAMANHO_VEIO[v.tipo] ?? 1), veio: 'v' + i, ...(v.y != null ? { alto: v.y + 2.5 } : {}) })), // veio: some quando esgota (veioVazio)
      ...(mapa.npcs || []).map((n) => ({ x: n.x, z: n.z, r: 0.3 })), ...this.terreno.postes,
      ...(mapa.treino || []).map((t) => ({ x: t.x, z: t.z, r: TREINO.raio, alto: TREINO.alto, semTopo: 1 }))]; // ninguém fica em pé no espantalho
    // casas: retângulo girado (meia largura / meia profundidade); inimigos não atravessam, o herói escala (shared/terreno.js)
    this.casas = vila.casas.map((c) => ({ x: c.x, z: c.z, cos: Math.cos(c.ry), sin: Math.sin(c.ry), hw: c.w / 2 + 0.35, hd: c.d / 2 + 0.35 }));
    // as casas das mini vilas do mundo grande (história v2, Entrega 3): monstro e NPC dão a volta (o piso da ferraria não conta)
    for (const c of mapa.casasMundo || []) if (!c.piso) this.casas.push({ x: c.x, z: c.z, cos: Math.cos(c.ry), sin: Math.sin(c.ry), hw: c.hw + 0.35, hd: c.hd + 0.35 });
    this.obstaculosRocha = this.terreno.rochas.map((r) => ({ x: r.x, z: r.z, r: r.R * 0.62 }));
    // árvores da mata (são muitas): numa grade de 6 m, cada um só confere as de perto (pertoNaMata)
    this.mata = new Map();
    for (const a of mapa.mata || []) {
      const k = Math.floor(a.x / 6) * 10007 + Math.floor(a.z / 6);
      if (!this.mata.has(k)) this.mata.set(k, []);
      this.mata.get(k).push({ x: a.x, z: a.z, r: 0.32 * a.s, ...(a.y ? { base: a.y } : {}) }); // base: chão da árvore do mundo grande
    }
    // ruínas, rochedos, troncos caídos e pedras da mata (MAPA_CLAREIRA.cenario): na mesma grade (são todos menores que 2 m
    // de raio, e quem pergunta olha as 9 casas em volta)
    for (const o of mapa.cenario?.solidos || []) {
      const k = Math.floor(o.x / 6) * 10007 + Math.floor(o.z / 6);
      if (!this.mata.has(k)) this.mata.set(k, []);
      this.mata.get(k).push({ x: o.x, z: o.z, r: o.r, ...(o.alto != null ? { alto: o.alto } : {}) });
    }
    this.refazerTampos();
    this.escadas = (mapa.escadas || []).map((e) => ({ ...e, alt: this.terreno.altura(e.topo.x, e.topo.z) }));
    mapa.inimigos.forEach((sp) => this.criarInimigo(sp));
    // campos de caça (CACA, regra do Quimera): cada vaga tem um índice v fixo (depois dos inimigos parados) e já começa cheia
    let v = mapa.inimigos.length;
    this.bossVolta = {}; this.camposBoss = []; // bosses de mundo: hora (ms) em que cada um pode nascer de novo e as poças no chão
    this.cacas = (mapa.caca || []).map((def, ci) => {
      const c = { def, vagas: def.tipos.map((tipo, k) => ({ tipo, k, v: v + k, e: null })), nx: 0, t: 0 };
      v += def.tipos.length;
      if (def.boss) c.boss = { id: def.boss, def: BOSSES_MUNDO[def.boss] }; // boss de mundo: nasce pela hora salva (passoBosses)
      else for (const vg of c.vagas) this.nascerNaCaca(c, ci, vg, true);
      return c;
    });
    // espantalhos de treino (TREINO): o v deles vem depois das vagas dos campos de caça
    (mapa.treino || []).forEach((sp, k) => this.criarInimigo({ ...sp, v: v + k }));
    v += (mapa.treino || []).length;
    // dungeon da montanha (2026-11-06): cada monstro das salas tem um v fixo depois do espantalho, mas o corpo só existe
    // enquanto tem alguém lá dentro (passoCaverna)
    this.dungeon = mapa.dungeon ? { def: mapa.dungeon, vazia: 0, salas: mapa.dungeon.salas.map((S) => ({ def: S, ativa: false, limpa: 0,
      vagas: S.pontos.map((pt) => ({ pt, v: v++, e: null })) })) } : null;
    // zonas de mineração (MINA): o minério de cada pedra é de todos (cargas e hora de voltar por veio)
    this.minas = new Map((mapa.mina || []).map((z) => [z.id, z]));
    this.veiosComuns = new Map();
    this.packsChao = []; // packs largados no chão (shared/transporte.js)
    this.spots = this.criarSpots(); // spots de pesca (PESCA.spots): cada vaga nasce num lago, dura e volta noutro lugar
    // Vila dos Lotes (construção e fazenda): dono, peças e horta de cada lote. O servidor põe o que está salvo
    // (carregarLotes) e grava o que mudou (lotesParaSalvar). dono = chave da conta (j.conta).
    this.lotes = new Map((mapa.lotes || []).map((l) => [l.id, { def: l, dono: null, nomeDono: '', pecas: [], horta: {}, prox: 1 }]));
    this.lotesMudados = new Set();
    this.lotesSoltos = new Set(); // vendidos de volta para o jogo (lotesParaSalvar grava sem dono)
  }
  // árvores da mata nas 9 casas da grade em volta de (x, z)
  pertoNaMata(x, z) {
    if (!this.mata.size) return [];
    const i = Math.floor(x / 6), j = Math.floor(z / 6), l = [];
    for (let a = i - 1; a <= i + 1; a++) for (let b = j - 1; b <= j + 1; b++) { const c = this.mata.get(a * 10007 + b); if (c) l.push(...c); }
    return l;
  }
  // nasce um monstro na vaga do campo de caça, num ponto ao acaso (longe dos jogadores, fora de pedra, árvore e casa)
  nascerNaCaca(c, ci, vg, inicio = false) {
    const d = c.def;
    for (let t = 0; t < 8; t++) {
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * d.r * d.ate, x = d.x + Math.cos(a) * r, z = d.z + Math.sin(a) * r;
      if (!inicio && [...this.jogadores.values()].some((j) => !j.morto && Math.hypot(j.x - x, j.z - z) < d.longe)) continue;
      if (this.obstaculos.some((k) => Math.hypot(k.x - x, k.z - z) < k.r + 0.8) || !dentroDoMapa(this.mapa, x, z, 2.2)) continue;
      // covil dentro de caverna do mundo grande: nasce no túnel, longe da parede
      const C = d.tunel && TUNEIS.find((t) => t.id === d.tunel), c = C && noTunel(C, x, z);
      if (C && (!c || c.d > c.l - 1)) continue;
      vg.e = this.criarInimigo({ tipo: vg.tipo, x, z, caca: ci, vaga: vg.k, v: vg.v, nivel: d.nivel || 1, ...(C ? { tunel: C.id } : {}) });
      return true;
    }
    return false;
  }
  // Quimera (znSp): a cada "passo" s, se falta monstro, nasce um; o próximo em "rapido" s com menos da metade, senão "normal" s
  passoCacas(dt) {
    this.cacas.forEach((c, ci) => {
      const d = c.def;
      if (c.boss) return; // boss de mundo: passoBosses
      c.t -= dt; if (c.t > 0) return;
      c.t = d.passo;
      const vivos = c.vagas.filter((vg) => vg.e).length, vaga = c.vagas.find((vg) => !vg.e);
      if (!vaga || this.tempo < c.nx) return;
      if (this.nascerNaCaca(c, ci, vaga)) c.nx = this.tempo + (vivos < d.n / 2 ? d.rapido : d.normal);
      else c.nx = this.tempo + d.rapido;
    });
  }

  // ---------- entidades ----------
  novoCorpo(extra) {
    return { id: 'e' + this.proxId++, x: 0, z: 0, ry: 0, trava: 0, defesa: 0, morto: false, anim: 'Idle',
      acao: null, acaoSeq: 0, dash: null, y: 0, vy: 0, chao: true, esc: null, ...extra };
  }
  // opcoes.podeCriar: personagem ainda não foi criado (o criador abre uma vez só); opcoes.aparencia: a que já foi criada
  // opcoes.progresso: nível, atributos e skills guardados na conta (shared/progresso.js)
  adicionarJogador(id, nome, visual, { podeCriar = false, aparencia = null, progresso = null, testador = false, conta = null } = {}) {
    const n = this.mapa.nascimento;
    const j = this.novoCorpo({ id, tipo: 'jogador', nome: nome || 'Andarilho', x: n.x + (Math.random() - 0.5) * 3, z: n.z + (Math.random() - 0.5) * 3,
      vida: HEROI.vida, vidaMax: HEROI.vida, mana: HEROI.mana, build: [...BUILD_PADRAO], cds: {}, entrada: { mx: 0, mz: 0, correr: false },
      fila: null, modo: 'Espada', missoes: {}, falas: {}, sta: 0, staT: 0, semFolego: false, seguida: { k: 1, t: -9 }, combateAte: 0, ciente: false, coleta: null, coletas: {}, pulos: 0, puloT: 9, mortal: 0, pouso: 0, empurra: 0, bloqueado: false, arrancada: null, arrancadaNoAr: false, combos: {},
      visual: visualValido(visual) ? visual : PERSONAGEM_PADRAO, podeCriar: !!podeCriar });
    if (aparencia) j.aparencia = aparenciaValida(aparencia);
    j.conta = conta != null ? 'c' + conta : 'n:' + j.nome; // dono do lote (sem contas: o nome)
    j.prog = progressoValido(progresso);
    if (testador && CONTA_TESTE.paginas) liberarPaginas(j.prog, MOCHILA_PAGINAS); // conta de teste do André: as 4 páginas da mochila liberadas
    else if (testador && j.prog.devPag !== CONTA_TESTE.devolver) { devolverPaginas(j.prog); j.prog.devPag = CONTA_TESTE.devolver; } // André 2026-11-11: compra como todo mundo
    j.testador = !!testador;
    this.nascerOndeSaiu(j);
    this.aplicarStatus(j, true);
    j.sta = j.staMax;
    j.amigos = new Map(); // conta do amigo -> nome (o servidor carrega da conta: definirAmigos)
    j.time = null;
    this.jogadores.set(id, j);
    this.avisarProg(j);
    return j;
  }
  removerJogador(id) {
    const j = this.jogadores.get(id);
    if (j?.troca) this.fecharTroca(j.troca, `${j.nome} saiu do jogo: a troca foi desfeita`);
    if (j?.time) this.sairDoTime(j, `${j.nome} saiu do jogo`);
    this.jogadores.delete(id);
    if (j) for (const o of this.jogadores.values()) if (o.amigos?.has(j.conta)) this.enviarAmigos(o); // amigo ficou offline
  }
  // ---------- onde o herói estava (André 2026-11-03) ----------
  // Saiu do jogo longe da vila: entra de volta no mesmo lugar. Só a morte (ou o Voltar para a vila) leva para a praça.
  nascerOndeSaiu(j) {
    const q = j.prog.pos; if (!q) return;
    const chao = this.terreno.altura(q.x, q.z, q.y + 0.3); // dentro de casa: o piso, não o telhado de cima (André 2026-11-05)
    if (!dentroDoMapa(this.mapa, q.x, q.z) || q.y < chao - 0.6 || q.y > chao + ORCAMENTO.altura) { delete j.prog.pos; return; } // o mapa mudou: vila
    if (zonaFechadaEm(j.prog, q.x, q.z)) { delete j.prog.pos; return; } // saiu numa zona que agora está na névoa: vila
    Object.assign(j, { x: q.x, y: Math.max(q.y, chao), z: q.z, ry: q.ry, chao: q.y - chao < 0.15 });
    // saiu do jogo lá dentro da caverna (já tinha usado o passe): volta lá dentro com a entrada valendo
    const cv = dentroDaCaverna(TUNEL, j.x, j.z, j.y + 0.3); if (cv && cv.s > CAVERNA.porta) j.caverna = { desde: this.tempo };
  }
  // guarda no progresso onde o herói está (vai para a conta junto com o resto, a cada 15 s e quando ele sai)
  guardarPosicao(j) {
    if (j.morto || j.criando || j.esc) return;
    const q = j.prog.pos;
    if (q && Math.hypot(q.x - j.x, q.z - j.z) < 1 && Math.abs(q.y - j.y) < 0.5) return;
    j.prog.pos = { x: r2(j.x), y: r2(j.y), z: r2(j.z), ry: r2(j.ry) };
    j.progSujo = true;
  }
  // ---------- Voltar para a vila (botão da casinha no menu do topo) ----------
  // Canalização lenta parado; andar, atacar, pular, coletar, levar dano ou tocar de novo cancela. Recarga de 10 min só quando chega.
  voltarVila(id) {
    const j = this.jogadores.get(id); if (!j || j.morto || j.criando) return;
    if (j.vila) return this.cancelarVila(j, null); // tocou de novo na casinha: desiste
    if (this.motivoCarga(j)) return this.evento({ t: 'aviso', para: id, texto: this.motivoCarga(j) }); // pack não teleporta (Quimera)
    const V = VOLTA_VILA, falta = (j.prog.vilaAte || 0) - Date.now();
    if (falta > 0) return this.evento({ t: 'aviso', para: id, texto: `Voltar para a vila: pronto em ${Math.ceil(falta / 60000)} min` });
    const n = this.mapa.nascimento;
    if (Math.hypot(j.x - n.x, j.z - n.z) < V.vila) return this.evento({ t: 'aviso', para: id, texto: 'Você já está na vila' });
    if (j.esc || !j.chao) return;
    if (j.coleta) this.pararColeta(j);
    if (j.canal) this.cancelarCanal(j);
    j.montado = null;
    const v = j.vila = { x: j.x, z: j.z };
    this.evento({ t: 'vila', id: j.id, fase: 'comeca', dur: V.canal });
    this.depois(V.canal, () => { if (j.vila === v && !j.morto && this.jogadores.get(j.id) === j) this.chegarNaVila(j); });
  }
  cancelarVila(j, motivo = 'Volta para a vila cancelada') {
    if (!j?.vila) return;
    if (motivo && j.vila.totem) motivo = motivo.replace('Volta para a vila', 'Viagem').replace('volta para a vila', 'viagem'); // totem de teleporte
    j.vila = null;
    this.evento({ t: 'vila', id: j.id, fase: 'cancela' });
    if (motivo) this.evento({ t: 'aviso', para: j.id, texto: motivo });
  }
  chegarNaVila(j) {
    j.vila = null;
    const n = this.mapa.nascimento, x0 = j.x, z0 = j.z;
    const x = n.x + (Math.random() - 0.5) * 3, z = n.z + (Math.random() - 0.5) * 3, y = this.terreno.altura(x, z);
    Object.assign(j, { x, y, z, vy: 0, chao: true, dash: null, arrancada: null, esc: null, trava: 0, acao: null });
    j.cliente = null; j.orcT = null; // a próxima posição do celular já é a da vila
    j.prog.vilaAte = Date.now() + VOLTA_VILA.cd * 1000;
    delete j.prog.pos;
    this.avisarProg(j); // o app mostra a recarga na casinha
    this.evento({ t: 'vila', id: j.id, fase: 'chegou', x0: r2(x0), z0: r2(z0), x: r2(x), y: r2(y), z: r2(z) });
  }
  // ---------- Totens de teleporte (André 2026-11-10, TOTENS em shared/dados.js) ----------
  // passou perto a pé: o totem fica descoberto e vira o lugar de renascer (o último tocado)
  tocarTotem(j, t) {
    const lista = j.prog.totens || (j.prog.totens = []);
    const novo = !lista.includes(t.id);
    this.historia(j, 'totem', { k: t.id }); // história v2 (Entrega 4): "toque o totem"
    if (!novo && j.prog.totem === t.id) return;
    if (novo) lista.push(t.id);
    j.prog.totem = t.id; j.progSujo = true;
    this.avisarProg(j);
    this.evento({ t: 'totem', para: j.id, id: t.id, novo });
    this.evento({ t: 'aviso', para: j.id, texto: novo ? `Totem descoberto: ${t.nome}. Se cair, você renasce aqui` : `Você renasce aqui agora: ${t.nome}` });
  }
  // perto de um totem, pediu para ir a outro: canaliza parado (o mesmo jeito da casinha: andar ou dano cancela) e paga
  irTotem(id, para) {
    const j = this.jogadores.get(id); if (!j || j.morto || j.criando) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if (j.vila) return this.cancelarVila(j, null); // pediu de novo: desiste
    const de = totemPerto(j.x, j.z, TOTENS.usar + 0.5), D = TOTENS.lista.find((t) => t.id === para);
    if (!de) return aviso('Chegue perto de um totem');
    if (!D || D.id === de.id) return;
    if (!(j.prog.totens || []).includes(D.id)) return aviso(`Você ainda não visitou o totem ${D.nome}`);
    { const Z = zonaFechadaEm(j.prog, D.x, D.z); if (Z) return aviso(textoNevoa(j.prog, Z.id)); } // progressão (André 2026-11-10)
    if (this.motivoCarga(j)) return aviso(this.motivoCarga(j)); // pack e carrinho não teleportam (Quimera)
    const taxa = taxaTotem(D);
    if ((j.prog.ouro || 0) < taxa) return aviso(`Faltam ${taxa - (j.prog.ouro || 0)} de ouro (a viagem custa ${taxa})`);
    if (j.esc || !j.chao) return;
    if (j.coleta) this.pararColeta(j);
    if (j.canal) this.cancelarCanal(j);
    j.montado = null;
    const v = j.vila = { x: j.x, z: j.z, totem: D.id };
    this.evento({ t: 'vila', id: j.id, fase: 'comeca', dur: TOTENS.canal, totem: D.id });
    this.depois(TOTENS.canal, () => { if (j.vila === v && !j.morto && this.jogadores.get(j.id) === j) this.chegarNoTotem(j, D); });
  }
  // onde o herói aparece num totem: um pouco à frente da pedra, para o lado da estrada (sorteio pequeno)
  ladoDoTotem(t) {
    const a = Math.random() * Math.PI * 2, r = TOTENS.raio + 1.6 + Math.random() * 1.2;
    return { x: t.x + Math.cos(a) * r, z: t.z + Math.sin(a) * r };
  }
  chegarNoTotem(j, D) {
    j.vila = null;
    const taxa = taxaTotem(D);
    if ((j.prog.ouro || 0) < taxa) { this.evento({ t: 'vila', id: j.id, fase: 'cancela' }); return this.evento({ t: 'aviso', para: j.id, texto: 'Ouro insuficiente: viagem cancelada' }); }
    j.prog.ouro -= taxa;
    const x0 = j.x, z0 = j.z, n = this.ladoDoTotem(D), y = this.terreno.altura(n.x, n.z);
    Object.assign(j, { x: n.x, y, z: n.z, vy: 0, chao: true, dash: null, arrancada: null, esc: null, trava: 0, acao: null });
    j.cliente = null; j.orcT = null;
    if (!j.prog.totens.includes(D.id)) j.prog.totens.push(D.id);
    j.prog.totem = D.id;
    delete j.prog.pos; j.progSujo = true;
    this.avisarProg(j);
    this.evento({ t: 'vila', id: j.id, fase: 'chegou', totem: D.id, x0: r2(x0), z0: r2(z0), x: r2(n.x), y: r2(y), z: r2(n.z) });
    this.evento({ t: 'aviso', para: j.id, texto: `Você chegou em ${D.nome} (-${taxa} de ouro)` });
    this.historia(j, 'viajar', { k: D.id }); // história v2 (Entrega 4): viagem de totem
  }
  criarInimigo(sp) {
    const t = TIPOS_INIMIGO[sp.tipo], nivel = sp.nivel || 1, st = { ...statusInimigo(sp.tipo, nivel) }; // nível do campo de caça
    const F = sp.caverna && this.dungeon?.def?.forte; // sala da caverna: monstro de grupo (CAVERNA_DUNGEON.forte)
    if (F) { st.vida = Math.round(st.vida * F.vida); st.dano = Math.round(st.dano * F.dano); }
    const e = this.novoCorpo({ tipo: sp.tipo, nome: t.nome, x: sp.x, z: sp.z, casa: { x: sp.x, z: sp.z }, vida: st.vida, vidaMax: st.vida,
      nivel, dano: st.dano, ataqueCd: 1 + Math.random(), sp, v: sp.v ?? this.mapa.inimigos.indexOf(sp) });
    e.anim = A.swordIdle;
    if (sp.tunel) this.prenderNoTunel(e); // covil de caverna do mundo grande: no chão da caverna
    else if (!sp.caverna && !t.treino) e.y = Math.max(0, relevo(e.x, e.z)); // no chão do mundo grande (0 no mapa de hoje)
    if (t.treino) { e.treino = true; e.ry = sp.ry || 0; e.anim = 'Idle'; } // espantalho: fica plantado onde está
    this.inimigos.push(e);
    return e;
  }
  todos() { return [...this.jogadores.values(), ...this.inimigos]; }
  inimigosDe(c) {
    // caverna da montanha: quem está lá dentro só enxerga quem também está (nada atravessa a rocha do teto)
    const sub = c.tipo === 'jogador' ? this.naCaverna(c) : !!c.sub;
    return (c.tipo === 'jogador' ? this.inimigos : [...this.jogadores.values()]).filter((o) => !o.morto && !o.criando && !(o.bot && !o.time) && (o.tipo === 'jogador' ? this.naCaverna(o) : !!o.sub) === sub);
  }
  maisPerto(c, max = 22) {
    let melhor = null, md = max;
    for (const o of this.inimigosDe(c)) { const d = dist(o, c); if (d < md) { md = d; melhor = o; } }
    return melhor;
  }

  // ---------- comandos vindos dos jogadores ----------
  entrada(id, e) {
    const j = this.jogadores.get(id); if (!j || j.criando) return;
    // só número de verdade (texto, NaN ou infinito viram 0): o cliente manda a direção, a velocidade é daqui
    const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
    const mx = num(e?.mx), mz = num(e?.mz), m = Math.hypot(mx, mz);
    const k = m > 1 ? 1 / m : 1; // nunca mais rápido que o permitido
    j.entrada = { mx: mx * k, mz: mz * k, correr: e?.correr === true };
  }
  // Sobe ou desce da montaria (teste: por enquanto todo jogador tem o lobo)
  montar(id) {
    const j = this.jogadores.get(id);
    if (!j || j.morto || j.esc || j.criando || j.trava > 0) return;
    this.cancelarVila(j);
    if (j.pesca) this.pararPesca(j, 'Você recolheu a linha');
    if (!j.montado && this.motivoCarga(j)) return this.evento({ t: 'aviso', para: id, texto: j.prog.pack ? 'Com pack nas costas não dá pra montar. Use o carrinho!' : 'Desça primeiro' });
    if (!j.montado && !liberado(j.prog, 'lobo')) return this.evento({ t: 'aviso', para: id, texto: motivoLibera(j.prog, 'lobo') }); // progressão (André 2026-11-10)
    j.montado = j.montado ? null : 'lobo';
    if (j.montado) this.historia(j, 'montar');
  }
  // Visual e aparência só mudam no criador, e o criador só abre uma vez (na criação da conta)
  trocarVisual(id, visual) {
    const j = this.jogadores.get(id);
    if (j?.criando && visualValido(visual)) j.visual = visual;
  }
  // Criando o personagem (no palco, fora do mapa): ninguém vê, nenhum inimigo persegue, não leva dano e não age.
  // Só entra quem ainda não criou o personagem; sair é sempre permitido.
  definirCriando(id, v) {
    const j = this.jogadores.get(id); if (!j) return;
    if (v && !j.podeCriar) return;
    j.criando = !!v;
    if (j.criando) { j.entrada = { mx: 0, mz: 0, correr: false }; j.fila = null; j.montado = null; }
  }
  // Cores e altura do criador de personagem (os outros jogadores veem igual)
  definirAparencia(id, a) {
    const j = this.jogadores.get(id); if (j?.criando) j.aparencia = aparenciaValida(a);
  }
  // Aparência mudada depois de criado (fora do criador): cores, altura e rosto. O nome não muda.
  mudarAparencia(id, a) {
    const j = this.jogadores.get(id); if (!j || j.criando) return null;
    const ap = aparenciaValida(a); if (!ap) return null;
    j.aparencia = ap;
    return ap;
  }
  // Corpo trocado depois de criado (criador do app Godot, pedido do André 2026-11-03): só os corpos da lista.
  // Devolve o corpo novo (para gravar na conta) ou null.
  mudarVisual(id, v) {
    const j = this.jogadores.get(id); if (!j || j.criando || !visualValido(v)) return null;
    j.visual = v;
    return v;
  }
  // "Pronto" no criador: grava nome, corpo e aparência de vez. Devolve o que valeu (para salvar na conta) ou null.
  concluirCriacao(id, p) {
    const j = this.jogadores.get(id); if (!j?.criando || !j.podeCriar) return null;
    const nome = nomeValido(p?.nome); if (!nome) return null;
    if (visualValido(p.visual)) j.visual = p.visual;
    j.aparencia = aparenciaValida(p.aparencia);
    j.nome = nome; j.podeCriar = false; j.criando = false;
    if (!j.prog.hist?.p && !j.prog.hist?.ac && !j.bot) this.cena(j, 'acordar'); // herói novo: a abertura, acordando do lado do poço
    return { nome, visual: j.visual, aparencia: j.aparencia };
  }
  // Trocar o nome depois de criado (André 2026-11-10): custa NOME.troca de ouro. livre(nome) é do servidor (nome único
  // entre as contas). Devolve o nome novo (para gravar na conta) ou null.
  trocarNome(id, n, livre = () => true) {
    const j = this.jogadores.get(id); if (!j || j.criando || j.bot) return null;
    const aviso = (texto) => { this.evento({ t: 'aviso', para: id, texto }); return null; };
    const nome = nomeValido(n);
    if (!nome) return aviso(`Nome inválido: de ${NOME.min} a ${NOME.max} letras ou números`);
    if (nome === j.nome) return aviso('Esse já é o seu nome');
    if (j.prog.ouro < NOME.troca) return aviso(`Falta ouro: trocar o nome custa ${NOME.troca.toLocaleString('pt-BR')}`);
    if (!livre(nome)) return aviso(`O nome ${nome} já é de outro jogador`);
    j.prog.ouro -= NOME.troca;
    j.nome = nome;
    for (const o of this.jogadores.values()) if (o.amigos?.has(j.conta)) o.amigos.set(j.conta, nome); // listas de amigos de quem está na sala
    const L = this.loteDe(j); if (L) { L.nomeDono = nome; this.avisarLote(L); } // placa do terreno
    this.avisarProg(j);
    this.evento({ t: 'nome', para: id, nome });
    aviso(`Agora seu nome é ${nome}`);
    return nome;
  }
  // Habilidades escolhidas pelo jogador para os botões (a build)
  definirBuild(id, build) {
    const j = this.jogadores.get(id); if (!j || !buildValida(build)) return;
    j.build = [...build];
  }
  // Espada na mão ou cajado na mão (a outra arma fica nas costas)
  trocarModo(id, modo) {
    const j = this.jogadores.get(id);
    if (j && (modo === 'Espada' || modo === 'Magia')) j.modo = modo;
  }
  // O celular decide o movimento do próprio herói e manda a posição (20 vezes por segundo); aqui só conferimos.
  // Velocidade: um "balde" de metros que enche na velocidade máxima de corrida (+30%) e guarda até ORCAMENTO.burst
  // (para dash, rolamento e golpes que avançam). Altura: nem embaixo do chão nem voando. Mapa: dentro do limite.
  // Se não bater, o herói fica onde o servidor sabe que ele está e o celular recebe "corrigir" (volta para lá).
  posicaoCliente(id, p) {
    const j = this.jogadores.get(id);
    if (!j || j.morto || j.criando) return false;
    const num = (v) => typeof v === 'number' && Number.isFinite(v);
    if (!p || !num(p.x) || !num(p.y) || !num(p.z) || !num(p.ry)) return false;
    if (p.e === 1) j.ciente = true; // app que conhece a estamina (o Godot): sem fôlego não corre
    j.vivoT = this.tempo; // o celular está mandando (guiado: o servidor não anda o herói sozinho enquanto ele manda)
    // c: quantos "corrigir" o celular já aplicou. Posição que saiu antes da correção mais nova chega atrasada: ignora sem
    // corrigir de novo (antes cada pacote atrasado ganhava o seu "corrigir" e o herói voltava várias vezes; André 2026-11-12)
    if (Number.isInteger(p.c) && p.c < (j.corrSeq || 0) && this.tempo - (j.corrT ?? -99) < ORCAMENTO.correcao) return false;
    const mont = MONTARIAS[j.montado], vv = this.velVeiculo(j);
    // carrinho, barquinho ou navio: a velocidade dele; pack nas costas: anda mais devagar e não corre (Quimera x0,68)
    const lentoH = j.lentoH && j.lentoH.ate > this.tempo ? 1 - j.lentoH.k * 0.8 : 1; // lentidão de skill de boss (folga de 20% para a rede)
    const vmax = (vv != null ? vv : mont ? Math.max(mont.correr, HEROI.correr) : j.prog.pack ? HEROI.correr * PACK_REGRAS.costas.vel : j.ciente && j.semFolego ? HEROI.correr * ESTAMINA.trote : HEROI.correr) * 1.3 * lentoH;
    if (j.orcT == null) { j.orc = ORCAMENTO.burst; j.orcT = this.tempo; }
    // a folga enche na velocidade máxima. Depois de um silêncio (internet engasgada), as posições guardadas chegam juntas:
    // o teto cresce com o tempo calado (até ORCAMENTO.silencio s de corrida), e o que sobrar dele vai minguando depois
    { const dtS = this.tempo - j.orcT;
      if (dtS > 0) {
        const teto = ORCAMENTO.burst + vmax * Math.min(dtS, ORCAMENTO.silencio);
        j.orc = j.orc > teto ? Math.max(teto, j.orc - dtS * vmax * 0.5) : Math.min(teto, j.orc + dtS * vmax);
      } }
    j.orcT = this.tempo;
    const T = this.terreno, d = Math.hypot(p.x - j.x, p.z - j.z), chao = T.altura(p.x, p.z, p.y);
    // embaixo: vale o chão mais baixo num palmo em volta (agarrado na parede, o corpo fica rente a ela)
    let baixo = chao; for (const [ox, oz] of [[0.4, 0], [-0.4, 0], [0, 0.4], [0, -0.4]]) baixo = Math.min(baixo, T.altura(p.x + ox, p.z + oz, p.y));
    // mergulho (André 2026-11-06): no lago fundo o herói desce abaixo da linha em que boia, até o leito (MERGULHO_MAX)
    if (noLago(p.x, p.z) && p.y < AGUA.nivel) baixo = Math.min(baixo, Math.max(relevo(p.x, p.z), chao - MERGULHO_MAX));
    const tele = j.tele && j.tele.ate > this.tempo ? j.tele.m : 0; // Salto Arcano: o herói some e aparece metros à frente
    const preso = (j.presoAte || 0) > this.tempo && j.presoEm && Math.hypot(p.x - j.presoEm.x, p.z - j.presoEm.z) > 0.6; // atordoado, congelado ou derrubado por boss: não sai do lugar
    const ok = !preso && d <= j.orc + tele + 0.05 && p.y >= baixo - 0.6 && p.y <= chao + ORCAMENTO.altura && (dentroDoMapa(this.mapa, p.x, p.z) || naCais(this.mapa, p.x, p.z) || ((j.veiculo === 'barquinho' || j.veiculo === 'navio') && !!noLago(p.x, p.z))) // barco: o mar também (FASE 3)
      && (j.caverna || !this.alemDoSelo(p.x, p.z, p.y)) // caverna da montanha: do selo para dentro só com o passe usado
      && !this.naNevoa(j, p.x, p.z); // progressão (André 2026-11-10): zona ainda fechada pela névoa, fica na borda
    if (!ok || (j.veiculo && !this.andouVeiculo(j, p.x, p.z, d))) { // veículo: carrinho não entra na água, barco não sai dela
      this.corrigir(j);
      j.cliente = null;
      return false;
    }
    if (tele && d > 1) { j.tele = null; j.orc = Math.max(0, j.orc - Math.max(0, d - tele)); } else j.orc -= d;
    // correndo (pela velocidade de verdade, sem dash, montaria ou parede): gasta estamina
    const dtc = j.cliente ? Math.min(0.5, this.tempo - j.cliente.t) : 0;
    // A velocidade sai da média de ~0,3 s: pacotes que chegam juntos (rede oscilando) pareciam corrida e o trote gastava estamina.
    // Pacote que chega no mesmo tick do anterior (dtc 0) soma os metros e não zera a janela: antes zerava, e no celular
    // (pacotes juntos o tempo todo) a corrida nunca gastava; o servidor mandava a barra cheia de volta (André 2026-11-11).
    if (j.ciente && j.cliente && !mont && !j.arrancada && !j.esc && !(j.dash?.t > 0) && !(tele && d > 1)) {
      const jan = j.janCorrida || (j.janCorrida = { d: 0, t: 0 });
      jan.d += d; jan.t += dtc;
      if (jan.t >= 0.3) {
        if (jan.d / jan.t > HEROI.correr * ESTAMINA.trote * 1.12) this.correndo(j, jan.t);
        jan.d = 0; jan.t = 0;
      }
    } else if (j.janCorrida) { j.janCorrida.d = 0; j.janCorrida.t = 0; }
    if (j.coleta && Math.hypot(p.x - j.coleta.x, p.z - j.coleta.z) > 0.5) this.pararColeta(j); // saiu do lugar: para de coletar
    if (j.pesca && j.pesca.st !== 'pegou' && Math.hypot(p.x - j.pesca.ox, p.z - j.pesca.oz) > 0.7) this.pararPesca(j, 'Você recolheu a linha'); // Quimera: andar recolhe a linha
    if (j.canal && Math.hypot(p.x - j.canal.x, p.z - j.canal.z) > 0.6) this.cancelarCanal(j); // andou: a magia concentrada não sai
    j.x = p.x; j.y = p.y; j.z = p.z; j.ry = p.ry;
    j.chao = p.y - chao < 0.15; j.vy = 0;
    // nadando no lago com o regador vazio pela metade: enche sozinho e avisa (André 2026-11-07)
    if (aguaRegador(j.prog) < HORTA.agua && (noLago(p.x, p.z)?.fundo || 0) > 1.2 && contar(j.prog.mochila, 'regador') > 0) this.encher(j, 'Você mergulhou: regador cheio');
    if (typeof p.anim === 'string' && p.anim.length < 64) j.anim = p.anim; // só aparência, para os outros jogadores
    j.cliente = { t: this.tempo };
    return true;
  }
  // "corrigir" numerado (c): o celular aplica só o mais novo e manda o número de volta em cada posição
  corrigir(j) {
    j.corrSeq = (j.corrSeq || 0) + 1; j.corrT = this.tempo; this.correcoes = (this.correcoes || 0) + 1; // correcoes: /saude
    this.evento({ t: 'corrigir', para: j.id, x: r2(j.x), y: r2(j.y), z: r2(j.z), ry: r2(j.ry), c: j.corrSeq });
  }
  // guiado: o celular move o herói. O app Godot (ciente) que ficou calado (internet engasgada) continua guiado por
  // ORCAMENTO.silencio s: o servidor espera em vez de andar o herói pelo último joystick (o lugar adivinhado era outro e
  // virava rollback; André 2026-11-12). Recusou a posição (cliente null): como antes, o servidor anda pelo joystick.
  guiado(j) {
    if (j.tipo !== 'jogador' || j.morto) return false;
    if (j.cliente && this.tempo - j.cliente.t < 0.5) return true;
    return !!(j.ciente && j.cliente && this.tempo - (j.vivoT ?? -99) < ORCAMENTO.silencio);
  }
  usarHabilidade(id, i) {
    const j = this.jogadores.get(id); if (!j || j.morto || j.esc || j.criando) return;
    if (j.coleta) this.pararColeta(j);
    if (j.pesca) this.pararPesca(j, 'Você recolheu a linha');
    this.cancelarVila(j);
    const antes = this.ator; this.ator = j;
    try { this.usarHabilidadeDe(j, id, i); } finally { this.ator = antes; }
  }
  usarHabilidadeDe(j, id, i) {
    j.montado = null; // luta a pé
    if (i !== 9) j.modo = i === 10 || i > 4 ? 'Magia' : 'Espada'; // golpe usa a espada, magia usa o cajado
    // tocou um pouco antes do golpe atual acabar: guarda e solta assim que ele termina (o combo não perde o ritmo)
    if (j.trava > 0) { if (j.trava < 0.5 && j.trava !== Infinity) j.fila = { i, ate: this.tempo + 0.5 }; return; }
    if (!j.chao || j.arrancada) return;
    // 0 = golpe de espada, 1 a 8 = build (4 de espada e 4 de magia), 9 = cura, 10 = disparo de magia
    const chave = i === 0 ? 'basico' : i === 9 ? 'cura' : i === 10 ? 'magia' : j.build[i - 1];
    const h = i === 0 ? BASICO : i === 9 ? CURA : i === 10 ? BASICO_MAGIA : HABILIDADES[chave]; if (!h) return;
    this.executar(j, chave, h);
  }
  // Solta a habilidade h (com a chave da recarga). Devolve true se saiu.
  executar(j, chave, h) {
    const id = j.id;
    if ((j.cds[chave] || 0) > this.tempo) return false;
    if (h.mana && j.mana < h.mana) { this.evento({ t: 'aviso', para: id, texto: 'Mana insuficiente' }); return false; }
    j.mana -= h.mana || 0;
    j.cds[chave] = this.tempo + h.cd;
    // combo: tocando de novo logo depois do golpe, vem o próximo corte
    let n = 0; const cb = j.combos[chave] || { n: 0, ate: 0 };
    if (h.combo) { n = this.tempo < cb.ate ? (cb.n + 1) % h.combo.length : 0; h = { ...h, ...h.combo[n] }; }
    h = { ...h, chave };
    const alvo = this.maisPerto(j);
    if (alvo && !h.salto) this.virarPara(j, alvo);
    const d = this.tocar(j, h.anim, h.ts || 1, h.segurar || 0);
    if (h.combo) j.combos[chave] = { n, ate: this.tempo + d + 0.35 };
    if (h.lamina) j.acao.lamina = true;
    const at = h.segurar ? 0.05 : d * (h.at || 0.5);
    if (!h.segurar && !h.salto && !h.hits) j.trava = Math.min(d, at + 0.45); // libera o próximo comando logo depois do impacto
    if (h.segurar) { j.defesa = h.defesa; this.depois(h.segurar, () => { j.defesa = 0; }); }
    // investida: para logo na frente do alvo, para o golpe sair assim que chega
    const metros = h.dash && alvo ? Math.max(1.5, Math.min(h.avanco, dist(alvo, j) - 1.1)) : h.avanco;
    if (h.avanco) this.empurrar(j, metros, h.avancoT ? d * h.avancoT : h.hits ? d * 0.8 : at || 0.3);
    if (h.dash) { // investida: arranca como no dash e nenhum golpe pega durante a arrancada
      j.defesa = 1; this.depois(d * h.avancoT, () => { j.defesa = 0; });
      this.evento({ t: 'dash', id: j.id, dur: r2(d * h.avancoT + 0.12), forte: 1 });
    }
    if (h.puxa) this.depois(d * h.puxa.de, () => this.puxar(j, h));
    if (h.salto) {
      this.empurrar(j, h.salto, d * 0.6);
      if (h.q) { j.defesa = 1; this.depois(d * 0.6, () => { j.defesa = 0; }); this.evento({ t: 'dash', id: j.id, dur: r2(d * 0.6), forte: 1 }); }
    }
    if (h.fx) this.evento({ t: 'conjura', id: j.id, hab: chave, dur: r2(h.segurar || d) });
    if (h.hits) h.hits.forEach((f) => this.depois(d * f, () => this.efeitoHabilidade(j, h)));
    else this.depois(at, () => this.efeitoHabilidade(j, h));
    return true;
  }
  // ---------- progressão (ideia do Quimera: shared/progresso.js) ----------
  // Recalcula vida, mana, defesa, dano... a partir do nível e dos atributos. cheio: enche vida e mana.
  aplicarStatus(j, cheio = false) {
    const fv = j.vidaMax ? j.vida / j.vidaMax : 1;
    j.pas = passivasDe(j.prog);
    j.st = calcularStatus(j.prog, j.pas);
    j.vidaMax = j.st.vidaMax; j.manaMax = j.st.manaMax; j.staMax = j.st.estaminaMax; j.sta = Math.min(j.sta ?? j.staMax, j.staMax);
    if (cheio) { j.vida = j.vidaMax; j.mana = j.manaMax; }
    else { j.vida = Math.min(j.vidaMax, Math.max(j.morto ? 0 : 1, Math.round(fv * j.vidaMax))); j.mana = Math.min(j.mana, j.manaMax); }
  }
  // Manda para o próprio jogador o progresso e os números do herói (o menu do personagem mostra)
  avisarProg(j) {
    const st = Object.fromEntries(Object.entries(j.st).map(([k, v]) => [k, Math.round(v * 1e4) / 1e4]));
    this.eventos.push({ t: 'prog', para: j.id, prog: j.prog, st, xpProx: xpProximo(j.prog.nivel), agora: Date.now(), hi: j.bot ? null : this.histInfo(j), ...(j.testador && CONTA_TESTE.nivel ? { teste: true } : {}) }); // hi: a etapa da história (app)
    j.progSujo = true;
  }
  // O servidor grava na conta quem mudou (index.js chama de tempos em tempos e quando o jogador sai)
  progressosParaSalvar() {
    const r = [];
    for (const j of this.jogadores.values()) this.guardarPosicao(j);
    for (const j of this.jogadores.values()) if (j.progSujo) { j.progSujo = false; r.push({ id: j.id, prog: j.prog }); }
    return r;
  }
  ganharXP(j, n) {
    const p = j.prog; if (p.nivel >= NIVEL_MAX) return;
    // NPC (André 2026-11-11): nunca passa do jogador mais alto do servidor (nivelTetoNpc vem do banco; sem banco, sem teto)
    if (j.bot && this.nivelTetoNpc != null && p.nivel >= this.nivelTetoNpc) return;
    const nivelAntes = p.nivel;
    p.xp += n;
    let subiu = false;
    while (p.nivel < NIVEL_MAX && p.xp >= xpProximo(p.nivel) && !(j.bot && this.nivelTetoNpc != null && p.nivel >= this.nivelTetoNpc)) { p.xp -= xpProximo(p.nivel); p.nivel++; p.pontos += PONTOS_POR_NIVEL; subiu = true; }
    if (j.bot && this.nivelTetoNpc != null && p.nivel >= this.nivelTetoNpc) p.xp = Math.min(p.xp, xpProximo(p.nivel) - 1); // parado no teto
    if (!j.bot && this.nivelTetoNpc != null && p.nivel > this.nivelTetoNpc) this.nivelTetoNpc = p.nivel; // jogador subiu: o teto sobe junto
    if (p.nivel >= NIVEL_MAX) p.xp = 0;
    if (subiu) {
      this.aplicarStatus(j, true);
      this.evento({ t: 'nivel', id: j.id, nivel: p.nivel });
      this.evento({ t: 'aviso', para: j.id, texto: `Nível ${p.nivel}! +${PONTOS_POR_NIVEL} pontos de atributo` });
      this.avisarLibera(j, nivelAntes);
      // rumores (André 2026-11-11, história v2): recado curto de um personagem ao subir, depois do capítulo dele
      for (const C of CAPITULOS) if (C.rumores && capFeito(C.n, p.hist?.p || 0)) for (const R of C.rumores) if (R.nv > nivelAntes && R.nv <= p.nivel) this.evento({ t: 'rumor', para: j.id, quem: R.quem, texto: R.texto });
    }
    this.avisarProg(j);
  }
  // Progressão (André 2026-11-10, shared/historia.js): o que abriu nos níveis que acabou de passar e a missão nova
  avisarLibera(j, de) {
    const p = j.prog, nomes = {};
    for (const k of Object.keys(LIBERA_NIVEL.receita)) nomes[k] = ITENS[RECEITAS[k]?.faz || k]?.nome || k;
    for (const k of Object.keys(LIBERA_NIVEL.obra)) nomes[k] = (CONSTRUCOES[k]?.nome || ITENS[k]?.nome || k);
    const novos = []; for (let nv = de + 1; nv <= p.nivel; nv++) novos.push(...liberaNoNivel(nv, nomes));
    if (novos.length) this.evento({ t: 'aviso', para: j.id, texto: `Liberado: ${novos.join(', ')}` });
    const M = missaoAtual(p);
    if (M && !p.hist?.ac && M.nv > de && M.nv <= p.nivel) this.evento({ t: 'aviso', para: j.id, texto: `Missão nova: fale com ${this.nomeNpc(M.npc)} (${M.nome})` });
  }
  nomeNpc(id) { const n = (this.mapa.npcs || []).find((o) => o.id === id); return n ? n.nome.split(',')[0] : id; }
  // o monstro b mora numa região que ainda está fechada para o herói j? (vale o meio do campo de caça dele)
  mobFechadoPara(b, j) {
    if (!j?.prog || b.tipo === 'jogador') return false;
    const d = b.sp?.caca != null ? this.cacas[b.sp.caca]?.def : null, o = d || b.casa || b;
    return !!zonaFechadaEm(j.prog, o.x, o.z);
  }
  // (x, z) está numa zona que a névoa ainda fecha para j? Avisa (no máximo a cada 4 s) qual missão abre
  naNevoa(j, x, z) {
    const Z = zonaFechadaEm(j.prog, x, z); if (!Z) return false;
    if (!(j.nevoaT > this.tempo)) { j.nevoaT = this.tempo + 4; this.evento({ t: 'aviso', para: j.id, texto: textoNevoa(j.prog, Z.id) }); this.evento({ t: 'nevoa', para: j.id, zona: Z.id }); }
    return true;
  }
  // ---------- História principal com etapas (André 2026-11-11, shared/historia.js e HISTORIA em shared/dados.js) ----------
  // Falar com um NPC: dar a missão, cumprir a etapa "falar" (com a fala dele e os itens que ele pega) ou entregar.
  // Devolve true se o NPC falou da história. pediu = o jogador tocou em "Missão" (senão o NPC de serviço, como a cura, a
  // loja ou o reset, faz o que faz sempre quando a etapa não é com ele).
  falaHistoria(j, npc, diga, pediu = false) {
    const p = j.prog, M = missaoAtual(p); if (!M) return false;
    const h = p.hist || (p.hist = histNova());
    if (!h.ac) {
      if (M.npc !== npc.id || p.nivel < M.nv) return false; // ainda cedo: o NPC fala o de sempre
      Object.assign(h, { ac: true, e: 0, n: 0, m: 0 }); j.progSujo = true;
      if (primeiraDoCap(h.p)) { const C = capituloDe(M); if (C) this.evento({ t: 'capitulo', para: j.id, fase: 'abre', n: C.n, nome: C.nome, frase: C.frase, ato: C.ato }); }
      this.evento({ t: 'aviso', para: j.id, texto: 'Missão nova: ' + M.nome });
      if (M.recebe) this.darItens(j, M.recebe);
      if (M.cena) this.cena(j, M.cena); // cena ao aceitar a missão
      diga(M.pedido, { missao: M.id });
      this.checarEtapa(j);
      this.avisarProg(j);
      return true;
    }
    const L = etapasDe(M), E = L[h.e];
    if (E?.ev === 'falar' && E.npc === npc.id) {
      if (E.entregar) {
        const falta = Object.entries(E.entregar).filter(([k, n]) => contar(p.mochila, k) < n);
        if (falta.length) {
          if (!pediu && npc.funcao && !['missao', 'dica'].includes(npc.funcao)) return false;
          diga(`Ainda falta: ${falta.map(([k, n]) => `${ITENS[k].nome} ${contar(p.mochila, k)}/${n}`).join(', ')}.`, { missao: M.id }); return true;
        }
        for (const [k, n] of Object.entries(E.entregar)) tirar(p.mochila, k, n);
      }
      if (h.e >= L.length - 1) return this.concluirMissao(j, M, diga), true;
      if (E.fala) diga(E.fala, { missao: M.id });
      this.proximaEtapa(j);
      return true;
    }
    // a etapa da vez é outra: só o NPC da missão (ou quem o jogador chamou pela missão) lembra o que falta
    if (M.npc !== npc.id && !pediu) return false;
    if (!pediu && npc.funcao && !['missao', 'dica'].includes(npc.funcao)) return false;
    if (M.npc !== npc.id) return false;
    diga(`Primeiro: ${this.textoEtapa(j)}.`, { missao: M.id });
    return true;
  }
  // Cena da história (CENAS em shared/dados.js, godot-prototipo/cinematica.gd): põe o herói no lugar dela, se tiver, e
  // manda o app tocar. Só para quem vê (o herói fica onde a cena deixou).
  cena(j, id) {
    const C = CENAS[id]; if (!C || j.bot) return;
    if (C.heroi?.pos) {
      const [x, z] = C.heroi.pos, y = this.terreno.altura(x, z, (j.y || 0) + 2);
      Object.assign(j, { x, z, y, ry: C.heroi.ry ?? j.ry, vy: 0, chao: true, esc: null });
      this.corrigir(j);
    }
    this.evento({ t: 'cena', para: j.id, id });
    // durante a cena (no meio da luta, do lado dos monstros) ninguém bate no herói: a soma das tomadas e a saída
    j.cenaAte = this.tempo + C.tomadas.reduce((a, T) => a + (T.d || 3), 0) + 1.5;
  }
  // monstro c caiu e j ganhou: conta na etapa de matar (campo, tipo e chefe da história)
  contarHistoria(j, c) {
    const campo = c.sp?.caca != null ? this.cacas[c.sp.caca]?.def?.id : null;
    this.historia(j, 'matar', { campo, tipo: c.tipo, hc: c.hc || null, sala: c.sp?.caverna || null });
  }
  // Algo aconteceu com j (ev e dados d): conta na etapa da vez se casar (shared/historia.js casaEtapa)
  historia(j, ev, d = {}) {
    const p = j?.prog, h = p?.hist; if (!h?.ac || j.bot) return;
    const M = HISTORIA[h.p], E = M && etapasDe(M)[h.e]; if (!E || E.ev === 'falar') return;
    const add = casaEtapa(E, ev, d); if (!add) return;
    const t = totalEtapa(E);
    h.n = Math.min(t, h.n + add); j.progSujo = true;
    if (h.n >= t) return this.proximaEtapa(j);
    this.evento({ t: 'aviso', para: j.id, texto: `${E.txt}: ${h.n}/${t}` });
    this.avisarProg(j);
  }
  proximaEtapa(j) {
    const h = j.prog.hist, M = HISTORIA[h.p], L = etapasDe(M), E = L[h.e];
    if (E?.cena) this.cena(j, E.cena); // cena ao terminar a etapa
    if (E?.diz) this.evento({ t: 'aviso', para: j.id, texto: E.diz });
    h.e++; h.n = 0; h.m = 0; j.progSujo = true;
    const N = L[h.e];
    if (!N) return this.concluirMissao(j, M, null);
    this.evento({ t: 'etapa', para: j.id, txt: N.txt, e: h.e, total: L.length });
    if (!this.checarEtapa(j)) this.avisarProg(j);
  }
  // a etapa da vez já está feita? (ja: o que o herói já tem; ter: itens na mochila; noite; lugar). Avança se sim.
  checarEtapa(j) {
    const p = j.prog, h = p.hist, E = etapaAtual(p); if (!E) return false;
    if (E.cena && j.cenaAte > this.tempo && (E.ev === 'pos' || E.ev === 'pistas')) return false; // etapa de lugar com cena espera a cena que está tocando (duas não se atropelam)
    let feito = false;
    if (E.ja === 'lote') feito = !!this.loteDe(j);
    else if (E.ja === 'peca') { // peças do terreno: com n > 1 conta quantas já estão lá (4 fundações)
      const q = this.loteDe(j)?.pecas.filter((o) => o.k === E.k).length || 0;
      if ((E.n || 1) > 1 && Math.min(q, E.n) > h.n) { h.n = Math.min(q, E.n); j.progSujo = true; this.avisarProg(j); }
      feito = q >= (E.n || 1);
    }
    else if (E.ja === 'tem') feito = contar(p.mochila, E.k) > 0 || (E.k === 'barquinho' && j.veiculo === 'barquinho') || (E.k === 'navio' && !!p.navio); // navio já feito (na água ou no porto)
    else if (E.ja === 'atributos') feito = Object.values(p.atr).some((v) => v > 3);
    else if (E.ja === 'passe') feito = contar(p.mochila, 'passe_caverna') > 0; // já tem o Passe da Caverna
    else if (E.ja === 'carrinho') feito = (p.carrinho?.lv || 0) >= (E.min || 1); // carrinho já no nível pedido
    else if (E.ja === 'totem') feito = (p.totens || []).includes(E.k); // já tocou esse totem antes
    else if (E.ja === 'arma') feito = Math.max(p.equip?.espada?.r ?? -1, p.equip?.cajado?.r ?? -1) >= (E.min || 0); // arma equipada dessa raridade
    else if (E.ja === 'carro_ok') feito = !!p.carrinho && !p.carrinho.quebrado && p.carrinho.vida >= VEICULOS.carrinho.vida; // inteiro
    if (!feito && E.ev === 'ter') {
      const n = Object.entries(E.itens).reduce((a, [k, q]) => a + Math.min(q, contar(p.mochila, k)), 0);
      if (n !== h.n) { h.n = n; j.progSujo = true; this.avisarProg(j); }
      feito = n >= totalEtapa(E);
    }
    if (!feito && E.ev === 'noite') feito = ehNoite(horaDoJogo(p.dia));
    if (!feito && E.ev === 'time') feito = (j.time?.membros.length || 0) >= 2; // alguém no time (a Cecília e o Dario contam)
    if (!feito && E.ev === 'pos' && !j.morto) {
      const [x, z, r, y] = E.pos;
      feito = Math.hypot(j.x - x, j.z - z) <= r && (y == null || (j.y || 0) >= y) && (!E.barco || j.veiculo === 'barquinho') && (!E.caverna || !!j.caverna)
        && (!E.navio || j.veiculo === 'navio') && (E.ate == null || (j.y || 0) <= E.ate); // navio; ate: abaixo dessa altura (no túnel da gruta, não no morro em cima)
    }
    if (!feito && E.ev === 'pistas' && !j.morto) {
      E.pontos.forEach(([x, z, nome], i) => {
        if (h.m & (1 << i) || Math.hypot(j.x - x, j.z - z) > 3.5) return;
        h.m |= 1 << i; h.n = Math.min(E.pontos.length, h.n + 1); j.progSujo = true;
        this.evento({ t: 'aviso', para: j.id, texto: `Pista: ${nome} (${h.n}/${E.pontos.length})` });
        this.avisarProg(j);
      });
      feito = h.n >= E.pontos.length;
    }
    if (feito) this.proximaEtapa(j);
    return feito;
  }
  // a cada meio segundo: etapas de lugar, noite e mochila, e o chefe da história aparece para quem chega no campo dele
  passoHistoria(dt) {
    this.histT = (this.histT || 0) - dt; if (this.histT > 0) return;
    this.histT = 0.5;
    for (const j of this.jogadores.values()) {
      if (j.bot || j.criando || !j.prog.hist?.ac) continue;
      const E = etapaAtual(j.prog); if (!E) continue;
      if (E.ja || ['ter', 'noite', 'pos', 'pistas', 'time'].includes(E.ev)) this.checarEtapa(j);
      if (E.hc) this.chamarChefe(j, E.hc);
    }
  }
  // Chefe com nome (CHEFES_HISTORIA): um monstro vivo do campo vira o chefe quando o herói da etapa está a menos de 60 m
  // (o mesmo modelo, maior e com outro brilho). Morto, some como os outros e a vaga volta normal.
  chamarChefe(j, id) {
    const C = CHEFES_HISTORIA[id]; if (!C) return;
    if (C.noite && !ehNoite(horaDoJogo(j.prog.dia))) return;
    if (this.inimigos.some((e) => e.hc === id && !e.morto)) return;
    let e = null;
    if (C.sala) { // sala da caverna da montanha: o monstro da sala vira o chefe quando o herói está lá dentro, perto dela
      const S = this.dungeon?.salas.find((o) => o.def.id === C.sala); if (!S || !j.caverna) return;
      const pt = S.def.pontos[0]; if (Math.hypot(j.x - pt.x, j.z - pt.z) > 25) return;
      e = S.vagas.map((vg) => vg.e).find((o) => o && !o.morto && o.tipo === C.tipo && !o.hc && !(o.atacantes?.size));
    } else {
      const ci = this.cacas.findIndex((c) => c.def.id === C.campo); if (ci < 0) return;
      const def = this.cacas[ci].def; if (Math.hypot(j.x - def.x, j.z - def.z) > 60) return;
      e = this.inimigos.find((o) => o.sp?.caca === ci && !o.morto && o.tipo === C.tipo && !o.hc && !(o.atacantes?.size));
    }
    if (!e) return;
    Object.assign(e, { hc: id, nome: C.nome, esc: C.escala, cor: C.cor, vidaMax: Math.round(e.vidaMax * C.vida), dano: Math.round((e.dano || 0) * C.dano) });
    e.vida = e.vidaMax;
    if (C.skills) { // golpes com aviso no chão (Entrega 5: Arauto, Sentinela, Vesper), no espaço do campo ou da sala da gruta
      const def = this.cacas[e.sp?.caca]?.def;
      Object.assign(e, { hcSk: true, skillCd: COMBATE_BOSS.primeiraSkill, skillI: 0, skillSeq: 0, faseI: 0, arena: { x: def?.x ?? e.x, z: def?.z ?? e.z, r: Math.max(def?.r || 8, 8) } });
    }
    this.evento({ t: 'aviso', para: j.id, texto: `${C.nome} apareceu!` });
  }
  // Chefe da história que para a luta no meio (foge em CHEFES_HISTORIA, o Kael): diz a fala, some na névoa e conta como
  // vencido para quem lutou com ele ou estava perto. Sem XP nem drop: o prêmio é o da missão.
  fugirChefe(c) {
    const C = CHEFES_HISTORIA[c.hc];
    for (const j of this.jogadores.values()) {
      if (j.morto || j.criando || !(c.atacantes?.has(j.id) || dist(j, c) < 14)) continue;
      if (C.fala) this.evento({ t: 'aviso', para: j.id, texto: C.fala });
      this.contarHistoria(j, c);
    }
    this.evento({ t: 'nevoa_some', x: r2(c.x), y: r2(c.y || 0), z: r2(c.z) });
    c.morto = true; c.atacantes = null; c.trava = Infinity;
    const i = this.inimigos.indexOf(c); if (i >= 0) this.inimigos.splice(i, 1); // some na hora (a vaga do campo abre)
    if (c.sp?.caca != null) { const vg = this.cacas[c.sp.caca].vagas[c.sp.vaga]; if (vg?.e === c) vg.e = null; }
  }
  // missão entregue: prêmio, presente, o que libera, cartão do fim do capítulo e a próxima missão
  concluirMissao(j, M, diga) {
    const p = j.prog, h = p.hist, i = h.p;
    Object.assign(h, { p: h.p + 1, ac: false, e: 0, n: 0, m: 0, u: M.id }); j.progSujo = true; // u: a última entregue (historia.js histValida)
    const abre = M.libera.length > 0 || !!M.grande, P = HISTORIA_PREMIO; // grande: a última missão vale como a que abre região
    const ouro = (abre ? P.ouro : P.ouroEtapa) * M.nv; p.ouro = (p.ouro || 0) + ouro;
    this.evento({ t: 'aviso', para: j.id, texto: `Missão cumprida: ${M.nome} (+${ouro} de ouro)` });
    if (M.presente) this.darItens(j, M.presente);
    if (M.gravar) this.gravarEstrela(j); // capítulo 15: o Tomás grava a estrela na arma (+1 de reforço)
    if (M.titulo) this.evento({ t: 'aviso', para: j.id, texto: `Título novo: ${M.titulo}` }); // título do ato (histInfo.titulo)
    this.evento({ t: 'historia', para: j.id, id: M.id, libera: M.libera });
    for (const k of M.libera) this.evento({ t: 'aviso', para: j.id, texto: `Liberado: ${nomeLibera(k)}` });
    if (diga) diga(M.pronto, { missao: M.id });
    else if (M.pronto) this.evento({ t: 'aviso', para: j.id, texto: `${this.nomeNpc(M.npc)}: ${M.pronto}` });
    if (ultimaDoCap(i)) {
      const C = capituloDe(M), N = HISTORIA[h.p], CN = N && capituloDe(N);
      if (C) this.evento({ t: 'capitulo', para: j.id, fase: 'fecha', n: C.n, nome: C.nome, prox: CN ? { n: CN.n, nome: CN.nome, nv: N.nv } : null });
    }
    this.ganharXP(j, Math.round(xpProximo(M.nv) * (abre ? P.xp : P.xpEtapa)));
    const N = missaoAtual(p); if (N && N.nv <= p.nivel) this.evento({ t: 'aviso', para: j.id, texto: `Próxima missão: fale com ${this.nomeNpc(N.npc)}` });
    this.avisarProg(j);
  }
  // a estrela na lâmina (história v2, capítulo 15): a melhor arma equipada ganha +1 de reforço de graça (até o máximo)
  gravarEstrela(j) {
    const p = j.prog, a = ['espada', 'cajado'].map((l) => p.equip?.[l]).filter(Boolean).sort((x, y) => (y.r | 0) - (x.r | 0))[0];
    if (!a) return;
    const max = REFORCO.max[a.r] || 0;
    if ((a.e | 0) < max) a.e = (a.e | 0) + 1;
    this.aplicarStatus(j);
    this.evento({ t: 'aviso', para: j.id, texto: `A estrela de Aurora está gravada: ${nomeItem(a)} +${a.e | 0}` });
  }
  // itens de presente (sem lugar na mochila, o resto cai no baú do correio? não: avisa e perde só o que não coube)
  darItens(j, itens) {
    const p = j.prog, ganhou = [];
    for (const [k, v] of Object.entries(itens)) {
      const it = typeof v === 'object' ? { k, r: v.r ?? 0, ...(v.e ? { e: v.e } : {}) } : { k, n: v };
      if (guardar(p.mochila, it)) ganhou.push(typeof v === 'object' ? nomeItem(it) + (v.e ? ` +${v.e}` : '') : `${v} ${ITENS[k].nome}`);
      else this.evento({ t: 'aviso', para: j.id, texto: `Mochila cheia: ${nomeItem(it)} não coube` });
    }
    if (ganhou.length) this.evento({ t: 'aviso', para: j.id, texto: `Presente: ${ganhou.join(', ')}` });
    this.aplicarStatus(j);
  }
  // texto da etapa da vez com o andamento ("Derrube Puglins na Clareira dos Puglins 3/6")
  textoEtapa(j) {
    const p = j.prog, h = p.hist, M = missaoAtual(p); if (!M) return '';
    if (!h?.ac) return p.nivel < M.nv ? `Libera no Nv ${M.nv} (${this.nomeNpc(M.npc)})` : `Fale com ${this.nomeNpc(M.npc)}`;
    const E = etapaAtual(p); if (!E) return '';
    const t = totalEtapa(E);
    let txt = E.txt + (t > 1 ? ` ${h.n}/${t}` : '');
    if (E.ev === 'noite') { const hr = horaDoJogo(p.dia); txt += ` · agora são ${String(Math.floor(hr)).padStart(2, '0')}h`; }
    return txt;
  }
  // para onde o "Ir" do quadrinho leva: { x, z, nome, npc } ou null
  // "Ir" para dentro de uma caverna do mundo grande (o covil, o selo do fundo): enquanto o herói está fora do túnel, o
  // alvo é a boca da caverna (a rota pela estrada chega na frente dela; o ponto lá dentro fica debaixo do morro)
  alvoHistoria(j) {
    const a = this.alvoHistoriaDentro(j); if (!a) return a;
    const T = TUNEIS.find((C) => C.def?.linha && noTunel(C, a.x, a.z, 1)); if (!T) return a;
    const dentro = noTunel(T, j.x, j.z, 1); if (dentro && (j.y || 0) < dentro.y + 6) return a;
    const [bx, bz] = T.def.linha[0];
    return { x: bx, z: bz, nome: `a entrada da ${T.def.nome || 'caverna'}`, npc: '' };
  }
  alvoHistoriaDentro(j) {
    const p = j.prog, h = p.hist, M = missaoAtual(p); if (!M) return null;
    const npcEm = (id) => { const n = (this.mapa.npcs || []).find((o) => o.id === id); return n ? { x: r2(n.x), z: r2(n.z), nome: n.nome.split(',')[0], npc: n.id } : null; };
    if (!h?.ac) return npcEm(M.npc);
    const E = etapaAtual(p); if (!E) return null;
    const aberto = (x, z) => !zonaFechadaEm(p, x, z);
    const resolve = (a) => {
      if (!a) return null;
      if (a === 'pos') { const [x, z] = E.pos; return { x, z, nome: E.txt, npc: '' }; }
      if (a === 'treino') { const t = this.inimigos.find((e) => e.treino); return t ? { x: r2(t.x), z: r2(t.z), nome: 'o espantalho', npc: '' } : null; }
      if (a === 'lote') { const L = this.loteDe(j), d = L?.def || VILAS_TERRENO[0].area; return L ? { x: r2((d.x0 + d.x1) / 2), z: r2((d.z0 + d.z1) / 2), nome: 'o seu terreno', npc: '' } : { x: d.x, z: d.z, nome: 'as Terras da Estrada', npc: '' }; }
      if (a === 'spot') {
        let b = null, md = Infinity;
        for (const v of this.spots) if (v.ativo && v.tipo === 'comum' && aberto(v.x, v.z)) { const d = Math.hypot(v.x - j.x, v.z - j.z); if (d < md) { md = d; b = v; } }
        return b ? { x: r2(b.x), z: r2(b.z), nome: 'o spot de pesca', npc: '' } : { x: -3, z: 180, nome: 'o Lago Grande', npc: '' };
      }
      const [tipo, id] = a.split(':');
      if (tipo === 'npc') return npcEm(id);
      if (tipo === 'totem') { const t = TOTENS.lista.find((o) => o.id === id); return t ? { x: t.x, z: t.z, nome: 'o totem de ' + t.nome, npc: '' } : null; }
      if (tipo === 'estacao') { const E = (this.mapa.estacoes || []).find((o) => o.id === id); return E ? { x: r2(E.x), z: r2(E.z), nome: E.nome, npc: '', estacao: E.id } : null; }
      if (tipo === 'caca') { const c = this.cacaDef(id); return c ? { x: c.x, z: c.z, nome: c.nome || 'o campo', npc: '' } : null; }
      if (tipo === 'veio' || a === 'solto') {
        const tipos = a === 'solto' ? ['galho', 'pedrinha'] : [id];
        let b = null, md = Infinity;
        for (const no of this.coletaveis.values()) {
          if (!tipos.includes(no.tipo) || !aberto(no.x, no.z)) continue;
          const d = Math.hypot(no.x - j.x, no.z - j.z); if (d < md && this.cargas(j, no) > 0) { md = d; b = no; }
        }
        return b ? { x: r2(b.x), z: r2(b.z), nome: COLETA[b.tipo]?.nome || 'o recurso', npc: '' } : null;
      }
      return null;
    };
    if (E.ev === 'falar') return npcEm(E.npc);
    if (E.ev === 'pistas') { const i = E.pontos.findIndex((q, k) => !(h.m & (1 << k))); const q = E.pontos[Math.max(0, i)]; return { x: q[0], z: q[1], nome: q[2], npc: '' }; }
    if (E.hc) { // chefe da caverna (sala, sem campo) que ainda não apareceu: vale o lugar da etapa (robô das missões: o Ir do Trono não levava a lugar nenhum)
      const C = CHEFES_HISTORIA[E.hc], c = this.cacaDef(C?.campo), b = this.inimigos.find((e) => e.hc === E.hc && !e.morto);
      if (b) return { x: r2(b.x), z: r2(b.z), nome: C.nome, npc: '' };
      if (c) return { x: c.x, z: c.z, nome: c.nome || C.nome, npc: '' };
      const S = C?.sala && this.dungeon?.salas.find((o) => o.def.id === C.sala)?.def.pontos[0];
      return E.alvo ? resolve(E.alvo) : S ? { x: r2(S.x), z: r2(S.z), nome: C.nome, npc: '' } : null;
    }
    if (E.alvo && typeof E.alvo === 'object') { const k = Object.keys(E.alvo).find((q) => contar(p.mochila, q) < E.itens[q]); return resolve(E.alvo[k || Object.keys(E.alvo)[0]]); }
    if (E.alvo) return resolve(E.alvo);
    if (E.ev === 'matar' && E.campos) { let b = null, md = Infinity; for (const id of E.campos) { const c = this.cacaDef(id); if (c && aberto(c.x, c.z)) { const d = Math.hypot(c.x - j.x, c.z - j.z); if (d < md) { md = d; b = c; } } } return b ? { x: b.x, z: b.z, nome: b.nome || 'o campo', npc: '' } : null; }
    return null;
  }
  cacaDef(id) { return this.cacas.find((c) => c.def.id === id)?.def || null; }
  // o que o app mostra da história (quadrinho da missão, botão Ir, botão "Missão" no NPC certo, marca no chão)
  histInfo(j) {
    const p = j.prog, h = p.hist, M = missaoAtual(p); if (!M || !h) return null;
    const E = h.ac ? etapaAtual(p) : null;
    const npc = !h.ac ? (p.nivel >= M.nv ? M.npc : '') : E?.ev === 'falar' ? E.npc : '';
    const tit = HISTORIA.slice(0, h.p).filter((o) => o.titulo).at(-1)?.titulo || ''; // título do último ato fechado
    // ev/k/min/de: o tipo da etapa, para o guia do app (guia.gd, André 2026-11-12: o botão do próximo toque pisca)
    const guia = E ? { ev: E.ev, ...(E.k != null ? { k: E.k } : {}), ...(E.min != null ? { min: E.min } : {}), ...(E.de != null ? { de: E.de } : {}), ...(E.skill ? { skill: true } : {}), ...(E.barco ? { barco: true } : {}) } : {};
    return { id: M.id, cap: M.cap, nome: M.nome, txt: this.textoEtapa(j), e: h.ac ? h.e : -1, npc, alvo: this.alvoHistoria(j), marca: !!E?.marca || E?.ev === 'pistas', ...guia, ...(tit ? { titulo: tit } : {}), ...(h.ac && E?.ev === 'resetar' && E.gratis ? { resetGratis: true } : {}) }; // resetGratis: a Mestra Iara não cobra (main.gd custo_reset)
  }
  // Só para a conta de teste do André (2026-11-06: "um hackzinho de XP para eu aumentar ou diminuir meu nível para fazer
  // testes"): escolhe o nível na hora. Os pontos de atributo acompanham; se descer abaixo do que já gastou, os atributos
  // voltam para 3 (os pontos voltam todos para distribuir). Ninguém mais consegue usar: o servidor confere a conta.
  // zerar = true: atributos de volta para 3 de graça, sem ir ao Mestre Ivo (André: "tem um resetar os pontos também").
  nivelTeste(id, nv, zerar = false) {
    const j = this.jogadores.get(id); if (!j || !j.testador || !CONTA_TESTE.nivel || !Number.isInteger(nv)) return; // desligado: CONTA_TESTE.nivel
    const p = j.prog; nv = Math.max(1, Math.min(NIVEL_MAX, nv));
    let gastos = Object.values(p.atr).reduce((s, v) => s + v - 3, 0);
    if (zerar || gastos > PONTOS_POR_NIVEL * (nv - 1)) { for (const k of Object.keys(p.atr)) p.atr[k] = 3; gastos = 0; }
    p.nivel = nv; p.xp = 0; p.pontos = PONTOS_POR_NIVEL * (nv - 1) - gastos;
    this.aplicarStatus(j, true);
    this.evento({ t: 'nivel', id: j.id, nivel: nv });
    this.evento({ t: 'aviso', para: id, texto: zerar ? `Teste: pontos zerados (nível ${nv})` : `Teste: nível ${nv}` });
    this.avisarProg(j);
  }
  // Ponto livre num atributo (for, des, int, vit)
  distribuirAtributo(id, k) {
    const j = this.jogadores.get(id); if (!j || !ATRIBUTOS[k] || j.prog.pontos <= 0) return;
    j.prog.atr[k]++; j.prog.pontos--;
    this.aplicarStatus(j);
    this.historia(j, 'atributo');
    this.avisarProg(j);
  }
  // Vários pontos de uma vez (o menu junta com + e − e manda só no Confirmar): { for: 2, vit: 1 }.
  // Ou entra tudo ou nada: chave errada, número quebrado/negativo ou mais pontos do que tem = recusa.
  distribuirAtributos(id, mapa) {
    const j = this.jogadores.get(id); if (!j || !mapa || typeof mapa !== 'object' || Array.isArray(mapa)) return;
    const p = j.prog, ks = Object.keys(mapa);
    if (!ks.length || ks.some((k) => !ATRIBUTOS[k] || !Number.isInteger(mapa[k]) || mapa[k] < 0)) return;
    const total = ks.reduce((s, k) => s + mapa[k], 0);
    if (total <= 0 || total > p.pontos) return;
    for (const k of ks) p.atr[k] += mapa[k];
    p.pontos -= total;
    this.aplicarStatus(j);
    this.historia(j, 'atributo');
    this.avisarProg(j);
  }
  // Mestre Ivo (NPC funcao 'resetar', perto de onde o herói nasce): atributos voltam para 3 e os pontos voltam; skills ficam
  // o primeiro reset com a Mestra Iara é de graça, dentro da história (capítulo 10: etapa 'resetar' com gratis)
  custoReset(j) { const E = etapaAtual(j.prog); return E?.ev === 'resetar' && E.gratis ? 0 : Math.max(RESET_BUILD.minimo, RESET_BUILD.porNivel * j.prog.nivel); }
  resetarBuild(id) {
    const j = this.jogadores.get(id); if (!j || j.morto || j.criando) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if (!(this.mapa.npcs || []).some((n) => n.funcao === 'resetar' && dist(n, j) < 4.5)) return aviso('Fale com o Mestre Ivo, na Clareira, ou com a Mestra Iara, no Rio Claro');
    const p = j.prog, gastos = Object.values(p.atr).reduce((s, v) => s + v - 3, 0), custo = this.custoReset(j);
    if (gastos <= 0) return aviso('Você ainda não gastou nenhum ponto.');
    if (p.ouro < custo) return aviso(`Falta ouro: custa ${custo}`);
    p.ouro -= custo;
    for (const k of Object.keys(p.atr)) p.atr[k] = 3;
    p.pontos += gastos;
    this.aplicarStatus(j);
    this.avisarProg(j);
    aviso(`Build resetada: ${gastos} pontos para distribuir de novo`);
    this.historia(j, 'resetar');
  }
  // Uma das duas barras (espada ou cajado): 6 botões, só skill que serve nela, sem repetir (null = vazio)
  definirBarra(id, m) {
    const j = this.jogadores.get(id); if (!j || !m || !BARRAS.includes(m.barra)) return;
    const b = barraValida(m.lista, m.barra); if (!b) return;
    j.prog.barras[m.barra] = b;
    this.historia(j, 'barra');
    this.avisarProg(j);
  }
  // ---------- skills do Quimera (cada tipo = uma função do Quimera, com os mesmos números) ----------
  // Números da skill no nível dela, já com o dano em pontos (Força para espada, Inteligência para cajado)
  habPronta(j, hid) {
    const base = HABS[hid], h = habNoNivel(hid, j.prog.habs[hid]?.nv || 1);
    const dano = base.arvore === 'cajado' ? j.st.danoMagico : base.arvore === 'espada' ? j.st.danoFisico : Math.max(j.st.danoFisico, j.st.danoMagico);
    h.q = true; h.id = hid; h.chave = hid;
    h.dmg = dano * (h.pct || 0);
    if (!base.basico) h.cd = h.cd * (1 - j.st.recarga);
    if (j.st.areaK && !base.basico) { // conjunto de 6 peças: área das skills maior
      if (h.area) h.area = r2(h.area * (1 + j.st.areaK));
      if (h.proj?.explosao) h.proj = { ...h.proj, explosao: r2(h.proj.explosao * (1 + j.st.areaK)) };
    }
    return h;
  }
  // O alvo que a skill precisa (como no Quimera: sem ninguém no alcance ela nem sai). false = não pode soltar.
  alvoHab(j, h) {
    const t = h.tipo;
    if (t === 'basicoEspada') return this.maisPerto(j, h.alcance + 1.5);
    if (t === 'corte' || t === 'esmagar') return this.maisPerto(j, h.lunge.r);
    if (t === 'basicoMagia' || t === 'bola' || t === 'cadeia' || t === 'meteoro' || t === 'investida') return this.maisPerto(j, h.alcance + 0.5) || false;
    if (t === 'anel' || t === 'gelo' || t === 'puxar') return this.maisPerto(j, h.area) || false;
    return null;
  }
  // Alvo travado do mago (André 2026-11-03): o celular manda o índice v do monstro que está travado (o 1º ataque
  // pega o mais perto; só troca tocando em outro ou quando ele morre). Vale se está vivo e no alcance; senão null
  // e a skill pega o mais perto como antes (celular antigo não manda v).
  alvoTravado(j, h, m) {
    if (!m || typeof m !== 'object' || !Number.isInteger(m.v) || m.v < 0) return null;
    if (!['basicoMagia', 'bola', 'cadeia', 'meteoro'].includes(h.tipo)) return null;
    const o = this.inimigos.find((e) => e.v === m.v && !e.morto);
    if (!o || Math.abs((o.y || 0) - (j.y || 0)) > 3) return null;
    return dist(o, j) < h.alcance + 1.5 ? o : null; // folga de 1 m pelo atraso da rede
  }
  // Usa uma skill (botão da barra da arma na mão, ou o ataque básico). m: id ou { id, dx, dz } (direção do joystick)
  usarHabQ(id, m) {
    const hid = typeof m === 'string' ? m : m?.id;
    const j = this.jogadores.get(id), base = HABS[hid];
    if (!j || j.morto || j.esc || j.criando || !base) return;
    if (j.coleta) this.pararColeta(j);
    this.cancelarVila(j);
    if (base.libera > j.prog.nivel) return this.evento({ t: 'aviso', para: id, texto: `Libera no nível ${base.libera}` });
    if (!base.basico && !BARRAS.some((b) => j.prog.barras[b].includes(hid))) return;
    const antes = this.ator; this.ator = j;
    try {
      j.montado = null;
      if (j.canal) return; // concentrando outra magia
      if (j.trava > 0) { if (j.trava < 0.5 && j.trava !== Infinity) j.fila = { q: m, ate: this.tempo + 0.5 }; return; }
      if (!j.chao || j.arrancada || (j.cds[hid] || 0) > this.tempo) return;
      const h = this.habPronta(j, hid);
      if (h.mana && j.mana < h.mana) return this.evento({ t: 'aviso', para: id, texto: 'Mana insuficiente' });
      const alvo = this.alvoTravado(j, h, m) || this.alvoHab(j, h);
      if (alvo === false) return this.evento({ t: 'aviso', para: id, texto: this.maisPerto(j, 40) ? 'Longe demais' : 'Nenhum inimigo por perto' });
      if (base.arvore === 'espada') j.modo = 'Espada'; else if (base.arvore === 'cajado') j.modo = 'Magia';
      j.mana -= h.mana || 0;
      if (alvo) this.virarPara(j, alvo);
      if (h.canal) { // magia concentrada: sai no fim; andar, pular ou dar dash cancela (volta 70% da mana)
        const c = j.canal = { hid, h, alvo, x: j.x, z: j.z };
        this.tocarQ(j, h.anim, h.canal / h.at);
        j.trava = h.canal;
        this.evento({ t: 'conjura', id: j.id, hab: hid, dur: r2(h.canal / h.at) });
        this.depois(h.canal, () => {
          if (j.canal !== c || j.morto) return;
          j.canal = null;
          j.cds[hid] = this.tempo + h.cd;
          this.soltarQ(j, h, alvo && !alvo.morto ? alvo : this.alvoHab(j, h) || null, m);
          this.contarUso(j, hid); // ataque básico também (André 2026-11-07: estava travado no Nv 1)
        });
        return;
      }
      j.cds[hid] = this.tempo + h.cd;
      this.soltarQ(j, h, alvo, m);
      this.contarUso(j, hid); // ataque básico também (André 2026-11-07: estava travado no Nv 1)
    } finally { this.ator = antes; }
  }
  cancelarCanal(id, motivo = 'Cancelado') {
    const j = typeof id === 'string' ? this.jogadores.get(id) : id; if (!j?.canal) return;
    j.mana = Math.min(j.manaMax, j.mana + (j.canal.h.mana || 0) * 0.7);
    j.canal = null; j.trava = 0; j.acao = null;
    this.evento({ t: 'aviso', para: j.id, texto: motivo });
  }
  // Toca uma animação com a duração em segundos (as skills do Quimera dizem quanto tempo cada uma dura)
  tocarQ(c, nome, dur) {
    c.acao = { nome, ts: (DURACAO[nome] || 1) / dur, segurar: false }; c.acaoSeq++;
    c.trava = dur;
    return dur;
  }
  // golpe do Quimera: dano (com crítico) e o inimigo voa para longe do ponto p
  bater(j, o, n, h, p = j) {
    this.ferir(o, n, j, h);
    if (o.morto || !h.empurra || o.tipo === 'chefe' || TIPOS_INIMIGO[o.tipo]?.chefe || o.bm || o.firmeAte > this.tempo) return;
    const d = Math.hypot(o.x - p.x, o.z - p.z) || 1, t = 0.22;
    o.dash = { vx: (o.x - p.x) / d * h.empurra / t, vz: (o.z - p.z) / d * h.empurra / t, t };
  }
  areaQ(j, p, r, n, h) {
    const alvos = this.inimigosDe(j).filter((o) => dist(o, p) < r + 0.3 && Math.abs((o.y || 0) - (j.y || 0)) < 2.2);
    for (const o of alvos) this.bater(j, o, n, h, p);
    return alvos;
  }
  // passo até o inimigo mais perto antes do golpe (lunge do Quimera); o celular faz o mesmo no herói dele
  lunge(j, alvo, para, dur) {
    if (!alvo) return;
    const d = dist(alvo, j) - para;
    if (d > 0.3 && !this.guiado(j)) this.empurrar(j, d, dur);
  }
  soltarQ(j, h, alvo, m) {
    const t = h.tipo, chefe = (o) => o.tipo === 'chefe' || !!TIPOS_INIMIGO[o.tipo]?.chefe || !!o.bm;
    if (t === 'basicoEspada') {
      const cb = j.comboQ || { n: -1, fim: 0 };
      const n = this.tempo - cb.fim > h.comboZera ? 0 : (cb.n + 1) % h.combo.length, g = h.combo[n];
      j.comboQ = { n, fim: this.tempo + g.dur };
      if (g.dur > h.cd) j.cds[h.id] = this.tempo + g.dur; // o 4º golpe é mais longo
      this.tocarQ(j, g.anim, g.dur); j.acao.lamina = true;
      this.depois(g.hit, () => {
        if (j.morto) return;
        let acertou = 0;
        for (const o of this.inimigosDe(j)) {
          if (Math.abs((o.y || 0) - (j.y || 0)) > 1.6 || dist(o, j) > h.alcance) continue;
          if (Math.abs(angDif(Math.atan2(o.x - j.x, o.z - j.z), j.ry)) > h.arco / 2) continue;
          this.bater(j, o, h.dmg, h); acertou++;
        }
        if (!acertou && alvo && !alvo.morto && dist(alvo, j) < 3.6) this.bater(j, alvo, h.dmg, h);
      });
    } else if (t === 'basicoMagia') {
      const mao = j.maoQ = (j.maoQ || 0) ^ 1, g = h.combo[mao];
      this.tocarQ(j, g.anim, g.dur);
      // alvo morreu antes do tiro sair (André 2026-11-04): vai no mais perto do alcance; sem ninguém, não atira no ar
      this.depois(g.hit, () => {
        if (j.morto) return;
        const a = alvo && !alvo.morto ? alvo : this.maisPerto(j, h.alcance + 0.5);
        if (!a) return;
        if (a !== alvo) this.virarPara(j, a);
        this.lancar(j, h, a);
      });
    } else if (t === 'corte' || t === 'esmagar') {
      this.lunge(j, alvo, h.lunge.para, 0.2);
      this.tocarQ(j, h.anim, h.dur); j.acao.lamina = true;
      this.evento({ t: 'conjura', id: j.id, hab: h.id, dur: h.dur });
      for (const s of h.hits) this.depois(s, () => {
        if (j.morto) return;
        const p = this.aFrente(j, h.ponto);
        const hh = t === 'esmagar' ? { ...h, atordoa: 0 } : h;
        for (const o of this.areaQ(j, p, h.area, h.dmg, hh)) if (t === 'esmagar' && !chefe(o) && !o.morto) { o.parado = Math.max(o.parado || 0, this.tempo + h.atordoa); o.ef = 'atordoado'; o.trava = 0; o.acao = null; }
        this.evento({ t: 'explosao', x: r2(p.x), z: r2(p.z), r: h.area, fx: h.id, ry: r2(j.ry) }); // ry: o app desenha o corte nessa direção
      });
    } else if (t === 'giro' || t === 'pisao') {
      this.tocarQ(j, h.anim, h.dur); j.acao.lamina = true;
      this.evento({ t: 'conjura', id: j.id, hab: h.id, dur: h.dur });
      for (const s of h.hits) this.depois(s, () => {
        if (j.morto) return;
        this.areaQ(j, j, h.area, h.dmg, h);
        this.evento({ t: 'explosao', x: r2(j.x), z: r2(j.z), r: h.area, fx: h.id });
      });
    } else if (t === 'investida') {
      const L = Math.min(h.alcance, dist(alvo, j) + 2.5), x0 = j.x, z0 = j.z, dx = Math.sin(j.ry), dz = Math.cos(j.ry);
      this.tocarQ(j, h.anim, h.dur); j.acao.lamina = true;
      if (!this.guiado(j)) this.empurrar(j, L, h.dashT);
      j.defesa = 1; this.depois(h.dashT, () => { j.defesa = 0; });
      this.evento({ t: 'dash', id: j.id, dur: r2(h.dashT + 0.12), forte: 1 });
      this.depois(h.hits[0], () => {
        if (j.morto) return;
        const linha = this.inimigosDe(j).map((o) => { const a = (o.x - x0) * dx + (o.z - z0) * dz, lado = Math.abs((o.x - x0) * dz - (o.z - z0) * dx); return { o, a, lado }; })
          .filter((q) => q.a > -0.5 && q.a < L + 1 && q.lado < h.largura).sort((a, b) => a.a - b.a).slice(0, Math.round(h.alvos));
        linha.forEach((q, i) => { this.bater(j, q.o, h.dmg * h.cai ** i, h, { x: x0, z: z0 }); this.evento({ t: 'impacto', x: r2(q.o.x), z: r2(q.o.z), ry: r2(j.ry), fx: h.id }); });
      });
    } else if (t === 'bola') {
      this.lancar(j, h, alvo);
    } else if (t === 'anel' || t === 'gelo') {
      this.areaQ(j, j, h.area, h.dmg, h);
      this.evento({ t: 'explosao', x: r2(j.x), z: r2(j.z), r: h.area, fx: h.id });
    } else if (t === 'meteoro') {
      const p = alvo ? { x: alvo.x, z: alvo.z } : this.aFrente(j, 5);
      this.evento({ t: 'meteoro', x: r2(p.x), z: r2(p.z), r: h.area, queda: h.queda });
      this.depois(h.queda, () => this.areaQ(j, p, h.area, h.dmg, h));
    } else if (t === 'cadeia') {
      const feitos = [];
      let de = { x: j.x, y: (j.y || 0) + 1.3, z: j.z }, o = alvo;
      for (let i = 0; o && i < Math.round(h.alvos); i++) {
        feitos.push(o);
        const n = h.dmg * h.cai ** i, alvoI = o, deI = de;
        this.depois(i * 0.08, () => { this.evento({ t: 'cadeia', x0: r2(deI.x), y0: r2(deI.y), z0: r2(deI.z), x: r2(alvoI.x), z: r2(alvoI.z) }); this.bater(j, alvoI, n, h); });
        de = { x: o.x, y: (o.y || 0) + 1, z: o.z };
        let prox = null, md = h.pula;
        for (const q of this.inimigosDe(j)) { const d = dist(q, o); if (!feitos.includes(q) && d < md) { md = d; prox = q; } }
        o = prox;
      }
    } else if (t === 'teleporte') {
      const dx = Number.isFinite(m?.dx) ? m.dx : 0, dz = Number.isFinite(m?.dz) ? m.dz : 0, mm = Math.hypot(dx, dz);
      if (mm > 0.15) j.ry = Math.atan2(dx, dz);
      const fx = Math.sin(j.ry), fz = Math.cos(j.ry), x0 = j.x, z0 = j.z;
      let n = 0; const passos = Math.round(h.distancia / 0.25);
      for (let i = 1; i <= passos; i++) { if (!this.livreParaHeroi(j, x0 + fx * 0.25 * i, z0 + fz * 0.25 * i)) break; n = i; }
      const x1 = x0 + fx * 0.25 * n, z1 = z0 + fz * 0.25 * n;
      j.tele = { m: 0.25 * n + 0.6, ate: this.tempo + 1.5 }; // o celular manda a posição nova: vale o salto
      if (!this.guiado(j)) { j.x = x1; j.z = z1; j.y = this.terreno.altura(x1, z1, j.y); }
      this.evento({ t: 'teleporte', id: j.id, x0: r2(x0), z0: r2(z0), x: r2(x1), z: r2(z1) });
    } else if (t === 'cura') {
      const n = Math.min(Math.round(j.vidaMax * h.curaPct), j.vidaMax - j.vida); j.vida += n;
      this.evento({ t: 'cura', alvo: j.id, n });
      for (const o of this.jogadores.values()) {
        if (o === j || o.morto || o.criando || dist(o, j) > h.grupo) continue;
        const q = Math.min(Math.round(o.vidaMax * h.curaPct * 0.5), o.vidaMax - o.vida); o.vida += q;
        if (q > 0) this.evento({ t: 'cura', alvo: o.id, n: q });
      }
      this.evento({ t: 'anel', x: r2(j.x), z: r2(j.z), r: h.grupo, cor: 0x9be08f, dur: 0.9 });
    } else if (t === 'escudo') {
      this.tocarQ(j, h.anim, h.dur);
      j.escudo = { n: Math.round(h.absorve + j.st.defesa * h.defK), ate: this.tempo + h.duracao };
      this.evento({ t: 'escudo', id: j.id, n: j.escudo.n, dur: h.duracao });
    } else if (t === 'puxar') {
      this.evento({ t: 'vortice', x: r2(j.x), z: r2(j.z), r: h.area });
      for (const o of this.inimigosDe(j)) {
        const d = dist(o, j); if (d > h.area || chefe(o)) continue;
        const fica = 1.6, tt = 0.3, m2 = Math.max(0, d - fica);
        o.dash = { vx: (j.x - o.x) / (d || 1) * m2 / tt, vz: (j.z - o.z) / (d || 1) * m2 / tt, t: tt };
        o.parado = Math.max(o.parado || 0, this.tempo + h.atordoa); o.trava = 0; o.acao = null;
        (o.atacantes ||= new Set()).add(j.id);
      }
    }
  }
  // topo dos obstáculos baixos vira chão (shared/terreno.js porTampos): mesa, bancada, baú, tronco caído, pedra pequena
  refazerTampos() {
    this.terreno.porTampos([...this.obstaculos, ...(this.mapa.cenario?.solidos || [])], SUBIDA.tampoMin, SUBIDA.tampoMax);
  }
  // o herói pode ficar ali? (sem pedra alta, casa, árvore ou poço; dentro do mapa) — o Salto Arcano para antes
  livreParaHeroi(j, x, z) {
    if (!dentroDoMapa(this.mapa, x, z, 2.2)) return false;
    if (j.prog && zonaFechadaEm(j.prog, x, z)) return false; // Salto Arcano não atravessa a névoa
    if (this.terreno.altura(x, z, j.y) > j.y + SUBIDA.degrau) return false;
    for (const k of [...this.obstaculos, ...this.pertoNaMata(x, z)]) {
      if (k.alto != null && (j.y || 0) > k.alto - 0.05) continue; // por cima (em pé no tampo da mesa)
      if (k.veio && this.veioVazio(k.veio, j)) continue; // veio esgotado: a pedra sumiu, dá para passar
      if (Math.hypot(x - k.x, z - k.z) < k.r + 0.35) return false;
    }
    return true;
  }
  // Skill sobe de nível usando até o 5; do 6 ao 10 a barra de usos enche e espera o Tomo daquele nível (como no Quimera)
  contarUso(j, hid) {
    const s = j.prog.habs[hid] ||= { nv: 1, uso: 0 }, max = HABS[hid].max || SKILL_MAX;
    if (s.nv >= max) return;
    const precisa = usosParaSubir(s.nv);
    if (s.uso >= precisa) return; // cheia: esperando o Tomo
    s.uso++;
    if (s.uso >= precisa) {
      if (s.nv < NIVEL_SEM_TOMO) { s.uso = 0; s.nv++; this.evento({ t: 'aviso', para: j.id, texto: `${HABS[hid].nome} subiu para Nv ${s.nv}` }); }
      else this.evento({ t: 'aviso', para: j.id, texto: `${HABS[hid].nome}: barra cheia. Use o ${HABS[hid].tomo} ${ROMANO[s.nv + 1]}` });
    }
    this.avisarProg(j);
  }

  // ---------- mochila, equipamento e loja (dados em shared/dados.js: ITENS, LOJA, DROPS) ----------
  // m = { acao: 'equipar' | 'usar' | 'vender', i } (lugar da mochila) · { acao: 'tirar', lugar } · { acao: 'comprar', i } (item da loja)
  //   · { acao: 'vender_varios', lista: [i, ...] } (vende as pilhas inteiras de uma vez) · { acao: 'apagar', i } (joga fora)
  //   · { acao: 'pagina' } (compra a próxima página da mochila com ouro, em qualquer lugar)
  //   · { acao: 'organizar' } (junta as pilhas e põe a mochila em ordem: tipo, raridade, nome; ORGANIZAR em shared/dados.js)
  //   · { acao: 'cadeado', i } ou { acao: 'cadeado', lugar } (André 2026-11-07: tranca/destranca o item; trancado não vende,
  //     não entra no "Vender vários"/"Selecionar tudo", não vai para o lixo nem para a troca)
  //   · { acao: 'filtro', r: [raridades], k: [recursos] } (André 2026-11-07: filtro de coleta; o desmarcado não entra na mochila)
  // ---------- dungeon: Caverna da Montanha (André 2026-11-06; shared/caverna.js e CAVERNA_DUNGEON em shared/dados.js) ----------
  // (x, y, z) passou do selo da caverna (do selo para dentro, abaixo do teto do túnel)?
  alemDoSelo(x, z, y) { const c = dentroDaCaverna(TUNEL, x, z, y + 0.3); return !!c && c.s > CAVERNA.porta; }
  naCaverna(c) { return !!dentroDaCaverna(TUNEL, c.x, c.z, (c.y || 0) + 0.3); }
  // Gaspar faz um passe com os materiais (CAVERNA_DUNGEON.passe); na porta, o passe é gasto e o selo deixa passar
  passeCaverna(j, acao, aviso) {
    const D = this.dungeon?.def, p = j.prog; if (!D) return false;
    if (acao === 'fazer_passe') {
      const npc = (this.mapa.npcs || []).find((n) => n.id === D.npc);
      if (!npc || dist(npc, j) > D.perto) { aviso('O passe é feito pelo Gaspar, na boca da caverna da montanha'); return false; }
      const falta = Object.entries(D.passe).filter(([k, n]) => contar(p.mochila, k) < n).map(([k, n]) => `${n - contar(p.mochila, k)} ${ITENS[k].nome}`);
      if (falta.length) { aviso('Falta ' + falta.join(', ')); return false; }
      const novo = { k: 'passe_caverna', n: 1 };
      for (const [k, n] of Object.entries(D.passe)) tirar(p.mochila, k, n);
      if (!guardar(p.mochila, novo)) { for (const [k, n] of Object.entries(D.passe)) guardar(p.mochila, { k, n }); aviso('Mochila cheia'); return false; }
      this.evento({ t: 'fala', para: j.id, npc: npc.id, texto: 'Pronto. Mostre isso no selo e ele abre. Uma vez só, hein.' });
      aviso('Recebeu Passe da Caverna');
      this.historia(j, 'passe', { k: 'fazer' });
      return true;
    }
    if (acao === 'usar_passe') {
      if (j.caverna) { aviso('O selo já está aberto para você'); return false; }
      if (!liberado(j.prog, '1e')) { aviso(textoNevoa(j.prog, '1e')); return false; } // progressão (André 2026-11-10)
      const c = noTunel(TUNEL, j.x, j.z);
      if (!c || c.s > CAVERNA.porta + 0.5 || c.s < CAVERNA.porta - D.portaPerto - 1) { aviso('Chegue perto do selo da caverna'); return false; }
      // time (D.passeDoTime): alguém do time já abriu o selo e está lá dentro = entra de graça
      const doTime = D.passeDoTime && j.time && j.time.membros.some((id) => id !== j.id && this.jogadores.get(id)?.caverna);
      if (!doTime && contar(p.mochila, 'passe_caverna') < 1) { aviso('Precisa de um Passe da Caverna. O Gaspar faz um com o material dos monstros. Quem está no time de alguém que já entrou não paga'); return false; }
      if (!doTime) tirar(p.mochila, 'passe_caverna', 1);
      j.caverna = { desde: this.tempo };
      this.evento({ t: 'caverna', id: j.id, aberta: true });
      aviso(doTime ? 'O selo reconhece seu time e se abre. Boa sorte lá dentro!' : 'O selo se abre. Boa sorte lá dentro!');
      this.historia(j, 'passe', { k: 'usar' });
      return true;
    }
    return false;
  }
  // Uma vez por passo: quem saiu da caverna perde a entrada; as salas nascem quando alguém com passe chega perto e somem
  // quando a caverna fica vazia (os monstros lá de dentro não pesam no servidor enquanto ninguém está lá)
  passoCaverna(dt) {
    const Dg = this.dungeon; if (!Dg) return;
    const dentro = [];
    for (const j of this.jogadores.values()) {
      if (!j.caverna) continue;
      const c = j.morto ? null : noTunel(TUNEL, j.x, j.z, 1);
      if (!c || !this.naCaverna(j)) { // saiu pela boca (ou por cima): a entrada acabou
        j.caverna = null;
        this.evento({ t: 'caverna', id: j.id, aberta: false });
        if (!j.morto) this.evento({ t: 'aviso', para: j.id, texto: 'Você saiu da caverna. Para entrar de novo, use outro passe' });
        continue;
      }
      dentro.push({ j, s: c.s });
    }
    if (!dentro.length) {
      Dg.vazia += dt;
      if (Dg.vazia >= Dg.def.esvazia) for (const S of Dg.salas) this.esvaziarSala(S);
      return;
    }
    Dg.vazia = 0;
    for (const S of Dg.salas) {
      const s0 = Math.min(...S.def.pontos.map((p) => p.s)), s1 = Math.max(...S.def.pontos.map((p) => p.s));
      const perto = dentro.some((d) => d.s > s0 - Dg.def.avistar && d.s < s1 + 8);
      if (!S.ativa) { if (perto) this.encherSala(S); continue; }
      const vivos = S.vagas.some((vg) => vg.e);
      if (!vivos) { S.limpa += dt; if (S.limpa >= Dg.def.volta && !dentro.some((d) => d.s > s0 - 10 && d.s < s1 + 10)) this.encherSala(S); }
    }
  }
  encherSala(S) {
    S.ativa = true; S.limpa = 0;
    for (const vg of S.vagas) {
      if (vg.e) continue;
      const { tipo, x, z, y } = vg.pt;
      vg.e = this.criarInimigo({ tipo, x, z, v: vg.v, nivel: S.def.nivel, caverna: S.def.id });
      vg.e.y = y; vg.e.sub = true; vg.e.ry = Math.random() * TAU;
    }
  }
  esvaziarSala(S) {
    for (const vg of S.vagas) if (vg.e) { const i = this.inimigos.indexOf(vg.e); if (i >= 0) this.inimigos.splice(i, 1); vg.e = null; }
    S.ativa = false; S.limpa = 0;
  }
  // monstro da caverna não sai do túnel nem passa do selo; o chão dele é o da caverna
  prenderNaCaverna(c) {
    const lim = noTunel(TUNEL, c.x, c.z, 50);
    if (lim) {
      const A = TUNEL.amostras, k = Math.max(0, Math.min(A.length - 1, Math.round(lim.s / CAVERNA.passo))), a = A[k];
      const sMin = CAVERNA.porta + 3;
      if (lim.s < sMin) { const b = A[Math.round(sMin / CAVERNA.passo)]; c.x = b.x; c.z = b.z; }
      else if (lim.d > lim.l - 0.6) { const k2 = (lim.l - 0.6) / lim.d; c.x = a.x + (c.x - a.x) * k2; c.z = a.z + (c.z - a.z) * k2; }
    }
    const cv = noTunel(TUNEL, c.x, c.z); if (cv) c.y = cv.y;
  }
  // monstro do covil de uma caverna do mundo grande: não sai do túnel (nem pela boca: fica até 4 m dela) e pisa no
  // chão da caverna
  prenderNoTunel(c) {
    const C = TUNEIS.find((t) => t.id === c.sp.tunel); if (!C) return;
    const A = C.amostras, lim = noTunel(C, c.x, c.z, 50);
    if (!lim) { const b = A[Math.min(A.length - 1, 8)]; c.x = b.x; c.z = b.z; }
    else {
      const k = Math.max(0, Math.min(A.length - 1, Math.round(lim.s / C.def.passo))), a = A[k];
      if (lim.s < 4) { const b = A[4]; c.x = b.x; c.z = b.z; }
      else if (lim.d > lim.l - 0.6) { const k2 = (lim.l - 0.6) / lim.d; c.x = a.x + (c.x - a.x) * k2; c.z = a.z + (c.z - a.z) * k2; }
    }
    const cv = noTunel(C, c.x, c.z); if (cv) c.y = cv.y;
  }
  item(id, m) {
    const j = this.jogadores.get(id); if (!j || !m || typeof m !== 'object' || j.criando) return;
    if (m.acao === 'fazer_passe' || m.acao === 'usar_passe') { // Caverna da Montanha (Gaspar e o selo)
      if (j.morto) return;
      if (this.passeCaverna(j, m.acao, (texto) => this.evento({ t: 'aviso', para: id, texto }))) this.avisarProg(j);
      return;
    }
    const p = j.prog, aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if (m.acao === 'sintetizar') { // alquimista
      const lib = motivoLibera(p, 'alquimia'); if (lib) return aviso(`A Mirela só ensina alquimia a partir do nível ${LIBERA_NIVEL.alquimia}`); // progressão (André 2026-11-10)
      if (!j.morto && this.sintetizar(j, m, aviso)) this.avisarProg(j); return;
    }
    const i = Number.isInteger(m.i) ? m.i : -1, it = i >= 0 && i < p.mochila.length ? p.mochila[i] : null; // MOCHILA lugares por página comprada
    // catalisador (André 2026-11-07): { acao: 'destruir', i } (uma peça) ou { acao: 'destruir', raridade } (todas da
    // raridade, sem as com cadeado; uma barrinha por peça, uma depois da outra) · { acao: 'evoluir', i } (sobe a raridade)
    if (m.acao === 'destruir' || m.acao === 'evoluir') return this.comecarCatalisador(j, m, i, it, aviso);
    if (m.acao === 'equipar' && it && ehEquip(it.k)) {
      if (!reforcoOk(it, p.atr)) return aviso(textoReforcoPrecisa(it, p.atr)); // reforço acima do atributo (igual ao Quimera)
      const l = ITENS[it.k].lugar;
      p.mochila[i] = p.equip[l]; p.equip[l] = it;
    } else if (m.acao === 'tirar' && p.equip[m.lugar]) {
      const v = p.mochila.indexOf(null); if (v < 0) return aviso('Mochila cheia');
      p.mochila[v] = p.equip[m.lugar]; p.equip[m.lugar] = null;
    } else if (m.acao === 'usar' && it && !ehEquip(it.k)) {
      if (j.morto || ITENS[it.k].mat) return;
      if (ITENS[it.k].usar?.veiculo) return this.veiculo(id, { acao: 'colocar', k: it.k, x: Number(m.x), z: Number(m.z), ry: Number(m.ry) }); // carrinho, barquinho, navio
      if (it.k === 'radar_pesca') { // Radar de pesca (André 2026-11-08): os spots aparecem no mapa por um tempo; não gasta
        const R = PESCA.radar, falta = (j.radarCd || 0) - this.tempo;
        if (falta > 0) return aviso(`Radar de pesca: pronto em ${Math.ceil(falta)} s`);
        j.radarCd = this.tempo + R.recarga;
        const n = this.spots.filter((v) => v.ativo).length;
        this.evento({ t: 'radar', para: id, mostra: R.mostra });
        return aviso(n ? `Radar: ${n} spots de pesca no mapa por ${Math.round(R.mostra / 60)} min` : 'Radar: nenhum spot de pesca agora. Tente daqui a pouco');
      }
      // peça de construção, estação ou ferramenta não se "usa" (André 2026-11-07: tocar em Usar na bancada desconectava)
      if (it.k !== 'tomo' && !ITENS[it.k].usar) return aviso(ITENS[it.k].obra ? 'Coloque pelo modo construção (martelo) ou pelo botão Colocar' : 'Este item não se usa assim');
      if (it.k === 'tomo') {
        const s = p.habs[it.h] || { nv: 1, uso: 0 };
        if (s.nv >= it.nv) return aviso(`${HABS[it.h].nome} já está no Nv ${s.nv}`);
        if (s.nv !== it.nv - 1) return aviso(`Este Tomo é para subir do Nv ${it.nv - 1} para o ${it.nv}`);
        if (s.uso < usosParaSubir(s.nv)) return aviso(`Encha a barra de usos de ${HABS[it.h].nome} primeiro`);
        p.habs[it.h] = { nv: it.nv, uso: 0 };
        aviso(`${HABS[it.h].nome} subiu para Nv ${it.nv}!`);
        this.evento({ t: 'tomo', para: j.id, h: it.h, nv: it.nv }); // André 2026-11-07: faixa de "Parabéns!" na janela (menu.gd aprendeu)
      } else {
        const u = ITENS[it.k].usar;
        const rc = ((j.pocaoAte ||= {})[it.k] || 0) - this.tempo; // recarga (POCAO_RECARGA)
        if (rc > 0 && !ITENS[it.k].comida) return aviso(`Espere ${Math.ceil(rc)} s para outra ${ITENS[it.k].nome.toLowerCase()}`);
        if (ITENS[it.k].comida) {
          // prato do fogão (2026-11-07): vale comer se ao menos uma coisa não está cheia (vida, mana ou vigor)
          const agora = Date.now(), vale = (u.vida && j.vida < j.vidaMax) || (u.mana && j.mana < j.manaMax) || (u.vigor && vigorAgora(p.vigor, agora) < VIGOR.max);
          if (!vale) return aviso('Você já está satisfeito: vida, mana e vigor cheios');
          if (u.vida && j.vida < j.vidaMax) { const n = Math.min(j.vidaMax - j.vida, Math.round(j.vidaMax * u.vida)); j.vida += n; this.evento({ t: 'cura', alvo: j.id, n }); }
          if (u.mana) j.mana = Math.min(j.manaMax, j.mana + j.manaMax * u.mana);
          if (u.vigor) { const g = ganharVigor(p, u.vigor, agora); if (g > 0) aviso(`+${Math.round(g)} de vigor`); }
        } else {
        if (u.vida) { if (j.vida >= j.vidaMax) return aviso('A vida já está cheia'); const n = Math.min(j.vidaMax - j.vida, Math.round(j.vidaMax * u.vida)); j.vida += n; this.evento({ t: 'cura', alvo: j.id, n }); }
        if (u.mana) { if (j.mana >= j.manaMax) return aviso('A mana já está cheia'); j.mana = Math.min(j.manaMax, j.mana + j.manaMax * u.mana); }
        }
        if (!ITENS[it.k].comida) j.pocaoAte[it.k] = this.tempo + POCAO_RECARGA; // comida sem recarga (André 2026-11-07: "por enquanto, sem limite")
      }
      if (--it.n <= 0) p.mochila[i] = null;
    } else if (m.acao === 'cadeado' && (it || (typeof m.lugar === 'string' && Object.hasOwn(p.equip, m.lugar) && p.equip[m.lugar]))) {
      const o = it || p.equip[m.lugar];
      if (o.cad) delete o.cad; else o.cad = 1;
      aviso(o.cad ? `${nomeItem(o)} trancado: não dá para vender nem jogar fora` : `${nomeItem(o)} destrancado`);
    } else if (m.acao === 'vender' && it) {
      if (it.cad) return aviso('Item trancado. Abra o cadeado para vender');
      if (this.carrinhoFora(j, it)) return aviso('O carrinho está no mundo. Toque nele na mochila pra guardar antes');
      if (!this.pertoDeQuemCompra(j)) return aviso('Venda com a Rosa, a comerciante, ou com o Tomás, o ferreiro');
      const preco = precoVenda(it, mercador(p.prof.mer).venda);
      if (it.n > 1) it.n--; else p.mochila[i] = null;
      p.ouro += preco;
      this.pontosMercador(j, preco);
      aviso(`Vendeu ${nomeItem(it)} por ${preco} de ouro`);
      this.historia(j, 'vender', { k: it.k });
    } else if (m.acao === 'vender_varios' && Array.isArray(m.lista)) {
      // André 2026-11-04: marcar vários itens (ou "Selecionar tudo") e vender de uma vez; cada lugar vende a pilha inteira
      if (!this.pertoDeQuemCompra(j)) return aviso('Venda com a Rosa, a comerciante, ou com o Tomás, o ferreiro');
      // item com cadeado (André 2026-11-07) fica de fora, mesmo que venha na lista
      const lugares = [...new Set(m.lista.filter((x) => Number.isInteger(x) && x >= 0 && x < p.mochila.length && p.mochila[x] && !p.mochila[x].cad && !this.carrinhoFora(j, p.mochila[x])))];
      if (!lugares.length) return aviso('Nada para vender (os itens com cadeado ficam de fora)');
      const merc = mercador(p.prof.mer).venda;
      let ouro = 0, n = 0;
      for (const x of lugares) {
        const v = p.mochila[x], q = ehEquip(v.k) ? 1 : Math.max(1, v.n || 1);
        ouro += precoVenda(v, merc) * q; n += q;
        p.mochila[x] = null;
      }
      p.ouro += ouro;
      this.pontosMercador(j, ouro);
      aviso(`Vendeu ${n} ${n === 1 ? 'item' : 'itens'} por ${ouro} de ouro`);
      this.historia(j, 'vender', {});
    } else if (m.acao === 'apagar' && it) {
      if (it.cad) return aviso('Item trancado. Abra o cadeado para jogar fora');
      if (this.carrinhoFora(j, it)) return aviso('O carrinho está no mundo. Toque nele na mochila pra guardar antes');
      // André 2026-11-04: jogar fora um item da mochila (o celular pergunta antes; não dá ouro e não volta)
      p.mochila[i] = null;
      aviso(`Jogou fora ${nomeItem(it)}${!ehEquip(it.k) && it.n > 1 ? ` (${it.n})` : ''}`);
    } else if (m.acao === 'comprar' && LOJA[i]) {
      if (!this.pertoDaLoja(j)) return aviso('Compre com a Rosa, a comerciante');
      // André 2026-11-07: escolhe a quantidade (m.n, sem n = 1) e compra tudo de uma vez; o que não couber
      // no ouro ou na mochila fica de fora. O celular toca o som e mostra o "+n" com o evento 'compra'.
      const o = LOJA[i], preco = this.precoCompra(j, o), equip = ehEquip(o.k);
      const pedido = Math.min(LOJA_MAX, Math.max(1, Math.floor(Number(m.n) || 1)));
      if (p.ouro < preco) return aviso('Ouro insuficiente');
      const pilha = equip ? 1 : ITENS[o.k].pilha || 1;
      let cabe = 0;
      for (const x of p.mochila) {
        if (x === null) cabe += pilha;
        else if (!equip && x.k === o.k && x.h === undefined && x.nv === undefined && x.n < pilha) cabe += pilha - x.n;
      }
      if (cabe <= 0) return aviso('Mochila cheia');
      const n = Math.min(pedido, Math.floor(p.ouro / preco), cabe);
      for (let falta = n; falta > 0;) {
        const lote = Math.min(falta, pilha);
        if (!guardar(p.mochila, equip ? { k: o.k, r: o.r } : { k: o.k, n: lote })) break;
        falta -= lote;
      }
      const total = preco * n;
      p.ouro -= total;
      this.pontosMercador(j, total);
      const novo = equip ? { k: o.k, r: o.r } : { k: o.k, n };
      const nome = nomeItem(novo);
      aviso(n > 1 ? `Comprou ${n}x ${nome} por ${total} de ouro` : `Comprou ${nome}`);
      if (n < pedido) aviso(n >= cabe ? `Só coube ${n} na mochila` : `O ouro deu para ${n}`);
      this.evento({ t: 'compra', para: j.id, i, k: o.k, r: equip ? o.r : -1, n, ouro: total });
      if (n > 0) this.historia(j, 'comprar', { k: o.k, n });
    } else if (m.acao === 'pagina') {
      const tem = p.paginas || 1;
      if (tem >= MOCHILA_PAGINAS) return aviso('A mochila já tem todas as páginas');
      const preco = PAGINA_PRECO[tem];
      if (p.ouro < preco) return aviso(`Faltam ${preco - p.ouro} de ouro para a página ${tem + 1}`);
      p.ouro -= preco;
      liberarPaginas(p, tem + 1);
      aviso(`Página ${tem + 1} da mochila liberada (+${MOCHILA} lugares)`);
    } else if (m.acao === 'consertar') {
      // Tomás conserta tudo o que desgastou (corpo e mochila) de uma vez (MORTE em shared/dados.js)
      if (!this.pertoDeQuemConserta(j)) return aviso('Conserte com o Tomás, o ferreiro');
      const r = consertarTudo(p);
      if (!r) return aviso('Nada para consertar: está tudo inteiro');
      if (r.falta) return aviso(`O conserto custa ${r.custo} de ouro (faltam ${r.falta})`);
      aviso(`Tomás consertou ${r.n} ${r.n === 1 ? 'peça' : 'peças'} por ${r.custo} de ouro`);
    } else if (m.acao === 'reforcar') {
      // reforço de equipamento (igual ao Quimera, REFORCO em shared/dados.js): peça da mochila (i) ou do corpo (lugar).
      // Em qualquer lugar; o servidor cobra e sorteia, o celular mostra a janelinha com o resultado (evento 'reforco').
      const alvo = it || (typeof m.lugar === 'string' && LUGARES.includes(m.lugar) ? p.equip[m.lugar] : null);
      if (!alvo || !ehEquip(alvo.k)) return;
      { const lib = motivoLibera(p, 'reforcar'); if (lib) return aviso(`Reforçar: ${lib.toLowerCase()}`); } // progressão (André 2026-11-10)
      const r = reforcar(p, alvo);
      if (r.erro) return this.evento({ t: 'reforco', para: id, erro: r.erro }); // a janelinha mostra o aviso
      this.evento({ t: 'reforco', para: id, ok: r.ok, de: r.de, e: r.e, custo: r.custo, ...(r.mat ? { mat: r.mat } : {}), nome: nomeItem(alvo) });
      if (r.ok) this.historia(j, 'reforcar', { v: r.e });
    } else if (m.acao === 'filtro') {
      // filtro de coleta (André 2026-11-07): { r: [raridades desmarcadas], k: [recursos desmarcados] }; tudo marcado = sem filtro
      const f = filtroValido(m);
      if (f) p.filtro = f; else delete p.filtro;
    } else if (m.acao === 'organizar') {
      // botão Organizar da mochila (André 2026-11-07): junta pilhas e põe em ordem de tipo, raridade e nome
      p.mochila = organizar(p.mochila);
    } else if (m.acao === 'capacete') {
      // mostrar ou esconder o capacete no corpo (fica gravado na conta; o bônus da peça continua).
      // 2026-11-07: o merge do reforço tinha engolido este ramo (o capacete escondido voltava a aparecer)
      p.semCapacete = m.mostrar === false;
    } else return;
    this.aplicarStatus(j);
    this.avisarProg(j);
  }
  // ---------- troca entre jogadores (como no Quimera, André 2026-11-04) ----------
  // Pedir: toca no outro jogador perto; ele aceita e a janela abre para os dois. Cada um põe itens da mochila e ouro.
  // Cadeado: "Trancar oferta" diz "aceito o que está na mesa". Mudar qualquer coisa (de um ou do outro) destranca os dois.
  // Com as duas trancadas, os dois confirmam. Nada muda de mão antes disso, e na hora o servidor confere tudo de novo
  // (o item ainda está no mesmo lugar, o ouro existe, cabe na mochila do outro): sem duplicar nada.
  // m = { acao: 'pedir' | 'aceitar' | 'recusar', com } · { acao: 'por', i, n } (lugar da mochila) · { acao: 'tirar', o }
  //   · { acao: 'ouro', n } · { acao: 'trancar', v } · { acao: 'confirmar' } · { acao: 'cancelar' }
  // ver o equipamento de outro jogador (André 2026-11-10): de perto, como a troca; vale também para a Cecília
  verEquip(id, m) {
    const j = this.jogadores.get(id), o = this.jogadores.get(m?.com);
    if (!j || !o || o === j || o.criando) return;
    if (Math.hypot(o.x - j.x, o.z - j.z) > TROCA.perto + 2) return this.evento({ t: 'aviso', para: id, texto: `Chegue mais perto de ${o.nome}` });
    const equip = {};
    for (const l of LUGARES) { const it = o.prog.equip?.[l]; if (it) equip[l] = { k: it.k, r: it.r | 0, ...(it.e ? { e: it.e | 0 } : {}) }; }
    this.evento({ t: 'equipVer', para: id, de: o.id, nome: o.nome, nivel: o.prog.nivel, equip });
  }
  troca(id, m) {
    const j = this.jogadores.get(id); if (!j || !m || typeof m !== 'object') return;
    const aviso = (texto, para = id) => this.evento({ t: 'aviso', para, texto });
    const livre = (c) => c && !c.morto && !c.criando;
    if (m.acao === 'pedir' || m.acao === 'aceitar') {
      const o = this.jogadores.get(String(m.com));
      const ctx = this.amigoIaDe(o);
      if (o && o.bot && ctx) { // a Cecília ou o Dario (fase 3): decide na hora, sem cartão de pedido
        const r = ctx.abrirTrocaAmiga(j); if (r !== true) ctx.falarAmiga(r);
        return;
      }
      if (!o || o === j || o.bot) return;
      if (!livre(j)) return;
      if (!livre(o)) return aviso(`${o.nome} não pode trocar agora`);
      if (j.troca) return aviso('Termine a troca que está aberta primeiro');
      if (o.troca) return aviso(`${o.nome} já está trocando com outra pessoa`);
      if (dist(j, o) > TROCA.perto) return aviso(`Chegue mais perto de ${o.nome} para trocar`);
      const veio = j.pedidoTroca && j.pedidoTroca.de === o.id && j.pedidoTroca.ate >= this.tempo;
      if (m.acao === 'aceitar' || veio) { // aceitou (ou os dois pediram um ao outro): abre para os dois
        if (!veio) return aviso('O pedido de troca já expirou');
        j.pedidoTroca = null; o.pedidoTroca = null;
        return this.abrirTroca(o, j);
      }
      if ((j.trocaPedidoT || -99) > this.tempo - TROCA.entrePedidos) return aviso('Espere um pouquinho para pedir de novo');
      j.trocaPedidoT = this.tempo;
      o.pedidoTroca = { de: j.id, ate: this.tempo + TROCA.pedido };
      this.evento({ t: 'troca', para: o.id, fase: 'pedido', de: j.id, nome: j.nome, dur: TROCA.pedido });
      return aviso(`Pedido de troca enviado para ${o.nome}`);
    }
    if (m.acao === 'recusar') {
      const p = j.pedidoTroca; if (!p || p.de !== String(m.com)) return;
      j.pedidoTroca = null;
      if (this.jogadores.has(p.de)) aviso(`${j.nome} recusou a troca`, p.de);
      return;
    }
    const T = j.troca; if (!T) return;
    const eu = T.of[id], o = this.jogadores.get(T.a === id ? T.b : T.a);
    if (!o) return this.fecharTroca(T, 'A troca foi desfeita');
    if (m.acao === 'cancelar') return this.fecharTroca(T, `${j.nome} fechou a troca`);
    if (m.acao === 'trancar') {
      if (m.v === true) {
        if (!this.ofertaValida(j, eu)) { this.limparOferta(j, eu); this.mudouTroca(T); return aviso('Um item da sua oferta saiu da mochila: confira de novo'); }
        eu.tranca = true;
      } else {
        if (!eu.tranca) return;
        T.of[T.a].tranca = T.of[T.b].tranca = false; T.of[T.a].ok = T.of[T.b].ok = false;
        aviso(`${j.nome} destrancou a oferta: as confirmações caíram`, o.id);
      }
      return this.enviarTroca(T);
    }
    if (m.acao === 'confirmar') {
      if (!eu.tranca || !T.of[o.id].tranca) return aviso('Os dois precisam trancar a oferta antes de confirmar');
      eu.ok = true;
      if (T.of[o.id].ok) return this.concluirTroca(T);
      aviso(`Confirmado! Esperando ${o.nome} confirmar`);
      return this.enviarTroca(T);
    }
    // daqui em diante muda a oferta: só destrancada (o cadeado protege o que o outro já viu)
    if (eu.tranca) return aviso('Sua oferta está trancada. Destranque para mudar');
    if (m.acao === 'por') {
      const i = Number.isInteger(m.i) ? m.i : -1, it = i >= 0 && i < j.prog.mochila.length ? itemValido(j.prog.mochila[i]) : null;
      if (!it) return;
      if (it.cad) return aviso('Item trancado. Abra o cadeado na mochila para trocar');
      if (this.carrinhoFora(j, it)) return aviso('O carrinho está no mundo. Guarde ele antes de trocar');
      const ja = eu.itens.find((e) => e.i === i), tem = it.n || 1, pos = ja ? ja.n : 0;
      const n = Math.min(Number.isInteger(m.n) && m.n > 0 ? m.n : 1, tem - pos);
      if (n <= 0) return aviso('Você já pôs tudo desse item');
      if (ja) ja.n += n;
      else {
        if (eu.itens.length >= TROCA.maxItens) return aviso(`No máximo ${TROCA.maxItens} itens por troca`);
        eu.itens.push({ i, n, chave: chaveItem(it) });
      }
    } else if (m.acao === 'tirar') {
      const k = Number.isInteger(m.o) ? m.o : -1; if (!eu.itens[k]) return;
      eu.itens.splice(k, 1);
    } else if (m.acao === 'ouro') {
      const n = Number.isInteger(m.n) ? Math.max(0, m.n) : 0;
      if (n > j.prog.ouro) return aviso('Você não tem esse ouro todo');
      if (n === eu.ouro) return;
      eu.ouro = n;
    } else return;
    this.mudouTroca(T);
  }
  abrirTroca(a, b) {
    const oferta = () => ({ itens: [], ouro: 0, tranca: false, ok: false });
    const T = { a: a.id, b: b.id, of: { [a.id]: oferta(), [b.id]: oferta() } };
    a.troca = b.troca = T;
    (this.trocas ||= new Set()).add(T);
    for (const j of [a, b]) if (j.coleta) this.pararColeta(j);
    this.enviarTroca(T);
  }
  // alguém mudou a oferta: os dois cadeados abrem e as confirmações caem
  mudouTroca(T) {
    for (const k of [T.a, T.b]) { T.of[k].tranca = false; T.of[k].ok = false; }
    this.enviarTroca(T);
  }
  // o que cada um vê: a própria oferta (com o lugar da mochila) e a do outro (só os itens)
  enviarTroca(T) {
    for (const [k, outro] of [[T.a, T.b], [T.b, T.a]]) {
      const o = this.jogadores.get(outro); if (!o) continue;
      const ver = (of, meu) => ({ ouro: of.ouro, tranca: of.tranca, ok: of.ok,
        itens: of.itens.map((e) => ({ ...(meu ? { i: e.i } : {}), n: e.n, it: itemDaChave(e.chave, e.n) })) });
      const ctxO = this.amigoIaDe(o), sug = ctxO ? { sugestao: ctxO.sugestaoTrocaAmiga(T) } : {}; // troca com a Cecília ou o Dario: o preço dele(a)
      this.evento({ t: 'troca', para: k, fase: 'estado', com: outro, nome: o.nome, eu: ver(T.of[k], true), ele: ver(T.of[outro], false), ...sug });
    }
    for (const ctx of this.amigosIa) if (ctx.amiga && (T.a === ctx.amiga.id || T.b === ctx.amiga.id)) ctx.mexeuTrocaAmiga(); // ela (ou ele) pensa de novo (shared/amiga.js)
  }
  fecharTroca(T, motivo = '', feita = false) {
    this.trocas?.delete(T);
    for (const k of [T.a, T.b]) {
      const j = this.jogadores.get(k); if (!j || j.troca !== T) continue;
      j.troca = null;
      this.evento({ t: 'troca', para: k, fase: 'fim', feita, motivo });
    }
  }
  // cada item da oferta ainda está no mesmo lugar da mochila, igual e com a quantidade; e o ouro existe
  ofertaValida(j, of) {
    if (of.ouro > j.prog.ouro) return false;
    return of.itens.every((e) => { const it = itemValido(j.prog.mochila[e.i]); return it && chaveItem(it) === e.chave && (it.n || 1) >= e.n; });
  }
  limparOferta(j, of) {
    of.itens = of.itens.filter((e) => { const it = itemValido(j.prog.mochila[e.i]); return it && chaveItem(it) === e.chave && (it.n || 1) >= e.n; });
    of.ouro = Math.min(of.ouro, j.prog.ouro);
  }
  // a cada passo: quem se afastou, morreu ou saiu fecha a troca; item da oferta que sumiu (usou, vendeu, criou) destranca
  passoTrocas() {
    if (!this.trocas?.size) return;
    for (const T of [...this.trocas]) {
      const a = this.jogadores.get(T.a), b = this.jogadores.get(T.b);
      if (!a || !b || a.troca !== T || b.troca !== T) { this.fecharTroca(T, 'A troca foi desfeita'); continue; }
      if (a.morto || b.morto || a.criando || b.criando) { this.fecharTroca(T, 'A troca foi desfeita'); continue; }
      if (dist(a, b) > TROCA.longe) { this.fecharTroca(T, 'Vocês se afastaram: a troca foi desfeita'); continue; }
      for (const j of [a, b]) if (!this.ofertaValida(j, T.of[j.id])) {
        this.limparOferta(j, T.of[j.id]);
        this.evento({ t: 'aviso', para: j.id, texto: 'Um item da sua oferta saiu da mochila: a troca foi destrancada' });
        this.mudouTroca(T);
      }
    }
  }
  // ---------- chat geral e de amigos (André 2026-11-06) ----------
  // chat(): confere quem fala, o canal, o texto (até CHAT.max letras, sem caracteres de controle) e o tempo entre mensagens.
  // Devolve a mensagem pronta; o servidor (server/index.js) entrega em todas as salas com receberChat(). O "silenciar"
  // do geral é escolha do app (cada um decide o que vê); o servidor manda para todos.
  chat(id, m) {
    const j = this.jogadores.get(id); if (!j || !m) return null;
    const aviso = (texto) => { this.evento({ t: 'aviso', para: id, texto }); return null; };
    const canal = String(m.canal || '');
    if (!CHAT.canais.includes(canal)) return null;
    const texto = String(m.texto ?? '').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, CHAT.max);
    if (!texto) return null;
    if (j.criando) return aviso('Termine de criar o personagem para conversar');
    if (canal === 'amigos' && !j.amigos.size) return aviso('Você ainda não tem amigos. Toque num jogador e escolha "Adicionar amigo"');
    if (canal === 'time' && !j.time) return aviso('Você não está em um time. Chame alguém pelo menu Multijogador');
    // pm: só para quem está na sua lista de amigos (m.para = conta do amigo)
    const para = canal === 'pm' ? String(m.para || '').slice(0, 32) : '';
    const ctxPm = canal === 'pm' ? this.amigosIa.find((x) => x.AMIGA.conta === para) : null; // Cecília ou Dario
    if (canal === 'pm' && !j.amigos.has(para) && !(ctxPm && ctxPm.podeAmiga(id))) return aviso(ctxPm ? `Ative a conversa com IA para falar com ${ctxPm.AMIGA.nome}` : 'Só dá para mandar mensagem privada para amigo'); // a Cecília: quem tem a chave Groq (shared/amiga.js)
    if ((j.chatT ?? -99) > this.tempo - CHAT.entre) return aviso('Calma, espere um pouquinho para mandar outra');
    j.chatT = this.tempo;
    const msg = { canal, c: j.conta, nome: j.nome, texto, hora: Date.now() };
    if (canal === 'pm') { msg.alvo = para; msg.alvoNome = this.porConta(para)?.nome || j.amigos.get(para) || ''; } // alvo: 'para' é de quem recebe o evento
    if (canal === 'time') msg.membros = this.contasDoTime(j.time); // quem estava no time quando ele falou (o histórico usa a mesma lista)
    return msg;
  }
  // chat de time (André 2026-11-11: "eu falo com eles todos"): as contas de todos do time, NPCs inclusive
  contasDoTime(T) { return (T?.membros || []).map((k) => this.jogadores.get(k)?.conta).filter(Boolean); }
  // os NPCs (Cecília, Dario, aventureiros) que estão no time de quem falou: cada um ouve a mensagem como ouviria no privado
  amigosIaNoTime(id) {
    const j = this.jogadores.get(id); if (!j?.time) return [];
    return this.amigosIa.filter((x) => x.amiga && x.amiga.time === j.time && x.podeAmiga(id));
  }
  // entrega a mensagem a quem deve ver nesta sala (o geral para todos; amigos para quem falou e os amigos dele)
  receberChat(msg) {
    for (const o of this.jogadores.values()) {
      if (msg.canal === 'amigos' && o.conta !== msg.c && !o.amigos?.has(msg.c)) continue;
      if (msg.canal === 'pm' && o.conta !== msg.c && o.conta !== msg.alvo) continue; // pm: só as duas pontas
      if (msg.canal === 'time' && !msg.membros?.includes(o.conta)) continue; // time: só quem está nele
      this.evento({ t: 'chat', para: o.id, ...msg, meu: o.conta === msg.c });
    }
  }
  // quem acabou de entrar vê as últimas mensagens (o geral inteiro; do amigos, só as dele e as dos amigos dele)
  historicoChat(id, geral, amigos, pm, time) {
    const j = this.jogadores.get(id); if (!j) return;
    const ver = (x) => (x.canal === 'pm' ? x.c === j.conta || x.alvo === j.conta : x.canal === 'time' ? !!x.membros?.includes(j.conta) : x.canal === 'geral' || x.c === j.conta || j.amigos.has(x.c));
    const lista = [...(geral || []), ...(amigos || []), ...(pm || []), ...(time || [])].filter(ver).sort((a, b) => a.hora - b.hora).map((x) => ({ ...x, meu: x.c === j.conta }));
    this.evento({ t: 'chatHist', para: id, lista });
  }
  // ---------- amigos (até 20) e time (André 2026-11-05) ----------
  // A lista de amigos fica na conta (server/contas.js, tabela amizades); aqui fica j.amigos (conta -> nome), que o servidor
  // carrega ao entrar (definirAmigos) e grava pelo aoAmizade. O pedido de amizade é feito tocando no outro jogador da sala.
  // Time: só com amigo e na mesma sala, até TIME.max pessoas. Quem está no time vê a vida e a mana dos outros (evento 'time')
  // e ganha XP e drop dos monstros que caem perto dele (morrer).
  porConta(c) { for (const j of this.jogadores.values()) if (j.conta === c) return j; return null; }
  definirAmigos(id, lista) {
    const j = this.jogadores.get(id); if (!j) return;
    j.amigos = new Map((Array.isArray(lista) ? lista : []).slice(0, AMIGOS.max).map((a) => [String(a.c), String(a.nome || '')]));
    this.enviarAmigos(j);
    for (const o of this.jogadores.values()) if (o !== j && o.amigos?.has(j.conta)) {
      this.evento({ t: 'aviso', para: o.id, texto: `Seu amigo ${j.nome} entrou no jogo` });
      this.enviarAmigos(o);
    }
  }
  // outro servidor (sala) desfez a amizade: tira daqui também
  esquecerAmigo(conta, amigo) {
    const j = this.porConta(conta); if (!j || !j.amigos.delete(amigo)) return;
    this.enviarAmigos(j);
  }
  enviarAmigos(j) {
    const lista = [...j.amigos].map(([c, nome]) => {
      const o = this.porConta(c);
      return { c, nome: o?.nome || nome, id: o ? o.id : null, nivel: o ? o.prog.nivel : null, on: o ? 1 : this.onlineFora?.(c) ? 2 : 0, time: !!(o && j.time && o.time === j.time) };
    }).sort((a, b) => (b.on === 1) - (a.on === 1) || (b.on > 0) - (a.on > 0) || a.nome.localeCompare(b.nome));
    // amigos virtuais (André 2026-11-09, como no Quimera): a Cecília aparece só para o dono, numa parte separada da lista
    const virtuais = this.amigosIa.flatMap((x) => { const a = x.amiga, D = x.AMIGA; return a ? [{ c: D.conta, nome: D.nome, id: a.id, nivel: a.prog.nivel, on: 1, time: !!(j.time && a.time === j.time), amizade: x.amizadeAmiga(j), ia: x.podeAmiga(j.id) }] : this.iaPorChave ? [{ c: D.conta, nome: D.nome, id: null, on: 0, amizade: 0, ia: false }] : []; }); // todos veem; sem chave, o botão de ativar (André 2026-11-10)
    this.evento({ t: 'amigos', para: j.id, lista, max: AMIGOS.max, virtuais });
  }
  amigo(id, m) {
    const j = this.jogadores.get(id); if (!j || !m) return;
    const aviso = (texto, para = id) => this.evento({ t: 'aviso', para, texto });
    if (m.acao === 'lista') return this.enviarAmigos(j);
    if (m.acao === 'remover') {
      const c = String(m.c || ''); if (!j.amigos.has(c)) return;
      const nome = j.amigos.get(c);
      j.amigos.delete(c);
      const o = this.porConta(c);
      if (o) { o.amigos.delete(j.conta); this.enviarAmigos(o); }
      this.aoAmizade?.(j.conta, c, false);
      this.enviarAmigos(j);
      return aviso(`${nome} saiu da sua lista de amigos`);
    }
    const o = this.jogadores.get(String(m.com || ''));
    if (o?.bot) return; // a Cecília não entra na lista de amigos pelo botão
    if (m.acao === 'recusar') {
      const p = j.pedidoAmigo; if (!p || p.de !== String(m.com)) return;
      j.pedidoAmigo = null;
      if (o) aviso(`${j.nome} recusou o pedido de amizade`, o.id);
      return;
    }
    if (!o || o === j || o.criando || j.criando) return;
    if (j.amigos.has(o.conta)) return aviso(`${o.nome} já é seu amigo`);
    if (j.amigos.size >= AMIGOS.max) return aviso(`Sua lista já tem ${AMIGOS.max} amigos`);
    if (o.amigos.size >= AMIGOS.max) return aviso(`A lista de ${o.nome} já está cheia`);
    const veio = j.pedidoAmigo && j.pedidoAmigo.de === o.id && j.pedidoAmigo.ate >= this.tempo;
    if (m.acao === 'aceitar' || (m.acao === 'pedir' && veio)) {
      if (!veio) return aviso('O pedido de amizade já expirou');
      j.pedidoAmigo = null; o.pedidoAmigo = null;
      if (this.aoAmizade && !this.aoAmizade(j.conta, o.conta, true)) return aviso('Não deu para salvar a amizade agora');
      j.amigos.set(o.conta, o.nome); o.amigos.set(j.conta, j.nome);
      aviso(`${o.nome} agora é seu amigo!`); aviso(`${j.nome} agora é seu amigo!`, o.id);
      this.enviarAmigos(j); this.enviarAmigos(o);
      return;
    }
    if (m.acao !== 'pedir') return;
    if ((j.amigoPedidoT || -99) > this.tempo - AMIGOS.entrePedidos) return aviso('Espere um pouquinho para pedir de novo');
    j.amigoPedidoT = this.tempo;
    o.pedidoAmigo = { de: j.id, ate: this.tempo + AMIGOS.pedido };
    this.evento({ t: 'amigo', para: o.id, fase: 'pedido', de: j.id, nome: j.nome, dur: AMIGOS.pedido });
    aviso(`Pedido de amizade enviado para ${o.nome}`);
  }
  time(id, m) {
    const j = this.jogadores.get(id); if (!j || !m) return;
    const aviso = (texto, para = id) => this.evento({ t: 'aviso', para, texto });
    if (m.acao === 'sair') return j.time && this.sairDoTime(j, `${j.nome} saiu do time`);
    // com: id do jogador na sala ou a conta do amigo (lista de amigos)
    const o = this.jogadores.get(String(m.com || '')) || this.porConta(String(m.com || ''));
    if (o?.bot) return; // a Cecília entra no time pela conversa com ela (shared/amiga.js), não pelo convite
    if (m.acao === 'expulsar') {
      const T = j.time; if (!T || T.lider !== j.id || !o || o.time !== T || o === j) return;
      aviso('Você saiu do time', o.id);
      return this.sairDoTime(o, `${o.nome} saiu do time`);
    }
    if (m.acao === 'recusar') {
      const p = j.conviteTime; if (!p || !o || p.de !== o.id) return;
      j.conviteTime = null;
      return aviso(`${j.nome} recusou o convite para o time`, o.id);
    }
    if (!o || o === j || o.criando || j.criando) return aviso('Seu amigo precisa estar no mesmo mundo para entrar no time');
    if (m.acao === 'aceitar') {
      const p = j.conviteTime; if (!p || p.de !== o.id || p.ate < this.tempo) return aviso('O convite para o time já expirou');
      j.conviteTime = null;
      if (j.time) return aviso('Saia do seu time antes de entrar em outro');
      let T = o.time;
      if (!T) { T = { lider: o.id, membros: [o.id] }; o.time = T; (this.times ||= new Set()).add(T); }
      if (T.membros.length >= TIME.max) return aviso(`O time já tem ${TIME.max} pessoas`);
      T.membros.push(j.id); j.time = T;
      for (const k of T.membros) aviso(k === j.id ? `Você entrou no time de ${this.jogadores.get(T.lider)?.nome || o.nome}` : `${j.nome} entrou no time`, k);
      return this.mudouTime(T);
    }
    if (m.acao !== 'convidar') return;
    if (!j.amigos.has(o.conta)) return aviso(`Só dá para chamar amigo para o time. Adicione ${o.nome} como amigo primeiro`);
    if (o.time && o.time === j.time) return aviso(`${o.nome} já está no seu time`);
    if (o.time) return aviso(`${o.nome} já está em outro time`);
    if (j.time && j.time.membros.length >= TIME.max) return aviso(`O time já tem ${TIME.max} pessoas`);
    if ((j.timeConviteT || -99) > this.tempo - TIME.entreConvites) return aviso('Espere um pouquinho para chamar de novo');
    j.timeConviteT = this.tempo;
    o.conviteTime = { de: j.id, ate: this.tempo + TIME.convite };
    this.evento({ t: 'time', para: o.id, fase: 'convite', de: j.id, nome: j.nome, dur: TIME.convite });
    aviso(`Convite para o time enviado para ${o.nome}`);
  }
  sairDoTime(j, texto) {
    const T = j.time; if (!T) return;
    j.time = null;
    T.membros = T.membros.filter((k) => k !== j.id);
    this.evento({ t: 'time', para: j.id, fase: 'fim' });
    if (T.membros.length <= 1) { // sobrou um: o time acaba
      this.times?.delete(T);
      for (const k of T.membros) { const o = this.jogadores.get(k); if (o) { o.time = null; this.evento({ t: 'time', para: k, fase: 'fim' }); this.evento({ t: 'aviso', para: k, texto: texto + ': o time acabou' }); } }
      this.enviarAmigosDe([j, ...T.membros.map((k) => this.jogadores.get(k))]);
      return;
    }
    if (T.lider === j.id) T.lider = T.membros[0];
    for (const k of T.membros) this.evento({ t: 'aviso', para: k, texto });
    this.mudouTime(T);
    this.enviarAmigosDe([j]);
  }
  enviarAmigosDe(js) { for (const j of js) if (j && this.jogadores.has(j.id)) this.enviarAmigos(j); }
  mudouTime(T) {
    this.enviarTime(T);
    this.enviarAmigosDe(T.membros.map((k) => this.jogadores.get(k)));
  }
  // vida, mana e onde está cada um do time (a HUD mostra as barras dos amigos e o minimapa os pontos)
  enviarTime(T) {
    const membros = T.membros.map((k) => this.jogadores.get(k)).filter(Boolean).map((o) => ({
      id: o.id, nome: o.nome, nivel: o.prog.nivel, vida: Math.max(0, Math.round(o.vida)), vidaMax: o.vidaMax, mana: Math.round(o.mana), manaMax: o.manaMax,
      x: r2(o.x), z: r2(o.z), morto: !!o.morto }));
    for (const k of T.membros) this.evento({ t: 'time', para: k, fase: 'estado', lider: T.lider, membros });
  }
  passoTimes(dt) {
    if (!this.times?.size) return;
    this.timeT = (this.timeT || 0) + dt;
    if (this.timeT < TIME.envio) return;
    this.timeT = 0;
    for (const T of this.times) this.enviarTime(T);
  }

  // os dois confirmaram: confere tudo de novo e troca de uma vez (numa cópia; só grava se tudo cabe)
  concluirTroca(T) {
    const a = this.jogadores.get(T.a), b = this.jogadores.get(T.b);
    if (!a || !b) return this.fecharTroca(T, 'A troca foi desfeita');
    const A = T.of[a.id], B = T.of[b.id];
    if (!this.ofertaValida(a, A) || !this.ofertaValida(b, B)) { this.limparOferta(a, A); this.limparOferta(b, B); return this.mudouTroca(T); }
    const sem = (j, of) => {
      const mo = j.prog.mochila.map((o) => (o ? { ...o } : null));
      for (const e of of.itens) { const o = mo[e.i]; if (o.n && o.n > e.n) o.n -= e.n; else mo[e.i] = null; }
      return mo;
    };
    const ma = sem(a, A), mb = sem(b, B);
    const cabe = (mo, of) => of.itens.every((e) => guardar(mo, itemDaChave(e.chave, e.n)));
    for (const [mo, of, j, o] of [[ma, B, a, b], [mb, A, b, a]]) if (!cabe(mo, of)) {
      this.evento({ t: 'aviso', para: j.id, texto: 'Sua mochila não tem espaço para tudo isso' });
      this.evento({ t: 'aviso', para: o.id, texto: `A mochila de ${j.nome} não tem espaço para tudo isso` });
      return this.mudouTroca(T);
    }
    a.prog.mochila = ma; b.prog.mochila = mb;
    a.prog.ouro += B.ouro - A.ouro; b.prog.ouro += A.ouro - B.ouro;
    for (const [j, o] of [[a, b], [b, a]]) { this.aplicarStatus(j); this.avisarProg(j); this.evento({ t: 'aviso', para: j.id, texto: `Troca com ${o.nome} feita!` }); }
    this.fecharTroca(T, '', true);
    for (const ctx of this.amigosIa) if (ctx.amiga && (a === ctx.amiga || b === ctx.amiga)) ctx.trocaFeitaAmiga(T);
    this.aoTrocar?.(); // o servidor grava as duas contas na hora (nada fica só na memória)
  }
  precoCompra(j, o) { return Math.max(1, Math.round(o.preco * (1 - mercador(j.prog.prof.mer).compra))); }
  pontosMercador(j, ouro) { this.pontosProf(j, 'mer', ouro / MERCADOR.pontoOuro); }
  // Pontos numa profissão (sobe de nível sozinha, como no Quimera)
  pontosProf(j, k, n) {
    if (!PROFISSOES[k] || !(n > 0)) return;
    const antes = profNivel(j.prog.prof[k]);
    j.prog.prof[k] = Math.round(((j.prog.prof[k] || 0) + n) * 1000) / 1000;
    const nv = profNivel(j.prog.prof[k]);
    if (nv > antes) {
      const b = profBonus(j.prog.prof[k]);
      this.evento({ t: 'aviso', para: j.id, texto: `${PROFISSOES[k].nome} subiu para o Nv ${nv}` + (b.menosVigor ? ` (gasta ${Math.round(b.menosVigor * 100)}% menos vigor)` : '') });
      this.evento({ t: 'profNivel', para: j.id, prof: k, nv });
    }
  }

  // ---------- estamina (Parte 3 do Quimera: shared/dados.js ESTAMINA) ----------
  emCombate(j) { return j.combateAte > this.tempo; }
  // Gasto de uma vez (dash, rolamento, mortal): seguido fica mais caro. App antigo (site) não conhece a estamina: passa.
  gastarEstamina(j, n) {
    if (!j.ciente) return true;
    const E = ESTAMINA, k = this.tempo - j.seguida.t < E.seguidaJanela ? Math.min(E.seguidaMax, j.seguida.k + E.seguidaK) : 1;
    if (j.sta < n * k) { this.evento({ t: 'aviso', para: j.id, texto: 'Sem fôlego!' }); return false; }
    j.seguida = { k, t: this.tempo };
    j.sta -= n * k; j.staT = Math.max(j.staT, E.espera);
    return true;
  }
  correndo(j, dt) {
    const E = ESTAMINA, c = this.emCombate(j);
    j.sta = Math.max(0, j.sta - E.correr * (c ? E.combateK : 1) * dt);
    j.staT = Math.max(j.staT, c ? E.esperaCombate : E.espera);
    if (j.sta <= 0 && !j.semFolego) { j.semFolego = true; this.evento({ t: 'aviso', para: j.id, texto: 'Sem fôlego!' }); }
  }
  passoEstamina(j, dt) {
    const E = ESTAMINA;
    if (j.staT > 0) { j.staT -= dt; return; }
    if (j.sta < j.staMax) j.sta = Math.min(j.staMax, j.sta + j.staMax * E.volta * (this.emCombate(j) ? E.voltaCombate : 1) * dt);
    if (j.semFolego && j.sta >= j.staMax * E.folego) j.semFolego = false;
  }

  // ---------- coleta: Minerador e Lenhador (shared/dados.js COLETA e VEIOS) ----------
  // m = { no: 'v3' | 'a12' } (veio ou árvore) ou { parar: true }. Bate sozinho até acabar a carga do veio, o vigor ou o jogador sair.
  coletar(id, m) {
    const j = this.jogadores.get(id); if (!j || j.criando || j.morto || !m || typeof m.no !== 'string') return;
    if (m.parar || j.coleta) return this.pararColeta(j, null); // o jogador parou (ou tocou de novo)
    this.cancelarVila(j);
    const no = this.coletaveis.get(m.no), aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if (!no) return;
    if (j.esc || !j.chao || j.trava > 0 || j.arrancada || j.montado) return;
    if (dist(no, j) - no.r > COLETA_DISTANCIA || (no.y != null && Math.abs((j.y || 0) - no.y) > 2.5)) return aviso('Chegue mais perto'); // veio de caverna: lá dentro
    const C = COLETA[no.tipo];
    if (C.mao) return this.pegarSolto(j, no, C);
    // picareta para minerar e machado para cortar (André 2026-11-07), como a enxada para arar
    if (C.ferramenta && contar(j.prog.mochila, C.ferramenta) < 1) return aviso(`Precisa de ${ITENS[C.ferramenta].nome.toLowerCase()} (crie na mochila: Criar > Ferramentas, sem bancada)`);
    if (profNivel(j.prog.prof[C.prof]) < (C.nivel || 1)) return aviso(`${C.nome}: precisa de ${PROFISSOES[C.prof].nome} Nv ${C.nivel}`);
    if (this.cargas(j, no) <= 0) return aviso(`${C.nome}: ${C.esgotado || 'esgotado'}, volta em ${Math.ceil((this.comum(no) ? this.veiosComuns.get(no.id) : j.coletas[no.id]).volta - this.tempo)} s`);
    if (vigorAgora(j.prog.vigor) < this.custoVigor(j, C)) return aviso('Sem vigor: ele volta sozinho com o tempo (cheio a cada 6 h)');
    if (!this.cabeColeta(j.prog, C)) return aviso('Mochila cheia: venda ou guarde algo no baú para coletar');
    this.virarPara(j, no);
    this.proximaBatida(j, no);
  }
  // pedra ou galho solto (André 2026-11-07): pega na hora, sem ferramenta nem vigor; volta em C.volta s só para quem pegou
  pegarSolto(j, no, C) {
    if (this.cargas(j, no) <= 0) return this.evento({ t: 'aviso', para: j.id, texto: `${C.nome}: já pegou, volta em ${Math.ceil(j.coletas[no.id].volta - this.tempo)} s` });
    const ganhou = [];
    for (const [k, n] of Object.entries(C.da)) {
      if (!guardar(j.prog.mochila, { k, n })) return this.evento({ t: 'aviso', para: j.id, texto: 'Mochila cheia' });
      ganhou.push({ k, nome: ITENS[k].nome, n });
    }
    j.coletas[no.id] = { n: 0, volta: this.tempo + C.volta };
    this.evento({ t: 'coletou', para: j.id, no: no.id, itens: ganhou, cargas: 0, volta: C.volta });
    for (const g of ganhou) this.historia(j, 'item', { k: g.k, n: g.n, de: 'solto' });
    this.avisarProg(j);
  }
  custoVigor(j, C) { return C.vigor * (1 - profBonus(j.prog.prof[C.prof]).menosVigor); }
  // é de todos? Os veios das zonas de mineração e, desde 2026-11-04 (pedido do André), as árvores: a árvore cortada
  // cai, some para todo mundo (fica o toco) e volta depois de COLETA.arvore.volta s
  comum(no) { return !!no.mina || no.tipo === 'arvore'; }
  // veio esgotado (André 2026-11-06: "continuam sendo barreiras invisíveis"): a pedra sumiu, então não bloqueia mais
  // ninguém até voltar. Veio comum: para todos; veio de cada um: só para quem esgotou (c.coletas)
  veioVazio(id, c) {
    const no = this.coletaveis.get(id); if (!no) return false;
    const s = this.comum(no) ? this.veiosComuns.get(id) : c?.coletas?.[id];
    return !!s && s.n <= 0 && s.volta > this.tempo;
  }
  // batidas que ainda restam neste veio (veio comum ou árvore: de todos; outro veio: cada jogador tem o seu)
  cargas(j, no) {
    if (this.comum(no)) { // zona de mineração ou árvore: é de todos
      const s = this.veiosComuns.get(no.id);
      return !s || s.volta <= this.tempo ? COLETA[no.tipo].cargas : s.n;
    }
    const s = j.coletas[no.id];
    if (!s || s.volta <= this.tempo) return COLETA[no.tipo].cargas;
    return s.n;
  }
  proximaBatida(j, no) {
    const C = COLETA[no.tipo], dur = C.tempo / profBonus(j.prog.prof[C.prof]).rapidez;
    j.coleta = { no: no.id, x: j.x, z: j.z, fim: this.tempo + dur };
    this.evento({ t: 'coleta', id: j.id, no: no.id, dur: r2(dur), prof: C.prof });
  }
  batidaColeta(j) {
    const no = this.coletaveis.get(j.coleta.no), C = COLETA[no.tipo], p = j.prog;
    if (C.ferramenta && contar(p.mochila, C.ferramenta) < 1) return this.pararColeta(j, `Precisa de ${ITENS[C.ferramenta].nome.toLowerCase()}`); // vendeu ou guardou no meio
    if (this.cargas(j, no) <= 0) return this.pararColeta(j, `${C.nome} ${C.esgotado || 'esgotado'}`); // outro jogador esgotou antes
    if (!this.cabeColeta(p, C)) return this.pararColeta(j, 'Mochila cheia: venda ou guarde algo no baú para coletar'); // não gasta vigor à toa
    const custo = this.custoVigor(j, C);
    if (!gastarVigor(p, custo)) return this.pararColeta(j, 'Sem vigor: ele volta sozinho com o tempo (cheio a cada 6 h)');
    const b = profBonus(p.prof[C.prof]), ganhou = [];
    const por = (k, n) => { if (guardar(p.mochila, { k, n })) { const g = ganhou.find((x) => x.k === k); if (g) g.n += n; else ganhou.push({ k, nome: ITENS[k].nome, n }); } else this.evento({ t: 'aviso', para: j.id, texto: 'Mochila cheia' }); };
    for (const [k, n] of Object.entries(C.da)) por(k, n + (Math.random() < b.extra ? 1 : 0));
    for (const [k, ch] of Object.entries(C.raro || {})) if (Math.random() < ch && !filtrado(p, { k })) por(k, 1); // bônus desmarcado no filtro fica no chão
    const volta = no.mina ? this.minas.get(no.mina)?.volta ?? C.volta : C.volta;
    const s = { n: this.cargas(j, no) - 1, volta: this.tempo + volta };
    if (this.comum(no)) { // todo mundo vê a pedra sumir e a árvore cair (dir: para onde ela tomba, para longe de quem cortou)
      this.veiosComuns.set(no.id, s);
      this.evento({ t: 'veio', no: no.id, cargas: s.n, volta, ...(no.tipo === 'arvore' && s.n <= 0 ? { dir: r2(Math.atan2(no.x - j.x, no.z - j.z)) } : {}) });
    }
    else j.coletas[no.id] = s;
    this.pontosProf(j, C.prof, C.vigor);
    if (p.nivel < NIVEL_MAX) this.ganharXP(j, Math.max(1, Math.round(C.vigor))); else this.avisarProg(j); // um pouco de XP pelo trabalho (Quimera: mgVgXp)
    this.evento({ t: 'coletou', para: j.id, no: no.id, itens: ganhou, cargas: s.n, volta });
    for (const g of ganhou) this.historia(j, 'item', { k: g.k, n: g.n, de: 'coleta' });
    if (!ganhou.length) return this.pararColeta(j, null);
    if (s.n <= 0) return this.pararColeta(j, `${C.nome} ${C.esgotado || 'esgotado'}`);
    if (vigorAgora(p.vigor) < this.custoVigor(j, C)) return this.pararColeta(j, 'Sem vigor: ele volta sozinho com o tempo (cheio a cada 6 h)');
    this.proximaBatida(j, no);
  }
  // André 2026-11-07: com a mochila cheia a coleta para e diz o motivo (antes gastava vigor e a carga do veio)
  cabeColeta(p, C) {
    const prova = p.mochila.map((o) => (o ? { ...o } : null));
    return Object.entries(C.da).every(([k, n]) => guardar(prova, { k, n }));
  }
  pararColeta(j, motivo = undefined) {
    if (!j.coleta) return;
    const no = j.coleta.no; j.coleta = null;
    this.evento({ t: 'coletaFim', id: j.id, no });
    if (motivo) this.evento({ t: 'aviso', para: j.id, texto: motivo });
  }

  // ---------- pescaria (igual ao Quimera, André 2026-11-08; números em shared/dados.js PESCA) ----------
  // m = { acao: 'lancar', x, z } (onde a boia cai, o celular procura na frente do herói) | { acao: 'puxar' } | { acao: 'parar' }
  // Estados de j.pesca.st: lancando (0,6 s) > espera (a boia dá beliscadas falsas; puxar aqui perde) > fisgou (o "!": toque
  // na janela) > briga (peixe grande: toques enchem a barra) > pegou (1,6 s do peixe saindo da água).
  pescar(id, m) {
    const j = this.jogadores.get(id); if (!j || j.morto || j.criando || !m) return;
    const P = PESCA, f = j.pesca, aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if (m.acao === 'parar') return f && f.st !== 'pegou' ? this.pararPesca(j, null) : undefined;
    if (!f && !liberado(j.prog, 'pesca')) return aviso(motivoLibera(j.prog, 'pesca')); // progressão (André 2026-11-10)
    if (m.acao === 'puxar') {
      if (!f) return;
      if (f.st === 'espera') return this.pararPesca(j, 'Puxou cedo demais! Espere a boia afundar.');
      if (f.st === 'fisgou') {
        if (P.tier[f.peixe] < 2) return this.pegarPeixe(j);
        const t = P.tier[f.peixe], B = P.briga;
        Object.assign(f, { st: 'briga', t: 0, prog: B.comeco, tap: Math.max(B.toqueMin, B.toque - B.toqueTier * t), dec: B.cai + B.caiTier * t, toques: [] });
        this.evento({ t: 'pesca', para: id, st: 'briga', prog: f.prog, tap: r2(f.tap), dec: r2(f.dec), max: B.max });
        return aviso('Peixe grande! Toque rápido no botão pra puxar!');
      }
      if (f.st === 'briga') {
        f.toques = f.toques.filter((t) => this.tempo - t < 1); // no máximo toquesSeg por segundo (dedo de gente)
        if (f.toques.length >= P.briga.toquesSeg) return;
        f.toques.push(this.tempo);
        f.prog = Math.min(1, f.prog + f.tap);
        if (f.prog >= 1) return this.pegarPeixe(j);
        this.evento({ t: 'pesca', para: id, st: 'briga', prog: r2(f.prog), tap: r2(f.tap), dec: r2(f.dec), max: P.briga.max, t: r2(f.t) });
      }
      return;
    }
    if (m.acao !== 'lancar' || f) return;
    const p = j.prog;
    if (contar(p.mochila, 'vara') < 1) return aviso('Você precisa de uma vara de pescar (crie na mochila: Criar > Ferramentas)');
    if ((noLago(j.x, j.z)?.fundo || 0) > AGUA.peito - 0.2) return aviso('Saia da água pra pescar');
    if (j.esc || j.trava > 0 || j.arrancada) return;
    const x = Number(m.x), z = Number(m.z);
    const d = Math.hypot(x - j.x, z - j.z);
    if (!Number.isFinite(d) || d < 1.5 || d > 5.2 || !((noLago(x, z)?.fundo || 0) > 0.1)) return aviso('Chegue mais perto da água');
    if (vigorAgora(p.vigor) < P.vigorLancar * (1 - profBonus(p.prof.pes).menosVigor)) return aviso('Sem vigor: ele volta sozinho com o tempo (cheio a cada 6 h)');
    if (j.coleta) this.pararColeta(j);
    this.cancelarVila(j);
    j.montado = null; // Quimera: desce da montaria para pescar
    const sp = this.spots.find((v) => v.ativo && Math.hypot(v.x - x, v.z - z) <= P.raioSpot + 0.4);
    if (!sp) return aviso('Aqui não tem peixe. Procure um spot de pesca (a água borbulhando) ou use o Radar de pesca');
    j.ry = Math.atan2(x - j.x, z - j.z);
    j.pesca = { st: 'lancando', t: 0, x, z, ox: j.x, oz: j.z, lista: P.spots[sp.tipo].peixes[sp.agua], spot: sp.tipo, espera: (P.espera[0] + Math.random() * (P.espera[1] - P.espera[0])) * P.esperaK };
    this.evento({ t: 'pesca', para: id, st: 'lancando', x: r2(x), z: r2(z) });
  }
  passoPesca(j, dt) {
    const P = PESCA, f = j.pesca; if (!f) return;
    if (j.morto || j.montado || j.criando) return this.pararPesca(j, null);
    f.t += dt;
    if (f.st === 'lancando' && f.t >= P.lancar) { f.st = 'espera'; f.t = 0; this.evento({ t: 'pesca', para: j.id, st: 'espera' }); }
    else if (f.st === 'espera' && f.t >= f.espera) {
      const lista = f.lista;
      let r = Math.random() * lista.reduce((a, [, w]) => a + w, 0);
      f.peixe = lista[0][0];
      for (const [k, w] of lista) { r -= w; if (r <= 0) { f.peixe = k; break; } }
      f.st = 'fisgou'; f.t = 0; f.janela = (P.tier[f.peixe] >= 3 ? P.janelaRaro : P.janela) + P.folga;
      this.evento({ t: 'pesca', para: j.id, st: 'fisgou' });
    } else if (f.st === 'fisgou' && f.t > f.janela) this.pararPesca(j, 'O peixe escapou...');
    else if (f.st === 'briga') {
      f.prog -= f.dec * dt;
      if (f.prog <= 0 || f.t > P.briga.max) this.pararPesca(j, 'A linha arrebentou... o peixe fugiu!');
    } else if (f.st === 'pegou' && f.t > 1.6) j.pesca = null;
  }
  // tirou o peixe da água: peso sorteado (quase sempre o menor), vigor e pontos de Pescador, XP, gasta a vara
  pegarPeixe(j) {
    const P = PESCA, f = j.pesca, p = j.prog, k = f.peixe, [a, b] = P.peso[k];
    const peso = a + (b - a) * Math.pow(Math.random(), 1.6), nome = ITENS[k].nome, tier = P.tier[k];
    const txt = peso < 1 ? `${Math.round(peso * 1000)} g` : `${peso.toFixed(1).replace('.', ',')} kg`;
    if (!guardar(p.mochila, { k, n: 1 })) {
      this.pararPesca(j, `Mochila cheia! O ${nome.toLowerCase()} escapou`);
      return;
    }
    const custo = P.vigor[k] * (1 - profBonus(p.prof.pes).menosVigor);
    gastarVigor(p, Math.min(custo, vigorAgora(p.vigor))); // Quimera: paga o que tem
    const dobro = Math.random() < P.dobro * profBonus(p.prof.pes).rank && guardar(p.mochila, { k, n: 1 });
    this.pontosProf(j, 'pes', P.vigor[k]);
    p.vara = (p.vara || 0) + 1;
    let quebrou = false;
    if (p.vara >= P.durabilidade) { tirar(p.mochila, 'vara', 1); p.vara = 0; quebrou = true; }
    Object.assign(f, { st: 'pegou', t: 0 });
    this.evento({ t: 'pesca', para: j.id, st: 'pegou', peixe: k, nome, peso: txt, tier, dobro, vara: P.durabilidade - p.vara });
    this.evento({ t: 'aviso', para: j.id, texto: (tier >= 4 ? 'LENDÁRIO! ' : tier >= 3 ? 'Que peixão! ' : '') + `Pegou: ${nome} · ${txt}` });
    if (quebrou) this.evento({ t: 'aviso', para: j.id, texto: 'Sua vara de pescar quebrou. Crie outra na mochila' });
    this.historia(j, 'pesca', { k, n: dobro ? 2 : 1, barco: j.veiculo === 'barquinho' });
    if (p.nivel < NIVEL_MAX) this.ganharXP(j, Math.max(1, Math.round(P.vigor[k]))); else this.avisarProg(j);
  }
  // vagas de spot: por lago e por tipo (PESCA.spots[tipo].por[água]; lago com pesca: true ganha "grande" comuns)
  criarSpots() {
    const P = PESCA, lista = [];
    for (const L of LAGOS) {
      const agua = L.agua || 'doce';
      for (const [tipo, T] of Object.entries(P.spots)) {
        const n = T.por[agua] ? (L.pesca && T.grande ? T.grande : T.por[agua]) : 0;
        for (let i = 0; i < n; i++) lista.push({ id: `s${lista.length}`, lago: L, agua, tipo, ativo: false, nasce: Math.random() * 3, fim: 0, x: 0, z: 0 });
      }
    }
    return lista;
  }
  passoSpots() {
    const P = PESCA, sorte = ([a, b]) => a + Math.random() * (b - a);
    for (const v of this.spots) {
      if (v.ativo && this.tempo >= v.fim) { v.ativo = false; v.nasce = this.tempo + sorte(P.spots[v.tipo].volta); }
      else if (!v.ativo && this.tempo >= v.nasce) {
        const L = v.lago, R = Math.max(L.rx, L.rz) * 1.45;
        for (let t = 0; t < 40; t++) { // perto da beira (dá para lançar de terra), água funda e longe dos outros spots
          const a = Math.random() * Math.PI * 2, sx = Math.sin(a), sz = Math.cos(a);
          let borda = 0;
          for (let r = 0.5; r < R; r += 0.5) { if (noLago(L.x + sx * r, L.z + sz * r)?.lago !== L) break; borda = r; }
          const rr = borda - (1.5 + Math.random() * 2.5); // o centro fica de 1,5 a 4 m da beira: a boia alcança o spot de terra
          if (rr < 1) continue;
          const x = L.x + sx * rr, z = L.z + sz * rr, q = noLago(x, z);
          if (!q || q.lago !== L || q.fundo < 0.3) continue;
          if (this.spots.some((o) => o !== v && o.ativo && Math.hypot(o.x - x, o.z - z) < P.raioSpot * 2.5)) continue;
          Object.assign(v, { ativo: true, x, z, fim: this.tempo + sorte(P.spots[v.tipo].vida) });
          break;
        }
        if (!v.ativo) v.nasce = this.tempo + 5; // não achou lugar: tenta de novo daqui a pouco
      }
    }
  }
  pararPesca(j, motivo = undefined) {
    if (!j.pesca) return;
    j.pesca = null;
    this.evento({ t: 'pesca', para: j.id, st: 'fim' });
    if (motivo) this.evento({ t: 'aviso', para: j.id, texto: motivo });
  }

  // ---------- criação: Ferreiro e Alfaiate (shared/dados.js RECEITAS) ----------
  // m = { r: 'espada' } (receita). Perto da oficina: usa os materiais, gasta vigor e dá a peça (raridade sorteada).
  // m = { r, n } (André 2026-11-05): fila de n com barrinha, igual à construção (fabricar); cada uma leva tempoCriar(R) s.
  criar(id, m) {
    const j = this.jogadores.get(id); if (!j || j.criando || j.morto || !m) return;
    const R = RECEITAS[m.r], aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if (!R) return;
    if (m.n === undefined) return this.criarUm(id, m);
    if (j.fabrica) return aviso('Já está criando: espere terminar ou pare');
    const motivo = this.motivoReceita(j, R).motivo; if (motivo) return aviso(motivo);
    const n = Math.max(1, Math.min(CRIAR_OBRA.maxFila, m.n | 0 || 1)), dur = tempoCriar(R);
    const nome = ITENS[R.faz].nome;
    j.fabrica = { r: m.r, k: R.faz, nome, n, feito: 0, dur, fim: this.tempo + dur };
    this.evento({ t: 'fabricando', para: id, k: R.faz, r: m.r, nome, n, feito: 0, dur });
  }
  // por que não dá para criar a receita agora: { motivo: '' | texto, npc: onde cria }
  motivoReceita(j, R) {
    const p = j.prog;
    const of = OFICINA[R.prof];
    // perto da estação certa: a pública da vila (André 2026-11-11: o NPC não cria mais, quem cria é o herói na bigorna,
    // no forninho ou na bancada ao lado dele) ou uma construída num lote (bigorna, fornalha ou bancada)
    const npc = this.estacaoPerto(j, R);
    if (!npc) return { motivo: RECEITA_ESTACAO(R) === 'fornalha' ? 'Funda no forninho da ferraria do Tomás ou na fornalha do seu terreno' : RECEITA_ESTACAO(R) === 'fogao' ? 'Cozinhe perto do fogão do seu terreno' : `Crie ${of.onde} ou perto de uma ${CONSTRUCOES[RECEITA_ESTACAO(R)].nome.toLowerCase()}` };
    if (profNivel(p.prof[R.prof]) < R.nivel) return { motivo: `Precisa de ${PROFISSOES[R.prof].nome} Nv ${R.nivel}` };
    { // progressão (André 2026-11-10): Ferreiro e Alfaiate depois da missão do Tomás; cada receita e cada evolução no seu nível
      const lib = (R.prof === 'fer' || R.prof === 'alf') && motivoLibera(p, 'forja') || (R.r ? motivoLibera(p, 'evoluir', R.r) : motivoLibera(p, 'receita', R.faz));
      if (lib) return { motivo: lib };
    }
    for (const [k, n] of Object.entries(R.usa)) if (contar(p.mochila, k) < n) return { motivo: `Falta ${ITENS[k].nome} (${contar(p.mochila, k)}/${n})` };
    const custo = R.vigor * (1 - profBonus(p.prof[R.prof]).menosVigor);
    if (vigorAgora(p.vigor) < custo) return { motivo: 'Sem vigor: ele volta sozinho com o tempo (cheio a cada 6 h)' };
    return { motivo: '', npc };
  }
  // cria uma da receita na hora (a fila chama uma vez por barrinha)
  criarUm(id, m) {
    const j = this.jogadores.get(id); if (!j || j.criando || j.morto || !m) return;
    const R = RECEITAS[m.r], p = j.prog, aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if (!R) return;
    const { motivo, npc } = this.motivoReceita(j, R); if (motivo) return aviso(motivo);
    const custo = R.vigor * (1 - profBonus(p.prof[R.prof]).menosVigor);
    let novo;
    if (ehEquip(R.faz)) {
      let r = 0; const ch = chanceRaridade(p.prof[R.prof]);
      while (r < RARIDADE_CRIAR.ate && Math.random() < ch) r++;
      novo = { k: R.faz, r };
    } else novo = { k: R.faz, n: 1 };
    // confere se cabe antes de gastar (numa cópia da mochila sem os materiais)
    const prova = p.mochila.map((o) => (o ? { ...o } : null));
    for (const [k, n] of Object.entries(R.usa)) tirar(prova, k, n);
    if (!guardar(prova, novo)) return aviso('Mochila cheia');
    gastarVigor(p, custo);
    p.mochila = prova;
    this.pontosProf(j, R.prof, R.vigor);
    this.ganharXP(j, Math.max(1, Math.round(R.vigor)));
    this.evento({ t: 'criou', para: id, prof: R.prof, nome: nomeItem(novo), r: novo.r ?? -1, x: r2(npc.x), z: r2(npc.z) });
    aviso(`Criou ${nomeItem(novo)}!`);
    this.historia(j, 'criar', { k: R.faz });
    this.aplicarStatus(j);
    this.avisarProg(j);
  }
  // quem compra itens: a Rosa e os NPCs com 'vender' nas acoes (o Tomás, o ferreiro)
  pertoDeQuemCompra(j) { return this.pertoDaLoja(j) || (this.mapa.npcs || []).some((n) => (n.acoes || []).includes('vender') && dist(n, j) < LOJA_DISTANCIA); }
  pertoDeQuemConserta(j) { return (this.mapa.npcs || []).some((n) => (n.acoes || []).includes('consertar') && dist(n, j) < LOJA_DISTANCIA); }
  pertoDaLoja(j) { return (this.mapa.npcs || []).some((n) => n.funcao === 'loja' && dist(n, j) < LOJA_DISTANCIA); }

  // ---------- a Casa do Comércio (shared/leilao.js; história v2, Entrega 3) ----------
  // Um leilão só para o mundo inteiro: o servidor põe o mesmo em todas as salas (this.leilao) e grava quando muda
  // (aoLeilao). Sem servidor (teste), cada simulação tem o seu. m = { acao: 'ver' | 'anunciar' | 'comprar' | 'cancelar' |
  // 'retirar', busca: { tipo, r, ordem, texto }, i (lugar na mochila), preco, horas, id (do anúncio) }
  pertoDoLeiloeiro(j) { return (this.mapa.npcs || []).some((n) => n.funcao === 'leilao' && dist(n, j) < LEILAO.distancia); }
  leilaoMsg(id, m) {
    const j = this.jogadores.get(id); if (!j || j.criando || !m || typeof m !== 'object') return;
    const L = (this.leilao ||= new Leilao()), p = j.prog, aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if (!this.pertoDoLeiloeiro(j)) return aviso('O leilão é com o Otávio, na Casa do Comércio da Vila do Rio Claro');
    if (j.morto) return;
    let mudou = L.vencer();
    const busca = m.busca && typeof m.busca === 'object' ? { tipo: TIPOS_LEILAO[m.busca.tipo] ? m.busca.tipo : undefined, r: Number.isInteger(m.busca.r) && m.busca.r >= 0 && m.busca.r < RARIDADES.length ? m.busca.r : undefined,
      ordem: ['barato', 'caro', 'novo'].includes(m.busca.ordem) ? m.busca.ordem : 'barato', texto: typeof m.busca.texto === 'string' ? m.busca.texto.slice(0, 24) : undefined } : {};
    if (m.acao === 'anunciar') {
      const i = Number.isInteger(m.i) ? m.i : -1, it = i >= 0 && i < p.mochila.length ? p.mochila[i] : null;
      if (!it) return aviso('Escolha um item da mochila');
      if (it.cad) return aviso('Item trancado não vai à venda. Abra o cadeado antes');
      if (ITENS[it.k]?.usar?.veiculo || this.carrinhoFora(j, it)) return aviso('Veículo não vai para o leilão');
      const r = L.anunciar(j.conta, j.nome, { ...it }, Number(m.preco), Number(m.horas));
      if (typeof r === 'string') return aviso(r);
      p.mochila[i] = null; mudou = true;
      aviso(`${nomeItem(it)} à venda por ${r.preco} de ouro (${Number(m.horas)} h)`);
      this.historia(j, 'leilao', { de: 'anunciar' });
    } else if (m.acao === 'comprar' && typeof m.id === 'string') {
      const a = L.achar(m.id); if (!a) return aviso('Esse anúncio já saiu');
      if (p.ouro < a.preco) return aviso(`Faltam ${a.preco - p.ouro} de ouro`);
      const prova = p.mochila.map((o) => (o ? { ...o } : null)); // cabe na mochila?
      if (!guardar(prova, { ...a.item })) return aviso('Mochila cheia');
      const r = L.comprar(m.id, j.conta);
      if (typeof r === 'string') return aviso(r);
      p.ouro -= a.preco; guardar(p.mochila, { ...a.item }); mudou = mudou || !a.casa;
      aviso(`Comprou ${nomeItem(a.item)} por ${a.preco} de ouro`);
      this.historia(j, 'leilao', { de: 'comprar' });
      const avisa = this.aoVendaLeilao || ((c, t) => { const v = this.porConta(c); if (v) this.evento({ t: 'aviso', para: v.id, texto: t }); }); // o servidor avisa em qualquer sala
      if (!a.casa) avisa(a.conta, `Vendeu ${nomeItem(a.item)} no leilão: ${r.liquido} de ouro com o Otávio${r.taxa ? ` (taxa ${r.taxa})` : ''}`);
    } else if (m.acao === 'cancelar' && typeof m.id === 'string') {
      const a = L.cancelar(m.id, j.conta); if (typeof a === 'string') return aviso(a);
      if (!guardar(p.mochila, a.item)) L.caixaDe(j.conta).itens.push(a.item); // mochila cheia: fica com o Otávio
      mudou = true;
      aviso(`Anúncio cancelado: ${nomeItem(a.item)} voltou`);
    } else if (m.acao === 'retirar') {
      const cx = L.caixaDe(j.conta); let n = 0;
      const ouro = cx.ouro; p.ouro += ouro; cx.ouro = 0;
      while (cx.itens.length && guardar(p.mochila, cx.itens[0])) { cx.itens.shift(); n++; }
      if (ouro || n) { mudou = true; aviso(`Retirou ${ouro ? ouro + ' de ouro' : ''}${ouro && n ? ' e ' : ''}${n ? n + (n === 1 ? ' item' : ' itens') : ''}${cx.itens.length ? ' (mochila cheia: o resto fica guardado)' : ''}`); this.historia(j, 'leilao', { de: 'retirar' }); }
      else aviso(cx.itens.length ? 'Mochila cheia' : 'Nada para retirar');
    }
    if (mudou) { this.aoLeilao?.(L); this.avisarProg(j); }
    const cx = L.caixa[j.conta] || { ouro: 0, itens: [] };
    this.evento({ t: 'leilao', para: id, lista: L.buscar(busca, j.conta).map(anuncioParaApp), meus: L.meus(j.conta).map(anuncioParaApp),
      caixa: { ouro: cx.ouro, itens: cx.itens }, semTaxa: L.semTaxaDe(j.conta), taxa: LEILAO.taxa, max: LEILAO.max, horas: LEILAO.horas, agora: Date.now() });
  }

  // ---------- Vila dos Lotes: comprar lote, construir e horta (shared/dados.js VILA_LOTES, LOTE, CONSTRUCOES, PLANTAS) ----------
  // Como no Quimera (modo construção com abas Construir e Fazenda), só que cada jogador constrói apenas no lote que comprou.
  loteDe(j) { for (const L of this.lotes.values()) if (L.dono === j.conta) return L; return null; }
  // estação construída (bigorna, fornalha, bancada) perto do jogador que serve para a receita: {x, z} ou null
  estacaoPerto(j, R) {
    const k = RECEITA_ESTACAO(R);
    // as públicas da vila (bigorna e forninho da ferraria, bancada da Rosa): qualquer um usa
    for (const E of this.mapa.estacoes || []) if (E.k === k && dist(E, j) <= LOTE.estacaoDist + 0.6) return E;
    // fornalha e fogão (André 2026-11-07): só os do próprio terreno, porque o dono deixa coisa dentro; bancada e bigorna valem em qualquer terreno
    for (const L of this.lotes.values()) for (const p of L.pecas) if (p.k === k && ((k !== 'fornalha' && k !== 'fogao') || (L.dono && L.dono === j.conta)) && dist(p, j) <= LOTE.estacaoDist + 0.6 && semParede(this.lotes.values(), j, p)) return p;
    return null;
  }
  // o que o celular precisa saber de um lote (agora = relógio do servidor, para a horta crescer igual nos dois)
  dadosLote(L) {
    const agora = Date.now();
    for (const t of Object.values(L.horta)) crescerPlanta(t, agora);
    const { x0, z0, x1, z1 } = L.def;
    return { lote: L.def.id, ret: [x0, z0, x1, z1], dono: L.dono ? L.nomeDono : null, pecas: L.pecas.map((p) => [p.id, p.k, p.x, p.z, p.r]),
      horta: Object.entries(L.horta).map(([c, t]) => [c, t.c, r2(t.g), t.w, t.u]), agora, taxa: L.taxa || null };
  }
  avisarLote(L) {
    this.lotesMudados.add(L.def.id);
    this.evento({ t: 'lote', ...this.dadosLote(L) });
  }
  // quem entra recebe todos os lotes e qual é o dele
  enviarLotes(id) {
    const j = this.jogadores.get(id); if (!j) return;
    const meu = this.loteDe(j);
    if (meu && meu.nomeDono !== j.nome) { meu.nomeDono = j.nome; this.avisarLote(meu); }
    this.evento({ t: 'lotes', para: id, meu: meu ? meu.def.id : null, lista: [...this.lotes.values()].map((L) => this.dadosLote(L)) });
  }
  // lotes guardados no servidor: [{ id, dono, nome, dados: { pecas, horta, prox } }]
  carregarLotes(lista) {
    for (const s of lista || []) {
      const d = s.dados || {};
      // terreno escolhido pelo jogador: o retângulo vem junto (os lotes antigos usam o chão de antes)
      let L = this.lotes.get(s.id);
      if (!s.dono) { if (L && !L.def.fixo) this.lotes.delete(s.id); else if (L) L.dono = null; continue; }
      if (!L) {
        const R = retTerreno(d.ret) || (LOTES_ANTIGOS[s.id] && { ...LOTES_ANTIGOS[s.id] }); if (!R) continue;
        L = { def: { id: s.id, nome: 'Terreno', ...R }, dono: null, nomeDono: '', pecas: [], horta: {}, prox: 1 };
        this.lotes.set(s.id, L);
      }
      L.dono = s.dono || null; L.nomeDono = String(s.nome || '');
      L.pecas = (Array.isArray(d.pecas) ? d.pecas : []).filter((p) => p && CONSTRUCOES[p.k] && Number.isFinite(p.x) && Number.isFinite(p.z))
        .map((p) => ({ id: String(p.id), k: p.k, x: p.x, z: p.z, r: (p.r | 0) & 3, lote: L.def.id }));
      L.horta = {};
      for (const [c, t] of Object.entries(d.horta || {})) if (/^-?\d+,-?\d+$/.test(c) && t) L.horta[c] = { c: PLANTAS[t.c] ? t.c : '', g: +t.g || 0, w: +t.w || 0, u: +t.u || 0 };
      L.prox = Math.max(1, d.prox | 0, ...L.pecas.map((p) => (+String(p.id).slice(1) || 0) + 1));
      L.bauNv = Math.max(0, Math.min(BAU.niveis.length - 1, d.bauNv | 0)); // baú melhorado (André 2026-11-07): 0 = 40, 1 = 60, 2 = 80
      L.bau = Array.isArray(d.bau) ? Array.from({ length: bauLugares(L.bauNv) }, (_, i) => (d.bau[i] ? itemValido(d.bau[i]) || null : null)) : null;
      // fornalhas (2026-11-07): o que está dentro de cada uma, pelo id da peça
      L.fornos = {};
      for (const [pid, f] of Object.entries(d.fornos && typeof d.fornos === 'object' ? d.fornos : {})) L.fornos[String(pid)] = fornoValido(f);
      // taxa semanal (2026-11-05): terreno de antes começa a contar agora (ninguém recebe conta atrasada)
      if (d.amiga && typeof d.amiga === 'object') L.amiga = d.amiga; // Cecília: o progresso dela vai junto com o terreno
      if (Number(d.taxa) > 0) L.taxa = Number(d.taxa); else if (!L.taxa) { L.taxa = Date.now(); this.lotesMudados.add(L.def.id); }
    }
    this.refazerSolidosLotes();
  }
  // aventureiros sem casa (André 2026-11-11): o progresso de cada um vai para a tabela mundo do banco ('npc:' + id)
  npcsParaSalvar() {
    const l = [...(this.npcsMudados || [])].map((id) => ({ id, dados: this.npcSalvos.get(id) })).filter((o) => o.dados);
    this.npcsMudados?.clear();
    return l;
  }
  carregarNpc(id, dados) { if (dados && typeof dados === 'object') (this.npcSalvos ||= new Map()).set(id, dados); }
  lotesParaSalvar() {
    const l = [...this.lotesMudados].filter((id) => this.lotes.has(id)).map((id) => {
      const L = this.lotes.get(id);
      const { x0, z0, x1, z1 } = L.def;
      return { id, dono: L.dono, nome: L.nomeDono, dados: { ret: { x0, z0, x1, z1 }, pecas: L.pecas.map(({ id: i, k, x, z, r }) => ({ id: i, k, x, z, r })), horta: L.horta, prox: L.prox, bau: L.bau || null, bauNv: L.bauNv || 0, fornos: L.fornos || {}, taxa: L.taxa || null, ...(L.amiga ? { amiga: L.amiga } : {}) } };
    });
    // terrenos vendidos de volta para o jogo: a linha fica sem dono (o chão volta a ser livre)
    for (const id of this.lotesSoltos) l.push({ id, dono: null, nome: '', dados: {} });
    this.lotesSoltos.clear();
    this.lotesMudados.clear();
    return l;
  }
  // as peças são sólidas: os círculos de cada uma entram nos obstáculos (o herói não atravessa a bigorna)
  refazerSolidosLotes() {
    this.obstaculos = this.obstaculos.filter((k) => !k.peca);
    const T = this.terreno, chao = (x, z) => { let h = chaoDaVila(x, z); for (const r of T.rochas) { const a = T.alturaNa(r, x, z); if (a > h) h = a; } for (const r of T.casas) { const a = T.alturaNa(r, x, z); if (a > h) h = a; } return h; };
    // o móvel fica no chão ou em cima da fundação: o topo dele (CONSTRUCOES.alto) parte daí
    const piso = (L, p) => chao(p.x, p.z) + (L.pecas.some((o) => tipoPeca(o.k) === 'fundacao' && Math.abs(o.x - p.x) < CASA.grade / 2 && Math.abs(o.z - p.z) < CASA.grade / 2) ? CASA.fundacao : 0);
    for (const L of this.lotes.values()) for (const p of L.pecas) this.obstaculos.push(...solidosPeca(p, CONSTRUCOES[p.k].alto ? piso(L, p) : null));
    this.refazerTampos();
    // casa: piso, paredes e telhado viram chão e parede de verdade (anda em cima, escala, fica em pé no telhado)
    T.porCasasDosJogadores([...this.lotes.values()].flatMap((L) => (L.dono ? pecasCasaSolidas(L, chao) : [])));
  }
  // m = { x0, z0, x1, z1 }: o terreno que o jogador marcou (toque num canto e arraste). Paga por bloco (precoTerreno).
  // Confere o tamanho, a borda das terras, a estrada, os terrenos dos outros e o ouro; o banco confere de novo (outras salas).
  comprarLote(id, m) {
    const j = this.jogadores.get(id); if (!j || j.criando || j.morto || !m) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if (this.loteDe(j)) return aviso('Você já tem um terreno');
    { const lib = motivoLibera(j.prog, 'terreno'); if (lib) return aviso(`Terreno: ${lib.toLowerCase()}`); } // progressão (André 2026-11-10)
    const R = retTerreno(m); if (!R) return;
    const motivo = motivoTerreno(R, [...this.lotes.values()].filter((L) => L.dono).map((L) => L.def)); if (motivo) return aviso(motivo);
    if (distRet(R, j.x, j.z) > 40) return aviso('Chegue mais perto do terreno');
    // FASE 3 (André 2026-11-08): cada vila tem no máximo V.max terrenos com dono; cheia, procure outra vila ou bairro
    const V = vilaEm((R.x0 + R.x1) / 2, (R.z0 + R.z1) / 2) || VILAS_TERRENO[0];
    const naVila = [...this.lotes.values()].filter((L) => L.dono && !AMIGOS_VIRTUAIS.some((d) => d.conta === L.dono) && (vilaEm((L.def.x0 + L.def.x1) / 2, (L.def.z0 + L.def.z1) / 2) || VILAS_TERRENO[0]) === V).length;
    if (naVila >= V.max) return aviso(`${V.nome} já tem ${V.max} terrenos. Procure outra vila`);
    const w = R.x1 - R.x0, d = R.z1 - R.z0, preco = precoTerreno(w, d);
    if (j.prog.ouro < preco) return aviso(`Faltam ${preco - j.prog.ouro} de ouro (o terreno custa ${preco})`);
    const lid = 't' + String(j.conta).replace(/[^\w]/g, '').slice(0, 14);
    if (this.aoComprarLote && !this.aoComprarLote(lid, j.conta, j.nome, R)) return aviso('Esse pedaço acabou de ser vendido em outra sala');
    j.prog.ouro -= preco;
    const L = { def: { id: lid, nome: 'Terreno', ...R }, dono: j.conta, nomeDono: j.nome, pecas: [], horta: {}, prox: 1, taxa: Date.now() };
    this.lotesSoltos.delete(lid);
    this.lotes.set(lid, L);
    aviso(`Terreno de ${w} x ${d} m comprado por ${preco} de ouro! Toque no martelo para construir e plantar`);
    this.evento({ t: 'meuLote', para: id, lote: lid });
    this.historia(j, 'terreno');
    this.avisarLote(L);
    this.avisarProg(j);
  }
  // ---------- vender, mudar o tamanho e a taxa do correio (André 2026-11-05) ----------
  // conta do correio atrasada: com LOTE.taxaTrava contas sem pagar não dá para construir nem plantar (colher e regar dá)
  loteTravado(L, aviso) {
    const c = contaTerreno(L.def, L.taxa, Date.now());
    if (c.semanas < LOTE.taxaTrava) return false;
    aviso(`Conta do terreno atrasada (${c.valor} de ouro): pague no correio para construir e plantar`);
    return true;
  }
  // vende o terreno de volta para o jogo por LOTE.venda do preço. As peças voltam para a mochila; a horta precisa estar
  // colhida e o baú vazio. A conta do correio em aberto sai do valor.
  venderLote(id) {
    const j = this.jogadores.get(id); if (!j || j.criando || j.morto) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    const L = this.loteDe(j); if (!L) return aviso('Você não tem terreno');
    if (distRet(L.def, j.x, j.z) > LOTE.alcance + 0.5) return aviso('Chegue perto do seu terreno');
    if (Object.values(L.horta).some((t) => t.c)) return aviso('Colha ou desfaça as plantas antes de vender');
    if ((L.bau || []).some(Boolean)) return aviso('Esvazie o baú antes de vender');
    if (Object.values(L.fornos || {}).some(fornoTemCoisa)) return aviso('Esvazie a fornalha e o fogão antes de vender');
    const prova = j.prog.mochila.map((o) => (o ? { ...o } : null));
    for (const p of L.pecas) if (!guardar(prova, { k: 'obra_' + p.k, n: 1 })) return aviso('Mochila cheia: as peças do terreno não cabem');
    const w = L.def.x1 - L.def.x0, d = L.def.z1 - L.def.z0, c = contaTerreno(L.def, L.taxa, Date.now());
    const valor = Math.max(0, vendaTerreno(w, d) - c.valor);
    if (this.aoVenderLote) this.aoVenderLote(L.def.id);
    j.prog.mochila = prova;
    j.prog.ouro += valor;
    this.lotes.delete(L.def.id);
    this.lotesMudados.delete(L.def.id);
    this.lotesSoltos.add(L.def.id);
    this.refazerSolidosLotes();
    aviso(`Terreno vendido por ${valor} de ouro` + (c.valor ? ` (a conta de ${c.valor} saiu do valor)` : '') + (L.pecas.length ? '. As peças voltaram para a mochila' : ''));
    this.evento({ t: 'lote', lote: L.def.id, dono: null });
    this.evento({ t: 'meuLote', para: id, lote: '' });
    this.avisarProg(j);
  }
  // m = { x0, z0, x1, z1 }: o mesmo terreno com outro tamanho (ou em outro lugar perto, desde que as peças e a horta
  // fiquem dentro). Aumentar paga os blocos novos; diminuir devolve LOTE.venda do preço dos blocos que saem.
  mudarLote(id, m) {
    const j = this.jogadores.get(id); if (!j || j.criando || j.morto || !m) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    const L = this.loteDe(j); if (!L) return aviso('Você não tem terreno');
    const R = retTerreno(m); if (!R) return;
    if (distRet(L.def, j.x, j.z) > LOTE.alcance + 0.5) return aviso('Chegue perto do seu terreno');
    const conta = contaTerreno(L.def, L.taxa, Date.now());
    if (conta.semanas > 0) return aviso(`Pague a conta do correio (${conta.valor} de ouro) antes de mudar o terreno`);
    const motivo = motivoTerreno(R, [...this.lotes.values()].filter((o) => o.dono && o !== L).map((o) => o.def)); if (motivo) return aviso(motivo);
    if (L.pecas.some((p) => foraDoLote(retPeca(p), R))) return aviso('Tem peça fora do terreno novo: desmonte ou marque maior');
    if (Object.keys(L.horta).some((c) => { const [i, k] = c.split(',').map(Number); return foraDoLote([i, k, i + 1, k + 1], R); })) return aviso('Tem horta fora do terreno novo: desfaça a terra ou marque maior');
    const maxP = maxPecasTerreno(R.x1 - R.x0, R.z1 - R.z0);
    if (L.pecas.length > maxP) return aviso(`O terreno novo só comporta ${maxP} peças (você tem ${L.pecas.length})`);
    const antes = (L.def.x1 - L.def.x0) * (L.def.z1 - L.def.z0), depois = (R.x1 - R.x0) * (R.z1 - R.z0);
    const custo = depois > antes ? (depois - antes) * LOTE.precoBloco : -Math.floor((antes - depois) * LOTE.precoBloco * LOTE.venda);
    if (custo > j.prog.ouro) return aviso(`Faltam ${custo - j.prog.ouro} de ouro (os blocos novos custam ${custo})`);
    if (this.aoMudarLote && !this.aoMudarLote(L.def.id, j.conta, R)) return aviso('Esse pedaço acabou de ser vendido em outra sala');
    j.prog.ouro -= custo;
    Object.assign(L.def, R);
    this.refazerSolidosLotes();
    aviso(`Terreno agora com ${R.x1 - R.x0} x ${R.z1 - R.z0} m` + (custo > 0 ? ` (pagou ${custo} de ouro)` : custo < 0 ? ` (recebeu ${-custo} de ouro)` : ''));
    this.evento({ t: 'meuLote', para: id, lote: L.def.id, mudou: true });
    this.avisarLote(L);
    this.avisarProg(j);
  }
  // paga as contas do correio que chegaram (todas de uma vez)
  pagarTaxa(id) {
    const j = this.jogadores.get(id); if (!j || j.criando || j.morto) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    const L = this.loteDe(j); if (!L) return;
    if (distRet(L.def, j.x, j.z) > LOTE.alcance + 0.5) return aviso('Chegue perto do seu correio');
    const c = contaTerreno(L.def, L.taxa, Date.now());
    if (c.valor <= 0) return aviso('Nenhuma conta para pagar');
    if (j.prog.ouro < c.valor) return aviso(`Faltam ${c.valor - j.prog.ouro} de ouro para pagar a conta (${c.valor})`);
    j.prog.ouro -= c.valor;
    L.taxa = (Number(L.taxa) || Date.now()) + c.semanas * LOTE.taxaDias * 86400000;
    aviso(`Conta do terreno paga: ${c.valor} de ouro`);
    this.avisarLote(L);
    this.avisarProg(j);
  }
  // quem tem dono em memória mas não no banco (vendeu em outra sala) some daqui; o terreno certo vem do banco
  esquecerLotesDe(conta, menos) {
    let mudou = false;
    for (const [id, L] of this.lotes) if (L.dono === conta && id !== menos) { this.lotes.delete(id); this.evento({ t: 'lote', lote: id, dono: null }); mudou = true; }
    if (mudou) this.refazerSolidosLotes();
  }
  // conferências comuns: dono do lote, perto o bastante e lugar dentro do lote. Devolve o lote ou null (já avisou)
  loteParaMexer(j, x, z, aviso) {
    if (j.criando || j.morto || j.montado) return null;
    const L = this.loteDe(j);
    if (!L) { aviso('Compre um terreno nas Terras da Estrada para construir'); return null; }
    if (!Number.isFinite(x) || !Number.isFinite(z)) return null;
    // câmera flutuante (como no Quimera): o herói fica no terreno ou perto dele e a mira vai em qualquer canto dele
    if (distRet(L.def, j.x, j.z) > LOTE.alcance + 0.5) { aviso('Chegue perto do seu terreno'); return null; }
    return L;
  }
  // m = { k, x, z, r }: peça nova no lote (paga com os materiais da mochila)
  construir(id, m) {
    const j = this.jogadores.get(id); if (!j || !m) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    const C = CONSTRUCOES[m.k]; if (!C) return;
    const x = Math.round(Number(m.x) * 20) / 20, z = Math.round(Number(m.z) * 20) / 20, r = (m.r | 0) & 3;
    const L = this.loteParaMexer(j, x, z, aviso); if (!L) return;
    if (this.loteTravado(L, aviso)) return;
    const maxP = maxPecasTerreno(L.def.x1 - L.def.x0, L.def.z1 - L.def.z0);
    if (L.pecas.length >= maxP) return aviso(`Limite de ${maxP} peças no terreno: desmonte uma para pôr outra`);
    const p = { id: 'p' + L.prox, k: m.k, x, z, r, lote: L.def.id };
    const motivo = motivoPeca(L, p, j); if (motivo) return aviso(motivo);
    // 2026-11-04: a peça é um item (cria-se antes, como no Quimera: fabricar); colocar gasta um
    if (contar(j.prog.mochila, 'obra_' + m.k) < 1) return aviso(`Crie ${C.nome.toLowerCase()} primeiro (botão Criar no modo construção)`);
    tirar(j.prog.mochila, 'obra_' + m.k, 1);
    L.prox++;
    L.pecas.push(p);
    this.refazerSolidosLotes();
    this.evento({ t: 'construiu', para: id, k: p.k, px: x, pz: z });
    this.historia(j, 'construir', { k: p.k });
    this.avisarLote(L);
    this.avisarProg(j);
  }
  // m = { p } (id da peça): desmonta e devolve o custo inteiro
  desmontar(id, m) {
    const j = this.jogadores.get(id); if (!j || !m) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    const L = this.loteDe(j); if (!L) return;
    const i = L.pecas.findIndex((p) => p.id === String(m.p)); if (i < 0) return;
    const p = L.pecas[i];
    if (!this.loteParaMexer(j, p.x, p.z, aviso)) return;
    const dep = motivoDesmontar(L, p); if (dep) return aviso(dep);
    if (p.k === 'bau' && L.pecas.filter((o) => o.k === 'bau').length === 1 && (L.bau || []).some(Boolean)) return aviso('Esvazie o baú antes de desmontar o último');
    if ((p.k === 'fornalha' || p.k === 'fogao') && L.fornos && L.fornos[p.id]) {
      avancarForno(L.fornos[p.id], Date.now(), regraForno(p.k));
      if (fornoTemCoisa(L.fornos[p.id])) return aviso(p.k === 'fogao' ? 'Esvazie o fogão antes de desmontar' : 'Esvazie a fornalha antes de desmontar');
      delete L.fornos[p.id];
    }
    const prova = j.prog.mochila.map((o) => (o ? { ...o } : null));
    if (!guardar(prova, { k: 'obra_' + p.k, n: 1 })) return aviso('Mochila cheia: a peça não cabe');
    j.prog.mochila = prova;
    L.pecas.splice(i, 1);
    this.refazerSolidosLotes();
    aviso(`${CONSTRUCOES[p.k].nome}: voltou para a mochila`);
    this.avisarLote(L);
    this.avisarProg(j);
  }
  // bancada construída perto (qualquer terreno): as peças do Quimera com needBench só se criam perto dela
  bancadaPerto(j) {
    for (const L of this.lotes.values()) for (const p of L.pecas) if (p.k === 'bancada' && dist(p, j) <= LOTE.estacaoDist + 0.6) return p;
    return null;
  }
  // m = { k }: cria a peça (vira o item obra_k na mochila) ou a ferramenta da fazenda (enxada, regador), como no Quimera
  // m = { k, n }: começa a criar n (1 a CRIAR_OBRA.maxFila) da peça; cada uma leva tempoCriar s (barrinha no app).
  // m = { parar: true }: para a fila (a que estava carregando não sai). Confere tudo de novo a cada peça.
  fabricar(id, m) {
    const j = this.jogadores.get(id); if (!j || !m || j.criando || j.morto) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if (m.parar) { if (j.fabrica) this.pararFabrica(j, 'Parou de criar'); return; }
    if (j.fabrica) return aviso('Já está criando: espere terminar ou pare');
    const C = CONSTRUCOES[m.k] || FERRAMENTAS_FAZENDA[m.k]; if (!C) return;
    const n = FERRAMENTAS_FAZENDA[m.k] && !FERRAMENTAS_FAZENDA[m.k].varios ? 1 : Math.max(1, Math.min(CRIAR_OBRA.maxFila, m.n | 0 || 1)); // varios: o galão de combustível
    const motivo = this.motivoFabricar(j, m.k); if (motivo) return aviso(motivo);
    const dur = tempoCriar(C);
    j.fabrica = { k: m.k, n, feito: 0, dur, fim: this.tempo + dur };
    this.evento({ t: 'fabricando', para: id, k: m.k, n, feito: 0, dur });
  }
  pararFabrica(j, texto) {
    const f = j.fabrica; j.fabrica = null;
    if (texto) this.evento({ t: 'aviso', para: j.id, texto });
    // destruir/evoluir (catalisador): a barrinha termina com o resultado (msg) em vez de "Pronto: n criados"
    const msg = f && (f.des || f.ev) ? texto || (f.des ? 'Parou de destruir' : 'Parou de evoluir') : undefined;
    this.evento({ t: 'fabricando', para: j.id, k: f ? f.k : '', nome: f ? f.nome : undefined, fim: true, feito: f ? f.feito : 0, n: f ? f.n : 0, msg });
  }
  // a barrinha encheu: cria uma e começa a próxima (ou termina a fila)
  passoFabrica(j) {
    const f = j.fabrica;
    if (j.morto) return this.pararFabrica(j, '');
    if (f.des) return this.passoDestruir(j, f);
    if (f.ev) return this.passoEvoluir(j, f);
    if (f.pk) { const mot = this.fazerPackUm(j, f.npc); if (mot) return this.pararFabrica(j, mot); f.feito = 1; return this.pararFabrica(j, ''); } // pack do mercador (shared/transporte.js)
    const motivo = f.r ? this.motivoReceita(j, RECEITAS[f.r]).motivo : this.motivoFabricar(j, f.k); if (motivo) return this.pararFabrica(j, motivo);
    if (f.r) this.criarUm(j.id, { r: f.r }); else this.fabricarUm(j.id, f.k);
    f.feito++;
    if (f.feito >= f.n) return this.pararFabrica(j, f.n > 1 ? `Pronto: ${f.n} criados` : '');
    f.fim = this.tempo + f.dur;
    this.evento({ t: 'fabricando', para: j.id, k: f.k, r: f.r, nome: f.nome, n: f.n, feito: f.feito, dur: f.dur });
  }
  // ---------- catalisador: destruir peça e evoluir raridade (CATALISADOR em shared/dados.js, André 2026-11-07) ----------
  // usa a mesma fila/barrinha da criação (j.fabrica), então "Parar" vale e uma coisa de cada vez
  // Alquimista (André 2026-11-09): { acao: 'sintetizar', k: catalisador que sai, n: quantos (1 a CATALISADOR.sintese.lote) }.
  // Cada um gasta sintese.custo[r].n catalisadores da raridade de baixo (mesmo tipo) e sintese.custo[r].ouro.
  // Só até sintese.ate (Lendário): Mítico nunca. Faz quantos der até n (falta catalisador ou ouro = para antes).
  sintetizar(j, m, aviso) {
    const S = CATALISADOR.sintese, p = j.prog, k = typeof m.k === 'string' ? m.k : '', D = ITENS[k];
    const npc = (this.mapa.npcs || []).find((n) => n.id === S.npc);
    if (!npc || dist(npc, j) > S.perto) { aviso('Quem sintetiza catalisador é a alquimista da vila'); return false; }
    if (!D || !D.catalisador) return false;
    const r = D.cr, C = S.custo[r];
    if (r > S.ate || !C) { aviso(r >= 4 ? 'Catalisador Mítico nenhuma alquimia faz' : 'Esse catalisador não se sintetiza'); return false; }
    const de = CATALISADOR[D.catalisador][r - 2];
    const quer = Math.max(1, Math.min(S.lote, Number.isInteger(m.n) ? m.n : 1));
    const da = Math.min(quer, Math.floor(contar(p.mochila, de) / C.n), Math.floor((p.ouro || 0) / C.ouro));
    if (da < 1) {
      const falta = [];
      if (contar(p.mochila, de) < C.n) falta.push(`${C.n - contar(p.mochila, de)} ${ITENS[de].nome}`);
      if ((p.ouro || 0) < C.ouro) falta.push(`${C.ouro - (p.ouro || 0)} de ouro`);
      aviso('Falta ' + falta.join(' e ')); return false;
    }
    tirar(p.mochila, de, C.n * da);
    if (!guardar(p.mochila, { k, n: da })) { guardar(p.mochila, { k: de, n: C.n * da }); aviso('Mochila cheia'); return false; }
    p.ouro -= C.ouro * da;
    this.evento({ t: 'fala', para: j.id, npc: npc.id, texto: da > 1 ? `Pronto: ${da} ${D.nome}. O caldeirão até cansou.` : `Pronto, um ${D.nome} fresquinho. Cuidado que ainda está quente.` });
    aviso(`Recebeu ${da} ${D.nome} (−${C.ouro * da} de ouro)`);
    this.historia(j, 'sintetizar', { k });
    return true;
  }
  comecarCatalisador(j, m, i, it, aviso) {
    if (j.morto) return;
    if (j.fabrica) return aviso('Já está criando: espere terminar ou pare');
    if (m.acao === 'evoluir') {
      if (!it || !ehEquip(it.k)) return aviso('Escolha uma peça da mochila para evoluir');
      const R = this.receitaEvoluir(it); if (!R) return aviso('Peça Mítica já está no máximo');
      const motivo = this.motivoReceita(j, R).motivo; if (motivo) return aviso(motivo);
      const nome = nomeItem(it);
      j.fabrica = { ev: true, i, alvo: { k: it.k, r: it.r, e: it.e || 0 }, k: it.k, nome, n: 1, feito: 0, dur: CATALISADOR.tempoEvoluir, fim: this.tempo + CATALISADOR.tempoEvoluir };
      this.evento({ t: 'fabricando', para: j.id, k: it.k, nome, v: 'Evoluindo', n: 1, feito: 0, dur: CATALISADOR.tempoEvoluir });
      return;
    }
    let lista;
    if (Number.isInteger(m.raridade)) {
      const r = m.raridade; if (r < 0 || r >= RARIDADES.length) return;
      lista = [];
      j.prog.mochila.forEach((o, n) => { if (o && ehEquip(o.k) && o.r === r && !o.cad) lista.push({ i: n, k: o.k, r: o.r, e: o.e || 0 }); });
      if (!lista.length) return aviso(`Nenhuma peça ${RARIDADES[r].nome.toLowerCase()} sem cadeado na mochila`);
    } else {
      if (!it || !ehEquip(it.k)) return aviso('Escolha uma peça da mochila para destruir');
      if (it.cad) return aviso('Peça trancada. Abra o cadeado para destruir');
      lista = [{ i, k: it.k, r: it.r, e: it.e || 0 }];
    }
    const dur = CATALISADOR.tempoDestruir, nome = lista.length > 1 ? 'peças' : nomeItem(lista[0]);
    j.fabrica = { des: true, lista, k: lista[0].k, nome, n: lista.length, feito: 0, ganho: {}, dur, fim: this.tempo + dur };
    this.evento({ t: 'fabricando', para: j.id, k: lista[0].k, nome: nomeItem(lista[0]), v: 'Destruindo', n: lista.length, feito: 0, dur });
  }
  // receita de evoluir a peça (formato de RECEITAS, para usar motivoReceita: lugar, nível, material e vigor) ou null
  receitaEvoluir(it) {
    const r = it.r + 1; if (r >= RARIDADES.length) return null;
    const tipo = ehArma(it.k) ? 'arma' : 'armadura';
    const prof = RECEITAS[it.k]?.prof || (tipo === 'arma' ? 'fer' : 'alf');
    return { prof, faz: it.k, nivel: 1, vigor: CATALISADOR.vigor, usa: { [CATALISADOR[tipo][r - 1]]: 1, ...CATALISADOR.usa[tipo][r - 1] }, r };
  }
  // o que a peça destruída dá: [[item, quantidade]] (sorteado aqui; pode vir vazio)
  sortearDestruir(it) {
    const C = CATALISADOR, q = Math.random(), n = q < C.quantos[0] ? 0 : q < C.quantos[1] ? 1 : q < C.quantos[2] ? 2 : 3;
    if (it.r < 1) return n ? [[C.comum, n]] : [];
    const tipo = C[ehArma(it.k) ? 'arma' : 'armadura'], out = [];
    if (n) out.push([tipo[Math.max(1, it.r - 1) - 1], n]);
    if (it.r > 1 && Math.random() < (C.extra[it.r] || 0)) out.push([tipo[it.r - 1], 1]);
    return out;
  }
  // um passo da fila de destruir: acha a peça (ainda igual e sem cadeado), tira e dá o catalisador
  passoDestruir(j, f) {
    const p = j.prog, alvo = f.lista[f.feito];
    const it = p.mochila[alvo.i];
    const igual = it && it.k === alvo.k && it.r === alvo.r && (it.e || 0) === alvo.e && !it.cad;
    if (igual) {
      const ganho = this.sortearDestruir(it), prova = p.mochila.map((o) => (o ? { ...o } : null));
      prova[alvo.i] = null;
      if (!ganho.every(([k, n]) => guardar(prova, { k, n }))) return this.pararFabrica(j, 'Mochila cheia');
      p.mochila.splice(0, p.mochila.length, ...prova); // mesmo array (quem guarda a mochila não perde a referência)
      for (const [k, n] of ganho) f.ganho[k] = (f.ganho[k] || 0) + n;
      f.feitas = (f.feitas || 0) + 1;
      this.evento({ t: 'destruiu', para: j.id, nome: nomeItem(it), ganho: ganho.map(([k, n]) => ({ k, n, nome: ITENS[k].nome })) });
      this.historia(j, 'destruir', { k: it.k });
      this.avisarProg(j);
    }
    f.feito++;
    if (f.feito >= f.n) {
      const g = Object.entries(f.ganho).map(([k, n]) => `+${n} ${ITENS[k].nome}`).join(', ');
      const quantas = f.feitas || 0;
      return this.pararFabrica(j, quantas ? `Destruiu ${quantas} ${quantas === 1 ? 'peça' : 'peças'}: ${g || 'não sobrou nada'}` : 'Nada destruído: as peças mudaram de lugar');
    }
    f.fim = this.tempo + f.dur;
    const prox = f.lista[f.feito];
    this.evento({ t: 'fabricando', para: j.id, k: prox.k, nome: nomeItem(prox), v: 'Destruindo', n: f.n, feito: f.feito, dur: f.dur });
  }
  // a barrinha de evoluir encheu: confere de novo, gasta e sorteia (falha, sobe 1 ou, com sorte, sobe 2)
  passoEvoluir(j, f) {
    const p = j.prog, it = p.mochila[f.i];
    f.feito = 1;
    if (!it || it.k !== f.alvo.k || it.r !== f.alvo.r || (it.e || 0) !== f.alvo.e) return this.pararFabrica(j, 'A peça saiu do lugar na mochila');
    const R = this.receitaEvoluir(it); if (!R) return this.pararFabrica(j, '');
    const motivo = this.motivoReceita(j, R).motivo; if (motivo) return this.pararFabrica(j, motivo);
    const C = CATALISADOR, t = (profNivel(p.prof[R.prof]) - 1) / (PROF_MAX - 1);
    const falha = (C.falha[R.r] || 0) * (1 - 0.5 * t), sorte = R.r < RARIDADES.length - 1 ? C.sorte[0] + (C.sorte[1] - C.sorte[0]) * t : 0;
    const s = Math.random(), falhou = s < falha, pulou = !falhou && s < falha + sorte;
    const custo = R.vigor * (1 - profBonus(p.prof[R.prof]).menosVigor);
    gastarVigor(p, custo);
    for (const [k, n] of Object.entries(R.usa)) tirar(p.mochila, k, n);
    this.pontosProf(j, R.prof, R.vigor);
    let texto;
    if (falhou) texto = `Falhou! O catalisador e o material quebraram. ${nomeItem(it)} continua igual`;
    else {
      const novo = { k: it.k, r: pulou ? R.r + 1 : R.r };
      if (it.cad) novo.cad = 1;
      p.mochila[f.i] = novo;
      texto = pulou ? `Sorte! Pulou uma raridade: ${nomeItem(novo)}!` : `Evoluiu: ${nomeItem(novo)}!`;
    }
    this.evento({ t: 'evoluiu', para: j.id, ok: !falhou, sorte: pulou, nome: nomeItem(p.mochila[f.i] || it), r: (p.mochila[f.i] || it).r });
    if (!falhou) this.historia(j, 'evoluir', { k: it.k, v: p.mochila[f.i]?.r ?? 0 });
    this.avisarProg(j);
    this.pararFabrica(j, texto);
  }
  // por que não dá para criar agora ('' = dá)
  motivoFabricar(j, k) {
    const C = CONSTRUCOES[k] || FERRAMENTAS_FAZENDA[k]; if (!C) return 'Isso não se cria';
    const item = CONSTRUCOES[k] ? 'obra_' + k : k, p = j.prog;
    if (FERRAMENTAS_FAZENDA[k] && !C.varios && contar(p.mochila, item) > 0) return `Você já tem ${ITENS[item].nome.toLowerCase()}`;
    if (FERRAMENTAS_FAZENDA[k] && !C.varios && (k === 'carrinho' && p.carrinho?.chao || k === 'navio' && p.navio?.chao || j.veiculo === k)) return `Você já tem ${ITENS[item].nome.toLowerCase()}`; // o dele está no mundo
    if (C.nivel && p.nivel < C.nivel) return `Precisa Nv ${C.nivel} pra fazer ${ITENS[item].nome.toLowerCase()}`;
    { const lib = (k === 'fornalha' && motivoLibera(p, 'forja')) || motivoLibera(p, 'obra', k); if (lib) return `${ITENS[item].nome}: ${lib.toLowerCase()}`; } // progressão (André 2026-11-10)
    if (C.ouro && (p.ouro || 0) < C.ouro) return `Precisa de ${C.ouro.toLocaleString('pt-BR')} de ouro pra fazer ${ITENS[item].nome.toLowerCase()}`;
    if (C.bancada && !this.bancadaPerto(j)) return `${ITENS[item].nome}: crie perto de uma bancada de trabalho`;
    for (const [c, n] of Object.entries(C.custo)) if (contar(p.mochila, c) < n) return `Falta ${ITENS[c].nome} (${contar(p.mochila, c)}/${n})`;
    const prova = p.mochila.map((o) => (o ? { ...o } : null));
    for (const [c, n] of Object.entries(C.custo)) tirar(prova, c, n);
    if (!guardar(prova, { k: item, n: 1 })) return 'Mochila cheia';
    return '';
  }
  // cria uma (gasta o material e põe na mochila), sem esperar
  fabricarUm(id, k) {
    const j = this.jogadores.get(id); if (!j || j.criando || j.morto) return;
    const m = { k };
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    const C = CONSTRUCOES[m.k] || FERRAMENTAS_FAZENDA[m.k]; if (!C) return;
    const item = CONSTRUCOES[m.k] ? 'obra_' + m.k : m.k, p = j.prog;
    { const mot = this.motivoFabricar(j, m.k); if (mot) return aviso(mot); } // carrinho/navio: um só; navio: Nv 60 e 40.000 de ouro
    for (const [k, n] of Object.entries(C.custo)) if (contar(p.mochila, k) < n) return aviso(`Falta ${ITENS[k].nome} (${contar(p.mochila, k)}/${n})`);
    const prova = p.mochila.map((o) => (o ? { ...o } : null));
    for (const [k, n] of Object.entries(C.custo)) tirar(prova, k, n);
    if (!guardar(prova, { k: item, n: 1 })) return aviso('Mochila cheia');
    p.mochila = prova;
    if (C.ouro) p.ouro -= C.ouro; // navio mercante: 40.000 de ouro (Quimera)
    if (m.k === 'carrinho') p.carrinho = carrinhoNovo(); // carrinho novo: Nv 1, tanque vazio
    if (m.k === 'navio') p.navio = { porao: [], chao: null };
    this.evento({ t: 'fabricou', para: id, k: m.k, nome: ITENS[item].nome });
    aviso(`Criou ${ITENS[item].nome}!`);
    this.historia(j, 'criar', { k: m.k });
    this.avisarProg(j);
  }
  // Baú (como no Quimera: todos os baús do dono guardam as mesmas coisas). m = { acao: 'abrir' | 'guardar' | 'tirar' | 'organizar', i }
  // guardar: a pilha do lugar i da mochila vai inteira para o baú; tirar: a pilha do lugar i do baú volta para a mochila
  bau(id, m) {
    const j = this.jogadores.get(id); if (!j || !m || j.morto || j.criando) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    const L = this.loteDe(j); if (!L) return;
    if (!L.pecas.some((o) => o.k === 'bau' && dist(o, j) <= LOTE.estacaoDist + 0.6 && semParede(this.lotes.values(), j, o))) return aviso('Chegue perto do seu baú');
    if (!Array.isArray(L.bau)) L.bau = Array(bauLugares(L.bauNv)).fill(null);
    const p = j.prog, i = m.i | 0;
    if (m.acao === 'guardar') {
      const o = p.mochila[i]; if (!o) return;
      // o.h do Tomo é a habilidade dele, não lugar rápido (André 2026-11-07: Tomo não entrava no baú)
      if (o.h && o.k !== 'tomo') return aviso('Tire o item do lugar rápido antes de guardar');
      const bau = L.bau.map((q) => (q ? { ...q } : null));
      if (!guardar(bau, { ...o })) return aviso('O baú está cheio');
      L.bau = bau; p.mochila[i] = null;
    } else if (m.acao === 'tirar') {
      const o = L.bau[i]; if (!o) return;
      const prova = p.mochila.map((q) => (q ? { ...q } : null));
      if (!guardar(prova, { ...o })) return aviso('Mochila cheia');
      p.mochila = prova; L.bau[i] = null;
    } else if (m.acao === 'organizar') { // botão Organizar do baú (André 2026-11-07), igual ao da mochila
      L.bau = organizar(L.bau);
    } else if (m.acao === 'melhorar') { // André 2026-11-07: 40 → 60 → 80 lugares, os itens ficam dentro
      const nv = (L.bauNv | 0) + 1, custo = BAU.melhorar[nv];
      if (!custo) return aviso('O baú já está no tamanho máximo');
      const falta = Object.entries(custo).filter(([k, n]) => (k === 'ouro' ? p.ouro : contar(p.mochila, k)) < n).map(([k, n]) => `${n} ${k === 'ouro' ? 'de ouro' : nomeItem({ k })}`);
      if (falta.length) return aviso(`Para melhorar o baú falta: ${falta.join(', ')}`);
      for (const [k, n] of Object.entries(custo)) if (k === 'ouro') p.ouro -= n; else tirar(p.mochila, k, n);
      L.bauNv = nv;
      L.bau = [...L.bau, ...Array(Math.max(0, bauLugares(nv) - L.bau.length)).fill(null)];
      aviso(`Baú melhorado: agora tem ${L.bau.length} lugares`);
    } else if (m.acao !== 'abrir') return;
    this.lotesMudados.add(L.def.id);
    const prox = BAU.melhorar[(L.bauNv | 0) + 1] || null; // o que custa o próximo tamanho (null = já é o maior)
    this.evento({ t: 'bau', para: id, itens: L.bau, abrir: m.acao === 'abrir', slots: L.bau.length, prox, proxSlots: prox ? bauLugares((L.bauNv | 0) + 1) : 0 });
    if (m.acao !== 'abrir') this.avisarProg(j);
  }
  // Dormir na cama do meu terreno (igual ao Quimera, André 2026-11-07): só à noite no relógio da conta (19h às 5h) e sem
  // monstro a menos de CAMA.perigo m. Pula para as 6h30 (só para quem dormiu: o relógio é da conta) com vida, mana e
  // estamina cheias; o vigor ganha CAMA.vigor uma vez a cada CAMA.cada s. A cama já é onde você renasce.
  // encher o regador (André 2026-11-07): perto do poço da praça ou na beira de um lago (o botão "Encher" do Godot)
  encherRegador(id) {
    const j = this.jogadores.get(id); if (!j || j.morto) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if (contar(j.prog.mochila, 'regador') < 1) return aviso('Você não tem regador');
    if (aguaRegador(j.prog) >= HORTA.agua) return aviso('O regador já está cheio');
    if (!pertoDeAgua(j.x, j.z)) return aviso('Chegue no poço da vila ou na beira de um lago');
    this.encher(j, 'Regador cheio');
  }
  encher(j, texto) {
    j.prog.agua = HORTA.agua;
    this.evento({ t: 'regador', para: j.id, agua: HORTA.agua, texto: `${texto}: dá ${HORTA.agua} regas` });
    this.avisarProg(j);
  }
  dormir(id) {
    const j = this.jogadores.get(id); if (!j || j.morto || j.criando) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    const L = this.loteDe(j); if (!L) return aviso('Você ainda não tem cama');
    if (!L.pecas.some((o) => o.k === 'cama' && dist(o, j) <= LOTE.estacaoDist + 0.6 && semParede(this.lotes.values(), j, o))) return aviso('Chegue perto da sua cama');
    const agora = Date.now(), p = j.prog;
    const h = horaDoJogo(p.dia, agora), hh = `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.floor((h % 1) * 6) * 10).padStart(2, '0')}`;
    if (!ehNoite(h)) return aviso(`Só dá para dormir à noite (das ${DIA.noite}h às ${DIA.manha}h). Agora são ${hh}`);
    if (this.emCombate(j) || this.inimigos.some((e) => !e.morto && !e.treino && dist(e, j) < CAMA.perigo)) return aviso('Tem monstros por perto!');
    if (j.coleta) this.pararColeta(j);
    if (j.canal) this.cancelarCanal(j);
    this.cancelarVila(j, null);
    j.montado = null;
    p.dia = { h: DIA.acorda, t: agora };
    j.vida = j.vidaMax; j.mana = j.manaMax; j.sta = j.staMax; j.semFolego = false;
    let vigor = 0;
    const espera = camaVigorEm(p, agora);
    if (espera <= 0) { vigor = ganharVigor(p, CAMA.vigor, agora); p.camaT = agora; }
    this.evento({ t: 'dormiu', para: id, vigor: Math.round(vigor), espera: Math.ceil(espera) });
    this.historia(j, 'dormir'); // história: dormir uma noite na cama
    this.avisarProg(j);
  }
  // Fornalha ou fogão do meu terreno (2026-11-07). m = { acao: 'abrir' | 'por' | 'tirar', p: id da peça, lugar: 'comb' | 'ent' | 'sai', i }
  // por: a pilha do lugar i da mochila vai para o lugar (junta se for o mesmo item); tirar: o lugar volta para a mochila
  // fogão (André 2026-11-07, "que nem a fornalha"): no 'ent' vai o prato: m.r = prato, m.n = quantos; os ingredientes
  // saem da mochila para a panela e voltam se você tirar o que não cozinhou
  forno(id, m) {
    const j = this.jogadores.get(id); if (!j || !m || j.morto || j.criando) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    if ((this.mapa.estacoes || []).some((E) => E.k === 'fornalha' && E.id === String(m.p))) return this.fornoPublico(j, m);
    const L = this.loteDe(j); if (!L) return aviso('Só dá para usar a fornalha e o fogão do seu terreno');
    const peca = L.pecas.find((o) => (o.k === 'fornalha' || o.k === 'fogao') && o.id === String(m.p));
    const fogao = !!peca && peca.k === 'fogao', C = fogao ? FOGAO : FORNALHA;
    if (!peca || dist(peca, j) > LOTE.estacaoDist + 0.6 || !semParede(this.lotes.values(), j, peca)) return aviso(peca && fogao ? 'Chegue perto do seu fogão' : 'Chegue perto da sua fornalha');
    if (!L.fornos) L.fornos = {};
    const F = L.fornos[peca.id] || (L.fornos[peca.id] = fornoVazio());
    if (avancarForno(F, Date.now(), C)) this.lotesMudados.add(L.def.id);
    if (!this.mexerForno(j, F, C, fogao, m)) return;
    if (m.acao !== 'abrir') this.lotesMudados.add(L.def.id);
    this.evento({ t: 'forno', para: id, p: peca.id, tipo: peca.k, abrir: m.acao === 'abrir', ...this.dadosForno(F, C) });
    if (m.acao !== 'abrir') { this.aplicarStatus(j); this.avisarProg(j); }
  }
  // forninho público da ferraria (André 2026-11-11): a mesma fornalha, mas cada jogador tem a sua carga (prog.fornosPub)
  fornoPublico(j, m) {
    const E = this.mapa.estacoes.find((o) => o.id === String(m.p)), p = j.prog;
    if (dist(E, j) > LOTE.estacaoDist + 0.6) return this.evento({ t: 'aviso', para: j.id, texto: `Chegue perto do ${E.nome.toLowerCase()}` });
    if (!p.fornosPub || typeof p.fornosPub !== 'object') p.fornosPub = {};
    const F = p.fornosPub[E.id] = fornoValido(p.fornosPub[E.id]);
    avancarForno(F, Date.now(), FORNALHA);
    if (!this.mexerForno(j, F, FORNALHA, false, m)) return;
    this.evento({ t: 'forno', para: j.id, p: E.id, tipo: 'fornalha', abrir: m.acao === 'abrir', ...this.dadosForno(F, FORNALHA) });
    if (m.acao !== 'abrir') { this.aplicarStatus(j); this.avisarProg(j); }
  }
  // pôr ou tirar da fornalha ou do fogão F (o do terreno ou o público); false = não mexeu (o aviso já foi)
  mexerForno(j, F, C, fogao, m) {
    const aviso = (texto) => this.evento({ t: 'aviso', para: j.id, texto });
    const p = j.prog, lugar = m.lugar;
    if (m.acao === 'por' && fogao && lugar === 'ent') {
      const R = C.receitas[m.r]; if (!R) return aviso('Esse prato não se faz no fogão');
      if (profNivel(p.prof.coz) < R.nivel) return aviso(`Precisa de Cozinheiro Nv ${R.nivel}`);
      const atual = F.ent;
      if (atual && atual.k !== R.faz) return aviso('Tire o prato que já está na panela antes');
      const cabe = (ITENS[R.faz].pilha || 20) - (atual ? atual.n : 0);
      if (cabe <= 0) return aviso('A panela já está cheia');
      let n = Math.min(cabe, Math.max(1, m.n | 0));
      for (const [k, q] of Object.entries(R.ing)) n = Math.min(n, Math.floor(contar(p.mochila, k) / q));
      if (n <= 0) { const [k, q] = Object.entries(R.ing).find(([k, q]) => contar(p.mochila, k) < q); return aviso(`Falta ${ITENS[k].nome} (${contar(p.mochila, k)}/${q})`); }
      for (const [k, q] of Object.entries(R.ing)) tirar(p.mochila, k, q * n);
      F.ent = { k: R.faz, n: (atual ? atual.n : 0) + n };
      if (!atual) F.prog = 0;
      aviso(`${n}x ${ITENS[R.faz].nome} na panela`);
    } else if (m.acao === 'por') {
      if (lugar !== 'comb' && lugar !== 'ent') return;
      const o = p.mochila[m.i | 0]; if (!o) return;
      if (o.h) return aviso('Tire o item do lugar rápido antes');
      if (lugar === 'comb' && !C.combustivel[o.k]) return aviso('Combustível é lenha ou carvão');
      const R = lugar === 'ent' ? C.receitas[o.k] : null;
      if (lugar === 'ent' && !R) return aviso('A fornalha derrete minério de ferro ou de cobre, queima lenha em carvão e faz aço da barra de ferro');
      if (R && profNivel(p.prof.fer) < R.nivel) return aviso(`Precisa de Ferreiro Nv ${R.nivel}`);
      const atual = F[lugar];
      if (atual && atual.k !== o.k) return aviso('Tire o que já está lá antes');
      const max = ITENS[o.k].pilha || 50, cabe = max - (atual ? atual.n : 0), n = Math.min(cabe, o.n | 0 || 1);
      if (n <= 0) return aviso('Esse lugar já está cheio');
      F[lugar] = { k: o.k, n: (atual ? atual.n : 0) + n };
      if ((o.n | 0) > n) o.n -= n; else p.mochila[m.i | 0] = null; // o que não coube fica na mochila
      if (lugar === 'ent' && !atual) F.prog = 0;
    } else if (m.acao === 'tirar') {
      if (!['comb', 'ent', 'sai'].includes(lugar)) return;
      const o = F[lugar]; if (!o) return;
      const prova = p.mochila.map((q) => (q ? { ...q } : null));
      if (fogao && lugar === 'ent') { // o que não cozinhou volta como ingredientes
        const R = C.receitas[o.k];
        if (R) { for (const [k, q] of Object.entries(R.ing)) if (!guardar(prova, { k, n: q * o.n })) return aviso('Mochila cheia'); }
      } else if (!guardar(prova, { ...o })) return aviso('Mochila cheia');
      p.mochila = prova; F[lugar] = null;
      if (lugar === 'ent') F.prog = 0;
      if (lugar === 'sai') { // pontos da profissão e XP pelo que saiu (como criar na forja ou no fogão)
        const R = Object.values(C.receitas).find((r) => r.faz === o.k);
        if (R) { this.pontosProf(j, fogao ? 'coz' : 'fer', R.vigor * o.n); this.ganharXP(j, Math.max(1, Math.round(R.vigor * o.n))); }
        aviso(`Pegou ${ITENS[o.k].nome} x${o.n}`);
        this.historia(j, 'criar', { k: o.k, n: o.n });
      }
    } else if (m.acao !== 'abrir') return false;
    if (m.acao !== 'abrir') avancarForno(F, Date.now(), C);
    return true;
  }
  // o que o celular mostra (dur e fogoMax para as barrinhas andarem sozinhas até a próxima conta)
  dadosForno(F, C = FORNALHA) {
    const R = receitaForno(F, C), anda = fornoPodeSeguir(F, R) && (F.fogo > 0 || (F.comb && (!R.fogo || F.comb.k === R.fogo)));
    const c = (o) => (o ? { k: o.k, n: o.n } : null);
    return { comb: c(F.comb), ent: c(F.ent), sai: c(F.sai), fogo: r2(F.fogo), fogoK: F.fogoK, fogoMax: C.combustivel[F.fogoK] || 0,
      prog: r2(F.prog), dur: R ? R.dur : 0, faz: R ? R.faz : '', anda: !!anda, precisa: R && R.fogo && (!F.comb || F.comb.k !== R.fogo) && !(F.fogo > 0 && F.fogoK === R.fogo) ? R.fogo : '' };
  }
  // m = { acao: 'arar' | 'plantar' | 'regar' | 'colher' | 'tirar', c: 'i,j' (quadrado de 1 m), s: planta (no plantar) }
  horta(id, m) {
    const j = this.jogadores.get(id); if (!j || !m || typeof m.c !== 'string' || !/^-?\d{1,4},-?\d{1,4}$/.test(m.c)) return;
    const aviso = (texto) => this.evento({ t: 'aviso', para: id, texto });
    const [ci, cj] = m.c.split(',').map(Number);
    const L = this.loteParaMexer(j, ci + 0.5, cj + 0.5, aviso); if (!L) return;
    const p = j.prog, agora = Date.now(), t = L.horta[m.c];
    const vigor = () => {
      const custo = HORTA.vigor * (1 - profBonus(p.prof.faz).menosVigor);
      if (!gastarVigor(p, custo)) { aviso('Sem vigor: ele volta sozinho com o tempo (cheio a cada 6 h)'); return false; }
      this.pontosProf(j, 'faz', HORTA.vigor);
      return true;
    };
    if (t) crescerPlanta(t, agora);
    if ((m.acao === 'arar' || m.acao === 'plantar') && this.loteTravado(L, aviso)) return;
    if (m.acao === 'arar') {
      if (t) return aviso('Essa terra já está arada');
      if (contar(p.mochila, 'enxada') < 1) return aviso('Precisa de enxada (crie no modo construção, aba Fazenda)');
      const motivo = motivoHorta(L, ci, cj, j); if (motivo) return aviso(motivo);
      if (!vigor()) return;
      L.horta[m.c] = { c: '', g: 0, w: 0, u: agora };
    } else if (m.acao === 'plantar') {
      const P = PLANTAS[m.s]; if (!P) return;
      if (!t) return aviso('Precisa arar a terra primeiro');
      if (t.c) return aviso('Já tem planta aqui');
      if (contar(p.mochila, 'semente_' + m.s) < 1) return aviso(`Você não tem semente de ${P.nome.toLowerCase()} (a Rosa vende)`);
      if (!vigor()) return;
      tirar(p.mochila, 'semente_' + m.s, 1);
      Object.assign(t, { c: m.s, g: 0, u: agora });
      this.historia(j, 'plantar', { k: m.s });
    } else if (m.acao === 'regar') {
      if (!t) return aviso('Precisa arar a terra primeiro');
      if (contar(p.mochila, 'regador') < 1) return aviso('Precisa de regador (crie perto de uma bancada, aba Fazenda)');
      if (t.w && agora < t.w + HORTA.rega * 3600000) return aviso('A terra ainda está molhada');
      if (aguaRegador(p) <= 0) return aviso('Regador sem água: encha no poço da vila ou na beira de um lago');
      if (!vigor()) return;
      t.w = agora; t.u = agora;
      p.agua = aguaRegador(p) - 1;
      if (p.agua === 0) aviso('O regador secou: encha no poço da vila ou na beira de um lago');
      this.historia(j, 'regar');
    } else if (m.acao === 'colher') {
      if (!t || !t.c) return aviso('Não tem nada plantado aqui');
      const P = PLANTAS[t.c];
      if (fasePlanta(t.g / P.G) < 4) return aviso(`${P.nome} ainda não está madura` + (t.w && agora < t.w + HORTA.rega * 3600000 ? '' : ' (precisa de água!)'));
      const n = P.y[0] + Math.floor(Math.random() * (P.y[1] - P.y[0] + 1)) + (Math.random() < profBonus(p.prof.faz).extra ? 1 : 0);
      if (!guardar(p.mochila, { k: t.c, n })) return aviso('Mochila cheia');
      if (!vigor()) { tirar(p.mochila, t.c, n); return; }
      this.pontosProf(j, 'faz', P.semente / 2);
      this.evento({ t: 'colheu', para: id, c: m.c, nome: P.nome, n });
      if (p.nivel < NIVEL_MAX) this.ganharXP(j, 1);
      this.historia(j, 'colher', { k: t.c });
      Object.assign(t, { c: '', g: 0, u: agora });
    } else if (m.acao === 'tirar') {
      if (!t) return;
      if (t.c) return aviso('Colha a planta antes de desfazer a terra');
      delete L.horta[m.c];
    } else return;
    this.avisarLote(L);
    this.avisarProg(j);
  }
  // Monstro caiu: cada herói que ganhou XP tira a sua sorte (ouro, poções, peça, Tomo de uma skill que ele já tem)
  soltarDrops(c, j) {
    if (c.bm) return this.dropBoss(c, j); // boss de mundo: catalisador garantido e a chance do Mítico
    const d = DROPS[c.tipo]; if (!d) return;
    const p = j.prog, ganhou = [];
    // filtro de coleta (André 2026-11-07): o que ele desmarcou na mochila fica no chão
    const por = (it) => { if (filtrado(p, it)) return; if (guardar(p.mochila, it)) ganhou.push({ nome: nomeItem(it), r: it.r ?? -1 }); else this.evento({ t: 'aviso', para: j.id, texto: `Mochila cheia! ${nomeItem(it)} ficou no chão` }); };
    const ouro = Math.round((d.ouro[0] + Math.floor(Math.random() * (d.ouro[1] - d.ouro[0] + 1))) * (1 + NIVEL_INIMIGO.ouro * Math.max(0, (c.nivel || 1) - 1)));
    p.ouro += ouro;
    if (Math.random() < d.pocao) por({ k: 'pocao', n: 1 });
    if (Math.random() < d.mana) por({ k: 'pocao_mana', n: 1 });
    for (const [k, [ch, n]] of Object.entries(d.mat || {})) if (Math.random() < ch) por({ k, n });
    if (Math.random() < d.equip) {
      let s = Math.random(), r = 0;
      while (r < d.raridade.length - 1 && s >= d.raridade[r]) s -= d.raridade[r++];
      const pecas = Object.keys(ITENS).filter(ehEquip);
      por({ k: pecas[Math.floor(Math.random() * pecas.length)], r });
    }
    if (Math.random() < d.tomo) { // Tomo de um nível que a skill ainda vai precisar (do VI ao X)
      // André 2026-11-07: antes caía só o próximo nível, então quem estava no Nv 5 só via Tomo VI.
      // Agora metade das vezes cai o próximo que a skill precisa e na outra metade um dos seguintes (até o X)
      const sk = Object.keys(HABS).filter((k) => HABS[k].tomo && HABS[k].libera <= p.nivel && (p.habs[k]?.nv || 1) < SKILL_MAX);
      if (sk.length) {
        const h = sk[Math.floor(Math.random() * sk.length)], de = Math.max(NIVEL_SEM_TOMO + 1, (p.habs[h]?.nv || 1) + 1);
        const nv = de < SKILL_MAX && Math.random() >= 0.5 ? de + 1 + Math.floor(Math.random() * (SKILL_MAX - de)) : de;
        por({ k: 'tomo', h, nv, n: 1 });
      }
    }
    this.evento({ t: 'drop', para: j.id, x: r2(c.x), z: r2(c.z), ouro, itens: ganhou });
    this.avisarProg(j);
  }

  // No chão pula; no ar, o segundo pulo é um mortal para a frente
  // Botão Falar: o NPC mais perto responde conforme a função dele (cura, missão, habilidades, dica, loja)
  // m (opcional, menu do NPC no app): { npc: id de quem tocou, conversa: true = só a próxima fala, sem a função }
  falar(id, m) {
    const j = this.jogadores.get(id); if (!j || j.morto || j.criando) return;
    let npc = null, md = 3.2;
    // NPC que só aparece depois de uma missão (o Kael em Aurora) ou some depois dela (a Elara muda para o Paço: ate)
    const ve = (n) => (!n.depois || npcApareceu(j.prog, n.depois)) && (!n.ate || !npcApareceu(j.prog, n.ate));
    for (const n of this.mapa.npcs || []) { const d = dist(n, j); if (d < md && ve(n)) { md = d; npc = n; } }
    const quem = m && typeof m === 'object' && typeof m.npc === 'string' ? (this.mapa.npcs || []).find((n) => n.id === m.npc) : null;
    // Botão da janela do NPC (o app diz quem): vale até FALAR_JANELA m. O app abre a janela a até 4 m (o Ir da missão,
    // missao_ativa.gd PERTO_NPC) e só fecha a 4,5 m; antes o servidor só ouvia a 3,2 m e o toque em "Missão" não fazia
    // nada, ou caía em outro NPC mais perto (robô das missões, André 2026-11-12: "às vezes tem que clicar 3 vezes").
    if (quem) {
      if (!ve(quem)) return;
      if (dist(quem, j) >= FALAR_JANELA) return void this.evento({ t: 'aviso', para: j.id, texto: `Chegue mais perto de ${quem.nome.split(',')[0]}` });
      npc = quem;
    }
    if (!npc) return;
    const diga = (texto, extra = {}) => this.evento({ t: 'fala', para: j.id, npc: npc.id, texto, ...extra });
    const proxima = () => npc.falas[(j.falas[npc.id] = (j.falas[npc.id] ?? -1) + 1) % npc.falas.length];
    if (m?.conversa) return diga(proxima());
    if (this.falaHistoria(j, npc, diga, m?.missao === true)) return; // missão principal primeiro (André 2026-11-10; m.missao: tocou em "Missão")
    if (npc.funcao === 'cura') {
      if (j.vida >= j.vidaMax && j.mana >= j.manaMax) return diga('Você está inteiro. Volte quando precisar.');
      const n = j.vidaMax - j.vida; j.vida = j.vidaMax; j.mana = j.manaMax;
      if (n > 0) this.evento({ t: 'cura', alvo: j.id, n });
      return diga('Pronto, novinho em folha. Vá com cuidado lá fora.');
    }
    if (npc.funcao === 'missao') {
      const M = MISSOES[npc.missao], m = j.missoes[npc.missao];
      if (!m) { j.missoes[npc.missao] = { n: 0, entregue: false }; this.evento({ t: 'aviso', para: j.id, texto: 'Missão nova: ' + M.nome }); return diga(M.pedido); }
      if (m.entregue) return diga(M.depois);
      if (m.n >= M.total) { m.entregue = true; this.evento({ t: 'aviso', para: j.id, texto: 'Missão cumprida: ' + M.nome }); return diga(M.pronto); }
      return diga(M.andamento.replace('{faltam}', M.total - m.n));
    }
    if (npc.funcao === 'habilidades') return diga(npc.falas[0], { abrir: 'habilidades' });
    if (npc.funcao === 'passe') { // Gaspar: o app abre a janela dele com o botão de fazer o passe
      const D = this.dungeon?.def, rec = D ? Object.entries(D.passe).map(([k, n]) => `${n} ${ITENS[k].nome}`).join(', ') : '';
      return diga(`Um passe sai por ${rec}. Tem o material? Eu faço na hora.`, { abrir: 'passe' });
    }
    if (npc.funcao === 'alquimia') return diga('Traga catalisadores fracos e ouro, que eu faço um mais forte. Até o Lendário.', { abrir: 'alquimia' });
    if (npc.funcao === 'loja') return diga('Dá uma olhada no que eu tenho. E se quiser vender algo, eu compro.', { abrir: 'loja' });
    if (npc.funcao === 'resetar') return diga(npc.falas[0] + ` Custa ${this.custoReset(j)} de ouro.`, { abrir: 'resetar', custo: this.custoReset(j) });
    if (npc.funcao === 'leilao') { diga(npc.falas[0], { abrir: 'leilao' }); return this.leilaoMsg(id, { acao: 'ver' }); } // Otávio: a Casa do Comércio
    diga(proxima());
  }
  // Inimigo caiu: conta para quem está numa missão contra a horda dele (vale para todos do grupo)
  contarMissao(c) {
    const horda = TIPOS_INIMIGO[c.tipo]?.horda;
    for (const j of this.jogadores.values()) for (const [k, m] of Object.entries(j.missoes)) {
      const M = MISSOES[k]; if (M.horda !== horda || m.entregue || m.n >= M.total) continue;
      m.n++;
      this.evento({ t: 'aviso', para: j.id, texto: m.n >= M.total ? `${M.horda}: ${m.n}/${M.total}. Volte à vila!` : `${M.horda}: ${m.n}/${M.total}` });
    }
  }
  pular(id) {
    const j = this.jogadores.get(id);
    if (j?.coleta) this.pararColeta(j);
    if (j?.pesca) this.pararPesca(j, 'Você recolheu a linha');
    if (j?.canal) this.cancelarCanal(j);
    this.cancelarVila(j);
    if (j?.esc) { if (!j.esc.clip) this.soltar(j); return; } // na parede: solta
    if (!j || j.morto || j.criando || j.trava > 0 || j.arrancada) return;
    if (j.chao) { j.vy = MOVIMENTO.pulo; j.chao = false; j.pulos = 1; j.puloT = 0; j.pouso = 0; }
    else if (j.pulos < 2 && this.gastarEstamina(j, ESTAMINA.mortal)) { j.vy = Math.max(j.vy, MOVIMENTO.pulo * 0.9); j.pulos = 2; j.mortal = DURACAO.mortal; }
  }
  // Rolamento no chão: nenhum golpe pega durante a maior parte dele
  rolar(id) {
    const j = this.jogadores.get(id);
    if (j?.coleta) this.pararColeta(j);
    if (j?.pesca) this.pararPesca(j, 'Você recolheu a linha');
    if (j?.canal) this.cancelarCanal(j);
    this.cancelarVila(j);
    if (!j || j.morto || j.criando || j.esc || j.trava > 0 || !j.chao || j.arrancada || (j.cds.rolar || 0) > this.tempo) return;
    if (!this.gastarEstamina(j, ESTAMINA.rolar)) return;
    j.cds.rolar = this.tempo + HEROI.rolarCd; j.montado = null;
    const { mx, mz } = j.entrada;
    if (Math.hypot(mx, mz) > 0.1) j.ry = Math.atan2(mx, mz);
    const d = this.tocar(j, A.roll, 1.25);
    this.empurrar(j, 4.2, d);
    j.defesa = 1;
    this.depois(d * 0.7, () => { j.defesa = 0; });
  }
  // Arrancada reta para onde o jogador aponta (no ar, uma por pulo). Nenhum golpe pega durante ela.
  dash(id) {
    const j = this.jogadores.get(id);
    if (j?.coleta) this.pararColeta(j);
    if (j?.pesca) this.pararPesca(j, 'Você recolheu a linha');
    if (j?.canal) this.cancelarCanal(j);
    this.cancelarVila(j);
    if (!j || j.morto || j.criando || j.esc || j.trava > 0 || j.arrancada || (j.cds.dash || 0) > this.tempo || (!j.chao && j.arrancadaNoAr)) return;
    if (!this.gastarEstamina(j, ESTAMINA.dash)) return;
    j.cds.dash = this.tempo + MOVIMENTO.dashCd; j.montado = null;
    const { mx, mz } = j.entrada;
    if (Math.hypot(mx, mz) > 0.1) j.ry = Math.atan2(mx, mz);
    if (j.chao && this.correrNaParede(j)) return; // dash contra a rocha: corre pela parede
    j.arrancada = { t: MOVIMENTO.dashTempo, dx: Math.sin(j.ry), dz: Math.cos(j.ry) };
    j.mortal = 0; j.pouso = 0;
    if (!j.chao) { j.vy = Math.max(0, j.vy); j.arrancadaNoAr = true; }
    this.evento({ t: 'dash', id: j.id, de: j.id });
  }

  // ---------- combate ----------
  efeitoHabilidade(j, h) {
    if (j.morto) return;
    if (h.proj?.leque) { // vários tiros abertos em leque, o do meio no alvo
      const alvo = this.maisPerto(j); if (alvo) this.virarPara(j, alvo);
      const n = h.proj.leque;
      for (let k = 0; k < n; k++) this.lancar(j, h, null, (k - (n - 1) / 2) * 0.28);
    } else if (h.proj) this.lancar(j, h, this.maisPerto(j));
    else if (h.linha) { // trilha de explosões saindo da espada para a frente
      const L = h.linha, ry = j.ry, x0 = j.x, z0 = j.z, atingidos = new Set();
      this.evento({ t: 'fenda', x: r2(x0), z: r2(z0), ry: r2(ry), comp: L.comp, passos: L.passos, larg: L.larg });
      for (let k = 0; k < L.passos; k++) this.depois(k * 0.07, () => {
        const d = 1.2 + (L.comp - 1.2) * k / (L.passos - 1), p = { x: x0 + Math.sin(ry) * d, z: z0 + Math.cos(ry) * d };
        for (const o of this.inimigosDe(j)) if (!atingidos.has(o) && dist(o, p) < L.larg) { atingidos.add(o); this.ferir(o, L.dmg, j); }
      });
    } else if (h.raios) { // raios do céu nos inimigos mais perto (ou à frente, se não houver)
      const alvos = this.inimigosDe(j).filter((o) => dist(o, j) < h.raios.alcance).sort((a, b) => dist(a, j) - dist(b, j)).slice(0, h.raios.n);
      if (!alvos.length) { const p = this.aFrente(j, 5); this.evento({ t: 'raio', x: r2(p.x), z: r2(p.z) }); }
      alvos.forEach((o, k) => this.depois(k * 0.12, () => { this.evento({ t: 'raio', x: r2(o.x), z: r2(o.z) }); this.ferir(o, h.raios.dmg, j, h); }));
    }
    else if (h.curaPct) { // Cura da Floresta: % da vida máxima; quem estiver perto recebe um pouco
      const n = Math.min(Math.round(j.vidaMax * h.curaPct), j.vidaMax - j.vida); j.vida += n;
      this.evento({ t: 'cura', alvo: j.id, n });
      if (h.grupo) for (const o of this.jogadores.values()) {
        if (o === j || o.morto || o.criando || dist(o, j) > h.grupo.r) continue;
        const m = Math.min(Math.round(o.vidaMax * h.grupo.pct), o.vidaMax - o.vida); o.vida += m;
        if (m > 0) this.evento({ t: 'cura', alvo: o.id, n: m });
      }
      this.evento({ t: 'anel', x: r2(j.x), z: r2(j.z), r: h.grupo?.r || 1.6, cor: 0x9be08f, dur: 0.9 });
    } else if (h.escudo) {
      j.escudo = { n: h.escudo.absorve, ate: this.tempo + h.escudo.dur };
      this.evento({ t: 'escudo', id: j.id, n: j.escudo.n, dur: h.escudo.dur });
    } else if (h.cura) {
      const n = Math.min(h.cura, j.vidaMax - j.vida); j.vida += n;
      this.evento({ t: 'cura', alvo: j.id, n });
      // André 2026-11-09: a cura passa para quem é do time e está perto, mais fraca (h.time da cura)
      if (h.time && j.time) for (const k of j.time.membros) {
        const o = this.jogadores.get(k); if (!o || o === j || o.morto || dist(o, j) > (h.timeR || 8)) continue;
        const q = Math.min(Math.round(h.cura * h.time), o.vidaMax - o.vida); o.vida += q;
        if (q > 0) this.evento({ t: 'cura', alvo: o.id, n: q });
      }
      this.evento({ t: 'anel', x: j.x, z: j.z, r: h.time && j.time ? (h.timeR || 8) : 1.6, cor: 0x9be08f, dur: 0.8 });
    } else if (h.campo) {
      const a = this.maisPerto(j, 16);
      const p = a ? { x: a.x, z: a.z } : this.aFrente(j, 5);
      this.campos.push({ ...p, ...h.campo, dono: j, vida: h.campo.dur, tique: 0 });
      this.evento({ t: 'campo', x: r2(p.x), z: r2(p.z), r: h.campo.r, dur: h.campo.dur });
    } else if (h.chuva) {
      const a = this.maisPerto(j, 22);
      const p = a ? { x: a.x, z: a.z } : this.aFrente(j, 8);
      this.evento({ t: 'chuva', x: r2(p.x), z: r2(p.z), r: h.chuva.r, ondas: h.chuva.ondas });
      for (let k = 0; k < h.chuva.ondas; k++) this.depois(0.25 + k * 0.22, () => {
        for (const o of this.inimigosDe(j)) if (dist(o, p) < h.chuva.r) this.ferir(o, h.chuva.dmg, j, h);
      });
    } else if (h.dmg) this.corpoACorpo(j, h);
  }
  corpoACorpo(c, h) {
    for (const o of this.inimigosDe(c)) {
      const d = dist(o, c);
      if (Math.abs((o.y || 0) - (c.y || 0)) > 1.6) continue; // em cima da pedra o golpe não alcança quem está embaixo
      const acerta = h.area ? d < h.area : d < h.alcance && Math.abs(angDif(Math.atan2(o.x - c.x, o.z - c.z), c.ry)) < h.arco / 2;
      if (!acerta) continue;
      this.ferir(o, h.dmg, c, h);
      if (h.impacto) this.evento({ t: 'impacto', x: r2(o.x), z: r2(o.z), ry: r2(c.ry), fx: h.chave });
      const emp = h.empurra || 1.2;
      if (h.area && d > 0 && !o.treino) { o.x += (o.x - c.x) / d * emp; o.z += (o.z - c.z) / d * emp; this.colidir(o); }
    }
    if (h.area && c.tipo === 'jogador') this.evento({ t: 'explosao', x: r2(c.x), z: r2(c.z), r: h.area, fx: h.chave });
  }
  // Vórtice: arrasta para perto quem estiver em volta; a explosão vem depois (efeitoHabilidade)
  puxar(j, h) {
    if (j.morto) return;
    this.evento({ t: 'vortice', x: r2(j.x), z: r2(j.z), r: h.puxa.r });
    for (const o of this.inimigosDe(j)) {
      const d = dist(o, j); if (d > h.puxa.r || d < 1.3) continue;
      const t = 0.45, m = d - 1.1; o.dash = { vx: (j.x - o.x) / d * m / t, vz: (j.z - o.z) / d * m / t, t };
    }
  }
  lancar(c, h, alvo, giro = 0) {
    const f = this.aFrente(c, 0.6);
    const de = { x: f.x, y: (c.y || 0) + (h.proj.estilo === 'corte' ? 1 : 1.35), z: f.z };
    let dx = Math.sin(c.ry + giro), dy = 0, dz = Math.cos(c.ry + giro);
    if (alvo) { dx = alvo.x - de.x; dy = (alvo.y || 0) + 1.1 - de.y; dz = alvo.z - de.z; const n = Math.hypot(dx, dy, dz) || 1; dx /= n; dy /= n; dz /= n; }
    const p = { id: this.proxId++, ...de, dx, dy, dz, h, dono: c, vida: h.proj.vida || 2.2, acertou: new Set() };
    this.projeteis.push(p);
    this.evento({ t: 'proj', id: p.id, x: r2(de.x), y: de.y, z: r2(de.z), dx: r2(dx), dy: r2(dy), dz: r2(dz), ...h.proj });
  }
  // h: a habilidade que acertou (skills do Quimera trazem crítico e efeitos: atordoa, congela, lento, vulnerável)
  ferir(alvo, n, de, h = null) {
    if (alvo.morto || alvo.arrancada || alvo.criando || alvo.voando) return; // voando: boss no ar (skill 'voo' ou 'sumir')
    if (alvo.tipo === 'jogador' && alvo.cenaAte > this.tempo) return; // vendo uma cena da história (cena())
    if (de?.tipo === 'jogador' && alvo.tipo !== 'jogador' && this.mobFechadoPara(alvo, de)) return; // monstro de região fechada: a névoa protege (André 2026-11-11)
    let crit = false;
    if (h?.q && de?.st) { n *= 0.85 + Math.random() * 0.3; if (Math.random() < de.st.critico) { n *= 2; crit = true; } } // como no Quimera: ±15% e crítico ×2
    if (alvo.vuln && alvo.vuln.ate > this.tempo) n *= 1 + alvo.vuln.k;
    // diferença de nível (Quimera): monstro x herói nos dois sentidos; o espantalho de treino fica de fora
    const nvM = de && de.tipo !== 'jogador' && alvo.tipo === 'jogador' && de.nivel ? de.nivel : 0;
    if (nvM) n *= danoMonstroNivel(nvM, alvo.prog?.nivel, NIVEL_INIMIGO);
    if (de?.tipo === 'jogador' && alvo.tipo !== 'jogador' && !alvo.treino && alvo.nivel) n *= golpeHeroiNivel(alvo.nivel, de.prog?.nivel, NIVEL_INIMIGO);
    if (alvo.st) n *= 1 - (nvM ? reducaoContra(alvo.st.defesa, nvM, NIVEL_INIMIGO) : alvo.st.reducao); // defesa do herói (contra monstro: cai com o nível dele)
    if (alvo.defesa > 0) n *= 1 - alvo.defesa;
    n = Math.max(1, Math.round(n));
    if (nvM) n = Math.max(1, Math.min(n, Math.round(alvo.vidaMax * tetoMonstroNivel(nvM, alvo.prog?.nivel, de.tipo === 'chefe' || !!TIPOS_INIMIGO[de.tipo]?.chefe || !!de.bm, NIVEL_INIMIGO))));
    if (alvo.escudo && alvo.escudo.ate > this.tempo) { // Escudo Arcano segura primeiro
      const seg = Math.min(alvo.escudo.n, n); alvo.escudo.n -= seg; n -= seg;
      if (alvo.escudo.n <= 0) { alvo.escudo = null; this.evento({ t: 'escudo', id: alvo.id, n: 0, dur: 0 }); }
      if (n <= 0) { this.evento({ t: 'dano', alvo: alvo.id, n: 0, escudo: true }); return; }
    }
    if (de?.tipo === 'jogador' && de.contraAte > this.tempo && alvo.tipo !== 'jogador') { // contra-ataque depois da esquiva
      n = Math.round(n * COMBATE_INIMIGO.contraK); crit = true; de.contraAte = 0;
    }
    if (alvo.treino) return this.ferirTreino(alvo, n, crit, de, h);
    if (alvo.tipo === 'jogador' && alvo.veiculo === 'carrinho') n = this.golpeNoCarrinho(alvo, n); // Quimera: o carrinho apanha por você
    alvo.vida = Math.max(0, alvo.vida - n);
    if (alvo.bot && de && de.tipo !== 'jogador') alvo.golpeDe = golpeDe(de); // NPC: quem bateu por último (aprender com a morte)
    if (alvo.hc && CHEFES_HISTORIA[alvo.hc]?.foge && alvo.vida <= alvo.vidaMax * CHEFES_HISTORIA[alvo.hc].foge) { // duelo que para no meio
      if (de?.tipo === 'jogador') (alvo.atacantes ||= new Set()).add(de.id);
      return this.fugirChefe(alvo);
    }
    if (alvo.tipo === 'jogador') { alvo.combateAte = this.tempo + ESTAMINA.combate; alvo.lutouT = this.tempo; if (alvo.coleta) this.pararColeta(alvo, 'Atacado! A coleta parou'); this.cancelarVila(alvo, 'Atacado! A volta para a vila parou'); }
    if (de?.tipo === 'jogador') { de.combateAte = this.tempo + ESTAMINA.combate; de.lutouT = this.tempo; } // lutouT: time só ganha XP de quem lutou nos últimos TIME.combate s
    this.evento(crit ? { t: 'dano', alvo: alvo.id, n, crit: true } : h?.dot ? { t: 'dano', alvo: alvo.id, n, dot: h.dot } : { t: 'dano', alvo: alvo.id, n });
    if (alvo.tipo !== 'jogador' && de?.tipo === 'jogador') (alvo.atacantes ||= new Set()).add(de.id);
    const ehChefe = alvo.tipo === 'chefe' || !!TIPOS_INIMIGO[alvo.tipo]?.chefe || !!alvo.bm; // fora do if: o golpe final também usa
    if (h && alvo.tipo !== 'jogador' && alvo.vida > 0) {
      const ate = (s) => this.tempo + s * (ehChefe ? 0.5 : 1); // chefe sofre metade
      if (h.atordoa) { alvo.parado = Math.max(alvo.parado || 0, ate(h.atordoa)); alvo.ef = 'atordoado'; }
      if (h.congela) { alvo.parado = Math.max(alvo.parado || 0, ate(h.congela)); alvo.ef = 'congelado'; }
      const meio = ehChefe ? 0.5 : 1; // no chefe lentidão e Quebrado valem metade
      if (h.lento) alvo.lento = { k: h.lento.k * meio, ate: this.tempo + h.lento.dur };
      if (h.vulneravel) alvo.vuln = { k: h.vulneravel.k * meio, ate: this.tempo + h.vulneravel.dur };
      if (h.atordoa || h.congela) { alvo.trava = 0; alvo.acao = null; }
    }
    let firme = false;
    if (alvo.tipo !== 'jogador' && alvo.vida > 0) { // resistência: muitos golpes seguidos e o monstro aguenta e revida
      const CI = COMBATE_INIMIGO;
      if (this.tempo - (alvo.golpeT || -9) > CI.firmeJanela) alvo.golpes = 0;
      alvo.golpeT = this.tempo; alvo.golpes = (alvo.golpes || 0) + 1;
      if (alvo.golpes >= (CI.firmeGolpes[alvo.tipo] ?? 6) && !(alvo.firmeAte > this.tempo) && !(alvo.parado > this.tempo)) {
        alvo.firmeAte = this.tempo + CI.firmeDur; alvo.golpes = 0; alvo.ataqueCd = Math.min(alvo.ataqueCd, 0.25);
        this.evento({ t: 'firme', id: alvo.id, dur: CI.firmeDur });
      }
      firme = alvo.firmeAte > this.tempo;
    }
    if (alvo.vida <= 0) {
      this.morrer(alvo);
      if (alvo.tipo !== 'jogador' && de && !ehChefe) { // o golpe final joga o corpo para trás
        const d = Math.hypot(alvo.x - de.x, alvo.z - de.z) || 1, t = 0.35, m = COMBATE_INIMIGO.voaMorte;
        alvo.dash = { vx: (alvo.x - de.x) / d * m / t, vz: (alvo.z - de.z) / d * m / t, t };
      }
    } else if (firme) { /* firme: aguenta o golpe sem parar o que está fazendo */ }
    else if (alvo.parado > this.tempo) { /* atordoado ou congelado: nem reage */ }
    else if (h?.dot) { /* sangramento, veneno ou queimadura: só o número */ }
    else if (alvo.bm) { /* boss de mundo não para o que faz quando apanha */ }
    else if (alvo.defesa <= 0 && !alvo.esc && (alvo.trava <= 0 || alvo.tipo !== 'jogador')) this.tocar(alvo, A.hit, 1.4);
  }
  // espantalho de treino: mostra o dano e balança, mas nunca morre (a vida acabou, volta cheia na hora);
  // sem XP, sem item, sem missão e sem "firme". Congelar, atordoar, lentidão e Quebrado pegam (para testar).
  ferirTreino(alvo, n, crit, de, h) {
    if (de?.tipo === 'jogador') this.historia(de, 'treino', { skill: !!h?.q }); // história: golpes e skill no espantalho
    alvo.vida -= n;
    if (alvo.vida <= 0) alvo.vida = alvo.vidaMax;
    alvo.golpeT = this.tempo;
    if (de?.tipo === 'jogador') de.combateAte = this.tempo + ESTAMINA.combate;
    this.evento(crit ? { t: 'dano', alvo: alvo.id, n, crit: true } : { t: 'dano', alvo: alvo.id, n });
    if (h) {
      if (h.atordoa) { alvo.parado = Math.max(alvo.parado || 0, this.tempo + h.atordoa); alvo.ef = 'atordoado'; }
      if (h.congela) { alvo.parado = Math.max(alvo.parado || 0, this.tempo + h.congela); alvo.ef = 'congelado'; }
      if (h.lento) alvo.lento = { k: h.lento.k, ate: this.tempo + h.lento.dur };
      if (h.vulneravel) alvo.vuln = { k: h.vulneravel.k, ate: this.tempo + h.vulneravel.dur };
    }
    if (!(alvo.parado > this.tempo)) this.tocar(alvo, A.hit, 1.4);
  }
  morrer(c) {
    if (c.coleta) this.pararColeta(c, null);
    c.morto = true; c.dash = null; c.arrancada = null; c.esc = null;
    this.tocar(c, A.death, 1);
    c.trava = Infinity;
    if (c.tipo === 'jogador') {
      this.cancelarVila(c, null);
      this.morreuComCarga(c); // o pack das costas cai no chão; o veículo fica onde estava
      if (c.caverna) { c.caverna = null; this.evento({ t: 'caverna', id: c.id, aberta: false }); } // morreu: a entrada acabou
      if (c.prog.pos) { delete c.prog.pos; c.progSujo = true; } // morreu: entra de novo na vila (André 2026-11-03)
      // penalidade (André 2026-11-05, MORTE em shared/dados.js): perde parte do ouro e o equipamento desgasta
      const pen = penalidadeMorte(c.prog); c.progSujo = true;
      this.aplicarStatus(c); this.avisarProg(c);
      this.depois(HEROI.renascer, () => {
        // cama no terreno (como no Quimera): renasce do lado dela
        // totem de teleporte (André 2026-11-10): renasce no último tocado; o da vila (ou nenhum) deixa a cama valer
        const T = TOTENS.lista.find((t) => t.id === c.prog.totem && t.id !== 'clareira');
        const L = !T && this.loteDe(c), cama = L && L.pecas.find((o) => o.k === 'cama');
        const n = T ? this.ladoDoTotem(T) : cama ? { x: cama.x + ((cama.r & 1) ? 0 : 1.5), z: cama.z + ((cama.r & 1) ? 1.5 : 0) } : this.mapa.nascimento;
        Object.assign(c, { morto: false, vida: c.vidaMax, mana: c.manaMax ?? HEROI.mana, x: n.x, z: n.z, y: T ? this.terreno.altura(n.x, n.z) : 0, vy: 0, chao: true, trava: 0, acao: null });
        this.evento({ t: 'aviso', para: c.id, texto: 'Você se levanta de novo' + textoPenalidade(pen) });
      });
    } else {
      this.contarMissao(c);
      if (c.bm) this.bossMorreu(c); // boss de mundo: hora de voltar salva e faixa na tela de todos
      // XP para quem bateu nele ou estava perto (grupo). Time (André 2026-11-05): quem é do time de quem ganhou também ganha
      // XP e drop se está a até TIME.perto metros e lutou nos últimos TIME.combate segundos (parado longe da luta não ganha),
      // e cada um do time que ganhou soma TIME.bonus de XP para todos eles.
      const ganham = new Set();
      for (const j of this.jogadores.values()) if (!j.morto && !j.criando && (c.atacantes?.has(j.id) || dist(j, c) < 14)) ganham.add(j);
      for (const j of [...ganham]) for (const k of j.time?.membros || []) {
        const o = this.jogadores.get(k);
        if (o && !o.morto && !o.criando && dist(o, c) < TIME.perto && this.tempo - (o.lutouT ?? -1e9) <= TIME.combate) ganham.add(o);
      }
      const doTime = new Map(), maiorDoTime = new Map(); // time -> quantos dele ganharam / o nível mais alto entre eles
      for (const j of ganham) if (j.time) { doTime.set(j.time, (doTime.get(j.time) || 0) + 1); maiorDoTime.set(j.time, Math.max(maiorDoTime.get(j.time) || 0, j.prog.nivel | 0)); }
      for (const j of ganham) {
        const n = j.time ? doTime.get(j.time) : 1;
        const xp = Math.round(xpDoInimigo(c.tipo, c.nivel, j.prog.nivel, NIVEL_INIMIGO) * (c.sp?.caverna ? this.dungeon?.def?.forte?.xp || 1 : 1) * (c.bm ? BOSSES_MUNDO[c.bm].xp : 1));
        const nerf = n > 1 ? fatorXpTime(j.prog.nivel, maiorDoTime.get(j.time)) : 1; // muito abaixo do mais alto do time: menos XP (TIME_XP)
        this.ganharXP(j, n > 1 ? Math.round(xp * (1 + TIME.bonus * (n - 1)) * nerf) : xp); this.soltarDrops(c, j);
        this.contarHistoria(j, c); // missão principal (André 2026-11-10)
      }
      c.atacantes = null; c.parado = 0; c.ef = null; c.lento = null; c.vuln = null;
      if (c.sp.caverna) { // sala da caverna: o corpo some; a sala volta cheia depois (passoCaverna)
        const S = this.dungeon.salas.find((S) => S.def.id === c.sp.caverna), vg = S?.vagas.find((vg) => vg.e === c);
        this.depois(this.dungeon.def.corpo, () => { const i = this.inimigos.indexOf(c); if (i >= 0) this.inimigos.splice(i, 1); if (vg && vg.e === c) vg.e = null; });
      } else if (c.sp.caca != null) { // campo de caça: o corpo some e a vaga abre (o próximo nasce pela regra do Quimera, em passoCacas)
        const vg = this.cacas[c.sp.caca].vagas[c.sp.vaga];
        this.depois(this.cacas[c.sp.caca].def.corpo, () => { this.inimigos.splice(this.inimigos.indexOf(c), 1); if (vg.e === c) vg.e = null; });
      } else this.depois(8, () => {
        this.inimigos.splice(this.inimigos.indexOf(c), 1);
        this.criarInimigo(c.sp);
      });
    }
  }

  // ---------- ajudantes ----------
  evento(e) { if (this.ator && e.de === undefined && e.t !== 'aviso' && e.t !== 'fala') e.de = this.ator.id; this.eventos.push(e); }
  // o que roda depois guarda quem agiu (o golpe que acerta 0,3 s depois continua sendo do mesmo herói)
  depois(dt, fn) {
    const ator = this.ator;
    this.timers.push({ t: this.tempo + dt, fn: ator ? () => { const a = this.ator; this.ator = ator; try { fn(); } finally { this.ator = a; } } : fn });
  }
  aFrente(c, d) { return { x: c.x + Math.sin(c.ry) * d, z: c.z + Math.cos(c.ry) * d }; }
  virarPara(c, alvo) { c.ry = Math.atan2(alvo.x - c.x, alvo.z - c.z); }
  empurrar(c, metros, t) { c.dash = { vx: Math.sin(c.ry) * metros / t, vz: Math.cos(c.ry) * metros / t, t }; }
  // Toca uma animação de uma vez só; devolve a duração em segundos
  tocar(c, nome, ts = 1, segurar = 0) {
    const d = segurar || (DURACAO[nome] || 1) / ts;
    c.acao = { nome, ts, segurar: segurar > 0 };
    c.acaoSeq++;
    c.trava = d;
    return d;
  }
  colidir(c) {
    for (const k of c.tipo === 'jogador' ? [...this.obstaculos, ...this.pertoNaMata(c.x, c.z)] : [...this.obstaculos, ...this.obstaculosRocha, ...this.pertoNaMata(c.x, c.z)]) {
      if (k.alto != null && (c.y || 0) > k.alto - 0.05) continue; // por cima (esteio da ferraria visto do telhado, em pé na bancada)
      if (k.veio && this.veioVazio(k.veio, c)) continue; // veio esgotado: a pedra sumiu, dá para passar
      if (k.base != null && (c.y || 0) < k.base - 2.5) continue; // árvore lá em cima da montanha, e quem está embaixo, na caverna
      const dx = c.x - k.x, dz = c.z - k.z, d = Math.hypot(dx, dz), m = k.r + 0.35;
      if (d < m && d > 0) { c.x = k.x + dx / d * m; c.z = k.z + dz / d * m; }
    }
    if (c.tipo !== 'jogador') for (const k of this.casas) { // o herói usa a altura de verdade (escala a parede, anda no telhado)
      const dx = c.x - k.x, dz = c.z - k.z;
      const lx = dx * k.cos - dz * k.sin, lz = dx * k.sin + dz * k.cos; // no sistema da casa
      const px = k.hw - Math.abs(lx), pz = k.hd - Math.abs(lz);
      if (px <= 0 || pz <= 0) continue;
      let nx = lx, nz = lz;
      if (px < pz) nx = Math.sign(lx || 1) * k.hw; else nz = Math.sign(lz || 1) * k.hd;
      c.x = k.x + nx * k.cos + nz * k.sin; c.z = k.z - nx * k.sin + nz * k.cos;
    }
    for (const o of this.todos()) {
      if (o === c || o.morto || o.criando || Math.abs((o.y || 0) - (c.y || 0)) > 1) continue;
      const dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz);
      const m = (c.tipo !== 'jogador' && o.tipo !== 'jogador' ? 1.2 : 0.7) + (c.bm || o.bm ? COMBATE_BOSS.raio - 0.35 : 0); // monstro com monstro: ~0,6 m de raio cada; boss de mundo é largo
      if (d < m && d > 0) { c.x = o.x + dx / d * m; c.z = o.z + dz / d * m; }
    }
    [c.x, c.z] = limitarAoMapa(this.mapa, c.x, c.z, 2.2); // dentro da vila, da passagem e da clareira de fora (shared/mapa.js)
    if (c.bm) { const A = c.arena, d = Math.hypot(c.x - A.x, c.z - A.z); if (d > A.r) { c.x = A.x + (c.x - A.x) / d * A.r; c.z = A.z + (c.z - A.z) / d * A.r; } } // boss não sai da arena
    if (c.sub) this.prenderNaCaverna(c); // monstro da caverna fica no túnel
    else if (c.sp?.tunel) this.prenderNoTunel(c); // e o do covil das cavernas do mundo grande também
  }
  mover(c, dx, dz) {
    if (c.tipo === 'jogador') return this.moverJogador(c, dx, dz); if (c.treino) return; c.x += dx; c.z += dz; this.colidir(c);
    if (!c.sub && !c.sp?.tunel) c.y = Math.max(0, relevo(c.x, c.z)); // FASE 3: monstro anda no relevo do mundo grande (morro, platô)
  }
  // O herói anda por cima das pedras: degrau baixo sobe andando, pedra alta bloqueia (e aí dá para escalar)
  moverJogador(j, dx, dz) {
    const T = this.terreno, lim = j.y + SUBIDA.degrau;
    // névoa (André 2026-11-11: "consegui passar"): quando o servidor recusa a posição do celular, ele mesmo anda o herói
    // pelo joystick por meio segundo; aqui também a zona fechada é parede, senão cada "corrigir" levava ele mais para dentro
    const dentro = !!zonaFechadaEm(j.prog, j.x, j.z);
    const vai = (x, z) => {
      if (!dentro && j.prog && zonaFechadaEm(j.prog, x, z)) { this.naNevoa(j, x, z); return false; }
      const h = T.altura(x, z, j.y); if (h > lim) return false;
      j.x = x; j.z = z;
      if (j.chao && j.vy <= 0) { if (h >= j.y - 0.4) j.y = h; else j.chao = false; } // desce a pedra andando ou cai da beirada
      return true;
    };
    const x0 = j.x, y0 = j.y, z0 = j.z, chao0 = j.chao;
    if (!vai(j.x + dx, j.z + dz)) { j.bloqueado = true; if (!vai(j.x + dx, j.z)) vai(j.x, j.z + dz); }
    this.colidir(j);
    if (!dentro && j.prog && zonaFechadaEm(j.prog, j.x, j.z)) { j.x = x0; j.y = y0; j.z = z0; j.chao = chao0; j.bloqueado = true; } // empurrão para dentro da névoa
    // o empurrão de um obstáculo (tina, bigorna, esteio, outro jogador) não pode jogar o herói para dentro de uma parede:
    // senão o chão "sobe" até o alto dela e ele aparece no telhado (ferraria: tina rente ao muro do fundo)
    if (T.altura(j.x, j.z, j.y) > lim) { j.x = x0; j.y = y0; j.z = z0; j.chao = chao0; j.bloqueado = true; }
  }

  // ---------- escalada ----------
  // Toca um pedaço de escalada; o corpo segue o caminho do quadril da animação (esticado por vs, hs e ls)
  iniciarClip(j, nome, { vs = 1, hs = 1, ls = 1, depois = null } = {}) {
    const e = ESCALADA[nome], dur = DURACAO[e.anim] / e.ts;
    j.esc = j.esc || { parado: 0 };
    j.esc.clip = { nome, t: 0, dur, vs, hs, ls, x: j.x, y: j.y, z: j.z, depois };
    j.acao = { nome: e.anim, ts: e.ts }; j.acaoSeq++; j.trava = dur;
    j.chao = false; j.vy = 0; j.arrancada = null; j.dash = null; j.empurra = 0;
  }
  ficarEmPe(j) {
    const h = this.terreno.altura(j.x, j.z, j.y), cai = h < j.y - 0.3; // pousou fora (ponta de pedra, canto da chaminé): cai em vez de teleportar para baixo
    j.esc = null; if (!cai) j.y = h; j.chao = !cai; j.vy = 0; j.trava = 0; j.acao = null; j.pulos = 0; j.anim = this.animMovimento(j, false, false);
  }
  soltar(j) { // larga a parede e cai
    const fx = Math.sin(j.ry), fz = Math.cos(j.ry);
    j.esc = null; j.trava = 0; j.acao = null; j.x -= fx * 0.35; j.z -= fz * 0.35; j.vy = 1; j.chao = false; j.pulos = 2;
  }
  // primeira coisa alta à frente: distância até uma pedra mais alta que a mini escalada, se antes dela o caminho for livre.
  // Debaixo de telhado (ferraria) não tem escalada: lá em cima é teto.
  paredeAFrente(j, ry, ate) {
    const T = this.terreno, fx = Math.sin(ry), fz = Math.cos(ry);
    if (T.teto(j.x, j.z, j.y) < Infinity) return null;
    for (let d = 0.1; d <= ate; d += 0.1) {
      if (T.teto(j.x + fx * d, j.z + fz * d, j.y) < Infinity) return null; // o caminho entra debaixo de um telhado (ferraria aberta): parede lá dentro não se escala correndo
      const h = T.altura(j.x + fx * d, j.z + fz * d, j.y);
      if (h > j.y + SUBIDA.degrau) {
        if (h <= j.y + SUBIDA.mini) return null;
        const r = T.rochaEm(j.x + fx * d, j.z + fz * d, j.y);
        return r?.casa ? null : { dist: d, r }; // parede de casa não se escala (André, 2026-11-05): só pedra
      }
    }
    return null;
  }
  // parede de casa logo à frente ou de lado (empurrando de raspão) — casa da vila ou que o jogador construiu? Casa não se escala (André, 2026-11-05):
  // ele ficava agarrando na parede toda hora. Pedra continua escalável; escada continua subindo.
  casaAFrente(j, ry) {
    const T = this.terreno;
    for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2]) for (let d = 0.2; d <= 1.6; d += 0.2) if (T.rochaEm(j.x + Math.sin(ry + da) * d, j.z + Math.cos(ry + da) * d, j.y)?.casa) return true;
    return false;
  }
  // a beirada: o ponto mais alto da pedra logo à frente
  beirada(j) {
    const e = j.esc?.escada; if (e) return e.alt; // na escada, a beirada é o topo dela
    const T = this.terreno, fx = Math.sin(j.ry), fz = Math.cos(j.ry);
    // casa: a beirada é o alto da parede (onde começa o telhado), não o telhado subindo lá atrás;
    // senão ela escalava acima do beiral e ficava "escalando" em cima do telhado
    // (se logo atrás da beirada algo sobe reto, como a chaminé da ferraria, a parede continua até lá em cima)
    if (T.rochaEm(j.x + fx * 0.8, j.z + fz * 0.8, j.y)?.casa) for (let d = 0.05; d <= 1.2; d += 0.05) {
      const h = T.altura(j.x + fx * d, j.z + fz * d, j.y); if (h <= j.y + SUBIDA.degrau) continue;
      const atras = T.frente(j.x + fx * d, j.z + fz * d, j.ry, 0.6, null, j.y).topo;
      return atras > h + 0.8 ? atras : h;
    }
    return T.frente(j.x, j.z, j.ry, 1.0, null, j.y).topo;
  }
  // encosta o corpo na parede (na altura do peito) e vira de frente para a pedra
  // (agarrou de lado, andando quase paralelo à parede: procura a parede também para os lados e fica de frente para ela;
  // senão ficava torto, colado demais, e a escalada entrava na casa: o servidor recusava e ela ficava "em pé" no meio da parede)
  ajustarParede(j) {
    const T = this.terreno;
    let r = null;
    for (const da of [0, 0.4, -0.4, 0.8, -0.8, 1.2, -1.2, 1.57, -1.57]) {
      r = T.rochaEm(j.x + Math.sin(j.ry + da) * 0.8, j.z + Math.cos(j.ry + da) * 0.8, j.y); if (r) break;
    }
    if (r) j.ry = r.casa ? T.deFrentePara(r, j.x, j.z) : Math.atan2(r.x - j.x, r.z - j.z);
    const fx = Math.sin(j.ry), fz = Math.cos(j.ry);
    const longe = r?.casa ? SUBIDA.parede : 0.4; // pedra é torta: fica um pouco mais longe
    for (let d = -0.5; d <= 1.2; d += 0.05) if (T.altura(j.x + fx * (d + longe), j.z + fz * (d + longe), j.y) > j.y + 0.9) { j.x += fx * d; j.z += fz * d; return; }
  }
  // fica agarrado na parede
  agarrar(j) { j.esc = j.esc || { parado: 0 }; j.esc.clip = null; j.esc.parado = 0; j.chao = false; j.vy = 0; j.anim = PARADO_PAREDE.agarrado; if (!j.esc.escada) this.ajustarParede(j); }
  // pedra baixa: mini escalada até em cima
  miniSubida(j, ry) {
    const T = this.terreno, fx = Math.sin(ry), fz = Math.cos(ry), topo = T.frente(j.x, j.z, ry, 1.6, null, j.y).topo;
    let d = 0.3; for (; d < 1.6; d += 0.1) if (T.altura(j.x + fx * d, j.z + fz * d, j.y) >= topo - 0.2) break;
    // pousa em cima (mureta fina: não passa do outro lado)
    let pousa = d; while (pousa < d + 0.3 && T.altura(j.x + fx * (pousa + 0.05), j.z + fz * (pousa + 0.05), j.y) >= topo - 0.2) pousa += 0.05;
    j.ry = ry;
    this.iniciarClip(j, 'miniSubida', { vs: (topo - j.y) / 1.38, hs: Math.min(1.7, pousa) / 1.15, depois: () => this.ficarEmPe(j) });
  }
  // da beirada para cima da pedra
  subirNoTopo(j) {
    const T = this.terreno, fx = Math.sin(j.ry), fz = Math.cos(j.ry), topo = this.beirada(j);
    let d = 0.3; for (; d < 2; d += 0.1) if (T.altura(j.x + fx * d, j.z + fz * d, j.y) >= topo - 0.25) break;
    let pousa = d; while (pousa < d + 0.35 && T.altura(j.x + fx * (pousa + 0.05), j.z + fz * (pousa + 0.05), j.y) >= topo - 0.25) pousa += 0.05; // topo estreito (chaminé): não passa do outro lado
    this.iniciarClip(j, 'topo', { vs: Math.max(0.3, (topo - j.y) / 1.29), hs: Math.min(2.2, pousa) / 0.49, depois: () => this.ficarEmPe(j) });
  }
  pegarEscada(j, e) {
    j.ry = e.ry; j.x = e.x; j.z = e.z; j.esc = { parado: 0, escada: e };
    this.iniciarClip(j, 'pegarEscada', { hs: 0, ls: 0, depois: () => this.agarrar(j) });
  }
  // dash contra a rocha alta: corre pela parede (reto ou na diagonal, se a pedra estiver à direita)
  correrNaParede(j) {
    const f = this.paredeAFrente(j, j.ry, 2.9); if (!f || f.dist < 0.5 || !f.r) return false;
    const lado = angDif(Math.atan2(f.r.x - j.x, f.r.z - j.z), j.ry);
    j.esc = { parado: 0 };
    if (lado < -0.35) this.iniciarClip(j, 'diagonal', { hs: Math.max(0.3, (f.dist - 0.3) / 1.44), depois: () => this.agarrar(j) });
    else this.iniciarClip(j, 'correrNaParede', { hs: Math.max(0.2, (f.dist - 0.4) / 2.69), depois: () => this.agarrar(j) });
    this.evento({ t: 'dash', id: j.id });
    return true;
  }
  // andando no chão contra uma pedra: decide se sobe (escada, corrida na parede, mini escalada ou agarra na parede)
  tentarEscalar(j, correr, dt) {
    const { mx, mz } = j.entrada, ry = Math.atan2(mx, mz);
    // névoa (André 2026-11-11): empurrar a borda da zona fechada não é parede de escalar (era assim que o herói
    // "andava esquisito" por cima dela e entrava); nem pedra ou parede logo depois dela
    if (j.prog && !zonaFechadaEm(j.prog, j.x, j.z) && [0.6, 1.6, 3.2].some((d) => zonaFechadaEm(j.prog, j.x + Math.sin(ry) * d, j.z + Math.cos(ry) * d))) { j.empurra = 0; return; }
    for (const e of this.escadas) if (Math.hypot(j.x - (e.x - Math.sin(e.ry) * 0.2), j.z - (e.z - Math.cos(e.ry) * 0.2)) < 0.55 && Math.cos(angDif(ry, e.ry)) > 0.6) return this.pegarEscada(j, e); // de frente para a escada, no pé dela
    if (correr) {
      const f = this.paredeAFrente(j, ry, 3.1);
      if (f && f.dist >= 1.5) { j.ry = ry; j.esc = { parado: 0 }; return this.iniciarClip(j, 'corridaParede', { hs: (f.dist - 0.4) / 2.79, depois: () => this.agarrar(j) }); }
    }
    if (!j.bloqueado) { j.empurra = 0; return; }
    j.empurra += dt; if (j.empurra < SUBIDA.empurrar) return;
    if (this.casaAFrente(j, ry)) { j.empurra = 0; return; } // parede de casa: não agarra nem sobe (nem a mini escalada)
    const topo = this.terreno.frente(j.x, j.z, ry, 1.6, null, j.y).topo;
    if (topo - j.y <= SUBIDA.mini) return this.miniSubida(j, ry);
    if (this.terreno.teto(j.x, j.z, j.y) < Infinity) { j.empurra = 0; return; } // debaixo de telhado: não escala a parede de dentro
    j.ry = ry; this.agarrar(j);
  }
  passoEscalada(j, dt) {
    const s = j.esc, T = this.terreno;
    const fx = Math.sin(j.ry), fz = Math.cos(j.ry), lx = Math.cos(j.ry), lz = -Math.sin(j.ry);
    if (s.clip) {
      const c = s.clip; c.t += dt;
      const u = Math.min(1, c.t / c.dur), tr = ESCALADA[c.nome].traj, k = u * (tr.length - 1), i = Math.min(tr.length - 2, Math.floor(k)), a = k - i;
      const p = [0, 1, 2].map((n) => tr[i][n] * (1 - a) + tr[i + 1][n] * a);
      j.y = c.y + p[1] * c.vs;
      if (s.escada && c.nome !== 'topo') { // na escada: o corpo vai um pouco atrás da linha da escada
        const e = s.escada, t = Math.max(0, Math.min(1, (j.y + 0.5) / e.alt)); // escada inclinada: segue a linha um pouco acima do corpo (mãos e pés nos degraus)
        j.x = e.x + (e.topo.x - e.x) * t - fx * 0.35; j.z = e.z + (e.topo.z - e.z) * t - fz * 0.35;
      } else { j.x = c.x + lx * p[0] * c.ls + fx * p[2] * c.hs; j.z = c.z + lz * p[0] * c.ls + fz * p[2] * c.hs; }
      if (u < 1) return;
      s.clip = null; j.trava = 0; j.acao = null; c.depois?.();
      if (j.esc !== s || s.clip) return; // ficou em pé ou já emendou outro pedaço
    }
    // agarrado: o controle para a frente sobe, para trás desce, para os lados anda pela parede
    const { mx, mz } = j.entrada, m = Math.hypot(mx, mz);
    const frente = mx * fx + mz * fz, lado = mx * lx + mz * lz, falta = this.beirada(j) - j.y;
    s.parado += dt;
    if (m > 0.5 && frente > 0.5 * m) {
      s.parado = 0;
      if (falta <= SUBIDA.topo) return this.subirNoTopo(j);
      if (s.escada) return this.iniciarClip(j, 'subirEscada', { hs: 0, ls: 0, depois: () => this.agarrar(j) });
      return this.iniciarClip(j, 'subirParede', { vs: Math.max(0.3, Math.min(1, (falta - 1.29) / 1.06)), depois: () => this.agarrar(j) }); // para com a beirada na altura do 'topo'
    }
    if (m > 0.5 && frente < -0.5 * m) {
      s.parado = 0;
      const chao = T.altura(j.x - fx * 0.3, j.z - fz * 0.3, j.y), alt = j.y - chao;
      if (alt < 0.25) { j.esc = null; j.trava = 0; j.y = Math.max(chao, j.y); j.chao = false; return; }
      return this.iniciarClip(j, 'descerParede', { vs: Math.min(1, alt / 1.06), depois: () => (j.y - T.altura(j.x - fx * 0.3, j.z - fz * 0.3, j.y) < 0.3 ? this.ficarEmPe(j) : this.agarrar(j)) });
    }
    if (!s.escada && m > 0.5 && Math.abs(lado) > 0.5 * m) {
      s.parado = 0;
      const sx = j.x + lx * Math.sign(lado) * 0.5, sz = j.z + lz * Math.sign(lado) * 0.5;
      if (T.altura(sx + fx * 0.8, sz + fz * 0.8, j.y) > j.y + 0.9) return this.iniciarClip(j, lado > 0 ? 'esquerda' : 'direita', { depois: () => this.agarrar(j) });
    }
    j.anim = falta < SUBIDA.topo + 0.3 ? PARADO_PAREDE.beirada : s.parado > 4 && s.parado % 8 < 4 ? PARADO_PAREDE.balanca : PARADO_PAREDE.agarrado;
  }

  // ---------- passo da simulação ----------
  passo(dt) {
    this.tempo += dt;
    this.passoSpots();
    this.passoPacks();
    const vencidos = this.timers.filter((t) => t.t <= this.tempo);
    this.timers = this.timers.filter((t) => t.t > this.tempo);
    vencidos.forEach((t) => t.fn());

    for (const c of this.todos()) {
      if (c.dash && c.dash.t > 0) { if (!this.guiado(c)) this.mover(c, c.dash.vx * dt, c.dash.vz * dt); c.dash.t -= dt; } // guiado: o celular já fez o avanço
      if (c.trava > 0 && c.trava !== Infinity) {
        c.trava -= dt;
        if (c.trava <= 0) {
          c.trava = 0; c.acao = null;
          if (c.fila) { const f = c.fila; c.fila = null; if (f.ate >= this.tempo) { if (f.q) this.usarHabQ(c.id, f.q); else this.usarHabilidade(c.id, f.i); } }
        }
      }
    }
    for (const ctx of this.amigosIa) ctx.passoAmiga(dt); // Cecília e Dario decidem o que fazer (como jogadores sem celular)
    for (const j of this.jogadores.values()) this.passoJogador(j, dt);
    this.passoTrocas();
    this.passoTimes(dt);
    for (const e of this.inimigos) this.passoInimigo(e, dt);
    this.passoCacas(dt);
    this.passoBosses(dt); // bosses de mundo (André 2026-11-11)
    this.passoHistoria(dt); // história com etapas (André 2026-11-11)
    this.passoCaverna(dt);
    this.passoProjeteis(dt);
    this.passoCampos(dt);
    const ev = this.eventos; this.eventos = [];
    return ev;
  }
  passoJogador(j, dt) {
    if (j.vila && Math.hypot(j.x - j.vila.x, j.z - j.vila.z) > 0.6) this.cancelarVila(j, 'Você se mexeu: volta para a vila cancelada');
    const luta = this.emCombate(j); // Quimera: em luta a mana volta a 35% e a vida não volta
    j.mana = Math.min(j.manaMax, j.mana + j.st.regenMana * (luta ? REGEN.manaCombate : 1) * dt);
    this.passoEstamina(j, dt);
    if (j.coleta && this.tempo >= j.coleta.fim) this.batidaColeta(j);
    if (j.pesca) this.passoPesca(j, dt);
    if (j.fabrica && this.tempo >= j.fabrica.fim) this.passoFabrica(j);
    // totem (André 2026-11-10): passou perto, descobre; na área segura a vida volta mais rápido
    const seguro = !j.morto && !j.criando && naAreaSegura(j.x, j.z);
    if (seguro) { const t = totemPerto(j.x, j.z, TOTENS.toque); if (t) this.tocarTotem(j, t); }
    if (!j.morto && j.vida < j.vidaMax) j.vida = Math.min(j.vidaMax, j.vida + j.st.regenVida * (luta ? REGEN.vidaCombate : 1) * (seguro ? TOTENS.regen : 1) * dt);
    if (j.escudo && j.escudo.ate <= this.tempo) j.escudo = null;
    if (j.dots) { // sangramento, veneno e queimadura das skills dos bosses de mundo: um tique por segundo
      if (j.morto) j.dots = null;
      else {
        for (const d of j.dots) { d.t -= dt; if (d.t <= 0 && d.ate > this.tempo - 0.01 && !j.morto) { d.t += 1; this.feridaDot(j, d); } }
        j.dots = j.dots && j.dots.filter((d) => d.ate > this.tempo);
        if (!j.dots?.length) j.dots = null;
      }
    }
    if (this.guiado(j)) { // o celular move o herói; aqui só corre o tempo do dash
      if (j.arrancada) { j.arrancada.t -= dt; if (j.arrancada.t <= 0) j.arrancada = null; }
      return;
    }
    if (j.esc && !j.morto) return this.passoEscalada(j, dt);
    this.passoVertical(j, dt);
    if (j.morto) j.montado = null;
    if (j.morto || j.trava > 0) return;
    const { mx, mz, correr } = j.entrada, m = Math.hypot(mx, mz), mont = MONTARIAS[j.montado];
    j.bloqueado = false;
    if (j.arrancada) {
      const a = j.arrancada, x = 1 - a.t / MOVIMENTO.dashTempo, v = MOVIMENTO.dashVel * (1.6 * (1 - x) ** 0.7 + 0.15); // sai rápido e freia
      this.mover(j, a.dx * v * dt, a.dz * v * dt);
      a.t -= dt; if (a.t <= 0) j.arrancada = null;
    } else if (m > 0.15) {
      const v = mont ? mont.correr : correr ? HEROI.correr : HEROI.andar; // montado: o lobo vai sempre no galope (André 2026-11-07)
      this.mover(j, mx * v * dt, mz * v * dt);
      const alvo = Math.atan2(mx, mz);
      j.ry += angDif(alvo, j.ry) * Math.min(1, dt * 12);
    }
    if (j.chao && !j.arrancada && m > 0.5 && !mont) { this.tentarEscalar(j, correr, dt); if (j.esc) return; } else j.empurra = 0;
    j.anim = this.animMovimento(j, m > 0.15, correr);
  }
  // Queda, pouso e o tempo do mortal
  passoVertical(j, dt) {
    const chao = this.terreno.altura(j.x, j.z, j.y); // chão ou topo da pedra
    if (j.arrancada) j.vy = 0; else if (!j.chao || j.vy > 0) j.vy -= MOVIMENTO.gravidade * dt;
    j.y += j.vy * dt;
    const teto = this.terreno.teto(j.x, j.z, j.y - j.vy * dt) - HEROI.altura; // debaixo do telhado: a cabeça bate e volta
    if (j.y > teto && j.vy > 0) { j.y = Math.max(chao, teto); j.vy = 0; }
    if (j.y <= chao + 0.001) {
      if (!j.chao && j.vy < -3) j.pouso = DURACAO.pouso * 0.6;
      if (!j.chao) { j.pulos = 0; j.mortal = 0; j.arrancadaNoAr = false; }
      j.y = chao; j.vy = 0; j.chao = true;
    } else j.chao = false;
    j.puloT += dt;
    if (j.mortal > 0) j.mortal = Math.max(0, j.mortal - dt);
    if (j.pouso > 0) j.pouso = Math.max(0, j.pouso - dt);
  }
  animMovimento(j, andando, correr) {
    if (j.arrancada) return 'dash';
    if (j.mortal > 0) return 'mortal';
    if (!j.chao) return j.pulos === 1 && j.vy > 0 && j.puloT < 0.45 ? (correr && andando ? 'puloCorrendo' : 'pulo') : 'queda';
    if (j.pouso > 0 && !andando) return 'pouso';
    return andando ? (correr ? 'Run' : 'Walk') : ARMA.idle;
  }
  passoInimigo(b, dt) {
    if (b.morto) return;
    if (b.parado > this.tempo) return; // atordoado ou congelado
    if (b.ef) b.ef = null;
    if (b.treino) { // espantalho: não anda nem bate; parado um tempo sem apanhar, a vida enche de novo
      if (b.vida < b.vidaMax && this.tempo - (b.golpeT || 0) > TREINO.volta) b.vida = b.vidaMax;
      if (b.trava <= 0) b.anim = 'Idle';
      return;
    }
    if (b.bm) { // boss de mundo: o tempo da próxima skill corre mesmo parado; abaixo da metade da vida, fúria
      b.skillCd -= dt;
      if (!b.furia && b.vida < b.vidaMax * COMBATE_BOSS.furia) {
        b.furia = true;
        this.evento({ t: 'furia', id: b.id });
        for (const j of this.inimigosDe(b)) if (this.naArena(b, j, 20)) this.evento({ t: 'aviso', para: j.id, texto: `${b.nome} entrou em fúria!` });
      }
    }
    if (b.hcSk) { // chefe da história com golpes: a vez da skill corre sempre e as fases mudam pela vida (a Vesper)
      b.skillCd -= dt;
      const F = CHEFES_HISTORIA[b.hc]?.fases?.[b.faseI];
      if (F && b.vida <= b.vidaMax * F.vida) { b.faseI++; this.faseChefe(b, F); }
    }
    if (b.trava > 0) return;
    const t = TIPOS_INIMIGO[b.tipo];
    const lento = b.lento && b.lento.ate > this.tempo ? 1 - b.lento.k : 1;
    let alvo = this.maisPerto(b, b.bm ? b.arena.r * 2 : 14);
    if (alvo && naAreaSegura(alvo.x, alvo.z)) alvo = null; // totem (André 2026-11-10): lá dentro monstro não persegue; volta para casa
    if (alvo && this.mobFechadoPara(b, alvo)) alvo = null; // região fechada para esse herói (André 2026-11-11): não sai atrás dele
    if (alvo && alvo.cenaAte > this.tempo) alvo = null; // vendo uma cena da história (cena()): o monstro deixa ele em paz
    if (b.bm) { if (alvo && !this.naArena(b, alvo, COMBATE_BOSS.solta)) alvo = null; if (this.passoBoss(b, alvo, dt)) return; } // boss de mundo: só briga dentro da arena
    if (b.hcSk && this.passoChefeSkills(b, alvo, dt)) return; // chefe da história com golpes e fases (CHEFES_HISTORIA.skills)
    b.ataqueCd -= dt;
    const CI = COMBATE_INIMIGO;
    if (b.vez && (!alvo || alvo.id !== b.vez || dist(alvo, b) > 5)) b.vez = null; // largou a vez de bater
    // no máximo CI.aoMesmoTempo monstros batem no mesmo herói; os outros rodeiam esperando a vez
    const folga = alvo && !b.vez && (b.folgaAte || 0) > this.tempo; // acabou de passar a vez: recua um pouco
    const esperando = alvo && !b.vez && (folga || this.inimigos.filter((o) => o !== b && !o.morto && o.vez === alvo.id).length >= CI.aoMesmoTempo);
    if (alvo && esperando && dist(alvo, b) < CI.roda + 1.2) {
      this.virarPara(b, alvo);
      const d = dist(alvo, b), lado = (b.v % 2 ? 1 : -1), perto = (d - CI.roda) * 1.5;
      const vx = Math.cos(b.ry) * lado * CI.rodaVel + Math.sin(b.ry) * perto, vz = -Math.sin(b.ry) * lado * CI.rodaVel + Math.cos(b.ry) * perto;
      this.mover(b, vx * dt, vz * dt);
      b.anim = 'Walk';
    } else if (alvo && dist(alvo, b) < (b.bm ? COMBATE_BOSS.alcance : 1.9) && Math.abs(alvo.y - b.y) < (b.bm ? 2.5 : 1.3)) {
      this.virarPara(b, alvo); b.anim = A.swordIdle; b.vez = alvo.id;
      if (b.ataqueCd <= 0) {
        b.ataqueCd = t.intervalo * (b.furia ? COMBATE_BOSS.furiaIntervalo : 1);
        // preparo: a animação começa bem devagar (braço para trás) e o celular acende um brilho vermelho
        const nome = Math.random() < 0.5 ? A.slash : A.slash2, P = CI.preparo[b.tipo] ?? 0.5;
        const dur = DURACAO[nome] || 1, hit = P + Math.max(0.05, dur * CI.acerto - P * CI.preparoTs) / CI.golpeTs;
        b.acao = { nome, ts: CI.preparoTs, segurar: false, preparo: P, ts2: CI.golpeTs }; b.acaoSeq++;
        b.trava = P + Math.max(0.1, dur - P * CI.preparoTs) / CI.golpeTs;
        // Quimera: o tempo até o próximo golpe conta a partir do acerto (o ataqueCd só corre depois da trava)
        b.ataqueCd = Math.max(0, hit + CI.cdMin + Math.random() * (CI.cdMax - CI.cdMin) - b.trava);
        this.evento({ t: 'preparo', id: b.id, dur: P });
        b.preparoAte = this.tempo + P; // o cérebro dos NPCs (shared/cerebro.js) enxerga o braço levantado e pode recuar
        const seq = b.acaoSeq; // apanhou no meio (ou foi atordoado): o golpe foi cortado
        this.depois(hit, () => {
          if (b.acaoSeq !== seq || b.parado > this.tempo || b.morto || alvo.morto) return;
          if ((alvo.defesa >= 1 || alvo.arrancada) && dist(alvo, b) < 6) { // rolou ou deu dash na hora: esquiva e contra-ataque
            alvo.contraAte = this.tempo + CI.contraDur;
            this.evento({ t: 'esquiva', id: alvo.id, de: b.id });
            return;
          }
          if (dist(alvo, b) >= (b.bm ? COMBATE_BOSS.alcance + 0.6 : 2.4) || Math.abs(alvo.y - b.y) >= (b.bm ? 2.5 : 1.3)) return;
          if (naAreaSegura(alvo.x, alvo.z)) return; // entrou na área do totem bem na hora do golpe
          this.ferir(alvo, (b.dano ?? t.dano) * (b.furia ? COMBATE_BOSS.furiaDano : 1), b);
        });
        if (Math.random() < 0.5) { b.vez = null; b.folgaAte = this.tempo + b.trava + CI.folga; } // passa a vez para quem está rodeando
      }
    } else if (alvo) {
      const d = dist(alvo, b); this.virarPara(b, alvo);
      const v = (d > CI.chegarDist ? CI.perseguir : CI.chegar) * lento; // vai para cima correndo; só anda no último passo
      this.mover(b, Math.sin(b.ry) * v * dt, Math.cos(b.ry) * v * dt);
      b.anim = d > CI.chegarDist ? 'Run' : 'Walk';
    } else if (dist(b, b.casa) > 1) {
      this.virarPara(b, b.casa);
      this.mover(b, Math.sin(b.ry) * 1.7 * dt, Math.cos(b.ry) * 1.7 * dt);
      b.anim = 'Walk';
    } else b.anim = A.swordIdle;
  }
  passoProjeteis(dt) {
    for (let i = this.projeteis.length - 1; i >= 0; i--) {
      const p = this.projeteis[i], v = p.h.proj.vel;
      this.ator = p.dono;
      p.vida -= dt; p.x += p.dx * v * dt; p.y += p.dy * v * dt; p.z += p.dz * v * dt;
      let fim = p.vida <= 0 || p.y < this.terreno.altura(p.x, p.z, p.y); // bate no chão ou na pedra
      for (const o of this.inimigosDe(p.dono)) {
        if (p.acertou.has(o)) continue;
        const esc = o.bmEsc || TIPOS_INIMIGO[o.tipo]?.escala || 1;
        if (Math.hypot(o.x - p.x, o.z - p.z) < (p.h.proj.largura || 0.6) && p.y - (o.y || 0) < 2.1 * esc && p.y > (o.y || 0) - 0.3) {
          p.acertou.add(o); this.ferir(o, p.h.dmg, p.dono, p.h);
          if (!p.h.proj.atravessa) { fim = true; break; }
        }
      }
      if (!fim) continue;
      const ex = p.h.proj.explosao;
      if (ex) for (const o of this.inimigosDe(p.dono)) if (!p.acertou.has(o) && Math.hypot(o.x - p.x, o.z - p.z) < ex) this.ferir(o, p.h.dmg * (p.h.q ? 1 : 0.6), p.dono, p.h);
      this.evento({ t: 'projFim', id: p.id, x: r2(p.x), y: r2(p.y), z: r2(p.z), explosao: ex || 0, cor: p.h.proj.cor, estilo: p.h.proj.estilo });
      this.projeteis.splice(i, 1);
    }
    this.ator = null;
  }
  passoCampos(dt) {
    for (let i = this.campos.length - 1; i >= 0; i--) {
      const f = this.campos[i]; f.vida -= dt; f.tique -= dt;
      this.ator = f.dono;
      if (f.tique <= 0) { f.tique = 0.5; for (const o of this.inimigosDe(f.dono)) if (dist(o, f) < f.r) this.ferir(o, Math.round(f.dps * 0.5), f.dono); }
      if (f.vida <= 0) this.campos.splice(i, 1);
    }
    this.ator = null;
  }

  // ---------- bosses de mundo (André 2026-11-11; BOSSES_MUNDO e COMBATE_BOSS em shared/dados.js) ----------
  // bossVolta: { id do boss: hora (ms, Date.now) em que pode nascer de novo }. O servidor (server/index.js) carrega do banco
  // ao abrir a sala e grava a cada morte (aoBosses), então reiniciar o servidor ou fechar a sala não faz nascer antes.
  carregarBosses(est) { this.bossVolta = est && typeof est === 'object' ? { ...est } : {}; }
  agoraMs() { return this.relogioMs ? this.relogioMs() : Date.now(); } // os testes trocam o relógio
  naArena(b, o, folga = 0) { const A = b.arena; return Math.hypot(o.x - A.x, o.z - A.z) <= A.r + folga; }
  anunciar(texto) { // chat geral, para todo mundo online (todas as salas, pelo servidor)
    const msg = { canal: 'geral', c: 'sistema', nome: 'Aethra', texto, hora: Date.now(), sistema: true };
    if (this.aoAnuncio) this.aoAnuncio(msg); else this.receberChat(msg);
  }
  // bosses de mundo (André 2026-11-12: "ficar no chat permanente tá poluindo o visual"): faixa na tela de todo mundo
  // online (todas as salas, pelo servidor) que some sozinha; não entra no chat nem no histórico. cor: boss | caiu | mitico
  anunciarTela(cab, titulo, cor = 'boss') {
    const ev = { t: 'anuncio', cab, titulo, cor };
    if (this.aoAnuncioTela) this.aoAnuncioTela(ev); else this.evento(ev);
  }
  listaBosses() { // para o mapa: [id, vivo (1/0), segundos até voltar]
    const agora = this.agoraMs();
    return this.cacas.filter((c) => c.boss).map((c) => { const e = c.vagas[0].e; return [c.boss.id, e && !e.morto ? 1 : 0, e && !e.morto ? 0 : Math.max(0, Math.round(((this.bossVolta[c.boss.id] || 0) - agora) / 1000))]; });
  }
  passoBosses(dt) {
    // poças (lava, veneno): quem fica dentro recebe o efeito de novo a cada segundo
    for (let i = this.camposBoss.length - 1; i >= 0; i--) {
      const f = this.camposBoss[i]; f.t -= dt;
      if (f.ate <= this.tempo || f.b.morto) { this.camposBoss.splice(i, 1); continue; }
      if (f.t > 0) continue;
      f.t = 1;
      for (const j of this.inimigosDe(f.b)) if (Math.hypot(j.x - f.x, j.z - f.z) < f.r && !naAreaSegura(j.x, j.z)) this.efeitoNoHeroi(j, f.sk.ef, f.b);
    }
    this._bossT = (this._bossT ?? 0) - dt; if (this._bossT > 0) return;
    this._bossT = 1;
    const agora = this.agoraMs();
    let mudou = false;
    this.cacas.forEach((c, ci) => {
      if (!c.boss) return;
      const vg = c.vagas[0];
      if (vg.e || (this.bossVolta[c.boss.id] || 0) > agora) return;
      if (!this.nascerNaCaca(c, ci, vg)) return;
      this.virarBoss(vg.e, c); mudou = true;
      const B = c.boss.def;
      this.anunciarTela('BOSS DE MUNDO APARECEU', `${B.nome}, ${B.titulo} · ${B.regiao} · Nv ${B.nivel}`);
    });
    this._bossLista = (this._bossLista ?? 0) - 1;
    if (mudou || this._bossLista <= 0) { this._bossLista = 10; this.evento({ t: 'bosses', l: this.listaBosses() }); }
  }
  virarBoss(e, c) {
    const B = c.boss.def;
    Object.assign(e, { bm: c.boss.id, nome: B.nome, vidaMax: Math.round(e.vidaMax * B.vida), dano: Math.round(e.dano * B.dano), bmEsc: B.esc,
      skillCd: COMBATE_BOSS.primeiraSkill, skillI: 0, skillSeq: 0, furia: false, semAlvo: 0, arena: { x: c.def.x, z: c.def.z, r: c.def.r } });
    e.vida = e.vidaMax;
  }
  bossMorreu(c) {
    const B = BOSSES_MUNDO[c.bm], h = B.volta[0] + Math.random() * (B.volta[1] - B.volta[0]);
    this.bossVolta[c.bm] = this.agoraMs() + Math.round(h * 3600e3);
    this.aoBosses?.({ ...this.bossVolta });
    c.skillSeq++; c.voando = false;
    const quem = [...(c.atacantes || [])].map((id) => this.jogadores.get(id)?.nome).filter(Boolean);
    this.anunciarTela('BOSS DE MUNDO DERROTADO', `${B.nome} caiu${quem.length ? ' para ' + quem.slice(0, 5).join(', ') : ''}! Volta em umas ${h.toFixed(1).replace('.', ',').replace(',0', '')} h`, 'caiu');
    this._bossLista = 0;
  }
  // um passo do boss com alvo (ou sem). true = ele está ocupado (lançou uma skill), o resto do passoInimigo não roda
  passoBoss(b, alvo, dt) {
    if (!alvo) {
      b.semAlvo += dt;
      if (b.semAlvo > COMBATE_BOSS.reset && (b.vida < b.vidaMax || b.furia)) { // largaram ele: volta inteiro (nada de matar aos pouquinhos)
        b.vida = b.vidaMax; b.furia = false; b.atacantes = null; b.skillCd = COMBATE_BOSS.primeiraSkill; b.skillI = 0;
      }
      return false; // anda de volta para o meio (b.casa) pelo passoInimigo
    }
    b.semAlvo = 0;
    if (b.skillCd > 0) return false;
    const B = BOSSES_MUNDO[b.bm], sk = B.skills[b.skillI++ % B.skills.length];
    b.skillCd = sk.cd * (b.furia ? COMBATE_BOSS.furiaCd : 1);
    this.lancarSkillBoss(b, sk, alvo);
    return true;
  }
  // chefe da história com skills (CHEFES_HISTORIA: Arauto, Sentinela, Vesper): com alguém perto e a vez da skill
  // chegou (o tempo corre no passoInimigo, mesmo batendo), solta a próxima. true = ocupado (o resto do passoInimigo não roda)
  passoChefeSkills(b, alvo, dt) {
    const C = CHEFES_HISTORIA[b.hc]; if (!C?.skills) return false;
    if (!alvo || b.skillCd > 0 || b.trava > 0) return false;
    const sk = C.skills[b.skillI++ % C.skills.length];
    b.skillCd = sk.cd;
    this.lancarSkillBoss(b, sk, alvo);
    return true;
  }
  // a fase nova (Vesper): 'esquecer' = a Névoa faz o time de quem luta parar (os amigos da IA e os jogadores do time
  // ficam presos e o app apaga os nomes do time) e depois volta; 'fundir' = cresce, bate mais forte e chama o covil
  faseChefe(b, F) {
    const perto = [...this.jogadores.values()].filter((j) => !j.morto && dist(j, b) < 30);
    if (F.fala) for (const j of perto) if (!j.bot) this.evento({ t: 'aviso', para: j.id, texto: F.fala });
    if (F.k === 'esquecer') {
      const ids = new Set();
      for (const j of perto) for (const id of j.time?.membros || []) ids.add(id);
      for (const j of perto) if (!j.bot) {
        const outros = (j.time?.membros || []).filter((id) => id !== j.id);
        this.evento({ t: 'esquecer', para: j.id, dur: F.dur, ids: outros });
      }
      for (const id of ids) {
        const o = this.jogadores.get(id); if (!o || o.morto) continue;
        if (o.bot) this.efeitoNoHeroi(o, { atordoa: F.dur }, b); // o amigo da IA para e esquece (não bate em ninguém)
      }
      if (F.volta) this.depois(F.dur, () => { for (const j of perto) if (!j.bot && this.jogadores.get(j.id) === j) this.evento({ t: 'aviso', para: j.id, texto: F.volta }); });
    } else if (F.k === 'fundir') {
      b.esc = +(b.esc * (F.esc || 1.5)).toFixed(2); b.dano = Math.round(b.dano * (F.dano || 1));
      if (b.sp?.caca != null) this.invocarDoBoss(b);
    }
  }
  // ponto dentro da arena (o boss não pula para fora)
  naArenaPonto(b, x, z, folga = 1) { const A = b.arena, d = Math.hypot(x - A.x, z - A.z), m = A.r - folga; return d <= m ? { x, z } : { x: A.x + (x - A.x) / d * m, z: A.z + (z - A.z) / d * m }; }
  lancarSkillBoss(b, sk, alvo) {
    const seq = ++b.skillSeq, dano = b.dano * (b.furia ? COMBATE_BOSS.furiaDano : 1);
    this.virarPara(b, alvo);
    const r = (n) => r2(n), formas = [];
    let fim = null; // para onde o boss vai (salto, voo, investida, sumir)
    if (sk.k === 'salto' || sk.k === 'voo') { fim = this.naArenaPonto(b, alvo.x, alvo.z); formas.push({ f: 'c', x: r(fim.x), z: r(fim.z), r: sk.r }); }
    else if (sk.k === 'pedra') formas.push({ f: 'c', x: r(alvo.x), z: r(alvo.z), r: sk.r });
    else if (sk.k === 'area' || sk.k === 'uivo') formas.push({ f: 'c', x: r(b.x), z: r(b.z), r: sk.r });
    else if (sk.k === 'cone') formas.push({ f: 'v', x: r(b.x), z: r(b.z), ry: r(b.ry), a: sk.alcance, ang: sk.ang });
    else if (sk.k === 'investida') {
      let L = sk.comp; while (L > 2 && !this.naArena(b, { x: b.x + Math.sin(b.ry) * L, z: b.z + Math.cos(b.ry) * L }, -1)) L -= 1;
      fim = { x: b.x + Math.sin(b.ry) * L, z: b.z + Math.cos(b.ry) * L };
      formas.push({ f: 'l', x: r(b.x), z: r(b.z), ry: r(b.ry), a: L, l: sk.larg });
    } else if (sk.k === 'sumir') {
      fim = this.naArenaPonto(b, alvo.x - Math.sin(alvo.ry) * 1.8, alvo.z - Math.cos(alvo.ry) * 1.8);
      formas.push({ f: 'c', x: r(fim.x), z: r(fim.z), r: sk.r });
    } else if (sk.k === 'pocas') {
      const herois = this.inimigosDe(b).filter((j) => this.naArena(b, j, COMBATE_BOSS.solta));
      for (let i = 0; i < sk.n; i++) {
        const j = herois[i % Math.max(1, herois.length)] || alvo, a = Math.random() * TAU, d = i < herois.length ? 0 : 2 + Math.random() * 4;
        const p = this.naArenaPonto(b, j.x + Math.cos(a) * d, j.z + Math.sin(a) * d, 0);
        formas.push({ f: 'c', x: r(p.x), z: r(p.z), r: sk.r });
      }
    }
    if (sk.k === 'voo' || sk.k === 'sumir') b.voando = true; // no ar (ou sumido): ninguém acerta
    b.trava = sk.aviso + 0.5; b.acao = null; b.anim = A.swordIdle;
    this.evento({ t: 'bossSkill', id: b.id, k: sk.k, nome: sk.nome, dur: sk.aviso, formas, ef: this.corDoEfeito(sk.ef), fica: sk.fica || 0 });
    b.perigo = { formas, ate: this.tempo + sk.aviso }; // o cérebro dos NPCs (shared/cerebro.js) vê a área marcada no chão e sai dela
    this.evento({ t: 'preparo', id: b.id, dur: sk.aviso });
    this.depois(sk.aviso, () => {
      if (b.morto || b.skillSeq !== seq) return;
      b.voando = false;
      if (fim) { b.x = fim.x; b.z = fim.z; b.y = Math.max(0, relevo(b.x, b.z)); this.colidir(b); }
      if (sk.k === 'sumir') this.virarPara(b, alvo);
      b.acao = { nome: A.slash, ts: 1.2, segurar: false }; b.acaoSeq++;
      for (const j of this.inimigosDe(b)) if (formas.some((F) => this.dentroDaForma(F, j))) this.golpeBoss(b, j, sk, dano);
      if (sk.k === 'pocas' && sk.fica) for (const F of formas) this.camposBoss.push({ x: F.x, z: F.z, r: F.r, ate: this.tempo + sk.fica, t: 1, b, sk });
      if (sk.k === 'uivo') this.invocarDoBoss(b);
      this.evento({ t: 'bossGolpe', id: b.id, k: sk.k, formas, ef: this.corDoEfeito(sk.ef) });
    });
  }
  corDoEfeito(ef) { return !ef ? 'dano' : ef.dot ? ef.dot.k : ef.congela ? 'congela' : ef.lento && !ef.atordoa ? 'lento' : 'atordoa'; }
  dentroDaForma(F, o) {
    const dx = o.x - F.x, dz = o.z - F.z, d = Math.hypot(dx, dz);
    if (F.f === 'c') return d <= F.r + 0.3;
    if (F.f === 'v') return d <= F.a + 0.3 && (d < 1 || Math.abs(angDif(Math.atan2(dx, dz), F.ry)) <= F.ang / 2);
    const fx = Math.sin(F.ry), fz = Math.cos(F.ry), ao = dx * fx + dz * fz, lado = Math.abs(dx * fz - dz * fx); // linha: ao longo e de lado
    return ao >= -1 && ao <= F.a + 1 && lado <= F.l / 2 + 0.3;
  }
  golpeBoss(b, j, sk, dano) {
    if (j.morto || j.tipo !== 'jogador') return;
    if (j.defesa >= 1 || j.arrancada) { this.evento({ t: 'esquiva', id: j.id, de: b.id }); return; } // rolou ou deu dash na hora: escapou
    if (naAreaSegura(j.x, j.z)) return;
    if (sk.dano > 0) this.ferir(j, dano * sk.dano, b);
    if (!j.morto) this.efeitoNoHeroi(j, sk.ef, b);
  }
  // efeito de skill de boss no herói: preso (atordoa, congela, derruba: não anda nem age), lento e dano por segundo
  efeitoNoHeroi(j, ef, b) {
    if (!ef || j.morto) return;
    const preso = ef.atordoa || ef.congela || ef.derruba;
    if (preso) {
      if (!((j.presoAte || 0) > this.tempo)) j.presoEm = { x: j.x, z: j.z };
      j.presoAte = Math.max(j.presoAte || 0, this.tempo + preso);
      if (j.canal) this.cancelarCanal(j.id, 'Atordoado');
      j.trava = Math.max(j.trava || 0, preso); j.acao = null; j.fila = null; j.montado = null;
      this.evento({ t: 'efeito', id: j.id, ef: ef.congela ? 'congela' : ef.derruba ? 'derruba' : 'atordoa', dur: preso });
    }
    if (ef.lento) { j.lentoH = { k: ef.lento.k, ate: this.tempo + ef.lento.dur }; this.evento({ t: 'efeito', id: j.id, ef: 'lento', k: ef.lento.k, dur: ef.lento.dur }); }
    if (ef.dot) {
      const D = ef.dot, n = Math.max(1, Math.round(j.vidaMax * D.dps)); j.dots ||= []; // dps = fração da vida máxima do herói por segundo (vale igual em todo nível)
      const ja = j.dots.filter((d) => d.k === D.k);
      if (ja.length >= (D.max || 1)) { const v = ja.reduce((a, d) => (d.ate < a.ate ? d : a)); v.ate = this.tempo + D.dur; v.n = n; }
      else j.dots.push({ k: D.k, n, ate: this.tempo + D.dur, t: 1, de: b });
      this.evento({ t: 'efeito', id: j.id, ef: D.k, dur: D.dur, n: Math.min(D.max || 1, ja.length + 1) });
    }
  }
  // um tique de sangramento, veneno ou queimadura: tira direto da vida (a defesa já valeu no golpe que causou)
  feridaDot(j, d) {
    if (j.morto || naAreaSegura(j.x, j.z)) return;
    j.vida = Math.max(0, j.vida - d.n); j.combateAte = this.tempo + ESTAMINA.combate;
    if (j.bot && d.de && d.de.tipo !== 'jogador') j.golpeDe = golpeDe(d.de);
    this.evento({ t: 'dano', alvo: j.id, n: d.n, dot: d.k });
    if (j.vida <= 0) this.morrer(j);
  }
  invocarDoBoss(b) {
    const ci = b.sp.caca, c = this.cacas[ci];
    for (const vg of c.vagas.slice(1)) if (!vg.e && this.nascerNaCaca(c, ci, vg)) {
      const a = Math.random() * TAU; vg.e.x = b.x + Math.cos(a) * 3; vg.e.z = b.z + Math.sin(a) * 3; this.colidir(vg.e);
      vg.e.casa = { x: c.def.x, z: c.def.z };
    }
  }
  dropBoss(c, j) {
    const B = BOSSES_MUNDO[c.bm], D = B.drop, p = j.prog, ganhou = [];
    const por = (it) => { if (filtrado(p, it)) return; if (guardar(p.mochila, it)) ganhou.push({ nome: nomeItem(it), r: it.r ?? -1 }); else this.evento({ t: 'aviso', para: j.id, texto: `Mochila cheia! ${nomeItem(it)} ficou no chão` }); };
    const ouro = Math.round((c.nivel || 1) * (DROP_BOSS.ouro[0] + Math.random() * (DROP_BOSS.ouro[1] - DROP_BOSS.ouro[0])));
    p.ouro += ouro;
    por({ k: 'pocao', n: DROP_BOSS.pocao[0] + Math.floor(Math.random() * (DROP_BOSS.pocao[1] - DROP_BOSS.pocao[0] + 1)) });
    const pecas = Object.keys(ITENS).filter(ehEquip);
    por({ k: pecas[Math.floor(Math.random() * pecas.length)], r: 1 }); // monstro só solta até Rara (André 2026-11-06)
    const cat = () => (Math.random() < 0.5 ? CATALISADOR.arma : CATALISADOR.armadura);
    por({ k: cat()[D.cat], n: 1 });
    if (Math.random() < D.mitico) {
      por({ k: cat()[3], n: 1 });
      this.anunciarTela('CATALISADOR MÍTICO', `${j.nome} ganhou um de ${B.nome}!`, 'mitico');
    }
    if (Math.random() < DROP_BOSS.tomo) {
      const sk = Object.keys(HABS).filter((k) => HABS[k].tomo && HABS[k].libera <= p.nivel && (p.habs[k]?.nv || 1) < SKILL_MAX);
      if (sk.length) { const h = sk[Math.floor(Math.random() * sk.length)]; por({ k: 'tomo', h, nv: Math.max(NIVEL_SEM_TOMO + 1, (p.habs[h]?.nv || 1) + 1), n: 1 }); }
    }
    this.evento({ t: 'drop', para: j.id, x: r2(c.x), z: r2(c.z), ouro, itens: ganhou });
    this.avisarProg(j);
  }

  // ---------- o que vai para a tela ----------
  foto() {
    const roupa = (eq) => ['cabeca', 'corpo', 'pernas', 'pes', 'capa'].map((l) => (eq?.[l] ? eq[l].k + eq[l].r : '')).filter(Boolean).join(',');
    const corpo = (c) => ({ id: c.id, x: r2(c.x), y: r2(c.y), z: r2(c.z), ry: r2(((c.ry % TAU) + TAU) % TAU), vida: c.vida, vidaMax: c.vidaMax,
      morto: c.morto, anim: c.anim, acao: c.acao, acaoSeq: c.acaoSeq, nome: c.nome });
    return {
      tempo: r2(this.tempo),
      jogadores: [...this.jogadores.values()].map((j) => ({ ...corpo(j), vida: Math.round(j.vida), criando: !!j.criando, mana: Math.round(j.mana), manaMax: j.manaMax, nivel: j.prog.nivel, sta: Math.round(j.sta), staMax: j.staMax, coleta: j.coleta?.no || null,
        roupa: roupa(j.prog.equip), // o que aparece no corpo para os outros: "peitoral3,capa1"
        ...(j.roupaFixa ? { roupa: roupa(j.roupaFixa) } : {}), // a Cecília: aparência fixa do look B (as peças de verdade são outras)
        semCapacete: !!j.prog.semCapacete,
        pack: j.prog.pack?.k || null, veiculo: j.veiculo || null, // pack nas costas e veículo (os outros veem) // capacete escondido pelo dono: os outros também não veem
        escudo: j.escudo && j.escudo.ate > this.tempo ? j.escudo.n : 0, build: j.build, visual: j.visual, aparencia: j.aparencia || null, modo: j.modo, missoes: j.missoes, montado: j.montado || null, caverna: !!j.caverna,
        cds: Object.fromEntries(Object.entries(j.cds).map(([k, v]) => [k, r2(Math.max(0, v - this.tempo))])), ...(j.bot ? { bot: 1 } : {}) })), // bot: a Cecília (só o dono conversa)
      inimigos: this.inimigos.map((e) => ({ ...corpo(e), tipo: e.tipo, v: e.v, nivel: e.nivel, ...(e.hc ? { hc: e.hc, esc: e.esc, cor: e.cor } : {}), ef: e.parado > this.tempo ? e.ef : e.lento?.ate > this.tempo ? 'lento' : null })),
      // veios das zonas de mineração e árvores já batidos: [id, cargas que sobram, s para voltar] (quem entra depois também vê)
      veios: [...this.veiosComuns].filter(([, v]) => v.volta > this.tempo).map(([id, v]) => [id, v.n, r2(v.volta - this.tempo)]),
      // spots de pesca que estão na água agora: [id, tipo (comum/raro/epico), x, z]
      spots: this.spots.filter((v) => v.ativo).map((v) => [v.id, v.tipo, r2(v.x), r2(v.z)]),
      // FASE 1: packs no chão [g, tipo, x, z] e veículos ['c'|'n'|'b', dono, x, z, ry, nv, packs, quebrado, dirigindo]
      carga: this.fotoCarga(),
    };
  }
}
// packs e transportes (FASE 1): as funções de shared/transporte.js entram na Simulacao
Object.assign(Simulacao.prototype, Transporte);
Object.assign(Simulacao.prototype, Amiga);
// o amigo virtual (contexto da Cecília ou do Dario) pelo corpo, pelo id ou pela conta; null = não é amigo virtual
Simulacao.prototype.amigoIaDe = function (o) {
  if (!o) return null;
  return this.amigosIa.find((x) => (typeof o === 'string' ? x.AMIGA.id === o || x.AMIGA.conta === o : x.amiga === o)) || null;
};

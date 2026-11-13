// Missão nunca trava por falta de item (André 2026-11-12). Duas regras, com "filtro humano":
//
// 1. Kit (kit: true na etapa, só nas missões do comecinho, que ensinam): "se ele não tiver nenhum equipamento para ser
//    reforçado, o NPC dá uma peça... para ensinar ele a reforçar"; "no comecinho, que é só para aprendizado, aí pode
//    dar". O NPC da missão dá só o que falta para fazer a etapa UMA vez (a peça velha para destruir, a peça comum e o
//    catalisador para evoluir, o material da vara, a lenha do primeiro pack, o ouro da primeira compra e do primeiro
//    terreno). Quem já tem não ganha nada. Dá ao aceitar, quando a etapa começa e quando o jogador fala com o NPC de novo
//    (o evoluir que falhou ganha outro catalisador). gratis: true = a ação daquela etapa não cobra (o reforço do Tomás).
//    No comecinho (missão até KIT.ateNivel) a ferramenta que falta para a etapa (vara, machado, picareta) também vem.
//
// 2. Junta (toda etapa de criar, construir ou fazer pack): coisa grande nunca é dada ("vai dar um navio para o cara...
//    tem que ter um pouco de filtro"). Enquanto falta material, a etapa vira "Barquinho: corte Lenha 12/30"
//    e o Ir leva direto à fonte: a árvore, o veio, o campo de caça que derruba aquilo, o spot de pesca, a horta; barra
//    de metal vira "minere o minério" e depois "funda no forninho". Juntou tudo, volta o texto da etapa (crie, construa).
//    Nada muda nas etapas gravadas (o índice da etapa é o mesmo): só o texto, o Ir e o guia acompanham o que falta.
import { ITENS, COLETA, RECEITAS, CONSTRUCOES, FERRAMENTAS_FAZENDA, PACKS, CACA, LOJA, LOTE, PLANTAS, PESCA, DROPS, CATALISADOR, RARIDADES, VEICULOS, CAVERNA_DUNGEON, HORTA, HISTORIA } from './dados.js';
import { contar, guardar, nomeItem, ehEquip, reforcoMax, custoReforco, materialReforco } from './progresso.js';
import { missaoAtual, etapaAtual, zonaFechadaEm } from './historia.js';
import { custoPack, capacidadeCarrinho } from './transporte.js';
import { Leilao } from './leilao.js';
import { LUGARES_MUNDO } from './mundo.js';

export const KIT = {
  ateNivel: 12, // ferramenta da etapa de graça só nas missões do comecinho (Ato I até o Nv 12)
  peca: 'botas', // a peça que o NPC dá para destruir, evoluir ou reforçar
  leilao: 20, // ouro que o Otávio deixa na caixa para o primeiro "retirar" (senão era esperar 24 h alguém comprar)
};

// de onde vem cada material (o Ir da etapa de juntar leva para lá)
const VEIO = { lenha: 'arvore', pedra: 'pedra', minerio_cobre: 'cobre', minerio_ferro: 'ferro', cristal: 'cristal' };
const FORJA = ['barra_cobre', 'barra_ferro', 'barra_aco', 'carvao']; // sai do forninho (do minério / da lenha)
const PEIXES = new Set(Object.keys(PESCA.tier || {}));
// peixe que só sai no mar (sardinha, robalo, garoupa, atum, dourado): barquinho e Radar de pesca
const DOCE = new Set(Object.values(PESCA.spots || {}).flatMap((T) => (T.peixes?.doce || []).map(([k]) => k)));
export const soNoMar = (k) => !!k && PEIXES.has(k) && !DOCE.has(k);
// o que se cria e o que gasta, para n vezes
export function receitaDe(k) {
  if (!k) return null;
  if (FERRAMENTAS_FAZENDA[k]) return { usa: FERRAMENTAS_FAZENDA[k].custo, ouro: FERRAMENTAS_FAZENDA[k].ouro || 0 };
  const c = CONSTRUCOES[String(k).replace(/^obra_/, '')]; if (c?.custo) return { usa: c.custo, ouro: 0 };
  const r = RECEITAS[k] || Object.values(RECEITAS).find((o) => o.faz === k); if (r?.usa) return { usa: r.usa, ouro: 0 };
  return null;
}
const nome = (k) => ITENS[k]?.nome || CONSTRUCOES[k]?.nome || k;
const receitaQueFaz = (k) => RECEITAS[k]?.faz === k ? RECEITAS[k] : Object.values(RECEITAS).find((o) => o.faz === k && !o.r) || null;
// Tudo que a etapa da vez precisa (André 2026-11-13: "em vez de mandar colher a madeira, depois colher a pedra... ele já
// joga direto para o craft"; o barquinho levava ao NPC). Não é só criar: entregar ao NPC, minerar sem picareta, pescar sem
// vara, plantar sem semente, melhorar e consertar o carrinho, evoluir, reforçar, o passe do Gaspar e a síntese da
// Mirela também viram "o que falta". { usa: { item: n }, ouro, ferr: [ferramentas que basta ter] } ou null.
const FERR = new Set(['machado', 'picareta', 'vara', 'enxada', 'regador', 'radar_pesca'].filter((k) => FERRAMENTAS_FAZENDA[k])); // basta ter uma
const ehArma = (k) => ['espada', 'cajado'].includes(ITENS[k]?.lugar);
// o que gasta evoluir a peça (o mesmo da receitaEvoluir do servidor)
export function usaEvoluir(it) {
  const r = (it?.r | 0) + 1; if (!it || r >= RARIDADES.length) return null;
  const t = ehArma(it.k) ? 'arma' : 'armadura';
  return { [CATALISADOR[t][r - 1]]: 1, ...CATALISADOR.usa[t][r - 1] };
}
const faltaDe = (p, usa) => Object.entries(usa || {}).reduce((a, [k, n]) => a + Math.max(0, n - contar(p.mochila, k)), 0);
// a peça que a etapa de evoluir usa: a da raridade de baixo que precisa de menos coisa (só arma, se a etapa é de arma)
export function pecaEvoluir(p, r0, soArma = false) {
  return p.mochila.filter((o) => o && ehEquip(o.k) && !o.cad && o.r === r0 && (!soArma || ehArma(o.k))).sort((a, b) => faltaDe(p, usaEvoluir(a)) - faltaDe(p, usaEvoluir(b)))[0] || null;
}
export function precisaDe(p, E) {
  if (!E || !p) return null;
  const resta = Math.max(1, (E.n || 1) - (p.hist?.n || 0));
  const vezes = (o, n) => Object.fromEntries(Object.entries(o || {}).map(([k, q]) => [k, q * n]));
  switch (E.ev) {
    case 'criar': case 'construir': {
      if (E.ja === 'tem' && contar(p.mochila, E.k) > 0) return null;
      const R = receitaDe(E.k); return R ? { usa: vezes(R.usa, resta), ouro: R.ouro || 0 } : null;
    }
    case 'pack_fez': return PACKS[E.k] ? { usa: vezes(custoPack(E.k, p.prof?.mer), resta) } : null;
    case 'ter': return { usa: { ...E.itens } };
    case 'falar': return E.entregar ? { usa: { ...E.entregar } } : null; // "Entregue 40 lenhas... ao Malaquias": junta antes
    case 'item': return E.de === 'coleta' ? { ferr: [].concat(E.k || []).map(ferramentaDe).filter(Boolean) } : E.de === 'pesca' ? { ferr: ['vara'] } : null;
    case 'pesca': return { ferr: soNoMar(E.k) ? ['vara', 'radar_pesca'] : ['vara'] };
    case 'regar': return { ferr: ['regador'] };
    case 'plantar': { // semente da planta pedida (ou qualquer uma: a que tiver menos, das da sopa) e a enxada para arar
      const ks = E.k ? [E.k] : ['cenoura', 'batata', 'rabanete'];
      const tem = ks.reduce((a, k) => a + contar(p.mochila, 'semente_' + k), 0);
      const k = ks.slice().sort((a, b) => contar(p.mochila, 'semente_' + a) - contar(p.mochila, 'semente_' + b))[0];
      return { ferr: ['enxada'], usa: tem >= resta ? {} : { ['semente_' + k]: contar(p.mochila, 'semente_' + k) + resta - tem } };
    }
    case 'veiculo': {
      const c = p.carrinho, C = VEICULOS.carrinho; if (!c) return null;
      if (E.k === 'melhorar') { const cu = C.melhorar[(c.lv | 0 || 1) + 1]; if (!cu || (c.lv | 0) >= (E.min || 0)) return null; const { ouro = 0, ...usa } = cu; return { usa, ouro }; }
      if (E.k === 'consertar') return c.quebrado || c.vida < C.vida ? { usa: { ...(c.quebrado ? C.consertoQuebrado : C.consertoParcial) } } : null;
      if (E.k === 'abastecer') return c.comb < C.galao * C.tanque - 1 ? { usa: { galao: 1 } } : null;
      return null;
    }
    case 'evoluir': case 'arma': { // arma: "Equipe uma arma Lendária" = evoluir uma arma Épica (se não tiver a Lendária)
      const r0 = Math.max(0, (E.min || 1) - 1);
      if (E.ev === 'arma' && [...p.mochila, ...Object.values(p.equip || {})].some((o) => o && ehArma(o.k) && o.r >= (E.min || 0))) return null;
      const it = pecaEvoluir(p, r0, E.ev === 'arma'); return it ? { usa: usaEvoluir(it) } : null;
    }
    case 'reforcar': { // uma tentativa: ouro e o tecido (armadura); o primeiro reforço da história é grátis
      if (E.gratis) return null;
      const serve = (o) => o && ehEquip(o.k) && reforcoMax(o) > (o.e | 0);
      const it = [...p.mochila, ...Object.values(p.equip || {})].filter(serve).sort((a, b) => (b.e | 0) - (a.e | 0))[0];
      if (!it) return null;
      const m = materialReforco(it); return { usa: m ? { [m.k]: m.n } : {}, ouro: custoReforco(it) };
    }
    case 'passe': return E.k === 'fazer' ? { usa: { ...CAVERNA_DUNGEON.passe } } : { usa: { passe_caverna: 1 } };
    case 'sintetizar': { // 1 catalisador Épico: 10 do Raro (Selo ou Runa, o que tiver mais) e o ouro
      const S = CATALISADOR.sintese.custo[2], k = contar(p.mochila, 'runa_rara') > contar(p.mochila, 'selo_raro') ? 'runa_rara' : 'selo_raro';
      return { usa: { [k]: S.n }, ouro: S.ouro };
    }
  }
  return null;
}
// feito por um NPC (não tem receita): do que é feito, quem faz e o guia
const DO_NPC = { passe_caverna: { usa: CAVERNA_DUNGEON.passe, npc: 'guardiao', guia: { ev: 'passe', k: 'fazer' } } };
// a receita de quem se cria (receitas, ferramentas, obra_ da bancada)
const receitaItem = (k) => {
  const R = receitaQueFaz(k); if (R) return R.usa;
  if (FERRAMENTAS_FAZENDA[k]) return FERRAMENTAS_FAZENDA[k].custo;
  if (String(k).startsWith('obra_')) return CONSTRUCOES[k.slice(5)]?.custo || null;
  return null;
};
// tudo que a etapa da vez pede para criar, até o fim da cadeia (barra de aço -> barra de ferro, carvão), e o que se
// minera para ela: o nível da profissão não trava a missão (André 2026-11-12: "não quero ficar descobrindo erro atrás de erro")
export function pedidosDaEtapa(E, p) {
  const out = new Set();
  const N = precisaDe(p || { mochila: [], hist: {} }, E); if (!N) return out;
  const ver = (k, fundo) => {
    if (out.has(k) || fundo > 4) return;
    const R = receitaItem(k);
    if (!R) { if (VEIO[k]) out.add(k); return; } // minério e cristal: o veio libera (coletaLivre)
    out.add(k); for (const i of Object.keys(R)) ver(i, fundo + 1);
  };
  if (E.ev === 'criar') ver(String(E.k), 0);
  if (E.ev === 'item' && E.de === 'coleta') for (const k of [].concat(E.k || [])) if (VEIO[k]) out.add(k); // minere o ferro: o veio libera
  for (const k of Object.keys(N.usa || {})) ver(k, 0);
  for (const k of N.ferr || []) ver(k, 0);
  return out;
}
const ferramentaDe = (k) => (VEIO[k] ? COLETA[VEIO[k]]?.ferramenta : null);
// planta: quanto já cresceu (horas de terra molhada), sem mexer no lote (o mesmo de crescerPlanta)
const gAgora = (t, agora) => { const ini = Math.max(t.u || agora, t.w || 0), fim = Math.min(agora, (t.w || 0) + HORTA.rega * 3600000); return (t.g || 0) + Math.max(0, fim - ini) / 3600000; };
const NA_LOJA = new Set(LOJA.filter((o) => o.r == null).map((o) => o.k));

export const Kit = {
  // ---------- 1. kit: o NPC da missão dá o que falta (só onde a etapa pede kit, ou a ferramenta no comecinho) ----------
  kitEtapa(j) {
    const p = j.prog, h = p.hist, M = missaoAtual(p), E = etapaAtual(p);
    if (j.bot || !h?.ac || !M || !E) return null;
    const itens = [], pecas = []; let ouro = 0, caixa = 0;
    const falta = (k, n) => { const f = n - contar(p.mochila, k) - (itens.find((o) => o.k === k)?.n || 0); if (f > 0) itens.push({ k, n: f }); };
    // ferramenta da etapa (só no comecinho: depois ele cria, e o guia leva até o Criar)
    if (M.nv <= KIT.ateNivel) {
      if (E.ev === 'pesca' || (E.ev === 'item' && E.de === 'pesca')) falta('vara', 1);
      if (E.ev === 'item' && E.de === 'coleta') for (const k of [].concat(E.k || [])) { const f = ferramentaDe(k); if (f) falta(f, 1); }
    }
    if (E.kit) {
      const naMochila = (f) => p.mochila.some((o) => o && ehEquip(o.k) && !o.cad && f(o));
      if (E.ev === 'destruir' && !naMochila(() => true)) pecas.push({ k: KIT.peca, r: 0 });
      if (E.ev === 'evoluir') { // a peça da raridade de baixo (a que precisa de menos coisa) e o que a receita gasta
        const r0 = Math.max(0, (E.min || 1) - 1);
        const custo = (it) => Object.entries(this.receitaEvoluir(it)?.usa || {}).reduce((a, [k, n]) => a + Math.max(0, n - contar(p.mochila, k)), 0);
        let alvo = p.mochila.filter((o) => o && ehEquip(o.k) && !o.cad && o.r === r0).sort((a, b) => custo(a) - custo(b))[0];
        if (!alvo) { alvo = { k: KIT.peca, r: r0 }; pecas.push(alvo); }
        for (const [k, n] of Object.entries(this.receitaEvoluir(alvo)?.usa || {})) falta(k, n);
      }
      if (E.ev === 'reforcar') { // peça que dá para reforçar (Rara ou melhor, abaixo do máximo), na mochila ou no corpo
        const serve = (o) => o && ehEquip(o.k) && reforcoMax(o) > (o.e | 0);
        if (!p.mochila.some(serve) && !Object.values(p.equip || {}).some(serve)) pecas.push({ k: KIT.peca, r: 1 });
      }
      if (E.ev === 'comprar') { const o = LOJA.find((x) => x.k === E.k && x.r == null); if (o) ouro = Math.max(0, o.preco * (E.n || 1) - (p.ouro || 0)); }
      if (E.ev === 'terreno') ouro = Math.max(0, LOTE.ladoMin * LOTE.ladoMin * LOTE.precoBloco - (p.ouro || 0)); // o menor terreno
      if (E.ev === 'pack_fez' && PACKS[E.k]) for (const [k, n] of Object.entries(custoPack(E.k, p.prof.mer))) falta(k, n);
      if (E.ev === 'criar') { const R = receitaDe(E.k); for (const [k, n] of Object.entries(R?.usa || {})) falta(k, n * (E.n || 1)); }
      if (E.ev === 'ter') for (const [k, n] of Object.entries(E.itens || {})) falta(k, n);
      if (E.ev === 'leilao' && E.de === 'retirar') {
        const cx = (this.leilao ||= new Leilao()).caixaDe(j.conta);
        if (!cx.ouro && !cx.itens.length) { cx.ouro += KIT.leilao; caixa = KIT.leilao; this.aoLeilao?.(this.leilao); }
      }
    }
    if (!itens.length && !pecas.length && !ouro && !caixa) return null;
    const deu = [];
    const cabe = (it) => { // pilha por pilha (guardar não aceita mais que uma pilha de uma vez)
      if (it.r != null) return guardar(p.mochila, { ...it });
      for (let q = it.n, P = ITENS[it.k].pilha || 1; q > 0; q -= P) if (!guardar(p.mochila, { k: it.k, n: Math.min(P, q) })) return false;
      return true;
    };
    for (const it of [...pecas, ...itens]) {
      if (cabe(it)) deu.push(it.r != null ? nomeItem(it) : `${it.n} ${nome(it.k)}`);
      else this.evento({ t: 'aviso', para: j.id, texto: `Mochila cheia: abra espaço e fale com ${this.nomeNpc(M.npc)} de novo` });
    }
    if (ouro) { p.ouro = (p.ouro || 0) + ouro; deu.push(`${ouro} de ouro`); }
    if (caixa) deu.push(`${caixa} de ouro na sua caixa do leilão (retire comigo)`);
    if (!deu.length) return null;
    const quem = E.ev === 'leilao' ? 'v_otavio' : M.npc;
    this.evento({ t: 'fala', para: j.id, npc: quem, texto: `Tome: ${deu.join(', ')}. É para você aprender, o resto é com você.` });
    this.evento({ t: 'aviso', para: j.id, texto: `${this.nomeNpc(quem)} deu: ${deu.join(', ')}` });
    this.aplicarStatus(j);
    j.progSujo = true;
    return deu;
  },
  // ---------- 2. junta: o que falta para a etapa da vez, e de onde vem ----------
  // Devolve null (tem tudo) ou { k, n, tem, fonte, para? } do primeiro que falta (ferramenta antes, depois a receita na
  // ordem), ou um passo antes { pre, txt, alvo, guia } (pack: pôr o carrinho no chão, o pack nele, subir nele). fonte:
  // 'veio:tipo' · 'solto' (galho e pedrinha, sem machado/picareta) · 'caca:id' · 'spot' · 'lote' (colha) · 'plantar' ·
  // 'regar' · 'cresce' · 'loja' (Rosa) · 'forno' · 'receita' · 'destruir' · 'sintese' (Mirela) · 'npc:id' · 'ouro'
  juntaDe(j, E = etapaAtual(j.prog)) {
    const p = j.prog;
    if (!E || E.junta === false || j.bot) return null;
    const pre = this.antesDe(j, E); if (pre) return pre;
    const N = precisaDe(p, E); if (!N) return null;
    const usado = {}; // o que já foi contado para outra parte da receita (a lenha da barra e a do carrinho)
    const plano = (k, q, fundo = 0, para = '') => {
      const livre = Math.max(0, contar(p.mochila, k) - (usado[k] || 0));
      usado[k] = (usado[k] || 0) + Math.min(livre, q);
      if (livre >= q) return null;
      const falta = q - livre, sai = (fonte) => ({ k, n: q, tem: livre, fonte, ...(para ? { para } : {}) });
      if (fundo > 4) return sai(this.fonteDe(j, k));
      if (FERR.has(k)) { // ferramenta (machado, picareta, vara...): o material dela vem do chão, depois cria na mochila
        const nm = nome(k);
        for (const [i, n] of Object.entries(FERRAMENTAS_FAZENDA[k].custo)) { const f = plano(i, n * falta, fundo + 1, nm); if (f) return f; }
        return sai('receita');
      }
      if (VEIO[k]) { // cortar e minerar pedem a ferramenta: sem ela, primeiro cria (o material dela vem do chão)
        const t = ferramentaDe(k);
        if (t && contar(p.mochila, t) < 1) {
          if (para && ['lenha', 'pedra'].includes(k)) return sai('solto');
          usado[k] -= Math.min(livre, q); // a ferramenta usa o mesmo material: ela vem antes
          const f = plano(t, 1, fundo + 1); if (f) return f;
          usado[k] += Math.min(livre, q);
        }
        return sai('veio:' + VEIO[k]);
      }
      if (FORJA.includes(k)) { // barra / carvão: primeiro o que ela gasta, depois o forninho
        for (const [i, n] of Object.entries(RECEITAS[k]?.usa || {})) { const f = plano(i, n * falta, fundo + 1, para); if (f) return f; }
        return sai('forno');
      }
      if (PLANTAS[k]) { // horta: compra a semente, planta, rega e colhe
        const st = this.hortaDe(j, k);
        if (st === 'madura') return sai('lote');
        if (st) { if (st === 'seca') { const f = plano('regador', 1, fundo + 1); if (f) return f; } return sai(st); }
        { const f = plano('enxada', 1, fundo + 1); if (f) return f; }
        if (contar(p.mochila, 'semente_' + k) < 1) { const f = plano('semente_' + k, Math.max(1, Math.ceil(falta / PLANTAS[k].y[0])), fundo + 1, para); if (f) return f; }
        return sai('plantar');
      }
      if (PEIXES.has(k)) {
        const f = plano('vara', 1, fundo + 1); if (f) return f;
        if (soNoMar(k)) { const g = plano('radar_pesca', 1, fundo + 1) || this.marAntes(j, false, plano); if (g) return g; } // sardinha, garoupa...: de barco, com o radar
        return sai('spot');
      }
      const C = ITENS[k]?.catalisador; // Selo / Runa: destruindo peça; do Épico em diante a Mirela junta 10 de baixo
      if (C) {
        const r = ITENS[k].cr, S = CATALISADOR.sintese;
        if (r >= 2 && r <= S.ate && this.sinteseAberta(p)) { const f = plano(CATALISADOR[C][r - 2], S.custo[r].n * falta, fundo + 1, para); if (f) return f; return sai('sintese'); }
        return sai('destruir');
      }
      if (DO_NPC[k]) { for (const [i, n] of Object.entries(DO_NPC[k].usa)) { const f = plano(i, n * falta, fundo + 1, nome(k)); if (f) return f; } return sai('npc:' + DO_NPC[k].npc); }
      const R = receitaItem(k); // feito por receita (o pão de milho do pack de abóbora, a parede): o que gasta, depois a estação
      if (R && !ehEquip(k)) { for (const [i, n] of Object.entries(R)) { const f = plano(i, n * falta, fundo + 1, para); if (f) return f; } return sai('receita'); }
      if (NA_LOJA.has(k)) return sai('loja');
      return sai(this.fonteDe(j, k));
    };
    for (const t of N.ferr || []) { const f = plano(t, 1); if (f) return f.fonte || f.pre ? f : null; }
    const daFerr = E.ev === 'criar' && FERR.has(String(E.k)) ? nome(E.k) : ''; // criar a ferramenta: o material vem do chão
    for (const [k, n] of Object.entries(N.usa || {})) { const f = plano(k, n, 0, daFerr); if (f) return f.fonte || f.pre ? f : null; } // item único sem fonte (catalisador da memória): o texto da etapa
    if (N.ouro && (p.ouro || 0) < N.ouro) return { k: 'ouro', n: N.ouro, tem: p.ouro || 0, fonte: 'ouro' };
    if (E.ev === 'pesca' && soNoMar(E.k)) return this.marAntes(j, !!E.barco, plano);
    return null;
  },
  // pesca no mar (André 2026-11-13: "tem que usar a ferramenta para localizar... aí vai de barquinho"): o barquinho
  // (criar, levar a um cais, pôr na água) e o radar ligado; null = pode pescar (o Ir leva ao spot)
  marAntes(j, jaNoBarco, plano) {
    const p = j.prog, naAgua = j.veiculo === 'barquinho' || j.veiculo === 'navio';
    if (!naAgua && !jaNoBarco) {
      if (contar(p.mochila, 'barquinho') < 1 && !p.navio?.chao) { const f = plano('barquinho', 1); if (f) return f; }
      if (!p.navio?.chao) {
        const c = this.caisMaisPerto(j);
        if (c && Math.hypot(c.x - j.x, c.z - j.z) > 14) return { pre: 'ir', txt: 'Leve o barquinho a um cais', alvo: c, guia: { ev: 'pos' } };
        return { pre: 'barco', txt: 'Ponha o barquinho na água', alvo: null, guia: { ev: 'veiculo', k: 'barco' } };
      }
    }
    if (!(j.radarAte > (this.tempo || 0))) return { pre: 'radar', txt: 'Use o Radar de pesca (mochila)', alvo: null, guia: { ev: 'veiculo', k: 'radar' } };
    return null;
  },
  // o cais aberto mais perto (pesca no mar)
  caisMaisPerto(j) {
    let b = null, md = Infinity;
    for (const o of LUGARES_MUNDO) if (o.tipo === 'porto' && !zonaFechadaEm(j.prog, o.x, o.z)) { const d = Math.hypot(o.x - j.x, o.z - j.z); if (d < md) { md = d; b = { x: Math.round(o.x * 100) / 100, z: Math.round(o.z * 100) / 100, nome: o.nome, npc: '' }; } }
    return b;
  },
  // a síntese da Mirela já foi ensinada (missão "A tinta das runas")?
  sinteseAberta(p) { const i = HISTORIA.findIndex((M) => M.id === 'c8'); return i >= 0 && (p.hist?.p || 0) >= i; },
  // a planta k na horta do jogador: 'madura' · 'seca' (precisa de água) · 'cresce' · '' (nada plantado)
  hortaDe(j, k) {
    const L = this.loteDe?.(j), agora = Date.now(); let st = '';
    for (const t of Object.values(L?.horta || {})) {
      if (t?.c !== k) continue;
      if (gAgora(t, agora) >= PLANTAS[k].G) return 'madura';
      st = !t.w || agora >= t.w + HORTA.rega * 3600000 ? 'seca' : st || 'cresce';
    }
    return st;
  },
  // pack: antes de fazer o próximo ou de levar de carrinho, o carrinho no chão, o pack das costas nele e subir nele
  antesDe(j, E) {
    const p = j.prog, c = p.carrinho, C = VEICULOS.carrinho;
    const deCarro = E.ev === 'pack' && E.de === 'carrinho';
    if (!c || !(E.ev === 'pack_fez' || deCarro)) return null;
    const noMundo = !!(c.chao || j.veiculo === 'carrinho'), pos = j.veiculo === 'carrinho' ? j : c.chao;
    const carro = pos && { x: Math.round(pos.x * 100) / 100, z: Math.round(pos.z * 100) / 100, nome: 'o seu carrinho', npc: '' };
    if (p.pack) {
      if (!noMundo) return contar(p.mochila, 'carrinho') > 0 ? { pre: 'colocar', txt: 'Ponha o carrinho no chão', alvo: null, guia: { ev: 'veiculo', k: 'colocar' } } : null;
      if (c.packs.length >= capacidadeCarrinho(c)) return null;
      if (Math.hypot(pos.x - j.x, pos.z - j.z) > C.carregar) return { pre: 'ir', txt: 'Leve o pack até o carrinho', alvo: carro, guia: { ev: 'pos' } };
      return { pre: 'por', txt: 'Ponha o pack no carrinho', alvo: null, guia: { ev: 'veiculo', k: 'por_pack' } };
    }
    if (deCarro && noMundo && j.veiculo !== 'carrinho' && c.packs.some((pk) => !E.k || pk.k === E.k)) {
      const n = (this.mapa?.npcs || []).find((o) => o.id === E.npc);
      if (n && Math.hypot(c.chao.x - n.x, c.chao.z - n.z) > C.entregar) {
        if (Math.hypot(c.chao.x - j.x, c.chao.z - j.z) > C.perto) return { pre: 'ir', txt: 'Volte ao carrinho', alvo: carro, guia: { ev: 'pos' } };
        return { pre: 'dirigir', txt: 'Suba no carrinho', alvo: null, guia: { ev: 'veiculo', k: 'dirigir' } };
      }
    }
    return null;
  },
  // a receita que dá o item faz está na etapa da vez: o nível da profissão não trava (servidor e app, hi.livre)
  livreHistoria(j, faz) {
    const p = j?.prog; if (!p?.hist?.ac || j.bot) return false;
    return pedidosDaEtapa(etapaAtual(p), p).has(String(faz));
  },
  fonteDe(j, k) {
    const p = j.prog;
    if (VEIO[k]) return contar(p.mochila, ferramentaDe(k)) > 0 || !['lenha', 'pedra'].includes(k) ? 'veio:' + VEIO[k] : 'solto';
    if (PEIXES.has(k)) return 'spot';
    if (PLANTAS[k]) return 'lote';
    // o campo de caça aberto mais perto cujo bicho derruba isso (sem passar muito do nível do herói)
    const bichos = Object.entries(DROPS).filter(([, d]) => d.mat?.[k]).map(([b]) => b);
    if (!bichos.length) return '';
    let b = null, md = Infinity;
    for (const c of CACA) {
      if (!bichos.includes(c.bicho) || c.nivel > (p.nivel || 1) + 3 || zonaFechadaEm(p, c.x, c.z)) continue;
      const d = Math.hypot(c.x - j.x, c.z - j.z); if (d < md) { md = d; b = c; }
    }
    return b ? 'caca:' + b.id : '';
  },
  // texto da etapa enquanto junta ("Barquinho: corte Lenha 12/30"); curto (André: textos do jogo bem curtos)
  textoJunta(E, f) {
    if (f.pre) return f.txt;
    const n = f.k === 'ouro' ? 'ouro' : nome(f.k), conta = f.n > 1 ? ` ${f.tem}/${f.n}` : '';
    const para = f.para || (E.ev === 'pack_fez' ? PACKS[E.k]?.nome : ['criar', 'construir'].includes(E.ev) ? nome(String(E.k).replace(/^obra_/, ''))
      : E.ev === 'falar' ? `Para ${this.nomeNpc ? this.nomeNpc(E.npc) : E.npc}` : '');
    const F = f.fonte;
    const txt = FERR.has(f.k) && F === 'receita' ? `crie ${n}`
      : F === 'cresce' ? `${n} crescendo${conta}` : F === 'regar' ? `regue a horta (${n})` : F === 'plantar' ? `plante ${n}`
      : F === 'loja' ? `compre ${n}${conta}` : F === 'destruir' ? `destrua peças por ${n}${conta}` : F === 'sintese' ? `faça ${n} com a Mirela`
      : F.startsWith('npc:') ? `faça ${n} com ${this.nomeNpc ? this.nomeNpc(F.slice(4)) : F.slice(4)}`
      : `${f.k === 'ouro' ? 'junte' : F === 'receita' ? 'faça' : F === 'forno' ? (f.k === 'carvao' ? 'faça no forninho' : 'funda no forninho')
        : F === 'veio:arvore' ? 'corte' : F.startsWith('veio:') ? 'minere' : F === 'solto' ? 'pegue do chão' : F.startsWith('caca:') ? 'cace para ter'
        : F === 'spot' ? 'pesque' : F === 'lote' ? 'colha' : 'junte'} ${n}${f.k === 'ouro' ? ` ${f.tem}/${f.n}` : conta}`;
    return `${para ? para + ': ' : ''}${txt}`;
  },
  // o tipo da etapa para o guia do app (guia.gd) enquanto junta: o Ir e o botão de coletar / pescar / o forninho
  guiaJunta(f) {
    if (f.pre) return f.guia;
    const F = f.fonte;
    if (F.startsWith('veio:')) return { ev: 'item', de: 'coleta', k: f.k };
    if (F === 'solto') return { ev: 'item', de: 'solto', k: f.k };
    if (F.startsWith('caca:')) return { ev: 'matar' };
    if (F === 'spot') return { ev: 'pesca', k: f.k };
    if (F === 'lote') return { ev: 'colher', k: f.k };
    if (F === 'plantar') return { ev: 'plantar', k: f.k };
    if (F === 'regar') return { ev: 'regar' };
    if (F === 'loja') return { ev: 'comprar', k: f.k };
    if (F === 'destruir') return { ev: 'destruir' };
    if (F === 'sintese') return { ev: 'sintetizar' };
    if (F.startsWith('npc:')) return DO_NPC[f.k]?.guia || { ev: 'ter' };
    if (F === 'forno' || F === 'receita') return { ev: 'criar', k: f.k };
    return { ev: 'ter' };
  },
};

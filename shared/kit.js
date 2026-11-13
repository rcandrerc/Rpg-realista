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
import { ITENS, COLETA, RECEITAS, CONSTRUCOES, FERRAMENTAS_FAZENDA, PACKS, CACA, LOJA, LOTE, PLANTAS, PESCA, DROPS } from './dados.js';
import { contar, guardar, nomeItem, ehEquip, reforcoMax } from './progresso.js';
import { missaoAtual, etapaAtual, zonaFechadaEm } from './historia.js';
import { custoPack } from './transporte.js';
import { Leilao } from './leilao.js';

export const KIT = {
  ateNivel: 12, // ferramenta da etapa de graça só nas missões do comecinho (Ato I até o Nv 12)
  peca: 'botas', // a peça que o NPC dá para destruir, evoluir ou reforçar
  leilao: 20, // ouro que o Otávio deixa na caixa para o primeiro "retirar" (senão era esperar 24 h alguém comprar)
};

// de onde vem cada material (o Ir da etapa de juntar leva para lá)
const VEIO = { lenha: 'arvore', pedra: 'pedra', minerio_cobre: 'cobre', minerio_ferro: 'ferro', cristal: 'cristal' };
const FORJA = ['barra_cobre', 'barra_ferro', 'barra_aco', 'carvao']; // sai do forninho (do minério / da lenha)
const PEIXES = new Set(Object.keys(PESCA.tier || {}));
// o que se cria e o que gasta, para n vezes
export function receitaDe(k) {
  if (!k) return null;
  if (FERRAMENTAS_FAZENDA[k]) return { usa: FERRAMENTAS_FAZENDA[k].custo, ouro: FERRAMENTAS_FAZENDA[k].ouro || 0 };
  const c = CONSTRUCOES[String(k).replace(/^obra_/, '')]; if (c?.custo) return { usa: c.custo, ouro: 0 };
  const r = RECEITAS[k] || Object.values(RECEITAS).find((o) => o.faz === k); if (r?.usa) return { usa: r.usa, ouro: 0 };
  return null;
}
const nome = (k) => ITENS[k]?.nome || k;
const receitaQueFaz = (k) => RECEITAS[k]?.faz === k ? RECEITAS[k] : Object.values(RECEITAS).find((o) => o.faz === k && !o.r) || null;
// tudo que a etapa da vez pede para criar, até o fim da cadeia (barra de aço -> barra de ferro, carvão): o nível da
// profissão não trava a missão (André 2026-11-12: "não quero ficar descobrindo erro atrás de erro")
export function pedidosDaEtapa(E, p) {
  const out = new Set();
  if (!E) return out;
  const raiz = E.ev === 'criar' ? [String(E.k)] : E.ev === 'ter' ? Object.keys(E.itens || {}) : E.ev === 'pack_fez' && PACKS[E.k] ? Object.keys(custoPack(E.k, p?.prof?.mer)) : [];
  const ver = (k, fundo) => { const R = receitaQueFaz(k); if (!R || out.has(k) || fundo > 4) return; out.add(k); for (const i of Object.keys(R.usa || {})) ver(i, fundo + 1); };
  for (const k of raiz) ver(k, 0);
  return out;
}
const ferramentaDe = (k) => (VEIO[k] ? COLETA[VEIO[k]]?.ferramenta : null);

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
  // ---------- 2. junta: o que falta para criar / construir / fazer o pack, e de onde vem ----------
  // Devolve null (tem tudo) ou { k, n, tem, fonte } do primeiro material que falta, na ordem da receita. fonte:
  // 'veio:tipo' · 'solto' (galho e pedrinha, sem machado/picareta) · 'caca:id' · 'spot' · 'lote' · 'forno' · '' (junte)
  juntaDe(j, E = etapaAtual(j.prog)) {
    const p = j.prog, h = p.hist;
    if (!E || E.junta === false || !['criar', 'construir', 'pack_fez', 'ter'].includes(E.ev)) return null;
    if (E.ja === 'tem' && contar(p.mochila, E.k) > 0) return null;
    const vezes = Math.max(1, (E.n || 1) - (h?.n || 0));
    // ter (leve 3 ensopados na mochila): o que falta, com a cadeia da receita (carne, batata... e o fogão)
    const R = E.ev === 'ter' ? { usa: E.itens || {}, ouro: 0 } : E.ev === 'pack_fez' ? (PACKS[E.k] ? { usa: custoPack(E.k, p.prof.mer), ouro: 0 } : null) : receitaDe(E.k);
    if (!R) return null;
    const usado = {}; // o que já foi contado para outra parte da receita (a lenha da barra e a do carrinho)
    const plano = (k, q, fundo = 0) => {
      const livre = Math.max(0, contar(p.mochila, k) - (usado[k] || 0));
      usado[k] = (usado[k] || 0) + Math.min(livre, q);
      if (livre >= q) return null;
      const falta = q - livre;
      if (FORJA.includes(k) && fundo < 3) { // barra / carvão: primeiro o que ela gasta, depois o forninho
        const Rr = RECEITAS[k];
        for (const [i, n] of Object.entries(Rr?.usa || {})) { const f = plano(i, n * falta, fundo + 1); if (f) return f; }
        return { k, n: q, tem: livre, fonte: 'forno' };
      }
      const Rc = receitaQueFaz(k); // feito por receita (o pão de milho do pack de abóbora): o que ela gasta, depois a estação
      if (Rc && !ehEquip(k) && fundo < 3) {
        for (const [i, n] of Object.entries(Rc.usa || {})) { const f = plano(i, n * falta, fundo + 1); if (f) return f; }
        return { k, n: q, tem: livre, fonte: 'receita' };
      }
      return { k, n: q, tem: livre, fonte: this.fonteDe(j, k) };
    };
    for (const [k, n] of Object.entries(R.usa)) { const f = plano(k, n * vezes); if (f) return E.ev === 'ter' && !f.fonte ? null : f; } // ter de item único (catalisador): o texto da etapa
    if (R.ouro && (p.ouro || 0) < R.ouro) return { k: 'ouro', n: R.ouro, tem: p.ouro || 0, fonte: '' };
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
  // texto da etapa enquanto junta ("Barquinho: corte Lenha 12/30")
  textoJunta(E, f) {
    const verbo = f.k === 'ouro' ? 'junte' : f.fonte === 'receita' ? 'faça' : f.fonte === 'forno' ? (f.k === 'carvao' ? 'faça no forninho' : 'funda no forninho')
      : f.fonte === 'veio:arvore' ? 'corte' : f.fonte.startsWith('veio:') ? 'minere' : f.fonte === 'solto' ? 'pegue do chão' : f.fonte.startsWith('caca:') ? 'cace para ter'
      : f.fonte === 'spot' ? 'pesque' : f.fonte === 'lote' ? 'colha' : 'junte';
    const para = E.ev === 'ter' ? '' : E.ev === 'pack_fez' ? PACKS[E.k]?.nome : nome(String(E.k).replace(/^obra_/, ''));
    return `${para ? para + ': ' : ''}${verbo} ${f.k === 'ouro' ? 'ouro' : nome(f.k)} ${f.tem}/${f.n}`;
  },
  // o tipo da etapa para o guia do app (guia.gd) enquanto junta: o Ir e o botão de coletar / pescar / o forninho
  guiaJunta(f) {
    if (f.fonte.startsWith('veio:')) return { ev: 'item', de: 'coleta', k: f.k };
    if (f.fonte === 'solto') return { ev: 'item', de: 'solto', k: f.k };
    if (f.fonte.startsWith('caca:')) return { ev: 'matar' };
    if (f.fonte === 'spot') return { ev: 'pesca', k: f.k };
    if (f.fonte === 'lote') return { ev: 'colher', k: f.k };
    if (f.fonte === 'forno' || f.fonte === 'receita') return { ev: 'criar', k: f.k };
    return { ev: 'ter' };
  },
};

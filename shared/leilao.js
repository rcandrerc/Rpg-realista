// A Casa do Comércio (história v2, Entrega 3; plano aprovado pelo André 2026-11-11): o leilão entre jogadores, com o
// Otávio, o leiloeiro, na Vila do Rio Claro. Um só para o mundo inteiro: o servidor (server/index.js) cria um Leilao,
// todas as salas usam o mesmo e ele fica guardado no banco (tabela mundo, chave 'leilao'). Quem confere tudo é a
// Simulacao (shared/simulacao.js leilao): perto do Otávio, item da mochila, cadeado, ouro, lugar na mochila.
// Regras (o plano): até 10 anúncios por conta, prazo de 24 ou 48 horas, taxa de 5% na venda (as 3 primeiras vendas de
// cada conta sem taxa: presente do capítulo 9), o ouro das vendas e os itens vencidos ou cancelados ficam guardados
// com o Otávio para retirar. Item com cadeado não vai à venda. A casa põe alguns itens comuns à venda (nunca acabam),
// para o leilão nunca ficar vazio.
import { ITENS } from './dados.js';
import { ehEquip, itemValido, precoVenda, nomeItem } from './progresso.js';

export const LEILAO = {
  distancia: 4.5, // m do Otávio
  max: 10, // anúncios por conta ao mesmo tempo
  horas: [24, 48],
  taxa: 0.05,
  semTaxa: 3, // as primeiras vendas de cada conta saem sem taxa
  precoMax: 99999999,
  lista: 60, // quantos anúncios o app recebe de uma vez (os mais baratos do filtro)
  caixaMax: 60, // itens guardados com o Otávio por conta (passou disso, o anúncio não vence: espera retirar)
  // os anúncios da casa: material comum e poção, a 4x o que a loja paga (o jogador que vende mais barato ganha)
  casa: [['minerio_cobre', 20], ['minerio_ferro', 20], ['carvao', 20], ['couro', 10], ['tecido', 10], ['barra_ferro', 5], ['pocao', 5], ['pocao_mana', 5]],
  casaVezes: 4,
  // André 2026-11-21 (bots no leilão): taxa de anúncio (sai do ouro de quem anuncia, some do jogo como a de venda)
  taxaAnuncio: 0.02,
  // preço de mercado de cada item (chaveMercado), como num MMO: começa em base x o que a loja paga; cada venda puxa o
  // preço para o que pagaram (ema) e venda rápida (em menos de rapido h) sobe mais sobeRapido; sem venda, cai caiDia por
  // dia depois do primeiro; anúncio que venceu sem vender derruba venceu. m fica entre min e max.
  mercado: { base: 3, ema: 0.3, rapido: 6, sobeRapido: 0.06, caiDia: 0.03, venceu: 0.06, min: 0.4, max: 8 },
  // inflação: o ouro médio de quem usou o leilão (jogadores e bots, visto nos últimos dias) sobre ref; o preço de referência
  // (e o da casa) vai junto, de 1x até max (raiz: dobrar o ouro do mundo encarece uns 40%)
  inflacao: { ref: 3000, max: 8, dias: 14 },
  // André 2026-11-24: o que a casa vende sem acabar DOBRA de preço a cada compra ("é para quem está desesperado e não
  // quer esperar"; o comércio de verdade é entre jogadores e bots). Por conta (cada jogador ou bot tem o seu preço); a
  // conta esquece uma compra a cada desceHoras (contínuo). 1 compra = 2x, 2 = 4x, 5 = 32x, 10 = 1024x; volta ao
  // normal em 2 h por compra (de 10 compras, 20 h).
  casaSobe: { sobe: 2, desceHoras: 2, max: 1024 },
  // André 2026-11-24 (aprovado: "tirar o estoque da casa aos poucos"): enquanto houver anúncio de bot ou jogador do mesmo
  // item, a casa esconde o dela; ela volta quando o item fica `horas` sem nenhum anúncio (ninguém fica travado sem ferro)
  casaSome: { horas: 24 },
};
// a busca por parte do nome: sem maiúscula e sem acento ("ferro" acha "Minério de Ferro", "minerio" também)
export const semAcento = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
// os tipos da busca: peça (com raridade), material, comida, Tomo e o resto
export const TIPOS_LEILAO = { equip: 'Peças', mat: 'Materiais', comida: 'Comida e poção', tomo: 'Tomos', outro: 'Outros' };
export function tipoLeilao(it) {
  if (ehEquip(it.k)) return 'equip';
  if (it.k === 'tomo') return 'tomo';
  const D = ITENS[it.k] || {};
  if (D.comida || D.usar?.vida || D.usar?.mana) return 'comida';
  if (D.mat) return 'mat';
  return 'outro';
}
const HORA = 3600 * 1000, DIA_MS = 24 * HORA;
// o mesmo item no mercado: peça por tipo e raridade, Tomo por habilidade e nível, o resto pelo tipo
export function chaveMercado(it) {
  if (ehEquip(it.k)) return `${it.k}:${it.r | 0}`;
  if (it.k === 'tomo') return `tomo:${it.h}:${it.nv}`;
  return it.k;
}
// o preço de partida de UMA unidade (peça com reforço vale mais: +15% por +1)
export const baseMercado = (it) => Math.max(1, precoVenda({ ...it, n: 1 }) * LEILAO.mercado.base * (ehEquip(it.k) ? 1 + 0.15 * (it.e | 0) : 1));

export class Leilao {
  constructor(salvo) {
    const s = salvo && typeof salvo === 'object' ? salvo : {};
    this.anuncios = Array.isArray(s.anuncios) ? s.anuncios.filter((a) => a && itemValido(a.item)) : [];
    this.caixa = s.caixa && typeof s.caixa === 'object' ? s.caixa : {}; // conta -> { ouro, itens: [] }
    this.vendas = s.vendas && typeof s.vendas === 'object' ? s.vendas : {}; // conta -> vendas feitas (taxa)
    this.seq = Number.isInteger(s.seq) ? s.seq : 1;
    const obj = (o) => (o && typeof o === 'object' && !Array.isArray(o) ? o : {});
    this.mercado = obj(s.mercado); // chave -> { m, t }: o preço de mercado (m x base x inflação) e a última mexida
    this.ouros = obj(s.ouros); // conta -> { o, t }: o ouro de quem usou o leilão (a inflação)
    this.casaVisto = obj(s.casaVisto); // item -> última vez (ms) que havia anúncio dele (a casa some até passar casaSome.horas)
    this.casaCompras = obj(s.casaCompras); // conta -> { id do anúncio da casa: { c, t } }: compras recentes (preço sobe)
    this.casa = LEILAO.casa.filter(([k]) => ITENS[k]).map(([k, n], i) => ({ id: 'casa' + i, conta: 'casa', vendedor: 'Casa do Comércio', item: { k, n },
      preco: precoVenda({ k, n: 1 }) * n * LEILAO.casaVezes, ate: 0, casa: true }));
    this.precoCasa();
  }
  estado() { return { anuncios: this.anuncios, caixa: this.caixa, vendas: this.vendas, seq: this.seq, mercado: this.mercado, ouros: this.ouros, casaCompras: this.casaCompras, casaVisto: this.casaVisto }; }
  // ---------- o mercado (André 2026-11-21: "flutuação de acordo com o mercado... inflação do jogo") ----------
  verOuro(conta, ouro, agora = Date.now()) { if (conta != null && Number.isFinite(ouro)) this.ouros[conta] = { o: Math.max(0, Math.round(ouro)), t: agora }; }
  inflacao(agora = Date.now()) {
    const I = LEILAO.inflacao, l = Object.values(this.ouros).filter((v) => v && agora - v.t < I.dias * DIA_MS);
    if (!l.length) return 1;
    const media = l.reduce((s, v) => s + v.o, 0) / l.length;
    return Math.min(I.max, Math.max(1, Math.sqrt(media / I.ref)));
  }
  // m de agora (com a queda dos dias sem venda) de uma chave
  mDe(chave, agora = Date.now()) {
    const M = LEILAO.mercado, x = this.mercado[chave]; if (!x) return 1;
    const dias = Math.max(0, (agora - x.t) / DIA_MS - 1);
    return Math.min(M.max, Math.max(M.min, x.m * (1 - M.caiDia) ** dias));
  }
  // preço de mercado de UMA unidade agora
  precoMercado(it, agora = Date.now()) { return Math.max(1, Math.round(baseMercado(it) * this.mDe(chaveMercado(it), agora) * this.inflacao(agora))); }
  // vendeu: o preço puxa para o que pagaram; venda rápida sobe mais
  vendeuMercado(a, agora = Date.now()) {
    const M = LEILAO.mercado, c = chaveMercado(a.item), m0 = this.mDe(c, agora);
    const pago = a.preco / Math.max(1, a.item.n || 1) / (baseMercado(a.item) * this.inflacao(agora));
    let m = m0 + M.ema * (pago - m0);
    if (a.t && agora - a.t < M.rapido * HORA) m *= 1 + M.sobeRapido;
    this.mercado[c] = { m: +Math.min(M.max, Math.max(M.min, m)).toFixed(4), t: agora };
  }
  // anúncio que venceu sem vender: o preço cai
  encalhouMercado(a, agora = Date.now()) {
    const M = LEILAO.mercado, c = chaveMercado(a.item);
    this.mercado[c] = { m: +Math.max(M.min, this.mDe(c, agora) * (1 - M.venceu)).toFixed(4), t: agora };
  }
  // a casa acompanha a inflação (4x o que a loja paga, vezes a inflação)
  precoCasa(agora = Date.now()) { const f = this.inflacao(agora); for (const a of this.casa) a.preco = Math.round(precoVenda({ ...a.item, n: 1 }) * a.item.n * LEILAO.casaVezes * f); }
  // ---------- a casa encarece a cada compra (André 2026-11-24: "cada vez que comprar vai ficando bem mais caro") ----------
  // compras que a conta ainda "deve" a esse anúncio da casa (cai 1 a cada desceHoras)
  comprasCasa(conta, id, agora = Date.now()) {
    const x = this.casaCompras[conta]?.[id]; if (!x) return 0;
    return Math.max(0, x.c - (agora - x.t) / (LEILAO.casaSobe.desceHoras * HORA));
  }
  fatorCasa(conta, id, agora = Date.now()) { const S = LEILAO.casaSobe; return Math.min(S.max, S.sobe ** this.comprasCasa(conta, id, agora)); }
  // o anúncio da casa com o preço DESSA conta (cópia; o da lista fica no preço normal). volta: ms até voltar ao normal
  // a casa está escondida para esse item? (há anúncio dele agora, ou houve há menos de casaSome.horas)
  casaEscondida(k, agora = Date.now()) {
    if (this.anuncios.some((a) => a.item.k === k && !(a.ate && a.ate <= agora))) { this.casaVisto[k] = agora; return true; }
    const t = this.casaVisto[k]; if (!t) return false;
    if (agora - t < LEILAO.casaSome.horas * HORA) return true;
    delete this.casaVisto[k]; return false;
  }
  // quantos anúncios (de bot ou jogador) desse item estão no leilão
  anunciosDe(k, agora = Date.now()) { return this.anuncios.filter((a) => a.item.k === k && !(a.ate && a.ate <= agora)).length; }
  casaPara(conta, agora = Date.now()) {
    return this.casa.filter((a) => !this.casaEscondida(a.item.k, agora)).map((a) => {
      const c = this.comprasCasa(conta, a.id, agora); if (c <= 0) return a;
      return { ...a, preco: Math.round(a.preco * this.fatorCasa(conta, a.id, agora)), base: a.preco, volta: Math.round(c * LEILAO.casaSobe.desceHoras * HORA) };
    });
  }
  comprouCasa(conta, id, agora = Date.now()) {
    const cc = (this.casaCompras[conta] ||= {});
    cc[id] = { c: +(this.comprasCasa(conta, id, agora) + 1).toFixed(4), t: agora };
    // limpa quem já voltou ao normal (o save não cresce)
    for (const [c, l] of Object.entries(this.casaCompras)) { for (const i of Object.keys(l)) if (this.comprasCasa(c, i, agora) <= 0) delete l[i]; if (!Object.keys(l).length) delete this.casaCompras[c]; }
  }
  taxaAnuncio(preco) { return Math.max(1, Math.ceil(preco * LEILAO.taxaAnuncio)); }
  caixaDe(conta) { return (this.caixa[conta] ||= { ouro: 0, itens: [] }); }
  semTaxaDe(conta) { return Math.max(0, LEILAO.semTaxa - (this.vendas[conta] || 0)); }
  meus(conta) { return this.anuncios.filter((a) => a.conta === conta); }
  // anúncios vencidos: o item volta para a caixa do dono (se a caixa estiver cheia, espera). Devolve true se mudou.
  vencer(agora = Date.now()) {
    let mudou = false;
    for (let i = this.anuncios.length - 1; i >= 0; i--) {
      const a = this.anuncios[i];
      if (a.ate > agora) continue;
      const cx = this.caixaDe(a.conta);
      if (cx.itens.length >= LEILAO.caixaMax) continue;
      cx.itens.push(a.item); this.anuncios.splice(i, 1); mudou = true;
      this.encalhouMercado(a, agora);
    }
    return mudou;
  }
  // põe um item à venda (o item já saiu da mochila); devolve o anúncio ou o texto do erro
  anunciar(conta, vendedor, item, preco, horas, agora = Date.now()) {
    if (!LEILAO.horas.includes(horas)) return 'Prazo de 24 ou 48 horas';
    if (!Number.isInteger(preco) || preco < 1 || preco > LEILAO.precoMax) return 'Preço inválido';
    if (this.meus(conta).length >= LEILAO.max) return `Você já tem ${LEILAO.max} anúncios. Espere vender ou cancele um`;
    const a = { id: 'l' + this.seq++, conta, vendedor: String(vendedor).slice(0, 32), item, preco, ate: agora + horas * HORA, t: agora };
    this.anuncios.push(a);
    return a;
  }
  // conta: quem vai comprar (o anúncio da casa vem com o preço dela, que sobe a cada compra)
  achar(id, conta) {
    if (/^casa/.test(id)) { this.precoCasa(); return (conta != null ? this.casaPara(conta) : this.casa).find((a) => a.id === id) || null; }
    return this.anuncios.find((a) => a.id === id) || null;
  }
  // compra: tira o anúncio (os da casa ficam) e põe o ouro na caixa do vendedor, menos a taxa. { anuncio, liquido, taxa }
  comprar(id, conta) {
    const a = this.achar(id, conta); if (!a) return 'Esse anúncio já saiu';
    if (a.conta === conta) return 'Esse anúncio é seu. Para tirar, use Cancelar';
    if (a.casa) { this.comprouCasa(conta, a.id); return { anuncio: a, liquido: 0, taxa: 0 }; }
    const livre = this.semTaxaDe(a.conta) > 0, taxa = livre ? 0 : Math.ceil(a.preco * LEILAO.taxa), liquido = a.preco - taxa;
    this.anuncios.splice(this.anuncios.indexOf(a), 1);
    this.caixaDe(a.conta).ouro += liquido;
    this.vendas[a.conta] = (this.vendas[a.conta] || 0) + 1;
    this.vendeuMercado(a);
    return { anuncio: a, liquido, taxa };
  }
  // tira o anúncio (o item vai para a caixa do dono, ou direto para a mochila: quem chama decide)
  cancelar(id, conta) {
    const a = this.anuncios.find((o) => o.id === id); if (!a || a.conta !== conta) return 'Esse anúncio não é seu';
    this.anuncios.splice(this.anuncios.indexOf(a), 1);
    return a;
  }
  // a busca: tipo (equip, mat, comida, tomo, outro), raridade (só peças), ordem ('barato' | 'caro' | 'novo')
  // texto: parte do nome (sem acento/maiúscula); ks: itens cujo nome no idioma do app tem o texto (o app manda)
  buscar({ tipo, r, ordem, texto, ks } = {}, conta) {
    this.precoCasa();
    let l = [...this.casaPara(conta), ...this.anuncios].filter((a) => a.conta !== conta);
    if (tipo && TIPOS_LEILAO[tipo]) l = l.filter((a) => tipoLeilao(a.item) === tipo);
    if (Number.isInteger(r)) l = l.filter((a) => ehEquip(a.item.k) && (a.item.r || 0) === r);
    if (typeof texto === 'string' && semAcento(texto)) {
      const t = semAcento(texto), outros = new Set(Array.isArray(ks) ? ks.filter((k) => typeof k === 'string') : []);
      l = l.filter((a) => semAcento(nomeItem(a.item)).includes(t) || outros.has(a.item.k));
    }
    if (ordem === 'novo') l.sort((a, b) => (b.t || 0) - (a.t || 0));
    else l.sort((a, b) => (ordem === 'caro' ? b.preco - a.preco : a.preco - b.preco));
    return l.slice(0, LEILAO.lista);
  }
}
// o que vai para o app (sem a conta de quem vende)
export const anuncioParaApp = (a) => ({ id: a.id, vendedor: a.vendedor, item: a.item, preco: a.preco, ate: a.ate, ...(a.casa ? { casa: true } : {}),
  ...(a.base ? { base: a.base, volta: a.volta } : {}) }); // base/volta: a casa encareceu para ele (preço normal e ms até voltar)

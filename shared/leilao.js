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
};
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
const HORA = 3600 * 1000;

export class Leilao {
  constructor(salvo) {
    const s = salvo && typeof salvo === 'object' ? salvo : {};
    this.anuncios = Array.isArray(s.anuncios) ? s.anuncios.filter((a) => a && itemValido(a.item)) : [];
    this.caixa = s.caixa && typeof s.caixa === 'object' ? s.caixa : {}; // conta -> { ouro, itens: [] }
    this.vendas = s.vendas && typeof s.vendas === 'object' ? s.vendas : {}; // conta -> vendas feitas (taxa)
    this.seq = Number.isInteger(s.seq) ? s.seq : 1;
    this.casa = LEILAO.casa.filter(([k]) => ITENS[k]).map(([k, n], i) => ({ id: 'casa' + i, conta: 'casa', vendedor: 'Casa do Comércio', item: { k, n },
      preco: precoVenda({ k, n: 1 }) * n * LEILAO.casaVezes, ate: 0, casa: true }));
  }
  estado() { return { anuncios: this.anuncios, caixa: this.caixa, vendas: this.vendas, seq: this.seq }; }
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
  achar(id) { return this.anuncios.find((a) => a.id === id) || this.casa.find((a) => a.id === id) || null; }
  // compra: tira o anúncio (os da casa ficam) e põe o ouro na caixa do vendedor, menos a taxa. { anuncio, liquido, taxa }
  comprar(id, conta) {
    const a = this.achar(id); if (!a) return 'Esse anúncio já saiu';
    if (a.conta === conta) return 'Esse anúncio é seu. Para tirar, use Cancelar';
    if (a.casa) return { anuncio: a, liquido: 0, taxa: 0 };
    const livre = this.semTaxaDe(a.conta) > 0, taxa = livre ? 0 : Math.ceil(a.preco * LEILAO.taxa), liquido = a.preco - taxa;
    this.anuncios.splice(this.anuncios.indexOf(a), 1);
    this.caixaDe(a.conta).ouro += liquido;
    this.vendas[a.conta] = (this.vendas[a.conta] || 0) + 1;
    return { anuncio: a, liquido, taxa };
  }
  // tira o anúncio (o item vai para a caixa do dono, ou direto para a mochila: quem chama decide)
  cancelar(id, conta) {
    const a = this.anuncios.find((o) => o.id === id); if (!a || a.conta !== conta) return 'Esse anúncio não é seu';
    this.anuncios.splice(this.anuncios.indexOf(a), 1);
    return a;
  }
  // a busca: tipo (equip, mat, comida, tomo, outro), raridade (só peças), ordem ('barato' | 'caro' | 'novo')
  buscar({ tipo, r, ordem, texto } = {}, conta) {
    let l = [...this.casa, ...this.anuncios].filter((a) => a.conta !== conta);
    if (tipo && TIPOS_LEILAO[tipo]) l = l.filter((a) => tipoLeilao(a.item) === tipo);
    if (Number.isInteger(r)) l = l.filter((a) => ehEquip(a.item.k) && (a.item.r || 0) === r);
    if (typeof texto === 'string' && texto.trim()) { const t = texto.trim().toLowerCase(); l = l.filter((a) => nomeItem(a.item).toLowerCase().includes(t)); }
    if (ordem === 'novo') l.sort((a, b) => (b.t || 0) - (a.t || 0));
    else l.sort((a, b) => (ordem === 'caro' ? b.preco - a.preco : a.preco - b.preco));
    return l.slice(0, LEILAO.lista);
  }
}
// o que vai para o app (sem a conta de quem vende)
export const anuncioParaApp = (a) => ({ id: a.id, vendedor: a.vendedor, item: a.item, preco: a.preco, ate: a.ate, ...(a.casa ? { casa: true } : {}) });

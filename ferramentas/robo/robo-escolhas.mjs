// Escolhas do robô de testes que dá para conferir sem servidor (ferramentas/testes/robo-escolhas.mjs): o que vender
// com a mochila cheia. O robo.mjs usa estas funções no turno.
import { ITENS, ehEquip } from '../../shared/index.js';

export const POCOES = ['pocao', 'pocao_mana'];

// Ronda 2026-11-19: toda pilha de poção ficava guardada. Caçando Puglins o dia inteiro, as poções que caem encheram a
// mochila de pilhas de 20: tudo protegido, nada para vender, 22 mil avisos "Mochila cheia" e nenhuma venda no turno.
// Agora fica só a pilha maior de cada poção (a de vida é a que ele toma na luta); as outras pilhas vão para a venda.
export function pocoesQueFicam(m) {
  const fica = new Set();
  for (const k of POCOES) {
    let b = -1;
    m.forEach((o, i) => { if (o && o.k === k && !o.cad && (b < 0 || (o.n || 1) > (m[b].n || 1))) b = i; });
    if (b >= 0) fica.add(b);
  }
  return fica;
}

// Lugares da mochila para vender. protegido(o): o que nunca vende (cadeado, ferramentas, veículos, o item da etapa).
// Vende as peças de equipamento, as pilhas repetidas e as poções além da pilha maior; se ainda sobrar pouco lugar,
// também as pilhas mais baratas.
export function listaVenda(m, protegido) {
  const vistos = new Set(), l = [], fica = pocoesQueFicam(m);
  m.forEach((o, i) => {
    if (protegido(o) || fica.has(i)) return;
    if (ehEquip(o.k) || vistos.has(o.k) || POCOES.includes(o.k)) l.push(i); else vistos.add(o.k);
  });
  if (m.filter((o) => !o).length + l.length < 4) {
    const resto = m.map((o, i) => [o, i]).filter(([o, i]) => o && !protegido(o) && !fica.has(i) && !l.includes(i)).sort((a, b) => (ITENS[a[0].k]?.venda || 0) - (ITENS[b[0].k]?.venda || 0));
    for (const [, i] of resto.slice(0, 6)) l.push(i);
  }
  return l;
}

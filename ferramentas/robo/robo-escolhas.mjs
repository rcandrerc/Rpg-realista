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

// Ronda 2026-11-24: numa noite o robô morreu 175 vezes na guerra (os Lobos da Geada o pegavam caçando, ele levantava na
// vila e voltava para o mesmo campo). Campo onde ele morreu MORTES_TROCA vezes nos últimos 10 min fica de fora neste
// turno e ele escolhe outro, como já faz com o campo sem XP. mortes = [{ t, campo }] (t em ms, campo = nome).
export const MORTES_TROCA = 3;
export function campoPerigoso(mortes, campo, agora, janela = 10 * 60e3) {
  if (!campo) return false;
  return mortes.filter((m) => m.campo === campo && agora - m.t < janela).length >= MORTES_TROCA;
}

// Ronda 2026-11-24: o merge do Ato do Clã pôs 4 missões (k1-k4) no meio da lista com o turno do robô andando. O servidor
// achou a conta pela última entregue (hist.u) e a e3 passou da posição 51 para a 55; o robô, com a lista velha do turno,
// leu a 55 como e6, contou "missão feita" e foi caçar para o Nv 92. Lista do robô diferente da do servidor: a última
// entregue (u) não é a que vem antes da missão da vez. H = HISTORIA do robô, h = prog.hist do servidor.
export function listaMudou(H, h) {
  return !!h && (h.p | 0) > 0 && typeof h.u === 'string' && H[h.p - 1]?.id !== h.u;
}

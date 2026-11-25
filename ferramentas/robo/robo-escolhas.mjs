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

// Ronda 2026-11-25: o robô 1 passou o dia no Nv 74. Ele só caçava na terra em que estava (Vael, campo máximo Nv 48: o mar
// separa Vael, a Ilha do Meio e a Aurora, e a pé a rota não atravessa), e a curva do #891 pede 135 mil XP para o Nv 75
// com bicho Nv 47-48 dando 3 a 5 de XP. A Aurora (Nv 66-100) já estava aberta para ele. Agora, sem campo do nível na
// terra dele, ele vai de totem para a terra onde tem (o totem de lá já visitado, como o jogador), e volta de totem quando
// a missão é na outra terra.
// A terra do campo vem do nome ("(Ilha do Meio)", "(Aurora)"); a de um ponto, do campo (sem boss) mais perto dele.
export const terraDoCampo = (c) => (/\(Ilha/.test(c?.nome || '') ? 'ilha' : /\(Aurora/.test(c?.nome || '') ? 'aurora' : 'vael');
export function terraEm(campos, x, z) {
  let b = null, md = Infinity;
  for (const c of campos) { if (c.boss) continue; const d = Math.hypot(c.x - x, c.z - z); if (d < md) { md = d; b = c; } }
  return b ? terraDoCampo(b) : 'vael';
}
// só viaja para caçar se o campo de lá for pelo menos GANHO_OUTRA_TERRA níveis mais forte que o melhor da terra dele
export const GANHO_OUTRA_TERRA = 6;
// O totem para chegar à terra: visitado (p.totens), aberto (fechado(t) = névoa) e o mais perto do ponto (o campo, o alvo da
// missão). null se a terra não tem totem que ele possa usar (aí só de barco: Ilha de barquinho, Aurora de navio).
export function totemDaTerra(totens, campos, terra, visitados, fechado, x, z) {
  return totens.filter((t) => visitados.includes(t.id) && !fechado(t) && terraEm(campos, t.x, t.z) === terra)
    .sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))[0] || null;
}
// A outra terra para caçar: o campo mais forte que ele aguenta (ok(c): nível até o dele, aberto, fora das grutas) numa terra
// com totem que ele pode usar, GANHO_OUTRA_TERRA níveis acima do melhor da terra dele. { terra, campo, totem } ou null; e,
// sem totem, a terra que teria campo melhor (semTotem) para o relatório dizer o que falta.
export function outraTerraParaCacar({ minha, campos, totens, visitados, ok, fechado }) {
  const melhor = (terra) => campos.filter((c) => ok(c) && terraDoCampo(c) === terra).sort((a, b) => (b.nivel || 1) - (a.nivel || 1))[0] || null;
  const aqui = melhor(minha), base = aqui ? (aqui.nivel || 1) : 0;
  let r = null, semTotem = null;
  for (const terra of ['vael', 'ilha', 'aurora']) {
    if (terra === minha) continue;
    const c = melhor(terra); if (!c || (c.nivel || 1) < base + GANHO_OUTRA_TERRA) continue;
    const t = totemDaTerra(totens, campos, terra, visitados, fechado, c.x, c.z);
    if (!t) { if (!semTotem || (c.nivel || 1) > (semTotem.campo.nivel || 1)) semTotem = { terra, campo: c }; continue; }
    if (!r || (c.nivel || 1) > (r.campo.nivel || 1)) r = { terra, campo: c, totem: t };
  }
  return r || (semTotem ? { semTotem: true, ...semTotem } : null);
}

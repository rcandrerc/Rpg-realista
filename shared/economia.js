// Livro-caixa da economia (André 2026-11-16: "pode começar a medição"): soma o ouro que entra e sai por fonte, por
// faixa de nível e por dia (fuso de Brasília), mais os abates e o tempo de jogo de cada faixa, para medir o ouro por
// hora de verdade e reajustar os preços (estudo em claude.ai/artifact/UWEQY9d7iWXwipr7pdXYKd). Sem nome de jogador:
// só totais. O robô de testes conta à parte ("robo"). O servidor junta as salas (aoCaixa) e mostra em /economia.
//
// caixa(j, fonte, v): v > 0 entrou, v < 0 saiu. O que mudar o ouro sem passar por caixa() aparece como "outros" (a
// conferência de passoCaixa compara o ouro com o último visto), então nada fica de fora da soma.
export const CAIXA = { faixa: 10, fuso: -3, conferir: 5, dias: 30 };
export const diaCaixa = (agora = Date.now()) => new Date(agora + CAIXA.fuso * 3600e3).toISOString().slice(0, 10);
export const faixaCaixa = (nv) => { const a = Math.floor(Math.max(0, (nv | 0) - 1) / CAIXA.faixa) * CAIXA.faixa + 1; return `${a}-${a + CAIXA.faixa - 1}`; };
// junta um lançamento num livro { dia: { quem: { faixa: { e, s, abates, seg, contas } } } } (o servidor usa a mesma)
export function lancarCaixa(livro, l) {
  const d = (livro[l.dia] ||= {}), q = (d[l.quem] ||= {}), f = (q[l.faixa] ||= { e: {}, s: {}, abates: 0, seg: 0, ouroSeg: 0, contas: {} });
  if (l.fonte) { const lado = l.v >= 0 ? f.e : f.s; lado[l.fonte] = (lado[l.fonte] || 0) + Math.abs(l.v); }
  if (l.abates) f.abates += l.abates;
  if (l.seg) { f.seg += l.seg; f.ouroSeg = (f.ouroSeg || 0) + (l.ouro || 0) * l.seg; } // ouro x tempo: dá o ouro guardado médio
  if (l.conta) f.contas[l.conta] = 1;
  return livro;
}
// versão para mostrar: sem as contas (só quantas), seg vira horas e cada faixa ganha ouro por hora e abates por hora
export function resumoCaixa(livro) {
  const r = {};
  for (const [dia, D] of Object.entries(livro)) for (const [quem, Q] of Object.entries(D)) for (const [fx, f] of Object.entries(Q)) {
    const h = f.seg / 3600, soma = (o) => Object.values(o).reduce((a, b) => a + b, 0), e = soma(f.e), s = soma(f.s);
    ((r[dia] ||= {})[quem] ||= {})[fx] = { jogadores: Object.keys(f.contas).length, horas: +h.toFixed(2), abates: f.abates,
      abatesHora: h > 0.05 ? Math.round(f.abates / h) : null, entrou: e, saiu: s, entrouHora: h > 0.05 ? Math.round(e / h) : null,
      saiuHora: h > 0.05 ? Math.round(s / h) : null, guardadoMedio: f.seg ? Math.round((f.ouroSeg || 0) / f.seg) : null, entradas: f.e, saidas: f.s };
  }
  return r;
}
export const Economia = {
  caixa(j, fonte, v, extra = {}) {
    if (!j?.prog || j.ia) return; // Cecília e Dario não entram na conta
    v = Math.round(v || 0);
    if (v) j.ouroVisto = (j.ouroVisto ?? (j.prog.ouro || 0) - v) + v;
    const l = { dia: diaCaixa(), quem: j.robo ? 'robo' : 'gente', faixa: faixaCaixa(j.prog.nivel), fonte: v ? fonte : null, v, conta: j.conta || j.id, ...extra };
    if (this.aoCaixa) this.aoCaixa(l); else lancarCaixa((this.livro ||= {}), l);
  },
  // a cada CAIXA.conferir s: tempo de jogo de cada um e o ouro que mudou por fora de caixa() ("outros")
  passoCaixa(dt) {
    this.caixaT = (this.caixaT || 0) + dt;
    if (this.caixaT < CAIXA.conferir) return;
    const seg = this.caixaT; this.caixaT = 0;
    for (const j of this.jogadores.values()) {
      if (!j.prog || j.criando || j.ia) continue;
      const ouro = j.prog.ouro || 0;
      if (j.ouroVisto == null) j.ouroVisto = ouro;
      const d = ouro - j.ouroVisto;
      this.caixa(j, 'outros', d, { seg, ouro });
      j.ouroVisto = ouro;
    }
  },
};

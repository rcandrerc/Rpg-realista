// Carga do dia (André 2026-11-24: "agora com os clãs jogando, à medida que eles forem recrutando, a população dos bots
// vai aumentando naturalmente, né? Aí a gente vai testando"). Sem teste de carga: o servidor junta, a cada
// CARGA_DIA.amostraMin minutos, quantos bots estão em jogo, quantos jogadores, o passo médio e o pico do servidor e a
// memória. A ronda das 9h tira daqui a linha "bots x passo x memória" do relatório, para ver até onde o servidor aguenta.
// index.js lê uma vez por minuto (a janela da /saude), guarda as amostras em dados/carga.jsonl (CARGA_DIA.guardaH horas)
// e mostra o resumo das últimas CARGA_DIA.mostraH horas em /saude/dia. O passo do servidor tem 50 ms de orçamento.
export const CARGA_DIA = { amostraMin: 10, guardaH: 48, mostraH: 24 };
export const CARGA_DIA_MAX = (CARGA_DIA.guardaH * 60) / CARGA_DIA.amostraMin; // amostras guardadas (48 h de 10 em 10 min)

// junta a leitura de 1 min na amostra em andamento: bots, jogadores, pico e memória ficam no maior; o passo, na média
export function juntarLeitura(a, { bots = 0, jogadores = 0, passoMs = 0, picoMs = 0, memMb = 0 } = {}) {
  a.n = (a.n || 0) + 1;
  a.soma = (a.soma || 0) + (Number(passoMs) || 0);
  a.pico = Math.max(a.pico || 0, Number(picoMs) || 0);
  a.bots = Math.max(a.bots || 0, bots | 0);
  a.jog = Math.max(a.jog || 0, jogadores | 0);
  a.mem = Math.max(a.mem || 0, memMb | 0);
  return a;
}

// fecha a amostra (t = quando fechou, em ms); sem leitura nenhuma, null
export function fecharAmostra(a, t) {
  if (!a?.n) return null;
  return { t, bots: a.bots, jog: a.jog, passo: +(a.soma / a.n).toFixed(2), pico: +a.pico.toFixed(1), mem: a.mem };
}

// resumo das últimas `horas` h: o máximo de bots e de jogadores juntos, o passo médio (só das amostras com bot em jogo,
// que é a carga que interessa; sem nenhuma, de todas), o pico do passo, a memória máxima e a amostra com mais bots
export function resumoDia(lista, agora, horas = CARGA_DIA.mostraH) {
  const l = (lista || []).filter((c) => c && c.t >= agora - horas * 3600e3 && c.t <= agora);
  const max = (k) => l.reduce((m, c) => Math.max(m, c[k] || 0), 0);
  const comBots = l.filter((c) => c.bots > 0), base = comBots.length ? comBots : l;
  const topo = l.reduce((m, c) => (!m || c.bots > m.bots || (c.bots === m.bots && c.passo > m.passo) ? c : m), null);
  return {
    horas,
    amostras: l.length,
    cobreH: l.length ? +((agora - l[0].t) / 3600e3).toFixed(1) : 0,
    botsMax: max('bots'),
    jogadoresMax: max('jog'),
    passoMedioMs: base.length ? +(base.reduce((s, c) => s + (c.passo || 0), 0) / base.length).toFixed(2) : null,
    passoPicoMs: max('pico'),
    memMaxMb: max('mem'),
    comMaisBots: topo ? { t: topo.t, bots: topo.bots, jog: topo.jog, passo: topo.passo, pico: topo.pico, mem: topo.mem } : null,
  };
}

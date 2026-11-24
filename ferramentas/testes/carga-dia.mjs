// Carga do dia (André 2026-11-24: sem teste de carga; a população de bots cresce com os recrutamentos e a ronda das 9h
// acompanha "bots x passo x memória"). Confere as contas de server/carga-dia.js sem ligar o servidor.
// Uso: node ferramentas/testes/carga-dia.mjs
import { CARGA_DIA, CARGA_DIA_MAX, juntarLeitura, fecharAmostra, resumoDia } from '../../server/carga-dia.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

ok(CARGA_DIA.amostraMin === 10 && CARGA_DIA_MAX === 288, 'uma amostra a cada 10 min, 48 h guardadas (288 amostras)');

// 10 leituras de 1 min viram uma amostra: bots, jogadores, pico e memória no maior; o passo na média
const a = {};
for (let i = 0; i < 10; i++) juntarLeitura(a, { bots: 20 + i, jogadores: i % 3, passoMs: 4 + i * 0.2, picoMs: i === 7 ? 180 : 12, memMb: 210 + i });
const s = fecharAmostra(a, 1000);
ok(s.bots === 29 && s.jog === 2 && s.pico === 180 && s.mem === 219, 'amostra guarda o maior de bots, jogadores, pico e memória');
ok(Math.abs(s.passo - 4.9) < 1e-9 && s.t === 1000, 'passo da amostra é a média das leituras (4,9 ms)');
ok(fecharAmostra({}, 1) === null && fecharAmostra(null, 1) === null, 'amostra sem leitura não é guardada');
ok(juntarLeitura({}, {}).n === 1 && juntarLeitura({}, { bots: 'x', passoMs: NaN }).soma === 0, 'leitura com número estragado não quebra a conta');

// resumo do dia: só as últimas 24 h; passo médio só das amostras com bot em jogo
const h = 3600e3, agora = 100 * h;
const lista = [
  { t: agora - 30 * h, bots: 90, jog: 3, passo: 40, pico: 900, mem: 900 }, // mais de 24 h: fora
  { t: agora - 20 * h, bots: 0, jog: 0, passo: 2, pico: 5, mem: 200 },
  { t: agora - 10 * h, bots: 35, jog: 1, passo: 6, pico: 60, mem: 230 },
  { t: agora - 5 * h, bots: 52, jog: 2, passo: 9, pico: 140, mem: 260 },
  { t: agora - 1 * h, bots: 10, jog: 1, passo: 3, pico: 20, mem: 240 },
];
const r = resumoDia(lista, agora);
ok(r.amostras === 4 && r.cobreH === 20, 'resumo pega só as últimas 24 h (4 amostras, cobre 20 h)');
ok(r.botsMax === 52 && r.jogadoresMax === 2 && r.passoPicoMs === 140 && r.memMaxMb === 260, 'máximos do dia: 52 bots, 2 jogadores, pico 140 ms, 260 MB');
ok(r.passoMedioMs === 6, 'passo médio só com bot em jogo: (6 + 9 + 3) / 3 = 6 ms');
ok(r.comMaisBots?.bots === 52 && r.comMaisBots.passo === 9 && r.comMaisBots.mem === 260, 'mostra a hora com mais bots e o passo e a memória nela');
const vazio = resumoDia([], agora);
ok(vazio.amostras === 0 && vazio.botsMax === 0 && vazio.passoMedioMs === null && vazio.comMaisBots === null, 'sem amostra (servidor acabou de ligar): resumo vazio, sem erro');
const semBots = resumoDia([{ t: agora - h, bots: 0, jog: 0, passo: 2.5, pico: 8, mem: 200 }], agora);
ok(semBots.passoMedioMs === 2.5, 'dia sem nenhum bot: passo médio de todas as amostras');

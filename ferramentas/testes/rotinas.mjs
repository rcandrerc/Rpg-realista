// Rotina de cada NPC (André 2026-11-11: "todos fazendo a mesma coisa... onde eles passam trava tudo"): cada um sai e
// volta no horário dele, com um atraso só dele, prefere uma faixa de campo, fica num canto da vila, e quem gosta de
// pescar, minerar ou cortar lenha vai fazer isso. Roda um dia de jogo (4h às 23h) e confere que eles se espalham.
// Uso: node ferramentas/testes/rotinas.mjs
import { Simulacao, MAPA_CLAREIRA, NPC_VIDA, ITENS } from '../../shared/index.js';
import { rotinaDe, naHoraDe } from '../../shared/amiga.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

const ids = Object.keys(NPC_VIDA.rotina).filter((k) => k !== 'padrao');
ok(ids.length === 22, 'os 22 têm rotina');
const R = Object.fromEntries(ids.map((id) => [id, rotinaDe(id)]));
ok(new Set(ids.map((id) => R[id].saiDe.toFixed(2))).size === 22, 'ninguém sai no mesmo minuto (atraso de cada um)');
ok(naHoraDe(R.maya, 23) && naHoraDe(R.maya, 1) && !naHoraDe(R.maya, 12), 'Maya caça de noite');
ok(!naHoraDe(R.lune, 17) && naHoraDe(R.lia, 17), 'Lune volta cedo, Lia fica até tarde');

const s = new Simulacao(MAPA_CLAREIRA);
s.nivelTetoNpc = 15;
s.adicionarJogador('andre', 'André', 'ruiva', {});
for (const x of s.amigosIa) x.amigaEntrar('andre', false);
const av = s.amigosIa.filter((x) => !x.AMIGA.terreno);
const M0 = NPC_VIDA.moradia[0];
const coletores = av.filter((x) => R[x.AMIGA.id].coleta > 0);
ok(coletores.every((x) => x.amiga.prog.mochila.some((o) => o && o.k === x.AMIGA.atividades[x.AMIGA.gosto].ferramenta)), 'quem coleta já tem a ferramenta');
const coletaK = new Set(['peixe', 'minerio', 'tora', 'madeira', 'pedra', 'cobre', 'ferro']);
const conta = (x) => x.amiga.prog.mochila.reduce((a, o) => a + (o && !ITENS[o.k]?.lugar && o.k !== 'pocao' && !['vara', 'picareta', 'machado'].includes(o.k) ? o.n || 1 : 0), 0);
const prof0 = coletores.map((x) => JSON.stringify(x.amiga.prog.prof));

const H0 = 4, horas = 19, passos = Math.round(horas * 30 / 0.05);
let saidas = [], maiorGrupo = 0, fasesColeta = 0, ultimaFase = new Map(), foraPorHora = {};
for (let i = 0; i < passos; i++) {
  const h = H0 + (i * 0.05) / 30, dia = { h: h % 24, t: Date.now() };
  for (const x of s.amigosIa) if (x.amiga) x.amiga.prog.dia = dia;
  s.passo(0.05);
  if (i % 20 === 0) { // a cada 1 s
    for (const x of av) {
      const f = x.amiga.ia.av?.fase, antes = ultimaFase.get(x.AMIGA.id);
      if (f === 'ir' && antes !== 'ir') saidas.push(i * 0.05);
      if (x.amiga.ia.av?.coleta && f === 'cacar') fasesColeta++;
      ultimaFase.set(x.AMIGA.id, f);
    }
    // o maior bando fora da vila: quantos NPCs a menos de 8 m um do outro
    const fora = av.filter((x) => Math.hypot(x.amiga.x - M0.x, x.amiga.z - M0.z) > M0.r + 25);
    for (const a of fora) maiorGrupo = Math.max(maiorGrupo, fora.filter((b) => Math.hypot(a.amiga.x - b.amiga.x, a.amiga.z - b.amiga.z) < 8).length);
    const hh = Math.floor(h); foraPorHora[hh] = Math.max(foraPorHora[hh] || 0, fora.length);
  }
}
// saídas espalhadas: em nenhuma janela de 15 s saem mais de 5
let pico = 0; for (const t of saidas) pico = Math.max(pico, saidas.filter((u) => u >= t && u < t + 15).length);
console.log('saídas:', saidas.length, '| pico em 15 s:', pico, '| maior bando fora da vila:', maiorGrupo, '| fora por hora:', JSON.stringify(foraPorHora));
ok(saidas.length >= 20, `saem várias vezes no dia (${saidas.length} saídas)`);
ok(pico <= 4, `não saem em bando: no máximo ${pico} saem juntos em 15 s`);
ok(maiorGrupo <= 6, `fora da vila não andam em bando (maior grupo ${maiorGrupo})`);
const coletou = coletores.filter((x, i) => JSON.stringify(x.amiga.prog.prof) !== prof0[i] || conta(x) > 0).length;
ok(fasesColeta > 0 && coletou >= 2, `quem gosta de coletar coleta (${coletou} de ${coletores.length})`);
const tarde = foraPorHora[22] || 0, meioDia = foraPorHora[12] || 0;
ok(tarde < meioDia, `de noite tem menos gente fora (${tarde} às 22h, ${meioDia} ao meio-dia)`);
// cantos diferentes na vila
const cantos = av.map((x) => x.pontoVilaAmiga(x.amiga));
let juntos = 0; for (let a = 0; a < cantos.length; a++) for (let b = a + 1; b < cantos.length; b++) if (Math.hypot(cantos[a].x - cantos[b].x, cantos[a].z - cantos[b].z) < 1) juntos++;
ok(juntos <= 2, `cada um tem seu canto na vila (${juntos} pares colados)`);

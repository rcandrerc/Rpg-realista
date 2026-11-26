// Teste da Patente de Guerra (André 2026-11-26, shared/patente.js): abate da outra raça conta no mês, anti-farm, título
// da maior patente fica, virou o mês = prêmio e volta a Recruta, placar do clã e prêmio do clã.
// Uso: node ferramentas/testes/patente-guerra.mjs
import { Simulacao, MAPA_CLAREIRA, PATENTE, patenteDe, mesGuerra } from '../../shared/index.js';
import { progressoValido, contar } from '../../shared/progresso.js';
import './_tudo-aberto.mjs';
const ok = (v, m) => { if (!v) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', null, { conta: 1 });
a.prog.nivel = 40;
const vitima = (i, nv = 40) => { const v = s.adicionarJogador('V' + i, 'Gelo' + i, null, { conta: 100 + i }); v.prog.raca = 'geada'; v.prog.nivel = nv; return v; };
ok(patenteDe(0).i === 0 && patenteDe(5).i === 1 && patenteDe(29).i === 2 && patenteDe(30).i === 3 && patenteDe(999).pct === 1, 'patente pelos abates');
ok(Math.abs(patenteDe(10).pct - 0.5) < 1e-9, 'anel: 10 abates = 50% de Soldado para Cabo');
const v0 = vitima(0);
s.abateGuerra(v0, a);
ok(a.prog.gu.a === 1 && a.prog.gu.m === mesGuerra(), 'abate da Geada conta no mês');
s.abateGuerra(v0, a);
ok(a.prog.gu.a === 1, 'a mesma pessoa de novo em menos de 10 min não conta');
const fraca = vitima(1, 30);
s.abateGuerra(fraca, a);
ok(a.prog.gu.a === 1, 'quem é 10 níveis mais fraco não conta');
const amigo = s.adicionarJogador('C', 'Chama', null, { conta: 50 }); amigo.prog.nivel = 40;
s.abateGuerra(amigo, a);
ok(a.prog.gu.a === 1, 'mesma raça não conta');
for (let i = 2; i < 6; i++) s.abateGuerra(vitima(i), a);
ok(a.prog.gu.a === 5 && a.prog.gu.x === 1 && a.prog.tit.tem.includes('pat1'), '5 abates: Soldado e o título');
ok(s.eventos.some((e) => e.t === 'aviso' && e.para === 'A' && e.texto === 'Patente nova: Soldado'), 'aviso de patente nova');
ok(s.foto().jogadores.find((j) => j.id === 'A').pt === 1, 'foto manda a patente (escudo na cabeça)');
ok(s.guerraMes.r.chama === 5, 'placar do mês da raça');
// salva e volta
const p2 = progressoValido(JSON.parse(JSON.stringify(a.prog)));
ok(p2.gu && p2.gu.a === 5 && p2.gu.x === 1 && p2.gu.m === a.prog.gu.m, 'conta guarda a patente');
ok(progressoValido({ gu: { m: 'xx', a: -3, x: 99 } }).gu == null, 'lixo na patente não passa');
// Capitão no mês e virou o mês
a.prog.gu.a = 85; a.prog.gu.x = 5; s.conferirTitulos(a, true);
ok(['pat1', 'pat2', 'pat3', 'pat4', 'pat5'].every((t) => a.prog.tit.tem.includes(t)), 'Capitão: títulos até Capitão');
const antes = contar(a.prog.mochila, 'runa_epica') + contar(a.prog.mochila, 'selo_epico');
a.prog.gu.m = '2000-01';
s.fecharMesPatente(a);
const depois = contar(a.prog.mochila, 'runa_epica') + contar(a.prog.mochila, 'selo_epico');
ok(depois - antes === 2, 'virou o mês como Capitão: 2 Épicos');
ok(a.prog.gu.a === 0 && a.prog.gu.x === 5 && a.prog.tit.tem.includes('pat5'), 'volta a Recruta, título de Capitão fica');
s.fecharMesPatente(a);
ok(contar(a.prog.mochila, 'runa_epica') + contar(a.prog.mochila, 'selo_epico') === depois, 'prêmio só uma vez');
// Lenda conta o mês
a.prog.gu.a = 200; a.prog.gu.m = '2000-02'; s.fecharMesPatente(a);
ok(a.prog.gu.l === 1 && contar(a.prog.mochila, 'runa_mitica') + contar(a.prog.mochila, 'selo_mitico') === 1, 'Lenda: 1 Mítico e conta o mês');
// placar do clã: virou o mês, o clã que mais abateu ganha
s.guerraMes = { m: '2000-03', c: { j1: 9, j7: 3 }, r: { chama: 12 } };
let premiado = null; s.premioClaGuerra = (ch) => { premiado = ch; };
s.mesGuerraEstado();
ok(premiado === 'j1' && s.guerraMes.m === mesGuerra() && !Object.keys(s.guerraMes.c).length, 'virou o mês: clã com mais abates ganha e o placar zera');
ok(PATENTE.premio.length === PATENTE.nomes.length && PATENTE.abates.length === PATENTE.nomes.length, 'tabela completa');

// Teste da penalidade de morte (André 2026-11-05): cair desgasta o equipamento do corpo; peça com 0 fica quebrada (sem
// bônus) e o Tomás conserta cobrando ouro. André 2026-11-18: a morte não tira mais ouro (era 10%) e o conserto vai por
// peça marcada (inteira ou nada) ou tudo de uma vez. Uso: node ferramentas/testes/morte.mjs
import { Simulacao, MAPA_CLAREIRA, MORTE, HEROI, bonusEquip, itemValido, custoConserto } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const j = s.adicionarJogador('A', 'Ana');
j.prog.ouro = 200;
for (const l of Object.keys(j.prog.equip)) j.prog.equip[l] = null; // só as duas peças do teste (herói novo vem com o set Comum)
j.prog.equip.espada = { k: 'espada', r: 1, d: 5 };
j.prog.equip.corpo = { k: 'peitoral', r: 0 };
s.aplicarStatus(j, true);
const dano0 = bonusEquip(j.prog.equip).danoFisico;
s.eventos = [];
s.morrer(j);
ok(MORTE.ouro === 0 && j.prog.ouro === 200, 'morrer não tira ouro (André 2026-11-18): ' + j.prog.ouro);
ok(j.prog.equip.corpo.d === MORTE.durMax - MORTE.desgaste, 'peitoral desgastou: ' + j.prog.equip.corpo.d);
ok(j.prog.equip.espada.d === 0, 'espada quebrou');
ok(bonusEquip(j.prog.equip).danoFisico < dano0, 'espada quebrada não dá dano');
const ev = [];
for (let t = 0; t < (HEROI.renascer + 0.5) / 0.05; t++) ev.push(...s.passo(0.05));
const av = ev.filter((e) => e.t === 'aviso' && e.para === 'A').map((e) => e.texto).join(' | ');
ok(!j.morto && !/de ouro/.test(av) && /quebrou: Espada/.test(av), 'aviso ao levantar (sem ouro perdido): ' + av);
// conserto: longe do Tomás não deixa; perto cobra e deixa inteiro
s.eventos = [];
s.item('A', { acao: 'consertar' });
ok(s.eventos.some((e) => /Conserte com o Tomás/.test(e.texto || '')), 'longe do Tomás não conserta');
const tomas = MAPA_CLAREIRA.npcs.find((n) => n.id === 'ferreiro');
j.x = tomas.x + 1; j.z = tomas.z;
// só as marcadas (André 2026-11-18): a espada sozinha; sem ouro para ela, nada muda
const cEsp = custoConserto(j.prog.equip.espada), cCorpo = custoConserto(j.prog.equip.corpo);
j.prog.ouro = cEsp - 1; s.eventos = [];
s.item('A', { acao: 'consertar', lista: [{ lugar: 'espada' }] });
ok(j.prog.equip.espada.d === 0 && j.prog.ouro === cEsp - 1 && s.eventos.some((e) => /faltam 1\)/.test(e.texto || '')), 'peça marcada sem ouro: não conserta pela metade');
j.prog.ouro = cEsp; s.eventos = [];
s.item('A', { acao: 'consertar', lista: [{ lugar: 'espada' }, { lugar: 'espada' }, { lugar: '__proto__' }, { i: 999 }] });
ok(j.prog.equip.espada.d === undefined && j.prog.equip.corpo.d === MORTE.durMax - MORTE.desgaste && j.prog.ouro === 0, `só a espada marcada: inteira por ${cEsp}, o peitoral fica gasto`);
j.prog.equip.espada.d = 0;
j.prog.ouro = cEsp + cCorpo - 1; s.eventos = [];
s.item('A', { acao: 'consertar' });
ok(j.prog.equip.espada.d === 0 && j.prog.equip.corpo.d !== undefined && s.eventos.some((e) => /faltam 1\)/.test(e.texto || '')), 'Consertar tudo sem ouro para tudo: não conserta nada');
j.prog.ouro += 1000; // conserto mais caro (André 2026-11-17 e 2026-11-18): o dobro da tabela
const antes = j.prog.ouro;
s.eventos = [];
s.item('A', { acao: 'consertar' });
ok(j.prog.equip.espada.d === undefined && j.prog.equip.corpo.d === undefined, 'tudo inteiro de novo');
ok(j.prog.ouro < antes, `pagou ${antes - j.prog.ouro} de ouro: ` + s.eventos.map((e) => e.texto).join(' | '));
ok(bonusEquip(j.prog.equip).danoFisico === dano0, 'espada voltou a dar dano');
ok(itemValido({ k: 'espada', r: 0, d: 30 }).d === 30, 'durabilidade fica gravada na conta');

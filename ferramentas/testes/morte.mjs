// Teste da penalidade de morte (André 2026-11-05): cair tira 10% do ouro e desgasta o equipamento do corpo; peça com 0
// fica quebrada (sem bônus) e o Tomás conserta tudo cobrando ouro. Uso: node ferramentas/testes/morte.mjs
import { Simulacao, MAPA_CLAREIRA, MORTE, HEROI, bonusEquip, itemValido } from '../../shared/index.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const j = s.adicionarJogador('A', 'Ana');
j.prog.ouro = 200;
j.prog.equip.espada = { k: 'espada', r: 1, d: 5 };
j.prog.equip.corpo = { k: 'peitoral', r: 0 };
s.aplicarStatus(j, true);
const dano0 = bonusEquip(j.prog.equip).danoFisico;
s.eventos = [];
s.morrer(j);
ok(j.prog.ouro === 180, 'perdeu 10% do ouro: ' + j.prog.ouro);
ok(j.prog.equip.corpo.d === MORTE.durMax - MORTE.desgaste, 'peitoral desgastou: ' + j.prog.equip.corpo.d);
ok(j.prog.equip.espada.d === 0, 'espada quebrou');
ok(bonusEquip(j.prog.equip).danoFisico < dano0, 'espada quebrada não dá dano');
const ev = [];
for (let t = 0; t < (HEROI.renascer + 0.5) / 0.05; t++) ev.push(...s.passo(0.05));
const av = ev.filter((e) => e.t === 'aviso' && e.para === 'A').map((e) => e.texto).join(' | ');
ok(!j.morto && /Perdeu 20 de ouro/.test(av) && /quebrou: Espada/.test(av), 'aviso ao levantar: ' + av);
// conserto: longe do Tomás não deixa; perto cobra e deixa inteiro
s.eventos = [];
s.item('A', { acao: 'consertar' });
ok(s.eventos.some((e) => /Conserte com o Tomás/.test(e.texto || '')), 'longe do Tomás não conserta');
const tomas = MAPA_CLAREIRA.npcs.find((n) => n.id === 'ferreiro');
j.x = tomas.x + 1; j.z = tomas.z;
const antes = j.prog.ouro;
s.eventos = [];
s.item('A', { acao: 'consertar' });
ok(j.prog.equip.espada.d === undefined && j.prog.equip.corpo.d === undefined, 'tudo inteiro de novo');
ok(j.prog.ouro < antes, `pagou ${antes - j.prog.ouro} de ouro: ` + s.eventos.map((e) => e.texto).join(' | '));
ok(bonusEquip(j.prog.equip).danoFisico === dano0, 'espada voltou a dar dano');
ok(itemValido({ k: 'espada', r: 0, d: 30 }).d === 30, 'durabilidade fica gravada na conta');

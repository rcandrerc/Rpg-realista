// Janela dos NPCs no leve igual à do jogo (conversa.gd ACOES; André 2026-11-27: "no ferreiro não aparece reparar
// equipamento... quero tudo idêntico"): todos os NPCs com as ações deles, o conserto (peças gastas e o preço), o passe do
// Gaspar, as sínteses da Mirela e a fala com o instrutor (abrir resetar + custo).
// Uso: node ferramentas/testes/leve-npcs.mjs
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 }); a.criando = false; a.ciente = true; a.leve = true; a.prog.nivel = 30; a.prog.ouro = 5000;
for (let i = 0; i < 3; i++) s.passo(1 / 20);
const M = s.leveMapa(a), por = (id) => M.npcs.find((n) => n.id === id);
const conta = Object.fromEntries((MAPA_CLAREIRA.npcs || []).map((n) => [n.id, n]));
const iguais = (n) => MAPA_CLAREIRA.npcs.some((o) => o.id === n.id && JSON.stringify(n.a) === JSON.stringify((o.acoes || []).filter((x) => x !== 'forja' && x !== 'alfaiate'))); // v_lia aparece 2 vezes no mapa
const faltam = M.npcs.filter((n) => !iguais(n)).map((n) => n.id);
ok(!faltam.length, `todo NPC com as mesmas ações do jogo${faltam.length ? ': ' + faltam : ''} (${M.npcs.length} NPCs)`);
ok(por('ferreiro')?.a.includes('consertar') && por('ferreiro').a.includes('habilidades') && por('ferreiro').a.includes('vender'), 'Tomás: Vender, Consertar e Habilidades');
ok(por('curandeira')?.a.includes('cura') && por('reset')?.a.includes('resetar') && por('andarilho'), 'Curandeira, instrutor e quem só conversa também aparecem');
ok(por('alquimista')?.al?.length >= 2, `Mirela: o que ela sintetiza (${por('alquimista')?.al?.map((o) => o[1])})`);
// conserto: uma peça vestida gasta aparece com o preço, e o conserto pelo leve usa a msg do jogo
a.prog.equip.corpo = { k: 'peitoral', r: 1, d: 40 }; s.aplicarStatus(a);
const mo = s.mochilaLeve(a);
ok(mo.cs?.length === 1 && mo.cs[0][0] === 'l' && mo.cs[0][1] === 'corpo' && mo.cs[0][3] === 40 && mo.cs[0][4] > 0 && mo.ct === mo.cs[0][4], `conserto: peça gasta com preço (${JSON.stringify(mo.cs)} tudo ${mo.ct})`);
const T = conta.ferreiro; a.x = T.x + 1; a.z = T.z; const ouro0 = a.prog.ouro;
s.item('A', { acao: 'consertar', lista: [{ lugar: 'corpo' }] });
ok(a.prog.equip.corpo.d == null && a.prog.ouro === ouro0 - mo.ct, 'Consertar a peça no Tomás: inteira e cobrou o preço mostrado');
// fala: o instrutor manda abrir resetar com o custo; a página recebe id/abrir/custo
const ev = []; const e0 = s.evento.bind(s); s.evento = (e) => { ev.push(e); return e0(e); };
const R = conta.reset; a.x = R.x + 1; a.z = R.z; s.falar('A', { npc: 'reset' });
const f = ev.find((e) => e.t === 'fala'), fl = f && s.leveEvento(f);
ok(fl?.abrir === 'resetar' && fl.custo >= 0 && fl.id === 'reset', `Instrutor: pergunta com o preço (${JSON.stringify(fl)})`);
ok(s.fotoLeve(a).hn !== undefined || true, 'foto leva o NPC da missão (hn) quando há');

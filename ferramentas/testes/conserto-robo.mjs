// Conserto de graça só no robô de testes (André 2026-11-27, "deixa o reparo dele somente dele free pra gente avaliar o resto
// gasto de gold deixa pra vermos depois"): COMBATE_TESTE.consertoGratis em shared/dados.js. Jogadores, bots e recrutas
// seguem pagando a tabela de sempre (MORTE.consertoTabela).
// Uso: node ferramentas/testes/conserto-robo.mjs
import { Simulacao, MAPA_CLAREIRA, COMBATE_TESTE, MORTE, consertoGratis, consertarTudo, consertarPecas, custoConserto, durab } from '../../shared/index.js';
import { pecasParaConsertar } from '../robo/robo-escolhas.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const gastas = () => ({ corpo: { k: 'peitoral', r: 1, d: 0 }, cabeca: { k: 'chapeu', r: 1, d: 30 }, pes: { k: 'botas', r: 1, d: 100 }, espada: { k: 'espada', r: 1, d: 0 } });
const prog = (ct, ouro = 0) => ({ ...(ct ? { ct: 1 } : {}), ouro, equip: gastas(), mochila: [] });

ok(COMBATE_TESTE.consertoGratis === true, 'COMBATE_TESTE.consertoGratis ligado');
ok(consertoGratis({ ct: 1 }) && !consertoGratis({}) && !consertoGratis(null), 'só a conta com o combate de teste (ct) conserta de graça');

// robô sem ouro: conserta tudo, não gasta nada, peças inteiras
{
  const p = prog(true, 0), r = consertarTudo(p);
  ok(r && r.custo === 0 && r.n === 3 && !r.falta, `robô sem ouro conserta as 3 peças gastas por 0 (${JSON.stringify(r)})`);
  ok(p.ouro === 0 && Object.values(p.equip).every((it) => durab(it) === MORTE.durMax), 'ouro não muda e tudo volta a 100%');
}
{
  const p = prog(true, 50), r = consertarPecas(p, [{ lugar: 'corpo' }, { lugar: 'espada' }], 0.2);
  ok(r && r.custo === 0 && r.n === 2 && p.ouro === 50 && durab(p.equip.cabeca) === 30, 'robô: conserto por peça também de graça, só as marcadas');
}
// jogador (e bot) segue pagando
{
  const p = prog(false, 0), r = consertarTudo(p), preco = custoConserto({ k: 'peitoral', r: 1, d: 0 });
  ok(preco === MORTE.consertoTabela[1] && r && r.falta > 0 && r.custo === preco * 2 + Math.ceil(0.7 * preco), `jogador sem ouro não conserta (custa ${r?.custo})`);
  ok(durab(p.equip.corpo) === 0, 'peça do jogador segue quebrada');
  const q = prog(false, 5000), r2 = consertarTudo(q);
  ok(r2 && r2.custo === 2160 && q.ouro === 5000 - 2160, `jogador com ouro paga a tabela de sempre (${r2?.custo})`);
}
// o robô: leva todas as gastas ao Tomás mesmo sem ouro
{
  const P = pecasParaConsertar(gastas(), 0, true), N = pecasParaConsertar(gastas(), 0);
  ok(P && P.lista.length === 3 && P.custo === 0 && P.ficam === 0, 'robô de graça: as 3 gastas vão para a lista do Tomás');
  ok(N && N.lista.length === 0 && N.ficam === 3, 'sem ser de graça e sem ouro: nenhuma (como era)');
}
// no servidor: ação consertar com o Tomás; o aviso continua no formato que o robô conta (robo.mjs)
{
  const s = new Simulacao(MAPA_CLAREIRA), ev = [], e0 = s.evento.bind(s); s.evento = (e) => { ev.push(e); e0(e); };
  const j = s.adicionarJogador('R', 'Robô'); j.criando = false; j.morto = false;
  const tomas = MAPA_CLAREIRA.npcs.find((n) => (n.acoes || []).includes('consertar')); j.x = tomas.x; j.z = tomas.z;
  j.prog.ct = 1; j.prog.ouro = 0; Object.assign(j.prog.equip, gastas());
  s.item('R', { acao: 'consertar' });
  const av = [...ev, ...s.eventos].map((e) => e.texto).filter(Boolean).join(' | ');
  const m = /consertou (\d+) peças? por (\d+) de ouro/.exec(av);
  ok(m && m[1] === '3' && m[2] === '0', `servidor: robô conserta de graça no Tomás ("${av}")`);
  ok(j.prog.ouro === 0 && durab(j.prog.equip.corpo) === MORTE.durMax, 'servidor: peça inteira e ouro igual');
  const k = s.adicionarJogador('G', 'Gente'); k.criando = false; k.morto = false; k.x = tomas.x; k.z = tomas.z;
  k.prog.ouro = 0; Object.assign(k.prog.equip, gastas()); delete k.prog.ct; ev.length = 0; s.eventos = [];
  s.item('G', { acao: 'consertar' });
  ok(/O conserto custa \d+ de ouro \(faltam \d+\)/.test([...ev, ...s.eventos].map((e) => e.texto).join(' ')) && durab(k.prog.equip.corpo) === 0, 'servidor: jogador sem ouro segue sem conseguir');
}

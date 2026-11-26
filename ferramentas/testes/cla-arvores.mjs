// Plantar árvores (André 2026-11-25): o recruta planta até PLANTIO.mudasMax (10, o mesmo limite do jogador) mudas nas
// áreas de plantio do mapa, avisa no chat e volta sozinho ao Livre; mandado de novo antes de crescerem, diz que atingiu o
// limite e volta ao Livre. Não corta. Clãs bot também.
// Uso: node ferramentas/testes/cla-arvores.mjs
import { Simulacao, MAPA_CLAREIRA, CLA, PLANTIO, ARVORES_PLANTIO } from '../../shared/index.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
ok(PLANTIO.mudasMax === 10, 'limite de mudas crescendo é 10 para todos');
ok(CLA.funcoes.some((F) => F.id === 'arvores') && CLA.funcoes.some((F) => F.id === 'fazenda'), 'ordem Plantar árvores ao lado da Fazenda (Fazenda continua)');
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', undefined, { conta: 1 });
a.criando = false; a.ciente = true; a.prog.ouro = 90000; a.prog.nivel = 30;
const r = s.mapa.npcs.find((n) => n.funcao === 'recrutador'); a.x = r.x + 1; a.z = r.z;
s.cla('A', { acao: 'fundar', nome: 'Arvoredo' });
s.cla('A', { acao: 'recrutar', tier: 'recruta' });
const p = a.prog, [m1] = p.cla.m, x1 = s.recrutasNoMundo(a).find((x) => x.AMIGA.id === m1.id), b = x1.amiga;
const info = s.claInfo(a);
ok(info.arvores?.some((T) => T.k === 'carvalho' && T.h === 8) && !info.plantas.some((P) => P.k === 'carvalho'), 'menu: lista de árvores separada da horta');
p.cla.cofre = 5000;
s.cla('A', { acao: 'funcao', id: m1.id, fn: { k: 'arvores', s: 'betula' } });
ok(m1.fn?.k === 'arvores' && m1.fn.s === 'betula', 'ordem Plantar árvores (bétula) vale');
b.prog.vigor = { v: 100, t: Date.now(), m: 100 };
const minhas = () => [...s.plantadas.values()].filter((P) => P.rc === m1.id);
let falas = [];
for (let i = 0; i < 12000 && m1.fn?.k === 'arvores'; i++) { s.passo(0.25); for (const e of s.eventos) if (e.texto) falas.push(e.texto); s.eventos = []; }
ok(minhas().length === 10, `plantou 10 (${minhas().length})`);
ok(minhas().every((P) => !P.lote), 'nas áreas de plantio (fora do terreno)');
ok(falas.some((t) => /Plantei 10 árvores lá/.test(t)) || /Plantei 10/.test(b.ia.funcaoSt?.txt || ''), 'avisa que plantou 10');
ok(m1.fn?.k === 'livre' && !b.ia.funcao, `voltou sozinho ao Livre (${m1.fn?.k})`);
ok(p.cla.cofre < 5000, `comprou semente com o cofre (${p.cla.cofre})`);
ok(s.plantioParaSalvar().some((v) => v[9] === m1.id), 'quem plantou vai para o banco');
// de novo antes de crescer: limite
s.cla('A', { acao: 'funcao', id: m1.id, fn: { k: 'arvores', s: 'carvalho' } });
for (let i = 0; i < 20; i++) s.passo(0.25);
ok(minhas().length === 10 && m1.fn?.k === 'livre', 'de novo antes de crescer: não planta e volta ao Livre');
ok(/atingi o limite/.test(b.ia.funcaoSt?.txt || ''), `avisa o limite (${b.ia.funcaoSt?.txt})`);
// cresceram: pode plantar mais 10
for (const P of minhas()) P.quando -= ARVORES_PLANTIO.betula.h * 3600e3 + 1000;
b.prog.vigor = { v: 100, t: Date.now(), m: 100 };
s.cla('A', { acao: 'funcao', id: m1.id, fn: { k: 'arvores', s: 'betula' } });
for (let i = 0; i < 12000 && m1.fn?.k === 'arvores'; i++) s.passo(0.25);
ok(s.mudasRecruta(m1.id) === 10 && minhas().length === 20, `cresceram: plantou mais 10 (${minhas().length})`);

// clã bot: o líder manda um recruta plantar
{
  const s2 = new Simulacao(MAPA_CLAREIRA);
  s2.carregarClasNpc(null);
  const C = { lider: 'dario' }, E = { m: [{ id: 'x1' }, { id: 'x2' }, { id: 'x3' }] };
  const ctxs = E.m.map((m) => ({ AMIGA: { id: m.id }, amiga: { prog: { nivel: 30, vigor: { v: 100, t: Date.now(), m: 100 } }, ia: {} } }));
  Object.assign(s2, { faltaClaNpc: () => ({ lenha: 1 }), ameacaClaNpc: () => false, faltaDespensaNpc: () => ({}), descansoNpc: () => false, membrosFixosNpc: () => [], grindSobraBot: () => 0 });
  let viu = false;
  for (let t = 0; t < 40 && !viu; t++) { for (const m of E.m) m.fn = null; s2.ordensLiderNpc(C, E, { prog: { nivel: 30 } }, ctxs, true); viu = E.m.some((m) => m.fn?.k === 'arvores'); }
  ok(viu, 'líder bot manda um recruta plantar árvores');
  ok(E.m.filter((m) => m.fn?.k === 'arvores').length <= 1, 'no máximo um por clã');
}

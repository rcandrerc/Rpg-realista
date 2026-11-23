// Ficha do recruta (André 2026-11-23, FICHA_RECRUTA): o Recrutador mostra 3 candidatos com ficha, o líder escolhe um;
// a ficha manda na luta e nos pontos (gosto pelo cajado -> Inteligência); recruta de antes ganha ficha fixa pelo id;
// a janela de equipamento mostra o perfil (recruta e jogador); o líder bot escolhe pelo jeito dele.
// Uso: node ferramentas/testes/cla-ficha.mjs
import { Simulacao, MAPA_CLAREIRA, CEREBRO } from '../../shared/index.js';
import { claValido } from '../../shared/cla.js';
import { FICHA_RECRUTA, fichaLuta, pontosDaFicha } from '../../shared/dados.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

const s = new Simulacao(MAPA_CLAREIRA);
const j = s.adicionarJogador('A', 'Ana', undefined, { conta: 9 });
j.criando = false; j.ciente = true;
const p = j.prog; p.nivel = 40; p.ouro = 20000;
const rec = s.mapa.npcs.find((n) => n.funcao === 'recrutador');
s.cla('A', { acao: 'fundar', nome: 'Lobos do Norte' }); p.cla.nv = 6;
j.x = rec.x + 1; j.z = rec.z; s.eventos = [];
s.cla('A', { acao: 'candidatos', tier: 'recruta' });
const ev = s.eventos.find((e) => e.t === 'claCandidatos' && e.para === 'A');
ok(ev && ev.l.length === FICHA_RECRUTA.candidatos && p.cla.m.length === 0 && p.ouro === 20000, `3 candidatos, nada pago ainda (${ev?.l.map((c) => c.nome + ' ' + c.ficha.jeito + ' ' + c.ficha.estilo).join(' | ')})`);
ok(ev.l.every((c) => c.ficha.estilo && c.ficha.jeito && c.ficha.pts.for + c.ficha.pts.int + c.ficha.pts.vit >= 99), 'cada um com jeito, preferência e pontos');
const esc = j.candidatosCla.l[1];
s.cla('A', { acao: 'recrutar', tier: 'recruta', esc: 1 });
ok(p.cla.m.length === 1 && p.cla.m[0].id === esc.id && p.cla.m[0].lu.ca === esc.lu.ca, `contratou o escolhido (${esc.nome})`);
s.eventos = []; s.cla('A', { acao: 'recrutar', tier: 'recruta', esc: 0 });
ok(p.cla.m.length === 1 && s.eventos.some((e) => e.t === 'aviso' && /candidatos/.test(e.texto)), 'escolha usada: pede de novo');
s.cla('A', { acao: 'recrutar', tier: 'recruta' });
ok(p.cla.m.length === 2 && p.cla.m[1].lu, 'sem escolha (app velho): sorteia um, com ficha');

// a luta segue a ficha
const x = s.recrutasNoMundo(j).find((o) => o.AMIGA.id === esc.id);
ok(x.AMIGA.luta.cajado === esc.lu.ca && x.AMIGA.luta.coragem === esc.lu.co, 'o cérebro usa a ficha (não o padrão 0,3)');
x.AMIGA.luta = { coragem: 0.5, cuidado: 0.5, cajado: 0.9 }; const a = x.amiga; a.prog.atr = { for: 3, des: 3, int: 3, vit: 3 }; a.prog.pontos = 30;
x.pontosAmiga(a);
ok(a.prog.atr.int > a.prog.atr.for + 10, `gosta de magia: pontos em Inteligência (FOR ${a.prog.atr.for} INT ${a.prog.atr.int})`);
ok(pontosDaFicha(0.1).for > pontosDaFicha(0.1).int, 'gosta de espada: Força');

// perfil na janela de equipamento
s.eventos = []; a.x = j.x + 1; a.z = j.z; s.verEquip('A', { com: a.id });
const pv = s.eventos.find((e) => e.t === 'equipVer')?.perfil;
ok(pv?.recruta && pv.ficha?.estilo && pv.ficha.jeito && pv.cla === 'Lobos do Norte', `perfil do recruta (${JSON.stringify(pv?.ficha)})`);
const b = s.adicionarJogador('B', 'Beto', undefined, { conta: 10 }); b.criando = false; b.x = j.x + 1; b.z = j.z; b.prog.atr = { for: 20, int: 4, vit: 10, des: 3 };
s.eventos = []; s.verEquip('B', { com: 'A' }); s.verEquip('A', { com: 'B' });
const pj = s.eventos.filter((e) => e.t === 'equipVer').map((e) => e.perfil);
ok(pj[0]?.cla === 'Lobos do Norte' && pj[0].lider && pj[0].raca, 'perfil do jogador: clã e raça');
ok(pj[1]?.estilo === 'Espada' && pj[1].atr.for === 20, `jogador de Força: preferência Espada (${pj[1]?.estilo})`);

// recruta de antes: ficha sorteada pelo id, sempre a mesma; nada some
const velho = { id: 'rcabcdef1234', nome: 'Rita Brasa', g: 'f', tier: 'recruta', ap: {}, jeito: 'medroso mas esforçado, treina escondido', gosto: 'pescar', nv0: 1, nv: 5 };
const v1 = claValido({ n: 'Lobos do Norte', m: [velho] }).m[0], v2 = claValido({ n: 'Lobos do Norte', m: [velho] }).m[0];
ok(v1.lu && JSON.stringify(v1.lu) === JSON.stringify(v2.lu) && v1.nv === 5 && v1.gosto === 'pescar', `recruta de antes ganha ficha fixa (${JSON.stringify(v1.lu)})`);
ok(v1.lu.co <= 0.4, 'o medroso não sai corajoso');
ok(JSON.stringify(claValido({ n: 'Lobos do Norte', m: [v1] }).m[0].lu) === JSON.stringify(v1.lu), 'a ficha fica salva');
ok(JSON.stringify(fichaLuta({ id: 'rcx1y2z3w4' })) === JSON.stringify(fichaLuta({ id: 'rcx1y2z3w4' })), 'fichaLuta é fixa');
// os bots de sempre mantêm o jeito deles
ok(CEREBRO.jeitos.cecilia.cajado === 0.25 && CEREBRO.jeitos.lis.cajado === 0.95, 'Cecília, Lis e cia. com o jeito de antes');

// a ficha do jogador: opcional, só escolhas, fica na conta, aparece no perfil
{
  const { progressoValido } = await import('../../shared/index.js');
  s.fichaJogador('B', { j: 1, e: 'magia', g: 'pescar', lixo: 'x' });
  ok(JSON.stringify(b.prog.fic) === '{"j":1,"e":"magia","g":"pescar"}', 'jogador preenche a ficha');
  ok(JSON.stringify(progressoValido(JSON.parse(JSON.stringify(b.prog))).fic) === JSON.stringify(b.prog.fic), 'a conta guarda a ficha');
  s.eventos = []; s.verEquip('A', { com: 'B' });
  const f = s.eventos.find((e) => e.t === 'equipVer')?.perfil?.ficha;
  ok(f?.estilo === 'Magia' && f.gosto === 'Pescar' && /Brincal/.test(f.jeito), `aparece no perfil (${JSON.stringify(f)})`);
  s.fichaJogador('B', { j: 99, e: 'x' });
  ok(!b.prog.fic, 'em branco (ou inválido): sem ficha');
  s.eventos = []; s.verEquip('A', { com: 'B' });
  ok(!s.eventos.find((e) => e.t === 'equipVer')?.perfil?.ficha, 'perfil sem ficha quando em branco');
}

// Clã e recrutas (André 2026-11-22, shared/cla.js): fundar o clã, contratar no Recrutador (3 níveis), o recruta ganha
// corpo perto do líder e é amigo dele, só o líder conversa, a semana sai do cofre, devendo 7 dias vai embora, sai com
// o líder e a conta guarda tudo (progressoValido).
// Uso: node ferramentas/testes/cla.mjs
import { Simulacao, MAPA_CLAREIRA, CLA, progressoValido } from '../../shared/index.js';
import { semanaCla } from '../../shared/cla.js';
import './_tudo-aberto.mjs';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

const s = new Simulacao(MAPA_CLAREIRA);
const j = s.adicionarJogador('A', 'Ana', undefined, { conta: 9 });
j.criando = false; j.ciente = true;
const p = j.prog; p.nivel = 40; p.ouro = 20000;
const avisos = () => s.eventos.filter((e) => e.t === 'aviso' && e.para === 'A').map((e) => e.texto);
const rec = s.mapa.npcs.find((n) => n.funcao === 'recrutador');
ok(rec, `Recrutador na Clareira (${rec?.nome})`);
ok(s.claInfo(j)?.sem === 1, 'sem clã: o app pede o nome');
s.cla('A', { acao: 'fundar', nome: 'x' });
ok(!p.cla, 'nome curto não vale');
s.cla('A', { acao: 'fundar', nome: 'Lobos do Norte' });
ok(p.cla?.n === 'Lobos do Norte' && s.claInfo(j).n === 'Lobos do Norte', 'clã fundado, líder é o jogador');
const I = s.claInfo(j);
ok(I.tiers.map((T) => T.nv).join(',') === '1,20,40', `níveis: recruta 1, veterano 20, elite 40 (${I.tiers.map((T) => T.nv)})`);
ok(I.tiers[0].preco === 150 && I.tiers[1].preco === 800 && I.tiers[2].preco === 3200, `preços ${I.tiers.map((T) => T.preco)}`);

j.x = 30; j.z = 30; s.eventos = [];
s.cla('A', { acao: 'recrutar', tier: 'recruta' });
ok(p.cla.m.length === 0 && avisos().some((t) => t.includes('Recrutador')), 'longe do Recrutador: não contrata');
j.x = rec.x + 1; j.z = rec.z;
s.cla('A', { acao: 'recrutar', tier: 'recruta' });
s.cla('A', { acao: 'recrutar', tier: 'elite' });
ok(p.cla.m.length === 2 && p.ouro === 20000 - 150 - 3200, `contratou 2 (ouro ${p.ouro})`);
const ctxs = s.recrutasNoMundo(j);
ok(ctxs.length === 2 && ctxs.every((x) => x.amiga && Math.hypot(x.amiga.x - j.x, x.amiga.z - j.z) < 4), 'os recrutas aparecem perto do líder');
ok(ctxs.every((x) => x.ehAmigoAmiga(j) && x.podeAmiga('A')), 'são amigos do líder e obedecem a ele');
const elite = ctxs.find((x) => x.AMIGA.id === p.cla.m[1].id);
ok(elite.amiga.prog.nivel === 40, `elite no nível do líder (${elite.amiga.prog.nivel})`);
const b = s.adicionarJogador('B', 'Beto', undefined, { conta: 10 }); b.criando = false;
ok(!elite.podeAmiga('B'), 'outro jogador não manda no recruta dos outros');
ctxs[0].amigaSair('B'); ok(!!ctxs[0].amiga, 'outro jogador sair não tira o recruta');

// semana
for (let i = 0; i < 4; i++) { s.cla('A', { acao: 'recrutar', tier: 'recruta' }); }
ok(p.cla.m.length === CLA.max, `no máximo ${CLA.max} recrutas`);
const sem = semanaCla(p.cla);
s.cla('A', { acao: 'depositar', ouro: sem + 10 });
ok(p.cla.cofre === sem + 10, `depositou (semana do clã ${sem})`);
p.cla.sem = Date.now() - 1; s.cobrarCla(j);
ok(p.cla.cofre === 10 && p.cla.m.every((m) => !m.dev), 'pagou a semana de todos');
p.cla.sem = Date.now() - 1; s.cobrarCla(j);
ok(p.cla.m.every((m) => m.dev), 'cofre vazio: todos devendo');
p.cla.m[0].dev = Date.now() - CLA.calote - 1;
const saiu = p.cla.m[0].id;
s.cobrarCla(j);
ok(p.cla.m.length === CLA.max - 1 && !s.amigosIa.some((x) => x.AMIGA.id === saiu), '7 dias sem pagamento: foi embora');
s.cla('A', { acao: 'dispensar', id: p.cla.m[0].id });
ok(p.cla.m.length === CLA.max - 2, 'dispensou um');

// a conta guarda
const v = progressoValido(JSON.parse(JSON.stringify(p)));
ok(v.cla && v.cla.n === p.cla.n && v.cla.m.length === p.cla.m.length && v.cla.m[0].ap.cabelo === p.cla.m[0].ap.cabelo, 'progressoValido guarda o clã');
// o líder sai: os recrutas saem junto e guardam o save
s.sairRecrutas(j);
ok(s.recrutasNoMundo(j).length === 0 && p.cla.m.every((m) => s.npcSalvos?.has(m.id)), 'saíram com o líder e o save ficou');
s.entrarRecrutas(j);
ok(s.recrutasNoMundo(j).filter((x) => x.amiga).length === p.cla.m.length, 'voltam quando o líder entra');
for (let i = 0; i < 200; i++) s.passo(0.05);
ok(true, 'simulação roda com os recrutas');

// ---------- clã bot (fase 2): Gael lidera os Lobos da Geada e contrata sozinho ----------
{
  const { CLAS_NPC, CLAS_NPC_REGRAS } = await import('../../shared/dados.js');
  const s2 = new Simulacao(MAPA_CLAREIRA);
  const p2 = s2.adicionarJogador('P', 'Pedro', undefined, { conta: 11 }); p2.criando = false;
  let salvo = null; s2.aoClasNpc = (e) => { salvo = JSON.parse(JSON.stringify(e)); };
  s2.carregarClasNpc(null);
  for (const ctx of s2.amigosIa) ctx.amigaEntrar('P', false);
  const gael = s2.amigosIa.find((x) => x.AMIGA.id === 'gael').amiga;
  ok(!!gael, 'Gael no mundo');
  gael.prog.ouro = 50000;
  s2.clasNpc.geada.prox = Date.now() - 1;
  s2.passoClasNpc();
  const E = s2.clasNpc.geada;
  ok(E.m.length === 1 && E.m[0].tier === 'elite', `Gael contratou uma elite (${E.m[0]?.nome})`);
  const rc = s2.amigosIa.find((x) => x.AMIGA.id === E.m[0].id);
  ok(rc?.amiga && rc.AMIGA.raca === 'geada' && rc.AMIGA.guerra && s2.outraRaca(p2, rc.amiga), 'o recruta é da Geada, com jeito de guerra');
  ok(salvo?.geada?.m?.length === 1, 'o estado do clã bot vai para o banco');
  ok(E.prox > Date.now() + (CLAS_NPC_REGRAS.entre - 0.1) * 3600e3, 'a próxima contratação é daqui a horas');
  gael.prog.ouro = 0; E.sem = Date.now() - 1; s2.passoClasNpc();
  ok(E.m.length === 0 && !s2.amigosIa.some((x) => x.AMIGA.id === rc.AMIGA.id), 'sem ouro para a semana: o recruta vai embora');
  const inf = s2.clasNpcInfo(p2);
  ok(inf[0].n === CLAS_NPC[0].n && inf[0].inimigo === 1 && inf[0].membros.includes('Kira'), 'o painel mostra os Lobos da Geada como inimigos');
  ok(!s2.botsDeGuerraLivres('chama').some((x) => x.AMIGA.recruta), 'recruta do jogador não sai em ronda');
  for (let i = 0; i < 100; i++) s2.passo(0.05);
  ok(true, 'simulação roda com o clã bot');
}

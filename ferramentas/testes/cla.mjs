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
s.cla('A', { acao: 'fundar', nome: 'Lobos do Norte' }); p.cla.nv = 6; // vagas abertas (os níveis têm teste em cla-base.mjs)
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
s.removerJogador('B'); // daqui em diante a Ana está sozinha no servidor (com gente online os recrutas ficam: teste mais abaixo)

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
// ao logar, cada um aparece onde a função dele manda (André 2026-11-23: "toda vez que eu logo... ficam do meu lado")
{
  const [m1, m2] = p.cla.m;
  m1.fn = { k: 'recurso', r: 'ferro' }; m2.fn = { k: 'seguir' };
  const r1 = s.recrutasNoMundo(j).find((x) => x.AMIGA.id === m1.id).amiga;
  r1.x = j.x + 60; r1.z = j.z + 20; // farmando longe do líder
  s.sairRecrutas(j);
  ok(m1.pos && Math.abs(m1.pos.x - (j.x + 60)) < 0.2, 'ao sair, guarda onde cada recruta estava');
  ok(progressoValido(JSON.parse(JSON.stringify(p))).cla.m[0].pos?.x === m1.pos.x, 'a conta guarda o lugar');
  s.entrarRecrutas(j);
  const a1 = s.recrutasNoMundo(j).find((x) => x.AMIGA.id === m1.id).amiga, a2 = s.recrutasNoMundo(j).find((x) => x.AMIGA.id === m2.id).amiga;
  const d1 = Math.hypot(a1.x - j.x, a1.z - j.z), d2 = Math.hypot(a2.x - j.x, a2.z - j.z);
  ok(d1 > 40, `Farmar: volta onde estava, longe do líder (${d1.toFixed(1)} m)`);
  ok(d2 < 4, `Me seguir: nasce do lado do líder (${d2.toFixed(1)} m)`);
  m1.fn = { k: 'grind' };
  s.sairRecrutas(j); s.entrarRecrutas(j);
  const g = s.recrutasNoMundo(j).find((x) => x.AMIGA.id === m1.id), c = g.amiga.ia.av?.c;
  ok(c && Math.hypot(g.amiga.x - c.x, g.amiga.z - c.z) < 10, `Grind: já nasce no campo de caça (${c?.nome})`);
}

// ---------- todos iguais (André 2026-11-23): recrutas no mundo enquanto tiver qualquer jogador online ----------
{
  const s9 = new Simulacao(MAPA_CLAREIRA);
  const A = s9.adicionarJogador('A', 'Ana', undefined, { conta: 9 }); A.criando = false; A.ciente = true; A.prog.nivel = 20; A.prog.ouro = 9000;
  const B = s9.adicionarJogador('B', 'Beto', undefined, { conta: 10 }); B.criando = false;
  s9.cla('A', { acao: 'fundar', nome: 'Lobos do Sul' }); A.prog.cla.nv = 6;
  const rc = s9.mapa.npcs.find((n) => n.funcao === 'recrutador'); A.x = rc.x + 1; A.z = rc.z;
  s9.cla('A', { acao: 'recrutar', tier: 'recruta' }); s9.cla('A', { acao: 'recrutar', tier: 'recruta' });
  A.prog.cla.m[0].fn = { k: 'grind' }; A.prog.cla.m[1].fn = { k: 'seguir' }; s9.aplicarFuncoes(A);
  const sair = (id) => { const jj = s9.jogadores.get(id); s9.sairRecrutas(jj); for (const ctx of s9.amigosIa) ctx.amigaSair(id); s9.removerJogador(id); };
  const corpos = () => s9.amigosIa.filter((x) => x.AMIGA.recruta && !x.AMIGA.clanpc && x.amiga).length;
  const claA = A.prog.cla;
  sair('A');
  ok(corpos() === 2, `líder saiu com o Beto online: os 2 recrutas ficam no mundo (${corpos()})`);
  for (let i = 0; i < 100; i++) s9.passo(0.05);
  ok(corpos() === 2, 'seguem jogando sem o líder');
  sair('B');
  ok(corpos() === 0 && s9.amigosIa.some((x) => x.AMIGA.recruta && x.foraDesde), 'servidor vazio: saem e viram simulação');
  const B2 = s9.adicionarJogador('B2', 'Beto', undefined, { conta: 10 }); B2.criando = false;
  s9.entrarRecrutasSemLider([{ conta: 'c9', cla: claA }], 'B2'); // como server/contas.js clasDasContas() manda
  ok(corpos() === 2, `outro jogador entrou: os recrutas da Ana voltam ao mundo sem ela (${corpos()})`);
  const A2 = s9.adicionarJogador('A2', 'Ana', undefined, { conta: 9, progresso: JSON.parse(JSON.stringify(A.prog)) }); A2.criando = false; A2.prog.cla = claA;
  s9.entrarRecrutas(A2);
  ok(corpos() === 2 && s9.recrutasNoMundo(A2).length === 2 && s9.recrutasNoMundo(A2).every((x) => x.amigaDono === 'A2'), 'a Ana entra: assume os mesmos corpos (nada duplica)');
  for (let i = 0; i < 100; i++) s9.passo(0.05);
  ok(true, 'simulação roda');
}

// ---------- farmar drop de monstro (André 2026-11-23: "acrescente a carne crua e tudo que tem no mapa de recursos") ----------
{
  const { RECURSOS_CLA } = await import('../../shared/cla.js');
  const { DROPS } = await import('../../shared/dados.js');
  ok(['carne', 'tecido', 'fragmento', 'couro'].every((k) => RECURSOS_CLA[k]?.coleta === 'cacar'), 'carne, tecido, fragmento e couro no Farmar recurso');
  const s8 = new Simulacao(MAPA_CLAREIRA);
  for (const item of ['carne', 'tecido', 'fragmento']) {
    const c = s8.campoDoDrop({ prog: { nivel: 20 } }, item);
    ok(c && c.tipos.some((t) => DROPS[t]?.mat?.[item]), `${item}: campo que solta (${c?.nome})`);
  }
}

// ---------- Fragmento de Alma (André 2026-11-23: "eles vão caçar geadas para matar") ----------
{
  const { RECURSOS_CLA } = await import('../../shared/cla.js');
  ok(RECURSOS_CLA.alma?.coleta === 'guerra', 'Fragmento de Alma no Farmar recurso');
  const s9 = new Simulacao(MAPA_CLAREIRA);
  const L = s9.adicionarJogador('L9', 'Chefe', undefined, { conta: 41 }); L.criando = false; L.ciente = true; L.prog.nivel = 40; L.prog.ouro = 90000;
  const r9 = s9.mapa.npcs.find((n) => n.funcao === 'recrutador'); L.x = r9.x + 1; L.z = r9.z;
  s9.cla('L9', { acao: 'fundar', nome: 'Teste Alma' }); L.prog.cla.nv = 6; s9.cla('L9', { acao: 'recrutar', tier: 'recruta' });
  const m = L.prog.cla.m[0], x = s9.recrutasNoMundo(L)[0], a = x.amiga;
  s9.cla('L9', { acao: 'funcao', id: m.id, fn: { k: 'recurso', r: 'alma' } });
  ok(a.ia.funcao?.k === 'alma' && !a.ia.levar, 'recruta com a função de caçar a outra raça');
  const G = s9.adicionarJogador('G9', 'Inimigo', undefined, { conta: 42 }); G.criando = false; G.ciente = true; G.prog.nivel = 40;
  G.raca = G.prog.raca = s9.racaDe(a) === 'geada' ? 'chama' : 'geada';
  a.prog.nivel = 40; a.x = 0; a.z = 0; G.x = 12; G.z = 0; L.x = 300; L.z = 300; s9.guerraT = 0;
  const d0 = Math.hypot(G.x - a.x, G.z - a.z);
  for (let k = 0; k < 60; k++) s9.passo(0.1);
  ok(a.guerra && (a.ia.alma?.alvo === G.id || a.ia.guerra?.alvo === G.id), `achou o inimigo (guerra ${!!a.guerra})`);
  ok(Math.hypot(G.x - a.x, G.z - a.z) < d0 || G.vida < G.vidaMax, 'foi atrás dele');
  ok(s9.fazendoRecruta?.(a)?.includes?.('raça') ?? true, 'status: caçando a outra raça');
  a.ia.guerra = null; G.vida = G.vidaMax; G.x = a.x + 60; G.z = a.z; const d1 = 60;
  for (let k = 0; k < 40; k++) s9.passo(0.1);
  ok(a.ia.alma?.alvo === G.id || a.ia.guerra?.alvo === G.id, 'inimigo longe (60 m): vai buscar');
  ok(Math.hypot(G.x - a.x, G.z - a.z) < d1 - 3, `aproximou (${Math.hypot(G.x - a.x, G.z - a.z).toFixed(1)} m)`);
  s9.removerJogador('G9');
  for (let k = 0; k < 40; k++) s9.passo(0.1);
  ok(a.ia.funcao?.k === 'alma' && !a.ia.alma.alvo, 'sem inimigo: segue procurando (ronda da outra raça)');
}

// ---------- clã bot (fase 2): Gael lidera os Lobos da Geada e contrata sozinho ----------
{
  const { CLAS_NPC, CLAS_NPC_REGRAS, vagasClaNpc } = await import('../../shared/dados.js');
  const s2 = new Simulacao(MAPA_CLAREIRA);
  const p2 = s2.adicionarJogador('P', 'Pedro', undefined, { conta: 11 }); p2.criando = false;
  let salvo = null; s2.aoClasNpc = (e) => { salvo = JSON.parse(JSON.stringify(e)); };
  s2.carregarClasNpc(null);
  for (const ctx of s2.amigosIa) ctx.amigaEntrar('P', false);
  const gael = s2.amigosIa.find((x) => x.AMIGA.id === 'gael').amiga;
  ok(!!gael, 'Gael no mundo');
  gael.prog.ouro = 50000;
  ok(s2.clasNpc.geada.nv === 3 && vagasClaNpc(CLAS_NPC[0], 3) === 0, 'Lobos da Geada começam no Nv 3 (Kira, Rufo, Lis): sem vaga até subir');
  s2.clasNpc.geada.nv = 6; // vagas abertas para testar a contratação
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
{
  const { CLAS_NPC, vagasClaNpc, CLA: C2 } = await import('../../shared/dados.js');
  ok(vagasClaNpc(CLAS_NPC[0]) === 3 && C2.max === 6, 'todos os clãs iguais: Lobos da Geada = Kira, Rufo, Lis + 3 recrutas (6 além do líder)');
}
{
  const { CLAS_NPC, vagasClaNpc, NPC_SOLDADO } = await import('../../shared/dados.js');
  const ch = CLAS_NPC.find((C) => C.id === 'chama');
  ok(ch && ch.lider === 'dario' && vagasClaNpc(ch) === 4, 'Guarda da Chama: Dario líder, Cecília e Lia + até 4 recrutas');
  const s3 = new Simulacao(MAPA_CLAREIRA);
  const q = s3.adicionarJogador('Q', 'Quim', undefined, { conta: 12 }); q.criando = false;
  s3.carregarClasNpc(null);
  const I3 = s3.clasNpcInfo(q);
  ok(I3.find((K) => K.n === 'Guarda da Chama').inimigo === 0 && I3.find((K) => K.n === 'Lobos da Geada').inimigo === 1, 'mesma raça = neutro, outra = inimigo');
  for (const ctx of s3.amigosIa) ctx.amigaEntrar('Q', false);
  const dario = s3.amigosIa.find((x) => x.AMIGA.id === 'dario');
  ok(NPC_SOLDADO.ligado && dario.ehAmigoAmiga(q) && dario.vontadeAmiga(dario.amiga, q).p === 0, 'clã bot neutro conversa, mas não obedece a outro jogador');
  s3.eventos = [];
  for (let i = 0; i < 2400; i++) s3.passo(0.25);
  const papo = s3.eventos.filter((e) => e.t === 'chat' && e.para === 'Q' || (e.t === 'fala' && e.para === 'Q'));
  ok(papo.length === 0, `soldado não manda mensagem sozinho em 10 min (${papo.length})`);
}

// painel: status (vida, mana, vigor) e funções (André 2026-11-22)
{
  const s4 = new Simulacao(MAPA_CLAREIRA);
  const L = s4.adicionarJogador('L', 'Lia Líder', undefined, { conta: 20 }); L.criando = false; L.ciente = true;
  L.prog.nivel = 20; L.prog.ouro = 50000;
  const r4 = s4.mapa.npcs.find((n) => n.funcao === 'recrutador'); L.x = r4.x + 1; L.z = r4.z;
  s4.cla('L', { acao: 'fundar', nome: 'Teste Painel' }); L.prog.cla.nv = 6;
  for (let i = 0; i < 3; i++) s4.cla('L', { acao: 'recrutar', tier: 'veterano' });
  const c = L.prog.cla, I = s4.claInfo(L);
  ok(I.eu && I.eu.nv === 20 && I.eu.hpM > 0 && I.eu.mpM > 0 && I.eu.vgM === 100, `painel mostra o líder (${JSON.stringify(I.eu)})`);
  ok(I.m.every((m) => m.on && m.hpM > 0 && m.mpM >= 0 && m.vg >= 0 && m.fn.k === 'livre' && m.fz), 'cada membro: nível, HP, mana, vigor, função e o que faz');
  const [m1, m2, m3] = c.m, ctx = (id) => s4.recrutasNoMundo(L).find((x) => x.AMIGA.id === id);
  s4.cla('L', { acao: 'funcao', id: m1.id, fn: { k: 'seguir' } });
  ok(ctx(m1.id).amiga.time && ctx(m1.id).amiga.time === L.time, 'Me seguir: entra no time do líder');
  s4.cla('L', { acao: 'funcao', id: m2.id, fn: { k: 'proteger', p: m1.id } });
  ok(c.m[1].fn?.k === 'proteger' && ctx(m2.id).amiga.ia.funcao?.p === m1.id, 'Proteger outro membro');
  s4.cla('L', { acao: 'funcao', id: m2.id, fn: { k: 'proteger', p: m2.id } });
  ok(c.m[1].fn?.p === m1.id, 'não protege a si mesmo');
  s4.cla('L', { acao: 'funcao', id: m3.id, fn: { k: 'recurso', r: 'ferro' } });
  const a3 = ctx(m3.id).amiga;
  ok(c.m[2].fn?.r === 'ferro' && (a3.ia.encomenda?.rec === 'ferro' || a3.ia.funcaoSt), `Farmar ferro: vai coletar ou diz por quê (${a3.ia.funcaoSt?.txt || 'coletando'})`);
  s4.cla('L', { acao: 'funcao', id: m3.id, fn: { k: 'grind' } });
  ok(c.m[2].fn?.k === 'grind' && (a3.ia.av || a3.ia.funcaoSt), `Grind: sai para caçar (${a3.ia.funcaoSt?.txt || a3.ia.av?.fase})`);
  s4.cla('L', { acao: 'funcao', id: m1.id, fn: { k: 'livre' } });
  ok(!c.m[0].fn && !ctx(m1.id).amiga.time, 'Livre: sai do time');
  const v4 = progressoValido(JSON.parse(JSON.stringify(L.prog)));
  ok(v4.cla.m[1].fn?.k === 'proteger' && v4.cla.m[2].fn?.k === 'grind', 'a conta guarda as funções');
  // o protetor anda até quem protege
  s4.cla('L', { acao: 'funcao', id: m2.id, fn: { k: 'proteger', p: 'lider' } });
  const a2 = ctx(m2.id).amiga; L.x = a2.x + 15; L.z = a2.z;
  for (let i = 0; i < 40; i++) s4.passo(0.25);
  ok(Math.hypot(a2.x - L.x, a2.z - L.z) < 13, `protetor vai até quem protege (${Math.hypot(a2.x - L.x, a2.z - L.z).toFixed(1)} m)`);
  s4.cla('L', { acao: 'funcao', id: m2.id, fn: { k: 'proteger', p: m1.id } });
  // outro jogador não manda no recruta
  const B = s4.adicionarJogador('B2', 'Outro', undefined, { conta: 21 }); B.criando = false;
  ok(ctx(m2.id).vontadeAmiga(a2, B).p === 0 && !ctx(m2.id).ehAmigoAmiga(B), 'recruta obedece só ao líder dele');
}

// soldado obedece sempre (André 2026-11-22): sem horário; só o vigor zerado recusa
{
  const s5 = new Simulacao(MAPA_CLAREIRA);
  const L = s5.adicionarJogador('L5', 'Chefe', undefined, { conta: 30 }); L.criando = false; L.ciente = true;
  L.prog.nivel = 20; L.prog.ouro = 50000;
  const r5 = s5.mapa.npcs.find((n) => n.funcao === 'recrutador'); L.x = r5.x + 1; L.z = r5.z;
  s5.cla('L5', { acao: 'fundar', nome: 'Teste Ordem' }); L.prog.cla.nv = 6;
  s5.cla('L5', { acao: 'recrutar', tier: 'veterano' });
  const x = s5.recrutasNoMundo(L)[0], a = x.amiga, R = x.rotinaAmiga();
  const { naHoraDe } = await import('../../shared/amiga.js'), { horaDoJogo } = await import('../../shared/progresso.js');
  for (let i = 0; i < 96; i++) { a.prog.dia = i / 96; if (!naHoraDe(R, horaDoJogo(a.prog.dia))) break; }
  a.ia.av = null;
  const v = x.sairCacarAmiga(a, L);
  ok(!naHoraDe(R, horaDoJogo(a.prog.dia)) && v.ok, `fora do horário dele (${horaDoJogo(a.prog.dia).toFixed(0)}h): vai upar mesmo assim`);
  a.ia.av = null; a.prog.vigor = { v: 0, t: Date.now() };
  const v2 = x.sairCacarAmiga(a, L);
  ok(!v2.ok && v2.fala === 'Estou sem vigor, no momento não posso.', `sem vigor: única recusa (${v2.fala})`);
}
{
  const s6 = new Simulacao(MAPA_CLAREIRA);
  const L = s6.adicionarJogador('L6', 'Chefe', undefined, { conta: 31 }); L.criando = false; L.ciente = true; L.prog.nivel = 20; L.prog.ouro = 50000;
  const r6 = s6.mapa.npcs.find((n) => n.funcao === 'recrutador'); L.x = r6.x + 1; L.z = r6.z;
  s6.cla('L6', { acao: 'fundar', nome: 'Teste Troca' }); L.prog.cla.nv = 6; s6.cla('L6', { acao: 'recrutar', tier: 'recruta' });
  const x = s6.recrutasNoMundo(L)[0];
  ok(x.margemAmiga(x.amiga) === 0, 'soldado não cobra nada do líder');
}
// líder fora do jogo: a função continua (conta o tempo quando ele volta)
{
  const s7 = new Simulacao(MAPA_CLAREIRA);
  const L = s7.adicionarJogador('L7', 'Chefe', undefined, { conta: 32 }); L.criando = false; L.ciente = true; L.prog.nivel = 30; L.prog.ouro = 50000;
  const r7 = s7.mapa.npcs.find((n) => n.funcao === 'recrutador'); L.x = r7.x + 1; L.z = r7.z;
  s7.cla('L7', { acao: 'fundar', nome: 'Teste Fora' }); L.prog.cla.nv = 6; s7.cla('L7', { acao: 'recrutar', tier: 'recruta' }); s7.cla('L7', { acao: 'recrutar', tier: 'recruta' });
  const [g, f] = L.prog.cla.m;
  s7.cla('L7', { acao: 'funcao', id: g.id, fn: { k: 'grind' } }); s7.cla('L7', { acao: 'funcao', id: f.id, fn: { k: 'recurso', r: 'ferro' } });
  s7.sairRecrutas(L);
  ok(L.prog.cla.saiu > 0 && !s7.recrutasNoMundo(L).length, 'saiu: anota a hora');
  L.prog.cla.saiu -= 8 * 3600e3;
  s7.entrarRecrutas(L);
  const ag = s7.recrutasNoMundo(L).find((x) => x.AMIGA.id === g.id).amiga, af = s7.recrutasNoMundo(L).find((x) => x.AMIGA.id === f.id).amiga;
  const ferro = af.prog.mochila.reduce((s, o) => s + (o?.k === 'minerio_ferro' ? o.n : 0), 0);
  ok(ag.prog.nivel >= 2 && ag.prog.nivel <= 30, `8 h de grind fora: Nv ${ag.prog.nivel}`);
  ok(ferro > 50, `8 h farmando ferro fora: ${ferro} minérios`);
  ok(!L.prog.cla.saiu && L.prog.cla.log.some((x) => x.txt.startsWith('Fora')), 'o painel conta o que fizeram fora');
}

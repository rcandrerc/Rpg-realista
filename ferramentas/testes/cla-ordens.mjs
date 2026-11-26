// O líder bot comanda o clã (André 2026-11-23, CLAS_NPC_ORDENS em shared/dados.js): ordens pelo que o clã precisa (grind
// para recruta fraco, farmar o que falta para o próximo nível, proteger com inimigo perto, fazenda), peso da
// personalidade do líder, horasDia de caça por dia real no lugar dos 30 min, e mundo vazio com XP real da curva.
// Uso: node ferramentas/testes/cla-ordens.mjs
import { Simulacao, MAPA_CLAREIRA, CLAS_NPC, CLAS_NPC_ORDENS, NPC_VIDA, CLA } from '../../shared/index.js';
import { sortearRecruta } from '../../shared/cla.js';
import './_tudo-aberto.mjs';
import { MORAL as MORAL_REGRA } from '../../shared/dados.js'; MORAL_REGRA.nova = false; // a regra antiga da moral (faixas, Livre, cota de horas) continua atrás de MORAL.nova; a nova: moral-nova.mjs
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

const s = new Simulacao(MAPA_CLAREIRA);
const p = s.adicionarJogador('P', 'Pedro', undefined, { conta: 11 }); p.criando = false;
s.carregarClasNpc(null);
for (const ctx of s.amigosIa) ctx.amigaEntrar('P', false);
const C = CLAS_NPC.find((K) => K.id === 'geada'), E = s.clasNpc.geada, L = s.liderNpc(C);
L.prog.nivel = 40; L.prog.ouro = 99999;
E.nv = 6; // vagas
const T = CLA.tiers[0];
for (let i = 0; i < 3; i++) { const m = sortearRecruta(Math.random, T, 10, Date.now()); m.fn = s.funcaoBotCla(i, false); E.m.push(m); s.criarRecrutaNpc(C, m, true); }
const ctxs = () => s.amigosIa.filter((x) => x.AMIGA.clanpc === 'geada' && x.amiga);
const xs = ctxs(); ok(xs.length === 3, 'três recrutas no clã bot');
xs.forEach((x) => { x.amiga.prog.nivel = 10; x.amiga.prog.xp = 0; });
const meio = () => 0.5; // sem sorte: só necessidade e personalidade

// 1) recruta fraco, clã no nível máximo (nada falta): grind
E.nv = CLA.niveis.length - 1;
s.ordensLiderNpc(C, E, L, xs, false, meio);
ok(E.m.every((m) => m.fn.k === 'grind'), `fracos com caça sobrando: grind (${E.m.map((m) => m.fn.k)})`);

// 2) caça do dia acabou: o líder manda outra coisa (proteger sem nada faltando)
for (const x of xs) { x.grindHojeAmiga(x.amiga); x.amiga.grind.seg = CLAS_NPC_ORDENS.horasDia * 3600; }
ok(xs.every((x) => x.grindAcabouAmiga(x.amiga)), `${CLAS_NPC_ORDENS.horasDia} h de caça no dia: acabou o grind`);
s.ordensLiderNpc(C, E, L, xs, false, meio);
ok(E.m.every((m) => m.fn.k !== 'grind'), `sem caça sobrando: ninguém no grind (${E.m.map((m) => m.fn.k)})`);
for (const x of xs) x.amiga.grind.seg = 30 * 60;
ok(xs.every((x) => !x.grindAcabouAmiga(x.amiga)), 'recruta de clã bot passa dos 30 min antigos (o limite agora é em horas)');
ok(NPC_VIDA.grind.segPorDia === 1800, 'os 30 min dos outros NPCs continuam');

// 3) falta material para o próximo nível: farmam o que falta e se espalham (Dario, construtor)
E.nv = 1; E.bau = Array(CLA.bauCla).fill(null);
xs.forEach((x) => { x.amiga.prog.nivel = 40; x.amiga.grind.seg = 0; x.amiga.prog.vigor = { v: 100, t: Date.now() }; });
s.ordensLiderNpc(C, E, L, xs, false, meio);
const ks = E.m.map((m) => m.fn.k + ':' + (m.fn.r || ''));
ok(E.m.some((m) => m.fn.k === 'recurso'), `do nível do líder e falta lenha/pedra/alma: farmam (${ks})`);
ok(new Set(ks).size > 1, 'não vão todos atrás da mesma coisa');
// sem vigor: não farma (grinda ou protege)
xs.forEach((x) => { x.amiga.prog.vigor = { v: 0, t: Date.now() }; });
s.ordensLiderNpc(C, E, L, xs, false, meio);
ok(E.m.every((m) => !(m.fn.k === 'recurso' && m.fn.r !== 'alma')), `sem vigor: ninguém farma material (${E.m.map((m) => m.fn.k + ':' + (m.fn.r || ''))})`);

// 4) inimigo perto da base: proteger
xs.forEach((x) => { x.amiga.prog.vigor = { v: 100, t: Date.now() }; });
E.nv = CLA.niveis.length - 1; xs.forEach((x) => { x.amiga.grind.seg = CLAS_NPC_ORDENS.horasDia * 3600; });
const B = s.baseDoClaNpc(C) || L;
const inimigo = s.adicionarJogador('Q', 'Quim', undefined, { conta: 12 }); inimigo.criando = false;
ok(s.racaDe(inimigo) && s.racaDe(inimigo) !== 'geada', 'o jogador é da Chama');
Object.assign(inimigo, { x: B.x + 5, z: B.z + 5 });
s.ordensLiderNpc(C, E, L, xs, false, meio);
ok(E.m.some((m) => m.fn.k === 'proteger'), `Chama perto da base: protegem (${E.m.map((m) => m.fn.k)})`);
s.removerJogador('Q');

// 5) personalidade: Gael pesa grind, Dario pesa material
ok(CLAS_NPC_ORDENS.pesos.gael.grind > CLAS_NPC_ORDENS.pesos.dario.grind && CLAS_NPC_ORDENS.pesos.dario.recurso > CLAS_NPC_ORDENS.pesos.gael.recurso, 'Gael agressivo, Dario construtor');

// 6) mundo vazio: XP real pela curva, até horasDia, nunca acima do líder
const [x1, x2] = xs, m1 = E.m.find((m) => m.id === x1.AMIGA.id), m2 = E.m.find((m) => m.id === x2.AMIGA.id);
m1.fn = { k: 'grind' }; m2.fn = { k: 'grind' };
x1.amiga.prog.nivel = 8; x1.amiga.prog.xp = 0; x1.amiga.grind.seg = 0;
L.prog.nivel = 200; x2.amiga.prog.nivel = 99; x2.amiga.prog.xp = 0; x2.amiga.grind.seg = 0;
s.trabalhoFora(x1, m1, 10, L.prog.nivel);
s.trabalhoFora(x2, m2, 10, L.prog.nivel);
ok(x1.amiga.prog.nivel > 8 || x1.amiga.prog.xp > 0, `Nv 8 em 10 h fora (conta ${CLAS_NPC_ORDENS.horasDia} h): Nv ${x1.amiga.prog.nivel} + ${x1.amiga.prog.xp} XP`);
ok(x2.amiga.prog.nivel <= 100, `Nv 99 quase não sobe: Nv ${x2.amiga.prog.nivel} (xp ${x2.amiga.prog.xp})`);
ok(Math.abs(x1.amiga.grind.seg - CLAS_NPC_ORDENS.horasDia * 3600) < 1, 'as horas fora gastam a caça do dia');
const n1 = x1.amiga.prog.nivel; s.trabalhoFora(x1, m1, 5, L.prog.nivel);
ok(x1.amiga.prog.nivel === n1, 'sem caça sobrando no dia: não sobe mais fora');
L.prog.nivel = 10; x1.amiga.prog.nivel = 8; x1.amiga.grind.seg = 0; s.trabalhoFora(x1, m1, 2, L.prog.nivel);
ok(x1.amiga.prog.nivel <= 10, 'fora não passa do nível do líder');

// 7) o passo do clã roda com as ordens
L.prog.nivel = 40; E.ordensT = 0;
for (let i = 0; i < 200; i++) s.passo(0.05);
s.passoClasNpc();
ok(E.ordensT > Date.now(), 'o líder marcou a próxima olhada');
ok(true, 'simulação roda com o líder comandando');

// 8) os membros antigos também são recrutas do líder (André 2026-11-23: "não é para ser fixo")
{
  const s4 = new Simulacao(MAPA_CLAREIRA);
  const q = s4.adicionarJogador('Q', 'Quim', undefined, { conta: 13 }); q.criando = false;
  s4.carregarClasNpc(null);
  for (const ctx of s4.amigosIa) ctx.amigaEntrar('Q', false);
  const G = CLAS_NPC.find((K) => K.id === 'geada'), E4 = s4.clasNpc.geada, L4 = s4.liderNpc(G);
  const kira = s4.amigosIa.find((x) => x.AMIGA.id === 'kira');
  ok(kira?.amiga && s4.fixoClaNpc(kira) && !s4.fixoClaNpc(s4.amigosIa.find((x) => x.AMIGA.id === 'gael')), 'Kira é membro do Gael; o Gael é o líder');
  ok(s4.claDoRecruta(kira)?.bot && s4.claDoRecruta(kira).C.id === 'geada', 'o clã da Kira é o do Gael (Baú do Clã dele)');
  const nv0 = kira.amiga.prog.nivel, itens0 = JSON.stringify(kira.amiga.prog.equip);
  E4.ordensT = 0; s4.passoClasNpc();
  const fx = E4.fx || {};
  ok(['kira', 'rufo', 'lis'].every((id) => fx[id]?.fn), `Kira, Rufo e Lis receberam ordens (${['kira', 'rufo', 'lis'].map((id) => fx[id]?.fn?.k + ':' + (fx[id]?.fn?.r || ''))})`);
  ok(kira.amiga.prog.nivel === nv0 && JSON.stringify(kira.amiga.prog.equip) === itens0, 'continuam com o nível e os itens');
  for (const id of ['kira', 'rufo', 'lis']) fx[id].fn = { k: 'recurso', r: 'lenha' };
  s4.passoClasNpc();
  ok(kira.amiga.ia.levar?.item === 'lenha', 'farmando lenha: leva para o Baú do Clã');
  kira.amiga.grind = { dia: new Date(Date.now() - 3 * 3600000).toISOString().slice(0, 10), seg: 1900 };
  ok(!kira.grindAcabouAmiga(kira.amiga), 'membro antigo também caça até 2 h por dia');
  // o líder sobe o clã com o que tem na mochila e abre vaga
  const N = CLA.niveis[(E4.nv || 1) + 1];
  L4.prog.nivel = Math.max(L4.prog.nivel | 0, N.lider); L4.prog.ouro = N.ouro + 10000;
  E4.bau = Array(CLA.bauCla).fill(null);
  const { guardarQueCabe } = await import('../../shared/progresso.js');
  const { almaDe } = await import('../../shared/dados.js');
  for (const [k, n] of Object.entries(N.mat)) guardarQueCabe(L4.prog.mochila, { k, n });
  guardarQueCabe(L4.prog.mochila, { k: almaDe('geada'), n: N.alma });
  const nvC = E4.nv; E4.prox = Date.now() + 9e9; s4.passoClasNpc();
  ok(E4.nv === nvC + 1, `com o material na mochila do líder o clã sobe (Nv ${nvC} -> ${E4.nv})`);
  E4.prox = Date.now() - 1; s4.passoClasNpc();
  ok(E4.m.length === 1, `abriu vaga e o Gael contratou (${E4.m.map((m) => m.nome)})`);
}

// 9) lista de amigos: dos bots, só o líder de clã do lado do jogador (André 2026-11-23)
{
  const s5 = new Simulacao(MAPA_CLAREIRA);
  const a = s5.adicionarJogador('A', 'Ana', undefined, { conta: 21 }); a.criando = false; a.ciente = true;
  s5.carregarClasNpc(null);
  for (const ctx of s5.amigosIa) ctx.amigaEntrar('A', false);
  s5.eventos = []; s5.enviarAmigos(a);
  const v = s5.eventos.filter((e) => e.t === 'amigos' && e.para === 'A').at(-1)?.virtuais || [];
  ok(v.length >= 1 && v.every((o) => o.nome.startsWith('Dar') || o.nome.startsWith('Dár')), `na lista só o líder da Chama (${v.map((o) => o.nome)})`);
  const lia = s5.amigosIa.find((x) => x.AMIGA.id === 'lia');
  s5.eventos = []; lia.pedidoAmizadeAmiga('A');
  ok(s5.eventos.some((e) => e.t === 'aviso' && /líder de clã/.test(e.texto)), 'pedir amizade para recruta: só líder de clã');
}

// 10) os recrutas do jogador saíram da lista de amigos, mas a Mensagem e o Time continuam (painel do clã, André 2026-11-23)
{
  const s6 = new Simulacao(MAPA_CLAREIRA);
  const j = s6.adicionarJogador('J', 'Ju', undefined, { conta: 31 }); j.criando = false; j.ciente = true;
  j.prog.nivel = 30; j.prog.ouro = 20000;
  s6.cla('J', { acao: 'fundar', nome: 'Os Testes' }); j.prog.cla.nv = 6;
  const rec = s6.mapa.npcs.find((n) => n.funcao === 'recrutador'); j.x = rec.x + 1; j.z = rec.z;
  s6.cla('J', { acao: 'recrutar', tier: 'recruta' });
  const r = s6.recrutasNoMundo(j)[0];
  const I = s6.claInfo(j), mi = I.m[0];
  ok(r && mi.c === r.AMIGA.conta && mi.bid === r.amiga.id, `painel do clã com a conta (Mensagem) e o corpo (Time) do recruta (${mi.c}, ${mi.bid})`);
  s6.eventos = []; s6.enviarAmigos(j);
  const e = s6.eventos.filter((x) => x.t === 'amigos' && x.para === 'J').at(-1);
  ok(!e.virtuais.some((v) => v.c === r.AMIGA.conta) && e.recrutas.some((v) => v.c === r.AMIGA.conta), 'fora da lista de amigos, mas vai em recrutas (toque no mundo e Msg)');
  s6.time('J', { acao: 'convidar', com: mi.bid });
  ok(r.amiga.time && r.amiga.time === j.time && s6.claInfo(j).m[0].time === 1, 'botão Time do painel: entrou no time');
}

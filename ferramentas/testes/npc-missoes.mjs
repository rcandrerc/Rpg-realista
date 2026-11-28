// Cecília e Dario fazem a história e as diárias (André 2026-11-16): "Pra liberar o mapa ele tem que fazer missão,
// igual a gente. E fazer as missões diárias também".
// Uso: node ferramentas/testes/npc-missoes.mjs
import './_missoes-ligadas.mjs'; // missões desligadas no jogo (André 2026-11-27): o motor delas segue testado ligado
import { Simulacao, MAPA_CLAREIRA, DARIO, NPC_VIDA, HISTORIA, DIARIAS } from '../../shared/index.js';
import { missaoAtual, zonaFechadaEm } from '../../shared/historia.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
for (const x of s.amigosIa) x.amigaEntrar('andre', true);
s.passo(0.05);
const dario = s.amigoIaDe(DARIO.id), b = dario.amiga;
ok(b.semTeto, 'Dario é NPC sem teto (faz a própria história)');
// bug até 2026-11-17 ("como a Cecília fez todas as missões?"): ao entrar, a história deles virava "toda feita"
const cec0 = s.amigosIa.find((x) => x.AMIGA.id === 'cecilia').amiga;
ok((b.prog.hist?.p | 0) === 0 && (cec0.prog.hist?.p | 0) === 0, `entram no mundo na missão 1, não com tudo feito (Dario ${b.prog.hist?.p}, Cecília ${cec0.prog.hist?.p})`);
{ dario.guardarAmiga(); ok(s.npcSalvos?.get(DARIO.id)?.histReal === 1, 'o save marca histReal (a história salva vale na próxima entrada)'); }
// recomeço do jogo (André 2026-11-17: "reseta tudo, reseta nível"): save velho (nível 51, história "toda feita") volta ao
// nível 1 e à missão 1; amizade, lembranças e fatos ficam; o jogo antigo fica guardado
{
  const { AMIGA } = await import('../../shared/index.js');
  const s2 = new Simulacao(MAPA_CLAREIRA); s2.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
  const cx = s2.amigosIa.find((x) => x.AMIGA.id === 'cecilia');
  const L = { set amiga(v) { s2.carregarNpc('cecilia', v); }, get amiga() { return s2.npcSalvos?.get('cecilia'); } }, velho = { nivel: 51, xp: 0, ouro: 288004, pontos: 0, mochila: [], equip: {}, barras: {}, hist: { v: 2, p: HISTORIA.length, ac: false, e: 0, n: 0, m: 0 } };
  L.amiga = { t: Date.now(), prog: velho, recomeco: AMIGA.recomeco, amizades: { 7: 6 }, amigosDe: { 7: 1 }, memorias: { 7: ['ele gosta de pescar'] }, fatos: { 7: ['o pai dele morreu'] } };
  cx.amigaEntrar('andre', true); s2.passo(0.05);
  const c = cx.amiga;
  ok((c.prog.nivel | 0) === 1 && (c.prog.hist?.p | 0) === 0 && (c.prog.ouro | 0) < 1000, `recomeçou: nível ${c.prog.nivel}, missão ${c.prog.hist?.p}, ouro ${c.prog.ouro}`);
  ok(c.amizades[7] === 6 && c.amigosDe[7] && c.memorias[7]?.length && c.fatos[7]?.length, 'amizade, lista de amigos, lembranças e fatos ficaram');
  cx.guardarAmiga();
  ok(L.amiga.recomecoJogo === AMIGA.recomecoJogo && L.amiga.antesJogo?.prog?.nivel === 51 && L.amiga.histReal === 1, 'o jogo antigo fica guardado e não recomeça de novo');
  ok(!DARIO.recomecoJogo === false && s2.amigoIaDe('dario').AMIGA.recomecoJogo === AMIGA.recomecoJogo, 'vale para o Dario também');
}
// atrasado na história (nível bem acima da missão de agora): 3x o tempo do dia até alcançar
{ const nv = b.prog.nivel; b.prog.nivel = 51; ok(dario.limiteMissaoAmiga(b) === 3 * 3600, 'nível 51 na missão 1: 3 h de missão por dia'); b.prog.nivel = 1; ok(dario.limiteMissaoAmiga(b) === 3600, 'em dia com a história: 1 h'); b.prog.nivel = nv; }
ok(NPC_VIDA.missao.segPorDia === 3600 && NPC_VIDA.missao.porEtapa === 120, 'missão: até 1 h por dia, uns 2 min por etapa');
b.prog.dia = { h: 10, t: Date.now() };
b.prog.hist = null; b.prog.nivel = 1;
const M0 = missaoAtual(b.prog);
ok(M0?.id === HISTORIA[0].id, `começa pela primeira missão (${M0?.nome})`);
// campo em região fechada: não caça lá enquanto a história não abre
const fechados = s.cacas.map((c) => c.def).filter((c) => zonaFechadaEm(b.prog, c.x, c.z));
b.prog.nivel = 200;
const campos = new Set(); for (let i = 0; i < 60; i++) { const c = dario.campoAmiga(b); if (c) campos.add(c.id); }
ok(!fechados.some((c) => campos.has(c.id)), `não caça em região fechada (${fechados.length} campos fechados, foi em ${campos.size})`);
b.prog.nivel = 1;
// querer a missão: só com missão do nível dele e tempo do dia sobrando
const rr = Math.random; Math.random = () => 0;
ok(dario.querMissaoAmiga(b), 'quer fazer a missão');
dario.missaoHojeAmiga(b); b.missaoDia.seg = 3600;
ok(!dario.querMissaoAmiga(b), 'passou de 1 h hoje: não faz mais');
b.missaoDia = { dia: '2000-01-01', seg: 99999 };
ok(dario.missaoHojeAmiga(b) === 0, 'dia novo: zera');
Math.random = rr;
// rodar a missão: vai até o lugar (aqui teleporta), aceita, trabalha cada etapa e entrega
const porEtapa = NPC_VIDA.missao.porEtapa; NPC_VIDA.missao.porEtapa = 2; NPC_VIDA.missao.segPorDia = 1e9;
const av = { fase: 'missao' }; let voltou = 0; const voltar = () => { voltou++; };
const p0 = b.prog.hist?.p | 0;
for (let i = 0; i < 4000 && (b.prog.hist?.p | 0) < p0 + 2; i++) {
  s.tempo += 0.1;
  const alvo = !b.prog.hist?.ac ? (s.mapa.npcs || []).find((o) => o.id === missaoAtual(b.prog).npc) : av.alvo;
  if (alvo) { b.x = alvo.x; b.z = alvo.z; }
  dario.missaoSozinhoAmiga(b, av, false, voltar, 0.1);
}
ok((b.prog.hist?.p | 0) >= p0 + 2, `entregou duas missões sozinho (agora: ${missaoAtual(b.prog)?.nome})`);
ok(b.missaoDia.seg > 0, 'o tempo de missão do dia conta');
const antes = b.prog.hist.p; b.prog.nivel = 1;
const proxima = missaoAtual(b.prog);
if (proxima && proxima.nv > 1) { const v0 = voltou; dario.missaoSozinhoAmiga(b, av, false, voltar, 0.1); ok(voltou > v0 && b.prog.hist.p === antes, 'missão acima do nível dele: volta e espera'); }
dario.missaoSozinhoAmiga(b, av, true, voltar, 0.1); ok(voltou > 0, 'de noite: volta para a vila');
NPC_VIDA.missao.porEtapa = porEtapa; NPC_VIDA.missao.segPorDia = 3600;
// diárias: com o nível delas, o que ele terminou recebe sozinho na vila
b.prog.nivel = Math.max(DIARIAS.nivel || 1, 10);
ok(dario.temDiarias(b), 'Dario tem diárias');
const st = dario.diariasDe(b), D = DIARIAS.lista[0];
st.n[D.id] = D.n; const ouro0 = b.prog.ouro;
const n = dario.diariasAmiga(b);
ok(n >= 1 && dario.diariasDe(b).r.includes(D.id), `recebeu a diária "${D.nome || D.id}" sozinho`);
ok(b.prog.ouro >= ouro0, 'prêmio entrou');
ok(dario.diariasAmiga(b) === 0, 'não recebe duas vezes');
// diária de plantar de verdade (André 2026-11-17: "até pra gente ter gente pra reflorestar esse mapa"): compra semente na
// Rosa, vai até uma área de plantio e planta 4 árvores que crescem no mapa
{
  const sp = new Simulacao(MAPA_CLAREIRA); sp.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
  for (const x of sp.amigosIa) x.amigaEntrar('andre', true); sp.passo(0.05);
  const dp = sp.amigoIaDe(DARIO.id), bp = dp.amiga;
  bp.prog.nivel = Math.max(DIARIAS.nivel, 10); bp.prog.ouro = 500; bp.prog.dia = { h: 10, t: Date.now() };
  const rr = Math.random; Math.random = () => 0.1;
  ok(dp.diariaQueFaltaAmiga(bp) === 'plantar', 'falta a diária de plantar e ele tem ouro: vai plantar');
  Math.random = rr;
  bp.ia.av = { fase: 'plantar', n: 0, tentou: 0 };
  for (let i = 0; i < 20 * 600 && bp.ia.av.fase === 'plantar'; i++) { dp.passoSozinhoAmiga(bp, 0.05); sp.passo(0.05); }
  const meu = [...sp.plantadas.values()].filter((P) => P.dono === bp.conta);
  ok((dp.diariasDe(bp).n.arvores || 0) >= 4 && meu.length >= 4 && bp.prog.ouro < 500, `plantou ${meu.length} árvores de verdade numa área de plantio (diária ${dp.diariasDe(bp).n.arvores}/4)`);
  Math.random = () => 0.1; ok(dp.diariaQueFaltaAmiga(bp) !== 'plantar', 'diária de plantar feita: não planta de novo hoje'); Math.random = rr;
}
// saberAmiga leva a missão dele para a IA
ok(typeof dario.saberAmiga(b, s.jogadores.get('andre')).missaoDela === 'string', 'a IA sabe a missão dele');

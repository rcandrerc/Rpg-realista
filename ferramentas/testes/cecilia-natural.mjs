// Cecília conversando como gente (André 2026-11-17): "queria que ela fosse tipo um Gemini mesmo, mas pro jogo"; "ela mesmo
// reclamar de coisas, perguntar coisas pessoais"; "se eu falar que meu pai morreu... ela guarda?"; "não quero que ela fique me
// pentelhando"; "quando a IA esgotar... ela dizer que vai descansar... só diz que tá meio ocupada". Sem rede: fetch de mentira.
// Uso: node ferramentas/testes/cecilia-natural.mjs
import { Simulacao, MAPA_CLAREIRA, AMIGA, DARIO, IA_CONVERSA } from '../../shared/index.js';
IA_CONVERSA.ligada = true; // ligada no jogo de novo desde 2026-11-19
import { register } from 'node:module';
import './_amizade-antiga.mjs'; // o jeito antigo (amizade e papo), sem o soldado de 2026-11-22
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { return s === '@rpg/shared' ? { url: ${JSON.stringify(new URL('../../shared/index.js', import.meta.url).href)}, shortCircuit: true } : n(s, c); }`));
const { pensarAmiga, puxarAssunto, iaEsgotada, mensagensConversa } = await import('../../server/ia-amiga.js');
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const pedidos = []; let modo = 'ok';
globalThis.fetch = async (url, op) => {
  const b = JSON.parse(op.body); pedidos.push(b);
  if (modo === 'dia') return { ok: false, status: 429, headers: { get: () => '3600' }, clone() { return this; }, json: async () => ({ error: { message: 'Rate limit reached for model on tokens per day (TPD): Limit 200000' } }) };
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { content: JSON.stringify({ fala: 'E aí, sumido!', acao: 'nada' }) } }] }) };
};
const s = new Simulacao(MAPA_CLAREIRA);
const j = s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
for (const x of s.amigosIa) x.amigaEntrar('andre', true);
s.passo(0.05);
const cec = s.amigosIa.find((x) => x.AMIGA.id === 'cecilia'), dar = s.amigoIaDe(DARIO.id), a = cec.amiga;
a.amigosDe = { [j.conta]: 1 };
// memória longa: 40 mensagens e salvas no banco
const h = cec.chatDeAmiga(j); h.length = 0;
for (let i = 0; i < 60; i++) { cec.ouvirAmiga('andre', 'msg ' + i); }
ok(h.length === 40 && h[0].texto === 'msg 20', `guarda as últimas 40 mensagens (${h.length})`);
const salvas = cec.conversasParaSalvarAmiga(a);
ok(salvas[j.conta]?.length === 40, 'a conversa vai para o banco');
a.ia.conversas = {}; a.conversasSalvas = salvas;
ok(cec.chatDeAmiga(j).length === 40, 'depois de voltar (servidor reiniciou): a conversa volta do banco');
// fatos: só somam, sem repetir, e não somem quando o diário reescreve
cec.anotarAmiga(j.conta, { memorias: ['ele gosta de pescar'], fatos: ['o pai dele morreu', 'ele trabalha num restaurante'] });
cec.anotarAmiga(j.conta, { memorias: ['outra coisa'], fatos: ['O pai dele morreu.', 'ele não gosta de guerreiro'] });
ok(a.fatos[j.conta].length === 3 && a.fatos[j.conta].includes('ele não gosta de guerreiro'), `fatos somam sem repetir (${a.fatos[j.conta].join(' | ')})`);
ok(a.memorias[j.conta].join() === 'outra coisa' && a.fatos[j.conta].includes('o pai dele morreu'), 'o diário reescreve as lembranças, mas os fatos ficam');
const ctx = cec.contextoAmiga('andre');
ok(ctx.fatos.length === 3 && ctx.esforco === 'high', 'a conversa leva os fatos e ela pensa mais (high)');
ok(dar.contextoAmiga('andre').esforco === AMIGA.chat.esforco, 'o Dario pensa tanto quanto ela (André 2026-11-19)');
const sis = mensagensConversa(ctx, 'oi')[0].content;
ok(/Fatos que você SABE/.test(sis) && /restaurante/.test(sis) && /vida dele fora do jogo/.test(sis) && /reclame de algo seu/.test(sis) && /nunca repita a mesma desculpa/.test(sis), 'o prompt pede vida própria, perguntas pessoais, variar e usa os fatos');
pedidos.length = 0; await pensarAmiga(ctx, 'oi', 'chave');
ok(pedidos[0].reasoning_effort === 'high', 'pedido ao Groq com reasoning high');
// puxar assunto: só com quieto, e espaçado (sem encher)
const puxou = []; s.aoPuxarAmiga = (id, ev, amg) => { puxou.push({ id, ev, quem: amg.AMIGA.id }); return Promise.resolve(); };
a.ia.puxaEm = s.tempo + 1; a.ia.chatFila = [];
const d = a.ia.diario[j.conta]; d.ultima = s.tempo; a.ia.ultimaFala = s.tempo;
for (let i = 0; i < 40; i++) s.passo(0.05);
ok(puxou.length === 0, 'logo depois de conversar: não puxa assunto');
s.tempo += AMIGA.chat.puxar.quieto + 5;
s.passo(0.05);
ok(puxou.length === 1 && puxou[0].quem === 'cecilia', 'quieto há 4 min: ela puxa um assunto');
await new Promise((r) => setTimeout(r, 0)); // a IA respondeu
s.tempo += 120; s.passo(0.05);
ok(puxou.length === 1, 'não puxa de novo logo em seguida');
cec.ouvirAmiga('andre', 'opa'); // ele respondeu (sem resposta ela não insiste: cecilia-seguir.mjs)
j.prog.nivel += 1; s.passo(0.05); s.tempo += AMIGA.chat.puxar.eventoMin + 100; s.passo(0.05);
ok(puxou.length === 2 && /subir para o nível/.test(puxou[1].ev || ''), `subiu de nível: ela comenta (${puxou[1]?.ev})`);
ok(/subir para o nível/.test(puxarAssunto(ctx, puxou[1]?.ev)) && /Não chame para caçar/.test(puxarAssunto(ctx, null)), 'o pedido de assunto é sem chamar para caçar');
ok(DARIO.puxaAssunto === true, 'o Dario também puxa assunto (André 2026-11-19)');
// IA acabou no dia: avisa que vai descansar, depois "ocupada" e não entra no time
modo = 'dia'; const r = await pensarAmiga(ctx, 'oi', 'chave-x');
ok(r === null && iaEsgotada('chave-x'), 'limite do dia em todos os modelos: a chave fica marcada');
modo = 'ok'; a.ia.chatFila = [];
cec.cansouIaAmiga('andre');
ok(AMIGA.falas.cansouIa.includes(a.ia.chatFila.at(-1)?.texto), `primeira vez: "${a.ia.chatFila.at(-1)?.texto}"`);
cec.cansouIaAmiga('andre', 'conversa');
ok(AMIGA.falas.ocupadaIa.includes(a.ia.chatFila.at(-1)?.texto), `depois: "${a.ia.chatFila.at(-1)?.texto}"`);
cec.cansouIaAmiga('andre', 'time');
ok(a.ia.chatFila.at(-1)?.texto === AMIGA.falas.recusa.ocupada, 'chamou pro time: "tô meio ocupada"');
ok(cec.decisaoTimeAmiga(a, j).motivo === 'ocupada' && !cec.decisaoTimeAmiga(a, j).aceita, 'não aceita o time enquanto está "ocupada"');
ok(!cec.puxarAssuntoAmiga(a, j), 'e não puxa assunto');
a.semIa[j.conta] = Date.now() - 1;
ok(!cec.semIaAmiga(a, j), 'passado o tempo, volta ao normal');
// pediu com jeito depois do não (André 2026-11-17): reconsidera uma vez; pedir seco de novo dá a mesma resposta
{
  // fora de caçada: o horário dela segue o relógio de verdade (30 s por hora do jogo) e, entre 8h30 e 16h do jogo, ela
  // já está indo caçar; aí "bora pro time?" vira ir junto (cacando) e topa sem sorteio. Era o que fazia o teste falhar às vezes
  a.semIa = {}; a.time = null; j.time = null; a.morto = false; a.ia.av = null;
  const fala = () => a.ia.chatFila.at(-1)?.texto, rr = Math.random;
  const recusar = () => { a.ia.chatFila = []; a.ia.apelou = null; cec.recusarTimeAmiga(a, j, 'vontade'); a.ia.combinado = null; };
  const diz = (t, assunto) => { cec.ouvirAmiga('andre', t); cec.respostaAmiga('andre', { assunto: assunto ?? cec.assuntoAmiga(t) }); return fala(); };
  recusar();
  ok(diz('bora pro time?', 'time') === AMIGA.falas.recusa.jaFalei, 'pedir seco de novo: mesma resposta');
  Math.random = () => 0.5;
  const f1 = diz('por favor, preciso muito da sua ajuda, é importante', 'conversa');
  ok(AMIGA.falas.apeloSim.includes(f1) && cec.combinouAmiga(a), `pediu com jeito: reconsiderou e topou ("${f1}")`);
  recusar(); Math.random = () => 0.999;
  const f2 = diz('pfv vem comigo, é sério', 'conversa');
  ok(AMIGA.falas.apeloNao.includes(f2), `pediu com jeito e ela ainda não pode: desculpa de verdade ("${f2}")`);
  ok(diz('por favor!!', 'time') === AMIGA.falas.recusa.jaFalei, 'implorar de novo na mesma recusa não sorteia outra vez');
  Math.random = rr;
}

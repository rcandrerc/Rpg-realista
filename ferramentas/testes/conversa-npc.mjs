// Conversa dos NPCs (entrega 5, André 2026-11-11): modelo menor do Groq primeiro (o grande de reserva), ficha curta, e
// os aventureiros sem casa não dizem que têm casinha e horta. Sem rede: o fetch é de mentira.
// Uso: node ferramentas/testes/conversa-npc.mjs
import { NPCS_NO_MUNDO } from '../../shared/dados.js'; NPCS_NO_MUNDO.aventureiros = null; // aqui o teste usa os 20 (no jogo andam só os de NPCS_NO_MUNDO)
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { register } from 'node:module';
// sem npm install no servidor: '@rpg/shared' aponta para a pasta shared daqui
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { return s === '@rpg/shared' ? { url: ${JSON.stringify(new URL('../../shared/index.js', import.meta.url).href)}, shortCircuit: true } : n(s, c); }`));
const { pensarAmiga, modelosConversa, salvarResposta } = await import('../../server/ia-amiga.js');
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

const pedidos = [];
let respostas = [];
globalThis.fetch = async (url, op) => {
  const b = JSON.parse(op.body); pedidos.push(b);
  const r = respostas.shift() || { status: 200, fala: 'Oi!' };
  if (r.falhou != null) return { ok: false, status: 400, headers: { get: () => null }, json: async () => ({ error: { code: 'json_validate_failed', failed_generation: r.falhou } }) };
  if (r.status === 200 && r.fala == null) return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { content: '{"fala": "cort' } }] }) };
  return { ok: r.status === 200, status: r.status, headers: { get: (h) => (h === 'retry-after' ? r.retry ?? null : null) }, json: async () => ({ choices: [{ message: { content: JSON.stringify({ fala: r.fala, acao: 'nada' }) } }] }) };
};

ok(modelosConversa().join() === 'openai/gpt-oss-120b,qwen/qwen3.8-27b,openai/gpt-oss-20b', 'grande primeiro (André 2026-11-12: o menor era burro), Qwen 27B (o Llama 70B saiu do Groq) e o menor de reserva');

const s = new Simulacao(MAPA_CLAREIRA);
s.adicionarJogador('andre', 'André', 'ruiva', {});
for (const x of s.amigosIa) x.amigaEntrar('andre', true);
const lia = s.amigosIa.find((x) => x.AMIGA.id === 'lia'), cec = s.amigosIa.find((x) => x.AMIGA.id === 'cecilia');
s.passo(0.05);
lia.amiga.ia.av = { fase: 'cacar', c: { id: 'caca1', tipo: 'puglin' } };
const cl = lia.contextoAmiga('andre');
ok(cl && cl.semCasa && cl.mora === 'a vila' && /caçando .* sozinha/.test(cl.fazendo), `aventureira: sem casa, mora na vila, "${cl?.fazendo}"`);
lia.amiga.ia.av = { fase: 'cacar', coleta: 'pescar', c: { id: 'sp1', x: 0, z: 0 } };
ok(lia.contextoAmiga('andre').fazendo === 'pescando sozinha', 'pescando sozinha: a ficha diz');
lia.amiga.ia.av = { fase: 'cacar', c: { id: 'caca1', tipo: 'puglin' } };
const cc = cec.contextoAmiga('andre');
ok(cc && !cc.semCasa && cc.mora == null, 'Cecília continua com a casa dela');

let v = await pensarAmiga(cl, 'oi, tudo bem?', 'chave-de-teste');
ok(v?.fala === 'Oi!' && pedidos.length === 1 && pedidos[0].model === 'openai/gpt-oss-120b' && pedidos[0].reasoning_effort === 'low', 'conversa usa o modelo grande');
const p = pedidos[0].messages[0].content;
ok(!/casinha e sua horta/.test(p) && /sem casa própria \(mora em a vila\)/.test(p) && !/Casa (pronta|em obra)/.test(p), 'a ficha da aventureira não fala de casa e horta');
ok(!/\n\n/.test(p), `ficha curta, sem linha vazia (${p.length} letras)`);

pedidos.length = 0; respostas = [{ status: 404 }, { status: 200, fala: 'Pelo Qwen.' }];
v = await pensarAmiga(cl, 'oi', 'chave-de-teste');
ok(v?.fala === 'Pelo Qwen.' && pedidos.map((b) => b.model).join() === 'openai/gpt-oss-120b,qwen/qwen3.8-27b' && !('reasoning_effort' in pedidos[1]), 'grande sumiu: cai no Qwen (sem reasoning_effort de gpt-oss)');

// André 2026-11-12: o limite por minuto (429) é de cada modelo; antes desistia e respondia com fala pronta
pedidos.length = 0; respostas = [{ status: 429 }, { status: 429 }, { status: 200, fala: 'Pelo menor.' }];
v = await pensarAmiga(cl, 'oi', 'chave-de-teste');
ok(v?.fala === 'Pelo menor.' && pedidos.length === 3, '429 num modelo: tenta o próximo em vez de cair nas falas prontas');

pedidos.length = 0; respostas = [{ status: 429, retry: '1' }, { status: 200, fala: 'Esperei.' }];
v = await pensarAmiga(cl, 'oi', 'chave-de-teste');
ok(v?.fala === 'Esperei.' && pedidos.map((b) => b.model).join() === 'openai/gpt-oss-120b,openai/gpt-oss-120b', '429 com espera curta: espera e tenta o mesmo modelo');

pedidos.length = 0; respostas = [{ status: 200 }, { status: 200, fala: 'Inteira.' }];
v = await pensarAmiga(cl, 'oi', 'chave-de-teste');
ok(v?.fala === 'Inteira.' && pedidos.length === 2, 'resposta cortada: tenta o próximo modelo');

pedidos.length = 0; respostas = [{ status: 401 }];
v = await pensarAmiga(cl, 'oi', 'chave-de-teste');
ok(v === null && pedidos.length === 1, 'chave errada (401): não gasta outra chamada, o jogo responde pelas regras');

pedidos.length = 0; respostas = [{ status: 429 }, { status: 429 }, { status: 429 }];
v = await pensarAmiga(cl, 'oi', 'chave-de-teste');
ok(v === null && pedidos.length === 3, 'os 3 modelos no limite: o jogo responde pelas regras');

// a regra só passa por cima da IA em pedido curto que muda algo (André 2026-11-12)
s.adicionarJogador('b', 'Beto', 'ruiva', {});
ok(cec.regraValeSobreIaAmiga('andre', 'time', 'bora caçar', 'conversa'), '"bora caçar": pedido curto, vale a regra');
ok(!cec.regraValeSobreIaAmiga('andre', 'time', 'e aí, como foi aquela missão de ontem lá na caverna do norte?', 'conversa'), 'frase comprida com "missão": vale a IA');
const cecA = cec.amiga; cecA.time = 'tz'; s.jogadores.get('andre').time = 'tz';
ok(cec.acaoSemEfeitoAmiga('andre', 'time') && !cec.regraValeSobreIaAmiga('andre', 'time', 'vamos', 'conversa'), 'já no time: "vamos" não é convite, vale a fala da IA');
ok(!cec.acaoSemEfeitoAmiga('andre', 'sairTime'), 'no time: sair do time muda algo');
cecA.time = null; s.jogadores.get('andre').time = null;

pedidos.length = 0;
await pensarAmiga(cc, 'oi', 'chave-de-teste');
ok(/casinha e sua horta/.test(pedidos[0].messages[0].content), 'Cecília ainda fala da casinha e da horta dela');

// André 2026-11-13 ("no começo era como falar com o Gemini; agora respondem sem lógica"): conversa como chat de verdade
pedidos.length = 0; respostas = [];
const cecJ = s.jogadores.get('andre'), hist = cec.chatDeAmiga(cecJ); hist.length = 0;
hist.push({ de: 'ele', texto: 'e aí, beleza?' }, { de: 'ela', texto: 'Tudo ótimo! E você?' }, { de: 'ele', texto: 'de boa' }, { de: 'ele', texto: 'tô cansado' }, { de: 'ela', texto: 'Ih.' }, { de: 'ela', texto: 'Descansa!' });
await pensarAmiga(cec.contextoAmiga('andre'), 'pô, tu tá forte hoje', 'chave-de-teste');
const M = pedidos[0].messages;
ok(M[0].role === 'system' && /Ficha \(só para você saber/.test(M[0].content) && /NÃO puxe assunto de troca/.test(M[0].content), 'regras do jeito de falar no system, ficha separada, sem empurrar troca');
ok(M.slice(1).map((m) => m.role).join() === 'user,assistant,user,assistant,user', `a conversa vai em mensagens de verdade (${M.slice(1).map((m) => m.role).join()})`);
ok(JSON.parse(M[2].content).fala === 'Tudo ótimo! E você?' && JSON.parse(M[4].content).fala === 'Ih. Descansa!', 'as falas dela vão no mesmo JSON que ela devolve (em texto solto o modelo esquecia o JSON)');
ok(M[3].content === 'de boa\ntô cansado' && M[5].content === 'pô, tu tá forte hoje', 'duas dele seguidas juntam; a última mensagem dele por último');
ok(cec.contextoAmiga('andre').conversa.length === 6 && (hist.push(...Array(10).fill({ de: 'ele', texto: 'x' })), cec.contextoAmiga('andre').conversa.length === 12), 'lembra as 12 mensagens guardadas');
hist.length = 0;

pedidos.length = 0; respostas = [{ falhou: 'Descansa então, amanhã a gente encara."}' }];
v = await pensarAmiga(cl, 'tô cansado hoje', 'chave-de-teste');
ok(v?.fala === 'Descansa então, amanhã a gente encara.' && v.assunto === 'conversa' && pedidos.length === 1, 'o Groq recusou o JSON (400) mas mandou a fala: aproveita em vez da fala pronta');
pedidos.length = 0; respostas = [{ falhou: '{"fala": "Oi, tudo b' }, { status: 200, fala: 'Inteira.' }];
v = await pensarAmiga(cl, 'oi', 'chave-de-teste');
ok(v?.fala === 'Inteira.' && pedidos.length === 2, 'JSON cortado no meio da fala: o próximo modelo, nunca meia frase');
ok(salvarResposta('{"fala":"Bora!","acao":"time"}')?.assunto === 'time' && salvarResposta('') === null, 'resposta inteira passa normal');

// varredura (André 2026-11-13: "não tem mais coisa bugando eles?")
ok(!cec.regraValeSobreIaAmiga('andre', 'vir', 'onde você vai caçar hoje?', 'conversa') && !cec.regraValeSobreIaAmiga('andre', 'pescar', 'você gosta de pescar?', 'conversa'), 'pergunta que a IA leu como conversa: vale a IA (não vai até ele nem sorteia recusa)');
ok(cec.regraValeSobreIaAmiga('andre', 'time', 'bora caçar?', 'conversa') && cec.regraValeSobreIaAmiga('andre', 'vir', 'vem cá', 'conversa'), '"bora caçar?" e "vem cá" seguem valendo pelas regras');
const dar = s.amigosIa.find((x) => x.AMIGA.id === 'dario');
const aj = s.jogadores.get('andre'); aj.time = 'tz'; cec.amiga.time = 'tz'; dar.amiga.time = 'tz';
const so = (t) => s.amigosIaChamados('andre', t).map((x) => x.AMIGA.id).sort().join();
ok(so('Dario, bora?') === 'dario' && so('cecilia vem cá') === 'cecilia' && so('bora gente') === 'cecilia,dario' && so('e você Cecília, o que acha do Dario?') === 'cecilia', `no time: chamou pelo nome, só ele responde; sem nome, todos (${so('bora gente')})`);
cec.chatDeAmiga(aj).length = 0; dar.chatDeAmiga(aj).length = 0;
cec.amiga.ia.viaTime = s.tempo + 30; cec.dizerAmiga('Bora, eu levo as poções!', true, 'andre'); cec.passoChatAmiga(cec.amiga);
const hd = dar.chatDeAmiga(aj).at(-1);
ok(hd?.de === 'outro' && hd.nome === 'Cecília' && hd.texto === 'Bora, eu levo as poções!', 'no time, o Dario lê o que a Cecília disse');
pedidos.length = 0; respostas = [];
const cd = dar.contextoAmiga('andre'); cd.time = ['Cecília'];
await pensarAmiga(cd, 'e você, Dario?', 'chave-de-teste');
const MD = pedidos[0].messages;
ok(/chat do time com André e Cecília/.test(MD[0].content) && MD.some((m) => m.role === 'user' && /\(Cecília, no chat do time\): Bora, eu levo as poções!/.test(m.content)), 'a IA do Dario sabe que é conversa em grupo e vê a fala da Cecília');
aj.time = null; cec.amiga.time = null; dar.amiga.time = null; cec.amiga.ia.viaTime = 0;
ok(cec.apelidoAmiga('pode me cahamr de fofinha') && cec.apelidoAmiga('me chama de chefe') && !cec.apelidoAmiga('te chamo pro time') && !cec.apelidoAmiga('vem cá'), '"me chama de fofinha" é apelido: nunca vira "ir até ele" nem time (print do André 2026-11-13)');

// André 2026-11-13: "linguagem muito fofinha... queria que parecesse mais um jogador mesmo"; Cecília mulher, Dario homem
pedidos.length = 0; respostas = [];
await pensarAmiga(cec.contextoAmiga('andre'), 'oi', 'chave-de-teste');
await pensarAmiga(s.amigosIa.find((x) => x.AMIGA.id === 'dario').contextoAmiga('andre'), 'oi', 'chave-de-teste');
const [sc, sd] = pedidos.map((b) => b.messages[0].content);
ok(/jogadora de MMORPG/.test(sc) && /farmar/.test(sc) && /DG/.test(sc) && /Nada de jeito fofinho/.test(sc), 'Cecília fala como jogadora de RPG online (farmar, DG, mob), nada de fofinho');
ok(/Você é mulher: fale de si no feminino/.test(sc) && /jogador de MMORPG/.test(sd) && /Você é homem: fale de si no masculino/.test(sd), 'Cecília no feminino, Dario no masculino');

// André 2026-11-13: "ele acabou de me negar, aí eu falo mais duas palavras, aí do nada ele me chama pra ir caçar"
{
  const aj2 = s.jogadores.get('andre'); aj2.time = null; cec.amiga.time = null; cec.amiga.ia.combinado = 0; cec.amiga.ia.chamado = null;
  cec.amiga.ia.humor = null; cec.amiga.ia.recusaAte = 0;
  const h1 = cec.decisaoTimeAmiga(cec.amiga, aj2, true), h2 = cec.decisaoTimeAmiga(cec.amiga, aj2);
  ok(h1 === h2, 'a vontade de caçar é sorteada uma vez e vale por um tempo (não muda a cada fala)');
  cec.amiga.ia.humor = { ate: s.tempo + 90, conta: aj2.conta, aceita: false, motivo: 'noite' };
  ok(cec.contextoAmiga('andre').humor?.aceita === false, 'a ficha da IA sabe que ela não quer caçar agora');
  pedidos.length = 0; respostas = [];
  await pensarAmiga(cec.contextoAmiga('andre'), 'bora caçar?', 'chave-de-teste');
  ok(/Agora você NÃO quer caçar nem entrar no time \(motivo: é noite/.test(pedidos[0].messages[0].content) && /não convide nem sugira caçar/.test(pedidos[0].messages[0].content), 'a IA recebe a decisão e o motivo antes de falar');
  cec.chatDeAmiga(aj2).length = 0; cec.amiga.ia.chatFila = [];
  cec.respostaAmiga('andre', { assunto: 'time', iaAssunto: 'conversa', fala: 'De noite não, mano. Amanhã a gente farma.' });
  ok(cec.amiga.ia.chatFila.at(-1)?.texto === 'De noite não, mano. Amanhã a gente farma.' && cec.amiga.ia.recusaAte > s.tempo + 120, 'recusou: vale a fala da IA (não a pronta) e o não dura uns minutos');
  s.tempo += 100;
  ok(cec.decisaoTimeAmiga(cec.amiga, aj2).aceita === false && /ACABOU DE RECUSAR/.test((pedidos.length = 0, await pensarAmiga(cec.contextoAmiga('andre'), 'beleza', 'chave-de-teste'), pedidos[0].messages[0].content)), 'duas falas depois ela ainda lembra que recusou');
  cec.amiga.ia.humor = null; cec.amiga.ia.recusaAte = 0;
}

// Conversa dos NPCs (entrega 5, André 2026-11-11): modelo menor do Groq primeiro (o grande de reserva), ficha curta, e
// os aventureiros sem casa não dizem que têm casinha e horta. Sem rede: o fetch é de mentira.
// Uso: node ferramentas/testes/conversa-npc.mjs
import { NPCS_NO_MUNDO } from '../../shared/dados.js'; NPCS_NO_MUNDO.aventureiros = null; // aqui o teste usa os 20 (no jogo andam só os de NPCS_NO_MUNDO)
import { Simulacao, MAPA_CLAREIRA } from '../../shared/index.js';
import { register } from 'node:module';
// sem npm install no servidor: '@rpg/shared' aponta para a pasta shared daqui
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { return s === '@rpg/shared' ? { url: ${JSON.stringify(new URL('../../shared/index.js', import.meta.url).href)}, shortCircuit: true } : n(s, c); }`));
const { pensarAmiga, modelosConversa } = await import('../../server/ia-amiga.js');
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };

const pedidos = [];
let respostas = [];
globalThis.fetch = async (url, op) => {
  const b = JSON.parse(op.body); pedidos.push(b);
  const r = respostas.shift() || { status: 200, fala: 'Oi!' };
  if (r.status === 200 && r.fala == null) return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ choices: [{ message: { content: '{"fala": "cort' } }] }) };
  return { ok: r.status === 200, status: r.status, headers: { get: (h) => (h === 'retry-after' ? r.retry ?? null : null) }, json: async () => ({ choices: [{ message: { content: JSON.stringify({ fala: r.fala, acao: 'nada' }) } }] }) };
};

ok(modelosConversa().join() === 'openai/gpt-oss-120b,llama-3.3-70b-versatile,openai/gpt-oss-20b', 'grande primeiro (André 2026-11-12: o menor era burro), Llama 70B e o menor de reserva');

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

pedidos.length = 0; respostas = [{ status: 404 }, { status: 200, fala: 'Pelo Llama.' }];
v = await pensarAmiga(cl, 'oi', 'chave-de-teste');
ok(v?.fala === 'Pelo Llama.' && pedidos.map((b) => b.model).join() === 'openai/gpt-oss-120b,llama-3.3-70b-versatile' && !('reasoning_effort' in pedidos[1]), 'grande sumiu: cai no Llama (sem reasoning_effort, que o Llama não aceita)');

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

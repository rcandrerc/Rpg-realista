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
  return { ok: r.status === 200, status: r.status, json: async () => ({ choices: [{ message: { content: JSON.stringify({ fala: r.fala, acao: 'nada' }) } }] }) };
};

ok(modelosConversa()[0] === 'openai/gpt-oss-20b' && modelosConversa()[1] === 'openai/gpt-oss-120b', 'menor primeiro, grande de reserva');

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
ok(v?.fala === 'Oi!' && pedidos.length === 1 && pedidos[0].model === 'openai/gpt-oss-20b', 'conversa usa o modelo menor');
const p = pedidos[0].messages[0].content;
ok(!/casinha e sua horta/.test(p) && /sem casa própria \(mora em a vila\)/.test(p) && !/Casa (pronta|em obra)/.test(p), 'a ficha da aventureira não fala de casa e horta');
ok(!/\n\n/.test(p), `ficha curta, sem linha vazia (${p.length} letras)`);

pedidos.length = 0; respostas = [{ status: 404 }, { status: 200, fala: 'Pelo grande.' }];
v = await pensarAmiga(cl, 'oi', 'chave-de-teste');
ok(v?.fala === 'Pelo grande.' && pedidos.map((b) => b.model).join() === 'openai/gpt-oss-20b,openai/gpt-oss-120b', 'modelo menor sumiu: cai no grande');

pedidos.length = 0; respostas = [{ status: 429 }];
v = await pensarAmiga(cl, 'oi', 'chave-de-teste');
ok(v === null && pedidos.length === 1, 'limite da chave (429): não gasta outra chamada, o jogo responde pelas regras');

pedidos.length = 0;
await pensarAmiga(cc, 'oi', 'chave-de-teste');
ok(/casinha e sua horta/.test(pedidos[0].messages[0].content), 'Cecília ainda fala da casinha e da horta dela');

// A ordem das IAs grátis (André 2026-11-19: Gemini primeiro, Groq depois; acabaram os dois, Cecília e Dario deslogam) e a
// chave selada com a chave pública da máquina. Sem rede: fetch de mentira.
// Uso: node ferramentas/testes/ia-cadeia.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { return s === '@rpg/shared' ? { url: ${JSON.stringify(new URL('../../shared/index.js', import.meta.url).href)}, shortCircuit: true } : n(s, c); }`));
process.env.GEMINI_CHAVE = 'AQ.teste-gemini-0000000000000000000000';
process.env.GROQ_CHAVE = 'gsk_teste0000000000000000000000';
const IA = await import('../../server/ia-amiga.js');
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const pedidos = []; let gem = 'ok', grq = 'ok';
const resp = (status, corpo) => ({ ok: status === 200, status, headers: { get: () => null }, json: async () => corpo, clone() { return this; } });
globalThis.fetch = async (url, op) => {
  const corpo = JSON.parse(op.body);
  if (/generativelanguage/.test(url)) {
    pedidos.push({ q: 'gemini', url, corpo });
    if (gem === 'dia') return resp(429, { error: { message: 'Quota exceeded for metric: generate_content_free_tier_requests, limit: 500', details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } });
    if (gem === 'minuto') return resp(429, { error: { message: 'per minute', details: [{ violations: [{ quotaId: 'GenerateRequestsPerMinutePerProjectPerModel-FreeTier' }] }] } });
    return resp(200, { candidates: [{ content: { parts: [{ text: JSON.stringify({ fala: 'Oi do Gemini!', acao: 'nada' }) }] } }] });
  }
  pedidos.push({ q: 'groq', url, corpo });
  if (grq === 'dia') return resp(429, { error: { message: 'Rate limit reached ... tokens per day (TPD)' } });
  return resp(200, { choices: [{ message: { content: JSON.stringify({ fala: 'Oi do Groq!', acao: 'nada' }) } }] });
};
const ctx = { nome: 'Cecília', amigo: 'André', genero: 'f', conversa: [{ de: 'ele', texto: 'oi' }, { de: 'ela', texto: 'oie!' }] };
let r = await IA.pensarAmiga(ctx, 'tudo bem?');
ok(r?.fala === 'Oi do Gemini!' && pedidos.length === 1 && pedidos[0].q === 'gemini', 'o Gemini responde primeiro');
const g = pedidos[0];
ok(/gemini-3\.5-flash-lite:generateContent/.test(g.url), 'modelo Gemini 3.5 Flash Lite (o de maior limite grátis)');
ok(g.corpo.systemInstruction?.parts?.[0]?.text.includes('Cecília') && g.corpo.contents.at(-1).role === 'user' && g.corpo.contents.some((c) => c.role === 'model'), 'as regras vão no systemInstruction e a conversa em turnos (ele = user, ela = model)');
ok(g.corpo.generationConfig.thinkingConfig?.thinkingLevel && g.corpo.generationConfig.thinkingConfig.thinkingBudget == null, 'Gemini 3: pensa por nível (thinkingBudget dá erro 400)');
pedidos.length = 0; gem = 'minuto'; r = await IA.pensarAmiga(ctx, 'e aí?');
ok(r?.fala === 'Oi do Groq!' && pedidos.map((p) => p.q).join() === 'gemini,groq' && IA.iaVoltaEm() === 0, 'limite do minuto do Gemini: o Groq responde e o Gemini continua valendo');
pedidos.length = 0; gem = 'dia'; r = await IA.pensarAmiga(ctx, 'e aí?');
ok(r?.fala === 'Oi do Groq!' && IA.iaVoltaEm() === 0, 'acabou o do dia do Gemini: o Groq segura');
pedidos.length = 0; gem = 'ok'; r = await IA.pensarAmiga(ctx, 'e aí?');
ok(r?.fala === 'Oi do Groq!' && !pedidos.some((p) => p.q === 'gemini'), 'no resto do dia nem tenta o Gemini');
grq = 'dia'; pedidos.length = 0; r = await IA.pensarAmiga(ctx, 'e aí?');
const volta = IA.iaVoltaEm();
ok(r === null && volta > Date.now() && IA.iaEsgotada(''), 'acabaram os dois: sem resposta e o servidor fica sabendo (eles deslogam)');
ok(volta === IA.proximoZeroIa(Date.now()) || Math.abs(volta - IA.proximoZeroIa()) < 5000, `voltam à meia-noite do Pacífico (${new Date(volta).toISOString()})`);
// meia-noite do Pacífico: 08:00 UTC no inverno, 07:00 UTC no verão
ok(new Date(IA.proximoZeroIa(Date.parse('2026-11-19T04:30:00Z'))).toISOString() === '2026-11-19T08:01:00.000Z', 'inverno: zera às 08:00 UTC (05:00 de Brasília)');
ok(new Date(IA.proximoZeroIa(Date.parse('2026-07-01T12:00:00Z'))).toISOString() === '2026-07-02T07:01:00.000Z', 'verão: zera às 07:00 UTC');
// diário (memória) também vai no Gemini primeiro
pedidos.length = 0; gem = 'ok';
const d0 = await IA.escreverDiario({ conversa: [{ de: 'ele', texto: 'meu apelido é Dedé' }], nome: 'André', memoria: [], fatos: [] });
ok(pedidos[0]?.q === 'gemini' || d0 === null, 'a memória (diário) usa a mesma cadeia, Gemini primeiro');

// ---------- chave selada (só a máquina com a chave privada abre) ----------
const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'selo-'));
const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', { modulusLength: 3072 });
fs.writeFileSync(path.join(pasta, 'pub.pem'), publicKey.export({ type: 'spki', format: 'pem' }));
fs.writeFileSync(path.join(pasta, 'k.txt'), 'linha de cima\nChave: AQ.segredo-de-teste-1234567890abcdef\n');
const arq = new URL('../../server/segredos-selados.json', import.meta.url), antes = fs.readFileSync(arq, 'utf8');
try {
  const saida = execFileSync('node', [new URL('../servidor/selar-segredo.mjs', import.meta.url).pathname, 'TESTE_CHAVE', path.join(pasta, 'k.txt'), path.join(pasta, 'pub.pem')]).toString();
  ok(!saida.includes('segredo-de-teste'), 'o selador nunca mostra a chave');
  const sel = JSON.parse(fs.readFileSync(arq, 'utf8'));
  ok(sel.TESTE_CHAVE && !JSON.stringify(sel).includes('segredo-de-teste') && sel.GEMINI_CHAVE, 'grava selada, sem o valor aberto, e mantém as outras');
  const { abrirPacote } = await import('../../server/atualizar.js');
  ok(abrirPacote(sel.TESTE_CHAVE, privateKey).arquivos.TESTE_CHAVE === 'AQ.segredo-de-teste-1234567890abcdef', 'a máquina abre com a chave privada');
  let outra = false; try { abrirPacote(sel.TESTE_CHAVE, crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).privateKey); } catch { outra = true; }
  ok(outra, 'outra chave privada não abre');
} finally { fs.writeFileSync(arq, antes); fs.rmSync(pasta, { recursive: true, force: true }); }

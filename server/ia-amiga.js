// IA grátis da Cecília (André 2026-11-09: conversar com ela "no chat como uma pessoa normal").
// Só liga quando o servidor tem a chave GROQ_CHAVE (Groq, grátis, preferida) ou GEMINI_CHAVE (Google AI Studio); sem chave, sem
// internet, passou do limite do dia ou a IA demorou, devolve null e quem responde são as regras (shared/amiga.js).
// A IA só escreve a fala e escolhe UMA ação da lista; o jogo confere tudo (ela pode recusar o time mesmo assim).
import fs from 'node:fs';
import path from 'node:path';
import { AMIGA } from '@rpg/shared';


// chave de um segredo: do ambiente ou do segredos.json (GROQ_CHAVE ou GEMINI_CHAVE, segredos do GitHub)
function segredo(k) {
  if (process.env[k]) return process.env[k];
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'segredos.json'), 'utf8'))[k] || ''; } catch { return ''; }
}
function chaveGemini() {
  if (process.env.GEMINI_CHAVE) return process.env.GEMINI_CHAVE;
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'segredos.json'), 'utf8')).GEMINI_CHAVE || ''; } catch { return ''; }
}

const ACOES = ['nada', 'time', 'sairTime', 'vir', 'ajuda', 'sim', 'nao'];
let dia = '', usadas = 0;

export function iaLigada() { return !!(segredo('GROQ_CHAVE') || chaveGemini()); }

// a chave Groq que o jogador colou no jogo funciona? (André 2026-11-10: cada um usa a sua, o servidor só guarda)
export async function testarChaveGroq(chave) {
  if (!/^gsk_[A-Za-z0-9]{20,100}$/.test(chave || '')) return false;
  try {
    const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { authorization: `Bearer ${chave}` }, signal: AbortSignal.timeout(8000) });
    return r.ok;
  } catch { return false; }
}

// chaveJogador: a chave Groq de quem está conversando (André 2026-11-10: "a chave é por jogador"). Sem ela, as chaves do servidor
// (contas de teste do André), com o limite do dia.
export async function pensarAmiga(ctx, texto, chaveJogador = '') {
  if (!ctx) return null;
  const chave = chaveJogador ? '' : chaveGemini(); if (!chave && !chaveJogador && !segredo('GROQ_CHAVE')) return null;
  if (!chaveJogador) {
    const hoje = new Date().toISOString().slice(0, 10);
    if (hoje !== dia) { dia = hoje; usadas = 0; }
    if (usadas >= AMIGA.chat.iaPorDia) return null;
    usadas++;
  }
  const modelo = process.env.GEMINI_MODELO || 'gemini-2.5-flash';
  const conversa = ctx.conversa.map((m) => `${m.de === 'ele' ? ctx.amigo : ctx.nome}: ${m.texto}`).join('\n');
  const prompt = `Você é ${ctx.nome}, uma guerreira de anime brincalhona num RPG medieval de fantasia. Você é AMIGA de ${ctx.amigo} (de igual para igual, não serva): tem sua casinha e sua horta na vila inicial, tem vontade própria, pode recusar e pedir favores.
Responda em português do Brasil, como amiga conversando no chat do celular: curta (no máximo 2 frases), divertida, sem emoji demais, sem sair do mundo do jogo (nada de internet, celular ou IA).
Agora: ${ctx.fazendo}. Amizade com ele: ${ctx.amizade} (0 = começo). Seu nível ${ctx.nivel}, o dele ${ctx.nivelAmigo}. ${ctx.noTime ? 'Vocês estão no mesmo time.' : 'Vocês não estão no mesmo time.'} Distância até ele: ${ctx.distancia} m. ${ctx.noite ? 'É noite.' : 'É dia.'} Casa ${ctx.casaPronta ? 'pronta' : 'em obra'}. ${ctx.pedido ? `Você está precisando de ${ctx.pedido}.` : ''} Você tem ${ctx.ouro ?? 0} de ouro${ctx.mochila ? ` e na mochila: ${ctx.mochila}` : ''}. Para trocar, ele toca em você e escolhe Troca (perto). ${ctx.chamou ? `Há pouco você chamou ele (${ctx.chamou}) e espera a resposta.` : ''} ${ctx.comOutro ? `Agora você está acompanhando ${ctx.comOutro} (outro amigo); para fazer algo com ${ctx.amigo}, só depois.` : ''}
${ctx.memoria?.length ? `O que você lembra de ${ctx.amigo} (de outros dias, use com naturalidade quando fizer sentido):\n- ${ctx.memoria.join('\n- ')}` : ''}
${ctx.equip ? `Você está usando: ${ctx.equip}.${ctx.pecaFraca ? ` A peça mais fraca é ${ctx.pecaFraca}; você adoraria uma melhor (ele pode te dar pela troca).` : ''}` : ''}
${ctx.regras?.length ? `Dicas que ${ctx.amigo} te ensinou e você segue: ${ctx.regras.join('; ')}.` : ''}
Conversa até agora:
${conversa || '(nenhuma)'}
${ctx.amigo}: ${texto}
Escolha a ação que a mensagem dele pede: "time" (ele te chama para o time/caçar), "sairTime" (ele quer que você saia do time), "vir" (ele pede para você ir até ele), "ajuda" (ele oferece ajuda ou pergunta se você precisa de algo), "sim"/"nao" (resposta ao seu chamado), "nada" (só conversa).
Se a ação for "time", "vir" ou "sim", a fala ACEITA com alegria (quem decide se dá para ir é o jogo; se não der, ele troca a fala). Nunca recuse na fala.
Devolva só JSON: {"fala": "...", "acao": "nada"}`;
  // Groq (André 2026-11-09: "é mais rápido"): grátis sem cartão, responde em menos de 1 s. Tem preferência; sem ele, Gemini.
  const groq = chaveJogador || segredo('GROQ_CHAVE');
  if (groq) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${groq}` },
        body: JSON.stringify({ model: process.env.GROQ_MODELO || 'openai/gpt-oss-120b', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.9, max_tokens: 400, reasoning_effort: 'low' }),
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) { const v = lerResposta((await r.json())?.choices?.[0]?.message?.content); if (v) return v; }
    } catch { /* cai para o Gemini ou para as regras */ }
  }
  if (!chave) return null;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': chave },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.9, maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 } } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    return lerResposta((await r.json())?.candidates?.[0]?.content?.parts?.[0]?.text);
  } catch { return null; }
}
// {"fala", "acao"} da IA -> { assunto, fala } (ação fora da lista vira conversa)
function lerResposta(txt) {
  let out; try { out = JSON.parse(txt || '{}'); } catch { return null; }
  const fala = typeof out.fala === 'string' ? out.fala.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
  if (!fala) return null;
  return { assunto: ACOES.includes(out.acao) ? (out.acao === 'nada' ? 'conversa' : out.acao) : 'conversa', fala };
}

// ---------- memória (André 2026-11-10: ela aprende com o dia a dia) ----------
// No fim de cada conversa, a IA reescreve o diário dela sobre a pessoa: até AMIGA.memoria.max anotações curtas (junta as
// velhas com o que aconteceu hoje) e marca as dicas que viraram regra no jogo. Usa um modelo menor do Groq, que tem
// limite separado do das respostas. dados = { nome, memoria, regras, conversa }.
const MODELOS_DIARIO = ['llama-3.1-8b-instant', 'openai/gpt-oss-20b'];
export async function escreverDiario(dados, chaveJogador = '') {
  const chave = chaveJogador || segredo('GROQ_CHAVE');
  if (!chave || !dados?.conversa?.length) return null;
  const M = AMIGA.memoria, regras = Object.entries(M.regras).map(([k, r]) => `"${k}" = ${r.texto}`).join('; ');
  const conversa = dados.conversa.map((m) => `${m.de === 'ele' ? dados.nome : AMIGA.nome}: ${m.texto}`).join('\n');
  const prompt = `Você é ${AMIGA.nome}, uma guerreira de um RPG medieval, escrevendo seu diário sobre seu amigo ${dados.nome}.
O que você já lembrava dele:
${dados.memoria.length ? '- ' + dados.memoria.join('\n- ') : '(nada ainda)'}
A conversa de hoje:
${conversa}
Reescreva a lista do que vale lembrar dele (gostos, o que fizeram juntos, promessas, combinados, dicas que ele deu, como ele se sentiu). Junte com o que já lembrava, tire repetições e coisas sem importância. No máximo ${M.max} itens curtos (até ${M.tamanho} letras), em português do Brasil, na primeira pessoa ("ele gosta de...").
Dicas de combate que ele pediu para você seguir (true se ele pediu, false se pediu para parar, deixe de fora se não falou): ${regras}.
Devolva só JSON: {"memorias": ["..."], "regras": {}}`;
  for (const modelo of [...MODELOS_DIARIO, process.env.GROQ_MODELO || 'openai/gpt-oss-120b']) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${chave}` },
        body: JSON.stringify({ model: modelo, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.3, max_tokens: 900 }),
        signal: AbortSignal.timeout(15000),
      });
      if (r.status === 404 || r.status === 400) continue; // modelo saiu do Groq: tenta o próximo
      if (!r.ok) return null; // limite do dia ou chave ruim: fica para a próxima conversa
      const out = JSON.parse((await r.json())?.choices?.[0]?.message?.content || '{}');
      return { memorias: Array.isArray(out.memorias) ? out.memorias : null, regras: out.regras && typeof out.regras === 'object' ? out.regras : null };
    } catch { return null; }
  }
  return null;
}

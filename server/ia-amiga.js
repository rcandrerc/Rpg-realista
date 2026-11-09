// IA grátis da Cecília (André 2026-11-09: conversar com ela "no chat como uma pessoa normal").
// Só liga quando o servidor tem a chave GEMINI_CHAVE (Google AI Studio, plano grátis) no ambiente; sem chave, sem
// internet, passou do limite do dia ou a IA demorou, devolve null e quem responde são as regras (shared/amiga.js).
// A IA só escreve a fala e escolhe UMA ação da lista; o jogo confere tudo (ela pode recusar o time mesmo assim).
import fs from 'node:fs';
import path from 'node:path';
import { AMIGA } from '@rpg/shared';

// a chave: do ambiente ou do segredos.json que a atualização trancada grava ao lado do servidor (segredo GEMINI_CHAVE do GitHub)
function chaveGemini() {
  if (process.env.GEMINI_CHAVE) return process.env.GEMINI_CHAVE;
  try { return JSON.parse(fs.readFileSync(path.join(process.cwd(), 'segredos.json'), 'utf8')).GEMINI_CHAVE || ''; } catch { return ''; }
}

const ACOES = ['nada', 'time', 'sairTime', 'vir', 'ajuda', 'sim', 'nao'];
let dia = '', usadas = 0;

export function iaLigada() { return !!chaveGemini(); }

export async function pensarAmiga(ctx, texto) {
  if (!ctx) return null;
  const chave = chaveGemini(); if (!chave) return null;
  const hoje = new Date().toISOString().slice(0, 10);
  if (hoje !== dia) { dia = hoje; usadas = 0; }
  if (usadas >= AMIGA.chat.iaPorDia) return null;
  usadas++;
  const modelo = process.env.GEMINI_MODELO || 'gemini-2.5-flash';
  const conversa = ctx.conversa.map((m) => `${m.de === 'ele' ? ctx.amigo : ctx.nome}: ${m.texto}`).join('\n');
  const prompt = `Você é ${ctx.nome}, uma guerreira de anime brincalhona num RPG medieval de fantasia. Você é AMIGA de ${ctx.amigo} (de igual para igual, não serva): tem sua casinha e sua horta na vila inicial, tem vontade própria, pode recusar e pedir favores.
Responda em português do Brasil, como amiga conversando no chat do celular: curta (no máximo 2 frases), divertida, sem emoji demais, sem sair do mundo do jogo (nada de internet, celular ou IA).
Agora: ${ctx.fazendo}. Amizade com ele: ${ctx.amizade} (0 = começo). Seu nível ${ctx.nivel}, o dele ${ctx.nivelAmigo}. ${ctx.noTime ? 'Vocês estão no mesmo time.' : 'Vocês não estão no mesmo time.'} Distância até ele: ${ctx.distancia} m. ${ctx.noite ? 'É noite.' : 'É dia.'} Casa ${ctx.casaPronta ? 'pronta' : 'em obra'}. ${ctx.pedido ? `Você está precisando de ${ctx.pedido}.` : ''} ${ctx.chamou ? `Há pouco você chamou ele (${ctx.chamou}) e espera a resposta.` : ''}
Conversa até agora:
${conversa || '(nenhuma)'}
${ctx.amigo}: ${texto}
Escolha a ação que a mensagem dele pede: "time" (ele te chama para o time/caçar), "sairTime" (ele quer que você saia do time), "vir" (ele pede para você ir até ele), "ajuda" (ele oferece ajuda ou pergunta se você precisa de algo), "sim"/"nao" (resposta ao seu chamado), "nada" (só conversa).
Devolva só JSON: {"fala": "...", "acao": "nada"}`;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': chave },
      body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.9, maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 } } }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const j = await r.json();
    const out = JSON.parse(j?.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
    const fala = typeof out.fala === 'string' ? out.fala.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
    if (!fala) return null;
    return { assunto: ACOES.includes(out.acao) ? (out.acao === 'nada' ? 'conversa' : out.acao) : 'conversa', fala };
  } catch { return null; }
}

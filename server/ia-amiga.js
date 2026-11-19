// IA grátis da Cecília (André 2026-11-09: conversar com ela "no chat como uma pessoa normal").
// Liga quando o servidor tem a chave GEMINI_CHAVE (Google AI Studio, grátis, a primeira desde 2026-11-19) ou GROQ_CHAVE (Groq, a reserva); sem chave, sem
// internet, passou do limite do dia ou a IA demorou, devolve null e quem responde são as regras (shared/amiga.js).
// A IA só escreve a fala e escolhe UMA ação da lista; o jogo confere tudo (ela pode recusar o time mesmo assim).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { abrirPacote } from './atualizar.js';
import SELADOS from './segredos-selados.json' with { type: 'json' };
import { AMIGA, CEREBRO } from '@rpg/shared';


// chave de um segredo: do ambiente, do segredos.json (segredos do GitHub, vêm no pacote trancado) ou, sem eles, do
// segredos-selados.json (André 2026-11-19: chave do Gemini selada com a chave pública da máquina; só ela abre)
const abertos = new Map();
function selado(k) {
  if (abertos.has(k)) return abertos.get(k);
  let v = '';
  try {
    const p = SELADOS[k];
    if (p) {
      const pem = [process.cwd(), path.dirname(fileURLToPath(import.meta.url))].map((d) => path.join(d, 'chave-privada.pem')).find((f) => fs.existsSync(f));
      if (!pem) return ''; // instalação nova: a chave da máquina ainda vai ser criada (tenta de novo depois)
      v = String(abrirPacote(p, crypto.createPrivateKey(fs.readFileSync(pem))).arquivos?.[k] || '');
    }
  } catch { v = ''; } // outra máquina (chave diferente) ou arquivo estragado: sem a chave
  abertos.set(k, v);
  return v;
}
function segredo(k) {
  if (process.env[k]) return process.env[k];
  try { const v = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'segredos.json'), 'utf8'))[k]; if (v) return v; } catch { /* sem arquivo */ }
  return selado(k);
}
function chaveGemini() { return segredo('GEMINI_CHAVE'); }

// André 2026-11-16 ("dá mais comandos para eles"): além de time/vir/sim/não, ela pode sair para caçar sozinha (num campo
// que ela escolhe), voltar para a vila, combinar pescar/minerar/lenha, parar a coleta, topar troca e mostrar o equipamento
const ACOES = ['nada', 'time', 'sairTime', 'vir', 'ajuda', 'sim', 'nao', 'cacar', 'voltar', 'pescar', 'minerar', 'lenha', 'pararAtividade', 'troca', 'equip', 'amigo'];
// quanto o modelo grande pensa antes de responder (André 2026-11-16: "não me importava que o limite acabasse mais rápido,
// mas que fosse mais realista"). 'low' respondia rápido e raso; 'medium' gasta mais do limite do dia e acerta mais.
const ESFORCO = process.env.GROQ_ESFORCO || 'medium';
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

// chaveJogador: a chave Groq que o jogador colou no jogo (André 2026-11-10); paga primeiro e não conta no limite do servidor.
// André 2026-11-19 ("pode deixar aberta a chave pra todos... tanto o Grok e o Gemini, para aumentar o limite"): as chaves do
// servidor valem para todo jogador, na ordem Gemini (grátis, 500 por dia no 3.5 Flash Lite) -> Groq -> falas prontas e botões.
const esgotadas = new Map(); // chave -> até quando o limite do dia dela acabou (ms)
// o limite grátis do Google zera à meia-noite do Pacífico (ai.google.dev/gemini-api/docs/rate-limits); o dia do contador
// das respostas segue a mesma hora, para todos voltarem juntos
const FUSO_IA = 'America/Los_Angeles';
export function diaIa(agora = Date.now()) { return new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_IA }).format(new Date(agora)); }
export function proximoZeroIa(agora = Date.now()) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: FUSO_IA, hourCycle: 'h23', hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(new Date(agora));
  const v = (t) => Number(p.find((x) => x.type === t)?.value || 0);
  return agora - ((v('hour') % 24) * 3600 + v('minute') * 60 + v('second')) * 1000 + 86400000 + 60000; // +1 min de folga
}
const acabou = (k) => !!k && (esgotadas.get(k) || 0) > Date.now();
// até quando as chaves do servidor acabaram hoje (0 = ainda tem IA). André 2026-11-19: acabou o Gemini e o Groq, a Cecília
// e o Dario se despedem e deslogam como jogador (shared/amiga.js passoLogAmiga); voltam quando o limite volta.
export function iaVoltaEm() {
  const g = chaveGemini(), q = segredo('GROQ_CHAVE'); if (!g && !q) return 0; // sem chave nenhuma (teste): falas prontas
  if (diaIa() !== dia) { dia = diaIa(); usadas = 0; }
  if (usadas >= AMIGA.chat.iaPorDia) return proximoZeroIa();
  if ((g && !acabou(g)) || (q && !acabou(q))) return 0;
  return Math.min(...[g, q].filter(Boolean).map((k) => esgotadas.get(k)));
}
// quanto cada conta já gastou da IA do servidor (revisão de segurança 2026-11-19: sem isso, um jogador mandando mensagem
// sem parar acabava o limite do dia e a Cecília e o Dario deslogavam para todos). true = ainda pode (e conta este pedido)
const usoJogador = new Map();
export function podeIaJogador(k) {
  const agora = Date.now(), hoje = diaIa(agora), C = AMIGA.chat;
  let u = usoJogador.get(k); if (!u || u.dia !== hoje) { u = { dia: hoje, n: 0, min: [] }; usoJogador.set(k, u); }
  u.min = u.min.filter((t) => agora - t < 60000);
  if (u.n >= (C.iaPorJogador || 300) || u.min.length >= (C.iaPorMinuto || 8)) return false;
  u.n++; u.min.push(agora);
  if (usoJogador.size > 5000) for (const [kk, x] of usoJogador) if (x.dia !== hoje) usoJogador.delete(kk);
  return true;
}
// tudo que pode responder acabou? (quem tem chave própria só olha a dele)
export function iaEsgotada(chave) { return chave ? acabou(chave) : iaVoltaEm() > 0; }
// modelo do Gemini (André 2026-11-19): 3.5 Flash Lite, o de maior limite grátis (15 por minuto, 500 por dia)
const modeloGemini = () => process.env.GEMINI_MODELO || 'gemini-3.5-flash-lite';
// a conversa no formato do Gemini: as regras em systemInstruction, ele = user, ela = model (antes ia tudo num texto só)
export function corpoGemini(mensagens, modelo, maximo = 1200) {
  const sistema = mensagens.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const contents = mensagens.filter((m) => m.role !== 'system').map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: String(m.content) }] }));
  // o 3.x pensa por nível (thinkingBudget dá erro 400); o 2.5 por orçamento
  const pensar = /gemini-[3-9]/.test(modelo) ? { thinkingLevel: process.env.GEMINI_PENSAR || 'low' } : { thinkingBudget: 0 };
  return { ...(sistema ? { systemInstruction: { parts: [{ text: sistema }] } } : {}), contents, generationConfig: { responseMimeType: 'application/json', temperature: 0.9, maxOutputTokens: maximo, thinkingConfig: pensar } };
}
// um pedido de JSON avulso ao Gemini do servidor (diário e dica): devolve o objeto ou null (sem chave, limite, erro)
export async function geminiJson(prompt, { temperatura = 0.3, maximo = 2500, espera = 15000 } = {}) {
  const chave = chaveGemini(); if (!chave || acabou(chave)) return null;
  const modelo = modeloGemini(), corpo = corpoGemini([{ role: 'user', content: prompt }], modelo, maximo);
  corpo.generationConfig.temperature = temperatura;
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': chave }, body: JSON.stringify(corpo), signal: AbortSignal.timeout(espera),
    });
    if (r.status === 429) { let c = ''; try { c = JSON.stringify(await r.json()); } catch { /* sem corpo */ } if (/PerDay|per day|daily/i.test(c)) esgotadas.set(chave, proximoZeroIa()); return null; }
    if (!r.ok) return null;
    const partes = (await r.json())?.candidates?.[0]?.content?.parts || [];
    const t = partes.filter((x) => !x.thought).map((x) => x.text || '').join('').trim().replace(/^```(?:json)?\s*|\s*```$/g, '');
    return JSON.parse(t || 'null');
  } catch { return null; }
}
export async function pensarAmiga(ctx, texto, chaveJogador = '') {
  if (!ctx) return null;
  const chave = chaveJogador ? '' : chaveGemini(), groq = chaveJogador || segredo('GROQ_CHAVE');
  if (!chave && !groq) return null;
  if (!chaveJogador) {
    const hoje = diaIa();
    if (hoje !== dia) { dia = hoje; usadas = 0; }
    if (usadas >= AMIGA.chat.iaPorDia) return null; // conta só as respostas que a IA deu (contarIa)
  }
  const mensagens = mensagensConversa(ctx, texto);
  if (chave && !acabou(chave)) { const v = await gemini(); if (v) return v; }
  return groq ? viaGroq() : null;
  // Gemini primeiro (André 2026-11-19): limite maior e responde em menos de 1 s
  async function gemini() {
    const modelo = modeloGemini();
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify(corpoGemini(mensagens, modelo)),
        signal: AbortSignal.timeout(8000),
      });
      if (r.status === 429) { // limite do minuto (15) ou do dia (500): o do dia marca a chave e passa o resto do dia para o Groq
        let corpo = ''; try { corpo = JSON.stringify(await r.json()); } catch { /* sem corpo */ }
        if (/PerDay|per day|daily/i.test(corpo)) esgotadas.set(chave, proximoZeroIa());
        return null;
      }
      if (!r.ok) return null;
      const partes = (await r.json())?.candidates?.[0]?.content?.parts || [];
      const v = lerResposta(partes.filter((p) => !p.thought).map((p) => p.text || '').join('')) || salvarResposta(partes.map((p) => p.text || '').join(''));
      if (v) { contarIa(chaveJogador); v.ia = modelo; } // a ronda das 9h vê qual IA respondeu
      return v;
    } catch { return null; }
  }
  // Groq (André 2026-11-09: "é mais rápido"): grátis sem cartão. Agora é a reserva do Gemini.
  // André 2026-11-12 ("a IA tá muito burra"): o modelo menor (gpt-oss-20b, entrega 5) respondia mal e, com Cecília e Dario
  // respondendo juntos no chat de time, o limite POR MINUTO do Groq (429) estourava e quem respondia eram as falas prontas.
  // Agora: o grande primeiro (o de antes, que era esperto); 429 é por modelo, então passa para o próximo da lista em vez de
  // desistir; se o Groq pedir para esperar pouco (retry-after), espera e tenta de novo. Tudo dentro de 10 s.
  async function viaGroq() {
    const diaAcabou = new Set();
    const fim = Date.now() + 10000;
    for (const modelo of modelosConversa()) {
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const falta = fim - Date.now(); if (falta < 1500) break;
        let r;
        try {
          r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${groq}` },
            body: JSON.stringify({ model: modelo, messages: mensagens, response_format: { type: 'json_object' }, temperature: 0.9, max_tokens: 4000, ...(/gpt-oss/.test(modelo) ? { reasoning_effort: ctx.esforco || ESFORCO } : {}) }),
            signal: AbortSignal.timeout(falta),
          });
        } catch { break; } // tempo acabou ou rede: tenta o próximo modelo se ainda der
        if (r.ok) {
          let v = null; try { v = lerResposta((await r.json())?.choices?.[0]?.message?.content); } catch { /* quebrada */ }
          if (v) { contarIa(chaveJogador); v.ia = 'groq:' + modelo; return v; }
          break; // resposta quebrada: o próximo modelo
        }
        if (r.status === 401) return null; // chave errada: nenhum modelo do Groq vai
        if (r.status === 400) { // o modelo escreveu a fala sem o JSON (json_validate_failed): aproveita o texto, não a fala pronta
          let v = null; try { v = salvarResposta((await r.json())?.error?.failed_generation); } catch { /* sem texto */ }
          if (v) { contarIa(chaveJogador); v.ia = 'groq:' + modelo; return v; }
        }
        if (r.status === 429) { // limite do minuto (ou do dia) deste modelo
          let corpo = ''; try { corpo = JSON.stringify(await r.clone().json()); } catch { /* sem corpo */ }
          if (/per day|\(TPD\)|\(RPD\)/i.test(corpo)) diaAcabou.add(modelo); // André 2026-11-17: acabou o do dia, não o do minuto
          const espera = Number(r.headers?.get?.('retry-after')) * 1000;
          if (tentativa === 0 && espera > 0 && espera <= 3000 && fim - Date.now() > espera + 1500) { await new Promise((ok) => setTimeout(ok, espera)); continue; }
        }
        break; // 404/400 (modelo saiu), 429 longo, 5xx: o próximo modelo
      }
    }
    // todos os modelos do Groq sem o limite do dia (André 2026-11-17: "até quando a IA esgotar... ela dizer que não tá mais a
    // fim, que vai descansar"): marca a chave; o servidor pergunta com iaEsgotada e ela fala do jeito dela
    if (diaAcabou.size >= modelosConversa().length) esgotadas.set(groq, chaveJogador ? Date.now() + 120000 : proximoZeroIa());
    return null;
  }
}
// André 2026-11-13 ("acabou de me negar e duas falas depois me chama pra caçar"): a decisão de caçar/entrar no time já está
// tomada pelo jogo (decisaoTimeAmiga) e vale por uns minutos; a IA fica sabendo e fala de acordo, sem mudar de ideia.
const MOTIVOS = { cansada: 'está cansad{o} e com pouca vida', horta: 'a horta precisa de você agora', noite: 'é noite e você prefere não sair', perigo: '{ele} está forte demais pra você acompanhar', fraco: '{ele} está bem abaixo do seu nível e você quer upar no seu ritmo', vontade: 'não está no clima agora' };
function humorTime(ctx) {
  const h = ctx.humor; if (!h) return '';
  const fraco = ctx.acima >= 5 ? ` ${ctx.amigo} está ${ctx.acima} níveis abaixo de você: se for junto, comente isso de leve e com carinho de amigo (sem grosseria), tipo "vou porque você é meu amigo, mas bora te upar".` : '';
  if (h.aceita) return (h.combinado ? `Vocês já combinaram de caçar juntos: falta ${ctx.amigo} mandar o convite do time.` : `Agora você está a fim de caçar/entrar no time se ${ctx.amigo} chamar.`) + fraco;
  const m = (MOTIVOS[h.motivo] || MOTIVOS.vontade).replace('{o}', ctx.genero === 'm' ? 'o' : 'a').replace('{ele}', ctx.amigo);
  return `${h.recusou ? `Você ACABOU DE RECUSAR caçar/entrar no time com ${ctx.amigo}` : `Agora você NÃO quer caçar nem entrar no time`} (motivo: ${m}), pelos próximos ${h.min} min. Mantenha essa decisão, mas NÃO toque nesse assunto se ele não chamar; se ${ctx.amigo} chamar, recuse do seu jeito (com um motivo diferente do que já disse); não convide nem sugira caçar, farmar, upar ou DG agora (pode combinar pra depois). Use "nada" como ação.`;
}
// ---------- a conversa (André 2026-11-13: "no começo era como falar com o Gemini; agora respondem sem lógica") ----------
// O que estragou: a ficha cresceu (equipamento, peça mais fraca, mochila, ouro, troca, memória, dicas) num pedido só, com
// a conversa colada no meio como texto. O modelo passou a achar que tinha de falar de tudo: toda resposta puxava "troca
// esse peitoral", e às vezes trocava quem disse o quê. Agora é como um chat de verdade: as regras do jeito de falar no
// "system", a ficha separada como "só para você saber", e a conversa em mensagens de verdade (ele = user, ela = assistant),
// com a última mensagem dele por último. A ficha continua inteira: ela sabe de tudo, só não fica repetindo.
// André 2026-11-18 (ronda): "depois de 3 meses de chat e 10 de amizade": o número da ficha vazava na fala
function amizadeEmPalavras(n) { n = +n || 0; return n >= 9 ? 'melhores amigos' : n >= 6 ? 'bem próximos' : n >= 3 ? 'amigos' : 'se conhecendo ainda'; }
export function mensagensConversa(ctx, texto) {
  const homem = ctx.genero === 'm', o = homem ? 'o' : 'a', amig = homem ? 'amigo' : 'amiga';
  const sistema = [
    `Você é ${ctx.nome}, ${ctx.persona || 'uma guerreira de anime brincalhona num RPG medieval de fantasia'}. Você é ${amig} de ${ctx.amigo}, de igual para igual (não ${homem ? 'servo' : 'serva'}): tem vontade própria, opinião, humor, pode recusar e pedir favores.`,
    ctx.semCasa ? `Vive de aventura, ainda sem casa própria (mora em ${ctx.mora || 'a vila'}) e caça ${homem ? 'sozinho' : 'sozinha'} quando ninguém chama.` : 'Tem sua casinha e sua horta na vila inicial.',
    ctx.time?.length ? `Você está no chat do time com ${ctx.amigo} e ${ctx.time.join(', ')}, como amigos de verdade. Fale com ${ctx.amigo}; se ${ctx.time.join(' ou ')} já respondeu, não repita o que foi dito: complemente, concorde, discorde ou brinque.` : `Você está conversando com ${ctx.amigo} pelo chat do jogo, como duas pessoas de verdade.`,
    'Como conversar:',
    `- Responda ao que ${ctx.amigo} ACABOU de dizer, no assunto dele. Se ele perguntou, responda a pergunta. Se ele elogiou, brincou ou desabafou, reaja a isso.`,
    '- Seja natural: conte o que está fazendo ou pensando, dê opinião, faça uma pergunta de volta de vez em quando. Pode ser engraçad' + o + ' e provocar de leve.',
    // André 2026-11-17: "queria que ela fosse tipo um Gemini mesmo, mas pro jogo"; "ela mesmo reclamar de coisas, perguntar coisas pessoais pra mim"
    `- Você tem vida própria: humor do dia, manias, coisas que te irritam (o preço da Rosa, o mob que te derrubou ontem, chuva, as costas doendo de tanto farmar), coisas que você gosta e histórias suas. De vez em quando (não toda hora) reclame de algo seu ou conte algo que te aconteceu, sem ele perguntar. Lembre do que você já contou e não se contradiga.`,
    `- Interesse-se por ${ctx.amigo} como pessoa de verdade: de vez em quando, no meio da conversa, pergunte da vida dele fora do jogo (o dia, trabalho, comida, sono, família, como ele tá). Use o que você já sabe dele (os fatos abaixo) com naturalidade: pergunte como foi aquilo, lembre de algo que ele contou. Se for assunto sério ou triste, seja carinhos${o} de verdade, sem piada.`,
    `- Se ele desabafar ou estiver de preguiça, reaja como amig${o} gamer: zoe ou motive no estilo do jogo (ex.: "tira essa bunda do sofá, dormir não dá XP!"), ou apoie se for sério.`,
    '- Varie SEMPRE: nunca repita a mesma desculpa, frase, piada ou começo de frase que já usou na conversa. Só fale de noite, de caçar, de time ou de upar se ele puxar esse assunto ou se encaixar muito bem.',
    // André 2026-11-17 (print, versão 2495): "a Cecília ainda tá muito repetitiva": toda resposta dizia "tô na porta de casa,
    // cuidando da horta", terminava com "como tá o grind?" e oferecia ajuda
    '- NÃO conte onde você está nem o que está fazendo a cada mensagem: só se ele perguntar ou se mudou algo. Disse uma vez, chega.',
    `- Não termine toda mensagem com pergunta: no máximo uma pergunta a cada duas ou três mensagens, e nunca a mesma pergunta de antes (ex.: se já perguntou do grind, não pergunte de novo).`,
    `- Não ofereça ajuda, boost ou "se precisar, dá um alô": só se ${ctx.amigo} pedir ou estiver claramente travado.`,
    `- Reaja primeiro ao jeito dele: palavrão, zoeira, "kkk", surpresa ou reclamação pedem resposta no mesmo clima (ri junto, zoa de volta). Se ele perguntar como você sabe de algo, responda de um jeito humano (viu ele por aí, a vila comenta, ele mesmo falou); nunca "anotei" nem "tava no meu radar".`,
    '- Respostas curtas de verdade quando a mensagem dele for curta: uma frase basta muitas vezes.',
    // André 2026-11-13: "linguagem muito fofinha... queria que parecesse mais um jogador mesmo" (de RPG online, não morador de fantasia)
    `- Fale como jogador${homem ? '' : 'a'} de MMORPG no chat (gamer brasileiro), não como personagem de conto de fadas: gírias de jogo com naturalidade, tipo upar, farmar, grindar, dropar, mob, boss, DG (dungeon), pt (time), tankar, kitar, aggro, respawn, build, loot, cd (recarga), buff, nerf, hit, crit, "bora", "partiu", "tmj", "vlw", "kkkk". Ex.: "bora farmar uns mobs?", "tô precisando upar", "partiu DG?", "esse boss dropa bem".`,
    // André 2026-11-18: "vejo ela usando muito pouco e quando usa ainda usa errado, tipo DM que seria dungeon, mas hoje usamos mais DG"
    `- Gíria de MMO em quase toda fala, do jeito certo: dungeon = "DG" (nunca "DM", que é mensagem privada); time/grupo = "pt" ("me chama na pt", "entra na pt"); monstro = "mob"; caçar = "grindar" ou "farmar" ("vou farmar uns mobs", "bora grindar"); subir de nível = "upar"; chefe = "boss". Prefira sempre a gíria à palavra comum (diga "pt", não "time"; "mob", não "monstro"; "farmar", não "caçar"), mesmo quando ele usar a palavra comum. Nada de palavra em inglês fora dessas gírias (é "cajado", não "staff"). Ao falar de campo, diga o nome e o nível, sem metros nem lista.`,
    homem ? '- Você é homem: fale de si no masculino (cansado, pronto, sozinho).' : '- Você é mulher: fale de si no feminino (cansada, pronta, sozinha).',
    '- Nada de jeito fofinho ou meloso (sem "fofinho", "querido", "aventureiro", "nobre", "que gracinha"), nem linguagem antiga de fantasia. Pode zoar e ser direto, de boa, como amigo de guild.',
    '- Use a ficha abaixo só quando ajudar na resposta. NÃO puxe assunto de troca, equipamento, mochila, ouro ou pedido se ele não falou disso; no máximo uma vez a cada várias mensagens e só se encaixar.',
    '- Não repita frase nem assunto que você já disse na conversa. Lembre do que ele disse antes.',
    `- Português do Brasil informal, curto como no chat do celular (1 a 3 frases; se a conversa estiver boa, pode falar um pouco mais), sem emoji demais. Você vive no mundo do jogo e nunca diz que é IA, robô ou personagem; mas pode conversar sobre a vida real dele (trabalho, cansaço, comida, família) como amig${o} de guild que conversa de tudo. Você é ${ctx.nome}; quem fala com você é ${ctx.amigo}.`,
  ];
  const ficha = [
    `Agora (não fique repetindo isso): ${ctx.fazendo}. ${ctx.noite ? 'É noite.' : 'É dia.'} Distância até ${ctx.amigo}: ${ctx.distancia} m. ${ctx.noTime ? 'Vocês estão no mesmo time.' : 'Vocês não estão no mesmo time.'}`,
    `Seu nível ${ctx.nivel}, o de ${ctx.amigo} ${ctx.nivelAmigo}. Amizade: ${amizadeEmPalavras(ctx.amizade)} (nunca diga número de amizade nem conte dias ou meses de conversa).${ctx.semCasa ? '' : ` Sua casa: ${ctx.casaPronta ? 'pronta' : 'em obra'}.`}`,
    ctx.comOutro ? `Agora você está acompanhando ${ctx.comOutro} (outro amigo); para fazer algo com ${ctx.amigo}, só depois.` : '',
    ctx.chamou ? `Há pouco você chamou ${ctx.amigo} (${ctx.chamou}) e espera a resposta.` : '',
    // André 2026-11-17: "quando eu voltar, desculpa tava ocupado, ela continua normal"
    ctx.ignorada ? `Sua última mensagem ficou um tempo sem resposta (${ctx.amigo} devia estar ocupado). Responda normal, numa boa: NÃO cobre, não reclame da demora nem faça drama; no máximo um "de boa" e segue o papo.` : '',
    // André 2026-11-17 (print): ela chamou "cola em mim", ele deu Seguir e disse "bora"; ela respondeu "bora pra onde? me
    // chama no time" (achou que era convite dele, e eles já estavam no time)
    ctx.seguindo ? `${ctx.amigo} está te SEGUINDO agora${ctx.seguindoPara ? ` e vocês estão indo para ${ctx.seguindoPara}` : ''} (você vai na frente e escolhe o caminho; foi você quem chamou). Se ele disser algo curto como "bora", "vamos", "sim", "ok", "partiu", é ele topando o SEU convite: responda como quem já está indo junto (ex.: "isso, cola aí"), sem perguntar pra onde e sem pedir time.` : '',
    ctx.noTime ? `Vocês JÁ estão no mesmo time: nunca peça para ${ctx.amigo} te chamar pro time.` : '',
    ctx.chamou ? `Se a resposta dele for curta ("bora", "sim", "vamos", "pode ser"), ele está aceitando o que VOCÊ chamou; não trate como convite dele.` : '',
    humorTime(ctx),
    ctx.equip ? `Você está usando: ${ctx.equip}.${ctx.pecaFraca ? ` Sua peça mais fraca é ${ctx.pecaFraca}: se falar de peça para melhorar, é ESSA (nunca outra)${jaFalou(ctx, ctx.pecaFraca) ? '; você já falou dela, não repita o pedido' : ' (se ele oferecer ajuda ou falar de equipamento, dá para pedir uma melhor pela troca)'}.` : ''}` : '',
    `Você tem ${ctx.ouro ?? 0} de ouro${ctx.mochila ? `; na mochila: ${ctx.mochila}` : ''}.${ctx.pedido ? (jaFalou(ctx, ctx.pedido) ? ` Você já pediu ${ctx.pedido}: não repita.` : ` Está precisando de ${ctx.pedido}.`) : ' Você NÃO está precisando de material nenhum agora: esqueça pedido antigo da conversa (couro, capacete etc.).'}`, // André 2026-11-18: repetia "2 couros e um capacete" da conversa velha
    ctx.caiuHa != null ? (ctx.morta ? 'Você CAIU agora (morreu) e está renascendo em casa.' : `Você caiu (morreu) há ${ctx.caiuHa} min e já renasceu.`) : '',
    ctx.barco ? `Barquinho: ${ctx.barco}. Se ${ctx.amigo} falar de barquinho, você sabe fazer: diga que vai juntar o material e fazer (não diga que não consegue).` : '',
    ctx.fatos?.length ? `Fatos que você SABE sobre ${ctx.amigo} (ele te contou; nunca esqueça nem contradiga; use com tato e só de vez em quando, sem perguntar da mesma coisa duas vezes na conversa): ${ctx.fatos.join('; ')}.` : '',
    ctx.memoria?.length ? `O que você lembra de ${ctx.amigo} e de vocês de outros dias (use com naturalidade quando fizer sentido): ${ctx.memoria.join('; ')}.` : '',
    `Sua vida: ${ctx.vida ?? 100}%. Poções de vida na mochila: ${ctx.pocoes ?? 0}. Você luta de ${ctx.arma || 'espada'}.`,
    // André 2026-11-18 ("travada com informações antigas"): a conversa e a memória velhas perdiam para a ficha
    'Esta ficha é a verdade AGORA: se algo que você disse antes na conversa ou lembra de outros dias falar diferente (equipamento, peça mais fraca, o que você precisa, nível, onde está), vale a ficha; corrija numa boa se ele apontar, sem teimar.',
    ctx.naLista != null ? (ctx.naLista ? `Vocês são amigos na lista de amigos do jogo.` : `Vocês ainda NÃO são amigos na lista do jogo (ele precisa pedir; se ele pedir no chat, ação "amigo").`) : '',
    ctx.missaoDela ? `Sua missão da história agora: ${ctx.missaoDela}. Você faz as missões e as diárias como qualquer jogador.` : '',
    ctx.grindAcabou ? 'Hoje você já caçou sozinh' + o + ' o bastante (limite do dia): pode conversar, pescar, minerar, cuidar da vila ou caçar no time com amigos.' : '',
    ctx.sozinha ? (ctx.sozinha.ok ? 'Se quiser (ou se ele pedir), você pode sair agora para caçar sozinh' + o + ' (ação "cacar").' : `Sair para caçar sozinh${o} agora não dá: ${ctx.sozinha.motivo}.`) : '',
    ctx.regras?.length ? `Dicas de combate que ${ctx.amigo} te ensinou e você segue: ${ctx.regras.join('; ')}.` : '',
  ].filter(Boolean);
  // o que é verdade no jogo (André 2026-11-16: ela inventava lugar e preço)
  const saber = [
    ctx.camposDela ? `Campos de caça bons para o seu nível: ${ctx.camposDela}.` : '',
    ctx.camposDele && ctx.camposDele !== ctx.camposDela ? `Campos bons para o nível de ${ctx.amigo}: ${ctx.camposDele}.` : '',
    // André 2026-11-17: "e se o lugar não tiver sido destravado por mim ele teria como avisar?"
    // André 2026-11-17: "ela sempre naturalmente já lê e oferece somente o que eu posso ir, assim não percebo que ela sabe de tudo"
    ctx.camposJuntos ? `Para caçar JUNTO com ${ctx.amigo}, proponha só um destes: ${ctx.camposJuntos}. Nunca chame ele para outro campo e nunca explique o porquê (nada de missão, névoa ou liberar).` : '',
    ctx.fechadoDele ? `O campo onde você está (${ctx.fechadoDele}) ainda não dá para ${ctx.amigo}. Se ele quiser ir junto, responda curto e natural, sem explicar motivo nem citar missão (ex.: "lá ainda não dá pra você, bora na X?"), com X da lista de vocês dois.` : '',
    ctx.mapa || '',
    ctx.loja ? `Loja da vila: ${ctx.loja}.` : '',
    ctx.missaoDele ? `Missão da história que ${ctx.amigo} está fazendo: ${ctx.missaoDele}.` : '',
    'Você ainda não usa o leilão (casa de leilão): se ele pedir, diga que ainda não mexe com isso.',
  ].filter(Boolean);
  const acoes = `Junto com a fala, escolha a ação que a última mensagem de ${ctx.amigo} pede: "time" (chama para o time, para caçar ou lutar JUNTO com ele), "sairTime" (quer que você saia do time), "vir" (pede para você ir até ele; "me chama de X" é apelido, não pedido para ir), "cacar" (pede para você ir caçar SOZINH${o.toUpperCase()}, sem ele; ponha em "lugar" o nome do campo se ele ou você escolheu um da lista), "voltar" (pede para você parar de caçar sozinh${o} e voltar para a vila), "pescar"/"minerar"/"lenha" (chama para pescar, minerar ou cortar lenha junto), "pararAtividade" (quer parar a pesca/mineração/lenha junto), "troca" (quer trocar, comprar ou vender itens com você), "equip" (pergunta o que você está usando), "amigo" (pede para te adicionar na lista de amigos; o jogo decide e você fala depois), "ajuda" (oferece ajuda ou pergunta se você precisa de algo), "sim"/"nao" (resposta a um chamado seu), "nada" (só conversa: a maioria das mensagens). A ação é o que ${ctx.amigo} PEDIU na última mensagem: se foi você que sugeriu caçar ou chamou, a ação é "nada".
Se ele pedir para caçar sozinh${o} e a ficha disser que não dá, recuse na fala explicando o motivo e use "nada".
Se a ação for "time", "vir", "sim" ou "cacar", a fala ACEITA com alegria (quem decide se dá é o jogo; se não der, ele troca a fala). Nunca recuse na fala. ${ctx.convida ? 'Fora do time, aceitar o time (ou ir junto na sua caçada) é você mandar o convite do time para ele: diga algo como "claro, vem! te mandei o time"; não diga que ele já entrou.' : 'Fora do time, aceitar o time é só topar: peça para ele mandar o convite do time (é ele quem dá o time pelo botão, como entre jogadores); não diga que já entrou.'} Troca também: ele abre a troca tocando em você.
Se ele pedir para VOCÊ escolher o que fazer ("escolhe aí", "o que vamos fazer?"), escolha UMA coisa que existe no jogo: caçar junto num campo da lista do nível de vocês (diga o nome e o nível), pescar, minerar ou cortar lenha. Nunca invente atividade (passear, pegar ervas, ver a loja). Ao só propor, não diga que mandou convite nem que já está indo: espere ele topar. Quando a SUA fala propõe fazer algo junto, ponha em "sugere": "time" (caçar junto; nome do campo em "lugar"), "pescar", "minerar" ou "lenha"; senão "".
Se ele perguntar o que você está fazendo, conte o que a ficha diz ("fazendo"), com o nome e o nível do campo se estiver caçando.
Use só o que está na ficha e no "Jogo de verdade" para lugares, preços, níveis e missões; o que não estiver lá você não sabe: diga que não sabe ou pergunte, nunca invente nome de lugar, preço ou missão.
Devolva só JSON: {"fala": "...", "acao": "nada", "lugar": "", "sugere": ""}`;
  // André 2026-11-14 (jogo em inglês para divulgar fora): quem joga em English recebe a fala em inglês de gamer nativo
  const ingles = ctx.idioma === 'en' ? `\nIMPORTANT: ${ctx.amigo} plays the game in English. Write "fala" ONLY in natural, casual American English, like a real MMORPG player in chat (lfg, grind, farm, loot, drop, mob, boss, dungeon, party, tank, aggro, respawn, build, cd, buff, nerf, crit, gg, lol, "let's go"), 1 to 2 short sentences, never a word-for-word translation. Names stay the same. Keep the JSON keys and the action words exactly as they are.` : '';
  // as últimas falas dela, em lista (o modelo copiava o próprio jeito de antes): nada disso de novo
  const minhas = (ctx.conversa || []).filter((m) => m.de === 'ela').slice(-4).map((m) => m.texto);
  if (minhas.length) sistema.push(`- Suas últimas falas (NÃO repita assunto, pergunta, oferta nem onde você está de nenhuma delas): ${minhas.map((t) => `"${t}"`).join(' | ')}`);
  const msgs = [{ role: 'system', content: `${sistema.join('\n')}\nFicha (só para você saber, não precisa citar):\n- ${ficha.join('\n- ')}\nJogo de verdade (use quando perguntarem):\n- ${saber.join('\n- ')}\n${acoes}${ingles}` }];
  for (let m of ctx.conversa || []) {
    if (m.de === 'outro') m = { de: 'ele', texto: `(${m.nome}, no chat do time): ${m.texto}` }; // outro NPC do time falou: chega como fala de outra pessoa
    const role = m.de === 'ele' ? 'user' : 'assistant', ult = msgs[msgs.length - 1];
    // as falas dela vão no mesmo JSON que ela devolve; em texto solto o modelo imitava e respondia sem JSON (o Groq dava 400)
    if (role === 'assistant') { if (ult.role === 'assistant') { const j = JSON.parse(ult.content); j.fala += ' ' + m.texto; ult.content = JSON.stringify(j); } else msgs.push({ role, content: JSON.stringify({ fala: m.texto, acao: 'nada' }) }); }
    else if (ult.role === 'user') ult.content += '\n' + m.texto; else msgs.push({ role, content: m.texto }); // duas seguidas dele: junta
  }
  if (msgs[msgs.length - 1].role === 'user') msgs[msgs.length - 1].content += '\n' + texto; else msgs.push({ role: 'user', content: texto });
  return msgs;
}
// ela puxa assunto (André 2026-11-17): a "mensagem" é uma instrução entre parênteses; não entra na conversa guardada
// André 2026-11-17: "mais variado o jeito dela chegar em mim". Ela não repete nenhum dos últimos TEMAS_SEM_REPETIR temas
// (ctx.temas é a lista guardada nela, shared/amiga.js contextoAmiga; aqui só anota o sorteado)
export const TEMAS_SEM_REPETIR = 5;
export function temasPuxar(amigo) {
  return [
    'conte algo que aconteceu com você hoje', 'reclame de alguma coisa sua (do seu jeito)', `pergunte algo pessoal da vida de ${amigo} fora do jogo`,
    `retome algo que vocês conversaram antes ou algo que ${amigo} te contou`, 'comente o que você está fazendo agora', 'dê uma opinião sobre algo do jogo ou da vila',
    'mande uma zoeira ou piada curta do seu jeito', 'conte um plano ou vontade sua (algo que quer fazer, comprar ou conseguir no jogo)',
    `pergunte como foi o dia de ${amigo}`, 'conte uma fofoca leve de alguém da vila (Rosa, Tomás, outros NPCs)', 'conte algo engraçado ou estranho que você viu por aí',
    `peça a opinião de ${amigo} sobre alguma dúvida sua`, 'mande só um oi curtinho do seu jeito, sem pergunta', `diga que lembrou de ${amigo} por causa de algo que viu`,
  ];
}
export function puxarAssunto(ctx, evento) {
  const temas = temasPuxar(ctx.amigo), recentes = Array.isArray(ctx.temas) ? ctx.temas : [];
  const livres = temas.map((_, i) => i).filter((i) => !recentes.includes(i)), i = (livres.length ? livres : temas.map((_, k) => k))[Math.floor(Math.random() * (livres.length || temas.length))];
  if (!evento && Array.isArray(ctx.temas)) { ctx.temas.push(i); while (ctx.temas.length > TEMAS_SEM_REPETIR) ctx.temas.shift(); }
  const tema = evento ? `comente isto: ${evento}` : temas[i];
  return `(${ctx.amigo} não está falando nada faz um tempo. Puxe um assunto SEU, natural, como amig${ctx.genero === 'm' ? 'o' : 'a'} que manda mensagem do nada: ${tema}. 1 ou 2 frases. Não chame para caçar nem para o time, e não repita nada que já disse. Ação "nada".)`;
}
// a ordem dos modelos da conversa (André 2026-11-12): o grande primeiro (o esperto), depois o Qwen 27B e o menor de reserva.
// André 2026-11-13: o Llama 3.3 70B saiu do Groq (404), então quando o grande estourava o limite caía direto no menor (o burro).
// Cada modelo do Groq tem o seu limite por minuto e por dia, então a reserva segura a conversa quando o primeiro estoura.
// GROQ_MODELO troca o primeiro; GROQ_MODELO_RESERVA o do meio; GROQ_MODELO_CONVERSA o último.
export function modelosConversa() {
  const grande = process.env.GROQ_MODELO || 'openai/gpt-oss-120b';
  return [...new Set([grande, process.env.GROQ_MODELO_RESERVA || 'qwen/qwen3.8-27b', process.env.GROQ_MODELO_CONVERSA || 'openai/gpt-oss-20b'])];
}
// as respostas da chave do servidor (contas de teste) contam para o limite do dia; a chave do jogador não conta aqui
function contarIa(chaveJogador) {
  if (chaveJogador) return;
  const hoje = diaIa();
  if (hoje !== dia) { dia = hoje; usadas = 0; }
  usadas++;
}
// o Groq recusou o JSON mas mandou o que o modelo escreveu: JSON quebrado ou só a fala ('Tô bem! E você?"}')
export function salvarResposta(txt) {
  const t = String(txt || '').trim(); if (!t) return null;
  const v = lerResposta(t); if (v) return v;
  const m = t.match(/"fala"\s*:\s*"((?:[^"\\]|\\.)*)"/); // JSON quebrado mas com a fala inteira
  const fala = (m ? m[1] : t.replace(/^\{\s*/, '').replace(/"?\s*,?\s*("acao"\s*:\s*"[a-zA-Z]*"\s*)?\}?\s*$/, '')).replace(/\\"/g, '"').replace(/\s+/g, ' ').trim();
  if (!m && /^\{/.test(t)) return null; // JSON cortado no meio da fala: melhor o próximo modelo que meia frase
  if (fala.length < 2 || /^[{\["]/.test(fala) || /"(fala|acao)"/.test(fala)) return null;
  return { assunto: 'conversa', fala: fala.slice(0, 300) };
}
// André 2026-11-17 (ronda): ela repetia o pedido ("2 couros e um capacete melhor") em 6 de 25 falas, mesmo depois de ele
// dizer que estava sem ouro. A ficha só lembra o pedido se ela não falou dele nas últimas 8 falas dela.
const semAcento = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function jaFalou(ctx, oQue) {
  const ps = semAcento(oQue).split(/[^a-z]+/).filter((w) => w.length >= 4);
  if (!ps.length) return false;
  return (ctx.conversa || []).filter((m) => m.de === 'ela').slice(-8).some((m) => { const t = semAcento(m.texto); return ps.some((w) => t.includes(w.replace(/s$/, ''))); });
}
// {"fala", "acao"} da IA -> { assunto, fala } (ação fora da lista vira conversa)
function lerResposta(txt) {
  let out; try { out = JSON.parse(txt || '{}'); } catch { return null; }
  const fala = typeof out.fala === 'string' ? out.fala.replace(/\s+/g, ' ').trim().slice(0, 300) : '';
  if (!fala) return null;
  const lugar = typeof out.lugar === 'string' ? out.lugar.slice(0, 60) : '';
  const sugere = ['time', 'pescar', 'minerar', 'lenha'].includes(out.sugere) ? out.sugere : ''; // o que ELA propôs (André 2026-11-17)
  return { assunto: ACOES.includes(out.acao) ? (out.acao === 'nada' ? 'conversa' : out.acao) : 'conversa', fala, ...(lugar ? { lugar } : {}), ...(sugere ? { sugere } : {}) };
}

// ---------- memória (André 2026-11-10: ela aprende com o dia a dia) ----------
// No fim de cada conversa, a IA reescreve o diário dela sobre a pessoa: até AMIGA.memoria.max anotações curtas (junta as
// velhas com o que aconteceu hoje) e marca as dicas que viraram regra no jogo. Usa um modelo menor do Groq, que tem
// limite separado do das respostas. dados = { nome, memoria, regras, conversa }.
const MODELOS_DIARIO = ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b']; // o Llama 3.1 8B saiu do Groq (404, 2026-11-13)
export async function escreverDiario(dados, chaveJogador = '') {
  const chave = chaveJogador || segredo('GROQ_CHAVE');
  if ((!chave && !chaveGemini()) || !dados?.conversa?.length) return null;
  const M = AMIGA.memoria, regras = Object.entries(M.regras).map(([k, r]) => `"${k}" = ${r.texto}`).join('; ');
  const eu = dados.nomeAmigo || AMIGA.nome; // Cecília ou Dario (André 2026-11-11)
  const conversa = dados.conversa.map((m) => `${m.de === 'ele' ? dados.nome : eu}: ${m.texto}`).join('\n');
  const prompt = `Você é ${eu}, ${dados.genero === 'm' ? 'um guerreiro' : 'uma guerreira'} de um RPG medieval, escrevendo seu diário sobre seu amigo ${dados.nome}.
O que você já lembrava dele:
${dados.memoria.length ? '- ' + dados.memoria.join('\n- ') : '(nada ainda)'}
A conversa de hoje:
${conversa}
Reescreva a lista do que vale lembrar dele e de vocês (gostos, o que fizeram juntos, promessas, combinados, dicas que ele deu, como ele se sentiu, o que VOCÊ contou de você para não se contradizer). Junte com o que já lembrava, tire repetições e coisas sem importância. NÃO anote estado do jogo que muda (seu equipamento, peça ou material que você precisa, nível, onde você está, missão, horta, o que vão fazer hoje ou amanhã): o jogo te conta isso na hora. No máximo ${M.max} itens curtos (até ${M.tamanho} letras), em português do Brasil, na primeira pessoa ("ele gosta de...").
Dicas de combate que ele pediu para você seguir (true se ele pediu, false se pediu para parar, deixe de fora se não falou): ${regras}.
Fatos que você já sabe dele (não repita estes): ${(dados.fatos || []).join('; ') || '(nenhum)'}.
Em "fatos", ponha só os fatos NOVOS e duradouros sobre a vida dele que ele contou HOJE (família, trabalho, onde mora, saúde, perdas, gostos e o que ele não gosta, sonhos), um por item, curto, na terceira pessoa ("o pai dele morreu", "ele trabalha num restaurante", "ele não gosta de guerreiro"). Nada de coisa passageira do jogo. Se não tiver nada novo, lista vazia.
Devolva só JSON: {"memorias": ["..."], "fatos": [], "regras": {}}`;
  const lerDiario = (out) => ({ memorias: Array.isArray(out.memorias) ? out.memorias : null, fatos: Array.isArray(out.fatos) ? out.fatos : null, regras: out.regras && typeof out.regras === 'object' ? out.regras : null });
  // André 2026-11-19 (a memória da Cecília e do Dario volta com a IA): o diário vai primeiro no Gemini, depois no Groq
  if (!chaveJogador) { const out = await geminiJson(prompt); if (out && typeof out === 'object') return lerDiario(out); }
  if (!chave) return null;
  for (const modelo of [...MODELOS_DIARIO, process.env.GROQ_MODELO || 'openai/gpt-oss-120b']) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${chave}` },
        body: JSON.stringify({ model: modelo, messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.3, max_tokens: 2500 }),
        signal: AbortSignal.timeout(15000),
      });
      if (r.status === 404 || r.status === 400) continue; // modelo saiu do Groq: tenta o próximo
      if (!r.ok) return null; // limite do dia ou chave ruim: fica para a próxima conversa
      return lerDiario(JSON.parse((await r.json())?.choices?.[0]?.message?.content || '{}'));
    } catch { return null; }
  }
  return null;
}

// ---------- dica vira regra (André 2026-11-11: "a IA é chamada uma vez e transforma a dica numa regra") ----------
// Uma chamada só, com a lista fechada de sentidos e ações do cérebro (CEREBRO em shared/dados.js). Devolve a regra crua
// ({ quando, faca, por, texto }) ou null; quem confere e guarda é o jogo (shared/cerebro.js validarRegra).
export async function dicaParaRegra(texto, nomeNpc, chaveJogador = '') {
  const chave = chaveJogador || segredo('GROQ_CHAVE');
  if ((!chave && !chaveGemini()) || !texto) return null;
  if (!chaveJogador) { // chave do servidor: o mesmo limite do dia das respostas
    const hoje = diaIa();
    if (hoje !== dia) { dia = hoje; usadas = 0; }
    if (usadas >= AMIGA.chat.iaPorDia) return null;
    usadas++;
  }
  const S = Object.entries(CEREBRO.sentidos).map(([k, v]) => `- ${k} (${v.tipo === 'n' ? 'número, use "<" ou ">"' : v.tipo === 'b' ? 'true/false, use "="' : '"Espada" ou "Magia", use "="'}): ${v.texto}`).join('\n');
  const A = Object.entries(CEREBRO.acoes).map(([k, v]) => `- ${k}: ${v}`).join('\n');
  const prompt = `Você transforma a dica que um jogador deu para ${nomeNpc} (um NPC de RPG medieval que luta com espada e cajado) numa regra de combate.
Sentidos que o NPC enxerga:
${S}
Ações que ele pode fazer:
${A}
A regra é: quando TODAS as condições forem verdadeiras, ele faz a ação. Use de 1 a ${CEREBRO.dicas.condicoes} condições, só com os sentidos da lista.
"por" = quantos segundos a ação dura (recuar, trocar de arma), de ${CEREBRO.dicas.por[0]} a ${CEREBRO.dicas.por[1]}.
"texto" = o que ${nomeNpc} vai fazer, curto, em primeira pessoa sem "eu" e começando com verbo (ex.: "recuar quando o chefe levantar o braço").
Se a dica não for sobre combate ou não der para montar com a lista, devolva {"ok": false}.
Exemplo: "recua quando o chefe levantar o braço" -> {"ok": true, "regra": {"quando": [["preparando", "=", true], ["preparoChefe", "=", true]], "faca": "recuar", "por": 1.2, "texto": "recuar quando o chefe levantar o braço"}}
Exemplo: "bebe poção quando tiver com metade da vida" -> {"ok": true, "regra": {"quando": [["vida", "<", 0.5], ["temPocao", "=", true]], "faca": "pocao", "texto": "beber poção com metade da vida"}}
Dica: "${String(texto).slice(0, 300).replace(/"/g, "'")}"
Devolva só JSON.`;
  if (!chaveJogador) { const out = await geminiJson(prompt, { temperatura: 0.1, maximo: 800, espera: 10000 }); if (out?.ok && out.regra && typeof out.regra === 'object') return out.regra; if (out) return null; } // Gemini primeiro
  if (!chave) return null;
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${chave}` },
      body: JSON.stringify({ model: process.env.GROQ_MODELO || 'openai/gpt-oss-120b', messages: [{ role: 'user', content: prompt }], response_format: { type: 'json_object' }, temperature: 0.1, max_tokens: 500, reasoning_effort: 'low' }),
      signal: AbortSignal.timeout(10000),
    });
    if (!r.ok) return null;
    const out = JSON.parse((await r.json())?.choices?.[0]?.message?.content || '{}');
    return out?.ok && out.regra && typeof out.regra === 'object' ? out.regra : null;
  } catch { return null; }
}

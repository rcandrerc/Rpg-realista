// IA grátis da Cecília (André 2026-11-09: conversar com ela "no chat como uma pessoa normal").
// Só liga quando o servidor tem a chave GROQ_CHAVE (Groq, grátis, preferida) ou GEMINI_CHAVE (Google AI Studio); sem chave, sem
// internet, passou do limite do dia ou a IA demorou, devolve null e quem responde são as regras (shared/amiga.js).
// A IA só escreve a fala e escolhe UMA ação da lista; o jogo confere tudo (ela pode recusar o time mesmo assim).
import fs from 'node:fs';
import path from 'node:path';
import { AMIGA, CEREBRO } from '@rpg/shared';


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
    if (usadas >= AMIGA.chat.iaPorDia) return null; // conta só as respostas que a IA deu (contarIa)
  }
  const modelo = process.env.GEMINI_MODELO || 'gemini-2.5-flash';
  const mensagens = mensagensConversa(ctx, texto);
  const prompt = mensagens.map((m) => m.content).join('\n'); // o Gemini (reserva) recebe tudo junto
  // Groq (André 2026-11-09: "é mais rápido"): grátis sem cartão, responde em menos de 1 s. Tem preferência; sem ele, Gemini.
  // André 2026-11-12 ("a IA tá muito burra"): o modelo menor (gpt-oss-20b, entrega 5) respondia mal e, com Cecília e Dario
  // respondendo juntos no chat de time, o limite POR MINUTO do Groq (429) estourava e quem respondia eram as falas prontas.
  // Agora: o grande primeiro (o de antes, que era esperto); 429 é por modelo, então passa para o próximo da lista em vez de
  // desistir; se o Groq pedir para esperar pouco (retry-after), espera e tenta de novo. Tudo dentro de 10 s.
  const groq = chaveJogador || segredo('GROQ_CHAVE');
  if (groq) {
    const fim = Date.now() + 10000;
    for (const modelo of modelosConversa()) {
      for (let tentativa = 0; tentativa < 2; tentativa++) {
        const falta = fim - Date.now(); if (falta < 1500) break;
        let r;
        try {
          r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${groq}` },
            body: JSON.stringify({ model: modelo, messages: mensagens, response_format: { type: 'json_object' }, temperature: 0.8, max_tokens: 900, ...(/gpt-oss/.test(modelo) ? { reasoning_effort: 'low' } : {}) }),
            signal: AbortSignal.timeout(falta),
          });
        } catch { break; } // tempo acabou ou rede: tenta o próximo modelo se ainda der
        if (r.ok) {
          let v = null; try { v = lerResposta((await r.json())?.choices?.[0]?.message?.content); } catch { /* quebrada */ }
          if (v) { contarIa(chaveJogador); return v; }
          break; // resposta quebrada: o próximo modelo
        }
        if (r.status === 401) return gemini(); // chave errada: nenhum modelo do Groq vai
        if (r.status === 400) { // o modelo escreveu a fala sem o JSON (json_validate_failed): aproveita o texto, não a fala pronta
          let v = null; try { v = salvarResposta((await r.json())?.error?.failed_generation); } catch { /* sem texto */ }
          if (v) { contarIa(chaveJogador); return v; }
        }
        if (r.status === 429) { // limite do minuto (ou do dia) deste modelo
          const espera = Number(r.headers?.get?.('retry-after')) * 1000;
          if (tentativa === 0 && espera > 0 && espera <= 3000 && fim - Date.now() > espera + 1500) { await new Promise((ok) => setTimeout(ok, espera)); continue; }
        }
        break; // 404/400 (modelo saiu), 429 longo, 5xx: o próximo modelo
      }
    }
  }
  return gemini();
  async function gemini() {
    if (!chave) return null;
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': chave },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.9, maxOutputTokens: 200, thinkingConfig: { thinkingBudget: 0 } } }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) return null;
      const v = lerResposta((await r.json())?.candidates?.[0]?.content?.parts?.[0]?.text);
      if (v) contarIa(chaveJogador);
      return v;
    } catch { return null; }
  }
}
// ---------- a conversa (André 2026-11-13: "no começo era como falar com o Gemini; agora respondem sem lógica") ----------
// O que estragou: a ficha cresceu (equipamento, peça mais fraca, mochila, ouro, troca, memória, dicas) num pedido só, com
// a conversa colada no meio como texto. O modelo passou a achar que tinha de falar de tudo: toda resposta puxava "troca
// esse peitoral", e às vezes trocava quem disse o quê. Agora é como um chat de verdade: as regras do jeito de falar no
// "system", a ficha separada como "só para você saber", e a conversa em mensagens de verdade (ele = user, ela = assistant),
// com a última mensagem dele por último. A ficha continua inteira: ela sabe de tudo, só não fica repetindo.
export function mensagensConversa(ctx, texto) {
  const homem = ctx.genero === 'm', o = homem ? 'o' : 'a', amig = homem ? 'amigo' : 'amiga';
  const sistema = [
    `Você é ${ctx.nome}, ${ctx.persona || 'uma guerreira de anime brincalhona num RPG medieval de fantasia'}. Você é ${amig} de ${ctx.amigo}, de igual para igual (não ${homem ? 'servo' : 'serva'}): tem vontade própria, opinião, humor, pode recusar e pedir favores.`,
    ctx.semCasa ? `Vive de aventura, ainda sem casa própria (mora em ${ctx.mora || 'a vila'}) e caça ${homem ? 'sozinho' : 'sozinha'} quando ninguém chama.` : 'Tem sua casinha e sua horta na vila inicial.',
    ctx.time?.length ? `Você está no chat do time com ${ctx.amigo} e ${ctx.time.join(', ')}, como amigos de verdade. Fale com ${ctx.amigo}; se ${ctx.time.join(' ou ')} já respondeu, não repita o que foi dito: complemente, concorde, discorde ou brinque.` : `Você está conversando com ${ctx.amigo} pelo chat do jogo, como duas pessoas de verdade.`,
    'Como conversar:',
    `- Responda ao que ${ctx.amigo} ACABOU de dizer, no assunto dele. Se ele perguntou, responda a pergunta. Se ele elogiou, brincou ou desabafou, reaja a isso.`,
    '- Seja natural: conte o que está fazendo ou pensando, dê opinião, faça uma pergunta de volta de vez em quando. Pode ser engraçad' + o + ' e provocar de leve.',
    // André 2026-11-13: "linguagem muito fofinha... queria que parecesse mais um jogador mesmo" (de RPG online, não morador de fantasia)
    `- Fale como jogador${homem ? '' : 'a'} de MMORPG no chat (gamer brasileiro), não como personagem de conto de fadas: gírias de jogo com naturalidade, tipo upar, farmar, grindar, dropar, mob, boss, DG (dungeon), pt (time), tankar, kitar, aggro, respawn, build, loot, cd (recarga), buff, nerf, hit, crit, "bora", "partiu", "tmj", "vlw", "kkkk". Ex.: "bora farmar uns mobs?", "tô precisando upar", "partiu DG?", "esse boss dropa bem".`,
    homem ? '- Você é homem: fale de si no masculino (cansado, pronto, sozinho).' : '- Você é mulher: fale de si no feminino (cansada, pronta, sozinha).',
    '- Nada de jeito fofinho ou meloso (sem "fofinho", "querido", "aventureiro", "nobre", "que gracinha"), nem linguagem antiga de fantasia. Pode zoar e ser direto, de boa, como amigo de guild.',
    '- Use a ficha abaixo só quando ajudar na resposta. NÃO puxe assunto de troca, equipamento, mochila, ouro ou pedido se ele não falou disso; no máximo uma vez a cada várias mensagens e só se encaixar.',
    '- Não repita frase nem assunto que você já disse na conversa. Lembre do que ele disse antes.',
    `- Português do Brasil informal, curto como no chat do celular (1 a 2 frases), sem emoji demais. Fique no mundo do jogo (nada de internet, celular ou IA). Você é ${ctx.nome}; quem fala com você é ${ctx.amigo}.`,
  ];
  const ficha = [
    `Agora: ${ctx.fazendo}. ${ctx.noite ? 'É noite.' : 'É dia.'} Distância até ${ctx.amigo}: ${ctx.distancia} m. ${ctx.noTime ? 'Vocês estão no mesmo time.' : 'Vocês não estão no mesmo time.'}`,
    `Seu nível ${ctx.nivel}, o de ${ctx.amigo} ${ctx.nivelAmigo}. Amizade: ${ctx.amizade} (0 = começo).${ctx.semCasa ? '' : ` Sua casa: ${ctx.casaPronta ? 'pronta' : 'em obra'}.`}`,
    ctx.comOutro ? `Agora você está acompanhando ${ctx.comOutro} (outro amigo); para fazer algo com ${ctx.amigo}, só depois.` : '',
    ctx.chamou ? `Há pouco você chamou ${ctx.amigo} (${ctx.chamou}) e espera a resposta.` : '',
    ctx.equip ? `Você está usando: ${ctx.equip}.${ctx.pecaFraca ? ` A peça mais fraca é ${ctx.pecaFraca} (se ele oferecer ajuda ou falar de equipamento, dá para pedir uma melhor pela troca).` : ''}` : '',
    `Você tem ${ctx.ouro ?? 0} de ouro${ctx.mochila ? `; na mochila: ${ctx.mochila}` : ''}.${ctx.pedido ? ` Está precisando de ${ctx.pedido}.` : ''}`,
    ctx.memoria?.length ? `O que você lembra de ${ctx.amigo} de outros dias (use com naturalidade quando fizer sentido): ${ctx.memoria.join('; ')}.` : '',
    ctx.regras?.length ? `Dicas de combate que ${ctx.amigo} te ensinou e você segue: ${ctx.regras.join('; ')}.` : '',
  ].filter(Boolean);
  const acoes = `Junto com a fala, escolha a ação que a última mensagem de ${ctx.amigo} pede: "time" (chama para o time, para caçar ou lutar junto), "sairTime" (quer que você saia do time), "vir" (pede para você ir até ele; "me chama de X" é apelido, não pedido para ir), "ajuda" (oferece ajuda ou pergunta se você precisa de algo), "sim"/"nao" (resposta a um chamado seu), "nada" (só conversa: a maioria das mensagens). A ação é o que ${ctx.amigo} PEDIU na última mensagem: se foi você que sugeriu caçar ou chamou, a ação é "nada".
Se a ação for "time", "vir" ou "sim", a fala ACEITA com alegria (quem decide se dá é o jogo; se não der, ele troca a fala). Nunca recuse na fala. Fora do time, aceitar o time é só topar: peça para ele mandar o convite do time (é ele quem dá o time pelo botão, como entre jogadores); não diga que já entrou. Troca também: ele abre a troca tocando em você.
Devolva só JSON: {"fala": "...", "acao": "nada"}`;
  const msgs = [{ role: 'system', content: `${sistema.join('\n')}\nFicha (só para você saber, não precisa citar):\n- ${ficha.join('\n- ')}\n${acoes}` }];
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
  const hoje = new Date().toISOString().slice(0, 10);
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
const MODELOS_DIARIO = ['openai/gpt-oss-20b', 'qwen/qwen3.8-27b']; // o Llama 3.1 8B saiu do Groq (404, 2026-11-13)
export async function escreverDiario(dados, chaveJogador = '') {
  const chave = chaveJogador || segredo('GROQ_CHAVE');
  if (!chave || !dados?.conversa?.length) return null;
  const M = AMIGA.memoria, regras = Object.entries(M.regras).map(([k, r]) => `"${k}" = ${r.texto}`).join('; ');
  const eu = dados.nomeAmigo || AMIGA.nome; // Cecília ou Dario (André 2026-11-11)
  const conversa = dados.conversa.map((m) => `${m.de === 'ele' ? dados.nome : eu}: ${m.texto}`).join('\n');
  const prompt = `Você é ${eu}, ${dados.genero === 'm' ? 'um guerreiro' : 'uma guerreira'} de um RPG medieval, escrevendo seu diário sobre seu amigo ${dados.nome}.
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

// ---------- dica vira regra (André 2026-11-11: "a IA é chamada uma vez e transforma a dica numa regra") ----------
// Uma chamada só, com a lista fechada de sentidos e ações do cérebro (CEREBRO em shared/dados.js). Devolve a regra crua
// ({ quando, faca, por, texto }) ou null; quem confere e guarda é o jogo (shared/cerebro.js validarRegra).
export async function dicaParaRegra(texto, nomeNpc, chaveJogador = '') {
  const chave = chaveJogador || segredo('GROQ_CHAVE');
  if (!chave || !texto) return null;
  if (!chaveJogador) { // chave do servidor: o mesmo limite do dia das respostas
    const hoje = new Date().toISOString().slice(0, 10);
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

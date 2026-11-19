// IA sem palavrão (Segurança 2026-11-19, plano de lançamento; a filha do André joga): o que a Cecília e o Dário falam pela
// IA passa por semPalavrao antes do chat, e o pedido para a IA manda nunca falar palavrão, nem de volta.
// Uso: node ferramentas/testes/ia-sem-palavrao.mjs
import { semPalavrao } from '../../shared/dados.js';
import * as D from '../../shared/dados.js';
import { salvarResposta, mensagensConversa } from '../../server/ia-amiga.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const casos = { 'Porra, que mob chato!': 'Poxa, que mob chato!', 'caralhooo kkkk': 'caramba kkkk', 'que merda de drop': 'que droga de drop', 'isso é foda': 'isso é tenso',
  'p0rra mano': 'poxa mano', 'PQP que lag': '*** que lag', 'vai tomar no cu': 'vai tomar no ***', 'seu filho da puta': 'seu filho da ***', 'CARALHO': 'CARAMBA' };
for (const [a, b] of Object.entries(casos)) ok(semPalavrao(a) === b, `"${a}" -> "${semPalavrao(a)}"`);
for (const t of ['putz, morri', 'computador ruim', 'disputa boa', 'cuidado com o boss', 'o veado fugiu', 'cornucópia', 'curto', 'reputação', 'caraca', 'Cecília', 'Escudo de Pedra', 'bora pra DG', 'cupom', 'Cunha'])
  ok(semPalavrao(t) === t, `"${t}" passa igual`);
ok(salvarResposta('{"fala":"Porra, que lag!","acao":"nada"}')?.fala === 'Poxa, que lag!', 'resposta em JSON da IA sai sem palavrão');
ok(salvarResposta('Caralho, que drop')?.fala === 'Caramba, que drop', 'resposta sem JSON (salvarResposta) também');
const msgs = mensagensConversa({ nome: 'Cecília', amigo: 'Ana', conversa: [] }, 'oi');
ok(/NUNCA fala palavrão/.test(JSON.stringify(msgs)), 'o pedido para a IA manda nunca falar palavrão');
// as falas prontas dos NPCs (sem IA) também não têm palavrão
const textos = []; const junta = (v, n = 0) => { if (n > 6 || v == null) return; if (typeof v === 'string') textos.push(v); else if (Array.isArray(v)) v.forEach((x) => junta(x, n + 1)); else if (typeof v === 'object') Object.values(v).forEach((x) => junta(x, n + 1)); };
for (const k of ['AMIGA', 'FALAS_GUERRA', 'ASSUNTOS_GUERRA', 'DUPLAS_GUERRA', 'AMIGOS_VIRTUAIS', 'RIVAIS']) junta(D[k]);
const ruins = textos.filter((t) => semPalavrao(t) !== t);
ok(textos.length > 100 && !ruins.length, `${textos.length} falas prontas sem palavrão${ruins.length ? ': ' + ruins.slice(0, 5).join(' | ') : ''}`);

// IA sem palavrão (Segurança 2026-11-19, plano de lançamento; a filha do André joga): o que a Cecília e o Dário falam pela
// IA passa por semPalavrao antes do chat, e o pedido para a IA manda nunca falar palavrão, nem de volta.
// Uso: node ferramentas/testes/ia-sem-palavrao.mjs
import { semPalavrao, palavraoPesado } from '../../shared/dados.js';
import * as D from '../../shared/dados.js';
import { salvarResposta, mensagensConversa, regraLimpa, fatosSeguros } from '../../server/ia-amiga.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const casos = { 'Porra, que mob chato!': 'Poxa, que mob chato!', 'caralhooo kkkk': 'caramba kkkk', 'que merda de drop': 'que droga de drop', 'isso é foda': 'isso é tenso',
  'p0rra mano': 'poxa mano', 'PQP que lag': '*** que lag', 'vai tomar no cu': 'vai passear', 'seu filho da puta': 'seu filho da ***', 'CARALHO': 'CARAMBA',
  'foda-se': 'dane-se', 'Fodase o boss': 'Dane-se o boss', 'puta merda': 'caramba', 'puta que pariu': 'caramba', 'vai se foder': 'vai passear', 'poha': 'poxa', 'karalho': 'caramba',
  'mrd': 'droga', 'p o r r a': 'poxa', 'p.o.r.r.a': 'poxa', 'levou porrada': 'levou monte', 'se fudeu': 'se ***', 'fuck': '***', 'WTF': '***', 'motherfucker': '***',
  'se foda': 'dane-se', 'P O R R A': 'POXA', 'p/o/r/r/a': 'poxa', 'por\u200bra': 'poxa', 'ｐｏｒｒａ': 'poxa', 'p\u043erra': 'poxa', 'damn it': 'darn it', 'vai tomar no c u': 'vai passear' };
for (const [a, b] of Object.entries(casos)) ok(semPalavrao(a) === b, `"${a}" -> "${semPalavrao(a)}"`);
for (const t of ['putz, morri', 'computador ruim', 'disputa boa', 'cuidado com o boss', 'o veado fugiu', 'cornucópia', 'curto', 'reputação', 'caraca', 'Cecília', 'Escudo de Pedra', 'bora pra DG', 'cupom', 'Cunha',
  'leve as pérolas no porão do navio', 'porao', 'Poraquê', 'o viaduto caiu', 'vadiar na vila', 'fodder', 'Putin', 'porta arrombada', 'pica-pau', 'rola o dado', 'Moby Dick', 'a e i o u', 'é o 1 e o 2', 'P.S. volta logo',
  'o baú foi arrombado', 'espada bastarda', 'corno de caça', 'Fukuoka', 'shiitake', 'cockatrice', 'pau de madeira', 'sexta-feira', 'Karai', 'Pohatu'])
  ok(semPalavrao(t) === t, `"${t}" passa igual`);
ok(salvarResposta('{"fala":"Porra, que lag!","acao":"nada"}')?.fala === 'Poxa, que lag!', 'resposta em JSON da IA sai sem palavrão');
ok(salvarResposta('Caralho, que drop')?.fala === 'Caramba, que drop', 'resposta sem JSON (salvarResposta) também');
ok(salvarResposta('{"fala":"seu filho da puta","acao":"nada"}') === null && salvarResposta('vai tomar no cu seu otário') === null, 'xingamento: a fala inteira da IA é jogada fora');
ok(palavraoPesado('porra') === false && palavraoPesado('putaria') === true, 'palavraoPesado só para xingamento');
for (const t of ['*** seu filho da puta', 'kkk *** vai tomar no cu', 'p*rra', 'f**k', 'arrombado', 'filhodaputa', 'pu ta', 'bullshit', 'stfu', 'transar', 'chupa meu pau', 'seu filho da p u t a'])
  ok(palavraoPesado(t), `"${t}" é pesado (a fala é jogada fora)`);
ok(salvarResposta('{"fala":"sua {pu|x}ta","acao":"nada"}')?.fala !== 'sua puta', 'chave de gênero { } não monta palavrão depois do filtro');
ok(fatosSeguros(['ele mora em Curitiba', 'ele tem 12 anos', 'ele gosta de pescar', 'ele está doente']).join() === 'ele gosta de pescar', 'fato sensível antigo não volta para a IA');
ok(salvarResposta('{"fala":"' + 'a'.repeat(298) + ' porra","acao":"nada"}')?.fala.includes('porr') === false, 'filtra antes de cortar em 300');
ok(regraLimpa({ faca: 'recuar', texto: 'recuar quando o merda do chefe levantar o braço' }).texto === 'recuar quando o droga do chefe levantar o braço', 'dica vira regra: texto sem palavrão');
ok(regraLimpa({ faca: 'recuar', texto: 'recuar quando esse filho da puta levantar o braço' }) === null, 'dica vira regra: xingamento joga a regra fora');
const msgs = mensagensConversa({ nome: 'Cecília', amigo: 'Ana', conversa: [] }, 'oi');
ok(/NUNCA fala palavrão/.test(JSON.stringify(msgs)), 'o pedido para a IA manda nunca falar palavrão');
// as falas prontas dos NPCs (sem IA) também não têm palavrão
const textos = []; const junta = (v, n = 0) => { if (n > 9 || v == null) return; if (typeof v === 'string') textos.push(v); else if (Array.isArray(v)) v.forEach((x) => junta(x, n + 1)); else if (typeof v === 'object') Object.values(v).forEach((x) => junta(x, n + 1)); };
for (const [k, v] of Object.entries(D)) if (k !== 'PALAVROES') junta(v); // tudo que dados.js exporta: missão, item, história
const ruins = textos.filter((t) => semPalavrao(t) !== t);
ok(textos.length > 100 && !ruins.length, `${textos.length} falas prontas sem palavrão${ruins.length ? ': ' + ruins.slice(0, 5).join(' | ') : ''}`);

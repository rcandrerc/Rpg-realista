// Chat de time (André 2026-11-11: "eu falo com eles todos"): a mensagem chega a todos do time, NPCs inclusive, e a resposta
// do NPC vai para o time. Uso: node ferramentas/testes/chat-time.mjs
import { Simulacao, MAPA_CLAREIRA, CHAT, AMIGA } from '../../shared/index.js';
const ok = (v, m) => { if (!v) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const a = s.adicionarJogador('A', 'Ana', null, { conta: 1 }), b = s.adicionarJogador('B', 'Beto', null, { conta: 2 }), c = s.adicionarJogador('C', 'Caio', null, { conta: 3 });
const ev = () => { const e = s.eventos; s.eventos = []; return e.filter((x) => x.t === 'chat'); };
ok(!s.chat('A', { canal: 'time', texto: 'oi time' }) && s.eventos.some((e) => e.t === 'aviso' && e.para === 'A'), 'fora de time não fala no time');
s.eventos = []; s.tempo += 5;
// Cecília entra e vai para o time de Ana e Beto
s.amigaEntrar('A');
const cec = s.amiga;
const T = { lider: 'A', membros: ['A', 'B', cec.id] }; a.time = b.time = cec.time = T; (s.times ||= new Set()).add(T);
s.eventos = [];
const m = s.chat('A', { canal: 'time', texto: 'vem cá todo mundo' });
ok(m && m.canal === 'time' && m.membros.includes(a.conta) && m.membros.includes(b.conta) && !m.membros.includes(c.conta), 'a mensagem leva quem está no time');
s.receberChat(m);
const e1 = ev();
ok(e1.some((e) => e.para === 'A' && e.meu) && e1.some((e) => e.para === 'B' && !e.meu) && !e1.some((e) => e.para === 'C'), 'chega a Ana e Beto, Caio não vê');
ok(s.amigosIaNoTime('A').some((x) => x.amiga === cec), 'a Cecília (NPC do time) ouve o chat de time');
ok(!s.amigosIaNoTime('C').length, 'quem não está no time não fala com os NPCs pelo time');
// a resposta dela vai para o time (viaTime), não para o privado
cec.ia.viaTime = s.tempo + CHAT.respostaTime;
s.dizerAmiga('Indo!', true, 'A'); s.eventos = []; s.passoChatAmiga(cec);
const e2 = ev();
ok(e2.length >= 2 && e2.every((e) => e.canal === 'time' && e.c === AMIGA.conta) && e2.some((e) => e.para === 'B'), 'a Cecília responde no time e o Beto vê');
cec.ia.viaTime = 0; s.dizerAmiga('Só pra você', true, 'A'); s.passoChatAmiga(cec);
const e3 = ev().filter((e) => e.para !== cec.id);
ok(e3.length === 1 && e3[0].canal === 'pm' && e3[0].para === 'A', 'falando no privado, responde no privado');
// histórico: só quem estava no time
s.historicoChat('B', [], [], [], [m]); s.historicoChat('C', [], [], [], [m]);
const h = s.eventos.filter((e) => e.t === 'chatHist'); s.eventos = [];
ok(h.find((e) => e.para === 'B').lista.length === 1 && h.find((e) => e.para === 'C').lista.length === 0, 'histórico do time só para quem estava nele');

// Botões da Cecília e do Dario como de jogador real (André 2026-11-13): o botão de time só convida ou tira do time,
// sem nenhuma frase no chat por ele. No chat ela só topa ("manda o convite"); o time entra quando ele toca no botão.
// A troca ela também só topa pelo chat: quem abre é ele (Pedir troca). O que ela pediu chega pela troca.
// Uso: node ferramentas/testes/amiga-botoes.mjs
import { Simulacao, MAPA_CLAREIRA, AMIGA, DARIO } from '../../shared/index.js';
import { guardar } from '../../shared/progresso.js';
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA);
const d = s.adicionarJogador('andre', 'André', 'ruiva', {});
s.amigaEntrar('andre');
const c = s.amiga;
Object.assign(d, { x: c.x + 2, z: c.z, y: s.terreno.altura(c.x + 2, c.z) });
const pmDele = () => (c.ia.conversas?.[d.conta] || []).filter((m) => m.de === 'ele');
const chat = (texto) => { s.ouvirAmiga('andre', texto); s.respostaAmiga('andre', { assunto: s.assuntoAmiga(texto) }); };
const rr = Math.random;

// sem combinar: o botão convida e ela decide (aqui recusa) sem frase nenhuma no chat
c.amizade = 0; c.ia.combinado = 0; c.ia.recusaAte = 0;
Math.random = () => 0.9999; s.eventos = [];
s.time('andre', { acao: 'convidar', com: c.id });
Math.random = rr;
ok(!c.time && s.eventos.some((e) => e.t === 'aviso' && e.para === 'andre' && e.texto.includes('recusou')), 'sem combinar ela pode recusar (só um aviso, como jogador)');
ok(pmDele().length === 0 && !(c.ia.chatFila || []).length, 'o botão não escreveu nada no chat');

// no chat ela topa, mas não entra sozinha
c.ia.recusaAte = 0;
Math.random = () => 0.01; chat('bora caçar?'); Math.random = rr;
ok(!c.time && s.combinouAmiga(c), 'no chat ela só topa (não entra no time sozinha)');
ok((c.ia.chatFila || []).some((x) => AMIGA.falas.timeCombinado.includes(x.texto)), 'e pede o convite: "' + (c.ia.chatFila || []).at(-1)?.texto + '"');
const n0 = pmDele().length;
Math.random = () => 0.9999; s.time('andre', { acao: 'convidar', com: c.id }); Math.random = rr; // combinou: entra mesmo com sorteio ruim
ok(c.time && c.time === d.time, 'combinou no chat: o botão dá o time na hora');
ok(pmDele().length === n0, 'dar o time não mandou frase dele no chat');

// tirar do time pelo botão
s.time('andre', { acao: 'expulsar', com: c.id });
ok(!c.time && !d.time && pmDele().length === n0, 'tirar do time pelo botão: sai sem frase');

// troca: no chat ela só topa; quem abre é ele
chat('quer trocar?');
ok(!c.troca && !d.troca, 'no chat a troca não abre sozinha');
c.pedido = { k: 'lenha', n: 3 }; guardar(d.prog.mochila, { k: 'lenha', n: 3 });
c.x = d.x + 1; c.z = d.z;
s.troca('andre', { acao: 'pedir', com: c.id });
ok(c.troca && c.troca === d.troca, 'Pedir troca (como com jogador) abre');
const i = d.prog.mochila.findIndex((o) => o?.k === 'lenha');
s.troca('andre', { acao: 'por', i, n: 3 });
const amz = c.amizade | 0;
for (let k = 0; k < 20 * 6 && c.troca; k++) { s.passo(0.05); if (c.troca?.of[c.id].tranca && !c.troca.of['andre'].tranca) s.troca('andre', { acao: 'trancar', v: true }); if (c.troca?.of['andre'].tranca && !c.troca.of['andre'].ok) s.troca('andre', { acao: 'confirmar' }); }
ok(!c.troca && c.pedido === null && (c.amizade | 0) === amz + 1, 'o que ela pediu chegou pela troca: pedido cumprido, amizade +1');

// o Dario também
const s2 = new Simulacao(MAPA_CLAREIRA);
const d2 = s2.adicionarJogador('andre', 'André', 'ruiva', {});
const dario = s2.amigoIaDe(DARIO.id); dario.amigaEntrar('andre');
{
  const g = dario.amiga; g.ia.recusaAte = 0;
  Math.random = () => 0.01; dario.ouvirAmiga('andre', 'bora pro time?'); dario.respostaAmiga('andre', { assunto: 'time' }); Math.random = rr;
  ok(!g.time && dario.combinouAmiga(g), 'Dario: no chat só topa');
  s2.time('andre', { acao: 'convidar', com: g.id });
  ok(g.time && g.time === d2.time, 'Dario: entra pelo botão');
}

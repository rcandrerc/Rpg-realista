// Bots sinceros (André 2026-11-21): pediu algo de jogo que o chat não faz e a IA prometeu -> o jogo troca por um "não consigo".
// Uso: node ferramentas/sinceros/teste.mjs
const R = new URL('../../', import.meta.url).href;
const { Simulacao, MAPA_CLAREIRA } = await import(R + 'shared/index.js');
const { mensagensConversa } = await import(R + 'server/ia-amiga.js');
const s = new Simulacao(MAPA_CLAREIRA); s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
for (const x of s.amigosIa) x.amigaEntrar('andre', true); s.passo(0.05);
const c = s.amigosIa.find((x) => x.AMIGA.id === 'cecilia'); c.amiga.amigosDe = { 7: 1 };
let falhou = 0;
const caso = (texto, ia, deveTrocar) => {
  c.amiga.ia.chatFila = []; c.ouvirAmiga('andre', texto);
  c.respostaAmiga('andre', { assunto: ia.assunto, iaAssunto: ia.assunto, fala: ia.fala });
  const disse = c.amiga.ia.chatFila.map((f) => f.texto).join(' | ');
  const trocou = disse !== ia.fala;
  const ok = trocou === deveTrocar; if (!ok) falhou++;
  console.log(ok ? 'ok ' : 'ERRO', JSON.stringify(texto), '->', disse);
};
caso('faz um carrinho pra mim', { assunto: 'conversa', fala: 'Bora! Tô fazendo o carrinho agora, já já fica pronto.' }, true);
caso('consegue formar uma guilda pra gente?', { assunto: 'conversa', fala: 'Deixa comigo, vou montar a guilda!' }, true);
caso('pode fazer minha missão?', { assunto: 'conversa', fala: 'Já fiz, kkk' }, true);
caso('faz um carrinho pra mim', { assunto: 'conversa', fala: 'Isso não dá pra mim, não sei fazer carrinho.' }, false);
caso('o que vc tá fazendo?', { assunto: 'conversa', fala: 'Tô fazendo minha diária, plantando árvore.' }, false);
caso('tô cansado hoje', { assunto: 'conversa', fala: 'Descansa, o grind espera.' }, false);
const sis = mensagensConversa({ nome: 'Cecília', amigo: 'André', fazendo: 'de boa', conversa: [] }, 'oi')[0].content;
if (!/SINCERIDADE NO JOGO/.test(sis)) { falhou++; console.log('ERRO: prompt sem a regra de sinceridade'); } else console.log('ok  prompt tem a regra de sinceridade');
if (falhou) { console.log(falhou, 'falha(s)'); process.exit(1); } else console.log('tudo certo');

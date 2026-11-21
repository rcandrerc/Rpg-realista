// Achados da ronda de 2026-11-17 (chat do André com a Cecília): pedido repetido, "Tô montando no lobo" repetido,
// fato "missão desgrama" (gíria), "morreu também?" sem saber que caiu, e barquinho "não consigo".
// Sem rede. Uso: node ferramentas/testes/cecilia-ronda.mjs
import { Simulacao, MAPA_CLAREIRA, HISTORIA } from '../../shared/index.js';
import { register } from 'node:module';
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { return s === '@rpg/shared' ? { url: ${JSON.stringify(new URL('../../shared/index.js', import.meta.url).href)}, shortCircuit: true } : n(s, c); }`));
const { jaFalou, mensagensConversa } = await import('../../server/ia-amiga.js');
const ok = (c, m) => { if (!c) { console.error('FALHOU', m); process.exitCode = 1; } else console.log('ok', m); };
const s = new Simulacao(MAPA_CLAREIRA), j = s.adicionarJogador('andre', 'André', 'ruiva', { conta: 7 });
for (const x of s.amigosIa) x.amigaEntrar('andre', true); s.passo(0.05);
const c = s.amigosIa.find((x) => x.AMIGA.id === 'cecilia'), a = c.amiga;
// 1) pedido só na ficha se ela não falou dele nas últimas 8 falas
{
  const ctx = { conversa: [{ de: 'ela', texto: 'ainda preciso de 2 couros, hein' }], pedido: '2 Couro' };
  ok(jaFalou(ctx, '2 Couro'), 'falou de couro há pouco: a ficha não lembra o pedido');
  ctx.conversa = Array.from({ length: 9 }, (_, i) => ({ de: 'ela', texto: i ? 'bora upar' : 'preciso de couro' }));
  ok(!jaFalou(ctx, '2 Couro'), 'faz 9 falas que não fala: pode lembrar de novo');
}
// 2) "Tô montando no lobo" no máximo 1 vez a cada 10 min
{
  const falas = []; const d0 = c.dizerAmiga.bind(c); c.dizerAmiga = (t, ...r) => { if (c.AMIGA.chat.falas.aCaminho.includes(t)) falas.push(t); return d0(t, ...r); };
  const L = c.AMIGA.chat.falas.aCaminho, ia = a.ia;
  void L; a.time = null; j.x = a.x + 400; j.z = a.z;
  for (let k = 0; k < 3; k++) { ia.viagem = null; ia.vir = null; s.tempo += 130; c.longeAmiga(a, j, Math.hypot(j.x - a.x, j.z - a.z), 0.05); }
  ok(falas.length === 1, `em 6 min de viagem só um "a caminho" (${falas.length})`);
  c.dizerAmiga = d0;
}
// 3) fato de missão só com nome de missão de verdade
{
  c.anotarAmiga('7', { fatos: ['ele está na missão desgrama', `ele está na missão ${HISTORIA[3].nome}`, 'o pai dele morreu'] });
  const f = a.fatos['7'] || [];
  ok(!f.some((x) => /desgrama/.test(x)) && f.some((x) => x.includes(HISTORIA[3].nome)) && f.includes('o pai dele morreu'), `fatos: ${f.join(' | ')}`);
}
// 4) a ficha diz que ela caiu
{
  a.morto = true; a.ia.caiu = false; c.cabecaAmiga(0.05);
  let ctx = c.contextoAmiga('andre');
  ok(ctx.morta && ctx.caiuHa === 0, 'caída agora: a ficha diz');
  a.morto = false; s.tempo += 180; ctx = c.contextoAmiga('andre');
  ok(!ctx.morta && ctx.caiuHa === 3, 'renasceu: a ficha diz que caiu há 3 min');
  const sis = mensagensConversa(ctx, 'morreu tb?')[0].content;
  ok(/caiu \(morreu\) há 3 min/.test(sis), 'e isso vai para a IA');
}
// 5) barquinho: ela sabe que pode fazer
{
  const ctx = c.contextoAmiga('andre');
  ok(/dá para fazer/.test(ctx.barco) && /lenha/.test(ctx.barco), `barquinho na ficha: ${ctx.barco}`);
  ok(/o jogo faz de verdade/.test(mensagensConversa(ctx, 'o barquinho vc pode fazer')[0].content), 'a IA não diz que não consegue');
}
